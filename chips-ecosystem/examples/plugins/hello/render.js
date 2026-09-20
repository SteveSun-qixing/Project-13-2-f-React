import { jsx as a, jsxs as p } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import o from "chips-resource://platform/vendor/react.js";
import { ChipsProvider as R, theme as K, Spin as N, Empty as O, Button as m } from "chips-resource://platform/vendor/chips-ui.js";
const w = "SDK_BRIDGE_UNAVAILABLE", S = "SDK_UNKNOWN_ERROR", A = "发生未知错误";
class d extends Error {
  code;
  details;
  retryable;
  constructor(e) {
    super(e.message), this.name = "ChipsError", this.code = e.code, this.details = e.details, this.retryable = e.retryable ?? !1;
  }
}
function G(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && typeof e.message == "string";
}
function U(t) {
  return t instanceof Error;
}
function D(t) {
  if (t instanceof d)
    return t;
  if (G(t)) {
    const e = t, n = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new d(n);
  }
  return U(t) ? new d({
    code: S,
    message: A,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new d({
    code: S,
    message: A,
    details: { value: String(t) },
    retryable: !1
  });
}
function v() {
  return new d({
    code: w,
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
const x = "cli.command.list", M = "cli.command.get", V = "cli.command.resolve";
function B(t) {
  return {
    list(e) {
      return r(t, x, e ?? {});
    },
    get(e) {
      return r(t, M, e);
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
}, P = "cli.task.create", j = "cli.task.bindInvocation", W = "cli.task.cancel";
function F(t) {
  return {
    create(e) {
      return r(t, P, e).then((n) => n.task);
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
      throw v();
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
const _ = z(), I = "chips.example.hello", y = `plugins.${I}`, T = "greeting", Y = `${y}.${T}`, H = "你好，世界！", J = (t) => typeof t != "object" || t === null ? !1 : t.key === Y, Q = () => {
  const { token: t } = K.useToken(), [e, n] = o.useState(H), [s, i] = o.useState(0), [E, h] = o.useState(null), [C, g] = o.useState("loading");
  o.useEffect(() => {
    let c = !0;
    (async () => {
      try {
        const l = {
          namespace: y,
          key: T
        }, f = await _.request("config:get", l);
        if (!c)
          return;
        typeof f.value == "string" && f.value.length > 0 && n(f.value), g("ready");
      } catch {
        c && g("error");
      }
    })();
    const b = _.subscribe("config:changed", (l) => {
      !J(l) || typeof l.effectiveValue != "string" || l.effectiveValue.length > 0 && n(l.effectiveValue);
    });
    return () => {
      c = !1, b.dispose();
    };
  }, []);
  const k = o.useCallback(() => {
    i((c) => c + 1);
  }, []), L = o.useCallback(() => {
    const c = { text: e };
    _.request("clipboard:write", c).then(() => h("问候语已复制到剪贴板")).catch(() => h("复制失败，请检查剪贴板权限"));
  }, [e]);
  return C === "loading" ? /* @__PURE__ */ a(N, {}) : C === "error" ? /* @__PURE__ */ a(O, { description: "读取应用配置失败" }) : /* @__PURE__ */ p(
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
        /* @__PURE__ */ a("p", { style: { margin: 0, fontSize: t.fontSizeHeading5 }, children: e }),
        /* @__PURE__ */ p("div", { style: { display: "flex", flexWrap: "wrap", gap: t.marginSM }, children: [
          /* @__PURE__ */ p(m, { type: "primary", onClick: k, children: [
            "点击次数：",
            s
          ] }),
          /* @__PURE__ */ a(m, { onClick: L, children: "复制问候语" })
        ] }),
        E !== null ? /* @__PURE__ */ a("div", { style: { color: t.colorTextSecondary }, children: E }) : null
      ]
    }
  );
}, ne = () => /* @__PURE__ */ a(R, { appId: I, surface: "window", children: /* @__PURE__ */ a(Q, {}) });
export {
  ne as AppView,
  ne as default
};
