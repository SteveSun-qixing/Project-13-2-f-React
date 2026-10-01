/// pdf 域纯逻辑测试（jsdom：canvas 量测走无 canvas 环境的确定性回退、text-line 走真实 DOM）。
/// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  geomDispSize,
  pdfToView,
  quadToRect,
  viewToPdf,
} from '../../src/pdf/domain/annotations'
import {
  colorsToRuns,
  decodeStyle,
  encodeStyle,
  runsToColors,
} from '../../src/pdf/domain/color-runs'
import { mapDocFont } from '../../src/pdf/domain/doc-font'
import { navAction } from '../../src/pdf/domain/keyNav'
import { layoutMarginCards, type MarginLayoutEntry } from '../../src/pdf/domain/note-margin-layout'
import {
  buildNoteThreads,
  flattenThread,
  parsePdfDate,
  pendingNoteKey,
  savedNoteKey,
  toSavedNote,
  type SavedNoteAnnot,
} from '../../src/pdf/domain/note-threads'
import { rowOfVisIdx, spreadRows, stepPage } from '../../src/pdf/domain/spread'
import { MARKUP_TYPE_BY_ANNOT, rectsNear } from '../../src/pdf/domain/edit-state'
import { groupLineSpans } from '../../src/pdf/domain/text-line'
import { unifyRadicals, wrapText } from '../../src/pdf/domain/text-wrap'
import {
  loadViewState,
  saveViewState,
  VIEW_STATE_KEY,
  type PdfViewState,
} from '../../src/pdf/domain/view-state'

describe('pdf 域：页面几何（annotations）', () => {
  it('geomDispSize 随旋转交换宽高', () => {
    expect(geomDispSize({ pw: 612, ph: 792, rot: 0 })).toEqual({ width: 612, height: 792 })
    expect(geomDispSize({ pw: 612, ph: 792, rot: 90 })).toEqual({ width: 792, height: 612 })
    expect(geomDispSize({ pw: 612, ph: 792, rot: 270 })).toEqual({ width: 792, height: 612 })
  })

  it('viewToPdf / pdfToView 互逆（四种旋转）', () => {
    for (const rot of [0, 90, 180, 270]) {
      const g = { pw: 200, ph: 100, rot }
      const [x, y] = viewToPdf(g, 40, 30)
      const [vx, vy] = pdfToView(g, x, y)
      expect(vx).toBeCloseTo(40, 6)
      expect(vy).toBeCloseTo(30, 6)
    }
  })

  it('viewToPdf 各旋转的坐标语义（y 翻转/轴交换）', () => {
    expect(viewToPdf({ pw: 200, ph: 100, rot: 0 }, 40, 30)).toEqual([40, 70])
    expect(viewToPdf({ pw: 200, ph: 100, rot: 90 }, 40, 30)).toEqual([30, 40])
    expect(viewToPdf({ pw: 200, ph: 100, rot: 180 }, 40, 30)).toEqual([160, 30])
    expect(viewToPdf({ pw: 200, ph: 100, rot: 270 }, 40, 30)).toEqual([170, 60])
  })

  it('quadToRect 取四点外接矩形', () => {
    expect(quadToRect([0, 10, 8, 10, 0, 2, 8, 2])).toEqual([0, 2, 8, 10])
  })
})

describe('pdf 域：选区颜色运行（color-runs）', () => {
  it('encodeStyle / decodeStyle 往返', () => {
    const key = encodeStyle({ color: '#FF0000', font: 'Arial', size: 12, bold: true, italic: false })
    expect(decodeStyle(key)).toEqual({
      color: '#FF0000',
      font: 'Arial',
      size: 12,
      bold: true,
      italic: false,
    })
  })

  it('colorsToRuns / runsToColors 互逆', () => {
    const colors = ['#111111', '#111111', '#222222', '', '']
    const runs = colorsToRuns(colors)
    expect(runs).toEqual([
      { start: 0, end: 2, color: '#111111' },
      { start: 2, end: 3, color: '#222222' },
    ])
    expect(runsToColors(5, runs)).toEqual(colors)
  })
})

describe('pdf 域：文档字体映射（doc-font）', () => {
  it('剥离子集前缀并解析字重', () => {
    const style = mapDocFont('ABCDEF+Arial-BoldMT')
    expect(style.css.toLowerCase()).toContain('arial')
    expect(style.weight).toBe(700)
  })
})

