import { jsx as l, jsxs as c } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import O, { useState as m, useEffect as R, useCallback as b } from "chips-resource://platform/vendor/react.js";
import { useCommandRuntime as T, ChipsProvider as v, CommandProvider as N, theme as w, Button as C } from "chips-resource://platform/vendor/chips-ui.js";
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
function D(n) {
  if (typeof n != "object" || n === null)
    return !1;
  const e = n;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const K = "SDK_BRIDGE_UNAVAILABLE", g = "SDK_UNKNOWN_ERROR", A = "发生未知错误";
function P(n) {
  return n instanceof Error;
}
function M(n) {
  if (n instanceof d)
    return n;
  if (D(n)) {
    const e = n, t = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new d(t);
  }
  return P(n) ? new d({
    code: g,
    message: A,
    details: { name: n.name, cause: n.message },
    retryable: !1
  }) : new d({
    code: g,
    message: A,
    details: { value: String(n) },
    retryable: !1
  });
}
function U() {
  return new d({
    code: K,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function s(n, e, t) {
  let r;
  try {
    r = n();
  } catch (i) {
    return Promise.reject(M(i));
  }
  return r.request(e, t);
}
const V = "cli.command.list", B = "cli.command.get", x = "cli.command.resolve";
function G(n) {
  return {
    list(e) {
      return s(n, V, e ?? {});
    },
    get(e) {
      return s(n, B, e);
    },
    resolve(e) {
      return s(n, x, e);
    }
  };
}
const p = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, j = "cli.task.create", q = "cli.task.bindInvocation", W = "cli.task.cancel";
function F(n) {
  return {
    create(e) {
      return s(n, j, e).then((t) => t.task);
    },
    bindInvocation(e) {
      return s(n, q, e).then((t) => t.task);
    },
    get(e) {
      const t = { taskId: e };
      return s(n, p.CLI_TASK_GET, t).then((r) => r.task);
    },
    active(e) {
      const t = { commandId: e };
      return s(n, p.CLI_TASK_ACTIVE, t).then((r) => r.task);
    },
    progress(e, t) {
      const r = { taskId: e, progress: t };
      return s(n, p.CLI_TASK_PROGRESS, r).then((i) => i.task);
    },
    complete(e, t) {
      const r = {
        taskId: e,
        ...t === void 0 ? {} : { output: t }
      };
      return s(n, p.CLI_TASK_COMPLETE, r).then((i) => i.task);
    },
    fail(e, t) {
      const r = { taskId: e, error: t };
      return s(n, p.CLI_TASK_FAIL, r).then((i) => i.task);
    },
    cancel(e) {
      return s(n, W, { taskId: e }).then((t) => t.task);
    }
  };
}
function H() {
  return globalThis.window?.chips;
}
class X {
  #n;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = G(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = F(() => this.#e());
  constructor(e) {
    this.#n = e;
  }
  /**
   * 解析本次调用的目标 Bridge。
   *
   * @returns 注入目标或当前 `window.chips`
   * @throws ChipsError 两者均不可用时抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  #e() {
    if (this.#n !== void 0)
      return this.#n;
    const e = H();
    if (e === void 0)
      throw U();
    return e;
  }
  /**
   * 唯一能力调用入口；转发给目标 Bridge。
   *
   * @param capabilityId - 能力 ID（`<domain>:<action>[:<target>]`）
   * @param input - 能力输入，校验与权限判定由平台完成
   * @returns 能力输出；目标不可用或平台调用失败时以 `ChipsError` 拒绝
   */
  request(e, t) {
    return s(() => this.#e(), e, t);
  }
  /**
   * 订阅标准事件；转发给目标 Bridge。
   *
   * @param eventId - 事件 ID
   * @param handler - 载荷回调；同一 `(eventId, handler)` 多次订阅各自独立
   * @returns 可退订句柄，`dispose()` 幂等
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  subscribe(e, t) {
    return this.#e().subscribe(e, t);
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
function z(n) {
  return new X(n?.bridge);
}
const y = z(), E = "chips.official.universal-file-viewer", f = {
  openCard: "universal-file-viewer:open-card",
  refreshView: "universal-file-viewer:refresh-view"
}, k = {
  openCard: "open-card",
  refreshView: "refresh-view"
}, _ = [
  {
    id: f.openCard,
    title: "打开卡片",
    description: "打开指定的卡片文件并在主窗口中展示",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: E },
    handlerId: k.openCard,
    keywords: ["open", "card", "打开", "卡片"],
    group: "文件"
  },
  {
    id: f.refreshView,
    title: "刷新当前视图",
    description: "重新拉取当前展示数据",
    shortcut: "F5",
    scope: { kind: "app", appId: E },
    handlerId: k.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  }
];
new Set(Object.values(f));
function J(n) {
  return _.map((e) => {
    const t = e.handlerId ?? "";
    return {
      commandId: e.id,
      handlerId: t,
      handler: (r) => {
        n({ commandId: e.id, handlerId: t, payload: r });
      }
    };
  });
}
const Q = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function S(n) {
  if (typeof n == "object" && n !== null && "code" in n) {
    const e = n.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function Y() {
  const n = T(), [e, t] = m("registering"), [r, i] = m(null), [h, L] = m(null);
  R(() => {
    let o = !1, u = null;
    return t("registering"), i(null), (async () => {
      try {
        for (const a of _)
          await y.request("command:register", { definition: a });
        if (o)
          return;
        u = n.attach(J(L)), t("ready");
      } catch (a) {
        o || (i(S(a)), t("error"));
      }
    })(), () => {
      o = !0, u?.dispose();
      for (const a of _)
        y.request("command:unregister", { commandId: a.id }).catch(() => {
        });
    };
  }, [n]);
  const I = b(
    async (o, u) => {
      try {
        u === void 0 ? await n.invoke({ commandId: o, source: "api" }) : await n.invoke({ commandId: o, payload: u, source: "api" }), i(null);
      } catch (a) {
        i(S(a));
      }
    },
    [n]
  );
  return {
    phase: e,
    errorCode: r,
    lastInvoked: h,
    invokeOpenCard: (o) => I(f.openCard, { path: o }),
    invokeRefreshView: () => I(f.refreshView)
  };
}
const Z = "chips.official.universal-file-viewer", $ = () => {
  const { token: n } = w.useToken(), [e, t] = O.useState(0);
  return /* @__PURE__ */ c(
    "section",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: n.marginSM,
        padding: n.padding
      },
      children: [
        /* @__PURE__ */ l("p", { style: { margin: 0 }, children: "你好，这是「万能文件查看器」的应用界面。" }),
        /* @__PURE__ */ c(C, { type: "primary", onClick: () => t((r) => r + 1), children: [
          "点击次数：",
          e
        ] })
      ]
    }
  );
}, ee = () => {
  const { token: n } = w.useToken(), { phase: e, errorCode: t, lastInvoked: r, invokeOpenCard: i, invokeRefreshView: h } = Y();
  return /* @__PURE__ */ c(
    "section",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: n.marginXS,
        paddingInline: n.padding,
        paddingBottom: n.padding
      },
      children: [
        /* @__PURE__ */ c("p", { style: { margin: 0 }, children: [
          "命令注册状态：",
          Q[e]
        ] }),
        t === null ? null : /* @__PURE__ */ c("p", { style: { margin: 0 }, children: [
          "最近错误码：",
          t
        ] }),
        /* @__PURE__ */ c("div", { style: { display: "flex", gap: n.marginXS }, children: [
          /* @__PURE__ */ l(C, { onClick: () => {
            i("~/文档/示例.cpk");
          }, children: "触发打开卡片命令" }),
          /* @__PURE__ */ l(C, { onClick: () => {
            h();
          }, children: "触发刷新视图命令" })
        ] }),
        /* @__PURE__ */ l("p", { style: { margin: 0 }, children: r === null ? "本窗口尚未执行过命令派发" : "最近执行：" + r.commandId })
      ]
    }
  );
}, se = () => /* @__PURE__ */ l(v, { appId: Z, surface: "window", children: /* @__PURE__ */ c(N, { children: [
  /* @__PURE__ */ l($, {}),
  /* @__PURE__ */ l(ee, {})
] }) });
export {
  se as AppView,
  se as default
};
