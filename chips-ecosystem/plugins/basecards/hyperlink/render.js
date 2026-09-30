import { jsx as s, jsxs as p, Fragment as D } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { flushSync as z } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as U } from "chips-resource://platform/vendor/react-dom-client.js";
import R from "chips-resource://platform/vendor/react.js";
import { theme as O, Button as K, Tag as I, Form as d, Input as m, Segmented as P, Switch as M } from "chips-resource://platform/vendor/chips-ui.js";
class h extends Error {
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
    return new h({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function W(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const B = "SDK_BRIDGE_UNAVAILABLE", T = "SDK_UNKNOWN_ERROR", x = "发生未知错误";
function V(t) {
  return t instanceof Error;
}
function j(t) {
  if (t instanceof h)
    return t;
  if (W(t)) {
    const e = t, r = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new h(r);
  }
  return V(t) ? new h({
    code: T,
    message: x,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new h({
    code: T,
    message: x,
    details: { value: String(t) },
    retryable: !1
  });
}
function G() {
  return new h({
    code: B,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function a(t, e, r) {
  let n;
  try {
    n = t();
  } catch (i) {
    return Promise.reject(j(i));
  }
  return n.request(e, r);
}
const F = "cli.command.list", $ = "cli.command.get", q = "cli.command.resolve";
function X(t) {
  return {
    list(e) {
      return a(t, F, e ?? {});
    },
    get(e) {
      return a(t, $, e);
    },
    resolve(e) {
      return a(t, q, e);
    }
  };
}
const u = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, Y = "cli.task.create", Z = "cli.task.bindInvocation", J = "cli.task.cancel";
function Q(t) {
  return {
    create(e) {
      return a(t, Y, e).then((r) => r.task);
    },
    bindInvocation(e) {
      return a(t, Z, e).then((r) => r.task);
    },
    get(e) {
      const r = { taskId: e };
      return a(t, u.CLI_TASK_GET, r).then((n) => n.task);
    },
    active(e) {
      const r = { commandId: e };
      return a(t, u.CLI_TASK_ACTIVE, r).then((n) => n.task);
    },
    progress(e, r) {
      const n = { taskId: e, progress: r };
      return a(t, u.CLI_TASK_PROGRESS, n).then((i) => i.task);
    },
    complete(e, r) {
      const n = {
        taskId: e,
        ...r === void 0 ? {} : { output: r }
      };
      return a(t, u.CLI_TASK_COMPLETE, n).then((i) => i.task);
    },
    fail(e, r) {
      const n = { taskId: e, error: r };
      return a(t, u.CLI_TASK_FAIL, n).then((i) => i.task);
    },
    cancel(e) {
      return a(t, J, { taskId: e }).then((r) => r.task);
    }
  };
}
function ee() {
  return globalThis.window?.chips;
}
class te {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = X(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = Q(() => this.#e());
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
    const e = ee();
    if (e === void 0)
      throw G();
    return e;
  }
  /**
   * 唯一能力调用入口；转发给目标 Bridge。
   *
   * @param capabilityId - 能力 ID（`<domain>:<action>[:<target>]`）
   * @param input - 能力输入，校验与权限判定由平台完成
   * @returns 能力输出；目标不可用或平台调用失败时以 `ChipsError` 拒绝
   */
  request(e, r) {
    return a(() => this.#e(), e, r);
  }
  /**
   * 订阅标准事件；转发给目标 Bridge。
   *
   * @param eventId - 事件 ID
   * @param handler - 载荷回调；同一 `(eventId, handler)` 多次订阅各自独立
   * @returns 可退订句柄，`dispose()` 幂等
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  subscribe(e, r) {
    return this.#e().subscribe(e, r);
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
function re(t) {
  return new te(t?.bridge);
}
const ne = re(), y = {
  anchor_text: "",
  description: "",
  display_density: "comfortable",
  show_security_hint: !0
}, ie = [
  "compact",
  "comfortable",
  "spacious"
], se = {
  compact: "紧凑",
  comfortable: "舒适",
  spacious: "宽松"
};
function c(t) {
  const e = typeof t == "string" ? t.trim() : "";
  if (e.length === 0)
    return {
      input: e,
      normalizedUrl: "",
      protocol: "",
      hostname: "",
      openable: !1,
      level: "empty",
      reason: "empty"
    };
  let r;
  try {
    r = new URL(e);
  } catch {
    const l = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(?:[/?#:]|$)/.exec(e);
    return l !== null ? {
      input: e,
      normalizedUrl: "",
      protocol: `${l[1].toLowerCase()}:`,
      hostname: "",
      openable: !1,
      level: "blocked",
      reason: "missing-host"
    } : {
      input: e,
      normalizedUrl: "",
      protocol: "",
      hostname: "",
      openable: !1,
      level: "blocked",
      reason: "invalid"
    };
  }
  const n = r.protocol.toLowerCase(), i = r.hostname.trim();
  if (n !== "http:" && n !== "https:")
    return {
      input: e,
      normalizedUrl: "",
      protocol: n,
      hostname: i,
      openable: !1,
      level: "blocked",
      reason: "unsupported-protocol"
    };
  if (i.length === 0)
    return {
      input: e,
      normalizedUrl: "",
      protocol: n,
      hostname: i,
      openable: !1,
      level: "blocked",
      reason: "missing-host"
    };
  if (r.username.length > 0 || r.password.length > 0)
    return {
      input: e,
      normalizedUrl: "",
      protocol: n,
      hostname: i,
      openable: !1,
      level: "blocked",
      reason: "credentials-blocked"
    };
  const o = r.toString();
  return n === "http:" ? {
    input: e,
    normalizedUrl: o,
    protocol: n,
    hostname: i,
    openable: !0,
    level: "warning",
    reason: "insecure-http"
  } : {
    input: e,
    normalizedUrl: o,
    protocol: n,
    hostname: i,
    openable: !0,
    level: "secure",
    reason: "secure"
  };
}
function A(t) {
  const e = typeof t == "string" ? t : "", r = c(e);
  return r.openable ? r.normalizedUrl : e.trim();
}
function L(t) {
  return typeof t == "string" ? t : void 0;
}
function oe(t) {
  return typeof t == "boolean" ? t : void 0;
}
function le(t) {
  return t === "compact" || t === "comfortable" || t === "spacious" ? t : y.display_density;
}
function f(t) {
  const e = typeof t == "object" && t !== null ? t : {};
  return {
    anchor_text: L(e.anchor_text)?.trim() ?? y.anchor_text,
    url: A(e.url),
    description: L(e.description) ?? y.description,
    icon_url: A(e.icon_url),
    display_density: le(e.display_density),
    show_security_hint: oe(e.show_security_hint) ?? y.show_security_hint
  };
}
function b(t) {
  return t.openable ? t.reason === "insecure-http" ? "不安全的 HTTP 链接，请确认后再打开" : "安全的 HTTPS 链接" : t.reason === "empty" ? "尚未填写链接地址" : t.reason === "credentials-blocked" ? "链接携带登录凭据，已禁止打开" : "链接地址无效，无法打开";
}
const ae = {
  compact: 36,
  comfortable: 48,
  spacious: 60
};
function ce({
  analysis: t
}) {
  const e = b(t);
  return t.openable ? /* @__PURE__ */ s(I, { color: t.level === "warning" ? "warning" : "success", children: e }) : /* @__PURE__ */ s(I, { color: "error", children: e });
}
function de({
  config: t,
  onOpen: e,
  outcome: r
}) {
  const { token: n } = O.useToken(), i = c(t.url), o = c(t.icon_url), [l, v] = R.useState(null), _ = t.anchor_text.length > 0 ? t.anchor_text : "未命名链接", S = i.normalizedUrl.length > 0 ? i.normalizedUrl : t.url, C = i.hostname.length > 0 ? i.hostname : S, N = b(i), E = i.openable, H = /* @__PURE__ */ s(
    "span",
    {
      "aria-hidden": "true",
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        width: 32,
        height: 32,
        borderRadius: n.borderRadius,
        background: n.colorFillSecondary,
        color: n.colorPrimary,
        fontSize: n.fontSizeLG,
        fontWeight: 600,
        lineHeight: 1,
        overflow: "hidden"
      },
      children: o.openable && l !== o.normalizedUrl ? /* @__PURE__ */ s(
        "img",
        {
          src: o.normalizedUrl,
          alt: "",
          draggable: !1,
          referrerPolicy: "no-referrer",
          style: { display: "block", width: "100%", height: "100%", objectFit: "cover" },
          onError: () => {
            v(o.normalizedUrl);
          }
        }
      ) : /* @__PURE__ */ s("span", { children: "↗" })
    }
  ), w = /* @__PURE__ */ p(D, { children: [
    H,
    /* @__PURE__ */ p(
      "span",
      {
        style: {
          display: "grid",
          gap: n.marginXXS,
          minWidth: 0,
          flex: "1 1 auto"
        },
        children: [
          /* @__PURE__ */ p(
            "span",
            {
              style: {
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: n.marginXXS,
                minWidth: 0
              },
              children: [
                /* @__PURE__ */ s(
                  "span",
                  {
                    style: {
                      minWidth: 0,
                      color: n.colorText,
                      fontSize: n.fontSize,
                      fontWeight: 600,
                      overflowWrap: "anywhere"
                    },
                    children: _
                  }
                ),
                t.show_security_hint ? /* @__PURE__ */ s(ce, { analysis: i }) : null
              ]
            }
          ),
          t.description.trim().length > 0 ? /* @__PURE__ */ s(
            "span",
            {
              style: {
                margin: 0,
                color: n.colorTextSecondary,
                fontSize: n.fontSizeSM,
                overflowWrap: "anywhere"
              },
              children: t.description
            }
          ) : null,
          C.length > 0 ? /* @__PURE__ */ s(
            "span",
            {
              style: {
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: n.marginXXS,
                margin: 0,
                color: n.colorTextSecondary,
                fontSize: n.fontSizeSM,
                overflowWrap: "anywhere"
              },
              children: /* @__PURE__ */ s("span", { children: C })
            }
          ) : null
        ]
      }
    )
  ] }), k = {
    display: "flex",
    alignItems: "center",
    gap: n.marginSM,
    width: "100%",
    minHeight: ae[t.display_density],
    padding: `${n.paddingSM}px ${n.padding}px`,
    boxSizing: "border-box",
    borderRadius: n.borderRadius,
    border: `1px ${E ? "solid" : "dashed"} ${n.colorBorderSecondary}`,
    background: "transparent",
    textAlign: "left"
  };
  return /* @__PURE__ */ p("div", { style: { width: "100%", minWidth: 0 }, children: [
    E ? /* @__PURE__ */ s(
      K,
      {
        type: "text",
        block: !0,
        "aria-label": `打开链接 ${_}（${S}）`,
        onClick: e,
        style: {
          height: "auto",
          padding: 0,
          ...k
        },
        children: w
      }
    ) : /* @__PURE__ */ s("div", { role: "group", "aria-label": `链接不可打开：${N}`, style: k, children: w }),
    r.state !== "idle" ? /* @__PURE__ */ s(
      "p",
      {
        role: "status",
        style: {
          margin: 0,
          marginTop: n.marginXXS,
          color: r.state === "error" ? n.colorError : n.colorTextSecondary,
          fontSize: n.fontSizeSM
        },
        children: r.message
      }
    ) : null
  ] });
}
function he({ config: t }) {
  const e = f(t), [r, n] = R.useState({ state: "idle", message: null }), i = () => {
    const o = c(e.url);
    o.openable && (n({ state: "opening", message: "正在打开链接…" }), ne.request("shell:openExternal", { url: o.normalizedUrl }).then(() => {
      n({ state: "idle", message: null });
    }).catch(() => {
      n({
        state: "error",
        message: "链接暂时无法打开：当前渲染环境未提供打开通道，请稍后重试"
      });
    }));
  };
  return /* @__PURE__ */ s("div", { "data-card-type": "base.hyperlink", "data-density": e.display_density, children: /* @__PURE__ */ s(de, { config: e, onOpen: i, outcome: r }) });
}
function ue(t) {
  return t.anchor_text.trim().length > 0 && c(t.url).openable;
}
function pe({
  config: t,
  onChange: e
}) {
  const { token: r } = O.useToken(), n = (o, l) => {
    e(f(l));
  }, i = c(t.url);
  return /* @__PURE__ */ s(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "auto",
        padding: r.padding,
        boxSizing: "border-box"
      },
      children: /* @__PURE__ */ p(
        d,
        {
          layout: "vertical",
          initialValues: t,
          onValuesChange: n,
          children: [
            /* @__PURE__ */ s(
              d.Item,
              {
                label: "锚点文本",
                name: "anchor_text",
                required: !0,
                extra: "链接卡片的显示标题",
                rules: [
                  { required: !0, message: "请输入锚点文本" },
                  {
                    validator: (o, l) => typeof l == "string" && l.trim().length > 0 ? Promise.resolve() : Promise.reject(new Error("请输入锚点文本"))
                  }
                ],
                children: /* @__PURE__ */ s(m, { placeholder: "例如：薯片生态官网" })
              }
            ),
            /* @__PURE__ */ s(
              d.Item,
              {
                label: "链接地址",
                name: "url",
                required: !0,
                extra: b(i),
                rules: [
                  { required: !0, message: "请输入链接地址" },
                  {
                    validator: (o, l) => typeof l == "string" && c(l).openable ? Promise.resolve() : Promise.reject(new Error("请输入合法的 http(s) 链接地址"))
                  }
                ],
                children: /* @__PURE__ */ s(
                  m,
                  {
                    type: "url",
                    inputMode: "url",
                    autoCapitalize: "off",
                    autoCorrect: "off",
                    spellCheck: !1,
                    placeholder: "https://example.com/page"
                  }
                )
              }
            ),
            /* @__PURE__ */ s(d.Item, { label: "描述", name: "description", extra: "显示在标题下方的说明文字", children: /* @__PURE__ */ s(m.TextArea, { rows: 3, placeholder: "可选：说明这个链接指向的内容" }) }),
            /* @__PURE__ */ s(
              d.Item,
              {
                label: "图标地址",
                name: "icon_url",
                extra: "可选：http(s) 图片地址；加载失败或未填写时显示默认箭头图标",
                rules: [
                  {
                    validator: (o, l) => typeof l != "string" || l.trim().length === 0 || c(l).openable ? Promise.resolve() : Promise.reject(new Error("图标地址必须是合法的 http(s) 地址"))
                  }
                ],
                children: /* @__PURE__ */ s(
                  m,
                  {
                    type: "url",
                    inputMode: "url",
                    autoCapitalize: "off",
                    autoCorrect: "off",
                    spellCheck: !1,
                    placeholder: "https://example.com/icon.png"
                  }
                )
              }
            ),
            /* @__PURE__ */ s(d.Item, { label: "显示密度", name: "display_density", children: /* @__PURE__ */ s(
              P,
              {
                options: ie.map((o) => ({ value: o, label: se[o] }))
              }
            ) }),
            /* @__PURE__ */ s(
              d.Item,
              {
                label: "显示安全提示",
                name: "show_security_hint",
                valuePropName: "checked",
                extra: "在链接标题旁显示链接安全状态",
                children: /* @__PURE__ */ s(M, {})
              }
            )
          ]
        }
      )
    }
  );
}
const g = /* @__PURE__ */ new WeakMap();
function fe(t, e) {
  g.get(e)?.(), e.replaceChildren();
  const r = U(e);
  z(() => {
    r.render(/* @__PURE__ */ s(he, { config: t.content.config }));
  });
  let n = !1;
  const i = () => {
    n || (n = !0, r.unmount(), g.get(e) === i && g.delete(e));
  };
  return g.set(e, i), i;
}
function me(t) {
  return /* @__PURE__ */ s(pe, { ...t });
}
class ge {
  state = "active";
  base;
  revision;
  pending = null;
  dirty = !1;
  host;
  root;
  changeHandlers = /* @__PURE__ */ new Set();
  dirtyHandlers = /* @__PURE__ */ new Set();
  constructor(e, r) {
    this.base = f(e.content.config), this.revision = e.revision, this.host = r, r.replaceChildren(), this.root = U(r), this.mount();
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
    const r = this.pending;
    this.revision = e, r !== null && r.kind === "replace" && (this.base = f(r.content.config)), this.pending === r && (this.pending = null, this.setDirty(!1));
  }
  update(e, r) {
    this.state === "disposed" || r <= this.revision || (this.revision = r, this.base = f(e.content.config), this.pending = null, this.setDirty(!1), this.mount());
  }
  subscribe(e, r) {
    if (this.state === "disposed")
      return { dispose: () => {
      } };
    if (e === "change") {
      const i = r;
      return this.changeHandlers.add(i), {
        dispose: () => {
          this.changeHandlers.delete(i);
        }
      };
    }
    const n = r;
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
    z(() => {
      this.root.render(
        /* @__PURE__ */ s(
          me,
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
    if (this.state !== "active" || !ue(e))
      return;
    const r = {
      kind: "replace",
      content: {
        card_type: "base.hyperlink",
        config: { ...e }
      }
    }, n = this.pending !== null;
    this.pending = r, n || this.setDirty(!0);
    for (const i of this.changeHandlers)
      i({ change: r });
  };
  setDirty(e) {
    if (this.dirty !== e) {
      this.dirty = e;
      for (const r of this.dirtyHandlers)
        r({ isDirty: e });
    }
  }
}
function ye(t, e) {
  return new ge(t, e);
}
const we = {
  renderView: fe,
  renderEditor: ye
};
export {
  we as default,
  ye as renderEditor,
  we as renderPlugin,
  fe as renderView
};
