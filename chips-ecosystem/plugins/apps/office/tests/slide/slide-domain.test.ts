/// slide 域测试：演示域模型（动画时序、调整柄几何、放映序列、CJK 文种、绘图/标尺/抠图
/// 纯逻辑）＋ pptx 最小合法字节夹具完整性（jszip 真实解析，不 mock）。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'

import {
  ADJUST_HANDLE_SPECS,
  adjustHandleSpecs,
} from '../../src/slide/domain/adjust-handles'
import {
  animClassOf,
  animStateKey,
  buildSteps,
  computeNodeStates,
  parseParaStateKey,
  pointAtPath,
  samplePathPoints,
} from '../../src/slide/domain/animation-play'
import { classifyCjkScript } from '../../src/slide/domain/cjk-script'
import { toPickerHex } from '../../src/slide/domain/color-input'
import { coverCropFractions } from '../../src/slide/domain/cover-crop'
import { defaultDrawSize, isLineDrawKind, resolveDrawRect } from '../../src/slide/domain/draw-shape'
import { colorDistance, removeBackground, toleranceToThreshold } from '../../src/slide/domain/cutout'
import { computeRulerTicks, formatRulerValue } from '../../src/slide/domain/ruler-ticks'
import {
  computePlayOrder,
  finishRehearse,
  formatClock,
  startRehearse,
  switchRehearsePage,
} from '../../src/slide/domain/slideshow-utils'
import { decodeLinkTarget, encodeLinkTarget } from '../../src/slide/domain/run-link'
import type { AnimationItem } from '../../src/slide/contracts/deck-actions'

const here = join(dirname(fileURLToPath(import.meta.url)))
const pptx = (): Buffer => readFileSync(join(here, '../fixtures/minimal.pptx'))

describe('slide 域：pptx 最小合法夹具完整性（真实字节 + jszip）', () => {
  it('OOXML 部件链完整（presentation/master/layout/theme/slide）', async () => {
    const zip = await JSZip.loadAsync(pptx())
    for (const part of [
      '[Content_Types].xml',
      'ppt/presentation.xml',
      'ppt/slides/slide1.xml',
      'ppt/slideMasters/slideMaster1.xml',
      'ppt/slideLayouts/slideLayout1.xml',
      'ppt/theme/theme1.xml',
    ]) {
      expect(zip.file(part), part).not.toBeNull()
    }
  })

  it('演示部件装配正确：sldIdLst 指向 slide1，slide1 挂 master 链', async () => {
    const zip = await JSZip.loadAsync(pptx())
    const presentation = await zip.file('ppt/presentation.xml')!.async('string')
    expect(presentation).toContain('<p:sldId id="256" r:id="rId2"/>')
    const slide = await zip.file('ppt/slides/slide1.xml')!.async('string')
    expect(slide).toContain('name="标题文本框"')
    expect(slide).toContain('<a:t>薯片演示</a:t>')
    expect(slide).toContain('prst="rect"')
    const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string')
    expect(slideRels).toContain('slideLayout1.xml')
    const contentTypes = await zip.file('[Content_Types].xml')!.async('string')
    expect(contentTypes).toContain('presentationml.slide+xml')
  })
})

