/// sheet 域纯逻辑测试：工作簿模型、自研公式引用平移、排序/填充/透视公式、
/// 命令批次展开与图表标签格式化端口。
import { describe, expect, it } from 'vitest'

import {
  columnLabel,
  formatAddress,
  columnIndex,
  parseAddress,
  parseRange,
  rangeAddresses,
  rangeCellCount,
} from '../../src/sheet/domain/cell-address'
import {
  applyFlashFillTemplate,
  inferFlashFillTemplate,
} from '../../src/sheet/domain/flash-fill'
import { offsetFormulaRefs, shiftIndex, shiftSpecForOp } from '../../src/sheet/domain/formula-shift'
import {
  chartCategoryFormat,
  formatCategoryLabel,
} from '../../src/sheet/domain/chart-visual'
import { matchesLabelFilter } from '../../src/sheet/domain/pivot-filters'
import {
  evaluatePivotFormula,
  formatPivotFormula,
  parsePivotFormula,
} from '../../src/sheet/domain/pivot-formula'
import { computeSortChanges } from '../../src/sheet/domain/sort-range'
import {
  parseWorkbookCommandBatch,
  replaceOccurrences,
} from '../../src/sheet/domain/workbook-dsl'
import type { CellState } from '../../src/sheet/domain/workbook.types'
import type { FormatRangeOperation } from '../../src/sheet/domain/workbook-dsl'

describe('sheet domain：单元格地址模型', () => {
  it('parseAddress / formatAddress 往返（模型内行列 0 基）', () => {
    expect(parseAddress('B3')).toEqual({ row: 2, column: 1 })
    expect(parseAddress('AA10')).toEqual({ row: 9, column: 26 })
    expect(formatAddress(2, 1)).toBe('B3')
    expect(formatAddress(parseAddress('AA10').row, parseAddress('AA10').column)).toBe('AA10')
  })

  it('columnLabel / columnIndex 双向换算（0 基，含进位）', () => {
    expect(columnLabel(0)).toBe('A')
    expect(columnLabel(25)).toBe('Z')
    expect(columnLabel(26)).toBe('AA')
    expect(columnLabel(702)).toBe('AAA')
    expect(columnIndex('A')).toBe(0)
    expect(columnIndex('AAA')).toBe(702)
  })

  it('parseRange / rangeCellCount / rangeAddresses（闭区间 0 基）', () => {
    const bounds = parseRange('A1:B2')
    expect(bounds).toEqual({ startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 })
    expect(rangeCellCount(bounds)).toBe(4)
    expect(rangeAddresses(bounds)).toEqual(['A1', 'B1', 'A2', 'B2'])
    // 单点区间（无冒号）
    expect(rangeCellCount(parseRange('C3'))).toBe(1)
  })
})

describe('sheet domain：自研公式引用平移（formula-shift）', () => {
  it('offsetFormulaRefs 按行列增量平移相对引用、保留绝对引用', () => {
    expect(offsetFormulaRefs('=A1+B2', 1, 0)).toBe('=A2+B3')
    expect(offsetFormulaRefs('=A1+B2', 0, 2)).toBe('=C1+D2')
    expect(offsetFormulaRefs('=$A$1+B2', 1, 1)).toBe('=$A$1+C3')
    expect(offsetFormulaRefs('=SUM(A1:A3)', 1, 0)).toBe('=SUM(A2:A4)')
    expect(offsetFormulaRefs("=Sheet1!A1+('我的表'!B2)", 1, 1)).toBe(
      "=Sheet1!B2+('我的表'!C3)",
    )
    // 字符串字面量中的引用不平移
    expect(offsetFormulaRefs('="A1"&A1', 1, 0)).toBe('="A1"&A2')
  })

  it('shiftSpecForOp / shiftIndex：插入行平移与越界置空', () => {
    const spec = shiftSpecForOp({
      op: 'insert_rows',
      sheetId: 'sheet-1',
      row: 2,
      count: 1,
    })
    expect(spec).not.toBeNull()
    // 插入点之前的行不动、自插入点起整体后移（模型内 0 基索引）
    expect(shiftIndex(0, spec!)).toBe(0)
    expect(shiftIndex(1, spec!)).toBe(2)
    expect(shiftIndex(4, spec!)).toBe(5)
  })
})

