/**
 * TIFF → PNG 转码（浏览器渲染进程版）。Chromium 无法解码 TIFF，ppt/media/*.tif(f)
 * 的图片会渲染为空白占位；使用纯 JS 的 UTIF（utif2）解码为 RGBA，再经 canvas 编码为
 * PNG 供显示。包内保留原始 TIFF 字节，保存时逐字节透传。
 * （原版在 Electron 主进程用 pngjs 编码；浏览器端以 canvas 等价替换。）
 */
import UTIF from 'utif2'

export interface DecodedTiff {
  png: Uint8Array
  width: number
  height: number
}

/** RGBA 像素 → PNG 字节（canvas 编码，浏览器等价于原版 pngjs.sync.write）。 */
function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array | null {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const image = ctx.createImageData(width, height)
  image.data.set(rgba)
  ctx.putImageData(image, 0, 0)
  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = globalThis.atob(base64)
  const png = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) png[i] = binary.charCodeAt(i)
  return png
}

export function tiffToPng(bytes: Uint8Array): DecodedTiff | null {
  try {
    const buffer = bytes.slice().buffer as ArrayBuffer
    const ifds = UTIF.decode(buffer)
    if (!ifds.length) return null
    // 多页/多分辨率 TIFF：选取像素数最大的一页
    let page = ifds[0]!
    for (const ifd of ifds) {
      UTIF.decodeImage(buffer, ifd)
      const cur = (ifd.width || 0) * (ifd.height || 0)
      if (cur > (page.width || 0) * (page.height || 0)) page = ifd
    }
    const width = page.width
    const height = page.height
    if (!width || !height) return null
    const rgba = UTIF.toRGBA8(page)
    const png = encodePng(width, height, new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength))
    if (!png) return null
    return { png, width, height }
  } catch {
    return null
  }
}
