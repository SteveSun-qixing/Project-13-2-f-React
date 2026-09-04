/**
 * Word 引擎（docx-engine）编辑链路回归测试
 *
 * 覆盖 .docx 字节级链路的四个阶段：
 * 1. 新建：buildBlankDocx 生成最小合法 OOXML 包
 * 2. 往返：生成 → parseDocx → saveDocx → 再 parseDocx，模型一致
 * 3. 编辑保存：文本替换 / 段落删除 / 段落新增后保存，修改生效且其余内容不丢
 * 4. 鲁棒性：空字节、非 zip 字节、缺 document.xml 包、非法 docxIndex 的错误处理
 *
 * 纯引擎层测试：不 mock 引擎、不依赖网络；docx 字节全部由引擎 API 与 JSZip 动态打包构造。
 */
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  BLANK_BULLET_NUM_ID,
  BLANK_ORDERED_NUM_ID,
  buildBlankDocx,
  parseDocx,
  readSectionSettings,
  saveDocx,
} from '../../src/engine/docx-engine/src'
import type {
  Block,
  GeneratedBlock,
  ParsedDocFull,
  Run,
  SaveBlock,
} from '../../src/engine/docx-engine/src'
import { bytesEqual } from '../../src/engine/shared/bytes'

/** 用 blank + saveDocx(generated) 生成一份带真实内容的文档字节（编辑链路的公共夹具） */
async function buildContentDocx(): Promise<Uint8Array> {
  const blank = await buildBlankDocx()
  const parsed = await parseDocx(blank)
  const generated: GeneratedBlock[] = [
    { type: 'heading', level: 1, runs: [{ text: '薯片季度会议纪要' }] },
    { type: 'paragraph', runs: [{ text: '普通段落文本' }] },
    {
      type: 'paragraph',
      runs: [
        { text: '加粗文本', bold: true },
        { text: '红色文本', color: 'FF0000' },
      ],
    },
    { type: 'paragraph', format: { align: 'center' }, runs: [{ text: '居中段落' }] },
    {
      type: 'listItem',
      list: { kind: 'bullet', numId: BLANK_BULLET_NUM_ID, ilvl: 0 },
      runs: [{ text: '要点一' }],
    },
    {
      type: 'listItem',
      list: { kind: 'ordered', numId: BLANK_ORDERED_NUM_ID, ilvl: 0 },
      runs: [{ text: '步骤一' }],
    },
    { type: 'paragraph', runs: [{ text: '特殊字符 <&> 与中文文本' }] },
  ]
  return saveDocx(parsed, generated.map((block) => ({ kind: 'generated' as const, block })))
}

/** 把解析出的 Block 投影成可比较的轻量模型（往返一致性断言用） */
function modelOf(parsed: ParsedDocFull) {
  return parsed.blocks.map((b) => ({
    type: b.type,
    hidden: !!b.hidden,
    level: b.level,
    styleId: b.styleId,
    list: b.list ?? null,
    align: b.format?.align,
    text: (b.runs ?? []).map((r) => r.text).join(''),
    bolds: (b.runs ?? []).map((r) => !!r.bold),
    colors: (b.runs ?? []).map((r) => r.color ?? null),
  }))
}

/** 文档全部可见段落的纯文本（含列表、标题） */
function visibleTexts(parsed: ParsedDocFull): string[] {
  return parsed.blocks
    .filter((b) => !b.hidden)
    .map((b) => (b.runs ?? []).map((r) => r.text).join(''))
}

/** 把解析出的 Block 转回 GeneratedBlock（模拟编辑器重建段落：保留 pPr/rPr 原始字节与模型字段） */
function toGeneratedBlock(block: Block, runs?: Run[]): GeneratedBlock {
  return {
    type: block.type === 'heading' || block.type === 'listItem' ? block.type : 'paragraph',
    ...(block.level !== undefined ? { level: block.level } : {}),
    ...(block.styleId !== undefined ? { styleId: block.styleId } : {}),
    ...(block.list !== undefined ? { list: block.list } : {}),
    ...(block.format !== undefined ? { format: block.format } : {}),
    ...(block.rawPPr !== undefined ? { rawPPr: block.rawPPr } : {}),
    runs: runs ?? block.runs ?? [],
  }
}

