/**
 * 分页同步：量测画布块级几何 → 分页切片 → 构建页间隙装饰。
 * 全流程纯浏览器 DOM 量测，使用移植自 GenOffice 的分页引擎。
 */
import type { Editor } from '@tiptap/core'
import type { SectionInfo } from '@genoffice/docx-engine'
import {
  assignSections,
  effectiveBottomPx,
  effectiveTopPx,
  lineStartAnchor,
  measureBlocks,
  nextLineAnchor,
  pageAt,
  sectionGeoms,
  sliceWithLineSplit,
  type BlockBox,
  type LineAnchor,
  type PageSlice,
} from './pagination'
import { setPageGaps, type PageGapSpec } from './pagination-gaps'

const twipsToPx = (twips: number): number => (twips / 1440) * 96

function posFromAnchor(view: Editor['view'], anchor: LineAnchor): number | undefined {
  try {
    const pos =
      anchor.node instanceof Element
        ? anchor.node.parentNode
          ? view.posAtDOM(
              anchor.node.parentNode,
              Array.prototype.indexOf.call(anchor.node.parentNode.childNodes, anchor.node),
            )
          : -1
        : view.posAtDOM(anchor.node, anchor.charOffset)
    return pos >= 0 ? pos : undefined
  } catch {
    return undefined
  }
}

/**
 * 单次分页同步：返回切片（页数与当前页定位的来源），并把页间隙装饰
 * 重建进编辑器视图。文档为空或尚未装载时清空间隙。
 */
export function syncPageGaps(
  editor: Editor,
  sections: SectionInfo[],
  zoomFactor: number,
): PageSlice[] {
  const pm = editor.view.dom as HTMLElement
  if (!pm || editor.state.doc.childCount === 0) {
    setPageGaps(editor.view, [])
    return []
  }

  const pmRect = pm.getBoundingClientRect()
  const first = sections[0]?.settings
  const mTopPx = first ? effectiveTopPx(first, 0) : 0
  const origin = pmRect.top + mTopPx * zoomFactor
  const measured = measureBlocks(pm, origin, zoomFactor)
  const blocks: BlockBox[] = measured.blocks

  const secList = sections.length > 0 ? sections : null
  if (secList) {
    assignSections(blocks, secList)
  } else {
    for (const b of blocks) b.section = 0
  }

  const geoms = sectionGeoms(secList ?? [])
  // 无分节信息时退化单节几何（A4 默认由调用方传入的 sections 保证存在）
  if (geoms.length === 0) {
    setPageGaps(editor.view, [])
    return []
  }
  const slices = sliceWithLineSplit(blocks, geoms, measured.totalHeight, zoomFactor)

  const gaps: PageGapSpec[] = []
  slices.slice(1).forEach((slice, k) => {
    const prev = slices[k]
    // 同起点的零高度前页是刻意空页（双分页符/奇偶节），需要保留间隙带；
    // 其余同起点重复只画一条
    if (slice.start === prev.start && prev.end > prev.start) return
    const nextSec = secList?.[slice.section]?.settings ?? first
    const prevSec = secList?.[prev.section]?.settings ?? first
    if (!nextSec || !prevSec) return

    // 间隙 = 前页有效下边距 + 灰带 + 本页有效上边距
    const metrics = {
      marginTop: effectiveTopPx(nextSec, 0),
      marginBottom: effectiveBottomPx(prevSec, 0),
      marginLeft: twipsToPx(nextSec.marginLeft),
      marginRight: twipsToPx(nextSec.marginRight),
    }

    // 定位切点：优先 page-leading 块（在其前插入），否则按行锚点定位
    const lead = blocks.find((b) => b.top >= slice.start - 0.5 && b.el)
    if (lead?.el) {
      gaps.push({ metrics, el: lead.el, boundaryY: slice.start })
      return
    }

    // 行级切点：在边界块内部定位第一行
    const crossing = blocks.find(
      (b) => b.el && b.top < slice.start && b.top + b.height > slice.start,
    )
    if (!crossing?.el) return
    const offsetInBlock = slice.start - crossing.top - (crossing.spaceBeforePx ?? 0)
    const anchor =
      lineStartAnchor(crossing.el, offsetInBlock, zoomFactor) ??
      nextLineAnchor(crossing.el, offsetInBlock, zoomFactor)
    const pos = anchor ? posFromAnchor(editor.view, anchor) : undefined
    if (pos == null) return
    const elRect = crossing.el.getBoundingClientRect()
    gaps.push({
      pos,
      kind: 'inline',
      boundaryY: slice.start,
      metrics: {
        ...metrics,
        marginLeft: (elRect.left - pmRect.left) / zoomFactor,
        marginRight: (pmRect.right - elRect.right) / zoomFactor,
      },
    })
  })

  setPageGaps(editor.view, gaps)
  return slices
}

/** 当前页码（1 起）。 */
export function currentPageOf(slices: PageSlice[], flowY: number): number {
  if (slices.length === 0) return 1
  return Math.max(1, Math.min(pageAt(slices, flowY), slices.length))
}
