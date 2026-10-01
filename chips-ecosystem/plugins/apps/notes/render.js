import { jsx as o, jsxs as m, Fragment as ae } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { useState as w, useRef as W, useCallback as _, useEffect as te, useMemo as de } from "chips-resource://platform/vendor/react.js";
import { Input as Z, theme as me, Empty as ee, Typography as g, List as ne, Tag as Ae, Badge as ce, Alert as le, Flex as L, Button as K, useCommandRuntime as Ge, ChipsProvider as We, CommandProvider as Ke, App as Ne } from "chips-resource://platform/vendor/chips-ui.js";
const ye = { notebooks: [], notes: [] };
function $e(t, e) {
  return t.title.localeCompare(e.title, "zh-Hans-CN");
}
function je(t, e) {
  const n = (r) => [...r.filter((u) => u.documentId !== e.documentId), e].sort($e);
  return e.kind === "box" ? { notebooks: n(t.notebooks), notes: t.notes } : { notebooks: t.notebooks, notes: n(t.notes) };
}
function Q(t, e) {
  return t.notebooks.find((n) => n.documentId === e) ?? t.notes.find((n) => n.documentId === e) ?? null;
}
function ze(t) {
  return Array.isArray(t) ? t.join("：") : t;
}
function Ye(t) {
  return (t ?? []).map(ze);
}
function Fe(t) {
  const e = t.url.split("/").filter((r) => r.length > 0);
  return e[e.length - 1] ?? t.url;
}
function He(t) {
  let e = 0, n = 0;
  for (const r of t)
    r.enabled ? e += 1 : n += 1;
  return { enabled: e, disabled: n };
}
function Ce(t) {
  return JSON.stringify(t.value, null, 2);
}
function Xe(t) {
  const e = t.trim();
  return e.length > 0 ? e : null;
}
function qe(t, e, n) {
  const r = (f) => f.map((l) => l.documentId === e ? { ...l, title: n } : l), c = r(t.notebooks), u = r(t.notes);
  return c === t.notebooks && u === t.notes ? t : { notebooks: c, notes: u };
}
function Je(t) {
  return t === "DOCUMENT_WRITE_CONFLICT" ? "文档正被其他会话写入，请稍后重试" : t === "DOCUMENT_SOURCE_CHANGED" ? "文档已在外部修改，请刷新视图或重新打开后再试" : t === "DOCUMENT_NOT_OPEN" ? "文档会话不存在，请重新打开文档" : t === "DOCUMENT_SAVE_FAILED" ? "保存未完成，请核对文档可用性后重试" : t === "DOCUMENT_REVISION_INVALID" || t === "DOCUMENT_SAVE_RECEIPT_INVALID" ? "通道回执异常，请重试；若持续出现请重新打开文档" : "请重试；若持续失败请重新打开文档";
}
function Qe({ library: t, selectedId: e, onSelect: n }) {
  const { token: r } = me.useToken(), c = t.notebooks.length === 0 && t.notes.length === 0, u = [
    { key: "notebooks", title: "笔记本（箱子文档）", items: [...t.notebooks] },
    { key: "notes", title: "笔记（卡片文档）", items: [...t.notes] }
  ];
  return c ? /* @__PURE__ */ o(
    ee,
    {
      description: "笔记库为空：粘贴文档来源引用打开笔记本或笔记",
      style: { padding: r.padding }
    }
  ) : /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: r.marginSM }, children: u.map(
    (f) => f.items.length === 0 ? null : /* @__PURE__ */ m("section", { children: [
      /* @__PURE__ */ o(g.Text, { strong: !0, style: { display: "block", marginBottom: r.marginXS }, children: f.title }),
      /* @__PURE__ */ o(
        ne,
        {
          size: "small",
          dataSource: f.items,
          renderItem: (l) => /* @__PURE__ */ m(
            ne.Item,
            {
              onClick: () => n(l.documentId),
              style: {
                cursor: "pointer",
                paddingInline: r.paddingXS,
                borderRadius: r.borderRadiusLG,
                background: l.documentId === e ? r.colorPrimaryBg : void 0
              },
              children: [
                /* @__PURE__ */ o(g.Text, { ellipsis: !0, style: { maxWidth: "100%" }, children: l.title }),
                /* @__PURE__ */ o(Ae, { children: l.kind === "box" ? "笔记本" : "笔记" })
              ]
            }
          )
        }
      )
    ] }, f.key)
  ) });
}
function Ze({ onOpen: t, busy: e }) {
  return /* @__PURE__ */ o(
    Z.Search,
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
function et(t) {
  return t.facet === "rename" ? "重命名" : t.facet === "description" ? "描述修改" : `内容修改（${t.nodeId}）`;
}
function tt({
  summary: t,
  detail: e,
  nodeContents: n,
  onLoadNodeContent: r,
  revision: c,
  savedDigest: u,
  writeError: f,
  pendingChange: l,
  commitBusy: y,
  saveBusy: N,
  onStageRename: A,
  onStageDescription: C,
  onStageNodeContent: p,
  onDiscardEdits: x,
  onCommitEdits: U,
  onSaveToDisk: re
}) {
  const { token: d } = me.useToken(), [oe, j] = w(null);
  if (t === null || e === null)
    return /* @__PURE__ */ o(
      ee,
      {
        description: "尚未选中笔记文档：从左侧列表选择，或粘贴来源引用打开",
        style: { padding: d.padding }
      }
    );
  const X = Ye(e.metadata.tags), S = e.kind === "card" ? e.structure.structure.map((h) => h.id) : [];
  return /* @__PURE__ */ m("section", { style: { display: "flex", flexDirection: "column", gap: d.marginSM }, children: [
    /* @__PURE__ */ m("header", { style: { display: "flex", alignItems: "center", gap: d.marginSM, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ o(g.Title, { level: 4, style: { margin: 0 }, children: e.metadata.name }),
      /* @__PURE__ */ o(ce, { status: "default", text: t.kind === "box" ? "笔记本" : "笔记" }),
      /* @__PURE__ */ o(g.Text, { "data-role": "revision-badge", type: "secondary", children: c > 0 ? `修订徽标：修订号 ${c}` : "修订徽标：未写入" }),
      /* @__PURE__ */ o(g.Text, { type: "secondary", code: !0, children: t.documentId })
    ] }),
    f !== null ? /* @__PURE__ */ o(
      le,
      {
        type: "error",
        showIcon: !0,
        "data-role": "write-error",
        title: `写入失败（${f.code}）`,
        description: `${f.message}：${Je(f.code)}`
      }
    ) : null,
    /* @__PURE__ */ m(L, { align: "center", gap: d.marginSM, wrap: "wrap", children: [
      /* @__PURE__ */ o(g.Text, { type: "secondary", children: "文档名称" }),
      /* @__PURE__ */ o(
        Z,
        {
          "aria-label": "文档名称",
          defaultValue: e.metadata.name,
          onChange: (h) => A(h.target.value),
          style: { maxWidth: 320 }
        }
      )
    ] }),
    e.kind === "box" ? /* @__PURE__ */ m(L, { align: "center", gap: d.marginSM, wrap: "wrap", children: [
      /* @__PURE__ */ o(g.Text, { type: "secondary", children: "文档描述" }),
      /* @__PURE__ */ o(
        Z,
        {
          "aria-label": "文档描述",
          defaultValue: e.metadata.description ?? "",
          onChange: (h) => C(h.target.value),
          style: { maxWidth: 480 }
        }
      )
    ] }) : null,
    /* @__PURE__ */ m(L, { align: "center", gap: d.marginSM, wrap: "wrap", children: [
      /* @__PURE__ */ o(K, { "data-role": "save-to-disk", onClick: re, loading: N, children: "保存到磁盘" }),
      u !== null ? /* @__PURE__ */ m(g.Text, { "data-role": "saved-digest", type: "secondary", code: !0, children: [
        "已保存摘要：",
        u
      ] }) : null
    ] }),
    l !== null ? /* @__PURE__ */ m(
      L,
      {
        justify: "space-between",
        align: "center",
        wrap: "wrap",
        gap: d.marginSM,
        style: {
          border: `1px solid ${d.colorBorderSecondary}`,
          borderRadius: d.borderRadiusLG,
          padding: d.paddingSM
        },
        children: [
          /* @__PURE__ */ m(g.Text, { children: [
            "待提交修改：",
            et(l),
            "（写入文档会话，尚未落盘）"
          ] }),
          /* @__PURE__ */ m(L, { gap: d.marginXS, children: [
            /* @__PURE__ */ o(K, { size: "small", onClick: x, disabled: y, children: "放弃修改" }),
            /* @__PURE__ */ o(K, { size: "small", type: "primary", "data-role": "commit-edits", loading: y, onClick: U, children: "提交修改" })
          ] })
        ]
      }
    ) : null,
    /* @__PURE__ */ m("dl", { style: { margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: d.marginXS, columnGap: d.margin }, children: [
      /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(g.Text, { type: "secondary", children: "创建时间" }) }),
      /* @__PURE__ */ o("dd", { style: { margin: 0 }, children: e.metadata.created_at }),
      /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(g.Text, { type: "secondary", children: "修改时间" }) }),
      /* @__PURE__ */ o("dd", { style: { margin: 0 }, children: e.metadata.modified_at }),
      e.kind === "box" && e.metadata.description !== void 0 ? /* @__PURE__ */ m(ae, { children: [
        /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(g.Text, { type: "secondary", children: "描述" }) }),
        /* @__PURE__ */ o("dd", { style: { margin: 0 }, children: e.metadata.description })
      ] }) : null,
      e.kind === "box" && e.metadata.active_layout_type !== void 0 ? /* @__PURE__ */ m(ae, { children: [
        /* @__PURE__ */ o("dt", { children: /* @__PURE__ */ o(g.Text, { type: "secondary", children: "布局" }) }),
        /* @__PURE__ */ o("dd", { style: { margin: 0 }, children: e.metadata.active_layout_type })
      ] }) : null
    ] }),
    X.length > 0 ? /* @__PURE__ */ o("div", { style: { display: "flex", gap: d.marginXS, flexWrap: "wrap" }, children: X.map((h) => /* @__PURE__ */ o(Ae, { children: h }, h)) }) : null,
    e.kind === "box" ? /* @__PURE__ */ m("section", { children: [
      /* @__PURE__ */ m(g.Text, { strong: !0, style: { display: "block", marginBottom: d.marginXS }, children: [
        "条目（",
        e.entries.length,
        " 项）"
      ] }),
      e.entries.length === 0 ? /* @__PURE__ */ o(ee, { description: "笔记本暂无条目" }) : /* @__PURE__ */ o(
        ne,
        {
          size: "small",
          dataSource: [...e.entries],
          renderItem: (h) => /* @__PURE__ */ m(ne.Item, { children: [
            /* @__PURE__ */ o(g.Text, { ellipsis: !0, style: { maxWidth: "60%" }, children: Fe(h) }),
            /* @__PURE__ */ o(g.Text, { type: "secondary", ellipsis: !0, style: { maxWidth: "30%" }, code: !0, children: h.entry_id }),
            /* @__PURE__ */ o(ce, { status: h.enabled ? "success" : "default", text: h.enabled ? "启用" : "停用" })
          ] })
        }
      )
    ] }) : /* @__PURE__ */ m("section", { children: [
      /* @__PURE__ */ m(g.Text, { strong: !0, style: { display: "block", marginBottom: d.marginXS }, children: [
        "内容节点（",
        S.length,
        " 个）"
      ] }),
      S.length === 0 ? /* @__PURE__ */ o(ee, { description: "卡片暂无内容节点" }) : /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: d.marginXS }, children: S.map((h) => {
        const T = n.get(h);
        return /* @__PURE__ */ m("div", { style: { border: `1px solid ${d.colorBorderSecondary}`, borderRadius: d.borderRadiusLG, padding: d.paddingSM }, children: [
          /* @__PURE__ */ m("div", { style: { display: "flex", alignItems: "center", gap: d.marginSM }, children: [
            /* @__PURE__ */ o(g.Text, { code: !0, children: h }),
            T === void 0 ? /* @__PURE__ */ o(K, { size: "small", onClick: () => r(h), children: "读取内容" }) : /* @__PURE__ */ o(
              ce,
              {
                status: T.errorCode === null ? "success" : "error",
                text: T.errorCode === null ? "已读取" : `读取失败（${T.errorCode}）`
              }
            )
          ] }),
          T !== void 0 && T.errorCode === null ? /* @__PURE__ */ m(ae, { children: [
            /* @__PURE__ */ o(
              "pre",
              {
                "data-role": "node-display",
                style: {
                  margin: 0,
                  marginTop: d.marginSM,
                  padding: d.paddingSM,
                  background: d.colorFillQuaternary,
                  borderRadius: d.borderRadiusLG,
                  overflow: "auto",
                  maxHeight: 240,
                  fontSize: d.fontSizeSM
                },
                children: T.display
              }
            ),
            oe === h ? /* @__PURE__ */ o(
              Z.TextArea,
              {
                "aria-label": `内容编辑 ${h}`,
                defaultValue: T.display,
                rows: 6,
                style: { marginTop: d.marginSM },
                onChange: (z) => p(h, z.target.value)
              }
            ) : /* @__PURE__ */ o(
              K,
              {
                size: "small",
                "aria-label": "编辑内容",
                style: { marginTop: d.marginSM },
                onClick: () => j(h),
                children: "编辑内容"
              }
            )
          ] }) : null
        ] }, h);
      }) })
    ] }),
    /* @__PURE__ */ o(g.Text, { type: "secondary", children: "修改先写入文档会话（document:write，仅内存模型并推进修订号），「保存到磁盘」（document:save）后才落盘。" })
  ] }, t.documentId);
}
class V extends Error {
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
    return new V({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function nt(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const rt = "SDK_BRIDGE_UNAVAILABLE", Ie = "SDK_UNKNOWN_ERROR", Ee = "发生未知错误";
function ot(t) {
  return t instanceof Error;
}
function st(t) {
  if (t instanceof V)
    return t;
  if (nt(t)) {
    const e = t, n = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new V(n);
  }
  return ot(t) ? new V({
    code: Ie,
    message: Ee,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new V({
    code: Ie,
    message: Ee,
    details: { value: String(t) },
    retryable: !1
  });
}
function it() {
  return new V({
    code: rt,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function b(t, e, n) {
  let r;
  try {
    r = t();
  } catch (c) {
    return Promise.reject(st(c));
  }
  return r.request(e, n);
}
const at = "cli.command.list", ct = "cli.command.get", dt = "cli.command.resolve";
function lt(t) {
  return {
    list(e) {
      return b(t, at, e ?? {});
    },
    get(e) {
      return b(t, ct, e);
    },
    resolve(e) {
      return b(t, dt, e);
    }
  };
}
const F = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, ut = "cli.task.create", mt = "cli.task.bindInvocation", ft = "cli.task.cancel";
function pt(t) {
  return {
    create(e) {
      return b(t, ut, e).then((n) => n.task);
    },
    bindInvocation(e) {
      return b(t, mt, e).then((n) => n.task);
    },
    get(e) {
      const n = { taskId: e };
      return b(t, F.CLI_TASK_GET, n).then((r) => r.task);
    },
    active(e) {
      const n = { commandId: e };
      return b(t, F.CLI_TASK_ACTIVE, n).then((r) => r.task);
    },
    progress(e, n) {
      const r = { taskId: e, progress: n };
      return b(t, F.CLI_TASK_PROGRESS, r).then((c) => c.task);
    },
    complete(e, n) {
      const r = {
        taskId: e,
        ...n === void 0 ? {} : { output: n }
      };
      return b(t, F.CLI_TASK_COMPLETE, r).then((c) => c.task);
    },
    fail(e, n) {
      const r = { taskId: e, error: n };
      return b(t, F.CLI_TASK_FAIL, r).then((c) => c.task);
    },
    cancel(e) {
      return b(t, ft, { taskId: e }).then((n) => n.task);
    }
  };
}
function ht() {
  return globalThis.window?.chips;
}
class gt {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = lt(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = pt(() => this.#e());
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
    const e = ht();
    if (e === void 0)
      throw it();
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
    return b(() => this.#e(), e, n);
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
function yt(t) {
  return new gt(t?.bridge);
}
const $ = yt();
class E extends Error {
  code;
  constructor(e, n) {
    super(n), this.name = "DocumentGatewayError", this.code = e;
  }
}
function H(t) {
  if (t instanceof E)
    return t;
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return new E(e, t instanceof Error ? t.message : "未知错误");
  }
  return new E("DOCUMENT_GATEWAY_ERROR", t instanceof Error ? t.message : "未知错误");
}
function Ct(t) {
  const e = H(t);
  return { code: e.code, message: e.message };
}
function It(t) {
  return {
    documentId: t.documentId,
    source: t.source,
    kind: t.kind,
    title: t.title,
    digest: t.digest
  };
}
async function B(t, e, n) {
  try {
    return await $.request("document:read", {
      documentId: t,
      part: e,
      ...n
    });
  } catch (r) {
    throw H(r);
  }
}
function G(t, e) {
  if (t.part !== e)
    throw new E("DOCUMENT_PART_MISMATCH", "文档读取回包切片与请求不一致");
}
function Et(t) {
  const e = t?.revision;
  if (typeof e != "number" || !Number.isInteger(e) || e <= 0)
    throw new E("DOCUMENT_REVISION_INVALID", "文档写入回执缺少有效的修订号");
  return e;
}
function _t(t) {
  const e = t ?? {};
  if (typeof e.source != "string" || e.source.length === 0)
    throw new E("DOCUMENT_SAVE_RECEIPT_INVALID", "文档保存回执缺少来源引用");
  if (typeof e.digest != "string" || e.digest.length === 0)
    throw new E("DOCUMENT_SAVE_RECEIPT_INVALID", "文档保存回执缺少包摘要");
  return { source: e.source, digest: e.digest };
}
function wt() {
  return {
    async open(t) {
      let e;
      try {
        e = await $.request("document:open", { source: t });
      } catch (n) {
        throw H(n);
      }
      return It(e);
    },
    async readCardMetadata(t) {
      const e = await B(t, "metadata", {});
      G(e, "metadata");
      const n = e.value;
      if (typeof n.card_id != "string" || n.card_id.length === 0)
        throw new E("DOCUMENT_METADATA_INVALID", "卡片元数据缺少 card_id");
      return n;
    },
    async readBoxMetadata(t) {
      const e = await B(t, "metadata", {});
      G(e, "metadata");
      const n = e.value;
      if (typeof n.box_id != "string" || n.box_id.length === 0)
        throw new E("DOCUMENT_METADATA_INVALID", "箱子元数据缺少 box_id");
      return n;
    },
    async readStructure(t) {
      const e = await B(t, "structure", {});
      G(e, "structure");
      const n = e.value;
      if (!Array.isArray(n.structure))
        throw new E("DOCUMENT_STRUCTURE_INVALID", "结构切片缺少 structure 数组");
      return n;
    },
    async readEntries(t, e) {
      const n = await B(
        t,
        "entries",
        e === void 0 ? {} : { range: { offset: e.offset, limit: e.limit } }
      );
      G(n, "entries");
      const r = n.value;
      if (!Array.isArray(r))
        throw new E("DOCUMENT_ENTRIES_INVALID", "条目切片必须是数组");
      return r;
    },
    async readCardContent(t, e) {
      const n = await B(t, "content", { nodeId: e });
      G(n, "content");
      const r = n.value;
      if (typeof r.node_id != "string" || r.node_id.length === 0)
        throw new E("DOCUMENT_CONTENT_INVALID", "内容节点缺少 node_id");
      return r;
    },
    async readBoxContent(t) {
      const e = await B(t, "content", {});
      G(e, "content");
      const n = e.value;
      if (typeof n.card_type != "string" || n.card_type.length === 0)
        throw new E("DOCUMENT_CONTENT_INVALID", "内容切片缺少 card_type");
      return n;
    },
    async writeSlice(t) {
      const e = {
        documentId: t.documentId,
        part: t.part,
        value: t.value
      };
      t.nodeId !== void 0 && (e.nodeId = t.nodeId);
      let n;
      try {
        n = await $.request("document:write", e);
      } catch (r) {
        throw H(r);
      }
      return Et(n);
    },
    async saveDocument(t) {
      let e;
      try {
        e = await $.request("document:save", { documentId: t });
      } catch (n) {
        throw H(n);
      }
      return _t(e);
    }
  };
}
async function Tt(t, e) {
  const [n, r] = await Promise.all([
    t.readBoxMetadata(e),
    t.readEntries(e)
  ]);
  return { kind: "box", metadata: n, entries: r };
}
async function kt(t, e) {
  const [n, r] = await Promise.all([
    t.readCardMetadata(e),
    t.readStructure(e)
  ]);
  return { kind: "card", metadata: n, structure: r };
}
function At() {
  return wt();
}
function Nt(t) {
  return t.facet === "rename" ? t.nextName.trim().length === 0 ? { ok: !1, errorCode: "DOCUMENT_METADATA_INVALID", message: "name 必填且为非空字符串" } : { ok: !0 } : t.facet === "description" ? { ok: !0 } : Array.isArray(t.nextValue) ? { ok: !1, errorCode: "BRIDGE_INVALID_INPUT", message: "内容切片必须是 JSON 对象" } : { ok: !0 };
}
function bt(t) {
  let e;
  try {
    e = JSON.parse(t);
  } catch {
    return { ok: !1, errorCode: "BRIDGE_INVALID_INPUT", message: "内容不是合法的 JSON 文本" };
  }
  return typeof e != "object" || e === null || Array.isArray(e) ? { ok: !1, errorCode: "BRIDGE_INVALID_INPUT", message: "内容必须是 JSON 对象" } : { ok: !0, value: e };
}
function St(t, e, n) {
  const r = { ...t, modified_at: n };
  return e.name !== void 0 && (r.name = e.name), e.description !== void 0 && (r.description = e.description), r;
}
function Dt(t, e) {
  return { ...t, value: e };
}
function _e(t, e) {
  if (typeof t == "object" && t !== null && "code" in t) {
    const n = t.code;
    if (typeof n == "string" && n.length > 0)
      return {
        errorCode: n,
        message: t instanceof Error ? t.message : "未知错误"
      };
  }
  return { errorCode: e, message: t instanceof Error ? t.message : "未知错误" };
}
class vt {
  documentId;
  watermark;
  pending = null;
  constructor(e, n = 0) {
    this.documentId = e, this.watermark = n;
  }
  /** 当前修订水位（已确认的最近 `{ revision }` 回执；0 = 本会话尚未写入）。 */
  get revision() {
    return this.watermark;
  }
  /** 是否持有待提交变更。 */
  isDirty() {
    return this.pending !== null;
  }
  /** 裁决第①拍：取待提交变更（无则为 null）。 */
  getChange() {
    return this.pending;
  }
  /** 暂存重命名：与当前名一致（去空白后）即清除待提交。 */
  stageRename(e, n) {
    const r = n.trim();
    if (r === e) {
      this.clearPendingOf("rename");
      return;
    }
    this.pending = { facet: "rename", nextName: r };
  }
  /** 暂存描述修改：与当前描述一致即清除待提交。 */
  stageDescription(e, n) {
    if (n === (e ?? "")) {
      this.clearPendingOf("description");
      return;
    }
    this.pending = { facet: "description", nextDescription: n };
  }
  /**
   * 暂存内容节点修改：JSON 文本先解析装配（失败如实回码、不产生待提交）；
   * 与当前文本一致（未修改）即清除待提交。
   */
  stageContent(e, n, r) {
    if (r === n)
      return this.clearPendingOf("content"), { ok: !0 };
    const c = bt(r);
    return c.ok ? (this.pending = { facet: "content", nodeId: e, nextValue: c.value }, { ok: !0 }) : { ok: !1, errorCode: c.errorCode, message: c.message };
  }
  /** 放弃待提交变更（不触达写通道）。 */
  discard() {
    this.pending = null;
  }
  /**
   * 裁决第④拍 update 面：外部修订推进（渲染会话/宿主侧 advance 的对应面）。
   * 不大于当前水位的修订号忽略并返回 false。
   */
  update(e) {
    return this.advanceWatermark(e);
  }
  /**
   * 裁决第⑤拍：确认提交——推进水位并清空待提交变更；旧修订号忽略（返回 false，待提交保留）。
   */
  markCommitted(e) {
    return this.advanceWatermark(e) ? (this.pending = null, !0) : !1;
  }
  /**
   * 提交链（裁决唯一时序的应用前端侧落点）：
   * ① `getChange()` → ② 校验 → ③ `document:write`（写通道回执）→ ④ 投影更新 → ⑤ `markCommitted`。
   *
   * 任一前序拍失败即短路：校验失败不触达写通道；写失败不动投影与水位；
   * 回执未严格递增不确认提交；投影更新失败不确认提交（写已发生但会话视图未证实，可重试）。
   */
  async commit(e, n) {
    const r = this.getChange();
    if (r === null)
      return { status: "no-change" };
    const c = Nt(r);
    if (!c.ok)
      return { status: "invalid", errorCode: c.errorCode, message: c.message };
    let u;
    try {
      u = await e(r);
    } catch (f) {
      const l = _e(f, "DOCUMENT_GATEWAY_ERROR");
      return { status: "write-failed", errorCode: l.errorCode, message: l.message };
    }
    if (u <= this.watermark || !Number.isInteger(u) || u <= 0)
      return { status: "revision-stale", received: u, watermark: this.watermark };
    try {
      await n(r);
    } catch (f) {
      const l = _e(f, "DOCUMENT_GATEWAY_ERROR");
      return {
        status: "projection-failed",
        revision: u,
        errorCode: l.errorCode,
        message: l.message
      };
    }
    return this.markCommitted(u), { status: "committed", revision: u };
  }
  /** 严格递增水位推进：不大于当前水位（或非正整数）的修订号一律忽略。 */
  advanceWatermark(e) {
    return !Number.isInteger(e) || e <= 0 || e <= this.watermark ? !1 : (this.watermark = e, !0);
  }
  clearPendingOf(e) {
    this.pending?.facet === e && (this.pending = null);
  }
}
function Rt(t = At()) {
  const [e, n] = w(ye), [r, c] = w("idle"), [u, f] = w(null), [l, y] = w(null), [N, A] = w(null), [C, p] = w(null), [x, U] = w(/* @__PURE__ */ new Map()), [re, d] = w(0), [oe, j] = w(null), [X, S] = w(null), [h, T] = w(null), [z, fe] = w(!1), [se, pe] = w(!1), D = W(null), q = W(ye), Y = W(null), ie = W(/* @__PURE__ */ new Map()), J = W(/* @__PURE__ */ new Map());
  q.current = e, D.current = N, Y.current = C, ie.current = x;
  const v = _((s) => s instanceof E ? s.code : "DOCUMENT_GATEWAY_ERROR", []), O = _((s) => {
    const a = J.current.get(s);
    if (a !== void 0)
      return a;
    const i = new vt(s);
    return J.current.set(s, i), i;
  }, []), M = _(
    async (s) => {
      if (s.kind === "box") {
        const i = await Tt(t, s.documentId);
        p(i), U(/* @__PURE__ */ new Map());
        return;
      }
      const a = await kt(t, s.documentId);
      p(a), U(/* @__PURE__ */ new Map());
    },
    [t]
  ), be = _(
    async (s) => {
      const a = Xe(s);
      if (a === null) {
        y("请输入非空的文档来源引用");
        return;
      }
      c("opening"), f(null);
      try {
        const i = await t.open(a);
        n((k) => je(k, i)), A(i.documentId), c("ready"), S(null), j(null);
        const I = O(i.documentId);
        d(I.revision), T(I.getChange()), await M(i), y(`已打开「${i.title}」`);
      } catch (i) {
        c("error"), f(v(i)), y(`文档打开失败（${v(i)}）：请核对来源引用与文档可用性`);
      }
    },
    [M, v, O, t]
  ), Se = _(
    async (s) => {
      const a = Q(q.current, s);
      if (a === null)
        return;
      A(s), f(null), S(null), j(null);
      const i = O(s);
      d(i.revision), T(i.getChange());
      try {
        await M(a);
      } catch (I) {
        f(v(I)), y(`文档读取失败（${v(I)}）`);
      }
    },
    [M, v, O]
  ), De = _(
    async (s) => {
      const a = D.current;
      if (!(a === null || C === null || C.kind !== "card") && !x.has(s))
        try {
          const i = await t.readCardContent(a, s);
          U(
            new Map(x).set(s, {
              nodeId: s,
              display: Ce(i),
              errorCode: null
            })
          );
        } catch (i) {
          U(
            new Map(x).set(s, {
              nodeId: s,
              display: "",
              errorCode: v(i)
            })
          );
        }
    },
    [v, C, t, x]
  ), ve = _(async () => {
    const s = D.current;
    if (s === null) {
      y("当前没有选中的笔记文档");
      return;
    }
    const a = Q(q.current, s);
    if (a !== null) {
      f(null);
      try {
        await M(a), y("当前视图已刷新");
      } catch (i) {
        f(v(i)), y(`文档刷新失败（${v(i)}）`);
      }
    }
  }, [M, v]), Re = _(
    (s) => {
      const a = D.current, i = Y.current;
      if (a === null || i === null)
        return;
      const I = O(a);
      I.stageRename(i.metadata.name, s), T(I.getChange());
    },
    [O]
  ), Oe = _(
    (s) => {
      const a = D.current, i = Y.current;
      if (a === null || i === null || i.kind !== "box")
        return;
      const I = O(a);
      I.stageDescription(i.metadata.description, s), T(I.getChange());
    },
    [O]
  ), xe = _(
    (s, a) => {
      const i = D.current;
      if (i === null)
        return { ok: !1, errorCode: "DOCUMENT_GATEWAY_ERROR", message: "当前没有选中的笔记文档" };
      const I = ie.current.get(s), k = I !== void 0 && I.errorCode === null ? I.display : "", R = O(i), Be = R.stageContent(s, k, a);
      return T(R.getChange()), Be;
    },
    [O]
  ), Me = _(() => {
    const s = D.current;
    s !== null && (J.current.get(s)?.discard(), T(null));
  }, []), he = _(
    async (s) => {
      const a = D.current;
      if (a === null)
        throw new E("DOCUMENT_GATEWAY_ERROR", "当前没有选中的笔记文档");
      const i = Y.current;
      if (s.facet === "rename" || s.facet === "description") {
        if (i === null)
          throw new E("DOCUMENT_GATEWAY_ERROR", "当前文档尚未装配，无法写入元数据");
        const k = s.facet === "rename" ? { name: s.nextName } : { description: s.nextDescription }, R = St(i.metadata, k, (/* @__PURE__ */ new Date()).toISOString());
        return t.writeSlice({ documentId: a, part: "metadata", value: R });
      }
      const I = await t.readCardContent(a, s.nodeId);
      return t.writeSlice({
        documentId: a,
        part: "content",
        nodeId: s.nodeId,
        value: Dt(I, s.nextValue)
      });
    },
    [t]
  ), ge = _(
    async (s) => {
      const a = D.current;
      if (a === null)
        throw new E("DOCUMENT_GATEWAY_ERROR", "当前没有选中的笔记文档");
      if (s.facet === "content") {
        const k = await t.readCardContent(a, s.nodeId);
        U(
          new Map(ie.current).set(s.nodeId, {
            nodeId: s.nodeId,
            display: Ce(k),
            errorCode: null
          })
        );
        return;
      }
      const i = Y.current;
      if (i === null)
        throw new E("DOCUMENT_GATEWAY_ERROR", "当前文档尚未装配，无法重读投影");
      if (i.kind === "card") {
        const k = await t.readCardMetadata(a);
        p((R) => R !== null && R.kind === "card" ? { ...R, metadata: k } : R), s.facet === "rename" && n((R) => qe(R, a, k.name));
        return;
      }
      const I = await t.readBoxMetadata(a);
      p((k) => k !== null && k.kind === "box" ? { ...k, metadata: I } : k);
    },
    [t]
  ), Le = _(async () => {
    const s = D.current;
    if (s === null)
      return;
    const a = J.current.get(s);
    if (!(a === void 0 || !a.isDirty() || z)) {
      S(null), fe(!0);
      try {
        const i = await a.commit(he, ge);
        if (i.status === "committed") {
          d(a.revision), T(a.getChange()), y(`修改已写入（修订号 ${i.revision}），保存到磁盘后落盘`);
          return;
        }
        if (i.status === "revision-stale") {
          S({
            code: "DOCUMENT_REVISION_INVALID",
            message: `修订回执未严格递增（收到 ${i.received}，当前 ${i.watermark}）`
          });
          return;
        }
        i.status !== "no-change" && S({ code: i.errorCode, message: i.message });
      } finally {
        fe(!1);
      }
    }
  }, [ge, z, he]), Ue = _(async () => {
    const s = D.current;
    if (s === null) {
      y("当前没有选中的笔记文档");
      return;
    }
    if (!se) {
      S(null), pe(!0);
      try {
        const a = await t.saveDocument(s);
        j(a.digest);
        const i = Q(q.current, s);
        i !== null && await M(i), y(`已保存到磁盘（摘要 ${a.digest}）`);
      } catch (a) {
        S(Ct(a));
      } finally {
        pe(!1);
      }
    }
  }, [M, t, se]);
  te(() => {
    if (l === null || r === "error")
      return;
    const s = window.setTimeout(() => {
      y(null);
    }, 2400);
    return () => {
      window.clearTimeout(s);
    };
  }, [l, r]);
  const Ve = de(
    () => N === null ? null : Q(e, N),
    [e, N]
  ), Pe = de(
    () => C !== null && C.kind === "box" ? He(C.entries) : null,
    [C]
  );
  return {
    library: e,
    status: r,
    errorCode: u,
    feedback: l,
    selectedId: N,
    selected: Ve,
    detail: C,
    nodeContents: x,
    entryCounts: Pe,
    revision: re,
    savedDigest: oe,
    writeError: X,
    pendingChange: h,
    commitBusy: z,
    saveBusy: se,
    openSource: be,
    select: Se,
    loadNodeContent: De,
    refreshCurrent: ve,
    stageRename: Re,
    stageDescription: Oe,
    stageNodeContent: xe,
    discardEdits: Me,
    commitPending: Le,
    saveToDisk: Ue
  };
}
const we = "chips.official.notes", P = {
  openCard: "notes:open-card",
  refreshView: "notes:refresh-view"
}, Te = {
  openCard: "open-card",
  refreshView: "refresh-view"
}, ue = [
  {
    id: P.openCard,
    title: "打开笔记文档",
    description: "按来源引用打开指定卡片或箱子并加入笔记库定位",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: we },
    handlerId: Te.openCard,
    keywords: ["open", "card", "box", "打开", "笔记", "笔记本"],
    group: "文件"
  },
  {
    id: P.refreshView,
    title: "刷新当前视图",
    description: "重新读取当前选中文档的元数据与内容",
    shortcut: "F5",
    scope: { kind: "app", appId: we },
    handlerId: Te.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  }
];
new Set(Object.values(P));
function Ot(t, e) {
  const n = {
    "open-card": (r) => {
      const c = xt(r);
      if (c === null) {
        e({ commandId: P.openCard, handlerId: "open-card", ok: !1 });
        return;
      }
      t.openCard(c), e({ commandId: P.openCard, handlerId: "open-card", ok: !0 });
    },
    "refresh-view": () => {
      t.refreshView(), e({ commandId: P.refreshView, handlerId: "refresh-view", ok: !0 });
    }
  };
  return ue.map((r) => {
    const c = r.handlerId ?? "";
    return {
      commandId: r.id,
      handlerId: c,
      handler: (u) => {
        n[c](u);
      }
    };
  });
}
function xt(t) {
  if (typeof t != "object" || t === null)
    return null;
  const e = t.path;
  return typeof e != "string" || e.trim().length === 0 ? null : e.trim();
}
const Mt = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function ke(t) {
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function Lt() {
  const t = Ge(), [e, n] = w("registering"), [r, c] = w(null), [u, f] = w(null), l = W(null);
  te(() => {
    let A = !1, C = null;
    return n("registering"), c(null), (async () => {
      try {
        for (const p of ue)
          await $.request("command:register", { definition: p });
        if (A)
          return;
        C = t.attach(
          Ot(
            {
              openCard: (p) => {
                l.current?.openCard(p);
              },
              refreshView: () => {
                l.current?.refreshView();
              }
            },
            (p) => {
              f(p);
            }
          )
        ), n("ready");
      } catch (p) {
        A || (c(ke(p)), n("error"));
      }
    })(), () => {
      A = !0, C?.dispose();
      for (const p of ue)
        $.request("command:unregister", { commandId: p.id }).catch(() => {
        });
    };
  }, [t]);
  const y = _((A) => {
    l.current = A;
  }, []), N = _(() => {
    t.invoke({ commandId: P.refreshView, source: "api" }).catch((C) => {
      c(ke(C));
    });
  }, [t]);
  return { phase: e, errorCode: r, lastInvoked: u, setActions: y, invokeRefresh: N };
}
const Ut = "chips.official.notes", Vt = () => {
  const { token: t } = me.useToken(), { message: e } = Ne.useApp(), n = Rt(), { phase: r, errorCode: c, setActions: u, invokeRefresh: f } = Lt(), { feedback: l, status: y, openSource: N, refreshCurrent: A } = n, C = de(
    () => ({
      openCard: (p) => {
        N(p);
      },
      refreshView: () => {
        A();
      }
    }),
    [N, A]
  );
  return te(() => (u(C), () => {
    u(null);
  }), [C, u]), te(() => {
    l !== null && y !== "error" && e.info(l);
  }, [l, y, e]), /* @__PURE__ */ m(L, { style: { height: "100%", background: t.colorBgLayout }, children: [
    /* @__PURE__ */ m(
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
          /* @__PURE__ */ o(g.Text, { strong: !0, children: "笔记库" }),
          /* @__PURE__ */ o(Ze, { onOpen: (p) => {
            n.openSource(p);
          }, busy: y === "opening" }),
          l !== null && y === "error" ? /* @__PURE__ */ o(le, { type: "error", showIcon: !0, message: l }) : null,
          r === "error" && c !== null ? /* @__PURE__ */ o(le, { type: "warning", showIcon: !0, message: `命令通道异常（${c}）` }) : null,
          /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflow: "auto" }, children: /* @__PURE__ */ o(
            Qe,
            {
              library: n.library,
              selectedId: n.selectedId,
              onSelect: (p) => {
                n.select(p);
              }
            }
          ) }),
          /* @__PURE__ */ m(g.Text, { type: "secondary", children: [
            "命令注册状态：",
            Mt[r]
          ] })
        ]
      }
    ),
    /* @__PURE__ */ o("main", { style: { flex: 1, minWidth: 0, padding: t.padding, background: t.colorBgContainer, overflow: "auto" }, children: /* @__PURE__ */ m(L, { vertical: !0, gap: t.marginSM, children: [
      /* @__PURE__ */ m(L, { justify: "space-between", align: "center", children: [
        /* @__PURE__ */ o(g.Title, { level: 4, style: { margin: 0 }, children: "笔记工作台" }),
        /* @__PURE__ */ o(K, { onClick: f, children: "刷新当前视图" })
      ] }),
      /* @__PURE__ */ o(
        tt,
        {
          summary: n.selected,
          detail: n.detail,
          nodeContents: n.nodeContents,
          onLoadNodeContent: (p) => {
            n.loadNodeContent(p);
          },
          revision: n.revision,
          savedDigest: n.savedDigest,
          writeError: n.writeError,
          pendingChange: n.pendingChange,
          commitBusy: n.commitBusy,
          saveBusy: n.saveBusy,
          onStageRename: n.stageRename,
          onStageDescription: n.stageDescription,
          onStageNodeContent: n.stageNodeContent,
          onDiscardEdits: n.discardEdits,
          onCommitEdits: () => {
            n.commitPending();
          },
          onSaveToDisk: () => {
            n.saveToDisk();
          }
        }
      )
    ] }) })
  ] });
}, Wt = () => /* @__PURE__ */ o(We, { appId: Ut, surface: "window", children: /* @__PURE__ */ o(Ke, { children: /* @__PURE__ */ o(Ne, { children: /* @__PURE__ */ o(Vt, {}) }) }) });
export {
  Wt as AppView,
  Wt as default
};