describe('sheet domain：排序变更计算（sort-range）', () => {
  const readCell = (address: string): CellState => {
    const table: Record<string, CellState['value']> = {
      A1: '名称',
      B1: '数量',
      A2: '香蕉',
      B2: 2,
      A3: '苹果',
      B3: 9,
      A4: '薯片',
      B4: 5,
    }
    return { value: table[address] ?? null }
  }

  it('按关键列升序重排整行', () => {
    const changes = computeSortChanges(
      { range: 'A1:B4', byColumn: 'A', ascending: true, hasHeader: true },
      readCell,
    )
    const after = new Map(changes.map((change) => [change.address, change.after]))
    expect(after.get('A2')).toBe('苹果')
    expect(after.get('B2')).toBe(9)
    expect(after.get('A3')).toBe('薯片')
    expect(after.get('B3')).toBe(5)
    expect(after.get('A4')).toBe('香蕉')
    expect(after.get('B4')).toBe(2)
    // 变更记录携带重排前的值
    const before = new Map(changes.map((change) => [change.address, change.before]))
    expect(before.get('A2')).toBe('香蕉')
  })

  it('关键列越界与单行区间报错', () => {
    expect(() =>
      computeSortChanges({ range: 'A1:B4', byColumn: 'D', ascending: true, hasHeader: true }, readCell),
    ).toThrow()
    expect(() =>
      computeSortChanges({ range: 'A1:B1', byColumn: 'A', ascending: true, hasHeader: false }, readCell),
    ).toThrow()
  })
})

describe('sheet domain：快速填充模板（flash-fill）', () => {
  it('从示例推断「拼接」模板并对新输入套用', () => {
    // 单字符字段过易误配（实现要求字段长度 ≥2），用 ≥2 字段验证「字段+字面量」模板
    const template = inferFlashFillTemplate([
      { source: ['薯片', '生态'], output: '薯片-生态' },
      { source: ['苹果', '园区'], output: '苹果-园区' },
    ])
    expect(template).not.toBeNull()
    expect(template).toEqual([
      { kind: 'field', index: 0 },
      { kind: 'literal', text: '-' },
      { kind: 'field', index: 1 },
    ])
    expect(applyFlashFillTemplate(template!, ['薯片', '办公'])).toBe('薯片-办公')
  })

  it('无示例时不推断', () => {
    expect(inferFlashFillTemplate([])).toBeNull()
  })
})

describe('sheet domain：透视筛选与透视公式', () => {
  it('matchesLabelFilter 三种操作符', () => {
    expect(matchesLabelFilter({ kind: 'label', field: 0, op: 'equal', value: '薯片' }, '薯片')).toBe(true)
    expect(matchesLabelFilter({ kind: 'label', field: 0, op: 'equal', value: '薯片' }, '苹果')).toBe(false)
    expect(matchesLabelFilter({ kind: 'label', field: 0, op: 'contains', value: '片' }, '薯片')).toBe(true)
    expect(matchesLabelFilter({ kind: 'label', field: 0, op: 'beginsWith', value: '薯' }, '薯片')).toBe(true)
    expect(matchesLabelFilter({ kind: 'label', field: 0, op: 'beginsWith', value: '片' }, '薯片')).toBe(false)
  })

  it('透视计算公式解析/求值/格式化往返', () => {
    const ast = parsePivotFormula('销售额 * 0.13 + 1', ['销售额', '数量'])
    const valueOf = (name: string): number | null => (name === '销售额' ? 100 : null)
    expect(evaluatePivotFormula(ast, valueOf)).toBe(14)
    expect(evaluatePivotFormula(ast, () => 200)).toBe(27)
    // 格式化产物可再次解析并保持求值一致
    const text = formatPivotFormula(ast)
    expect(text).toBe("(('销售额'*0.13)+1)")
    expect(evaluatePivotFormula(parsePivotFormula(text, ['销售额', '数量']), valueOf)).toBe(
      evaluatePivotFormula(ast, valueOf),
    )
    // 未知字段在解析期报错
    expect(() => parsePivotFormula('缺失 + 1', ['销售额'])).toThrow()
  })
})

