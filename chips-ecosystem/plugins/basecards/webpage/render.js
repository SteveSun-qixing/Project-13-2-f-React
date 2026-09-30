import { jsx as a, jsxs as K, Fragment as We } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { flushSync as ve } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as Ee } from "chips-resource://platform/vendor/react-dom-client.js";
import G, { useMemo as L, useRef as F, useState as J, useEffect as P } from "chips-resource://platform/vendor/react.js";
import { theme as xe, GlobalOutlined as Be, Form as v, Segmented as ue, Input as W, Button as $e } from "chips-resource://platform/vendor/chips-ui.js";
class T extends Error {
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
    return new T({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function Ge(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const Ke = "SDK_BRIDGE_UNAVAILABLE", he = "SDK_UNKNOWN_ERROR", pe = "发生未知错误";
function je(t) {
  return t instanceof Error;
}
function Ye(t) {
  if (t instanceof T)
    return t;
  if (Ge(t)) {
    const e = t, r = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new T(r);
  }
  return je(t) ? new T({
    code: he,
    message: pe,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new T({
    code: he,
    message: pe,
    details: { value: String(t) },
    retryable: !1
  });
}
function Xe() {
  return new T({
    code: Ke,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function f(t, e, r) {
  let o;
  try {
    o = t();
  } catch (n) {
    return Promise.reject(Ye(n));
  }
  return o.request(e, r);
}
const qe = "cli.command.list", Je = "cli.command.get", Ze = "cli.command.resolve";
function Qe(t) {
  return {
    list(e) {
      return f(t, qe, e ?? {});
    },
    get(e) {
      return f(t, Je, e);
    },
    resolve(e) {
      return f(t, Ze, e);
    }
  };
}
const V = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, et = "cli.task.create", tt = "cli.task.bindInvocation", rt = "cli.task.cancel";
function ot(t) {
  return {
    create(e) {
      return f(t, et, e).then((r) => r.task);
    },
    bindInvocation(e) {
      return f(t, tt, e).then((r) => r.task);
    },
    get(e) {
      const r = { taskId: e };
      return f(t, V.CLI_TASK_GET, r).then((o) => o.task);
    },
    active(e) {
      const r = { commandId: e };
      return f(t, V.CLI_TASK_ACTIVE, r).then((o) => o.task);
    },
    progress(e, r) {
      const o = { taskId: e, progress: r };
      return f(t, V.CLI_TASK_PROGRESS, o).then((n) => n.task);
    },
    complete(e, r) {
      const o = {
        taskId: e,
        ...r === void 0 ? {} : { output: r }
      };
      return f(t, V.CLI_TASK_COMPLETE, o).then((n) => n.task);
    },
    fail(e, r) {
      const o = { taskId: e, error: r };
      return f(t, V.CLI_TASK_FAIL, o).then((n) => n.task);
    },
    cancel(e) {
      return f(t, rt, { taskId: e }).then((r) => r.task);
    }
  };
}
function nt() {
  return globalThis.window?.chips;
}
class it {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = Qe(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = ot(() => this.#e());
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
    const e = nt();
    if (e === void 0)
      throw Xe();
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
    return f(() => this.#e(), e, r);
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
function st(t) {
  return new it(t?.bridge);
}
const at = st(), lt = "base.webpage", Se = "7:16", N = 20, O = "index.html", Te = {
  display_mode: "fixed",
  max_height_ratio: N
};
function Q(t) {
  const e = typeof t == "string" ? t.trim() : "";
  if (e.length === 0)
    return {
      input: e,
      normalizedUrl: "",
      protocol: "",
      hostname: "",
      openable: !1,
      reason: "empty"
    };
  let r;
  try {
    r = new URL(e);
  } catch {
    const i = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(?:[/?#:]|$)/.exec(e);
    return i !== null ? {
      input: e,
      normalizedUrl: "",
      protocol: `${i[1].toLowerCase()}:`,
      hostname: "",
      openable: !1,
      reason: "missing-host"
    } : {
      input: e,
      normalizedUrl: "",
      protocol: "",
      hostname: "",
      openable: !1,
      reason: "invalid"
    };
  }
  const o = r.protocol.toLowerCase(), n = r.hostname.trim();
  return o !== "http:" && o !== "https:" ? {
    input: e,
    normalizedUrl: "",
    protocol: o,
    hostname: n,
    openable: !1,
    reason: "unsupported-protocol"
  } : n.length === 0 ? {
    input: e,
    normalizedUrl: "",
    protocol: o,
    hostname: n,
    openable: !1,
    reason: "missing-host"
  } : r.username.length > 0 || r.password.length > 0 ? {
    input: e,
    normalizedUrl: "",
    protocol: o,
    hostname: n,
    openable: !1,
    reason: "credentials-blocked"
  } : {
    input: e,
    normalizedUrl: r.toString(),
    protocol: o,
    hostname: n,
    openable: !0,
    reason: o === "http:" ? "insecure-http" : "secure"
  };
}
function ct(t) {
  return typeof t == "string" && t.trim().length > 0;
}
function U(t) {
  if (!ct(t))
    return;
  const e = t.replace(/\\/g, "/").trim().replace(/^\.?\//, "");
  if (!e || /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(e) || e.includes("?") || e.includes("#"))
    return;
  const r = e.split("/").filter(Boolean);
  if (!(r.length === 0 || r.some((o) => o === "." || o === "..")))
    return r.join("/");
}
function dt(t) {
  const e = /* @__PURE__ */ new Set();
  for (const r of t) {
    const o = U(r);
    o && e.add(o);
  }
  return Array.from(e);
}
function Ce(t) {
  return U(t.bundle_root);
}
function ee(t) {
  const e = Ce(t);
  if (!e)
    return;
  const r = U(t.entry_file) ?? O;
  return `${e}/${r}`.replace(/\/+/g, "/");
}
function ut(t) {
  return typeof t == "string" ? t : void 0;
}
function ht(t) {
  return t === "bundle" ? "bundle" : "url";
}
function pt(t) {
  return t === "free" || t === "fixed" ? t : Te.display_mode;
}
function x(t) {
  const e = typeof t == "object" && t !== null ? t : {}, r = ht(e.source_type), o = r === "bundle" ? U(e.bundle_root) ?? "" : "", n = r === "bundle" ? U(e.entry_file) ?? O : O;
  return {
    source_type: r,
    source_url: r === "url" ? ut(e.source_url)?.trim() ?? "" : "",
    bundle_root: o,
    entry_file: n,
    resource_paths: r === "bundle" && Array.isArray(e.resource_paths) ? dt(e.resource_paths) : [],
    display_mode: pt(e.display_mode),
    fixed_ratio: Se,
    max_height_ratio: e.max_height_ratio === N ? N : Te.max_height_ratio
  };
}
function ft(t) {
  return {
    card_type: lt,
    theme: "",
    source_type: t.source_type,
    source_url: t.source_url,
    bundle_root: t.bundle_root,
    entry_file: t.entry_file,
    resource_paths: [...t.resource_paths],
    display_mode: t.display_mode,
    fixed_ratio: t.fixed_ratio,
    max_height_ratio: t.max_height_ratio
  };
}
const Re = "chips:webpage-card:viewport", He = "chips:webpage-card:content-height", Ie = "chips:webpage-card:viewport-change", Ae = "__CHIPS_WEBPAGE_CARD_VIEWPORT__", yt = 7, mt = 16, Z = 640, te = 160, gt = 1e4, _t = 600;
function D(t) {
  return typeof t != "number" || !Number.isFinite(t) ? 0 : Math.max(0, Math.round(t));
}
function j(t) {
  const e = typeof t == "object" && t !== null ? t : {};
  return {
    version: 1,
    displayMode: e.displayMode === "free" ? "free" : "fixed",
    fixedRatio: Se,
    width: D(e.width),
    height: D(e.height),
    baseHeight: D(e.baseHeight),
    maxHeight: D(e.maxHeight),
    scrollMode: !!e.scrollMode
  };
}
function re(t) {
  return Math.max(te, Math.round(t / yt * mt));
}
function bt(t, e, r, o) {
  if (r.display_mode === "fixed")
    return {
      height: re(e),
      scrollMode: !0
    };
  const n = D(t), i = Math.max(o, Math.round(e * N));
  if (n <= 0)
    return {
      height: o,
      scrollMode: !0
    };
  const y = n > i;
  return {
    height: y ? i : Math.max(o, n),
    scrollMode: y
  };
}
function fe(t, e, r, o, n) {
  const i = o.display_mode === "fixed" ? r : Math.max(r, Math.round(t * N));
  return j({
    displayMode: o.display_mode,
    width: t,
    height: e,
    baseHeight: r,
    maxHeight: i,
    scrollMode: n
  });
}
function ye(t, e) {
  if (e.length === 0 || e.startsWith("/") || e.includes("\\") || /(^|\/)\.\.(\/|$)/.test(e))
    return null;
  let r;
  try {
    r = new URL(e, t);
  } catch {
    return null;
  }
  return r.protocol !== "chips-resource:" ? null : r.toString();
}
function wt(t) {
  return t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function vt(t) {
  return t.replace(/<\/script/gi, "<\\/script");
}
function Et(t) {
  const e = JSON.stringify(j(t)).replace(/</g, "\\u003c");
  return vt(
    [
      "(function () {",
      `  var VIEWPORT_MESSAGE_TYPE = ${JSON.stringify(Re)};`,
      `  var VIEWPORT_EVENT = ${JSON.stringify(Ie)};`,
      `  var CONTENT_HEIGHT_MESSAGE_TYPE = ${JSON.stringify(He)};`,
      `  var GLOBAL_KEY = ${JSON.stringify(Ae)};`,
      "  var VIRTUAL_VH_CSS_VAR = '--chips-webpage-card-virtual-vh';",
      "  var viewportHeightUnitPattern = /(-?\\d*\\.?\\d+)(dvh|svh|lvh|vh)\\b/gi;",
      `  var initialPayload = ${e};`,
      "  var viewportState = null;",
      "  var rewriteFrame = 0;",
      "  function asNumber(value) {",
      "    return typeof value === 'number' && isFinite(value) ? Math.max(0, Math.round(value)) : 0;",
      "  }",
      "  function normalizePayload(payload) {",
      "    return {",
      "      version: 1,",
      "      displayMode: payload && payload.displayMode === 'free' ? 'free' : 'fixed',",
      "      fixedRatio: '7:16',",
      "      width: asNumber(payload && payload.width),",
      "      height: asNumber(payload && payload.height),",
      "      baseHeight: asNumber(payload && payload.baseHeight),",
      "      maxHeight: asNumber(payload && payload.maxHeight),",
      "      scrollMode: Boolean(payload && payload.scrollMode),",
      "    };",
      "  }",
      "  function convertViewportHeightUnits(value) {",
      "    if (typeof value !== 'string' || value.indexOf('vh') === -1 || value.indexOf(VIRTUAL_VH_CSS_VAR) !== -1) {",
      "      return value;",
      "    }",
      "    return value.replace(viewportHeightUnitPattern, function (_match, amount) {",
      "      return 'calc(var(' + VIRTUAL_VH_CSS_VAR + ', 1vh) * ' + amount + ')';",
      "    });",
      "  }",
      "  function rewriteStyleDeclaration(style) {",
      "    if (!style) {",
      "      return;",
      "    }",
      "    for (var index = 0; index < style.length; index += 1) {",
      "      var propertyName = style[index];",
      "      var propertyValue = style.getPropertyValue(propertyName);",
      "      var nextValue = convertViewportHeightUnits(propertyValue);",
      "      if (nextValue !== propertyValue) {",
      "        style.setProperty(propertyName, nextValue, style.getPropertyPriority(propertyName));",
      "      }",
      "    }",
      "  }",
      "  function rewriteCssRules(rules) {",
      "    if (!rules) {",
      "      return;",
      "    }",
      "    for (var index = 0; index < rules.length; index += 1) {",
      "      var rule = rules[index];",
      "      if (rule && rule.style) {",
      "        rewriteStyleDeclaration(rule.style);",
      "      }",
      "      if (rule && rule.cssRules) {",
      "        try {",
      "          rewriteCssRules(rule.cssRules);",
      "        } catch (_error) {",
      "          void _error;",
      "        }",
      "      }",
      "    }",
      "  }",
      "  function rewriteAccessibleStylesheets() {",
      "    var styleSheets = document.styleSheets;",
      "    for (var index = 0; index < styleSheets.length; index += 1) {",
      "      try {",
      "        rewriteCssRules(styleSheets[index].cssRules);",
      "      } catch (_error) {",
      "        void _error;",
      "      }",
      "    }",
      "  }",
      "  function rewriteInlineViewportUnits(rootNode) {",
      "    if (!rootNode) {",
      "      return;",
      "    }",
      "    if (rootNode.style) {",
      "      rewriteStyleDeclaration(rootNode.style);",
      "    }",
      "    if (typeof rootNode.querySelectorAll !== 'function') {",
      "      return;",
      "    }",
      "    var nodes = rootNode.querySelectorAll('[style]');",
      "    for (var index = 0; index < nodes.length; index += 1) {",
      "      rewriteStyleDeclaration(nodes[index].style);",
      "    }",
      "  }",
      "  function rewriteViewportUnits() {",
      "    rewriteAccessibleStylesheets();",
      "    rewriteInlineViewportUnits(document.documentElement);",
      "  }",
      "  function scheduleViewportUnitRewrite() {",
      "    if (rewriteFrame) {",
      "      return;",
      "    }",
      "    var schedule = typeof window.requestAnimationFrame === 'function'",
      "      ? function (callback) { return window.requestAnimationFrame(callback); }",
      "      : function (callback) { return window.setTimeout(callback, 0); };",
      "    rewriteFrame = schedule(function () {",
      "      rewriteFrame = 0;",
      "      rewriteViewportUnits();",
      "    });",
      "  }",
      "  function tryDefineWindowMetric(name, getter) {",
      "    try {",
      "      Object.defineProperty(window, name, {",
      "        configurable: true,",
      "        enumerable: true,",
      "        get: getter,",
      "      });",
      "    } catch (_error) {",
      "      void _error;",
      "    }",
      "  }",
      "  function installViewportMetricOverrides() {",
      "    tryDefineWindowMetric('innerHeight', function () {",
      "      return viewportState ? viewportState.height : 0;",
      "    });",
      "    tryDefineWindowMetric('outerHeight', function () {",
      "      return viewportState ? viewportState.height : 0;",
      "    });",
      "    try {",
      "      var root = document.documentElement;",
      "      if (root) {",
      "        Object.defineProperty(root, 'clientHeight', {",
      "          configurable: true,",
      "          get: function () {",
      "            return viewportState ? viewportState.height : 0;",
      "          },",
      "        });",
      "      }",
      "    } catch (_error) {",
      "      void _error;",
      "    }",
      "  }",
      "  function dispatchVirtualResize() {",
      "    try {",
      "      var EventCtor = window.Event;",
      "      if (typeof EventCtor === 'function') {",
      "        window.dispatchEvent(new EventCtor('resize'));",
      "      }",
      "    } catch (_error) {",
      "      void _error;",
      "    }",
      "  }",
      "  function applyPayload(payload) {",
      "    var nextPayload = normalizePayload(payload || initialPayload);",
      "    var previousWidth = viewportState ? viewportState.width : 0;",
      "    var previousHeight = viewportState ? viewportState.height : 0;",
      "    viewportState = nextPayload;",
      "    var root = document.documentElement;",
      "    if (root && root.style) {",
      "      root.style.setProperty('--chips-webpage-card-viewport-width', nextPayload.width + 'px');",
      "      root.style.setProperty('--chips-webpage-card-viewport-height', nextPayload.height + 'px');",
      "      root.style.setProperty('--chips-webpage-card-base-height', nextPayload.baseHeight + 'px');",
      "      root.style.setProperty('--chips-webpage-card-max-height', nextPayload.maxHeight + 'px');",
      "      root.style.setProperty(VIRTUAL_VH_CSS_VAR, (Math.max(1, nextPayload.height) / 100) + 'px');",
      "      root.style.setProperty('--chips-webpage-card-scroll-mode', nextPayload.scrollMode ? '1' : '0');",
      "      root.setAttribute('data-chips-webpage-card-display-mode', nextPayload.displayMode);",
      "      root.setAttribute('data-chips-webpage-card-fixed-ratio', nextPayload.fixedRatio);",
      "      root.setAttribute('data-chips-webpage-card-scroll-mode', nextPayload.scrollMode ? 'true' : 'false');",
      "    }",
      "    window[GLOBAL_KEY] = nextPayload;",
      "    scheduleViewportUnitRewrite();",
      "    try {",
      "      var CustomEventCtor = window.CustomEvent;",
      "      if (typeof CustomEventCtor === 'function') {",
      "        window.dispatchEvent(new CustomEventCtor(VIEWPORT_EVENT, { detail: nextPayload }));",
      "      }",
      "    } catch (_error) {",
      "      void _error;",
      "    }",
      "    if (nextPayload.width !== previousWidth || nextPayload.height !== previousHeight) {",
      "      dispatchVirtualResize();",
      "    }",
      "  }",
      "  function measureHeight() {",
      "    var root = document.documentElement;",
      "    var body = document.body;",
      "    return Math.max(",
      "      root && root.scrollHeight ? root.scrollHeight : 0,",
      "      root && root.offsetHeight ? root.offsetHeight : 0,",
      "      root && root.clientHeight ? root.clientHeight : 0,",
      "      body && body.scrollHeight ? body.scrollHeight : 0,",
      "      body && body.offsetHeight ? body.offsetHeight : 0,",
      "      body && body.clientHeight ? body.clientHeight : 0",
      "    );",
      "  }",
      "  function reportHeight() {",
      "    try {",
      "      if (!window.parent || window.parent === window) {",
      "        return;",
      "      }",
      "      window.parent.postMessage({",
      "        type: CONTENT_HEIGHT_MESSAGE_TYPE,",
      "        payload: {",
      "          version: 1,",
      "          contentHeight: measureHeight(),",
      "        },",
      "      }, '*');",
      "    } catch (_error) {",
      "      void _error;",
      "    }",
      "  }",
      "  window.addEventListener('message', function (event) {",
      "    var data = event && event.data;",
      "    if (!data || data.type !== VIEWPORT_MESSAGE_TYPE) {",
      "      return;",
      "    }",
      "    applyPayload(data.payload || initialPayload);",
      "    reportHeight();",
      "  });",
      "  if (typeof ResizeObserver === 'function') {",
      "    var resizeObserver = new ResizeObserver(function () {",
      "      scheduleViewportUnitRewrite();",
      "      reportHeight();",
      "    });",
      "    resizeObserver.observe(document.documentElement);",
      "    if (document.body) {",
      "      resizeObserver.observe(document.body);",
      "    }",
      "  }",
      "  try {",
      "    var mutationObserver = new MutationObserver(function () {",
      "      scheduleViewportUnitRewrite();",
      "      reportHeight();",
      "    });",
      "    mutationObserver.observe(document.documentElement, {",
      "      childList: true,",
      "      subtree: true,",
      "      attributes: true,",
      "      characterData: true,",
      "    });",
      "  } catch (_error) {",
      "    void _error;",
      "  }",
      "  installViewportMetricOverrides();",
      "  window.addEventListener('load', function () {",
      "    scheduleViewportUnitRewrite();",
      "    reportHeight();",
      "  });",
      "  if (document.readyState === 'complete' || document.readyState === 'interactive') {",
      "    window.setTimeout(function () {",
      "      scheduleViewportUnitRewrite();",
      "      reportHeight();",
      "    }, 0);",
      "  } else {",
      "    document.addEventListener('DOMContentLoaded', function () {",
      "      scheduleViewportUnitRewrite();",
      "      reportHeight();",
      "    }, { once: true });",
      "  }",
      "  applyPayload(initialPayload);",
      "  reportHeight();",
      "})();"
    ].join(`
`)
  );
}
function xt(t, e, r) {
  const o = `<base href="${wt(e)}" />`, n = r ? `<script>${Et(r)}<\/script>` : "";
  return /<head[\s>]/i.test(t) ? t.replace(/<head([^>]*)>/i, `<head$1>${o}${n}`) : /<html[\s>]/i.test(t) ? t.replace(/<html([^>]*)>/i, `<html$1><head>${o}${n}</head>`) : `<!doctype html><html><head>${o}${n}</head><body>${t}</body></html>`;
}
function B(t, e, r) {
  t.setProperty(e, `${Math.max(0, Math.round(r))}px`);
}
function St(t, e) {
  const r = j(e), o = t.documentElement;
  if (!o)
    return;
  B(o.style, "--chips-webpage-card-viewport-width", r.width), B(o.style, "--chips-webpage-card-viewport-height", r.height), B(o.style, "--chips-webpage-card-base-height", r.baseHeight), B(o.style, "--chips-webpage-card-max-height", r.maxHeight), o.style.setProperty("--chips-webpage-card-scroll-mode", r.scrollMode ? "1" : "0"), o.setAttribute("data-chips-webpage-card-display-mode", r.displayMode), o.setAttribute("data-chips-webpage-card-fixed-ratio", r.fixedRatio), o.setAttribute("data-chips-webpage-card-scroll-mode", r.scrollMode ? "true" : "false");
  const n = t.defaultView;
  if (n) {
    n[Ae] = r;
    try {
      const i = typeof n.CustomEvent == "function" ? n.CustomEvent : typeof CustomEvent == "function" ? CustomEvent : void 0;
      i && n.dispatchEvent(new i(Ie, { detail: r }));
    } catch {
    }
  }
}
function me(t, e) {
  const r = j(e);
  try {
    t.contentDocument && St(t.contentDocument, r);
  } catch {
  }
  try {
    t.contentWindow?.postMessage({
      type: Re,
      payload: r
    }, "*");
  } catch {
  }
}
function Tt(t) {
  const e = t.documentElement, r = t.body;
  return Math.max(
    e?.scrollHeight ?? 0,
    e?.offsetHeight ?? 0,
    e?.clientHeight ?? 0,
    r?.scrollHeight ?? 0,
    r?.offsetHeight ?? 0,
    r?.clientHeight ?? 0
  );
}
function Ct(t) {
  const e = t.body, r = e?.textContent?.trim() ?? "", o = e?.childElementCount ?? 0;
  return t.URL === "about:blank" && r.length === 0 && o === 0;
}
const Rt = "暂无网页内容", Ht = "网页加载中…", ge = "该网页禁止被 iframe 嵌入。", _e = "网页加载失败。", It = "网页地址不合法。", At = "网页包加载失败。", Mt = "allow-scripts allow-forms allow-popups";
function Pt(t) {
  return Number.isFinite(t) ? Math.max(0, Math.round(t)) : 0;
}
function Ot(t) {
  return t ? Math.max(
    1,
    Math.round(t.getBoundingClientRect().width || t.clientWidth || Z)
  ) : Z;
}
function Lt() {
  if (typeof window > "u")
    return 0;
  const t = [];
  try {
    window.top && typeof window.top.innerHeight == "number" && t.push(window.top.innerHeight);
  } catch {
  }
  t.push(
    window.screen?.availHeight ?? 0,
    window.screen?.height ?? 0,
    window.innerHeight
  );
  for (const e of t) {
    const r = Pt(e);
    if (r > 0)
      return r;
  }
  return 0;
}
function Vt(t, e) {
  const r = re(t);
  if (e === "fixed")
    return r;
  const o = Lt();
  return o <= 0 ? r : Math.max(te, Math.min(r, o));
}
function Dt(t, e) {
  return e === "fixed" ? re(t) : te;
}
function be(t) {
  try {
    return t.contentDocument ?? null;
  } catch {
    return null;
  }
}
function Nt(t) {
  const [e, r] = J(Z);
  return P(() => {
    const o = t.current;
    if (!o)
      return;
    const n = () => {
      r(Ot(o));
    };
    if (n(), typeof ResizeObserver != "function")
      return;
    const i = new ResizeObserver(() => n());
    return i.observe(o), () => {
      i.disconnect();
    };
  }, [t]), e;
}
function Ut({ content: t }) {
  const { token: e } = xe.useToken(), r = L(() => x(t), [t]), o = F(null), n = F(null), i = Nt(o), y = r.source_type === "url" && r.source_url.length > 0, m = r.source_type === "bundle" && r.bundle_root.length > 0, C = L(
    () => y ? Q(r.source_url) : null,
    [y, r.source_url]
  ), c = Dt(i, r.display_mode), R = Vt(i, r.display_mode), [h, s] = J(null), [l, H] = J(null), Me = F(c), Y = F(null);
  P(() => {
    Me.current = c;
  }, [c]);
  const I = L(() => {
    if (!m)
      return null;
    const d = ee(r), u = d ? ye(document.baseURI, d) : null, _ = Ce(r), b = _ ? ye(document.baseURI, `${_}/`) ?? u : u;
    return { entryUri: u, dirUri: b };
  }, [m, r]);
  P(() => {
    if (!I?.entryUri || !I.dirUri) {
      H(null);
      return;
    }
    let d = !1;
    s(null);
    const u = I.entryUri, _ = I.dirUri;
    return at.request("resource:read", { uri: u }).then((b) => {
      if (d)
        return;
      const E = new TextDecoder().decode(b.data);
      H({
        kind: "srcdoc",
        value: xt(E, _, Y.current ?? void 0)
      });
    }).catch(() => {
      d || H({ kind: "src", value: u });
    }), () => {
      d = !0;
    };
  }, [I]);
  const Pe = L(() => C?.openable ? { kind: "src", value: C.normalizedUrl } : null, [C]), g = m ? l : Pe, X = L(
    () => fe(
      i,
      R,
      c,
      r,
      h?.status === "ready" ? h.scrollMode : !1
    ),
    [c, h, R, r, i]
  );
  Y.current = X;
  const Oe = G.useCallback(() => {
    const d = n.current;
    d && me(d, Y.current ?? fe(
      i,
      R,
      c,
      r,
      !1
    ));
  }, [c, R, r, i]);
  P(() => {
    s(null);
  }, [g]), P(() => {
    const d = n.current;
    !d || !g || me(d, X);
  }, [g, X]), P(() => {
    const d = n.current;
    if (!d || !g)
      return;
    const u = d;
    let _ = 0, b = null, E = null, A = null, k = 0;
    const ke = () => {
      k && (window.clearTimeout(k), k = 0);
    }, q = () => {
      ke(), _ && window.clearInterval(_), b?.disconnect(), E?.disconnect(), A && A.removeEventListener("resize", se), _ = 0, b = null, E = null, A = null;
    }, ie = () => {
      s({
        status: "ready",
        errorText: "",
        height: c,
        scrollMode: !0
      });
    };
    function M(p) {
      const w = be(u);
      if (w && r.source_type === "url" && Ct(w)) {
        s({
          status: "error",
          errorText: ge,
          height: c,
          scrollMode: !1
        });
        return;
      }
      const S = typeof p == "number" && Number.isFinite(p) ? p : w ? Tt(w) : 0;
      if (!w && S <= 0) {
        ie();
        return;
      }
      const de = bt(S, i, r, c);
      s({
        status: "ready",
        errorText: "",
        height: de.height,
        scrollMode: de.scrollMode
      });
    }
    const se = () => {
      M();
    }, Fe = () => {
      q();
      const p = be(u);
      if (!p) {
        ie();
        return;
      }
      if (M(), r.display_mode !== "fixed") {
        try {
          b = new MutationObserver(() => M()), b.observe(p.documentElement, {
            childList: !0,
            subtree: !0,
            attributes: !0,
            characterData: !0
          });
        } catch {
          b = null;
        }
        try {
          typeof ResizeObserver == "function" && (E = new ResizeObserver(() => M()), E.observe(p.documentElement), p.body && E.observe(p.body));
        } catch {
          E = null;
        }
        try {
          A = u.contentWindow, A?.addEventListener("resize", se);
        } catch {
          A = null;
        }
        _ = window.setInterval(() => M(), _t);
      }
    }, ae = (p) => {
      if (p.source !== u.contentWindow)
        return;
      const w = p.data;
      if (!w || w.type !== He)
        return;
      const S = w.payload?.contentHeight;
      typeof S != "number" || !Number.isFinite(S) || S <= 0 || M(S);
    }, le = () => {
      Fe();
    }, ce = () => {
      q(), s({
        status: "error",
        errorText: _e,
        height: c,
        scrollMode: !1
      });
    };
    return u.addEventListener("load", le), u.addEventListener("error", ce), window.addEventListener("message", ae), k = window.setTimeout(() => {
      s({
        status: "error",
        errorText: r.source_type === "url" ? ge : _e,
        height: c,
        scrollMode: !1
      });
    }, gt), () => {
      u.removeEventListener("load", le), u.removeEventListener("error", ce), window.removeEventListener("message", ae), q();
    };
  }, [c, g, r, i]);
  const Le = y && !C?.openable, Ve = m && !I?.entryUri, z = Le ? It : Ve ? At : h?.status === "error" ? h.errorText : "", oe = !y && !m, De = !z && h?.status === "ready", Ne = !oe && !z && !De, Ue = h ? h.height : c, ze = h?.status === "ready" && h.scrollMode, ne = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px 24px",
    textAlign: "center",
    boxSizing: "border-box",
    zIndex: 2,
    pointerEvents: "none"
  };
  return oe ? /* @__PURE__ */ a(
    "div",
    {
      "data-chips-webpage-view": "true",
      style: { width: "100%", minWidth: 0, display: "flex", flexDirection: "column", boxSizing: "border-box" },
      children: /* @__PURE__ */ K(
        "div",
        {
          style: {
            minHeight: 180,
            width: "100%",
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: e.marginXXS + 4,
            textAlign: "center",
            color: e.colorTextSecondary,
            boxSizing: "border-box"
          },
          children: [
            /* @__PURE__ */ a(Be, { "aria-hidden": "true", style: { fontSize: 42, lineHeight: 1, color: e.colorTextQuaternary } }),
            /* @__PURE__ */ a("span", { style: { fontSize: e.fontSize, lineHeight: 1.6 }, children: Rt })
          ]
        }
      )
    }
  ) : /* @__PURE__ */ a(
    "div",
    {
      "data-chips-webpage-view": "true",
      ref: o,
      style: { width: "100%", minWidth: 0, display: "flex", flexDirection: "column", boxSizing: "border-box" },
      children: /* @__PURE__ */ K(
        "div",
        {
          "data-chips-webpage-viewport": "true",
          className: ze ? "chips-webpage-card__viewport--scroll" : void 0,
          style: {
            position: "relative",
            width: "100%",
            height: `${Ue}px`,
            overflow: "hidden",
            border: 0,
            borderRadius: 0,
            background: "transparent",
            boxSizing: "border-box"
          },
          children: [
            z ? /* @__PURE__ */ a("div", { style: { ...ne, color: e.colorError, fontSize: e.fontSizeSM }, children: z }) : g ? /* @__PURE__ */ a(
              "iframe",
              {
                ref: n,
                title: "网页内容",
                sandbox: Mt,
                loading: "lazy",
                ...g.kind === "srcdoc" ? { srcDoc: g.value } : { src: g.value },
                onLoad: Oe,
                style: {
                  display: "block",
                  width: "100%",
                  height: "100%",
                  border: 0,
                  background: "transparent"
                }
              }
            ) : null,
            Ne ? /* @__PURE__ */ a("div", { style: { ...ne, color: e.colorTextSecondary, fontSize: e.fontSizeSM }, children: Ht }) : null
          ]
        }
      )
    }
  );
}
const zt = ["fixed", "free"], kt = {
  fixed: "固定比例",
  free: "自由展开"
}, Ft = ["url", "bundle"], Wt = {
  url: "链接",
  bundle: "网页目录"
}, Bt = {
  fixed: "固定为宽:高 7:16，在卡片窗口内滚动查看网页。",
  free: "按网页高度展开，最高不超过宽度的 20 倍，超出部分在窗口内滚动。"
};
function $t(t) {
  if (t.source_type === "url")
    return t.source_url.length === 0 || Q(t.source_url).openable;
  const e = ee(t);
  return e !== void 0 && e.endsWith(`/${O}`) && t.resource_paths.includes(e);
}
function we(t) {
  return t.split(`
`);
}
function Gt({
  content: t,
  onChange: e
}) {
  const { token: r } = xe.useToken(), [o] = v.useForm(), n = G.useMemo(
    () => ({
      source_type: t.source_type,
      source_url: t.source_url,
      bundle_root: t.bundle_root,
      resource_paths_text: t.resource_paths.join(`
`),
      display_mode: t.display_mode
    }),
    [t]
  ), [i, y] = G.useState(t), m = G.useRef(n), C = (s) => {
    const l = {
      ...m.current,
      ...s
    };
    m.current = l;
    const H = x({
      source_type: l.source_type,
      source_url: l.source_url,
      bundle_root: l.bundle_root,
      resource_paths: we(l.resource_paths_text),
      display_mode: l.display_mode,
      entry_file: O
    });
    y(H), e(H);
  }, c = (s, l) => {
    C(l);
  }, R = () => {
    const s = x({ display_mode: i.display_mode }), l = {
      source_type: s.source_type,
      source_url: s.source_url,
      bundle_root: s.bundle_root,
      resource_paths_text: "",
      display_mode: s.display_mode
    };
    o.setFieldsValue(l), m.current = l, y(s), e(s);
  }, h = i.source_type;
  return /* @__PURE__ */ a(
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
      children: /* @__PURE__ */ K(
        v,
        {
          form: o,
          layout: "vertical",
          initialValues: n,
          onValuesChange: c,
          children: [
            /* @__PURE__ */ a(
              v.Item,
              {
                label: "显示比例",
                name: "display_mode",
                extra: Bt[i.display_mode],
                children: /* @__PURE__ */ a(
                  ue,
                  {
                    options: zt.map((s) => ({
                      value: s,
                      label: kt[s]
                    }))
                  }
                )
              }
            ),
            /* @__PURE__ */ a(
              v.Item,
              {
                label: "网页模式",
                name: "source_type",
                extra: "先选择网页来源模式，再填写对应的链接或网页目录。",
                children: /* @__PURE__ */ a(
                  ue,
                  {
                    options: Ft.map((s) => ({
                      value: s,
                      label: Wt[s]
                    }))
                  }
                )
              }
            ),
            h === "url" ? /* @__PURE__ */ a(
              v.Item,
              {
                label: "网页地址",
                name: "source_url",
                extra: "输入合法网址后自动刷新；切换到网页目录时会清除网址引用。",
                rules: [
                  {
                    validator: (s, l) => typeof l != "string" || l.trim().length === 0 || Q(l).openable ? Promise.resolve() : Promise.reject(new Error("请输入合法的 http(s) 网页地址"))
                  }
                ],
                children: /* @__PURE__ */ a(
                  W,
                  {
                    "aria-label": "网页地址",
                    type: "url",
                    inputMode: "url",
                    autoCapitalize: "off",
                    autoCorrect: "off",
                    spellCheck: !1,
                    placeholder: "https://example.com/page"
                  }
                )
              }
            ) : /* @__PURE__ */ K(We, { children: [
              /* @__PURE__ */ a(
                v.Item,
                {
                  label: "网页目录",
                  name: "bundle_root",
                  extra: "网页目录在卡片根目录中的相对路径；ZIP 压缩包解压导入由编辑链路资源桥完成。",
                  rules: [
                    {
                      validator: (s, l) => typeof l != "string" || l.trim().length === 0 || x({ source_type: "bundle", bundle_root: l }).bundle_root.length > 0 ? Promise.resolve() : Promise.reject(new Error("请输入合法的包内相对目录路径"))
                    }
                  ],
                  children: /* @__PURE__ */ a(
                    W,
                    {
                      "aria-label": "网页目录",
                      autoCapitalize: "off",
                      autoCorrect: "off",
                      spellCheck: !1,
                      placeholder: "webpage-bundle-a1b2c3"
                    }
                  )
                }
              ),
              /* @__PURE__ */ a(v.Item, { label: "入口文件", extra: "网页目录入口文件正式为 index.html。", children: /* @__PURE__ */ a(W, { value: O, disabled: !0, "aria-label": "入口文件" }) }),
              /* @__PURE__ */ a(
                v.Item,
                {
                  label: "资源清单",
                  name: "resource_paths_text",
                  extra: "每行一个包内相对路径；必须包含入口文件 index.html。",
                  rules: [
                    {
                      validator: (s, l) => typeof l != "string" || l.trim().length === 0 || ee(x({
                        source_type: "bundle",
                        bundle_root: i.bundle_root,
                        resource_paths: we(l)
                      })) !== void 0 ? Promise.resolve() : Promise.reject(new Error("请先填写合法的网页目录路径"))
                    }
                  ],
                  children: /* @__PURE__ */ a(
                    W.TextArea,
                    {
                      "aria-label": "资源清单",
                      rows: 5,
                      autoCapitalize: "off",
                      autoCorrect: "off",
                      spellCheck: !1,
                      placeholder: `webpage-bundle-a1b2c3/index.html
webpage-bundle-a1b2c3/assets/app.js`
                    }
                  )
                }
              )
            ] }),
            /* @__PURE__ */ a(v.Item, { label: "当前来源", children: /* @__PURE__ */ a("span", { style: { color: r.colorTextSecondary, fontSize: r.fontSizeSM }, children: h === "bundle" && i.bundle_root ? `当前显示的是已导入的网页目录（${i.bundle_root}，入口 ${i.entry_file}，共 ${i.resource_paths.length} 个文件）。` : h === "url" && i.source_url ? `当前显示的是远程网页链接（${i.source_url}）。` : "还没有选择网页来源。" }) }),
            /* @__PURE__ */ a(
              $e,
              {
                type: "default",
                onClick: R,
                children: "清除来源"
              }
            )
          ]
        }
      )
    }
  );
}
const $ = /* @__PURE__ */ new WeakMap();
function Kt(t, e) {
  $.get(e)?.(), e.replaceChildren();
  const r = Ee(e);
  ve(() => {
    r.render(/* @__PURE__ */ a(Ut, { content: t.content }));
  });
  let o = !1;
  const n = () => {
    o || (o = !0, r.unmount(), $.get(e) === n && $.delete(e));
  };
  return $.set(e, n), n;
}
function jt(t) {
  return /* @__PURE__ */ a(Gt, { ...t });
}
class Yt {
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
    this.base = x(e.content), this.revision = e.revision, this.host = r, r.replaceChildren(), this.root = Ee(r), this.mount();
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
    this.revision = e, r !== null && r.kind === "replace" && (this.base = x(r.content)), this.pending === r && (this.pending = null, this.setDirty(!1));
  }
  update(e, r) {
    this.state === "disposed" || r <= this.revision || (this.revision = r, this.base = x(e.content), this.pending = null, this.setDirty(!1), this.mount());
  }
  subscribe(e, r) {
    if (this.state === "disposed")
      return { dispose: () => {
      } };
    if (e === "change") {
      const n = r;
      return this.changeHandlers.add(n), {
        dispose: () => {
          this.changeHandlers.delete(n);
        }
      };
    }
    const o = r;
    return this.dirtyHandlers.add(o), {
      dispose: () => {
        this.dirtyHandlers.delete(o);
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
    ve(() => {
      this.root.render(
        /* @__PURE__ */ a(
          jt,
          {
            content: this.base,
            onChange: this.handleContentChange
          },
          this.revision
        )
      );
    });
  }
  handleContentChange = (e) => {
    if (this.state !== "active" || !$t(e))
      return;
    const r = {
      kind: "replace",
      content: ft(e)
    }, o = this.pending !== null;
    this.pending = r, o || this.setDirty(!0);
    for (const n of this.changeHandlers)
      n({ change: r });
  };
  setDirty(e) {
    if (this.dirty !== e) {
      this.dirty = e;
      for (const r of this.dirtyHandlers)
        r({ isDirty: e });
    }
  }
}
function Xt(t, e) {
  return new Yt(t, e);
}
const tr = {
  renderView: Kt,
  renderEditor: Xt
};
export {
  tr as default,
  Xt as renderEditor,
  tr as renderPlugin,
  Kt as renderView
};
