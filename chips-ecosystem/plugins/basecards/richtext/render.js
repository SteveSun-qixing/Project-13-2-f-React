import { jsxs as T, jsx as s } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { flushSync as M } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as N } from "chips-resource://platform/vendor/react-dom-client.js";
import h from "chips-resource://platform/vendor/react.js";
import { theme as D, Form as p, Input as y } from "chips-resource://platform/vendor/chips-ui.js";
function C(t) {
  if (typeof t != "string")
    return "";
  const e = t.replace(/\\/g, "/").trim();
  if (!e || /^[a-z][a-z0-9+.-]*:/i.test(e) || e.startsWith("//") || e.startsWith("/"))
    return "";
  const n = e.replace(/^\.?\//, "");
  if (n.startsWith("/") || n.includes("?") || n.includes("#"))
    return "";
  const r = n.split("/").filter(Boolean);
  return r.length === 0 || r.some((i) => i === "." || i === "..") ? "" : r.join("/");
}
function H(t) {
  return typeof t == "string" && t.trim().length > 0;
}
function v(t) {
  return H(t) && C(t).length > 0;
}
function B(t) {
  return v(t) ? C(t).toLowerCase().endsWith(".md") : !1;
}
function W(t) {
  return H(t) ? v(t) ? "resource" : "external" : "empty";
}
const b = Object.freeze({
  target: "_blank",
  rel: "noopener noreferrer"
}), G = "data-chips-resource-path", E = "markdown", x = 200;
function A(t) {
  return t.replace(/\r\n?/g, `
`).replace(/\u00a0/g, " ").replace(/[\t ]+$/gm, "").replace(/^\n+/, "").replace(/\n{3,}/g, `

`).trimEnd();
}
function V(t) {
  return Array.from(t).length;
}
function X(t) {
  const e = A(t);
  return e ? e.replace(/\$\$([\s\S]*?)\$\$/g, "$1").replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, "$1").replace(/```[\s\S]*?```/g, (n) => n.replace(/```/g, "")).replace(/`([^`]+)`/g, "$1").replace(/!\[([^\]]*)]\(([^)]+)\)/g, "$1").replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1").replace(/^\s{0,3}#{1,6}\s+/gm, "").replace(/^\s{0,3}>\s?/gm, "").replace(/^\s{0,3}(?:[-*+] |\d+\. )/gm, "").replace(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gm, " ").replace(/~~([^~]+)~~/g, "$1").replace(/==([^=]+)==/g, "$1").replace(/\+\+([^+]+)\+\+/g, "$1").replace(/\^([^^]+)\^/g, "$1").replace(/~([^~]+)~/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/_([^_]+)_/g, "$1").replace(/\\([\\`*{}[\]()#+.!_>~|])/g, "$1").replace(/<[^>]+>/g, " ").replace(/\n+/g, " ").replace(/\s+/g, " ").trim() : "";
}
function F(t) {
  return V(X(t));
}
function Y(t) {
  if (F(t) > 0)
    return !0;
  const e = A(t);
  return e ? /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/m.test(e) : !1;
}
function q(t) {
  return t > x;
}
function K(t) {
  return B(typeof t == "string" ? t : void 0) ? C(t) : "";
}
const $ = "base.richtext", k = { fontSize: 16, lineHeight: 1.6 }, L = 12, P = 48, O = 1, w = {
  commonmark: !0,
  gfm: !0,
  math: !0,
  highlight: !0,
  underline: !0,
  superscript: !0,
  subscript: !0
}, Z = "zh-CN";
function z(t) {
  return typeof t == "string" ? t.trim() : void 0;
}
function J(t) {
  const e = z(t.content_source);
  return e === "file" ? "file" : e === "inline" ? "inline" : H(t.content_file) ? "file" : "inline";
}
function Q(t) {
  const e = typeof t == "object" && t !== null ? t : {}, n = {};
  for (const r of Object.keys(w))
    n[r] = e[r] === !1 ? !1 : w[r];
  return n;
}
function _(t) {
  const e = typeof t == "object" && t !== null ? t : {}, n = J(e), r = z(e.locale) ?? Z, i = Q(e.markdown_capabilities);
  if (n === "file")
    return {
      card_type: $,
      content_format: E,
      content_source: "file",
      content_file: K(z(e.content_file) ?? ""),
      locale: r,
      markdown_capabilities: i
    };
  const o = e.content_text, a = A(
    typeof o == "string" ? o : typeof e.markdown == "string" ? e.markdown : ""
  );
  return {
    card_type: $,
    content_format: E,
    content_source: "inline",
    content_text: a,
    locale: r,
    markdown_capabilities: i
  };
}
function I(t) {
  return typeof t == "number" && Number.isFinite(t) ? t : void 0;
}
function U(t) {
  const e = typeof t == "object" && t !== null ? t : {}, n = typeof e.config == "object" && e.config !== null ? e.config : {}, r = I(n.fontSize), i = I(n.lineHeight);
  return {
    fontSize: r !== void 0 && Number.isInteger(r) && r >= L && r <= P ? r : k.fontSize,
    lineHeight: i !== void 0 && i >= O ? i : k.lineHeight
  };
}
function ee(t, e) {
  const n = _({
    ...t,
    markdown_capabilities: t.markdown_capabilities ?? w
  }), r = {
    card_type: n.card_type,
    content_format: n.content_format,
    content_source: n.content_source,
    locale: n.locale,
    markdown_capabilities: { ...n.markdown_capabilities },
    config: { ...e ?? k }
  };
  return n.content_source === "file" ? r.content_file = n.content_file ?? "" : r.content_text = n.content_text ?? "", r;
}
function te(t) {
  const e = F(t);
  return { length: e, shouldUseFile: q(e) };
}
class j extends Error {
  constructor() {
    super("富文本渲染通道未接入：等待平台插件执行通道交付"), this.name = "MarkdownRenderingUnavailableError";
  }
}
async function ne(t) {
  throw new j();
}
const re = [
  "commonmark",
  "gfm",
  "math",
  "highlight",
  "underline",
  "superscript",
  "subscript"
], ie = Object.freeze({
  commonmark: !0,
  gfm: !0,
  math: !1,
  highlight: !1,
  underline: !1,
  superscript: !1,
  subscript: !1
}), oe = Object.freeze({
  commonmark: "基础语法",
  gfm: "GFM 扩展",
  math: "数学公式",
  highlight: "高亮标记",
  underline: "下划线",
  superscript: "上标",
  subscript: "下标"
});
function se(t) {
  return re.filter(
    (e) => t[e] === !0 && ie[e] === !1
  );
}
function ce(t) {
  return t.length === 0 ? "" : `以下扩展语法当前按纯文本呈现：${t.map((n) => oe[n]).join("、")}`;
}
const le = "chips-richtext-card__surface";
function ae(t) {
  for (const e of Array.from(t.querySelectorAll("a[href]"))) {
    const n = W(e.getAttribute("href") ?? void 0);
    if (n === "external") {
      e.setAttribute("target", b.target), e.setAttribute("rel", b.rel);
      continue;
    }
    n === "resource" && (e.setAttribute("rel", b.rel), e.setAttribute(G, e.getAttribute("href") ?? ""));
  }
}
function ue({ content: t }) {
  const { token: e } = D.useToken(), n = _(t), r = U(t), i = ce(se(n.markdown_capabilities)), [o, a] = h.useState(null), [d, c] = h.useState({ kind: "loading", message: "正在渲染富文本内容…" });
  h.useEffect(() => {
    let l = !1;
    if (a(null), c({ kind: "loading", message: "正在渲染富文本内容…" }), n.content_source === "file") {
      c({ kind: "error", message: "文件内容读取通道未接入：文件来源正文暂无法在此呈现" });
      return;
    }
    if ((n.content_text ?? "").length === 0) {
      c({ kind: "error", message: "此卡片还没有正文内容" });
      return;
    }
    return ne().then((u) => {
      l || (a(u), c({ kind: "loading", message: "" }));
    }).catch((u) => {
      if (l)
        return;
      const g = u instanceof j ? "渲染通道未接入：富文本渲染服务尚未与本环境接线" : "内容暂时无法渲染，请稍后重试";
      c({ kind: "error", message: g });
    }), () => {
      l = !0;
    };
  }, [n.content_source, n.content_text]);
  const S = h.useCallback(
    (l) => {
      l !== null && o !== null && ae(l);
    },
    [o]
  );
  return /* @__PURE__ */ T("div", { "data-card-type": "base.richtext", "data-content-source": n.content_source, children: [
    o !== null ? /* @__PURE__ */ s(
      "div",
      {
        ref: S,
        className: le,
        lang: n.locale,
        style: {
          color: e.colorText,
          fontSize: r.fontSize,
          lineHeight: String(r.lineHeight),
          overflowWrap: "anywhere"
        },
        dangerouslySetInnerHTML: { __html: o }
      }
    ) : null,
    d.message.length > 0 ? /* @__PURE__ */ s(
      "p",
      {
        role: "status",
        style: {
          margin: 0,
          padding: `${e.paddingXS}px 0`,
          color: d.kind === "error" ? e.colorError : e.colorTextSecondary,
          fontSize: e.fontSizeSM
        },
        children: d.message
      }
    ) : null,
    o !== null && i.length > 0 ? /* @__PURE__ */ s(
      "p",
      {
        style: {
          margin: 0,
          padding: `${e.paddingXS}px 0 0`,
          color: e.colorTextSecondary,
          fontSize: e.fontSizeSM
        },
        children: i
      }
    ) : null
  ] });
}
function R(t, e) {
  if (t === "" || t === void 0 || t === null)
    return e;
  const n = typeof t == "number" ? t : Number(t);
  return Number.isFinite(n) && n > 0 ? n : e;
}
function de({
  content: t,
  contentSource: e,
  onDraftChange: n
}) {
  const { token: r } = D.useToken(), i = _(t), o = U(t), [a, d] = h.useState(i.content_text ?? ""), c = te(a), S = (l, f) => {
    const u = typeof f.contentText == "string" ? f.contentText : "", g = {
      fontSize: R(f.fontSize, o.fontSize),
      lineHeight: R(f.lineHeight, o.lineHeight)
    };
    d(u), n({
      contentText: u,
      fontSize: g.fontSize,
      lineHeight: g.lineHeight
    });
  };
  return /* @__PURE__ */ s(
    "div",
    {
      style: {
        width: "100%",
        minHeight: 0,
        overflow: "auto",
        padding: r.paddingSM,
        boxSizing: "border-box"
      },
      children: /* @__PURE__ */ T(
        p,
        {
          layout: "vertical",
          initialValues: {
            contentText: i.content_text ?? "",
            fontSize: o.fontSize,
            lineHeight: o.lineHeight
          },
          onValuesChange: S,
          children: [
            e === "file" ? /* @__PURE__ */ T(
              "p",
              {
                role: "status",
                style: {
                  margin: 0,
                  marginBottom: r.marginSM,
                  color: r.colorTextSecondary,
                  fontSize: r.fontSizeSM
                },
                children: [
                  "文件来源正文（",
                  i.content_file,
                  "）读取通道未接入，当前仅可调整展示配置"
                ]
              }
            ) : null,
            e === "inline" ? /* @__PURE__ */ s(
              p.Item,
              {
                label: "正文（Markdown）",
                name: "contentText",
                extra: c.shouldUseFile ? `已提取纯文本 ${String(c.length)} 字，超过 ${String(x)} 字阈值，保存时正文将文件化存储为卡片内 .md 文件` : `已提取纯文本 ${String(c.length)} 字（≤${String(x)} 字阈值内内联保存）`,
                children: /* @__PURE__ */ s(y.TextArea, { autoSize: { minRows: 6 } })
              }
            ) : null,
            /* @__PURE__ */ s(p.Item, { label: "字号（px）", name: "fontSize", children: /* @__PURE__ */ s(y, { type: "number", min: L, max: P }) }),
            /* @__PURE__ */ s(p.Item, { label: "行高倍数", name: "lineHeight", children: /* @__PURE__ */ s(y, { type: "number", min: O, step: 0.1 }) })
          ]
        }
      )
    }
  );
}
function fe(t, e, n) {
  return e === "inline" ? Y(n.contentText) ? {
    kind: "replace",
    content: ee({ ...t, content_text: n.contentText }, {
      fontSize: n.fontSize,
      lineHeight: n.lineHeight
    })
  } : null : {
    kind: "patch",
    operations: [
      { op: "replace", path: "/config/fontSize", value: n.fontSize },
      { op: "replace", path: "/config/lineHeight", value: n.lineHeight }
    ]
  };
}
const m = /* @__PURE__ */ new WeakMap();
function he(t, e) {
  m.get(e)?.(), e.replaceChildren();
  const n = N(e);
  M(() => {
    n.render(/* @__PURE__ */ s(ue, { content: t.content }));
  });
  let r = !1;
  const i = () => {
    r || (r = !0, n.unmount(), m.get(e) === i && m.delete(e));
  };
  return m.set(e, i), i;
}
class ge {
  state = "active";
  contentSource;
  base;
  revision;
  pending = null;
  dirty = !1;
  host;
  root;
  changeHandlers = /* @__PURE__ */ new Set();
  dirtyHandlers = /* @__PURE__ */ new Set();
  constructor(e, n) {
    this.base = { ...e.content }, this.contentSource = _(e.content).content_source, this.revision = e.revision, this.host = n, n.replaceChildren(), this.root = N(n), this.mount();
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
    const n = this.pending;
    this.revision = e, n !== null && n.kind === "replace" && (this.base = { ...n.content }), this.pending === n && (this.pending = null, this.setDirty(!1));
  }
  update(e, n) {
    this.state === "disposed" || n <= this.revision || (this.revision = n, this.base = { ...e.content }, this.pending = null, this.setDirty(!1), this.mount());
  }
  subscribe(e, n) {
    if (this.state === "disposed")
      return { dispose: () => {
      } };
    if (e === "change") {
      const i = n;
      return this.changeHandlers.add(i), {
        dispose: () => {
          this.changeHandlers.delete(i);
        }
      };
    }
    const r = n;
    return this.dirtyHandlers.add(r), {
      dispose: () => {
        this.dirtyHandlers.delete(r);
      }
    };
  }
  focus() {
    this.state === "active" && this.host.querySelector("textarea")?.focus();
  }
  dispose() {
    this.state !== "disposed" && (this.root.unmount(), this.changeHandlers.clear(), this.dirtyHandlers.clear(), this.pending = null, this.dirty = !1, this.state = "disposed");
  }
  mount() {
    M(() => {
      this.root.render(
        /* @__PURE__ */ s(
          de,
          {
            content: this.base,
            contentSource: this.contentSource,
            onDraftChange: this.handleDraftChange
          },
          this.revision
        )
      );
    });
  }
  handleDraftChange = (e) => {
    if (this.state !== "active")
      return;
    const n = fe(this.base, this.contentSource, e);
    if (n === null)
      return;
    const r = this.pending !== null;
    this.pending = n, r || this.setDirty(!0);
    for (const i of this.changeHandlers)
      i({ change: n });
  };
  setDirty(e) {
    if (this.dirty !== e) {
      this.dirty = e;
      for (const n of this.dirtyHandlers)
        n({ isDirty: e });
    }
  }
}
function pe(t, e) {
  return new ge(t, e);
}
const Te = {
  renderView: he,
  renderEditor: pe
};
export {
  Te as default,
  pe as renderEditor,
  Te as renderPlugin,
  he as renderView
};
