/// word 域字节级集成测试：全部走真实 .docx 字节（tests/fixtures/minimal.docx 与
/// 网关序列化产物），不 mock 任何解析器（jszip + word 域网关）；保存链经 file 域
/// 能力调用形（fake invoker 记录调用形状，真实能力消费见 ui 挂载面）。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import type { WordDocument } from '../../src/word/domain/document-model'
import { documentToMarkdown, markdownToDocument } from '../../src/word/domain/markdown-mapping'
import { readWordDocument, writeWordDocument } from '../../src/word/gateway/docx-gateway'
import {
  decodeBase64Bytes,
  importWordDocumentFromPath,
  persistWordDocument,
} from '../../src/word/session/save-chain'

const here = join(dirname(fileURLToPath(import.meta.url)))
const fixture = (): Buffer => readFileSync(join(here, '../fixtures/minimal.docx'))

describe('docx 网关：真实字节解析', () => {
  it('readWordDocument 读出标题层级/样式直通/混排标记/超链接/空段', async () => {
    const doc = await readWordDocument(fixture())
    // 文档标题 + 两级标题（pStyle 判读）
    expect(doc.blocks[0]).toEqual({
      kind: 'paragraph',
      styleId: 'Title',
      alignment: null,
      runs: [{ text: '薯片办公文档', marks: [], href: null }],
    })
    expect(doc.blocks[1]).toEqual({
      kind: 'heading',
      level: 1,
      styleId: 'Heading1',
      alignment: null,
      runs: [{ text: '概览', marks: [], href: null }],
    })
    expect(doc.blocks[2]).toMatchObject({ kind: 'heading', level: 2, styleId: 'Heading2' })
    const heading2 = doc.blocks[2]
    expect(heading2?.kind === 'heading' ? heading2.runs : null).toEqual([
      { text: '能力', marks: ['bold'], href: null },
    ])
    // 混排段：粗/斜/删除/粗斜/行内代码/超链接（rId → rels 解析）/转义文本
    const mixed = doc.blocks[3]
    expect(mixed?.kind).toBe('paragraph')
    if (mixed?.kind === 'paragraph') {
      expect(mixed.runs).toEqual([
        { text: '普通', marks: [], href: null },
        { text: '加粗', marks: ['bold'], href: null },
        { text: '斜体', marks: ['italic'], href: null },
        { text: '删除', marks: ['strike'], href: null },
        { text: '粗斜', marks: ['bold', 'italic'], href: null },
        { text: 'code_snippet()', marks: ['code'], href: null },
        { text: '官网', marks: ['underline'], href: 'https://www.chips.example/' },
        { text: '字面 * 星号与 \\# 井号。', marks: [], href: null },
      ])
    }
    // 空段保位
    expect(doc.blocks[4]).toEqual({ kind: 'paragraph', styleId: null, alignment: null, runs: [] })
  })

  it('readWordDocument 读出引用/代码样式段、两级列表与编号种别', async () => {
    const doc = await readWordDocument(fixture())
    expect(doc.blocks[5]).toEqual({
      kind: 'paragraph',
      styleId: 'Quote',
      alignment: null,
      runs: [{ text: '引用第一行', marks: [], href: null }],
    })
    expect(doc.blocks[6]).toMatchObject({ kind: 'paragraph', styleId: 'Quote' })
    expect(doc.blocks[7]).toEqual({
      kind: 'paragraph',
      styleId: 'HTMLPreformatted',
      alignment: null,
      runs: [{ text: 'const answer = 42;', marks: [], href: null }],
    })
    expect(doc.blocks[8]).toMatchObject({ kind: 'paragraph', styleId: 'HTMLPreformatted' })
    const listBlocks = doc.blocks.slice(9, 14)
    expect(listBlocks).toEqual([
      {
        kind: 'listItem',
        styleId: 'ListParagraph',
        alignment: null,
        list: { kind: 'bullet', numId: 1, level: 0 },
        runs: [{ text: '要点甲', marks: [], href: null }],
      },
      {
        kind: 'listItem',
        styleId: 'ListParagraph',
        alignment: null,
        list: { kind: 'bullet', numId: 1, level: 1 },
        runs: [{ text: '子要点', marks: [], href: null }],
      },
      {
        kind: 'listItem',
        styleId: 'ListParagraph',
        alignment: null,
        list: { kind: 'bullet', numId: 1, level: 0 },
        runs: [{ text: '要点乙', marks: [], href: null }],
      },
      {
        kind: 'listItem',
        styleId: 'ListParagraph',
        alignment: null,
        list: { kind: 'ordered', numId: 2, level: 0 },
        runs: [{ text: '第一步', marks: [], href: null }],
      },
      {
        kind: 'listItem',
        styleId: 'ListParagraph',
        alignment: null,
        list: { kind: 'ordered', numId: 2, level: 0 },
        runs: [{ text: '第二步', marks: [], href: null }],
      },
    ])
  })

  it('readWordDocument 读出表格（表头行/列对齐/列宽）与节设置', async () => {
    const doc = await readWordDocument(fixture())
    const table = doc.blocks[14]
    expect(table?.kind).toBe('table')
    if (table?.kind === 'table') {
      expect(table.columnWidthsTwips).toEqual([4680, 4680])
      expect(table.rows).toHaveLength(2)
      expect(table.rows[0]).toEqual({
        header: true,
        cells: [
          { alignment: 'left', runs: [{ text: '名称', marks: [], href: null }] },
          { alignment: 'right', runs: [{ text: '数值', marks: [], href: null }] },
        ],
      })
      expect(table.rows[1]).toEqual({
        header: false,
        cells: [
          { alignment: null, runs: [{ text: '深度', marks: [], href: null }] },
          { alignment: null, runs: [{ text: '13', marks: [], href: null }] },
        ],
      })
    }
    expect(doc.blocks).toHaveLength(15)
    expect(doc.section).toEqual({
      pageWidthTwips: 11906,
      pageHeightTwips: 16838,
      marginTopTwips: 1440,
      marginRightTwips: 1800,
      marginBottomTwips: 1440,
      marginLeftTwips: 1800,
    })
  })

  it('网关往返恰等：读 → 写 → 读逐字段深恰等，且写出的包再读自反', async () => {
    const doc = await readWordDocument(fixture())
    const bytes = await writeWordDocument(doc)
    const reread = await readWordDocument(bytes)
    expect(reread).toEqual(doc)
    // 写出字节再走一遍读→写：字节级自反（确定性序列化）。
    const bytesAgain = await writeWordDocument(reread)
    expect(bytesAgain.equals(bytes)).toBe(true)
  })

  it('写出包的部件面完整（内容类型/关系/编号/样式部件齐备且编号定义与文档一致）', async () => {
    const doc = await readWordDocument(fixture())
    const zip = await JSZip.loadAsync(await writeWordDocument(doc))
    const partNames = Object.keys(zip.files)
      .filter((name) => !zip.files[name]!.dir)
      .sort()
    expect(partNames).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'word/_rels/document.xml.rels',
      'word/document.xml',
      'word/numbering.xml',
      'word/styles.xml',
    ])
    const documentXml = await zip.file('word/document.xml')!.async('text')
    expect(documentXml).toContain('<w:pStyle w:val="Title"/>')
    expect(documentXml).toContain('<w:hyperlink r:id="rId1">')
    const numberingXml = await zip.file('word/numbering.xml')!.async('text')
    expect(numberingXml).toContain('<w:numFmt w:val="bullet"/>')
    expect(numberingXml).toContain('<w:numFmt w:val="decimal"/>')
    expect(numberingXml).toContain('<w:num w:numId="1">')
    expect(numberingXml).toContain('<w:num w:numId="2">')
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('text')
    expect(relsXml).toContain('TargetMode="External"')
    expect(relsXml).toContain('Target="https://www.chips.example/"')
  })

  it('markdown 编辑表示桥：夹具经映射往返后除显式收窄口径外逐字段恰等', async () => {
    const doc = await readWordDocument(fixture())
    const markdown = documentToMarkdown(doc)
    const reparsed = markdownToDocument(markdown)
    // 显式收窄口径（映射侧文档化）：Title → 一级标题；空段无 Markdown 表示位；表格列宽收窄。
    expect(reparsed.blocks[0]).toEqual({
      kind: 'heading',
      level: 1,
      styleId: 'Heading1',
      alignment: null,
      runs: [{ text: '薯片办公文档', marks: [], href: null }],
    })
    const expectedWithoutTitleAndEmpty = [
      ...doc.blocks.slice(1, 4),
      ...doc.blocks.slice(5),
    ].map((block) => (block.kind === 'table' ? { ...block, columnWidthsTwips: null } : block))
    expect(reparsed.blocks.slice(1)).toEqual(expectedWithoutTitleAndEmpty)
    expect(reparsed.section).toBeNull()
    expect(markdown).toContain('# 薯片办公文档')
    expect(markdown).toContain('## **能力**')
    expect(markdown).toContain('> 引用第一行')
    expect(markdown).toContain('const answer = 42;\nreturn answer;')
    expect(markdown).toContain('- 要点甲\n  - 子要点\n- 要点乙')
    expect(markdown).toContain('1. 第一步\n2. 第二步')
    expect(markdown).toContain('| 名称 | 数值 |\n| :--- | ---: |\n| 深度 | 13 |')
  })
})

