/**
 * 文档打开与保存管线：docx 字节 → parseDocx → 编辑器内容；编辑器 JSON →
 * 保存计划 → saveDocx（字节保真补丁）→ 重新 parseDocx 重锚定。
 * 全流程纯浏览器实现，不含任何宿主进程 IPC。
 */
import type { Editor } from '@tiptap/core'
import { history } from '@tiptap/pm/history'
import {
  findChartWorkbookPath,
  parseChartPartXml,
  parseDocx,
  patchChartPartXml,
  patchChartWorkbookXlsxBase64,
  readDocxPartBase64,
  readSections,
  readSectionSettings,
  saveDocx,
  type ParsedDocFull,
  type SectionInfo,
  type SectionSettings,
} from '@genoffice/docx-engine'
import { blocksToPmDoc, pmDocToSavePlan, type PmNode } from '../editor/convert'
import { docStyleCss } from '../editor/doc-style-css'
import { setDocFontTable } from '../editor/line-metrics'

/** 当前打开文档的最小运行态（Chips-Word 界面只编辑正文内容）。 */
export interface WordDocState {
  parsed: ParsedDocFull
  /** 保存目标路径；null 表示尚未落盘 */
  filePath: string | null
  fileName: string
  /** 原始打开字节的哈希占位（引擎按字节补丁保存，不依赖该值） */
  hash: string
}

/** OLE 复合文档魔数（D0 CF 11 E0 A1 B1 1A E1）：打开口令加密的 docx 不是 zip。 */
const OLE_COMPOUND_FILE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

/** ZIP 文件头签名。docx 是 OOXML ZIP 包，预检可避免空文件/任意二进制进入 JSZip。 */
const ZIP_CONTAINER_MAGIC = [
  [0x50, 0x4b, 0x03, 0x04], // local file header
  [0x50, 0x4b, 0x05, 0x06], // empty archive (随后会由引擎拒绝缺少 document.xml)
  [0x50, 0x4b, 0x07, 0x08], // spanning archive marker
]

export function looksLikeEncryptedDocx(bytes: Uint8Array): boolean {
  if (bytes.length < OLE_COMPOUND_FILE_MAGIC.length) return false
  return OLE_COMPOUND_FILE_MAGIC.every((byte, index) => bytes[index] === byte)
}

export function looksLikeZipContainer(bytes: Uint8Array): boolean {
  return ZIP_CONTAINER_MAGIC.some((magic) =>
    magic.every((byte, index) => bytes[index] === byte),
  )
}

/** 撤销栈在打开/重锚定边界必须丢弃，否则跨文档 undo 会复活过期锚点。 */
export function resetEditorHistory(editor: Editor): void {
  const plugin = editor.state.plugins.find((p) =>
    String((p as unknown as { key: string }).key).startsWith('history$'),
  )
  if (!plugin) return
  editor.unregisterPlugin('history')
  editor.registerPlugin(history((plugin.spec as { config?: object }).config))
}

/** CSS 之外的文档级排版输入：默认制表位网格 + 断字语言。 */
export function applyDocLayoutSettings(editor: Editor, parsed: ParsedDocFull): void {
  editor.storage.tabStops.defaultTabStopTwips = parsed.defaultTabStopTwips ?? null
  const lang = parsed.autoHyphenation ? parsed.docDefaults?.lang : undefined
  if (lang) editor.view.dom.setAttribute('lang', lang)
  else editor.view.dom.removeAttribute('lang')
}

/** 编辑器装载前置：字距表 + 列表编号样式 + 版式（setContent 之前调用）。 */
export function primeEditorForParsed(editor: Editor, parsed: ParsedDocFull): void {
  setDocFontTable(parsed.fontTable)
  editor.storage.listNumbering.styles = parsed.styles
  editor.storage.listNumbering.docDefaults = parsed.docDefaults
  editor.storage.listNumbering.defs = parsed.numbering
  applyDocLayoutSettings(editor, parsed)
}

export interface LoadDocxOutcome {
  parsed: ParsedDocFull
  pmDoc: PmNode
  sections: SectionInfo[]
  section: SectionSettings
  css: string
}

/**
 * 解析 docx 字节为编辑器可装载内容。加密文档和非 OOXML 输入在此先行
 * 拒绝，并抛出带 kind 标记的错误，由调用方转成界面文案。
 */
export async function parseDocxBytes(bytes: Uint8Array): Promise<LoadDocxOutcome> {
  if (looksLikeEncryptedDocx(bytes)) {
    throw new DocumentOpenError('encrypted')
  }
  if (!looksLikeZipContainer(bytes)) {
    throw new DocumentOpenError('parse', '文件不是有效的 .docx 压缩包')
  }
  let parsed: ParsedDocFull
  try {
    parsed = (await parseDocx(bytes)) as ParsedDocFull
  } catch (error) {
    throw new DocumentOpenError(
      'parse',
      error instanceof Error ? error.message : String(error),
    )
  }
  return {
    parsed,
    pmDoc: blocksToPmDoc(parsed.blocks, readSections(parsed)),
    sections: readSections(parsed),
    section: readSectionSettings(parsed),
    css: docStyleCss(parsed),
  }
}