describe('pdf 域：键盘导航（keyNav）', () => {
  it('翻页/滚动/缩略图聚焦的分级动作', () => {
    expect(navAction('PageDown', false)).toMatchObject({ type: 'scrollViewport', dir: 1 })
    expect(navAction('PageUp', false)).toMatchObject({ type: 'scrollViewport', dir: -1 })
    // 非缩略图聚焦：方向键滚动；缩略图聚焦：方向键整页步进
    expect(navAction('ArrowDown', false)).toEqual({ type: 'scrollBy', delta: 60 })
    expect(navAction('ArrowUp', false)).toEqual({ type: 'scrollBy', delta: -60 })
    expect(navAction('ArrowDown', true)).toEqual({ type: 'stepPage', dir: 1 })
    expect(navAction('ArrowRight', false)).toEqual({ type: 'stepPage', dir: 1 })
    expect(navAction('Home', false)).toEqual({ type: 'scrollEdge', edge: 'top' })
    // 未映射键与 Escape 不产生动作
    expect(navAction('x', false)).toBeNull()
    expect(navAction('Escape', false)).toBeNull()
  })
})

describe('pdf 域：页排布（spread）', () => {
  it('spreadRows 单页/双页排布（双页自首页起两两配对）', () => {
    expect(spreadRows([0, 1, 2, 3], 1)).toEqual([[0], [1], [2], [3]])
    expect(spreadRows([0, 1, 2, 3], 2)).toEqual([[0, 1], [2, 3]])
    expect(spreadRows([0, 1, 2], 2)).toEqual([[0, 1], [2]])
  })

  it('rowOfVisIdx 与 stepPage（页码为 1 基可视序）', () => {
    expect(rowOfVisIdx(0, 2)).toBe(0)
    expect(rowOfVisIdx(1, 2)).toBe(0)
    expect(rowOfVisIdx(3, 2)).toBe(1)
    // 单页模式整页步进
    expect(stepPage([0, 1, 2, 3], 1, 1, 1)).toBe(2)
    expect(stepPage([0, 1, 2, 3], 1, 1, -1)).toBe(1)
    // 双页模式整行步进：第 1 页 → 下行首（第 3 页）
    expect(stepPage([0, 1, 2, 3], 2, 1, 1)).toBe(3)
    expect(stepPage([0, 1, 2, 3], 2, 3, -1)).toBe(1)
    // 边界钳制
    expect(stepPage([0, 1, 2, 3], 2, 4, 1)).toBe(3)
  })
})

describe('pdf 域：批注状态几何（edit-state）', () => {
  it('rectsNear 容差判定', () => {
    expect(rectsNear([0, 0, 10, 10], [1, 1, 11, 11])).toBe(true)
    expect(rectsNear([0, 0, 10, 10], [5, 5, 15, 15])).toBe(false)
  })

  it('MARKUP_TYPE_BY_ANNOT 覆盖高亮/下划线/删除线子型', () => {
    expect(Object.values(MARKUP_TYPE_BY_ANNOT)).toEqual(
      expect.arrayContaining(['highlight', 'underline', 'strikeout']),
    )
  })
})

describe('pdf 域：批注日期与笔记线程（note-threads）', () => {
  it('parsePdfDate 解析 PDF 日期串', () => {
    expect(parsePdfDate("D:20260930120000+08'00'")).not.toBeNull()
    expect(parsePdfDate(null)).toBeNull()
    expect(parsePdfDate('garbage')).toBeNull()
  })

  it('toSavedNote 提取 Text 批注（pdf.js 数据面，颜色 0-255 归一）', () => {
    const saved = toSavedNote(
      {
        annotationType: 1,
        id: '12R',
        rect: [0, 0, 40, 20],
        color: [255, 199, 0],
        contentsObj: { str: '第一条批注' },
        titleObj: { str: '薯片' },
        creationDate: 'D:20260930120000Z',
      },
      0,
    )
    expect(saved).not.toBeNull()
    expect(saved?.objNum).toBe(12)
    expect(saved?.contents).toBe('第一条批注')
    expect(saved?.author).toBe('薯片')
    expect(saved?.color).toEqual([1, 199 / 255, 0])
    expect(saved?.timeMs).not.toBeNull()
    // 非 Text 批注与 Group 回复不收集
    expect(toSavedNote({ annotationType: 3, id: '13R', rect: [0, 0, 1, 1] }, 0)).toBeNull()
  })

  it('buildNoteThreads 组织回复层级并 flattenThread 深度展开', () => {
    const root: SavedNoteAnnot = {
      pageIndex: 0,
      objNum: 1,
      type: 'note',
      rect: [0, 0, 1, 1],
      color: null,
      author: '',
      contents: '根',
      timeMs: 1000,
      inReplyTo: null,
    }
    const reply: SavedNoteAnnot = { ...root, objNum: 2, contents: '回复', inReplyTo: 1, timeMs: 2000 }
    const threads = buildNoteThreads([root, reply], [])
    expect(threads).toHaveLength(1)
    expect(threads[0]?.replies).toHaveLength(1)
    const flat = flattenThread(threads[0]!)
    expect(flat.map((entry) => entry.item.saved?.contents)).toEqual(['根', '回复'])
    expect(flat[1]?.depth).toBe(1)
  })

  it('待落批注与已存批注共用键编码', () => {
    expect(savedNoteKey(7)).toBe('S7')
    expect(pendingNoteKey('local-1')).toBe('Plocal-1')
  })
})

