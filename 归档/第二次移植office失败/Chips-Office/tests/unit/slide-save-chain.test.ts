// @vitest-environment node
/**
 * Slide 保存链路回归测试（纯引擎层，不依赖网络与 Host）。
 *
 * 以「正确行为」为目标固化 pptx-engine 保存链路契约：
 * - createBlankPptx 产出 Uint8Array 字节（而非可 .save() 的 JSZip 实例）；
 * - 编辑动作（加元素/改文本/增删幻灯片）→ savePptx 产出合法 zip → openPptx 往返一致；
 * - commitSaved 清空 dirty 标记，再次保存字节幂等；
 * - copySlide/pasteSlide 幻灯片复制与 mergeSlideFromPptx 跨文件合并内容不丢失。
 */
import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import {
  addElement,
  commitSaved,
  copySlide,
  createBlankPptx,
  deleteSlide,
  insertBlankSlide,
  mergeSlideFromPptx,
  openPptx,
  pasteSlide,
  patchSlideXml,
  savePptx,
  type OpenedPptx,
  type Slide,
  type TextElement,
} from '../../src/engine/pptx-engine/src/index'
import { bytesEqual } from '../../src/engine/shared/bytes'

const BLANK_SIZE = { cx: 12192000, cy: 6858000 }

async function openBlankDeck(): Promise<OpenedPptx> {
  return openPptx(await createBlankPptx())
}

function addTextbox(deck: OpenedPptx, slideIndex: number, text: string): TextElement {
  const slide = deck.deck.slides[slideIndex]
  if (!slide) throw new Error(`幻灯片不存在：${slideIndex}`)
  const el = addElement(slide, {
    kind: 'textbox',
    offset: { x: 914400, y: 914400, cx: 6096000, cy: 914400 },
    paragraphs: [{ runs: [{ text }] }],
  })
  el.dirty = true
  return el
}

/** 提取一张幻灯片上所有含文本元素的文字（按元素聚合，段落内拼接 run）。 */
function slideTexts(slide: Slide): string[] {
  const out: string[] = []
  for (const el of slide.elements) {
    const body = (el as TextElement).text
    if (!body) continue
    const joined = body.paragraphs
      .map((p) => p.runs.map((r) => r.text ?? '').join(''))
      .join('\n')
    if (joined !== '') out.push(joined)
  }
  return out
}

function deckIsClean(deck: OpenedPptx): boolean {
  return deck.deck.slides.every(
    (slide) =>
      !slide.structureDirty &&
      slide.elements.every(
        (el) =>
          !el.dirty &&
          !el.dirtyTransform &&
          !el.dirtyFill &&
          !el.dirtyStroke &&
          !el.dirtySrcRect &&
          !el.dirtyPPr,
      ),
  )
}

