/**
 * 增量图片加载（渲染进程版，移植自 GenOffice Slides 的 image-loader）：解码完成的
 * 图片分小批量上屏，而不是等待整份文档就绪。跨调用记录已加载/加载中的 url，
 * 编辑后重新收集 url 不会重复加载或丢弃进度。
 * 浏览器无法解码 EMF/WMF 图元文件（原版经 docx-engine 光栅化；本移植不引入该
 * 依赖），此类图片按加载失败处理并保持占位。
 */
import type { RenderFill, RenderNode, RenderSlide } from '@genoffice/pptx-render'

export type ApplyImages = (entries: ReadonlyArray<readonly [string, HTMLImageElement]>) => void

const METAFILE_RE = /^data:(image\/x-(?:emf|wmf)|image\/(?:emf|wmf));base64,/

export function createImageLoader(apply: ApplyImages, batchSize = 16, delayMs = 100) {
  const loaded = new Map<string, HTMLImageElement>()
  const loading = new Set<string>()
  const buf = new Map<string, HTMLImageElement>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (disposed || buf.size === 0) return
    const entries = [...buf]
    buf.clear()
    apply(entries)
  }

  return {
    load(urls: Iterable<string>) {
      for (const u of urls) {
        if (loaded.has(u) || loading.has(u) || METAFILE_RE.test(u)) continue
        loading.add(u)
        const img = new Image()
        const done = (ok: boolean) => {
          loading.delete(u)
          if (ok) {
            loaded.set(u, img)
            if (!disposed) buf.set(u, img)
          }
          if (buf.size >= batchSize || loading.size === 0) flush()
          else if (!timer && buf.size > 0) timer = setTimeout(flush, delayMs)
        }
        img.onload = () => done(true)
        img.onerror = () => done(false)
        img.src = u
      }
    },
    // 仅防范卸载后的 setState；在途加载继续写入 `loaded`
    dispose() {
      disposed = true
      if (timer) clearTimeout(timer)
    },
  }
}

/** 从 RenderSlide 树收集全部图片 dataUrl（图片元素 + 图片填充 + 背景图，递归组与表格单元格）。 */
export function collectSlideImageUrls(slides: RenderSlide[]): string[] {
  const urls = new Set<string>()
  const addFillUrl = (fill: RenderFill | undefined) => {
    if (fill && fill.kind === 'image' && fill.dataUrl) urls.add(fill.dataUrl)
  }
  const walk = (nodes: readonly RenderNode[]) => {
    for (const n of nodes) {
      if (n.type === 'picture' && n.dataUrl) urls.add(n.dataUrl)
      if ((n.type === 'shape' || n.type === 'text') && n.fill) addFillUrl(n.fill)
      if (n.type === 'chart') addFillUrl((n as { bgFill?: RenderFill }).bgFill)
      if (n.type === 'group' && Array.isArray(n.children)) walk(n.children)
      if (n.type === 'table' && Array.isArray(n.cells)) {
        for (const c of n.cells) if (c.fill) addFillUrl(c.fill)
      }
    }
  }
  for (const s of slides) {
    addFillUrl(s.background)
    walk(s.nodes)
  }
  return [...urls]
}
