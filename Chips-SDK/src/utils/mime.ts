/**
 * MIME 猜测公共工具（渲染进程侧 / SDK 侧实现）
 *
 * 生态统一 MIME 猜测表（见工单154）：与 `chips-host` 主进程侧 `src/shared/mime.ts`
 * 保持同语义。渲染进程侧消费方（应用插件等）使用本模块。
 * 两侧实现必须保持一致，任何一侧变更须同步另一侧并更新对应契约测试。
 */

const MIME_BY_EXTENSION: Array<[extensions: string[], mime: string]> = [
  [["png"], "image/png"],
  [["jpg", "jpeg"], "image/jpeg"],
  [["gif"], "image/gif"],
  [["webp"], "image/webp"],
  [["svg"], "image/svg+xml"],
  [["bmp"], "image/bmp"],
  [["avif"], "image/avif"],
  [["tiff", "tif"], "image/tiff"],
  [["html", "htm"], "text/html"],
  [["css"], "text/css"],
  [["js"], "text/javascript"],
  [["json"], "application/json"],
  [["yaml", "yml"], "application/yaml"],
  [["pdf"], "application/pdf"],
  [["doc"], "application/msword"],
  [["docx"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [["mp4"], "video/mp4"],
  [["webm"], "video/webm"],
  [["mov"], "video/quicktime"],
  [["ogg"], "video/ogg"],
  [["mp3"], "audio/mpeg"],
  [["wav"], "audio/wav"],
  [["m4a"], "audio/mp4"],
  [["aac"], "audio/aac"],
  [["txt"], "text/plain"],
  [["md"], "text/markdown"],
];

/** 按扩展名猜测 MIME；无法识别时返回 application/octet-stream。 */
export function guessMimeType(resourcePath: string): string {
  const normalized = resourcePath.toLowerCase();
  for (const [extensions, mime] of MIME_BY_EXTENSION) {
    if (extensions.some((extension) => normalized.endsWith(`.${extension}`))) {
      return mime;
    }
  }
  return "application/octet-stream";
}
