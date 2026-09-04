/**
 * Sheet xlsx 解析器（parseXlsxBytes / xlsxModelToCsv）单元测试。
 *
 * 用 JSZip 在测试内动态打包最小合法 xlsx（含 [Content_Types].xml、
 * _rels/.rels、workbook、workbook.rels、worksheets、sharedStrings、styles），
 * 覆盖共享字符串、内联数字/布尔、内联字符串、公式单元格、多列多行、
 * 空白单元格、隐藏工作表、活动工作表与非法输入的错误处理路径。
 */
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  parseXlsxBytes,
  xlsxModelToCsv,
} from '../../src/apps/sheet/types/xlsx-parser'

async function buildXlsx(parts: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(parts)) {
    zip.file(path, content)
  }
  return zip.generateAsync({ type: 'uint8array' })
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="数据" sheetId="1" r:id="rId1"/>
    <sheet name="隐藏表" sheetId="2" state="hidden" r:id="rId2"/>
  </sheets>
</workbook>`

const WORKBOOK_WITH_BOOK_VIEWS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews>
    <workbookView activeTab="1"/>
  </bookViews>
  <sheets>
    <sheet name="数据" sheetId="1" r:id="rId1"/>
    <sheet name="隐藏表" sheetId="2" state="hidden" r:id="rId2"/>
  </sheets>
</workbook>`

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`

const SHARED_STRINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
  <si><t>名称</t></si>
  <si><t>数量</t></si>
  <si><t>苹果</t></si>
  <si><r><t>富文</t></r><r><t>本</t></r></si>
</sst>`

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
</styleSheet>`

const SHEET1_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:E3"/>
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1"><v>3.14</v></c>
      <c r="D1" t="b"><v>1</v></c>
      <c r="E1" t="s"><v>3</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>2</v></c>
      <c r="B2"/>
      <c r="C2"><v>42</v></c>
      <c r="D2" t="b"><v>0</v></c>
    </row>
    <row r="3">
      <c r="A3"><v>0</v></c>
      <c r="B3" t="inlineStr"><is><t>内联文本</t></is></c>
      <c r="C3"><f>=B1+C1</f><v>10</v></c>
    </row>
  </sheetData>
  <mergeCells count="1">
    <mergeCell ref="A1:B1"/>
  </mergeCells>
</worksheet>`

