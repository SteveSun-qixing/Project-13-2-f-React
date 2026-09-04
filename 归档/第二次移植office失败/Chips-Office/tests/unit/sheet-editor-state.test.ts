/**
 * Sheet 编辑状态回归测试。
 *
 * 覆盖三个层面：
 * - workbook 模型纯逻辑（初始状态、单元格地址、数值判定）；
 * - useSheet 编辑状态机（单元格写入语义、多 sheet 打开与切换、脏标记与 file.session 保存链路）；
 * - SheetTabs 工作表标签组件（名单渲染、切换与重命名交互）。
 *
 * file.session.* 通过 mock host 的 setActionHandler 按 Chips-SDK 契约
 * （Chips-SDK/src/contracts/file.ts）注册为进程内会话存储，不 mock 引擎与模型逻辑。
 */
import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import JSZip from 'jszip'
import {
  createEmptySheetModel,
  createEmptyWorkbookModel,
  formatCellAddress,
  isNumericCell,
  parseCellAddress,
  DEFAULT_NEW_SHEET_COLUMN_COUNT,
  DEFAULT_NEW_SHEET_ROW_COUNT,
} from '../../src/apps/sheet/types/workbook-model'
import { xlsxModelToCsv } from '../../src/apps/sheet/types/xlsx-parser'
import { useSheet, type SelectionModel } from '../../src/apps/sheet/hooks/useSheet'
import { SheetTabs, type SheetTabsProps } from '../../src/apps/sheet/components/SheetTabs'
import { createAppMockClient } from '../../src/testing/mock-environment'
import type { MockChipsClient } from 'chips-sdk/testing'
import type { FileSessionDescriptor } from 'chips-sdk'

const SEEDED_PATH = '/workspace/documents/季度报表.xlsx'
const DEFAULT_SELECTION: SelectionModel = { startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 }

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

/** 内存中打包一个最小双表 xlsx（inlineStr 文本、数字、布尔、公式各一枚）。 */
async function buildTwoSheetXlsx(): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    XML_DECL +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '</Types>',
  )
  zip.file(
    '_rels/.rels',
    XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
  )
  zip.file(
    'xl/workbook.xml',
    XML_DECL +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="季度汇总" sheetId="1" r:id="rId1"/><sheet name="明细数据" sheetId="2" r:id="rId2"/></sheets>' +
      '</workbook>',
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
      '</Relationships>',
  )
  zip.file(
    'xl/worksheets/sheet1.xml',
    XML_DECL +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>月份</t></is></c><c r="B1"><v>42</v></c><c r="C1" t="b"><v>1</v></c><c r="D1"><f>SUM(B1,1)</f><v>43</v></c></row>' +
      '</sheetData></worksheet>',
  )
  zip.file(
    'xl/worksheets/sheet2.xml',
    XML_DECL +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>明细行</t></is></c></row>' +
      '</sheetData></worksheet>',
  )
  return zip.generateAsync({ type: 'uint8array' })
}

interface ShimSession {
  descriptor: FileSessionDescriptor
  bytes: Uint8Array
}

/**
 * 按 file 契约在 mock host 上注册 file.session.* 进程内实现，
 * 并记录写入与持久化调用供断言使用。
 */
