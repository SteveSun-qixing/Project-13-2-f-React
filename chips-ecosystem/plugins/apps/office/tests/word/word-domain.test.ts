/// word 域领域层纯逻辑测试：文档模型 / 段落样式映射 / Markdown 编辑表示映射 /
/// Word 口径字数统计（node 环境，零 mock；夹具字节级链路见 word-gateway.test.ts）。
import { describe, expect, it } from 'vitest'

import {
  blockText,
  createEmptyWordDocument,
  documentPlainText,
  type WordBlock,
  type WordDocument,
  type WordRun,
} from '../../src/word/domain/document-model'
import { countDocumentStatistics, countWords } from '../../src/word/domain/text-statistics'
import {
  alignmentFromJc,
  HEADING_STYLE_IDS,
  headingLevelFromStyleId,
  headingStyleIdFromLevel,
  HYPERLINK_STYLE_ID,
  isHeadingStyleId,
  jcFromAlignment,
  listKindFromNumFmt,
  semanticStyleFromStyleId,
  TITLE_STYLE_ID,
} from '../../src/word/domain/style-mapping'
import {
  documentToMarkdown,
  markdownToDocument,
} from '../../src/word/domain/markdown-mapping'

const run = (text: string, marks: WordRun['marks'] = []): WordRun => ({
  text,
  marks,
  href: null,
})

describe('word 文档模型', () => {
  it('空文档工厂产出单空段落正文与空节设置', () => {
    const doc = createEmptyWordDocument()
    expect(doc.blocks).toHaveLength(1)
    expect(doc.blocks[0]?.kind).toBe('paragraph')
    expect(blockText(doc.blocks[0]!)).toBe('')
    expect(doc.section).toBeNull()
  })

  it('blockText 抽取段落系文本、documentPlainText 以换行连接正文块', () => {
    const doc: WordDocument = {
      blocks: [
        { kind: 'heading', level: 1, styleId: 'Heading1', alignment: null, runs: [run('标题')] },
        {
          kind: 'paragraph',
          styleId: null,
          alignment: null,
          runs: [run('前'), run('后', ['bold'])],
        },
        {
          kind: 'table',
          columnWidthsTwips: null,
          rows: [
            {
              header: true,
              cells: [
                { alignment: null, runs: [run('表头')] },
                { alignment: null, runs: [run('数值')] },
              ],
            },
            {
              header: false,
              cells: [{ alignment: null, runs: [run('深度')] }, { alignment: null, runs: [run('13')] }],
            },
          ],
        },
      ],
      section: null,
    }
    expect(blockText(doc.blocks[0]!)).toBe('标题')
    expect(blockText(doc.blocks[2]!)).toBe('表头数值深度13')
    expect(documentPlainText(doc)).toBe('标题\n前后\n表头数值深度13')
  })

  it('documentPlainText 对空文档返回空串', () => {
    expect(documentPlainText(createEmptyWordDocument())).toBe('')
  })
})

describe('段落样式映射（docx pStyle ↔ 域语义）', () => {
  it('Heading1~6 样式 ID 映射标题级别并反向回写', () => {
    expect(HEADING_STYLE_IDS).toEqual([
      'Heading1',
      'Heading2',
      'Heading3',
      'Heading4',
      'Heading5',
      'Heading6',
    ])
    for (let level = 1 as 1 | 2 | 3 | 4 | 5 | 6; level <= 6; level = (level + 1) as 1 | 2 | 3 | 4 | 5 | 6) {
      expect(headingLevelFromStyleId(`Heading${level}`)).toBe(level)
      expect(headingStyleIdFromLevel(level)).toBe(`Heading${level}`)
      expect(isHeadingStyleId(`Heading${level}`)).toBe(true)
    }
  })

  it('样式名形态（heading N）与非法输入分支', () => {
    expect(headingLevelFromStyleId('heading 3')).toBe(3)
    expect(headingLevelFromStyleId('Title')).toBeNull()
    expect(headingLevelFromStyleId('ListParagraph')).toBeNull()
    expect(headingLevelFromStyleId(null)).toBeNull()
    expect(isHeadingStyleId('Heading7')).toBe(false)
  })

  it('语义样式分类覆盖 Title/Quote/代码/列表/普通与未知样式直通', () => {
    expect(semanticStyleFromStyleId(TITLE_STYLE_ID)).toBe('title')
    expect(semanticStyleFromStyleId('Heading2')).toBe('heading')
    expect(semanticStyleFromStyleId('Quote')).toBe('quote')
    expect(semanticStyleFromStyleId('HTMLPreformatted')).toBe('code')
    expect(semanticStyleFromStyleId('ListParagraph')).toBe('list')
    expect(semanticStyleFromStyleId('Normal')).toBe('normal')
    expect(semanticStyleFromStyleId('自定义样式')).toBe('other')
    expect(semanticStyleFromStyleId(null)).toBe('normal')
  })

  it('对齐值双向映射（jc ↔ 域对齐）', () => {
    expect(alignmentFromJc('center')).toBe('center')
    expect(alignmentFromJc('right')).toBe('right')
    expect(alignmentFromJc('both')).toBe('both')
    expect(alignmentFromJc('justify')).toBe('both')
    expect(alignmentFromJc('left')).toBe('left')
    expect(alignmentFromJc('start')).toBe('left')
    expect(alignmentFromJc(null)).toBeNull()
    expect(jcFromAlignment('center')).toBe('center')
    expect(jcFromAlignment('both')).toBe('both')
    expect(jcFromAlignment(null)).toBeNull()
  })

  it('编号格式映射列表种别：bullet 与有序系全部归 ordered', () => {
    expect(listKindFromNumFmt('bullet')).toBe('bullet')
    expect(listKindFromNumFmt('decimal')).toBe('ordered')
    expect(listKindFromNumFmt('lowerLetter')).toBe('ordered')
    expect(listKindFromNumFmt('upperRoman')).toBe('ordered')
    expect(listKindFromNumFmt('none')).toBe('bullet')
  })

  it('超链接字符样式 ID 判定', () => {
    expect(HYPERLINK_STYLE_ID).toBe('Hyperlink')
  })
})

