/**
 * 纯文档操作工具：空白文档判定、受限 HTML 片段解析为 ProseMirror JSON、
 * 顶层块范围替换。全部为纯逻辑（仅依赖编辑器 schema 与 docx-engine 类型），
 * 不包含任何对话生成语义。
 */
import type { Editor } from '@tiptap/core'
import { TABLE_HEADER_FILL, type Block, type TableCell, type TableModel } from '@genoffice/docx-engine'
import { tableModelToPmNode, type PmMark, type PmNode } from './convert'
import { equationBlockJson, inlineEquationNodeJson } from './equation'

export interface NumIds {
  bullet: string | null
  ordered: string | null
}

/**
 * <pre> / <blockquote> 段落预设：全部使用 Block 模型既有属性组合，
 * 保证 parse -> generate -> parse 字节级回环稳定。
 */
export const CODE_BLOCK_PRESET = {
  font: 'Consolas',
  shadingFill: 'F2F2F2',
  borders: 'tblr',
} as const
export const QUOTE_BLOCK_PRESET = {
  color: '666666',
  indentLeft: 720,
  borders: 'l',
} as const

export function blockRangePositions(
  editor: Editor,
  startIndex: number,
  endIndex: number,
): { from: number; to: number } {
  const doc = editor.state.doc
  let from = 0
  let to = 0
  let index = 0
  doc.forEach((node, offset) => {
    if (index === startIndex) from = offset
    if (index === endIndex) to = offset + node.nodeSize
    index++
  })
  return { from, to }
}

/** 空白 = 恰好一个空段落；textContent 判定会把纯图片/图表文档误判为空白。 */
export function isBlankDocument(editor: Editor): boolean {
  const doc = editor.state.doc
  if (doc.childCount !== 1) return false
  const first = doc.child(0)
  return first.type.name === 'docParagraph' && first.content.size === 0
}

const INLINE_MARK_TAGS: Record<string, string> = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  u: 'underline',
  s: 'strike',
  del: 'strike',
  strike: 'strike',
}

function parseInline(element: Node, marks: PmMark[]): PmNode[] {
  const nodes: PmNode[] = []
  element.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? '').replace(/\s+/g, ' ')
      if (text)
        nodes.push({ type: 'text', text, ...(marks.length > 0 ? { marks: [...marks] } : {}) })
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const el = child as Element
    const tag = el.tagName.toLowerCase()
    if (tag === 'br') {
      nodes.push({ type: 'hardBreak' })
      return
    }
    if (tag === 'a') {
      const href = el.getAttribute('href') ?? ''
      nodes.push(...parseInline(el, [...marks, { type: 'link', attrs: { href, rId: null } }]))
      return
    }
    if (tag === 'formula') {
      const latex = (el.textContent ?? '').trim()
      if (!latex) return
      try {
        nodes.push(inlineEquationNodeJson(latex))
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        throw new Error(`无法解析 <formula> 中的 LaTeX（${reason}）：${latex}`, { cause: e })
      }
      return
    }
    const markType = INLINE_MARK_TAGS[tag]
    if (markType) {
      const next = marks.some((m) => m.type === markType) ? marks : [...marks, { type: markType }]
      nodes.push(...parseInline(el, next))
      return
    }
    // 其他行内标签（span 等）：保留其文本内容
    nodes.push(...parseInline(el, marks))
  })
  return nodes
}

function blockNode(type: string, attrs: Record<string, unknown>, content: PmNode[]): PmNode {
  const node: PmNode = {
    type,
    attrs: { docxIndex: null, styleId: null, ...attrs },
  }
  if (content.length > 0) node.content = content
  return node
}

