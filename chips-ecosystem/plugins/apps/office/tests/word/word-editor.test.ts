/// word 编辑引擎集成测试（jsdom，真实 Milkdown 装载，不经任何 mock）：
/// 装配形制沿 richtext 判例（清单 §2.14 统一编辑引擎）；导入 → 编辑基线 → 编辑事务回流 →
/// 导出落盘字节的全链在此真实走通。
/// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getMarkdown } from '@milkdown/kit/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { documentToMarkdown, markdownToDocument } from '../../src/word/domain/markdown-mapping'
import type { WordDocument } from '../../src/word/domain/document-model'
import {
  createWordDocumentEditor,
  insertTextIntoWordDocumentEditor,
  normalizeWordMarkdown,
  replaceWordDocument,
} from '../../src/word/editor/engine'
import type { MilkdownEditor } from '../../src/word/editor/engine'
import { readWordDocument, writeWordDocument } from '../../src/word/gateway/docx-gateway'

const here = join(dirname(fileURLToPath(import.meta.url)))
const fixture = (): Buffer => readFileSync(join(here, '../fixtures/minimal.docx'))

const created: MilkdownEditor[] = []
const hosts: HTMLDivElement[] = []

afterEach(() => {
  for (const editor of created) {
    void editor.destroy()
  }
  created.length = 0
  for (const host of hosts) {
    host.remove()
  }
  hosts.length = 0
})

/** 创建已装载的 word 引擎实例（真实 Editor.make().create()；装载失败即用例失败）。 */
async function createEngine(
  defaultValue: string,
  changes?: string[],
): Promise<{ editor: MilkdownEditor; host: HTMLDivElement }> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  hosts.push(host)
  const editor = await createWordDocumentEditor({
    host,
    defaultValue,
    onMarkdownChange: (markdown) => changes?.push(markdown),
  })
  created.push(editor)
  return { editor, host }
}

describe('word 编辑引擎装载（RA-11 判例形制）', () => {
  it('在 jsdom 真实装载并在宿主上挂载 ProseMirror 编辑面', async () => {
    const { host } = await createEngine('# 标题')
    const surface = host.querySelector<HTMLElement>('.ProseMirror')
    expect(surface).not.toBeNull()
    expect(surface!.getAttribute('contenteditable')).toBe('true')
    expect(surface!.querySelector('h1')?.textContent).toBe('标题')
  })

  it('§2.14 风险①随行规避：无 alt/title 图片经解析侧归一装载不被丢弃', async () => {
    const { host } = await createEngine('前导段落\n\n![](assets/picture.png)')
    expect(host.querySelector('img')).not.toBeNull()
  })

  it('GFM 双波浪删除线与表格结构按同方言装载', async () => {
    const { host } = await createEngine('~~删除~~\n\n| 名称 | 数值 |\n| :--- | ---: |\n| 深度 | 13 |')
    expect(host.querySelector('del')).not.toBeNull()
    expect(host.querySelector('table')).not.toBeNull()
  })
})

describe('word 编辑回流（listener 序列化归一口径）', () => {
  it('编辑事务经 listener 触发序列化回流并经 normalizeWordMarkdown 收敛', async () => {
    const changes: string[] = []
    const { editor } = await createEngine('# 标题', changes)
    insertTextIntoWordDocumentEditor(editor, '增补')
    await vi.waitFor(() => {
      expect(changes.some((markdown) => markdown.includes('增补'))).toBe(true)
    })
    expect(changes[changes.length - 1]).toBe('# 增补标题')
    expect(normalizeWordMarkdown('#  a  \n\n\n\nb')).toBe('#  a\n\nb')
  })

  it('程序化全文替换触发序列化回流并同步文档结构', async () => {
    const changes: string[] = []
    const { editor, host } = await createEngine('# 旧基线', changes)
    replaceWordDocument(editor, '# 新基线')
    await vi.waitFor(() => {
      expect(changes).toContain('# 新基线')
    })
    expect(normalizeWordMarkdown(editor.action(getMarkdown()))).toBe('# 新基线')
    expect(host.querySelector('h1')?.textContent).toBe('新基线')
  })
})

describe('word 全链：docx → 域模型 → 编辑基线 → Milkdown 编辑 → 域模型 → docx', () => {
  it('真实夹具导入装载，编辑事务经回流再入域模型并导出可重读的 docx', async () => {
    const imported = await readWordDocument(fixture())
    const baseline = documentToMarkdown(imported)
    const changes: string[] = []
    const { editor, host } = await createEngine(baseline, changes)

    // 编辑面真实呈现夹具内容（标题/列表/表格）。
    expect(host.querySelector('h1')?.textContent).toBe('薯片办公文档')
    expect(host.querySelector('li')).not.toBeNull()
    expect(host.querySelector('table')).not.toBeNull()

    // 与键入同一事务路径：首标题前插入文本。
    insertTextIntoWordDocumentEditor(editor, '增补')
    await vi.waitFor(() => {
      expect(changes.some((markdown) => markdown.includes('增补'))).toBe(true)
    })

    // 编辑回流再入域模型（保存链同一入口形状）。
    const refluxMarkdown = changes[changes.length - 1]!
    const editedDocument: WordDocument = {
      ...markdownToDocument(refluxMarkdown),
      section: imported.section,
    }
    expect(editedDocument.blocks[0]).toEqual({
      kind: 'heading',
      level: 1,
      styleId: 'Heading1',
      alignment: null,
      runs: [{ text: '增补薯片办公文档', marks: [], href: null }],
    })

    // 导出落盘字节可重读：编辑保真 + 原文其余语义并存（节设置随会话保留）。
    // 写出侧对无列宽表格按标称列宽规范化（docx 必有 tblGrid，序列化归一口径）。
    const bytes = await writeWordDocument(editedDocument)
    const reread = await readWordDocument(bytes)
    expect(reread).toEqual({
      ...editedDocument,
      blocks: editedDocument.blocks.map((block) =>
        block.kind === 'table' ? { ...block, columnWidthsTwips: [4680, 4680] } : block,
      ),
    })
    expect(reread.section).toEqual(imported.section)
    expect(reread.blocks.some((block) => block.kind === 'table')).toBe(true)
    expect(reread.blocks.some((block) => block.kind === 'listItem')).toBe(true)
  })

  it('编辑基线装载往返：域模型出料 → 引擎序列化 → 域模型再入（除显式收窄口径外语义保持）', async () => {
    const imported = await readWordDocument(fixture())
    const baseline = documentToMarkdown(imported)
    const { editor } = await createEngine(baseline)
    const serialized = normalizeWordMarkdown(editor.action(getMarkdown()))
    const roundTripped = markdownToDocument(serialized)
    const expected = markdownToDocument(baseline)
    // 编辑器收窄口径（§2.14 风险随行登记）：preset-gfm 表格 schema 不承载列对齐与列宽，
    // 经 Milkdown 往返的表格收窄为无对齐/无列宽形态；域模型与网关直连面不受影响。
    const stripTableDecoration = (document: WordDocument): WordDocument => ({
      ...document,
      blocks: document.blocks.map((block) =>
        block.kind === 'table'
          ? {
              ...block,
              columnWidthsTwips: null,
              rows: block.rows.map((row) => ({
                ...row,
                cells: row.cells.map((cell) => ({ ...cell, alignment: null })),
              })),
            }
          : block,
      ),
    })
    expect(roundTripped).toEqual(stripTableDecoration(expected))
  })
})