function installFileSessionShim(client: MockChipsClient, files: Record<string, Uint8Array>) {
  const sessions = new Map<string, ShimSession>()
  const written: Array<{ sessionId: string; bytes: Uint8Array }> = []
  const persisted: string[] = []
  let seq = 0

  const createSession = (filePath: string, format: string, initial: Uint8Array): FileSessionDescriptor => {
    const sessionId = `shim-session-${++seq}`
    const now = new Date().toISOString()
    const descriptor: FileSessionDescriptor = {
      sessionId,
      documentId: `shim-document-${seq}`,
      filePath,
      fileName: filePath.split(/[\\/]/).pop() ?? filePath,
      format,
      mimeType: 'application/octet-stream',
      size: initial.length,
      revision: 0,
      status: 'clean',
      createdAt: now,
      updatedAt: now,
    }
    sessions.set(sessionId, { descriptor, bytes: initial })
    return descriptor
  }

  const requireSession = (payload: unknown): ShimSession => {
    const sessionId = String((payload as { sessionId?: string } | null)?.sessionId ?? '')
    const session = sessions.get(sessionId)
    if (!session) throw new Error(`测试会话不存在：${sessionId}`)
    return session
  }
  const withDocument = (session: ShimSession) => ({ document: { ...session.descriptor } })

  client.mockHost.setActionHandler('file.session.create', (payload) => {
    const record = (payload ?? {}) as { format?: string; fileName?: string; initialBytes?: Uint8Array }
    const fileName = record.fileName ?? `未命名.${record.format ?? 'bin'}`
    const descriptor = createSession(
      `/workspace/documents/${fileName}`,
      record.format ?? 'binary',
      record.initialBytes ?? new Uint8Array(),
    )
    return { document: { ...descriptor } }
  })
  client.mockHost.setActionHandler('file.session.open', (payload) => {
    const filePath = String((payload as { filePath?: string } | null)?.filePath ?? '')
    const known = [...sessions.values()].find((s) => s.descriptor.filePath === filePath)
    if (known) return withDocument(known)
    const descriptor = createSession(filePath, 'binary', new Uint8Array())
    return { document: { ...descriptor } }
  })
  client.mockHost.setActionHandler('file.session.read', (payload) => {
    const session = requireSession(payload)
    return { document: { ...session.descriptor }, bytes: Uint8Array.from(session.bytes) }
  })
  client.mockHost.setActionHandler('file.session.write', (payload) => {
    const session = requireSession(payload)
    const bytes = (payload as { bytes: Uint8Array }).bytes
    session.bytes = Uint8Array.from(bytes)
    session.descriptor = {
      ...session.descriptor,
      size: session.bytes.length,
      revision: session.descriptor.revision + 1,
      status: 'dirty',
    }
    written.push({ sessionId: session.descriptor.sessionId, bytes: Uint8Array.from(bytes) })
    return { document: { ...session.descriptor } }
  })
  client.mockHost.setActionHandler('file.session.persist', (payload) => {
    const session = requireSession(payload)
    session.descriptor = { ...session.descriptor, status: 'clean' }
    persisted.push(session.descriptor.sessionId)
    return { document: { ...session.descriptor } }
  })
  client.mockHost.setActionHandler('file.session.close', (payload) => {
    const sessionId = String((payload as { sessionId?: string } | null)?.sessionId ?? '')
    sessions.delete(sessionId)
    return { ack: true }
  })

  for (const [path, bytes] of Object.entries(files)) createSession(path, 'xlsx', bytes)
  return { sessions, written, persisted }
}

function openDialogAt(client: MockChipsClient, filePath: string): void {
  client.mockHost.setActionHandler('platform.dialogOpenFile', () => ({ filePaths: [filePath] }))
}

async function openSeededWorkbook() {
  const client = createAppMockClient()
  const xlsx = await buildTwoSheetXlsx()
  const shim = installFileSessionShim(client, { [SEEDED_PATH]: xlsx })
  openDialogAt(client, SEEDED_PATH)
  const { result } = renderHook(() => useSheet())
  await act(async () => {
    await result.current[1].openFile(client)
  })
  return { client, shim, result }
}