function parseList(
  el: Element,
  kind: 'bullet' | 'ordered',
  ilvl: number,
  numIds: NumIds,
  out: PmNode[],
): void {
  el.childNodes.forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const item = child as Element
    const tag = item.tagName.toLowerCase()
    if (tag === 'ul' || tag === 'ol') {
      parseList(item, tag === 'ol' ? 'ordered' : 'bullet', ilvl + 1, numIds, out)
      return
    }
    if (tag !== 'li') return
    // 先摘出嵌套列表，让嵌套项排在本项之后
    const nested: Element[] = []
    item.querySelectorAll(':scope > ul, :scope > ol').forEach((n) => {
      nested.push(n)
      n.remove()
    })
    out.push(
      blockNode(
        'docListItem',
        { kind, numId: numIds[kind], ilvl: Math.min(ilvl, 4) },
        parseInline(item, []),
      ),
    )
    for (const n of nested) {
      parseList(n, n.tagName.toLowerCase() === 'ol' ? 'ordered' : 'bullet', ilvl + 1, numIds, out)
    }
  })
}

/** 单元格内段落文本：<br> 与嵌套 <p>/<div> 拆分段落 */
function cellParas(cell: Element): string[] {
  const paras: string[] = []
  let current = ''
  const push = () => {
    paras.push(current.replace(/\s+/g, ' ').trim())
    current = ''
  }
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        current += child.textContent ?? ''
        return
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (tag === 'br') push()
      else if (tag === 'p' || tag === 'div') {
        if (current.trim()) push()
        walk(el)
        push()
      } else walk(el)
    })
  }
  walk(cell)
  if (current.trim()) push()
  const out = paras.filter((p, i) => p !== '' || (i > 0 && i < paras.length - 1))
  return out.length > 0 ? out : ['']
}

/**
 * <table> -> 受保护表格块：display TableModel + 生成的 wtbl 片段。
 * 单元格文本在保存时经 pmDocToSavePlan 的 genXml 分支（patchTableCellTexts）
 * 打回片段，模型行列数必须与生成的网格一致。
 */
function parseTable(el: Element): PmNode | null {
  const trs = Array.from(el.querySelectorAll('tr'))
  if (trs.length === 0) return null
  const rawRows = trs.map((tr) => Array.from(tr.children).filter((c) => /^t[hd]$/i.test(c.tagName)))
  const cols = Math.max(...rawRows.map((r) => r.length))
  if (cols === 0) return null
  const headerRow = rawRows[0].some((c) => c.tagName.toLowerCase() === 'th')
  const rows: TableCell[][] = rawRows.map((cells, r) => {
    const isHeader = headerRow && r === 0
    const row: TableCell[] = cells.map((cell) => ({
      paras: cellParas(cell),
      ...(isHeader ? { bold: true, fill: TABLE_HEADER_FILL } : {}),
    }))
    while (row.length < cols)
      row.push({ paras: [''], ...(isHeader ? { bold: true, fill: TABLE_HEADER_FILL } : {}) })
    return row
  })
  const table: TableModel = { rows }
  return tableModelToPmNode(table)
}

/** <pre> -> 等宽/底纹段落；换行保留为硬换行 */
function parseCodeBlock(el: Element): PmNode | null {
  const text = (el.textContent ?? '').replace(/^\n/, '').replace(/\s+$/, '')
  if (!text) return null
  // 仅 Latin 槽位：等宽字体只作用于代码文本，继承的中文（CJK）字体不受影响
  const mark: PmMark = { type: 'docTextStyle', attrs: { fontAscii: CODE_BLOCK_PRESET.font } }
  const content: PmNode[] = []
  text.split('\n').forEach((line, i) => {
    if (i > 0) content.push({ type: 'hardBreak' })
    if (line !== '') content.push({ type: 'text', text: line, marks: [mark] })
  })
  return blockNode(
    'docParagraph',
    { shadingFill: CODE_BLOCK_PRESET.shadingFill, borders: CODE_BLOCK_PRESET.borders },
    content,
  )
}

