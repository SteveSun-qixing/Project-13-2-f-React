import { jsx as o, jsxs as p } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import a from "chips-resource://platform/vendor/react.js";
import { ChipsProvider as R, theme as K, Spin as N, Empty as O, Button as C } from "chips-resource://platform/vendor/chips-ui.js";
class l extends Error {
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
    return new l({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function w(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const G = "SDK_BRIDGE_UNAVAILABLE", y = "SDK_UNKNOWN_ERROR", S = "发生未知错误";
function U(t) {
  return t instanceof Error;
}
function D(t) {
  if (t instanceof l)
    return t;
  if (w(t)) {
    const e = t, n = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new l(n);
  }
  return U(t) ? new l({
    code: y,
    message: S,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new l({
    code: y,
    message: S,
    details: { value: String(t) },
    retryable: !1
  });
}
function x() {
  return new l({
    code: G,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function r(t, e, n) {
  let s;
  try {
    s = t();
  } catch (i) {
    return Promise.reject(D(i));
  }
  return s.request(e, n);
}
const M = "cli.command.list", P = "cli.command.get", V = "cli.command.resolve";
function B(t) {
  return {
    list(e) {
      return r(t, M, e ?? {});
    },
    get(e) {
      return r(t, P, e);
    },
    resolve(e) {
      return r(t, V, e);
    }
  };
}
const u = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, v = "cli.task.create", j = "cli.task.bindInvocation", W = "cli.task.cancel";
function F(t) {
  return {
    create(e) {
      return r(t, v, e).then((n) => n.task);
    },
    bindInvocation(e) {
      return r(t, j, e).then((n) => n.task);
    },
    get(e) {
      const n = { taskId: e };
      return r(t, u.CLI_TASK_GET, n).then((s) => s.task);
    },
    active(e) {
      const n = { commandId: e };
      return r(t, u.CLI_TASK_ACTIVE, n).then((s) => s.task);
    },
    progress(e, n) {
      const s = { taskId: e, progress: n };
      return r(t, u.CLI_TASK_PROGRESS, s).then((i) => i.task);
    },
    complete(e, n) {
      const s = {
        taskId: e,
        ...n === void 0 ? {} : { output: n }
      };
      return r(t, u.CLI_TASK_COMPLETE, s).then((i) => i.task);
    },
    fail(e, n) {
      const s = { taskId: e, error: n };
      return r(t, u.CLI_TASK_FAIL, s).then((i) => i.task);
    },
    cancel(e) {
      return r(t, W, { taskId: e }).then((n) => n.task);
    }
  };
}
function q() {
  return globalThis.window?.chips;
}
class $ {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = B(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = F(() => this.#e());
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
    const e = q();
    if (e === void 0)
      throw x();
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
    return r(() => this.#e(), e, n);
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
function z(t) {
  return new $(t?.bridge);
}
const h = z(), A = "chips.example.hello", b = `plugins.${A}`, I = "greeting", Y = `${b}.${I}`, H = "你好，世界！", J = (t) => typeof t != "object" || t === null ? !1 : t.key === Y, Q = () => {
  const { token: t } = K.useToken(), [e, n] = a.useState(H), [s, i] = a.useState(0), [_, E] = a.useState(null), [g, m] = a.useState("loading");
  a.useEffect(() => {
    let c = !0;
    (async () => {
      try {
        const d = {
          namespace: b,
          key: I
        }, f = await h.request("config:get", d);
        if (!c)
          return;
        typeof f.value == "string" && f.value.length > 0 && n(f.value), m("ready");
      } catch {
        c && m("error");
      }
    })();
    const L = h.subscribe("config:changed", (d) => {
      !J(d) || typeof d.effectiveValue != "string" || d.effectiveValue.length > 0 && n(d.effectiveValue);
    });
    return () => {
      c = !1, L.dispose();
    };
  }, []);
  const T = a.useCallback(() => {
    i((c) => c + 1);
  }, []), k = a.useCallback(() => {
    const c = { text: e };
    h.request("clipboard:write", c).then(() => E("问候语已复制到剪贴板")).catch(() => E("复制失败，请检查剪贴板权限"));
  }, [e]);
  return g === "loading" ? /* @__PURE__ */ o(N, {}) : g === "error" ? /* @__PURE__ */ o(O, { description: "读取应用配置失败" }) : /* @__PURE__ */ p(
    "section",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: t.marginSM,
        padding: t.padding,
        color: t.colorText
      },
      children: [
        /* @__PURE__ */ o("p", { style: { margin: 0, fontSize: t.fontSizeHeading5 }, children: e }),
        /* @__PURE__ */ p("div", { style: { display: "flex", flexWrap: "wrap", gap: t.marginSM }, children: [
          /* @__PURE__ */ p(C, { type: "primary", onClick: T, children: [
            "点击次数：",
            s
          ] }),
          /* @__PURE__ */ o(C, { onClick: k, children: "复制问候语" })
        ] }),
        _ !== null ? /* @__PURE__ */ o("div", { style: { color: t.colorTextSecondary }, children: _ }) : null
      ]
    }
  );
}, ne = () => /* @__PURE__ */ o(R, { appId: A, surface: "window", children: /* @__PURE__ */ o(Q, {}) });
export {
  ne as AppView,
  ne as default
};