describe('slide 域：形状动画时序（animation-play）', () => {
  const item = (over: Partial<AnimationItem>): AnimationItem => ({
    sourceId: 'shape-1',
    targetName: '形状',
    effect: 'fade',
    trigger: 'onClick',
    durationMs: 500,
    delayMs: 0,
    ...over,
  })

  it('animClassOf 入场/强调/退场/路径分类', () => {
    expect(animClassOf('fade')).toBe('entrance')
    expect(animClassOf('pulse')).toBe('emphasis')
    expect(animClassOf('fadeOut')).toBe('exit')
    expect(animClassOf('motionPath')).toBe('path')
  })

  it('buildSteps：onClick 开新步、withPrev 同步、afterPrev 接续', () => {
    const steps = buildSteps([
      item({ sourceId: 'a', trigger: 'onClick', durationMs: 400 }),
      item({ sourceId: 'b', trigger: 'withPrev', delayMs: 100, durationMs: 200 }),
      item({ sourceId: 'c', trigger: 'afterPrev', delayMs: 50, durationMs: 100 }),
      item({ sourceId: 'd', trigger: 'onClick', durationMs: 100 }),
    ])
    expect(steps).toHaveLength(2)
    // 步 1：a 0-400；b 与 a 同时起（+100 延迟）
    expect(steps[0]?.items.map((t) => t.item.sourceId)).toEqual(['a', 'b', 'c'])
    expect(steps[0]?.items[0]).toMatchObject({ startMs: 0, endMs: 400 })
    expect(steps[0]?.items[1]).toMatchObject({ startMs: 100, endMs: 300 })
    // c 接 b 结束（300）+ 50 延迟
    expect(steps[0]?.items[2]).toMatchObject({ startMs: 350, endMs: 450 })
    expect(steps[0]?.totalMs).toBe(450)
    // 步 2：d
    expect(steps[1]?.items.map((t) => t.item.sourceId)).toEqual(['d'])
  })

  it('首动画非 onClick 时步 0 标记为自动播放', () => {
    const steps = buildSteps([item({ trigger: 'afterPrev' })])
    expect(steps[0]?.auto).toBe(true)
    const clicked = buildSteps([item({ trigger: 'onClick' })])
    expect(clicked[0]?.auto).toBe(false)
  })

  it('computeNodeStates：入场类未播时隐藏、播完可见', () => {
    const steps = buildSteps([
      item({ sourceId: 'a', effect: 'fade', durationMs: 100 }),
      item({ sourceId: 'b', effect: 'pulse', durationMs: 100 }),
    ])
    const before = computeNodeStates(steps, 0, null, 720)
    expect(before.get('a')?.hidden).toBe(true)
    // 强调类目标初始可见
    expect(before.get('b')?.hidden).toBe(false)
    const after = computeNodeStates(steps, 2, null, 720)
    expect(after.get('a')?.hidden).toBe(false)
    expect(after.get('a')?.opacity).toBe(1)
  })

  it('animStateKey / parseParaStateKey 段落键往返', () => {
    expect(animStateKey('shape-1')).toBe('shape-1')
    const key = animStateKey('shape-1', 2)
    expect(parseParaStateKey(key)).toEqual({ sourceId: 'shape-1', para: 2 })
    expect(parseParaStateKey('shape-1')).toBeNull()
  })

  it('samplePathPoints / pointAtPath 路径采样与插值', () => {
    const pts = samplePathPoints('M 0 0 L 1 0 C 0.5 0.5 0.5 0.5 1 1 Z')
    expect(pts.length).toBeGreaterThan(2)
    const mid = pointAtPath(pts, 0.5)
    expect(mid.x).toBeGreaterThanOrEqual(0)
    expect(mid.x).toBeLessThanOrEqual(1)
  })
})

describe('slide 域：OOXML 调整柄几何（adjust-handles）', () => {
  it('连接线与未登记几何无调整柄', () => {
    expect(adjustHandleSpecs({ line: true, presetGeometry: 'roundRect' })).toEqual([])
    expect(adjustHandleSpecs({})).toEqual([])
    expect(adjustHandleSpecs({ presetGeometry: 'noSuchGeometry' })).toEqual([])
  })

  it('roundRect 圆角半径：柄位与反向取值（最短边分位，钳制上限 50000）', () => {
    const spec = ADJUST_HANDLE_SPECS.roundRect?.[0]
    expect(spec).toBeDefined()
    const w = 200
    const h = 100
    const driven = spec!.keys[0]!
    // 默认值 16667 → 柄在顶边 x = 最短边 × 16667/100000 = 16.667
    const pos = spec!.pos(w, h, (name, fallback) => (name === driven.name ? fallback : fallback))
    expect(pos.x).toBeCloseTo(16.667, 3)
    expect(pos.y).toBe(0)
    // 指针拖到 x=30 → 反解 adj = 30/100×100000 = 30000
    expect(spec!.values(w, h, 30, 5, () => driven.def)).toEqual({ [driven.name]: 30000 })
    // 超上限钳制到 50000
    expect(spec!.values(w, h, 90, 5, () => driven.def)).toEqual({ [driven.name]: 50000 })
  })

  it('wedgeRectCallout 等登记几何带柄', () => {
    expect(adjustHandleSpecs({ presetGeometry: 'wedgeRectCallout' }).length).toBeGreaterThan(0)
  })
})

describe('slide 域：绘图与标尺（draw-shape / ruler-ticks）', () => {
  it('线类判定与默认尺寸', () => {
    expect(isLineDrawKind('line')).toBe(true)
    expect(isLineDrawKind('rect')).toBe(false)
    expect(defaultDrawSize('rect').w).toBeGreaterThan(0)
    expect(defaultDrawSize('rect').h).toBeGreaterThan(0)
  })

  it('resolveDrawRect 归一负向拖拽', () => {
    const rect = resolveDrawRect('rect', 100, 100, 40, 30, false)
    expect(rect.x).toBe(40)
    expect(rect.y).toBe(30)
    expect(rect.w).toBe(60)
    expect(rect.h).toBe(70)
  })

  it('computeRulerTicks / formatRulerValue 英寸刻度（页心为 0 向两侧展开）', () => {
    const ticks = computeRulerTicks({
      rulerLen: 960,
      origin: 0,
      slideLen: 1280,
      zoom: 0.75,
      unit: 'in',
    })
    expect(ticks.length).toBeGreaterThan(2)
    // 幅面 960px：左缘 0.5in、页心 0、右缘 -0.5in（以 1in=96px 换算）
    expect(formatRulerValue(0, 960, 'in')).toBe('5 in')
    expect(formatRulerValue(0.5, 960, 'in')).toBe('0 in')
    // 距离值取幅度（无符号）
    expect(formatRulerValue(1, 960, 'in')).toBe('5 in')
  })
})