describe('sheet domain：命令批次解析与文本替换（workbook-dsl）', () => {
  it('parseWorkbookCommandBatch 校验合法批次', () => {
    const batch = parseWorkbookCommandBatch({
      dslVersion: 1,
      transactionId: 'txn-0001',
      baseRevision: 0,
      summary: '测试批次',
      operations: [
        { op: 'set_cell', sheetId: 'sheet-1', address: 'A1', value: 42 },
        { op: 'set_formula', sheetId: 'sheet-1', address: 'A2', formula: '=A1*2' },
      ],
    })
    expect(batch.operations).toHaveLength(2)
  })

  it('parseWorkbookCommandBatch 拒绝非法批次', () => {
    expect(() => parseWorkbookCommandBatch({ operations: [{ op: 'unknown_op' }] })).toThrow()
    expect(() => parseWorkbookCommandBatch({})).toThrow()
  })

  it('replaceOccurrences 大小写敏感/不敏感与字面 $ 替换', () => {
    expect(replaceOccurrences('薯片 Office office', 'office', '办公', true)).toBe('薯片 Office 办公')
    expect(replaceOccurrences('薯片 Office office', 'office', '办公', false)).toBe('薯片 办公 办公')
    expect(replaceOccurrences('a $100 b', '$100', '¥700', true)).toBe('a ¥700 b')
  })
})

describe('sheet domain：图表标签格式化端口（chart-visual）', () => {
  it('formatCategoryLabel 注入 formatter 生效、无 formatter 回退原文', () => {
    const percent = (format: string, value: number): string =>
      format === '0%' ? `${Math.round(value * 100)}%` : String(value)
    expect(formatCategoryLabel('0.25', '0%', percent)).toBe('25%')
    expect(formatCategoryLabel('0.25', '0%', undefined)).toBe('0.25')
    expect(formatCategoryLabel('0.25', 'General', percent)).toBe('0.25')
    expect(formatCategoryLabel('  ', '0%', percent)).toBe('  ')
    expect(formatCategoryLabel('abc', '0%', percent)).toBe('abc')
    // formatter 抛错按原文语义回退原始文本
    expect(formatCategoryLabel('1.5', '0%', () => {
      throw new Error('boom')
    })).toBe('1.5')
  })

  it('chartCategoryFormat 轴格式优先于系列格式', () => {
    expect(
      chartCategoryFormat({ categoryAxisFormat: '0.0%', series: [{ categoryFormat: '0%' } as never] }),
    ).toBe('0.0%')
    expect(chartCategoryFormat({ categoryAxisFormat: undefined, series: [] })).toBeUndefined()
  })
})

describe('sheet domain：格式操作标签（formatOpLabel 经 FormatRangeOperation 契约）', () => {
  it('formatOpLabel 描述加粗与清除语义', async () => {
    const { formatOpLabel } = await import('../../src/sheet/domain/workbook-dsl')
    const bold: FormatRangeOperation = {
      op: 'format_range',
      sheetId: 'sheet-1',
      range: 'A1:B2',
      format: { bold: true },
    }
    // 审计/操作标签为迁移原文（英文 op 标签，非界面文案）
    expect(formatOpLabel(bold)).toBe('A1:B2: bold')
    const clear: FormatRangeOperation = {
      op: 'format_range',
      sheetId: 'sheet-1',
      range: 'C3',
      format: { bold: null },
    }
    expect(formatOpLabel(clear)).toBe('C3: clear bold')
  })
})
