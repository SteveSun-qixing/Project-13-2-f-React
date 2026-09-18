/**
 * MIME 猜测公共工具（主进程侧实现）
 *
 * 生态统一 MIME 猜测表（见工单154）：所有按扩展名推断 MIME 的消费方必须
 * 使用本实现，禁止各自维护私有 MIME 表。
 */

/**
 * Public extension table. Keep the same entries and ordering in the SDK
 * browser helper so Host and plugin-side inference cannot drift.
 */
export const MIME_BY_EXTENSION: ReadonlyArray<readonly [readonly string[], string]> = [
  [['card'], 'application/vnd.chips.card+zip'],
  [['box'], 'application/vnd.chips.box+zip'],
  [['png'], 'image/png'],
  [['jpg', 'jpeg'], 'image/jpeg'],
  [['gif'], 'image/gif'],
  [['webp'], 'image/webp'],
  [['svg'], 'image/svg+xml'],
  [['bmp'], 'image/bmp'],
  [['avif'], 'image/avif'],
  [['tiff', 'tif'], 'image/tiff'],
  [['heic'], 'image/heic'],
  [['ico'], 'image/x-icon'],
  [['html', 'htm'], 'text/html'],
  [['css'], 'text/css'],
  [['js', 'mjs', 'cjs'], 'text/javascript'],
  [['json'], 'application/json'],
  [['yaml', 'yml'], 'application/yaml'],
  [['xml'], 'application/xml'],
  [['pdf'], 'application/pdf'],
  [['epub', 'epub3'], 'application/epub+zip'],
  [['mobi'], 'application/x-mobipocket-ebook'],
  [['azw', 'azw3'], 'application/vnd.amazon.ebook'],
  [['fb2'], 'application/x-fictionbook+xml'],
  [['djv', 'djvu'], 'image/vnd.djvu'],
  [['doc'], 'application/msword'],
  [['docx'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  [['docm'], 'application/vnd.ms-word.document.macroenabled.12'],
  [['dot', 'dotx', 'dotm'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.template'],
  [['rtf'], 'application/rtf'],
  [['odt'], 'application/vnd.oasis.opendocument.text'],
  [['ppt'], 'application/vnd.ms-powerpoint'],
  [['pptx'], 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  [['pptm'], 'application/vnd.ms-powerpoint.presentation.macroenabled.12'],
  [['pot', 'potx', 'potm'], 'application/vnd.openxmlformats-officedocument.presentationml.template'],
  [['odp'], 'application/vnd.oasis.opendocument.presentation'],
  [['xls'], 'application/vnd.ms-excel'],
  [['xlsx'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  [['xlsm'], 'application/vnd.ms-excel.sheet.macroenabled.12'],
  [['xlsb'], 'application/vnd.ms-excel.sheet.binary.macroenabled.12'],
  [['xlt', 'xltx', 'xltm'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.template'],
  [['ods'], 'application/vnd.oasis.opendocument.spreadsheet'],
  [['csv'], 'text/csv'],
  [['tsv'], 'text/tab-separated-values'],
  [['zip'], 'application/zip'],
  [['cpk'], 'application/zip'],
  [['7z'], 'application/x-7z-compressed'],
  [['tar'], 'application/x-tar'],
  [['gz'], 'application/gzip'],
  [['rar'], 'application/vnd.rar'],
  [['mp4'], 'video/mp4'],
  [['webm'], 'video/webm'],
  [['mov'], 'video/quicktime'],
  [['mkv'], 'video/x-matroska'],
  [['ogg', 'ogv'], 'video/ogg'],
  [['mp3'], 'audio/mpeg'],
  [['wav'], 'audio/wav'],
  [['m4a'], 'audio/mp4'],
  [['aac'], 'audio/aac'],
  [['flac'], 'audio/flac'],
  [['txt'], 'text/plain'],
  [['md', 'markdown'], 'text/markdown'],
  [['log'], 'text/plain'],
  [['woff'], 'font/woff'],
  [['woff2'], 'font/woff2'],
  [['ttf'], 'font/ttf'],
  [['otf'], 'font/otf'],
];

const normalizeResourcePath = (resourcePath: string): string => {
  const withoutFragment = resourcePath.trim().split(/[?#]/, 1)[0] ?? '';
  return withoutFragment.toLowerCase();
};

/** Return the normalized extension without the leading dot. */
export const getFileExtension = (resourcePath: string): string | null => {
  const normalized = normalizeResourcePath(resourcePath).replace(/[\\/]$/, '');
  const fileName = normalized.slice(Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\')) + 1);
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) {
    return null;
  }
  return fileName.slice(dot + 1);
};

/** 按扩展名猜测 MIME；无法识别时返回 application/octet-stream。 */
export const guessMimeType = (resourcePath: string): string => {
  const extension = getFileExtension(resourcePath);
  if (!extension) {
    return 'application/octet-stream';
  }
  for (const [extensions, mime] of MIME_BY_EXTENSION) {
    if (extensions.includes(extension)) {
      return mime;
    }
  }
  return 'application/octet-stream';
};