describe('workbook 模型纯逻辑', () => {
  it('createEmptyWorkbookModel 返回单张空白工作表的初始工作簿', () => {
    const workbook = createEmptyWorkbookModel()
    expect(workbook.fileName).toBe('工作簿1.xlsx')
    expect(workbook.activeSheetIndex).toBe(0)
    expect(workbook.sheets).toHaveLength(1)
    const sheet = workbook.sheets[0]!
    expect(sheet.name).toBe('工作表1')
    expect(sheet.hidden).toBe(false)
    expect(sheet.rowCount).toBe(DEFAULT_NEW_SHEET_ROW_COUNT)
    expect(sheet.columnCount).toBe(DEFAULT_NEW_SHEET_COLUMN_COUNT)
    expect(sheet.cells).toEqual({})
    expect(sheet.merges).toEqual([])
    expect(sheet.colWidths).toEqual({})
    expect(sheet.rowHeights).toEqual({})
  })

  it('createEmptySheetModel 支持自定义行列数', () => {
    const sheet = createEmptySheetModel('自定义表', 20, 5)
    expect(sheet.name).toBe('自定义表')
    expect(sheet.rowCount).toBe(20)
    expect(sheet.columnCount).toBe(5)
    expect(sheet.cells).toEqual({})
  })

  it('parseCellAddress 与 formatCellAddress 互逆且兼容小写与非法输入', () => {
    expect(parseCellAddress('A1')).toEqual({ column: 0, row: 0 })
    expect(parseCellAddress('B3')).toEqual({ column: 1, row: 2 })
    expect(parseCellAddress('AA12')).toEqual({ column: 26, row: 11 })
    expect(parseCellAddress('a1')).toEqual({ column: 0, row: 0 })
    expect(parseCellAddress('1A')).toEqual({ column: 0, row: 0 })

    expect(formatCellAddress(0, 0)).toBe('A1')
    expect(formatCellAddress(1, 2)).toBe('B3')
    expect(formatCellAddress(26, 11)).toBe('AA12')
    for (const [column, row] of [[0, 0], [1, 2], [26, 11], [27, 0]] as const) {
      expect(parseCellAddress(formatCellAddress(column, row))).toEqual({ column, row })
    }
  })

  it('isNumericCell 只把可解析为有限数字的文本判为数值', () => {
    expect(isNumericCell('123')).toBe(true)
    expect(isNumericCell('3.14')).toBe(true)
    expect(isNumericCell('-7')).toBe(true)
    expect(isNumericCell(' 42 ')).toBe(true)
    expect(isNumericCell('')).toBe(false)
    expect(isNumericCell('   ')).toBe(false)
    expect(isNumericCell('12a')).toBe(false)
    expect(isNumericCell('abc')).toBe(false)
  })
})

