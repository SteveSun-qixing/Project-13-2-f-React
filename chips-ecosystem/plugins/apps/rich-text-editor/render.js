import { jsxs as ue, jsx as L, Fragment as Bm } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import Qe, { useState as fe, useRef as Zt, useCallback as we, useEffect as Zn, useMemo as Ps } from "chips-resource://platform/vendor/react.js";
import { theme as li, Form as gt, Flex as St, Typography as Fe, Input as er, Button as In, Alert as tr, Tabs as _m, Modal as zh, App as Lh, Empty as Nc, Select as Fm, useCommandRuntime as $m, ChipsProvider as Vm, CommandProvider as Hm } from "chips-resource://platform/vendor/chips-ui.js";
import { flushSync as jm } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as qm } from "chips-resource://platform/vendor/react-dom-client.js";
class Mn extends Error {
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
    return new Mn({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function Wm(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const Km = "SDK_BRIDGE_UNAVAILABLE", Ic = "SDK_UNKNOWN_ERROR", Mc = "发生未知错误";
function Um(t) {
  return t instanceof Error;
}
function Jm(t) {
  if (t instanceof Mn)
    return t;
  if (Wm(t)) {
    const e = t, n = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new Mn(n);
  }
  return Um(t) ? new Mn({
    code: Ic,
    message: Mc,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new Mn({
    code: Ic,
    message: Mc,
    details: { value: String(t) },
    retryable: !1
  });
}
function Gm() {
  return new Mn({
    code: Km,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function rt(t, e, n) {
  let r;
  try {
    r = t();
  } catch (i) {
    return Promise.reject(Jm(i));
  }
  return r.request(e, n);
}
const Ym = "cli.command.list", Xm = "cli.command.get", Qm = "cli.command.resolve";
function Zm(t) {
  return {
    list(e) {
      return rt(t, Ym, e ?? {});
    },
    get(e) {
      return rt(t, Xm, e);
    },
    resolve(e) {
      return rt(t, Qm, e);
    }
  };
}
const Sr = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, eg = "cli.task.create", tg = "cli.task.bindInvocation", ng = "cli.task.cancel";
function rg(t) {
  return {
    create(e) {
      return rt(t, eg, e).then((n) => n.task);
    },
    bindInvocation(e) {
      return rt(t, tg, e).then((n) => n.task);
    },
    get(e) {
      const n = { taskId: e };
      return rt(t, Sr.CLI_TASK_GET, n).then((r) => r.task);
    },
    active(e) {
      const n = { commandId: e };
      return rt(t, Sr.CLI_TASK_ACTIVE, n).then((r) => r.task);
    },
    progress(e, n) {
      const r = { taskId: e, progress: n };
      return rt(t, Sr.CLI_TASK_PROGRESS, r).then((i) => i.task);
    },
    complete(e, n) {
      const r = {
        taskId: e,
        ...n === void 0 ? {} : { output: n }
      };
      return rt(t, Sr.CLI_TASK_COMPLETE, r).then((i) => i.task);
    },
    fail(e, n) {
      const r = { taskId: e, error: n };
      return rt(t, Sr.CLI_TASK_FAIL, r).then((i) => i.task);
    },
    cancel(e) {
      return rt(t, ng, { taskId: e }).then((n) => n.task);
    }
  };
}
function ig() {
  return globalThis.window?.chips;
}
class og {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = Zm(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = rg(() => this.#e());
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
    const e = ig();
    if (e === void 0)
      throw Gm();
    return e;
  }
  /**
   * 唯一能力调用入口；转发给目标 Bridge。
   *
   * @param capabilityId - 能力 ID（`<domain>:<action>[:<target>]`）
   * @param input - 能力输入，校验与权限判定由平台完成
   * @returns 能力输出；目标不可用或平台调用失败时以 `ChipsError` 拒绝
   */
  request(e, n) {
    return rt(() => this.#e(), e, n);
  }
  /**
   * 订阅标准事件；转发给目标 Bridge。
   *
   * @param eventId - 事件 ID
   * @param handler - 载荷回调；同一 `(eventId, handler)` 多次订阅各自独立
   * @returns 可退订句柄，`dispose()` 幂等
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  subscribe(e, n) {
    return this.#e().subscribe(e, n);
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
function sg(t) {
  return new og(t?.bridge);
}
const _t = sg(), Tc = {
  cards: { key: "cards" },
  boxes: { key: "boxes" }
}, lg = ({
  library: t,
  selectedId: e,
  status: n,
  feedback: r,
  createError: i,
  onSelect: o,
  onOpenSource: s,
  onCreateDocument: l
}) => {
  const { token: a } = li.useToken(), [c, u] = Qe.useState(""), [h, d] = Qe.useState(null), [f] = gt.useForm(), p = () => {
    s(c);
  }, m = () => {
    (async () => {
      const S = await f.validateFields();
      l(h ?? "card", S.name ?? "", S.parent), d(null), f.resetFields();
    })().catch(() => {
    });
  }, y = (S, C) => S.length === 0 ? /* @__PURE__ */ L(Fe.Text, { type: "secondary", style: { fontSize: a.fontSizeSM }, children: C }) : /* @__PURE__ */ L(St, { vertical: !0, gap: a.marginXXS, children: S.map((E) => {
    const O = E.documentId === e;
    return /* @__PURE__ */ ue(
      "button",
      {
        type: "button",
        onClick: () => o(E.documentId),
        style: {
          textAlign: "start",
          cursor: "pointer",
          border: "none",
          borderRadius: a.borderRadiusSM,
          padding: `${a.paddingXXS}px ${a.paddingXS}px`,
          background: O ? a.colorPrimaryBg : "transparent",
          color: a.colorText
        },
        children: [
          /* @__PURE__ */ L(
            Fe.Text,
            {
              strong: O,
              style: { display: "block", fontSize: a.fontSizeSM },
              children: E.title
            }
          ),
          /* @__PURE__ */ ue(Fe.Text, { type: "secondary", style: { fontSize: a.fontSizeSM }, ellipsis: !0, children: [
            E.kind === "card" ? "卡片" : "箱子",
            " · ",
            E.documentId
          ] })
        ]
      },
      E.documentId
    );
  }) }), g = [
    {
      key: Tc.cards.key,
      label: `卡片（${String(t.cards.length)}）`,
      children: y(t.cards, "暂无卡片：打开或新建富文本卡片后显示")
    },
    {
      key: Tc.boxes.key,
      label: `箱子（${String(t.boxes.length)}）`,
      children: y(t.boxes, "暂无箱子：打开箱子后显示")
    }
  ];
  return /* @__PURE__ */ ue(St, { vertical: !0, gap: a.marginSM, style: { height: "100%", minHeight: 0 }, children: [
    /* @__PURE__ */ L(Fe.Text, { strong: !0, children: "卡库 / 卡箱" }),
    /* @__PURE__ */ ue(St, { gap: a.marginXXS, children: [
      /* @__PURE__ */ L(
        er,
        {
          value: c,
          placeholder: "chips-resource:// 或路径",
          onChange: (S) => u(S.target.value),
          onPressEnter: p,
          size: "small"
        }
      ),
      /* @__PURE__ */ L(In, { size: "small", type: "primary", onClick: p, loading: n === "opening", children: "打开" })
    ] }),
    /* @__PURE__ */ ue(St, { gap: a.marginXXS, children: [
      /* @__PURE__ */ L(In, { size: "small", onClick: () => d("card"), children: "新建卡片" }),
      /* @__PURE__ */ L(In, { size: "small", onClick: () => d("box"), children: "新建箱子" })
    ] }),
    i !== null ? /* @__PURE__ */ L(
      tr,
      {
        type: "warning",
        showIcon: !0,
        style: { fontSize: a.fontSizeSM },
        message: `新建未完成（${i.code}）`,
        description: `${i.message}：document:create 宿主实现在途（缺位在册），入口按正式契约接线。`
      }
    ) : null,
    /* @__PURE__ */ L("div", { style: { flex: 1, minHeight: 0, overflow: "auto" }, children: /* @__PURE__ */ L(_m, { defaultActiveKey: "cards", items: g, size: "small" }) }),
    r !== null && n !== "error" ? /* @__PURE__ */ L(Fe.Text, { type: "secondary", style: { fontSize: a.fontSizeSM }, children: r }) : null,
    r !== null && n === "error" ? /* @__PURE__ */ L(tr, { type: "error", showIcon: !0, style: { fontSize: a.fontSizeSM }, message: r }) : null,
    /* @__PURE__ */ L(
      zh,
      {
        title: h === "box" ? "新建箱子" : "新建富文本卡片",
        open: h !== null,
        okText: "创建",
        cancelText: "取消",
        onOk: m,
        onCancel: () => d(null),
        destroyOnClose: !0,
        children: /* @__PURE__ */ ue(gt, { form: f, layout: "vertical", children: [
          /* @__PURE__ */ L(gt.Item, { label: "文档名称（缺省「未命名卡片/未命名箱子」）", name: "name", children: /* @__PURE__ */ L(er, { placeholder: "例如 东京旅行日记" }) }),
          /* @__PURE__ */ L(
            gt.Item,
            {
              label: "落点（父目录受管引用）",
              name: "parent",
              rules: [{ required: !0, message: "请填写落点（父目录受管引用）" }],
              children: /* @__PURE__ */ L(er, { placeholder: "例如 chips-resource://ws" })
            }
          ),
          h === "card" ? /* @__PURE__ */ L(Fe.Text, { type: "secondary", style: { fontSize: a.fontSizeSM }, children: "卡片为固定复合结构：复合容器 + 一张富文本基础卡片（base.richtext）。" }) : null
        ] })
      }
    )
  ] });
};
function zl(t) {
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
function Ph(t) {
  return typeof t == "string" && t.trim().length > 0;
}
function ag(t) {
  return Ph(t) && zl(t).length > 0;
}
function cg(t) {
  return ag(t) ? zl(t).toLowerCase().endsWith(".md") : !1;
}
const Ac = "markdown", Bs = 200;
function hr(t) {
  return t.replace(/\r\n?/g, `
`).replace(/\u00a0/g, " ").replace(/[\t ]+$/gm, "").replace(/^\n+/, "").replace(/\n{3,}/g, `

`).trimEnd();
}
function ug(t) {
  return Array.from(t).length;
}
function hg(t) {
  const e = hr(t);
  return e ? e.replace(/\$\$([\s\S]*?)\$\$/g, "$1").replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, "$1").replace(/```[\s\S]*?```/g, (n) => n.replace(/```/g, "")).replace(/`([^`]+)`/g, "$1").replace(/!\[([^\]]*)]\(([^)]+)\)/g, "$1").replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1").replace(/^\s{0,3}#{1,6}\s+/gm, "").replace(/^\s{0,3}>\s?/gm, "").replace(/^\s{0,3}(?:[-*+] |\d+\. )/gm, "").replace(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gm, " ").replace(/~~([^~]+)~~/g, "$1").replace(/==([^=]+)==/g, "$1").replace(/\+\+([^+]+)\+\+/g, "$1").replace(/\^([^^]+)\^/g, "$1").replace(/~([^~]+)~/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/_([^_]+)_/g, "$1").replace(/\\([\\`*{}[\]()#+.!_>~|])/g, "$1").replace(/<[^>]+>/g, " ").replace(/\n+/g, " ").replace(/\s+/g, " ").trim() : "";
}
function Bh(t) {
  return ug(hg(t));
}
function fg(t) {
  if (Bh(t) > 0)
    return !0;
  const e = hr(t);
  return e ? /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/m.test(e) : !1;
}
function dg(t) {
  return t > Bs;
}
function pg(t) {
  return cg(typeof t == "string" ? t : void 0) ? zl(t) : "";
}
const Ec = "base.richtext", _s = { fontSize: 16, lineHeight: 1.6 }, Ll = 12, Pl = 48, Bl = 1, Fs = {
  commonmark: !0,
  gfm: !0,
  math: !0,
  highlight: !0,
  underline: !0,
  superscript: !0,
  subscript: !0
}, mg = "zh-CN";
function $s(t) {
  return typeof t == "string" ? t.trim() : void 0;
}
function gg(t) {
  const e = $s(t.content_source);
  return e === "file" ? "file" : e === "inline" ? "inline" : Ph(t.content_file) ? "file" : "inline";
}
function yg(t) {
  const e = typeof t == "object" && t !== null ? t : {}, n = {};
  for (const r of Object.keys(Fs))
    n[r] = e[r] === !1 ? !1 : Fs[r];
  return n;
}
function _l(t) {
  const e = typeof t == "object" && t !== null ? t : {}, n = gg(e), r = $s(e.locale) ?? mg, i = yg(e.markdown_capabilities);
  if (n === "file")
    return {
      card_type: Ec,
      content_format: Ac,
      content_source: "file",
      content_file: pg($s(e.content_file) ?? ""),
      locale: r,
      markdown_capabilities: i
    };
  const o = e.content_text, s = hr(
    typeof o == "string" ? o : typeof e.markdown == "string" ? e.markdown : ""
  );
  return {
    card_type: Ec,
    content_format: Ac,
    content_source: "inline",
    content_text: s,
    locale: r,
    markdown_capabilities: i
  };
}
function vc(t) {
  return typeof t == "number" && Number.isFinite(t) ? t : void 0;
}
function kg(t) {
  const e = typeof t == "object" && t !== null ? t : {}, n = typeof e.config == "object" && e.config !== null ? e.config : {}, r = vc(n.fontSize), i = vc(n.lineHeight);
  return {
    fontSize: r !== void 0 && Number.isInteger(r) && r >= Ll && r <= Pl ? r : _s.fontSize,
    lineHeight: i !== void 0 && i >= Bl ? i : _s.lineHeight
  };
}
function bg(t) {
  if (t == null)
    return !0;
  if (typeof t != "object" || Array.isArray(t))
    return !1;
  const e = t, n = e.fontSize;
  if (n !== void 0 && (typeof n != "number" || !Number.isInteger(n) || n < Ll || n > Pl))
    return !1;
  const r = e.lineHeight;
  return !(r !== void 0 && (typeof r != "number" || !Number.isFinite(r) || r < Bl));
}
function wg(t, e) {
  const n = _l({
    ...t,
    markdown_capabilities: t.markdown_capabilities ?? Fs
  }), r = {
    card_type: n.card_type,
    content_format: n.content_format,
    content_source: n.content_source,
    locale: n.locale,
    markdown_capabilities: { ...n.markdown_capabilities },
    config: { ...e ?? _s }
  };
  return n.content_source === "file" ? r.content_file = n.content_file ?? "" : r.content_text = n.content_text ?? "", r;
}
function xg(t) {
  const e = Bh(t);
  return { length: e, shouldUseFile: dg(e) };
}
const Cg = [
  "commonmark",
  "gfm",
  "math",
  "highlight",
  "underline",
  "superscript",
  "subscript"
], Sg = Object.freeze({
  commonmark: !0,
  gfm: !0,
  math: !1,
  highlight: !1,
  underline: !1,
  superscript: !1,
  subscript: !1
}), Ng = Object.freeze({
  commonmark: "基础语法",
  gfm: "GFM 扩展",
  math: "数学公式",
  highlight: "高亮标记",
  underline: "下划线",
  superscript: "上标",
  subscript: "下标"
});
function Ig(t) {
  return Cg.filter(
    (e) => t[e] === !0 && Sg[e] === !1
  );
}
function Mg(t) {
  return t.length === 0 ? "" : `以下扩展语法当前按纯文本呈现：${t.map((n) => Ng[n]).join("、")}`;
}
var ut = /* @__PURE__ */ (function(t) {
  return t.docTypeError = "docTypeError", t.contextNotFound = "contextNotFound", t.timerNotFound = "timerNotFound", t.ctxCallOutOfScope = "ctxCallOutOfScope", t.createNodeInParserFail = "createNodeInParserFail", t.stackOverFlow = "stackOverFlow", t.parserMatchError = "parserMatchError", t.serializerMatchError = "serializerMatchError", t.getAtomFromSchemaFail = "getAtomFromSchemaFail", t.expectDomTypeError = "expectDomTypeError", t.callCommandBeforeEditorView = "callCommandBeforeEditorView", t.missingRootElement = "missingRootElement", t.missingNodeInSchema = "missingNodeInSchema", t.missingMarkInSchema = "missingMarkInSchema", t.ctxNotBind = "ctxNotBind", t.missingYjsDoc = "missingYjsDoc", t.aiProviderError = "aiProviderError", t.aiBuildContextError = "aiBuildContextError", t;
})({}), ht = class extends Error {
  constructor(t, e, n) {
    super(e, n), this.name = "MilkdownError", this.code = t, n?.cause !== void 0 && (this.cause = n.cause);
  }
}, Tg = (t, e) => typeof e == "function" ? "[Function]" : e, bo = (t) => JSON.stringify(t, Tg);
function Ag(t) {
  return new ht(ut.docTypeError, `Doc type error, unsupported type: ${bo(t)}`);
}
function Eg(t) {
  return new ht(ut.contextNotFound, `Context "${t}" not found, do you forget to inject it?`);
}
function vg(t) {
  return new ht(ut.timerNotFound, `Timer "${t}" not found, do you forget to record it?`);
}
function wo() {
  return new ht(ut.ctxCallOutOfScope, "Should not call a context out of the plugin.");
}
function Og(t, e, n) {
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
  return new ht(ut.createNodeInParserFail, o.join(`
`));
}
function _h() {
  return new ht(ut.stackOverFlow, "Stack over flow, cannot pop on an empty stack.");
}
function Dg(t) {
  return new ht(ut.parserMatchError, `Cannot match target parser for node: ${bo(t)}.`);
}
function Rg(t) {
  return new ht(ut.serializerMatchError, `Cannot match target serializer for node: ${bo(t)}.`);
}
function Et(t) {
  return new ht(ut.expectDomTypeError, `Expect to be a dom, but get: ${bo(t)}.`);
}
function qo() {
  return new ht(ut.callCommandBeforeEditorView, "You're trying to call a command before editor view initialized, make sure to get commandManager from ctx after editor view has been initialized");
}
function zg(t) {
  return new ht(ut.missingNodeInSchema, `Missing node in schema, milkdown cannot find "${t}" in schema.`);
}
function Lg(t) {
  return new ht(ut.missingMarkInSchema, `Missing mark in schema, milkdown cannot find "${t}" in schema.`);
}
var Fh = class {
  constructor() {
    this.sliceMap = /* @__PURE__ */ new Map(), this.get = (t) => {
      const e = typeof t == "string" ? [...this.sliceMap.values()].find((n) => n.type.name === t) : this.sliceMap.get(t.id);
      if (!e) {
        const n = typeof t == "string" ? t : t.name;
        throw Eg(n);
      }
      return e;
    }, this.remove = (t) => {
      const e = typeof t == "string" ? [...this.sliceMap.values()].find((n) => n.type.name === t) : this.sliceMap.get(t.id);
      e && this.sliceMap.delete(e.type.id);
    }, this.has = (t) => typeof t == "string" ? [...this.sliceMap.values()].some((e) => e.type.name === t) : this.sliceMap.has(t.id);
  }
}, Pg = class {
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
}, Bg = class {
  constructor(t, e) {
    this.id = /* @__PURE__ */ Symbol(`Context-${e}`), this.name = e, this._defaultValue = t, this._typeInfo = () => {
      throw wo();
    };
  }
  create(t, e = this._defaultValue) {
    return new Pg(t, e, this);
  }
}, X = (t, e) => new Bg(t, e), _g = class {
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
}, Fg = class $h {
  #t;
  #e;
  #r;
  #n;
  constructor(e, n, r) {
    this.produce = (i) => i && Object.keys(i).length ? new $h(this.#t, this.#e, { ...i }) : this, this.inject = (i, o) => {
      const s = i.create(this.#t.sliceMap);
      return o != null && s.set(o), this.#n?.onInject(i), this;
    }, this.remove = (i) => (this.#t.remove(i), this.#n?.onRemove(i), this), this.record = (i) => (i.create(this.#e.store), this.#n?.onRecord(i), this), this.clearTimer = (i) => (this.#e.remove(i), this.#n?.onClear(i), this), this.isInjected = (i) => this.#t.has(i), this.isRecorded = (i) => this.#e.has(i), this.use = (i) => (this.#n?.onUse(i), this.#t.get(i)), this.get = (i) => this.use(i).get(), this.set = (i, o) => this.use(i).set(o), this.update = (i, o) => this.use(i).update(o), this.timer = (i) => this.#e.get(i), this.done = (i) => {
      this.timer(i).done(), this.#n?.onDone(i);
    }, this.wait = (i) => {
      const o = this.timer(i).start();
      return this.#n?.onWait(i, o), o;
    }, this.waitTimers = async (i) => {
      await Promise.all(this.get(i).map((o) => this.wait(o)));
    }, this.#t = e, this.#e = n, this.#r = r, r && (this.#n = new _g(e, n, r));
  }
  get meta() {
    return this.#r;
  }
  get inspector() {
    return this.#n;
  }
}, $g = class {
  constructor() {
    this.store = /* @__PURE__ */ new Map(), this.get = (t) => {
      const e = this.store.get(t.id);
      if (!e) throw vg(t.name);
      return e;
    }, this.remove = (t) => {
      this.store.delete(t.id);
    }, this.has = (t) => this.store.has(t.id);
  }
}, Vg = class {
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
}, Hg = class {
  constructor(t, e = 3e3) {
    this.create = (n) => new Vg(n, this), this.id = /* @__PURE__ */ Symbol(`Timer-${t}`), this.name = t, this.timeout = e;
  }
}, vt = (t, e = 3e3) => new Hg(t, e);
const jg = {};
function Fl(t, e) {
  const n = jg, r = typeof n.includeImageAlt == "boolean" ? n.includeImageAlt : !0, i = typeof n.includeHtml == "boolean" ? n.includeHtml : !0;
  return Vh(t, r, i);
}
function Vh(t, e, n) {
  if (qg(t)) {
    if ("value" in t)
      return t.type === "html" && !n ? "" : t.value;
    if (e && "alt" in t && t.alt)
      return t.alt;
    if ("children" in t)
      return Oc(t.children, e, n);
  }
  return Array.isArray(t) ? Oc(t, e, n) : "";
}
function Oc(t, e, n) {
  const r = [];
  let i = -1;
  for (; ++i < t.length; )
    r[i] = Vh(t[i], e, n);
  return r.join("");
}
function qg(t) {
  return !!(t && typeof t == "object");
}
const Dc = document.createElement("i");
function $l(t) {
  const e = "&" + t + ";";
  Dc.innerHTML = e;
  const n = Dc.textContent;
  return n.charCodeAt(n.length - 1) === 59 && t !== "semi" || n === e ? !1 : n;
}
function yt(t, e, n, r) {
  const i = t.length;
  let o = 0, s;
  if (e < 0 ? e = -e > i ? 0 : i + e : e = e > i ? i : e, n = n > 0 ? n : 0, r.length < 1e4)
    s = Array.from(r), s.unshift(e, n), t.splice(...s);
  else
    for (n && t.splice(e, n); o < r.length; )
      s = r.slice(o, o + 1e4), s.unshift(e, 0), t.splice(...s), o += 1e4, e += 1e4;
}
function ot(t, e) {
  return t.length > 0 ? (yt(t, t.length, 0, e), t) : e;
}
const Rc = {}.hasOwnProperty;
function Hh(t) {
  const e = {};
  let n = -1;
  for (; ++n < t.length; )
    Wg(e, t[n]);
  return e;
}
function Wg(t, e) {
  let n;
  for (n in e) {
    const i = (Rc.call(t, n) ? t[n] : void 0) || (t[n] = {}), o = e[n];
    let s;
    if (o)
      for (s in o) {
        Rc.call(i, s) || (i[s] = []);
        const l = o[s];
        Kg(
          // @ts-expect-error Looks like a list.
          i[s],
          Array.isArray(l) ? l : l ? [l] : []
        );
      }
  }
}
function Kg(t, e) {
  let n = -1;
  const r = [];
  for (; ++n < e.length; )
    (e[n].add === "after" ? t : r).push(e[n]);
  yt(t, 0, 0, r);
}
function jh(t, e) {
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
function kt(t) {
  return t.replace(/[\t\n\r ]+/g, " ").replace(/^ | $/g, "").toLowerCase().toUpperCase();
}
const Ne = pn(/[A-Za-z]/), ze = pn(/[\dA-Za-z]/), Ug = pn(/[#-'*+\--9=?A-Z^-~]/);
function eo(t) {
  return (
    // Special whitespace codes (which have negative values), C0 and Control
    // character DEL
    t !== null && (t < 32 || t === 127)
  );
}
const Vs = pn(/\d/), Jg = pn(/[\dA-Fa-f]/), qh = pn(/[!-/:-@[-`{-~]/);
function V(t) {
  return t !== null && t < -2;
}
function oe(t) {
  return t !== null && (t < 0 || t === 32);
}
function G(t) {
  return t === -2 || t === -1 || t === 32;
}
const xo = pn(new RegExp("\\p{P}|\\p{S}", "u")), Bn = pn(/\s/);
function pn(t) {
  return e;
  function e(n) {
    return n !== null && n > -1 && t.test(String.fromCharCode(n));
  }
}
function Z(t, e, n, r) {
  const i = r ? r - 1 : 1 / 0;
  let o = 0;
  return s;
  function s(a) {
    return G(a) ? (t.enter(n), l(a)) : e(a);
  }
  function l(a) {
    return G(a) && o++ < i ? (t.consume(a), l) : (t.exit(n), e(a));
  }
}
function Wh(t, e, n, r, i, o) {
  let s = 0;
  return l;
  function l(u) {
    return G(u) ? (t.enter(r), a(u)) : c(u);
  }
  function a(u) {
    return G(u) && s < o ? (t.consume(u), s++, a) : (t.exit(r), c(u));
  }
  function c(u) {
    return s >= i ? e(u) : n(u);
  }
}
const Gg = {
  tokenize: Yg
};
function Yg(t) {
  const e = t.attempt(this.parser.constructs.contentInitial, r, i);
  let n;
  return e;
  function r(l) {
    if (l === null) {
      t.consume(l);
      return;
    }
    return t.enter("lineEnding"), t.consume(l), t.exit("lineEnding"), Z(t, e, "linePrefix");
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
    return V(l) ? (t.consume(l), t.exit("chunkText"), o) : (t.consume(l), s);
  }
}
let to = class {
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
    zc(this, e, n, r, !1);
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
    zc(this, e, n, r, !0);
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
function zc(t, e, n, r, i) {
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
const Xg = {
  tokenize: Qg
}, Lc = {
  tokenize: Zg
};
function Qg(t) {
  const e = this, n = [];
  let r = 0, i, o, s;
  return l;
  function l(C) {
    if (r < n.length) {
      const E = n[r];
      return e.containerState = E[1], t.attempt(E[0].continuation, a, c)(C);
    }
    return c(C);
  }
  function a(C) {
    if (r++, e.containerState._closeFlow) {
      e.containerState._closeFlow = void 0, i && S();
      const E = e.events.length;
      let O = E, x;
      for (; O--; )
        if (e.events[O][0] === "exit" && e.events[O][1].type === "chunkFlow") {
          x = e.events[O][1].end;
          break;
        }
      g(r);
      let A = E;
      for (; A < e.events.length; )
        e.events[A][1].end = {
          ...x
        }, A++;
      const D = new to();
      return D.add(O + 1, 0, e.events.slice(E)), D.add(E, A - E, []), D.consume(e.events), c(C);
    }
    return l(C);
  }
  function c(C) {
    if (r === n.length) {
      if (!i)
        return d(C);
      if (i.currentConstruct && i.currentConstruct.concrete)
        return p(C);
      e.interrupt = !!(i.currentConstruct && !i._gfmTableDynamicInterruptHack);
    }
    return e.containerState = {}, t.check(Lc, u, h)(C);
  }
  function u(C) {
    return i && S(), g(r), d(C);
  }
  function h(C) {
    return e.parser.lazy[e.now().line] = r !== n.length, s = e.now().offset, p(C);
  }
  function d(C) {
    return e.containerState = {}, t.attempt(Lc, f, p)(C);
  }
  function f(C) {
    return r++, n.push([e.currentConstruct, e.containerState]), d(C);
  }
  function p(C) {
    if (C === null) {
      i && S(), g(0), t.consume(C);
      return;
    }
    return i = i || e.parser.flow(e.now()), t.enter("chunkFlow", {
      _tokenizer: i,
      contentType: "flow",
      previous: o
    }), m(C);
  }
  function m(C) {
    if (C === null) {
      y(t.exit("chunkFlow"), !0), g(0), t.consume(C);
      return;
    }
    return V(C) ? (t.consume(C), y(t.exit("chunkFlow")), r = 0, e.interrupt = void 0, l) : (t.consume(C), m);
  }
  function y(C, E) {
    const O = e.sliceStream(C);
    if (E && O.push(null), C.previous = o, o && (o.next = C), o = C, i.defineSkip(C.start), i.write(O), e.parser.lazy[C.start.line]) {
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
      let D = A, F, N;
      for (; D--; )
        if (e.events[D][0] === "exit" && e.events[D][1].type === "chunkFlow") {
          if (F) {
            N = e.events[D][1].end;
            break;
          }
          F = !0;
        }
      for (g(r), x = A; x < e.events.length; )
        e.events[x][1].end = {
          ...N
        }, x++;
      const R = new to();
      R.add(D + 1, 0, e.events.slice(A)), R.add(A, x - A, []), R.consume(e.events);
    }
  }
  function g(C) {
    let E = n.length;
    for (; E-- > C; ) {
      const O = n[E];
      e.containerState = O[1], O[0].exit.call(e, t);
    }
    n.length = C;
  }
  function S() {
    i.write([null]), o = void 0, i = void 0, e.containerState._closeFlow = void 0;
  }
}
function Zg(t, e, n) {
  return Z(t, t.attempt(this.parser.constructs.document, e, n), "linePrefix", this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
}
function Mt(t) {
  if (t === null || oe(t) || Bn(t))
    return 1;
  if (xo(t))
    return 2;
}
function Co(t, e, n) {
  const r = [];
  let i = -1;
  for (; ++i < t.length; ) {
    const o = t[i].resolveAll;
    o && !r.includes(o) && (e = o(e, n), r.push(o));
  }
  return e;
}
const Hs = {
  name: "attention",
  resolveAll: ey,
  tokenize: ty
};
function ey(t, e) {
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
          Pc(s, -o), Pc(l, o);
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
          }, r = [], t[i][1].end.offset - t[i][1].start.offset && (r = ot(r, [["enter", t[i][1], e], ["exit", t[i][1], e]])), r = ot(r, [["enter", h, e], ["enter", a, e], ["exit", a, e], ["enter", u, e]]), r = ot(r, Co(e.parser.constructs.insideSpan.null, t.slice(i + 1, n), e)), r = ot(r, [["exit", u, e], ["enter", c, e], ["exit", c, e], ["exit", h, e]]);
          let d = 0;
          t[n][1].end.offset - t[n][1].start.offset && (d = 2, r = ot(r, [["enter", t[n][1], e], ["exit", t[n][1], e]])), yt(t, i - 1, n - i + 3, r), n = i + r.length - d - 2;
          break;
        }
    }
  for (n = -1; ++n < t.length; )
    t[n][1].type === "attentionSequence" && (t[n][1].type = "data");
  return t;
}
function ty(t, e) {
  const n = this.parser.constructs.attentionMarkers.null, r = this.previous, i = Mt(r);
  let o;
  return s;
  function s(a) {
    return o = a, t.enter("attentionSequence"), l(a);
  }
  function l(a) {
    if (a === o)
      return t.consume(a), l;
    const c = t.exit("attentionSequence"), u = Mt(a), h = !u || u === 2 && i || n.includes(a) && a !== 42 && a !== 95, d = !i || i === 2 && u || n.includes(r) && r !== 42 && r !== 95;
    return c._open = !!(o === 42 ? h : h && (i || !d)), c._close = !!(o === 42 ? d : d && (u || !h)), e(a);
  }
}
function Pc(t, e) {
  t.column += e, t.offset += e, t._bufferIndex += e;
}
const ny = {
  name: "autolink",
  tokenize: ry
};
function ry(t, e, n) {
  let r = 0;
  return i;
  function i(f) {
    return t.enter("autolink"), t.enter("autolinkMarker"), t.consume(f), t.exit("autolinkMarker"), t.enter("autolinkProtocol"), o;
  }
  function o(f) {
    return Ne(f) ? (t.consume(f), s) : f === 64 ? n(f) : c(f);
  }
  function s(f) {
    return f === 43 || f === 45 || f === 46 || ze(f) ? (r = 1, l(f)) : c(f);
  }
  function l(f) {
    return f === 58 ? (t.consume(f), r = 0, a) : (f === 43 || f === 45 || f === 46 || ze(f)) && r++ < 32 ? (t.consume(f), l) : (r = 0, c(f));
  }
  function a(f) {
    return f === 62 ? (t.exit("autolinkProtocol"), t.enter("autolinkMarker"), t.consume(f), t.exit("autolinkMarker"), t.exit("autolink"), e) : f === null || f === 32 || f === 60 || eo(f) ? n(f) : (t.consume(f), a);
  }
  function c(f) {
    return f === 64 ? (t.consume(f), u) : Ug(f) ? (t.consume(f), c) : n(f);
  }
  function u(f) {
    return ze(f) ? h(f) : n(f);
  }
  function h(f) {
    return f === 46 ? (t.consume(f), r = 0, u) : f === 62 ? (t.exit("autolinkProtocol").type = "autolinkEmail", t.enter("autolinkMarker"), t.consume(f), t.exit("autolinkMarker"), t.exit("autolink"), e) : d(f);
  }
  function d(f) {
    if ((f === 45 || ze(f)) && r++ < 63) {
      const p = f === 45 ? d : h;
      return t.consume(f), p;
    }
    return n(f);
  }
}
const ai = {
  partial: !0,
  tokenize: iy
};
function iy(t, e, n) {
  return r;
  function r(o) {
    return G(o) ? Z(t, i, "linePrefix")(o) : i(o);
  }
  function i(o) {
    return o === null || V(o) ? e(o) : n(o);
  }
}
const Kh = {
  continuation: {
    tokenize: sy
  },
  exit: ly,
  name: "blockQuote",
  tokenize: oy
};
function oy(t, e, n) {
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
    return G(s) ? (t.enter("blockQuotePrefixWhitespace"), t.consume(s), t.exit("blockQuotePrefixWhitespace"), t.exit("blockQuotePrefix"), e) : (t.exit("blockQuotePrefix"), e(s));
  }
}
function sy(t, e, n) {
  const r = this;
  return i;
  function i(s) {
    return G(s) ? Z(t, o, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(s) : o(s);
  }
  function o(s) {
    return t.attempt(Kh, e, n)(s);
  }
}
function ly(t) {
  t.exit("blockQuote");
}
const Uh = {
  name: "characterEscape",
  tokenize: ay
};
function ay(t, e, n) {
  return r;
  function r(o) {
    return t.enter("characterEscape"), t.enter("escapeMarker"), t.consume(o), t.exit("escapeMarker"), i;
  }
  function i(o) {
    return qh(o) ? (t.enter("characterEscapeValue"), t.consume(o), t.exit("characterEscapeValue"), t.exit("characterEscape"), e) : n(o);
  }
}
const Jh = {
  name: "characterReference",
  tokenize: cy
};
function cy(t, e, n) {
  const r = this;
  let i = 0, o, s;
  return l;
  function l(h) {
    return t.enter("characterReference"), t.enter("characterReferenceMarker"), t.consume(h), t.exit("characterReferenceMarker"), a;
  }
  function a(h) {
    return h === 35 ? (t.enter("characterReferenceMarkerNumeric"), t.consume(h), t.exit("characterReferenceMarkerNumeric"), c) : (t.enter("characterReferenceValue"), o = 31, s = ze, u(h));
  }
  function c(h) {
    return h === 88 || h === 120 ? (t.enter("characterReferenceMarkerHexadecimal"), t.consume(h), t.exit("characterReferenceMarkerHexadecimal"), t.enter("characterReferenceValue"), o = 6, s = Jg, u) : (t.enter("characterReferenceValue"), o = 7, s = Vs, u(h));
  }
  function u(h) {
    if (h === 59 && i) {
      const d = t.exit("characterReferenceValue");
      return s === ze && !$l(r.sliceSerialize(d)) ? n(h) : (t.enter("characterReferenceMarker"), t.consume(h), t.exit("characterReferenceMarker"), t.exit("characterReference"), e);
    }
    return s(h) && i++ < o ? (t.consume(h), u) : n(h);
  }
}
const js = {
  partial: !0,
  tokenize: uy
};
function uy(t, e, n) {
  const r = this;
  return i;
  function i(s) {
    return s === null ? n(s) : (t.enter("lineEnding"), t.consume(s), t.exit("lineEnding"), o);
  }
  function o(s) {
    return r.parser.lazy[r.now().line] ? n(s) : e(s);
  }
}
const Bc = {
  concrete: !0,
  name: "codeFenced",
  tokenize: hy
};
function hy(t, e, n) {
  const r = this, i = {
    partial: !0,
    tokenize: O
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
    return x === l ? (s++, t.consume(x), u) : s < 3 ? n(x) : (t.exit("codeFencedFenceSequence"), G(x) ? Z(t, h, "whitespace")(x) : h(x));
  }
  function h(x) {
    return x === null || V(x) ? (t.exit("codeFencedFence"), r.interrupt ? e(x) : t.check(js, m, E)(x)) : (t.enter("codeFencedFenceInfo"), t.enter("chunkString", {
      contentType: "string"
    }), d(x));
  }
  function d(x) {
    return x === null || V(x) ? (t.exit("chunkString"), t.exit("codeFencedFenceInfo"), h(x)) : G(x) ? (t.exit("chunkString"), t.exit("codeFencedFenceInfo"), Z(t, f, "whitespace")(x)) : x === 96 && x === l ? n(x) : (t.consume(x), d);
  }
  function f(x) {
    return x === null || V(x) ? h(x) : (t.enter("codeFencedFenceMeta"), t.enter("chunkString", {
      contentType: "string"
    }), p(x));
  }
  function p(x) {
    return x === null || V(x) ? (t.exit("chunkString"), t.exit("codeFencedFenceMeta"), h(x)) : x === 96 && x === l ? n(x) : (t.consume(x), p);
  }
  function m(x) {
    return t.attempt(i, E, y)(x);
  }
  function y(x) {
    return t.enter("lineEnding"), t.consume(x), t.exit("lineEnding"), g;
  }
  function g(x) {
    return o > 0 && G(x) ? Z(t, S, "linePrefix", o + 1)(x) : S(x);
  }
  function S(x) {
    return x === null || V(x) ? t.check(js, m, E)(x) : (t.enter("codeFlowValue"), C(x));
  }
  function C(x) {
    return x === null || V(x) ? (t.exit("codeFlowValue"), S(x)) : (t.consume(x), C);
  }
  function E(x) {
    return t.exit("codeFenced"), e(x);
  }
  function O(x, A, D) {
    let F = 0;
    return N;
    function N(Y) {
      return x.enter("lineEnding"), x.consume(Y), x.exit("lineEnding"), R;
    }
    function R(Y) {
      return x.enter("codeFencedFence"), G(Y) ? Z(x, P, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(Y) : P(Y);
    }
    function P(Y) {
      return Y === l ? (x.enter("codeFencedFenceSequence"), ee(Y)) : D(Y);
    }
    function ee(Y) {
      return Y === l ? (F++, x.consume(Y), ee) : F >= s ? (x.exit("codeFencedFenceSequence"), G(Y) ? Z(x, se, "whitespace")(Y) : se(Y)) : D(Y);
    }
    function se(Y) {
      return Y === null || V(Y) ? (x.exit("codeFencedFence"), A(Y)) : D(Y);
    }
  }
}
const Wo = {
  name: "codeIndented",
  tokenize: dy
}, fy = {
  partial: !0,
  tokenize: py
};
function dy(t, e, n) {
  return r;
  function r(l) {
    return t.enter("codeIndented"), Wh(t, i, n, "linePrefix", 4, 4)(l);
  }
  function i(l) {
    return l === null ? s(l) : V(l) ? t.attempt(fy, i, s)(l) : (t.enter("codeFlowValue"), o(l));
  }
  function o(l) {
    return l === null || V(l) ? (t.exit("codeFlowValue"), i(l)) : (t.consume(l), o);
  }
  function s(l) {
    return t.exit("codeIndented"), e(l);
  }
}
function py(t, e, n) {
  const r = this;
  return i;
  function i(s) {
    return r.parser.lazy[r.now().line] ? n(s) : V(s) ? (t.enter("lineEnding"), t.consume(s), t.exit("lineEnding"), i) : Wh(t, e, o, "linePrefix", 4, 4)(s);
  }
  function o(s) {
    return V(s) ? i(s) : n(s);
  }
}
const my = {
  name: "codeText",
  previous: yy,
  resolve: gy,
  tokenize: ky
};
function gy(t) {
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
function yy(t) {
  return t !== 96 || this.events[this.events.length - 1][1].type === "characterEscape";
}
function ky(t, e, n) {
  let r = 0, i, o;
  return s;
  function s(h) {
    return t.enter("codeText"), t.enter("codeTextSequence"), l(h);
  }
  function l(h) {
    return h === 96 ? (t.consume(h), r++, l) : (t.exit("codeTextSequence"), a(h));
  }
  function a(h) {
    return h === null ? n(h) : h === 32 ? (t.enter("space"), t.consume(h), t.exit("space"), a) : h === 96 ? (o = t.enter("codeTextSequence"), i = 0, u(h)) : V(h) ? (t.enter("lineEnding"), t.consume(h), t.exit("lineEnding"), a) : (t.enter("codeTextData"), c(h));
  }
  function c(h) {
    return h === null || h === 32 || h === 96 || V(h) ? (t.exit("codeTextData"), a(h)) : (t.consume(h), c);
  }
  function u(h) {
    return h === 96 ? (t.consume(h), i++, u) : i === r ? (t.exit("codeTextSequence"), t.exit("codeText"), e(h)) : (o.type = "codeTextData", c(h));
  }
}
class by {
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
    return r && Nr(this.left, r), o.reverse();
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
    this.setCursor(Number.POSITIVE_INFINITY), Nr(this.left, e);
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
    this.setCursor(0), Nr(this.right, e.reverse());
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
        Nr(this.right, n.reverse());
      } else {
        const n = this.right.splice(this.left.length + this.right.length - e, Number.POSITIVE_INFINITY);
        Nr(this.left, n.reverse());
      }
  }
}
function Nr(t, e) {
  let n = 0;
  if (e.length < 1e4)
    t.push(...e);
  else
    for (; n < e.length; )
      t.push(...e.slice(n, n + 1e4)), n += 1e4;
}
function Gh(t) {
  const e = {};
  let n = -1, r, i, o, s, l, a, c;
  const u = new by(t);
  for (; ++n < u.length; ) {
    for (; n in e; )
      n = e[n];
    if (r = u.get(n), n && r[1].type === "chunkFlow" && u.get(n - 1)[1].type === "listItemPrefix" && (a = r[1]._tokenizer.events, o = 0, o < a.length && a[o][1].type === "lineEndingBlank" && (o += 2), o < a.length && a[o][1].type === "content"))
      for (; ++o < a.length && a[o][1].type !== "content"; )
        a[o][1].type === "chunkText" && (a[o][1]._isInFirstContentOfListItem = !0, o++);
    if (r[0] === "enter")
      r[1].contentType && (Object.assign(e, wy(u, n)), n = e[n], c = !0);
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
  return yt(t, 0, Number.POSITIVE_INFINITY, u.slice(0)), !c;
}
function wy(t, e) {
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
    const g = l.slice(y[d], y[d + 1]), S = o.pop();
    a.push([S, S + g.length - 1]), t.splice(S, 2, g);
  }
  for (a.reverse(), d = -1; ++d < a.length; )
    c[p + a[d][0]] = p + a[d][1], p += a[d][1] - a[d][0] - 1;
  return c;
}
const xy = {
  resolve: Sy,
  tokenize: Ny
}, Cy = {
  partial: !0,
  tokenize: Iy
};
function Sy(t) {
  return Gh(t), t;
}
function Ny(t, e) {
  let n;
  return r;
  function r(l) {
    return t.enter("content"), n = t.enter("chunkContent", {
      contentType: "content"
    }), i(l);
  }
  function i(l) {
    return l === null ? o(l) : V(l) ? t.check(Cy, s, o)(l) : (t.consume(l), i);
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
function Iy(t, e, n) {
  const r = this;
  return i;
  function i(s) {
    return t.exit("chunkContent"), t.enter("lineEnding"), t.consume(s), t.exit("lineEnding"), Z(t, o, "linePrefix");
  }
  function o(s) {
    if (s === null || V(s))
      return n(s);
    const l = r.events[r.events.length - 1];
    return !r.parser.constructs.disable.null.includes("codeIndented") && l && l[1].type === "linePrefix" && l[2].sliceSerialize(l[1], !0).length >= 4 ? e(s) : t.interrupt(r.parser.constructs.flow, n, e)(s);
  }
}
function Yh(t, e, n, r, i, o, s, l, a) {
  const c = a || Number.POSITIVE_INFINITY;
  let u = 0;
  return h;
  function h(g) {
    return g === 60 ? (t.enter(r), t.enter(i), t.enter(o), t.consume(g), t.exit(o), d) : g === null || g === 32 || g === 41 || eo(g) ? n(g) : (t.enter(r), t.enter(s), t.enter(l), t.enter("chunkString", {
      contentType: "string"
    }), m(g));
  }
  function d(g) {
    return g === 62 ? (t.enter(o), t.consume(g), t.exit(o), t.exit(i), t.exit(r), e) : (t.enter(l), t.enter("chunkString", {
      contentType: "string"
    }), f(g));
  }
  function f(g) {
    return g === 62 ? (t.exit("chunkString"), t.exit(l), d(g)) : g === null || g === 60 || V(g) ? n(g) : (t.consume(g), g === 92 ? p : f);
  }
  function p(g) {
    return g === 60 || g === 62 || g === 92 ? (t.consume(g), f) : f(g);
  }
  function m(g) {
    return !u && (g === null || g === 41 || oe(g)) ? (t.exit("chunkString"), t.exit(l), t.exit(s), t.exit(r), e(g)) : u < c && g === 40 ? (t.consume(g), u++, m) : g === 41 ? (t.consume(g), u--, m) : g === null || g === 32 || g === 40 || eo(g) ? n(g) : (t.consume(g), g === 92 ? y : m);
  }
  function y(g) {
    return g === 40 || g === 41 || g === 92 ? (t.consume(g), m) : m(g);
  }
}
function Xh(t, e, n, r, i, o) {
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
    f === 94 && !l && "_hiddenFootnoteSupport" in s.parser.constructs ? n(f) : f === 93 ? (t.exit(o), t.enter(i), t.consume(f), t.exit(i), t.exit(r), e) : V(f) ? (t.enter("lineEnding"), t.consume(f), t.exit("lineEnding"), u) : (t.enter("chunkString", {
      contentType: "string"
    }), h(f));
  }
  function h(f) {
    return f === null || f === 91 || f === 93 || V(f) || l++ > 999 ? (t.exit("chunkString"), u(f)) : (t.consume(f), a || (a = !G(f)), f === 92 ? d : h);
  }
  function d(f) {
    return f === 91 || f === 92 || f === 93 ? (t.consume(f), l++, h) : h(f);
  }
}
function Qh(t, e, n, r, i, o) {
  let s;
  return l;
  function l(d) {
    return d === 34 || d === 39 || d === 40 ? (t.enter(r), t.enter(i), t.consume(d), t.exit(i), s = d === 40 ? 41 : d, a) : n(d);
  }
  function a(d) {
    return d === s ? (t.enter(i), t.consume(d), t.exit(i), t.exit(r), e) : (t.enter(o), c(d));
  }
  function c(d) {
    return d === s ? (t.exit(o), a(s)) : d === null ? n(d) : V(d) ? (t.enter("lineEnding"), t.consume(d), t.exit("lineEnding"), Z(t, c, "linePrefix")) : (t.enter("chunkString", {
      contentType: "string"
    }), u(d));
  }
  function u(d) {
    return d === s || d === null || V(d) ? (t.exit("chunkString"), c(d)) : (t.consume(d), d === 92 ? h : u);
  }
  function h(d) {
    return d === s || d === 92 ? (t.consume(d), u) : u(d);
  }
}
function Lr(t, e) {
  let n;
  return r;
  function r(i) {
    return V(i) ? (t.enter("lineEnding"), t.consume(i), t.exit("lineEnding"), n = !0, r) : G(i) ? Z(t, r, n ? "linePrefix" : "lineSuffix")(i) : e(i);
  }
}
const My = {
  name: "definition",
  tokenize: Ay
}, Ty = {
  partial: !0,
  tokenize: Ey
};
function Ay(t, e, n) {
  const r = this;
  let i;
  return o;
  function o(f) {
    return t.enter("definition"), s(f);
  }
  function s(f) {
    return Xh.call(
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
    return i = kt(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1)), f === 58 ? (t.enter("definitionMarker"), t.consume(f), t.exit("definitionMarker"), a) : n(f);
  }
  function a(f) {
    return oe(f) ? Lr(t, c)(f) : c(f);
  }
  function c(f) {
    return Yh(
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
    return t.attempt(Ty, h, h)(f);
  }
  function h(f) {
    return G(f) ? Z(t, d, "whitespace")(f) : d(f);
  }
  function d(f) {
    return f === null || V(f) ? (t.exit("definition"), r.parser.defined.push(i), e(f)) : n(f);
  }
}
function Ey(t, e, n) {
  return r;
  function r(l) {
    return oe(l) ? Lr(t, i)(l) : n(l);
  }
  function i(l) {
    return Qh(t, o, n, "definitionTitle", "definitionTitleMarker", "definitionTitleString")(l);
  }
  function o(l) {
    return G(l) ? Z(t, s, "whitespace")(l) : s(l);
  }
  function s(l) {
    return l === null || V(l) ? e(l) : n(l);
  }
}
const vy = {
  name: "hardBreakEscape",
  tokenize: Oy
};
function Oy(t, e, n) {
  return r;
  function r(o) {
    return t.enter("hardBreakEscape"), t.consume(o), i;
  }
  function i(o) {
    return V(o) ? (t.exit("hardBreakEscape"), e(o)) : n(o);
  }
}
const Dy = {
  name: "headingAtx",
  resolve: Ry,
  tokenize: zy
};
function Ry(t, e) {
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
    yt(t, r, n - r + 1, [["enter", i, e], ["enter", o, e], ["exit", o, e], ["exit", i, e]]);
  }
  return t;
}
function zy(t, e, n) {
  let r = 0;
  return i;
  function i(u) {
    return t.enter("atxHeading"), o(u);
  }
  function o(u) {
    return t.enter("atxHeadingSequence"), s(u);
  }
  function s(u) {
    return u === 35 && r++ < 6 ? (t.consume(u), s) : u === null || oe(u) ? (t.exit("atxHeadingSequence"), l(u)) : n(u);
  }
  function l(u) {
    return u === 35 ? (t.enter("atxHeadingSequence"), a(u)) : u === null || V(u) ? (t.exit("atxHeading"), e(u)) : G(u) ? Z(t, l, "whitespace")(u) : (t.enter("atxHeadingText"), c(u));
  }
  function a(u) {
    return u === 35 ? (t.consume(u), a) : (t.exit("atxHeadingSequence"), l(u));
  }
  function c(u) {
    return u === null || u === 35 || oe(u) ? (t.exit("atxHeadingText"), l(u)) : (t.consume(u), c);
  }
}
const Zh = [
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
], qs = ["pre", "script", "style", "textarea"], Ly = {
  concrete: !0,
  name: "htmlFlow",
  resolveTo: By,
  tokenize: _y
}, Py = {
  partial: !0,
  tokenize: Fy
};
function By(t) {
  let e = t.length;
  for (; e-- && !(t[e][0] === "enter" && t[e][1].type === "htmlFlow"); )
    ;
  return e > 1 && t[e - 2][1].type === "linePrefix" && (t[e][1].start = t[e - 2][1].start, t[e + 1][1].start = t[e - 2][1].start, t.splice(e - 2, 2)), t;
}
function _y(t, e, n) {
  const r = this;
  let i, o, s, l, a;
  return c;
  function c(k) {
    return u(k);
  }
  function u(k) {
    return t.enter("htmlFlow"), t.enter("htmlFlowData"), t.consume(k), h;
  }
  function h(k) {
    return k === 33 ? (t.consume(k), d) : k === 47 ? (t.consume(k), o = !0, m) : k === 63 ? (t.consume(k), i = 3, r.interrupt ? e : b) : Ne(k) ? (t.consume(k), s = String.fromCharCode(k), y) : n(k);
  }
  function d(k) {
    return k === 45 ? (t.consume(k), i = 2, f) : k === 91 ? (t.consume(k), i = 5, l = 0, p) : Ne(k) ? (t.consume(k), i = 4, r.interrupt ? e : b) : n(k);
  }
  function f(k) {
    return k === 45 ? (t.consume(k), r.interrupt ? e : b) : n(k);
  }
  function p(k) {
    const be = "CDATA[";
    return k === be.charCodeAt(l++) ? (t.consume(k), l === be.length ? r.interrupt ? e : P : p) : n(k);
  }
  function m(k) {
    return Ne(k) ? (t.consume(k), s = String.fromCharCode(k), y) : n(k);
  }
  function y(k) {
    if (k === null || k === 47 || k === 62 || oe(k)) {
      const be = k === 47, xt = s.toLowerCase();
      return !be && !o && qs.includes(xt) ? (i = 1, r.interrupt ? e(k) : P(k)) : Zh.includes(s.toLowerCase()) ? (i = 6, be ? (t.consume(k), g) : r.interrupt ? e(k) : P(k)) : (i = 7, r.interrupt && !r.parser.lazy[r.now().line] ? n(k) : o ? S(k) : C(k));
    }
    return k === 45 || ze(k) ? (t.consume(k), s += String.fromCharCode(k), y) : n(k);
  }
  function g(k) {
    return k === 62 ? (t.consume(k), r.interrupt ? e : P) : n(k);
  }
  function S(k) {
    return G(k) ? (t.consume(k), S) : N(k);
  }
  function C(k) {
    return k === 47 ? (t.consume(k), N) : k === 58 || k === 95 || Ne(k) ? (t.consume(k), E) : G(k) ? (t.consume(k), C) : N(k);
  }
  function E(k) {
    return k === 45 || k === 46 || k === 58 || k === 95 || ze(k) ? (t.consume(k), E) : O(k);
  }
  function O(k) {
    return k === 61 ? (t.consume(k), x) : G(k) ? (t.consume(k), O) : C(k);
  }
  function x(k) {
    return k === null || k === 60 || k === 61 || k === 62 || k === 96 ? n(k) : k === 34 || k === 39 ? (t.consume(k), a = k, A) : G(k) ? (t.consume(k), x) : D(k);
  }
  function A(k) {
    return k === a ? (t.consume(k), a = null, F) : k === null || V(k) ? n(k) : (t.consume(k), A);
  }
  function D(k) {
    return k === null || k === 34 || k === 39 || k === 47 || k === 60 || k === 61 || k === 62 || k === 96 || oe(k) ? O(k) : (t.consume(k), D);
  }
  function F(k) {
    return k === 47 || k === 62 || G(k) ? C(k) : n(k);
  }
  function N(k) {
    return k === 62 ? (t.consume(k), R) : n(k);
  }
  function R(k) {
    return k === null || V(k) ? P(k) : G(k) ? (t.consume(k), R) : n(k);
  }
  function P(k) {
    return k === 45 && i === 2 ? (t.consume(k), me) : k === 60 && i === 1 ? (t.consume(k), ge) : k === 62 && i === 4 ? (t.consume(k), he) : k === 63 && i === 3 ? (t.consume(k), b) : k === 93 && i === 5 ? (t.consume(k), ae) : V(k) && (i === 6 || i === 7) ? (t.exit("htmlFlowData"), t.check(Py, dt, ee)(k)) : k === null || V(k) ? (t.exit("htmlFlowData"), ee(k)) : (t.consume(k), P);
  }
  function ee(k) {
    return t.check(js, se, dt)(k);
  }
  function se(k) {
    return t.enter("lineEnding"), t.consume(k), t.exit("lineEnding"), Y;
  }
  function Y(k) {
    return k === null || V(k) ? ee(k) : (t.enter("htmlFlowData"), P(k));
  }
  function me(k) {
    return k === 45 ? (t.consume(k), b) : P(k);
  }
  function ge(k) {
    return k === 47 ? (t.consume(k), s = "", Be) : P(k);
  }
  function Be(k) {
    if (k === 62) {
      const be = s.toLowerCase();
      return qs.includes(be) ? (t.consume(k), he) : P(k);
    }
    return Ne(k) && s.length < 8 ? (t.consume(k), s += String.fromCharCode(k), Be) : P(k);
  }
  function ae(k) {
    return k === 93 ? (t.consume(k), b) : P(k);
  }
  function b(k) {
    return k === 62 ? (t.consume(k), he) : k === 45 && i === 2 ? (t.consume(k), b) : P(k);
  }
  function he(k) {
    return k === null || V(k) ? (t.exit("htmlFlowData"), dt(k)) : (t.consume(k), he);
  }
  function dt(k) {
    return t.exit("htmlFlow"), e(k);
  }
}
function Fy(t, e, n) {
  return r;
  function r(i) {
    return t.enter("lineEnding"), t.consume(i), t.exit("lineEnding"), t.attempt(ai, e, n);
  }
}
const $y = {
  name: "htmlText",
  tokenize: Vy
};
function Vy(t, e, n) {
  const r = this;
  let i, o, s;
  return l;
  function l(b) {
    return t.enter("htmlText"), t.enter("htmlTextData"), t.consume(b), a;
  }
  function a(b) {
    return b === 33 ? (t.consume(b), c) : b === 47 ? (t.consume(b), O) : b === 63 ? (t.consume(b), C) : Ne(b) ? (t.consume(b), D) : n(b);
  }
  function c(b) {
    return b === 45 ? (t.consume(b), u) : b === 91 ? (t.consume(b), o = 0, p) : Ne(b) ? (t.consume(b), S) : n(b);
  }
  function u(b) {
    return b === 45 ? (t.consume(b), f) : n(b);
  }
  function h(b) {
    return b === null ? n(b) : b === 45 ? (t.consume(b), d) : V(b) ? (s = h, ge(b)) : (t.consume(b), h);
  }
  function d(b) {
    return b === 45 ? (t.consume(b), f) : h(b);
  }
  function f(b) {
    return b === 62 ? me(b) : b === 45 ? d(b) : h(b);
  }
  function p(b) {
    const he = "CDATA[";
    return b === he.charCodeAt(o++) ? (t.consume(b), o === he.length ? m : p) : n(b);
  }
  function m(b) {
    return b === null ? n(b) : b === 93 ? (t.consume(b), y) : V(b) ? (s = m, ge(b)) : (t.consume(b), m);
  }
  function y(b) {
    return b === 93 ? (t.consume(b), g) : m(b);
  }
  function g(b) {
    return b === 62 ? me(b) : b === 93 ? (t.consume(b), g) : m(b);
  }
  function S(b) {
    return b === null || b === 62 ? me(b) : V(b) ? (s = S, ge(b)) : (t.consume(b), S);
  }
  function C(b) {
    return b === null ? n(b) : b === 63 ? (t.consume(b), E) : V(b) ? (s = C, ge(b)) : (t.consume(b), C);
  }
  function E(b) {
    return b === 62 ? me(b) : C(b);
  }
  function O(b) {
    return Ne(b) ? (t.consume(b), x) : n(b);
  }
  function x(b) {
    return b === 45 || ze(b) ? (t.consume(b), x) : A(b);
  }
  function A(b) {
    return V(b) ? (s = A, ge(b)) : G(b) ? (t.consume(b), A) : me(b);
  }
  function D(b) {
    return b === 45 || ze(b) ? (t.consume(b), D) : b === 47 || b === 62 || oe(b) ? F(b) : n(b);
  }
  function F(b) {
    return b === 47 ? (t.consume(b), me) : b === 58 || b === 95 || Ne(b) ? (t.consume(b), N) : V(b) ? (s = F, ge(b)) : G(b) ? (t.consume(b), F) : me(b);
  }
  function N(b) {
    return b === 45 || b === 46 || b === 58 || b === 95 || ze(b) ? (t.consume(b), N) : R(b);
  }
  function R(b) {
    return b === 61 ? (t.consume(b), P) : V(b) ? (s = R, ge(b)) : G(b) ? (t.consume(b), R) : F(b);
  }
  function P(b) {
    return b === null || b === 60 || b === 61 || b === 62 || b === 96 ? n(b) : b === 34 || b === 39 ? (t.consume(b), i = b, ee) : V(b) ? (s = P, ge(b)) : G(b) ? (t.consume(b), P) : (t.consume(b), se);
  }
  function ee(b) {
    return b === i ? (t.consume(b), i = void 0, Y) : b === null ? n(b) : V(b) ? (s = ee, ge(b)) : (t.consume(b), ee);
  }
  function se(b) {
    return b === null || b === 34 || b === 39 || b === 60 || b === 61 || b === 96 ? n(b) : b === 47 || b === 62 || oe(b) ? F(b) : (t.consume(b), se);
  }
  function Y(b) {
    return b === 47 || b === 62 || oe(b) ? F(b) : n(b);
  }
  function me(b) {
    return b === 62 ? (t.consume(b), t.exit("htmlTextData"), t.exit("htmlText"), e) : n(b);
  }
  function ge(b) {
    return t.exit("htmlTextData"), t.enter("lineEnding"), t.consume(b), t.exit("lineEnding"), Be;
  }
  function Be(b) {
    return G(b) ? Z(t, ae, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(b) : ae(b);
  }
  function ae(b) {
    return t.enter("htmlTextData"), s(b);
  }
}
const Vl = {
  name: "labelEnd",
  resolveAll: Wy,
  resolveTo: Ky,
  tokenize: Uy
}, Hy = {
  tokenize: Jy
}, jy = {
  tokenize: Gy
}, qy = {
  tokenize: Yy
};
function Wy(t) {
  let e = -1;
  const n = [];
  for (; ++e < t.length; ) {
    const r = t[e][1];
    if (n.push(t[e]), r.type === "labelImage" || r.type === "labelLink" || r.type === "labelEnd") {
      const i = r.type === "labelImage" ? 4 : 2;
      r.type = "data", e += i;
    }
  }
  return t.length !== n.length && yt(t, 0, t.length, n), t;
}
function Ky(t, e) {
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
  return s = [["enter", l, e], ["enter", a, e]], s = ot(s, t.slice(i + 1, i + r + 3)), s = ot(s, [["enter", c, e]]), s = ot(s, Co(e.parser.constructs.insideSpan.null, t.slice(i + r + 4, o - 3), e)), s = ot(s, [["exit", c, e], t[o - 2], t[o - 1], ["exit", a, e]]), s = ot(s, t.slice(o + 1)), s = ot(s, [["exit", l, e]]), yt(t, i, t.length, s), t;
}
function Uy(t, e, n) {
  const r = this, i = r._labelStarts;
  let o, s;
  if (i) {
    for (; i.length > 0 && i[i.length - 1]._balanced; )
      i.pop();
    o = i[i.length - 1];
  }
  return l;
  function l(d) {
    return o ? o._inactive ? h(d) : (s = r.parser.defined.includes(kt(r.sliceSerialize({
      start: o.end,
      end: r.now()
    }))), t.enter("labelEnd"), t.enter("labelMarker"), t.consume(d), t.exit("labelMarker"), t.exit("labelEnd"), a) : n(d);
  }
  function a(d) {
    return d === 40 ? t.attempt(Hy, u, s ? u : h)(d) : d === 91 ? t.attempt(jy, u, s ? c : h)(d) : s ? u(d) : h(d);
  }
  function c(d) {
    return t.attempt(qy, u, h)(d);
  }
  function u(d) {
    return i.pop(), e(d);
  }
  function h(d) {
    return o._balanced = !0, n(d);
  }
}
function Jy(t, e, n) {
  return r;
  function r(h) {
    return t.enter("resource"), t.enter("resourceMarker"), t.consume(h), t.exit("resourceMarker"), i;
  }
  function i(h) {
    return oe(h) ? Lr(t, o)(h) : o(h);
  }
  function o(h) {
    return h === 41 ? u(h) : Yh(t, s, l, "resourceDestination", "resourceDestinationLiteral", "resourceDestinationLiteralMarker", "resourceDestinationRaw", "resourceDestinationString", 32)(h);
  }
  function s(h) {
    return oe(h) ? Lr(t, a)(h) : u(h);
  }
  function l(h) {
    return n(h);
  }
  function a(h) {
    return h === 34 || h === 39 || h === 40 ? Qh(t, c, n, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(h) : u(h);
  }
  function c(h) {
    return oe(h) ? Lr(t, u)(h) : u(h);
  }
  function u(h) {
    return h === 41 ? (t.enter("resourceMarker"), t.consume(h), t.exit("resourceMarker"), t.exit("resource"), e) : n(h);
  }
}
function Gy(t, e, n) {
  const r = this;
  return i;
  function i(l) {
    return Xh.call(r, t, o, s, "reference", "referenceMarker", "referenceString")(l);
  }
  function o(l) {
    return r.parser.defined.includes(kt(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1))) ? e(l) : n(l);
  }
  function s(l) {
    return n(l);
  }
}
function Yy(t, e, n) {
  return r;
  function r(o) {
    return t.enter("reference"), t.enter("referenceMarker"), t.consume(o), t.exit("referenceMarker"), i;
  }
  function i(o) {
    return o === 93 ? (t.enter("referenceMarker"), t.consume(o), t.exit("referenceMarker"), t.exit("reference"), e) : n(o);
  }
}
const Xy = {
  name: "labelStartImage",
  resolveAll: Vl.resolveAll,
  tokenize: Qy
};
function Qy(t, e, n) {
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
const Zy = {
  name: "labelStartLink",
  resolveAll: Vl.resolveAll,
  tokenize: ek
};
function ek(t, e, n) {
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
const Ko = {
  name: "lineEnding",
  tokenize: tk
};
function tk(t, e) {
  return n;
  function n(r) {
    return t.enter("lineEnding"), t.consume(r), t.exit("lineEnding"), Z(t, e, "linePrefix");
  }
}
const Fi = {
  name: "thematicBreak",
  tokenize: nk
};
function nk(t, e, n) {
  let r = 0, i;
  return o;
  function o(c) {
    return t.enter("thematicBreak"), s(c);
  }
  function s(c) {
    return i = c, l(c);
  }
  function l(c) {
    return c === i ? (t.enter("thematicBreakSequence"), a(c)) : r >= 3 && (c === null || V(c)) ? (t.exit("thematicBreak"), e(c)) : n(c);
  }
  function a(c) {
    return c === i ? (t.consume(c), r++, a) : (t.exit("thematicBreakSequence"), G(c) ? Z(t, l, "whitespace")(c) : l(c));
  }
}
const _e = {
  continuation: {
    tokenize: sk
  },
  exit: ak,
  name: "list",
  tokenize: ok
}, rk = {
  partial: !0,
  tokenize: ck
}, ik = {
  partial: !0,
  tokenize: lk
};
function ok(t, e, n) {
  const r = this, i = r.events[r.events.length - 1];
  let o = i && i[1].type === "linePrefix" ? i[2].sliceSerialize(i[1], !0).length : 0, s = 0;
  return l;
  function l(f) {
    const p = r.containerState.type || (f === 42 || f === 43 || f === 45 ? "listUnordered" : "listOrdered");
    if (p === "listUnordered" ? !r.containerState.marker || f === r.containerState.marker : Vs(f)) {
      if (r.containerState.type || (r.containerState.type = p, t.enter(p, {
        _container: !0
      })), p === "listUnordered")
        return t.enter("listItemPrefix"), f === 42 || f === 45 ? t.check(Fi, n, c)(f) : c(f);
      if (!r.interrupt || f === 49)
        return t.enter("listItemPrefix"), t.enter("listItemValue"), a(f);
    }
    return n(f);
  }
  function a(f) {
    return Vs(f) && ++s < 10 ? (t.consume(f), a) : (!r.interrupt || s < 2) && (r.containerState.marker ? f === r.containerState.marker : f === 41 || f === 46) ? (t.exit("listItemValue"), c(f)) : n(f);
  }
  function c(f) {
    return t.enter("listItemMarker"), t.consume(f), t.exit("listItemMarker"), r.containerState.marker = r.containerState.marker || f, t.check(
      ai,
      // Can’t be empty when interrupting.
      r.interrupt ? n : u,
      t.attempt(rk, d, h)
    );
  }
  function u(f) {
    return r.containerState.initialBlankLine = !0, o++, d(f);
  }
  function h(f) {
    return G(f) ? (t.enter("listItemPrefixWhitespace"), t.consume(f), t.exit("listItemPrefixWhitespace"), d) : n(f);
  }
  function d(f) {
    return r.containerState.size = o + r.sliceSerialize(t.exit("listItemPrefix"), !0).length, e(f);
  }
}
function sk(t, e, n) {
  const r = this;
  return r.containerState._closeFlow = void 0, t.check(ai, i, o);
  function i(l) {
    return r.containerState.furtherBlankLines = r.containerState.furtherBlankLines || r.containerState.initialBlankLine, Z(t, e, "listItemIndent", r.containerState.size + 1)(l);
  }
  function o(l) {
    return r.containerState.furtherBlankLines || !G(l) ? (r.containerState.furtherBlankLines = void 0, r.containerState.initialBlankLine = void 0, s(l)) : (r.containerState.furtherBlankLines = void 0, r.containerState.initialBlankLine = void 0, t.attempt(ik, e, s)(l));
  }
  function s(l) {
    return r.containerState._closeFlow = !0, r.interrupt = void 0, Z(t, t.attempt(_e, e, n), "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(l);
  }
}
function lk(t, e, n) {
  const r = this;
  return Z(t, i, "listItemIndent", r.containerState.size + 1);
  function i(o) {
    const s = r.events[r.events.length - 1];
    return s && s[1].type === "listItemIndent" && s[2].sliceSerialize(s[1], !0).length === r.containerState.size ? e(o) : n(o);
  }
}
function ak(t) {
  t.exit(this.containerState.type);
}
function ck(t, e, n) {
  const r = this;
  return Z(t, i, "listItemPrefixWhitespace", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 5);
  function i(o) {
    const s = r.events[r.events.length - 1];
    return !G(o) && s && s[1].type === "listItemPrefixWhitespace" ? e(o) : n(o);
  }
}
const _c = {
  name: "setextUnderline",
  resolveTo: uk,
  tokenize: hk
};
function uk(t, e) {
  const n = new to();
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
function hk(t, e, n) {
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
    return c === i ? (t.consume(c), l) : (t.exit("setextHeadingLineSequence"), G(c) ? Z(t, a, "lineSuffix")(c) : a(c));
  }
  function a(c) {
    return c === null || V(c) ? (t.exit("setextHeadingLine"), e(c)) : n(c);
  }
}
const fk = {
  tokenize: dk
};
function dk(t) {
  const e = this, n = t.attempt(
    // Try to parse a blank line.
    ai,
    r,
    // Try to parse initial flow (essentially, only code).
    t.attempt(this.parser.constructs.flowInitial, i, Z(t, t.attempt(this.parser.constructs.flow, i, t.attempt(xy, i)), "linePrefix"))
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
const pk = {
  resolveAll: tf()
}, mk = ef("string"), gk = ef("text");
function ef(t) {
  return {
    resolveAll: tf(t === "text" ? yk : void 0),
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
function tf(t) {
  return e;
  function e(n, r) {
    let i = -1, o;
    for (; ++i <= n.length; )
      o === void 0 ? n[i] && n[i][1].type === "data" && (o = i, i++) : (!n[i] || n[i][1].type !== "data") && (i !== o + 2 && (n[o][1].end = n[i - 1][1].end, n.splice(o + 2, i - o - 2), i = o + 2), o = void 0);
    return t ? t(n, r) : n;
  }
}
function yk(t, e) {
  const n = new to();
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
const kk = {
  42: _e,
  43: _e,
  45: _e,
  48: _e,
  49: _e,
  50: _e,
  51: _e,
  52: _e,
  53: _e,
  54: _e,
  55: _e,
  56: _e,
  57: _e,
  62: Kh
}, bk = {
  91: My
}, wk = {
  [-2]: Wo,
  [-1]: Wo,
  32: Wo
}, xk = {
  35: Dy,
  42: Fi,
  45: [_c, Fi],
  60: Ly,
  61: _c,
  95: Fi,
  96: Bc,
  126: Bc
}, Ck = {
  38: Jh,
  92: Uh
}, Sk = {
  [-5]: Ko,
  [-4]: Ko,
  [-3]: Ko,
  33: Xy,
  38: Jh,
  42: Hs,
  60: [ny, $y],
  91: Zy,
  92: [vy, Uh],
  93: Vl,
  95: Hs,
  96: my
}, Nk = {
  null: [Hs, pk]
}, Ik = {
  null: [42, 95]
}, Mk = {
  null: []
}, Tk = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  attentionMarkers: Ik,
  contentInitial: bk,
  disable: Mk,
  document: kk,
  flow: xk,
  flowInitial: wk,
  insideSpan: Nk,
  string: Ck,
  text: Sk
}, Symbol.toStringTag, { value: "Module" }));
function Ak(t, e, n) {
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
    attempt: A(O),
    check: A(x),
    consume: S,
    enter: C,
    exit: E,
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
  function h(R) {
    return s = ot(s, R), y(), s[s.length - 1] !== null ? [] : (D(e, 0), c.events = Co(o, c.events, c), c.events);
  }
  function d(R, P) {
    return vk(f(R), P);
  }
  function f(R) {
    return Ek(s, R);
  }
  function p() {
    const {
      _bufferIndex: R,
      _index: P,
      line: ee,
      column: se,
      offset: Y
    } = r;
    return {
      _bufferIndex: R,
      _index: P,
      line: ee,
      column: se,
      offset: Y
    };
  }
  function m(R) {
    i[R.line] = R.column, N();
  }
  function y() {
    for (; r._index < s.length; ) {
      const R = s[r._index];
      if (typeof R == "string") {
        const P = r._index;
        for (r._bufferIndex < 0 && (r._bufferIndex = 0); r._index === P && r._bufferIndex < R.length; )
          g(R.charCodeAt(r._bufferIndex));
      } else
        g(R);
    }
  }
  function g(R) {
    u = u(R);
  }
  function S(R) {
    V(R) ? (r.line++, r.column = 1, r.offset += R === -3 ? 2 : 1, N()) : R !== -1 && (r.column++, r.offset++), r._bufferIndex < 0 ? r._index++ : (r._bufferIndex++, r._bufferIndex === // Points w/ non-negative `_bufferIndex` reference
    // strings.
    /** @type {string} */
    s[r._index].length && (r._bufferIndex = -1, r._index++)), c.previous = R;
  }
  function C(R, P) {
    const ee = P || {};
    return ee.type = R, ee.start = p(), c.events.push(["enter", ee, c]), l.push(ee), ee;
  }
  function E(R) {
    const P = l.pop();
    return P.end = p(), c.events.push(["exit", P, c]), P;
  }
  function O(R, P) {
    D(R, P.from);
  }
  function x(R, P) {
    P.restore();
  }
  function A(R, P) {
    return ee;
    function ee(se, Y, me) {
      let ge, Be, ae, b;
      return Array.isArray(se) ? (
        /* c8 ignore next 1 */
        dt(se)
      ) : "tokenize" in se ? (
        // Looks like a construct.
        dt([
          /** @type {Construct} */
          se
        ])
      ) : he(se);
      function he(re) {
        return Re;
        function Re(pt) {
          const Ke = pt !== null && re[pt], Ue = pt !== null && re.null, Xt = [
            // To do: add more extension tests.
            /* c8 ignore next 2 */
            ...Array.isArray(Ke) ? Ke : Ke ? [Ke] : [],
            ...Array.isArray(Ue) ? Ue : Ue ? [Ue] : []
          ];
          return dt(Xt)(pt);
        }
      }
      function dt(re) {
        return ge = re, Be = 0, re.length === 0 ? me : k(re[Be]);
      }
      function k(re) {
        return Re;
        function Re(pt) {
          return b = F(), ae = re, re.partial || (c.currentConstruct = re), re.name && c.parser.constructs.disable.null.includes(re.name) ? xt() : re.tokenize.call(
            // If we do have fields, create an object w/ `context` as its
            // prototype.
            // This allows a “live binding”, which is needed for `interrupt`.
            P ? Object.assign(Object.create(c), P) : c,
            a,
            be,
            xt
          )(pt);
        }
      }
      function be(re) {
        return R(ae, b), Y;
      }
      function xt(re) {
        return b.restore(), ++Be < ge.length ? k(ge[Be]) : me;
      }
    }
  }
  function D(R, P) {
    R.resolveAll && !o.includes(R) && o.push(R), R.resolve && yt(c.events, P, c.events.length - P, R.resolve(c.events.slice(P), c)), R.resolveTo && (c.events = R.resolveTo(c.events, c));
  }
  function F() {
    const R = p(), P = c.previous, ee = c.currentConstruct, se = c.events.length, Y = Array.from(l);
    return {
      from: se,
      restore: me
    };
    function me() {
      r = R, c.previous = P, c.currentConstruct = ee, c.events.length = se, l = Y, N();
    }
  }
  function N() {
    r.line in i && r.column < 2 && (r.column = i[r.line], r.offset += i[r.line] - 1);
  }
}
function Ek(t, e) {
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
function vk(t, e) {
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
function Ok(t) {
  const r = {
    constructs: (
      /** @type {FullNormalizedExtension} */
      Hh([Tk, ...(t || {}).extensions || []])
    ),
    content: i(Gg),
    defined: [],
    document: i(Xg),
    flow: i(fk),
    lazy: {},
    string: i(mk),
    text: i(gk)
  };
  return r;
  function i(o) {
    return s;
    function s(l) {
      return Ak(r, o, l);
    }
  }
}
function Dk(t) {
  for (; !Gh(t); )
    ;
  return t;
}
const Fc = /[\0\t\n\r]/g;
function Rk() {
  let t = 1, e = "", n = !0, r;
  return i;
  function i(o, s, l) {
    o = e + (typeof o == "string" ? o.toString() : new TextDecoder(s || void 0).decode(o));
    const a = [];
    let c = 0;
    for (e = "", n && (o.charCodeAt(0) === 65279 && c++, n = void 0); c < o.length; ) {
      Fc.lastIndex = c;
      const u = Fc.exec(o), h = u && u.index !== void 0 ? u.index : o.length, d = o.charCodeAt(h);
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
const zk = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
function nf(t) {
  return t.replace(zk, Lk);
}
function Lk(t, e, n) {
  if (e)
    return e;
  if (n.charCodeAt(0) === 35) {
    const i = n.charCodeAt(1), o = i === 120 || i === 88;
    return jh(n.slice(o ? 2 : 1), o ? 16 : 10);
  }
  return $l(n) || t;
}
function Pr(t) {
  return !t || typeof t != "object" ? "" : "position" in t || "type" in t ? $c(t.position) : "start" in t || "end" in t ? $c(t) : "line" in t || "column" in t ? Ws(t) : "";
}
function Ws(t) {
  return Vc(t && t.line) + ":" + Vc(t && t.column);
}
function $c(t) {
  return Ws(t && t.start) + "-" + Ws(t && t.end);
}
function Vc(t) {
  return t && typeof t == "number" ? t : 1;
}
const rf = {}.hasOwnProperty;
function Pk(t, e, n) {
  return e && typeof e == "object" && (n = e, e = void 0), Bk(n)(Dk(Ok(n).document().write(Rk()(t, e, !0))));
}
function Bk(t) {
  const e = {
    transforms: [],
    canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
    enter: {
      autolink: o(Ti),
      autolinkProtocol: F,
      autolinkEmail: F,
      atxHeading: o(qn),
      blockQuote: o(Ue),
      characterEscape: F,
      characterReference: F,
      codeFenced: o(Xt),
      codeFencedFenceInfo: s,
      codeFencedFenceMeta: s,
      codeIndented: o(Xt, s),
      codeText: o(_o, s),
      codeTextData: F,
      data: F,
      codeFlowValue: F,
      definition: o(Fo),
      definitionDestinationString: s,
      definitionLabelString: s,
      definitionTitleString: s,
      emphasis: o($o),
      hardBreakEscape: o(Ii),
      hardBreakTrailing: o(Ii),
      htmlFlow: o(Mi, s),
      htmlFlowData: F,
      htmlText: o(Mi, s),
      htmlTextData: F,
      image: o(Vo),
      label: s,
      link: o(Ti),
      listItem: o(Ho),
      listItemValue: d,
      listOrdered: o(Ai, h),
      listUnordered: o(Ai),
      paragraph: o(jo),
      reference: k,
      referenceString: s,
      resourceDestinationString: s,
      resourceTitleString: s,
      setextHeading: o(qn),
      strong: o(z),
      thematicBreak: o(_)
    },
    exit: {
      atxHeading: a(),
      atxHeadingSequence: O,
      autolink: a(),
      autolinkEmail: Ke,
      autolinkProtocol: pt,
      blockQuote: a(),
      characterEscapeValue: N,
      characterReferenceMarkerHexadecimal: xt,
      characterReferenceMarkerNumeric: xt,
      characterReferenceValue: re,
      characterReference: Re,
      codeFenced: a(y),
      codeFencedFence: m,
      codeFencedFenceInfo: f,
      codeFencedFenceMeta: p,
      codeFlowValue: N,
      codeIndented: a(g),
      codeText: a(Y),
      codeTextData: N,
      data: N,
      definition: a(),
      definitionDestinationString: E,
      definitionLabelString: S,
      definitionTitleString: C,
      emphasis: a(),
      hardBreakEscape: a(P),
      hardBreakTrailing: a(P),
      htmlFlow: a(ee),
      htmlFlowData: N,
      htmlText: a(se),
      htmlTextData: N,
      image: a(ge),
      label: ae,
      labelText: Be,
      lineEnding: R,
      link: a(me),
      listItem: a(),
      listOrdered: a(),
      listUnordered: a(),
      paragraph: a(),
      referenceString: be,
      resourceDestinationString: b,
      resourceTitleString: he,
      resource: dt,
      setextHeading: a(D),
      setextHeadingLineSequence: A,
      setextHeadingText: x,
      strong: a(),
      thematicBreak: a()
    }
  };
  of(e, (t || {}).mdastExtensions || []);
  const n = {};
  return r;
  function r(w) {
    let T = {
      type: "root",
      children: []
    };
    const $ = {
      stack: [T],
      tokenStack: [],
      config: e,
      enter: l,
      exit: c,
      buffer: s,
      resume: u,
      data: n
    }, J = [];
    let ie = -1;
    for (; ++ie < w.length; )
      if (w[ie][1].type === "listOrdered" || w[ie][1].type === "listUnordered")
        if (w[ie][0] === "enter")
          J.push(ie);
        else {
          const mt = J.pop();
          ie = i(w, mt, ie);
        }
    for (ie = -1; ++ie < w.length; ) {
      const mt = e[w[ie][0]];
      rf.call(mt, w[ie][1].type) && mt[w[ie][1].type].call(Object.assign({
        sliceSerialize: w[ie][2].sliceSerialize
      }, $), w[ie][1]);
    }
    if ($.tokenStack.length > 0) {
      const mt = $.tokenStack[$.tokenStack.length - 1];
      (mt[1] || Hc).call($, void 0, mt[0]);
    }
    for (T.position = {
      start: Qt(w.length > 0 ? w[0][1].start : {
        line: 1,
        column: 1,
        offset: 0
      }),
      end: Qt(w.length > 0 ? w[w.length - 2][1].end : {
        line: 1,
        column: 1,
        offset: 0
      })
    }, ie = -1; ++ie < e.transforms.length; )
      T = e.transforms[ie](T) || T;
    return T;
  }
  function i(w, T, $) {
    let J = T - 1, ie = -1, mt = !1, bn, Dt, xr, Cr;
    for (; ++J <= $; ) {
      const Je = w[J];
      switch (Je[1].type) {
        case "listUnordered":
        case "listOrdered":
        case "blockQuote": {
          Je[0] === "enter" ? ie++ : ie--, Cr = void 0;
          break;
        }
        case "lineEndingBlank": {
          Je[0] === "enter" && (bn && !Cr && !ie && !xr && (xr = J), Cr = void 0);
          break;
        }
        case "linePrefix":
        case "listItemValue":
        case "listItemMarker":
        case "listItemPrefix":
        case "listItemPrefixWhitespace":
          break;
        default:
          Cr = void 0;
      }
      if (!ie && Je[0] === "enter" && Je[1].type === "listItemPrefix" || ie === -1 && Je[0] === "exit" && (Je[1].type === "listUnordered" || Je[1].type === "listOrdered")) {
        if (bn) {
          let Wn = J;
          for (Dt = void 0; Wn--; ) {
            const Rt = w[Wn];
            if (Rt[1].type === "lineEnding" || Rt[1].type === "lineEndingBlank") {
              if (Rt[0] === "exit") continue;
              Dt && (w[Dt][1].type = "lineEndingBlank", mt = !0), Rt[1].type = "lineEnding", Dt = Wn;
            } else if (!(Rt[1].type === "linePrefix" || Rt[1].type === "blockQuotePrefix" || Rt[1].type === "blockQuotePrefixWhitespace" || Rt[1].type === "blockQuoteMarker" || Rt[1].type === "listItemIndent")) break;
          }
          xr && (!Dt || xr < Dt) && (bn._spread = !0), bn.end = Object.assign({}, Dt ? w[Dt][1].start : Je[1].end), w.splice(Dt || J, 0, ["exit", bn, Je[2]]), J++, $++;
        }
        if (Je[1].type === "listItemPrefix") {
          const Wn = {
            type: "listItem",
            _spread: !1,
            start: Object.assign({}, Je[1].start),
            // @ts-expect-error: we’ll add `end` in a second.
            end: void 0
          };
          bn = Wn, w.splice(J, 0, ["enter", Wn, Je[2]]), J++, $++, xr = void 0, Cr = !0;
        }
      }
    }
    return w[T][1]._spread = mt, $;
  }
  function o(w, T) {
    return $;
    function $(J) {
      l.call(this, w(J), J), T && T.call(this, J);
    }
  }
  function s() {
    this.stack.push({
      type: "fragment",
      children: []
    });
  }
  function l(w, T, $) {
    this.stack[this.stack.length - 1].children.push(w), this.stack.push(w), this.tokenStack.push([T, $ || void 0]), w.position = {
      start: Qt(T.start),
      // @ts-expect-error: `end` will be patched later.
      end: void 0
    };
  }
  function a(w) {
    return T;
    function T($) {
      w && w.call(this, $), c.call(this, $);
    }
  }
  function c(w, T) {
    const $ = this.stack.pop(), J = this.tokenStack.pop();
    if (J)
      J[0].type !== w.type && (T ? T.call(this, w, J[0]) : (J[1] || Hc).call(this, w, J[0]));
    else throw new Error("Cannot close `" + w.type + "` (" + Pr({
      start: w.start,
      end: w.end
    }) + "): it’s not open");
    $.position.end = Qt(w.end);
  }
  function u() {
    return Fl(this.stack.pop());
  }
  function h() {
    this.data.expectingFirstListItemValue = !0;
  }
  function d(w) {
    if (this.data.expectingFirstListItemValue) {
      const T = this.stack[this.stack.length - 2];
      T.start = Number.parseInt(this.sliceSerialize(w), 10), this.data.expectingFirstListItemValue = void 0;
    }
  }
  function f() {
    const w = this.resume(), T = this.stack[this.stack.length - 1];
    T.lang = w;
  }
  function p() {
    const w = this.resume(), T = this.stack[this.stack.length - 1];
    T.meta = w;
  }
  function m() {
    this.data.flowCodeInside || (this.buffer(), this.data.flowCodeInside = !0);
  }
  function y() {
    const w = this.resume(), T = this.stack[this.stack.length - 1];
    T.value = w.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, ""), this.data.flowCodeInside = void 0;
  }
  function g() {
    const w = this.resume(), T = this.stack[this.stack.length - 1];
    T.value = w.replace(/(\r?\n|\r)$/g, "");
  }
  function S(w) {
    const T = this.resume(), $ = this.stack[this.stack.length - 1];
    $.label = T, $.identifier = kt(this.sliceSerialize(w)).toLowerCase();
  }
  function C() {
    const w = this.resume(), T = this.stack[this.stack.length - 1];
    T.title = w;
  }
  function E() {
    const w = this.resume(), T = this.stack[this.stack.length - 1];
    T.url = w;
  }
  function O(w) {
    const T = this.stack[this.stack.length - 1];
    if (!T.depth) {
      const $ = this.sliceSerialize(w).length;
      T.depth = $;
    }
  }
  function x() {
    this.data.setextHeadingSlurpLineEnding = !0;
  }
  function A(w) {
    const T = this.stack[this.stack.length - 1];
    T.depth = this.sliceSerialize(w).codePointAt(0) === 61 ? 1 : 2;
  }
  function D() {
    this.data.setextHeadingSlurpLineEnding = void 0;
  }
  function F(w) {
    const $ = this.stack[this.stack.length - 1].children;
    let J = $[$.length - 1];
    (!J || J.type !== "text") && (J = H(), J.position = {
      start: Qt(w.start),
      // @ts-expect-error: we’ll add `end` later.
      end: void 0
    }, $.push(J)), this.stack.push(J);
  }
  function N(w) {
    const T = this.stack.pop();
    T.value += this.sliceSerialize(w), T.position.end = Qt(w.end);
  }
  function R(w) {
    const T = this.stack[this.stack.length - 1];
    if (this.data.atHardBreak) {
      const $ = T.children[T.children.length - 1];
      $.position.end = Qt(w.end), this.data.atHardBreak = void 0;
      return;
    }
    !this.data.setextHeadingSlurpLineEnding && e.canContainEols.includes(T.type) && (F.call(this, w), N.call(this, w));
  }
  function P() {
    this.data.atHardBreak = !0;
  }
  function ee() {
    const w = this.resume(), T = this.stack[this.stack.length - 1];
    T.value = w;
  }
  function se() {
    const w = this.resume(), T = this.stack[this.stack.length - 1];
    T.value = w;
  }
  function Y() {
    const w = this.resume(), T = this.stack[this.stack.length - 1];
    T.value = w;
  }
  function me() {
    const w = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const T = this.data.referenceType || "shortcut";
      w.type += "Reference", w.referenceType = T, delete w.url, delete w.title;
    } else
      delete w.identifier, delete w.label;
    this.data.referenceType = void 0;
  }
  function ge() {
    const w = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const T = this.data.referenceType || "shortcut";
      w.type += "Reference", w.referenceType = T, delete w.url, delete w.title;
    } else
      delete w.identifier, delete w.label;
    this.data.referenceType = void 0;
  }
  function Be(w) {
    const T = this.sliceSerialize(w), $ = this.stack[this.stack.length - 2];
    $.label = nf(T), $.identifier = kt(T).toLowerCase();
  }
  function ae() {
    const w = this.stack[this.stack.length - 1], T = this.resume(), $ = this.stack[this.stack.length - 1];
    if (this.data.inReference = !0, $.type === "link") {
      const J = w.children;
      $.children = J;
    } else
      $.alt = T;
  }
  function b() {
    const w = this.resume(), T = this.stack[this.stack.length - 1];
    T.url = w;
  }
  function he() {
    const w = this.resume(), T = this.stack[this.stack.length - 1];
    T.title = w;
  }
  function dt() {
    this.data.inReference = void 0;
  }
  function k() {
    this.data.referenceType = "collapsed";
  }
  function be(w) {
    const T = this.resume(), $ = this.stack[this.stack.length - 1];
    $.label = T, $.identifier = kt(this.sliceSerialize(w)).toLowerCase(), this.data.referenceType = "full";
  }
  function xt(w) {
    this.data.characterReferenceType = w.type;
  }
  function re(w) {
    const T = this.sliceSerialize(w), $ = this.data.characterReferenceType;
    let J;
    $ ? (J = jh(T, $ === "characterReferenceMarkerNumeric" ? 10 : 16), this.data.characterReferenceType = void 0) : J = $l(T);
    const ie = this.stack[this.stack.length - 1];
    ie.value += J;
  }
  function Re(w) {
    const T = this.stack.pop();
    T.position.end = Qt(w.end);
  }
  function pt(w) {
    N.call(this, w);
    const T = this.stack[this.stack.length - 1];
    T.url = this.sliceSerialize(w);
  }
  function Ke(w) {
    N.call(this, w);
    const T = this.stack[this.stack.length - 1];
    T.url = "mailto:" + this.sliceSerialize(w);
  }
  function Ue() {
    return {
      type: "blockquote",
      children: []
    };
  }
  function Xt() {
    return {
      type: "code",
      lang: null,
      meta: null,
      value: ""
    };
  }
  function _o() {
    return {
      type: "inlineCode",
      value: ""
    };
  }
  function Fo() {
    return {
      type: "definition",
      identifier: "",
      label: null,
      title: null,
      url: ""
    };
  }
  function $o() {
    return {
      type: "emphasis",
      children: []
    };
  }
  function qn() {
    return {
      type: "heading",
      // @ts-expect-error `depth` will be set later.
      depth: 0,
      children: []
    };
  }
  function Ii() {
    return {
      type: "break"
    };
  }
  function Mi() {
    return {
      type: "html",
      value: ""
    };
  }
  function Vo() {
    return {
      type: "image",
      title: null,
      url: "",
      alt: null
    };
  }
  function Ti() {
    return {
      type: "link",
      title: null,
      url: "",
      children: []
    };
  }
  function Ai(w) {
    return {
      type: "list",
      ordered: w.type === "listOrdered",
      start: null,
      spread: w._spread,
      children: []
    };
  }
  function Ho(w) {
    return {
      type: "listItem",
      spread: w._spread,
      checked: null,
      children: []
    };
  }
  function jo() {
    return {
      type: "paragraph",
      children: []
    };
  }
  function z() {
    return {
      type: "strong",
      children: []
    };
  }
  function H() {
    return {
      type: "text",
      value: ""
    };
  }
  function _() {
    return {
      type: "thematicBreak"
    };
  }
}
function Qt(t) {
  return {
    line: t.line,
    column: t.column,
    offset: t.offset
  };
}
function of(t, e) {
  let n = -1;
  for (; ++n < e.length; ) {
    const r = e[n];
    Array.isArray(r) ? of(t, r) : _k(t, r);
  }
}
function _k(t, e) {
  let n;
  for (n in e)
    if (rf.call(e, n))
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
function Hc(t, e) {
  throw t ? new Error("Cannot close `" + t.type + "` (" + Pr({
    start: t.start,
    end: t.end
  }) + "): a different token (`" + e.type + "`, " + Pr({
    start: e.start,
    end: e.end
  }) + ") is open") : new Error("Cannot close document, a token (`" + e.type + "`, " + Pr({
    start: e.start,
    end: e.end
  }) + ") is still open");
}
function Ks(t) {
  const e = this;
  e.parser = n;
  function n(r) {
    return Pk(r, {
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
const So = (
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
      return Hk;
    if (typeof t == "function")
      return No(t);
    if (typeof t == "object")
      return Array.isArray(t) ? Fk(t) : (
        // Cast because `ReadonlyArray` goes into the above but `isArray`
        // narrows to `Array`.
        $k(
          /** @type {Props} */
          t
        )
      );
    if (typeof t == "string")
      return Vk(t);
    throw new Error("Expected function, string, or object as test");
  })
);
function Fk(t) {
  const e = [];
  let n = -1;
  for (; ++n < t.length; )
    e[n] = So(t[n]);
  return No(r);
  function r(...i) {
    let o = -1;
    for (; ++o < e.length; )
      if (e[o].apply(this, i)) return !0;
    return !1;
  }
}
function $k(t) {
  const e = (
    /** @type {Record<string, unknown>} */
    t
  );
  return No(n);
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
function Vk(t) {
  return No(e);
  function e(n) {
    return n && n.type === t;
  }
}
function No(t) {
  return e;
  function e(n, r, i) {
    return !!(jk(n) && t.call(
      this,
      n,
      typeof r == "number" ? r : void 0,
      i || void 0
    ));
  }
}
function Hk() {
  return !0;
}
function jk(t) {
  return t !== null && typeof t == "object" && "type" in t;
}
const sf = (
  /** @type {(node?: unknown) => node is Exclude<PhrasingContent, Html>} */
  So([
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
), jc = {}.hasOwnProperty;
function qk(t, e) {
  const n = e || {};
  function r(i, ...o) {
    let s = r.invalid;
    const l = r.handlers;
    if (i && jc.call(i, t)) {
      const a = String(i[t]);
      s = jc.call(l, a) ? l[a] : r.unknown;
    }
    if (s)
      return s.call(this, i, ...o);
  }
  return r.handlers = n.handlers || {}, r.invalid = n.invalid, r.unknown = n.unknown, r;
}
const Wk = {}.hasOwnProperty;
function lf(t, e) {
  let n = -1, r;
  if (e.extensions)
    for (; ++n < e.extensions.length; )
      lf(t, e.extensions[n]);
  for (r in e)
    if (Wk.call(e, r))
      switch (r) {
        case "extensions":
          break;
        /* c8 ignore next 4 */
        case "unsafe": {
          qc(t[r], e[r]);
          break;
        }
        case "join": {
          qc(t[r], e[r]);
          break;
        }
        case "handlers": {
          Kk(t[r], e[r]);
          break;
        }
        default:
          t.options[r] = e[r];
      }
  return t;
}
function qc(t, e) {
  e && t.push(...e);
}
function Kk(t, e) {
  e && Object.assign(t, e);
}
function Uk(t, e, n, r) {
  const i = n.enter("blockquote"), o = n.createTracker(r);
  o.move("> "), o.shift(2);
  const s = n.indentLines(
    n.containerFlow(t, o.current()),
    Jk
  );
  return i(), s;
}
function Jk(t, e, n) {
  return ">" + (n ? "" : " ") + t;
}
function af(t, e) {
  return Wc(t, e.inConstruct, !0) && !Wc(t, e.notInConstruct, !1);
}
function Wc(t, e, n) {
  if (typeof e == "string" && (e = [e]), !e || e.length === 0)
    return n;
  let r = -1;
  for (; ++r < e.length; )
    if (t.includes(e[r]))
      return !0;
  return !1;
}
function Kc(t, e, n, r) {
  let i = -1;
  for (; ++i < n.unsafe.length; ) {
    const o = n.unsafe[i];
    if (o.character === `
` && !o.before && !o.after && af(n.stack, o))
      return /[\t ]/.test(r.before) ? "" : " ";
  }
  return `\\
`;
}
function Gk(t, e) {
  const n = String(t);
  let r = n.indexOf(e), i = r, o = 0, s = 0;
  if (typeof e != "string")
    throw new TypeError("Expected substring");
  for (; r !== -1; )
    r === i ? ++o > s && (s = o) : o = 1, i = r + e.length, r = n.indexOf(e, i);
  return s;
}
function Us(t, e) {
  return !!(e.options.fences === !1 && t.value && // If there’s no info…
  !t.lang && // And there’s a non-whitespace character…
  /[^\n\r ]/.test(t.value) && // And the value doesn’t start or end in a blank…
  !/^[\t ]*(?:[\n\r]|$)|(?:^|[\n\r])[\t ]*$/.test(t.value));
}
function Yk(t) {
  const e = t.options.fence || "`";
  if (e !== "`" && e !== "~")
    throw new Error(
      "Cannot serialize code with `" + e + "` for `options.fence`, expected `` ` `` or `~`"
    );
  return e;
}
function Xk(t, e, n, r) {
  const i = Yk(n), o = t.value || "";
  if (Us(t, n)) {
    const h = n.enter("codeIndented"), d = n.indentLines(o, Qk);
    return h(), d;
  }
  const s = n.createTracker(r), l = i.repeat(Math.max(Gk(o, i) + 1, 3)), a = n.enter("codeFenced"), c = i === "`" ? "GraveAccent" : "Tilde";
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
function Qk(t, e, n) {
  return (n ? "" : "    ") + t;
}
function Hl(t) {
  const e = t.options.quote || '"';
  if (e !== '"' && e !== "'")
    throw new Error(
      "Cannot serialize title with `" + e + "` for `options.quote`, expected `\"`, or `'`"
    );
  return e;
}
function Zk(t, e, n, r) {
  const i = Hl(n), o = i === '"' ? "Quote" : "Apostrophe", s = n.enter("definition");
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
function eb(t) {
  const e = t.options.emphasis || "*";
  if (e !== "*" && e !== "_")
    throw new Error(
      "Cannot serialize emphasis with `" + e + "` for `options.emphasis`, expected `*`, or `_`"
    );
  return e;
}
jl.attention = tb;
jl.peek = nb;
function jl(t, e, n, r) {
  const i = n.enter("phrasing"), o = n.containerPhrasing({ type: "root", children: [t] }, r);
  return i(), o;
}
function tb(t, e) {
  return {
    construct: "emphasis",
    markers: eb(e) === "*" ? ["*", "_"] : ["_", "*"],
    sizes: [1]
  };
}
function nb(t, e, n) {
  return n.options.emphasis || "*";
}
function ql(t) {
  return "&#x" + t.toString(16).toUpperCase() + ";";
}
const cf = [], rb = !0, Js = !1, no = "skip";
function Wl(t, e, n, r) {
  let i;
  typeof e == "function" && typeof n != "function" ? (r = n, n = e) : i = e;
  const o = So(i), s = r ? -1 : 1;
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
      let f = cf, p, m, y;
      if ((!e || o(a, c, u[u.length - 1] || void 0)) && (f = ib(n(a, u)), f[0] === Js))
        return f;
      if ("children" in a && a.children) {
        const g = (
          /** @type {UnistParent} */
          a
        );
        if (g.children && f[0] !== no)
          for (m = (r ? g.children.length : -1) + s, y = u.concat(g); m > -1 && m < g.children.length; ) {
            const S = g.children[m];
            if (p = l(S, m, y)(), p[0] === Js)
              return p;
            m = typeof p[1] == "number" ? p[1] : m + s;
          }
      }
      return f;
    }
  }
}
function ib(t) {
  return Array.isArray(t) ? t : typeof t == "number" ? [rb, t] : t == null ? cf : [t];
}
function fr(t, e, n, r) {
  let i, o, s;
  typeof e == "function" && typeof n != "function" ? (o = void 0, s = e, i = n) : (o = e, s = n, i = r), Wl(t, o, l, i);
  function l(a, c) {
    const u = c[c.length - 1], h = u ? u.children.indexOf(a) : void 0;
    return s(a, h, u);
  }
}
function uf(t, e) {
  let n = !1;
  return fr(t, function(r) {
    if ("value" in r && /\r?\n|\r/.test(r.value) || r.type === "break")
      return n = !0, Js;
  }), !!((!t.depth || t.depth < 3) && Fl(t) && (e.options.setext || n));
}
function ob(t, e, n, r) {
  const i = Math.max(Math.min(6, t.depth || 1), 1), o = n.createTracker(r);
  if (uf(t, n)) {
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
  return (u === 9 || u === 32) && (c = ql(u) + c.slice(1)), c = c ? s + " " + c : s, n.options.closeAtx && (c += " " + s), a(), l(), c;
}
hf.peek = sb;
function hf(t) {
  return t.value || "";
}
function sb() {
  return "<";
}
ff.peek = lb;
function ff(t, e, n, r) {
  const i = Hl(n), o = i === '"' ? "Quote" : "Apostrophe", s = n.enter("image");
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
function lb() {
  return "!";
}
df.peek = ab;
function df(t, e, n, r) {
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
function ab() {
  return "!";
}
pf.peek = cb;
function pf(t, e, n) {
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
function cb() {
  return "`";
}
function mf(t, e) {
  const n = Fl(t);
  return !!(!e.options.resourceLink && // If there’s a url…
  t.url && // And there’s no title…
  !t.title && // And the content of `node` is a single text node…
  t.children && t.children.length === 1 && t.children[0].type === "text" && // And if the url is the same as the content…
  (n === t.url || "mailto:" + n === t.url) && // And that starts w/ a protocol…
  /^[a-z][+\-.a-z]+:/i.test(t.url) && // And that doesn’t contain ASCII control codes (character escapes and
  // references don’t work), space, or angle brackets…
  !/[\0- <>\u007F]/.test(t.url));
}
gf.peek = ub;
function gf(t, e, n, r) {
  const i = Hl(n), o = i === '"' ? "Quote" : "Apostrophe", s = n.createTracker(r);
  if (mf(t, n)) {
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
function ub(t, e, n) {
  return mf(t, n) ? "<" : "[";
}
yf.peek = hb;
function yf(t, e, n, r) {
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
function hb() {
  return "[";
}
function Kl(t) {
  const e = t.options.bullet || "*";
  if (e !== "*" && e !== "+" && e !== "-")
    throw new Error(
      "Cannot serialize items with `" + e + "` for `options.bullet`, expected `*`, `+`, or `-`"
    );
  return e;
}
function fb(t) {
  const e = Kl(t), n = t.options.bulletOther;
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
function db(t) {
  const e = t.options.bulletOrdered || ".";
  if (e !== "." && e !== ")")
    throw new Error(
      "Cannot serialize items with `" + e + "` for `options.bulletOrdered`, expected `.` or `)`"
    );
  return e;
}
function kf(t) {
  const e = t.options.rule || "*";
  if (e !== "*" && e !== "-" && e !== "_")
    throw new Error(
      "Cannot serialize rules with `" + e + "` for `options.rule`, expected `*`, `-`, or `_`"
    );
  return e;
}
function pb(t, e, n, r) {
  const i = n.enter("list"), o = n.bulletCurrent;
  let s = t.ordered ? db(n) : Kl(n);
  const l = t.ordered ? s === "." ? ")" : "." : fb(n);
  let a = e && n.bulletLastUsed ? s === n.bulletLastUsed : !1;
  if (!t.ordered) {
    const u = t.children ? t.children[0] : void 0;
    if (
      // Bullet could be used as a thematic break marker:
      (s === "*" || s === "-") && // Empty first list item:
      u && (!u.children || !u.children[0]) && // Directly in two other list items:
      n.stack[n.stack.length - 1] === "list" && n.stack[n.stack.length - 2] === "listItem" && n.stack[n.stack.length - 3] === "list" && n.stack[n.stack.length - 4] === "listItem" && // That are each the first child.
      n.indexStack[n.indexStack.length - 1] === 0 && n.indexStack[n.indexStack.length - 2] === 0 && n.indexStack[n.indexStack.length - 3] === 0 && (a = !0), kf(n) === s && u
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
function mb(t) {
  const e = t.options.listItemIndent || "one";
  if (e !== "tab" && e !== "one" && e !== "mixed")
    throw new Error(
      "Cannot serialize items with `" + e + "` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`"
    );
  return e;
}
function gb(t, e, n, r) {
  const i = mb(n);
  let o = n.bulletCurrent || Kl(n);
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
function yb(t, e, n, r) {
  const i = n.enter("paragraph"), o = n.enter("phrasing"), s = n.containerPhrasing(t, r);
  return o(), i(), s;
}
function kb(t, e, n, r) {
  if (!t.children.some(function(l) {
    return sf(l);
  })) return n.containerFlow(t, r);
  const o = n.enter("phrasing"), s = n.containerPhrasing(t, r);
  return o(), s;
}
function bb(t) {
  const e = t.options.strong || "*";
  if (e !== "*" && e !== "_")
    throw new Error(
      "Cannot serialize strong with `" + e + "` for `options.strong`, expected `*`, or `_`"
    );
  return e;
}
Ul.attention = wb;
Ul.peek = xb;
function Ul(t, e, n, r) {
  const i = n.enter("phrasing"), o = n.containerPhrasing({ type: "root", children: [t] }, r);
  return i(), o;
}
function wb(t, e) {
  return {
    construct: "strong",
    markers: bb(e) === "*" ? ["*", "_"] : ["_", "*"],
    sizes: [2]
  };
}
function xb(t, e, n) {
  return n.options.strong || "*";
}
function Cb(t, e, n, r) {
  return n.safe(t.value, r);
}
function Sb(t) {
  const e = t.options.ruleRepetition || 3;
  if (e < 3)
    throw new Error(
      "Cannot serialize rules with repetition `" + e + "` for `options.ruleRepetition`, expected `3` or more"
    );
  return e;
}
function Nb(t, e, n) {
  const r = (kf(n) + (n.options.ruleSpaces ? " " : "")).repeat(Sb(n));
  return n.options.ruleSpaces ? r.slice(0, -1) : r;
}
const Jl = {
  blockquote: Uk,
  break: Kc,
  code: Xk,
  definition: Zk,
  emphasis: jl,
  hardBreak: Kc,
  heading: ob,
  html: hf,
  image: ff,
  imageReference: df,
  inlineCode: pf,
  link: gf,
  linkReference: yf,
  list: pb,
  listItem: gb,
  paragraph: yb,
  root: kb,
  strong: Ul,
  text: Cb,
  thematicBreak: Nb
};
function Gs(t) {
  if (t.charCodeAt(0) !== 60) return;
  const e = t.charCodeAt(1);
  if (e === 33) {
    const l = t.charCodeAt(2);
    return l === 45 ? 2 : l === 91 ? 5 : Ne(l) ? 4 : void 0;
  }
  if (e === 63) return 3;
  const n = e === 47, r = n ? 2 : 1;
  let i = r, o = t.charCodeAt(i);
  if (!Ne(o)) return;
  for (; o === 45 || ze(o); )
    o = t.charCodeAt(++i);
  const s = t.slice(r, i).toLowerCase();
  return !n && o !== 47 && qs.includes(s) ? 1 : Zh.includes(s) ? 6 : 7;
}
const Ib = [Mb];
function Mb(t, e, n, r) {
  if (e.type === "code" && Us(e, r) && (t.type === "list" || t.type === e.type && Us(t, r)))
    return !1;
  if ("spread" in n && typeof n.spread == "boolean") {
    if (t.type === "paragraph" && // Two paragraphs.
    (t.type === e.type || e.type === "definition" || // Paragraph followed by a setext heading.
    e.type === "heading" && uf(e, r)))
      return;
    if (t.type === "html") {
      const i = Gs(t.value);
      if (i === void 0 || i === 6 || i === 7) return 1;
    }
    if (t.type === "paragraph" && e.type === "html") {
      const i = Gs(e.value);
      if (i === void 0 || i === 7) return 1;
    }
    return n.spread ? 1 : 0;
  }
}
const wn = [
  "autolink",
  "destinationLiteral",
  "destinationRaw",
  "reference",
  "titleQuote",
  "titleApostrophe"
], bf = [
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
    notInConstruct: wn
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
    notInConstruct: wn
  },
  // A right paren could start a list item or break out of a destination
  // raw.
  { atBreak: !0, before: "\\d+", character: ")" },
  { character: ")", inConstruct: "destinationRaw" },
  // An asterisk can start thematic breaks, list items, emphasis, strong.
  { atBreak: !0, character: "*", after: `(?:[ 	\r
*])` },
  { character: "*", inConstruct: "phrasing", notInConstruct: wn },
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
    notInConstruct: wn
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
  { character: "[", inConstruct: "phrasing", notInConstruct: wn },
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
  { character: "_", inConstruct: "phrasing", notInConstruct: wn },
  // A grave accent can start code (fenced or text), or it can break out of
  // a grave accent code fence.
  { atBreak: !0, character: "`" },
  {
    character: "`",
    inConstruct: ["codeFencedLangGraveAccent", "codeFencedMetaGraveAccent"]
  },
  { character: "`", inConstruct: "phrasing", notInConstruct: wn },
  // Left brace, vertical bar, right brace are not used in markdown for
  // constructs.
  // A tilde can start code (fenced).
  { atBreak: !0, character: "~" },
  { character: "<", inConstruct: "autolink" },
  { character: ">", inConstruct: "autolink" },
  { character: "", inConstruct: "autolink" }
];
let Uc = -1;
for (; ++Uc < 33; )
  bf.push({ character: String.fromCharCode(Uc), inConstruct: "autolink" });
function Tb(t) {
  return t.label || !t.identifier ? t.label || "" : nf(t.identifier);
}
function Ab(t) {
  if (!t._compiled) {
    const e = (t.atBreak ? "[\\r\\n][\\t ]*" : "") + (t.before ? "(?:" + t.before + ")" : "");
    t._compiled = new RegExp(
      (e ? "(" + e + ")" : "") + (/[$()*+\-.?[\\\]^{|}]/.test(t.character) ? "\\" : "") + t.character + (t.after ? "(?:" + t.after + ")" : ""),
      "g"
    );
  }
  return t._compiled;
}
function ro(t) {
  const e = t.codePointAt(0);
  return e === void 0 ? "" : String.fromCodePoint(e);
}
function Br(t) {
  const e = t.codePointAt(t.length - 2);
  return e !== void 0 && e > 65535 ? t.slice(-2) : t.slice(-1);
}
function Jc(t, e, n) {
  const r = Mt(t), i = Mt(e);
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
const Eb = /* @__PURE__ */ new Map([
  ["*", !1],
  ["_", !0]
]);
function vb(t, e, n) {
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
function wf(t, e, n) {
  const r = [], i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map();
  let s = 0;
  for (; s < t.length; ) {
    if (!t[s].attention) {
      s++;
      continue;
    }
    const l = t[s].value.charAt(0), a = Eb.get(l);
    let c = s + 1;
    for (; c < t.length && t[c].attention && t[c].value.charAt(0) === l; )
      c++;
    const u = s ? t[s - 1].value : e, h = Mt(u.charCodeAt(u.length - 1)), d = Mt(
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
  for (Rb(r, i), s = -1; ++s < t.length; ) {
    const l = i.get(t[s]);
    if (l) return { attention: vb(t, l, o), index: s };
  }
}
function Ob(t, e, n) {
  return Ys(xf(t, e, n), n.before, n.after);
}
function Ei(t, e) {
  const n = t[e ? 0 : t.length - 1];
  if (!n || n.attention) return;
  const r = e ? ro(n.value) : Br(n.value), i = ql(
    /** @type {number} */
    r.codePointAt(0)
  );
  n.value = e ? i + n.value.slice(r.length) : n.value.slice(0, n.value.length - r.length) + i;
}
function Db(t, e, n, r, i) {
  for (const o of n.attention) {
    const s = e.get(o) || o.sequences[0];
    for (const l of o.sequences) {
      if (l === s) continue;
      const a = new Map(e);
      a.set(o, l);
      const c = Gl(t, a, r, i), u = wf(c, r, i);
      if (!u || u.index > n.index)
        return { chosen: a, mistake: u, tokens: c };
    }
  }
}
function Rb(t, e) {
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
function zb(t, e, n) {
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
    if (!qh(i.charCodeAt(0)))
      throw new Error(
        "Cannot serialize `" + t + "` as attention with `" + i + "` as marker, expected ascii punctuation"
      );
    for (const o of n)
      r.push(i.repeat(o));
  }
  return r;
}
function xf(t, e, n) {
  const r = e.indexStack, i = t.children || [], o = [];
  let s = -1, l = n.before;
  r.push(-1);
  let a = e.createTracker(n);
  for (; ++s < i.length; ) {
    const c = i[s];
    let u;
    if (r[r.length - 1] = s, s + 1 < i.length) {
      let f = e.handle.handlers[i[s + 1].type];
      f && f.peek && (f = f.peek), u = f ? ro(
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
`) && c.type === "html" && Gs(c.value) !== 7 && (o[o.length - 1] = h.replace(/(\r?\n|\r)$/, " "), l = " ", a = e.createTracker(n), a.move(Ys(o, n.before, n.after)));
    const d = e.handle.handlers[c.type];
    if (d && d.attention) {
      const { construct: f, markers: p, sizes: m } = d.attention(c, e), y = zb(c.type, p, m), g = y[0], S = e.enter(f);
      a.move(g);
      const C = xf(
        /** @type {PhrasingParents} */
        c,
        e,
        {
          ...a.current(),
          before: g,
          after: g
        }
      );
      a.move(Ys(C, g, g)), a.move(g), S(), o.push({ children: C, sequences: y }), l = g.charAt(g.length - 1);
    } else {
      const f = e.handle(c, t, e, {
        ...a.current(),
        after: u,
        before: l
      });
      if (!f) continue;
      a.move(f), o.push(f), l = Br(f);
    }
  }
  return r.pop(), o;
}
function Gl(t, e, n, r) {
  const i = [];
  let o, s = Br(n), l = -1;
  for (; ++l < t.length; ) {
    const a = t[l];
    if (typeof a == "string") {
      const C = { value: a, attention: void 0 };
      o && o === ro(a) && Ei([C], !0), o = void 0, i.push(C), C.value && (s = Br(C.value));
      continue;
    }
    const c = e.get(a) || a.sequences[0], u = c.charAt(0), h = t[l + 1], d = s, f = ro(
      h === void 0 ? r : typeof h == "string" ? h : e.get(h) || h.sequences[0]
    ), p = Gl(a.children, e, c, c), m = p.length > 0 ? p[0].value : "", y = Jc(
      d.charCodeAt(d.length - 1),
      m.charCodeAt(0),
      u
    );
    y.inside && Ei(p, !0);
    const g = p.length > 0 ? Br(p[p.length - 1].value) : "", S = Jc(
      f.charCodeAt(0),
      g.charCodeAt(g.length - 1),
      u
    );
    S.inside && Ei(p, !1), y.outside && d !== `
` && d !== "\r" && Ei(i, !1), S.outside && (o = f), i.push({ value: c, attention: a }, ...p, {
      value: c,
      attention: a
    }), s = c.charAt(c.length - 1);
  }
  return i;
}
function Ys(t, e, n) {
  let r = /* @__PURE__ */ new Map();
  const i = Gl(t, r, e, n);
  let o = i, s = wf(o, e, n);
  for (; s; ) {
    const a = Db(t, r, s, e, n);
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
function Lb(t, e, n) {
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
      o.move(Pb(a, i[l + 1], t, e))
    );
  }
  return r.pop(), s.join("");
}
function Pb(t, e, n, r) {
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
const Bb = /\r?\n|\r/g;
function _b(t, e) {
  const n = [];
  let r = 0, i = 0, o;
  for (; o = Bb.exec(t); )
    s(t.slice(r, o.index)), n.push(o[0]), r = o.index + o[0].length, i++;
  return s(t.slice(r)), n.join("");
  function s(l) {
    n.push(e(l, i, !l));
  }
}
const Uo = {}.hasOwnProperty;
function Fb(t, e, n) {
  const r = (n.before || "") + (e || "") + (n.after || ""), i = [], o = [], s = {}, l = t.stack.includes("autolink");
  let a = -1;
  for (; ++a < t.unsafe.length; ) {
    const f = t.unsafe[a];
    if (!af(t.stack, f))
      continue;
    const p = t.compilePattern(f);
    let m;
    for (; m = p.exec(r); ) {
      const y = "before" in f || !!f.atBreak, g = "after" in f, S = m.index + (y ? m[1].length : 0);
      Uo.call(s, S) ? (s[S].before && !y && (s[S].before = !1), s[S].after && !g && (s[S].after = !1)) : (i.push(S), s[S] = { before: y, after: g });
    }
  }
  i.sort($b);
  const c = n.before ? n.before.length : 0, u = r.length - (n.after ? n.after.length : 0);
  let h = c;
  for (a = -1; ++a < i.length; ) {
    const f = i[a];
    if (!(f < h || f >= u)) {
      if (r.charAt(f) === "_" && // Preceded by an unescaped character that is not punctuation or whitespace:
      f > 0 && Mt(r.charCodeAt(f - 1)) === void 0 && !Uo.call(s, f - 1) && // Characters next to attention markers can become character references
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
          p < r.length && Mt(r.charCodeAt(p)) === void 0 && !Uo.call(s, p) && !(p === u - 1 && /[*_]/.test(r.charAt(u)))
        ) {
          a += m;
          continue;
        }
      }
      if (!(f + 1 < u && i[a + 1] === f + 1 && s[f].after && !s[f + 1].before && !s[f + 1].after || i[a - 1] === f - 1 && s[f].before && !s[f - 1].before && !s[f - 1].after)) {
        if (h !== f) {
          const p = r.slice(h, f);
          o.push(l ? p : Gc(p, "\\"));
        }
        h = f, l ? (o.push(
          "%" + r.charCodeAt(f).toString(16).toUpperCase().padStart(2, "0")
        ), h++) : /[!-/:-@[-`{-~]/.test(r.charAt(f)) && (!n.encode || !n.encode.includes(r.charAt(f))) ? o.push("\\") : (o.push(ql(r.charCodeAt(f))), h++);
      }
    }
  }
  const d = r.slice(h, u);
  return o.push(l ? d : Gc(d, n.after)), o.join("");
}
function $b(t, e) {
  return t - e;
}
function Gc(t, e) {
  const n = /\\(?=[!-/:-@[-`{-~])/g, r = [], i = [], o = t + e;
  let s = -1, l = 0, a;
  for (; a = n.exec(o); )
    r.push(a.index);
  for (; ++s < r.length; )
    l !== r[s] && i.push(t.slice(l, r[s])), i.push("\\"), l = r[s];
  return i.push(t.slice(l)), i.join("");
}
function Vb(t) {
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
function Hb(t, e) {
  const n = e || {}, r = {
    associationId: Tb,
    bulletCurrent: void 0,
    bulletLastUsed: void 0,
    containerPhrasing: Kb,
    containerFlow: Ub,
    createTracker: Vb,
    compilePattern: Ab,
    enter: o,
    // @ts-expect-error: GFM / frontmatter are typed in `mdast` but not defined
    // here.
    handlers: { ...Jl },
    // @ts-expect-error: add `handle` in a second.
    handle: void 0,
    indentLines: _b,
    indexStack: [],
    join: [...Ib],
    options: {},
    safe: Jb,
    stack: [],
    unsafe: [...bf]
  };
  lf(r, n), r.options.tightDefinitions && r.join.push(Wb), r.handle = qk("type", {
    invalid: jb,
    unknown: qb,
    handlers: r.handlers
  });
  let i = r.handle(
    sf(t) ? { type: "root", children: [t] } : t,
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
function jb(t) {
  throw new Error("Cannot handle value `" + t + "`, expected node");
}
function qb(t) {
  const e = (
    /** @type {Nodes} */
    t
  );
  throw new Error("Cannot handle unknown node `" + e.type + "`");
}
function Wb(t, e) {
  if (t.type === "definition" && t.type === e.type)
    return 0;
}
function Kb(t, e) {
  return Ob(t, this, e);
}
function Ub(t, e) {
  return Lb(t, this, e);
}
function Jb(t, e) {
  return Fb(this, t, e);
}
function Xs(t) {
  const e = this;
  e.compiler = n;
  function n(r) {
    return Hb(r, {
      ...e.data("settings"),
      ...t,
      // Note: this option is not in the readme.
      // The goal is for it to be set by plugins on `data` instead of being
      // passed by users.
      extensions: e.data("toMarkdownExtensions") || []
    });
  }
}
function Yc(t) {
  if (t)
    throw t;
}
function Gb(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var Jo, Xc;
function Yb() {
  if (Xc) return Jo;
  Xc = 1;
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
  return Jo = function a() {
    var c, u, h, d, f, p, m = arguments[0], y = 1, g = arguments.length, S = !1;
    for (typeof m == "boolean" && (S = m, m = arguments[1] || {}, y = 2), (m == null || typeof m != "object" && typeof m != "function") && (m = {}); y < g; ++y)
      if (c = arguments[y], c != null)
        for (u in c)
          h = l(m, u), d = l(c, u), m !== d && (S && d && (o(d) || (f = i(d))) ? (f ? (f = !1, p = h && i(h) ? h : []) : p = h && o(h) ? h : {}, s(m, { name: u, newValue: a(S, p, d) })) : typeof d < "u" && s(m, { name: u, newValue: d }));
    return m;
  }, Jo;
}
var Xb = Yb();
const Go = /* @__PURE__ */ Gb(Xb);
function Qs(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = Object.getPrototypeOf(t);
  return (e === null || e === Object.prototype || Object.getPrototypeOf(e) === null) && !(Symbol.toStringTag in t) && !(Symbol.iterator in t);
}
function Qb() {
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
      i = c, u ? Zb(u, l)(...c) : s(null, ...c);
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
function Zb(t, e) {
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
class He extends Error {
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
    this.ancestors = o.ancestors || void 0, this.cause = o.cause || void 0, this.column = l ? l.column : void 0, this.fatal = void 0, this.file = "", this.message = i, this.line = l ? l.line : void 0, this.name = Pr(o.place) || "1:1", this.place = o.place || void 0, this.reason = this.message, this.ruleId = o.ruleId || void 0, this.source = o.source || void 0, this.stack = s && o.cause && typeof o.cause.stack == "string" ? o.cause.stack : "", this.actual = void 0, this.expected = void 0, this.note = void 0, this.url = void 0;
  }
}
He.prototype.file = "";
He.prototype.name = "";
He.prototype.reason = "";
He.prototype.message = "";
He.prototype.stack = "";
He.prototype.column = void 0;
He.prototype.line = void 0;
He.prototype.ancestors = void 0;
He.prototype.cause = void 0;
He.prototype.fatal = void 0;
He.prototype.place = void 0;
He.prototype.ruleId = void 0;
He.prototype.source = void 0;
const Ct = { basename: ew, dirname: tw, extname: nw, join: rw, sep: "/" };
function ew(t, e) {
  if (e !== void 0 && typeof e != "string")
    throw new TypeError('"ext" argument must be a string');
  ci(t);
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
function tw(t) {
  if (ci(t), t.length === 0)
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
function nw(t) {
  ci(t);
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
function rw(...t) {
  let e = -1, n;
  for (; ++e < t.length; )
    ci(t[e]), t[e] && (n = n === void 0 ? t[e] : n + "/" + t[e]);
  return n === void 0 ? "." : iw(n);
}
function iw(t) {
  ci(t);
  const e = t.codePointAt(0) === 47;
  let n = ow(t, !e);
  return n.length === 0 && !e && (n = "."), n.length > 0 && t.codePointAt(t.length - 1) === 47 && (n += "/"), e ? "/" + n : n;
}
function ow(t, e) {
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
function ci(t) {
  if (typeof t != "string")
    throw new TypeError(
      "Path must be a string. Received " + JSON.stringify(t)
    );
}
const sw = { cwd: lw };
function lw() {
  return "/";
}
function Zs(t) {
  return !!(t !== null && typeof t == "object" && "href" in t && t.href && "protocol" in t && t.protocol && // @ts-expect-error: indexing is fine.
  t.auth === void 0);
}
function aw(t) {
  if (typeof t == "string")
    t = new URL(t);
  else if (!Zs(t)) {
    const e = new TypeError(
      'The "path" argument must be of type string or an instance of URL. Received `' + t + "`"
    );
    throw e.code = "ERR_INVALID_ARG_TYPE", e;
  }
  if (t.protocol !== "file:") {
    const e = new TypeError("The URL must be of scheme file");
    throw e.code = "ERR_INVALID_URL_SCHEME", e;
  }
  return cw(t);
}
function cw(t) {
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
const Yo = (
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
class uw {
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
    e ? Zs(e) ? n = { path: e } : typeof e == "string" || hw(e) ? n = { value: e } : n = e : n = {}, this.cwd = "cwd" in n ? "" : sw.cwd(), this.data = {}, this.history = [], this.messages = [], this.value, this.map, this.result, this.stored;
    let r = -1;
    for (; ++r < Yo.length; ) {
      const o = Yo[r];
      o in n && n[o] !== void 0 && n[o] !== null && (this[o] = o === "history" ? [...n[o]] : n[o]);
    }
    let i;
    for (i in n)
      Yo.includes(i) || (this[i] = n[i]);
  }
  /**
   * Get the basename (including extname) (example: `'index.min.js'`).
   *
   * @returns {string | undefined}
   *   Basename.
   */
  get basename() {
    return typeof this.path == "string" ? Ct.basename(this.path) : void 0;
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
    Qo(e, "basename"), Xo(e, "basename"), this.path = Ct.join(this.dirname || "", e);
  }
  /**
   * Get the parent path (example: `'~'`).
   *
   * @returns {string | undefined}
   *   Dirname.
   */
  get dirname() {
    return typeof this.path == "string" ? Ct.dirname(this.path) : void 0;
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
    Qc(this.basename, "dirname"), this.path = Ct.join(e || "", this.basename);
  }
  /**
   * Get the extname (including dot) (example: `'.js'`).
   *
   * @returns {string | undefined}
   *   Extname.
   */
  get extname() {
    return typeof this.path == "string" ? Ct.extname(this.path) : void 0;
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
    if (Xo(e, "extname"), Qc(this.dirname, "extname"), e) {
      if (e.codePointAt(0) !== 46)
        throw new Error("`extname` must start with `.`");
      if (e.includes(".", 1))
        throw new Error("`extname` cannot contain multiple dots");
    }
    this.path = Ct.join(this.dirname, this.stem + (e || ""));
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
    Zs(e) && (e = aw(e)), Qo(e, "path"), this.path !== e && this.history.push(e);
  }
  /**
   * Get the stem (basename w/o extname) (example: `'index.min'`).
   *
   * @returns {string | undefined}
   *   Stem.
   */
  get stem() {
    return typeof this.path == "string" ? Ct.basename(this.path, this.extname) : void 0;
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
    Qo(e, "stem"), Xo(e, "stem"), this.path = Ct.join(this.dirname || "", e + (this.extname || ""));
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
    const i = new He(
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
function Xo(t, e) {
  if (t && t.includes(Ct.sep))
    throw new Error(
      "`" + e + "` cannot be a path: did not expect `" + Ct.sep + "`"
    );
}
function Qo(t, e) {
  if (!t)
    throw new Error("`" + e + "` cannot be empty");
}
function Qc(t, e) {
  if (!t)
    throw new Error("Setting `" + e + "` requires `path` to be set too");
}
function hw(t) {
  return !!(t && typeof t == "object" && "byteLength" in t && "byteOffset" in t);
}
const fw = (
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
), dw = {}.hasOwnProperty;
class Yl extends fw {
  /**
   * Create a processor.
   */
  constructor() {
    super("copy"), this.Compiler = void 0, this.Parser = void 0, this.attachers = [], this.compiler = void 0, this.freezeIndex = -1, this.frozen = void 0, this.namespace = {}, this.parser = void 0, this.transformers = Qb();
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
      new Yl()
    );
    let n = -1;
    for (; ++n < this.attachers.length; ) {
      const r = this.attachers[n];
      e.use(...r);
    }
    return e.data(Go(!0, {}, this.namespace)), e;
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
    return typeof e == "string" ? arguments.length === 2 ? (ts("data", this.frozen), this.namespace[e] = n, this) : dw.call(this.namespace, e) && this.namespace[e] || void 0 : e ? (ts("data", this.frozen), this.namespace = e, this) : this.namespace;
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
    const n = vi(e), r = this.parser || this.Parser;
    return Zo("parse", r), r(String(n), n);
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
    return this.freeze(), Zo("process", this.parser || this.Parser), es("process", this.compiler || this.Compiler), n ? i(void 0, n) : new Promise(i);
    function i(o, s) {
      const l = vi(e), a = (
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
        mw(p) ? d.value = p : d.result = p, c(
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
    return this.freeze(), Zo("processSync", this.parser || this.Parser), es("processSync", this.compiler || this.Compiler), this.process(e, i), eu("processSync", "process", n), r;
    function i(o, s) {
      n = !0, Yc(o), r = s;
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
    Zc(e), this.freeze();
    const i = this.transformers;
    return !r && typeof n == "function" && (r = n, n = void 0), r ? o(void 0, r) : new Promise(o);
    function o(s, l) {
      const a = vi(n);
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
    return this.run(e, n, o), eu("runSync", "run", r), i;
    function o(s, l) {
      Yc(s), i = l, r = !0;
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
    const r = vi(n), i = this.compiler || this.Compiler;
    return es("stringify", i), Zc(e), i(e, r);
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
    if (ts("use", this.frozen), e != null) if (typeof e == "function")
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
      l(c.plugins), c.settings && (i.settings = Go(!0, i.settings, c.settings));
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
        Qs(m) && Qs(f) && (f = Go(!0, m, f)), r[d] = [c, f, ...p];
      }
    }
  }
}
const el = new Yl().freeze();
function Zo(t, e) {
  if (typeof e != "function")
    throw new TypeError("Cannot `" + t + "` without `parser`");
}
function es(t, e) {
  if (typeof e != "function")
    throw new TypeError("Cannot `" + t + "` without `compiler`");
}
function ts(t, e) {
  if (e)
    throw new Error(
      "Cannot call `" + t + "` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`."
    );
}
function Zc(t) {
  if (!Qs(t) || typeof t.type != "string")
    throw new TypeError("Expected node, got `" + t + "`");
}
function eu(t, e, n) {
  if (!n)
    throw new Error(
      "`" + t + "` finished async. Use `" + e + "` instead"
    );
}
function vi(t) {
  return pw(t) ? t : new uw(t);
}
function pw(t) {
  return !!(t && typeof t == "object" && "message" in t && "messages" in t);
}
function mw(t) {
  return typeof t == "string" || gw(t);
}
function gw(t) {
  return !!(t && typeof t == "object" && "byteLength" in t && "byteOffset" in t);
}
function xe(t) {
  this.content = t;
}
xe.prototype = {
  constructor: xe,
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
    return i == -1 ? o.push(n || t, e) : (o[i + 1] = e, n && (o[i] = n)), new xe(o);
  },
  // :: (string) → OrderedMap
  // Return a map with the given key removed, if it existed.
  remove: function(t) {
    var e = this.find(t);
    if (e == -1) return this;
    var n = this.content.slice();
    return n.splice(e, 2), new xe(n);
  },
  // :: (string, any) → OrderedMap
  // Add a new key to the start of the map.
  addToStart: function(t, e) {
    return new xe([t, e].concat(this.remove(t).content));
  },
  // :: (string, any) → OrderedMap
  // Add a new key to the end of the map.
  addToEnd: function(t, e) {
    var n = this.remove(t).content.slice();
    return n.push(t, e), new xe(n);
  },
  // :: (string, string, any) → OrderedMap
  // Add a key after the given key. If `place` is not found, the new
  // key is added to the end.
  addBefore: function(t, e, n) {
    var r = this.remove(e), i = r.content.slice(), o = r.find(t);
    return i.splice(o == -1 ? i.length : o, 0, e, n), new xe(i);
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
    return t = xe.from(t), t.size ? new xe(t.content.concat(this.subtract(t).content)) : this;
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a new map by appending the keys in this map that don't
  // appear in `map` after the keys in `map`.
  append: function(t) {
    return t = xe.from(t), t.size ? new xe(this.subtract(t).content.concat(t.content)) : this;
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a map containing all the keys in this map that don't
  // appear in `map`.
  subtract: function(t) {
    var e = this;
    t = xe.from(t);
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
xe.from = function(t) {
  if (t instanceof xe) return t;
  var e = [];
  if (t) for (var n in t) e.push(n, t[n]);
  return new xe(e);
};
function Cf(t, e, n) {
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
      return a && a < s.length && a < l.length && If(s.charCodeAt(a - 1)) && Nf(s.charCodeAt(a)) && n--, n;
    }
    if (i.content.size || o.content.size) {
      let s = Cf(i.content, o.content, n + 1);
      if (s != null)
        return s;
    }
    n += i.nodeSize;
  }
}
function Sf(t, e, n, r) {
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
      return h && d && h < c.length && If(c.charCodeAt(h - 1)) && Nf(c.charCodeAt(h)) && (n++, r++), { a: n, b: r };
    }
    if (s.content.size || l.content.size) {
      let c = Sf(s.content, l.content, n - 1, r - 1);
      if (c)
        return c;
    }
    n -= a, r -= a;
  }
}
function Nf(t) {
  return t >= 56320 && t < 57344;
}
function If(t) {
  return t >= 55296 && t < 56320;
}
class M {
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
    return new M(i, this.size + e.size);
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
    return new M(r, i);
  }
  /**
  @internal
  */
  cutByIndex(e, n) {
    return e == n ? M.empty : e == 0 && n == this.content.length ? this : new M(this.content.slice(e, n));
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
    return i[e] = n, new M(i, o);
  }
  /**
  Create a new fragment by prepending the given node to this
  fragment.
  */
  addToStart(e) {
    return new M([e].concat(this.content), this.size + e.nodeSize);
  }
  /**
  Create a new fragment by appending the given node to this
  fragment.
  */
  addToEnd(e) {
    return new M(this.content.concat(e), this.size + e.nodeSize);
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
    return Cf(this, e, n);
  }
  /**
  Find the first position, searching from the end, at which this
  fragment and the given fragment differ, or `null` if they are
  the same. Since this position will not be the same in both
  nodes, an object with two separate positions is returned.
  */
  findDiffEnd(e, n = this.size, r = e.size) {
    return Sf(this, e, n, r);
  }
  /**
  Find the index and inner offset corresponding to a given relative
  position in this fragment. The result object will be reused
  (overwritten) the next time the function is called. @internal
  */
  findIndex(e) {
    if (e == 0)
      return Oi(0, e);
    if (e == this.size)
      return Oi(this.content.length, e);
    if (e > this.size || e < 0)
      throw new RangeError(`Position ${e} outside of fragment (${this})`);
    for (let n = 0, r = 0; ; n++) {
      let i = this.child(n), o = r + i.nodeSize;
      if (o >= e)
        return o == e ? Oi(n + 1, o) : Oi(n, r);
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
      return M.empty;
    if (!Array.isArray(n))
      throw new RangeError("Invalid input for Fragment.fromJSON");
    return M.fromArray(n.map(e.nodeFromJSON));
  }
  /**
  Build a fragment from an array of nodes. Ensures that adjacent
  text nodes with the same marks are joined together.
  */
  static fromArray(e) {
    if (!e.length)
      return M.empty;
    let n, r = 0;
    for (let i = 0; i < e.length; i++) {
      let o = e[i];
      r += o.nodeSize, i && o.isText && e[i - 1].sameMarkup(o) ? (n || (n = e.slice(0, i)), n[n.length - 1] = o.withText(n[n.length - 1].text + o.text)) : n && n.push(o);
    }
    return new M(n || e, r);
  }
  /**
  Create a fragment from something that can be interpreted as a
  set of nodes. For `null`, it returns the empty fragment. For a
  fragment, the fragment itself. For a node or array of nodes, a
  fragment containing those nodes.
  */
  static from(e) {
    if (!e)
      return M.empty;
    if (e instanceof M)
      return e;
    if (Array.isArray(e))
      return this.fromArray(e);
    if (e.attrs)
      return new M([e], e.nodeSize);
    throw new RangeError("Can not convert " + e + " to a Fragment" + (e.nodesBetween ? " (looks like multiple versions of prosemirror-model were loaded)" : ""));
  }
}
M.empty = new M([], 0);
const ns = { index: 0, offset: 0 };
function Oi(t, e) {
  return ns.index = t, ns.offset = e, ns;
}
function io(t, e) {
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
      if (!io(t[r], e[r]))
        return !1;
  } else {
    for (let r in t)
      if (!(r in e) || !io(t[r], e[r]))
        return !1;
    for (let r in e)
      if (!(r in t))
        return !1;
  }
  return !0;
}
class Q {
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
    return this == e || this.type == e.type && io(this.attrs, e.attrs);
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
      return Q.none;
    if (e instanceof Q)
      return [e];
    let n = e.slice();
    return n.sort((r, i) => r.type.rank - i.type.rank), n;
  }
}
Q.none = [];
class Yr extends Error {
}
class v {
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
    let r = Tf(this.content, e + this.openStart, n, this.openStart + 1, this.openEnd + 1);
    return r && new v(r, this.openStart, this.openEnd);
  }
  /**
  @internal
  */
  removeBetween(e, n) {
    return new v(Mf(this.content, e + this.openStart, n + this.openStart), this.openStart, this.openEnd);
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
      return v.empty;
    let r = n.openStart || 0, i = n.openEnd || 0;
    if (typeof r != "number" || typeof i != "number")
      throw new RangeError("Invalid input for Slice.fromJSON");
    return new v(M.fromJSON(e, n.content), r, i);
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
    return new v(e, r, i);
  }
}
v.empty = new v(M.empty, 0, 0);
function Mf(t, e, n) {
  let { index: r, offset: i } = t.findIndex(e), o = t.maybeChild(r), { index: s, offset: l } = t.findIndex(n);
  if (i == e || o.isText) {
    if (l != n && !t.child(s).isText)
      throw new RangeError("Removing non-flat range");
    return t.cut(0, e).append(t.cut(n));
  }
  if (r != s)
    throw new RangeError("Removing non-flat range");
  return t.replaceChild(r, o.copy(Mf(o.content, e - i - 1, n - i - 1)));
}
function Tf(t, e, n, r, i, o) {
  let { index: s, offset: l } = t.findIndex(e), a = t.maybeChild(s);
  if (l == e || a.isText)
    return o && r <= 0 && i <= 0 && !o.canReplace(s, s, n) ? null : t.cut(0, e).append(n).append(t.cut(e));
  let c = Tf(a.content, e - l - 1, n, s == 0 ? r - 1 : 0, s == t.childCount - 1 ? i - 1 : 0, a);
  return c && t.replaceChild(s, a.copy(c));
}
function yw(t, e, n) {
  if (n.openStart > t.depth)
    throw new Yr("Inserted content deeper than insertion position");
  if (t.depth - n.openStart != e.depth - n.openEnd)
    throw new Yr("Inconsistent open depths");
  return Af(t, e, n, 0);
}
function Af(t, e, n, r) {
  let i = t.index(r), o = t.node(r);
  if (i == e.index(r) && r < t.depth - n.openStart) {
    let s = Af(t, e, n, r + 1);
    return o.copy(o.content.replaceChild(i, s));
  } else if (n.content.size)
    if (!n.openStart && !n.openEnd && t.depth == r && e.depth == r) {
      let s = t.parent, l = s.content;
      return On(s, l.cut(0, t.parentOffset).append(n.content).append(l.cut(e.parentOffset)));
    } else {
      let { start: s, end: l } = kw(n, t);
      return On(o, vf(t, s, l, e, r));
    }
  else return On(o, oo(t, e, r));
}
function Ef(t, e) {
  if (!e.type.compatibleContent(t.type))
    throw new Yr("Cannot join " + e.type.name + " onto " + t.type.name);
}
function tl(t, e, n) {
  let r = t.node(n);
  return Ef(r, e.node(n)), r;
}
function vn(t, e) {
  let n = e.length - 1;
  n >= 0 && t.isText && t.sameMarkup(e[n]) ? e[n] = t.withText(e[n].text + t.text) : e.push(t);
}
function _r(t, e, n, r) {
  let i = (e || t).node(n), o = 0, s = e ? e.index(n) : i.childCount;
  t && (o = t.index(n), t.depth > n ? o++ : t.textOffset && (vn(t.nodeAfter, r), o++));
  for (let l = o; l < s; l++)
    vn(i.child(l), r);
  e && e.depth == n && e.textOffset && vn(e.nodeBefore, r);
}
function On(t, e) {
  if (!t.type.validContent(e))
    throw new Yr("Invalid content for node " + t.type.name);
  return t.copy(e);
}
function vf(t, e, n, r, i) {
  let o = t.depth > i && tl(t, e, i + 1), s = r.depth > i && tl(n, r, i + 1), l = [];
  return _r(null, t, i, l), o && s && e.index(i) == n.index(i) ? (Ef(o, s), vn(On(o, vf(t, e, n, r, i + 1)), l)) : (o && vn(On(o, oo(t, e, i + 1)), l), _r(e, n, i, l), s && vn(On(s, oo(n, r, i + 1)), l)), _r(r, null, i, l), new M(l);
}
function oo(t, e, n) {
  let r = [];
  if (_r(null, t, n, r), t.depth > n) {
    let i = tl(t, e, n + 1);
    vn(On(i, oo(t, e, n + 1)), r);
  }
  return _r(e, null, n, r), new M(r);
}
function kw(t, e) {
  let n = e.depth - t.openStart, i = e.node(n).copy(t.content);
  for (let o = n - 1; o >= 0; o--)
    i = e.node(o).copy(M.from(i));
  return {
    start: i.resolveNoCache(t.openStart + n),
    end: i.resolveNoCache(i.content.size - t.openEnd - n)
  };
}
class Xr {
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
      return Q.none;
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
        return new Of(this, e, r);
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
    return new Xr(n, r, o);
  }
  /**
  @internal
  */
  static resolveCached(e, n) {
    let r = tu.get(e);
    if (r)
      for (let o = 0; o < r.elts.length; o++) {
        let s = r.elts[o];
        if (s.pos == n)
          return s;
      }
    else
      tu.set(e, r = new bw());
    let i = r.elts[r.i] = Xr.resolve(e, n);
    return r.i = (r.i + 1) % ww, i;
  }
}
class bw {
  constructor() {
    this.elts = [], this.i = 0;
  }
}
const ww = 12, tu = /* @__PURE__ */ new WeakMap();
class Of {
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
const xw = /* @__PURE__ */ Object.create(null);
class lt {
  /**
  @internal
  */
  constructor(e, n, r, i = Q.none) {
    this.type = e, this.attrs = n, this.marks = i, this.content = r || M.empty;
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
    return this.type == e && io(this.attrs, n || e.defaultAttrs || xw) && Q.sameSet(this.marks, r || Q.none);
  }
  /**
  Create a new node with the same markup as this node, containing
  the given content (or empty, if no content is given).
  */
  copy(e = null) {
    return e == this.content ? this : new lt(this.type, this.attrs, e, this.marks);
  }
  /**
  Create a copy of this node, with the given set of marks instead
  of the node's own marks.
  */
  mark(e) {
    return e == this.marks ? this : new lt(this.type, this.attrs, this.content, e);
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
      return v.empty;
    let i = this.resolve(e), o = this.resolve(n), s = r ? 0 : i.sharedDepth(n), l = i.start(s), c = i.node(s).content.cut(i.pos - l, o.pos - l);
    return new v(c, i.depth - s, o.depth - s);
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
    return yw(this.resolve(e), this.resolve(n), r);
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
    return Xr.resolveCached(this, e);
  }
  /**
  @internal
  */
  resolveNoCache(e) {
    return Xr.resolve(this, e);
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
    return this.content.size && (e += "(" + this.content.toStringInner() + ")"), Df(this.marks, e);
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
  canReplace(e, n, r = M.empty, i = 0, o = r.childCount) {
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
    this.type.checkContent(this.content), nu(this.type.attrs, this.attrs, "node", this.type.name);
    let e = Q.none;
    for (let n = 0; n < this.marks.length; n++) {
      let r = this.marks[n];
      nu(r.type.attrs, r.attrs, "mark", r.type.name), e = r.addToSet(e);
    }
    if (!Q.sameSet(e, this.marks))
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
    let i = M.fromJSON(e, n.content);
    return e.nodeType(n.type).create(n.attrs, i, r);
  }
}
lt.prototype.text = void 0;
class so extends lt {
  /**
  @internal
  */
  constructor(e, n, r, i) {
    if (super(e, n, null, i), !r)
      throw new RangeError("Empty text nodes are not allowed");
    this.text = r;
  }
  toString() {
    return this.type.spec.toDebugString ? this.type.spec.toDebugString(this) : Df(this.marks, JSON.stringify(this.text));
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
    return e == this.marks ? this : new so(this.type, this.attrs, this.text, e);
  }
  withText(e) {
    return e == this.text ? this : new so(this.type, this.attrs, e, this.marks);
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
function Df(t, e) {
  for (let n = t.length - 1; n >= 0; n--)
    e = t[n].type.name + "(" + e + ")";
  return e;
}
function nu(t, e, n, r) {
  for (let i in e)
    if (!(i in t))
      throw new RangeError(`Unsupported attribute ${i} for ${n} of type ${r}`);
  for (let i in t)
    t[i].validate && t[i].validate(e[i]);
}
class _n {
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
    let r = new Cw(e, n);
    if (r.next == null)
      return _n.empty;
    let i = Rf(r);
    r.next && r.err("Unexpected trailing text");
    let o = Ew(Aw(i));
    return vw(o, r), o;
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
        return M.from(l.map((c) => c.createAndFill()));
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
_n.empty = new _n(!0);
class Cw {
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
function Rf(t) {
  let e = [];
  do
    e.push(Sw(t));
  while (t.eat("|"));
  return e.length == 1 ? e[0] : { type: "choice", exprs: e };
}
function Sw(t) {
  let e = [];
  do
    e.push(Nw(t));
  while (t.next && t.next != ")" && t.next != "|");
  return e.length == 1 ? e[0] : { type: "seq", exprs: e };
}
function Nw(t) {
  let e = Tw(t);
  for (; ; )
    if (t.eat("+"))
      e = { type: "plus", expr: e };
    else if (t.eat("*"))
      e = { type: "star", expr: e };
    else if (t.eat("?"))
      e = { type: "opt", expr: e };
    else if (t.eat("{"))
      e = Iw(t, e);
    else
      break;
  return e;
}
function ru(t) {
  /\D/.test(t.next) && t.err("Expected number, got '" + t.next + "'");
  let e = Number(t.next);
  return t.pos++, e;
}
function Iw(t, e) {
  let n = ru(t), r = n;
  return t.eat(",") && (t.next != "}" ? r = ru(t) : r = -1), t.eat("}") || t.err("Unclosed braced range"), { type: "range", min: n, max: r, expr: e };
}
function Mw(t, e) {
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
function Tw(t) {
  if (t.eat("(")) {
    let e = Rf(t);
    return t.eat(")") || t.err("Missing closing paren"), e;
  } else if (/\W/.test(t.next))
    t.err("Unexpected token '" + t.next + "'");
  else {
    let e = Mw(t, t.next).map((n) => (t.inline == null ? t.inline = n.isInline : t.inline != n.isInline && t.err("Mixing inline and block content"), { type: "name", value: n }));
    return t.pos++, e.length == 1 ? e[0] : { type: "choice", exprs: e };
  }
}
function Aw(t) {
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
function zf(t, e) {
  return e - t;
}
function iu(t, e) {
  let n = [];
  return r(e), n.sort(zf);
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
function Ew(t) {
  let e = /* @__PURE__ */ Object.create(null);
  return n(iu(t, 0));
  function n(r) {
    let i = [];
    r.forEach((s) => {
      t[s].forEach(({ term: l, to: a }) => {
        if (!l)
          return;
        let c;
        for (let u = 0; u < i.length; u++)
          i[u][0] == l && (c = i[u][1]);
        iu(t, a).forEach((u) => {
          c || i.push([l, c = []]), c.indexOf(u) == -1 && c.push(u);
        });
      });
    });
    let o = e[r.join(",")] = new _n(r.indexOf(t.length - 1) > -1);
    for (let s = 0; s < i.length; s++) {
      let l = i[s][1].sort(zf);
      o.next.push({ type: i[s][0], next: e[l.join(",")] || n(l) });
    }
    return o;
  }
}
function vw(t, e) {
  for (let n = 0, r = [t]; n < r.length; n++) {
    let i = r[n], o = !i.validEnd, s = [];
    for (let l = 0; l < i.next.length; l++) {
      let { type: a, next: c } = i.next[l];
      s.push(a.name), o && !(a.isText || a.hasRequiredAttrs()) && (o = !1), r.indexOf(c) == -1 && r.push(c);
    }
    o && e.err("Only non-generatable nodes (" + s.join(", ") + ") in a required position (see https://prosemirror.net/docs/guide/#generatable)");
  }
}
function Lf(t) {
  let e = /* @__PURE__ */ Object.create(null);
  for (let n in t) {
    let r = t[n];
    if (!r.hasDefault)
      return null;
    e[n] = r.default;
  }
  return e;
}
function Pf(t, e) {
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
function Bf(t, e) {
  let n = /* @__PURE__ */ Object.create(null);
  if (e)
    for (let r in e)
      n[r] = new Dw(t, r, e[r]);
  return n;
}
let ou = class _f {
  /**
  @internal
  */
  constructor(e, n, r) {
    this.name = e, this.schema = n, this.spec = r, this.markSet = null, this.groups = r.group ? r.group.split(" ") : [], this.attrs = Bf(e, r.attrs), this.defaultAttrs = Lf(this.attrs), this.contentMatch = null, this.inlineContent = null, this.isBlock = !(r.inline || e == "text"), this.isText = e == "text";
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
    return this.contentMatch == _n.empty;
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
    return !e && this.defaultAttrs ? this.defaultAttrs : Pf(this.attrs, e);
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
    return new lt(this, this.computeAttrs(e), M.from(n), Q.setFrom(r));
  }
  /**
  Like [`create`](https://prosemirror.net/docs/ref/#model.NodeType.create), but check the given content
  against the node type's content restrictions, and throw an error
  if it doesn't match.
  */
  createChecked(e = null, n, r) {
    return n = M.from(n), this.checkContent(n), new lt(this, this.computeAttrs(e), n, Q.setFrom(r));
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
    if (e = this.computeAttrs(e), n = M.from(n), n.size) {
      let s = this.contentMatch.fillBefore(n);
      if (!s)
        return null;
      n = s.append(n);
    }
    let i = this.contentMatch.matchFragment(n), o = i && i.fillBefore(M.empty, !0);
    return o ? new lt(this, e, n.append(o), Q.setFrom(r)) : null;
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
    return n ? n.length ? n : Q.none : e;
  }
  /**
  @internal
  */
  static compile(e, n) {
    let r = /* @__PURE__ */ Object.create(null);
    e.forEach((o, s) => r[o] = new _f(o, n, s));
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
function Ow(t, e, n) {
  let r = n.split("|");
  return (i) => {
    let o = i === null ? "null" : typeof i;
    if (r.indexOf(o) < 0)
      throw new RangeError(`Expected value of type ${r} for attribute ${e} on type ${t}, got ${o}`);
  };
}
class Dw {
  constructor(e, n, r) {
    this.hasDefault = Object.prototype.hasOwnProperty.call(r, "default"), this.default = r.default, this.validate = typeof r.validate == "string" ? Ow(e, n, r.validate) : r.validate;
  }
  get isRequired() {
    return !this.hasDefault;
  }
}
class Io {
  /**
  @internal
  */
  constructor(e, n, r, i) {
    this.name = e, this.rank = n, this.schema = r, this.spec = i, this.attrs = Bf(e, i.attrs), this.excluded = null;
    let o = Lf(this.attrs);
    this.instance = o ? new Q(this, o) : null;
  }
  /**
  Create a mark of this type. `attrs` may be `null` or an object
  containing only some of the mark's attributes. The others, if
  they have defaults, will be added.
  */
  create(e = null) {
    return !e && this.instance ? this.instance : new Q(this, Pf(this.attrs, e));
  }
  /**
  @internal
  */
  static compile(e, n) {
    let r = /* @__PURE__ */ Object.create(null), i = 0;
    return e.forEach((o, s) => r[o] = new Io(o, i++, n, s)), r;
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
class Rw {
  /**
  Construct a schema from a schema [specification](https://prosemirror.net/docs/ref/#model.SchemaSpec).
  */
  constructor(e) {
    this.linebreakReplacement = null, this.cached = /* @__PURE__ */ Object.create(null);
    let n = this.spec = {};
    for (let i in e)
      n[i] = e[i];
    n.nodes = xe.from(e.nodes), n.marks = xe.from(e.marks || {}), this.nodes = ou.compile(this.spec.nodes, this), this.marks = Io.compile(this.spec.marks, this);
    let r = /* @__PURE__ */ Object.create(null);
    for (let i in this.nodes) {
      if (i in this.marks)
        throw new RangeError(i + " can not be both a node and a mark");
      let o = this.nodes[i], s = o.spec.content || "", l = o.spec.marks;
      if (o.contentMatch = r[s] || (r[s] = _n.parse(s, this.nodes)), o.inlineContent = o.contentMatch.inlineContent, o.spec.linebreakReplacement) {
        if (this.linebreakReplacement)
          throw new RangeError("Multiple linebreak nodes defined");
        if (!o.isInline || !o.isLeaf)
          throw new RangeError("Linebreak replacement nodes must be inline leaf nodes");
        this.linebreakReplacement = o;
      }
      o.markSet = l == "_" ? null : l ? su(this, l.split(" ")) : l == "" || !o.inlineContent ? [] : null;
    }
    for (let i in this.marks) {
      let o = this.marks[i], s = o.spec.excludes;
      o.excluded = s == null ? [o] : s == "" ? [] : su(this, s.split(" "));
    }
    this.nodeFromJSON = (i) => lt.fromJSON(this, i), this.markFromJSON = (i) => Q.fromJSON(this, i), this.topNodeType = this.nodes[this.spec.topNode || "doc"], this.cached.wrappings = /* @__PURE__ */ Object.create(null);
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
    else if (e instanceof ou) {
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
    return new so(r, r.defaultAttrs, e, Q.setFrom(n));
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
function su(t, e) {
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
function zw(t) {
  return t.tag != null;
}
function Lw(t) {
  return t.style != null;
}
class ir {
  /**
  Create a parser that targets the given schema, using the given
  parsing rules.
  */
  constructor(e, n) {
    this.schema = e, this.rules = n, this.tags = [], this.styles = [];
    let r = this.matchedStyles = [];
    n.forEach((i) => {
      if (zw(i))
        this.tags.push(i);
      else if (Lw(i)) {
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
    let r = new au(this, n, !1);
    return r.addAll(e, Q.none, n.from, n.to), r.finish();
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
    let r = new au(this, n, !0);
    return r.addAll(e, Q.none, n.from, n.to), v.maxOpen(r.finish());
  }
  /**
  @internal
  */
  matchTag(e, n, r) {
    for (let i = r ? this.tags.indexOf(r) + 1 : 0; i < this.tags.length; i++) {
      let o = this.tags[i];
      if (_w(e, o.tag) && (o.namespace === void 0 || e.namespaceURI == o.namespace) && (!o.context || n.matchesContext(o.context))) {
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
        r(s = cu(s)), s.mark || s.ignore || s.clearMark || (s.mark = i);
      });
    }
    for (let i in e.nodes) {
      let o = e.nodes[i].spec.parseDOM;
      o && o.forEach((s) => {
        r(s = cu(s)), s.node || s.ignore || s.mark || (s.node = i);
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
    return e.cached.domParser || (e.cached.domParser = new ir(e, ir.schemaRules(e)));
  }
}
const Ff = {
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
}, Pw = {
  head: !0,
  noscript: !0,
  object: !0,
  script: !0,
  style: !0,
  title: !0
}, $f = { ol: !0, ul: !0 }, Qr = 1, nl = 2, Fr = 4;
function lu(t, e, n) {
  return e != null ? (e ? Qr : 0) | (e === "full" ? nl : 0) : t && t.whitespace == "pre" ? Qr | nl : n & ~Fr;
}
class Di {
  constructor(e, n, r, i, o, s) {
    this.type = e, this.attrs = n, this.marks = r, this.solid = i, this.options = s, this.content = [], this.activeMarks = Q.none, this.match = o || (s & Fr ? null : e.contentMatch);
  }
  findWrapping(e) {
    if (!this.match) {
      if (!this.type)
        return [];
      let n = this.type.contentMatch.fillBefore(M.from(e));
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
    if (!(this.options & Qr)) {
      let r = this.content[this.content.length - 1], i;
      if (r && r.isText && (i = /[ \t\r\n\u000c]+$/.exec(r.text))) {
        let o = r;
        r.text.length == i[0].length ? this.content.pop() : this.content[this.content.length - 1] = o.withText(o.text.slice(0, o.text.length - i[0].length));
      }
    }
    let n = M.from(this.content);
    return !e && this.match && (n = n.append(this.match.fillBefore(M.empty, !0))), this.type ? this.type.create(this.attrs, n, this.marks) : n;
  }
  inlineContext(e) {
    return this.type ? this.type.inlineContent : this.content.length ? this.content[0].isInline : e.parentNode && !Ff.hasOwnProperty(e.parentNode.nodeName.toLowerCase());
  }
}
class au {
  constructor(e, n, r) {
    this.parser = e, this.options = n, this.isOpen = r, this.open = 0, this.localPreserveWS = !1;
    let i = n.topNode, o, s = lu(null, n.preserveWhitespace, 0) | (r ? Fr : 0);
    i ? o = new Di(i.type, i.attrs, Q.none, !0, n.topMatch || i.type.contentMatch, s) : r ? o = new Di(null, null, Q.none, !0, null, s) : o = new Di(e.schema.topNodeType, null, Q.none, !0, null, s), this.nodes = [o], this.find = n.findPositions, this.needsBlock = !1;
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
    let r = e.nodeValue, i = this.top, o = i.options & nl ? "full" : this.localPreserveWS || (i.options & Qr) > 0, { schema: s } = this.parser;
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
    $f.hasOwnProperty(s) && this.parser.normalizeLists && Bw(e);
    let a = this.options.ruleFromNode && this.options.ruleFromNode(e) || (l = this.parser.matchTag(e, this, r));
    e: if (a ? a.ignore : Pw.hasOwnProperty(s))
      this.findInside(e), this.ignoreFallback(e, n);
    else if (!a || a.skip || a.closeParent) {
      a && a.closeParent ? this.open = Math.max(0, this.open - 1) : a && a.skip.nodeType && (e = a.skip);
      let c, u = this.needsBlock;
      if (Ff.hasOwnProperty(s))
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
      let s = Q.none;
      for (let l of i.concat(e.marks))
        (o.type ? o.type.allowsMarkType(l.type) : uu(l.type, e.type)) && (s = l.addToSet(s));
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
    let l = lu(e, o, s.options);
    s.options & Fr && s.content.length == 0 && (l |= Fr);
    let a = Q.none;
    return r = r.filter((c) => (s.type ? s.type.allowsMarkType(c.type) : uu(c.type, e)) ? (a = c.addToSet(a), !1) : !0), this.nodes.push(new Di(e, n, a, i, null, l)), this.open++, r;
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
      this.localPreserveWS && (this.nodes[n].options |= Qr);
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
function Bw(t) {
  for (let e = t.firstChild, n = null; e; e = e.nextSibling) {
    let r = e.nodeType == 1 ? e.nodeName.toLowerCase() : null;
    r && $f.hasOwnProperty(r) && n ? (n.appendChild(e), e = n) : r == "li" ? n = e : r && (n = null);
  }
}
function _w(t, e) {
  return (t.matches || t.msMatchesSelector || t.webkitMatchesSelector || t.mozMatchesSelector).call(t, e);
}
function cu(t) {
  let e = {};
  for (let n in t)
    e[n] = t[n];
  return e;
}
function uu(t, e) {
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
class dr {
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
    r || (r = Ri(n).createDocumentFragment());
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
      return Ri(n).createTextNode(e.text);
    let { dom: r, contentDOM: i } = $i(Ri(n), this.nodes[e.type.name](e), null, e.attrs);
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
    return i && $i(Ri(r), i(e, n), null, e.attrs);
  }
  static renderSpec(e, n, r = null, i) {
    return typeof n == "string" ? { dom: e.createTextNode(n) } : $i(e, n, r, i);
  }
  /**
  Build a serializer using the [`toDOM`](https://prosemirror.net/docs/ref/#model.NodeSpec.toDOM)
  properties in a schema's node and mark specs.
  */
  static fromSchema(e) {
    return e.cached.domSerializer || (e.cached.domSerializer = new dr(this.nodesFromSchema(e), this.marksFromSchema(e)));
  }
  /**
  Gather the serializers in a schema's node specs into an object.
  This can be useful as a base to build a custom serializer from.
  */
  static nodesFromSchema(e) {
    let n = hu(e.nodes);
    return n.text || (n.text = (r) => r.text), n;
  }
  /**
  Gather the serializers in a schema's mark specs into an object.
  */
  static marksFromSchema(e) {
    return hu(e.marks);
  }
}
function hu(t) {
  let e = {};
  for (let n in t) {
    let r = t[n].spec.toDOM;
    r && (e[n] = r);
  }
  return e;
}
function Ri(t) {
  return t.document || window.document;
}
const fu = /* @__PURE__ */ new WeakMap();
function Fw(t) {
  let e = fu.get(t);
  return e === void 0 && fu.set(t, e = $w(t)), e;
}
function $w(t) {
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
function $i(t, e, n, r) {
  if (e.nodeType == 1)
    return { dom: e };
  if (e.dom && e.dom.nodeType == 1)
    return e;
  let i = e[0], o;
  if (typeof i != "string")
    throw new RangeError("Invalid array passed to renderSpec");
  if (r && (o = Fw(r)) && o.indexOf(e) > -1)
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
      let { dom: f, contentDOM: p } = $i(t, d, n, r);
      if (a.appendChild(f), p) {
        if (l)
          throw new RangeError("Multiple content holes");
        l = p;
      }
    }
  }
  return { dom: a, contentDOM: l };
}
const Vf = 65535, Hf = Math.pow(2, 16);
function Vw(t, e) {
  return t + e * Hf;
}
function du(t) {
  return t & Vf;
}
function Hw(t) {
  return (t - (t & Vf)) / Hf;
}
const jf = 1, qf = 2, Vi = 4, Wf = 8;
class rl {
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
    return (this.delInfo & Wf) > 0;
  }
  /**
  Tells you whether the token before the mapped position was deleted.
  */
  get deletedBefore() {
    return (this.delInfo & (jf | Vi)) > 0;
  }
  /**
  True when the token after the mapped position was deleted.
  */
  get deletedAfter() {
    return (this.delInfo & (qf | Vi)) > 0;
  }
  /**
  Tells whether any of the steps mapped through deletes across the
  position (including both the token before and after the
  position).
  */
  get deletedAcross() {
    return (this.delInfo & Vi) > 0;
  }
}
class Ye {
  /**
  Create a position map. The modifications to the document are
  represented as an array of numbers, in which each group of three
  represents a modified chunk as `[start, oldSize, newSize]`.
  */
  constructor(e, n = !1) {
    if (this.ranges = e, this.inverted = n, !e.length && Ye.empty)
      return Ye.empty;
  }
  /**
  @internal
  */
  recover(e) {
    let n = 0, r = du(e);
    if (!this.inverted)
      for (let i = 0; i < r; i++)
        n += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1];
    return this.ranges[r * 3] + n + Hw(e);
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
        let p = e == (n < 0 ? a : h) ? null : Vw(l / 3, e - a), m = 0;
        return c && (m |= e == a ? qf : e == h ? jf : Vi, (n < 0 ? e != a : e != h) && (m |= Wf)), new rl(f, m, p);
      }
      i += u - c;
    }
    return r ? e + i : new rl(e + i, 0, null);
  }
  /**
  @internal
  */
  touches(e, n) {
    let r = 0, i = du(n), o = this.inverted ? 2 : 1, s = this.inverted ? 1 : 2;
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
    return new Ye(this.ranges, !this.inverted);
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
    return e == 0 ? Ye.empty : new Ye(e < 0 ? [0, -e, 0] : [0, 0, e]);
  }
}
Ye.empty = new Ye([]);
class lo {
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
    return new lo(this._maps, this.mirror, e, n);
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
    let e = new lo();
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
    return r ? e : new rl(e, i, null);
  }
}
const rs = /* @__PURE__ */ Object.create(null);
class De {
  /**
  Get the step map that represents the changes made by this step,
  and which can be used to transform between positions in the old
  and the new document.
  */
  getMap() {
    return Ye.empty;
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
    let r = rs[n.stepType];
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
    if (e in rs)
      throw new RangeError("Duplicate use of step JSON ID " + e);
    return rs[e] = n, n.prototype.jsonID = e, n;
  }
}
class pe {
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
    return new pe(e, null);
  }
  /**
  Create a failed step result.
  */
  static fail(e) {
    return new pe(null, e);
  }
  /**
  Call [`Node.replace`](https://prosemirror.net/docs/ref/#model.Node.replace) with the given
  arguments. Create a successful result if it succeeds, and a
  failed one if it throws a `ReplaceError`.
  */
  static fromReplace(e, n, r, i) {
    try {
      return pe.ok(e.replace(n, r, i));
    } catch (o) {
      if (o instanceof Yr)
        return pe.fail(o.message);
      throw o;
    }
  }
}
function Xl(t, e, n) {
  let r = [];
  for (let i = 0; i < t.childCount; i++) {
    let o = t.child(i);
    o.content.size && (o = o.copy(Xl(o.content, e, o))), o.isInline && (o = e(o, n, i)), r.push(o);
  }
  return M.fromArray(r);
}
class Ft extends De {
  /**
  Create a mark step.
  */
  constructor(e, n, r) {
    super(), this.from = e, this.to = n, this.mark = r;
  }
  apply(e) {
    let n = e.slice(this.from, this.to), r = e.resolve(this.from), i = r.node(r.sharedDepth(this.to)), o = new v(Xl(n.content, (s, l) => !s.isAtom || !l.type.allowsMarkType(this.mark.type) ? s : s.mark(this.mark.addToSet(s.marks)), i), n.openStart, n.openEnd);
    return pe.fromReplace(e, this.from, this.to, o);
  }
  invert() {
    return new Nt(this.from, this.to, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.from, 1), r = e.mapResult(this.to, -1);
    return n.deleted && r.deleted || n.pos >= r.pos ? null : new Ft(n.pos, r.pos, this.mark);
  }
  merge(e) {
    return e instanceof Ft && e.mark.eq(this.mark) && this.from <= e.to && this.to >= e.from ? new Ft(Math.min(this.from, e.from), Math.max(this.to, e.to), this.mark) : null;
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
    return new Ft(n.from, n.to, e.markFromJSON(n.mark));
  }
}
De.jsonID("addMark", Ft);
class Nt extends De {
  /**
  Create a mark-removing step.
  */
  constructor(e, n, r) {
    super(), this.from = e, this.to = n, this.mark = r;
  }
  apply(e) {
    let n = e.slice(this.from, this.to), r = new v(Xl(n.content, (i) => i.mark(this.mark.removeFromSet(i.marks)), e), n.openStart, n.openEnd);
    return pe.fromReplace(e, this.from, this.to, r);
  }
  invert() {
    return new Ft(this.from, this.to, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.from, 1), r = e.mapResult(this.to, -1);
    return n.deleted && r.deleted || n.pos >= r.pos ? null : new Nt(n.pos, r.pos, this.mark);
  }
  merge(e) {
    return e instanceof Nt && e.mark.eq(this.mark) && this.from <= e.to && this.to >= e.from ? new Nt(Math.min(this.from, e.from), Math.max(this.to, e.to), this.mark) : null;
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
    return new Nt(n.from, n.to, e.markFromJSON(n.mark));
  }
}
De.jsonID("removeMark", Nt);
class sn extends De {
  /**
  Create a node mark step.
  */
  constructor(e, n) {
    super(), this.pos = e, this.mark = n;
  }
  apply(e) {
    let n = e.nodeAt(this.pos);
    if (!n)
      return pe.fail("No node at mark step's position");
    let r = n.type.create(n.attrs, null, this.mark.addToSet(n.marks));
    return pe.fromReplace(e, this.pos, this.pos + 1, new v(M.from(r), 0, n.isLeaf ? 0 : 1));
  }
  invert(e) {
    let n = e.nodeAt(this.pos);
    if (n) {
      let r = this.mark.addToSet(n.marks);
      if (r.length == n.marks.length) {
        for (let i = 0; i < n.marks.length; i++)
          if (!n.marks[i].isInSet(r))
            return new sn(this.pos, n.marks[i]);
        return new sn(this.pos, this.mark);
      }
    }
    return new Fn(this.pos, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.pos, 1);
    return n.deletedAfter ? null : new sn(n.pos, this.mark);
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
    return new sn(n.pos, e.markFromJSON(n.mark));
  }
}
De.jsonID("addNodeMark", sn);
class Fn extends De {
  /**
  Create a mark-removing step.
  */
  constructor(e, n) {
    super(), this.pos = e, this.mark = n;
  }
  apply(e) {
    let n = e.nodeAt(this.pos);
    if (!n)
      return pe.fail("No node at mark step's position");
    let r = n.type.create(n.attrs, null, this.mark.removeFromSet(n.marks));
    return pe.fromReplace(e, this.pos, this.pos + 1, new v(M.from(r), 0, n.isLeaf ? 0 : 1));
  }
  invert(e) {
    let n = e.nodeAt(this.pos);
    return !n || !this.mark.isInSet(n.marks) ? this : new sn(this.pos, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.pos, 1);
    return n.deletedAfter ? null : new Fn(n.pos, this.mark);
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
    return new Fn(n.pos, e.markFromJSON(n.mark));
  }
}
De.jsonID("removeNodeMark", Fn);
class de extends De {
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
    return this.structure && il(e, this.from, this.to) ? pe.fail("Structure replace would overwrite content") : pe.fromReplace(e, this.from, this.to, this.slice);
  }
  getMap() {
    return new Ye([this.from, this.to - this.from, this.slice.size]);
  }
  invert(e) {
    return new de(this.from, this.from + this.slice.size, e.slice(this.from, this.to));
  }
  map(e) {
    let n = e.mapResult(this.to, -1), r = this.from == this.to && de.MAP_BIAS < 0 ? n : e.mapResult(this.from, 1);
    return r.deletedAcross && n.deletedAcross ? null : new de(r.pos, Math.max(r.pos, n.pos), this.slice, this.structure);
  }
  merge(e) {
    if (!(e instanceof de) || e.structure || this.structure)
      return null;
    if (this.from + this.slice.size == e.from && !this.slice.openEnd && !e.slice.openStart) {
      let n = this.slice.size + e.slice.size == 0 ? v.empty : new v(this.slice.content.append(e.slice.content), this.slice.openStart, e.slice.openEnd);
      return new de(this.from, this.to + (e.to - e.from), n, this.structure);
    } else if (e.to == this.from && !this.slice.openStart && !e.slice.openEnd) {
      let n = this.slice.size + e.slice.size == 0 ? v.empty : new v(e.slice.content.append(this.slice.content), e.slice.openStart, this.slice.openEnd);
      return new de(e.from, this.to, n, this.structure);
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
    return new de(n.from, n.to, v.fromJSON(e, n.slice), !!n.structure);
  }
}
de.MAP_BIAS = 1;
De.jsonID("replace", de);
class ve extends De {
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
    if (this.structure && (il(e, this.from, this.gapFrom) || il(e, this.gapTo, this.to)))
      return pe.fail("Structure gap-replace would overwrite content");
    let n = e.slice(this.gapFrom, this.gapTo);
    if (n.openStart || n.openEnd)
      return pe.fail("Gap is not a flat range");
    let r = this.slice.insertAt(this.insert, n.content);
    return r ? pe.fromReplace(e, this.from, this.to, r) : pe.fail("Content does not fit in gap");
  }
  getMap() {
    return new Ye([
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
    return new ve(this.from, this.from + this.slice.size + n, this.from + this.insert, this.from + this.insert + n, e.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from), this.gapFrom - this.from, this.structure);
  }
  map(e) {
    let n = e.mapResult(this.from, 1), r = e.mapResult(this.to, -1), i = this.from == this.gapFrom ? n.pos : e.map(this.gapFrom, -1), o = this.to == this.gapTo ? r.pos : e.map(this.gapTo, 1);
    return n.deletedAcross && r.deletedAcross || i < n.pos || o > r.pos ? null : new ve(n.pos, r.pos, i, o, this.slice, this.insert, this.structure);
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
    return new ve(n.from, n.to, n.gapFrom, n.gapTo, v.fromJSON(e, n.slice), n.insert, !!n.structure);
  }
}
De.jsonID("replaceAround", ve);
function il(t, e, n) {
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
function jw(t, e, n, r) {
  let i = [], o = [], s, l;
  t.doc.nodesBetween(e, n, (a, c, u) => {
    if (!a.isInline)
      return;
    let h = a.marks;
    if (!r.isInSet(h) && u.type.allowsMarkType(r.type)) {
      let d = Math.max(c, e), f = Math.min(c + a.nodeSize, n), p = r.addToSet(h);
      for (let m = 0; m < h.length; m++)
        h[m].isInSet(p) || (s && s.to == d && s.mark.eq(h[m]) ? s.to = f : i.push(s = new Nt(d, f, h[m])));
      l && l.to == d ? l.to = f : o.push(l = new Ft(d, f, r));
    }
  }), i.forEach((a) => t.step(a)), o.forEach((a) => t.step(a));
}
function qw(t, e, n, r) {
  let i = [], o = 0;
  t.doc.nodesBetween(e, n, (s, l) => {
    if (!s.isInline)
      return;
    o++;
    let a = null;
    if (r instanceof Io) {
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
  }), i.forEach((s) => t.step(new Nt(s.from, s.to, s.style)));
}
function Ql(t, e, n, r = n.contentMatch, i = !0) {
  let o = t.doc.nodeAt(e), s = [], l = e + 1;
  for (let a = 0; a < o.childCount; a++) {
    let c = o.child(a), u = l + c.nodeSize, h = r.matchType(c.type);
    if (!h)
      s.push(new de(l, u, v.empty));
    else {
      r = h;
      for (let d = 0; d < c.marks.length; d++)
        n.allowsMarkType(c.marks[d].type) || t.step(new Nt(l, u, c.marks[d]));
      if (i && c.isText && n.whitespace != "pre") {
        let d, f = /\r?\n|\r/g, p;
        for (; d = f.exec(c.text); )
          p || (p = new v(M.from(n.schema.text(" ", n.allowedMarks(c.marks))), 0, 0)), s.push(new de(l + d.index, l + d.index + d[0].length, p));
      }
    }
    l = u;
  }
  if (!r.validEnd) {
    let a = r.fillBefore(M.empty, !0);
    t.replace(l, l, new v(a, 0, 0));
  }
  for (let a = s.length - 1; a >= 0; a--)
    t.step(s[a]);
}
function Ww(t, e, n) {
  return (e == 0 || t.canReplace(e, t.childCount)) && (n == t.childCount || t.canReplace(0, n));
}
function Mo(t) {
  let n = t.parent.content.cutByIndex(t.startIndex, t.endIndex);
  for (let r = t.depth, i = 0, o = 0; ; --r) {
    let s = t.$from.node(r), l = t.$from.index(r) + i, a = t.$to.indexAfter(r) - o;
    if (r < t.depth && s.canReplace(l, a, n))
      return r;
    if (r == 0 || s.type.spec.isolating || !Ww(s, l, a))
      break;
    l && (i = 1), a < s.childCount && (o = 1);
  }
  return null;
}
function Kw(t, e, n) {
  let { $from: r, $to: i, depth: o } = e, s = r.before(o + 1), l = i.after(o + 1), a = s, c = l, u = M.empty, h = 0;
  for (let p = o, m = !1; p > n; p--)
    m || r.index(p) > 0 ? (m = !0, u = M.from(r.node(p).copy(u)), h++) : a--;
  let d = M.empty, f = 0;
  for (let p = o, m = !1; p > n; p--)
    m || i.after(p + 1) < i.end(p) ? (m = !0, d = M.from(i.node(p).copy(d)), f++) : c++;
  t.step(new ve(a, c, s, l, new v(u.append(d), h, f), u.size - h, !0));
}
function Zl(t, e, n = null, r = t) {
  let i = Uw(t, e), o = i && Jw(r, e);
  return o ? i.map(pu).concat({ type: e, attrs: n }).concat(o.map(pu)) : null;
}
function pu(t) {
  return { type: t, attrs: null };
}
function Uw(t, e) {
  let { parent: n, startIndex: r, endIndex: i } = t, o = n.contentMatchAt(r).findWrapping(e);
  if (!o)
    return null;
  let s = o.length ? o[0] : e;
  return n.canReplaceWith(r, i, s) ? o : null;
}
function Jw(t, e) {
  let { parent: n, startIndex: r, endIndex: i } = t, o = n.child(r), s = e.contentMatch.findWrapping(o.type);
  if (!s)
    return null;
  let a = (s.length ? s[s.length - 1] : e).contentMatch;
  for (let c = r; a && c < i; c++)
    a = a.matchType(n.child(c).type);
  return !a || !a.validEnd ? null : s;
}
function Gw(t, e, n) {
  let r = M.empty;
  for (let s = n.length - 1; s >= 0; s--) {
    if (r.size) {
      let l = n[s].type.contentMatch.matchFragment(r);
      if (!l || !l.validEnd)
        throw new RangeError("Wrapper type given to Transform.wrap does not form valid content of its parent wrapper");
    }
    r = M.from(n[s].type.create(n[s].attrs, r));
  }
  let i = e.start, o = e.end;
  t.step(new ve(i, o, i, o, new v(r, 0, 0), n.length, !0));
}
function Yw(t, e, n, r, i) {
  if (!r.isTextblock)
    throw new RangeError("Type given to setBlockType should be a textblock");
  let o = t.steps.length;
  t.doc.nodesBetween(e, n, (s, l) => {
    let a = typeof i == "function" ? i(s) : i;
    if (s.isTextblock && !s.hasMarkup(r, a) && Xw(t.doc, t.mapping.slice(o).map(l), r)) {
      let c = null;
      if (r.schema.linebreakReplacement) {
        let f = r.whitespace == "pre", p = !!r.contentMatch.matchType(r.schema.linebreakReplacement);
        f && !p ? c = !1 : !f && p && (c = !0);
      }
      c === !1 && Uf(t, s, l, o), Ql(t, t.mapping.slice(o).map(l, 1), r, void 0, c === null);
      let u = t.mapping.slice(o), h = u.map(l, 1), d = u.map(l + s.nodeSize, 1);
      return t.step(new ve(h, d, h + 1, d - 1, new v(M.from(r.create(a, null, s.marks)), 0, 0), 1, !0)), c === !0 && Kf(t, s, l, o), !1;
    }
  });
}
function Kf(t, e, n, r) {
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
function Uf(t, e, n, r) {
  e.forEach((i, o) => {
    if (i.type == i.type.schema.linebreakReplacement) {
      let s = t.mapping.slice(r).map(n + 1 + o);
      t.replaceWith(s, s + 1, e.type.schema.text(`
`));
    }
  });
}
function Xw(t, e, n) {
  let r = t.resolve(e), i = r.index();
  return r.parent.canReplaceWith(i, i + 1, n);
}
function Qw(t, e, n, r, i) {
  let o = t.doc.nodeAt(e);
  if (!o)
    throw new RangeError("No node at given position");
  n || (n = o.type);
  let s = n.create(r, null, i || o.marks);
  if (o.isLeaf)
    return t.replaceWith(e, e + o.nodeSize, s);
  if (!n.validContent(o.content))
    throw new RangeError("Invalid content for node type " + n.name);
  t.step(new ve(e, e + o.nodeSize, e + 1, e + o.nodeSize - 1, new v(M.from(s), 0, 0), 1, !0));
}
function $r(t, e, n = 1, r) {
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
function Zw(t, e, n = 1, r) {
  let i = t.doc.resolve(e), o = M.empty, s = M.empty;
  for (let l = i.depth, a = i.depth - n, c = n - 1; l > a; l--, c--) {
    o = M.from(i.node(l).copy(o));
    let u = r && r[c];
    s = M.from(u ? u.type.create(u.attrs, s) : i.node(l).copy(s));
  }
  t.step(new de(e, e, new v(o.append(s), n, n), !0));
}
function To(t, e) {
  let n = t.resolve(e), r = n.index();
  return t1(n.nodeBefore, n.nodeAfter) && n.parent.canReplace(r, r + 1);
}
function e1(t, e) {
  e.content.size || t.type.compatibleContent(e.type);
  let n = t.contentMatchAt(t.childCount), { linebreakReplacement: r } = t.type.schema;
  for (let i = 0; i < e.childCount; i++) {
    let o = e.child(i), s = o.type == r ? t.type.schema.nodes.text : o.type;
    if (n = n.matchType(s), !n || !t.type.allowsMarks(o.marks))
      return !1;
  }
  return n.validEnd;
}
function t1(t, e) {
  return !!(t && e && !t.isLeaf && e1(t, e));
}
function n1(t, e, n) {
  let r = null, { linebreakReplacement: i } = t.doc.type.schema, o = t.doc.resolve(e - n), s = o.node().type;
  if (i && s.inlineContent) {
    let u = s.whitespace == "pre", h = !!s.contentMatch.matchType(i);
    u && !h ? r = !1 : !u && h && (r = !0);
  }
  let l = t.steps.length;
  if (r === !1) {
    let u = t.doc.resolve(e + n);
    Uf(t, u.node(), u.before(), l);
  }
  s.inlineContent && Ql(t, e + n - 1, s, o.node().contentMatchAt(o.index()), r == null);
  let a = t.mapping.slice(l), c = a.map(e - n);
  if (t.step(new de(c, a.map(e + n, -1), v.empty, !0)), r === !0) {
    let u = t.doc.resolve(c);
    Kf(t, u.node(), u.before(), t.steps.length);
  }
  return t;
}
function r1(t, e, n) {
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
function i1(t, e, n) {
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
function Ao(t, e, n = e, r = v.empty) {
  if (e == n && !r.size)
    return null;
  let i = t.resolve(e), o = t.resolve(n);
  return Jf(i, o, r) ? new de(e, n, r) : new o1(i, o, r).fit();
}
function Jf(t, e, n) {
  return !n.openStart && !n.openEnd && t.start() == e.start() && t.parent.canReplace(t.index(), e.index(), n.content);
}
class o1 {
  constructor(e, n, r) {
    this.$from = e, this.$to = n, this.unplaced = r, this.frontier = [], this.placed = M.empty;
    for (let i = 0; i <= e.depth; i++) {
      let o = e.node(i);
      this.frontier.push({
        type: o.type,
        match: o.contentMatchAt(e.indexAfter(i))
      });
    }
    for (let i = e.depth; i > 0; i--)
      this.placed = M.from(e.node(i).copy(this.placed));
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
    let a = new v(o, s, l);
    return e > -1 ? new ve(r.pos, e, this.$to.pos, this.$to.end(), a, n) : a.size || r.pos != this.$to.pos ? new de(r.pos, i.pos, a) : null;
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
        r ? (o = mu(this.unplaced.content, r - 1).firstChild, i = o.content) : i = this.unplaced.content;
        let s = i.firstChild;
        for (let l = this.depth; l >= 0; l--) {
          let { type: a, match: c } = this.frontier[l], u, h = null;
          if (n == 1 && (s ? c.matchType(s.type) || (h = c.fillBefore(M.from(s), !1)) : o && a.compatibleContent(o.type)))
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
    return gu(e, -1) <= n ? !1 : (this.unplaced.size > 1 && gu(e, 1) > r && r++, this.unplaced = new v(e, n + 1, r), !0);
  }
  dropNode() {
    let { content: e, openStart: n, openEnd: r } = this.unplaced, i = mu(e, n);
    if (i.childCount <= 1 && n > 0) {
      let o = e.size - n <= n + i.size;
      this.unplaced = new v(Or(e, n - 1, 1), n - 1, o ? n - 1 : r);
    } else
      this.unplaced = new v(Or(e, n, 1), n, r);
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
      c++, (c > 1 || a == 0 || m.content.size) && (h = y, u.push(Gf(m.mark(d.allowedMarks(m.marks)), c == 1 ? a : 0, c == l.childCount ? f : -1)));
    }
    let p = c == l.childCount;
    p || (f = -1), this.placed = Dr(this.placed, n, M.from(u)), this.frontier[n].match = h, p && f < 0 && r && r.type == this.frontier[this.depth].type && this.frontier.length > 1 && this.closeFrontierNode();
    for (let m = 0, y = l; m < f; m++) {
      let g = y.lastChild;
      this.frontier.push({ type: g.type, match: g.contentMatchAt(g.childCount) }), y = g.content;
    }
    this.unplaced = p ? e == 0 ? v.empty : new v(Or(s.content, e - 1, 1), e - 1, f < 0 ? s.openEnd : e - 1) : new v(Or(s.content, e, c), s.openStart, s.openEnd);
  }
  mustMoveInline() {
    if (!this.$to.parent.isTextblock)
      return -1;
    let e = this.frontier[this.depth], n;
    if (!e.type.isTextblock || !is(this.$to, this.$to.depth, e.type, e.match, !1) || this.$to.depth == this.depth && (n = this.findCloseLevel(this.$to)) && n.depth == this.depth)
      return -1;
    let { depth: r } = this.$to, i = this.$to.after(r);
    for (; r > 1 && i == this.$to.end(--r); )
      ++i;
    return i;
  }
  findCloseLevel(e) {
    e: for (let n = Math.min(this.depth, e.depth); n >= 0; n--) {
      let { match: r, type: i } = this.frontier[n], o = n < e.depth && e.end(n + 1) == e.pos + (e.depth - (n + 1)), s = is(e, n, i, r, o);
      if (s) {
        for (let l = n - 1; l >= 0; l--) {
          let { match: a, type: c } = this.frontier[l], u = is(e, l, c, a, !0);
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
    n.fit.childCount && (this.placed = Dr(this.placed, n.depth, n.fit)), e = n.move;
    for (let r = n.depth + 1; r <= e.depth; r++) {
      let i = e.node(r), o = i.type.contentMatch.fillBefore(i.content, !0, e.index(r));
      this.openFrontierNode(i.type, i.attrs, o);
    }
    return e;
  }
  openFrontierNode(e, n = null, r) {
    let i = this.frontier[this.depth];
    i.match = i.match.matchType(e), this.placed = Dr(this.placed, this.depth, M.from(e.create(n, r))), this.frontier.push({ type: e, match: e.contentMatch });
  }
  closeFrontierNode() {
    let n = this.frontier.pop().match.fillBefore(M.empty, !0);
    n.childCount && (this.placed = Dr(this.placed, this.frontier.length, n));
  }
}
function Or(t, e, n) {
  return e == 0 ? t.cutByIndex(n, t.childCount) : t.replaceChild(0, t.firstChild.copy(Or(t.firstChild.content, e - 1, n)));
}
function Dr(t, e, n) {
  return e == 0 ? t.append(n) : t.replaceChild(t.childCount - 1, t.lastChild.copy(Dr(t.lastChild.content, e - 1, n)));
}
function mu(t, e) {
  for (let n = 0; n < e; n++)
    t = t.firstChild.content;
  return t;
}
function Gf(t, e, n) {
  if (e <= 0)
    return t;
  let r = t.content;
  return e > 1 && (r = r.replaceChild(0, Gf(r.firstChild, e - 1, r.childCount == 1 ? n - 1 : 0))), e > 0 && (r = t.type.contentMatch.fillBefore(r).append(r), n <= 0 && (r = r.append(t.type.contentMatch.matchFragment(r).fillBefore(M.empty, !0)))), t.copy(r);
}
function is(t, e, n, r, i) {
  let o = t.node(e), s = i ? t.indexAfter(e) : t.index(e);
  if (s == o.childCount && !n.compatibleContent(o.type))
    return null;
  let l = r.fillBefore(o.content, !0, s);
  return l && !s1(n, o.content, s) ? l : null;
}
function s1(t, e, n) {
  for (let r = n; r < e.childCount; r++)
    if (!t.allowsMarks(e.child(r).marks))
      return !0;
  return !1;
}
function l1(t) {
  return t.spec.defining || t.spec.definingForContent;
}
function gu(t, e) {
  for (let n = 0; ; n++) {
    let r = e < 0 ? t.firstChild : t.lastChild;
    if (!r || r.isAtom)
      return n;
    t = r.content;
  }
}
function a1(t, e, n, r) {
  if (!r.size)
    return t.deleteRange(e, n);
  let i = t.doc.resolve(e), o = t.doc.resolve(n);
  if (Jf(i, o, r))
    return t.step(new de(e, n, r));
  let s = Xf(i, o);
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
    let f = c[d], p = l1(f.type);
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
        let S = i.node(y - 1), C = i.index(y - 1);
        if (S.canReplaceWith(C, C, p.type, p.marks))
          return t.replace(i.before(y), g ? o.after(y) : n, new v(Yf(r.content, 0, r.openStart, f), f, r.openEnd));
      }
  }
  let h = t.steps.length;
  for (let d = s.length - 1; d >= 0 && (t.replace(e, n, r), !(t.steps.length > h)); d--) {
    let f = s[d];
    f < 0 || (e = i.before(f), n = o.after(f));
  }
}
function Yf(t, e, n, r, i) {
  if (e < n) {
    let o = t.firstChild;
    t = t.replaceChild(0, o.copy(Yf(o.content, e + 1, n, r, o)));
  }
  if (e > r) {
    let o = i.contentMatchAt(0), s = o.fillBefore(t).append(t);
    t = s.append(o.matchFragment(s).fillBefore(M.empty, !0));
  }
  return t;
}
function c1(t, e, n, r) {
  if (!r.isInline && e == n && t.doc.resolve(e).parent.content.size) {
    let i = r1(t.doc, e, r.type);
    i != null && (e = n = i);
  }
  t.replaceRange(e, n, new v(M.from(r), 0, 0));
}
function u1(t, e, n) {
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
  let o = Xf(r, i);
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
function Xf(t, e) {
  let n = [], r = Math.min(t.depth, e.depth);
  for (let i = r; i >= 0; i--) {
    let o = t.start(i);
    if (o < t.pos - (t.depth - i) || e.end(i) > e.pos + (e.depth - i) || t.node(i).type.spec.isolating || e.node(i).type.spec.isolating)
      break;
    (o == e.start(i) || i == t.depth && i == e.depth && t.parent.inlineContent && e.parent.inlineContent && i && e.start(i - 1) == o - 1) && n.push(i);
  }
  return n;
}
class nr extends De {
  /**
  Construct an attribute step.
  */
  constructor(e, n, r) {
    super(), this.pos = e, this.attr = n, this.value = r;
  }
  apply(e) {
    let n = e.nodeAt(this.pos);
    if (!n)
      return pe.fail("No node at attribute step's position");
    let r = /* @__PURE__ */ Object.create(null);
    for (let o in n.attrs)
      r[o] = n.attrs[o];
    r[this.attr] = this.value;
    let i = n.type.create(r, null, n.marks);
    return pe.fromReplace(e, this.pos, this.pos + 1, new v(M.from(i), 0, n.isLeaf ? 0 : 1));
  }
  getMap() {
    return Ye.empty;
  }
  invert(e) {
    return new nr(this.pos, this.attr, e.nodeAt(this.pos).attrs[this.attr]);
  }
  map(e) {
    let n = e.mapResult(this.pos, 1);
    return n.deletedAfter ? null : new nr(n.pos, this.attr, this.value);
  }
  toJSON() {
    return { stepType: "attr", pos: this.pos, attr: this.attr, value: this.value };
  }
  static fromJSON(e, n) {
    if (typeof n.pos != "number" || typeof n.attr != "string")
      throw new RangeError("Invalid input for AttrStep.fromJSON");
    return new nr(n.pos, n.attr, n.value);
  }
}
De.jsonID("attr", nr);
class Zr extends De {
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
    return pe.ok(r);
  }
  getMap() {
    return Ye.empty;
  }
  invert(e) {
    return new Zr(this.attr, e.attrs[this.attr]);
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
    return new Zr(n.attr, n.value);
  }
}
De.jsonID("docAttr", Zr);
let or = class extends Error {
};
or = function t(e) {
  let n = Error.call(this, e);
  return n.__proto__ = t.prototype, n;
};
or.prototype = Object.create(Error.prototype);
or.prototype.constructor = or;
or.prototype.name = "TransformError";
class Qf {
  /**
  Create a transform that starts with the given document.
  */
  constructor(e) {
    this.doc = e, this.steps = [], this.docs = [], this.mapping = new lo();
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
      throw new or(n.failed);
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
  replace(e, n = e, r = v.empty) {
    let i = Ao(this.doc, e, n, r);
    return i && this.step(i), this;
  }
  /**
  Replace the given range with the given content, which may be a
  fragment, node, or array of nodes.
  */
  replaceWith(e, n, r) {
    return this.replace(e, n, new v(M.from(r), 0, 0));
  }
  /**
  Delete the content between the given positions.
  */
  delete(e, n) {
    return this.replace(e, n, v.empty);
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
    return a1(this, e, n, r), this;
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
    return c1(this, e, n, r), this;
  }
  /**
  Delete the given range, expanding it to cover fully covered
  parent nodes until a valid replace is found.
  */
  deleteRange(e, n) {
    return u1(this, e, n), this;
  }
  /**
  Split the content in the given range off from its parent, if there
  is sibling content before or after it, and move it up the tree to
  the depth specified by `target`. You'll probably want to use
  [`liftTarget`](https://prosemirror.net/docs/ref/#transform.liftTarget) to compute `target`, to make
  sure the lift is valid.
  */
  lift(e, n) {
    return Kw(this, e, n), this;
  }
  /**
  Join the blocks around the given position. If depth is 2, their
  last and first siblings are also joined, and so on.
  */
  join(e, n = 1) {
    return n1(this, e, n), this;
  }
  /**
  Wrap the given [range](https://prosemirror.net/docs/ref/#model.NodeRange) in the given set of wrappers.
  The wrappers are assumed to be valid in this position, and should
  probably be computed with [`findWrapping`](https://prosemirror.net/docs/ref/#transform.findWrapping).
  */
  wrap(e, n) {
    return Gw(this, e, n), this;
  }
  /**
  Set the type of all textblocks (partly) between `from` and `to` to
  the given node type with the given attributes.
  */
  setBlockType(e, n = e, r, i = null) {
    return Yw(this, e, n, r, i), this;
  }
  /**
  Change the type, attributes, and/or marks of the node at `pos`.
  When `type` isn't given, the existing node type is preserved,
  */
  setNodeMarkup(e, n, r = null, i) {
    return Qw(this, e, n, r, i), this;
  }
  /**
  Set a single attribute on a given node to a new value.
  The `pos` addresses the document content. Use `setDocAttribute`
  to set attributes on the document itself.
  */
  setNodeAttribute(e, n, r) {
    return this.step(new nr(e, n, r)), this;
  }
  /**
  Set a single attribute on the document to a new value.
  */
  setDocAttribute(e, n) {
    return this.step(new Zr(e, n)), this;
  }
  /**
  Add a mark to the node at position `pos`.
  */
  addNodeMark(e, n) {
    return this.step(new sn(e, n)), this;
  }
  /**
  Remove a mark (or all marks of the given type) from the node at
  position `pos`.
  */
  removeNodeMark(e, n) {
    let r = this.doc.nodeAt(e);
    if (!r)
      throw new RangeError("No node at position " + e);
    if (n instanceof Q)
      n.isInSet(r.marks) && this.step(new Fn(e, n));
    else {
      let i = r.marks, o, s = [];
      for (; o = n.isInSet(i); )
        s.push(new Fn(e, o)), i = o.removeFromSet(i);
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
    return Zw(this, e, n, r), this;
  }
  /**
  Add the given mark to the inline content between `from` and `to`.
  */
  addMark(e, n, r) {
    return jw(this, e, n, r), this;
  }
  /**
  Remove marks from inline nodes between `from` and `to`. When
  `mark` is a single mark, remove precisely that mark. When it is
  a mark type, remove all marks of that type. When it is null,
  remove all marks of any type.
  */
  removeMark(e, n, r) {
    return qw(this, e, n, r), this;
  }
  /**
  Removes all marks and nodes from the content of the node at
  `pos` that don't match the given new parent node type. Accepts
  an optional starting [content match](https://prosemirror.net/docs/ref/#model.ContentMatch) as
  third argument.
  */
  clearIncompatible(e, n, r) {
    return Ql(this, e, n, r), this;
  }
}
const ss = /* @__PURE__ */ Object.create(null);
class W {
  /**
  Initialize a selection with the head and anchor and ranges. If no
  ranges are given, constructs a single range across `$anchor` and
  `$head`.
  */
  constructor(e, n, r) {
    this.$anchor = e, this.$head = n, this.ranges = r || [new Zf(e.min(n), e.max(n))];
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
  replace(e, n = v.empty) {
    let r = n.content.lastChild, i = null;
    for (let l = 0; l < n.openEnd; l++)
      i = r, r = r.lastChild;
    let o = e.steps.length, s = this.ranges;
    for (let l = 0; l < s.length; l++) {
      let { $from: a, $to: c } = s[l], u = e.mapping.slice(o);
      e.replaceRange(u.map(a.pos), u.map(c.pos), l ? v.empty : n), l == 0 && bu(e, o, (r ? r.isInline : i && i.isTextblock) ? -1 : 1);
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
      o ? e.deleteRange(c, u) : (e.replaceRangeWith(c, u, n), bu(e, r, n.isInline ? -1 : 1));
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
    let i = e.parent.inlineContent ? new K(e) : Jn(e.node(0), e.parent, e.pos, e.index(), n, r);
    if (i)
      return i;
    for (let o = e.depth - 1; o >= 0; o--) {
      let s = n < 0 ? Jn(e.node(0), e.node(o), e.before(o + 1), e.index(o), n, r) : Jn(e.node(0), e.node(o), e.after(o + 1), e.index(o) + 1, n, r);
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
    return this.findFrom(e, n) || this.findFrom(e, -n) || new Ze(e.node(0));
  }
  /**
  Find the cursor or leaf node selection closest to the start of
  the given document. Will return an
  [`AllSelection`](https://prosemirror.net/docs/ref/#state.AllSelection) if no valid position
  exists.
  */
  static atStart(e) {
    return Jn(e, e, 0, 0, 1) || new Ze(e);
  }
  /**
  Find the cursor or leaf node selection closest to the end of the
  given document.
  */
  static atEnd(e) {
    return Jn(e, e, e.content.size, e.childCount, -1) || new Ze(e);
  }
  /**
  Deserialize the JSON representation of a selection. Must be
  implemented for custom classes (as a static class method).
  */
  static fromJSON(e, n) {
    if (!n || !n.type)
      throw new RangeError("Invalid input for Selection.fromJSON");
    let r = ss[n.type];
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
    if (e in ss)
      throw new RangeError("Duplicate use of selection JSON ID " + e);
    return ss[e] = n, n.prototype.jsonID = e, n;
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
    return K.between(this.$anchor, this.$head).getBookmark();
  }
}
W.prototype.visible = !0;
class Zf {
  /**
  Create a range.
  */
  constructor(e, n) {
    this.$from = e, this.$to = n;
  }
}
let yu = !1;
function ku(t) {
  !yu && !t.parent.inlineContent && (yu = !0, console.warn("TextSelection endpoint not pointing into a node with inline content (" + t.parent.type.name + ")"));
}
class K extends W {
  /**
  Construct a text selection between the given points.
  */
  constructor(e, n = e) {
    ku(e), ku(n), super(e, n);
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
      return W.near(r);
    let i = e.resolve(n.map(this.anchor));
    return new K(i.parent.inlineContent ? i : r, r);
  }
  replace(e, n = v.empty) {
    if (super.replace(e, n), n == v.empty) {
      let r = this.$from.marksAcross(this.$to);
      r && e.ensureMarks(r);
    }
  }
  eq(e) {
    return e instanceof K && e.anchor == this.anchor && e.head == this.head;
  }
  getBookmark() {
    return new Eo(this.anchor, this.head);
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
    return new K(e.resolve(n.anchor), e.resolve(n.head));
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
      let o = W.findFrom(n, r, !0) || W.findFrom(n, -r, !0);
      if (o)
        n = o.$head;
      else
        return W.near(n, r);
    }
    return e.parent.inlineContent || (i == 0 ? e = n : (e = (W.findFrom(e, -r, !0) || W.findFrom(e, r, !0)).$anchor, e.pos < n.pos != i < 0 && (e = n))), new K(e, n);
  }
}
W.jsonID("text", K);
class Eo {
  constructor(e, n) {
    this.anchor = e, this.head = n;
  }
  map(e) {
    return new Eo(e.map(this.anchor), e.map(this.head));
  }
  resolve(e) {
    return K.between(e.resolve(this.anchor), e.resolve(this.head));
  }
}
class q extends W {
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
    return r ? W.near(o) : new q(o);
  }
  content() {
    return new v(M.from(this.node), 0, 0);
  }
  eq(e) {
    return e instanceof q && e.anchor == this.anchor;
  }
  toJSON() {
    return { type: "node", anchor: this.anchor };
  }
  getBookmark() {
    return new ea(this.anchor);
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.anchor != "number")
      throw new RangeError("Invalid input for NodeSelection.fromJSON");
    return new q(e.resolve(n.anchor));
  }
  /**
  Create a node selection from non-resolved positions.
  */
  static create(e, n) {
    return new q(e.resolve(n));
  }
  /**
  Determines whether the given node may be selected as a node
  selection.
  */
  static isSelectable(e) {
    return !e.isText && e.type.spec.selectable !== !1;
  }
}
q.prototype.visible = !1;
W.jsonID("node", q);
class ea {
  constructor(e) {
    this.anchor = e;
  }
  map(e) {
    let { deleted: n, pos: r } = e.mapResult(this.anchor);
    return n ? new Eo(r, r) : new ea(r);
  }
  resolve(e) {
    let n = e.resolve(this.anchor), r = n.nodeAfter;
    return r && q.isSelectable(r) ? new q(n) : W.near(n);
  }
}
class Ze extends W {
  /**
  Create an all-selection over the given document.
  */
  constructor(e) {
    super(e.resolve(0), e.resolve(e.content.size));
  }
  replace(e, n = v.empty) {
    if (n == v.empty) {
      e.delete(0, e.doc.content.size);
      let r = W.atStart(e.doc);
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
    return new Ze(e);
  }
  map(e) {
    return new Ze(e);
  }
  eq(e) {
    return e instanceof Ze;
  }
  getBookmark() {
    return h1;
  }
}
W.jsonID("all", Ze);
const h1 = {
  map() {
    return this;
  },
  resolve(t) {
    return new Ze(t);
  }
};
function Jn(t, e, n, r, i, o = !1) {
  if (e.inlineContent)
    return K.create(t, n);
  for (let s = r - (i > 0 ? 0 : 1); i > 0 ? s < e.childCount : s >= 0; s += i) {
    let l = e.child(s);
    if (l.isAtom) {
      if (!o && q.isSelectable(l))
        return q.create(t, n - (i < 0 ? l.nodeSize : 0));
    } else {
      let a = Jn(t, l, n + i, i < 0 ? l.childCount : 0, i, o);
      if (a)
        return a;
    }
    n += l.nodeSize * i;
  }
  return null;
}
function bu(t, e, n) {
  let r = t.steps.length - 1;
  if (r < e)
    return;
  let i = t.steps[r];
  if (!(i instanceof de || i instanceof ve))
    return;
  let o = t.mapping.maps[r], s;
  o.forEach((l, a, c, u) => {
    s == null && (s = u);
  }), t.setSelection(W.near(t.doc.resolve(s), n));
}
const wu = 1, zi = 2, xu = 4;
class f1 extends Qf {
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
    return this.curSelection = e, this.curSelectionFor = this.steps.length, this.updated = (this.updated | wu) & ~zi, this.storedMarks = null, this;
  }
  /**
  Whether the selection was explicitly updated by this transaction.
  */
  get selectionSet() {
    return (this.updated & wu) > 0;
  }
  /**
  Set the current stored marks.
  */
  setStoredMarks(e) {
    return this.storedMarks = e, this.updated |= zi, this;
  }
  /**
  Make sure the current stored marks or, if that is null, the marks
  at the selection, match the given set of marks. Does nothing if
  this is already the case.
  */
  ensureMarks(e) {
    return Q.sameSet(this.storedMarks || this.selection.$from.marks(), e) || this.setStoredMarks(e), this;
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
    return (this.updated & zi) > 0;
  }
  /**
  @internal
  */
  addStep(e, n) {
    super.addStep(e, n), this.updated = this.updated & ~zi, this.storedMarks = null;
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
    return n && (e = e.mark(this.storedMarks || (r.empty ? r.$from.marks() : r.$from.marksAcross(r.$to) || Q.none))), r.replaceWith(this, e), this;
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
      return this.replaceRangeWith(n, r, i.text(e, o)), !this.selection.empty && this.selection.to == n + e.length && this.setSelection(W.near(this.selection.$to)), this;
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
    return this.updated |= xu, this;
  }
  /**
  True when this transaction has had `scrollIntoView` called on it.
  */
  get scrolledIntoView() {
    return (this.updated & xu) > 0;
  }
}
function Cu(t, e) {
  return !e || !t ? t : t.bind(e);
}
class Rr {
  constructor(e, n, r) {
    this.name = e, this.init = Cu(n.init, r), this.apply = Cu(n.apply, r);
  }
}
const d1 = [
  new Rr("doc", {
    init(t) {
      return t.doc || t.schema.topNodeType.createAndFill();
    },
    apply(t) {
      return t.doc;
    }
  }),
  new Rr("selection", {
    init(t, e) {
      return t.selection || W.atStart(e.doc);
    },
    apply(t) {
      return t.selection;
    }
  }),
  new Rr("storedMarks", {
    init(t) {
      return t.storedMarks || null;
    },
    apply(t, e, n, r) {
      return r.selection.$cursor ? t.storedMarks : null;
    }
  }),
  new Rr("scrollToSelection", {
    init() {
      return 0;
    },
    apply(t, e) {
      return t.scrolledIntoView ? e + 1 : e;
    }
  })
];
class ls {
  constructor(e, n) {
    this.schema = e, this.plugins = [], this.pluginsByKey = /* @__PURE__ */ Object.create(null), this.fields = d1.slice(), n && n.forEach((r) => {
      if (this.pluginsByKey[r.key])
        throw new RangeError("Adding different instances of a keyed plugin (" + r.key + ")");
      this.plugins.push(r), this.pluginsByKey[r.key] = r, r.spec.state && this.fields.push(new Rr(r.key, r.spec.state, r));
    });
  }
}
class Tn {
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
    let n = new Tn(this.config), r = this.config.fields;
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
    return new f1(this);
  }
  /**
  Create a new state.
  */
  static create(e) {
    let n = new ls(e.doc ? e.doc.type.schema : e.schema, e.plugins), r = new Tn(n);
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
    let n = new ls(this.schema, e.plugins), r = n.fields, i = new Tn(n);
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
    let i = new ls(e.schema, e.plugins), o = new Tn(i);
    return i.fields.forEach((s) => {
      if (s.name == "doc")
        o.doc = lt.fromJSON(e.schema, n.doc);
      else if (s.name == "selection")
        o.selection = W.fromJSON(o.doc, n.selection);
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
function ed(t, e, n) {
  for (let r in t) {
    let i = t[r];
    i instanceof Function ? i = i.bind(e) : r == "handleDOMEvents" && (i = ed(i, e, {})), n[r] = i;
  }
  return n;
}
class je {
  /**
  Create a plugin.
  */
  constructor(e) {
    this.spec = e, this.props = {}, e.props && ed(e.props, this, this.props), this.key = e.key ? e.key.key : td("plugin");
  }
  /**
  Extract the plugin's state field from an editor state.
  */
  getState(e) {
    return e[this.key];
  }
}
const as = /* @__PURE__ */ Object.create(null);
function td(t) {
  return t in as ? t + "$" + ++as[t] : (as[t] = 0, t + "$");
}
class qe {
  /**
  Create a plugin key.
  */
  constructor(e = "key") {
    this.key = td(e);
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
const ta = (t, e) => t.selection.empty ? !1 : (e && e(t.tr.deleteSelection().scrollIntoView()), !0);
function nd(t, e) {
  let { $cursor: n } = t.selection;
  return !n || (e ? !e.endOfTextblock("backward", t) : n.parentOffset > 0) ? null : n;
}
const rd = (t, e, n) => {
  let r = nd(t, n);
  if (!r)
    return !1;
  let i = na(r);
  if (!i) {
    let s = r.blockRange(), l = s && Mo(s);
    return l == null ? !1 : (e && e(t.tr.lift(s, l).scrollIntoView()), !0);
  }
  let o = i.nodeBefore;
  if (sd(t, i, e, -1))
    return !0;
  if (r.parent.content.size == 0 && (sr(o, "end") || q.isSelectable(o)))
    for (let s = r.depth; ; s--) {
      let l = Ao(t.doc, r.before(s), r.after(s), v.empty);
      if (l && l.slice.size < l.to - l.from) {
        if (e) {
          let a = t.tr.step(l);
          a.setSelection(sr(o, "end") ? W.findFrom(a.doc.resolve(a.mapping.map(i.pos, -1)), -1) : q.create(a.doc, i.pos - o.nodeSize)), e(a.scrollIntoView());
        }
        return !0;
      }
      if (s == 1 || r.node(s - 1).childCount > 1)
        break;
    }
  return o.isAtom && i.depth == r.depth - 1 ? (e && e(t.tr.delete(i.pos - o.nodeSize, i.pos).scrollIntoView()), !0) : !1;
}, p1 = (t, e, n) => {
  let r = nd(t, n);
  if (!r)
    return !1;
  let i = na(r);
  return i ? m1(t, i, e) : !1;
};
function m1(t, e, n) {
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
  let c = Ao(t.doc, o, a, v.empty);
  if (!c || c.from != o || c instanceof de && c.slice.size >= a - o)
    return !1;
  if (n) {
    let u = t.tr.step(c);
    u.setSelection(K.create(u.doc, o)), n(u.scrollIntoView());
  }
  return !0;
}
function sr(t, e, n = !1) {
  for (let r = t; r; r = e == "start" ? r.firstChild : r.lastChild) {
    if (r.isTextblock)
      return !0;
    if (n && r.childCount != 1)
      return !1;
  }
  return !1;
}
const id = (t, e, n) => {
  let { $head: r, empty: i } = t.selection, o = r;
  if (!i)
    return !1;
  if (r.parent.isTextblock) {
    if (n ? !n.endOfTextblock("backward", t) : r.parentOffset > 0)
      return !1;
    o = na(r);
  }
  let s = o && o.nodeBefore;
  return !s || !q.isSelectable(s) ? !1 : (e && e(t.tr.setSelection(q.create(t.doc, o.pos - s.nodeSize)).scrollIntoView()), !0);
};
function na(t) {
  if (!t.parent.type.spec.isolating)
    for (let e = t.depth - 1; e >= 0; e--) {
      if (t.index(e) > 0)
        return t.doc.resolve(t.before(e + 1));
      if (t.node(e).type.spec.isolating)
        break;
    }
  return null;
}
function g1(t, e) {
  let { $cursor: n } = t.selection;
  return !n || (e ? !e.endOfTextblock("forward", t) : n.parentOffset < n.parent.content.size) ? null : n;
}
const y1 = (t, e, n) => {
  let r = g1(t, n);
  if (!r)
    return !1;
  let i = od(r);
  if (!i)
    return !1;
  let o = i.nodeAfter;
  if (sd(t, i, e, 1))
    return !0;
  if (r.parent.content.size == 0 && (sr(o, "start") || q.isSelectable(o))) {
    let s = Ao(t.doc, r.before(), r.after(), v.empty);
    if (s && s.slice.size < s.to - s.from) {
      if (e) {
        let l = t.tr.step(s);
        l.setSelection(sr(o, "start") ? W.findFrom(l.doc.resolve(l.mapping.map(i.pos)), 1) : q.create(l.doc, l.mapping.map(i.pos))), e(l.scrollIntoView());
      }
      return !0;
    }
  }
  return o.isAtom && i.depth == r.depth - 1 ? (e && e(t.tr.delete(i.pos, i.pos + o.nodeSize).scrollIntoView()), !0) : !1;
}, k1 = (t, e, n) => {
  let { $head: r, empty: i } = t.selection, o = r;
  if (!i)
    return !1;
  if (r.parent.isTextblock) {
    if (n ? !n.endOfTextblock("forward", t) : r.parentOffset < r.parent.content.size)
      return !1;
    o = od(r);
  }
  let s = o && o.nodeAfter;
  return !s || !q.isSelectable(s) ? !1 : (e && e(t.tr.setSelection(q.create(t.doc, o.pos)).scrollIntoView()), !0);
};
function od(t) {
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
const b1 = (t, e) => {
  let { $head: n, $anchor: r } = t.selection;
  return !n.parent.type.spec.code || !n.sameParent(r) ? !1 : (e && e(t.tr.insertText(`
`).scrollIntoView()), !0);
};
function ra(t) {
  for (let e = 0; e < t.edgeCount; e++) {
    let { type: n } = t.edge(e);
    if (n.isTextblock && !n.hasRequiredAttrs())
      return n;
  }
  return null;
}
const w1 = (t, e) => {
  let { $head: n, $anchor: r } = t.selection;
  if (!n.parent.type.spec.code || !n.sameParent(r))
    return !1;
  let i = n.node(-1), o = n.indexAfter(-1), s = ra(i.contentMatchAt(o));
  if (!s || !i.canReplaceWith(o, o, s))
    return !1;
  if (e) {
    let l = n.after(), a = t.tr.replaceWith(l, l, s.createAndFill());
    a.setSelection(W.near(a.doc.resolve(l), 1)), e(a.scrollIntoView());
  }
  return !0;
}, x1 = (t, e) => {
  let n = t.selection, { $from: r, $to: i } = n;
  if (n instanceof Ze || r.parent.inlineContent || i.parent.inlineContent)
    return !1;
  let o = ra(i.parent.contentMatchAt(i.indexAfter()));
  if (!o || !o.isTextblock)
    return !1;
  if (e) {
    let s = (!r.parentOffset && i.index() < i.parent.childCount ? r : i).pos, l = t.tr.insert(s, o.createAndFill());
    l.setSelection(K.create(l.doc, s + 1)), e(l.scrollIntoView());
  }
  return !0;
}, C1 = (t, e) => {
  let { $cursor: n } = t.selection;
  if (!n || n.parent.content.size)
    return !1;
  if (n.depth > 1 && n.after() != n.end(-1)) {
    let o = n.before();
    if ($r(t.doc, o))
      return e && e(t.tr.split(o).scrollIntoView()), !0;
  }
  let r = n.blockRange(), i = r && Mo(r);
  return i == null ? !1 : (e && e(t.tr.lift(r, i).scrollIntoView()), !0);
};
function S1(t) {
  return (e, n) => {
    if (e.selection instanceof q && e.selection.node.isBlock) {
      let { $from: f } = e.selection;
      return !f.parentOffset || !$r(e.doc, f.pos) ? !1 : (n && n(e.tr.split(f.pos).scrollIntoView()), !0);
    }
    if (!e.selection.$from.depth)
      return !1;
    let r = e.tr;
    !e.selection.empty && (e.selection instanceof K || e.selection instanceof Ze) && r.deleteSelection();
    let { $from: i } = r.selection, o = r.steps.length, s = [], l, a, c = !1, u = !1;
    for (let f = i.depth; ; f--)
      if (i.node(f).isBlock) {
        c = i.end(f) == i.pos + (i.depth - f), u = i.start(f) == i.pos - (i.depth - f), a = ra(i.node(f - 1).contentMatchAt(i.indexAfter(f - 1))), s.unshift(c && a ? { type: a } : null), l = f;
        break;
      } else {
        if (f == 1)
          return !1;
        s.unshift(null);
      }
    let h = i.pos, d = $r(r.doc, h, s.length, s);
    if (d || (s[0] = a ? { type: a } : null, d = $r(r.doc, h, s.length, s)), !d)
      return !1;
    if (r.split(h, s.length, s), !c && u && i.node(l).type != a) {
      let f = r.mapping.slice(o), p = f.map(i.before(l)), m = r.doc.resolve(p);
      a && i.node(l - 1).canReplaceWith(m.index(), m.index() + 1, a) && r.setNodeMarkup(f.map(i.before(l)), a);
    }
    return n && n(r.scrollIntoView()), !0;
  };
}
const N1 = S1(), I1 = (t, e) => (e && e(t.tr.setSelection(new Ze(t.doc))), !0);
function M1(t, e, n) {
  let r = e.nodeBefore, i = e.nodeAfter, o = e.index();
  return !r || !i || !r.type.compatibleContent(i.type) ? !1 : !r.content.size && e.parent.canReplace(o - 1, o) ? (n && n(t.tr.delete(e.pos - r.nodeSize, e.pos).scrollIntoView()), !0) : !e.parent.canReplace(o, o + 1) || !(i.isTextblock || To(t.doc, e.pos)) ? !1 : (n && n(t.tr.join(e.pos).scrollIntoView()), !0);
}
function sd(t, e, n, r) {
  let i = e.nodeBefore, o = e.nodeAfter, s, l, a = i.type.spec.isolating || o.type.spec.isolating;
  if (!a && M1(t, e, n))
    return !0;
  let c = !a && e.parent.canReplace(e.index(), e.index() + 1);
  if (c && (s = (l = i.contentMatchAt(i.childCount)).findWrapping(o.type)) && l.matchType(s[0] || o.type).validEnd) {
    if (n) {
      let f = e.pos + o.nodeSize, p = M.empty;
      for (let g = s.length - 1; g >= 0; g--)
        p = M.from(s[g].create(null, p));
      p = M.from(i.copy(p));
      let m = t.tr.step(new ve(e.pos - 1, f, e.pos, f, new v(p, 1, 0), s.length, !0)), y = m.doc.resolve(f + 2 * s.length);
      y.nodeAfter && y.nodeAfter.type == i.type && To(m.doc, y.pos) && m.join(y.pos), n(m.scrollIntoView());
    }
    return !0;
  }
  let u = o.type.spec.isolating || r > 0 && a ? null : W.findFrom(e, 1), h = u && u.$from.blockRange(u.$to), d = h && Mo(h);
  if (d != null && d >= e.depth)
    return n && n(t.tr.lift(h, d).scrollIntoView()), !0;
  if (c && sr(o, "start", !0) && sr(i, "end")) {
    let f = i, p = [];
    for (; p.push(f), !f.isTextblock; )
      f = f.lastChild;
    let m = o, y = 1;
    for (; !m.isTextblock; m = m.firstChild)
      y++;
    if (f.canReplace(f.childCount, f.childCount, m.content)) {
      if (n) {
        let g = M.empty;
        for (let C = p.length - 1; C >= 0; C--)
          g = M.from(p[C].copy(g));
        let S = t.tr.step(new ve(e.pos - p.length, e.pos + o.nodeSize, e.pos + y, e.pos + o.nodeSize - y, new v(g, p.length, 0), 0, !0));
        n(S.scrollIntoView());
      }
      return !0;
    }
  }
  return !1;
}
function ld(t) {
  return function(e, n) {
    let r = e.selection, i = t < 0 ? r.$from : r.$to, o = i.depth;
    for (; i.node(o).isInline; ) {
      if (!o)
        return !1;
      o--;
    }
    return i.node(o).isTextblock ? (n && n(e.tr.setSelection(K.create(e.doc, t < 0 ? i.start(o) : i.end(o)))), !0) : !1;
  };
}
const T1 = ld(-1), A1 = ld(1);
function ia(t, e = null) {
  return function(n, r) {
    let { $from: i, $to: o } = n.selection, s = i.blockRange(o), l = s && Zl(s, t, e);
    return l ? (r && r(n.tr.wrap(s, l).scrollIntoView()), !0) : !1;
  };
}
function ei(t, e = null) {
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
function E1(t, e, n, r) {
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
function vo(t, e = null, n) {
  return function(r, i) {
    let { empty: o, $cursor: s, ranges: l } = r.selection;
    if (o && !s || !E1(r.doc, l, t))
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
            let f = h.pos, p = d.pos, m = h.nodeAfter, y = d.nodeBefore, g = m && m.isText ? /^\s*/.exec(m.text)[0].length : 0, S = y && y.isText ? /\s*$/.exec(y.text)[0].length : 0;
            f + g < p && (f += g, p -= S), c.addMark(f, p, t.create(e));
          }
        }
        i(c.scrollIntoView());
      }
    return !0;
  };
}
function pr(...t) {
  return function(e, n, r) {
    for (let i = 0; i < t.length; i++)
      if (t[i](e, n, r))
        return !0;
    return !1;
  };
}
let cs = pr(ta, rd, id), Su = pr(ta, y1, k1);
const Bt = {
  Enter: pr(b1, x1, C1, N1),
  "Mod-Enter": w1,
  Backspace: cs,
  "Mod-Backspace": cs,
  "Shift-Backspace": cs,
  Delete: Su,
  "Mod-Delete": Su,
  "Mod-a": I1
}, ad = {
  "Ctrl-h": Bt.Backspace,
  "Alt-Backspace": Bt["Mod-Backspace"],
  "Ctrl-d": Bt.Delete,
  "Ctrl-Alt-Backspace": Bt["Mod-Delete"],
  "Alt-Delete": Bt["Mod-Delete"],
  "Alt-d": Bt["Mod-Delete"],
  "Ctrl-a": T1,
  "Ctrl-e": A1
};
for (let t in Bt)
  ad[t] = Bt[t];
const v1 = typeof navigator < "u" ? /Mac|iP(hone|[oa]d)/.test(navigator.platform) : typeof os < "u" && os.platform ? os.platform() == "darwin" : !1, O1 = v1 ? ad : Bt;
class tt {
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
    this.match = e, this.match = e, this.handler = typeof n == "string" ? D1(n) : n, this.undoable = r.undoable !== !1, this.inCode = r.inCode || !1, this.inCodeMark = r.inCodeMark !== !1;
  }
}
function D1(t) {
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
const R1 = (t, e) => {
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
new tt(/--$/, "—", { inCodeMark: !1 });
new tt(/\.\.\.$/, "…", { inCodeMark: !1 });
new tt(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/, "“", { inCodeMark: !1 });
new tt(/"$/, "”", { inCodeMark: !1 });
new tt(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/, "‘", { inCodeMark: !1 });
new tt(/'$/, "’", { inCodeMark: !1 });
function oa(t, e, n = null, r) {
  return new tt(t, (i, o, s, l) => {
    let a = n instanceof Function ? n(o) : n, c = i.tr.delete(s, l), u = c.doc.resolve(s), h = u.blockRange(), d = h && Zl(h, e, a);
    if (!d)
      return null;
    c.wrap(h, d);
    let f = c.doc.resolve(s - 1).nodeBefore;
    return f && f.type == e && To(c.doc, s - 1) && (!r || r(o, f)) && c.join(s - 1), c;
  });
}
function cd(t, e, n = null) {
  return new tt(t, (r, i, o, s) => {
    let l = r.doc.resolve(o), a = n instanceof Function ? n(i) : n;
    return l.node(-1).canReplaceWith(l.index(-1), l.indexAfter(-1), e) ? r.tr.delete(o, s).setBlockType(o, o, e, a) : null;
  });
}
const fn = typeof navigator < "u" ? navigator : null, Nu = typeof document < "u" ? document : null, mn = fn && fn.userAgent || "", ol = /Edge\/(\d+)/.exec(mn), ud = /MSIE \d/.exec(mn), sl = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(mn), sa = !!(ud || sl || ol);
ud ? document.documentMode : sl ? +sl[1] : ol && +ol[1];
const z1 = !sa && /gecko\/(\d+)/i.test(mn);
z1 && +(/Firefox\/(\d+)/.exec(mn) || [0, 0])[1];
const ll = !sa && /Chrome\/(\d+)/.exec(mn), L1 = !!ll;
ll && +ll[1];
const P1 = !sa && !!fn && /Apple Computer/.test(fn.vendor), B1 = P1 && (/Mobile\/\w+/.test(mn) || !!fn && fn.maxTouchPoints > 2);
B1 || fn && /Mac/.test(fn.platform);
const _1 = /Android \d/.test(mn), F1 = !!Nu && "webkitFontSmoothing" in Nu.documentElement.style;
F1 && +(/\bAppleWebKit\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1];
function us(t, e, n, r, i, o) {
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
const $1 = new qe("MILKDOWN_CUSTOM_INPUTRULES");
function V1({ rules: t }) {
  const e = new je({
    key: $1,
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
        return us(n, r, i, o, t, e);
      },
      handleDOMEvents: {
        compositionend: (n) => (setTimeout(() => {
          const { $cursor: r } = n.state.selection;
          r && us(n, r.pos, r.pos, "", t, e);
        }), !1),
        keydown: (n, r) => !(_1 && L1 && r.key === "Enter") || n.composing ? !1 : n.someProp(
          "handleKeyDown",
          (i) => i(n, r)
        ) ? (r.preventDefault(), !0) : !1
      },
      handleKeyDown(n, r) {
        if (r.key !== "Enter") return !1;
        const { $cursor: i } = n.state.selection;
        return i ? us(n, i.pos, i.pos, `
`, t, e) : !1;
      }
    }
  });
  return e;
}
function hd(t) {
  return t.some((e) => e.type.spec.code);
}
function Iu(t, e, n) {
  if (e >= n) return !1;
  let r = !1;
  return t.doc.nodesBetween(e, n, (i) => (i.isInline && hd(i.marks) && (r = !0), !r)), r;
}
function H1(t, e) {
  var n;
  return hd((n = t.storedMarks) != null ? n : t.doc.resolve(e).marks());
}
function ui(t, e, n = {}) {
  return new tt(t, (r, i, o, s) => {
    var l, a, c, u;
    const { tr: h } = r, d = i.length;
    let f = i[d - 1], p = i[0], m = [], y;
    const g = {
      group: f,
      fullMatch: p,
      start: o,
      end: s
    }, S = (l = n.updateCaptured) == null ? void 0 : l.call(n, g);
    if (Object.assign(g, S), { group: f, fullMatch: p, start: o, end: s } = g, p === null || f?.trim() === "") return null;
    if (f) {
      const C = p.search(/\S/), E = o + p.indexOf(f), O = E + f.length, x = Iu(
        r,
        o + C,
        E
      ), A = O < s && Iu(r, O, s);
      if (x || A || H1(r, s))
        return null;
      m = (a = h.storedMarks) != null ? a : [], O < s && h.delete(O, s), E > o && h.delete(o + C, E), y = o + C + f.length;
      const D = (c = n.getAttr) == null ? void 0 : c.call(n, i);
      h.addMark(o, y, e.create(D)), h.setStoredMarks(m), (u = n.beforeDispatch) == null || u.call(n, { match: i, start: o, end: s, tr: h });
    }
    return h;
  });
}
function fd(t) {
  return Object.assign(Object.create(t), t).setTime(Date.now());
}
function j1(t, e) {
  return Array.isArray(t) && t.includes(e.type) || e.type === t;
}
function q1(t) {
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
function W1(t, e) {
  return q1((n) => n.type === e)(t);
}
function K1(t) {
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
function U1(t, e) {
  if (!(t instanceof q)) return;
  const { node: n, $from: r } = t;
  if (j1(e, n))
    return {
      node: n,
      pos: r.pos,
      start: r.start(r.depth),
      depth: r.depth
    };
}
const J1 = (t, e) => {
  const { selection: n, doc: r } = t;
  if (n instanceof q)
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
var dn = {
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
}, ao = {
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
}, G1 = typeof navigator < "u" && /Mac/.test(navigator.platform), Y1 = typeof navigator < "u" && /MSIE \d|Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(navigator.userAgent);
for (var Ce = 0; Ce < 10; Ce++) dn[48 + Ce] = dn[96 + Ce] = String(Ce);
for (var Ce = 1; Ce <= 24; Ce++) dn[Ce + 111] = "F" + Ce;
for (var Ce = 65; Ce <= 90; Ce++)
  dn[Ce] = String.fromCharCode(Ce + 32), ao[Ce] = String.fromCharCode(Ce);
for (var hs in dn) ao.hasOwnProperty(hs) || (ao[hs] = dn[hs]);
function X1(t) {
  var e = G1 && t.metaKey && t.shiftKey && !t.ctrlKey && !t.altKey || Y1 && t.shiftKey && t.key && t.key.length == 1 || t.key == "Unidentified", n = !e && t.key || (t.shiftKey ? ao : dn)[t.keyCode] || t.key || "Unidentified";
  return n == "Esc" && (n = "Escape"), n == "Del" && (n = "Delete"), n == "Left" && (n = "ArrowLeft"), n == "Up" && (n = "ArrowUp"), n == "Right" && (n = "ArrowRight"), n == "Down" && (n = "ArrowDown"), n;
}
const Q1 = typeof navigator < "u" && /Mac|iP(hone|[oa]d)/.test(navigator.platform), Z1 = typeof navigator < "u" && /Win/.test(navigator.platform);
function e0(t) {
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
      Q1 ? s = !0 : i = !0;
    else
      throw new Error("Unrecognized modifier name: " + a);
  }
  return r && (n = "Alt-" + n), i && (n = "Ctrl-" + n), s && (n = "Meta-" + n), o && (n = "Shift-" + n), n;
}
function t0(t) {
  let e = /* @__PURE__ */ Object.create(null);
  for (let n in t)
    e[e0(n)] = t[n];
  return e;
}
function fs(t, e, n = !0) {
  return e.altKey && (t = "Alt-" + t), e.ctrlKey && (t = "Ctrl-" + t), e.metaKey && (t = "Meta-" + t), n && e.shiftKey && (t = "Shift-" + t), t;
}
function n0(t) {
  return new je({ props: { handleKeyDown: dd(t) } });
}
function dd(t) {
  let e = t0(t);
  return function(n, r) {
    let i = X1(r), o, s = e[fs(i, r)];
    if (s && s(n.state, n.dispatch, n))
      return !0;
    if (i.length == 1 && i != " ") {
      if (r.shiftKey) {
        let l = e[fs(i, r, !1)];
        if (l && l(n.state, n.dispatch, n))
          return !0;
      }
      if ((r.altKey || r.metaKey || r.ctrlKey) && // Ctrl-Alt may be used for AltGr on Windows
      !(Z1 && r.ctrlKey && r.altKey) && (o = dn[r.keyCode]) && o != i) {
        let l = e[fs(o, r)];
        if (l && l(n.state, n.dispatch, n))
          return !0;
      }
    }
    return !1;
  };
}
var pd = class {
}, md = class {
  constructor() {
    this.elements = [], this.size = () => this.elements.length, this.top = () => this.elements.at(-1), this.push = (t) => {
      this.top()?.push(t);
    }, this.open = (t) => {
      this.elements.push(t);
    }, this.close = () => {
      const t = this.elements.pop();
      if (!t) throw _h();
      return t;
    };
  }
}, r0 = class gd extends pd {
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
    return new gd(e, n, r);
  }
}, i0 = class extends md {
  #t;
  static {
    this.create = (t, e) => {
      const n = new this(t);
      return (r) => (n.run(e, r), n.toDoc());
    };
  }
  constructor(t) {
    super(), this.#t = Q.none, this.#e = (e) => e.isText, this.#r = (e, n) => {
      if (this.#e(e) && this.#e(n) && Q.sameSet(e.marks, n.marks)) return this.schema.text(e.text + n.text, e.marks);
    }, this.#n = (e) => {
      const n = Object.values({
        ...this.schema.nodes,
        ...this.schema.marks
      }).find((r) => r.spec.parseMarkdown.match(e));
      if (!n) throw Dg(e);
      return n;
    }, this.#o = (e) => {
      const n = this.#n(e);
      n.spec.parseMarkdown.runner(this, e, n);
    }, this.injectRoot = (e, n, r) => (this.openNode(n, r), this.next(e.children), this), this.openNode = (e, n) => (this.open(r0.create(e, [], n)), this), this.#s = () => {
      this.#t = Q.none;
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
      if (!i) throw Og(e, n, r);
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
        if (!n) throw _h();
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
}, Mu = class yd extends pd {
  constructor(e, n, r, i = {}) {
    super(), this.type = e, this.children = n, this.value = r, this.props = i, this.push = (o, ...s) => {
      this.children || (this.children = []), this.children.push(o, ...s);
    }, this.pop = () => this.children?.pop();
  }
  static {
    this.create = (e, n, r, i = {}) => new yd(e, n, r, i);
  }
}, o0 = (t) => Object.prototype.hasOwnProperty.call(t, "size"), s0 = class extends md {
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
      if (!n) throw Rg(e.type);
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
    }, this.openNode = (e, n, r) => (this.open(Mu.create(e, void 0, n, r)), this), this.#f = (e, n) => {
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
      const o = Mu.create(e, n, r, i), s = this.#l(this.#a(o));
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
    }, this.next = (e) => o0(e) ? (e.forEach((n, r, i) => {
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
const Se = function(t) {
  for (var e = 0; ; e++)
    if (t = t.previousSibling, !t)
      return e;
}, lr = function(t) {
  let e = t.assignedSlot || t.parentNode;
  return e && e.nodeType == 11 ? e.host : e;
};
let al = null;
const Pt = function(t, e, n) {
  let r = al || (al = document.createRange());
  return r.setEnd(t, n ?? t.nodeValue.length), r.setStart(t, e || 0), r;
}, l0 = function() {
  al = null;
}, $n = function(t, e, n, r) {
  return n && (Tu(t, e, n, r, -1) || Tu(t, e, n, r, 1));
}, a0 = /^(img|br|input|textarea|hr)$/i;
function Tu(t, e, n, r, i) {
  for (var o; ; ) {
    if (t == n && e == r)
      return !0;
    if (e == (i < 0 ? 0 : Ee(t))) {
      let s = t.parentNode;
      if (!s || !B(s) || hi(t) || a0.test(t.nodeName) || t.contentEditable == "false")
        return !1;
      e = Se(t) + (i < 0 ? 0 : 1), t = s;
    } else if (B(t)) {
      let s = t.childNodes[e + (i < 0 ? -1 : 0)];
      if (B(s) && s.contentEditable == "false")
        if (!((o = s.pmViewDesc) === null || o === void 0) && o.ignoreForSelection)
          e += i;
        else
          return !1;
      else
        t = s, e = i < 0 ? Ee(t) : 0;
    } else
      return !1;
  }
}
function Ee(t) {
  return t.nodeType == 3 ? t.nodeValue.length : t.childNodes.length;
}
function B(t) {
  return t.nodeType == 1;
}
function ye(t) {
  return t.nodeType == 3;
}
function Vn(t, e) {
  return e ? t.contains(B(e) ? e : e.parentNode) : !1;
}
function c0(t, e) {
  for (; ; ) {
    if (ye(t) && e)
      return t;
    if (B(t) && e > 0) {
      if (t.contentEditable == "false")
        return null;
      t = t.childNodes[e - 1], e = Ee(t);
    } else if (t.parentNode && !hi(t))
      e = Se(t), t = t.parentNode;
    else
      return null;
  }
}
function u0(t, e) {
  for (; ; ) {
    if (ye(t) && e < t.nodeValue.length)
      return t;
    if (B(t) && e < t.childNodes.length) {
      if (t.contentEditable == "false")
        return null;
      t = t.childNodes[e], e = 0;
    } else if (t.parentNode && !hi(t))
      e = Se(t) + 1, t = t.parentNode;
    else
      return null;
  }
}
function h0(t, e, n) {
  for (let r = e == 0, i = e == Ee(t); r || i; ) {
    if (t == n)
      return !0;
    let o = Se(t);
    if (t = t.parentNode, !t)
      return !1;
    r = r && o == 0, i = i && o == Ee(t);
  }
}
function hi(t) {
  let e;
  for (let n = t; n && !(e = n.pmViewDesc); n = n.parentNode)
    ;
  return e && e.node && e.node.isBlock && (e.dom == t || e.contentDOM == t);
}
const Oo = function(t) {
  return t.focusNode && $n(t.focusNode, t.focusOffset, t.anchorNode, t.anchorOffset);
};
function Cn(t, e) {
  let n = document.createEvent("Event");
  return n.initEvent("keydown", !0, !0), n.keyCode = t, n.key = n.code = e, n;
}
function f0(t) {
  let e = t.activeElement;
  for (; e && e.shadowRoot; )
    e = e.shadowRoot.activeElement;
  return e;
}
function d0(t, e, n) {
  if (t.caretPositionFromPoint)
    try {
      let r = t.caretPositionFromPoint(e, n);
      if (r)
        return { node: r.offsetNode, offset: Math.min(Ee(r.offsetNode), r.offset) };
    } catch {
    }
  if (t.caretRangeFromPoint) {
    let r = t.caretRangeFromPoint(e, n);
    if (r)
      return { node: r.startContainer, offset: Math.min(Ee(r.startContainer), r.startOffset) };
  }
}
const Tt = typeof navigator < "u" ? navigator : null, Au = typeof document < "u" ? document : null, gn = Tt && Tt.userAgent || "", cl = /Edge\/(\d+)/.exec(gn), kd = /MSIE \d/.exec(gn), ul = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(gn), $e = !!(kd || ul || cl), an = kd ? document.documentMode : ul ? +ul[1] : cl ? +cl[1] : 0, et = !$e && /gecko\/(\d+)/i.test(gn);
et && +(/Firefox\/(\d+)/.exec(gn) || [0, 0])[1];
const hl = !$e && /Chrome\/(\d+)/.exec(gn), Ie = !!hl, bd = hl ? +hl[1] : 0, Oe = !$e && !!Tt && /Apple Computer/.test(Tt.vendor), ar = Oe && (/Mobile\/\w+/.test(gn) || !!Tt && Tt.maxTouchPoints > 2), it = ar || (Tt ? /Mac/.test(Tt.platform) : !1), wd = Tt ? /Win/.test(Tt.platform) : !1, $t = /Android \d/.test(gn), Do = !!Au && "webkitFontSmoothing" in Au.documentElement.style, p0 = Do ? +(/\bAppleWebKit\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1] : 0;
function m0(t) {
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
function zt(t, e) {
  return typeof t == "number" ? t : t[e];
}
function g0(t) {
  let e = t.getBoundingClientRect(), n = e.width / t.offsetWidth || 1, r = e.height / t.offsetHeight || 1;
  return {
    left: e.left,
    right: e.left + t.clientWidth * n,
    top: e.top,
    bottom: e.top + t.clientHeight * r
  };
}
function Eu(t, e, n) {
  if (!fl(e) && e.left == 0)
    return;
  let r = t.someProp("scrollThreshold") || 0, i = t.someProp("scrollMargin") || 5, o = t.dom.ownerDocument;
  for (let s = n || t.dom; s; ) {
    if (!B(s)) {
      s = lr(s);
      continue;
    }
    let l = s == o.body, a = l ? m0(o) : g0(s), c = 0, u = 0;
    if (e.top < a.top + zt(r, "top") ? u = -(a.top - e.top + zt(i, "top")) : e.bottom > a.bottom - zt(r, "bottom") && (u = e.bottom - e.top > a.bottom - a.top ? e.top + zt(i, "top") - a.top : e.bottom - a.bottom + zt(i, "bottom")), e.left < a.left + zt(r, "left") ? c = -(a.left - e.left + zt(i, "left")) : e.right > a.right - zt(r, "right") && (c = e.right - a.right + zt(i, "right")), c || u)
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
    s = h == "absolute" ? s.offsetParent : lr(s);
  }
}
function y0(t) {
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
  return { refDOM: r, refTop: i, stack: xd(t.dom) };
}
function xd(t) {
  let e = [], n = t.ownerDocument;
  for (let r = t; r && (e.push({ dom: r, top: r.scrollTop, left: r.scrollLeft }), t != n); r = lr(r))
    ;
  return e;
}
function k0({ refDOM: t, refTop: e, stack: n }) {
  let r = t ? t.getBoundingClientRect().top : 0;
  Cd(n, r == 0 ? 0 : r - e);
}
function Cd(t, e) {
  for (let n = 0; n < t.length; n++) {
    let { dom: r, top: i, left: o } = t[n];
    r.scrollTop != i + e && (r.scrollTop = i + e), r.scrollLeft != o && (r.scrollLeft = o);
  }
}
let Kn = null;
function b0(t) {
  if (t.setActive)
    return t.setActive();
  if (Kn)
    return t.focus(Kn);
  let e = xd(t);
  t.focus(Kn == null ? {
    get preventScroll() {
      return Kn = { preventScroll: !0 }, !0;
    }
  } : void 0), Kn || (Kn = !1, Cd(e, 0));
}
function Sd(t, e) {
  let n, r = 2e8, i, o = 0, s = e.top, l = e.top, a, c;
  for (let u = t.firstChild, h = 0; u; u = u.nextSibling, h++) {
    let d;
    if (B(u))
      d = u.getClientRects();
    else if (ye(u))
      d = Pt(u).getClientRects();
    else
      continue;
    for (let f = 0; f < d.length; f++) {
      let p = d[f];
      if (p.top <= s && p.bottom >= l) {
        s = Math.max(p.bottom, s), l = Math.min(p.top, l);
        let m = p.left > e.left ? p.left - e.left : p.right < e.left ? e.left - p.right : 0;
        if (m < r) {
          n = u, r = m, i = m && ye(n) ? {
            left: p.right < e.left ? p.right : p.left,
            top: e.top
          } : e, B(u) && m && (o = h + (e.left >= (p.left + p.right) / 2 ? 1 : 0));
          continue;
        }
      } else p.top > e.top && !a && p.left <= e.left && p.right >= e.left && (a = u, c = { left: Math.max(p.left, Math.min(p.right, e.left)), top: p.top });
      !n && (e.left >= p.right && e.top >= p.top || e.left >= p.left && e.top >= p.bottom) && (o = h + 1);
    }
  }
  return !n && a && (n = a, i = c, r = 0), n && ye(n) ? w0(n, i) : !n || r ? { node: t, offset: o } : Sd(n, i);
}
function w0(t, e) {
  let n = t.nodeValue.length, r = document.createRange(), i;
  for (let o = 0; o < n; o++) {
    r.setEnd(t, o + 1), r.setStart(t, o);
    let s = en(r, 1);
    if (s.top != s.bottom && la(e, s)) {
      i = { node: t, offset: o + (e.left >= (s.left + s.right) / 2 ? 1 : 0) };
      break;
    }
  }
  return r.detach(), i || { node: t, offset: 0 };
}
function la(t, e) {
  return t.left >= e.left - 1 && t.left <= e.right + 1 && t.top >= e.top - 1 && t.top <= e.bottom + 1;
}
function x0(t, e) {
  let n = t.parentNode;
  return n && /^li$/i.test(n.nodeName) && e.left < t.getBoundingClientRect().left ? n : t;
}
function C0(t, e, n) {
  let { node: r, offset: i } = Sd(e, n), o = -1;
  if (B(r) && !r.firstChild) {
    let s = r.getBoundingClientRect();
    o = s.left != s.right && n.left > (s.left + s.right) / 2 ? 1 : -1;
  }
  return t.docView.posFromDOM(r, i, o);
}
function S0(t, e, n, r) {
  let i = -1;
  for (let o = e, s = !1; o != t.dom; ) {
    let l = t.docView.nearestDesc(o, !0), a;
    if (!l)
      return null;
    if (B(l.dom) && (l.node.isBlock && l.parent || !l.contentDOM) && // Ignore elements with zero-size bounding rectangles
    ((a = l.dom.getBoundingClientRect()).width || a.height) && (l.node.isBlock && l.parent && !/^T(R|BODY|HEAD|FOOT)$/.test(l.dom.nodeName) && (!s && a.left > r.left || a.top > r.top ? i = l.posBefore : (!s && a.right < r.left || a.bottom < r.top) && (i = l.posAfter), s = !0), !l.contentDOM && i < 0 && !l.node.isText))
      return (l.node.isBlock ? r.top < (a.top + a.bottom) / 2 : r.left < (a.left + a.right) / 2) ? l.posBefore : l.posAfter;
    o = l.dom.parentNode;
  }
  return i > -1 ? i : t.docView.posFromDOM(e, n, -1);
}
function Nd(t, e, n) {
  let r = t.childNodes.length;
  if (r && n.top < n.bottom)
    for (let i = Math.max(0, Math.min(r - 1, Math.floor(r * (e.top - n.top) / (n.bottom - n.top)) - 2)), o = i; ; ) {
      let s = t.childNodes[o];
      if (B(s)) {
        let l = s.getClientRects();
        for (let a = 0; a < l.length; a++) {
          let c = l[a];
          if (la(e, c))
            return Nd(s, e, c);
        }
      }
      if ((o = (o + 1) % r) == i)
        break;
    }
  return t;
}
function N0(t, e) {
  let n = t.dom.ownerDocument, r, i = 0, o = d0(n, e.left, e.top);
  o && ({ node: r, offset: i } = o);
  let s = (t.root.elementFromPoint ? t.root : n).elementFromPoint(e.left, e.top), l;
  if (!s || !t.dom.contains(s)) {
    let c = t.dom.getBoundingClientRect();
    if (!la(e, c) || (s = Nd(t.dom, e, c), !s))
      return null;
  }
  if (Oe)
    for (let c = s; r && c; c = lr(c))
      c.draggable && (r = void 0);
  if (s = x0(s, e), r) {
    if (et && B(r) && (i = Math.min(i, r.childNodes.length), i < r.childNodes.length)) {
      let u = r.childNodes[i], h;
      u.nodeName == "IMG" && (h = u.getBoundingClientRect()).right <= e.left && h.bottom > e.top && i++;
    }
    let c;
    Do && i && B(r) && B(c = r.childNodes[i - 1]) && c.contentEditable == "false" && c.getBoundingClientRect().top >= e.top && i--, r == t.dom && i == r.childNodes.length - 1 && B(r.lastChild) && e.top > r.lastChild.getBoundingClientRect().bottom ? l = t.state.doc.content.size : (i == 0 || !B(r) || r.childNodes[i - 1].nodeName != "BR") && (l = S0(t, r, i, e));
  }
  l == null && (l = C0(t, s, e));
  let a = t.docView.nearestDesc(s, !0);
  return { pos: l, inside: a ? a.posAtStart - a.border : -1 };
}
function fl(t) {
  return t.top < t.bottom || t.left < t.right;
}
function en(t, e) {
  let n = t.getClientRects();
  if (n.length) {
    let r = n[e < 0 ? 0 : n.length - 1];
    if (fl(r))
      return r;
  }
  return Array.prototype.find.call(n, fl) || t.getBoundingClientRect();
}
const I0 = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
function Id(t, e, n) {
  let { node: r, offset: i, atom: o } = t.docView.domFromPos(e, n < 0 ? -1 : 1), s = Do || et;
  if (ye(r))
    if (s && (I0.test(r.nodeValue) || (n < 0 ? !i : i == r.nodeValue.length))) {
      let a = en(Pt(r, i, i), n);
      if (et && i && /\s/.test(r.nodeValue[i - 1]) && i < r.nodeValue.length) {
        let c = en(Pt(r, i - 1, i - 1), -1);
        if (c.top == a.top) {
          let u = en(Pt(r, i, i + 1), -1);
          if (u.top != a.top)
            return Ir(u, u.left < c.left);
        }
      }
      return a;
    } else {
      let a = i, c = i, u = n < 0 ? 1 : -1;
      return n < 0 && !i ? (c++, u = -1) : n >= 0 && i == r.nodeValue.length ? (a--, u = 1) : n < 0 ? a-- : c++, Ir(en(Pt(r, a, c), u), u < 0);
    }
  if (!t.state.doc.resolve(e - (o || 0)).parent.inlineContent) {
    if (o == null && i && (n < 0 || i == Ee(r))) {
      let a = r.childNodes[i - 1];
      if (B(a))
        return ds(a.getBoundingClientRect(), !1);
    }
    if (o == null && i < Ee(r)) {
      let a = r.childNodes[i];
      if (B(a))
        return ds(a.getBoundingClientRect(), !0);
    }
    return ds(r.getBoundingClientRect(), n >= 0);
  }
  if (o == null && i && (n < 0 || i == Ee(r))) {
    let a = r.childNodes[i - 1], c = ye(a) ? Pt(a, Ee(a) - (s ? 0 : 1)) : B(a) && (a.nodeName != "BR" || !a.nextSibling) ? a : null;
    if (c)
      return Ir(en(c, 1), !1);
  }
  if (o == null && i < Ee(r)) {
    let a = r.childNodes[i];
    for (; a.pmViewDesc && a.pmViewDesc.ignoreForCoords; )
      a = a.nextSibling;
    let c = a ? ye(a) ? Pt(a, 0, s ? 0 : 1) : B(a) ? a : null : null;
    if (c)
      return Ir(en(c, -1), !0);
  }
  return Ir(en(ye(r) ? Pt(r) : r, -n), n >= 0);
}
function Ir(t, e) {
  if (t.width == 0)
    return t;
  let n = e ? t.left : t.right;
  return { top: t.top, bottom: t.bottom, left: n, right: n };
}
function ds(t, e) {
  if (t.height == 0)
    return t;
  let n = e ? t.top : t.bottom;
  return { top: n, bottom: n, left: t.left, right: t.right };
}
function Md(t, e, n) {
  let r = t.state, i = t.root.activeElement;
  r != e && t.updateState(e), i != t.dom && t.focus();
  try {
    return n();
  } finally {
    r != e && t.updateState(r), i != t.dom && i && i.focus();
  }
}
function M0(t, e, n) {
  let r = e.selection, i = n == "up" ? r.$from : r.$to;
  return Md(t, e, () => {
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
    let s = Id(t, i.pos, 1);
    for (let l = o.firstChild; l; l = l.nextSibling) {
      let a;
      if (B(l))
        a = l.getClientRects();
      else if (ye(l))
        a = Pt(l, 0, l.nodeValue.length).getClientRects();
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
const T0 = /[\u0590-\u08ac]/;
function A0(t, e, n) {
  let { $head: r } = e.selection;
  if (!r.parent.isTextblock)
    return !1;
  let i = r.parentOffset, o = !i, s = i == r.parent.content.size, l = t.domSelection();
  return l ? !T0.test(r.parent.textContent) || !l.modify ? n == "left" || n == "backward" ? o : s : Md(t, e, () => {
    let { focusNode: a, focusOffset: c, anchorNode: u, anchorOffset: h } = t.domSelectionRange(), d = l.caretBidiLevel;
    l.modify("move", n, "character");
    let f = r.depth ? t.docView.domAfterPos(r.before()) : t.dom, { focusNode: p, focusOffset: m } = t.domSelectionRange(), y = p && !Vn(f, p) || a == p && c == m;
    try {
      l.collapse(u, h), a && (a != u || c != h) && l.extend && l.extend(a, c);
    } catch {
    }
    return d != null && (l.caretBidiLevel = d), y;
  }) : r.pos == r.start() || r.pos == r.end();
}
let vu = null, Ou = null, Du = !1;
function E0(t, e, n) {
  return vu == e && Ou == n ? Du : (vu = e, Ou = n, Du = n == "up" || n == "down" ? M0(t, e, n) : A0(t, e, n));
}
const at = 0, Ru = 1, An = 2, bt = 3;
class fi {
  constructor(e, n, r, i) {
    this.parent = e, this.children = n, this.dom = r, this.contentDOM = i, this.dirty = at, r.pmViewDesc = this;
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
    if (this.contentDOM && Vn(this.contentDOM, e))
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
      i = n > Se(this.contentDOM);
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
        if (r && (s = o.nodeDOM) && !(B(s) ? Vn(s, e) : s == e))
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
      if (o.size || !(o instanceof Ad || o instanceof Td && o.side >= 0))
        break;
    }
    if (n <= 0) {
      let o, s = !0;
      for (; o = r ? this.children[r - 1] : null, !(!o || o.dom.parentNode == this.contentDOM); r--, s = !1)
        ;
      return o && n && s && !o.border && !o.domAtom ? o.domFromPos(o.size, n) : { node: this.contentDOM, offset: o ? Se(o.dom) + 1 : 0 };
    } else {
      let o, s = !0;
      for (; o = r < this.children.length ? this.children[r] : null, !(!o || o.dom.parentNode == this.contentDOM); r++, s = !1)
        ;
      return o && s && !o.border && !o.domAtom ? o.domFromPos(0, n) : { node: this.contentDOM, offset: o ? Se(o.dom) : this.contentDOM.childNodes.length };
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
            i = Se(d.dom) + 1;
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
            o = Se(h.dom);
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
    if (!B(n) || r == n.childNodes.length)
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
    if ((et || Oe) && e == n) {
      let { node: f, offset: p } = l;
      if (ye(f)) {
        if (h = !!(p && f.nodeValue[p - 1] == `
`), h && p == f.nodeValue.length)
          for (let m = f, y; m; m = m.parentNode) {
            if (y = m.nextSibling) {
              y.nodeName == "BR" && (l = a = { node: y.parentNode, offset: Se(y) + 1 });
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
    if (et && u.focusNode && u.focusNode != a.node && B(u.focusNode)) {
      let f = u.focusNode.childNodes[u.focusOffset];
      f && f.contentEditable == "false" && (i = !0);
    }
    if (!(i || h && Oe) && $n(l.node, l.offset, u.anchorNode, u.anchorOffset) && $n(a.node, a.offset, u.focusNode, u.focusOffset))
      return;
    let d = !1;
    if ((c.extend || e == n) && !(h && et)) {
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
          this.dirty = e == r || n == s ? An : Ru, e == l && n == a && (o.contentLost || o.dom.parentNode != this.contentDOM) ? o.dirty = bt : o.markDirty(e - l, n - l);
          return;
        } else
          o.dirty = o.dom == o.contentDOM && o.dom.parentNode == this.contentDOM && !o.children.length ? An : bt;
      }
      r = s;
    }
    this.dirty = An;
  }
  markParentsDirty() {
    let e = 1;
    for (let n = this.parent; n; n = n.parent, e++) {
      let r = e == 1 ? An : Ru;
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
class Td extends fi {
  constructor(e, n, r, i) {
    let o, s = n.type.toDOM;
    if (typeof s == "function" && (s = s(r, () => {
      if (!o)
        return i;
      if (o.parent)
        return o.parent.posBeforeChild(o);
    })), !n.type.spec.raw) {
      let l = B(s) ? s : document.createElement("span");
      l != s && l.appendChild(s), l.hasAttribute("contenteditable") || (l.contentEditable = "false"), l.classList.add("ProseMirror-widget");
    }
    super(e, [], s, null), this.widget = n, this.widget = n, o = this;
  }
  matchesWidget(e) {
    return this.dirty == at && e.type.eq(this.widget.type);
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
class v0 extends fi {
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
class cn extends fi {
  constructor(e, n, r, i, o) {
    super(e, [], r, i), this.mark = n, this.spec = o;
  }
  static create(e, n, r, i) {
    let o = i.nodeViews[n.type.name], s = o && o(n, i, r);
    return (!s || !s.dom) && (s = dr.renderSpec(document, n.type.spec.toDOM(n, r), null, n.attrs)), new cn(e, n, s.dom, s.contentDOM || s.dom, s);
  }
  parseRule() {
    return this.dirty & bt || this.mark.type.spec.reparseInView ? null : { mark: this.mark.type.name, attrs: this.mark.attrs, contentElement: this.contentDOM };
  }
  matchesMark(e) {
    return this.dirty != bt && this.mark.eq(e);
  }
  markDirty(e, n) {
    if (super.markDirty(e, n), this.dirty != at) {
      let r = this.parent;
      for (; !r.node; )
        r = r.parent;
      r.dirty < this.dirty && (r.dirty = this.dirty), this.dirty = at;
    }
  }
  slice(e, n, r) {
    let i = cn.create(this.parent, this.mark, !0, r), o = this.children, s = this.size;
    n < s && (o = pl(o, n, s, r)), e > 0 && (o = pl(o, 0, e, r));
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
class un extends fi {
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
      else if (!ye(u))
        throw new RangeError("Text must be rendered as a DOM text node");
    } else u || ({ dom: u, contentDOM: h } = dr.renderSpec(document, n.type.spec.toDOM(n), null, n.attrs));
    !h && !n.isText && u.nodeName != "BR" && (u.hasAttribute("contenteditable") || (u.contentEditable = "false"), n.type.spec.draggable && (u.draggable = !0));
    let d = u;
    return u = Od(u, r, n), c ? a = new O0(e, n, r, i, u, h || null, d, c) : n.isText ? new Ro(e, n, r, i, u, d) : new un(e, n, r, i, u, h || null, d);
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
        let r = e && e.find((i) => B(i) && e.indexOf(i.parentNode) < 0 && this.dom.contains(i));
        r ? n.contentElement = r : n.getContent = () => M.empty;
      }
    }
    return n;
  }
  matchesNode(e, n, r) {
    return this.dirty == at && e.eq(this.node) && co(n, this.outerDeco) && r.eq(this.innerDeco);
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
    let r = this.node.inlineContent, i = n, o = e.composing ? this.localCompositionInfo(e, n) : null, s = o && o.pos > -1 ? o : null, l = o && o.pos < 0, a = new R0(this, s && s.node, e), c = this.node.inlineContent, u = c && this.node.isBlock;
    P0(this.node, this.innerDeco, (h, d, f) => {
      h.spec.marks ? a.syncToMarks(h.spec.marks, r, e, d) : h.type.side >= 0 && !f && a.syncToMarks(d == this.node.childCount ? Q.none : this.node.child(d).marks, r, e, d), a.placeWidget(h, e, i);
    }, (h, d, f, p) => {
      a.syncToMarks(h.marks, r, e, p), u && h.isAtom && !h.isText && a.addHackNode("IMG", a.top);
      let m;
      a.findNodeMatch(h, d, f, p) || l && e.state.selection.from > i && e.state.selection.to < i + h.nodeSize && (m = a.findIndexWithChild(o.node)) > -1 && a.updateNodeAt(h, d, f, m, e) || a.updateNextNode(h, d, f, e, p, i) || a.addNode(h, d, f, e, i), i += h.nodeSize, c && (u = h.isAtom && !h.isText);
    }), a.syncToMarks([], r, e, 0), this.node.isTextblock && a.addTextblockHacks(), a.destroyRest(), (a.changed || this.dirty == An) && (s && this.protectLocalComposition(e, s), Ed(this.contentDOM, this.children, e), ar && B0(this.dom));
  }
  localCompositionInfo(e, n) {
    let { from: r, to: i } = e.state.selection;
    if (!(e.state.selection instanceof K) || r < n || i > n + this.node.content.size)
      return null;
    let o = e.input.compositionNode;
    if (!o || !this.dom.contains(o.parentNode))
      return null;
    if (this.node.inlineContent) {
      let s = o.nodeValue, l = _0(this.node.content, s, r - n, i - n);
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
    let s = new v0(this, o, n, i);
    e.input.compositionNodes.push(s), this.children = pl(this.children, r, r + i.length, e, s);
  }
  // If this desc must be updated to match the given node decoration,
  // do so and return true.
  update(e, n, r, i) {
    return this.dirty == bt || !e.sameMarkup(this.node) ? !1 : (this.updateInner(e, n, r, i), !0);
  }
  updateInner(e, n, r, i) {
    this.updateOuterDeco(n), this.node = e, this.innerDeco = r, this.contentDOM && this.updateChildren(i, this.posAtStart), this.dirty = at;
  }
  updateOuterDeco(e) {
    if (co(e, this.outerDeco))
      return;
    let n = !B(this.nodeDOM), r = this.dom;
    this.dom = vd(this.dom, this.nodeDOM, dl(this.outerDeco, this.node, n), dl(e, this.node, n)), this.dom != r && (r.pmViewDesc = void 0, this.dom.pmViewDesc = this), this.outerDeco = e;
  }
  // Mark this node as being the selected node.
  selectNode() {
    B(this.nodeDOM) && (this.nodeDOM.classList.add("ProseMirror-selectednode"), (this.contentDOM || !this.node.type.spec.draggable) && (this.nodeDOM.draggable = !0));
  }
  // Remove selected node marking from this node.
  deselectNode() {
    B(this.nodeDOM) && (this.nodeDOM.classList.remove("ProseMirror-selectednode"), (this.contentDOM || !this.node.type.spec.draggable) && this.nodeDOM.removeAttribute("draggable"));
  }
  get domAtom() {
    return this.node.isAtom;
  }
}
function zu(t, e, n, r, i) {
  Od(r, e, t);
  let o = new un(void 0, t, e, n, r, r, r);
  return o.contentDOM && o.updateChildren(i, 0), o;
}
class Ro extends un {
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
    return this.dirty == bt || this.dirty != at && !this.inParent() || !e.sameMarkup(this.node) ? !1 : (this.updateOuterDeco(n), (this.dirty != at || e.text != this.node.text) && e.text != this.nodeDOM.nodeValue && (this.nodeDOM.nodeValue = e.text, i.trackWrites == this.nodeDOM && (i.trackWrites = null)), this.node = e, this.dirty = at, !0);
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
    return new Ro(this.parent, i, this.outerDeco, this.innerDeco, o, o);
  }
  markDirty(e, n) {
    super.markDirty(e, n), this.dom != this.nodeDOM && (e == 0 || n == this.nodeDOM.nodeValue.length) && (this.dirty = bt);
  }
  get domAtom() {
    return !1;
  }
  isText(e) {
    return this.node.text == e;
  }
}
class Ad extends fi {
  parseRule() {
    return { ignore: !0 };
  }
  matchesHack(e) {
    return this.dirty == at && this.dom.nodeName == e;
  }
  get domAtom() {
    return !0;
  }
  get ignoreForCoords() {
    return this.dom.nodeName == "IMG";
  }
}
class O0 extends un {
  constructor(e, n, r, i, o, s, l, a) {
    super(e, n, r, i, o, s, l), this.spec = a;
  }
  // A custom `update` method gets to decide whether the update goes
  // through. If it does, and there's a `contentDOM` node, our logic
  // updates the children.
  update(e, n, r, i) {
    if (this.dirty == bt)
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
function Ed(t, e, n) {
  let r = t.firstChild, i = !1;
  for (let o = 0; o < e.length; o++) {
    let s = e[o], l = s.dom;
    if (l.parentNode == t) {
      for (; l != r; )
        r = Lu(r), i = !0;
      r = r.nextSibling;
    } else
      i = !0, t.insertBefore(l, r);
    if (s instanceof cn) {
      let a = r ? r.previousSibling : t.lastChild;
      Ed(s.contentDOM, s.children, n), r = a ? a.nextSibling : t.firstChild;
    }
  }
  for (; r; )
    r = Lu(r), i = !0;
  i && n.trackWrites == t && (n.trackWrites = null);
}
const Vr = function(t) {
  t && (this.nodeName = t);
};
Vr.prototype = /* @__PURE__ */ Object.create(null);
const En = [new Vr()];
function dl(t, e, n) {
  if (t.length == 0)
    return En;
  let r = n ? En[0] : new Vr(), i = [r];
  for (let o = 0; o < t.length; o++) {
    let s = t[o].type.attrs;
    if (s) {
      s.nodeName && i.push(r = new Vr(s.nodeName));
      for (let l in s) {
        let a = s[l];
        a != null && (n && i.length == 1 && i.push(r = new Vr(e.isInline ? "span" : "div")), l == "class" ? r.class = (r.class ? r.class + " " : "") + a : l == "style" ? r.style = (r.style ? r.style + ";" : "") + a : l != "nodeName" && (r[l] = a));
      }
    }
  }
  return i;
}
function vd(t, e, n, r) {
  if (n == En && r == En)
    return e;
  let i = e;
  for (let o = 0; o < r.length; o++) {
    let s = r[o], l = n[o];
    if (o) {
      let a;
      l && l.nodeName == s.nodeName && i != t && (a = i.parentNode) && a.nodeName.toLowerCase() == s.nodeName || (a = document.createElement(s.nodeName), a.pmIsDeco = !0, a.appendChild(i), l = En[0]), i = a;
    }
    D0(i, l || En[0], s);
  }
  return i;
}
function D0(t, e, n) {
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
function Od(t, e, n) {
  return vd(t, t, En, dl(e, n, !B(t)));
}
function co(t, e) {
  if (t.length != e.length)
    return !1;
  for (let n = 0; n < t.length; n++)
    if (!t[n].type.eq(e[n].type))
      return !1;
  return !0;
}
function Lu(t) {
  let e = t.nextSibling;
  return t.parentNode.removeChild(t), e;
}
class R0 {
  constructor(e, n, r) {
    this.lock = n, this.view = r, this.index = 0, this.stack = [], this.changed = !1, this.top = e, this.preMatch = z0(e.node.content, e);
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
      this.destroyRest(), this.top.dirty = at, this.index = this.stack.pop(), this.top = this.stack.pop(), s--;
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
        u instanceof cn && u.dirty != bt && u.mark.type == e[s].type && u.spec.update && !this.isLocked(u.dom) && u.spec.update(e[s]) && (u.mark = e[s], a = this.index, this.changed = !0);
      }
      if (a > -1)
        a > this.index && (this.changed = !0, this.destroyBetween(this.index, a)), this.top = this.top.children[this.index];
      else {
        let u = cn.create(this.top, e[s], n, r);
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
    return s.dirty == bt && s.dom == s.contentDOM && (s.dirty = An), s.update(e, n, r, o) ? (this.destroyBetween(this.index, i), this.index++, !0) : !1;
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
      if (a instanceof un) {
        let c = this.preMatch.matched.get(a);
        if (c != null && c != o)
          return !1;
        let u = a.dom, h, d = this.isLocked(u) && !(e.isText && a.node && a.node.isText && a.nodeDOM.nodeValue == e.text && a.dirty != bt && co(n, a.outerDeco));
        if (!d && a.update(e, n, r, i))
          return this.destroyBetween(this.index, l), a.dom != u && (this.changed = !0), this.index++, !0;
        if (!d && (h = this.recreateWrapper(a, e, n, r, i, s)))
          return this.destroyBetween(this.index, l), this.top.children[this.index] = h, h.contentDOM && (h.dirty = An, h.updateChildren(i, s + 1), h.dirty = at), this.changed = !0, this.index++, !0;
        break;
      }
    }
    return !1;
  }
  // When a node with content is replaced by a different node with
  // identical content, move over its children.
  recreateWrapper(e, n, r, i, o, s) {
    if (e.dirty || n.isAtom || !e.children.length || !e.node.content.eq(n.content) || !co(r, e.outerDeco) || !i.eq(e.innerDeco))
      return null;
    let l = un.create(this.top, n, r, i, o, s);
    if (l.contentDOM) {
      l.children = e.children, e.children = [];
      for (let a of l.children)
        a.parent = l;
    }
    return e.destroy(), l;
  }
  // Insert the node as a newly created node desc.
  addNode(e, n, r, i, o) {
    let s = un.create(this.top, e, n, r, i, o);
    s.contentDOM && s.updateChildren(i, o + 1), this.top.children.splice(this.index++, 0, s), this.changed = !0;
  }
  placeWidget(e, n, r) {
    let i = this.index < this.top.children.length ? this.top.children[this.index] : null;
    if (i && i.matchesWidget(e) && (e == i.widget || !i.widget.type.toDOM.parentNode))
      this.index++;
    else {
      let o = new Td(this.top, e, n, r);
      this.top.children.splice(this.index++, 0, o), this.changed = !0;
    }
  }
  // Make sure a textblock looks and behaves correctly in
  // contentEditable.
  addTextblockHacks() {
    let e = this.top.children[this.index - 1], n = this.top;
    for (; e instanceof cn; )
      n = e, e = n.children[n.children.length - 1];
    (!e || // Empty textblock
    !(e instanceof Ro) || /\n$/.test(e.node.text) || this.view.requiresGeckoHackNode && /\s$/.test(e.node.text)) && ((Oe || Ie) && e && e.dom.contentEditable == "false" && this.addHackNode("IMG", n), this.addHackNode("BR", this.top));
  }
  addHackNode(e, n) {
    if (n == this.top && this.index < n.children.length && n.children[this.index].matchesHack(e))
      this.index++;
    else {
      let r = document.createElement(e);
      e == "IMG" && (r.className = "ProseMirror-separator", r.alt = ""), e == "BR" && (r.className = "ProseMirror-trailingBreak");
      let i = new Ad(this.top, [], r, null);
      n != this.top ? n.children.push(i) : n.children.splice(this.index++, 0, i), this.changed = !0;
    }
  }
  isLocked(e) {
    return this.lock && (e == this.lock || B(e) && e.contains(this.lock.parentNode));
  }
}
function z0(t, e) {
  let n = e, r = n.children.length, i = t.childCount, o = /* @__PURE__ */ new Map(), s = [];
  e: for (; i > 0; ) {
    let l;
    for (; ; )
      if (r) {
        let c = n.children[r - 1];
        if (c instanceof cn)
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
function L0(t, e) {
  return t.type.side - e.type.side;
}
function P0(t, e, n, r) {
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
        h.sort(L0);
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
function B0(t) {
  if (t.nodeName == "UL" || t.nodeName == "OL") {
    let e = t.style.cssText;
    t.style.cssText = e + "; list-style: square !important", window.getComputedStyle(t).listStyle, t.style.cssText = e;
  }
}
function _0(t, e, n, r) {
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
function pl(t, e, n, r, i) {
  let o = [];
  for (let s = 0, l = 0; s < t.length; s++) {
    let a = t[s], c = l, u = l += a.size;
    c >= n || u <= e ? o.push(a) : (c < e && o.push(a.slice(0, e - c, r)), i && (o.push(i), i = void 0), u > n && o.push(a.slice(n - c, a.size, r)));
  }
  return o;
}
function aa(t, e = null) {
  let n = t.domSelectionRange(), r = t.state.doc;
  if (!n.focusNode)
    return null;
  let i = t.docView.nearestDesc(n.focusNode), o = i && i.size == 0, s = t.docView.posFromDOM(n.focusNode, n.focusOffset, 1);
  if (s < 0)
    return null;
  let l = r.resolve(s), a, c;
  if (Oo(n)) {
    for (a = s; i && !i.node; )
      i = i.parent;
    if (i && i.node.isAtom && q.isSelectable(i.node) && i.parent && !(i.node.isInline && h0(n.focusNode, n.focusOffset, i.dom))) {
      let h = i.posBefore;
      c = new q(s == h ? l : r.resolve(h));
    } else if (et && e == "key" && s > t.state.selection.to && B(n.focusNode) && n.focusOffset == n.focusNode.childNodes.length && i && i.posAtStart > t.state.selection.to)
      for (let h = n.focusNode; ; h = h.parentNode) {
        if (getComputedStyle(h).overflow != "visible") {
          c = W.findFrom(r.resolve(i.posAtStart), 1);
          break;
        }
        if (h == i.dom || h.nextSibling || !h.parentNode || !B(h.parentNode))
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
    c = ca(t, u, l, h);
  }
  return c;
}
function Dd(t) {
  return t.editable ? t.hasFocus() : zd(t) && document.activeElement && document.activeElement.contains(t.dom);
}
function Ht(t, e = !1) {
  let n = t.state.selection;
  if (Rd(t, n), !Dd(t))
    return;
  let r = t.input.mouseDown;
  if (!e && Ie && r) {
    let i = t.domSelectionRange(), o = t.domObserver.currentSelection;
    if (i.anchorNode && o.anchorNode && $n(i.anchorNode, i.anchorOffset, o.anchorNode, o.anchorOffset) && r.delaySelUpdate()) {
      t.domObserver.setCurSelection();
      return;
    }
  }
  if (t.domObserver.disconnectSelection(), t.cursorWrapper)
    $0(t);
  else {
    let { anchor: i, head: o } = n, s, l;
    Pu && !(n instanceof K) && (n.$from.parent.inlineContent || (s = Bu(t, n.from)), !n.empty && !n.$from.parent.inlineContent && (l = Bu(t, n.to))), t.docView.setSelection(i, o, t, e), Pu && (s && _u(s), l && _u(l)), n.visible ? t.dom.classList.remove("ProseMirror-hideselection") : (t.dom.classList.add("ProseMirror-hideselection"), "onselectionchange" in document && F0(t));
  }
  t.domObserver.setCurSelection(), t.domObserver.connectSelection();
}
const Pu = Oe || Ie && bd < 63;
function Bu(t, e) {
  let { node: n, offset: r } = t.docView.domFromPos(e, 0), i = r < n.childNodes.length ? n.childNodes[r] : null, o = r ? n.childNodes[r - 1] : null;
  if (Oe && i && i.contentEditable == "false")
    return ps(i);
  if ((!i || i.contentEditable == "false") && (!o || o.contentEditable == "false")) {
    if (i)
      return ps(i);
    if (o)
      return ps(o);
  }
}
function ps(t) {
  return t.contentEditable = "true", Oe && t.draggable && (t.draggable = !1, t.wasDraggable = !0), t;
}
function _u(t) {
  t.contentEditable = "false", t.wasDraggable && (t.draggable = !0, t.wasDraggable = null);
}
function F0(t) {
  let e = t.dom.ownerDocument;
  e.removeEventListener("selectionchange", t.input.hideSelectionGuard);
  let n = t.domSelectionRange(), r = n.anchorNode, i = n.anchorOffset;
  e.addEventListener("selectionchange", t.input.hideSelectionGuard = () => {
    (n.anchorNode != r || n.anchorOffset != i) && (e.removeEventListener("selectionchange", t.input.hideSelectionGuard), setTimeout(() => {
      (!Dd(t) || t.state.selection.visible) && t.dom.classList.remove("ProseMirror-hideselection");
    }, 20));
  });
}
function $0(t) {
  let e = t.domSelection();
  if (!e)
    return;
  let n = t.cursorWrapper.dom, r = n.nodeName == "IMG";
  r ? e.collapse(n.parentNode, Se(n) + 1) : e.collapse(n, 0), !r && !t.state.selection.visible && $e && an <= 11 && (n.disabled = !0, n.disabled = !1);
}
function Rd(t, e) {
  if (e instanceof q) {
    let n = t.docView.descAt(e.from);
    n != t.lastSelectedViewDesc && (Fu(t), n && n.selectNode(), t.lastSelectedViewDesc = n);
  } else
    Fu(t);
}
function Fu(t) {
  t.lastSelectedViewDesc && (t.lastSelectedViewDesc.parent && t.lastSelectedViewDesc.deselectNode(), t.lastSelectedViewDesc = void 0);
}
function ca(t, e, n, r) {
  return t.someProp("createSelectionBetween", (i) => i(t, e, n)) || K.between(e, n, r);
}
function $u(t) {
  return t.editable && !t.hasFocus() ? !1 : zd(t);
}
function zd(t) {
  let e = t.domSelectionRange();
  if (!e.anchorNode)
    return !1;
  try {
    return Vn(t.dom, e.anchorNode) && (t.editable || Vn(t.dom, e.focusNode));
  } catch {
    return !1;
  }
}
function V0(t) {
  let e = t.docView.domFromPos(t.state.selection.anchor, 0), n = t.domSelectionRange();
  return $n(e.node, e.offset, n.anchorNode, n.anchorOffset);
}
function ml(t, e) {
  let { $anchor: n, $head: r } = t.selection, i = e > 0 ? n.max(r) : n.min(r), o = i.parent.inlineContent ? i.depth ? t.doc.resolve(e > 0 ? i.after() : i.before()) : null : i;
  return o && W.findFrom(o, e);
}
function tn(t, e) {
  return t.dispatch(t.state.tr.setSelection(e).scrollIntoView()), !0;
}
function Vu(t, e, n) {
  let r = t.state.selection;
  if (r instanceof K)
    if (n.indexOf("s") > -1) {
      let { $head: i } = r, o = i.textOffset ? null : e < 0 ? i.nodeBefore : i.nodeAfter;
      if (!o || o.isText || !o.isLeaf)
        return !1;
      let s = t.state.doc.resolve(i.pos + o.nodeSize * (e < 0 ? -1 : 1));
      return tn(t, new K(r.$anchor, s));
    } else if (r.empty) {
      if (t.endOfTextblock(e > 0 ? "forward" : "backward")) {
        let i = ml(t.state, e);
        return i && i instanceof q ? tn(t, i) : !1;
      } else if (!(it && n.indexOf("m") > -1)) {
        let i = r.$head, o = i.textOffset ? null : e < 0 ? i.nodeBefore : i.nodeAfter, s;
        if (!o || o.isText)
          return !1;
        let l = e < 0 ? i.pos - o.nodeSize : i.pos;
        return o.isAtom || (s = t.docView.descAt(l)) && !s.contentDOM ? q.isSelectable(o) ? tn(t, new q(e < 0 ? t.state.doc.resolve(i.pos - o.nodeSize) : i)) : tn(t, new K(t.state.doc.resolve(e < 0 ? l : l + o.nodeSize))) : !1;
      }
    } else return !1;
  else {
    if (r instanceof q && r.node.isInline)
      return tn(t, new K(e > 0 ? r.$to : r.$from));
    {
      let i = ml(t.state, e);
      return i ? tn(t, i) : !1;
    }
  }
}
function Hr(t, e) {
  let n = t.pmViewDesc;
  return n ? n.size == 0 && (e < 0 || t.nextSibling || t.nodeName != "BR") : B(t) && t.contentEditable == "false";
}
function Un(t, e) {
  return e < 0 ? H0(t) : j0(t);
}
function H0(t) {
  let e = t.domSelectionRange(), n = e.focusNode, r = e.focusOffset;
  if (!n)
    return;
  let i, o, s = !1;
  for (et && B(n) && r < Ee(n) && Hr(n.childNodes[r], -1) && (s = !0); ; )
    if (r > 0) {
      if (!B(n))
        break;
      let l = n.childNodes[r - 1];
      if (Hr(l, -1))
        i = n, o = --r;
      else if (ye(l))
        n = l, r = n.nodeValue.length;
      else
        break;
    } else {
      if (Ld(n))
        break;
      {
        let l = n.previousSibling;
        for (; l && Hr(l, -1); )
          i = n.parentNode, o = Se(l), l = l.previousSibling;
        if (l)
          n = l, r = Ee(n);
        else {
          if (n = n.parentNode, n == t.dom)
            break;
          r = 0;
        }
      }
    }
  s ? gl(t, n, r) : i && gl(t, i, o);
}
function j0(t) {
  let e = t.domSelectionRange(), n = e.focusNode, r = e.focusOffset;
  if (!n)
    return;
  let i = Ee(n), o, s;
  for (; ; )
    if (r < i) {
      if (!B(n))
        break;
      let l = n.childNodes[r];
      if (Hr(l, 1))
        o = n, s = ++r;
      else
        break;
    } else {
      if (Ld(n))
        break;
      {
        let l = n.nextSibling;
        for (; l && Hr(l, 1); )
          o = l.parentNode, s = Se(l) + 1, l = l.nextSibling;
        if (l)
          n = l, r = 0, i = Ee(n);
        else {
          if (n = n.parentNode, n == t.dom)
            break;
          r = i = 0;
        }
      }
    }
  o && gl(t, o, s);
}
function Ld(t) {
  let e = t.pmViewDesc;
  return e && e.node && e.node.isBlock;
}
function q0(t, e) {
  for (; t && e == t.childNodes.length && !hi(t); )
    e = Se(t) + 1, t = t.parentNode;
  for (; t && e < t.childNodes.length; ) {
    let n = t.childNodes[e];
    if (ye(n))
      return n;
    if (B(n) && n.contentEditable == "false")
      break;
    t = n, e = 0;
  }
}
function W0(t, e) {
  for (; t && !e && !hi(t); )
    e = Se(t), t = t.parentNode;
  for (; t && e; ) {
    let n = t.childNodes[e - 1];
    if (ye(n))
      return n;
    if (B(n) && n.contentEditable == "false")
      break;
    t = n, e = t.childNodes.length;
  }
}
function gl(t, e, n) {
  if (!ye(e)) {
    let o, s;
    (s = q0(e, n)) ? (e = s, n = 0) : (o = W0(e, n)) && (e = o, n = o.nodeValue.length);
  }
  let r = t.domSelection();
  if (!r)
    return;
  if (Oo(r)) {
    let o = document.createRange();
    o.setEnd(e, n), o.setStart(e, n), r.removeAllRanges(), r.addRange(o);
  } else r.extend && r.extend(e, n);
  t.domObserver.setCurSelection();
  let { state: i } = t;
  setTimeout(() => {
    t.state == i && Ht(t);
  }, 50);
}
function Hu(t, e) {
  let n = t.state.doc.resolve(e);
  if (!(Ie || wd) && n.parent.inlineContent) {
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
function ju(t, e, n) {
  let r = t.state.selection;
  if (r instanceof K && !r.empty || n.indexOf("s") > -1 || it && n.indexOf("m") > -1)
    return !1;
  let { $from: i, $to: o } = r;
  if (!i.parent.inlineContent || t.endOfTextblock(e < 0 ? "up" : "down")) {
    let s = ml(t.state, e);
    if (s && s instanceof q)
      return tn(t, s);
  }
  if (!i.parent.inlineContent) {
    let s = e < 0 ? i : o, l = r instanceof Ze ? W.near(s, e) : W.findFrom(s, e);
    return l ? tn(t, l) : !1;
  }
  return !1;
}
function qu(t, e) {
  if (!(t.state.selection instanceof K))
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
function Wu(t, e, n) {
  t.domObserver.stop(), e.contentEditable = n, t.domObserver.start();
}
function K0(t) {
  if (!Oe || t.state.selection.$head.parentOffset > 0)
    return !1;
  let { focusNode: e, focusOffset: n } = t.domSelectionRange();
  if (e && B(e) && n == 0 && e.firstChild && B(e.firstChild) && e.firstChild.contentEditable == "false") {
    let r = e.firstChild;
    Wu(t, r, "true"), setTimeout(() => Wu(t, r, "false"), 20);
  }
  return !1;
}
function U0(t) {
  let e = "";
  return t.ctrlKey && (e += "c"), t.metaKey && (e += "m"), t.altKey && (e += "a"), t.shiftKey && (e += "s"), e;
}
function J0(t, e) {
  let n = e.keyCode, r = U0(e);
  if (n == 8 || it && n == 72 && r == "c")
    return qu(t, -1) || Un(t, -1);
  if (n == 46 && !e.shiftKey || it && n == 68 && r == "c")
    return qu(t, 1) || Un(t, 1);
  if (n == 13 || n == 27)
    return !0;
  if (n == 37 || it && n == 66 && r == "c") {
    let i = n == 37 ? Hu(t, t.state.selection.from) == "ltr" ? -1 : 1 : -1;
    return Vu(t, i, r) || Un(t, i);
  } else if (n == 39 || it && n == 70 && r == "c") {
    let i = n == 39 ? Hu(t, t.state.selection.from) == "ltr" ? 1 : -1 : 1;
    return Vu(t, i, r) || Un(t, i);
  } else {
    if (n == 38 || it && n == 80 && r == "c")
      return ju(t, -1, r) || Un(t, -1);
    if (n == 40 || it && n == 78 && r == "c")
      return K0(t) || ju(t, 1, r) || Un(t, 1);
    if (r == (it ? "m" : "c") && (n == 66 || n == 73 || n == 89 || n == 90))
      return !0;
  }
  return !1;
}
function ua(t, e) {
  t.someProp("transformCopied", (f) => {
    e = f(e, t);
  });
  let n = [], { content: r, openStart: i, openEnd: o } = e;
  for (; i > 1 && o > 1 && r.childCount == 1 && r.firstChild.childCount == 1; ) {
    i--, o--;
    let f = r.firstChild;
    n.push(f.type.name, f.attrs != f.type.defaultAttrs ? f.attrs : null), r = f.content;
  }
  let s = t.someProp("clipboardSerializer") || dr.fromSchema(t.state.schema), l = Vd(), a = l.createElement("div");
  a.appendChild(s.serializeFragment(r, { document: l }));
  let c = a.firstChild, u, h = 0;
  for (; c && B(c) && (u = $d[c.nodeName.toLowerCase()]); ) {
    for (let f = u.length - 1; f >= 0; f--) {
      let p = l.createElement(u[f]);
      for (; a.firstChild; )
        p.appendChild(a.firstChild);
      a.appendChild(p), h++;
    }
    c = a.firstChild;
  }
  c && B(c) && c.setAttribute("data-pm-slice", `${i} ${o}${h ? ` -${h}` : ""} ${JSON.stringify(n)}`);
  let d = t.someProp("clipboardTextSerializer", (f) => f(e, t)) || e.content.textBetween(0, e.content.size, `

`);
  return { dom: a, text: d, slice: e };
}
function Pd(t, e, n, r, i) {
  let o = i.parent.type.spec.code, s, l;
  if (!n && !e)
    return null;
  let a = !!e && (r || o || !n);
  if (a) {
    if (t.someProp("transformPastedText", (d) => {
      e = d(e, o || r, t);
    }), o)
      return l = new v(M.from(t.state.schema.text(e.replace(/\r\n?/g, `
`))), 0, 0), t.someProp("transformPasted", (d) => {
        l = d(l, t, !0);
      }), l;
    let h = t.someProp("clipboardTextParser", (d) => d(e, i, r, t));
    if (h)
      l = h;
    else {
      let d = i.marks(), { schema: f } = t.state, p = dr.fromSchema(f);
      s = document.createElement("div"), e.split(/(?:\r\n?|\n)+/).forEach((m) => {
        let y = s.appendChild(document.createElement("p"));
        m && y.appendChild(p.serializeNode(f.text(m, d)));
      });
    }
  } else
    t.someProp("transformPastedHTML", (h) => {
      n = h(n, t);
    }), s = Q0(n), Do && Z0(s);
  let c = s && s.querySelector("[data-pm-slice]"), u = c && /^(\d+) (\d+)(?: -(\d+))? (.*)/.exec(c.getAttribute("data-pm-slice") || "");
  if (u && u[3])
    for (let h = +u[3]; h > 0; h--) {
      let d = s.firstChild;
      for (; d && !B(d); )
        d = d.nextSibling;
      if (!d)
        break;
      s = d;
    }
  if (l || (l = (t.someProp("clipboardParser") || t.someProp("domParser") || ir.fromSchema(t.state.schema)).parseSlice(s, {
    preserveWhitespace: !!(a || u),
    context: i,
    ruleFromNode(d) {
      return d.nodeName == "BR" && !d.nextSibling && d.parentNode && !G0.test(d.parentNode.nodeName) ? { ignore: !0 } : null;
    }
  })), u)
    l = ex(Ku(l, +u[1], +u[2]), u[4]);
  else if (l = v.maxOpen(Y0(l.content, i), !0), l.openStart || l.openEnd) {
    let h = 0, d = 0;
    for (let f = l.content.firstChild; h < l.openStart && !f.type.spec.isolating; h++, f = f.firstChild)
      ;
    for (let f = l.content.lastChild; d < l.openEnd && !f.type.spec.isolating; d++, f = f.lastChild)
      ;
    l = Ku(l, h, d);
  }
  return t.someProp("transformPasted", (h) => {
    l = h(l, t, a);
  }), l;
}
const G0 = /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var)$/i;
function Y0(t, e) {
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
      if (c = s.length && o.length && _d(a, o, l, s[s.length - 1], 0))
        s[s.length - 1] = c;
      else {
        s.length && (s[s.length - 1] = Fd(s[s.length - 1], o.length));
        let u = Bd(l, a);
        s.push(u), i = i.matchType(u.type), o = a;
      }
    }), s)
      return M.from(s);
  }
  return t;
}
function Bd(t, e, n = 0) {
  for (let r = e.length - 1; r >= n; r--)
    t = e[r].create(null, M.from(t));
  return t;
}
function _d(t, e, n, r, i) {
  if (i < t.length && i < e.length && t[i] == e[i]) {
    let o = _d(t, e, n, r.lastChild, i + 1);
    if (o)
      return r.copy(r.content.replaceChild(r.childCount - 1, o));
    if (r.contentMatchAt(r.childCount).matchType(i == t.length - 1 ? n.type : t[i + 1]))
      return r.copy(r.content.append(M.from(Bd(n, t, i + 1))));
  }
}
function Fd(t, e) {
  if (e == 0)
    return t;
  let n = t.content.replaceChild(t.childCount - 1, Fd(t.lastChild, e - 1)), r = t.contentMatchAt(t.childCount).fillBefore(M.empty, !0);
  return t.copy(n.append(r));
}
function yl(t, e, n, r, i, o) {
  let s = e < 0 ? t.firstChild : t.lastChild, l = s.content;
  return t.childCount > 1 && (o = 0), i < r - 1 && (l = yl(l, e, n, r, i + 1, o)), i >= n && (l = e < 0 ? s.contentMatchAt(0).fillBefore(l, o <= i).append(l) : l.append(s.contentMatchAt(s.childCount).fillBefore(M.empty, !0))), t.replaceChild(e < 0 ? 0 : t.childCount - 1, s.copy(l));
}
function Ku(t, e, n) {
  return e < t.openStart && (t = new v(yl(t.content, -1, e, t.openStart, 0, t.openEnd), e, t.openEnd)), n < t.openEnd && (t = new v(yl(t.content, 1, n, t.openEnd, 0, 0), t.openStart, n)), t;
}
const $d = {
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
function Vd() {
  return document.implementation.createHTMLDocument("title");
}
let Mr = null;
function X0(t) {
  let e = window.trustedTypes;
  if (!e)
    return t;
  if (!Mr) {
    if (Mr = e.defaultPolicy)
      try {
        return Mr.createHTML(t);
      } catch {
      }
    Mr = e.createPolicy("ProseMirrorClipboard", { createHTML: (n) => n });
  }
  return Mr.createHTML(t);
}
function Q0(t) {
  let e = /^(\s*<meta [^>]*>)*/.exec(t);
  e && (t = t.slice(e[0].length));
  let n = Vd(), r = n.body, i = /<([a-z][^>\s]+)/i.exec(t), o;
  if ((o = i && $d[i[1].toLowerCase()]) && (t = o.map((s) => "<" + s + ">").join("") + t + o.map((s) => "</" + s + ">").reverse().join("")), r.innerHTML = X0(t), o)
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
function Z0(t) {
  let e = t.querySelectorAll(Ie ? "span:not([class]):not([style])" : "span.Apple-converted-space");
  for (let n = 0; n < e.length; n++) {
    let r = e[n];
    r.childNodes.length == 1 && r.textContent == " " && r.parentNode && r.parentNode.replaceChild(t.ownerDocument.createTextNode(" "), r);
  }
}
function ex(t, e) {
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
      i = M.from(a.create(r[l + 1], i));
    } catch {
      break;
    }
    o++, s++;
  }
  return new v(i, o, s);
}
const Le = {}, Pe = {}, tx = { touchstart: !0, touchmove: !0 };
class nx {
  constructor() {
    this.shiftKey = !1, this.mouseDown = null, this.lastKeyCode = null, this.lastKeyCodeTime = 0, this.lastClick = { time: 0, x: 0, y: 0, type: "", button: 0 }, this.lastSelectionOrigin = null, this.lastSelectionTime = 0, this.lastIOSEnter = 0, this.lastIOSEnterFallbackTimeout = -1, this.lastFocus = 0, this.lastTouch = 0, this.lastChromeDelete = 0, this.composing = !1, this.compositionNode = null, this.composingTimeout = -1, this.compositionNodes = [], this.compositionEndedAt = -2e8, this.compositionID = 1, this.badSafariComposition = !1, this.compositionPendingChanges = 0, this.domChangeCount = 0, this.eventHandlers = /* @__PURE__ */ Object.create(null), this.hideSelectionGuard = null;
  }
}
function rx(t) {
  for (let e in Le) {
    let n = Le[e];
    t.dom.addEventListener(e, t.input.eventHandlers[e] = (r) => {
      ox(t, r) && !ha(t, r) && (t.editable || !(r.type in Pe)) && n(t, r);
    }, tx[e] ? { passive: !0 } : void 0);
  }
  Oe && t.dom.addEventListener("input", () => null), kl(t);
}
function Vt(t, e) {
  t.input.lastSelectionOrigin = e, t.input.lastSelectionTime = Date.now();
}
function ix(t) {
  t.input.mouseDown && t.input.mouseDown.done(), t.domObserver.stop();
  for (let e in t.input.eventHandlers)
    t.dom.removeEventListener(e, t.input.eventHandlers[e]);
  clearTimeout(t.input.composingTimeout), clearTimeout(t.input.lastIOSEnterFallbackTimeout);
}
function kl(t) {
  t.someProp("handleDOMEvents", (e) => {
    for (let n in e)
      t.input.eventHandlers[n] || t.dom.addEventListener(n, t.input.eventHandlers[n] = (r) => ha(t, r));
  });
}
function ha(t, e) {
  return t.someProp("handleDOMEvents", (n) => {
    let r = n[e.type];
    return r ? r(t, e) || e.defaultPrevented : !1;
  });
}
function ox(t, e) {
  if (!e.bubbles)
    return !0;
  if (e.defaultPrevented)
    return !1;
  for (let n = e.target; n != t.dom; n = n.parentNode)
    if (!n || n.nodeType == 11 || n.pmViewDesc && n.pmViewDesc.stopEvent(e))
      return !1;
  return !0;
}
function sx(t, e) {
  !ha(t, e) && Le[e.type] && (t.editable || !(e.type in Pe)) && Le[e.type](t, e);
}
Pe.keydown = (t, e) => {
  let n = e;
  if (t.input.shiftKey = n.keyCode == 16 || n.shiftKey, !Wd(t) && (t.input.lastKeyCode = n.keyCode, t.input.lastKeyCodeTime = Date.now(), !($t && Ie && n.keyCode == 13)))
    if (n.keyCode != 229 && t.domObserver.forceFlush(), ar && n.keyCode == 13 && !n.ctrlKey && !n.altKey && !n.metaKey) {
      let r = Date.now();
      t.input.lastIOSEnter = r, t.input.lastIOSEnterFallbackTimeout = setTimeout(() => {
        t.input.lastIOSEnter == r && (t.someProp("handleKeyDown", (i) => i(t, Cn(13, "Enter"))), t.input.lastIOSEnter = 0);
      }, 200);
    } else t.someProp("handleKeyDown", (r) => r(t, n)) || J0(t, n) ? n.preventDefault() : Vt(t, "key");
};
Pe.keyup = (t, e) => {
  e.keyCode == 16 && (t.input.shiftKey = !1);
};
Pe.keypress = (t, e) => {
  let n = e;
  if (Wd(t) || !n.charCode || n.ctrlKey && !n.altKey || it && n.metaKey)
    return;
  if (t.someProp("handleKeyPress", (i) => i(t, n))) {
    n.preventDefault();
    return;
  }
  let r = t.state.selection;
  if (!(r instanceof K) || !r.$from.sameParent(r.$to)) {
    let i = String.fromCharCode(n.charCode), o = () => t.state.tr.insertText(i).scrollIntoView();
    !/[\r\n]/.test(i) && !t.someProp("handleTextInput", (s) => s(t, r.$from.pos, r.$to.pos, i, o)) && t.dispatch(o()), n.preventDefault();
  }
};
function di(t) {
  return { left: t.clientX, top: t.clientY };
}
function lx(t, e) {
  let n = e.x - t.clientX, r = e.y - t.clientY;
  return n * n + r * r < 100;
}
function fa(t, e, n, r, i) {
  if (r == -1)
    return !1;
  let o = t.state.doc.resolve(r);
  for (let s = o.depth + 1; s > 0; s--)
    if (t.someProp(e, (l) => s > o.depth ? l(t, n, o.nodeAfter, o.before(s), i, !0) : l(t, n, o.node(s), o.before(s), i, !1)))
      return !0;
  return !1;
}
function pi(t, e, n) {
  if (t.focused || t.focus(), t.state.selection.eq(e))
    return;
  let r = t.state.tr.setSelection(e);
  r.setMeta("pointer", !0), t.dispatch(r);
}
function ax(t, e) {
  if (e == -1)
    return !1;
  let n = t.state.doc.resolve(e), r = n.nodeAfter;
  return r && r.isAtom && q.isSelectable(r) ? (pi(t, new q(n)), !0) : !1;
}
function cx(t, e) {
  if (e == -1)
    return !1;
  let n = t.state.selection, r, i;
  n instanceof q && (r = n.node);
  let o = t.state.doc.resolve(e);
  for (let s = o.depth + 1; s > 0; s--) {
    let l = s > o.depth ? o.nodeAfter : o.node(s);
    if (q.isSelectable(l)) {
      r && n.$from.depth > 0 && s >= n.$from.depth && o.before(n.$from.depth + 1) == n.$from.pos ? i = o.before(n.$from.depth) : i = o.before(s);
      break;
    }
  }
  return i != null ? (pi(t, q.create(t.state.doc, i)), !0) : !1;
}
function ux(t, e, n, r, i) {
  return fa(t, "handleClickOn", e, n, r) || t.someProp("handleClick", (o) => o(t, e, r)) || (i ? cx(t, n) : ax(t, n));
}
function hx(t, e, n, r) {
  return fa(t, "handleDoubleClickOn", e, n, r) || t.someProp("handleDoubleClick", (i) => i(t, e, r));
}
function fx(t, e, n, r) {
  return fa(t, "handleTripleClickOn", e, n, r) || t.someProp("handleTripleClick", (i) => i(t, e, r)) || dx(t, n, r);
}
function dx(t, e, n) {
  if (n.button != 0)
    return !1;
  let r = Hd(t, e, !0), i = t.state.doc;
  return r ? (pi(t, r), r instanceof K && i.eq(t.state.doc) && (t.input.mouseDown = new mx(t, r)), !0) : !1;
}
function Hd(t, e, n) {
  let r = t.state.doc;
  if (e == -1)
    return r.inlineContent ? K.create(r, 0, r.content.size) : null;
  let i = r.resolve(e);
  for (let o = i.depth + 1; o > 0; o--) {
    let s = o > i.depth ? i.nodeAfter : i.node(o), l = i.before(o);
    if (s.inlineContent)
      return K.create(r, l + 1, l + 1 + s.content.size);
    if (n && q.isSelectable(s))
      return q.create(r, l);
  }
  return null;
}
function da(t) {
  return uo(t);
}
const jd = it ? "metaKey" : "ctrlKey";
Le.mousedown = (t, e) => {
  let n = e;
  t.input.shiftKey = n.shiftKey;
  let r = da(t), i = Date.now(), o = "singleClick";
  i - t.input.lastClick.time < 500 && lx(n, t.input.lastClick) && !n[jd] && t.input.lastClick.button == n.button && (t.input.lastClick.type == "singleClick" ? o = "doubleClick" : t.input.lastClick.type == "doubleClick" && (o = "tripleClick")), t.input.lastClick = { time: i, x: n.clientX, y: n.clientY, type: o, button: n.button }, t.input.mouseDown && t.input.mouseDown.done();
  let s = t.posAtCoords(di(n));
  s && (o == "singleClick" ? t.input.mouseDown = new px(t, s, n, !!r) : (o == "doubleClick" ? hx : fx)(t, s.pos, s.inside, n) ? n.preventDefault() : Vt(t, "pointer"));
};
class qd {
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
class px extends qd {
  constructor(e, n, r, i) {
    super(e), this.pos = n, this.event = r, this.flushed = i, this.delayedSelectionSync = !1, this.startDoc = e.state.doc, this.selectNode = !!r[jd], this.allowDefault = r.shiftKey;
    let o, s;
    if (n.inside > -1)
      o = e.state.doc.nodeAt(n.inside), s = n.inside;
    else {
      let u = e.state.doc.resolve(n.pos);
      o = u.parent, s = u.depth ? u.before() : 0;
    }
    const l = i ? null : r.target, a = l ? e.docView.nearestDesc(l, !0) : null;
    this.target = a && B(a.nodeDOM) ? a.nodeDOM : null;
    let { selection: c } = e.state;
    r.button == 0 && (o.type.spec.draggable && o.type.spec.selectable !== !1 || c instanceof q && c.from <= s && c.to > s) && (this.mightDrag = {
      node: o,
      pos: s,
      addAttr: !!(this.target && !this.target.draggable),
      setUneditable: !!(this.target && et && !this.target.hasAttribute("contentEditable"))
    }), this.target && this.mightDrag && (this.mightDrag.addAttr || this.mightDrag.setUneditable) && (this.view.domObserver.stop(), this.mightDrag.addAttr && (this.target.draggable = !0), this.mightDrag.setUneditable && setTimeout(() => {
      this.view.input.mouseDown == this && this.target.setAttribute("contentEditable", "false");
    }, 20), this.view.domObserver.start()), Vt(e, "pointer");
  }
  done() {
    super.done(), this.mightDrag && this.target && (this.view.domObserver.stop(), this.mightDrag.addAttr && this.target.removeAttribute("draggable"), this.mightDrag.setUneditable && this.target.removeAttribute("contentEditable"), this.view.domObserver.start()), this.delayedSelectionSync && setTimeout(() => {
      this.view.isDestroyed || Ht(this.view);
    });
  }
  up(e) {
    if (this.done(), !this.view.dom.contains(e.target))
      return;
    let n = this.pos;
    this.view.state.doc != this.startDoc && (n = this.view.posAtCoords(di(e))), this.updateAllowDefault(e), this.allowDefault || !n ? Vt(this.view, "pointer") : ux(this.view, n.pos, n.inside, e, this.selectNode) ? e.preventDefault() : e.button == 0 && (this.flushed || // Safari ignores clicks on draggable elements
    Oe && this.mightDrag && !this.mightDrag.node.isAtom || // Chrome will sometimes treat a node selection as a
    // cursor, but still report that the node is selected
    // when asked through getSelection. You'll then get a
    // situation where clicking at the point where that
    // (hidden) cursor is doesn't change the selection, and
    // thus doesn't get a reaction from ProseMirror. This
    // works around that.
    Ie && !this.view.state.selection.visible && Math.min(Math.abs(n.pos - this.view.state.selection.from), Math.abs(n.pos - this.view.state.selection.to)) <= 2) ? (pi(this.view, W.near(this.view.state.doc.resolve(n.pos))), e.preventDefault()) : Vt(this.view, "pointer");
  }
  move(e) {
    this.updateAllowDefault(e), Vt(this.view, "pointer"), super.move(e);
  }
  updateAllowDefault(e) {
    !this.allowDefault && (Math.abs(this.event.x - e.clientX) > 4 || Math.abs(this.event.y - e.clientY) > 4) && (this.allowDefault = !0);
  }
  delaySelUpdate() {
    return this.allowDefault ? (this.delayedSelectionSync = !0, !0) : !1;
  }
}
class mx extends qd {
  constructor(e, n) {
    super(e), this.startSelection = n, this.startDoc = e.state.doc;
  }
  move(e) {
    if (e.buttons == 0 || this.view.isDestroyed || !this.view.state.doc.eq(this.startDoc)) {
      this.done();
      return;
    }
    e.preventDefault(), Vt(this.view, "pointer");
    let n = this.view.posAtCoords(di(e)), r = n && Hd(this.view, n.inside, !1);
    if (!r)
      return;
    let { doc: i } = this.view.state, o = this.startSelection, [s, l] = r.from < o.from ? [o.to, r.from] : [o.from, r.to];
    pi(this.view, K.create(i, s, l));
  }
}
Le.touchstart = (t) => {
  t.input.lastTouch = Date.now(), da(t), Vt(t, "pointer");
};
Le.touchmove = (t) => {
  t.input.lastTouch = Date.now(), Vt(t, "pointer");
};
Le.contextmenu = (t) => da(t);
function Wd(t, e) {
  return t.composing ? !0 : Oe && Math.abs(Date.now() - t.input.compositionEndedAt) < 500 ? (t.input.compositionEndedAt = -2e8, !0) : !1;
}
const gx = $t ? 5e3 : -1;
Pe.compositionstart = Pe.compositionupdate = (t) => {
  if (!t.composing) {
    t.domObserver.flush();
    let { state: e } = t, n = e.selection.$to;
    if (e.selection instanceof K && e.selection.empty && (e.storedMarks || !n.textOffset && n.parentOffset && n.nodeBefore.marks.some((r) => r.type.spec.inclusive === !1) || Ie && wd && yx(t)))
      t.markCursor = t.state.storedMarks || n.marks(), uo(t, !0), t.markCursor = null;
    else if (uo(t, !e.selection.empty), et && e.selection.empty && n.parentOffset && !n.textOffset && n.nodeBefore.marks.length) {
      let r = t.domSelectionRange();
      for (let i = r.focusNode, o = r.focusOffset; i && B(i) && o != 0; ) {
        let s = o < 0 ? i.lastChild : i.childNodes[o - 1];
        if (!s)
          break;
        if (ye(s)) {
          let l = t.domSelection();
          l && l.collapse(s, s.nodeValue.length);
          break;
        } else
          i = s, o = -1;
      }
    }
    t.input.composing = !0;
  }
  Kd(t, gx);
};
function yx(t) {
  let { focusNode: e, focusOffset: n } = t.domSelectionRange();
  if (!e || !B(e) || n >= e.childNodes.length)
    return !1;
  let r = e.childNodes[n];
  return B(r) && r.contentEditable == "false";
}
Pe.compositionend = (t, e) => {
  t.composing && (t.input.composing = !1, t.input.compositionEndedAt = Date.now(), t.input.compositionPendingChanges = t.domObserver.pendingRecords().length ? t.input.compositionID : 0, t.input.compositionNode = null, t.input.badSafariComposition ? t.domObserver.forceFlush() : t.input.compositionPendingChanges && Promise.resolve().then(() => t.domObserver.flush()), t.input.compositionID++, Kd(t, 20));
};
function Kd(t, e) {
  clearTimeout(t.input.composingTimeout), e > -1 && (t.input.composingTimeout = setTimeout(() => uo(t), e));
}
function Ud(t) {
  for (t.composing && (t.input.composing = !1, t.input.compositionEndedAt = Date.now()); t.input.compositionNodes.length > 0; )
    t.input.compositionNodes.pop().markParentsDirty();
}
function kx(t) {
  let e = t.domSelectionRange();
  if (!e.focusNode)
    return null;
  let n = c0(e.focusNode, e.focusOffset), r = u0(e.focusNode, e.focusOffset);
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
function uo(t, e = !1) {
  if (!($t && t.domObserver.flushingSoon >= 0)) {
    if (t.domObserver.forceFlush(), Ud(t), e || t.docView && t.docView.dirty) {
      let n = aa(t), r = t.state.selection;
      return n && !n.eq(r) ? t.dispatch(t.state.tr.setSelection(n)) : (t.markCursor || e) && !r.$from.node(r.$from.sharedDepth(r.to)).inlineContent ? t.dispatch(t.state.tr.deleteSelection()) : t.updateState(t.state), !0;
    }
    return !1;
  }
}
function bx(t, e) {
  if (!t.dom.parentNode)
    return;
  let n = t.dom.parentNode.appendChild(document.createElement("div"));
  n.appendChild(e), n.style.cssText = "position: fixed; left: -10000px; top: 10px";
  let r = getSelection(), i = document.createRange();
  i.selectNodeContents(e), t.dom.blur(), r.removeAllRanges(), r.addRange(i), setTimeout(() => {
    n.parentNode && n.parentNode.removeChild(n), t.focus();
  }, 50);
}
const ti = $e && an < 15 || ar && p0 < 604;
Le.copy = Pe.cut = (t, e) => {
  let n = e, r = t.state.selection, i = n.type == "cut";
  if (r.empty)
    return;
  let o = ti ? null : n.clipboardData, s = r.content(), { dom: l, text: a } = ua(t, s);
  o ? (n.preventDefault(), o.clearData(), o.setData("text/html", l.innerHTML), o.setData("text/plain", a)) : bx(t, l), i && t.dispatch(t.state.tr.deleteSelection().scrollIntoView().setMeta("uiEvent", "cut"));
};
function wx(t) {
  return t.openStart == 0 && t.openEnd == 0 && t.content.childCount == 1 ? t.content.firstChild : null;
}
function xx(t, e) {
  if (!t.dom.parentNode)
    return;
  let n = t.input.shiftKey || t.state.selection.$from.parent.type.spec.code, r = t.dom.parentNode.appendChild(document.createElement(n ? "textarea" : "div"));
  n || (r.contentEditable = "true"), r.style.cssText = "position: fixed; left: -10000px; top: 10px", r.focus();
  let i = t.input.shiftKey && t.input.lastKeyCode != 45;
  setTimeout(() => {
    t.focus(), r.parentNode && r.parentNode.removeChild(r), n ? ni(t, r.value, null, i, e) : ni(t, r.textContent, r.innerHTML, i, e);
  }, 50);
}
function ni(t, e, n, r, i) {
  let o = Pd(t, e, n, r, t.state.selection.$from);
  if (t.someProp("handlePaste", (a) => a(t, i, o || v.empty)))
    return !0;
  if (!o)
    return !1;
  let s = wx(o), l = s ? t.state.tr.replaceSelectionWith(s, r) : t.state.tr.replaceSelection(o);
  return t.dispatch(l.scrollIntoView().setMeta("paste", !0).setMeta("uiEvent", "paste")), !0;
}
function Jd(t) {
  let e = t.getData("text/plain") || t.getData("Text");
  if (e)
    return e;
  let n = t.getData("text/uri-list");
  return n ? n.replace(/\r?\n/g, " ") : "";
}
Pe.paste = (t, e) => {
  let n = e;
  if (t.composing && !$t)
    return;
  let r = ti ? null : n.clipboardData, i = t.input.shiftKey && t.input.lastKeyCode != 45;
  r && ni(t, Jd(r), r.getData("text/html"), i, n) ? n.preventDefault() : xx(t, n);
};
class Gd {
  constructor(e, n, r) {
    this.slice = e, this.move = n, this.node = r;
  }
}
const Cx = it ? "altKey" : "ctrlKey";
function Yd(t, e) {
  let n;
  return t.someProp("dragCopies", (r) => {
    n = n || r(e);
  }), n != null ? !n : !e[Cx];
}
Le.dragstart = (t, e) => {
  let n = e, r = t.input.mouseDown;
  if (r && r.done(), !n.dataTransfer)
    return;
  let i = t.state.selection, o = i.empty ? null : t.posAtCoords(di(n)), s;
  if (!(o && o.pos >= i.from && o.pos <= (i instanceof q ? i.to - 1 : i.to))) {
    if (r && r.mightDrag)
      s = q.create(t.state.doc, r.mightDrag.pos);
    else if (n.target && B(n.target)) {
      let h = t.docView.nearestDesc(n.target, !0);
      h && h.node.type.spec.draggable && h != t.docView && (s = q.create(t.state.doc, h.posBefore));
    }
  }
  let l = (s || t.state.selection).content(), { dom: a, text: c, slice: u } = ua(t, l);
  (!n.dataTransfer.files.length || !Ie || bd > 120) && n.dataTransfer.clearData(), n.dataTransfer.setData(ti ? "Text" : "text/html", a.innerHTML), n.dataTransfer.effectAllowed = "copyMove", ti || n.dataTransfer.setData("text/plain", c), t.dragging = new Gd(u, Yd(t, n), s);
};
Le.dragend = (t) => {
  let e = t.dragging;
  window.setTimeout(() => {
    t.dragging == e && (t.dragging = null);
  }, 50);
};
Pe.dragover = Pe.dragenter = (t, e) => e.preventDefault();
Pe.drop = (t, e) => {
  try {
    Sx(t, e, t.dragging);
  } finally {
    t.dragging = null;
  }
};
function Sx(t, e, n) {
  if (!e.dataTransfer)
    return;
  let r = t.posAtCoords(di(e));
  if (!r)
    return;
  let i = t.state.doc.resolve(r.pos), o = n && n.slice;
  o ? t.someProp("transformPasted", (f) => {
    o = f(o, t, !1);
  }) : o = Pd(t, Jd(e.dataTransfer), ti ? null : e.dataTransfer.getData("text/html"), !1, i);
  let s = !!(n && Yd(t, e));
  if (t.someProp("handleDrop", (f) => f(t, e, o || v.empty, s))) {
    e.preventDefault();
    return;
  }
  if (!o)
    return;
  e.preventDefault();
  let l = o ? i1(t.state.doc, i.pos, o) : i.pos;
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
  if (u && q.isSelectable(o.content.firstChild) && d.nodeAfter && d.nodeAfter.sameMarkup(o.content.firstChild))
    a.setSelection(new q(d));
  else {
    let f = a.mapping.map(l);
    a.mapping.maps[a.mapping.maps.length - 1].forEach((p, m, y, g) => f = g), a.setSelection(ca(t, d, a.doc.resolve(f)));
  }
  t.focus(), t.dispatch(a.setMeta("uiEvent", "drop"));
}
Le.focus = (t) => {
  t.input.lastFocus = Date.now(), t.focused || (t.domObserver.stop(), t.dom.classList.add("ProseMirror-focused"), t.domObserver.start(), t.focused = !0, setTimeout(() => {
    t.docView && t.hasFocus() && !t.domObserver.currentSelection.eq(t.domSelectionRange()) && Ht(t);
  }, 20));
};
Le.blur = (t, e) => {
  let n = e;
  t.focused && (t.domObserver.stop(), t.dom.classList.remove("ProseMirror-focused"), t.domObserver.start(), n.relatedTarget && t.dom.contains(n.relatedTarget) && t.domObserver.currentSelection.clear(), t.focused = !1);
};
Le.beforeinput = (t, e) => {
  if ($t && e.inputType == "deleteContentBackward") {
    t.domObserver.flushSoon();
    let { domChangeCount: r } = t.input;
    setTimeout(() => {
      if (t.input.domChangeCount != r || (t.dom.blur(), t.focus(), t.someProp("handleKeyDown", (o) => o(t, Cn(8, "Backspace")))))
        return;
      let { $cursor: i } = t.state.selection;
      i && i.pos > 0 && t.dispatch(t.state.tr.delete(i.pos - 1, i.pos).scrollIntoView());
    }, 50);
  }
};
for (let t in Pe)
  Le[t] = Pe[t];
function ri(t, e) {
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
class ho {
  constructor(e, n) {
    this.toDOM = e, this.spec = n || Dn, this.side = this.spec.side || 0;
  }
  map(e, n, r, i) {
    let { pos: o, deleted: s } = e.mapResult(n.from + i, this.side < 0 ? -1 : 1);
    return s ? null : new Me(o - r, o - r, this);
  }
  valid() {
    return !0;
  }
  eq(e) {
    return this == e || e instanceof ho && (this.spec.key && this.spec.key == e.spec.key || this.toDOM == e.toDOM && ri(this.spec, e.spec));
  }
  destroy(e) {
    this.spec.destroy && this.spec.destroy(e);
  }
}
class hn {
  constructor(e, n) {
    this.attrs = e, this.spec = n || Dn;
  }
  map(e, n, r, i) {
    let o = e.map(n.from + i, this.spec.inclusiveStart ? -1 : 1) - r, s = e.map(n.to + i, this.spec.inclusiveEnd ? 1 : -1) - r;
    return o >= s ? null : new Me(o, s, this);
  }
  valid(e, n) {
    return n.from < n.to;
  }
  eq(e) {
    return this == e || e instanceof hn && ri(this.attrs, e.attrs) && ri(this.spec, e.spec);
  }
  static is(e) {
    return e.type instanceof hn;
  }
  destroy() {
  }
}
class pa {
  constructor(e, n) {
    this.attrs = e, this.spec = n || Dn;
  }
  map(e, n, r, i) {
    let o = e.mapResult(n.from + i, 1);
    if (o.deleted)
      return null;
    let s = e.mapResult(n.to + i, -1);
    return s.deleted || s.pos <= o.pos ? null : new Me(o.pos - r, s.pos - r, this);
  }
  valid(e, n) {
    let { index: r, offset: i } = e.content.findIndex(n.from), o;
    return i == n.from && !(o = e.child(r)).isText && i + o.nodeSize == n.to;
  }
  eq(e) {
    return this == e || e instanceof pa && ri(this.attrs, e.attrs) && ri(this.spec, e.spec);
  }
  destroy() {
  }
}
class Me {
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
    return new Me(e, n, this.type);
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
    return new Me(e, e, new ho(n, r));
  }
  /**
  Creates an inline decoration, which adds the given attributes to
  each inline node between `from` and `to`.
  */
  static inline(e, n, r, i) {
    return new Me(e, n, new hn(r, i));
  }
  /**
  Creates a node decoration. `from` and `to` should point precisely
  before and after a node in the document. That node, and only that
  node, will receive the given attributes.
  */
  static node(e, n, r, i) {
    return new Me(e, n, new pa(r, i));
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
    return this.type instanceof hn;
  }
  /**
  @internal
  */
  get widget() {
    return this.type instanceof ho;
  }
}
const Gn = [], Dn = {};
class ce {
  /**
  @internal
  */
  constructor(e, n) {
    this.local = e.length ? e : Gn, this.children = n.length ? n : Gn;
  }
  /**
  Create a set of decorations, using the structure of the given
  document. This will consume (modify) the `decorations` array, so
  you must make a copy if you want need to preserve that.
  */
  static create(e, n) {
    return n.length ? fo(n, e, 0, Dn) : Te;
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
    return this == Te || e.maps.length == 0 ? this : this.mapInner(e, n, 0, 0, r || Dn);
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
    return this.children.length ? Nx(this.children, s || [], e, n, r, i, o) : s ? new ce(s.sort(Rn), Gn) : Te;
  }
  /**
  Add the given array of decorations to the ones in the set,
  producing a new set. Consumes the `decorations` array. Needs
  access to the current document to create the appropriate tree
  structure.
  */
  add(e, n) {
    return n.length ? this == Te ? ce.create(e, n) : this.addInner(e, n, 0) : this;
  }
  addInner(e, n, r) {
    let i, o = 0;
    e.forEach((l, a) => {
      let c = a + r, u;
      if (u = Qd(n, l, c)) {
        for (i || (i = this.children.slice()); o < i.length && i[o] < a; )
          o += 3;
        i[o] == a ? i[o + 2] = i[o + 2].addInner(l, u, c + 1) : i.splice(o, 0, a, a + l.nodeSize, fo(u, l, c + 1, Dn)), o += 3;
      }
    });
    let s = Xd(o ? Zd(n) : n, -r);
    for (let l = 0; l < s.length; l++)
      s[l].type.valid(e, s[l]) || s.splice(l--, 1);
    return new ce(s.length ? this.local.concat(s).sort(Rn) : this.local, i || this.children);
  }
  /**
  Create a new set that contains the decorations in this set, minus
  the ones in the given array.
  */
  remove(e) {
    return e.length == 0 || this == Te ? this : this.removeInner(e, 0);
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
      c != Te ? r[o + 2] = c : (r.splice(o, 3), o -= 3);
    }
    if (i.length) {
      for (let o = 0, s; o < e.length; o++)
        if (s = e[o])
          for (let l = 0; l < i.length; l++)
            i[l].eq(s, n) && (i == this.local && (i = this.local.slice()), i.splice(l--, 1));
    }
    return r == this.children && i == this.local ? this : i.length || r.length ? new ce(i, r) : Te;
  }
  forChild(e, n) {
    if (this == Te)
      return this;
    if (n.isLeaf)
      return ce.empty;
    let r, i;
    for (let l = 0; l < this.children.length; l += 3)
      if (this.children[l] >= e) {
        this.children[l] == e && (r = this.children[l + 2]);
        break;
      }
    let o = e + 1, s = o + n.content.size;
    for (let l = 0; l < this.local.length; l++) {
      let a = this.local[l];
      if (a.from < s && a.to > o && a.type instanceof hn) {
        let c = Math.max(o, a.from) - o, u = Math.min(s, a.to) - o;
        c < u && (i || (i = [])).push(a.copy(c, u));
      }
    }
    if (i) {
      let l = new ce(i.sort(Rn), Gn);
      return r ? new rn([l, r]) : l;
    }
    return r || Te;
  }
  /**
  @internal
  */
  eq(e) {
    if (this == e)
      return !0;
    if (!(e instanceof ce) || this.local.length != e.local.length || this.children.length != e.children.length)
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
    return ma(this.localsInner(e));
  }
  /**
  @internal
  */
  localsInner(e) {
    if (this == Te)
      return Gn;
    if (e.inlineContent || !this.local.some(hn.is))
      return this.local;
    let n = [];
    for (let r = 0; r < this.local.length; r++)
      this.local[r].type instanceof hn || n.push(this.local[r]);
    return n;
  }
  forEachSet(e) {
    e(this);
  }
}
ce.empty = new ce([], []);
ce.removeOverlap = ma;
const Te = ce.empty;
class rn {
  constructor(e) {
    this.members = e;
  }
  map(e, n) {
    const r = this.members.map((i) => i.map(e, n, Dn));
    return rn.from(r);
  }
  forChild(e, n) {
    if (n.isLeaf)
      return ce.empty;
    let r = [];
    for (let i = 0; i < this.members.length; i++) {
      let o = this.members[i].forChild(e, n);
      o != Te && (o instanceof rn ? r = r.concat(o.members) : r.push(o));
    }
    return rn.from(r);
  }
  eq(e) {
    if (!(e instanceof rn) || e.members.length != this.members.length)
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
    return n ? ma(r ? n : n.sort(Rn)) : Gn;
  }
  // Create a group for the given array of decoration sets, or return
  // a single set when possible.
  static from(e) {
    switch (e.length) {
      case 0:
        return Te;
      case 1:
        return e[0];
      default:
        return new rn(e.every((n) => n instanceof ce) ? e : e.reduce((n, r) => n.concat(r instanceof ce ? r : r.members), []));
    }
  }
  forEachSet(e) {
    for (let n = 0; n < this.members.length; n++)
      this.members[n].forEachSet(e);
  }
}
function Nx(t, e, n, r, i, o, s) {
  let l = t.slice();
  for (let c = 0, u = o; c < n.maps.length; c++) {
    let h = 0;
    n.maps[c].forEach((d, f, p, m) => {
      let y = m - p - (f - d);
      for (let g = 0; g < l.length; g += 3) {
        let S = l[g + 1];
        if (S < 0 || d > S + u - h)
          continue;
        let C = l[g] + u - h;
        f >= C ? l[g + 1] = d <= C ? -2 : -1 : d >= u && y && (l[g] += y, l[g + 1] += y);
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
        g != Te ? (l[c] = h, l[c + 1] = f, l[c + 2] = g) : (l[c + 1] = -2, a = !0);
      } else
        a = !0;
    }
  if (a) {
    let c = Ix(l, t, e, n, i, o, s), u = fo(c, r, 0, s);
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
  return new ce(e.sort(Rn), l);
}
function Xd(t, e) {
  if (!e || !t.length)
    return t;
  let n = [];
  for (let r = 0; r < t.length; r++) {
    let i = t[r];
    n.push(new Me(i.from + e, i.to + e, i.type));
  }
  return n;
}
function Ix(t, e, n, r, i, o, s) {
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
function Qd(t, e, n) {
  if (e.isLeaf)
    return null;
  let r = n + e.nodeSize, i = null;
  for (let o = 0, s; o < t.length; o++)
    (s = t[o]) && s.from > n && s.to < r && ((i || (i = [])).push(s), t[o] = null);
  return i;
}
function Zd(t) {
  let e = [];
  for (let n = 0; n < t.length; n++)
    t[n] != null && e.push(t[n]);
  return e;
}
function fo(t, e, n, r) {
  let i = [], o = !1;
  e.forEach((l, a) => {
    let c = Qd(t, l, a + n);
    if (c) {
      o = !0;
      let u = fo(c, l, n + a + 1, r);
      u != Te && i.push(a, a + l.nodeSize, u);
    }
  });
  let s = Xd(o ? Zd(t) : t, -n).sort(Rn);
  for (let l = 0; l < s.length; l++)
    s[l].type.valid(e, s[l]) || (r.onRemove && r.onRemove(s[l].spec), s.splice(l--, 1));
  return s.length || i.length ? new ce(s, i) : Te;
}
function Rn(t, e) {
  return t.from - e.from || t.to - e.to;
}
function ma(t) {
  let e = t;
  for (let n = 0; n < e.length - 1; n++) {
    let r = e[n];
    if (r.from != r.to)
      for (let i = n + 1; i < e.length; i++) {
        let o = e[i];
        if (o.from == r.from) {
          o.to != r.to && (e == t && (e = t.slice()), e[i] = o.copy(o.from, r.to), Uu(e, i + 1, o.copy(r.to, o.to)));
          continue;
        } else {
          o.from < r.to && (e == t && (e = t.slice()), e[n] = r.copy(r.from, o.from), Uu(e, i, r.copy(o.from, r.to)));
          break;
        }
      }
  }
  return e;
}
function Uu(t, e, n) {
  for (; e < t.length && Rn(n, t[e]) > 0; )
    e++;
  t.splice(e, 0, n);
}
function ms(t) {
  let e = [];
  return t.someProp("decorations", (n) => {
    let r = n(t.state);
    r && r != Te && e.push(r);
  }), t.cursorWrapper && e.push(ce.create(t.state.doc, [t.cursorWrapper.deco])), rn.from(e);
}
const Mx = {
  childList: !0,
  characterData: !0,
  characterDataOldValue: !0,
  attributes: !0,
  attributeOldValue: !0,
  subtree: !0
}, Tx = $e && an <= 11;
class Ax {
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
class Ex {
  constructor(e, n) {
    this.view = e, this.handleDOMChange = n, this.queue = [], this.flushingSoon = -1, this.observer = null, this.currentSelection = new Ax(), this.onCharData = null, this.suppressingSelectionUpdates = !1, this.lastChangedTextNode = null, this.observer = window.MutationObserver && new window.MutationObserver((r) => {
      for (let i = 0; i < r.length; i++)
        this.queue.push(r[i]);
      $e && an <= 11 && r.some((i) => i.type == "childList" && i.removedNodes.length || i.type == "characterData" && i.oldValue.length > i.target.nodeValue.length) ? this.flushSoon() : Oe && e.composing && r.some((i) => i.type == "childList" && i.target.nodeName == "TR") ? (e.input.badSafariComposition = !0, this.flushSoon()) : this.flush();
    }), Tx && (this.onCharData = (r) => {
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
    this.observer && (this.observer.takeRecords(), this.observer.observe(this.view.dom, Mx)), this.onCharData && this.view.dom.addEventListener("DOMCharacterDataModified", this.onCharData), this.connectSelection();
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
    if ($u(this.view)) {
      if (this.suppressingSelectionUpdates)
        return Ht(this.view);
      if ($e && an <= 11 && !this.view.state.selection.empty) {
        let e = this.view.domSelectionRange();
        if (e.focusNode && $n(e.focusNode, e.focusOffset, e.anchorNode, e.anchorOffset))
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
    for (let o = e.focusNode; o; o = lr(o))
      n.add(o);
    for (let o = e.anchorNode; o; o = lr(o))
      if (n.has(o)) {
        r = o;
        break;
      }
    let i = r && this.view.docView.nearestDesc(r);
    if (i && i.ignoreMutation({
      type: "selection",
      target: ye(r) ? r.parentNode : r
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
    let r = e.domSelectionRange(), i = !this.suppressingSelectionUpdates && !this.currentSelection.eq(r) && $u(e) && !this.ignoreSelectionChange(r), o = -1, s = -1, l = !1, a = [];
    if (e.editable)
      for (let u = 0; u < n.length; u++) {
        let h = this.registerMutation(n[u], a);
        h && (o = o < 0 ? h.from : Math.min(h.from, o), s = s < 0 ? h.to : Math.max(h.to, s), h.typeOver && (l = !0));
      }
    if (a.some((u) => u.nodeName == "BR") && (e.input.lastKeyCode == 8 || e.input.lastKeyCode == 46 || Ie && (e.composing || e.input.compositionEndedAt > Date.now() - 50) && n.some((u) => u.type == "childList" && u.removedNodes.length))) {
      for (let u of a)
        if (u.nodeName == "BR" && u.parentNode) {
          let h = u.nextSibling;
          for (; h && B(h); ) {
            if (h.contentEditable == "false") {
              u.parentNode.removeChild(u);
              break;
            }
            h = h.firstChild;
          }
        }
    } else if (et && a.length) {
      let u = a.filter((h) => h.nodeName == "BR");
      if (u.length == 2) {
        let [h, d] = u;
        h.parentNode && h.parentNode.parentNode == d.parentNode ? d.remove() : h.remove();
      } else {
        let { focusNode: h } = this.currentSelection;
        for (let d of u) {
          let f = d.parentNode;
          f && f.nodeName == "LI" && (!h || Dx(e, h) != f) && d.remove();
        }
      }
    }
    let c = null;
    o < 0 && i && e.input.lastFocus > Date.now() - 200 && Math.max(e.input.lastTouch, e.input.lastClick.time) < Date.now() - 300 && Oo(r) && (c = aa(e)) && c.eq(W.near(e.state.doc.resolve(0), 1)) ? (e.input.lastFocus = 0, Ht(e), this.currentSelection.set(r), e.scrollToSelection()) : (o > -1 || i) && (o > -1 && (e.docView.markDirty(o, s), vx(e)), e.input.badSafariComposition && (e.input.badSafariComposition = !1, Rx(e, a)), this.handleDOMChange(o, s, l, a), e.docView && e.docView.dirty ? e.updateState(e.state) : this.currentSelection.eq(r) || Ht(e), this.currentSelection.set(r));
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
        n.push(h), ye(h) && (this.lastChangedTextNode = h);
      }
      if (r.contentDOM && r.contentDOM != r.dom && !r.contentDOM.contains(e.target))
        return { from: r.posBefore, to: r.posAfter };
      let i = e.previousSibling, o = e.nextSibling;
      if ($e && an <= 11 && e.addedNodes.length)
        for (let u = 0; u < e.addedNodes.length; u++) {
          let { previousSibling: h, nextSibling: d } = e.addedNodes[u];
          (!h || Array.prototype.indexOf.call(e.addedNodes, h) < 0) && (i = h), (!d || Array.prototype.indexOf.call(e.addedNodes, d) < 0) && (o = d);
        }
      let s = i && i.parentNode == e.target ? Se(i) + 1 : 0, l = r.localPosFromDOM(e.target, s, -1), a = o && o.parentNode == e.target ? Se(o) : e.target.childNodes.length, c = r.localPosFromDOM(e.target, a, 1);
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
let Ju = /* @__PURE__ */ new WeakMap(), Gu = !1;
function vx(t) {
  if (!Ju.has(t) && (Ju.set(t, null), ["normal", "nowrap", "pre-line"].indexOf(getComputedStyle(t.dom).whiteSpace) !== -1)) {
    if (t.requiresGeckoHackNode = et, Gu)
      return;
    console.warn("ProseMirror expects the CSS white-space property to be set, preferably to 'pre-wrap'. It is recommended to load style/prosemirror.css from the prosemirror-view package."), Gu = !0;
  }
}
function Yu(t, e) {
  let n = e.startContainer, r = e.startOffset, i = e.endContainer, o = e.endOffset, s = t.domAtPos(t.state.selection.anchor);
  return $n(s.node, s.offset, i, o) && ([n, r, i, o] = [i, o, n, r]), { anchorNode: n, anchorOffset: r, focusNode: i, focusOffset: o };
}
function Ox(t, e) {
  if (e.getComposedRanges) {
    let i = e.getComposedRanges(t.root)[0];
    if (i)
      return Yu(t, i);
  }
  let n;
  function r(i) {
    i.preventDefault(), i.stopImmediatePropagation(), n = i.getTargetRanges()[0];
  }
  return t.dom.addEventListener("beforeinput", r, !0), document.execCommand("indent"), t.dom.removeEventListener("beforeinput", r, !0), n ? Yu(t, n) : null;
}
function Dx(t, e) {
  for (let n = e.parentNode; n && n != t.dom; n = n.parentNode) {
    let r = t.docView.nearestDesc(n, !0);
    if (r && r.node.isBlock)
      return n;
  }
  return null;
}
function Rx(t, e) {
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
          if (!a || !B(a) || a.contentEditable == "false" || /^(BR|IMG)$/.test(a.nodeName))
            break;
          l = a;
        }
        l.insertBefore(o, l.firstChild), r == o && t.domSelection().collapse(o, i);
      } else
        o.parentNode.removeChild(o);
    }
}
function zx(t, e, n, r) {
  let { node: i, fromOffset: o, toOffset: s, from: l, to: a } = t.docView.parseRange(e, n), c = t.domSelectionRange(), u, h = c.anchorNode;
  if (h && Vn(t.dom, h) && (u = [{ node: h, offset: c.anchorOffset }], Oo(c) || u.push({ node: c.focusNode, offset: c.focusOffset })), Ie && t.input.lastKeyCode === 8)
    for (let g = s; g > o; g--) {
      let S = i.childNodes[g - 1], C = S.pmViewDesc;
      if (S.nodeName == "BR" && !C) {
        s = g;
        break;
      }
      if (!C || C.size)
        break;
    }
  let d = t.state.doc, f = t.someProp("domParser") || ir.fromSchema(t.state.schema), p = d.resolve(l), m = null, y = f.parse(i, {
    topNode: p.parent,
    topMatch: p.parent.contentMatchAt(p.index()),
    topOpen: !0,
    from: o,
    to: s,
    preserveWhitespace: p.parent.type.whitespace == "pre" ? "full" : !0,
    findPositions: u,
    ruleFromNode: Lx(r),
    context: p
  });
  if (u && u[0].pos != null) {
    let g = u[0].pos, S = u[1] && u[1].pos;
    S == null && (S = g), m = { anchor: g + l, head: S + l };
  }
  return { doc: y, sel: m, from: l, to: a };
}
const Lx = (t) => (e) => {
  let n = e.pmViewDesc;
  if (n)
    return n.parseRule(t);
  if (e.nodeName == "BR" && e.parentNode) {
    if (Oe && /^(ul|ol)$/i.test(e.parentNode.nodeName)) {
      let r = document.createElement("div");
      return r.appendChild(document.createElement("li")), { skip: r };
    } else if (e.parentNode.lastChild == e || Oe && /^(tr|table)$/i.test(e.parentNode.nodeName))
      return { ignore: !0 };
  } else if (e.nodeName == "IMG" && e.getAttribute("mark-placeholder"))
    return { ignore: !0 };
  return null;
}, Px = /^(a|abbr|acronym|b|bd[io]|big|br|button|cite|code|data(list)?|del|dfn|em|i|img|ins|kbd|label|map|mark|meter|output|q|ruby|s|samp|small|span|strong|su[bp]|time|u|tt|var)$/i;
function Bx(t, e, n, r, i) {
  let o = t.input.compositionPendingChanges || (t.composing ? t.input.compositionID : 0);
  if (t.input.compositionPendingChanges = 0, e < 0) {
    let A = t.input.lastSelectionTime > Date.now() - 50 ? t.input.lastSelectionOrigin : null, D = aa(t, A);
    if (D && !t.state.selection.eq(D)) {
      if (Ie && $t && t.input.lastKeyCode === 13 && Date.now() - 100 < t.input.lastKeyCodeTime && t.someProp("handleKeyDown", (N) => N(t, Cn(13, "Enter"))))
        return;
      let F = t.state.tr.setSelection(D);
      A == "pointer" ? F.setMeta("pointer", !0) : A == "key" && F.scrollIntoView(), o && F.setMeta("composition", o), t.dispatch(F);
    }
    return;
  }
  let s = t.state.doc.resolve(e), l = s.sharedDepth(n);
  e = s.before(l + 1), n = t.state.doc.resolve(n).after(l + 1);
  let a = t.state.selection, c = zx(t, e, n, i), u = t.state.doc, h = u.slice(c.from, c.to), d, f;
  t.input.lastKeyCode === 8 && Date.now() - 100 < t.input.lastKeyCodeTime ? (d = t.state.selection.to, f = "end") : (d = t.state.selection.from, f = "start"), t.input.lastKeyCode = null;
  let p = Vx(h.content, c.doc.content, c.from, d, f);
  if (p && t.input.domChangeCount++, (ar && t.input.lastIOSEnter > Date.now() - 225 || $t) && i.some((A) => B(A) && !Px.test(A.nodeName)) && (!p || p.endA >= p.endB) && t.someProp("handleKeyDown", (A) => A(t, Cn(13, "Enter")))) {
    t.input.lastIOSEnter = 0;
    return;
  }
  if (!p)
    if (r && a instanceof K && !a.empty && a.$head.sameParent(a.$anchor) && !t.composing && !(c.sel && c.sel.anchor != c.sel.head))
      p = { start: a.from, endA: a.to, endB: a.to };
    else {
      if (c.sel) {
        let A = Xu(t, t.state.doc, c.sel);
        if (A && !A.eq(t.state.selection)) {
          let D = t.state.tr.setSelection(A);
          o && D.setMeta("composition", o), t.dispatch(D);
        }
      }
      return;
    }
  t.state.selection.from < t.state.selection.to && p.start == p.endB && t.state.selection instanceof K && (p.start > t.state.selection.from && p.start <= t.state.selection.from + 2 && t.state.selection.from >= c.from ? p.start = t.state.selection.from : p.endA < t.state.selection.to && p.endA >= t.state.selection.to - 2 && t.state.selection.to <= c.to && (p.endB += t.state.selection.to - p.endA, p.endA = t.state.selection.to)), $e && an <= 11 && p.endB == p.start + 1 && p.endA == p.start && p.start > c.from && c.doc.textBetween(p.start - c.from - 1, p.start - c.from + 1) == "  " && (p.start--, p.endA--, p.endB--);
  let m = c.doc.resolveNoCache(p.start - c.from), y = c.doc.resolveNoCache(p.endB - c.from), g = u.resolve(p.start), S = m.sameParent(y) && m.parent.inlineContent && g.end() >= p.endA;
  if ((ar && t.input.lastIOSEnter > Date.now() - 225 && (!S || i.some((A) => A.nodeName == "DIV" || A.nodeName == "P")) || !S && $x(c.doc, m.pos, y.pos)) && t.someProp("handleKeyDown", (A) => A(t, Cn(13, "Enter")))) {
    t.input.lastIOSEnter = 0;
    return;
  }
  if (t.state.selection.anchor > p.start && Fx(u, p.start, p.endA, m, y) && t.someProp("handleKeyDown", (A) => A(t, Cn(8, "Backspace")))) {
    $t && Ie && t.domObserver.suppressSelectionUpdates();
    return;
  }
  Ie && p.endB == p.start && (t.input.lastChromeDelete = Date.now()), $t && !S && m.start() != y.start() && y.parentOffset == 0 && m.depth == y.depth && c.sel && c.sel.anchor == c.sel.head && c.sel.head == p.endA && (p.endB -= 2, y = c.doc.resolveNoCache(p.endB - c.from), setTimeout(() => {
    t.someProp("handleKeyDown", function(A) {
      return A(t, Cn(13, "Enter"));
    });
  }, 20));
  let C = p.start, E = p.endA, O = (A) => {
    let D = A || t.state.tr.replace(C, E, c.doc.slice(p.start - c.from, p.endB - c.from));
    if (c.sel) {
      let F = Xu(t, D.doc, c.sel);
      F && !(Ie && t.composing && F.empty && (p.start != p.endB || t.input.lastChromeDelete < Date.now() - 100) && (F.head == C || F.head == D.mapping.map(E) - 1) || $e && F.empty && F.head == C) && D.setSelection(F);
    }
    return o && D.setMeta("composition", o), D.scrollIntoView();
  }, x;
  if (S)
    if (m.pos == y.pos) {
      $e && an <= 11 && m.parentOffset == 0 && (t.domObserver.suppressSelectionUpdates(), setTimeout(() => Ht(t), 20));
      let A = O(t.state.tr.delete(C, E)), D = u.resolve(p.start).marksAcross(u.resolve(p.endA));
      D && A.ensureMarks(D), t.dispatch(A);
    } else if (
      // Adding or removing a mark
      p.endA == p.endB && (x = _x(m.parent.content.cut(m.parentOffset, y.parentOffset), g.parent.content.cut(g.parentOffset, p.endA - g.start())))
    ) {
      let A = O(t.state.tr);
      x.type == "add" ? A.addMark(C, E, x.mark) : A.removeMark(C, E, x.mark), t.dispatch(A);
    } else if (m.parent.child(m.index()).isText && m.index() == y.index() - (y.textOffset ? 0 : 1)) {
      let A = m.parent.textBetween(m.parentOffset, y.parentOffset), D = () => O(t.state.tr.insertText(A, C, E));
      t.someProp("handleTextInput", (F) => F(t, C, E, A, D)) || t.dispatch(D());
    } else
      t.dispatch(O());
  else
    t.dispatch(O());
}
function Xu(t, e, n) {
  return Math.max(n.anchor, n.head) > e.content.size ? null : ca(t, e.resolve(n.anchor), e.resolve(n.head));
}
function _x(t, e) {
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
  if (M.from(c).eq(t))
    return { mark: l, type: s };
}
function Fx(t, e, n, r, i) {
  if (
    // The content must have shrunk
    n - e <= i.pos - r.pos || // newEnd must point directly at or after the end of the block that newStart points into
    gs(r, !0, !1) < i.pos
  )
    return !1;
  let o = t.resolve(e);
  if (!r.parent.isTextblock) {
    let l = o.nodeAfter;
    return l != null && n == e + l.nodeSize;
  }
  if (o.parentOffset < o.parent.content.size || !o.parent.isTextblock)
    return !1;
  let s = t.resolve(gs(o, !0, !0));
  return !s.parent.isTextblock || s.pos > n || gs(s, !0, !1) < n ? !1 : r.parent.content.cut(r.parentOffset).eq(s.parent.content);
}
function $x(t, e, n) {
  let r = 0, i = 0;
  return t.nodesBetween(e, n, (o, s) => {
    o.isTextblock && s >= e && s < n ? r++ : (o.isText ? /\S/.test(o.text.slice(Math.max(0, e - s), Math.min(o.nodeSize, n - s))) : o.isLeaf) && i++;
  }), i == 0 && r == 1;
}
function gs(t, e, n) {
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
function Vx(t, e, n, r, i) {
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
class ep {
  /**
  Create a view. `place` may be a DOM node that the editor should
  be appended to, a function that will place it into the document,
  or an object whose `mount` property holds the node to use as the
  document container. If it is `null`, the editor will not be
  added to the document.
  */
  constructor(e, n) {
    this._root = null, this.focused = !1, this.trackWrites = null, this.mounted = !1, this.markCursor = null, this.cursorWrapper = null, this.lastSelectedViewDesc = void 0, this.input = new nx(), this.prevDirectPlugins = [], this.pluginViews = [], this.requiresGeckoHackNode = !1, this.dragging = null, this._props = n, this.state = n.state, this.directPlugins = n.plugins || [], this.directPlugins.forEach(nh), this.dispatch = this.dispatch.bind(this), this.dom = e && e.mount || document.createElement("div"), e && (e.appendChild ? e.appendChild(this.dom) : typeof e == "function" ? e(this.dom) : e.mount && (this.mounted = !0)), this.editable = eh(this), Zu(this), this.nodeViews = th(this), this.docView = zu(this.state.doc, Qu(this), ms(this), this.dom, this), this.domObserver = new Ex(this, (r, i, o, s) => Bx(this, r, i, o, s)), this.domObserver.start(), rx(this), this.updatePluginViews();
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
    e.handleDOMEvents != this._props.handleDOMEvents && kl(this);
    let n = this._props;
    this._props = e, e.plugins && (e.plugins.forEach(nh), this.directPlugins = e.plugins), this.updateStateInner(e.state, n);
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
    e.storedMarks && this.composing && (Ud(this), s = !0), this.state = e;
    let l = i.plugins != e.plugins || this._props.plugins != n.plugins;
    if (l || this._props.plugins != n.plugins || this._props.nodeViews != n.nodeViews) {
      let f = th(this);
      jx(f, this.nodeViews) && (this.nodeViews = f, o = !0);
    }
    (l || n.handleDOMEvents != this._props.handleDOMEvents) && kl(this), this.editable = eh(this), Zu(this);
    let a = ms(this), c = Qu(this), u = i.plugins != e.plugins && !i.doc.eq(e.doc) ? "reset" : e.scrollToSelection > i.scrollToSelection ? "to selection" : "preserve", h = o || !this.docView.matchesNode(e.doc, c, a);
    (h || !e.selection.eq(i.selection)) && (s = !0);
    let d = u == "preserve" && s && this.dom.style.overflowAnchor == null && y0(this);
    if (s) {
      this.domObserver.stop();
      let f = h && ($e || Ie) && !this.composing && !i.selection.empty && !e.selection.empty && Hx(i.selection, e.selection);
      if (h) {
        let m = Ie ? this.trackWrites = this.domSelectionRange().focusNode : null;
        this.composing && (this.input.compositionNode = kx(this)), (o || !this.docView.update(e.doc, c, a, this)) && (this.docView.updateOuterDeco(c), this.docView.destroy(), this.docView = zu(e.doc, c, a, this.dom, this)), m && (!this.trackWrites || !this.dom.contains(this.trackWrites)) && (f = !0);
      }
      let p = this.input.mouseDown;
      f || !(p && this.domObserver.currentSelection.eq(this.domSelectionRange()) && V0(this) && p.delaySelUpdate()) ? Ht(this, f) : (Rd(this, e.selection), this.domObserver.setCurSelection()), this.domObserver.start();
    }
    this.updatePluginViews(i), !((r = this.dragging) === null || r === void 0) && r.node && !i.doc.eq(e.doc) && this.updateDraggedNode(this.dragging, i), u == "reset" ? this.dom.scrollTop = 0 : u == "to selection" ? this.scrollToSelection() : d && k0(d);
  }
  /**
  @internal
  */
  scrollToSelection() {
    let e = this.domSelectionRange().focusNode;
    if (!(!e || !Vn(this.dom, e))) {
      if (!this.someProp("handleScrollToSelection", (n) => n(this))) if (this.state.selection instanceof q) {
        let n = this.docView.domAfterPos(this.state.selection.from);
        B(n) && Eu(this, n.getBoundingClientRect(), e);
      } else
        Eu(this, this.coordsAtPos(this.state.selection.head, 1), e);
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
    this.dragging = new Gd(e.slice, e.move, i < 0 ? void 0 : q.create(this.state.doc, i));
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
    if ($e) {
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
    this.domObserver.stop(), this.editable && b0(this.dom), Ht(this), this.domObserver.start();
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
    return N0(this, e);
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
    return Id(this, e, n);
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
    return E0(this, n || this.state, e);
  }
  /**
  Run the editor's paste logic with the given HTML string. The
  `event`, if given, will be passed to the
  [`handlePaste`](https://prosemirror.net/docs/ref/#view.EditorProps.handlePaste) hook.
  */
  pasteHTML(e, n) {
    return ni(this, "", e, !1, n || new ClipboardEvent("paste"));
  }
  /**
  Run the editor's paste logic with the given plain-text input.
  */
  pasteText(e, n) {
    return ni(this, e, null, !0, n || new ClipboardEvent("paste"));
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
    return ua(this, e);
  }
  /**
  Removes the editor from the DOM and destroys all [node
  views](https://prosemirror.net/docs/ref/#view.NodeView).
  */
  destroy() {
    this.docView && (ix(this), this.destroyPluginViews(), this.mounted ? (this.docView.update(this.state.doc, [], ms(this), this), this.dom.textContent = "") : this.dom.parentNode && this.dom.parentNode.removeChild(this.dom), this.docView.destroy(), this.docView = null, l0());
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
    return sx(this, e);
  }
  /**
  @internal
  */
  domSelectionRange() {
    let e = this.dom.isConnected !== !1 && this.domSelection();
    return e ? Oe && this.root.nodeType === 11 && f0(this.dom.ownerDocument) == this.dom && Ox(this, e) || e : { focusNode: null, focusOffset: 0, anchorNode: null, anchorOffset: 0 };
  }
  /**
  @internal
  */
  domSelection() {
    return this.root.getSelection();
  }
}
ep.prototype.dispatch = function(t) {
  let e = this._props.dispatchTransaction;
  e ? e.call(this, t) : this.updateState(this.state.apply(t));
};
function Qu(t) {
  let e = /* @__PURE__ */ Object.create(null);
  return e.class = "ProseMirror", e.contenteditable = String(t.editable), t.someProp("attributes", (n) => {
    if (typeof n == "function" && (n = n(t.state)), n)
      for (let r in n)
        r == "class" ? e.class += " " + n[r] : r == "style" ? e.style = (e.style ? e.style + ";" : "") + n[r] : !e[r] && r != "contenteditable" && r != "nodeName" && (e[r] = String(n[r]));
  }), e.translate || (e.translate = "no"), [Me.node(0, t.state.doc.content.size, e)];
}
function Zu(t) {
  if (t.markCursor) {
    let e = document.createElement("img");
    e.className = "ProseMirror-separator", e.setAttribute("mark-placeholder", "true"), e.setAttribute("alt", ""), t.cursorWrapper = { dom: e, deco: Me.widget(t.state.selection.from, e, { raw: !0, marks: t.markCursor }) };
  } else
    t.cursorWrapper = null;
}
function eh(t) {
  return !t.someProp("editable", (e) => e(t.state) === !1);
}
function Hx(t, e) {
  let n = Math.min(t.$anchor.sharedDepth(t.head), e.$anchor.sharedDepth(e.head));
  return t.$anchor.start(n) != e.$anchor.start(n);
}
function th(t) {
  let e = /* @__PURE__ */ Object.create(null);
  function n(r) {
    for (let i in r)
      Object.prototype.hasOwnProperty.call(e, i) || (e[i] = r[i]);
  }
  return t.someProp("nodeViews", n), t.someProp("markViews", n), e;
}
function jx(t, e) {
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
function nh(t) {
  if (t.spec.state || t.spec.filterTransaction || t.spec.appendTransaction)
    throw new RangeError("Plugins passed directly to the view must not have a state component");
}
function Kt(t, e) {
  return t.meta = {
    package: "@milkdown/core",
    group: "System",
    ...e
  }, t;
}
var tp = {
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
}, It = X({}, "editorView"), zr = X({}, "editorState"), ys = X([], "initTimer"), rh = X({}, "editor"), ii = X([], "inputRules"), Wt = X([], "prosePlugins"), oi = X([], "remarkPlugins"), bl = X([], "nodeView"), wl = X([], "markView"), zn = X(el().use(Ks).use(Xs), "remark"), jr = X({
  handlers: tp,
  encode: []
}, "remarkStringifyOptions"), Hi = vt("ConfigReady");
function qx(t) {
  const e = (n) => (n.record(Hi), async () => (await t(n), n.done(Hi), () => {
    n.clearTimer(Hi);
  }));
  return Kt(e, { displayName: "Config" }), e;
}
var Ln = vt("InitReady");
function Wx(t) {
  const e = (n) => (n.inject(rh, t).inject(Wt, []).inject(oi, []).inject(ii, []).inject(bl, []).inject(wl, []).inject(jr, {
    handlers: tp,
    encode: []
  }).inject(zn, el().use(Ks).use(Xs)).inject(ys, [Hi]).record(Ln), async () => {
    await n.waitTimers(ys);
    const r = n.get(jr);
    return n.set(zn, el().use(Ks).use(Xs, r)), n.done(Ln), () => {
      n.remove(rh).remove(Wt).remove(oi).remove(ii).remove(bl).remove(wl).remove(jr).remove(zn).remove(ys).clearTimer(Ln);
    };
  });
  return Kt(e, { displayName: "Init" }), e;
}
var Ve = vt("SchemaReady"), ks = X([], "schemaTimer"), jt = X({}, "schema"), qr = X([], "nodes"), Wr = X([], "marks");
function ih(t) {
  return {
    ...t,
    parseDOM: t.parseDOM?.map((e) => ({
      priority: t.priority,
      ...e
    }))
  };
}
var np = (t) => (t.inject(jt, {}).inject(qr, []).inject(Wr, []).inject(ks, [Ln]).record(Ve), async () => {
  await t.waitTimers(ks);
  const e = t.get(zn), n = t.get(oi).reduce((s, l) => s.use(l.plugin, l.options), e);
  t.set(zn, n);
  const r = Object.fromEntries(t.get(qr).map(([s, l]) => [s, ih(l)])), i = Object.fromEntries(t.get(Wr).map(([s, l]) => [s, ih(l)])), o = new Rw({
    nodes: r,
    marks: i
  });
  return t.set(jt, o), t.done(Ve), () => {
    t.remove(jt).remove(qr).remove(Wr).remove(ks).clearTimer(Ve);
  };
});
Kt(np, { displayName: "Schema" });
var rp = class {
  constructor() {
    this.#t = new Fh(), this.#e = null, this.setCtx = (t) => {
      this.#e = t;
    }, this.chain = () => {
      if (this.#e == null) throw qo();
      const t = this.#e, e = [], n = this.get.bind(this), r = {
        run: () => {
          const o = pr(...e), s = t.get(It);
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
    if (this.#e == null) throw qo();
    const n = this.get(t)(e), r = this.#e.get(It);
    return n(r.state, r.dispatch, r);
  }
  inline(t) {
    if (this.#e == null) throw qo();
    const e = this.#e.get(It);
    return t(e.state, e.dispatch, e);
  }
};
function Kx(t = "cmdKey") {
  return X((() => () => !1), t);
}
var ne = X(new rp(), "commands"), bs = X([Ve], "commandsTimer"), Kr = vt("CommandsReady"), ip = (t) => {
  const e = new rp();
  return e.setCtx(t), t.inject(ne, e).inject(bs, [Ve]).record(Kr), async () => (await t.waitTimers(bs), t.done(Kr), () => {
    t.remove(ne).remove(bs).clearTimer(Kr);
  });
};
Kt(ip, { displayName: "Commands" });
function Ux(t) {
  return t.Backspace = pr(R1, ta, p1, id), t;
}
var op = class {
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
      const t = Ux(O1);
      return this.addObjectKeymap(t);
    }, this.build = () => {
      const t = {};
      return this.#e.forEach((e) => {
        t[e.key] = [...t[e.key] || [], e];
      }), Object.fromEntries(Object.entries(t).map(([e, n]) => {
        const r = n.sort((o, s) => (s.priority ?? 50) - (o.priority ?? 50));
        return [e, (o, s, l) => {
          const a = this.#t;
          if (a == null) throw wo();
          const c = r.map((u) => u.onRun(a));
          return pr(...c)(o, s, l);
        }];
      }));
    };
  }
  #t;
  #e;
  get ctx() {
    return this.#t;
  }
}, po = X(new op(), "keymap"), ws = X([Ve], "keymapTimer"), Ur = vt("KeymapReady"), Jx = (t) => {
  const e = new op();
  return e.setCtx(t), t.inject(po, e).inject(ws, [Ve]).record(Ur), async () => (await t.waitTimers(ws), t.done(Ur), () => {
    t.remove(po).remove(ws).clearTimer(Ur);
  });
}, ji = vt("ParserReady"), sp = (() => {
  throw wo();
}), Jr = X(sp, "parser"), xs = X([], "parserTimer"), lp = (t) => (t.inject(Jr, sp).inject(xs, [Ve]).record(ji), async () => {
  await t.waitTimers(xs);
  const e = t.get(zn), n = t.get(jt);
  return t.set(Jr, i0.create(n, e)), t.done(ji), () => {
    t.remove(Jr).remove(xs).clearTimer(ji);
  };
});
Kt(lp, { displayName: "Parser" });
var Gr = vt("SerializerReady"), Cs = X([], "serializerTimer"), ap = (() => {
  throw wo();
}), qi = X(ap, "serializer"), cp = (t) => (t.inject(qi, ap).inject(Cs, [Ve]).record(Gr), async () => {
  await t.waitTimers(Cs);
  const e = t.get(zn), n = t.get(jt);
  return t.set(qi, s0.create(n, e)), t.done(Gr), () => {
    t.remove(qi).remove(Cs).clearTimer(Gr);
  };
});
Kt(cp, { displayName: "Serializer" });
var Wi = X("", "defaultValue"), Ki = X((t) => t, "stateOptions"), Ss = X([], "editorStateTimer"), Ui = vt("EditorStateReady");
function Gx(t, e, n) {
  if (typeof t == "string") return e(t);
  if (t.type === "html") return ir.fromSchema(n).parse(t.dom);
  if (t.type === "json") return lt.fromJSON(n, t.value);
  throw Ag(t);
}
var Yx = new qe("MILKDOWN_STATE_TRACKER"), up = (t) => (t.inject(Wi, "").inject(zr, {}).inject(Ki, (e) => e).inject(Ss, [
  ji,
  Gr,
  Kr,
  Ur
]).record(Ui), async () => {
  await t.waitTimers(Ss);
  const e = t.get(jt), n = t.get(Jr), r = t.get(ii), i = t.get(Ki), o = t.get(Wt), s = Gx(t.get(Wi), n, e), l = t.get(po), a = l.addBaseKeymap(), c = [
    ...o,
    new je({
      key: Yx,
      state: {
        init: () => {
        },
        apply: (d, f, p, m) => {
          t.set(zr, m);
        }
      }
    }),
    V1({ rules: r }),
    n0(l.build())
  ];
  t.set(Wt, c);
  const u = i({
    schema: e,
    doc: s,
    plugins: c
  }), h = Tn.create(u);
  return t.set(zr, h), t.done(Ui), () => {
    a(), t.remove(Wi).remove(zr).remove(Ki).remove(Ss).clearTimer(Ui);
  };
});
Kt(up, { displayName: "EditorState" });
var si = X([], "pasteRule"), Ns = X([Ve], "pasteRuleTimer"), Ji = vt("PasteRuleReady"), hp = (t) => (t.inject(si, []).inject(Ns, [Ve]).record(Ji), async () => (await t.waitTimers(Ns), t.done(Ji), () => {
  t.remove(si).remove(Ns).clearTimer(Ji);
}));
Kt(hp, { displayName: "PasteRule" });
var Gi = vt("EditorViewReady"), Is = X([], "editorViewTimer"), Yi = X({}, "editorViewOptions"), Xi = X(null, "root"), xl = X(null, "rootDOM"), Cl = X({}, "rootAttrs");
function Xx(t, e) {
  const n = document.createElement("div");
  n.className = "milkdown", t.appendChild(n), e.set(xl, n);
  const r = e.get(Cl);
  return Object.entries(r).forEach(([i, o]) => n.setAttribute(i, o)), n;
}
function Qx(t) {
  t.classList.add("editor"), t.setAttribute("role", "textbox");
}
var Zx = new qe("MILKDOWN_VIEW_CLEAR"), fp = (t) => (t.inject(Xi, document.body).inject(It, {}).inject(Yi, {}).inject(xl, null).inject(Cl, {}).inject(Is, [Ui, Ji]).record(Gi), async () => {
  await t.wait(Ln);
  const e = t.get(Xi) || document.body, n = typeof e == "string" ? document.querySelector(e) : e;
  t.update(Wt, (a) => [new je({
    key: Zx,
    view: (c) => {
      const u = n ? Xx(n, t) : void 0;
      return (() => {
        if (u && n) {
          const d = c.dom;
          n.replaceChild(u, d), u.appendChild(d);
        }
      })(), { destroy: () => {
        u?.parentNode && u?.parentNode.replaceChild(c.dom, u), u?.remove();
      } };
    }
  }), ...a]), await t.waitTimers(Is);
  const r = t.get(zr), i = t.get(Yi), o = Object.fromEntries(t.get(bl)), s = Object.fromEntries(t.get(wl)), l = new ep(n, {
    state: r,
    nodeViews: o,
    markViews: s,
    transformPasted: (a, c, u) => (t.get(si).sort((h, d) => (d.priority ?? 50) - (h.priority ?? 50)).map((h) => h.run).forEach((h) => {
      a = h(a, c, u);
    }), a),
    ...i
  });
  return Qx(l.dom), t.set(It, l), t.done(Gi), () => {
    l?.destroy(), t.remove(Xi).remove(It).remove(Yi).remove(xl).remove(Cl).remove(Is).clearTimer(Gi);
  };
});
Kt(fp, { displayName: "EditorView" });
var eC = class dp {
  constructor() {
    this.#t = !1, this.#e = "Idle", this.#r = [], this.#n = () => {
    }, this.#o = new Fh(), this.#s = new $g(), this.#i = /* @__PURE__ */ new Map(), this.#l = /* @__PURE__ */ new Map(), this.#a = new Fg(this.#o, this.#s), this.#f = () => {
      const e = qx(async (r) => {
        await Promise.all(this.#r.map((i) => Promise.resolve(i(r))));
      }), n = [
        np,
        lp,
        cp,
        ip,
        Jx,
        hp,
        up,
        fp,
        Wx(this),
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
    return new dp();
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
function pp(t, e, n) {
  const r = t.findIndex(([o]) => o === e);
  if (r === -1) return [...t, n];
  const i = t.slice();
  return i[r] = n, i;
}
function U(t, e) {
  const n = Kx(t), r = (i) => async () => {
    r.key = n, await i.wait(Kr);
    const o = e(i);
    return i.get(ne).create(n, o), r.run = (s) => i.get(ne).call(t, s), () => {
      i.get(ne).remove(n);
    };
  };
  return r;
}
function We(t) {
  const e = (n) => async () => {
    await n.wait(Ve);
    const r = t(n);
    return n.update(ii, (i) => [...i, r]), e.inputRule = r, () => {
      n.update(ii, (i) => i.filter((o) => o !== r));
    };
  };
  return e;
}
function tC(t) {
  const e = (n) => async () => {
    await n.wait(Ve);
    const r = t(n);
    return n.update(si, (i) => [...i, r]), e.pasteRule = r, () => {
      n.update(si, (i) => i.filter((o) => o !== r));
    };
  };
  return e;
}
function nC(t, e) {
  const n = (r) => async () => {
    const i = e(r);
    return r.update(Wr, (o) => pp(o, t, [t, i])), n.id = t, n.schema = i, () => {
      r.update(Wr, (o) => o.filter(([s]) => s !== t));
    };
  };
  return n.type = (r) => {
    const i = r.get(jt).marks[t];
    if (!i) throw Lg(t);
    return i;
  }, n;
}
function ga(t, e) {
  const n = (r) => async () => {
    const i = e(r);
    return r.update(qr, (o) => pp(o, t, [t, i])), n.id = t, n.schema = i, () => {
      r.update(qr, (o) => o.filter(([s]) => s !== t));
    };
  };
  return n.type = (r) => {
    const i = r.get(jt).nodes[t];
    if (!i) throw zg(t);
    return i;
  }, n;
}
function Ut(t) {
  let e;
  const n = (r) => async () => (await r.wait(Ve), e = t(r), r.update(Wt, (i) => [...i, e]), () => {
    r.update(Wt, (i) => i.filter((o) => o !== e));
  });
  return n.plugin = () => e, n.key = () => e.spec.key, n;
}
function rC(t) {
  const e = (n) => async () => {
    await n.wait(Ur);
    const r = n.get(po), i = t(n), o = r.addObjectKeymap(i);
    return e.keymap = i, () => {
      o();
    };
  };
  return e;
}
function Jt(t, e) {
  const n = X(t, e), r = (i) => (i.inject(n), () => () => {
    i.remove(n);
  });
  return r.key = n, r;
}
function ke(t, e) {
  const n = Jt(e, t), r = ga(t, (o) => o.get(n.key)(o)), i = [n, r];
  return i.id = r.id, i.node = r, i.type = (o) => r.type(o), i.ctx = n, i.key = n.key, i.extendSchema = (o) => ke(t, o(e)), i;
}
function mr(t, e) {
  const n = Jt(e, t), r = nC(t, (o) => o.get(n.key)(o)), i = [n, r];
  return i.id = r.id, i.mark = r, i.type = (o) => r.type(o), i.ctx = n, i.key = n.key, i.extendSchema = (o) => mr(t, o(e)), i;
}
function nt(t, e) {
  const n = Jt(Object.fromEntries(Object.entries(e).map(([o, { shortcuts: s, priority: l }]) => [o, {
    shortcuts: s,
    priority: l
  }])), `${t}Keymap`), r = rC((o) => {
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
var wt = (t, e = () => ({})) => Jt(e, `${t}Attr`), mi = (t, e = () => ({})) => Jt(e, `${t}Attr`);
function yn(t, e, n) {
  const r = Jt({}, t), i = (s) => async () => {
    await s.wait(Ln);
    const l = {
      plugin: e(s),
      options: s.get(r.key)
    };
    return s.update(oi, (a) => [...a, l]), () => {
      s.update(oi, (a) => a.filter((c) => c !== l));
    };
  }, o = [r, i];
  return o.id = t, o.plugin = i, o.options = r, o;
}
function iC(t, e = !1) {
  return (n) => {
    const r = n.get(It), i = n.get(Jr)(t);
    if (!i) return;
    if (!e) {
      const { state: a } = r;
      return r.dispatch(a.tr.replace(0, a.doc.content.size, new v(i.content, 0, 0)));
    }
    const o = n.get(jt), s = n.get(Ki)({
      schema: o,
      doc: i,
      plugins: n.get(Wt)
    }), l = Tn.create(s);
    r.updateState(l);
  };
}
function oC(t, e) {
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
        let h = M.empty, d = i.index(-1) ? 1 : i.index(-2) ? 2 : 3;
        for (let g = i.depth - d; g >= i.depth - 3; g--)
          h = M.from(i.node(g).copy(h));
        let f = i.indexAfter(-1) < i.node(-2).childCount ? 1 : i.indexAfter(-2) < i.node(-3).childCount ? 2 : 3;
        h = h.append(M.from(t.createAndFill()));
        let p = i.before(i.depth - (d - 1)), m = n.tr.replace(p, i.after(-f), new v(h, 4 - d, 0)), y = -1;
        m.doc.nodesBetween(p, m.doc.content.size, (g, S) => {
          if (y > -1)
            return !1;
          g.isTextblock && g.content.size == 0 && (y = S + 1);
        }), y > -1 && m.setSelection(W.near(m.doc.resolve(y))), r(m.scrollIntoView());
      }
      return !0;
    }
    let a = o.pos == i.end() ? l.contentMatchAt(0).defaultType : null, c = n.tr.delete(i.pos, o.pos), u = a ? [null, { type: a }] : void 0;
    return $r(c.doc, i.pos, 2, u) ? (r && r(c.split(i.pos, 2, u).scrollIntoView()), !0) : !1;
  };
}
function sC(t) {
  return function(e, n) {
    let { $from: r, $to: i } = e.selection, o = r.blockRange(i, (s) => s.childCount > 0 && s.firstChild.type == t);
    return o ? n ? r.node(o.depth - 1).type == t ? lC(e, n, t, o) : aC(e, n, o) : !0 : !1;
  };
}
function lC(t, e, n, r) {
  let i = t.tr, o = r.end, s = r.$to.end(r.depth);
  o < s && (i.step(new ve(o - 1, s, o, s, new v(M.from(n.create(null, r.parent.copy())), 1, 0), 1, !0)), r = new Of(i.doc.resolve(r.$from.pos), i.doc.resolve(s), r.depth));
  const l = Mo(r);
  if (l == null)
    return !1;
  i.lift(r, l);
  let a = i.doc.resolve(i.mapping.map(o, -1) - 1);
  return To(i.doc, a.pos) && a.nodeBefore.type == a.nodeAfter.type && i.join(a.pos), e(i.scrollIntoView()), !0;
}
function aC(t, e, n) {
  let r = t.tr, i = n.parent;
  for (let f = n.end, p = n.endIndex - 1, m = n.startIndex; p > m; p--)
    f -= i.child(p).nodeSize, r.delete(f - 1, f + 1);
  let o = r.doc.resolve(n.start), s = o.nodeAfter;
  if (r.mapping.map(n.end) != n.start + o.nodeAfter.nodeSize)
    return !1;
  let l = n.startIndex == 0, a = n.endIndex == i.childCount, c = o.node(-1), u = o.index(-1);
  if (!c.canReplace(u + (l ? 0 : 1), u + 1, s.content.append(a ? M.empty : M.from(i))))
    return !1;
  let h = o.pos, d = h + s.nodeSize;
  return r.step(new ve(h - (l ? 1 : 0), d + (a ? 1 : 0), h + 1, d - 1, new v((l ? M.empty : M.from(i.copy(M.empty))).append(a ? M.empty : M.from(i.copy(M.empty))), l ? 0 : 1, a ? 0 : 1), l ? 0 : 1)), e(r.scrollIntoView()), !0;
}
function cC(t) {
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
      let c = a.lastChild && a.lastChild.type == l.type, u = M.from(c ? t.create() : null), h = new v(M.from(t.create(null, M.from(l.type.create(null, u)))), c ? 3 : 1, 0), d = o.start, f = o.end;
      n(e.tr.step(new ve(d - (c ? 3 : 1), f, d, f, h, 1, !0)).scrollIntoView());
    }
    return !0;
  };
}
function uC(t) {
  const e = /* @__PURE__ */ new Map();
  if (!t || !t.type)
    throw new Error("mdast-util-definitions expected node");
  return fr(t, "definition", function(r) {
    const i = oh(r.identifier);
    i && !e.get(i) && e.set(i, r);
  }), n;
  function n(r) {
    const i = oh(r);
    return e.get(i);
  }
}
function oh(t) {
  return String(t || "").toUpperCase();
}
function hC() {
  return function(t) {
    const e = uC(t);
    fr(t, function(n, r, i) {
      if (n.type === "definition" && i !== void 0 && typeof r == "number")
        return i.children.splice(r, 1), [no, r];
      if (n.type === "imageReference" || n.type === "linkReference") {
        const o = e(n.identifier);
        if (o && i && typeof r == "number")
          return i.children[r] = n.type === "imageReference" ? { type: "image", url: o.url, title: o.title, alt: n.alt } : {
            type: "link",
            url: o.url,
            title: o.title,
            children: n.children
          }, [no, r];
      }
    });
  };
}
function fC(t) {
  const e = { ...t };
  return e.position && (e.position = {
    start: { ...e.position.start },
    end: { ...e.position.end }
  }), delete e.children, e;
}
var dC = "<br />", pC = /^<br\s*\/?\s*>$/i, mC = (t) => typeof t == "string" && pC.test(t.trim());
function mp(t, e) {
  if (!(e.childCount >= 1 && e.lastChild?.type.name === "hardbreak")) {
    t.next(e.content);
    return;
  }
  const n = [];
  e.content.forEach((r, i, o) => {
    o !== e.childCount - 1 && n.push(r);
  }), t.next(M.fromArray(n));
}
function I(t, e) {
  return Object.assign(t, { meta: {
    package: "@milkdown/preset-commonmark",
    ...e
  } }), t;
}
var ya = mi("emphasis");
I(ya, {
  displayName: "Attr<emphasis>",
  group: "Emphasis"
});
var gr = mr("emphasis", (t) => ({
  attrs: { marker: {
    default: t.get(jr).emphasis || "*",
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
  toDOM: (e) => ["em", t.get(ya.key)(e)],
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
I(gr.mark, {
  displayName: "MarkSchema<emphasis>",
  group: "Emphasis"
});
I(gr.ctx, {
  displayName: "MarkSchemaCtx<emphasis>",
  group: "Emphasis"
});
var ka = U("ToggleEmphasis", (t) => () => vo(gr.type(t)));
I(ka, {
  displayName: "Command<toggleEmphasisCommand>",
  group: "Emphasis"
});
var gp = We((t) => ui(/(?:^|[^*])\*([^*]+)\*$/, gr.type(t), {
  getAttr: () => ({ marker: "*" }),
  updateCaptured: ({ fullMatch: e, start: n }) => e.startsWith("*") ? {} : {
    fullMatch: e.slice(1),
    start: n + 1
  }
}));
I(gp, {
  displayName: "InputRule<emphasis>|Star",
  group: "Emphasis"
});
var yp = We((t) => ui(/\b_(?![_\s])(.*?[^_\s])_$/, gr.type(t), {
  getAttr: () => ({ marker: "_" }),
  updateCaptured: ({ fullMatch: e, start: n }) => e.startsWith("_") ? {} : {
    fullMatch: e.slice(1),
    start: n + 1
  }
}));
I(yp, {
  displayName: "InputRule<emphasis>|Underscore",
  group: "Emphasis"
});
var ba = nt("emphasisKeymap", { ToggleEmphasis: {
  shortcuts: "Mod-i",
  command: (t) => {
    const e = t.get(ne);
    return () => e.call(ka.key);
  }
} });
I(ba.ctx, {
  displayName: "KeymapCtx<emphasis>",
  group: "Emphasis"
});
I(ba.shortcuts, {
  displayName: "Keymap<emphasis>",
  group: "Emphasis"
});
var wa = mi("strong");
I(wa, {
  displayName: "Attr<strong>",
  group: "Strong"
});
var gi = mr("strong", (t) => ({
  attrs: { marker: {
    default: t.get(jr).strong || "*",
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
  toDOM: (e) => ["strong", t.get(wa.key)(e)],
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
I(gi.mark, {
  displayName: "MarkSchema<strong>",
  group: "Strong"
});
I(gi.ctx, {
  displayName: "MarkSchemaCtx<strong>",
  group: "Strong"
});
var xa = U("ToggleStrong", (t) => () => vo(gi.type(t)));
I(xa, {
  displayName: "Command<toggleStrongCommand>",
  group: "Strong"
});
var kp = We((t) => ui(/(?<![\w:/])(?:\*\*|__)([^*_]+?)(?:\*\*|__)(?![\w/])$/, gi.type(t), { getAttr: (e) => ({ marker: e[0].startsWith("*") ? "*" : "_" }) }));
I(kp, {
  displayName: "InputRule<strong>",
  group: "Strong"
});
var Ca = nt("strongKeymap", { ToggleBold: {
  shortcuts: ["Mod-b"],
  command: (t) => {
    const e = t.get(ne);
    return () => e.call(xa.key);
  }
} });
I(Ca.ctx, {
  displayName: "KeymapCtx<strong>",
  group: "Strong"
});
I(Ca.shortcuts, {
  displayName: "Keymap<strong>",
  group: "Strong"
});
var Sa = mi("inlineCode");
I(Sa, {
  displayName: "Attr<inlineCode>",
  group: "InlineCode"
});
var ln = mr("inlineCode", (t) => ({
  priority: 100,
  code: !0,
  inclusive: !1,
  parseDOM: [{ tag: "code" }],
  toDOM: (e) => ["code", t.get(Sa.key)(e)],
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
I(ln.mark, {
  displayName: "MarkSchema<inlineCode>",
  group: "InlineCode"
});
I(ln.ctx, {
  displayName: "MarkSchemaCtx<inlineCode>",
  group: "InlineCode"
});
var Na = U("ToggleInlineCode", (t) => () => (e, n) => {
  const { selection: r, tr: i } = e;
  if (r.empty) return !1;
  const { from: o, to: s } = r;
  return e.doc.rangeHasMark(o, s, ln.type(t)) ? (n?.(i.removeMark(o, s, ln.type(t))), !0) : (Object.keys(e.schema.marks).filter((l) => l !== ln.type.name).map((l) => e.schema.marks[l]).forEach((l) => {
    i.removeMark(o, s, l);
  }), n?.(i.addMark(o, s, ln.type(t).create())), !0);
});
I(Na, {
  displayName: "Command<toggleInlineCodeCommand>",
  group: "InlineCode"
});
var bp = We((t) => ui(/(?:`)([^`]+)(?:`)$/, ln.type(t)));
I(bp, {
  displayName: "InputRule<inlineCodeInputRule>",
  group: "InlineCode"
});
var Ia = nt("inlineCodeKeymap", { ToggleInlineCode: {
  shortcuts: "Mod-e",
  command: (t) => {
    const e = t.get(ne);
    return () => e.call(Na.key);
  }
} });
I(Ia.ctx, {
  displayName: "KeymapCtx<inlineCode>",
  group: "InlineCode"
});
I(Ia.shortcuts, {
  displayName: "Keymap<inlineCode>",
  group: "InlineCode"
});
var gC = /* @__PURE__ */ new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
  "ftp:"
]);
function yC(t) {
  return t <= 32 || t >= 127 && t <= 160 || t >= 8203 && t <= 8205 || t === 8232 || t === 8233 || t === 65279;
}
function kC(t) {
  let e = "";
  for (const n of t) yC(n.codePointAt(0) ?? 0) || (e += n);
  return e;
}
function bC(t) {
  if (typeof t != "string") return "";
  const e = t.trim();
  if (!e) return "";
  const n = kC(e), r = /^([a-z][a-z0-9+.-]*):/i.exec(n)?.[1];
  return !r || gC.has(`${r.toLowerCase()}:`) ? e : "";
}
var Ma = mi("link");
I(Ma, {
  displayName: "Attr<link>",
  group: "Link"
});
var rr = mr("link", (t) => ({
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
      if (!(e instanceof HTMLElement)) throw Et(e);
      return {
        href: e.getAttribute("href"),
        title: e.getAttribute("title")
      };
    }
  }],
  toDOM: (e) => ["a", {
    ...t.get(Ma.key)(e),
    ...e.attrs,
    href: bC(e.attrs.href)
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
I(rr.mark, {
  displayName: "MarkSchema<link>",
  group: "Link"
});
var wp = U("ToggleLink", (t) => (e = {}) => vo(rr.type(t), e));
I(wp, {
  displayName: "Command<toggleLinkCommand>",
  group: "Link"
});
var xp = U("UpdateLink", (t) => (e = {}) => (n, r) => {
  if (!r) return !1;
  let i, o = -1;
  const { selection: s } = n, { from: l, to: a } = s;
  if (n.doc.nodesBetween(l, l === a ? a + 1 : a, (p, m) => {
    if (rr.type(t).isInSet(p.marks))
      return i = p, o = m, !1;
  }), !i) return !1;
  const c = i.marks.find(({ type: p }) => p === rr.type(t));
  if (!c) return !1;
  const u = o, h = o + i.nodeSize, { tr: d } = n, f = rr.type(t).create({
    ...c.attrs,
    ...e
  });
  return f ? (r(d.removeMark(u, h, c).addMark(u, h, f).setSelection(new K(d.selection.$anchor)).scrollIntoView()), !0) : !1;
});
I(xp, {
  displayName: "Command<updateLinkCommand>",
  group: "Link"
});
var Cp = ga("doc", () => ({
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
I(Cp, {
  displayName: "NodeSchema<doc>",
  group: "Doc"
});
var Sp = Object.freeze([
  "root",
  "blockquote",
  "listItem",
  "footnoteDefinition"
]), wC = /* @__PURE__ */ new Set([
  "paragraph",
  "heading",
  "tableCell",
  "link",
  "linkReference",
  "emphasis",
  "strong",
  "delete",
  "footnote"
]), mo = Jt(Sp, "blockContainerTypes");
I(mo, {
  displayName: "Ctx<blockContainerTypes>",
  group: "Remark"
});
var sh = /* @__PURE__ */ new Set();
function Np(t) {
  const e = t.isInjected(mo.key) ? t.get(mo.key) : Sp, n = /* @__PURE__ */ new Set();
  for (const r of e) {
    if (wC.has(r)) {
      sh.has(r) || (sh.add(r), console.warn(`[milkdown/preset-commonmark] "${r}" holds phrasing content and cannot be a block container; it is ignored in blockContainerTypes.`));
      continue;
    }
    n.add(r);
  }
  return n;
}
var xC = /* @__PURE__ */ new Set(["paragraph", "tableCell"]);
function CC(t, e) {
  return Wl(t, (n) => n.type === "html" && mC(n.value), (n, r) => {
    const i = r[r.length - 1];
    if (i) {
      if (xC.has(i.type)) {
        i.children.length === 1 && (i.children = []);
        return;
      }
      if (e.has(i.type)) {
        const o = n;
        return o.children = [], delete o.value, o.type = "paragraph", no;
      }
    }
  });
}
var zo = yn("remark-preserve-empty-line", (t) => () => (e) => CC(e, Np(t)));
I(zo.plugin, {
  displayName: "Remark<remarkPreserveEmptyLine>",
  group: "Remark"
});
I(zo.options, {
  displayName: "RemarkConfig<remarkPreserveEmptyLine>",
  group: "Remark"
});
var Ta = wt("paragraph");
I(Ta, {
  displayName: "Attr<paragraph>",
  group: "Paragraph"
});
var At = ke("paragraph", (t) => ({
  content: "inline*",
  group: "block",
  parseDOM: [{ tag: "p" }],
  toDOM: (e) => [
    "p",
    t.get(Ta.key)(e),
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
      e.openNode("paragraph"), (!n.content || n.content.size === 0) && SC(t) ? e.addNode("html", void 0, dC) : mp(e, n), e.closeNode();
    }
  }
}));
function SC(t) {
  return t.isInjected(zo.options.key);
}
I(At.node, {
  displayName: "NodeSchema<paragraph>",
  group: "Paragraph"
});
I(At.ctx, {
  displayName: "NodeSchemaCtx<paragraph>",
  group: "Paragraph"
});
var Aa = U("TurnIntoText", (t) => () => ei(At.type(t)));
I(Aa, {
  displayName: "Command<turnIntoTextCommand>",
  group: "Paragraph"
});
var Ea = nt("paragraphKeymap", { TurnIntoText: {
  shortcuts: "Mod-Alt-0",
  command: (t) => {
    const e = t.get(ne);
    return () => e.call(Aa.key);
  }
} });
I(Ea.ctx, {
  displayName: "KeymapCtx<paragraph>",
  group: "Paragraph"
});
I(Ea.shortcuts, {
  displayName: "Keymap<paragraph>",
  group: "Paragraph"
});
var NC = Array(6).fill(0).map((t, e) => e + 1);
function IC(t) {
  return t.textContent.toLowerCase().trim().replace(/\s+/g, "-");
}
var Lo = Jt(IC, "headingIdGenerator");
I(Lo, {
  displayName: "Ctx<HeadingIdGenerator>",
  group: "Heading"
});
var va = wt("heading");
I(va, {
  displayName: "Attr<heading>",
  group: "Heading"
});
var jn = ke("heading", (t) => {
  const e = t.get(Lo.key);
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
    parseDOM: NC.map((n) => ({
      tag: `h${n}`,
      getAttrs: (r) => {
        if (!(r instanceof HTMLElement)) throw Et(r);
        return {
          level: n,
          id: r.id
        };
      }
    })),
    toDOM: (n) => [
      `h${n.attrs.level}`,
      {
        ...t.get(va.key)(n),
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
        n.openNode("heading", void 0, { depth: r.attrs.level }), mp(n, r), n.closeNode();
      }
    }
  };
});
I(jn.node, {
  displayName: "NodeSchema<heading>",
  group: "Heading"
});
I(jn.ctx, {
  displayName: "NodeSchemaCtx<heading>",
  group: "Heading"
});
var Ip = We((t) => cd(/^(?<hashes>#+)\s$/, jn.type(t), (e) => {
  const n = e.groups?.hashes?.length || 0, { $from: r } = t.get(It).state.selection, i = r.node();
  if (i.type.name === "heading") {
    let o = Number(i.attrs.level) + Number(n);
    return o > 6 && (o = 6), { level: o };
  }
  return { level: n };
}));
I(Ip, {
  displayName: "InputRule<wrapInHeadingInputRule>",
  group: "Heading"
});
var nn = U("WrapInHeading", (t) => (e) => (e ??= 1, e < 1 ? ei(At.type(t)) : ei(jn.type(t), { level: e })));
I(nn, {
  displayName: "Command<wrapInHeadingCommand>",
  group: "Heading"
});
var Oa = U("DowngradeHeading", (t) => () => (e, n, r) => {
  const { $from: i } = e.selection, o = i.node();
  if (o.type !== jn.type(t) || !e.selection.empty || i.parentOffset !== 0) return !1;
  const s = o.attrs.level - 1;
  return s ? (n?.(e.tr.setNodeMarkup(e.selection.$from.before(), void 0, {
    ...o.attrs,
    level: s
  })), !0) : ei(At.type(t))(e, n, r);
});
I(Oa, {
  displayName: "Command<downgradeHeadingCommand>",
  group: "Heading"
});
var Da = nt("headingKeymap", {
  TurnIntoH1: {
    shortcuts: "Mod-Alt-1",
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(nn.key, 1);
    }
  },
  TurnIntoH2: {
    shortcuts: "Mod-Alt-2",
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(nn.key, 2);
    }
  },
  TurnIntoH3: {
    shortcuts: "Mod-Alt-3",
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(nn.key, 3);
    }
  },
  TurnIntoH4: {
    shortcuts: "Mod-Alt-4",
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(nn.key, 4);
    }
  },
  TurnIntoH5: {
    shortcuts: "Mod-Alt-5",
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(nn.key, 5);
    }
  },
  TurnIntoH6: {
    shortcuts: "Mod-Alt-6",
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(nn.key, 6);
    }
  },
  DowngradeHeading: {
    shortcuts: ["Delete", "Backspace"],
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(Oa.key);
    }
  }
});
I(Da.ctx, {
  displayName: "KeymapCtx<heading>",
  group: "Heading"
});
I(Da.shortcuts, {
  displayName: "Keymap<heading>",
  group: "Heading"
});
var Ra = wt("blockquote");
I(Ra, {
  displayName: "Attr<blockquote>",
  group: "Blockquote"
});
var yi = ke("blockquote", (t) => ({
  content: "block+",
  group: "block",
  defining: !0,
  parseDOM: [{ tag: "blockquote" }],
  toDOM: (e) => [
    "blockquote",
    t.get(Ra.key)(e),
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
I(yi.node, {
  displayName: "NodeSchema<blockquote>",
  group: "Blockquote"
});
I(yi.ctx, {
  displayName: "NodeSchemaCtx<blockquote>",
  group: "Blockquote"
});
var Mp = We((t) => oa(/^\s*>\s$/, yi.type(t)));
I(Mp, {
  displayName: "InputRule<wrapInBlockquoteInputRule>",
  group: "Blockquote"
});
var za = U("WrapInBlockquote", (t) => () => ia(yi.type(t)));
I(za, {
  displayName: "Command<wrapInBlockquoteCommand>",
  group: "Blockquote"
});
var La = nt("blockquoteKeymap", { WrapInBlockquote: {
  shortcuts: "Mod-Shift-b",
  command: (t) => {
    const e = t.get(ne);
    return () => e.call(za.key);
  }
} });
I(La.ctx, {
  displayName: "KeymapCtx<blockquote>",
  group: "Blockquote"
});
I(La.shortcuts, {
  displayName: "Keymap<blockquote>",
  group: "Blockquote"
});
var Pa = wt("codeBlock", () => ({
  pre: {},
  code: {}
}));
I(Pa, {
  displayName: "Attr<codeBlock>",
  group: "CodeBlock"
});
var ki = ke("code_block", (t) => ({
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
      if (!(e instanceof HTMLElement)) throw Et(e);
      return { language: e.dataset.language };
    }
  }],
  toDOM: (e) => {
    const n = t.get(Pa.key)(e), r = e.attrs.language, i = r && r.length > 0 ? { "data-language": r } : void 0;
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
I(ki.node, {
  displayName: "NodeSchema<codeBlock>",
  group: "CodeBlock"
});
I(ki.ctx, {
  displayName: "NodeSchemaCtx<codeBlock>",
  group: "CodeBlock"
});
var Tp = We((t) => cd(/^```(?<language>[a-z]*)?[\s\n]$/, ki.type(t), (e) => ({ language: e.groups?.language ?? "" })));
I(Tp, {
  displayName: "InputRule<createCodeBlockInputRule>",
  group: "CodeBlock"
});
var Ba = U("CreateCodeBlock", (t) => (e = "") => ei(ki.type(t), { language: e }));
I(Ba, {
  displayName: "Command<createCodeBlockCommand>",
  group: "CodeBlock"
});
var MC = U("UpdateCodeBlockLanguage", () => ({ pos: t, language: e } = {
  pos: -1,
  language: ""
}) => (n, r) => t >= 0 ? (r?.(n.tr.setNodeAttribute(t, "language", e)), !0) : !1);
I(MC, {
  displayName: "Command<updateCodeBlockLanguageCommand>",
  group: "CodeBlock"
});
var _a = nt("codeBlockKeymap", { CreateCodeBlock: {
  shortcuts: "Mod-Alt-c",
  command: (t) => {
    const e = t.get(ne);
    return () => e.call(Ba.key);
  }
} });
I(_a.ctx, {
  displayName: "KeymapCtx<codeBlock>",
  group: "CodeBlock"
});
I(_a.shortcuts, {
  displayName: "Keymap<codeBlock>",
  group: "CodeBlock"
});
var Fa = wt("image");
I(Fa, {
  displayName: "Attr<image>",
  group: "Image"
});
var yr = ke("image", (t) => ({
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
      if (!(e instanceof HTMLElement)) throw Et(e);
      return {
        src: e.getAttribute("src") || "",
        alt: e.getAttribute("alt") || "",
        title: e.getAttribute("title") || e.getAttribute("alt") || ""
      };
    }
  }],
  toDOM: (e) => ["img", {
    ...t.get(Fa.key)(e),
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
I(yr.node, {
  displayName: "NodeSchema<image>",
  group: "Image"
});
I(yr.ctx, {
  displayName: "NodeSchemaCtx<image>",
  group: "Image"
});
var Ap = U("InsertImage", (t) => (e = {}) => (n, r) => {
  if (!r) return !0;
  const { src: i = "", alt: o = "", title: s = "" } = e, l = yr.type(t).create({
    src: i,
    alt: o,
    title: s
  });
  return l && r(n.tr.replaceSelectionWith(l).scrollIntoView()), !0;
});
I(Ap, {
  displayName: "Command<insertImageCommand>",
  group: "Image"
});
var Ep = U("UpdateImage", (t) => (e = {}) => (n, r) => {
  const i = U1(n.selection, yr.type(t));
  if (!i) return !1;
  const { node: o, pos: s } = i, l = { ...o.attrs }, { src: a, alt: c, title: u } = e;
  return a !== void 0 && (l.src = a), c !== void 0 && (l.alt = c), u !== void 0 && (l.title = u), r?.(n.tr.setNodeMarkup(s, void 0, l).scrollIntoView()), !0;
});
I(Ep, {
  displayName: "Command<updateImageCommand>",
  group: "Image"
});
var TC = We((t) => new tt(/!\[(?<alt>.*?)]\((?<filename>.*?)\s*(?="|\))"?(?<title>[^"]+)?"?\)/, (e, n, r, i) => {
  const [o, s, l = "", a] = n;
  return o ? e.tr.replaceWith(r, i, yr.type(t).create({
    src: l,
    alt: s,
    title: a
  })) : null;
}));
I(TC, {
  displayName: "InputRule<insertImageInputRule>",
  group: "Image"
});
var go = wt("hardbreak", (t) => ({
  "data-type": "hardbreak",
  "data-is-inline": t.attrs.isInline
}));
I(go, {
  displayName: "Attr<hardbreak>",
  group: "Hardbreak"
});
var Pn = ke("hardbreak", (t) => ({
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
    t.get(go.key)(e),
    " "
  ] : ["br", t.get(go.key)(e)],
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
I(Pn.node, {
  displayName: "NodeSchema<hardbreak>",
  group: "Hardbreak"
});
I(Pn.ctx, {
  displayName: "NodeSchemaCtx<hardbreak>",
  group: "Hardbreak"
});
var $a = U("InsertHardbreak", (t) => () => (e, n) => {
  const { selection: r, tr: i } = e;
  if (!(r instanceof K)) return !1;
  if (r.empty) {
    const o = r.$from.node();
    if (o.childCount > 0 && o.lastChild?.type.name === "hardbreak")
      return n?.(i.replaceRangeWith(r.to - 1, r.to, e.schema.node("paragraph")).setSelection(W.near(i.doc.resolve(r.to))).scrollIntoView()), !0;
  }
  return n?.(i.setMeta("hardbreak", !0).replaceSelectionWith(Pn.type(t).create()).scrollIntoView()), !0;
});
I($a, {
  displayName: "Command<insertHardbreakCommand>",
  group: "Hardbreak"
});
var Va = nt("hardbreakKeymap", { InsertHardbreak: {
  shortcuts: "Shift-Enter",
  command: (t) => {
    const e = t.get(ne);
    return () => e.call($a.key);
  }
} });
I(Va.ctx, {
  displayName: "KeymapCtx<hardbreak>",
  group: "Hardbreak"
});
I(Va.shortcuts, {
  displayName: "Keymap<hardbreak>",
  group: "Hardbreak"
});
var Ha = wt("hr");
I(Ha, {
  displayName: "Attr<hr>",
  group: "Hr"
});
var bi = ke("hr", (t) => ({
  group: "block",
  parseDOM: [{ tag: "hr" }],
  toDOM: (e) => ["hr", t.get(Ha.key)(e)],
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
I(bi.node, {
  displayName: "NodeSchema<hr>",
  group: "Hr"
});
I(bi.ctx, {
  displayName: "NodeSchemaCtx<hr>",
  group: "Hr"
});
var vp = We((t) => new tt(/^(?:---|___\s|\*\*\*\s)$/, (e, n, r, i) => {
  const { tr: o } = e;
  return n[0] && o.replaceWith(r - 1, i, bi.type(t).create()), o;
}));
I(vp, {
  displayName: "InputRule<insertHrInputRule>",
  group: "Hr"
});
var Op = U("InsertHr", (t) => () => (e, n) => {
  if (!n) return !0;
  const r = At.node.type(t).create(), { tr: i, selection: o } = e, { from: s } = o, l = bi.type(t).create();
  if (!l) return !0;
  const a = i.replaceSelectionWith(l).insert(s, r), c = W.findFrom(a.doc.resolve(s), 1, !0);
  return c && n(a.setSelection(c).scrollIntoView()), !0;
});
I(Op, {
  displayName: "Command<insertHrCommand>",
  group: "Hr"
});
var ja = wt("bulletList");
I(ja, {
  displayName: "Attr<bulletList>",
  group: "BulletList"
});
var kr = ke("bullet_list", (t) => ({
  content: "listItem+",
  group: "block",
  attrs: { spread: {
    default: !1,
    validate: "boolean"
  } },
  parseDOM: [{
    tag: "ul",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw Et(e);
      return { spread: e.dataset.spread === "true" };
    }
  }],
  toDOM: (e) => [
    "ul",
    {
      ...t.get(ja.key)(e),
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
I(kr.node, {
  displayName: "NodeSchema<bulletList>",
  group: "BulletList"
});
I(kr.ctx, {
  displayName: "NodeSchemaCtx<bulletList>",
  group: "BulletList"
});
var Dp = We((t) => oa(/^\s*([-+*])\s$/, kr.type(t)));
I(Dp, {
  displayName: "InputRule<wrapInBulletListInputRule>",
  group: "BulletList"
});
var qa = U("WrapInBulletList", (t) => () => ia(kr.type(t)));
I(qa, {
  displayName: "Command<wrapInBulletListCommand>",
  group: "BulletList"
});
var Wa = nt("bulletListKeymap", { WrapInBulletList: {
  shortcuts: "Mod-Alt-8",
  command: (t) => {
    const e = t.get(ne);
    return () => e.call(qa.key);
  }
} });
I(Wa.ctx, {
  displayName: "KeymapCtx<bulletListKeymap>",
  group: "BulletList"
});
I(Wa.shortcuts, {
  displayName: "Keymap<bulletListKeymap>",
  group: "BulletList"
});
var Ka = wt("orderedList");
I(Ka, {
  displayName: "Attr<orderedList>",
  group: "OrderedList"
});
var br = ke("ordered_list", (t) => ({
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
      if (!(e instanceof HTMLElement)) throw Et(e);
      return {
        spread: e.dataset.spread === "true",
        order: e.hasAttribute("start") ? Number(e.getAttribute("start")) : 1
      };
    }
  }],
  toDOM: (e) => [
    "ol",
    {
      ...t.get(Ka.key)(e),
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
I(br.node, {
  displayName: "NodeSchema<orderedList>",
  group: "OrderedList"
});
I(br.ctx, {
  displayName: "NodeSchemaCtx<orderedList>",
  group: "OrderedList"
});
var Rp = We((t) => oa(/^\s*(\d+)\.\s$/, br.type(t), (e) => ({ order: Number(e[1]) }), (e, n) => n.childCount + n.attrs.order === Number(e[1])));
I(Rp, {
  displayName: "InputRule<wrapInOrderedListInputRule>",
  group: "OrderedList"
});
var Ua = U("WrapInOrderedList", (t) => () => ia(br.type(t)));
I(Ua, {
  displayName: "Command<wrapInOrderedListCommand>",
  group: "OrderedList"
});
var Ja = nt("orderedListKeymap", { WrapInOrderedList: {
  shortcuts: "Mod-Alt-7",
  command: (t) => {
    const e = t.get(ne);
    return () => e.call(Ua.key);
  }
} });
I(Ja.ctx, {
  displayName: "KeymapCtx<orderedList>",
  group: "OrderedList"
});
I(Ja.shortcuts, {
  displayName: "Keymap<orderedList>",
  group: "OrderedList"
});
var Ga = wt("listItem");
I(Ga, {
  displayName: "Attr<listItem>",
  group: "ListItem"
});
var Gt = ke("list_item", (t) => ({
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
      if (!(e instanceof HTMLElement)) throw Et(e);
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
      ...t.get(Ga.key)(e),
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
I(Gt.node, {
  displayName: "NodeSchema<listItem>",
  group: "ListItem"
});
I(Gt.ctx, {
  displayName: "NodeSchemaCtx<listItem>",
  group: "ListItem"
});
var Ya = U("SinkListItem", (t) => () => cC(Gt.type(t)));
I(Ya, {
  displayName: "Command<sinkListItemCommand>",
  group: "ListItem"
});
var Xa = U("LiftListItem", (t) => () => sC(Gt.type(t)));
I(Xa, {
  displayName: "Command<liftListItemCommand>",
  group: "ListItem"
});
var Qa = U("SplitListItem", (t) => () => oC(Gt.type(t)));
I(Qa, {
  displayName: "Command<splitListItemCommand>",
  group: "ListItem"
});
function AC(t) {
  return (e, n, r) => {
    const { selection: i } = e;
    if (!(i instanceof K)) return !1;
    const { empty: o, $from: s } = i;
    return !o || s.parentOffset !== 0 || s.node(-1).type !== Gt.type(t) ? !1 : rd(e, n, r);
  };
}
var Za = U("LiftFirstListItem", (t) => () => AC(t));
I(Za, {
  displayName: "Command<liftFirstListItemCommand>",
  group: "ListItem"
});
var ec = nt("listItemKeymap", {
  NextListItem: {
    shortcuts: "Enter",
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(Qa.key);
    }
  },
  SinkListItem: {
    shortcuts: ["Tab", "Mod-]"],
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(Ya.key);
    }
  },
  LiftListItem: {
    shortcuts: ["Shift-Tab", "Mod-["],
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(Xa.key);
    }
  },
  LiftFirstListItem: {
    shortcuts: ["Backspace", "Delete"],
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(Za.key);
    }
  }
});
I(ec.ctx, {
  displayName: "KeymapCtx<listItem>",
  group: "ListItem"
});
I(ec.shortcuts, {
  displayName: "Keymap<listItem>",
  group: "ListItem"
});
var zp = ga("text", () => ({
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
I(zp, {
  displayName: "NodeSchema<text>",
  group: "Text"
});
var tc = wt("html");
I(tc, {
  displayName: "Attr<html>",
  group: "Html"
});
var nc = ke("html", (t) => ({
  atom: !0,
  group: "inline",
  inline: !0,
  attrs: { value: {
    default: "",
    validate: "string"
  } },
  toDOM: (e) => {
    const n = document.createElement("span"), r = {
      ...t.get(tc.key)(e),
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
I(nc.node, {
  displayName: "NodeSchema<html>",
  group: "Html"
});
I(nc.ctx, {
  displayName: "NodeSchemaCtx<html>",
  group: "Html"
});
var EC = [
  Cp,
  Ta,
  At,
  Lo,
  va,
  jn,
  go,
  Pn,
  Ra,
  yi,
  Pa,
  ki,
  Ha,
  bi,
  Fa,
  yr,
  ja,
  kr,
  Ka,
  br,
  Ga,
  Gt,
  ya,
  gr,
  wa,
  gi,
  Sa,
  ln,
  Ma,
  rr,
  tc,
  nc,
  zp
].flat(), vC = [
  Mp,
  Dp,
  Rp,
  Tp,
  vp,
  Ip
].flat(), OC = [
  gp,
  yp,
  bp,
  kp
], DC = U("IsMarkSelected", () => (t) => (e) => {
  if (!t) return !1;
  const { doc: n, selection: r } = e;
  return n.rangeHasMark(r.from, r.to, t);
}), RC = U("IsNoteSelected", () => (t) => (e) => t ? J1(e, t).hasNode : !1), zC = U("ClearTextInCurrentBlock", () => () => (t, e) => {
  let n = t.tr;
  const { $from: r, $to: i } = n.selection, { pos: o } = r, { pos: s } = i, l = o - r.node().content.size;
  return l < 0 ? !1 : (n = n.deleteRange(l, s), e?.(n), !0);
}), LC = U("SetBlockType", () => (t) => (e, n) => {
  const { nodeType: r, attrs: i = null } = t ?? {};
  if (!r) return !1;
  const o = e.tr, { from: s, to: l } = o.selection;
  try {
    o.setBlockType(s, l, r, i);
  } catch {
    return !1;
  }
  return n?.(o), !0;
}), PC = U("WrapInBlockType", () => (t) => (e, n) => {
  const { nodeType: r, attrs: i = null } = t ?? {};
  if (!r) return !1;
  let o = e.tr;
  try {
    const { $from: s, $to: l } = o.selection, a = s.blockRange(l), c = a && Zl(a, r, i);
    if (!c) return !1;
    o = o.wrap(a, c);
  } catch {
    return !1;
  }
  return n?.(o), !0;
}), BC = U("AddBlockType", () => (t) => (e, n) => {
  const { nodeType: r, attrs: i = null } = t ?? {};
  if (!r) return !1;
  const o = e.tr;
  try {
    const s = r instanceof lt ? r : r.createAndFill(i);
    if (!s) return !1;
    o.replaceSelectionWith(s);
  } catch {
    return !1;
  }
  return n?.(o), !0;
}), _C = U("SelectTextNearPos", () => (t) => (e, n) => {
  const { pos: r } = t ?? {};
  if (r == null) return !1;
  const i = (s, l, a) => Math.min(Math.max(s, l), a), o = e.tr;
  try {
    const s = e.doc.resolve(i(r, 0, e.doc.content.size));
    o.setSelection(K.near(s));
  } catch {
    return !1;
  }
  return n?.(o.scrollIntoView()), !0;
}), FC = [
  Aa,
  za,
  nn,
  Oa,
  Ba,
  $a,
  Op,
  Ap,
  Ep,
  Ua,
  qa,
  Ya,
  Qa,
  Xa,
  Za,
  ka,
  Na,
  xa,
  wp,
  xp,
  DC,
  RC,
  zC,
  LC,
  PC,
  BC,
  _C
], $C = [
  La,
  _a,
  Va,
  Da,
  ec,
  Ja,
  Wa,
  Ea,
  ba,
  Ia,
  Ca
].flat(), rc = yn("remarkAddOrderInList", () => () => (t) => {
  fr(t, "list", (e) => {
    if (e.ordered) {
      const n = e.start ?? 1;
      e.children.forEach((r, i) => {
        r.label = i + n;
      });
    }
  });
});
I(rc.plugin, {
  displayName: "Remark<remarkAddOrderInListPlugin>",
  group: "Remark"
});
I(rc.options, {
  displayName: "RemarkConfig<remarkAddOrderInListPlugin>",
  group: "Remark"
});
var ic = yn("remarkLineBreak", () => () => (t) => {
  const e = /[\t ]*(?:\r?\n|\r)/g;
  fr(t, "text", (n, r, i) => {
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
I(ic.plugin, {
  displayName: "Remark<remarkLineBreak>",
  group: "Remark"
});
I(ic.options, {
  displayName: "RemarkConfig<remarkLineBreak>",
  group: "Remark"
});
var oc = yn("remarkInlineLink", () => hC);
I(oc.plugin, {
  displayName: "Remark<remarkInlineLinkPlugin>",
  group: "Remark"
});
I(oc.options, {
  displayName: "RemarkConfig<remarkInlineLinkPlugin>",
  group: "Remark"
});
var VC = (t) => !!t.children, HC = (t) => t.type === "html";
function jC(t, e) {
  return n(t, 0, null)[0];
  function n(r, i, o) {
    if (VC(r)) {
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
var sc = yn("remarkHTMLTransformer", (t) => () => (e) => {
  const n = Np(t);
  jC(e, (r, i, o) => HC(r) ? (o && n.has(o.type) && (r.children = [fC(r)], delete r.value, r.type = "paragraph"), [r]) : [r]);
});
I(sc.plugin, {
  displayName: "Remark<remarkHtmlTransformer>",
  group: "Remark"
});
I(sc.options, {
  displayName: "RemarkConfig<remarkHtmlTransformer>",
  group: "Remark"
});
var lc = yn("remarkMarker", () => () => (t, e) => {
  const n = (r) => e.value.charAt(r.position.start.offset);
  fr(t, (r) => ["strong", "emphasis"].includes(r.type), (r) => {
    r.marker = n(r);
  });
});
I(lc.plugin, {
  displayName: "Remark<remarkMarker>",
  group: "Remark"
});
I(lc.options, {
  displayName: "RemarkConfig<remarkMarker>",
  group: "Remark"
});
var Lp = Ut(() => {
  let t = !1;
  const e = new qe("MILKDOWN_INLINE_NODES_CURSOR"), n = new je({
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
          const i = r.selection.$from.pos, o = document.createElement("span"), s = Me.widget(i, o, { side: -1 }), l = document.createElement("span"), a = Me.widget(i, l);
          return setTimeout(() => {
            o.contentEditable = "true", l.contentEditable = "true";
          }), ce.create(r.doc, [s, a]);
        }
        return ce.empty;
      }
    }
  });
  return n;
});
I(Lp, {
  displayName: "Prose<inlineNodesCursorPlugin>",
  group: "Prose"
});
var Pp = Ut((t) => new je({
  key: new qe("MILKDOWN_HARDBREAK_MARKS"),
  appendTransaction: (e, n, r) => {
    if (!e.length) return;
    const [i] = e;
    if (!i) return;
    const [o] = i.steps;
    if (i.getMeta("hardbreak")) {
      if (!(o instanceof de)) return;
      const { from: s } = o;
      return r.tr.setNodeMarkup(s, Pn.type(t), void 0, []);
    }
    if (o instanceof Ft) {
      let s = r.tr;
      const { from: l, to: a } = o;
      return r.doc.nodesBetween(l, a, (c, u) => {
        c.type === Pn.type(t) && (s = s.setNodeMarkup(u, Pn.type(t), void 0, []));
      }), s;
    }
  }
}));
I(Pp, {
  displayName: "Prose<hardbreakClearMarkPlugin>",
  group: "Prose"
});
var ac = Jt(["table", "code_block"], "hardbreakFilterNodes");
I(ac, {
  displayName: "Ctx<hardbreakFilterNodes>",
  group: "Prose"
});
var Bp = Ut((t) => {
  const e = t.get(ac.key);
  return new je({
    key: new qe("MILKDOWN_HARDBREAK_FILTER"),
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
I(Bp, {
  displayName: "Prose<hardbreakFilterPlugin>",
  group: "Prose"
});
var _p = Ut((t) => {
  const e = new qe("MILKDOWN_HEADING_ID"), n = (r) => {
    if (r.composing) return;
    const i = t.get(Lo.key), o = r.state.tr.setMeta("addToHistory", !1);
    let s = !1;
    const l = {};
    r.state.doc.descendants((a, c) => {
      if (a.type === jn.type(t)) {
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
  return new je({
    key: e,
    view: (r) => (n(r), { update: (i, o) => {
      i.state.doc.eq(o.doc) || n(i);
    } })
  });
});
I(_p, {
  displayName: "Prose<syncHeadingIdPlugin>",
  group: "Prose"
});
var Fp = Ut((t) => {
  const e = (n, r, i) => {
    if (!i.selection || n.some((h) => h.getMeta("addToHistory") === !1 || !h.isGeneric)) return null;
    const o = br.type(t), s = kr.type(t), l = Gt.type(t), a = (h, d, f = 1) => {
      let p = !1;
      const m = `${d + f}.`;
      return h.label !== m && (h.label = m, p = !0), p;
    };
    let c = i.tr, u = !1;
    return i.doc.descendants((h, d, f, p) => {
      if (h.type === s) {
        const m = h.maybeChild(0);
        m?.type === l && m.attrs.listType === "ordered" && (u = !0, c.setNodeMarkup(d, o, { spread: !0 }), h.descendants((y, g, S, C) => {
          if (y.type === l) {
            const E = { ...y.attrs };
            a(E, C) && (c = c.setNodeMarkup(g, void 0, E));
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
  return new je({
    key: new qe("MILKDOWN_KEEP_LIST_ORDER"),
    appendTransaction: e
  });
});
I(Fp, {
  displayName: "Prose<syncListOrderPlugin>",
  group: "Prose"
});
var qC = [
  Pp,
  ac,
  Bp,
  Lp,
  mo,
  rc,
  oc,
  ic,
  sc,
  lc,
  zo,
  _p,
  Fp
].flat(), WC = [
  EC,
  vC,
  OC,
  FC,
  $C,
  qC
].flat();
let Sl, Nl;
if (typeof WeakMap < "u") {
  let t = /* @__PURE__ */ new WeakMap();
  Sl = (e) => t.get(e), Nl = (e, n) => (t.set(e, n), n);
} else {
  const t = [];
  let n = 0;
  Sl = (r) => {
    for (let i = 0; i < t.length; i += 2) if (t[i] == r) return t[i + 1];
  }, Nl = (r, i) => (n == 10 && (n = 0), t[n++] = r, t[n++] = i);
}
var te = class {
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
    return Sl(t) || Nl(t, KC(t));
  }
};
function KC(t) {
  if (t.type.spec.tableRole != "table") throw new RangeError("Not a table node: " + t.type.name);
  const e = UC(t), n = t.childCount, r = [];
  let i = 0, o = null;
  const s = [];
  for (let c = 0, u = e * n; c < u; c++) r[c] = 0;
  for (let c = 0, u = 0; c < n; c++) {
    const h = t.child(c);
    u++;
    for (let p = 0; ; p++) {
      for (; i < r.length && r[i] != 0; ) i++;
      if (p == h.childCount) break;
      const m = h.child(p), { colspan: y, rowspan: g, colwidth: S } = m.attrs;
      for (let C = 0; C < g; C++) {
        if (C + c >= n) {
          (o || (o = [])).push({
            type: "overlong_rowspan",
            pos: u,
            n: g - C
          });
          break;
        }
        const E = i + C * e;
        for (let O = 0; O < y; O++) {
          r[E + O] == 0 ? r[E + O] = u : (o || (o = [])).push({
            type: "collision",
            row: c,
            pos: u,
            n: y - O
          });
          const x = S && S[O];
          if (x) {
            const A = (E + O) % e * 2, D = s[A];
            D == null || D != x && s[A + 1] == 1 ? (s[A] = x, s[A + 1] = 1) : D == x && s[A + 1]++;
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
  const l = new te(e, n, r, o);
  let a = !1;
  for (let c = 0; !a && c < s.length; c += 2) s[c] != null && s[c + 1] < n && (a = !0);
  return a && JC(l, s, t), l;
}
function UC(t) {
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
function JC(t, e, n) {
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
      u != null && (!a.colwidth || a.colwidth[c] != u) && ((l || (l = GC(a)))[c] = u);
    }
    l && t.problems.unshift({
      type: "colwidth mismatch",
      pos: o,
      colwidth: l
    });
  }
}
function GC(t) {
  if (t.colwidth) return t.colwidth.slice();
  const e = [];
  for (let n = 0; n < t.colspan; n++) e.push(0);
  return e;
}
function lh(t, e) {
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
function ah(t, e) {
  const n = {};
  t.attrs.colspan != 1 && (n.colspan = t.attrs.colspan), t.attrs.rowspan != 1 && (n.rowspan = t.attrs.rowspan), t.attrs.colwidth && (n["data-colwidth"] = t.attrs.colwidth.join(","));
  for (const r in e) {
    const i = e[r].setDOMAttr;
    i && i(t.attrs[r], n);
  }
  return n;
}
function YC(t) {
  if (t !== null) {
    if (!Array.isArray(t)) throw new TypeError("colwidth must be null or an array");
    for (const e of t) if (typeof e != "number") throw new TypeError("colwidth must be null or an array of numbers");
  }
}
function XC(t) {
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
      validate: YC
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
        getAttrs: (r) => lh(r, e)
      }],
      toDOM(r) {
        return [
          "td",
          ah(r, e),
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
        getAttrs: (r) => lh(r, e)
      }],
      toDOM(r) {
        return [
          "th",
          ah(r, e),
          0
        ];
      }
    }
  };
}
function ct(t) {
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
const on = new qe("selectingCells");
function cr(t) {
  for (let e = t.depth - 1; e > 0; e--) if (t.node(e).type.spec.tableRole == "row") return t.node(0).resolve(t.before(e + 1));
  return null;
}
function ft(t) {
  const e = t.selection.$head;
  for (let n = e.depth; n > 0; n--) if (e.node(n).type.spec.tableRole == "row") return !0;
  return !1;
}
function Po(t) {
  const e = t.selection;
  if ("$anchorCell" in e && e.$anchorCell) return e.$anchorCell.pos > e.$headCell.pos ? e.$anchorCell : e.$headCell;
  if ("node" in e && e.node && e.node.type.spec.tableRole == "cell") return e.$anchor;
  const n = cr(e.$head) || QC(e.$head);
  if (n) return n;
  throw new RangeError(`No cell found around position ${e.head}`);
}
function QC(t) {
  for (let e = t.nodeAfter, n = t.pos; e; e = e.firstChild, n++) {
    const r = e.type.spec.tableRole;
    if (r == "cell" || r == "header_cell") return t.doc.resolve(n);
  }
  for (let e = t.nodeBefore, n = t.pos; e; e = e.lastChild, n--) {
    const r = e.type.spec.tableRole;
    if (r == "cell" || r == "header_cell") return t.doc.resolve(n - e.nodeSize);
  }
}
function Il(t) {
  return t.parent.type.spec.tableRole == "row" && !!t.nodeAfter;
}
function ZC(t) {
  return t.node(0).resolve(t.pos + t.nodeAfter.nodeSize);
}
function cc(t, e) {
  return t.depth == e.depth && t.pos >= e.start(-1) && t.pos <= e.end(-1);
}
function $p(t, e, n) {
  const r = t.node(-1), i = te.get(r), o = t.start(-1), s = i.nextCell(t.pos - o, e, n);
  return s == null ? null : t.node(0).resolve(o + s);
}
function Hn(t, e, n = 1) {
  const r = {
    ...t,
    colspan: t.colspan - n
  };
  return r.colwidth && (r.colwidth = r.colwidth.slice(), r.colwidth.splice(e, n), r.colwidth.some((i) => i > 0) || (r.colwidth = null)), r;
}
function eS(t, e, n = 1) {
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
function tS(t, e, n) {
  const r = ct(e.type.schema).header_cell;
  for (let i = 0; i < t.height; i++) if (e.nodeAt(t.map[n + i * t.width]).type != r) return !1;
  return !0;
}
var le = class Lt extends W {
  constructor(e, n = e) {
    const r = e.node(-1), i = te.get(r), o = e.start(-1), s = i.rectBetween(e.pos - o, n.pos - o), l = e.node(0), a = i.cellsInRect(s).filter((u) => u != n.pos - o);
    a.unshift(n.pos - o);
    const c = a.map((u) => {
      const h = r.nodeAt(u);
      if (!h) throw new RangeError(`No cell with offset ${u} found`);
      const d = o + u + 1;
      return new Zf(l.resolve(d), l.resolve(d + h.content.size));
    });
    super(c[0].$from, c[0].$to, c), this.$anchorCell = e, this.$headCell = n;
  }
  map(e, n) {
    const r = e.resolve(n.map(this.$anchorCell.pos)), i = e.resolve(n.map(this.$headCell.pos));
    if (Il(r) && Il(i) && cc(r, i)) {
      const o = this.$anchorCell.node(-1) != r.node(-1);
      return o && this.isRowSelection() ? Lt.rowSelection(r, i) : o && this.isColSelection() ? Lt.colSelection(r, i) : new Lt(r, i);
    }
    return K.between(r, i);
  }
  content() {
    const e = this.$anchorCell.node(-1), n = te.get(e), r = this.$anchorCell.start(-1), i = n.rectBetween(this.$anchorCell.pos - r, this.$headCell.pos - r), o = {}, s = [];
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
          if (m > 0 && (g = Hn(g, 0, m)), y > 0 && (g = Hn(g, g.colspan - y, y)), f.left < i.left) {
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
      s.push(e.child(a).copy(M.from(c)));
    }
    const l = this.isColSelection() && this.isRowSelection() ? e : s;
    return new v(M.from(l), 1, 1);
  }
  replace(e, n = v.empty) {
    const r = e.steps.length, i = this.ranges;
    for (let s = 0; s < i.length; s++) {
      const { $from: l, $to: a } = i[s], c = e.mapping.slice(r);
      e.replace(c.map(l.pos), c.map(a.pos), s ? v.empty : n);
    }
    const o = W.findFrom(e.doc.resolve(e.mapping.slice(r).map(this.to)), -1);
    o && e.setSelection(o);
  }
  replaceWith(e, n) {
    this.replace(e, new v(M.from(n), 0, 0));
  }
  forEachCell(e) {
    const n = this.$anchorCell.node(-1), r = te.get(n), i = this.$anchorCell.start(-1), o = r.cellsInRect(r.rectBetween(this.$anchorCell.pos - i, this.$headCell.pos - i));
    for (let s = 0; s < o.length; s++) e(n.nodeAt(o[s]), i + o[s]);
  }
  isColSelection() {
    const e = this.$anchorCell.index(-1), n = this.$headCell.index(-1);
    if (Math.min(e, n) > 0) return !1;
    const r = e + this.$anchorCell.nodeAfter.attrs.rowspan, i = n + this.$headCell.nodeAfter.attrs.rowspan;
    return Math.max(r, i) == this.$headCell.node(-1).childCount;
  }
  static colSelection(e, n = e) {
    const r = e.node(-1), i = te.get(r), o = e.start(-1), s = i.findCell(e.pos - o), l = i.findCell(n.pos - o), a = e.node(0);
    return s.top <= l.top ? (s.top > 0 && (e = a.resolve(o + i.map[s.left])), l.bottom < i.height && (n = a.resolve(o + i.map[i.width * (i.height - 1) + l.right - 1]))) : (l.top > 0 && (n = a.resolve(o + i.map[l.left])), s.bottom < i.height && (e = a.resolve(o + i.map[i.width * (i.height - 1) + s.right - 1]))), new Lt(e, n);
  }
  isRowSelection() {
    const e = this.$anchorCell.node(-1), n = te.get(e), r = this.$anchorCell.start(-1), i = n.colCount(this.$anchorCell.pos - r), o = n.colCount(this.$headCell.pos - r);
    if (Math.min(i, o) > 0) return !1;
    const s = i + this.$anchorCell.nodeAfter.attrs.colspan, l = o + this.$headCell.nodeAfter.attrs.colspan;
    return Math.max(s, l) == n.width;
  }
  eq(e) {
    return e instanceof Lt && e.$anchorCell.pos == this.$anchorCell.pos && e.$headCell.pos == this.$headCell.pos;
  }
  static rowSelection(e, n = e) {
    const r = e.node(-1), i = te.get(r), o = e.start(-1), s = i.findCell(e.pos - o), l = i.findCell(n.pos - o), a = e.node(0);
    return s.left <= l.left ? (s.left > 0 && (e = a.resolve(o + i.map[s.top * i.width])), l.right < i.width && (n = a.resolve(o + i.map[i.width * (l.top + 1) - 1]))) : (l.left > 0 && (n = a.resolve(o + i.map[l.top * i.width])), s.right < i.width && (e = a.resolve(o + i.map[i.width * (s.top + 1) - 1]))), new Lt(e, n);
  }
  toJSON() {
    return {
      type: "cell",
      anchor: this.$anchorCell.pos,
      head: this.$headCell.pos
    };
  }
  static fromJSON(e, n) {
    return new Lt(e.resolve(n.anchor), e.resolve(n.head));
  }
  static create(e, n, r = n) {
    return new Lt(e.resolve(n), e.resolve(r));
  }
  getBookmark() {
    return new nS(this.$anchorCell.pos, this.$headCell.pos);
  }
};
le.prototype.visible = !1;
W.jsonID("cell", le);
var nS = class Vp {
  constructor(e, n) {
    this.anchor = e, this.head = n;
  }
  map(e) {
    return new Vp(e.map(this.anchor), e.map(this.head));
  }
  resolve(e) {
    const n = e.resolve(this.anchor), r = e.resolve(this.head);
    return n.parent.type.spec.tableRole == "row" && r.parent.type.spec.tableRole == "row" && n.index() < n.parent.childCount && r.index() < r.parent.childCount && cc(n, r) ? new le(n, r) : W.near(r, 1);
  }
};
function rS(t) {
  if (!(t.selection instanceof le)) return null;
  const e = [];
  return t.selection.forEachCell((n, r) => {
    e.push(Me.node(r, r + n.nodeSize, { class: "selectedCell" }));
  }), ce.create(t.doc, e);
}
function iS({ $from: t, $to: e }) {
  if (t.pos == e.pos || t.pos < e.pos - 6) return !1;
  let n = t.pos, r = e.pos, i = t.depth;
  for (; i >= 0 && !(t.after(i + 1) < t.end(i)); i--, n++) ;
  for (let o = e.depth; o >= 0 && !(e.before(o + 1) > e.start(o)); o--, r--) ;
  return n == r && /row|table/.test(t.node(i).type.spec.tableRole);
}
function oS({ $from: t, $to: e }) {
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
function sS(t, e, n) {
  const r = (e || t).selection, i = (e || t).doc;
  let o, s;
  if (r instanceof q && (s = r.node.type.spec.tableRole)) {
    if (s == "cell" || s == "header_cell") o = le.create(i, r.from);
    else if (s == "row") {
      const l = i.resolve(r.from + 1);
      o = le.rowSelection(l, l);
    } else if (!n) {
      const l = te.get(r.node), a = r.from + 1, c = a + l.map[l.width * l.height - 1];
      o = le.create(i, a + 1, c);
    }
  } else r instanceof K && iS(r) ? o = K.create(i, r.from) : r instanceof K && oS(r) && (o = K.create(i, r.$from.start(), r.$from.end()));
  return o && (e || (e = t.tr)).setSelection(o), e;
}
const lS = new qe("fix-tables");
function Hp(t, e, n, r) {
  const i = t.childCount, o = e.childCount;
  e: for (let s = 0, l = 0; s < o; s++) {
    const a = e.child(s);
    for (let c = l, u = Math.min(i, s + 3); c < u; c++) if (t.child(c) == a) {
      l = c + 1, n += a.nodeSize;
      continue e;
    }
    r(a, n), l < i && t.child(l).sameMarkup(a) ? Hp(t.child(l), a, n + 1, r) : a.nodesBetween(0, a.content.size, r, n + 1), n += a.nodeSize;
  }
}
function aS(t, e) {
  let n;
  const r = (i, o) => {
    i.type.spec.tableRole == "table" && (n = cS(t, i, o, n));
  };
  return e ? e.doc != t.doc && Hp(e.doc, t.doc, 0, r) : t.doc.descendants(r), n;
}
function cS(t, e, n, r) {
  const i = te.get(e);
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
      r.setNodeMarkup(r.mapping.map(n + 1 + c.pos), null, Hn(h, h.colspan - c.n, c.n));
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
        const g = ct(t.schema)[f].createAndFill();
        g && p.push(g);
      }
      const m = (a == 0 || s == a - 1) && l == a ? c + 1 : h - 1;
      r.insert(r.mapping.map(m), p);
    }
    c = h;
  }
  return r.setMeta(lS, { fixTables: !0 });
}
function jp(t) {
  const e = te.get(t), n = [], r = e.height, i = e.width;
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
function qp(t, e) {
  const n = [], r = te.get(t), i = r.height, o = r.width;
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
function Wp(t, e, n, r) {
  const i = e[0] > n[0] ? -1 : 1, o = t.splice(e[0], e.length), s = o.length % 2 === 0 ? 1 : 0;
  let l;
  return l = i === -1 ? n[0] : n[n.length - 1] - s, t.splice(l, 0, ...o), t;
}
function wi(t) {
  return uS((e) => e.type.spec.tableRole === "table", t);
}
function uS(t, e) {
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
function Yn(t, e) {
  const n = wi(e.$from);
  if (!n) return;
  const r = te.get(n.node);
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
function Xn(t, e) {
  const n = wi(e.$from);
  if (!n) return;
  const r = te.get(n.node);
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
function ch(t, e, n = e) {
  let r = e, i = n;
  for (let u = e; u >= 0; u--) {
    const h = Yn(u, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.colspan + u - 1;
      f >= r && (r = u), f > i && (i = f);
    });
  }
  for (let u = e; u <= i; u++) {
    const h = Yn(u, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.colspan + u - 1;
      d.node.attrs.colspan > 1 && f > i && (i = f);
    });
  }
  const o = [];
  for (let u = r; u <= i; u++) {
    const h = Yn(u, t.selection);
    h && h.length > 0 && o.push(u);
  }
  r = o[0], i = o[o.length - 1];
  const s = Yn(r, t.selection), l = Xn(0, t.selection);
  if (!s || !l) return;
  const a = t.doc.resolve(s[s.length - 1].pos);
  let c;
  for (let u = i; u >= r; u--) {
    const h = Yn(u, t.selection);
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
function uh(t, e, n = e) {
  let r = e, i = n;
  for (let u = e; u >= 0; u--) {
    const h = Xn(u, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.rowspan + u - 1;
      f >= r && (r = u), f > i && (i = f);
    });
  }
  for (let u = e; u <= i; u++) {
    const h = Xn(u, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.rowspan + u - 1;
      d.node.attrs.rowspan > 1 && f > i && (i = f);
    });
  }
  const o = [];
  for (let u = r; u <= i; u++) {
    const h = Xn(u, t.selection);
    h && h.length > 0 && o.push(u);
  }
  r = o[0], i = o[o.length - 1];
  const s = Xn(r, t.selection), l = Yn(0, t.selection);
  if (!s || !l) return;
  const a = t.doc.resolve(s[s.length - 1].pos);
  let c;
  for (let u = i; u >= r; u--) {
    const h = Xn(u, t.selection);
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
function hh(t) {
  return t[0].map((e, n) => t.map((r) => r[n]));
}
function hS(t) {
  var e, n;
  const { tr: r, originIndex: i, targetIndex: o, select: s, pos: l } = t, a = wi(r.doc.resolve(l));
  if (!a) return !1;
  const c = (e = ch(r, i)) === null || e === void 0 ? void 0 : e.indexes, u = (n = ch(r, o)) === null || n === void 0 ? void 0 : n.indexes;
  if (!c || !u || c.includes(o)) return !1;
  const h = fS(a.node, c, u);
  if (r.replaceWith(a.pos, a.pos + a.node.nodeSize, h), !s) return !0;
  const d = te.get(h), f = a.start, p = o, m = d.positionAt(d.height - 1, p, h), y = r.doc.resolve(f + m), g = d.positionAt(0, p, h), S = r.doc.resolve(f + g);
  return r.setSelection(le.colSelection(y, S)), !0;
}
function fS(t, e, n, r) {
  let i = hh(jp(t));
  return i = Wp(i, e, n), i = hh(i), qp(t, i);
}
function dS(t) {
  var e, n;
  const { tr: r, originIndex: i, targetIndex: o, select: s, pos: l } = t, a = wi(r.doc.resolve(l));
  if (!a) return !1;
  const c = (e = uh(r, i)) === null || e === void 0 ? void 0 : e.indexes, u = (n = uh(r, o)) === null || n === void 0 ? void 0 : n.indexes;
  if (!c || !u || c.includes(o)) return !1;
  const h = pS(a.node, c, u);
  if (r.replaceWith(a.pos, a.pos + a.node.nodeSize, h), !s) return !0;
  const d = te.get(h), f = a.start, p = o, m = d.positionAt(p, d.width - 1, h), y = r.doc.resolve(f + m), g = d.positionAt(p, 0, h), S = r.doc.resolve(f + g);
  return r.setSelection(le.rowSelection(y, S)), !0;
}
function pS(t, e, n, r) {
  let i = jp(t);
  return i = Wp(i, e, n), qp(t, i);
}
function kn(t) {
  const e = t.selection, n = Po(t), r = n.node(-1), i = n.start(-1), o = te.get(r);
  return {
    ...e instanceof le ? o.rectBetween(e.$anchorCell.pos - i, e.$headCell.pos - i) : o.findCell(n.pos - i),
    tableStart: i,
    map: o,
    table: r
  };
}
function Kp(t, { map: e, tableStart: n, table: r }, i) {
  let o = i > 0 ? -1 : 0;
  tS(e, r, i + o) && (o = i == 0 || i == e.width ? null : 0);
  for (let s = 0; s < e.height; s++) {
    const l = s * e.width + i;
    if (i > 0 && i < e.width && e.map[l - 1] == e.map[l]) {
      const a = e.map[l], c = r.nodeAt(a);
      t.setNodeMarkup(t.mapping.map(n + a), null, eS(c.attrs, i - e.colCount(a))), s += c.attrs.rowspan - 1;
    } else {
      const a = o == null ? ct(r.type.schema).cell : r.nodeAt(e.map[l + o]).type, c = e.positionAt(s, i, r);
      t.insert(t.mapping.map(n + c), a.createAndFill());
    }
  }
  return t;
}
function mS(t, e) {
  if (!ft(t)) return !1;
  if (e) {
    const n = kn(t);
    e(Kp(t.tr, n, n.left));
  }
  return !0;
}
function gS(t, e) {
  if (!ft(t)) return !1;
  if (e) {
    const n = kn(t);
    e(Kp(t.tr, n, n.right));
  }
  return !0;
}
function yS(t, { map: e, table: n, tableStart: r }, i) {
  const o = t.mapping.maps.length;
  for (let s = 0; s < e.height; ) {
    const l = s * e.width + i, a = e.map[l], c = n.nodeAt(a), u = c.attrs;
    if (i > 0 && e.map[l - 1] == a || i < e.width - 1 && e.map[l + 1] == a) t.setNodeMarkup(t.mapping.slice(o).map(r + a), null, Hn(u, i - e.colCount(a)));
    else {
      const h = t.mapping.slice(o).map(r + a);
      t.delete(h, h + c.nodeSize);
    }
    s += u.rowspan;
  }
}
function kS(t, e) {
  if (!ft(t)) return !1;
  if (e) {
    const n = kn(t), r = t.tr;
    if (n.left == 0 && n.right == n.map.width) return !1;
    for (let i = n.right - 1; yS(r, n, i), i != n.left; i--) {
      const o = n.tableStart ? r.doc.nodeAt(n.tableStart - 1) : r.doc;
      if (!o) throw new RangeError("No table found");
      n.table = o, n.map = te.get(o);
    }
    e(r);
  }
  return !0;
}
function bS(t, { map: e, table: n, tableStart: r }, i) {
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
function wS(t, e) {
  if (!ft(t)) return !1;
  if (e) {
    const n = kn(t), r = t.tr;
    if (n.top == 0 && n.bottom == n.map.height) return !1;
    for (let i = n.bottom - 1; bS(r, n, i), i != n.top; i--) {
      const o = n.tableStart ? r.doc.nodeAt(n.tableStart - 1) : r.doc;
      if (!o) throw new RangeError("No table found");
      n.table = o, n.map = te.get(n.table);
    }
    e(r);
  }
  return !0;
}
function xS(t, e) {
  return function(n, r) {
    if (!ft(n)) return !1;
    const i = Po(n);
    if (i.nodeAfter.attrs[t] === e) return !1;
    if (r) {
      const o = n.tr;
      n.selection instanceof le ? n.selection.forEachCell((s, l) => {
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
function CS(t) {
  return function(e, n) {
    if (!ft(e)) return !1;
    if (n) {
      const r = ct(e.schema), i = kn(e), o = e.tr, s = i.map.cellsInRect(t == "column" ? {
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
function fh(t, e, n) {
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
function uc(t, e) {
  return e = e || { useDeprecatedLogic: !1 }, e.useDeprecatedLogic ? CS(t) : function(n, r) {
    if (!ft(n)) return !1;
    if (r) {
      const i = ct(n.schema), o = kn(n), s = n.tr, l = fh("row", o, i), a = fh("column", o, i), c = (t === "column" ? l : t === "row" && a) ? 1 : 0, u = t == "column" ? {
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
uc("row", { useDeprecatedLogic: !0 });
uc("column", { useDeprecatedLogic: !0 });
uc("cell", { useDeprecatedLogic: !0 });
function SS(t, e) {
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
function Up(t) {
  return function(e, n) {
    if (!ft(e)) return !1;
    const r = SS(Po(e), t);
    if (r == null) return !1;
    if (n) {
      const i = e.doc.resolve(r);
      n(e.tr.setSelection(K.between(i, ZC(i))).scrollIntoView());
    }
    return !0;
  };
}
function NS(t, e) {
  const n = t.selection.$anchor;
  for (let r = n.depth; r > 0; r--) if (n.node(r).type.spec.tableRole == "table")
    return e && e(t.tr.delete(n.before(r), n.after(r)).scrollIntoView()), !0;
  return !1;
}
function Li(t, e) {
  const n = t.selection;
  if (!(n instanceof le)) return !1;
  if (e) {
    const r = t.tr, i = ct(t.schema).cell.createAndFill().content;
    n.forEachCell((o, s) => {
      o.content.eq(i) || r.replace(r.mapping.map(s + 1), r.mapping.map(s + o.nodeSize - 1), new v(i, 0, 0));
    }), r.docChanged && e(r);
  }
  return !0;
}
function IS(t) {
  return (e, n) => {
    const { from: r, to: i, select: o = !0, pos: s = e.selection.from } = t, l = e.tr;
    return dS({
      tr: l,
      originIndex: r,
      targetIndex: i,
      select: o,
      pos: s
    }) ? (n?.(l), !0) : !1;
  };
}
function MS(t) {
  return (e, n) => {
    const { from: r, to: i, select: o = !0, pos: s = e.selection.from } = t, l = e.tr;
    return hS({
      tr: l,
      originIndex: r,
      targetIndex: i,
      select: o,
      pos: s
    }) ? (n?.(l), !0) : !1;
  };
}
function TS(t) {
  if (t.size === 0) return null;
  let { content: e, openStart: n, openEnd: r } = t;
  for (; e.childCount == 1 && (n > 0 && r > 0 || e.child(0).type.spec.tableRole == "table"); )
    n--, r--, e = e.child(0).content;
  const i = e.child(0), o = i.type.spec.tableRole, s = i.type.schema, l = [];
  if (o == "row") for (let a = 0; a < e.childCount; a++) {
    let c = e.child(a).content;
    const u = a ? 0 : Math.max(0, n - 1), h = a < e.childCount - 1 ? 0 : Math.max(0, r - 1);
    (u || h) && (c = Ml(ct(s).row, new v(c, u, h)).content), l.push(c);
  }
  else if (o == "cell" || o == "header_cell") l.push(n || r ? Ml(ct(s).row, new v(e, n, r)).content : e);
  else return null;
  return AS(s, l);
}
function AS(t, e) {
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
    if (i >= e.length && e.push(M.empty), n[i] < r) {
      const o = ct(t).cell.createAndFill(), s = [];
      for (let l = n[i]; l < r; l++) s.push(o);
      e[i] = e[i].append(M.from(s));
    }
  return {
    height: e.length,
    width: r,
    rows: e
  };
}
function Ml(t, e) {
  const n = t.createAndFill();
  return new Qf(n).replace(0, n.content.size, e).doc;
}
function ES({ width: t, height: e, rows: n }, r, i) {
  if (t != r) {
    const o = [], s = [];
    for (let l = 0; l < n.length; l++) {
      const a = n[l], c = [];
      for (let u = o[l] || 0, h = 0; u < r; h++) {
        let d = a.child(h % a.childCount);
        u + d.attrs.colspan > r && (d = d.type.createChecked(Hn(d.attrs, d.attrs.colspan, u + d.attrs.colspan - r), d.content)), c.push(d), u += d.attrs.colspan;
        for (let f = 1; f < d.attrs.rowspan; f++) o[l + f] = (o[l + f] || 0) + d.attrs.colspan;
      }
      s.push(M.from(c));
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
      o.push(M.from(a));
    }
    n = o, e = i;
  }
  return {
    width: t,
    height: e,
    rows: n
  };
}
function vS(t, e, n, r, i, o, s) {
  const l = t.doc.type.schema, a = ct(l);
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
    const d = a.row.create(null, M.from(h)), f = [];
    for (let p = e.height; p < o; p++) f.push(d);
    t.insert(t.mapping.slice(s).map(r + n.nodeSize - 2), f);
  }
  return !!(c || u);
}
function dh(t, e, n, r, i, o, s, l) {
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
function ph(t, e, n, r, i, o, s, l) {
  if (s == 0 || s == e.width) return !1;
  let a = !1;
  for (let c = i; c < o; c++) {
    const u = c * e.width + s, h = e.map[u];
    if (e.map[u - 1] == h) {
      a = !0;
      const d = n.nodeAt(h), f = e.colCount(h), p = t.mapping.slice(l).map(h + r);
      t.setNodeMarkup(p, null, Hn(d.attrs, s - f, d.attrs.colspan - (s - f))), t.insert(p + d.nodeSize, d.type.createAndFill(Hn(d.attrs, 0, s - f))), c += d.attrs.rowspan - 1;
    }
  }
  return a;
}
function mh(t, e, n, r, i) {
  let o = n ? t.doc.nodeAt(n - 1) : t.doc;
  if (!o) throw new Error("No table found");
  let s = te.get(o);
  const { top: l, left: a } = r, c = a + i.width, u = l + i.height, h = t.tr;
  let d = 0;
  function f() {
    if (o = n ? h.doc.nodeAt(n - 1) : h.doc, !o) throw new Error("No table found");
    s = te.get(o), d = h.mapping.maps.length;
  }
  vS(h, s, o, n, c, u, d) && f(), dh(h, s, o, n, a, c, l, d) && f(), dh(h, s, o, n, a, c, u, d) && f(), ph(h, s, o, n, l, u, a, d) && f(), ph(h, s, o, n, l, u, c, d) && f();
  for (let p = l; p < u; p++) {
    const m = s.positionAt(p, a, o), y = s.positionAt(p, c, o);
    h.replace(h.mapping.slice(d).map(m + n), h.mapping.slice(d).map(y + n), new v(i.rows[p - l], 0, 0));
  }
  f(), h.setSelection(new le(h.doc.resolve(n + s.positionAt(l, a, o)), h.doc.resolve(n + s.positionAt(u - 1, c - 1, o)))), e(h);
}
const OS = dd({
  ArrowLeft: Pi("horiz", -1),
  ArrowRight: Pi("horiz", 1),
  ArrowUp: Pi("vert", -1),
  ArrowDown: Pi("vert", 1),
  "Shift-ArrowLeft": Bi("horiz", -1),
  "Shift-ArrowRight": Bi("horiz", 1),
  "Shift-ArrowUp": Bi("vert", -1),
  "Shift-ArrowDown": Bi("vert", 1),
  Backspace: Li,
  "Mod-Backspace": Li,
  Delete: Li,
  "Mod-Delete": Li
});
function Qi(t, e, n) {
  return n.eq(t.selection) ? !1 : (e && e(t.tr.setSelection(n).scrollIntoView()), !0);
}
function Pi(t, e) {
  return (n, r, i) => {
    if (!i) return !1;
    const o = n.selection;
    if (o instanceof le) return Qi(n, r, W.near(o.$headCell, e));
    if (t != "horiz" && !o.empty) return !1;
    const s = Jp(i, t, e);
    if (s == null) return !1;
    if (t == "horiz") return Qi(n, r, W.near(n.doc.resolve(o.head + e), e));
    {
      const l = n.doc.resolve(s), a = $p(l, t, e);
      let c;
      return a ? c = W.near(a, 1) : e < 0 ? c = W.near(n.doc.resolve(l.before(-1)), -1) : c = W.near(n.doc.resolve(l.after(-1)), 1), Qi(n, r, c);
    }
  };
}
function Bi(t, e) {
  return (n, r, i) => {
    if (!i) return !1;
    const o = n.selection;
    let s;
    if (o instanceof le) s = o;
    else {
      const a = Jp(i, t, e);
      if (a == null) return !1;
      s = new le(n.doc.resolve(a));
    }
    const l = $p(s.$headCell, t, e);
    return l ? Qi(n, r, new le(s.$anchorCell, l)) : !1;
  };
}
function DS(t, e) {
  const n = t.state.doc, r = cr(n.resolve(e));
  return r ? (t.dispatch(t.state.tr.setSelection(new le(r))), !0) : !1;
}
function RS(t, e, n) {
  if (!ft(t.state)) return !1;
  let r = TS(n);
  const i = t.state.selection;
  if (i instanceof le) {
    r || (r = {
      width: 1,
      height: 1,
      rows: [M.from(Ml(ct(t.state.schema).cell, n))]
    });
    const o = i.$anchorCell.node(-1), s = i.$anchorCell.start(-1), l = te.get(o).rectBetween(i.$anchorCell.pos - s, i.$headCell.pos - s);
    return r = ES(r, l.right - l.left, l.bottom - l.top), mh(t.state, t.dispatch, s, l, r), !0;
  } else if (r) {
    const o = Po(t.state), s = o.start(-1);
    return mh(t.state, t.dispatch, s, te.get(o.node(-1)).findCell(o.pos - s), r), !0;
  } else return !1;
}
function zS(t, e) {
  var n;
  if (e.button != 0 || e.ctrlKey || e.metaKey) return;
  const r = gh(t, e.target);
  let i;
  if (e.shiftKey && t.state.selection instanceof le)
    o(t.state.selection.$anchorCell, e), e.preventDefault();
  else if (e.shiftKey && r && (i = cr(t.state.selection.$anchor)) != null && ((n = Ms(t, e)) === null || n === void 0 ? void 0 : n.pos) != i.pos)
    o(i, e), e.preventDefault();
  else if (!r) return;
  function o(a, c) {
    let u = Ms(t, c);
    const h = on.getState(t.state) == null;
    if (!u || !cc(a, u)) if (h) u = a;
    else return;
    const d = new le(a, u);
    if (h || !t.state.selection.eq(d)) {
      const f = t.state.tr.setSelection(d);
      h && f.setMeta(on, a.pos), t.dispatch(f);
    }
  }
  function s() {
    t.root.removeEventListener("mouseup", s), t.root.removeEventListener("dragstart", s), t.root.removeEventListener("mousemove", l), on.getState(t.state) != null && t.dispatch(t.state.tr.setMeta(on, -1));
  }
  function l(a) {
    const c = a, u = on.getState(t.state);
    let h;
    if (u != null) h = t.state.doc.resolve(u);
    else if (gh(t, c.target) != r && (h = Ms(t, e), !h))
      return s();
    h && o(h, c);
  }
  t.root.addEventListener("mouseup", s), t.root.addEventListener("dragstart", s), t.root.addEventListener("mousemove", l);
}
function Jp(t, e, n) {
  if (!(t.state.selection instanceof K)) return null;
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
function gh(t, e) {
  for (; e && e != t.dom; e = e.parentNode) if (e.nodeName == "TD" || e.nodeName == "TH") return e;
  return null;
}
function Ms(t, e) {
  const n = t.posAtCoords({
    left: e.clientX,
    top: e.clientY
  });
  if (!n) return null;
  let { inside: r, pos: i } = n;
  return r >= 0 && cr(t.state.doc.resolve(r)) || cr(t.state.doc.resolve(i));
}
var LS = class {
  constructor(t, e) {
    this.node = t, this.defaultCellMinWidth = e, this.dom = document.createElement("div"), this.dom.className = "tableWrapper", this.table = this.dom.appendChild(document.createElement("table")), this.table.style.setProperty("--default-cell-min-width", `${e}px`), this.colgroup = this.table.appendChild(document.createElement("colgroup")), Tl(t, this.colgroup, this.table, e), this.contentDOM = this.table.appendChild(document.createElement("tbody"));
  }
  update(t) {
    return t.type != this.node.type ? !1 : (this.node = t, Tl(t, this.colgroup, this.table, this.defaultCellMinWidth), !0);
  }
  ignoreMutation(t) {
    return t.type == "attributes" && (t.target == this.table || this.colgroup.contains(t.target));
  }
};
function Tl(t, e, n, r, i, o) {
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
          const S = document.createElement("col");
          S.style.width = g, e.appendChild(S);
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
const Xe = new qe("tableColumnResizing");
function PS({ handleWidth: t = 5, cellMinWidth: e = 25, defaultCellMinWidth: n = 100, View: r = LS, lastColumnResizable: i = !0 } = {}) {
  const o = new je({
    key: Xe,
    state: {
      init(s, l) {
        var a;
        const c = (a = o.spec) === null || a === void 0 || (a = a.props) === null || a === void 0 ? void 0 : a.nodeViews, u = ct(l.schema).table.name;
        return r && c && (c[u] = (h, d) => new r(h, n, d)), new BS(-1, !1);
      },
      apply(s, l) {
        return l.apply(s);
      }
    },
    props: {
      attributes: (s) => {
        const l = Xe.getState(s);
        return l && l.activeHandle > -1 ? { class: "resize-cursor" } : {};
      },
      handleDOMEvents: {
        mousemove: (s, l) => {
          _S(s, l, t, i);
        },
        mouseleave: (s) => {
          FS(s);
        },
        mousedown: (s, l) => {
          $S(s, l, e, n);
        }
      },
      decorations: (s) => {
        const l = Xe.getState(s);
        if (l && l.activeHandle > -1) return WS(s, l.activeHandle);
      },
      nodeViews: {}
    }
  });
  return o;
}
var BS = class Zi {
  constructor(e, n) {
    this.activeHandle = e, this.dragging = n;
  }
  apply(e) {
    const n = this, r = e.getMeta(Xe);
    if (r && r.setHandle != null) return new Zi(r.setHandle, !1);
    if (r && r.setDragging !== void 0) return new Zi(n.activeHandle, r.setDragging);
    if (n.activeHandle > -1 && e.docChanged) {
      let i = e.mapping.map(n.activeHandle, -1);
      return Il(e.doc.resolve(i)) || (i = -1), new Zi(i, n.dragging);
    }
    return n;
  }
};
function _S(t, e, n, r) {
  if (!t.editable) return;
  const i = Xe.getState(t.state);
  if (i && !i.dragging) {
    const o = HS(e.target);
    let s = -1;
    if (o) {
      const { left: l, right: a } = o.getBoundingClientRect();
      e.clientX - l <= n ? s = yh(t, e, "left", n) : a - e.clientX <= n && (s = yh(t, e, "right", n));
    }
    if (s != i.activeHandle) {
      if (!r && s !== -1) {
        const l = t.state.doc.resolve(s), a = l.node(-1), c = te.get(a), u = l.start(-1);
        if (c.colCount(l.pos - u) + l.nodeAfter.attrs.colspan - 1 == c.width - 1) return;
      }
      Gp(t, s);
    }
  }
}
function FS(t) {
  if (!t.editable) return;
  const e = Xe.getState(t.state);
  e && e.activeHandle > -1 && !e.dragging && Gp(t, -1);
}
function $S(t, e, n, r) {
  var i;
  if (!t.editable) return !1;
  const o = (i = t.dom.ownerDocument.defaultView) !== null && i !== void 0 ? i : window, s = Xe.getState(t.state);
  if (!s || s.activeHandle == -1 || s.dragging) return !1;
  const l = t.state.doc.nodeAt(s.activeHandle), a = VS(t, s.activeHandle, l.attrs);
  t.dispatch(t.state.tr.setMeta(Xe, { setDragging: {
    startX: e.clientX,
    startWidth: a
  } }));
  function c(h) {
    o.removeEventListener("mouseup", c), o.removeEventListener("mousemove", u);
    const d = Xe.getState(t.state);
    d?.dragging && (jS(t, d.activeHandle, kh(d.dragging, h, n)), t.dispatch(t.state.tr.setMeta(Xe, { setDragging: null })));
  }
  function u(h) {
    if (!h.which) return c(h);
    const d = Xe.getState(t.state);
    if (d && d.dragging) {
      const f = kh(d.dragging, h, n);
      bh(t, d.activeHandle, f, r);
    }
  }
  return bh(t, s.activeHandle, a, r), o.addEventListener("mouseup", c), o.addEventListener("mousemove", u), e.preventDefault(), !0;
}
function VS(t, e, { colspan: n, colwidth: r }) {
  const i = r && r[r.length - 1];
  if (i) return i;
  const o = t.domAtPos(e);
  let s = o.node.childNodes[o.offset].offsetWidth, l = n;
  if (r)
    for (let a = 0; a < n; a++) r[a] && (s -= r[a], l--);
  return s / l;
}
function HS(t) {
  for (; t && t.nodeName != "TD" && t.nodeName != "TH"; ) t = t.classList && t.classList.contains("ProseMirror") ? null : t.parentNode;
  return t;
}
function yh(t, e, n, r) {
  const i = n == "right" ? -r : r, o = t.posAtCoords({
    left: e.clientX + i,
    top: e.clientY
  });
  if (!o) return -1;
  const { pos: s } = o, l = cr(t.state.doc.resolve(s));
  if (!l) return -1;
  if (n == "right") return l.pos;
  const a = te.get(l.node(-1)), c = l.start(-1), u = a.map.indexOf(l.pos - c);
  return u % a.width == 0 ? -1 : c + a.map[u - 1];
}
function kh(t, e, n) {
  const r = e.clientX - t.startX;
  return Math.max(n, t.startWidth + r);
}
function Gp(t, e) {
  t.dispatch(t.state.tr.setMeta(Xe, { setHandle: e }));
}
function jS(t, e, n) {
  const r = t.state.doc.resolve(e), i = r.node(-1), o = te.get(i), s = r.start(-1), l = o.colCount(r.pos - s) + r.nodeAfter.attrs.colspan - 1, a = t.state.tr;
  for (let c = 0; c < o.height; c++) {
    const u = c * o.width + l;
    if (c && o.map[u] == o.map[u - o.width]) continue;
    const h = o.map[u], d = i.nodeAt(h).attrs, f = d.colspan == 1 ? 0 : l - o.colCount(h);
    if (d.colwidth && d.colwidth[f] == n) continue;
    const p = d.colwidth ? d.colwidth.slice() : qS(d.colspan);
    p[f] = n, a.setNodeMarkup(s + h, null, {
      ...d,
      colwidth: p
    });
  }
  a.docChanged && t.dispatch(a);
}
function bh(t, e, n, r) {
  const i = t.state.doc.resolve(e), o = i.node(-1), s = i.start(-1), l = te.get(o).colCount(i.pos - s) + i.nodeAfter.attrs.colspan - 1;
  let a = t.domAtPos(i.start(-1)).node;
  for (; a && a.nodeName != "TABLE"; ) a = a.parentNode;
  a && Tl(o, a.firstChild, a, r, l, n);
}
function qS(t) {
  return Array(t).fill(0);
}
function WS(t, e) {
  const n = [], r = t.doc.resolve(e), i = r.node(-1);
  if (!i) return ce.empty;
  const o = te.get(i), s = r.start(-1), l = o.colCount(r.pos - s) + r.nodeAfter.attrs.colspan - 1;
  for (let c = 0; c < o.height; c++) {
    const u = l + c * o.width;
    if ((l == o.width - 1 || o.map[u] != o.map[u + 1]) && (c == 0 || o.map[u] != o.map[u - o.width])) {
      var a;
      const h = o.map[u], d = s + h + i.nodeAt(h).nodeSize - 1, f = document.createElement("div");
      f.className = "column-resize-handle", !((a = Xe.getState(t)) === null || a === void 0) && a.dragging && n.push(Me.node(s + h, s + h + i.nodeAt(h).nodeSize, { class: "column-resize-dragging" })), n.push(Me.widget(d, f));
    }
  }
  return ce.create(t.doc, n);
}
function KS({ allowTableNodeSelection: t = !1 } = {}) {
  return new je({
    key: on,
    state: {
      init() {
        return null;
      },
      apply(e, n) {
        const r = e.getMeta(on);
        if (r != null) return r == -1 ? null : r;
        if (n == null || !e.docChanged) return n;
        const { deleted: i, pos: o } = e.mapping.mapResult(n);
        return i ? null : o;
      }
    },
    props: {
      decorations: rS,
      handleDOMEvents: { mousedown: zS },
      createSelectionBetween(e) {
        return on.getState(e.state) != null ? e.state.selection : null;
      },
      handleTripleClick: DS,
      handleKeyDown: OS,
      handlePaste: RS
    },
    appendTransaction(e, n, r) {
      return sS(r, aS(r, n), t);
    }
  });
}
var yo = typeof navigator < "u" ? navigator : null, hc = yo && yo.userAgent || "", US = /Edge\/(\d+)/.exec(hc), JS = /MSIE \d/.exec(hc), GS = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(hc), YS = !!(JS || GS || US), XS = !YS && !!yo && /Apple Computer/.test(yo.vendor), Yp = new qe("safari-ime-span"), Al = !1, QS = {
  key: Yp,
  props: {
    decorations: ZS,
    handleDOMEvents: {
      compositionstart: () => {
        Al = !0;
      },
      compositionend: () => {
        Al = !1;
      }
    }
  }
};
function ZS(t) {
  const { $from: e, $to: n, to: r } = t.selection;
  if (Al && e.sameParent(n)) {
    const i = Me.widget(r, eN, {
      ignoreSelection: !0,
      key: "safari-ime-span"
    });
    return ce.create(t.doc, [i]);
  }
}
function eN(t) {
  const e = t.dom.ownerDocument.createElement("span");
  return e.className = "ProseMirror-safari-ime-span", e;
}
var tN = new je(XS ? QS : { key: Yp });
function wh(t, e) {
  const n = String(t);
  if (typeof e != "string")
    throw new TypeError("Expected character");
  let r = 0, i = n.indexOf(e);
  for (; i !== -1; )
    r++, i = n.indexOf(e, i + e.length);
  return r;
}
function nN(t) {
  if (typeof t != "string")
    throw new TypeError("Expected a string");
  return t.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}
function rN(t, e, n) {
  const i = So((n || {}).ignore || []), o = iN(e);
  let s = -1;
  for (; ++s < o.length; )
    Wl(t, "text", l);
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
    let g = !1, S = [];
    d.lastIndex = 0;
    let C = d.exec(c.value);
    for (; C; ) {
      const E = C.index, O = {
        index: C.index,
        input: C.input,
        stack: [...u, c]
      };
      let x = f(...C, O);
      if (typeof x == "string" && (x = x.length > 0 ? { type: "text", value: x } : void 0), x === !1 ? d.lastIndex = E + 1 : (p !== E && S.push({
        type: "text",
        value: c.value.slice(p, E)
      }), Array.isArray(x) ? S.push(...x) : x && S.push(x), p = E + C[0].length, g = !0), !d.global)
        break;
      C = d.exec(c.value);
    }
    return g ? (p < c.value.length && S.push({ type: "text", value: c.value.slice(p) }), h.children.splice(y, 1, ...S)) : S = [c], y + S.length;
  }
}
function iN(t) {
  const e = [];
  if (!Array.isArray(t))
    throw new TypeError("Expected find and replace tuple or list of tuples");
  const n = !t[0] || Array.isArray(t[0]) ? t : [t];
  let r = -1;
  for (; ++r < n.length; ) {
    const i = n[r];
    e.push([oN(i[0]), sN(i[1])]);
  }
  return e;
}
function oN(t) {
  return typeof t == "string" ? new RegExp(nN(t), "g") : t;
}
function sN(t) {
  return typeof t == "function" ? t : function() {
    return t;
  };
}
const Ts = "phrasing", As = ["autolink", "link", "image", "label"];
function lN() {
  return {
    transforms: [pN],
    enter: {
      literalAutolink: cN,
      literalAutolinkEmail: Es,
      literalAutolinkHttp: Es,
      literalAutolinkWww: Es
    },
    exit: {
      literalAutolink: dN,
      literalAutolinkEmail: fN,
      literalAutolinkHttp: uN,
      literalAutolinkWww: hN
    }
  };
}
function aN() {
  return {
    unsafe: [
      {
        character: "@",
        before: "[+\\-.\\w]",
        after: "[\\-.\\w]",
        inConstruct: Ts,
        notInConstruct: As
      },
      {
        character: ".",
        before: "[Ww]",
        after: "[\\-.\\w]",
        inConstruct: Ts,
        notInConstruct: As
      },
      {
        character: ":",
        before: "[ps]",
        after: "\\/",
        inConstruct: Ts,
        notInConstruct: As
      }
    ]
  };
}
function cN(t) {
  this.enter({ type: "link", title: null, url: "", children: [] }, t);
}
function Es(t) {
  this.config.enter.autolinkProtocol.call(this, t);
}
function uN(t) {
  this.config.exit.autolinkProtocol.call(this, t);
}
function hN(t) {
  this.config.exit.data.call(this, t);
  const e = this.stack[this.stack.length - 1];
  e.type, e.url = "http://" + this.sliceSerialize(t);
}
function fN(t) {
  this.config.exit.autolinkEmail.call(this, t);
}
function dN(t) {
  this.exit(t);
}
function pN(t) {
  rN(
    t,
    [
      [/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi, mN],
      [new RegExp("(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)", "gu"), gN]
    ],
    { ignore: ["link", "linkReference"] }
  );
}
function mN(t, e, n, r, i) {
  let o = "";
  if (!Xp(i) || (/^w/i.test(e) && (n = e + n, e = "", o = "http://"), !yN(n)))
    return !1;
  const s = kN(n + r);
  if (!s[0]) return !1;
  const l = {
    type: "link",
    title: null,
    url: o + e + s[0],
    children: [{ type: "text", value: e + s[0] }]
  };
  return s[1] ? [l, { type: "text", value: s[1] }] : l;
}
function gN(t, e, n, r) {
  return (
    // Not an expected previous character.
    !Xp(r, !0) || // Label ends in not allowed character.
    /[-\d_]$/.test(n) ? !1 : {
      type: "link",
      title: null,
      url: "mailto:" + e + "@" + n,
      children: [{ type: "text", value: e + "@" + n }]
    }
  );
}
function yN(t) {
  const e = t.split(".");
  return !(e.length < 2 || e[e.length - 1] && (/_/.test(e[e.length - 1]) || !/[a-zA-Z\d]/.test(e[e.length - 1])) || e[e.length - 2] && (/_/.test(e[e.length - 2]) || !/[a-zA-Z\d]/.test(e[e.length - 2])));
}
function kN(t) {
  const e = /[!"&'),.:;<>?\]}]+$/.exec(t);
  if (!e)
    return [t, void 0];
  t = t.slice(0, e.index);
  let n = e[0], r = n.indexOf(")");
  const i = wh(t, "(");
  let o = wh(t, ")");
  for (; r !== -1 && i > o; )
    t += n.slice(0, r + 1), n = n.slice(r + 1), r = n.indexOf(")"), o++;
  return [t, n];
}
function Xp(t, e) {
  const n = t.input.charCodeAt(t.index - 1);
  return (t.index === 0 || Bn(n) || xo(n)) && // If it’s an email, the previous character should not be a slash.
  (!e || n !== 47);
}
Qp.peek = TN;
function bN() {
  this.buffer();
}
function wN(t) {
  this.enter({ type: "footnoteReference", identifier: "", label: "" }, t);
}
function xN() {
  this.buffer();
}
function CN(t) {
  this.enter(
    { type: "footnoteDefinition", identifier: "", label: "", children: [] },
    t
  );
}
function SN(t) {
  const e = this.resume(), n = this.stack[this.stack.length - 1];
  n.type, n.identifier = kt(
    this.sliceSerialize(t)
  ).toLowerCase(), n.label = e;
}
function NN(t) {
  this.exit(t);
}
function IN(t) {
  const e = this.resume(), n = this.stack[this.stack.length - 1];
  n.type, n.identifier = kt(
    this.sliceSerialize(t)
  ).toLowerCase(), n.label = e;
}
function MN(t) {
  this.exit(t);
}
function TN() {
  return "[";
}
function Qp(t, e, n, r) {
  const i = n.createTracker(r);
  let o = i.move("[^");
  const s = n.enter("footnoteReference"), l = n.enter("reference");
  return o += i.move(
    n.safe(n.associationId(t), { after: "]", before: o })
  ), l(), s(), o += i.move("]"), o;
}
function AN() {
  return {
    enter: {
      gfmFootnoteCallString: bN,
      gfmFootnoteCall: wN,
      gfmFootnoteDefinitionLabelString: xN,
      gfmFootnoteDefinition: CN
    },
    exit: {
      gfmFootnoteCallString: SN,
      gfmFootnoteCall: NN,
      gfmFootnoteDefinitionLabelString: IN,
      gfmFootnoteDefinition: MN
    }
  };
}
function EN(t) {
  let e = !1;
  return t && t.firstLineBlank && (e = !0), {
    handlers: { footnoteDefinition: n, footnoteReference: Qp },
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
        e ? Zp : vN
      )
    )), c(), a;
  }
}
function vN(t, e, n) {
  return e === 0 ? t : Zp(t, e, n);
}
function Zp(t, e, n) {
  return (n ? "" : "    ") + t;
}
const ON = [
  "autolink",
  "destinationLiteral",
  "destinationRaw",
  "reference",
  "titleQuote",
  "titleApostrophe"
];
fc.attention = PN;
fc.peek = BN;
function DN() {
  return {
    canContainEols: ["delete"],
    enter: { strikethrough: zN },
    exit: { strikethrough: LN }
  };
}
function RN() {
  return {
    handlers: { delete: fc },
    unsafe: [
      {
        character: "~",
        inConstruct: "phrasing",
        notInConstruct: ON
      }
    ]
  };
}
function zN(t) {
  this.enter({ type: "delete", children: [], position: void 0 }, t);
}
function LN(t) {
  this.exit(t);
}
function fc(t, e, n, r) {
  const i = n.createTracker(r), o = n.stack.includes("strikethrough") ? "~" : "~~", s = n.enter("strikethrough");
  let l = i.move(o);
  return l += n.containerPhrasing(t, {
    ...i.current(),
    before: l,
    after: "~"
  }), l += i.move(o), s(), l;
}
function PN() {
  return { construct: "strikethrough", markers: ["~"], sizes: [2, 1] };
}
function BN() {
  return "~";
}
function _N(t) {
  return t.length;
}
function FN(t, e) {
  const n = e || {}, r = (n.align || []).concat(), i = n.stringLength || _N, o = [], s = [], l = [], a = [];
  let c = 0, u = -1;
  for (; ++u < t.length; ) {
    const m = [], y = [];
    let g = -1;
    for (t[u].length > c && (c = t[u].length); ++g < t[u].length; ) {
      const S = $N(t[u][g]);
      if (n.alignDelimiters !== !1) {
        const C = i(S);
        y[g] = C, (a[g] === void 0 || C > a[g]) && (a[g] = C);
      }
      m.push(S);
    }
    s[u] = m, l[u] = y;
  }
  let h = -1;
  if (typeof r == "object" && "length" in r)
    for (; ++h < c; )
      o[h] = xh(r[h]);
  else {
    const m = xh(r);
    for (; ++h < c; )
      o[h] = m;
  }
  h = -1;
  const d = [], f = [];
  for (; ++h < c; ) {
    const m = o[h];
    let y = "", g = "";
    m === 99 ? (y = ":", g = ":") : m === 108 ? y = ":" : m === 114 && (g = ":");
    let S = n.alignDelimiters === !1 ? 1 : Math.max(
      1,
      a[h] - y.length - g.length
    );
    const C = y + "-".repeat(S) + g;
    n.alignDelimiters !== !1 && (S = y.length + S + g.length, S > a[h] && (a[h] = S), f[h] = S), d[h] = C;
  }
  s.splice(1, 0, d), l.splice(1, 0, f), u = -1;
  const p = [];
  for (; ++u < s.length; ) {
    const m = s[u], y = l[u];
    h = -1;
    const g = [];
    for (; ++h < c; ) {
      const S = m[h] || "";
      let C = "", E = "";
      if (n.alignDelimiters !== !1) {
        const O = a[h] - (y[h] || 0), x = o[h];
        x === 114 ? C = " ".repeat(O) : x === 99 ? O % 2 ? (C = " ".repeat(O / 2 + 0.5), E = " ".repeat(O / 2 - 0.5)) : (C = " ".repeat(O / 2), E = C) : E = " ".repeat(O);
      }
      n.delimiterStart !== !1 && !h && g.push("|"), n.padding !== !1 && // Don’t add the opening space if we’re not aligning and the cell is
      // empty: there will be a closing space.
      !(n.alignDelimiters === !1 && S === "") && (n.delimiterStart !== !1 || h) && g.push(" "), n.alignDelimiters !== !1 && g.push(C), g.push(S), n.alignDelimiters !== !1 && g.push(E), n.padding !== !1 && g.push(" "), (n.delimiterEnd !== !1 || h !== c - 1) && g.push("|");
    }
    p.push(
      n.delimiterEnd === !1 ? g.join("").replace(/ +$/, "") : g.join("")
    );
  }
  return p.join(`
`);
}
function $N(t) {
  return t == null ? "" : String(t);
}
function xh(t) {
  const e = typeof t == "string" ? t.codePointAt(0) : 0;
  return e === 67 || e === 99 ? 99 : e === 76 || e === 108 ? 108 : e === 82 || e === 114 ? 114 : 0;
}
function VN() {
  return {
    enter: {
      table: HN,
      tableData: Ch,
      tableHeader: Ch,
      tableRow: qN
    },
    exit: {
      codeText: WN,
      table: jN,
      tableData: vs,
      tableHeader: vs,
      tableRow: vs
    }
  };
}
function HN(t) {
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
function jN(t) {
  this.exit(t), this.data.inTable = void 0;
}
function qN(t) {
  this.enter({ type: "tableRow", children: [] }, t);
}
function vs(t) {
  this.exit(t);
}
function Ch(t) {
  this.enter({ type: "tableCell", children: [] }, t);
}
function WN(t) {
  let e = this.resume();
  this.data.inTable && (e = e.replace(/\\([\\|])/g, KN));
  const n = this.stack[this.stack.length - 1];
  n.type, n.value = e, this.exit(t);
}
function KN(t, e) {
  return e === "|" ? e : t;
}
function UN(t) {
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
    const g = h(f, m, y), S = c([g]);
    return S.slice(0, S.indexOf(`
`));
  }
  function a(f, p, m, y) {
    const g = m.enter("tableCell"), S = m.enter("phrasing"), C = m.containerPhrasing(f, {
      ...y,
      before: o,
      after: o
    });
    return S(), g(), C;
  }
  function c(f, p) {
    return FN(f, {
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
    const S = [], C = p.enter("table");
    for (; ++g < y.length; )
      S[g] = h(y[g], p, m);
    return C(), S;
  }
  function h(f, p, m) {
    const y = f.children;
    let g = -1;
    const S = [], C = p.enter("tableRow");
    for (; ++g < y.length; )
      S[g] = a(y[g], f, p, m);
    return C(), S;
  }
  function d(f, p, m) {
    let y = Jl.inlineCode(f, p, m);
    return m.stack.includes("tableCell") && (y = y.replace(/\|/g, "\\$&")), y;
  }
}
function JN() {
  return {
    exit: {
      taskListCheckValueChecked: Sh,
      taskListCheckValueUnchecked: Sh,
      paragraph: YN
    }
  };
}
function GN() {
  return {
    unsafe: [{ atBreak: !0, character: "-", after: "[:|-]" }],
    handlers: { listItem: XN }
  };
}
function Sh(t) {
  const e = this.stack[this.stack.length - 2];
  e.type, e.checked = t.type === "taskListCheckValueChecked";
}
function YN(t) {
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
function XN(t, e, n, r) {
  const i = t.children[0], o = typeof t.checked == "boolean" && i && i.type === "paragraph", s = "[" + (t.checked ? "x" : " ") + "] ", l = n.createTracker(r);
  o && l.move(s);
  let a = Jl.listItem(t, e, n, {
    ...r,
    ...l.current()
  });
  return o && (a = a.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/, c)), a;
  function c(u) {
    return u + s;
  }
}
function QN() {
  return [
    lN(),
    AN(),
    DN(),
    VN(),
    JN()
  ];
}
function ZN(t) {
  return {
    extensions: [
      aN(),
      EN(t),
      RN(),
      UN(t),
      GN()
    ]
  };
}
const eI = {
  tokenize: sI,
  partial: !0
}, em = {
  tokenize: lI,
  partial: !0
}, tm = {
  tokenize: aI,
  partial: !0
}, nm = {
  tokenize: cI,
  partial: !0
}, tI = {
  tokenize: uI,
  partial: !0
}, rm = {
  name: "wwwAutolink",
  tokenize: iI,
  previous: om
}, im = {
  name: "protocolAutolink",
  tokenize: oI,
  previous: sm
}, Yt = {
  name: "emailAutolink",
  tokenize: rI,
  previous: lm
}, Ot = {};
function nI() {
  return {
    text: Ot
  };
}
let xn = 48;
for (; xn < 123; )
  Ot[xn] = Yt, xn++, xn === 58 ? xn = 65 : xn === 91 && (xn = 97);
Ot[43] = Yt;
Ot[45] = Yt;
Ot[46] = Yt;
Ot[95] = Yt;
Ot[72] = [Yt, im];
Ot[104] = [Yt, im];
Ot[87] = [Yt, rm];
Ot[119] = [Yt, rm];
function rI(t, e, n) {
  const r = this;
  let i, o;
  return s;
  function s(h) {
    return !El(h) || !lm.call(r, r.previous) || dc(r.events) ? n(h) : (t.enter("literalAutolink"), t.enter("literalAutolinkEmail"), l(h));
  }
  function l(h) {
    return El(h) ? (t.consume(h), l) : h === 64 ? (t.consume(h), a) : n(h);
  }
  function a(h) {
    return h === 46 ? t.check(tI, u, c)(h) : h === 45 || h === 95 || ze(h) ? (o = !0, t.consume(h), a) : u(h);
  }
  function c(h) {
    return t.consume(h), i = !0, a;
  }
  function u(h) {
    return o && i && Ne(r.previous) ? (t.exit("literalAutolinkEmail"), t.exit("literalAutolink"), e(h)) : n(h);
  }
}
function iI(t, e, n) {
  const r = this;
  return i;
  function i(s) {
    return s !== 87 && s !== 119 || !om.call(r, r.previous) || dc(r.events) ? n(s) : (t.enter("literalAutolink"), t.enter("literalAutolinkWww"), t.check(eI, t.attempt(em, t.attempt(tm, o), n), n)(s));
  }
  function o(s) {
    return t.exit("literalAutolinkWww"), t.exit("literalAutolink"), e(s);
  }
}
function oI(t, e, n) {
  const r = this;
  let i = "", o = !1;
  return s;
  function s(h) {
    return (h === 72 || h === 104) && sm.call(r, r.previous) && !dc(r.events) ? (t.enter("literalAutolink"), t.enter("literalAutolinkHttp"), i += String.fromCodePoint(h), t.consume(h), l) : n(h);
  }
  function l(h) {
    if (Ne(h) && i.length < 5)
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
    return h === null || eo(h) || oe(h) || Bn(h) || xo(h) ? n(h) : t.attempt(em, t.attempt(tm, u), n)(h);
  }
  function u(h) {
    return t.exit("literalAutolinkHttp"), t.exit("literalAutolink"), e(h);
  }
}
function sI(t, e, n) {
  let r = 0;
  return i;
  function i(s) {
    return (s === 87 || s === 119) && r < 3 ? (r++, t.consume(s), i) : s === 46 && r === 3 ? (t.consume(s), o) : n(s);
  }
  function o(s) {
    return s === null ? n(s) : e(s);
  }
}
function lI(t, e, n) {
  let r, i, o;
  return s;
  function s(c) {
    return c === 46 || c === 95 ? t.check(nm, a, l)(c) : c === null || oe(c) || Bn(c) || c !== 45 && xo(c) ? a(c) : (o = !0, t.consume(c), s);
  }
  function l(c) {
    return c === 95 ? r = !0 : (i = r, r = void 0), t.consume(c), s;
  }
  function a(c) {
    return i || r || !o ? n(c) : e(c);
  }
}
function aI(t, e) {
  let n = 0, r = 0;
  return i;
  function i(s) {
    return s === 40 ? (n++, t.consume(s), i) : s === 41 && r < n ? o(s) : s === 33 || s === 34 || s === 38 || s === 39 || s === 41 || s === 42 || s === 44 || s === 46 || s === 58 || s === 59 || s === 60 || s === 63 || s === 93 || s === 95 || s === 126 ? t.check(nm, e, o)(s) : s === null || oe(s) || Bn(s) ? e(s) : (t.consume(s), i);
  }
  function o(s) {
    return s === 41 && r++, t.consume(s), i;
  }
}
function cI(t, e, n) {
  return r;
  function r(l) {
    return l === 33 || l === 34 || l === 39 || l === 41 || l === 42 || l === 44 || l === 46 || l === 58 || l === 59 || l === 63 || l === 95 || l === 126 ? (t.consume(l), r) : l === 38 ? (t.consume(l), o) : l === 93 ? (t.consume(l), i) : (
      // `<` is an end.
      l === 60 || // So is whitespace.
      l === null || oe(l) || Bn(l) ? e(l) : n(l)
    );
  }
  function i(l) {
    return l === null || l === 40 || l === 91 || oe(l) || Bn(l) ? e(l) : r(l);
  }
  function o(l) {
    return Ne(l) ? s(l) : n(l);
  }
  function s(l) {
    return l === 59 ? (t.consume(l), r) : Ne(l) ? (t.consume(l), s) : n(l);
  }
}
function uI(t, e, n) {
  return r;
  function r(o) {
    return t.consume(o), i;
  }
  function i(o) {
    return ze(o) ? n(o) : e(o);
  }
}
function om(t) {
  return t === null || t === 40 || t === 42 || t === 95 || t === 91 || t === 93 || t === 126 || oe(t);
}
function sm(t) {
  return !Ne(t);
}
function lm(t) {
  return !(t === 47 || El(t));
}
function El(t) {
  return t === 43 || t === 45 || t === 46 || t === 95 || ze(t);
}
function dc(t) {
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
const hI = {
  tokenize: bI,
  partial: !0
};
function fI() {
  return {
    document: {
      91: {
        name: "gfmFootnoteDefinition",
        tokenize: gI,
        continuation: {
          tokenize: yI
        },
        exit: kI
      }
    },
    text: {
      91: {
        name: "gfmFootnoteCall",
        tokenize: mI
      },
      93: {
        name: "gfmPotentialFootnoteCall",
        add: "after",
        tokenize: dI,
        resolveTo: pI
      }
    }
  };
}
function dI(t, e, n) {
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
    const c = kt(r.sliceSerialize({
      start: s.end,
      end: r.now()
    }));
    return c.codePointAt(0) !== 94 || !o.includes(c.slice(1)) ? n(a) : (t.enter("gfmFootnoteCallLabelMarker"), t.consume(a), t.exit("gfmFootnoteCallLabelMarker"), e(a));
  }
}
function pI(t, e) {
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
function mI(t, e, n) {
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
      h === null || h === 91 || oe(h)
    )
      return n(h);
    if (h === 93) {
      t.exit("chunkString");
      const d = t.exit("gfmFootnoteCallString");
      return i.includes(kt(r.sliceSerialize(d))) ? (t.enter("gfmFootnoteCallLabelMarker"), t.consume(h), t.exit("gfmFootnoteCallLabelMarker"), t.exit("gfmFootnoteCall"), e) : n(h);
    }
    return oe(h) || (s = !0), o++, t.consume(h), h === 92 ? u : c;
  }
  function u(h) {
    return h === 91 || h === 92 || h === 93 ? (t.consume(h), o++, c) : c(h);
  }
}
function gI(t, e, n) {
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
      p === null || p === 91 || oe(p)
    )
      return n(p);
    if (p === 93) {
      t.exit("chunkString");
      const m = t.exit("gfmFootnoteDefinitionLabelString");
      return o = kt(r.sliceSerialize(m)), t.enter("gfmFootnoteDefinitionLabelMarker"), t.consume(p), t.exit("gfmFootnoteDefinitionLabelMarker"), t.exit("gfmFootnoteDefinitionLabel"), d;
    }
    return oe(p) || (l = !0), s++, t.consume(p), p === 92 ? h : u;
  }
  function h(p) {
    return p === 91 || p === 92 || p === 93 ? (t.consume(p), s++, u) : u(p);
  }
  function d(p) {
    return p === 58 ? (t.enter("definitionMarker"), t.consume(p), t.exit("definitionMarker"), i.includes(o) || i.push(o), Z(t, f, "gfmFootnoteDefinitionWhitespace")) : n(p);
  }
  function f(p) {
    return e(p);
  }
}
function yI(t, e, n) {
  return t.check(ai, e, t.attempt(hI, e, n));
}
function kI(t) {
  t.exit("gfmFootnoteDefinition");
}
function bI(t, e, n) {
  const r = this;
  return Z(t, i, "gfmFootnoteDefinitionIndent", 5);
  function i(o) {
    const s = r.events[r.events.length - 1];
    return s && s[1].type === "gfmFootnoteDefinitionIndent" && s[2].sliceSerialize(s[1], !0).length === 4 ? e(o) : n(o);
  }
}
function wI(t) {
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
            f && yt(d, d.length, 0, Co(f, s.slice(c + 1, a), l)), yt(d, d.length, 0, [["exit", h, l], ["enter", s[a][1], l], ["exit", s[a][1], l], ["exit", u, l]]), yt(s, c - 1, a - c + 3, d), a = c + d.length - 2;
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
      const m = Mt(c);
      if (p === 126)
        return h > 1 ? a(p) : (s.consume(p), h++, f);
      if (h < 2 && !n) return a(p);
      const y = s.exit("strikethroughSequenceTemporary"), g = Mt(p);
      return y._open = !g || g === 2 && !!m, y._close = !m || m === 2 && !!g, l(p);
    }
  }
}
class xI {
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
    CI(this, e, n, r);
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
function CI(t, e, n, r) {
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
function SI(t, e) {
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
function NI() {
  return {
    flow: {
      null: {
        name: "table",
        tokenize: II,
        resolveAll: MI
      }
    }
  };
}
function II(t, e, n) {
  const r = this;
  let i = 0, o = 0, s;
  return l;
  function l(N) {
    let R = r.events.length - 1;
    for (; R > -1; ) {
      const {
        type: se
      } = r.events[R][1];
      if (se === "lineEnding" || // Note: markdown-rs uses `whitespace` instead of `linePrefix`
      se === "linePrefix")
        R--;
      else
        break;
    }
    const P = R > -1 ? r.events[R][1].type : null, ee = P === "tableHead" || P === "tableRow" ? x : a;
    return ee === x && r.parser.lazy[r.now().line] ? n(N) : ee(N);
  }
  function a(N) {
    return t.enter("tableHead"), t.enter("tableRow"), c(N);
  }
  function c(N) {
    return N === 124 || (s = !0, o += 1), u(N);
  }
  function u(N) {
    return N === null ? n(N) : V(N) ? o > 1 ? (o = 0, r.interrupt = !0, t.exit("tableRow"), t.enter("lineEnding"), t.consume(N), t.exit("lineEnding"), f) : n(N) : G(N) ? Z(t, u, "whitespace")(N) : (o += 1, s && (s = !1, i += 1), N === 124 ? (t.enter("tableCellDivider"), t.consume(N), t.exit("tableCellDivider"), s = !0, u) : (t.enter("data"), h(N)));
  }
  function h(N) {
    return N === null || N === 124 || oe(N) ? (t.exit("data"), u(N)) : (t.consume(N), N === 92 ? d : h);
  }
  function d(N) {
    return N === 92 || N === 124 ? (t.consume(N), h) : h(N);
  }
  function f(N) {
    return r.interrupt = !1, r.parser.lazy[r.now().line] ? n(N) : (t.enter("tableDelimiterRow"), s = !1, G(N) ? Z(t, p, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(N) : p(N));
  }
  function p(N) {
    return N === 45 || N === 58 ? y(N) : N === 124 ? (s = !0, t.enter("tableCellDivider"), t.consume(N), t.exit("tableCellDivider"), m) : O(N);
  }
  function m(N) {
    return G(N) ? Z(t, y, "whitespace")(N) : y(N);
  }
  function y(N) {
    return N === 58 ? (o += 1, s = !0, t.enter("tableDelimiterMarker"), t.consume(N), t.exit("tableDelimiterMarker"), g) : N === 45 ? (o += 1, g(N)) : N === null || V(N) ? E(N) : O(N);
  }
  function g(N) {
    return N === 45 ? (t.enter("tableDelimiterFiller"), S(N)) : O(N);
  }
  function S(N) {
    return N === 45 ? (t.consume(N), S) : N === 58 ? (s = !0, t.exit("tableDelimiterFiller"), t.enter("tableDelimiterMarker"), t.consume(N), t.exit("tableDelimiterMarker"), C) : (t.exit("tableDelimiterFiller"), C(N));
  }
  function C(N) {
    return G(N) ? Z(t, E, "whitespace")(N) : E(N);
  }
  function E(N) {
    return N === 124 ? p(N) : N === null || V(N) ? !s || i !== o ? O(N) : (t.exit("tableDelimiterRow"), t.exit("tableHead"), e(N)) : O(N);
  }
  function O(N) {
    return n(N);
  }
  function x(N) {
    return t.enter("tableRow"), A(N);
  }
  function A(N) {
    return N === 124 ? (t.enter("tableCellDivider"), t.consume(N), t.exit("tableCellDivider"), A) : N === null || V(N) ? (t.exit("tableRow"), e(N)) : G(N) ? Z(t, A, "whitespace")(N) : (t.enter("data"), D(N));
  }
  function D(N) {
    return N === null || N === 124 || oe(N) ? (t.exit("data"), A(N)) : (t.consume(N), N === 92 ? F : D);
  }
  function F(N) {
    return N === 92 || N === 124 ? (t.consume(N), D) : D(N);
  }
}
function MI(t, e) {
  let n = -1, r = !0, i = 0, o = [0, 0, 0, 0], s = [0, 0, 0, 0], l = !1, a = 0, c, u, h;
  const d = new xI();
  for (; ++n < t.length; ) {
    const f = t[n], p = f[1];
    f[0] === "enter" ? p.type === "tableHead" ? (l = !1, a !== 0 && (Nh(d, e, a, c, u), u = void 0, a = 0), c = {
      type: "table",
      start: Object.assign({}, p.start),
      // Note: correct end is set later.
      end: Object.assign({}, p.end)
    }, d.add(n, 0, [["enter", c, e]])) : p.type === "tableRow" || p.type === "tableDelimiterRow" ? (r = !0, h = void 0, o = [0, 0, 0, 0], s = [0, n + 1, 0, 0], l && (l = !1, u = {
      type: "tableBody",
      start: Object.assign({}, p.start),
      // Note: correct end is set later.
      end: Object.assign({}, p.end)
    }, d.add(n, 0, [["enter", u, e]])), i = p.type === "tableDelimiterRow" ? 2 : u ? 3 : 1) : i && (p.type === "data" || p.type === "tableDelimiterMarker" || p.type === "tableDelimiterFiller") ? (r = !1, s[2] === 0 && (o[1] !== 0 && (s[0] = s[1], h = _i(d, e, o, i, void 0, h), o = [0, 0, 0, 0]), s[2] = n)) : p.type === "tableCellDivider" && (r ? r = !1 : (o[1] !== 0 && (s[0] = s[1], h = _i(d, e, o, i, void 0, h)), o = s, s = [o[1], n, 0, 0])) : p.type === "tableHead" ? (l = !0, a = n) : p.type === "tableRow" || p.type === "tableDelimiterRow" ? (a = n, o[1] !== 0 ? (s[0] = s[1], h = _i(d, e, o, i, n, h)) : s[1] !== 0 && (h = _i(d, e, s, i, n, h)), i = 0) : i && (p.type === "data" || p.type === "tableDelimiterMarker" || p.type === "tableDelimiterFiller") && (s[3] = n);
  }
  for (a !== 0 && Nh(d, e, a, c, u), d.consume(e.events), n = -1; ++n < e.events.length; ) {
    const f = e.events[n];
    f[0] === "enter" && f[1].type === "table" && (f[1]._align = SI(e.events, n));
  }
  return t;
}
function _i(t, e, n, r, i, o) {
  const s = r === 1 ? "tableHeader" : r === 2 ? "tableDelimiter" : "tableData", l = "tableContent";
  n[0] !== 0 && (o.end = Object.assign({}, Qn(e.events, n[0])), t.add(n[0], 0, [["exit", o, e]]));
  const a = Qn(e.events, n[1]);
  if (o = {
    type: s,
    start: Object.assign({}, a),
    // Note: correct end is set later.
    end: Object.assign({}, a)
  }, t.add(n[1], 0, [["enter", o, e]]), n[2] !== 0) {
    const c = Qn(e.events, n[2]), u = Qn(e.events, n[3]), h = {
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
  return i !== void 0 && (o.end = Object.assign({}, Qn(e.events, i)), t.add(i, 0, [["exit", o, e]]), o = void 0), o;
}
function Nh(t, e, n, r, i) {
  const o = [], s = Qn(e.events, n);
  i && (i.end = Object.assign({}, s), o.push(["exit", i, e])), r.end = Object.assign({}, s), o.push(["exit", r, e]), t.add(n + 1, 0, o);
}
function Qn(t, e) {
  const n = t[e], r = n[0] === "enter" ? "start" : "end";
  return n[1][r];
}
const TI = {
  name: "tasklistCheck",
  tokenize: EI
};
function AI() {
  return {
    text: {
      91: TI
    }
  };
}
function EI(t, e, n) {
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
    return oe(a) ? (t.enter("taskListCheckValueUnchecked"), t.consume(a), t.exit("taskListCheckValueUnchecked"), s) : a === 88 || a === 120 ? (t.enter("taskListCheckValueChecked"), t.consume(a), t.exit("taskListCheckValueChecked"), s) : n(a);
  }
  function s(a) {
    return a === 93 ? (t.enter("taskListCheckMarker"), t.consume(a), t.exit("taskListCheckMarker"), t.exit("taskListCheck"), l) : n(a);
  }
  function l(a) {
    return V(a) ? e(a) : G(a) ? t.check({
      tokenize: vI
    }, e, n)(a) : n(a);
  }
}
function vI(t, e, n) {
  return Z(t, r, "whitespace");
  function r(i) {
    return i === null ? n(i) : e(i);
  }
}
function OI(t) {
  return Hh([
    nI(),
    fI(),
    wI(t),
    NI(),
    AI()
  ]);
}
const DI = {};
function RI(t) {
  const e = (
    /** @type {Processor<Root>} */
    this
  ), n = t || DI, r = e.data(), i = r.micromarkExtensions || (r.micromarkExtensions = []), o = r.fromMarkdownExtensions || (r.fromMarkdownExtensions = []), s = r.toMarkdownExtensions || (r.toMarkdownExtensions = []);
  i.push(OI(n)), o.push(QN()), s.push(ZN(n));
}
function j(t, e) {
  return Object.assign(t, { meta: {
    package: "@milkdown/preset-gfm",
    ...e
  } }), t;
}
var pc = mi("strike_through");
j(pc, {
  displayName: "Attr<strikethrough>",
  group: "Strikethrough"
});
var xi = mr("strike_through", (t) => ({
  parseDOM: [{ tag: "del" }, {
    style: "text-decoration",
    getAttrs: (e) => e === "line-through"
  }],
  toDOM: (e) => ["del", t.get(pc.key)(e)],
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
j(xi.mark, {
  displayName: "MarkSchema<strikethrough>",
  group: "Strikethrough"
});
j(xi.ctx, {
  displayName: "MarkSchemaCtx<strikethrough>",
  group: "Strikethrough"
});
var mc = U("ToggleStrikeThrough", (t) => () => vo(xi.type(t)));
j(mc, {
  displayName: "Command<ToggleStrikethrough>",
  group: "Strikethrough"
});
var am = We((t) => ui(/(?<![\w:/])(~{1,2})(.+?)\1(?!\w|\/)$/, xi.type(t)));
j(am, {
  displayName: "InputRule<strikethrough>",
  group: "Strikethrough"
});
var gc = nt("strikeThroughKeymap", { ToggleStrikethrough: {
  shortcuts: "Mod-Alt-x",
  command: (t) => {
    const e = t.get(ne);
    return () => e.call(mc.key);
  }
} });
j(gc.ctx, {
  displayName: "KeymapCtx<strikethrough>",
  group: "Strikethrough"
});
j(gc.shortcuts, {
  displayName: "Keymap<strikethrough>",
  group: "Strikethrough"
});
function cm(t, e) {
  const n = e.content.firstChild;
  if (e.childCount !== 1 || n?.type.name !== "paragraph") {
    t.next(e.content);
    return;
  }
  const r = n.lastChild, i = r?.type.name === "hardbreak" ? n.content.cut(0, n.content.size - r.nodeSize) : n.content;
  t.next(i);
}
var Ci = XC({
  tableGroup: "block",
  cellContent: "paragraph",
  cellAttributes: { alignment: {
    default: "left",
    getFromDOM: (t) => t.style.textAlign || "left",
    setDOMAttr: (t, e) => {
      e.style = `text-align: ${t || "left"}`;
    }
  } }
}), qt = ke("table", () => ({
  ...Ci.table,
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
j(qt.node, {
  displayName: "NodeSchema<table>",
  group: "Table"
});
j(qt.ctx, {
  displayName: "NodeSchemaCtx<table>",
  group: "Table"
});
var Si = ke("table_header_row", () => ({
  ...Ci.table_row,
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
j(Si.node, {
  displayName: "NodeSchema<tableHeaderRow>",
  group: "Table"
});
j(Si.ctx, {
  displayName: "NodeSchemaCtx<tableHeaderRow>",
  group: "Table"
});
var wr = ke("table_row", () => ({
  ...Ci.table_row,
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
j(wr.node, {
  displayName: "NodeSchema<tableRow>",
  group: "Table"
});
j(wr.ctx, {
  displayName: "NodeSchemaCtx<tableRow>",
  group: "Table"
});
var Ni = ke("table_cell", () => ({
  ...Ci.table_cell,
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
      t.openNode("tableCell"), cm(t, e), t.closeNode();
    }
  }
}));
j(Ni.node, {
  displayName: "NodeSchema<tableCell>",
  group: "Table"
});
j(Ni.ctx, {
  displayName: "NodeSchemaCtx<tableCell>",
  group: "Table"
});
var ur = ke("table_header", () => ({
  ...Ci.table_header,
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
      t.openNode("tableCell"), cm(t, e), t.closeNode();
    }
  }
}));
j(ur.node, {
  displayName: "NodeSchema<tableHeader>",
  group: "Table"
});
j(ur.ctx, {
  displayName: "NodeSchemaCtx<tableHeader>",
  group: "Table"
});
function um(t, e = 3, n = 3) {
  const r = Array(n).fill(0).map(() => Ni.type(t).createAndFill()), i = Array(n).fill(0).map(() => ur.type(t).createAndFill()), o = Array(e).fill(0).map((s, l) => l === 0 ? Si.type(t).create(null, i) : wr.type(t).create(null, r));
  return qt.type(t).create(null, o);
}
function hm(t) {
  return (e, n) => (r) => {
    n = n ?? r.selection.from;
    const i = r.doc.resolve(n), o = K1((a) => a.type.name === "table")(i), s = o ? {
      node: o.node,
      from: o.start
    } : void 0, l = t === "row";
    if (s) {
      const a = te.get(s.node);
      if (e >= 0 && e < (l ? a.height : a.width)) {
        const c = a.positionAt(l ? e : a.height - 1, l ? a.width - 1 : e, s.node), u = r.doc.resolve(s.from + c), h = l ? le.rowSelection : le.colSelection, d = a.positionAt(l ? e : 0, l ? 0 : e, s.node), f = r.doc.resolve(s.from + d);
        return fd(r.setSelection(h(u, f)));
      }
    }
    return r;
  };
}
var zI = hm("row"), LI = hm("col");
function fm(t, e, { map: n, tableStart: r, table: i }, o) {
  const s = Array(o).fill(0).reduce((a, c, u) => a + i.child(u).nodeSize, r), l = Array(n.width).fill(0).map((a, c) => {
    const u = i.nodeAt(n.map[c]);
    return Ni.type(t).createAndFill({ alignment: u?.attrs.alignment });
  });
  return e.insert(s, wr.type(t).create(null, l)), e;
}
function PI(t) {
  const e = wi(t.$from);
  if (!e) return;
  const n = te.get(e.node);
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
function BI(t) {
  const e = PI(t.selection);
  if (e && e[0]) {
    const n = t.doc.resolve(e[0].pos), r = e[e.length - 1];
    if (r) {
      const i = t.doc.resolve(r.pos);
      return fd(t.setSelection(new le(i, n)));
    }
  }
  return t;
}
var yc = U("GoToPrevTableCell", () => () => Up(-1));
j(yc, {
  displayName: "Command<goToPrevTableCellCommand>",
  group: "Table"
});
var kc = U("GoToNextTableCell", () => () => Up(1));
j(kc, {
  displayName: "Command<goToNextTableCellCommand>",
  group: "Table"
});
var bc = U("ExitTable", (t) => () => (e, n) => {
  if (!ft(e)) return !1;
  const { $head: r } = e.selection, i = W1(r, qt.type(t));
  if (!i) return !1;
  const { to: o } = i, s = e.tr.replaceWith(o, o, At.type(t).createAndFill());
  return s.setSelection(W.near(s.doc.resolve(o), 1)).scrollIntoView(), n?.(s), !0;
});
j(bc, {
  displayName: "Command<breakTableCommand>",
  group: "Table"
});
var dm = U("InsertTable", (t) => ({ row: e, col: n } = {}) => (r, i) => {
  const { selection: o, tr: s } = r, { from: l } = o, a = um(t, e, n), c = s.replaceSelectionWith(a), u = W.findFrom(c.doc.resolve(l), 1, !0);
  return u && c.setSelection(u), i?.(c), !0;
});
j(dm, {
  displayName: "Command<insertTableCommand>",
  group: "Table"
});
var pm = U("MoveRow", () => ({ from: t, to: e, pos: n } = {}) => IS({
  from: t ?? 0,
  to: e ?? 0,
  pos: n
}));
j(pm, {
  displayName: "Command<moveRowCommand>",
  group: "Table"
});
var mm = U("MoveCol", () => ({ from: t, to: e, pos: n } = {}) => MS({
  from: t ?? 0,
  to: e ?? 0,
  pos: n
}));
j(mm, {
  displayName: "Command<moveColCommand>",
  group: "Table"
});
var gm = U("SelectRow", () => (t = { index: 0 }) => (e, n) => {
  const { tr: r } = e;
  return !!n?.(zI(t.index, t.pos)(r));
});
j(gm, {
  displayName: "Command<selectRowCommand>",
  group: "Table"
});
var ym = U("SelectCol", () => (t = { index: 0 }) => (e, n) => {
  const { tr: r } = e;
  return !!n?.(LI(t.index, t.pos)(r));
});
j(ym, {
  displayName: "Command<selectColCommand>",
  group: "Table"
});
var km = U("SelectTable", () => () => (t, e) => {
  const { tr: n } = t;
  return !!e?.(BI(n));
});
j(km, {
  displayName: "Command<selectTableCommand>",
  group: "Table"
});
var bm = U("DeleteSelectedCells", () => () => (t, e) => {
  const { selection: n } = t;
  if (!(n instanceof le)) return !1;
  const r = n.isRowSelection(), i = n.isColSelection();
  return r && i ? NS(t, e) : i ? kS(t, e) : wS(t, e);
});
j(bm, {
  displayName: "Command<deleteSelectedCellsCommand>",
  group: "Table"
});
var wm = U("AddColBefore", () => () => mS);
j(wm, {
  displayName: "Command<addColBeforeCommand>",
  group: "Table"
});
var xm = U("AddColAfter", () => () => gS);
j(xm, {
  displayName: "Command<addColAfterCommand>",
  group: "Table"
});
var Cm = U("AddRowBefore", (t) => () => (e, n) => {
  if (!ft(e)) return !1;
  if (n) {
    const r = kn(e);
    n(fm(t, e.tr, r, r.top));
  }
  return !0;
});
j(Cm, {
  displayName: "Command<addRowBeforeCommand>",
  group: "Table"
});
var Sm = U("AddRowAfter", (t) => () => (e, n) => {
  if (!ft(e)) return !1;
  if (n) {
    const r = kn(e);
    n(fm(t, e.tr, r, r.bottom));
  }
  return !0;
});
j(Sm, {
  displayName: "Command<addRowAfterCommand>",
  group: "Table"
});
var Nm = U("SetAlign", () => (t = "left") => xS("alignment", t));
j(Nm, {
  displayName: "Command<setAlignCommand>",
  group: "Table"
});
var Im = We((t) => new tt(/^\|(?<col>\d+)[xX](?<row>\d+)\|\s$/, (e, n, r, i) => {
  const o = e.doc.resolve(r);
  if (!o.node(-1).canReplaceWith(o.index(-1), o.indexAfter(-1), qt.type(t))) return null;
  const s = um(t, Math.max(Number(n.groups?.row ?? 0), 2), Number(n.groups?.col)), l = e.tr.replaceRangeWith(r, i, s);
  return l.setSelection(K.create(l.doc, r + 3)).scrollIntoView();
}));
j(Im, {
  displayName: "InputRule<insertTableInputRule>",
  group: "Table"
});
var Mm = tC((t) => ({ run: (e, n, r) => {
  if (r) return e;
  function i(c) {
    const u = c.childCount, h = c.lastChild?.childCount ?? 0;
    if (u === 0 || h === 0) return At.type(t).create();
    const d = c.firstChild;
    if (!(h > 0 && d && d.childCount === 0)) return c;
    if (u >= 3) {
      const y = c.child(1), g = [];
      for (let E = 0; E < y.childCount; E++) {
        const O = y.child(E);
        g.push(ur.type(t).create(O.attrs, O.content, O.marks));
      }
      const S = d.type.create(d.attrs, g), C = [];
      for (let E = 2; E < u; E++) C.push(c.child(E));
      return c.type.create(c.attrs, [S, ...C]);
    }
    const f = Array(h).fill(0).map(() => ur.type(t).createAndFill()), p = new v(M.from(f), 0, 0), m = d.replace(0, 0, p);
    return c.replace(0, d.nodeSize, new v(M.from(m), 0, 0));
  }
  function o(c) {
    const u = wr.type(t), h = [];
    let d = [], f = !1;
    function p() {
      if (d.length === 0) return;
      const m = Si.type(t).createAndFill(), y = qt.type(t).create(null, [m, ...d]);
      h.push(i(y)), d = [];
    }
    return c.forEach((m) => {
      m.type === u ? (f = !0, d.push(m)) : (p(), h.push(m));
    }), p(), f ? M.from(h) : c;
  }
  function s(c) {
    let u = o(c), h = u !== c;
    const d = [];
    return u.forEach((f) => {
      if (f.type === qt.type(t)) {
        const p = i(f);
        p !== f && (h = !0), d.push(p);
      } else if (f.childCount > 0) {
        const p = s(f.content);
        p !== f.content ? (h = !0, d.push(f.copy(p))) : d.push(f);
      } else d.push(f);
    }), h ? M.from(d) : c;
  }
  function l(c) {
    const u = [], h = [];
    c.forEach((d) => h.push(d));
    for (let d = 0; d < h.length; d++) {
      const f = h[d], p = h[d + 1];
      f.type === At.type(t) && f.content.size === 0 && p && p.type === qt.type(t) || u.push(f);
    }
    return u.length < h.length ? M.from(u) : c;
  }
  let a = s(e.content);
  return a = l(a), new v(M.from(a), e.openStart, e.openEnd);
} }));
j(Mm, {
  displayName: "PasteRule<table>",
  group: "Table"
});
var wc = nt("tableKeymap", {
  NextCell: {
    priority: 100,
    shortcuts: ["Mod-]", "Tab"],
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(kc.key);
    }
  },
  PrevCell: {
    shortcuts: ["Mod-[", "Shift-Tab"],
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(yc.key);
    }
  },
  ExitTable: {
    shortcuts: ["Mod-Enter", "Enter"],
    command: (t) => {
      const e = t.get(ne);
      return () => e.call(bc.key);
    }
  }
});
j(wc.ctx, {
  displayName: "KeymapCtx<table>",
  group: "Table"
});
j(wc.shortcuts, {
  displayName: "Keymap<table>",
  group: "Table"
});
var Os = "footnote_definition", Ih = "footnoteDefinition", xc = ke("footnote_definition", () => ({
  group: "block",
  content: "block+",
  defining: !0,
  attrs: { label: {
    default: "",
    validate: "string"
  } },
  parseDOM: [{
    tag: `dl[data-type="${Os}"]`,
    getAttrs: (t) => {
      if (!(t instanceof HTMLElement)) throw Et(t);
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
        "data-type": Os
      },
      ["dt", e],
      ["dd", 0]
    ];
  },
  parseMarkdown: {
    match: ({ type: t }) => t === Ih,
    runner: (t, e, n) => {
      t.openNode(n, { label: e.label }).next(e.children).closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === Os,
    runner: (t, e) => {
      t.openNode(Ih, void 0, {
        label: e.attrs.label,
        identifier: e.attrs.label
      }).next(e.content).closeNode();
    }
  }
}));
j(xc.ctx, {
  displayName: "NodeSchemaCtx<footnodeDef>",
  group: "footnote"
});
j(xc.node, {
  displayName: "NodeSchema<footnodeDef>",
  group: "footnote"
});
var Ds = "footnote_reference", Cc = ke("footnote_reference", () => ({
  group: "inline",
  inline: !0,
  atom: !0,
  attrs: { label: {
    default: "",
    validate: "string"
  } },
  parseDOM: [{
    tag: `sup[data-type="${Ds}"]`,
    getAttrs: (t) => {
      if (!(t instanceof HTMLElement)) throw Et(t);
      return { label: t.dataset.label };
    }
  }],
  toDOM: (t) => {
    const e = t.attrs.label;
    return [
      "sup",
      {
        "data-label": e,
        "data-type": Ds
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
    match: (t) => t.type.name === Ds,
    runner: (t, e) => {
      t.addNode("footnoteReference", void 0, void 0, {
        label: e.attrs.label,
        identifier: e.attrs.label
      });
    }
  }
}));
j(Cc.ctx, {
  displayName: "NodeSchemaCtx<footnodeRef>",
  group: "footnote"
});
j(Cc.node, {
  displayName: "NodeSchema<footnodeRef>",
  group: "footnote"
});
var Sc = Gt.extendSchema((t) => (e) => {
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
        if (!(r instanceof HTMLElement)) throw Et(r);
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
j(Sc.node, {
  displayName: "NodeSchema<taskListItem>",
  group: "ListItem"
});
j(Sc.ctx, {
  displayName: "NodeSchemaCtx<taskListItem>",
  group: "ListItem"
});
var Tm = We(() => new tt(/^\[(?<checked>\s|x)\]\s$/, (t, e, n, r) => {
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
j(Tm, {
  displayName: "InputRule<wrapInTaskListInputRule>",
  group: "ListItem"
});
var _I = [gc, wc].flat(), FI = [Im, Tm], $I = [am], VI = [Mm], Am = Ut(() => tN);
j(Am, {
  displayName: "Prose<autoInsertSpanPlugin>",
  group: "Prose"
});
var HI = Ut(() => PS({}));
j(HI, {
  displayName: "Prose<columnResizingPlugin>",
  group: "Prose"
});
var Em = Ut(() => KS({ allowTableNodeSelection: !0 }));
j(Em, {
  displayName: "Prose<tableEditingPlugin>",
  group: "Prose"
});
var Bo = yn("remarkGFM", () => RI);
j(Bo.plugin, {
  displayName: "Remark<remarkGFMPlugin>",
  group: "Remark"
});
j(Bo.options, {
  displayName: "RemarkConfig<remarkGFMPlugin>",
  group: "Remark"
});
var jI = new qe("MILKDOWN_KEEP_TABLE_ALIGN_PLUGIN");
function qI(t, e) {
  let n = 0;
  return e.forEach((r, i, o) => {
    r === t && (n = o);
  }), n;
}
function WI(t, e) {
  const n = t.content.findDiffStart(e.content);
  if (n == null) return null;
  const r = t.content.findDiffEnd(e.content);
  return r ? {
    from: n,
    to: Math.max(r.b, n)
  } : null;
}
var vm = Ut(() => new je({
  key: jI,
  appendTransaction: (t, e, n) => {
    if (e.doc === n.doc) return;
    const r = WI(e.doc, n.doc);
    if (!r) return;
    let i;
    const o = (s, l) => {
      if (s.type.name !== "table_cell") return;
      const a = n.doc.resolve(l), c = a.node(a.depth), u = a.node(a.depth - 1).firstChild;
      if (!u) return;
      const h = qI(s, c), d = u.maybeChild(h);
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
j(vm, {
  displayName: "Prose<keepTableAlignPlugin>",
  group: "Prose"
});
var KI = [
  vm,
  Am,
  Bo,
  Em
].flat(), UI = [
  Sc,
  qt,
  Si,
  wr,
  ur,
  Ni,
  xc,
  Cc,
  pc,
  xi
].flat(), JI = [
  kc,
  yc,
  bc,
  dm,
  pm,
  mm,
  gm,
  ym,
  km,
  bm,
  Cm,
  Sm,
  wm,
  xm,
  Nm,
  mc
], GI = [
  UI,
  FI,
  VI,
  $I,
  _I,
  JI,
  KI
].flat(), YI = typeof global == "object" && global && global.Object === Object && global, XI = typeof self == "object" && self && self.Object === Object && self, Om = YI || XI || Function("return this")(), ko = Om.Symbol, Dm = Object.prototype, QI = Dm.hasOwnProperty, ZI = Dm.toString, Tr = ko ? ko.toStringTag : void 0;
function eM(t) {
  var e = QI.call(t, Tr), n = t[Tr];
  try {
    t[Tr] = void 0;
    var r = !0;
  } catch {
  }
  var i = ZI.call(t);
  return r && (e ? t[Tr] = n : delete t[Tr]), i;
}
var tM = Object.prototype, nM = tM.toString;
function rM(t) {
  return nM.call(t);
}
var iM = "[object Null]", oM = "[object Undefined]", Mh = ko ? ko.toStringTag : void 0;
function sM(t) {
  return t == null ? t === void 0 ? oM : iM : Mh && Mh in Object(t) ? eM(t) : rM(t);
}
function lM(t) {
  return t != null && typeof t == "object";
}
var aM = "[object Symbol]";
function cM(t) {
  return typeof t == "symbol" || lM(t) && sM(t) == aM;
}
var uM = /\s/;
function hM(t) {
  for (var e = t.length; e-- && uM.test(t.charAt(e)); )
    ;
  return e;
}
var fM = /^\s+/;
function dM(t) {
  return t && t.slice(0, hM(t) + 1).replace(fM, "");
}
function vl(t) {
  var e = typeof t;
  return t != null && (e == "object" || e == "function");
}
var Th = NaN, pM = /^[-+]0x[0-9a-f]+$/i, mM = /^0b[01]+$/i, gM = /^0o[0-7]+$/i, yM = parseInt;
function Ah(t) {
  if (typeof t == "number")
    return t;
  if (cM(t))
    return Th;
  if (vl(t)) {
    var e = typeof t.valueOf == "function" ? t.valueOf() : t;
    t = vl(e) ? e + "" : e;
  }
  if (typeof t != "string")
    return t === 0 ? t : +t;
  t = dM(t);
  var n = mM.test(t);
  return n || gM.test(t) ? yM(t.slice(2), n ? 2 : 8) : pM.test(t) ? Th : +t;
}
var Rs = function() {
  return Om.Date.now();
}, kM = "Expected a function", bM = Math.max, wM = Math.min;
function xM(t, e, n) {
  var r, i, o, s, l, a, c = 0, u = !1, h = !1, d = !0;
  if (typeof t != "function")
    throw new TypeError(kM);
  e = Ah(e) || 0, vl(n) && (u = !!n.leading, h = "maxWait" in n, o = h ? bM(Ah(n.maxWait) || 0, e) : o, d = "trailing" in n ? !!n.trailing : d);
  function f(x) {
    var A = r, D = i;
    return r = i = void 0, c = x, s = t.apply(D, A), s;
  }
  function p(x) {
    return c = x, l = setTimeout(g, e), u ? f(x) : s;
  }
  function m(x) {
    var A = x - a, D = x - c, F = e - A;
    return h ? wM(F, o - D) : F;
  }
  function y(x) {
    var A = x - a, D = x - c;
    return a === void 0 || A >= e || A < 0 || h && D >= o;
  }
  function g() {
    var x = Rs();
    if (y(x))
      return S(x);
    l = setTimeout(g, m(x));
  }
  function S(x) {
    return l = void 0, d && r ? f(x) : (r = i = void 0, s);
  }
  function C() {
    l !== void 0 && clearTimeout(l), c = 0, r = a = i = l = void 0;
  }
  function E() {
    return l === void 0 ? s : S(Rs());
  }
  function O() {
    var x = Rs(), A = y(x);
    if (r = arguments, i = this, a = x, A) {
      if (l === void 0)
        return p(a);
      if (h)
        return clearTimeout(l), l = setTimeout(g, e), f(a);
    }
    return l === void 0 && (l = setTimeout(g, e)), s;
  }
  return O.cancel = C, O.flush = E, O;
}
var Rm = class {
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
}, Ol = X(new Rm(), "listener"), CM = new qe("MILKDOWN_LISTENER"), zm = (t) => (t.inject(Ol, new Rm()), async () => {
  await t.wait(Ln);
  const { listeners: e } = t.get(Ol);
  e.beforeMount.forEach((c) => c(t)), await t.wait(Gr);
  const n = t.get(qi);
  let r = null, i = null, o = null, s = null;
  const l = xM(() => {
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
  }, 200), a = new je({
    key: CM,
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
  t.update(Wt, (c) => c.concat(a)), await t.wait(Gi), e.mounted.forEach((c) => c(t));
});
zm.meta = {
  package: "@milkdown/plugin-listener",
  displayName: "Listener"
};
const SM = /* @__PURE__ */ new Set(["paragraph", "heading", "tableCell"]);
function Lm(t) {
  t.type === "image" && ((t.alt === null || t.alt === void 0) && (t.alt = ""), (t.title === null || t.title === void 0) && (t.title = ""));
  const e = t.children;
  if (e !== void 0)
    for (let n = 0; n < e.length; n += 1) {
      const r = e[n];
      r !== void 0 && (r.type === "html" && !SM.has(t.type) && (e[n] = { type: "paragraph", children: [r] }), Lm(r));
    }
}
const Eh = yn("chipsParseNormalize", () => () => (t) => {
  Lm(t);
}), NM = [Eh.options, Eh.plugin];
async function IM(t) {
  const e = await eC.make().config((n) => {
    n.set(Xi, t.host), n.set(Wi, t.defaultValue), n.set(Bo.options.key, { singleTilde: !1 }), n.update(Yi, (r) => ({
      ...r,
      attributes: {
        ...typeof r.attributes == "object" && r.attributes !== null ? r.attributes : {},
        spellcheck: "true",
        autocapitalize: "off",
        autocorrect: "off",
        translate: "no"
      }
    }));
  }).use(WC).use(GI).use(NM).use(zm).create();
  return e.action((n) => {
    n.get(Ol).markdownUpdated((r, i) => {
      t.onMarkdownChange(hr(i));
    });
  }), e;
}
function MM(t) {
  t.action((e) => {
    e.get(It).focus();
  });
}
function TM(t, e) {
  t.action((n) => {
    const r = n.get(It), { state: i } = r, o = K.near(i.doc.resolve(0), 1);
    r.dispatch(i.tr.setSelection(o).insertText(e));
  });
}
function AM(t, e) {
  t.action(iC(hr(e)));
}
const EM = "chips-richtext-card__editor-host";
function vM({ defaultValue: t, onMarkdownChange: e, onReady: n }) {
  const { token: r } = li.useToken(), i = Qe.useRef(null), o = Qe.useRef(e);
  o.current = e;
  const s = Qe.useRef(n);
  return s.current = n, Qe.useEffect(() => {
    const l = i.current;
    if (l === null)
      return;
    let a = null, c = !1;
    return IM({ host: l, defaultValue: t, onMarkdownChange: o.current }).then(
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
  }, [t]), /* @__PURE__ */ L(
    "div",
    {
      ref: i,
      className: EM,
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
function vh(t, e) {
  if (t === "" || t === void 0 || t === null)
    return e;
  const n = typeof t == "number" ? t : Number(t);
  return Number.isFinite(n) && n > 0 ? n : e;
}
function OM({
  content: t,
  contentSource: e,
  onDraftChange: n,
  onMilkdownReady: r
}) {
  const { token: i } = li.useToken(), o = _l(t), s = kg(t), l = o.content_text ?? "", a = Qe.useRef({
    contentText: l,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight
  }), [c, u] = Qe.useState(l), h = () => {
    n({ ...a.current });
  }, d = (y) => {
    a.current.contentText = y, u(y), h();
  }, f = (y, g) => {
    a.current.fontSize = vh(g.fontSize, a.current.fontSize), a.current.lineHeight = vh(g.lineHeight, a.current.lineHeight), h();
  }, p = xg(c), m = Mg(Ig(o.markdown_capabilities));
  return /* @__PURE__ */ ue(
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
        e === "file" ? /* @__PURE__ */ ue(
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
        ) : /* @__PURE__ */ ue(Bm, { children: [
          /* @__PURE__ */ L(
            "div",
            {
              style: {
                color: i.colorText,
                fontSize: s.fontSize,
                lineHeight: String(s.lineHeight),
                overflowWrap: "anywhere"
              },
              children: /* @__PURE__ */ L(
                vM,
                {
                  defaultValue: l,
                  onMarkdownChange: d,
                  onReady: r
                }
              )
            }
          ),
          /* @__PURE__ */ L(
            "p",
            {
              role: "status",
              "data-testid": "richtext-inline-gate",
              style: {
                margin: 0,
                color: i.colorTextSecondary,
                fontSize: i.fontSizeSM
              },
              children: p.shouldUseFile ? `已提取纯文本 ${String(p.length)} 字，超过 ${String(Bs)} 字阈值，保存时正文将文件化存储为卡片内 .md 文件` : `已提取纯文本 ${String(p.length)} 字（≤${String(Bs)} 字阈值内内联保存）`
            }
          ),
          m.length > 0 ? /* @__PURE__ */ L(
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
        /* @__PURE__ */ ue(
          gt,
          {
            layout: "vertical",
            initialValues: {
              fontSize: s.fontSize,
              lineHeight: s.lineHeight
            },
            onValuesChange: f,
            children: [
              /* @__PURE__ */ L(gt.Item, { label: "字号（px）", name: "fontSize", children: /* @__PURE__ */ L(er, { type: "number", min: Ll, max: Pl }) }),
              /* @__PURE__ */ L(gt.Item, { label: "行高倍数", name: "lineHeight", children: /* @__PURE__ */ L(er, { type: "number", min: Bl, step: 0.1 }) })
            ]
          }
        )
      ]
    }
  );
}
function DM(t, e, n) {
  return e === "inline" ? fg(hr(n.contentText)) ? {
    kind: "replace",
    content: wg({ ...t, content_text: n.contentText }, {
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
class RM {
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
    this.base = { ...e.content }, this.contentSource = _l(e.content).content_source, this.revision = e.revision, this.host = n, n.replaceChildren(), this.root = qm(n), this.mount();
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
        MM(this.milkdown);
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
    this.state !== "active" || this.milkdown === null || TM(this.milkdown, e);
  }
  /**
   * 程序化全文替换（宿主驱动/测试面）：以 Markdown 源文整体替换文档，
   * 与 `update()` 基线替换同构，经同一事务路径触发序列化回流。
   */
  replaceDocument(e) {
    this.state !== "active" || this.milkdown === null || AM(this.milkdown, e);
  }
  mount() {
    jm(() => {
      this.root.render(
        /* @__PURE__ */ L(
          OM,
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
    const n = DM(this.base, this.contentSource, e);
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
function zM(t, e) {
  return new RM(t, e);
}
const LM = ({ view: t, onAttach: e, onDetach: n }) => {
  const r = Qe.useRef(null), i = Qe.useRef(e);
  i.current = e;
  const o = Qe.useRef(n);
  return o.current = n, Qe.useEffect(() => {
    const s = r.current;
    if (s === null)
      return;
    const l = zM(t, s);
    return i.current(l), () => {
      o.current(), l.dispose();
    };
  }, [t]), /* @__PURE__ */ L("div", { "data-testid": "editor-mount", style: { width: "100%", minHeight: 0 }, ref: r });
};
function PM(t, e) {
  return t ? "有未保存变更" : e === null ? "未保存" : `已保存（摘要 ${e}）`;
}
const BM = ({
  selected: t,
  cardDraft: e,
  boxDetail: n,
  revision: r,
  dirty: i,
  savedDigest: o,
  writeError: s,
  saveError: l,
  exportError: a,
  commitBusy: c,
  saveBusy: u,
  onAttachEditor: h,
  onDetachEditor: d,
  onSaveNow: f,
  onDiscard: p,
  onExport: m,
  onRefresh: y
}) => {
  const { token: g } = li.useToken(), { modal: S } = Lh.useApp(), [C, E] = Qe.useState(!1), [O] = gt.useForm(), x = t?.documentId ?? null, A = () => {
    i && S.confirm({
      title: "放弃未保存的修改？",
      content: "当前编辑面的未保存修改将被丢弃，文档恢复为最近写入的内容。",
      okText: "放弃修改",
      cancelText: "继续编辑",
      onOk: p
    });
  }, D = () => {
    (async () => {
      const F = await O.validateFields();
      m(F.form, F.target), E(!1);
    })().catch(() => {
    });
  };
  return /* @__PURE__ */ ue(St, { vertical: !0, style: { height: "100%", minWidth: 0 }, gap: g.marginSM, children: [
    /* @__PURE__ */ ue(St, { justify: "space-between", align: "center", gap: g.marginXS, children: [
      /* @__PURE__ */ ue(St, { vertical: !0, gap: 2, children: [
        /* @__PURE__ */ L(Fe.Title, { level: 4, style: { margin: 0 }, children: t === null ? "富文本编辑器" : t.title }),
        /* @__PURE__ */ ue(Fe.Text, { type: "secondary", style: { fontSize: g.fontSizeSM }, children: [
          "修订号 ",
          String(r),
          " · ",
          PM(i, o)
        ] })
      ] }),
      /* @__PURE__ */ ue(St, { gap: g.marginXS, children: [
        /* @__PURE__ */ L(In, { onClick: y, children: "刷新" }),
        /* @__PURE__ */ L(In, { onClick: A, disabled: !i, children: "放弃修改" }),
        /* @__PURE__ */ L(In, { onClick: () => E(!0), disabled: x === null, children: "导出" }),
        /* @__PURE__ */ L(
          In,
          {
            type: "primary",
            onClick: f,
            disabled: x === null,
            loading: u || c,
            children: "保存"
          }
        )
      ] })
    ] }),
    s !== null ? /* @__PURE__ */ L(
      tr,
      {
        type: "error",
        showIcon: !0,
        message: `写入未完成（${s.code}）`,
        description: s.message
      }
    ) : null,
    l !== null ? /* @__PURE__ */ L(
      tr,
      {
        type: "error",
        showIcon: !0,
        message: `保存失败（${l.code}）`,
        description: `${l.message}：请重试保存；自动保存已暂停，等待处置。`
      }
    ) : null,
    a !== null ? /* @__PURE__ */ L(
      tr,
      {
        type: "warning",
        showIcon: !0,
        message: `导出未完成（${a.code}）`,
        description: `${a.message}：document:export 宿主实现候第十三项收口（缺位在册），入口按正式契约接线。`
      }
    ) : null,
    /* @__PURE__ */ L(
      "div",
      {
        style: {
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          background: g.colorBgContainer,
          border: `1px solid ${g.colorBorderSecondary}`,
          borderRadius: g.borderRadiusLG,
          padding: g.padding
        },
        children: t === null ? /* @__PURE__ */ L(
          Nc,
          {
            description: "打开或新建一张富文本卡片开始编辑",
            style: { marginTop: g.marginXXL }
          }
        ) : n !== null ? /* @__PURE__ */ ue(St, { vertical: !0, gap: g.marginSM, children: [
          /* @__PURE__ */ L(Fe.Text, { strong: !0, children: "箱子只读摘要（卡箱浏览面）" }),
          /* @__PURE__ */ ue(Fe.Text, { children: [
            "名称：",
            n.metadata.name
          ] }),
          /* @__PURE__ */ ue(Fe.Text, { children: [
            "布局：",
            n.metadata.active_layout_type
          ] }),
          /* @__PURE__ */ ue(Fe.Text, { children: [
            "条目数：",
            String(n.entries.length)
          ] }),
          /* @__PURE__ */ L(Fe.Text, { type: "secondary", children: "本应用为单文档富文本编辑器：箱子提供浏览面，编辑入口归编辑引擎应用。" })
        ] }) : e === null ? /* @__PURE__ */ L(Nc, { description: "文档装配中" }) : /* @__PURE__ */ L(LM, { view: e.view, onAttach: h, onDetach: d })
      }
    ),
    /* @__PURE__ */ L(
      zh,
      {
        title: "导出当前文档",
        open: C,
        okText: "导出",
        cancelText: "取消",
        onOk: D,
        onCancel: () => E(!1),
        destroyOnClose: !0,
        children: /* @__PURE__ */ ue(gt, { form: O, layout: "vertical", initialValues: { form: "archive" }, children: [
          /* @__PURE__ */ L(
            gt.Item,
            {
              label: "导出形态",
              name: "form",
              rules: [{ required: !0, message: "请选择导出形态" }],
              children: /* @__PURE__ */ L(
                Fm,
                {
                  options: [
                    { value: "archive", label: "归档单文件（archive）" },
                    { value: "directory", label: "目录（directory）" }
                  ]
                }
              )
            }
          ),
          /* @__PURE__ */ L(
            gt.Item,
            {
              label: "导出目标路径",
              name: "target",
              rules: [{ required: !0, message: "请填写导出目标路径" }],
              children: /* @__PURE__ */ L(er, { placeholder: "例如 /导出/东京旅行日记.card" })
            }
          )
        ] })
      }
    )
  ] });
};
class st extends Error {
  code;
  constructor(e, n) {
    super(n), this.name = "DocumentGatewayError", this.code = e;
  }
}
function Sn(t) {
  if (t instanceof st)
    return t;
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return new st(e, t instanceof Error ? t.message : "未知错误");
  }
  return new st(
    "DOCUMENT_GATEWAY_ERROR",
    t instanceof Error ? t.message : "未知错误"
  );
}
function Oh(t) {
  const e = Sn(t);
  return { code: e.code, message: e.message };
}
async function Ar(t, e, n) {
  try {
    return await _t.request("document:read", {
      documentId: t,
      part: e,
      ...n
    });
  } catch (r) {
    throw Sn(r);
  }
}
function Er(t, e) {
  if (t.part !== e)
    throw new st("DOCUMENT_PART_MISMATCH", "文档读取回包切片与请求不一致");
}
function _M(t) {
  const e = t?.revision;
  if (typeof e != "number" || !Number.isInteger(e) || e <= 0)
    throw new st("DOCUMENT_REVISION_INVALID", "文档写入回执缺少有效的修订号");
  return e;
}
function FM(t) {
  const e = t ?? {};
  if (typeof e.source != "string" || e.source.length === 0)
    throw new st("DOCUMENT_SAVE_RECEIPT_INVALID", "文档保存回执缺少来源引用");
  if (typeof e.digest != "string" || e.digest.length === 0)
    throw new st("DOCUMENT_SAVE_RECEIPT_INVALID", "文档保存回执缺少包摘要");
  return { source: e.source, digest: e.digest };
}
function $M() {
  return {
    async open(t) {
      let e;
      try {
        e = await _t.request("document:open", { source: t });
      } catch (n) {
        throw Sn(n);
      }
      return {
        documentId: e.documentId,
        source: e.source,
        kind: e.kind,
        title: e.title,
        digest: e.digest
      };
    },
    async readCardMetadata(t) {
      const e = await Ar(t, "metadata", {});
      Er(e, "metadata");
      const n = e.value;
      if (typeof n.card_id != "string" || n.card_id.length === 0)
        throw new st("DOCUMENT_METADATA_INVALID", "卡片元数据缺少 card_id");
      return n;
    },
    async readBoxMetadata(t) {
      const e = await Ar(t, "metadata", {});
      Er(e, "metadata");
      const n = e.value;
      if (typeof n.box_id != "string" || n.box_id.length === 0)
        throw new st("DOCUMENT_METADATA_INVALID", "箱子元数据缺少 box_id");
      return n;
    },
    async readStructure(t) {
      const e = await Ar(t, "structure", {});
      Er(e, "structure");
      const n = e.value;
      if (!Array.isArray(n.structure))
        throw new st("DOCUMENT_STRUCTURE_INVALID", "结构切片缺少 structure 数组");
      return n;
    },
    async readCardContent(t, e) {
      const n = await Ar(t, "content", { nodeId: e });
      Er(n, "content");
      const r = n.value;
      if (typeof r.node_id != "string" || r.node_id.length === 0)
        throw new st("DOCUMENT_CONTENT_INVALID", "内容节点缺少 node_id");
      return r;
    },
    async readEntries(t, e) {
      const n = await Ar(
        t,
        "entries",
        e === void 0 ? {} : { range: { offset: e.offset, limit: e.limit } }
      );
      Er(n, "entries");
      const r = n.value;
      if (!Array.isArray(r))
        throw new st("DOCUMENT_ENTRIES_INVALID", "条目切片必须是数组");
      return r;
    },
    async writeCardContent(t, e, n) {
      let r;
      try {
        r = await _t.request("document:write", {
          documentId: t,
          part: "content",
          nodeId: e,
          value: n
        });
      } catch (i) {
        throw Sn(i);
      }
      return _M(r);
    },
    async saveDocument(t) {
      let e;
      try {
        e = await _t.request("document:save", { documentId: t });
      } catch (n) {
        throw Sn(n);
      }
      return FM(e);
    },
    async createDocument(t) {
      try {
        return await _t.request("document:create", {
          kind: t.kind,
          parent: t.parent,
          ...t.name === void 0 ? {} : { name: t.name },
          ...t.initialContent === void 0 ? {} : { initialContent: t.initialContent }
        });
      } catch (e) {
        throw Sn(e);
      }
    },
    async exportDocument(t) {
      try {
        return await _t.request("document:export", {
          documentId: t.documentId,
          target: t.target,
          form: t.form,
          ...t.overwrite === void 0 ? {} : { overwrite: t.overwrite }
        });
      } catch (e) {
        throw Sn(e);
      }
    }
  };
}
function VM() {
  return $M();
}
function HM(t) {
  return t.replace(/\\/g, "/").split("/").filter((e) => e.length > 0);
}
function jM(t) {
  if (typeof t != "string")
    return null;
  const e = t.replace(/\\/g, "/").trim();
  if (!e || /^[a-z][a-z0-9+.-]*:/i.test(e) || e.startsWith("//") || e.startsWith("/") || e.includes("?") || e.includes("#"))
    return null;
  const n = e.replace(/^\.?\//, ""), r = HM(n);
  return r.length === 0 || r.some((i) => i === "." || i === "..") ? null : r.join("/");
}
const qM = "3:4";
function WM(t) {
  return {
    kind: "basecard",
    node_id: t.nodeId,
    card_type: "base.richtext",
    content: { ...t.content },
    revision: t.revision,
    card: {
      card_id: t.cardId,
      name: t.cardName,
      chip_standards_version: "1.0.0",
      cover_ratio: t.coverRatio ?? qM,
      tags: t.tags ?? []
    }
  };
}
const Ae = "EDIT_VALIDATION_FAILED", KM = [
  "commonmark",
  "gfm",
  "math",
  "highlight",
  "underline",
  "superscript",
  "subscript"
];
function Pm(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t) ? t : null;
}
function UM(t) {
  return typeof t == "string" && t.trim().length > 0 ? t.trim() : null;
}
function JM(t) {
  if (typeof t != "string")
    return !1;
  const e = jM(t);
  return !!e && e === t && e.toLowerCase().endsWith(".md") && !e.startsWith(".card/") && !e.startsWith("content/");
}
function GM(t) {
  if (t.card_type !== "base.richtext")
    return {
      ok: !1,
      errorCode: Ae,
      message: "content_type 必须为 base.richtext"
    };
  if (t.content_format !== "markdown")
    return {
      ok: !1,
      errorCode: Ae,
      message: "content_format 必须为 markdown"
    };
  const e = t.content_source;
  if (e === "inline") {
    if (UM(t.content_text) === null)
      return { ok: !1, errorCode: Ae, message: "inline 模式正文不能为空" };
    if (t.content_file !== void 0)
      return {
        ok: !1,
        errorCode: Ae,
        message: "inline 模式不能携带 content_file"
      };
  } else if (e === "file") {
    if (!JM(t.content_file))
      return {
        ok: !1,
        errorCode: Ae,
        message: "content_file 必须为卡片根相对的 .md 资源路径"
      };
    const r = t.content_text;
    if (typeof r == "string" && r.trim().length > 0)
      return {
        ok: !1,
        errorCode: Ae,
        message: "file 模式不能携带非空 content_text"
      };
  } else
    return {
      ok: !1,
      errorCode: Ae,
      message: "content_source 必须为 inline 或 file"
    };
  const n = Pm(t.markdown_capabilities);
  if (n === null)
    return {
      ok: !1,
      errorCode: Ae,
      message: "markdown_capabilities 必须显式声明"
    };
  for (const r of KM)
    if (typeof n[r] != "boolean")
      return {
        ok: !1,
        errorCode: Ae,
        message: `markdown_capabilities.${r} 必须显式声明为布尔值`
      };
  return bg(t.config) ? { ok: !0 } : {
    ok: !1,
    errorCode: Ae,
    message: "展示 config 不满足插件 configSchema 口径"
  };
}
function YM(t) {
  for (const e of t) {
    if (e.op !== "add" && e.op !== "remove" && e.op !== "replace")
      return {
        ok: !1,
        errorCode: Ae,
        message: `patch 操作 ${e.op} 不在契约取值内`
      };
    if (!e.path.startsWith("/") || e.path.length < 2)
      return {
        ok: !1,
        errorCode: Ae,
        message: "patch 指针必须为非根 RFC 6901 相对指针"
      };
    if (e.path.includes("~"))
      return { ok: !1, errorCode: Ae, message: "patch 指针不允许 ~ 转义段" };
    if (e.op !== "remove" && e.value === void 0)
      return {
        ok: !1,
        errorCode: Ae,
        message: "add / replace 操作必须携带 value"
      };
  }
  return { ok: !0 };
}
function XM(t) {
  if (t.kind === "replace") {
    const e = Pm(t.content);
    return e === null ? {
      ok: !1,
      errorCode: Ae,
      message: "replace 变更内容必须是对象"
    } : GM(e);
  }
  return YM(t.operations);
}
function Dh(t) {
  return JSON.parse(JSON.stringify(t));
}
function Dl(t, e) {
  if (t === e)
    return !0;
  if (typeof t != "object" || typeof e != "object" || t === null || e === null || Array.isArray(t) !== Array.isArray(e))
    return !1;
  if (Array.isArray(t) && Array.isArray(e))
    return t.length === e.length && t.every((s, l) => Dl(s, e[l]));
  const n = t, r = e, i = Object.keys(n), o = Object.keys(r);
  return i.length !== o.length ? !1 : i.every(
    (s) => s in r && Dl(n[s], r[s])
  );
}
function QM(t) {
  return t.slice(1).split("/");
}
function ZM(t, e) {
  if (e.kind === "replace") {
    const r = { ...e.content };
    return "theme" in t && !("theme" in r) && (r.theme = t.theme), r;
  }
  const n = Dh(t);
  for (const r of e.operations) {
    const i = QM(r.path), o = i[i.length - 1] ?? "";
    let s = n;
    for (const l of i.slice(0, -1)) {
      const a = s[l];
      if (a == null) {
        const c = {};
        s[l] = c, s = c;
        continue;
      }
      if (typeof a != "object" || Array.isArray(a))
        return null;
      s = a;
    }
    if (r.op === "remove") {
      delete s[o];
      continue;
    }
    s[o] = Dh(r.value);
  }
  return n;
}
function zs(t, e) {
  if (typeof t == "object" && t !== null && "code" in t) {
    const n = t.code;
    if (typeof n == "string" && n.length > 0)
      return { errorCode: n, message: t instanceof Error ? t.message : "未知错误" };
  }
  return { errorCode: e, message: t instanceof Error ? t.message : "未知错误" };
}
class eT {
  documentId;
  nodeId;
  watermark;
  baseline;
  pending = null;
  editor = null;
  changeSubscription = null;
  constructor(e, n, r = 0) {
    this.documentId = e, this.nodeId = n, this.watermark = r, this.baseline = {};
  }
  /** 当前修订水位（已确认的最近 `{ revision }` 回执；0 = 本会话尚未写入）。 */
  get revision() {
    return this.watermark;
  }
  /** 是否持有待提交变更。 */
  isDirty() {
    return this.pending !== null;
  }
  /** 裁决第①拍：取待提交变更（附着编辑器时直读编辑器，否则取会话镜像）。 */
  getChange() {
    return this.editor !== null ? this.editor.getChange() : this.pending;
  }
  /** 会话基线（宿主模型内容根的最后确认快照）。 */
  getBaseline() {
    return this.baseline;
  }
  /** 装载会话基线（打开/重读投影后调用；视图装配经 `assembleBaseCardView`）。 */
  setBaseline(e, n) {
    this.baseline = e, Number.isInteger(n) && n > this.watermark && (this.watermark = n);
  }
  /** 附着编辑器：订阅 change 事件维护待提交镜像（时序第①拍 `getChange` 留给提交链）。 */
  attachEditor(e) {
    this.detachEditor(), this.editor = e, this.changeSubscription = e.subscribe(
      "change",
      (n) => {
        this.pending = n.change;
      }
    );
  }
  /** 解除编辑器附着：撤销订阅；待提交镜像随编辑面释放清空（08 §4.3 规则 9 同口径）。 */
  detachEditor() {
    this.changeSubscription?.dispose(), this.changeSubscription = null, this.editor = null, this.pending = null;
  }
  /** 直接暂存变更（程序化驱动面；与 change 事件同语义）。 */
  stageChange(e) {
    this.pending = e;
  }
  /** 放弃会话待提交镜像；编辑面草稿经重挂载丢弃（08 §4.3 规则 9）。 */
  discard() {
    this.pending = null;
  }
  /**
   * 提交链（回流唯一时序的应用前端侧落点）：
   * ① `getChange()` → ② 校验 → ③ `document:write`（修订回执）→ ④ 投影重读（update）→
   * ⑤ `markCommitted`。任一前序拍失败即短路：校验失败不触达写通道；写失败不动投影与水位；
   * 回执未严格递增不确认提交；投影失败不确认提交（写已发生但会话视图未证实，可重试）；
   * 投影与写值发散（外部并发修改）时确认提交并报告 `diverged`，界面以宿主真相重挂基线。
   */
  async commit(e) {
    const n = this.getChange();
    if (n === null)
      return { status: "no-change" };
    const r = XM(n);
    if (!r.ok)
      return { status: "invalid", errorCode: r.errorCode, message: r.message };
    const i = ZM(this.baseline, n);
    if (i === null)
      return {
        status: "invalid",
        errorCode: Ae,
        message: "patch 变更在基线上不可应用（中途位非对象）"
      };
    let o;
    try {
      o = await e.writeNode(i);
    } catch (a) {
      const c = zs(a, "DOCUMENT_GATEWAY_ERROR");
      return { status: "write-failed", errorCode: c.errorCode, message: c.message };
    }
    if (!Number.isInteger(o) || o <= 0 || o <= this.watermark)
      return { status: "revision-stale", received: o, watermark: this.watermark };
    let s;
    try {
      s = await e.readNode();
    } catch (a) {
      const c = zs(a, "DOCUMENT_GATEWAY_ERROR");
      return {
        status: "projection-failed",
        revision: o,
        errorCode: c.errorCode,
        message: c.message
      };
    }
    const l = !Dl(s, i);
    return this.editor?.markCommitted(o), this.pending = null, this.watermark = o, this.baseline = l ? s : i, l ? { status: "diverged", revision: o } : { status: "committed", revision: o };
  }
  /**
   * 保存链（12 §6.3 规则 3 / 规则 5）：脏状态先完成当前待提交回流（flush），随后立即
   * `document:save`；干净状态直接保存（幂等）。回流未确认（invalid / write-failed /
   * revision-stale / projection-failed）即阻断保存，不触达落盘入口。
   */
  async flushAndSave(e) {
    let n = null;
    if (this.isDirty()) {
      const r = await this.commit(e);
      if (r.status === "committed" || r.status === "diverged")
        n = r.revision;
      else if (r.status !== "no-change")
        return { status: "commit-blocked", outcome: r };
    }
    try {
      return { status: "saved", receipt: await e.save(), committedRevision: n };
    } catch (r) {
      const i = zs(r, "DOCUMENT_GATEWAY_ERROR");
      return { status: "save-failed", errorCode: i.errorCode, message: i.message };
    }
  }
  /** 以会话基线与当前水位装配编辑器视图（重挂载/divergence 采纳面）。 */
  assembleCurrentView(e) {
    return WM({
      nodeId: this.nodeId,
      cardId: e.cardId,
      cardName: e.cardName,
      content: this.baseline,
      revision: this.watermark
    });
  }
}
const tT = 500;
function nT(t) {
  return {
    cards: t.filter((e) => e.kind === "card"),
    boxes: t.filter((e) => e.kind === "box")
  };
}
function Ls(t) {
  const e = t.trim();
  return e.length > 0 ? e : null;
}
function rT(t = VM()) {
  const [e, n] = fe("idle"), [r, i] = fe(null), [o, s] = fe(null), [l, a] = fe([]), [c, u] = fe(null), [h, d] = fe(null), [f, p] = fe(null), [m, y] = fe(0), [g, S] = fe(!1), [C, E] = fe(null), [O, x] = fe(null), [A, D] = fe(null), [F, N] = fe(null), [R, P] = fe(null), [ee, se] = fe(!1), [Y, me] = fe(!1), [ge, Be] = fe(null), ae = Zt(t);
  ae.current = t;
  const b = Zt(l);
  b.current = l;
  const he = Zt(null);
  he.current = c;
  const dt = Zt(!1), k = Zt(/* @__PURE__ */ new Map()), be = Zt(null), xt = Zt(!1);
  xt.current = Y;
  const re = we(() => {
    be.current !== null && (window.clearTimeout(be.current), be.current = null);
  }, []);
  Zn(() => re, [re]);
  const Re = we((z) => typeof z == "object" && z !== null && "code" in z ? String(z.code) : "DOCUMENT_GATEWAY_ERROR", []), pt = we((z, H) => {
    const _ = k.current.get(z);
    if (_ !== void 0)
      return _;
    const w = new eT(z, H);
    return k.current.set(z, w), w;
  }, []), Ke = we((z, H) => {
    const _ = k.current.get(z);
    if (_ === void 0) {
      d(null);
      return;
    }
    d({
      nodeId: _.nodeId,
      view: _.assembleCurrentView({ cardId: _.documentId, cardName: H.title })
    });
  }, []), Ue = we(
    async (z) => {
      if (z.kind === "box") {
        const [$, J] = await Promise.all([
          ae.current.readBoxMetadata(z.documentId),
          ae.current.readEntries(z.documentId)
        ]);
        p({ metadata: $, entries: J }), d(null);
        return;
      }
      await ae.current.readCardMetadata(z.documentId);
      const _ = (await ae.current.readStructure(z.documentId)).structure[0];
      if (_ === void 0)
        throw Object.assign(new Error("目标卡片不包含基础卡片节点"), {
          code: "DOCUMENT_STRUCTURE_INVALID"
        });
      if (_.type !== "base.richtext")
        throw Object.assign(new Error("目标卡片不包含富文本基础卡片"), {
          code: "DOCUMENT_STRUCTURE_INVALID"
        });
      const w = await ae.current.readCardContent(z.documentId, _.id), T = pt(z.documentId, _.id);
      T.setBaseline({ ...w.value }, 0), p(null), y(T.revision), Ke(z.documentId, z);
    },
    [pt, Ke]
  ), Xt = we(
    async (z) => {
      const H = Ls(z);
      if (H === null) {
        s("请输入非空的文档来源引用");
        return;
      }
      n("opening"), i(null), x(null), D(null), E(null);
      try {
        const _ = await ae.current.open(H);
        a((w) => [...w.filter(($) => $.documentId !== _.documentId), _]), u(_.documentId), n("ready"), await Ue(_), s(`已打开「${_.title}」`);
      } catch (_) {
        n("error"), i(Re(_)), s(`文档打开失败（${Re(_)}）：请核对来源引用与文档可用性`);
      }
    },
    [Ue, Re]
  ), _o = we(
    async (z) => {
      const H = b.current.find((w) => w.documentId === z);
      if (H === void 0)
        return;
      u(z), i(null), x(null), D(null), E(null), re();
      const _ = k.current.get(z);
      y(_?.revision ?? 0), S(_?.isDirty() ?? !1);
      try {
        await Ue(H);
      } catch (w) {
        i(Re(w)), s(`文档读取失败（${Re(w)}）`);
      }
    },
    [Ue, re, Re]
  ), Fo = we(async () => {
    const z = he.current, H = b.current.find((_) => _.documentId === z);
    if (z === null || H === void 0) {
      s("当前没有选中的文档");
      return;
    }
    i(null);
    try {
      await Ue(H), s("当前视图已刷新");
    } catch (_) {
      i(Re(_)), s(`文档刷新失败（${Re(_)}）`);
    }
  }, [Ue, Re]), $o = we(async () => {
    const z = he.current, H = z === null ? void 0 : k.current.get(z), _ = b.current.find((w) => w.documentId === z);
    if (!(H === void 0 || _ === void 0 || !H.isDirty() || ee)) {
      x(null), se(!0);
      try {
        const w = await H.commit({
          writeNode: (T) => ae.current.writeCardContent(H.documentId, H.nodeId, T),
          readNode: async () => ({ ...(await ae.current.readCardContent(H.documentId, H.nodeId)).value })
        });
        if (w.status === "committed") {
          y(H.revision), S(H.isDirty()), s(`修改已写入（修订号 ${String(w.revision)}），保存到磁盘后落盘`);
          return;
        }
        if (w.status === "diverged") {
          y(H.revision), S(H.isDirty()), Ke(H.documentId, _), s("检测到外部修改，已采纳文档最新内容");
          return;
        }
        if (w.status === "revision-stale") {
          x({
            code: "DOCUMENT_REVISION_INVALID",
            message: `修订回执未严格递增（收到 ${String(w.received)}，当前 ${String(w.watermark)}）`
          });
          return;
        }
        w.status !== "no-change" && x({ code: w.errorCode, message: w.message });
      } finally {
        se(!1);
      }
    }
  }, [ee, Ke]), qn = we(async () => {
    const z = he.current, H = z === null ? void 0 : k.current.get(z);
    if (H === void 0) {
      s("当前没有选中的文档");
      return;
    }
    if (!xt.current) {
      re(), D(null), me(!0);
      try {
        const _ = await H.flushAndSave({
          writeNode: (w) => ae.current.writeCardContent(H.documentId, H.nodeId, w),
          readNode: async () => ({ ...(await ae.current.readCardContent(H.documentId, H.nodeId)).value }),
          save: () => ae.current.saveDocument(H.documentId)
        });
        if (_.status === "saved") {
          y(H.revision), S(H.isDirty()), E(_.receipt.digest), s(`已保存到磁盘（摘要 ${_.receipt.digest}）`);
          return;
        }
        if (_.status === "commit-blocked") {
          const w = _.outcome;
          if (w.status === "revision-stale") {
            x({
              code: "DOCUMENT_REVISION_INVALID",
              message: `修订回执未严格递增（收到 ${String(w.received)}，当前 ${String(w.watermark)}）`
            });
            return;
          }
          x({ code: w.errorCode, message: w.message });
          return;
        }
        D({ code: _.errorCode, message: _.message });
      } finally {
        me(!1);
      }
    }
  }, [re]);
  Zn(() => {
    if (dt.current = g, !g || O !== null || A !== null) {
      re();
      return;
    }
    return be.current = window.setTimeout(() => {
      be.current = null, qn();
    }, tT), re;
  }, [re, g, A, qn, O]);
  const Ii = we((z) => {
    const H = he.current, _ = H === null ? void 0 : k.current.get(H);
    if (_ === void 0)
      return;
    _.attachEditor(z);
    const w = z;
    Be(
      typeof w.insertText == "function" && typeof w.replaceDocument == "function" ? {
        insertText: w.insertText.bind(z),
        replaceDocument: w.replaceDocument.bind(z)
      } : null
    ), z.subscribe("dirty", (T) => {
      S(T.isDirty);
    });
  }, []), Mi = we(() => {
    const z = he.current;
    (z === null ? void 0 : k.current.get(z))?.detachEditor(), Be(null), S(!1);
  }, []), Vo = we(() => {
    const z = he.current;
    if (z === null)
      return;
    const H = k.current.get(z), _ = b.current.find((w) => w.documentId === z);
    H === void 0 || _ === void 0 || (H.discard(), x(null), S(!1), Ke(z, _), s("已放弃未保存的修改"));
  }, [Ke]), Ti = we(
    async (z, H, _) => {
      N(null);
      const w = H.trim(), T = Ls(_);
      if (T === null) {
        N({
          code: "BRIDGE_INVALID_INPUT",
          message: "请填写新建落点（父目录受管引用）"
        });
        return;
      }
      try {
        const $ = await ae.current.createDocument({
          kind: z,
          parent: T,
          ...w.length > 0 ? { name: w } : {},
          ...z === "card" ? { initialContent: { cardType: "base.richtext" } } : {}
        });
        s("已创建新文档，正在打开"), await Xt($.source);
      } catch ($) {
        const J = Oh($);
        N(J);
      }
    },
    [Xt]
  ), Ai = we(
    async (z, H) => {
      const _ = he.current, w = Ls(H);
      if (_ === null) {
        P({ code: "DOCUMENT_GATEWAY_ERROR", message: "当前没有选中的文档" });
        return;
      }
      if (w === null) {
        P({ code: "BRIDGE_INVALID_INPUT", message: "请填写导出目标路径" });
        return;
      }
      P(null);
      try {
        const T = await ae.current.exportDocument({
          documentId: _,
          target: w,
          form: z
        });
        s(`已导出到 ${T.target}`);
      } catch (T) {
        P(Oh(T));
      }
    },
    []
  );
  Zn(() => {
    if (o === null || e === "error")
      return;
    const z = window.setTimeout(() => {
      s(null);
    }, 2400);
    return () => {
      window.clearTimeout(z);
    };
  }, [o, e]);
  const Ho = Ps(() => nT(l), [l]), jo = Ps(
    () => c === null ? null : l.find((z) => z.documentId === c) ?? null,
    [l, c]
  );
  return {
    status: e,
    errorCode: r,
    feedback: o,
    library: Ho,
    selectedId: c,
    selected: jo,
    cardDraft: h,
    boxDetail: f,
    revision: m,
    dirty: g,
    savedDigest: C,
    writeError: O,
    saveError: A,
    createError: F,
    exportError: R,
    commitBusy: ee,
    saveBusy: Y,
    editorDriver: ge,
    openSource: Xt,
    select: _o,
    refreshCurrent: Fo,
    commitPending: $o,
    saveNow: qn,
    discardEdits: Vo,
    attachEditor: Ii,
    detachEditor: Mi,
    createDocument: Ti,
    exportDocument: Ai
  };
}
const Nn = "chips.official.rich-text-editor", Ge = {
  openCard: "rich-text-editor:open-card",
  saveDocument: "rich-text-editor:save-document",
  exportDocument: "rich-text-editor:export-document",
  newCard: "rich-text-editor:new-card",
  refreshView: "rich-text-editor:refresh-view"
}, vr = {
  openCard: "open-card",
  saveDocument: "save-document",
  exportDocument: "export-document",
  newCard: "new-card",
  refreshView: "refresh-view"
}, Rl = [
  {
    id: Ge.openCard,
    title: "打开卡片",
    description: "打开指定的卡片文件并在主窗口中编辑",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: Nn },
    handlerId: vr.openCard,
    keywords: ["open", "card", "打开", "卡片"],
    group: "文件"
  },
  {
    id: Ge.saveDocument,
    title: "保存当前文档",
    description: "完成待提交回流并把当前文档落盘（document:save）",
    shortcut: "CommandOrControl+S",
    scope: { kind: "app", appId: Nn },
    handlerId: vr.saveDocument,
    keywords: ["save", "保存", "落盘"],
    group: "文件"
  },
  {
    id: Ge.exportDocument,
    title: "导出当前文档",
    description: "把当前文档导出为归档或目录形态（document:export；宿主实现在途）",
    scope: { kind: "app", appId: Nn },
    handlerId: vr.exportDocument,
    keywords: ["export", "导出", "另存"],
    group: "文件"
  },
  {
    id: Ge.newCard,
    title: "新建富文本卡片",
    description: "在指定落点新建富文本卡片（document:create；宿主实现在途）",
    scope: { kind: "app", appId: Nn },
    handlerId: vr.newCard,
    keywords: ["new", "create", "新建", "卡片"],
    group: "文件"
  },
  {
    id: Ge.refreshView,
    title: "刷新当前视图",
    description: "重新拉取当前展示数据",
    shortcut: "F5",
    scope: { kind: "app", appId: Nn },
    handlerId: vr.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  }
];
new Set(Object.values(Ge));
function iT(t, e) {
  const n = {
    "open-card": (r) => {
      const i = oT(r);
      if (i === null) {
        e({ commandId: Ge.openCard, handlerId: "open-card", ok: !1 });
        return;
      }
      t.openCard(i), e({ commandId: Ge.openCard, handlerId: "open-card", ok: !0 });
    },
    "save-document": () => {
      t.saveDocument(), e({ commandId: Ge.saveDocument, handlerId: "save-document", ok: !0 });
    },
    "export-document": () => {
      t.exportDocument(), e({ commandId: Ge.exportDocument, handlerId: "export-document", ok: !0 });
    },
    "new-card": () => {
      t.newCard(), e({ commandId: Ge.newCard, handlerId: "new-card", ok: !0 });
    },
    "refresh-view": () => {
      t.refreshView(), e({ commandId: Ge.refreshView, handlerId: "refresh-view", ok: !0 });
    }
  };
  return Rl.map((r) => {
    const i = r.handlerId ?? "";
    return {
      commandId: r.id,
      handlerId: i,
      handler: (o) => {
        n[i](o);
      }
    };
  });
}
function oT(t) {
  if (typeof t != "object" || t === null)
    return null;
  const e = t.path;
  return typeof e != "string" || e.trim().length === 0 ? null : e.trim();
}
const sT = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function Rh(t) {
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function lT() {
  const t = $m(), [e, n] = fe("registering"), [r, i] = fe(null), [o, s] = fe(null), l = Zt(null);
  Zn(() => {
    let u = !1, h = null;
    return n("registering"), i(null), (async () => {
      try {
        for (const d of Rl)
          await _t.request("command:register", { definition: d });
        if (u)
          return;
        h = t.attach(
          iT(
            {
              openCard: (d) => {
                l.current?.openCard(d);
              },
              saveDocument: () => {
                l.current?.saveDocument();
              },
              exportDocument: () => {
                l.current?.exportDocument();
              },
              newCard: () => {
                l.current?.newCard();
              },
              refreshView: () => {
                l.current?.refreshView();
              }
            },
            (d) => {
              s(d);
            }
          )
        ), n("ready");
      } catch (d) {
        u || (i(Rh(d)), n("error"));
      }
    })(), () => {
      u = !0, h?.dispose();
      for (const d of Rl)
        _t.request("command:unregister", { commandId: d.id }).catch(() => {
        });
    };
  }, [t]);
  const a = we((u) => {
    l.current = u;
  }, []), c = we(() => {
    t.invoke({ commandId: Ge.refreshView, source: "api" }).catch((h) => {
      i(Rh(h));
    });
  }, [t]);
  return { phase: e, errorCode: r, lastInvoked: o, setActions: a, invokeRefresh: c };
}
function aT(t) {
  if (typeof t != "object" || t === null)
    return null;
  const e = t;
  if (e.pluginId !== Nn)
    return null;
  const n = e.context;
  if (typeof n != "object" || n === null)
    return null;
  const r = n;
  return typeof r.uri != "string" || r.uri.trim().length === 0 ? null : n;
}
const cT = () => {
  const { token: t } = li.useToken(), e = rT(), { openSource: n, saveNow: r, exportDocument: i, createDocument: o, refreshCurrent: s, selected: l } = e, { phase: a, errorCode: c, setActions: u } = lT(), h = Ps(
    () => ({
      openCard: (d) => {
        n(d);
      },
      saveDocument: () => {
        r();
      },
      exportDocument: () => {
        i("archive", `/${l?.title ?? "未命名卡片"}.card`);
      },
      newCard: () => {
        o("card", "", "chips-resource://ws");
      },
      refreshView: () => {
        s();
      }
    }),
    [o, i, n, s, r, l]
  );
  return Zn(() => (u(h), () => {
    u(null);
  }), [h, u]), Zn(() => {
    let d = !1, f = null;
    try {
      f = _t.subscribe("resource:opened", (p) => {
        if (d)
          return;
        const m = aT(p);
        m !== null && n(m.uri);
      });
    } catch {
    }
    return () => {
      d = !0, f?.dispose();
    };
  }, [n]), /* @__PURE__ */ ue(St, { style: { height: "100%", background: t.colorBgLayout }, children: [
    /* @__PURE__ */ L(
      "aside",
      {
        style: {
          width: 280,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          padding: t.padding,
          background: t.colorBgContainer,
          borderInlineEnd: `1px solid ${t.colorBorderSecondary}`,
          overflow: "hidden"
        },
        children: /* @__PURE__ */ L(
          lg,
          {
            library: e.library,
            selectedId: e.selectedId,
            status: e.status,
            feedback: e.feedback,
            createError: e.createError,
            onSelect: (d) => {
              e.select(d);
            },
            onOpenSource: (d) => {
              e.openSource(d);
            },
            onCreateDocument: (d, f, p) => {
              e.createDocument(d, f, p);
            }
          }
        )
      }
    ),
    /* @__PURE__ */ L("main", { style: { flex: 1, minWidth: 0, padding: t.padding }, children: /* @__PURE__ */ L(
      BM,
      {
        selected: e.selected,
        cardDraft: e.cardDraft,
        boxDetail: e.boxDetail,
        revision: e.revision,
        dirty: e.dirty,
        savedDigest: e.savedDigest,
        writeError: e.writeError,
        saveError: e.saveError,
        exportError: e.exportError,
        commitBusy: e.commitBusy,
        saveBusy: e.saveBusy,
        onAttachEditor: e.attachEditor,
        onDetachEditor: e.detachEditor,
        onSaveNow: () => {
          e.saveNow();
        },
        onDiscard: e.discardEdits,
        onExport: (d, f) => {
          e.exportDocument(d, f);
        },
        onRefresh: () => {
          e.refreshCurrent();
        }
      }
    ) }),
    a !== "ready" ? /* @__PURE__ */ ue("div", { style: { position: "absolute", insetInlineEnd: t.margin, bottom: t.margin }, children: [
      /* @__PURE__ */ ue(Fe.Text, { type: "secondary", style: { fontSize: t.fontSizeSM }, children: [
        sT[a],
        a === "error" && c !== null ? `（${c}）` : ""
      ] }),
      a === "error" ? /* @__PURE__ */ L(
        tr,
        {
          type: "warning",
          showIcon: !0,
          style: { marginTop: t.marginXXS },
          message: "命令通道异常"
        }
      ) : null
    ] }) : null
  ] });
}, yT = () => /* @__PURE__ */ L(Vm, { appId: Nn, surface: "window", children: /* @__PURE__ */ L(Hm, { children: /* @__PURE__ */ L(Lh, { children: /* @__PURE__ */ L(cT, {}) }) }) });
export {
  yT as AppView,
  yT as default
};