describe('pdf 域：边栏卡片布局（note-margin-layout）', () => {
  const entries: MarginLayoutEntry[] = [
    { key: 'a', pinY: 100 },
    { key: 'b', pinY: 110 },
    { key: 'c', pinY: 300 },
  ]
  const height = (key: string): number => (key === 'b' ? 30 : 20)

  it('无锚点时自上而下消除重叠（对齐位 86/96/286，间距 10）', () => {
    const tops = layoutMarginCards(entries, height, null)
    expect(tops.get('a')).toBe(86)
    // b 的对齐位 96 与 a（86+20=106 底 + 10 间距）冲突 → 推到 116
    expect(tops.get('b')).toBe(116)
    expect(tops.get('c')).toBe(286)
  })

  it('有锚点时锚点固定于对齐位、上方上推、下方保持', () => {
    const tops = layoutMarginCards(entries, height, 'b')
    expect(tops.get('b')).toBe(96)
    // a 需在 b（96）之上留出间距：96-10-20=66
    expect(tops.get('a')).toBe(66)
    // c 的对齐位 286 无冲突保持
    expect(tops.get('c')).toBe(286)
  })
})

describe('pdf 域：文本换行（text-wrap，jsdom 无 canvas 量测回退）', () => {
  it('unifyRadicals 归一部首变体（部首区外原样通过）', () => {
    expect(unifyRadicals('「薯片」')).toBe('「薯片」')
    // U+2E81（⼢部「厂」变体）映射回 U+5382
    expect(unifyRadicals('\u2e81')).toBe('厂')
    expect(unifyRadicals('普通文本')).toBe('普通文本')
  })

  it('wrapText 按量测宽度折行', () => {
    // 无 canvas 环境下 measurePt 退化为 length × fontSize × 0.5
    const lines = wrapText('aaa bbb ccc ddd', 40, 10, 'Arial')
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ').split(/\s+/)).toEqual(['aaa', 'bbb', 'ccc', 'ddd'])
  })
})

describe('pdf 域：文本行分组（text-line，jsdom 无布局回退单 span 组）', () => {
  it('无布局引擎（client rect 全零）时保底为单 span 组', () => {
    const anchor = document.createElement('span')
    anchor.textContent = '薯片批注行'
    const layer = document.createElement('div')
    layer.className = 'textLayer'
    layer.appendChild(anchor)
    document.body.appendChild(layer)
    const group = groupLineSpans(anchor)
    expect(group.spans).toEqual([anchor])
    expect(group.text).toBe('薯片批注行')
    expect(group.starts).toEqual([0])
    anchor.remove()
  })

  it('锚点不在 textLayer 内时同样保底单 span 组', () => {
    const anchor = document.createElement('span')
    anchor.textContent = '游离节点'
    document.body.appendChild(anchor)
    const group = groupLineSpans(anchor)
    expect(group.text).toBe('游离节点')
    anchor.remove()
  })
})

describe('pdf 域：阅读位置存取（view-state，注入存储）', () => {
  it('saveViewState 写入、loadViewState 读回并做净化裁剪', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string): string | null => store.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        store.set(key, value)
      },
    }
    const state: PdfViewState = { page: 2, frac: 0.5, scale: 1.25, fitMode: 'width' }
    saveViewState('/docs/示例.pdf', state, storage)
    expect(store.has(VIEW_STATE_KEY)).toBe(true)
    // 读回剥离内部时间戳（at 仅用于 LRU）
    expect(loadViewState('/docs/示例.pdf', storage)).toEqual(state)
    expect(loadViewState('/docs/未读.pdf', storage)).toBeNull()
  })

  it('损坏条目按 null 处理（不信任磁盘态）', () => {
    const store = new Map<string, string>([
      [VIEW_STATE_KEY, JSON.stringify({ '/bad.pdf': { page: -1, scale: 1 } })],
    ])
    const storage = {
      getItem: (key: string): string | null => store.get(key) ?? null,
      setItem: (): void => undefined,
    }
    expect(loadViewState('/bad.pdf', storage)).toBeNull()
  })
})
