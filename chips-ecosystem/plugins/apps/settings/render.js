import { jsxs as u, jsx as s } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { useState as I, useRef as W, useEffect as $, useCallback as D, useMemo as C } from "chips-resource://platform/vendor/react.js";
import { useCommandRuntime as z, theme as R, SettingsLayout as G, SettingsGroup as H, SettingsRow as X, Button as j, Typography as y, StateBoundary as Y, Alert as J, Switch as Q, Input as Z, Select as L, ChipsProvider as ee, CommandProvider as ne, App as F, Flex as A, Menu as te, InfoCircleOutlined as re, DatabaseOutlined as ie, FileDoneOutlined as oe, KeyOutlined as se, SafetyCertificateOutlined as ae, AppstoreOutlined as le, FolderOpenOutlined as de, ThunderboltOutlined as ce, BgColorsOutlined as ue } from "chips-resource://platform/vendor/chips-ui.js";
const E = [
  {
    id: "appearance",
    title: "外观",
    order: 1,
    summary: "界面密度、动效偏好、默认窗口宽度",
    commandId: "settings:open-appearance",
    requiredDomains: []
  },
  {
    id: "behavior",
    title: "行为",
    order: 2,
    summary: "系统通知、自动检查更新、日志级别（高级）",
    commandId: "settings:open-behavior",
    requiredDomains: []
  },
  {
    id: "workspace",
    title: "工作区",
    order: 3,
    summary: "当前工作区、切换、打开目录、开发/用户隔离说明",
    commandId: "settings:open-workspace",
    requiredDomains: ["config:get", "shell:openExternal"]
  },
  {
    id: "plugins",
    title: "插件治理",
    order: 4,
    summary: "四角色插件列表与详情、安装、启停、权限审查、更新、卸载、数据清理、快捷方式",
    commandId: "settings:open-plugins",
    requiredDomains: ["插件治理查询域（安装/启停/卸载清单）"]
  },
  {
    id: "permissions",
    title: "权限",
    order: 5,
    summary: "授权总览、撤销与恢复、审计记录",
    commandId: "settings:open-permissions",
    requiredDomains: ["权限治理查询域（授权记录/审计）"]
  },
  {
    id: "shortcuts",
    title: "快捷键",
    order: 6,
    summary: "命令快捷键查看、重绑、禁用、冲突处理、导入导出",
    commandId: "settings:open-shortcuts",
    requiredDomains: ["command:list", "shortcut:register"]
  },
  {
    id: "file-open",
    title: "文件打开方式",
    order: 7,
    summary: "按扩展名与 MIME 分组的默认处理器治理",
    commandId: "settings:open-file-open",
    requiredDomains: ["资源打开治理查询域（处理器槽位）"]
  },
  {
    id: "storage",
    title: "存储缓存",
    order: 8,
    summary: "缓存、日志、备份、更新暂存与插件数据的占用与清理",
    commandId: "settings:open-storage",
    requiredDomains: ["存储占用查询域（工作区保留区）"]
  },
  {
    id: "about",
    title: "关于更新",
    order: 9,
    summary: "版本、系统信息、更新通道与状态、许可与致谢",
    commandId: "settings:open-about",
    requiredDomains: ["system:info"]
  }
];
function pe() {
  return [...E].sort((n, e) => n.order - e.order);
}
function M(n) {
  return E.find((e) => e.id === n) ?? null;
}
const _ = [
  {
    key: "platform.appearance.density",
    sceneId: "appearance",
    group: "界面",
    label: "界面密度",
    description: "切换界面密度语义并即时生效；不改变系统缩放",
    kind: "enum",
    defaultValue: "comfortable",
    options: [
      { value: "comfortable", label: "舒适" },
      { value: "compact", label: "紧凑" }
    ]
  },
  {
    key: "platform.appearance.motion",
    sceneId: "appearance",
    group: "界面",
    label: "动效偏好",
    description: "「跟随系统」遵循操作系统减少动态效果；「减少动效」由平台统一关闭非必要过渡",
    kind: "enum",
    defaultValue: "system",
    options: [
      { value: "system", label: "跟随系统" },
      { value: "reduced", label: "减少动效" }
    ]
  },
  {
    key: "platform.window.defaultWidth",
    sceneId: "appearance",
    group: "窗口",
    label: "默认窗口宽度",
    description: "仅影响后续新创建的应用窗口，不改变已打开窗口",
    kind: "integer",
    defaultValue: 1200,
    minValue: 640
  },
  {
    key: "platform.behavior.notifications",
    sceneId: "behavior",
    group: "通知与更新",
    label: "系统通知",
    description: "关闭后平台在通知能力出口统一丢弃系统通知；不改变应用内界面提醒",
    kind: "boolean",
    defaultValue: !0
  },
  {
    key: "platform.behavior.autoCheckUpdate",
    sceneId: "behavior",
    group: "通知与更新",
    label: "自动检查更新",
    description: "关闭后停止平台定时更新检查；仍可在「关于更新」页发起手动检查",
    kind: "boolean",
    defaultValue: !0
  },
  {
    key: "platform.log.level",
    sceneId: "behavior",
    group: "高级",
    label: "日志级别",
    description: "调整平台日志输出级别；该键已注册于平台 schema",
    kind: "enum",
    defaultValue: "info",
    advanced: !0,
    options: [
      { value: "error", label: "错误" },
      { value: "warn", label: "警告" },
      { value: "info", label: "信息" },
      { value: "debug", label: "调试" }
    ]
  }
];
function fe(n) {
  return _.filter((e) => e.sceneId === n);
}
function T(n) {
  return _.find((e) => e.key === n) ?? null;
}
function me(n, e) {
  if (n.kind === "boolean")
    return typeof e == "boolean" ? e : n.defaultValue;
  if (n.kind === "integer") {
    if (typeof e != "number" || !Number.isInteger(e))
      return n.defaultValue;
    const r = n.minValue ?? Number.NEGATIVE_INFINITY, o = n.maxValue ?? Number.POSITIVE_INFINITY;
    return Math.min(o, Math.max(r, e));
  }
  const t = n.options?.find((r) => r.value === e);
  return t === void 0 ? n.defaultValue : t.value;
}
function x(n, e) {
  return e === n.defaultValue;
}
function he() {
  const n = /* @__PURE__ */ new Map(), e = (t) => {
    const r = n.get(t.key);
    return r === void 0 ? t.defaultValue : r;
  };
  return {
    read: (t) => {
      const r = T(t);
      if (r === null)
        throw new Error(`未登记的配置键：${t}`);
      return e(r);
    },
    write: (t, r) => {
      const o = T(t);
      if (o === null)
        throw new Error(`未登记的配置键：${t}`);
      const l = me(o, r);
      return n.set(o.key, l), l;
    },
    reset: (t) => {
      const r = T(t);
      if (r === null)
        throw new Error(`未登记的配置键：${t}`);
      return n.delete(r.key), r.defaultValue;
    },
    resetScene: (t) => {
      for (const r of _)
        r.sceneId === t && n.delete(r.key);
    },
    snapshot: () => {
      const t = {};
      for (const r of _)
        t[r.key] = e(r);
      return { values: t, layer: "session-memory" };
    }
  };
}
const ge = he();
function ye() {
  return ge;
}
class b extends Error {
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
    return new b({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function be(n) {
  if (typeof n != "object" || n === null)
    return !1;
  const e = n;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const Ie = "SDK_BRIDGE_UNAVAILABLE", P = "SDK_UNKNOWN_ERROR", K = "发生未知错误";
function ke(n) {
  return n instanceof Error;
}
function Se(n) {
  if (n instanceof b)
    return n;
  if (be(n)) {
    const e = n, t = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new b(t);
  }
  return ke(n) ? new b({
    code: P,
    message: K,
    details: { name: n.name, cause: n.message },
    retryable: !1
  }) : new b({
    code: P,
    message: K,
    details: { value: String(n) },
    retryable: !1
  });
}
function Ee() {
  return new b({
    code: Ie,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function f(n, e, t) {
  let r;
  try {
    r = n();
  } catch (o) {
    return Promise.reject(Se(o));
  }
  return r.request(e, t);
}
const Ce = "cli.command.list", _e = "cli.command.get", we = "cli.command.resolve";
function ve(n) {
  return {
    list(e) {
      return f(n, Ce, e ?? {});
    },
    get(e) {
      return f(n, _e, e);
    },
    resolve(e) {
      return f(n, we, e);
    }
  };
}
const S = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, Ae = "cli.task.create", Te = "cli.task.bindInvocation", Oe = "cli.task.cancel";
function De(n) {
  return {
    create(e) {
      return f(n, Ae, e).then((t) => t.task);
    },
    bindInvocation(e) {
      return f(n, Te, e).then((t) => t.task);
    },
    get(e) {
      const t = { taskId: e };
      return f(n, S.CLI_TASK_GET, t).then((r) => r.task);
    },
    active(e) {
      const t = { commandId: e };
      return f(n, S.CLI_TASK_ACTIVE, t).then((r) => r.task);
    },
    progress(e, t) {
      const r = { taskId: e, progress: t };
      return f(n, S.CLI_TASK_PROGRESS, r).then((o) => o.task);
    },
    complete(e, t) {
      const r = {
        taskId: e,
        ...t === void 0 ? {} : { output: t }
      };
      return f(n, S.CLI_TASK_COMPLETE, r).then((o) => o.task);
    },
    fail(e, t) {
      const r = { taskId: e, error: t };
      return f(n, S.CLI_TASK_FAIL, r).then((o) => o.task);
    },
    cancel(e) {
      return f(n, Oe, { taskId: e }).then((t) => t.task);
    }
  };
}
function Ne() {
  return globalThis.window?.chips;
}
class Re {
  #n;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = ve(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = De(() => this.#e());
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
    const e = Ne();
    if (e === void 0)
      throw Ee();
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
    return f(() => this.#e(), e, t);
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
function Ve(n) {
  return new Re(n?.bridge);
}
const B = Ve(), q = "chips.official.settings", v = {
  refreshView: "settings:refresh-view",
  appearance: "settings:open-appearance",
  behavior: "settings:open-behavior",
  workspace: "settings:open-workspace",
  plugins: "settings:open-plugins",
  permissions: "settings:open-permissions",
  shortcuts: "settings:open-shortcuts",
  "file-open": "settings:open-file-open",
  storage: "settings:open-storage",
  about: "settings:open-about"
}, w = {
  refreshView: "refresh-view",
  appearance: "open-appearance",
  behavior: "open-behavior",
  workspace: "open-workspace",
  plugins: "open-plugins",
  permissions: "open-permissions",
  shortcuts: "open-shortcuts",
  "file-open": "open-file-open",
  storage: "open-storage",
  about: "open-about"
}, Le = "分类导航", N = [
  {
    id: v.refreshView,
    title: "刷新当前视图",
    description: "重新读取偏好快照并刷新设置面板展示",
    shortcut: "F5",
    scope: { kind: "app", appId: q },
    handlerId: w.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  },
  ...E.map(
    (n) => ({
      id: n.commandId,
      title: `打开${n.title}设置`,
      description: `跳转到设置面板的「${n.title}」分类`,
      scope: { kind: "app", appId: q },
      handlerId: w[n.id],
      keywords: [n.id, n.title],
      group: Le
    })
  )
];
new Set(Object.values(v));
function Me(n, e) {
  const t = /* @__PURE__ */ new Map();
  t.set(w.refreshView, () => {
    n.refreshView(), e({ commandId: v.refreshView, handlerId: "refresh-view", ok: !0 });
  });
  for (const r of E) {
    const o = w[r.id];
    t.set(o, (l) => {
      const d = xe(l);
      if (d.kind === "invalid" || d.kind === "ok" && d.sceneId !== r.id) {
        e({ commandId: r.commandId, handlerId: o, ok: !1 });
        return;
      }
      n.openScene(r.id), e({ commandId: r.commandId, handlerId: o, ok: !0 });
    });
  }
  return N.map((r) => {
    const o = r.handlerId ?? "", l = t.get(o);
    return {
      commandId: r.id,
      handlerId: o,
      handler: (d) => {
        l?.(d);
      }
    };
  });
}
function xe(n) {
  if (n === void 0)
    return { kind: "absent" };
  if (typeof n != "object" || n === null)
    return { kind: "invalid" };
  const e = n;
  if (!("sceneId" in e))
    return { kind: "absent" };
  const t = e.sceneId;
  return typeof t == "string" && t.length > 0 ? { kind: "ok", sceneId: t } : { kind: "invalid" };
}
const Pe = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function U(n) {
  if (typeof n == "object" && n !== null && "code" in n) {
    const e = n.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function Ke() {
  const n = z(), [e, t] = I("registering"), [r, o] = I(null), [l, d] = I(null), m = W(null);
  $(() => {
    let p = !1, a = null;
    return t("registering"), o(null), (async () => {
      try {
        for (const i of N)
          await B.request("command:register", { definition: i });
        if (p)
          return;
        a = n.attach(
          Me(
            {
              openScene: (i) => {
                m.current?.openScene(i);
              },
              refreshView: () => {
                m.current?.refreshView();
              }
            },
            (i) => {
              d(i);
            }
          )
        ), t("ready");
      } catch (i) {
        p || (o(U(i)), t("error"));
      }
    })(), () => {
      p = !0, a?.dispose();
      for (const i of N)
        B.request("command:unregister", { commandId: i.id }).catch(() => {
        });
    };
  }, [n]);
  const k = D((p) => {
    m.current = p;
  }, []), g = D(() => {
    n.invoke({ commandId: v.refreshView, source: "api" }).catch((a) => {
      o(U(a));
    });
  }, [n]);
  return { phase: e, errorCode: r, lastInvoked: l, setActions: k, invokeRefresh: g };
}
const O = "会话内存（未持久化，工单066）", Be = [960, 1200, 1440, 1680, 1920], qe = ({ descriptor: n, value: e, onChange: t }) => {
  const [r, o] = I(null);
  if (n.kind === "boolean")
    return /* @__PURE__ */ s(Q, { checked: e === !0, onChange: (l) => t(l), "aria-label": n.label });
  if (n.kind === "integer") {
    const l = r ?? String(e);
    return /* @__PURE__ */ s(
      Z,
      {
        value: l,
        inputMode: "numeric",
        style: { width: 240 },
        "aria-label": n.label,
        onChange: (d) => {
          o(d.target.value);
          const m = Number.parseInt(d.target.value, 10);
          Number.isInteger(m) && t(m);
        },
        addonAfter: /* @__PURE__ */ s(
          L,
          {
            size: "small",
            variant: "borderless",
            placeholder: "常用档",
            style: { minWidth: 96 },
            options: Be.map((d) => ({ value: d, label: `${d}px` })),
            onChange: (d) => {
              o(null), t(d);
            }
          }
        )
      }
    );
  }
  return /* @__PURE__ */ s(
    L,
    {
      value: String(e),
      style: { minWidth: 160 },
      options: (n.options ?? []).map((l) => ({ value: l.value, label: l.label })),
      onChange: (l) => t(l),
      "aria-label": n.label
    }
  );
}, Ue = ({ sceneId: n, store: e, onNotify: t }) => {
  const { token: r } = R.useToken(), o = C(() => fe(n), [n]), [l, d] = I(
    () => Object.fromEntries(o.map((a) => [a.key, e.read(a.key)]))
  ), m = C(() => {
    const a = [];
    for (const i of o) {
      const h = a.find((c) => c.group === i.group);
      h === void 0 ? a.push({ group: i.group, items: [i] }) : h.items.push(i);
    }
    return a;
  }, [o]), k = (a, i) => {
    const h = e.write(a.key, i);
    d((c) => ({ ...c, [a.key]: h })), t(`「${a.label}」已更新（${O}）`);
  }, g = (a) => {
    const i = e.reset(a.key);
    d((h) => ({ ...h, [a.key]: i })), t(`「${a.label}」已恢复默认`);
  }, p = (a) => l[a.key] ?? e.read(a.key);
  return /* @__PURE__ */ u(G, { subtitle: `生效层：${O}`, children: [
    m.map((a) => /* @__PURE__ */ u(H, { title: a.group, children: [
      a.items.map((i) => /* @__PURE__ */ s(
        X,
        {
          label: i.advanced ? `${i.label}（高级）` : i.label,
          description: i.description,
          control: /* @__PURE__ */ s(
            qe,
            {
              descriptor: i,
              value: p(i),
              onChange: (h) => k(i, h)
            }
          )
        },
        i.key
      )),
      a.items.some((i) => !x(i, p(i))) ? /* @__PURE__ */ s("div", { style: { display: "flex", justifyContent: "flex-end", paddingBlock: 4 }, children: /* @__PURE__ */ s(
        j,
        {
          size: "small",
          onClick: () => {
            for (const i of a.items)
              x(i, p(i)) || g(i);
          },
          children: "恢复本组默认"
        }
      ) }) : null
    ] }, a.group)),
    /* @__PURE__ */ u(y.Text, { type: "secondary", style: { fontSize: r.fontSizeSM }, children: [
      "偏好当前生效层：",
      O,
      "。配置域宿主处理器落波后换接持久实现，消费面零改动。"
    ] })
  ] });
};
function $e(n) {
  const e = E.find((t) => t.id === n);
  if (e === void 0)
    throw new Error(`未登记的设置分类：${n}`);
  return e;
}
const Ge = ({ sceneId: n }) => {
  const e = C(() => $e(n), [n]), { token: t } = R.useToken();
  return /* @__PURE__ */ u(G, { title: e.title, subtitle: "该分类依赖的宿主查询域尚未就绪", children: [
    /* @__PURE__ */ s(Y, { empty: !0, emptyText: "暂无可呈现数据" }),
    /* @__PURE__ */ s(
      J,
      {
        type: "info",
        showIcon: !0,
        message: "依赖域缺位说明",
        description: /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", gap: t.marginXS }, children: [
          /* @__PURE__ */ u("span", { children: [
            "所需能力族：",
            e.requiredDomains.join("、")
          ] }),
          /* @__PURE__ */ u("span", { children: [
            e.requiredDomains.includes("config:get") ? "config:get 域缺位已在册工单066；" : "",
            "其余域按宿主缺位勘查账随波落位，落位后本页启用对应治理界面。"
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ s(y.Text, { type: "secondary", children: "本页不做占位实现：宿主查询域落位前不呈现替代内容或不可用控件。" })
  ] });
}, je = "chips.official.settings", Fe = {
  appearance: /* @__PURE__ */ s(ue, {}),
  behavior: /* @__PURE__ */ s(ce, {}),
  workspace: /* @__PURE__ */ s(de, {}),
  plugins: /* @__PURE__ */ s(le, {}),
  permissions: /* @__PURE__ */ s(ae, {}),
  shortcuts: /* @__PURE__ */ s(se, {}),
  "file-open": /* @__PURE__ */ s(oe, {}),
  storage: /* @__PURE__ */ s(ie, {}),
  about: /* @__PURE__ */ s(re, {})
}, We = ({ store: n }) => {
  const { token: e } = R.useToken(), { message: t } = F.useApp(), [r, o] = I("appearance"), [l, d] = I(0), { phase: m, errorCode: k, setActions: g, invokeRefresh: p } = Ke();
  $(() => (g({
    openScene: (c) => {
      const V = M(c);
      V !== null && o(V.id);
    },
    refreshView: () => {
      d((c) => c + 1);
    }
  }), () => {
    g(null);
  }), [g]);
  const a = D(
    (c) => {
      t.info(c);
    },
    [t]
  ), i = M(r), h = C(
    () => pe().map((c) => ({
      key: c.id,
      icon: Fe[c.id],
      label: c.title
    })),
    []
  );
  return i === null ? null : /* @__PURE__ */ u(A, { style: { height: "100%", background: e.colorBgLayout }, children: [
    /* @__PURE__ */ u(
      "aside",
      {
        style: {
          width: 232,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          padding: e.paddingSM,
          background: e.colorBgContainer,
          borderInlineEnd: `1px solid ${e.colorBorderSecondary}`,
          overflow: "auto"
        },
        children: [
          /* @__PURE__ */ s(y.Text, { strong: !0, style: { paddingInline: e.paddingXS, marginBottom: e.marginSM }, children: "生态设置面板" }),
          /* @__PURE__ */ s(
            te,
            {
              mode: "inline",
              selectedKeys: [i.id],
              items: h,
              onClick: (c) => o(c.key),
              style: { borderInlineEnd: "none", background: "transparent", flex: 1 }
            }
          ),
          /* @__PURE__ */ u("div", { style: { paddingInline: e.paddingXS }, children: [
            /* @__PURE__ */ u(y.Text, { type: "secondary", children: [
              "命令注册状态：",
              Pe[m]
            ] }),
            m === "error" && k !== null ? /* @__PURE__ */ u(y.Text, { type: "secondary", style: { display: "block" }, children: [
              "错误码：",
              k
            ] }) : null
          ] })
        ]
      }
    ),
    /* @__PURE__ */ s("main", { style: { flex: 1, minWidth: 0, overflow: "auto", padding: e.padding }, children: /* @__PURE__ */ u(A, { vertical: !0, gap: e.marginSM, children: [
      /* @__PURE__ */ u(A, { justify: "space-between", align: "center", children: [
        /* @__PURE__ */ u("div", { children: [
          /* @__PURE__ */ s(y.Title, { level: 4, style: { margin: 0 }, children: i.title }),
          /* @__PURE__ */ s(y.Text, { type: "secondary", children: i.summary })
        ] }),
        /* @__PURE__ */ s(j, { onClick: p, children: "刷新当前视图" })
      ] }),
      i.requiredDomains.length === 0 ? /* @__PURE__ */ s(
        Ue,
        {
          sceneId: i.id,
          store: n,
          onNotify: a
        },
        `${i.id}-${l}`
      ) : /* @__PURE__ */ s(Ge, { sceneId: i.id })
    ] }) })
  ] });
}, Ye = () => /* @__PURE__ */ s(ee, { appId: je, surface: "window", children: /* @__PURE__ */ s(ne, { children: /* @__PURE__ */ s(F, { children: /* @__PURE__ */ s(We, { store: ye() }) }) }) });
export {
  Ye as AppView,
  Ye as default
};
