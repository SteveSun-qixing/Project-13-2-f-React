/// sheet 域字节级集成测试：全部走真实 .xlsx 字节（tests/fixtures/minimal.xlsx 与
/// csv-import 序列化产物），不 mock 任何解析器（jszip + 迁移的 gateway 原文解析）。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  applyCellEditsToXlsx,
  createBufferEntrySource,
  inventoryXlsx,
  readBasicWorkbook,
  sha256,
} from '../../src/sheet/gateway/xlsx-gateway'
import {
  blankXlsxBuffer,
  csvToXlsxBuffer,
  decodeCsvBuffer,
  isNumericCell,
  parseCsv,
  sniffDelimiter,
} from '../../src/sheet/gateway/csv-import'

const here = join(dirname(fileURLToPath(import.meta.url)))
const fixture = (): Buffer => readFileSync(join(here, '../fixtures/minimal.xlsx'))

describe('sheet gateway：真实 xlsx 字节解析', () => {
  it('readBasicWorkbook 读出双工作表、名称与单元格（共享字符串/内联字符串/数字/公式）', async () => {
    const imported = await readBasicWorkbook(fixture())
    expect(imported.snapshot.sheets.map((sheet) => sheet.name)).toEqual(['数据', '汇总'])
    expect(imported.sheetNamesById['sheet-1']).toBe('数据')
    expect(imported.sheetNamesById['sheet-2']).toBe('汇总')

    const cells = imported.snapshot.sheets[0]?.cells ?? {}
    expect(cells.A1).toEqual({ value: 1 })
    expect(cells.A2).toEqual({ value: 2 })
    // 共享字符串（t="s" → sharedStrings[0]）
    expect(cells.B1).toEqual({ value: '名称' })
    // 内联字符串（t="inlineStr"）
    expect(cells.B2).toEqual({ value: '薯片表格' })
    // 公式单元（<f>SUM(A1:A2)</f> → "=SUM(A1:A2)"）
    expect(cells.A3).toEqual({ value: null, formula: '=SUM(A1:A2)' })
    expect((imported.snapshot.sheets[1]?.cells ?? {}).A1).toEqual({ value: 42 })
  })

  it('inventoryXlsx 列出包内条目', async () => {
    const entries = await inventoryXlsx(fixture())
    const names = entries.map((entry) => entry.path)
    expect(names).toContain('xl/workbook.xml')
    expect(names).toContain('xl/worksheets/sheet1.xml')
    expect(names).toContain('xl/sharedStrings.xml')
    // 每个条目带大小与 sha256 摘要
    const workbook = entries.find((entry) => entry.path === 'xl/workbook.xml')
    expect(workbook?.size).toBeGreaterThan(0)
    expect(workbook?.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('createBufferEntrySource 提供字节容器的 paths/has/readText 面', async () => {
    const source = await createBufferEntrySource(fixture())
    const paths = await source.paths()
    expect(paths).toContain('xl/workbook.xml')
    expect(await source.has('xl/worksheets/sheet2.xml')).toBe(true)
    expect(await source.has('xl/missing.xml')).toBe(false)
    await expect(source.readText('xl/missing.xml')).rejects.toThrow()
    const workbookXml = await source.readText('xl/workbook.xml')
    expect(workbookXml).toContain('name="数据"')
  })

  it('sha256 对同字节稳定、对异字节不同', async () => {
    expect(await sha256(fixture())).toBe(await sha256(fixture()))
    expect(await sha256(fixture())).not.toBe(await sha256(fixture().subarray(0, 1024)))
  })
})

describe('sheet gateway：单元格编辑写回真实字节', () => {
  it('applyCellEditsToXlsx 写回后重读：目标更新、其余单元保持', async () => {
    const source = fixture()
    const mutation = await applyCellEditsToXlsx(source, [
      {
        sheetName: '数据',
        row: 0,
        column: 0,
        writeValue: true,
        cell: { value: 100 },
      },
    ])
    expect(mutation.buffer).toBeInstanceOf(Buffer)
    // 产出与输入不同字节
    expect(mutation.buffer.equals(source)).toBe(false)

    const reread = await readBasicWorkbook(mutation.buffer)
    const cells = reread.snapshot.sheets[0]?.cells ?? {}
    expect(cells.A1).toEqual({ value: 100 })
    // 未触碰的单元保持原文
    expect(cells.A2).toEqual({ value: 2 })
    expect(cells.B1).toEqual({ value: '名称' })
    expect(cells.B2).toEqual({ value: '薯片表格' })
    expect(cells.A3).toEqual({ value: null, formula: '=SUM(A1:A2)' })
    // 第二张表不受影响
    expect((reread.snapshot.sheets[1]?.cells ?? {}).A1).toEqual({ value: 42 })
    expect(reread.snapshot.sheets.map((sheet) => sheet.name)).toEqual(['数据', '汇总'])
  })

  it('applyCellEditsToXlsx 可清空单元并写入公式', async () => {
    const mutation = await applyCellEditsToXlsx(fixture(), [
      { sheetName: '数据', row: 0, column: 0, writeValue: true, cell: { value: null } },
      { sheetName: '汇总', row: 1, column: 1, writeValue: true, cell: { value: null, formula: '=数据!A1*2' } },
    ])
    const reread = await readBasicWorkbook(mutation.buffer)
    const dataCells = reread.snapshot.sheets[0]?.cells ?? {}
    const sumCells = reread.snapshot.sheets[1]?.cells ?? {}
    // 清空语义：单元从 sheet XML 中整体移除
    expect(dataCells.A1).toBeUndefined()
    expect(sumCells.B2).toEqual({ value: null, formula: '=数据!A1*2' })
  })

  it('空编辑计划产出可再次解析的工作簿（往返稳定）', async () => {
    const source = fixture()
    const mutation = await applyCellEditsToXlsx(source, [])
    const reread = await readBasicWorkbook(mutation.buffer)
    expect(reread.snapshot.sheets.map((sheet) => sheet.name)).toEqual(['数据', '汇总'])
    const cells = reread.snapshot.sheets[0]?.cells ?? {}
    expect(cells.A1).toEqual({ value: 1 })
    expect(await sha256(mutation.buffer)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('sheet gateway：csv 导入真实字节链', () => {
  it('sniffDelimiter / parseCsv / isNumericCell', () => {
    expect(sniffDelimiter('a,b,c\n1,2,3')).toBe(',')
    expect(sniffDelimiter('a;b;c\n1;2;3')).toBe(';')
    expect(sniffDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
    expect(parseCsv('名称,数量\n薯片,42')).toEqual([
      ['名称', '数量'],
      ['薯片', '42'],
    ])
    expect(parseCsv('"含,逗号",2')).toEqual([['含,逗号', '2']])
    expect(isNumericCell('42')).toBe(true)
    expect(isNumericCell('薯片')).toBe(false)
  })

  it('decodeCsvBuffer 处理 UTF-8 BOM', () => {
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('a,b', 'utf8')])
    expect(decodeCsvBuffer(new Uint8Array(withBom))).toBe('a,b')
    expect(decodeCsvBuffer(new Uint8Array(Buffer.from('a,b', 'utf8')))).toBe('a,b')
  })

  it('csvToXlsxBuffer 产出真实 xlsx 字节并可由 gateway 读回', async () => {
    const buffer = await csvToXlsxBuffer('名称,数量\n薯片,42\n', '库存')
    const imported = await readBasicWorkbook(buffer)
    expect(imported.snapshot.sheets.map((sheet) => sheet.name)).toEqual(['库存'])
    const cells = imported.snapshot.sheets[0]?.cells ?? {}
    expect(cells.A1).toEqual({ value: '名称' })
    expect(cells.A2).toEqual({ value: '薯片' })
    // 数字单元格按数值读回
    expect(cells.B2).toEqual({ value: 42 })
  })

  it('blankXlsxBuffer 产出单表空白工作簿', async () => {
    const imported = await readBasicWorkbook(await blankXlsxBuffer('空白表'))
    expect(imported.snapshot.sheets.map((sheet) => sheet.name)).toEqual(['空白表'])
    expect(Object.keys(imported.snapshot.sheets[0]?.cells ?? {})).toEqual([])
  })
})
