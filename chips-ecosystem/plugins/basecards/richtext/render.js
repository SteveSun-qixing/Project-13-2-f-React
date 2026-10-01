import { jsxs as rr, jsx as Te, Fragment as hm } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { flushSync as Uu } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as Ju } from "chips-resource://platform/vendor/react-dom-client.js";
import rt from "chips-resource://platform/vendor/react.js";
import { theme as Ys, Form as ao, Input as ja } from "chips-resource://platform/vendor/chips-ui.js";
function Qs(t) {
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
function Xs(t) {
  return typeof t == "string" && t.trim().length > 0;
}
function Gu(t) {
  return Xs(t) && Qs(t).length > 0;
}
function fm(t) {
  return Gu(t) ? Qs(t).toLowerCase().endsWith(".md") : !1;
}
function dm(t) {
  return Xs(t) ? Gu(t) ? "resource" : "external" : "empty";
}
const co = Object.freeze({
  target: "_blank",
  rel: "noopener noreferrer"
}), pm = "data-chips-resource-path", qa = "markdown", es = 200;
function $n(t) {
  return t.replace(/\r\n?/g, `
`).replace(/\u00a0/g, " ").replace(/[\t ]+$/gm, "").replace(/^\n+/, "").replace(/\n{3,}/g, `

`).trimEnd();
}
function mm(t) {
  return Array.from(t).length;
}
function gm(t) {
  const e = $n(t);
  return e ? e.replace(/\$\$([\s\S]*?)\$\$/g, "$1").replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, "$1").replace(/```[\s\S]*?```/g, (n) => n.replace(/```/g, "")).replace(/`([^`]+)`/g, "$1").replace(/!\[([^\]]*)]\(([^)]+)\)/g, "$1").replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1").replace(/^\s{0,3}#{1,6}\s+/gm, "").replace(/^\s{0,3}>\s?/gm, "").replace(/^\s{0,3}(?:[-*+] |\d+\. )/gm, "").replace(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gm, " ").replace(/~~([^~]+)~~/g, "$1").replace(/==([^=]+)==/g, "$1").replace(/\+\+([^+]+)\+\+/g, "$1").replace(/\^([^^]+)\^/g, "$1").replace(/~([^~]+)~/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/_([^_]+)_/g, "$1").replace(/\\([\\`*{}[\]()#+.!_>~|])/g, "$1").replace(/<[^>]+>/g, " ").replace(/\n+/g, " ").replace(/\s+/g, " ").trim() : "";
}
function Yu(t) {
  return mm(gm(t));
}
function ym(t) {
  if (Yu(t) > 0)
    return !0;
  const e = $n(t);
  return e ? /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/m.test(e) : !1;
}
function km(t) {
  return t > es;
}
function bm(t) {
  return fm(typeof t == "string" ? t : void 0) ? Qs(t) : "";
}
const Wa = "base.richtext", ts = { fontSize: 16, lineHeight: 1.6 }, Qu = 12, Xu = 48, Zu = 1, ns = {
  commonmark: !0,
  gfm: !0,
  math: !0,
  highlight: !0,
  underline: !0,
  superscript: !0,
  subscript: !0
}, xm = "zh-CN";
function rs(t) {
  return typeof t == "string" ? t.trim() : void 0;
}
function wm(t) {
  const e = rs(t.content_source);
  return e === "file" ? "file" : e === "inline" ? "inline" : Xs(t.content_file) ? "file" : "inline";
}
function Cm(t) {
  const e = typeof t == "object" && t !== null ? t : {}, n = {};
  for (const r of Object.keys(ns))
    n[r] = e[r] === !1 ? !1 : ns[r];
  return n;
}
function Hi(t) {
  const e = typeof t == "object" && t !== null ? t : {}, n = wm(e), r = rs(e.locale) ?? xm, i = Cm(e.markdown_capabilities);
  if (n === "file")
    return {
      card_type: Wa,
      content_format: qa,
      content_source: "file",
      content_file: bm(rs(e.content_file) ?? ""),
      locale: r,
      markdown_capabilities: i
    };
  const o = e.content_text, s = $n(
    typeof o == "string" ? o : typeof e.markdown == "string" ? e.markdown : ""
  );
  return {
    card_type: Wa,
    content_format: qa,
    content_source: "inline",
    content_text: s,
    locale: r,
    markdown_capabilities: i
  };
}
function Ka(t) {
  return typeof t == "number" && Number.isFinite(t) ? t : void 0;
}
function eh(t) {
  const e = typeof t == "object" && t !== null ? t : {}, n = typeof e.config == "object" && e.config !== null ? e.config : {}, r = Ka(n.fontSize), i = Ka(n.lineHeight);
  return {
    fontSize: r !== void 0 && Number.isInteger(r) && r >= Qu && r <= Xu ? r : ts.fontSize,
    lineHeight: i !== void 0 && i >= Zu ? i : ts.lineHeight
  };
}
function Sm(t, e) {
  const n = Hi({
    ...t,
    markdown_capabilities: t.markdown_capabilities ?? ns
  }), r = {
    card_type: n.card_type,
    content_format: n.content_format,
    content_source: n.content_source,
    locale: n.locale,
    markdown_capabilities: { ...n.markdown_capabilities },
    config: { ...e ?? ts }
  };
  return n.content_source === "file" ? r.content_file = n.content_file ?? "" : r.content_text = n.content_text ?? "", r;
}
function Nm(t) {
  const e = Yu(t);
  return { length: e, shouldUseFile: km(e) };
}
class th extends Error {
  constructor() {
    super("富文本渲染通道未接入：等待平台插件执行通道交付"), this.name = "MarkdownRenderingUnavailableError";
  }
}
async function Mm(t) {
  throw new th();
}
const Tm = [
  "commonmark",
  "gfm",
  "math",
  "highlight",
  "underline",
  "superscript",
  "subscript"
], Am = Object.freeze({
  commonmark: !0,
  gfm: !0,
  math: !1,
  highlight: !1,
  underline: !1,
  superscript: !1,
  subscript: !1
}), Im = Object.freeze({
  commonmark: "基础语法",
  gfm: "GFM 扩展",
  math: "数学公式",
  highlight: "高亮标记",
  underline: "下划线",
  superscript: "上标",
  subscript: "下标"
});
function nh(t) {
  return Tm.filter(
    (e) => t[e] === !0 && Am[e] === !1
  );
}
function rh(t) {
  return t.length === 0 ? "" : `以下扩展语法当前按纯文本呈现：${t.map((n) => Im[n]).join("、")}`;
}
const Em = "chips-richtext-card__surface";
function Om(t) {
  for (const e of Array.from(t.querySelectorAll("a[href]"))) {
    const n = dm(e.getAttribute("href") ?? void 0);
    if (n === "external") {
      e.setAttribute("target", co.target), e.setAttribute("rel", co.rel);
      continue;
    }
    n === "resource" && (e.setAttribute("rel", co.rel), e.setAttribute(pm, e.getAttribute("href") ?? ""));
  }
}
function vm({ content: t }) {
  const { token: e } = Ys.useToken(), n = Hi(t), r = eh(t), i = rh(nh(n.markdown_capabilities)), [o, s] = rt.useState(null), [l, a] = rt.useState({ kind: "loading", message: "正在渲染富文本内容…" });
  rt.useEffect(() => {
    let u = !1;
    if (s(null), a({ kind: "loading", message: "正在渲染富文本内容…" }), n.content_source === "file") {
      a({ kind: "error", message: "文件内容读取通道未接入：文件来源正文暂无法在此呈现" });
      return;
    }
    if ((n.content_text ?? "").length === 0) {
      a({ kind: "error", message: "此卡片还没有正文内容" });
      return;
    }
    return Mm().then((d) => {
      u || (s(d), a({ kind: "loading", message: "" }));
    }).catch((d) => {
      if (u)
        return;
      const f = d instanceof th ? "渲染通道未接入：富文本渲染服务尚未与本环境接线" : "内容暂时无法渲染，请稍后重试";
      a({ kind: "error", message: f });
    }), () => {
      u = !0;
    };
  }, [n.content_source, n.content_text]);
  const c = rt.useCallback(
    (u) => {
      u !== null && o !== null && Om(u);
    },
    [o]
  );
  return /* @__PURE__ */ rr("div", { "data-card-type": "base.richtext", "data-content-source": n.content_source, children: [
    o !== null ? /* @__PURE__ */ Te(
      "div",
      {
        ref: c,
        className: Em,
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
    l.message.length > 0 ? /* @__PURE__ */ Te(
      "p",
      {
        role: "status",
        style: {
          margin: 0,
          padding: `${e.paddingXS}px 0`,
          color: l.kind === "error" ? e.colorError : e.colorTextSecondary,
          fontSize: e.fontSizeSM
        },
        children: l.message
      }
    ) : null,
    o !== null && i.length > 0 ? /* @__PURE__ */ Te(
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
var We = /* @__PURE__ */ (function(t) {
  return t.docTypeError = "docTypeError", t.contextNotFound = "contextNotFound", t.timerNotFound = "timerNotFound", t.ctxCallOutOfScope = "ctxCallOutOfScope", t.createNodeInParserFail = "createNodeInParserFail", t.stackOverFlow = "stackOverFlow", t.parserMatchError = "parserMatchError", t.serializerMatchError = "serializerMatchError", t.getAtomFromSchemaFail = "getAtomFromSchemaFail", t.expectDomTypeError = "expectDomTypeError", t.callCommandBeforeEditorView = "callCommandBeforeEditorView", t.missingRootElement = "missingRootElement", t.missingNodeInSchema = "missingNodeInSchema", t.missingMarkInSchema = "missingMarkInSchema", t.ctxNotBind = "ctxNotBind", t.missingYjsDoc = "missingYjsDoc", t.aiProviderError = "aiProviderError", t.aiBuildContextError = "aiBuildContextError", t;
})({}), Ke = class extends Error {
  constructor(t, e, n) {
    super(e, n), this.name = "MilkdownError", this.code = t, n?.cause !== void 0 && (this.cause = n.cause);
  }
}, Dm = (t, e) => typeof e == "function" ? "[Function]" : e, ji = (t) => JSON.stringify(t, Dm);
function Rm(t) {
  return new Ke(We.docTypeError, `Doc type error, unsupported type: ${ji(t)}`);
}
function zm(t) {
  return new Ke(We.contextNotFound, `Context "${t}" not found, do you forget to inject it?`);
}
function Pm(t) {
  return new Ke(We.timerNotFound, `Timer "${t}" not found, do you forget to record it?`);
}
function qi() {
  return new Ke(We.ctxCallOutOfScope, "Should not call a context out of the plugin.");
}
function Lm(t, e, n) {
  const r = `Cannot create node for ${"name" in t ? t.name : t}`, i = (s) => {
    if (s == null) return "null";
    if (Array.isArray(s)) return `[${s.map(i).join(", ")}]`;
    if (typeof s == "object")
      return "toJSON" in s && typeof s.toJSON == "function" ? JSON.stringify(s.toJSON()) : "spec" in s ? JSON.stringify(s.spec) : JSON.stringify(s);
    if (typeof s == "string" || typeof s == "number" || typeof s == "boolean") return JSON.stringify(s);
    if (typeof s == "function") return `[Function: ${s.name || "anonymous"}]`;
    try {
      return String(s);
    } catch {
      return "[Unserializable]";
    }
  }, o = [
    ["[Description]", r],
    ["[Attributes]", e],
    ["[Content]", (n ?? []).map((s) => s ? typeof s == "object" && "type" in s ? `${s}` : i(s) : "null")]
  ].reduce((s, [l, a]) => {
    const c = `${l}: ${i(a)}.`;
    return s.concat(c);
  }, []);
  return new Ke(We.createNodeInParserFail, o.join(`
`));
}
function ih() {
  return new Ke(We.stackOverFlow, "Stack over flow, cannot pop on an empty stack.");
}
function Bm(t) {
  return new Ke(We.parserMatchError, `Cannot match target parser for node: ${ji(t)}.`);
}
function Fm(t) {
  return new Ke(We.serializerMatchError, `Cannot match target serializer for node: ${ji(t)}.`);
}
function ct(t) {
  return new Ke(We.expectDomTypeError, `Expect to be a dom, but get: ${ji(t)}.`);
}
function uo() {
  return new Ke(We.callCommandBeforeEditorView, "You're trying to call a command before editor view initialized, make sure to get commandManager from ctx after editor view has been initialized");
}
function _m(t) {
  return new Ke(We.missingNodeInSchema, `Missing node in schema, milkdown cannot find "${t}" in schema.`);
}
function $m(t) {
  return new Ke(We.missingMarkInSchema, `Missing mark in schema, milkdown cannot find "${t}" in schema.`);
}
var oh = class {
  constructor() {
    this.sliceMap = /* @__PURE__ */ new Map(), this.get = (t) => {
      const e = typeof t == "string" ? [...this.sliceMap.values()].find((n) => n.type.name === t) : this.sliceMap.get(t.id);
      if (!e) {
        const n = typeof t == "string" ? t : t.name;
        throw zm(n);
      }
      return e;
    }, this.remove = (t) => {
      const e = typeof t == "string" ? [...this.sliceMap.values()].find((n) => n.type.name === t) : this.sliceMap.get(t.id);
      e && this.sliceMap.delete(e.type.id);
    }, this.has = (t) => typeof t == "string" ? [...this.sliceMap.values()].some((e) => e.type.name === t) : this.sliceMap.has(t.id);
  }
}, Vm = class {
  #t;
  #e;
  #r;
  constructor(e, n, r) {
    this.#t = [], this.#r = () => {
      this.#t.forEach((i) => i(this.#e));
    }, this.set = (i) => {
      this.#e = i, this.#r();
    }, this.get = () => this.#e, this.update = (i) => {
      this.#e = i(this.#e), this.#r();
    }, this.type = r, this.#e = n, e.set(r.id, this);
  }
  on(e) {
    return this.#t.push(e), () => {
      this.#t = this.#t.filter((n) => n !== e);
    };
  }
  once(e) {
    const n = this.on((r) => {
      e(r), n();
    });
    return n;
  }
  off(e) {
    this.#t = this.#t.filter((n) => n !== e);
  }
  offAll() {
    this.#t = [];
  }
}, Hm = class {
  constructor(t, e) {
    this.id = /* @__PURE__ */ Symbol(`Context-${e}`), this.name = e, this._defaultValue = t, this._typeInfo = () => {
      throw qi();
    };
  }
  create(t, e = this._defaultValue) {
    return new Vm(t, e, this);
  }
}, W = (t, e) => new Hm(t, e), jm = class {
  #t;
  #e;
  #r;
  #n;
  #o;
  #s;
  #i;
  constructor(t, e, n) {
    this.#n = /* @__PURE__ */ new Set(), this.#o = /* @__PURE__ */ new Set(), this.#s = /* @__PURE__ */ new Map(), this.#i = /* @__PURE__ */ new Map(), this.read = () => ({
      metadata: this.#t,
      injectedSlices: [...this.#n].map((r) => ({
        name: typeof r == "string" ? r : r.name,
        value: this.#l(r)
      })),
      consumedSlices: [...this.#o].map((r) => ({
        name: typeof r == "string" ? r : r.name,
        value: this.#l(r)
      })),
      recordedTimers: [...this.#s].map(([r, { duration: i }]) => ({
        name: r.name,
        duration: i,
        status: this.#a(r)
      })),
      waitTimers: [...this.#i].map(([r, { duration: i }]) => ({
        name: r.name,
        duration: i,
        status: this.#a(r)
      }))
    }), this.onRecord = (r) => {
      this.#s.set(r, {
        start: Date.now(),
        duration: 0
      });
    }, this.onClear = (r) => {
      this.#s.delete(r);
    }, this.onDone = (r) => {
      const i = this.#s.get(r);
      i && (i.duration = Date.now() - i.start);
    }, this.onWait = (r, i) => {
      const o = Date.now();
      i.finally(() => {
        this.#i.set(r, { duration: Date.now() - o });
      }).catch(console.error);
    }, this.onInject = (r) => {
      this.#n.add(r);
    }, this.onRemove = (r) => {
      this.#n.delete(r);
    }, this.onUse = (r) => {
      this.#o.add(r);
    }, this.#l = (r) => this.#e.get(r).get(), this.#a = (r) => this.#r.get(r).status, this.#e = t, this.#r = e, this.#t = n;
  }
  #l;
  #a;
}, qm = class sh {
  #t;
  #e;
  #r;
  #n;
  constructor(e, n, r) {
    this.produce = (i) => i && Object.keys(i).length ? new sh(this.#t, this.#e, { ...i }) : this, this.inject = (i, o) => {
      const s = i.create(this.#t.sliceMap);
      return o != null && s.set(o), this.#n?.onInject(i), this;
    }, this.remove = (i) => (this.#t.remove(i), this.#n?.onRemove(i), this), this.record = (i) => (i.create(this.#e.store), this.#n?.onRecord(i), this), this.clearTimer = (i) => (this.#e.remove(i), this.#n?.onClear(i), this), this.isInjected = (i) => this.#t.has(i), this.isRecorded = (i) => this.#e.has(i), this.use = (i) => (this.#n?.onUse(i), this.#t.get(i)), this.get = (i) => this.use(i).get(), this.set = (i, o) => this.use(i).set(o), this.update = (i, o) => this.use(i).update(o), this.timer = (i) => this.#e.get(i), this.done = (i) => {
      this.timer(i).done(), this.#n?.onDone(i);
    }, this.wait = (i) => {
      const o = this.timer(i).start();
      return this.#n?.onWait(i, o), o;
    }, this.waitTimers = async (i) => {
      await Promise.all(this.get(i).map((o) => this.wait(o)));
    }, this.#t = e, this.#e = n, this.#r = r, r && (this.#n = new jm(e, n, r));
  }
  get meta() {
    return this.#r;
  }
  get inspector() {
    return this.#n;
  }
}, Wm = class {
  constructor() {
    this.store = /* @__PURE__ */ new Map(), this.get = (t) => {
      const e = this.store.get(t.id);
      if (!e) throw Pm(t.name);
      return e;
    }, this.remove = (t) => {
      this.store.delete(t.id);
    }, this.has = (t) => this.store.has(t.id);
  }
}, Km = class {
  #t;
  #e;
  #r;
  #n;
  #o;
  constructor(t, e) {
    this.#t = null, this.#e = null, this.#n = "pending", this.#o = null, this.start = () => (this.#t ??= new Promise((n, r) => {
      this.#e = (i) => {
        i instanceof CustomEvent && i.detail.id === this.#r && (this.#n = "resolved", this.#s(), i.stopImmediatePropagation(), n());
      }, this.#i(() => {
        this.#n === "pending" && (this.#n = "rejected"), this.#s(), r(/* @__PURE__ */ new Error(`Timing ${this.type.name} timeout.`));
      }), this.#n = "pending", addEventListener(this.type.name, this.#e);
    }), this.#t), this.done = () => {
      const n = new CustomEvent(this.type.name, { detail: { id: this.#r } });
      dispatchEvent(n);
    }, this.#s = () => {
      this.#o !== null && (clearTimeout(this.#o), this.#o = null), this.#e && removeEventListener(this.type.name, this.#e);
    }, this.#i = (n) => {
      this.#o = setTimeout(() => {
        this.#o = null, n();
      }, this.type.timeout);
    }, this.#r = Symbol(e.name), this.type = e, t.set(e.id, this);
  }
  get status() {
    return this.#n;
  }
  #s;
  #i;
}, Um = class {
  constructor(t, e = 3e3) {
    this.create = (n) => new Km(n, this), this.id = /* @__PURE__ */ Symbol(`Timer-${t}`), this.name = t, this.timeout = e;
  }
}, ut = (t, e = 3e3) => new Um(t, e);
const Jm = {};
function Zs(t, e) {
  const n = Jm, r = typeof n.includeImageAlt == "boolean" ? n.includeImageAlt : !0, i = typeof n.includeHtml == "boolean" ? n.includeHtml : !0;
  return lh(t, r, i);
}
function lh(t, e, n) {
  if (Gm(t)) {
    if ("value" in t)
      return t.type === "html" && !n ? "" : t.value;
    if (e && "alt" in t && t.alt)
      return t.alt;
    if ("children" in t)
      return Ua(t.children, e, n);
  }
  return Array.isArray(t) ? Ua(t, e, n) : "";
}
function Ua(t, e, n) {
  const r = [];
  let i = -1;
  for (; ++i < t.length; )
    r[i] = lh(t[i], e, n);
  return r.join("");
}
function Gm(t) {
  return !!(t && typeof t == "object");
}
const Ja = document.createElement("i");
function el(t) {
  const e = "&" + t + ";";
  Ja.innerHTML = e;
  const n = Ja.textContent;
  return n.charCodeAt(n.length - 1) === 59 && t !== "semi" || n === e ? !1 : n;
}
function Xe(t, e, n, r) {
  const i = t.length;
  let o = 0, s;
  if (e < 0 ? e = -e > i ? 0 : i + e : e = e > i ? i : e, n = n > 0 ? n : 0, r.length < 1e4)
    s = Array.from(r), s.unshift(e, n), t.splice(...s);
  else
    for (n && t.splice(e, n); o < r.length; )
      s = r.slice(o, o + 1e4), s.unshift(e, 0), t.splice(...s), o += 1e4, e += 1e4;
}
function Ve(t, e) {
  return t.length > 0 ? (Xe(t, t.length, 0, e), t) : e;
}
const Ga = {}.hasOwnProperty;
function ah(t) {
  const e = {};
  let n = -1;
  for (; ++n < t.length; )
    Ym(e, t[n]);
  return e;
}
function Ym(t, e) {
  let n;
  for (n in e) {
    const i = (Ga.call(t, n) ? t[n] : void 0) || (t[n] = {}), o = e[n];
    let s;
    if (o)
      for (s in o) {
        Ga.call(i, s) || (i[s] = []);
        const l = o[s];
        Qm(
          // @ts-expect-error Looks like a list.
          i[s],
          Array.isArray(l) ? l : l ? [l] : []
        );
      }
  }
}
function Qm(t, e) {
  let n = -1;
  const r = [];
  for (; ++n < e.length; )
    (e[n].add === "after" ? t : r).push(e[n]);
  Xe(t, 0, 0, r);
}
function ch(t, e) {
  const n = Number.parseInt(t, e);
  return (
    // C0 except for HT, LF, FF, CR, space.
    n < 9 || n === 11 || n > 13 && n < 32 || // Control character (DEL) of C0, and C1 controls.
    n > 126 && n < 160 || // Lone high surrogates and low surrogates.
    n > 55295 && n < 57344 || // Noncharacters.
    n > 64975 && n < 65008 || /* eslint-disable no-bitwise */
    (n & 65535) === 65535 || (n & 65535) === 65534 || /* eslint-enable no-bitwise */
    // Out of range
    n > 1114111 ? "�" : String.fromCodePoint(n)
  );
}
function Ze(t) {
  return t.replace(/[\t\n\r ]+/g, " ").replace(/^ | $/g, "").toLowerCase().toUpperCase();
}
const de = Ut(/[A-Za-z]/), Ce = Ut(/[\dA-Za-z]/), Xm = Ut(/[#-'*+\--9=?A-Z^-~]/);
function Ni(t) {
  return (
    // Special whitespace codes (which have negative values), C0 and Control
    // character DEL
    t !== null && (t < 32 || t === 127)
  );
}
const is = Ut(/\d/), Zm = Ut(/[\dA-Fa-f]/), uh = Ut(/[!-/:-@[-`{-~]/);
function L(t) {
  return t !== null && t < -2;
}
function ee(t) {
  return t !== null && (t < 0 || t === 32);
}
function q(t) {
  return t === -2 || t === -1 || t === 32;
}
const Wi = Ut(new RegExp("\\p{P}|\\p{S}", "u")), pn = Ut(/\s/);
function Ut(t) {
  return e;
  function e(n) {
    return n !== null && n > -1 && t.test(String.fromCharCode(n));
  }
}
function G(t, e, n, r) {
  const i = r ? r - 1 : 1 / 0;
  let o = 0;
  return s;
  function s(a) {
    return q(a) ? (t.enter(n), l(a)) : e(a);
  }
  function l(a) {
    return q(a) && o++ < i ? (t.consume(a), l) : (t.exit(n), e(a));
  }
}
function hh(t, e, n, r, i, o) {
  let s = 0;
  return l;
  function l(u) {
    return q(u) ? (t.enter(r), a(u)) : c(u);
  }
  function a(u) {
    return q(u) && s < o ? (t.consume(u), s++, a) : (t.exit(r), c(u));
  }
  function c(u) {
    return s >= i ? e(u) : n(u);
  }
}
const eg = {
  tokenize: tg
};
function tg(t) {
  const e = t.attempt(this.parser.constructs.contentInitial, r, i);
  let n;
  return e;
  function r(l) {
    if (l === null) {
      t.consume(l);
      return;
    }
    return t.enter("lineEnding"), t.consume(l), t.exit("lineEnding"), G(t, e, "linePrefix");
  }
  function i(l) {
    return t.enter("paragraph"), o(l);
  }
  function o(l) {
    const a = t.enter("chunkText", {
      contentType: "text",
      previous: n
    });
    return n && (n.next = a), n = a, s(l);
  }
  function s(l) {
    if (l === null) {
      t.exit("chunkText"), t.exit("paragraph"), t.consume(l);
      return;
    }
    return L(l) ? (t.consume(l), t.exit("chunkText"), o) : (t.consume(l), s);
  }
}
let Mi = class {
  /**
   * Create a new edit map.
   *
   * @returns
   *   New instance.
   */
  constructor() {
    this.index = /* @__PURE__ */ new Map(), this.map = [];
  }
  /**
   * Create an edit: a remove and/or add at a certain place.
   *
   * @param {number} index
   *   Index at which to apply the edit.
   * @param {number} remove
   *   Count of items to remove at the index.
   * @param {Array<Event>} add
   *   Items to add at the index.
   * @returns {undefined}
   *   Nothing.
   */
  add(e, n, r) {
    Ya(this, e, n, r, !1);
  }
  /**
   * Create an edit: but insert `add` before existing additions, instead of
   * after them.
   *
   * @param {number} index
   *   Index at which to apply the edit.
   * @param {number} remove
   *   Count of items to remove at the index.
   * @param {Array<Event>} add
   *   Items to add at the index.
   * @returns {undefined}
   *   Nothing.
   */
  addBefore(e, n, r) {
    Ya(this, e, n, r, !0);
  }
  /**
   * Done, change the events.
   *
   * @param {Array<Event>} events
   *   List of events to apply the edits to.
   * @returns {undefined}
   *   Nothing.
   */
  consume(e) {
    if (this.map.sort(function(o, s) {
      return o[0] - s[0];
    }), this.map.length === 0)
      return;
    let n = this.map.length;
    const r = [];
    for (; n > 0; )
      n -= 1, r.push(e.slice(this.map[n][0] + this.map[n][1]), this.map[n][2]), e.length = this.map[n][0];
    r.push(e.slice()), e.length = 0;
    let i = r.pop();
    for (; i; ) {
      for (const o of i)
        e.push(o);
      i = r.pop();
    }
    this.map.length = 0, this.index.clear();
  }
};
function Ya(t, e, n, r, i) {
  if (n === 0 && r.length === 0)
    return;
  const o = t.index.get(e);
  if (o) {
    o[1] += n, i ? (r.push(...o[2]), o[2] = r) : o[2].push(...r);
    return;
  }
  const s = [e, n, r];
  t.map.push(s), t.index.set(e, s);
}
const ng = {
  tokenize: rg
}, Qa = {
  tokenize: ig
};
function rg(t) {
  const e = this, n = [];
  let r = 0, i, o, s;
  return l;
  function l(w) {
    if (r < n.length) {
      const O = n[r];
      return e.containerState = O[1], t.attempt(O[0].continuation, a, c)(w);
    }
    return c(w);
  }
  function a(w) {
    if (r++, e.containerState._closeFlow) {
      e.containerState._closeFlow = void 0, i && N();
      const O = e.events.length;
      let v = O, x;
      for (; v--; )
        if (e.events[v][0] === "exit" && e.events[v][1].type === "chunkFlow") {
          x = e.events[v][1].end;
          break;
        }
      g(r);
      let A = O;
      for (; A < e.events.length; )
        e.events[A][1].end = {
          ...x
        }, A++;
      const R = new Mi();
      return R.add(v + 1, 0, e.events.slice(O)), R.add(O, A - O, []), R.consume(e.events), c(w);
    }
    return l(w);
  }
  function c(w) {
    if (r === n.length) {
      if (!i)
        return d(w);
      if (i.currentConstruct && i.currentConstruct.concrete)
        return p(w);
      e.interrupt = !!(i.currentConstruct && !i._gfmTableDynamicInterruptHack);
    }
    return e.containerState = {}, t.check(Qa, u, h)(w);
  }
  function u(w) {
    return i && N(), g(r), d(w);
  }
  function h(w) {
    return e.parser.lazy[e.now().line] = r !== n.length, s = e.now().offset, p(w);
  }
  function d(w) {
    return e.containerState = {}, t.attempt(Qa, f, p)(w);
  }
  function f(w) {
    return r++, n.push([e.currentConstruct, e.containerState]), d(w);
  }
  function p(w) {
    if (w === null) {
      i && N(), g(0), t.consume(w);
      return;
    }
    return i = i || e.parser.flow(e.now()), t.enter("chunkFlow", {
      _tokenizer: i,
      contentType: "flow",
      previous: o
    }), m(w);
  }
  function m(w) {
    if (w === null) {
      y(t.exit("chunkFlow"), !0), g(0), t.consume(w);
      return;
    }
    return L(w) ? (t.consume(w), y(t.exit("chunkFlow")), r = 0, e.interrupt = void 0, l) : (t.consume(w), m);
  }
  function y(w, O) {
    const v = e.sliceStream(w);
    if (O && v.push(null), w.previous = o, o && (o.next = w), o = w, i.defineSkip(w.start), i.write(v), e.parser.lazy[w.start.line]) {
      let x = i.events.length;
      for (; x--; )
        if (
          // The token starts before the line ending…
          i.events[x][1].start.offset < s && // …and either is not ended yet…
          (!i.events[x][1].end || // …or ends after it.
          i.events[x][1].end.offset > s)
        )
          return;
      const A = e.events.length;
      let R = A, F, C;
      for (; R--; )
        if (e.events[R][0] === "exit" && e.events[R][1].type === "chunkFlow") {
          if (F) {
            C = e.events[R][1].end;
            break;
          }
          F = !0;
        }
      for (g(r), x = A; x < e.events.length; )
        e.events[x][1].end = {
          ...C
        }, x++;
      const D = new Mi();
      D.add(R + 1, 0, e.events.slice(A)), D.add(A, x - A, []), D.consume(e.events);
    }
  }
  function g(w) {
    let O = n.length;
    for (; O-- > w; ) {
      const v = n[O];
      e.containerState = v[1], v[0].exit.call(e, t);
    }
    n.length = w;
  }
  function N() {
    i.write([null]), o = void 0, i = void 0, e.containerState._closeFlow = void 0;
  }
}
function ig(t, e, n) {
  return G(t, t.attempt(this.parser.constructs.document, e, n), "linePrefix", this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
}
function st(t) {
  if (t === null || ee(t) || pn(t))
    return 1;
  if (Wi(t))
    return 2;
}
function Ki(t, e, n) {
  const r = [];
  let i = -1;
  for (; ++i < t.length; ) {
    const o = t[i].resolveAll;
    o && !r.includes(o) && (e = o(e, n), r.push(o));
  }
  return e;
}
const ss = {
  name: "attention",
  resolveAll: og,
  tokenize: sg
};
function og(t, e) {
  let n = -1, r;
  for (; ++n < t.length; )
    if (t[n][0] === "enter" && t[n][1].type === "attentionSequence" && t[n][1]._close) {
      let i = n;
      for (; i--; )
        if (t[i][0] === "exit" && t[i][1].type === "attentionSequence" && t[i][1]._open && // If the markers are the same:
        e.sliceSerialize(t[i][1]).charCodeAt(0) === e.sliceSerialize(t[n][1]).charCodeAt(0)) {
          if ((t[i][1]._close || t[n][1]._open) && (t[n][1].end.offset - t[n][1].start.offset) % 3 && !((t[i][1].end.offset - t[i][1].start.offset + t[n][1].end.offset - t[n][1].start.offset) % 3))
            continue;
          const o = t[i][1].end.offset - t[i][1].start.offset > 1 && t[n][1].end.offset - t[n][1].start.offset > 1 ? 2 : 1, s = {
            ...t[i][1].end
          }, l = {
            ...t[n][1].start
          };
          Xa(s, -o), Xa(l, o);
          const a = {
            type: o > 1 ? "strongSequence" : "emphasisSequence",
            start: s,
            end: {
              ...t[i][1].end
            }
          }, c = {
            type: o > 1 ? "strongSequence" : "emphasisSequence",
            start: {
              ...t[n][1].start
            },
            end: l
          }, u = {
            type: o > 1 ? "strongText" : "emphasisText",
            start: {
              ...t[i][1].end
            },
            end: {
              ...t[n][1].start
            }
          }, h = {
            type: o > 1 ? "strong" : "emphasis",
            start: {
              ...a.start
            },
            end: {
              ...c.end
            }
          };
          t[i][1].end = {
            ...a.start
          }, t[n][1].start = {
            ...c.end
          }, r = [], t[i][1].end.offset - t[i][1].start.offset && (r = Ve(r, [["enter", t[i][1], e], ["exit", t[i][1], e]])), r = Ve(r, [["enter", h, e], ["enter", a, e], ["exit", a, e], ["enter", u, e]]), r = Ve(r, Ki(e.parser.constructs.insideSpan.null, t.slice(i + 1, n), e)), r = Ve(r, [["exit", u, e], ["enter", c, e], ["exit", c, e], ["exit", h, e]]);
          let d = 0;
          t[n][1].end.offset - t[n][1].start.offset && (d = 2, r = Ve(r, [["enter", t[n][1], e], ["exit", t[n][1], e]])), Xe(t, i - 1, n - i + 3, r), n = i + r.length - d - 2;
          break;
        }
    }
  for (n = -1; ++n < t.length; )
    t[n][1].type === "attentionSequence" && (t[n][1].type = "data");
  return t;
}
function sg(t, e) {
  const n = this.parser.constructs.attentionMarkers.null, r = this.previous, i = st(r);
  let o;
  return s;
  function s(a) {
    return o = a, t.enter("attentionSequence"), l(a);
  }
  function l(a) {
    if (a === o)
      return t.consume(a), l;
    const c = t.exit("attentionSequence"), u = st(a), h = !u || u === 2 && i || n.includes(a) && a !== 42 && a !== 95, d = !i || i === 2 && u || n.includes(r) && r !== 42 && r !== 95;
    return c._open = !!(o === 42 ? h : h && (i || !d)), c._close = !!(o === 42 ? d : d && (u || !h)), e(a);
  }
}
function Xa(t, e) {
  t.column += e, t.offset += e, t._bufferIndex += e;
}
const lg = {
  name: "autolink",
  tokenize: ag
};
function ag(t, e, n) {
  let r = 0;
  return i;
  function i(f) {
    return t.enter("autolink"), t.enter("autolinkMarker"), t.consume(f), t.exit("autolinkMarker"), t.enter("autolinkProtocol"), o;
  }
  function o(f) {
    return de(f) ? (t.consume(f), s) : f === 64 ? n(f) : c(f);
  }
  function s(f) {
    return f === 43 || f === 45 || f === 46 || Ce(f) ? (r = 1, l(f)) : c(f);
  }
  function l(f) {
    return f === 58 ? (t.consume(f), r = 0, a) : (f === 43 || f === 45 || f === 46 || Ce(f)) && r++ < 32 ? (t.consume(f), l) : (r = 0, c(f));
  }
  function a(f) {
    return f === 62 ? (t.exit("autolinkProtocol"), t.enter("autolinkMarker"), t.consume(f), t.exit("autolinkMarker"), t.exit("autolink"), e) : f === null || f === 32 || f === 60 || Ni(f) ? n(f) : (t.consume(f), a);
  }
  function c(f) {
    return f === 64 ? (t.consume(f), u) : Xm(f) ? (t.consume(f), c) : n(f);
  }
  function u(f) {
    return Ce(f) ? h(f) : n(f);
  }
  function h(f) {
    return f === 46 ? (t.consume(f), r = 0, u) : f === 62 ? (t.exit("autolinkProtocol").type = "autolinkEmail", t.enter("autolinkMarker"), t.consume(f), t.exit("autolinkMarker"), t.exit("autolink"), e) : d(f);
  }
  function d(f) {
    if ((f === 45 || Ce(f)) && r++ < 63) {
      const p = f === 45 ? d : h;
      return t.consume(f), p;
    }
    return n(f);
  }
}
const zr = {
  partial: !0,
  tokenize: cg
};
function cg(t, e, n) {
  return r;
  function r(o) {
    return q(o) ? G(t, i, "linePrefix")(o) : i(o);
  }
  function i(o) {
    return o === null || L(o) ? e(o) : n(o);
  }
}
const fh = {
  continuation: {
    tokenize: hg
  },
  exit: fg,
  name: "blockQuote",
  tokenize: ug
};
function ug(t, e, n) {
  const r = this;
  return i;
  function i(s) {
    if (s === 62) {
      const l = r.containerState;
      return l.open || (t.enter("blockQuote", {
        _container: !0
      }), l.open = !0), t.enter("blockQuotePrefix"), t.enter("blockQuoteMarker"), t.consume(s), t.exit("blockQuoteMarker"), o;
    }
    return n(s);
  }
  function o(s) {
    return q(s) ? (t.enter("blockQuotePrefixWhitespace"), t.consume(s), t.exit("blockQuotePrefixWhitespace"), t.exit("blockQuotePrefix"), e) : (t.exit("blockQuotePrefix"), e(s));
  }
}
function hg(t, e, n) {
  const r = this;
  return i;
  function i(s) {
    return q(s) ? G(t, o, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(s) : o(s);
  }
  function o(s) {
    return t.attempt(fh, e, n)(s);
  }
}
function fg(t) {
  t.exit("blockQuote");
}
const dh = {
  name: "characterEscape",
  tokenize: dg
};
function dg(t, e, n) {
  return r;
  function r(o) {
    return t.enter("characterEscape"), t.enter("escapeMarker"), t.consume(o), t.exit("escapeMarker"), i;
  }
  function i(o) {
    return uh(o) ? (t.enter("characterEscapeValue"), t.consume(o), t.exit("characterEscapeValue"), t.exit("characterEscape"), e) : n(o);
  }
}
const ph = {
  name: "characterReference",
  tokenize: pg
};
function pg(t, e, n) {
  const r = this;
  let i = 0, o, s;
  return l;
  function l(h) {
    return t.enter("characterReference"), t.enter("characterReferenceMarker"), t.consume(h), t.exit("characterReferenceMarker"), a;
  }
  function a(h) {
    return h === 35 ? (t.enter("characterReferenceMarkerNumeric"), t.consume(h), t.exit("characterReferenceMarkerNumeric"), c) : (t.enter("characterReferenceValue"), o = 31, s = Ce, u(h));
  }
  function c(h) {
    return h === 88 || h === 120 ? (t.enter("characterReferenceMarkerHexadecimal"), t.consume(h), t.exit("characterReferenceMarkerHexadecimal"), t.enter("characterReferenceValue"), o = 6, s = Zm, u) : (t.enter("characterReferenceValue"), o = 7, s = is, u(h));
  }
  function u(h) {
    if (h === 59 && i) {
      const d = t.exit("characterReferenceValue");
      return s === Ce && !el(r.sliceSerialize(d)) ? n(h) : (t.enter("characterReferenceMarker"), t.consume(h), t.exit("characterReferenceMarker"), t.exit("characterReference"), e);
    }
    return s(h) && i++ < o ? (t.consume(h), u) : n(h);
  }
}
const ls = {
  partial: !0,
  tokenize: mg
};
function mg(t, e, n) {
  const r = this;
  return i;
  function i(s) {
    return s === null ? n(s) : (t.enter("lineEnding"), t.consume(s), t.exit("lineEnding"), o);
  }
  function o(s) {
    return r.parser.lazy[r.now().line] ? n(s) : e(s);
  }
}
const Za = {
  concrete: !0,
  name: "codeFenced",
  tokenize: gg
};
function gg(t, e, n) {
  const r = this, i = {
    partial: !0,
    tokenize: v
  };
  let o = 0, s = 0, l;
  return a;
  function a(x) {
    return c(x);
  }
  function c(x) {
    const A = r.events[r.events.length - 1];
    return o = A && A[1].type === "linePrefix" ? A[2].sliceSerialize(A[1], !0).length : 0, l = x, t.enter("codeFenced"), t.enter("codeFencedFence"), t.enter("codeFencedFenceSequence"), u(x);
  }
  function u(x) {
    return x === l ? (s++, t.consume(x), u) : s < 3 ? n(x) : (t.exit("codeFencedFenceSequence"), q(x) ? G(t, h, "whitespace")(x) : h(x));
  }
  function h(x) {
    return x === null || L(x) ? (t.exit("codeFencedFence"), r.interrupt ? e(x) : t.check(ls, m, O)(x)) : (t.enter("codeFencedFenceInfo"), t.enter("chunkString", {
      contentType: "string"
    }), d(x));
  }
  function d(x) {
    return x === null || L(x) ? (t.exit("chunkString"), t.exit("codeFencedFenceInfo"), h(x)) : q(x) ? (t.exit("chunkString"), t.exit("codeFencedFenceInfo"), G(t, f, "whitespace")(x)) : x === 96 && x === l ? n(x) : (t.consume(x), d);
  }
  function f(x) {
    return x === null || L(x) ? h(x) : (t.enter("codeFencedFenceMeta"), t.enter("chunkString", {
      contentType: "string"
    }), p(x));
  }
  function p(x) {
    return x === null || L(x) ? (t.exit("chunkString"), t.exit("codeFencedFenceMeta"), h(x)) : x === 96 && x === l ? n(x) : (t.consume(x), p);
  }
  function m(x) {
    return t.attempt(i, O, y)(x);
  }
  function y(x) {
    return t.enter("lineEnding"), t.consume(x), t.exit("lineEnding"), g;
  }
  function g(x) {
    return o > 0 && q(x) ? G(t, N, "linePrefix", o + 1)(x) : N(x);
  }
  function N(x) {
    return x === null || L(x) ? t.check(ls, m, O)(x) : (t.enter("codeFlowValue"), w(x));
  }
  function w(x) {
    return x === null || L(x) ? (t.exit("codeFlowValue"), N(x)) : (t.consume(x), w);
  }
  function O(x) {
    return t.exit("codeFenced"), e(x);
  }
  function v(x, A, R) {
    let F = 0;
    return C;
    function C(U) {
      return x.enter("lineEnding"), x.consume(U), x.exit("lineEnding"), D;
    }
    function D(U) {
      return x.enter("codeFencedFence"), q(U) ? G(x, P, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(U) : P(U);
    }
    function P(U) {
      return U === l ? (x.enter("codeFencedFenceSequence"), X(U)) : R(U);
    }
    function X(U) {
      return U === l ? (F++, x.consume(U), X) : F >= s ? (x.exit("codeFencedFenceSequence"), q(U) ? G(x, re, "whitespace")(U) : re(U)) : R(U);
    }
    function re(U) {
      return U === null || L(U) ? (x.exit("codeFencedFence"), A(U)) : R(U);
    }
  }
}
const ho = {
  name: "codeIndented",
  tokenize: kg
}, yg = {
  partial: !0,
  tokenize: bg
};
function kg(t, e, n) {
  return r;
  function r(l) {
    return t.enter("codeIndented"), hh(t, i, n, "linePrefix", 4, 4)(l);
  }
  function i(l) {
    return l === null ? s(l) : L(l) ? t.attempt(yg, i, s)(l) : (t.enter("codeFlowValue"), o(l));
  }
  function o(l) {
    return l === null || L(l) ? (t.exit("codeFlowValue"), i(l)) : (t.consume(l), o);
  }
  function s(l) {
    return t.exit("codeIndented"), e(l);
  }
}
function bg(t, e, n) {
  const r = this;
  return i;
  function i(s) {
    return r.parser.lazy[r.now().line] ? n(s) : L(s) ? (t.enter("lineEnding"), t.consume(s), t.exit("lineEnding"), i) : hh(t, e, o, "linePrefix", 4, 4)(s);
  }
  function o(s) {
    return L(s) ? i(s) : n(s);
  }
}
const xg = {
  name: "codeText",
  previous: Cg,
  resolve: wg,
  tokenize: Sg
};
function wg(t) {
  let e = t.length - 4, n = 3, r, i;
  if ((t[n][1].type === "lineEnding" || t[n][1].type === "space") && (t[e][1].type === "lineEnding" || t[e][1].type === "space")) {
    for (r = n; ++r < e; )
      if (t[r][1].type === "codeTextData") {
        t[n][1].type = "codeTextPadding", t[e][1].type = "codeTextPadding", n += 2, e -= 2;
        break;
      }
  }
  for (r = n - 1, e++; ++r <= e; )
    i === void 0 ? r !== e && t[r][1].type !== "lineEnding" && (i = r) : (r === e || t[r][1].type === "lineEnding") && (t[i][1].type = "codeTextData", r !== i + 2 && (t[i][1].end = t[r - 1][1].end, t.splice(i + 2, r - i - 2), e -= r - i - 2, r = i + 2), i = void 0);
  return t;
}
function Cg(t) {
  return t !== 96 || this.events[this.events.length - 1][1].type === "characterEscape";
}
function Sg(t, e, n) {
  let r = 0, i, o;
  return s;
  function s(h) {
    return t.enter("codeText"), t.enter("codeTextSequence"), l(h);
  }
  function l(h) {
    return h === 96 ? (t.consume(h), r++, l) : (t.exit("codeTextSequence"), a(h));
  }
  function a(h) {
    return h === null ? n(h) : h === 32 ? (t.enter("space"), t.consume(h), t.exit("space"), a) : h === 96 ? (o = t.enter("codeTextSequence"), i = 0, u(h)) : L(h) ? (t.enter("lineEnding"), t.consume(h), t.exit("lineEnding"), a) : (t.enter("codeTextData"), c(h));
  }
  function c(h) {
    return h === null || h === 32 || h === 96 || L(h) ? (t.exit("codeTextData"), a(h)) : (t.consume(h), c);
  }
  function u(h) {
    return h === 96 ? (t.consume(h), i++, u) : i === r ? (t.exit("codeTextSequence"), t.exit("codeText"), e(h)) : (o.type = "codeTextData", c(h));
  }
}
class Ng {
  /**
   * @param {ReadonlyArray<T> | null | undefined} [initial]
   *   Initial items (optional).
   * @returns
   *   Splice buffer.
   */
  constructor(e) {
    this.left = e ? [...e] : [], this.right = [];
  }
  /**
   * Array access;
   * does not move the cursor.
   *
   * @param {number} index
   *   Index.
   * @return {T}
   *   Item.
   */
  get(e) {
    if (e < 0 || e >= this.left.length + this.right.length)
      throw new RangeError("Cannot access index `" + e + "` in a splice buffer of size `" + (this.left.length + this.right.length) + "`");
    return e < this.left.length ? this.left[e] : this.right[this.right.length - e + this.left.length - 1];
  }
  /**
   * The length of the splice buffer, one greater than the largest index in the
   * array.
   */
  get length() {
    return this.left.length + this.right.length;
  }
  /**
   * Remove and return `list[0]`;
   * moves the cursor to `0`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  shift() {
    return this.setCursor(0), this.right.pop();
  }
  /**
   * Slice the buffer to get an array;
   * does not move the cursor.
   *
   * @param {number} start
   *   Start.
   * @param {number | null | undefined} [end]
   *   End (optional).
   * @returns {Array<T>}
   *   Array of items.
   */
  slice(e, n) {
    const r = n ?? Number.POSITIVE_INFINITY;
    return r < this.left.length ? this.left.slice(e, r) : e > this.left.length ? this.right.slice(this.right.length - r + this.left.length, this.right.length - e + this.left.length).reverse() : this.left.slice(e).concat(this.right.slice(this.right.length - r + this.left.length).reverse());
  }
  /**
   * Mimics the behavior of Array.prototype.splice() except for the change of
   * interface necessary to avoid segfaults when patching in very large arrays.
   *
   * This operation moves cursor is moved to `start` and results in the cursor
   * placed after any inserted items.
   *
   * @param {number} start
   *   Start;
   *   zero-based index at which to start changing the array;
   *   negative numbers count backwards from the end of the array and values
   *   that are out-of bounds are clamped to the appropriate end of the array.
   * @param {number | null | undefined} [deleteCount=0]
   *   Delete count (default: `0`);
   *   maximum number of elements to delete, starting from start.
   * @param {Array<T> | null | undefined} [items=[]]
   *   Items to include in place of the deleted items (default: `[]`).
   * @return {Array<T>}
   *   Any removed items.
   */
  splice(e, n, r) {
    const i = n || 0;
    this.setCursor(Math.trunc(e));
    const o = this.right.splice(this.right.length - i, Number.POSITIVE_INFINITY);
    return r && Zn(this.left, r), o.reverse();
  }
  /**
   * Remove and return the highest-numbered item in the array, so
   * `list[list.length - 1]`;
   * Moves the cursor to `length`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  pop() {
    return this.setCursor(Number.POSITIVE_INFINITY), this.left.pop();
  }
  /**
   * Inserts a single item to the high-numbered side of the array;
   * moves the cursor to `length`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  push(e) {
    this.setCursor(Number.POSITIVE_INFINITY), this.left.push(e);
  }
  /**
   * Inserts many items to the high-numbered side of the array.
   * Moves the cursor to `length`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  pushMany(e) {
    this.setCursor(Number.POSITIVE_INFINITY), Zn(this.left, e);
  }
  /**
   * Inserts a single item to the low-numbered side of the array;
   * Moves the cursor to `0`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  unshift(e) {
    this.setCursor(0), this.right.push(e);
  }
  /**
   * Inserts many items to the low-numbered side of the array;
   * moves the cursor to `0`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  unshiftMany(e) {
    this.setCursor(0), Zn(this.right, e.reverse());
  }
  /**
   * Move the cursor to a specific position in the array. Requires
   * time proportional to the distance moved.
   *
   * If `n < 0`, the cursor will end up at the beginning.
   * If `n > length`, the cursor will end up at the end.
   *
   * @param {number} n
   *   Position.
   * @return {undefined}
   *   Nothing.
   */
  setCursor(e) {
    if (!(e === this.left.length || e > this.left.length && this.right.length === 0 || e < 0 && this.left.length === 0))
      if (e < this.left.length) {
        const n = this.left.splice(e, Number.POSITIVE_INFINITY);
        Zn(this.right, n.reverse());
      } else {
        const n = this.right.splice(this.left.length + this.right.length - e, Number.POSITIVE_INFINITY);
        Zn(this.left, n.reverse());
      }
  }
}
function Zn(t, e) {
  let n = 0;
  if (e.length < 1e4)
    t.push(...e);
  else
    for (; n < e.length; )
      t.push(...e.slice(n, n + 1e4)), n += 1e4;
}
function mh(t) {
  const e = {};
  let n = -1, r, i, o, s, l, a, c;
  const u = new Ng(t);
  for (; ++n < u.length; ) {
    for (; n in e; )
      n = e[n];
    if (r = u.get(n), n && r[1].type === "chunkFlow" && u.get(n - 1)[1].type === "listItemPrefix" && (a = r[1]._tokenizer.events, o = 0, o < a.length && a[o][1].type === "lineEndingBlank" && (o += 2), o < a.length && a[o][1].type === "content"))
      for (; ++o < a.length && a[o][1].type !== "content"; )
        a[o][1].type === "chunkText" && (a[o][1]._isInFirstContentOfListItem = !0, o++);
    if (r[0] === "enter")
      r[1].contentType && (Object.assign(e, Mg(u, n)), n = e[n], c = !0);
    else if (r[1]._container) {
      for (o = n, i = void 0; o--; )
        if (s = u.get(o), s[1].type === "lineEnding" || s[1].type === "lineEndingBlank")
          s[0] === "enter" && (i && (u.get(i)[1].type = "lineEndingBlank"), s[1].type = "lineEnding", i = o);
        else if (!(s[1].type === "linePrefix" || s[1].type === "listItemIndent")) break;
      i && (r[1].end = {
        ...u.get(i)[1].start
      }, l = u.slice(i, n), l.unshift(r), u.splice(i, n - i + 1, l));
    }
  }
  return Xe(t, 0, Number.POSITIVE_INFINITY, u.slice(0)), !c;
}
function Mg(t, e) {
  const n = t.get(e)[1], r = t.get(e)[2];
  let i = e - 1;
  const o = [];
  let s = n._tokenizer;
  s || (s = r.parser[n.contentType](n.start), n._contentTypeTextTrailing && (s._contentTypeTextTrailing = !0));
  const l = s.events, a = [], c = {};
  let u, h, d = -1, f = n, p = 0, m = 0;
  const y = [m];
  for (; f; ) {
    for (; t.get(++i)[1] !== f; )
      ;
    o.push(i), f._tokenizer || (u = r.sliceStream(f), f.next || u.push(null), h && s.defineSkip(f.start), f._isInFirstContentOfListItem && (s._gfmTasklistFirstContentOfListItem = !0), s.write(u), f._isInFirstContentOfListItem && (s._gfmTasklistFirstContentOfListItem = void 0)), h = f, f = f.next;
  }
  for (f = n; ++d < l.length; )
    // Find a void token that includes a break.
    l[d][0] === "exit" && l[d - 1][0] === "enter" && l[d][1].type === l[d - 1][1].type && l[d][1].start.line !== l[d][1].end.line && (m = d + 1, y.push(m), f._tokenizer = void 0, f.previous = void 0, f = f.next);
  for (s.events = [], f ? (f._tokenizer = void 0, f.previous = void 0) : y.pop(), d = y.length; d--; ) {
    const g = l.slice(y[d], y[d + 1]), N = o.pop();
    a.push([N, N + g.length - 1]), t.splice(N, 2, g);
  }
  for (a.reverse(), d = -1; ++d < a.length; )
    c[p + a[d][0]] = p + a[d][1], p += a[d][1] - a[d][0] - 1;
  return c;
}
const Tg = {
  resolve: Ig,
  tokenize: Eg
}, Ag = {
  partial: !0,
  tokenize: Og
};
function Ig(t) {
  return mh(t), t;
}
function Eg(t, e) {
  let n;
  return r;
  function r(l) {
    return t.enter("content"), n = t.enter("chunkContent", {
      contentType: "content"
    }), i(l);
  }
  function i(l) {
    return l === null ? o(l) : L(l) ? t.check(Ag, s, o)(l) : (t.consume(l), i);
  }
  function o(l) {
    return t.exit("chunkContent"), t.exit("content"), e(l);
  }
  function s(l) {
    return t.consume(l), t.exit("chunkContent"), n.next = t.enter("chunkContent", {
      contentType: "content",
      previous: n
    }), n = n.next, i;
  }
}
function Og(t, e, n) {
  const r = this;
  return i;
  function i(s) {
    return t.exit("chunkContent"), t.enter("lineEnding"), t.consume(s), t.exit("lineEnding"), G(t, o, "linePrefix");
  }
  function o(s) {
    if (s === null || L(s))
      return n(s);
    const l = r.events[r.events.length - 1];
    return !r.parser.constructs.disable.null.includes("codeIndented") && l && l[1].type === "linePrefix" && l[2].sliceSerialize(l[1], !0).length >= 4 ? e(s) : t.interrupt(r.parser.constructs.flow, n, e)(s);
  }
}
function gh(t, e, n, r, i, o, s, l, a) {
  const c = a || Number.POSITIVE_INFINITY;
  let u = 0;
  return h;
  function h(g) {
    return g === 60 ? (t.enter(r), t.enter(i), t.enter(o), t.consume(g), t.exit(o), d) : g === null || g === 32 || g === 41 || Ni(g) ? n(g) : (t.enter(r), t.enter(s), t.enter(l), t.enter("chunkString", {
      contentType: "string"
    }), m(g));
  }
  function d(g) {
    return g === 62 ? (t.enter(o), t.consume(g), t.exit(o), t.exit(i), t.exit(r), e) : (t.enter(l), t.enter("chunkString", {
      contentType: "string"
    }), f(g));
  }
  function f(g) {
    return g === 62 ? (t.exit("chunkString"), t.exit(l), d(g)) : g === null || g === 60 || L(g) ? n(g) : (t.consume(g), g === 92 ? p : f);
  }
  function p(g) {
    return g === 60 || g === 62 || g === 92 ? (t.consume(g), f) : f(g);
  }
  function m(g) {
    return !u && (g === null || g === 41 || ee(g)) ? (t.exit("chunkString"), t.exit(l), t.exit(s), t.exit(r), e(g)) : u < c && g === 40 ? (t.consume(g), u++, m) : g === 41 ? (t.consume(g), u--, m) : g === null || g === 32 || g === 40 || Ni(g) ? n(g) : (t.consume(g), g === 92 ? y : m);
  }
  function y(g) {
    return g === 40 || g === 41 || g === 92 ? (t.consume(g), m) : m(g);
  }
}
function yh(t, e, n, r, i, o) {
  const s = this;
  let l = 0, a;
  return c;
  function c(f) {
    return t.enter(r), t.enter(i), t.consume(f), t.exit(i), t.enter(o), u;
  }
  function u(f) {
    return l > 999 || f === null || f === 91 || f === 93 && !a || // To do: remove in the future once we’ve switched from
    // `micromark-extension-footnote` to `micromark-extension-gfm-footnote`,
    // which doesn’t need this.
    // Hidden footnotes hook.
    /* c8 ignore next 3 */
    f === 94 && !l && "_hiddenFootnoteSupport" in s.parser.constructs ? n(f) : f === 93 ? (t.exit(o), t.enter(i), t.consume(f), t.exit(i), t.exit(r), e) : L(f) ? (t.enter("lineEnding"), t.consume(f), t.exit("lineEnding"), u) : (t.enter("chunkString", {
      contentType: "string"
    }), h(f));
  }
  function h(f) {
    return f === null || f === 91 || f === 93 || L(f) || l++ > 999 ? (t.exit("chunkString"), u(f)) : (t.consume(f), a || (a = !q(f)), f === 92 ? d : h);
  }
  function d(f) {
    return f === 91 || f === 92 || f === 93 ? (t.consume(f), l++, h) : h(f);
  }
}
function kh(t, e, n, r, i, o) {
  let s;
  return l;
  function l(d) {
    return d === 34 || d === 39 || d === 40 ? (t.enter(r), t.enter(i), t.consume(d), t.exit(i), s = d === 40 ? 41 : d, a) : n(d);
  }
  function a(d) {
    return d === s ? (t.enter(i), t.consume(d), t.exit(i), t.exit(r), e) : (t.enter(o), c(d));
  }
  function c(d) {
    return d === s ? (t.exit(o), a(s)) : d === null ? n(d) : L(d) ? (t.enter("lineEnding"), t.consume(d), t.exit("lineEnding"), G(t, c, "linePrefix")) : (t.enter("chunkString", {
      contentType: "string"
    }), u(d));
  }
  function u(d) {
    return d === s || d === null || L(d) ? (t.exit("chunkString"), c(d)) : (t.consume(d), d === 92 ? h : u);
  }
  function h(d) {
    return d === s || d === 92 ? (t.consume(d), u) : u(d);
  }
}
function ar(t, e) {
  let n;
  return r;
  function r(i) {
    return L(i) ? (t.enter("lineEnding"), t.consume(i), t.exit("lineEnding"), n = !0, r) : q(i) ? G(t, r, n ? "linePrefix" : "lineSuffix")(i) : e(i);
  }
}
const vg = {
  name: "definition",
  tokenize: Rg
}, Dg = {
  partial: !0,
  tokenize: zg
};
function Rg(t, e, n) {
  const r = this;
  let i;
  return o;
  function o(f) {
    return t.enter("definition"), s(f);
  }
  function s(f) {
    return yh.call(
      r,
      t,
      l,
      // Note: we don’t need to reset the way `markdown-rs` does.
      n,
      "definitionLabel",
      "definitionLabelMarker",
      "definitionLabelString"
    )(f);
  }
  function l(f) {
    return i = Ze(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1)), f === 58 ? (t.enter("definitionMarker"), t.consume(f), t.exit("definitionMarker"), a) : n(f);
  }
  function a(f) {
    return ee(f) ? ar(t, c)(f) : c(f);
  }
  function c(f) {
    return gh(
      t,
      u,
      // Note: we don’t need to reset the way `markdown-rs` does.
      n,
      "definitionDestination",
      "definitionDestinationLiteral",
      "definitionDestinationLiteralMarker",
      "definitionDestinationRaw",
      "definitionDestinationString"
    )(f);
  }
  function u(f) {
    return t.attempt(Dg, h, h)(f);
  }
  function h(f) {
    return q(f) ? G(t, d, "whitespace")(f) : d(f);
  }
  function d(f) {
    return f === null || L(f) ? (t.exit("definition"), r.parser.defined.push(i), e(f)) : n(f);
  }
}
function zg(t, e, n) {
  return r;
  function r(l) {
    return ee(l) ? ar(t, i)(l) : n(l);
  }
  function i(l) {
    return kh(t, o, n, "definitionTitle", "definitionTitleMarker", "definitionTitleString")(l);
  }
  function o(l) {
    return q(l) ? G(t, s, "whitespace")(l) : s(l);
  }
  function s(l) {
    return l === null || L(l) ? e(l) : n(l);
  }
}
const Pg = {
  name: "hardBreakEscape",
  tokenize: Lg
};
function Lg(t, e, n) {
  return r;
  function r(o) {
    return t.enter("hardBreakEscape"), t.consume(o), i;
  }
  function i(o) {
    return L(o) ? (t.exit("hardBreakEscape"), e(o)) : n(o);
  }
}
const Bg = {
  name: "headingAtx",
  resolve: Fg,
  tokenize: _g
};
function Fg(t, e) {
  let n = t.length - 2, r = 3;
  if (t[r][1].type === "whitespace" && (r += 2), n - 2 > r && t[n][1].type === "whitespace" && (n -= 2), t[n][1].type === "atxHeadingSequence" && (r === n - 1 || n - 4 > r && t[n - 2][1].type === "whitespace") && (n -= r + 1 === n ? 2 : 4), n > r) {
    const i = {
      type: "atxHeadingText",
      start: t[r][1].start,
      end: t[n][1].end
    }, o = {
      type: "chunkText",
      start: t[r][1].start,
      end: t[n][1].end,
      contentType: "text"
    };
    Xe(t, r, n - r + 1, [["enter", i, e], ["enter", o, e], ["exit", o, e], ["exit", i, e]]);
  }
  return t;
}
function _g(t, e, n) {
  let r = 0;
  return i;
  function i(u) {
    return t.enter("atxHeading"), o(u);
  }
  function o(u) {
    return t.enter("atxHeadingSequence"), s(u);
  }
  function s(u) {
    return u === 35 && r++ < 6 ? (t.consume(u), s) : u === null || ee(u) ? (t.exit("atxHeadingSequence"), l(u)) : n(u);
  }
  function l(u) {
    return u === 35 ? (t.enter("atxHeadingSequence"), a(u)) : u === null || L(u) ? (t.exit("atxHeading"), e(u)) : q(u) ? G(t, l, "whitespace")(u) : (t.enter("atxHeadingText"), c(u));
  }
  function a(u) {
    return u === 35 ? (t.consume(u), a) : (t.exit("atxHeadingSequence"), l(u));
  }
  function c(u) {
    return u === null || u === 35 || ee(u) ? (t.exit("atxHeadingText"), l(u)) : (t.consume(u), c);
  }
}
const bh = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
], as = ["pre", "script", "style", "textarea"], $g = {
  concrete: !0,
  name: "htmlFlow",
  resolveTo: Hg,
  tokenize: jg
}, Vg = {
  partial: !0,
  tokenize: qg
};
function Hg(t) {
  let e = t.length;
  for (; e-- && !(t[e][0] === "enter" && t[e][1].type === "htmlFlow"); )
    ;
  return e > 1 && t[e - 2][1].type === "linePrefix" && (t[e][1].start = t[e - 2][1].start, t[e + 1][1].start = t[e - 2][1].start, t.splice(e - 2, 2)), t;
}
function jg(t, e, n) {
  const r = this;
  let i, o, s, l, a;
  return c;
  function c(b) {
    return u(b);
  }
  function u(b) {
    return t.enter("htmlFlow"), t.enter("htmlFlowData"), t.consume(b), h;
  }
  function h(b) {
    return b === 33 ? (t.consume(b), d) : b === 47 ? (t.consume(b), o = !0, m) : b === 63 ? (t.consume(b), i = 3, r.interrupt ? e : k) : de(b) ? (t.consume(b), s = String.fromCharCode(b), y) : n(b);
  }
  function d(b) {
    return b === 45 ? (t.consume(b), i = 2, f) : b === 91 ? (t.consume(b), i = 5, l = 0, p) : de(b) ? (t.consume(b), i = 4, r.interrupt ? e : k) : n(b);
  }
  function f(b) {
    return b === 45 ? (t.consume(b), r.interrupt ? e : k) : n(b);
  }
  function p(b) {
    const Ye = "CDATA[";
    return b === Ye.charCodeAt(l++) ? (t.consume(b), l === Ye.length ? r.interrupt ? e : P : p) : n(b);
  }
  function m(b) {
    return de(b) ? (t.consume(b), s = String.fromCharCode(b), y) : n(b);
  }
  function y(b) {
    if (b === null || b === 47 || b === 62 || ee(b)) {
      const Ye = b === 47, Xt = s.toLowerCase();
      return !Ye && !o && as.includes(Xt) ? (i = 1, r.interrupt ? e(b) : P(b)) : bh.includes(s.toLowerCase()) ? (i = 6, Ye ? (t.consume(b), g) : r.interrupt ? e(b) : P(b)) : (i = 7, r.interrupt && !r.parser.lazy[r.now().line] ? n(b) : o ? N(b) : w(b));
    }
    return b === 45 || Ce(b) ? (t.consume(b), s += String.fromCharCode(b), y) : n(b);
  }
  function g(b) {
    return b === 62 ? (t.consume(b), r.interrupt ? e : P) : n(b);
  }
  function N(b) {
    return q(b) ? (t.consume(b), N) : C(b);
  }
  function w(b) {
    return b === 47 ? (t.consume(b), C) : b === 58 || b === 95 || de(b) ? (t.consume(b), O) : q(b) ? (t.consume(b), w) : C(b);
  }
  function O(b) {
    return b === 45 || b === 46 || b === 58 || b === 95 || Ce(b) ? (t.consume(b), O) : v(b);
  }
  function v(b) {
    return b === 61 ? (t.consume(b), x) : q(b) ? (t.consume(b), v) : w(b);
  }
  function x(b) {
    return b === null || b === 60 || b === 61 || b === 62 || b === 96 ? n(b) : b === 34 || b === 39 ? (t.consume(b), a = b, A) : q(b) ? (t.consume(b), x) : R(b);
  }
  function A(b) {
    return b === a ? (t.consume(b), a = null, F) : b === null || L(b) ? n(b) : (t.consume(b), A);
  }
  function R(b) {
    return b === null || b === 34 || b === 39 || b === 47 || b === 60 || b === 61 || b === 62 || b === 96 || ee(b) ? v(b) : (t.consume(b), R);
  }
  function F(b) {
    return b === 47 || b === 62 || q(b) ? w(b) : n(b);
  }
  function C(b) {
    return b === 62 ? (t.consume(b), D) : n(b);
  }
  function D(b) {
    return b === null || L(b) ? P(b) : q(b) ? (t.consume(b), D) : n(b);
  }
  function P(b) {
    return b === 45 && i === 2 ? (t.consume(b), ge) : b === 60 && i === 1 ? (t.consume(b), ae) : b === 62 && i === 4 ? (t.consume(b), Ge) : b === 63 && i === 3 ? (t.consume(b), k) : b === 93 && i === 5 ? (t.consume(b), ft) : L(b) && (i === 6 || i === 7) ? (t.exit("htmlFlowData"), t.check(Vg, dt, X)(b)) : b === null || L(b) ? (t.exit("htmlFlowData"), X(b)) : (t.consume(b), P);
  }
  function X(b) {
    return t.check(ls, re, dt)(b);
  }
  function re(b) {
    return t.enter("lineEnding"), t.consume(b), t.exit("lineEnding"), U;
  }
  function U(b) {
    return b === null || L(b) ? X(b) : (t.enter("htmlFlowData"), P(b));
  }
  function ge(b) {
    return b === 45 ? (t.consume(b), k) : P(b);
  }
  function ae(b) {
    return b === 47 ? (t.consume(b), s = "", Je) : P(b);
  }
  function Je(b) {
    if (b === 62) {
      const Ye = s.toLowerCase();
      return as.includes(Ye) ? (t.consume(b), Ge) : P(b);
    }
    return de(b) && s.length < 8 ? (t.consume(b), s += String.fromCharCode(b), Je) : P(b);
  }
  function ft(b) {
    return b === 93 ? (t.consume(b), k) : P(b);
  }
  function k(b) {
    return b === 62 ? (t.consume(b), Ge) : b === 45 && i === 2 ? (t.consume(b), k) : P(b);
  }
  function Ge(b) {
    return b === null || L(b) ? (t.exit("htmlFlowData"), dt(b)) : (t.consume(b), Ge);
  }
  function dt(b) {
    return t.exit("htmlFlow"), e(b);
  }
}
function qg(t, e, n) {
  return r;
  function r(i) {
    return t.enter("lineEnding"), t.consume(i), t.exit("lineEnding"), t.attempt(zr, e, n);
  }
}
const Wg = {
  name: "htmlText",
  tokenize: Kg
};
function Kg(t, e, n) {
  const r = this;
  let i, o, s;
  return l;
  function l(k) {
    return t.enter("htmlText"), t.enter("htmlTextData"), t.consume(k), a;
  }
  function a(k) {
    return k === 33 ? (t.consume(k), c) : k === 47 ? (t.consume(k), v) : k === 63 ? (t.consume(k), w) : de(k) ? (t.consume(k), R) : n(k);
  }
  function c(k) {
    return k === 45 ? (t.consume(k), u) : k === 91 ? (t.consume(k), o = 0, p) : de(k) ? (t.consume(k), N) : n(k);
  }
  function u(k) {
    return k === 45 ? (t.consume(k), f) : n(k);
  }
  function h(k) {
    return k === null ? n(k) : k === 45 ? (t.consume(k), d) : L(k) ? (s = h, ae(k)) : (t.consume(k), h);
  }
  function d(k) {
    return k === 45 ? (t.consume(k), f) : h(k);
  }
  function f(k) {
    return k === 62 ? ge(k) : k === 45 ? d(k) : h(k);
  }
  function p(k) {
    const Ge = "CDATA[";
    return k === Ge.charCodeAt(o++) ? (t.consume(k), o === Ge.length ? m : p) : n(k);
  }
  function m(k) {
    return k === null ? n(k) : k === 93 ? (t.consume(k), y) : L(k) ? (s = m, ae(k)) : (t.consume(k), m);
  }
  function y(k) {
    return k === 93 ? (t.consume(k), g) : m(k);
  }
  function g(k) {
    return k === 62 ? ge(k) : k === 93 ? (t.consume(k), g) : m(k);
  }
  function N(k) {
    return k === null || k === 62 ? ge(k) : L(k) ? (s = N, ae(k)) : (t.consume(k), N);
  }
  function w(k) {
    return k === null ? n(k) : k === 63 ? (t.consume(k), O) : L(k) ? (s = w, ae(k)) : (t.consume(k), w);
  }
  function O(k) {
    return k === 62 ? ge(k) : w(k);
  }
  function v(k) {
    return de(k) ? (t.consume(k), x) : n(k);
  }
  function x(k) {
    return k === 45 || Ce(k) ? (t.consume(k), x) : A(k);
  }
  function A(k) {
    return L(k) ? (s = A, ae(k)) : q(k) ? (t.consume(k), A) : ge(k);
  }
  function R(k) {
    return k === 45 || Ce(k) ? (t.consume(k), R) : k === 47 || k === 62 || ee(k) ? F(k) : n(k);
  }
  function F(k) {
    return k === 47 ? (t.consume(k), ge) : k === 58 || k === 95 || de(k) ? (t.consume(k), C) : L(k) ? (s = F, ae(k)) : q(k) ? (t.consume(k), F) : ge(k);
  }
  function C(k) {
    return k === 45 || k === 46 || k === 58 || k === 95 || Ce(k) ? (t.consume(k), C) : D(k);
  }
  function D(k) {
    return k === 61 ? (t.consume(k), P) : L(k) ? (s = D, ae(k)) : q(k) ? (t.consume(k), D) : F(k);
  }
  function P(k) {
    return k === null || k === 60 || k === 61 || k === 62 || k === 96 ? n(k) : k === 34 || k === 39 ? (t.consume(k), i = k, X) : L(k) ? (s = P, ae(k)) : q(k) ? (t.consume(k), P) : (t.consume(k), re);
  }
  function X(k) {
    return k === i ? (t.consume(k), i = void 0, U) : k === null ? n(k) : L(k) ? (s = X, ae(k)) : (t.consume(k), X);
  }
  function re(k) {
    return k === null || k === 34 || k === 39 || k === 60 || k === 61 || k === 96 ? n(k) : k === 47 || k === 62 || ee(k) ? F(k) : (t.consume(k), re);
  }
  function U(k) {
    return k === 47 || k === 62 || ee(k) ? F(k) : n(k);
  }
  function ge(k) {
    return k === 62 ? (t.consume(k), t.exit("htmlTextData"), t.exit("htmlText"), e) : n(k);
  }
  function ae(k) {
    return t.exit("htmlTextData"), t.enter("lineEnding"), t.consume(k), t.exit("lineEnding"), Je;
  }
  function Je(k) {
    return q(k) ? G(t, ft, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(k) : ft(k);
  }
  function ft(k) {
    return t.enter("htmlTextData"), s(k);
  }
}
const tl = {
  name: "labelEnd",
  resolveAll: Yg,
  resolveTo: Qg,
  tokenize: Xg
}, Ug = {
  tokenize: Zg
}, Jg = {
  tokenize: ey
}, Gg = {
  tokenize: ty
};
function Yg(t) {
  let e = -1;
  const n = [];
  for (; ++e < t.length; ) {
    const r = t[e][1];
    if (n.push(t[e]), r.type === "labelImage" || r.type === "labelLink" || r.type === "labelEnd") {
      const i = r.type === "labelImage" ? 4 : 2;
      r.type = "data", e += i;
    }
  }
  return t.length !== n.length && Xe(t, 0, t.length, n), t;
}
function Qg(t, e) {
  let n = t.length, r = 0, i, o, s;
  for (; n--; ) {
    const u = t[n][1];
    if (i) {
      if (u.type === "link" || u.type === "labelLink" && u._inactive)
        break;
      t[n][0] === "enter" && u.type === "labelLink" && (u._inactive = !0);
    } else if (o) {
      if (t[n][0] === "enter" && (u.type === "labelImage" || u.type === "labelLink") && !u._balanced && (i = n, u.type !== "labelLink")) {
        r = 2;
        break;
      }
    } else u.type === "labelEnd" && (o = n);
  }
  const l = {
    type: t[i][1].type === "labelLink" ? "link" : "image",
    start: {
      ...t[i][1].start
    },
    end: {
      ...t[t.length - 1][1].end
    }
  }, a = {
    type: "label",
    start: {
      ...t[i][1].start
    },
    end: {
      ...t[o][1].end
    }
  }, c = {
    type: "labelText",
    start: {
      ...t[i + r + 2][1].end
    },
    end: {
      ...t[o - 2][1].start
    }
  };
  return s = [["enter", l, e], ["enter", a, e]], s = Ve(s, t.slice(i + 1, i + r + 3)), s = Ve(s, [["enter", c, e]]), s = Ve(s, Ki(e.parser.constructs.insideSpan.null, t.slice(i + r + 4, o - 3), e)), s = Ve(s, [["exit", c, e], t[o - 2], t[o - 1], ["exit", a, e]]), s = Ve(s, t.slice(o + 1)), s = Ve(s, [["exit", l, e]]), Xe(t, i, t.length, s), t;
}
function Xg(t, e, n) {
  const r = this, i = r._labelStarts;
  let o, s;
  if (i) {
    for (; i.length > 0 && i[i.length - 1]._balanced; )
      i.pop();
    o = i[i.length - 1];
  }
  return l;
  function l(d) {
    return o ? o._inactive ? h(d) : (s = r.parser.defined.includes(Ze(r.sliceSerialize({
      start: o.end,
      end: r.now()
    }))), t.enter("labelEnd"), t.enter("labelMarker"), t.consume(d), t.exit("labelMarker"), t.exit("labelEnd"), a) : n(d);
  }
  function a(d) {
    return d === 40 ? t.attempt(Ug, u, s ? u : h)(d) : d === 91 ? t.attempt(Jg, u, s ? c : h)(d) : s ? u(d) : h(d);
  }
  function c(d) {
    return t.attempt(Gg, u, h)(d);
  }
  function u(d) {
    return i.pop(), e(d);
  }
  function h(d) {
    return o._balanced = !0, n(d);
  }
}
function Zg(t, e, n) {
  return r;
  function r(h) {
    return t.enter("resource"), t.enter("resourceMarker"), t.consume(h), t.exit("resourceMarker"), i;
  }
  function i(h) {
    return ee(h) ? ar(t, o)(h) : o(h);
  }
  function o(h) {
    return h === 41 ? u(h) : gh(t, s, l, "resourceDestination", "resourceDestinationLiteral", "resourceDestinationLiteralMarker", "resourceDestinationRaw", "resourceDestinationString", 32)(h);
  }
  function s(h) {
    return ee(h) ? ar(t, a)(h) : u(h);
  }
  function l(h) {
    return n(h);
  }
  function a(h) {
    return h === 34 || h === 39 || h === 40 ? kh(t, c, n, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(h) : u(h);
  }
  function c(h) {
    return ee(h) ? ar(t, u)(h) : u(h);
  }
  function u(h) {
    return h === 41 ? (t.enter("resourceMarker"), t.consume(h), t.exit("resourceMarker"), t.exit("resource"), e) : n(h);
  }
}
function ey(t, e, n) {
  const r = this;
  return i;
  function i(l) {
    return yh.call(r, t, o, s, "reference", "referenceMarker", "referenceString")(l);
  }
  function o(l) {
    return r.parser.defined.includes(Ze(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1))) ? e(l) : n(l);
  }
  function s(l) {
    return n(l);
  }
}
function ty(t, e, n) {
  return r;
  function r(o) {
    return t.enter("reference"), t.enter("referenceMarker"), t.consume(o), t.exit("referenceMarker"), i;
  }
  function i(o) {
    return o === 93 ? (t.enter("referenceMarker"), t.consume(o), t.exit("referenceMarker"), t.exit("reference"), e) : n(o);
  }
}
const ny = {
  name: "labelStartImage",
  resolveAll: tl.resolveAll,
  tokenize: ry
};
function ry(t, e, n) {
  const r = this;
  let i;
  return o;
  function o(a) {
    return t.enter("labelImage"), t.enter("labelImageMarker"), t.consume(a), t.exit("labelImageMarker"), s;
  }
  function s(a) {
    return a === 91 ? (t.enter("labelMarker"), t.consume(a), t.exit("labelMarker"), i = t.exit("labelImage"), l) : n(a);
  }
  function l(a) {
    return a === 94 && "_hiddenFootnoteSupport" in r.parser.constructs ? n(a) : (r._labelStarts = r._labelStarts || [], r._labelStarts.push(i), e(a));
  }
}
const iy = {
  name: "labelStartLink",
  resolveAll: tl.resolveAll,
  tokenize: oy
};
function oy(t, e, n) {
  const r = this;
  let i;
  return o;
  function o(l) {
    return t.enter("labelLink"), t.enter("labelMarker"), t.consume(l), t.exit("labelMarker"), i = t.exit("labelLink"), s;
  }
  function s(l) {
    return l === 94 && "_hiddenFootnoteSupport" in r.parser.constructs ? n(l) : (r._labelStarts = r._labelStarts || [], r._labelStarts.push(i), e(l));
  }
}
const fo = {
  name: "lineEnding",
  tokenize: sy
};
function sy(t, e) {
  return n;
  function n(r) {
    return t.enter("lineEnding"), t.consume(r), t.exit("lineEnding"), G(t, e, "linePrefix");
  }
}
const ci = {
  name: "thematicBreak",
  tokenize: ly
};
function ly(t, e, n) {
  let r = 0, i;
  return o;
  function o(c) {
    return t.enter("thematicBreak"), s(c);
  }
  function s(c) {
    return i = c, l(c);
  }
  function l(c) {
    return c === i ? (t.enter("thematicBreakSequence"), a(c)) : r >= 3 && (c === null || L(c)) ? (t.exit("thematicBreak"), e(c)) : n(c);
  }
  function a(c) {
    return c === i ? (t.consume(c), r++, a) : (t.exit("thematicBreakSequence"), q(c) ? G(t, l, "whitespace")(c) : l(c));
  }
}
const Me = {
  continuation: {
    tokenize: hy
  },
  exit: dy,
  name: "list",
  tokenize: uy
}, ay = {
  partial: !0,
  tokenize: py
}, cy = {
  partial: !0,
  tokenize: fy
};
function uy(t, e, n) {
  const r = this, i = r.events[r.events.length - 1];
  let o = i && i[1].type === "linePrefix" ? i[2].sliceSerialize(i[1], !0).length : 0, s = 0;
  return l;
  function l(f) {
    const p = r.containerState.type || (f === 42 || f === 43 || f === 45 ? "listUnordered" : "listOrdered");
    if (p === "listUnordered" ? !r.containerState.marker || f === r.containerState.marker : is(f)) {
      if (r.containerState.type || (r.containerState.type = p, t.enter(p, {
        _container: !0
      })), p === "listUnordered")
        return t.enter("listItemPrefix"), f === 42 || f === 45 ? t.check(ci, n, c)(f) : c(f);
      if (!r.interrupt || f === 49)
        return t.enter("listItemPrefix"), t.enter("listItemValue"), a(f);
    }
    return n(f);
  }
  function a(f) {
    return is(f) && ++s < 10 ? (t.consume(f), a) : (!r.interrupt || s < 2) && (r.containerState.marker ? f === r.containerState.marker : f === 41 || f === 46) ? (t.exit("listItemValue"), c(f)) : n(f);
  }
  function c(f) {
    return t.enter("listItemMarker"), t.consume(f), t.exit("listItemMarker"), r.containerState.marker = r.containerState.marker || f, t.check(
      zr,
      // Can’t be empty when interrupting.
      r.interrupt ? n : u,
      t.attempt(ay, d, h)
    );
  }
  function u(f) {
    return r.containerState.initialBlankLine = !0, o++, d(f);
  }
  function h(f) {
    return q(f) ? (t.enter("listItemPrefixWhitespace"), t.consume(f), t.exit("listItemPrefixWhitespace"), d) : n(f);
  }
  function d(f) {
    return r.containerState.size = o + r.sliceSerialize(t.exit("listItemPrefix"), !0).length, e(f);
  }
}
function hy(t, e, n) {
  const r = this;
  return r.containerState._closeFlow = void 0, t.check(zr, i, o);
  function i(l) {
    return r.containerState.furtherBlankLines = r.containerState.furtherBlankLines || r.containerState.initialBlankLine, G(t, e, "listItemIndent", r.containerState.size + 1)(l);
  }
  function o(l) {
    return r.containerState.furtherBlankLines || !q(l) ? (r.containerState.furtherBlankLines = void 0, r.containerState.initialBlankLine = void 0, s(l)) : (r.containerState.furtherBlankLines = void 0, r.containerState.initialBlankLine = void 0, t.attempt(cy, e, s)(l));
  }
  function s(l) {
    return r.containerState._closeFlow = !0, r.interrupt = void 0, G(t, t.attempt(Me, e, n), "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(l);
  }
}
function fy(t, e, n) {
  const r = this;
  return G(t, i, "listItemIndent", r.containerState.size + 1);
  function i(o) {
    const s = r.events[r.events.length - 1];
    return s && s[1].type === "listItemIndent" && s[2].sliceSerialize(s[1], !0).length === r.containerState.size ? e(o) : n(o);
  }
}
function dy(t) {
  t.exit(this.containerState.type);
}
function py(t, e, n) {
  const r = this;
  return G(t, i, "listItemPrefixWhitespace", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 5);
  function i(o) {
    const s = r.events[r.events.length - 1];
    return !q(o) && s && s[1].type === "listItemPrefixWhitespace" ? e(o) : n(o);
  }
}
const ec = {
  name: "setextUnderline",
  resolveTo: my,
  tokenize: gy
};
function my(t, e) {
  const n = new Mi();
  let r = t.length, i, o, s;
  for (; r--; )
    if (t[r][0] === "enter") {
      if (t[r][1].type === "content") {
        i = r;
        break;
      }
      t[r][1].type === "paragraph" && (o = r);
    } else
      t[r][1].type === "content" && n.add(r, 1, []), !s && t[r][1].type === "definition" && (s = r);
  const l = {
    type: "setextHeading",
    start: {
      ...t[i][1].start
    },
    end: {
      ...t[t.length - 1][1].end
    }
  };
  return t[o][1].type = "setextHeadingText", s ? (n.add(o, 0, [["enter", l, e]]), n.add(s + 1, 0, [["exit", t[i][1], e]]), t[i][1].end = {
    ...t[s][1].end
  }) : t[i][1] = l, n.add(t.length, 0, [["exit", l, e]]), n.consume(t), t;
}
function gy(t, e, n) {
  const r = this;
  let i;
  return o;
  function o(c) {
    let u = r.events.length, h;
    for (; u--; )
      if (r.events[u][1].type !== "lineEnding" && r.events[u][1].type !== "linePrefix" && r.events[u][1].type !== "content") {
        h = r.events[u][1].type === "paragraph";
        break;
      }
    return !r.parser.lazy[r.now().line] && (r.interrupt || h) ? (t.enter("setextHeadingLine"), i = c, s(c)) : n(c);
  }
  function s(c) {
    return t.enter("setextHeadingLineSequence"), l(c);
  }
  function l(c) {
    return c === i ? (t.consume(c), l) : (t.exit("setextHeadingLineSequence"), q(c) ? G(t, a, "lineSuffix")(c) : a(c));
  }
  function a(c) {
    return c === null || L(c) ? (t.exit("setextHeadingLine"), e(c)) : n(c);
  }
}
const yy = {
  tokenize: ky
};
function ky(t) {
  const e = this, n = t.attempt(
    // Try to parse a blank line.
    zr,
    r,
    // Try to parse initial flow (essentially, only code).
    t.attempt(this.parser.constructs.flowInitial, i, G(t, t.attempt(this.parser.constructs.flow, i, t.attempt(Tg, i)), "linePrefix"))
  );
  return n;
  function r(o) {
    if (o === null) {
      t.consume(o);
      return;
    }
    return t.enter("lineEndingBlank"), t.consume(o), t.exit("lineEndingBlank"), e.currentConstruct = void 0, n;
  }
  function i(o) {
    if (o === null) {
      t.consume(o);
      return;
    }
    return t.enter("lineEnding"), t.consume(o), t.exit("lineEnding"), e.currentConstruct = void 0, n;
  }
}
const by = {
  resolveAll: wh()
}, xy = xh("string"), wy = xh("text");
function xh(t) {
  return {
    resolveAll: wh(t === "text" ? Cy : void 0),
    tokenize: e
  };
  function e(n) {
    const r = this, i = this.parser.constructs[t], o = n.attempt(i, s, l);
    return s;
    function s(u) {
      return c(u) ? o(u) : l(u);
    }
    function l(u) {
      if (u === null) {
        n.consume(u);
        return;
      }
      return n.enter("data"), n.consume(u), a;
    }
    function a(u) {
      return c(u) ? (n.exit("data"), o(u)) : (n.consume(u), a);
    }
    function c(u) {
      if (u === null)
        return !0;
      const h = i[u];
      let d = -1;
      if (h)
        for (; ++d < h.length; ) {
          const f = h[d];
          if (!f.previous || f.previous.call(r, r.previous))
            return !0;
        }
      return !1;
    }
  }
}
function wh(t) {
  return e;
  function e(n, r) {
    let i = -1, o;
    for (; ++i <= n.length; )
      o === void 0 ? n[i] && n[i][1].type === "data" && (o = i, i++) : (!n[i] || n[i][1].type !== "data") && (i !== o + 2 && (n[o][1].end = n[i - 1][1].end, n.splice(o + 2, i - o - 2), i = o + 2), o = void 0);
    return t ? t(n, r) : n;
  }
}
function Cy(t, e) {
  const n = new Mi();
  let r = 0;
  for (; ++r <= t.length; )
    if ((r === t.length || t[r][1].type === "lineEnding") && t[r - 1][1].type === "data") {
      const i = t[r - 1][1], o = e.sliceStream(i);
      let s = o.length, l = -1, a = 0, c;
      for (; s--; ) {
        const u = o[s];
        if (typeof u == "string") {
          for (l = u.length; u.charCodeAt(l - 1) === 32; )
            a++, l--;
          if (l)
            break;
          l = -1;
        } else if (u === -2)
          c = !0, a++;
        else if (u !== -1) {
          s++;
          break;
        }
      }
      if (e._contentTypeTextTrailing && r === t.length && (a = 0), a) {
        const u = {
          type: r === t.length || c || a < 2 ? "lineSuffix" : "hardBreakTrailing",
          start: {
            _bufferIndex: s ? l : i.start._bufferIndex + l,
            _index: i.start._index + s,
            line: i.end.line,
            column: i.end.column - a,
            offset: i.end.offset - a
          },
          end: {
            ...i.end
          }
        };
        i.end = {
          ...u.start
        }, i.start.offset === i.end.offset ? Object.assign(i, u) : n.add(r, 0, [["enter", u, e], ["exit", u, e]]);
      }
      r++;
    }
  return n.consume(t), t;
}
const Sy = {
  42: Me,
  43: Me,
  45: Me,
  48: Me,
  49: Me,
  50: Me,
  51: Me,
  52: Me,
  53: Me,
  54: Me,
  55: Me,
  56: Me,
  57: Me,
  62: fh
}, Ny = {
  91: vg
}, My = {
  [-2]: ho,
  [-1]: ho,
  32: ho
}, Ty = {
  35: Bg,
  42: ci,
  45: [ec, ci],
  60: $g,
  61: ec,
  95: ci,
  96: Za,
  126: Za
}, Ay = {
  38: ph,
  92: dh
}, Iy = {
  [-5]: fo,
  [-4]: fo,
  [-3]: fo,
  33: ny,
  38: ph,
  42: ss,
  60: [lg, Wg],
  91: iy,
  92: [Pg, dh],
  93: tl,
  95: ss,
  96: xg
}, Ey = {
  null: [ss, by]
}, Oy = {
  null: [42, 95]
}, vy = {
  null: []
}, Dy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  attentionMarkers: Oy,
  contentInitial: Ny,
  disable: vy,
  document: Sy,
  flow: Ty,
  flowInitial: My,
  insideSpan: Ey,
  string: Ay,
  text: Iy
}, Symbol.toStringTag, { value: "Module" }));
function Ry(t, e, n) {
  let r = {
    _bufferIndex: -1,
    _index: 0,
    line: n && n.line || 1,
    column: n && n.column || 1,
    offset: n && n.offset || 0
  };
  const i = {}, o = [];
  let s = [], l = [];
  const a = {
    attempt: A(v),
    check: A(x),
    consume: N,
    enter: w,
    exit: O,
    interrupt: A(x, {
      interrupt: !0
    })
  }, c = {
    code: null,
    containerState: {},
    defineSkip: m,
    events: [],
    now: p,
    parser: t,
    previous: null,
    sliceSerialize: d,
    sliceStream: f,
    write: h
  };
  let u = e.tokenize.call(c, a);
  return e.resolveAll && o.push(e), c;
  function h(D) {
    return s = Ve(s, D), y(), s[s.length - 1] !== null ? [] : (R(e, 0), c.events = Ki(o, c.events, c), c.events);
  }
  function d(D, P) {
    return Py(f(D), P);
  }
  function f(D) {
    return zy(s, D);
  }
  function p() {
    const {
      _bufferIndex: D,
      _index: P,
      line: X,
      column: re,
      offset: U
    } = r;
    return {
      _bufferIndex: D,
      _index: P,
      line: X,
      column: re,
      offset: U
    };
  }
  function m(D) {
    i[D.line] = D.column, C();
  }
  function y() {
    for (; r._index < s.length; ) {
      const D = s[r._index];
      if (typeof D == "string") {
        const P = r._index;
        for (r._bufferIndex < 0 && (r._bufferIndex = 0); r._index === P && r._bufferIndex < D.length; )
          g(D.charCodeAt(r._bufferIndex));
      } else
        g(D);
    }
  }
  function g(D) {
    u = u(D);
  }
  function N(D) {
    L(D) ? (r.line++, r.column = 1, r.offset += D === -3 ? 2 : 1, C()) : D !== -1 && (r.column++, r.offset++), r._bufferIndex < 0 ? r._index++ : (r._bufferIndex++, r._bufferIndex === // Points w/ non-negative `_bufferIndex` reference
    // strings.
    /** @type {string} */
    s[r._index].length && (r._bufferIndex = -1, r._index++)), c.previous = D;
  }
  function w(D, P) {
    const X = P || {};
    return X.type = D, X.start = p(), c.events.push(["enter", X, c]), l.push(X), X;
  }
  function O(D) {
    const P = l.pop();
    return P.end = p(), c.events.push(["exit", P, c]), P;
  }
  function v(D, P) {
    R(D, P.from);
  }
  function x(D, P) {
    P.restore();
  }
  function A(D, P) {
    return X;
    function X(re, U, ge) {
      let ae, Je, ft, k;
      return Array.isArray(re) ? (
        /* c8 ignore next 1 */
        dt(re)
      ) : "tokenize" in re ? (
        // Looks like a construct.
        dt([
          /** @type {Construct} */
          re
        ])
      ) : Ge(re);
      function Ge(ce) {
        return Yn;
        function Yn(Dt) {
          const wn = Dt !== null && ce[Dt], Cn = Dt !== null && ce.null, Qr = [
            // To do: add more extension tests.
            /* c8 ignore next 2 */
            ...Array.isArray(wn) ? wn : wn ? [wn] : [],
            ...Array.isArray(Cn) ? Cn : Cn ? [Cn] : []
          ];
          return dt(Qr)(Dt);
        }
      }
      function dt(ce) {
        return ae = ce, Je = 0, ce.length === 0 ? ge : b(ce[Je]);
      }
      function b(ce) {
        return Yn;
        function Yn(Dt) {
          return k = F(), ft = ce, ce.partial || (c.currentConstruct = ce), ce.name && c.parser.constructs.disable.null.includes(ce.name) ? Xt() : ce.tokenize.call(
            // If we do have fields, create an object w/ `context` as its
            // prototype.
            // This allows a “live binding”, which is needed for `interrupt`.
            P ? Object.assign(Object.create(c), P) : c,
            a,
            Ye,
            Xt
          )(Dt);
        }
      }
      function Ye(ce) {
        return D(ft, k), U;
      }
      function Xt(ce) {
        return k.restore(), ++Je < ae.length ? b(ae[Je]) : ge;
      }
    }
  }
  function R(D, P) {
    D.resolveAll && !o.includes(D) && o.push(D), D.resolve && Xe(c.events, P, c.events.length - P, D.resolve(c.events.slice(P), c)), D.resolveTo && (c.events = D.resolveTo(c.events, c));
  }
  function F() {
    const D = p(), P = c.previous, X = c.currentConstruct, re = c.events.length, U = Array.from(l);
    return {
      from: re,
      restore: ge
    };
    function ge() {
      r = D, c.previous = P, c.currentConstruct = X, c.events.length = re, l = U, C();
    }
  }
  function C() {
    r.line in i && r.column < 2 && (r.column = i[r.line], r.offset += i[r.line] - 1);
  }
}
function zy(t, e) {
  const n = e.start._index, r = e.start._bufferIndex, i = e.end._index, o = e.end._bufferIndex;
  let s;
  if (n === i)
    s = [t[n].slice(r, o)];
  else {
    if (s = t.slice(n, i), r > -1) {
      const l = s[0];
      typeof l == "string" ? s[0] = l.slice(r) : s.shift();
    }
    o > 0 && s.push(t[i].slice(0, o));
  }
  return s;
}
function Py(t, e) {
  let n = -1;
  const r = [];
  let i;
  for (; ++n < t.length; ) {
    const o = t[n];
    let s;
    if (typeof o == "string")
      s = o;
    else
      switch (o) {
        case -5: {
          s = "\r";
          break;
        }
        case -4: {
          s = `
`;
          break;
        }
        case -3: {
          s = `\r
`;
          break;
        }
        case -2: {
          s = e ? " " : "	";
          break;
        }
        case -1: {
          if (!e && i)
            continue;
          s = " ";
          break;
        }
        default:
          s = String.fromCharCode(o);
      }
    i = o === -2, r.push(s);
  }
  return r.join("");
}
function Ly(t) {
  const r = {
    constructs: (
      /** @type {FullNormalizedExtension} */
      ah([Dy, ...(t || {}).extensions || []])
    ),
    content: i(eg),
    defined: [],
    document: i(ng),
    flow: i(yy),
    lazy: {},
    string: i(xy),
    text: i(wy)
  };
  return r;
  function i(o) {
    return s;
    function s(l) {
      return Ry(r, o, l);
    }
  }
}
function By(t) {
  for (; !mh(t); )
    ;
  return t;
}
const tc = /[\0\t\n\r]/g;
function Fy() {
  let t = 1, e = "", n = !0, r;
  return i;
  function i(o, s, l) {
    o = e + (typeof o == "string" ? o.toString() : new TextDecoder(s || void 0).decode(o));
    const a = [];
    let c = 0;
    for (e = "", n && (o.charCodeAt(0) === 65279 && c++, n = void 0); c < o.length; ) {
      tc.lastIndex = c;
      const u = tc.exec(o), h = u && u.index !== void 0 ? u.index : o.length, d = o.charCodeAt(h);
      if (!u) {
        e = o.slice(c);
        break;
      }
      if (d === 10 && c === h && r)
        a.push(-3), r = void 0;
      else
        switch (r && (a.push(-5), r = void 0), c < h && (a.push(o.slice(c, h)), t += h - c), d) {
          case 0: {
            a.push(65533), t++;
            break;
          }
          case 9: {
            const f = Math.ceil(t / 4) * 4;
            for (a.push(-2); t++ < f; )
              a.push(-1);
            break;
          }
          case 10: {
            a.push(-4), t = 1;
            break;
          }
          default:
            r = !0, t = 1;
        }
      c = h + 1;
    }
    return l && (r && a.push(-5), e && a.push(e), a.push(null)), a;
  }
}
const _y = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
function Ch(t) {
  return t.replace(_y, $y);
}
function $y(t, e, n) {
  if (e)
    return e;
  if (n.charCodeAt(0) === 35) {
    const i = n.charCodeAt(1), o = i === 120 || i === 88;
    return ch(n.slice(o ? 2 : 1), o ? 16 : 10);
  }
  return el(n) || t;
}
function cr(t) {
  return !t || typeof t != "object" ? "" : "position" in t || "type" in t ? nc(t.position) : "start" in t || "end" in t ? nc(t) : "line" in t || "column" in t ? cs(t) : "";
}
function cs(t) {
  return rc(t && t.line) + ":" + rc(t && t.column);
}
function nc(t) {
  return cs(t && t.start) + "-" + cs(t && t.end);
}
function rc(t) {
  return t && typeof t == "number" ? t : 1;
}
const Sh = {}.hasOwnProperty;
function Vy(t, e, n) {
  return e && typeof e == "object" && (n = e, e = void 0), Hy(n)(By(Ly(n).document().write(Fy()(t, e, !0))));
}
function Hy(t) {
  const e = {
    transforms: [],
    canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
    enter: {
      autolink: o(Va),
      autolinkProtocol: F,
      autolinkEmail: F,
      atxHeading: o(Fa),
      blockQuote: o(Cn),
      characterEscape: F,
      characterReference: F,
      codeFenced: o(Qr),
      codeFencedFenceInfo: s,
      codeFencedFenceMeta: s,
      codeIndented: o(Qr, s),
      codeText: o(nm, s),
      codeTextData: F,
      data: F,
      codeFlowValue: F,
      definition: o(rm),
      definitionDestinationString: s,
      definitionLabelString: s,
      definitionTitleString: s,
      emphasis: o(im),
      hardBreakEscape: o(_a),
      hardBreakTrailing: o(_a),
      htmlFlow: o($a, s),
      htmlFlowData: F,
      htmlText: o($a, s),
      htmlTextData: F,
      image: o(om),
      label: s,
      link: o(Va),
      listItem: o(sm),
      listItemValue: d,
      listOrdered: o(Ha, h),
      listUnordered: o(Ha),
      paragraph: o(lm),
      reference: b,
      referenceString: s,
      resourceDestinationString: s,
      resourceTitleString: s,
      setextHeading: o(Fa),
      strong: o(am),
      thematicBreak: o(um)
    },
    exit: {
      atxHeading: a(),
      atxHeadingSequence: v,
      autolink: a(),
      autolinkEmail: wn,
      autolinkProtocol: Dt,
      blockQuote: a(),
      characterEscapeValue: C,
      characterReferenceMarkerHexadecimal: Xt,
      characterReferenceMarkerNumeric: Xt,
      characterReferenceValue: ce,
      characterReference: Yn,
      codeFenced: a(y),
      codeFencedFence: m,
      codeFencedFenceInfo: f,
      codeFencedFenceMeta: p,
      codeFlowValue: C,
      codeIndented: a(g),
      codeText: a(U),
      codeTextData: C,
      data: C,
      definition: a(),
      definitionDestinationString: O,
      definitionLabelString: N,
      definitionTitleString: w,
      emphasis: a(),
      hardBreakEscape: a(P),
      hardBreakTrailing: a(P),
      htmlFlow: a(X),
      htmlFlowData: C,
      htmlText: a(re),
      htmlTextData: C,
      image: a(ae),
      label: ft,
      labelText: Je,
      lineEnding: D,
      link: a(ge),
      listItem: a(),
      listOrdered: a(),
      listUnordered: a(),
      paragraph: a(),
      referenceString: Ye,
      resourceDestinationString: k,
      resourceTitleString: Ge,
      resource: dt,
      setextHeading: a(R),
      setextHeadingLineSequence: A,
      setextHeadingText: x,
      strong: a(),
      thematicBreak: a()
    }
  };
  Nh(e, (t || {}).mdastExtensions || []);
  const n = {};
  return r;
  function r(M) {
    let I = {
      type: "root",
      children: []
    };
    const j = {
      stack: [I],
      tokenStack: [],
      config: e,
      enter: l,
      exit: c,
      buffer: s,
      resume: u,
      data: n
    }, K = [];
    let Z = -1;
    for (; ++Z < M.length; )
      if (M[Z][1].type === "listOrdered" || M[Z][1].type === "listUnordered")
        if (M[Z][0] === "enter")
          K.push(Z);
        else {
          const Qe = K.pop();
          Z = i(M, Qe, Z);
        }
    for (Z = -1; ++Z < M.length; ) {
      const Qe = e[M[Z][0]];
      Sh.call(Qe, M[Z][1].type) && Qe[M[Z][1].type].call(Object.assign({
        sliceSerialize: M[Z][2].sliceSerialize
      }, j), M[Z][1]);
    }
    if (j.tokenStack.length > 0) {
      const Qe = j.tokenStack[j.tokenStack.length - 1];
      (Qe[1] || ic).call(j, void 0, Qe[0]);
    }
    for (I.position = {
      start: Rt(M.length > 0 ? M[0][1].start : {
        line: 1,
        column: 1,
        offset: 0
      }),
      end: Rt(M.length > 0 ? M[M.length - 2][1].end : {
        line: 1,
        column: 1,
        offset: 0
      })
    }, Z = -1; ++Z < e.transforms.length; )
      I = e.transforms[Z](I) || I;
    return I;
  }
  function i(M, I, j) {
    let K = I - 1, Z = -1, Qe = !1, Zt, pt, Qn, Xn;
    for (; ++K <= j; ) {
      const Re = M[K];
      switch (Re[1].type) {
        case "listUnordered":
        case "listOrdered":
        case "blockQuote": {
          Re[0] === "enter" ? Z++ : Z--, Xn = void 0;
          break;
        }
        case "lineEndingBlank": {
          Re[0] === "enter" && (Zt && !Xn && !Z && !Qn && (Qn = K), Xn = void 0);
          break;
        }
        case "linePrefix":
        case "listItemValue":
        case "listItemMarker":
        case "listItemPrefix":
        case "listItemPrefixWhitespace":
          break;
        default:
          Xn = void 0;
      }
      if (!Z && Re[0] === "enter" && Re[1].type === "listItemPrefix" || Z === -1 && Re[0] === "exit" && (Re[1].type === "listUnordered" || Re[1].type === "listOrdered")) {
        if (Zt) {
          let Sn = K;
          for (pt = void 0; Sn--; ) {
            const mt = M[Sn];
            if (mt[1].type === "lineEnding" || mt[1].type === "lineEndingBlank") {
              if (mt[0] === "exit") continue;
              pt && (M[pt][1].type = "lineEndingBlank", Qe = !0), mt[1].type = "lineEnding", pt = Sn;
            } else if (!(mt[1].type === "linePrefix" || mt[1].type === "blockQuotePrefix" || mt[1].type === "blockQuotePrefixWhitespace" || mt[1].type === "blockQuoteMarker" || mt[1].type === "listItemIndent")) break;
          }
          Qn && (!pt || Qn < pt) && (Zt._spread = !0), Zt.end = Object.assign({}, pt ? M[pt][1].start : Re[1].end), M.splice(pt || K, 0, ["exit", Zt, Re[2]]), K++, j++;
        }
        if (Re[1].type === "listItemPrefix") {
          const Sn = {
            type: "listItem",
            _spread: !1,
            start: Object.assign({}, Re[1].start),
            // @ts-expect-error: we’ll add `end` in a second.
            end: void 0
          };
          Zt = Sn, M.splice(K, 0, ["enter", Sn, Re[2]]), K++, j++, Qn = void 0, Xn = !0;
        }
      }
    }
    return M[I][1]._spread = Qe, j;
  }
  function o(M, I) {
    return j;
    function j(K) {
      l.call(this, M(K), K), I && I.call(this, K);
    }
  }
  function s() {
    this.stack.push({
      type: "fragment",
      children: []
    });
  }
  function l(M, I, j) {
    this.stack[this.stack.length - 1].children.push(M), this.stack.push(M), this.tokenStack.push([I, j || void 0]), M.position = {
      start: Rt(I.start),
      // @ts-expect-error: `end` will be patched later.
      end: void 0
    };
  }
  function a(M) {
    return I;
    function I(j) {
      M && M.call(this, j), c.call(this, j);
    }
  }
  function c(M, I) {
    const j = this.stack.pop(), K = this.tokenStack.pop();
    if (K)
      K[0].type !== M.type && (I ? I.call(this, M, K[0]) : (K[1] || ic).call(this, M, K[0]));
    else throw new Error("Cannot close `" + M.type + "` (" + cr({
      start: M.start,
      end: M.end
    }) + "): it’s not open");
    j.position.end = Rt(M.end);
  }
  function u() {
    return Zs(this.stack.pop());
  }
  function h() {
    this.data.expectingFirstListItemValue = !0;
  }
  function d(M) {
    if (this.data.expectingFirstListItemValue) {
      const I = this.stack[this.stack.length - 2];
      I.start = Number.parseInt(this.sliceSerialize(M), 10), this.data.expectingFirstListItemValue = void 0;
    }
  }
  function f() {
    const M = this.resume(), I = this.stack[this.stack.length - 1];
    I.lang = M;
  }
  function p() {
    const M = this.resume(), I = this.stack[this.stack.length - 1];
    I.meta = M;
  }
  function m() {
    this.data.flowCodeInside || (this.buffer(), this.data.flowCodeInside = !0);
  }
  function y() {
    const M = this.resume(), I = this.stack[this.stack.length - 1];
    I.value = M.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, ""), this.data.flowCodeInside = void 0;
  }
  function g() {
    const M = this.resume(), I = this.stack[this.stack.length - 1];
    I.value = M.replace(/(\r?\n|\r)$/g, "");
  }
  function N(M) {
    const I = this.resume(), j = this.stack[this.stack.length - 1];
    j.label = I, j.identifier = Ze(this.sliceSerialize(M)).toLowerCase();
  }
  function w() {
    const M = this.resume(), I = this.stack[this.stack.length - 1];
    I.title = M;
  }
  function O() {
    const M = this.resume(), I = this.stack[this.stack.length - 1];
    I.url = M;
  }
  function v(M) {
    const I = this.stack[this.stack.length - 1];
    if (!I.depth) {
      const j = this.sliceSerialize(M).length;
      I.depth = j;
    }
  }
  function x() {
    this.data.setextHeadingSlurpLineEnding = !0;
  }
  function A(M) {
    const I = this.stack[this.stack.length - 1];
    I.depth = this.sliceSerialize(M).codePointAt(0) === 61 ? 1 : 2;
  }
  function R() {
    this.data.setextHeadingSlurpLineEnding = void 0;
  }
  function F(M) {
    const j = this.stack[this.stack.length - 1].children;
    let K = j[j.length - 1];
    (!K || K.type !== "text") && (K = cm(), K.position = {
      start: Rt(M.start),
      // @ts-expect-error: we’ll add `end` later.
      end: void 0
    }, j.push(K)), this.stack.push(K);
  }
  function C(M) {
    const I = this.stack.pop();
    I.value += this.sliceSerialize(M), I.position.end = Rt(M.end);
  }
  function D(M) {
    const I = this.stack[this.stack.length - 1];
    if (this.data.atHardBreak) {
      const j = I.children[I.children.length - 1];
      j.position.end = Rt(M.end), this.data.atHardBreak = void 0;
      return;
    }
    !this.data.setextHeadingSlurpLineEnding && e.canContainEols.includes(I.type) && (F.call(this, M), C.call(this, M));
  }
  function P() {
    this.data.atHardBreak = !0;
  }
  function X() {
    const M = this.resume(), I = this.stack[this.stack.length - 1];
    I.value = M;
  }
  function re() {
    const M = this.resume(), I = this.stack[this.stack.length - 1];
    I.value = M;
  }
  function U() {
    const M = this.resume(), I = this.stack[this.stack.length - 1];
    I.value = M;
  }
  function ge() {
    const M = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const I = this.data.referenceType || "shortcut";
      M.type += "Reference", M.referenceType = I, delete M.url, delete M.title;
    } else
      delete M.identifier, delete M.label;
    this.data.referenceType = void 0;
  }
  function ae() {
    const M = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const I = this.data.referenceType || "shortcut";
      M.type += "Reference", M.referenceType = I, delete M.url, delete M.title;
    } else
      delete M.identifier, delete M.label;
    this.data.referenceType = void 0;
  }
  function Je(M) {
    const I = this.sliceSerialize(M), j = this.stack[this.stack.length - 2];
    j.label = Ch(I), j.identifier = Ze(I).toLowerCase();
  }
  function ft() {
    const M = this.stack[this.stack.length - 1], I = this.resume(), j = this.stack[this.stack.length - 1];
    if (this.data.inReference = !0, j.type === "link") {
      const K = M.children;
      j.children = K;
    } else
      j.alt = I;
  }
  function k() {
    const M = this.resume(), I = this.stack[this.stack.length - 1];
    I.url = M;
  }
  function Ge() {
    const M = this.resume(), I = this.stack[this.stack.length - 1];
    I.title = M;
  }
  function dt() {
    this.data.inReference = void 0;
  }
  function b() {
    this.data.referenceType = "collapsed";
  }
  function Ye(M) {
    const I = this.resume(), j = this.stack[this.stack.length - 1];
    j.label = I, j.identifier = Ze(this.sliceSerialize(M)).toLowerCase(), this.data.referenceType = "full";
  }
  function Xt(M) {
    this.data.characterReferenceType = M.type;
  }
  function ce(M) {
    const I = this.sliceSerialize(M), j = this.data.characterReferenceType;
    let K;
    j ? (K = ch(I, j === "characterReferenceMarkerNumeric" ? 10 : 16), this.data.characterReferenceType = void 0) : K = el(I);
    const Z = this.stack[this.stack.length - 1];
    Z.value += K;
  }
  function Yn(M) {
    const I = this.stack.pop();
    I.position.end = Rt(M.end);
  }
  function Dt(M) {
    C.call(this, M);
    const I = this.stack[this.stack.length - 1];
    I.url = this.sliceSerialize(M);
  }
  function wn(M) {
    C.call(this, M);
    const I = this.stack[this.stack.length - 1];
    I.url = "mailto:" + this.sliceSerialize(M);
  }
  function Cn() {
    return {
      type: "blockquote",
      children: []
    };
  }
  function Qr() {
    return {
      type: "code",
      lang: null,
      meta: null,
      value: ""
    };
  }
  function nm() {
    return {
      type: "inlineCode",
      value: ""
    };
  }
  function rm() {
    return {
      type: "definition",
      identifier: "",
      label: null,
      title: null,
      url: ""
    };
  }
  function im() {
    return {
      type: "emphasis",
      children: []
    };
  }
  function Fa() {
    return {
      type: "heading",
      // @ts-expect-error `depth` will be set later.
      depth: 0,
      children: []
    };
  }
  function _a() {
    return {
      type: "break"
    };
  }
  function $a() {
    return {
      type: "html",
      value: ""
    };
  }
  function om() {
    return {
      type: "image",
      title: null,
      url: "",
      alt: null
    };
  }
  function Va() {
    return {
      type: "link",
      title: null,
      url: "",
      children: []
    };
  }
  function Ha(M) {
    return {
      type: "list",
      ordered: M.type === "listOrdered",
      start: null,
      spread: M._spread,
      children: []
    };
  }
  function sm(M) {
    return {
      type: "listItem",
      spread: M._spread,
      checked: null,
      children: []
    };
  }
  function lm() {
    return {
      type: "paragraph",
      children: []
    };
  }
  function am() {
    return {
      type: "strong",
      children: []
    };
  }
  function cm() {
    return {
      type: "text",
      value: ""
    };
  }
  function um() {
    return {
      type: "thematicBreak"
    };
  }
}
function Rt(t) {
  return {
    line: t.line,
    column: t.column,
    offset: t.offset
  };
}
function Nh(t, e) {
  let n = -1;
  for (; ++n < e.length; ) {
    const r = e[n];
    Array.isArray(r) ? Nh(t, r) : jy(t, r);
  }
}
function jy(t, e) {
  let n;
  for (n in e)
    if (Sh.call(e, n))
      switch (n) {
        case "canContainEols": {
          const r = e[n];
          r && t[n].push(...r);
          break;
        }
        case "transforms": {
          const r = e[n];
          r && t[n].push(...r);
          break;
        }
        case "enter":
        case "exit": {
          const r = e[n];
          r && Object.assign(t[n], r);
          break;
        }
      }
}
function ic(t, e) {
  throw t ? new Error("Cannot close `" + t.type + "` (" + cr({
    start: t.start,
    end: t.end
  }) + "): a different token (`" + e.type + "`, " + cr({
    start: e.start,
    end: e.end
  }) + ") is open") : new Error("Cannot close document, a token (`" + e.type + "`, " + cr({
    start: e.start,
    end: e.end
  }) + ") is still open");
}
function us(t) {
  const e = this;
  e.parser = n;
  function n(r) {
    return Vy(r, {
      ...e.data("settings"),
      ...t,
      // Note: these options are not in the readme.
      // The goal is for them to be set by plugins on `data` instead of being
      // passed by users.
      extensions: e.data("micromarkExtensions") || [],
      mdastExtensions: e.data("fromMarkdownExtensions") || []
    });
  }
}
const Ui = (
  // Note: overloads in JSDoc can’t yet use different `@template`s.
  /**
   * @type {(
   *   (<Condition extends string>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & {type: Condition}) &
   *   (<Condition extends Props>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Condition) &
   *   (<Condition extends TestFunction>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Predicate<Condition, Node>) &
   *   ((test?: null | undefined) => (node?: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node) &
   *   ((test?: Test) => Check)
   * )}
   */
  /**
   * @param {Test} [test]
   * @returns {Check}
   */
  (function(t) {
    if (t == null)
      return Uy;
    if (typeof t == "function")
      return Ji(t);
    if (typeof t == "object")
      return Array.isArray(t) ? qy(t) : (
        // Cast because `ReadonlyArray` goes into the above but `isArray`
        // narrows to `Array`.
        Wy(
          /** @type {Props} */
          t
        )
      );
    if (typeof t == "string")
      return Ky(t);
    throw new Error("Expected function, string, or object as test");
  })
);
function qy(t) {
  const e = [];
  let n = -1;
  for (; ++n < t.length; )
    e[n] = Ui(t[n]);
  return Ji(r);
  function r(...i) {
    let o = -1;
    for (; ++o < e.length; )
      if (e[o].apply(this, i)) return !0;
    return !1;
  }
}
function Wy(t) {
  const e = (
    /** @type {Record<string, unknown>} */
    t
  );
  return Ji(n);
  function n(r) {
    const i = (
      /** @type {Record<string, unknown>} */
      /** @type {unknown} */
      r
    );
    let o;
    for (o in t)
      if (i[o] !== e[o]) return !1;
    return !0;
  }
}
function Ky(t) {
  return Ji(e);
  function e(n) {
    return n && n.type === t;
  }
}
function Ji(t) {
  return e;
  function e(n, r, i) {
    return !!(Jy(n) && t.call(
      this,
      n,
      typeof r == "number" ? r : void 0,
      i || void 0
    ));
  }
}
function Uy() {
  return !0;
}
function Jy(t) {
  return t !== null && typeof t == "object" && "type" in t;
}
const Mh = (
  /** @type {(node?: unknown) => node is Exclude<PhrasingContent, Html>} */
  Ui([
    "break",
    "delete",
    "emphasis",
    // To do: next major: removed since footnotes were added to GFM.
    "footnote",
    "footnoteReference",
    "image",
    "imageReference",
    "inlineCode",
    // Enabled by `mdast-util-math`:
    "inlineMath",
    "link",
    "linkReference",
    // Enabled by `mdast-util-mdx`:
    "mdxJsxTextElement",
    // Enabled by `mdast-util-mdx`:
    "mdxTextExpression",
    "strong",
    "text",
    // Enabled by `mdast-util-directive`:
    "textDirective"
  ])
), oc = {}.hasOwnProperty;
function Gy(t, e) {
  const n = e || {};
  function r(i, ...o) {
    let s = r.invalid;
    const l = r.handlers;
    if (i && oc.call(i, t)) {
      const a = String(i[t]);
      s = oc.call(l, a) ? l[a] : r.unknown;
    }
    if (s)
      return s.call(this, i, ...o);
  }
  return r.handlers = n.handlers || {}, r.invalid = n.invalid, r.unknown = n.unknown, r;
}
const Yy = {}.hasOwnProperty;
function Th(t, e) {
  let n = -1, r;
  if (e.extensions)
    for (; ++n < e.extensions.length; )
      Th(t, e.extensions[n]);
  for (r in e)
    if (Yy.call(e, r))
      switch (r) {
        case "extensions":
          break;
        /* c8 ignore next 4 */
        case "unsafe": {
          sc(t[r], e[r]);
          break;
        }
        case "join": {
          sc(t[r], e[r]);
          break;
        }
        case "handlers": {
          Qy(t[r], e[r]);
          break;
        }
        default:
          t.options[r] = e[r];
      }
  return t;
}
function sc(t, e) {
  e && t.push(...e);
}
function Qy(t, e) {
  e && Object.assign(t, e);
}
function Xy(t, e, n, r) {
  const i = n.enter("blockquote"), o = n.createTracker(r);
  o.move("> "), o.shift(2);
  const s = n.indentLines(
    n.containerFlow(t, o.current()),
    Zy
  );
  return i(), s;
}
function Zy(t, e, n) {
  return ">" + (n ? "" : " ") + t;
}
function Ah(t, e) {
  return lc(t, e.inConstruct, !0) && !lc(t, e.notInConstruct, !1);
}
function lc(t, e, n) {
  if (typeof e == "string" && (e = [e]), !e || e.length === 0)
    return n;
  let r = -1;
  for (; ++r < e.length; )
    if (t.includes(e[r]))
      return !0;
  return !1;
}
function ac(t, e, n, r) {
  let i = -1;
  for (; ++i < n.unsafe.length; ) {
    const o = n.unsafe[i];
    if (o.character === `
` && !o.before && !o.after && Ah(n.stack, o))
      return /[\t ]/.test(r.before) ? "" : " ";
  }
  return `\\
`;
}
function ek(t, e) {
  const n = String(t);
  let r = n.indexOf(e), i = r, o = 0, s = 0;
  if (typeof e != "string")
    throw new TypeError("Expected substring");
  for (; r !== -1; )
    r === i ? ++o > s && (s = o) : o = 1, i = r + e.length, r = n.indexOf(e, i);
  return s;
}
function hs(t, e) {
  return !!(e.options.fences === !1 && t.value && // If there’s no info…
  !t.lang && // And there’s a non-whitespace character…
  /[^\n\r ]/.test(t.value) && // And the value doesn’t start or end in a blank…
  !/^[\t ]*(?:[\n\r]|$)|(?:^|[\n\r])[\t ]*$/.test(t.value));
}
function tk(t) {
  const e = t.options.fence || "`";
  if (e !== "`" && e !== "~")
    throw new Error(
      "Cannot serialize code with `" + e + "` for `options.fence`, expected `` ` `` or `~`"
    );
  return e;
}
function nk(t, e, n, r) {
  const i = tk(n), o = t.value || "";
  if (hs(t, n)) {
    const h = n.enter("codeIndented"), d = n.indentLines(o, rk);
    return h(), d;
  }
  const s = n.createTracker(r), l = i.repeat(Math.max(ek(o, i) + 1, 3)), a = n.enter("codeFenced"), c = i === "`" ? "GraveAccent" : "Tilde";
  let u = s.move(l);
  if (t.lang) {
    const h = n.enter(`codeFencedLang${c}`);
    u += s.move(
      n.safe(t.lang, {
        before: u,
        after: " ",
        encode: ["`"],
        ...s.current()
      })
    ), h();
  }
  if (t.lang && t.meta) {
    const h = n.enter(`codeFencedMeta${c}`);
    u += s.move(" "), u += s.move(
      n.safe(t.meta, {
        before: u,
        after: `
`,
        encode: ["`"],
        ...s.current()
      })
    ), h();
  }
  return u += s.move(`
`), o && (u += s.move(o + `
`)), u += s.move(l), a(), u;
}
function rk(t, e, n) {
  return (n ? "" : "    ") + t;
}
function nl(t) {
  const e = t.options.quote || '"';
  if (e !== '"' && e !== "'")
    throw new Error(
      "Cannot serialize title with `" + e + "` for `options.quote`, expected `\"`, or `'`"
    );
  return e;
}
function ik(t, e, n, r) {
  const i = nl(n), o = i === '"' ? "Quote" : "Apostrophe", s = n.enter("definition");
  let l = n.enter("label");
  const a = n.createTracker(r);
  let c = a.move("[");
  return c += a.move(
    n.safe(n.associationId(t), {
      before: c,
      after: "]",
      ...a.current()
    })
  ), c += a.move("]: "), l(), // If there’s no url, or…
  !t.url || // If there are control characters or whitespace.
  /[\0- \u007F]/.test(t.url) ? (l = n.enter("destinationLiteral"), c += a.move("<"), c += a.move(
    n.safe(t.url, { before: c, after: ">", ...a.current() })
  ), c += a.move(">")) : (l = n.enter("destinationRaw"), c += a.move(
    n.safe(t.url, {
      before: c,
      after: t.title ? " " : `
`,
      ...a.current()
    })
  )), l(), t.title && (l = n.enter(`title${o}`), c += a.move(" " + i), c += a.move(
    n.safe(t.title, {
      before: c,
      after: i,
      ...a.current()
    })
  ), c += a.move(i), l()), s(), c;
}
function ok(t) {
  const e = t.options.emphasis || "*";
  if (e !== "*" && e !== "_")
    throw new Error(
      "Cannot serialize emphasis with `" + e + "` for `options.emphasis`, expected `*`, or `_`"
    );
  return e;
}
rl.attention = sk;
rl.peek = lk;
function rl(t, e, n, r) {
  const i = n.enter("phrasing"), o = n.containerPhrasing({ type: "root", children: [t] }, r);
  return i(), o;
}
function sk(t, e) {
  return {
    construct: "emphasis",
    markers: ok(e) === "*" ? ["*", "_"] : ["_", "*"],
    sizes: [1]
  };
}
function lk(t, e, n) {
  return n.options.emphasis || "*";
}
function il(t) {
  return "&#x" + t.toString(16).toUpperCase() + ";";
}
const Ih = [], ak = !0, fs = !1, Ti = "skip";
function ol(t, e, n, r) {
  let i;
  typeof e == "function" && typeof n != "function" ? (r = n, n = e) : i = e;
  const o = Ui(i), s = r ? -1 : 1;
  l(t, void 0, [])();
  function l(a, c, u) {
    const h = (
      /** @type {Record<string, unknown>} */
      a && typeof a == "object" ? a : {}
    );
    if (typeof h.type == "string") {
      const f = (
        // `hast`
        typeof h.tagName == "string" ? h.tagName : (
          // `xast`
          typeof h.name == "string" ? h.name : void 0
        )
      );
      Object.defineProperty(d, "name", {
        value: "node (" + (a.type + (f ? "<" + f + ">" : "")) + ")"
      });
    }
    return d;
    function d() {
      let f = Ih, p, m, y;
      if ((!e || o(a, c, u[u.length - 1] || void 0)) && (f = ck(n(a, u)), f[0] === fs))
        return f;
      if ("children" in a && a.children) {
        const g = (
          /** @type {UnistParent} */
          a
        );
        if (g.children && f[0] !== Ti)
          for (m = (r ? g.children.length : -1) + s, y = u.concat(g); m > -1 && m < g.children.length; ) {
            const N = g.children[m];
            if (p = l(N, m, y)(), p[0] === fs)
              return p;
            m = typeof p[1] == "number" ? p[1] : m + s;
          }
      }
      return f;
    }
  }
}
function ck(t) {
  return Array.isArray(t) ? t : typeof t == "number" ? [ak, t] : t == null ? Ih : [t];
}
function Vn(t, e, n, r) {
  let i, o, s;
  typeof e == "function" && typeof n != "function" ? (o = void 0, s = e, i = n) : (o = e, s = n, i = r), ol(t, o, l, i);
  function l(a, c) {
    const u = c[c.length - 1], h = u ? u.children.indexOf(a) : void 0;
    return s(a, h, u);
  }
}
function Eh(t, e) {
  let n = !1;
  return Vn(t, function(r) {
    if ("value" in r && /\r?\n|\r/.test(r.value) || r.type === "break")
      return n = !0, fs;
  }), !!((!t.depth || t.depth < 3) && Zs(t) && (e.options.setext || n));
}
function uk(t, e, n, r) {
  const i = Math.max(Math.min(6, t.depth || 1), 1), o = n.createTracker(r);
  if (Eh(t, n)) {
    const h = n.enter("headingSetext"), d = n.enter("phrasing"), f = n.containerPhrasing(t, {
      ...o.current(),
      before: `
`,
      after: `
`
    });
    return d(), h(), f + `
` + (i === 1 ? "=" : "-").repeat(
      // The whole size…
      f.length - // Minus the position of the character after the last EOL (or
      // 0 if there is none)…
      (Math.max(f.lastIndexOf("\r"), f.lastIndexOf(`
`)) + 1)
    );
  }
  const s = "#".repeat(i), l = n.enter("headingAtx"), a = n.enter("phrasing");
  o.move(s + " ");
  let c = n.containerPhrasing(t, {
    before: "# ",
    after: `
`,
    ...o.current()
  });
  const u = c.charCodeAt(0);
  return (u === 9 || u === 32) && (c = il(u) + c.slice(1)), c = c ? s + " " + c : s, n.options.closeAtx && (c += " " + s), a(), l(), c;
}
Oh.peek = hk;
function Oh(t) {
  return t.value || "";
}
function hk() {
  return "<";
}
vh.peek = fk;
function vh(t, e, n, r) {
  const i = nl(n), o = i === '"' ? "Quote" : "Apostrophe", s = n.enter("image");
  let l = n.enter("label");
  const a = n.createTracker(r);
  let c = a.move("![");
  return c += a.move(
    n.safe(t.alt, { before: c, after: "]", ...a.current() })
  ), c += a.move("]("), l(), // If there’s no url but there is a title…
  !t.url && t.title || // If there are control characters or whitespace.
  /[\0- \u007F]/.test(t.url) ? (l = n.enter("destinationLiteral"), c += a.move("<"), c += a.move(
    n.safe(t.url, { before: c, after: ">", ...a.current() })
  ), c += a.move(">")) : (l = n.enter("destinationRaw"), c += a.move(
    n.safe(t.url, {
      before: c,
      after: t.title ? " " : ")",
      ...a.current()
    })
  )), l(), t.title && (l = n.enter(`title${o}`), c += a.move(" " + i), c += a.move(
    n.safe(t.title, {
      before: c,
      after: i,
      ...a.current()
    })
  ), c += a.move(i), l()), c += a.move(")"), s(), c;
}
function fk() {
  return "!";
}
Dh.peek = dk;
function Dh(t, e, n, r) {
  const i = t.referenceType, o = n.enter("imageReference");
  let s = n.enter("label");
  const l = n.createTracker(r);
  let a = l.move("![");
  const c = n.safe(t.alt, {
    before: a,
    after: "]",
    ...l.current()
  });
  a += l.move(c + "]["), s();
  const u = n.stack;
  n.stack = u.filter(function(d) {
    return d !== "phrasing";
  }), s = n.enter("reference");
  const h = n.safe(n.associationId(t), {
    before: a,
    after: "]",
    ...l.current()
  });
  return s(), n.stack = u, o(), i === "full" || !c || c !== h ? a += l.move(h + "]") : i === "shortcut" ? a = a.slice(0, -1) : a += l.move("]"), a;
}
function dk() {
  return "!";
}
Rh.peek = pk;
function Rh(t, e, n) {
  let r = t.value || "", i = "`", o = -1;
  for (; new RegExp("(^|[^`])" + i + "([^`]|$)").test(r); )
    i += "`";
  for (/[^\n\r ]/.test(r) && (/^[\n\r ]/.test(r) && /[\n\r ]$/.test(r) || /^`|`$/.test(r)) && (r = " " + r + " "); ++o < n.unsafe.length; ) {
    const s = n.unsafe[o], l = n.compilePattern(s);
    if (!s.atBreak) continue;
    let a;
    for (; a = l.exec(r); ) {
      let c = a.index;
      r.charCodeAt(c) === 10 && r.charCodeAt(c - 1) === 13 && c--, r = r.slice(0, c) + " " + r.slice(a.index + 1);
    }
  }
  return i + r + i;
}
function pk() {
  return "`";
}
function zh(t, e) {
  const n = Zs(t);
  return !!(!e.options.resourceLink && // If there’s a url…
  t.url && // And there’s no title…
  !t.title && // And the content of `node` is a single text node…
  t.children && t.children.length === 1 && t.children[0].type === "text" && // And if the url is the same as the content…
  (n === t.url || "mailto:" + n === t.url) && // And that starts w/ a protocol…
  /^[a-z][+\-.a-z]+:/i.test(t.url) && // And that doesn’t contain ASCII control codes (character escapes and
  // references don’t work), space, or angle brackets…
  !/[\0- <>\u007F]/.test(t.url));
}
Ph.peek = mk;
function Ph(t, e, n, r) {
  const i = nl(n), o = i === '"' ? "Quote" : "Apostrophe", s = n.createTracker(r);
  if (zh(t, n)) {
    const u = n.stack;
    n.stack = u.filter(function(f) {
      return f !== "phrasing";
    });
    const h = n.enter("autolink");
    let d = s.move("<");
    return d += s.move(
      n.containerPhrasing(t, {
        before: d,
        after: ">",
        ...s.current()
      })
    ), d += s.move(">"), h(), n.stack = u, d;
  }
  const l = n.enter("link");
  let a = n.enter("label"), c = s.move("[");
  return c += s.move(
    n.containerPhrasing(t, {
      before: c,
      after: "](",
      ...s.current()
    })
  ), c += s.move("]("), a(), // If there’s no url but there is a title…
  !t.url && t.title || // If there are control characters or whitespace.
  /[\0- \u007F]/.test(t.url) ? (a = n.enter("destinationLiteral"), c += s.move("<"), c += s.move(
    n.safe(t.url, { before: c, after: ">", ...s.current() })
  ), c += s.move(">")) : (a = n.enter("destinationRaw"), c += s.move(
    n.safe(t.url, {
      before: c,
      after: t.title ? " " : ")",
      ...s.current()
    })
  )), a(), t.title && (a = n.enter(`title${o}`), c += s.move(" " + i), c += s.move(
    n.safe(t.title, {
      before: c,
      after: i,
      ...s.current()
    })
  ), c += s.move(i), a()), c += s.move(")"), l(), c;
}
function mk(t, e, n) {
  return zh(t, n) ? "<" : "[";
}
Lh.peek = gk;
function Lh(t, e, n, r) {
  const i = t.referenceType, o = n.enter("linkReference");
  let s = n.enter("label");
  const l = n.createTracker(r);
  let a = l.move("[");
  const c = n.containerPhrasing(t, {
    before: a,
    after: "]",
    ...l.current()
  });
  a += l.move(c + "]["), s();
  const u = n.stack;
  n.stack = u.filter(function(d) {
    return d !== "phrasing";
  }), s = n.enter("reference");
  const h = n.safe(n.associationId(t), {
    before: a,
    after: "]",
    ...l.current()
  });
  return s(), n.stack = u, o(), i === "full" || !c || c !== h ? a += l.move(h + "]") : i === "shortcut" ? a = a.slice(0, -1) : a += l.move("]"), a;
}
function gk() {
  return "[";
}
function sl(t) {
  const e = t.options.bullet || "*";
  if (e !== "*" && e !== "+" && e !== "-")
    throw new Error(
      "Cannot serialize items with `" + e + "` for `options.bullet`, expected `*`, `+`, or `-`"
    );
  return e;
}
function yk(t) {
  const e = sl(t), n = t.options.bulletOther;
  if (!n)
    return e === "*" ? "-" : "*";
  if (n !== "*" && n !== "+" && n !== "-")
    throw new Error(
      "Cannot serialize items with `" + n + "` for `options.bulletOther`, expected `*`, `+`, or `-`"
    );
  if (n === e)
    throw new Error(
      "Expected `bullet` (`" + e + "`) and `bulletOther` (`" + n + "`) to be different"
    );
  return n;
}
function kk(t) {
  const e = t.options.bulletOrdered || ".";
  if (e !== "." && e !== ")")
    throw new Error(
      "Cannot serialize items with `" + e + "` for `options.bulletOrdered`, expected `.` or `)`"
    );
  return e;
}
function Bh(t) {
  const e = t.options.rule || "*";
  if (e !== "*" && e !== "-" && e !== "_")
    throw new Error(
      "Cannot serialize rules with `" + e + "` for `options.rule`, expected `*`, `-`, or `_`"
    );
  return e;
}
function bk(t, e, n, r) {
  const i = n.enter("list"), o = n.bulletCurrent;
  let s = t.ordered ? kk(n) : sl(n);
  const l = t.ordered ? s === "." ? ")" : "." : yk(n);
  let a = e && n.bulletLastUsed ? s === n.bulletLastUsed : !1;
  if (!t.ordered) {
    const u = t.children ? t.children[0] : void 0;
    if (
      // Bullet could be used as a thematic break marker:
      (s === "*" || s === "-") && // Empty first list item:
      u && (!u.children || !u.children[0]) && // Directly in two other list items:
      n.stack[n.stack.length - 1] === "list" && n.stack[n.stack.length - 2] === "listItem" && n.stack[n.stack.length - 3] === "list" && n.stack[n.stack.length - 4] === "listItem" && // That are each the first child.
      n.indexStack[n.indexStack.length - 1] === 0 && n.indexStack[n.indexStack.length - 2] === 0 && n.indexStack[n.indexStack.length - 3] === 0 && (a = !0), Bh(n) === s && u
    ) {
      let h = -1;
      for (; ++h < t.children.length; ) {
        const d = t.children[h];
        if (d && d.type === "listItem" && d.children && d.children[0] && d.children[0].type === "thematicBreak") {
          a = !0;
          break;
        }
      }
    }
  }
  a && (s = l), n.bulletCurrent = s;
  const c = n.containerFlow(t, r);
  return n.bulletLastUsed = s, n.bulletCurrent = o, i(), c;
}
function xk(t) {
  const e = t.options.listItemIndent || "one";
  if (e !== "tab" && e !== "one" && e !== "mixed")
    throw new Error(
      "Cannot serialize items with `" + e + "` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`"
    );
  return e;
}
function wk(t, e, n, r) {
  const i = xk(n);
  let o = n.bulletCurrent || sl(n);
  e && e.type === "list" && e.ordered && (o = (typeof e.start == "number" && e.start > -1 ? e.start : 1) + (n.options.incrementListMarker === !1 ? 0 : e.children.indexOf(t)) + o);
  let s = o.length + 1;
  (i === "tab" || i === "mixed" && (e && e.type === "list" && e.spread || t.spread)) && (s = Math.ceil(s / 4) * 4);
  const l = n.createTracker(r);
  l.move(o + " ".repeat(s - o.length)), l.shift(s);
  const a = n.enter("listItem"), c = n.indentLines(
    n.containerFlow(t, l.current()),
    u
  );
  return a(), c;
  function u(h, d, f) {
    return d ? (f ? "" : " ".repeat(s)) + h : (f ? o : o + " ".repeat(s - o.length)) + h;
  }
}
function Ck(t, e, n, r) {
  const i = n.enter("paragraph"), o = n.enter("phrasing"), s = n.containerPhrasing(t, r);
  return o(), i(), s;
}
function Sk(t, e, n, r) {
  if (!t.children.some(function(l) {
    return Mh(l);
  })) return n.containerFlow(t, r);
  const o = n.enter("phrasing"), s = n.containerPhrasing(t, r);
  return o(), s;
}
function Nk(t) {
  const e = t.options.strong || "*";
  if (e !== "*" && e !== "_")
    throw new Error(
      "Cannot serialize strong with `" + e + "` for `options.strong`, expected `*`, or `_`"
    );
  return e;
}
ll.attention = Mk;
ll.peek = Tk;
function ll(t, e, n, r) {
  const i = n.enter("phrasing"), o = n.containerPhrasing({ type: "root", children: [t] }, r);
  return i(), o;
}
function Mk(t, e) {
  return {
    construct: "strong",
    markers: Nk(e) === "*" ? ["*", "_"] : ["_", "*"],
    sizes: [2]
  };
}
function Tk(t, e, n) {
  return n.options.strong || "*";
}
function Ak(t, e, n, r) {
  return n.safe(t.value, r);
}
function Ik(t) {
  const e = t.options.ruleRepetition || 3;
  if (e < 3)
    throw new Error(
      "Cannot serialize rules with repetition `" + e + "` for `options.ruleRepetition`, expected `3` or more"
    );
  return e;
}
function Ek(t, e, n) {
  const r = (Bh(n) + (n.options.ruleSpaces ? " " : "")).repeat(Ik(n));
  return n.options.ruleSpaces ? r.slice(0, -1) : r;
}
const al = {
  blockquote: Xy,
  break: ac,
  code: nk,
  definition: ik,
  emphasis: rl,
  hardBreak: ac,
  heading: uk,
  html: Oh,
  image: vh,
  imageReference: Dh,
  inlineCode: Rh,
  link: Ph,
  linkReference: Lh,
  list: bk,
  listItem: wk,
  paragraph: Ck,
  root: Sk,
  strong: ll,
  text: Ak,
  thematicBreak: Ek
};
function ds(t) {
  if (t.charCodeAt(0) !== 60) return;
  const e = t.charCodeAt(1);
  if (e === 33) {
    const l = t.charCodeAt(2);
    return l === 45 ? 2 : l === 91 ? 5 : de(l) ? 4 : void 0;
  }
  if (e === 63) return 3;
  const n = e === 47, r = n ? 2 : 1;
  let i = r, o = t.charCodeAt(i);
  if (!de(o)) return;
  for (; o === 45 || Ce(o); )
    o = t.charCodeAt(++i);
  const s = t.slice(r, i).toLowerCase();
  return !n && o !== 47 && as.includes(s) ? 1 : bh.includes(s) ? 6 : 7;
}
const Ok = [vk];
function vk(t, e, n, r) {
  if (e.type === "code" && hs(e, r) && (t.type === "list" || t.type === e.type && hs(t, r)))
    return !1;
  if ("spread" in n && typeof n.spread == "boolean") {
    if (t.type === "paragraph" && // Two paragraphs.
    (t.type === e.type || e.type === "definition" || // Paragraph followed by a setext heading.
    e.type === "heading" && Eh(e, r)))
      return;
    if (t.type === "html") {
      const i = ds(t.value);
      if (i === void 0 || i === 6 || i === 7) return 1;
    }
    if (t.type === "paragraph" && e.type === "html") {
      const i = ds(e.value);
      if (i === void 0 || i === 7) return 1;
    }
    return n.spread ? 1 : 0;
  }
}
const en = [
  "autolink",
  "destinationLiteral",
  "destinationRaw",
  "reference",
  "titleQuote",
  "titleApostrophe"
], Fh = [
  { character: "	", after: "[\\r\\n]", inConstruct: "phrasing" },
  { character: "	", before: "[\\r\\n]", inConstruct: "phrasing" },
  {
    character: "	",
    inConstruct: ["codeFencedLangGraveAccent", "codeFencedLangTilde"]
  },
  {
    character: "\r",
    inConstruct: [
      "codeFencedLangGraveAccent",
      "codeFencedLangTilde",
      "codeFencedMetaGraveAccent",
      "codeFencedMetaTilde",
      "destinationLiteral",
      "headingAtx"
    ]
  },
  {
    character: `
`,
    inConstruct: [
      "codeFencedLangGraveAccent",
      "codeFencedLangTilde",
      "codeFencedMetaGraveAccent",
      "codeFencedMetaTilde",
      "destinationLiteral",
      "headingAtx"
    ]
  },
  { character: "\r", before: "[\\r\\n]", inConstruct: "phrasing" },
  { character: "\r", after: "\\r", inConstruct: "phrasing" },
  { character: `
`, before: "\\n", inConstruct: "phrasing" },
  { character: `
`, after: "[\\r\\n]", inConstruct: "phrasing" },
  { character: " ", after: "[\\r\\n]", inConstruct: "phrasing" },
  { character: " ", before: "[\\r\\n]", inConstruct: "phrasing" },
  {
    character: " ",
    inConstruct: ["codeFencedLangGraveAccent", "codeFencedLangTilde"]
  },
  // An exclamation mark can start an image, if it is followed by a link or
  // a link reference.
  {
    character: "!",
    after: "\\[",
    inConstruct: "phrasing",
    notInConstruct: en
  },
  // A quote can break out of a title.
  { character: '"', inConstruct: "titleQuote" },
  // A number sign could start an ATX heading if it starts a line.
  { atBreak: !0, character: "#" },
  { character: "#", inConstruct: "headingAtx", after: `(?:[\r
]|$)` },
  // Dollar sign and percentage are not used in markdown.
  // An ampersand could start a character reference.
  { character: "&", after: "[#A-Za-z]", inConstruct: "phrasing" },
  // An apostrophe can break out of a title.
  { character: "'", inConstruct: "titleApostrophe" },
  // A left paren could break out of a destination raw.
  { character: "(", inConstruct: "destinationRaw" },
  // A left paren followed by `]` could make something into a link or image.
  {
    before: "\\]",
    character: "(",
    inConstruct: "phrasing",
    notInConstruct: en
  },
  // A right paren could start a list item or break out of a destination
  // raw.
  { atBreak: !0, before: "\\d+", character: ")" },
  { character: ")", inConstruct: "destinationRaw" },
  // An asterisk can start thematic breaks, list items, emphasis, strong.
  { atBreak: !0, character: "*", after: `(?:[ 	\r
*])` },
  { character: "*", inConstruct: "phrasing", notInConstruct: en },
  // A plus sign could start a list item.
  { atBreak: !0, character: "+", after: `(?:[ 	\r
])` },
  // A dash can start thematic breaks, list items, and setext heading
  // underlines.
  { atBreak: !0, character: "-", after: `(?:[ 	\r
-])` },
  // A dot could start a list item.
  { atBreak: !0, before: "\\d+", character: ".", after: `(?:[ 	\r
]|$)` },
  // Slash, colon, and semicolon are not used in markdown for constructs.
  // A less than can start html (flow or text) or an autolink.
  // HTML could start with an exclamation mark (declaration, cdata, comment),
  // slash (closing tag), question mark (instruction), or a letter (tag).
  // An autolink also starts with a letter.
  // Finally, it could break out of a destination literal.
  { atBreak: !0, character: "<", after: "[!/?A-Za-z]" },
  {
    character: "<",
    after: "[!/?A-Za-z]",
    inConstruct: "phrasing",
    notInConstruct: en
  },
  { character: "<", inConstruct: "destinationLiteral" },
  // An equals to can start setext heading underlines.
  { atBreak: !0, character: "=" },
  // A greater than can start block quotes and it can break out of a
  // destination literal.
  { atBreak: !0, character: ">" },
  { character: ">", inConstruct: "destinationLiteral" },
  // Question mark and at sign are not used in markdown for constructs.
  // A left bracket can start definitions, references, labels,
  { atBreak: !0, character: "[" },
  { character: "[", inConstruct: "phrasing", notInConstruct: en },
  { character: "[", inConstruct: ["label", "reference"] },
  // A backslash can start an escape (when followed by punctuation) or a
  // hard break (when followed by an eol).
  // Note: typical escapes are handled in `safe`!
  { character: "\\", after: "[\\r\\n]", inConstruct: "phrasing" },
  // A right bracket can exit labels.
  { character: "]", inConstruct: ["label", "reference"] },
  // Caret is not used in markdown for constructs.
  // An underscore can start emphasis, strong, or a thematic break.
  { atBreak: !0, character: "_" },
  { character: "_", inConstruct: "phrasing", notInConstruct: en },
  // A grave accent can start code (fenced or text), or it can break out of
  // a grave accent code fence.
  { atBreak: !0, character: "`" },
  {
    character: "`",
    inConstruct: ["codeFencedLangGraveAccent", "codeFencedMetaGraveAccent"]
  },
  { character: "`", inConstruct: "phrasing", notInConstruct: en },
  // Left brace, vertical bar, right brace are not used in markdown for
  // constructs.
  // A tilde can start code (fenced).
  { atBreak: !0, character: "~" },
  { character: "<", inConstruct: "autolink" },
  { character: ">", inConstruct: "autolink" },
  { character: "", inConstruct: "autolink" }
];
let cc = -1;
for (; ++cc < 33; )
  Fh.push({ character: String.fromCharCode(cc), inConstruct: "autolink" });
function Dk(t) {
  return t.label || !t.identifier ? t.label || "" : Ch(t.identifier);
}
function Rk(t) {
  if (!t._compiled) {
    const e = (t.atBreak ? "[\\r\\n][\\t ]*" : "") + (t.before ? "(?:" + t.before + ")" : "");
    t._compiled = new RegExp(
      (e ? "(" + e + ")" : "") + (/[$()*+\-.?[\\\]^{|}]/.test(t.character) ? "\\" : "") + t.character + (t.after ? "(?:" + t.after + ")" : ""),
      "g"
    );
  }
  return t._compiled;
}
function Ai(t) {
  const e = t.codePointAt(0);
  return e === void 0 ? "" : String.fromCodePoint(e);
}
function ur(t) {
  const e = t.codePointAt(t.length - 2);
  return e !== void 0 && e > 65535 ? t.slice(-2) : t.slice(-1);
}
function uc(t, e, n) {
  const r = st(t), i = st(e);
  return r === void 0 ? i === void 0 ? (
    // Letter inside:
    // we have to encode *both* letters for `_` as it is looser.
    // it already forms for `*` (and GFMs `~`).
    n === "_" ? { inside: !0, outside: !0 } : { inside: !1, outside: !1 }
  ) : i === 1 ? (
    // Whitespace inside: encode both (letter, whitespace).
    { inside: !0, outside: !0 }
  ) : (
    // Punctuation inside: encode outer (letter)
    { inside: !1, outside: !0 }
  ) : r === 1 ? i === void 0 ? (
    // Letter inside: already forms.
    { inside: !1, outside: !1 }
  ) : i === 1 ? (
    // Whitespace inside: encode both (whitespace).
    { inside: !0, outside: !0 }
  ) : (
    // Punctuation inside: already forms.
    { inside: !1, outside: !1 }
  ) : i === void 0 ? (
    // Letter inside: already forms.
    { inside: !1, outside: !1 }
  ) : i === 1 ? (
    // Whitespace inside: encode inner (whitespace).
    { inside: !0, outside: !1 }
  ) : (
    // Punctuation inside: already forms.
    { inside: !1, outside: !1 }
  );
}
const zk = /* @__PURE__ */ new Map([
  ["*", !1],
  ["_", !0]
]);
function Pk(t, e, n) {
  const r = /* @__PURE__ */ new Set();
  for (const o of t) {
    const s = n.get(o);
    if (s && o.attention && e.some((l) => l.attention === o.attention))
      for (const l of s.tokens)
        r.add(l.attention);
  }
  const i = [];
  for (const o of t)
    o.attention && r.delete(o.attention) && i.push(o.attention);
  return i.reverse(), i;
}
function _h(t, e, n) {
  const r = [], i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map();
  let s = 0;
  for (; s < t.length; ) {
    if (!t[s].attention) {
      s++;
      continue;
    }
    const l = t[s].value.charAt(0), a = zk.get(l);
    let c = s + 1;
    for (; c < t.length && t[c].attention && t[c].value.charAt(0) === l; )
      c++;
    const u = s ? t[s - 1].value : e, h = st(u.charCodeAt(u.length - 1)), d = st(
      (c < t.length ? t[c].value : n).charCodeAt(0)
    ), f = !d || d === 2 && !!h, p = !h || h === 2 && !!d, m = {
      tokens: t.slice(s, c),
      markers: [],
      start: 0,
      end: 0,
      // Underscores are strict, they cannot open or close inside words.
      open: a ? f && (!!h || !p) : f,
      close: a ? p && (!!d || !f) : p,
      // All builtins can split runs.
      split: a !== void 0
    };
    for (const y of m.tokens) {
      i.set(y, [...m.tokens]), o.set(y, m);
      let g = y.value.length;
      for (; g--; ) m.markers.push(y);
    }
    m.end = m.markers.length, r.push(m), s = c;
  }
  for (Fk(r, i), s = -1; ++s < t.length; ) {
    const l = i.get(t[s]);
    if (l) return { attention: Pk(t, l, o), index: s };
  }
}
function Lk(t, e, n) {
  return ps($h(t, e, n), n.before, n.after);
}
function Xr(t, e) {
  const n = t[e ? 0 : t.length - 1];
  if (!n || n.attention) return;
  const r = e ? Ai(n.value) : ur(n.value), i = il(
    /** @type {number} */
    r.codePointAt(0)
  );
  n.value = e ? i + n.value.slice(r.length) : n.value.slice(0, n.value.length - r.length) + i;
}
function Bk(t, e, n, r, i) {
  for (const o of n.attention) {
    const s = e.get(o) || o.sequences[0];
    for (const l of o.sequences) {
      if (l === s) continue;
      const a = new Map(e);
      a.set(o, l);
      const c = cl(t, a, r, i), u = _h(c, r, i);
      if (!u || u.index > n.index)
        return { chosen: a, mistake: u, tokens: c };
    }
  }
}
function Fk(t, e) {
  let n = 0;
  for (; n < t.length; ) {
    const r = t[n], i = r.tokens[0].value.charAt(0), o = r.end - r.start;
    let s = r.close && o ? n : 0;
    for (; s--; ) {
      const l = t[s], a = l.end - l.start;
      if (l.tokens[0].value.charAt(0) === i && l.open && a && (r.split ? (
        // The rule of 3, on the sizes that are left.
        !((l.close || r.open) && o % 3) || (a + o) % 3
      ) : (
        // Others pair whole runs of the same size.
        a === l.markers.length && a === o
      ))) {
        const c = r.split ? a > 1 && o > 1 ? 2 : 1 : o, u = l.markers.slice(l.end - c, l.end), h = r.markers.slice(r.start, r.start + c), d = u[0], f = h[0];
        if (
          // Whole sequences:
          // the markers of a sequence are next to each other,
          // so if the first and last marker are of one sequence of that size,
          // all markers are exactly that sequence.
          d === u[c - 1] && d.value.length === c && f === h[c - 1] && f.value.length === c && // Of the same attention, so its opening and closing sequence.
          d.attention === f.attention
        )
          e.delete(d), e.delete(f);
        else {
          const p = [.../* @__PURE__ */ new Set([...u, ...h])];
          for (const m of p) {
            const y = e.get(m);
            y && y.push(...p);
          }
        }
        l.end -= c, r.start += c;
        break;
      }
    }
    (s === -1 || r.start === r.end) && n++;
  }
}
function _k(t, e, n) {
  if (e.length === 0)
    throw new Error(
      "Cannot serialize `" + t + "` as attention without markers, expected one or more markers"
    );
  if (n.length === 0)
    throw new Error(
      "Cannot serialize `" + t + "` as attention without sizes, expected one or more sizes"
    );
  for (const i of n)
    if (!Number.isSafeInteger(i) || i < 1)
      throw new Error(
        "Cannot serialize `" + t + "` as attention with `" + i + "` as size, expected positive integer"
      );
  const r = [];
  for (const i of e) {
    if (i.length !== 1)
      throw new Error(
        "Cannot serialize `" + t + "` as attention with `" + i + "` as marker, expected a single ascii character"
      );
    if (!uh(i.charCodeAt(0)))
      throw new Error(
        "Cannot serialize `" + t + "` as attention with `" + i + "` as marker, expected ascii punctuation"
      );
    for (const o of n)
      r.push(i.repeat(o));
  }
  return r;
}
function $h(t, e, n) {
  const r = e.indexStack, i = t.children || [], o = [];
  let s = -1, l = n.before;
  r.push(-1);
  let a = e.createTracker(n);
  for (; ++s < i.length; ) {
    const c = i[s];
    let u;
    if (r[r.length - 1] = s, s + 1 < i.length) {
      let f = e.handle.handlers[i[s + 1].type];
      f && f.peek && (f = f.peek), u = f ? Ai(
        f(i[s + 1], t, e, {
          before: "",
          after: "",
          ...a.current()
        })
      ) : "";
    } else
      u = n.after;
    const h = o[o.length - 1];
    typeof h == "string" && (l === "\r" || l === `
`) && c.type === "html" && ds(c.value) !== 7 && (o[o.length - 1] = h.replace(/(\r?\n|\r)$/, " "), l = " ", a = e.createTracker(n), a.move(ps(o, n.before, n.after)));
    const d = e.handle.handlers[c.type];
    if (d && d.attention) {
      const { construct: f, markers: p, sizes: m } = d.attention(c, e), y = _k(c.type, p, m), g = y[0], N = e.enter(f);
      a.move(g);
      const w = $h(
        /** @type {PhrasingParents} */
        c,
        e,
        {
          ...a.current(),
          before: g,
          after: g
        }
      );
      a.move(ps(w, g, g)), a.move(g), N(), o.push({ children: w, sequences: y }), l = g.charAt(g.length - 1);
    } else {
      const f = e.handle(c, t, e, {
        ...a.current(),
        after: u,
        before: l
      });
      if (!f) continue;
      a.move(f), o.push(f), l = ur(f);
    }
  }
  return r.pop(), o;
}
function cl(t, e, n, r) {
  const i = [];
  let o, s = ur(n), l = -1;
  for (; ++l < t.length; ) {
    const a = t[l];
    if (typeof a == "string") {
      const w = { value: a, attention: void 0 };
      o && o === Ai(a) && Xr([w], !0), o = void 0, i.push(w), w.value && (s = ur(w.value));
      continue;
    }
    const c = e.get(a) || a.sequences[0], u = c.charAt(0), h = t[l + 1], d = s, f = Ai(
      h === void 0 ? r : typeof h == "string" ? h : e.get(h) || h.sequences[0]
    ), p = cl(a.children, e, c, c), m = p.length > 0 ? p[0].value : "", y = uc(
      d.charCodeAt(d.length - 1),
      m.charCodeAt(0),
      u
    );
    y.inside && Xr(p, !0);
    const g = p.length > 0 ? ur(p[p.length - 1].value) : "", N = uc(
      f.charCodeAt(0),
      g.charCodeAt(g.length - 1),
      u
    );
    N.inside && Xr(p, !1), y.outside && d !== `
` && d !== "\r" && Xr(i, !1), N.outside && (o = f), i.push({ value: c, attention: a }, ...p, {
      value: c,
      attention: a
    }), s = c.charAt(c.length - 1);
  }
  return i;
}
function ps(t, e, n) {
  let r = /* @__PURE__ */ new Map();
  const i = cl(t, r, e, n);
  let o = i, s = _h(o, e, n);
  for (; s; ) {
    const a = Bk(t, r, s, e, n);
    if (!a) {
      o = i;
      break;
    }
    r = a.chosen, o = a.tokens, s = a.mistake;
  }
  let l = "";
  for (const a of o) l += a.value;
  return l;
}
function $k(t, e, n) {
  const r = e.indexStack, i = t.children || [], o = e.createTracker(n), s = [];
  let l = -1;
  for (r.push(-1); ++l < i.length; ) {
    const a = i[l];
    r[r.length - 1] = l, s.push(
      o.move(
        e.handle(a, t, e, {
          before: `
`,
          after: `
`,
          ...o.current()
        })
      )
    ), a.type !== "list" && (e.bulletLastUsed = void 0), l < i.length - 1 && s.push(
      o.move(Vk(a, i[l + 1], t, e))
    );
  }
  return r.pop(), s.join("");
}
function Vk(t, e, n, r) {
  let i = r.join.length;
  for (; i--; ) {
    const o = r.join[i](t, e, n, r);
    if (o === !0 || o === 1)
      break;
    if (typeof o == "number")
      return `
`.repeat(1 + o);
    if (o === !1)
      return `

<!---->

`;
  }
  return `

`;
}
const Hk = /\r?\n|\r/g;
function jk(t, e) {
  const n = [];
  let r = 0, i = 0, o;
  for (; o = Hk.exec(t); )
    s(t.slice(r, o.index)), n.push(o[0]), r = o.index + o[0].length, i++;
  return s(t.slice(r)), n.join("");
  function s(l) {
    n.push(e(l, i, !l));
  }
}
const po = {}.hasOwnProperty;
function qk(t, e, n) {
  const r = (n.before || "") + (e || "") + (n.after || ""), i = [], o = [], s = {}, l = t.stack.includes("autolink");
  let a = -1;
  for (; ++a < t.unsafe.length; ) {
    const f = t.unsafe[a];
    if (!Ah(t.stack, f))
      continue;
    const p = t.compilePattern(f);
    let m;
    for (; m = p.exec(r); ) {
      const y = "before" in f || !!f.atBreak, g = "after" in f, N = m.index + (y ? m[1].length : 0);
      po.call(s, N) ? (s[N].before && !y && (s[N].before = !1), s[N].after && !g && (s[N].after = !1)) : (i.push(N), s[N] = { before: y, after: g });
    }
  }
  i.sort(Wk);
  const c = n.before ? n.before.length : 0, u = r.length - (n.after ? n.after.length : 0);
  let h = c;
  for (a = -1; ++a < i.length; ) {
    const f = i[a];
    if (!(f < h || f >= u)) {
      if (r.charAt(f) === "_" && // Preceded by an unescaped character that is not punctuation or whitespace:
      f > 0 && st(r.charCodeAt(f - 1)) === void 0 && !po.call(s, f - 1) && // Characters next to attention markers can become character references
      // later, turning `a` into `&#x61;`, so those do not count.
      !(f - 1 === c && /[*_]/.test(r.charAt(c - 1)))) {
        let p = f + 1;
        for (; p < u && r.charAt(p) === "_"; )
          p++;
        const m = p - f - 1;
        if (
          // All underscores in the run are unsafe positions, so they can be
          // skipped.
          i[a + m] === p - 1 && // Rest as above.
          p < r.length && st(r.charCodeAt(p)) === void 0 && !po.call(s, p) && !(p === u - 1 && /[*_]/.test(r.charAt(u)))
        ) {
          a += m;
          continue;
        }
      }
      if (!(f + 1 < u && i[a + 1] === f + 1 && s[f].after && !s[f + 1].before && !s[f + 1].after || i[a - 1] === f - 1 && s[f].before && !s[f - 1].before && !s[f - 1].after)) {
        if (h !== f) {
          const p = r.slice(h, f);
          o.push(l ? p : hc(p, "\\"));
        }
        h = f, l ? (o.push(
          "%" + r.charCodeAt(f).toString(16).toUpperCase().padStart(2, "0")
        ), h++) : /[!-/:-@[-`{-~]/.test(r.charAt(f)) && (!n.encode || !n.encode.includes(r.charAt(f))) ? o.push("\\") : (o.push(il(r.charCodeAt(f))), h++);
      }
    }
  }
  const d = r.slice(h, u);
  return o.push(l ? d : hc(d, n.after)), o.join("");
}
function Wk(t, e) {
  return t - e;
}
function hc(t, e) {
  const n = /\\(?=[!-/:-@[-`{-~])/g, r = [], i = [], o = t + e;
  let s = -1, l = 0, a;
  for (; a = n.exec(o); )
    r.push(a.index);
  for (; ++s < r.length; )
    l !== r[s] && i.push(t.slice(l, r[s])), i.push("\\"), l = r[s];
  return i.push(t.slice(l)), i.join("");
}
function Kk(t) {
  const e = t || {}, n = e.now || {};
  let r = e.lineShift || 0, i = n.line || 1, o = n.column || 1;
  return { move: a, current: s, shift: l };
  function s() {
    return { now: { line: i, column: o }, lineShift: r };
  }
  function l(c) {
    r += c;
  }
  function a(c) {
    const u = c || "", h = u.split(/\r?\n|\r/g), d = h[h.length - 1];
    return i += h.length - 1, o = h.length === 1 ? o + d.length : 1 + d.length + r, u;
  }
}
function Uk(t, e) {
  const n = e || {}, r = {
    associationId: Dk,
    bulletCurrent: void 0,
    bulletLastUsed: void 0,
    containerPhrasing: Qk,
    containerFlow: Xk,
    createTracker: Kk,
    compilePattern: Rk,
    enter: o,
    // @ts-expect-error: GFM / frontmatter are typed in `mdast` but not defined
    // here.
    handlers: { ...al },
    // @ts-expect-error: add `handle` in a second.
    handle: void 0,
    indentLines: jk,
    indexStack: [],
    join: [...Ok],
    options: {},
    safe: Zk,
    stack: [],
    unsafe: [...Fh]
  };
  Th(r, n), r.options.tightDefinitions && r.join.push(Yk), r.handle = Gy("type", {
    invalid: Jk,
    unknown: Gk,
    handlers: r.handlers
  });
  let i = r.handle(
    Mh(t) ? { type: "root", children: [t] } : t,
    void 0,
    r,
    { before: `
`, after: `
`, now: { line: 1, column: 1 }, lineShift: 0 }
  );
  return i && i.charCodeAt(i.length - 1) !== 10 && i.charCodeAt(i.length - 1) !== 13 && (i += `
`), i;
  function o(s) {
    return r.stack.push(s), l;
    function l() {
      r.stack.pop();
    }
  }
}
function Jk(t) {
  throw new Error("Cannot handle value `" + t + "`, expected node");
}
function Gk(t) {
  const e = (
    /** @type {Nodes} */
    t
  );
  throw new Error("Cannot handle unknown node `" + e.type + "`");
}
function Yk(t, e) {
  if (t.type === "definition" && t.type === e.type)
    return 0;
}
function Qk(t, e) {
  return Lk(t, this, e);
}
function Xk(t, e) {
  return $k(t, this, e);
}
function Zk(t, e) {
  return qk(this, t, e);
}
function ms(t) {
  const e = this;
  e.compiler = n;
  function n(r) {
    return Uk(r, {
      ...e.data("settings"),
      ...t,
      // Note: this option is not in the readme.
      // The goal is for it to be set by plugins on `data` instead of being
      // passed by users.
      extensions: e.data("toMarkdownExtensions") || []
    });
  }
}
function fc(t) {
  if (t)
    throw t;
}
function eb(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var mo, dc;
function tb() {
  if (dc) return mo;
  dc = 1;
  var t = Object.prototype.hasOwnProperty, e = Object.prototype.toString, n = Object.defineProperty, r = Object.getOwnPropertyDescriptor, i = function(c) {
    return typeof Array.isArray == "function" ? Array.isArray(c) : e.call(c) === "[object Array]";
  }, o = function(c) {
    if (!c || e.call(c) !== "[object Object]")
      return !1;
    var u = t.call(c, "constructor"), h = c.constructor && c.constructor.prototype && t.call(c.constructor.prototype, "isPrototypeOf");
    if (c.constructor && !u && !h)
      return !1;
    var d;
    for (d in c)
      ;
    return typeof d > "u" || t.call(c, d);
  }, s = function(c, u) {
    n && u.name === "__proto__" ? n(c, u.name, {
      enumerable: !0,
      configurable: !0,
      value: u.newValue,
      writable: !0
    }) : c[u.name] = u.newValue;
  }, l = function(c, u) {
    if (u === "__proto__")
      if (t.call(c, u)) {
        if (r)
          return r(c, u).value;
      } else return;
    return c[u];
  };
  return mo = function a() {
    var c, u, h, d, f, p, m = arguments[0], y = 1, g = arguments.length, N = !1;
    for (typeof m == "boolean" && (N = m, m = arguments[1] || {}, y = 2), (m == null || typeof m != "object" && typeof m != "function") && (m = {}); y < g; ++y)
      if (c = arguments[y], c != null)
        for (u in c)
          h = l(m, u), d = l(c, u), m !== d && (N && d && (o(d) || (f = i(d))) ? (f ? (f = !1, p = h && i(h) ? h : []) : p = h && o(h) ? h : {}, s(m, { name: u, newValue: a(N, p, d) })) : typeof d < "u" && s(m, { name: u, newValue: d }));
    return m;
  }, mo;
}
var nb = tb();
const go = /* @__PURE__ */ eb(nb);
function gs(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = Object.getPrototypeOf(t);
  return (e === null || e === Object.prototype || Object.getPrototypeOf(e) === null) && !(Symbol.toStringTag in t) && !(Symbol.iterator in t);
}
function rb() {
  const t = [], e = { run: n, use: r };
  return e;
  function n(...i) {
    let o = -1;
    const s = i.pop();
    if (typeof s != "function")
      throw new TypeError("Expected function as last argument, not " + s);
    l(null, ...i);
    function l(a, ...c) {
      const u = t[++o];
      let h = -1;
      if (a) {
        s(a);
        return;
      }
      for (; ++h < i.length; )
        (c[h] === null || c[h] === void 0) && (c[h] = i[h]);
      i = c, u ? ib(u, l)(...c) : s(null, ...c);
    }
  }
  function r(i) {
    if (typeof i != "function")
      throw new TypeError(
        "Expected `middelware` to be a function, not " + i
      );
    return t.push(i), e;
  }
}
function ib(t, e) {
  let n;
  return r;
  function r(...s) {
    const l = t.length > s.length;
    let a;
    l && s.push(i);
    try {
      a = t.apply(this, s);
    } catch (c) {
      const u = (
        /** @type {Error} */
        c
      );
      if (l && n)
        throw u;
      return i(u);
    }
    l || (a && a.then && typeof a.then == "function" ? a.then(o, i) : a instanceof Error ? i(a) : o(a));
  }
  function i(s, ...l) {
    n || (n = !0, e(s, ...l));
  }
  function o(s) {
    i(null, s);
  }
}
class Ee extends Error {
  /**
   * Create a message for `reason`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {Options | null | undefined} [options]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | Options | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns
   *   Instance of `VFileMessage`.
   */
  // eslint-disable-next-line complexity
  constructor(e, n, r) {
    super(), typeof n == "string" && (r = n, n = void 0);
    let i = "", o = {}, s = !1;
    if (n && ("line" in n && "column" in n ? o = { place: n } : "start" in n && "end" in n ? o = { place: n } : "type" in n ? o = {
      ancestors: [n],
      place: n.position
    } : o = { ...n }), typeof e == "string" ? i = e : !o.cause && e && (s = !0, i = e.message, o.cause = e), !o.ruleId && !o.source && typeof r == "string") {
      const a = r.indexOf(":");
      a === -1 ? o.ruleId = r : (o.source = r.slice(0, a), o.ruleId = r.slice(a + 1));
    }
    if (!o.place && o.ancestors && o.ancestors) {
      const a = o.ancestors[o.ancestors.length - 1];
      a && (o.place = a.position);
    }
    const l = o.place && "start" in o.place ? o.place.start : o.place;
    this.ancestors = o.ancestors || void 0, this.cause = o.cause || void 0, this.column = l ? l.column : void 0, this.fatal = void 0, this.file = "", this.message = i, this.line = l ? l.line : void 0, this.name = cr(o.place) || "1:1", this.place = o.place || void 0, this.reason = this.message, this.ruleId = o.ruleId || void 0, this.source = o.source || void 0, this.stack = s && o.cause && typeof o.cause.stack == "string" ? o.cause.stack : "", this.actual = void 0, this.expected = void 0, this.note = void 0, this.url = void 0;
  }
}
Ee.prototype.file = "";
Ee.prototype.name = "";
Ee.prototype.reason = "";
Ee.prototype.message = "";
Ee.prototype.stack = "";
Ee.prototype.column = void 0;
Ee.prototype.line = void 0;
Ee.prototype.ancestors = void 0;
Ee.prototype.cause = void 0;
Ee.prototype.fatal = void 0;
Ee.prototype.place = void 0;
Ee.prototype.ruleId = void 0;
Ee.prototype.source = void 0;
const nt = { basename: ob, dirname: sb, extname: lb, join: ab, sep: "/" };
function ob(t, e) {
  if (e !== void 0 && typeof e != "string")
    throw new TypeError('"ext" argument must be a string');
  Pr(t);
  let n = 0, r = -1, i = t.length, o;
  if (e === void 0 || e.length === 0 || e.length > t.length) {
    for (; i--; )
      if (t.codePointAt(i) === 47) {
        if (o) {
          n = i + 1;
          break;
        }
      } else r < 0 && (o = !0, r = i + 1);
    return r < 0 ? "" : t.slice(n, r);
  }
  if (e === t)
    return "";
  let s = -1, l = e.length - 1;
  for (; i--; )
    if (t.codePointAt(i) === 47) {
      if (o) {
        n = i + 1;
        break;
      }
    } else
      s < 0 && (o = !0, s = i + 1), l > -1 && (t.codePointAt(i) === e.codePointAt(l--) ? l < 0 && (r = i) : (l = -1, r = s));
  return n === r ? r = s : r < 0 && (r = t.length), t.slice(n, r);
}
function sb(t) {
  if (Pr(t), t.length === 0)
    return ".";
  let e = -1, n = t.length, r;
  for (; --n; )
    if (t.codePointAt(n) === 47) {
      if (r) {
        e = n;
        break;
      }
    } else r || (r = !0);
  return e < 0 ? t.codePointAt(0) === 47 ? "/" : "." : e === 1 && t.codePointAt(0) === 47 ? "//" : t.slice(0, e);
}
function lb(t) {
  Pr(t);
  let e = t.length, n = -1, r = 0, i = -1, o = 0, s;
  for (; e--; ) {
    const l = t.codePointAt(e);
    if (l === 47) {
      if (s) {
        r = e + 1;
        break;
      }
      continue;
    }
    n < 0 && (s = !0, n = e + 1), l === 46 ? i < 0 ? i = e : o !== 1 && (o = 1) : i > -1 && (o = -1);
  }
  return i < 0 || n < 0 || // We saw a non-dot character immediately before the dot.
  o === 0 || // The (right-most) trimmed path component is exactly `..`.
  o === 1 && i === n - 1 && i === r + 1 ? "" : t.slice(i, n);
}
function ab(...t) {
  let e = -1, n;
  for (; ++e < t.length; )
    Pr(t[e]), t[e] && (n = n === void 0 ? t[e] : n + "/" + t[e]);
  return n === void 0 ? "." : cb(n);
}
function cb(t) {
  Pr(t);
  const e = t.codePointAt(0) === 47;
  let n = ub(t, !e);
  return n.length === 0 && !e && (n = "."), n.length > 0 && t.codePointAt(t.length - 1) === 47 && (n += "/"), e ? "/" + n : n;
}
function ub(t, e) {
  let n = "", r = 0, i = -1, o = 0, s = -1, l, a;
  for (; ++s <= t.length; ) {
    if (s < t.length)
      l = t.codePointAt(s);
    else {
      if (l === 47)
        break;
      l = 47;
    }
    if (l === 47) {
      if (!(i === s - 1 || o === 1)) if (i !== s - 1 && o === 2) {
        if (n.length < 2 || r !== 2 || n.codePointAt(n.length - 1) !== 46 || n.codePointAt(n.length - 2) !== 46) {
          if (n.length > 2) {
            if (a = n.lastIndexOf("/"), a !== n.length - 1) {
              a < 0 ? (n = "", r = 0) : (n = n.slice(0, a), r = n.length - 1 - n.lastIndexOf("/")), i = s, o = 0;
              continue;
            }
          } else if (n.length > 0) {
            n = "", r = 0, i = s, o = 0;
            continue;
          }
        }
        e && (n = n.length > 0 ? n + "/.." : "..", r = 2);
      } else
        n.length > 0 ? n += "/" + t.slice(i + 1, s) : n = t.slice(i + 1, s), r = s - i - 1;
      i = s, o = 0;
    } else l === 46 && o > -1 ? o++ : o = -1;
  }
  return n;
}
function Pr(t) {
  if (typeof t != "string")
    throw new TypeError(
      "Path must be a string. Received " + JSON.stringify(t)
    );
}
const hb = { cwd: fb };
function fb() {
  return "/";
}
function ys(t) {
  return !!(t !== null && typeof t == "object" && "href" in t && t.href && "protocol" in t && t.protocol && // @ts-expect-error: indexing is fine.
  t.auth === void 0);
}
function db(t) {
  if (typeof t == "string")
    t = new URL(t);
  else if (!ys(t)) {
    const e = new TypeError(
      'The "path" argument must be of type string or an instance of URL. Received `' + t + "`"
    );
    throw e.code = "ERR_INVALID_ARG_TYPE", e;
  }
  if (t.protocol !== "file:") {
    const e = new TypeError("The URL must be of scheme file");
    throw e.code = "ERR_INVALID_URL_SCHEME", e;
  }
  return pb(t);
}
function pb(t) {
  if (t.hostname !== "") {
    const r = new TypeError(
      'File URL host must be "localhost" or empty on darwin'
    );
    throw r.code = "ERR_INVALID_FILE_URL_HOST", r;
  }
  const e = t.pathname;
  let n = -1;
  for (; ++n < e.length; )
    if (e.codePointAt(n) === 37 && e.codePointAt(n + 1) === 50) {
      const r = e.codePointAt(n + 2);
      if (r === 70 || r === 102) {
        const i = new TypeError(
          "File URL path must not include encoded / characters"
        );
        throw i.code = "ERR_INVALID_FILE_URL_PATH", i;
      }
    }
  return decodeURIComponent(e);
}
const yo = (
  /** @type {const} */
  [
    "history",
    "path",
    "basename",
    "stem",
    "extname",
    "dirname"
  ]
);
class mb {
  /**
   * Create a new virtual file.
   *
   * `options` is treated as:
   *
   * *   `string` or `Uint8Array` — `{value: options}`
   * *   `URL` — `{path: options}`
   * *   `VFile` — shallow copies its data over to the new file
   * *   `object` — all fields are shallow copied over to the new file
   *
   * Path related fields are set in the following order (least specific to
   * most specific): `history`, `path`, `basename`, `stem`, `extname`,
   * `dirname`.
   *
   * You cannot set `dirname` or `extname` without setting either `history`,
   * `path`, `basename`, or `stem` too.
   *
   * @param {Compatible | null | undefined} [value]
   *   File value.
   * @returns
   *   New instance.
   */
  constructor(e) {
    let n;
    e ? ys(e) ? n = { path: e } : typeof e == "string" || gb(e) ? n = { value: e } : n = e : n = {}, this.cwd = "cwd" in n ? "" : hb.cwd(), this.data = {}, this.history = [], this.messages = [], this.value, this.map, this.result, this.stored;
    let r = -1;
    for (; ++r < yo.length; ) {
      const o = yo[r];
      o in n && n[o] !== void 0 && n[o] !== null && (this[o] = o === "history" ? [...n[o]] : n[o]);
    }
    let i;
    for (i in n)
      yo.includes(i) || (this[i] = n[i]);
  }
  /**
   * Get the basename (including extname) (example: `'index.min.js'`).
   *
   * @returns {string | undefined}
   *   Basename.
   */
  get basename() {
    return typeof this.path == "string" ? nt.basename(this.path) : void 0;
  }
  /**
   * Set basename (including extname) (`'index.min.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} basename
   *   Basename.
   * @returns {undefined}
   *   Nothing.
   */
  set basename(e) {
    bo(e, "basename"), ko(e, "basename"), this.path = nt.join(this.dirname || "", e);
  }
  /**
   * Get the parent path (example: `'~'`).
   *
   * @returns {string | undefined}
   *   Dirname.
   */
  get dirname() {
    return typeof this.path == "string" ? nt.dirname(this.path) : void 0;
  }
  /**
   * Set the parent path (example: `'~'`).
   *
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} dirname
   *   Dirname.
   * @returns {undefined}
   *   Nothing.
   */
  set dirname(e) {
    pc(this.basename, "dirname"), this.path = nt.join(e || "", this.basename);
  }
  /**
   * Get the extname (including dot) (example: `'.js'`).
   *
   * @returns {string | undefined}
   *   Extname.
   */
  get extname() {
    return typeof this.path == "string" ? nt.extname(this.path) : void 0;
  }
  /**
   * Set the extname (including dot) (example: `'.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} extname
   *   Extname.
   * @returns {undefined}
   *   Nothing.
   */
  set extname(e) {
    if (ko(e, "extname"), pc(this.dirname, "extname"), e) {
      if (e.codePointAt(0) !== 46)
        throw new Error("`extname` must start with `.`");
      if (e.includes(".", 1))
        throw new Error("`extname` cannot contain multiple dots");
    }
    this.path = nt.join(this.dirname, this.stem + (e || ""));
  }
  /**
   * Get the full path (example: `'~/index.min.js'`).
   *
   * @returns {string}
   *   Path.
   */
  get path() {
    return this.history[this.history.length - 1];
  }
  /**
   * Set the full path (example: `'~/index.min.js'`).
   *
   * Cannot be nullified.
   * You can set a file URL (a `URL` object with a `file:` protocol) which will
   * be turned into a path with `url.fileURLToPath`.
   *
   * @param {URL | string} path
   *   Path.
   * @returns {undefined}
   *   Nothing.
   */
  set path(e) {
    ys(e) && (e = db(e)), bo(e, "path"), this.path !== e && this.history.push(e);
  }
  /**
   * Get the stem (basename w/o extname) (example: `'index.min'`).
   *
   * @returns {string | undefined}
   *   Stem.
   */
  get stem() {
    return typeof this.path == "string" ? nt.basename(this.path, this.extname) : void 0;
  }
  /**
   * Set the stem (basename w/o extname) (example: `'index.min'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} stem
   *   Stem.
   * @returns {undefined}
   *   Nothing.
   */
  set stem(e) {
    bo(e, "stem"), ko(e, "stem"), this.path = nt.join(this.dirname || "", e + (this.extname || ""));
  }
  // Normal prototypal methods.
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(e, n, r) {
    const i = this.message(e, n, r);
    throw i.fatal = !0, i;
  }
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(e, n, r) {
    const i = this.message(e, n, r);
    return i.fatal = void 0, i;
  }
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(e, n, r) {
    const i = new Ee(
      // @ts-expect-error: the overloads are fine.
      e,
      n,
      r
    );
    return this.path && (i.name = this.path + ":" + i.name, i.file = this.path), i.fatal = !1, this.messages.push(i), i;
  }
  /**
   * Serialize the file.
   *
   * > **Note**: which encodings are supported depends on the engine.
   * > For info on Node.js, see:
   * > <https://nodejs.org/api/util.html#whatwg-supported-encodings>.
   *
   * @param {string | null | undefined} [encoding='utf8']
   *   Character encoding to understand `value` as when it’s a `Uint8Array`
   *   (default: `'utf-8'`).
   * @returns {string}
   *   Serialized file.
   */
  toString(e) {
    return this.value === void 0 ? "" : typeof this.value == "string" ? this.value : new TextDecoder(e || void 0).decode(this.value);
  }
}
function ko(t, e) {
  if (t && t.includes(nt.sep))
    throw new Error(
      "`" + e + "` cannot be a path: did not expect `" + nt.sep + "`"
    );
}
function bo(t, e) {
  if (!t)
    throw new Error("`" + e + "` cannot be empty");
}
function pc(t, e) {
  if (!t)
    throw new Error("Setting `" + e + "` requires `path` to be set too");
}
function gb(t) {
  return !!(t && typeof t == "object" && "byteLength" in t && "byteOffset" in t);
}
const yb = (
  /**
   * @type {new <Parameters extends Array<unknown>, Result>(property: string | symbol) => (...parameters: Parameters) => Result}
   */
  /** @type {unknown} */
  /**
   * @this {Function}
   * @param {string | symbol} property
   * @returns {(...parameters: Array<unknown>) => unknown}
   */
  (function(t) {
    const r = (
      /** @type {Record<string | symbol, Function>} */
      // Prototypes do exist.
      // type-coverage:ignore-next-line
      this.constructor.prototype
    ), i = r[t], o = function() {
      return i.apply(o, arguments);
    };
    return Object.setPrototypeOf(o, r), o;
  })
), kb = {}.hasOwnProperty;
class ul extends yb {
  /**
   * Create a processor.
   */
  constructor() {
    super("copy"), this.Compiler = void 0, this.Parser = void 0, this.attachers = [], this.compiler = void 0, this.freezeIndex = -1, this.frozen = void 0, this.namespace = {}, this.parser = void 0, this.transformers = rb();
  }
  /**
   * Copy a processor.
   *
   * @deprecated
   *   This is a private internal method and should not be used.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   New *unfrozen* processor ({@linkcode Processor}) that is
   *   configured to work the same as its ancestor.
   *   When the descendant processor is configured in the future it does not
   *   affect the ancestral processor.
   */
  copy() {
    const e = (
      /** @type {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>} */
      new ul()
    );
    let n = -1;
    for (; ++n < this.attachers.length; ) {
      const r = this.attachers[n];
      e.use(...r);
    }
    return e.data(go(!0, {}, this.namespace)), e;
  }
  /**
   * Configure the processor with info available to all plugins.
   * Information is stored in an object.
   *
   * Typically, options can be given to a specific plugin, but sometimes it
   * makes sense to have information shared with several plugins.
   * For example, a list of HTML elements that are self-closing, which is
   * needed during all phases.
   *
   * > **Note**: setting information cannot occur on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * > **Note**: to register custom data in TypeScript, augment the
   * > {@linkcode Data} interface.
   *
   * @example
   *   This example show how to get and set info:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   const processor = unified().data('alpha', 'bravo')
   *
   *   processor.data('alpha') // => 'bravo'
   *
   *   processor.data() // => {alpha: 'bravo'}
   *
   *   processor.data({charlie: 'delta'})
   *
   *   processor.data() // => {charlie: 'delta'}
   *   ```
   *
   * @template {keyof Data} Key
   *
   * @overload
   * @returns {Data}
   *
   * @overload
   * @param {Data} dataset
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Key} key
   * @returns {Data[Key]}
   *
   * @overload
   * @param {Key} key
   * @param {Data[Key]} value
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @param {Data | Key} [key]
   *   Key to get or set, or entire dataset to set, or nothing to get the
   *   entire dataset (optional).
   * @param {Data[Key]} [value]
   *   Value to set (optional).
   * @returns {unknown}
   *   The current processor when setting, the value at `key` when getting, or
   *   the entire dataset when getting without key.
   */
  data(e, n) {
    return typeof e == "string" ? arguments.length === 2 ? (Co("data", this.frozen), this.namespace[e] = n, this) : kb.call(this.namespace, e) && this.namespace[e] || void 0 : e ? (Co("data", this.frozen), this.namespace = e, this) : this.namespace;
  }
  /**
   * Freeze a processor.
   *
   * Frozen processors are meant to be extended and not to be configured
   * directly.
   *
   * When a processor is frozen it cannot be unfrozen.
   * New processors working the same way can be created by calling the
   * processor.
   *
   * It’s possible to freeze processors explicitly by calling `.freeze()`.
   * Processors freeze automatically when `.parse()`, `.run()`, `.runSync()`,
   * `.stringify()`, `.process()`, or `.processSync()` are called.
   *
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   The current processor.
   */
  freeze() {
    if (this.frozen)
      return this;
    const e = (
      /** @type {Processor} */
      /** @type {unknown} */
      this
    );
    for (; ++this.freezeIndex < this.attachers.length; ) {
      const [n, ...r] = this.attachers[this.freezeIndex];
      if (r[0] === !1)
        continue;
      r[0] === !0 && (r[0] = void 0);
      const i = n.call(e, ...r);
      typeof i == "function" && this.transformers.use(i);
    }
    return this.frozen = !0, this.freezeIndex = Number.POSITIVE_INFINITY, this;
  }
  /**
   * Parse text to a syntax tree.
   *
   * > **Note**: `parse` freezes the processor if not already *frozen*.
   *
   * > **Note**: `parse` performs the parse phase, not the run phase or other
   * > phases.
   *
   * @param {Compatible | undefined} [file]
   *   file to parse (optional); typically `string` or `VFile`; any value
   *   accepted as `x` in `new VFile(x)`.
   * @returns {ParseTree extends undefined ? Node : ParseTree}
   *   Syntax tree representing `file`.
   */
  parse(e) {
    this.freeze();
    const n = Zr(e), r = this.parser || this.Parser;
    return xo("parse", r), r(String(n), n);
  }
  /**
   * Process the given file as configured on the processor.
   *
   * > **Note**: `process` freezes the processor if not already *frozen*.
   *
   * > **Note**: `process` performs the parse, run, and stringify phases.
   *
   * @overload
   * @param {Compatible | undefined} file
   * @param {ProcessCallback<VFileWithOutput<CompileResult>>} done
   * @returns {undefined}
   *
   * @overload
   * @param {Compatible | undefined} [file]
   * @returns {Promise<VFileWithOutput<CompileResult>>}
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`]; any value accepted as
   *   `x` in `new VFile(x)`.
   * @param {ProcessCallback<VFileWithOutput<CompileResult>> | undefined} [done]
   *   Callback (optional).
   * @returns {Promise<VFile> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise a promise, rejected with a fatal error or resolved with the
   *   processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  process(e, n) {
    const r = this;
    return this.freeze(), xo("process", this.parser || this.Parser), wo("process", this.compiler || this.Compiler), n ? i(void 0, n) : new Promise(i);
    function i(o, s) {
      const l = Zr(e), a = (
        /** @type {HeadTree extends undefined ? Node : HeadTree} */
        /** @type {unknown} */
        r.parse(l)
      );
      r.run(a, l, function(u, h, d) {
        if (u || !h || !d)
          return c(u);
        const f = (
          /** @type {CompileTree extends undefined ? Node : CompileTree} */
          /** @type {unknown} */
          h
        ), p = r.stringify(f, d);
        xb(p) ? d.value = p : d.result = p, c(
          u,
          /** @type {VFileWithOutput<CompileResult>} */
          d
        );
      });
      function c(u, h) {
        u || !h ? s(u) : o ? o(h) : n(void 0, h);
      }
    }
  }
  /**
   * Process the given file as configured on the processor.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `processSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `processSync` performs the parse, run, and stringify phases.
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`; any value accepted as
   *   `x` in `new VFile(x)`.
   * @returns {VFileWithOutput<CompileResult>}
   *   The processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  processSync(e) {
    let n = !1, r;
    return this.freeze(), xo("processSync", this.parser || this.Parser), wo("processSync", this.compiler || this.Compiler), this.process(e, i), gc("processSync", "process", n), r;
    function i(o, s) {
      n = !0, fc(o), r = s;
    }
  }
  /**
   * Run *transformers* on a syntax tree.
   *
   * > **Note**: `run` freezes the processor if not already *frozen*.
   *
   * > **Note**: `run` performs the run phase, not other phases.
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} file
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} [file]
   * @returns {Promise<TailTree extends undefined ? Node : TailTree>}
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {(
   *   RunCallback<TailTree extends undefined ? Node : TailTree> |
   *   Compatible
   * )} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} [done]
   *   Callback (optional).
   * @returns {Promise<TailTree extends undefined ? Node : TailTree> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise, a promise rejected with a fatal error or resolved with the
   *   transformed tree.
   */
  run(e, n, r) {
    mc(e), this.freeze();
    const i = this.transformers;
    return !r && typeof n == "function" && (r = n, n = void 0), r ? o(void 0, r) : new Promise(o);
    function o(s, l) {
      const a = Zr(n);
      i.run(e, a, c);
      function c(u, h, d) {
        const f = (
          /** @type {TailTree extends undefined ? Node : TailTree} */
          h || e
        );
        u ? l(u) : s ? s(f) : r(void 0, f, d);
      }
    }
  }
  /**
   * Run *transformers* on a syntax tree.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `runSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `runSync` performs the run phase, not other phases.
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {TailTree extends undefined ? Node : TailTree}
   *   Transformed tree.
   */
  runSync(e, n) {
    let r = !1, i;
    return this.run(e, n, o), gc("runSync", "run", r), i;
    function o(s, l) {
      fc(s), i = l, r = !0;
    }
  }
  /**
   * Compile a syntax tree.
   *
   * > **Note**: `stringify` freezes the processor if not already *frozen*.
   *
   * > **Note**: `stringify` performs the stringify phase, not the run phase
   * > or other phases.
   *
   * @param {CompileTree extends undefined ? Node : CompileTree} tree
   *   Tree to compile.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {CompileResult extends undefined ? Value : CompileResult}
   *   Textual representation of the tree (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most compilers
   *   > return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  stringify(e, n) {
    this.freeze();
    const r = Zr(n), i = this.compiler || this.Compiler;
    return wo("stringify", i), mc(e), i(e, r);
  }
  /**
   * Configure the processor to use a plugin, a list of usable values, or a
   * preset.
   *
   * If the processor is already using a plugin, the previous plugin
   * configuration is changed based on the options that are passed in.
   * In other words, the plugin is not added a second time.
   *
   * > **Note**: `use` cannot be called on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * @example
   *   There are many ways to pass plugins to `.use()`.
   *   This example gives an overview:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   unified()
   *     // Plugin with options:
   *     .use(pluginA, {x: true, y: true})
   *     // Passing the same plugin again merges configuration (to `{x: true, y: false, z: true}`):
   *     .use(pluginA, {y: false, z: true})
   *     // Plugins:
   *     .use([pluginB, pluginC])
   *     // Two plugins, the second with options:
   *     .use([pluginD, [pluginE, {}]])
   *     // Preset with plugins and settings:
   *     .use({plugins: [pluginF, [pluginG, {}]], settings: {position: false}})
   *     // Settings only:
   *     .use({settings: {position: false}})
   *   ```
   *
   * @template {Array<unknown>} [Parameters=[]]
   * @template {Node | string | undefined} [Input=undefined]
   * @template [Output=Input]
   *
   * @overload
   * @param {Preset | null | undefined} [preset]
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {PluggableList} list
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Plugin<Parameters, Input, Output>} plugin
   * @param {...(Parameters | [boolean])} parameters
   * @returns {UsePlugin<ParseTree, HeadTree, TailTree, CompileTree, CompileResult, Input, Output>}
   *
   * @param {PluggableList | Plugin | Preset | null | undefined} value
   *   Usable value.
   * @param {...unknown} parameters
   *   Parameters, when a plugin is given as a usable value.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   Current processor.
   */
  use(e, ...n) {
    const r = this.attachers, i = this.namespace;
    if (Co("use", this.frozen), e != null) if (typeof e == "function")
      a(e, n);
    else if (typeof e == "object")
      Array.isArray(e) ? l(e) : s(e);
    else
      throw new TypeError("Expected usable value, not `" + e + "`");
    return this;
    function o(c) {
      if (typeof c == "function")
        a(c, []);
      else if (typeof c == "object")
        if (Array.isArray(c)) {
          const [u, ...h] = (
            /** @type {PluginTuple<Array<unknown>>} */
            c
          );
          a(u, h);
        } else
          s(c);
      else
        throw new TypeError("Expected usable value, not `" + c + "`");
    }
    function s(c) {
      if (!("plugins" in c) && !("settings" in c))
        throw new Error(
          "Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither"
        );
      l(c.plugins), c.settings && (i.settings = go(!0, i.settings, c.settings));
    }
    function l(c) {
      let u = -1;
      if (c != null) if (Array.isArray(c))
        for (; ++u < c.length; ) {
          const h = c[u];
          o(h);
        }
      else
        throw new TypeError("Expected a list of plugins, not `" + c + "`");
    }
    function a(c, u) {
      let h = -1, d = -1;
      for (; ++h < r.length; )
        if (r[h][0] === c) {
          d = h;
          break;
        }
      if (d === -1)
        r.push([c, ...u]);
      else if (u.length > 0) {
        let [f, ...p] = u;
        const m = r[d][1];
        gs(m) && gs(f) && (f = go(!0, m, f)), r[d] = [c, f, ...p];
      }
    }
  }
}
const ks = new ul().freeze();
function xo(t, e) {
  if (typeof e != "function")
    throw new TypeError("Cannot `" + t + "` without `parser`");
}
function wo(t, e) {
  if (typeof e != "function")
    throw new TypeError("Cannot `" + t + "` without `compiler`");
}
function Co(t, e) {
  if (e)
    throw new Error(
      "Cannot call `" + t + "` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`."
    );
}
function mc(t) {
  if (!gs(t) || typeof t.type != "string")
    throw new TypeError("Expected node, got `" + t + "`");
}
function gc(t, e, n) {
  if (!n)
    throw new Error(
      "`" + t + "` finished async. Use `" + e + "` instead"
    );
}
function Zr(t) {
  return bb(t) ? t : new mb(t);
}
function bb(t) {
  return !!(t && typeof t == "object" && "message" in t && "messages" in t);
}
function xb(t) {
  return typeof t == "string" || wb(t);
}
function wb(t) {
  return !!(t && typeof t == "object" && "byteLength" in t && "byteOffset" in t);
}
function ue(t) {
  this.content = t;
}
ue.prototype = {
  constructor: ue,
  find: function(t) {
    for (var e = 0; e < this.content.length; e += 2)
      if (this.content[e] === t) return e;
    return -1;
  },
  // :: (string) → ?any
  // Retrieve the value stored under `key`, or return undefined when
  // no such key exists.
  get: function(t) {
    var e = this.find(t);
    return e == -1 ? void 0 : this.content[e + 1];
  },
  // :: (string, any, ?string) → OrderedMap
  // Create a new map by replacing the value of `key` with a new
  // value, or adding a binding to the end of the map. If `newKey` is
  // given, the key of the binding will be replaced with that key.
  update: function(t, e, n) {
    var r = n && n != t ? this.remove(n) : this, i = r.find(t), o = r.content.slice();
    return i == -1 ? o.push(n || t, e) : (o[i + 1] = e, n && (o[i] = n)), new ue(o);
  },
  // :: (string) → OrderedMap
  // Return a map with the given key removed, if it existed.
  remove: function(t) {
    var e = this.find(t);
    if (e == -1) return this;
    var n = this.content.slice();
    return n.splice(e, 2), new ue(n);
  },
  // :: (string, any) → OrderedMap
  // Add a new key to the start of the map.
  addToStart: function(t, e) {
    return new ue([t, e].concat(this.remove(t).content));
  },
  // :: (string, any) → OrderedMap
  // Add a new key to the end of the map.
  addToEnd: function(t, e) {
    var n = this.remove(t).content.slice();
    return n.push(t, e), new ue(n);
  },
  // :: (string, string, any) → OrderedMap
  // Add a key after the given key. If `place` is not found, the new
  // key is added to the end.
  addBefore: function(t, e, n) {
    var r = this.remove(e), i = r.content.slice(), o = r.find(t);
    return i.splice(o == -1 ? i.length : o, 0, e, n), new ue(i);
  },
  // :: ((key: string, value: any))
  // Call the given function for each key/value pair in the map, in
  // order.
  forEach: function(t) {
    for (var e = 0; e < this.content.length; e += 2)
      t(this.content[e], this.content[e + 1]);
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a new map by prepending the keys in this map that don't
  // appear in `map` before the keys in `map`.
  prepend: function(t) {
    return t = ue.from(t), t.size ? new ue(t.content.concat(this.subtract(t).content)) : this;
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a new map by appending the keys in this map that don't
  // appear in `map` after the keys in `map`.
  append: function(t) {
    return t = ue.from(t), t.size ? new ue(this.subtract(t).content.concat(t.content)) : this;
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a map containing all the keys in this map that don't
  // appear in `map`.
  subtract: function(t) {
    var e = this;
    t = ue.from(t);
    for (var n = 0; n < t.content.length; n += 2)
      e = e.remove(t.content[n]);
    return e;
  },
  // :: () → Object
  // Turn ordered map into a plain object.
  toObject: function() {
    var t = {};
    return this.forEach(function(e, n) {
      t[e] = n;
    }), t;
  },
  // :: number
  // The amount of keys in this map.
  get size() {
    return this.content.length >> 1;
  }
};
ue.from = function(t) {
  if (t instanceof ue) return t;
  var e = [];
  if (t) for (var n in t) e.push(n, t[n]);
  return new ue(e);
};
function Vh(t, e, n) {
  for (let r = 0; ; r++) {
    if (r == t.childCount || r == e.childCount)
      return t.childCount == e.childCount ? null : n;
    let i = t.child(r), o = e.child(r);
    if (i == o) {
      n += i.nodeSize;
      continue;
    }
    if (!i.sameMarkup(o))
      return n;
    if (i.isText && i.text != o.text) {
      let s = i.text, l = o.text, a = 0;
      for (; s[a] == l[a]; a++)
        n++;
      return a && a < s.length && a < l.length && qh(s.charCodeAt(a - 1)) && jh(s.charCodeAt(a)) && n--, n;
    }
    if (i.content.size || o.content.size) {
      let s = Vh(i.content, o.content, n + 1);
      if (s != null)
        return s;
    }
    n += i.nodeSize;
  }
}
function Hh(t, e, n, r) {
  for (let i = t.childCount, o = e.childCount; ; ) {
    if (i == 0 || o == 0)
      return i == o ? null : { a: n, b: r };
    let s = t.child(--i), l = e.child(--o), a = s.nodeSize;
    if (s == l) {
      n -= a, r -= a;
      continue;
    }
    if (!s.sameMarkup(l))
      return { a: n, b: r };
    if (s.isText && s.text != l.text) {
      let c = s.text, u = l.text, h = c.length, d = u.length;
      for (; h > 0 && d > 0 && c[h - 1] == u[d - 1]; )
        h--, d--, n--, r--;
      return h && d && h < c.length && qh(c.charCodeAt(h - 1)) && jh(c.charCodeAt(h)) && (n++, r++), { a: n, b: r };
    }
    if (s.content.size || l.content.size) {
      let c = Hh(s.content, l.content, n - 1, r - 1);
      if (c)
        return c;
    }
    n -= a, r -= a;
  }
}
function jh(t) {
  return t >= 56320 && t < 57344;
}
function qh(t) {
  return t >= 55296 && t < 56320;
}
class T {
  /**
  @internal
  */
  constructor(e, n) {
    if (this.content = e, this.size = n || 0, n == null)
      for (let r = 0; r < e.length; r++)
        this.size += e[r].nodeSize;
  }
  /**
  Invoke a callback for all descendant nodes between the given two
  positions (relative to start of this fragment). Doesn't descend
  into a node when the callback returns `false`.
  */
  nodesBetween(e, n, r, i = 0, o) {
    for (let s = 0, l = 0; l < n; s++) {
      let a = this.content[s], c = l + a.nodeSize;
      if (c > e && r(a, i + l, o || null, s) !== !1 && a.content.size) {
        let u = l + 1;
        a.nodesBetween(Math.max(0, e - u), Math.min(a.content.size, n - u), r, i + u);
      }
      l = c;
    }
  }
  /**
  Call the given callback for every descendant node. `pos` will be
  relative to the start of the fragment. The callback may return
  `false` to prevent traversal of a given node's children.
  */
  descendants(e) {
    this.nodesBetween(0, this.size, e);
  }
  /**
  Extract the text between `from` and `to`. See the same method on
  [`Node`](https://prosemirror.net/docs/ref/#model.Node.textBetween).
  */
  textBetween(e, n, r, i) {
    let o = "", s = !0;
    return this.nodesBetween(e, n, (l, a) => {
      let c = l.isText ? l.text.slice(Math.max(e, a) - a, n - a) : l.isLeaf ? i ? typeof i == "function" ? i(l) : i : l.type.spec.leafText ? l.type.spec.leafText(l) : "" : "";
      l.isBlock && (l.isLeaf && c || l.isTextblock) && r && (s ? s = !1 : o += r), o += c;
    }, 0), o;
  }
  /**
  Create a new fragment containing the combined content of this
  fragment and the other.
  */
  append(e) {
    if (!e.size)
      return this;
    if (!this.size)
      return e;
    let n = this.lastChild, r = e.firstChild, i = this.content.slice(), o = 0;
    for (n.isText && n.sameMarkup(r) && (i[i.length - 1] = n.withText(n.text + r.text), o = 1); o < e.content.length; o++)
      i.push(e.content[o]);
    return new T(i, this.size + e.size);
  }
  /**
  Cut out the sub-fragment between the two given positions.
  */
  cut(e, n = this.size) {
    if (e == 0 && n == this.size)
      return this;
    let r = [], i = 0;
    if (n > e)
      for (let o = 0, s = 0; s < n; o++) {
        let l = this.content[o], a = s + l.nodeSize;
        a > e && ((s < e || a > n) && (l.isText ? l = l.cut(Math.max(0, e - s), Math.min(l.text.length, n - s)) : l = l.cut(Math.max(0, e - s - 1), Math.min(l.content.size, n - s - 1))), r.push(l), i += l.nodeSize), s = a;
      }
    return new T(r, i);
  }
  /**
  @internal
  */
  cutByIndex(e, n) {
    return e == n ? T.empty : e == 0 && n == this.content.length ? this : new T(this.content.slice(e, n));
  }
  /**
  Create a new fragment in which the node at the given index is
  replaced by the given node.
  */
  replaceChild(e, n) {
    let r = this.content[e];
    if (r == n)
      return this;
    let i = this.content.slice(), o = this.size + n.nodeSize - r.nodeSize;
    return i[e] = n, new T(i, o);
  }
  /**
  Create a new fragment by prepending the given node to this
  fragment.
  */
  addToStart(e) {
    return new T([e].concat(this.content), this.size + e.nodeSize);
  }
  /**
  Create a new fragment by appending the given node to this
  fragment.
  */
  addToEnd(e) {
    return new T(this.content.concat(e), this.size + e.nodeSize);
  }
  /**
  Compare this fragment to another one.
  */
  eq(e) {
    if (this.content.length != e.content.length)
      return !1;
    for (let n = 0; n < this.content.length; n++)
      if (!this.content[n].eq(e.content[n]))
        return !1;
    return !0;
  }
  /**
  The first child of the fragment, or `null` if it is empty.
  */
  get firstChild() {
    return this.content.length ? this.content[0] : null;
  }
  /**
  The last child of the fragment, or `null` if it is empty.
  */
  get lastChild() {
    return this.content.length ? this.content[this.content.length - 1] : null;
  }
  /**
  The number of child nodes in this fragment.
  */
  get childCount() {
    return this.content.length;
  }
  /**
  Get the child node at the given index. Raise an error when the
  index is out of range.
  */
  child(e) {
    let n = this.content[e];
    if (!n)
      throw new RangeError("Index " + e + " out of range for " + this);
    return n;
  }
  /**
  Get the child node at the given index, if it exists.
  */
  maybeChild(e) {
    return this.content[e] || null;
  }
  /**
  Call `f` for every child node, passing the node, its offset
  into this parent node, and its index.
  */
  forEach(e) {
    for (let n = 0, r = 0; n < this.content.length; n++) {
      let i = this.content[n];
      e(i, r, n), r += i.nodeSize;
    }
  }
  /**
  Find the first position at which this fragment and another
  fragment differ, or `null` if they are the same.
  */
  findDiffStart(e, n = 0) {
    return Vh(this, e, n);
  }
  /**
  Find the first position, searching from the end, at which this
  fragment and the given fragment differ, or `null` if they are
  the same. Since this position will not be the same in both
  nodes, an object with two separate positions is returned.
  */
  findDiffEnd(e, n = this.size, r = e.size) {
    return Hh(this, e, n, r);
  }
  /**
  Find the index and inner offset corresponding to a given relative
  position in this fragment. The result object will be reused
  (overwritten) the next time the function is called. @internal
  */
  findIndex(e) {
    if (e == 0)
      return ei(0, e);
    if (e == this.size)
      return ei(this.content.length, e);
    if (e > this.size || e < 0)
      throw new RangeError(`Position ${e} outside of fragment (${this})`);
    for (let n = 0, r = 0; ; n++) {
      let i = this.child(n), o = r + i.nodeSize;
      if (o >= e)
        return o == e ? ei(n + 1, o) : ei(n, r);
      r = o;
    }
  }
  /**
  Return a debugging string that describes this fragment.
  */
  toString() {
    return "<" + this.toStringInner() + ">";
  }
  /**
  @internal
  */
  toStringInner() {
    return this.content.join(", ");
  }
  /**
  Create a JSON-serializeable representation of this fragment.
  */
  toJSON() {
    return this.content.length ? this.content.map((e) => e.toJSON()) : null;
  }
  /**
  Deserialize a fragment from its JSON representation.
  */
  static fromJSON(e, n) {
    if (!n)
      return T.empty;
    if (!Array.isArray(n))
      throw new RangeError("Invalid input for Fragment.fromJSON");
    return T.fromArray(n.map(e.nodeFromJSON));
  }
  /**
  Build a fragment from an array of nodes. Ensures that adjacent
  text nodes with the same marks are joined together.
  */
  static fromArray(e) {
    if (!e.length)
      return T.empty;
    let n, r = 0;
    for (let i = 0; i < e.length; i++) {
      let o = e[i];
      r += o.nodeSize, i && o.isText && e[i - 1].sameMarkup(o) ? (n || (n = e.slice(0, i)), n[n.length - 1] = o.withText(n[n.length - 1].text + o.text)) : n && n.push(o);
    }
    return new T(n || e, r);
  }
  /**
  Create a fragment from something that can be interpreted as a
  set of nodes. For `null`, it returns the empty fragment. For a
  fragment, the fragment itself. For a node or array of nodes, a
  fragment containing those nodes.
  */
  static from(e) {
    if (!e)
      return T.empty;
    if (e instanceof T)
      return e;
    if (Array.isArray(e))
      return this.fromArray(e);
    if (e.attrs)
      return new T([e], e.nodeSize);
    throw new RangeError("Can not convert " + e + " to a Fragment" + (e.nodesBetween ? " (looks like multiple versions of prosemirror-model were loaded)" : ""));
  }
}
T.empty = new T([], 0);
const So = { index: 0, offset: 0 };
function ei(t, e) {
  return So.index = t, So.offset = e, So;
}
function Ii(t, e) {
  if (t === e)
    return !0;
  if (!(t && typeof t == "object") || !(e && typeof e == "object"))
    return !1;
  let n = Array.isArray(t);
  if (Array.isArray(e) != n)
    return !1;
  if (n) {
    if (t.length != e.length)
      return !1;
    for (let r = 0; r < t.length; r++)
      if (!Ii(t[r], e[r]))
        return !1;
  } else {
    for (let r in t)
      if (!(r in e) || !Ii(t[r], e[r]))
        return !1;
    for (let r in e)
      if (!(r in t))
        return !1;
  }
  return !0;
}
class J {
  /**
  @internal
  */
  constructor(e, n) {
    this.type = e, this.attrs = n;
  }
  /**
  Given a set of marks, create a new set which contains this one as
  well, in the right position. If this mark is already in the set,
  the set itself is returned. If any marks that are set to be
  [exclusive](https://prosemirror.net/docs/ref/#model.MarkSpec.excludes) with this mark are present,
  those are replaced by this one.
  */
  addToSet(e) {
    let n, r = !1;
    for (let i = 0; i < e.length; i++) {
      let o = e[i];
      if (this.eq(o))
        return e;
      if (this.type.excludes(o.type))
        n || (n = e.slice(0, i));
      else {
        if (o.type.excludes(this.type))
          return e;
        !r && o.type.rank > this.type.rank && (n || (n = e.slice(0, i)), n.push(this), r = !0), n && n.push(o);
      }
    }
    return n || (n = e.slice()), r || n.push(this), n;
  }
  /**
  Remove this mark from the given set, returning a new set. If this
  mark is not in the set, the set itself is returned.
  */
  removeFromSet(e) {
    for (let n = 0; n < e.length; n++)
      if (this.eq(e[n]))
        return e.slice(0, n).concat(e.slice(n + 1));
    return e;
  }
  /**
  Test whether this mark is in the given set of marks.
  */
  isInSet(e) {
    for (let n = 0; n < e.length; n++)
      if (this.eq(e[n]))
        return !0;
    return !1;
  }
  /**
  Test whether this mark has the same type and attributes as
  another mark.
  */
  eq(e) {
    return this == e || this.type == e.type && Ii(this.attrs, e.attrs);
  }
  /**
  Convert this mark to a JSON-serializeable representation.
  */
  toJSON() {
    let e = { type: this.type.name };
    for (let n in this.attrs) {
      e.attrs = this.attrs;
      break;
    }
    return e;
  }
  /**
  Deserialize a mark from JSON.
  */
  static fromJSON(e, n) {
    if (!n)
      throw new RangeError("Invalid input for Mark.fromJSON");
    let r = e.marks[n.type];
    if (!r)
      throw new RangeError(`There is no mark type ${n.type} in this schema`);
    return r.create(n.attrs);
  }
  /**
  Test whether two sets of marks are identical.
  */
  static sameSet(e, n) {
    if (e == n)
      return !0;
    if (e.length != n.length)
      return !1;
    for (let r = 0; r < e.length; r++)
      if (!e[r].eq(n[r]))
        return !1;
    return !0;
  }
  /**
  Create a properly sorted mark set from null, a single mark, or an
  unsorted array of marks.
  */
  static setFrom(e) {
    if (!e || Array.isArray(e) && e.length == 0)
      return J.none;
    if (e instanceof J)
      return [e];
    let n = e.slice();
    return n.sort((r, i) => r.type.rank - i.type.rank), n;
  }
}
J.none = [];
class Sr extends Error {
}
class E {
  /**
  Create a slice. When specifying a non-zero open depth, you must
  make sure that there are nodes of at least that depth at the
  appropriate side of the fragment—i.e. if the fragment is an
  empty paragraph node, `openStart` and `openEnd` can't be greater
  than 1.
  
  It is not necessary for the content of open nodes to conform to
  the schema's content constraints, though it should be a valid
  start/end/middle for such a node, depending on which sides are
  open.
  */
  constructor(e, n, r) {
    this.content = e, this.openStart = n, this.openEnd = r;
  }
  /**
  The size this slice would add when inserted into a document.
  */
  get size() {
    return this.content.size - this.openStart - this.openEnd;
  }
  /**
  @internal
  */
  insertAt(e, n) {
    let r = Kh(this.content, e + this.openStart, n, this.openStart + 1, this.openEnd + 1);
    return r && new E(r, this.openStart, this.openEnd);
  }
  /**
  @internal
  */
  removeBetween(e, n) {
    return new E(Wh(this.content, e + this.openStart, n + this.openStart), this.openStart, this.openEnd);
  }
  /**
  Tests whether this slice is equal to another slice.
  */
  eq(e) {
    return this.content.eq(e.content) && this.openStart == e.openStart && this.openEnd == e.openEnd;
  }
  /**
  @internal
  */
  toString() {
    return this.content + "(" + this.openStart + "," + this.openEnd + ")";
  }
  /**
  Convert a slice to a JSON-serializable representation.
  */
  toJSON() {
    if (!this.content.size)
      return null;
    let e = { content: this.content.toJSON() };
    return this.openStart > 0 && (e.openStart = this.openStart), this.openEnd > 0 && (e.openEnd = this.openEnd), e;
  }
  /**
  Deserialize a slice from its JSON representation.
  */
  static fromJSON(e, n) {
    if (!n)
      return E.empty;
    let r = n.openStart || 0, i = n.openEnd || 0;
    if (typeof r != "number" || typeof i != "number")
      throw new RangeError("Invalid input for Slice.fromJSON");
    return new E(T.fromJSON(e, n.content), r, i);
  }
  /**
  Create a slice from a fragment by taking the maximum possible
  open value on both side of the fragment.
  */
  static maxOpen(e, n = !0) {
    let r = 0, i = 0;
    for (let o = e.firstChild; o && !o.isLeaf && (n || !o.type.spec.isolating); o = o.firstChild)
      r++;
    for (let o = e.lastChild; o && !o.isLeaf && (n || !o.type.spec.isolating); o = o.lastChild)
      i++;
    return new E(e, r, i);
  }
}
E.empty = new E(T.empty, 0, 0);
function Wh(t, e, n) {
  let { index: r, offset: i } = t.findIndex(e), o = t.maybeChild(r), { index: s, offset: l } = t.findIndex(n);
  if (i == e || o.isText) {
    if (l != n && !t.child(s).isText)
      throw new RangeError("Removing non-flat range");
    return t.cut(0, e).append(t.cut(n));
  }
  if (r != s)
    throw new RangeError("Removing non-flat range");
  return t.replaceChild(r, o.copy(Wh(o.content, e - i - 1, n - i - 1)));
}
function Kh(t, e, n, r, i, o) {
  let { index: s, offset: l } = t.findIndex(e), a = t.maybeChild(s);
  if (l == e || a.isText)
    return o && r <= 0 && i <= 0 && !o.canReplace(s, s, n) ? null : t.cut(0, e).append(n).append(t.cut(e));
  let c = Kh(a.content, e - l - 1, n, s == 0 ? r - 1 : 0, s == t.childCount - 1 ? i - 1 : 0, a);
  return c && t.replaceChild(s, a.copy(c));
}
function Cb(t, e, n) {
  if (n.openStart > t.depth)
    throw new Sr("Inserted content deeper than insertion position");
  if (t.depth - n.openStart != e.depth - n.openEnd)
    throw new Sr("Inconsistent open depths");
  return Uh(t, e, n, 0);
}
function Uh(t, e, n, r) {
  let i = t.index(r), o = t.node(r);
  if (i == e.index(r) && r < t.depth - n.openStart) {
    let s = Uh(t, e, n, r + 1);
    return o.copy(o.content.replaceChild(i, s));
  } else if (n.content.size)
    if (!n.openStart && !n.openEnd && t.depth == r && e.depth == r) {
      let s = t.parent, l = s.content;
      return an(s, l.cut(0, t.parentOffset).append(n.content).append(l.cut(e.parentOffset)));
    } else {
      let { start: s, end: l } = Sb(n, t);
      return an(o, Gh(t, s, l, e, r));
    }
  else return an(o, Ei(t, e, r));
}
function Jh(t, e) {
  if (!e.type.compatibleContent(t.type))
    throw new Sr("Cannot join " + e.type.name + " onto " + t.type.name);
}
function bs(t, e, n) {
  let r = t.node(n);
  return Jh(r, e.node(n)), r;
}
function ln(t, e) {
  let n = e.length - 1;
  n >= 0 && t.isText && t.sameMarkup(e[n]) ? e[n] = t.withText(e[n].text + t.text) : e.push(t);
}
function hr(t, e, n, r) {
  let i = (e || t).node(n), o = 0, s = e ? e.index(n) : i.childCount;
  t && (o = t.index(n), t.depth > n ? o++ : t.textOffset && (ln(t.nodeAfter, r), o++));
  for (let l = o; l < s; l++)
    ln(i.child(l), r);
  e && e.depth == n && e.textOffset && ln(e.nodeBefore, r);
}
function an(t, e) {
  if (!t.type.validContent(e))
    throw new Sr("Invalid content for node " + t.type.name);
  return t.copy(e);
}
function Gh(t, e, n, r, i) {
  let o = t.depth > i && bs(t, e, i + 1), s = r.depth > i && bs(n, r, i + 1), l = [];
  return hr(null, t, i, l), o && s && e.index(i) == n.index(i) ? (Jh(o, s), ln(an(o, Gh(t, e, n, r, i + 1)), l)) : (o && ln(an(o, Ei(t, e, i + 1)), l), hr(e, n, i, l), s && ln(an(s, Ei(n, r, i + 1)), l)), hr(r, null, i, l), new T(l);
}
function Ei(t, e, n) {
  let r = [];
  if (hr(null, t, n, r), t.depth > n) {
    let i = bs(t, e, n + 1);
    ln(an(i, Ei(t, e, n + 1)), r);
  }
  return hr(e, null, n, r), new T(r);
}
function Sb(t, e) {
  let n = e.depth - t.openStart, i = e.node(n).copy(t.content);
  for (let o = n - 1; o >= 0; o--)
    i = e.node(o).copy(T.from(i));
  return {
    start: i.resolveNoCache(t.openStart + n),
    end: i.resolveNoCache(i.content.size - t.openEnd - n)
  };
}
class Nr {
  /**
  @internal
  */
  constructor(e, n, r) {
    this.pos = e, this.path = n, this.parentOffset = r, this.depth = n.length / 3 - 1;
  }
  /**
  @internal
  */
  resolveDepth(e) {
    return e == null ? this.depth : e < 0 ? this.depth + e : e;
  }
  /**
  The parent node that the position points into. Note that even if
  a position points into a text node, that node is not considered
  the parent—text nodes are ‘flat’ in this model, and have no content.
  */
  get parent() {
    return this.node(this.depth);
  }
  /**
  The root node in which the position was resolved.
  */
  get doc() {
    return this.node(0);
  }
  /**
  The ancestor node at the given level. `p.node(p.depth)` is the
  same as `p.parent`.
  */
  node(e) {
    return this.path[this.resolveDepth(e) * 3];
  }
  /**
  The index into the ancestor at the given level. If this points
  at the 3rd node in the 2nd paragraph on the top level, for
  example, `p.index(0)` is 1 and `p.index(1)` is 2.
  */
  index(e) {
    return this.path[this.resolveDepth(e) * 3 + 1];
  }
  /**
  The index pointing after this position into the ancestor at the
  given level.
  */
  indexAfter(e) {
    return e = this.resolveDepth(e), this.index(e) + (e == this.depth && !this.textOffset ? 0 : 1);
  }
  /**
  The (absolute) position at the start of the node at the given
  level.
  */
  start(e) {
    return e = this.resolveDepth(e), e == 0 ? 0 : this.path[e * 3 - 1] + 1;
  }
  /**
  The (absolute) position at the end of the node at the given
  level.
  */
  end(e) {
    return e = this.resolveDepth(e), this.start(e) + this.node(e).content.size;
  }
  /**
  The (absolute) position directly before the wrapping node at the
  given level, or, when `depth` is `this.depth + 1`, the original
  position.
  */
  before(e) {
    if (e = this.resolveDepth(e), !e)
      throw new RangeError("There is no position before the top-level node");
    return e == this.depth + 1 ? this.pos : this.path[e * 3 - 1];
  }
  /**
  The (absolute) position directly after the wrapping node at the
  given level, or the original position when `depth` is `this.depth + 1`.
  */
  after(e) {
    if (e = this.resolveDepth(e), !e)
      throw new RangeError("There is no position after the top-level node");
    return e == this.depth + 1 ? this.pos : this.path[e * 3 - 1] + this.path[e * 3].nodeSize;
  }
  /**
  When this position points into a text node, this returns the
  distance between the position and the start of the text node.
  Will be zero for positions that point between nodes.
  */
  get textOffset() {
    return this.pos - this.path[this.path.length - 1];
  }
  /**
  Get the node directly after the position, if any. If the position
  points into a text node, only the part of that node after the
  position is returned.
  */
  get nodeAfter() {
    let e = this.parent, n = this.index(this.depth);
    if (n == e.childCount)
      return null;
    let r = this.pos - this.path[this.path.length - 1], i = e.child(n);
    return r ? e.child(n).cut(r) : i;
  }
  /**
  Get the node directly before the position, if any. If the
  position points into a text node, only the part of that node
  before the position is returned.
  */
  get nodeBefore() {
    let e = this.index(this.depth), n = this.pos - this.path[this.path.length - 1];
    return n ? this.parent.child(e).cut(0, n) : e == 0 ? null : this.parent.child(e - 1);
  }
  /**
  Get the position at the given index in the parent node at the
  given depth (which defaults to `this.depth`).
  */
  posAtIndex(e, n) {
    n = this.resolveDepth(n);
    let r = this.path[n * 3], i = n == 0 ? 0 : this.path[n * 3 - 1] + 1;
    for (let o = 0; o < e; o++)
      i += r.child(o).nodeSize;
    return i;
  }
  /**
  Get the marks at this position, factoring in the surrounding
  marks' [`inclusive`](https://prosemirror.net/docs/ref/#model.MarkSpec.inclusive) property. If the
  position is at the start of a non-empty node, the marks of the
  node after it (if any) are returned.
  */
  marks() {
    let e = this.parent, n = this.index();
    if (e.content.size == 0)
      return J.none;
    if (this.textOffset)
      return e.child(n).marks;
    let r = e.maybeChild(n - 1), i = e.maybeChild(n);
    if (!r) {
      let l = r;
      r = i, i = l;
    }
    let o = r.marks;
    for (var s = 0; s < o.length; s++)
      o[s].type.spec.inclusive === !1 && (!i || !o[s].isInSet(i.marks)) && (o = o[s--].removeFromSet(o));
    return o;
  }
  /**
  Get the marks after the current position, if any, except those
  that are non-inclusive and not present at position `$end`. This
  is mostly useful for getting the set of marks to preserve after a
  deletion. Will return `null` if this position is at the end of
  its parent node or its parent node isn't a textblock (in which
  case no marks should be preserved).
  */
  marksAcross(e) {
    let n = this.parent.maybeChild(this.index());
    if (!n || !n.isInline)
      return null;
    let r = n.marks, i = e.parent.maybeChild(e.index());
    for (var o = 0; o < r.length; o++)
      r[o].type.spec.inclusive === !1 && (!i || !r[o].isInSet(i.marks)) && (r = r[o--].removeFromSet(r));
    return r;
  }
  /**
  The depth up to which this position and the given (non-resolved)
  position share the same parent nodes.
  */
  sharedDepth(e) {
    for (let n = this.depth; n > 0; n--)
      if (this.start(n) <= e && this.end(n) >= e)
        return n;
    return 0;
  }
  /**
  Returns a range based on the place where this position and the
  given position diverge around block content. If both point into
  the same textblock, for example, a range around that textblock
  will be returned. If they point into different blocks, the range
  around those blocks in their shared ancestor is returned. You can
  pass in an optional predicate that will be called with a parent
  node to see if a range into that parent is acceptable.
  */
  blockRange(e = this, n) {
    if (e.pos < this.pos)
      return e.blockRange(this);
    for (let r = this.depth - (this.parent.inlineContent || this.pos == e.pos ? 1 : 0); r >= 0; r--)
      if (e.pos <= this.end(r) && (!n || n(this.node(r))))
        return new Yh(this, e, r);
    return null;
  }
  /**
  Query whether the given position shares the same parent node.
  */
  sameParent(e) {
    return this.pos - this.parentOffset == e.pos - e.parentOffset;
  }
  /**
  Return the greater of this and the given position.
  */
  max(e) {
    return e.pos > this.pos ? e : this;
  }
  /**
  Return the smaller of this and the given position.
  */
  min(e) {
    return e.pos < this.pos ? e : this;
  }
  /**
  @internal
  */
  toString() {
    let e = "";
    for (let n = 1; n <= this.depth; n++)
      e += (e ? "/" : "") + this.node(n).type.name + "_" + this.index(n - 1);
    return e + ":" + this.parentOffset;
  }
  /**
  @internal
  */
  static resolve(e, n) {
    if (!(n >= 0 && n <= e.content.size))
      throw new RangeError("Position " + n + " out of range");
    let r = [], i = 0, o = n;
    for (let s = e; ; ) {
      let { index: l, offset: a } = s.content.findIndex(o), c = o - a;
      if (r.push(s, l, i + a), !c || (s = s.child(l), s.isText))
        break;
      o = c - 1, i += a + 1;
    }
    return new Nr(n, r, o);
  }
  /**
  @internal
  */
  static resolveCached(e, n) {
    let r = yc.get(e);
    if (r)
      for (let o = 0; o < r.elts.length; o++) {
        let s = r.elts[o];
        if (s.pos == n)
          return s;
      }
    else
      yc.set(e, r = new Nb());
    let i = r.elts[r.i] = Nr.resolve(e, n);
    return r.i = (r.i + 1) % Mb, i;
  }
}
class Nb {
  constructor() {
    this.elts = [], this.i = 0;
  }
}
const Mb = 12, yc = /* @__PURE__ */ new WeakMap();
class Yh {
  /**
  Construct a node range. `$from` and `$to` should point into the
  same node until at least the given `depth`, since a node range
  denotes an adjacent set of nodes in a single parent node.
  */
  constructor(e, n, r) {
    this.$from = e, this.$to = n, this.depth = r;
  }
  /**
  The position at the start of the range.
  */
  get start() {
    return this.$from.before(this.depth + 1);
  }
  /**
  The position at the end of the range.
  */
  get end() {
    return this.$to.after(this.depth + 1);
  }
  /**
  The parent node that the range points into.
  */
  get parent() {
    return this.$from.node(this.depth);
  }
  /**
  The start index of the range in the parent node.
  */
  get startIndex() {
    return this.$from.index(this.depth);
  }
  /**
  The end index of the range in the parent node.
  */
  get endIndex() {
    return this.$to.indexAfter(this.depth);
  }
}
const Tb = /* @__PURE__ */ Object.create(null);
class He {
  /**
  @internal
  */
  constructor(e, n, r, i = J.none) {
    this.type = e, this.attrs = n, this.marks = i, this.content = r || T.empty;
  }
  /**
  The array of this node's child nodes.
  */
  get children() {
    return this.content.content;
  }
  /**
  The size of this node, as defined by the integer-based [indexing
  scheme](https://prosemirror.net/docs/guide/#doc.indexing). For text nodes, this is the
  amount of characters. For other leaf nodes, it is one. For
  non-leaf nodes, it is the size of the content plus two (the
  start and end token).
  */
  get nodeSize() {
    return this.isLeaf ? 1 : 2 + this.content.size;
  }
  /**
  The number of children that the node has.
  */
  get childCount() {
    return this.content.childCount;
  }
  /**
  Get the child node at the given index. Raises an error when the
  index is out of range.
  */
  child(e) {
    return this.content.child(e);
  }
  /**
  Get the child node at the given index, if it exists.
  */
  maybeChild(e) {
    return this.content.maybeChild(e);
  }
  /**
  Call `f` for every child node, passing the node, its offset
  into this parent node, and its index.
  */
  forEach(e) {
    this.content.forEach(e);
  }
  /**
  Invoke a callback for all descendant nodes recursively overlapping
  the given two positions that are relative to start of this
  node's content. This includes all ancestors of the nodes
  containing the two positions. The callback is invoked with the
  node, its position relative to the original node (method receiver),
  its parent node, and its child index. When the callback returns
  false for a given node, that node's children will not be
  recursed over. The last parameter can be used to specify a
  starting position to count from.
  */
  nodesBetween(e, n, r, i = 0) {
    this.content.nodesBetween(e, n, r, i, this);
  }
  /**
  Call the given callback for every descendant node. Doesn't
  descend into a node when the callback returns `false`.
  */
  descendants(e) {
    this.nodesBetween(0, this.content.size, e);
  }
  /**
  Concatenates all the text nodes found in this fragment and its
  children.
  */
  get textContent() {
    return this.isLeaf && this.type.spec.leafText ? this.type.spec.leafText(this) : this.textBetween(0, this.content.size, "");
  }
  /**
  Get all text between positions `from` and `to`. When
  `blockSeparator` is given, it will be inserted to separate text
  from different block nodes. If `leafText` is given, it'll be
  inserted for every non-text leaf node encountered, otherwise
  [`leafText`](https://prosemirror.net/docs/ref/#model.NodeSpec.leafText) will be used.
  */
  textBetween(e, n, r, i) {
    return this.content.textBetween(e, n, r, i);
  }
  /**
  Returns this node's first child, or `null` if there are no
  children.
  */
  get firstChild() {
    return this.content.firstChild;
  }
  /**
  Returns this node's last child, or `null` if there are no
  children.
  */
  get lastChild() {
    return this.content.lastChild;
  }
  /**
  Test whether two nodes represent the same piece of document.
  */
  eq(e) {
    return this == e || this.sameMarkup(e) && this.content.eq(e.content);
  }
  /**
  Compare the markup (type, attributes, and marks) of this node to
  those of another. Returns `true` if both have the same markup.
  */
  sameMarkup(e) {
    return this.hasMarkup(e.type, e.attrs, e.marks);
  }
  /**
  Check whether this node's markup correspond to the given type,
  attributes, and marks.
  */
  hasMarkup(e, n, r) {
    return this.type == e && Ii(this.attrs, n || e.defaultAttrs || Tb) && J.sameSet(this.marks, r || J.none);
  }
  /**
  Create a new node with the same markup as this node, containing
  the given content (or empty, if no content is given).
  */
  copy(e = null) {
    return e == this.content ? this : new He(this.type, this.attrs, e, this.marks);
  }
  /**
  Create a copy of this node, with the given set of marks instead
  of the node's own marks.
  */
  mark(e) {
    return e == this.marks ? this : new He(this.type, this.attrs, this.content, e);
  }
  /**
  Create a copy of this node with only the content between the
  given positions. If `to` is not given, it defaults to the end of
  the node.
  */
  cut(e, n = this.content.size) {
    return e == 0 && n == this.content.size ? this : this.copy(this.content.cut(e, n));
  }
  /**
  Cut out the part of the document between the given positions, and
  return it as a `Slice` object.
  */
  slice(e, n = this.content.size, r = !1) {
    if (e == n)
      return E.empty;
    let i = this.resolve(e), o = this.resolve(n), s = r ? 0 : i.sharedDepth(n), l = i.start(s), c = i.node(s).content.cut(i.pos - l, o.pos - l);
    return new E(c, i.depth - s, o.depth - s);
  }
  /**
  Replace the part of the document between the given positions with
  the given slice. The slice must 'fit', meaning its open sides
  must be able to connect to the surrounding content, and its
  content nodes must be valid children for the node they are placed
  into. If any of this is violated, an error of type
  [`ReplaceError`](https://prosemirror.net/docs/ref/#model.ReplaceError) is thrown.
  */
  replace(e, n, r) {
    return Cb(this.resolve(e), this.resolve(n), r);
  }
  /**
  Find the node directly after the given position.
  */
  nodeAt(e) {
    for (let n = this; ; ) {
      let { index: r, offset: i } = n.content.findIndex(e);
      if (n = n.maybeChild(r), !n)
        return null;
      if (i == e || n.isText)
        return n;
      e -= i + 1;
    }
  }
  /**
  Find the (direct) child node after the given offset, if any,
  and return it along with its index and offset relative to this
  node.
  */
  childAfter(e) {
    let { index: n, offset: r } = this.content.findIndex(e);
    return { node: this.content.maybeChild(n), index: n, offset: r };
  }
  /**
  Find the (direct) child node before the given offset, if any,
  and return it along with its index and offset relative to this
  node.
  */
  childBefore(e) {
    if (e == 0)
      return { node: null, index: 0, offset: 0 };
    let { index: n, offset: r } = this.content.findIndex(e);
    if (r < e)
      return { node: this.content.child(n), index: n, offset: r };
    let i = this.content.child(n - 1);
    return { node: i, index: n - 1, offset: r - i.nodeSize };
  }
  /**
  Resolve the given position in the document, returning an
  [object](https://prosemirror.net/docs/ref/#model.ResolvedPos) with information about its context.
  */
  resolve(e) {
    return Nr.resolveCached(this, e);
  }
  /**
  @internal
  */
  resolveNoCache(e) {
    return Nr.resolve(this, e);
  }
  /**
  Test whether a given mark or mark type occurs in this document
  between the two given positions.
  */
  rangeHasMark(e, n, r) {
    let i = !1;
    return n > e && this.nodesBetween(e, n, (o) => (r.isInSet(o.marks) && (i = !0), !i)), i;
  }
  /**
  True when this is a block (non-inline node)
  */
  get isBlock() {
    return this.type.isBlock;
  }
  /**
  True when this is a textblock node, a block node with inline
  content.
  */
  get isTextblock() {
    return this.type.isTextblock;
  }
  /**
  True when this node allows inline content.
  */
  get inlineContent() {
    return this.type.inlineContent;
  }
  /**
  True when this is an inline node (a text node or a node that can
  appear among text).
  */
  get isInline() {
    return this.type.isInline;
  }
  /**
  True when this is a text node.
  */
  get isText() {
    return this.type.isText;
  }
  /**
  True when this is a leaf node.
  */
  get isLeaf() {
    return this.type.isLeaf;
  }
  /**
  True when this is an atom, i.e. when it does not have directly
  editable content. This is usually the same as `isLeaf`, but can
  be configured with the [`atom` property](https://prosemirror.net/docs/ref/#model.NodeSpec.atom)
  on a node's spec (typically used when the node is displayed as
  an uneditable [node view](https://prosemirror.net/docs/ref/#view.NodeView)).
  */
  get isAtom() {
    return this.type.isAtom;
  }
  /**
  Return a string representation of this node for debugging
  purposes.
  */
  toString() {
    if (this.type.spec.toDebugString)
      return this.type.spec.toDebugString(this);
    let e = this.type.name;
    return this.content.size && (e += "(" + this.content.toStringInner() + ")"), Qh(this.marks, e);
  }
  /**
  Get the content match in this node at the given index.
  */
  contentMatchAt(e) {
    let n = this.type.contentMatch.matchFragment(this.content, 0, e);
    if (!n)
      throw new Error("Called contentMatchAt on a node with invalid content");
    return n;
  }
  /**
  Test whether replacing the range between `from` and `to` (by
  child index) with the given replacement fragment (which defaults
  to the empty fragment) would leave the node's content valid. You
  can optionally pass `start` and `end` indices into the
  replacement fragment.
  */
  canReplace(e, n, r = T.empty, i = 0, o = r.childCount) {
    let s = this.contentMatchAt(e).matchFragment(r, i, o), l = s && s.matchFragment(this.content, n);
    if (!l || !l.validEnd)
      return !1;
    for (let a = i; a < o; a++)
      if (!this.type.allowsMarks(r.child(a).marks))
        return !1;
    return !0;
  }
  /**
  Test whether replacing the range `from` to `to` (by index) with
  a node of the given type would leave the node's content valid.
  */
  canReplaceWith(e, n, r, i) {
    if (i && !this.type.allowsMarks(i))
      return !1;
    let o = this.contentMatchAt(e).matchType(r), s = o && o.matchFragment(this.content, n);
    return s ? s.validEnd : !1;
  }
  /**
  Test whether the given node's content could be appended to this
  node. If that node is empty, this will only return true if there
  is at least one node type that can appear in both nodes (to avoid
  merging completely incompatible nodes).
  */
  canAppend(e) {
    return e.content.size ? this.canReplace(this.childCount, this.childCount, e.content) : this.type.compatibleContent(e.type);
  }
  /**
  Check whether this node and its descendants conform to the
  schema, and raise an exception when they do not.
  */
  check() {
    this.type.checkContent(this.content), kc(this.type.attrs, this.attrs, "node", this.type.name);
    let e = J.none;
    for (let n = 0; n < this.marks.length; n++) {
      let r = this.marks[n];
      kc(r.type.attrs, r.attrs, "mark", r.type.name), e = r.addToSet(e);
    }
    if (!J.sameSet(e, this.marks))
      throw new RangeError(`Invalid collection of marks for node ${this.type.name}: ${this.marks.map((n) => n.type.name)}`);
    this.content.forEach((n) => n.check());
  }
  /**
  Return a JSON-serializeable representation of this node.
  */
  toJSON() {
    let e = { type: this.type.name };
    for (let n in this.attrs) {
      e.attrs = this.attrs;
      break;
    }
    return this.content.size && (e.content = this.content.toJSON()), this.marks.length && (e.marks = this.marks.map((n) => n.toJSON())), e;
  }
  /**
  Deserialize a node from its JSON representation.
  */
  static fromJSON(e, n) {
    if (!n)
      throw new RangeError("Invalid input for Node.fromJSON");
    let r;
    if (n.marks) {
      if (!Array.isArray(n.marks))
        throw new RangeError("Invalid mark data for Node.fromJSON");
      r = n.marks.map(e.markFromJSON);
    }
    if (n.type == "text") {
      if (typeof n.text != "string")
        throw new RangeError("Invalid text node in JSON");
      return e.text(n.text, r);
    }
    let i = T.fromJSON(e, n.content);
    return e.nodeType(n.type).create(n.attrs, i, r);
  }
}
He.prototype.text = void 0;
class Oi extends He {
  /**
  @internal
  */
  constructor(e, n, r, i) {
    if (super(e, n, null, i), !r)
      throw new RangeError("Empty text nodes are not allowed");
    this.text = r;
  }
  toString() {
    return this.type.spec.toDebugString ? this.type.spec.toDebugString(this) : Qh(this.marks, JSON.stringify(this.text));
  }
  get textContent() {
    return this.text;
  }
  textBetween(e, n) {
    return this.text.slice(e, n);
  }
  get nodeSize() {
    return this.text.length;
  }
  mark(e) {
    return e == this.marks ? this : new Oi(this.type, this.attrs, this.text, e);
  }
  withText(e) {
    return e == this.text ? this : new Oi(this.type, this.attrs, e, this.marks);
  }
  cut(e = 0, n = this.text.length) {
    return e == 0 && n == this.text.length ? this : this.withText(this.text.slice(e, n));
  }
  eq(e) {
    return this.sameMarkup(e) && this.text == e.text;
  }
  toJSON() {
    let e = super.toJSON();
    return e.text = this.text, e;
  }
}
function Qh(t, e) {
  for (let n = t.length - 1; n >= 0; n--)
    e = t[n].type.name + "(" + e + ")";
  return e;
}
function kc(t, e, n, r) {
  for (let i in e)
    if (!(i in t))
      throw new RangeError(`Unsupported attribute ${i} for ${n} of type ${r}`);
  for (let i in t)
    t[i].validate && t[i].validate(e[i]);
}
class mn {
  /**
  @internal
  */
  constructor(e) {
    this.validEnd = e, this.next = [], this.wrapCache = [];
  }
  /**
  @internal
  */
  static parse(e, n) {
    let r = new Ab(e, n);
    if (r.next == null)
      return mn.empty;
    let i = Xh(r);
    r.next && r.err("Unexpected trailing text");
    let o = zb(Rb(i));
    return Pb(o, r), o;
  }
  /**
  Match a node type, returning a match after that node if
  successful.
  */
  matchType(e) {
    for (let n = 0; n < this.next.length; n++)
      if (this.next[n].type == e)
        return this.next[n].next;
    return null;
  }
  /**
  Try to match a fragment. Returns the resulting match when
  successful.
  */
  matchFragment(e, n = 0, r = e.childCount) {
    let i = this;
    for (let o = n; i && o < r; o++)
      i = i.matchType(e.child(o).type);
    return i;
  }
  /**
  @internal
  */
  get inlineContent() {
    return this.next.length != 0 && this.next[0].type.isInline;
  }
  /**
  Get the first matching node type at this match position that can
  be generated.
  */
  get defaultType() {
    for (let e = 0; e < this.next.length; e++) {
      let { type: n } = this.next[e];
      if (!(n.isText || n.hasRequiredAttrs()))
        return n;
    }
    return null;
  }
  /**
  @internal
  */
  compatible(e) {
    for (let n = 0; n < this.next.length; n++)
      for (let r = 0; r < e.next.length; r++)
        if (this.next[n].type == e.next[r].type)
          return !0;
    return !1;
  }
  /**
  Try to match the given fragment, and if that fails, see if it can
  be made to match by inserting nodes in front of it. When
  successful, return a fragment of inserted nodes (which may be
  empty if nothing had to be inserted). When `toEnd` is true, only
  return a fragment if the resulting match goes to the end of the
  content expression.
  */
  fillBefore(e, n = !1, r = 0) {
    let i = [this];
    function o(s, l) {
      let a = s.matchFragment(e, r);
      if (a && (!n || a.validEnd))
        return T.from(l.map((c) => c.createAndFill()));
      for (let c = 0; c < s.next.length; c++) {
        let { type: u, next: h } = s.next[c];
        if (!(u.isText || u.hasRequiredAttrs()) && i.indexOf(h) == -1) {
          i.push(h);
          let d = o(h, l.concat(u));
          if (d)
            return d;
        }
      }
      return null;
    }
    return o(this, []);
  }
  /**
  Find a set of wrapping node types that would allow a node of the
  given type to appear at this position. The result may be empty
  (when it fits directly) and will be null when no such wrapping
  exists.
  */
  findWrapping(e) {
    for (let r = 0; r < this.wrapCache.length; r += 2)
      if (this.wrapCache[r] == e)
        return this.wrapCache[r + 1];
    let n = this.computeWrapping(e);
    return this.wrapCache.push(e, n), n;
  }
  /**
  @internal
  */
  computeWrapping(e) {
    let n = /* @__PURE__ */ Object.create(null), r = [{ match: this, type: null, via: null }];
    for (; r.length; ) {
      let i = r.shift(), o = i.match;
      if (o.matchType(e)) {
        let s = [];
        for (let l = i; l.type; l = l.via)
          s.push(l.type);
        return s.reverse();
      }
      for (let s = 0; s < o.next.length; s++) {
        let { type: l, next: a } = o.next[s];
        !l.isLeaf && !l.hasRequiredAttrs() && !(l.name in n) && (!i.type || a.validEnd) && (r.push({ match: l.contentMatch, type: l, via: i }), n[l.name] = !0);
      }
    }
    return null;
  }
  /**
  The number of outgoing edges this node has in the finite
  automaton that describes the content expression.
  */
  get edgeCount() {
    return this.next.length;
  }
  /**
  Get the _n_​th outgoing edge from this node in the finite
  automaton that describes the content expression.
  */
  edge(e) {
    if (e >= this.next.length)
      throw new RangeError(`There's no ${e}th edge in this content match`);
    return this.next[e];
  }
  /**
  @internal
  */
  toString() {
    let e = [];
    function n(r) {
      e.push(r);
      for (let i = 0; i < r.next.length; i++)
        e.indexOf(r.next[i].next) == -1 && n(r.next[i].next);
    }
    return n(this), e.map((r, i) => {
      let o = i + (r.validEnd ? "*" : " ") + " ";
      for (let s = 0; s < r.next.length; s++)
        o += (s ? ", " : "") + r.next[s].type.name + "->" + e.indexOf(r.next[s].next);
      return o;
    }).join(`
`);
  }
}
mn.empty = new mn(!0);
class Ab {
  constructor(e, n) {
    this.string = e, this.nodeTypes = n, this.inline = null, this.pos = 0, this.tokens = e.split(/\s*(?=\b|\W|$)/), this.tokens[this.tokens.length - 1] == "" && this.tokens.pop(), this.tokens[0] == "" && this.tokens.shift();
  }
  get next() {
    return this.tokens[this.pos];
  }
  eat(e) {
    return this.next == e && (this.pos++ || !0);
  }
  err(e) {
    throw new SyntaxError(e + " (in content expression '" + this.string + "')");
  }
}
function Xh(t) {
  let e = [];
  do
    e.push(Ib(t));
  while (t.eat("|"));
  return e.length == 1 ? e[0] : { type: "choice", exprs: e };
}
function Ib(t) {
  let e = [];
  do
    e.push(Eb(t));
  while (t.next && t.next != ")" && t.next != "|");
  return e.length == 1 ? e[0] : { type: "seq", exprs: e };
}
function Eb(t) {
  let e = Db(t);
  for (; ; )
    if (t.eat("+"))
      e = { type: "plus", expr: e };
    else if (t.eat("*"))
      e = { type: "star", expr: e };
    else if (t.eat("?"))
      e = { type: "opt", expr: e };
    else if (t.eat("{"))
      e = Ob(t, e);
    else
      break;
  return e;
}
function bc(t) {
  /\D/.test(t.next) && t.err("Expected number, got '" + t.next + "'");
  let e = Number(t.next);
  return t.pos++, e;
}
function Ob(t, e) {
  let n = bc(t), r = n;
  return t.eat(",") && (t.next != "}" ? r = bc(t) : r = -1), t.eat("}") || t.err("Unclosed braced range"), { type: "range", min: n, max: r, expr: e };
}
function vb(t, e) {
  let n = t.nodeTypes, r = n[e];
  if (r)
    return [r];
  let i = [];
  for (let o in n) {
    let s = n[o];
    s.isInGroup(e) && i.push(s);
  }
  return i.length == 0 && t.err("No node type or group '" + e + "' found"), i;
}
function Db(t) {
  if (t.eat("(")) {
    let e = Xh(t);
    return t.eat(")") || t.err("Missing closing paren"), e;
  } else if (/\W/.test(t.next))
    t.err("Unexpected token '" + t.next + "'");
  else {
    let e = vb(t, t.next).map((n) => (t.inline == null ? t.inline = n.isInline : t.inline != n.isInline && t.err("Mixing inline and block content"), { type: "name", value: n }));
    return t.pos++, e.length == 1 ? e[0] : { type: "choice", exprs: e };
  }
}
function Rb(t) {
  let e = [[]];
  return i(o(t, 0), n()), e;
  function n() {
    return e.push([]) - 1;
  }
  function r(s, l, a) {
    let c = { term: a, to: l };
    return e[s].push(c), c;
  }
  function i(s, l) {
    s.forEach((a) => a.to = l);
  }
  function o(s, l) {
    if (s.type == "choice")
      return s.exprs.reduce((a, c) => a.concat(o(c, l)), []);
    if (s.type == "seq")
      for (let a = 0; ; a++) {
        let c = o(s.exprs[a], l);
        if (a == s.exprs.length - 1)
          return c;
        i(c, l = n());
      }
    else if (s.type == "star") {
      let a = n();
      return r(l, a), i(o(s.expr, a), a), [r(a)];
    } else if (s.type == "plus") {
      let a = n();
      return i(o(s.expr, l), a), i(o(s.expr, a), a), [r(a)];
    } else {
      if (s.type == "opt")
        return [r(l)].concat(o(s.expr, l));
      if (s.type == "range") {
        let a = l;
        for (let c = 0; c < s.min; c++) {
          let u = n();
          i(o(s.expr, a), u), a = u;
        }
        if (s.max == -1)
          i(o(s.expr, a), a);
        else
          for (let c = s.min; c < s.max; c++) {
            let u = n();
            r(a, u), i(o(s.expr, a), u), a = u;
          }
        return [r(a)];
      } else {
        if (s.type == "name")
          return [r(l, void 0, s.value)];
        throw new Error("Unknown expr type");
      }
    }
  }
}
function Zh(t, e) {
  return e - t;
}
function xc(t, e) {
  let n = [];
  return r(e), n.sort(Zh);
  function r(i) {
    let o = t[i];
    if (o.length == 1 && !o[0].term)
      return r(o[0].to);
    n.push(i);
    for (let s = 0; s < o.length; s++) {
      let { term: l, to: a } = o[s];
      !l && n.indexOf(a) == -1 && r(a);
    }
  }
}
function zb(t) {
  let e = /* @__PURE__ */ Object.create(null);
  return n(xc(t, 0));
  function n(r) {
    let i = [];
    r.forEach((s) => {
      t[s].forEach(({ term: l, to: a }) => {
        if (!l)
          return;
        let c;
        for (let u = 0; u < i.length; u++)
          i[u][0] == l && (c = i[u][1]);
        xc(t, a).forEach((u) => {
          c || i.push([l, c = []]), c.indexOf(u) == -1 && c.push(u);
        });
      });
    });
    let o = e[r.join(",")] = new mn(r.indexOf(t.length - 1) > -1);
    for (let s = 0; s < i.length; s++) {
      let l = i[s][1].sort(Zh);
      o.next.push({ type: i[s][0], next: e[l.join(",")] || n(l) });
    }
    return o;
  }
}
function Pb(t, e) {
  for (let n = 0, r = [t]; n < r.length; n++) {
    let i = r[n], o = !i.validEnd, s = [];
    for (let l = 0; l < i.next.length; l++) {
      let { type: a, next: c } = i.next[l];
      s.push(a.name), o && !(a.isText || a.hasRequiredAttrs()) && (o = !1), r.indexOf(c) == -1 && r.push(c);
    }
    o && e.err("Only non-generatable nodes (" + s.join(", ") + ") in a required position (see https://prosemirror.net/docs/guide/#generatable)");
  }
}
function ef(t) {
  let e = /* @__PURE__ */ Object.create(null);
  for (let n in t) {
    let r = t[n];
    if (!r.hasDefault)
      return null;
    e[n] = r.default;
  }
  return e;
}
function tf(t, e) {
  let n = /* @__PURE__ */ Object.create(null);
  for (let r in t) {
    let i = t[r], o = e && e[r];
    if (o === void 0)
      if (i.hasDefault)
        o = i.default;
      else
        throw new RangeError("No value supplied for attribute " + r);
    else i.validate && i.validate(o);
    n[r] = o;
  }
  return n;
}
function nf(t, e) {
  let n = /* @__PURE__ */ Object.create(null);
  if (e)
    for (let r in e)
      n[r] = new Bb(t, r, e[r]);
  return n;
}
let wc = class rf {
  /**
  @internal
  */
  constructor(e, n, r) {
    this.name = e, this.schema = n, this.spec = r, this.markSet = null, this.groups = r.group ? r.group.split(" ") : [], this.attrs = nf(e, r.attrs), this.defaultAttrs = ef(this.attrs), this.contentMatch = null, this.inlineContent = null, this.isBlock = !(r.inline || e == "text"), this.isText = e == "text";
  }
  /**
  True if this is an inline type.
  */
  get isInline() {
    return !this.isBlock;
  }
  /**
  True if this is a textblock type, a block that contains inline
  content.
  */
  get isTextblock() {
    return this.isBlock && this.inlineContent;
  }
  /**
  True for node types that allow no content.
  */
  get isLeaf() {
    return this.contentMatch == mn.empty;
  }
  /**
  True when this node is an atom, i.e. when it does not have
  directly editable content.
  */
  get isAtom() {
    return this.isLeaf || !!this.spec.atom;
  }
  /**
  Return true when this node type is part of the given
  [group](https://prosemirror.net/docs/ref/#model.NodeSpec.group).
  */
  isInGroup(e) {
    return this.groups.indexOf(e) > -1;
  }
  /**
  The node type's [whitespace](https://prosemirror.net/docs/ref/#model.NodeSpec.whitespace) option.
  */
  get whitespace() {
    return this.spec.whitespace || (this.spec.code ? "pre" : "normal");
  }
  /**
  Tells you whether this node type has any required attributes.
  */
  hasRequiredAttrs() {
    for (let e in this.attrs)
      if (this.attrs[e].isRequired)
        return !0;
    return !1;
  }
  /**
  Indicates whether this node allows some of the same content as
  the given node type.
  */
  compatibleContent(e) {
    return this == e || this.contentMatch.compatible(e.contentMatch);
  }
  /**
  @internal
  */
  computeAttrs(e) {
    return !e && this.defaultAttrs ? this.defaultAttrs : tf(this.attrs, e);
  }
  /**
  Create a `Node` of this type. The given attributes are
  checked and defaulted (you can pass `null` to use the type's
  defaults entirely, if no required attributes exist). `content`
  may be a `Fragment`, a node, an array of nodes, or
  `null`. Similarly `marks` may be `null` to default to the empty
  set of marks.
  */
  create(e = null, n, r) {
    if (this.isText)
      throw new Error("NodeType.create can't construct text nodes");
    return new He(this, this.computeAttrs(e), T.from(n), J.setFrom(r));
  }
  /**
  Like [`create`](https://prosemirror.net/docs/ref/#model.NodeType.create), but check the given content
  against the node type's content restrictions, and throw an error
  if it doesn't match.
  */
  createChecked(e = null, n, r) {
    return n = T.from(n), this.checkContent(n), new He(this, this.computeAttrs(e), n, J.setFrom(r));
  }
  /**
  Like [`create`](https://prosemirror.net/docs/ref/#model.NodeType.create), but see if it is
  necessary to add nodes to the start or end of the given fragment
  to make it fit the node. If no fitting wrapping can be found,
  return null. Note that, due to the fact that required nodes can
  always be created, this will always succeed if you pass null or
  `Fragment.empty` as content.
  */
  createAndFill(e = null, n, r) {
    if (e = this.computeAttrs(e), n = T.from(n), n.size) {
      let s = this.contentMatch.fillBefore(n);
      if (!s)
        return null;
      n = s.append(n);
    }
    let i = this.contentMatch.matchFragment(n), o = i && i.fillBefore(T.empty, !0);
    return o ? new He(this, e, n.append(o), J.setFrom(r)) : null;
  }
  /**
  Returns true if the given fragment is valid content for this node
  type.
  */
  validContent(e) {
    let n = this.contentMatch.matchFragment(e);
    if (!n || !n.validEnd)
      return !1;
    for (let r = 0; r < e.childCount; r++)
      if (!this.allowsMarks(e.child(r).marks))
        return !1;
    return !0;
  }
  /**
  Throws a RangeError if the given fragment is not valid content for this
  node type.
  @internal
  */
  checkContent(e) {
    if (!this.validContent(e))
      throw new RangeError(`Invalid content for node ${this.name}: ${e.toString().slice(0, 50)}`);
  }
  /**
  @internal no longer useful, but called by old prosemirror-view versions
  */
  checkAttrs(e) {
  }
  /**
  Check whether the given mark type is allowed in this node.
  */
  allowsMarkType(e) {
    return this.markSet == null || this.markSet.indexOf(e) > -1;
  }
  /**
  Test whether the given set of marks are allowed in this node.
  */
  allowsMarks(e) {
    if (this.markSet == null)
      return !0;
    for (let n = 0; n < e.length; n++)
      if (!this.allowsMarkType(e[n].type))
        return !1;
    return !0;
  }
  /**
  Removes the marks that are not allowed in this node from the given set.
  */
  allowedMarks(e) {
    if (this.markSet == null)
      return e;
    let n;
    for (let r = 0; r < e.length; r++)
      this.allowsMarkType(e[r].type) ? n && n.push(e[r]) : n || (n = e.slice(0, r));
    return n ? n.length ? n : J.none : e;
  }
  /**
  @internal
  */
  static compile(e, n) {
    let r = /* @__PURE__ */ Object.create(null);
    e.forEach((o, s) => r[o] = new rf(o, n, s));
    let i = n.spec.topNode || "doc";
    if (!r[i])
      throw new RangeError("Schema is missing its top node type ('" + i + "')");
    if (!r.text)
      throw new RangeError("Every schema needs a 'text' type");
    for (let o in r.text.attrs)
      throw new RangeError("The text node type should not have attributes");
    return r;
  }
};
function Lb(t, e, n) {
  let r = n.split("|");
  return (i) => {
    let o = i === null ? "null" : typeof i;
    if (r.indexOf(o) < 0)
      throw new RangeError(`Expected value of type ${r} for attribute ${e} on type ${t}, got ${o}`);
  };
}
class Bb {
  constructor(e, n, r) {
    this.hasDefault = Object.prototype.hasOwnProperty.call(r, "default"), this.default = r.default, this.validate = typeof r.validate == "string" ? Lb(e, n, r.validate) : r.validate;
  }
  get isRequired() {
    return !this.hasDefault;
  }
}
class Gi {
  /**
  @internal
  */
  constructor(e, n, r, i) {
    this.name = e, this.rank = n, this.schema = r, this.spec = i, this.attrs = nf(e, i.attrs), this.excluded = null;
    let o = ef(this.attrs);
    this.instance = o ? new J(this, o) : null;
  }
  /**
  Create a mark of this type. `attrs` may be `null` or an object
  containing only some of the mark's attributes. The others, if
  they have defaults, will be added.
  */
  create(e = null) {
    return !e && this.instance ? this.instance : new J(this, tf(this.attrs, e));
  }
  /**
  @internal
  */
  static compile(e, n) {
    let r = /* @__PURE__ */ Object.create(null), i = 0;
    return e.forEach((o, s) => r[o] = new Gi(o, i++, n, s)), r;
  }
  /**
  When there is a mark of this type in the given set, a new set
  without it is returned. Otherwise, the input set is returned.
  */
  removeFromSet(e) {
    for (var n = 0; n < e.length; n++)
      e[n].type == this && (e = e.slice(0, n).concat(e.slice(n + 1)), n--);
    return e;
  }
  /**
  Tests whether there is a mark of this type in the given set.
  */
  isInSet(e) {
    for (let n = 0; n < e.length; n++)
      if (e[n].type == this)
        return e[n];
  }
  /**
  Queries whether a given mark type is
  [excluded](https://prosemirror.net/docs/ref/#model.MarkSpec.excludes) by this one.
  */
  excludes(e) {
    return this.excluded.indexOf(e) > -1;
  }
}
class Fb {
  /**
  Construct a schema from a schema [specification](https://prosemirror.net/docs/ref/#model.SchemaSpec).
  */
  constructor(e) {
    this.linebreakReplacement = null, this.cached = /* @__PURE__ */ Object.create(null);
    let n = this.spec = {};
    for (let i in e)
      n[i] = e[i];
    n.nodes = ue.from(e.nodes), n.marks = ue.from(e.marks || {}), this.nodes = wc.compile(this.spec.nodes, this), this.marks = Gi.compile(this.spec.marks, this);
    let r = /* @__PURE__ */ Object.create(null);
    for (let i in this.nodes) {
      if (i in this.marks)
        throw new RangeError(i + " can not be both a node and a mark");
      let o = this.nodes[i], s = o.spec.content || "", l = o.spec.marks;
      if (o.contentMatch = r[s] || (r[s] = mn.parse(s, this.nodes)), o.inlineContent = o.contentMatch.inlineContent, o.spec.linebreakReplacement) {
        if (this.linebreakReplacement)
          throw new RangeError("Multiple linebreak nodes defined");
        if (!o.isInline || !o.isLeaf)
          throw new RangeError("Linebreak replacement nodes must be inline leaf nodes");
        this.linebreakReplacement = o;
      }
      o.markSet = l == "_" ? null : l ? Cc(this, l.split(" ")) : l == "" || !o.inlineContent ? [] : null;
    }
    for (let i in this.marks) {
      let o = this.marks[i], s = o.spec.excludes;
      o.excluded = s == null ? [o] : s == "" ? [] : Cc(this, s.split(" "));
    }
    this.nodeFromJSON = (i) => He.fromJSON(this, i), this.markFromJSON = (i) => J.fromJSON(this, i), this.topNodeType = this.nodes[this.spec.topNode || "doc"], this.cached.wrappings = /* @__PURE__ */ Object.create(null);
  }
  /**
  Create a node in this schema. The `type` may be a string or a
  `NodeType` instance. Attributes will be extended with defaults,
  `content` may be a `Fragment`, `null`, a `Node`, or an array of
  nodes.
  */
  node(e, n = null, r, i) {
    if (typeof e == "string")
      e = this.nodeType(e);
    else if (e instanceof wc) {
      if (e.schema != this)
        throw new RangeError("Node type from different schema used (" + e.name + ")");
    } else throw new RangeError("Invalid node type: " + e);
    return e.createChecked(n, r, i);
  }
  /**
  Create a text node in the schema. Empty text nodes are not
  allowed.
  */
  text(e, n) {
    let r = this.nodes.text;
    return new Oi(r, r.defaultAttrs, e, J.setFrom(n));
  }
  /**
  Create a mark with the given type and attributes.
  */
  mark(e, n) {
    return typeof e == "string" && (e = this.marks[e]), e.create(n);
  }
  /**
  @internal
  */
  nodeType(e) {
    let n = this.nodes[e];
    if (!n)
      throw new RangeError("Unknown node type: " + e);
    return n;
  }
}
function Cc(t, e) {
  let n = [];
  for (let r = 0; r < e.length; r++) {
    let i = e[r], o = t.marks[i], s = o;
    if (o)
      n.push(o);
    else
      for (let l in t.marks) {
        let a = t.marks[l];
        (i == "_" || a.spec.group && a.spec.group.split(" ").indexOf(i) > -1) && n.push(s = a);
      }
    if (!s)
      throw new SyntaxError("Unknown mark type: '" + e[r] + "'");
  }
  return n;
}
function _b(t) {
  return t.tag != null;
}
function $b(t) {
  return t.style != null;
}
class Rn {
  /**
  Create a parser that targets the given schema, using the given
  parsing rules.
  */
  constructor(e, n) {
    this.schema = e, this.rules = n, this.tags = [], this.styles = [];
    let r = this.matchedStyles = [];
    n.forEach((i) => {
      if (_b(i))
        this.tags.push(i);
      else if ($b(i)) {
        let o = /[^=]*/.exec(i.style)[0];
        r.indexOf(o) < 0 && r.push(o), this.styles.push(i);
      }
    }), this.normalizeLists = !this.tags.some((i) => {
      if (!/^(ul|ol)\b/.test(i.tag) || !i.node)
        return !1;
      let o = e.nodes[i.node];
      return o.contentMatch.matchType(o);
    });
  }
  /**
  Parse a document from the content of a DOM node.
  */
  parse(e, n = {}) {
    let r = new Nc(this, n, !1);
    return r.addAll(e, J.none, n.from, n.to), r.finish();
  }
  /**
  Parses the content of the given DOM node, like
  [`parse`](https://prosemirror.net/docs/ref/#model.DOMParser.parse), and takes the same set of
  options. But unlike that method, which produces a whole node,
  this one returns a slice that is open at the sides, meaning that
  the schema constraints aren't applied to the start of nodes to
  the left of the input and the end of nodes at the end.
  */
  parseSlice(e, n = {}) {
    let r = new Nc(this, n, !0);
    return r.addAll(e, J.none, n.from, n.to), E.maxOpen(r.finish());
  }
  /**
  @internal
  */
  matchTag(e, n, r) {
    for (let i = r ? this.tags.indexOf(r) + 1 : 0; i < this.tags.length; i++) {
      let o = this.tags[i];
      if (jb(e, o.tag) && (o.namespace === void 0 || e.namespaceURI == o.namespace) && (!o.context || n.matchesContext(o.context))) {
        if (o.getAttrs) {
          let s = o.getAttrs(e);
          if (s === !1)
            continue;
          o.attrs = s || void 0;
        }
        return o;
      }
    }
  }
  /**
  @internal
  */
  matchStyle(e, n, r, i) {
    for (let o = i ? this.styles.indexOf(i) + 1 : 0; o < this.styles.length; o++) {
      let s = this.styles[o], l = s.style;
      if (!(l.indexOf(e) != 0 || s.context && !r.matchesContext(s.context) || // Test that the style string either precisely matches the prop,
      // or has an '=' sign after the prop, followed by the given
      // value.
      l.length > e.length && (l.charCodeAt(e.length) != 61 || l.slice(e.length + 1) != n))) {
        if (s.getAttrs) {
          let a = s.getAttrs(n);
          if (a === !1)
            continue;
          s.attrs = a || void 0;
        }
        return s;
      }
    }
  }
  /**
  @internal
  */
  static schemaRules(e) {
    let n = [];
    function r(i) {
      let o = i.priority == null ? 50 : i.priority, s = 0;
      for (; s < n.length; s++) {
        let l = n[s];
        if ((l.priority == null ? 50 : l.priority) < o)
          break;
      }
      n.splice(s, 0, i);
    }
    for (let i in e.marks) {
      let o = e.marks[i].spec.parseDOM;
      o && o.forEach((s) => {
        r(s = Mc(s)), s.mark || s.ignore || s.clearMark || (s.mark = i);
      });
    }
    for (let i in e.nodes) {
      let o = e.nodes[i].spec.parseDOM;
      o && o.forEach((s) => {
        r(s = Mc(s)), s.node || s.ignore || s.mark || (s.node = i);
      });
    }
    return n;
  }
  /**
  Construct a DOM parser using the parsing rules listed in a
  schema's [node specs](https://prosemirror.net/docs/ref/#model.NodeSpec.parseDOM), reordered by
  [priority](https://prosemirror.net/docs/ref/#model.GenericParseRule.priority).
  */
  static fromSchema(e) {
    return e.cached.domParser || (e.cached.domParser = new Rn(e, Rn.schemaRules(e)));
  }
}
const of = {
  address: !0,
  article: !0,
  aside: !0,
  blockquote: !0,
  body: !0,
  canvas: !0,
  dd: !0,
  div: !0,
  dl: !0,
  fieldset: !0,
  figcaption: !0,
  figure: !0,
  footer: !0,
  form: !0,
  h1: !0,
  h2: !0,
  h3: !0,
  h4: !0,
  h5: !0,
  h6: !0,
  header: !0,
  hgroup: !0,
  hr: !0,
  li: !0,
  noscript: !0,
  ol: !0,
  output: !0,
  p: !0,
  pre: !0,
  section: !0,
  table: !0,
  tfoot: !0,
  ul: !0
}, Vb = {
  head: !0,
  noscript: !0,
  object: !0,
  script: !0,
  style: !0,
  title: !0
}, sf = { ol: !0, ul: !0 }, Mr = 1, xs = 2, fr = 4;
function Sc(t, e, n) {
  return e != null ? (e ? Mr : 0) | (e === "full" ? xs : 0) : t && t.whitespace == "pre" ? Mr | xs : n & ~fr;
}
class ti {
  constructor(e, n, r, i, o, s) {
    this.type = e, this.attrs = n, this.marks = r, this.solid = i, this.options = s, this.content = [], this.activeMarks = J.none, this.match = o || (s & fr ? null : e.contentMatch);
  }
  findWrapping(e) {
    if (!this.match) {
      if (!this.type)
        return [];
      let n = this.type.contentMatch.fillBefore(T.from(e));
      if (n)
        this.match = this.type.contentMatch.matchFragment(n);
      else {
        let r = this.type.contentMatch, i;
        return (i = r.findWrapping(e.type)) ? (this.match = r, i) : null;
      }
    }
    return this.match.findWrapping(e.type);
  }
  finish(e) {
    if (!(this.options & Mr)) {
      let r = this.content[this.content.length - 1], i;
      if (r && r.isText && (i = /[ \t\r\n\u000c]+$/.exec(r.text))) {
        let o = r;
        r.text.length == i[0].length ? this.content.pop() : this.content[this.content.length - 1] = o.withText(o.text.slice(0, o.text.length - i[0].length));
      }
    }
    let n = T.from(this.content);
    return !e && this.match && (n = n.append(this.match.fillBefore(T.empty, !0))), this.type ? this.type.create(this.attrs, n, this.marks) : n;
  }
  inlineContext(e) {
    return this.type ? this.type.inlineContent : this.content.length ? this.content[0].isInline : e.parentNode && !of.hasOwnProperty(e.parentNode.nodeName.toLowerCase());
  }
}
class Nc {
  constructor(e, n, r) {
    this.parser = e, this.options = n, this.isOpen = r, this.open = 0, this.localPreserveWS = !1;
    let i = n.topNode, o, s = Sc(null, n.preserveWhitespace, 0) | (r ? fr : 0);
    i ? o = new ti(i.type, i.attrs, J.none, !0, n.topMatch || i.type.contentMatch, s) : r ? o = new ti(null, null, J.none, !0, null, s) : o = new ti(e.schema.topNodeType, null, J.none, !0, null, s), this.nodes = [o], this.find = n.findPositions, this.needsBlock = !1;
  }
  get top() {
    return this.nodes[this.open];
  }
  // Add a DOM node to the content. Text is inserted as text node,
  // otherwise, the node is passed to `addElement` or, if it has a
  // `style` attribute, `addElementWithStyles`.
  addDOM(e, n) {
    e.nodeType == 3 ? this.addTextNode(e, n) : e.nodeType == 1 && this.addElement(e, n);
  }
  addTextNode(e, n) {
    let r = e.nodeValue, i = this.top, o = i.options & xs ? "full" : this.localPreserveWS || (i.options & Mr) > 0, { schema: s } = this.parser;
    if (o === "full" || i.inlineContext(e) || /[^ \t\r\n\u000c]/.test(r)) {
      if (o)
        if (o === "full")
          r = r.replace(/\r\n?/g, `
`);
        else if (s.linebreakReplacement && /[\r\n]/.test(r) && this.top.findWrapping(s.linebreakReplacement.create())) {
          let l = r.split(/\r?\n|\r/);
          for (let a = 0; a < l.length; a++)
            a && this.insertNode(s.linebreakReplacement.create(), n, !0), l[a] && this.insertNode(s.text(l[a]), n, !/\S/.test(l[a]));
          r = "";
        } else
          r = r.replace(/\r?\n|\r/g, " ");
      else if (r = r.replace(/[ \t\r\n\u000c]+/g, " "), /^[ \t\r\n\u000c]/.test(r) && this.open == this.nodes.length - 1) {
        let l = i.content[i.content.length - 1], a = e.previousSibling;
        (!l || a && a.nodeName == "BR" || l.isText && /[ \t\r\n\u000c]$/.test(l.text)) && (r = r.slice(1));
      }
      r && this.insertNode(s.text(r), n, !/\S/.test(r)), this.findInText(e);
    } else
      this.findInside(e);
  }
  // Try to find a handler for the given tag and use that to parse. If
  // none is found, the element's content nodes are added directly.
  addElement(e, n, r) {
    let i = this.localPreserveWS, o = this.top;
    (e.tagName == "PRE" || /pre/.test(e.style && e.style.whiteSpace)) && (this.localPreserveWS = !0);
    let s = e.nodeName.toLowerCase(), l;
    sf.hasOwnProperty(s) && this.parser.normalizeLists && Hb(e);
    let a = this.options.ruleFromNode && this.options.ruleFromNode(e) || (l = this.parser.matchTag(e, this, r));
    e: if (a ? a.ignore : Vb.hasOwnProperty(s))
      this.findInside(e), this.ignoreFallback(e, n);
    else if (!a || a.skip || a.closeParent) {
      a && a.closeParent ? this.open = Math.max(0, this.open - 1) : a && a.skip.nodeType && (e = a.skip);
      let c, u = this.needsBlock;
      if (of.hasOwnProperty(s))
        o.content.length && o.content[0].isInline && this.open && (this.open--, o = this.top), c = !0, o.type || (this.needsBlock = !0);
      else if (!e.firstChild) {
        this.leafFallback(e, n);
        break e;
      }
      let h = a && a.skip ? n : this.readStyles(e, n);
      h && this.addAll(e, h), c && this.sync(o), this.needsBlock = u;
    } else {
      let c = this.readStyles(e, n);
      c && this.addElementByRule(e, a, c, a.consuming === !1 ? l : void 0);
    }
    this.localPreserveWS = i;
  }
  // Called for leaf DOM nodes that would otherwise be ignored
  leafFallback(e, n) {
    e.nodeName == "BR" && this.top.type && this.top.type.inlineContent && this.addTextNode(e.ownerDocument.createTextNode(`
`), n);
  }
  // Called for ignored nodes
  ignoreFallback(e, n) {
    e.nodeName == "BR" && (!this.top.type || !this.top.type.inlineContent) && this.findPlace(this.parser.schema.text("-"), n, !0);
  }
  // Run any style parser associated with the node's styles. Either
  // return an updated array of marks, or null to indicate some of the
  // styles had a rule with `ignore` set.
  readStyles(e, n) {
    let r = e.style;
    if (r && r.length)
      for (let i = 0; i < this.parser.matchedStyles.length; i++) {
        let o = this.parser.matchedStyles[i], s = r.getPropertyValue(o);
        if (s)
          for (let l = void 0; ; ) {
            let a = this.parser.matchStyle(o, s, this, l);
            if (!a)
              break;
            if (a.ignore)
              return null;
            if (a.clearMark ? n = n.filter((c) => !a.clearMark(c)) : n = n.concat(this.parser.schema.marks[a.mark].create(a.attrs)), a.consuming === !1)
              l = a;
            else
              break;
          }
      }
    return n;
  }
  // Look up a handler for the given node. If none are found, return
  // false. Otherwise, apply it, use its return value to drive the way
  // the node's content is wrapped, and return true.
  addElementByRule(e, n, r, i) {
    let o, s;
    if (n.node)
      if (s = this.parser.schema.nodes[n.node], s.isLeaf)
        this.insertNode(s.create(n.attrs), r, e.nodeName == "BR") || this.leafFallback(e, r);
      else {
        let a = this.enter(s, n.attrs || null, r, n.preserveWhitespace);
        a && (o = !0, r = a);
      }
    else {
      let a = this.parser.schema.marks[n.mark];
      r = r.concat(a.create(n.attrs));
    }
    let l = this.top;
    if (s && s.isLeaf)
      this.findInside(e);
    else if (i)
      this.addElement(e, r, i);
    else if (n.getContent)
      this.findInside(e), n.getContent(e, this.parser.schema).forEach((a) => this.insertNode(a, r, !1));
    else {
      let a = e;
      typeof n.contentElement == "string" ? a = e.querySelector(n.contentElement) : typeof n.contentElement == "function" ? a = n.contentElement(e) : n.contentElement && (a = n.contentElement), this.findAround(e, a, !0), this.addAll(a, r), this.findAround(e, a, !1);
    }
    o && this.sync(l) && this.open--;
  }
  // Add all child nodes between `startIndex` and `endIndex` (or the
  // whole node, if not given). If `sync` is passed, use it to
  // synchronize after every block element.
  addAll(e, n, r, i) {
    let o = r || 0;
    for (let s = r ? e.childNodes[r] : e.firstChild, l = i == null ? null : e.childNodes[i]; s != l; s = s.nextSibling, ++o)
      this.findAtPoint(e, o), this.addDOM(s, n);
    this.findAtPoint(e, o);
  }
  // Try to find a way to fit the given node type into the current
  // context. May add intermediate wrappers and/or leave non-solid
  // nodes that we're in.
  findPlace(e, n, r) {
    let i, o;
    for (let s = this.open, l = 0; s >= 0; s--) {
      let a = this.nodes[s], c = a.findWrapping(e);
      if (c && (!i || i.length > c.length + l) && (i = c, o = a, !c.length))
        break;
      if (a.solid) {
        if (r)
          break;
        l += 2;
      }
    }
    if (!i)
      return null;
    this.sync(o);
    for (let s = 0; s < i.length; s++)
      n = this.enterInner(i[s], null, n, !1);
    return n;
  }
  // Try to insert the given node, adjusting the context when needed.
  insertNode(e, n, r) {
    if (e.isInline && this.needsBlock && !this.top.type) {
      let o = this.textblockFromContext();
      o && (n = this.enterInner(o, null, n));
    }
    let i = this.findPlace(e, n, r);
    if (i) {
      this.closeExtra();
      let o = this.top;
      o.match && (o.match = o.match.matchType(e.type));
      let s = J.none;
      for (let l of i.concat(e.marks))
        (o.type ? o.type.allowsMarkType(l.type) : Tc(l.type, e.type)) && (s = l.addToSet(s));
      return o.content.push(e.mark(s)), !0;
    }
    return !1;
  }
  // Try to start a node of the given type, adjusting the context when
  // necessary.
  enter(e, n, r, i) {
    let o = this.findPlace(e.create(n), r, !1);
    return o && (o = this.enterInner(e, n, r, !0, i)), o;
  }
  // Open a node of the given type
  enterInner(e, n, r, i = !1, o) {
    this.closeExtra();
    let s = this.top;
    s.match = s.match && s.match.matchType(e);
    let l = Sc(e, o, s.options);
    s.options & fr && s.content.length == 0 && (l |= fr);
    let a = J.none;
    return r = r.filter((c) => (s.type ? s.type.allowsMarkType(c.type) : Tc(c.type, e)) ? (a = c.addToSet(a), !1) : !0), this.nodes.push(new ti(e, n, a, i, null, l)), this.open++, r;
  }
  // Make sure all nodes above this.open are finished and added to
  // their parents
  closeExtra(e = !1) {
    let n = this.nodes.length - 1;
    if (n > this.open) {
      for (; n > this.open; n--)
        this.nodes[n - 1].content.push(this.nodes[n].finish(e));
      this.nodes.length = this.open + 1;
    }
  }
  finish() {
    return this.open = 0, this.closeExtra(this.isOpen), this.nodes[0].finish(!!(this.isOpen || this.options.topOpen));
  }
  sync(e) {
    for (let n = this.open; n >= 0; n--) {
      if (this.nodes[n] == e)
        return this.open = n, !0;
      this.localPreserveWS && (this.nodes[n].options |= Mr);
    }
    return !1;
  }
  get currentPos() {
    this.closeExtra();
    let e = 0;
    for (let n = this.open; n >= 0; n--) {
      let r = this.nodes[n].content;
      for (let i = r.length - 1; i >= 0; i--)
        e += r[i].nodeSize;
      n && e++;
    }
    return e;
  }
  findAtPoint(e, n) {
    if (this.find)
      for (let r = 0; r < this.find.length; r++)
        this.find[r].node == e && this.find[r].offset == n && (this.find[r].pos = this.currentPos);
  }
  findInside(e) {
    if (this.find)
      for (let n = 0; n < this.find.length; n++)
        this.find[n].pos == null && e.nodeType == 1 && e.contains(this.find[n].node) && (this.find[n].pos = this.currentPos);
  }
  findAround(e, n, r) {
    if (e != n && this.find)
      for (let i = 0; i < this.find.length; i++)
        this.find[i].pos == null && e.nodeType == 1 && e.contains(this.find[i].node) && n.compareDocumentPosition(this.find[i].node) & (r ? 2 : 4) && (this.find[i].pos = this.currentPos);
  }
  findInText(e) {
    if (this.find)
      for (let n = 0; n < this.find.length; n++)
        this.find[n].node == e && (this.find[n].pos = this.currentPos - (e.nodeValue.length - this.find[n].offset));
  }
  // Determines whether the given context string matches this context.
  matchesContext(e) {
    if (e.indexOf("|") > -1)
      return e.split(/\s*\|\s*/).some(this.matchesContext, this);
    let n = e.split("/"), r = this.options.context, i = !this.isOpen && (!r || r.parent.type == this.nodes[0].type), o = -(r ? r.depth + 1 : 0) + (i ? 0 : 1), s = (l, a) => {
      for (; l >= 0; l--) {
        let c = n[l];
        if (c == "") {
          if (l == n.length - 1 || l == 0)
            continue;
          for (; a >= o; a--)
            if (s(l - 1, a))
              return !0;
          return !1;
        } else {
          let u = a > 0 || a == 0 && i ? this.nodes[a].type : r && a >= o ? r.node(a - o).type : null;
          if (!u || u.name != c && !u.isInGroup(c))
            return !1;
          a--;
        }
      }
      return !0;
    };
    return s(n.length - 1, this.open);
  }
  textblockFromContext() {
    let e = this.options.context;
    if (e)
      for (let n = e.depth; n >= 0; n--) {
        let r = e.node(n).contentMatchAt(e.indexAfter(n)).defaultType;
        if (r && r.isTextblock && r.defaultAttrs)
          return r;
      }
    for (let n in this.parser.schema.nodes) {
      let r = this.parser.schema.nodes[n];
      if (r.isTextblock && r.defaultAttrs)
        return r;
    }
  }
}
function Hb(t) {
  for (let e = t.firstChild, n = null; e; e = e.nextSibling) {
    let r = e.nodeType == 1 ? e.nodeName.toLowerCase() : null;
    r && sf.hasOwnProperty(r) && n ? (n.appendChild(e), e = n) : r == "li" ? n = e : r && (n = null);
  }
}
function jb(t, e) {
  return (t.matches || t.msMatchesSelector || t.webkitMatchesSelector || t.mozMatchesSelector).call(t, e);
}
function Mc(t) {
  let e = {};
  for (let n in t)
    e[n] = t[n];
  return e;
}
function Tc(t, e) {
  let n = e.schema.nodes;
  for (let r in n) {
    let i = n[r];
    if (!i.allowsMarkType(t))
      continue;
    let o = [], s = (l) => {
      o.push(l);
      for (let a = 0; a < l.edgeCount; a++) {
        let { type: c, next: u } = l.edge(a);
        if (c == e || o.indexOf(u) < 0 && s(u))
          return !0;
      }
    };
    if (s(i.contentMatch))
      return !0;
  }
}
class Hn {
  /**
  Create a serializer. `nodes` should map node names to functions
  that take a node and return a description of the corresponding
  DOM. `marks` does the same for mark names, but also gets an
  argument that tells it whether the mark's content is block or
  inline content (for typical use, it'll always be inline). A mark
  serializer may be `null` to indicate that marks of that type
  should not be serialized.
  */
  constructor(e, n) {
    this.nodes = e, this.marks = n;
  }
  /**
  Serialize the content of this fragment to a DOM fragment. When
  not in the browser, the `document` option, containing a DOM
  document, should be passed so that the serializer can create
  nodes.
  */
  serializeFragment(e, n = {}, r) {
    r || (r = ni(n).createDocumentFragment());
    let i = r, o = [];
    return e.forEach((s) => {
      if (o.length || s.marks.length) {
        let l = 0, a = 0;
        for (; l < o.length && a < s.marks.length; ) {
          let c = s.marks[a];
          if (!this.marks[c.type.name]) {
            a++;
            continue;
          }
          if (!c.eq(o[l][0]) || c.type.spec.spanning === !1)
            break;
          l++, a++;
        }
        for (; l < o.length; )
          i = o.pop()[1];
        for (; a < s.marks.length; ) {
          let c = s.marks[a++], u = this.serializeMark(c, s.isInline, n);
          u && (o.push([c, i]), i.appendChild(u.dom), i = u.contentDOM || u.dom);
        }
      }
      i.appendChild(this.serializeNodeInner(s, n));
    }), r;
  }
  /**
  @internal
  */
  serializeNodeInner(e, n) {
    if (e.isText)
      return ni(n).createTextNode(e.text);
    let { dom: r, contentDOM: i } = ui(ni(n), this.nodes[e.type.name](e), null, e.attrs);
    if (i) {
      if (e.isLeaf)
        throw new RangeError("Content hole not allowed in a leaf node spec");
      this.serializeFragment(e.content, n, i);
    }
    return r;
  }
  /**
  Serialize this node to a DOM node. This can be useful when you
  need to serialize a part of a document, as opposed to the whole
  document. To serialize a whole document, use
  [`serializeFragment`](https://prosemirror.net/docs/ref/#model.DOMSerializer.serializeFragment) on
  its [content](https://prosemirror.net/docs/ref/#model.Node.content).
  */
  serializeNode(e, n = {}) {
    let r = this.serializeNodeInner(e, n);
    for (let i = e.marks.length - 1; i >= 0; i--) {
      let o = this.serializeMark(e.marks[i], e.isInline, n);
      o && ((o.contentDOM || o.dom).appendChild(r), r = o.dom);
    }
    return r;
  }
  /**
  @internal
  */
  serializeMark(e, n, r = {}) {
    let i = this.marks[e.type.name];
    return i && ui(ni(r), i(e, n), null, e.attrs);
  }
  static renderSpec(e, n, r = null, i) {
    return typeof n == "string" ? { dom: e.createTextNode(n) } : ui(e, n, r, i);
  }
  /**
  Build a serializer using the [`toDOM`](https://prosemirror.net/docs/ref/#model.NodeSpec.toDOM)
  properties in a schema's node and mark specs.
  */
  static fromSchema(e) {
    return e.cached.domSerializer || (e.cached.domSerializer = new Hn(this.nodesFromSchema(e), this.marksFromSchema(e)));
  }
  /**
  Gather the serializers in a schema's node specs into an object.
  This can be useful as a base to build a custom serializer from.
  */
  static nodesFromSchema(e) {
    let n = Ac(e.nodes);
    return n.text || (n.text = (r) => r.text), n;
  }
  /**
  Gather the serializers in a schema's mark specs into an object.
  */
  static marksFromSchema(e) {
    return Ac(e.marks);
  }
}
function Ac(t) {
  let e = {};
  for (let n in t) {
    let r = t[n].spec.toDOM;
    r && (e[n] = r);
  }
  return e;
}
function ni(t) {
  return t.document || window.document;
}
const Ic = /* @__PURE__ */ new WeakMap();
function qb(t) {
  let e = Ic.get(t);
  return e === void 0 && Ic.set(t, e = Wb(t)), e;
}
function Wb(t) {
  let e = null;
  function n(r) {
    if (r && typeof r == "object")
      if (Array.isArray(r))
        if (typeof r[0] == "string")
          e || (e = []), e.push(r);
        else
          for (let i = 0; i < r.length; i++)
            n(r[i]);
      else
        for (let i in r)
          n(r[i]);
  }
  return n(t), e;
}
function ui(t, e, n, r) {
  if (e.nodeType == 1)
    return { dom: e };
  if (e.dom && e.dom.nodeType == 1)
    return e;
  let i = e[0], o;
  if (typeof i != "string")
    throw new RangeError("Invalid array passed to renderSpec");
  if (r && (o = qb(r)) && o.indexOf(e) > -1)
    throw new RangeError("Using an array from an attribute object as a DOM spec. This may be an attempted cross site scripting attack.");
  let s = i.indexOf(" ");
  s > 0 && (n = i.slice(0, s), i = i.slice(s + 1));
  let l, a = n ? t.createElementNS(n, i) : t.createElement(i), c = e[1], u = 1;
  if (c && typeof c == "object" && c.nodeType == null && !Array.isArray(c)) {
    u = 2;
    for (let h in c)
      if (c[h] != null) {
        let d = h.indexOf(" ");
        d > 0 ? a.setAttributeNS(h.slice(0, d), h.slice(d + 1), c[h]) : h == "style" && a.style ? a.style.cssText = c[h] : a.setAttribute(h, c[h]);
      }
  }
  for (let h = u; h < e.length; h++) {
    let d = e[h];
    if (d === 0) {
      if (h < e.length - 1 || h > u)
        throw new RangeError("Content hole must be the only child of its parent node");
      return { dom: a, contentDOM: a };
    } else if (typeof d == "string")
      a.appendChild(t.createTextNode(d));
    else {
      let { dom: f, contentDOM: p } = ui(t, d, n, r);
      if (a.appendChild(f), p) {
        if (l)
          throw new RangeError("Multiple content holes");
        l = p;
      }
    }
  }
  return { dom: a, contentDOM: l };
}
const lf = 65535, af = Math.pow(2, 16);
function Kb(t, e) {
  return t + e * af;
}
function Ec(t) {
  return t & lf;
}
function Ub(t) {
  return (t - (t & lf)) / af;
}
const cf = 1, uf = 2, hi = 4, hf = 8;
class ws {
  /**
  @internal
  */
  constructor(e, n, r) {
    this.pos = e, this.delInfo = n, this.recover = r;
  }
  /**
  Tells you whether the position was deleted, that is, whether the
  step removed the token on the side queried (via the `assoc`)
  argument from the document.
  */
  get deleted() {
    return (this.delInfo & hf) > 0;
  }
  /**
  Tells you whether the token before the mapped position was deleted.
  */
  get deletedBefore() {
    return (this.delInfo & (cf | hi)) > 0;
  }
  /**
  True when the token after the mapped position was deleted.
  */
  get deletedAfter() {
    return (this.delInfo & (uf | hi)) > 0;
  }
  /**
  Tells whether any of the steps mapped through deletes across the
  position (including both the token before and after the
  position).
  */
  get deletedAcross() {
    return (this.delInfo & hi) > 0;
  }
}
class ze {
  /**
  Create a position map. The modifications to the document are
  represented as an array of numbers, in which each group of three
  represents a modified chunk as `[start, oldSize, newSize]`.
  */
  constructor(e, n = !1) {
    if (this.ranges = e, this.inverted = n, !e.length && ze.empty)
      return ze.empty;
  }
  /**
  @internal
  */
  recover(e) {
    let n = 0, r = Ec(e);
    if (!this.inverted)
      for (let i = 0; i < r; i++)
        n += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1];
    return this.ranges[r * 3] + n + Ub(e);
  }
  mapResult(e, n = 1) {
    return this._map(e, n, !1);
  }
  map(e, n = 1) {
    return this._map(e, n, !0);
  }
  /**
  @internal
  */
  _map(e, n, r) {
    let i = 0, o = this.inverted ? 2 : 1, s = this.inverted ? 1 : 2;
    for (let l = 0; l < this.ranges.length; l += 3) {
      let a = this.ranges[l] - (this.inverted ? i : 0);
      if (a > e)
        break;
      let c = this.ranges[l + o], u = this.ranges[l + s], h = a + c;
      if (e <= h) {
        let d = c ? e == a ? -1 : e == h ? 1 : n : n, f = a + i + (d < 0 ? 0 : u);
        if (r)
          return f;
        let p = e == (n < 0 ? a : h) ? null : Kb(l / 3, e - a), m = 0;
        return c && (m |= e == a ? uf : e == h ? cf : hi, (n < 0 ? e != a : e != h) && (m |= hf)), new ws(f, m, p);
      }
      i += u - c;
    }
    return r ? e + i : new ws(e + i, 0, null);
  }
  /**
  @internal
  */
  touches(e, n) {
    let r = 0, i = Ec(n), o = this.inverted ? 2 : 1, s = this.inverted ? 1 : 2;
    for (let l = 0; l < this.ranges.length; l += 3) {
      let a = this.ranges[l] - (this.inverted ? r : 0);
      if (a > e)
        break;
      let c = this.ranges[l + o], u = a + c;
      if (e <= u && l == i * 3)
        return !0;
      r += this.ranges[l + s] - c;
    }
    return !1;
  }
  /**
  Calls the given function on each of the changed ranges included in
  this map.
  */
  forEach(e) {
    let n = this.inverted ? 2 : 1, r = this.inverted ? 1 : 2;
    for (let i = 0, o = 0; i < this.ranges.length; i += 3) {
      let s = this.ranges[i], l = s - (this.inverted ? o : 0), a = s + (this.inverted ? 0 : o), c = this.ranges[i + n], u = this.ranges[i + r];
      e(l, l + c, a, a + u), o += u - c;
    }
  }
  /**
  Create an inverted version of this map. The result can be used to
  map positions in the post-step document to the pre-step document.
  */
  invert() {
    return new ze(this.ranges, !this.inverted);
  }
  /**
  @internal
  */
  toString() {
    return (this.inverted ? "-" : "") + JSON.stringify(this.ranges);
  }
  /**
  Create a map that moves all positions by offset `n` (which may be
  negative). This can be useful when applying steps meant for a
  sub-document to a larger document, or vice-versa.
  */
  static offset(e) {
    return e == 0 ? ze.empty : new ze(e < 0 ? [0, -e, 0] : [0, 0, e]);
  }
}
ze.empty = new ze([]);
class vi {
  /**
  Create a new mapping with the given position maps.
  */
  constructor(e, n, r = 0, i = e ? e.length : 0) {
    this.mirror = n, this.from = r, this.to = i, this._maps = e || [], this.ownData = !(e || n);
  }
  /**
  The step maps in this mapping.
  */
  get maps() {
    return this._maps;
  }
  /**
  Create a mapping that maps only through a part of this one.
  */
  slice(e = 0, n = this.maps.length) {
    return new vi(this._maps, this.mirror, e, n);
  }
  /**
  Add a step map to the end of this mapping. If `mirrors` is
  given, it should be the index of the step map that is the mirror
  image of this one.
  */
  appendMap(e, n) {
    this.ownData || (this._maps = this._maps.slice(), this.mirror = this.mirror && this.mirror.slice(), this.ownData = !0), this.to = this._maps.push(e), n != null && this.setMirror(this._maps.length - 1, n);
  }
  /**
  Add all the step maps in a given mapping to this one (preserving
  mirroring information).
  */
  appendMapping(e) {
    for (let n = 0, r = this._maps.length; n < e._maps.length; n++) {
      let i = e.getMirror(n);
      this.appendMap(e._maps[n], i != null && i < n ? r + i : void 0);
    }
  }
  /**
  Finds the offset of the step map that mirrors the map at the
  given offset, in this mapping (as per the second argument to
  `appendMap`).
  */
  getMirror(e) {
    if (this.mirror) {
      for (let n = 0; n < this.mirror.length; n++)
        if (this.mirror[n] == e)
          return this.mirror[n + (n % 2 ? -1 : 1)];
    }
  }
  /**
  @internal
  */
  setMirror(e, n) {
    this.mirror || (this.mirror = []), this.mirror.push(e, n);
  }
  /**
  Append the inverse of the given mapping to this one.
  */
  appendMappingInverted(e) {
    for (let n = e.maps.length - 1, r = this._maps.length + e._maps.length; n >= 0; n--) {
      let i = e.getMirror(n);
      this.appendMap(e._maps[n].invert(), i != null && i > n ? r - i - 1 : void 0);
    }
  }
  /**
  Create an inverted version of this mapping.
  */
  invert() {
    let e = new vi();
    return e.appendMappingInverted(this), e;
  }
  /**
  Map a position through this mapping.
  */
  map(e, n = 1) {
    if (this.mirror)
      return this._map(e, n, !0);
    for (let r = this.from; r < this.to; r++)
      e = this._maps[r].map(e, n);
    return e;
  }
  /**
  Map a position through this mapping, returning a mapping
  result.
  */
  mapResult(e, n = 1) {
    return this._map(e, n, !1);
  }
  /**
  @internal
  */
  _map(e, n, r) {
    let i = 0;
    for (let o = this.from; o < this.to; o++) {
      let s = this._maps[o], l = s.mapResult(e, n);
      if (l.recover != null) {
        let a = this.getMirror(o);
        if (a != null && a > o && a < this.to) {
          o = a, e = this._maps[a].recover(l.recover);
          continue;
        }
      }
      i |= l.delInfo, e = l.pos;
    }
    return r ? e : new ws(e, i, null);
  }
}
const No = /* @__PURE__ */ Object.create(null);
class we {
  /**
  Get the step map that represents the changes made by this step,
  and which can be used to transform between positions in the old
  and the new document.
  */
  getMap() {
    return ze.empty;
  }
  /**
  Try to merge this step with another one, to be applied directly
  after it. Returns the merged step when possible, null if the
  steps can't be merged.
  */
  merge(e) {
    return null;
  }
  /**
  Deserialize a step from its JSON representation. Will call
  through to the step class' own implementation of this method.
  */
  static fromJSON(e, n) {
    if (!n || !n.stepType)
      throw new RangeError("Invalid input for Step.fromJSON");
    let r = No[n.stepType];
    if (!r)
      throw new RangeError(`No step type ${n.stepType} defined`);
    return r.fromJSON(e, n);
  }
  /**
  To be able to serialize steps to JSON, each step needs a string
  ID to attach to its JSON representation. Use this method to
  register an ID for your step classes. Try to pick something
  that's unlikely to clash with steps from other modules.
  */
  static jsonID(e, n) {
    if (e in No)
      throw new RangeError("Duplicate use of step JSON ID " + e);
    return No[e] = n, n.prototype.jsonID = e, n;
  }
}
class oe {
  /**
  @internal
  */
  constructor(e, n) {
    this.doc = e, this.failed = n;
  }
  /**
  Create a successful step result.
  */
  static ok(e) {
    return new oe(e, null);
  }
  /**
  Create a failed step result.
  */
  static fail(e) {
    return new oe(null, e);
  }
  /**
  Call [`Node.replace`](https://prosemirror.net/docs/ref/#model.Node.replace) with the given
  arguments. Create a successful result if it succeeds, and a
  failed one if it throws a `ReplaceError`.
  */
  static fromReplace(e, n, r, i) {
    try {
      return oe.ok(e.replace(n, r, i));
    } catch (o) {
      if (o instanceof Sr)
        return oe.fail(o.message);
      throw o;
    }
  }
}
function hl(t, e, n) {
  let r = [];
  for (let i = 0; i < t.childCount; i++) {
    let o = t.child(i);
    o.content.size && (o = o.copy(hl(o.content, e, o))), o.isInline && (o = e(o, n, i)), r.push(o);
  }
  return T.fromArray(r);
}
class xt extends we {
  /**
  Create a mark step.
  */
  constructor(e, n, r) {
    super(), this.from = e, this.to = n, this.mark = r;
  }
  apply(e) {
    let n = e.slice(this.from, this.to), r = e.resolve(this.from), i = r.node(r.sharedDepth(this.to)), o = new E(hl(n.content, (s, l) => !s.isAtom || !l.type.allowsMarkType(this.mark.type) ? s : s.mark(this.mark.addToSet(s.marks)), i), n.openStart, n.openEnd);
    return oe.fromReplace(e, this.from, this.to, o);
  }
  invert() {
    return new it(this.from, this.to, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.from, 1), r = e.mapResult(this.to, -1);
    return n.deleted && r.deleted || n.pos >= r.pos ? null : new xt(n.pos, r.pos, this.mark);
  }
  merge(e) {
    return e instanceof xt && e.mark.eq(this.mark) && this.from <= e.to && this.to >= e.from ? new xt(Math.min(this.from, e.from), Math.max(this.to, e.to), this.mark) : null;
  }
  toJSON() {
    return {
      stepType: "addMark",
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to
    };
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.from != "number" || typeof n.to != "number")
      throw new RangeError("Invalid input for AddMarkStep.fromJSON");
    return new xt(n.from, n.to, e.markFromJSON(n.mark));
  }
}
we.jsonID("addMark", xt);
class it extends we {
  /**
  Create a mark-removing step.
  */
  constructor(e, n, r) {
    super(), this.from = e, this.to = n, this.mark = r;
  }
  apply(e) {
    let n = e.slice(this.from, this.to), r = new E(hl(n.content, (i) => i.mark(this.mark.removeFromSet(i.marks)), e), n.openStart, n.openEnd);
    return oe.fromReplace(e, this.from, this.to, r);
  }
  invert() {
    return new xt(this.from, this.to, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.from, 1), r = e.mapResult(this.to, -1);
    return n.deleted && r.deleted || n.pos >= r.pos ? null : new it(n.pos, r.pos, this.mark);
  }
  merge(e) {
    return e instanceof it && e.mark.eq(this.mark) && this.from <= e.to && this.to >= e.from ? new it(Math.min(this.from, e.from), Math.max(this.to, e.to), this.mark) : null;
  }
  toJSON() {
    return {
      stepType: "removeMark",
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to
    };
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.from != "number" || typeof n.to != "number")
      throw new RangeError("Invalid input for RemoveMarkStep.fromJSON");
    return new it(n.from, n.to, e.markFromJSON(n.mark));
  }
}
we.jsonID("removeMark", it);
class _t extends we {
  /**
  Create a node mark step.
  */
  constructor(e, n) {
    super(), this.pos = e, this.mark = n;
  }
  apply(e) {
    let n = e.nodeAt(this.pos);
    if (!n)
      return oe.fail("No node at mark step's position");
    let r = n.type.create(n.attrs, null, this.mark.addToSet(n.marks));
    return oe.fromReplace(e, this.pos, this.pos + 1, new E(T.from(r), 0, n.isLeaf ? 0 : 1));
  }
  invert(e) {
    let n = e.nodeAt(this.pos);
    if (n) {
      let r = this.mark.addToSet(n.marks);
      if (r.length == n.marks.length) {
        for (let i = 0; i < n.marks.length; i++)
          if (!n.marks[i].isInSet(r))
            return new _t(this.pos, n.marks[i]);
        return new _t(this.pos, this.mark);
      }
    }
    return new gn(this.pos, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.pos, 1);
    return n.deletedAfter ? null : new _t(n.pos, this.mark);
  }
  toJSON() {
    return { stepType: "addNodeMark", pos: this.pos, mark: this.mark.toJSON() };
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.pos != "number")
      throw new RangeError("Invalid input for AddNodeMarkStep.fromJSON");
    return new _t(n.pos, e.markFromJSON(n.mark));
  }
}
we.jsonID("addNodeMark", _t);
class gn extends we {
  /**
  Create a mark-removing step.
  */
  constructor(e, n) {
    super(), this.pos = e, this.mark = n;
  }
  apply(e) {
    let n = e.nodeAt(this.pos);
    if (!n)
      return oe.fail("No node at mark step's position");
    let r = n.type.create(n.attrs, null, this.mark.removeFromSet(n.marks));
    return oe.fromReplace(e, this.pos, this.pos + 1, new E(T.from(r), 0, n.isLeaf ? 0 : 1));
  }
  invert(e) {
    let n = e.nodeAt(this.pos);
    return !n || !this.mark.isInSet(n.marks) ? this : new _t(this.pos, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.pos, 1);
    return n.deletedAfter ? null : new gn(n.pos, this.mark);
  }
  toJSON() {
    return { stepType: "removeNodeMark", pos: this.pos, mark: this.mark.toJSON() };
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.pos != "number")
      throw new RangeError("Invalid input for RemoveNodeMarkStep.fromJSON");
    return new gn(n.pos, e.markFromJSON(n.mark));
  }
}
we.jsonID("removeNodeMark", gn);
class ie extends we {
  /**
  The given `slice` should fit the 'gap' between `from` and
  `to`—the depths must line up, and the surrounding nodes must be
  able to be joined with the open sides of the slice. When
  `structure` is true, the step will fail if the content between
  from and to is not just a sequence of closing and then opening
  tokens (this is to guard against rebased replace steps
  overwriting something they weren't supposed to).
  */
  constructor(e, n, r, i = !1) {
    super(), this.from = e, this.to = n, this.slice = r, this.structure = i;
  }
  apply(e) {
    return this.structure && Cs(e, this.from, this.to) ? oe.fail("Structure replace would overwrite content") : oe.fromReplace(e, this.from, this.to, this.slice);
  }
  getMap() {
    return new ze([this.from, this.to - this.from, this.slice.size]);
  }
  invert(e) {
    return new ie(this.from, this.from + this.slice.size, e.slice(this.from, this.to));
  }
  map(e) {
    let n = e.mapResult(this.to, -1), r = this.from == this.to && ie.MAP_BIAS < 0 ? n : e.mapResult(this.from, 1);
    return r.deletedAcross && n.deletedAcross ? null : new ie(r.pos, Math.max(r.pos, n.pos), this.slice, this.structure);
  }
  merge(e) {
    if (!(e instanceof ie) || e.structure || this.structure)
      return null;
    if (this.from + this.slice.size == e.from && !this.slice.openEnd && !e.slice.openStart) {
      let n = this.slice.size + e.slice.size == 0 ? E.empty : new E(this.slice.content.append(e.slice.content), this.slice.openStart, e.slice.openEnd);
      return new ie(this.from, this.to + (e.to - e.from), n, this.structure);
    } else if (e.to == this.from && !this.slice.openStart && !e.slice.openEnd) {
      let n = this.slice.size + e.slice.size == 0 ? E.empty : new E(e.slice.content.append(this.slice.content), e.slice.openStart, this.slice.openEnd);
      return new ie(e.from, this.to, n, this.structure);
    } else
      return null;
  }
  toJSON() {
    let e = { stepType: "replace", from: this.from, to: this.to };
    return this.slice.size && (e.slice = this.slice.toJSON()), this.structure && (e.structure = !0), e;
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.from != "number" || typeof n.to != "number")
      throw new RangeError("Invalid input for ReplaceStep.fromJSON");
    return new ie(n.from, n.to, E.fromJSON(e, n.slice), !!n.structure);
  }
}
ie.MAP_BIAS = 1;
we.jsonID("replace", ie);
class be extends we {
  /**
  Create a replace-around step with the given range and gap.
  `insert` should be the point in the slice into which the content
  of the gap should be moved. `structure` has the same meaning as
  it has in the [`ReplaceStep`](https://prosemirror.net/docs/ref/#transform.ReplaceStep) class.
  */
  constructor(e, n, r, i, o, s, l = !1) {
    super(), this.from = e, this.to = n, this.gapFrom = r, this.gapTo = i, this.slice = o, this.insert = s, this.structure = l;
  }
  apply(e) {
    if (this.structure && (Cs(e, this.from, this.gapFrom) || Cs(e, this.gapTo, this.to)))
      return oe.fail("Structure gap-replace would overwrite content");
    let n = e.slice(this.gapFrom, this.gapTo);
    if (n.openStart || n.openEnd)
      return oe.fail("Gap is not a flat range");
    let r = this.slice.insertAt(this.insert, n.content);
    return r ? oe.fromReplace(e, this.from, this.to, r) : oe.fail("Content does not fit in gap");
  }
  getMap() {
    return new ze([
      this.from,
      this.gapFrom - this.from,
      this.insert,
      this.gapTo,
      this.to - this.gapTo,
      this.slice.size - this.insert
    ]);
  }
  invert(e) {
    let n = this.gapTo - this.gapFrom;
    return new be(this.from, this.from + this.slice.size + n, this.from + this.insert, this.from + this.insert + n, e.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from), this.gapFrom - this.from, this.structure);
  }
  map(e) {
    let n = e.mapResult(this.from, 1), r = e.mapResult(this.to, -1), i = this.from == this.gapFrom ? n.pos : e.map(this.gapFrom, -1), o = this.to == this.gapTo ? r.pos : e.map(this.gapTo, 1);
    return n.deletedAcross && r.deletedAcross || i < n.pos || o > r.pos ? null : new be(n.pos, r.pos, i, o, this.slice, this.insert, this.structure);
  }
  toJSON() {
    let e = {
      stepType: "replaceAround",
      from: this.from,
      to: this.to,
      gapFrom: this.gapFrom,
      gapTo: this.gapTo,
      insert: this.insert
    };
    return this.slice.size && (e.slice = this.slice.toJSON()), this.structure && (e.structure = !0), e;
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.from != "number" || typeof n.to != "number" || typeof n.gapFrom != "number" || typeof n.gapTo != "number" || typeof n.insert != "number")
      throw new RangeError("Invalid input for ReplaceAroundStep.fromJSON");
    return new be(n.from, n.to, n.gapFrom, n.gapTo, E.fromJSON(e, n.slice), n.insert, !!n.structure);
  }
}
we.jsonID("replaceAround", be);
function Cs(t, e, n) {
  let r = t.resolve(e), i = n - e, o = r.depth;
  for (; i > 0 && o > 0 && r.indexAfter(o) == r.node(o).childCount; )
    o--, i--;
  if (i > 0) {
    let s = r.node(o).maybeChild(r.indexAfter(o));
    for (; i > 0; ) {
      if (!s || s.isLeaf)
        return !0;
      s = s.firstChild, i--;
    }
  }
  return !1;
}
function Jb(t, e, n, r) {
  let i = [], o = [], s, l;
  t.doc.nodesBetween(e, n, (a, c, u) => {
    if (!a.isInline)
      return;
    let h = a.marks;
    if (!r.isInSet(h) && u.type.allowsMarkType(r.type)) {
      let d = Math.max(c, e), f = Math.min(c + a.nodeSize, n), p = r.addToSet(h);
      for (let m = 0; m < h.length; m++)
        h[m].isInSet(p) || (s && s.to == d && s.mark.eq(h[m]) ? s.to = f : i.push(s = new it(d, f, h[m])));
      l && l.to == d ? l.to = f : o.push(l = new xt(d, f, r));
    }
  }), i.forEach((a) => t.step(a)), o.forEach((a) => t.step(a));
}
function Gb(t, e, n, r) {
  let i = [], o = 0;
  t.doc.nodesBetween(e, n, (s, l) => {
    if (!s.isInline)
      return;
    o++;
    let a = null;
    if (r instanceof Gi) {
      let c = s.marks, u;
      for (; u = r.isInSet(c); )
        (a || (a = [])).push(u), c = u.removeFromSet(c);
    } else r ? r.isInSet(s.marks) && (a = [r]) : a = s.marks;
    if (a && a.length) {
      let c = Math.min(l + s.nodeSize, n);
      for (let u = 0; u < a.length; u++) {
        let h = a[u], d;
        for (let f = 0; f < i.length; f++) {
          let p = i[f];
          p.step == o - 1 && h.eq(i[f].style) && (d = p);
        }
        d ? (d.to = c, d.step = o) : i.push({ style: h, from: Math.max(l, e), to: c, step: o });
      }
    }
  }), i.forEach((s) => t.step(new it(s.from, s.to, s.style)));
}
function fl(t, e, n, r = n.contentMatch, i = !0) {
  let o = t.doc.nodeAt(e), s = [], l = e + 1;
  for (let a = 0; a < o.childCount; a++) {
    let c = o.child(a), u = l + c.nodeSize, h = r.matchType(c.type);
    if (!h)
      s.push(new ie(l, u, E.empty));
    else {
      r = h;
      for (let d = 0; d < c.marks.length; d++)
        n.allowsMarkType(c.marks[d].type) || t.step(new it(l, u, c.marks[d]));
      if (i && c.isText && n.whitespace != "pre") {
        let d, f = /\r?\n|\r/g, p;
        for (; d = f.exec(c.text); )
          p || (p = new E(T.from(n.schema.text(" ", n.allowedMarks(c.marks))), 0, 0)), s.push(new ie(l + d.index, l + d.index + d[0].length, p));
      }
    }
    l = u;
  }
  if (!r.validEnd) {
    let a = r.fillBefore(T.empty, !0);
    t.replace(l, l, new E(a, 0, 0));
  }
  for (let a = s.length - 1; a >= 0; a--)
    t.step(s[a]);
}
function Yb(t, e, n) {
  return (e == 0 || t.canReplace(e, t.childCount)) && (n == t.childCount || t.canReplace(0, n));
}
function Yi(t) {
  let n = t.parent.content.cutByIndex(t.startIndex, t.endIndex);
  for (let r = t.depth, i = 0, o = 0; ; --r) {
    let s = t.$from.node(r), l = t.$from.index(r) + i, a = t.$to.indexAfter(r) - o;
    if (r < t.depth && s.canReplace(l, a, n))
      return r;
    if (r == 0 || s.type.spec.isolating || !Yb(s, l, a))
      break;
    l && (i = 1), a < s.childCount && (o = 1);
  }
  return null;
}
function Qb(t, e, n) {
  let { $from: r, $to: i, depth: o } = e, s = r.before(o + 1), l = i.after(o + 1), a = s, c = l, u = T.empty, h = 0;
  for (let p = o, m = !1; p > n; p--)
    m || r.index(p) > 0 ? (m = !0, u = T.from(r.node(p).copy(u)), h++) : a--;
  let d = T.empty, f = 0;
  for (let p = o, m = !1; p > n; p--)
    m || i.after(p + 1) < i.end(p) ? (m = !0, d = T.from(i.node(p).copy(d)), f++) : c++;
  t.step(new be(a, c, s, l, new E(u.append(d), h, f), u.size - h, !0));
}
function dl(t, e, n = null, r = t) {
  let i = Xb(t, e), o = i && Zb(r, e);
  return o ? i.map(Oc).concat({ type: e, attrs: n }).concat(o.map(Oc)) : null;
}
function Oc(t) {
  return { type: t, attrs: null };
}
function Xb(t, e) {
  let { parent: n, startIndex: r, endIndex: i } = t, o = n.contentMatchAt(r).findWrapping(e);
  if (!o)
    return null;
  let s = o.length ? o[0] : e;
  return n.canReplaceWith(r, i, s) ? o : null;
}
function Zb(t, e) {
  let { parent: n, startIndex: r, endIndex: i } = t, o = n.child(r), s = e.contentMatch.findWrapping(o.type);
  if (!s)
    return null;
  let a = (s.length ? s[s.length - 1] : e).contentMatch;
  for (let c = r; a && c < i; c++)
    a = a.matchType(n.child(c).type);
  return !a || !a.validEnd ? null : s;
}
function e1(t, e, n) {
  let r = T.empty;
  for (let s = n.length - 1; s >= 0; s--) {
    if (r.size) {
      let l = n[s].type.contentMatch.matchFragment(r);
      if (!l || !l.validEnd)
        throw new RangeError("Wrapper type given to Transform.wrap does not form valid content of its parent wrapper");
    }
    r = T.from(n[s].type.create(n[s].attrs, r));
  }
  let i = e.start, o = e.end;
  t.step(new be(i, o, i, o, new E(r, 0, 0), n.length, !0));
}
function t1(t, e, n, r, i) {
  if (!r.isTextblock)
    throw new RangeError("Type given to setBlockType should be a textblock");
  let o = t.steps.length;
  t.doc.nodesBetween(e, n, (s, l) => {
    let a = typeof i == "function" ? i(s) : i;
    if (s.isTextblock && !s.hasMarkup(r, a) && n1(t.doc, t.mapping.slice(o).map(l), r)) {
      let c = null;
      if (r.schema.linebreakReplacement) {
        let f = r.whitespace == "pre", p = !!r.contentMatch.matchType(r.schema.linebreakReplacement);
        f && !p ? c = !1 : !f && p && (c = !0);
      }
      c === !1 && df(t, s, l, o), fl(t, t.mapping.slice(o).map(l, 1), r, void 0, c === null);
      let u = t.mapping.slice(o), h = u.map(l, 1), d = u.map(l + s.nodeSize, 1);
      return t.step(new be(h, d, h + 1, d - 1, new E(T.from(r.create(a, null, s.marks)), 0, 0), 1, !0)), c === !0 && ff(t, s, l, o), !1;
    }
  });
}
function ff(t, e, n, r) {
  e.forEach((i, o) => {
    if (i.isText) {
      let s, l = /\r?\n|\r/g;
      for (; s = l.exec(i.text); ) {
        let a = t.mapping.slice(r).map(n + 1 + o + s.index);
        t.replaceWith(a, a + 1, e.type.schema.linebreakReplacement.create());
      }
    }
  });
}
function df(t, e, n, r) {
  e.forEach((i, o) => {
    if (i.type == i.type.schema.linebreakReplacement) {
      let s = t.mapping.slice(r).map(n + 1 + o);
      t.replaceWith(s, s + 1, e.type.schema.text(`
`));
    }
  });
}
function n1(t, e, n) {
  let r = t.resolve(e), i = r.index();
  return r.parent.canReplaceWith(i, i + 1, n);
}
function r1(t, e, n, r, i) {
  let o = t.doc.nodeAt(e);
  if (!o)
    throw new RangeError("No node at given position");
  n || (n = o.type);
  let s = n.create(r, null, i || o.marks);
  if (o.isLeaf)
    return t.replaceWith(e, e + o.nodeSize, s);
  if (!n.validContent(o.content))
    throw new RangeError("Invalid content for node type " + n.name);
  t.step(new be(e, e + o.nodeSize, e + 1, e + o.nodeSize - 1, new E(T.from(s), 0, 0), 1, !0));
}
function dr(t, e, n = 1, r) {
  let i = t.resolve(e), o = i.depth - n, s = r && r[r.length - 1] || i.parent;
  if (o < 0 || i.parent.type.spec.isolating || !i.parent.canReplace(i.index(), i.parent.childCount) || !s.type.validContent(i.parent.content.cutByIndex(i.index(), i.parent.childCount)))
    return !1;
  for (let c = i.depth - 1, u = n - 2; c > o; c--, u--) {
    let h = i.node(c), d = i.index(c);
    if (h.type.spec.isolating)
      return !1;
    let f = h.content.cutByIndex(d, h.childCount), p = r && r[u + 1];
    p && (f = f.replaceChild(0, p.type.create(p.attrs)));
    let m = r && r[u] || h;
    if (!h.canReplace(d + 1, h.childCount) || !m.type.validContent(f))
      return !1;
  }
  let l = i.indexAfter(o), a = r && r[0];
  return i.node(o).canReplaceWith(l, l, a ? a.type : i.node(o + 1).type);
}
function i1(t, e, n = 1, r) {
  let i = t.doc.resolve(e), o = T.empty, s = T.empty;
  for (let l = i.depth, a = i.depth - n, c = n - 1; l > a; l--, c--) {
    o = T.from(i.node(l).copy(o));
    let u = r && r[c];
    s = T.from(u ? u.type.create(u.attrs, s) : i.node(l).copy(s));
  }
  t.step(new ie(e, e, new E(o.append(s), n, n), !0));
}
function Qi(t, e) {
  let n = t.resolve(e), r = n.index();
  return s1(n.nodeBefore, n.nodeAfter) && n.parent.canReplace(r, r + 1);
}
function o1(t, e) {
  e.content.size || t.type.compatibleContent(e.type);
  let n = t.contentMatchAt(t.childCount), { linebreakReplacement: r } = t.type.schema;
  for (let i = 0; i < e.childCount; i++) {
    let o = e.child(i), s = o.type == r ? t.type.schema.nodes.text : o.type;
    if (n = n.matchType(s), !n || !t.type.allowsMarks(o.marks))
      return !1;
  }
  return n.validEnd;
}
function s1(t, e) {
  return !!(t && e && !t.isLeaf && o1(t, e));
}
function l1(t, e, n) {
  let r = null, { linebreakReplacement: i } = t.doc.type.schema, o = t.doc.resolve(e - n), s = o.node().type;
  if (i && s.inlineContent) {
    let u = s.whitespace == "pre", h = !!s.contentMatch.matchType(i);
    u && !h ? r = !1 : !u && h && (r = !0);
  }
  let l = t.steps.length;
  if (r === !1) {
    let u = t.doc.resolve(e + n);
    df(t, u.node(), u.before(), l);
  }
  s.inlineContent && fl(t, e + n - 1, s, o.node().contentMatchAt(o.index()), r == null);
  let a = t.mapping.slice(l), c = a.map(e - n);
  if (t.step(new ie(c, a.map(e + n, -1), E.empty, !0)), r === !0) {
    let u = t.doc.resolve(c);
    ff(t, u.node(), u.before(), t.steps.length);
  }
  return t;
}
function a1(t, e, n) {
  let r = t.resolve(e);
  if (r.parent.canReplaceWith(r.index(), r.index(), n))
    return e;
  if (r.parentOffset == 0)
    for (let i = r.depth - 1; i >= 0; i--) {
      let o = r.index(i);
      if (r.node(i).canReplaceWith(o, o, n))
        return r.before(i + 1);
      if (o > 0)
        return null;
    }
  if (r.parentOffset == r.parent.content.size)
    for (let i = r.depth - 1; i >= 0; i--) {
      let o = r.indexAfter(i);
      if (r.node(i).canReplaceWith(o, o, n))
        return r.after(i + 1);
      if (o < r.node(i).childCount)
        return null;
    }
  return null;
}
function c1(t, e, n) {
  let r = t.resolve(e);
  if (!n.content.size)
    return e;
  let i = n.content;
  for (let o = 0; o < n.openStart; o++)
    i = i.firstChild.content;
  for (let o = 1; o <= (n.openStart == 0 && n.size ? 2 : 1); o++)
    for (let s = r.depth; s >= 0; s--) {
      let l = s == r.depth ? 0 : r.pos <= (r.start(s + 1) + r.end(s + 1)) / 2 ? -1 : 1, a = r.index(s) + (l > 0 ? 1 : 0), c = r.node(s), u = !1;
      if (o == 1)
        u = c.canReplace(a, a, i);
      else {
        let h = c.contentMatchAt(a).findWrapping(i.firstChild.type);
        u = h && c.canReplaceWith(a, a, h[0]);
      }
      if (u)
        return l == 0 ? r.pos : l < 0 ? r.before(s + 1) : r.after(s + 1);
    }
  return null;
}
function Xi(t, e, n = e, r = E.empty) {
  if (e == n && !r.size)
    return null;
  let i = t.resolve(e), o = t.resolve(n);
  return pf(i, o, r) ? new ie(e, n, r) : new u1(i, o, r).fit();
}
function pf(t, e, n) {
  return !n.openStart && !n.openEnd && t.start() == e.start() && t.parent.canReplace(t.index(), e.index(), n.content);
}
class u1 {
  constructor(e, n, r) {
    this.$from = e, this.$to = n, this.unplaced = r, this.frontier = [], this.placed = T.empty;
    for (let i = 0; i <= e.depth; i++) {
      let o = e.node(i);
      this.frontier.push({
        type: o.type,
        match: o.contentMatchAt(e.indexAfter(i))
      });
    }
    for (let i = e.depth; i > 0; i--)
      this.placed = T.from(e.node(i).copy(this.placed));
  }
  get depth() {
    return this.frontier.length - 1;
  }
  fit() {
    for (; this.unplaced.size; ) {
      let c = this.findFittable();
      c ? this.placeNodes(c) : this.openMore() || this.dropNode();
    }
    let e = this.mustMoveInline(), n = this.placed.size - this.depth - this.$from.depth, r = this.$from, i = this.close(e < 0 ? this.$to : r.doc.resolve(e));
    if (!i)
      return null;
    let o = this.placed, s = r.depth, l = i.depth;
    for (; s && l && o.childCount == 1; )
      o = o.firstChild.content, s--, l--;
    let a = new E(o, s, l);
    return e > -1 ? new be(r.pos, e, this.$to.pos, this.$to.end(), a, n) : a.size || r.pos != this.$to.pos ? new ie(r.pos, i.pos, a) : null;
  }
  // Find a position on the start spine of `this.unplaced` that has
  // content that can be moved somewhere on the frontier. Returns two
  // depths, one for the slice and one for the frontier.
  findFittable() {
    let e = this.unplaced.openStart;
    for (let n = this.unplaced.content, r = 0, i = this.unplaced.openEnd; r < e; r++) {
      let o = n.firstChild;
      if (n.childCount > 1 && (i = 0), o.type.spec.isolating && i <= r) {
        e = r;
        break;
      }
      n = o.content;
    }
    for (let n = 1; n <= 2; n++)
      for (let r = n == 1 ? e : this.unplaced.openStart; r >= 0; r--) {
        let i, o = null;
        r ? (o = vc(this.unplaced.content, r - 1).firstChild, i = o.content) : i = this.unplaced.content;
        let s = i.firstChild;
        for (let l = this.depth; l >= 0; l--) {
          let { type: a, match: c } = this.frontier[l], u, h = null;
          if (n == 1 && (s ? c.matchType(s.type) || (h = c.fillBefore(T.from(s), !1)) : o && a.compatibleContent(o.type)))
            return { sliceDepth: r, frontierDepth: l, parent: o, inject: h };
          if (n == 2 && s && (u = c.findWrapping(s.type)))
            return { sliceDepth: r, frontierDepth: l, parent: o, wrap: u };
          if (o && c.matchType(o.type))
            break;
        }
      }
  }
  openMore() {
    let { content: e, openStart: n, openEnd: r } = this.unplaced;
    return Dc(e, -1) <= n ? !1 : (this.unplaced.size > 1 && Dc(e, 1) > r && r++, this.unplaced = new E(e, n + 1, r), !0);
  }
  dropNode() {
    let { content: e, openStart: n, openEnd: r } = this.unplaced, i = vc(e, n);
    if (i.childCount <= 1 && n > 0) {
      let o = e.size - n <= n + i.size;
      this.unplaced = new E(ir(e, n - 1, 1), n - 1, o ? n - 1 : r);
    } else
      this.unplaced = new E(ir(e, n, 1), n, r);
  }
  // Move content from the unplaced slice at `sliceDepth` to the
  // frontier node at `frontierDepth`. Close that frontier node when
  // applicable.
  placeNodes({ sliceDepth: e, frontierDepth: n, parent: r, inject: i, wrap: o }) {
    for (; this.depth > n; )
      this.closeFrontierNode();
    if (o)
      for (let m = 0; m < o.length; m++)
        this.openFrontierNode(o[m]);
    let s = this.unplaced, l = r ? r.content : s.content, a = s.openStart - e, c = 0, u = [], { match: h, type: d } = this.frontier[n];
    if (i) {
      for (let m = 0; m < i.childCount; m++)
        u.push(i.child(m));
      h = h.matchFragment(i);
    }
    let f = l.size + e - (s.content.size - s.openEnd);
    for (; c < l.childCount; ) {
      let m = l.child(c), y = h.matchType(m.type);
      if (!y)
        break;
      c++, (c > 1 || a == 0 || m.content.size) && (h = y, u.push(mf(m.mark(d.allowedMarks(m.marks)), c == 1 ? a : 0, c == l.childCount ? f : -1)));
    }
    let p = c == l.childCount;
    p || (f = -1), this.placed = or(this.placed, n, T.from(u)), this.frontier[n].match = h, p && f < 0 && r && r.type == this.frontier[this.depth].type && this.frontier.length > 1 && this.closeFrontierNode();
    for (let m = 0, y = l; m < f; m++) {
      let g = y.lastChild;
      this.frontier.push({ type: g.type, match: g.contentMatchAt(g.childCount) }), y = g.content;
    }
    this.unplaced = p ? e == 0 ? E.empty : new E(ir(s.content, e - 1, 1), e - 1, f < 0 ? s.openEnd : e - 1) : new E(ir(s.content, e, c), s.openStart, s.openEnd);
  }
  mustMoveInline() {
    if (!this.$to.parent.isTextblock)
      return -1;
    let e = this.frontier[this.depth], n;
    if (!e.type.isTextblock || !Mo(this.$to, this.$to.depth, e.type, e.match, !1) || this.$to.depth == this.depth && (n = this.findCloseLevel(this.$to)) && n.depth == this.depth)
      return -1;
    let { depth: r } = this.$to, i = this.$to.after(r);
    for (; r > 1 && i == this.$to.end(--r); )
      ++i;
    return i;
  }
  findCloseLevel(e) {
    e: for (let n = Math.min(this.depth, e.depth); n >= 0; n--) {
      let { match: r, type: i } = this.frontier[n], o = n < e.depth && e.end(n + 1) == e.pos + (e.depth - (n + 1)), s = Mo(e, n, i, r, o);
      if (s) {
        for (let l = n - 1; l >= 0; l--) {
          let { match: a, type: c } = this.frontier[l], u = Mo(e, l, c, a, !0);
          if (!u || u.childCount)
            continue e;
        }
        return { depth: n, fit: s, move: o ? e.doc.resolve(e.after(n + 1)) : e };
      }
    }
  }
  close(e) {
    let n = this.findCloseLevel(e);
    if (!n)
      return null;
    for (; this.depth > n.depth; )
      this.closeFrontierNode();
    n.fit.childCount && (this.placed = or(this.placed, n.depth, n.fit)), e = n.move;
    for (let r = n.depth + 1; r <= e.depth; r++) {
      let i = e.node(r), o = i.type.contentMatch.fillBefore(i.content, !0, e.index(r));
      this.openFrontierNode(i.type, i.attrs, o);
    }
    return e;
  }
  openFrontierNode(e, n = null, r) {
    let i = this.frontier[this.depth];
    i.match = i.match.matchType(e), this.placed = or(this.placed, this.depth, T.from(e.create(n, r))), this.frontier.push({ type: e, match: e.contentMatch });
  }
  closeFrontierNode() {
    let n = this.frontier.pop().match.fillBefore(T.empty, !0);
    n.childCount && (this.placed = or(this.placed, this.frontier.length, n));
  }
}
function ir(t, e, n) {
  return e == 0 ? t.cutByIndex(n, t.childCount) : t.replaceChild(0, t.firstChild.copy(ir(t.firstChild.content, e - 1, n)));
}
function or(t, e, n) {
  return e == 0 ? t.append(n) : t.replaceChild(t.childCount - 1, t.lastChild.copy(or(t.lastChild.content, e - 1, n)));
}
function vc(t, e) {
  for (let n = 0; n < e; n++)
    t = t.firstChild.content;
  return t;
}
function mf(t, e, n) {
  if (e <= 0)
    return t;
  let r = t.content;
  return e > 1 && (r = r.replaceChild(0, mf(r.firstChild, e - 1, r.childCount == 1 ? n - 1 : 0))), e > 0 && (r = t.type.contentMatch.fillBefore(r).append(r), n <= 0 && (r = r.append(t.type.contentMatch.matchFragment(r).fillBefore(T.empty, !0)))), t.copy(r);
}
function Mo(t, e, n, r, i) {
  let o = t.node(e), s = i ? t.indexAfter(e) : t.index(e);
  if (s == o.childCount && !n.compatibleContent(o.type))
    return null;
  let l = r.fillBefore(o.content, !0, s);
  return l && !h1(n, o.content, s) ? l : null;
}
function h1(t, e, n) {
  for (let r = n; r < e.childCount; r++)
    if (!t.allowsMarks(e.child(r).marks))
      return !0;
  return !1;
}
function f1(t) {
  return t.spec.defining || t.spec.definingForContent;
}
function Dc(t, e) {
  for (let n = 0; ; n++) {
    let r = e < 0 ? t.firstChild : t.lastChild;
    if (!r || r.isAtom)
      return n;
    t = r.content;
  }
}
function d1(t, e, n, r) {
  if (!r.size)
    return t.deleteRange(e, n);
  let i = t.doc.resolve(e), o = t.doc.resolve(n);
  if (pf(i, o, r))
    return t.step(new ie(e, n, r));
  let s = yf(i, o);
  s[s.length - 1] == 0 && s.pop();
  let l = -(i.depth + 1);
  s.unshift(l);
  for (let d = i.depth, f = i.pos - 1; d > 0; d--, f--) {
    let p = i.node(d).type.spec;
    if (p.defining || p.definingAsContext || p.isolating)
      break;
    s.indexOf(d) > -1 ? l = d : i.before(d) == f && s.splice(1, 0, -d);
  }
  let a = s.indexOf(l), c = [], u = r.openStart;
  for (let d = r.content, f = 0; ; f++) {
    let p = d.firstChild;
    if (c.push(p), f == r.openStart)
      break;
    d = p.content;
  }
  for (let d = u - 1; d >= 0; d--) {
    let f = c[d], p = f1(f.type);
    if (p && !f.sameMarkup(i.node(Math.abs(l) - 1)))
      u = d;
    else if (p || !f.type.isTextblock)
      break;
  }
  for (let d = r.openStart; d >= 0; d--) {
    let f = (d + u + 1) % (r.openStart + 1), p = c[f];
    if (p)
      for (let m = 0; m < s.length; m++) {
        let y = s[(m + a) % s.length], g = !0;
        y < 0 && (g = !1, y = -y);
        let N = i.node(y - 1), w = i.index(y - 1);
        if (N.canReplaceWith(w, w, p.type, p.marks))
          return t.replace(i.before(y), g ? o.after(y) : n, new E(gf(r.content, 0, r.openStart, f), f, r.openEnd));
      }
  }
  let h = t.steps.length;
  for (let d = s.length - 1; d >= 0 && (t.replace(e, n, r), !(t.steps.length > h)); d--) {
    let f = s[d];
    f < 0 || (e = i.before(f), n = o.after(f));
  }
}
function gf(t, e, n, r, i) {
  if (e < n) {
    let o = t.firstChild;
    t = t.replaceChild(0, o.copy(gf(o.content, e + 1, n, r, o)));
  }
  if (e > r) {
    let o = i.contentMatchAt(0), s = o.fillBefore(t).append(t);
    t = s.append(o.matchFragment(s).fillBefore(T.empty, !0));
  }
  return t;
}
function p1(t, e, n, r) {
  if (!r.isInline && e == n && t.doc.resolve(e).parent.content.size) {
    let i = a1(t.doc, e, r.type);
    i != null && (e = n = i);
  }
  t.replaceRange(e, n, new E(T.from(r), 0, 0));
}
function m1(t, e, n) {
  let r = t.doc.resolve(e), i = t.doc.resolve(n);
  if (r.parent.isTextblock && i.parent.isTextblock && r.start() != i.start() && r.parentOffset == 0 && i.parentOffset == 0) {
    let s = r.sharedDepth(n), l = !1;
    for (let a = r.depth; a > s; a--)
      r.node(a).type.spec.isolating && (l = !0);
    for (let a = i.depth; a > s; a--)
      i.node(a).type.spec.isolating && (l = !0);
    if (!l) {
      for (let a = r.depth; a > 0 && e == r.start(a); a--)
        e = r.before(a);
      for (let a = i.depth; a > 0 && n == i.start(a); a--)
        n = i.before(a);
      r = t.doc.resolve(e), i = t.doc.resolve(n);
    }
  }
  let o = yf(r, i);
  for (let s = 0; s < o.length; s++) {
    let l = o[s], a = s == o.length - 1;
    if (a && l == 0 || r.node(l).type.contentMatch.validEnd)
      return t.delete(r.start(l), i.end(l));
    if (l > 0 && (a || r.node(l - 1).canReplace(r.index(l - 1), i.indexAfter(l - 1))))
      return t.delete(r.before(l), i.after(l));
  }
  for (let s = 1; s <= r.depth && s <= i.depth; s++)
    if (e - r.start(s) == r.depth - s && n > r.end(s) && i.end(s) - n != i.depth - s && r.start(s - 1) == i.start(s - 1) && r.node(s - 1).canReplace(r.index(s - 1), i.index(s - 1)))
      return t.delete(r.before(s), n);
  t.delete(e, n);
}
function yf(t, e) {
  let n = [], r = Math.min(t.depth, e.depth);
  for (let i = r; i >= 0; i--) {
    let o = t.start(i);
    if (o < t.pos - (t.depth - i) || e.end(i) > e.pos + (e.depth - i) || t.node(i).type.spec.isolating || e.node(i).type.spec.isolating)
      break;
    (o == e.start(i) || i == t.depth && i == e.depth && t.parent.inlineContent && e.parent.inlineContent && i && e.start(i - 1) == o - 1) && n.push(i);
  }
  return n;
}
class vn extends we {
  /**
  Construct an attribute step.
  */
  constructor(e, n, r) {
    super(), this.pos = e, this.attr = n, this.value = r;
  }
  apply(e) {
    let n = e.nodeAt(this.pos);
    if (!n)
      return oe.fail("No node at attribute step's position");
    let r = /* @__PURE__ */ Object.create(null);
    for (let o in n.attrs)
      r[o] = n.attrs[o];
    r[this.attr] = this.value;
    let i = n.type.create(r, null, n.marks);
    return oe.fromReplace(e, this.pos, this.pos + 1, new E(T.from(i), 0, n.isLeaf ? 0 : 1));
  }
  getMap() {
    return ze.empty;
  }
  invert(e) {
    return new vn(this.pos, this.attr, e.nodeAt(this.pos).attrs[this.attr]);
  }
  map(e) {
    let n = e.mapResult(this.pos, 1);
    return n.deletedAfter ? null : new vn(n.pos, this.attr, this.value);
  }
  toJSON() {
    return { stepType: "attr", pos: this.pos, attr: this.attr, value: this.value };
  }
  static fromJSON(e, n) {
    if (typeof n.pos != "number" || typeof n.attr != "string")
      throw new RangeError("Invalid input for AttrStep.fromJSON");
    return new vn(n.pos, n.attr, n.value);
  }
}
we.jsonID("attr", vn);
class Tr extends we {
  /**
  Construct an attribute step.
  */
  constructor(e, n) {
    super(), this.attr = e, this.value = n;
  }
  apply(e) {
    let n = /* @__PURE__ */ Object.create(null);
    for (let i in e.attrs)
      n[i] = e.attrs[i];
    n[this.attr] = this.value;
    let r = e.type.create(n, e.content, e.marks);
    return oe.ok(r);
  }
  getMap() {
    return ze.empty;
  }
  invert(e) {
    return new Tr(this.attr, e.attrs[this.attr]);
  }
  map(e) {
    return this;
  }
  toJSON() {
    return { stepType: "docAttr", attr: this.attr, value: this.value };
  }
  static fromJSON(e, n) {
    if (typeof n.attr != "string")
      throw new RangeError("Invalid input for DocAttrStep.fromJSON");
    return new Tr(n.attr, n.value);
  }
}
we.jsonID("docAttr", Tr);
let zn = class extends Error {
};
zn = function t(e) {
  let n = Error.call(this, e);
  return n.__proto__ = t.prototype, n;
};
zn.prototype = Object.create(Error.prototype);
zn.prototype.constructor = zn;
zn.prototype.name = "TransformError";
class kf {
  /**
  Create a transform that starts with the given document.
  */
  constructor(e) {
    this.doc = e, this.steps = [], this.docs = [], this.mapping = new vi();
  }
  /**
  The starting document.
  */
  get before() {
    return this.docs.length ? this.docs[0] : this.doc;
  }
  /**
  Apply a new step in this transform, saving the result. Throws an
  error when the step fails.
  */
  step(e) {
    let n = this.maybeStep(e);
    if (n.failed)
      throw new zn(n.failed);
    return this;
  }
  /**
  Try to apply a step in this transformation, ignoring it if it
  fails. Returns the step result.
  */
  maybeStep(e) {
    let n = e.apply(this.doc);
    return n.failed || this.addStep(e, n.doc), n;
  }
  /**
  True when the document has been changed (when there are any
  steps).
  */
  get docChanged() {
    return this.steps.length > 0;
  }
  /**
  Return a single range, in post-transform document positions,
  that covers all content changed by this transform. Returns null
  if no replacements are made. Note that this will ignore changes
  that add/remove marks without replacing the underlying content.
  */
  changedRange() {
    let e = 1e9, n = -1e9;
    for (let r = 0; r < this.mapping.maps.length; r++) {
      let i = this.mapping.maps[r];
      r && (e = i.map(e, 1), n = i.map(n, -1)), i.forEach((o, s, l, a) => {
        e = Math.min(e, l), n = Math.max(n, a);
      });
    }
    return e == 1e9 ? null : { from: e, to: n };
  }
  /**
  @internal
  */
  addStep(e, n) {
    this.docs.push(this.doc), this.steps.push(e), this.mapping.appendMap(e.getMap()), this.doc = n;
  }
  /**
  Replace the part of the document between `from` and `to` with the
  given `slice`.
  */
  replace(e, n = e, r = E.empty) {
    let i = Xi(this.doc, e, n, r);
    return i && this.step(i), this;
  }
  /**
  Replace the given range with the given content, which may be a
  fragment, node, or array of nodes.
  */
  replaceWith(e, n, r) {
    return this.replace(e, n, new E(T.from(r), 0, 0));
  }
  /**
  Delete the content between the given positions.
  */
  delete(e, n) {
    return this.replace(e, n, E.empty);
  }
  /**
  Insert the given content at the given position.
  */
  insert(e, n) {
    return this.replaceWith(e, e, n);
  }
  /**
  Replace a range of the document with a given slice, using
  `from`, `to`, and the slice's
  [`openStart`](https://prosemirror.net/docs/ref/#model.Slice.openStart) property as hints, rather
  than fixed start and end points. This method may grow the
  replaced area or close open nodes in the slice in order to get a
  fit that is more in line with WYSIWYG expectations, by dropping
  fully covered parent nodes of the replaced region when they are
  marked [non-defining as
  context](https://prosemirror.net/docs/ref/#model.NodeSpec.definingAsContext), or including an
  open parent node from the slice that _is_ marked as [defining
  its content](https://prosemirror.net/docs/ref/#model.NodeSpec.definingForContent).
  
  This is the method, for example, to handle paste. The similar
  [`replace`](https://prosemirror.net/docs/ref/#transform.Transform.replace) method is a more
  primitive tool which will _not_ move the start and end of its given
  range, and is useful in situations where you need more precise
  control over what happens.
  */
  replaceRange(e, n, r) {
    return d1(this, e, n, r), this;
  }
  /**
  Replace the given range with a node, but use `from` and `to` as
  hints, rather than precise positions. When from and to are the same
  and are at the start or end of a parent node in which the given
  node doesn't fit, this method may _move_ them out towards a parent
  that does allow the given node to be placed. When the given range
  completely covers a parent node, this method may completely replace
  that parent node.
  */
  replaceRangeWith(e, n, r) {
    return p1(this, e, n, r), this;
  }
  /**
  Delete the given range, expanding it to cover fully covered
  parent nodes until a valid replace is found.
  */
  deleteRange(e, n) {
    return m1(this, e, n), this;
  }
  /**
  Split the content in the given range off from its parent, if there
  is sibling content before or after it, and move it up the tree to
  the depth specified by `target`. You'll probably want to use
  [`liftTarget`](https://prosemirror.net/docs/ref/#transform.liftTarget) to compute `target`, to make
  sure the lift is valid.
  */
  lift(e, n) {
    return Qb(this, e, n), this;
  }
  /**
  Join the blocks around the given position. If depth is 2, their
  last and first siblings are also joined, and so on.
  */
  join(e, n = 1) {
    return l1(this, e, n), this;
  }
  /**
  Wrap the given [range](https://prosemirror.net/docs/ref/#model.NodeRange) in the given set of wrappers.
  The wrappers are assumed to be valid in this position, and should
  probably be computed with [`findWrapping`](https://prosemirror.net/docs/ref/#transform.findWrapping).
  */
  wrap(e, n) {
    return e1(this, e, n), this;
  }
  /**
  Set the type of all textblocks (partly) between `from` and `to` to
  the given node type with the given attributes.
  */
  setBlockType(e, n = e, r, i = null) {
    return t1(this, e, n, r, i), this;
  }
  /**
  Change the type, attributes, and/or marks of the node at `pos`.
  When `type` isn't given, the existing node type is preserved,
  */
  setNodeMarkup(e, n, r = null, i) {
    return r1(this, e, n, r, i), this;
  }
  /**
  Set a single attribute on a given node to a new value.
  The `pos` addresses the document content. Use `setDocAttribute`
  to set attributes on the document itself.
  */
  setNodeAttribute(e, n, r) {
    return this.step(new vn(e, n, r)), this;
  }
  /**
  Set a single attribute on the document to a new value.
  */
  setDocAttribute(e, n) {
    return this.step(new Tr(e, n)), this;
  }
  /**
  Add a mark to the node at position `pos`.
  */
  addNodeMark(e, n) {
    return this.step(new _t(e, n)), this;
  }
  /**
  Remove a mark (or all marks of the given type) from the node at
  position `pos`.
  */
  removeNodeMark(e, n) {
    let r = this.doc.nodeAt(e);
    if (!r)
      throw new RangeError("No node at position " + e);
    if (n instanceof J)
      n.isInSet(r.marks) && this.step(new gn(e, n));
    else {
      let i = r.marks, o, s = [];
      for (; o = n.isInSet(i); )
        s.push(new gn(e, o)), i = o.removeFromSet(i);
      for (let l = s.length - 1; l >= 0; l--)
        this.step(s[l]);
    }
    return this;
  }
  /**
  Split the node at the given position, and optionally, if `depth` is
  greater than one, any number of nodes above that. By default, the
  parts split off will inherit the node type of the original node.
  This can be changed by passing an array of types and attributes to
  use after the split (with the outermost nodes coming first).
  */
  split(e, n = 1, r) {
    return i1(this, e, n, r), this;
  }
  /**
  Add the given mark to the inline content between `from` and `to`.
  */
  addMark(e, n, r) {
    return Jb(this, e, n, r), this;
  }
  /**
  Remove marks from inline nodes between `from` and `to`. When
  `mark` is a single mark, remove precisely that mark. When it is
  a mark type, remove all marks of that type. When it is null,
  remove all marks of any type.
  */
  removeMark(e, n, r) {
    return Gb(this, e, n, r), this;
  }
  /**
  Removes all marks and nodes from the content of the node at
  `pos` that don't match the given new parent node type. Accepts
  an optional starting [content match](https://prosemirror.net/docs/ref/#model.ContentMatch) as
  third argument.
  */
  clearIncompatible(e, n, r) {
    return fl(this, e, n, r), this;
  }
}
const To = /* @__PURE__ */ Object.create(null);
class $ {
  /**
  Initialize a selection with the head and anchor and ranges. If no
  ranges are given, constructs a single range across `$anchor` and
  `$head`.
  */
  constructor(e, n, r) {
    this.$anchor = e, this.$head = n, this.ranges = r || [new bf(e.min(n), e.max(n))];
  }
  /**
  The selection's anchor, as an unresolved position.
  */
  get anchor() {
    return this.$anchor.pos;
  }
  /**
  The selection's head.
  */
  get head() {
    return this.$head.pos;
  }
  /**
  The lower bound of the selection's main range.
  */
  get from() {
    return this.$from.pos;
  }
  /**
  The upper bound of the selection's main range.
  */
  get to() {
    return this.$to.pos;
  }
  /**
  The resolved lower  bound of the selection's main range.
  */
  get $from() {
    return this.ranges[0].$from;
  }
  /**
  The resolved upper bound of the selection's main range.
  */
  get $to() {
    return this.ranges[0].$to;
  }
  /**
  Indicates whether the selection contains any content.
  */
  get empty() {
    let e = this.ranges;
    for (let n = 0; n < e.length; n++)
      if (e[n].$from.pos != e[n].$to.pos)
        return !1;
    return !0;
  }
  /**
  Get the content of this selection as a slice.
  */
  content() {
    return this.$from.doc.slice(this.from, this.to, !0);
  }
  /**
  Replace the selection with a slice or, if no slice is given,
  delete the selection. Will append to the given transaction.
  */
  replace(e, n = E.empty) {
    let r = n.content.lastChild, i = null;
    for (let l = 0; l < n.openEnd; l++)
      i = r, r = r.lastChild;
    let o = e.steps.length, s = this.ranges;
    for (let l = 0; l < s.length; l++) {
      let { $from: a, $to: c } = s[l], u = e.mapping.slice(o);
      e.replaceRange(u.map(a.pos), u.map(c.pos), l ? E.empty : n), l == 0 && Pc(e, o, (r ? r.isInline : i && i.isTextblock) ? -1 : 1);
    }
  }
  /**
  Replace the selection with the given node, appending the changes
  to the given transaction.
  */
  replaceWith(e, n) {
    let r = e.steps.length, i = this.ranges;
    for (let o = 0; o < i.length; o++) {
      let { $from: s, $to: l } = i[o], a = e.mapping.slice(r), c = a.map(s.pos), u = a.map(l.pos);
      o ? e.deleteRange(c, u) : (e.replaceRangeWith(c, u, n), Pc(e, r, n.isInline ? -1 : 1));
    }
  }
  /**
  Find a valid cursor or leaf node selection starting at the given
  position and searching back if `dir` is negative, and forward if
  positive. When `textOnly` is true, only consider cursor
  selections. Will return null when no valid selection position is
  found.
  */
  static findFrom(e, n, r = !1) {
    let i = e.parent.inlineContent ? new V(e) : Tn(e.node(0), e.parent, e.pos, e.index(), n, r);
    if (i)
      return i;
    for (let o = e.depth - 1; o >= 0; o--) {
      let s = n < 0 ? Tn(e.node(0), e.node(o), e.before(o + 1), e.index(o), n, r) : Tn(e.node(0), e.node(o), e.after(o + 1), e.index(o) + 1, n, r);
      if (s)
        return s;
    }
    return null;
  }
  /**
  Find a valid cursor or leaf node selection near the given
  position. Searches forward first by default, but if `bias` is
  negative, it will search backwards first.
  */
  static near(e, n = 1) {
    return this.findFrom(e, n) || this.findFrom(e, -n) || new Le(e.node(0));
  }
  /**
  Find the cursor or leaf node selection closest to the start of
  the given document. Will return an
  [`AllSelection`](https://prosemirror.net/docs/ref/#state.AllSelection) if no valid position
  exists.
  */
  static atStart(e) {
    return Tn(e, e, 0, 0, 1) || new Le(e);
  }
  /**
  Find the cursor or leaf node selection closest to the end of the
  given document.
  */
  static atEnd(e) {
    return Tn(e, e, e.content.size, e.childCount, -1) || new Le(e);
  }
  /**
  Deserialize the JSON representation of a selection. Must be
  implemented for custom classes (as a static class method).
  */
  static fromJSON(e, n) {
    if (!n || !n.type)
      throw new RangeError("Invalid input for Selection.fromJSON");
    let r = To[n.type];
    if (!r)
      throw new RangeError(`No selection type ${n.type} defined`);
    return r.fromJSON(e, n);
  }
  /**
  To be able to deserialize selections from JSON, custom selection
  classes must register themselves with an ID string, so that they
  can be disambiguated. Try to pick something that's unlikely to
  clash with classes from other modules.
  */
  static jsonID(e, n) {
    if (e in To)
      throw new RangeError("Duplicate use of selection JSON ID " + e);
    return To[e] = n, n.prototype.jsonID = e, n;
  }
  /**
  Get a [bookmark](https://prosemirror.net/docs/ref/#state.SelectionBookmark) for this selection,
  which is a value that can be mapped without having access to a
  current document, and later resolved to a real selection for a
  given document again. (This is used mostly by the history to
  track and restore old selections.) The default implementation of
  this method just converts the selection to a text selection and
  returns the bookmark for that.
  */
  getBookmark() {
    return V.between(this.$anchor, this.$head).getBookmark();
  }
}
$.prototype.visible = !0;
class bf {
  /**
  Create a range.
  */
  constructor(e, n) {
    this.$from = e, this.$to = n;
  }
}
let Rc = !1;
function zc(t) {
  !Rc && !t.parent.inlineContent && (Rc = !0, console.warn("TextSelection endpoint not pointing into a node with inline content (" + t.parent.type.name + ")"));
}
class V extends $ {
  /**
  Construct a text selection between the given points.
  */
  constructor(e, n = e) {
    zc(e), zc(n), super(e, n);
  }
  /**
  Returns a resolved position if this is a cursor selection (an
  empty text selection), and null otherwise.
  */
  get $cursor() {
    return this.$anchor.pos == this.$head.pos ? this.$head : null;
  }
  map(e, n) {
    let r = e.resolve(n.map(this.head));
    if (!r.parent.inlineContent)
      return $.near(r);
    let i = e.resolve(n.map(this.anchor));
    return new V(i.parent.inlineContent ? i : r, r);
  }
  replace(e, n = E.empty) {
    if (super.replace(e, n), n == E.empty) {
      let r = this.$from.marksAcross(this.$to);
      r && e.ensureMarks(r);
    }
  }
  eq(e) {
    return e instanceof V && e.anchor == this.anchor && e.head == this.head;
  }
  getBookmark() {
    return new Zi(this.anchor, this.head);
  }
  toJSON() {
    return { type: "text", anchor: this.anchor, head: this.head };
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.anchor != "number" || typeof n.head != "number")
      throw new RangeError("Invalid input for TextSelection.fromJSON");
    return new V(e.resolve(n.anchor), e.resolve(n.head));
  }
  /**
  Create a text selection from non-resolved positions.
  */
  static create(e, n, r = n) {
    let i = e.resolve(n);
    return new this(i, r == n ? i : e.resolve(r));
  }
  /**
  Return a text selection that spans the given positions or, if
  they aren't text positions, find a text selection near them.
  `bias` determines whether the method searches forward (default)
  or backwards (negative number) first. Will fall back to calling
  [`Selection.near`](https://prosemirror.net/docs/ref/#state.Selection^near) when the document
  doesn't contain a valid text position.
  */
  static between(e, n, r) {
    let i = e.pos - n.pos;
    if ((!r || i) && (r = i >= 0 ? 1 : -1), !n.parent.inlineContent) {
      let o = $.findFrom(n, r, !0) || $.findFrom(n, -r, !0);
      if (o)
        n = o.$head;
      else
        return $.near(n, r);
    }
    return e.parent.inlineContent || (i == 0 ? e = n : (e = ($.findFrom(e, -r, !0) || $.findFrom(e, r, !0)).$anchor, e.pos < n.pos != i < 0 && (e = n))), new V(e, n);
  }
}
$.jsonID("text", V);
class Zi {
  constructor(e, n) {
    this.anchor = e, this.head = n;
  }
  map(e) {
    return new Zi(e.map(this.anchor), e.map(this.head));
  }
  resolve(e) {
    return V.between(e.resolve(this.anchor), e.resolve(this.head));
  }
}
class _ extends $ {
  /**
  Create a node selection. Does not verify the validity of its
  argument.
  */
  constructor(e) {
    let n = e.nodeAfter, r = e.node(0).resolve(e.pos + n.nodeSize);
    super(e, r), this.node = n;
  }
  map(e, n) {
    let { deleted: r, pos: i } = n.mapResult(this.anchor), o = e.resolve(i);
    return r ? $.near(o) : new _(o);
  }
  content() {
    return new E(T.from(this.node), 0, 0);
  }
  eq(e) {
    return e instanceof _ && e.anchor == this.anchor;
  }
  toJSON() {
    return { type: "node", anchor: this.anchor };
  }
  getBookmark() {
    return new pl(this.anchor);
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.anchor != "number")
      throw new RangeError("Invalid input for NodeSelection.fromJSON");
    return new _(e.resolve(n.anchor));
  }
  /**
  Create a node selection from non-resolved positions.
  */
  static create(e, n) {
    return new _(e.resolve(n));
  }
  /**
  Determines whether the given node may be selected as a node
  selection.
  */
  static isSelectable(e) {
    return !e.isText && e.type.spec.selectable !== !1;
  }
}
_.prototype.visible = !1;
$.jsonID("node", _);
class pl {
  constructor(e) {
    this.anchor = e;
  }
  map(e) {
    let { deleted: n, pos: r } = e.mapResult(this.anchor);
    return n ? new Zi(r, r) : new pl(r);
  }
  resolve(e) {
    let n = e.resolve(this.anchor), r = n.nodeAfter;
    return r && _.isSelectable(r) ? new _(n) : $.near(n);
  }
}
class Le extends $ {
  /**
  Create an all-selection over the given document.
  */
  constructor(e) {
    super(e.resolve(0), e.resolve(e.content.size));
  }
  replace(e, n = E.empty) {
    if (n == E.empty) {
      e.delete(0, e.doc.content.size);
      let r = $.atStart(e.doc);
      r.eq(e.selection) || e.setSelection(r);
    } else
      super.replace(e, n);
  }
  toJSON() {
    return { type: "all" };
  }
  /**
  @internal
  */
  static fromJSON(e) {
    return new Le(e);
  }
  map(e) {
    return new Le(e);
  }
  eq(e) {
    return e instanceof Le;
  }
  getBookmark() {
    return g1;
  }
}
$.jsonID("all", Le);
const g1 = {
  map() {
    return this;
  },
  resolve(t) {
    return new Le(t);
  }
};
function Tn(t, e, n, r, i, o = !1) {
  if (e.inlineContent)
    return V.create(t, n);
  for (let s = r - (i > 0 ? 0 : 1); i > 0 ? s < e.childCount : s >= 0; s += i) {
    let l = e.child(s);
    if (l.isAtom) {
      if (!o && _.isSelectable(l))
        return _.create(t, n - (i < 0 ? l.nodeSize : 0));
    } else {
      let a = Tn(t, l, n + i, i < 0 ? l.childCount : 0, i, o);
      if (a)
        return a;
    }
    n += l.nodeSize * i;
  }
  return null;
}
function Pc(t, e, n) {
  let r = t.steps.length - 1;
  if (r < e)
    return;
  let i = t.steps[r];
  if (!(i instanceof ie || i instanceof be))
    return;
  let o = t.mapping.maps[r], s;
  o.forEach((l, a, c, u) => {
    s == null && (s = u);
  }), t.setSelection($.near(t.doc.resolve(s), n));
}
const Lc = 1, ri = 2, Bc = 4;
class y1 extends kf {
  /**
  @internal
  */
  constructor(e) {
    super(e.doc), this.curSelectionFor = 0, this.updated = 0, this.meta = /* @__PURE__ */ Object.create(null), this.time = Date.now(), this.curSelection = e.selection, this.storedMarks = e.storedMarks;
  }
  /**
  The transaction's current selection. This defaults to the editor
  selection [mapped](https://prosemirror.net/docs/ref/#state.Selection.map) through the steps in the
  transaction, but can be overwritten with
  [`setSelection`](https://prosemirror.net/docs/ref/#state.Transaction.setSelection).
  */
  get selection() {
    return this.curSelectionFor < this.steps.length && (this.curSelection = this.curSelection.map(this.doc, this.mapping.slice(this.curSelectionFor)), this.curSelectionFor = this.steps.length), this.curSelection;
  }
  /**
  Update the transaction's current selection. Will determine the
  selection that the editor gets when the transaction is applied.
  */
  setSelection(e) {
    if (e.$from.doc != this.doc)
      throw new RangeError("Selection passed to setSelection must point at the current document");
    return this.curSelection = e, this.curSelectionFor = this.steps.length, this.updated = (this.updated | Lc) & ~ri, this.storedMarks = null, this;
  }
  /**
  Whether the selection was explicitly updated by this transaction.
  */
  get selectionSet() {
    return (this.updated & Lc) > 0;
  }
  /**
  Set the current stored marks.
  */
  setStoredMarks(e) {
    return this.storedMarks = e, this.updated |= ri, this;
  }
  /**
  Make sure the current stored marks or, if that is null, the marks
  at the selection, match the given set of marks. Does nothing if
  this is already the case.
  */
  ensureMarks(e) {
    return J.sameSet(this.storedMarks || this.selection.$from.marks(), e) || this.setStoredMarks(e), this;
  }
  /**
  Add a mark to the set of stored marks.
  */
  addStoredMark(e) {
    return this.ensureMarks(e.addToSet(this.storedMarks || this.selection.$head.marks()));
  }
  /**
  Remove a mark or mark type from the set of stored marks.
  */
  removeStoredMark(e) {
    return this.ensureMarks(e.removeFromSet(this.storedMarks || this.selection.$head.marks()));
  }
  /**
  Whether the stored marks were explicitly set for this transaction.
  */
  get storedMarksSet() {
    return (this.updated & ri) > 0;
  }
  /**
  @internal
  */
  addStep(e, n) {
    super.addStep(e, n), this.updated = this.updated & ~ri, this.storedMarks = null;
  }
  /**
  Update the timestamp for the transaction.
  */
  setTime(e) {
    return this.time = e, this;
  }
  /**
  Replace the current selection with the given slice.
  */
  replaceSelection(e) {
    return this.selection.replace(this, e), this;
  }
  /**
  Replace the selection with the given node. When `inheritMarks` is
  true and the content is inline, it inherits the marks from the
  place where it is inserted.
  */
  replaceSelectionWith(e, n = !0) {
    let r = this.selection;
    return n && (e = e.mark(this.storedMarks || (r.empty ? r.$from.marks() : r.$from.marksAcross(r.$to) || J.none))), r.replaceWith(this, e), this;
  }
  /**
  Delete the selection.
  */
  deleteSelection() {
    return this.selection.replace(this), this;
  }
  /**
  Replace the given range, or the selection if no range is given,
  with a text node containing the given string.
  */
  insertText(e, n, r) {
    let i = this.doc.type.schema;
    if (n == null)
      return e ? this.replaceSelectionWith(i.text(e), !0) : this.deleteSelection();
    {
      if (r == null && (r = n), !e)
        return this.deleteRange(n, r);
      let o = this.storedMarks;
      if (!o) {
        let s = this.doc.resolve(n);
        o = r == n ? s.marks() : s.marksAcross(this.doc.resolve(r));
      }
      return this.replaceRangeWith(n, r, i.text(e, o)), !this.selection.empty && this.selection.to == n + e.length && this.setSelection($.near(this.selection.$to)), this;
    }
  }
  /**
  Store a metadata property in this transaction, keyed either by
  name or by plugin.
  */
  setMeta(e, n) {
    return this.meta[typeof e == "string" ? e : e.key] = n, this;
  }
  /**
  Retrieve a metadata property for a given name or plugin.
  */
  getMeta(e) {
    return this.meta[typeof e == "string" ? e : e.key];
  }
  /**
  Returns true if this transaction doesn't contain any metadata,
  and can thus safely be extended.
  */
  get isGeneric() {
    for (let e in this.meta)
      return !1;
    return !0;
  }
  /**
  Indicate that the editor should scroll the selection into view
  when updated to the state produced by this transaction.
  */
  scrollIntoView() {
    return this.updated |= Bc, this;
  }
  /**
  True when this transaction has had `scrollIntoView` called on it.
  */
  get scrolledIntoView() {
    return (this.updated & Bc) > 0;
  }
}
function Fc(t, e) {
  return !e || !t ? t : t.bind(e);
}
class sr {
  constructor(e, n, r) {
    this.name = e, this.init = Fc(n.init, r), this.apply = Fc(n.apply, r);
  }
}
const k1 = [
  new sr("doc", {
    init(t) {
      return t.doc || t.schema.topNodeType.createAndFill();
    },
    apply(t) {
      return t.doc;
    }
  }),
  new sr("selection", {
    init(t, e) {
      return t.selection || $.atStart(e.doc);
    },
    apply(t) {
      return t.selection;
    }
  }),
  new sr("storedMarks", {
    init(t) {
      return t.storedMarks || null;
    },
    apply(t, e, n, r) {
      return r.selection.$cursor ? t.storedMarks : null;
    }
  }),
  new sr("scrollToSelection", {
    init() {
      return 0;
    },
    apply(t, e) {
      return t.scrolledIntoView ? e + 1 : e;
    }
  })
];
class Ao {
  constructor(e, n) {
    this.schema = e, this.plugins = [], this.pluginsByKey = /* @__PURE__ */ Object.create(null), this.fields = k1.slice(), n && n.forEach((r) => {
      if (this.pluginsByKey[r.key])
        throw new RangeError("Adding different instances of a keyed plugin (" + r.key + ")");
      this.plugins.push(r), this.pluginsByKey[r.key] = r, r.spec.state && this.fields.push(new sr(r.key, r.spec.state, r));
    });
  }
}
class rn {
  /**
  @internal
  */
  constructor(e) {
    this.config = e;
  }
  /**
  The schema of the state's document.
  */
  get schema() {
    return this.config.schema;
  }
  /**
  The plugins that are active in this state.
  */
  get plugins() {
    return this.config.plugins;
  }
  /**
  Apply the given transaction to produce a new state.
  */
  apply(e) {
    return this.applyTransaction(e).state;
  }
  /**
  @internal
  */
  filterTransaction(e, n = -1) {
    for (let r = 0; r < this.config.plugins.length; r++)
      if (r != n) {
        let i = this.config.plugins[r];
        if (i.spec.filterTransaction && !i.spec.filterTransaction.call(i, e, this))
          return !1;
      }
    return !0;
  }
  /**
  Verbose variant of [`apply`](https://prosemirror.net/docs/ref/#state.EditorState.apply) that
  returns the precise transactions that were applied (which might
  be influenced by the [transaction
  hooks](https://prosemirror.net/docs/ref/#state.PluginSpec.filterTransaction) of
  plugins) along with the new state.
  */
  applyTransaction(e) {
    if (!this.filterTransaction(e))
      return { state: this, transactions: [] };
    let n = [e], r = this.applyInner(e), i = null;
    for (; ; ) {
      let o = !1;
      for (let s = 0; s < this.config.plugins.length; s++) {
        let l = this.config.plugins[s];
        if (l.spec.appendTransaction) {
          let a = i ? i[s].n : 0, c = i ? i[s].state : this, u = a < n.length && l.spec.appendTransaction.call(l, a ? n.slice(a) : n, c, r);
          if (u && r.filterTransaction(u, s)) {
            if (u.setMeta("appendedTransaction", e), !i) {
              i = [];
              for (let h = 0; h < this.config.plugins.length; h++)
                i.push(h < s ? { state: r, n: n.length } : { state: this, n: 0 });
            }
            n.push(u), r = r.applyInner(u), o = !0;
          }
          i && (i[s] = { state: r, n: n.length });
        }
      }
      if (!o)
        return { state: r, transactions: n };
    }
  }
  /**
  @internal
  */
  applyInner(e) {
    if (!e.before.eq(this.doc))
      throw new RangeError("Applying a mismatched transaction");
    let n = new rn(this.config), r = this.config.fields;
    for (let i = 0; i < r.length; i++) {
      let o = r[i];
      n[o.name] = o.apply(e, this[o.name], this, n);
    }
    return n;
  }
  /**
  Accessor that constructs and returns a new [transaction](https://prosemirror.net/docs/ref/#state.Transaction) from this state.
  */
  get tr() {
    return new y1(this);
  }
  /**
  Create a new state.
  */
  static create(e) {
    let n = new Ao(e.doc ? e.doc.type.schema : e.schema, e.plugins), r = new rn(n);
    for (let i = 0; i < n.fields.length; i++)
      r[n.fields[i].name] = n.fields[i].init(e, r);
    return r;
  }
  /**
  Create a new state based on this one, but with an adjusted set
  of active plugins. State fields that exist in both sets of
  plugins are kept unchanged. Those that no longer exist are
  dropped, and those that are new are initialized using their
  [`init`](https://prosemirror.net/docs/ref/#state.StateField.init) method, passing in the new
  configuration object..
  */
  reconfigure(e) {
    let n = new Ao(this.schema, e.plugins), r = n.fields, i = new rn(n);
    for (let o = 0; o < r.length; o++) {
      let s = r[o].name;
      i[s] = this.hasOwnProperty(s) ? this[s] : r[o].init(e, i);
    }
    return i;
  }
  /**
  Serialize this state to JSON. If you want to serialize the state
  of plugins, pass an object mapping property names to use in the
  resulting JSON object to plugin objects. The argument may also be
  a string or number, in which case it is ignored, to support the
  way `JSON.stringify` calls `toString` methods.
  */
  toJSON(e) {
    let n = { doc: this.doc.toJSON(), selection: this.selection.toJSON() };
    if (this.storedMarks && (n.storedMarks = this.storedMarks.map((r) => r.toJSON())), e && typeof e == "object")
      for (let r in e) {
        if (r == "doc" || r == "selection")
          throw new RangeError("The JSON fields `doc` and `selection` are reserved");
        let i = e[r], o = i.spec.state;
        o && o.toJSON && (n[r] = o.toJSON.call(i, this[i.key]));
      }
    return n;
  }
  /**
  Deserialize a JSON representation of a state. `config` should
  have at least a `schema` field, and should contain array of
  plugins to initialize the state with. `pluginFields` can be used
  to deserialize the state of plugins, by associating plugin
  instances with the property names they use in the JSON object.
  */
  static fromJSON(e, n, r) {
    if (!n)
      throw new RangeError("Invalid input for EditorState.fromJSON");
    if (!e.schema)
      throw new RangeError("Required config field 'schema' missing");
    let i = new Ao(e.schema, e.plugins), o = new rn(i);
    return i.fields.forEach((s) => {
      if (s.name == "doc")
        o.doc = He.fromJSON(e.schema, n.doc);
      else if (s.name == "selection")
        o.selection = $.fromJSON(o.doc, n.selection);
      else if (s.name == "storedMarks")
        n.storedMarks && (o.storedMarks = n.storedMarks.map(e.schema.markFromJSON));
      else {
        if (r)
          for (let l in r) {
            let a = r[l], c = a.spec.state;
            if (a.key == s.name && c && c.fromJSON && Object.prototype.hasOwnProperty.call(n, l)) {
              o[s.name] = c.fromJSON.call(a, e, n[l], o);
              return;
            }
          }
        o[s.name] = s.init(e, o);
      }
    }), o;
  }
}
function xf(t, e, n) {
  for (let r in t) {
    let i = t[r];
    i instanceof Function ? i = i.bind(e) : r == "handleDOMEvents" && (i = xf(i, e, {})), n[r] = i;
  }
  return n;
}
class Oe {
  /**
  Create a plugin.
  */
  constructor(e) {
    this.spec = e, this.props = {}, e.props && xf(e.props, this, this.props), this.key = e.key ? e.key.key : wf("plugin");
  }
  /**
  Extract the plugin's state field from an editor state.
  */
  getState(e) {
    return e[this.key];
  }
}
const Io = /* @__PURE__ */ Object.create(null);
function wf(t) {
  return t in Io ? t + "$" + ++Io[t] : (Io[t] = 0, t + "$");
}
class ve {
  /**
  Create a plugin key.
  */
  constructor(e = "key") {
    this.key = wf(e);
  }
  /**
  Get the active plugin with this key, if any, from an editor
  state.
  */
  get(e) {
    return e.config.pluginsByKey[this.key];
  }
  /**
  Get the plugin's state from an editor state.
  */
  getState(e) {
    return e[this.key];
  }
}
const ml = (t, e) => t.selection.empty ? !1 : (e && e(t.tr.deleteSelection().scrollIntoView()), !0);
function Cf(t, e) {
  let { $cursor: n } = t.selection;
  return !n || (e ? !e.endOfTextblock("backward", t) : n.parentOffset > 0) ? null : n;
}
const Sf = (t, e, n) => {
  let r = Cf(t, n);
  if (!r)
    return !1;
  let i = gl(r);
  if (!i) {
    let s = r.blockRange(), l = s && Yi(s);
    return l == null ? !1 : (e && e(t.tr.lift(s, l).scrollIntoView()), !0);
  }
  let o = i.nodeBefore;
  if (Tf(t, i, e, -1))
    return !0;
  if (r.parent.content.size == 0 && (Pn(o, "end") || _.isSelectable(o)))
    for (let s = r.depth; ; s--) {
      let l = Xi(t.doc, r.before(s), r.after(s), E.empty);
      if (l && l.slice.size < l.to - l.from) {
        if (e) {
          let a = t.tr.step(l);
          a.setSelection(Pn(o, "end") ? $.findFrom(a.doc.resolve(a.mapping.map(i.pos, -1)), -1) : _.create(a.doc, i.pos - o.nodeSize)), e(a.scrollIntoView());
        }
        return !0;
      }
      if (s == 1 || r.node(s - 1).childCount > 1)
        break;
    }
  return o.isAtom && i.depth == r.depth - 1 ? (e && e(t.tr.delete(i.pos - o.nodeSize, i.pos).scrollIntoView()), !0) : !1;
}, b1 = (t, e, n) => {
  let r = Cf(t, n);
  if (!r)
    return !1;
  let i = gl(r);
  return i ? x1(t, i, e) : !1;
};
function x1(t, e, n) {
  let r = e.nodeBefore, i = r, o = e.pos - 1;
  for (; !i.isTextblock; o--) {
    if (i.type.spec.isolating)
      return !1;
    let u = i.lastChild;
    if (!u)
      return !1;
    i = u;
  }
  let s = e.nodeAfter, l = s, a = e.pos + 1;
  for (; !l.isTextblock; a++) {
    if (l.type.spec.isolating)
      return !1;
    let u = l.firstChild;
    if (!u)
      return !1;
    l = u;
  }
  let c = Xi(t.doc, o, a, E.empty);
  if (!c || c.from != o || c instanceof ie && c.slice.size >= a - o)
    return !1;
  if (n) {
    let u = t.tr.step(c);
    u.setSelection(V.create(u.doc, o)), n(u.scrollIntoView());
  }
  return !0;
}
function Pn(t, e, n = !1) {
  for (let r = t; r; r = e == "start" ? r.firstChild : r.lastChild) {
    if (r.isTextblock)
      return !0;
    if (n && r.childCount != 1)
      return !1;
  }
  return !1;
}
const Nf = (t, e, n) => {
  let { $head: r, empty: i } = t.selection, o = r;
  if (!i)
    return !1;
  if (r.parent.isTextblock) {
    if (n ? !n.endOfTextblock("backward", t) : r.parentOffset > 0)
      return !1;
    o = gl(r);
  }
  let s = o && o.nodeBefore;
  return !s || !_.isSelectable(s) ? !1 : (e && e(t.tr.setSelection(_.create(t.doc, o.pos - s.nodeSize)).scrollIntoView()), !0);
};
function gl(t) {
  if (!t.parent.type.spec.isolating)
    for (let e = t.depth - 1; e >= 0; e--) {
      if (t.index(e) > 0)
        return t.doc.resolve(t.before(e + 1));
      if (t.node(e).type.spec.isolating)
        break;
    }
  return null;
}
function w1(t, e) {
  let { $cursor: n } = t.selection;
  return !n || (e ? !e.endOfTextblock("forward", t) : n.parentOffset < n.parent.content.size) ? null : n;
}
const C1 = (t, e, n) => {
  let r = w1(t, n);
  if (!r)
    return !1;
  let i = Mf(r);
  if (!i)
    return !1;
  let o = i.nodeAfter;
  if (Tf(t, i, e, 1))
    return !0;
  if (r.parent.content.size == 0 && (Pn(o, "start") || _.isSelectable(o))) {
    let s = Xi(t.doc, r.before(), r.after(), E.empty);
    if (s && s.slice.size < s.to - s.from) {
      if (e) {
        let l = t.tr.step(s);
        l.setSelection(Pn(o, "start") ? $.findFrom(l.doc.resolve(l.mapping.map(i.pos)), 1) : _.create(l.doc, l.mapping.map(i.pos))), e(l.scrollIntoView());
      }
      return !0;
    }
  }
  return o.isAtom && i.depth == r.depth - 1 ? (e && e(t.tr.delete(i.pos, i.pos + o.nodeSize).scrollIntoView()), !0) : !1;
}, S1 = (t, e, n) => {
  let { $head: r, empty: i } = t.selection, o = r;
  if (!i)
    return !1;
  if (r.parent.isTextblock) {
    if (n ? !n.endOfTextblock("forward", t) : r.parentOffset < r.parent.content.size)
      return !1;
    o = Mf(r);
  }
  let s = o && o.nodeAfter;
  return !s || !_.isSelectable(s) ? !1 : (e && e(t.tr.setSelection(_.create(t.doc, o.pos)).scrollIntoView()), !0);
};
function Mf(t) {
  if (!t.parent.type.spec.isolating)
    for (let e = t.depth - 1; e >= 0; e--) {
      let n = t.node(e);
      if (t.index(e) + 1 < n.childCount)
        return t.doc.resolve(t.after(e + 1));
      if (n.type.spec.isolating)
        break;
    }
  return null;
}
const N1 = (t, e) => {
  let { $head: n, $anchor: r } = t.selection;
  return !n.parent.type.spec.code || !n.sameParent(r) ? !1 : (e && e(t.tr.insertText(`
`).scrollIntoView()), !0);
};
function yl(t) {
  for (let e = 0; e < t.edgeCount; e++) {
    let { type: n } = t.edge(e);
    if (n.isTextblock && !n.hasRequiredAttrs())
      return n;
  }
  return null;
}
const M1 = (t, e) => {
  let { $head: n, $anchor: r } = t.selection;
  if (!n.parent.type.spec.code || !n.sameParent(r))
    return !1;
  let i = n.node(-1), o = n.indexAfter(-1), s = yl(i.contentMatchAt(o));
  if (!s || !i.canReplaceWith(o, o, s))
    return !1;
  if (e) {
    let l = n.after(), a = t.tr.replaceWith(l, l, s.createAndFill());
    a.setSelection($.near(a.doc.resolve(l), 1)), e(a.scrollIntoView());
  }
  return !0;
}, T1 = (t, e) => {
  let n = t.selection, { $from: r, $to: i } = n;
  if (n instanceof Le || r.parent.inlineContent || i.parent.inlineContent)
    return !1;
  let o = yl(i.parent.contentMatchAt(i.indexAfter()));
  if (!o || !o.isTextblock)
    return !1;
  if (e) {
    let s = (!r.parentOffset && i.index() < i.parent.childCount ? r : i).pos, l = t.tr.insert(s, o.createAndFill());
    l.setSelection(V.create(l.doc, s + 1)), e(l.scrollIntoView());
  }
  return !0;
}, A1 = (t, e) => {
  let { $cursor: n } = t.selection;
  if (!n || n.parent.content.size)
    return !1;
  if (n.depth > 1 && n.after() != n.end(-1)) {
    let o = n.before();
    if (dr(t.doc, o))
      return e && e(t.tr.split(o).scrollIntoView()), !0;
  }
  let r = n.blockRange(), i = r && Yi(r);
  return i == null ? !1 : (e && e(t.tr.lift(r, i).scrollIntoView()), !0);
};
function I1(t) {
  return (e, n) => {
    if (e.selection instanceof _ && e.selection.node.isBlock) {
      let { $from: f } = e.selection;
      return !f.parentOffset || !dr(e.doc, f.pos) ? !1 : (n && n(e.tr.split(f.pos).scrollIntoView()), !0);
    }
    if (!e.selection.$from.depth)
      return !1;
    let r = e.tr;
    !e.selection.empty && (e.selection instanceof V || e.selection instanceof Le) && r.deleteSelection();
    let { $from: i } = r.selection, o = r.steps.length, s = [], l, a, c = !1, u = !1;
    for (let f = i.depth; ; f--)
      if (i.node(f).isBlock) {
        c = i.end(f) == i.pos + (i.depth - f), u = i.start(f) == i.pos - (i.depth - f), a = yl(i.node(f - 1).contentMatchAt(i.indexAfter(f - 1))), s.unshift(c && a ? { type: a } : null), l = f;
        break;
      } else {
        if (f == 1)
          return !1;
        s.unshift(null);
      }
    let h = i.pos, d = dr(r.doc, h, s.length, s);
    if (d || (s[0] = a ? { type: a } : null, d = dr(r.doc, h, s.length, s)), !d)
      return !1;
    if (r.split(h, s.length, s), !c && u && i.node(l).type != a) {
      let f = r.mapping.slice(o), p = f.map(i.before(l)), m = r.doc.resolve(p);
      a && i.node(l - 1).canReplaceWith(m.index(), m.index() + 1, a) && r.setNodeMarkup(f.map(i.before(l)), a);
    }
    return n && n(r.scrollIntoView()), !0;
  };
}
const E1 = I1(), O1 = (t, e) => (e && e(t.tr.setSelection(new Le(t.doc))), !0);
function v1(t, e, n) {
  let r = e.nodeBefore, i = e.nodeAfter, o = e.index();
  return !r || !i || !r.type.compatibleContent(i.type) ? !1 : !r.content.size && e.parent.canReplace(o - 1, o) ? (n && n(t.tr.delete(e.pos - r.nodeSize, e.pos).scrollIntoView()), !0) : !e.parent.canReplace(o, o + 1) || !(i.isTextblock || Qi(t.doc, e.pos)) ? !1 : (n && n(t.tr.join(e.pos).scrollIntoView()), !0);
}
function Tf(t, e, n, r) {
  let i = e.nodeBefore, o = e.nodeAfter, s, l, a = i.type.spec.isolating || o.type.spec.isolating;
  if (!a && v1(t, e, n))
    return !0;
  let c = !a && e.parent.canReplace(e.index(), e.index() + 1);
  if (c && (s = (l = i.contentMatchAt(i.childCount)).findWrapping(o.type)) && l.matchType(s[0] || o.type).validEnd) {
    if (n) {
      let f = e.pos + o.nodeSize, p = T.empty;
      for (let g = s.length - 1; g >= 0; g--)
        p = T.from(s[g].create(null, p));
      p = T.from(i.copy(p));
      let m = t.tr.step(new be(e.pos - 1, f, e.pos, f, new E(p, 1, 0), s.length, !0)), y = m.doc.resolve(f + 2 * s.length);
      y.nodeAfter && y.nodeAfter.type == i.type && Qi(m.doc, y.pos) && m.join(y.pos), n(m.scrollIntoView());
    }
    return !0;
  }
  let u = o.type.spec.isolating || r > 0 && a ? null : $.findFrom(e, 1), h = u && u.$from.blockRange(u.$to), d = h && Yi(h);
  if (d != null && d >= e.depth)
    return n && n(t.tr.lift(h, d).scrollIntoView()), !0;
  if (c && Pn(o, "start", !0) && Pn(i, "end")) {
    let f = i, p = [];
    for (; p.push(f), !f.isTextblock; )
      f = f.lastChild;
    let m = o, y = 1;
    for (; !m.isTextblock; m = m.firstChild)
      y++;
    if (f.canReplace(f.childCount, f.childCount, m.content)) {
      if (n) {
        let g = T.empty;
        for (let w = p.length - 1; w >= 0; w--)
          g = T.from(p[w].copy(g));
        let N = t.tr.step(new be(e.pos - p.length, e.pos + o.nodeSize, e.pos + y, e.pos + o.nodeSize - y, new E(g, p.length, 0), 0, !0));
        n(N.scrollIntoView());
      }
      return !0;
    }
  }
  return !1;
}
function Af(t) {
  return function(e, n) {
    let r = e.selection, i = t < 0 ? r.$from : r.$to, o = i.depth;
    for (; i.node(o).isInline; ) {
      if (!o)
        return !1;
      o--;
    }
    return i.node(o).isTextblock ? (n && n(e.tr.setSelection(V.create(e.doc, t < 0 ? i.start(o) : i.end(o)))), !0) : !1;
  };
}
const D1 = Af(-1), R1 = Af(1);
function kl(t, e = null) {
  return function(n, r) {
    let { $from: i, $to: o } = n.selection, s = i.blockRange(o), l = s && dl(s, t, e);
    return l ? (r && r(n.tr.wrap(s, l).scrollIntoView()), !0) : !1;
  };
}
function Ar(t, e = null) {
  return function(n, r) {
    let i = !1;
    for (let o = 0; o < n.selection.ranges.length && !i; o++) {
      let { $from: { pos: s }, $to: { pos: l } } = n.selection.ranges[o];
      n.doc.nodesBetween(s, l, (a, c) => {
        if (i)
          return !1;
        if (!(!a.isTextblock || a.hasMarkup(t, e)))
          if (a.type == t)
            i = !0;
          else {
            let u = n.doc.resolve(c), h = u.index();
            i = u.parent.canReplaceWith(h, h + 1, t);
          }
      });
    }
    if (!i)
      return !1;
    if (r) {
      let o = n.tr;
      for (let s = 0; s < n.selection.ranges.length; s++) {
        let { $from: { pos: l }, $to: { pos: a } } = n.selection.ranges[s];
        o.setBlockType(l, a, t, e);
      }
      r(o.scrollIntoView());
    }
    return !0;
  };
}
function z1(t, e, n, r) {
  for (let i = 0; i < e.length; i++) {
    let { $from: o, $to: s } = e[i], l = o.depth == 0 ? t.inlineContent && t.type.allowsMarkType(n) : !1;
    if (t.nodesBetween(o.pos, s.pos, (a, c) => {
      if (l)
        return !1;
      l = a.inlineContent && a.type.allowsMarkType(n);
    }), l)
      return !0;
  }
  return !1;
}
function eo(t, e = null, n) {
  return function(r, i) {
    let { empty: o, $cursor: s, ranges: l } = r.selection;
    if (o && !s || !z1(r.doc, l, t))
      return !1;
    if (i)
      if (s)
        t.isInSet(r.storedMarks || s.marks()) ? i(r.tr.removeStoredMark(t)) : i(r.tr.addStoredMark(t.create(e)));
      else {
        let a, c = r.tr;
        a = !l.some((u) => r.doc.rangeHasMark(u.$from.pos, u.$to.pos, t));
        for (let u = 0; u < l.length; u++) {
          let { $from: h, $to: d } = l[u];
          if (!a)
            c.removeMark(h.pos, d.pos, t);
          else {
            let f = h.pos, p = d.pos, m = h.nodeAfter, y = d.nodeBefore, g = m && m.isText ? /^\s*/.exec(m.text)[0].length : 0, N = y && y.isText ? /\s*$/.exec(y.text)[0].length : 0;
            f + g < p && (f += g, p -= N), c.addMark(f, p, t.create(e));
          }
        }
        i(c.scrollIntoView());
      }
    return !0;
  };
}
function jn(...t) {
  return function(e, n, r) {
    for (let i = 0; i < t.length; i++)
      if (t[i](e, n, r))
        return !0;
    return !1;
  };
}
let Eo = jn(ml, Sf, Nf), _c = jn(ml, C1, S1);
const bt = {
  Enter: jn(N1, T1, A1, E1),
  "Mod-Enter": M1,
  Backspace: Eo,
  "Mod-Backspace": Eo,
  "Shift-Backspace": Eo,
  Delete: _c,
  "Mod-Delete": _c,
  "Mod-a": O1
}, If = {
  "Ctrl-h": bt.Backspace,
  "Alt-Backspace": bt["Mod-Backspace"],
  "Ctrl-d": bt.Delete,
  "Ctrl-Alt-Backspace": bt["Mod-Delete"],
  "Alt-Delete": bt["Mod-Delete"],
  "Alt-d": bt["Mod-Delete"],
  "Ctrl-a": D1,
  "Ctrl-e": R1
};
for (let t in bt)
  If[t] = bt[t];
const P1 = typeof navigator < "u" ? /Mac|iP(hone|[oa]d)/.test(navigator.platform) : typeof os < "u" && os.platform ? os.platform() == "darwin" : !1, L1 = P1 ? If : bt;
class Fe {
  /**
  Create an input rule. The rule applies when the user typed
  something and the text directly in front of the cursor matches
  `match`, which should end with `$`.
  
  The `handler` can be a string, in which case the matched text, or
  the first matched group in the regexp, is replaced by that
  string.
  
  Or a it can be a function, which will be called with the match
  array produced by
  [`RegExp.exec`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec),
  as well as the start and end of the matched range, and which can
  return a [transaction](https://prosemirror.net/docs/ref/#state.Transaction) that describes the
  rule's effect, or null to indicate the input was not handled.
  */
  constructor(e, n, r = {}) {
    this.match = e, this.match = e, this.handler = typeof n == "string" ? B1(n) : n, this.undoable = r.undoable !== !1, this.inCode = r.inCode || !1, this.inCodeMark = r.inCodeMark !== !1;
  }
}
function B1(t) {
  return function(e, n, r, i) {
    let o = t;
    if (n[1]) {
      let s = n[0].lastIndexOf(n[1]);
      o += n[0].slice(s + n[1].length), r += s;
      let l = r - i;
      l > 0 && (o = n[0].slice(s - l, s) + o, r = i);
    }
    return e.tr.insertText(o, r, i);
  };
}
const F1 = (t, e) => {
  let n = t.plugins;
  for (let r = 0; r < n.length; r++) {
    let i = n[r], o;
    if (i.spec.isInputRules && (o = i.getState(t))) {
      if (e) {
        let s = t.tr, l = o.transform;
        for (let a = l.steps.length - 1; a >= 0; a--)
          s.step(l.steps[a].invert(l.docs[a]));
        if (o.text) {
          let a = s.doc.resolve(o.from).marks();
          s.replaceWith(o.from, o.to, t.schema.text(o.text, a));
        } else
          s.delete(o.from, o.to);
        e(s);
      }
      return !0;
    }
  }
  return !1;
};
new Fe(/--$/, "—", { inCodeMark: !1 });
new Fe(/\.\.\.$/, "…", { inCodeMark: !1 });
new Fe(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/, "“", { inCodeMark: !1 });
new Fe(/"$/, "”", { inCodeMark: !1 });
new Fe(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/, "‘", { inCodeMark: !1 });
new Fe(/'$/, "’", { inCodeMark: !1 });
function bl(t, e, n = null, r) {
  return new Fe(t, (i, o, s, l) => {
    let a = n instanceof Function ? n(o) : n, c = i.tr.delete(s, l), u = c.doc.resolve(s), h = u.blockRange(), d = h && dl(h, e, a);
    if (!d)
      return null;
    c.wrap(h, d);
    let f = c.doc.resolve(s - 1).nodeBefore;
    return f && f.type == e && Qi(c.doc, s - 1) && (!r || r(o, f)) && c.join(s - 1), c;
  });
}
function Ef(t, e, n = null) {
  return new Fe(t, (r, i, o, s) => {
    let l = r.doc.resolve(o), a = n instanceof Function ? n(i) : n;
    return l.node(-1).canReplaceWith(l.index(-1), l.indexAfter(-1), e) ? r.tr.delete(o, s).setBlockType(o, o, e, a) : null;
  });
}
const Wt = typeof navigator < "u" ? navigator : null, $c = typeof document < "u" ? document : null, Jt = Wt && Wt.userAgent || "", Ss = /Edge\/(\d+)/.exec(Jt), Of = /MSIE \d/.exec(Jt), Ns = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(Jt), xl = !!(Of || Ns || Ss);
Of ? document.documentMode : Ns ? +Ns[1] : Ss && +Ss[1];
const _1 = !xl && /gecko\/(\d+)/i.test(Jt);
_1 && +(/Firefox\/(\d+)/.exec(Jt) || [0, 0])[1];
const Ms = !xl && /Chrome\/(\d+)/.exec(Jt), $1 = !!Ms;
Ms && +Ms[1];
const V1 = !xl && !!Wt && /Apple Computer/.test(Wt.vendor), H1 = V1 && (/Mobile\/\w+/.test(Jt) || !!Wt && Wt.maxTouchPoints > 2);
H1 || Wt && /Mac/.test(Wt.platform);
const j1 = /Android \d/.test(Jt), q1 = !!$c && "webkitFontSmoothing" in $c.documentElement.style;
q1 && +(/\bAppleWebKit\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1];
function Oo(t, e, n, r, i, o) {
  if (t.composing) return !1;
  const s = t.state, l = s.doc.resolve(e);
  if (l.parent.type.spec.code) return !1;
  const a = l.parent.textBetween(
    Math.max(0, l.parentOffset - 500),
    l.parentOffset,
    void 0,
    "￼"
  ) + r;
  for (let c of i) {
    const u = c, h = u.match.exec(a), d = h && h[0] && u.handler(s, h, e - (h[0].length - r.length), n);
    if (d)
      return u.undoable !== !1 && d.setMeta(o, { transform: d, from: e, to: n, text: r }), t.dispatch(d), !0;
  }
  return !1;
}
const W1 = new ve("MILKDOWN_CUSTOM_INPUTRULES");
function K1({ rules: t }) {
  const e = new Oe({
    key: W1,
    isInputRules: !0,
    state: {
      init() {
        return null;
      },
      apply(n, r) {
        const i = n.getMeta(this);
        return i || (n.selectionSet || n.docChanged ? null : r);
      }
    },
    props: {
      handleTextInput(n, r, i, o) {
        return Oo(n, r, i, o, t, e);
      },
      handleDOMEvents: {
        compositionend: (n) => (setTimeout(() => {
          const { $cursor: r } = n.state.selection;
          r && Oo(n, r.pos, r.pos, "", t, e);
        }), !1),
        keydown: (n, r) => !(j1 && $1 && r.key === "Enter") || n.composing ? !1 : n.someProp(
          "handleKeyDown",
          (i) => i(n, r)
        ) ? (r.preventDefault(), !0) : !1
      },
      handleKeyDown(n, r) {
        if (r.key !== "Enter") return !1;
        const { $cursor: i } = n.state.selection;
        return i ? Oo(n, i.pos, i.pos, `
`, t, e) : !1;
      }
    }
  });
  return e;
}
function vf(t) {
  return t.some((e) => e.type.spec.code);
}
function Vc(t, e, n) {
  if (e >= n) return !1;
  let r = !1;
  return t.doc.nodesBetween(e, n, (i) => (i.isInline && vf(i.marks) && (r = !0), !r)), r;
}
function U1(t, e) {
  var n;
  return vf((n = t.storedMarks) != null ? n : t.doc.resolve(e).marks());
}
function Lr(t, e, n = {}) {
  return new Fe(t, (r, i, o, s) => {
    var l, a, c, u;
    const { tr: h } = r, d = i.length;
    let f = i[d - 1], p = i[0], m = [], y;
    const g = {
      group: f,
      fullMatch: p,
      start: o,
      end: s
    }, N = (l = n.updateCaptured) == null ? void 0 : l.call(n, g);
    if (Object.assign(g, N), { group: f, fullMatch: p, start: o, end: s } = g, p === null || f?.trim() === "") return null;
    if (f) {
      const w = p.search(/\S/), O = o + p.indexOf(f), v = O + f.length, x = Vc(
        r,
        o + w,
        O
      ), A = v < s && Vc(r, v, s);
      if (x || A || U1(r, s))
        return null;
      m = (a = h.storedMarks) != null ? a : [], v < s && h.delete(v, s), O > o && h.delete(o + w, O), y = o + w + f.length;
      const R = (c = n.getAttr) == null ? void 0 : c.call(n, i);
      h.addMark(o, y, e.create(R)), h.setStoredMarks(m), (u = n.beforeDispatch) == null || u.call(n, { match: i, start: o, end: s, tr: h });
    }
    return h;
  });
}
function Df(t) {
  return Object.assign(Object.create(t), t).setTime(Date.now());
}
function J1(t, e) {
  return Array.isArray(t) && t.includes(e.type) || e.type === t;
}
function G1(t) {
  return (e) => {
    for (let n = e.depth; n > 0; n -= 1) {
      const r = e.node(n);
      if (t(r)) {
        const i = e.before(n), o = e.after(n);
        return {
          from: i,
          to: o,
          node: r
        };
      }
    }
  };
}
function Y1(t, e) {
  return G1((n) => n.type === e)(t);
}
function Q1(t) {
  return (e) => {
    for (let n = e.depth; n > 0; n--) {
      const r = e.node(n);
      if (t(r))
        return {
          pos: e.before(n),
          start: e.start(n),
          depth: n,
          node: r
        };
    }
  };
}
function X1(t, e) {
  if (!(t instanceof _)) return;
  const { node: n, $from: r } = t;
  if (J1(e, n))
    return {
      node: n,
      pos: r.pos,
      start: r.start(r.depth),
      depth: r.depth
    };
}
const Z1 = (t, e) => {
  const { selection: n, doc: r } = t;
  if (n instanceof _)
    return {
      hasNode: n.node.type === e,
      pos: n.from,
      target: n.node
    };
  const { from: i, to: o } = n;
  let s = !1, l = -1, a = null;
  return r.nodesBetween(i, o, (c, u) => a ? !1 : c.type === e ? (s = !0, l = u, a = c, !1) : !0), {
    hasNode: s,
    pos: l,
    target: a
  };
};
var Kt = {
  8: "Backspace",
  9: "Tab",
  10: "Enter",
  12: "NumLock",
  13: "Enter",
  16: "Shift",
  17: "Control",
  18: "Alt",
  20: "CapsLock",
  27: "Escape",
  32: " ",
  33: "PageUp",
  34: "PageDown",
  35: "End",
  36: "Home",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  44: "PrintScreen",
  45: "Insert",
  46: "Delete",
  59: ";",
  61: "=",
  91: "Meta",
  92: "Meta",
  106: "*",
  107: "+",
  108: ",",
  109: "-",
  110: ".",
  111: "/",
  144: "NumLock",
  145: "ScrollLock",
  160: "Shift",
  161: "Shift",
  162: "Control",
  163: "Control",
  164: "Alt",
  165: "Alt",
  173: "-",
  186: ";",
  187: "=",
  188: ",",
  189: "-",
  190: ".",
  191: "/",
  192: "`",
  219: "[",
  220: "\\",
  221: "]",
  222: "'"
}, Di = {
  48: ")",
  49: "!",
  50: "@",
  51: "#",
  52: "$",
  53: "%",
  54: "^",
  55: "&",
  56: "*",
  57: "(",
  59: ":",
  61: "+",
  173: "_",
  186: ":",
  187: "+",
  188: "<",
  189: "_",
  190: ">",
  191: "?",
  192: "~",
  219: "{",
  220: "|",
  221: "}",
  222: '"'
}, e0 = typeof navigator < "u" && /Mac/.test(navigator.platform), t0 = typeof navigator < "u" && /MSIE \d|Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(navigator.userAgent);
for (var he = 0; he < 10; he++) Kt[48 + he] = Kt[96 + he] = String(he);
for (var he = 1; he <= 24; he++) Kt[he + 111] = "F" + he;
for (var he = 65; he <= 90; he++)
  Kt[he] = String.fromCharCode(he + 32), Di[he] = String.fromCharCode(he);
for (var vo in Kt) Di.hasOwnProperty(vo) || (Di[vo] = Kt[vo]);
function n0(t) {
  var e = e0 && t.metaKey && t.shiftKey && !t.ctrlKey && !t.altKey || t0 && t.shiftKey && t.key && t.key.length == 1 || t.key == "Unidentified", n = !e && t.key || (t.shiftKey ? Di : Kt)[t.keyCode] || t.key || "Unidentified";
  return n == "Esc" && (n = "Escape"), n == "Del" && (n = "Delete"), n == "Left" && (n = "ArrowLeft"), n == "Up" && (n = "ArrowUp"), n == "Right" && (n = "ArrowRight"), n == "Down" && (n = "ArrowDown"), n;
}
const r0 = typeof navigator < "u" && /Mac|iP(hone|[oa]d)/.test(navigator.platform), i0 = typeof navigator < "u" && /Win/.test(navigator.platform);
function o0(t) {
  let e = t.split(/-(?!$)/), n = e[e.length - 1];
  n == "Space" && (n = " ");
  let r, i, o, s;
  for (let l = 0; l < e.length - 1; l++) {
    let a = e[l];
    if (/^(cmd|meta|m)$/i.test(a))
      s = !0;
    else if (/^a(lt)?$/i.test(a))
      r = !0;
    else if (/^(c|ctrl|control)$/i.test(a))
      i = !0;
    else if (/^s(hift)?$/i.test(a))
      o = !0;
    else if (/^mod$/i.test(a))
      r0 ? s = !0 : i = !0;
    else
      throw new Error("Unrecognized modifier name: " + a);
  }
  return r && (n = "Alt-" + n), i && (n = "Ctrl-" + n), s && (n = "Meta-" + n), o && (n = "Shift-" + n), n;
}
function s0(t) {
  let e = /* @__PURE__ */ Object.create(null);
  for (let n in t)
    e[o0(n)] = t[n];
  return e;
}
function Do(t, e, n = !0) {
  return e.altKey && (t = "Alt-" + t), e.ctrlKey && (t = "Ctrl-" + t), e.metaKey && (t = "Meta-" + t), n && e.shiftKey && (t = "Shift-" + t), t;
}
function l0(t) {
  return new Oe({ props: { handleKeyDown: Rf(t) } });
}
function Rf(t) {
  let e = s0(t);
  return function(n, r) {
    let i = n0(r), o, s = e[Do(i, r)];
    if (s && s(n.state, n.dispatch, n))
      return !0;
    if (i.length == 1 && i != " ") {
      if (r.shiftKey) {
        let l = e[Do(i, r, !1)];
        if (l && l(n.state, n.dispatch, n))
          return !0;
      }
      if ((r.altKey || r.metaKey || r.ctrlKey) && // Ctrl-Alt may be used for AltGr on Windows
      !(i0 && r.ctrlKey && r.altKey) && (o = Kt[r.keyCode]) && o != i) {
        let l = e[Do(o, r)];
        if (l && l(n.state, n.dispatch, n))
          return !0;
      }
    }
    return !1;
  };
}
var zf = class {
}, Pf = class {
  constructor() {
    this.elements = [], this.size = () => this.elements.length, this.top = () => this.elements.at(-1), this.push = (t) => {
      this.top()?.push(t);
    }, this.open = (t) => {
      this.elements.push(t);
    }, this.close = () => {
      const t = this.elements.pop();
      if (!t) throw ih();
      return t;
    };
  }
}, a0 = class Lf extends zf {
  constructor(e, n, r) {
    super(), this.type = e, this.content = n, this.attrs = r;
  }
  push(e, ...n) {
    this.content.push(e, ...n);
  }
  pop() {
    return this.content.pop();
  }
  static create(e, n, r) {
    return new Lf(e, n, r);
  }
}, c0 = class extends Pf {
  #t;
  static {
    this.create = (t, e) => {
      const n = new this(t);
      return (r) => (n.run(e, r), n.toDoc());
    };
  }
  constructor(t) {
    super(), this.#t = J.none, this.#e = (e) => e.isText, this.#r = (e, n) => {
      if (this.#e(e) && this.#e(n) && J.sameSet(e.marks, n.marks)) return this.schema.text(e.text + n.text, e.marks);
    }, this.#n = (e) => {
      const n = Object.values({
        ...this.schema.nodes,
        ...this.schema.marks
      }).find((r) => r.spec.parseMarkdown.match(e));
      if (!n) throw Bm(e);
      return n;
    }, this.#o = (e) => {
      const n = this.#n(e);
      n.spec.parseMarkdown.runner(this, e, n);
    }, this.injectRoot = (e, n, r) => (this.openNode(n, r), this.next(e.children), this), this.openNode = (e, n) => (this.open(a0.create(e, [], n)), this), this.#s = () => {
      this.#t = J.none;
      const e = this.close();
      return this.#i(e.type, e.attrs, e.content);
    }, this.closeNode = () => {
      try {
        this.#s();
      } catch (e) {
        console.error(e);
      }
      return this;
    }, this.#i = (e, n, r) => {
      const i = e.createAndFill(n, r, this.#t);
      if (!i) throw Lm(e, n, r);
      return this.push(i), i;
    }, this.addNode = (e, n, r) => {
      try {
        this.#i(e, n, r);
      } catch (i) {
        console.error(i);
      }
      return this;
    }, this.openMark = (e, n) => {
      const r = e.create(n);
      return this.#t = r.addToSet(this.#t), this;
    }, this.closeMark = (e) => (this.#t = e.removeFromSet(this.#t), this), this.addText = (e) => {
      try {
        const n = this.top();
        if (!n) throw ih();
        const r = n.pop(), i = this.schema.text(e, this.#t);
        if (!r)
          return n.push(i), this;
        const o = this.#r(r, i);
        return o ? (n.push(o), this) : (n.push(r, i), this);
      } catch (n) {
        return console.error(n), this;
      }
    }, this.build = () => {
      let e;
      do
        e = this.#s();
      while (this.size());
      return e;
    }, this.next = (e = []) => ([e].flat().forEach((n) => this.#o(n)), this), this.toDoc = () => this.build(), this.run = (e, n) => {
      const r = e.runSync(e.parse(n), n);
      return this.next(r), this;
    }, this.schema = t;
  }
  #e;
  #r;
  #n;
  #o;
  #s;
  #i;
}, Hc = class Bf extends zf {
  constructor(e, n, r, i = {}) {
    super(), this.type = e, this.children = n, this.value = r, this.props = i, this.push = (o, ...s) => {
      this.children || (this.children = []), this.children.push(o, ...s);
    }, this.pop = () => this.children?.pop();
  }
  static {
    this.create = (e, n, r, i = {}) => new Bf(e, n, r, i);
  }
}, u0 = (t) => Object.prototype.hasOwnProperty.call(t, "size"), h0 = class extends Pf {
  #t;
  static {
    this.create = (t, e) => {
      const n = new this(t);
      return (r) => (n.run(r), n.toString(e));
    };
  }
  constructor(t) {
    super(), this.#t = [], this.#e = (e) => {
      const n = Object.values({
        ...this.schema.nodes,
        ...this.schema.marks
      }).find((r) => r.spec.toMarkdown.match(e));
      if (!n) throw Fm(e.type);
      return n;
    }, this.#r = (e) => this.#e(e).spec.toMarkdown.runner(this, e), this.#n = (e, n) => this.#e(e).spec.toMarkdown.runner(this, e, n), this.#o = (e) => {
      const n = (o) => o.type.spec.priority ?? 50, r = [...e].sort((o, s) => n(o) - n(s)), i = [];
      return this.#t.forEach(({ mark: o }) => {
        const s = r.findIndex((l) => l.eq(o));
        s >= 0 && i.push(...r.splice(s, 1));
      }), i.concat(r);
    }, this.#s = (e) => {
      const n = e?.marks;
      let r = 0;
      for (; r < this.#t.length; ) {
        const { mark: i, spanning: o } = this.#t[r];
        if (o && n?.some((s) => s.eq(i))) r++;
        else break;
      }
      for (let i = this.#t.length - 1; i >= r; i--) this.#h(this.#t[i].mark);
    }, this.#i = (e, n) => {
      this.#o(e.marks).every((r) => !this.#n(r, e)) && this.#r(e), this.#s(n);
    }, this.#l = (e) => {
      const { children: n } = e;
      return n && (e.children = n.reduce((r, i, o) => {
        if (o === 0) return [i];
        const s = r.at(-1);
        if (s && s.isMark && i.isMark) {
          const { children: l, ...a } = i, { children: c, ...u } = s;
          if (i.type === s.type && l && c && JSON.stringify(a) === JSON.stringify(u)) {
            const h = {
              ...u,
              children: [...c, ...l]
            };
            return r.slice(0, -1).concat(this.#l(h));
          }
        }
        return r.concat(i);
      }, [])), e;
    }, this.#a = (e) => {
      const n = {
        ...e.props,
        type: e.type
      };
      return e.children && (n.children = e.children), e.value && (n.value = e.value), n;
    }, this.openNode = (e, n, r) => (this.open(Hc.create(e, void 0, n, r)), this), this.#f = (e, n) => {
      let r = "", i = "";
      const o = e.children;
      if (o) {
        const l = o[0], a = o.at(-1);
        if (a && a.type === "text" && a.value.endsWith(" ")) {
          const c = a.value, u = c.trimEnd();
          i = c.slice(u.length), a.value = u;
        }
        if (l && l.type === "text" && l.value.startsWith(" ")) {
          const c = l.value, u = c.trimStart();
          r = c.slice(0, c.length - u.length), l.value = u;
        }
      }
      r.length && this.#u("text", void 0, r);
      const s = n();
      return i.length && this.#u("text", void 0, i), s;
    }, this.#c = (e = !1) => {
      const n = this.close(), r = () => this.#u(n.type, n.children, n.value, n.props);
      return e ? this.#f(n, r) : r();
    }, this.closeNode = () => (this.#c(), this), this.#u = (e, n, r, i) => {
      const o = Hc.create(e, n, r, i), s = this.#l(this.#a(o));
      return this.push(s), s;
    }, this.addNode = (e, n, r, i) => (this.#u(e, n, r, i), this), this.#d = (e, n, r, i) => this.#t.some((o) => o.mark.eq(e)) ? this : (this.#t.push({
      mark: e,
      spanning: r == null
    }), this.openNode(n, r, {
      ...i,
      isMark: !0
    })), this.#h = (e) => {
      let n = -1;
      for (let r = this.#t.length - 1; r >= 0; r--) if (this.#t[r].mark.eq(e)) {
        n = r;
        break;
      }
      n < 0 || (this.#t.splice(n, 1), this.#c(!0));
    }, this.withMark = (e, n, r, i) => (this.#d(e, n, r, i), this), this.closeMark = (e) => (this.#h(e), this), this.build = () => {
      let e = null;
      do
        e = this.#c();
      while (this.size());
      return e.children || (e.children = []), e;
    }, this.next = (e) => u0(e) ? (e.forEach((n, r, i) => {
      this.#i(n, e.maybeChild(i + 1) ?? void 0);
    }), this) : (this.#i(e), this), this.toString = (e) => e.stringify(this.build()), this.run = (e) => (this.#t = [], this.next(e), this), this.schema = t;
  }
  #e;
  #r;
  #n;
  #o;
  #s;
  #i;
  #l;
  #a;
  #f;
  #c;
  #u;
  #d;
  #h;
};
const fe = function(t) {
  for (var e = 0; ; e++)
    if (t = t.previousSibling, !t)
      return e;
}, Ln = function(t) {
  let e = t.assignedSlot || t.parentNode;
  return e && e.nodeType == 11 ? e.host : e;
};
let Ts = null;
const kt = function(t, e, n) {
  let r = Ts || (Ts = document.createRange());
  return r.setEnd(t, n ?? t.nodeValue.length), r.setStart(t, e || 0), r;
}, f0 = function() {
  Ts = null;
}, yn = function(t, e, n, r) {
  return n && (jc(t, e, n, r, -1) || jc(t, e, n, r, 1));
}, d0 = /^(img|br|input|textarea|hr)$/i;
function jc(t, e, n, r, i) {
  for (var o; ; ) {
    if (t == n && e == r)
      return !0;
    if (e == (i < 0 ? 0 : ke(t))) {
      let s = t.parentNode;
      if (!s || !z(s) || Br(t) || d0.test(t.nodeName) || t.contentEditable == "false")
        return !1;
      e = fe(t) + (i < 0 ? 0 : 1), t = s;
    } else if (z(t)) {
      let s = t.childNodes[e + (i < 0 ? -1 : 0)];
      if (z(s) && s.contentEditable == "false")
        if (!((o = s.pmViewDesc) === null || o === void 0) && o.ignoreForSelection)
          e += i;
        else
          return !1;
      else
        t = s, e = i < 0 ? ke(t) : 0;
    } else
      return !1;
  }
}
function ke(t) {
  return t.nodeType == 3 ? t.nodeValue.length : t.childNodes.length;
}
function z(t) {
  return t.nodeType == 1;
}
function se(t) {
  return t.nodeType == 3;
}
function kn(t, e) {
  return e ? t.contains(z(e) ? e : e.parentNode) : !1;
}
function p0(t, e) {
  for (; ; ) {
    if (se(t) && e)
      return t;
    if (z(t) && e > 0) {
      if (t.contentEditable == "false")
        return null;
      t = t.childNodes[e - 1], e = ke(t);
    } else if (t.parentNode && !Br(t))
      e = fe(t), t = t.parentNode;
    else
      return null;
  }
}
function m0(t, e) {
  for (; ; ) {
    if (se(t) && e < t.nodeValue.length)
      return t;
    if (z(t) && e < t.childNodes.length) {
      if (t.contentEditable == "false")
        return null;
      t = t.childNodes[e], e = 0;
    } else if (t.parentNode && !Br(t))
      e = fe(t) + 1, t = t.parentNode;
    else
      return null;
  }
}
function g0(t, e, n) {
  for (let r = e == 0, i = e == ke(t); r || i; ) {
    if (t == n)
      return !0;
    let o = fe(t);
    if (t = t.parentNode, !t)
      return !1;
    r = r && o == 0, i = i && o == ke(t);
  }
}
function Br(t) {
  let e;
  for (let n = t; n && !(e = n.pmViewDesc); n = n.parentNode)
    ;
  return e && e.node && e.node.isBlock && (e.dom == t || e.contentDOM == t);
}
const to = function(t) {
  return t.focusNode && yn(t.focusNode, t.focusOffset, t.anchorNode, t.anchorOffset);
};
function nn(t, e) {
  let n = document.createEvent("Event");
  return n.initEvent("keydown", !0, !0), n.keyCode = t, n.key = n.code = e, n;
}
function y0(t) {
  let e = t.activeElement;
  for (; e && e.shadowRoot; )
    e = e.shadowRoot.activeElement;
  return e;
}
function k0(t, e, n) {
  if (t.caretPositionFromPoint)
    try {
      let r = t.caretPositionFromPoint(e, n);
      if (r)
        return { node: r.offsetNode, offset: Math.min(ke(r.offsetNode), r.offset) };
    } catch {
    }
  if (t.caretRangeFromPoint) {
    let r = t.caretRangeFromPoint(e, n);
    if (r)
      return { node: r.startContainer, offset: Math.min(ke(r.startContainer), r.startOffset) };
  }
}
const lt = typeof navigator < "u" ? navigator : null, qc = typeof document < "u" ? document : null, Gt = lt && lt.userAgent || "", As = /Edge\/(\d+)/.exec(Gt), Ff = /MSIE \d/.exec(Gt), Is = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(Gt), Ae = !!(Ff || Is || As), Vt = Ff ? document.documentMode : Is ? +Is[1] : As ? +As[1] : 0, Be = !Ae && /gecko\/(\d+)/i.test(Gt);
Be && +(/Firefox\/(\d+)/.exec(Gt) || [0, 0])[1];
const Es = !Ae && /Chrome\/(\d+)/.exec(Gt), pe = !!Es, _f = Es ? +Es[1] : 0, xe = !Ae && !!lt && /Apple Computer/.test(lt.vendor), Bn = xe && (/Mobile\/\w+/.test(Gt) || !!lt && lt.maxTouchPoints > 2), $e = Bn || (lt ? /Mac/.test(lt.platform) : !1), $f = lt ? /Win/.test(lt.platform) : !1, wt = /Android \d/.test(Gt), no = !!qc && "webkitFontSmoothing" in qc.documentElement.style, b0 = no ? +(/\bAppleWebKit\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1] : 0;
function x0(t) {
  let e = t.defaultView && t.defaultView.visualViewport;
  return e ? {
    left: 0,
    right: e.width,
    top: 0,
    bottom: e.height
  } : {
    left: 0,
    right: t.documentElement.clientWidth,
    top: 0,
    bottom: t.documentElement.clientHeight
  };
}
function gt(t, e) {
  return typeof t == "number" ? t : t[e];
}
function w0(t) {
  let e = t.getBoundingClientRect(), n = e.width / t.offsetWidth || 1, r = e.height / t.offsetHeight || 1;
  return {
    left: e.left,
    right: e.left + t.clientWidth * n,
    top: e.top,
    bottom: e.top + t.clientHeight * r
  };
}
function Wc(t, e, n) {
  if (!Os(e) && e.left == 0)
    return;
  let r = t.someProp("scrollThreshold") || 0, i = t.someProp("scrollMargin") || 5, o = t.dom.ownerDocument;
  for (let s = n || t.dom; s; ) {
    if (!z(s)) {
      s = Ln(s);
      continue;
    }
    let l = s == o.body, a = l ? x0(o) : w0(s), c = 0, u = 0;
    if (e.top < a.top + gt(r, "top") ? u = -(a.top - e.top + gt(i, "top")) : e.bottom > a.bottom - gt(r, "bottom") && (u = e.bottom - e.top > a.bottom - a.top ? e.top + gt(i, "top") - a.top : e.bottom - a.bottom + gt(i, "bottom")), e.left < a.left + gt(r, "left") ? c = -(a.left - e.left + gt(i, "left")) : e.right > a.right - gt(r, "right") && (c = e.right - a.right + gt(i, "right")), c || u)
      if (l)
        o.defaultView.scrollBy(c, u);
      else {
        let d = s.scrollLeft, f = s.scrollTop;
        u && (s.scrollTop += u), c && (s.scrollLeft += c);
        let p = s.scrollLeft - d, m = s.scrollTop - f;
        e = { left: e.left - p, top: e.top - m, right: e.right - p, bottom: e.bottom - m };
      }
    let h = l ? "fixed" : getComputedStyle(s).position;
    if (/^(fixed|sticky)$/.test(h))
      break;
    s = h == "absolute" ? s.offsetParent : Ln(s);
  }
}
function C0(t) {
  let e = t.dom.getBoundingClientRect(), n = Math.max(0, e.top), r, i;
  for (let o = (e.left + e.right) / 2, s = n + 1; s < Math.min(innerHeight, e.bottom); s += 5) {
    let l = t.root.elementFromPoint(o, s);
    if (!l || l == t.dom || !t.dom.contains(l))
      continue;
    let a = l.getBoundingClientRect();
    if (a.top >= n - 20) {
      r = l, i = a.top;
      break;
    }
  }
  return { refDOM: r, refTop: i, stack: Vf(t.dom) };
}
function Vf(t) {
  let e = [], n = t.ownerDocument;
  for (let r = t; r && (e.push({ dom: r, top: r.scrollTop, left: r.scrollLeft }), t != n); r = Ln(r))
    ;
  return e;
}
function S0({ refDOM: t, refTop: e, stack: n }) {
  let r = t ? t.getBoundingClientRect().top : 0;
  Hf(n, r == 0 ? 0 : r - e);
}
function Hf(t, e) {
  for (let n = 0; n < t.length; n++) {
    let { dom: r, top: i, left: o } = t[n];
    r.scrollTop != i + e && (r.scrollTop = i + e), r.scrollLeft != o && (r.scrollLeft = o);
  }
}
let Nn = null;
function N0(t) {
  if (t.setActive)
    return t.setActive();
  if (Nn)
    return t.focus(Nn);
  let e = Vf(t);
  t.focus(Nn == null ? {
    get preventScroll() {
      return Nn = { preventScroll: !0 }, !0;
    }
  } : void 0), Nn || (Nn = !1, Hf(e, 0));
}
function jf(t, e) {
  let n, r = 2e8, i, o = 0, s = e.top, l = e.top, a, c;
  for (let u = t.firstChild, h = 0; u; u = u.nextSibling, h++) {
    let d;
    if (z(u))
      d = u.getClientRects();
    else if (se(u))
      d = kt(u).getClientRects();
    else
      continue;
    for (let f = 0; f < d.length; f++) {
      let p = d[f];
      if (p.top <= s && p.bottom >= l) {
        s = Math.max(p.bottom, s), l = Math.min(p.top, l);
        let m = p.left > e.left ? p.left - e.left : p.right < e.left ? e.left - p.right : 0;
        if (m < r) {
          n = u, r = m, i = m && se(n) ? {
            left: p.right < e.left ? p.right : p.left,
            top: e.top
          } : e, z(u) && m && (o = h + (e.left >= (p.left + p.right) / 2 ? 1 : 0));
          continue;
        }
      } else p.top > e.top && !a && p.left <= e.left && p.right >= e.left && (a = u, c = { left: Math.max(p.left, Math.min(p.right, e.left)), top: p.top });
      !n && (e.left >= p.right && e.top >= p.top || e.left >= p.left && e.top >= p.bottom) && (o = h + 1);
    }
  }
  return !n && a && (n = a, i = c, r = 0), n && se(n) ? M0(n, i) : !n || r ? { node: t, offset: o } : jf(n, i);
}
function M0(t, e) {
  let n = t.nodeValue.length, r = document.createRange(), i;
  for (let o = 0; o < n; o++) {
    r.setEnd(t, o + 1), r.setStart(t, o);
    let s = zt(r, 1);
    if (s.top != s.bottom && wl(e, s)) {
      i = { node: t, offset: o + (e.left >= (s.left + s.right) / 2 ? 1 : 0) };
      break;
    }
  }
  return r.detach(), i || { node: t, offset: 0 };
}
function wl(t, e) {
  return t.left >= e.left - 1 && t.left <= e.right + 1 && t.top >= e.top - 1 && t.top <= e.bottom + 1;
}
function T0(t, e) {
  let n = t.parentNode;
  return n && /^li$/i.test(n.nodeName) && e.left < t.getBoundingClientRect().left ? n : t;
}
function A0(t, e, n) {
  let { node: r, offset: i } = jf(e, n), o = -1;
  if (z(r) && !r.firstChild) {
    let s = r.getBoundingClientRect();
    o = s.left != s.right && n.left > (s.left + s.right) / 2 ? 1 : -1;
  }
  return t.docView.posFromDOM(r, i, o);
}
function I0(t, e, n, r) {
  let i = -1;
  for (let o = e, s = !1; o != t.dom; ) {
    let l = t.docView.nearestDesc(o, !0), a;
    if (!l)
      return null;
    if (z(l.dom) && (l.node.isBlock && l.parent || !l.contentDOM) && // Ignore elements with zero-size bounding rectangles
    ((a = l.dom.getBoundingClientRect()).width || a.height) && (l.node.isBlock && l.parent && !/^T(R|BODY|HEAD|FOOT)$/.test(l.dom.nodeName) && (!s && a.left > r.left || a.top > r.top ? i = l.posBefore : (!s && a.right < r.left || a.bottom < r.top) && (i = l.posAfter), s = !0), !l.contentDOM && i < 0 && !l.node.isText))
      return (l.node.isBlock ? r.top < (a.top + a.bottom) / 2 : r.left < (a.left + a.right) / 2) ? l.posBefore : l.posAfter;
    o = l.dom.parentNode;
  }
  return i > -1 ? i : t.docView.posFromDOM(e, n, -1);
}
function qf(t, e, n) {
  let r = t.childNodes.length;
  if (r && n.top < n.bottom)
    for (let i = Math.max(0, Math.min(r - 1, Math.floor(r * (e.top - n.top) / (n.bottom - n.top)) - 2)), o = i; ; ) {
      let s = t.childNodes[o];
      if (z(s)) {
        let l = s.getClientRects();
        for (let a = 0; a < l.length; a++) {
          let c = l[a];
          if (wl(e, c))
            return qf(s, e, c);
        }
      }
      if ((o = (o + 1) % r) == i)
        break;
    }
  return t;
}
function E0(t, e) {
  let n = t.dom.ownerDocument, r, i = 0, o = k0(n, e.left, e.top);
  o && ({ node: r, offset: i } = o);
  let s = (t.root.elementFromPoint ? t.root : n).elementFromPoint(e.left, e.top), l;
  if (!s || !t.dom.contains(s)) {
    let c = t.dom.getBoundingClientRect();
    if (!wl(e, c) || (s = qf(t.dom, e, c), !s))
      return null;
  }
  if (xe)
    for (let c = s; r && c; c = Ln(c))
      c.draggable && (r = void 0);
  if (s = T0(s, e), r) {
    if (Be && z(r) && (i = Math.min(i, r.childNodes.length), i < r.childNodes.length)) {
      let u = r.childNodes[i], h;
      u.nodeName == "IMG" && (h = u.getBoundingClientRect()).right <= e.left && h.bottom > e.top && i++;
    }
    let c;
    no && i && z(r) && z(c = r.childNodes[i - 1]) && c.contentEditable == "false" && c.getBoundingClientRect().top >= e.top && i--, r == t.dom && i == r.childNodes.length - 1 && z(r.lastChild) && e.top > r.lastChild.getBoundingClientRect().bottom ? l = t.state.doc.content.size : (i == 0 || !z(r) || r.childNodes[i - 1].nodeName != "BR") && (l = I0(t, r, i, e));
  }
  l == null && (l = A0(t, s, e));
  let a = t.docView.nearestDesc(s, !0);
  return { pos: l, inside: a ? a.posAtStart - a.border : -1 };
}
function Os(t) {
  return t.top < t.bottom || t.left < t.right;
}
function zt(t, e) {
  let n = t.getClientRects();
  if (n.length) {
    let r = n[e < 0 ? 0 : n.length - 1];
    if (Os(r))
      return r;
  }
  return Array.prototype.find.call(n, Os) || t.getBoundingClientRect();
}
const O0 = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
function Wf(t, e, n) {
  let { node: r, offset: i, atom: o } = t.docView.domFromPos(e, n < 0 ? -1 : 1), s = no || Be;
  if (se(r))
    if (s && (O0.test(r.nodeValue) || (n < 0 ? !i : i == r.nodeValue.length))) {
      let a = zt(kt(r, i, i), n);
      if (Be && i && /\s/.test(r.nodeValue[i - 1]) && i < r.nodeValue.length) {
        let c = zt(kt(r, i - 1, i - 1), -1);
        if (c.top == a.top) {
          let u = zt(kt(r, i, i + 1), -1);
          if (u.top != a.top)
            return er(u, u.left < c.left);
        }
      }
      return a;
    } else {
      let a = i, c = i, u = n < 0 ? 1 : -1;
      return n < 0 && !i ? (c++, u = -1) : n >= 0 && i == r.nodeValue.length ? (a--, u = 1) : n < 0 ? a-- : c++, er(zt(kt(r, a, c), u), u < 0);
    }
  if (!t.state.doc.resolve(e - (o || 0)).parent.inlineContent) {
    if (o == null && i && (n < 0 || i == ke(r))) {
      let a = r.childNodes[i - 1];
      if (z(a))
        return Ro(a.getBoundingClientRect(), !1);
    }
    if (o == null && i < ke(r)) {
      let a = r.childNodes[i];
      if (z(a))
        return Ro(a.getBoundingClientRect(), !0);
    }
    return Ro(r.getBoundingClientRect(), n >= 0);
  }
  if (o == null && i && (n < 0 || i == ke(r))) {
    let a = r.childNodes[i - 1], c = se(a) ? kt(a, ke(a) - (s ? 0 : 1)) : z(a) && (a.nodeName != "BR" || !a.nextSibling) ? a : null;
    if (c)
      return er(zt(c, 1), !1);
  }
  if (o == null && i < ke(r)) {
    let a = r.childNodes[i];
    for (; a.pmViewDesc && a.pmViewDesc.ignoreForCoords; )
      a = a.nextSibling;
    let c = a ? se(a) ? kt(a, 0, s ? 0 : 1) : z(a) ? a : null : null;
    if (c)
      return er(zt(c, -1), !0);
  }
  return er(zt(se(r) ? kt(r) : r, -n), n >= 0);
}
function er(t, e) {
  if (t.width == 0)
    return t;
  let n = e ? t.left : t.right;
  return { top: t.top, bottom: t.bottom, left: n, right: n };
}
function Ro(t, e) {
  if (t.height == 0)
    return t;
  let n = e ? t.top : t.bottom;
  return { top: n, bottom: n, left: t.left, right: t.right };
}
function Kf(t, e, n) {
  let r = t.state, i = t.root.activeElement;
  r != e && t.updateState(e), i != t.dom && t.focus();
  try {
    return n();
  } finally {
    r != e && t.updateState(r), i != t.dom && i && i.focus();
  }
}
function v0(t, e, n) {
  let r = e.selection, i = n == "up" ? r.$from : r.$to;
  return Kf(t, e, () => {
    let { node: o } = t.docView.domFromPos(i.pos, n == "up" ? -1 : 1);
    for (; ; ) {
      let l = t.docView.nearestDesc(o, !0);
      if (!l)
        break;
      if (l.node.isBlock) {
        o = l.contentDOM || l.dom;
        break;
      }
      o = l.dom.parentNode;
    }
    let s = Wf(t, i.pos, 1);
    for (let l = o.firstChild; l; l = l.nextSibling) {
      let a;
      if (z(l))
        a = l.getClientRects();
      else if (se(l))
        a = kt(l, 0, l.nodeValue.length).getClientRects();
      else
        continue;
      for (let c = 0; c < a.length; c++) {
        let u = a[c];
        if (u.bottom > u.top + 1 && (n == "up" ? s.top - u.top > (u.bottom - s.top) * 2 : u.bottom - s.bottom > (s.bottom - u.top) * 2))
          return !1;
      }
    }
    return !0;
  });
}
const D0 = /[\u0590-\u08ac]/;
function R0(t, e, n) {
  let { $head: r } = e.selection;
  if (!r.parent.isTextblock)
    return !1;
  let i = r.parentOffset, o = !i, s = i == r.parent.content.size, l = t.domSelection();
  return l ? !D0.test(r.parent.textContent) || !l.modify ? n == "left" || n == "backward" ? o : s : Kf(t, e, () => {
    let { focusNode: a, focusOffset: c, anchorNode: u, anchorOffset: h } = t.domSelectionRange(), d = l.caretBidiLevel;
    l.modify("move", n, "character");
    let f = r.depth ? t.docView.domAfterPos(r.before()) : t.dom, { focusNode: p, focusOffset: m } = t.domSelectionRange(), y = p && !kn(f, p) || a == p && c == m;
    try {
      l.collapse(u, h), a && (a != u || c != h) && l.extend && l.extend(a, c);
    } catch {
    }
    return d != null && (l.caretBidiLevel = d), y;
  }) : r.pos == r.start() || r.pos == r.end();
}
let Kc = null, Uc = null, Jc = !1;
function z0(t, e, n) {
  return Kc == e && Uc == n ? Jc : (Kc = e, Uc = n, Jc = n == "up" || n == "down" ? v0(t, e, n) : R0(t, e, n));
}
const je = 0, Gc = 1, on = 2, et = 3;
class Fr {
  constructor(e, n, r, i) {
    this.parent = e, this.children = n, this.dom = r, this.contentDOM = i, this.dirty = je, r.pmViewDesc = this;
  }
  // Used to check whether a given description corresponds to a
  // widget/mark/node.
  matchesWidget(e) {
    return !1;
  }
  matchesMark(e) {
    return !1;
  }
  matchesNode(e, n, r) {
    return !1;
  }
  matchesHack(e) {
    return !1;
  }
  // When parsing in-editor content (in domchange.js), we allow
  // descriptions to determine the parse rules that should be used to
  // parse them.
  parseRule(e) {
    return null;
  }
  // Used by the editor's event handler to ignore events that come
  // from certain descs.
  stopEvent(e) {
    return !1;
  }
  // The size of the content represented by this desc.
  get size() {
    let e = 0;
    for (let n = 0; n < this.children.length; n++)
      e += this.children[n].size;
    return e;
  }
  // For block nodes, this represents the space taken up by their
  // start/end tokens.
  get border() {
    return 0;
  }
  destroy() {
    this.parent = void 0, this.dom.pmViewDesc == this && (this.dom.pmViewDesc = void 0);
    for (let e = 0; e < this.children.length; e++)
      this.children[e].destroy();
  }
  posBeforeChild(e) {
    for (let n = 0, r = this.posAtStart; ; n++) {
      let i = this.children[n];
      if (i == e)
        return r;
      r += i.size;
    }
  }
  get posBefore() {
    return this.parent.posBeforeChild(this);
  }
  get posAtStart() {
    return this.parent ? this.parent.posBeforeChild(this) + this.border : 0;
  }
  get posAfter() {
    return this.posBefore + this.size;
  }
  get posAtEnd() {
    return this.posAtStart + this.size - 2 * this.border;
  }
  localPosFromDOM(e, n, r) {
    if (this.contentDOM && kn(this.contentDOM, e))
      if (r < 0) {
        let o, s;
        if (e == this.contentDOM)
          o = e.childNodes[n - 1];
        else {
          for (; e.parentNode != this.contentDOM; )
            e = e.parentNode;
          o = e.previousSibling;
        }
        for (; o && !((s = o.pmViewDesc) && s.parent == this); )
          o = o.previousSibling;
        return o ? this.posBeforeChild(s) + s.size : this.posAtStart;
      } else {
        let o, s;
        if (e == this.contentDOM)
          o = e.childNodes[n];
        else {
          for (; e.parentNode != this.contentDOM; )
            e = e.parentNode;
          o = e.nextSibling;
        }
        for (; o && !((s = o.pmViewDesc) && s.parent == this); )
          o = o.nextSibling;
        return o ? this.posBeforeChild(s) : this.posAtEnd;
      }
    let i;
    if (e == this.dom && this.contentDOM)
      i = n > fe(this.contentDOM);
    else if (this.contentDOM && this.contentDOM != this.dom && this.dom.contains(this.contentDOM))
      i = !!(e.compareDocumentPosition(this.contentDOM) & 4);
    else if (this.dom.firstChild) {
      if (n == 0)
        for (let o = e; ; o = o.parentNode) {
          if (o == this.dom) {
            i = !1;
            break;
          }
          if (o.previousSibling)
            break;
        }
      if (i == null && n == e.childNodes.length)
        for (let o = e; ; o = o.parentNode) {
          if (o == this.dom) {
            i = !0;
            break;
          }
          if (o.nextSibling)
            break;
        }
    }
    return i ?? r > 0 ? this.posAtEnd : this.posAtStart;
  }
  nearestDesc(e, n = !1) {
    for (let r = !0, i = e; i; i = i.parentNode) {
      let o = this.getDesc(i), s;
      if (o && (!n || o.node))
        if (r && (s = o.nodeDOM) && !(z(s) ? kn(s, e) : s == e))
          r = !1;
        else
          return o;
    }
  }
  getDesc(e) {
    let n = e.pmViewDesc;
    for (let r = n; r; r = r.parent)
      if (r == this)
        return n;
  }
  posFromDOM(e, n, r) {
    for (let i = e; i; i = i.parentNode) {
      let o = this.getDesc(i);
      if (o)
        return o.localPosFromDOM(e, n, r);
    }
    return -1;
  }
  // Find the desc for the node after the given pos, if any. (When a
  // parent node overrode rendering, there might not be one.)
  descAt(e) {
    for (let n = 0, r = 0; n < this.children.length; n++) {
      let i = this.children[n], o = r + i.size;
      if (r == e && o != r) {
        for (; !i.border && i.children.length; )
          for (let s = 0; s < i.children.length; s++) {
            let l = i.children[s];
            if (l.size) {
              i = l;
              break;
            }
          }
        return i;
      }
      if (e < o)
        return i.descAt(e - r - i.border);
      r = o;
    }
  }
  domFromPos(e, n) {
    if (!this.contentDOM)
      return { node: this.dom, offset: 0, atom: e + 1 };
    let r = 0, i = 0;
    for (let o = 0; r < this.children.length; r++) {
      let s = this.children[r], l = o + s.size;
      if (l > e) {
        i = e - o;
        break;
      }
      o = l;
    }
    if (i)
      return this.children[r].domFromPos(i - this.children[r].border, n);
    for (; r > 0; r--) {
      let o = this.children[r - 1];
      if (o.size || !(o instanceof Jf || o instanceof Uf && o.side >= 0))
        break;
    }
    if (n <= 0) {
      let o, s = !0;
      for (; o = r ? this.children[r - 1] : null, !(!o || o.dom.parentNode == this.contentDOM); r--, s = !1)
        ;
      return o && n && s && !o.border && !o.domAtom ? o.domFromPos(o.size, n) : { node: this.contentDOM, offset: o ? fe(o.dom) + 1 : 0 };
    } else {
      let o, s = !0;
      for (; o = r < this.children.length ? this.children[r] : null, !(!o || o.dom.parentNode == this.contentDOM); r++, s = !1)
        ;
      return o && s && !o.border && !o.domAtom ? o.domFromPos(0, n) : { node: this.contentDOM, offset: o ? fe(o.dom) : this.contentDOM.childNodes.length };
    }
  }
  // Used to find a DOM range in a single parent for a given changed
  // range.
  parseRange(e, n, r = 0) {
    if (this.children.length == 0)
      return { node: this.contentDOM, from: e, to: n, fromOffset: 0, toOffset: this.contentDOM.childNodes.length };
    let i = -1, o = -1;
    for (let s = r, l = 0; ; l++) {
      let a = this.children[l], c = s + a.size;
      if (i == -1 && e <= c) {
        let u = s + a.border;
        if (e >= u && n <= c - a.border && a.node && a.contentDOM && this.contentDOM.contains(a.contentDOM))
          return a.parseRange(e, n, u);
        e = s;
        for (let h = l; h > 0; h--) {
          let d = this.children[h - 1];
          if (d.size && d.dom.parentNode == this.contentDOM && !d.emptyChildAt(1)) {
            i = fe(d.dom) + 1;
            break;
          }
          e -= d.size;
        }
        i == -1 && (i = 0);
      }
      if (i > -1 && (c > n || l == this.children.length - 1)) {
        n = c;
        for (let u = l + 1; u < this.children.length; u++) {
          let h = this.children[u];
          if (h.size && h.dom.parentNode == this.contentDOM && !h.emptyChildAt(-1)) {
            o = fe(h.dom);
            break;
          }
          n += h.size;
        }
        o == -1 && (o = this.contentDOM.childNodes.length);
        break;
      }
      s = c;
    }
    return { node: this.contentDOM, from: e, to: n, fromOffset: i, toOffset: o };
  }
  emptyChildAt(e) {
    if (this.border || !this.contentDOM || !this.children.length)
      return !1;
    let n = this.children[e < 0 ? 0 : this.children.length - 1];
    return n.size == 0 || n.emptyChildAt(e);
  }
  domAfterPos(e) {
    let { node: n, offset: r } = this.domFromPos(e, 0);
    if (!z(n) || r == n.childNodes.length)
      throw new RangeError("No node after pos " + e);
    return n.childNodes[r];
  }
  // View descs are responsible for setting any selection that falls
  // entirely inside of them, so that custom implementations can do
  // custom things with the selection. Note that this falls apart when
  // a selection starts in such a node and ends in another, in which
  // case we just use whatever domFromPos produces as a best effort.
  setSelection(e, n, r, i = !1) {
    let o = Math.min(e, n), s = Math.max(e, n);
    for (let f = 0, p = 0; f < this.children.length; f++) {
      let m = this.children[f], y = p + m.size;
      if (o > p && s < y)
        return m.setSelection(e - p - m.border, n - p - m.border, r, i);
      p = y;
    }
    let l = this.domFromPos(e, e ? -1 : 1), a = n == e ? l : this.domFromPos(n, n ? -1 : 1), c = r.root.getSelection(), u = r.domSelectionRange(), h = !1;
    if ((Be || xe) && e == n) {
      let { node: f, offset: p } = l;
      if (se(f)) {
        if (h = !!(p && f.nodeValue[p - 1] == `
`), h && p == f.nodeValue.length)
          for (let m = f, y; m; m = m.parentNode) {
            if (y = m.nextSibling) {
              y.nodeName == "BR" && (l = a = { node: y.parentNode, offset: fe(y) + 1 });
              break;
            }
            let g = m.pmViewDesc;
            if (g && g.node && g.node.isBlock)
              break;
          }
      } else {
        let m = f.childNodes[p - 1];
        h = m && (m.nodeName == "BR" || m.contentEditable == "false");
      }
    }
    if (Be && u.focusNode && u.focusNode != a.node && z(u.focusNode)) {
      let f = u.focusNode.childNodes[u.focusOffset];
      f && f.contentEditable == "false" && (i = !0);
    }
    if (!(i || h && xe) && yn(l.node, l.offset, u.anchorNode, u.anchorOffset) && yn(a.node, a.offset, u.focusNode, u.focusOffset))
      return;
    let d = !1;
    if ((c.extend || e == n) && !(h && Be)) {
      c.collapse(l.node, l.offset);
      try {
        e != n && c.extend(a.node, a.offset), d = !0;
      } catch {
      }
    }
    if (!d) {
      if (e > n) {
        let p = l;
        l = a, a = p;
      }
      let f = document.createRange();
      f.setEnd(a.node, a.offset), f.setStart(l.node, l.offset), c.removeAllRanges(), c.addRange(f);
    }
  }
  ignoreMutation(e) {
    return !this.contentDOM && e.type != "selection";
  }
  get contentLost() {
    return this.contentDOM && this.contentDOM != this.dom && !this.dom.contains(this.contentDOM);
  }
  // Remove a subtree of the element tree that has been touched
  // by a DOM change, so that the next update will redraw it.
  markDirty(e, n) {
    for (let r = 0, i = 0; i < this.children.length; i++) {
      let o = this.children[i], s = r + o.size;
      if (r == s ? e <= s && n >= r : e < s && n > r) {
        let l = r + o.border, a = s - o.border;
        if (e >= l && n <= a) {
          this.dirty = e == r || n == s ? on : Gc, e == l && n == a && (o.contentLost || o.dom.parentNode != this.contentDOM) ? o.dirty = et : o.markDirty(e - l, n - l);
          return;
        } else
          o.dirty = o.dom == o.contentDOM && o.dom.parentNode == this.contentDOM && !o.children.length ? on : et;
      }
      r = s;
    }
    this.dirty = on;
  }
  markParentsDirty() {
    let e = 1;
    for (let n = this.parent; n; n = n.parent, e++) {
      let r = e == 1 ? on : Gc;
      n.dirty < r && (n.dirty = r);
    }
  }
  get domAtom() {
    return !1;
  }
  get ignoreForCoords() {
    return !1;
  }
  get ignoreForSelection() {
    return !1;
  }
  isText(e) {
    return !1;
  }
}
class Uf extends Fr {
  constructor(e, n, r, i) {
    let o, s = n.type.toDOM;
    if (typeof s == "function" && (s = s(r, () => {
      if (!o)
        return i;
      if (o.parent)
        return o.parent.posBeforeChild(o);
    })), !n.type.spec.raw) {
      let l = z(s) ? s : document.createElement("span");
      l != s && l.appendChild(s), l.hasAttribute("contenteditable") || (l.contentEditable = "false"), l.classList.add("ProseMirror-widget");
    }
    super(e, [], s, null), this.widget = n, this.widget = n, o = this;
  }
  matchesWidget(e) {
    return this.dirty == je && e.type.eq(this.widget.type);
  }
  parseRule() {
    return { ignore: !0 };
  }
  stopEvent(e) {
    let n = this.widget.spec.stopEvent;
    return n ? n(e) : !1;
  }
  ignoreMutation(e) {
    return e.type != "selection" || this.widget.spec.ignoreSelection;
  }
  destroy() {
    this.widget.type.destroy(this.dom), super.destroy();
  }
  get domAtom() {
    return !0;
  }
  get ignoreForSelection() {
    return !!this.widget.type.spec.relaxedSide;
  }
  get side() {
    return this.widget.type.side;
  }
}
class P0 extends Fr {
  constructor(e, n, r, i) {
    super(e, [], n, null), this.textDOM = r, this.text = i;
  }
  get size() {
    return this.text.length;
  }
  localPosFromDOM(e, n) {
    return e != this.textDOM ? this.posAtStart + (n ? this.size : 0) : this.posAtStart + n;
  }
  domFromPos(e) {
    return { node: this.textDOM, offset: e };
  }
  ignoreMutation(e) {
    return e.type === "characterData" && e.target.nodeValue == e.oldValue;
  }
}
class Ht extends Fr {
  constructor(e, n, r, i, o) {
    super(e, [], r, i), this.mark = n, this.spec = o;
  }
  static create(e, n, r, i) {
    let o = i.nodeViews[n.type.name], s = o && o(n, i, r);
    return (!s || !s.dom) && (s = Hn.renderSpec(document, n.type.spec.toDOM(n, r), null, n.attrs)), new Ht(e, n, s.dom, s.contentDOM || s.dom, s);
  }
  parseRule() {
    return this.dirty & et || this.mark.type.spec.reparseInView ? null : { mark: this.mark.type.name, attrs: this.mark.attrs, contentElement: this.contentDOM };
  }
  matchesMark(e) {
    return this.dirty != et && this.mark.eq(e);
  }
  markDirty(e, n) {
    if (super.markDirty(e, n), this.dirty != je) {
      let r = this.parent;
      for (; !r.node; )
        r = r.parent;
      r.dirty < this.dirty && (r.dirty = this.dirty), this.dirty = je;
    }
  }
  slice(e, n, r) {
    let i = Ht.create(this.parent, this.mark, !0, r), o = this.children, s = this.size;
    n < s && (o = Ds(o, n, s, r)), e > 0 && (o = Ds(o, 0, e, r));
    for (let l = 0; l < o.length; l++)
      o[l].parent = i;
    return i.children = o, i;
  }
  ignoreMutation(e) {
    return this.spec.ignoreMutation ? this.spec.ignoreMutation(e) : super.ignoreMutation(e);
  }
  destroy() {
    this.spec.destroy && this.spec.destroy(), super.destroy();
  }
}
class jt extends Fr {
  constructor(e, n, r, i, o, s, l) {
    super(e, [], o, s), this.node = n, this.outerDeco = r, this.innerDeco = i, this.nodeDOM = l;
  }
  // By default, a node is rendered using the `toDOM` method from the
  // node type spec. But client code can use the `nodeViews` spec to
  // supply a custom node view, which can influence various aspects of
  // the way the node works.
  //
  // (Using subclassing for this was intentionally decided against,
  // since it'd require exposing a whole slew of finicky
  // implementation details to the user code that they probably will
  // never need.)
  static create(e, n, r, i, o, s) {
    let l = o.nodeViews[n.type.name], a, c = l && l(n, o, () => {
      if (!a)
        return s;
      if (a.parent)
        return a.parent.posBeforeChild(a);
    }, r, i), u = c && c.dom, h = c && c.contentDOM;
    if (n.isText) {
      if (!u)
        u = document.createTextNode(n.text);
      else if (!se(u))
        throw new RangeError("Text must be rendered as a DOM text node");
    } else u || ({ dom: u, contentDOM: h } = Hn.renderSpec(document, n.type.spec.toDOM(n), null, n.attrs));
    !h && !n.isText && u.nodeName != "BR" && (u.hasAttribute("contenteditable") || (u.contentEditable = "false"), n.type.spec.draggable && (u.draggable = !0));
    let d = u;
    return u = Qf(u, r, n), c ? a = new L0(e, n, r, i, u, h || null, d, c) : n.isText ? new ro(e, n, r, i, u, d) : new jt(e, n, r, i, u, h || null, d);
  }
  parseRule(e) {
    if (this.node.type.spec.reparseInView)
      return null;
    let n = { node: this.node.type.name, attrs: this.node.attrs };
    if (this.node.type.whitespace == "pre" && (n.preserveWhitespace = "full"), !this.contentDOM)
      n.getContent = () => this.node.content;
    else if (!this.contentLost)
      n.contentElement = this.contentDOM;
    else {
      for (let r = this.children.length - 1; r >= 0; r--) {
        let i = this.children[r];
        if (this.dom.contains(i.dom.parentNode)) {
          n.contentElement = i.dom.parentNode;
          break;
        }
      }
      if (!n.contentElement) {
        let r = e && e.find((i) => z(i) && e.indexOf(i.parentNode) < 0 && this.dom.contains(i));
        r ? n.contentElement = r : n.getContent = () => T.empty;
      }
    }
    return n;
  }
  matchesNode(e, n, r) {
    return this.dirty == je && e.eq(this.node) && Ri(n, this.outerDeco) && r.eq(this.innerDeco);
  }
  get size() {
    return this.node.nodeSize;
  }
  get border() {
    return this.node.isLeaf ? 0 : 1;
  }
  // Syncs `this.children` to match `this.node.content` and the local
  // decorations, possibly introducing nesting for marks. Then, in a
  // separate step, syncs the DOM inside `this.contentDOM` to
  // `this.children`.
  updateChildren(e, n) {
    let r = this.node.inlineContent, i = n, o = e.composing ? this.localCompositionInfo(e, n) : null, s = o && o.pos > -1 ? o : null, l = o && o.pos < 0, a = new F0(this, s && s.node, e), c = this.node.inlineContent, u = c && this.node.isBlock;
    V0(this.node, this.innerDeco, (h, d, f) => {
      h.spec.marks ? a.syncToMarks(h.spec.marks, r, e, d) : h.type.side >= 0 && !f && a.syncToMarks(d == this.node.childCount ? J.none : this.node.child(d).marks, r, e, d), a.placeWidget(h, e, i);
    }, (h, d, f, p) => {
      a.syncToMarks(h.marks, r, e, p), u && h.isAtom && !h.isText && a.addHackNode("IMG", a.top);
      let m;
      a.findNodeMatch(h, d, f, p) || l && e.state.selection.from > i && e.state.selection.to < i + h.nodeSize && (m = a.findIndexWithChild(o.node)) > -1 && a.updateNodeAt(h, d, f, m, e) || a.updateNextNode(h, d, f, e, p, i) || a.addNode(h, d, f, e, i), i += h.nodeSize, c && (u = h.isAtom && !h.isText);
    }), a.syncToMarks([], r, e, 0), this.node.isTextblock && a.addTextblockHacks(), a.destroyRest(), (a.changed || this.dirty == on) && (s && this.protectLocalComposition(e, s), Gf(this.contentDOM, this.children, e), Bn && H0(this.dom));
  }
  localCompositionInfo(e, n) {
    let { from: r, to: i } = e.state.selection;
    if (!(e.state.selection instanceof V) || r < n || i > n + this.node.content.size)
      return null;
    let o = e.input.compositionNode;
    if (!o || !this.dom.contains(o.parentNode))
      return null;
    if (this.node.inlineContent) {
      let s = o.nodeValue, l = j0(this.node.content, s, r - n, i - n);
      return l < 0 ? null : { node: o, pos: l, text: s };
    } else
      return { node: o, pos: -1, text: "" };
  }
  protectLocalComposition(e, { node: n, pos: r, text: i }) {
    if (this.getDesc(n))
      return;
    let o = n;
    for (; o.parentNode != this.contentDOM; o = o.parentNode) {
      for (; o.previousSibling; )
        o.parentNode.removeChild(o.previousSibling);
      for (; o.nextSibling; )
        o.parentNode.removeChild(o.nextSibling);
      o.pmViewDesc && (o.pmViewDesc = void 0);
    }
    let s = new P0(this, o, n, i);
    e.input.compositionNodes.push(s), this.children = Ds(this.children, r, r + i.length, e, s);
  }
  // If this desc must be updated to match the given node decoration,
  // do so and return true.
  update(e, n, r, i) {
    return this.dirty == et || !e.sameMarkup(this.node) ? !1 : (this.updateInner(e, n, r, i), !0);
  }
  updateInner(e, n, r, i) {
    this.updateOuterDeco(n), this.node = e, this.innerDeco = r, this.contentDOM && this.updateChildren(i, this.posAtStart), this.dirty = je;
  }
  updateOuterDeco(e) {
    if (Ri(e, this.outerDeco))
      return;
    let n = !z(this.nodeDOM), r = this.dom;
    this.dom = Yf(this.dom, this.nodeDOM, vs(this.outerDeco, this.node, n), vs(e, this.node, n)), this.dom != r && (r.pmViewDesc = void 0, this.dom.pmViewDesc = this), this.outerDeco = e;
  }
  // Mark this node as being the selected node.
  selectNode() {
    z(this.nodeDOM) && (this.nodeDOM.classList.add("ProseMirror-selectednode"), (this.contentDOM || !this.node.type.spec.draggable) && (this.nodeDOM.draggable = !0));
  }
  // Remove selected node marking from this node.
  deselectNode() {
    z(this.nodeDOM) && (this.nodeDOM.classList.remove("ProseMirror-selectednode"), (this.contentDOM || !this.node.type.spec.draggable) && this.nodeDOM.removeAttribute("draggable"));
  }
  get domAtom() {
    return this.node.isAtom;
  }
}
function Yc(t, e, n, r, i) {
  Qf(r, e, t);
  let o = new jt(void 0, t, e, n, r, r, r);
  return o.contentDOM && o.updateChildren(i, 0), o;
}
class ro extends jt {
  constructor(e, n, r, i, o, s) {
    super(e, n, r, i, o, null, s);
  }
  parseRule() {
    let e = this.nodeDOM.parentNode;
    for (; e && e != this.dom && !e.pmIsDeco; )
      e = e.parentNode;
    return { skip: e || !0 };
  }
  update(e, n, r, i) {
    return this.dirty == et || this.dirty != je && !this.inParent() || !e.sameMarkup(this.node) ? !1 : (this.updateOuterDeco(n), (this.dirty != je || e.text != this.node.text) && e.text != this.nodeDOM.nodeValue && (this.nodeDOM.nodeValue = e.text, i.trackWrites == this.nodeDOM && (i.trackWrites = null)), this.node = e, this.dirty = je, !0);
  }
  inParent() {
    let e = this.parent.contentDOM;
    for (let n = this.nodeDOM; n; n = n.parentNode)
      if (n == e)
        return !0;
    return !1;
  }
  domFromPos(e) {
    return { node: this.nodeDOM, offset: e };
  }
  localPosFromDOM(e, n, r) {
    return e == this.nodeDOM ? this.posAtStart + Math.min(n, this.node.text.length) : super.localPosFromDOM(e, n, r);
  }
  ignoreMutation(e) {
    return e.type != "characterData" && e.type != "selection";
  }
  slice(e, n, r) {
    let i = this.node.cut(e, n), o = document.createTextNode(i.text);
    return new ro(this.parent, i, this.outerDeco, this.innerDeco, o, o);
  }
  markDirty(e, n) {
    super.markDirty(e, n), this.dom != this.nodeDOM && (e == 0 || n == this.nodeDOM.nodeValue.length) && (this.dirty = et);
  }
  get domAtom() {
    return !1;
  }
  isText(e) {
    return this.node.text == e;
  }
}
class Jf extends Fr {
  parseRule() {
    return { ignore: !0 };
  }
  matchesHack(e) {
    return this.dirty == je && this.dom.nodeName == e;
  }
  get domAtom() {
    return !0;
  }
  get ignoreForCoords() {
    return this.dom.nodeName == "IMG";
  }
}
class L0 extends jt {
  constructor(e, n, r, i, o, s, l, a) {
    super(e, n, r, i, o, s, l), this.spec = a;
  }
  // A custom `update` method gets to decide whether the update goes
  // through. If it does, and there's a `contentDOM` node, our logic
  // updates the children.
  update(e, n, r, i) {
    if (this.dirty == et)
      return !1;
    if (this.spec.update && (this.node.type == e.type || this.spec.multiType)) {
      let o = this.spec.update(e, n, r);
      return o && this.updateInner(e, n, r, i), o;
    } else return !this.contentDOM && !e.isLeaf ? !1 : super.update(e, n, r, i);
  }
  selectNode() {
    this.spec.selectNode ? this.spec.selectNode() : super.selectNode();
  }
  deselectNode() {
    this.spec.deselectNode ? this.spec.deselectNode() : super.deselectNode();
  }
  setSelection(e, n, r, i) {
    this.spec.setSelection ? this.spec.setSelection(e, n, r.root) : super.setSelection(e, n, r, i);
  }
  destroy() {
    this.spec.destroy && this.spec.destroy(), super.destroy();
  }
  stopEvent(e) {
    return this.spec.stopEvent ? this.spec.stopEvent(e) : !1;
  }
  ignoreMutation(e) {
    return this.spec.ignoreMutation ? this.spec.ignoreMutation(e) : super.ignoreMutation(e);
  }
}
function Gf(t, e, n) {
  let r = t.firstChild, i = !1;
  for (let o = 0; o < e.length; o++) {
    let s = e[o], l = s.dom;
    if (l.parentNode == t) {
      for (; l != r; )
        r = Qc(r), i = !0;
      r = r.nextSibling;
    } else
      i = !0, t.insertBefore(l, r);
    if (s instanceof Ht) {
      let a = r ? r.previousSibling : t.lastChild;
      Gf(s.contentDOM, s.children, n), r = a ? a.nextSibling : t.firstChild;
    }
  }
  for (; r; )
    r = Qc(r), i = !0;
  i && n.trackWrites == t && (n.trackWrites = null);
}
const pr = function(t) {
  t && (this.nodeName = t);
};
pr.prototype = /* @__PURE__ */ Object.create(null);
const sn = [new pr()];
function vs(t, e, n) {
  if (t.length == 0)
    return sn;
  let r = n ? sn[0] : new pr(), i = [r];
  for (let o = 0; o < t.length; o++) {
    let s = t[o].type.attrs;
    if (s) {
      s.nodeName && i.push(r = new pr(s.nodeName));
      for (let l in s) {
        let a = s[l];
        a != null && (n && i.length == 1 && i.push(r = new pr(e.isInline ? "span" : "div")), l == "class" ? r.class = (r.class ? r.class + " " : "") + a : l == "style" ? r.style = (r.style ? r.style + ";" : "") + a : l != "nodeName" && (r[l] = a));
      }
    }
  }
  return i;
}
function Yf(t, e, n, r) {
  if (n == sn && r == sn)
    return e;
  let i = e;
  for (let o = 0; o < r.length; o++) {
    let s = r[o], l = n[o];
    if (o) {
      let a;
      l && l.nodeName == s.nodeName && i != t && (a = i.parentNode) && a.nodeName.toLowerCase() == s.nodeName || (a = document.createElement(s.nodeName), a.pmIsDeco = !0, a.appendChild(i), l = sn[0]), i = a;
    }
    B0(i, l || sn[0], s);
  }
  return i;
}
function B0(t, e, n) {
  for (let r in e)
    r != "class" && r != "style" && r != "nodeName" && !(r in n) && t.removeAttribute(r);
  for (let r in n)
    r != "class" && r != "style" && r != "nodeName" && n[r] != e[r] && t.setAttribute(r, n[r]);
  if (e.class != n.class) {
    let r = e.class ? e.class.split(" ").filter(Boolean) : [], i = n.class ? n.class.split(" ").filter(Boolean) : [];
    for (let o = 0; o < r.length; o++)
      i.indexOf(r[o]) == -1 && t.classList.remove(r[o]);
    for (let o = 0; o < i.length; o++)
      r.indexOf(i[o]) == -1 && t.classList.add(i[o]);
    t.classList.length == 0 && t.removeAttribute("class");
  }
  if (e.style != n.style) {
    if (e.style) {
      let r = /\s*([\w\-\xa1-\uffff]+)\s*:(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\(.*?\)|[^;])*/g, i;
      for (; i = r.exec(e.style); )
        t.style.removeProperty(i[1]);
    }
    n.style && (t.style.cssText += n.style);
  }
}
function Qf(t, e, n) {
  return Yf(t, t, sn, vs(e, n, !z(t)));
}
function Ri(t, e) {
  if (t.length != e.length)
    return !1;
  for (let n = 0; n < t.length; n++)
    if (!t[n].type.eq(e[n].type))
      return !1;
  return !0;
}
function Qc(t) {
  let e = t.nextSibling;
  return t.parentNode.removeChild(t), e;
}
class F0 {
  constructor(e, n, r) {
    this.lock = n, this.view = r, this.index = 0, this.stack = [], this.changed = !1, this.top = e, this.preMatch = _0(e.node.content, e);
  }
  // Destroy and remove the children between the given indices in
  // `this.top`.
  destroyBetween(e, n) {
    if (e != n) {
      for (let r = e; r < n; r++)
        this.top.children[r].destroy();
      this.top.children.splice(e, n - e), this.changed = !0;
    }
  }
  // Destroy all remaining children in `this.top`.
  destroyRest() {
    this.destroyBetween(this.index, this.top.children.length);
  }
  // Sync the current stack of mark descs with the given array of
  // marks, reusing existing mark descs when possible.
  syncToMarks(e, n, r, i) {
    let o = 0, s = this.stack.length >> 1, l = Math.min(s, e.length);
    for (; o < l && (o == s - 1 ? this.top : this.stack[o + 1 << 1]).matchesMark(e[o]) && e[o].type.spec.spanning !== !1; )
      o++;
    for (; o < s; )
      this.destroyRest(), this.top.dirty = je, this.index = this.stack.pop(), this.top = this.stack.pop(), s--;
    for (; s < e.length; ) {
      this.stack.push(this.top, this.index + 1);
      let a = -1, c = this.top.children.length;
      i < this.preMatch.index && (c = Math.min(this.index + 3, c));
      for (let u = this.index; u < c; u++) {
        let h = this.top.children[u];
        if (h.matchesMark(e[s]) && !this.isLocked(h.dom)) {
          a = u;
          break;
        }
      }
      if (a < 0 && this.index < this.top.children.length) {
        let u = this.top.children[this.index];
        u instanceof Ht && u.dirty != et && u.mark.type == e[s].type && u.spec.update && !this.isLocked(u.dom) && u.spec.update(e[s]) && (u.mark = e[s], a = this.index, this.changed = !0);
      }
      if (a > -1)
        a > this.index && (this.changed = !0, this.destroyBetween(this.index, a)), this.top = this.top.children[this.index];
      else {
        let u = Ht.create(this.top, e[s], n, r);
        this.top.children.splice(this.index, 0, u), this.top = u, this.changed = !0;
      }
      this.index = 0, s++;
    }
  }
  // Try to find a node desc matching the given data. Skip over it and
  // return true when successful.
  findNodeMatch(e, n, r, i) {
    let o = -1, s;
    if (i >= this.preMatch.index && (s = this.preMatch.matches[i - this.preMatch.index]).parent == this.top && s.matchesNode(e, n, r))
      o = this.top.children.indexOf(s, this.index);
    else
      for (let l = this.index, a = Math.min(this.top.children.length, l + 5); l < a; l++) {
        let c = this.top.children[l];
        if (c.matchesNode(e, n, r) && !this.preMatch.matched.has(c)) {
          o = l;
          break;
        }
      }
    return o < 0 ? !1 : (this.destroyBetween(this.index, o), this.index++, !0);
  }
  updateNodeAt(e, n, r, i, o) {
    let s = this.top.children[i];
    return s.dirty == et && s.dom == s.contentDOM && (s.dirty = on), s.update(e, n, r, o) ? (this.destroyBetween(this.index, i), this.index++, !0) : !1;
  }
  findIndexWithChild(e) {
    for (; ; ) {
      let n = e.parentNode;
      if (!n)
        return -1;
      if (n == this.top.contentDOM) {
        let r = e.pmViewDesc;
        if (r) {
          for (let i = this.index; i < this.top.children.length; i++)
            if (this.top.children[i] == r)
              return i;
        }
        return -1;
      }
      e = n;
    }
  }
  // Try to update the next node, if any, to the given data. Checks
  // pre-matches to avoid overwriting nodes that could still be used.
  updateNextNode(e, n, r, i, o, s) {
    for (let l = this.index; l < this.top.children.length; l++) {
      let a = this.top.children[l];
      if (a instanceof jt) {
        let c = this.preMatch.matched.get(a);
        if (c != null && c != o)
          return !1;
        let u = a.dom, h, d = this.isLocked(u) && !(e.isText && a.node && a.node.isText && a.nodeDOM.nodeValue == e.text && a.dirty != et && Ri(n, a.outerDeco));
        if (!d && a.update(e, n, r, i))
          return this.destroyBetween(this.index, l), a.dom != u && (this.changed = !0), this.index++, !0;
        if (!d && (h = this.recreateWrapper(a, e, n, r, i, s)))
          return this.destroyBetween(this.index, l), this.top.children[this.index] = h, h.contentDOM && (h.dirty = on, h.updateChildren(i, s + 1), h.dirty = je), this.changed = !0, this.index++, !0;
        break;
      }
    }
    return !1;
  }
  // When a node with content is replaced by a different node with
  // identical content, move over its children.
  recreateWrapper(e, n, r, i, o, s) {
    if (e.dirty || n.isAtom || !e.children.length || !e.node.content.eq(n.content) || !Ri(r, e.outerDeco) || !i.eq(e.innerDeco))
      return null;
    let l = jt.create(this.top, n, r, i, o, s);
    if (l.contentDOM) {
      l.children = e.children, e.children = [];
      for (let a of l.children)
        a.parent = l;
    }
    return e.destroy(), l;
  }
  // Insert the node as a newly created node desc.
  addNode(e, n, r, i, o) {
    let s = jt.create(this.top, e, n, r, i, o);
    s.contentDOM && s.updateChildren(i, o + 1), this.top.children.splice(this.index++, 0, s), this.changed = !0;
  }
  placeWidget(e, n, r) {
    let i = this.index < this.top.children.length ? this.top.children[this.index] : null;
    if (i && i.matchesWidget(e) && (e == i.widget || !i.widget.type.toDOM.parentNode))
      this.index++;
    else {
      let o = new Uf(this.top, e, n, r);
      this.top.children.splice(this.index++, 0, o), this.changed = !0;
    }
  }
  // Make sure a textblock looks and behaves correctly in
  // contentEditable.
  addTextblockHacks() {
    let e = this.top.children[this.index - 1], n = this.top;
    for (; e instanceof Ht; )
      n = e, e = n.children[n.children.length - 1];
    (!e || // Empty textblock
    !(e instanceof ro) || /\n$/.test(e.node.text) || this.view.requiresGeckoHackNode && /\s$/.test(e.node.text)) && ((xe || pe) && e && e.dom.contentEditable == "false" && this.addHackNode("IMG", n), this.addHackNode("BR", this.top));
  }
  addHackNode(e, n) {
    if (n == this.top && this.index < n.children.length && n.children[this.index].matchesHack(e))
      this.index++;
    else {
      let r = document.createElement(e);
      e == "IMG" && (r.className = "ProseMirror-separator", r.alt = ""), e == "BR" && (r.className = "ProseMirror-trailingBreak");
      let i = new Jf(this.top, [], r, null);
      n != this.top ? n.children.push(i) : n.children.splice(this.index++, 0, i), this.changed = !0;
    }
  }
  isLocked(e) {
    return this.lock && (e == this.lock || z(e) && e.contains(this.lock.parentNode));
  }
}
function _0(t, e) {
  let n = e, r = n.children.length, i = t.childCount, o = /* @__PURE__ */ new Map(), s = [];
  e: for (; i > 0; ) {
    let l;
    for (; ; )
      if (r) {
        let c = n.children[r - 1];
        if (c instanceof Ht)
          n = c, r = c.children.length;
        else {
          l = c, r--;
          break;
        }
      } else {
        if (n == e)
          break e;
        r = n.parent.children.indexOf(n), n = n.parent;
      }
    let a = l.node;
    if (a) {
      if (a != t.child(i - 1))
        break;
      --i, o.set(l, i), s.push(l);
    }
  }
  return { index: i, matched: o, matches: s.reverse() };
}
function $0(t, e) {
  return t.type.side - e.type.side;
}
function V0(t, e, n, r) {
  let i = e.locals(t), o = 0;
  if (i.length == 0) {
    for (let c = 0; c < t.childCount; c++) {
      let u = t.child(c);
      r(u, i, e.forChild(o, u), c), o += u.nodeSize;
    }
    return;
  }
  let s = 0, l = [], a = null;
  for (let c = 0; ; ) {
    let u, h;
    for (; s < i.length && i[s].to == o; ) {
      let y = i[s++];
      y.widget && (u ? (h || (h = [u])).push(y) : u = y);
    }
    if (u)
      if (h) {
        h.sort($0);
        for (let y = 0; y < h.length; y++)
          n(h[y], c, !!a);
      } else
        n(u, c, !!a);
    let d, f;
    if (a)
      f = -1, d = a, a = null;
    else if (c < t.childCount)
      f = c, d = t.child(c++);
    else
      break;
    for (let y = 0; y < l.length; y++)
      l[y].to <= o && l.splice(y--, 1);
    for (; s < i.length && i[s].from <= o && i[s].to > o; )
      l.push(i[s++]);
    let p = o + d.nodeSize;
    if (d.isText) {
      let y = p;
      s < i.length && i[s].from < y && (y = i[s].from);
      for (let g = 0; g < l.length; g++)
        l[g].to < y && (y = l[g].to);
      y < p && (a = d.cut(y - o), d = d.cut(0, y - o), p = y, f = -1);
    } else
      for (; s < i.length && i[s].to < p; )
        s++;
    let m = d.isInline && !d.isLeaf ? l.filter((y) => !y.inline) : l.slice();
    r(d, m, e.forChild(o, d), f), o = p;
  }
}
function H0(t) {
  if (t.nodeName == "UL" || t.nodeName == "OL") {
    let e = t.style.cssText;
    t.style.cssText = e + "; list-style: square !important", window.getComputedStyle(t).listStyle, t.style.cssText = e;
  }
}
function j0(t, e, n, r) {
  for (let i = 0, o = 0; i < t.childCount && o <= r; ) {
    let s = t.child(i++), l = o;
    if (o += s.nodeSize, !s.isText)
      continue;
    let a = s.text;
    for (; i < t.childCount; ) {
      let c = t.child(i++);
      if (o += c.nodeSize, !c.isText)
        break;
      a += c.text;
    }
    if (o >= n) {
      if (o >= r && a.slice(r - e.length - l, r - l) == e)
        return r - e.length;
      let c = l < r ? a.lastIndexOf(e, r - l - 1) : -1;
      if (c >= 0 && c + e.length + l >= n)
        return l + c;
      if (n == r && a.length >= r + e.length - l && a.slice(r - l, r - l + e.length) == e)
        return r;
    }
  }
  return -1;
}
function Ds(t, e, n, r, i) {
  let o = [];
  for (let s = 0, l = 0; s < t.length; s++) {
    let a = t[s], c = l, u = l += a.size;
    c >= n || u <= e ? o.push(a) : (c < e && o.push(a.slice(0, e - c, r)), i && (o.push(i), i = void 0), u > n && o.push(a.slice(n - c, a.size, r)));
  }
  return o;
}
function Cl(t, e = null) {
  let n = t.domSelectionRange(), r = t.state.doc;
  if (!n.focusNode)
    return null;
  let i = t.docView.nearestDesc(n.focusNode), o = i && i.size == 0, s = t.docView.posFromDOM(n.focusNode, n.focusOffset, 1);
  if (s < 0)
    return null;
  let l = r.resolve(s), a, c;
  if (to(n)) {
    for (a = s; i && !i.node; )
      i = i.parent;
    if (i && i.node.isAtom && _.isSelectable(i.node) && i.parent && !(i.node.isInline && g0(n.focusNode, n.focusOffset, i.dom))) {
      let h = i.posBefore;
      c = new _(s == h ? l : r.resolve(h));
    } else if (Be && e == "key" && s > t.state.selection.to && z(n.focusNode) && n.focusOffset == n.focusNode.childNodes.length && i && i.posAtStart > t.state.selection.to)
      for (let h = n.focusNode; ; h = h.parentNode) {
        if (getComputedStyle(h).overflow != "visible") {
          c = $.findFrom(r.resolve(i.posAtStart), 1);
          break;
        }
        if (h == i.dom || h.nextSibling || !h.parentNode || !z(h.parentNode))
          break;
      }
  } else {
    if (n instanceof t.dom.ownerDocument.defaultView.Selection && n.rangeCount > 1) {
      let h = s, d = s;
      for (let f = 0; f < n.rangeCount; f++) {
        let p = n.getRangeAt(f);
        h = Math.min(h, t.docView.posFromDOM(p.startContainer, p.startOffset, 1)), d = Math.max(d, t.docView.posFromDOM(p.endContainer, p.endOffset, -1));
      }
      if (h < 0)
        return null;
      [a, s] = d == t.state.selection.anchor ? [d, h] : [h, d], l = r.resolve(s);
    } else
      a = t.docView.posFromDOM(n.anchorNode, n.anchorOffset, 1);
    if (a < 0)
      return null;
  }
  let u = r.resolve(a);
  if (!c) {
    let h = e == "pointer" || t.state.selection.head < l.pos && !o ? 1 : -1;
    c = Sl(t, u, l, h);
  }
  return c;
}
function Xf(t) {
  return t.editable ? t.hasFocus() : ed(t) && document.activeElement && document.activeElement.contains(t.dom);
}
function St(t, e = !1) {
  let n = t.state.selection;
  if (Zf(t, n), !Xf(t))
    return;
  let r = t.input.mouseDown;
  if (!e && pe && r) {
    let i = t.domSelectionRange(), o = t.domObserver.currentSelection;
    if (i.anchorNode && o.anchorNode && yn(i.anchorNode, i.anchorOffset, o.anchorNode, o.anchorOffset) && r.delaySelUpdate()) {
      t.domObserver.setCurSelection();
      return;
    }
  }
  if (t.domObserver.disconnectSelection(), t.cursorWrapper)
    W0(t);
  else {
    let { anchor: i, head: o } = n, s, l;
    Xc && !(n instanceof V) && (n.$from.parent.inlineContent || (s = Zc(t, n.from)), !n.empty && !n.$from.parent.inlineContent && (l = Zc(t, n.to))), t.docView.setSelection(i, o, t, e), Xc && (s && eu(s), l && eu(l)), n.visible ? t.dom.classList.remove("ProseMirror-hideselection") : (t.dom.classList.add("ProseMirror-hideselection"), "onselectionchange" in document && q0(t));
  }
  t.domObserver.setCurSelection(), t.domObserver.connectSelection();
}
const Xc = xe || pe && _f < 63;
function Zc(t, e) {
  let { node: n, offset: r } = t.docView.domFromPos(e, 0), i = r < n.childNodes.length ? n.childNodes[r] : null, o = r ? n.childNodes[r - 1] : null;
  if (xe && i && i.contentEditable == "false")
    return zo(i);
  if ((!i || i.contentEditable == "false") && (!o || o.contentEditable == "false")) {
    if (i)
      return zo(i);
    if (o)
      return zo(o);
  }
}
function zo(t) {
  return t.contentEditable = "true", xe && t.draggable && (t.draggable = !1, t.wasDraggable = !0), t;
}
function eu(t) {
  t.contentEditable = "false", t.wasDraggable && (t.draggable = !0, t.wasDraggable = null);
}
function q0(t) {
  let e = t.dom.ownerDocument;
  e.removeEventListener("selectionchange", t.input.hideSelectionGuard);
  let n = t.domSelectionRange(), r = n.anchorNode, i = n.anchorOffset;
  e.addEventListener("selectionchange", t.input.hideSelectionGuard = () => {
    (n.anchorNode != r || n.anchorOffset != i) && (e.removeEventListener("selectionchange", t.input.hideSelectionGuard), setTimeout(() => {
      (!Xf(t) || t.state.selection.visible) && t.dom.classList.remove("ProseMirror-hideselection");
    }, 20));
  });
}
function W0(t) {
  let e = t.domSelection();
  if (!e)
    return;
  let n = t.cursorWrapper.dom, r = n.nodeName == "IMG";
  r ? e.collapse(n.parentNode, fe(n) + 1) : e.collapse(n, 0), !r && !t.state.selection.visible && Ae && Vt <= 11 && (n.disabled = !0, n.disabled = !1);
}
function Zf(t, e) {
  if (e instanceof _) {
    let n = t.docView.descAt(e.from);
    n != t.lastSelectedViewDesc && (tu(t), n && n.selectNode(), t.lastSelectedViewDesc = n);
  } else
    tu(t);
}
function tu(t) {
  t.lastSelectedViewDesc && (t.lastSelectedViewDesc.parent && t.lastSelectedViewDesc.deselectNode(), t.lastSelectedViewDesc = void 0);
}
function Sl(t, e, n, r) {
  return t.someProp("createSelectionBetween", (i) => i(t, e, n)) || V.between(e, n, r);
}
function nu(t) {
  return t.editable && !t.hasFocus() ? !1 : ed(t);
}
function ed(t) {
  let e = t.domSelectionRange();
  if (!e.anchorNode)
    return !1;
  try {
    return kn(t.dom, e.anchorNode) && (t.editable || kn(t.dom, e.focusNode));
  } catch {
    return !1;
  }
}
function K0(t) {
  let e = t.docView.domFromPos(t.state.selection.anchor, 0), n = t.domSelectionRange();
  return yn(e.node, e.offset, n.anchorNode, n.anchorOffset);
}
function Rs(t, e) {
  let { $anchor: n, $head: r } = t.selection, i = e > 0 ? n.max(r) : n.min(r), o = i.parent.inlineContent ? i.depth ? t.doc.resolve(e > 0 ? i.after() : i.before()) : null : i;
  return o && $.findFrom(o, e);
}
function Pt(t, e) {
  return t.dispatch(t.state.tr.setSelection(e).scrollIntoView()), !0;
}
function ru(t, e, n) {
  let r = t.state.selection;
  if (r instanceof V)
    if (n.indexOf("s") > -1) {
      let { $head: i } = r, o = i.textOffset ? null : e < 0 ? i.nodeBefore : i.nodeAfter;
      if (!o || o.isText || !o.isLeaf)
        return !1;
      let s = t.state.doc.resolve(i.pos + o.nodeSize * (e < 0 ? -1 : 1));
      return Pt(t, new V(r.$anchor, s));
    } else if (r.empty) {
      if (t.endOfTextblock(e > 0 ? "forward" : "backward")) {
        let i = Rs(t.state, e);
        return i && i instanceof _ ? Pt(t, i) : !1;
      } else if (!($e && n.indexOf("m") > -1)) {
        let i = r.$head, o = i.textOffset ? null : e < 0 ? i.nodeBefore : i.nodeAfter, s;
        if (!o || o.isText)
          return !1;
        let l = e < 0 ? i.pos - o.nodeSize : i.pos;
        return o.isAtom || (s = t.docView.descAt(l)) && !s.contentDOM ? _.isSelectable(o) ? Pt(t, new _(e < 0 ? t.state.doc.resolve(i.pos - o.nodeSize) : i)) : Pt(t, new V(t.state.doc.resolve(e < 0 ? l : l + o.nodeSize))) : !1;
      }
    } else return !1;
  else {
    if (r instanceof _ && r.node.isInline)
      return Pt(t, new V(e > 0 ? r.$to : r.$from));
    {
      let i = Rs(t.state, e);
      return i ? Pt(t, i) : !1;
    }
  }
}
function mr(t, e) {
  let n = t.pmViewDesc;
  return n ? n.size == 0 && (e < 0 || t.nextSibling || t.nodeName != "BR") : z(t) && t.contentEditable == "false";
}
function Mn(t, e) {
  return e < 0 ? U0(t) : J0(t);
}
function U0(t) {
  let e = t.domSelectionRange(), n = e.focusNode, r = e.focusOffset;
  if (!n)
    return;
  let i, o, s = !1;
  for (Be && z(n) && r < ke(n) && mr(n.childNodes[r], -1) && (s = !0); ; )
    if (r > 0) {
      if (!z(n))
        break;
      let l = n.childNodes[r - 1];
      if (mr(l, -1))
        i = n, o = --r;
      else if (se(l))
        n = l, r = n.nodeValue.length;
      else
        break;
    } else {
      if (td(n))
        break;
      {
        let l = n.previousSibling;
        for (; l && mr(l, -1); )
          i = n.parentNode, o = fe(l), l = l.previousSibling;
        if (l)
          n = l, r = ke(n);
        else {
          if (n = n.parentNode, n == t.dom)
            break;
          r = 0;
        }
      }
    }
  s ? zs(t, n, r) : i && zs(t, i, o);
}
function J0(t) {
  let e = t.domSelectionRange(), n = e.focusNode, r = e.focusOffset;
  if (!n)
    return;
  let i = ke(n), o, s;
  for (; ; )
    if (r < i) {
      if (!z(n))
        break;
      let l = n.childNodes[r];
      if (mr(l, 1))
        o = n, s = ++r;
      else
        break;
    } else {
      if (td(n))
        break;
      {
        let l = n.nextSibling;
        for (; l && mr(l, 1); )
          o = l.parentNode, s = fe(l) + 1, l = l.nextSibling;
        if (l)
          n = l, r = 0, i = ke(n);
        else {
          if (n = n.parentNode, n == t.dom)
            break;
          r = i = 0;
        }
      }
    }
  o && zs(t, o, s);
}
function td(t) {
  let e = t.pmViewDesc;
  return e && e.node && e.node.isBlock;
}
function G0(t, e) {
  for (; t && e == t.childNodes.length && !Br(t); )
    e = fe(t) + 1, t = t.parentNode;
  for (; t && e < t.childNodes.length; ) {
    let n = t.childNodes[e];
    if (se(n))
      return n;
    if (z(n) && n.contentEditable == "false")
      break;
    t = n, e = 0;
  }
}
function Y0(t, e) {
  for (; t && !e && !Br(t); )
    e = fe(t), t = t.parentNode;
  for (; t && e; ) {
    let n = t.childNodes[e - 1];
    if (se(n))
      return n;
    if (z(n) && n.contentEditable == "false")
      break;
    t = n, e = t.childNodes.length;
  }
}
function zs(t, e, n) {
  if (!se(e)) {
    let o, s;
    (s = G0(e, n)) ? (e = s, n = 0) : (o = Y0(e, n)) && (e = o, n = o.nodeValue.length);
  }
  let r = t.domSelection();
  if (!r)
    return;
  if (to(r)) {
    let o = document.createRange();
    o.setEnd(e, n), o.setStart(e, n), r.removeAllRanges(), r.addRange(o);
  } else r.extend && r.extend(e, n);
  t.domObserver.setCurSelection();
  let { state: i } = t;
  setTimeout(() => {
    t.state == i && St(t);
  }, 50);
}
function iu(t, e) {
  let n = t.state.doc.resolve(e);
  if (!(pe || $f) && n.parent.inlineContent) {
    let i = t.coordsAtPos(e);
    if (e > n.start()) {
      let o = t.coordsAtPos(e - 1), s = (o.top + o.bottom) / 2;
      if (s > i.top && s < i.bottom && Math.abs(o.left - i.left) > 1)
        return o.left < i.left ? "ltr" : "rtl";
    }
    if (e < n.end()) {
      let o = t.coordsAtPos(e + 1), s = (o.top + o.bottom) / 2;
      if (s > i.top && s < i.bottom && Math.abs(o.left - i.left) > 1)
        return o.left > i.left ? "ltr" : "rtl";
    }
  }
  return getComputedStyle(t.dom).direction == "rtl" ? "rtl" : "ltr";
}
function ou(t, e, n) {
  let r = t.state.selection;
  if (r instanceof V && !r.empty || n.indexOf("s") > -1 || $e && n.indexOf("m") > -1)
    return !1;
  let { $from: i, $to: o } = r;
  if (!i.parent.inlineContent || t.endOfTextblock(e < 0 ? "up" : "down")) {
    let s = Rs(t.state, e);
    if (s && s instanceof _)
      return Pt(t, s);
  }
  if (!i.parent.inlineContent) {
    let s = e < 0 ? i : o, l = r instanceof Le ? $.near(s, e) : $.findFrom(s, e);
    return l ? Pt(t, l) : !1;
  }
  return !1;
}
function su(t, e) {
  if (!(t.state.selection instanceof V))
    return !0;
  let { $head: n, $anchor: r, empty: i } = t.state.selection;
  if (!n.sameParent(r))
    return !0;
  if (!i)
    return !1;
  if (t.endOfTextblock(e > 0 ? "forward" : "backward"))
    return !0;
  let o = !n.textOffset && (e < 0 ? n.nodeBefore : n.nodeAfter);
  if (o && !o.isText) {
    let s = t.state.tr;
    return e < 0 ? s.delete(n.pos - o.nodeSize, n.pos) : s.delete(n.pos, n.pos + o.nodeSize), t.dispatch(s), !0;
  }
  return !1;
}
function lu(t, e, n) {
  t.domObserver.stop(), e.contentEditable = n, t.domObserver.start();
}
function Q0(t) {
  if (!xe || t.state.selection.$head.parentOffset > 0)
    return !1;
  let { focusNode: e, focusOffset: n } = t.domSelectionRange();
  if (e && z(e) && n == 0 && e.firstChild && z(e.firstChild) && e.firstChild.contentEditable == "false") {
    let r = e.firstChild;
    lu(t, r, "true"), setTimeout(() => lu(t, r, "false"), 20);
  }
  return !1;
}
function X0(t) {
  let e = "";
  return t.ctrlKey && (e += "c"), t.metaKey && (e += "m"), t.altKey && (e += "a"), t.shiftKey && (e += "s"), e;
}
function Z0(t, e) {
  let n = e.keyCode, r = X0(e);
  if (n == 8 || $e && n == 72 && r == "c")
    return su(t, -1) || Mn(t, -1);
  if (n == 46 && !e.shiftKey || $e && n == 68 && r == "c")
    return su(t, 1) || Mn(t, 1);
  if (n == 13 || n == 27)
    return !0;
  if (n == 37 || $e && n == 66 && r == "c") {
    let i = n == 37 ? iu(t, t.state.selection.from) == "ltr" ? -1 : 1 : -1;
    return ru(t, i, r) || Mn(t, i);
  } else if (n == 39 || $e && n == 70 && r == "c") {
    let i = n == 39 ? iu(t, t.state.selection.from) == "ltr" ? 1 : -1 : 1;
    return ru(t, i, r) || Mn(t, i);
  } else {
    if (n == 38 || $e && n == 80 && r == "c")
      return ou(t, -1, r) || Mn(t, -1);
    if (n == 40 || $e && n == 78 && r == "c")
      return Q0(t) || ou(t, 1, r) || Mn(t, 1);
    if (r == ($e ? "m" : "c") && (n == 66 || n == 73 || n == 89 || n == 90))
      return !0;
  }
  return !1;
}
function Nl(t, e) {
  t.someProp("transformCopied", (f) => {
    e = f(e, t);
  });
  let n = [], { content: r, openStart: i, openEnd: o } = e;
  for (; i > 1 && o > 1 && r.childCount == 1 && r.firstChild.childCount == 1; ) {
    i--, o--;
    let f = r.firstChild;
    n.push(f.type.name, f.attrs != f.type.defaultAttrs ? f.attrs : null), r = f.content;
  }
  let s = t.someProp("clipboardSerializer") || Hn.fromSchema(t.state.schema), l = ld(), a = l.createElement("div");
  a.appendChild(s.serializeFragment(r, { document: l }));
  let c = a.firstChild, u, h = 0;
  for (; c && z(c) && (u = sd[c.nodeName.toLowerCase()]); ) {
    for (let f = u.length - 1; f >= 0; f--) {
      let p = l.createElement(u[f]);
      for (; a.firstChild; )
        p.appendChild(a.firstChild);
      a.appendChild(p), h++;
    }
    c = a.firstChild;
  }
  c && z(c) && c.setAttribute("data-pm-slice", `${i} ${o}${h ? ` -${h}` : ""} ${JSON.stringify(n)}`);
  let d = t.someProp("clipboardTextSerializer", (f) => f(e, t)) || e.content.textBetween(0, e.content.size, `

`);
  return { dom: a, text: d, slice: e };
}
function nd(t, e, n, r, i) {
  let o = i.parent.type.spec.code, s, l;
  if (!n && !e)
    return null;
  let a = !!e && (r || o || !n);
  if (a) {
    if (t.someProp("transformPastedText", (d) => {
      e = d(e, o || r, t);
    }), o)
      return l = new E(T.from(t.state.schema.text(e.replace(/\r\n?/g, `
`))), 0, 0), t.someProp("transformPasted", (d) => {
        l = d(l, t, !0);
      }), l;
    let h = t.someProp("clipboardTextParser", (d) => d(e, i, r, t));
    if (h)
      l = h;
    else {
      let d = i.marks(), { schema: f } = t.state, p = Hn.fromSchema(f);
      s = document.createElement("div"), e.split(/(?:\r\n?|\n)+/).forEach((m) => {
        let y = s.appendChild(document.createElement("p"));
        m && y.appendChild(p.serializeNode(f.text(m, d)));
      });
    }
  } else
    t.someProp("transformPastedHTML", (h) => {
      n = h(n, t);
    }), s = rx(n), no && ix(s);
  let c = s && s.querySelector("[data-pm-slice]"), u = c && /^(\d+) (\d+)(?: -(\d+))? (.*)/.exec(c.getAttribute("data-pm-slice") || "");
  if (u && u[3])
    for (let h = +u[3]; h > 0; h--) {
      let d = s.firstChild;
      for (; d && !z(d); )
        d = d.nextSibling;
      if (!d)
        break;
      s = d;
    }
  if (l || (l = (t.someProp("clipboardParser") || t.someProp("domParser") || Rn.fromSchema(t.state.schema)).parseSlice(s, {
    preserveWhitespace: !!(a || u),
    context: i,
    ruleFromNode(d) {
      return d.nodeName == "BR" && !d.nextSibling && d.parentNode && !ex.test(d.parentNode.nodeName) ? { ignore: !0 } : null;
    }
  })), u)
    l = ox(au(l, +u[1], +u[2]), u[4]);
  else if (l = E.maxOpen(tx(l.content, i), !0), l.openStart || l.openEnd) {
    let h = 0, d = 0;
    for (let f = l.content.firstChild; h < l.openStart && !f.type.spec.isolating; h++, f = f.firstChild)
      ;
    for (let f = l.content.lastChild; d < l.openEnd && !f.type.spec.isolating; d++, f = f.lastChild)
      ;
    l = au(l, h, d);
  }
  return t.someProp("transformPasted", (h) => {
    l = h(l, t, a);
  }), l;
}
const ex = /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var)$/i;
function tx(t, e) {
  if (t.childCount < 2)
    return t;
  for (let n = e.depth; n >= 0; n--) {
    let i = e.node(n).contentMatchAt(e.index(n)), o, s = [];
    if (t.forEach((l) => {
      if (!s)
        return;
      let a = i.findWrapping(l.type), c;
      if (!a)
        return s = null;
      if (c = s.length && o.length && id(a, o, l, s[s.length - 1], 0))
        s[s.length - 1] = c;
      else {
        s.length && (s[s.length - 1] = od(s[s.length - 1], o.length));
        let u = rd(l, a);
        s.push(u), i = i.matchType(u.type), o = a;
      }
    }), s)
      return T.from(s);
  }
  return t;
}
function rd(t, e, n = 0) {
  for (let r = e.length - 1; r >= n; r--)
    t = e[r].create(null, T.from(t));
  return t;
}
function id(t, e, n, r, i) {
  if (i < t.length && i < e.length && t[i] == e[i]) {
    let o = id(t, e, n, r.lastChild, i + 1);
    if (o)
      return r.copy(r.content.replaceChild(r.childCount - 1, o));
    if (r.contentMatchAt(r.childCount).matchType(i == t.length - 1 ? n.type : t[i + 1]))
      return r.copy(r.content.append(T.from(rd(n, t, i + 1))));
  }
}
function od(t, e) {
  if (e == 0)
    return t;
  let n = t.content.replaceChild(t.childCount - 1, od(t.lastChild, e - 1)), r = t.contentMatchAt(t.childCount).fillBefore(T.empty, !0);
  return t.copy(n.append(r));
}
function Ps(t, e, n, r, i, o) {
  let s = e < 0 ? t.firstChild : t.lastChild, l = s.content;
  return t.childCount > 1 && (o = 0), i < r - 1 && (l = Ps(l, e, n, r, i + 1, o)), i >= n && (l = e < 0 ? s.contentMatchAt(0).fillBefore(l, o <= i).append(l) : l.append(s.contentMatchAt(s.childCount).fillBefore(T.empty, !0))), t.replaceChild(e < 0 ? 0 : t.childCount - 1, s.copy(l));
}
function au(t, e, n) {
  return e < t.openStart && (t = new E(Ps(t.content, -1, e, t.openStart, 0, t.openEnd), e, t.openEnd)), n < t.openEnd && (t = new E(Ps(t.content, 1, n, t.openEnd, 0, 0), t.openStart, n)), t;
}
const sd = {
  thead: ["table"],
  tbody: ["table"],
  tfoot: ["table"],
  caption: ["table"],
  colgroup: ["table"],
  col: ["table", "colgroup"],
  tr: ["table", "tbody"],
  td: ["table", "tbody", "tr"],
  th: ["table", "tbody", "tr"]
};
function ld() {
  return document.implementation.createHTMLDocument("title");
}
let tr = null;
function nx(t) {
  let e = window.trustedTypes;
  if (!e)
    return t;
  if (!tr) {
    if (tr = e.defaultPolicy)
      try {
        return tr.createHTML(t);
      } catch {
      }
    tr = e.createPolicy("ProseMirrorClipboard", { createHTML: (n) => n });
  }
  return tr.createHTML(t);
}
function rx(t) {
  let e = /^(\s*<meta [^>]*>)*/.exec(t);
  e && (t = t.slice(e[0].length));
  let n = ld(), r = n.body, i = /<([a-z][^>\s]+)/i.exec(t), o;
  if ((o = i && sd[i[1].toLowerCase()]) && (t = o.map((s) => "<" + s + ">").join("") + t + o.map((s) => "</" + s + ">").reverse().join("")), r.innerHTML = nx(t), o)
    for (let s = 0; s < o.length; s++)
      r = r.querySelector(o[s]) || r;
  for (let s = 0; s < n.styleSheets.length; s++) {
    let l = n.styleSheets[s];
    for (let a = 0; a < l.rules.length; a++) {
      let c = l.rules[a];
      if (c instanceof CSSStyleRule) {
        let u = r.querySelectorAll(c.selectorText);
        for (let h = 0; h < u.length; h++)
          u[h].style.cssText += c.style.cssText;
      }
    }
  }
  return r;
}
function ix(t) {
  let e = t.querySelectorAll(pe ? "span:not([class]):not([style])" : "span.Apple-converted-space");
  for (let n = 0; n < e.length; n++) {
    let r = e[n];
    r.childNodes.length == 1 && r.textContent == " " && r.parentNode && r.parentNode.replaceChild(t.ownerDocument.createTextNode(" "), r);
  }
}
function ox(t, e) {
  if (!t.size)
    return t;
  let n = t.content.firstChild.type.schema, r;
  try {
    r = JSON.parse(e);
  } catch {
    return t;
  }
  let { content: i, openStart: o, openEnd: s } = t;
  for (let l = r.length - 2; l >= 0; l -= 2) {
    let a = n.nodes[r[l]];
    if (!a || a.hasRequiredAttrs())
      break;
    try {
      i = T.from(a.create(r[l + 1], i));
    } catch {
      break;
    }
    o++, s++;
  }
  return new E(i, o, s);
}
const Se = {}, Ne = {}, sx = { touchstart: !0, touchmove: !0 };
class lx {
  constructor() {
    this.shiftKey = !1, this.mouseDown = null, this.lastKeyCode = null, this.lastKeyCodeTime = 0, this.lastClick = { time: 0, x: 0, y: 0, type: "", button: 0 }, this.lastSelectionOrigin = null, this.lastSelectionTime = 0, this.lastIOSEnter = 0, this.lastIOSEnterFallbackTimeout = -1, this.lastFocus = 0, this.lastTouch = 0, this.lastChromeDelete = 0, this.composing = !1, this.compositionNode = null, this.composingTimeout = -1, this.compositionNodes = [], this.compositionEndedAt = -2e8, this.compositionID = 1, this.badSafariComposition = !1, this.compositionPendingChanges = 0, this.domChangeCount = 0, this.eventHandlers = /* @__PURE__ */ Object.create(null), this.hideSelectionGuard = null;
  }
}
function ax(t) {
  for (let e in Se) {
    let n = Se[e];
    t.dom.addEventListener(e, t.input.eventHandlers[e] = (r) => {
      ux(t, r) && !Ml(t, r) && (t.editable || !(r.type in Ne)) && n(t, r);
    }, sx[e] ? { passive: !0 } : void 0);
  }
  xe && t.dom.addEventListener("input", () => null), Ls(t);
}
function Ct(t, e) {
  t.input.lastSelectionOrigin = e, t.input.lastSelectionTime = Date.now();
}
function cx(t) {
  t.input.mouseDown && t.input.mouseDown.done(), t.domObserver.stop();
  for (let e in t.input.eventHandlers)
    t.dom.removeEventListener(e, t.input.eventHandlers[e]);
  clearTimeout(t.input.composingTimeout), clearTimeout(t.input.lastIOSEnterFallbackTimeout);
}
function Ls(t) {
  t.someProp("handleDOMEvents", (e) => {
    for (let n in e)
      t.input.eventHandlers[n] || t.dom.addEventListener(n, t.input.eventHandlers[n] = (r) => Ml(t, r));
  });
}
function Ml(t, e) {
  return t.someProp("handleDOMEvents", (n) => {
    let r = n[e.type];
    return r ? r(t, e) || e.defaultPrevented : !1;
  });
}
function ux(t, e) {
  if (!e.bubbles)
    return !0;
  if (e.defaultPrevented)
    return !1;
  for (let n = e.target; n != t.dom; n = n.parentNode)
    if (!n || n.nodeType == 11 || n.pmViewDesc && n.pmViewDesc.stopEvent(e))
      return !1;
  return !0;
}
function hx(t, e) {
  !Ml(t, e) && Se[e.type] && (t.editable || !(e.type in Ne)) && Se[e.type](t, e);
}
Ne.keydown = (t, e) => {
  let n = e;
  if (t.input.shiftKey = n.keyCode == 16 || n.shiftKey, !hd(t) && (t.input.lastKeyCode = n.keyCode, t.input.lastKeyCodeTime = Date.now(), !(wt && pe && n.keyCode == 13)))
    if (n.keyCode != 229 && t.domObserver.forceFlush(), Bn && n.keyCode == 13 && !n.ctrlKey && !n.altKey && !n.metaKey) {
      let r = Date.now();
      t.input.lastIOSEnter = r, t.input.lastIOSEnterFallbackTimeout = setTimeout(() => {
        t.input.lastIOSEnter == r && (t.someProp("handleKeyDown", (i) => i(t, nn(13, "Enter"))), t.input.lastIOSEnter = 0);
      }, 200);
    } else t.someProp("handleKeyDown", (r) => r(t, n)) || Z0(t, n) ? n.preventDefault() : Ct(t, "key");
};
Ne.keyup = (t, e) => {
  e.keyCode == 16 && (t.input.shiftKey = !1);
};
Ne.keypress = (t, e) => {
  let n = e;
  if (hd(t) || !n.charCode || n.ctrlKey && !n.altKey || $e && n.metaKey)
    return;
  if (t.someProp("handleKeyPress", (i) => i(t, n))) {
    n.preventDefault();
    return;
  }
  let r = t.state.selection;
  if (!(r instanceof V) || !r.$from.sameParent(r.$to)) {
    let i = String.fromCharCode(n.charCode), o = () => t.state.tr.insertText(i).scrollIntoView();
    !/[\r\n]/.test(i) && !t.someProp("handleTextInput", (s) => s(t, r.$from.pos, r.$to.pos, i, o)) && t.dispatch(o()), n.preventDefault();
  }
};
function _r(t) {
  return { left: t.clientX, top: t.clientY };
}
function fx(t, e) {
  let n = e.x - t.clientX, r = e.y - t.clientY;
  return n * n + r * r < 100;
}
function Tl(t, e, n, r, i) {
  if (r == -1)
    return !1;
  let o = t.state.doc.resolve(r);
  for (let s = o.depth + 1; s > 0; s--)
    if (t.someProp(e, (l) => s > o.depth ? l(t, n, o.nodeAfter, o.before(s), i, !0) : l(t, n, o.node(s), o.before(s), i, !1)))
      return !0;
  return !1;
}
function $r(t, e, n) {
  if (t.focused || t.focus(), t.state.selection.eq(e))
    return;
  let r = t.state.tr.setSelection(e);
  r.setMeta("pointer", !0), t.dispatch(r);
}
function dx(t, e) {
  if (e == -1)
    return !1;
  let n = t.state.doc.resolve(e), r = n.nodeAfter;
  return r && r.isAtom && _.isSelectable(r) ? ($r(t, new _(n)), !0) : !1;
}
function px(t, e) {
  if (e == -1)
    return !1;
  let n = t.state.selection, r, i;
  n instanceof _ && (r = n.node);
  let o = t.state.doc.resolve(e);
  for (let s = o.depth + 1; s > 0; s--) {
    let l = s > o.depth ? o.nodeAfter : o.node(s);
    if (_.isSelectable(l)) {
      r && n.$from.depth > 0 && s >= n.$from.depth && o.before(n.$from.depth + 1) == n.$from.pos ? i = o.before(n.$from.depth) : i = o.before(s);
      break;
    }
  }
  return i != null ? ($r(t, _.create(t.state.doc, i)), !0) : !1;
}
function mx(t, e, n, r, i) {
  return Tl(t, "handleClickOn", e, n, r) || t.someProp("handleClick", (o) => o(t, e, r)) || (i ? px(t, n) : dx(t, n));
}
function gx(t, e, n, r) {
  return Tl(t, "handleDoubleClickOn", e, n, r) || t.someProp("handleDoubleClick", (i) => i(t, e, r));
}
function yx(t, e, n, r) {
  return Tl(t, "handleTripleClickOn", e, n, r) || t.someProp("handleTripleClick", (i) => i(t, e, r)) || kx(t, n, r);
}
function kx(t, e, n) {
  if (n.button != 0)
    return !1;
  let r = ad(t, e, !0), i = t.state.doc;
  return r ? ($r(t, r), r instanceof V && i.eq(t.state.doc) && (t.input.mouseDown = new xx(t, r)), !0) : !1;
}
function ad(t, e, n) {
  let r = t.state.doc;
  if (e == -1)
    return r.inlineContent ? V.create(r, 0, r.content.size) : null;
  let i = r.resolve(e);
  for (let o = i.depth + 1; o > 0; o--) {
    let s = o > i.depth ? i.nodeAfter : i.node(o), l = i.before(o);
    if (s.inlineContent)
      return V.create(r, l + 1, l + 1 + s.content.size);
    if (n && _.isSelectable(s))
      return _.create(r, l);
  }
  return null;
}
function Al(t) {
  return zi(t);
}
const cd = $e ? "metaKey" : "ctrlKey";
Se.mousedown = (t, e) => {
  let n = e;
  t.input.shiftKey = n.shiftKey;
  let r = Al(t), i = Date.now(), o = "singleClick";
  i - t.input.lastClick.time < 500 && fx(n, t.input.lastClick) && !n[cd] && t.input.lastClick.button == n.button && (t.input.lastClick.type == "singleClick" ? o = "doubleClick" : t.input.lastClick.type == "doubleClick" && (o = "tripleClick")), t.input.lastClick = { time: i, x: n.clientX, y: n.clientY, type: o, button: n.button }, t.input.mouseDown && t.input.mouseDown.done();
  let s = t.posAtCoords(_r(n));
  s && (o == "singleClick" ? t.input.mouseDown = new bx(t, s, n, !!r) : (o == "doubleClick" ? gx : yx)(t, s.pos, s.inside, n) ? n.preventDefault() : Ct(t, "pointer"));
};
class ud {
  constructor(e) {
    this.view = e, this.mightDrag = null, e.root.addEventListener("mouseup", this.up = this.up.bind(this)), e.root.addEventListener("mousemove", this.move = this.move.bind(this));
  }
  up(e) {
    this.done();
  }
  move(e) {
    e.buttons == 0 && this.done();
  }
  done() {
    this.view.root.removeEventListener("mouseup", this.up), this.view.root.removeEventListener("mousemove", this.move), this.view.input.mouseDown == this && (this.view.input.mouseDown = null);
  }
  delaySelUpdate() {
    return !1;
  }
}
class bx extends ud {
  constructor(e, n, r, i) {
    super(e), this.pos = n, this.event = r, this.flushed = i, this.delayedSelectionSync = !1, this.startDoc = e.state.doc, this.selectNode = !!r[cd], this.allowDefault = r.shiftKey;
    let o, s;
    if (n.inside > -1)
      o = e.state.doc.nodeAt(n.inside), s = n.inside;
    else {
      let u = e.state.doc.resolve(n.pos);
      o = u.parent, s = u.depth ? u.before() : 0;
    }
    const l = i ? null : r.target, a = l ? e.docView.nearestDesc(l, !0) : null;
    this.target = a && z(a.nodeDOM) ? a.nodeDOM : null;
    let { selection: c } = e.state;
    r.button == 0 && (o.type.spec.draggable && o.type.spec.selectable !== !1 || c instanceof _ && c.from <= s && c.to > s) && (this.mightDrag = {
      node: o,
      pos: s,
      addAttr: !!(this.target && !this.target.draggable),
      setUneditable: !!(this.target && Be && !this.target.hasAttribute("contentEditable"))
    }), this.target && this.mightDrag && (this.mightDrag.addAttr || this.mightDrag.setUneditable) && (this.view.domObserver.stop(), this.mightDrag.addAttr && (this.target.draggable = !0), this.mightDrag.setUneditable && setTimeout(() => {
      this.view.input.mouseDown == this && this.target.setAttribute("contentEditable", "false");
    }, 20), this.view.domObserver.start()), Ct(e, "pointer");
  }
  done() {
    super.done(), this.mightDrag && this.target && (this.view.domObserver.stop(), this.mightDrag.addAttr && this.target.removeAttribute("draggable"), this.mightDrag.setUneditable && this.target.removeAttribute("contentEditable"), this.view.domObserver.start()), this.delayedSelectionSync && setTimeout(() => {
      this.view.isDestroyed || St(this.view);
    });
  }
  up(e) {
    if (this.done(), !this.view.dom.contains(e.target))
      return;
    let n = this.pos;
    this.view.state.doc != this.startDoc && (n = this.view.posAtCoords(_r(e))), this.updateAllowDefault(e), this.allowDefault || !n ? Ct(this.view, "pointer") : mx(this.view, n.pos, n.inside, e, this.selectNode) ? e.preventDefault() : e.button == 0 && (this.flushed || // Safari ignores clicks on draggable elements
    xe && this.mightDrag && !this.mightDrag.node.isAtom || // Chrome will sometimes treat a node selection as a
    // cursor, but still report that the node is selected
    // when asked through getSelection. You'll then get a
    // situation where clicking at the point where that
    // (hidden) cursor is doesn't change the selection, and
    // thus doesn't get a reaction from ProseMirror. This
    // works around that.
    pe && !this.view.state.selection.visible && Math.min(Math.abs(n.pos - this.view.state.selection.from), Math.abs(n.pos - this.view.state.selection.to)) <= 2) ? ($r(this.view, $.near(this.view.state.doc.resolve(n.pos))), e.preventDefault()) : Ct(this.view, "pointer");
  }
  move(e) {
    this.updateAllowDefault(e), Ct(this.view, "pointer"), super.move(e);
  }
  updateAllowDefault(e) {
    !this.allowDefault && (Math.abs(this.event.x - e.clientX) > 4 || Math.abs(this.event.y - e.clientY) > 4) && (this.allowDefault = !0);
  }
  delaySelUpdate() {
    return this.allowDefault ? (this.delayedSelectionSync = !0, !0) : !1;
  }
}
class xx extends ud {
  constructor(e, n) {
    super(e), this.startSelection = n, this.startDoc = e.state.doc;
  }
  move(e) {
    if (e.buttons == 0 || this.view.isDestroyed || !this.view.state.doc.eq(this.startDoc)) {
      this.done();
      return;
    }
    e.preventDefault(), Ct(this.view, "pointer");
    let n = this.view.posAtCoords(_r(e)), r = n && ad(this.view, n.inside, !1);
    if (!r)
      return;
    let { doc: i } = this.view.state, o = this.startSelection, [s, l] = r.from < o.from ? [o.to, r.from] : [o.from, r.to];
    $r(this.view, V.create(i, s, l));
  }
}
Se.touchstart = (t) => {
  t.input.lastTouch = Date.now(), Al(t), Ct(t, "pointer");
};
Se.touchmove = (t) => {
  t.input.lastTouch = Date.now(), Ct(t, "pointer");
};
Se.contextmenu = (t) => Al(t);
function hd(t, e) {
  return t.composing ? !0 : xe && Math.abs(Date.now() - t.input.compositionEndedAt) < 500 ? (t.input.compositionEndedAt = -2e8, !0) : !1;
}
const wx = wt ? 5e3 : -1;
Ne.compositionstart = Ne.compositionupdate = (t) => {
  if (!t.composing) {
    t.domObserver.flush();
    let { state: e } = t, n = e.selection.$to;
    if (e.selection instanceof V && e.selection.empty && (e.storedMarks || !n.textOffset && n.parentOffset && n.nodeBefore.marks.some((r) => r.type.spec.inclusive === !1) || pe && $f && Cx(t)))
      t.markCursor = t.state.storedMarks || n.marks(), zi(t, !0), t.markCursor = null;
    else if (zi(t, !e.selection.empty), Be && e.selection.empty && n.parentOffset && !n.textOffset && n.nodeBefore.marks.length) {
      let r = t.domSelectionRange();
      for (let i = r.focusNode, o = r.focusOffset; i && z(i) && o != 0; ) {
        let s = o < 0 ? i.lastChild : i.childNodes[o - 1];
        if (!s)
          break;
        if (se(s)) {
          let l = t.domSelection();
          l && l.collapse(s, s.nodeValue.length);
          break;
        } else
          i = s, o = -1;
      }
    }
    t.input.composing = !0;
  }
  fd(t, wx);
};
function Cx(t) {
  let { focusNode: e, focusOffset: n } = t.domSelectionRange();
  if (!e || !z(e) || n >= e.childNodes.length)
    return !1;
  let r = e.childNodes[n];
  return z(r) && r.contentEditable == "false";
}
Ne.compositionend = (t, e) => {
  t.composing && (t.input.composing = !1, t.input.compositionEndedAt = Date.now(), t.input.compositionPendingChanges = t.domObserver.pendingRecords().length ? t.input.compositionID : 0, t.input.compositionNode = null, t.input.badSafariComposition ? t.domObserver.forceFlush() : t.input.compositionPendingChanges && Promise.resolve().then(() => t.domObserver.flush()), t.input.compositionID++, fd(t, 20));
};
function fd(t, e) {
  clearTimeout(t.input.composingTimeout), e > -1 && (t.input.composingTimeout = setTimeout(() => zi(t), e));
}
function dd(t) {
  for (t.composing && (t.input.composing = !1, t.input.compositionEndedAt = Date.now()); t.input.compositionNodes.length > 0; )
    t.input.compositionNodes.pop().markParentsDirty();
}
function Sx(t) {
  let e = t.domSelectionRange();
  if (!e.focusNode)
    return null;
  let n = p0(e.focusNode, e.focusOffset), r = m0(e.focusNode, e.focusOffset);
  if (n && r && n != r) {
    let i = r.pmViewDesc, o = t.domObserver.lastChangedTextNode;
    if (n == o || r == o)
      return o;
    if (!i || !i.isText(r.nodeValue))
      return r;
    if (t.input.compositionNode == r) {
      let s = n.pmViewDesc;
      if (!(!s || !s.isText(n.nodeValue)))
        return r;
    }
  }
  return n || r;
}
function zi(t, e = !1) {
  if (!(wt && t.domObserver.flushingSoon >= 0)) {
    if (t.domObserver.forceFlush(), dd(t), e || t.docView && t.docView.dirty) {
      let n = Cl(t), r = t.state.selection;
      return n && !n.eq(r) ? t.dispatch(t.state.tr.setSelection(n)) : (t.markCursor || e) && !r.$from.node(r.$from.sharedDepth(r.to)).inlineContent ? t.dispatch(t.state.tr.deleteSelection()) : t.updateState(t.state), !0;
    }
    return !1;
  }
}
function Nx(t, e) {
  if (!t.dom.parentNode)
    return;
  let n = t.dom.parentNode.appendChild(document.createElement("div"));
  n.appendChild(e), n.style.cssText = "position: fixed; left: -10000px; top: 10px";
  let r = getSelection(), i = document.createRange();
  i.selectNodeContents(e), t.dom.blur(), r.removeAllRanges(), r.addRange(i), setTimeout(() => {
    n.parentNode && n.parentNode.removeChild(n), t.focus();
  }, 50);
}
const Ir = Ae && Vt < 15 || Bn && b0 < 604;
Se.copy = Ne.cut = (t, e) => {
  let n = e, r = t.state.selection, i = n.type == "cut";
  if (r.empty)
    return;
  let o = Ir ? null : n.clipboardData, s = r.content(), { dom: l, text: a } = Nl(t, s);
  o ? (n.preventDefault(), o.clearData(), o.setData("text/html", l.innerHTML), o.setData("text/plain", a)) : Nx(t, l), i && t.dispatch(t.state.tr.deleteSelection().scrollIntoView().setMeta("uiEvent", "cut"));
};
function Mx(t) {
  return t.openStart == 0 && t.openEnd == 0 && t.content.childCount == 1 ? t.content.firstChild : null;
}
function Tx(t, e) {
  if (!t.dom.parentNode)
    return;
  let n = t.input.shiftKey || t.state.selection.$from.parent.type.spec.code, r = t.dom.parentNode.appendChild(document.createElement(n ? "textarea" : "div"));
  n || (r.contentEditable = "true"), r.style.cssText = "position: fixed; left: -10000px; top: 10px", r.focus();
  let i = t.input.shiftKey && t.input.lastKeyCode != 45;
  setTimeout(() => {
    t.focus(), r.parentNode && r.parentNode.removeChild(r), n ? Er(t, r.value, null, i, e) : Er(t, r.textContent, r.innerHTML, i, e);
  }, 50);
}
function Er(t, e, n, r, i) {
  let o = nd(t, e, n, r, t.state.selection.$from);
  if (t.someProp("handlePaste", (a) => a(t, i, o || E.empty)))
    return !0;
  if (!o)
    return !1;
  let s = Mx(o), l = s ? t.state.tr.replaceSelectionWith(s, r) : t.state.tr.replaceSelection(o);
  return t.dispatch(l.scrollIntoView().setMeta("paste", !0).setMeta("uiEvent", "paste")), !0;
}
function pd(t) {
  let e = t.getData("text/plain") || t.getData("Text");
  if (e)
    return e;
  let n = t.getData("text/uri-list");
  return n ? n.replace(/\r?\n/g, " ") : "";
}
Ne.paste = (t, e) => {
  let n = e;
  if (t.composing && !wt)
    return;
  let r = Ir ? null : n.clipboardData, i = t.input.shiftKey && t.input.lastKeyCode != 45;
  r && Er(t, pd(r), r.getData("text/html"), i, n) ? n.preventDefault() : Tx(t, n);
};
class md {
  constructor(e, n, r) {
    this.slice = e, this.move = n, this.node = r;
  }
}
const Ax = $e ? "altKey" : "ctrlKey";
function gd(t, e) {
  let n;
  return t.someProp("dragCopies", (r) => {
    n = n || r(e);
  }), n != null ? !n : !e[Ax];
}
Se.dragstart = (t, e) => {
  let n = e, r = t.input.mouseDown;
  if (r && r.done(), !n.dataTransfer)
    return;
  let i = t.state.selection, o = i.empty ? null : t.posAtCoords(_r(n)), s;
  if (!(o && o.pos >= i.from && o.pos <= (i instanceof _ ? i.to - 1 : i.to))) {
    if (r && r.mightDrag)
      s = _.create(t.state.doc, r.mightDrag.pos);
    else if (n.target && z(n.target)) {
      let h = t.docView.nearestDesc(n.target, !0);
      h && h.node.type.spec.draggable && h != t.docView && (s = _.create(t.state.doc, h.posBefore));
    }
  }
  let l = (s || t.state.selection).content(), { dom: a, text: c, slice: u } = Nl(t, l);
  (!n.dataTransfer.files.length || !pe || _f > 120) && n.dataTransfer.clearData(), n.dataTransfer.setData(Ir ? "Text" : "text/html", a.innerHTML), n.dataTransfer.effectAllowed = "copyMove", Ir || n.dataTransfer.setData("text/plain", c), t.dragging = new md(u, gd(t, n), s);
};
Se.dragend = (t) => {
  let e = t.dragging;
  window.setTimeout(() => {
    t.dragging == e && (t.dragging = null);
  }, 50);
};
Ne.dragover = Ne.dragenter = (t, e) => e.preventDefault();
Ne.drop = (t, e) => {
  try {
    Ix(t, e, t.dragging);
  } finally {
    t.dragging = null;
  }
};
function Ix(t, e, n) {
  if (!e.dataTransfer)
    return;
  let r = t.posAtCoords(_r(e));
  if (!r)
    return;
  let i = t.state.doc.resolve(r.pos), o = n && n.slice;
  o ? t.someProp("transformPasted", (f) => {
    o = f(o, t, !1);
  }) : o = nd(t, pd(e.dataTransfer), Ir ? null : e.dataTransfer.getData("text/html"), !1, i);
  let s = !!(n && gd(t, e));
  if (t.someProp("handleDrop", (f) => f(t, e, o || E.empty, s))) {
    e.preventDefault();
    return;
  }
  if (!o)
    return;
  e.preventDefault();
  let l = o ? c1(t.state.doc, i.pos, o) : i.pos;
  l == null && (l = i.pos);
  let a = t.state.tr;
  if (s) {
    let { node: f } = n;
    f ? f.replace(a) : a.deleteSelection();
  }
  let c = a.mapping.map(l), u = o.openStart == 0 && o.openEnd == 0 && o.content.childCount == 1, h = a.doc;
  if (u ? a.replaceRangeWith(c, c, o.content.firstChild) : a.replaceRange(c, c, o), a.doc.eq(h))
    return;
  let d = a.doc.resolve(c);
  if (u && _.isSelectable(o.content.firstChild) && d.nodeAfter && d.nodeAfter.sameMarkup(o.content.firstChild))
    a.setSelection(new _(d));
  else {
    let f = a.mapping.map(l);
    a.mapping.maps[a.mapping.maps.length - 1].forEach((p, m, y, g) => f = g), a.setSelection(Sl(t, d, a.doc.resolve(f)));
  }
  t.focus(), t.dispatch(a.setMeta("uiEvent", "drop"));
}
Se.focus = (t) => {
  t.input.lastFocus = Date.now(), t.focused || (t.domObserver.stop(), t.dom.classList.add("ProseMirror-focused"), t.domObserver.start(), t.focused = !0, setTimeout(() => {
    t.docView && t.hasFocus() && !t.domObserver.currentSelection.eq(t.domSelectionRange()) && St(t);
  }, 20));
};
Se.blur = (t, e) => {
  let n = e;
  t.focused && (t.domObserver.stop(), t.dom.classList.remove("ProseMirror-focused"), t.domObserver.start(), n.relatedTarget && t.dom.contains(n.relatedTarget) && t.domObserver.currentSelection.clear(), t.focused = !1);
};
Se.beforeinput = (t, e) => {
  if (wt && e.inputType == "deleteContentBackward") {
    t.domObserver.flushSoon();
    let { domChangeCount: r } = t.input;
    setTimeout(() => {
      if (t.input.domChangeCount != r || (t.dom.blur(), t.focus(), t.someProp("handleKeyDown", (o) => o(t, nn(8, "Backspace")))))
        return;
      let { $cursor: i } = t.state.selection;
      i && i.pos > 0 && t.dispatch(t.state.tr.delete(i.pos - 1, i.pos).scrollIntoView());
    }, 50);
  }
};
for (let t in Ne)
  Se[t] = Ne[t];
function Or(t, e) {
  if (t == e)
    return !0;
  for (let n in t)
    if (t[n] !== e[n])
      return !1;
  for (let n in e)
    if (!(n in t))
      return !1;
  return !0;
}
class Pi {
  constructor(e, n) {
    this.toDOM = e, this.spec = n || cn, this.side = this.spec.side || 0;
  }
  map(e, n, r, i) {
    let { pos: o, deleted: s } = e.mapResult(n.from + i, this.side < 0 ? -1 : 1);
    return s ? null : new me(o - r, o - r, this);
  }
  valid() {
    return !0;
  }
  eq(e) {
    return this == e || e instanceof Pi && (this.spec.key && this.spec.key == e.spec.key || this.toDOM == e.toDOM && Or(this.spec, e.spec));
  }
  destroy(e) {
    this.spec.destroy && this.spec.destroy(e);
  }
}
class qt {
  constructor(e, n) {
    this.attrs = e, this.spec = n || cn;
  }
  map(e, n, r, i) {
    let o = e.map(n.from + i, this.spec.inclusiveStart ? -1 : 1) - r, s = e.map(n.to + i, this.spec.inclusiveEnd ? 1 : -1) - r;
    return o >= s ? null : new me(o, s, this);
  }
  valid(e, n) {
    return n.from < n.to;
  }
  eq(e) {
    return this == e || e instanceof qt && Or(this.attrs, e.attrs) && Or(this.spec, e.spec);
  }
  static is(e) {
    return e.type instanceof qt;
  }
  destroy() {
  }
}
class Il {
  constructor(e, n) {
    this.attrs = e, this.spec = n || cn;
  }
  map(e, n, r, i) {
    let o = e.mapResult(n.from + i, 1);
    if (o.deleted)
      return null;
    let s = e.mapResult(n.to + i, -1);
    return s.deleted || s.pos <= o.pos ? null : new me(o.pos - r, s.pos - r, this);
  }
  valid(e, n) {
    let { index: r, offset: i } = e.content.findIndex(n.from), o;
    return i == n.from && !(o = e.child(r)).isText && i + o.nodeSize == n.to;
  }
  eq(e) {
    return this == e || e instanceof Il && Or(this.attrs, e.attrs) && Or(this.spec, e.spec);
  }
  destroy() {
  }
}
class me {
  /**
  @internal
  */
  constructor(e, n, r) {
    this.from = e, this.to = n, this.type = r;
  }
  /**
  @internal
  */
  copy(e, n) {
    return new me(e, n, this.type);
  }
  /**
  @internal
  */
  eq(e, n = 0) {
    return this.type.eq(e.type) && this.from + n == e.from && this.to + n == e.to;
  }
  /**
  @internal
  */
  map(e, n, r) {
    return this.type.map(e, this, n, r);
  }
  /**
  Creates a widget decoration, which is a DOM node that's shown in
  the document at the given position. It is recommended that you
  delay rendering the widget by passing a function that will be
  called when the widget is actually drawn in a view, but you can
  also directly pass a DOM node. `getPos` can be used to find the
  widget's current document position.
  */
  static widget(e, n, r) {
    return new me(e, e, new Pi(n, r));
  }
  /**
  Creates an inline decoration, which adds the given attributes to
  each inline node between `from` and `to`.
  */
  static inline(e, n, r, i) {
    return new me(e, n, new qt(r, i));
  }
  /**
  Creates a node decoration. `from` and `to` should point precisely
  before and after a node in the document. That node, and only that
  node, will receive the given attributes.
  */
  static node(e, n, r, i) {
    return new me(e, n, new Il(r, i));
  }
  /**
  The spec provided when creating this decoration. Can be useful
  if you've stored extra information in that object.
  */
  get spec() {
    return this.type.spec;
  }
  /**
  @internal
  */
  get inline() {
    return this.type instanceof qt;
  }
  /**
  @internal
  */
  get widget() {
    return this.type instanceof Pi;
  }
}
const An = [], cn = {};
class ne {
  /**
  @internal
  */
  constructor(e, n) {
    this.local = e.length ? e : An, this.children = n.length ? n : An;
  }
  /**
  Create a set of decorations, using the structure of the given
  document. This will consume (modify) the `decorations` array, so
  you must make a copy if you want need to preserve that.
  */
  static create(e, n) {
    return n.length ? Li(n, e, 0, cn) : ye;
  }
  /**
  Find all decorations in this set which touch the given range
  (including decorations that start or end directly at the
  boundaries) and match the given predicate on their spec. When
  `start` and `end` are omitted, all decorations in the set are
  considered. When `predicate` isn't given, all decorations are
  assumed to match.
  */
  find(e, n, r) {
    let i = [];
    return this.findInner(e ?? 0, n ?? 1e9, i, 0, r), i;
  }
  findInner(e, n, r, i, o) {
    for (let s = 0; s < this.local.length; s++) {
      let l = this.local[s];
      l.from <= n && l.to >= e && (!o || o(l.spec)) && r.push(l.copy(l.from + i, l.to + i));
    }
    for (let s = 0; s < this.children.length; s += 3)
      if (this.children[s] < n && this.children[s + 1] > e) {
        let l = this.children[s] + 1;
        this.children[s + 2].findInner(e - l, n - l, r, i + l, o);
      }
  }
  /**
  Map the set of decorations in response to a change in the
  document.
  */
  map(e, n, r) {
    return this == ye || e.maps.length == 0 ? this : this.mapInner(e, n, 0, 0, r || cn);
  }
  /**
  @internal
  */
  mapInner(e, n, r, i, o) {
    let s;
    for (let l = 0; l < this.local.length; l++) {
      let a = this.local[l].map(e, r, i);
      a && a.type.valid(n, a) ? (s || (s = [])).push(a) : o.onRemove && o.onRemove(this.local[l].spec);
    }
    return this.children.length ? Ex(this.children, s || [], e, n, r, i, o) : s ? new ne(s.sort(un), An) : ye;
  }
  /**
  Add the given array of decorations to the ones in the set,
  producing a new set. Consumes the `decorations` array. Needs
  access to the current document to create the appropriate tree
  structure.
  */
  add(e, n) {
    return n.length ? this == ye ? ne.create(e, n) : this.addInner(e, n, 0) : this;
  }
  addInner(e, n, r) {
    let i, o = 0;
    e.forEach((l, a) => {
      let c = a + r, u;
      if (u = kd(n, l, c)) {
        for (i || (i = this.children.slice()); o < i.length && i[o] < a; )
          o += 3;
        i[o] == a ? i[o + 2] = i[o + 2].addInner(l, u, c + 1) : i.splice(o, 0, a, a + l.nodeSize, Li(u, l, c + 1, cn)), o += 3;
      }
    });
    let s = yd(o ? bd(n) : n, -r);
    for (let l = 0; l < s.length; l++)
      s[l].type.valid(e, s[l]) || s.splice(l--, 1);
    return new ne(s.length ? this.local.concat(s).sort(un) : this.local, i || this.children);
  }
  /**
  Create a new set that contains the decorations in this set, minus
  the ones in the given array.
  */
  remove(e) {
    return e.length == 0 || this == ye ? this : this.removeInner(e, 0);
  }
  removeInner(e, n) {
    let r = this.children, i = this.local;
    for (let o = 0; o < r.length; o += 3) {
      let s, l = r[o] + n, a = r[o + 1] + n;
      for (let u = 0, h; u < e.length; u++)
        (h = e[u]) && h.from > l && h.to < a && (e[u] = null, (s || (s = [])).push(h));
      if (!s)
        continue;
      r == this.children && (r = this.children.slice());
      let c = r[o + 2].removeInner(s, l + 1);
      c != ye ? r[o + 2] = c : (r.splice(o, 3), o -= 3);
    }
    if (i.length) {
      for (let o = 0, s; o < e.length; o++)
        if (s = e[o])
          for (let l = 0; l < i.length; l++)
            i[l].eq(s, n) && (i == this.local && (i = this.local.slice()), i.splice(l--, 1));
    }
    return r == this.children && i == this.local ? this : i.length || r.length ? new ne(i, r) : ye;
  }
  forChild(e, n) {
    if (this == ye)
      return this;
    if (n.isLeaf)
      return ne.empty;
    let r, i;
    for (let l = 0; l < this.children.length; l += 3)
      if (this.children[l] >= e) {
        this.children[l] == e && (r = this.children[l + 2]);
        break;
      }
    let o = e + 1, s = o + n.content.size;
    for (let l = 0; l < this.local.length; l++) {
      let a = this.local[l];
      if (a.from < s && a.to > o && a.type instanceof qt) {
        let c = Math.max(o, a.from) - o, u = Math.min(s, a.to) - o;
        c < u && (i || (i = [])).push(a.copy(c, u));
      }
    }
    if (i) {
      let l = new ne(i.sort(un), An);
      return r ? new Bt([l, r]) : l;
    }
    return r || ye;
  }
  /**
  @internal
  */
  eq(e) {
    if (this == e)
      return !0;
    if (!(e instanceof ne) || this.local.length != e.local.length || this.children.length != e.children.length)
      return !1;
    for (let n = 0; n < this.local.length; n++)
      if (!this.local[n].eq(e.local[n]))
        return !1;
    for (let n = 0; n < this.children.length; n += 3)
      if (this.children[n] != e.children[n] || this.children[n + 1] != e.children[n + 1] || !this.children[n + 2].eq(e.children[n + 2]))
        return !1;
    return !0;
  }
  /**
  @internal
  */
  locals(e) {
    return El(this.localsInner(e));
  }
  /**
  @internal
  */
  localsInner(e) {
    if (this == ye)
      return An;
    if (e.inlineContent || !this.local.some(qt.is))
      return this.local;
    let n = [];
    for (let r = 0; r < this.local.length; r++)
      this.local[r].type instanceof qt || n.push(this.local[r]);
    return n;
  }
  forEachSet(e) {
    e(this);
  }
}
ne.empty = new ne([], []);
ne.removeOverlap = El;
const ye = ne.empty;
class Bt {
  constructor(e) {
    this.members = e;
  }
  map(e, n) {
    const r = this.members.map((i) => i.map(e, n, cn));
    return Bt.from(r);
  }
  forChild(e, n) {
    if (n.isLeaf)
      return ne.empty;
    let r = [];
    for (let i = 0; i < this.members.length; i++) {
      let o = this.members[i].forChild(e, n);
      o != ye && (o instanceof Bt ? r = r.concat(o.members) : r.push(o));
    }
    return Bt.from(r);
  }
  eq(e) {
    if (!(e instanceof Bt) || e.members.length != this.members.length)
      return !1;
    for (let n = 0; n < this.members.length; n++)
      if (!this.members[n].eq(e.members[n]))
        return !1;
    return !0;
  }
  locals(e) {
    let n, r = !0;
    for (let i = 0; i < this.members.length; i++) {
      let o = this.members[i].localsInner(e);
      if (o.length)
        if (!n)
          n = o;
        else {
          r && (n = n.slice(), r = !1);
          for (let s = 0; s < o.length; s++)
            n.push(o[s]);
        }
    }
    return n ? El(r ? n : n.sort(un)) : An;
  }
  // Create a group for the given array of decoration sets, or return
  // a single set when possible.
  static from(e) {
    switch (e.length) {
      case 0:
        return ye;
      case 1:
        return e[0];
      default:
        return new Bt(e.every((n) => n instanceof ne) ? e : e.reduce((n, r) => n.concat(r instanceof ne ? r : r.members), []));
    }
  }
  forEachSet(e) {
    for (let n = 0; n < this.members.length; n++)
      this.members[n].forEachSet(e);
  }
}
function Ex(t, e, n, r, i, o, s) {
  let l = t.slice();
  for (let c = 0, u = o; c < n.maps.length; c++) {
    let h = 0;
    n.maps[c].forEach((d, f, p, m) => {
      let y = m - p - (f - d);
      for (let g = 0; g < l.length; g += 3) {
        let N = l[g + 1];
        if (N < 0 || d > N + u - h)
          continue;
        let w = l[g] + u - h;
        f >= w ? l[g + 1] = d <= w ? -2 : -1 : d >= u && y && (l[g] += y, l[g + 1] += y);
      }
      h += y;
    }), u = n.maps[c].map(u, -1);
  }
  let a = !1;
  for (let c = 0; c < l.length; c += 3)
    if (l[c + 1] < 0) {
      if (l[c + 1] == -2) {
        a = !0, l[c + 1] = -1;
        continue;
      }
      let u = n.map(t[c] + o), h = u - i;
      if (h < 0 || h >= r.content.size) {
        a = !0;
        continue;
      }
      let d = n.map(t[c + 1] + o, -1), f = d - i, { index: p, offset: m } = r.content.findIndex(h), y = r.maybeChild(p);
      if (y && m == h && m + y.nodeSize == f) {
        let g = l[c + 2].mapInner(n, y, u + 1, t[c] + o + 1, s);
        g != ye ? (l[c] = h, l[c + 1] = f, l[c + 2] = g) : (l[c + 1] = -2, a = !0);
      } else
        a = !0;
    }
  if (a) {
    let c = Ox(l, t, e, n, i, o, s), u = Li(c, r, 0, s);
    e = u.local;
    for (let h = 0; h < l.length; h += 3)
      l[h + 1] < 0 && (l.splice(h, 3), h -= 3);
    for (let h = 0, d = 0; h < u.children.length; h += 3) {
      let f = u.children[h];
      for (; d < l.length && l[d] < f; )
        d += 3;
      l.splice(d, 0, u.children[h], u.children[h + 1], u.children[h + 2]);
    }
  }
  return new ne(e.sort(un), l);
}
function yd(t, e) {
  if (!e || !t.length)
    return t;
  let n = [];
  for (let r = 0; r < t.length; r++) {
    let i = t[r];
    n.push(new me(i.from + e, i.to + e, i.type));
  }
  return n;
}
function Ox(t, e, n, r, i, o, s) {
  function l(a, c) {
    for (let u = 0; u < a.local.length; u++) {
      let h = a.local[u].map(r, i, c);
      h ? n.push(h) : s.onRemove && s.onRemove(a.local[u].spec);
    }
    for (let u = 0; u < a.children.length; u += 3)
      l(a.children[u + 2], a.children[u] + c + 1);
  }
  for (let a = 0; a < t.length; a += 3)
    t[a + 1] == -1 && l(t[a + 2], e[a] + o + 1);
  return n;
}
function kd(t, e, n) {
  if (e.isLeaf)
    return null;
  let r = n + e.nodeSize, i = null;
  for (let o = 0, s; o < t.length; o++)
    (s = t[o]) && s.from > n && s.to < r && ((i || (i = [])).push(s), t[o] = null);
  return i;
}
function bd(t) {
  let e = [];
  for (let n = 0; n < t.length; n++)
    t[n] != null && e.push(t[n]);
  return e;
}
function Li(t, e, n, r) {
  let i = [], o = !1;
  e.forEach((l, a) => {
    let c = kd(t, l, a + n);
    if (c) {
      o = !0;
      let u = Li(c, l, n + a + 1, r);
      u != ye && i.push(a, a + l.nodeSize, u);
    }
  });
  let s = yd(o ? bd(t) : t, -n).sort(un);
  for (let l = 0; l < s.length; l++)
    s[l].type.valid(e, s[l]) || (r.onRemove && r.onRemove(s[l].spec), s.splice(l--, 1));
  return s.length || i.length ? new ne(s, i) : ye;
}
function un(t, e) {
  return t.from - e.from || t.to - e.to;
}
function El(t) {
  let e = t;
  for (let n = 0; n < e.length - 1; n++) {
    let r = e[n];
    if (r.from != r.to)
      for (let i = n + 1; i < e.length; i++) {
        let o = e[i];
        if (o.from == r.from) {
          o.to != r.to && (e == t && (e = t.slice()), e[i] = o.copy(o.from, r.to), cu(e, i + 1, o.copy(r.to, o.to)));
          continue;
        } else {
          o.from < r.to && (e == t && (e = t.slice()), e[n] = r.copy(r.from, o.from), cu(e, i, r.copy(o.from, r.to)));
          break;
        }
      }
  }
  return e;
}
function cu(t, e, n) {
  for (; e < t.length && un(n, t[e]) > 0; )
    e++;
  t.splice(e, 0, n);
}
function Po(t) {
  let e = [];
  return t.someProp("decorations", (n) => {
    let r = n(t.state);
    r && r != ye && e.push(r);
  }), t.cursorWrapper && e.push(ne.create(t.state.doc, [t.cursorWrapper.deco])), Bt.from(e);
}
const vx = {
  childList: !0,
  characterData: !0,
  characterDataOldValue: !0,
  attributes: !0,
  attributeOldValue: !0,
  subtree: !0
}, Dx = Ae && Vt <= 11;
class Rx {
  constructor() {
    this.anchorNode = null, this.anchorOffset = 0, this.focusNode = null, this.focusOffset = 0;
  }
  set(e) {
    this.anchorNode = e.anchorNode, this.anchorOffset = e.anchorOffset, this.focusNode = e.focusNode, this.focusOffset = e.focusOffset;
  }
  clear() {
    this.anchorNode = this.focusNode = null;
  }
  eq(e) {
    return e.anchorNode == this.anchorNode && e.anchorOffset == this.anchorOffset && e.focusNode == this.focusNode && e.focusOffset == this.focusOffset;
  }
}
class zx {
  constructor(e, n) {
    this.view = e, this.handleDOMChange = n, this.queue = [], this.flushingSoon = -1, this.observer = null, this.currentSelection = new Rx(), this.onCharData = null, this.suppressingSelectionUpdates = !1, this.lastChangedTextNode = null, this.observer = window.MutationObserver && new window.MutationObserver((r) => {
      for (let i = 0; i < r.length; i++)
        this.queue.push(r[i]);
      Ae && Vt <= 11 && r.some((i) => i.type == "childList" && i.removedNodes.length || i.type == "characterData" && i.oldValue.length > i.target.nodeValue.length) ? this.flushSoon() : xe && e.composing && r.some((i) => i.type == "childList" && i.target.nodeName == "TR") ? (e.input.badSafariComposition = !0, this.flushSoon()) : this.flush();
    }), Dx && (this.onCharData = (r) => {
      this.queue.push({ target: r.target, type: "characterData", oldValue: r.prevValue }), this.flushSoon();
    }), this.onSelectionChange = this.onSelectionChange.bind(this);
  }
  flushSoon() {
    this.flushingSoon < 0 && (this.flushingSoon = window.setTimeout(() => {
      this.flushingSoon = -1, this.flush();
    }, 20));
  }
  forceFlush() {
    this.flushingSoon > -1 && (window.clearTimeout(this.flushingSoon), this.flushingSoon = -1, this.flush());
  }
  start() {
    this.observer && (this.observer.takeRecords(), this.observer.observe(this.view.dom, vx)), this.onCharData && this.view.dom.addEventListener("DOMCharacterDataModified", this.onCharData), this.connectSelection();
  }
  stop() {
    if (this.observer) {
      let e = this.observer.takeRecords();
      if (e.length) {
        for (let n = 0; n < e.length; n++)
          this.queue.push(e[n]);
        window.setTimeout(() => this.flush(), 20);
      }
      this.observer.disconnect();
    }
    this.onCharData && this.view.dom.removeEventListener("DOMCharacterDataModified", this.onCharData), this.disconnectSelection();
  }
  connectSelection() {
    this.view.dom.ownerDocument.addEventListener("selectionchange", this.onSelectionChange);
  }
  disconnectSelection() {
    this.view.dom.ownerDocument.removeEventListener("selectionchange", this.onSelectionChange);
  }
  suppressSelectionUpdates() {
    this.suppressingSelectionUpdates = !0, setTimeout(() => this.suppressingSelectionUpdates = !1, 50);
  }
  onSelectionChange() {
    if (nu(this.view)) {
      if (this.suppressingSelectionUpdates)
        return St(this.view);
      if (Ae && Vt <= 11 && !this.view.state.selection.empty) {
        let e = this.view.domSelectionRange();
        if (e.focusNode && yn(e.focusNode, e.focusOffset, e.anchorNode, e.anchorOffset))
          return this.flushSoon();
      }
      this.flush();
    }
  }
  setCurSelection() {
    this.currentSelection.set(this.view.domSelectionRange());
  }
  ignoreSelectionChange(e) {
    if (!e.focusNode)
      return !0;
    let n = /* @__PURE__ */ new Set(), r;
    for (let o = e.focusNode; o; o = Ln(o))
      n.add(o);
    for (let o = e.anchorNode; o; o = Ln(o))
      if (n.has(o)) {
        r = o;
        break;
      }
    let i = r && this.view.docView.nearestDesc(r);
    if (i && i.ignoreMutation({
      type: "selection",
      target: se(r) ? r.parentNode : r
    }))
      return this.setCurSelection(), !0;
  }
  pendingRecords() {
    if (this.observer)
      for (let e of this.observer.takeRecords())
        this.queue.push(e);
    return this.queue;
  }
  flush() {
    let { view: e } = this;
    if (!e.docView || this.flushingSoon > -1)
      return;
    let n = this.pendingRecords();
    n.length && (this.queue = []);
    let r = e.domSelectionRange(), i = !this.suppressingSelectionUpdates && !this.currentSelection.eq(r) && nu(e) && !this.ignoreSelectionChange(r), o = -1, s = -1, l = !1, a = [];
    if (e.editable)
      for (let u = 0; u < n.length; u++) {
        let h = this.registerMutation(n[u], a);
        h && (o = o < 0 ? h.from : Math.min(h.from, o), s = s < 0 ? h.to : Math.max(h.to, s), h.typeOver && (l = !0));
      }
    if (a.some((u) => u.nodeName == "BR") && (e.input.lastKeyCode == 8 || e.input.lastKeyCode == 46 || pe && (e.composing || e.input.compositionEndedAt > Date.now() - 50) && n.some((u) => u.type == "childList" && u.removedNodes.length))) {
      for (let u of a)
        if (u.nodeName == "BR" && u.parentNode) {
          let h = u.nextSibling;
          for (; h && z(h); ) {
            if (h.contentEditable == "false") {
              u.parentNode.removeChild(u);
              break;
            }
            h = h.firstChild;
          }
        }
    } else if (Be && a.length) {
      let u = a.filter((h) => h.nodeName == "BR");
      if (u.length == 2) {
        let [h, d] = u;
        h.parentNode && h.parentNode.parentNode == d.parentNode ? d.remove() : h.remove();
      } else {
        let { focusNode: h } = this.currentSelection;
        for (let d of u) {
          let f = d.parentNode;
          f && f.nodeName == "LI" && (!h || Bx(e, h) != f) && d.remove();
        }
      }
    }
    let c = null;
    o < 0 && i && e.input.lastFocus > Date.now() - 200 && Math.max(e.input.lastTouch, e.input.lastClick.time) < Date.now() - 300 && to(r) && (c = Cl(e)) && c.eq($.near(e.state.doc.resolve(0), 1)) ? (e.input.lastFocus = 0, St(e), this.currentSelection.set(r), e.scrollToSelection()) : (o > -1 || i) && (o > -1 && (e.docView.markDirty(o, s), Px(e)), e.input.badSafariComposition && (e.input.badSafariComposition = !1, Fx(e, a)), this.handleDOMChange(o, s, l, a), e.docView && e.docView.dirty ? e.updateState(e.state) : this.currentSelection.eq(r) || St(e), this.currentSelection.set(r));
  }
  registerMutation(e, n) {
    if (n.indexOf(e.target) > -1)
      return null;
    let r = this.view.docView.nearestDesc(e.target);
    if (e.type == "attributes" && (r == this.view.docView || e.attributeName == "contenteditable" || // Firefox sometimes fires spurious events for null/empty styles
    e.attributeName == "style" && !e.oldValue && !e.target.getAttribute("style")) || !r || r.ignoreMutation(e))
      return null;
    if (e.type == "childList") {
      for (let u = 0; u < e.addedNodes.length; u++) {
        let h = e.addedNodes[u];
        n.push(h), se(h) && (this.lastChangedTextNode = h);
      }
      if (r.contentDOM && r.contentDOM != r.dom && !r.contentDOM.contains(e.target))
        return { from: r.posBefore, to: r.posAfter };
      let i = e.previousSibling, o = e.nextSibling;
      if (Ae && Vt <= 11 && e.addedNodes.length)
        for (let u = 0; u < e.addedNodes.length; u++) {
          let { previousSibling: h, nextSibling: d } = e.addedNodes[u];
          (!h || Array.prototype.indexOf.call(e.addedNodes, h) < 0) && (i = h), (!d || Array.prototype.indexOf.call(e.addedNodes, d) < 0) && (o = d);
        }
      let s = i && i.parentNode == e.target ? fe(i) + 1 : 0, l = r.localPosFromDOM(e.target, s, -1), a = o && o.parentNode == e.target ? fe(o) : e.target.childNodes.length, c = r.localPosFromDOM(e.target, a, 1);
      return { from: l, to: c };
    } else return e.type == "attributes" ? { from: r.posAtStart - r.border, to: r.posAtEnd + r.border } : (this.lastChangedTextNode = e.target, {
      from: r.posAtStart,
      to: r.posAtEnd,
      // An event was generated for a text change that didn't change
      // any text. Mark the dom change to fall back to assuming the
      // selection was typed over with an identical value if it can't
      // find another change.
      typeOver: e.target.nodeValue == e.oldValue
    });
  }
}
let uu = /* @__PURE__ */ new WeakMap(), hu = !1;
function Px(t) {
  if (!uu.has(t) && (uu.set(t, null), ["normal", "nowrap", "pre-line"].indexOf(getComputedStyle(t.dom).whiteSpace) !== -1)) {
    if (t.requiresGeckoHackNode = Be, hu)
      return;
    console.warn("ProseMirror expects the CSS white-space property to be set, preferably to 'pre-wrap'. It is recommended to load style/prosemirror.css from the prosemirror-view package."), hu = !0;
  }
}
function fu(t, e) {
  let n = e.startContainer, r = e.startOffset, i = e.endContainer, o = e.endOffset, s = t.domAtPos(t.state.selection.anchor);
  return yn(s.node, s.offset, i, o) && ([n, r, i, o] = [i, o, n, r]), { anchorNode: n, anchorOffset: r, focusNode: i, focusOffset: o };
}
function Lx(t, e) {
  if (e.getComposedRanges) {
    let i = e.getComposedRanges(t.root)[0];
    if (i)
      return fu(t, i);
  }
  let n;
  function r(i) {
    i.preventDefault(), i.stopImmediatePropagation(), n = i.getTargetRanges()[0];
  }
  return t.dom.addEventListener("beforeinput", r, !0), document.execCommand("indent"), t.dom.removeEventListener("beforeinput", r, !0), n ? fu(t, n) : null;
}
function Bx(t, e) {
  for (let n = e.parentNode; n && n != t.dom; n = n.parentNode) {
    let r = t.docView.nearestDesc(n, !0);
    if (r && r.node.isBlock)
      return n;
  }
  return null;
}
function Fx(t, e) {
  var n;
  let { focusNode: r, focusOffset: i } = t.domSelectionRange();
  for (let o of e)
    if (((n = o.parentNode) === null || n === void 0 ? void 0 : n.nodeName) == "TR") {
      let s = o.nextSibling;
      for (; s && s.nodeName != "TD" && s.nodeName != "TH"; )
        s = s.nextSibling;
      if (s) {
        let l = s;
        for (; ; ) {
          let a = l.firstChild;
          if (!a || !z(a) || a.contentEditable == "false" || /^(BR|IMG)$/.test(a.nodeName))
            break;
          l = a;
        }
        l.insertBefore(o, l.firstChild), r == o && t.domSelection().collapse(o, i);
      } else
        o.parentNode.removeChild(o);
    }
}
function _x(t, e, n, r) {
  let { node: i, fromOffset: o, toOffset: s, from: l, to: a } = t.docView.parseRange(e, n), c = t.domSelectionRange(), u, h = c.anchorNode;
  if (h && kn(t.dom, h) && (u = [{ node: h, offset: c.anchorOffset }], to(c) || u.push({ node: c.focusNode, offset: c.focusOffset })), pe && t.input.lastKeyCode === 8)
    for (let g = s; g > o; g--) {
      let N = i.childNodes[g - 1], w = N.pmViewDesc;
      if (N.nodeName == "BR" && !w) {
        s = g;
        break;
      }
      if (!w || w.size)
        break;
    }
  let d = t.state.doc, f = t.someProp("domParser") || Rn.fromSchema(t.state.schema), p = d.resolve(l), m = null, y = f.parse(i, {
    topNode: p.parent,
    topMatch: p.parent.contentMatchAt(p.index()),
    topOpen: !0,
    from: o,
    to: s,
    preserveWhitespace: p.parent.type.whitespace == "pre" ? "full" : !0,
    findPositions: u,
    ruleFromNode: $x(r),
    context: p
  });
  if (u && u[0].pos != null) {
    let g = u[0].pos, N = u[1] && u[1].pos;
    N == null && (N = g), m = { anchor: g + l, head: N + l };
  }
  return { doc: y, sel: m, from: l, to: a };
}
const $x = (t) => (e) => {
  let n = e.pmViewDesc;
  if (n)
    return n.parseRule(t);
  if (e.nodeName == "BR" && e.parentNode) {
    if (xe && /^(ul|ol)$/i.test(e.parentNode.nodeName)) {
      let r = document.createElement("div");
      return r.appendChild(document.createElement("li")), { skip: r };
    } else if (e.parentNode.lastChild == e || xe && /^(tr|table)$/i.test(e.parentNode.nodeName))
      return { ignore: !0 };
  } else if (e.nodeName == "IMG" && e.getAttribute("mark-placeholder"))
    return { ignore: !0 };
  return null;
}, Vx = /^(a|abbr|acronym|b|bd[io]|big|br|button|cite|code|data(list)?|del|dfn|em|i|img|ins|kbd|label|map|mark|meter|output|q|ruby|s|samp|small|span|strong|su[bp]|time|u|tt|var)$/i;
function Hx(t, e, n, r, i) {
  let o = t.input.compositionPendingChanges || (t.composing ? t.input.compositionID : 0);
  if (t.input.compositionPendingChanges = 0, e < 0) {
    let A = t.input.lastSelectionTime > Date.now() - 50 ? t.input.lastSelectionOrigin : null, R = Cl(t, A);
    if (R && !t.state.selection.eq(R)) {
      if (pe && wt && t.input.lastKeyCode === 13 && Date.now() - 100 < t.input.lastKeyCodeTime && t.someProp("handleKeyDown", (C) => C(t, nn(13, "Enter"))))
        return;
      let F = t.state.tr.setSelection(R);
      A == "pointer" ? F.setMeta("pointer", !0) : A == "key" && F.scrollIntoView(), o && F.setMeta("composition", o), t.dispatch(F);
    }
    return;
  }
  let s = t.state.doc.resolve(e), l = s.sharedDepth(n);
  e = s.before(l + 1), n = t.state.doc.resolve(n).after(l + 1);
  let a = t.state.selection, c = _x(t, e, n, i), u = t.state.doc, h = u.slice(c.from, c.to), d, f;
  t.input.lastKeyCode === 8 && Date.now() - 100 < t.input.lastKeyCodeTime ? (d = t.state.selection.to, f = "end") : (d = t.state.selection.from, f = "start"), t.input.lastKeyCode = null;
  let p = Kx(h.content, c.doc.content, c.from, d, f);
  if (p && t.input.domChangeCount++, (Bn && t.input.lastIOSEnter > Date.now() - 225 || wt) && i.some((A) => z(A) && !Vx.test(A.nodeName)) && (!p || p.endA >= p.endB) && t.someProp("handleKeyDown", (A) => A(t, nn(13, "Enter")))) {
    t.input.lastIOSEnter = 0;
    return;
  }
  if (!p)
    if (r && a instanceof V && !a.empty && a.$head.sameParent(a.$anchor) && !t.composing && !(c.sel && c.sel.anchor != c.sel.head))
      p = { start: a.from, endA: a.to, endB: a.to };
    else {
      if (c.sel) {
        let A = du(t, t.state.doc, c.sel);
        if (A && !A.eq(t.state.selection)) {
          let R = t.state.tr.setSelection(A);
          o && R.setMeta("composition", o), t.dispatch(R);
        }
      }
      return;
    }
  t.state.selection.from < t.state.selection.to && p.start == p.endB && t.state.selection instanceof V && (p.start > t.state.selection.from && p.start <= t.state.selection.from + 2 && t.state.selection.from >= c.from ? p.start = t.state.selection.from : p.endA < t.state.selection.to && p.endA >= t.state.selection.to - 2 && t.state.selection.to <= c.to && (p.endB += t.state.selection.to - p.endA, p.endA = t.state.selection.to)), Ae && Vt <= 11 && p.endB == p.start + 1 && p.endA == p.start && p.start > c.from && c.doc.textBetween(p.start - c.from - 1, p.start - c.from + 1) == "  " && (p.start--, p.endA--, p.endB--);
  let m = c.doc.resolveNoCache(p.start - c.from), y = c.doc.resolveNoCache(p.endB - c.from), g = u.resolve(p.start), N = m.sameParent(y) && m.parent.inlineContent && g.end() >= p.endA;
  if ((Bn && t.input.lastIOSEnter > Date.now() - 225 && (!N || i.some((A) => A.nodeName == "DIV" || A.nodeName == "P")) || !N && Wx(c.doc, m.pos, y.pos)) && t.someProp("handleKeyDown", (A) => A(t, nn(13, "Enter")))) {
    t.input.lastIOSEnter = 0;
    return;
  }
  if (t.state.selection.anchor > p.start && qx(u, p.start, p.endA, m, y) && t.someProp("handleKeyDown", (A) => A(t, nn(8, "Backspace")))) {
    wt && pe && t.domObserver.suppressSelectionUpdates();
    return;
  }
  pe && p.endB == p.start && (t.input.lastChromeDelete = Date.now()), wt && !N && m.start() != y.start() && y.parentOffset == 0 && m.depth == y.depth && c.sel && c.sel.anchor == c.sel.head && c.sel.head == p.endA && (p.endB -= 2, y = c.doc.resolveNoCache(p.endB - c.from), setTimeout(() => {
    t.someProp("handleKeyDown", function(A) {
      return A(t, nn(13, "Enter"));
    });
  }, 20));
  let w = p.start, O = p.endA, v = (A) => {
    let R = A || t.state.tr.replace(w, O, c.doc.slice(p.start - c.from, p.endB - c.from));
    if (c.sel) {
      let F = du(t, R.doc, c.sel);
      F && !(pe && t.composing && F.empty && (p.start != p.endB || t.input.lastChromeDelete < Date.now() - 100) && (F.head == w || F.head == R.mapping.map(O) - 1) || Ae && F.empty && F.head == w) && R.setSelection(F);
    }
    return o && R.setMeta("composition", o), R.scrollIntoView();
  }, x;
  if (N)
    if (m.pos == y.pos) {
      Ae && Vt <= 11 && m.parentOffset == 0 && (t.domObserver.suppressSelectionUpdates(), setTimeout(() => St(t), 20));
      let A = v(t.state.tr.delete(w, O)), R = u.resolve(p.start).marksAcross(u.resolve(p.endA));
      R && A.ensureMarks(R), t.dispatch(A);
    } else if (
      // Adding or removing a mark
      p.endA == p.endB && (x = jx(m.parent.content.cut(m.parentOffset, y.parentOffset), g.parent.content.cut(g.parentOffset, p.endA - g.start())))
    ) {
      let A = v(t.state.tr);
      x.type == "add" ? A.addMark(w, O, x.mark) : A.removeMark(w, O, x.mark), t.dispatch(A);
    } else if (m.parent.child(m.index()).isText && m.index() == y.index() - (y.textOffset ? 0 : 1)) {
      let A = m.parent.textBetween(m.parentOffset, y.parentOffset), R = () => v(t.state.tr.insertText(A, w, O));
      t.someProp("handleTextInput", (F) => F(t, w, O, A, R)) || t.dispatch(R());
    } else
      t.dispatch(v());
  else
    t.dispatch(v());
}
function du(t, e, n) {
  return Math.max(n.anchor, n.head) > e.content.size ? null : Sl(t, e.resolve(n.anchor), e.resolve(n.head));
}
function jx(t, e) {
  let n = t.firstChild.marks, r = e.firstChild.marks, i = n, o = r, s, l, a;
  for (let u = 0; u < r.length; u++)
    i = r[u].removeFromSet(i);
  for (let u = 0; u < n.length; u++)
    o = n[u].removeFromSet(o);
  if (i.length == 1 && o.length == 0)
    l = i[0], s = "add", a = (u) => u.mark(l.addToSet(u.marks));
  else if (i.length == 0 && o.length == 1)
    l = o[0], s = "remove", a = (u) => u.mark(l.removeFromSet(u.marks));
  else
    return null;
  let c = [];
  for (let u = 0; u < e.childCount; u++)
    c.push(a(e.child(u)));
  if (T.from(c).eq(t))
    return { mark: l, type: s };
}
function qx(t, e, n, r, i) {
  if (
    // The content must have shrunk
    n - e <= i.pos - r.pos || // newEnd must point directly at or after the end of the block that newStart points into
    Lo(r, !0, !1) < i.pos
  )
    return !1;
  let o = t.resolve(e);
  if (!r.parent.isTextblock) {
    let l = o.nodeAfter;
    return l != null && n == e + l.nodeSize;
  }
  if (o.parentOffset < o.parent.content.size || !o.parent.isTextblock)
    return !1;
  let s = t.resolve(Lo(o, !0, !0));
  return !s.parent.isTextblock || s.pos > n || Lo(s, !0, !1) < n ? !1 : r.parent.content.cut(r.parentOffset).eq(s.parent.content);
}
function Wx(t, e, n) {
  let r = 0, i = 0;
  return t.nodesBetween(e, n, (o, s) => {
    o.isTextblock && s >= e && s < n ? r++ : (o.isText ? /\S/.test(o.text.slice(Math.max(0, e - s), Math.min(o.nodeSize, n - s))) : o.isLeaf) && i++;
  }), i == 0 && r == 1;
}
function Lo(t, e, n) {
  let r = t.depth, i = e ? t.end() : t.pos;
  for (; r > 0 && (e || t.indexAfter(r) == t.node(r).childCount); )
    r--, i++, e = !1;
  if (n) {
    let o = t.node(r).maybeChild(t.indexAfter(r));
    for (; o && !o.isLeaf; )
      o = o.firstChild, i++;
  }
  return i;
}
function Kx(t, e, n, r, i) {
  let o = t.findDiffStart(e, n), s = n + t.size, l = n + e.size;
  if (o == null)
    return null;
  let { a, b: c } = t.findDiffEnd(e, s, l);
  if (i == "end") {
    let u = Math.max(0, o - Math.min(a, c));
    r -= a + u - o;
  }
  if (a < o && s < l) {
    let u = r <= o && r >= a ? o - r : 0;
    o -= u, c = o + (c - a), a = o;
  } else if (c < o) {
    let u = r <= o && r >= c ? o - r : 0;
    o -= u, a = o + (a - c), c = o;
  }
  return { start: o, endA: a, endB: c };
}
class xd {
  /**
  Create a view. `place` may be a DOM node that the editor should
  be appended to, a function that will place it into the document,
  or an object whose `mount` property holds the node to use as the
  document container. If it is `null`, the editor will not be
  added to the document.
  */
  constructor(e, n) {
    this._root = null, this.focused = !1, this.trackWrites = null, this.mounted = !1, this.markCursor = null, this.cursorWrapper = null, this.lastSelectedViewDesc = void 0, this.input = new lx(), this.prevDirectPlugins = [], this.pluginViews = [], this.requiresGeckoHackNode = !1, this.dragging = null, this._props = n, this.state = n.state, this.directPlugins = n.plugins || [], this.directPlugins.forEach(ku), this.dispatch = this.dispatch.bind(this), this.dom = e && e.mount || document.createElement("div"), e && (e.appendChild ? e.appendChild(this.dom) : typeof e == "function" ? e(this.dom) : e.mount && (this.mounted = !0)), this.editable = gu(this), mu(this), this.nodeViews = yu(this), this.docView = Yc(this.state.doc, pu(this), Po(this), this.dom, this), this.domObserver = new zx(this, (r, i, o, s) => Hx(this, r, i, o, s)), this.domObserver.start(), ax(this), this.updatePluginViews();
  }
  /**
  Holds `true` when a
  [composition](https://w3c.github.io/uievents/#events-compositionevents)
  is active.
  */
  get composing() {
    return this.input.composing;
  }
  /**
  The view's current [props](https://prosemirror.net/docs/ref/#view.EditorProps).
  */
  get props() {
    if (this._props.state != this.state) {
      let e = this._props;
      this._props = {};
      for (let n in e)
        this._props[n] = e[n];
      this._props.state = this.state;
    }
    return this._props;
  }
  /**
  Update the view's props. Will immediately cause an update to
  the DOM.
  */
  update(e) {
    e.handleDOMEvents != this._props.handleDOMEvents && Ls(this);
    let n = this._props;
    this._props = e, e.plugins && (e.plugins.forEach(ku), this.directPlugins = e.plugins), this.updateStateInner(e.state, n);
  }
  /**
  Update the view by updating existing props object with the object
  given as argument. Equivalent to `view.update(Object.assign({},
  view.props, props))`.
  */
  setProps(e) {
    let n = {};
    for (let r in this._props)
      n[r] = this._props[r];
    n.state = this.state;
    for (let r in e)
      n[r] = e[r];
    this.update(n);
  }
  /**
  Update the editor's `state` prop, without touching any of the
  other props.
  */
  updateState(e) {
    this.updateStateInner(e, this._props);
  }
  updateStateInner(e, n) {
    var r;
    let i = this.state, o = !1, s = !1;
    e.storedMarks && this.composing && (dd(this), s = !0), this.state = e;
    let l = i.plugins != e.plugins || this._props.plugins != n.plugins;
    if (l || this._props.plugins != n.plugins || this._props.nodeViews != n.nodeViews) {
      let f = yu(this);
      Jx(f, this.nodeViews) && (this.nodeViews = f, o = !0);
    }
    (l || n.handleDOMEvents != this._props.handleDOMEvents) && Ls(this), this.editable = gu(this), mu(this);
    let a = Po(this), c = pu(this), u = i.plugins != e.plugins && !i.doc.eq(e.doc) ? "reset" : e.scrollToSelection > i.scrollToSelection ? "to selection" : "preserve", h = o || !this.docView.matchesNode(e.doc, c, a);
    (h || !e.selection.eq(i.selection)) && (s = !0);
    let d = u == "preserve" && s && this.dom.style.overflowAnchor == null && C0(this);
    if (s) {
      this.domObserver.stop();
      let f = h && (Ae || pe) && !this.composing && !i.selection.empty && !e.selection.empty && Ux(i.selection, e.selection);
      if (h) {
        let m = pe ? this.trackWrites = this.domSelectionRange().focusNode : null;
        this.composing && (this.input.compositionNode = Sx(this)), (o || !this.docView.update(e.doc, c, a, this)) && (this.docView.updateOuterDeco(c), this.docView.destroy(), this.docView = Yc(e.doc, c, a, this.dom, this)), m && (!this.trackWrites || !this.dom.contains(this.trackWrites)) && (f = !0);
      }
      let p = this.input.mouseDown;
      f || !(p && this.domObserver.currentSelection.eq(this.domSelectionRange()) && K0(this) && p.delaySelUpdate()) ? St(this, f) : (Zf(this, e.selection), this.domObserver.setCurSelection()), this.domObserver.start();
    }
    this.updatePluginViews(i), !((r = this.dragging) === null || r === void 0) && r.node && !i.doc.eq(e.doc) && this.updateDraggedNode(this.dragging, i), u == "reset" ? this.dom.scrollTop = 0 : u == "to selection" ? this.scrollToSelection() : d && S0(d);
  }
  /**
  @internal
  */
  scrollToSelection() {
    let e = this.domSelectionRange().focusNode;
    if (!(!e || !kn(this.dom, e))) {
      if (!this.someProp("handleScrollToSelection", (n) => n(this))) if (this.state.selection instanceof _) {
        let n = this.docView.domAfterPos(this.state.selection.from);
        z(n) && Wc(this, n.getBoundingClientRect(), e);
      } else
        Wc(this, this.coordsAtPos(this.state.selection.head, 1), e);
    }
  }
  destroyPluginViews() {
    let e;
    for (; e = this.pluginViews.pop(); )
      e.destroy && e.destroy();
  }
  updatePluginViews(e) {
    if (!e || e.plugins != this.state.plugins || this.directPlugins != this.prevDirectPlugins) {
      this.prevDirectPlugins = this.directPlugins, this.destroyPluginViews();
      for (let n = 0; n < this.directPlugins.length; n++) {
        let r = this.directPlugins[n];
        r.spec.view && this.pluginViews.push(r.spec.view(this));
      }
      for (let n = 0; n < this.state.plugins.length; n++) {
        let r = this.state.plugins[n];
        r.spec.view && this.pluginViews.push(r.spec.view(this));
      }
    } else
      for (let n = 0; n < this.pluginViews.length; n++) {
        let r = this.pluginViews[n];
        r.update && r.update(this, e);
      }
  }
  updateDraggedNode(e, n) {
    let r = e.node, i = -1;
    if (r.from < this.state.doc.content.size && this.state.doc.nodeAt(r.from) == r.node)
      i = r.from;
    else {
      let o = r.from + (this.state.doc.content.size - n.doc.content.size);
      (o > 0 && o < this.state.doc.content.size && this.state.doc.nodeAt(o)) == r.node && (i = o);
    }
    this.dragging = new md(e.slice, e.move, i < 0 ? void 0 : _.create(this.state.doc, i));
  }
  someProp(e, n) {
    let r = this._props && this._props[e], i;
    if (r != null && (i = n ? n(r) : r))
      return i;
    for (let s = 0; s < this.directPlugins.length; s++) {
      let l = this.directPlugins[s].props[e];
      if (l != null && (i = n ? n(l) : l))
        return i;
    }
    let o = this.state.plugins;
    if (o)
      for (let s = 0; s < o.length; s++) {
        let l = o[s].props[e];
        if (l != null && (i = n ? n(l) : l))
          return i;
      }
  }
  /**
  Query whether the view has focus.
  */
  hasFocus() {
    if (Ae) {
      let e = this.root.activeElement;
      if (e == this.dom)
        return !0;
      if (!e || !this.dom.contains(e))
        return !1;
      for (; e && this.dom != e && this.dom.contains(e); ) {
        if (e.contentEditable == "false")
          return !1;
        e = e.parentElement;
      }
      return !0;
    }
    return this.root.activeElement == this.dom;
  }
  /**
  Focus the editor.
  */
  focus() {
    this.domObserver.stop(), this.editable && N0(this.dom), St(this), this.domObserver.start();
  }
  /**
  Get the document root in which the editor exists. This will
  usually be the top-level `document`, but might be a [shadow
  DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Shadow_DOM)
  root if the editor is inside one.
  */
  get root() {
    let e = this._root;
    if (e == null) {
      for (let n = this.dom.parentNode; n; n = n.parentNode)
        if (n.nodeType == 9 || n.nodeType == 11 && n.host)
          return n.getSelection || (Object.getPrototypeOf(n).getSelection = () => n.ownerDocument.getSelection()), this._root = n;
    }
    return e || document;
  }
  /**
  When an existing editor view is moved to a new document or
  shadow tree, call this to make it recompute its root.
  */
  updateRoot() {
    this._root = null;
  }
  /**
  Given a pair of viewport coordinates, return the document
  position that corresponds to them. May return null if the given
  coordinates aren't inside of the editor. When an object is
  returned, its `pos` property is the position nearest to the
  coordinates, and its `inside` property holds the position of the
  inner node that the position falls inside of, or -1 if it is at
  the top level, not in any node.
  */
  posAtCoords(e) {
    return E0(this, e);
  }
  /**
  Returns the viewport rectangle at a given document position.
  `left` and `right` will be the same number, as this returns a
  flat cursor-ish rectangle. If the position is between two things
  that aren't directly adjacent, `side` determines which element
  is used. When < 0, the element before the position is used,
  otherwise the element after.
  */
  coordsAtPos(e, n = 1) {
    return Wf(this, e, n);
  }
  /**
  Find the DOM position that corresponds to the given document
  position. When `side` is negative, find the position as close as
  possible to the content before the position. When positive,
  prefer positions close to the content after the position. When
  zero, prefer as shallow a position as possible.
  
  Note that you should **not** mutate the editor's internal DOM,
  only inspect it (and even that is usually not necessary).
  */
  domAtPos(e, n = 0) {
    return this.docView.domFromPos(e, n);
  }
  /**
  Find the DOM node that represents the document node after the
  given position. May return `null` when the position doesn't point
  in front of a node or if the node is inside an opaque node view.
  
  This is intended to be able to call things like
  `getBoundingClientRect` on that DOM node. Do **not** mutate the
  editor DOM directly, or add styling this way, since that will be
  immediately overriden by the editor as it redraws the node.
  */
  nodeDOM(e) {
    let n = this.docView.descAt(e);
    return n ? n.nodeDOM : null;
  }
  /**
  Find the document position that corresponds to a given DOM
  position. (Whenever possible, it is preferable to inspect the
  document structure directly, rather than poking around in the
  DOM, but sometimes—for example when interpreting an event
  target—you don't have a choice.)
  
  The `bias` parameter can be used to influence which side of a DOM
  node to use when the position is inside a leaf node.
  */
  posAtDOM(e, n, r = -1) {
    let i = this.docView.posFromDOM(e, n, r);
    if (i == null)
      throw new RangeError("DOM position not inside the editor");
    return i;
  }
  /**
  Find out whether the selection is at the end of a textblock when
  moving in a given direction. When, for example, given `"left"`,
  it will return true if moving left from the current cursor
  position would leave that position's parent textblock. Will apply
  to the view's current state by default, but it is possible to
  pass a different state.
  */
  endOfTextblock(e, n) {
    return z0(this, n || this.state, e);
  }
  /**
  Run the editor's paste logic with the given HTML string. The
  `event`, if given, will be passed to the
  [`handlePaste`](https://prosemirror.net/docs/ref/#view.EditorProps.handlePaste) hook.
  */
  pasteHTML(e, n) {
    return Er(this, "", e, !1, n || new ClipboardEvent("paste"));
  }
  /**
  Run the editor's paste logic with the given plain-text input.
  */
  pasteText(e, n) {
    return Er(this, e, null, !0, n || new ClipboardEvent("paste"));
  }
  /**
  Serialize the given slice as it would be if it was copied from
  this editor. Returns a DOM element that contains a
  representation of the slice as its children, a textual
  representation, and the transformed slice (which can be
  different from the given input due to hooks like
  [`transformCopied`](https://prosemirror.net/docs/ref/#view.EditorProps.transformCopied)).
  */
  serializeForClipboard(e) {
    return Nl(this, e);
  }
  /**
  Removes the editor from the DOM and destroys all [node
  views](https://prosemirror.net/docs/ref/#view.NodeView).
  */
  destroy() {
    this.docView && (cx(this), this.destroyPluginViews(), this.mounted ? (this.docView.update(this.state.doc, [], Po(this), this), this.dom.textContent = "") : this.dom.parentNode && this.dom.parentNode.removeChild(this.dom), this.docView.destroy(), this.docView = null, f0());
  }
  /**
  This is true when the view has been
  [destroyed](https://prosemirror.net/docs/ref/#view.EditorView.destroy) (and thus should not be
  used anymore).
  */
  get isDestroyed() {
    return this.docView == null;
  }
  /**
  Used for testing.
  */
  dispatchEvent(e) {
    return hx(this, e);
  }
  /**
  @internal
  */
  domSelectionRange() {
    let e = this.dom.isConnected !== !1 && this.domSelection();
    return e ? xe && this.root.nodeType === 11 && y0(this.dom.ownerDocument) == this.dom && Lx(this, e) || e : { focusNode: null, focusOffset: 0, anchorNode: null, anchorOffset: 0 };
  }
  /**
  @internal
  */
  domSelection() {
    return this.root.getSelection();
  }
}
xd.prototype.dispatch = function(t) {
  let e = this._props.dispatchTransaction;
  e ? e.call(this, t) : this.updateState(this.state.apply(t));
};
function pu(t) {
  let e = /* @__PURE__ */ Object.create(null);
  return e.class = "ProseMirror", e.contenteditable = String(t.editable), t.someProp("attributes", (n) => {
    if (typeof n == "function" && (n = n(t.state)), n)
      for (let r in n)
        r == "class" ? e.class += " " + n[r] : r == "style" ? e.style = (e.style ? e.style + ";" : "") + n[r] : !e[r] && r != "contenteditable" && r != "nodeName" && (e[r] = String(n[r]));
  }), e.translate || (e.translate = "no"), [me.node(0, t.state.doc.content.size, e)];
}
function mu(t) {
  if (t.markCursor) {
    let e = document.createElement("img");
    e.className = "ProseMirror-separator", e.setAttribute("mark-placeholder", "true"), e.setAttribute("alt", ""), t.cursorWrapper = { dom: e, deco: me.widget(t.state.selection.from, e, { raw: !0, marks: t.markCursor }) };
  } else
    t.cursorWrapper = null;
}
function gu(t) {
  return !t.someProp("editable", (e) => e(t.state) === !1);
}
function Ux(t, e) {
  let n = Math.min(t.$anchor.sharedDepth(t.head), e.$anchor.sharedDepth(e.head));
  return t.$anchor.start(n) != e.$anchor.start(n);
}
function yu(t) {
  let e = /* @__PURE__ */ Object.create(null);
  function n(r) {
    for (let i in r)
      Object.prototype.hasOwnProperty.call(e, i) || (e[i] = r[i]);
  }
  return t.someProp("nodeViews", n), t.someProp("markViews", n), e;
}
function Jx(t, e) {
  let n = 0, r = 0;
  for (let i in t) {
    if (t[i] != e[i])
      return !0;
    n++;
  }
  for (let i in e)
    r++;
  return n != r;
}
function ku(t) {
  if (t.spec.state || t.spec.filterTransaction || t.spec.appendTransaction)
    throw new RangeError("Plugins passed directly to the view must not have a state component");
}
function At(t, e) {
  return t.meta = {
    package: "@milkdown/core",
    group: "System",
    ...e
  }, t;
}
var wd = {
  text: (t, e, n, r) => {
    const i = t.value;
    return /^[^*_\\]*\s+$/.test(i) ? i : n.safe(i, {
      ...r,
      encode: []
    });
  },
  strong: (t, e, n, r) => {
    const i = t.marker || n.options.strong || "*", o = n.enter("strong"), s = n.createTracker(r);
    let l = s.move(i + i);
    return l += s.move(n.containerPhrasing(t, {
      before: l,
      after: i,
      ...s.current()
    })), l += s.move(i + i), o(), l;
  },
  emphasis: (t, e, n, r) => {
    const i = t.marker || n.options.emphasis || "*", o = n.enter("emphasis"), s = n.createTracker(r);
    let l = s.move(i);
    return l += s.move(n.containerPhrasing(t, {
      before: l,
      after: i,
      ...s.current()
    })), l += s.move(i), o(), l;
  }
}, ot = W({}, "editorView"), lr = W({}, "editorState"), Bo = W([], "initTimer"), bu = W({}, "editor"), vr = W([], "inputRules"), Tt = W([], "prosePlugins"), Dr = W([], "remarkPlugins"), Bs = W([], "nodeView"), Fs = W([], "markView"), hn = W(ks().use(us).use(ms), "remark"), gr = W({
  handlers: wd,
  encode: []
}, "remarkStringifyOptions"), fi = ut("ConfigReady");
function Gx(t) {
  const e = (n) => (n.record(fi), async () => (await t(n), n.done(fi), () => {
    n.clearTimer(fi);
  }));
  return At(e, { displayName: "Config" }), e;
}
var fn = ut("InitReady");
function Yx(t) {
  const e = (n) => (n.inject(bu, t).inject(Tt, []).inject(Dr, []).inject(vr, []).inject(Bs, []).inject(Fs, []).inject(gr, {
    handlers: wd,
    encode: []
  }).inject(hn, ks().use(us).use(ms)).inject(Bo, [fi]).record(fn), async () => {
    await n.waitTimers(Bo);
    const r = n.get(gr);
    return n.set(hn, ks().use(us).use(ms, r)), n.done(fn), () => {
      n.remove(bu).remove(Tt).remove(Dr).remove(vr).remove(Bs).remove(Fs).remove(gr).remove(hn).remove(Bo).clearTimer(fn);
    };
  });
  return At(e, { displayName: "Init" }), e;
}
var Ie = ut("SchemaReady"), Fo = W([], "schemaTimer"), Nt = W({}, "schema"), yr = W([], "nodes"), kr = W([], "marks");
function xu(t) {
  return {
    ...t,
    parseDOM: t.parseDOM?.map((e) => ({
      priority: t.priority,
      ...e
    }))
  };
}
var Cd = (t) => (t.inject(Nt, {}).inject(yr, []).inject(kr, []).inject(Fo, [fn]).record(Ie), async () => {
  await t.waitTimers(Fo);
  const e = t.get(hn), n = t.get(Dr).reduce((s, l) => s.use(l.plugin, l.options), e);
  t.set(hn, n);
  const r = Object.fromEntries(t.get(yr).map(([s, l]) => [s, xu(l)])), i = Object.fromEntries(t.get(kr).map(([s, l]) => [s, xu(l)])), o = new Fb({
    nodes: r,
    marks: i
  });
  return t.set(Nt, o), t.done(Ie), () => {
    t.remove(Nt).remove(yr).remove(kr).remove(Fo).clearTimer(Ie);
  };
});
At(Cd, { displayName: "Schema" });
var Sd = class {
  constructor() {
    this.#t = new oh(), this.#e = null, this.setCtx = (t) => {
      this.#e = t;
    }, this.chain = () => {
      if (this.#e == null) throw uo();
      const t = this.#e, e = [], n = this.get.bind(this), r = {
        run: () => {
          const o = jn(...e), s = t.get(ot);
          return o(s.state, s.dispatch, s);
        },
        inline: (o) => (e.push(o), r),
        pipe: i.bind(this)
      };
      function i(o, s) {
        const l = n(o);
        return e.push(l(s)), r;
      }
      return r;
    };
  }
  #t;
  #e;
  get ctx() {
    return this.#e;
  }
  create(t, e) {
    const n = t.create(this.#t.sliceMap);
    return n.set(e), n;
  }
  get(t) {
    return this.#t.get(t).get();
  }
  remove(t) {
    return this.#t.remove(t);
  }
  call(t, e) {
    if (this.#e == null) throw uo();
    const n = this.get(t)(e), r = this.#e.get(ot);
    return n(r.state, r.dispatch, r);
  }
  inline(t) {
    if (this.#e == null) throw uo();
    const e = this.#e.get(ot);
    return t(e.state, e.dispatch, e);
  }
};
function Qx(t = "cmdKey") {
  return W((() => () => !1), t);
}
var Q = W(new Sd(), "commands"), _o = W([Ie], "commandsTimer"), br = ut("CommandsReady"), Nd = (t) => {
  const e = new Sd();
  return e.setCtx(t), t.inject(Q, e).inject(_o, [Ie]).record(br), async () => (await t.waitTimers(_o), t.done(br), () => {
    t.remove(Q).remove(_o).clearTimer(br);
  });
};
At(Nd, { displayName: "Commands" });
function Xx(t) {
  return t.Backspace = jn(F1, ml, b1, Nf), t;
}
var Md = class {
  constructor() {
    this.#t = null, this.#e = [], this.setCtx = (t) => {
      this.#t = t;
    }, this.add = (t) => (this.#e.push(t), () => {
      this.#e = this.#e.filter((e) => e !== t);
    }), this.addObjectKeymap = (t) => {
      const e = [];
      return Object.entries(t).forEach(([n, r]) => {
        if (typeof r == "function") {
          const i = {
            key: n,
            onRun: () => r
          };
          this.#e.push(i), e.push(() => {
            this.#e = this.#e.filter((o) => o !== i);
          });
        } else
          this.#e.push(r), e.push(() => {
            this.#e = this.#e.filter((i) => i !== r);
          });
      }), () => {
        e.forEach((n) => n());
      };
    }, this.addBaseKeymap = () => {
      const t = Xx(L1);
      return this.addObjectKeymap(t);
    }, this.build = () => {
      const t = {};
      return this.#e.forEach((e) => {
        t[e.key] = [...t[e.key] || [], e];
      }), Object.fromEntries(Object.entries(t).map(([e, n]) => {
        const r = n.sort((o, s) => (s.priority ?? 50) - (o.priority ?? 50));
        return [e, (o, s, l) => {
          const a = this.#t;
          if (a == null) throw qi();
          const c = r.map((u) => u.onRun(a));
          return jn(...c)(o, s, l);
        }];
      }));
    };
  }
  #t;
  #e;
  get ctx() {
    return this.#t;
  }
}, Bi = W(new Md(), "keymap"), $o = W([Ie], "keymapTimer"), xr = ut("KeymapReady"), Zx = (t) => {
  const e = new Md();
  return e.setCtx(t), t.inject(Bi, e).inject($o, [Ie]).record(xr), async () => (await t.waitTimers($o), t.done(xr), () => {
    t.remove(Bi).remove($o).clearTimer(xr);
  });
}, di = ut("ParserReady"), Td = (() => {
  throw qi();
}), wr = W(Td, "parser"), Vo = W([], "parserTimer"), Ad = (t) => (t.inject(wr, Td).inject(Vo, [Ie]).record(di), async () => {
  await t.waitTimers(Vo);
  const e = t.get(hn), n = t.get(Nt);
  return t.set(wr, c0.create(n, e)), t.done(di), () => {
    t.remove(wr).remove(Vo).clearTimer(di);
  };
});
At(Ad, { displayName: "Parser" });
var Cr = ut("SerializerReady"), Ho = W([], "serializerTimer"), Id = (() => {
  throw qi();
}), pi = W(Id, "serializer"), Ed = (t) => (t.inject(pi, Id).inject(Ho, [Ie]).record(Cr), async () => {
  await t.waitTimers(Ho);
  const e = t.get(hn), n = t.get(Nt);
  return t.set(pi, h0.create(n, e)), t.done(Cr), () => {
    t.remove(pi).remove(Ho).clearTimer(Cr);
  };
});
At(Ed, { displayName: "Serializer" });
var mi = W("", "defaultValue"), gi = W((t) => t, "stateOptions"), jo = W([], "editorStateTimer"), yi = ut("EditorStateReady");
function ew(t, e, n) {
  if (typeof t == "string") return e(t);
  if (t.type === "html") return Rn.fromSchema(n).parse(t.dom);
  if (t.type === "json") return He.fromJSON(n, t.value);
  throw Rm(t);
}
var tw = new ve("MILKDOWN_STATE_TRACKER"), Od = (t) => (t.inject(mi, "").inject(lr, {}).inject(gi, (e) => e).inject(jo, [
  di,
  Cr,
  br,
  xr
]).record(yi), async () => {
  await t.waitTimers(jo);
  const e = t.get(Nt), n = t.get(wr), r = t.get(vr), i = t.get(gi), o = t.get(Tt), s = ew(t.get(mi), n, e), l = t.get(Bi), a = l.addBaseKeymap(), c = [
    ...o,
    new Oe({
      key: tw,
      state: {
        init: () => {
        },
        apply: (d, f, p, m) => {
          t.set(lr, m);
        }
      }
    }),
    K1({ rules: r }),
    l0(l.build())
  ];
  t.set(Tt, c);
  const u = i({
    schema: e,
    doc: s,
    plugins: c
  }), h = rn.create(u);
  return t.set(lr, h), t.done(yi), () => {
    a(), t.remove(mi).remove(lr).remove(gi).remove(jo).clearTimer(yi);
  };
});
At(Od, { displayName: "EditorState" });
var Rr = W([], "pasteRule"), qo = W([Ie], "pasteRuleTimer"), ki = ut("PasteRuleReady"), vd = (t) => (t.inject(Rr, []).inject(qo, [Ie]).record(ki), async () => (await t.waitTimers(qo), t.done(ki), () => {
  t.remove(Rr).remove(qo).clearTimer(ki);
}));
At(vd, { displayName: "PasteRule" });
var bi = ut("EditorViewReady"), Wo = W([], "editorViewTimer"), xi = W({}, "editorViewOptions"), wi = W(null, "root"), _s = W(null, "rootDOM"), $s = W({}, "rootAttrs");
function nw(t, e) {
  const n = document.createElement("div");
  n.className = "milkdown", t.appendChild(n), e.set(_s, n);
  const r = e.get($s);
  return Object.entries(r).forEach(([i, o]) => n.setAttribute(i, o)), n;
}
function rw(t) {
  t.classList.add("editor"), t.setAttribute("role", "textbox");
}
var iw = new ve("MILKDOWN_VIEW_CLEAR"), Dd = (t) => (t.inject(wi, document.body).inject(ot, {}).inject(xi, {}).inject(_s, null).inject($s, {}).inject(Wo, [yi, ki]).record(bi), async () => {
  await t.wait(fn);
  const e = t.get(wi) || document.body, n = typeof e == "string" ? document.querySelector(e) : e;
  t.update(Tt, (a) => [new Oe({
    key: iw,
    view: (c) => {
      const u = n ? nw(n, t) : void 0;
      return (() => {
        if (u && n) {
          const d = c.dom;
          n.replaceChild(u, d), u.appendChild(d);
        }
      })(), { destroy: () => {
        u?.parentNode && u?.parentNode.replaceChild(c.dom, u), u?.remove();
      } };
    }
  }), ...a]), await t.waitTimers(Wo);
  const r = t.get(lr), i = t.get(xi), o = Object.fromEntries(t.get(Bs)), s = Object.fromEntries(t.get(Fs)), l = new xd(n, {
    state: r,
    nodeViews: o,
    markViews: s,
    transformPasted: (a, c, u) => (t.get(Rr).sort((h, d) => (d.priority ?? 50) - (h.priority ?? 50)).map((h) => h.run).forEach((h) => {
      a = h(a, c, u);
    }), a),
    ...i
  });
  return rw(l.dom), t.set(ot, l), t.done(bi), () => {
    l?.destroy(), t.remove(wi).remove(ot).remove(xi).remove(_s).remove($s).remove(Wo).clearTimer(bi);
  };
});
At(Dd, { displayName: "EditorView" });
var ow = class Rd {
  constructor() {
    this.#t = !1, this.#e = "Idle", this.#r = [], this.#n = () => {
    }, this.#o = new oh(), this.#s = new Wm(), this.#i = /* @__PURE__ */ new Map(), this.#l = /* @__PURE__ */ new Map(), this.#a = new qm(this.#o, this.#s), this.#f = () => {
      const e = Gx(async (r) => {
        await Promise.all(this.#r.map((i) => Promise.resolve(i(r))));
      }), n = [
        Cd,
        Ad,
        Ed,
        Nd,
        Zx,
        vd,
        Od,
        Dd,
        Yx(this),
        e
      ];
      this.#c(n, this.#l);
    }, this.#c = (e, n) => {
      e.forEach((r) => {
        const i = this.#a.produce(this.#t ? r.meta : void 0), o = r(i);
        n.set(r, {
          ctx: i,
          handler: o,
          cleanup: void 0
        });
      });
    }, this.#u = (e, n = !1) => Promise.all([e].flat().map(async (r) => {
      const i = this.#i.get(r)?.cleanup;
      return n ? this.#i.delete(r) : this.#i.set(r, {
        ctx: void 0,
        handler: void 0,
        cleanup: void 0
      }), typeof i == "function" ? i() : i;
    })), this.#d = async () => {
      await Promise.all([...this.#l.entries()].map(async ([e, { cleanup: n }]) => typeof n == "function" ? n() : n)), this.#l.clear();
    }, this.#h = (e) => {
      this.#e = e, this.#n(e);
    }, this.#p = (e) => [...e.entries()].map(async ([n, r]) => {
      const { ctx: i, handler: o } = r;
      if (!o) return;
      const s = await o();
      e.set(n, {
        ctx: i,
        handler: o,
        cleanup: s
      });
    }), this.enableInspector = (e = !0) => (this.#t = e, this), this.onStatusChange = (e) => (this.#n = e, this), this.config = (e) => (this.#r.push(e), this), this.removeConfig = (e) => (this.#r = this.#r.filter((n) => n !== e), this), this.use = (e) => {
      const n = [e].flat();
      return n.flat().forEach((r) => {
        this.#i.set(r, {
          ctx: void 0,
          handler: void 0,
          cleanup: void 0
        });
      }), this.#e === "Created" && this.#c(n, this.#i), this;
    }, this.remove = async (e) => this.#e === "OnCreate" ? (console.warn("[Milkdown]: You are trying to remove plugins when the editor is creating, this is not recommended, please check your code."), new Promise((n) => {
      setTimeout(() => {
        n(this.remove(e));
      }, 50);
    })) : (await this.#u([e].flat(), !0), this), this.create = async () => this.#e === "OnCreate" ? this : (this.#e === "Created" && await this.destroy(), this.#h("OnCreate"), this.#f(), this.#c([...this.#i.keys()], this.#i), await Promise.all([this.#p(this.#l), this.#p(this.#i)].flat()), this.#h("Created"), this), this.destroy = async (e = !1) => this.#e === "Destroyed" || this.#e === "OnDestroy" ? this : this.#e === "OnCreate" ? new Promise((n) => {
      setTimeout(() => {
        n(this.destroy(e));
      }, 50);
    }) : (e && (this.#r = []), this.#h("OnDestroy"), await this.#u([...this.#i.keys()], e), await this.#d(), this.#h("Destroyed"), this), this.action = (e) => e(this.#a), this.inspect = () => this.#t ? [...this.#l.values(), ...this.#i.values()].map(({ ctx: e }) => e?.inspector?.read()).filter((e) => !!e) : (console.warn("[Milkdown]: You are trying to collect inspection when inspector is disabled, please enable inspector by `editor.enableInspector()` first."), []);
  }
  static make() {
    return new Rd();
  }
  #t;
  #e;
  #r;
  #n;
  #o;
  #s;
  #i;
  #l;
  #a;
  #f;
  #c;
  #u;
  #d;
  #h;
  #p;
  get ctx() {
    return this.#a;
  }
  get status() {
    return this.#e;
  }
};
function zd(t, e, n) {
  const r = t.findIndex(([o]) => o === e);
  if (r === -1) return [...t, n];
  const i = t.slice();
  return i[r] = n, i;
}
function H(t, e) {
  const n = Qx(t), r = (i) => async () => {
    r.key = n, await i.wait(br);
    const o = e(i);
    return i.get(Q).create(n, o), r.run = (s) => i.get(Q).call(t, s), () => {
      i.get(Q).remove(n);
    };
  };
  return r;
}
function De(t) {
  const e = (n) => async () => {
    await n.wait(Ie);
    const r = t(n);
    return n.update(vr, (i) => [...i, r]), e.inputRule = r, () => {
      n.update(vr, (i) => i.filter((o) => o !== r));
    };
  };
  return e;
}
function sw(t) {
  const e = (n) => async () => {
    await n.wait(Ie);
    const r = t(n);
    return n.update(Rr, (i) => [...i, r]), e.pasteRule = r, () => {
      n.update(Rr, (i) => i.filter((o) => o !== r));
    };
  };
  return e;
}
function lw(t, e) {
  const n = (r) => async () => {
    const i = e(r);
    return r.update(kr, (o) => zd(o, t, [t, i])), n.id = t, n.schema = i, () => {
      r.update(kr, (o) => o.filter(([s]) => s !== t));
    };
  };
  return n.type = (r) => {
    const i = r.get(Nt).marks[t];
    if (!i) throw $m(t);
    return i;
  }, n;
}
function Ol(t, e) {
  const n = (r) => async () => {
    const i = e(r);
    return r.update(yr, (o) => zd(o, t, [t, i])), n.id = t, n.schema = i, () => {
      r.update(yr, (o) => o.filter(([s]) => s !== t));
    };
  };
  return n.type = (r) => {
    const i = r.get(Nt).nodes[t];
    if (!i) throw _m(t);
    return i;
  }, n;
}
function It(t) {
  let e;
  const n = (r) => async () => (await r.wait(Ie), e = t(r), r.update(Tt, (i) => [...i, e]), () => {
    r.update(Tt, (i) => i.filter((o) => o !== e));
  });
  return n.plugin = () => e, n.key = () => e.spec.key, n;
}
function aw(t) {
  const e = (n) => async () => {
    await n.wait(xr);
    const r = n.get(Bi), i = t(n), o = r.addObjectKeymap(i);
    return e.keymap = i, () => {
      o();
    };
  };
  return e;
}
function Et(t, e) {
  const n = W(t, e), r = (i) => (i.inject(n), () => () => {
    i.remove(n);
  });
  return r.key = n, r;
}
function le(t, e) {
  const n = Et(e, t), r = Ol(t, (o) => o.get(n.key)(o)), i = [n, r];
  return i.id = r.id, i.node = r, i.type = (o) => r.type(o), i.ctx = n, i.key = n.key, i.extendSchema = (o) => le(t, o(e)), i;
}
function qn(t, e) {
  const n = Et(e, t), r = lw(t, (o) => o.get(n.key)(o)), i = [n, r];
  return i.id = r.id, i.mark = r, i.type = (o) => r.type(o), i.ctx = n, i.key = n.key, i.extendSchema = (o) => qn(t, o(e)), i;
}
function _e(t, e) {
  const n = Et(Object.fromEntries(Object.entries(e).map(([o, { shortcuts: s, priority: l }]) => [o, {
    shortcuts: s,
    priority: l
  }])), `${t}Keymap`), r = aw((o) => {
    const s = o.get(n.key), l = Object.entries(e).flatMap(([a, { command: c }]) => {
      const u = s[a], h = [u.shortcuts].flat(), d = u.priority;
      return h.map((f) => [f, {
        key: f,
        onRun: c,
        priority: d
      }]);
    });
    return Object.fromEntries(l);
  }), i = [n, r];
  return i.ctx = n, i.shortcuts = r, i.key = n.key, i.keymap = r.keymap, i;
}
var tt = (t, e = () => ({})) => Et(e, `${t}Attr`), Vr = (t, e = () => ({})) => Et(e, `${t}Attr`);
function Yt(t, e, n) {
  const r = Et({}, t), i = (s) => async () => {
    await s.wait(fn);
    const l = {
      plugin: e(s),
      options: s.get(r.key)
    };
    return s.update(Dr, (a) => [...a, l]), () => {
      s.update(Dr, (a) => a.filter((c) => c !== l));
    };
  }, o = [r, i];
  return o.id = t, o.plugin = i, o.options = r, o;
}
function cw(t, e = !1) {
  return (n) => {
    const r = n.get(ot), i = n.get(wr)(t);
    if (!i) return;
    if (!e) {
      const { state: a } = r;
      return r.dispatch(a.tr.replace(0, a.doc.content.size, new E(i.content, 0, 0)));
    }
    const o = n.get(Nt), s = n.get(gi)({
      schema: o,
      doc: i,
      plugins: n.get(Tt)
    }), l = rn.create(s);
    r.updateState(l);
  };
}
function uw(t, e) {
  return function(n, r) {
    let { $from: i, $to: o, node: s } = n.selection;
    if (s && s.isBlock || i.depth < 2 || !i.sameParent(o))
      return !1;
    let l = i.node(-1);
    if (l.type != t)
      return !1;
    if (i.parent.content.size == 0 && i.node(-1).childCount == i.indexAfter(-1)) {
      if (i.depth == 3 || i.node(-3).type != t || i.index(-2) != i.node(-2).childCount - 1)
        return !1;
      if (r) {
        let h = T.empty, d = i.index(-1) ? 1 : i.index(-2) ? 2 : 3;
        for (let g = i.depth - d; g >= i.depth - 3; g--)
          h = T.from(i.node(g).copy(h));
        let f = i.indexAfter(-1) < i.node(-2).childCount ? 1 : i.indexAfter(-2) < i.node(-3).childCount ? 2 : 3;
        h = h.append(T.from(t.createAndFill()));
        let p = i.before(i.depth - (d - 1)), m = n.tr.replace(p, i.after(-f), new E(h, 4 - d, 0)), y = -1;
        m.doc.nodesBetween(p, m.doc.content.size, (g, N) => {
          if (y > -1)
            return !1;
          g.isTextblock && g.content.size == 0 && (y = N + 1);
        }), y > -1 && m.setSelection($.near(m.doc.resolve(y))), r(m.scrollIntoView());
      }
      return !0;
    }
    let a = o.pos == i.end() ? l.contentMatchAt(0).defaultType : null, c = n.tr.delete(i.pos, o.pos), u = a ? [null, { type: a }] : void 0;
    return dr(c.doc, i.pos, 2, u) ? (r && r(c.split(i.pos, 2, u).scrollIntoView()), !0) : !1;
  };
}
function hw(t) {
  return function(e, n) {
    let { $from: r, $to: i } = e.selection, o = r.blockRange(i, (s) => s.childCount > 0 && s.firstChild.type == t);
    return o ? n ? r.node(o.depth - 1).type == t ? fw(e, n, t, o) : dw(e, n, o) : !0 : !1;
  };
}
function fw(t, e, n, r) {
  let i = t.tr, o = r.end, s = r.$to.end(r.depth);
  o < s && (i.step(new be(o - 1, s, o, s, new E(T.from(n.create(null, r.parent.copy())), 1, 0), 1, !0)), r = new Yh(i.doc.resolve(r.$from.pos), i.doc.resolve(s), r.depth));
  const l = Yi(r);
  if (l == null)
    return !1;
  i.lift(r, l);
  let a = i.doc.resolve(i.mapping.map(o, -1) - 1);
  return Qi(i.doc, a.pos) && a.nodeBefore.type == a.nodeAfter.type && i.join(a.pos), e(i.scrollIntoView()), !0;
}
function dw(t, e, n) {
  let r = t.tr, i = n.parent;
  for (let f = n.end, p = n.endIndex - 1, m = n.startIndex; p > m; p--)
    f -= i.child(p).nodeSize, r.delete(f - 1, f + 1);
  let o = r.doc.resolve(n.start), s = o.nodeAfter;
  if (r.mapping.map(n.end) != n.start + o.nodeAfter.nodeSize)
    return !1;
  let l = n.startIndex == 0, a = n.endIndex == i.childCount, c = o.node(-1), u = o.index(-1);
  if (!c.canReplace(u + (l ? 0 : 1), u + 1, s.content.append(a ? T.empty : T.from(i))))
    return !1;
  let h = o.pos, d = h + s.nodeSize;
  return r.step(new be(h - (l ? 1 : 0), d + (a ? 1 : 0), h + 1, d - 1, new E((l ? T.empty : T.from(i.copy(T.empty))).append(a ? T.empty : T.from(i.copy(T.empty))), l ? 0 : 1, a ? 0 : 1), l ? 0 : 1)), e(r.scrollIntoView()), !0;
}
function pw(t) {
  return function(e, n) {
    let { $from: r, $to: i } = e.selection, o = r.blockRange(i, (c) => c.childCount > 0 && c.firstChild.type == t);
    if (!o)
      return !1;
    let s = o.startIndex;
    if (s == 0)
      return !1;
    let l = o.parent, a = l.child(s - 1);
    if (a.type != t)
      return !1;
    if (n) {
      let c = a.lastChild && a.lastChild.type == l.type, u = T.from(c ? t.create() : null), h = new E(T.from(t.create(null, T.from(l.type.create(null, u)))), c ? 3 : 1, 0), d = o.start, f = o.end;
      n(e.tr.step(new be(d - (c ? 3 : 1), f, d, f, h, 1, !0)).scrollIntoView());
    }
    return !0;
  };
}
function mw(t) {
  const e = /* @__PURE__ */ new Map();
  if (!t || !t.type)
    throw new Error("mdast-util-definitions expected node");
  return Vn(t, "definition", function(r) {
    const i = wu(r.identifier);
    i && !e.get(i) && e.set(i, r);
  }), n;
  function n(r) {
    const i = wu(r);
    return e.get(i);
  }
}
function wu(t) {
  return String(t || "").toUpperCase();
}
function gw() {
  return function(t) {
    const e = mw(t);
    Vn(t, function(n, r, i) {
      if (n.type === "definition" && i !== void 0 && typeof r == "number")
        return i.children.splice(r, 1), [Ti, r];
      if (n.type === "imageReference" || n.type === "linkReference") {
        const o = e(n.identifier);
        if (o && i && typeof r == "number")
          return i.children[r] = n.type === "imageReference" ? { type: "image", url: o.url, title: o.title, alt: n.alt } : {
            type: "link",
            url: o.url,
            title: o.title,
            children: n.children
          }, [Ti, r];
      }
    });
  };
}
function yw(t) {
  const e = { ...t };
  return e.position && (e.position = {
    start: { ...e.position.start },
    end: { ...e.position.end }
  }), delete e.children, e;
}
var kw = "<br />", bw = /^<br\s*\/?\s*>$/i, xw = (t) => typeof t == "string" && bw.test(t.trim());
function Pd(t, e) {
  if (!(e.childCount >= 1 && e.lastChild?.type.name === "hardbreak")) {
    t.next(e.content);
    return;
  }
  const n = [];
  e.content.forEach((r, i, o) => {
    o !== e.childCount - 1 && n.push(r);
  }), t.next(T.fromArray(n));
}
function S(t, e) {
  return Object.assign(t, { meta: {
    package: "@milkdown/preset-commonmark",
    ...e
  } }), t;
}
var vl = Vr("emphasis");
S(vl, {
  displayName: "Attr<emphasis>",
  group: "Emphasis"
});
var Wn = qn("emphasis", (t) => ({
  attrs: { marker: {
    default: t.get(gr).emphasis || "*",
    validate: "string"
  } },
  parseDOM: [
    { tag: "i" },
    { tag: "em" },
    {
      style: "font-style",
      getAttrs: (e) => e === "italic"
    }
  ],
  toDOM: (e) => ["em", t.get(vl.key)(e)],
  parseMarkdown: {
    match: (e) => e.type === "emphasis",
    runner: (e, n, r) => {
      e.openMark(r, { marker: n.marker }), e.next(n.children), e.closeMark(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "emphasis",
    runner: (e, n) => {
      e.withMark(n, "emphasis", void 0, { marker: n.attrs.marker });
    }
  }
}));
S(Wn.mark, {
  displayName: "MarkSchema<emphasis>",
  group: "Emphasis"
});
S(Wn.ctx, {
  displayName: "MarkSchemaCtx<emphasis>",
  group: "Emphasis"
});
var Dl = H("ToggleEmphasis", (t) => () => eo(Wn.type(t)));
S(Dl, {
  displayName: "Command<toggleEmphasisCommand>",
  group: "Emphasis"
});
var Ld = De((t) => Lr(/(?:^|[^*])\*([^*]+)\*$/, Wn.type(t), {
  getAttr: () => ({ marker: "*" }),
  updateCaptured: ({ fullMatch: e, start: n }) => e.startsWith("*") ? {} : {
    fullMatch: e.slice(1),
    start: n + 1
  }
}));
S(Ld, {
  displayName: "InputRule<emphasis>|Star",
  group: "Emphasis"
});
var Bd = De((t) => Lr(/\b_(?![_\s])(.*?[^_\s])_$/, Wn.type(t), {
  getAttr: () => ({ marker: "_" }),
  updateCaptured: ({ fullMatch: e, start: n }) => e.startsWith("_") ? {} : {
    fullMatch: e.slice(1),
    start: n + 1
  }
}));
S(Bd, {
  displayName: "InputRule<emphasis>|Underscore",
  group: "Emphasis"
});
var Rl = _e("emphasisKeymap", { ToggleEmphasis: {
  shortcuts: "Mod-i",
  command: (t) => {
    const e = t.get(Q);
    return () => e.call(Dl.key);
  }
} });
S(Rl.ctx, {
  displayName: "KeymapCtx<emphasis>",
  group: "Emphasis"
});
S(Rl.shortcuts, {
  displayName: "Keymap<emphasis>",
  group: "Emphasis"
});
var zl = Vr("strong");
S(zl, {
  displayName: "Attr<strong>",
  group: "Strong"
});
var Hr = qn("strong", (t) => ({
  attrs: { marker: {
    default: t.get(gr).strong || "*",
    validate: "string"
  } },
  parseDOM: [
    {
      tag: "b",
      getAttrs: (e) => e.style.fontWeight != "normal" && null
    },
    { tag: "strong" },
    {
      style: "font-style",
      getAttrs: (e) => e === "bold"
    },
    {
      style: "font-weight=400",
      clearMark: (e) => e.type.name == "strong"
    },
    {
      style: "font-weight",
      getAttrs: (e) => /^(bold(er)?|[5-9]\d{2,})$/.test(e) && null
    }
  ],
  toDOM: (e) => ["strong", t.get(zl.key)(e)],
  parseMarkdown: {
    match: (e) => e.type === "strong",
    runner: (e, n, r) => {
      e.openMark(r, { marker: n.marker }), e.next(n.children), e.closeMark(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "strong",
    runner: (e, n) => {
      e.withMark(n, "strong", void 0, { marker: n.attrs.marker });
    }
  }
}));
S(Hr.mark, {
  displayName: "MarkSchema<strong>",
  group: "Strong"
});
S(Hr.ctx, {
  displayName: "MarkSchemaCtx<strong>",
  group: "Strong"
});
var Pl = H("ToggleStrong", (t) => () => eo(Hr.type(t)));
S(Pl, {
  displayName: "Command<toggleStrongCommand>",
  group: "Strong"
});
var Fd = De((t) => Lr(/(?<![\w:/])(?:\*\*|__)([^*_]+?)(?:\*\*|__)(?![\w/])$/, Hr.type(t), { getAttr: (e) => ({ marker: e[0].startsWith("*") ? "*" : "_" }) }));
S(Fd, {
  displayName: "InputRule<strong>",
  group: "Strong"
});
var Ll = _e("strongKeymap", { ToggleBold: {
  shortcuts: ["Mod-b"],
  command: (t) => {
    const e = t.get(Q);
    return () => e.call(Pl.key);
  }
} });
S(Ll.ctx, {
  displayName: "KeymapCtx<strong>",
  group: "Strong"
});
S(Ll.shortcuts, {
  displayName: "Keymap<strong>",
  group: "Strong"
});
var Bl = Vr("inlineCode");
S(Bl, {
  displayName: "Attr<inlineCode>",
  group: "InlineCode"
});
var $t = qn("inlineCode", (t) => ({
  priority: 100,
  code: !0,
  inclusive: !1,
  parseDOM: [{ tag: "code" }],
  toDOM: (e) => ["code", t.get(Bl.key)(e)],
  parseMarkdown: {
    match: (e) => e.type === "inlineCode",
    runner: (e, n, r) => {
      e.openMark(r), e.addText(n.value), e.closeMark(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "inlineCode",
    runner: (e, n, r) => (e.withMark(n, "inlineCode", r.text || ""), !0)
  }
}));
S($t.mark, {
  displayName: "MarkSchema<inlineCode>",
  group: "InlineCode"
});
S($t.ctx, {
  displayName: "MarkSchemaCtx<inlineCode>",
  group: "InlineCode"
});
var Fl = H("ToggleInlineCode", (t) => () => (e, n) => {
  const { selection: r, tr: i } = e;
  if (r.empty) return !1;
  const { from: o, to: s } = r;
  return e.doc.rangeHasMark(o, s, $t.type(t)) ? (n?.(i.removeMark(o, s, $t.type(t))), !0) : (Object.keys(e.schema.marks).filter((l) => l !== $t.type.name).map((l) => e.schema.marks[l]).forEach((l) => {
    i.removeMark(o, s, l);
  }), n?.(i.addMark(o, s, $t.type(t).create())), !0);
});
S(Fl, {
  displayName: "Command<toggleInlineCodeCommand>",
  group: "InlineCode"
});
var _d = De((t) => Lr(/(?:`)([^`]+)(?:`)$/, $t.type(t)));
S(_d, {
  displayName: "InputRule<inlineCodeInputRule>",
  group: "InlineCode"
});
var _l = _e("inlineCodeKeymap", { ToggleInlineCode: {
  shortcuts: "Mod-e",
  command: (t) => {
    const e = t.get(Q);
    return () => e.call(Fl.key);
  }
} });
S(_l.ctx, {
  displayName: "KeymapCtx<inlineCode>",
  group: "InlineCode"
});
S(_l.shortcuts, {
  displayName: "Keymap<inlineCode>",
  group: "InlineCode"
});
var ww = /* @__PURE__ */ new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
  "ftp:"
]);
function Cw(t) {
  return t <= 32 || t >= 127 && t <= 160 || t >= 8203 && t <= 8205 || t === 8232 || t === 8233 || t === 65279;
}
function Sw(t) {
  let e = "";
  for (const n of t) Cw(n.codePointAt(0) ?? 0) || (e += n);
  return e;
}
function Nw(t) {
  if (typeof t != "string") return "";
  const e = t.trim();
  if (!e) return "";
  const n = Sw(e), r = /^([a-z][a-z0-9+.-]*):/i.exec(n)?.[1];
  return !r || ww.has(`${r.toLowerCase()}:`) ? e : "";
}
var $l = Vr("link");
S($l, {
  displayName: "Attr<link>",
  group: "Link"
});
var Dn = qn("link", (t) => ({
  attrs: {
    href: { validate: "string" },
    title: {
      default: null,
      validate: "string|null"
    }
  },
  parseDOM: [{
    tag: "a[href]",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw ct(e);
      return {
        href: e.getAttribute("href"),
        title: e.getAttribute("title")
      };
    }
  }],
  toDOM: (e) => ["a", {
    ...t.get($l.key)(e),
    ...e.attrs,
    href: Nw(e.attrs.href)
  }],
  parseMarkdown: {
    match: (e) => e.type === "link",
    runner: (e, n, r) => {
      const i = n.url, o = n.title;
      e.openMark(r, {
        href: i,
        title: o
      }), e.next(n.children), e.closeMark(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "link",
    runner: (e, n) => {
      e.withMark(n, "link", void 0, {
        title: n.attrs.title,
        url: n.attrs.href
      });
    }
  }
}));
S(Dn.mark, {
  displayName: "MarkSchema<link>",
  group: "Link"
});
var $d = H("ToggleLink", (t) => (e = {}) => eo(Dn.type(t), e));
S($d, {
  displayName: "Command<toggleLinkCommand>",
  group: "Link"
});
var Vd = H("UpdateLink", (t) => (e = {}) => (n, r) => {
  if (!r) return !1;
  let i, o = -1;
  const { selection: s } = n, { from: l, to: a } = s;
  if (n.doc.nodesBetween(l, l === a ? a + 1 : a, (p, m) => {
    if (Dn.type(t).isInSet(p.marks))
      return i = p, o = m, !1;
  }), !i) return !1;
  const c = i.marks.find(({ type: p }) => p === Dn.type(t));
  if (!c) return !1;
  const u = o, h = o + i.nodeSize, { tr: d } = n, f = Dn.type(t).create({
    ...c.attrs,
    ...e
  });
  return f ? (r(d.removeMark(u, h, c).addMark(u, h, f).setSelection(new V(d.selection.$anchor)).scrollIntoView()), !0) : !1;
});
S(Vd, {
  displayName: "Command<updateLinkCommand>",
  group: "Link"
});
var Hd = Ol("doc", () => ({
  content: "block+",
  parseMarkdown: {
    match: ({ type: t }) => t === "root",
    runner: (t, e, n) => {
      t.injectRoot(e, n);
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "doc",
    runner: (t, e) => {
      t.openNode("root");
      const n = e.childCount > 0 ? e.child(e.childCount - 1) : null, r = n?.type.name === "paragraph" && n.content.size === 0 ? e.content.cut(0, e.content.size - n.nodeSize) : e.content;
      t.next(r);
    }
  }
}));
S(Hd, {
  displayName: "NodeSchema<doc>",
  group: "Doc"
});
var jd = Object.freeze([
  "root",
  "blockquote",
  "listItem",
  "footnoteDefinition"
]), Mw = /* @__PURE__ */ new Set([
  "paragraph",
  "heading",
  "tableCell",
  "link",
  "linkReference",
  "emphasis",
  "strong",
  "delete",
  "footnote"
]), Fi = Et(jd, "blockContainerTypes");
S(Fi, {
  displayName: "Ctx<blockContainerTypes>",
  group: "Remark"
});
var Cu = /* @__PURE__ */ new Set();
function qd(t) {
  const e = t.isInjected(Fi.key) ? t.get(Fi.key) : jd, n = /* @__PURE__ */ new Set();
  for (const r of e) {
    if (Mw.has(r)) {
      Cu.has(r) || (Cu.add(r), console.warn(`[milkdown/preset-commonmark] "${r}" holds phrasing content and cannot be a block container; it is ignored in blockContainerTypes.`));
      continue;
    }
    n.add(r);
  }
  return n;
}
var Tw = /* @__PURE__ */ new Set(["paragraph", "tableCell"]);
function Aw(t, e) {
  return ol(t, (n) => n.type === "html" && xw(n.value), (n, r) => {
    const i = r[r.length - 1];
    if (i) {
      if (Tw.has(i.type)) {
        i.children.length === 1 && (i.children = []);
        return;
      }
      if (e.has(i.type)) {
        const o = n;
        return o.children = [], delete o.value, o.type = "paragraph", Ti;
      }
    }
  });
}
var io = Yt("remark-preserve-empty-line", (t) => () => (e) => Aw(e, qd(t)));
S(io.plugin, {
  displayName: "Remark<remarkPreserveEmptyLine>",
  group: "Remark"
});
S(io.options, {
  displayName: "RemarkConfig<remarkPreserveEmptyLine>",
  group: "Remark"
});
var Vl = tt("paragraph");
S(Vl, {
  displayName: "Attr<paragraph>",
  group: "Paragraph"
});
var at = le("paragraph", (t) => ({
  content: "inline*",
  group: "block",
  parseDOM: [{ tag: "p" }],
  toDOM: (e) => [
    "p",
    t.get(Vl.key)(e),
    0
  ],
  parseMarkdown: {
    match: (e) => e.type === "paragraph",
    runner: (e, n, r) => {
      e.openNode(r), n.children ? e.next(n.children) : e.addText(n.value || ""), e.closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "paragraph",
    runner: (e, n) => {
      e.openNode("paragraph"), (!n.content || n.content.size === 0) && Iw(t) ? e.addNode("html", void 0, kw) : Pd(e, n), e.closeNode();
    }
  }
}));
function Iw(t) {
  return t.isInjected(io.options.key);
}
S(at.node, {
  displayName: "NodeSchema<paragraph>",
  group: "Paragraph"
});
S(at.ctx, {
  displayName: "NodeSchemaCtx<paragraph>",
  group: "Paragraph"
});
var Hl = H("TurnIntoText", (t) => () => Ar(at.type(t)));
S(Hl, {
  displayName: "Command<turnIntoTextCommand>",
  group: "Paragraph"
});
var jl = _e("paragraphKeymap", { TurnIntoText: {
  shortcuts: "Mod-Alt-0",
  command: (t) => {
    const e = t.get(Q);
    return () => e.call(Hl.key);
  }
} });
S(jl.ctx, {
  displayName: "KeymapCtx<paragraph>",
  group: "Paragraph"
});
S(jl.shortcuts, {
  displayName: "Keymap<paragraph>",
  group: "Paragraph"
});
var Ew = Array(6).fill(0).map((t, e) => e + 1);
function Ow(t) {
  return t.textContent.toLowerCase().trim().replace(/\s+/g, "-");
}
var oo = Et(Ow, "headingIdGenerator");
S(oo, {
  displayName: "Ctx<HeadingIdGenerator>",
  group: "Heading"
});
var ql = tt("heading");
S(ql, {
  displayName: "Attr<heading>",
  group: "Heading"
});
var xn = le("heading", (t) => {
  const e = t.get(oo.key);
  return {
    content: "inline*",
    group: "block",
    defining: !0,
    attrs: {
      id: {
        default: "",
        validate: "string"
      },
      level: {
        default: 1,
        validate: "number"
      }
    },
    parseDOM: Ew.map((n) => ({
      tag: `h${n}`,
      getAttrs: (r) => {
        if (!(r instanceof HTMLElement)) throw ct(r);
        return {
          level: n,
          id: r.id
        };
      }
    })),
    toDOM: (n) => [
      `h${n.attrs.level}`,
      {
        ...t.get(ql.key)(n),
        id: n.attrs.id || e(n)
      },
      0
    ],
    parseMarkdown: {
      match: ({ type: n }) => n === "heading",
      runner: (n, r, i) => {
        const o = r.depth;
        n.openNode(i, { level: o }), n.next(r.children), n.closeNode();
      }
    },
    toMarkdown: {
      match: (n) => n.type.name === "heading",
      runner: (n, r) => {
        n.openNode("heading", void 0, { depth: r.attrs.level }), Pd(n, r), n.closeNode();
      }
    }
  };
});
S(xn.node, {
  displayName: "NodeSchema<heading>",
  group: "Heading"
});
S(xn.ctx, {
  displayName: "NodeSchemaCtx<heading>",
  group: "Heading"
});
var Wd = De((t) => Ef(/^(?<hashes>#+)\s$/, xn.type(t), (e) => {
  const n = e.groups?.hashes?.length || 0, { $from: r } = t.get(ot).state.selection, i = r.node();
  if (i.type.name === "heading") {
    let o = Number(i.attrs.level) + Number(n);
    return o > 6 && (o = 6), { level: o };
  }
  return { level: n };
}));
S(Wd, {
  displayName: "InputRule<wrapInHeadingInputRule>",
  group: "Heading"
});
var Lt = H("WrapInHeading", (t) => (e) => (e ??= 1, e < 1 ? Ar(at.type(t)) : Ar(xn.type(t), { level: e })));
S(Lt, {
  displayName: "Command<wrapInHeadingCommand>",
  group: "Heading"
});
var Wl = H("DowngradeHeading", (t) => () => (e, n, r) => {
  const { $from: i } = e.selection, o = i.node();
  if (o.type !== xn.type(t) || !e.selection.empty || i.parentOffset !== 0) return !1;
  const s = o.attrs.level - 1;
  return s ? (n?.(e.tr.setNodeMarkup(e.selection.$from.before(), void 0, {
    ...o.attrs,
    level: s
  })), !0) : Ar(at.type(t))(e, n, r);
});
S(Wl, {
  displayName: "Command<downgradeHeadingCommand>",
  group: "Heading"
});
var Kl = _e("headingKeymap", {
  TurnIntoH1: {
    shortcuts: "Mod-Alt-1",
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(Lt.key, 1);
    }
  },
  TurnIntoH2: {
    shortcuts: "Mod-Alt-2",
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(Lt.key, 2);
    }
  },
  TurnIntoH3: {
    shortcuts: "Mod-Alt-3",
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(Lt.key, 3);
    }
  },
  TurnIntoH4: {
    shortcuts: "Mod-Alt-4",
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(Lt.key, 4);
    }
  },
  TurnIntoH5: {
    shortcuts: "Mod-Alt-5",
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(Lt.key, 5);
    }
  },
  TurnIntoH6: {
    shortcuts: "Mod-Alt-6",
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(Lt.key, 6);
    }
  },
  DowngradeHeading: {
    shortcuts: ["Delete", "Backspace"],
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(Wl.key);
    }
  }
});
S(Kl.ctx, {
  displayName: "KeymapCtx<heading>",
  group: "Heading"
});
S(Kl.shortcuts, {
  displayName: "Keymap<heading>",
  group: "Heading"
});
var Ul = tt("blockquote");
S(Ul, {
  displayName: "Attr<blockquote>",
  group: "Blockquote"
});
var jr = le("blockquote", (t) => ({
  content: "block+",
  group: "block",
  defining: !0,
  parseDOM: [{ tag: "blockquote" }],
  toDOM: (e) => [
    "blockquote",
    t.get(Ul.key)(e),
    0
  ],
  parseMarkdown: {
    match: ({ type: e }) => e === "blockquote",
    runner: (e, n, r) => {
      e.openNode(r).next(n.children).closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "blockquote",
    runner: (e, n) => {
      e.openNode("blockquote").next(n.content).closeNode();
    }
  }
}));
S(jr.node, {
  displayName: "NodeSchema<blockquote>",
  group: "Blockquote"
});
S(jr.ctx, {
  displayName: "NodeSchemaCtx<blockquote>",
  group: "Blockquote"
});
var Kd = De((t) => bl(/^\s*>\s$/, jr.type(t)));
S(Kd, {
  displayName: "InputRule<wrapInBlockquoteInputRule>",
  group: "Blockquote"
});
var Jl = H("WrapInBlockquote", (t) => () => kl(jr.type(t)));
S(Jl, {
  displayName: "Command<wrapInBlockquoteCommand>",
  group: "Blockquote"
});
var Gl = _e("blockquoteKeymap", { WrapInBlockquote: {
  shortcuts: "Mod-Shift-b",
  command: (t) => {
    const e = t.get(Q);
    return () => e.call(Jl.key);
  }
} });
S(Gl.ctx, {
  displayName: "KeymapCtx<blockquote>",
  group: "Blockquote"
});
S(Gl.shortcuts, {
  displayName: "Keymap<blockquote>",
  group: "Blockquote"
});
var Yl = tt("codeBlock", () => ({
  pre: {},
  code: {}
}));
S(Yl, {
  displayName: "Attr<codeBlock>",
  group: "CodeBlock"
});
var qr = le("code_block", (t) => ({
  content: "text*",
  group: "block",
  marks: "",
  defining: !0,
  code: !0,
  attrs: { language: {
    default: "",
    validate: "string"
  } },
  parseDOM: [{
    tag: "pre",
    preserveWhitespace: "full",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw ct(e);
      return { language: e.dataset.language };
    }
  }],
  toDOM: (e) => {
    const n = t.get(Yl.key)(e), r = e.attrs.language, i = r && r.length > 0 ? { "data-language": r } : void 0;
    return [
      "pre",
      {
        ...n.pre,
        ...i
      },
      [
        "code",
        n.code,
        0
      ]
    ];
  },
  parseMarkdown: {
    match: ({ type: e }) => e === "code",
    runner: (e, n, r) => {
      const i = n.lang ?? "", o = n.value;
      e.openNode(r, { language: i }), o && e.addText(o), e.closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "code_block",
    runner: (e, n) => {
      e.addNode("code", void 0, n.content.firstChild?.text || "", { lang: n.attrs.language });
    }
  }
}));
S(qr.node, {
  displayName: "NodeSchema<codeBlock>",
  group: "CodeBlock"
});
S(qr.ctx, {
  displayName: "NodeSchemaCtx<codeBlock>",
  group: "CodeBlock"
});
var Ud = De((t) => Ef(/^```(?<language>[a-z]*)?[\s\n]$/, qr.type(t), (e) => ({ language: e.groups?.language ?? "" })));
S(Ud, {
  displayName: "InputRule<createCodeBlockInputRule>",
  group: "CodeBlock"
});
var Ql = H("CreateCodeBlock", (t) => (e = "") => Ar(qr.type(t), { language: e }));
S(Ql, {
  displayName: "Command<createCodeBlockCommand>",
  group: "CodeBlock"
});
var vw = H("UpdateCodeBlockLanguage", () => ({ pos: t, language: e } = {
  pos: -1,
  language: ""
}) => (n, r) => t >= 0 ? (r?.(n.tr.setNodeAttribute(t, "language", e)), !0) : !1);
S(vw, {
  displayName: "Command<updateCodeBlockLanguageCommand>",
  group: "CodeBlock"
});
var Xl = _e("codeBlockKeymap", { CreateCodeBlock: {
  shortcuts: "Mod-Alt-c",
  command: (t) => {
    const e = t.get(Q);
    return () => e.call(Ql.key);
  }
} });
S(Xl.ctx, {
  displayName: "KeymapCtx<codeBlock>",
  group: "CodeBlock"
});
S(Xl.shortcuts, {
  displayName: "Keymap<codeBlock>",
  group: "CodeBlock"
});
var Zl = tt("image");
S(Zl, {
  displayName: "Attr<image>",
  group: "Image"
});
var Kn = le("image", (t) => ({
  inline: !0,
  group: "inline",
  selectable: !0,
  draggable: !0,
  marks: "",
  atom: !0,
  defining: !0,
  isolating: !0,
  attrs: {
    src: {
      default: "",
      validate: "string"
    },
    alt: {
      default: "",
      validate: "string"
    },
    title: {
      default: "",
      validate: "string"
    }
  },
  parseDOM: [{
    tag: "img[src]",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw ct(e);
      return {
        src: e.getAttribute("src") || "",
        alt: e.getAttribute("alt") || "",
        title: e.getAttribute("title") || e.getAttribute("alt") || ""
      };
    }
  }],
  toDOM: (e) => ["img", {
    ...t.get(Zl.key)(e),
    ...e.attrs
  }],
  parseMarkdown: {
    match: ({ type: e }) => e === "image",
    runner: (e, n, r) => {
      const i = n.url, o = n.alt, s = n.title;
      e.addNode(r, {
        src: i,
        alt: o,
        title: s
      });
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "image",
    runner: (e, n) => {
      e.addNode("image", void 0, void 0, {
        title: n.attrs.title,
        url: n.attrs.src,
        alt: n.attrs.alt
      });
    }
  }
}));
S(Kn.node, {
  displayName: "NodeSchema<image>",
  group: "Image"
});
S(Kn.ctx, {
  displayName: "NodeSchemaCtx<image>",
  group: "Image"
});
var Jd = H("InsertImage", (t) => (e = {}) => (n, r) => {
  if (!r) return !0;
  const { src: i = "", alt: o = "", title: s = "" } = e, l = Kn.type(t).create({
    src: i,
    alt: o,
    title: s
  });
  return l && r(n.tr.replaceSelectionWith(l).scrollIntoView()), !0;
});
S(Jd, {
  displayName: "Command<insertImageCommand>",
  group: "Image"
});
var Gd = H("UpdateImage", (t) => (e = {}) => (n, r) => {
  const i = X1(n.selection, Kn.type(t));
  if (!i) return !1;
  const { node: o, pos: s } = i, l = { ...o.attrs }, { src: a, alt: c, title: u } = e;
  return a !== void 0 && (l.src = a), c !== void 0 && (l.alt = c), u !== void 0 && (l.title = u), r?.(n.tr.setNodeMarkup(s, void 0, l).scrollIntoView()), !0;
});
S(Gd, {
  displayName: "Command<updateImageCommand>",
  group: "Image"
});
var Dw = De((t) => new Fe(/!\[(?<alt>.*?)]\((?<filename>.*?)\s*(?="|\))"?(?<title>[^"]+)?"?\)/, (e, n, r, i) => {
  const [o, s, l = "", a] = n;
  return o ? e.tr.replaceWith(r, i, Kn.type(t).create({
    src: l,
    alt: s,
    title: a
  })) : null;
}));
S(Dw, {
  displayName: "InputRule<insertImageInputRule>",
  group: "Image"
});
var _i = tt("hardbreak", (t) => ({
  "data-type": "hardbreak",
  "data-is-inline": t.attrs.isInline
}));
S(_i, {
  displayName: "Attr<hardbreak>",
  group: "Hardbreak"
});
var dn = le("hardbreak", (t) => ({
  inline: !0,
  group: "inline",
  attrs: { isInline: {
    default: !1,
    validate: "boolean"
  } },
  selectable: !1,
  parseDOM: [{ tag: "br" }, {
    tag: 'span[data-type="hardbreak"]',
    getAttrs: () => ({ isInline: !0 })
  }],
  toDOM: (e) => e.attrs.isInline ? [
    "span",
    t.get(_i.key)(e),
    " "
  ] : ["br", t.get(_i.key)(e)],
  parseMarkdown: {
    match: ({ type: e }) => e === "break",
    runner: (e, n, r) => {
      e.addNode(r, { isInline: !!n.data?.isInline });
    }
  },
  leafText: () => `
`,
  toMarkdown: {
    match: (e) => e.type.name === "hardbreak",
    runner: (e, n) => {
      n.attrs.isInline ? e.addNode("text", void 0, `
`) : e.addNode("break");
    }
  }
}));
S(dn.node, {
  displayName: "NodeSchema<hardbreak>",
  group: "Hardbreak"
});
S(dn.ctx, {
  displayName: "NodeSchemaCtx<hardbreak>",
  group: "Hardbreak"
});
var ea = H("InsertHardbreak", (t) => () => (e, n) => {
  const { selection: r, tr: i } = e;
  if (!(r instanceof V)) return !1;
  if (r.empty) {
    const o = r.$from.node();
    if (o.childCount > 0 && o.lastChild?.type.name === "hardbreak")
      return n?.(i.replaceRangeWith(r.to - 1, r.to, e.schema.node("paragraph")).setSelection($.near(i.doc.resolve(r.to))).scrollIntoView()), !0;
  }
  return n?.(i.setMeta("hardbreak", !0).replaceSelectionWith(dn.type(t).create()).scrollIntoView()), !0;
});
S(ea, {
  displayName: "Command<insertHardbreakCommand>",
  group: "Hardbreak"
});
var ta = _e("hardbreakKeymap", { InsertHardbreak: {
  shortcuts: "Shift-Enter",
  command: (t) => {
    const e = t.get(Q);
    return () => e.call(ea.key);
  }
} });
S(ta.ctx, {
  displayName: "KeymapCtx<hardbreak>",
  group: "Hardbreak"
});
S(ta.shortcuts, {
  displayName: "Keymap<hardbreak>",
  group: "Hardbreak"
});
var na = tt("hr");
S(na, {
  displayName: "Attr<hr>",
  group: "Hr"
});
var Wr = le("hr", (t) => ({
  group: "block",
  parseDOM: [{ tag: "hr" }],
  toDOM: (e) => ["hr", t.get(na.key)(e)],
  parseMarkdown: {
    match: ({ type: e }) => e === "thematicBreak",
    runner: (e, n, r) => {
      e.addNode(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "hr",
    runner: (e) => {
      e.addNode("thematicBreak");
    }
  }
}));
S(Wr.node, {
  displayName: "NodeSchema<hr>",
  group: "Hr"
});
S(Wr.ctx, {
  displayName: "NodeSchemaCtx<hr>",
  group: "Hr"
});
var Yd = De((t) => new Fe(/^(?:---|___\s|\*\*\*\s)$/, (e, n, r, i) => {
  const { tr: o } = e;
  return n[0] && o.replaceWith(r - 1, i, Wr.type(t).create()), o;
}));
S(Yd, {
  displayName: "InputRule<insertHrInputRule>",
  group: "Hr"
});
var Qd = H("InsertHr", (t) => () => (e, n) => {
  if (!n) return !0;
  const r = at.node.type(t).create(), { tr: i, selection: o } = e, { from: s } = o, l = Wr.type(t).create();
  if (!l) return !0;
  const a = i.replaceSelectionWith(l).insert(s, r), c = $.findFrom(a.doc.resolve(s), 1, !0);
  return c && n(a.setSelection(c).scrollIntoView()), !0;
});
S(Qd, {
  displayName: "Command<insertHrCommand>",
  group: "Hr"
});
var ra = tt("bulletList");
S(ra, {
  displayName: "Attr<bulletList>",
  group: "BulletList"
});
var Un = le("bullet_list", (t) => ({
  content: "listItem+",
  group: "block",
  attrs: { spread: {
    default: !1,
    validate: "boolean"
  } },
  parseDOM: [{
    tag: "ul",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw ct(e);
      return { spread: e.dataset.spread === "true" };
    }
  }],
  toDOM: (e) => [
    "ul",
    {
      ...t.get(ra.key)(e),
      "data-spread": e.attrs.spread
    },
    0
  ],
  parseMarkdown: {
    match: ({ type: e, ordered: n }) => e === "list" && !n,
    runner: (e, n, r) => {
      const i = n.spread ?? !1;
      e.openNode(r, { spread: i }).next(n.children).closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "bullet_list",
    runner: (e, n) => {
      e.openNode("list", void 0, {
        ordered: !1,
        spread: n.attrs.spread
      }).next(n.content).closeNode();
    }
  }
}));
S(Un.node, {
  displayName: "NodeSchema<bulletList>",
  group: "BulletList"
});
S(Un.ctx, {
  displayName: "NodeSchemaCtx<bulletList>",
  group: "BulletList"
});
var Xd = De((t) => bl(/^\s*([-+*])\s$/, Un.type(t)));
S(Xd, {
  displayName: "InputRule<wrapInBulletListInputRule>",
  group: "BulletList"
});
var ia = H("WrapInBulletList", (t) => () => kl(Un.type(t)));
S(ia, {
  displayName: "Command<wrapInBulletListCommand>",
  group: "BulletList"
});
var oa = _e("bulletListKeymap", { WrapInBulletList: {
  shortcuts: "Mod-Alt-8",
  command: (t) => {
    const e = t.get(Q);
    return () => e.call(ia.key);
  }
} });
S(oa.ctx, {
  displayName: "KeymapCtx<bulletListKeymap>",
  group: "BulletList"
});
S(oa.shortcuts, {
  displayName: "Keymap<bulletListKeymap>",
  group: "BulletList"
});
var sa = tt("orderedList");
S(sa, {
  displayName: "Attr<orderedList>",
  group: "OrderedList"
});
var Jn = le("ordered_list", (t) => ({
  content: "listItem+",
  group: "block",
  attrs: {
    order: {
      default: 1,
      validate: "number"
    },
    spread: {
      default: !1,
      validate: "boolean"
    }
  },
  parseDOM: [{
    tag: "ol",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw ct(e);
      return {
        spread: e.dataset.spread === "true",
        order: e.hasAttribute("start") ? Number(e.getAttribute("start")) : 1
      };
    }
  }],
  toDOM: (e) => [
    "ol",
    {
      ...t.get(sa.key)(e),
      ...e.attrs.order === 1 ? {} : { start: e.attrs.order },
      "data-spread": e.attrs.spread
    },
    0
  ],
  parseMarkdown: {
    match: ({ type: e, ordered: n }) => e === "list" && !!n,
    runner: (e, n, r) => {
      const i = n.spread ?? !0;
      e.openNode(r, {
        spread: i,
        order: n.start ?? 1
      }).next(n.children).closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "ordered_list",
    runner: (e, n) => {
      e.openNode("list", void 0, {
        ordered: !0,
        start: n.attrs.order ?? 1,
        spread: n.attrs.spread
      }), e.next(n.content), e.closeNode();
    }
  }
}));
S(Jn.node, {
  displayName: "NodeSchema<orderedList>",
  group: "OrderedList"
});
S(Jn.ctx, {
  displayName: "NodeSchemaCtx<orderedList>",
  group: "OrderedList"
});
var Zd = De((t) => bl(/^\s*(\d+)\.\s$/, Jn.type(t), (e) => ({ order: Number(e[1]) }), (e, n) => n.childCount + n.attrs.order === Number(e[1])));
S(Zd, {
  displayName: "InputRule<wrapInOrderedListInputRule>",
  group: "OrderedList"
});
var la = H("WrapInOrderedList", (t) => () => kl(Jn.type(t)));
S(la, {
  displayName: "Command<wrapInOrderedListCommand>",
  group: "OrderedList"
});
var aa = _e("orderedListKeymap", { WrapInOrderedList: {
  shortcuts: "Mod-Alt-7",
  command: (t) => {
    const e = t.get(Q);
    return () => e.call(la.key);
  }
} });
S(aa.ctx, {
  displayName: "KeymapCtx<orderedList>",
  group: "OrderedList"
});
S(aa.shortcuts, {
  displayName: "Keymap<orderedList>",
  group: "OrderedList"
});
var ca = tt("listItem");
S(ca, {
  displayName: "Attr<listItem>",
  group: "ListItem"
});
var Ot = le("list_item", (t) => ({
  group: "listItem",
  content: "paragraph block*",
  attrs: {
    label: {
      default: "•",
      validate: "string"
    },
    listType: {
      default: "bullet",
      validate: "string"
    },
    spread: {
      default: !0,
      validate: "boolean"
    }
  },
  defining: !0,
  parseDOM: [{
    tag: "li",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw ct(e);
      return {
        label: e.dataset.label,
        listType: e.dataset.listType,
        spread: e.dataset.spread === "true"
      };
    }
  }],
  toDOM: (e) => [
    "li",
    {
      ...t.get(ca.key)(e),
      "data-label": e.attrs.label,
      "data-list-type": e.attrs.listType,
      "data-spread": e.attrs.spread
    },
    0
  ],
  parseMarkdown: {
    match: ({ type: e }) => e === "listItem",
    runner: (e, n, r) => {
      const i = n.label != null ? `${n.label}.` : "•", o = n.label != null ? "ordered" : "bullet", s = n.spread ?? !0;
      e.openNode(r, {
        label: i,
        listType: o,
        spread: s
      }), e.next(n.children), e.closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "list_item",
    runner: (e, n) => {
      e.openNode("listItem", void 0, { spread: n.attrs.spread }), e.next(n.content), e.closeNode();
    }
  }
}));
S(Ot.node, {
  displayName: "NodeSchema<listItem>",
  group: "ListItem"
});
S(Ot.ctx, {
  displayName: "NodeSchemaCtx<listItem>",
  group: "ListItem"
});
var ua = H("SinkListItem", (t) => () => pw(Ot.type(t)));
S(ua, {
  displayName: "Command<sinkListItemCommand>",
  group: "ListItem"
});
var ha = H("LiftListItem", (t) => () => hw(Ot.type(t)));
S(ha, {
  displayName: "Command<liftListItemCommand>",
  group: "ListItem"
});
var fa = H("SplitListItem", (t) => () => uw(Ot.type(t)));
S(fa, {
  displayName: "Command<splitListItemCommand>",
  group: "ListItem"
});
function Rw(t) {
  return (e, n, r) => {
    const { selection: i } = e;
    if (!(i instanceof V)) return !1;
    const { empty: o, $from: s } = i;
    return !o || s.parentOffset !== 0 || s.node(-1).type !== Ot.type(t) ? !1 : Sf(e, n, r);
  };
}
var da = H("LiftFirstListItem", (t) => () => Rw(t));
S(da, {
  displayName: "Command<liftFirstListItemCommand>",
  group: "ListItem"
});
var pa = _e("listItemKeymap", {
  NextListItem: {
    shortcuts: "Enter",
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(fa.key);
    }
  },
  SinkListItem: {
    shortcuts: ["Tab", "Mod-]"],
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(ua.key);
    }
  },
  LiftListItem: {
    shortcuts: ["Shift-Tab", "Mod-["],
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(ha.key);
    }
  },
  LiftFirstListItem: {
    shortcuts: ["Backspace", "Delete"],
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(da.key);
    }
  }
});
S(pa.ctx, {
  displayName: "KeymapCtx<listItem>",
  group: "ListItem"
});
S(pa.shortcuts, {
  displayName: "Keymap<listItem>",
  group: "ListItem"
});
var ep = Ol("text", () => ({
  group: "inline",
  parseMarkdown: {
    match: ({ type: t }) => t === "text",
    runner: (t, e) => {
      t.addText(e.value);
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "text",
    runner: (t, e) => {
      t.addNode("text", void 0, e.text);
    }
  }
}));
S(ep, {
  displayName: "NodeSchema<text>",
  group: "Text"
});
var ma = tt("html");
S(ma, {
  displayName: "Attr<html>",
  group: "Html"
});
var ga = le("html", (t) => ({
  atom: !0,
  group: "inline",
  inline: !0,
  attrs: { value: {
    default: "",
    validate: "string"
  } },
  toDOM: (e) => {
    const n = document.createElement("span"), r = {
      ...t.get(ma.key)(e),
      "data-value": e.attrs.value,
      "data-type": "html"
    };
    return n.textContent = e.attrs.value, [
      "span",
      r,
      e.attrs.value
    ];
  },
  parseDOM: [{
    tag: 'span[data-type="html"]',
    getAttrs: (e) => ({ value: e.dataset.value ?? "" })
  }],
  parseMarkdown: {
    match: ({ type: e }) => e === "html",
    runner: (e, n, r) => {
      e.addNode(r, { value: n.value });
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "html",
    runner: (e, n) => {
      e.addNode("html", void 0, n.attrs.value);
    }
  }
}));
S(ga.node, {
  displayName: "NodeSchema<html>",
  group: "Html"
});
S(ga.ctx, {
  displayName: "NodeSchemaCtx<html>",
  group: "Html"
});
var zw = [
  Hd,
  Vl,
  at,
  oo,
  ql,
  xn,
  _i,
  dn,
  Ul,
  jr,
  Yl,
  qr,
  na,
  Wr,
  Zl,
  Kn,
  ra,
  Un,
  sa,
  Jn,
  ca,
  Ot,
  vl,
  Wn,
  zl,
  Hr,
  Bl,
  $t,
  $l,
  Dn,
  ma,
  ga,
  ep
].flat(), Pw = [
  Kd,
  Xd,
  Zd,
  Ud,
  Yd,
  Wd
].flat(), Lw = [
  Ld,
  Bd,
  _d,
  Fd
], Bw = H("IsMarkSelected", () => (t) => (e) => {
  if (!t) return !1;
  const { doc: n, selection: r } = e;
  return n.rangeHasMark(r.from, r.to, t);
}), Fw = H("IsNoteSelected", () => (t) => (e) => t ? Z1(e, t).hasNode : !1), _w = H("ClearTextInCurrentBlock", () => () => (t, e) => {
  let n = t.tr;
  const { $from: r, $to: i } = n.selection, { pos: o } = r, { pos: s } = i, l = o - r.node().content.size;
  return l < 0 ? !1 : (n = n.deleteRange(l, s), e?.(n), !0);
}), $w = H("SetBlockType", () => (t) => (e, n) => {
  const { nodeType: r, attrs: i = null } = t ?? {};
  if (!r) return !1;
  const o = e.tr, { from: s, to: l } = o.selection;
  try {
    o.setBlockType(s, l, r, i);
  } catch {
    return !1;
  }
  return n?.(o), !0;
}), Vw = H("WrapInBlockType", () => (t) => (e, n) => {
  const { nodeType: r, attrs: i = null } = t ?? {};
  if (!r) return !1;
  let o = e.tr;
  try {
    const { $from: s, $to: l } = o.selection, a = s.blockRange(l), c = a && dl(a, r, i);
    if (!c) return !1;
    o = o.wrap(a, c);
  } catch {
    return !1;
  }
  return n?.(o), !0;
}), Hw = H("AddBlockType", () => (t) => (e, n) => {
  const { nodeType: r, attrs: i = null } = t ?? {};
  if (!r) return !1;
  const o = e.tr;
  try {
    const s = r instanceof He ? r : r.createAndFill(i);
    if (!s) return !1;
    o.replaceSelectionWith(s);
  } catch {
    return !1;
  }
  return n?.(o), !0;
}), jw = H("SelectTextNearPos", () => (t) => (e, n) => {
  const { pos: r } = t ?? {};
  if (r == null) return !1;
  const i = (s, l, a) => Math.min(Math.max(s, l), a), o = e.tr;
  try {
    const s = e.doc.resolve(i(r, 0, e.doc.content.size));
    o.setSelection(V.near(s));
  } catch {
    return !1;
  }
  return n?.(o.scrollIntoView()), !0;
}), qw = [
  Hl,
  Jl,
  Lt,
  Wl,
  Ql,
  ea,
  Qd,
  Jd,
  Gd,
  la,
  ia,
  ua,
  fa,
  ha,
  da,
  Dl,
  Fl,
  Pl,
  $d,
  Vd,
  Bw,
  Fw,
  _w,
  $w,
  Vw,
  Hw,
  jw
], Ww = [
  Gl,
  Xl,
  ta,
  Kl,
  pa,
  aa,
  oa,
  jl,
  Rl,
  _l,
  Ll
].flat(), ya = Yt("remarkAddOrderInList", () => () => (t) => {
  Vn(t, "list", (e) => {
    if (e.ordered) {
      const n = e.start ?? 1;
      e.children.forEach((r, i) => {
        r.label = i + n;
      });
    }
  });
});
S(ya.plugin, {
  displayName: "Remark<remarkAddOrderInListPlugin>",
  group: "Remark"
});
S(ya.options, {
  displayName: "RemarkConfig<remarkAddOrderInListPlugin>",
  group: "Remark"
});
var ka = Yt("remarkLineBreak", () => () => (t) => {
  const e = /[\t ]*(?:\r?\n|\r)/g;
  Vn(t, "text", (n, r, i) => {
    if (!n.value || typeof n.value != "string") return;
    const o = [];
    let s = 0;
    e.lastIndex = 0;
    let l = e.exec(n.value);
    for (; l; ) {
      const a = l.index;
      s !== a && o.push({
        type: "text",
        value: n.value.slice(s, a)
      }), o.push({
        type: "break",
        data: { isInline: !0 }
      }), s = a + l[0].length, l = e.exec(n.value);
    }
    if (o.length > 0 && i && typeof r == "number")
      return s < n.value.length && o.push({
        type: "text",
        value: n.value.slice(s)
      }), i.children.splice(r, 1, ...o), r + o.length;
  });
});
S(ka.plugin, {
  displayName: "Remark<remarkLineBreak>",
  group: "Remark"
});
S(ka.options, {
  displayName: "RemarkConfig<remarkLineBreak>",
  group: "Remark"
});
var ba = Yt("remarkInlineLink", () => gw);
S(ba.plugin, {
  displayName: "Remark<remarkInlineLinkPlugin>",
  group: "Remark"
});
S(ba.options, {
  displayName: "RemarkConfig<remarkInlineLinkPlugin>",
  group: "Remark"
});
var Kw = (t) => !!t.children, Uw = (t) => t.type === "html";
function Jw(t, e) {
  return n(t, 0, null)[0];
  function n(r, i, o) {
    if (Kw(r)) {
      const s = [];
      for (let l = 0, a = r.children.length; l < a; l++) {
        const c = r.children[l];
        if (c) {
          const u = n(c, l, r);
          if (u) for (let h = 0, d = u.length; h < d; h++) {
            const f = u[h];
            f && s.push(f);
          }
        }
      }
      r.children = s;
    }
    return e(r, i, o);
  }
}
var xa = Yt("remarkHTMLTransformer", (t) => () => (e) => {
  const n = qd(t);
  Jw(e, (r, i, o) => Uw(r) ? (o && n.has(o.type) && (r.children = [yw(r)], delete r.value, r.type = "paragraph"), [r]) : [r]);
});
S(xa.plugin, {
  displayName: "Remark<remarkHtmlTransformer>",
  group: "Remark"
});
S(xa.options, {
  displayName: "RemarkConfig<remarkHtmlTransformer>",
  group: "Remark"
});
var wa = Yt("remarkMarker", () => () => (t, e) => {
  const n = (r) => e.value.charAt(r.position.start.offset);
  Vn(t, (r) => ["strong", "emphasis"].includes(r.type), (r) => {
    r.marker = n(r);
  });
});
S(wa.plugin, {
  displayName: "Remark<remarkMarker>",
  group: "Remark"
});
S(wa.options, {
  displayName: "RemarkConfig<remarkMarker>",
  group: "Remark"
});
var tp = It(() => {
  let t = !1;
  const e = new ve("MILKDOWN_INLINE_NODES_CURSOR"), n = new Oe({
    key: e,
    state: {
      init() {
        return !1;
      },
      apply(r) {
        if (!r.selection.empty) return !1;
        const i = r.selection.$from, o = i.nodeBefore, s = i.nodeAfter;
        return !!(o && s && o.isInline && !o.isText && s.isInline && !s.isText);
      }
    },
    props: {
      handleDOMEvents: {
        compositionend: (r, i) => t ? (t = !1, requestAnimationFrame(() => {
          if (n.getState(r.state)) {
            const o = r.state.selection.from;
            i.preventDefault(), r.dispatch(r.state.tr.insertText(i.data || "", o));
          }
        }), !0) : !1,
        compositionstart: (r) => (n.getState(r.state) && (t = !0), !1),
        beforeinput: (r, i) => {
          if (n.getState(r.state) && i instanceof InputEvent && i.data && !t) {
            const o = r.state.selection.from;
            return i.preventDefault(), r.dispatch(r.state.tr.insertText(i.data || "", o)), !0;
          }
          return !1;
        }
      },
      decorations(r) {
        if (n.getState(r)) {
          const i = r.selection.$from.pos, o = document.createElement("span"), s = me.widget(i, o, { side: -1 }), l = document.createElement("span"), a = me.widget(i, l);
          return setTimeout(() => {
            o.contentEditable = "true", l.contentEditable = "true";
          }), ne.create(r.doc, [s, a]);
        }
        return ne.empty;
      }
    }
  });
  return n;
});
S(tp, {
  displayName: "Prose<inlineNodesCursorPlugin>",
  group: "Prose"
});
var np = It((t) => new Oe({
  key: new ve("MILKDOWN_HARDBREAK_MARKS"),
  appendTransaction: (e, n, r) => {
    if (!e.length) return;
    const [i] = e;
    if (!i) return;
    const [o] = i.steps;
    if (i.getMeta("hardbreak")) {
      if (!(o instanceof ie)) return;
      const { from: s } = o;
      return r.tr.setNodeMarkup(s, dn.type(t), void 0, []);
    }
    if (o instanceof xt) {
      let s = r.tr;
      const { from: l, to: a } = o;
      return r.doc.nodesBetween(l, a, (c, u) => {
        c.type === dn.type(t) && (s = s.setNodeMarkup(u, dn.type(t), void 0, []));
      }), s;
    }
  }
}));
S(np, {
  displayName: "Prose<hardbreakClearMarkPlugin>",
  group: "Prose"
});
var Ca = Et(["table", "code_block"], "hardbreakFilterNodes");
S(Ca, {
  displayName: "Ctx<hardbreakFilterNodes>",
  group: "Prose"
});
var rp = It((t) => {
  const e = t.get(Ca.key);
  return new Oe({
    key: new ve("MILKDOWN_HARDBREAK_FILTER"),
    filterTransaction: (n, r) => {
      const i = n.getMeta("hardbreak"), [o] = n.steps;
      if (i && o) {
        const { from: s } = o, l = r.doc.resolve(s);
        let a = l.depth, c = !0;
        for (; a > 0; )
          e.includes(l.node(a).type.name) && (c = !1), a--;
        return c;
      }
      return !0;
    }
  });
});
S(rp, {
  displayName: "Prose<hardbreakFilterPlugin>",
  group: "Prose"
});
var ip = It((t) => {
  const e = new ve("MILKDOWN_HEADING_ID"), n = (r) => {
    if (r.composing) return;
    const i = t.get(oo.key), o = r.state.tr.setMeta("addToHistory", !1);
    let s = !1;
    const l = {};
    r.state.doc.descendants((a, c) => {
      if (a.type === xn.type(t)) {
        if (a.textContent.trim().length === 0) return;
        const u = a.attrs;
        let h = i(a);
        l[h] ? (l[h] += 1, h += `-#${l[h]}`) : l[h] = 1, u.id !== h && (s = !0, o.setMeta(e, !0).setNodeMarkup(c, void 0, {
          ...u,
          id: h
        }));
      }
    }), s && r.dispatch(o);
  };
  return new Oe({
    key: e,
    view: (r) => (n(r), { update: (i, o) => {
      i.state.doc.eq(o.doc) || n(i);
    } })
  });
});
S(ip, {
  displayName: "Prose<syncHeadingIdPlugin>",
  group: "Prose"
});
var op = It((t) => {
  const e = (n, r, i) => {
    if (!i.selection || n.some((h) => h.getMeta("addToHistory") === !1 || !h.isGeneric)) return null;
    const o = Jn.type(t), s = Un.type(t), l = Ot.type(t), a = (h, d, f = 1) => {
      let p = !1;
      const m = `${d + f}.`;
      return h.label !== m && (h.label = m, p = !0), p;
    };
    let c = i.tr, u = !1;
    return i.doc.descendants((h, d, f, p) => {
      if (h.type === s) {
        const m = h.maybeChild(0);
        m?.type === l && m.attrs.listType === "ordered" && (u = !0, c.setNodeMarkup(d, o, { spread: !0 }), h.descendants((y, g, N, w) => {
          if (y.type === l) {
            const O = { ...y.attrs };
            a(O, w) && (c = c.setNodeMarkup(g, void 0, O));
          }
          return !1;
        }));
      } else if (h.type === l && f?.type === o) {
        const m = { ...h.attrs };
        let y = !1;
        m.listType !== "ordered" && (m.listType = "ordered", y = !0), f?.maybeChild(0) && (y = a(m, p, f?.attrs.order ?? 1)), y && (c = c.setNodeMarkup(d, void 0, m), u = !0);
      }
    }), u ? c.setMeta("addToHistory", !1) : null;
  };
  return new Oe({
    key: new ve("MILKDOWN_KEEP_LIST_ORDER"),
    appendTransaction: e
  });
});
S(op, {
  displayName: "Prose<syncListOrderPlugin>",
  group: "Prose"
});
var Gw = [
  np,
  Ca,
  rp,
  tp,
  Fi,
  ya,
  ba,
  ka,
  xa,
  wa,
  io,
  ip,
  op
].flat(), Yw = [
  zw,
  Pw,
  Lw,
  qw,
  Ww,
  Gw
].flat();
let Vs, Hs;
if (typeof WeakMap < "u") {
  let t = /* @__PURE__ */ new WeakMap();
  Vs = (e) => t.get(e), Hs = (e, n) => (t.set(e, n), n);
} else {
  const t = [];
  let n = 0;
  Vs = (r) => {
    for (let i = 0; i < t.length; i += 2) if (t[i] == r) return t[i + 1];
  }, Hs = (r, i) => (n == 10 && (n = 0), t[n++] = r, t[n++] = i);
}
var Y = class {
  constructor(t, e, n, r) {
    this.width = t, this.height = e, this.map = n, this.problems = r;
  }
  findCell(t) {
    for (let e = 0; e < this.map.length; e++) {
      const n = this.map[e];
      if (n != t) continue;
      const r = e % this.width, i = e / this.width | 0;
      let o = r + 1, s = i + 1;
      for (let l = 1; o < this.width && this.map[e + l] == n; l++) o++;
      for (let l = 1; s < this.height && this.map[e + this.width * l] == n; l++) s++;
      return {
        left: r,
        top: i,
        right: o,
        bottom: s
      };
    }
    throw new RangeError(`No cell with offset ${t} found`);
  }
  colCount(t) {
    for (let e = 0; e < this.map.length; e++) if (this.map[e] == t) return e % this.width;
    throw new RangeError(`No cell with offset ${t} found`);
  }
  nextCell(t, e, n) {
    const { left: r, right: i, top: o, bottom: s } = this.findCell(t);
    return e == "horiz" ? (n < 0 ? r == 0 : i == this.width) ? null : this.map[o * this.width + (n < 0 ? r - 1 : i)] : (n < 0 ? o == 0 : s == this.height) ? null : this.map[r + this.width * (n < 0 ? o - 1 : s)];
  }
  rectBetween(t, e) {
    const { left: n, right: r, top: i, bottom: o } = this.findCell(t), { left: s, right: l, top: a, bottom: c } = this.findCell(e);
    return {
      left: Math.min(n, s),
      top: Math.min(i, a),
      right: Math.max(r, l),
      bottom: Math.max(o, c)
    };
  }
  cellsInRect(t) {
    const e = [], n = {};
    for (let r = t.top; r < t.bottom; r++) for (let i = t.left; i < t.right; i++) {
      const o = r * this.width + i, s = this.map[o];
      n[s] || (n[s] = !0, !(i == t.left && i && this.map[o - 1] == s || r == t.top && r && this.map[o - this.width] == s) && e.push(s));
    }
    return e;
  }
  positionAt(t, e, n) {
    for (let r = 0, i = 0; ; r++) {
      const o = i + n.child(r).nodeSize;
      if (r == t) {
        let s = e + t * this.width;
        const l = (t + 1) * this.width;
        for (; s < l && this.map[s] < i; ) s++;
        return s == l ? o - 1 : this.map[s];
      }
      i = o;
    }
  }
  static get(t) {
    return Vs(t) || Hs(t, Qw(t));
  }
};
function Qw(t) {
  if (t.type.spec.tableRole != "table") throw new RangeError("Not a table node: " + t.type.name);
  const e = Xw(t), n = t.childCount, r = [];
  let i = 0, o = null;
  const s = [];
  for (let c = 0, u = e * n; c < u; c++) r[c] = 0;
  for (let c = 0, u = 0; c < n; c++) {
    const h = t.child(c);
    u++;
    for (let p = 0; ; p++) {
      for (; i < r.length && r[i] != 0; ) i++;
      if (p == h.childCount) break;
      const m = h.child(p), { colspan: y, rowspan: g, colwidth: N } = m.attrs;
      for (let w = 0; w < g; w++) {
        if (w + c >= n) {
          (o || (o = [])).push({
            type: "overlong_rowspan",
            pos: u,
            n: g - w
          });
          break;
        }
        const O = i + w * e;
        for (let v = 0; v < y; v++) {
          r[O + v] == 0 ? r[O + v] = u : (o || (o = [])).push({
            type: "collision",
            row: c,
            pos: u,
            n: y - v
          });
          const x = N && N[v];
          if (x) {
            const A = (O + v) % e * 2, R = s[A];
            R == null || R != x && s[A + 1] == 1 ? (s[A] = x, s[A + 1] = 1) : R == x && s[A + 1]++;
          }
        }
      }
      i += y, u += m.nodeSize;
    }
    const d = (c + 1) * e;
    let f = 0;
    for (; i < d; ) r[i++] == 0 && f++;
    f && (o || (o = [])).push({
      type: "missing",
      row: c,
      n: f
    }), u++;
  }
  (e === 0 || n === 0) && (o || (o = [])).push({ type: "zero_sized" });
  const l = new Y(e, n, r, o);
  let a = !1;
  for (let c = 0; !a && c < s.length; c += 2) s[c] != null && s[c + 1] < n && (a = !0);
  return a && Zw(l, s, t), l;
}
function Xw(t) {
  let e = -1, n = !1;
  for (let r = 0; r < t.childCount; r++) {
    const i = t.child(r);
    let o = 0;
    if (n) for (let s = 0; s < r; s++) {
      const l = t.child(s);
      for (let a = 0; a < l.childCount; a++) {
        const c = l.child(a);
        s + c.attrs.rowspan > r && (o += c.attrs.colspan);
      }
    }
    for (let s = 0; s < i.childCount; s++) {
      const l = i.child(s);
      o += l.attrs.colspan, l.attrs.rowspan > 1 && (n = !0);
    }
    e == -1 ? e = o : e != o && (e = Math.max(e, o));
  }
  return e;
}
function Zw(t, e, n) {
  t.problems || (t.problems = []);
  const r = {};
  for (let i = 0; i < t.map.length; i++) {
    const o = t.map[i];
    if (r[o]) continue;
    r[o] = !0;
    const s = n.nodeAt(o);
    if (!s) throw new RangeError(`No cell with offset ${o} found`);
    let l = null;
    const a = s.attrs;
    for (let c = 0; c < a.colspan; c++) {
      const u = e[(i + c) % t.width * 2];
      u != null && (!a.colwidth || a.colwidth[c] != u) && ((l || (l = eC(a)))[c] = u);
    }
    l && t.problems.unshift({
      type: "colwidth mismatch",
      pos: o,
      colwidth: l
    });
  }
}
function eC(t) {
  if (t.colwidth) return t.colwidth.slice();
  const e = [];
  for (let n = 0; n < t.colspan; n++) e.push(0);
  return e;
}
function Su(t, e) {
  if (typeof t == "string") return {};
  const n = t.getAttribute("data-colwidth"), r = n && /^\d+(,\d+)*$/.test(n) ? n.split(",").map((s) => Number(s)) : null, i = Number(t.getAttribute("colspan") || 1), o = {
    colspan: i,
    rowspan: Number(t.getAttribute("rowspan") || 1),
    colwidth: r && r.length == i ? r : null
  };
  for (const s in e) {
    const l = e[s].getFromDOM, a = l && l(t);
    a != null && (o[s] = a);
  }
  return o;
}
function Nu(t, e) {
  const n = {};
  t.attrs.colspan != 1 && (n.colspan = t.attrs.colspan), t.attrs.rowspan != 1 && (n.rowspan = t.attrs.rowspan), t.attrs.colwidth && (n["data-colwidth"] = t.attrs.colwidth.join(","));
  for (const r in e) {
    const i = e[r].setDOMAttr;
    i && i(t.attrs[r], n);
  }
  return n;
}
function tC(t) {
  if (t !== null) {
    if (!Array.isArray(t)) throw new TypeError("colwidth must be null or an array");
    for (const e of t) if (typeof e != "number") throw new TypeError("colwidth must be null or an array of numbers");
  }
}
function nC(t) {
  const e = t.cellAttributes || {}, n = {
    colspan: {
      default: 1,
      validate: "number"
    },
    rowspan: {
      default: 1,
      validate: "number"
    },
    colwidth: {
      default: null,
      validate: tC
    }
  };
  for (const r in e) n[r] = {
    default: e[r].default,
    validate: e[r].validate
  };
  return {
    table: {
      content: "table_row+",
      tableRole: "table",
      isolating: !0,
      group: t.tableGroup,
      parseDOM: [{ tag: "table" }],
      toDOM() {
        return ["table", ["tbody", 0]];
      }
    },
    table_row: {
      content: "(table_cell | table_header)*",
      tableRole: "row",
      parseDOM: [{ tag: "tr" }],
      toDOM() {
        return ["tr", 0];
      }
    },
    table_cell: {
      content: t.cellContent,
      attrs: n,
      tableRole: "cell",
      isolating: !0,
      parseDOM: [{
        tag: "td",
        getAttrs: (r) => Su(r, e)
      }],
      toDOM(r) {
        return [
          "td",
          Nu(r, e),
          0
        ];
      }
    },
    table_header: {
      content: t.cellContent,
      attrs: n,
      tableRole: "header_cell",
      isolating: !0,
      parseDOM: [{
        tag: "th",
        getAttrs: (r) => Su(r, e)
      }],
      toDOM(r) {
        return [
          "th",
          Nu(r, e),
          0
        ];
      }
    }
  };
}
function qe(t) {
  let e = t.cached.tableNodeTypes;
  if (!e) {
    e = t.cached.tableNodeTypes = {};
    for (const n in t.nodes) {
      const r = t.nodes[n], i = r.spec.tableRole;
      i && (e[i] = r);
    }
  }
  return e;
}
const Ft = new ve("selectingCells");
function Fn(t) {
  for (let e = t.depth - 1; e > 0; e--) if (t.node(e).type.spec.tableRole == "row") return t.node(0).resolve(t.before(e + 1));
  return null;
}
function Ue(t) {
  const e = t.selection.$head;
  for (let n = e.depth; n > 0; n--) if (e.node(n).type.spec.tableRole == "row") return !0;
  return !1;
}
function so(t) {
  const e = t.selection;
  if ("$anchorCell" in e && e.$anchorCell) return e.$anchorCell.pos > e.$headCell.pos ? e.$anchorCell : e.$headCell;
  if ("node" in e && e.node && e.node.type.spec.tableRole == "cell") return e.$anchor;
  const n = Fn(e.$head) || rC(e.$head);
  if (n) return n;
  throw new RangeError(`No cell found around position ${e.head}`);
}
function rC(t) {
  for (let e = t.nodeAfter, n = t.pos; e; e = e.firstChild, n++) {
    const r = e.type.spec.tableRole;
    if (r == "cell" || r == "header_cell") return t.doc.resolve(n);
  }
  for (let e = t.nodeBefore, n = t.pos; e; e = e.lastChild, n--) {
    const r = e.type.spec.tableRole;
    if (r == "cell" || r == "header_cell") return t.doc.resolve(n - e.nodeSize);
  }
}
function js(t) {
  return t.parent.type.spec.tableRole == "row" && !!t.nodeAfter;
}
function iC(t) {
  return t.node(0).resolve(t.pos + t.nodeAfter.nodeSize);
}
function Sa(t, e) {
  return t.depth == e.depth && t.pos >= e.start(-1) && t.pos <= e.end(-1);
}
function sp(t, e, n) {
  const r = t.node(-1), i = Y.get(r), o = t.start(-1), s = i.nextCell(t.pos - o, e, n);
  return s == null ? null : t.node(0).resolve(o + s);
}
function bn(t, e, n = 1) {
  const r = {
    ...t,
    colspan: t.colspan - n
  };
  return r.colwidth && (r.colwidth = r.colwidth.slice(), r.colwidth.splice(e, n), r.colwidth.some((i) => i > 0) || (r.colwidth = null)), r;
}
function oC(t, e, n = 1) {
  const r = {
    ...t,
    colspan: t.colspan + n
  };
  if (r.colwidth) {
    r.colwidth = r.colwidth.slice();
    for (let i = 0; i < n; i++) r.colwidth.splice(e, 0, 0);
  }
  return r;
}
function sC(t, e, n) {
  const r = qe(e.type.schema).header_cell;
  for (let i = 0; i < t.height; i++) if (e.nodeAt(t.map[n + i * t.width]).type != r) return !1;
  return !0;
}
var te = class yt extends $ {
  constructor(e, n = e) {
    const r = e.node(-1), i = Y.get(r), o = e.start(-1), s = i.rectBetween(e.pos - o, n.pos - o), l = e.node(0), a = i.cellsInRect(s).filter((u) => u != n.pos - o);
    a.unshift(n.pos - o);
    const c = a.map((u) => {
      const h = r.nodeAt(u);
      if (!h) throw new RangeError(`No cell with offset ${u} found`);
      const d = o + u + 1;
      return new bf(l.resolve(d), l.resolve(d + h.content.size));
    });
    super(c[0].$from, c[0].$to, c), this.$anchorCell = e, this.$headCell = n;
  }
  map(e, n) {
    const r = e.resolve(n.map(this.$anchorCell.pos)), i = e.resolve(n.map(this.$headCell.pos));
    if (js(r) && js(i) && Sa(r, i)) {
      const o = this.$anchorCell.node(-1) != r.node(-1);
      return o && this.isRowSelection() ? yt.rowSelection(r, i) : o && this.isColSelection() ? yt.colSelection(r, i) : new yt(r, i);
    }
    return V.between(r, i);
  }
  content() {
    const e = this.$anchorCell.node(-1), n = Y.get(e), r = this.$anchorCell.start(-1), i = n.rectBetween(this.$anchorCell.pos - r, this.$headCell.pos - r), o = {}, s = [];
    for (let a = i.top; a < i.bottom; a++) {
      const c = [];
      for (let u = a * n.width + i.left, h = i.left; h < i.right; h++, u++) {
        const d = n.map[u];
        if (o[d]) continue;
        o[d] = !0;
        const f = n.findCell(d);
        let p = e.nodeAt(d);
        if (!p) throw new RangeError(`No cell with offset ${d} found`);
        const m = i.left - f.left, y = f.right - i.right;
        if (m > 0 || y > 0) {
          let g = p.attrs;
          if (m > 0 && (g = bn(g, 0, m)), y > 0 && (g = bn(g, g.colspan - y, y)), f.left < i.left) {
            if (p = p.type.createAndFill(g), !p) throw new RangeError(`Could not create cell with attrs ${JSON.stringify(g)}`);
          } else p = p.type.create(g, p.content);
        }
        if (f.top < i.top || f.bottom > i.bottom) {
          const g = {
            ...p.attrs,
            rowspan: Math.min(f.bottom, i.bottom) - Math.max(f.top, i.top)
          };
          f.top < i.top ? p = p.type.createAndFill(g) : p = p.type.create(g, p.content);
        }
        c.push(p);
      }
      s.push(e.child(a).copy(T.from(c)));
    }
    const l = this.isColSelection() && this.isRowSelection() ? e : s;
    return new E(T.from(l), 1, 1);
  }
  replace(e, n = E.empty) {
    const r = e.steps.length, i = this.ranges;
    for (let s = 0; s < i.length; s++) {
      const { $from: l, $to: a } = i[s], c = e.mapping.slice(r);
      e.replace(c.map(l.pos), c.map(a.pos), s ? E.empty : n);
    }
    const o = $.findFrom(e.doc.resolve(e.mapping.slice(r).map(this.to)), -1);
    o && e.setSelection(o);
  }
  replaceWith(e, n) {
    this.replace(e, new E(T.from(n), 0, 0));
  }
  forEachCell(e) {
    const n = this.$anchorCell.node(-1), r = Y.get(n), i = this.$anchorCell.start(-1), o = r.cellsInRect(r.rectBetween(this.$anchorCell.pos - i, this.$headCell.pos - i));
    for (let s = 0; s < o.length; s++) e(n.nodeAt(o[s]), i + o[s]);
  }
  isColSelection() {
    const e = this.$anchorCell.index(-1), n = this.$headCell.index(-1);
    if (Math.min(e, n) > 0) return !1;
    const r = e + this.$anchorCell.nodeAfter.attrs.rowspan, i = n + this.$headCell.nodeAfter.attrs.rowspan;
    return Math.max(r, i) == this.$headCell.node(-1).childCount;
  }
  static colSelection(e, n = e) {
    const r = e.node(-1), i = Y.get(r), o = e.start(-1), s = i.findCell(e.pos - o), l = i.findCell(n.pos - o), a = e.node(0);
    return s.top <= l.top ? (s.top > 0 && (e = a.resolve(o + i.map[s.left])), l.bottom < i.height && (n = a.resolve(o + i.map[i.width * (i.height - 1) + l.right - 1]))) : (l.top > 0 && (n = a.resolve(o + i.map[l.left])), s.bottom < i.height && (e = a.resolve(o + i.map[i.width * (i.height - 1) + s.right - 1]))), new yt(e, n);
  }
  isRowSelection() {
    const e = this.$anchorCell.node(-1), n = Y.get(e), r = this.$anchorCell.start(-1), i = n.colCount(this.$anchorCell.pos - r), o = n.colCount(this.$headCell.pos - r);
    if (Math.min(i, o) > 0) return !1;
    const s = i + this.$anchorCell.nodeAfter.attrs.colspan, l = o + this.$headCell.nodeAfter.attrs.colspan;
    return Math.max(s, l) == n.width;
  }
  eq(e) {
    return e instanceof yt && e.$anchorCell.pos == this.$anchorCell.pos && e.$headCell.pos == this.$headCell.pos;
  }
  static rowSelection(e, n = e) {
    const r = e.node(-1), i = Y.get(r), o = e.start(-1), s = i.findCell(e.pos - o), l = i.findCell(n.pos - o), a = e.node(0);
    return s.left <= l.left ? (s.left > 0 && (e = a.resolve(o + i.map[s.top * i.width])), l.right < i.width && (n = a.resolve(o + i.map[i.width * (l.top + 1) - 1]))) : (l.left > 0 && (n = a.resolve(o + i.map[l.top * i.width])), s.right < i.width && (e = a.resolve(o + i.map[i.width * (s.top + 1) - 1]))), new yt(e, n);
  }
  toJSON() {
    return {
      type: "cell",
      anchor: this.$anchorCell.pos,
      head: this.$headCell.pos
    };
  }
  static fromJSON(e, n) {
    return new yt(e.resolve(n.anchor), e.resolve(n.head));
  }
  static create(e, n, r = n) {
    return new yt(e.resolve(n), e.resolve(r));
  }
  getBookmark() {
    return new lC(this.$anchorCell.pos, this.$headCell.pos);
  }
};
te.prototype.visible = !1;
$.jsonID("cell", te);
var lC = class lp {
  constructor(e, n) {
    this.anchor = e, this.head = n;
  }
  map(e) {
    return new lp(e.map(this.anchor), e.map(this.head));
  }
  resolve(e) {
    const n = e.resolve(this.anchor), r = e.resolve(this.head);
    return n.parent.type.spec.tableRole == "row" && r.parent.type.spec.tableRole == "row" && n.index() < n.parent.childCount && r.index() < r.parent.childCount && Sa(n, r) ? new te(n, r) : $.near(r, 1);
  }
};
function aC(t) {
  if (!(t.selection instanceof te)) return null;
  const e = [];
  return t.selection.forEachCell((n, r) => {
    e.push(me.node(r, r + n.nodeSize, { class: "selectedCell" }));
  }), ne.create(t.doc, e);
}
function cC({ $from: t, $to: e }) {
  if (t.pos == e.pos || t.pos < e.pos - 6) return !1;
  let n = t.pos, r = e.pos, i = t.depth;
  for (; i >= 0 && !(t.after(i + 1) < t.end(i)); i--, n++) ;
  for (let o = e.depth; o >= 0 && !(e.before(o + 1) > e.start(o)); o--, r--) ;
  return n == r && /row|table/.test(t.node(i).type.spec.tableRole);
}
function uC({ $from: t, $to: e }) {
  let n, r;
  for (let i = t.depth; i > 0; i--) {
    const o = t.node(i);
    if (o.type.spec.tableRole === "cell" || o.type.spec.tableRole === "header_cell") {
      n = o;
      break;
    }
  }
  for (let i = e.depth; i > 0; i--) {
    const o = e.node(i);
    if (o.type.spec.tableRole === "cell" || o.type.spec.tableRole === "header_cell") {
      r = o;
      break;
    }
  }
  return n !== r && e.parentOffset === 0;
}
function hC(t, e, n) {
  const r = (e || t).selection, i = (e || t).doc;
  let o, s;
  if (r instanceof _ && (s = r.node.type.spec.tableRole)) {
    if (s == "cell" || s == "header_cell") o = te.create(i, r.from);
    else if (s == "row") {
      const l = i.resolve(r.from + 1);
      o = te.rowSelection(l, l);
    } else if (!n) {
      const l = Y.get(r.node), a = r.from + 1, c = a + l.map[l.width * l.height - 1];
      o = te.create(i, a + 1, c);
    }
  } else r instanceof V && cC(r) ? o = V.create(i, r.from) : r instanceof V && uC(r) && (o = V.create(i, r.$from.start(), r.$from.end()));
  return o && (e || (e = t.tr)).setSelection(o), e;
}
const fC = new ve("fix-tables");
function ap(t, e, n, r) {
  const i = t.childCount, o = e.childCount;
  e: for (let s = 0, l = 0; s < o; s++) {
    const a = e.child(s);
    for (let c = l, u = Math.min(i, s + 3); c < u; c++) if (t.child(c) == a) {
      l = c + 1, n += a.nodeSize;
      continue e;
    }
    r(a, n), l < i && t.child(l).sameMarkup(a) ? ap(t.child(l), a, n + 1, r) : a.nodesBetween(0, a.content.size, r, n + 1), n += a.nodeSize;
  }
}
function dC(t, e) {
  let n;
  const r = (i, o) => {
    i.type.spec.tableRole == "table" && (n = pC(t, i, o, n));
  };
  return e ? e.doc != t.doc && ap(e.doc, t.doc, 0, r) : t.doc.descendants(r), n;
}
function pC(t, e, n, r) {
  const i = Y.get(e);
  if (!i.problems) return r;
  r || (r = t.tr);
  const o = [];
  for (let a = 0; a < i.height; a++) o.push(0);
  for (let a = 0; a < i.problems.length; a++) {
    const c = i.problems[a];
    if (c.type == "collision") {
      const u = e.nodeAt(c.pos);
      if (!u) continue;
      const h = u.attrs;
      for (let d = 0; d < h.rowspan; d++) o[c.row + d] += c.n;
      r.setNodeMarkup(r.mapping.map(n + 1 + c.pos), null, bn(h, h.colspan - c.n, c.n));
    } else if (c.type == "missing") o[c.row] += c.n;
    else if (c.type == "overlong_rowspan") {
      const u = e.nodeAt(c.pos);
      if (!u) continue;
      r.setNodeMarkup(r.mapping.map(n + 1 + c.pos), null, {
        ...u.attrs,
        rowspan: u.attrs.rowspan - c.n
      });
    } else if (c.type == "colwidth mismatch") {
      const u = e.nodeAt(c.pos);
      if (!u) continue;
      r.setNodeMarkup(r.mapping.map(n + 1 + c.pos), null, {
        ...u.attrs,
        colwidth: c.colwidth
      });
    } else if (c.type == "zero_sized") {
      const u = r.mapping.map(n);
      r.delete(u, u + e.nodeSize);
    }
  }
  let s, l;
  for (let a = 0; a < o.length; a++) o[a] && (s == null && (s = a), l = a);
  for (let a = 0, c = n + 1; a < i.height; a++) {
    const u = e.child(a), h = c + u.nodeSize, d = o[a];
    if (d > 0) {
      let f = "cell";
      u.firstChild && (f = u.firstChild.type.spec.tableRole);
      const p = [];
      for (let y = 0; y < d; y++) {
        const g = qe(t.schema)[f].createAndFill();
        g && p.push(g);
      }
      const m = (a == 0 || s == a - 1) && l == a ? c + 1 : h - 1;
      r.insert(r.mapping.map(m), p);
    }
    c = h;
  }
  return r.setMeta(fC, { fixTables: !0 });
}
function cp(t) {
  const e = Y.get(t), n = [], r = e.height, i = e.width;
  for (let o = 0; o < r; o++) {
    const s = [];
    for (let l = 0; l < i; l++) {
      const a = o * i + l, c = e.map[a];
      if (o > 0) {
        const u = a - i;
        if (c === e.map[u]) {
          s.push(null);
          continue;
        }
      }
      if (l > 0) {
        const u = a - 1;
        if (c === e.map[u]) {
          s.push(null);
          continue;
        }
      }
      s.push(t.nodeAt(c));
    }
    n.push(s);
  }
  return n;
}
function up(t, e) {
  const n = [], r = Y.get(t), i = r.height, o = r.width;
  for (let s = 0; s < i; s++) {
    const l = t.child(s), a = [];
    for (let u = 0; u < o; u++) {
      const h = e[s][u];
      if (!h) continue;
      const d = r.map[s * r.width + u], f = t.nodeAt(d);
      if (!f) continue;
      const p = f.type.createChecked(h.attrs, h.content, h.marks);
      a.push(p);
    }
    const c = l.type.createChecked(l.attrs, a, l.marks);
    n.push(c);
  }
  return t.type.createChecked(t.attrs, n, t.marks);
}
function hp(t, e, n, r) {
  const i = e[0] > n[0] ? -1 : 1, o = t.splice(e[0], e.length), s = o.length % 2 === 0 ? 1 : 0;
  let l;
  return l = i === -1 ? n[0] : n[n.length - 1] - s, t.splice(l, 0, ...o), t;
}
function Kr(t) {
  return mC((e) => e.type.spec.tableRole === "table", t);
}
function mC(t, e) {
  for (let n = e.depth; n >= 0; n -= 1) {
    const r = e.node(n);
    if (t(r)) return {
      node: r,
      pos: n === 0 ? 0 : e.before(n),
      start: e.start(n),
      depth: n
    };
  }
  return null;
}
function In(t, e) {
  const n = Kr(e.$from);
  if (!n) return;
  const r = Y.get(n.node);
  if (!(t < 0 || t > r.width - 1))
    return r.cellsInRect({
      left: t,
      right: t + 1,
      top: 0,
      bottom: r.height
    }).map((i) => {
      const o = n.node.nodeAt(i), s = i + n.start;
      return {
        pos: s,
        start: s + 1,
        node: o,
        depth: n.depth + 2
      };
    });
}
function En(t, e) {
  const n = Kr(e.$from);
  if (!n) return;
  const r = Y.get(n.node);
  if (!(t < 0 || t > r.height - 1))
    return r.cellsInRect({
      left: 0,
      right: r.width,
      top: t,
      bottom: t + 1
    }).map((i) => {
      const o = n.node.nodeAt(i), s = i + n.start;
      return {
        pos: s,
        start: s + 1,
        node: o,
        depth: n.depth + 2
      };
    });
}
function Mu(t, e, n = e) {
  let r = e, i = n;
  for (let u = e; u >= 0; u--) {
    const h = In(u, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.colspan + u - 1;
      f >= r && (r = u), f > i && (i = f);
    });
  }
  for (let u = e; u <= i; u++) {
    const h = In(u, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.colspan + u - 1;
      d.node.attrs.colspan > 1 && f > i && (i = f);
    });
  }
  const o = [];
  for (let u = r; u <= i; u++) {
    const h = In(u, t.selection);
    h && h.length > 0 && o.push(u);
  }
  r = o[0], i = o[o.length - 1];
  const s = In(r, t.selection), l = En(0, t.selection);
  if (!s || !l) return;
  const a = t.doc.resolve(s[s.length - 1].pos);
  let c;
  for (let u = i; u >= r; u--) {
    const h = In(u, t.selection);
    if (h && h.length > 0) {
      for (let d = l.length - 1; d >= 0; d--) if (l[d].pos === h[0].pos) {
        c = h[0];
        break;
      }
      if (c) break;
    }
  }
  if (c)
    return {
      $anchor: a,
      $head: t.doc.resolve(c.pos),
      indexes: o
    };
}
function Tu(t, e, n = e) {
  let r = e, i = n;
  for (let u = e; u >= 0; u--) {
    const h = En(u, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.rowspan + u - 1;
      f >= r && (r = u), f > i && (i = f);
    });
  }
  for (let u = e; u <= i; u++) {
    const h = En(u, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.rowspan + u - 1;
      d.node.attrs.rowspan > 1 && f > i && (i = f);
    });
  }
  const o = [];
  for (let u = r; u <= i; u++) {
    const h = En(u, t.selection);
    h && h.length > 0 && o.push(u);
  }
  r = o[0], i = o[o.length - 1];
  const s = En(r, t.selection), l = In(0, t.selection);
  if (!s || !l) return;
  const a = t.doc.resolve(s[s.length - 1].pos);
  let c;
  for (let u = i; u >= r; u--) {
    const h = En(u, t.selection);
    if (h && h.length > 0) {
      for (let d = l.length - 1; d >= 0; d--) if (l[d].pos === h[0].pos) {
        c = h[0];
        break;
      }
      if (c) break;
    }
  }
  if (c)
    return {
      $anchor: a,
      $head: t.doc.resolve(c.pos),
      indexes: o
    };
}
function Au(t) {
  return t[0].map((e, n) => t.map((r) => r[n]));
}
function gC(t) {
  var e, n;
  const { tr: r, originIndex: i, targetIndex: o, select: s, pos: l } = t, a = Kr(r.doc.resolve(l));
  if (!a) return !1;
  const c = (e = Mu(r, i)) === null || e === void 0 ? void 0 : e.indexes, u = (n = Mu(r, o)) === null || n === void 0 ? void 0 : n.indexes;
  if (!c || !u || c.includes(o)) return !1;
  const h = yC(a.node, c, u);
  if (r.replaceWith(a.pos, a.pos + a.node.nodeSize, h), !s) return !0;
  const d = Y.get(h), f = a.start, p = o, m = d.positionAt(d.height - 1, p, h), y = r.doc.resolve(f + m), g = d.positionAt(0, p, h), N = r.doc.resolve(f + g);
  return r.setSelection(te.colSelection(y, N)), !0;
}
function yC(t, e, n, r) {
  let i = Au(cp(t));
  return i = hp(i, e, n), i = Au(i), up(t, i);
}
function kC(t) {
  var e, n;
  const { tr: r, originIndex: i, targetIndex: o, select: s, pos: l } = t, a = Kr(r.doc.resolve(l));
  if (!a) return !1;
  const c = (e = Tu(r, i)) === null || e === void 0 ? void 0 : e.indexes, u = (n = Tu(r, o)) === null || n === void 0 ? void 0 : n.indexes;
  if (!c || !u || c.includes(o)) return !1;
  const h = bC(a.node, c, u);
  if (r.replaceWith(a.pos, a.pos + a.node.nodeSize, h), !s) return !0;
  const d = Y.get(h), f = a.start, p = o, m = d.positionAt(p, d.width - 1, h), y = r.doc.resolve(f + m), g = d.positionAt(p, 0, h), N = r.doc.resolve(f + g);
  return r.setSelection(te.rowSelection(y, N)), !0;
}
function bC(t, e, n, r) {
  let i = cp(t);
  return i = hp(i, e, n), up(t, i);
}
function Qt(t) {
  const e = t.selection, n = so(t), r = n.node(-1), i = n.start(-1), o = Y.get(r);
  return {
    ...e instanceof te ? o.rectBetween(e.$anchorCell.pos - i, e.$headCell.pos - i) : o.findCell(n.pos - i),
    tableStart: i,
    map: o,
    table: r
  };
}
function fp(t, { map: e, tableStart: n, table: r }, i) {
  let o = i > 0 ? -1 : 0;
  sC(e, r, i + o) && (o = i == 0 || i == e.width ? null : 0);
  for (let s = 0; s < e.height; s++) {
    const l = s * e.width + i;
    if (i > 0 && i < e.width && e.map[l - 1] == e.map[l]) {
      const a = e.map[l], c = r.nodeAt(a);
      t.setNodeMarkup(t.mapping.map(n + a), null, oC(c.attrs, i - e.colCount(a))), s += c.attrs.rowspan - 1;
    } else {
      const a = o == null ? qe(r.type.schema).cell : r.nodeAt(e.map[l + o]).type, c = e.positionAt(s, i, r);
      t.insert(t.mapping.map(n + c), a.createAndFill());
    }
  }
  return t;
}
function xC(t, e) {
  if (!Ue(t)) return !1;
  if (e) {
    const n = Qt(t);
    e(fp(t.tr, n, n.left));
  }
  return !0;
}
function wC(t, e) {
  if (!Ue(t)) return !1;
  if (e) {
    const n = Qt(t);
    e(fp(t.tr, n, n.right));
  }
  return !0;
}
function CC(t, { map: e, table: n, tableStart: r }, i) {
  const o = t.mapping.maps.length;
  for (let s = 0; s < e.height; ) {
    const l = s * e.width + i, a = e.map[l], c = n.nodeAt(a), u = c.attrs;
    if (i > 0 && e.map[l - 1] == a || i < e.width - 1 && e.map[l + 1] == a) t.setNodeMarkup(t.mapping.slice(o).map(r + a), null, bn(u, i - e.colCount(a)));
    else {
      const h = t.mapping.slice(o).map(r + a);
      t.delete(h, h + c.nodeSize);
    }
    s += u.rowspan;
  }
}
function SC(t, e) {
  if (!Ue(t)) return !1;
  if (e) {
    const n = Qt(t), r = t.tr;
    if (n.left == 0 && n.right == n.map.width) return !1;
    for (let i = n.right - 1; CC(r, n, i), i != n.left; i--) {
      const o = n.tableStart ? r.doc.nodeAt(n.tableStart - 1) : r.doc;
      if (!o) throw new RangeError("No table found");
      n.table = o, n.map = Y.get(o);
    }
    e(r);
  }
  return !0;
}
function NC(t, { map: e, table: n, tableStart: r }, i) {
  let o = 0;
  for (let c = 0; c < i; c++) o += n.child(c).nodeSize;
  const s = o + n.child(i).nodeSize, l = t.mapping.maps.length;
  t.delete(o + r, s + r);
  const a = /* @__PURE__ */ new Set();
  for (let c = 0, u = i * e.width; c < e.width; c++, u++) {
    const h = e.map[u];
    if (!a.has(h)) {
      if (a.add(h), i > 0 && h == e.map[u - e.width]) {
        const d = n.nodeAt(h).attrs;
        t.setNodeMarkup(t.mapping.slice(l).map(h + r), null, {
          ...d,
          rowspan: d.rowspan - 1
        }), c += d.colspan - 1;
      } else if (i < e.height && h == e.map[u + e.width]) {
        const d = n.nodeAt(h), f = d.attrs, p = d.type.create({
          ...f,
          rowspan: d.attrs.rowspan - 1
        }, d.content), m = e.positionAt(i + 1, c, n);
        t.insert(t.mapping.slice(l).map(r + m), p), c += f.colspan - 1;
      }
    }
  }
}
function MC(t, e) {
  if (!Ue(t)) return !1;
  if (e) {
    const n = Qt(t), r = t.tr;
    if (n.top == 0 && n.bottom == n.map.height) return !1;
    for (let i = n.bottom - 1; NC(r, n, i), i != n.top; i--) {
      const o = n.tableStart ? r.doc.nodeAt(n.tableStart - 1) : r.doc;
      if (!o) throw new RangeError("No table found");
      n.table = o, n.map = Y.get(n.table);
    }
    e(r);
  }
  return !0;
}
function TC(t, e) {
  return function(n, r) {
    if (!Ue(n)) return !1;
    const i = so(n);
    if (i.nodeAfter.attrs[t] === e) return !1;
    if (r) {
      const o = n.tr;
      n.selection instanceof te ? n.selection.forEachCell((s, l) => {
        s.attrs[t] !== e && o.setNodeMarkup(l, null, {
          ...s.attrs,
          [t]: e
        });
      }) : o.setNodeMarkup(i.pos, null, {
        ...i.nodeAfter.attrs,
        [t]: e
      }), r(o);
    }
    return !0;
  };
}
function AC(t) {
  return function(e, n) {
    if (!Ue(e)) return !1;
    if (n) {
      const r = qe(e.schema), i = Qt(e), o = e.tr, s = i.map.cellsInRect(t == "column" ? {
        left: i.left,
        top: 0,
        right: i.right,
        bottom: i.map.height
      } : t == "row" ? {
        left: 0,
        top: i.top,
        right: i.map.width,
        bottom: i.bottom
      } : i), l = s.map((a) => i.table.nodeAt(a));
      for (let a = 0; a < s.length; a++) l[a].type == r.header_cell && o.setNodeMarkup(i.tableStart + s[a], r.cell, l[a].attrs);
      if (o.steps.length === 0) for (let a = 0; a < s.length; a++) o.setNodeMarkup(i.tableStart + s[a], r.header_cell, l[a].attrs);
      n(o);
    }
    return !0;
  };
}
function Iu(t, e, n) {
  const r = e.map.cellsInRect({
    left: 0,
    top: 0,
    right: t == "row" ? e.map.width : 1,
    bottom: t == "column" ? e.map.height : 1
  });
  for (let i = 0; i < r.length; i++) {
    const o = e.table.nodeAt(r[i]);
    if (o && o.type !== n.header_cell) return !1;
  }
  return !0;
}
function Na(t, e) {
  return e = e || { useDeprecatedLogic: !1 }, e.useDeprecatedLogic ? AC(t) : function(n, r) {
    if (!Ue(n)) return !1;
    if (r) {
      const i = qe(n.schema), o = Qt(n), s = n.tr, l = Iu("row", o, i), a = Iu("column", o, i), c = (t === "column" ? l : t === "row" && a) ? 1 : 0, u = t == "column" ? {
        left: 0,
        top: c,
        right: 1,
        bottom: o.map.height
      } : t == "row" ? {
        left: c,
        top: 0,
        right: o.map.width,
        bottom: 1
      } : o, h = t == "column" ? a ? i.cell : i.header_cell : t == "row" ? l ? i.cell : i.header_cell : i.cell;
      o.map.cellsInRect(u).forEach((d) => {
        const f = d + o.tableStart, p = s.doc.nodeAt(f);
        p && s.setNodeMarkup(f, h, p.attrs);
      }), r(s);
    }
    return !0;
  };
}
Na("row", { useDeprecatedLogic: !0 });
Na("column", { useDeprecatedLogic: !0 });
Na("cell", { useDeprecatedLogic: !0 });
function IC(t, e) {
  if (e < 0) {
    const n = t.nodeBefore;
    if (n) return t.pos - n.nodeSize;
    for (let r = t.index(-1) - 1, i = t.before(); r >= 0; r--) {
      const o = t.node(-1).child(r), s = o.lastChild;
      if (s) return i - 1 - s.nodeSize;
      i -= o.nodeSize;
    }
  } else {
    if (t.index() < t.parent.childCount - 1) return t.pos + t.nodeAfter.nodeSize;
    const n = t.node(-1);
    for (let r = t.indexAfter(-1), i = t.after(); r < n.childCount; r++) {
      const o = n.child(r);
      if (o.childCount) return i + 1;
      i += o.nodeSize;
    }
  }
  return null;
}
function dp(t) {
  return function(e, n) {
    if (!Ue(e)) return !1;
    const r = IC(so(e), t);
    if (r == null) return !1;
    if (n) {
      const i = e.doc.resolve(r);
      n(e.tr.setSelection(V.between(i, iC(i))).scrollIntoView());
    }
    return !0;
  };
}
function EC(t, e) {
  const n = t.selection.$anchor;
  for (let r = n.depth; r > 0; r--) if (n.node(r).type.spec.tableRole == "table")
    return e && e(t.tr.delete(n.before(r), n.after(r)).scrollIntoView()), !0;
  return !1;
}
function ii(t, e) {
  const n = t.selection;
  if (!(n instanceof te)) return !1;
  if (e) {
    const r = t.tr, i = qe(t.schema).cell.createAndFill().content;
    n.forEachCell((o, s) => {
      o.content.eq(i) || r.replace(r.mapping.map(s + 1), r.mapping.map(s + o.nodeSize - 1), new E(i, 0, 0));
    }), r.docChanged && e(r);
  }
  return !0;
}
function OC(t) {
  return (e, n) => {
    const { from: r, to: i, select: o = !0, pos: s = e.selection.from } = t, l = e.tr;
    return kC({
      tr: l,
      originIndex: r,
      targetIndex: i,
      select: o,
      pos: s
    }) ? (n?.(l), !0) : !1;
  };
}
function vC(t) {
  return (e, n) => {
    const { from: r, to: i, select: o = !0, pos: s = e.selection.from } = t, l = e.tr;
    return gC({
      tr: l,
      originIndex: r,
      targetIndex: i,
      select: o,
      pos: s
    }) ? (n?.(l), !0) : !1;
  };
}
function DC(t) {
  if (t.size === 0) return null;
  let { content: e, openStart: n, openEnd: r } = t;
  for (; e.childCount == 1 && (n > 0 && r > 0 || e.child(0).type.spec.tableRole == "table"); )
    n--, r--, e = e.child(0).content;
  const i = e.child(0), o = i.type.spec.tableRole, s = i.type.schema, l = [];
  if (o == "row") for (let a = 0; a < e.childCount; a++) {
    let c = e.child(a).content;
    const u = a ? 0 : Math.max(0, n - 1), h = a < e.childCount - 1 ? 0 : Math.max(0, r - 1);
    (u || h) && (c = qs(qe(s).row, new E(c, u, h)).content), l.push(c);
  }
  else if (o == "cell" || o == "header_cell") l.push(n || r ? qs(qe(s).row, new E(e, n, r)).content : e);
  else return null;
  return RC(s, l);
}
function RC(t, e) {
  const n = [];
  for (let i = 0; i < e.length; i++) {
    const o = e[i];
    for (let s = o.childCount - 1; s >= 0; s--) {
      const { rowspan: l, colspan: a } = o.child(s).attrs;
      for (let c = i; c < i + l; c++) n[c] = (n[c] || 0) + a;
    }
  }
  let r = 0;
  for (let i = 0; i < n.length; i++) r = Math.max(r, n[i]);
  for (let i = 0; i < n.length; i++)
    if (i >= e.length && e.push(T.empty), n[i] < r) {
      const o = qe(t).cell.createAndFill(), s = [];
      for (let l = n[i]; l < r; l++) s.push(o);
      e[i] = e[i].append(T.from(s));
    }
  return {
    height: e.length,
    width: r,
    rows: e
  };
}
function qs(t, e) {
  const n = t.createAndFill();
  return new kf(n).replace(0, n.content.size, e).doc;
}
function zC({ width: t, height: e, rows: n }, r, i) {
  if (t != r) {
    const o = [], s = [];
    for (let l = 0; l < n.length; l++) {
      const a = n[l], c = [];
      for (let u = o[l] || 0, h = 0; u < r; h++) {
        let d = a.child(h % a.childCount);
        u + d.attrs.colspan > r && (d = d.type.createChecked(bn(d.attrs, d.attrs.colspan, u + d.attrs.colspan - r), d.content)), c.push(d), u += d.attrs.colspan;
        for (let f = 1; f < d.attrs.rowspan; f++) o[l + f] = (o[l + f] || 0) + d.attrs.colspan;
      }
      s.push(T.from(c));
    }
    n = s, t = r;
  }
  if (e != i) {
    const o = [];
    for (let s = 0, l = 0; s < i; s++, l++) {
      const a = [], c = n[l % e];
      for (let u = 0; u < c.childCount; u++) {
        let h = c.child(u);
        s + h.attrs.rowspan > i && (h = h.type.create({
          ...h.attrs,
          rowspan: Math.max(1, i - h.attrs.rowspan)
        }, h.content)), a.push(h);
      }
      o.push(T.from(a));
    }
    n = o, e = i;
  }
  return {
    width: t,
    height: e,
    rows: n
  };
}
function PC(t, e, n, r, i, o, s) {
  const l = t.doc.type.schema, a = qe(l);
  let c, u;
  if (i > e.width) for (let h = 0, d = 0; h < e.height; h++) {
    const f = n.child(h);
    d += f.nodeSize;
    const p = [];
    let m;
    f.lastChild == null || f.lastChild.type == a.cell ? m = c || (c = a.cell.createAndFill()) : m = u || (u = a.header_cell.createAndFill());
    for (let y = e.width; y < i; y++) p.push(m);
    t.insert(t.mapping.slice(s).map(d - 1 + r), p);
  }
  if (o > e.height) {
    const h = [];
    for (let p = 0, m = (e.height - 1) * e.width; p < Math.max(e.width, i); p++) {
      const y = p >= e.width ? !1 : n.nodeAt(e.map[m + p]).type == a.header_cell;
      h.push(y ? u || (u = a.header_cell.createAndFill()) : c || (c = a.cell.createAndFill()));
    }
    const d = a.row.create(null, T.from(h)), f = [];
    for (let p = e.height; p < o; p++) f.push(d);
    t.insert(t.mapping.slice(s).map(r + n.nodeSize - 2), f);
  }
  return !!(c || u);
}
function Eu(t, e, n, r, i, o, s, l) {
  if (s == 0 || s == e.height) return !1;
  let a = !1;
  for (let c = i; c < o; c++) {
    const u = s * e.width + c, h = e.map[u];
    if (e.map[u - e.width] == h) {
      a = !0;
      const d = n.nodeAt(h), { top: f, left: p } = e.findCell(h);
      t.setNodeMarkup(t.mapping.slice(l).map(h + r), null, {
        ...d.attrs,
        rowspan: s - f
      }), t.insert(t.mapping.slice(l).map(e.positionAt(s, p, n)), d.type.createAndFill({
        ...d.attrs,
        rowspan: f + d.attrs.rowspan - s
      })), c += d.attrs.colspan - 1;
    }
  }
  return a;
}
function Ou(t, e, n, r, i, o, s, l) {
  if (s == 0 || s == e.width) return !1;
  let a = !1;
  for (let c = i; c < o; c++) {
    const u = c * e.width + s, h = e.map[u];
    if (e.map[u - 1] == h) {
      a = !0;
      const d = n.nodeAt(h), f = e.colCount(h), p = t.mapping.slice(l).map(h + r);
      t.setNodeMarkup(p, null, bn(d.attrs, s - f, d.attrs.colspan - (s - f))), t.insert(p + d.nodeSize, d.type.createAndFill(bn(d.attrs, 0, s - f))), c += d.attrs.rowspan - 1;
    }
  }
  return a;
}
function vu(t, e, n, r, i) {
  let o = n ? t.doc.nodeAt(n - 1) : t.doc;
  if (!o) throw new Error("No table found");
  let s = Y.get(o);
  const { top: l, left: a } = r, c = a + i.width, u = l + i.height, h = t.tr;
  let d = 0;
  function f() {
    if (o = n ? h.doc.nodeAt(n - 1) : h.doc, !o) throw new Error("No table found");
    s = Y.get(o), d = h.mapping.maps.length;
  }
  PC(h, s, o, n, c, u, d) && f(), Eu(h, s, o, n, a, c, l, d) && f(), Eu(h, s, o, n, a, c, u, d) && f(), Ou(h, s, o, n, l, u, a, d) && f(), Ou(h, s, o, n, l, u, c, d) && f();
  for (let p = l; p < u; p++) {
    const m = s.positionAt(p, a, o), y = s.positionAt(p, c, o);
    h.replace(h.mapping.slice(d).map(m + n), h.mapping.slice(d).map(y + n), new E(i.rows[p - l], 0, 0));
  }
  f(), h.setSelection(new te(h.doc.resolve(n + s.positionAt(l, a, o)), h.doc.resolve(n + s.positionAt(u - 1, c - 1, o)))), e(h);
}
const LC = Rf({
  ArrowLeft: oi("horiz", -1),
  ArrowRight: oi("horiz", 1),
  ArrowUp: oi("vert", -1),
  ArrowDown: oi("vert", 1),
  "Shift-ArrowLeft": si("horiz", -1),
  "Shift-ArrowRight": si("horiz", 1),
  "Shift-ArrowUp": si("vert", -1),
  "Shift-ArrowDown": si("vert", 1),
  Backspace: ii,
  "Mod-Backspace": ii,
  Delete: ii,
  "Mod-Delete": ii
});
function Ci(t, e, n) {
  return n.eq(t.selection) ? !1 : (e && e(t.tr.setSelection(n).scrollIntoView()), !0);
}
function oi(t, e) {
  return (n, r, i) => {
    if (!i) return !1;
    const o = n.selection;
    if (o instanceof te) return Ci(n, r, $.near(o.$headCell, e));
    if (t != "horiz" && !o.empty) return !1;
    const s = pp(i, t, e);
    if (s == null) return !1;
    if (t == "horiz") return Ci(n, r, $.near(n.doc.resolve(o.head + e), e));
    {
      const l = n.doc.resolve(s), a = sp(l, t, e);
      let c;
      return a ? c = $.near(a, 1) : e < 0 ? c = $.near(n.doc.resolve(l.before(-1)), -1) : c = $.near(n.doc.resolve(l.after(-1)), 1), Ci(n, r, c);
    }
  };
}
function si(t, e) {
  return (n, r, i) => {
    if (!i) return !1;
    const o = n.selection;
    let s;
    if (o instanceof te) s = o;
    else {
      const a = pp(i, t, e);
      if (a == null) return !1;
      s = new te(n.doc.resolve(a));
    }
    const l = sp(s.$headCell, t, e);
    return l ? Ci(n, r, new te(s.$anchorCell, l)) : !1;
  };
}
function BC(t, e) {
  const n = t.state.doc, r = Fn(n.resolve(e));
  return r ? (t.dispatch(t.state.tr.setSelection(new te(r))), !0) : !1;
}
function FC(t, e, n) {
  if (!Ue(t.state)) return !1;
  let r = DC(n);
  const i = t.state.selection;
  if (i instanceof te) {
    r || (r = {
      width: 1,
      height: 1,
      rows: [T.from(qs(qe(t.state.schema).cell, n))]
    });
    const o = i.$anchorCell.node(-1), s = i.$anchorCell.start(-1), l = Y.get(o).rectBetween(i.$anchorCell.pos - s, i.$headCell.pos - s);
    return r = zC(r, l.right - l.left, l.bottom - l.top), vu(t.state, t.dispatch, s, l, r), !0;
  } else if (r) {
    const o = so(t.state), s = o.start(-1);
    return vu(t.state, t.dispatch, s, Y.get(o.node(-1)).findCell(o.pos - s), r), !0;
  } else return !1;
}
function _C(t, e) {
  var n;
  if (e.button != 0 || e.ctrlKey || e.metaKey) return;
  const r = Du(t, e.target);
  let i;
  if (e.shiftKey && t.state.selection instanceof te)
    o(t.state.selection.$anchorCell, e), e.preventDefault();
  else if (e.shiftKey && r && (i = Fn(t.state.selection.$anchor)) != null && ((n = Ko(t, e)) === null || n === void 0 ? void 0 : n.pos) != i.pos)
    o(i, e), e.preventDefault();
  else if (!r) return;
  function o(a, c) {
    let u = Ko(t, c);
    const h = Ft.getState(t.state) == null;
    if (!u || !Sa(a, u)) if (h) u = a;
    else return;
    const d = new te(a, u);
    if (h || !t.state.selection.eq(d)) {
      const f = t.state.tr.setSelection(d);
      h && f.setMeta(Ft, a.pos), t.dispatch(f);
    }
  }
  function s() {
    t.root.removeEventListener("mouseup", s), t.root.removeEventListener("dragstart", s), t.root.removeEventListener("mousemove", l), Ft.getState(t.state) != null && t.dispatch(t.state.tr.setMeta(Ft, -1));
  }
  function l(a) {
    const c = a, u = Ft.getState(t.state);
    let h;
    if (u != null) h = t.state.doc.resolve(u);
    else if (Du(t, c.target) != r && (h = Ko(t, e), !h))
      return s();
    h && o(h, c);
  }
  t.root.addEventListener("mouseup", s), t.root.addEventListener("dragstart", s), t.root.addEventListener("mousemove", l);
}
function pp(t, e, n) {
  if (!(t.state.selection instanceof V)) return null;
  const { $head: r } = t.state.selection;
  for (let i = r.depth - 1; i >= 0; i--) {
    const o = r.node(i);
    if ((n < 0 ? r.index(i) : r.indexAfter(i)) != (n < 0 ? 0 : o.childCount)) return null;
    if (o.type.spec.tableRole == "cell" || o.type.spec.tableRole == "header_cell") {
      const s = r.before(i), l = e == "vert" ? n > 0 ? "down" : "up" : n > 0 ? "right" : "left";
      return t.endOfTextblock(l) ? s : null;
    }
  }
  return null;
}
function Du(t, e) {
  for (; e && e != t.dom; e = e.parentNode) if (e.nodeName == "TD" || e.nodeName == "TH") return e;
  return null;
}
function Ko(t, e) {
  const n = t.posAtCoords({
    left: e.clientX,
    top: e.clientY
  });
  if (!n) return null;
  let { inside: r, pos: i } = n;
  return r >= 0 && Fn(t.state.doc.resolve(r)) || Fn(t.state.doc.resolve(i));
}
var $C = class {
  constructor(t, e) {
    this.node = t, this.defaultCellMinWidth = e, this.dom = document.createElement("div"), this.dom.className = "tableWrapper", this.table = this.dom.appendChild(document.createElement("table")), this.table.style.setProperty("--default-cell-min-width", `${e}px`), this.colgroup = this.table.appendChild(document.createElement("colgroup")), Ws(t, this.colgroup, this.table, e), this.contentDOM = this.table.appendChild(document.createElement("tbody"));
  }
  update(t) {
    return t.type != this.node.type ? !1 : (this.node = t, Ws(t, this.colgroup, this.table, this.defaultCellMinWidth), !0);
  }
  ignoreMutation(t) {
    return t.type == "attributes" && (t.target == this.table || this.colgroup.contains(t.target));
  }
};
function Ws(t, e, n, r, i, o) {
  let s = 0, l = !0, a = e.firstChild;
  const c = t.firstChild;
  if (c) {
    for (let h = 0, d = 0; h < c.childCount; h++) {
      const { colspan: f, colwidth: p } = c.child(h).attrs;
      for (let m = 0; m < f; m++, d++) {
        const y = i == d ? o : p && p[m], g = y ? y + "px" : "";
        if (s += y || r, y || (l = !1), a)
          a.style.width != g && (a.style.width = g), a = a.nextSibling;
        else {
          const N = document.createElement("col");
          N.style.width = g, e.appendChild(N);
        }
      }
    }
    for (; a; ) {
      var u;
      const h = a.nextSibling;
      (u = a.parentNode) === null || u === void 0 || u.removeChild(a), a = h;
    }
    l ? (n.style.width = s + "px", n.style.minWidth = "") : (n.style.width = "", n.style.minWidth = s + "px");
  }
}
const Pe = new ve("tableColumnResizing");
function VC({ handleWidth: t = 5, cellMinWidth: e = 25, defaultCellMinWidth: n = 100, View: r = $C, lastColumnResizable: i = !0 } = {}) {
  const o = new Oe({
    key: Pe,
    state: {
      init(s, l) {
        var a;
        const c = (a = o.spec) === null || a === void 0 || (a = a.props) === null || a === void 0 ? void 0 : a.nodeViews, u = qe(l.schema).table.name;
        return r && c && (c[u] = (h, d) => new r(h, n, d)), new HC(-1, !1);
      },
      apply(s, l) {
        return l.apply(s);
      }
    },
    props: {
      attributes: (s) => {
        const l = Pe.getState(s);
        return l && l.activeHandle > -1 ? { class: "resize-cursor" } : {};
      },
      handleDOMEvents: {
        mousemove: (s, l) => {
          jC(s, l, t, i);
        },
        mouseleave: (s) => {
          qC(s);
        },
        mousedown: (s, l) => {
          WC(s, l, e, n);
        }
      },
      decorations: (s) => {
        const l = Pe.getState(s);
        if (l && l.activeHandle > -1) return YC(s, l.activeHandle);
      },
      nodeViews: {}
    }
  });
  return o;
}
var HC = class Si {
  constructor(e, n) {
    this.activeHandle = e, this.dragging = n;
  }
  apply(e) {
    const n = this, r = e.getMeta(Pe);
    if (r && r.setHandle != null) return new Si(r.setHandle, !1);
    if (r && r.setDragging !== void 0) return new Si(n.activeHandle, r.setDragging);
    if (n.activeHandle > -1 && e.docChanged) {
      let i = e.mapping.map(n.activeHandle, -1);
      return js(e.doc.resolve(i)) || (i = -1), new Si(i, n.dragging);
    }
    return n;
  }
};
function jC(t, e, n, r) {
  if (!t.editable) return;
  const i = Pe.getState(t.state);
  if (i && !i.dragging) {
    const o = UC(e.target);
    let s = -1;
    if (o) {
      const { left: l, right: a } = o.getBoundingClientRect();
      e.clientX - l <= n ? s = Ru(t, e, "left", n) : a - e.clientX <= n && (s = Ru(t, e, "right", n));
    }
    if (s != i.activeHandle) {
      if (!r && s !== -1) {
        const l = t.state.doc.resolve(s), a = l.node(-1), c = Y.get(a), u = l.start(-1);
        if (c.colCount(l.pos - u) + l.nodeAfter.attrs.colspan - 1 == c.width - 1) return;
      }
      mp(t, s);
    }
  }
}
function qC(t) {
  if (!t.editable) return;
  const e = Pe.getState(t.state);
  e && e.activeHandle > -1 && !e.dragging && mp(t, -1);
}
function WC(t, e, n, r) {
  var i;
  if (!t.editable) return !1;
  const o = (i = t.dom.ownerDocument.defaultView) !== null && i !== void 0 ? i : window, s = Pe.getState(t.state);
  if (!s || s.activeHandle == -1 || s.dragging) return !1;
  const l = t.state.doc.nodeAt(s.activeHandle), a = KC(t, s.activeHandle, l.attrs);
  t.dispatch(t.state.tr.setMeta(Pe, { setDragging: {
    startX: e.clientX,
    startWidth: a
  } }));
  function c(h) {
    o.removeEventListener("mouseup", c), o.removeEventListener("mousemove", u);
    const d = Pe.getState(t.state);
    d?.dragging && (JC(t, d.activeHandle, zu(d.dragging, h, n)), t.dispatch(t.state.tr.setMeta(Pe, { setDragging: null })));
  }
  function u(h) {
    if (!h.which) return c(h);
    const d = Pe.getState(t.state);
    if (d && d.dragging) {
      const f = zu(d.dragging, h, n);
      Pu(t, d.activeHandle, f, r);
    }
  }
  return Pu(t, s.activeHandle, a, r), o.addEventListener("mouseup", c), o.addEventListener("mousemove", u), e.preventDefault(), !0;
}
function KC(t, e, { colspan: n, colwidth: r }) {
  const i = r && r[r.length - 1];
  if (i) return i;
  const o = t.domAtPos(e);
  let s = o.node.childNodes[o.offset].offsetWidth, l = n;
  if (r)
    for (let a = 0; a < n; a++) r[a] && (s -= r[a], l--);
  return s / l;
}
function UC(t) {
  for (; t && t.nodeName != "TD" && t.nodeName != "TH"; ) t = t.classList && t.classList.contains("ProseMirror") ? null : t.parentNode;
  return t;
}
function Ru(t, e, n, r) {
  const i = n == "right" ? -r : r, o = t.posAtCoords({
    left: e.clientX + i,
    top: e.clientY
  });
  if (!o) return -1;
  const { pos: s } = o, l = Fn(t.state.doc.resolve(s));
  if (!l) return -1;
  if (n == "right") return l.pos;
  const a = Y.get(l.node(-1)), c = l.start(-1), u = a.map.indexOf(l.pos - c);
  return u % a.width == 0 ? -1 : c + a.map[u - 1];
}
function zu(t, e, n) {
  const r = e.clientX - t.startX;
  return Math.max(n, t.startWidth + r);
}
function mp(t, e) {
  t.dispatch(t.state.tr.setMeta(Pe, { setHandle: e }));
}
function JC(t, e, n) {
  const r = t.state.doc.resolve(e), i = r.node(-1), o = Y.get(i), s = r.start(-1), l = o.colCount(r.pos - s) + r.nodeAfter.attrs.colspan - 1, a = t.state.tr;
  for (let c = 0; c < o.height; c++) {
    const u = c * o.width + l;
    if (c && o.map[u] == o.map[u - o.width]) continue;
    const h = o.map[u], d = i.nodeAt(h).attrs, f = d.colspan == 1 ? 0 : l - o.colCount(h);
    if (d.colwidth && d.colwidth[f] == n) continue;
    const p = d.colwidth ? d.colwidth.slice() : GC(d.colspan);
    p[f] = n, a.setNodeMarkup(s + h, null, {
      ...d,
      colwidth: p
    });
  }
  a.docChanged && t.dispatch(a);
}
function Pu(t, e, n, r) {
  const i = t.state.doc.resolve(e), o = i.node(-1), s = i.start(-1), l = Y.get(o).colCount(i.pos - s) + i.nodeAfter.attrs.colspan - 1;
  let a = t.domAtPos(i.start(-1)).node;
  for (; a && a.nodeName != "TABLE"; ) a = a.parentNode;
  a && Ws(o, a.firstChild, a, r, l, n);
}
function GC(t) {
  return Array(t).fill(0);
}
function YC(t, e) {
  const n = [], r = t.doc.resolve(e), i = r.node(-1);
  if (!i) return ne.empty;
  const o = Y.get(i), s = r.start(-1), l = o.colCount(r.pos - s) + r.nodeAfter.attrs.colspan - 1;
  for (let c = 0; c < o.height; c++) {
    const u = l + c * o.width;
    if ((l == o.width - 1 || o.map[u] != o.map[u + 1]) && (c == 0 || o.map[u] != o.map[u - o.width])) {
      var a;
      const h = o.map[u], d = s + h + i.nodeAt(h).nodeSize - 1, f = document.createElement("div");
      f.className = "column-resize-handle", !((a = Pe.getState(t)) === null || a === void 0) && a.dragging && n.push(me.node(s + h, s + h + i.nodeAt(h).nodeSize, { class: "column-resize-dragging" })), n.push(me.widget(d, f));
    }
  }
  return ne.create(t.doc, n);
}
function QC({ allowTableNodeSelection: t = !1 } = {}) {
  return new Oe({
    key: Ft,
    state: {
      init() {
        return null;
      },
      apply(e, n) {
        const r = e.getMeta(Ft);
        if (r != null) return r == -1 ? null : r;
        if (n == null || !e.docChanged) return n;
        const { deleted: i, pos: o } = e.mapping.mapResult(n);
        return i ? null : o;
      }
    },
    props: {
      decorations: aC,
      handleDOMEvents: { mousedown: _C },
      createSelectionBetween(e) {
        return Ft.getState(e.state) != null ? e.state.selection : null;
      },
      handleTripleClick: BC,
      handleKeyDown: LC,
      handlePaste: FC
    },
    appendTransaction(e, n, r) {
      return hC(r, dC(r, n), t);
    }
  });
}
var $i = typeof navigator < "u" ? navigator : null, Ma = $i && $i.userAgent || "", XC = /Edge\/(\d+)/.exec(Ma), ZC = /MSIE \d/.exec(Ma), eS = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(Ma), tS = !!(ZC || eS || XC), nS = !tS && !!$i && /Apple Computer/.test($i.vendor), gp = new ve("safari-ime-span"), Ks = !1, rS = {
  key: gp,
  props: {
    decorations: iS,
    handleDOMEvents: {
      compositionstart: () => {
        Ks = !0;
      },
      compositionend: () => {
        Ks = !1;
      }
    }
  }
};
function iS(t) {
  const { $from: e, $to: n, to: r } = t.selection;
  if (Ks && e.sameParent(n)) {
    const i = me.widget(r, oS, {
      ignoreSelection: !0,
      key: "safari-ime-span"
    });
    return ne.create(t.doc, [i]);
  }
}
function oS(t) {
  const e = t.dom.ownerDocument.createElement("span");
  return e.className = "ProseMirror-safari-ime-span", e;
}
var sS = new Oe(nS ? rS : { key: gp });
function Lu(t, e) {
  const n = String(t);
  if (typeof e != "string")
    throw new TypeError("Expected character");
  let r = 0, i = n.indexOf(e);
  for (; i !== -1; )
    r++, i = n.indexOf(e, i + e.length);
  return r;
}
function lS(t) {
  if (typeof t != "string")
    throw new TypeError("Expected a string");
  return t.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}
function aS(t, e, n) {
  const i = Ui((n || {}).ignore || []), o = cS(e);
  let s = -1;
  for (; ++s < o.length; )
    ol(t, "text", l);
  function l(c, u) {
    let h = -1, d;
    for (; ++h < u.length; ) {
      const f = u[h], p = d ? d.children : void 0;
      if (i(
        f,
        p ? p.indexOf(f) : void 0,
        d
      ))
        return;
      d = f;
    }
    if (d)
      return a(c, u);
  }
  function a(c, u) {
    const h = u[u.length - 1], d = o[s][0], f = o[s][1];
    let p = 0;
    const y = h.children.indexOf(c);
    let g = !1, N = [];
    d.lastIndex = 0;
    let w = d.exec(c.value);
    for (; w; ) {
      const O = w.index, v = {
        index: w.index,
        input: w.input,
        stack: [...u, c]
      };
      let x = f(...w, v);
      if (typeof x == "string" && (x = x.length > 0 ? { type: "text", value: x } : void 0), x === !1 ? d.lastIndex = O + 1 : (p !== O && N.push({
        type: "text",
        value: c.value.slice(p, O)
      }), Array.isArray(x) ? N.push(...x) : x && N.push(x), p = O + w[0].length, g = !0), !d.global)
        break;
      w = d.exec(c.value);
    }
    return g ? (p < c.value.length && N.push({ type: "text", value: c.value.slice(p) }), h.children.splice(y, 1, ...N)) : N = [c], y + N.length;
  }
}
function cS(t) {
  const e = [];
  if (!Array.isArray(t))
    throw new TypeError("Expected find and replace tuple or list of tuples");
  const n = !t[0] || Array.isArray(t[0]) ? t : [t];
  let r = -1;
  for (; ++r < n.length; ) {
    const i = n[r];
    e.push([uS(i[0]), hS(i[1])]);
  }
  return e;
}
function uS(t) {
  return typeof t == "string" ? new RegExp(lS(t), "g") : t;
}
function hS(t) {
  return typeof t == "function" ? t : function() {
    return t;
  };
}
const Uo = "phrasing", Jo = ["autolink", "link", "image", "label"];
function fS() {
  return {
    transforms: [bS],
    enter: {
      literalAutolink: pS,
      literalAutolinkEmail: Go,
      literalAutolinkHttp: Go,
      literalAutolinkWww: Go
    },
    exit: {
      literalAutolink: kS,
      literalAutolinkEmail: yS,
      literalAutolinkHttp: mS,
      literalAutolinkWww: gS
    }
  };
}
function dS() {
  return {
    unsafe: [
      {
        character: "@",
        before: "[+\\-.\\w]",
        after: "[\\-.\\w]",
        inConstruct: Uo,
        notInConstruct: Jo
      },
      {
        character: ".",
        before: "[Ww]",
        after: "[\\-.\\w]",
        inConstruct: Uo,
        notInConstruct: Jo
      },
      {
        character: ":",
        before: "[ps]",
        after: "\\/",
        inConstruct: Uo,
        notInConstruct: Jo
      }
    ]
  };
}
function pS(t) {
  this.enter({ type: "link", title: null, url: "", children: [] }, t);
}
function Go(t) {
  this.config.enter.autolinkProtocol.call(this, t);
}
function mS(t) {
  this.config.exit.autolinkProtocol.call(this, t);
}
function gS(t) {
  this.config.exit.data.call(this, t);
  const e = this.stack[this.stack.length - 1];
  e.type, e.url = "http://" + this.sliceSerialize(t);
}
function yS(t) {
  this.config.exit.autolinkEmail.call(this, t);
}
function kS(t) {
  this.exit(t);
}
function bS(t) {
  aS(
    t,
    [
      [/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi, xS],
      [new RegExp("(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)", "gu"), wS]
    ],
    { ignore: ["link", "linkReference"] }
  );
}
function xS(t, e, n, r, i) {
  let o = "";
  if (!yp(i) || (/^w/i.test(e) && (n = e + n, e = "", o = "http://"), !CS(n)))
    return !1;
  const s = SS(n + r);
  if (!s[0]) return !1;
  const l = {
    type: "link",
    title: null,
    url: o + e + s[0],
    children: [{ type: "text", value: e + s[0] }]
  };
  return s[1] ? [l, { type: "text", value: s[1] }] : l;
}
function wS(t, e, n, r) {
  return (
    // Not an expected previous character.
    !yp(r, !0) || // Label ends in not allowed character.
    /[-\d_]$/.test(n) ? !1 : {
      type: "link",
      title: null,
      url: "mailto:" + e + "@" + n,
      children: [{ type: "text", value: e + "@" + n }]
    }
  );
}
function CS(t) {
  const e = t.split(".");
  return !(e.length < 2 || e[e.length - 1] && (/_/.test(e[e.length - 1]) || !/[a-zA-Z\d]/.test(e[e.length - 1])) || e[e.length - 2] && (/_/.test(e[e.length - 2]) || !/[a-zA-Z\d]/.test(e[e.length - 2])));
}
function SS(t) {
  const e = /[!"&'),.:;<>?\]}]+$/.exec(t);
  if (!e)
    return [t, void 0];
  t = t.slice(0, e.index);
  let n = e[0], r = n.indexOf(")");
  const i = Lu(t, "(");
  let o = Lu(t, ")");
  for (; r !== -1 && i > o; )
    t += n.slice(0, r + 1), n = n.slice(r + 1), r = n.indexOf(")"), o++;
  return [t, n];
}
function yp(t, e) {
  const n = t.input.charCodeAt(t.index - 1);
  return (t.index === 0 || pn(n) || Wi(n)) && // If it’s an email, the previous character should not be a slash.
  (!e || n !== 47);
}
kp.peek = DS;
function NS() {
  this.buffer();
}
function MS(t) {
  this.enter({ type: "footnoteReference", identifier: "", label: "" }, t);
}
function TS() {
  this.buffer();
}
function AS(t) {
  this.enter(
    { type: "footnoteDefinition", identifier: "", label: "", children: [] },
    t
  );
}
function IS(t) {
  const e = this.resume(), n = this.stack[this.stack.length - 1];
  n.type, n.identifier = Ze(
    this.sliceSerialize(t)
  ).toLowerCase(), n.label = e;
}
function ES(t) {
  this.exit(t);
}
function OS(t) {
  const e = this.resume(), n = this.stack[this.stack.length - 1];
  n.type, n.identifier = Ze(
    this.sliceSerialize(t)
  ).toLowerCase(), n.label = e;
}
function vS(t) {
  this.exit(t);
}
function DS() {
  return "[";
}
function kp(t, e, n, r) {
  const i = n.createTracker(r);
  let o = i.move("[^");
  const s = n.enter("footnoteReference"), l = n.enter("reference");
  return o += i.move(
    n.safe(n.associationId(t), { after: "]", before: o })
  ), l(), s(), o += i.move("]"), o;
}
function RS() {
  return {
    enter: {
      gfmFootnoteCallString: NS,
      gfmFootnoteCall: MS,
      gfmFootnoteDefinitionLabelString: TS,
      gfmFootnoteDefinition: AS
    },
    exit: {
      gfmFootnoteCallString: IS,
      gfmFootnoteCall: ES,
      gfmFootnoteDefinitionLabelString: OS,
      gfmFootnoteDefinition: vS
    }
  };
}
function zS(t) {
  let e = !1;
  return t && t.firstLineBlank && (e = !0), {
    handlers: { footnoteDefinition: n, footnoteReference: kp },
    // This is on by default already.
    unsafe: [{ character: "[", inConstruct: ["label", "phrasing", "reference"] }]
  };
  function n(r, i, o, s) {
    const l = o.createTracker(s);
    let a = l.move("[^");
    const c = o.enter("footnoteDefinition"), u = o.enter("label");
    return a += l.move(
      o.safe(o.associationId(r), { before: a, after: "]" })
    ), u(), a += l.move("]:"), r.children && r.children.length > 0 && (l.shift(4), a += l.move(
      (e ? `
` : " ") + o.indentLines(
        o.containerFlow(r, l.current()),
        e ? bp : PS
      )
    )), c(), a;
  }
}
function PS(t, e, n) {
  return e === 0 ? t : bp(t, e, n);
}
function bp(t, e, n) {
  return (n ? "" : "    ") + t;
}
const LS = [
  "autolink",
  "destinationLiteral",
  "destinationRaw",
  "reference",
  "titleQuote",
  "titleApostrophe"
];
Ta.attention = VS;
Ta.peek = HS;
function BS() {
  return {
    canContainEols: ["delete"],
    enter: { strikethrough: _S },
    exit: { strikethrough: $S }
  };
}
function FS() {
  return {
    handlers: { delete: Ta },
    unsafe: [
      {
        character: "~",
        inConstruct: "phrasing",
        notInConstruct: LS
      }
    ]
  };
}
function _S(t) {
  this.enter({ type: "delete", children: [], position: void 0 }, t);
}
function $S(t) {
  this.exit(t);
}
function Ta(t, e, n, r) {
  const i = n.createTracker(r), o = n.stack.includes("strikethrough") ? "~" : "~~", s = n.enter("strikethrough");
  let l = i.move(o);
  return l += n.containerPhrasing(t, {
    ...i.current(),
    before: l,
    after: "~"
  }), l += i.move(o), s(), l;
}
function VS() {
  return { construct: "strikethrough", markers: ["~"], sizes: [2, 1] };
}
function HS() {
  return "~";
}
function jS(t) {
  return t.length;
}
function qS(t, e) {
  const n = e || {}, r = (n.align || []).concat(), i = n.stringLength || jS, o = [], s = [], l = [], a = [];
  let c = 0, u = -1;
  for (; ++u < t.length; ) {
    const m = [], y = [];
    let g = -1;
    for (t[u].length > c && (c = t[u].length); ++g < t[u].length; ) {
      const N = WS(t[u][g]);
      if (n.alignDelimiters !== !1) {
        const w = i(N);
        y[g] = w, (a[g] === void 0 || w > a[g]) && (a[g] = w);
      }
      m.push(N);
    }
    s[u] = m, l[u] = y;
  }
  let h = -1;
  if (typeof r == "object" && "length" in r)
    for (; ++h < c; )
      o[h] = Bu(r[h]);
  else {
    const m = Bu(r);
    for (; ++h < c; )
      o[h] = m;
  }
  h = -1;
  const d = [], f = [];
  for (; ++h < c; ) {
    const m = o[h];
    let y = "", g = "";
    m === 99 ? (y = ":", g = ":") : m === 108 ? y = ":" : m === 114 && (g = ":");
    let N = n.alignDelimiters === !1 ? 1 : Math.max(
      1,
      a[h] - y.length - g.length
    );
    const w = y + "-".repeat(N) + g;
    n.alignDelimiters !== !1 && (N = y.length + N + g.length, N > a[h] && (a[h] = N), f[h] = N), d[h] = w;
  }
  s.splice(1, 0, d), l.splice(1, 0, f), u = -1;
  const p = [];
  for (; ++u < s.length; ) {
    const m = s[u], y = l[u];
    h = -1;
    const g = [];
    for (; ++h < c; ) {
      const N = m[h] || "";
      let w = "", O = "";
      if (n.alignDelimiters !== !1) {
        const v = a[h] - (y[h] || 0), x = o[h];
        x === 114 ? w = " ".repeat(v) : x === 99 ? v % 2 ? (w = " ".repeat(v / 2 + 0.5), O = " ".repeat(v / 2 - 0.5)) : (w = " ".repeat(v / 2), O = w) : O = " ".repeat(v);
      }
      n.delimiterStart !== !1 && !h && g.push("|"), n.padding !== !1 && // Don’t add the opening space if we’re not aligning and the cell is
      // empty: there will be a closing space.
      !(n.alignDelimiters === !1 && N === "") && (n.delimiterStart !== !1 || h) && g.push(" "), n.alignDelimiters !== !1 && g.push(w), g.push(N), n.alignDelimiters !== !1 && g.push(O), n.padding !== !1 && g.push(" "), (n.delimiterEnd !== !1 || h !== c - 1) && g.push("|");
    }
    p.push(
      n.delimiterEnd === !1 ? g.join("").replace(/ +$/, "") : g.join("")
    );
  }
  return p.join(`
`);
}
function WS(t) {
  return t == null ? "" : String(t);
}
function Bu(t) {
  const e = typeof t == "string" ? t.codePointAt(0) : 0;
  return e === 67 || e === 99 ? 99 : e === 76 || e === 108 ? 108 : e === 82 || e === 114 ? 114 : 0;
}
function KS() {
  return {
    enter: {
      table: US,
      tableData: Fu,
      tableHeader: Fu,
      tableRow: GS
    },
    exit: {
      codeText: YS,
      table: JS,
      tableData: Yo,
      tableHeader: Yo,
      tableRow: Yo
    }
  };
}
function US(t) {
  const e = t._align;
  this.enter(
    {
      type: "table",
      align: e.map(function(n) {
        return n === "none" ? null : n;
      }),
      children: []
    },
    t
  ), this.data.inTable = !0;
}
function JS(t) {
  this.exit(t), this.data.inTable = void 0;
}
function GS(t) {
  this.enter({ type: "tableRow", children: [] }, t);
}
function Yo(t) {
  this.exit(t);
}
function Fu(t) {
  this.enter({ type: "tableCell", children: [] }, t);
}
function YS(t) {
  let e = this.resume();
  this.data.inTable && (e = e.replace(/\\([\\|])/g, QS));
  const n = this.stack[this.stack.length - 1];
  n.type, n.value = e, this.exit(t);
}
function QS(t, e) {
  return e === "|" ? e : t;
}
function XS(t) {
  const e = t || {}, n = e.tableCellPadding, r = e.tablePipeAlign, i = e.stringLength, o = n ? " " : "|";
  return {
    unsafe: [
      { character: "\r", inConstruct: "tableCell" },
      { character: `
`, inConstruct: "tableCell" },
      // A pipe, when followed by a tab or space (padding), or a dash or colon
      // (unpadded delimiter row), could result in a table.
      { atBreak: !0, character: "|", after: "[	 :-]" },
      // A pipe in a cell must be encoded.
      { character: "|", inConstruct: "tableCell" },
      // A colon must be followed by a dash, in which case it could start a
      // delimiter row.
      { atBreak: !0, character: ":", after: "-" },
      // A delimiter row can also start with a dash, when followed by more
      // dashes, a colon, or a pipe.
      // This is a stricter version than the built in check for lists, thematic
      // breaks, and setex heading underlines though:
      // <https://github.com/syntax-tree/mdast-util-to-markdown/blob/51a2038/lib/unsafe.js#L57>
      { atBreak: !0, character: "-", after: "[:|-]" }
    ],
    handlers: {
      inlineCode: d,
      table: s,
      tableCell: a,
      tableRow: l
    }
  };
  function s(f, p, m, y) {
    return c(u(f, m, y), f.align);
  }
  function l(f, p, m, y) {
    const g = h(f, m, y), N = c([g]);
    return N.slice(0, N.indexOf(`
`));
  }
  function a(f, p, m, y) {
    const g = m.enter("tableCell"), N = m.enter("phrasing"), w = m.containerPhrasing(f, {
      ...y,
      before: o,
      after: o
    });
    return N(), g(), w;
  }
  function c(f, p) {
    return qS(f, {
      align: p,
      // @ts-expect-error: `markdown-table` types should support `null`.
      alignDelimiters: r,
      // @ts-expect-error: `markdown-table` types should support `null`.
      padding: n,
      // @ts-expect-error: `markdown-table` types should support `null`.
      stringLength: i
    });
  }
  function u(f, p, m) {
    const y = f.children;
    let g = -1;
    const N = [], w = p.enter("table");
    for (; ++g < y.length; )
      N[g] = h(y[g], p, m);
    return w(), N;
  }
  function h(f, p, m) {
    const y = f.children;
    let g = -1;
    const N = [], w = p.enter("tableRow");
    for (; ++g < y.length; )
      N[g] = a(y[g], f, p, m);
    return w(), N;
  }
  function d(f, p, m) {
    let y = al.inlineCode(f, p, m);
    return m.stack.includes("tableCell") && (y = y.replace(/\|/g, "\\$&")), y;
  }
}
function ZS() {
  return {
    exit: {
      taskListCheckValueChecked: _u,
      taskListCheckValueUnchecked: _u,
      paragraph: tN
    }
  };
}
function eN() {
  return {
    unsafe: [{ atBreak: !0, character: "-", after: "[:|-]" }],
    handlers: { listItem: nN }
  };
}
function _u(t) {
  const e = this.stack[this.stack.length - 2];
  e.type, e.checked = t.type === "taskListCheckValueChecked";
}
function tN(t) {
  const e = this.stack[this.stack.length - 2];
  if (e && e.type === "listItem" && typeof e.checked == "boolean") {
    const n = this.stack[this.stack.length - 1];
    n.type;
    const r = n.children[0];
    if (r && r.type === "text") {
      const i = e.children;
      let o = -1, s;
      for (; ++o < i.length; ) {
        const l = i[o];
        if (l.type === "paragraph") {
          s = l;
          break;
        }
      }
      s === n && (r.value = r.value.slice(1), r.value.length === 0 ? n.children.shift() : n.position && r.position && typeof r.position.start.offset == "number" && (r.position.start.column++, r.position.start.offset++, n.position.start = Object.assign({}, r.position.start)));
    }
  }
  this.exit(t);
}
function nN(t, e, n, r) {
  const i = t.children[0], o = typeof t.checked == "boolean" && i && i.type === "paragraph", s = "[" + (t.checked ? "x" : " ") + "] ", l = n.createTracker(r);
  o && l.move(s);
  let a = al.listItem(t, e, n, {
    ...r,
    ...l.current()
  });
  return o && (a = a.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/, c)), a;
  function c(u) {
    return u + s;
  }
}
function rN() {
  return [
    fS(),
    RS(),
    BS(),
    KS(),
    ZS()
  ];
}
function iN(t) {
  return {
    extensions: [
      dS(),
      zS(t),
      FS(),
      XS(t),
      eN()
    ]
  };
}
const oN = {
  tokenize: hN,
  partial: !0
}, xp = {
  tokenize: fN,
  partial: !0
}, wp = {
  tokenize: dN,
  partial: !0
}, Cp = {
  tokenize: pN,
  partial: !0
}, sN = {
  tokenize: mN,
  partial: !0
}, Sp = {
  name: "wwwAutolink",
  tokenize: cN,
  previous: Mp
}, Np = {
  name: "protocolAutolink",
  tokenize: uN,
  previous: Tp
}, vt = {
  name: "emailAutolink",
  tokenize: aN,
  previous: Ap
}, ht = {};
function lN() {
  return {
    text: ht
  };
}
let tn = 48;
for (; tn < 123; )
  ht[tn] = vt, tn++, tn === 58 ? tn = 65 : tn === 91 && (tn = 97);
ht[43] = vt;
ht[45] = vt;
ht[46] = vt;
ht[95] = vt;
ht[72] = [vt, Np];
ht[104] = [vt, Np];
ht[87] = [vt, Sp];
ht[119] = [vt, Sp];
function aN(t, e, n) {
  const r = this;
  let i, o;
  return s;
  function s(h) {
    return !Us(h) || !Ap.call(r, r.previous) || Aa(r.events) ? n(h) : (t.enter("literalAutolink"), t.enter("literalAutolinkEmail"), l(h));
  }
  function l(h) {
    return Us(h) ? (t.consume(h), l) : h === 64 ? (t.consume(h), a) : n(h);
  }
  function a(h) {
    return h === 46 ? t.check(sN, u, c)(h) : h === 45 || h === 95 || Ce(h) ? (o = !0, t.consume(h), a) : u(h);
  }
  function c(h) {
    return t.consume(h), i = !0, a;
  }
  function u(h) {
    return o && i && de(r.previous) ? (t.exit("literalAutolinkEmail"), t.exit("literalAutolink"), e(h)) : n(h);
  }
}
function cN(t, e, n) {
  const r = this;
  return i;
  function i(s) {
    return s !== 87 && s !== 119 || !Mp.call(r, r.previous) || Aa(r.events) ? n(s) : (t.enter("literalAutolink"), t.enter("literalAutolinkWww"), t.check(oN, t.attempt(xp, t.attempt(wp, o), n), n)(s));
  }
  function o(s) {
    return t.exit("literalAutolinkWww"), t.exit("literalAutolink"), e(s);
  }
}
function uN(t, e, n) {
  const r = this;
  let i = "", o = !1;
  return s;
  function s(h) {
    return (h === 72 || h === 104) && Tp.call(r, r.previous) && !Aa(r.events) ? (t.enter("literalAutolink"), t.enter("literalAutolinkHttp"), i += String.fromCodePoint(h), t.consume(h), l) : n(h);
  }
  function l(h) {
    if (de(h) && i.length < 5)
      return i += String.fromCodePoint(h), t.consume(h), l;
    if (h === 58) {
      const d = i.toLowerCase();
      if (d === "http" || d === "https")
        return t.consume(h), a;
    }
    return n(h);
  }
  function a(h) {
    return h === 47 ? (t.consume(h), o ? c : (o = !0, a)) : n(h);
  }
  function c(h) {
    return h === null || Ni(h) || ee(h) || pn(h) || Wi(h) ? n(h) : t.attempt(xp, t.attempt(wp, u), n)(h);
  }
  function u(h) {
    return t.exit("literalAutolinkHttp"), t.exit("literalAutolink"), e(h);
  }
}
function hN(t, e, n) {
  let r = 0;
  return i;
  function i(s) {
    return (s === 87 || s === 119) && r < 3 ? (r++, t.consume(s), i) : s === 46 && r === 3 ? (t.consume(s), o) : n(s);
  }
  function o(s) {
    return s === null ? n(s) : e(s);
  }
}
function fN(t, e, n) {
  let r, i, o;
  return s;
  function s(c) {
    return c === 46 || c === 95 ? t.check(Cp, a, l)(c) : c === null || ee(c) || pn(c) || c !== 45 && Wi(c) ? a(c) : (o = !0, t.consume(c), s);
  }
  function l(c) {
    return c === 95 ? r = !0 : (i = r, r = void 0), t.consume(c), s;
  }
  function a(c) {
    return i || r || !o ? n(c) : e(c);
  }
}
function dN(t, e) {
  let n = 0, r = 0;
  return i;
  function i(s) {
    return s === 40 ? (n++, t.consume(s), i) : s === 41 && r < n ? o(s) : s === 33 || s === 34 || s === 38 || s === 39 || s === 41 || s === 42 || s === 44 || s === 46 || s === 58 || s === 59 || s === 60 || s === 63 || s === 93 || s === 95 || s === 126 ? t.check(Cp, e, o)(s) : s === null || ee(s) || pn(s) ? e(s) : (t.consume(s), i);
  }
  function o(s) {
    return s === 41 && r++, t.consume(s), i;
  }
}
function pN(t, e, n) {
  return r;
  function r(l) {
    return l === 33 || l === 34 || l === 39 || l === 41 || l === 42 || l === 44 || l === 46 || l === 58 || l === 59 || l === 63 || l === 95 || l === 126 ? (t.consume(l), r) : l === 38 ? (t.consume(l), o) : l === 93 ? (t.consume(l), i) : (
      // `<` is an end.
      l === 60 || // So is whitespace.
      l === null || ee(l) || pn(l) ? e(l) : n(l)
    );
  }
  function i(l) {
    return l === null || l === 40 || l === 91 || ee(l) || pn(l) ? e(l) : r(l);
  }
  function o(l) {
    return de(l) ? s(l) : n(l);
  }
  function s(l) {
    return l === 59 ? (t.consume(l), r) : de(l) ? (t.consume(l), s) : n(l);
  }
}
function mN(t, e, n) {
  return r;
  function r(o) {
    return t.consume(o), i;
  }
  function i(o) {
    return Ce(o) ? n(o) : e(o);
  }
}
function Mp(t) {
  return t === null || t === 40 || t === 42 || t === 95 || t === 91 || t === 93 || t === 126 || ee(t);
}
function Tp(t) {
  return !de(t);
}
function Ap(t) {
  return !(t === 47 || Us(t));
}
function Us(t) {
  return t === 43 || t === 45 || t === 46 || t === 95 || Ce(t);
}
function Aa(t) {
  let e = t.length, n = !1;
  for (; e--; ) {
    const r = t[e][1];
    if ((r.type === "labelLink" || r.type === "labelImage") && !r._balanced) {
      n = !0;
      break;
    }
    if (r._gfmAutolinkLiteralWalkedInto) {
      n = !1;
      break;
    }
  }
  return t.length > 0 && !n && (t[t.length - 1][1]._gfmAutolinkLiteralWalkedInto = !0), n;
}
const gN = {
  tokenize: NN,
  partial: !0
};
function yN() {
  return {
    document: {
      91: {
        name: "gfmFootnoteDefinition",
        tokenize: wN,
        continuation: {
          tokenize: CN
        },
        exit: SN
      }
    },
    text: {
      91: {
        name: "gfmFootnoteCall",
        tokenize: xN
      },
      93: {
        name: "gfmPotentialFootnoteCall",
        add: "after",
        tokenize: kN,
        resolveTo: bN
      }
    }
  };
}
function kN(t, e, n) {
  const r = this;
  let i = r.events.length;
  const o = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []);
  let s;
  for (; i--; ) {
    const a = r.events[i][1];
    if (a.type === "labelImage") {
      s = a;
      break;
    }
    if (a.type === "gfmFootnoteCall" || a.type === "labelLink" || a.type === "label" || a.type === "image" || a.type === "link")
      break;
  }
  return l;
  function l(a) {
    if (!s || !s._balanced)
      return n(a);
    const c = Ze(r.sliceSerialize({
      start: s.end,
      end: r.now()
    }));
    return c.codePointAt(0) !== 94 || !o.includes(c.slice(1)) ? n(a) : (t.enter("gfmFootnoteCallLabelMarker"), t.consume(a), t.exit("gfmFootnoteCallLabelMarker"), e(a));
  }
}
function bN(t, e) {
  let n = t.length;
  for (; n--; )
    if (t[n][1].type === "labelImage" && t[n][0] === "enter") {
      t[n][1];
      break;
    }
  t[n + 1][1].type = "data", t[n + 3][1].type = "gfmFootnoteCallLabelMarker";
  const r = {
    type: "gfmFootnoteCall",
    start: Object.assign({}, t[n + 3][1].start),
    end: Object.assign({}, t[t.length - 1][1].end)
  }, i = {
    type: "gfmFootnoteCallMarker",
    start: Object.assign({}, t[n + 3][1].end),
    end: Object.assign({}, t[n + 3][1].end)
  };
  i.end.column++, i.end.offset++, i.end._bufferIndex++;
  const o = {
    type: "gfmFootnoteCallString",
    start: Object.assign({}, i.end),
    end: Object.assign({}, t[t.length - 1][1].start)
  }, s = {
    type: "chunkString",
    contentType: "string",
    start: Object.assign({}, o.start),
    end: Object.assign({}, o.end)
  }, l = [
    // Take the `labelImageMarker` (now `data`, the `!`)
    t[n + 1],
    t[n + 2],
    ["enter", r, e],
    // The `[`
    t[n + 3],
    t[n + 4],
    // The `^`.
    ["enter", i, e],
    ["exit", i, e],
    // Everything in between.
    ["enter", o, e],
    ["enter", s, e],
    ["exit", s, e],
    ["exit", o, e],
    // The ending (`]`, properly parsed and labelled).
    t[t.length - 2],
    t[t.length - 1],
    ["exit", r, e]
  ];
  return t.splice(n, t.length - n + 1, ...l), t;
}
function xN(t, e, n) {
  const r = this, i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []);
  let o = 0, s;
  return l;
  function l(h) {
    return t.enter("gfmFootnoteCall"), t.enter("gfmFootnoteCallLabelMarker"), t.consume(h), t.exit("gfmFootnoteCallLabelMarker"), a;
  }
  function a(h) {
    return h !== 94 ? n(h) : (t.enter("gfmFootnoteCallMarker"), t.consume(h), t.exit("gfmFootnoteCallMarker"), t.enter("gfmFootnoteCallString"), t.enter("chunkString").contentType = "string", c);
  }
  function c(h) {
    if (
      // Too long.
      o > 999 || // Closing brace with nothing.
      h === 93 && !s || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      h === null || h === 91 || ee(h)
    )
      return n(h);
    if (h === 93) {
      t.exit("chunkString");
      const d = t.exit("gfmFootnoteCallString");
      return i.includes(Ze(r.sliceSerialize(d))) ? (t.enter("gfmFootnoteCallLabelMarker"), t.consume(h), t.exit("gfmFootnoteCallLabelMarker"), t.exit("gfmFootnoteCall"), e) : n(h);
    }
    return ee(h) || (s = !0), o++, t.consume(h), h === 92 ? u : c;
  }
  function u(h) {
    return h === 91 || h === 92 || h === 93 ? (t.consume(h), o++, c) : c(h);
  }
}
function wN(t, e, n) {
  const r = this, i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []);
  let o, s = 0, l;
  return a;
  function a(p) {
    return t.enter("gfmFootnoteDefinition")._container = !0, t.enter("gfmFootnoteDefinitionLabel"), t.enter("gfmFootnoteDefinitionLabelMarker"), t.consume(p), t.exit("gfmFootnoteDefinitionLabelMarker"), c;
  }
  function c(p) {
    return p === 94 ? (t.enter("gfmFootnoteDefinitionMarker"), t.consume(p), t.exit("gfmFootnoteDefinitionMarker"), t.enter("gfmFootnoteDefinitionLabelString"), t.enter("chunkString").contentType = "string", u) : n(p);
  }
  function u(p) {
    if (
      // Too long.
      s > 999 || // Closing brace with nothing.
      p === 93 && !l || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      p === null || p === 91 || ee(p)
    )
      return n(p);
    if (p === 93) {
      t.exit("chunkString");
      const m = t.exit("gfmFootnoteDefinitionLabelString");
      return o = Ze(r.sliceSerialize(m)), t.enter("gfmFootnoteDefinitionLabelMarker"), t.consume(p), t.exit("gfmFootnoteDefinitionLabelMarker"), t.exit("gfmFootnoteDefinitionLabel"), d;
    }
    return ee(p) || (l = !0), s++, t.consume(p), p === 92 ? h : u;
  }
  function h(p) {
    return p === 91 || p === 92 || p === 93 ? (t.consume(p), s++, u) : u(p);
  }
  function d(p) {
    return p === 58 ? (t.enter("definitionMarker"), t.consume(p), t.exit("definitionMarker"), i.includes(o) || i.push(o), G(t, f, "gfmFootnoteDefinitionWhitespace")) : n(p);
  }
  function f(p) {
    return e(p);
  }
}
function CN(t, e, n) {
  return t.check(zr, e, t.attempt(gN, e, n));
}
function SN(t) {
  t.exit("gfmFootnoteDefinition");
}
function NN(t, e, n) {
  const r = this;
  return G(t, i, "gfmFootnoteDefinitionIndent", 5);
  function i(o) {
    const s = r.events[r.events.length - 1];
    return s && s[1].type === "gfmFootnoteDefinitionIndent" && s[2].sliceSerialize(s[1], !0).length === 4 ? e(o) : n(o);
  }
}
function MN(t) {
  let n = (t || {}).singleTilde;
  const r = {
    name: "strikethrough",
    tokenize: o,
    resolveAll: i
  };
  return n == null && (n = !0), {
    text: {
      126: r
    },
    insideSpan: {
      null: [r]
    },
    attentionMarkers: {
      null: [126]
    }
  };
  function i(s, l) {
    let a = -1;
    for (; ++a < s.length; )
      if (s[a][0] === "enter" && s[a][1].type === "strikethroughSequenceTemporary" && s[a][1]._close) {
        let c = a;
        for (; c--; )
          if (s[c][0] === "exit" && s[c][1].type === "strikethroughSequenceTemporary" && s[c][1]._open && // If the sizes are the same:
          s[a][1].end.offset - s[a][1].start.offset === s[c][1].end.offset - s[c][1].start.offset) {
            s[a][1].type = "strikethroughSequence", s[c][1].type = "strikethroughSequence";
            const u = {
              type: "strikethrough",
              start: Object.assign({}, s[c][1].start),
              end: Object.assign({}, s[a][1].end)
            }, h = {
              type: "strikethroughText",
              start: Object.assign({}, s[c][1].end),
              end: Object.assign({}, s[a][1].start)
            }, d = [["enter", u, l], ["enter", s[c][1], l], ["exit", s[c][1], l], ["enter", h, l]], f = l.parser.constructs.insideSpan.null;
            f && Xe(d, d.length, 0, Ki(f, s.slice(c + 1, a), l)), Xe(d, d.length, 0, [["exit", h, l], ["enter", s[a][1], l], ["exit", s[a][1], l], ["exit", u, l]]), Xe(s, c - 1, a - c + 3, d), a = c + d.length - 2;
            break;
          }
      }
    for (a = -1; ++a < s.length; )
      s[a][1].type === "strikethroughSequenceTemporary" && (s[a][1].type = "data");
    return s;
  }
  function o(s, l, a) {
    const c = this.previous, u = this.events;
    let h = 0;
    return d;
    function d(p) {
      return c === 126 && u[u.length - 1][1].type !== "characterEscape" ? a(p) : (s.enter("strikethroughSequenceTemporary"), f(p));
    }
    function f(p) {
      const m = st(c);
      if (p === 126)
        return h > 1 ? a(p) : (s.consume(p), h++, f);
      if (h < 2 && !n) return a(p);
      const y = s.exit("strikethroughSequenceTemporary"), g = st(p);
      return y._open = !g || g === 2 && !!m, y._close = !m || m === 2 && !!g, l(p);
    }
  }
}
class TN {
  /**
   * Create a new edit map.
   */
  constructor() {
    this.map = [], this.index = /* @__PURE__ */ new Map();
  }
  /**
   * Create an edit: a remove and/or add at a certain place.
   *
   * @param {number} index
   *   Index at which to apply the edit.
   * @param {number} remove
   *   Count of items to remove at the index.
   * @param {Array<Event>} add
   *   Items to add at the index.
   * @returns {undefined}
   *   Nothing.
   */
  add(e, n, r) {
    AN(this, e, n, r);
  }
  // To do: add this when moving to `micromark`.
  // /**
  //  * Create an edit: but insert `add` before existing additions.
  //  *
  //  * @param {number} index
  //  * @param {number} remove
  //  * @param {Array<Event>} add
  //  * @returns {undefined}
  //  */
  // addBefore(index, remove, add) {
  //   addImplementation(this, index, remove, add, true)
  // }
  /**
   * Done, change the events.
   *
   * @param {Array<Event>} events
   *   List of events to apply the edits to.
   * @returns {undefined}
   *   Nothing.
   */
  consume(e) {
    if (this.map.sort(function(o, s) {
      return o[0] - s[0];
    }), this.map.length === 0)
      return;
    let n = this.map.length;
    const r = [];
    for (; n > 0; )
      n -= 1, r.push(e.slice(this.map[n][0] + this.map[n][1]), this.map[n][2]), e.length = this.map[n][0];
    r.push(e.slice()), e.length = 0;
    let i = r.pop();
    for (; i; ) {
      for (const o of i)
        e.push(o);
      i = r.pop();
    }
    this.map.length = 0, this.index.clear();
  }
}
function AN(t, e, n, r) {
  if (n === 0 && r.length === 0)
    return;
  const i = t.index.get(e);
  if (i) {
    i[1] += n, i[2].push(...r);
    return;
  }
  const o = [e, n, r];
  t.map.push(o), t.index.set(e, o);
}
function IN(t, e) {
  let n = !1;
  const r = [];
  for (; e < t.length; ) {
    const i = t[e];
    if (n) {
      if (i[0] === "enter")
        i[1].type === "tableContent" && r.push(t[e + 1][1].type === "tableDelimiterMarker" ? "left" : "none");
      else if (i[1].type === "tableContent") {
        if (t[e - 1][1].type === "tableDelimiterMarker") {
          const o = r.length - 1;
          r[o] = r[o] === "left" ? "center" : "right";
        }
      } else if (i[1].type === "tableDelimiterRow")
        break;
    } else i[0] === "enter" && i[1].type === "tableDelimiterRow" && (n = !0);
    e += 1;
  }
  return r;
}
function EN() {
  return {
    flow: {
      null: {
        name: "table",
        tokenize: ON,
        resolveAll: vN
      }
    }
  };
}
function ON(t, e, n) {
  const r = this;
  let i = 0, o = 0, s;
  return l;
  function l(C) {
    let D = r.events.length - 1;
    for (; D > -1; ) {
      const {
        type: re
      } = r.events[D][1];
      if (re === "lineEnding" || // Note: markdown-rs uses `whitespace` instead of `linePrefix`
      re === "linePrefix")
        D--;
      else
        break;
    }
    const P = D > -1 ? r.events[D][1].type : null, X = P === "tableHead" || P === "tableRow" ? x : a;
    return X === x && r.parser.lazy[r.now().line] ? n(C) : X(C);
  }
  function a(C) {
    return t.enter("tableHead"), t.enter("tableRow"), c(C);
  }
  function c(C) {
    return C === 124 || (s = !0, o += 1), u(C);
  }
  function u(C) {
    return C === null ? n(C) : L(C) ? o > 1 ? (o = 0, r.interrupt = !0, t.exit("tableRow"), t.enter("lineEnding"), t.consume(C), t.exit("lineEnding"), f) : n(C) : q(C) ? G(t, u, "whitespace")(C) : (o += 1, s && (s = !1, i += 1), C === 124 ? (t.enter("tableCellDivider"), t.consume(C), t.exit("tableCellDivider"), s = !0, u) : (t.enter("data"), h(C)));
  }
  function h(C) {
    return C === null || C === 124 || ee(C) ? (t.exit("data"), u(C)) : (t.consume(C), C === 92 ? d : h);
  }
  function d(C) {
    return C === 92 || C === 124 ? (t.consume(C), h) : h(C);
  }
  function f(C) {
    return r.interrupt = !1, r.parser.lazy[r.now().line] ? n(C) : (t.enter("tableDelimiterRow"), s = !1, q(C) ? G(t, p, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(C) : p(C));
  }
  function p(C) {
    return C === 45 || C === 58 ? y(C) : C === 124 ? (s = !0, t.enter("tableCellDivider"), t.consume(C), t.exit("tableCellDivider"), m) : v(C);
  }
  function m(C) {
    return q(C) ? G(t, y, "whitespace")(C) : y(C);
  }
  function y(C) {
    return C === 58 ? (o += 1, s = !0, t.enter("tableDelimiterMarker"), t.consume(C), t.exit("tableDelimiterMarker"), g) : C === 45 ? (o += 1, g(C)) : C === null || L(C) ? O(C) : v(C);
  }
  function g(C) {
    return C === 45 ? (t.enter("tableDelimiterFiller"), N(C)) : v(C);
  }
  function N(C) {
    return C === 45 ? (t.consume(C), N) : C === 58 ? (s = !0, t.exit("tableDelimiterFiller"), t.enter("tableDelimiterMarker"), t.consume(C), t.exit("tableDelimiterMarker"), w) : (t.exit("tableDelimiterFiller"), w(C));
  }
  function w(C) {
    return q(C) ? G(t, O, "whitespace")(C) : O(C);
  }
  function O(C) {
    return C === 124 ? p(C) : C === null || L(C) ? !s || i !== o ? v(C) : (t.exit("tableDelimiterRow"), t.exit("tableHead"), e(C)) : v(C);
  }
  function v(C) {
    return n(C);
  }
  function x(C) {
    return t.enter("tableRow"), A(C);
  }
  function A(C) {
    return C === 124 ? (t.enter("tableCellDivider"), t.consume(C), t.exit("tableCellDivider"), A) : C === null || L(C) ? (t.exit("tableRow"), e(C)) : q(C) ? G(t, A, "whitespace")(C) : (t.enter("data"), R(C));
  }
  function R(C) {
    return C === null || C === 124 || ee(C) ? (t.exit("data"), A(C)) : (t.consume(C), C === 92 ? F : R);
  }
  function F(C) {
    return C === 92 || C === 124 ? (t.consume(C), R) : R(C);
  }
}
function vN(t, e) {
  let n = -1, r = !0, i = 0, o = [0, 0, 0, 0], s = [0, 0, 0, 0], l = !1, a = 0, c, u, h;
  const d = new TN();
  for (; ++n < t.length; ) {
    const f = t[n], p = f[1];
    f[0] === "enter" ? p.type === "tableHead" ? (l = !1, a !== 0 && ($u(d, e, a, c, u), u = void 0, a = 0), c = {
      type: "table",
      start: Object.assign({}, p.start),
      // Note: correct end is set later.
      end: Object.assign({}, p.end)
    }, d.add(n, 0, [["enter", c, e]])) : p.type === "tableRow" || p.type === "tableDelimiterRow" ? (r = !0, h = void 0, o = [0, 0, 0, 0], s = [0, n + 1, 0, 0], l && (l = !1, u = {
      type: "tableBody",
      start: Object.assign({}, p.start),
      // Note: correct end is set later.
      end: Object.assign({}, p.end)
    }, d.add(n, 0, [["enter", u, e]])), i = p.type === "tableDelimiterRow" ? 2 : u ? 3 : 1) : i && (p.type === "data" || p.type === "tableDelimiterMarker" || p.type === "tableDelimiterFiller") ? (r = !1, s[2] === 0 && (o[1] !== 0 && (s[0] = s[1], h = li(d, e, o, i, void 0, h), o = [0, 0, 0, 0]), s[2] = n)) : p.type === "tableCellDivider" && (r ? r = !1 : (o[1] !== 0 && (s[0] = s[1], h = li(d, e, o, i, void 0, h)), o = s, s = [o[1], n, 0, 0])) : p.type === "tableHead" ? (l = !0, a = n) : p.type === "tableRow" || p.type === "tableDelimiterRow" ? (a = n, o[1] !== 0 ? (s[0] = s[1], h = li(d, e, o, i, n, h)) : s[1] !== 0 && (h = li(d, e, s, i, n, h)), i = 0) : i && (p.type === "data" || p.type === "tableDelimiterMarker" || p.type === "tableDelimiterFiller") && (s[3] = n);
  }
  for (a !== 0 && $u(d, e, a, c, u), d.consume(e.events), n = -1; ++n < e.events.length; ) {
    const f = e.events[n];
    f[0] === "enter" && f[1].type === "table" && (f[1]._align = IN(e.events, n));
  }
  return t;
}
function li(t, e, n, r, i, o) {
  const s = r === 1 ? "tableHeader" : r === 2 ? "tableDelimiter" : "tableData", l = "tableContent";
  n[0] !== 0 && (o.end = Object.assign({}, On(e.events, n[0])), t.add(n[0], 0, [["exit", o, e]]));
  const a = On(e.events, n[1]);
  if (o = {
    type: s,
    start: Object.assign({}, a),
    // Note: correct end is set later.
    end: Object.assign({}, a)
  }, t.add(n[1], 0, [["enter", o, e]]), n[2] !== 0) {
    const c = On(e.events, n[2]), u = On(e.events, n[3]), h = {
      type: l,
      start: Object.assign({}, c),
      end: Object.assign({}, u)
    };
    if (t.add(n[2], 0, [["enter", h, e]]), r !== 2) {
      const d = e.events[n[2]], f = e.events[n[3]];
      if (d[1].end = Object.assign({}, f[1].end), d[1].type = "chunkText", d[1].contentType = "text", n[3] > n[2] + 1) {
        const p = n[2] + 1, m = n[3] - n[2] - 1;
        t.add(p, m, []);
      }
    }
    t.add(n[3] + 1, 0, [["exit", h, e]]);
  }
  return i !== void 0 && (o.end = Object.assign({}, On(e.events, i)), t.add(i, 0, [["exit", o, e]]), o = void 0), o;
}
function $u(t, e, n, r, i) {
  const o = [], s = On(e.events, n);
  i && (i.end = Object.assign({}, s), o.push(["exit", i, e])), r.end = Object.assign({}, s), o.push(["exit", r, e]), t.add(n + 1, 0, o);
}
function On(t, e) {
  const n = t[e], r = n[0] === "enter" ? "start" : "end";
  return n[1][r];
}
const DN = {
  name: "tasklistCheck",
  tokenize: zN
};
function RN() {
  return {
    text: {
      91: DN
    }
  };
}
function zN(t, e, n) {
  const r = this;
  return i;
  function i(a) {
    return (
      // Exit if there’s stuff before.
      r.previous !== null || // Exit if not in the first content that is the first child of a list
      // item.
      !r._gfmTasklistFirstContentOfListItem ? n(a) : (t.enter("taskListCheck"), t.enter("taskListCheckMarker"), t.consume(a), t.exit("taskListCheckMarker"), o)
    );
  }
  function o(a) {
    return ee(a) ? (t.enter("taskListCheckValueUnchecked"), t.consume(a), t.exit("taskListCheckValueUnchecked"), s) : a === 88 || a === 120 ? (t.enter("taskListCheckValueChecked"), t.consume(a), t.exit("taskListCheckValueChecked"), s) : n(a);
  }
  function s(a) {
    return a === 93 ? (t.enter("taskListCheckMarker"), t.consume(a), t.exit("taskListCheckMarker"), t.exit("taskListCheck"), l) : n(a);
  }
  function l(a) {
    return L(a) ? e(a) : q(a) ? t.check({
      tokenize: PN
    }, e, n)(a) : n(a);
  }
}
function PN(t, e, n) {
  return G(t, r, "whitespace");
  function r(i) {
    return i === null ? n(i) : e(i);
  }
}
function LN(t) {
  return ah([
    lN(),
    yN(),
    MN(t),
    EN(),
    RN()
  ]);
}
const BN = {};
function FN(t) {
  const e = (
    /** @type {Processor<Root>} */
    this
  ), n = t || BN, r = e.data(), i = r.micromarkExtensions || (r.micromarkExtensions = []), o = r.fromMarkdownExtensions || (r.fromMarkdownExtensions = []), s = r.toMarkdownExtensions || (r.toMarkdownExtensions = []);
  i.push(LN(n)), o.push(rN()), s.push(iN(n));
}
function B(t, e) {
  return Object.assign(t, { meta: {
    package: "@milkdown/preset-gfm",
    ...e
  } }), t;
}
var Ia = Vr("strike_through");
B(Ia, {
  displayName: "Attr<strikethrough>",
  group: "Strikethrough"
});
var Ur = qn("strike_through", (t) => ({
  parseDOM: [{ tag: "del" }, {
    style: "text-decoration",
    getAttrs: (e) => e === "line-through"
  }],
  toDOM: (e) => ["del", t.get(Ia.key)(e)],
  parseMarkdown: {
    match: (e) => e.type === "delete",
    runner: (e, n, r) => {
      e.openMark(r), e.next(n.children), e.closeMark(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "strike_through",
    runner: (e, n) => {
      e.withMark(n, "delete");
    }
  }
}));
B(Ur.mark, {
  displayName: "MarkSchema<strikethrough>",
  group: "Strikethrough"
});
B(Ur.ctx, {
  displayName: "MarkSchemaCtx<strikethrough>",
  group: "Strikethrough"
});
var Ea = H("ToggleStrikeThrough", (t) => () => eo(Ur.type(t)));
B(Ea, {
  displayName: "Command<ToggleStrikethrough>",
  group: "Strikethrough"
});
var Ip = De((t) => Lr(/(?<![\w:/])(~{1,2})(.+?)\1(?!\w|\/)$/, Ur.type(t)));
B(Ip, {
  displayName: "InputRule<strikethrough>",
  group: "Strikethrough"
});
var Oa = _e("strikeThroughKeymap", { ToggleStrikethrough: {
  shortcuts: "Mod-Alt-x",
  command: (t) => {
    const e = t.get(Q);
    return () => e.call(Ea.key);
  }
} });
B(Oa.ctx, {
  displayName: "KeymapCtx<strikethrough>",
  group: "Strikethrough"
});
B(Oa.shortcuts, {
  displayName: "Keymap<strikethrough>",
  group: "Strikethrough"
});
function Ep(t, e) {
  const n = e.content.firstChild;
  if (e.childCount !== 1 || n?.type.name !== "paragraph") {
    t.next(e.content);
    return;
  }
  const r = n.lastChild, i = r?.type.name === "hardbreak" ? n.content.cut(0, n.content.size - r.nodeSize) : n.content;
  t.next(i);
}
var Jr = nC({
  tableGroup: "block",
  cellContent: "paragraph",
  cellAttributes: { alignment: {
    default: "left",
    getFromDOM: (t) => t.style.textAlign || "left",
    setDOMAttr: (t, e) => {
      e.style = `text-align: ${t || "left"}`;
    }
  } }
}), Mt = le("table", () => ({
  ...Jr.table,
  content: "table_header_row table_row+",
  disableDropCursor: !0,
  parseMarkdown: {
    match: (t) => t.type === "table",
    runner: (t, e, n) => {
      const r = e.align, i = e.children.map((o, s) => ({
        ...o,
        align: r,
        isHeader: s === 0
      }));
      t.openNode(n), t.next(i), t.closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "table",
    runner: (t, e) => {
      const n = e.content.firstChild?.content;
      if (!n) return;
      const r = [];
      n.forEach((i) => {
        r.push(i.attrs.alignment);
      }), t.openNode("table", void 0, { align: r }), t.next(e.content), t.closeNode();
    }
  }
}));
B(Mt.node, {
  displayName: "NodeSchema<table>",
  group: "Table"
});
B(Mt.ctx, {
  displayName: "NodeSchemaCtx<table>",
  group: "Table"
});
var Gr = le("table_header_row", () => ({
  ...Jr.table_row,
  disableDropCursor: !0,
  content: "(table_header)*",
  parseDOM: [{ tag: "tr[data-is-header]" }, {
    tag: "tr",
    getAttrs: (t) => t instanceof HTMLElement && t.querySelector("th") ? {} : !1
  }],
  toDOM() {
    return [
      "tr",
      { "data-is-header": !0 },
      0
    ];
  },
  parseMarkdown: {
    match: (t) => !!(t.type === "tableRow" && t.isHeader),
    runner: (t, e, n) => {
      const r = e.align, i = e.children.map((o, s) => ({
        ...o,
        align: r[s],
        isHeader: e.isHeader
      }));
      t.openNode(n), t.next(i), t.closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "table_header_row",
    runner: (t, e) => {
      e.content.size !== 0 && (t.openNode("tableRow", void 0, { isHeader: !0 }), t.next(e.content), t.closeNode());
    }
  }
}));
B(Gr.node, {
  displayName: "NodeSchema<tableHeaderRow>",
  group: "Table"
});
B(Gr.ctx, {
  displayName: "NodeSchemaCtx<tableHeaderRow>",
  group: "Table"
});
var Gn = le("table_row", () => ({
  ...Jr.table_row,
  disableDropCursor: !0,
  content: "(table_cell)*",
  parseMarkdown: {
    match: (t) => t.type === "tableRow",
    runner: (t, e, n) => {
      const r = e.align, i = e.children.map((o, s) => ({
        ...o,
        align: r[s]
      }));
      t.openNode(n), t.next(i), t.closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "table_row",
    runner: (t, e) => {
      e.content.size !== 0 && (t.openNode("tableRow"), t.next(e.content), t.closeNode());
    }
  }
}));
B(Gn.node, {
  displayName: "NodeSchema<tableRow>",
  group: "Table"
});
B(Gn.ctx, {
  displayName: "NodeSchemaCtx<tableRow>",
  group: "Table"
});
var Yr = le("table_cell", () => ({
  ...Jr.table_cell,
  disableDropCursor: !0,
  parseMarkdown: {
    match: (t) => t.type === "tableCell" && !t.isHeader,
    runner: (t, e, n) => {
      const r = e.align;
      t.openNode(n, { alignment: r }).openNode(t.schema.nodes.paragraph).next(e.children).closeNode().closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "table_cell",
    runner: (t, e) => {
      t.openNode("tableCell"), Ep(t, e), t.closeNode();
    }
  }
}));
B(Yr.node, {
  displayName: "NodeSchema<tableCell>",
  group: "Table"
});
B(Yr.ctx, {
  displayName: "NodeSchemaCtx<tableCell>",
  group: "Table"
});
var _n = le("table_header", () => ({
  ...Jr.table_header,
  disableDropCursor: !0,
  parseMarkdown: {
    match: (t) => t.type === "tableCell" && !!t.isHeader,
    runner: (t, e, n) => {
      const r = e.align;
      t.openNode(n, { alignment: r }), t.openNode(t.schema.nodes.paragraph), t.next(e.children), t.closeNode(), t.closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "table_header",
    runner: (t, e) => {
      t.openNode("tableCell"), Ep(t, e), t.closeNode();
    }
  }
}));
B(_n.node, {
  displayName: "NodeSchema<tableHeader>",
  group: "Table"
});
B(_n.ctx, {
  displayName: "NodeSchemaCtx<tableHeader>",
  group: "Table"
});
function Op(t, e = 3, n = 3) {
  const r = Array(n).fill(0).map(() => Yr.type(t).createAndFill()), i = Array(n).fill(0).map(() => _n.type(t).createAndFill()), o = Array(e).fill(0).map((s, l) => l === 0 ? Gr.type(t).create(null, i) : Gn.type(t).create(null, r));
  return Mt.type(t).create(null, o);
}
function vp(t) {
  return (e, n) => (r) => {
    n = n ?? r.selection.from;
    const i = r.doc.resolve(n), o = Q1((a) => a.type.name === "table")(i), s = o ? {
      node: o.node,
      from: o.start
    } : void 0, l = t === "row";
    if (s) {
      const a = Y.get(s.node);
      if (e >= 0 && e < (l ? a.height : a.width)) {
        const c = a.positionAt(l ? e : a.height - 1, l ? a.width - 1 : e, s.node), u = r.doc.resolve(s.from + c), h = l ? te.rowSelection : te.colSelection, d = a.positionAt(l ? e : 0, l ? 0 : e, s.node), f = r.doc.resolve(s.from + d);
        return Df(r.setSelection(h(u, f)));
      }
    }
    return r;
  };
}
var _N = vp("row"), $N = vp("col");
function Dp(t, e, { map: n, tableStart: r, table: i }, o) {
  const s = Array(o).fill(0).reduce((a, c, u) => a + i.child(u).nodeSize, r), l = Array(n.width).fill(0).map((a, c) => {
    const u = i.nodeAt(n.map[c]);
    return Yr.type(t).createAndFill({ alignment: u?.attrs.alignment });
  });
  return e.insert(s, Gn.type(t).create(null, l)), e;
}
function VN(t) {
  const e = Kr(t.$from);
  if (!e) return;
  const n = Y.get(e.node);
  return n.cellsInRect({
    left: 0,
    right: n.width,
    top: 0,
    bottom: n.height
  }).map((r) => {
    const i = e.node.nodeAt(r), o = r + e.start;
    return {
      pos: o,
      start: o + 1,
      node: i
    };
  });
}
function HN(t) {
  const e = VN(t.selection);
  if (e && e[0]) {
    const n = t.doc.resolve(e[0].pos), r = e[e.length - 1];
    if (r) {
      const i = t.doc.resolve(r.pos);
      return Df(t.setSelection(new te(i, n)));
    }
  }
  return t;
}
var va = H("GoToPrevTableCell", () => () => dp(-1));
B(va, {
  displayName: "Command<goToPrevTableCellCommand>",
  group: "Table"
});
var Da = H("GoToNextTableCell", () => () => dp(1));
B(Da, {
  displayName: "Command<goToNextTableCellCommand>",
  group: "Table"
});
var Ra = H("ExitTable", (t) => () => (e, n) => {
  if (!Ue(e)) return !1;
  const { $head: r } = e.selection, i = Y1(r, Mt.type(t));
  if (!i) return !1;
  const { to: o } = i, s = e.tr.replaceWith(o, o, at.type(t).createAndFill());
  return s.setSelection($.near(s.doc.resolve(o), 1)).scrollIntoView(), n?.(s), !0;
});
B(Ra, {
  displayName: "Command<breakTableCommand>",
  group: "Table"
});
var Rp = H("InsertTable", (t) => ({ row: e, col: n } = {}) => (r, i) => {
  const { selection: o, tr: s } = r, { from: l } = o, a = Op(t, e, n), c = s.replaceSelectionWith(a), u = $.findFrom(c.doc.resolve(l), 1, !0);
  return u && c.setSelection(u), i?.(c), !0;
});
B(Rp, {
  displayName: "Command<insertTableCommand>",
  group: "Table"
});
var zp = H("MoveRow", () => ({ from: t, to: e, pos: n } = {}) => OC({
  from: t ?? 0,
  to: e ?? 0,
  pos: n
}));
B(zp, {
  displayName: "Command<moveRowCommand>",
  group: "Table"
});
var Pp = H("MoveCol", () => ({ from: t, to: e, pos: n } = {}) => vC({
  from: t ?? 0,
  to: e ?? 0,
  pos: n
}));
B(Pp, {
  displayName: "Command<moveColCommand>",
  group: "Table"
});
var Lp = H("SelectRow", () => (t = { index: 0 }) => (e, n) => {
  const { tr: r } = e;
  return !!n?.(_N(t.index, t.pos)(r));
});
B(Lp, {
  displayName: "Command<selectRowCommand>",
  group: "Table"
});
var Bp = H("SelectCol", () => (t = { index: 0 }) => (e, n) => {
  const { tr: r } = e;
  return !!n?.($N(t.index, t.pos)(r));
});
B(Bp, {
  displayName: "Command<selectColCommand>",
  group: "Table"
});
var Fp = H("SelectTable", () => () => (t, e) => {
  const { tr: n } = t;
  return !!e?.(HN(n));
});
B(Fp, {
  displayName: "Command<selectTableCommand>",
  group: "Table"
});
var _p = H("DeleteSelectedCells", () => () => (t, e) => {
  const { selection: n } = t;
  if (!(n instanceof te)) return !1;
  const r = n.isRowSelection(), i = n.isColSelection();
  return r && i ? EC(t, e) : i ? SC(t, e) : MC(t, e);
});
B(_p, {
  displayName: "Command<deleteSelectedCellsCommand>",
  group: "Table"
});
var $p = H("AddColBefore", () => () => xC);
B($p, {
  displayName: "Command<addColBeforeCommand>",
  group: "Table"
});
var Vp = H("AddColAfter", () => () => wC);
B(Vp, {
  displayName: "Command<addColAfterCommand>",
  group: "Table"
});
var Hp = H("AddRowBefore", (t) => () => (e, n) => {
  if (!Ue(e)) return !1;
  if (n) {
    const r = Qt(e);
    n(Dp(t, e.tr, r, r.top));
  }
  return !0;
});
B(Hp, {
  displayName: "Command<addRowBeforeCommand>",
  group: "Table"
});
var jp = H("AddRowAfter", (t) => () => (e, n) => {
  if (!Ue(e)) return !1;
  if (n) {
    const r = Qt(e);
    n(Dp(t, e.tr, r, r.bottom));
  }
  return !0;
});
B(jp, {
  displayName: "Command<addRowAfterCommand>",
  group: "Table"
});
var qp = H("SetAlign", () => (t = "left") => TC("alignment", t));
B(qp, {
  displayName: "Command<setAlignCommand>",
  group: "Table"
});
var Wp = De((t) => new Fe(/^\|(?<col>\d+)[xX](?<row>\d+)\|\s$/, (e, n, r, i) => {
  const o = e.doc.resolve(r);
  if (!o.node(-1).canReplaceWith(o.index(-1), o.indexAfter(-1), Mt.type(t))) return null;
  const s = Op(t, Math.max(Number(n.groups?.row ?? 0), 2), Number(n.groups?.col)), l = e.tr.replaceRangeWith(r, i, s);
  return l.setSelection(V.create(l.doc, r + 3)).scrollIntoView();
}));
B(Wp, {
  displayName: "InputRule<insertTableInputRule>",
  group: "Table"
});
var Kp = sw((t) => ({ run: (e, n, r) => {
  if (r) return e;
  function i(c) {
    const u = c.childCount, h = c.lastChild?.childCount ?? 0;
    if (u === 0 || h === 0) return at.type(t).create();
    const d = c.firstChild;
    if (!(h > 0 && d && d.childCount === 0)) return c;
    if (u >= 3) {
      const y = c.child(1), g = [];
      for (let O = 0; O < y.childCount; O++) {
        const v = y.child(O);
        g.push(_n.type(t).create(v.attrs, v.content, v.marks));
      }
      const N = d.type.create(d.attrs, g), w = [];
      for (let O = 2; O < u; O++) w.push(c.child(O));
      return c.type.create(c.attrs, [N, ...w]);
    }
    const f = Array(h).fill(0).map(() => _n.type(t).createAndFill()), p = new E(T.from(f), 0, 0), m = d.replace(0, 0, p);
    return c.replace(0, d.nodeSize, new E(T.from(m), 0, 0));
  }
  function o(c) {
    const u = Gn.type(t), h = [];
    let d = [], f = !1;
    function p() {
      if (d.length === 0) return;
      const m = Gr.type(t).createAndFill(), y = Mt.type(t).create(null, [m, ...d]);
      h.push(i(y)), d = [];
    }
    return c.forEach((m) => {
      m.type === u ? (f = !0, d.push(m)) : (p(), h.push(m));
    }), p(), f ? T.from(h) : c;
  }
  function s(c) {
    let u = o(c), h = u !== c;
    const d = [];
    return u.forEach((f) => {
      if (f.type === Mt.type(t)) {
        const p = i(f);
        p !== f && (h = !0), d.push(p);
      } else if (f.childCount > 0) {
        const p = s(f.content);
        p !== f.content ? (h = !0, d.push(f.copy(p))) : d.push(f);
      } else d.push(f);
    }), h ? T.from(d) : c;
  }
  function l(c) {
    const u = [], h = [];
    c.forEach((d) => h.push(d));
    for (let d = 0; d < h.length; d++) {
      const f = h[d], p = h[d + 1];
      f.type === at.type(t) && f.content.size === 0 && p && p.type === Mt.type(t) || u.push(f);
    }
    return u.length < h.length ? T.from(u) : c;
  }
  let a = s(e.content);
  return a = l(a), new E(T.from(a), e.openStart, e.openEnd);
} }));
B(Kp, {
  displayName: "PasteRule<table>",
  group: "Table"
});
var za = _e("tableKeymap", {
  NextCell: {
    priority: 100,
    shortcuts: ["Mod-]", "Tab"],
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(Da.key);
    }
  },
  PrevCell: {
    shortcuts: ["Mod-[", "Shift-Tab"],
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(va.key);
    }
  },
  ExitTable: {
    shortcuts: ["Mod-Enter", "Enter"],
    command: (t) => {
      const e = t.get(Q);
      return () => e.call(Ra.key);
    }
  }
});
B(za.ctx, {
  displayName: "KeymapCtx<table>",
  group: "Table"
});
B(za.shortcuts, {
  displayName: "Keymap<table>",
  group: "Table"
});
var Qo = "footnote_definition", Vu = "footnoteDefinition", Pa = le("footnote_definition", () => ({
  group: "block",
  content: "block+",
  defining: !0,
  attrs: { label: {
    default: "",
    validate: "string"
  } },
  parseDOM: [{
    tag: `dl[data-type="${Qo}"]`,
    getAttrs: (t) => {
      if (!(t instanceof HTMLElement)) throw ct(t);
      return { label: t.dataset.label };
    },
    contentElement: "dd"
  }],
  toDOM: (t) => {
    const e = t.attrs.label;
    return [
      "dl",
      {
        "data-label": e,
        "data-type": Qo
      },
      ["dt", e],
      ["dd", 0]
    ];
  },
  parseMarkdown: {
    match: ({ type: t }) => t === Vu,
    runner: (t, e, n) => {
      t.openNode(n, { label: e.label }).next(e.children).closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === Qo,
    runner: (t, e) => {
      t.openNode(Vu, void 0, {
        label: e.attrs.label,
        identifier: e.attrs.label
      }).next(e.content).closeNode();
    }
  }
}));
B(Pa.ctx, {
  displayName: "NodeSchemaCtx<footnodeDef>",
  group: "footnote"
});
B(Pa.node, {
  displayName: "NodeSchema<footnodeDef>",
  group: "footnote"
});
var Xo = "footnote_reference", La = le("footnote_reference", () => ({
  group: "inline",
  inline: !0,
  atom: !0,
  attrs: { label: {
    default: "",
    validate: "string"
  } },
  parseDOM: [{
    tag: `sup[data-type="${Xo}"]`,
    getAttrs: (t) => {
      if (!(t instanceof HTMLElement)) throw ct(t);
      return { label: t.dataset.label };
    }
  }],
  toDOM: (t) => {
    const e = t.attrs.label;
    return [
      "sup",
      {
        "data-label": e,
        "data-type": Xo
      },
      e
    ];
  },
  parseMarkdown: {
    match: ({ type: t }) => t === "footnoteReference",
    runner: (t, e, n) => {
      t.addNode(n, { label: e.label });
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === Xo,
    runner: (t, e) => {
      t.addNode("footnoteReference", void 0, void 0, {
        label: e.attrs.label,
        identifier: e.attrs.label
      });
    }
  }
}));
B(La.ctx, {
  displayName: "NodeSchemaCtx<footnodeRef>",
  group: "footnote"
});
B(La.node, {
  displayName: "NodeSchema<footnodeRef>",
  group: "footnote"
});
var Ba = Ot.extendSchema((t) => (e) => {
  const n = t(e);
  return {
    ...n,
    attrs: {
      ...n.attrs,
      checked: {
        default: null,
        validate: "boolean|null"
      }
    },
    parseDOM: [{
      tag: 'li[data-item-type="task"]',
      getAttrs: (r) => {
        if (!(r instanceof HTMLElement)) throw ct(r);
        return {
          label: r.dataset.label,
          listType: r.dataset.listType,
          spread: r.dataset.spread === "true",
          checked: r.dataset.checked ? r.dataset.checked === "true" : null
        };
      }
    }, ...n?.parseDOM || []],
    toDOM: (r) => n.toDOM && r.attrs.checked == null ? n.toDOM(r) : [
      "li",
      {
        "data-item-type": "task",
        "data-label": r.attrs.label,
        "data-list-type": r.attrs.listType,
        "data-spread": r.attrs.spread,
        "data-checked": r.attrs.checked
      },
      0
    ],
    parseMarkdown: {
      match: ({ type: r }) => r === "listItem",
      runner: (r, i, o) => {
        if (i.checked == null) {
          n.parseMarkdown.runner(r, i, o);
          return;
        }
        const s = i.label != null ? `${i.label}.` : "•", l = i.checked != null ? !!i.checked : null, a = i.label != null ? "ordered" : "bullet", c = i.spread ?? !0;
        r.openNode(o, {
          label: s,
          listType: a,
          spread: c,
          checked: l
        }), r.next(i.children), r.closeNode();
      }
    },
    toMarkdown: {
      match: (r) => r.type.name === "list_item",
      runner: (r, i) => {
        if (i.attrs.checked == null) {
          n.toMarkdown.runner(r, i);
          return;
        }
        const o = i.attrs.label, s = i.attrs.listType, l = i.attrs.spread, a = i.attrs.checked;
        r.openNode("listItem", void 0, {
          label: o,
          listType: s,
          spread: l,
          checked: a
        }), r.next(i.content), r.closeNode();
      }
    }
  };
});
B(Ba.node, {
  displayName: "NodeSchema<taskListItem>",
  group: "ListItem"
});
B(Ba.ctx, {
  displayName: "NodeSchemaCtx<taskListItem>",
  group: "ListItem"
});
var Up = De(() => new Fe(/^\[(?<checked>\s|x)\]\s$/, (t, e, n, r) => {
  const i = t.doc.resolve(n);
  let o = 0, s = i.node(o);
  for (; s && s.type.name !== "list_item"; )
    o--, s = i.node(o);
  if (!s || s.attrs.checked != null) return null;
  const l = e.groups?.checked === "x", a = i.before(o), c = t.tr;
  return c.deleteRange(n, r).setNodeMarkup(a, void 0, {
    ...s.attrs,
    checked: l
  }), c;
}));
B(Up, {
  displayName: "InputRule<wrapInTaskListInputRule>",
  group: "ListItem"
});
var jN = [Oa, za].flat(), qN = [Wp, Up], WN = [Ip], KN = [Kp], Jp = It(() => sS);
B(Jp, {
  displayName: "Prose<autoInsertSpanPlugin>",
  group: "Prose"
});
var UN = It(() => VC({}));
B(UN, {
  displayName: "Prose<columnResizingPlugin>",
  group: "Prose"
});
var Gp = It(() => QC({ allowTableNodeSelection: !0 }));
B(Gp, {
  displayName: "Prose<tableEditingPlugin>",
  group: "Prose"
});
var lo = Yt("remarkGFM", () => FN);
B(lo.plugin, {
  displayName: "Remark<remarkGFMPlugin>",
  group: "Remark"
});
B(lo.options, {
  displayName: "RemarkConfig<remarkGFMPlugin>",
  group: "Remark"
});
var JN = new ve("MILKDOWN_KEEP_TABLE_ALIGN_PLUGIN");
function GN(t, e) {
  let n = 0;
  return e.forEach((r, i, o) => {
    r === t && (n = o);
  }), n;
}
function YN(t, e) {
  const n = t.content.findDiffStart(e.content);
  if (n == null) return null;
  const r = t.content.findDiffEnd(e.content);
  return r ? {
    from: n,
    to: Math.max(r.b, n)
  } : null;
}
var Yp = It(() => new Oe({
  key: JN,
  appendTransaction: (t, e, n) => {
    if (e.doc === n.doc) return;
    const r = YN(e.doc, n.doc);
    if (!r) return;
    let i;
    const o = (s, l) => {
      if (s.type.name !== "table_cell") return;
      const a = n.doc.resolve(l), c = a.node(a.depth), u = a.node(a.depth - 1).firstChild;
      if (!u) return;
      const h = GN(s, c), d = u.maybeChild(h);
      if (!d) return;
      const f = d.attrs.alignment;
      f !== s.attrs.alignment && (i || (i = n.tr), i.setNodeMarkup(l, void 0, {
        ...s.attrs,
        alignment: f
      }));
    };
    return n.doc.nodesBetween(r.from, r.to, (s, l) => s.type.name !== "table" ? !0 : (n.doc.nodesBetween(l, l + s.nodeSize, o), !1)), i;
  }
}));
B(Yp, {
  displayName: "Prose<keepTableAlignPlugin>",
  group: "Prose"
});
var QN = [
  Yp,
  Jp,
  lo,
  Gp
].flat(), XN = [
  Ba,
  Mt,
  Gr,
  Gn,
  _n,
  Yr,
  Pa,
  La,
  Ia,
  Ur
].flat(), ZN = [
  Da,
  va,
  Ra,
  Rp,
  zp,
  Pp,
  Lp,
  Bp,
  Fp,
  _p,
  Hp,
  jp,
  $p,
  Vp,
  qp,
  Ea
], eM = [
  XN,
  qN,
  KN,
  WN,
  jN,
  ZN,
  QN
].flat(), tM = typeof global == "object" && global && global.Object === Object && global, nM = typeof self == "object" && self && self.Object === Object && self, Qp = tM || nM || Function("return this")(), Vi = Qp.Symbol, Xp = Object.prototype, rM = Xp.hasOwnProperty, iM = Xp.toString, nr = Vi ? Vi.toStringTag : void 0;
function oM(t) {
  var e = rM.call(t, nr), n = t[nr];
  try {
    t[nr] = void 0;
    var r = !0;
  } catch {
  }
  var i = iM.call(t);
  return r && (e ? t[nr] = n : delete t[nr]), i;
}
var sM = Object.prototype, lM = sM.toString;
function aM(t) {
  return lM.call(t);
}
var cM = "[object Null]", uM = "[object Undefined]", Hu = Vi ? Vi.toStringTag : void 0;
function hM(t) {
  return t == null ? t === void 0 ? uM : cM : Hu && Hu in Object(t) ? oM(t) : aM(t);
}
function fM(t) {
  return t != null && typeof t == "object";
}
var dM = "[object Symbol]";
function pM(t) {
  return typeof t == "symbol" || fM(t) && hM(t) == dM;
}
var mM = /\s/;
function gM(t) {
  for (var e = t.length; e-- && mM.test(t.charAt(e)); )
    ;
  return e;
}
var yM = /^\s+/;
function kM(t) {
  return t && t.slice(0, gM(t) + 1).replace(yM, "");
}
function Js(t) {
  var e = typeof t;
  return t != null && (e == "object" || e == "function");
}
var ju = NaN, bM = /^[-+]0x[0-9a-f]+$/i, xM = /^0b[01]+$/i, wM = /^0o[0-7]+$/i, CM = parseInt;
function qu(t) {
  if (typeof t == "number")
    return t;
  if (pM(t))
    return ju;
  if (Js(t)) {
    var e = typeof t.valueOf == "function" ? t.valueOf() : t;
    t = Js(e) ? e + "" : e;
  }
  if (typeof t != "string")
    return t === 0 ? t : +t;
  t = kM(t);
  var n = xM.test(t);
  return n || wM.test(t) ? CM(t.slice(2), n ? 2 : 8) : bM.test(t) ? ju : +t;
}
var Zo = function() {
  return Qp.Date.now();
}, SM = "Expected a function", NM = Math.max, MM = Math.min;
function TM(t, e, n) {
  var r, i, o, s, l, a, c = 0, u = !1, h = !1, d = !0;
  if (typeof t != "function")
    throw new TypeError(SM);
  e = qu(e) || 0, Js(n) && (u = !!n.leading, h = "maxWait" in n, o = h ? NM(qu(n.maxWait) || 0, e) : o, d = "trailing" in n ? !!n.trailing : d);
  function f(x) {
    var A = r, R = i;
    return r = i = void 0, c = x, s = t.apply(R, A), s;
  }
  function p(x) {
    return c = x, l = setTimeout(g, e), u ? f(x) : s;
  }
  function m(x) {
    var A = x - a, R = x - c, F = e - A;
    return h ? MM(F, o - R) : F;
  }
  function y(x) {
    var A = x - a, R = x - c;
    return a === void 0 || A >= e || A < 0 || h && R >= o;
  }
  function g() {
    var x = Zo();
    if (y(x))
      return N(x);
    l = setTimeout(g, m(x));
  }
  function N(x) {
    return l = void 0, d && r ? f(x) : (r = i = void 0, s);
  }
  function w() {
    l !== void 0 && clearTimeout(l), c = 0, r = a = i = l = void 0;
  }
  function O() {
    return l === void 0 ? s : N(Zo());
  }
  function v() {
    var x = Zo(), A = y(x);
    if (r = arguments, i = this, a = x, A) {
      if (l === void 0)
        return p(a);
      if (h)
        return clearTimeout(l), l = setTimeout(g, e), f(a);
    }
    return l === void 0 && (l = setTimeout(g, e)), s;
  }
  return v.cancel = w, v.flush = O, v;
}
var Zp = class {
  constructor() {
    this.beforeMountedListeners = [], this.mountedListeners = [], this.updatedListeners = [], this.selectionUpdatedListeners = [], this.markdownUpdatedListeners = [], this.blurListeners = [], this.focusListeners = [], this.destroyListeners = [], this.beforeMount = (t) => (this.beforeMountedListeners.push(t), this), this.mounted = (t) => (this.mountedListeners.push(t), this), this.updated = (t) => (this.updatedListeners.push(t), this);
  }
  get listeners() {
    return {
      beforeMount: this.beforeMountedListeners,
      mounted: this.mountedListeners,
      updated: this.updatedListeners,
      markdownUpdated: this.markdownUpdatedListeners,
      blur: this.blurListeners,
      focus: this.focusListeners,
      destroy: this.destroyListeners,
      selectionUpdated: this.selectionUpdatedListeners
    };
  }
  markdownUpdated(t) {
    return this.markdownUpdatedListeners.push(t), this;
  }
  blur(t) {
    return this.blurListeners.push(t), this;
  }
  focus(t) {
    return this.focusListeners.push(t), this;
  }
  destroy(t) {
    return this.destroyListeners.push(t), this;
  }
  selectionUpdated(t) {
    return this.selectionUpdatedListeners.push(t), this;
  }
}, Gs = W(new Zp(), "listener"), AM = new ve("MILKDOWN_LISTENER"), em = (t) => (t.inject(Gs, new Zp()), async () => {
  await t.wait(fn);
  const { listeners: e } = t.get(Gs);
  e.beforeMount.forEach((c) => c(t)), await t.wait(Cr);
  const n = t.get(pi);
  let r = null, i = null, o = null, s = null;
  const l = TM(() => {
    if (!s) return;
    const { doc: c } = s;
    if (e.updated.length > 0 && r && !r.eq(c) && e.updated.forEach((u) => {
      u(t, c, r);
    }), e.markdownUpdated.length > 0 && r && !r.eq(c)) {
      const u = n(c);
      e.markdownUpdated.forEach((h) => {
        h(t, u, i);
      }), i = u;
    }
    r = c, s = null;
  }, 200), a = new Oe({
    key: AM,
    view: () => ({ destroy: () => {
      l.cancel(), e.destroy.forEach((c) => c(t));
    } }),
    props: { handleDOMEvents: {
      focus: () => (e.focus.forEach((c) => c(t)), !1),
      blur: () => (e.blur.forEach((c) => c(t)), !1)
    } },
    state: {
      init: (c, u) => {
        r = u.doc, i = n(u.doc);
      },
      apply: (c) => {
        const u = c.selection;
        (!o && u || o && !u.eq(o)) && (e.selectionUpdated.forEach((h) => {
          h(t, u, o);
        }), o = u), !(!(c.docChanged || c.storedMarksSet) || c.getMeta("addToHistory") === !1) && (s = c, l());
      }
    }
  });
  t.update(Tt, (c) => c.concat(a)), await t.wait(bi), e.mounted.forEach((c) => c(t));
});
em.meta = {
  package: "@milkdown/plugin-listener",
  displayName: "Listener"
};
const IM = /* @__PURE__ */ new Set(["paragraph", "heading", "tableCell"]);
function tm(t) {
  t.type === "image" && ((t.alt === null || t.alt === void 0) && (t.alt = ""), (t.title === null || t.title === void 0) && (t.title = ""));
  const e = t.children;
  if (e !== void 0)
    for (let n = 0; n < e.length; n += 1) {
      const r = e[n];
      r !== void 0 && (r.type === "html" && !IM.has(t.type) && (e[n] = { type: "paragraph", children: [r] }), tm(r));
    }
}
const Wu = Yt("chipsParseNormalize", () => () => (t) => {
  tm(t);
}), EM = [Wu.options, Wu.plugin];
async function OM(t) {
  const e = await ow.make().config((n) => {
    n.set(wi, t.host), n.set(mi, t.defaultValue), n.set(lo.options.key, { singleTilde: !1 }), n.update(xi, (r) => ({
      ...r,
      attributes: {
        ...typeof r.attributes == "object" && r.attributes !== null ? r.attributes : {},
        spellcheck: "true",
        autocapitalize: "off",
        autocorrect: "off",
        translate: "no"
      }
    }));
  }).use(Yw).use(eM).use(EM).use(em).create();
  return e.action((n) => {
    n.get(Gs).markdownUpdated((r, i) => {
      t.onMarkdownChange($n(i));
    });
  }), e;
}
function vM(t) {
  t.action((e) => {
    e.get(ot).focus();
  });
}
function DM(t, e) {
  t.action((n) => {
    const r = n.get(ot), { state: i } = r, o = V.near(i.doc.resolve(0), 1);
    r.dispatch(i.tr.setSelection(o).insertText(e));
  });
}
function RM(t, e) {
  t.action(cw($n(e)));
}
const zM = "chips-richtext-card__editor-host";
function PM({ defaultValue: t, onMarkdownChange: e, onReady: n }) {
  const { token: r } = Ys.useToken(), i = rt.useRef(null), o = rt.useRef(e);
  o.current = e;
  const s = rt.useRef(n);
  return s.current = n, rt.useEffect(() => {
    const l = i.current;
    if (l === null)
      return;
    let a = null, c = !1;
    return OM({ host: l, defaultValue: t, onMarkdownChange: o.current }).then(
      (u) => {
        if (c) {
          u.destroy();
          return;
        }
        a = u, i.current !== null && (i.current.dataset.engineReady = "true"), s.current(u);
      },
      () => {
      }
    ), () => {
      c = !0, a !== null && (a.destroy(), a = null);
    };
  }, [t]), /* @__PURE__ */ Te(
    "div",
    {
      ref: i,
      className: zM,
      style: {
        width: "100%",
        minHeight: 96,
        border: `1px solid ${r.colorBorder}`,
        borderRadius: r.borderRadiusLG,
        background: r.colorBgContainer,
        padding: `${r.paddingSM}px ${r.padding}px`,
        boxSizing: "border-box"
      }
    }
  );
}
function Ku(t, e) {
  if (t === "" || t === void 0 || t === null)
    return e;
  const n = typeof t == "number" ? t : Number(t);
  return Number.isFinite(n) && n > 0 ? n : e;
}
function LM({
  content: t,
  contentSource: e,
  onDraftChange: n,
  onMilkdownReady: r
}) {
  const { token: i } = Ys.useToken(), o = Hi(t), s = eh(t), l = o.content_text ?? "", a = rt.useRef({
    contentText: l,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight
  }), [c, u] = rt.useState(l), h = () => {
    n({ ...a.current });
  }, d = (y) => {
    a.current.contentText = y, u(y), h();
  }, f = (y, g) => {
    a.current.fontSize = Ku(g.fontSize, a.current.fontSize), a.current.lineHeight = Ku(g.lineHeight, a.current.lineHeight), h();
  }, p = Nm(c), m = rh(nh(o.markdown_capabilities));
  return /* @__PURE__ */ rr(
    "div",
    {
      style: {
        width: "100%",
        minHeight: 0,
        overflow: "auto",
        padding: i.paddingSM,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: i.marginSM
      },
      children: [
        e === "file" ? /* @__PURE__ */ rr(
          "p",
          {
            role: "status",
            style: {
              margin: 0,
              color: i.colorTextSecondary,
              fontSize: i.fontSizeSM
            },
            children: [
              "文件来源正文（",
              o.content_file,
              "）读取通道未接入，当前仅可调整展示配置"
            ]
          }
        ) : /* @__PURE__ */ rr(hm, { children: [
          /* @__PURE__ */ Te(
            "div",
            {
              style: {
                color: i.colorText,
                fontSize: s.fontSize,
                lineHeight: String(s.lineHeight),
                overflowWrap: "anywhere"
              },
              children: /* @__PURE__ */ Te(
                PM,
                {
                  defaultValue: l,
                  onMarkdownChange: d,
                  onReady: r
                }
              )
            }
          ),
          /* @__PURE__ */ Te(
            "p",
            {
              role: "status",
              "data-testid": "richtext-inline-gate",
              style: {
                margin: 0,
                color: i.colorTextSecondary,
                fontSize: i.fontSizeSM
              },
              children: p.shouldUseFile ? `已提取纯文本 ${String(p.length)} 字，超过 ${String(es)} 字阈值，保存时正文将文件化存储为卡片内 .md 文件` : `已提取纯文本 ${String(p.length)} 字（≤${String(es)} 字阈值内内联保存）`
            }
          ),
          m.length > 0 ? /* @__PURE__ */ Te(
            "p",
            {
              style: {
                margin: 0,
                color: i.colorTextSecondary,
                fontSize: i.fontSizeSM
              },
              children: m
            }
          ) : null
        ] }),
        /* @__PURE__ */ rr(
          ao,
          {
            layout: "vertical",
            initialValues: {
              fontSize: s.fontSize,
              lineHeight: s.lineHeight
            },
            onValuesChange: f,
            children: [
              /* @__PURE__ */ Te(ao.Item, { label: "字号（px）", name: "fontSize", children: /* @__PURE__ */ Te(ja, { type: "number", min: Qu, max: Xu }) }),
              /* @__PURE__ */ Te(ao.Item, { label: "行高倍数", name: "lineHeight", children: /* @__PURE__ */ Te(ja, { type: "number", min: Zu, step: 0.1 }) })
            ]
          }
        )
      ]
    }
  );
}
function BM(t, e, n) {
  return e === "inline" ? ym($n(n.contentText)) ? {
    kind: "replace",
    content: Sm({ ...t, content_text: n.contentText }, {
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
const ai = /* @__PURE__ */ new WeakMap();
function FM(t, e) {
  ai.get(e)?.(), e.replaceChildren();
  const n = Ju(e);
  Uu(() => {
    n.render(/* @__PURE__ */ Te(vm, { content: t.content }));
  });
  let r = !1;
  const i = () => {
    r || (r = !0, n.unmount(), ai.get(e) === i && ai.delete(e));
  };
  return ai.set(e, i), i;
}
class _M {
  state = "active";
  contentSource;
  base;
  revision;
  pending = null;
  dirty = !1;
  milkdown = null;
  host;
  root;
  changeHandlers = /* @__PURE__ */ new Set();
  dirtyHandlers = /* @__PURE__ */ new Set();
  constructor(e, n) {
    this.base = { ...e.content }, this.contentSource = Hi(e.content).content_source, this.revision = e.revision, this.host = n, n.replaceChildren(), this.root = Ju(n), this.mount();
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
    if (this.state === "active") {
      if (this.milkdown !== null) {
        vM(this.milkdown);
        return;
      }
      this.host.querySelector(".ProseMirror")?.focus();
    }
  }
  dispose() {
    this.state !== "disposed" && (this.milkdown = null, this.root.unmount(), this.changeHandlers.clear(), this.dirtyHandlers.clear(), this.pending = null, this.dirty = !1, this.state = "disposed");
  }
  /**
   * 程序化编辑入口（宿主驱动/测试面）：在首个文本块选择处插入文本；
   * 与键入同一事务路径（transaction → state → listener 序列化 → 草稿 → 待提交变更）。
   */
  insertText(e) {
    this.state !== "active" || this.milkdown === null || DM(this.milkdown, e);
  }
  /**
   * 程序化全文替换（宿主驱动/测试面）：以 Markdown 源文整体替换文档，
   * 与 `update()` 基线替换同构，经同一事务路径触发序列化回流。
   */
  replaceDocument(e) {
    this.state !== "active" || this.milkdown === null || RM(this.milkdown, e);
  }
  mount() {
    Uu(() => {
      this.root.render(
        /* @__PURE__ */ Te(
          LM,
          {
            content: this.base,
            contentSource: this.contentSource,
            onDraftChange: this.handleDraftChange,
            onMilkdownReady: this.handleMilkdownReady
          },
          this.revision
        )
      );
    });
  }
  handleMilkdownReady = (e) => {
    this.state === "active" && (this.milkdown = e);
  };
  handleDraftChange = (e) => {
    if (this.state !== "active")
      return;
    const n = BM(this.base, this.contentSource, e);
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
function $M(t, e) {
  return new _M(t, e);
}
const JM = {
  renderView: FM,
  renderEditor: $M
};
export {
  JM as default,
  $M as renderEditor,
  JM as renderPlugin,
  FM as renderView
};
