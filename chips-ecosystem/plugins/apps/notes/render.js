import { jsx as o, jsxs as p, Fragment as q } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { useMemo as v, useState as w, useRef as W, useCallback as E, useEffect as L } from "chips-resource://platform/vendor/react.js";
import { Input as le, theme as $, Empty as M, Typography as h, List as O, Tag as Z, Badge as V, Button as ee, useCommandRuntime as ue, ChipsProvider as pe, CommandProvider as he, App as te, Flex as G, Alert as z } from "chips-resource://platform/vendor/chips-ui.js";
const F = { notebooks: [], notes: [] };
function fe(t, e) {
  return t.title.localeCompare(e.title, "zh-Hans-CN");
}
function me(t, e) {
  const n = (r) => [...r.filter((f) => f.documentId !== e.documentId), e].sort(fe);
  return e.kind === "box" ? { notebooks: n(t.notebooks), notes: t.notes } : { notebooks: t.notebooks, notes: n(t.notes) };
}
function K(t, e) {
  return t.notebooks.find((n) => n.documentId === e) ?? t.notes.find((n) => n.documentId === e) ?? null;
}
function ye(t) {
  return Array.isArray(t) ? t.join("：") : t;
}
function ge(t) {
  return (t ?? []).map(ye);
}
function Ce(t) {
  const e = t.url.split("/").filter((r) => r.length > 0);
  return e[e.length - 1] ?? t.url;
}
function _e(t) {
  let e = 0, n = 0;
  for (const r of t)
    r.enabled ? e += 1 : n += 1;
  return { enabled: e, disabled: n };
}
function Ie(t) {
  return JSON.stringify(t.value, null, 2);
}
function be(t) {
  const e = t.trim();
  return e.length > 0 ? e : null;
}
function we({ library: t, selectedId: e, onSelect: n }) {
  const { token: r } = $.useToken(), s = t.notebooks.length === 0 && t.notes.length === 0, f = v(
    () => [
      { key: "notebooks", title: "笔记本（箱子文档）", items: [...t.notebooks] },
      { key: "notes", title: "笔记（卡片文档）", items: [...t.notes] }
    ],
    [t.notebooks, t.notes]
  );
  return s ? /* @__PURE__ */ o(
    M,
    {
      description: "笔记库为空：粘贴文档来源引用打开笔记本或笔记",
      style: { padding: r.padding }
    }
  ) : /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: r.marginSM }, children: f.map(
    (l) => l.items.length === 0 ? null : /* @__PURE__ */ p("section", { children: [
      /* @__PURE__ */ o(h.Text, { strong: !0, style: { display: "block", marginBottom: r.marginXS }, children: l.title }),
      /* @__PURE__ */ o(
        O,
        {
          size: "small",
          dataSource: l.items,
          renderItem: (i) => /* @__PURE__ */ p(
            O.Item,
            {
              onClick: () => n(i.documentId),
              style: {
                cursor: "pointer",
                paddingInline: r.paddingXS,
                borderRadius: r.borderRadiusLG,
                background: i.documentId === e ? r.colorPrimaryBg : void 0
              },
              children: [
                /* @__PURE__ */ o(h.Text, { ellipsis: !0, style: { maxWidth: "100%" }, children: i.title }),
                /* @__PURE__ */ o(Z, { children: i.kind === "box" ? "笔记本" : "笔记" })
              ]
            }
          )
        }
      )
    ] }, l.key)
  ) });
}
function Ee({ onOpen: t, busy: e }) {
  return /* @__PURE__ */ o(
    le.Search,
    {
      placeholder: "粘贴卡片或箱子来源引用（如工作区路径或 chips-resource:// 引用）",
      enterButton: e ? "打开中…" : "打开",
      disabled: e,
      onSearch: (n) => t(n),
      style: { maxWidth: 480 },
      "aria-label": "文档来源引用输入"
    }
  );
}
function ke({ summary: t, detail: e, nodeContents: n, onLoadNodeContent: r }) {
  const { token: s } = $.useToken();
  if (t === null || e === null)
    return /* @__PURE__ */ o(
      M,
      {
        description: "尚未选中笔记文档：从左侧列表选择，或粘贴来源引用打开",
        style: { padding: s.padding }
      }
    );
  const f = ge(e.metadata.tags), l = e.kind === "card" ? e.structure.structure.map((i) => i.id) : [];
  return /* @__PURE__ */ p("section", { style: { display: "flex", flexDirection: "column", gap: s.marginSM }, children: [
    /* @__PURE__ */ p("header", { style: { display: "flex", alignItems: "center", gap: s.marginSM, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ o(h.Title, { level: 4, style: { margin: 0 }, children: e.metadata.name }),
      /* @__PURE__ */ o(V, { status: "default", text: t.kind === "box" ? "笔记本" : "笔记" }),
      /* @__PURE__ */ o(h.Text, { type: "secondary", code: !0, children: t.documentId })
    ] }),
    /* @__PURE__ */ p("dl", { style: { margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: s.marginXS, columnGap: s.margin }, children: [
      /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(h.Text, { type: "secondary", children: "创建时间" }) }),
      /* @__PURE__ */ o("dd", { style: { margin: 0 }, children: e.metadata.created_at }),
      /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(h.Text, { type: "secondary", children: "修改时间" }) }),
      /* @__PURE__ */ o("dd", { style: { margin: 0 }, children: e.metadata.modified_at }),
      e.kind === "box" && e.metadata.description !== void 0 ? /* @__PURE__ */ p(q, { children: [
        /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(h.Text, { type: "secondary", children: "描述" }) }),
        /* @__PURE__ */ o("dd", { style: { margin: 0 }, children: e.metadata.description })
      ] }) : null,
      e.kind === "box" && e.metadata.active_layout_type !== void 0 ? /* @__PURE__ */ p(q, { children: [
        /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(h.Text, { type: "secondary", children: "布局" }) }),
        /* @__PURE__ */ o("dd", { style: { margin: 0 }, children: e.metadata.active_layout_type })
      ] }) : null
    ] }),
    f.length > 0 ? /* @__PURE__ */ o("div", { style: { display: "flex", gap: s.marginXS, flexWrap: "wrap" }, children: f.map((i) => /* @__PURE__ */ o(Z, { children: i }, i)) }) : null,
    e.kind === "box" ? /* @__PURE__ */ p("section", { children: [
      /* @__PURE__ */ p(h.Text, { strong: !0, style: { display: "block", marginBottom: s.marginXS }, children: [
        "条目（",
        e.entries.length,
        " 项）"
      ] }),
      e.entries.length === 0 ? /* @__PURE__ */ o(M, { description: "笔记本暂无条目" }) : /* @__PURE__ */ o(
        O,
        {
          size: "small",
          dataSource: [...e.entries],
          renderItem: (i) => /* @__PURE__ */ p(O.Item, { children: [
            /* @__PURE__ */ o(h.Text, { ellipsis: !0, style: { maxWidth: "60%" }, children: Ce(i) }),
            /* @__PURE__ */ o(h.Text, { type: "secondary", ellipsis: !0, style: { maxWidth: "30%" }, code: !0, children: i.entry_id }),
            /* @__PURE__ */ o(V, { status: i.enabled ? "success" : "default", text: i.enabled ? "启用" : "停用" })
          ] })
        }
      )
    ] }) : /* @__PURE__ */ p("section", { children: [
      /* @__PURE__ */ p(h.Text, { strong: !0, style: { display: "block", marginBottom: s.marginXS }, children: [
        "内容节点（",
        l.length,
        " 个）"
      ] }),
      l.length === 0 ? /* @__PURE__ */ o(M, { description: "卡片暂无内容节点" }) : /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: s.marginXS }, children: l.map((i) => {
        const a = n.get(i);
        return /* @__PURE__ */ p("div", { style: { border: `1px solid ${s.colorBorderSecondary}`, borderRadius: s.borderRadiusLG, padding: s.paddingSM }, children: [
          /* @__PURE__ */ p("div", { style: { display: "flex", alignItems: "center", gap: s.marginSM }, children: [
            /* @__PURE__ */ o(h.Text, { code: !0, children: i }),
            a === void 0 ? /* @__PURE__ */ o(ee, { size: "small", onClick: () => r(i), children: "读取内容" }) : /* @__PURE__ */ o(
              V,
              {
                status: a.errorCode === null ? "success" : "error",
                text: a.errorCode === null ? "已读取" : `读取失败（${a.errorCode}）`
              }
            )
          ] }),
          a !== void 0 && a.errorCode === null ? /* @__PURE__ */ o(
            "pre",
            {
              style: {
                margin: 0,
                marginTop: s.marginSM,
                padding: s.paddingSM,
                background: s.colorFillQuaternary,
                borderRadius: s.borderRadiusLG,
                overflow: "auto",
                maxHeight: 240,
                fontSize: s.fontSizeSM
              },
              children: a.display
            }
          ) : null
        ] }, i);
      }) })
    ] }),
    /* @__PURE__ */ o(h.Text, { type: "secondary", children: "编辑区骨架（只读消费）：就地编辑与保存候平台编辑链路落位后在本区接线。" })
  ] });
}
class k extends Error {
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
    return new k({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function Te(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const Ae = "SDK_BRIDGE_UNAVAILABLE", H = "SDK_UNKNOWN_ERROR", X = "发生未知错误";
function Se(t) {
  return t instanceof Error;
}
function xe(t) {
  if (t instanceof k)
    return t;
  if (Te(t)) {
    const e = t, n = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new k(n);
  }
  return Se(t) ? new k({
    code: H,
    message: X,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new k({
    code: H,
    message: X,
    details: { value: String(t) },
    retryable: !1
  });
}
function Ne() {
  return new k({
    code: Ae,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function C(t, e, n) {
  let r;
  try {
    r = t();
  } catch (s) {
    return Promise.reject(xe(s));
  }
  return r.request(e, n);
}
const Re = "cli.command.list", De = "cli.command.get", Me = "cli.command.resolve";
function ve(t) {
  return {
    list(e) {
      return C(t, Re, e ?? {});
    },
    get(e) {
      return C(t, De, e);
    },
    resolve(e) {
      return C(t, Me, e);
    }
  };
}
const R = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, Le = "cli.task.create", Oe = "cli.task.bindInvocation", Pe = "cli.task.cancel";
function Be(t) {
  return {
    create(e) {
      return C(t, Le, e).then((n) => n.task);
    },
    bindInvocation(e) {
      return C(t, Oe, e).then((n) => n.task);
    },
    get(e) {
      const n = { taskId: e };
      return C(t, R.CLI_TASK_GET, n).then((r) => r.task);
    },
    active(e) {
      const n = { commandId: e };
      return C(t, R.CLI_TASK_ACTIVE, n).then((r) => r.task);
    },
    progress(e, n) {
      const r = { taskId: e, progress: n };
      return C(t, R.CLI_TASK_PROGRESS, r).then((s) => s.task);
    },
    complete(e, n) {
      const r = {
        taskId: e,
        ...n === void 0 ? {} : { output: n }
      };
      return C(t, R.CLI_TASK_COMPLETE, r).then((s) => s.task);
    },
    fail(e, n) {
      const r = { taskId: e, error: n };
      return C(t, R.CLI_TASK_FAIL, r).then((s) => s.task);
    },
    cancel(e) {
      return C(t, Pe, { taskId: e }).then((n) => n.task);
    }
  };
}
function Ue() {
  return globalThis.window?.chips;
}
class Ve {
  #t;
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
  cliTask = Be(() => this.#e());
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
    const e = Ue();
    if (e === void 0)
      throw Ne();
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
function Ge(t) {
  return new Ve(t?.bridge);
}
const P = Ge();
class I extends Error {
  code;
  constructor(e, n) {
    super(n), this.name = "DocumentGatewayError", this.code = e;
  }
}
function ne(t) {
  if (t instanceof I)
    return t;
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return new I(e, t instanceof Error ? t.message : "未知错误");
  }
  return new I("DOCUMENT_GATEWAY_ERROR", t instanceof Error ? t.message : "未知错误");
}
function Ke(t) {
  return {
    documentId: t.documentId,
    source: t.source,
    kind: t.kind,
    title: t.title,
    digest: t.digest
  };
}
async function x(t, e, n) {
  try {
    return await P.request("document:read", {
      documentId: t,
      part: e,
      ...n
    });
  } catch (r) {
    throw ne(r);
  }
}
function N(t, e) {
  if (t.part !== e)
    throw new I("DOCUMENT_PART_MISMATCH", "文档读取回包切片与请求不一致");
}
function We() {
  return {
    async open(t) {
      let e;
      try {
        e = await P.request("document:open", { source: t });
      } catch (n) {
        throw ne(n);
      }
      return Ke(e);
    },
    async readCardMetadata(t) {
      const e = await x(t, "metadata", {});
      N(e, "metadata");
      const n = e.value;
      if (typeof n.card_id != "string" || n.card_id.length === 0)
        throw new I("DOCUMENT_METADATA_INVALID", "卡片元数据缺少 card_id");
      return n;
    },
    async readBoxMetadata(t) {
      const e = await x(t, "metadata", {});
      N(e, "metadata");
      const n = e.value;
      if (typeof n.box_id != "string" || n.box_id.length === 0)
        throw new I("DOCUMENT_METADATA_INVALID", "箱子元数据缺少 box_id");
      return n;
    },
    async readStructure(t) {
      const e = await x(t, "structure", {});
      N(e, "structure");
      const n = e.value;
      if (!Array.isArray(n.structure))
        throw new I("DOCUMENT_STRUCTURE_INVALID", "结构切片缺少 structure 数组");
      return n;
    },
    async readEntries(t, e) {
      const n = await x(
        t,
        "entries",
        e === void 0 ? {} : { range: { offset: e.offset, limit: e.limit } }
      );
      N(n, "entries");
      const r = n.value;
      if (!Array.isArray(r))
        throw new I("DOCUMENT_ENTRIES_INVALID", "条目切片必须是数组");
      return r;
    },
    async readCardContent(t, e) {
      const n = await x(t, "content", { nodeId: e });
      N(n, "content");
      const r = n.value;
      if (typeof r.node_id != "string" || r.node_id.length === 0)
        throw new I("DOCUMENT_CONTENT_INVALID", "内容节点缺少 node_id");
      return r;
    },
    async readBoxContent(t) {
      const e = await x(t, "content", {});
      N(e, "content");
      const n = e.value;
      if (typeof n.card_type != "string" || n.card_type.length === 0)
        throw new I("DOCUMENT_CONTENT_INVALID", "内容切片缺少 card_type");
      return n;
    }
  };
}
async function je(t, e) {
  const [n, r] = await Promise.all([
    t.readBoxMetadata(e),
    t.readEntries(e)
  ]);
  return { kind: "box", metadata: n, entries: r };
}
async function $e(t, e) {
  const [n, r] = await Promise.all([
    t.readCardMetadata(e),
    t.readStructure(e)
  ]);
  return { kind: "card", metadata: n, structure: r };
}
function qe() {
  return We();
}
function ze(t = qe()) {
  const [e, n] = w(F), [r, s] = w("idle"), [f, l] = w(null), [i, a] = w(null), [b, g] = w(null), [m, d] = w(null), [A, D] = w(/* @__PURE__ */ new Map()), B = W(null), U = W(F);
  U.current = e, B.current = b;
  const _ = E((c) => c instanceof I ? c.code : "DOCUMENT_GATEWAY_ERROR", []), S = E(
    async (c) => {
      if (c.kind === "box") {
        const u = await je(t, c.documentId);
        d(u), D(/* @__PURE__ */ new Map());
        return;
      }
      const y = await $e(t, c.documentId);
      d(y), D(/* @__PURE__ */ new Map());
    },
    [t]
  ), re = E(
    async (c) => {
      const y = be(c);
      if (y === null) {
        a("请输入非空的文档来源引用");
        return;
      }
      s("opening"), l(null);
      try {
        const u = await t.open(y);
        n((de) => me(de, u)), g(u.documentId), s("ready"), await S(u), a(`已打开「${u.title}」`);
      } catch (u) {
        s("error"), l(_(u)), a(`文档打开失败（${_(u)}）：请核对来源引用与文档可用性`);
      }
    },
    [S, _, t]
  ), oe = E(
    async (c) => {
      const y = K(U.current, c);
      if (y !== null) {
        g(c), l(null);
        try {
          await S(y);
        } catch (u) {
          l(_(u)), a(`文档读取失败（${_(u)}）`);
        }
      }
    },
    [S, _]
  ), se = E(
    async (c) => {
      const y = B.current;
      if (!(y === null || m === null || m.kind !== "card") && !A.has(c))
        try {
          const u = await t.readCardContent(y, c);
          D(
            new Map(A).set(c, {
              nodeId: c,
              display: Ie(u),
              errorCode: null
            })
          );
        } catch (u) {
          D(
            new Map(A).set(c, {
              nodeId: c,
              display: "",
              errorCode: _(u)
            })
          );
        }
    },
    [_, m, t, A]
  ), ie = E(async () => {
    const c = B.current;
    if (c === null) {
      a("当前没有选中的笔记文档");
      return;
    }
    const y = K(U.current, c);
    if (y !== null) {
      l(null);
      try {
        await S(y), a("当前视图已刷新");
      } catch (u) {
        l(_(u)), a(`文档刷新失败（${_(u)}）`);
      }
    }
  }, [S, _]);
  L(() => {
    if (i === null || r === "error")
      return;
    const c = window.setTimeout(() => {
      a(null);
    }, 2400);
    return () => {
      window.clearTimeout(c);
    };
  }, [i, r]);
  const ae = v(
    () => b === null ? null : K(e, b),
    [e, b]
  ), ce = v(
    () => m !== null && m.kind === "box" ? _e(m.entries) : null,
    [m]
  );
  return {
    library: e,
    status: r,
    errorCode: f,
    feedback: i,
    selectedId: b,
    selected: ae,
    detail: m,
    nodeContents: A,
    entryCounts: ce,
    openSource: re,
    select: oe,
    loadNodeContent: se,
    refreshCurrent: ie
  };
}
const Y = "chips.official.notes", T = {
  openCard: "notes:open-card",
  refreshView: "notes:refresh-view"
}, J = {
  openCard: "open-card",
  refreshView: "refresh-view"
}, j = [
  {
    id: T.openCard,
    title: "打开笔记文档",
    description: "按来源引用打开指定卡片或箱子并加入笔记库定位",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: Y },
    handlerId: J.openCard,
    keywords: ["open", "card", "box", "打开", "笔记", "笔记本"],
    group: "文件"
  },
  {
    id: T.refreshView,
    title: "刷新当前视图",
    description: "重新读取当前选中文档的元数据与内容",
    shortcut: "F5",
    scope: { kind: "app", appId: Y },
    handlerId: J.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  }
];
new Set(Object.values(T));
function Fe(t, e) {
  const n = {
    "open-card": (r) => {
      const s = He(r);
      if (s === null) {
        e({ commandId: T.openCard, handlerId: "open-card", ok: !1 });
        return;
      }
      t.openCard(s), e({ commandId: T.openCard, handlerId: "open-card", ok: !0 });
    },
    "refresh-view": () => {
      t.refreshView(), e({ commandId: T.refreshView, handlerId: "refresh-view", ok: !0 });
    }
  };
  return j.map((r) => {
    const s = r.handlerId ?? "";
    return {
      commandId: r.id,
      handlerId: s,
      handler: (f) => {
        n[s](f);
      }
    };
  });
}
function He(t) {
  if (typeof t != "object" || t === null)
    return null;
  const e = t.path;
  return typeof e != "string" || e.trim().length === 0 ? null : e.trim();
}
const Xe = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function Q(t) {
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function Ye() {
  const t = ue(), [e, n] = w("registering"), [r, s] = w(null), [f, l] = w(null), i = W(null);
  L(() => {
    let g = !1, m = null;
    return n("registering"), s(null), (async () => {
      try {
        for (const d of j)
          await P.request("command:register", { definition: d });
        if (g)
          return;
        m = t.attach(
          Fe(
            {
              openCard: (d) => {
                i.current?.openCard(d);
              },
              refreshView: () => {
                i.current?.refreshView();
              }
            },
            (d) => {
              l(d);
            }
          )
        ), n("ready");
      } catch (d) {
        g || (s(Q(d)), n("error"));
      }
    })(), () => {
      g = !0, m?.dispose();
      for (const d of j)
        P.request("command:unregister", { commandId: d.id }).catch(() => {
        });
    };
  }, [t]);
  const a = E((g) => {
    i.current = g;
  }, []), b = E(() => {
    t.invoke({ commandId: T.refreshView, source: "api" }).catch((m) => {
      s(Q(m));
    });
  }, [t]);
  return { phase: e, errorCode: r, lastInvoked: f, setActions: a, invokeRefresh: b };
}
const Je = "chips.official.notes", Qe = () => {
  const { token: t } = $.useToken(), { message: e } = te.useApp(), n = ze(), { phase: r, errorCode: s, setActions: f, invokeRefresh: l } = Ye(), { feedback: i, status: a, openSource: b, refreshCurrent: g } = n, m = v(
    () => ({
      openCard: (d) => {
        b(d);
      },
      refreshView: () => {
        g();
      }
    }),
    [b, g]
  );
  return L(() => (f(m), () => {
    f(null);
  }), [m, f]), L(() => {
    i !== null && a !== "error" && e.info(i);
  }, [i, a, e]), /* @__PURE__ */ p(G, { style: { height: "100%", background: t.colorBgLayout }, children: [
    /* @__PURE__ */ p(
      "aside",
      {
        style: {
          width: 280,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: t.marginSM,
          padding: t.padding,
          background: t.colorBgContainer,
          borderInlineEnd: `1px solid ${t.colorBorderSecondary}`,
          overflow: "auto"
        },
        children: [
          /* @__PURE__ */ o(h.Text, { strong: !0, children: "笔记库" }),
          /* @__PURE__ */ o(Ee, { onOpen: (d) => {
            n.openSource(d);
          }, busy: a === "opening" }),
          i !== null && a === "error" ? /* @__PURE__ */ o(z, { type: "error", showIcon: !0, message: i }) : null,
          r === "error" && s !== null ? /* @__PURE__ */ o(z, { type: "warning", showIcon: !0, message: `命令通道异常（${s}）` }) : null,
          /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflow: "auto" }, children: /* @__PURE__ */ o(
            we,
            {
              library: n.library,
              selectedId: n.selectedId,
              onSelect: (d) => {
                n.select(d);
              }
            }
          ) }),
          /* @__PURE__ */ p(h.Text, { type: "secondary", children: [
            "命令注册状态：",
            Xe[r]
          ] })
        ]
      }
    ),
    /* @__PURE__ */ o("main", { style: { flex: 1, minWidth: 0, padding: t.padding, background: t.colorBgContainer, overflow: "auto" }, children: /* @__PURE__ */ p(G, { vertical: !0, gap: t.marginSM, children: [
      /* @__PURE__ */ p(G, { justify: "space-between", align: "center", children: [
        /* @__PURE__ */ o(h.Title, { level: 4, style: { margin: 0 }, children: "笔记工作台" }),
        /* @__PURE__ */ o(ee, { onClick: l, children: "刷新当前视图" })
      ] }),
      /* @__PURE__ */ o(
        ke,
        {
          summary: n.selected,
          detail: n.detail,
          nodeContents: n.nodeContents,
          onLoadNodeContent: (d) => {
            n.loadNodeContent(d);
          }
        }
      )
    ] }) })
  ] });
}, nt = () => /* @__PURE__ */ o(pe, { appId: Je, surface: "window", children: /* @__PURE__ */ o(he, { children: /* @__PURE__ */ o(te, { children: /* @__PURE__ */ o(Qe, {}) }) }) });
export {
  nt as AppView,
  nt as default
};
