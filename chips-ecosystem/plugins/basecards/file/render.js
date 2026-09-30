import { jsx as r, jsxs as a, Fragment as j } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { flushSync as M } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as L } from "chips-resource://platform/vendor/react-dom-client.js";
import D, { useState as K, useRef as H } from "chips-resource://platform/vendor/react.js";
import { theme as h, Empty as P, FileOutlined as V, Input as E } from "chips-resource://platform/vendor/chips-ui.js";
class d extends Error {
  code;
  details;
  retryable;
  constructor(e) {
    super(e.message), this.name = "ChipsError", this.code = e.code, this.details = e.details, this.retryable = e.retryable ?? !1;
  }
  /** 归一为结构化克隆兼容的普通对象，用于跨 IPC / Neon 传输。 */
  toPlain() {
    const e = {
      code: this.code,
      message: this.message,
      retryable: this.retryable
    };
    return this.details !== void 0 && (e.details = this.details), e;
  }
  static fromPlain(e) {
    return new d({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function G(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const $ = "SDK_BRIDGE_UNAVAILABLE", z = "SDK_UNKNOWN_ERROR", T = "发生未知错误";
function q(t) {
  return t instanceof Error;
}
function X(t) {
  if (t instanceof d)
    return t;
  if (G(t)) {
    const e = t, i = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new d(i);
  }
  return q(t) ? new d({
    code: z,
    message: T,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new d({
    code: z,
    message: T,
    details: { value: String(t) },
    retryable: !1
  });
}
function Z() {
  return new d({
    code: $,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function s(t, e, i) {
  let n;
  try {
    n = t();
  } catch (o) {
    return Promise.reject(X(o));
  }
  return n.request(e, i);
}
const Y = "cli.command.list", Q = "cli.command.get", J = "cli.command.resolve";
function ee(t) {
  return {
    list(e) {
      return s(t, Y, e ?? {});
    },
    get(e) {
      return s(t, Q, e);
    },
    resolve(e) {
      return s(t, J, e);
    }
  };
}
const u = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, te = "cli.task.create", ie = "cli.task.bindInvocation", ne = "cli.task.cancel";
function re(t) {
  return {
    create(e) {
      return s(t, te, e).then((i) => i.task);
    },
    bindInvocation(e) {
      return s(t, ie, e).then((i) => i.task);
    },
    get(e) {
      const i = { taskId: e };
      return s(t, u.CLI_TASK_GET, i).then((n) => n.task);
    },
    active(e) {
      const i = { commandId: e };
      return s(t, u.CLI_TASK_ACTIVE, i).then((n) => n.task);
    },
    progress(e, i) {
      const n = { taskId: e, progress: i };
      return s(t, u.CLI_TASK_PROGRESS, n).then((o) => o.task);
    },
    complete(e, i) {
      const n = {
        taskId: e,
        ...i === void 0 ? {} : { output: i }
      };
      return s(t, u.CLI_TASK_COMPLETE, n).then((o) => o.task);
    },
    fail(e, i) {
      const n = { taskId: e, error: i };
      return s(t, u.CLI_TASK_FAIL, n).then((o) => o.task);
    },
    cancel(e) {
      return s(t, ne, { taskId: e }).then((i) => i.task);
    }
  };
}
function oe() {
  return globalThis.window?.chips;
}
class se {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = ee(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = re(() => this.#e());
  constructor(e) {
    this.#t = e;
  }
  /**
   * 解析本次调用的目标 Bridge。
   *
   * @returns 注入目标或当前 `window.chips`
   * @throws ChipsError 两者均不可用时抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  #e() {
    if (this.#t !== void 0)
      return this.#t;
    const e = oe();
    if (e === void 0)
      throw Z();
    return e;
  }
  /**
   * 唯一能力调用入口；转发给目标 Bridge。
   *
   * @param capabilityId - 能力 ID（`<domain>:<action>[:<target>]`）
   * @param input - 能力输入，校验与权限判定由平台完成
   * @returns 能力输出；目标不可用或平台调用失败时以 `ChipsError` 拒绝
   */
  request(e, i) {
    return s(() => this.#e(), e, i);
  }
  /**
   * 订阅标准事件；转发给目标 Bridge。
   *
   * @param eventId - 事件 ID
   * @param handler - 载荷回调；同一 `(eventId, handler)` 多次订阅各自独立
   * @returns 可退订句柄，`dispose()` 幂等
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  subscribe(e, i) {
    return this.#e().subscribe(e, i);
  }
  /**
   * 创建 `chips-resource://` 懒打开句柄；转发给目标 Bridge。
   *
   * @param uri - 资源 URI
   * @returns 资源句柄；预检失败由目标同步抛出 `ChipsError`
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  resource(e) {
    return this.#e().resource(e);
  }
}
function ae(t) {
  return new se(t?.bridge);
}
const le = ae(), ce = {
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
    "djv"
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
    "numbers"
  ],
  presentation: [
    "ppt",
    "pptx",
    "pptm",
    "pot",
    "potx",
    "odp",
    "otp",
    "key"
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
    "dmg"
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
    "midi"
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
    "3gp"
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
    "nef"
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
    "nfo"
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
    "graphql"
  ]
}, de = (() => {
  const t = /* @__PURE__ */ new Map();
  return Object.entries(ce).forEach(
    ([e, i]) => {
      i.forEach((n) => {
        t.has(n) || t.set(n, e);
      });
    }
  ), t;
})(), fe = {
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
  psd: "image/vnd.adobe.photoshop"
};
function k(t) {
  return typeof t != "string" ? "" : t.trim().toLowerCase().replace(/^\./u, "").replace(/[^a-z0-9]/gu, "");
}
function he(t) {
  const e = k(t);
  if (e)
    return de.get(e);
}
function pe(t) {
  const e = k(t);
  if (e)
    return fe[e];
}
function b(t) {
  return typeof t == "string" && t.trim().length > 0;
}
function v(t) {
  if (!b(t))
    return;
  const e = t.trim();
  if (!e || e.includes("\\") || e.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(e) || e.includes("?") || e.includes("#"))
    return;
  const i = e.replace(/^\.\//, "");
  if (!i)
    return;
  const n = i.split("/").filter(Boolean);
  if (!(n.length === 0 || n.some((o) => o === "." || o === "..")))
    return n.join("/");
}
function S(t) {
  const e = v(t);
  if (!e)
    return "";
  const i = e.split("/");
  return i[i.length - 1] ?? "";
}
function ge(t) {
  return t.replace(/\.[^.]+$/u, "");
}
function O(t) {
  return /\.([^.]+)$/u.exec(S(t))?.[1]?.toLowerCase() ?? "";
}
function B(t) {
  const e = S(t);
  return e ? ge(e) : "";
}
function me(t) {
  const e = t.trim().toLowerCase().replace(/^\./u, "");
  return e ? e.slice(0, 4).toUpperCase() : "";
}
const N = "base.file";
function ue(t) {
  return typeof t == "string" ? t.trim() : "";
}
function R(t) {
  return v(t) ?? "";
}
function f(t) {
  const e = typeof t == "object" && t !== null ? t : {}, i = R(e.file_file), n = k(e.file_extension);
  return {
    file_file: i,
    file_name: b(e.file_name) ? ue(e.file_name) : B(i),
    file_extension: n || O(i),
    cover_image: R(e.cover_image)
  };
}
function xe(t) {
  return t === void 0 ? !0 : typeof t != "string" ? !1 : t.trim().length === 0 ? !0 : v(t) !== void 0;
}
function ye(t) {
  if (t == null)
    return !0;
  if (typeof t != "object" || Array.isArray(t))
    return !1;
  const e = t;
  for (const n of ["file_file", "cover_image"])
    if (!xe(e[n]))
      return !1;
  for (const n of ["file_name", "file_extension"])
    if (e[n] !== void 0 && typeof e[n] != "string")
      return !1;
  const i = e.file_extension;
  return !(typeof i == "string" && i.length > 0 && !/^[a-z0-9]+$/u.test(i));
}
function _(t) {
  return b(t.file_name) ? t.file_name.trim() : B(t.file_file);
}
function F(t) {
  const e = v(t.file_file);
  if (!e)
    return null;
  const i = t.file_extension || O(t.file_file), n = pe(i);
  return {
    intent: "view",
    resource: {
      uri: e,
      ...n === void 0 ? {} : { mimeType: n },
      fileName: S(t.file_file),
      title: _(t) || "未命名文件"
    }
  };
}
const ve = "data:image/svg+xml,%3csvg%20width='96'%20height='96'%20viewBox='0%200%2096%2096'%20xmlns='http://www.w3.org/2000/svg'%3e%3crect%20x='4'%20y='4'%20width='88'%20height='88'%20rx='20'%20fill='%23f5f5f7'/%3e%3crect%20x='4.5'%20y='4.5'%20width='87'%20height='87'%20rx='19.5'%20fill='none'%20stroke='rgba(0,0,0,0.08)'/%3e%3crect%20x='26'%20y='30'%20width='44'%20height='10'%20rx='3'%20fill='%23ffffff'%20stroke='%23ac8e68'%20stroke-width='3'/%3e%3crect%20x='28'%20y='46'%20width='40'%20height='22'%20rx='3'%20fill='%23ffffff'%20stroke='%23ac8e68'%20stroke-width='3'/%3e%3cline%20x1='48'%20y1='46'%20x2='48'%20y2='54'%20stroke='%23ac8e68'%20stroke-width='3'%20stroke-linecap='round'/%3e%3cline%20x1='48'%20y1='60'%20x2='48'%20y2='68'%20stroke='%23ac8e68'%20stroke-width='3'%20stroke-linecap='round'%20stroke-dasharray='1.5%204'/%3e%3c/svg%3e", we = "data:image/svg+xml,%3csvg%20width='96'%20height='96'%20viewBox='0%200%2096%2096'%20xmlns='http://www.w3.org/2000/svg'%3e%3crect%20x='4'%20y='4'%20width='88'%20height='88'%20rx='20'%20fill='%23f5f5f7'/%3e%3crect%20x='4.5'%20y='4.5'%20width='87'%20height='87'%20rx='19.5'%20fill='none'%20stroke='rgba(0,0,0,0.08)'/%3e%3ccircle%20cx='40'%20cy='60'%20r='5'%20fill='%23ff375f'/%3e%3ccircle%20cx='56'%20cy='56'%20r='5'%20fill='%23ff375f'/%3e%3cpath%20d='M45%2060V36l16-4v24'%20fill='none'%20stroke='%23ff375f'%20stroke-width='3'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3c/svg%3e", ke = "data:image/svg+xml,%3csvg%20width='96'%20height='96'%20viewBox='0%200%2096%2096'%20xmlns='http://www.w3.org/2000/svg'%3e%3crect%20x='4'%20y='4'%20width='88'%20height='88'%20rx='20'%20fill='%23f5f5f7'/%3e%3crect%20x='4.5'%20y='4.5'%20width='87'%20height='87'%20rx='19.5'%20fill='none'%20stroke='rgba(0,0,0,0.08)'/%3e%3cpath%20d='M40%2036l-10%2012%2010%2012'%20fill='none'%20stroke='%235e5ce6'%20stroke-width='3.5'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3cpath%20d='M56%2036l10%2012-10%2012'%20fill='none'%20stroke='%235e5ce6'%20stroke-width='3.5'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3cline%20x1='50.5'%20y1='34'%20x2='45.5'%20y2='62'%20stroke='%235e5ce6'%20stroke-width='3.5'%20stroke-linecap='round'/%3e%3c/svg%3e", be = "data:image/svg+xml,%3csvg%20width='96'%20height='96'%20viewBox='0%200%2096%2096'%20xmlns='http://www.w3.org/2000/svg'%3e%3crect%20x='4'%20y='4'%20width='88'%20height='88'%20rx='20'%20fill='%23f5f5f7'/%3e%3crect%20x='4.5'%20y='4.5'%20width='87'%20height='87'%20rx='19.5'%20fill='none'%20stroke='rgba(0,0,0,0.08)'/%3e%3cpath%20d='M35%2026h18l9%209v31a4%204%200%200%201-4%204H35a4%204%200%200%201-4-4V30a4%204%200%200%201%204-4Z'%20fill='%23ffffff'%20stroke='%230a84ff'%20stroke-width='3'%20stroke-linejoin='round'/%3e%3cpath%20d='M53%2026v9h9'%20fill='none'%20stroke='%230a84ff'%20stroke-width='3'%20stroke-linejoin='round'/%3e%3cline%20x1='39'%20y1='46'%20x2='57'%20y2='46'%20stroke='%230a84ff'%20stroke-width='3'%20stroke-linecap='round'/%3e%3cline%20x1='39'%20y1='54'%20x2='57'%20y2='54'%20stroke='%230a84ff'%20stroke-width='3'%20stroke-linecap='round'/%3e%3cline%20x1='39'%20y1='62'%20x2='50'%20y2='62'%20stroke='%230a84ff'%20stroke-width='3'%20stroke-linecap='round'/%3e%3c/svg%3e", Se = "data:image/svg+xml,%3csvg%20width='96'%20height='96'%20viewBox='0%200%2096%2096'%20xmlns='http://www.w3.org/2000/svg'%3e%3crect%20x='4'%20y='4'%20width='88'%20height='88'%20rx='20'%20fill='%23f5f5f7'/%3e%3crect%20x='4.5'%20y='4.5'%20width='87'%20height='87'%20rx='19.5'%20fill='none'%20stroke='rgba(0,0,0,0.08)'/%3e%3crect%20x='26'%20y='30'%20width='44'%20height='36'%20rx='4'%20fill='%23ffffff'%20stroke='%2364d2ff'%20stroke-width='3'/%3e%3ccircle%20cx='38'%20cy='40'%20r='4'%20fill='%2364d2ff'/%3e%3cpath%20d='M31%2060L40%2050l6%206%206-6%2013%2010'%20fill='none'%20stroke='%2364d2ff'%20stroke-width='3'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3c/svg%3e", _e = "data:image/svg+xml,%3csvg%20width='96'%20height='96'%20viewBox='0%200%2096%2096'%20xmlns='http://www.w3.org/2000/svg'%3e%3crect%20x='4'%20y='4'%20width='88'%20height='88'%20rx='20'%20fill='%23f5f5f7'/%3e%3crect%20x='4.5'%20y='4.5'%20width='87'%20height='87'%20rx='19.5'%20fill='none'%20stroke='rgba(0,0,0,0.08)'/%3e%3crect%20x='26'%20y='28'%20width='44'%20height='30'%20rx='4'%20fill='%23ffffff'%20stroke='%23ff9f0a'%20stroke-width='3'/%3e%3crect%20x='34'%20y='44'%20width='6'%20height='8'%20rx='1.5'%20fill='%23ff9f0a'/%3e%3crect%20x='45'%20y='38'%20width='6'%20height='14'%20rx='1.5'%20fill='%23ff9f0a'/%3e%3crect%20x='56'%20y='42'%20width='6'%20height='10'%20rx='1.5'%20fill='%23ff9f0a'/%3e%3cline%20x1='48'%20y1='58'%20x2='48'%20y2='66'%20stroke='%23ff9f0a'%20stroke-width='3'%20stroke-linecap='round'/%3e%3cline%20x1='38'%20y1='68'%20x2='58'%20y2='68'%20stroke='%23ff9f0a'%20stroke-width='3'%20stroke-linecap='round'/%3e%3c/svg%3e", Ce = "data:image/svg+xml,%3csvg%20width='96'%20height='96'%20viewBox='0%200%2096%2096'%20xmlns='http://www.w3.org/2000/svg'%3e%3crect%20x='4'%20y='4'%20width='88'%20height='88'%20rx='20'%20fill='%23f5f5f7'/%3e%3crect%20x='4.5'%20y='4.5'%20width='87'%20height='87'%20rx='19.5'%20fill='none'%20stroke='rgba(0,0,0,0.08)'/%3e%3crect%20x='28'%20y='30'%20width='40'%20height='36'%20rx='4'%20fill='%23ffffff'%20stroke='%2330d158'%20stroke-width='3'/%3e%3cline%20x1='28'%20y1='42'%20x2='68'%20y2='42'%20stroke='%2330d158'%20stroke-width='3'/%3e%3cline%20x1='28'%20y1='54'%20x2='68'%20y2='54'%20stroke='%2330d158'%20stroke-width='3'/%3e%3cline%20x1='41.33'%20y1='42'%20x2='41.33'%20y2='66'%20stroke='%2330d158'%20stroke-width='3'/%3e%3cline%20x1='54.67'%20y1='42'%20x2='54.67'%20y2='66'%20stroke='%2330d158'%20stroke-width='3'/%3e%3c/svg%3e", Ee = "data:image/svg+xml,%3csvg%20width='96'%20height='96'%20viewBox='0%200%2096%2096'%20xmlns='http://www.w3.org/2000/svg'%3e%3crect%20x='4'%20y='4'%20width='88'%20height='88'%20rx='20'%20fill='%23f5f5f7'/%3e%3crect%20x='4.5'%20y='4.5'%20width='87'%20height='87'%20rx='19.5'%20fill='none'%20stroke='rgba(0,0,0,0.08)'/%3e%3crect%20x='32'%20y='26'%20width='32'%20height='44'%20rx='4'%20fill='%23ffffff'%20stroke='%238e8e93'%20stroke-width='3'/%3e%3cline%20x1='38'%20y1='36'%20x2='58'%20y2='36'%20stroke='%238e8e93'%20stroke-width='3'%20stroke-linecap='round'/%3e%3cline%20x1='38'%20y1='44'%20x2='58'%20y2='44'%20stroke='%238e8e93'%20stroke-width='3'%20stroke-linecap='round'/%3e%3cline%20x1='38'%20y1='52'%20x2='58'%20y2='52'%20stroke='%238e8e93'%20stroke-width='3'%20stroke-linecap='round'/%3e%3cline%20x1='38'%20y1='60'%20x2='50'%20y2='60'%20stroke='%238e8e93'%20stroke-width='3'%20stroke-linecap='round'/%3e%3c/svg%3e", ze = "data:image/svg+xml,%3csvg%20width='96'%20height='96'%20viewBox='0%200%2096%2096'%20xmlns='http://www.w3.org/2000/svg'%3e%3crect%20x='4'%20y='4'%20width='88'%20height='88'%20rx='20'%20fill='%23f5f5f7'/%3e%3crect%20x='4.5'%20y='4.5'%20width='87'%20height='87'%20rx='19.5'%20fill='none'%20stroke='rgba(0,0,0,0.08)'/%3e%3crect%20x='26'%20y='32'%20width='44'%20height='32'%20rx='6'%20fill='%23ffffff'%20stroke='%23bf5af2'%20stroke-width='3'/%3e%3cpath%20d='M43%2041l12%207-12%207Z'%20fill='%23bf5af2'/%3e%3c/svg%3e", Te = {
  document: be,
  spreadsheet: Ce,
  presentation: _e,
  archive: ve,
  audio: we,
  video: ze,
  image: Se,
  text: Ee,
  code: ke
};
function Re(t) {
  return t ? Te[t] ?? "" : "";
}
const x = 88, U = 108, W = 16;
function Ae({ badge: t }) {
  const { token: e } = h.useToken(), i = t.length > 3 ? 13 : 17;
  return /* @__PURE__ */ a(
    "svg",
    {
      "data-role": "file-cover-fallback",
      viewBox: "0 0 96 96",
      role: "img",
      "aria-label": t,
      style: { display: "block", width: "100%", height: "100%" },
      children: [
        /* @__PURE__ */ r(
          "path",
          {
            d: "M28 12h26l14 14v54a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Z",
            fill: e.colorBgContainer,
            stroke: e.colorBorder,
            strokeWidth: "2.5",
            strokeLinejoin: "round"
          }
        ),
        /* @__PURE__ */ r(
          "path",
          {
            d: "M54 12v14h14",
            fill: "none",
            stroke: e.colorBorder,
            strokeWidth: "2.5",
            strokeLinejoin: "round"
          }
        ),
        t ? /* @__PURE__ */ r(
          "text",
          {
            x: "48",
            y: "56",
            textAnchor: "middle",
            dominantBaseline: "middle",
            fontSize: i,
            fontWeight: "700",
            fill: e.colorTextSecondary,
            children: t
          }
        ) : null
      ]
    }
  );
}
function Ie({
  coverReference: t,
  fallbackBadge: e,
  title: i,
  borderRadius: n,
  background: o
}) {
  return /* @__PURE__ */ r(
    "span",
    {
      "aria-hidden": "true",
      style: {
        display: "block",
        flex: `0 0 ${x}px`,
        width: x,
        height: x,
        minWidth: x,
        borderRadius: n,
        overflow: "hidden",
        background: o
      },
      children: t.length > 0 ? /* @__PURE__ */ r(
        "img",
        {
          "data-role": "file-cover",
          src: t,
          alt: i,
          draggable: !1,
          loading: "lazy",
          style: {
            display: "block",
            margin: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }
        }
      ) : /* @__PURE__ */ r(Ae, { badge: e })
    }
  );
}
function je({ config: t, onOpen: e, outcome: i }) {
  const { token: n } = h.useToken(), o = _(t) || "未命名文件", c = me(t.file_extension), g = F(t) !== null, w = Re(he(t.file_extension)), m = t.cover_image.length > 0 ? t.cover_image : w, l = /* @__PURE__ */ a(j, { children: [
    /* @__PURE__ */ r(
      Ie,
      {
        coverReference: m,
        fallbackBadge: c,
        title: o,
        borderRadius: n.borderRadiusLG,
        background: n.colorBgContainer
      }
    ),
    /* @__PURE__ */ a(
      "span",
      {
        style: {
          display: "grid",
          gap: n.marginXXS,
          flex: "1 1 auto",
          minWidth: 0
        },
        children: [
          /* @__PURE__ */ r(
            "span",
            {
              style: {
                margin: 0,
                color: n.colorText,
                fontSize: n.fontSizeLG,
                fontWeight: 600,
                lineHeight: 1.25,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                overflowWrap: "anywhere"
              },
              children: o
            }
          ),
          /* @__PURE__ */ r(
            "span",
            {
              style: {
                margin: 0,
                color: n.colorTextSecondary,
                fontSize: n.fontSizeSM,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              },
              children: c || "未识别后缀"
            }
          )
        ]
      }
    )
  ] }), C = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    width: "100%",
    minHeight: U,
    padding: `${n.paddingSM}px ${n.padding}px`,
    boxSizing: "border-box",
    borderRadius: W,
    border: `1px ${g ? "solid" : "dashed"} ${n.colorBorderSecondary}`,
    background: n.colorFillQuaternary,
    textAlign: "left"
  };
  return /* @__PURE__ */ a("div", { style: { width: "100%", minWidth: 0 }, children: [
    g ? /* @__PURE__ */ r(
      "button",
      {
        type: "button",
        "data-role": "file-open",
        "aria-label": `打开《${o}》`,
        onClick: e,
        style: {
          cursor: "pointer",
          font: "inherit",
          color: "inherit",
          appearance: "none",
          ...C
        },
        children: l
      }
    ) : /* @__PURE__ */ a(
      "div",
      {
        role: "group",
        "aria-label": "文件引用缺失或非法，暂无法打开",
        style: C,
        children: [
          l,
          /* @__PURE__ */ r(
            "span",
            {
              style: {
                flexBasis: "100%",
                color: n.colorTextSecondary,
                fontSize: n.fontSizeSM
              },
              children: "文件引用缺失或非法，暂无法打开"
            }
          )
        ]
      }
    ),
    i.state !== "idle" ? /* @__PURE__ */ r(
      "p",
      {
        role: "status",
        style: {
          margin: 0,
          marginTop: n.marginXXS,
          color: i.state === "error" ? n.colorError : n.colorTextSecondary,
          fontSize: n.fontSizeSM
        },
        children: i.message
      }
    ) : null
  ] });
}
function Me({ config: t }) {
  const { token: e } = h.useToken(), i = f(t), [n, o] = D.useState({ state: "idle", message: null }), c = () => {
    const p = F(i);
    p && (o({ state: "opening", message: "正在打开文件…" }), le.request("resource:open", p).then(() => {
      o({ state: "idle", message: null });
    }).catch(() => {
      o({
        state: "error",
        message: "文件暂时无法打开：当前渲染环境未提供打开通道，请稍后重试"
      });
    }));
  };
  return /* @__PURE__ */ r("div", { "data-card-type": N, children: i.file_file.length === 0 ? /* @__PURE__ */ r(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: U,
        boxSizing: "border-box",
        borderRadius: W,
        border: `1px dashed ${e.colorBorderSecondary}`,
        background: e.colorFillQuaternary
      },
      children: /* @__PURE__ */ r(
        P,
        {
          image: /* @__PURE__ */ r(V, { "aria-hidden": "true" }),
          description: /* @__PURE__ */ a(j, { children: [
            /* @__PURE__ */ r("span", { style: { display: "block", fontWeight: 600 }, children: "未命名文件" }),
            /* @__PURE__ */ r("span", { style: { display: "block", marginTop: 4, fontSize: 13 }, children: "上传文件后，这里会显示文件基础卡片。" })
          ] })
        }
      )
    }
  ) : /* @__PURE__ */ r(je, { config: i, onOpen: c, outcome: n }) });
}
function Le(t) {
  return t.file_file.length > 0 && ye(t);
}
function A({
  label: t,
  hint: e,
  children: i
}) {
  const { token: n } = h.useToken();
  return /* @__PURE__ */ a(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: "minmax(96px, 160px) minmax(0, 1fr)",
        gap: n.marginSM,
        padding: `${n.paddingSM}px 0`,
        borderBottom: `1px solid ${n.colorBorderSecondary}`,
        alignItems: "start"
      },
      children: [
        /* @__PURE__ */ a("div", { style: { display: "grid", gap: 2, paddingTop: 5 }, children: [
          /* @__PURE__ */ r("span", { style: { color: n.colorText, fontSize: n.fontSizeSM, fontWeight: 600 }, children: t }),
          e ? /* @__PURE__ */ r("span", { style: { color: n.colorTextSecondary, fontSize: n.fontSizeSM }, children: e }) : null
        ] }),
        /* @__PURE__ */ r("div", { style: { display: "grid", gap: n.marginXXS, minWidth: 0 }, children: i })
      ]
    }
  );
}
function I({
  label: t,
  role: e,
  value: i
}) {
  const { token: n } = h.useToken();
  return /* @__PURE__ */ a(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: "minmax(96px, 160px) minmax(0, 1fr)",
        gap: n.marginSM,
        padding: `${n.paddingSM}px 0`,
        alignItems: "start"
      },
      children: [
        /* @__PURE__ */ r("span", { style: { color: n.colorText, fontSize: n.fontSizeSM, fontWeight: 600 }, children: t }),
        /* @__PURE__ */ r(
          "span",
          {
            "data-role": e,
            style: {
              minWidth: 0,
              color: n.colorTextSecondary,
              fontSize: n.fontSizeSM,
              lineHeight: "32px",
              overflowWrap: "anywhere"
            },
            children: i.length > 0 ? i : "—"
          }
        )
      ]
    }
  );
}
function Oe({ config: t, onChange: e }) {
  const { token: i } = h.useToken(), [n, o] = K(() => f(t)), c = H(n), p = (m) => {
    const l = f({ ...c.current, ...m });
    c.current = l, o(l), e(l);
  }, g = (m) => (l) => {
    p({ [m]: l.currentTarget.value });
  }, w = _(n);
  return /* @__PURE__ */ r(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "auto",
        padding: i.padding,
        boxSizing: "border-box"
      },
      children: /* @__PURE__ */ a("section", { style: { display: "grid", gap: 0, maxWidth: 720, margin: "0 auto" }, children: [
        /* @__PURE__ */ r(
          "h3",
          {
            style: {
              margin: 0,
              padding: `${i.paddingXS}px 0`,
              color: i.colorText,
              fontSize: i.fontSize,
              fontWeight: 700
            },
            children: "文件资源"
          }
        ),
        /* @__PURE__ */ r(A, { label: "文件", hint: "必填；卡片内相对路径，例如 docs/季度报告.pdf", children: /* @__PURE__ */ r(
          E,
          {
            "data-role": "file-path-input",
            value: n.file_file,
            placeholder: "docs/季度报告.pdf",
            onChange: g("file_file")
          }
        ) }),
        /* @__PURE__ */ r(
          A,
          {
            label: "自定义封面",
            hint: "可选；卡片内相对路径，未填写时按文件后缀解析类别显示内置默认封面",
            children: /* @__PURE__ */ r(
              E,
              {
                "data-role": "cover-path-input",
                value: n.cover_image,
                placeholder: "covers/季度报告.png",
                onChange: g("cover_image")
              }
            )
          }
        ),
        /* @__PURE__ */ r(
          "h3",
          {
            style: {
              margin: 0,
              paddingTop: i.paddingLG,
              color: i.colorText,
              fontSize: i.fontSize,
              fontWeight: 700
            },
            children: "自动识别信息"
          }
        ),
        /* @__PURE__ */ r(
          "p",
          {
            style: {
              margin: 0,
              paddingTop: i.marginSM,
              color: i.colorTextSecondary,
              fontSize: i.fontSizeSM
            },
            children: "文件名与后缀由导入文件自动识别，不提供手工编辑字段；文件选择导入通道就绪前，可先填写卡片内相对路径引用。"
          }
        ),
        /* @__PURE__ */ r(I, { label: "文件名", role: "derived-file-name", value: w }),
        /* @__PURE__ */ r(I, { label: "文件后缀", role: "derived-file-extension", value: n.file_extension })
      ] })
    }
  );
}
const y = /* @__PURE__ */ new WeakMap();
function Be(t, e) {
  y.get(e)?.(), e.replaceChildren();
  const i = L(e);
  M(() => {
    i.render(/* @__PURE__ */ r(Me, { config: t.content.config }));
  });
  let n = !1;
  const o = () => {
    n || (n = !0, i.unmount(), y.get(e) === o && y.delete(e));
  };
  return y.set(e, o), o;
}
function Ne(t) {
  return /* @__PURE__ */ r(Oe, { ...t });
}
class Fe {
  state = "active";
  base;
  revision;
  pending = null;
  dirty = !1;
  host;
  root;
  changeHandlers = /* @__PURE__ */ new Set();
  dirtyHandlers = /* @__PURE__ */ new Set();
  constructor(e, i) {
    this.base = f(e.content.config), this.revision = e.revision, this.host = i, i.replaceChildren(), this.root = L(i), this.mount();
  }
  isDirty() {
    return this.pending !== null;
  }
  getChange() {
    return this.pending;
  }
  markCommitted(e) {
    if (this.state === "disposed" || e <= this.revision)
      return;
    const i = this.pending;
    this.revision = e, i !== null && i.kind === "replace" && (this.base = f(i.content.config)), this.pending === i && (this.pending = null, this.setDirty(!1));
  }
  update(e, i) {
    this.state === "disposed" || i <= this.revision || (this.revision = i, this.base = f(e.content.config), this.pending = null, this.setDirty(!1), this.mount());
  }
  subscribe(e, i) {
    if (this.state === "disposed")
      return { dispose: () => {
      } };
    if (e === "change") {
      const o = i;
      return this.changeHandlers.add(o), {
        dispose: () => {
          this.changeHandlers.delete(o);
        }
      };
    }
    const n = i;
    return this.dirtyHandlers.add(n), {
      dispose: () => {
        this.dirtyHandlers.delete(n);
      }
    };
  }
  focus() {
    this.state === "active" && this.host.querySelector("input")?.focus();
  }
  dispose() {
    this.state !== "disposed" && (this.root.unmount(), this.changeHandlers.clear(), this.dirtyHandlers.clear(), this.pending = null, this.dirty = !1, this.state = "disposed");
  }
  mount() {
    M(() => {
      this.root.render(
        /* @__PURE__ */ r(
          Ne,
          {
            config: this.base,
            onChange: this.handleConfigChange
          },
          this.revision
        )
      );
    });
  }
  handleConfigChange = (e) => {
    if (this.state !== "active" || !Le(e))
      return;
    const i = {
      kind: "replace",
      content: {
        card_type: N,
        config: { ...e }
      }
    }, n = this.pending !== null;
    this.pending = i, n || this.setDirty(!0);
    for (const o of this.changeHandlers)
      o({ change: i });
  };
  setDirty(e) {
    if (this.dirty !== e) {
      this.dirty = e;
      for (const i of this.dirtyHandlers)
        i({ isDirty: e });
    }
  }
}
function Ue(t, e) {
  return new Fe(t, e);
}
const Ve = {
  renderView: Be,
  renderEditor: Ue
};
export {
  Ve as default,
  Ue as renderEditor,
  Ve as renderPlugin,
  Be as renderView
};
