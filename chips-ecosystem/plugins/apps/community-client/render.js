import { jsxs as s, jsx as r } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { useCommandRuntime as J, Card as _, Typography as i, Result as Q, Button as k, theme as v, Flex as h, App as D, Input as Z, Alert as ee, Descriptions as M, ChipsProvider as ne, CommandProvider as te, Tag as re } from "chips-resource://platform/vendor/chips-ui.js";
import { useState as g, useRef as ae, useEffect as A, useCallback as L } from "chips-resource://platform/vendor/react.js";
class I extends Error {
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
    return new I({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function oe(n) {
  if (typeof n != "object" || n === null)
    return !1;
  const e = n;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const ie = "SDK_BRIDGE_UNAVAILABLE", B = "SDK_UNKNOWN_ERROR", U = "发生未知错误";
function se(n) {
  return n instanceof Error;
}
function le(n) {
  if (n instanceof I)
    return n;
  if (oe(n)) {
    const e = n, t = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new I(t);
  }
  return se(n) ? new I({
    code: B,
    message: U,
    details: { name: n.name, cause: n.message },
    retryable: !1
  }) : new I({
    code: B,
    message: U,
    details: { value: String(n) },
    retryable: !1
  });
}
function ce() {
  return new I({
    code: ie,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function p(n, e, t) {
  let o;
  try {
    o = n();
  } catch (a) {
    return Promise.reject(le(a));
  }
  return o.request(e, t);
}
const de = "cli.command.list", ue = "cli.command.get", pe = "cli.command.resolve";
function he(n) {
  return {
    list(e) {
      return p(n, de, e ?? {});
    },
    get(e) {
      return p(n, ue, e);
    },
    resolve(e) {
      return p(n, pe, e);
    }
  };
}
const E = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, ge = "cli.task.create", me = "cli.task.bindInvocation", fe = "cli.task.cancel";
function ye(n) {
  return {
    create(e) {
      return p(n, ge, e).then((t) => t.task);
    },
    bindInvocation(e) {
      return p(n, me, e).then((t) => t.task);
    },
    get(e) {
      const t = { taskId: e };
      return p(n, E.CLI_TASK_GET, t).then((o) => o.task);
    },
    active(e) {
      const t = { commandId: e };
      return p(n, E.CLI_TASK_ACTIVE, t).then((o) => o.task);
    },
    progress(e, t) {
      const o = { taskId: e, progress: t };
      return p(n, E.CLI_TASK_PROGRESS, o).then((a) => a.task);
    },
    complete(e, t) {
      const o = {
        taskId: e,
        ...t === void 0 ? {} : { output: t }
      };
      return p(n, E.CLI_TASK_COMPLETE, o).then((a) => a.task);
    },
    fail(e, t) {
      const o = { taskId: e, error: t };
      return p(n, E.CLI_TASK_FAIL, o).then((a) => a.task);
    },
    cancel(e) {
      return p(n, fe, { taskId: e }).then((t) => t.task);
    }
  };
}
function we() {
  return globalThis.window?.chips;
}
class Ce {
  #n;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = he(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = ye(() => this.#e());
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
    const e = we();
    if (e === void 0)
      throw ce();
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
    return p(() => this.#e(), e, t);
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
function Ie(n) {
  return new Ce(n?.bridge);
}
const W = Ie(), V = "chips.official.community-client", T = {
  openCard: "community-client:open-card",
  refreshView: "community-client:refresh-view"
}, P = {
  openCard: "open-card",
  refreshView: "refresh-view"
}, O = [
  {
    id: T.openCard,
    title: "打开卡片",
    description: "在「薯片社区」中登记指定卡片文件的本地查看请求",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: V },
    handlerId: P.openCard,
    keywords: ["open", "card", "打开", "卡片"],
    group: "文件"
  },
  {
    id: T.refreshView,
    title: "刷新当前视图",
    description: "重新读取会话运行时状态并刷新当前展示数据",
    shortcut: "F5",
    scope: { kind: "app", appId: V },
    handlerId: P.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  }
];
new Set(Object.values(T));
function ke(n) {
  if (typeof n != "object" || n === null)
    return null;
  const e = n.path;
  return typeof e == "string" && e.trim().length > 0 ? e.trim() : null;
}
function Te(n, e) {
  const t = /* @__PURE__ */ new Map();
  return t.set(P.openCard, (o) => {
    const a = ke(o);
    if (a === null) {
      e({ commandId: T.openCard, handlerId: "open-card", ok: !1 });
      return;
    }
    n.openCard(a), e({ commandId: T.openCard, handlerId: "open-card", ok: !0 });
  }), t.set(P.refreshView, () => {
    n.refreshView(), e({ commandId: T.refreshView, handlerId: "refresh-view", ok: !0 });
  }), O.map((o) => {
    const a = o.handlerId ?? "", l = t.get(a);
    return {
      commandId: o.id,
      handlerId: a,
      handler: (m) => {
        l?.(m);
      }
    };
  });
}
const Se = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function $(n) {
  if (typeof n == "object" && n !== null && "code" in n) {
    const e = n.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function _e() {
  const n = J(), [e, t] = g("registering"), [o, a] = g(null), [l, m] = g(null), f = ae(null);
  A(() => {
    let d = !1, S = null;
    return t("registering"), a(null), (async () => {
      try {
        for (const c of O)
          await W.request("command:register", { definition: c });
        if (d)
          return;
        S = n.attach(
          Te(
            {
              openCard: (c) => {
                f.current?.openCard(c);
              },
              refreshView: () => {
                f.current?.refreshView();
              }
            },
            (c) => {
              m(c);
            }
          )
        ), t("ready");
      } catch (c) {
        d || (a($(c)), t("error"));
      }
    })(), () => {
      d = !0, S?.dispose();
      for (const c of O)
        W.request("command:unregister", { commandId: c.id }).catch(() => {
        });
    };
  }, [n]);
  const w = L((d) => {
    f.current = d;
  }, []), y = L(async () => {
    try {
      await n.invoke({ commandId: T.refreshView, source: "api" }), a(null);
    } catch (d) {
      a($(d));
    }
  }, [n]);
  return { phase: e, errorCode: o, lastInvoked: l, setActions: w, invokeRefreshView: y };
}
const Ee = () => /* @__PURE__ */ s(_, { "data-role": "about-card", style: { width: "100%" }, children: [
  /* @__PURE__ */ r(i.Title, { level: 3, style: { marginTop: 0 }, children: "社区简介" }),
  /* @__PURE__ */ r(i.Paragraph, { children: "薯片社区是薯片生态的官方内容社区：围绕「卡片」与「箱子」两类作品组织内容。 卡片是可分享的结构化文档，箱子是卡片与箱子的有序集合。" }),
  /* @__PURE__ */ r(i.Paragraph, { children: "发布：在工作区选择本机 `.card` / `.box` 文件，经卡片传输链路上传为网络资源卡片； 下载：把社区卡片完整下载为离线卡片，路径、字段与资源与上传前完全一致，可继续编辑。" }),
  /* @__PURE__ */ r(i.Paragraph, { type: "secondary", style: { marginBottom: 0 }, children: "本地查看社区下载的卡片由本地卡片查看器应用承载；社区客户端负责把受管引用交给默认处理器路由， 不直接打开卡片内容。" })
] }), ve = ({ navigateHome: n }) => /* @__PURE__ */ r(
  Q,
  {
    "data-role": "not-found",
    status: "404",
    title: "404",
    subTitle: "页面不存在或路径有误",
    extra: /* @__PURE__ */ r(k, { type: "primary", "data-role": "not-found-home", onClick: n, children: "返回首页" })
  }
), be = {
  id: "network",
  title: "社区网络请求臂",
  domain: "http:request（宿主处理器未注册，G6 后续批）",
  pendingBecause: "本臂未接线网络请求：不私建 fetch、不伪造页面数据，浏览/认证/详情数据面整体候前置件。",
  unlockWave: "候 `http:*` 域宿主处理器注册（G6 后续批）与服务端 W6 迁移后开「网络数据臂」。"
}, Re = {
  id: "session",
  title: "社区会话臂",
  domain: "http:request + credential:manage（宿主处理器未注册）",
  pendingBecause: "accessToken 仅内存、refreshToken 经凭证能力存取（§5.1）；域处理器缺位期间会话如实呈现「未登录」，不伪造登录态。",
  unlockWave: "候 `http:*` 与 `credential:*` 域宿主处理器注册后开「会话臂」。"
}, Ae = {
  id: "config",
  title: "服务器地址持久化",
  domain: "config:*（宿主处理器未注册，工单066 在册）",
  pendingBecause: "服务器地址校验与生效在本窗口会话内存完成，生效层如实标记「会话内存（未持久化）」。",
  unlockWave: "候 `config:*` 域宿主处理器注册（工单066）后换接 `config:get/set` 与 `config:changed` 订阅，消费面零改动。"
}, Le = {
  id: "transfer",
  title: "卡片传输编排臂",
  domain: "transfer:*（16-卡片传输协议编排，宿主链路未落波）",
  pendingBecause: "客户端不实现传输协议（§2.3）；本臂已把卡片路径归一与 YAML/cover.html 资源改写还原逻辑纯函数化迁入领域层（传输引擎同源实现材料），传输编排入口候前置件。",
  unlockWave: "候 `transfer:*` 链路落波后开「上传/完整下载/本地查看臂」；打开入口按 14-契约路由本地卡片查看器。"
}, Pe = {
  id: "dialog-shell",
  title: "文件选择与浏览器入口臂",
  domain: "dialog:open / dialog:save / shell:openExternal（宿主处理器未注册）",
  pendingBecause: "上传选择、下载保存与「在浏览器中打开」（含 /admin 后台入口）不设不可用控件，候前置件。",
  unlockWave: "候对应域宿主处理器注册并随网络臂在 manifest 声明 `dialogs:use` 与 `shell:external` 后逐项启用。"
}, xe = {
  id: "server",
  title: "社区平台服务端联调",
  domain: "服务端（W6 未迁移）",
  pendingBecause: "社区平台服务端属 W6 迁移批次，联调面（端到端浏览/认证/传输验证）全部候服务端落波。",
  unlockWave: "候服务端 W6 迁移后随「网络数据臂」一并联调验收。"
}, b = [
  be,
  Re,
  Le,
  Ae,
  Pe,
  xe
];
function Ne(n) {
  return b.find((e) => e.id === n) ?? null;
}
const C = ({
  title: n,
  description: e,
  pendingIds: t
}) => {
  const { token: o } = v.useToken(), a = t.map((l) => Ne(l)).filter(
    (l) => l !== null
  );
  return /* @__PURE__ */ s(_, { "data-role": "pending-page", style: { width: "100%" }, children: [
    /* @__PURE__ */ r(i.Title, { level: 4, style: { marginTop: 0 }, "data-role": "pending-title", children: n }),
    /* @__PURE__ */ r(i.Paragraph, { type: "secondary", "data-role": "pending-description", children: e }),
    /* @__PURE__ */ r(i.Title, { level: 5, children: "候前置件" }),
    /* @__PURE__ */ s(h, { vertical: !0, gap: o.marginXS, children: [
      a.map((l) => /* @__PURE__ */ s(h, { vertical: !0, gap: 2, children: [
        /* @__PURE__ */ s(i.Text, { strong: !0, children: [
          l.title,
          "（缺失域：",
          l.domain,
          "）"
        ] }),
        /* @__PURE__ */ r(i.Text, { type: "secondary", children: l.unlockWave })
      ] }, l.id)),
      a.length === 0 ? /* @__PURE__ */ s(i.Text, { type: "secondary", children: [
        "本页能力在 ",
        b.length,
        " 项候前置件登记收口后逐项开放。"
      ] }) : null
    ] })
  ] });
}, Me = "https://www.chipscard.space", H = [
  "www.chipscard.space",
  "chipscard.space",
  "file.chipscard.space",
  "127.0.0.1:3000"
];
function Oe(n) {
  const e = n.trim();
  if (e.length === 0)
    return null;
  let t;
  try {
    t = new URL(e);
  } catch {
    return null;
  }
  return t.protocol !== "https:" && t.protocol !== "http:" ? null : t.toString().replace(/\/+$/, "");
}
function De(n) {
  let e;
  try {
    e = new URL(n);
  } catch {
    return null;
  }
  if (e.protocol !== "https:" && e.protocol !== "http:")
    return null;
  const t = e.protocol === "https:" ? "443" : "80";
  return e.port === "" || e.port === t ? e.hostname.toLowerCase() : `${e.hostname.toLowerCase()}:${e.port}`;
}
function Be(n, e = H) {
  const t = Oe(n);
  if (t === null)
    return { ok: !1, code: "COMMUNITY_CLIENT_SERVER_UNSUPPORTED" };
  const o = De(t);
  return o === null || !e.includes(o) ? { ok: !1, code: "COMMUNITY_CLIENT_SERVER_UNSUPPORTED" } : { ok: !0, url: t };
}
function K(n = H) {
  return `客户端仅支持以下社区服务器：${n.map((e) => `https://${e}`).join("、")}（本地联调可用 http://127.0.0.1:3000）`;
}
const Ue = ({ runtime: n, onNotify: e }) => {
  const { token: t } = v.useToken(), { message: o } = D.useApp(), [a, l] = g(n.getServerBase().url), [m, f] = g(n.getServerBase()), [w, y] = g(null), d = n.getSession(), S = () => {
    const c = n.saveServerBase(a);
    if (c.ok) {
      y(null), f(c.snapshot), l(c.snapshot.url), o.info("服务器地址已保存并生效（会话内存，未持久化）"), e(`社区服务器基址：${c.snapshot.url}`);
      return;
    }
    y(c.code);
  };
  return /* @__PURE__ */ s(h, { vertical: !0, gap: t.marginSM, style: { width: "100%" }, children: [
    /* @__PURE__ */ s(_, { "data-role": "server-card", children: [
      /* @__PURE__ */ r(i.Title, { level: 5, style: { marginTop: 0 }, children: "社区服务器" }),
      /* @__PURE__ */ s(h, { gap: t.marginXS, wrap: "wrap", children: [
        /* @__PURE__ */ r(
          Z,
          {
            "data-role": "server-input",
            value: a,
            onChange: (c) => l(c.target.value),
            style: { maxWidth: 420 },
            placeholder: K()
          }
        ),
        /* @__PURE__ */ r(k, { type: "primary", "data-role": "server-save", onClick: S, children: "保存" })
      ] }),
      w !== null ? /* @__PURE__ */ r(
        ee,
        {
          "data-role": "server-error",
          type: "error",
          showIcon: !0,
          style: { marginTop: t.marginSM },
          message: "该服务器地址不在客户端支持范围内，请使用列表中的服务器",
          description: K()
        }
      ) : null,
      /* @__PURE__ */ s(i.Text, { type: "secondary", "data-role": "server-effective", style: { display: "block", marginTop: t.marginSM }, children: [
        "当前生效：",
        m.url,
        "（生效层：会话内存，未持久化；候 `config:*` 域宿主处理器落波后写入配置）"
      ] })
    ] }),
    /* @__PURE__ */ s(_, { children: [
      /* @__PURE__ */ r(i.Title, { level: 5, style: { marginTop: 0 }, children: "当前账号" }),
      /* @__PURE__ */ s(M, { column: 1, size: "small", "data-role": "account-descriptions", children: [
        /* @__PURE__ */ r(M.Item, { label: "登录状态", children: d.loggedIn ? "已登录" : "未登录" }),
        d.loggedIn ? null : /* @__PURE__ */ r(M.Item, { label: "说明", children: d.reason })
      ] })
    ] }),
    /* @__PURE__ */ s(_, { "data-role": "pending-card", children: [
      /* @__PURE__ */ s(i.Title, { level: 5, style: { marginTop: 0 }, children: [
        "候前置件登记（",
        b.length,
        " 项）"
      ] }),
      /* @__PURE__ */ r(i.Paragraph, { type: "secondary", children: "以下能力按 W5 派单裁决候宿主域处理器与服务端波次收口；登记期间不铺替代数据、不设不可用控件。" }),
      /* @__PURE__ */ r(We, {})
    ] })
  ] });
};
function We() {
  const { token: n } = v.useToken();
  return /* @__PURE__ */ r(h, { vertical: !0, gap: n.marginXS, children: b.map((e) => /* @__PURE__ */ s(
    h,
    {
      "data-role": `pending-${e.id}`,
      vertical: !0,
      gap: 2,
      style: {
        padding: n.paddingSM,
        border: `1px solid ${n.colorBorderSecondary}`,
        borderRadius: n.borderRadiusLG
      },
      children: [
        /* @__PURE__ */ r(i.Text, { strong: !0, children: e.title }),
        /* @__PURE__ */ s(i.Text, { type: "secondary", children: [
          "缺失域：",
          e.domain
        ] }),
        /* @__PURE__ */ r(i.Text, { type: "secondary", children: e.pendingBecause }),
        /* @__PURE__ */ s(i.Text, { type: "secondary", children: [
          "落波去向：",
          e.unlockWave
        ] })
      ]
    },
    e.id
  )) });
}
const Ve = ({ session: n, navigateRegister: e, navigateProfile: t }) => {
  const { token: o } = v.useToken();
  return /* @__PURE__ */ s(_, { "data-role": "welcome-card", style: { width: "100%" }, children: [
    /* @__PURE__ */ r(i.Title, { level: 3, style: { marginTop: 0 }, children: "薯片社区" }),
    /* @__PURE__ */ r(i.Paragraph, { type: "secondary", style: { marginBottom: o.marginSM }, children: "在这里发布你的卡片与箱子作品：浏览社区内容、登录社区账号、把本地卡片上传为网络资源卡片， 或把社区卡片完整下载回本地继续编辑。" }),
    n.loggedIn ? /* @__PURE__ */ r(k, { type: "primary", "data-role": "welcome-primary", onClick: t, children: "进入个人主页" }) : /* @__PURE__ */ r(k, { type: "primary", "data-role": "welcome-primary", onClick: e, children: "去注册" }),
    /* @__PURE__ */ r(i.Title, { level: 5, style: { marginTop: o.marginLG }, children: "当前开放能力" }),
    /* @__PURE__ */ s(i.Paragraph, { type: "secondary", style: { marginBottom: 0 }, "data-role": "welcome-scope", children: [
      "本窗口当前开放：路由浏览、社区简介、服务器地址设置（会话内存生效）；",
      b.length,
      " 项能力处于候前置件登记中，详见「设置」页的登记表。"
    ] })
  ] });
};
function $e() {
  let n = { url: Me, layer: "session-memory" };
  return {
    getServerBase() {
      return n;
    },
    saveServerBase(e) {
      const t = Be(e);
      return t.ok ? (n = { url: t.url, layer: "session-memory" }, { ok: !0, snapshot: n }) : { ok: !1, code: t.code };
    },
    getSession() {
      return {
        loggedIn: !1,
        reason: "登录与会话恢复候前置件：credential:manage 与 http:request 宿主处理器落波后开放"
      };
    }
  };
}
const Ke = $e();
function Fe() {
  return Ke;
}
function F(n) {
  return n.length > 0 && !/[\s/?#]/.test(n) && j(n) !== null;
}
function j(n) {
  try {
    return decodeURIComponent(n);
  } catch {
    return null;
  }
}
function q(n) {
  const t = (n.startsWith("#") ? n.slice(1) : n).split("?")[0] ?? "";
  if (t === "" || t === "/")
    return { name: "welcome" };
  const o = t.replace(/\/+$/, "").split("/").slice(1);
  switch (o[0]) {
    case "about":
      return { name: "about" };
    case "login":
      return { name: "login" };
    case "register":
      return { name: "register" };
    case "workspace":
      return { name: "workspace" };
    case "admin":
      return { name: "admin" };
    case "settings":
      return { name: "settings" };
    case "cards": {
      const a = o[1];
      if (a !== void 0 && F(a))
        return { name: "cardDetail", cardId: a };
      break;
    }
    case "boxes": {
      const a = o[1];
      if (a !== void 0 && F(a))
        return { name: "boxDetail", boxId: a };
      break;
    }
  }
  if (o[0]?.startsWith("@")) {
    const a = j(o[0].slice(1));
    if (a !== null && a.length > 0)
      return { name: "profile", username: a };
  }
  return { name: "notFound", path: t };
}
function Ge(n) {
  switch (n.name) {
    case "welcome":
      return "#/";
    case "about":
      return "#/about";
    case "login":
      return "#/login";
    case "register":
      return "#/register";
    case "profile":
      return `#/@${encodeURIComponent(n.username)}`;
    case "workspace":
      return "#/workspace";
    case "cardDetail":
      return `#/cards/${encodeURIComponent(n.cardId)}`;
    case "boxDetail":
      return `#/boxes/${encodeURIComponent(n.boxId)}`;
    case "admin":
      return "#/admin";
    case "settings":
      return "#/settings";
    case "notFound":
      return `#${n.path.startsWith("/") ? n.path : `/${n.path}`}`;
  }
}
function He(n, e) {
  return n.name === "workspace" && !e.loggedIn ? { name: "login" } : (n.name === "login" || n.name === "register") && e.loggedIn && e.username !== null ? { name: "profile", username: e.username } : n;
}
function G() {
  return q(window.location.hash);
}
function je(n) {
  const [e, t] = g(() => G());
  A(() => {
    const a = () => {
      t(G());
    };
    return window.addEventListener("hashchange", a), () => {
      window.removeEventListener("hashchange", a);
    };
  }, []);
  const o = L((a) => {
    const l = Ge(a);
    if (window.location.hash === l) {
      t(q(l));
      return;
    }
    window.location.hash = l;
  }, []);
  return { route: He(e, n), navigate: o };
}
const qe = "chips.official.community-client", Xe = [
  { key: "welcome", label: "首页", route: { name: "welcome" } },
  { key: "workspace", label: "工作区", route: { name: "workspace" } },
  { key: "about", label: "社区简介", route: { name: "about" } },
  { key: "settings", label: "设置", route: { name: "settings" } }
], Ye = ({ runtime: n }) => {
  const { token: e } = v.useToken(), { message: t } = D.useApp(), o = n.getSession(), { route: a, navigate: l } = je({
    loggedIn: o.loggedIn,
    username: o.loggedIn ? o.username : null
  }), { phase: m, errorCode: f, lastInvoked: w, setActions: y, invokeRefreshView: d } = _e(), [S, c] = g(0), [x, X] = g(null), [R, N] = g(null);
  A(() => (y({
    openCard: (u) => {
      X({ path: u }), N(`已登记本地查看请求：${u}（候卡片传输链路落波后开放本地查看）`);
    },
    refreshView: () => {
      c((u) => u + 1), N("当前视图已刷新");
    }
  }), () => {
    y(null);
  }), [y]), A(() => {
    if (R === null)
      return;
    const u = window.setTimeout(() => {
      N(null);
    }, 3200);
    return () => {
      window.clearTimeout(u);
    };
  }, [R]);
  const Y = L(
    (u) => {
      t.info(u);
    },
    [t]
  ), z = () => {
    switch (a.name) {
      case "welcome":
        return /* @__PURE__ */ r(
          Ve,
          {
            session: o,
            navigateRegister: () => l({ name: "register" }),
            navigateProfile: () => {
              o.loggedIn && l({ name: "profile", username: o.username });
            }
          }
        );
      case "about":
        return /* @__PURE__ */ r(Ee, {});
      case "login":
        return /* @__PURE__ */ r(
          C,
          {
            title: "登录",
            description: "使用社区账号登录后可浏览私密内容、上传作品与完整下载。",
            pendingIds: ["network", "session"]
          }
        );
      case "register":
        return /* @__PURE__ */ r(
          C,
          {
            title: "注册",
            description: "注册社区账号后即可在社区发布卡片与箱子作品。",
            pendingIds: ["network", "session"]
          }
        );
      case "workspace":
        return /* @__PURE__ */ r(
          C,
          {
            title: "工作区",
            description: "展示当前用户的卡片与箱子列表，并提供「上传卡片 / 上传箱子」入口。",
            pendingIds: ["network", "session", "transfer", "dialog-shell"]
          }
        );
      case "profile":
        return /* @__PURE__ */ r(
          C,
          {
            title: `个人主页（@${a.username}）`,
            description: "展示用户资料与作品列表（卡片与箱子，按创建时间倒序、分页）。",
            pendingIds: ["network"]
          }
        );
      case "cardDetail":
        return /* @__PURE__ */ r(
          C,
          {
            title: "卡片详情",
            description: `展示卡片 ${a.cardId} 的公开信息，并提供本地查看与完整下载入口。`,
            pendingIds: ["network", "transfer", "dialog-shell"]
          }
        );
      case "boxDetail":
        return /* @__PURE__ */ r(
          C,
          {
            title: "箱子详情",
            description: `展示箱子 ${a.boxId} 的信息与条目快照列表（不展开条目内容）。`,
            pendingIds: ["network"]
          }
        );
      case "admin":
        return /* @__PURE__ */ r(
          C,
          {
            title: "管理员入口",
            description: "经系统浏览器打开社区管理后台，鉴权在浏览器内完成。",
            pendingIds: ["dialog-shell", "server"]
          }
        );
      case "settings":
        return /* @__PURE__ */ r(Ue, { runtime: n, onNotify: Y }, S);
      case "notFound":
        return /* @__PURE__ */ r(ve, { navigateHome: () => l({ name: "welcome" }) });
    }
  };
  return /* @__PURE__ */ s(h, { vertical: !0, style: { height: "100%", background: e.colorBgLayout }, children: [
    /* @__PURE__ */ s(
      "header",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: e.marginSM,
          flexWrap: "wrap",
          paddingInline: e.padding,
          paddingBlock: e.paddingSM,
          background: e.colorBgContainer,
          borderBottom: `1px solid ${e.colorBorderSecondary}`
        },
        children: [
          /* @__PURE__ */ r(i.Text, { strong: !0, style: { fontSize: e.fontSizeLG }, "data-role": "site-name", children: "薯片社区" }),
          /* @__PURE__ */ r(h, { gap: e.marginXS, wrap: "wrap", children: Xe.map((u) => /* @__PURE__ */ r(k, { type: "text", onClick: () => l(u.route), "data-role": `nav-${u.key}`, children: u.label }, u.key)) }),
          /* @__PURE__ */ r(h, { style: { marginInlineStart: "auto" }, gap: e.marginXS, align: "center", children: o.loggedIn ? null : /* @__PURE__ */ r(k, { type: "link", "data-role": "nav-login", onClick: () => l({ name: "login" }), children: "登录 / 注册" }) })
        ]
      }
    ),
    x !== null ? /* @__PURE__ */ r("div", { style: { paddingInline: e.padding, paddingTop: e.paddingSM }, children: /* @__PURE__ */ s(re, { "data-role": "local-view-request", color: "warning", children: [
      "本地查看请求待开放：",
      x.path,
      "（候卡片传输链路落波）"
    ] }) }) : null,
    /* @__PURE__ */ r("main", { style: { flex: 1, minWidth: 0, overflow: "auto", padding: e.padding }, children: /* @__PURE__ */ s(h, { vertical: !0, gap: e.marginSM, align: "center", children: [
      /* @__PURE__ */ r("div", { style: { width: "100%", maxWidth: 880 }, "data-role": "route-content", children: z() }),
      R !== null ? /* @__PURE__ */ r(i.Text, { type: "secondary", "data-role": "app-feedback", style: { width: "100%", maxWidth: 880 }, children: R }) : null,
      w !== null && !w.ok ? /* @__PURE__ */ s(i.Text, { type: "warning", "data-role": "command-invalid", style: { width: "100%", maxWidth: 880 }, children: [
        "命令 ",
        w.commandId,
        " 的载荷不合法，已拒绝执行"
      ] }) : null
    ] }) }),
    /* @__PURE__ */ s(
      "footer",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: e.marginSM,
          flexWrap: "wrap",
          paddingInline: e.padding,
          paddingBlock: e.paddingSM,
          background: e.colorBgContainer,
          borderTop: `1px solid ${e.colorBorderSecondary}`
        },
        children: [
          /* @__PURE__ */ r(i.Text, { type: "secondary", "data-role": "footer-note", children: "薯片社区 · 卡片与箱子作品的官方社区" }),
          /* @__PURE__ */ s(h, { gap: e.marginXS, align: "center", children: [
            /* @__PURE__ */ r(k, { onClick: () => {
              d();
            }, "data-role": "footer-refresh", children: "刷新当前视图" }),
            /* @__PURE__ */ s(i.Text, { type: "secondary", "data-role": "command-phase", children: [
              "命令注册状态：",
              Se[m],
              m === "error" && f !== null ? `（${f}）` : ""
            ] })
          ] })
        ]
      }
    )
  ] });
}, Ze = () => /* @__PURE__ */ r(ne, { appId: qe, surface: "window", children: /* @__PURE__ */ r(te, { children: /* @__PURE__ */ r(D, { children: /* @__PURE__ */ r(Ye, { runtime: Fe() }) }) }) });
export {
  Ze as AppView,
  Ze as default
};
