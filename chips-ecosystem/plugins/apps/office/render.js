import { jsx as o, jsxs as a } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { useCommandRuntime as w, ChipsProvider as L, CommandProvider as R, theme as _, PanelHeader as T, Tabs as D, Button as g, BoxEmptyState as N } from "chips-resource://platform/vendor/chips-ui.js";
import { useState as m, useEffect as x, useCallback as P } from "chips-resource://platform/vendor/react.js";
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
function v(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const K = "SDK_BRIDGE_UNAVAILABLE", I = "SDK_UNKNOWN_ERROR", k = "发生未知错误";
function M(t) {
  return t instanceof Error;
}
function U(t) {
  if (t instanceof l)
    return t;
  if (v(t)) {
    const e = t, n = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new l(n);
  }
  return M(t) ? new l({
    code: I,
    message: k,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new l({
    code: I,
    message: k,
    details: { value: String(t) },
    retryable: !1
  });
}
function V() {
  return new l({
    code: K,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function i(t, e, n) {
  let r;
  try {
    r = t();
  } catch (s) {
    return Promise.reject(U(s));
  }
  return r.request(e, n);
}
const B = "cli.command.list", G = "cli.command.get", j = "cli.command.resolve";
function W(t) {
  return {
    list(e) {
      return i(t, B, e ?? {});
    },
    get(e) {
      return i(t, G, e);
    },
    resolve(e) {
      return i(t, j, e);
    }
  };
}
const u = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, F = "cli.task.create", q = "cli.task.bindInvocation", H = "cli.task.cancel";
function X(t) {
  return {
    create(e) {
      return i(t, F, e).then((n) => n.task);
    },
    bindInvocation(e) {
      return i(t, q, e).then((n) => n.task);
    },
    get(e) {
      const n = { taskId: e };
      return i(t, u.CLI_TASK_GET, n).then((r) => r.task);
    },
    active(e) {
      const n = { commandId: e };
      return i(t, u.CLI_TASK_ACTIVE, n).then((r) => r.task);
    },
    progress(e, n) {
      const r = { taskId: e, progress: n };
      return i(t, u.CLI_TASK_PROGRESS, r).then((s) => s.task);
    },
    complete(e, n) {
      const r = {
        taskId: e,
        ...n === void 0 ? {} : { output: n }
      };
      return i(t, u.CLI_TASK_COMPLETE, r).then((s) => s.task);
    },
    fail(e, n) {
      const r = { taskId: e, error: n };
      return i(t, u.CLI_TASK_FAIL, r).then((s) => s.task);
    },
    cancel(e) {
      return i(t, H, { taskId: e }).then((n) => n.task);
    }
  };
}
function z() {
  return globalThis.window?.chips;
}
class J {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = W(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = X(() => this.#e());
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
    const e = z();
    if (e === void 0)
      throw V();
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
    return i(() => this.#e(), e, n);
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
function Q(t) {
  return new J(t?.bridge);
}
const A = Q(), E = "chips.official.office", f = {
  openCard: "office:open-card",
  refreshView: "office:refresh-view"
}, S = {
  openCard: "open-card",
  refreshView: "refresh-view"
}, C = [
  {
    id: f.openCard,
    title: "打开卡片",
    description: "打开指定的卡片文件并在主窗口中展示",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: E },
    handlerId: S.openCard,
    keywords: ["open", "card", "打开", "卡片"],
    group: "文件"
  },
  {
    id: f.refreshView,
    title: "刷新当前视图",
    description: "重新拉取当前展示数据",
    shortcut: "F5",
    scope: { kind: "app", appId: E },
    handlerId: S.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  }
];
new Set(Object.values(f));
function Y(t) {
  return C.map((e) => {
    const n = e.handlerId ?? "";
    return {
      commandId: e.id,
      handlerId: n,
      handler: (r) => {
        t({ commandId: e.id, handlerId: n, payload: r });
      }
    };
  });
}
const Z = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function b(t) {
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function $() {
  const t = w(), [e, n] = m("registering"), [r, s] = m(null), [h, O] = m(null);
  x(() => {
    let c = !1, p = null;
    return n("registering"), s(null), (async () => {
      try {
        for (const d of C)
          await A.request("command:register", { definition: d });
        if (c)
          return;
        p = t.attach(Y(O)), n("ready");
      } catch (d) {
        c || (s(b(d)), n("error"));
      }
    })(), () => {
      c = !0, p?.dispose();
      for (const d of C)
        A.request("command:unregister", { commandId: d.id }).catch(() => {
        });
    };
  }, [t]);
  const y = P(
    async (c, p) => {
      try {
        p === void 0 ? await t.invoke({ commandId: c, source: "api" }) : await t.invoke({ commandId: c, payload: p, source: "api" }), s(null);
      } catch (d) {
        s(b(d));
      }
    },
    [t]
  );
  return {
    phase: e,
    errorCode: r,
    lastInvoked: h,
    invokeOpenCard: (c) => y(f.openCard, { path: c }),
    invokeRefreshView: () => y(f.refreshView)
  };
}
const ee = "chips.official.office", te = [
  {
    key: "sheet",
    label: "表格",
    status: "领域逻辑已迁移",
    description: "工作簿模型、自研公式与 xlsx 字节级读写网关已就位（15 个领域模块 + 23 个网关模块，最小合法 xlsx 夹具测试通过）；打开/保存会话链候宿主 document 会话与 file/resource 域处理器。"
  },
  {
    key: "pdf",
    label: "PDF",
    status: "阅读域逻辑已迁移",
    description: "搜索/标注/文本行/线程/盖章/页面几何等 21 个纯逻辑模块已就位（pdfjs-dist 真实解析夹具测试通过）；渲染装配候渲染帧插件执行通道。"
  },
  {
    key: "slide",
    label: "演示",
    status: "演示域模型已迁移",
    description: "动画时序、调整柄几何、放映序列等演示域模型已就位（最小合法 pptx 夹具校验通过）；画布渲染与 pptx 字节解析候选型收口。"
  },
  {
    key: "word",
    label: "Word",
    status: "候选型裁定",
    description: "word 编辑逻辑（tiptap + 引擎移植）挂起于「richtext 编辑引擎选型（tiptap 续留 vs 自研）」在册候裁项，与富文本编辑器编辑臂同源；用户裁定前不引入相关依赖。"
  }
], ne = ({
  status: t,
  description: e
}) => {
  const { token: n } = _.useToken();
  return /* @__PURE__ */ a("section", { style: { display: "flex", flexDirection: "column", gap: n.marginSM }, children: [
    /* @__PURE__ */ a("p", { style: { margin: 0, color: n.colorTextSecondary }, children: [
      "迁移状态：",
      t
    ] }),
    /* @__PURE__ */ o("p", { style: { margin: 0 }, children: e }),
    /* @__PURE__ */ o(
      N,
      {
        title: "域界面待端到端臂装配",
        description: "文档打开与编辑界面将随宿主会话链与渲染帧通道收口后接入。",
        compact: !0
      }
    )
  ] });
}, re = () => {
  const { token: t } = _.useToken();
  return /* @__PURE__ */ a(
    "section",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: t.margin,
        padding: t.padding
      },
      children: [
        /* @__PURE__ */ o(
          T,
          {
            title: "薯片办公",
            description: "Word / 表格 / 演示 / PDF 四件套查看与编辑（.docx / .xlsx / .csv / .pptx / .pdf）"
          }
        ),
        /* @__PURE__ */ o(
          D,
          {
            defaultActiveKey: "sheet",
            items: te.map((e) => ({
              key: e.key,
              label: e.label,
              children: /* @__PURE__ */ o(ne, { status: e.status, description: e.description })
            }))
          }
        )
      ]
    }
  );
}, se = () => {
  const { token: t } = _.useToken(), { phase: e, errorCode: n, lastInvoked: r, invokeOpenCard: s, invokeRefreshView: h } = $();
  return /* @__PURE__ */ a(
    "section",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: t.marginXS,
        paddingInline: t.padding,
        paddingBottom: t.padding
      },
      children: [
        /* @__PURE__ */ a("p", { style: { margin: 0 }, children: [
          "命令注册状态：",
          Z[e]
        ] }),
        n === null ? null : /* @__PURE__ */ a("p", { style: { margin: 0 }, children: [
          "最近错误码：",
          n
        ] }),
        /* @__PURE__ */ a("div", { style: { display: "flex", gap: t.marginXS }, children: [
          /* @__PURE__ */ o(g, { onClick: () => {
            s("~/文档/示例.cpk");
          }, children: "触发打开卡片命令" }),
          /* @__PURE__ */ o(g, { onClick: () => {
            h();
          }, children: "触发刷新视图命令" })
        ] }),
        /* @__PURE__ */ o("p", { style: { margin: 0 }, children: r === null ? "本窗口尚未执行过命令派发" : "最近执行：" + r.commandId })
      ]
    }
  );
}, de = () => /* @__PURE__ */ o(L, { appId: ee, surface: "window", children: /* @__PURE__ */ a(R, { children: [
  /* @__PURE__ */ o(re, {}),
  /* @__PURE__ */ o(se, {})
] }) });
export {
  de as AppView,
  de as default
};