describe('slide 域：抠图几何（cutout）', () => {
  it('toleranceToThreshold / colorDistance', () => {
    expect(toleranceToThreshold(0)).toBeGreaterThanOrEqual(0)
    expect(toleranceToThreshold(100)).toBeGreaterThan(toleranceToThreshold(0))
    expect(colorDistance([0, 0, 0], [0, 0, 0])).toBe(0)
    expect(colorDistance([0, 0, 0], [255, 255, 255])).toBeGreaterThan(0)
  })

  it('removeBackground 抠除接近角点背景色的像素', () => {
    // 4×4：四角与边缘白，中心 2×2 深色前景（角点采样 → 背景色 = 白）
    const dark = [10, 20, 30, 255]
    const white = [255, 255, 255, 255]
    const px = (c: number[]): number[] => [...c]
    const data = new Uint8ClampedArray(4 * 4 * 4)
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const c = x >= 1 && x <= 2 && y >= 1 && y <= 2 ? dark : white
        data.set(px(c), (y * 4 + x) * 4)
      }
    }
    const result = removeBackground({ width: 4, height: 4, data }, 10)
    // 12 个白色背景像素被抠除，4 个前景保留
    expect(result.removedCount).toBe(12)
    expect(result.data[(1 * 4 + 1) * 4]).toBe(10)
    expect(result.data[0]).toBe(255)
    expect(result.data[3]).toBe(0)
  })
})

describe('slide 域：颜色输入与文种（color-input / cjk-script）', () => {
  it('toPickerHex 规范化', () => {
    expect(toPickerHex('#ff0000')).toBe('#ff0000')
    expect(toPickerHex(undefined)).toBeNull()
    expect(toPickerHex('not-a-color')).toBeNull()
  })

  it('classifyCjkScript 按字体家族判文种', () => {
    expect(classifyCjkScript('MS Mincho')).toBe('ja')
    expect(classifyCjkScript('Malgun Gothic')).toBe('ko')
    expect(classifyCjkScript('PMingLiU')).toBe('tc')
    expect(classifyCjkScript('Arial')).toBeNull()
  })
})

describe('slide 域：封面裁剪（cover-crop）', () => {
  it('coverCropFractions 居中裁剪填充与同比例免裁', () => {
    // 图像宽高比大于框：左右各裁
    const wide = coverCropFractions(200, 100, 100, 100)
    expect(wide).toEqual({ l: 0.25, t: 0, r: 0.25, b: 0 })
    // 图像宽高比小于框：上下各裁
    const tall = coverCropFractions(100, 200, 100, 100)
    expect(tall).toEqual({ l: 0, t: 0.25, r: 0, b: 0.25 })
    // 比例一致（<1% 偏差）免裁
    expect(coverCropFractions(200, 100, 400, 200)).toBeNull()
    // 非法尺寸
    expect(coverCropFractions(0, 100, 100, 100)).toBeNull()
  })
})

describe('slide 域：放映序列与排练计时（slideshow-utils）', () => {
  it('computePlayOrder 跳过隐藏页、支持自定义顺序与兜底', () => {
    const slides = [{ hidden: false }, { hidden: true }, { hidden: false }, { hidden: false }]
    expect(computePlayOrder(slides, 0)).toEqual([0, 2, 3])
    // 自定义顺序过滤越界与隐藏
    expect(computePlayOrder(slides, 0, [3, 1, 9, 2])).toEqual([3, 2])
    // 起始页即使隐藏也播
    expect(computePlayOrder([{ hidden: true }], 0)).toEqual([0])
    // 空结果兜底起始页
    expect(computePlayOrder([{ hidden: true }, { hidden: true }], 1)).toEqual([1])
  })

  it('排练计时累计与秒化（停留至少计 1 秒，未停留计 0）', () => {
    let t = startRehearse(3, 0, 0)
    t = switchRehearsePage(t, 1, 2500)
    t = switchRehearsePage(t, 2, 6000)
    // 第 1 页 2.5s→3s；第 2 页 3.5s→4s；第 3 页未停留（收尾即结束）→0
    expect(finishRehearse(t, 6000)).toEqual([3, 4, 0])
  })

  it('formatClock m:ss', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(65000)).toBe('1:05')
  })
})

describe('slide 域：超链接动作（run-link）', () => {
  it('外部链接与页内跳转编码往返', () => {
    expect(encodeLinkTarget({ kind: 'url', url: 'https://chips.example' })).toBe(
      'https://chips.example',
    )
    expect(encodeLinkTarget({ kind: 'slide', slideIndex: 3 })).toBe('slide:3')
    expect(decodeLinkTarget('slide:3')).toEqual({ kind: 'slide', slideIndex: 3 })
    expect(decodeLinkTarget('https://chips.example')).toEqual({
      kind: 'url',
      url: 'https://chips.example',
    })
    expect(decodeLinkTarget(null)).toBeNull()
    expect(decodeLinkTarget('')).toBeNull()
  })
})