/** <blockquote> -> 带缩进的灰色段落 + 左边框 */
function parseBlockquote(el: Element): PmNode | null {
  const mark: PmMark = { type: 'docTextStyle', attrs: { color: QUOTE_BLOCK_PRESET.color } }
  const inline = parseInline(el, [mark])
  if (inline.length === 0) return null
  return blockNode(
    'docParagraph',
    { indentLeft: QUOTE_BLOCK_PRESET.indentLeft, borders: QUOTE_BLOCK_PRESET.borders },
    inline,
  )
}

/**
 * 将受限 HTML 片段解析为顶层 PmNode 数组。容忍 Markdown 代码围栏与纯文本。
 */
export function parseHtmlFragment(raw: string, numIds: NumIds): PmNode[] {
  let text = raw.trim()
  const fence = /```(?:html)?\s*([\s\S]*?)```/.exec(text)
  if (fence) text = fence[1].trim()
  if (!text) return []

  // 纯文本（无标签）：按空行分段生成段落
  if (!/<[a-z][\s\S]*>/i.test(text)) {
    return text
      .split(/\n{2,}/)
      .map((para) =>
        blockNode('docParagraph', {}, [{ type: 'text', text: para.replace(/\s+/g, ' ').trim() }]),
      )
      .filter((n) => n.content?.[0]?.text)
  }

  const parsed = new DOMParser().parseFromString(text, 'text/html')
  const out: PmNode[] = []
  const pushFormula = (el: Element) => {
    const latex = (el.textContent ?? '').trim()
    if (!latex) return
    try {
      out.push(equationBlockJson(latex))
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      throw new Error(`无法解析 <formula> 中的 LaTeX（${reason}）：${latex}`, { cause: e })
    }
  }
  parsed.body.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = (child.textContent ?? '').trim()
      if (t) out.push(blockNode('docParagraph', {}, [{ type: 'text', text: t }]))
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const el = child as Element
    const tag = el.tagName.toLowerCase()
    const headingMatch = /^h([1-6])$/.exec(tag)
    if (headingMatch) {
      out.push(blockNode('docHeading', { level: Number(headingMatch[1]) }, parseInline(el, [])))
    } else if (tag === 'ul' || tag === 'ol') {
      parseList(el, tag === 'ol' ? 'ordered' : 'bullet', 0, numIds, out)
    } else if (tag === 'table') {
      const node = parseTable(el)
      if (node) out.push(node)
    } else if (tag === 'pre') {
      const node = parseCodeBlock(el)
      if (node) out.push(node)
    } else if (tag === 'blockquote') {
      const node = parseBlockquote(el)
      if (node) out.push(node)
    } else if (tag === 'formula') {
      pushFormula(el)
    } else if (tag === 'p' || tag === 'div') {
      const inline = parseInline(el, [])
      if (inline.length > 0) out.push(blockNode('docParagraph', {}, inline))
    } else {
      // 未知块级标签：回收其中的文本
      const t = (el.textContent ?? '').trim()
      if (t) out.push(blockNode('docParagraph', {}, [{ type: 'text', text: t }]))
    }
  })
  return out
}

/** 用给定节点替换顶层块区间 [startIndex, endIndex]。 */
export function replaceBlockRange(
  editor: Editor,
  startIndex: number,
  endIndex: number,
  nodes: PmNode[],
): boolean {
  if (nodes.length === 0) return false
  const { from, to } = blockRangePositions(editor, startIndex, endIndex)
  const pmNodes = nodes.map((n) => editor.schema.nodeFromJSON(n))
  editor.view.dispatch(editor.state.tr.replaceWith(from, to, pmNodes))
  return true
}

/** 复用正文已有的同类型列表编号（新列表项加入真实 docx 编号）。 */
export function findNumId(blocks: Block[], kind: 'bullet' | 'ordered'): string | null {
  for (const block of blocks) {
    if (block.type === 'listItem' && block.list?.kind === kind) return block.list.numId
  }
  return null
}