const SHEET2_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData/>
</worksheet>`

function baseParts(): Record<string, string> {
  return {
    '[Content_Types].xml': CONTENT_TYPES_XML,
    '_rels/.rels': ROOT_RELS_XML,
    'xl/workbook.xml': WORKBOOK_XML,
    'xl/_rels/workbook.xml.rels': WORKBOOK_RELS_XML,
    'xl/sharedStrings.xml': SHARED_STRINGS_XML,
    'xl/styles.xml': STYLES_XML,
    'xl/worksheets/sheet1.xml': SHEET1_XML,
    'xl/worksheets/sheet2.xml': SHEET2_XML,
  }
}

describe('sheet xlsx 解析器 parseXlsxBytes 工作簿结构', () => {
  it('解析工作表名称列表、隐藏状态与活动工作表下标', async () => {
    const workbook = await parseXlsxBytes(await buildXlsx(baseParts()))

    expect(workbook.fileName).toBe('工作簿.xlsx')
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(['数据', '隐藏表'])
    expect(workbook.sheets[0]?.hidden).toBe(false)
    expect(workbook.sheets[1]?.hidden).toBe(true)
    expect(workbook.activeSheetIndex).toBe(0)
  })

  it('bookViews 的 activeTab 决定活动工作表下标', async () => {
    const parts = baseParts()
    parts['xl/workbook.xml'] = WORKBOOK_WITH_BOOK_VIEWS_XML

    const workbook = await parseXlsxBytes(await buildXlsx(parts))
    expect(workbook.activeSheetIndex).toBe(1)
  })

  it('工作表关系同时支持绝对与相对 Target 解析', async () => {
    const workbook = await parseXlsxBytes(await buildXlsx(baseParts()))

    expect(workbook.sheets).toHaveLength(2)
    expect(Object.keys(workbook.sheets[0]?.cells ?? {})).toHaveLength(3)
    expect(Object.keys(workbook.sheets[1]?.cells ?? {})).toHaveLength(0)
  })
})

describe('sheet xlsx 解析器 parseXlsxBytes 单元格取值', () => {
  it('字符串取自共享字符串表：普通 si 与富文本 run 拼接', async () => {
    const workbook = await parseXlsxBytes(await buildXlsx(baseParts()))
    const cells = workbook.sheets[0]?.cells ?? {}

    expect(cells[0]?.[0]?.value).toBe('名称')
    expect(cells[0]?.[1]?.value).toBe('数量')
    expect(cells[1]?.[0]?.value).toBe('苹果')
    expect(cells[0]?.[4]?.value).toBe('富文本')
  })

  it('内联数字与数字 0 正确转换为 number', async () => {
    const workbook = await parseXlsxBytes(await buildXlsx(baseParts()))
    const cells = workbook.sheets[0]?.cells ?? {}

    expect(cells[0]?.[2]?.value).toBe(3.14)
    expect(cells[1]?.[2]?.value).toBe(42)
    expect(cells[2]?.[0]?.value).toBe(0)
    expect(typeof cells[2]?.[0]?.value).toBe('number')
  })

  it('布尔单元格 t="b" 按真值转换', async () => {
    const workbook = await parseXlsxBytes(await buildXlsx(baseParts()))
    const cells = workbook.sheets[0]?.cells ?? {}

    expect(cells[0]?.[3]?.value).toBe(true)
    expect(cells[1]?.[3]?.value).toBe(false)
  })

  it('内联字符串 inlineStr 与公式单元格取值', async () => {
    const workbook = await parseXlsxBytes(await buildXlsx(baseParts()))
    const cells = workbook.sheets[0]?.cells ?? {}

    expect(cells[2]?.[1]?.value).toBe('内联文本')
    expect(cells[2]?.[2]?.formula).toBe('B1+C1')
    expect(cells[2]?.[2]?.result).toBe(10)
  })

  it('空白单元格不产生单元格模型', async () => {
    const workbook = await parseXlsxBytes(await buildXlsx(baseParts()))
    const cells = workbook.sheets[0]?.cells ?? {}

    expect(cells[1]?.[1]).toBeUndefined()
    expect(cells[2]?.[3]).toBeUndefined()
  })

  it('行列范围由实际单元格与 dimension 共同决定', async () => {
    const workbook = await parseXlsxBytes(await buildXlsx(baseParts()))
    const sheet = workbook.sheets[0]
    if (!sheet) throw new Error('缺少首个工作表')

    expect(Object.keys(sheet.cells).map(Number).sort((a, b) => a - b)).toEqual([0, 1, 2])
    expect(Object.keys(sheet.cells[0] ?? {}).map(Number).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
    expect(sheet.rowCount).toBe(99)
    expect(sheet.columnCount).toBe(25)
  })

  it('合并单元格 mergeCell 解析为 ref 列表', async () => {
    const workbook = await parseXlsxBytes(await buildXlsx(baseParts()))

    expect(workbook.sheets[0]?.merges).toEqual(['A1:B1'])
    expect(workbook.sheets[1]?.merges).toEqual([])
  })

  it('隐藏空工作表回退到默认行列规模', async () => {
    const workbook = await parseXlsxBytes(await buildXlsx(baseParts()))
    const sheet = workbook.sheets[1]

    expect(sheet?.rowCount).toBe(99)
    expect(sheet?.columnCount).toBe(25)
    expect(sheet?.merges).toEqual([])
  })
})

describe('sheet xlsx 解析器 xlsxModelToCsv 导出', () => {
  it('按行列范围导出活动工作表，公式取计算结果', async () => {
    const workbook = await parseXlsxBytes(await buildXlsx(baseParts()))
    const csv = xlsxModelToCsv(workbook)

    expect(csv).toBe(
      [
        '名称,数量,3.14,TRUE,富文本',
        '苹果,,42,FALSE,',
        '0,内联文本,10,,',
      ].join('\n'),
    )
  })
})

describe('sheet xlsx 解析器 parseXlsxBytes 错误处理', () => {
  it('缺少 xl/workbook.xml 时抛出明确错误', async () => {
    const bytes = await buildXlsx({
      '[Content_Types].xml': CONTENT_TYPES_XML,
      '_rels/.rels': ROOT_RELS_XML,
    })

    await expect(parseXlsxBytes(bytes)).rejects.toThrow('Invalid xlsx: missing xl/workbook.xml')
  })

  it('非 zip 字节流被拒绝', async () => {
    const bytes = new TextEncoder().encode('这不是一个 zip 文件')

    await expect(parseXlsxBytes(bytes)).rejects.toThrow()
  })

  it('工作簿关系缺失时回退到默认空工作表', async () => {
    const parts = baseParts()
    delete parts['xl/_rels/workbook.xml.rels']

    const workbook = await parseXlsxBytes(await buildXlsx(parts))

    expect(workbook.sheets).toHaveLength(1)
    expect(workbook.sheets[0]?.name).toBe('工作表1')
    expect(workbook.sheets[0]?.hidden).toBe(false)
    expect(workbook.sheets[0]?.rowCount).toBe(100)
    expect(workbook.sheets[0]?.columnCount).toBe(26)
    expect(workbook.sheets[0]?.cells).toEqual({})
    expect(workbook.activeSheetIndex).toBe(0)
  })
})