describe('word 保存链：file 域能力调用形', () => {
  it('importWordDocumentFromPath 经 file:read 真调导入：文档/编辑基线/路径齐备', async () => {
    const calls: Array<{ capability: string; payload: unknown }> = []
    const invoker = (capability: string, payload: unknown): Promise<unknown> => {
      calls.push({ capability, payload })
      if (capability === 'file:read') {
        return Promise.resolve({ content: fixture().toString('base64'), encoding: 'base64' })
      }
      return Promise.reject(new Error(`意外能力调用 ${capability}`))
    }
    const result = await importWordDocumentFromPath(invoker, '~/文档/示例.docx')
    expect(result.status).toBe('imported')
    if (result.status === 'imported') {
      expect(result.path).toBe('~/文档/示例.docx')
      expect(result.document.blocks.length).toBe(15)
      expect(result.markdown).toContain('# 薯片办公文档')
      expect(result.bytes).toEqual(fixture())
    }
    expect(calls).toEqual([
      { capability: 'file:read', payload: { path: '~/文档/示例.docx', encoding: 'base64' } },
    ])
  })

  it('importWordDocumentFromPath 失败臂：能力错误如实回码，不伪造成功', async () => {
    const invoker = (): Promise<unknown> =>
      Promise.reject(Object.assign(new Error('读取失败'), { code: 'FILE_READ_FAILED' }))
    const result = await importWordDocumentFromPath(invoker, '~/文档/缺失.docx')
    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(result.errorCode).toBe('FILE_READ_FAILED')
      expect(result.message).toContain('读取失败')
    }
  })

  it('importWordDocumentFromPath 对非 docx 字节失败：网关解析错误如实上报', async () => {
    const invoker = (): Promise<unknown> =>
      Promise.resolve({ content: Buffer.from('不是 zip').toString('base64'), encoding: 'base64' })
    const result = await importWordDocumentFromPath(invoker, '~/文档/坏.docx')
    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(result.errorCode).toBe('WORD_IMPORT_PARSE_FAILED')
    }
  })

  it('persistWordDocument 经 file:write 真调落盘：base64 载荷解码恰等为文档字节', async () => {
    const doc = await readWordDocument(fixture())
    const calls: Array<{ capability: string; payload: unknown }> = []
    const invoker = (capability: string, payload: unknown): Promise<unknown> => {
      calls.push({ capability, payload })
      return Promise.resolve({})
    }
    const result = await persistWordDocument(invoker, '~/文档/示例.docx', doc)
    expect(result.status).toBe('written')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.capability).toBe('file:write')
    const payload = calls[0]?.payload as { path: string; data: string; encoding: string }
    expect(payload.path).toBe('~/文档/示例.docx')
    expect(payload.encoding).toBe('base64')
    expect(decodeBase64Bytes(payload.data).equals(await writeWordDocument(doc))).toBe(true)
  })

  it('persistWordDocument 失败臂：能力错误如实回码并携带已完成状态', async () => {
    const doc = await readWordDocument(fixture())
    const invoker = (): Promise<unknown> =>
      Promise.reject(Object.assign(new Error('拒绝写入'), { code: 'FILE_WRITE_DENIED' }))
    const result = await persistWordDocument(invoker, '~/文档/示例.docx', doc)
    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(result.errorCode).toBe('FILE_WRITE_DENIED')
      expect(result.message).toContain('未写入')
    }
  })

  it('文档导出编排：编辑回流模型 → docx → 重读，编辑与原文语义并存', async () => {
    const doc = await readWordDocument(fixture())
    // 模拟编辑回流：首段标题文本追加（与编辑器 insertText 同一模型变更形状）。
    const edited: WordDocument = {
      ...doc,
      blocks: doc.blocks.map((block, index) =>
        index === 1 && block.kind === 'heading'
          ? { ...block, runs: [{ text: '概览增补', marks: [], href: null }] }
          : block,
      ),
    }
    const bytes = await writeWordDocument(edited)
    const reread = await readWordDocument(bytes)
    expect(reread).toEqual(edited)
    expect(reread.blocks[1]).toMatchObject({
      kind: 'heading',
      level: 1,
      styleId: 'Heading1',
    })
  })
})