describe('useSheet 编辑状态机', () => {
  it('初始状态为 start 阶段的空工作簿', () => {
    const { result } = renderHook(() => useSheet())
    const runtime = result.current[0]
    expect(runtime.phase).toBe('start')
    expect(runtime.workbook).toBeNull()
    expect(runtime.activeSheet).toBeNull()
    expect(runtime.activeSheetIndex).toBe(0)
    expect(runtime.isDirty).toBe(false)
    expect(runtime.errorState).toBeNull()
    expect(runtime.sessionId).toBeNull()
    expect(runtime.selection).toEqual(DEFAULT_SELECTION)
  })

  it('newWorkbook 建立新建工作簿初始状态并标记未保存', () => {
    const client = createAppMockClient()
    const { result } = renderHook(() => useSheet())
    act(() => {
      result.current[1].newWorkbook(client)
    })
    const runtime = result.current[0]
    expect(runtime.phase).toBe('ready')
    expect(runtime.isDirty).toBe(true)
    expect(runtime.sessionId).toBeNull()
    expect(runtime.workbook?.fileName).toBe('工作簿1.xlsx')
    expect(runtime.workbook?.sheets).toHaveLength(1)
    expect(runtime.workbook?.sheets[0]?.name).toBe('工作表1')
    expect(runtime.workbook?.sheets[0]?.rowCount).toBe(DEFAULT_NEW_SHEET_ROW_COUNT)
    expect(runtime.workbook?.sheets[0]?.columnCount).toBe(DEFAULT_NEW_SHEET_COLUMN_COUNT)
    expect(runtime.activeSheetIndex).toBe(0)
  })

  it('单元格写入字符串/数字/布尔保留类型并合并已有样式', () => {
    const client = createAppMockClient()
    const { result } = renderHook(() => useSheet())
    act(() => {
      result.current[1].newWorkbook(client)
    })
    act(() => {
      result.current[1].setCellStyle(0, 0, { bold: true })
    })
    act(() => {
      result.current[1].setCellValue(0, 0, '预算')
    })
    act(() => {
      result.current[1].setCellValue(1, 1, 42)
    })
    act(() => {
      result.current[1].setCellValue(2, 2, true)
    })
    act(() => {
      result.current[1].setCellFormula(3, 0, 'SUM(B2:C2)')
    })

    const cells = result.current[0].workbook!.sheets[0]!.cells
    expect(cells[0]?.[0]?.value).toBe('预算')
    expect(cells[0]?.[0]?.style?.bold).toBe(true)
    expect(cells[1]?.[1]?.value).toBe(42)
    expect(cells[2]?.[2]?.value).toBe(true)
    expect(cells[3]?.[0]?.formula).toBe('SUM(B2:C2)')
    expect(result.current[0].isDirty).toBe(true)
  })

  it('写入 null 清空单元格内容但保留样式，CSV 导出为空字段', () => {
    const client = createAppMockClient()
    const { result } = renderHook(() => useSheet())
    act(() => {
      result.current[1].newWorkbook(client)
    })
    act(() => {
      result.current[1].setCellStyle(0, 0, { bold: true, fillColor: '#FFF500' })
    })
    act(() => {
      result.current[1].setCellValue(0, 0, '待清空')
    })
    act(() => {
      result.current[1].setCellValue(1, 1, 42)
    })
    act(() => {
      result.current[1].setCellValue(2, 2, true)
    })
    act(() => {
      result.current[1].setCellValue(0, 0, null)
    })

    const sheet = result.current[0].workbook!.sheets[0]!
    expect(sheet.cells[0]?.[0]?.value).toBeNull()
    expect(sheet.cells[0]?.[0]?.style?.bold).toBe(true)
    expect(sheet.cells[0]?.[0]?.style?.fillColor).toBe('#FFF500')

    const rows = xlsxModelToCsv(result.current[0].workbook!).split('\n')
    expect(rows[0]).toBe(',,')
    expect(rows[1]).toBe(',42,')
    expect(rows[2]).toBe(',,TRUE')
  })

  it('行列入名插入与删除按语义搬移单元格', () => {
    const client = createAppMockClient()
    const { result } = renderHook(() => useSheet())
    act(() => {
      result.current[1].newWorkbook(client)
    })
    act(() => {
      result.current[1].setCellValue(1, 1, '交叉点')
    })
    act(() => {
      result.current[1].insertRow(1)
    })
    let cells = result.current[0].workbook!.sheets[0]!.cells
    expect(cells[2]?.[1]?.value).toBe('交叉点')
    expect(cells[1]?.[1]).toBeUndefined()
    act(() => {
      result.current[1].deleteRow(1)
    })
    cells = result.current[0].workbook!.sheets[0]!.cells
    expect(cells[1]?.[1]?.value).toBe('交叉点')
    act(() => {
      result.current[1].insertColumn(1)
    })
    cells = result.current[0].workbook!.sheets[0]!.cells
    expect(cells[1]?.[2]?.value).toBe('交叉点')
    expect(cells[1]?.[1]).toBeUndefined()
    act(() => {
      result.current[1].deleteColumn(1)
    })
    cells = result.current[0].workbook!.sheets[0]!.cells
    expect(cells[1]?.[1]?.value).toBe('交叉点')
  })

  it('mergeCells/unmergeCells 维护合并名单且单格选区不合并', () => {
    const client = createAppMockClient()
    const { result } = renderHook(() => useSheet())
    act(() => {
      result.current[1].newWorkbook(client)
    })
    const single: SelectionModel = { startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 }
    act(() => {
      result.current[1].mergeCells(single)
    })
    expect(result.current[0].workbook!.sheets[0]!.merges).toEqual([])
    act(() => {
      result.current[1].mergeCells({ startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 })
    })
    expect(result.current[0].workbook!.sheets[0]!.merges).toEqual(['A1:B2'])
    act(() => {
      result.current[1].unmergeCells({ startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 })
    })
    expect(result.current[0].workbook!.sheets[0]!.merges).toEqual([])
  })

  it('未挂接会话时 saveWorkbook 清除脏标记', () => {
    const client = createAppMockClient()
    const { result } = renderHook(() => useSheet())
    act(() => {
      result.current[1].newWorkbook(client)
    })
    expect(result.current[0].isDirty).toBe(true)
    act(() => {
      result.current[1].saveWorkbook(client)
    })
    expect(result.current[0].isDirty).toBe(false)
  })

  it('openFile 经 file.session 链路解析双表工作簿并复位脏标记', async () => {
    const { result } = await openSeededWorkbook()
    const runtime = result.current[0]
    expect(runtime.phase).toBe('ready')
    expect(runtime.errorState).toBeNull()
    expect(runtime.isDirty).toBe(false)
    expect(runtime.sessionId).toBeTruthy()
    expect(runtime.workbook?.fileName).toBe('季度报表.xlsx')
    expect(runtime.workbook?.sheets.map((s) => s.name)).toEqual(['季度汇总', '明细数据'])
    expect(runtime.activeSheetIndex).toBe(0)
    const summaryCells = runtime.workbook?.sheets[0]?.cells
    expect(summaryCells?.[0]?.[0]?.value).toBe('月份')
    expect(summaryCells?.[0]?.[1]?.value).toBe(42)
    expect(summaryCells?.[0]?.[2]?.value).toBe(true)
    expect(summaryCells?.[0]?.[3]?.formula).toBe('SUM(B1,1)')
    expect(summaryCells?.[0]?.[3]?.result).toBe(43)
  })

  it('openFile 拒绝不支持的文件格式并进入错误阶段', async () => {
    const client = createAppMockClient()
    installFileSessionShim(client, {})
    openDialogAt(client, '/workspace/documents/说明.txt')
    const { result } = renderHook(() => useSheet())
    await act(async () => {
      await result.current[1].openFile(client)
    })
    expect(result.current[0].phase).toBe('error')
    expect(result.current[0].errorState?.title).toBe('表格打开失败')
  })

  it('setActiveSheet 切换激活工作表并复位选区', async () => {
    const { result } = await openSeededWorkbook()
    act(() => {
      result.current[1].setSelection({ startRow: 3, startColumn: 2, endRow: 5, endColumn: 4 })
    })
    act(() => {
      result.current[1].setActiveSheet(1)
    })
    expect(result.current[0].activeSheetIndex).toBe(1)
    expect(result.current[0].activeSheet?.name).toBe('明细数据')
    expect(result.current[0].selection).toEqual(DEFAULT_SELECTION)
    // 切换不影响其他工作表的既有数据
    expect(result.current[0].workbook?.sheets[0]?.cells[0]?.[0]?.value).toBe('月份')
    expect(result.current[0].workbook?.sheets[1]?.cells[0]?.[0]?.value).toBe('明细行')
  })

  it('写入操作应落在当前激活的工作表上', async () => {
    const { result } = await openSeededWorkbook()
    act(() => {
      result.current[1].setActiveSheet(1)
    })
    act(() => {
      result.current[1].setCellValue(2, 2, '明细写入')
    })
    const workbook = result.current[0].workbook!
    expect(workbook.sheets[1]?.cells[2]?.[2]?.value).toBe('明细写入')
    expect(workbook.sheets[0]?.cells[2]?.[2]).toBeUndefined()
  })

  it('saveWorkbook 走 file.session 写回并持久化，随后清除脏标记', async () => {
    const { client, shim, result } = await openSeededWorkbook()
    const sessionId = result.current[0].sessionId!
    act(() => {
      result.current[1].setCellValue(0, 0, '编辑后')
    })
    expect(result.current[0].isDirty).toBe(true)
    await act(async () => {
      await result.current[1].saveWorkbook(client)
    })
    expect(result.current[0].isDirty).toBe(false)
    const write = shim.written.find((w) => w.sessionId === sessionId)
    expect(write).toBeDefined()
    expect(write!.bytes.length).toBeGreaterThan(0)
    expect(shim.persisted).toContain(sessionId)
    expect(shim.sessions.get(sessionId)?.descriptor.status).toBe('clean')
  })
})

