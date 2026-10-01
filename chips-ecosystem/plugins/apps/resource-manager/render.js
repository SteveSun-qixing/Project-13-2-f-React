import { jsxs as l, jsx as o, Fragment as oe } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { useState as w, useRef as K, useEffect as L, useCallback as S, useMemo as M } from "chips-resource://platform/vendor/react.js";
import { useCommandRuntime as se, theme as G, Typography as u, Flex as b, HomeOutlined as ie, Tag as v, FolderOpenOutlined as ae, Empty as P, List as R, Input as ce, Button as de, Alert as Y, Badge as X, ChipsProvider as le, CommandProvider as ue, App as J } from "chips-resource://platform/vendor/chips-ui.js";
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
function me(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const pe = "SDK_BRIDGE_UNAVAILABLE", j = "SDK_UNKNOWN_ERROR", $ = "发生未知错误";
function he(t) {
  return t instanceof Error;
}
function fe(t) {
  if (t instanceof T)
    return t;
  if (me(t)) {
    const e = t, n = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new T(n);
  }
  return he(t) ? new T({
    code: j,
    message: $,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new T({
    code: j,
    message: $,
    details: { value: String(t) },
    retryable: !1
  });
}
function ge() {
  return new T({
    code: pe,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function C(t, e, n) {
  let s;
  try {
    s = t();
  } catch (r) {
    return Promise.reject(fe(r));
  }
  return s.request(e, n);
}
const ye = "cli.command.list", Ie = "cli.command.get", Ce = "cli.command.resolve";
function we(t) {
  return {
    list(e) {
      return C(t, ye, e ?? {});
    },
    get(e) {
      return C(t, Ie, e);
    },
    resolve(e) {
      return C(t, Ce, e);
    }
  };
}
const D = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, _e = "cli.task.create", Ee = "cli.task.bindInvocation", Se = "cli.task.cancel";
function Te(t) {
  return {
    create(e) {
      return C(t, _e, e).then((n) => n.task);
    },
    bindInvocation(e) {
      return C(t, Ee, e).then((n) => n.task);
    },
    get(e) {
      const n = { taskId: e };
      return C(t, D.CLI_TASK_GET, n).then((s) => s.task);
    },
    active(e) {
      const n = { commandId: e };
      return C(t, D.CLI_TASK_ACTIVE, n).then((s) => s.task);
    },
    progress(e, n) {
      const s = { taskId: e, progress: n };
      return C(t, D.CLI_TASK_PROGRESS, s).then((r) => r.task);
    },
    complete(e, n) {
      const s = {
        taskId: e,
        ...n === void 0 ? {} : { output: n }
      };
      return C(t, D.CLI_TASK_COMPLETE, s).then((r) => r.task);
    },
    fail(e, n) {
      const s = { taskId: e, error: n };
      return C(t, D.CLI_TASK_FAIL, s).then((r) => r.task);
    },
    cancel(e) {
      return C(t, Se, { taskId: e }).then((n) => n.task);
    }
  };
}
function be() {
  return globalThis.window?.chips;
}
class ke {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = we(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = Te(() => this.#e());
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
    const e = be();
    if (e === void 0)
      throw ge();
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
    return C(() => this.#e(), e, n);
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
function Ae(t) {
  return new ke(t?.bridge);
}
const U = Ae();
class _ extends Error {
  code;
  constructor(e, n) {
    super(n), this.name = "BrowseGatewayError", this.code = e;
  }
}
function Q(t) {
  if (t instanceof _)
    return t;
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return new _(e, t instanceof Error ? t.message : "未知错误");
  }
  return new _("BROWSE_GATEWAY_ERROR", t instanceof Error ? t.message : "未知错误");
}
async function N(t, e, n) {
  try {
    return await U.request("document:read", { documentId: t, part: e, ...n });
  } catch (s) {
    throw Q(s);
  }
}
function B(t, e) {
  if (t.part !== e)
    throw new _("DOCUMENT_PART_MISMATCH", "文档读取回包切片与请求不一致");
}
function xe() {
  return {
    async open(t) {
      let e;
      try {
        e = await U.request("document:open", { source: t });
      } catch (n) {
        throw Q(n);
      }
      return {
        documentId: e.documentId,
        source: e.source,
        kind: e.kind,
        title: e.title,
        digest: e.digest
      };
    },
    async readCardDetail(t) {
      const [e, n] = await Promise.all([
        N(t, "metadata", {}),
        N(t, "structure", {})
      ]);
      B(e, "metadata"), B(n, "structure");
      const s = e.value;
      if (typeof s.card_id != "string" || s.card_id.length === 0)
        throw new _("DOCUMENT_METADATA_INVALID", "卡片元数据缺少 card_id");
      const r = n.value;
      if (!Array.isArray(r.structure))
        throw new _("DOCUMENT_STRUCTURE_INVALID", "结构切片缺少 structure 数组");
      return { kind: "card", metadata: s, structure: r };
    },
    async readBoxDetail(t, e) {
      const [n, s] = await Promise.all([
        N(t, "metadata", {}),
        N(
          t,
          "entries",
          e === void 0 ? {} : { range: { offset: e.offset, limit: e.limit } }
        )
      ]);
      B(n, "metadata"), B(s, "entries");
      const r = n.value;
      if (typeof r.box_id != "string" || r.box_id.length === 0)
        throw new _("DOCUMENT_METADATA_INVALID", "箱子元数据缺少 box_id");
      const a = s.value;
      if (!Array.isArray(a))
        throw new _("DOCUMENT_ENTRIES_INVALID", "条目切片必须是数组");
      return { kind: "box", metadata: r, entries: a };
    }
  };
}
function Re() {
  return xe();
}
const F = "chips.official.resource-manager", k = {
  openCard: "resource-manager:open-card",
  refreshView: "resource-manager:refresh-view"
}, q = {
  openCard: "open-card",
  refreshView: "refresh-view"
}, W = [
  {
    id: k.openCard,
    title: "打开文档浏览",
    description: "按来源引用打开指定卡片或箱子并进入只读浏览",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: F },
    handlerId: q.openCard,
    keywords: ["open", "card", "box", "打开", "浏览", "资源"],
    group: "文件"
  },
  {
    id: k.refreshView,
    title: "刷新当前视图",
    description: "重新读取当前浏览文档的元数据与条目",
    shortcut: "F5",
    scope: { kind: "app", appId: F },
    handlerId: q.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  }
];
new Set(Object.values(k));
function Oe(t, e) {
  const n = {
    "open-card": (s) => {
      const r = De(s);
      if (r === null) {
        e({ commandId: k.openCard, handlerId: "open-card", ok: !1 });
        return;
      }
      t.openCard(r), e({ commandId: k.openCard, handlerId: "open-card", ok: !0 });
    },
    "refresh-view": () => {
      t.refreshView(), e({ commandId: k.refreshView, handlerId: "refresh-view", ok: !0 });
    }
  };
  return W.map((s) => {
    const r = s.handlerId ?? "";
    return {
      commandId: s.id,
      handlerId: r,
      handler: (a) => {
        n[r](a);
      }
    };
  });
}
function De(t) {
  if (typeof t != "object" || t === null)
    return null;
  const e = t.path;
  return typeof e != "string" || e.trim().length === 0 ? null : e.trim();
}
function z(t) {
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function Le() {
  const t = se(), [e, n] = w("registering"), [s, r] = w(null), [a, c] = w(null), g = K(null);
  L(() => {
    let f = !1, I = null;
    return n("registering"), r(null), (async () => {
      try {
        for (const i of W)
          await U.request("command:register", { definition: i });
        if (f)
          return;
        I = t.attach(
          Oe(
            {
              openCard: (i) => {
                g.current?.openCard(i);
              },
              refreshView: () => {
                g.current?.refreshView();
              }
            },
            (i) => {
              c(i);
            }
          )
        ), n("ready");
      } catch (i) {
        f || (r(z(i)), n("error"));
      }
    })(), () => {
      f = !0, I?.dispose();
      for (const i of W)
        U.request("command:unregister", { commandId: i.id }).catch(() => {
        });
    };
  }, [t]);
  const m = S((f) => {
    g.current = f;
  }, []), d = S(() => {
    t.invoke({ commandId: k.refreshView, source: "api" }).catch((I) => {
      r(z(I));
    });
  }, [t]);
  return { phase: e, errorCode: s, lastInvoked: a, setActions: m, invokeRefresh: d };
}
const H = { items: [] };
function Ne(t) {
  return t.map((n) => ({
    entryId: n.entry_id,
    url: n.url,
    name: Be(n),
    enabled: n.enabled
  })).sort((n, s) => n.enabled !== s.enabled ? n.enabled ? -1 : 1 : n.name.localeCompare(s.name, "zh-Hans-CN"));
}
function Be(t) {
  const e = t.url.split("/").filter((s) => s.length > 0);
  return e[e.length - 1] ?? t.url;
}
function Me(t) {
  return Array.isArray(t) ? t.join("：") : t;
}
function ve(t) {
  return (t ?? []).map(Me);
}
function Pe(t) {
  return {
    cardCount: t.manifest.card_count,
    resourceCount: t.manifest.resource_count
  };
}
function Ue(t, e) {
  return {
    items: [...t.items.filter((n) => n.documentId !== e.documentId), e]
  };
}
function V(t, e) {
  return t.items.find((n) => n.documentId === e) ?? null;
}
function Ge(t) {
  const e = t.trim();
  return e.length > 0 ? e : null;
}
function Ve(t) {
  const [e, n] = w(H), [s, r] = w("idle"), [a, c] = w(null), [g, m] = w(null), [d, f] = w(null), [I, i] = w(null), A = K(null), O = K(H);
  O.current = e, A.current = d;
  const p = S((h) => h instanceof _ ? h.code : "BROWSE_GATEWAY_ERROR", []), x = S(
    async (h) => {
      if (h.kind === "box") {
        i(await t.readBoxDetail(h.documentId));
        return;
      }
      i(await t.readCardDetail(h.documentId));
    },
    [t]
  ), Z = S(
    async (h) => {
      const E = Ge(h);
      if (E === null) {
        m("请输入非空的文档来源引用");
        return;
      }
      r("opening"), c(null);
      try {
        const y = await t.open(E);
        n((re) => Ue(re, y)), f(y.documentId), r("ready"), await x(y), m(`已打开「${y.title}」`);
      } catch (y) {
        r("error"), c(p(y)), m(`文档打开失败（${p(y)}）：请核对来源引用与文档可用性`);
      }
    },
    [x, p, t]
  ), ee = S(
    async (h) => {
      const E = V(O.current, h);
      if (E !== null) {
        f(h), c(null);
        try {
          await x(E);
        } catch (y) {
          c(p(y)), m(`文档读取失败（${p(y)}）`);
        }
      }
    },
    [x, p]
  ), te = S(async () => {
    const h = A.current;
    if (h === null) {
      m("当前没有浏览中的文档");
      return;
    }
    const E = V(O.current, h);
    if (E !== null) {
      c(null);
      try {
        await x(E), m("当前视图已刷新");
      } catch (y) {
        c(p(y)), m(`文档刷新失败（${p(y)}）`);
      }
    }
  }, [x, p]);
  L(() => {
    if (g === null || s === "error")
      return;
    const h = window.setTimeout(() => {
      m(null);
    }, 2400);
    return () => {
      window.clearTimeout(h);
    };
  }, [g, s]);
  const ne = M(
    () => d === null ? null : V(e, d),
    [e, d]
  );
  return {
    records: e,
    status: s,
    errorCode: a,
    feedback: g,
    selectedId: d,
    selected: ne,
    detail: I,
    openSource: Z,
    select: ee,
    refreshCurrent: te
  };
}
const Ke = ({ records: t, selectedId: e, phase: n, onSelect: s }) => {
  const { token: r } = G.useToken();
  return /* @__PURE__ */ l(
    "aside",
    {
      style: {
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: r.marginSM,
        padding: r.padding,
        background: r.colorBgContainer,
        borderInlineEnd: `1px solid ${r.colorBorderSecondary}`,
        overflow: "auto"
      },
      children: [
        /* @__PURE__ */ l("section", { children: [
          /* @__PURE__ */ o(u.Text, { strong: !0, style: { display: "block", marginBottom: r.marginXS }, children: "快速访问" }),
          /* @__PURE__ */ l(b, { vertical: !0, gap: r.marginXS, children: [
            /* @__PURE__ */ l(b, { align: "center", gap: r.marginXS, children: [
              /* @__PURE__ */ o(ie, { style: { color: r.colorTextSecondary } }),
              /* @__PURE__ */ o(u.Text, { type: "secondary", children: "工作区根" }),
              /* @__PURE__ */ o(v, { children: "未就绪" })
            ] }),
            /* @__PURE__ */ o(u.Text, { type: "secondary", style: { fontSize: r.fontSizeSM }, children: "目录扫描通道（filesystem:read:${workspace} 域）候工单036 后续段落位" })
          ] })
        ] }),
        /* @__PURE__ */ l("section", { style: { flex: 1, minHeight: 0, overflow: "auto" }, children: [
          /* @__PURE__ */ l(u.Text, { strong: !0, style: { display: "block", marginBottom: r.marginXS }, children: [
            /* @__PURE__ */ o(ae, {}),
            " 已打开位置"
          ] }),
          t.length === 0 ? /* @__PURE__ */ o(P, { description: "尚未打开文档", image: P.PRESENTED_IMAGE_SIMPLE }) : /* @__PURE__ */ o(
            R,
            {
              size: "small",
              dataSource: [...t],
              renderItem: (a) => /* @__PURE__ */ l(
                R.Item,
                {
                  onClick: () => s(a.documentId),
                  style: {
                    cursor: "pointer",
                    paddingInline: r.paddingXS,
                    borderRadius: r.borderRadiusLG,
                    background: a.documentId === e ? r.colorPrimaryBg : void 0
                  },
                  children: [
                    /* @__PURE__ */ o(u.Text, { ellipsis: !0, style: { maxWidth: "100%" }, children: a.title }),
                    /* @__PURE__ */ o(v, { children: a.kind === "box" ? "箱子" : "卡片" })
                  ]
                }
              )
            }
          )
        ] }),
        /* @__PURE__ */ l(u.Text, { type: "secondary", children: [
          "命令注册状态：",
          n === "ready" ? "命令已就绪" : n === "registering" ? "命令注册中" : "命令通道异常"
        ] })
      ]
    }
  );
}, We = ({
  busy: t,
  feedback: e,
  statusFailed: n,
  onOpen: s,
  onRefresh: r,
  summary: a,
  detail: c,
  selectedEntryId: g,
  onSelectEntry: m
}) => {
  const { token: d } = G.useToken(), f = M(() => c !== null && c.kind === "box" ? Ne(c.entries) : [], [c]), I = M(() => c !== null && c.kind === "card" ? Pe(c.structure) : null, [c]);
  return /* @__PURE__ */ l("main", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: d.marginSM, padding: d.padding, background: d.colorBgContainer, overflow: "auto" }, children: [
    /* @__PURE__ */ l(b, { gap: d.marginSM, align: "center", children: [
      /* @__PURE__ */ o(
        ce.Search,
        {
          placeholder: "粘贴卡片或箱子来源引用（如工作区路径或 chips-resource:// 引用）",
          enterButton: t ? "打开中…" : "打开",
          disabled: t,
          onSearch: (i) => s(i),
          style: { maxWidth: 480 },
          "aria-label": "文档来源引用输入"
        }
      ),
      /* @__PURE__ */ o(de, { onClick: r, children: "刷新" })
    ] }),
    e !== null && n ? /* @__PURE__ */ o(Y, { type: "error", showIcon: !0, message: e }) : null,
    a === null || c === null ? /* @__PURE__ */ o(P, { description: "按来源引用打开卡片或箱子后在此呈现条目", style: { marginTop: d.marginXL } }) : /* @__PURE__ */ l(oe, { children: [
      /* @__PURE__ */ l(b, { align: "center", gap: d.marginSM, wrap: "wrap", children: [
        /* @__PURE__ */ o(u.Title, { level: 5, style: { margin: 0 }, children: c.metadata.name }),
        /* @__PURE__ */ o(X, { status: "default", text: c.kind === "box" ? "箱子文档" : "卡片文档" }),
        /* @__PURE__ */ o(u.Text, { type: "secondary", code: !0, children: a.documentId })
      ] }),
      c.kind === "box" ? f.length === 0 ? /* @__PURE__ */ o(P, { description: "箱子暂无条目" }) : /* @__PURE__ */ o(
        R,
        {
          size: "small",
          dataSource: [...f],
          renderItem: (i) => /* @__PURE__ */ l(
            R.Item,
            {
              onClick: () => m(i.entryId),
              style: {
                cursor: "pointer",
                paddingInline: d.paddingXS,
                borderRadius: d.borderRadiusLG,
                background: i.entryId === g ? d.colorPrimaryBg : void 0
              },
              children: [
                /* @__PURE__ */ o(u.Text, { ellipsis: !0, style: { maxWidth: "45%" }, children: i.name }),
                /* @__PURE__ */ o(u.Text, { type: "secondary", ellipsis: !0, style: { maxWidth: "35%" }, code: !0, children: i.url }),
                /* @__PURE__ */ o(X, { status: i.enabled ? "success" : "default", text: i.enabled ? "启用" : "停用" })
              ]
            }
          )
        }
      ) : /* @__PURE__ */ l(b, { vertical: !0, gap: d.marginXS, children: [
        /* @__PURE__ */ l(u.Text, { children: [
          "结构成员：",
          I?.cardCount ?? 0,
          " 个内容节点 · ",
          I?.resourceCount ?? 0,
          " 项资源"
        ] }),
        /* @__PURE__ */ o(
          R,
          {
            size: "small",
            dataSource: [...c.structure.structure],
            renderItem: (i) => /* @__PURE__ */ l(R.Item, { children: [
              /* @__PURE__ */ o(u.Text, { code: !0, children: i.id }),
              /* @__PURE__ */ o(v, { children: i.type })
            ] })
          }
        )
      ] })
    ] })
  ] });
}, Xe = ({ detail: t, selectedEntryId: e }) => {
  const { token: n } = G.useToken();
  if (t === null)
    return /* @__PURE__ */ o("aside", { style: { width: 240, flexShrink: 0, padding: n.padding, background: n.colorBgContainer, borderInlineStart: `1px solid ${n.colorBorderSecondary}`, overflow: "auto" }, children: /* @__PURE__ */ o(u.Text, { type: "secondary", children: "选中条目后在此呈现属性" }) });
  const s = ve(t.metadata.tags), r = t.kind === "box" && e !== null ? t.entries.find((a) => a.entry_id === e) ?? null : null;
  return /* @__PURE__ */ l("aside", { style: { width: 240, flexShrink: 0, padding: n.padding, background: n.colorBgContainer, borderInlineStart: `1px solid ${n.colorBorderSecondary}`, overflow: "auto" }, children: [
    /* @__PURE__ */ o(u.Text, { strong: !0, style: { display: "block", marginBottom: n.marginXS }, children: "详情" }),
    /* @__PURE__ */ l("dl", { style: { margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: n.marginXS, columnGap: n.margin }, children: [
      /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(u.Text, { type: "secondary", children: "名称" }) }),
      /* @__PURE__ */ o("dd", { style: { margin: 0 }, children: t.metadata.name }),
      /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(u.Text, { type: "secondary", children: "修改时间" }) }),
      /* @__PURE__ */ o("dd", { style: { margin: 0 }, children: t.metadata.modified_at })
    ] }),
    s.length > 0 ? /* @__PURE__ */ o("div", { style: { display: "flex", gap: n.marginXS, flexWrap: "wrap", marginTop: n.marginSM }, children: s.map((a) => /* @__PURE__ */ o(v, { children: a }, a)) }) : null,
    r !== null ? /* @__PURE__ */ l("dl", { style: { margin: 0, marginTop: n.margin, display: "grid", gridTemplateColumns: "auto 1fr", gap: n.marginXS, columnGap: n.margin }, children: [
      /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(u.Text, { type: "secondary", children: "条目" }) }),
      /* @__PURE__ */ o("dd", { style: { margin: 0 }, children: r.entry_id }),
      /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(u.Text, { type: "secondary", children: "引用" }) }),
      /* @__PURE__ */ o("dd", { style: { margin: 0, wordBreak: "break-all" }, children: r.url })
    ] }) : null,
    /* @__PURE__ */ o(u.Text, { type: "secondary", style: { display: "block", marginTop: n.margin }, children: "只读浏览臂：批量组织（重命名/移动/删除/批量标签）候 resource:write 注册（工单036 后续段）。" })
  ] });
}, je = "chips.official.resource-manager", $e = () => {
  const { message: t } = J.useApp(), { token: e } = G.useToken(), n = Ve(Re()), { phase: s, errorCode: r, setActions: a, invokeRefresh: c } = Le(), { feedback: g, status: m, openSource: d, refreshCurrent: f } = n, [I, i] = w(null), A = M(
    () => ({
      openCard: (p) => {
        d(p);
      },
      refreshView: () => {
        f();
      }
    }),
    [d, f]
  );
  L(() => (a(A), () => {
    a(null);
  }), [A, a]), L(() => {
    g !== null && m !== "error" && t.info(g);
  }, [g, m, t]), L(() => {
    i(null);
  }, [n.selectedId]);
  const O = S((p) => {
    i(p);
  }, []);
  return /* @__PURE__ */ l(b, { vertical: !0, style: { height: "100%", background: e.colorBgLayout }, children: [
    /* @__PURE__ */ l(b, { style: { flex: 1, minHeight: 0 }, children: [
      /* @__PURE__ */ o(
        Ke,
        {
          records: n.records.items,
          selectedId: n.selectedId,
          phase: s,
          onSelect: (p) => {
            n.select(p);
          }
        }
      ),
      /* @__PURE__ */ o(
        We,
        {
          busy: m === "opening",
          feedback: g,
          statusFailed: m === "error",
          onOpen: (p) => {
            n.openSource(p);
          },
          onRefresh: c,
          summary: n.selected,
          detail: n.detail,
          selectedEntryId: I,
          onSelectEntry: O
        }
      ),
      /* @__PURE__ */ o(Xe, { detail: n.detail, selectedEntryId: I })
    ] }),
    s === "error" && r !== null ? /* @__PURE__ */ o(Y, { type: "warning", showIcon: !0, message: `命令通道异常（${r}）`, banner: !0 }) : null
  ] });
}, He = () => /* @__PURE__ */ o(le, { appId: je, surface: "window", children: /* @__PURE__ */ o(ue, { children: /* @__PURE__ */ o(J, { children: /* @__PURE__ */ o($e, {}) }) }) });
export {
  He as AppView,
  He as default
};
