import { jsxs as U, jsx as g, Fragment as Xn } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { useCommandRuntime as xo, theme as yn, Flex as dn, Typography as B, Input as Bt, Space as Te, Button as Zn, Alert as Jn, Divider as Gt, Drawer as Co, Empty as Fe, List as fn, Tooltip as Wt, DeleteOutlined as Eo, SearchOutlined as jt, Spin as Kt, Segmented as Mo, Radio as me, Select as To, Slider as $t, App as Yt, PushpinFilled as Fo, PushpinOutlined as zo, Tag as Ao, MenuUnfoldOutlined as No, ReadOutlined as Uo, SettingOutlined as Po, LeftOutlined as Io, RightOutlined as Lo, FontSizeOutlined as Ho, ChipsProvider as Do, CommandProvider as Oo } from "chips-resource://platform/vendor/chips-ui.js";
import b, { useState as G, useRef as X, useCallback as nn, useEffect as W, useMemo as qt } from "chips-resource://platform/vendor/react.js";
import "chips-resource://platform/vendor/react-dom.js";
import "chips-resource://platform/vendor/react-dom-client.js";
class mn extends Error {
  code;
  details;
  retryable;
  constructor(n) {
    super(n.message), this.name = "ChipsError", this.code = n.code, this.details = n.details, this.retryable = n.retryable ?? !1;
  }
  /** 归一为结构化克隆兼容的普通对象，用于跨 IPC / Neon 传输。 */
  toPlain() {
    const n = {
      code: this.code,
      message: this.message,
      retryable: this.retryable
    };
    return this.details !== void 0 && (n.details = this.details), n;
  }
  static fromPlain(n) {
    return new mn({
      code: n.code,
      message: n.message,
      retryable: n.retryable ?? !1,
      ...n.details !== void 0 ? { details: n.details } : {}
    });
  }
}
function Bo(e) {
  if (typeof e != "object" || e === null)
    return !1;
  const n = e;
  return typeof n.code == "string" && n.code.length > 0 && typeof n.message == "string" && (n.retryable === void 0 || typeof n.retryable == "boolean");
}
const Go = "SDK_BRIDGE_UNAVAILABLE", mt = "SDK_UNKNOWN_ERROR", ut = "发生未知错误";
function Wo(e) {
  return e instanceof Error;
}
function jo(e) {
  if (e instanceof mn)
    return e;
  if (Bo(e)) {
    const n = e, t = {
      code: n.code,
      message: n.message,
      retryable: n.retryable ?? !1,
      ...n.details !== void 0 ? { details: n.details } : {}
    };
    return new mn(t);
  }
  return Wo(e) ? new mn({
    code: mt,
    message: ut,
    details: { name: e.name, cause: e.message },
    retryable: !1
  }) : new mn({
    code: mt,
    message: ut,
    details: { value: String(e) },
    retryable: !1
  });
}
function Ko() {
  return new mn({
    code: Go,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function $(e, n, t) {
  let o;
  try {
    o = e();
  } catch (a) {
    return Promise.reject(jo(a));
  }
  return o.request(n, t);
}
const $o = "cli.command.list", Yo = "cli.command.get", qo = "cli.command.resolve";
function Vo(e) {
  return {
    list(n) {
      return $(e, $o, n ?? {});
    },
    get(n) {
      return $(e, Yo, n);
    },
    resolve(n) {
      return $(e, qo, n);
    }
  };
}
const Rn = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, Xo = "cli.task.create", Jo = "cli.task.bindInvocation", Zo = "cli.task.cancel";
function Qo(e) {
  return {
    create(n) {
      return $(e, Xo, n).then((t) => t.task);
    },
    bindInvocation(n) {
      return $(e, Jo, n).then((t) => t.task);
    },
    get(n) {
      const t = { taskId: n };
      return $(e, Rn.CLI_TASK_GET, t).then((o) => o.task);
    },
    active(n) {
      const t = { commandId: n };
      return $(e, Rn.CLI_TASK_ACTIVE, t).then((o) => o.task);
    },
    progress(n, t) {
      const o = { taskId: n, progress: t };
      return $(e, Rn.CLI_TASK_PROGRESS, o).then((a) => a.task);
    },
    complete(n, t) {
      const o = {
        taskId: n,
        ...t === void 0 ? {} : { output: t }
      };
      return $(e, Rn.CLI_TASK_COMPLETE, o).then((a) => a.task);
    },
    fail(n, t) {
      const o = { taskId: n, error: t };
      return $(e, Rn.CLI_TASK_FAIL, o).then((a) => a.task);
    },
    cancel(n) {
      return $(e, Zo, { taskId: n }).then((t) => t.task);
    }
  };
}
function na() {
  return globalThis.window?.chips;
}
class ea {
  #e;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = Vo(() => this.#n());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = Qo(() => this.#n());
  constructor(n) {
    this.#e = n;
  }
  /**
   * 解析本次调用的目标 Bridge。
   *
   * @returns 注入目标或当前 `window.chips`
   * @throws ChipsError 两者均不可用时抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  #n() {
    if (this.#e !== void 0)
      return this.#e;
    const n = na();
    if (n === void 0)
      throw Ko();
    return n;
  }
  /**
   * 唯一能力调用入口；转发给目标 Bridge。
   *
   * @param capabilityId - 能力 ID（`<domain>:<action>[:<target>]`）
   * @param input - 能力输入，校验与权限判定由平台完成
   * @returns 能力输出；目标不可用或平台调用失败时以 `ChipsError` 拒绝
   */
  request(n, t) {
    return $(() => this.#n(), n, t);
  }
  /**
   * 订阅标准事件；转发给目标 Bridge。
   *
   * @param eventId - 事件 ID
   * @param handler - 载荷回调；同一 `(eventId, handler)` 多次订阅各自独立
   * @returns 可退订句柄，`dispose()` 幂等
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  subscribe(n, t) {
    return this.#n().subscribe(n, t);
  }
  /**
   * 创建 `chips-resource://` 懒打开句柄；转发给目标 Bridge。
   *
   * @param uri - 资源 URI
   * @returns 资源句柄；预检失败由目标同步抛出 `ChipsError`
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  resource(n) {
    return this.#n().resource(n);
  }
}
function ta(e) {
  return new ea(e?.bridge);
}
const rn = ta();
function ze(e, n) {
  const t = globalThis.Buffer, o = t ? t.from(e).toString("base64") : (() => {
    let r = "";
    for (let i = 0; i < e.length; i += 32768) {
      const s = e.subarray(i, i + 32768);
      let l = "";
      for (let c = 0; c < s.length; c += 1)
        l += String.fromCharCode(s[c] ?? 0);
      r += l;
    }
    return btoa(r);
  })();
  return `data:${n};base64,${o}`;
}
const oa = {
  surface: "#f5f2ea",
  text: "#1f1d19",
  mutedText: "color-mix(in srgb, #1f1d19 72%, #f5f2ea)",
  primary: "#0a84ff",
  border: "color-mix(in srgb, #1f1d19 12%, transparent)",
  accentSurface: "color-mix(in srgb, #0a84ff 8%, #f5f2ea)"
}, be = 300, aa = "book-reader-theme-transition", ia = `transition: background-color ${be}ms ease, color ${be}ms ease`, ra = 0.6, sa = 1, Ae = 1;
function ht(e) {
  return {
    surface: `color-mix(in srgb, ${e.text} 82%, #07070a 18%)`,
    text: "color-mix(in srgb, white 92%, #d7d7de 8%)",
    mutedText: "color-mix(in srgb, white 66%, #8b8b96 34%)",
    primary: `color-mix(in srgb, ${e.primary} 68%, white 32%)`,
    border: "color-mix(in srgb, white 12%, transparent)",
    accentSurface: `color-mix(in srgb, ${e.text} 68%, ${e.primary} 32%)`
  };
}
function la(e, n, t) {
  switch (n) {
    case "system":
      return t === "dark" ? ht(e) : e;
    case "warm":
      return {
        surface: `color-mix(in srgb, ${e.surface} 72%, #f1e1c7 28%)`,
        text: e.text,
        mutedText: `color-mix(in srgb, ${e.text} 68%, #f1e1c7)`,
        primary: e.primary,
        border: `color-mix(in srgb, ${e.text} 14%, #f1e1c7)`,
        accentSurface: `color-mix(in srgb, ${e.surface} 58%, #edd7b1 42%)`
      };
    case "mist":
      return {
        surface: `color-mix(in srgb, ${e.surface} 82%, ${e.primary} 18%)`,
        text: e.text,
        mutedText: `color-mix(in srgb, ${e.text} 72%, ${e.surface})`,
        primary: `color-mix(in srgb, ${e.primary} 84%, white 16%)`,
        border: `color-mix(in srgb, ${e.text} 12%, ${e.primary})`,
        accentSurface: `color-mix(in srgb, ${e.surface} 74%, ${e.primary} 26%)`
      };
    case "night":
      return ht(e);
    default:
      return e;
  }
}
function ca() {
  return typeof window > "u" || typeof window.matchMedia != "function" ? "light" : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function da(e, n, t) {
  const o = n.backgroundTone ?? "system", a = t ?? ca(), r = la(e, o, a), i = o === "system" ? a === "dark" ? "night" : "theme" : o;
  return {
    ...r,
    resolvedTone: i,
    isDark: i === "night",
    transition: {
      durationMs: be,
      className: aa,
      cssText: ia
    }
  };
}
function ma(e) {
  return Number.isFinite(e) ? Math.min(sa, Math.max(ra, e)) : Ae;
}
const ua = 1.4, ha = 2, Ne = 1.65, ga = 0.06, Ue = 0.01, kn = {
  fontScale: 1,
  contentWidth: 760,
  fontFamily: "serif",
  readingMode: "paginated",
  backgroundTone: "system",
  lineHeight: Ne,
  letterSpacing: Ue,
  textAlign: "justify",
  writingMode: "horizontal",
  brightness: Ae
}, pa = {
  round: '"Yuanti SC", "Hiragino Maru Gothic ProN", "YouYuan", "幼圆", "Microsoft YaHei", sans-serif'
}, fa = [
  ".epub",
  ".epub3",
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
  ".fb2",
  ".rtf",
  ".mobi",
  ".azw",
  ".azw3",
  ".djvu",
  ".djv",
  ".doc",
  ".docx"
], ya = [
  "application/epub+zip",
  "application/oebps-package+xml",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/markdown",
  "application/x-fictionbook+xml",
  "application/rtf",
  "text/rtf",
  "application/x-mobipocket-ebook",
  "application/vnd.amazon.ebook",
  "image/vnd.djvu",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
], Sa = [
  "epub",
  "epub3",
  "pdf",
  "txt",
  "md",
  "markdown",
  "fb2",
  "rtf"
], gt = {
  "application/epub+zip": "epub",
  "application/oebps-package+xml": "epub",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
  "application/markdown": "md",
  "application/x-fictionbook+xml": "fb2",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
  "application/x-mobipocket-ebook": "mobi",
  "application/vnd.amazon.ebook": "azw",
  "image/vnd.djvu": "djvu",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"
};
function pt(e) {
  return e.deltaMode === 2 ? 1 : e.readingMode === "paginated" ? e.deltaMode === 1 ? 8 : 14 : e.deltaMode === 1 ? 6 : 10;
}
function Pe(e) {
  const n = e.trim();
  if (!n)
    return "";
  try {
    const o = new URL(n).pathname.trim().toLowerCase(), a = o.lastIndexOf(".");
    return a >= 0 ? o.slice(a) : "";
  } catch {
    const t = n.toLowerCase(), o = Math.max(t.lastIndexOf("/"), t.lastIndexOf("\\")), a = t.lastIndexOf(".");
    return a <= o ? "" : t.slice(a);
  }
}
function Qn(e) {
  const n = e?.trim().toLowerCase().replace(/^\./, "") ?? "";
  return n === "markdown" ? "md" : n;
}
function ba(e) {
  const n = e.mimeType?.trim().toLowerCase();
  if (n && gt[n])
    return gt[n];
  const t = Pe(e.fileName ?? e.filePath ?? e.sourceId);
  return Qn(t);
}
function _a(e) {
  return Sa.includes(
    Qn(e)
  );
}
function Ie(e) {
  const n = e.trim();
  if (!n)
    return "";
  try {
    const a = new URL(n).pathname.trim();
    if (a) {
      const r = a.split("/").filter(Boolean);
      return r[r.length - 1] ?? a;
    }
  } catch {
  }
  const t = n.split(/[\\/]/).filter((o) => o.length > 0);
  return t[t.length - 1] ?? n;
}
function va(e) {
  return e.title?.trim() || e.fileName?.trim() || Ie(e.filePath ?? e.sourceId) || e.sourceId;
}
function wa(e) {
  try {
    const n = new URL(e.trim());
    return n.protocol === "http:" || n.protocol === "https:";
  } catch {
    return !1;
  }
}
function Ra(e) {
  const n = e.mimeType?.trim().toLowerCase();
  if (n && ya.includes(n))
    return !0;
  const t = Pe(e.filePath ?? e.sourceId);
  return fa.includes(t);
}
function ka(e) {
  const n = e.filePath?.trim() || void 0, t = e.sourceId.trim(), o = e.fileName?.trim() || Ie(n ?? t) || "book";
  return {
    sourceId: t,
    filePath: n,
    fileName: o,
    title: va(e),
    author: e.author?.trim() || void 0,
    mimeType: e.mimeType?.trim() || void 0,
    format: ba(e),
    isRemote: !n && wa(t)
  };
}
function Vt(e) {
  return Number.isFinite(e) ? Math.min(1.4, Math.max(0.85, Number(e.toFixed(2)))) : 1;
}
function xa(e) {
  return typeof e != "number" || !Number.isFinite(e) ? Ne : Math.min(ha, Math.max(ua, Number(e.toFixed(2))));
}
function Ca(e) {
  return typeof e != "number" || !Number.isFinite(e) ? Ue : Math.min(ga, Math.max(0, Number(e.toFixed(3))));
}
function Xt(e) {
  return Number.isFinite(e) ? Math.min(980, Math.max(560, Math.round(e))) : 760;
}
function Ea(e) {
  return e === "scroll" ? "scroll" : "paginated";
}
function Ma(e) {
  return e === "theme" || e === "warm" || e === "mist" || e === "night" || e === "system" ? e : "system";
}
function Ta(e) {
  return e === "sans" || e === "round" || e === "system" ? e : "serif";
}
function Fa(e) {
  return e === "left" ? "left" : "justify";
}
function za(e) {
  return e === "vertical" ? "vertical" : "horizontal";
}
function ft(e) {
  return {
    fontScale: Vt(e.fontScale),
    contentWidth: Xt(e.contentWidth),
    fontFamily: Ta(e.fontFamily),
    readingMode: Ea(e.readingMode),
    backgroundTone: Ma(e.backgroundTone),
    lineHeight: xa(e.lineHeight),
    letterSpacing: Ca(e.letterSpacing),
    textAlign: Fa(e.textAlign),
    writingMode: za(e.writingMode),
    brightness: ma(e.brightness ?? Ae)
  };
}
function Jt(e) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(e.trim());
}
function C(e) {
  const n = e.replace(/\\/g, "/").trim();
  if (!n)
    return "";
  const t = [];
  for (const o of n.split("/"))
    if (!(!o || o === ".")) {
      if (o === "..") {
        t.pop();
        continue;
      }
      t.push(o);
    }
  return t.join("/");
}
function Zt(e) {
  const n = C(e), t = n.lastIndexOf("/");
  return t < 0 ? "" : n.slice(0, t);
}
function Qt(e, n) {
  const t = n.trim();
  if (!t)
    return C(e);
  if (Jt(t))
    return t;
  const o = C(e), a = t.startsWith("/") ? t.slice(1) : o ? `${o}/${t}` : t;
  return C(a);
}
function Aa(e) {
  const n = e.trim();
  if (!n)
    return { path: "" };
  const t = n.indexOf("#");
  if (t < 0)
    return { path: n };
  const o = n.slice(0, t), a = n.slice(t + 1).trim();
  return {
    path: o,
    fragment: a || void 0
  };
}
function Na(e, n) {
  const t = n.trim();
  return t ? Jt(t) ? t : Qt(Zt(e), t) : C(e);
}
function Sn(e, n) {
  const { path: t, fragment: o } = Aa(n);
  return {
    path: t ? Na(e, t) : C(e),
    fragment: o
  };
}
function Le(e, n) {
  const t = C(e);
  return n ? `${t}#${n}` : t;
}
function ne(e) {
  const n = e.trim().toLowerCase();
  return n.startsWith("http:") || n.startsWith("https:") || n.startsWith("mailto:") || n.startsWith("tel:");
}
const Ua = 101010256, Pa = 33639248, Ia = 67324752, La = 1, Ha = 65557, Da = 2048;
function O(e, n) {
  return e.getUint16(n, !0);
}
function J(e, n) {
  return e.getUint32(n, !0);
}
const Oa = [
  "Ç",
  "ü",
  "é",
  "â",
  "ä",
  "à",
  "å",
  "ç",
  "ê",
  "ë",
  "è",
  "ï",
  "î",
  "ì",
  "Ä",
  "Å",
  "É",
  "æ",
  "Æ",
  "ô",
  "ö",
  "ò",
  "û",
  "ù",
  "ÿ",
  "Ö",
  "Ü",
  "¢",
  "£",
  "¥",
  "₧",
  "ƒ",
  "á",
  "í",
  "ó",
  "ú",
  "ñ",
  "Ñ",
  "ª",
  "º",
  "¿",
  "⌐",
  "¬",
  "½",
  "¼",
  "¡",
  "«",
  "»",
  "░",
  "▒",
  "▓",
  "│",
  "┤",
  "╡",
  "╢",
  "╖",
  "╕",
  "╣",
  "║",
  "╗",
  "╝",
  "╜",
  "╛",
  "┐",
  "└",
  "┴",
  "┬",
  "├",
  "─",
  "┼",
  "╞",
  "╟",
  "╚",
  "╔",
  "╩",
  "╦",
  "╠",
  "═",
  "╬",
  "╧",
  "╨",
  "╤",
  "╥",
  "╙",
  "╘",
  "╒",
  "╓",
  "╫",
  "╪",
  "┘",
  "┌",
  "█",
  "▄",
  "▌",
  "▐",
  "▀",
  "α",
  "ß",
  "Γ",
  "π",
  "Σ",
  "σ",
  "µ",
  "τ",
  "Φ",
  "Θ",
  "Ω",
  "δ",
  "∞",
  "φ",
  "ε",
  "∩",
  "≡",
  "±",
  "≥",
  "≤",
  "⌠",
  "⌡",
  "÷",
  "≈",
  "°",
  "∙",
  "·",
  "√",
  "ⁿ",
  "²",
  "■",
  " "
];
function Ba(e, n) {
  if (n)
    return new TextDecoder("utf-8").decode(e);
  let t = "";
  for (const o of e)
    t += o < 128 ? String.fromCharCode(o) : Oa[o - 128];
  return t;
}
function Ga(e, n) {
  if (e === 0)
    return;
  const t = e & 31, o = e >>> 5 & 15, a = (e >>> 9 & 127) + 1980, r = (n & 31) * 2, i = n >>> 5 & 63, s = n >>> 11 & 31;
  if (!(o < 1 || o > 12 || t < 1 || t > 31))
    return new Date(a, o - 1, t, s, i, r).getTime();
}
function Wa(e) {
  const n = e.replace(/\\/g, "/");
  if (!n || n.startsWith("/") || n.includes("\0"))
    return !1;
  const t = n.split("/").filter(Boolean);
  return t.length > 0 && !t.some((o) => o === "." || o === "..");
}
function ja(e) {
  const n = e.byteLength, t = Math.max(0, n - Ha);
  for (let o = n - 22; o >= t; o -= 1) {
    if (J(e, o) !== Ua)
      continue;
    const a = O(e, o + 20);
    if (o + 22 + a !== n)
      continue;
    const r = O(e, o + 10), i = J(e, o + 12), s = J(e, o + 16);
    if (r === 65535 || i === 4294967295 || s === 4294967295)
      throw new Error("当前电子书基础卡片暂不支持 ZIP64 图片包。");
    return {
      offset: s,
      size: i,
      totalEntries: r
    };
  }
  throw new Error("找不到 ZIP 中央目录。");
}
function Ka(e) {
  const n = new DataView(e.buffer, e.byteOffset, e.byteLength);
  let t = 0;
  const o = {};
  for (; t + 4 <= e.byteLength; ) {
    const a = O(n, t), r = O(n, t + 2), i = t + 4;
    if (i + r > e.byteLength)
      break;
    if (a === La) {
      let s = i;
      const l = () => {
        if (s + 8 > i + r)
          return;
        const h = J(n, s), S = J(n, s + 4);
        s += 8;
        const _ = S * 4294967296 + h;
        return Number.isSafeInteger(_) ? _ : void 0;
      }, c = l(), d = l(), u = l();
      c !== void 0 && (o.uncompressedSize = c), d !== void 0 && (o.compressedSize = d), u !== void 0 && (o.localHeaderOffset = u);
    }
    t = i + r;
  }
  return o;
}
function $a(e) {
  const n = new DataView(e), t = ja(n), o = [];
  let a = t.offset;
  const r = t.offset + t.size;
  for (let i = 0; i < t.totalEntries; i += 1) {
    if (a + 46 > n.byteLength || a >= r)
      throw new Error("ZIP 中央目录结构不完整。");
    if (J(n, a) !== Pa)
      throw new Error("ZIP 中央目录条目签名无效。");
    const s = O(n, a + 8), l = O(n, a + 10), c = O(n, a + 12), d = O(n, a + 14), u = J(n, a + 16), h = J(n, a + 20), S = J(n, a + 24), _ = O(n, a + 28), R = O(n, a + 30), p = O(n, a + 32), f = J(n, a + 42), E = a + 46, j = E + _, F = j + R;
    if (F + p > n.byteLength)
      throw new Error("ZIP 中央目录条目长度无效。");
    const z = Ba(
      new Uint8Array(e, E, _),
      !!(s & Da)
    ).replace(/\\/g, "/"), q = Ka(new Uint8Array(e, j, R)), ln = h === 4294967295 ? q.compressedSize : h, V = S === 4294967295 ? q.uncompressedSize : S, bn = f === 4294967295 ? q.localHeaderOffset : f;
    if (ln === void 0 || V === void 0 || bn === void 0)
      throw new Error("ZIP64 条目大小超过当前运行时可安全处理范围。");
    const An = z.split("/").filter(Boolean).pop() ?? z;
    o.push({
      path: z,
      fileName: An,
      compressionMethod: l,
      compressedSize: ln,
      uncompressedSize: V,
      localHeaderOffset: bn,
      entryTime: Ga(d, c),
      crc32: u,
      isDirectory: z.endsWith("/")
    }), a = F + p;
  }
  return o.filter((i) => Wa(i.path));
}
async function Ya(e) {
  const n = globalThis.DecompressionStream;
  if (typeof n != "function")
    throw new Error("当前运行时缺少 DecompressionStream，无法解压 deflate ZIP 条目。");
  const t = new ArrayBuffer(e.byteLength);
  new Uint8Array(t).set(e);
  const o = new Response(t).body;
  if (!o)
    throw new Error("当前运行时无法创建字节流，无法解压 deflate ZIP 条目。");
  const a = await new Response(o.pipeThrough(new n("deflate-raw"))).arrayBuffer();
  return new Uint8Array(a);
}
async function qa(e, n) {
  const t = new DataView(e), o = n.localHeaderOffset;
  if (o + 30 > t.byteLength || J(t, o) !== Ia)
    throw new Error(`ZIP 本地文件头无效：${n.path}`);
  const a = O(t, o + 26), r = O(t, o + 28), i = o + 30 + a + r;
  if (i + n.compressedSize > t.byteLength)
    throw new Error(`ZIP 条目数据越界：${n.path}`);
  const l = new Uint8Array(e, i, n.compressedSize);
  if (n.compressionMethod === 0)
    return new Uint8Array(l);
  if (n.compressionMethod === 8)
    return Ya(l);
  throw new Error(`不支持的 ZIP 压缩方法：${n.compressionMethod}`);
}
function Va(e) {
  return {
    path: e.path,
    size: e.uncompressedSize,
    compressedSize: e.compressedSize,
    crc32: e.crc32,
    offset: e.localHeaderOffset,
    isDirectory: e.isDirectory
  };
}
function no(e) {
  const n = new ArrayBuffer(e.byteLength);
  return new Uint8Array(n).set(e), n;
}
class Xa {
  bytes;
  entries;
  binaryCache = /* @__PURE__ */ new Map();
  textCache = /* @__PURE__ */ new Map();
  constructor(n, t) {
    this.bytes = no(n), this.entries = new Map(t.map((o) => [C(o.path), o]));
  }
  listEntries() {
    return Array.from(this.entries.values()).map(Va);
  }
  hasEntry(n) {
    return this.entries.has(C(n));
  }
  async readBinary(n) {
    const t = C(n), o = this.binaryCache.get(t);
    if (o)
      return o;
    const a = this.entries.get(t);
    if (!a || a.isDirectory)
      throw new Error(`EPUB 资源不存在：${n}`);
    const r = await qa(this.bytes, a);
    return this.binaryCache.set(t, r), r;
  }
  async readText(n) {
    const t = C(n), o = this.textCache.get(t);
    if (o)
      return o;
    const a = new TextDecoder("utf-8").decode(await this.readBinary(t));
    return this.textCache.set(t, a), a;
  }
}
function Ja(e) {
  const n = $a(no(e));
  return Promise.resolve(new Xa(e, n));
}
function yt(e) {
  return Array.from(new Set((e ?? []).map((n) => n.trim()).filter(Boolean)));
}
function ee(e) {
  return {
    id: e.id,
    href: e.href,
    path: C(e.path),
    title: e.title?.trim() || void 0,
    mediaType: e.mediaType?.trim() || void 0,
    rels: yt(e.rels),
    properties: yt(e.properties),
    fragment: e.fragment?.trim() || void 0,
    children: e.children ?? []
  };
}
function Za(e, n) {
  return ee({
    id: e.id,
    href: e.href,
    path: e.path,
    mediaType: e.mediaType,
    rels: n,
    properties: e.properties
  });
}
function Qa(e, n) {
  return ee({
    id: e.id,
    href: e.href,
    path: e.path,
    title: e.title,
    mediaType: n?.mediaType,
    properties: n?.properties
  });
}
function eo(e) {
  return ee({
    id: e.id,
    href: e.href,
    path: e.path,
    title: e.label,
    fragment: e.fragment,
    children: e.children.map(eo)
  });
}
function to(e, n = /* @__PURE__ */ new Map()) {
  for (const t of e)
    n.has(t.path) || n.set(t.path, t), to(t.children, n);
  return n;
}
function ni(e) {
  const n = e.coverPath ? C(e.coverPath) : void 0, t = e.navPath ? C(e.navPath) : void 0, o = e.sections.map(
    (d) => Qa(d, e.manifest.get(d.id))
  ), a = new Set(o.map((d) => d.path)), r = Array.from(e.manifest.values()).filter((d) => !a.has(C(d.path))).map(
    (d) => Za(d, [
      ...n && C(d.path) === n ? ["cover"] : [],
      ...t && C(d.path) === t ? ["contents"] : []
    ])
  ), i = e.navigation.map(eo), s = r.find((d) => d.path === n), l = r.find((d) => d.path === t), c = to([...o, ...r, ...i]);
  return {
    readingOrder: o,
    resources: r,
    toc: i,
    cover: s,
    nav: l,
    linksByPath: c
  };
}
const ei = {
  ".css": "text/css",
  ".gif": "image/gif",
  ".htm": "text/html",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".ncx": "application/x-dtbncx+xml",
  ".opf": "application/oebps-package+xml",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xhtml": "application/xhtml+xml",
  ".xml": "application/xml"
};
function oo(e, n) {
  const t = n?.trim().toLowerCase();
  if (t)
    return t;
  const o = Pe(e);
  return ei[o] ?? "application/octet-stream";
}
async function ti(e, n, t) {
  return ze(
    await e.readBinary(n),
    oo(n, t)
  );
}
function _e(e, n) {
  const o = new DOMParser().parseFromString(e, "application/xml"), a = o.getElementsByTagName("parsererror")[0];
  if (a)
    throw new Error(`解析 ${n} 失败：${a.textContent?.trim() || "XML 无法解析"}`);
  return o;
}
function oi(e) {
  return new DOMParser().parseFromString(e, "text/html");
}
function zn(e, n) {
  return Array.from(e.getElementsByTagName("*")).filter(
    (o) => o.localName === n
  );
}
function sn(e, n) {
  return zn(e, n)[0] ?? null;
}
function Y(e, n) {
  if (!e)
    return;
  const t = e.getAttribute(n)?.trim();
  if (t)
    return t;
  for (const o of Array.from(e.attributes))
    if (o.name === n || o.localName === n) {
      const a = o.value.trim();
      if (a)
        return a;
    }
}
function He(e) {
  const n = e?.textContent?.trim();
  return n && n.length > 0 ? n : void 0;
}
function ai(e) {
  return (e ?? "").split(/\s+/).map((n) => n.trim()).filter(Boolean);
}
function ii(e) {
  const n = sn(e, "metadata"), t = (o) => He(zn(n ?? e, o)[0] ?? null);
  return {
    title: t("title") ?? "Untitled EPUB",
    creator: t("creator"),
    language: t("language"),
    identifier: t("identifier"),
    publisher: t("publisher"),
    description: t("description")
  };
}
function ri(e, n) {
  const t = sn(e, "manifest"), o = sn(e, "spine"), a = Zt(n), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
  let s, l, c;
  for (const h of zn(e, "meta"))
    if (Y(h, "name") === "cover") {
      c = Y(h, "content");
      break;
    }
  const d = Y(o, "toc");
  for (const h of zn(t ?? e, "item")) {
    const S = Y(h, "id"), _ = Y(h, "href"), R = Y(h, "media-type");
    if (!S || !_ || !R)
      continue;
    const p = Qt(a, _), f = {
      id: S,
      href: _,
      path: p,
      mediaType: R,
      properties: ai(Y(h, "properties"))
    };
    r.set(S, f), i.set(p, f), f.properties.includes("nav") && (s = p), d && S === d && (l = p);
  }
  const u = Array.from(r.values()).find((h) => h.properties.includes("cover-image")) || (c ? r.get(c) : void 0);
  return {
    manifest: r,
    manifestByPath: i,
    coverPath: u?.path,
    coverMediaType: u?.mediaType,
    navPath: s,
    ncxPath: l
  };
}
function si(e, n) {
  const t = sn(e, "spine"), o = [];
  for (const a of zn(t ?? e, "itemref")) {
    const r = Y(a, "idref");
    if (!r)
      continue;
    const i = n.get(r);
    i && (!i.mediaType.includes("html") && !i.mediaType.includes("xml") || o.push({
      id: i.id,
      href: i.href,
      path: i.path,
      title: Ie(i.path),
      linear: Y(a, "linear") !== "no"
    }));
  }
  return o;
}
function li(e) {
  return new Map(e.map((n, t) => [C(n.path), t]));
}
function ao(e, n) {
  return e.map((t) => ({
    ...t,
    sectionIndex: n.get(C(t.path)),
    children: ao(t.children, n)
  }));
}
function io(e, n = /* @__PURE__ */ new Map()) {
  for (const t of e)
    t.path && t.label && n.set(C(t.path), t.label), io(t.children, n);
  return n;
}
function ci(e) {
  return e.map((n, t) => ({
    id: `${n.id}-nav`,
    label: n.title,
    href: n.href,
    path: n.path,
    fragment: void 0,
    sectionIndex: t,
    children: []
  }));
}
function ro(e, n, t) {
  if (!e)
    return [];
  const o = [];
  return Array.from(e.children).filter((r) => r.localName === "li").forEach((r, i) => {
    const s = Array.from(r.children).find((u) => u.localName === "a") ?? Array.from(r.children).find((u) => u.localName === "span");
    if (!s)
      return;
    const l = Y(s, "href") ?? "", c = Sn(n, l), d = Array.from(r.children).find((u) => u.localName === "ol");
    o.push({
      id: `${t}-${i}`,
      label: He(s) ?? `Section ${i + 1}`,
      href: Le(c.path, c.fragment),
      path: c.path,
      fragment: c.fragment,
      children: ro(d ?? null, n, `${t}-${i}`)
    });
  }), o;
}
function di(e, n) {
  const t = oi(e), o = Array.from(t.querySelectorAll("nav")), a = o.find(
    (i) => Array.from(i.attributes).some(
      (s) => s.localName === "type" && s.value === "toc"
    )
  ) ?? o[0];
  if (!a)
    return Promise.resolve([]);
  const r = a.querySelector("ol");
  return Promise.resolve(ro(r, n, "nav"));
}
function so(e, n, t) {
  const o = He(sn(e, "text")) ?? t, a = sn(e, "content"), r = Y(a, "src") ?? "", i = Sn(n, r), s = Array.from(e.children).filter(
    (l) => l.localName === "navPoint"
  );
  return {
    id: t,
    label: o,
    href: Le(i.path, i.fragment),
    path: i.path,
    fragment: i.fragment,
    children: s.map(
      (l, c) => so(l, n, `${t}-${c}`)
    )
  };
}
function mi(e, n) {
  const t = _e(e, "NCX"), o = sn(t, "navMap"), a = Array.from(o?.children ?? []).filter(
    (r) => r.localName === "navPoint"
  );
  return Promise.resolve(
    a.map((r, i) => so(r, n, `ncx-${i}`))
  );
}
async function ui(e) {
  const n = await Ja(e.bytes), t = await n.readText("META-INF/container.xml"), o = _e(t, "container.xml"), a = sn(o, "rootfile"), r = C(Y(a, "full-path") ?? "");
  if (!r)
    throw new Error("EPUB 文件缺少 OPF 包描述入口。");
  const i = _e(await n.readText(r), r), s = ii(i), l = ri(i, r), c = si(i, l.manifest);
  if (c.length === 0)
    throw new Error("EPUB 文件中没有可阅读的 spine 内容。");
  let d = [];
  l.navPath && n.hasEntry(l.navPath) ? d = await di(
    await n.readText(l.navPath),
    l.navPath
  ) : l.ncxPath && n.hasEntry(l.ncxPath) && (d = await mi(
    await n.readText(l.ncxPath),
    l.ncxPath
  )), d.length === 0 && (d = ci(c));
  const u = li(c), h = ao(d, u), S = io(h), _ = c.map((f) => ({
    ...f,
    title: S.get(C(f.path)) ?? f.title
  })), R = ni({
    manifest: l.manifest,
    sections: _,
    navigation: h,
    coverPath: l.coverPath,
    navPath: l.navPath
  }), p = l.coverPath && n.hasEntry(l.coverPath) ? await ti(n, l.coverPath, l.coverMediaType) : void 0;
  return {
    source: e.source,
    metadata: s,
    archive: n,
    publication: R,
    packagePath: r,
    manifest: l.manifest,
    manifestByPath: l.manifestByPath,
    sections: _,
    navigation: h,
    coverPath: l.coverPath,
    coverMediaType: l.coverMediaType,
    coverImageUri: p
  };
}
const hi = 18e3;
function en(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function ve(e) {
  if (e.length >= 2 && e[0] === 255 && e[1] === 254)
    return new TextDecoder("utf-16le").decode(e.slice(2));
  if (e.length >= 2 && e[0] === 254 && e[1] === 255) {
    const n = new Uint8Array(e.length - 2);
    for (let t = 2; t + 1 < e.length; t += 2)
      n[t - 2] = e[t + 1] ?? 0, n[t - 1] = e[t] ?? 0;
    return new TextDecoder("utf-16le").decode(n);
  }
  return e.length >= 3 && e[0] === 239 && e[1] === 187 && e[2] === 191 ? new TextDecoder("utf-8").decode(e.slice(3)) : new TextDecoder("utf-8").decode(e);
}
function te(e) {
  return e.replace(/\r\n?/g, `
`).replace(/\u0000/g, "").trim();
}
function gi(e) {
  const n = te(e);
  if (!n)
    return [""];
  const t = [];
  let o = 0;
  for (; o < n.length; ) {
    let a = Math.min(n.length, o + hi);
    if (a < n.length) {
      const r = n.lastIndexOf(`

`, a);
      r > o + 1e3 && (a = r);
    }
    t.push(n.slice(o, a).trim()), o = a;
  }
  return t.filter((a) => a.length > 0);
}
function pi(e) {
  return fi(e).join(`
`);
}
function fi(e) {
  return te(e).split(/\n{2,}/).map((t) => {
    const o = t.split(`
`).map((a) => a.trim()).filter(Boolean);
    return o.length === 0 ? "" : `<p>${en(o.join(`
`)).replace(/\n/g, "<br />")}</p>`;
  }).filter(Boolean);
}
function yi(e) {
  const n = te(e).split(`
`), t = [];
  let o = [], a = [], r = [], i = !1;
  const s = () => {
    o.length > 0 && (t.push(`<p>${en(o.join(" ")).replace(/\n/g, "<br />")}</p>`), o = []);
  }, l = () => {
    a.length > 0 && (t.push(`<ul>${a.map((d) => `<li>${en(d)}</li>`).join("")}</ul>`), a = []);
  }, c = () => {
    r.length > 0 && (t.push(`<pre><code>${en(r.join(`
`))}</code></pre>`), r = []);
  };
  for (const d of n) {
    const u = d.trimEnd();
    if (u.trim().startsWith("```")) {
      i ? (c(), i = !1) : (s(), l(), i = !0);
      continue;
    }
    if (i) {
      r.push(d);
      continue;
    }
    if (!u.trim()) {
      s(), l();
      continue;
    }
    const h = /^(#{1,6})\s+(.+)$/.exec(u.trim());
    if (h) {
      s(), l();
      const _ = Math.min(6, h[1]?.length ?? 1);
      t.push(`<h${_}>${en(h[2] ?? "")}</h${_}>`);
      continue;
    }
    const S = /^[-*+]\s+(.+)$/.exec(u.trim());
    if (S) {
      s(), a.push(S[1] ?? "");
      continue;
    }
    o.push(u.trim());
  }
  return c(), s(), l(), t.join(`
`);
}
function Si(e) {
  let n = "", t = 0, o = 0;
  const a = [];
  for (; t < e.length; ) {
    const r = e[t] ?? "";
    if (r === "{") {
      a.push(o), t += 1;
      continue;
    }
    if (r === "}") {
      o = a.pop() ?? 0, t += 1;
      continue;
    }
    if (r !== "\\") {
      o === 0 && (n += r), t += 1;
      continue;
    }
    const i = e[t + 1] ?? "";
    if (i === "'" && t + 3 < e.length) {
      const d = Number.parseInt(e.slice(t + 2, t + 4), 16);
      o === 0 && Number.isFinite(d) && (n += String.fromCharCode(d)), t += 4;
      continue;
    }
    if (i === "\\" || i === "{" || i === "}") {
      o === 0 && (n += i), t += 2;
      continue;
    }
    const s = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(e.slice(t));
    if (!s) {
      t += 1;
      continue;
    }
    const l = s[1] ?? "", c = s[2];
    if (l === "fonttbl" || l === "colortbl" || l === "stylesheet" || l === "info" || l === "pict")
      o += 1;
    else if (o === 0) {
      if (l === "par" || l === "line")
        n += `
`;
      else if (l === "tab")
        n += "	";
      else if (l === "u" && c) {
        const d = Number.parseInt(c, 10);
        n += String.fromCharCode(d < 0 ? d + 65536 : d);
      }
    }
    t += s[0].length;
  }
  return te(n.replace(/[ \t]+\n/g, `
`).replace(/\n{3,}/g, `

`));
}
function bi(e, n) {
  const o = new DOMParser().parseFromString(e, "application/xml"), a = o.getElementsByTagName("parsererror")[0];
  if (a)
    throw new Error(`FB2 文件无法解析：${a.textContent?.trim() || "XML 结构无效"}`);
  const r = (h) => o.querySelector(h)?.textContent?.trim() ?? "", i = r("description title-info book-title") || n, s = [
    r("description title-info author first-name"),
    r("description title-info author middle-name"),
    r("description title-info author last-name"),
    r("description title-info author nickname")
  ].filter(Boolean), l = o.querySelector("body") ?? o.documentElement, c = Array.from(l.querySelectorAll(":scope > section")), u = (c.length > 0 ? c : [l]).map((h, S) => {
    const _ = h.querySelector("title")?.textContent?.replace(/\s+/g, " ").trim() || `${i} ${S + 1}`, R = Array.from(h.querySelectorAll("p, subtitle, text-author")).map((p) => p.textContent?.replace(/\s+/g, " ").trim() ?? "").filter(Boolean);
    return {
      title: _,
      html: R.length > 0 ? R.map((p) => `<p>${en(p)}</p>`).join(`
`) : `<p>${en(h.textContent?.replace(/\s+/g, " ").trim() ?? "")}</p>`
    };
  });
  return {
    title: i,
    author: s.join(" ") || void 0,
    sections: u
  };
}
function _i(e, n) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${en(e)}</title>
    <style>
      .chips-reader-virtual-document {
        width: 100%;
      }
      .chips-reader-virtual-document :where(p, li) {
        white-space: pre-wrap;
      }
      .chips-reader-virtual-document :where(pre) {
        overflow-x: auto;
        padding: 1em;
        border-radius: 0.5em;
        background: color-mix(in srgb, currentColor 8%, transparent);
      }
      .chips-reader-pdf {
        position: fixed;
        inset: 0;
      }
      .chips-reader-pdf iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: transparent;
      }
    </style>
  </head>
  <body data-chips-app="book-reader.virtual">
    <article class="chips-reader-virtual-document">
      ${n}
    </article>
  </body>
</html>`;
}
class vi {
  entries = /* @__PURE__ */ new Map();
  constructor(n) {
    for (const t of n) {
      const o = t.bytes ?? new TextEncoder().encode(t.text ?? "");
      this.entries.set(t.path, {
        bytes: o,
        text: t.text
      });
    }
  }
  listEntries() {
    return Array.from(this.entries.entries()).map(([n, t], o) => ({
      path: n,
      size: t.bytes.length,
      compressedSize: t.bytes.length,
      crc32: 0,
      offset: o,
      isDirectory: !1
    }));
  }
  hasEntry(n) {
    return this.entries.has(n);
  }
  readBinary(n) {
    const t = this.entries.get(n);
    return t ? Promise.resolve(t.bytes) : Promise.reject(new Error(`阅读资源不存在：${n}`));
  }
  readText(n) {
    const t = this.entries.get(n);
    return t ? typeof t.text == "string" ? Promise.resolve(t.text) : Promise.resolve(new TextDecoder("utf-8").decode(t.bytes)) : Promise.reject(new Error(`阅读资源不存在：${n}`));
  }
}
function wi(e) {
  const n = e.sections.map((t) => ({
    id: t.id,
    href: t.href,
    path: t.path,
    title: t.title,
    mediaType: e.manifest.get(t.id)?.mediaType,
    rels: [],
    properties: [],
    children: []
  }));
  return {
    readingOrder: n,
    resources: [],
    toc: n,
    linksByPath: new Map(n.map((t) => [t.path, t]))
  };
}
function De(e) {
  const n = e.sectionBodies.map((s, l) => ({
    path: `sections/section-${l + 1}.xhtml`,
    text: _i(s.title, s.html)
  })), t = new vi([...n, ...e.files ?? []]), o = n.map((s, l) => ({
    id: `section-${l + 1}`,
    href: s.path,
    path: s.path,
    title: e.sectionBodies[l]?.title || e.metadata.title,
    linear: !0
  })), a = new Map(
    o.map((s) => [
      s.id,
      {
        id: s.id,
        href: s.href,
        path: s.path,
        mediaType: "application/xhtml+xml",
        properties: []
      }
    ])
  ), r = new Map(
    Array.from(a.values()).map((s) => [s.path, s])
  ), i = o.map((s, l) => ({
    id: `${s.id}-nav`,
    label: s.title,
    href: s.href,
    path: s.path,
    sectionIndex: l,
    children: []
  }));
  return {
    source: e.source,
    metadata: e.metadata,
    archive: t,
    publication: wi({ sections: o, manifest: a }),
    packagePath: "virtual.opf",
    manifest: a,
    manifestByPath: r,
    sections: o,
    navigation: i
  };
}
function St(e) {
  const n = e.format === "rtf" ? Si(ve(e.bytes)) : ve(e.bytes), t = gi(n).map((o, a) => ({
    title: a === 0 ? e.source.title : `${e.source.title} ${a + 1}`,
    html: e.format === "md" ? yi(o) : pi(o)
  }));
  return De({
    source: e.source,
    metadata: {
      title: e.source.title,
      creator: e.source.author
    },
    sectionBodies: t
  });
}
function Ri(e) {
  const n = bi(ve(e.bytes), e.source.title);
  return De({
    source: {
      ...e.source,
      title: n.title,
      author: e.source.author ?? n.author
    },
    metadata: {
      title: n.title,
      creator: e.source.author ?? n.author
    },
    sectionBodies: n.sections.length > 0 ? n.sections : [
      {
        title: n.title,
        html: ""
      }
    ]
  });
}
function ki(e) {
  const n = e.source.resourceUri || ze(e.bytes, "application/pdf");
  return De({
    source: e.source,
    metadata: {
      title: e.source.title,
      creator: e.source.author
    },
    sectionBodies: [
      {
        title: e.source.title,
        html: `<div class="chips-reader-pdf"><iframe title="${en(e.source.title)}" src="${en(n)}"></iframe></div>`
      }
    ]
  });
}
async function xi(e) {
  const n = Qn(e.source.format || e.source.fileName);
  if (!_a(n))
    throw new Error(`当前阅读器尚未接入 ${n.toUpperCase()} 的正式解码器。`);
  return n === "epub" || n === "epub3" ? ui(e) : n === "pdf" ? ki(e) : n === "fb2" ? Ri(e) : St(n === "rtf" ? { ...e, format: "rtf" } : {
    ...e,
    format: n === "md" || n === "markdown" ? "md" : "txt"
  });
}
function jn(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
class Ci {
  constructor(n) {
    this.transformHtml = n;
  }
  transformHtml;
  supports(n) {
    const t = n.mediaType?.trim().toLowerCase() ?? "";
    return t.includes("html") || t.includes("xhtml") || t.includes("xml");
  }
  async transform(n, t) {
    return this.supports(n.link) ? Promise.resolve(this.transformHtml(n, t)) : t;
  }
}
const bt = /* @__PURE__ */ new WeakMap(), Ei = /url\(([^)]+)\)/g;
function Mi(e) {
  const n = bt.get(e);
  if (n)
    return n;
  const t = /* @__PURE__ */ new Map();
  return bt.set(e, t), t;
}
async function lo(e, n, t) {
  const o = C(n), a = Mi(e), r = a.get(o);
  if (r)
    return r;
  const i = await e.archive.readBinary(o), s = ze(i, oo(o, t));
  return a.set(o, s), s;
}
function Oe(e, n) {
  return e.manifestByPath.get(C(n));
}
function co(e, n) {
  for (const t of n) {
    const o = e.getAttribute(t)?.trim();
    if (o)
      return o;
  }
  for (const t of Array.from(e.attributes))
    if (n.includes(t.name) || n.includes(t.localName)) {
      const o = t.value.trim();
      if (o)
        return o;
    }
  return "";
}
function Ti(e, n) {
  for (const t of n)
    if (e.hasAttribute(t))
      return t;
  for (const t of Array.from(e.attributes))
    if (n.includes(t.name) || n.includes(t.localName))
      return t.name;
  return n[0] ?? "src";
}
function Fi(e, n, t) {
  e.setAttribute(Ti(e, n), t);
}
function zi(e) {
  const n = e.mediaType?.trim().toLowerCase() ?? "";
  return n.includes("xhtml") || n.includes("xml") ? "application/xhtml+xml" : "text/html";
}
function Ai(e) {
  return e.getElementsByTagName("parsererror").length > 0;
}
function Ni(e, n) {
  const t = new DOMParser(), o = zi(n), a = t.parseFromString(e, o);
  return Ai(a) ? t.parseFromString(e, "text/html") : a;
}
function Be(e) {
  return e.querySelector("body") ?? Array.from(e.getElementsByTagName("*")).find(
    (n) => n.localName === "body"
  ) ?? null;
}
function Ui(e) {
  const n = Be(e);
  if (!n)
    return "";
  const t = new XMLSerializer();
  return Array.from(n.childNodes).map((o) => t.serializeToString(o)).join("");
}
function Pi(e, n) {
  const t = n.documentElement;
  return t.getAttribute("lang")?.trim() || t.getAttribute("xml:lang")?.trim() || Array.from(t.attributes).find((o) => o.localName === "lang")?.value.trim() || e.metadata.language || "zh-CN";
}
function Ii(e, n) {
  const t = C(n), o = e.publication.linksByPath.get(t);
  if (o)
    return o;
  const a = e.sections.find((r) => r.path === t);
  return ee({
    id: a?.id ?? t,
    href: a?.href ?? t,
    path: t,
    title: a?.title === void 0 ? void 0 : a.title,
    mediaType: Oe(e, t)?.mediaType
  });
}
async function mo(e, n, t) {
  const o = Array.from(n.matchAll(Ei));
  let a = n;
  for (const r of o) {
    const i = r[0], l = (r[1]?.trim() ?? "").replace(/^['"]|['"]$/g, "");
    if (!l || l.startsWith("data:") || l.startsWith("#") || ne(l))
      continue;
    const c = Sn(t, l);
    if (!e.archive.hasEntry(c.path))
      continue;
    const d = Oe(e, c.path), u = await lo(e, c.path, d?.mediaType);
    a = a.replace(i, `url("${u}")`);
  }
  return a;
}
async function Li(e, n, t) {
  const o = Array.from(t.querySelectorAll("[style]"));
  for (const a of o) {
    const r = a.getAttribute("style")?.trim() ?? "";
    !r || !r.includes("url(") || a.setAttribute("style", await mo(e, r, n));
  }
}
async function Hi(e, n, t) {
  const o = Array.from(t.querySelectorAll("link[href]")).filter((r) => (r.getAttribute("rel")?.trim().toLowerCase() ?? "").includes("stylesheet")), a = [];
  for (const r of o) {
    const i = r.getAttribute("href")?.trim() ?? "";
    if (r.remove(), !i || ne(i))
      continue;
    const s = Sn(n, i);
    if (!e.archive.hasEntry(s.path))
      continue;
    const l = await e.archive.readText(s.path);
    a.push(await mo(e, l, s.path));
  }
  return a;
}
async function Di(e, n, t) {
  const o = t.trim();
  if (!o || o.startsWith("data:") || o.startsWith("#") || ne(o))
    return null;
  const a = Sn(n, o);
  if (!e.archive.hasEntry(a.path))
    return null;
  const r = Oe(e, a.path);
  return lo(e, a.path, r?.mediaType);
}
async function Oi(e, n, t) {
  const o = [
    { selector: "img", attributes: ["src"] },
    { selector: "image", attributes: ["href", "xlink:href"] },
    { selector: "use", attributes: ["href", "xlink:href"] },
    { selector: "video", attributes: ["poster", "src"] },
    { selector: "audio", attributes: ["src"] },
    { selector: "source", attributes: ["src"] },
    { selector: "track", attributes: ["src"] }
  ];
  for (const a of o) {
    const r = Array.from(t.querySelectorAll(a.selector));
    for (const i of r) {
      const s = co(i, a.attributes);
      if (!s)
        continue;
      const l = await Di(e, n, s);
      l && Fi(i, a.attributes, l);
    }
  }
}
function Bi(e, n) {
  for (const t of Array.from(n.querySelectorAll("a[href], area[href]"))) {
    const o = co(t, ["href"]);
    if (!o)
      continue;
    if (ne(o)) {
      t.setAttribute("target", "_blank"), t.setAttribute("rel", "noreferrer noopener");
      continue;
    }
    const a = Sn(e, o);
    t.setAttribute("data-epub-target", Le(a.path, a.fragment));
  }
}
function Gi(e) {
  for (const n of ["script", "iframe", "object", "embed", "base"])
    for (const t of Array.from(e.querySelectorAll(n)))
      t.remove();
}
function Wi(e) {
  const n = Be(e);
  if (!n)
    return !1;
  const t = n.textContent?.replace(/\s+/g, "") ?? "", o = n.querySelectorAll("img, image, svg").length;
  return t.length === 0 && o > 0;
}
function ji(e) {
  const t = Be(e)?.classList.contains("cover") || !!e.querySelector("#cover .cover-image, #cover img.cover-image"), o = !!e.querySelector('[id^="full-page-image"], .element-type-image .image-element-image') && !t;
  return {
    sectionKind: t ? "cover" : o ? "full-page-image" : Wi(e) ? "illustration" : "chapter",
    hasSeparatePageIllustration: !!e.querySelector(".inline-image-flow-separate-page"),
    hasHeadingHero: !!e.querySelector(".heading-size-full")
  };
}
function Ki() {
  return `
    :root {
      color-scheme: light;
    }
    * {
      box-sizing: border-box;
    }
    html,
    body {
      width: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      background: transparent;
      color: inherit;
    }
    body {
      position: relative;
    }
    body :where(img, video, canvas, picture, svg) {
      display: block;
      max-width: 100% !important;
      max-inline-size: 100% !important;
      width: auto !important;
      height: auto !important;
      block-size: auto !important;
      object-fit: contain;
    }
    body :where(image) {
      max-width: 100% !important;
      max-inline-size: 100% !important;
      height: auto !important;
    }
    body :where(figure, img, video, canvas, svg) {
      margin-inline: auto;
    }
    body :where(a) {
      text-decoration-thickness: 1px;
      text-underline-offset: 0.14em;
    }
    body :where(table) {
      display: block;
      width: 100%;
      overflow-x: auto;
    }
    @media (max-width: 840px) {
      body :where(.inline-image-flow-left.inline-image-flow-within-text, .inline-image-flow-right.inline-image-flow-within-text) {
        float: none !important;
        width: 100% !important;
        margin-inline: 0 !important;
      }
      body :where(
        .inline-image-flow-left.inline-image-flow-within-text .inline-image-container,
        .inline-image-flow-right.inline-image-flow-within-text .inline-image-container,
        .inline-image-flow-center.inline-image-flow-within-text.inline-image-size-large .inline-image-container,
        .inline-image-flow-center.inline-image-flow-within-text.inline-image-size-full .inline-image-container,
        .inline-image-aspect-tall.inline-image-size-large .inline-image-container,
        .inline-image-aspect-tall.inline-image-size-full .inline-image-container
      ) {
        width: 100% !important;
      }
    }
  `;
}
async function $i(e, n) {
  const t = Ni(n, e.link);
  Gi(t);
  const o = await Hi(e.book, e.sectionPath, t);
  await Li(e.book, e.sectionPath, t), await Oi(e.book, e.sectionPath, t), Bi(e.sectionPath, t);
  const a = ji(t), r = t.querySelector("title")?.textContent?.trim() || t.querySelector("h1, h2, h3")?.textContent?.trim() || e.link.title || e.book.metadata.title;
  return `<!doctype html>
<html lang="${jn(Pi(e.book, t))}" data-section-kind="${jn(a.sectionKind)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${jn(r)}</title>
    ${o.map((i) => `<style>${i}</style>`).join(`
`)}
    <style>${Ki()}</style>
  </head>
  <body data-chips-app="book-reader.chapter" data-section-kind="${jn(a.sectionKind)}" data-has-separate-page-illustration="${String(a.hasSeparatePageIllustration)}" data-has-heading-hero="${String(a.hasHeadingHero)}">${Ui(t)}
  </body>
</html>`;
}
const Yi = new Ci(
  (e, n) => $i(
    {
      book: e.book,
      link: e.link,
      sectionPath: e.link.path
    },
    n
  )
);
async function qi(e, n) {
  const t = C(n), o = Ii(e, t), a = await e.archive.readText(t);
  if (e.source.format === "pdf")
    return {
      title: o.title ?? e.metadata.title,
      sectionPath: t,
      html: a
    };
  const r = await Yi.transform(
    {
      book: e,
      link: o
    },
    a
  );
  return {
    title: o.title ?? e.metadata.title,
    sectionPath: t,
    html: r
  };
}
const _t = "book-reader-search-highlights";
function we(e) {
  return e.trim().toLowerCase();
}
function Vi(e) {
  const t = new DOMParser().parseFromString(e, "text/html");
  return (t.body?.textContent ?? t.documentElement.textContent ?? "").replace(/\s+/g, " ").trim();
}
function Xi(e, n, t) {
  const o = Math.max(0, n - 40), a = Math.min(e.length, n + t + 40), r = o > 0 ? "..." : "", i = a < e.length ? "..." : "";
  return `${r}${e.slice(o, a).trim()}${i}`;
}
function Ji(e, n) {
  const t = we(n);
  if (!t)
    return { before: e, match: "", after: "" };
  const o = e.toLowerCase().indexOf(t);
  return o < 0 ? { before: e, match: "", after: "" } : {
    before: e.slice(0, o),
    match: e.slice(o, o + t.length),
    after: e.slice(o + t.length)
  };
}
function Zi(e) {
  if (e.nodeType !== Node.TEXT_NODE)
    return !1;
  const n = e.parentElement?.localName.toLowerCase();
  return n !== "script" && n !== "style" && n !== "noscript" && n !== "mark";
}
class Qi {
  constructor(n) {
    this.book = n;
  }
  book;
  cancelToken = 0;
  async *search(n, t) {
    const o = ++this.cancelToken, a = we(n);
    if (!a)
      return;
    const r = t?.maxResults ?? Number.POSITIVE_INFINITY, i = this.book.sections.length;
    let s = 0;
    for (let l = 0; l < this.book.sections.length; l += 1) {
      if (o !== this.cancelToken || s >= r)
        return;
      t?.onProgress?.(l + 1, i);
      const c = this.book.sections[l];
      if (!c)
        continue;
      let d = "";
      try {
        d = Vi(await this.book.archive.readText(c.path));
      } catch {
        continue;
      }
      if (!d)
        continue;
      const u = d.toLowerCase(), h = [];
      let S = 0;
      for (; S < u.length && s < r; ) {
        const _ = u.indexOf(a, S);
        if (_ < 0)
          break;
        h.push({
          sectionIndex: l,
          sectionTitle: c.title,
          excerpt: Xi(d, _, a.length),
          matchOffset: _,
          matchLength: a.length,
          query: a
        }), s += 1, S = _ + Math.max(1, a.length);
      }
      h.length > 0 && (yield h), await new Promise((_) => setTimeout(_, 0));
    }
  }
  cancel() {
    this.cancelToken += 1;
  }
  highlightInDocument(n, t, o) {
    if (this.clearHighlights(n), t.length === 0)
      return;
    const a = we(t[0]?.query ?? "");
    if (!a || !n.body)
      return;
    this.ensureHighlightStyles(n);
    const r = n.createTreeWalker(n.body, NodeFilter.SHOW_TEXT), i = [];
    let s = r.nextNode();
    for (; s; )
      Zi(s) && i.push(s), s = r.nextNode();
    for (const d of i) {
      const u = d.textContent ?? "", h = u.toLowerCase();
      let _ = h.indexOf(a, 0);
      if (_ < 0)
        continue;
      const R = n.createDocumentFragment();
      let p = 0;
      for (; _ >= 0; ) {
        _ > p && R.appendChild(n.createTextNode(u.slice(p, _)));
        const f = n.createElement("mark");
        f.dataset.searchResult = "true", f.textContent = u.slice(_, _ + a.length), R.appendChild(f), p = _ + a.length, _ = h.indexOf(a, p);
      }
      p < u.length && R.appendChild(n.createTextNode(u.slice(p))), d.parentNode?.replaceChild(R, d);
    }
    const c = Array.from(n.querySelectorAll("mark[data-search-result]"))[o];
    c?.classList.add("search-current"), c && typeof c.scrollIntoView == "function" && c.scrollIntoView({
      block: "center",
      inline: "center",
      behavior: "auto"
    });
  }
  clearHighlights(n) {
    const t = Array.from(n.querySelectorAll("mark[data-search-result]"));
    for (const o of t) {
      const a = o.parentNode;
      a && (a.replaceChild(n.createTextNode(o.textContent ?? ""), o), a.normalize());
    }
  }
  ensureHighlightStyles(n) {
    if (n.getElementById(_t))
      return;
    const t = n.createElement("style");
    t.id = _t, t.textContent = `
mark[data-search-result] {
  background: rgba(255, 214, 10, 0.28);
  color: inherit;
  border-radius: 0.35em;
  padding: 0 0.08em;
  box-shadow: inset 0 -0.08em 0 rgba(255, 159, 10, 0.28);
}

mark[data-search-result].search-current {
  background: rgba(255, 159, 10, 0.6);
  box-shadow: inset 0 -0.08em 0 rgba(255, 159, 10, 0.48);
}
`, (n.head ?? n.documentElement).appendChild(t);
  }
}
const Re = "chips.official.book-reader", w = {
  openCard: "book-reader:open-card",
  refreshView: "book-reader:refresh-view",
  previousPage: "book-reader:previous-page",
  nextPage: "book-reader:next-page",
  previousSection: "book-reader:previous-section",
  nextSection: "book-reader:next-section",
  goSectionStart: "book-reader:go-section-start",
  goSectionEnd: "book-reader:go-section-end",
  toggleContents: "book-reader:toggle-contents",
  toggleBookmarks: "book-reader:toggle-bookmarks",
  togglePreferences: "book-reader:toggle-preferences",
  toggleSearch: "book-reader:toggle-search",
  closePanel: "book-reader:close-panel",
  increaseFont: "book-reader:increase-font",
  decreaseFont: "book-reader:decrease-font",
  widenContent: "book-reader:widen-content",
  narrowContent: "book-reader:narrow-content",
  toggleBookmark: "book-reader:toggle-bookmark"
}, T = {
  openCard: "open-card",
  refreshView: "refresh-view",
  previousPage: "previous-page",
  nextPage: "next-page",
  previousSection: "previous-section",
  nextSection: "next-section",
  goSectionStart: "go-section-start",
  goSectionEnd: "go-section-end",
  toggleContents: "toggle-contents",
  toggleBookmarks: "toggle-bookmarks",
  togglePreferences: "toggle-preferences",
  toggleSearch: "toggle-search",
  closePanel: "close-panel",
  increaseFont: "increase-font",
  decreaseFont: "decrease-font",
  widenContent: "widen-content",
  narrowContent: "narrow-content",
  toggleBookmark: "toggle-bookmark"
};
function I(e, n, t, o, a, r, i) {
  return {
    id: e,
    title: t,
    description: o,
    ...i === void 0 ? {} : { shortcut: i },
    scope: { kind: "app", appId: Re },
    handlerId: n,
    keywords: [...r],
    group: a
  };
}
const ke = [
  {
    id: w.openCard,
    title: "打开卡片",
    description: "打开指定的卡片文件并在主窗口中展示",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: Re },
    handlerId: T.openCard,
    keywords: ["open", "card", "打开", "卡片"],
    group: "文件"
  },
  {
    id: w.refreshView,
    title: "刷新当前视图",
    description: "重新拉取当前展示数据",
    shortcut: "F5",
    scope: { kind: "app", appId: Re },
    handlerId: T.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  },
  I(
    w.previousPage,
    T.previousPage,
    "上一页",
    "向前翻动一页（滚动模式下向上滚动一屏）",
    "阅读",
    ["previous", "page", "上一页", "翻页"]
  ),
  I(
    w.nextPage,
    T.nextPage,
    "下一页",
    "向后翻动一页（滚动模式下向下滚动一屏）",
    "阅读",
    ["next", "page", "下一页", "翻页"]
  ),
  I(
    w.previousSection,
    T.previousSection,
    "上一章",
    "跳转到上一个章节（快捷键 P）",
    "阅读",
    ["section", "chapter", "上一章", "章节"],
    "P"
  ),
  I(
    w.nextSection,
    T.nextSection,
    "下一章",
    "跳转到下一个章节（快捷键 N）",
    "阅读",
    ["section", "chapter", "下一章", "章节"],
    "N"
  ),
  I(
    w.goSectionStart,
    T.goSectionStart,
    "跳到本章开头",
    "跳转到当前章节起始位置（Home）",
    "阅读",
    ["home", "start", "本章开头", "章节起点"]
  ),
  I(
    w.goSectionEnd,
    T.goSectionEnd,
    "跳到本章末尾",
    "跳转到当前章节结束位置（End）",
    "阅读",
    ["end", "本章末尾", "章节末尾"]
  ),
  I(
    w.toggleContents,
    T.toggleContents,
    "目录",
    "显示或隐藏章节目录面板",
    "视图",
    ["toc", "contents", "目录", "章节"]
  ),
  I(
    w.toggleBookmarks,
    T.toggleBookmarks,
    "书签列表",
    "显示或隐藏书签列表面板",
    "视图",
    ["bookmark", "书签", "列表"]
  ),
  I(
    w.togglePreferences,
    T.togglePreferences,
    "阅读偏好",
    "显示或隐藏阅读偏好面板（字号、行距、亮度与配色）",
    "视图",
    ["preference", "偏好", "字号", "配色"]
  ),
  I(
    w.toggleSearch,
    T.toggleSearch,
    "搜索",
    "显示或隐藏全书搜索面板（快捷键 Ctrl/Cmd+F）",
    "视图",
    ["search", "find", "搜索", "查找"],
    "CommandOrControl+F"
  ),
  I(
    w.closePanel,
    T.closePanel,
    "关闭面板",
    "关闭当前打开的面板（快捷键 Esc）",
    "视图",
    ["close", "panel", "关闭", "面板"],
    "Escape"
  ),
  I(
    w.increaseFont,
    T.increaseFont,
    "增大字号",
    "按档位增大正文字号",
    "排版",
    ["font", "size", "字号", "增大"]
  ),
  I(
    w.decreaseFont,
    T.decreaseFont,
    "减小字号",
    "按档位减小正文字号",
    "排版",
    ["font", "size", "字号", "减小"]
  ),
  I(
    w.widenContent,
    T.widenContent,
    "加宽版心",
    "加大正文内容区宽度",
    "排版",
    ["width", "版心", "加宽", "宽度"]
  ),
  I(
    w.narrowContent,
    T.narrowContent,
    "收窄版心",
    "收窄正文内容区宽度",
    "排版",
    ["width", "版心", "收窄", "宽度"]
  ),
  I(
    w.toggleBookmark,
    T.toggleBookmark,
    "添加或移除书签",
    "在当前阅读位置添加书签；已存在书签时移除",
    "阅读",
    ["bookmark", "书签", "标记"]
  )
], nr = new Set(Object.values(w));
function er(e) {
  return nr.has(e);
}
function tr(e) {
  return ke.map((n) => {
    const t = n.handlerId ?? "";
    return {
      commandId: n.id,
      handlerId: t,
      handler: (o) => {
        e({ commandId: n.id, handlerId: t, payload: o });
      }
    };
  });
}
function vt(e) {
  if (typeof e == "object" && e !== null && "code" in e) {
    const n = e.code;
    if (typeof n == "string" && n.length > 0)
      return n;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function or() {
  const e = xo(), [n, t] = G("registering"), [o, a] = G(null), [r, i] = G(null), s = X(null), l = nn((d) => {
    s.current = d;
  }, []);
  W(() => {
    let d = !1, u = null;
    return t("registering"), a(null), (async () => {
      try {
        for (const h of ke)
          await rn.request("command:register", { definition: h });
        if (d)
          return;
        u = e.attach(
          tr((h) => {
            i(h), s.current?.(h);
          })
        ), t("ready");
      } catch (h) {
        d || (a(vt(h)), t("error"));
      }
    })(), () => {
      d = !0, u?.dispose();
      for (const h of ke)
        rn.request("command:unregister", { commandId: h.id }).catch(() => {
        });
    };
  }, [e]);
  const c = nn(
    async (d, u) => {
      try {
        u === void 0 ? await e.invoke({ commandId: d, source: "api" }) : await e.invoke({ commandId: d, payload: u, source: "api" }), a(null);
      } catch (h) {
        a(vt(h));
      }
    },
    [e]
  );
  return {
    phase: n,
    errorCode: o,
    lastInvoked: r,
    setExecutor: l,
    invoke: c,
    invokeOpenCard: (d) => c(w.openCard, { path: d }),
    invokeRefreshView: () => c(w.refreshView)
  };
}
const ue = "plugins.chips.official.book-reader", wt = "preferences", ar = "bookmarks", ir = "positions";
function rr() {
  return {
    async get(e) {
      const n = await rn.request("config:get", {
        namespace: ue,
        key: e
      });
      return n.value === void 0 ? void 0 : n.value;
    },
    async set(e, n) {
      await rn.request("config:set", {
        namespace: ue,
        key: e,
        value: n,
        scope: "user"
      });
    },
    async reset(e) {
      await rn.request("config:reset", {
        namespace: ue,
        keys: [e],
        scope: "user"
      });
    }
  };
}
function sr() {
  const e = /* @__PURE__ */ new Map();
  return {
    get(n) {
      return Promise.resolve(e.has(n) ? e.get(n) : void 0);
    },
    set(n, t) {
      return e.set(n, t), Promise.resolve();
    },
    reset(n) {
      return e.delete(n), Promise.resolve();
    }
  };
}
function lr(e, n = sr()) {
  let t = "config";
  const o = /* @__PURE__ */ new Set(), a = () => {
    if (t !== "memory") {
      t = "memory";
      for (const i of o)
        i(t);
    }
  }, r = () => t === "config" ? e : n;
  return {
    get mode() {
      return t;
    },
    onModeChange(i) {
      return o.add(i), () => {
        o.delete(i);
      };
    },
    async get(i) {
      try {
        return await r().get(i);
      } catch {
        return a(), await n.get(i);
      }
    },
    async set(i, s) {
      try {
        await r().set(i, s);
      } catch {
        a(), await n.set(i, s);
      }
    },
    async reset(i) {
      try {
        await r().reset(i);
      } catch {
        a(), await n.reset(i);
      }
    }
  };
}
const cr = 8 * 1024 * 1024;
function dr(e) {
  const n = e.payload, t = typeof n?.display?.title == "string" ? n.display.title : "", o = typeof n?.display?.author == "string" ? n.display.author : "", a = e.fileName ?? e.uri.split("/").pop()?.split("?")[0] ?? e.uri;
  return ka({
    sourceId: e.uri,
    fileName: a,
    mimeType: e.mimeType,
    title: t || e.title || a,
    author: o || void 0
  });
}
function mr(e) {
  return {
    intent: "view",
    resource: {
      uri: e.uri,
      ...e.fileName === void 0 ? {} : { fileName: e.fileName },
      ...e.title === void 0 ? {} : { title: e.title }
    }
  };
}
async function ur(e) {
  await rn.request("resource:open", mr(e));
}
async function hr(e, n) {
  let t;
  try {
    t = rn.resource(e);
  } catch (a) {
    return {
      kind: "failure",
      failure: {
        kind: "resource-unavailable",
        message: he(a, "资源通道不可用，无法读取该书籍资源。")
      }
    };
  }
  let o;
  try {
    const a = await t.metadata();
    o = { size: a.size, mimeType: a.mimeType };
  } catch (a) {
    return {
      kind: "failure",
      failure: {
        kind: "resource-unavailable",
        message: he(a, "资源元数据读取失败，无法打开该书籍资源。")
      }
    };
  }
  if (o.size > cr)
    return {
      kind: "failure",
      failure: {
        kind: "too-large",
        size: o.size,
        message: `该书籍约 ${Math.ceil(o.size / (1024 * 1024))} MiB，超过单次读取上限 8 MiB；流式读取链路尚未就绪，暂无法打开。`
      }
    };
  try {
    return {
      kind: "ok",
      bytes: await t.read(),
      source: { ...n, resourceUri: e },
      mimeType: o.mimeType || n.mimeType || ""
    };
  } catch (a) {
    return {
      kind: "failure",
      failure: {
        kind: "resource-unavailable",
        message: he(a, "书籍资源读取失败，无法打开该书籍。")
      }
    };
  }
}
function he(e, n) {
  if (typeof e == "object" && e !== null && "message" in e) {
    const t = e.message;
    if (typeof t == "string" && t.trim().length > 0)
      return `${n}（${t.trim()}）`;
  }
  return n;
}
function gr(e) {
  return e === null || typeof e != "object" || Array.isArray(e) ? {} : e;
}
function pr(e) {
  const { configClient: n } = e, [t, o] = G(kn), a = X(kn);
  a.current = t, W(() => {
    let l = !1;
    return (async () => {
      const c = await n.get(wt);
      l || o(
        ft({
          ...kn,
          ...gr(c)
        })
      );
    })(), () => {
      l = !0;
    };
  }, [n]);
  const r = nn(
    (l) => {
      n.set(wt, l);
    },
    [n]
  ), i = nn(
    (l) => {
      const c = ft({ ...a.current, ...l });
      o(c), r(c);
    },
    [r]
  ), s = nn(() => {
    o(kn), r(kn);
  }, [r]);
  return { preferences: t, update: i, reset: s };
}
function uo(e, n) {
  const t = Array.from(new TextEncoder().encode(n)).map((o) => o.toString(16).padStart(2, "0")).join("");
  return `${e}.${t}`;
}
function fr() {
  return `bookmark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function Rt(e) {
  return uo(ar, e);
}
function yr(e) {
  return Array.isArray(e) ? e.filter((n) => n && typeof n == "object").map((n) => n).filter((n) => typeof n.id == "string" && typeof n.sectionIndex == "number") : [];
}
function kt(e, n) {
  if (e.sectionIndex !== n.sectionIndex)
    return !1;
  if (e.readingMode === "paginated" && n.readingMode === "paginated")
    return e.spreadIndex === n.spreadIndex;
  const t = n.tolerance ?? 0.02;
  return Math.abs(e.scrollFraction - n.scrollFraction) <= t;
}
function Sr(e) {
  const { bookSourceId: n, configClient: t } = e, [o, a] = G(/* @__PURE__ */ new Map());
  W(() => {
    if (!n || o.get(n))
      return;
    let l = !1;
    const c = Rt(n);
    return t.get(c).then((d) => {
      l || a((u) => {
        const h = new Map(u);
        return h.set(n, yr(d)), h;
      });
    }), () => {
      l = !0;
    };
  }, [n, o, t]);
  const r = qt(() => n ? o.get(n) ?? [] : [], [n, o]);
  function i(s, l) {
    t.set(Rt(s), l);
  }
  return {
    bookmarks: r,
    addBookmark: (s) => {
      if (!n)
        return;
      const l = {
        ...s,
        id: fr(),
        createdAt: Date.now()
      };
      a((c) => {
        const d = new Map(c), h = [...d.get(n) ?? [], l].sort(
          (S, _) => S.createdAt - _.createdAt
        );
        return d.set(n, h), i(n, h), d;
      });
    },
    removeBookmark: (s) => {
      n && a((l) => {
        const c = new Map(l), d = (c.get(n) ?? []).filter(
          (u) => u.id !== s
        );
        return c.set(n, d), i(n, d), c;
      });
    },
    hasBookmarkAtPosition: (s) => r.some((l) => kt(l, s)),
    findBookmarkAtPosition: (s) => r.find((l) => kt(l, s)) ?? null
  };
}
const xt = 2e3;
function br(e) {
  return uo(ir, e);
}
function Vn(e) {
  return typeof e == "number" && Number.isFinite(e);
}
function _r(e) {
  return e === "paginated" || e === "scroll" ? e : null;
}
function xe(e) {
  if (!e || typeof e != "object")
    return null;
  const n = e;
  if (!Vn(n.sectionIndex) || n.sectionIndex < 0)
    return null;
  const t = _r(n.readingMode);
  if (!t)
    return null;
  const o = Vn(n.spreadIndex) && n.spreadIndex >= 0 ? Math.floor(n.spreadIndex) : void 0, a = Vn(n.scrollFraction) ? Math.min(1, Math.max(0, n.scrollFraction)) : void 0;
  return {
    sectionIndex: Math.floor(n.sectionIndex),
    readingMode: t,
    spreadIndex: o,
    scrollFraction: a
  };
}
function vr(e) {
  const n = xe(e);
  if (!n)
    return null;
  const t = e;
  return !Vn(t.updatedAt) || t.updatedAt <= 0 ? null : {
    ...n,
    updatedAt: Math.floor(t.updatedAt)
  };
}
function wr(e) {
  const { bookSourceId: n, configClient: t } = e, [o, a] = G(null), r = X(null), i = X(null), s = X(null), l = X(0), c = nn(() => {
    s.current !== null && (window.clearTimeout(s.current), s.current = null);
    const R = i.current;
    i.current = null;
    const p = r.current, f = R ? xe(R) : null;
    !p || !f || (l.current = Date.now(), t.set(p, {
      ...f,
      updatedAt: Date.now()
    }));
  }, [t]), d = nn(
    (R) => {
      i.current = R;
      const p = Date.now() - l.current;
      if (p >= xt) {
        c();
        return;
      }
      s.current === null && (s.current = window.setTimeout(() => {
        s.current = null, c();
      }, xt - p));
    },
    [c]
  ), u = nn(() => {
    c();
  }, [c]), h = nn(
    (R) => {
      const p = xe(R);
      return p ? {
        sectionIndex: p.sectionIndex,
        readingMode: p.readingMode,
        spreadIndex: p.readingMode === "paginated" ? p.spreadIndex : void 0,
        scrollFraction: p.scrollFraction ?? 0
      } : null;
    },
    []
  ), S = nn(() => {
    s.current !== null && (window.clearTimeout(s.current), s.current = null), i.current = null, a(null);
    const R = r.current;
    R && t.reset(R);
  }, [t]), _ = X(c);
  return _.current = c, W(() => {
    if (_.current(), !n) {
      r.current = null, a(null);
      return;
    }
    const R = br(n);
    r.current = R;
    let p = !1;
    return t.get(R).then((f) => {
      p || a(vr(f));
    }), () => {
      p = !0;
    };
  }, [n, t]), W(() => () => {
    _.current();
  }, []), qt(
    () => ({
      savedPosition: o,
      track: d,
      flush: u,
      restore: h,
      clear: S
    }),
    [S, u, h, o, d]
  );
}
function Rr(e, n, t, o) {
  const a = (c, d) => 1 - 3 * d + 3 * c, r = (c, d) => 3 * d - 6 * c, i = (c) => 3 * c, s = (c, d, u) => (a(d, u) * c + r(d, u)) * c * c + i(d) * c, l = (c, d, u) => 3 * a(d, u) * c * c + 2 * r(d, u) * c + i(d);
  return (c) => {
    if (c <= 0)
      return 0;
    if (c >= 1)
      return 1;
    let d = c;
    for (let u = 0; u < 8; u += 1) {
      const h = l(d, e, t);
      if (h === 0)
        break;
      const S = s(d, e, t) - c;
      if (Math.abs(S) < 1e-6)
        break;
      d -= S / h;
    }
    return s(Math.min(1, Math.max(0, d)), n, o);
  };
}
const Ce = {
  easeOutCubic: (e) => 1 - Math.pow(1 - e, 3),
  easeOutBack: (e) => 1 + 2.70158 * Math.pow(e - 1, 3) + 1.70158 * Math.pow(e - 1, 2),
  /** 滑入翻页共享缓动 `cubic-bezier(0.22, 0.61, 0.36, 1)`。 */
  slide: Rr(0.22, 0.61, 0.36, 1)
}, kr = 0.3, xr = 0.08, ge = 180, Ct = 220, Cr = 2;
function Er(e, n, t) {
  return Math.min(t, Math.max(n, e));
}
function xn(e, n, t, o = !1) {
  const a = Math.max(0, n), r = t === "x" && o ? -a : a;
  if ("scrollTo" in e && typeof e.scrollTo == "function") {
    if (t === "x") {
      e.scrollTo({ left: r, behavior: "auto" });
      return;
    }
    e.scrollTo({ top: r, behavior: "auto" });
    return;
  }
  const i = e;
  if (t === "x") {
    i.scrollLeft = r;
    return;
  }
  i.scrollTop = r;
}
class Mr {
  options;
  currentAnimation = null;
  constructor(n) {
    this.options = {
      duration: n?.duration ?? 280,
      easing: n?.easing ?? Ce.easeOutCubic,
      minDuration: n?.minDuration ?? 120,
      maxDuration: n?.maxDuration ?? 450
    };
  }
  animateScroll(n) {
    this.cancel();
    const t = Math.abs(n.to - n.from);
    if (t < 2) {
      xn(n.element, n.to, n.axis, n.isRtl), n.onComplete?.();
      return;
    }
    const o = Er(
      this.options.duration * Math.max(0.4, Math.min(1.3, t / 1440)),
      this.options.minDuration,
      this.options.maxDuration
    ), a = performance.now();
    let r = 0, i = !1;
    const s = (c) => {
      i || (i = !0, xn(n.element, n.to, n.axis, n.isRtl), this.currentAnimation = null, c ? n.onCancel?.() : n.onComplete?.());
    }, l = (c) => {
      const d = Math.min(1, (c - a) / o), u = this.options.easing(d), h = n.from + (n.to - n.from) * u;
      if (xn(n.element, h, n.axis, n.isRtl), d < 1) {
        r = requestAnimationFrame(l);
        return;
      }
      s(!1);
    };
    r = requestAnimationFrame(l), this.currentAnimation = {
      cancel: () => {
        cancelAnimationFrame(r), s(!0);
      }
    };
  }
  /**
   * 通用数值缓动核心：按缓动函数在 `from` 与 `to` 之间逐帧过渡，
   * 通过 `apply` 回调写入动画目标；被取消时立即收敛到目标值。
   */
  tween(n) {
    this.cancel();
    const { from: t, to: o, duration: a, easing: r, apply: i } = n;
    if (Math.abs(o - t) < 0.5) {
      i(o), n.onComplete?.();
      return;
    }
    const s = performance.now();
    let l = 0, c = !1;
    const d = (h) => {
      c || (c = !0, i(o), this.currentAnimation = null, h ? n.onCancel?.() : n.onComplete?.());
    }, u = (h) => {
      const S = Math.min(1, (h - s) / a);
      if (i(t + (o - t) * r(S)), S < 1) {
        l = requestAnimationFrame(u);
        return;
      }
      d(!1);
    };
    l = requestAnimationFrame(u), this.currentAnimation = {
      cancel: () => {
        cancelAnimationFrame(l), d(!0);
      }
    };
  }
  /**
   * 对元素执行 transform 位移动画（`translateX` / `translateY`）。
   *
   * 用于边界回弹等基于缓动体系的短促位移反馈。
   */
  animateTransform(n) {
    const { element: t, from: o, to: a } = n, r = n.axis ?? "x", i = n.duration ?? this.options.duration, s = n.easing ?? this.options.easing;
    this.tween({
      from: o,
      to: a,
      duration: i,
      easing: s,
      apply: (l) => {
        t.style.transform = r === "x" ? `translateX(${l}px)` : `translateY(${l}px)`;
      },
      onComplete: n.onComplete,
      onCancel: n.onCancel
    });
  }
  /**
   * 双阶段滑入翻页动画（仅横排 LTR 分页模式使用）。
   *
   * 阶段一（180ms）：当前内容沿翻页方向位移视口宽度 30% + 淡出；
   * 阶段二（220ms）：`scrollTo` 落位到目标偏移后，目标页从对侧 8% 滑入 + 淡入。
   * 两阶段共享 `EASING.slide` 缓动（`cubic-bezier(0.22, 0.61, 0.36, 1)`）。
   *
   * 中断（取消）时快速收敛：立即归位 transform/opacity 并落位到目标偏移。
   */
  animateSlide(n) {
    this.cancel();
    const { element: t, scrollElement: o, toOffset: a, viewportSize: r, direction: i } = n, s = Math.abs(o.scrollLeft);
    if (Math.abs(s - a) <= Cr) {
      xn(o, a, "x"), n.onComplete?.();
      return;
    }
    const l = i === "next" ? -1 : 1, c = i === "next" ? 1 : -1, d = r * kr * l, u = r * xr * c;
    let h = !1, S = !1, _ = 0;
    const R = performance.now(), p = Ce.slide, f = () => {
      h || (h = !0, xn(o, a, "x"));
    }, E = () => {
      t.style.transform = "", t.style.opacity = "";
    }, j = (z) => {
      S || (S = !0, E(), f(), this.currentAnimation = null, z ? n.onCancel?.() : n.onComplete?.());
    }, F = (z) => {
      const q = z - R;
      if (q < ge) {
        const V = p(Math.min(1, q / ge));
        t.style.transform = `translateX(${d * V}px)`, t.style.opacity = String(1 - V), _ = requestAnimationFrame(F);
        return;
      }
      f();
      const ln = q - ge;
      if (ln < Ct) {
        const V = p(Math.min(1, ln / Ct));
        t.style.transform = `translateX(${u * (1 - V)}px)`, t.style.opacity = String(V), _ = requestAnimationFrame(F);
        return;
      }
      j(!1);
    };
    _ = requestAnimationFrame(F), this.currentAnimation = {
      cancel: () => {
        cancelAnimationFrame(_), j(!0);
      }
    };
  }
  cancel() {
    this.currentAnimation?.cancel();
  }
  isAnimating() {
    return this.currentAnimation !== null;
  }
  destroy() {
    this.cancel();
  }
}
function ho(e, n, t) {
  return Math.min(t, Math.max(n, e));
}
function N(e, n, t) {
  return Math.round(ho(e, n, t));
}
function Tr(e) {
  return e < 640 ? "compact" : e < 1024 ? "medium" : e < 1440 ? "expanded" : "large";
}
function Fr(e, n) {
  if (n !== "chapter") {
    const t = N(e * 0.04, 12, 32);
    return {
      top: t,
      bottom: t
    };
  }
  return {
    top: N(e * 0.06, 28, 88),
    bottom: N(e * 0.08, 32, 96)
  };
}
function zr(e) {
  const n = N(e.viewportWidth || 0, 320, 4096), t = N(e.viewportHeight || 0, 320, 4096), o = N(e.preferredContentWidth || 760, 560, 980), a = ho(e.fontScale || 1, 0.85, 1.4), r = Tr(n), i = e.sectionKind === "chapter", s = r === "compact" ? 24 : r === "medium" ? 34 : r === "expanded" ? 48 : 56, l = N(
    n * (i ? 0.038 : 0.026),
    18,
    s
  ), c = N(n * 0.03, 20, 44), d = N(o / a, 320, 1040), u = d * 1.42 + c + l * 2, h = e.readingMode === "paginated" && i && r !== "compact" && n >= Math.max(1024, Math.round(u)), S = h ? c : 0, _ = n, R = h ? n - l * 2 - S : n - l * 2, p = h ? N(R / 2, 320, n) : N(R, 360, n), f = N(i ? p - l * 0.45 : p, 320, p), E = N(i ? Math.min(d, f) : Math.min(p, n - l), 320, p), j = N(
    i ? Math.min(
      n - l * 2,
      Math.max(p, f + l)
    ) : n - l,
    320,
    n
  );
  return {
    forcedColCount: h ? "2" : "1",
    pageWidthPx: p,
    pageGutterPx: l,
    columnGapPx: S,
    maxLineLengthPx: E,
    illustrationWidthPx: j,
    shouldUseSpread: h,
    spreadWidthPx: _,
    effectiveContentWidth: f,
    windowBreakpoint: r,
    verticalPadding: Fr(t, e.sectionKind)
  };
}
function Fn(e) {
  return !!(e && typeof e == "object" && "nodeType" in e && typeof e.nodeType == "number" && e.nodeType === 1);
}
function go(e) {
  return Fn(e) && e.localName.toLowerCase() === "style";
}
function Ar(e) {
  return Fn(e) ? e : null;
}
function on(e) {
  if (Fn(e.scrollingElement))
    return e.scrollingElement;
  if (Fn(e.documentElement))
    return e.documentElement;
  if (Fn(e.body))
    return e.body;
  throw new Error("当前文档缺少可滚动根节点。");
}
const Et = 2;
function Mt(e) {
  return on(e);
}
function Tt(e) {
  const n = Number.parseInt(e, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function Ft(e) {
  const n = Number.parseFloat(e);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function Nr(e, n) {
  const t = e.defaultView;
  if (!t)
    return { columnCount: 1, columnGap: 0 };
  const o = [n, e.documentElement, e.body].filter(
    (i) => !!i
  );
  let a = 1, r = 0;
  for (const i of o) {
    const s = t.getComputedStyle(i), l = Tt(s.getPropertyValue("column-count")) ?? Tt(s.columnCount), c = Ft(s.getPropertyValue("column-gap")) ?? Ft(s.columnGap);
    l !== null && (a = Math.max(a, l)), c !== null && (r = Math.max(r, c));
  }
  return { columnCount: a, columnGap: r };
}
class Ur {
  // ─── 度量 ───────────────────────────────────────────────────
  /**
   * 对当前 iframe 文档做分页度量。
   *
   * @returns 描述 CSS column 分页状态的 `PaginationMetrics`。
   *          其中 `currentSpreadIndex` 固定返回 0，由调用方填充。
   */
  measure(n, t) {
    const o = Mt(n), a = Math.max(
      1,
      t.isVertical ? o.clientHeight || o.offsetHeight : o.clientWidth || o.offsetWidth
    ), r = Math.max(
      a,
      t.isVertical ? o.scrollHeight : o.scrollWidth
    ), { columnCount: i, columnGap: s } = Nr(
      n,
      o
    ), l = a + s, c = i > 1 ? (a - (i - 1) * s) / i : a, d = Math.max(0, r - a), u = d > 0 ? Math.ceil(d / Math.max(1, l)) + 1 : 1;
    return {
      totalColumns: i * u,
      columnsPerSpread: i,
      spreadCount: u,
      currentSpreadIndex: 0,
      spreadWidthPx: a,
      spreadAdvancePx: l,
      columnWidthPx: c,
      columnGapPx: s,
      totalScrollableWidth: r,
      maxScrollOffset: d
    };
  }
  // ─── 翻页（基于 spread 索引，非相对偏移） ──────────────────
  /**
   * 根据当前 spread 索引和翻页方向，计算目标 spread 的绝对像素偏移。
   *
   * 核心策略：`targetOffset = targetIndex × spreadAdvance`。
   * 由于每次都从索引计算绝对位置，不存在舍入误差累积。
   */
  computeTargetOffset(n, t, o) {
    const a = t === "next" ? Math.min(n + 1, o.spreadCount - 1) : Math.max(n - 1, 0), r = Math.min(a * o.spreadAdvancePx, o.maxScrollOffset);
    return { targetIndex: a, targetOffset: r };
  }
  // ─── 从当前滚动位置反推 spread 索引 ────────────────────────
  /**
   * 从 scroll 偏移量反推当前 spread 索引。
   *
   * 使用 `Math.round` 而非 ceil/floor，因为 scroll 偏移可能因子像素
   * 渲染有微小偏差，round 可以容忍 ±0.5 spread 的抖动。
   */
  resolveSpreadIndex(n, t) {
    return t <= 0 ? 0 : Math.max(0, Math.round(n / t));
  }
  // ─── 对齐到最近的 spread 边界 ──────────────────────────────
  /**
   * 将任意 scroll 偏移对齐到最近的 spread 边界。
   *
   * 对齐结果 = `round(offset / spreadWidth) × spreadWidth`。
   */
  snapToSpread(n, t) {
    return t <= 0 ? Math.max(0, n) : Math.max(0, Math.round(n / t) * t);
  }
  // ─── 边界检测 ──────────────────────────────────────────────
  /**
   * 检测当前 scroll 偏移是否已处于章节边界。
   *
   * @param direction — `"previous"` 检测章节开头，`"next"` 检测章节末尾。
   */
  isAtBoundary(n, t, o) {
    return o === "previous" ? n <= Et : n >= Math.max(0, t.maxScrollOffset - Et);
  }
  // ─── 跳转到指定 spread ────────────────────────────────────
  /**
   * 计算跳转到指定 spread 索引时的绝对 scroll 偏移。
   *
   * @returns clamp 后的安全偏移值。
   */
  computeOffsetForSpread(n, t, o) {
    const a = Math.max(0, n);
    return Math.max(0, Math.min(a * t, o));
  }
  // ─── 跳转到边界 ──────────────────────────────────────────
  /**
   * 计算跳转到章节首（start）或尾（end）的 scroll 偏移。
   */
  computeOffsetForBoundary(n, t) {
    return n === "start" ? 0 : t.maxScrollOffset;
  }
  // ─── 从 fragment 元素位置反推目标 spread ────────────────────
  /**
   * 根据 fragment 目标元素的布局位置计算其所在的 spread 索引。
   *
   * 使用 `element.getBoundingClientRect()` 加 scroll 偏移换算。
   */
  resolveFragmentSpread(n, t) {
    if (t <= 0)
      return 0;
    const o = n.ownerDocument, a = Mt(o), r = Math.abs(a.scrollLeft), s = n.getBoundingClientRect().left + r;
    return Math.max(0, Math.round(s / t));
  }
}
function L(e, n, t) {
  return Math.min(t, Math.max(n, e));
}
function zt(e) {
  const n = Number.parseInt(e, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function At(e) {
  const n = Number.parseFloat(e);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function Pr(e, n) {
  const t = e.defaultView;
  if (!t)
    return 0;
  const o = [n, e.documentElement, e.body].filter(
    (i) => !!i
  );
  let a = 1, r = 0;
  for (const i of o) {
    const s = t.getComputedStyle(i), l = zt(s.getPropertyValue("column-count")) ?? zt(s.columnCount), c = At(s.getPropertyValue("column-gap")) ?? At(s.columnGap);
    l !== null && (a = Math.max(a, l)), c !== null && (r = Math.max(r, c));
  }
  return a > 0 ? r : 0;
}
function Nt(e, n) {
  const t = on(e), o = Math.max(
    1,
    n.isVertical ? t.clientHeight || t.offsetHeight : t.clientWidth || t.offsetWidth
  ), a = Pr(e, t), r = o + a, i = Math.max(
    o,
    n.isVertical ? t.scrollHeight : t.scrollWidth
  ), s = n.isVertical ? Math.max(0, t.scrollTop) : Math.max(0, Math.abs(t.scrollLeft)), l = Math.max(0, i - o), c = l > 0 ? Math.ceil(l / r) + 1 : 1;
  return {
    spreadSize: o,
    spreadAdvance: r,
    contentSize: i,
    currentOffset: s,
    maxOffset: l,
    totalSpreads: c
  };
}
function Ut(e, n) {
  const t = on(e);
  if (n.isVertical) {
    const r = Math.max(0, Math.abs(t.scrollLeft)), i = Math.max(0, t.scrollWidth - t.clientWidth);
    return { currentOffset: r, maxOffset: i };
  }
  const o = Math.max(0, t.scrollTop), a = Math.max(0, t.scrollHeight - t.clientHeight);
  return { currentOffset: o, maxOffset: a };
}
class Ir {
  currentAnchor = {
    spreadIndex: 0,
    spreadFraction: 0,
    scrollFraction: 0
  };
  currentMode = "paginated";
  totalPages = 1;
  initialize(n, t, o) {
    this.currentMode = n, this.currentAnchor = this.captureAnchor(t, n, o), this.totalPages = n === "paginated" ? Math.max(1, this.currentAnchor.spreadIndex + 1) : 0;
  }
  captureAnchor(n, t, o) {
    if (t === "paginated") {
      const i = Nt(n, o), s = i.spreadAdvance > 0 ? Math.round(i.currentOffset / i.spreadAdvance) : 0, l = i.totalSpreads > 1 ? s / (i.totalSpreads - 1) : 0, c = i.maxOffset > 0 ? i.currentOffset / i.maxOffset : 0;
      return {
        spreadIndex: s,
        spreadFraction: L(l, 0, 1),
        scrollFraction: L(c, 0, 1)
      };
    }
    const a = Ut(n, o), r = a.maxOffset > 0 ? a.currentOffset / a.maxOffset : 0;
    return {
      spreadIndex: 0,
      spreadFraction: L(r, 0, 1),
      scrollFraction: L(r, 0, 1)
    };
  }
  restoreAnchor(n, t, o, a) {
    if (o === "paginated") {
      const i = Nt(t, a);
      if (i.maxOffset <= 0)
        return 0;
      const s = i.totalSpreads > 1 ? Math.round(L(n.spreadFraction, 0, 1) * (i.totalSpreads - 1)) : L(n.spreadIndex, 0, i.totalSpreads - 1);
      return L(s * i.spreadAdvance, 0, i.maxOffset);
    }
    const r = Ut(t, a);
    return L(
      Math.round(L(n.scrollFraction, 0, 1) * r.maxOffset),
      0,
      r.maxOffset
    );
  }
  update(n, t, o) {
    if (this.currentMode = o, o === "paginated") {
      const r = t, i = L(
        n,
        0,
        Math.max(0, r.spreadCount - 1)
      ), s = Math.min(
        i * r.spreadAdvancePx,
        r.maxScrollOffset
      );
      this.currentAnchor = {
        spreadIndex: i,
        spreadFraction: r.spreadCount > 1 ? i / (r.spreadCount - 1) : 0,
        scrollFraction: r.maxScrollOffset > 0 ? s / r.maxScrollOffset : 0
      }, this.totalPages = Math.max(1, r.spreadCount);
      return;
    }
    const a = t;
    this.currentAnchor = {
      spreadIndex: 0,
      spreadFraction: L(a.scrollFraction, 0, 1),
      scrollFraction: L(a.scrollFraction, 0, 1)
    }, this.totalPages = 0;
  }
  getCurrentAnchor() {
    return this.currentAnchor;
  }
  computeProgress(n, t, o, a) {
    const r = Math.max(1, t), i = L(n, 0, r - 1), s = L(
      this.currentMode === "paginated" ? this.currentAnchor.spreadFraction : this.currentAnchor.scrollFraction,
      0,
      1
    );
    let l;
    if (Array.isArray(a) && a.length === r) {
      const c = a.reduce((h, S) => h + Math.max(0, S), 0), d = a.slice(0, i).reduce((h, S) => h + Math.max(0, S), 0), u = Math.max(0, a[i] ?? 0);
      l = c > 0 ? (d + u * s) / c : (i + s) / r;
    } else
      l = (i + s) / r;
    return {
      readingMode: this.currentMode,
      sectionIndex: i,
      sectionCount: r,
      sectionTitle: o,
      sectionFraction: s,
      bookFraction: L(l, 0, 1),
      bookPercentage: Math.round(L(l, 0, 1) * 100),
      currentPage: this.currentMode === "paginated" ? this.currentAnchor.spreadIndex + 1 : 0,
      totalPages: this.currentMode === "paginated" ? this.totalPages : 0
    };
  }
}
const Lr = `/* Readium CSS
   Config module

   A file allowing implementers to customize flags for reading modes,
   user settings, etc.

   Repo: https://github.com/readium/readium-css */

/* Custom medias
   Syntax: @custom-media --variable (prop: value) */

/* Responsive columns
   The minimum width for which responsive columns (2 -> 1 and vice versa,
   depending on the current font-size) must be enabled */

/* Mobile columns
   The minimum and maximum width for mobile devices.
   We’re forcing the landscape orientation by default,
   and must still investigate large tablets (iPad Pro, Surface Pro 3, etc.). */

/* Custom selectors
   Syntax: @custom-selector :--variable selector
   The selectors you will use for flags/switches
   You can alternatively use classes or custom data-* attributes */

/* User view = paged | scrolled */

/* Font-family override */

/* Advanced settings */

/* Reading Modes */

/* Filters (images) */

/* Accessibility normalization */

/* Accessibility font. You can add selectors, using “, ” as a separator, if you have multiple fonts */

/* Direction i.e. ltr and rtl */

/* Readium CSS
   Pagination module

   A set of styles to paginate ePublications

   Repo: https://github.com/readium/readium-css */

/* Config */

/* Columns are responsive by default, even if column-width is set in pixels,
   which means two-page spread will switch to single page depending on current font-size.
   If you want more control, I’m afraid you’ll have to update colWidth/colGap dynamically,
   which is how a significant amount of RS do at the moment. */

/* Default for smartphone portrait (small screens) */

:root {
  /* Your columns’ width floor */
  --RS__colWidth: 45em; /* The width at which we’ll switch to 2 columns by default. PS: you can’t set it in rem */

  /* Ideal number of columns (depending on columns’ width floor) */
  --RS__colCount: 1;

  /* Gap between columns (in pixels so that it won’t resize with font-size) */
  --RS__colGap: 0;

  /* Optimal line-length (rem will take :root font-size into account, whatever the body’s font-size) */
  --RS__maxLineLength: 40rem;

  /* Default page horizontal margins (in pixels so that it won’t resize with font-size) */
  --RS__pageGutter: 20px; /* See if colGap and pageGutter can be the same var */
}

/* Reset page margins for Forward compatibility */

@page {
  margin: 0 !important;
}

/* :root selector has same specificity as a class i.e. 0010
   We might have to change that to html / context
   -> https://css-tricks.com/almanac/selectors/r/root/ */

:root {

  /* In case you use left position to scroll, can be removed if using transform: translateX() */
  position: relative;

  -webkit-column-width: var(--RS__colWidth);
  -moz-column-width: var(--RS__colWidth);
  column-width: var(--RS__colWidth);

  /* Init pagination */
  /* TODO: document columns’ logic cos it might feel weird at first */
  -webkit-column-count: var(--RS__colCount);
  -moz-column-count: var(--RS__colCount);
  column-count: var(--RS__colCount);

  -webkit-column-gap: var(--RS__colGap);
  -moz-column-gap: var(--RS__colGap);
  column-gap: var(--RS__colGap);

  /* Default is balance and we want columns to be filled entirely (100vh) */
  -moz-column-fill: auto;
  column-fill: auto;
  width: 100%;
  height: 100vh;
  max-width: 100%;
  max-height: 100vh;
  min-width: 100%;
  min-height: 100vh;
  padding: 0 !important;
  margin: 0 !important;

  /* Column size will depend on this if we want to make it responsive */
  font-size: 100% !important;

  -webkit-text-size-adjust: none;
  text-size-adjust: none;

  /* Switch to newer box model (not inherited by authors’ styles) */
  box-sizing: border-box;

  /* Fix bug for older Chrome */
  -webkit-perspective: 1;
  /* Prevents options pop-up when long tap in webkit */
  -webkit-touch-callout: none;
}

body {
  /*  overflow: hidden; bugfix: contents won’t paginate in Firefox and one sample in Safari */
  width: 100%;

  /* Limit line-length but we have to reset when 2 columns and control the viewport.
     By using max-width + margin auto, margins will shrink when font-size increases,
     which is what would be expected in terms of typography. */
  max-width: var(--RS__maxLineLength) !important;
  padding: 0 var(--RS__pageGutter) !important;
  margin: 0 auto !important;

  /* We need a minimum padding on body so that descandants/ascendants in italic/script are not cut-off.
     Drawback: we have to use border-box so that it doesn’t screw the box model,
     which means it impacts colWidth and max-width */
  box-sizing: border-box;
}

/* We’ll now redefine margins and columns depending on the minimum width available
   The goal is having the simplest model possible and avoid targeting devices */

/* Smartphone landscape */

@media screen and (min-width: 35em) {
  :root {
    --RS__pageGutter: 30px;
  }
}

/* Tablet portrait */

@media screen and (min-width: 45em) {
  :root {
    --RS__pageGutter: 40px;
  }
}

/* Desktop + tablet large */

/* We get the previous settings, we just change the margins */

@media screen and (min-width: 75em) {
  :root {
    --RS__pageGutter: 50px;
  }
}

/* At this point (80em or so), constraining line length must be done at the web view/iframe level, or by limiting the size of :root itself */

/* Responsive columns */

@media screen and (min-width: 60em), screen and (min-device-width: 36em) and (max-device-width: 47em) and (orientation: landscape) {
  :root {
    /* The size at which we want 2 columns to switch to 1 (depending on font-size) */
    --RS__colWidth: 20em; /* 20 * 16 = 320px but 20 * 28 = 560px so it will switch to 1 col @ 175% font-size (user-setting) on an iPad */
    /* We constrain to 2 columns so that we can never get 3 or 4, etc. */
    --RS__colCount: 2;
    --RS__maxLineLength: 39.99rem; /* If we don’t use this, colNumber user setting won’t work in Safari… */
  }
}

/* Readium CSS
   Scroll module

   A set of styles to scroll ePublications
   This module overrides pagination

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-scroll-on"] {

  /* Reset columns, auto + auto = columns can’t be created */
  -webkit-columns: auto auto !important;
  -moz-columns: auto auto !important;
  columns: auto auto !important;
  width: auto !important;
  height: auto !important;
  max-width: none !important;
  max-height: none !important;
  /* Reset html size so that the user can scroll */
  min-width: 0 !important;
  min-height: 0 !important;
}

/* Make sure line-length is limited in all configs */

:root[style*="readium-scroll-on"] body {
  --RS__maxLineLength: 40rem !important;
}

/* Readium CSS
   Night mode

   A preset theme for night mode

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

/* [style*="--USER__appearance"] can be used to increase specificity but performance hit */

:root[style*="readium-night-on"] {
  --RS__backgroundColor: #000000;
  --RS__textColor: #FEFEFE;

  --RS__linkColor: #63caff;
  --RS__visitedColor: #0099E5;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;
}

/* we don’t need to redeclare bg-color and color for :root since we will inherit and update from day/default mode */

:root[style*="readium-night-on"] *:not(a) {
  color: inherit !important;
  background-color: transparent !important;
  border-color: currentColor !important;
}

:root[style*="readium-night-on"] svg text {
  fill: currentColor !important;
  stroke: none !important;
}

:root[style*="readium-night-on"] a:link,
:root[style*="readium-night-on"] a:link * {
  color: var(--RS__linkColor) !important;
}

:root[style*="readium-night-on"] a:visited,
:root[style*="readium-night-on"] a:visited * {
  color: var(--RS__visitedColor) !important;
}

:root[style*="readium-night-on"] img[class*="gaiji"],
:root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
  -webkit-filter: invert(100%);
  filter: invert(100%);
}

/* Darken all images on user’s demand */

:root[style*="readium-night-on"][style*="readium-darken-on"] img {
  -webkit-filter: brightness(80%);
  filter: brightness(80%);
}

/* Invert all images on user’s demand */

:root[style*="readium-night-on"][style*="readium-invert-on"] img {
  -webkit-filter: invert(100%);
  filter: invert(100%);
}

/* Darken and invert on user’s demand */

:root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
  -webkit-filter: brightness(80%) invert(100%);
  filter: brightness(80%) invert(100%);
}

/* Readium CSS
   Sepia mode

   A preset theme for sepia mode

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root[style*="readium-sepia-on"] {
  --RS__backgroundColor: #faf4e8;
  --RS__textColor: #121212;

  --RS__linkColor: #0000EE;
  --RS__visitedColor: #551A8B;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;

  --RS__maxLineLength: 40.01rem; /* Forcing a reflow in Blink/Webkit so that blend mode can work */
}

/* we don’t need to redeclare bg-color and color for :root since we will inherit and update from day/default mode */

:root[style*="readium-sepia-on"] *:not(a) {
  color: inherit !important;
  background-color: transparent !important;
}

:root[style*="readium-sepia-on"] a:link,
:root[style*="readium-sepia-on"] a:link * {
  color: var(--RS__linkColor);
}

:root[style*="readium-sepia-on"] a:visited,
:root[style*="readium-sepia-on"] a:visited * {
  color: var(--RS__visitedColor);
}

:root[style*="readium-sepia-on"] svg,
:root[style*="readium-sepia-on"] img {
  /* Make sure the proper bg-color is used for the blend mode */
  background-color: transparent !important;
  mix-blend-mode: multiply;
}

/* Readium CSS
   OS Accessibility Modes

   A stylesheet to deal with OS accessibility settings

   Repo: https://github.com/readium/readium-css */

/* Windows high contrast colors are mapped to CSS system color keywords
   See http://www.gwhitworth.com/blog/2017/04/how-to-use-ms-high-contrast */

@media screen and (-ms-high-contrast: active) {
  :root {
    color: windowText !important;
    background-color: window !important;
  }

  /* The following selectors are super funky but it makes sure everything is inherited, this is indeed critical for this mode */
  :root :not(#\\#):not(#\\#):not(#\\#),
  :root :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#)
  :root :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#) {
    color: inherit !important;
    background-color: inherit !important;
  }

  .readiumCSS-mo-active-default {
    color: highlightText !important;
    background-color: highlight !important;
  }

  /* For links, hyperlink keyword is automatically set */

  /* Should we also set user highlights? */
}

@media screen and (-ms-high-contrast: white-on-black) {
  :root[style*="readium-night-on"] img[class*="gaiji"],
  :root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-invert-on"] img {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
    -webkit-filter: brightness(80%);
    filter: brightness(80%);
  }
}

/* Will be true on recent versions of iOS and MacOS if inverted setting enabled by the user */

@media screen and (inverted-colors) {
  :root[style*="readium-night-on"] img[class*="gaiji"],
  :root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-invert-on"] img {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
    -webkit-filter: brightness(80%);
    filter: brightness(80%);
  }
}

@media screen and (monochrome) {
  /* Grayscale (Implemented in Safari, what about eInk?) */
  /* Must deal with anything color (contrast) so must be managed at the night/sepia/theme level :( */
}

@media screen and (prefers-reduced-motion) {
  /* If reduced motion is set on MacOS, in case we have animation/transition */
}

/* Readium CSS
   Columns number pref

   A submodule managing columns number for user settings
   Part of “Chrome Advanced” class – no flag required.

   Repo: https://github.com/readium/readium-css */

/* Number of columns = 1 | 2 */

/* We still need to see if we allow users to force number of columns for all configs, currently it behaves as an "auto" setting */

/* apply col setting except for mobile portrait */

@media screen and (min-width: 60em), screen and (min-device-width: 36em) and (max-device-width: 47em) and (orientation: landscape) {
  :root[style*="--USER__colCount: 1"],
  :root[style*="--USER__colCount:1"],
  :root[style*="--USER__colCount: 2"],
  :root[style*="--USER__colCount:2"] {
    -webkit-column-count: var(--USER__colCount);
    -moz-column-count: var(--USER__colCount);
    column-count: var(--USER__colCount);
  }

  /* If one column, make sure we limit line-length */
  :root[style*="--USER__colCount: 1"],
  :root[style*="--USER__colCount:1"] {
    --RS__maxLineLength: 40rem !important; /* This is the only way for the user setting to work in webkit… */
    --RS__colWidth: 100vw;
  }

  /* If smartphone landscape, and 2 columns, col width the same as iPad landscape + desktop */
  :root[style*="--USER__colCount: 2"],
  :root[style*="--USER__colCount:2"] {
    --RS__colWidth: auto; /* User explicitely tells he/she wants 2 columns, we reset floor value */
  }
}

/* Readium CSS
   Page margins pref

   A submodule managing page margins for user settings
   Part of “Chrome Advanced” class – no flag required.

   Repo: https://github.com/readium/readium-css */

/* Page Margins: the user margin is a factor of the page gutter e.g. 0.5, 0.75, 1, 1.25, 1.5, etc. */

:root[style*="--USER__pageMargins"] body {
  padding: 0 calc(var(--RS__pageGutter) * var(--USER__pageMargins)) !important;
}

/* Readium CSS
   Custom colors pref

   A submodule managing custom colors for user settings
   Part of “Chrome Advanced” class – no flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="--USER__backgroundColor"] {
  background-color: var(--USER__backgroundColor) !important;
}

:root[style*="--USER__backgroundColor"] * {
  background-color: transparent !important;
}

:root[style*="--USER__textColor"] {
  color: var(--USER__textColor) !important;
}

:root[style*="--USER__textColor"] *:not(h1):not(h2):not(h3):not(h4):not(h5):not(h6):not(pre) {
  color: inherit !important;
}

/* Readium CSS
   Font Family pref

   A submodule managing font-family for user settings
   Part of “User Overrides” class – “font override” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-font-on"][style*="--USER__fontFamily"] {
  font-family: var(--USER__fontFamily) !important;
}

:root[style*="readium-font-on"][style*="--USER__fontFamily"] body,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] p,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] li,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] div,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] dt,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] dd {
  font-family: inherit !important;
}

:root[style*="readium-font-on"][style*="--USER__fontFamily"] i:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] i:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] em:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] em:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] cite:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] cite:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] b:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] b:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] strong:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] strong:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] span:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] span:not([xml\\:lang]) {
  font-family: inherit !important;
}

/* Readium CSS
   Font size pref

   A submodule managing font-size for user settings
   Part of “User Overrides” class – no flag required.

   Repo: https://github.com/readium/readium-css */

   :root[style*="--USER__fontSize"] > body {
    zoom:var(--USER__fontSize) !important;
  }

  @supports not (zoom: 1){
    :root[style*="--USER__fontSize"]{
      font-size:var(--USER__fontSize) !important;
    }
  }

/* Readium CSS
   Line height pref

   A submodule managing line-height for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] {
  line-height: var(--USER__lineHeight) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] body,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] p,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] li,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] div {
  line-height: inherit;
}

/* Readium CSS
   Para spacing pref

   A submodule managing paragraphs’ top and bottom margins for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__paraSpacing"] p {
  margin-top: var(--USER__paraSpacing) !important;
  margin-bottom: var(--USER__paraSpacing) !important;
}

/* Readium CSS
   Font size normalize

   A stylesheet to normalize font-size

   Repo: https://github.com/readium/readium-css */

/* STYLES */

/* :root is used so that you can quickly add a class or attribute if you prefer e.g. \`:root[data-rs-normalize]\` */

/* We create a default so that you don’t need to explicitly set one in the DOM.
   Once the “Publisher’s styles” checkbox is unchecked, the normalize is applied automatically */

@supports not (zoom: 1){

:root[style*="readium-advanced-on"] {
  --USER__typeScale: 1.2; /* This is the default type scale you’ll find in most publications */
}

:root[style*="readium-advanced-on"] p,
:root[style*="readium-advanced-on"] li,
:root[style*="readium-advanced-on"] div,
:root[style*="readium-advanced-on"] pre,
:root[style*="readium-advanced-on"] dd {
  font-size: 1rem !important;
}

:root[style*="readium-advanced-on"] h1 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.75rem !important;
  font-size: calc(((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h2 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.5rem !important;
  font-size: calc((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h3 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.25rem !important;
  font-size: calc(1rem * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h4,
:root[style*="readium-advanced-on"] h5,
:root[style*="readium-advanced-on"] h6 {
  font-size: 1rem !important;
}

:root[style*="readium-advanced-on"] small {
  font-size: smaller !important;
}

:root[style*="readium-advanced-on"] sub,
:root[style*="readium-advanced-on"] sup {
  font-size: 67.5% !important;
}

/* The following styles kick in if you define the typeScale variable in the DOM.
   No need to repeat declarations which don’t make use of the variable */

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h1 {
  font-size: calc(((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h2 {
  font-size: calc((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h3 {
  font-size: calc(1rem * var(--USER__typeScale)) !important;
}
}

/* Readium CSS
   Default highlights

   A stylesheet for user highlights

   Repo: https://github.com/readium/readium-css */

/* User Highlights */

.readiumCSS-yellow-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-yellow-highlight,
:root[style*="readium-night-on"] .readiumCSS-yellow-highlight {
  background-color: rgba(255, 255, 0, 0.5) !important;
}

.readiumCSS-green-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-green-highlight,
:root[style*="readium-night-on"] .readiumCSS-green-highlight {
  background-color: rgba(0, 255, 0, 0.5) !important;
}

.readiumCSS-orange-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-orange-highlight,
:root[style*="readium-night-on"] .readiumCSS-orange-highlight {
  background-color: rgba(255, 165, 0, 0.5) !important;
}

.readiumCSS-pink-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-pink-highlight,
:root[style*="readium-night-on"] .readiumCSS-pink-highlight {
  background-color: rgba(255, 105, 180, 0.5) !important;
}

/* Media overlays */

.readiumCSS-mo-active-default {
  color: black !important;
  background-color: yellow !important;
}
/*# sourceMappingURL=ReadiumCSS-after.css.map */
`, Hr = `/* Readium CSS 
   Config module

   A file allowing implementers to customize flags for reading modes,
   user settings, etc.

   Repo: https://github.com/readium/readium-css */

/* Custom medias
   Syntax: @custom-media --variable (prop: value) */

/* Responsive columns
   The minimum width for which responsive columns (2 -> 1 and vice versa,
   depending on the current font-size) must be enabled */

/* Mobile columns
   The minimum and maximum width for mobile devices.
   We’re forcing the landscape orientation by default,
   and must still investigate large tablets (iPad Pro, Surface Pro 3, etc.). */

/* Custom selectors
   Syntax: @custom-selector :--variable selector
   The selectors you will use for flags/switches
   You can alternatively use classes or custom data-* attributes */

/* User view = paged | scrolled */

/* Font-family override */

/* Advanced settings */

/* Reading Modes */

/* Filters (images) */

/* Accessibility normalization */

/* Accessibility font. You can add selectors, using “, ” as a separator, if you have multiple fonts */

/* Direction i.e. ltr and rtl */

/* Readium CSS
   Base module

   A minimal stylesheet for all ebooks

   Repo: https://github.com/readium/readium-css */

@namespace url("http://www.w3.org/1999/xhtml");

@namespace epub url("http://www.idpf.org/2007/ops");

@namespace m url("http://www.w3.org/1998/Math/MathML/");

@namespace svg url("http://www.w3.org/2000/svg");

/* Define viewport, HTML5-style */

@-ms-viewport {
  width: device-width;
}

@viewport {
  width: device-width;
  zoom: 1;
}

:root {
  /* Default font-stacks */
  --RS__oldStyleTf: "Iowan Old Style", "Sitka Text", Palatino, "Book Antiqua", serif;
  --RS__modernTf: Athelas, Constantia, Georgia, serif;
  --RS__sansTf: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --RS__humanistTf: Seravek, Calibri, Roboto, Arial, sans-serif;
  --RS__monospaceTf: "Andale Mono", Consolas, monospace;

  /* Config */
  --RS__baseFontFamily: var(--RS__oldStyleTf);

  /* For square-ish fonts (CJK, Indic, etc.), we must apply some compensation in dynamic leading. Default is 1 i.e. no compensation */
  --RS__lineHeightCompensation: 1;

  /* Dynamic leading based on typeface metrics + font-size setting */
  --RS__baseLineHeight: calc((1em + (2ex - 1ch) - ((1rem - 16px) * 0.1667)) * var(--RS__lineHeightCompensation));
}

/* Set default font for the html doc, so that it can be overridden by the authors’s stylesheet */

html {
  font-family: var(--RS__baseFontFamily);
  /* Fallback line-height */
  line-height: 1.6; /* Fits a little bit better for all languages than 1.5 */
  line-height: var(--RS__baseLineHeight);
  text-rendering: optimizeLegibility;
}

/* 1.5 being too loose with larger font-sizes, we reset headings to normal (which value is 1.125–1.375 for our font-stacks) */

h1, h2, h3 {
  line-height: normal;
}

:lang(ja),
:lang(zh),
:lang(ko) {
  word-wrap: break-word;
  -webkit-line-break: strict;
  -epub-line-break: strict;
  line-break: strict;
}

/* Set default font for Math */

math {
  font-family: "Latin Modern Math", "STIX Two Math", "XITS Math", "STIX Math", "Libertinus Math", "TeX Gyre Termes Math", "TeX Gyre Bonum Math", "TeX Gyre Schola", "DejaVu Math TeX Gyre", "TeX Gyre Pagella Math", "Asana Math", "Cambria Math", "Lucida Bright Math", "Minion Math", STIXGeneral, STIXSizeOneSym, Symbol, "Times New Roman", serif;
}

/* Language Overrides
   That will only work if either html or body have a (xml:)lang attribute, not for inline overrides */

:lang(am) {
  --RS__baseFontFamily: Kefa, Nyala, Roboto, Noto, "Noto Sans Ethiopic", serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(ar) {
  --RS__baseFontFamily: "Geeza Pro", "Arabic Typesetting", Roboto, Noto, "Noto Naskh Arabic", "Times New Roman", serif;
}

:lang(bn) {
  --RS__baseFontFamily: "Kohinoor Bangla", "Bangla Sangam MN", Vrinda, Roboto, Noto, "Noto Sans Bengali", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(bo) {
  --RS__baseFontFamily: Kailasa, "Microsoft Himalaya", Roboto, Noto, "Noto Sans Tibetan", sans-serif;
}

:lang(chr) {
  --RS__baseFontFamily: "Plantagenet Cherokee", Roboto, Noto, "Noto Sans Cherokee";
  --RS__lineHeightCompensation: 1.167;
}

:lang(fa) {
  --RS__baseFontFamily: "Geeza Pro", "Arabic Typesetting", Roboto, Noto, "Noto Naskh Arabic", "Times New Roman", serif;
}

:lang(gu) {
  --RS__baseFontFamily: "Gujarati Sangam MN", "Nirmala UI", Shruti, Roboto, Noto, "Noto Sans Gujarati", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(he) {
  --RS__baseFontFamily: "New Peninim MT", "Arial Hebrew", Gisha, "Times New Roman", Roboto, Noto, "Noto Sans Hebrew" sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(hi) {
  --RS__baseFontFamily: "Kohinoor Devanagari", "Devanagari Sangam MN", Kokila, "Nirmala UI", Roboto, Noto, "Noto Sans Devanagari", sans-serif;

  --RS__lineHeightCompensation: 1.1;
}

:lang(hy) {
  --RS__baseFontFamily: Mshtakan, Sylfaen, Roboto, Noto, "Noto Serif Armenian", serif;
}

:lang(iu) {
  --RS__baseFontFamily: "Euphemia UCAS", Euphemia, Roboto, Noto, "Noto Sans Canadian Aboriginal", sans-serif;
}

:lang(ja) {
  --RS__baseFontFamily: YuGothic, "Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Meiryo UI", "MS Gothic", Roboto, Noto, "Noto Sans CJK JP", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;

  /* Extra variables for Japanese font-stacks as we may want to reuse them for user settings + default */
  /* This setting uses the BIZ UD font for serif and the Yu font for sans serif on Windows. Note: When using the BIZ UD font for vertical writing display, if you set half-width (ASCII) characters to stand upright with \`text-orientation: upright\`, the width of these characters is narrow. By specifying \`font-variant-east-asian: full-width;\` at the same time, you can display the characters with the width of one full-width character. */
  --RS__serif-ja: "Hiragino Mincho ProN", "Hiragino Mincho Pro", "YuMincho", "BIZ UDPMincho", "Yu Mincho", "ＭＳ Ｐ明朝", "MS PMincho", serif;
  --RS__sans-serif-ja: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Hiragino Kaku Gothic Pro", "ヒラギノ角ゴ W3", "YuGothic", "Yu Gothic Medium", "BIZ UDPGothic", "Yu Gothic", "ＭＳ Ｐゴシック", "MS PGothic", sans-serif;
  --RS__serif-ja-v: "Hiragino Mincho ProN", "Hiragino Mincho Pro", "YuMincho", "BIZ UDMincho", "Yu Mincho", "ＭＳ明朝", "MS Mincho", serif;
  --RS__sans-serif-ja-v: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Hiragino Kaku Gothic Pro", "ヒラギノ角ゴ W3", "YuGothic", "Yu Gothic Medium", "BIZ UDGothic", "Yu Gothic", "ＭＳゴシック", "MS Gothic", sans-serif;
}

:lang(km) {
  --RS__baseFontFamily: "Khmer Sangam MN", "Leelawadee UI", "Khmer UI", Roboto, Noto, "Noto Sans Khmer", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(kn) {
  --RS__baseFontFamily: "Kannada Sangam MN", "Nirmala UI", Tunga, Roboto, Noto, "Noto Sans Kannada", sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(ko) {
  --RS__baseFontFamily: "Nanum Gothic", "Apple SD Gothic Neo", "Malgun Gothic", Roboto, Noto, "Noto Sans CJK KR", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(lo) {
  --RS__baseFontFamily: "Lao Sangam MN", "Leelawadee UI", "Lao UI", Roboto, Noto, "Noto Sans Lao", sans-serif;
}

:lang(ml) {
  --RS__baseFontFamily: "Malayalam Sangam MN", "Nirmala UI", Kartika, Roboto, Noto, "Noto Sans Malayalam", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(or) {
  --RS__baseFontFamily: "Oriya Sangam MN", "Nirmala UI", Kalinga, Roboto, Noto, "Noto Sans Oriya", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(pa) {
  --RS__baseFontFamily: "Gurmukhi MN", "Nirmala UI", Kartika, Roboto, Noto, "Noto Sans Gurmukhi", sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(si) {
  --RS__baseFontFamily: "Sinhala Sangam MN", "Nirmala UI", "Iskoola Pota", Roboto, Noto, "Noto Sans Sinhala", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(ta) {
  --RS__baseFontFamily: "Tamil Sangam MN", "Nirmala UI", Latha, Roboto, Noto, "Noto Sans Tamil", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(te) {
  --RS__baseFontFamily: "Kohinoor Telugu", "Telugu Sangam MN", "Nirmala UI", Gautami, Roboto, Noto, "Noto Sans Telugu", sans-serif;
}

:lang(th) {
  --RS__baseFontFamily: "Thonburi", "Leelawadee UI", "Cordia New", Roboto, Noto, "Noto Sans Thai", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

/* The following will also work for zh-Hans */

:lang(zh) {
  --RS__baseFontFamily: "方体", "PingFang SC", "黑体", "Heiti SC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK SC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(zh-Hant),
:lang(zh-TW) {
  --RS__baseFontFamily: "方體", "PingFang TC", "黑體", "Heiti TC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK TC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(zh-HK) {
  --RS__baseFontFamily: "方體", "PingFang HK", "方體", "PingFang TC", "黑體", "Heiti TC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK TC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

/* Readium CSS
   Day/Default mode

   A preset theme for day mode, which is the default

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root {
  --RS__backgroundColor: #FFFFFF;
  --RS__textColor: #121212;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;
}

:root {
  color: var(--RS__textColor) !important;
  background-color: var(--RS__backgroundColor) !important;
}

/* Note: Though \`::selection\` was present in drafts of CSS Selectors Level 3, it was removed during the Candidate Recommendation phase because its behavior was under-specified (especially with nested elements) and interoperability wasn’t achieved. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/::selection */

::-moz-selection {
  color: var(--RS__selectionTextColor);
  background-color: var(--RS__selectionBackgroundColor);
}

::selection {
  color: var(--RS__selectionTextColor);
  background-color: var(--RS__selectionBackgroundColor);
}

/* @import "modules/ReadiumCSS-fonts.css"; */

/* Readium CSS
   HTML5 SR Patch stylesheet

   A set of style to adjust HTML5 Suggested Rendering to paginated content

   Repo: https://github.com/readium/readium-css */

/* Fragmentation */

body {
  widows: 2;
  orphans: 2;
}

figcaption, th, td {
  widows: 1;
  orphans: 1;
}

h2,
h3,
h4,
h5,
h6,
dt,
hr,
caption {
  -webkit-column-break-after: avoid;
  page-break-after: avoid;
  break-after: avoid;
}

h1,
h2,
h3,
h4,
h5,
h6,
dt,
figure,
tr {
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Hyphenation */

body {
  -webkit-hyphenate-character: "\\002D";
  -moz-hyphenate-character: "\\002D";
  -ms-hyphenate-character: "\\002D";
  hyphenate-character: "\\002D";
  -webkit-hyphenate-limit-lines: 3;
  -ms-hyphenate-limit-lines: 3;
  hyphenate-limit-lines: 3;
}

h1,
h2,
h3,
h4,
h5,
h6,
dt,
figcaption,
pre,
caption,
address,
center,
code,
var {
  -ms-hyphens: none;
  -moz-hyphens: none;
  -webkit-hyphens: none;
  -epub-hyphens: none;
  hyphens: none;
}

/* OTF */

body {
  font-variant-numeric: oldstyle-nums proportional-nums;
}

:lang(ja) body,
:lang(zh) body,
:lang(ko) body {
  font-variant-numeric: lining-nums proportional-nums;
}

h1, h2, h3, h4, h5, h6, dt {
  font-variant-numeric: lining-nums proportional-nums;
}

table {
  font-variant-numeric: lining-nums tabular-nums;
}

code, var {
  font-variant-ligatures: none;
  font-variant-numeric: lining-nums tabular-nums slashed-zero;
}

rt {
  font-variant-east-asian: ruby;
}

:lang(ar) {
  font-variant-ligatures: common-ligatures;
}

:lang(ko) {
  font-kerning: normal;
}

/* Night mode */

hr {
  color: inherit;
  border-color: currentColor;
}

table, th, td {
  border-color: currentColor;
}

/* Horizontal Spacing */

figure, blockquote {
  margin: 1em 5%;
}

/*

:lang(ja) figure, :lang(ja) blockquote,
:lang(zh-Hant) figure, :lang(zh-Hant) blockquote,
:lang(zh-TW) figure, :lang(zh-TW) blockquote,
:lang(mn) figure, :lang(mn) blockquote {
  margin: 5% 1em;
}

*/

ul, ol {
  padding-left: 5%;
}

/*

:lang(ja) ul, :lang(ja) ol,
:lang(zh-Hant) ul, :lang(zh-Hant) ol,
:lang(zh-TW) ul, :lang(zh-TW) ol,
:lang(mn) ul, :lang(mn) ol   {
  padding-top: 5%;
}

*/

dd {
  margin-left: 5%;
}

/*

:lang(ja) dd,
:lang(zh-Hant) dd,
:lang(zh-TW) dd,
:lang(mn) dd {
  margin-top: 5%;
}

*/

pre {
  white-space: pre-wrap;
  -ms-tab-size: 2;
  -moz-tab-size: 2;
  -webkit-tab-size: 2;
  tab-size: 2;
}

/* Normalization */

abbr[title], acronym[title] {
  text-decoration: dotted underline;
}

nobr wbr {
  white-space: normal;
}

/* Make ruby text and parentheses non-selectable (TBC) */

ruby > rt, ruby > rp {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* Internationalization */

*:lang(ja),
*:lang(zh),
*:lang(ko),
:lang(ja) cite,
:lang(ja) dfn,
:lang(ja) em,
:lang(ja) i,
:lang(zh) cite,
:lang(zh) dfn,
:lang(zh) em,
:lang(zh) i,
:lang(ko) cite,
:lang(ko) dfn,
:lang(ko) em,
:lang(ko) i {
  font-style: normal;
}

:lang(ja) a,
:lang(zh) a,
:lang(ko) a {
  text-decoration: none;
}

/* Readium CSS
   Safeguards module

   A set of styles to prevent common issues in pagination

   Repo: https://github.com/readium/readium-css */

/* Config */

/* We’ll be using an "RS__" prefix so that we can prevent collisions with authors’ CSS */

:root {
  /* max-width for media, you can override that via JS if not compiled to static */
  --RS__maxMediaWidth: 100%;

  /* max-height for media, you can override that via JS if not compiled to static
     Please consider figures might have a figcaption, which is why 95vh in the first place */
  --RS__maxMediaHeight: 95vh;

  /* value for medias’ box-sizing */
  --RS__boxSizingMedia: border-box;

  /* value for table’s box-sizing */
  --RS__boxSizingTable: border-box;
}

/* Sanitize line-heights in webkit e.g. raised cap without a declared line-height
   See effect by checking this demo in Safari: https://codepen.io/JayPanoz/pen/gRmzrE
   Note: glyphs has to be reset to inline for CJK */

html {
  -webkit-line-box-contain: block glyphs replaced;
}

:lang(ja) {
  -webkit-line-box-contain: block inline replaced;
}

/* Wrap long strings if larger than line-length */

a, h1, h2, h3, h4, h5, h6 {
  word-wrap: break-word;
}

div {
  max-width: var(--RS__maxMediaWidth);
}

/* Size medias */

/* You can override CSS variables by re-defining it for all elements or a specific one */

img, svg, audio, video {

  /* Object-fit allows us to keep the correct aspect-ratio */
  object-fit: contain;

  width: auto;
  height: auto;

  /* Some files don’t have max-width */
  max-width: var(--RS__maxMediaWidth);

  /* We’re setting a max-height, especially for covers */
  max-height: var(--RS__maxMediaHeight) !important;
  /* We probably don’t need to use modern box-sizing as auto behaves like it */
  box-sizing: var(--RS__boxSizingMedia);

  /* For page-break, we must use those 3
     We can’t use a variable there, webkit seems to no support them for those properties */
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Try preventing border being cut-off, webkit + blink have content-box by default */

table {
  max-width: var(--RS__maxMediaWidth);
  box-sizing: var(--RS__boxSizingTable);
}
/*# sourceMappingURL=ReadiumCSS-before.css.map */`, Dr = `/* Readium CSS
   Default module for CJK horizontal writing

   A stylesheet for unstyled ebooks based on HTML5 Suggested Rendering
   Note: works in combination with Base module

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root {
  /* Extra variables for Japanese font-stacks:
     • --RS__serif-ja;
     • --RS__sans-serif-ja.

     They can be used instead of --RS__baseFontFamily and --RS__compFontFamily */

  --RS__compFontFamily: var(--RS__baseFontFamily);
  --RS__codeFontFamily: var(--RS__monospaceTf);

  --RS__typeScale: 1.125; /* 1.067 | 1.125 | 1.2 | 1.25 | 1.333 | 1.414 | 1.5 | 1.618 */
  --RS__baseFontSize: 87.5%;

  --RS__flowSpacing: 1.5rem;
  --RS__paraSpacing: 0;
  --RS__paraIndent: 1em;

  --RS__linkColor: #0000EE;
  --RS__visitedColor: #551A8B;

  --RS__primaryColor: ;
  --RS__secondaryColor: ;
}

/* STYLES */

/* Typo */

:root {
  quotes: "\\201c" "\\201d" "\\2018" "\\2019";
}

body {
  font-size: var(--RS__baseFontSize);
  text-align: justify;
  text-justify: inter-character;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--RS__baseFontFamily);
  text-align: left;
  text-align: start;
}

/* Flow content */

blockquote,
figure,
p,
pre,
aside,
footer,
form,
hr {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
}

p {
  margin-top: var(--RS__paraSpacing);
  margin-bottom: var(--RS__paraSpacing);
  text-indent: var(--RS__paraIndent);
}

h1 + p,
h2 + p,
h3 + p,
h4 + p,
h5 + p,
h6 + p,
hr + p {
  text-indent: 0;
}

pre {
  font-family: var(--RS__codeFontFamily);
}

/* Phrasing content */

code, kbd, samp, tt {
  font-family: var(--RS__codeFontFamily);
}

sub, sup {
  position: relative;
  font-size: 67.5%;
  line-height: 1;
}

sub {
  bottom: -0.2ex;
}

sup {
  bottom: 0;
}

em {
  -webkit-text-emphasis: dot;
  -epub-text-emphasis: dot;
  text-emphasis: dot;
}

:link {
  color: var(--RS__linkColor);
}

:visited {
  color: var(--RS__visitedColor);
}

/* Headings */

h1 {
  margin-top: calc(var(--RS__flowSpacing) * 2);
  margin-bottom: calc(var(--RS__flowSpacing) * 2);
  /* The following is base font size * typescale power of 3 */
  font-size: calc(((1em * var(--RS__typeScale)) * var(--RS__typeScale)) * var(--RS__typeScale));
  text-align: center;
}

h2 {
  margin-top: calc(var(--RS__flowSpacing) * 2);
  margin-bottom: var(--RS__flowSpacing);
  /* The following is base font size * typescale power of 2 */
  font-size: calc((1em * var(--RS__typeScale)) * var(--RS__typeScale));
  text-align: center;
}

h3 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
  font-size: calc(1em * var(--RS__typeScale));
  text-align: center;
}

h4 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
  font-family: var(--RS__compFontFamily);
  font-size: 1em;
}

h5 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
  font-family: var(--RS__compFontFamily);
  font-size: smaller;
}

h6 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: 0;
  font-family: var(--RS__compFontFamily);
  font-size: smaller;
  font-weight: normal;
}

/* Lists */

dl, ol, ul {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
}

/* Table */

table {
  margin: var(--RS__flowSpacing) 0;
  border: 1px solid currentColor;
  border-collapse: collapse;
  empty-cells: show;
}

thead, tbody, tfoot, table > tr {
  vertical-align: top;
}

th {
  text-align: left;
}

th, td {
  padding: 4px;
  border: 1px solid currentColor;
}
/*# sourceMappingURL=ReadiumCSS-default.css.map */`, Or = `/* Readium CSS
   Config module

   A file allowing implementers to customize flags for reading modes,
   user settings, etc.

   Repo: https://github.com/readium/readium-css */

/* Custom medias
   Syntax: @custom-media --variable (prop: value) */

/* Responsive columns
   The minimum width for which responsive columns (2 -> 1 and vice versa,
   depending on the current font-size) must be enabled */

/* Mobile columns
   The minimum and maximum width for mobile devices.
   We’re forcing the landscape orientation by default,
   and must still investigate large tablets (iPad Pro, Surface Pro 3, etc.). */

/* Custom selectors
   Syntax: @custom-selector :--variable selector
   The selectors you will use for flags/switches
   You can alternatively use classes or custom data-* attributes */

/* User view = paged | scrolled */

/* Font-family override */

/* Advanced settings */

/* Reading Modes */

/* Filters (images) */

/* Accessibility normalization */

/* Accessibility font. You can add selectors, using “, ” as a separator, if you have multiple fonts */

/* Direction i.e. ltr and rtl */

/* Readium CSS
   Pagination module for vertical writing

   A set of styles to paginate ePublications in “writing-mode: vertical-*”

   Repo: https://github.com/readium/readium-css */

/* Config */

/* We must simplify the pagination model for vertical writing, and can’t fake spreads. */

/* Default for smartphone portrait (small screens) */

:root {
  /* The column will be the height of the web view/iframe */
  --RS__colWidth: 100vh;

  /* Since columns are laid out on the y-axis in vertical-*, we can only use 1 */
  --RS__colCount: 1;

  /* Gap between columns (in pixels so that it won’t resize with font-size) */
  --RS__colGap: 0;

  /* Optimal line-length (rem will take :root font-size into account, whatever the body’s font-size) */
  --RS__maxLineLength: 40rem;

  /* Default page vertical margins (in pixels so that it won’t resize with font-size) */
  --RS__pageGutter: 20px; /* See if colGap and pageGutter can be the same var */
}

/* Reset page margins for Forward compatibility */

@page {
  margin: 0 !important;
}

/* :root selector has same specificity as a class i.e. 0010
   We might have to change that to html / context
   -> https://css-tricks.com/almanac/selectors/r/root/ */

:root {

  /* In case you use left position to scroll, can be removed if using transform: translateX() */
  position: relative;

  -webkit-column-width: var(--RS__colWidth);
  -moz-column-width: var(--RS__colWidth);
  column-width: var(--RS__colWidth);

  /* Init pagination */
  /* TODO: document columns’ logic cos it might feel weird at first */
  -webkit-column-count: var(--RS__colCount);
  -moz-column-count: var(--RS__colCount);
  column-count: var(--RS__colCount);

  -webkit-column-gap: var(--RS__colGap);
  -moz-column-gap: var(--RS__colGap);
  column-gap: var(--RS__colGap);

  /* Default is balance and we want columns to be filled entirely (100vh) */
  -moz-column-fill: auto;
  column-fill: auto;
  width: 100%;
  height: 100vh;
  max-width: 100%;
  max-height: 100vh;
  min-width: 100%;
  min-height: 100vh;
  padding: 0 var(--RS__pageGutter) !important;
  margin: 0 !important;

  /* Column size will depend on this if we want to make it responsive */
  font-size: 100% !important;

  -webkit-text-size-adjust: none;
  text-size-adjust: none;

  /* Switch to newer box model (not inherited by authors’ styles) */
  box-sizing: border-box;

  hanging-punctuation: last allow-end;

  /* Fix bug for older Chrome */
  -webkit-perspective: 1;
  /* Prevents options pop-up when long tap in webkit */
  -webkit-touch-callout: none;

  /* The reason why we don’t force -webkit-column-axis is that it switches the column-box model to a paged overflow model.
     In other words, columns become useless, the sizing of the :root itself will be used for pagination */

  /* Ensure the correct writing-mode is used */
  -ms-writing-mode: tb-rl;
  -webkit-writing-mode: vertical-rl;
  writing-mode: vertical-rl;
}

:root:lang(mn-Mong) {
  /* Ensure the correct writing-mode is used for mongolian if vertical */
  -ms-writing-mode: tb;
  -webkit-writing-mode: vertical-lr;
  writing-mode: vertical-lr;
}

body {
  /*  overflow: hidden; bugfix: contents won’t paginate in Firefox and one sample in Safari */
  width: 100%;

  /* Limit line-length but we have to reset when 2 columns and control the viewport.
     By using max-width + margin auto, margins will shrink when font-size increases,
     which is what would be expected in terms of typography. */
  max-height: var(--RS__maxLineLength) !important;
  padding: var(--RS__pageGutter) 0 !important;
  margin: auto 0 !important;

  /* We need a minimum padding on body so that descandants/ascendants in italic/script are not cut-off.
     Drawback: we have to use border-box so that it doesn’t screw the box model,
     which means it impacts colWidth and max-width */
  box-sizing: border-box;
}

/* We’ll now redefine margins and columns depending on the minimum width available
   The goal is having the simplest model possible and avoid targeting devices */

/* Smartphone landscape */

@media screen and (min-width: 35em) {
  :root {
    --RS__pageGutter: 30px;
  }
}

/* Tablet portrait */

@media screen and (min-width: 45em) {
  :root {
    --RS__pageGutter: 40px;
  }
}

/* Desktop small + phablet + tablet landscape */

@media screen and (min-width: 60em) {
  :root {
    --RS__pageGutter: 50px;
  }
}

/* Desktop + tablet large */

/* We get the previous settings, we just change the margins */

@media screen and (min-width: 75em) {
  :root {
    --RS__pageGutter: 60px;
  }
}

/* At this point (80em or so), constraining line length must be done at the web view/iframe level, or by limiting the size of :root itself */

/* Readium CSS
   Scroll module for vertical-writing

   A set of styles to scroll ePublications in “writing-mode: vertical-*”
   This module overrides pagination

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-scroll-on"] {

  /* Reset columns, auto + auto = columns can’t be created */
  /* There is a weird gap in Safari/Webkit, as if overflow paged-x… */
  -webkit-columns: auto auto !important;
  -moz-columns: auto auto !important;
  columns: auto auto !important;
  width: auto !important;
  max-width: none !important;
  max-height: 100vh !important;
  /* Reset html size so that the user can scroll */
  min-width: 0 !important;
}

/* Make sure line-length is limited in all configs */

:root[style*="readium-scroll-on"] body {
  --RS__maxLineLength: 40.01rem !important; /* Fixes fragmentation update issues in Webkit i.e. value must be slightly different than the one for pagination */
}

/* Scroll mode horizontal */

/* Do we add a top/bottom margin for body in vertical scroll or not? */

/* Readium CSS
   Night mode

   A preset theme for night mode

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

/* [style*="--USER__appearance"] can be used to increase specificity but performance hit */

:root[style*="readium-night-on"] {
  --RS__backgroundColor: #000000;
  --RS__textColor: #FEFEFE;

  --RS__linkColor: #63caff;
  --RS__visitedColor: #0099E5;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;
}

/* we don’t need to redeclare bg-color and color for :root since we will inherit and update from day/default mode */

:root[style*="readium-night-on"] *:not(a) {
  color: inherit !important;
  background-color: transparent !important;
  border-color: currentColor !important;
}

:root[style*="readium-night-on"] svg text {
  fill: currentColor !important;
  stroke: none !important;
}

:root[style*="readium-night-on"] a:link,
:root[style*="readium-night-on"] a:link * {
  color: var(--RS__linkColor) !important;
}

:root[style*="readium-night-on"] a:visited,
:root[style*="readium-night-on"] a:visited * {
  color: var(--RS__visitedColor) !important;
}

:root[style*="readium-night-on"] img[class*="gaiji"],
:root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
  -webkit-filter: invert(100%);
  filter: invert(100%);
}

/* Darken all images on user’s demand */

:root[style*="readium-night-on"][style*="readium-darken-on"] img {
  -webkit-filter: brightness(80%);
  filter: brightness(80%);
}

/* Invert all images on user’s demand */

:root[style*="readium-night-on"][style*="readium-invert-on"] img {
  -webkit-filter: invert(100%);
  filter: invert(100%);
}

/* Darken and invert on user’s demand */

:root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
  -webkit-filter: brightness(80%) invert(100%);
  filter: brightness(80%) invert(100%);
}

/* Readium CSS
   Sepia mode

   A preset theme for sepia mode

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root[style*="readium-sepia-on"] {
  --RS__backgroundColor: #faf4e8;
  --RS__textColor: #121212;

  --RS__linkColor: #0000EE;
  --RS__visitedColor: #551A8B;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;

  --RS__maxLineLength: 40.01rem; /* Forcing a reflow in Blink/Webkit so that blend mode can work */
}

/* we don’t need to redeclare bg-color and color for :root since we will inherit and update from day/default mode */

:root[style*="readium-sepia-on"] *:not(a) {
  color: inherit !important;
  background-color: transparent !important;
}

:root[style*="readium-sepia-on"] a:link,
:root[style*="readium-sepia-on"] a:link * {
  color: var(--RS__linkColor);
}

:root[style*="readium-sepia-on"] a:visited,
:root[style*="readium-sepia-on"] a:visited * {
  color: var(--RS__visitedColor);
}

:root[style*="readium-sepia-on"] svg,
:root[style*="readium-sepia-on"] img {
  /* Make sure the proper bg-color is used for the blend mode */
  background-color: transparent !important;
  mix-blend-mode: multiply;
}

/* Readium CSS
   OS Accessibility Modes

   A stylesheet to deal with OS accessibility settings

   Repo: https://github.com/readium/readium-css */

/* Windows high contrast colors are mapped to CSS system color keywords
   See http://www.gwhitworth.com/blog/2017/04/how-to-use-ms-high-contrast */

@media screen and (-ms-high-contrast: active) {
  :root {
    color: windowText !important;
    background-color: window !important;
  }

  /* The following selectors are super funky but it makes sure everything is inherited, this is indeed critical for this mode */
  :root :not(#\\#):not(#\\#):not(#\\#),
  :root :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#)
  :root :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#) {
    color: inherit !important;
    background-color: inherit !important;
  }

  .readiumCSS-mo-active-default {
    color: highlightText !important;
    background-color: highlight !important;
  }

  /* For links, hyperlink keyword is automatically set */

  /* Should we also set user highlights? */
}

@media screen and (-ms-high-contrast: white-on-black) {
  :root[style*="readium-night-on"] img[class*="gaiji"],
  :root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-invert-on"] img {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
    -webkit-filter: brightness(80%);
    filter: brightness(80%);
  }
}

/* Will be true on recent versions of iOS and MacOS if inverted setting enabled by the user */

@media screen and (inverted-colors) {
  :root[style*="readium-night-on"] img[class*="gaiji"],
  :root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-invert-on"] img {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
    -webkit-filter: brightness(80%);
    filter: brightness(80%);
  }
}

@media screen and (monochrome) {
  /* Grayscale (Implemented in Safari, what about eInk?) */
  /* Must deal with anything color (contrast) so must be managed at the night/sepia/theme level :( */
}

@media screen and (prefers-reduced-motion) {
  /* If reduced motion is set on MacOS, in case we have animation/transition */
}

/* Readium CSS
   Page margins pref

   A submodule managing page margins for user settings
   Part of “Chrome Advanced” class – no flag required.

   Repo: https://github.com/readium/readium-css */

/* Page Margins: the user margin is a factor of the page gutter e.g. 0.5, 0.75, 1, 1.25, 1.5, etc. */

:root[style*="--USER__pageMargins"] body {
  padding: calc(var(--RS__pageGutter) * var(--USER__pageMargins)) 0 !important;
}

/* Readium CSS
   Custom colors pref

   A submodule managing custom colors for user settings
   Part of “Chrome Advanced” class – no flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="--USER__backgroundColor"] {
  background-color: var(--USER__backgroundColor) !important;
}

:root[style*="--USER__backgroundColor"] * {
  background-color: transparent !important;
}

:root[style*="--USER__textColor"] {
  color: var(--USER__textColor) !important;
}

:root[style*="--USER__textColor"] *:not(h1):not(h2):not(h3):not(h4):not(h5):not(h6):not(pre) {
  color: inherit !important;
}

/* Readium CSS
   Font Family pref

   A submodule managing font-family for user settings
   Part of “User Overrides” class – “font override” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-font-on"][style*="--USER__fontFamily"] {
  font-family: var(--USER__fontFamily) !important;
}

:root[style*="readium-font-on"][style*="--USER__fontFamily"] body,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] p,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] li,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] div,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] dt,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] dd {
  font-family: inherit !important;
}

:root[style*="readium-font-on"][style*="--USER__fontFamily"] i:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] i:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] em:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] em:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] cite:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] cite:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] b:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] b:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] strong:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] strong:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] span:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] span:not([xml\\:lang]) {
  font-family: inherit !important;
}

/* Readium CSS
   Font size pref

   A submodule managing font-size for user settings
   Part of “User Overrides” class – no flag required.

   Repo: https://github.com/readium/readium-css */

   :root[style*="--USER__fontSize"] > body {
    zoom:var(--USER__fontSize) !important;
  }

  @supports not (zoom: 1){
    :root[style*="--USER__fontSize"]{
      font-size:var(--USER__fontSize) !important;
    }
  }

/* Readium CSS
   Line height pref

   A submodule managing line-height for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] {
  line-height: var(--USER__lineHeight) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] body,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] p,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] li,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] div {
  line-height: inherit;
}

/* Readium CSS
   Para spacing pref

   A submodule managing paragraphs’ top and bottom margins for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__paraSpacing"] p {
  margin-right: var(--USER__paraSpacing) !important;
  margin-left: var(--USER__paraSpacing) !important;
}

/* Readium CSS
   Font size normalize

   A stylesheet to normalize font-size

   Repo: https://github.com/readium/readium-css */

/* STYLES */

/* :root is used so that you can quickly add a class or attribute if you prefer e.g. \`:root[data-rs-normalize]\` */

/* We create a default so that you don’t need to explicitly set one in the DOM.
   Once the “Publisher’s styles” checkbox is unchecked, the normalize is applied automatically */

@supports not (zoom: 1){

:root[style*="readium-advanced-on"] {
  --USER__typeScale: 1.2; /* This is the default type scale you’ll find in most publications */
}

:root[style*="readium-advanced-on"] p,
:root[style*="readium-advanced-on"] li,
:root[style*="readium-advanced-on"] div,
:root[style*="readium-advanced-on"] pre,
:root[style*="readium-advanced-on"] dd {
  font-size: 1rem !important;
}

:root[style*="readium-advanced-on"] h1 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.75rem !important;
  font-size: calc(((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h2 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.5rem !important;
  font-size: calc((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h3 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.25rem !important;
  font-size: calc(1rem * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h4,
:root[style*="readium-advanced-on"] h5,
:root[style*="readium-advanced-on"] h6 {
  font-size: 1rem !important;
}

:root[style*="readium-advanced-on"] small {
  font-size: smaller !important;
}

:root[style*="readium-advanced-on"] sub,
:root[style*="readium-advanced-on"] sup {
  font-size: 67.5% !important;
}

/* The following styles kick in if you define the typeScale variable in the DOM.
   No need to repeat declarations which don’t make use of the variable */

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h1 {
  font-size: calc(((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h2 {
  font-size: calc((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h3 {
  font-size: calc(1rem * var(--USER__typeScale)) !important;
}
}

/* Readium CSS
   Default highlights

   A stylesheet for user highlights

   Repo: https://github.com/readium/readium-css */

/* User Highlights */

.readiumCSS-yellow-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-yellow-highlight,
:root[style*="readium-night-on"] .readiumCSS-yellow-highlight {
  background-color: rgba(255, 255, 0, 0.5) !important;
}

.readiumCSS-green-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-green-highlight,
:root[style*="readium-night-on"] .readiumCSS-green-highlight {
  background-color: rgba(0, 255, 0, 0.5) !important;
}

.readiumCSS-orange-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-orange-highlight,
:root[style*="readium-night-on"] .readiumCSS-orange-highlight {
  background-color: rgba(255, 165, 0, 0.5) !important;
}

.readiumCSS-pink-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-pink-highlight,
:root[style*="readium-night-on"] .readiumCSS-pink-highlight {
  background-color: rgba(255, 105, 180, 0.5) !important;
}

/* Media overlays */

.readiumCSS-mo-active-default {
  color: black !important;
  background-color: yellow !important;
}
/*# sourceMappingURL=ReadiumCSS-after.css.map */
`, Br = `/* Readium CSS 
   Config module

   A file allowing implementers to customize flags for reading modes,
   user settings, etc.

   Repo: https://github.com/readium/readium-css */

/* Custom medias
   Syntax: @custom-media --variable (prop: value) */

/* Responsive columns
   The minimum width for which responsive columns (2 -> 1 and vice versa,
   depending on the current font-size) must be enabled */

/* Mobile columns
   The minimum and maximum width for mobile devices.
   We’re forcing the landscape orientation by default,
   and must still investigate large tablets (iPad Pro, Surface Pro 3, etc.). */

/* Custom selectors
   Syntax: @custom-selector :--variable selector
   The selectors you will use for flags/switches
   You can alternatively use classes or custom data-* attributes */

/* User view = paged | scrolled */

/* Font-family override */

/* Advanced settings */

/* Reading Modes */

/* Filters (images) */

/* Accessibility normalization */

/* Accessibility font. You can add selectors, using “, ” as a separator, if you have multiple fonts */

/* Direction i.e. ltr and rtl */

/* Readium CSS
   Base module

   A minimal stylesheet for all ebooks

   Repo: https://github.com/readium/readium-css */

@namespace url("http://www.w3.org/1999/xhtml");

@namespace epub url("http://www.idpf.org/2007/ops");

@namespace m url("http://www.w3.org/1998/Math/MathML/");

@namespace svg url("http://www.w3.org/2000/svg");

/* Define viewport, HTML5-style */

@-ms-viewport {
  width: device-width;
}

@viewport {
  width: device-width;
  zoom: 1;
}

:root {
  /* Default font-stacks */
  --RS__oldStyleTf: "Iowan Old Style", "Sitka Text", Palatino, "Book Antiqua", serif;
  --RS__modernTf: Athelas, Constantia, Georgia, serif;
  --RS__sansTf: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --RS__humanistTf: Seravek, Calibri, Roboto, Arial, sans-serif;
  --RS__monospaceTf: "Andale Mono", Consolas, monospace;

  /* Config */
  --RS__baseFontFamily: var(--RS__oldStyleTf);

  /* For square-ish fonts (CJK, Indic, etc.), we must apply some compensation in dynamic leading. Default is 1 i.e. no compensation */
  --RS__lineHeightCompensation: 1;

  /* Dynamic leading based on typeface metrics + font-size setting */
  --RS__baseLineHeight: calc((1em + (2ex - 1ch) - ((1rem - 16px) * 0.1667)) * var(--RS__lineHeightCompensation));
}

/* Set default font for the html doc, so that it can be overridden by the authors’s stylesheet */

html {
  font-family: var(--RS__baseFontFamily);
  /* Fallback line-height */
  line-height: 1.6; /* Fits a little bit better for all languages than 1.5 */
  line-height: var(--RS__baseLineHeight);
  text-rendering: optimizeLegibility;
}

/* 1.5 being too loose with larger font-sizes, we reset headings to normal (which value is 1.125–1.375 for our font-stacks) */

h1, h2, h3 {
  line-height: normal;
}

:lang(ja),
:lang(zh),
:lang(ko) {
  word-wrap: break-word;
  -webkit-line-break: strict;
  -epub-line-break: strict;
  line-break: strict;
}

/* Set default font for Math */

math {
  font-family: "Latin Modern Math", "STIX Two Math", "XITS Math", "STIX Math", "Libertinus Math", "TeX Gyre Termes Math", "TeX Gyre Bonum Math", "TeX Gyre Schola", "DejaVu Math TeX Gyre", "TeX Gyre Pagella Math", "Asana Math", "Cambria Math", "Lucida Bright Math", "Minion Math", STIXGeneral, STIXSizeOneSym, Symbol, "Times New Roman", serif;
}

/* Language Overrides
   That will only work if either html or body have a (xml:)lang attribute, not for inline overrides */

:lang(am) {
  --RS__baseFontFamily: Kefa, Nyala, Roboto, Noto, "Noto Sans Ethiopic", serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(ar) {
  --RS__baseFontFamily: "Geeza Pro", "Arabic Typesetting", Roboto, Noto, "Noto Naskh Arabic", "Times New Roman", serif;
}

:lang(bn) {
  --RS__baseFontFamily: "Kohinoor Bangla", "Bangla Sangam MN", Vrinda, Roboto, Noto, "Noto Sans Bengali", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(bo) {
  --RS__baseFontFamily: Kailasa, "Microsoft Himalaya", Roboto, Noto, "Noto Sans Tibetan", sans-serif;
}

:lang(chr) {
  --RS__baseFontFamily: "Plantagenet Cherokee", Roboto, Noto, "Noto Sans Cherokee";
  --RS__lineHeightCompensation: 1.167;
}

:lang(fa) {
  --RS__baseFontFamily: "Geeza Pro", "Arabic Typesetting", Roboto, Noto, "Noto Naskh Arabic", "Times New Roman", serif;
}

:lang(gu) {
  --RS__baseFontFamily: "Gujarati Sangam MN", "Nirmala UI", Shruti, Roboto, Noto, "Noto Sans Gujarati", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(he) {
  --RS__baseFontFamily: "New Peninim MT", "Arial Hebrew", Gisha, "Times New Roman", Roboto, Noto, "Noto Sans Hebrew" sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(hi) {
  --RS__baseFontFamily: "Kohinoor Devanagari", "Devanagari Sangam MN", Kokila, "Nirmala UI", Roboto, Noto, "Noto Sans Devanagari", sans-serif;

  --RS__lineHeightCompensation: 1.1;
}

:lang(hy) {
  --RS__baseFontFamily: Mshtakan, Sylfaen, Roboto, Noto, "Noto Serif Armenian", serif;
}

:lang(iu) {
  --RS__baseFontFamily: "Euphemia UCAS", Euphemia, Roboto, Noto, "Noto Sans Canadian Aboriginal", sans-serif;
}

:lang(ja) {
  --RS__baseFontFamily: YuGothic, "Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Meiryo UI", "MS Gothic", Roboto, Noto, "Noto Sans CJK JP", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;

  /* Extra variables for Japanese font-stacks as we may want to reuse them for user settings + default */
  /* This setting uses the BIZ UD font for serif and the Yu font for sans serif on Windows. Note: When using the BIZ UD font for vertical writing display, if you set half-width (ASCII) characters to stand upright with \`text-orientation: upright\`, the width of these characters is narrow. By specifying \`font-variant-east-asian: full-width;\` at the same time, you can display the characters with the width of one full-width character. */
  --RS__serif-ja: "Hiragino Mincho ProN", "Hiragino Mincho Pro", "YuMincho", "BIZ UDPMincho", "Yu Mincho", "ＭＳ Ｐ明朝", "MS PMincho", serif;
  --RS__sans-serif-ja: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Hiragino Kaku Gothic Pro", "ヒラギノ角ゴ W3", "YuGothic", "Yu Gothic Medium", "BIZ UDPGothic", "Yu Gothic", "ＭＳ Ｐゴシック", "MS PGothic", sans-serif;
  --RS__serif-ja-v: "Hiragino Mincho ProN", "Hiragino Mincho Pro", "YuMincho", "BIZ UDMincho", "Yu Mincho", "ＭＳ明朝", "MS Mincho", serif;
  --RS__sans-serif-ja-v: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Hiragino Kaku Gothic Pro", "ヒラギノ角ゴ W3", "YuGothic", "Yu Gothic Medium", "BIZ UDGothic", "Yu Gothic", "ＭＳゴシック", "MS Gothic", sans-serif;
}

:lang(km) {
  --RS__baseFontFamily: "Khmer Sangam MN", "Leelawadee UI", "Khmer UI", Roboto, Noto, "Noto Sans Khmer", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(kn) {
  --RS__baseFontFamily: "Kannada Sangam MN", "Nirmala UI", Tunga, Roboto, Noto, "Noto Sans Kannada", sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(ko) {
  --RS__baseFontFamily: "Nanum Gothic", "Apple SD Gothic Neo", "Malgun Gothic", Roboto, Noto, "Noto Sans CJK KR", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(lo) {
  --RS__baseFontFamily: "Lao Sangam MN", "Leelawadee UI", "Lao UI", Roboto, Noto, "Noto Sans Lao", sans-serif;
}

:lang(ml) {
  --RS__baseFontFamily: "Malayalam Sangam MN", "Nirmala UI", Kartika, Roboto, Noto, "Noto Sans Malayalam", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(or) {
  --RS__baseFontFamily: "Oriya Sangam MN", "Nirmala UI", Kalinga, Roboto, Noto, "Noto Sans Oriya", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(pa) {
  --RS__baseFontFamily: "Gurmukhi MN", "Nirmala UI", Kartika, Roboto, Noto, "Noto Sans Gurmukhi", sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(si) {
  --RS__baseFontFamily: "Sinhala Sangam MN", "Nirmala UI", "Iskoola Pota", Roboto, Noto, "Noto Sans Sinhala", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(ta) {
  --RS__baseFontFamily: "Tamil Sangam MN", "Nirmala UI", Latha, Roboto, Noto, "Noto Sans Tamil", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(te) {
  --RS__baseFontFamily: "Kohinoor Telugu", "Telugu Sangam MN", "Nirmala UI", Gautami, Roboto, Noto, "Noto Sans Telugu", sans-serif;
}

:lang(th) {
  --RS__baseFontFamily: "Thonburi", "Leelawadee UI", "Cordia New", Roboto, Noto, "Noto Sans Thai", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

/* The following will also work for zh-Hans */

:lang(zh) {
  --RS__baseFontFamily: "方体", "PingFang SC", "黑体", "Heiti SC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK SC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(zh-Hant),
:lang(zh-TW) {
  --RS__baseFontFamily: "方體", "PingFang TC", "黑體", "Heiti TC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK TC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(zh-HK) {
  --RS__baseFontFamily: "方體", "PingFang HK", "方體", "PingFang TC", "黑體", "Heiti TC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK TC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

/* Readium CSS
   Day/Default mode

   A preset theme for day mode, which is the default

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root {
  --RS__backgroundColor: #FFFFFF;
  --RS__textColor: #121212;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;
}

:root {
  color: var(--RS__textColor) !important;
  background-color: var(--RS__backgroundColor) !important;
}

/* Note: Though \`::selection\` was present in drafts of CSS Selectors Level 3, it was removed during the Candidate Recommendation phase because its behavior was under-specified (especially with nested elements) and interoperability wasn’t achieved. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/::selection */

::-moz-selection {
  color: var(--RS__selectionTextColor);
  background-color: var(--RS__selectionBackgroundColor);
}

::selection {
  color: var(--RS__selectionTextColor);
  background-color: var(--RS__selectionBackgroundColor);
}

/* @import "modules/ReadiumCSS-fonts.css"; */

/* Readium CSS
   HTML5 SR Patch stylesheet

   A set of style to adjust HTML5 Suggested Rendering to paginated content

   Repo: https://github.com/readium/readium-css */

/* Fragmentation */

body {
  widows: 2;
  orphans: 2;
}

figcaption, th, td {
  widows: 1;
  orphans: 1;
}

h2,
h3,
h4,
h5,
h6,
dt,
hr,
caption {
  -webkit-column-break-after: avoid;
  page-break-after: avoid;
  break-after: avoid;
}

h1,
h2,
h3,
h4,
h5,
h6,
dt,
figure,
tr {
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Hyphenation */

body {
  -webkit-hyphenate-character: "\\002D";
  -moz-hyphenate-character: "\\002D";
  -ms-hyphenate-character: "\\002D";
  hyphenate-character: "\\002D";
  -webkit-hyphenate-limit-lines: 3;
  -ms-hyphenate-limit-lines: 3;
  hyphenate-limit-lines: 3;
}

h1,
h2,
h3,
h4,
h5,
h6,
dt,
figcaption,
pre,
caption,
address,
center,
code,
var {
  -ms-hyphens: none;
  -moz-hyphens: none;
  -webkit-hyphens: none;
  -epub-hyphens: none;
  hyphens: none;
}

/* OTF */

body {
  font-variant-numeric: oldstyle-nums proportional-nums;
}

:lang(ja) body,
:lang(zh) body,
:lang(ko) body {
  font-variant-numeric: lining-nums proportional-nums;
}

h1, h2, h3, h4, h5, h6, dt {
  font-variant-numeric: lining-nums proportional-nums;
}

table {
  font-variant-numeric: lining-nums tabular-nums;
}

code, var {
  font-variant-ligatures: none;
  font-variant-numeric: lining-nums tabular-nums slashed-zero;
}

rt {
  font-variant-east-asian: ruby;
}

:lang(ar) {
  font-variant-ligatures: common-ligatures;
}

:lang(ko) {
  font-kerning: normal;
}

/* Night mode */

hr {
  color: inherit;
  border-color: currentColor;
}

table, th, td {
  border-color: currentColor;
}

/* Horizontal Spacing */

figure, blockquote {
  margin: 1em 5%;
}

/*

:lang(ja) figure, :lang(ja) blockquote,
:lang(zh-Hant) figure, :lang(zh-Hant) blockquote,
:lang(zh-TW) figure, :lang(zh-TW) blockquote,
:lang(mn) figure, :lang(mn) blockquote {
  margin: 5% 1em;
}

*/

ul, ol {
  padding-left: 5%;
}

/*

:lang(ja) ul, :lang(ja) ol,
:lang(zh-Hant) ul, :lang(zh-Hant) ol,
:lang(zh-TW) ul, :lang(zh-TW) ol,
:lang(mn) ul, :lang(mn) ol   {
  padding-top: 5%;
}

*/

dd {
  margin-left: 5%;
}

/*

:lang(ja) dd,
:lang(zh-Hant) dd,
:lang(zh-TW) dd,
:lang(mn) dd {
  margin-top: 5%;
}

*/

pre {
  white-space: pre-wrap;
  -ms-tab-size: 2;
  -moz-tab-size: 2;
  -webkit-tab-size: 2;
  tab-size: 2;
}

/* Normalization */

abbr[title], acronym[title] {
  text-decoration: dotted underline;
}

nobr wbr {
  white-space: normal;
}

/* Make ruby text and parentheses non-selectable (TBC) */

ruby > rt, ruby > rp {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* Internationalization */

*:lang(ja),
*:lang(zh),
*:lang(ko),
:lang(ja) cite,
:lang(ja) dfn,
:lang(ja) em,
:lang(ja) i,
:lang(zh) cite,
:lang(zh) dfn,
:lang(zh) em,
:lang(zh) i,
:lang(ko) cite,
:lang(ko) dfn,
:lang(ko) em,
:lang(ko) i {
  font-style: normal;
}

:lang(ja) a,
:lang(zh) a,
:lang(ko) a {
  text-decoration: none;
}

/* Readium CSS
   Safeguards module for vertical writing

   A set of styles to prevent common issues in pagination

   Repo: https://github.com/readium/readium-css */

/* Config */

/* We’ll be using an "RS__" prefix so that we can prevent collisions with authors’ CSS */

:root {
  /* max-width for media, you can override that via JS if not compiled to static */
  --RS__maxMediaWidth: 100%;

  /* max-height for media, you can override that via JS if not compiled to static  */
  --RS__maxMediaHeight: 100vw;

  /* value for medias’ box-sizing */
  --RS__boxSizingMedia: border-box;

  /* value for table’s box-sizing */
  --RS__boxSizingTable: border-box;
}

/* Sanitize line-heights in webkit e.g. raised cap without a declared line-height
   See effect by checking this demo in Safari: https://codepen.io/JayPanoz/pen/gRmzrE
   Note: glyphs has to be reset to inline for CJK */

html {
  -webkit-line-box-contain: block glyphs replaced;
}

:lang(ja) {
  -webkit-line-box-contain: block inline replaced;
}

/* Wrap long strings if larger than line-length */

a, h1, h2, h3, h4, h5, h6 {
  word-wrap: break-word;
}

div {
  max-width: var(--RS__maxMediaHeight);
}

/* Size medias */

/* You can override CSS variables by re-defining it for all elements or a specific one */

img, svg, audio, video {

  /* Object-fit allows us to keep the correct aspect-ratio */
  object-fit: contain;

  width: auto;
  height: auto;

  /* We’re setting a max-height, especially for covers */
  max-width: var(--RS__maxMediaHeight);

  /* Some files don’t have max-width */
  max-height: var(--RS__maxMediaWidth) !important;
  /* We probably don’t need to use modern box-sizing as auto behaves like it */
  box-sizing: var(--RS__boxSizingMedia);

  /* For page-break, we must use those 3
     We can’t use a variable there, webkit seems to no support them for those properties */
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Try preventing border being cut-off, webkit + blink have content-box by default */

table {
  max-height: var(--RS__maxMediaWidth);
  box-sizing: var(--RS__boxSizingTable)
}
/*# sourceMappingURL=ReadiumCSS-before.css.map */`, Gr = `/* Readium CSS
   Default module for CJK vertical writing

   A stylesheet for unstyled ebooks based on HTML5 Suggested Rendering
   Note: works in combination with Base module

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root {
  /* Extra variables for Japanese font-stacks:
     • --RS__serif-ja-v;
     • --RS__sans-serif-ja-v.

     They can be used instead of --RS__baseFontFamily and --RS__compFontFamily */

  --RS__compFontFamily: var(--RS__baseFontFamily);
  --RS__codeFontFamily: var(--RS__monospaceTf);

  --RS__typeScale: 1.125; /* 1.067 | 1.125 | 1.2 | 1.25 | 1.333 | 1.414 | 1.5 | 1.618 */
  --RS__baseFontSize: 87.5%;

  --RS__flowSpacing: 1.5rem;
  --RS__paraSpacing: 0;
  --RS__paraIndent: 1em;

  --RS__linkColor: #0000EE;
  --RS__visitedColor: #551A8B;

  --RS__primaryColor: ;
  --RS__secondaryColor: ;
}

:lang("mn-Mong") {
  --RS__baseFontSize: 100%;
}

/* STYLES */

/* Typo */

body {
  font-size: var(--RS__baseFontSize);
  text-align: justify;
  text-justify: inter-character;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--RS__baseFontFamily);
  text-align: left;
  text-align: start;
}

/* Flow content */

blockquote,
figure,
p,
pre,
aside,
footer,
form,
hr {
  margin-right: var(--RS__flowSpacing);
  margin-left: var(--RS__flowSpacing);
}

p {
  margin-right: var(--RS__paraSpacing);
  margin-left: var(--RS__paraSpacing);
  text-indent: var(--RS__paraIndent);
}

pre {
  font-family: var(--RS__codeFontFamily);
}

/* Phrasing content */

code, kbd, samp, tt {
  font-family: var(--RS__codeFontFamily);
}

sub, sup {
  position: relative;
  font-size: 67.5%;
  line-height: 1;
}

sub {
  left: -0.2ex;
}

sup {
  right: 0;
}

em {
  -webkit-text-emphasis: sesame;
  -epub-text-emphasis: sesame;
  text-emphasis: sesame;
}

:link {
  color: var(--RS__linkColor);
}

:visited {
  color: var(--RS__visitedColor);
}

/* Headings */

h1 {
  margin-right: calc(var(--RS__flowSpacing) * 2);
  margin-left: calc(var(--RS__flowSpacing) * 2);
  /* The following is base font size * typescale power of 3 */
  font-size: calc(((1em * var(--RS__typeScale)) * var(--RS__typeScale)) * var(--RS__typeScale));
  text-indent: 2rem;
}

h2 {
  margin-right: calc(var(--RS__flowSpacing) * 2);
  margin-left: var(--RS__flowSpacing);
  /* The following is base font size * typescale power of 2 */
  font-size: calc((1em * var(--RS__typeScale)) * var(--RS__typeScale));
  text-indent: 3rem;
}

h3 {
  margin-right: var(--RS__flowSpacing);
  margin-left: var(--RS__flowSpacing);
  font-size: calc(1em * var(--RS__typeScale));
  text-indent: 4rem;
}

h4 {
  margin-right: var(--RS__flowSpacing);
  margin-left: var(--RS__flowSpacing);
  font-family: var(--RS__compFontFamily);
  font-size: 1em;
  text-indent: 4rem;
}

h5 {
  margin-right: var(--RS__flowSpacing);
  margin-left: var(--RS__flowSpacing);
  font-family: var(--RS__compFontFamily);
  font-size: smaller;
  text-indent: 4rem;
}

h6 {
  margin-right: var(--RS__flowSpacing);
  margin-left: 0;
  font-family: var(--RS__compFontFamily);
  font-size: smaller;
  font-weight: normal;
  text-indent: 4rem;
}

/* Lists */

dl, ol, ul {
  margin-right: var(--RS__flowSpacing);
  margin-left: var(--RS__flowSpacing);
}

/* Table */

table {
  margin: 0 var(--RS__flowSpacing);
  border: 1px solid currentColor;
  border-collapse: collapse;
  empty-cells: show;
}

thead, tbody, tfoot, table > tr {
  vertical-align: top;
}

th {
  text-align: left;
}

th, td {
  padding: 4px;
  border: 1px solid currentColor;
}
/*# sourceMappingURL=ReadiumCSS-default.css.map */`, Wr = `/* Readium CSS
   Config module

   A file allowing implementers to customize flags for reading modes,
   user settings, etc.

   Repo: https://github.com/readium/readium-css */

/* Custom medias
   Syntax: @custom-media --variable (prop: value) */

/* Responsive columns
   The minimum width for which responsive columns (2 -> 1 and vice versa,
   depending on the current font-size) must be enabled */

/* Mobile columns
   The minimum and maximum width for mobile devices.
   We’re forcing the landscape orientation by default,
   and must still investigate large tablets (iPad Pro, Surface Pro 3, etc.). */

/* Custom selectors
   Syntax: @custom-selector :--variable selector
   The selectors you will use for flags/switches
   You can alternatively use classes or custom data-* attributes */

/* User view = paged | scrolled */

/* Font-family override */

/* Advanced settings */

/* Reading Modes */

/* Filters (images) */

/* Accessibility normalization */

/* Accessibility font. You can add selectors, using “, ” as a separator, if you have multiple fonts */

/* Direction i.e. ltr and rtl */

/* Readium CSS
   Pagination module

   A set of styles to paginate ePublications

   Repo: https://github.com/readium/readium-css */

/* Config */

/* Columns are responsive by default, even if column-width is set in pixels,
   which means two-page spread will switch to single page depending on current font-size.
   If you want more control, I’m afraid you’ll have to update colWidth/colGap dynamically,
   which is how a significant amount of RS do at the moment. */

/* Default for smartphone portrait (small screens) */

:root {
  /* Your columns’ width floor */
  --RS__colWidth: 45em; /* The width at which we’ll switch to 2 columns by default. PS: you can’t set it in rem */

  /* Ideal number of columns (depending on columns’ width floor) */
  --RS__colCount: 1;

  /* Gap between columns (in pixels so that it won’t resize with font-size) */
  --RS__colGap: 0;

  /* Optimal line-length (rem will take :root font-size into account, whatever the body’s font-size) */
  --RS__maxLineLength: 40rem;

  /* Default page horizontal margins (in pixels so that it won’t resize with font-size) */
  --RS__pageGutter: 20px; /* See if colGap and pageGutter can be the same var */
}

/* Reset page margins for Forward compatibility */

@page {
  margin: 0 !important;
}

/* :root selector has same specificity as a class i.e. 0010
   We might have to change that to html / context
   -> https://css-tricks.com/almanac/selectors/r/root/ */

:root {

  /* In case you use left position to scroll, can be removed if using transform: translateX() */
  position: relative;

  -webkit-column-width: var(--RS__colWidth);
  -moz-column-width: var(--RS__colWidth);
  column-width: var(--RS__colWidth);

  /* Init pagination */
  /* TODO: document columns’ logic cos it might feel weird at first */
  -webkit-column-count: var(--RS__colCount);
  -moz-column-count: var(--RS__colCount);
  column-count: var(--RS__colCount);

  -webkit-column-gap: var(--RS__colGap);
  -moz-column-gap: var(--RS__colGap);
  column-gap: var(--RS__colGap);

  /* Default is balance and we want columns to be filled entirely (100vh) */
  -moz-column-fill: auto;
  column-fill: auto;
  width: 100%;
  height: 100vh;
  max-width: 100%;
  max-height: 100vh;
  min-width: 100%;
  min-height: 100vh;
  padding: 0 !important;
  margin: 0 !important;

  /* Column size will depend on this if we want to make it responsive */
  font-size: 100% !important;

  -webkit-text-size-adjust: none;
  text-size-adjust: none;

  /* Switch to newer box model (not inherited by authors’ styles) */
  box-sizing: border-box;

  /* Fix bug for older Chrome */
  -webkit-perspective: 1;
  /* Prevents options pop-up when long tap in webkit */
  -webkit-touch-callout: none;
}

body {
  /*  overflow: hidden; bugfix: contents won’t paginate in Firefox and one sample in Safari */
  width: 100%;

  /* Limit line-length but we have to reset when 2 columns and control the viewport.
     By using max-width + margin auto, margins will shrink when font-size increases,
     which is what would be expected in terms of typography. */
  max-width: var(--RS__maxLineLength) !important;
  padding: 0 var(--RS__pageGutter) !important;
  margin: 0 auto !important;

  /* We need a minimum padding on body so that descandants/ascendants in italic/script are not cut-off.
     Drawback: we have to use border-box so that it doesn’t screw the box model,
     which means it impacts colWidth and max-width */
  box-sizing: border-box;
}

/* We’ll now redefine margins and columns depending on the minimum width available
   The goal is having the simplest model possible and avoid targeting devices */

/* Smartphone landscape */

@media screen and (min-width: 35em) {
  :root {
    --RS__pageGutter: 30px;
  }
}

/* Tablet portrait */

@media screen and (min-width: 45em) {
  :root {
    --RS__pageGutter: 40px;
  }
}

/* Desktop + tablet large */

/* We get the previous settings, we just change the margins */

@media screen and (min-width: 75em) {
  :root {
    --RS__pageGutter: 50px;
  }
}

/* At this point (80em or so), constraining line length must be done at the web view/iframe level, or by limiting the size of :root itself */

/* Responsive columns */

@media screen and (min-width: 60em), screen and (min-device-width: 36em) and (max-device-width: 47em) and (orientation: landscape) {
  :root {
    /* The size at which we want 2 columns to switch to 1 (depending on font-size) */
    --RS__colWidth: 20em; /* 20 * 16 = 320px but 20 * 28 = 560px so it will switch to 1 col @ 175% font-size (user-setting) on an iPad */
    /* We constrain to 2 columns so that we can never get 3 or 4, etc. */
    --RS__colCount: 2;
    --RS__maxLineLength: 39.99rem; /* If we don’t use this, colNumber user setting won’t work in Safari… */
  }
}

/* Readium CSS
   Scroll module

   A set of styles to scroll ePublications
   This module overrides pagination

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-scroll-on"] {

  /* Reset columns, auto + auto = columns can’t be created */
  -webkit-columns: auto auto !important;
  -moz-columns: auto auto !important;
  columns: auto auto !important;
  width: auto !important;
  height: auto !important;
  max-width: none !important;
  max-height: none !important;
  /* Reset html size so that the user can scroll */
  min-width: 0 !important;
  min-height: 0 !important;
}

/* Make sure line-length is limited in all configs */

:root[style*="readium-scroll-on"] body {
  --RS__maxLineLength: 40rem !important;
}

/* Readium CSS
   Night mode

   A preset theme for night mode

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

/* [style*="--USER__appearance"] can be used to increase specificity but performance hit */

:root[style*="readium-night-on"] {
  --RS__backgroundColor: #000000;
  --RS__textColor: #FEFEFE;

  --RS__linkColor: #63caff;
  --RS__visitedColor: #0099E5;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;
}

/* we don’t need to redeclare bg-color and color for :root since we will inherit and update from day/default mode */

:root[style*="readium-night-on"] *:not(a) {
  color: inherit !important;
  background-color: transparent !important;
  border-color: currentColor !important;
}

:root[style*="readium-night-on"] svg text {
  fill: currentColor !important;
  stroke: none !important;
}

:root[style*="readium-night-on"] a:link,
:root[style*="readium-night-on"] a:link * {
  color: var(--RS__linkColor) !important;
}

:root[style*="readium-night-on"] a:visited,
:root[style*="readium-night-on"] a:visited * {
  color: var(--RS__visitedColor) !important;
}

:root[style*="readium-night-on"] img[class*="gaiji"],
:root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
  -webkit-filter: invert(100%);
  filter: invert(100%);
}

/* Darken all images on user’s demand */

:root[style*="readium-night-on"][style*="readium-darken-on"] img {
  -webkit-filter: brightness(80%);
  filter: brightness(80%);
}

/* Invert all images on user’s demand */

:root[style*="readium-night-on"][style*="readium-invert-on"] img {
  -webkit-filter: invert(100%);
  filter: invert(100%);
}

/* Darken and invert on user’s demand */

:root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
  -webkit-filter: brightness(80%) invert(100%);
  filter: brightness(80%) invert(100%);
}

/* Readium CSS
   Sepia mode

   A preset theme for sepia mode

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root[style*="readium-sepia-on"] {
  --RS__backgroundColor: #faf4e8;
  --RS__textColor: #121212;

  --RS__linkColor: #0000EE;
  --RS__visitedColor: #551A8B;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;

  --RS__maxLineLength: 40.01rem; /* Forcing a reflow in Blink/Webkit so that blend mode can work */
}

/* we don’t need to redeclare bg-color and color for :root since we will inherit and update from day/default mode */

:root[style*="readium-sepia-on"] *:not(a) {
  color: inherit !important;
  background-color: transparent !important;
}

:root[style*="readium-sepia-on"] a:link,
:root[style*="readium-sepia-on"] a:link * {
  color: var(--RS__linkColor);
}

:root[style*="readium-sepia-on"] a:visited,
:root[style*="readium-sepia-on"] a:visited * {
  color: var(--RS__visitedColor);
}

:root[style*="readium-sepia-on"] svg,
:root[style*="readium-sepia-on"] img {
  /* Make sure the proper bg-color is used for the blend mode */
  background-color: transparent !important;
  mix-blend-mode: multiply;
}

/* Readium CSS
   OS Accessibility Modes

   A stylesheet to deal with OS accessibility settings

   Repo: https://github.com/readium/readium-css */

/* Windows high contrast colors are mapped to CSS system color keywords
   See http://www.gwhitworth.com/blog/2017/04/how-to-use-ms-high-contrast */

@media screen and (-ms-high-contrast: active) {
  :root {
    color: windowText !important;
    background-color: window !important;
  }

  /* The following selectors are super funky but it makes sure everything is inherited, this is indeed critical for this mode */
  :root :not(#\\#):not(#\\#):not(#\\#),
  :root :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#)
  :root :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#) {
    color: inherit !important;
    background-color: inherit !important;
  }

  .readiumCSS-mo-active-default {
    color: highlightText !important;
    background-color: highlight !important;
  }

  /* For links, hyperlink keyword is automatically set */

  /* Should we also set user highlights? */
}

@media screen and (-ms-high-contrast: white-on-black) {
  :root[style*="readium-night-on"] img[class*="gaiji"],
  :root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-invert-on"] img {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
    -webkit-filter: brightness(80%);
    filter: brightness(80%);
  }
}

/* Will be true on recent versions of iOS and MacOS if inverted setting enabled by the user */

@media screen and (inverted-colors) {
  :root[style*="readium-night-on"] img[class*="gaiji"],
  :root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-invert-on"] img {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
    -webkit-filter: brightness(80%);
    filter: brightness(80%);
  }
}

@media screen and (monochrome) {
  /* Grayscale (Implemented in Safari, what about eInk?) */
  /* Must deal with anything color (contrast) so must be managed at the night/sepia/theme level :( */
}

@media screen and (prefers-reduced-motion) {
  /* If reduced motion is set on MacOS, in case we have animation/transition */
}

/* Readium CSS
   Columns number pref

   A submodule managing columns number for user settings
   Part of “Chrome Advanced” class – no flag required.

   Repo: https://github.com/readium/readium-css */

/* Number of columns = 1 | 2 */

/* We still need to see if we allow users to force number of columns for all configs, currently it behaves as an "auto" setting */

/* apply col setting except for mobile portrait */

@media screen and (min-width: 60em), screen and (min-device-width: 36em) and (max-device-width: 47em) and (orientation: landscape) {
  :root[style*="--USER__colCount: 1"],
  :root[style*="--USER__colCount:1"],
  :root[style*="--USER__colCount: 2"],
  :root[style*="--USER__colCount:2"] {
    -webkit-column-count: var(--USER__colCount);
    -moz-column-count: var(--USER__colCount);
    column-count: var(--USER__colCount);
  }

  /* If one column, make sure we limit line-length */
  :root[style*="--USER__colCount: 1"],
  :root[style*="--USER__colCount:1"] {
    --RS__maxLineLength: 40rem !important; /* This is the only way for the user setting to work in webkit… */
    --RS__colWidth: 100vw;
  }

  /* If smartphone landscape, and 2 columns, col width the same as iPad landscape + desktop */
  :root[style*="--USER__colCount: 2"],
  :root[style*="--USER__colCount:2"] {
    --RS__colWidth: auto; /* User explicitely tells he/she wants 2 columns, we reset floor value */
  }
}

/* Readium CSS
   Page margins pref

   A submodule managing page margins for user settings
   Part of “Chrome Advanced” class – no flag required.

   Repo: https://github.com/readium/readium-css */

/* Page Margins: the user margin is a factor of the page gutter e.g. 0.5, 0.75, 1, 1.25, 1.5, etc. */

:root[style*="--USER__pageMargins"] body {
  padding: 0 calc(var(--RS__pageGutter) * var(--USER__pageMargins)) !important;
}

/* Readium CSS
   Custom colors pref

   A submodule managing custom colors for user settings
   Part of “Chrome Advanced” class – no flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="--USER__backgroundColor"] {
  background-color: var(--USER__backgroundColor) !important;
}

:root[style*="--USER__backgroundColor"] * {
  background-color: transparent !important;
}

:root[style*="--USER__textColor"] {
  color: var(--USER__textColor) !important;
}

:root[style*="--USER__textColor"] *:not(h1):not(h2):not(h3):not(h4):not(h5):not(h6):not(pre) {
  color: inherit !important;
}

/* Readium CSS
   Text align pref

   A submodule managing text-align for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__textAlign"] {
  text-align: var(--USER__textAlign);
}

:root[style*="readium-advanced-on"][style*="--USER__textAlign"] body,
:root[style*="readium-advanced-on"][style*="--USER__textAlign"] *:not(blockquote):not(figcaption) p,
:root[style*="readium-advanced-on"][style*="--USER__textAlign"] li {
  text-align: inherit !important;
  -moz-text-align-last: auto !important;
  -epub-text-align-last: auto !important;
  text-align-last: auto !important;
}

/* In case something goes wrong at the programmatic level + rtl for body + rtl in ltr */

:root[style*="readium-advanced-on"][dir="rtl"][style*="--USER__textAlign: left"],
:root[style*="readium-advanced-on"][dir="rtl"][style*="--USER__textAlign:left"],
:root[style*="readium-advanced-on"][style*="--USER__textAlign: left"] *[dir="rtl"],
:root[style*="readium-advanced-on"][style*="--USER__textAlign:left"] *[dir="rtl"] {
  text-align: right;
}

/* Edge, if logical value is used, think of it as a polyfill. For LTR, it will fall back to the default, which is left */

:root[style*="readium-advanced-on"][dir="rtl"][style*="--USER__textAlign: start"],
:root[style*="readium-advanced-on"][dir="rtl"][style*="--USER__textAlign:start"] {
  text-align: right;
}

/* Readium CSS
   Font Family pref

   A submodule managing font-family for user settings
   Part of “User Overrides” class – “font override” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-font-on"][style*="--USER__fontFamily"] {
  font-family: var(--USER__fontFamily) !important;
}

:root[style*="readium-font-on"][style*="--USER__fontFamily"] body,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] p,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] li,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] div,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] dt,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] dd {
  font-family: inherit !important;
}

:root[style*="readium-font-on"][style*="--USER__fontFamily"] i:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] i:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] em:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] em:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] cite:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] cite:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] b:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] b:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] strong:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] strong:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] span:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] span:not([xml\\:lang]) {
  font-family: inherit !important;
}

/* Readium CSS
   Font size pref

   A submodule managing font-size for user settings
   Part of “User Overrides” class – no flag required.

   Repo: https://github.com/readium/readium-css */

   :root[style*="--USER__fontSize"] > body {
    zoom:var(--USER__fontSize) !important;
  }

  @supports not (zoom: 1){
    :root[style*="--USER__fontSize"]{
      font-size:var(--USER__fontSize) !important;
    }
  }

/* Readium CSS
   Line height pref

   A submodule managing line-height for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] {
  line-height: var(--USER__lineHeight) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] body,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] p,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] li,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] div {
  line-height: inherit;
}

/* Readium CSS
   Para spacing pref

   A submodule managing paragraphs’ top and bottom margins for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__paraSpacing"] p {
  margin-top: var(--USER__paraSpacing) !important;
  margin-bottom: var(--USER__paraSpacing) !important;
}

/* Readium CSS
   Para indent pref

   A submodule managing paragraphs’ text-indent for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__paraIndent"] p {
  text-indent: var(--USER__paraIndent) !important;
}

/* If there are inline-block elements in paragraphs, text-indent will inherit so we must reset it */

:root[style*="readium-advanced-on"][style*="--USER__paraIndent"] p *,
:root[style*="readium-advanced-on"][style*="--USER__paraIndent"] p:first-letter {
  text-indent: 0 !important;
}

/* Readium CSS
   Ligatures pref

   A submodule managing ligatures for user settings in the Arabic Script (can help with a11y)
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__arabicLigatures"] {
  font-variant-ligatures: var(--USER__ligatures) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__arabicLigatures"] * {
  font-variant-ligatures: inherit !important;
}

/* Readium CSS
   Font size normalize

   A stylesheet to normalize font-size

   Repo: https://github.com/readium/readium-css */

/* STYLES */

/* :root is used so that you can quickly add a class or attribute if you prefer e.g. \`:root[data-rs-normalize]\` */

/* We create a default so that you don’t need to explicitly set one in the DOM.
   Once the “Publisher’s styles” checkbox is unchecked, the normalize is applied automatically */

@supports not (zoom: 1){

:root[style*="readium-advanced-on"] {
  --USER__typeScale: 1.2; /* This is the default type scale you’ll find in most publications */
}

:root[style*="readium-advanced-on"] p,
:root[style*="readium-advanced-on"] li,
:root[style*="readium-advanced-on"] div,
:root[style*="readium-advanced-on"] pre,
:root[style*="readium-advanced-on"] dd {
  font-size: 1rem !important;
}

:root[style*="readium-advanced-on"] h1 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.75rem !important;
  font-size: calc(((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h2 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.5rem !important;
  font-size: calc((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h3 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.25rem !important;
  font-size: calc(1rem * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h4,
:root[style*="readium-advanced-on"] h5,
:root[style*="readium-advanced-on"] h6 {
  font-size: 1rem !important;
}

:root[style*="readium-advanced-on"] small {
  font-size: smaller !important;
}

:root[style*="readium-advanced-on"] sub,
:root[style*="readium-advanced-on"] sup {
  font-size: 67.5% !important;
}

/* The following styles kick in if you define the typeScale variable in the DOM.
   No need to repeat declarations which don’t make use of the variable */

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h1 {
  font-size: calc(((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h2 {
  font-size: calc((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h3 {
  font-size: calc(1rem * var(--USER__typeScale)) !important;
}
}

/* Readium CSS
   Default highlights

   A stylesheet for user highlights

   Repo: https://github.com/readium/readium-css */

/* User Highlights */

.readiumCSS-yellow-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-yellow-highlight,
:root[style*="readium-night-on"] .readiumCSS-yellow-highlight {
  background-color: rgba(255, 255, 0, 0.5) !important;
}

.readiumCSS-green-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-green-highlight,
:root[style*="readium-night-on"] .readiumCSS-green-highlight {
  background-color: rgba(0, 255, 0, 0.5) !important;
}

.readiumCSS-orange-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-orange-highlight,
:root[style*="readium-night-on"] .readiumCSS-orange-highlight {
  background-color: rgba(255, 165, 0, 0.5) !important;
}

.readiumCSS-pink-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-pink-highlight,
:root[style*="readium-night-on"] .readiumCSS-pink-highlight {
  background-color: rgba(255, 105, 180, 0.5) !important;
}

/* Media overlays */

.readiumCSS-mo-active-default {
  color: black !important;
  background-color: yellow !important;
}
/*# sourceMappingURL=ReadiumCSS-after.css.map */
`, jr = `/* Readium CSS 
   Config module

   A file allowing implementers to customize flags for reading modes,
   user settings, etc.

   Repo: https://github.com/readium/readium-css */

/* Custom medias
   Syntax: @custom-media --variable (prop: value) */

/* Responsive columns
   The minimum width for which responsive columns (2 -> 1 and vice versa,
   depending on the current font-size) must be enabled */

/* Mobile columns
   The minimum and maximum width for mobile devices.
   We’re forcing the landscape orientation by default,
   and must still investigate large tablets (iPad Pro, Surface Pro 3, etc.). */

/* Custom selectors
   Syntax: @custom-selector :--variable selector
   The selectors you will use for flags/switches
   You can alternatively use classes or custom data-* attributes */

/* User view = paged | scrolled */

/* Font-family override */

/* Advanced settings */

/* Reading Modes */

/* Filters (images) */

/* Accessibility normalization */

/* Accessibility font. You can add selectors, using “, ” as a separator, if you have multiple fonts */

/* Direction i.e. ltr and rtl */

/* Readium CSS
   Base module

   A minimal stylesheet for all ebooks

   Repo: https://github.com/readium/readium-css */

@namespace url("http://www.w3.org/1999/xhtml");

@namespace epub url("http://www.idpf.org/2007/ops");

@namespace m url("http://www.w3.org/1998/Math/MathML/");

@namespace svg url("http://www.w3.org/2000/svg");

/* Define viewport, HTML5-style */

@-ms-viewport {
  width: device-width;
}

@viewport {
  width: device-width;
  zoom: 1;
}

:root {
  /* Default font-stacks */
  --RS__oldStyleTf: "Iowan Old Style", "Sitka Text", Palatino, "Book Antiqua", serif;
  --RS__modernTf: Athelas, Constantia, Georgia, serif;
  --RS__sansTf: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --RS__humanistTf: Seravek, Calibri, Roboto, Arial, sans-serif;
  --RS__monospaceTf: "Andale Mono", Consolas, monospace;

  /* Config */
  --RS__baseFontFamily: var(--RS__oldStyleTf);

  /* For square-ish fonts (CJK, Indic, etc.), we must apply some compensation in dynamic leading. Default is 1 i.e. no compensation */
  --RS__lineHeightCompensation: 1;

  /* Dynamic leading based on typeface metrics + font-size setting */
  --RS__baseLineHeight: calc((1em + (2ex - 1ch) - ((1rem - 16px) * 0.1667)) * var(--RS__lineHeightCompensation));
}

/* Set default font for the html doc, so that it can be overridden by the authors’s stylesheet */

html {
  font-family: var(--RS__baseFontFamily);
  /* Fallback line-height */
  line-height: 1.6; /* Fits a little bit better for all languages than 1.5 */
  line-height: var(--RS__baseLineHeight);
  text-rendering: optimizeLegibility;
}

/* 1.5 being too loose with larger font-sizes, we reset headings to normal (which value is 1.125–1.375 for our font-stacks) */

h1, h2, h3 {
  line-height: normal;
}

:lang(ja),
:lang(zh),
:lang(ko) {
  word-wrap: break-word;
  -webkit-line-break: strict;
  -epub-line-break: strict;
  line-break: strict;
}

/* Set default font for Math */

math {
  font-family: "Latin Modern Math", "STIX Two Math", "XITS Math", "STIX Math", "Libertinus Math", "TeX Gyre Termes Math", "TeX Gyre Bonum Math", "TeX Gyre Schola", "DejaVu Math TeX Gyre", "TeX Gyre Pagella Math", "Asana Math", "Cambria Math", "Lucida Bright Math", "Minion Math", STIXGeneral, STIXSizeOneSym, Symbol, "Times New Roman", serif;
}

/* Language Overrides
   That will only work if either html or body have a (xml:)lang attribute, not for inline overrides */

:lang(am) {
  --RS__baseFontFamily: Kefa, Nyala, Roboto, Noto, "Noto Sans Ethiopic", serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(ar) {
  --RS__baseFontFamily: "Geeza Pro", "Arabic Typesetting", Roboto, Noto, "Noto Naskh Arabic", "Times New Roman", serif;
}

:lang(bn) {
  --RS__baseFontFamily: "Kohinoor Bangla", "Bangla Sangam MN", Vrinda, Roboto, Noto, "Noto Sans Bengali", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(bo) {
  --RS__baseFontFamily: Kailasa, "Microsoft Himalaya", Roboto, Noto, "Noto Sans Tibetan", sans-serif;
}

:lang(chr) {
  --RS__baseFontFamily: "Plantagenet Cherokee", Roboto, Noto, "Noto Sans Cherokee";
  --RS__lineHeightCompensation: 1.167;
}

:lang(fa) {
  --RS__baseFontFamily: "Geeza Pro", "Arabic Typesetting", Roboto, Noto, "Noto Naskh Arabic", "Times New Roman", serif;
}

:lang(gu) {
  --RS__baseFontFamily: "Gujarati Sangam MN", "Nirmala UI", Shruti, Roboto, Noto, "Noto Sans Gujarati", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(he) {
  --RS__baseFontFamily: "New Peninim MT", "Arial Hebrew", Gisha, "Times New Roman", Roboto, Noto, "Noto Sans Hebrew" sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(hi) {
  --RS__baseFontFamily: "Kohinoor Devanagari", "Devanagari Sangam MN", Kokila, "Nirmala UI", Roboto, Noto, "Noto Sans Devanagari", sans-serif;

  --RS__lineHeightCompensation: 1.1;
}

:lang(hy) {
  --RS__baseFontFamily: Mshtakan, Sylfaen, Roboto, Noto, "Noto Serif Armenian", serif;
}

:lang(iu) {
  --RS__baseFontFamily: "Euphemia UCAS", Euphemia, Roboto, Noto, "Noto Sans Canadian Aboriginal", sans-serif;
}

:lang(ja) {
  --RS__baseFontFamily: YuGothic, "Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Meiryo UI", "MS Gothic", Roboto, Noto, "Noto Sans CJK JP", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;

  /* Extra variables for Japanese font-stacks as we may want to reuse them for user settings + default */
  /* This setting uses the BIZ UD font for serif and the Yu font for sans serif on Windows. Note: When using the BIZ UD font for vertical writing display, if you set half-width (ASCII) characters to stand upright with \`text-orientation: upright\`, the width of these characters is narrow. By specifying \`font-variant-east-asian: full-width;\` at the same time, you can display the characters with the width of one full-width character. */
  --RS__serif-ja: "Hiragino Mincho ProN", "Hiragino Mincho Pro", "YuMincho", "BIZ UDPMincho", "Yu Mincho", "ＭＳ Ｐ明朝", "MS PMincho", serif;
  --RS__sans-serif-ja: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Hiragino Kaku Gothic Pro", "ヒラギノ角ゴ W3", "YuGothic", "Yu Gothic Medium", "BIZ UDPGothic", "Yu Gothic", "ＭＳ Ｐゴシック", "MS PGothic", sans-serif;
  --RS__serif-ja-v: "Hiragino Mincho ProN", "Hiragino Mincho Pro", "YuMincho", "BIZ UDMincho", "Yu Mincho", "ＭＳ明朝", "MS Mincho", serif;
  --RS__sans-serif-ja-v: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Hiragino Kaku Gothic Pro", "ヒラギノ角ゴ W3", "YuGothic", "Yu Gothic Medium", "BIZ UDGothic", "Yu Gothic", "ＭＳゴシック", "MS Gothic", sans-serif;
}

:lang(km) {
  --RS__baseFontFamily: "Khmer Sangam MN", "Leelawadee UI", "Khmer UI", Roboto, Noto, "Noto Sans Khmer", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(kn) {
  --RS__baseFontFamily: "Kannada Sangam MN", "Nirmala UI", Tunga, Roboto, Noto, "Noto Sans Kannada", sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(ko) {
  --RS__baseFontFamily: "Nanum Gothic", "Apple SD Gothic Neo", "Malgun Gothic", Roboto, Noto, "Noto Sans CJK KR", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(lo) {
  --RS__baseFontFamily: "Lao Sangam MN", "Leelawadee UI", "Lao UI", Roboto, Noto, "Noto Sans Lao", sans-serif;
}

:lang(ml) {
  --RS__baseFontFamily: "Malayalam Sangam MN", "Nirmala UI", Kartika, Roboto, Noto, "Noto Sans Malayalam", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(or) {
  --RS__baseFontFamily: "Oriya Sangam MN", "Nirmala UI", Kalinga, Roboto, Noto, "Noto Sans Oriya", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(pa) {
  --RS__baseFontFamily: "Gurmukhi MN", "Nirmala UI", Kartika, Roboto, Noto, "Noto Sans Gurmukhi", sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(si) {
  --RS__baseFontFamily: "Sinhala Sangam MN", "Nirmala UI", "Iskoola Pota", Roboto, Noto, "Noto Sans Sinhala", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(ta) {
  --RS__baseFontFamily: "Tamil Sangam MN", "Nirmala UI", Latha, Roboto, Noto, "Noto Sans Tamil", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(te) {
  --RS__baseFontFamily: "Kohinoor Telugu", "Telugu Sangam MN", "Nirmala UI", Gautami, Roboto, Noto, "Noto Sans Telugu", sans-serif;
}

:lang(th) {
  --RS__baseFontFamily: "Thonburi", "Leelawadee UI", "Cordia New", Roboto, Noto, "Noto Sans Thai", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

/* The following will also work for zh-Hans */

:lang(zh) {
  --RS__baseFontFamily: "方体", "PingFang SC", "黑体", "Heiti SC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK SC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(zh-Hant),
:lang(zh-TW) {
  --RS__baseFontFamily: "方體", "PingFang TC", "黑體", "Heiti TC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK TC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(zh-HK) {
  --RS__baseFontFamily: "方體", "PingFang HK", "方體", "PingFang TC", "黑體", "Heiti TC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK TC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

/* Readium CSS
   Day/Default mode

   A preset theme for day mode, which is the default

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root {
  --RS__backgroundColor: #FFFFFF;
  --RS__textColor: #121212;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;
}

:root {
  color: var(--RS__textColor) !important;
  background-color: var(--RS__backgroundColor) !important;
}

/* Note: Though \`::selection\` was present in drafts of CSS Selectors Level 3, it was removed during the Candidate Recommendation phase because its behavior was under-specified (especially with nested elements) and interoperability wasn’t achieved. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/::selection */

::-moz-selection {
  color: var(--RS__selectionTextColor);
  background-color: var(--RS__selectionBackgroundColor);
}

::selection {
  color: var(--RS__selectionTextColor);
  background-color: var(--RS__selectionBackgroundColor);
}

/* @import "modules/ReadiumCSS-fonts.css"; */

/* Readium CSS
   HTML5 SR Patch stylesheet

   A set of style to adjust HTML5 Suggested Rendering to paginated content

   Repo: https://github.com/readium/readium-css */

/* Fragmentation */

body {
  widows: 2;
  orphans: 2;
}

figcaption, th, td {
  widows: 1;
  orphans: 1;
}

h2,
h3,
h4,
h5,
h6,
dt,
hr,
caption {
  -webkit-column-break-after: avoid;
  page-break-after: avoid;
  break-after: avoid;
}

h1,
h2,
h3,
h4,
h5,
h6,
dt,
figure,
tr {
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Hyphenation */

body {
  -webkit-hyphenate-character: "\\002D";
  -moz-hyphenate-character: "\\002D";
  -ms-hyphenate-character: "\\002D";
  hyphenate-character: "\\002D";
  -webkit-hyphenate-limit-lines: 3;
  -ms-hyphenate-limit-lines: 3;
  hyphenate-limit-lines: 3;
}

h1,
h2,
h3,
h4,
h5,
h6,
dt,
figcaption,
pre,
caption,
address,
center,
code,
var {
  -ms-hyphens: none;
  -moz-hyphens: none;
  -webkit-hyphens: none;
  -epub-hyphens: none;
  hyphens: none;
}

/* OTF */

body {
  font-variant-numeric: oldstyle-nums proportional-nums;
}

:lang(ja) body,
:lang(zh) body,
:lang(ko) body {
  font-variant-numeric: lining-nums proportional-nums;
}

h1, h2, h3, h4, h5, h6, dt {
  font-variant-numeric: lining-nums proportional-nums;
}

table {
  font-variant-numeric: lining-nums tabular-nums;
}

code, var {
  font-variant-ligatures: none;
  font-variant-numeric: lining-nums tabular-nums slashed-zero;
}

rt {
  font-variant-east-asian: ruby;
}

:lang(ar) {
  font-variant-ligatures: common-ligatures;
}

:lang(ko) {
  font-kerning: normal;
}

/* Night mode */

hr {
  color: inherit;
  border-color: currentColor;
}

table, th, td {
  border-color: currentColor;
}

/* Horizontal Spacing */

figure, blockquote {
  margin: 1em 5%;
}

/*

:lang(ja) figure, :lang(ja) blockquote,
:lang(zh-Hant) figure, :lang(zh-Hant) blockquote,
:lang(zh-TW) figure, :lang(zh-TW) blockquote,
:lang(mn) figure, :lang(mn) blockquote {
  margin: 5% 1em;
}

*/

ul, ol {
  padding-left: 5%;
}

/*

:lang(ja) ul, :lang(ja) ol,
:lang(zh-Hant) ul, :lang(zh-Hant) ol,
:lang(zh-TW) ul, :lang(zh-TW) ol,
:lang(mn) ul, :lang(mn) ol   {
  padding-top: 5%;
}

*/

dd {
  margin-left: 5%;
}

/*

:lang(ja) dd,
:lang(zh-Hant) dd,
:lang(zh-TW) dd,
:lang(mn) dd {
  margin-top: 5%;
}

*/

pre {
  white-space: pre-wrap;
  -ms-tab-size: 2;
  -moz-tab-size: 2;
  -webkit-tab-size: 2;
  tab-size: 2;
}

/* Normalization */

abbr[title], acronym[title] {
  text-decoration: dotted underline;
}

nobr wbr {
  white-space: normal;
}

/* Make ruby text and parentheses non-selectable (TBC) */

ruby > rt, ruby > rp {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* Internationalization */

*:lang(ja),
*:lang(zh),
*:lang(ko),
:lang(ja) cite,
:lang(ja) dfn,
:lang(ja) em,
:lang(ja) i,
:lang(zh) cite,
:lang(zh) dfn,
:lang(zh) em,
:lang(zh) i,
:lang(ko) cite,
:lang(ko) dfn,
:lang(ko) em,
:lang(ko) i {
  font-style: normal;
}

:lang(ja) a,
:lang(zh) a,
:lang(ko) a {
  text-decoration: none;
}

/* Readium CSS
   Safeguards module

   A set of styles to prevent common issues in pagination

   Repo: https://github.com/readium/readium-css */

/* Config */

/* We’ll be using an "RS__" prefix so that we can prevent collisions with authors’ CSS */

:root {
  /* max-width for media, you can override that via JS if not compiled to static */
  --RS__maxMediaWidth: 100%;

  /* max-height for media, you can override that via JS if not compiled to static
     Please consider figures might have a figcaption, which is why 95vh in the first place */
  --RS__maxMediaHeight: 95vh;

  /* value for medias’ box-sizing */
  --RS__boxSizingMedia: border-box;

  /* value for table’s box-sizing */
  --RS__boxSizingTable: border-box;
}

/* Sanitize line-heights in webkit e.g. raised cap without a declared line-height
   See effect by checking this demo in Safari: https://codepen.io/JayPanoz/pen/gRmzrE
   Note: glyphs has to be reset to inline for CJK */

html {
  -webkit-line-box-contain: block glyphs replaced;
}

:lang(ja) {
  -webkit-line-box-contain: block inline replaced;
}

/* Wrap long strings if larger than line-length */

a, h1, h2, h3, h4, h5, h6 {
  word-wrap: break-word;
}

div {
  max-width: var(--RS__maxMediaWidth);
}

/* Size medias */

/* You can override CSS variables by re-defining it for all elements or a specific one */

img, svg, audio, video {

  /* Object-fit allows us to keep the correct aspect-ratio */
  object-fit: contain;

  width: auto;
  height: auto;

  /* Some files don’t have max-width */
  max-width: var(--RS__maxMediaWidth);

  /* We’re setting a max-height, especially for covers */
  max-height: var(--RS__maxMediaHeight) !important;
  /* We probably don’t need to use modern box-sizing as auto behaves like it */
  box-sizing: var(--RS__boxSizingMedia);

  /* For page-break, we must use those 3
     We can’t use a variable there, webkit seems to no support them for those properties */
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Try preventing border being cut-off, webkit + blink have content-box by default */

table {
  max-width: var(--RS__maxMediaWidth);
  box-sizing: var(--RS__boxSizingTable);
}
/*# sourceMappingURL=ReadiumCSS-before.css.map */`, Kr = `/* Readium CSS
   Default module for RTL scripts

   A stylesheet for unstyled ebooks based on HTML5 Suggested Rendering
   Note: works in combination with Base module

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root {
  --RS__compFontFamily: var(--RS__baseFontFamily);
  --RS__codeFontFamily: var(--RS__monospaceTf);

  --RS__typeScale: 1.125; /* 1.067 | 1.125 | 1.2 | 1.25 | 1.333 | 1.414 | 1.5 | 1.618 */
  --RS__baseFontSize: 100%;

  --RS__flowSpacing: 1.5rem;
  --RS__paraSpacing: 0;
  --RS__paraIndent: 1em;

  --RS__linkColor: #0000EE;
  --RS__visitedColor: #551A8B;

  --RS__primaryColor: ;
  --RS__secondaryColor: ;
}

/* STYLES */

/* Typo */

body {
  font-size: var(--RS__baseFontSize);
  text-align: justify;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--RS__compFontFamily);
  text-align: right;
}

/* Flow content */

blockquote,
figure,
p,
pre,
aside,
footer,
form,
hr {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
}

p {
  margin-top: var(--RS__paraSpacing);
  margin-bottom: var(--RS__paraSpacing);
  text-indent: var(--RS__paraIndent);
}

h1 + p,
h2 + p,
h3 + p,
h4 + p,
h5 + p,
h6 + p,
hr + p {
  text-indent: 0;
}

pre {
  font-family: var(--RS__codeFontFamily);
}

/* Phrasing content */

code, kbd, samp, tt {
  font-family: var(--RS__codeFontFamily);
}

sub, sup {
  position: relative;
  font-size: 67.5%;
  line-height: 1;
}

sub {
  bottom: -0.2ex;
}

sup {
  bottom: 0;
}

:link {
  color: var(--RS__linkColor);
}

:visited {
  color: var(--RS__visitedColor);
}

/* Headings */

h1 {
  margin-top: calc(var(--RS__flowSpacing) * 2);
  margin-bottom: calc(var(--RS__flowSpacing) * 2);
  /* The following is base font size * typescale power of 3 */
  font-size: calc(((1em * var(--RS__typeScale)) * var(--RS__typeScale)) * var(--RS__typeScale));
}

h2 {
  margin-top: calc(var(--RS__flowSpacing) * 2);
  margin-bottom: var(--RS__flowSpacing);
  /* The following is base font size * typescale power of 2 */
  font-size: calc((1em * var(--RS__typeScale)) * var(--RS__typeScale));
}

h3 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
  font-size: calc(1em * var(--RS__typeScale));
}

h4 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
  font-size: 1em;
}

h5 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
  font-size: smaller;
}

h6 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: 0;
  font-size: smaller;
  font-weight: normal;
}

/* Lists */

dl, ol, ul {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
}

/* Table */

table {
  margin: var(--RS__flowSpacing) 0;
  border: 1px solid currentColor;
  border-collapse: collapse;
  empty-cells: show;
}

thead, tbody, tfoot, table > tr {
  vertical-align: top;
}

th {
  text-align: initial;
}

th, td {
  padding: 4px;
  border: 1px solid currentColor;
}
/*# sourceMappingURL=ReadiumCSS-default.css.map */`, $r = `/* Readium CSS
   Config module

   A file allowing implementers to customize flags for reading modes,
   user settings, etc.

   Repo: https://github.com/readium/readium-css */

/* Custom medias
   Syntax: @custom-media --variable (prop: value) */

/* Responsive columns
   The minimum width for which responsive columns (2 -> 1 and vice versa,
   depending on the current font-size) must be enabled */

/* Mobile columns
   The minimum and maximum width for mobile devices.
   We’re forcing the landscape orientation by default,
   and must still investigate large tablets (iPad Pro, Surface Pro 3, etc.). */

/* Custom selectors
   Syntax: @custom-selector :--variable selector
   The selectors you will use for flags/switches
   You can alternatively use classes or custom data-* attributes */

/* User view = paged | scrolled */

/* Font-family override */

/* Advanced settings */

/* Reading Modes */

/* Filters (images) */

/* Accessibility normalization */

/* Accessibility font. You can add selectors, using “, ” as a separator, if you have multiple fonts */

/* Direction i.e. ltr and rtl */

/* Readium CSS
   Pagination module

   A set of styles to paginate ePublications

   Repo: https://github.com/readium/readium-css */

/* Config */

/* Columns are responsive by default, even if column-width is set in pixels,
   which means two-page spread will switch to single page depending on current font-size.
   If you want more control, I’m afraid you’ll have to update colWidth/colGap dynamically,
   which is how a significant amount of RS do at the moment. */

/* Default for smartphone portrait (small screens) */

:root {
  /* Your columns’ width floor */
  --RS__colWidth: 45em; /* The width at which we’ll switch to 2 columns by default. PS: you can’t set it in rem */

  /* Ideal number of columns (depending on columns’ width floor) */
  --RS__colCount: 1;

  /* Gap between columns (in pixels so that it won’t resize with font-size) */
  --RS__colGap: 0;

  /* Optimal line-length (rem will take :root font-size into account, whatever the body’s font-size) */
  --RS__maxLineLength: 40rem;

  /* Default page horizontal margins (in pixels so that it won’t resize with font-size) */
  --RS__pageGutter: 20px; /* See if colGap and pageGutter can be the same var */
}

/* Reset page margins for Forward compatibility */

@page {
  margin: 0 !important;
}

/* :root selector has same specificity as a class i.e. 0010
   We might have to change that to html / context
   -> https://css-tricks.com/almanac/selectors/r/root/ */

:root {

  /* In case you use left position to scroll, can be removed if using transform: translateX() */
  position: relative;

  -webkit-column-width: var(--RS__colWidth);
  -moz-column-width: var(--RS__colWidth);
  column-width: var(--RS__colWidth);

  /* Init pagination */
  /* TODO: document columns’ logic cos it might feel weird at first */
  -webkit-column-count: var(--RS__colCount);
  -moz-column-count: var(--RS__colCount);
  column-count: var(--RS__colCount);

  -webkit-column-gap: var(--RS__colGap);
  -moz-column-gap: var(--RS__colGap);
  column-gap: var(--RS__colGap);

  /* Default is balance and we want columns to be filled entirely (100vh) */
  -moz-column-fill: auto;
  column-fill: auto;
  width: 100%;
  height: 100vh;
  max-width: 100%;
  max-height: 100vh;
  min-width: 100%;
  min-height: 100vh;
  padding: 0 !important;
  margin: 0 !important;

  /* Column size will depend on this if we want to make it responsive */
  font-size: 100% !important;

  -webkit-text-size-adjust: none;
  text-size-adjust: none;

  /* Switch to newer box model (not inherited by authors’ styles) */
  box-sizing: border-box;

  /* Fix bug for older Chrome */
  -webkit-perspective: 1;
  /* Prevents options pop-up when long tap in webkit */
  -webkit-touch-callout: none;
}

body {
  /*  overflow: hidden; bugfix: contents won’t paginate in Firefox and one sample in Safari */
  width: 100%;

  /* Limit line-length but we have to reset when 2 columns and control the viewport.
     By using max-width + margin auto, margins will shrink when font-size increases,
     which is what would be expected in terms of typography. */
  max-width: var(--RS__maxLineLength) !important;
  padding: 0 var(--RS__pageGutter) !important;
  margin: 0 auto !important;

  /* We need a minimum padding on body so that descandants/ascendants in italic/script are not cut-off.
     Drawback: we have to use border-box so that it doesn’t screw the box model,
     which means it impacts colWidth and max-width */
  box-sizing: border-box;
}

/* We’ll now redefine margins and columns depending on the minimum width available
   The goal is having the simplest model possible and avoid targeting devices */

/* Smartphone landscape */

@media screen and (min-width: 35em) {
  :root {
    --RS__pageGutter: 30px;
  }
}

/* Tablet portrait */

@media screen and (min-width: 45em) {
  :root {
    --RS__pageGutter: 40px;
  }
}

/* Desktop + tablet large */

/* We get the previous settings, we just change the margins */

@media screen and (min-width: 75em) {
  :root {
    --RS__pageGutter: 50px;
  }
}

/* At this point (80em or so), constraining line length must be done at the web view/iframe level, or by limiting the size of :root itself */

/* Responsive columns */

@media screen and (min-width: 60em), screen and (min-device-width: 36em) and (max-device-width: 47em) and (orientation: landscape) {
  :root {
    /* The size at which we want 2 columns to switch to 1 (depending on font-size) */
    --RS__colWidth: 20em; /* 20 * 16 = 320px but 20 * 28 = 560px so it will switch to 1 col @ 175% font-size (user-setting) on an iPad */
    /* We constrain to 2 columns so that we can never get 3 or 4, etc. */
    --RS__colCount: 2;
    --RS__maxLineLength: 39.99rem; /* If we don’t use this, colNumber user setting won’t work in Safari… */
  }
}

/* Readium CSS
   Scroll module

   A set of styles to scroll ePublications
   This module overrides pagination

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-scroll-on"] {

  /* Reset columns, auto + auto = columns can’t be created */
  -webkit-columns: auto auto !important;
  -moz-columns: auto auto !important;
  columns: auto auto !important;
  width: auto !important;
  height: auto !important;
  max-width: none !important;
  max-height: none !important;
  /* Reset html size so that the user can scroll */
  min-width: 0 !important;
  min-height: 0 !important;
}

/* Make sure line-length is limited in all configs */

:root[style*="readium-scroll-on"] body {
  --RS__maxLineLength: 40rem !important;
}

/* Readium CSS
   Night mode

   A preset theme for night mode

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

/* [style*="--USER__appearance"] can be used to increase specificity but performance hit */

:root[style*="readium-night-on"] {
  --RS__backgroundColor: #000000;
  --RS__textColor: #FEFEFE;

  --RS__linkColor: #63caff;
  --RS__visitedColor: #0099E5;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;
}

/* we don’t need to redeclare bg-color and color for :root since we will inherit and update from day/default mode */

:root[style*="readium-night-on"] *:not(a) {
  color: inherit !important;
  background-color: transparent !important;
  border-color: currentColor !important;
}

:root[style*="readium-night-on"] svg text {
  fill: currentColor !important;
  stroke: none !important;
}

:root[style*="readium-night-on"] a:link,
:root[style*="readium-night-on"] a:link * {
  color: var(--RS__linkColor) !important;
}

:root[style*="readium-night-on"] a:visited,
:root[style*="readium-night-on"] a:visited * {
  color: var(--RS__visitedColor) !important;
}

:root[style*="readium-night-on"] img[class*="gaiji"],
:root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
  -webkit-filter: invert(100%);
  filter: invert(100%);
}

/* Darken all images on user’s demand */

:root[style*="readium-night-on"][style*="readium-darken-on"] img {
  -webkit-filter: brightness(80%);
  filter: brightness(80%);
}

/* Invert all images on user’s demand */

:root[style*="readium-night-on"][style*="readium-invert-on"] img {
  -webkit-filter: invert(100%);
  filter: invert(100%);
}

/* Darken and invert on user’s demand */

:root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
  -webkit-filter: brightness(80%) invert(100%);
  filter: brightness(80%) invert(100%);
}

/* Readium CSS
   Sepia mode

   A preset theme for sepia mode

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root[style*="readium-sepia-on"] {
  --RS__backgroundColor: #faf4e8;
  --RS__textColor: #121212;

  --RS__linkColor: #0000EE;
  --RS__visitedColor: #551A8B;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;

  --RS__maxLineLength: 40.01rem; /* Forcing a reflow in Blink/Webkit so that blend mode can work */
}

/* we don’t need to redeclare bg-color and color for :root since we will inherit and update from day/default mode */

:root[style*="readium-sepia-on"] *:not(a) {
  color: inherit !important;
  background-color: transparent !important;
}

:root[style*="readium-sepia-on"] a:link,
:root[style*="readium-sepia-on"] a:link * {
  color: var(--RS__linkColor);
}

:root[style*="readium-sepia-on"] a:visited,
:root[style*="readium-sepia-on"] a:visited * {
  color: var(--RS__visitedColor);
}

:root[style*="readium-sepia-on"] svg,
:root[style*="readium-sepia-on"] img {
  /* Make sure the proper bg-color is used for the blend mode */
  background-color: transparent !important;
  mix-blend-mode: multiply;
}

/* Readium CSS
   OS Accessibility Modes

   A stylesheet to deal with OS accessibility settings

   Repo: https://github.com/readium/readium-css */

/* Windows high contrast colors are mapped to CSS system color keywords
   See http://www.gwhitworth.com/blog/2017/04/how-to-use-ms-high-contrast */

@media screen and (-ms-high-contrast: active) {
  :root {
    color: windowText !important;
    background-color: window !important;
  }

  /* The following selectors are super funky but it makes sure everything is inherited, this is indeed critical for this mode */
  :root :not(#\\#):not(#\\#):not(#\\#),
  :root :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#)
  :root :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#) :not(#\\#):not(#\\#):not(#\\#) {
    color: inherit !important;
    background-color: inherit !important;
  }

  .readiumCSS-mo-active-default {
    color: highlightText !important;
    background-color: highlight !important;
  }

  /* For links, hyperlink keyword is automatically set */

  /* Should we also set user highlights? */
}

@media screen and (-ms-high-contrast: white-on-black) {
  :root[style*="readium-night-on"] img[class*="gaiji"],
  :root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-invert-on"] img {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
    -webkit-filter: brightness(80%);
    filter: brightness(80%);
  }
}

/* Will be true on recent versions of iOS and MacOS if inverted setting enabled by the user */

@media screen and (inverted-colors) {
  :root[style*="readium-night-on"] img[class*="gaiji"],
  :root[style*="readium-night-on"] *[epub\\:type~="titlepage"] img:only-child {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-invert-on"] img {
    -webkit-filter: none !important;
    filter: none !important;
  }
  :root[style*="readium-night-on"][style*="readium-darken-on"][style*="readium-invert-on"] img {
    -webkit-filter: brightness(80%);
    filter: brightness(80%);
  }
}

@media screen and (monochrome) {
  /* Grayscale (Implemented in Safari, what about eInk?) */
  /* Must deal with anything color (contrast) so must be managed at the night/sepia/theme level :( */
}

@media screen and (prefers-reduced-motion) {
  /* If reduced motion is set on MacOS, in case we have animation/transition */
}

/* Readium CSS
   Columns number pref

   A submodule managing columns number for user settings
   Part of “Chrome Advanced” class – no flag required.

   Repo: https://github.com/readium/readium-css */

/* Number of columns = 1 | 2 */

/* We still need to see if we allow users to force number of columns for all configs, currently it behaves as an "auto" setting */

/* apply col setting except for mobile portrait */

@media screen and (min-width: 60em), screen and (min-device-width: 36em) and (max-device-width: 47em) and (orientation: landscape) {
  :root[style*="--USER__colCount: 1"],
  :root[style*="--USER__colCount:1"],
  :root[style*="--USER__colCount: 2"],
  :root[style*="--USER__colCount:2"] {
    -webkit-column-count: var(--USER__colCount);
    -moz-column-count: var(--USER__colCount);
    column-count: var(--USER__colCount);
  }

  /* If one column, make sure we limit line-length */
  :root[style*="--USER__colCount: 1"],
  :root[style*="--USER__colCount:1"] {
    --RS__maxLineLength: 40rem !important; /* This is the only way for the user setting to work in webkit… */
    --RS__colWidth: 100vw;
  }

  /* If smartphone landscape, and 2 columns, col width the same as iPad landscape + desktop */
  :root[style*="--USER__colCount: 2"],
  :root[style*="--USER__colCount:2"] {
    --RS__colWidth: auto; /* User explicitely tells he/she wants 2 columns, we reset floor value */
  }
}

/* Readium CSS
   Page margins pref

   A submodule managing page margins for user settings
   Part of “Chrome Advanced” class – no flag required.

   Repo: https://github.com/readium/readium-css */

/* Page Margins: the user margin is a factor of the page gutter e.g. 0.5, 0.75, 1, 1.25, 1.5, etc. */

:root[style*="--USER__pageMargins"] body {
  padding: 0 calc(var(--RS__pageGutter) * var(--USER__pageMargins)) !important;
}

/* Readium CSS
   Custom colors pref

   A submodule managing custom colors for user settings
   Part of “Chrome Advanced” class – no flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="--USER__backgroundColor"] {
  background-color: var(--USER__backgroundColor) !important;
}

:root[style*="--USER__backgroundColor"] * {
  background-color: transparent !important;
}

:root[style*="--USER__textColor"] {
  color: var(--USER__textColor) !important;
}

:root[style*="--USER__textColor"] *:not(h1):not(h2):not(h3):not(h4):not(h5):not(h6):not(pre) {
  color: inherit !important;
}

/* Readium CSS
   Text align pref

   A submodule managing text-align for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__textAlign"] {
  text-align: var(--USER__textAlign);
}

:root[style*="readium-advanced-on"][style*="--USER__textAlign"] body,
:root[style*="readium-advanced-on"][style*="--USER__textAlign"] *:not(blockquote):not(figcaption) p,
:root[style*="readium-advanced-on"][style*="--USER__textAlign"] li {
  text-align: inherit !important;
  -moz-text-align-last: auto !important;
  -epub-text-align-last: auto !important;
  text-align-last: auto !important;
}

/* In case something goes wrong at the programmatic level + rtl for body + rtl in ltr */

:root[style*="readium-advanced-on"][dir="rtl"][style*="--USER__textAlign: left"],
:root[style*="readium-advanced-on"][dir="rtl"][style*="--USER__textAlign:left"],
:root[style*="readium-advanced-on"][style*="--USER__textAlign: left"] *[dir="rtl"],
:root[style*="readium-advanced-on"][style*="--USER__textAlign:left"] *[dir="rtl"] {
  text-align: right;
}

/* Edge, if logical value is used, think of it as a polyfill. For LTR, it will fall back to the default, which is left */

:root[style*="readium-advanced-on"][dir="rtl"][style*="--USER__textAlign: start"],
:root[style*="readium-advanced-on"][dir="rtl"][style*="--USER__textAlign:start"] {
  text-align: right;
}

/* Readium CSS
   Hyphenation pref

   A submodule managing hyphens for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

/* Managing hyphenation automatically for text-align values */

:root[style*="readium-advanced-on"][style*="--USER__textAlign: justify"] body,
:root[style*="readium-advanced-on"][style*="--USER__textAlign:justify"] body {
  -webkit-hyphens: auto;
  -moz-hyphens: auto;
  -ms-hyphens: auto;
  -epub-hyphens: auto;
  hyphens: auto;
}

:root[style*="readium-advanced-on"][style*="--USER__textAlign: left"] body,
:root[style*="readium-advanced-on"][style*="--USER__textAlign:left"] body,
:root[style*="readium-advanced-on"][style*="--USER__textAlign: right"] body,
:root[style*="readium-advanced-on"][style*="--USER__textAlign:right"] body {
  -webkit-hyphens: none;
  -moz-hyphens: none;
  -ms-hyphens: none;
  -epub-hyphens: none;
  hyphens: none;
}

/* Managing the user override */

:root[style*="readium-advanced-on"][style*="--USER__bodyHyphens"] {
  -webkit-hyphens: var(--USER__bodyHyphens) !important;
  -moz-hyphens: var(--USER__bodyHyphens) !important;
  -ms-hyphens: var(--USER__bodyHyphens) !important;
  -epub-hyphens: var(--USER__bodyHyphens) !important;
  hyphens: var(--USER__bodyHyphens) !important;
}

/* Sorry, we can’t use \`:matches\`, \`:-moz-any\` or \`:-webkit-any\` because MS doesn’t support it yet */

:root[style*="readium-advanced-on"][style*="--USER__bodyHyphens"] body,
:root[style*="readium-advanced-on"][style*="--USER__bodyHyphens"] p,
:root[style*="readium-advanced-on"][style*="--USER__bodyHyphens"] li,
:root[style*="readium-advanced-on"][style*="--USER__bodyHyphens"] div,
:root[style*="readium-advanced-on"][style*="--USER__bodyHyphens"] dd {
  -webkit-hyphens: inherit;
  -moz-hyphens: inherit;
  -ms-hyphens: inherit;
  -epub-hyphens: inherit;
  hyphens: inherit;
}

/* Readium CSS
   Font Family pref

   A submodule managing font-family for user settings
   Part of “User Overrides” class – “font override” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-font-on"][style*="--USER__fontFamily"] {
  font-family: var(--USER__fontFamily) !important;
}

:root[style*="readium-font-on"][style*="--USER__fontFamily"] body,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] p,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] li,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] div,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] dt,
:root[style*="readium-font-on"][style*="--USER__fontFamily"] dd {
  font-family: inherit !important;
}

:root[style*="readium-font-on"][style*="--USER__fontFamily"] i:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] i:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] em:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] em:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] cite:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] cite:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] b:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] b:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] strong:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] strong:not([xml\\:lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] span:not([lang]),
:root[style*="readium-font-on"][style*="--USER__fontFamily"] span:not([xml\\:lang]) {
  font-family: inherit !important;
}

/* Readium CSS
   A11y font pref

   A submodule managing a11y text normalization for user settings
   Part of “User Overrides” class – “font override” flag required.

   Repo: https://github.com/readium/readium-css */

/* For AccessibleDfA, we need to normalize font-weight and font-style since only the normal style is available */

:root[style*="readium-font-on"][style*="AccessibleDfA"] {
  /* We won’t use the variable there since we need fallbacks for missing characters */
  font-family: AccessibleDfA, Verdana, Tahoma, "Trebuchet MS", sans-serif !important;
  --RS__lineHeightCompensation: 1.167;
}

:root[style*="readium-font-on"][style*="IA Writer Duospace"] {
  /* We won’t use the variable there since we need fallbacks for missing characters */
  font-family: "IA Writer Duospace", Menlo, "DejaVu Sans Mono", "Bitstream Vera Sans Mono", Courier, monospace !important;
  --RS__lineHeightCompensation: 1.167;
}

:root[style*="readium-font-on"][style*="readium-a11y-on"] {
  font-family: var(--USER__fontFamily) !important;
  --RS__lineHeightCompensation: 1.167;
}

/* Maybe users want a setting to normalize any font offered so there is a “a11y Normalize” flag for it */

:root[style*="readium-font-on"][style*="AccessibleDfA"],
:root[style*="readium-font-on"][style*="IA Writer Duospace"],
:root[style*="readium-font-on"][style*="readium-a11y-on"] {
  font-style: normal !important;
  font-weight: normal !important;
}

/* Targeting everything except code. Note that Open Dyslexic has a monospaced font for code */

:root[style*="readium-font-on"][style*="AccessibleDfA"] *:not(code):not(var):not(kbd):not(samp),
:root[style*="readium-font-on"][style*="IA Writer Duospace"] *:not(code):not(var):not(kbd):not(samp),
:root[style*="readium-font-on"][style*="readium-a11y-on"] *:not(code):not(var):not(kbd):not(samp) {
  font-family: inherit !important;
  font-style: inherit !important;
  font-weight: inherit !important;
}

/* Normalizing text-decoration, subs and sups */

:root[style*="readium-font-on"][style*="AccessibleDfA"] *,
:root[style*="readium-font-on"][style*="IA Writer Duospace"] *,
:root[style*="readium-font-on"][style*="readium-a11y-on"] * {
  text-decoration: none !important;
  font-variant-caps: normal !important;
  font-variant-numeric: normal !important;
  font-variant-position: normal !important;
}

:root[style*="readium-font-on"][style*="AccessibleDfA"] sup,
:root[style*="readium-font-on"][style*="IA Writer Duospace"] sup,
:root[style*="readium-font-on"][style*="readium-a11y-on"] sup,
:root[style*="readium-font-on"][style*="AccessibleDfA"] sub,
:root[style*="readium-font-on"][style*="IA Writer Duospace"] sub,
:root[style*="readium-font-on"][style*="readium-a11y-on"] sub {
  font-size: 1rem !important;
  vertical-align: baseline !important;
}

/* Readium CSS
   Font size pref

   A submodule managing font-size for user settings
   Part of “User Overrides” class – no flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="--USER__fontSize"] > body {
  zoom:var(--USER__fontSize) !important;
}

@supports not (zoom: 1){
  :root[style*="--USER__fontSize"]{
    font-size:var(--USER__fontSize) !important;
  }
}

/* Readium CSS
   Line height pref

   A submodule managing line-height for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] {
  line-height: var(--USER__lineHeight) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] body,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] p,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] li,
:root[style*="readium-advanced-on"][style*="--USER__lineHeight"] div {
  line-height: inherit;
}

/* Readium CSS
   Para spacing pref

   A submodule managing paragraphs’ top and bottom margins for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__paraSpacing"] p {
  margin-top: var(--USER__paraSpacing) !important;
  margin-bottom: var(--USER__paraSpacing) !important;
}

/* Readium CSS
   Para indent pref

   A submodule managing paragraphs’ text-indent for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__paraIndent"] p {
  text-indent: var(--USER__paraIndent) !important;
}

/* If there are inline-block elements in paragraphs, text-indent will inherit so we must reset it */

:root[style*="readium-advanced-on"][style*="--USER__paraIndent"] p *,
:root[style*="readium-advanced-on"][style*="--USER__paraIndent"] p:first-letter {
  text-indent: 0 !important;
}

/* Readium CSS
   Word spacing pref

   A submodule managing word-spacing for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"] h1,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"] h2,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"] h3,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"] h4,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"] h5,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"] h6,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"] p,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"] li,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"] div {
  word-spacing: var(--USER__wordSpacing);
}

/* Readium CSS
   Letter spacing pref

   A submodule managing letter-spacing for user settings
   Part of “User Overrides Advanced” class – “advanced settings” flag required.

   Repo: https://github.com/readium/readium-css */

:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"] h1,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"] h2,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"] h3,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"] h4,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"] h5,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"] h6,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"] p,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"] li,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"] div {
  letter-spacing: var(--USER__letterSpacing);
  font-variant: none;
}

/* Readium CSS
   Font size normalize

   A stylesheet to normalize font-size

   Repo: https://github.com/readium/readium-css */

/* STYLES */

/* :root is used so that you can quickly add a class or attribute if you prefer e.g. \`:root[data-rs-normalize]\` */

/* We create a default so that you don’t need to explicitly set one in the DOM.
   Once the “Publisher’s styles” checkbox is unchecked, the normalize is applied automatically */

@supports not (zoom: 1){

:root[style*="readium-advanced-on"] {
  --USER__typeScale: 1.2; /* This is the default type scale you’ll find in most publications */
}

:root[style*="readium-advanced-on"] p,
:root[style*="readium-advanced-on"] li,
:root[style*="readium-advanced-on"] div,
:root[style*="readium-advanced-on"] pre,
:root[style*="readium-advanced-on"] dd {
  font-size: 1rem !important;
}

:root[style*="readium-advanced-on"] h1 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.75rem !important;
  font-size: calc(((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h2 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.5rem !important;
  font-size: calc((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h3 {
  /* Fallback if browser doesn’t support vars */
  font-size: 1.25rem !important;
  font-size: calc(1rem * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"] h4,
:root[style*="readium-advanced-on"] h5,
:root[style*="readium-advanced-on"] h6 {
  font-size: 1rem !important;
}

:root[style*="readium-advanced-on"] small {
  font-size: smaller !important;
}

:root[style*="readium-advanced-on"] sub,
:root[style*="readium-advanced-on"] sup {
  font-size: 67.5% !important;
}

/* The following styles kick in if you define the typeScale variable in the DOM.
   No need to repeat declarations which don’t make use of the variable */

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h1 {
  font-size: calc(((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h2 {
  font-size: calc((1rem * var(--USER__typeScale)) * var(--USER__typeScale)) !important;
}

:root[style*="readium-advanced-on"][style*="--USER__typeScale"] h3 {
  font-size: calc(1rem * var(--USER__typeScale)) !important;
}
}

/* Readium CSS
   Default highlights

   A stylesheet for user highlights

   Repo: https://github.com/readium/readium-css */

/* User Highlights */

.readiumCSS-yellow-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-yellow-highlight,
:root[style*="readium-night-on"] .readiumCSS-yellow-highlight {
  background-color: rgba(255, 255, 0, 0.5) !important;
}

.readiumCSS-green-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-green-highlight,
:root[style*="readium-night-on"] .readiumCSS-green-highlight {
  background-color: rgba(0, 255, 0, 0.5) !important;
}

.readiumCSS-orange-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-orange-highlight,
:root[style*="readium-night-on"] .readiumCSS-orange-highlight {
  background-color: rgba(255, 165, 0, 0.5) !important;
}

.readiumCSS-pink-highlight,
:root[style*="readium-sepia-on"] .readiumCSS-pink-highlight,
:root[style*="readium-night-on"] .readiumCSS-pink-highlight {
  background-color: rgba(255, 105, 180, 0.5) !important;
}

/* Media overlays */

.readiumCSS-mo-active-default {
  color: black !important;
  background-color: yellow !important;
}
/*# sourceMappingURL=ReadiumCSS-after.css.map */
`, Yr = `/* Readium CSS
   Config module

   A file allowing implementers to customize flags for reading modes,
   user settings, etc.

   Repo: https://github.com/readium/readium-css */

/* Custom medias
   Syntax: @custom-media --variable (prop: value) */

/* Responsive columns
   The minimum width for which responsive columns (2 -> 1 and vice versa,
   depending on the current font-size) must be enabled */

/* Mobile columns
   The minimum and maximum width for mobile devices.
   We’re forcing the landscape orientation by default,
   and must still investigate large tablets (iPad Pro, Surface Pro 3, etc.). */

/* Custom selectors
   Syntax: @custom-selector :--variable selector
   The selectors you will use for flags/switches
   You can alternatively use classes or custom data-* attributes */

/* User view = paged | scrolled */

/* Font-family override */

/* Advanced settings */

/* Reading Modes */

/* Filters (images) */

/* Accessibility normalization */

/* Accessibility font. You can add selectors, using “, ” as a separator, if you have multiple fonts */

/* Direction i.e. ltr and rtl */

/* Readium CSS
   Base module

   A minimal stylesheet for all ebooks

   Repo: https://github.com/readium/readium-css */

@namespace url("http://www.w3.org/1999/xhtml");

@namespace epub url("http://www.idpf.org/2007/ops");

@namespace m url("http://www.w3.org/1998/Math/MathML/");

@namespace svg url("http://www.w3.org/2000/svg");

/* Define viewport, HTML5-style */

@-ms-viewport {
  width: device-width;
}

@viewport {
  width: device-width;
  zoom: 1;
}

:root {
  /* Default font-stacks */
  --RS__oldStyleTf: "Iowan Old Style", "Sitka Text", Palatino, "Book Antiqua", serif;
  --RS__modernTf: Athelas, Constantia, Georgia, serif;
  --RS__sansTf: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --RS__humanistTf: Seravek, Calibri, Roboto, Arial, sans-serif;
  --RS__monospaceTf: "Andale Mono", Consolas, monospace;

  /* Config */
  --RS__baseFontFamily: var(--RS__oldStyleTf);

  /* For square-ish fonts (CJK, Indic, etc.), we must apply some compensation in dynamic leading. Default is 1 i.e. no compensation */
  --RS__lineHeightCompensation: 1;

  /* Dynamic leading based on typeface metrics + font-size setting */
  --RS__baseLineHeight: calc((1em + (2ex - 1ch) - ((1rem - 16px) * 0.1667)) * var(--RS__lineHeightCompensation));
}

/* Set default font for the html doc, so that it can be overridden by the authors’s stylesheet */

html {
  font-family: var(--RS__baseFontFamily);
  /* Fallback line-height */
  line-height: 1.6; /* Fits a little bit better for all languages than 1.5 */
  line-height: var(--RS__baseLineHeight);
  text-rendering: optimizeLegibility;
}

/* 1.5 being too loose with larger font-sizes, we reset headings to normal (which value is 1.125–1.375 for our font-stacks) */

h1, h2, h3 {
  line-height: normal;
}

:lang(ja),
:lang(zh),
:lang(ko) {
  word-wrap: break-word;
  -webkit-line-break: strict;
  -epub-line-break: strict;
  line-break: strict;
}

/* Set default font for Math */

math {
  font-family: "Latin Modern Math", "STIX Two Math", "XITS Math", "STIX Math", "Libertinus Math", "TeX Gyre Termes Math", "TeX Gyre Bonum Math", "TeX Gyre Schola", "DejaVu Math TeX Gyre", "TeX Gyre Pagella Math", "Asana Math", "Cambria Math", "Lucida Bright Math", "Minion Math", STIXGeneral, STIXSizeOneSym, Symbol, "Times New Roman", serif;
}

/* Language Overrides
   That will only work if either html or body have a (xml:)lang attribute, not for inline overrides */

:lang(am) {
  --RS__baseFontFamily: Kefa, Nyala, Roboto, Noto, "Noto Sans Ethiopic", serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(ar) {
  --RS__baseFontFamily: "Geeza Pro", "Arabic Typesetting", Roboto, Noto, "Noto Naskh Arabic", "Times New Roman", serif;
}

:lang(bn) {
  --RS__baseFontFamily: "Kohinoor Bangla", "Bangla Sangam MN", Vrinda, Roboto, Noto, "Noto Sans Bengali", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(bo) {
  --RS__baseFontFamily: Kailasa, "Microsoft Himalaya", Roboto, Noto, "Noto Sans Tibetan", sans-serif;
}

:lang(chr) {
  --RS__baseFontFamily: "Plantagenet Cherokee", Roboto, Noto, "Noto Sans Cherokee";
  --RS__lineHeightCompensation: 1.167;
}

:lang(fa) {
  --RS__baseFontFamily: "Geeza Pro", "Arabic Typesetting", Roboto, Noto, "Noto Naskh Arabic", "Times New Roman", serif;
}

:lang(gu) {
  --RS__baseFontFamily: "Gujarati Sangam MN", "Nirmala UI", Shruti, Roboto, Noto, "Noto Sans Gujarati", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(he) {
  --RS__baseFontFamily: "New Peninim MT", "Arial Hebrew", Gisha, "Times New Roman", Roboto, Noto, "Noto Sans Hebrew" sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(hi) {
  --RS__baseFontFamily: "Kohinoor Devanagari", "Devanagari Sangam MN", Kokila, "Nirmala UI", Roboto, Noto, "Noto Sans Devanagari", sans-serif;

  --RS__lineHeightCompensation: 1.1;
}

:lang(hy) {
  --RS__baseFontFamily: Mshtakan, Sylfaen, Roboto, Noto, "Noto Serif Armenian", serif;
}

:lang(iu) {
  --RS__baseFontFamily: "Euphemia UCAS", Euphemia, Roboto, Noto, "Noto Sans Canadian Aboriginal", sans-serif;
}

:lang(ja) {
  --RS__baseFontFamily: YuGothic, "Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Meiryo UI", "MS Gothic", Roboto, Noto, "Noto Sans CJK JP", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;

  /* Extra variables for Japanese font-stacks as we may want to reuse them for user settings + default */
  /* This setting uses the BIZ UD font for serif and the Yu font for sans serif on Windows. Note: When using the BIZ UD font for vertical writing display, if you set half-width (ASCII) characters to stand upright with \`text-orientation: upright\`, the width of these characters is narrow. By specifying \`font-variant-east-asian: full-width;\` at the same time, you can display the characters with the width of one full-width character. */
  --RS__serif-ja: "Hiragino Mincho ProN", "Hiragino Mincho Pro", "YuMincho", "BIZ UDPMincho", "Yu Mincho", "ＭＳ Ｐ明朝", "MS PMincho", serif;
  --RS__sans-serif-ja: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Hiragino Kaku Gothic Pro", "ヒラギノ角ゴ W3", "YuGothic", "Yu Gothic Medium", "BIZ UDPGothic", "Yu Gothic", "ＭＳ Ｐゴシック", "MS PGothic", sans-serif;
  --RS__serif-ja-v: "Hiragino Mincho ProN", "Hiragino Mincho Pro", "YuMincho", "BIZ UDMincho", "Yu Mincho", "ＭＳ明朝", "MS Mincho", serif;
  --RS__sans-serif-ja-v: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Hiragino Kaku Gothic Pro", "ヒラギノ角ゴ W3", "YuGothic", "Yu Gothic Medium", "BIZ UDGothic", "Yu Gothic", "ＭＳゴシック", "MS Gothic", sans-serif;
}

:lang(km) {
  --RS__baseFontFamily: "Khmer Sangam MN", "Leelawadee UI", "Khmer UI", Roboto, Noto, "Noto Sans Khmer", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(kn) {
  --RS__baseFontFamily: "Kannada Sangam MN", "Nirmala UI", Tunga, Roboto, Noto, "Noto Sans Kannada", sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(ko) {
  --RS__baseFontFamily: "Nanum Gothic", "Apple SD Gothic Neo", "Malgun Gothic", Roboto, Noto, "Noto Sans CJK KR", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(lo) {
  --RS__baseFontFamily: "Lao Sangam MN", "Leelawadee UI", "Lao UI", Roboto, Noto, "Noto Sans Lao", sans-serif;
}

:lang(ml) {
  --RS__baseFontFamily: "Malayalam Sangam MN", "Nirmala UI", Kartika, Roboto, Noto, "Noto Sans Malayalam", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(or) {
  --RS__baseFontFamily: "Oriya Sangam MN", "Nirmala UI", Kalinga, Roboto, Noto, "Noto Sans Oriya", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(pa) {
  --RS__baseFontFamily: "Gurmukhi MN", "Nirmala UI", Kartika, Roboto, Noto, "Noto Sans Gurmukhi", sans-serif;
  --RS__lineHeightCompensation: 1.1;
}

:lang(si) {
  --RS__baseFontFamily: "Sinhala Sangam MN", "Nirmala UI", "Iskoola Pota", Roboto, Noto, "Noto Sans Sinhala", sans-serif;
  --RS__lineHeightCompensation: 1.167;
}

:lang(ta) {
  --RS__baseFontFamily: "Tamil Sangam MN", "Nirmala UI", Latha, Roboto, Noto, "Noto Sans Tamil", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

:lang(te) {
  --RS__baseFontFamily: "Kohinoor Telugu", "Telugu Sangam MN", "Nirmala UI", Gautami, Roboto, Noto, "Noto Sans Telugu", sans-serif;
}

:lang(th) {
  --RS__baseFontFamily: "Thonburi", "Leelawadee UI", "Cordia New", Roboto, Noto, "Noto Sans Thai", sans-serif;
  --RS__lineHeightCompensation: 1.067;
}

/* The following will also work for zh-Hans */

:lang(zh) {
  --RS__baseFontFamily: "方体", "PingFang SC", "黑体", "Heiti SC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK SC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(zh-Hant),
:lang(zh-TW) {
  --RS__baseFontFamily: "方體", "PingFang TC", "黑體", "Heiti TC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK TC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

:lang(zh-HK) {
  --RS__baseFontFamily: "方體", "PingFang HK", "方體", "PingFang TC", "黑體", "Heiti TC", "Microsoft JhengHei UI", "Microsoft JhengHei", Roboto, Noto, "Noto Sans CJK TC", sans-serif;

  /* For CJK, the line-height is usually 15–20% more than for Latin */
  --RS__lineHeightCompensation: 1.167;
}

/* Readium CSS
   Day/Default mode

   A preset theme for day mode, which is the default

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root {
  --RS__backgroundColor: #FFFFFF;
  --RS__textColor: #121212;

  /* This can be customized but initial will re-use default value of the browser */
  --RS__selectionBackgroundColor: #b4d8fe;
  --RS__selectionTextColor: inherit;
}

:root {
  color: var(--RS__textColor) !important;
  background-color: var(--RS__backgroundColor) !important;
}

/* Note: Though \`::selection\` was present in drafts of CSS Selectors Level 3, it was removed during the Candidate Recommendation phase because its behavior was under-specified (especially with nested elements) and interoperability wasn’t achieved. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/::selection */

::-moz-selection {
  color: var(--RS__selectionTextColor);
  background-color: var(--RS__selectionBackgroundColor);
}

::selection {
  color: var(--RS__selectionTextColor);
  background-color: var(--RS__selectionBackgroundColor);
}

/* Readium CSS
   Fonts module

   A stylesheet for embedded fonts

   Repo: https://github.com/readium/readium-css */

/* /!\\ Mind the path (relative to the folders in which you have stylesheets and the fonts) */

/*
@font-face {
  font-family: AccessibleDfA;
  font-style: normal;
  font-weight: normal;
  src: local("AccessibleDfA"),
    url("fonts/AccessibleDfA.otf") format("opentype");
}
*/

@font-face {
  font-family: AccessibleDfA;
  src: local("AccessibleDfA"),
    url("fonts/AccessibleDfA-Regular.woff2") format("woff2"),
    url("fonts/AccessibleDfA-Regular.woff") format("woff");
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: AccessibleDfA;
  src: local("AccessibleDfA"),
    url("fonts/AccessibleDfA-Bold.woff2") format("woff2");
  font-weight: bold;
  font-style: normal;
}

@font-face {
  font-family: AccessibleDfA;
  src: local("AccessibleDfA"),
    url("fonts/AccessibleDfA-Italic.woff2") format("woff2");
  font-weight: normal;
  font-style: italic;
}

@font-face {
  font-family: "IA Writer Duospace";
  src: local("iAWriterDuospace-Regular"),
    url("fonts/iAWriterDuospace-Regular.ttf") format("truetype");
  font-weight: normal;
  font-style: normal;
}

/* If you have different weights/styles,
   use \`font-weight\` and \`font-style\`,
   not prefixes in the font-family name,
   or else it will be a nightmare to manage in user settings. */

/* Readium CSS
   HTML5 SR Patch stylesheet

   A set of style to adjust HTML5 Suggested Rendering to paginated content

   Repo: https://github.com/readium/readium-css */

/* Fragmentation */

body {
  widows: 2;
  orphans: 2;
}

figcaption, th, td {
  widows: 1;
  orphans: 1;
}

h2,
h3,
h4,
h5,
h6,
dt,
hr,
caption {
  -webkit-column-break-after: avoid;
  page-break-after: avoid;
  break-after: avoid;
}

h1,
h2,
h3,
h4,
h5,
h6,
dt,
figure,
tr {
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Hyphenation */

body {
  -webkit-hyphenate-character: "\\002D";
  -moz-hyphenate-character: "\\002D";
  -ms-hyphenate-character: "\\002D";
  hyphenate-character: "\\002D";
  -webkit-hyphenate-limit-lines: 3;
  -ms-hyphenate-limit-lines: 3;
  hyphenate-limit-lines: 3;
}

h1,
h2,
h3,
h4,
h5,
h6,
dt,
figcaption,
pre,
caption,
address,
center,
code,
var {
  -ms-hyphens: none;
  -moz-hyphens: none;
  -webkit-hyphens: none;
  -epub-hyphens: none;
  hyphens: none;
}

/* OTF */

body {
  font-variant-numeric: oldstyle-nums proportional-nums;
}

:lang(ja) body,
:lang(zh) body,
:lang(ko) body {
  font-variant-numeric: lining-nums proportional-nums;
}

h1, h2, h3, h4, h5, h6, dt {
  font-variant-numeric: lining-nums proportional-nums;
}

table {
  font-variant-numeric: lining-nums tabular-nums;
}

code, var {
  font-variant-ligatures: none;
  font-variant-numeric: lining-nums tabular-nums slashed-zero;
}

rt {
  font-variant-east-asian: ruby;
}

:lang(ar) {
  font-variant-ligatures: common-ligatures;
}

:lang(ko) {
  font-kerning: normal;
}

/* Night mode */

hr {
  color: inherit;
  border-color: currentColor;
}

table, th, td {
  border-color: currentColor;
}

/* Horizontal Spacing */

figure, blockquote {
  margin: 1em 5%;
}

/*

:lang(ja) figure, :lang(ja) blockquote,
:lang(zh-Hant) figure, :lang(zh-Hant) blockquote,
:lang(zh-TW) figure, :lang(zh-TW) blockquote,
:lang(mn) figure, :lang(mn) blockquote {
  margin: 5% 1em;
}

*/

ul, ol {
  padding-left: 5%;
}

/*

:lang(ja) ul, :lang(ja) ol,
:lang(zh-Hant) ul, :lang(zh-Hant) ol,
:lang(zh-TW) ul, :lang(zh-TW) ol,
:lang(mn) ul, :lang(mn) ol   {
  padding-top: 5%;
}

*/

dd {
  margin-left: 5%;
}

/*

:lang(ja) dd,
:lang(zh-Hant) dd,
:lang(zh-TW) dd,
:lang(mn) dd {
  margin-top: 5%;
}

*/

pre {
  white-space: pre-wrap;
  -ms-tab-size: 2;
  -moz-tab-size: 2;
  -webkit-tab-size: 2;
  tab-size: 2;
}

/* Normalization */

abbr[title], acronym[title] {
  text-decoration: dotted underline;
}

nobr wbr {
  white-space: normal;
}

/* Make ruby text and parentheses non-selectable (TBC) */

ruby > rt, ruby > rp {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* Internationalization */

*:lang(ja),
*:lang(zh),
*:lang(ko),
:lang(ja) cite,
:lang(ja) dfn,
:lang(ja) em,
:lang(ja) i,
:lang(zh) cite,
:lang(zh) dfn,
:lang(zh) em,
:lang(zh) i,
:lang(ko) cite,
:lang(ko) dfn,
:lang(ko) em,
:lang(ko) i {
  font-style: normal;
}

:lang(ja) a,
:lang(zh) a,
:lang(ko) a {
  text-decoration: none;
}

/* Readium CSS
   Safeguards module

   A set of styles to prevent common issues in pagination

   Repo: https://github.com/readium/readium-css */

/* Config */

/* We’ll be using an "RS__" prefix so that we can prevent collisions with authors’ CSS */

:root {
  /* max-width for media, you can override that via JS if not compiled to static */
  --RS__maxMediaWidth: 100%;

  /* max-height for media, you can override that via JS if not compiled to static
     Please consider figures might have a figcaption, which is why 95vh in the first place */
  --RS__maxMediaHeight: 95vh;

  /* value for medias’ box-sizing */
  --RS__boxSizingMedia: border-box;

  /* value for table’s box-sizing */
  --RS__boxSizingTable: border-box;
}

/* Sanitize line-heights in webkit e.g. raised cap without a declared line-height
   See effect by checking this demo in Safari: https://codepen.io/JayPanoz/pen/gRmzrE
   Note: glyphs has to be reset to inline for CJK */

html {
  -webkit-line-box-contain: block glyphs replaced;
}

:lang(ja) {
  -webkit-line-box-contain: block inline replaced;
}

/* Wrap long strings if larger than line-length */

a, h1, h2, h3, h4, h5, h6 {
  word-wrap: break-word;
}

div {
  max-width: var(--RS__maxMediaWidth);
}

/* Size medias */

/* You can override CSS variables by re-defining it for all elements or a specific one */

img, svg, audio, video {

  /* Object-fit allows us to keep the correct aspect-ratio */
  object-fit: contain;

  width: auto;
  height: auto;

  /* Some files don’t have max-width */
  max-width: var(--RS__maxMediaWidth);

  /* We’re setting a max-height, especially for covers */
  max-height: var(--RS__maxMediaHeight) !important;
  /* We probably don’t need to use modern box-sizing as auto behaves like it */
  box-sizing: var(--RS__boxSizingMedia);

  /* For page-break, we must use those 3
     We can’t use a variable there, webkit seems to no support them for those properties */
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Try preventing border being cut-off, webkit + blink have content-box by default */

table {
  max-width: var(--RS__maxMediaWidth);
  box-sizing: var(--RS__boxSizingTable);
}
/*# sourceMappingURL=ReadiumCSS-before.css.map */
`, qr = `/* Readium CSS
   Default module

   A stylesheet for unstyled ebooks based on HTML5 Suggested Rendering
   Note: works in combination with Base module

   Repo: https://github.com/readium/readium-css */

/* CONFIG */

:root {
  --RS__compFontFamily: var(--RS__baseFontFamily);
  --RS__codeFontFamily: var(--RS__monospaceTf);

  --RS__typeScale: 1.125; /* 1.067 | 1.125 | 1.2 | 1.25 | 1.333 | 1.414 | 1.5 | 1.618 */
  --RS__baseFontSize: 100%;

  --RS__flowSpacing: 1.5rem;
  --RS__paraSpacing: 0;
  --RS__paraIndent: 1em;

  --RS__linkColor: #0000EE;
  --RS__visitedColor: #551A8B;

  --RS__primaryColor: ;
  --RS__secondaryColor: ;
}

/* STYLES */

/* Typo */

body {
  font-size: var(--RS__baseFontSize);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--RS__compFontFamily);
}

/* Flow content */

blockquote,
figure,
p,
pre,
aside,
footer,
form,
hr {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
}

p {
  margin-top: var(--RS__paraSpacing);
  margin-bottom: var(--RS__paraSpacing);
  text-indent: var(--RS__paraIndent);
}

h1 + p,
h2 + p,
h3 + p,
h4 + p,
h5 + p,
h6 + p,
hr + p {
  text-indent: 0;
}

pre {
  font-family: var(--RS__codeFontFamily);
}

/* Phrasing content */

code, kbd, samp, tt {
  font-family: var(--RS__codeFontFamily);
}

sub, sup {
  position: relative;
  font-size: 67.5%;
  line-height: 1;
}

sub {
  bottom: -0.2ex;
}

sup {
  bottom: 0;
}

:link {
  color: var(--RS__linkColor);
}

:visited {
  color: var(--RS__visitedColor);
}

/* Headings */

h1 {
  margin-top: calc(var(--RS__flowSpacing) * 2);
  margin-bottom: calc(var(--RS__flowSpacing) * 2);
  /* The following is base font size * typescale power of 3 */
  font-size: calc(((1em * var(--RS__typeScale)) * var(--RS__typeScale)) * var(--RS__typeScale));
}

h2 {
  margin-top: calc(var(--RS__flowSpacing) * 2);
  margin-bottom: var(--RS__flowSpacing);
  /* The following is base font size * typescale power of 2 */
  font-size: calc((1em * var(--RS__typeScale)) * var(--RS__typeScale));
}

h3 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
  font-size: calc(1em * var(--RS__typeScale));
}

h4 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
  font-size: 1em;
}

h5 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
  font-size: 1em;
  font-variant: small-caps;
}

h6 {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: 0;
  font-size: 1em;
  text-transform: lowercase;
  font-variant: small-caps;
}

/* Lists */

dl, ol, ul {
  margin-top: var(--RS__flowSpacing);
  margin-bottom: var(--RS__flowSpacing);
}

/* Table */

table {
  margin: var(--RS__flowSpacing) 0;
  border: 1px solid currentColor;
  border-collapse: collapse;
  empty-cells: show;
}

thead, tbody, tfoot, table > tr {
  vertical-align: top;
}

th {
  text-align: left;
}

th, td {
  padding: 4px;
  border: 1px solid currentColor;
}
/*# sourceMappingURL=ReadiumCSS-default.css.map */`, Vr = {
  default: {
    before: Yr,
    default: qr,
    after: $r
  },
  rtl: {
    before: jr,
    default: Kr,
    after: Wr
  },
  "cjk-horizontal": {
    before: Hr,
    default: Dr,
    after: Lr
  },
  "cjk-vertical": {
    before: Br,
    default: Gr,
    after: Or
  }
}, Xr = [
  "fonts/AccessibleDfA.otf",
  "fonts/AccessibleDfA-Regular.woff2",
  "fonts/AccessibleDfA-Regular.woff",
  "fonts/AccessibleDfA-Bold.woff2",
  "fonts/AccessibleDfA-Italic.woff2",
  "fonts/iAWriterDuospace-Regular.ttf"
], Jr = import.meta.url;
function Zr(e) {
  return new URL(`assets/readium/ReadiumCSS/${e}`, Jr).href;
}
function Qr() {
  const e = {};
  for (const n of Xr)
    e[n] = Zr(n);
  return e;
}
const K = "r2-css-paginated", ns = "r2-class-VWM", Tn = "r2-no-popup-foonotes", es = "r2-no-ruby", ts = "r2-reduce-motion", os = "r2-no-link-target-temp-highlight", Kn = "r2-footnote-force-show", as = 560, is = "book-reader-readium-before", Pt = "book-reader-readium-default", rs = "book-reader-readium-after", ss = "book-reader-readium-patch", ls = "book-reader-supplemental", cs = `
@namespace epub "http://www.idpf.org/2007/ops";

div[epub|type~="pagebreak"]:empty,
div[role~="doc-pagebreak"]:empty {
  line-height: 0 !important;
}

*[epub|type~="pagebreak"]:empty::before,
*[role~="doc-pagebreak"]:empty::before {
  display: contents;
  content: "\\feff";
}

:root:not(.${Tn}) aside[epub|type~="footnote"]:not(.${Kn}),
:root:not(.${Tn}) aside[epub|type~="note"]:not(.${Kn}),
:root:not(.${Tn}) aside[epub|type~="endnote"]:not(.${Kn}),
:root:not(.${Tn}) aside[epub|type~="rearnote"]:not(.${Kn}) {
  display: none;
}

audio[controls] {
  width: revert !important;
  height: revert !important;
}

:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h1,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h2,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h3,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h4,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h5,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h6,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) p,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) li,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) div {
  letter-spacing: var(--USER__letterSpacing);
  font-variant: none;
}

:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h1,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h2,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h3,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h4,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h5,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h6,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) p,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) li,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) div {
  word-spacing: var(--USER__wordSpacing);
}
`;
function Ge(e) {
  return (e.documentElement.getAttribute("lang") || e.documentElement.getAttribute("xml:lang") || e.documentElement.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") || "").trim().toLowerCase();
}
function ds(e) {
  const n = Ge(e);
  return n === "ja" || n.startsWith("ja-");
}
function $n(e) {
  const n = Ge(e);
  return n === "ja" || n.startsWith("ja-") || n === "zh" || n.startsWith("zh-") || n === "ko" || n.startsWith("ko-");
}
function It(e) {
  let n = !1, t = !1;
  if (e.documentElement.getAttribute("dir")?.trim().toLowerCase() === "rtl" && (t = !0, n = !0), n || e.body?.getAttribute("dir")?.trim().toLowerCase() === "rtl" && (t = !0, n = !0), !n) {
    const a = Ge(e);
    n = a === "ar" || a.startsWith("ar-") || a === "he" || a.startsWith("he-") || a === "fa" || a.startsWith("fa-");
  }
  return n && !t && e.documentElement.setAttribute("dir", "rtl"), n;
}
function ms(e) {
  return e.preferences.fontFamily === "sans" ? "SANS" : e.preferences.fontFamily === "round" ? "ROUND" : e.preferences.fontFamily === "system" ? "DEFAULT" : "OLD";
}
function us(e, n, t) {
  const o = `${Math.round(e.preferences.fontScale * 100)}%`, a = String(e.preferences.lineHeight ?? Ne), r = `${e.preferences.letterSpacing ?? Ue}em`;
  return {
    paged: !n.isVertical && e.preferences.readingMode === "paginated",
    colCount: t.forcedColCount,
    textAlign: e.preferences.textAlign === "left" ? "left" : "justify",
    lineHeight: a,
    letterSpacing: r,
    paraSpacing: "0.75rem",
    bodyHyphens: "auto",
    font: ms(e),
    fontSize: o,
    backgroundColor: e.theme.surface,
    textColor: e.theme.text,
    selectionBackgroundColor: e.theme.primary,
    selectionTextColor: e.theme.surface,
    linkColor: e.theme.primary,
    linkVisitedColor: e.theme.primary,
    noFootnotes: !1,
    noTemporaryNavTargetOutline: !1,
    noRuby: !1,
    reduceMotion: !1
  };
}
function hs(e) {
  if (e.head)
    return e.head;
  const n = e.createElement("head");
  return e.body ? e.documentElement.insertBefore(n, e.body) : e.documentElement.appendChild(n), n;
}
function Cn(e, n, t, o) {
  const a = hs(e), r = e.getElementById(n);
  if (go(r)) {
    r.textContent !== t && (r.textContent = t);
    return;
  }
  const i = e.createElement("style");
  if (i.id = n, i.type = "text/css", i.textContent = t, o?.prepend && a.firstChild) {
    a.insertBefore(i, a.firstChild);
    return;
  }
  a.appendChild(i);
}
function gs(e, n) {
  e.getElementById(n)?.remove();
}
function v(e, n, t) {
  if (!t) {
    e.style.removeProperty(n);
    return;
  }
  e.style.setProperty(n, t);
}
function ps(e, n, t) {
  if (!t) {
    e.style.removeProperty(n);
    return;
  }
  e.style.setProperty(n, t, "important");
}
function fs(e, n) {
  return `
:root {
  color-scheme: light;
  --book-reader-surface: ${e.theme.surface};
  --book-reader-text: ${e.theme.text};
  --book-reader-primary: ${e.theme.primary};
  --book-reader-border: ${e.theme.border};
  --book-reader-accent-surface: ${e.theme.accentSurface};
  --book-reader-content-width: ${e.preferences.contentWidth}px;
  --book-reader-page-width: ${n.pageWidthPx}px;
  --book-reader-max-line-length: ${n.maxLineLengthPx}px;
  --book-reader-illustration-width: ${n.illustrationWidthPx}px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
  background: var(--book-reader-surface) !important;
  color: var(--book-reader-text) !important;
  overscroll-behavior: none;
}

body {
  position: relative;
}

body > :where(img, video, canvas, picture, svg, figure, table, pre, blockquote) {
  max-inline-size: 100%;
}

body :where(img, video, canvas, picture, svg, image) {
  display: block;
  max-width: 100% !important;
  max-inline-size: 100% !important;
  height: auto !important;
  block-size: auto !important;
  object-fit: contain;
}

body :where(figure, img, video, canvas, svg) {
  margin-inline: auto;
}

body :where(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
}

body :where(td, th) {
  border-color: var(--book-reader-border);
}

body[data-section-kind="cover"],
body[data-section-kind="full-page-image"],
body[data-section-kind="illustration"] {
  width: 100% !important;
  max-width: none !important;
  min-width: 100% !important;
  inline-size: 100% !important;
  max-inline-size: none !important;
  margin: 0 !important;
}

:root:not(.${K}) body[data-section-kind="chapter"] {
  --RS__maxLineLength: var(--book-reader-max-line-length) !important;
  width: min(100%, calc(var(--book-reader-max-line-length) + (var(--RS__pageGutter) * 2))) !important;
  max-width: min(100%, calc(var(--book-reader-max-line-length) + (var(--RS__pageGutter) * 2)));
  margin-inline: auto !important;
  padding-inline: var(--RS__pageGutter) !important;
  padding-block: clamp(28px, 6vh, 88px);
}

:root:not(.${K}) body[data-section-kind="chapter"]
  > :where(.element, .element-bodymatter, .element-container-single, .element-container-double, article, main, section),
:root:not(.${K}) body[data-section-kind="chapter"] :where(.heading-container-single, .text) {
  width: 100% !important;
  max-width: 100% !important;
}

:root.${K} body[data-section-kind="cover"],
:root.${K} body[data-section-kind="full-page-image"],
:root.${K} body[data-section-kind="illustration"] {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: clamp(8px, 2vh, 22px) clamp(8px, 2vw, 22px);
}

:root.${K} body[data-section-kind="cover"] :where(img, svg, video, canvas),
:root.${K} body[data-section-kind="full-page-image"] :where(img, svg, video, canvas),
:root.${K} body[data-section-kind="illustration"] :where(img, svg, video, canvas),
:root.${K} body :where(.inline-image-flow-separate-page img, #cover .cover-image, [id^="full-page-image"] .image-element-image, .element-type-image .image-element-image) {
  width: clamp(360px, 92vw, var(--book-reader-illustration-width)) !important;
  max-width: min(100%, var(--book-reader-illustration-width)) !important;
  max-height: calc(100dvh - 20px) !important;
  max-block-size: calc(100dvh - 20px) !important;
}

body :where(#cover, [id^="full-page-image"], .element-type-image) {
  width: 100%;
  display: grid;
  place-items: center;
}

body :where([id^="full-page-image"] .image-element-block, .element-type-image .image-element-block) {
  width: 100% !important;
  max-width: 100% !important;
  padding-top: 0 !important;
  display: grid;
  place-items: center;
}

body :where([id^="full-page-image"] .image-element-size-container, .element-type-image .image-element-size-container) {
  width: min(100%, calc(100vw - 24px)) !important;
  max-width: 100% !important;
  display: grid !important;
  place-items: center;
}

body :where(.inline-image-flow-separate-page) {
  display: grid;
  place-items: center;
  margin-block: clamp(1.5rem, 5vh, 4rem) !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  text-align: center;
}

body :where(.inline-image-flow-separate-page .inline-image-container) {
  width: clamp(360px, 90vw, var(--book-reader-illustration-width)) !important;
  max-width: 100% !important;
  display: grid;
  place-items: center;
}

body :where(.inline-image-flow-center.inline-image-flow-within-text .inline-image-container) {
  width: min(100%, max(70%, calc(var(--book-reader-max-line-length) * 0.82))) !important;
  max-width: min(100%, var(--book-reader-illustration-width)) !important;
}

body :where(
  .inline-image-flow-center.inline-image-flow-within-text.inline-image-size-large .inline-image-container,
  .inline-image-flow-center.inline-image-flow-within-text.inline-image-size-full .inline-image-container,
  .inline-image-aspect-tall.inline-image-size-large .inline-image-container,
  .inline-image-aspect-tall.inline-image-size-full .inline-image-container
) {
  width: min(100%, max(88%, calc(var(--book-reader-max-line-length) * 1.02))) !important;
}

:root.${K} body :where(.inline-image-flow-separate-page) {
  break-before: column;
  break-after: column;
  break-inside: avoid;
}

body[data-has-heading-hero="true"] :where(.heading-container-single) {
  max-width: min(100%, var(--book-reader-content-width));
  margin-inline: auto !important;
}

body[data-has-heading-hero="true"] :where(.heading-size-full) {
  min-height: clamp(0px, 22vh, 10rem) !important;
}

body[data-has-heading-hero="true"] :where(.heading-size-full.heading-without-image .heading-contents) {
  padding-top: clamp(1.5rem, 7vh, 4rem) !important;
}

body[data-has-heading-hero="true"] :where(.heading-size-full.heading-with-image .heading-contents) {
  padding-top: clamp(1rem, 4vh, 2.25rem) !important;
}

body[data-has-heading-hero="true"] :where(.heading) {
  margin-bottom: clamp(1.5rem, 4vh, 2.5rem) !important;
}

a {
  color: var(--book-reader-primary);
}

blockquote {
  border-inline-start: 3px solid var(--book-reader-border);
  color: color-mix(in srgb, var(--book-reader-text) 76%, var(--book-reader-surface));
}

pre {
  border-radius: 16px;
  border: 1px solid var(--book-reader-border);
  background: var(--book-reader-accent-surface);
}

@media (max-width: 840px) {
  body :where(.inline-image-flow-left.inline-image-flow-within-text, .inline-image-flow-right.inline-image-flow-within-text) {
    float: none !important;
    width: 100% !important;
    margin-inline: 0 !important;
  }
}

/* ─── 用户排版自由度（task031 2.3 + 5.4） ───────────────────── */

/* 竖排：窄列内容宽度、单列分页与纵向行长约束 */
:root[style*="vertical-rl"] {
  --RS__maxLineLength: var(--user-content-width) !important;
  --RS__colWidth: var(--user-content-width) !important;
  --RS__colCount: 1 !important;
}

:root[style*="vertical-rl"] body {
  max-width: none !important;
  max-height: var(--user-content-width) !important;
}

/* 横排（覆盖竖排 profile 遗留的纵向行长约束） */
:root[style*="horizontal-tb"] body {
  max-height: none !important;
}

/* CJK profile 缺少 ReadiumCSS 的对齐覆盖，补齐相同语义规则 */
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-text-align"]:not([style*="vertical-rl"]) {
  text-align: var(--user-text-align);
}

:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-text-align"]:not([style*="vertical-rl"]) body,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-text-align"]:not([style*="vertical-rl"]) p,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-text-align"]:not([style*="vertical-rl"]) li {
  text-align: inherit !important;
  text-align-last: auto !important;
}

/* CJK profile 缺少 ReadiumCSS 的字距覆盖，补齐相同元素范围 */
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h1,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h2,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h3,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h4,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h5,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h6,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] p,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] li,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] div {
  letter-spacing: var(--user-letter-spacing);
}
`;
}
class ys {
  async injectStyles(n) {
    const t = this.resolveProfile(n), o = !this.hasPublisherStyles(n), [a, r, i] = await Promise.all([
      this.loadStyleText(t, "before"),
      o ? this.loadStyleText(t, "default") : Promise.resolve(""),
      this.loadStyleText(t, "after")
    ]);
    Cn(n, ss, cs, { prepend: !0 }), Cn(n, is, a, { prepend: !0 }), o ? Cn(n, Pt, r) : gs(n, Pt), Cn(n, rs, i);
  }
  applySettings(n, t, o) {
    this.applyWritingMode(n, t);
    const a = this.resolveDirectionality(n), r = n.documentElement, i = us(t, a, o);
    r.classList.toggle(ns, a.isVertical), r.classList.toggle(K, i.paged), r.classList.toggle(Tn, !!i.noFootnotes), r.classList.toggle(es, !!i.noRuby), r.classList.toggle(ts, !!i.reduceMotion), r.classList.toggle(
      os,
      !!i.noTemporaryNavTargetOutline
    ), this.applyReadiumCssVariables(r, i, a), this.applyLayoutVariables(r, n, o), this.applyThemeVariables(r, t), Cn(n, ls, fs(t, o));
  }
  resolveDirectionality(n) {
    const t = n.defaultView;
    if (!t)
      return {
        isVertical: !1,
        isRtl: It(n)
      };
    let o = It(n), a = !1;
    const r = t.getComputedStyle(n.documentElement);
    let i = r.getPropertyValue("direction");
    if (i.includes("rtl") && (o = !0), i = r.getPropertyValue("writing-mode") || r.getPropertyValue("-epub-writing-mode"), i.includes("vertical") && (a = !0), i.includes("-rl") && (o = !0), n.body) {
      const s = t.getComputedStyle(n.body);
      i = s.getPropertyValue("direction"), i.includes("rtl") && (o = !0), i = s.getPropertyValue("writing-mode") || s.getPropertyValue("-epub-writing-mode"), i.includes("vertical") && (a = !0), i.includes("-rl") && (o = !0);
    }
    return {
      isVertical: a,
      isRtl: o
    };
  }
  resolveProfile(n) {
    const t = this.resolveDirectionality(n);
    return t.isVertical && $n(n) ? "cjk-vertical" : $n(n) ? "cjk-horizontal" : t.isRtl ? "rtl" : "default";
  }
  applyWritingMode(n, t) {
    const o = n.documentElement;
    if (!$n(n)) {
      v(o, "writing-mode", void 0);
      return;
    }
    v(
      o,
      "writing-mode",
      t.preferences.writingMode === "vertical" ? "vertical-rl" : "horizontal-tb"
    );
  }
  /**
   * 取 profile 样式层文本：编译期内联（`src/readium/css-assets.ts` 的 `?raw` 导入），
   * 无运行时 `fetch`；返回前把样式内的字体相对路径重写为包内资产绝对 URL。
   */
  loadStyleText(n, t) {
    return Promise.resolve(this.rewriteFontUrls(Vr[n][t]));
  }
  rewriteFontUrls(n) {
    return Object.entries(Qr()).reduce((t, [o, a]) => t.split(o).join(a), n);
  }
  hasPublisherStyles(n) {
    const t = n.head;
    if (!t)
      return !1;
    for (const o of Array.from(t.children)) {
      const a = o.localName.toLowerCase();
      if (a === "style" || a === "link" && (o.getAttribute("rel")?.trim().toLowerCase() === "stylesheet" || o.getAttribute("type")?.trim().toLowerCase() === "text/css"))
        return !0;
    }
    return !!n.body?.getAttribute("style");
  }
  applyReadiumCssVariables(n, t, o) {
    v(n, "--USER__advancedSettings", "readium-advanced-on"), v(
      n,
      "--USER__view",
      t.paged ? "readium-paged-on" : "readium-scroll-on"
    ), v(n, "--USER__appearance", "readium-default-on"), v(
      n,
      "--USER__fontOverride",
      t.font && t.font !== "DEFAULT" ? "readium-font-on" : "readium-font-off"
    ), t.font === "SANS" ? v(n, "--USER__fontFamily", "var(--RS__sansTf)") : t.font === "OLD" ? v(n, "--USER__fontFamily", "var(--RS__oldStyleTf)") : t.font === "ROUND" ? v(n, "--USER__fontFamily", "var(--user-font-family-round)") : v(n, "--USER__fontFamily", void 0);
    const a = t.fontSize?.trim();
    if (a && a !== "100%") {
      v(n, "--USER__fontSize", a);
      const r = a.endsWith("%") ? Number.parseFloat(a) / 100 : Number.parseFloat(a);
      v(n, "--USER__fontXSizeX", Number.isFinite(r) ? String(r) : "1");
    } else
      v(n, "--USER__fontSize", void 0), v(n, "--USER__fontXSizeX", "1");
    v(n, "--USER__lineHeight", "var(--user-line-height)"), v(n, "--user-line-height", t.lineHeight), v(n, "--user-letter-spacing", t.letterSpacing), v(n, "--USER__letterSpacing", "var(--user-letter-spacing)"), v(n, "--user-text-align", t.textAlign), v(n, "--user-font-family-round", pa.round), v(n, "--USER__typeScale", t.typeScale), v(n, "--USER__paraSpacing", t.paraSpacing), v(n, "--USER__pageMargins", t.pageMargins), v(n, "--USER__backgroundColor", t.backgroundColor), v(n, "--USER__textColor", t.textColor), v(n, "--RS__selectionBackgroundColor", t.selectionBackgroundColor), v(n, "--RS__selectionTextColor", t.selectionTextColor), v(n, "--RS__linkColor", t.linkColor), v(n, "--RS__visitedColor", t.linkVisitedColor), o.isVertical ? (v(n, "--USER__colCount", "1"), v(n, "--USER__textAlign", void 0), v(n, "--USER__paraIndent", void 0)) : (v(n, "--USER__colCount", t.colCount), v(n, "--USER__textAlign", t.textAlign), v(n, "--USER__paraIndent", t.paraIndent)), o.isVertical || o.isRtl ? v(n, "--USER__bodyHyphens", void 0) : v(n, "--USER__bodyHyphens", t.bodyHyphens), ds(n.ownerDocument) ? v(n, "--USER__wordSpacing", t.wordSpacing) : v(n, "--USER__wordSpacing", void 0);
  }
  applyLayoutVariables(n, t, o) {
    v(n, "--RS__pageGutter", `${o.pageGutterPx}px`), v(n, "--RS__colGap", `${o.columnGapPx}px`), v(n, "--RS__colWidth", `${o.pageWidthPx}px`), v(n, "--RS__maxLineLength", `${o.maxLineLengthPx}px`), v(n, "--book-reader-page-width", `${o.pageWidthPx}px`), v(n, "--book-reader-max-line-length", `${o.maxLineLengthPx}px`), v(n, "--book-reader-illustration-width", `${o.illustrationWidthPx}px`), t.body && ps(
      t.body,
      "--RS__maxLineLength",
      `${o.maxLineLengthPx}px`
    );
  }
  applyThemeVariables(n, t) {
    v(n, "--book-reader-surface", t.theme.surface), v(n, "--book-reader-text", t.theme.text), v(n, "--book-reader-primary", t.theme.primary), v(n, "--book-reader-border", t.theme.border), v(n, "--book-reader-accent-surface", t.theme.accentSurface), v(n, "--book-reader-content-width", `${t.preferences.contentWidth}px`);
    const a = t.preferences.writingMode === "vertical" && $n(n.ownerDocument) ? Math.min(t.preferences.contentWidth, as) : t.preferences.contentWidth;
    v(n, "--user-content-width", `${a}px`);
  }
}
const Ss = 0.04, bs = 24;
class _s {
  // ─── 度量 ───────────────────────────────────────────────────
  /**
   * 对当前 iframe 文档做滚动模式度量。
   *
   * 滚动模式下：
   * - 横排文本（LTR/RTL）纵向滚动，度量主轴为 Y。
   * - 竖排文本纵向滚动变为横轴滚动，度量主轴为 X。
   */
  measure(n, t) {
    const o = on(n);
    if (t.isVertical) {
      const c = Math.abs(o.scrollLeft), d = o.clientWidth, u = o.scrollWidth, h = Math.max(0, u - d), S = h > 0 ? c / h : 0;
      return {
        scrollOffset: c,
        maxScrollOffset: h,
        viewportSize: d,
        contentSize: u,
        scrollFraction: Math.max(0, Math.min(1, S))
      };
    }
    const a = Math.max(0, o.scrollTop), r = o.clientHeight, i = o.scrollHeight, s = Math.max(0, i - r), l = s > 0 ? a / s : 0;
    return {
      scrollOffset: a,
      maxScrollOffset: s,
      viewportSize: r,
      contentSize: i,
      scrollFraction: Math.max(0, Math.min(1, l))
    };
  }
  // ─── 滚动进度 ─────────────────────────────────────────────
  /**
   * 计算滚动进度比例。
   *
   * @returns 0–1 之间的线性值。
   */
  computeScrollFraction(n, t) {
    return t <= 0 ? 0 : Math.max(0, Math.min(1, n / t));
  }
  // ─── 边界检测（精确版） ────────────────────────────────────
  /**
   * 检测滚动位置是否接近章节边界。
   *
   * 使用视口尺寸的 4%（不低于 24px）作为检测阈值，
   * 比旧实现的固定像素阈值更适应不同屏幕尺寸。
   *
   * @param thresholdPx — 可选的自定义阈值覆盖。
   */
  isNearBoundary(n, t, o) {
    const a = o ?? Math.max(
      bs,
      Math.round(n.viewportSize * Ss)
    );
    return t === "previous" ? n.scrollOffset <= a : n.scrollOffset >= Math.max(0, n.maxScrollOffset - a);
  }
  // ─── 是否精确处于边界 ─────────────────────────────────────
  /**
   * 检测滚动位置是否精确处于边界（容差 1px）。
   */
  isAtBoundary(n, t) {
    return t === "start" ? n.scrollOffset <= 1 : n.scrollOffset >= Math.max(0, n.maxScrollOffset - 1);
  }
  // ─── 滚动目标计算 ─────────────────────────────────────────
  /**
   * 计算施加 `delta` 后的滚动目标位置，同时检测是否到达边界。
   *
   * @returns `target` — clamp 后的安全偏移值；
   *          `reachedBoundary` — 如果到达边界则返回 `"start"` 或 `"end"`，否则 `null`。
   */
  computeScrollTarget(n, t, o) {
    const a = Math.max(0, Math.min(n + t, o));
    let r = null;
    return a <= 0 && t < 0 ? r = "start" : a >= o && t > 0 && (r = "end"), { target: a, reachedBoundary: r };
  }
  // ─── 滚动到边界 ──────────────────────────────────────────
  /**
   * 计算跳转到章节首（start）或尾（end）的滚动偏移。
   */
  computeBoundaryOffset(n, t) {
    return n === "start" ? 0 : t;
  }
  // ─── 从 fragment 计算滚动位置 ─────────────────────────────
  /**
   * 根据 fragment 目标元素的布局位置计算其在滚动轴上的偏移。
   */
  resolveFragmentOffset(n, t) {
    const o = n.ownerDocument, a = on(o), r = n.getBoundingClientRect();
    if (t.isVertical) {
      const s = Math.abs(a.scrollLeft);
      return Math.max(0, r.left + s);
    }
    const i = a.scrollTop;
    return Math.max(0, r.top + i);
  }
}
const vs = `.book-reader-chrome {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 240ms ease, transform 240ms ease;
}

.book-reader-chrome[data-state="visible"] {
  opacity: 1;
  transform: translateY(0);
}

.book-reader-panelLayer {
  opacity: 0;
  transition: opacity 220ms ease;
}

.book-reader-panelLayer[data-state="open"] {
  opacity: 1;
}

.book-reader-panel--drawer {
  transform: translateX(100%);
  transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
}

.book-reader-panelLayer[data-state="open"] .book-reader-panel--drawer {
  transform: translateX(0);
}

.book-reader-panel--dialog {
  transform: translateY(16px) scale(0.98);
  opacity: 0;
  transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease;
}

.book-reader-panelLayer[data-state="open"] .book-reader-panel--dialog {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.book-reader-progress__fill,
.book-reader-progress__input::-webkit-slider-thumb,
.book-reader-progress__input::-moz-range-thumb {
  transition: width 160ms ease, transform 120ms ease;
}

.book-reader-chrome__dock {
  animation: book-reader-dock-enter 360ms cubic-bezier(0.32, 0.72, 0, 1);
}

.book-reader-feedback {
  animation: book-reader-feedback-enter 320ms cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes book-reader-dock-enter {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes book-reader-feedback-enter {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* ─── 翻页方向光晕（帧内渲染，engine 注入） ───────────────────── */

.book-reader-glow {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  opacity: 1;
  animation: book-reader-glow-fade 180ms ease-out forwards;
}

.book-reader-glow--left,
.book-reader-glow--right {
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    color-mix(in srgb, var(--book-reader-primary, #0a84ff) 32%, transparent) 22%,
    color-mix(in srgb, var(--book-reader-primary, #0a84ff) 68%, transparent) 50%,
    color-mix(in srgb, var(--book-reader-primary, #0a84ff) 32%, transparent) 78%,
    transparent 100%
  );
  box-shadow: 0 0 18px color-mix(in srgb, var(--book-reader-primary, #0a84ff) 40%, transparent);
}

.book-reader-glow--left {
  left: 0;
}

.book-reader-glow--right {
  right: 0;
}

.book-reader-glow--top,
.book-reader-glow--bottom {
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--book-reader-primary, #0a84ff) 32%, transparent) 22%,
    color-mix(in srgb, var(--book-reader-primary, #0a84ff) 68%, transparent) 50%,
    color-mix(in srgb, var(--book-reader-primary, #0a84ff) 32%, transparent) 78%,
    transparent 100%
  );
  box-shadow: 0 0 18px color-mix(in srgb, var(--book-reader-primary, #0a84ff) 40%, transparent);
}

.book-reader-glow--top {
  top: 0;
}

.book-reader-glow--bottom {
  bottom: 0;
}

@keyframes book-reader-glow-fade {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* ─── 点击翻页涟漪（帧内渲染，engine 注入） ───────────────────── */

.book-reader-ripple {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0.25);
  opacity: 0.5;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--book-reader-primary, #0a84ff) 55%, transparent) 0%,
    color-mix(in srgb, var(--book-reader-primary, #0a84ff) 14%, transparent) 55%,
    transparent 72%
  );
  animation: book-reader-ripple-spread 120ms ease-out forwards;
}

@keyframes book-reader-ripple-spread {
  to {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0;
  }
}

/* ─── 章节切换首屏淡入（帧内渲染，engine 注入） ────────────────── */

.book-reader-sectionEnter {
  animation: book-reader-section-enter 200ms ease-out;
}

@keyframes book-reader-section-enter {
  from {
    opacity: 0.92;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ─── 滑入翻页动画（帧内渲染，engine 注入） ────────────────────── */

.book-reader-sliding {
  will-change: transform, opacity;
}

/* 边界回弹由引擎以 AnimationController 缓动驱动，见 animation-controller.ts */

/* ─── Chrome 显示/隐藏过渡（宿主包装层，ReaderShell 驱动 data-state） ── */

.book-reader-chromeHost {
  opacity: 1;
  visibility: visible;
  transition: opacity 240ms ease, visibility 240ms ease;
}

.book-reader-chromeHost[data-state="hidden"] {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

/* ─── 章节切换横幅（宿主渲染，ReaderShell 驱动） ───────────────── */

.book-reader-sectionBanner {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 16;
  max-width: min(80vw, 520px);
  padding: 12px 28px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, #ffffff 16%, transparent);
  background: color-mix(in srgb, #1f1d19 72%, transparent);
  box-shadow: 0 20px 56px color-mix(in srgb, #1f1d19 20%, transparent);
  backdrop-filter: blur(16px);
  color: #f5f2ea;
  font-size: 15px;
  line-height: 1.5;
  letter-spacing: 0.05em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  animation: book-reader-section-banner 1400ms ease both;
}

@keyframes book-reader-section-banner {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) translateY(8px) scale(0.96);
  }
  14% {
    opacity: 1;
    transform: translate(-50%, -50%) translateY(0) scale(1);
  }
  78% {
    opacity: 1;
    transform: translate(-50%, -50%) translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) translateY(-6px) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .book-reader-chrome,
  .book-reader-panelLayer,
  .book-reader-panel--drawer,
  .book-reader-panel--dialog,
  .book-reader-progress__fill,
  .book-reader-progress__input::-webkit-slider-thumb,
  .book-reader-progress__input::-moz-range-thumb,
  .book-reader-glow,
  .book-reader-ripple,
  .book-reader-sectionEnter,
  .book-reader-chromeHost,
  .book-reader-sectionBanner {
    transition: none !important;
    animation: none !important;
  }
}
`, ws = 0.04, Rs = 24, ks = 2, Ee = "chips-book-reader:page-ripple", Lt = "book-reader-frame-animation", xs = 120, Cs = 2, Es = 300, Ms = 300;
function Ts(e, n) {
  return e.isVertical ? n === "next" ? "bottom" : "top" : e.isRtl ? n === "next" ? "left" : "right" : n === "next" ? "right" : "left";
}
function Fs(e, n) {
  return e.isVertical ? n === "next" ? -1 : 1 : n === "next" ? e.isRtl ? 1 : -1 : e.isRtl ? -1 : 1;
}
function Yn(e, n, t) {
  return Math.min(t, Math.max(n, e));
}
function po(e, n) {
  return typeof e.requestAnimationFrame == "function" ? e.requestAnimationFrame(n) : e.setTimeout(n, 16);
}
function zs(e, n) {
  if (typeof e.cancelAnimationFrame == "function") {
    e.cancelAnimationFrame(n);
    return;
  }
  e.clearTimeout(n);
}
function As(e) {
  return new Promise((n) => {
    po(e, () => n());
  });
}
async function pe(e, n = 2) {
  const t = e.defaultView;
  if (t)
    for (let o = 0; o < n; o += 1)
      await As(t);
}
function Ns(e) {
  return e === "illustration" || e === "full-page-image" || e === "cover" ? e : "chapter";
}
function Us(e, n) {
  const t = typeof CSS < "u" && typeof CSS.escape == "function" ? CSS.escape(n) : n.replace(/["\\]/g, "\\$&");
  return e.getElementById(n) ?? e.querySelector(`[id="${t}"]`) ?? e.querySelector(`[name="${t}"]`);
}
class Ps {
  constructor(n, t) {
    this.document = n, this.options = t;
  }
  document;
  options;
  cssManager = new ys();
  paginationEngine = new Ur();
  scrollEngine = new _s();
  positionTracker = new Ir();
  animationController = new Mr();
  handlers = /* @__PURE__ */ new Map();
  resizeObserver = null;
  resizeRafHandle = null;
  scrollCleanup = null;
  rippleCleanup = null;
  feedbackTimers = /* @__PURE__ */ new Set();
  lastSpreadIndex = 0;
  handlePageRipple = (n) => {
    if (this.prefersReducedMotion())
      return;
    const t = n.detail;
    if (!t)
      return;
    const o = this.document.defaultView, a = Math.max(
      1,
      this.document.documentElement.clientWidth || o?.innerWidth || 1
    ), r = Math.max(
      1,
      this.document.documentElement.clientHeight || o?.innerHeight || 1
    );
    this.createFrameFeedbackElement("book-reader-ripple", {
      left: Yn(t.x, 0, a),
      top: Yn(t.y, 0, r)
    });
  };
  async mount() {
    this.attachPageRippleListener(), await this.cssManager.injectStyles(this.document), await this.ensureFrameAnimationStyles(), this.applyPresentation(), this.positionTracker.initialize(this.getReadingMode(), this.document, this.getDirectionality()), this.attachScrollListener(), this.attachResizeObserver(), await pe(this.document, 2), this.alignToViewport("auto"), this.playSectionEntrance(), this.emitLayoutChanged(), this.emitProgressUpdated();
  }
  destroy() {
    this.resizeObserver?.disconnect(), this.resizeObserver = null, this.scrollCleanup?.(), this.scrollCleanup = null, this.detachPageRippleListener(), this.animationController.destroy();
    const n = this.document.defaultView;
    for (const t of this.feedbackTimers)
      n?.clearTimeout(t);
    this.feedbackTimers.clear(), this.resizeRafHandle !== null && this.document.defaultView && (zs(this.document.defaultView, this.resizeRafHandle), this.resizeRafHandle = null);
  }
  async update(n) {
    const t = this.positionTracker.captureAnchor(
      this.document,
      this.getReadingMode(),
      this.getDirectionality()
    );
    this.options = n, await this.cssManager.injectStyles(this.document), this.applyPresentation(), await pe(this.document, 1), this.restoreAnchor(t, "auto"), this.emitLayoutChanged(), this.emitProgressUpdated();
  }
  turnPage(n) {
    const t = this.getReadingMode();
    if (t === "paginated") {
      const i = this.getPaginationMetrics(), s = this.readOffset(), l = this.paginationEngine.resolveSpreadIndex(
        s,
        i.spreadAdvancePx
      ), c = this.paginationEngine.computeTargetOffset(
        l,
        n,
        i
      );
      if (c.targetIndex === l || Math.abs(c.targetOffset - s) <= ks) {
        const d = n === "previous" ? "start" : "end";
        return this.emitBoundary(d, n), this.isBookBoundary(d) && this.playBoundaryBounce(n), { moved: !1, reachedBoundary: !0, boundary: d };
      }
      return this.positionTracker.update(c.targetIndex, i, t), this.lastSpreadIndex = c.targetIndex, this.canUseSlideAnimation() ? this.animatePageSlide(c.targetOffset, i.spreadWidthPx, n) : this.writeOffset(c.targetOffset, "smooth"), this.emitPageChanged(n, c.targetIndex, i.spreadCount), this.playPageGlow(n), this.emitProgressUpdated(), { moved: !0, reachedBoundary: !1 };
    }
    const o = this.getScrollMetrics(), a = o.viewportSize * (n === "next" ? 1 : -1), r = this.scrollEngine.computeScrollTarget(
      o.scrollOffset,
      a,
      o.maxScrollOffset
    );
    if (Math.abs(r.target - o.scrollOffset) <= 1) {
      const i = r.reachedBoundary ?? (n === "previous" ? "start" : "end");
      return this.emitBoundary(i, n), this.isBookBoundary(i) && this.playBoundaryBounce(n), { moved: !1, reachedBoundary: !0, boundary: i };
    }
    return this.writeOffset(r.target, "smooth"), this.positionTracker.update(
      0,
      {
        ...o,
        scrollOffset: r.target,
        scrollFraction: this.scrollEngine.computeScrollFraction(
          r.target,
          o.maxScrollOffset
        )
      },
      t
    ), this.emitScrollChanged(
      this.scrollEngine.computeScrollFraction(r.target, o.maxScrollOffset)
    ), this.playPageGlow(n), this.emitProgressUpdated(), {
      moved: !0,
      reachedBoundary: r.reachedBoundary !== null,
      boundary: r.reachedBoundary ?? void 0
    };
  }
  scrollBy(n) {
    if (this.getReadingMode() !== "scroll")
      return this.turnPage(n >= 0 ? "next" : "previous");
    const t = this.getScrollMetrics(), o = this.scrollEngine.computeScrollTarget(
      t.scrollOffset,
      n,
      t.maxScrollOffset
    );
    if (Math.abs(o.target - t.scrollOffset) <= 1) {
      const a = o.reachedBoundary ?? (n < 0 ? "start" : "end");
      return this.emitBoundary(a, n < 0 ? "previous" : "next"), { moved: !1, reachedBoundary: !0, boundary: a };
    }
    return this.writeOffset(o.target, "auto"), this.positionTracker.update(
      0,
      {
        ...t,
        scrollOffset: o.target,
        scrollFraction: this.scrollEngine.computeScrollFraction(
          o.target,
          t.maxScrollOffset
        )
      },
      "scroll"
    ), this.emitScrollChanged(
      this.scrollEngine.computeScrollFraction(o.target, t.maxScrollOffset)
    ), this.emitProgressUpdated(), {
      moved: !0,
      reachedBoundary: o.reachedBoundary !== null,
      boundary: o.reachedBoundary ?? void 0
    };
  }
  goToSpread(n, t = "auto") {
    const o = this.getPaginationMetrics(), a = this.paginationEngine.computeOffsetForSpread(
      n,
      o.spreadAdvancePx,
      o.maxScrollOffset
    );
    this.writeOffset(a, t);
    const r = this.paginationEngine.resolveSpreadIndex(
      a,
      o.spreadAdvancePx
    );
    this.positionTracker.update(r, o, "paginated"), this.lastSpreadIndex = r, this.emitProgressUpdated();
  }
  goToBoundary(n, t = "smooth") {
    const a = this.getReadingMode() === "paginated" ? this.paginationEngine.computeOffsetForBoundary(n, this.getPaginationMetrics()) : this.scrollEngine.computeBoundaryOffset(
      n,
      this.getScrollMetrics().maxScrollOffset
    );
    this.writeOffset(a, t), this.syncTrackerFromDocument(), this.emitProgressUpdated();
  }
  goToFragment(n) {
    if (!n)
      return this.goToBoundary("start", "auto"), Promise.resolve();
    const t = Us(this.document, n);
    if (!t)
      return this.goToBoundary("start", "auto"), Promise.resolve();
    if (this.getReadingMode() === "paginated") {
      const a = this.getPaginationMetrics(), r = this.paginationEngine.resolveFragmentSpread(
        t,
        a.spreadAdvancePx
      );
      return this.goToSpread(r, "auto"), Promise.resolve();
    }
    const o = this.scrollEngine.resolveFragmentOffset(t, this.getDirectionality());
    return this.writeOffset(o, "auto"), this.syncTrackerFromDocument(), this.emitProgressUpdated(), Promise.resolve();
  }
  goToProgress(n, t = "auto") {
    const o = Yn(n, 0, 1);
    if (this.getReadingMode() === "paginated") {
      const i = this.getPaginationMetrics(), s = i.spreadCount > 1 ? Math.round(o * (i.spreadCount - 1)) : 0;
      this.goToSpread(s, t);
      return;
    }
    const a = this.getScrollMetrics(), r = Math.round(o * a.maxScrollOffset);
    this.writeOffset(r, t), this.syncTrackerFromDocument(), this.emitProgressUpdated();
  }
  isAtBoundary(n) {
    if (this.getReadingMode() === "paginated")
      return this.paginationEngine.isAtBoundary(
        this.readOffset(),
        this.getPaginationMetrics(),
        n
      );
    const t = this.getScrollMetrics();
    return this.scrollEngine.isAtBoundary(t, n === "previous" ? "start" : "end");
  }
  isNearBoundary(n) {
    if (this.getReadingMode() === "scroll")
      return this.scrollEngine.isNearBoundary(this.getScrollMetrics(), n);
    const t = this.getPaginationMetrics(), o = Math.max(
      Rs,
      Math.round(t.spreadWidthPx * ws)
    ), a = this.readOffset();
    return n === "previous" ? a <= o : a >= Math.max(0, t.maxScrollOffset - o);
  }
  getProgress() {
    const n = this.options.section;
    return this.positionTracker.computeProgress(
      n?.index ?? 0,
      n?.count ?? 1,
      n?.title ?? "",
      n?.weights
    );
  }
  getReadingMode() {
    return this.options.preferences.readingMode;
  }
  getCurrentAnchor() {
    return this.positionTracker.getCurrentAnchor();
  }
  on(n, t) {
    const o = this.handlers.get(n) ?? /* @__PURE__ */ new Set();
    return o.add(t), this.handlers.set(n, o), () => {
      o.delete(t), o.size === 0 && this.handlers.delete(n);
    };
  }
  getDirectionality() {
    return this.cssManager.resolveDirectionality(this.document);
  }
  getLayout() {
    return zr({
      viewportWidth: this.document.documentElement.clientWidth || this.document.defaultView?.innerWidth || 0,
      viewportHeight: this.document.documentElement.clientHeight || this.document.defaultView?.innerHeight || 0,
      preferredContentWidth: this.options.preferences.contentWidth,
      readingMode: this.options.preferences.readingMode,
      sectionKind: Ns(this.document.body?.dataset.sectionKind),
      fontScale: this.options.preferences.fontScale
    });
  }
  applyPresentation() {
    this.cssManager.applySettings(this.document, this.options, this.getLayout());
  }
  // ─── 翻页视觉反馈（光晕 / 涟漪 / 回弹 / 章节淡入 / 滑入动画） ──────
  attachPageRippleListener() {
    this.detachPageRippleListener(), this.document.addEventListener(Ee, this.handlePageRipple), this.rippleCleanup = () => {
      this.document.removeEventListener(Ee, this.handlePageRipple);
    };
  }
  detachPageRippleListener() {
    this.rippleCleanup?.(), this.rippleCleanup = null;
  }
  /**
   * 将翻页动画样式注入帧内文档（与宿主共用 `reader-animation.css` 单一来源）。
   *
   * 样式文本经 `?raw` 编译期内联，注入为同步操作，不阻断阅读流程。
   */
  ensureFrameAnimationStyles() {
    const n = this.document.head;
    if (!n)
      return Promise.resolve();
    const t = this.document.getElementById(Lt);
    if (go(t))
      return Promise.resolve();
    const o = this.document.createElement("style");
    return o.id = Lt, o.type = "text/css", o.textContent = vs, n.appendChild(o), Promise.resolve();
  }
  /** 新章节首屏 200ms 淡入 + 4px 上移复原（换 iframe 时消除硬切感）。 */
  playSectionEntrance() {
    const n = this.document.body, t = this.document.defaultView;
    if (!n || !t)
      return;
    n.classList.add("book-reader-sectionEnter");
    let o = !1;
    const a = () => {
      o || (o = !0, t.clearTimeout(i), this.feedbackTimers.delete(i), n.classList.remove("book-reader-sectionEnter"));
    }, r = (s) => {
      s.animationName === "book-reader-section-enter" && a();
    }, i = t.setTimeout(a, Es);
    this.feedbackTimers.add(i), n.addEventListener("animationend", r, { once: !0 });
  }
  /** 翻页方向光晕：对应边缘 4px 高亮弧线 180ms 淡出，并派发光晕触发事件。 */
  playPageGlow(n) {
    if (this.prefersReducedMotion())
      return;
    const t = Ts(this.getDirectionality(), n);
    this.createFrameFeedbackElement(`book-reader-glow book-reader-glow--${t}`), this.emitPageGlow(n);
  }
  /** 全书开头 / 结尾边界回弹：沿翻页方向 2px overshoot 后 120ms 弹回。 */
  playBoundaryBounce(n) {
    const t = this.document.body;
    if (this.prefersReducedMotion() || !t)
      return;
    t.classList.remove("book-reader-sectionEnter");
    const o = this.getDirectionality(), a = Fs(o, n);
    this.animationController.animateTransform({
      element: t,
      axis: o.isVertical ? "y" : "x",
      from: Cs * a,
      to: 0,
      duration: xs,
      easing: Ce.easeOutBack
    });
  }
  /** 是否为全书级边界（章节索引位于全书首尾）。 */
  isBookBoundary(n) {
    const t = this.options.section;
    return t ? n === "start" ? t.index === 0 : t.index >= t.count - 1 : !1;
  }
  /** 滑入翻页动画的落位协调：当前内容位移 + 淡出后，落位 scroll 并归位 transform。 */
  animatePageSlide(n, t, o) {
    const a = this.document.body;
    if (!a) {
      this.writeOffset(n, "smooth");
      return;
    }
    a.classList.remove("book-reader-sectionEnter"), a.classList.add("book-reader-sliding"), this.animationController.animateSlide({
      element: a,
      scrollElement: on(this.document),
      toOffset: n,
      viewportSize: t,
      direction: o,
      onComplete: () => {
        a.classList.remove("book-reader-sliding");
      },
      onCancel: () => {
        a.classList.remove("book-reader-sliding");
      }
    });
  }
  /** 是否启用 L2 滑入翻页（分页模式，排除竖排 / RTL / 减弱动效偏好）。 */
  canUseSlideAnimation() {
    if (this.getReadingMode() !== "paginated" || !this.document.body)
      return !1;
    const n = this.getDirectionality();
    return n.isVertical || n.isRtl ? !1 : !this.prefersReducedMotion();
  }
  prefersReducedMotion() {
    const n = this.document.defaultView;
    return !!(n && typeof n.matchMedia == "function" && n.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  /** 在帧内渲染一次性反馈元素（固定定位，挂在根元素下避免受内容层 transform 影响）。 */
  createFrameFeedbackElement(n, t) {
    const o = this.document.defaultView, a = this.document.documentElement;
    if (!o || !a)
      return;
    const r = this.document.createElement("div");
    r.className = n, t && (r.style.left = `${Math.round(t.left)}px`, r.style.top = `${Math.round(t.top)}px`), a.appendChild(r);
    let i = !1;
    const s = () => {
      i || (i = !0, o.clearTimeout(l), this.feedbackTimers.delete(l), r.remove());
    }, l = o.setTimeout(s, Ms);
    this.feedbackTimers.add(l), r.addEventListener("animationend", s, { once: !0 });
  }
  attachResizeObserver() {
    const n = this.document.defaultView;
    !n || typeof n.ResizeObserver != "function" || this.resizeObserver || (this.resizeObserver = new n.ResizeObserver(() => {
      if (this.resizeRafHandle !== null)
        return;
      const t = this.positionTracker.captureAnchor(
        this.document,
        this.getReadingMode(),
        this.getDirectionality()
      );
      this.resizeRafHandle = po(n, () => {
        (async () => (this.resizeRafHandle = null, this.applyPresentation(), await pe(this.document, 1), this.restoreAnchor(t, "auto"), this.emitLayoutChanged(), this.emitProgressUpdated()))();
      });
    }), this.resizeObserver.observe(this.document.documentElement));
  }
  attachScrollListener() {
    const n = on(this.document), t = () => {
      this.syncTrackerFromDocument(), this.emitProgressUpdated();
    };
    n.addEventListener("scroll", t, { passive: !0 }), this.scrollCleanup = () => {
      n.removeEventListener("scroll", t);
    };
  }
  getPaginationMetrics() {
    const n = this.paginationEngine.measure(this.document, this.getDirectionality());
    return n.currentSpreadIndex = this.paginationEngine.resolveSpreadIndex(
      this.readOffset(),
      n.spreadAdvancePx
    ), n;
  }
  getScrollMetrics() {
    return this.scrollEngine.measure(this.document, this.getDirectionality());
  }
  readOffset() {
    const n = on(this.document), t = this.getDirectionality();
    return this.getReadingMode() === "paginated" ? t.isVertical ? Math.max(0, n.scrollTop) : Math.max(0, Math.abs(n.scrollLeft)) : t.isVertical ? Math.max(0, Math.abs(n.scrollLeft)) : Math.max(0, n.scrollTop);
  }
  writeOffset(n, t) {
    const o = on(this.document), a = this.getDirectionality(), r = this.getReadingMode(), i = Math.max(0, n);
    if (r === "paginated" && t === "smooth") {
      const s = a.isVertical ? "y" : "x";
      this.animationController.animateScroll({
        element: o,
        from: this.readOffset(),
        to: i,
        axis: s,
        isRtl: a.isRtl
      });
      return;
    }
    if (this.animationController.cancel(), r === "paginated") {
      if (a.isVertical) {
        o.scrollTo({ top: i, behavior: t });
        return;
      }
      o.scrollTo({
        left: a.isRtl ? -i : i,
        behavior: t
      });
      return;
    }
    if (a.isVertical) {
      o.scrollTo({
        left: a.isRtl ? -i : i,
        behavior: t
      });
      return;
    }
    o.scrollTo({ top: i, behavior: t });
  }
  restoreAnchor(n, t) {
    const o = this.positionTracker.restoreAnchor(
      n,
      this.document,
      this.getReadingMode(),
      this.getDirectionality()
    );
    this.writeOffset(o, t), this.syncTrackerFromDocument();
  }
  alignToViewport(n) {
    if (this.getReadingMode() !== "paginated")
      return;
    const t = this.getPaginationMetrics(), o = Yn(
      this.paginationEngine.snapToSpread(this.readOffset(), t.spreadAdvancePx),
      0,
      t.maxScrollOffset
    );
    this.writeOffset(o, n), this.syncTrackerFromDocument();
  }
  syncTrackerFromDocument() {
    if (this.getReadingMode() === "paginated") {
      const t = this.getPaginationMetrics(), o = this.paginationEngine.resolveSpreadIndex(
        this.readOffset(),
        t.spreadAdvancePx
      );
      if (this.positionTracker.update(o, t, "paginated"), o !== this.lastSpreadIndex) {
        const a = o > this.lastSpreadIndex ? "next" : "previous";
        this.lastSpreadIndex = o, this.emitPageChanged(a, o, t.spreadCount);
      }
      return;
    }
    const n = this.getScrollMetrics();
    this.positionTracker.update(0, n, "scroll"), this.emitScrollChanged(n.scrollFraction);
  }
  emit(n, t) {
    const o = this.handlers.get(n);
    if (!(!o || o.size === 0))
      for (const a of o)
        a(t);
  }
  emitPageChanged(n, t, o) {
    this.emit("page-changed", {
      type: "page-changed",
      timestamp: performance.now(),
      direction: n,
      spreadIndex: t,
      totalSpreads: o
    });
  }
  emitScrollChanged(n) {
    this.emit("scroll-changed", {
      type: "scroll-changed",
      timestamp: performance.now(),
      scrollFraction: n
    });
  }
  emitLayoutChanged() {
    this.emit("layout-changed", {
      type: "layout-changed",
      timestamp: performance.now()
    });
  }
  emitBoundary(n, t) {
    this.emit("boundary-reached", {
      type: "boundary-reached",
      timestamp: performance.now(),
      boundary: n,
      direction: t
    });
  }
  emitPageGlow(n) {
    this.emit("page-glow", {
      type: "page-glow",
      timestamp: performance.now(),
      direction: n
    });
  }
  emitProgressUpdated() {
    this.emit("progress-updated", {
      type: "progress-updated",
      timestamp: performance.now(),
      progress: this.getProgress()
    });
  }
}
function Ht(e, n, t) {
  return {
    preferences: e,
    theme: n,
    section: t
  };
}
function Is(e) {
  const {
    iframeRef: n,
    renderedSection: t,
    preferences: o,
    themePalette: a,
    currentFragment: r,
    pendingBoundary: i,
    section: s,
    onInitialLocationSettled: l
  } = e, c = X(null), [d, u] = G(null), [h, S] = G(null), [_, R] = G(!1);
  return W(() => {
    const p = n.current;
    if (!p || !t) {
      S(null), c.current?.destroy(), c.current = null, u(null);
      return;
    }
    let f = !1;
    const E = () => {
      c.current?.destroy(), c.current = null, u(null), S(null);
    }, j = () => {
      const F = p.contentDocument;
      if (!F) {
        R(!1);
        return;
      }
      E();
      const z = new Ps(
        F,
        Ht(o, a, s)
      );
      c.current = z, u(z), S(F), (async () => {
        try {
          if (await z.mount(), f)
            return;
          r ? await z.goToFragment(r) : i ? z.goToBoundary(i, "auto") : z.goToBoundary("start", "auto"), l?.();
        } finally {
          f || R(!1);
        }
      })();
    };
    return p.addEventListener("load", j), R(!0), E(), p.srcdoc = t.html, () => {
      f = !0, p.removeEventListener("load", j), E();
    };
  }, [n, t?.html, t?.sectionPath]), W(() => {
    const p = c.current;
    !p || !t || p.update(Ht(o, a, s));
  }, [
    o,
    a,
    s.index,
    s.count,
    s.title,
    t?.sectionPath
  ]), W(() => {
    const p = c.current;
    !p || !t || p.goToFragment(r);
  }, [r, t?.sectionPath]), {
    controller: d,
    frameDocument: h,
    isFrameLoading: _,
    navigatePage: (p) => c.current?.turnPage(p) ?? null,
    navigateToBoundary: (p) => {
      c.current?.goToBoundary(p, "smooth");
    },
    seekToFraction: (p) => {
      c.current?.goToProgress(p, "auto");
    }
  };
}
function Ls(e) {
  const { controller: n } = e, [t, o] = G(null);
  return W(() => {
    if (!n) {
      o(null);
      return;
    }
    let a = null, r = n.getProgress();
    o(r);
    const i = n.on("progress-updated", (s) => {
      s.type === "progress-updated" && (r = s.progress, a === null && (a = window.setTimeout(() => {
        a = null, o(r);
      }, 200)));
    });
    return () => {
      i(), a !== null && window.clearTimeout(a);
    };
  }, [n]), {
    progress: t
  };
}
function Me() {
  return typeof window < "u" && typeof window.matchMedia == "function";
}
function Hs() {
  return Me() ? window.matchMedia("(prefers-color-scheme: dark)").matches : !1;
}
function Ds() {
  const [e, n] = G(Hs), [t, o] = G(
    Me
  );
  return W(() => {
    if (!Me()) {
      o(!1);
      return;
    }
    const a = window.matchMedia("(prefers-color-scheme: dark)");
    o(!0), n(a.matches);
    const r = (i) => {
      n(i.matches);
    };
    return a.addEventListener("change", r), () => {
      a.removeEventListener("change", r);
    };
  }, []), {
    isDark: e,
    isFollowingSystem: t
  };
}
function Os(e) {
  return !!e?.closest("a[href], button, input, textarea, select, label, summary, audio, video");
}
class Bs {
  constructor(n, t) {
    this.callbacks = n, this.runtime = t;
  }
  callbacks;
  runtime;
  attach(n) {
    const t = (o) => {
      const a = Ar(o.target), r = a?.closest("a[href]");
      if (r) {
        const u = r.getAttribute("data-epub-target"), h = r.getAttribute("href")?.trim() ?? "";
        if (u) {
          o.preventDefault();
          const S = u.indexOf("#"), _ = S >= 0 ? u.slice(0, S) : u, R = S >= 0 ? u.slice(S + 1) : "";
          this.callbacks.onEpubLink(_, R || void 0);
          return;
        }
        (h.startsWith("http:") || h.startsWith("https:") || h.startsWith("mailto:") || h.startsWith("tel:")) && (o.preventDefault(), this.callbacks.onOpenLink(h, !0));
        return;
      }
      if (Os(a) || !!n.getSelection?.()?.toString().trim())
        return;
      const s = n.documentElement.clientWidth || n.defaultView?.innerWidth || 1, l = n.documentElement.clientHeight || n.defaultView?.innerHeight || 1, c = o.clientX / s, d = o.clientY / l;
      if (!(d < 0.08 || d > 0.92)) {
        if (c <= 0.26) {
          this.dispatchPageRipple(n, "previous", o.clientX, o.clientY), this.callbacks.onNavigate("previous");
          return;
        }
        if (c >= 0.74) {
          this.dispatchPageRipple(n, "next", o.clientX, o.clientY), this.callbacks.onNavigate("next");
          return;
        }
        if (this.runtime.hasActivePanel()) {
          this.callbacks.onClosePanel();
          return;
        }
        this.callbacks.onToggleChrome();
      }
    };
    return n.addEventListener("click", t), () => {
      n.removeEventListener("click", t);
    };
  }
  dispatchPageRipple(n, t, o, a) {
    const r = { direction: t, x: o, y: a };
    n.dispatchEvent(new CustomEvent(Ee, { detail: r }));
  }
}
function Gs(e) {
  const n = e?.tagName?.toLowerCase(), t = typeof e?.hasAttribute == "function" && e.hasAttribute("contenteditable");
  return n === "input" || n === "textarea" || n === "select" || t;
}
class Ws {
  constructor(n) {
    this.callbacks = n;
  }
  callbacks;
  attach(n) {
    const t = (o) => {
      const a = o, r = this.resolveIntent(a);
      if (r.type === "none")
        return;
      a.preventDefault();
      const i = this.resolveCommandId(r);
      if (i && this.callbacks.onInvokeCommand) {
        this.callbacks.onInvokeCommand(i);
        return;
      }
      switch (r.type) {
        case "navigate":
          this.callbacks.onNavigate(r.direction);
          return;
        case "navigate-boundary":
          this.callbacks.onNavigateBoundary(r.boundary);
          return;
        case "toggle-chrome":
          this.callbacks.onToggleChrome();
          return;
        case "close-panel":
          this.callbacks.onClosePanel();
          return;
        case "adjust-font":
          this.callbacks.onAdjustFont(r.delta);
          return;
        case "adjust-width":
          this.callbacks.onAdjustWidth(r.delta);
          return;
        default:
          return;
      }
    };
    return n.addEventListener("keydown", t), () => {
      n.removeEventListener("keydown", t);
    };
  }
  resolveIntent(n) {
    if (Gs(n.target))
      return { type: "none" };
    if (n.metaKey || n.ctrlKey || n.altKey)
      return { type: "none" };
    switch (n.key) {
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
        return { type: "navigate", direction: "previous" };
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
        return { type: "navigate", direction: "next" };
      case " ":
        return { type: "navigate", direction: n.shiftKey ? "previous" : "next" };
      case "Home":
        return { type: "navigate-boundary", boundary: "start" };
      case "End":
        return { type: "navigate-boundary", boundary: "end" };
      case "[":
        return { type: "adjust-font", delta: -0.1 };
      case "]":
        return { type: "adjust-font", delta: 0.1 };
      case "-":
      case "_":
        return { type: "adjust-width", delta: -40 };
      case "=":
      case "+":
        return { type: "adjust-width", delta: 40 };
      case "Escape":
        return { type: "close-panel" };
      default:
        return { type: "none" };
    }
  }
  resolveCommandId(n) {
    switch (n.type) {
      case "navigate":
        return n.direction === "next" ? w.nextPage : w.previousPage;
      case "navigate-boundary":
        return n.boundary === "end" ? w.goSectionEnd : w.goSectionStart;
      case "close-panel":
        return w.closePanel;
      case "adjust-font":
        return n.delta > 0 ? w.increaseFont : w.decreaseFont;
      case "adjust-width":
        return n.delta > 0 ? w.widenContent : w.narrowContent;
      default:
        return null;
    }
  }
}
class js {
  activePointer = null;
  start(n, t, o) {
    this.activePointer = {
      pointerId: n,
      startX: t,
      startY: o
    };
  }
  finish(n, t, o) {
    if (!this.activePointer || this.activePointer.pointerId !== n)
      return null;
    const a = {
      deltaX: t - this.activePointer.startX,
      deltaY: o - this.activePointer.startY
    };
    return this.activePointer = null, a;
  }
  cancel() {
    this.activePointer = null;
  }
}
const fe = 220;
class Ks {
  constructor(n, t) {
    this.callbacks = n, this.runtime = t;
  }
  callbacks;
  runtime;
  recognizer = new js();
  attach(n) {
    const t = (r) => {
      r.pointerType !== "touch" && r.pointerType !== "pen" || this.recognizer.start(r.pointerId, r.clientX, r.clientY);
    }, o = (r) => {
      if (!this.runtime.canNavigate())
        return;
      const i = this.recognizer.finish(r.pointerId, r.clientX, r.clientY);
      if (!i)
        return;
      if (this.runtime.getReadingMode() === "paginated") {
        Math.abs(i.deltaX) > 48 && Math.abs(i.deltaX) > Math.abs(i.deltaY) * 1.15 && (this.callbacks.onNavigate(i.deltaX < 0 ? "next" : "previous"), this.runtime.lockNavigation(fe));
        return;
      }
      if (Math.abs(i.deltaY) <= 64 || Math.abs(i.deltaY) <= Math.abs(i.deltaX) * 1.1)
        return;
      const s = this.runtime.getController();
      s && (i.deltaY < 0 && s.isNearBoundary("next") ? (this.callbacks.onNavigate("next"), this.runtime.lockNavigation(fe)) : i.deltaY > 0 && s.isNearBoundary("previous") && (this.callbacks.onNavigate("previous"), this.runtime.lockNavigation(fe)));
    }, a = () => {
      this.recognizer.cancel();
    };
    return n.addEventListener("pointerdown", t), n.addEventListener("pointerup", o), n.addEventListener("pointercancel", a), () => {
      n.removeEventListener("pointerdown", t), n.removeEventListener("pointerup", o), n.removeEventListener("pointercancel", a);
    };
  }
}
const $s = 96, ye = 60, Ys = 220, Se = 90, qs = 180, Vs = 48, Xs = 24, Js = 100;
function Zs(e, n) {
  const t = Math.max(
    n.documentElement.clientHeight,
    n.defaultView?.innerHeight ?? 0,
    1
  ), o = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 18 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? t : 1;
  return {
    x: e.deltaX * o,
    y: e.deltaY * o
  };
}
function qn(e, n) {
  const t = e, o = n === "x" ? t.wheelDeltaX : t.wheelDeltaY ?? t.wheelDelta;
  return typeof o == "number" && Number.isFinite(o) ? o : null;
}
function Dt(e) {
  return Math.abs(e - Math.round(e)) < 1e-3;
}
class Qs {
  constructor(n, t) {
    this.callbacks = n, this.runtime = t;
  }
  callbacks;
  runtime;
  accumulator = {
    delta: 0,
    timestamp: 0,
    direction: null
  };
  consumedGesture = null;
  attach(n) {
    const t = (o) => {
      const a = Zs(o, n), r = this.runtime.getReadingMode();
      if (r === "paginated") {
        const c = Math.abs(a.x) > Math.abs(a.y) ? a.x : a.y;
        if (Math.abs(c) <= 0)
          return;
        o.preventDefault();
        const d = c > 0 ? "next" : "previous", u = Date.now();
        if (this.releaseConsumedGesture(u, d), this.consumedGesture) {
          this.consumedGesture.lastTimestamp = u;
          return;
        }
        if (!this.runtime.canNavigate()) {
          this.resetAccumulator();
          return;
        }
        if (this.isDiscretePaginatedWheelEvent(o, a, c)) {
          this.callbacks.onNavigate(d), this.runtime.lockNavigation(ye), this.markGestureConsumed(d, u, Se);
          return;
        }
        const h = this.resolvePaginatedThreshold(o.deltaMode), S = this.consumeAccumulated(c, h, d, u);
        if (!S)
          return;
        this.callbacks.onNavigate(S), this.runtime.lockNavigation(ye), this.markGestureConsumed(
          S,
          u,
          this.resolveGestureIdleMs(o.deltaMode, c)
        );
        return;
      }
      if (!this.runtime.canNavigate())
        return;
      const i = pt({
        readingMode: r,
        deltaMode: o.deltaMode
      });
      if (Math.abs(a.y) < Math.abs(a.x) || Math.abs(a.y) <= 0) {
        this.resetAccumulator();
        return;
      }
      const s = a.y > 0 ? "next" : "previous";
      if (!this.runtime.getController()?.isNearBoundary(s)) {
        this.resetAccumulator();
        return;
      }
      this.consumeAccumulated(a.y, i, s, Date.now()) === s && (o.preventDefault(), this.callbacks.onNavigate(s), this.runtime.lockNavigation(ye), this.resetAccumulator());
    };
    return n.addEventListener("wheel", t, { passive: !1 }), () => {
      n.removeEventListener("wheel", t);
    };
  }
  resetAccumulator() {
    this.accumulator = {
      delta: 0,
      timestamp: 0,
      direction: null
    };
  }
  isDiscretePaginatedWheelEvent(n, t, o) {
    if (n.deltaMode !== WheelEvent.DOM_DELTA_PIXEL)
      return !0;
    const a = Math.abs(qn(n, "x") ?? 0) > Math.abs(qn(n, "y") ?? 0) ? qn(n, "x") : qn(n, "y");
    if (a !== null && Math.abs(a) >= Js)
      return !0;
    const r = Math.abs(t.x) > Math.abs(t.y) ? t.y : t.x;
    return Math.abs(r) < 1 && Math.abs(o) >= Xs && Dt(n.deltaX) && Dt(n.deltaY);
  }
  resolvePaginatedThreshold(n) {
    return n === WheelEvent.DOM_DELTA_PIXEL ? $s : pt({
      readingMode: "paginated",
      deltaMode: n
    });
  }
  resolveGestureIdleMs(n, t) {
    return n !== WheelEvent.DOM_DELTA_PIXEL || Math.abs(t) >= Vs ? Se : Ys;
  }
  markGestureConsumed(n, t, o) {
    this.consumedGesture = {
      direction: n,
      idleMs: o,
      lastTimestamp: t
    }, this.resetAccumulator();
  }
  releaseConsumedGesture(n, t) {
    if (!this.consumedGesture)
      return;
    (this.consumedGesture.direction !== t || n - this.consumedGesture.lastTimestamp > this.consumedGesture.idleMs) && (this.consumedGesture = null, this.resetAccumulator());
  }
  consumeAccumulated(n, t, o, a) {
    return (a - this.accumulator.timestamp > qs || this.accumulator.direction !== null && this.accumulator.direction !== o) && (this.accumulator.delta = 0), this.accumulator.timestamp = a, this.accumulator.direction = o, this.accumulator.delta += n, Math.abs(this.accumulator.delta) < t ? null : this.accumulator.delta > 0 ? "next" : "previous";
  }
}
class nl {
  runtime;
  keyboardHandler;
  clickHandler;
  wheelHandler;
  touchHandler;
  hostCleanup = null;
  frameCleanup = null;
  navigationLockUntil = 0;
  constructor(n) {
    const t = {
      ...n.callbacks,
      onNavigate: (o) => {
        this.canNavigate() && (this.lockNavigation(), n.callbacks.onNavigate(o));
      },
      onNavigateBoundary: (o) => {
        this.canNavigate() && (this.lockNavigation(), n.callbacks.onNavigateBoundary(o));
      }
    };
    this.runtime = {
      getReadingMode: n.getReadingMode,
      getController: n.getController,
      hasActivePanel: n.hasActivePanel,
      canNavigate: () => this.canNavigate(),
      lockNavigation: (o) => this.lockNavigation(o)
    }, this.keyboardHandler = new Ws(t), this.clickHandler = new Bs(t, this.runtime), this.wheelHandler = new Qs(n.callbacks, this.runtime), this.touchHandler = new Ks(n.callbacks, this.runtime);
  }
  attachToHost(n) {
    this.hostCleanup?.(), this.hostCleanup = this.keyboardHandler.attach(n);
  }
  attachToFrame(n) {
    this.frameCleanup?.();
    const t = [
      this.keyboardHandler.attach(n),
      this.clickHandler.attach(n),
      this.wheelHandler.attach(n),
      this.touchHandler.attach(n)
    ];
    this.frameCleanup = () => {
      for (const o of t)
        o();
    };
  }
  canNavigate() {
    return Date.now() >= this.navigationLockUntil;
  }
  lockNavigation(n = 140) {
    this.navigationLockUntil = Date.now() + n;
  }
  destroy() {
    this.hostCleanup?.(), this.frameCleanup?.(), this.hostCleanup = null, this.frameCleanup = null;
  }
}
function el(e) {
  const n = X(e), t = X(null), o = X(e.controller);
  n.current = e, o.current = e.controller, W(() => {
    if (!e.book && e.activePanel === null) {
      t.current?.destroy(), t.current = null;
      return;
    }
    const a = new nl({
      callbacks: {
        onNavigate: (r) => n.current.onNavigate(r),
        onNavigateBoundary: (r) => n.current.onNavigateBoundary(r),
        onInvokeCommand: (r) => n.current.onInvokeCommand?.(r),
        onToggleChrome: () => n.current.onToggleChrome(),
        onClosePanel: () => n.current.onClosePanel(),
        onOpenLink: (r, i) => {
          i && n.current.onOpenExternalLink(r);
        },
        onEpubLink: (r, i) => {
          const s = n.current.sectionIndexByPath.get(r);
          typeof s == "number" && n.current.onSelectSection(s, i);
        },
        onAdjustFont: (r) => {
          n.current.onUpdatePreferences({
            ...n.current.preferences,
            fontScale: Vt(n.current.preferences.fontScale + r)
          });
        },
        onAdjustWidth: (r) => {
          n.current.onUpdatePreferences({
            ...n.current.preferences,
            contentWidth: Xt(n.current.preferences.contentWidth + r)
          });
        }
      },
      getReadingMode: () => n.current.preferences.readingMode,
      getController: () => o.current,
      hasActivePanel: () => n.current.activePanel !== null
    });
    return a.attachToHost(window), n.current.frameDocument && a.attachToFrame(n.current.frameDocument), t.current = a, () => {
      a.destroy(), t.current = null;
    };
  }, [e.book]), W(() => {
    !t.current || !e.frameDocument || t.current.attachToFrame(e.frameDocument);
  }, [e.frameDocument]);
}
function tl(e, n) {
  const t = n?.delay, [o, a] = G(e);
  return W(() => {
    const r = setTimeout(() => {
      a(e);
    }, t);
    return () => {
      clearTimeout(r);
    };
  }, [t, e]), o;
}
const ol = 360, fo = ({ mode: e }) => e === "config" ? null : /* @__PURE__ */ g(
  Jn,
  {
    type: "warning",
    showIcon: !0,
    role: "alert",
    message: "偏好暂存于内存（配置域未就绪），窗口关闭后不会保留"
  }
), al = {
  system: "跟随系统",
  theme: "纸白",
  warm: "暖白",
  mist: "雾蓝",
  night: "夜间"
}, il = {
  serif: "衬线",
  sans: "无衬线",
  round: "圆体",
  system: "系统"
}, rl = {
  paginated: "分页",
  scroll: "滚动"
}, sl = {
  justify: "两端对齐",
  left: "左对齐"
}, ll = {
  horizontal: "横排",
  vertical: "竖排"
};
function En(e) {
  return Object.keys(e).map((n) => ({ value: n, label: e[n] }));
}
const Mn = ({ title: e, open: n, onClose: t, children: o }) => /* @__PURE__ */ g(
  Co,
  {
    title: e,
    placement: "right",
    width: ol,
    open: n,
    onClose: t,
    getContainer: !1,
    children: o
  }
), cl = ({
  toc: e,
  activeSectionPath: n,
  onSelect: t,
  sectionIndexByPath: o
}) => {
  const { token: a } = yn.useToken(), r = (i) => {
    const s = o.get(i.path), l = n === i.path, c = /* @__PURE__ */ g(
      "span",
      {
        role: "button",
        tabIndex: 0,
        onClick: () => {
          typeof s == "number" && t(s, i.fragment);
        },
        onKeyDown: (u) => {
          u.key === "Enter" && typeof s == "number" && t(s, i.fragment);
        },
        style: {
          color: l ? a.colorPrimary : a.colorText,
          fontWeight: l ? 600 : 400,
          cursor: typeof s == "number" ? "pointer" : "default",
          display: "block",
          paddingInline: a.paddingXS,
          borderRadius: a.borderRadiusSM
        },
        children: i.title || i.path
      }
    ), d = i.children.filter(
      (u) => typeof o.get(u.path) == "number" || u.children.length > 0
    );
    return /* @__PURE__ */ U("li", { children: [
      c,
      d.length > 0 ? /* @__PURE__ */ g("ul", { style: { paddingInlineStart: a.marginSM }, children: d.map(r) }) : null
    ] }, `${i.path}#${i.fragment ?? ""}`);
  };
  return e.length === 0 ? /* @__PURE__ */ g(Fe, { description: "本书没有目录信息" }) : /* @__PURE__ */ g("ul", { style: { listStyle: "none", margin: 0, paddingInlineStart: 0 }, children: e.map(r) });
}, dl = ({
  bookmarks: e,
  currentBookmarkId: n,
  onJump: t,
  onRemove: o
}) => e.length === 0 ? /* @__PURE__ */ g(Fe, { description: "还没有书签，阅读时点击工具栏的书签按钮即可添加" }) : /* @__PURE__ */ g(
  fn,
  {
    dataSource: [...e],
    renderItem: (a) => /* @__PURE__ */ g(
      fn.Item,
      {
        style: {
          cursor: "pointer",
          fontWeight: a.id === n ? 600 : 400
        },
        onClick: () => t(a),
        actions: [
          /* @__PURE__ */ g(Wt, { title: "移除此书签", children: /* @__PURE__ */ g(
            Zn,
            {
              type: "text",
              size: "small",
              icon: /* @__PURE__ */ g(Eo, {}),
              "aria-label": `移除书签：${a.sectionTitle}`,
              onClick: (r) => {
                r.stopPropagation(), o(a.id);
              }
            }
          ) }, "remove")
        ],
        children: /* @__PURE__ */ g(
          fn.Item.Meta,
          {
            title: a.sectionTitle,
            description: a.excerpt ? a.excerpt : new Date(a.createdAt).toLocaleString("zh-CN")
          }
        )
      }
    )
  }
), ml = ({ excerpt: e, query: n }) => {
  const { token: t } = yn.useToken(), o = Ji(e, n);
  return o.match ? /* @__PURE__ */ U(Xn, { children: [
    o.before,
    /* @__PURE__ */ g(
      "mark",
      {
        style: {
          background: t.colorWarningBg,
          color: "inherit",
          borderRadius: t.borderRadiusSM
        },
        children: o.match
      }
    ),
    o.after
  ] }) : /* @__PURE__ */ g(Xn, { children: e });
}, ul = ({
  query: e,
  onQueryChange: n,
  isSearching: t,
  progress: o,
  results: a,
  onSelectResult: r
}) => {
  const { token: i } = yn.useToken(), s = t ? `正在搜索：${o?.current ?? 0}/${o?.total ?? 0} 章` : e.trim() ? `共 ${a.length} 处匹配` : "输入关键词搜索全书文本";
  return /* @__PURE__ */ U(dn, { vertical: !0, gap: i.marginSM, children: [
    /* @__PURE__ */ g(
      Bt,
      {
        value: e,
        placeholder: "搜索全书文本",
        allowClear: !0,
        prefix: /* @__PURE__ */ g(jt, {}),
        "aria-label": "搜索全书文本",
        onChange: (l) => n(l.target.value)
      }
    ),
    /* @__PURE__ */ g(B.Text, { type: "secondary", children: s }),
    t ? /* @__PURE__ */ g(Kt, {}) : null,
    a.length > 0 ? /* @__PURE__ */ g(
      fn,
      {
        size: "small",
        dataSource: [...a],
        renderItem: (l) => /* @__PURE__ */ g(fn.Item, { style: { cursor: "pointer" }, onClick: () => r(l), children: /* @__PURE__ */ g(
          fn.Item.Meta,
          {
            title: l.sectionTitle,
            description: /* @__PURE__ */ g(ml, { excerpt: l.excerpt, query: l.query })
          }
        ) })
      }
    ) : null
  ] });
}, hl = ({
  preferences: e,
  persistenceMode: n,
  onChange: t,
  onReset: o
}) => {
  const { token: a } = yn.useToken(), r = (i, s, l, c, d, u) => /* @__PURE__ */ U(Xn, { children: [
    /* @__PURE__ */ g(B.Text, { children: i }),
    /* @__PURE__ */ g(
      $t,
      {
        min: l,
        max: c,
        step: d,
        value: s,
        tooltip: { formatter: (h) => `${h}` },
        onChange: (h) => u(h)
      }
    )
  ] });
  return /* @__PURE__ */ U(dn, { vertical: !0, gap: a.marginSM, children: [
    /* @__PURE__ */ g(fo, { mode: n }),
    /* @__PURE__ */ U("div", { children: [
      /* @__PURE__ */ g(B.Text, { children: "阅读模式" }),
      /* @__PURE__ */ g(
        Mo,
        {
          value: e.readingMode,
          options: En(rl),
          onChange: (i) => t({ readingMode: i })
        }
      )
    ] }),
    /* @__PURE__ */ U("div", { children: [
      /* @__PURE__ */ g(B.Text, { children: "背景配色" }),
      /* @__PURE__ */ g(
        me.Group,
        {
          value: e.backgroundTone,
          options: En(al).map((i) => ({
            value: i.value,
            label: i.label
          })),
          onChange: (i) => t({ backgroundTone: i.target.value })
        }
      )
    ] }),
    /* @__PURE__ */ U("div", { children: [
      /* @__PURE__ */ g(B.Text, { children: "字体" }),
      /* @__PURE__ */ g(
        To,
        {
          value: e.fontFamily,
          options: En(il).map((i) => ({
            value: i.value,
            label: i.label
          })),
          onChange: (i) => t({ fontFamily: i })
        }
      )
    ] }),
    r(
      "字号",
      e.fontScale,
      0.85,
      1.4,
      0.05,
      (i) => t({ fontScale: i })
    ),
    r(
      "行距",
      e.lineHeight ?? 1.65,
      1.4,
      2,
      0.05,
      (i) => t({ lineHeight: i })
    ),
    r(
      "字距",
      e.letterSpacing ?? 0.01,
      0,
      0.06,
      0.01,
      (i) => t({ letterSpacing: i })
    ),
    r(
      "亮度",
      e.brightness ?? 1,
      0.6,
      1,
      0.05,
      (i) => t({ brightness: i })
    ),
    r(
      "版心宽度",
      e.contentWidth,
      560,
      980,
      20,
      (i) => t({ contentWidth: i })
    ),
    /* @__PURE__ */ U("div", { children: [
      /* @__PURE__ */ g(B.Text, { children: "对齐方式" }),
      /* @__PURE__ */ g(
        me.Group,
        {
          value: e.textAlign ?? "justify",
          options: En(sl).map((i) => ({
            value: i.value,
            label: i.label
          })),
          onChange: (i) => t({ textAlign: i.target.value })
        }
      )
    ] }),
    /* @__PURE__ */ U("div", { children: [
      /* @__PURE__ */ g(B.Text, { children: "书写方向" }),
      /* @__PURE__ */ g(
        me.Group,
        {
          value: e.writingMode ?? "horizontal",
          options: En(ll).map((i) => ({
            value: i.value,
            label: i.label
          })),
          onChange: (i) => t({ writingMode: i.target.value })
        }
      )
    ] }),
    /* @__PURE__ */ g(Gt, { style: { margin: 0 } }),
    /* @__PURE__ */ g(Te, { children: /* @__PURE__ */ g(Zn, { onClick: o, children: "恢复默认" }) })
  ] });
}, Ot = ({
  uriInput: e,
  onUriInputChange: n,
  onSubmit: t,
  submitting: o,
  failureMessage: a,
  persistenceMode: r
}) => {
  const { token: i } = yn.useToken();
  return /* @__PURE__ */ U(dn, { vertical: !0, gap: i.marginSM, children: [
    /* @__PURE__ */ g(B.Paragraph, { type: "secondary", style: { marginBottom: 0 }, children: "粘贴一个书籍资源的 chips-resource:// 受管引用，经平台资源打开路由发起阅读。宿主资源路由未就绪时会在此如实提示。" }),
    /* @__PURE__ */ g(
      Bt,
      {
        value: e,
        placeholder: "chips-resource://…",
        "aria-label": "书籍资源受管引用",
        onChange: (s) => n(s.target.value),
        onPressEnter: t
      }
    ),
    /* @__PURE__ */ g(Te, { children: /* @__PURE__ */ g(Zn, { type: "primary", loading: o, disabled: !e.trim(), onClick: t, children: "通过资源路由打开" }) }),
    a === null ? null : /* @__PURE__ */ g(Jn, { type: "error", showIcon: !0, role: "alert", message: a }),
    /* @__PURE__ */ g(Gt, { style: { margin: 0 } }),
    /* @__PURE__ */ g(fo, { mode: r })
  ] });
}, tn = {
  contents: "目录",
  bookmarks: "书签",
  search: "搜索",
  preferences: "阅读偏好",
  source: "打开书籍"
}, gl = 300, pl = 1600;
function fl(e, n) {
  const t = Math.min(1, Math.max(0, e)), o = n.reduce((r, i) => r + Math.max(0, i), 0);
  if (n.length === 0 || o <= 0)
    return { sectionIndex: 0, sectionFraction: t };
  let a = t * o;
  for (let r = 0; r < n.length; r += 1) {
    const i = Math.max(0, n[r] ?? 0);
    if (a <= i || r === n.length - 1) {
      const s = i > 0 ? Math.min(1, Math.max(0, a / i)) : 0;
      return { sectionIndex: r, sectionFraction: s };
    }
    a -= i;
  }
  return { sectionIndex: n.length - 1, sectionFraction: 1 };
}
const yl = () => {
  const { message: e } = Yt.useApp(), { token: n } = yn.useToken(), t = or(), o = b.useMemo(
    () => lr(rr()),
    []
  ), [a, r] = b.useState(
    o.mode
  );
  b.useEffect(() => {
    const m = o.onModeChange(r);
    return () => {
      m();
    };
  }, [o]);
  const { preferences: i, update: s, reset: l } = pr({ configClient: o }), c = Ds(), d = b.useMemo(
    () => da(
      oa,
      { backgroundTone: i.backgroundTone },
      c.isDark ? "dark" : "light"
    ),
    [i.backgroundTone, c.isDark]
  ), [u, h] = b.useState(null), [S, _] = b.useState(!1), [R, p] = b.useState(null), [f, E] = b.useState(0), [j, F] = b.useState(void 0), [z, q] = b.useState(null), [ln, V] = b.useState(!1), [bn, An] = b.useState(null), [D, M] = b.useState(null), [oe, cn] = b.useState(null), [ae, _n] = b.useState(null), [We, je] = b.useState(null), [Nn, Ke] = b.useState(""), [$e, Ye] = b.useState(!1), [qe, yo] = b.useState(""), [ie, Un] = b.useState([]), [So, Pn] = b.useState(!1), [bo, In] = b.useState(null), k = u?.book ?? null, Ve = k?.source.sourceId ?? null, un = k?.sections[f] ?? null, Ln = k?.sections.length ?? 0, Xe = b.useMemo(
    () => new Map((k?.sections ?? []).map((m, y) => [m.path, y])),
    [k]
  ), re = b.useMemo(() => k?.sections.map(() => 1) ?? [1], [k]), Je = b.useRef(null), hn = b.useRef(null), Hn = b.useRef(null), Dn = b.useRef(null), se = b.useRef(null), On = tl(qe, {
    delay: gl
  }), Ze = b.useCallback(
    async (m, y) => {
      _(!0), p(null);
      try {
        const x = await xi({ bytes: m, source: y });
        Hn.current = null, h({ book: x }), E(0), F(void 0), q(null), M(null), e.success(`已打开「${x.metadata.title}」`);
      } catch (x) {
        const Q = x instanceof Error ? x.message : String(x);
        p(`无法打开该书籍：${Q}`);
      } finally {
        _(!1);
      }
    },
    [e]
  ), Qe = b.useCallback(
    async (m) => {
      const y = dr(m);
      if (!Ra({
        sourceId: y.sourceId,
        fileName: y.fileName,
        mimeType: m.mimeType
      })) {
        p("该资源不是本阅读器支持的书籍格式。");
        return;
      }
      const x = await hr(m.uri, y);
      if (x.kind === "failure") {
        p(x.failure.message);
        return;
      }
      await Ze(x.bytes, {
        ...x.source,
        format: Qn(x.mimeType || x.source.format || y.fileName)
      });
    },
    [Ze]
  );
  b.useEffect(() => {
    let m = null;
    try {
      m = rn.subscribe("resource:opened", (y) => {
        const x = y;
        !x || x.pluginId !== "chips.official.book-reader" || !x.context || Qe(x.context);
      });
    } catch (y) {
      const x = typeof y == "object" && y !== null && "code" in y ? String(y.code) : "";
      p(
        x === "SDK_BRIDGE_UNAVAILABLE" ? "平台事件通道不可用：无法接收资源打开投递，可改用下方资源引用发起打开。" : "平台事件通道订阅失败：无法接收资源打开投递。"
      );
    }
    return () => {
      m?.dispose();
    };
  }, [Qe]);
  const nt = b.useCallback(async () => {
    const m = Nn.trim();
    if (m) {
      Ye(!0), p(null);
      try {
        const y = m.split("/").pop();
        await ur({ uri: m, ...y === void 0 ? {} : { title: y } });
      } catch (y) {
        const x = y instanceof Error ? y.message : String(y);
        p(
          `资源打开路由不可用（${x}）。宿主 resource:open 处理器就绪后即可路由到本应用。`
        );
      } finally {
        Ye(!1);
      }
    }
  }, [Nn]);
  b.useEffect(() => {
    if (!k) {
      q(null);
      return;
    }
    const m = k.sections[f];
    if (!m)
      return;
    let y = !1;
    return V(!0), An(null), qi(k, m.path).then((x) => {
      y || q(x);
    }).catch((x) => {
      y || An(
        `渲染章节失败：${x instanceof Error ? x.message : String(x)}`
      );
    }).finally(() => {
      y || V(!1);
    }), () => {
      y = !0;
    };
  }, [k, f]);
  const {
    controller: A,
    frameDocument: gn,
    isFrameLoading: _o,
    navigatePage: et,
    navigateToBoundary: tt,
    seekToFraction: ot
  } = Is({
    iframeRef: Je,
    renderedSection: z,
    preferences: i,
    themePalette: d,
    currentFragment: j,
    pendingBoundary: oe,
    section: {
      index: f,
      count: Math.max(1, Ln),
      title: un?.title ?? k?.metadata.title ?? "",
      weights: re
    },
    onInitialLocationSettled: () => {
      cn(null);
    }
  }), { progress: P } = Ls({ controller: A }), { bookmarks: at, addBookmark: it, removeBookmark: le, findBookmarkAtPosition: Bn } = Sr({
    bookSourceId: Ve,
    configClient: o
  }), vn = wr({ bookSourceId: Ve, configClient: o }), H = b.useMemo(() => {
    if (!P)
      return null;
    const m = A?.getCurrentAnchor();
    return {
      spreadIndex: m?.spreadIndex ?? Math.max(0, P.currentPage - 1),
      scrollFraction: m?.scrollFraction ?? P.sectionFraction
    };
  }, [A, P]), rt = b.useMemo(() => !H || !P || !k ? null : Bn({
    sectionIndex: f,
    readingMode: i.readingMode,
    spreadIndex: H.spreadIndex,
    scrollFraction: H.scrollFraction
  }), [
    k,
    H,
    f,
    Bn,
    i.readingMode,
    P
  ]), st = b.useCallback(() => {
    if (!k || !P || !H)
      return;
    const m = Bn({
      sectionIndex: f,
      readingMode: i.readingMode,
      spreadIndex: H.spreadIndex,
      scrollFraction: H.scrollFraction
    });
    if (m) {
      le(m.id), e.info("已移除书签");
      return;
    }
    it({
      sectionIndex: f,
      sectionTitle: un?.title ?? k.metadata.title,
      spreadIndex: H.spreadIndex,
      scrollFraction: H.scrollFraction,
      readingMode: i.readingMode,
      excerpt: P.sectionTitle
    }), e.success("已添加书签");
  }, [
    it,
    k,
    H,
    un,
    f,
    Bn,
    e,
    i.readingMode,
    P,
    le
  ]), vo = b.useCallback(
    (m) => {
      se.current = m, F(void 0), _n(null), m.sectionIndex !== f && (cn(null), E(m.sectionIndex));
    },
    [f]
  );
  b.useEffect(() => {
    const m = se.current;
    !A || !m || m.sectionIndex !== f || (i.readingMode === "paginated" && m.readingMode === "paginated" ? A.goToSpread(m.spreadIndex, "smooth") : A.goToProgress(m.scrollFraction, "smooth"), se.current = null);
  }, [A, f, i.readingMode]), b.useEffect(() => {
    !k || !P || !H || vn.track({
      sectionIndex: f,
      readingMode: i.readingMode,
      spreadIndex: i.readingMode === "paginated" ? H.spreadIndex : void 0,
      scrollFraction: H.scrollFraction
    });
  }, [
    k,
    H,
    f,
    i.readingMode,
    P,
    vn
  ]), b.useEffect(() => {
    const m = vn.savedPosition;
    if (!m || Dn.current !== null)
      return;
    const y = vn.restore(m);
    y && (Dn.current = y, y.sectionIndex !== f && E(y.sectionIndex));
  }, [f, vn]), b.useEffect(() => {
    const m = Dn.current;
    !A || !m || m.sectionIndex !== f || (i.readingMode === "paginated" && m.readingMode === "paginated" && typeof m.spreadIndex == "number" ? A.goToSpread(m.spreadIndex, "smooth") : A.goToProgress(m.scrollFraction, "smooth"), Dn.current = null);
  }, [A, f, i.readingMode]), b.useEffect(() => {
    if (!k) {
      Hn.current = null;
      return;
    }
    const m = Hn.current;
    Hn.current = f, !(m === null || m === f || oe !== null) && (je(un?.title ?? k.metadata.title), hn.current !== null && window.clearTimeout(hn.current), hn.current = window.setTimeout(() => {
      hn.current = null, je(null);
    }, pl));
  }, [k, un, f, oe]), b.useEffect(() => () => {
    hn.current !== null && window.clearTimeout(hn.current);
  }, []);
  const Z = b.useMemo(() => k ? new Qi(k) : null, [k]);
  b.useEffect(() => {
    if (!Z) {
      Un([]), Pn(!1), In(null);
      return;
    }
    const m = On.trim();
    if (Z.cancel(), !m) {
      Un([]), Pn(!1), In(null);
      return;
    }
    let y = !1;
    return Pn(!0), Un([]), In({ current: 0, total: k?.sections.length ?? 0 }), (async () => {
      try {
        for await (const x of Z.search(m, {
          onProgress: (Q, de) => {
            y || In({ current: Q, total: de });
          }
        })) {
          if (y)
            return;
          Un((Q) => [...Q, ...x]);
        }
      } finally {
        y || Pn(!1);
      }
    })(), () => {
      y = !0, Z.cancel();
    };
  }, [k, On, Z]), b.useEffect(() => {
    if (!gn || !Z)
      return;
    const m = ie.filter(
      (y) => y.sectionIndex === f
    );
    if (D !== "search" || !On.trim() || m.length === 0) {
      Z.clearHighlights(gn);
      return;
    }
    return Z.highlightInDocument(gn, [...m], 0), () => {
      Z.clearHighlights(gn);
    };
  }, [
    D,
    f,
    On,
    gn,
    Z,
    ie
  ]);
  const wo = b.useCallback(
    (m) => {
      m.sectionIndex !== f ? (F(void 0), _n(null), E(m.sectionIndex)) : A?.goToProgress(
        Math.min(1, m.matchOffset / Math.max(1, m.matchOffset + 400)),
        "auto"
      );
    },
    [A, f]
  ), wn = b.useCallback(
    (m) => {
      const y = f + m;
      !k || y < 0 || y >= k.sections.length || (F(void 0), E(y));
    },
    [k, f]
  ), pn = b.useCallback(
    (m) => {
      if (!k || et(m)?.moved)
        return;
      const x = m === "next" ? 1 : -1, Q = f + x;
      Q < 0 || Q >= k.sections.length || (cn(m === "next" ? "start" : "end"), wn(x));
    },
    [k, f, et, wn]
  ), Gn = b.useCallback(
    (m) => {
      tt(m);
    },
    [tt]
  ), lt = b.useCallback(
    (m, y) => {
      cn(null), _n(null), F(y), m !== f && E(m);
    },
    [f]
  ), Ro = b.useCallback(
    (m) => {
      const y = fl(m, re);
      if (y.sectionIndex === f) {
        ot(y.sectionFraction);
        return;
      }
      cn(null), _n(y.sectionFraction), F(void 0), E(y.sectionIndex);
    },
    [f, ot, re]
  );
  b.useEffect(() => {
    ae === null || !A || (A.goToProgress(ae, "auto"), _n(null));
  }, [A, ae]);
  const Wn = b.useCallback(
    (m) => {
      s({
        fontScale: i.fontScale + m
      });
    },
    [i.fontScale, s]
  ), ce = b.useCallback(
    (m) => {
      s({
        contentWidth: i.contentWidth + m
      });
    },
    [i.contentWidth, s]
  ), ct = b.useCallback(
    (m) => {
      if (er(m.commandId))
        switch (m.commandId) {
          case w.previousPage:
            pn("previous");
            return;
          case w.nextPage:
            pn("next");
            return;
          case w.previousSection:
            f > 0 && (cn("end"), wn(-1));
            return;
          case w.nextSection:
            f < Ln - 1 && (cn("start"), wn(1));
            return;
          case w.goSectionStart:
            Gn("start");
            return;
          case w.goSectionEnd:
            Gn("end");
            return;
          case w.toggleContents:
            M((y) => y === "contents" ? null : "contents");
            return;
          case w.toggleBookmarks:
            M((y) => y === "bookmarks" ? null : "bookmarks");
            return;
          case w.togglePreferences:
            M((y) => y === "preferences" ? null : "preferences");
            return;
          case w.toggleSearch:
            M((y) => y === "search" ? null : "search");
            return;
          case w.closePanel:
            M(null);
            return;
          case w.increaseFont:
            Wn(0.05);
            return;
          case w.decreaseFont:
            Wn(-0.05);
            return;
          case w.widenContent:
            ce(40);
            return;
          case w.narrowContent:
            ce(-40);
            return;
          case w.toggleBookmark:
            st();
            return;
          default:
            return;
        }
    },
    [
      Wn,
      ce,
      f,
      pn,
      Gn,
      Ln,
      wn,
      st
    ]
  );
  b.useEffect(() => {
    t.setExecutor(ct);
  }, [t, ct]), el({
    book: k,
    controller: A,
    frameDocument: gn,
    activePanel: D,
    preferences: i,
    sectionIndexByPath: Xe,
    onNavigate: pn,
    onNavigateBoundary: Gn,
    onInvokeCommand: (m) => {
      t.invoke(m);
    },
    onToggleChrome: () => {
      M((m) => m);
    },
    onClosePanel: () => {
      M(null);
    },
    onSelectSection: (m, y) => {
      lt(m, y);
    },
    onOpenExternalLink: () => {
      e.info("外部链接已在阅读器内拦截，未经平台路由不放行。");
    },
    onUpdatePreferences: (m) => {
      s(m);
    }
  });
  const ko = S || ln || _o, dt = P?.bookPercentage ?? 0, an = (m, y, x, Q, de = !1) => /* @__PURE__ */ g(Wt, { title: y, children: /* @__PURE__ */ g(
    Zn,
    {
      type: "text",
      "aria-label": y,
      icon: x,
      onClick: Q,
      style: de ? { color: n.colorPrimary } : void 0
    }
  ) }, m);
  return /* @__PURE__ */ U(
    dn,
    {
      vertical: !0,
      style: {
        height: "100vh",
        background: d.surface,
        color: d.text
      },
      children: [
        /* @__PURE__ */ U(
          dn,
          {
            align: "center",
            gap: n.marginXS,
            style: {
              paddingInline: n.paddingSM,
              paddingBlock: n.paddingXS,
              borderBottom: `1px solid ${d.border}`
            },
            children: [
              an(
                "source",
                "打开书籍",
                /* @__PURE__ */ g(No, {}),
                () => M((m) => m === "source" ? null : "source")
              ),
              an(
                "contents",
                tn.contents,
                /* @__PURE__ */ g(Uo, {}),
                () => M((m) => m === "contents" ? null : "contents"),
                D === "contents"
              ),
              an(
                "bookmarks",
                tn.bookmarks,
                at.length > 0 && rt ? /* @__PURE__ */ g(Fo, {}) : /* @__PURE__ */ g(zo, {}),
                () => M((m) => m === "bookmarks" ? null : "bookmarks"),
                D === "bookmarks"
              ),
              an(
                "search",
                tn.search,
                /* @__PURE__ */ g(jt, {}),
                () => M((m) => m === "search" ? null : "search"),
                D === "search"
              ),
              an(
                "preferences",
                tn.preferences,
                /* @__PURE__ */ g(Po, {}),
                () => M((m) => m === "preferences" ? null : "preferences"),
                D === "preferences"
              ),
              /* @__PURE__ */ g(B.Text, { strong: !0, ellipsis: !0, style: { flex: 1, marginInline: n.marginXS }, children: k ? k.metadata.title : "书籍阅读器" }),
              a === "memory" ? /* @__PURE__ */ g(Ao, { color: "warning", style: { marginInlineEnd: 0 }, children: "偏好暂存于内存" }) : null,
              an("previous", "上一页", /* @__PURE__ */ g(Io, {}), () => pn("previous")),
              an("next", "下一页", /* @__PURE__ */ g(Lo, {}), () => pn("next")),
              an(
                "font-increase",
                "增大字号",
                /* @__PURE__ */ g(Ho, {}),
                () => Wn(0.05)
              )
            ]
          }
        ),
        We === null ? null : /* @__PURE__ */ g(
          "div",
          {
            role: "status",
            style: {
              textAlign: "center",
              paddingBlock: n.paddingXS,
              borderBottom: `1px solid ${d.border}`
            },
            children: /* @__PURE__ */ g(B.Text, { type: "secondary", children: We })
          }
        ),
        /* @__PURE__ */ g("div", { style: { flex: 1, position: "relative", overflow: "hidden" }, children: k === null ? /* @__PURE__ */ U(
          dn,
          {
            align: "center",
            justify: "center",
            vertical: !0,
            gap: n.marginMD,
            style: { height: "100%", padding: n.paddingLG },
            children: [
              /* @__PURE__ */ g(Fe, { description: "尚未打开书籍" }),
              /* @__PURE__ */ g(
                Ot,
                {
                  uriInput: Nn,
                  onUriInputChange: Ke,
                  onSubmit: () => {
                    nt();
                  },
                  submitting: $e,
                  failureMessage: R,
                  persistenceMode: a
                }
              ),
              t.phase !== "ready" ? /* @__PURE__ */ g(B.Text, { type: "secondary", role: "status", children: t.phase === "error" ? `命令通道异常（${t.errorCode ?? "未知错误"}）：阅读命令暂不可用，界面按钮仍可直接操作。` : "命令注册中" }) : null
            ]
          }
        ) : /* @__PURE__ */ U(Xn, { children: [
          /* @__PURE__ */ g(
            "iframe",
            {
              ref: Je,
              title: "书籍内容",
              style: { width: "100%", height: "100%", border: "none", background: "transparent" }
            }
          ),
          ko ? /* @__PURE__ */ g(
            "div",
            {
              role: "status",
              style: {
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none"
              },
              children: /* @__PURE__ */ g(Kt, {})
            }
          ) : null,
          bn === null ? null : /* @__PURE__ */ g(
            "div",
            {
              style: { position: "absolute", insetInline: 0, top: 0, padding: n.paddingSM },
              children: /* @__PURE__ */ g(
                Jn,
                {
                  type: "error",
                  showIcon: !0,
                  role: "alert",
                  message: bn,
                  style: { background: n.colorBgContainer }
                }
              )
            }
          ),
          D === "source" || R === null ? null : /* @__PURE__ */ g(
            "div",
            {
              style: { position: "absolute", insetInline: 0, top: 0, padding: n.paddingSM },
              children: /* @__PURE__ */ g(
                Jn,
                {
                  type: "error",
                  showIcon: !0,
                  role: "alert",
                  closable: !0,
                  onClose: () => p(null),
                  message: R,
                  style: { background: n.colorBgContainer }
                }
              )
            }
          )
        ] }) }),
        /* @__PURE__ */ U(
          dn,
          {
            align: "center",
            gap: n.marginSM,
            style: {
              paddingInline: n.paddingSM,
              paddingBlock: n.paddingXS,
              borderTop: `1px solid ${d.border}`
            },
            children: [
              /* @__PURE__ */ g(B.Text, { type: "secondary", style: { whiteSpace: "nowrap" }, children: k ? P?.readingMode === "paginated" && P.totalPages > 0 ? `${P.currentPage}/${P.totalPages} 页` : `${f + 1}/${Math.max(1, Ln)} 章` : "未打开书籍" }),
              /* @__PURE__ */ g(
                $t,
                {
                  style: { flex: 1, margin: 0 },
                  min: 0,
                  max: 100,
                  value: dt,
                  disabled: k === null,
                  "aria-label": "全书进度",
                  tooltip: { formatter: (m) => `全书进度 ${m}%` },
                  onChange: (m) => Ro(m / 100)
                }
              ),
              /* @__PURE__ */ g(Te, { size: 0, children: /* @__PURE__ */ U(B.Text, { type: "secondary", style: { whiteSpace: "nowrap" }, children: [
                "全书进度 ",
                dt,
                "%"
              ] }) })
            ]
          }
        ),
        /* @__PURE__ */ g(
          Mn,
          {
            title: tn.contents,
            open: k !== null && D === "contents",
            onClose: () => M(null),
            children: k === null ? null : /* @__PURE__ */ g(
              cl,
              {
                toc: k.publication.toc,
                activeSectionPath: un?.path ?? null,
                sectionIndexByPath: Xe,
                onSelect: lt
              }
            )
          }
        ),
        /* @__PURE__ */ g(
          Mn,
          {
            title: tn.bookmarks,
            open: k !== null && D === "bookmarks",
            onClose: () => M(null),
            children: /* @__PURE__ */ g(
              dl,
              {
                bookmarks: at,
                currentBookmarkId: rt?.id ?? null,
                onJump: vo,
                onRemove: (m) => {
                  le(m), e.info("已移除书签");
                }
              }
            )
          }
        ),
        /* @__PURE__ */ g(
          Mn,
          {
            title: tn.search,
            open: k !== null && D === "search",
            onClose: () => M(null),
            children: /* @__PURE__ */ g(
              ul,
              {
                query: qe,
                onQueryChange: yo,
                isSearching: So,
                progress: bo,
                results: ie,
                onSelectResult: wo
              }
            )
          }
        ),
        /* @__PURE__ */ g(
          Mn,
          {
            title: tn.preferences,
            open: D === "preferences",
            onClose: () => M(null),
            children: /* @__PURE__ */ g(
              hl,
              {
                preferences: i,
                persistenceMode: a,
                onChange: s,
                onReset: l
              }
            )
          }
        ),
        /* @__PURE__ */ g(
          Mn,
          {
            title: tn.source,
            open: D === "source",
            onClose: () => M(null),
            children: /* @__PURE__ */ g(
              Ot,
              {
                uriInput: Nn,
                onUriInputChange: Ke,
                onSubmit: () => {
                  nt();
                },
                submitting: $e,
                failureMessage: R,
                persistenceMode: a
              }
            )
          }
        )
      ]
    }
  );
}, Sl = "chips.official.book-reader", kl = () => /* @__PURE__ */ g(Do, { appId: Sl, surface: "window", children: /* @__PURE__ */ g(Oo, { children: /* @__PURE__ */ g(Yt, { children: /* @__PURE__ */ g(yl, {}) }) }) });
export {
  kl as AppView,
  kl as default
};