function renderTabs(props: Partial<SheetTabsProps>) {
  const base: SheetTabsProps = {
    sheets: ['季度汇总', '明细数据'],
    activeIndex: 0,
    onTabChange: vi.fn(),
    onTabAdd: vi.fn(),
    onTabRename: vi.fn(),
    onTabDelete: vi.fn(),
    ...props,
  }
  render(React.createElement(SheetTabs, base))
  return base
}

describe('SheetTabs 工作表标签组件', () => {
  it('按名单渲染标签并高亮激活项，点击切换与新增触发回调', () => {
    const props = renderTabs({})
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false')
    expect(screen.getByText('季度汇总')).toBeTruthy()
    expect(screen.getByText('明细数据')).toBeTruthy()

    fireEvent.click(tabs[1]!)
    expect(props.onTabChange).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getByRole('button'))
    expect(props.onTabAdd).toHaveBeenCalledTimes(1)
  })

  it('双击进入重命名，回车提交去除空白后的新名字', () => {
    const props = renderTabs({ sheets: ['旧名'] })
    fireEvent.doubleClick(screen.getAllByRole('tab')[0]!)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '  新名字  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onTabRename).toHaveBeenCalledWith(0, '新名字')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('重命名输入为空白时回车不提交', () => {
    const props = renderTabs({ sheets: ['旧名'] })
    fireEvent.doubleClick(screen.getAllByRole('tab')[0]!)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onTabRename).not.toHaveBeenCalled()
  })
})
