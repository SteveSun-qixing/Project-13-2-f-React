import { jsx as a, jsxs as E } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { useState as C, useRef as v, useEffect as ee, useCallback as _, useMemo as F } from "chips-resource://platform/vendor/react.js";
import { useCommandRuntime as be, theme as te, SettingsLayout as J, StateBoundary as fe, Alert as Q, SettingsGroup as _e, SettingsRow as Ce, Button as pe, Typography as A, Switch as we, Input as ke, Select as se, ChipsProvider as Ae, CommandProvider as Ne, App as me, Flex as z, Menu as Te, InfoCircleOutlined as Oe, DatabaseOutlined as ve, FileDoneOutlined as Re, KeyOutlined as De, SafetyCertificateOutlined as Pe, AppstoreOutlined as Ve, FolderOpenOutlined as Le, ThunderboltOutlined as Ke, BgColorsOutlined as Ge } from "chips-resource://platform/vendor/chips-ui.js";
const M = [
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
function Me() {
  return [...M].sort((e, t) => e.order - t.order);
}
function oe(e) {
  return M.find((t) => t.id === e) ?? null;
}
const G = [
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
function xe(e) {
  return G.filter((t) => t.sceneId === e);
}
function D(e) {
  return G.find((t) => t.key === e) ?? null;
}
function U(e, t) {
  if (e.kind === "boolean")
    return typeof t == "boolean" ? t : e.defaultValue;
  if (e.kind === "integer") {
    if (typeof t != "number" || !Number.isInteger(t))
      return e.defaultValue;
    const s = e.minValue ?? Number.NEGATIVE_INFINITY, r = e.maxValue ?? Number.POSITIVE_INFINITY;
    return Math.min(r, Math.max(s, t));
  }
  const n = e.options?.find((s) => s.value === t);
  return n === void 0 ? e.defaultValue : n.value;
}
function $e(e, t) {
  return t === e.defaultValue;
}
class N extends Error {
  code;
  details;
  retryable;
  constructor(t) {
    super(t.message), this.name = "ChipsError", this.code = t.code, this.details = t.details, this.retryable = t.retryable ?? !1;
  }
  /** 归一为结构化克隆兼容的普通对象，用于跨 IPC / Neon 传输。 */
  toPlain() {
    const t = {
      code: this.code,
      message: this.message,
      retryable: this.retryable
    };
    return this.details !== void 0 && (t.details = this.details), t;
  }
  static fromPlain(t) {
    return new N({
      code: t.code,
      message: t.message,
      retryable: t.retryable ?? !1,
      ...t.details !== void 0 ? { details: t.details } : {}
    });
  }
}
function Be(e) {
  if (typeof e != "object" || e === null)
    return !1;
  const t = e;
  return typeof t.code == "string" && t.code.length > 0 && typeof t.message == "string" && (t.retryable === void 0 || typeof t.retryable == "boolean");
}
const Fe = "SDK_BRIDGE_UNAVAILABLE", ie = "SDK_UNKNOWN_ERROR", ae = "发生未知错误";
function Ue(e) {
  return e instanceof Error;
}
function qe(e) {
  if (e instanceof N)
    return e;
  if (Be(e)) {
    const t = e, n = {
      code: t.code,
      message: t.message,
      retryable: t.retryable ?? !1,
      ...t.details !== void 0 ? { details: t.details } : {}
    };
    return new N(n);
  }
  return Ue(e) ? new N({
    code: ie,
    message: ae,
    details: { name: e.name, cause: e.message },
    retryable: !1
  }) : new N({
    code: ie,
    message: ae,
    details: { value: String(e) },
    retryable: !1
  });
}
function We() {
  return new N({
    code: Fe,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function b(e, t, n) {
  let s;
  try {
    s = e();
  } catch (r) {
    return Promise.reject(qe(r));
  }
  return s.request(t, n);
}
const je = "cli.command.list", He = "cli.command.get", Ye = "cli.command.resolve";
function ze(e) {
  return {
    list(t) {
      return b(e, je, t ?? {});
    },
    get(t) {
      return b(e, He, t);
    },
    resolve(t) {
      return b(e, Ye, t);
    }
  };
}
const V = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, Xe = "cli.task.create", Je = "cli.task.bindInvocation", Qe = "cli.task.cancel";
function Ze(e) {
  return {
    create(t) {
      return b(e, Xe, t).then((n) => n.task);
    },
    bindInvocation(t) {
      return b(e, Je, t).then((n) => n.task);
    },
    get(t) {
      const n = { taskId: t };
      return b(e, V.CLI_TASK_GET, n).then((s) => s.task);
    },
    active(t) {
      const n = { commandId: t };
      return b(e, V.CLI_TASK_ACTIVE, n).then((s) => s.task);
    },
    progress(t, n) {
      const s = { taskId: t, progress: n };
      return b(e, V.CLI_TASK_PROGRESS, s).then((r) => r.task);
    },
    complete(t, n) {
      const s = {
        taskId: t,
        ...n === void 0 ? {} : { output: n }
      };
      return b(e, V.CLI_TASK_COMPLETE, s).then((r) => r.task);
    },
    fail(t, n) {
      const s = { taskId: t, error: n };
      return b(e, V.CLI_TASK_FAIL, s).then((r) => r.task);
    },
    cancel(t) {
      return b(e, Qe, { taskId: t }).then((n) => n.task);
    }
  };
}
function et() {
  return globalThis.window?.chips;
}
class tt {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = ze(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = Ze(() => this.#e());
  constructor(t) {
    this.#t = t;
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
    const t = et();
    if (t === void 0)
      throw We();
    return t;
  }
  /**
   * 唯一能力调用入口；转发给目标 Bridge。
   *
   * @param capabilityId - 能力 ID（`<domain>:<action>[:<target>]`）
   * @param input - 能力输入，校验与权限判定由平台完成
   * @returns 能力输出；目标不可用或平台调用失败时以 `ChipsError` 拒绝
   */
  request(t, n) {
    return b(() => this.#e(), t, n);
  }
  /**
   * 订阅标准事件；转发给目标 Bridge。
   *
   * @param eventId - 事件 ID
   * @param handler - 载荷回调；同一 `(eventId, handler)` 多次订阅各自独立
   * @returns 可退订句柄，`dispose()` 幂等
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  subscribe(t, n) {
    return this.#e().subscribe(t, n);
  }
  /**
   * 创建 `chips-resource://` 懒打开句柄；转发给目标 Bridge。
   *
   * @param uri - 资源 URI
   * @returns 资源句柄；预检失败由目标同步抛出 `ChipsError`
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  resource(t) {
    return this.#e().resource(t);
  }
}
function nt(e) {
  return new tt(e?.bridge);
}
const R = nt(), le = "chips.official.settings", W = {
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
}, q = {
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
}, rt = "分类导航", Z = [
  {
    id: W.refreshView,
    title: "刷新当前视图",
    description: "重新读取偏好快照并刷新设置面板展示",
    shortcut: "F5",
    scope: { kind: "app", appId: le },
    handlerId: q.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  },
  ...M.map(
    (e) => ({
      id: e.commandId,
      title: `打开${e.title}设置`,
      description: `跳转到设置面板的「${e.title}」分类`,
      scope: { kind: "app", appId: le },
      handlerId: q[e.id],
      keywords: [e.id, e.title],
      group: rt
    })
  )
];
new Set(Object.values(W));
function st(e, t) {
  const n = /* @__PURE__ */ new Map();
  n.set(q.refreshView, () => {
    e.refreshView(), t({ commandId: W.refreshView, handlerId: "refresh-view", ok: !0 });
  });
  for (const s of M) {
    const r = q[s.id];
    n.set(r, (l) => {
      const o = ot(l);
      if (o.kind === "invalid" || o.kind === "ok" && o.sceneId !== s.id) {
        t({ commandId: s.commandId, handlerId: r, ok: !1 });
        return;
      }
      e.openScene(s.id), t({ commandId: s.commandId, handlerId: r, ok: !0 });
    });
  }
  return Z.map((s) => {
    const r = s.handlerId ?? "", l = n.get(r);
    return {
      commandId: s.id,
      handlerId: r,
      handler: (o) => {
        l?.(o);
      }
    };
  });
}
function ot(e) {
  if (e === void 0)
    return { kind: "absent" };
  if (typeof e != "object" || e === null)
    return { kind: "invalid" };
  const t = e;
  if (!("sceneId" in t))
    return { kind: "absent" };
  const n = t.sceneId;
  return typeof n == "string" && n.length > 0 ? { kind: "ok", sceneId: n } : { kind: "invalid" };
}
const it = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function ce(e) {
  if (typeof e == "object" && e !== null && "code" in e) {
    const t = e.code;
    if (typeof t == "string" && t.length > 0)
      return t;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function at() {
  const e = be(), [t, n] = C("registering"), [s, r] = C(null), [l, o] = C(null), d = v(null);
  ee(() => {
    let m = !1, c = null;
    return n("registering"), r(null), (async () => {
      try {
        for (const y of Z)
          await R.request("command:register", { definition: y });
        if (m)
          return;
        c = e.attach(
          st(
            {
              openScene: (y) => {
                d.current?.openScene(y);
              },
              refreshView: () => {
                d.current?.refreshView();
              }
            },
            (y) => {
              o(y);
            }
          )
        ), n("ready");
      } catch (y) {
        m || (r(ce(y)), n("error"));
      }
    })(), () => {
      m = !0, c?.dispose();
      for (const y of Z)
        R.request("command:unregister", { commandId: y.id }).catch(() => {
        });
    };
  }, [e]);
  const g = _((m) => {
    d.current = m;
  }, []), u = _(() => {
    e.invoke({ commandId: W.refreshView, source: "api" }).catch((c) => {
      r(ce(c));
    });
  }, [e]);
  return { phase: t, errorCode: s, lastInvoked: l, setActions: g, invokeRefresh: u };
}
const L = "platform", he = `${L}.`, lt = "SETTINGS_SNAPSHOT_RECEIPT_INVALID", ct = "SETTINGS_KEY_OUT_OF_NAMESPACE", dt = "SETTINGS_GATEWAY_ERROR";
class K extends Error {
  code;
  constructor(t, n) {
    super(n), this.name = "SettingsConfigError", this.code = t;
  }
}
function B(e) {
  if (e instanceof K)
    return e;
  if (typeof e == "object" && e !== null && "code" in e) {
    const t = e.code;
    if (typeof t == "string" && t.length > 0)
      return new K(t, e instanceof Error ? e.message : "未知错误");
  }
  return new K(dt, e instanceof Error ? e.message : "未知错误");
}
function de(e) {
  const t = B(e);
  return { code: t.code, message: t.message };
}
function ge(e) {
  return e.startsWith(he);
}
function X(e) {
  if (!ge(e))
    throw new K(
      ct,
      `配置键 ${e} 不属于 ${L} 命名空间`
    );
  return e.slice(he.length);
}
function ut(e) {
  return e === "CONFIG_POLICY_LOCKED" ? "该键由平台策略管理，不可在此修改" : e === "CONFIG_KEY_UNKNOWN" ? "该键未在平台配置注册，请刷新视图；若持续出现属于面板缺陷" : e === "CONFIG_VALUE_INVALID" ? "取值不符合该键的配置约束，请重新选择" : e === "CONFIG_NAMESPACE_DENIED" ? "缺少 platform 命名空间配置授权，请在权限设置中核查" : e === "CONFIG_SCOPE_INVALID" ? "当前写入层不可用，请刷新视图后重试" : e === "CONFIG_EXTERNAL_MODIFIED" ? "配置文件被外部修改，请刷新视图后重试" : e === "CONFIG_WRITE_FAILED" ? "配置落盘失败，请重试" : e === "BRIDGE_PERMISSION_DENIED" ? "缺少配置读写授权（config:write:platform），请核查应用权限" : "配置通道异常，请刷新视图重试";
}
function ue(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function ft(e) {
  if (!ue(e) || !ue(e.values))
    throw new K(lt, "配置快照回执缺少生效视图记录");
  return e.values;
}
function pt() {
  return {
    async loadPlatformSnapshot() {
      let e;
      try {
        e = await R.request("config:snapshot", {
          namespace: L,
          prefix: ""
        });
      } catch (t) {
        throw B(t);
      }
      return ft(e);
    },
    async writePlatformValue(e, t) {
      try {
        await R.request("config:set", {
          namespace: L,
          key: e,
          value: t,
          scope: "user"
        });
      } catch (n) {
        throw B(n);
      }
    },
    async resetPlatformKeys(e) {
      try {
        await R.request("config:reset", {
          namespace: L,
          keys: [...e],
          scope: "user"
        });
      } catch (t) {
        throw B(t);
      }
    },
    subscribePlatformChanges(e) {
      const t = R.subscribe("config:changed", (s) => {
        e(s);
      });
      let n = !1;
      return {
        dispose() {
          n || (n = !0, t.dispose());
        }
      };
    }
  };
}
const mt = pt();
function ht() {
  return mt;
}
function gt() {
  const e = /* @__PURE__ */ new Map(), t = (s) => {
    const r = e.get(s.key);
    return r === void 0 ? s.defaultValue : r;
  }, n = (s) => {
    const r = D(s);
    if (r === null)
      throw new Error(`未登记的配置键：${s}`);
    return r;
  };
  return {
    read: (s) => t(n(s)),
    write: (s, r) => {
      const l = n(s), o = U(l, r);
      return e.set(l.key, o), o;
    },
    reset: (s) => {
      const r = n(s);
      return e.delete(r.key), r.defaultValue;
    },
    resetKeys: (s) => {
      for (const r of s) {
        const l = n(r);
        e.delete(l.key);
      }
    },
    resetScene: (s) => {
      for (const r of G)
        r.sceneId === s && e.delete(r.key);
    },
    snapshot: () => {
      const s = {};
      for (const r of G)
        s[r.key] = t(r);
      return { values: s, layer: "session-memory" };
    }
  };
}
function yt(e) {
  const t = {}, n = {};
  for (const r of G) {
    const l = e[r.key];
    if (l === void 0) {
      t[r.key] = r.defaultValue, n[r.key] = "default";
      continue;
    }
    t[r.key] = U(r, l), n[r.key] = "user";
  }
  const s = Object.values(n).includes("user") ? "user" : "default";
  return { values: t, layer: s, layers: n };
}
function It(e) {
  const t = (r) => {
    const l = D(r);
    if (l === null)
      throw new Error(`未登记的配置键：${r}`);
    return l;
  };
  let n = null;
  const s = async () => (n = yt(await e.loadPlatformSnapshot()), n);
  return {
    load: s,
    async write(r, l) {
      const o = t(r), d = U(o, l);
      return await e.writePlatformValue(X(o.key), d), s();
    },
    async reset(r) {
      const l = t(r);
      return await e.resetPlatformKeys([X(l.key)]), s();
    },
    async resetKeys(r) {
      if (r.length === 0)
        return s();
      const l = r.map((o) => X(t(o).key));
      return await e.resetPlatformKeys(l), s();
    },
    subscribe(r) {
      const l = (o) => {
        if (!ge(o.key))
          return;
        const d = D(o.key);
        if (d === null || n === null)
          return;
        const g = { ...n.values }, u = { ...n.layers ?? {} };
        g[d.key] = U(d, o.effectiveValue), u[d.key] = o.isDefault || o.value === null ? "default" : "user", n = {
          values: g,
          layers: u,
          layer: Object.values(u).includes("user") ? "user" : "default"
        }, r(n);
      };
      return e.subscribePlatformChanges(l);
    }
  };
}
const St = /* @__PURE__ */ new Set([
  "SDK_BRIDGE_UNAVAILABLE",
  "BRIDGE_CAPABILITY_NOT_FOUND",
  "SETTINGS_GATEWAY_ERROR",
  "SETTINGS_SNAPSHOT_RECEIPT_INVALID"
]);
function Et(e) {
  const [t, n] = C("loading"), [s, r] = C(null), [l, o] = C(/* @__PURE__ */ new Set()), [d, g] = C(null), [u, m] = C(null), [c, y] = C(0), I = v(null), w = v(null), T = v(null), x = v("loading"), k = v(e.onNotify);
  k.current = e.onNotify;
  const P = _((i) => {
    x.current = i, n(i);
  }, []), j = _((i, p) => {
    o((f) => {
      const h = new Set(f);
      for (const S of i)
        p ? h.add(S) : h.delete(S);
      return h;
    });
  }, []), $ = _((i) => {
    const p = gt();
    w.current = p, T.current?.dispose(), T.current = null, I.current = null, r(p.snapshot()), m(i), g(null), P("degraded");
  }, [P]), O = _(
    (i, p, f, h) => {
      const S = I.current;
      S !== null && (g(null), j(i, !0), (async () => {
        try {
          const H = await f(S);
          r(H), k.current(p);
        } catch (H) {
          const { code: Y, message: ne } = de(H);
          if (St.has(Y)) {
            $({ code: Y, message: ne });
            const re = w.current;
            re !== null && h !== void 0 && h(re);
          } else
            g({ key: i[0] ?? "", code: Y, message: ne });
        } finally {
          j(i, !1);
        }
      })());
    },
    [$, j]
  );
  ee(() => {
    let i = !1;
    P("loading"), g(null), m(null);
    const p = It(ht());
    return I.current = p, (async () => {
      try {
        const f = await p.load();
        if (i)
          return;
        r(f), P("config"), T.current?.dispose(), T.current = p.subscribe((h) => {
          i || r(h);
        });
      } catch (f) {
        if (i)
          return;
        $(de(f));
      }
    })(), () => {
      i = !0, T.current?.dispose(), T.current = null, I.current = null;
    };
  }, [c, $, P]);
  const ye = _(
    (i, p) => {
      const f = D(i)?.label ?? i;
      if (x.current === "degraded") {
        const h = w.current;
        if (h === null)
          return;
        h.write(i, p), r(h.snapshot()), k.current(`「${f}」已更新（会话内存，未持久化）`);
        return;
      }
      O(
        [i],
        `「${f}」已更新并持久化`,
        (h) => h.write(i, p),
        (h) => {
          h.write(i, p), r(h.snapshot()), k.current(`「${f}」已更新（会话内存，未持久化）`);
        }
      );
    },
    [O]
  ), Ie = _(
    (i) => {
      const p = D(i)?.label ?? i;
      if (x.current === "degraded") {
        const f = w.current;
        if (f === null)
          return;
        f.reset(i), r(f.snapshot()), k.current(`「${p}」已恢复默认（会话内存）`);
        return;
      }
      O(
        [i],
        `「${p}」已恢复默认`,
        (f) => f.reset(i),
        (f) => {
          f.reset(i), r(f.snapshot()), k.current(`「${p}」已恢复默认（会话内存）`);
        }
      );
    },
    [O]
  ), Se = _(
    (i, p) => {
      if (i.length === 0)
        return;
      const f = p === void 0 ? `「${D(i[0] ?? "")?.label ?? i[0] ?? ""}」已恢复默认` : `「${p}」分组已恢复默认`, h = `${f}（会话内存）`;
      if (x.current === "degraded") {
        const S = w.current;
        if (S === null)
          return;
        S.resetKeys(i), r(S.snapshot()), k.current(h);
        return;
      }
      O(
        i,
        f,
        (S) => S.resetKeys(i),
        (S) => {
          S.resetKeys(i), r(S.snapshot()), k.current(h);
        }
      );
    },
    [O]
  ), Ee = _(() => {
    y((i) => i + 1);
  }, []);
  return {
    phase: t,
    snapshot: s,
    busyKeys: l,
    writeError: d,
    degradeNotice: u,
    reload: Ee,
    writeKey: ye,
    resetKey: Ie,
    resetKeys: Se
  };
}
const bt = [960, 1200, 1440, 1680, 1920];
function _t(e) {
  return e === "user" ? "生效层：用户层持久化配置（未覆盖项为默认值）" : e === "default" ? "生效层：默认值（无显式覆盖）" : "生效层：会话内存（未持久化）";
}
const Ct = ({ descriptor: e, value: t, busy: n, onChange: s }) => {
  const [r, l] = C(null);
  if (e.kind === "boolean")
    return /* @__PURE__ */ a(
      we,
      {
        checked: t === !0,
        loading: n,
        disabled: n,
        onChange: (o) => s(o),
        "aria-label": e.label
      }
    );
  if (e.kind === "integer") {
    const o = r ?? String(t);
    return /* @__PURE__ */ a(
      ke,
      {
        value: o,
        inputMode: "numeric",
        style: { width: 240 },
        "aria-label": e.label,
        disabled: n,
        onChange: (d) => {
          l(d.target.value);
          const g = Number.parseInt(d.target.value, 10);
          Number.isInteger(g) && s(g);
        },
        addonAfter: /* @__PURE__ */ a(
          se,
          {
            size: "small",
            variant: "borderless",
            placeholder: "常用档",
            style: { minWidth: 96 },
            loading: n,
            disabled: n,
            options: bt.map((d) => ({ value: d, label: `${d}px` })),
            onChange: (d) => {
              l(null), s(d);
            }
          }
        )
      }
    );
  }
  return /* @__PURE__ */ a(
    se,
    {
      value: String(t),
      style: { minWidth: 160 },
      loading: n,
      disabled: n,
      options: (e.options ?? []).map((o) => ({ value: o.value, label: o.label })),
      onChange: (o) => s(o),
      "aria-label": e.label
    }
  );
}, wt = ({ sceneId: e, runtime: t }) => {
  const { token: n } = te.useToken(), s = F(() => xe(e), [e]), r = F(() => {
    const u = [];
    for (const m of s) {
      const c = u.find((y) => y.group === m.group);
      c === void 0 ? u.push({ group: m.group, items: [m] }) : c.items.push(m);
    }
    return u;
  }, [s]);
  if (t.phase === "loading" || t.snapshot === null)
    return /* @__PURE__ */ a(J, { subtitle: "正在读取偏好快照", children: /* @__PURE__ */ a(fe, { loading: !0, minHeight: 200 }) });
  const l = t.snapshot, o = (u) => l.values[u.key] ?? u.defaultValue, d = t.writeError, g = d !== null && s.some((u) => u.key === d.key) ? d : null;
  return /* @__PURE__ */ E(J, { subtitle: _t(l.layer), children: [
    t.degradeNotice !== null ? /* @__PURE__ */ a(
      Q,
      {
        type: "warning",
        showIcon: !0,
        "data-role": "persistence-degraded",
        message: "配置持久化通道不可用",
        description: `错误码 ${t.degradeNotice.code}：${t.degradeNotice.message}。当前偏好为会话内存态，仅本次窗口会话内有效，不写入持久配置。`
      }
    ) : null,
    g !== null ? /* @__PURE__ */ a(
      Q,
      {
        type: "error",
        showIcon: !0,
        "data-role": "preference-error",
        message: `偏好写入失败（${g.code}）`,
        description: `${g.message}：${ut(g.code)}`
      }
    ) : null,
    r.map((u) => {
      const m = u.items.filter((c) => !$e(c, o(c))).map((c) => c.key);
      return /* @__PURE__ */ E(_e, { title: u.group, children: [
        u.items.map((c) => /* @__PURE__ */ a(
          Ce,
          {
            label: c.advanced ? `${c.label}（高级）` : c.label,
            description: c.description,
            control: /* @__PURE__ */ a(
              Ct,
              {
                descriptor: c,
                value: o(c),
                busy: t.busyKeys.has(c.key),
                onChange: (y) => t.writeKey(c.key, y)
              }
            )
          },
          c.key
        )),
        m.length > 0 ? /* @__PURE__ */ a("div", { style: { display: "flex", justifyContent: "flex-end", paddingBlock: 4 }, children: /* @__PURE__ */ a(
          pe,
          {
            size: "small",
            onClick: () => t.resetKeys(m, u.group),
            children: "恢复本组默认"
          }
        ) }) : null
      ] }, u.group);
    }),
    /* @__PURE__ */ a(A.Text, { type: "secondary", style: { fontSize: n.fontSizeSM }, children: "偏好经平台配置域（config:*）读写并持久化到用户层；修改即时生效，恢复默认即清退用户层显式覆盖。" })
  ] });
};
function kt(e) {
  const t = M.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`未登记的设置分类：${e}`);
  return t;
}
const At = ({ sceneId: e }) => {
  const t = F(() => kt(e), [e]), { token: n } = te.useToken();
  return /* @__PURE__ */ E(J, { title: t.title, subtitle: "该分类依赖的宿主查询域尚未就绪", children: [
    /* @__PURE__ */ a(fe, { empty: !0, emptyText: "暂无可呈现数据" }),
    /* @__PURE__ */ a(
      Q,
      {
        type: "info",
        showIcon: !0,
        message: "依赖域缺位说明",
        description: /* @__PURE__ */ E("div", { style: { display: "flex", flexDirection: "column", gap: n.marginXS }, children: [
          /* @__PURE__ */ E("span", { children: [
            "所需能力族：",
            t.requiredDomains.join("、")
          ] }),
          /* @__PURE__ */ E("span", { children: [
            t.requiredDomains.includes("config:get") ? "config:get 域已随工单066 第一批翻正就位；工作区状态查询与 shell:openExternal 域仍待落波，" : "",
            "其余域按宿主缺位勘查账随波落位，落位后本页启用对应治理界面。"
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ a(A.Text, { type: "secondary", children: "本页不做占位实现：宿主查询域落位前不呈现替代内容或不可用控件。" })
  ] });
}, Nt = "chips.official.settings", Tt = {
  appearance: /* @__PURE__ */ a(Ge, {}),
  behavior: /* @__PURE__ */ a(Ke, {}),
  workspace: /* @__PURE__ */ a(Le, {}),
  plugins: /* @__PURE__ */ a(Ve, {}),
  permissions: /* @__PURE__ */ a(Pe, {}),
  shortcuts: /* @__PURE__ */ a(De, {}),
  "file-open": /* @__PURE__ */ a(Re, {}),
  storage: /* @__PURE__ */ a(ve, {}),
  about: /* @__PURE__ */ a(Oe, {})
}, Ot = () => {
  const { token: e } = te.useToken(), { message: t } = me.useApp(), [n, s] = C("appearance"), { phase: r, errorCode: l, setActions: o, invokeRefresh: d } = at(), g = _(
    (I) => {
      t.info(I);
    },
    [t]
  ), u = Et({ onNotify: g }), { reload: m } = u;
  ee(() => (o({
    openScene: (I) => {
      const w = oe(I);
      w !== null && s(w.id);
    },
    refreshView: () => {
      m();
    }
  }), () => {
    o(null);
  }), [o, m]);
  const c = oe(n), y = F(
    () => Me().map((I) => ({
      key: I.id,
      icon: Tt[I.id],
      label: I.title
    })),
    []
  );
  return c === null ? null : /* @__PURE__ */ E(z, { style: { height: "100%", background: e.colorBgLayout }, children: [
    /* @__PURE__ */ E(
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
          /* @__PURE__ */ a(A.Text, { strong: !0, style: { paddingInline: e.paddingXS, marginBottom: e.marginSM }, children: "生态设置面板" }),
          /* @__PURE__ */ a(
            Te,
            {
              mode: "inline",
              selectedKeys: [c.id],
              items: y,
              onClick: (I) => s(I.key),
              style: { borderInlineEnd: "none", background: "transparent", flex: 1 }
            }
          ),
          /* @__PURE__ */ E("div", { style: { paddingInline: e.paddingXS }, children: [
            /* @__PURE__ */ E(A.Text, { type: "secondary", children: [
              "命令注册状态：",
              it[r]
            ] }),
            r === "error" && l !== null ? /* @__PURE__ */ E(A.Text, { type: "secondary", style: { display: "block" }, children: [
              "错误码：",
              l
            ] }) : null
          ] })
        ]
      }
    ),
    /* @__PURE__ */ a("main", { style: { flex: 1, minWidth: 0, overflow: "auto", padding: e.padding }, children: /* @__PURE__ */ E(z, { vertical: !0, gap: e.marginSM, children: [
      /* @__PURE__ */ E(z, { justify: "space-between", align: "center", children: [
        /* @__PURE__ */ E("div", { children: [
          /* @__PURE__ */ a(A.Title, { level: 4, style: { margin: 0 }, children: c.title }),
          /* @__PURE__ */ a(A.Text, { type: "secondary", children: c.summary })
        ] }),
        /* @__PURE__ */ a(pe, { onClick: d, children: "刷新当前视图" })
      ] }),
      c.requiredDomains.length === 0 ? /* @__PURE__ */ a(wt, { sceneId: c.id, runtime: u }) : /* @__PURE__ */ a(At, { sceneId: c.id })
    ] }) })
  ] });
}, Pt = () => /* @__PURE__ */ a(Ae, { appId: Nt, surface: "window", children: /* @__PURE__ */ a(Ne, { children: /* @__PURE__ */ a(me, { children: /* @__PURE__ */ a(Ot, {}) }) }) });
export {
  Pt as AppView,
  Pt as default
};