describe('域模型 ↔ Markdown 编辑表示', () => {
  it('标题/段落/加粗斜体删除线/行内代码/超链接往返恰等', () => {
    const doc: WordDocument = {
      blocks: [
        { kind: 'heading', level: 2, styleId: 'Heading2', alignment: null, runs: [run('概览')] },
        {
          kind: 'paragraph',
          styleId: null,
          alignment: null,
          runs: [
            run('普通'),
            run('加粗', ['bold']),
            run('斜体', ['italic']),
            run('删除', ['strike']),
            run('code_snippet()', ['code']),
            { text: '官网', marks: ['underline'], href: 'https://www.chips.example/' },
          ],
        },
      ],
      section: null,
    }
    const markdown = documentToMarkdown(doc)
    expect(markdown).toContain('## 概览')
    expect(markdown).toContain('普通**加粗***斜体*~~删除~~`code_snippet()`[官网](https://www.chips.example/)')
    const parsed = markdownToDocument(markdown)
    expect(parsed.blocks).toEqual(doc.blocks)
  })

  it('引用段按块引用行往返、代码段合并为围栏再拆回', () => {
    const doc: WordDocument = {
      blocks: [
        { kind: 'paragraph', styleId: 'Quote', alignment: null, runs: [run('引用第一行')] },
        { kind: 'paragraph', styleId: 'Quote', alignment: null, runs: [run('引用第二行')] },
        { kind: 'paragraph', styleId: 'HTMLPreformatted', alignment: null, runs: [run('const a = 1;')] },
        { kind: 'paragraph', styleId: 'HTMLPreformatted', alignment: null, runs: [run('return a;')] },
      ],
      section: null,
    }
    const markdown = documentToMarkdown(doc)
    expect(markdown).toContain('> 引用第一行')
    expect(markdown).toContain('```')
    expect(markdown).toContain('const a = 1;\nreturn a;')
    const parsed = markdownToDocument(markdown)
    expect(parsed.blocks).toEqual(doc.blocks)
  })

  it('列表种别与嵌套层级往返恰等，无序列表 remark 规范形态由映射侧收口', () => {
    const doc: WordDocument = {
      blocks: [
        {
          kind: 'listItem',
          styleId: 'ListParagraph',
          alignment: null,
          list: { kind: 'bullet', numId: 1, level: 0 },
          runs: [run('要点甲')],
        },
        {
          kind: 'listItem',
          styleId: 'ListParagraph',
          alignment: null,
          list: { kind: 'bullet', numId: 1, level: 1 },
          runs: [run('子要点')],
        },
        {
          kind: 'listItem',
          styleId: 'ListParagraph',
          alignment: null,
          list: { kind: 'bullet', numId: 1, level: 0 },
          runs: [run('要点乙')],
        },
        {
          kind: 'listItem',
          styleId: 'ListParagraph',
          alignment: null,
          list: { kind: 'ordered', numId: 2, level: 0 },
          runs: [run('第一步')],
        },
        {
          kind: 'listItem',
          styleId: 'ListParagraph',
          alignment: null,
          list: { kind: 'ordered', numId: 2, level: 0 },
          runs: [run('第二步')],
        },
      ],
      section: null,
    }
    const markdown = documentToMarkdown(doc)
    expect(markdown).toBe('- 要点甲\n  - 子要点\n- 要点乙\n\n1. 第一步\n2. 第二步')
    expect(markdownToDocument(markdown).blocks).toEqual(doc.blocks)
  })

  it('任意 numId 经往返归一为列表组序号（语义保持的显式口径）', () => {
    const doc: WordDocument = {
      blocks: [
        {
          kind: 'listItem',
          styleId: 'ListParagraph',
          alignment: null,
          list: { kind: 'ordered', numId: 7, level: 0 },
          runs: [run('甲')],
        },
        {
          kind: 'listItem',
          styleId: 'ListParagraph',
          alignment: null,
          list: { kind: 'ordered', numId: 7, level: 0 },
          runs: [run('乙')],
        },
      ],
      section: null,
    }
    const parsed = markdownToDocument(documentToMarkdown(doc))
    expect(parsed.blocks).toEqual([
      {
        kind: 'listItem',
        styleId: 'ListParagraph',
        alignment: null,
        list: { kind: 'ordered', numId: 1, level: 0 },
        runs: [run('甲')],
      },
      {
        kind: 'listItem',
        styleId: 'ListParagraph',
        alignment: null,
        list: { kind: 'ordered', numId: 1, level: 0 },
        runs: [run('乙')],
      },
    ])
  })

  it('表格按 GFM 形态往返，列对齐取自表头行且表头行还原（列宽无编辑表示面，显式收窄）', () => {
    const doc: WordDocument = {
      blocks: [
        {
          kind: 'table',
          columnWidthsTwips: null,
          rows: [
            {
              header: true,
              cells: [
                { alignment: 'left', runs: [run('名称')] },
                { alignment: 'right', runs: [run('数值')] },
              ],
            },
            {
              header: false,
              cells: [{ alignment: null, runs: [run('深度')] }, { alignment: null, runs: [run('13')] }],
            },
          ],
        },
      ],
      section: null,
    }
    const markdown = documentToMarkdown(doc)
    expect(markdown).toBe('| 名称 | 数值 |\n| :--- | ---: |\n| 深度 | 13 |')
    expect(markdownToDocument(markdown).blocks).toEqual(doc.blocks)
  })

  it('正文段对齐映射为居中/右对齐 HTML（GFM 无正文对齐面的编辑表示）并往返', () => {
    const centered: WordBlock = {
      kind: 'paragraph',
      styleId: null,
      alignment: 'center',
      runs: [run('居中')],
    }
    const right: WordBlock = {
      kind: 'paragraph',
      styleId: 'Normal',
      alignment: 'right',
      runs: [run('右对齐')],
    }
    const markdown = documentToMarkdown({ blocks: [centered, right], section: null })
    expect(markdown).toBe('<p style="text-align: center">居中</p>\n\n<p style="text-align: right">右对齐</p>')
    // 对齐 HTML 形态不承载样式 ID（Markdown 无样式通道，收窄口径同 Title/列宽）。
    expect(markdownToDocument(markdown).blocks).toEqual([
      centered,
      { kind: 'paragraph', styleId: null, alignment: 'right', runs: [run('右对齐')] },
    ])
  })

  it('Markdown 特殊字符转义往返恰等（星号/井号/反斜杠/反引号/方括号/波浪线）', () => {
    const text = '字面 * 星号与 \\# 井号与 ` 反引号与 [方] 与 ~ 波浪与 _ 下划线'
    const doc: WordDocument = {
      blocks: [{ kind: 'paragraph', styleId: null, alignment: null, runs: [run(text)] }],
      section: null,
    }
    const markdown = documentToMarkdown(doc)
    expect(markdown).not.toContain(' * 星号')
    expect(markdownToDocument(markdown).blocks).toEqual(doc.blocks)
  })

  it('空文档映射为单个空段落的 Markdown 表示并可还原', () => {
    const empty = createEmptyWordDocument()
    expect(documentToMarkdown(empty)).toBe('')
    expect(markdownToDocument('')).toEqual(empty)
  })

  it('下划线run经内联 HTML 编辑表示往返（Milkdown 原文保真承载面）', () => {
    const doc: WordDocument = {
      blocks: [
        {
          kind: 'paragraph',
          styleId: null,
          alignment: null,
          runs: [run('普通'), run('下划', ['underline']), run('收尾')],
        },
      ],
      section: null,
    }
    const markdown = documentToMarkdown(doc)
    expect(markdown).toContain('普通<u>下划</u>收尾')
    expect(markdownToDocument(markdown).blocks).toEqual(doc.blocks)
  })
})

describe('Word 口径字数统计（旧 word-count 语义迁移）', () => {
  it('中文字逐字计数、英文按词计数、合计为两者之和', () => {
    expect(countWords('薯片办公')).toBe(4)
    expect(countWords('hello world')).toBe(2)
    expect(countWords('薯片 chips 文档 word')).toBe(4 + 2)
    expect(countWords('')).toBe(0)
    expect(countWords('连字符词 mid-term 计一')).toBe(6 + 1)
  })

  it('文档统计从正文纯文本出数（字数/字符数两口径）', () => {
    const doc: WordDocument = {
      blocks: [
        { kind: 'heading', level: 1, styleId: 'Heading1', alignment: null, runs: [run('标题')] },
        { kind: 'paragraph', styleId: null, alignment: null, runs: [run('正文 two')] },
      ],
      section: null,
    }
    const stats = countDocumentStatistics(doc)
    expect(stats.words).toBe(4 + 1)
    // 纯文本以块间换行连接：标题(2) + \n + 正文 two(6) = 9 码点。
    expect(stats.characters).toBe('标题\n正文 two'.length)
  })
})
