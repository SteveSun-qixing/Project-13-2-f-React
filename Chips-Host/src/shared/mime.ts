/**
 * MIME 猜测公共工具（主进程侧实现）
 *
 * 生态统一 MIME 猜测表（见工单154）：所有按扩展名推断 MIME 的消费方必须
 * 使用本实现，禁止各自维护私有 MIME 表。
 */

const MIME_BY_EXTENSION: Array<[extensions: string[], mime: string]> = [
  [['png'], 'image/png'],
  [['jpg', 'jpeg'], 'image/jpeg'],
  [['gif'], 'image/gif'],
  [['webp'], 'image/webp'],
  [['svg'], 'image/svg+xml'],
  [['bmp'], 'image/bmp'],
  [['avif'], 'image/avif'],
  [['tiff', 'tif'], 'image/tiff'],
  [['html', 'htm'], 'text/html'],
  [['css'], 'text/css'],
  [['js'], 'text/javascript'],
  [['json'], 'application/json'],
  [['yaml', 'yml'], 'application/yaml'],
  [['pdf'], 'application/pdf'],
  [['doc'], 'application/msword'],
  [['docx'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  [['mp4'], 'video/mp4'],
  [['webm'], 'video/webm'],
  [['mov'], 'video/quicktime'],
  [['ogg'], 'video/ogg'],
  [['mp3'], 'audio/mpeg'],
  [['wav'], 'audio/wav'],
  [['m4a'], 'audio/mp4'],
  [['aac'], 'audio/aac'],
  [['txt'], 'text/plain'],
  [['md'], 'text/markdown'],
];

/** 按扩展名猜测 MIME；无法识别时返回 application/octet-stream。 */
export const guessMimeType = (resourcePath: string): string => {
  const normalized = resourcePath.toLowerCase();
  for (const [extensions, mime] of MIME_BY_EXTENSION) {
    if (extensions.some((extension) => normalized.endsWith(`.${extension}`))) {
      return mime;
    }
  }
  return 'application/octet-stream';
};
