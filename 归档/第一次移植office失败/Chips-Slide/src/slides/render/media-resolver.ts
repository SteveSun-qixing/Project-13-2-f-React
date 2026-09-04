/**
 * 图片媒体引用 → data URL（渲染进程本地版，移植自 GenOffice Slides 主进程的
 * makeMediaResolver / retintThemedSvg，Buffer 调用已替换为浏览器字节工具）。
 * TIFF 转码为 PNG 显示（Chromium 不能解码）；归档保留原始字节保证保存保真。
 * mime 以魔数嗅探优先（旧文件常误标扩展名），扩展名兜底。
 */
import {
  base64Encode,
  parseClrMap,
  parseTheme,
  resolveSchemeColor,
  utf8Decode,
  utf8Encode,
  type OpenedPptx,
} from '@genoffice/pptx-engine'
import { displayMime } from './media-mime'
import { tiffToPng } from './tiff-decode'
import { neutralizeJpegOrientation } from './jpeg-orientation'

/** Office 主题类插槽（MsftOfcThm_<slot>_Fill/_Stroke）→ schemeClr 名称。 */
const SVG_THEME_SLOTS: Record<string, string> = {
  background1: 'bg1',
  text1: 'tx1',
  background2: 'bg2',
  text2: 'tx2',
  accent1: 'accent1',
  accent2: 'accent2',
  accent3: 'accent3',
  accent4: 'accent4',
  accent5: 'accent5',
  accent6: 'accent6',
  hyperlink: 'hlink',
  followedhyperlink: 'folHlink',
}

/**
 * Office 导出的 SVG 携带 `.MsftOfcThm_<slot>_Fill/_Stroke` CSS 类，其烘焙色会被
 * PowerPoint 在渲染时改写为当前主题色（静态值只是导出时的快照）。服务该 SVG 前
 * 镜像这一改写。
 */
export function retintThemedSvg(svg: string, opened: OpenedPptx, slidePath?: string): string {
  const path = slidePath ?? opened.deck.slides[0]?.path
  if (!path) return svg
  let theme
  try {
    const chain = opened.archive.resolveSlideChain(path)
    const themeXml = chain.themePath ? opened.archive.readText(chain.themePath) : null
    if (!themeXml) return svg
    theme = parseTheme(themeXml)
    const masterXml = chain.masterPath ? opened.archive.readText(chain.masterPath) : undefined
    const layoutXml = chain.layoutPath ? opened.archive.readText(chain.layoutPath) : undefined
    theme.clrMap = parseClrMap(
      masterXml ?? undefined,
      layoutXml ?? undefined,
      opened.archive.readText(path) ?? undefined,
    )
  } catch {
    return svg
  }
  return svg.replace(
    /\.MsftOfcThm_(\w+?)_(Fill|Stroke)\w*\s*\{[^}]*\}/g,
    (rule, slot: string, kind: string) => {
      const scheme = SVG_THEME_SLOTS[slot.toLowerCase()]
      const color = scheme ? resolveSchemeColor(scheme, theme) : undefined
      if (!color) return rule
      const prop = kind === 'Stroke' ? 'stroke' : 'fill'
      return rule.replace(new RegExp(`${prop}\\s*:\\s*[^;}]+`, 'g'), `${prop}:${color}`)
    },
  )
}

/** 构建一个（按 slidePath 缓存的）图片解析器：mediaRef → dataUrl。 */
export function makeMediaResolver(opened: OpenedPptx, slidePath?: string) {
  const cache = new Map<string, string | undefined>()
  return (mediaRef: string): string | undefined => {
    if (cache.has(mediaRef)) return cache.get(mediaRef)
    const bytes = opened.archive.readBytes(mediaRef)
    let url: string | undefined
    if (bytes) {
      const mime = displayMime(mediaRef, bytes)
      if (mime === 'image/tiff') {
        const decoded = tiffToPng(bytes)
        if (decoded) url = `data:image/png;base64,${base64Encode(decoded.png)}`
      } else if (mime === 'image/svg+xml') {
        let text = utf8Decode(bytes)
        if (text.includes('MsftOfcThm_')) text = retintThemedSvg(text, opened, slidePath)
        url = `data:${mime};base64,${base64Encode(utf8Encode(text))}`
      } else {
        // PowerPoint 忽略 EXIF 方向；Chromium 解码时自动应用 —— 先中和该标记，
        // 避免旋转像素的 JPEG 叠加形状级 rot 后双重旋转
        const served = mime === 'image/jpeg' ? neutralizeJpegOrientation(bytes) : bytes
        url = `data:${mime};base64,${base64Encode(served)}`
      }
    }
    cache.set(mediaRef, url)
    return url
  }
}
