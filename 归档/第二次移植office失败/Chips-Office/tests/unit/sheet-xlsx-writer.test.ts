/**
 * Sheet xlsx 序列化器（writeXlsx）单元测试。
 *
 * 核心保证：parseXlsxBytes(writeXlsx(model)) 还原等价模型。
 * 覆盖单元格类型（字符串/数字/布尔/公式+缓存值/错误值）、多工作表、
 * 合并单元格、bookViews 活动工作表、中文工作表名与共享字符串转义、
 * 列宽行高、活动下标钳制、空工作簿与非法输入的错误处理路径。
 */
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { writeXlsx } from '../../src/apps/sheet/types/xlsx-writer'
import { parseXlsxBytes } from '../../src/apps/sheet/types/xlsx-parser'
import {
  createEmptySheetModel,
  createEmptyWorkbookModel,
  type WorkbookModel,
} from '../../src/apps/sheet/types/workbook-model'

/** 构建覆盖全部单元格类型与结构特性的三表工作簿。 */
function buildRichWorkbook(): WorkbookModel {
  const summary = createEmptySheetModel('季度汇总')
  summary.cells = {
    0: {
      0: { value: '月份' },
      1: { value: 42 },
      2: { value: true },
      3: { formula: 'SUM(B1,1)', result: 43 },
    },
    1: {
      0: { value: '营收' },
      1: { value: 3.14 },
      2: { value: false },
      4: { value: 0 },
    },
  }
  summary.merges = ['A1:B1']
  summary.colWidths = { 0: 16 }
  summary.rowHeights = { 0: 24 }

  const detail = createEmptySheetModel('明细数据')
  detail.cells = {
    0: {
      0: { value: '特殊<字符>&引号"测试\'' },
      5: { value: '' },
    },
    2: {
      1: { value: '第三行' },
      2: { formula: 'A1&"x"', result: '拼接结果' },
    },
    3: {
      0: { value: true },
      1: { formula: 'TRUE()', result: true },
      2: { formula: '1/0', error: '#DIV/0!' },
    },
  }
  detail.merges = ['A1:B2']

  const hidden = createEmptySheetModel('隐藏表')
  hidden.hidden = true

  return {
    fileName: '季度报表.xlsx',
    sheets: [summary, detail, hidden],
    activeSheetIndex: 1,
  }
}

describe('sheet xlsx 序列化器 writeXlsx 往返保证', () => {
  it('模型→字节→parseXlsxBytes 还原等价模型：类型/多表/合并/活动表/中文名', async () => {
    const source = buildRichWorkbook()
    const bytes = await writeXlsx(source)
    const parsed = await parseXlsxBytes(bytes)

    expect(parsed.sheets.map((sheet) => sheet.name)).toEqual(['季度汇总', '明细数据', '隐藏表'])
    expect(parsed.activeSheetIndex).toBe(1)
    expect(parsed.sheets[2]?.hidden).toBe(true)
    expect(parsed.sheets[0]?.hidden).toBe(false)

    expect(parsed.sheets[0]?.cells).toEqual(source.sheets[0]?.cells)
    expect(parsed.sheets[1]?.cells).toEqual(source.sheets[1]?.cells)
    expect(parsed.sheets[0]?.merges).toEqual(['A1:B1'])
    expect(parsed.sheets[1]?.merges).toEqual(['A1:B2'])
  })

  it('公式单元格缓存结果按类型标注并在往返后保留', async () => {
    const source = buildRichWorkbook()
    const parsed = await parseXlsxBytes(await writeXlsx(source))

    const summaryRow = parsed.sheets[0]?.cells[0]
    expect(summaryRow?.[3]).toEqual({ formula: 'SUM(B1,1)', result: 43 })

    const detailRow = parsed.sheets[1]?.cells[2]?.[2]
    expect(detailRow).toEqual({ formula: 'A1&"x"', result: '拼接结果' })
    expect(parsed.sheets[1]?.cells[3]?.[1]).toEqual({ formula: 'TRUE()', result: true })
    expect(parsed.sheets[1]?.cells[3]?.[2]).toEqual({ formula: '1/0', error: '#DIV/0!' })
  })

  it('中文共享字符串与 XML 特殊字符正确转义还原', async () => {
    const source = buildRichWorkbook()
    const bytes = await writeXlsx(source)
    const zip = await JSZip.loadAsync(bytes)

    const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('text')
    expect(sharedStringsXml).toContain('月份')
    expect(sharedStringsXml).toContain('特殊&lt;字符&gt;&amp;引号&quot;测试&apos;')

    const parsed = await parseXlsxBytes(bytes)
    expect(parsed.sheets[1]?.cells[0]?.[0]?.value).toBe('特殊<字符>&引号"测试\'')
  })

  it('列宽与行高按解析器约定往返', async () => {
    const source = buildRichWorkbook()
    const parsed = await parseXlsxBytes(await writeXlsx(source))

    expect(parsed.sheets[0]?.colWidths).toEqual({ 0: 16 })
    expect(parsed.sheets[0]?.rowHeights).toEqual({ 0: 24 })
  })

  it('写出字节为合法 zip 包并包含全部 OOXML 部件', async () => {
    const bytes = await writeXlsx(buildRichWorkbook())
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)

    const zip = await JSZip.loadAsync(bytes)
    expect(zip.file('[Content_Types].xml')).toBeTruthy()
    expect(zip.file('_rels/.rels')).toBeTruthy()
    expect(zip.file('xl/workbook.xml')).toBeTruthy()
    expect(zip.file('xl/_rels/workbook.xml.rels')).toBeTruthy()
    expect(zip.file('xl/styles.xml')).toBeTruthy()
    expect(zip.file('xl/sharedStrings.xml')).toBeTruthy()
    expect(zip.file('xl/worksheets/sheet1.xml')).toBeTruthy()
    expect(zip.file('xl/worksheets/sheet2.xml')).toBeTruthy()
    expect(zip.file('xl/worksheets/sheet3.xml')).toBeTruthy()

    const workbookXml = await zip.file('xl/workbook.xml')?.async('text')
    expect(workbookXml).toContain('name="季度汇总"')
    expect(workbookXml).toContain('name="明细数据"')
    expect(workbookXml).toContain('activeTab="1"')
    expect(workbookXml).toContain('state="hidden"')
  })

  it('空工作簿往返后仍为单张空白工作表', async () => {
    const source = createEmptyWorkbookModel('空白.xlsx')
    const parsed = await parseXlsxBytes(await writeXlsx(source))

    expect(parsed.sheets).toHaveLength(1)
    expect(parsed.sheets[0]?.name).toBe('工作表1')
    expect(parsed.sheets[0]?.cells).toEqual({})
    expect(parsed.sheets[0]?.merges).toEqual([])
    expect(parsed.activeSheetIndex).toBe(0)
  })

  it('活动工作表下标越界时按工作表数量钳制', async () => {
    const source = createEmptyWorkbookModel()
    source.sheets.push(createEmptySheetModel('第二张'))
    source.activeSheetIndex = 9

    const parsed = await parseXlsxBytes(await writeXlsx(source))
    expect(parsed.activeSheetIndex).toBe(1)
  })
})

describe('sheet xlsx 序列化器 writeXlsx 非法输入', () => {
  it('工作簿不含工作表时抛出中文错误', async () => {
    const invalid = createEmptyWorkbookModel()
    invalid.sheets = []

    await expect(writeXlsx(invalid)).rejects.toThrow('工作簿中没有工作表')
  })
})