describe('Word 引擎：新建文档（buildBlankDocx）', () => {
  it('生成的新文档字节可被 JSZip 加载，且包含 OOXML 最小合法包的全部部件', async () => {
    const bytes = await buildBlankDocx()
    expect(bytes.length).toBeGreaterThan(0)

    const zip = await JSZip.loadAsync(bytes)
    for (const part of [
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
      'word/_rels/document.xml.rels',
      'word/styles.xml',
      'word/numbering.xml',
    ]) {
      expect(zip.file(part), `缺少部件 ${part}`).not.toBeNull()
    }
  })

  it('内容类型声明正确：document 主部件、rels 包关系类型均已声明', async () => {
    const bytes = await buildBlankDocx()
    const zip = await JSZip.loadAsync(bytes)

    const contentTypes = await zip.file('[Content_Types].xml')!.async('string')
    expect(contentTypes).toContain(
      '<Override PartName="/word/document.xml" ' +
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    )
    expect(contentTypes).toContain(
      '<Default Extension="rels" ' +
        'ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    )

    const rootRels = await zip.file('_rels/.rels')!.async('string')
    expect(rootRels).toContain(
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"',
    )
    expect(rootRels).toContain('Target="word/document.xml"')
  })

  it('parseDocx 可解析新文档：单个空段落 + 隐藏 sectPr + A4 纵向页面设置', async () => {
    const bytes = await buildBlankDocx()
    const parsed = await parseDocx(bytes)

    const visible = parsed.blocks.filter((b) => !b.hidden)
    expect(visible).toHaveLength(1)
    expect(visible[0]!.type).toBe('paragraph')
    expect(visible[0]!.runs ?? []).toHaveLength(0)

    // w:sectPr 位于 body 末尾，解析为隐藏块
    const hidden = parsed.blocks.filter((b) => b.hidden)
    expect(hidden).toHaveLength(1)
    expect(hidden[0]!.originalXml).toContain('<w:sectPr')

    // blank 模板固定 A4 纵向、1 英寸页边距
    const section = readSectionSettings(parsed)
    expect(section.pageWidth).toBe(11906)
    expect(section.pageHeight).toBe(16838)
    expect(section.orientation).toBe('portrait')
    expect(section.marginLeft).toBe(1440)
  })

  it('blank 模板样式完整：Normal/Heading1 存在，且标题样式被登记进 headingStyleIds', async () => {
    const parsed = await parseDocx(await buildBlankDocx())

    expect(parsed.styles.get('Normal')).toBeDefined()
    expect(parsed.styles.get('Heading1')).toBeDefined()
    expect(parsed.styles.get('ListParagraph')).toBeDefined()
    expect(parsed.headingStyleIds.get(1)).toBe('Heading1')
    // 列表编号定义：numId 1 = 项目符号，numId 2 = 有序编号
    expect(parsed.numbering.get(BLANK_BULLET_NUM_ID)).toBeDefined()
    expect(parsed.numbering.get(BLANK_ORDERED_NUM_ID)).toBeDefined()
  })
})

describe('Word 引擎：生成 → 解析 → 保存 往返', () => {
  it('saveDocx 生成的多段落文档可被 JSZip 重新加载，word/document.xml 含生成的段落文本', async () => {
    const bytes = await buildContentDocx()

    const zip = await JSZip.loadAsync(bytes)
    expect(zip.file('word/document.xml')).not.toBeNull()
    const documentXml = await zip.file('word/document.xml')!.async('string')
    expect(documentXml).toContain('薯片季度会议纪要')
    expect(documentXml).toContain('加粗文本')
  })

  it('生成 → parseDocx：段落/样式模型符合生成的模型（标题层级、加粗、颜色、对齐、列表）', async () => {
    const parsed = await parseDocx(await buildContentDocx())
    const visible = parsed.blocks.filter((b) => !b.hidden)

    expect(visible).toHaveLength(7)

    // 标题
    const heading = visible[0]!
    expect(heading.type).toBe('heading')
    expect(heading.level).toBe(1)
    expect(heading.styleId).toBe('Heading1')
    expect(heading.runs?.[0]?.text).toBe('薯片季度会议纪要')

    // 普通段落
    const plain = visible[1]!
    expect(plain.type).toBe('paragraph')
    expect(plain.runs?.map((r) => r.text)).toEqual(['普通段落文本'])

    // 加粗 + 颜色 run
    const styled = visible[2]!
    expect(styled.runs?.[0]).toMatchObject({ text: '加粗文本', bold: true })
    expect(styled.runs?.[1]).toMatchObject({ text: '红色文本', color: 'FF0000' })

    // 段落对齐
    expect(visible[3]!.format?.align).toBe('center')
    expect(visible[3]!.runs?.[0]?.text).toBe('居中段落')

    // 列表：项目符号 numId 1 / 有序编号 numId 2
    const bullet = visible[4]!
    expect(bullet.type).toBe('listItem')
    expect(bullet.list).toEqual({ kind: 'bullet', numId: BLANK_BULLET_NUM_ID, ilvl: 0 })
    const ordered = visible[5]!
    expect(ordered.type).toBe('listItem')
    expect(ordered.list).toEqual({ kind: 'ordered', numId: BLANK_ORDERED_NUM_ID, ilvl: 0 })

    // XML 转义往返：特殊字符原样还原
    expect(visible[6]!.runs?.[0]?.text).toBe('特殊字符 <&> 与中文文本')

    // 隐藏 sectPr 仍在末尾
    const hidden = parsed.blocks.filter((b) => b.hidden)
    expect(hidden).toHaveLength(1)
    expect(hidden[0]!.docxIndex).toBe(7)
  })

  it('未修改的文档保存后字节不变（逐字节相等），且可再次被 JSZip 加载', async () => {
    const bytes = await buildContentDocx()
    const parsed = await parseDocx(bytes)

    const finalBlocks: SaveBlock[] = parsed.blocks
      .filter((b) => !b.hidden)
      .map((b) => ({ kind: 'original', docxIndex: b.docxIndex! }))
    const saved = await saveDocx(parsed, finalBlocks)

    // saveDocx 对未修改文档按契约返回原始字节（不重打包）
    expect(bytesEqual(saved, bytes)).toBe(true)

    const zip = await JSZip.loadAsync(saved)
    expect(zip.file('word/document.xml')).not.toBeNull()
  })

  it('再解析保存结果：模型与首次解析完全一致（含隐藏块与页面设置）', async () => {
    const bytes = await buildContentDocx()
    const first = await parseDocx(bytes)

    const finalBlocks: SaveBlock[] = first.blocks
      .filter((b) => !b.hidden)
      .map((b) => ({ kind: 'original', docxIndex: b.docxIndex! }))
    const saved = await saveDocx(first, finalBlocks)
    const second = await parseDocx(saved)

    expect(modelOf(second)).toEqual(modelOf(first))
    expect(readSectionSettings(second).pageWidth).toBe(11906)
    expect(visibleTexts(second)).toEqual(visibleTexts(first))
  })
})

describe('Word 引擎：编辑保存（修改 → saveDocx → 重新解析）', () => {
  it('文本替换、段落删除、段落新增在一次保存中同时生效，其余段落内容不丢', async () => {
    const bytes = await buildContentDocx()
    const parsed = await parseDocx(bytes)
    const visible = parsed.blocks.filter((b) => !b.hidden)

    const [heading, plain, styled, , bullet, ordered, special] = visible
    expect(heading && plain && styled && bullet && ordered && special).toBeTruthy()

    // 编辑 1：普通段落改文本（run 对象保留 rawRPr 原始字节，模拟编辑器文本替换）
    const editedPlain = toGeneratedBlock(plain!, [
      { ...(plain!.runs![0]!), text: '普通段落文本（已编辑）' },
    ])
    // 编辑 2：加粗 run 改文本但保留加粗格式；同段红色 run 不动
    const editedStyled = toGeneratedBlock(styled!, [
      { ...(styled!.runs![0]!), text: '加粗文本已改' },
      styled!.runs![1]!,
    ])
    // 编辑 3：删除「居中段落」；编辑 4：文末新增一段
    const appended: GeneratedBlock = {
      type: 'paragraph',
      runs: [{ text: '新增段落文本' }],
    }

    const finalBlocks: SaveBlock[] = [
      { kind: 'original', docxIndex: heading!.docxIndex! },
      { kind: 'generated', block: editedPlain },
      { kind: 'generated', block: editedStyled },
      { kind: 'generated', block: appended },
      { kind: 'original', docxIndex: bullet!.docxIndex! },
      { kind: 'original', docxIndex: ordered!.docxIndex! },
      { kind: 'original', docxIndex: special!.docxIndex! },
    ]
    const saved = await saveDocx(parsed, finalBlocks)

    // 字节可被 JSZip 重新加载，document.xml 只含修改后的文本
    const zip = await JSZip.loadAsync(saved)
    const documentXml = await zip.file('word/document.xml')!.async('string')
    expect(documentXml).toContain('普通段落文本（已编辑）')
    expect(documentXml).toContain('新增段落文本')
    expect(documentXml).not.toContain('居中段落')

    // 重新解析：修改生效
    const reparsed = await parseDocx(saved)
    const texts = visibleTexts(reparsed)
    expect(texts).toContain('普通段落文本（已编辑）')
    expect(texts).toContain('新增段落文本')
    expect(texts).not.toContain('居中段落')

    // 其余段落内容不丢
    expect(texts).toContain('薯片季度会议纪要')
    expect(texts).toContain('特殊字符 <&> 与中文文本')
    expect(texts).toContain('要点一')
    expect(texts).toContain('步骤一')

    // 保留格式的编辑：改文本不加粗丢失；未编辑的红色 run 颜色不变
    const styledAfter = reparsed.blocks.find((b) =>
      (b.runs ?? []).some((r) => r.text === '加粗文本已改'),
    )
    expect(styledAfter?.runs?.[0]).toMatchObject({ text: '加粗文本已改', bold: true })
    expect(styledAfter?.runs?.[1]).toMatchObject({ text: '红色文本', color: 'FF0000' })

    // 列表模型在重新解析后保持不变
    const bulletAfter = reparsed.blocks.find((b) => (b.runs ?? []).some((r) => r.text === '要点一'))
    expect(bulletAfter?.type).toBe('listItem')
    expect(bulletAfter?.list).toEqual({ kind: 'bullet', numId: BLANK_BULLET_NUM_ID, ilvl: 0 })
    const orderedAfter = reparsed.blocks.find((b) =>
      (b.runs ?? []).some((r) => r.text === '步骤一'),
    )
    expect(orderedAfter?.list).toEqual({ kind: 'ordered', numId: BLANK_ORDERED_NUM_ID, ilvl: 0 })

    // 隐藏 sectPr 自动追加，页面设置在编辑保存后不丢
    const hidden = reparsed.blocks.filter((b) => b.hidden)
    expect(hidden).toHaveLength(1)
    expect(readSectionSettings(reparsed).pageWidth).toBe(11906)
  })
})

describe('Word 引擎：鲁棒性（非法输入的错误处理）', () => {
  it('空字节：parseDocx 拒绝并抛出 zip 解析错误', async () => {
    await expect(parseDocx(new Uint8Array(0))).rejects.toThrow(/central directory|zip/i)
  })

  it('非 zip 字节：parseDocx 拒绝并抛出错误，不产生半解析结果', async () => {
    const notZip = new TextEncoder().encode('这只是一个普通文本文件，不是 zip 压缩包。')
    await expect(parseDocx(notZip)).rejects.toThrow()
  })

  it('合法 zip 但缺少 word/document.xml：parseDocx 抛出明确的「不是 docx」错误', async () => {
    const zip = new JSZip()
    zip.file('readme.txt', '只有文本文件，没有 OOXML 部件')
    const bytes = await zip.generateAsync({ type: 'uint8array' })

    await expect(parseDocx(bytes)).rejects.toThrow(/not a docx|missing word\/document\.xml/)
  })

  it('saveDocx 引用越界 docxIndex：抛出明确的锚点错误', async () => {
    const parsed = await parseDocx(await buildBlankDocx())
    await expect(
      saveDocx(parsed, [{ kind: 'original', docxIndex: 999 }]),
    ).rejects.toThrow('invalid docxIndex 999')
  })
})
