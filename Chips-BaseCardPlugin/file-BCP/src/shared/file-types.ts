export type FileCategory =
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "audio"
  | "video"
  | "image"
  | "text"
  | "code";

export const FILE_CATEGORY_ORDER: readonly FileCategory[] = [
  "document",
  "spreadsheet",
  "presentation",
  "archive",
  "audio",
  "video",
  "image",
  "text",
  "code",
];

const CATEGORY_EXTENSIONS: Record<FileCategory, readonly string[]> = {
  document: [
    "pdf",
    "doc",
    "docx",
    "dot",
    "dotx",
    "docm",
    "odt",
    "ott",
    "rtf",
    "pages",
    "epub",
    "mobi",
    "azw",
    "azw3",
    "fb2",
    "djvu",
    "djv",
  ],
  spreadsheet: [
    "xls",
    "xlsx",
    "xlsm",
    "xlsb",
    "xlt",
    "xltx",
    "ods",
    "ots",
    "csv",
    "tsv",
    "numbers",
  ],
  presentation: [
    "ppt",
    "pptx",
    "pptm",
    "pot",
    "potx",
    "odp",
    "otp",
    "key",
  ],
  archive: [
    "zip",
    "rar",
    "7z",
    "tar",
    "gz",
    "bz2",
    "xz",
    "zst",
    "lzma",
    "tgz",
    "tbz",
    "txz",
    "cbz",
    "cbr",
    "cb7",
    "iso",
    "dmg",
  ],
  audio: [
    "mp3",
    "wav",
    "flac",
    "m4a",
    "aac",
    "ogg",
    "oga",
    "opus",
    "wma",
    "aiff",
    "aif",
    "ape",
    "mid",
    "midi",
  ],
  video: [
    "mp4",
    "m4v",
    "mov",
    "mkv",
    "avi",
    "webm",
    "wmv",
    "flv",
    "mpg",
    "mpeg",
    "mts",
    "m2ts",
    "ts",
    "3gp",
  ],
  image: [
    "png",
    "jpg",
    "jpeg",
    "jpe",
    "gif",
    "webp",
    "bmp",
    "svg",
    "tiff",
    "tif",
    "avif",
    "heic",
    "heif",
    "ico",
    "psd",
    "ai",
    "eps",
    "raw",
    "cr2",
    "nef",
  ],
  text: [
    "txt",
    "text",
    "md",
    "markdown",
    "log",
    "lrc",
    "srt",
    "vtt",
    "nfo",
  ],
  code: [
    "js",
    "mjs",
    "cjs",
    "jsx",
    "ts",
    "mts",
    "cts",
    "tsx",
    "json",
    "jsonc",
    "json5",
    "html",
    "htm",
    "css",
    "scss",
    "sass",
    "less",
    "vue",
    "svelte",
    "py",
    "pyw",
    "rb",
    "go",
    "rs",
    "java",
    "kt",
    "kts",
    "scala",
    "php",
    "swift",
    "c",
    "h",
    "cpp",
    "cc",
    "cxx",
    "hpp",
    "cs",
    "m",
    "mm",
    "sh",
    "bash",
    "zsh",
    "fish",
    "bat",
    "cmd",
    "ps1",
    "sql",
    "xml",
    "yml",
    "yaml",
    "toml",
    "ini",
    "cfg",
    "conf",
    "lua",
    "pl",
    "r",
    "dart",
    "vim",
    "dockerfile",
    "makefile",
    "gradle",
    "proto",
    "graphql",
  ],
};

const EXTENSION_CATEGORY_MAP: Map<string, FileCategory> = (() => {
  const map = new Map<string, FileCategory>();
  (Object.entries(CATEGORY_EXTENSIONS) as Array<[FileCategory, readonly string[]]>).forEach(
    ([category, extensions]) => {
      extensions.forEach((extension) => {
        if (!map.has(extension)) {
          map.set(extension, category);
        }
      });
    },
  );
  return map;
})();

const EXTENSION_MIME_MAP: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  bz2: "application/x-bzip2",
  xz: "application/x-xz",
  iso: "application/x-iso9660-image",
  dmg: "application/x-apple-diskimage",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  aiff: "audio/aiff",
  mid: "audio/midi",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  webm: "video/webm",
  wmv: "video/x-ms-wmv",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  "3gp": "video/3gpp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  tiff: "image/tiff",
  tif: "image/tiff",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  ico: "image/x-icon",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  json: "application/json",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
  toml: "application/toml",
  epub: "application/epub+zip",
  psd: "image/vnd.adobe.photoshop",
};

export function normalizeExtension(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase().replace(/^\./u, "").replace(/[^a-z0-9]/gu, "");
}

export function resolveFileCategory(fileExtension: string): FileCategory | undefined {
  const normalized = normalizeExtension(fileExtension);
  if (!normalized) {
    return undefined;
  }

  return EXTENSION_CATEGORY_MAP.get(normalized);
}

export function inferFileMimeType(fileExtension: string): string | undefined {
  const normalized = normalizeExtension(fileExtension);
  if (!normalized) {
    return undefined;
  }

  return EXTENSION_MIME_MAP[normalized];
}