export type DocumentOpenErrorKind = 'encrypted' | 'parse'

export class DocumentOpenError extends Error {
  readonly kind: DocumentOpenErrorKind

  constructor(kind: DocumentOpenErrorKind, reason?: string) {
    super(reason ?? kind)
    this.name = 'DocumentOpenError'
    this.kind = kind
  }
}

/**
 * 把编辑器当前 JSON 序列化为 .docx 字节 —— 保存的序列化半程；
 * 不弹对话框、不改状态。图表数据补丁在此一并写入对应的 zip part。
 */
export async function buildSaveBytes(
  doc: WordDocState,
  editor: Editor,
): Promise<Uint8Array> {
  const plan = pmDocToSavePlan(editor.getJSON() as PmNode, doc.parsed.blocks)
  // 图表数据编辑走图表自身 zip part 的补丁，而非正文 XML
  const partXml: Record<string, string> = {}
  const partBinary: Record<string, string> = {}
  for (const { partPath, patch } of plan.chartPatches) {
    const originalPart = doc.parsed.extras.chartParts[partPath]
    if (!originalPart) continue
    const patchedXml = patchChartPartXml(originalPart, patch)
    partXml[partPath] = patchedXml
    // 同步内嵌工作簿，保证 Word 的“编辑数据”展示正确
    const wbPath = await findChartWorkbookPath(doc.parsed.internal.originalBytes, partPath)
    if (!wbPath) continue
    const existingBase64 = await readDocxPartBase64(doc.parsed.internal.originalBytes, wbPath)
    if (!existingBase64) continue
    const display = parseChartPartXml(patchedXml, partPath)
    if (!display) continue
    const namedSeries = display.series.map((s, i) => ({
      name: s.name ?? `Series${i + 1}`,
      values: s.values as (number | null)[],
    }))
    const updated = await patchChartWorkbookXlsxBase64(
      existingBase64,
      display.categories,
      namedSeries,
    )
    if (updated) partBinary[wbPath] = updated
  }
  return saveDocx(doc.parsed, plan.saveBlocks, {
    partXml: Object.keys(partXml).length > 0 ? partXml : undefined,
    partBinary: Object.keys(partBinary).length > 0 ? partBinary : undefined,
  })
}

export interface ReparsedDocument {
  parsed: ParsedDocFull
  pmDoc: PmNode
  sections: SectionInfo[]
  section: SectionSettings
  css: string
  /** 内容与编辑器现状一致（可跳过重写以保留撤销栈/光标） */
  unchanged: boolean
}

/**
 * 保存后的重锚定：用保存产出的字节重新 parseDocx，使 docxIndex 锚点
 * 指向新文件。内容未变化时跳过 setContent 重写，撤销栈/光标/滚动位置
 * 全部保留（GenOffice save-actions 的既定做法）。
 */
export async function reparseForReanchor(
  bytes: Uint8Array,
  editor: Editor,
): Promise<ReparsedDocument> {
  const parsed = (await parseDocx(bytes)) as ParsedDocFull
  primeEditorForParsed(editor, parsed)
  const pmDoc = blocksToPmDoc(parsed.blocks, readSections(parsed))
  let unchanged = false
  try {
    unchanged = editor.state.doc.eq(editor.schema.nodeFromJSON(pmDoc))
  } catch {
    unchanged = false
  }
  return {
    parsed,
    pmDoc,
    sections: readSections(parsed),
    section: readSectionSettings(parsed),
    css: docStyleCss(parsed),
    unchanged,
  }
}

/** 顶层块纯文本（用于从首个标题派生文件名）。 */
export function pmNodeText(node: PmNode): string {
  if (node.text) return node.text
  return (node.content ?? []).map(pmNodeText).join('')
}

/** 清洗出合法文件名基底：去除路径非法字符、压缩空白、限长；无效返回 null。 */
export function sanitizeFileBaseName(raw: string): string | null {
  const cleaned = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .trim()
  if (!cleaned) return null
  return cleaned.length > 40 ? cleaned.slice(0, 40).trim() : cleaned
}

/** 未命名文档以首个标题派生文件名，避免“未命名.docx”。 */
export function deriveAutoFileName(editor: Editor): string | null {
  const body = (editor.getJSON() as PmNode).content ?? []
  for (const node of body) {
    if (node.type !== 'docHeading') continue
    const base = sanitizeFileBaseName(pmNodeText(node))
    if (base) return `${base}.docx`
  }
  return null
}