describe('pptx-engine 保存链路', () => {
  it('createBlankPptx 产出最小演示文稿字节，openPptx 解析为单张空白幻灯片', async () => {
    const bytes = await createBlankPptx()
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)

    const opened = await openPptx(bytes)
    expect(opened.deck.slides).toHaveLength(1)
    expect(opened.deck.slides[0]?.elements).toHaveLength(0)
    expect(opened.deck.size.cx).toBe(BLANK_SIZE.cx)
    expect(opened.deck.size.cy).toBe(BLANK_SIZE.cy)
  })

  it('文本编辑后 savePptx 产出合法 zip，openPptx 往返保持尺寸与文本', async () => {
    const opened = await openBlankDeck()
    const el = addTextbox(opened, 0, '原始标题')
    el.text!.paragraphs = [{ runs: [{ text: '编辑后标题' }] }]
    el.dirty = true

    const saved = await savePptx(opened)
    expect(saved).toBeInstanceOf(Uint8Array)
    expect(saved.length).toBeGreaterThan(0)

    const zip = await JSZip.loadAsync(saved)
    expect(zip.file('ppt/presentation.xml')).not.toBeNull()
    expect(zip.file('ppt/slides/slide1.xml')).not.toBeNull()
    expect(zip.file('ppt/theme/theme1.xml')).not.toBeNull()

    const reopened = await openPptx(saved)
    expect(reopened.deck.size.cx).toBe(BLANK_SIZE.cx)
    expect(reopened.deck.size.cy).toBe(BLANK_SIZE.cy)
    expect(reopened.deck.slides).toHaveLength(1)
    expect(slideTexts(reopened.deck.slides[0]!)).toEqual(['编辑后标题'])
  })

  it('insertBlankSlide 与 deleteSlide 保存往返：数量、顺序与文本保持', async () => {
    const opened = await openBlankDeck()
    addTextbox(opened, 0, '正文第一页')

    const blank = insertBlankSlide(opened, 0)
    expect(blank).not.toBeNull()
    expect(opened.deck.slides).toHaveLength(2)
    expect(slideTexts(opened.deck.slides[0]!)).toEqual(['正文第一页'])
    expect(opened.deck.slides[1]?.elements).toHaveLength(0)

    expect(deleteSlide(opened, 1)).toBe(true)
    expect(opened.deck.slides).toHaveLength(1)
    // 仅剩一张幻灯片时拒绝继续删除
    expect(deleteSlide(opened, 0)).toBe(false)

    const saved = await savePptx(opened)
    const reopened = await openPptx(saved)
    expect(reopened.deck.slides).toHaveLength(1)
    expect(slideTexts(reopened.deck.slides[0]!)).toEqual(['正文第一页'])
  })

  it('copySlide/pasteSlide 复制幻灯片：未保存的编辑一并搬运且保存往返一致', async () => {
    const opened = await openBlankDeck()
    addTextbox(opened, 0, '复制来源文本')

    const bundle = copySlide(opened, 0)
    expect(bundle).not.toBeNull()
    expect(bundle!.slideXml).toContain('复制来源文本')

    const pasted = pasteSlide(opened, 0, bundle!)
    expect(pasted).not.toBeNull()
    expect(opened.deck.slides).toHaveLength(2)
    expect(slideTexts(opened.deck.slides[0]!)).toEqual(['复制来源文本'])
    expect(slideTexts(opened.deck.slides[1]!)).toEqual(['复制来源文本'])

    const saved = await savePptx(opened)
    const reopened = await openPptx(saved)
    expect(reopened.deck.slides).toHaveLength(2)
    expect(slideTexts(reopened.deck.slides[0]!)).toEqual(['复制来源文本'])
    expect(slideTexts(reopened.deck.slides[1]!)).toEqual(['复制来源文本'])
  })

  it('commitSaved 清空 dirty 标记并同步字节锚点，再次保存字节幂等', async () => {
    const opened = await openBlankDeck()
    const el = addTextbox(opened, 0, '提交前文本')
    el.text!.paragraphs = [{ runs: [{ text: '提交后文本' }] }]
    el.dirty = true
    insertBlankSlide(opened, 0)
    expect(deckIsClean(opened)).toBe(false)

    const savedOnce = await savePptx(opened)
    commitSaved(opened)

    expect(deckIsClean(opened)).toBe(true)
    for (const slide of opened.deck.slides) {
      expect(slide.originalXml).toBe(patchSlideXml(slide))
    }

    const savedTwice = await savePptx(opened)
    expect(bytesEqual(savedOnce, savedTwice)).toBe(true)

    const reopened = await openPptx(savedTwice)
    expect(reopened.deck.slides).toHaveLength(2)
    expect(slideTexts(reopened.deck.slides[0]!)).toEqual(['提交后文本'])
    expect(slideTexts(reopened.deck.slides[1]!)).toEqual([])
  })

  it('mergeSlideFromPptx 跨文件合并：目标演示文稿保存往返后内容完整', async () => {
    const source = await openBlankDeck()
    addTextbox(source, 0, '跨文件搬运')
    const sourceBytes = await savePptx(source)

    const target = await openBlankDeck()
    const merged = await mergeSlideFromPptx(target, sourceBytes)
    expect(merged).not.toBeNull()
    expect(target.deck.slides).toHaveLength(2)

    const saved = await savePptx(target)
    const reopened = await openPptx(saved)
    expect(reopened.deck.slides).toHaveLength(2)
    expect(slideTexts(reopened.deck.slides[0]!)).toEqual([])
    expect(slideTexts(reopened.deck.slides[1]!)).toEqual(['跨文件搬运'])
  })
})
