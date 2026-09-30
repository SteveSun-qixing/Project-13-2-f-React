import { jsx as r, jsxs as m, Fragment as B } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { flushSync as U } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as G } from "chips-resource://platform/vendor/react-dom-client.js";
import V, { useState as te, useRef as ie } from "chips-resource://platform/vendor/react.js";
import { theme as E, Empty as ne, ReadOutlined as X, Tag as q, Segmented as H, Input as S, Button as D } from "chips-resource://platform/vendor/chips-ui.js";
class k extends Error {
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
    return new k({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function oe(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const re = "SDK_BRIDGE_UNAVAILABLE", K = "SDK_UNKNOWN_ERROR", P = "发生未知错误";
function ae(t) {
  return t instanceof Error;
}
function se(t) {
  if (t instanceof k)
    return t;
  if (oe(t)) {
    const e = t, i = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new k(i);
  }
  return ae(t) ? new k({
    code: K,
    message: P,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new k({
    code: K,
    message: P,
    details: { value: String(t) },
    retryable: !1
  });
}
function le() {
  return new k({
    code: re,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function f(t, e, i) {
  let n;
  try {
    n = t();
  } catch (o) {
    return Promise.reject(se(o));
  }
  return n.request(e, i);
}
const ce = "cli.command.list", de = "cli.command.get", ue = "cli.command.resolve";
function me(t) {
  return {
    list(e) {
      return f(t, ce, e ?? {});
    },
    get(e) {
      return f(t, de, e);
    },
    resolve(e) {
      return f(t, ue, e);
    }
  };
}
const I = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, pe = "cli.task.create", fe = "cli.task.bindInvocation", he = "cli.task.cancel";
function ge(t) {
  return {
    create(e) {
      return f(t, pe, e).then((i) => i.task);
    },
    bindInvocation(e) {
      return f(t, fe, e).then((i) => i.task);
    },
    get(e) {
      const i = { taskId: e };
      return f(t, I.CLI_TASK_GET, i).then((n) => n.task);
    },
    active(e) {
      const i = { commandId: e };
      return f(t, I.CLI_TASK_ACTIVE, i).then((n) => n.task);
    },
    progress(e, i) {
      const n = { taskId: e, progress: i };
      return f(t, I.CLI_TASK_PROGRESS, n).then((o) => o.task);
    },
    complete(e, i) {
      const n = {
        taskId: e,
        ...i === void 0 ? {} : { output: i }
      };
      return f(t, I.CLI_TASK_COMPLETE, n).then((o) => o.task);
    },
    fail(e, i) {
      const n = { taskId: e, error: i };
      return f(t, I.CLI_TASK_FAIL, n).then((o) => o.task);
    },
    cancel(e) {
      return f(t, he, { taskId: e }).then((i) => i.task);
    }
  };
}
function be() {
  return globalThis.window?.chips;
}
class ye {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = me(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = ge(() => this.#e());
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
    const e = be();
    if (e === void 0)
      throw le();
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
    return f(() => this.#e(), e, i);
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
function _e(t) {
  return new ye(t?.bridge);
}
const ke = _e(), $ = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", ve = [
  "epub",
  "epub3",
  "pdf",
  "txt",
  "md",
  "markdown",
  "mobi",
  "azw",
  "azw3",
  "fb2",
  "djvu",
  "djv",
  "rtf",
  "doc",
  "docx"
], Se = ["zip", "cbz"], Ce = {
  epub: "application/epub+zip",
  epub3: "application/epub+zip",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  mobi: "application/x-mobipocket-ebook",
  azw: "application/vnd.amazon.ebook",
  azw3: "application/vnd.amazon.ebook",
  fb2: "application/x-fictionbook+xml",
  djvu: "image/vnd.djvu",
  djv: "image/vnd.djvu",
  rtf: "application/rtf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}, Te = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  avif: "image/avif",
  svg: "image/svg+xml",
  tiff: "image/tiff",
  tif: "image/tiff"
};
function N(t) {
  return typeof t == "string" && t.trim().length > 0;
}
function Ee(t, e = 10) {
  let i = "";
  for (let n = 0; n < e; n += 1)
    i += $[Math.floor(Math.random() * $.length)];
  return `${t}-${i}`;
}
function v(t) {
  if (!N(t))
    return;
  const e = t.trim();
  if (!e || e.includes("\\") || e.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(e))
    return;
  const i = e.replace(/^\.\//, "");
  if (!i)
    return;
  const n = i.split("/").filter(Boolean);
  if (!(n.length === 0 || n.some((o) => o === "." || o === "..")))
    return n.join("/");
}
function A(t) {
  const e = v(t);
  if (!e)
    return "";
  const i = e.split("/");
  return i[i.length - 1] ?? "";
}
function we(t) {
  return t.replace(/\.[^.]+$/u, "");
}
function Z(t) {
  return /\.([^.]+)$/u.exec(A(t))?.[1]?.toLowerCase() ?? "";
}
function w(t) {
  const e = typeof t == "string" ? t.trim().toLowerCase().replace(/^\./, "") : "";
  return e === "epub3" ? "epub3" : e === "markdown" ? "md" : e;
}
function xe(t) {
  return w(Z(t));
}
function Ie(t) {
  return ve.includes(
    w(t)
  );
}
function Ae(t) {
  return Se.includes(w(t));
}
function Re(t) {
  const e = w(
    t.includes(".") ? xe(t) : t
  );
  return Ce[e];
}
function ze(t) {
  return Te[Z(t)];
}
function Be(t, e) {
  return t.localeCompare(e, void 0, {
    numeric: !0,
    sensitivity: "base"
  });
}
function L(t, e) {
  const i = t.map((o, c) => ({ image: o, index: c })), n = new Set(
    i.map(({ image: o }) => o.entry_time).filter((o) => typeof o == "number" && Number.isFinite(o))
  ).size > 1;
  return i.sort((o, c) => {
    if (e === "entry-time" && n) {
      const l = o.image.entry_time, d = c.image.entry_time;
      if (typeof l == "number" && typeof d == "number" && l !== d)
        return l - d;
      if (typeof l == "number" && typeof d != "number")
        return -1;
      if (typeof l != "number" && typeof d == "number")
        return 1;
    }
    const s = Be(
      o.image.source_entry_path || o.image.file_name,
      c.image.source_entry_path || c.image.file_name
    );
    return s === 0 ? o.index - c.index : s;
  }), i.map(({ image: o }) => o);
}
const M = "base.book";
function C(t) {
  return typeof t == "string" ? t.trim() : "";
}
function Le(t) {
  return typeof t == "number" && Number.isFinite(t) ? t : void 0;
}
function Me(t, e) {
  return t === "image-sequence" ? "image-sequence" : t === "ebook" ? "ebook" : e > 0 ? "image-sequence" : "ebook";
}
function Oe(t) {
  return t === "entry-time" ? "entry-time" : "filename";
}
function qe(t, e) {
  const i = t !== null && typeof t == "object" ? t : {}, n = v(i.file_path) ?? "", o = typeof i.id == "string" || typeof i.file_name == "string" || typeof i.source_entry_path == "string" || typeof i.entry_time == "number";
  return !n && !o ? null : {
    id: C(i.id) || `book-image-${e + 1}`,
    file_path: n,
    file_name: C(i.file_name) || A(n) || `image-${e + 1}`,
    mime_type: C(i.mime_type),
    source_entry_path: C(i.source_entry_path),
    entry_time: Le(i.entry_time)
  };
}
function T(t) {
  const e = typeof t == "object" && t !== null ? t : {}, i = Array.isArray(e.image_sequence) ? e.image_sequence.map((n, o) => qe(n, o)).filter((n) => n !== null) : [];
  return {
    source_type: Me(e.source_type, i.length),
    book_file: v(e.book_file) ?? "",
    book_format: w(e.book_format),
    book_name: C(e.book_name),
    book_author: C(e.book_author),
    cover_image: v(e.cover_image) ?? "",
    image_sequence: i,
    image_sort_basis: Oe(e.image_sort_basis)
  };
}
function Ne(t) {
  return t === void 0 ? !0 : typeof t != "string" ? !1 : t.trim().length === 0 ? !0 : v(t) !== void 0;
}
function Fe(t) {
  if (t == null)
    return !0;
  if (typeof t != "object" || Array.isArray(t))
    return !1;
  const e = t, i = e.source_type;
  if (i !== void 0 && i !== "ebook" && i !== "image-sequence")
    return !1;
  const n = e.image_sort_basis;
  if (n !== void 0 && n !== "filename" && n !== "entry-time")
    return !1;
  for (const u of ["book_file", "cover_image"])
    if (!Ne(e[u]))
      return !1;
  for (const u of ["book_format", "book_name", "book_author"])
    if (e[u] !== void 0 && typeof e[u] != "string")
      return !1;
  const o = e.book_format;
  if (typeof o == "string" && o.trim().length > 0) {
    const u = w(o);
    if (!Ie(u) && !Ae(u))
      return !1;
  }
  const c = e.book_file, s = typeof c == "string" && c.trim().length > 0;
  if (i === "ebook" && s && !(typeof o == "string" && o.trim().length > 0))
    return !1;
  const l = e.image_sequence;
  let d = 0;
  if (l !== void 0) {
    if (!Array.isArray(l))
      return !1;
    for (const u of l) {
      if (u === null || typeof u != "object" || Array.isArray(u))
        return !1;
      const h = u;
      for (const g of ["id", "file_name", "mime_type", "source_entry_path"])
        if (h[g] !== void 0 && typeof h[g] != "string")
          return !1;
      const b = h.entry_time;
      if (b !== void 0 && (typeof b != "number" || !Number.isFinite(b)))
        return !1;
      const y = h.file_path;
      if (y === void 0 || typeof y != "string" || v(y) === void 0)
        return !1;
      d += 1;
    }
  }
  return !(i === "image-sequence" && d === 0 && s);
}
function F(t) {
  if (N(t.book_name))
    return t.book_name.trim();
  const e = A(t.book_file);
  return e ? we(e) : "";
}
function Q(t) {
  return N(t.book_author) ? t.book_author.trim() : "";
}
function je(t) {
  return t.source_type === "image-sequence" ? t.book_format === "cbz" ? "CBZ" : "ZIP" : t.book_format ? t.book_format.toUpperCase() : "";
}
function W(t, e) {
  const i = v(t);
  if (!i)
    return null;
  const n = A(i), o = e || void 0;
  return {
    uri: i,
    relativePath: i,
    fileName: n,
    ...o === void 0 ? {} : { mimeType: o }
  };
}
function Y(t) {
  const e = F(t), i = Q(t);
  if (t.source_type === "image-sequence") {
    const c = L(t.image_sequence, t.image_sort_basis).map(
      (d) => W(d.file_path, d.mime_type || ze(d.file_path))
    ).filter((d) => d !== null), s = c[0];
    if (!s)
      return null;
    const l = {
      kind: "chips.book-card",
      version: "1.0.0",
      cardType: M,
      mode: "image-sequence",
      resources: { images: c },
      display: {
        title: e,
        ...i.length === 0 ? {} : { author: i }
      }
    };
    return {
      intent: "view",
      resource: {
        uri: s.uri,
        ...s.mimeType === void 0 ? {} : { mimeType: s.mimeType },
        ...s.fileName === void 0 ? {} : { fileName: s.fileName },
        title: e,
        payload: l
      }
    };
  }
  const n = W(
    t.book_file,
    Re(t.book_format || t.book_file)
  );
  if (!n)
    return null;
  const o = {
    kind: "chips.book-card",
    version: "1.0.0",
    cardType: M,
    mode: "ebook",
    resources: { book: n },
    display: {
      title: e,
      ...i.length === 0 ? {} : { author: i }
    }
  };
  return {
    intent: "view",
    resource: {
      uri: n.uri,
      ...n.mimeType === void 0 ? {} : { mimeType: n.mimeType },
      ...n.fileName === void 0 ? {} : { fileName: n.fileName },
      title: e,
      payload: o
    }
  };
}
const O = 168, He = "2 / 3", De = 184, J = 16, Ke = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="192" viewBox="0 0 128 192">',
    '<rect width="128" height="192" rx="8" fill="#f2f2f7"/>',
    '<g transform="translate(16 48) scale(0.1154)" fill="#6e6e73">',
    '<path d="M928 161H699.2c-49.1 0-97.1 14.1-138.4 40.7L512 233l-48.8-31.3A255.2 255.2 0 0 0 324.8 161H96c-17.7 0-32 14.3-32 32v568c0 17.7 14.3 32 32 32h228.8c49.1 0 97.1 14.1 138.4 40.7l44.4 28.6c1.3.8 2.8 1.3 4.3 1.3s3-.4 4.3-1.3l44.4-28.6C602 807.1 650.1 793 699.2 793H928c17.7 0 32-14.3 32-32V193c0-17.7-14.3-32-32-32zM324.8 721H136V233h188.8c35.4 0 69.8 10.1 99.5 29.2l48.8 31.3 6.9 4.5v462c-47.6-25.6-100.8-39-155.2-39zm563.2 0H699.2c-54.4 0-107.6 13.4-155.2 39V298l6.9-4.5 48.8-31.3c29.7-19.1 64.1-29.2 99.5-29.2H888v488zM396.9 361H211.1c-3.9 0-7.1 3.4-7.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c.1-4.1-3.1-7.5-7-7.5zm223.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c0-4.1-3.2-7.5-7.1-7.5H627.1c-3.9 0-7.1 3.4-7.1 7.5zM396.9 501H211.1c-3.9 0-7.1 3.4-7.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c.1-4.1-3.1-7.5-7-7.5zm416 0H627.1c-3.9 0-7.1 3.4-7.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c.1-4.1-3.1-7.5-7-7.5z"/>',
    "</g>",
    "</svg>"
  ].join("")
);
function Pe({ coverReference: t, title: e }) {
  const [i, n] = V.useState(!1), { token: o } = E.useToken();
  return t ? i ? /* @__PURE__ */ r(
    "img",
    {
      "data-role": "book-cover-fallback",
      src: Ke,
      alt: "",
      "aria-hidden": "true",
      draggable: !1,
      style: {
        display: "block",
        margin: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover"
      }
    }
  ) : /* @__PURE__ */ r(
    "img",
    {
      "data-role": "book-cover",
      src: t,
      alt: e,
      draggable: !1,
      loading: "lazy",
      onError: () => {
        n(!0);
      },
      style: {
        display: "block",
        margin: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover"
      }
    }
  ) : /* @__PURE__ */ r(
    "span",
    {
      "data-role": "book-cover-placeholder",
      "aria-hidden": "true",
      style: {
        display: "grid",
        placeItems: "center",
        width: "100%",
        height: "100%",
        color: o.colorTextSecondary,
        background: o.colorFillQuaternary
      },
      children: /* @__PURE__ */ r(X, { style: { fontSize: 42 }, "aria-hidden": "true" })
    }
  );
}
function $e(t) {
  return t.source_type === "image-sequence" ? L(t.image_sequence, t.image_sort_basis).some(
    (e) => e.file_path.length > 0
  ) : t.book_file.length > 0;
}
function We({ config: t, onOpen: e, outcome: i }) {
  const { token: n } = E.useToken(), o = F(t) || "未命名书籍", c = Q(t) || "未知作者", l = Y(t) !== null, d = t.cover_image.length > 0 ? t.cover_image : L(t.image_sequence, t.image_sort_basis).find(
    (g) => g.file_path.length > 0
  )?.file_path ?? "", u = je(t), h = t.source_type === "image-sequence" ? L(t.image_sequence, t.image_sort_basis).filter(
    (g) => g.file_path.length > 0
  ).length : 0, b = /* @__PURE__ */ m(B, { children: [
    /* @__PURE__ */ r(
      "span",
      {
        "aria-hidden": "true",
        style: {
          display: "block",
          flex: `0 0 ${O * (2 / 3)}px`,
          width: O * (2 / 3),
          height: O,
          minWidth: 96,
          aspectRatio: He,
          borderRadius: n.borderRadius,
          overflow: "hidden",
          alignSelf: "center",
          background: n.colorBgContainer,
          boxShadow: n.boxShadowTertiary
        },
        children: /* @__PURE__ */ r(Pe, { coverReference: d, title: o })
      }
    ),
    /* @__PURE__ */ m(
      "span",
      {
        style: {
          display: "grid",
          gap: n.marginXS,
          alignContent: "center",
          flex: "1 1 auto",
          minWidth: 0,
          padding: `${n.paddingXXS}px 0`
        },
        children: [
          /* @__PURE__ */ r(
            "span",
            {
              style: {
                margin: 0,
                color: n.colorText,
                fontSize: 20,
                fontWeight: 700,
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
                fontSize: n.fontSize,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              },
              children: c
            }
          ),
          u || h > 0 ? /* @__PURE__ */ m("span", { style: { display: "flex", flexWrap: "wrap", gap: n.marginXXS, marginTop: n.marginXXS }, children: [
            u ? /* @__PURE__ */ r(q, { style: { marginInlineEnd: 0 }, children: u }) : null,
            h > 0 ? /* @__PURE__ */ m(q, { style: { marginInlineEnd: 0 }, children: [
              h,
              " 张图片"
            ] }) : null
          ] }) : null
        ]
      }
    )
  ] }), y = {
    display: "flex",
    alignItems: "stretch",
    justifyContent: "flex-start",
    gap: n.marginLG,
    width: "100%",
    minHeight: De,
    padding: n.paddingLG,
    boxSizing: "border-box",
    borderRadius: J,
    border: `1px ${l ? "solid" : "dashed"} ${n.colorBorderSecondary}`,
    background: n.colorFillQuaternary,
    textAlign: "left"
  };
  return /* @__PURE__ */ m("div", { style: { width: "100%", minWidth: 0 }, children: [
    l ? /* @__PURE__ */ r(
      "button",
      {
        type: "button",
        "data-role": "book-open",
        "aria-label": `打开《${o}》`,
        onClick: e,
        style: {
          cursor: "pointer",
          font: "inherit",
          color: "inherit",
          appearance: "none",
          ...y
        },
        children: b
      }
    ) : /* @__PURE__ */ r("div", { role: "group", "aria-label": "书籍资源缺失或非法，暂无法打开阅读器", style: y, children: b }),
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
function Ue({ config: t }) {
  const { token: e } = E.useToken(), i = T(t), [n, o] = V.useState({ state: "idle", message: null }), c = () => {
    const s = Y(i);
    s && (o({ state: "opening", message: "正在打开书籍…" }), ke.request("resource:open", s).then(() => {
      o({ state: "idle", message: null });
    }).catch(() => {
      o({
        state: "error",
        message: "书籍暂时无法打开：当前渲染环境未提供阅读通道，请稍后重试"
      });
    }));
  };
  return /* @__PURE__ */ r("div", { "data-card-type": M, children: $e(i) ? /* @__PURE__ */ r(We, { config: i, onOpen: c, outcome: n }) : /* @__PURE__ */ r(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: 116,
        boxSizing: "border-box",
        borderRadius: J,
        border: `1px dashed ${e.colorBorderSecondary}`,
        background: e.colorFillQuaternary
      },
      children: /* @__PURE__ */ r(
        ne,
        {
          image: /* @__PURE__ */ r(X, { "aria-hidden": "true" }),
          description: /* @__PURE__ */ m(B, { children: [
            /* @__PURE__ */ r("span", { style: { display: "block", fontWeight: 700 }, children: "未选择电子书" }),
            /* @__PURE__ */ r("span", { style: { display: "block", marginTop: 4, fontSize: 12 }, children: "资源尚不可用。" })
          ] })
        }
      )
    }
  ) });
}
function Ge(t) {
  return Fe(t) ? t.source_type === "image-sequence" ? t.image_sequence.some((e) => e.file_path.length > 0) : t.book_file.length > 0 : !1;
}
function _({
  label: t,
  hint: e,
  error: i,
  children: n
}) {
  const { token: o } = E.useToken();
  return /* @__PURE__ */ m(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: "minmax(96px, 160px) minmax(0, 1fr)",
        gap: o.marginSM,
        padding: `${o.paddingSM}px 0`,
        borderBottom: `1px solid ${o.colorBorderSecondary}`,
        alignItems: "start"
      },
      children: [
        /* @__PURE__ */ m("div", { style: { display: "grid", gap: 2, paddingTop: 5 }, children: [
          /* @__PURE__ */ r("span", { style: { color: o.colorText, fontSize: o.fontSizeSM, fontWeight: 600 }, children: t }),
          e ? /* @__PURE__ */ r("span", { style: { color: o.colorTextSecondary, fontSize: o.fontSizeSM }, children: e }) : null
        ] }),
        /* @__PURE__ */ m("div", { style: { display: "grid", gap: o.marginXXS, minWidth: 0 }, children: [
          n,
          i ? /* @__PURE__ */ r("span", { role: "alert", style: { color: o.colorError, fontSize: o.fontSizeSM }, children: i }) : null
        ] })
      ]
    }
  );
}
function R({ children: t }) {
  const { token: e } = E.useToken();
  return /* @__PURE__ */ r(
    "h3",
    {
      style: {
        margin: 0,
        padding: `${e.paddingXS}px 0`,
        color: e.colorText,
        fontSize: e.fontSize,
        fontWeight: 700
      },
      children: t
    }
  );
}
const Ve = "epub / epub3 / pdf / txt / md / mobi / azw / azw3 / fb2 / djvu / djv / rtf / doc / docx；图片包为 zip / cbz";
function Xe({ config: t, onChange: e }) {
  const { token: i } = E.useToken(), [n, o] = te(() => T(t)), c = ie(n), s = (a) => {
    const p = T({ ...c.current, ...a });
    c.current = p, o(p), e(p);
  }, l = (a) => (p) => {
    s({ [a]: p.currentTarget.value });
  }, d = (a) => {
    (a === "ebook" || a === "image-sequence") && s({ source_type: a });
  }, u = (a) => {
    (a === "filename" || a === "entry-time") && s({ image_sort_basis: a });
  }, h = () => {
    const a = {
      id: Ee("book-image"),
      file_path: "",
      file_name: "",
      mime_type: "",
      source_entry_path: ""
    };
    s({ image_sequence: [...n.image_sequence, a], source_type: "image-sequence" });
  }, b = (a, p) => {
    s({
      image_sequence: n.image_sequence.map((x) => {
        if (x.id !== a)
          return x;
        const j = p.file_path !== void 0 ? A(p.file_path) : void 0;
        return {
          ...x,
          ...p,
          ...j === void 0 ? {} : { file_name: j }
        };
      })
    });
  }, y = (a) => {
    s({ image_sequence: n.image_sequence.filter((p) => p.id !== a) });
  }, g = n.book_format.trim().length > 0 && !/^(epub3|pdf|txt|md|mobi|azw|azw3|fb2|djvu|djv|rtf|doc|docx|markdown|epub|zip|cbz)$/u.test(
    n.book_format.trim().toLowerCase()
  ), ee = F(n) || "未命名书籍";
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
      children: /* @__PURE__ */ m("section", { style: { display: "grid", gap: 0, maxWidth: 720, margin: "0 auto" }, children: [
        /* @__PURE__ */ r(R, { children: "来源形态" }),
        /* @__PURE__ */ r(_, { label: "内容来源", hint: "电子书文件交付阅读器，解包图片序列交付图片查看器", children: /* @__PURE__ */ r(
          H,
          {
            "data-role": "source-type-segmented",
            value: n.source_type,
            onChange: (a) => {
              d(String(a));
            },
            options: [
              { label: "电子书", value: "ebook" },
              { label: "图片序列", value: "image-sequence" }
            ]
          }
        ) }),
        n.source_type === "ebook" ? /* @__PURE__ */ m(B, { children: [
          /* @__PURE__ */ r(_, { label: "书籍文件", hint: "必填；卡片内相对路径，例如 books/demo.epub", children: /* @__PURE__ */ r(
            S,
            {
              "data-role": "book-path-input",
              value: n.book_file,
              placeholder: "books/demo.epub",
              onChange: l("book_file")
            }
          ) }),
          /* @__PURE__ */ r(
            _,
            {
              label: "书籍格式",
              hint: `必填；受支持格式：${Ve}`,
              error: g ? "book_format 必须为受支持的电子书或图片包格式" : void 0,
              children: /* @__PURE__ */ r(
                S,
                {
                  "data-role": "book-format-input",
                  value: n.book_format,
                  placeholder: "epub",
                  ...g ? { status: "error" } : {},
                  onChange: l("book_format")
                }
              )
            }
          )
        ] }) : /* @__PURE__ */ m(B, { children: [
          /* @__PURE__ */ m(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: i.marginXS,
                padding: `${i.paddingSM}px 0`
              },
              children: [
                /* @__PURE__ */ r(R, { children: "图片序列" }),
                /* @__PURE__ */ r(D, { "data-role": "add-image-item", onClick: h, children: "添加图片" })
              ]
            }
          ),
          n.image_sequence.length > 0 ? /* @__PURE__ */ r("div", { style: { display: "grid", gap: i.marginSM, paddingBottom: i.marginSM }, children: n.image_sequence.map((a, p) => /* @__PURE__ */ m(
            "div",
            {
              style: {
                display: "grid",
                gap: i.marginXS,
                padding: i.paddingSM,
                border: `1px solid ${i.colorBorderSecondary}`,
                borderRadius: i.borderRadiusLG
              },
              children: [
                /* @__PURE__ */ m("div", { style: { display: "flex", alignItems: "center", gap: i.marginXS }, children: [
                  /* @__PURE__ */ r(q, { color: "processing", children: a.file_name || `第 ${p + 1} 张` }),
                  /* @__PURE__ */ r("span", { style: { flex: "1 1 auto" } }),
                  /* @__PURE__ */ r(
                    D,
                    {
                      "data-role": `remove-image-item-${a.id}`,
                      size: "small",
                      onClick: () => {
                        y(a.id);
                      },
                      children: "删除图片"
                    }
                  )
                ] }),
                /* @__PURE__ */ r(_, { label: "图片路径", hint: "必填；卡片内相对路径，例如 comic/001.jpg", children: /* @__PURE__ */ r(
                  S,
                  {
                    "data-role": `image-path-input-${a.id}`,
                    value: a.file_path,
                    placeholder: "comic/001.jpg",
                    onChange: (x) => {
                      b(a.id, { file_path: x.currentTarget.value });
                    }
                  }
                ) })
              ]
            },
            a.id
          )) }) : /* @__PURE__ */ r(
            "p",
            {
              style: {
                margin: 0,
                paddingBottom: i.marginSM,
                color: i.colorTextSecondary,
                fontSize: i.fontSizeSM
              },
              children: "还没有图片条目，可以先添加一张图片。"
            }
          ),
          /* @__PURE__ */ r(_, { label: "排序依据", hint: "文件名按自然序，创建时间按导入条目时间", children: /* @__PURE__ */ r(
            H,
            {
              "data-role": "sort-basis-segmented",
              value: n.image_sort_basis,
              onChange: u,
              options: [
                { label: "文件名", value: "filename" },
                { label: "创建时间", value: "entry-time" }
              ]
            }
          ) })
        ] }),
        /* @__PURE__ */ r("div", { style: { paddingTop: i.paddingLG }, children: /* @__PURE__ */ r(R, { children: "封面" }) }),
        /* @__PURE__ */ r(_, { label: "封面图片", hint: "可选；卡片内相对路径，图片序列模式默认取序列首图", children: /* @__PURE__ */ r(
          S,
          {
            "data-role": "cover-path-input",
            value: n.cover_image,
            placeholder: "covers/demo.jpg",
            onChange: l("cover_image")
          }
        ) }),
        /* @__PURE__ */ r("div", { style: { paddingTop: i.paddingLG }, children: /* @__PURE__ */ r(R, { children: "书籍信息" }) }),
        /* @__PURE__ */ r(_, { label: "书籍名称", hint: `留空时查看态从文件名派生，当前展示：${ee}`, children: /* @__PURE__ */ r(
          S,
          {
            "data-role": "book-name-input",
            value: n.book_name,
            placeholder: "输入书籍名称",
            onChange: l("book_name")
          }
        ) }),
        /* @__PURE__ */ r(_, { label: "书籍作者", children: /* @__PURE__ */ r(
          S,
          {
            "data-role": "book-author-input",
            value: n.book_author,
            placeholder: "输入书籍作者",
            onChange: l("book_author")
          }
        ) })
      ] })
    }
  );
}
const z = /* @__PURE__ */ new WeakMap();
function Ze(t, e) {
  z.get(e)?.(), e.replaceChildren();
  const i = G(e);
  U(() => {
    i.render(/* @__PURE__ */ r(Ue, { config: t.content.config }));
  });
  let n = !1;
  const o = () => {
    n || (n = !0, i.unmount(), z.get(e) === o && z.delete(e));
  };
  return z.set(e, o), o;
}
function Qe(t) {
  return /* @__PURE__ */ r(Xe, { ...t });
}
class Ye {
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
    this.base = T(e.content.config), this.revision = e.revision, this.host = i, i.replaceChildren(), this.root = G(i), this.mount();
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
    this.revision = e, i !== null && i.kind === "replace" && (this.base = T(i.content.config)), this.pending === i && (this.pending = null, this.setDirty(!1));
  }
  update(e, i) {
    this.state === "disposed" || i <= this.revision || (this.revision = i, this.base = T(e.content.config), this.pending = null, this.setDirty(!1), this.mount());
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
    U(() => {
      this.root.render(
        /* @__PURE__ */ r(
          Qe,
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
    if (this.state !== "active" || !Ge(e))
      return;
    const i = {
      kind: "replace",
      content: {
        card_type: M,
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
function Je(t, e) {
  return new Ye(t, e);
}
const rt = {
  renderView: Ze,
  renderEditor: Je
};
export {
  rt as default,
  Je as renderEditor,
  rt as renderPlugin,
  Ze as renderView
};
