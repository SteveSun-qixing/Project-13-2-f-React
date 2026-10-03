import { jsxs as ut, jsx as Me } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { useCommandRuntime as jm, theme as ms, Input as fu, Button as Ji, BoxEmptyState as Sh, ChipsProvider as Vm, CommandProvider as Wm, PanelHeader as Hm, Tabs as Um } from "chips-resource://platform/vendor/chips-ui.js";
import { useState as _t, useEffect as vh, useCallback as Eo, useMemo as zs, useRef as qm } from "chips-resource://platform/vendor/react.js";
class En extends Error {
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
    return new En({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function Km(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const Jm = "SDK_BRIDGE_UNAVAILABLE", du = "SDK_UNKNOWN_ERROR", pu = "发生未知错误";
function Gm(t) {
  return t instanceof Error;
}
function Zm(t) {
  if (t instanceof En)
    return t;
  if (Km(t)) {
    const e = t, n = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new En(n);
  }
  return Gm(t) ? new En({
    code: du,
    message: pu,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new En({
    code: du,
    message: pu,
    details: { value: String(t) },
    retryable: !1
  });
}
function Ym() {
  return new En({
    code: Jm,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function yt(t, e, n) {
  let r;
  try {
    r = t();
  } catch (i) {
    return Promise.reject(Zm(i));
  }
  return r.request(e, n);
}
const Xm = "cli.command.list", Qm = "cli.command.get", eg = "cli.command.resolve";
function tg(t) {
  return {
    list(e) {
      return yt(t, Xm, e ?? {});
    },
    get(e) {
      return yt(t, Qm, e);
    },
    resolve(e) {
      return yt(t, eg, e);
    }
  };
}
const xr = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, ng = "cli.task.create", rg = "cli.task.bindInvocation", ig = "cli.task.cancel";
function sg(t) {
  return {
    create(e) {
      return yt(t, ng, e).then((n) => n.task);
    },
    bindInvocation(e) {
      return yt(t, rg, e).then((n) => n.task);
    },
    get(e) {
      const n = { taskId: e };
      return yt(t, xr.CLI_TASK_GET, n).then((r) => r.task);
    },
    active(e) {
      const n = { commandId: e };
      return yt(t, xr.CLI_TASK_ACTIVE, n).then((r) => r.task);
    },
    progress(e, n) {
      const r = { taskId: e, progress: n };
      return yt(t, xr.CLI_TASK_PROGRESS, r).then((i) => i.task);
    },
    complete(e, n) {
      const r = {
        taskId: e,
        ...n === void 0 ? {} : { output: n }
      };
      return yt(t, xr.CLI_TASK_COMPLETE, r).then((i) => i.task);
    },
    fail(e, n) {
      const r = { taskId: e, error: n };
      return yt(t, xr.CLI_TASK_FAIL, r).then((i) => i.task);
    },
    cancel(e) {
      return yt(t, ig, { taskId: e }).then((n) => n.task);
    }
  };
}
function og() {
  return globalThis.window?.chips;
}
class lg {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = tg(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = sg(() => this.#e());
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
    const e = og();
    if (e === void 0)
      throw Ym();
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
    return yt(() => this.#e(), e, n);
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
function ag(t) {
  return new lg(t?.bridge);
}
const Mo = ag(), mu = "chips.official.office", Hr = {
  openCard: "office:open-card",
  refreshView: "office:refresh-view"
}, gu = {
  openCard: "open-card",
  refreshView: "refresh-view"
}, Oo = [
  {
    id: Hr.openCard,
    title: "打开卡片",
    description: "打开指定的卡片文件并在主窗口中展示",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: mu },
    handlerId: gu.openCard,
    keywords: ["open", "card", "打开", "卡片"],
    group: "文件"
  },
  {
    id: Hr.refreshView,
    title: "刷新当前视图",
    description: "重新拉取当前展示数据",
    shortcut: "F5",
    scope: { kind: "app", appId: mu },
    handlerId: gu.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  }
];
new Set(Object.values(Hr));
function ug(t) {
  return Oo.map((e) => {
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
const cg = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function yu(t) {
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function hg() {
  const t = jm(), [e, n] = _t("registering"), [r, i] = _t(null), [s, o] = _t(null);
  vh(() => {
    let a = !1, u = null;
    return n("registering"), i(null), (async () => {
      try {
        for (const c of Oo)
          await Mo.request("command:register", { definition: c });
        if (a)
          return;
        u = t.attach(ug(o)), n("ready");
      } catch (c) {
        a || (i(yu(c)), n("error"));
      }
    })(), () => {
      a = !0, u?.dispose();
      for (const c of Oo)
        Mo.request("command:unregister", { commandId: c.id }).catch(() => {
        });
    };
  }, [t]);
  const l = Eo(
    async (a, u) => {
      try {
        u === void 0 ? await t.invoke({ commandId: a, source: "api" }) : await t.invoke({ commandId: a, payload: u, source: "api" }), i(null);
      } catch (c) {
        i(yu(c));
      }
    },
    [t]
  );
  return {
    phase: e,
    errorCode: r,
    lastInvoked: s,
    invokeOpenCard: (a) => l(Hr.openCard, { path: a }),
    invokeRefreshView: () => l(Hr.refreshView)
  };
}
function fg() {
  return {
    blocks: [{ kind: "paragraph", styleId: null, alignment: null, runs: [] }],
    section: null
  };
}
function dg(t) {
  return t.kind === "table" ? t.rows.map((e) => e.cells.map((n) => n.runs.map((r) => r.text).join("")).join("")).join("") : t.runs.map((e) => e.text).join("");
}
function pg(t) {
  return t.blocks.map((e) => dg(e)).filter((e) => e.length > 0).join(`
`);
}
const mg = [
  "Heading1",
  "Heading2",
  "Heading3",
  "Heading4",
  "Heading5",
  "Heading6"
], gg = "Title", Nl = "Quote", Gi = "HTMLPreformatted", Nh = "ListParagraph";
function Ih(t) {
  if (t === null)
    return null;
  const e = mg.indexOf(t);
  if (e >= 0)
    return e + 1;
  const n = /^heading ([1-6])$/i.exec(t);
  return n ? Number(n[1]) : null;
}
function yg(t) {
  return `Heading${t}`;
}
function kg(t) {
  return Ih(t) !== null;
}
function wg(t) {
  return t === null ? "normal" : t === gg ? "title" : kg(t) ? "heading" : t === Nl ? "quote" : t === Gi ? "code" : t === Nh ? "list" : t === "Normal" ? "normal" : "other";
}
function _h(t) {
  switch (t) {
    case "left":
    case "start":
      return "left";
    case "center":
      return "center";
    case "right":
    case "end":
      return "right";
    case "both":
    case "justify":
      return "both";
    default:
      return null;
  }
}
function bg(t) {
  switch (t) {
    case "left":
      return "left";
    case "center":
      return "center";
    case "right":
      return "right";
    case "both":
      return "both";
    default:
      return null;
  }
}
function xg(t) {
  return t === "bullet" || t === "none" ? "bullet" : "ordered";
}
const Cg = /[\\`*_[\]<>~#|]/g, Sg = /^<p style="text-align: (center|right)">(.*)<\/p>$/;
function Th(t) {
  return t.replace(Cg, (e) => `\\${e}`);
}
function vg(t) {
  return t.replace(/\\([\\`*_[\]<>~#|])/g, "$1");
}
function Ng(t) {
  return Th(t);
}
function Oi(t, e) {
  let n = "";
  for (const r of t) {
    if (r.href === null && r.marks.includes("code")) {
      n += `\`${r.text}\``;
      continue;
    }
    let s = e ? Ng(r.text) : Th(r.text);
    r.marks.includes("strike") && (s = `~~${s}~~`), r.marks.includes("italic") && (s = `*${s}*`), r.marks.includes("bold") && (s = `**${s}**`), r.href !== null ? n += `[${s}](${r.href})` : r.marks.includes("underline") ? n += `<u>${s}</u>` : n += s;
  }
  return n;
}
function Ah(t, e, n, r) {
  if (e.length === 0)
    return;
  const i = t.runs[t.runs.length - 1];
  if (i !== void 0 && i.href === r && i.marks.length === n.length && i.marks.every((s, o) => n[o] === s)) {
    t.runs[t.runs.length - 1] = { text: i.text + e, marks: i.marks, href: i.href };
    return;
  }
  t.runs.push({ text: e, marks: [...n], href: r });
}
function Ue(t, e, n, r) {
  const i = /\*\*\*([^*]+)\*\*\*/, s = /\*\*([^*]+)\*\*/, o = /\*([^*]+)\*/, l = /~~([^~]+)~~/;
  let a;
  if ((a = i.exec(e)) !== null) {
    Ue(t, e.slice(0, a.index), n, r), Ue(t, a[1] ?? "", [...n, "bold", "italic"], r), Ue(t, e.slice(a.index + a[0].length), n, r);
    return;
  }
  if ((a = s.exec(e)) !== null) {
    Ue(t, e.slice(0, a.index), n, r), Ue(t, a[1] ?? "", [...n, "bold"], r), Ue(t, e.slice(a.index + a[0].length), n, r);
    return;
  }
  if ((a = o.exec(e)) !== null) {
    Ue(t, e.slice(0, a.index), n, r), Ue(t, a[1] ?? "", [...n, "italic"], r), Ue(t, e.slice(a.index + a[0].length), n, r);
    return;
  }
  if ((a = l.exec(e)) !== null) {
    Ue(t, e.slice(0, a.index), n, r), Ue(t, a[1] ?? "", [...n, "strike"], r), Ue(t, e.slice(a.index + a[0].length), n, r);
    return;
  }
  Ah(t, vg(e), n, r);
}
function rn(t) {
  const e = { runs: [] }, n = /\[([^\]]+)\]\(([^)]+)\)/, r = /`([^`]+)`/, i = /<u>([^<]*)<\/u>/;
  let s = t;
  for (; s.length > 0; ) {
    const o = n.exec(s), l = r.exec(s), a = i.exec(s), u = [o, l, a].filter(
      (h) => h !== null
    );
    if (u.length === 0) {
      Ue(e, s, [], null);
      break;
    }
    const c = u.reduce((h, d) => d.index < h.index ? d : h);
    Ue(e, s.slice(0, c.index), [], null), c === o ? Ue(e, c[1] ?? "", ["underline"], c[2] ?? "") : c === l ? Ah(e, c[1] ?? "", ["code"], null) : Ue(e, c[1] ?? "", ["underline"], null), s = s.slice(c.index + c[0].length);
  }
  return e.runs;
}
function Ig(t) {
  return Oi(t.runs, !0);
}
function ku(t) {
  return t === "left" ? ":---" : t === "right" ? "---:" : t === "center" ? ":---:" : "---";
}
function _g(t, e, n) {
  const r = "  ".repeat(e);
  return t === "bullet" ? `${r}- ` : `${r}${n}. `;
}
function Tg(t) {
  const e = [];
  let n = [];
  const r = () => {
    n.length > 0 && (e.push(["```", ...n, "```"].join(`
`)), n = []);
  };
  let i = null;
  const s = () => {
    i !== null && (e.push(i.items.join(`
`)), i = null);
  };
  for (const o of t.blocks) {
    if (o.kind === "paragraph" && o.styleId === Gi) {
      s(), n.push(o.runs.map((a) => a.text).join(""));
      continue;
    }
    if (r(), o.kind === "heading") {
      s(), e.push(`${"#".repeat(o.level)} ${Oi(o.runs, !1)}`);
      continue;
    }
    if (o.kind === "listItem") {
      const a = i;
      (a === null || a.kind !== o.list.kind) && (s(), i = { kind: o.list.kind, items: [] });
      const u = i;
      if (u !== null) {
        const c = u.kind === "ordered" ? u.items.length + 1 : 0;
        u.items.push(
          `${_g(o.list.kind, o.list.level, c)}${Oi(o.runs, !1)}`
        );
      }
      continue;
    }
    if (s(), o.kind === "table") {
      const a = o.rows[0];
      if (a === void 0)
        continue;
      const u = (h) => `| ${h.map(Ig).join(" | ")} |`, c = [u(a.cells)];
      a.header ? c.push(`| ${a.cells.map((h) => ku(h.alignment)).join(" | ")} |`) : c.push(`| ${a.cells.map(() => ku(null)).join(" | ")} |`), e.push([...c, ...o.rows.slice(1).map((h) => u(h.cells))].join(`
`));
      continue;
    }
    const l = Oi(o.runs, !1);
    if (o.styleId !== null && wg(o.styleId) === "title") {
      e.push(`# ${l}`);
      continue;
    }
    if (o.styleId === Nl) {
      e.push(`> ${l}`);
      continue;
    }
    if ((o.alignment === "center" || o.alignment === "right") && o.styleId !== Gi) {
      e.push(`<p style="text-align: ${o.alignment}">${l}</p>`);
      continue;
    }
    e.push(l);
  }
  return r(), s(), e.join(`

`).replace(/\n+$/g, "");
}
function wu(t) {
  if (t.trim().length === 0)
    return fg();
  const e = [], n = t.replace(/\r\n?/g, `
`).split(`
`);
  let r = null, i = null, s = 0;
  const o = () => {
    if (r !== null) {
      for (const a of r)
        e.push({ kind: "paragraph", styleId: Gi, alignment: null, runs: [{ text: a, marks: [], href: null }] });
      r = null;
    }
  }, l = () => {
    i = null;
  };
  for (let a = 0; a < n.length; a += 1) {
    const u = n[a] ?? "", c = /^\s*(```|~~~)/.exec(u);
    if (r !== null) {
      c !== null ? o() : r.push(u);
      continue;
    }
    if (c !== null) {
      l(), r = [];
      continue;
    }
    if (u.trim().length === 0) {
      l();
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(u);
    if (h !== null) {
      l();
      const y = h[1]?.length ?? 1;
      e.push({
        kind: "heading",
        level: y,
        styleId: yg(y),
        alignment: null,
        runs: rn(h[2] ?? "")
      });
      continue;
    }
    const d = /^>\s?(.*)$/.exec(u);
    if (d !== null) {
      l(), e.push({ kind: "paragraph", styleId: Nl, alignment: null, runs: rn(d[1] ?? "") });
      continue;
    }
    const f = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(u);
    if (f !== null) {
      const y = f[2] !== void 0 && /\d+\./.test(f[2]) ? "ordered" : "bullet";
      (i === null || i.kind !== y) && (s += 1, i = { kind: y, numId: s });
      const g = Math.floor((f[1]?.length ?? 0) / 2);
      e.push({
        kind: "listItem",
        styleId: Nh,
        alignment: null,
        list: { kind: y, numId: i.numId, level: g },
        runs: rn(f[3] ?? "")
      });
      continue;
    }
    const p = /^\|(.+)\|\s*$/.exec(u);
    if (p !== null) {
      l();
      const y = (O) => O.split(/(?<!\\)\|/).map((T) => T.trim()).filter((T, V, S) => !(T.length === 0 && (V === 0 || V === S.length - 1)));
      if (/^\|[\s:|-]+\|\s*$/.test(u))
        continue;
      const b = n[a + 1];
      if (!(b !== void 0 && /^\|[\s:|-]+\|\s*$/.test(b))) {
        e.push({ kind: "paragraph", styleId: null, alignment: null, runs: rn(u) });
        continue;
      }
      const A = y(p[1] ?? ""), E = y(b ?? ""), M = [{ header: !0, cells: A.map((O, T) => ({
        alignment: _h(Ag(E[T] ?? "")),
        runs: rn(O)
      })) }];
      let R = a + 2;
      for (; R < n.length; ) {
        const O = n[R] ?? "", T = /^\|(.+)\|\s*$/.exec(O);
        if (T === null || /^\|[\s:|-]+\|\s*$/.test(O))
          break;
        const V = y(T[1] ?? "");
        M.push({
          header: !1,
          cells: V.map((S) => ({ alignment: null, runs: rn(S) }))
        }), R += 1;
      }
      e.push({ kind: "table", rows: M, columnWidthsTwips: null }), a = R - 1;
      continue;
    }
    const m = Sg.exec(u);
    if (m !== null) {
      l(), e.push({
        kind: "paragraph",
        styleId: null,
        alignment: m[1] === "center" ? "center" : "right",
        runs: rn(m[2] ?? "")
      });
      continue;
    }
    l(), e.push({ kind: "paragraph", styleId: null, alignment: null, runs: rn(u) });
  }
  return o(), { blocks: e, section: null };
}
function Ag(t) {
  return t === ":---" ? "left" : t === "---:" ? "right" : t === ":---:" ? "center" : null;
}
const Eg = /[ᄀ-ᇿ⺀-⿟、-〿぀-ヿ㄀-ㄯ㄰-㆏㇀-ㇿ㐀-䶿一-鿿가-힯豈-﫿！-｠￠-￦]|[\uD840-\uD87F][\uDC00-\uDFFF]/g, Mg = /[A-Za-z0-9À-ɏ]+(?:['-][A-Za-z0-9À-ɏ]+)*/g;
function Og(t) {
  return (t.match(Eg) ?? []).length;
}
function Dg(t) {
  return (t.match(Mg) ?? []).length;
}
function Rg(t) {
  return Og(t) + Dg(t);
}
function zg(t) {
  const e = pg(t);
  return {
    words: Rg(e),
    characters: Array.from(e).length
  };
}
var St = /* @__PURE__ */ (function(t) {
  return t.docTypeError = "docTypeError", t.contextNotFound = "contextNotFound", t.timerNotFound = "timerNotFound", t.ctxCallOutOfScope = "ctxCallOutOfScope", t.createNodeInParserFail = "createNodeInParserFail", t.stackOverFlow = "stackOverFlow", t.parserMatchError = "parserMatchError", t.serializerMatchError = "serializerMatchError", t.getAtomFromSchemaFail = "getAtomFromSchemaFail", t.expectDomTypeError = "expectDomTypeError", t.callCommandBeforeEditorView = "callCommandBeforeEditorView", t.missingRootElement = "missingRootElement", t.missingNodeInSchema = "missingNodeInSchema", t.missingMarkInSchema = "missingMarkInSchema", t.ctxNotBind = "ctxNotBind", t.missingYjsDoc = "missingYjsDoc", t.aiProviderError = "aiProviderError", t.aiBuildContextError = "aiBuildContextError", t;
})({}), vt = class extends Error {
  constructor(t, e, n) {
    super(e, n), this.name = "MilkdownError", this.code = t, n?.cause !== void 0 && (this.cause = n.cause);
  }
}, Pg = (t, e) => typeof e == "function" ? "[Function]" : e, gs = (t) => JSON.stringify(t, Pg);
function Lg(t) {
  return new vt(St.docTypeError, `Doc type error, unsupported type: ${gs(t)}`);
}
function Bg(t) {
  return new vt(St.contextNotFound, `Context "${t}" not found, do you forget to inject it?`);
}
function Fg(t) {
  return new vt(St.timerNotFound, `Timer "${t}" not found, do you forget to record it?`);
}
function ys() {
  return new vt(St.ctxCallOutOfScope, "Should not call a context out of the plugin.");
}
function $g(t, e, n) {
  const r = `Cannot create node for ${"name" in t ? t.name : t}`, i = (o) => {
    if (o == null) return "null";
    if (Array.isArray(o)) return `[${o.map(i).join(", ")}]`;
    if (typeof o == "object")
      return "toJSON" in o && typeof o.toJSON == "function" ? JSON.stringify(o.toJSON()) : "spec" in o ? JSON.stringify(o.spec) : JSON.stringify(o);
    if (typeof o == "string" || typeof o == "number" || typeof o == "boolean") return JSON.stringify(o);
    if (typeof o == "function") return `[Function: ${o.name || "anonymous"}]`;
    try {
      return String(o);
    } catch {
      return "[Unserializable]";
    }
  }, s = [
    ["[Description]", r],
    ["[Attributes]", e],
    ["[Content]", (n ?? []).map((o) => o ? typeof o == "object" && "type" in o ? `${o}` : i(o) : "null")]
  ].reduce((o, [l, a]) => {
    const u = `${l}: ${i(a)}.`;
    return o.concat(u);
  }, []);
  return new vt(St.createNodeInParserFail, s.join(`
`));
}
function Eh() {
  return new vt(St.stackOverFlow, "Stack over flow, cannot pop on an empty stack.");
}
function jg(t) {
  return new vt(St.parserMatchError, `Cannot match target parser for node: ${gs(t)}.`);
}
function Vg(t) {
  return new vt(St.serializerMatchError, `Cannot match target serializer for node: ${gs(t)}.`);
}
function Bt(t) {
  return new vt(St.expectDomTypeError, `Expect to be a dom, but get: ${gs(t)}.`);
}
function Ps() {
  return new vt(St.callCommandBeforeEditorView, "You're trying to call a command before editor view initialized, make sure to get commandManager from ctx after editor view has been initialized");
}
function Wg(t) {
  return new vt(St.missingNodeInSchema, `Missing node in schema, milkdown cannot find "${t}" in schema.`);
}
function Hg(t) {
  return new vt(St.missingMarkInSchema, `Missing mark in schema, milkdown cannot find "${t}" in schema.`);
}
var Mh = class {
  constructor() {
    this.sliceMap = /* @__PURE__ */ new Map(), this.get = (t) => {
      const e = typeof t == "string" ? [...this.sliceMap.values()].find((n) => n.type.name === t) : this.sliceMap.get(t.id);
      if (!e) {
        const n = typeof t == "string" ? t : t.name;
        throw Bg(n);
      }
      return e;
    }, this.remove = (t) => {
      const e = typeof t == "string" ? [...this.sliceMap.values()].find((n) => n.type.name === t) : this.sliceMap.get(t.id);
      e && this.sliceMap.delete(e.type.id);
    }, this.has = (t) => typeof t == "string" ? [...this.sliceMap.values()].some((e) => e.type.name === t) : this.sliceMap.has(t.id);
  }
}, Ug = class {
  #t;
  #e;
  #r;
  constructor(e, n, r) {
    this.#t = [], this.#r = () => {
      this.#t.forEach((i) => i(this.#e));
    }, this.set = (i) => {
      this.#e = i, this.#r();
    }, this.get = () => this.#e, this.update = (i) => {
      this.#e = i(this.#e), this.#r();
    }, this.type = r, this.#e = n, e.set(r.id, this);
  }
  on(e) {
    return this.#t.push(e), () => {
      this.#t = this.#t.filter((n) => n !== e);
    };
  }
  once(e) {
    const n = this.on((r) => {
      e(r), n();
    });
    return n;
  }
  off(e) {
    this.#t = this.#t.filter((n) => n !== e);
  }
  offAll() {
    this.#t = [];
  }
}, qg = class {
  constructor(t, e) {
    this.id = /* @__PURE__ */ Symbol(`Context-${e}`), this.name = e, this._defaultValue = t, this._typeInfo = () => {
      throw ys();
    };
  }
  create(t, e = this._defaultValue) {
    return new Ug(t, e, this);
  }
}, ke = (t, e) => new qg(t, e), Kg = class {
  #t;
  #e;
  #r;
  #n;
  #s;
  #o;
  #i;
  constructor(t, e, n) {
    this.#n = /* @__PURE__ */ new Set(), this.#s = /* @__PURE__ */ new Set(), this.#o = /* @__PURE__ */ new Map(), this.#i = /* @__PURE__ */ new Map(), this.read = () => ({
      metadata: this.#t,
      injectedSlices: [...this.#n].map((r) => ({
        name: typeof r == "string" ? r : r.name,
        value: this.#l(r)
      })),
      consumedSlices: [...this.#s].map((r) => ({
        name: typeof r == "string" ? r : r.name,
        value: this.#l(r)
      })),
      recordedTimers: [...this.#o].map(([r, { duration: i }]) => ({
        name: r.name,
        duration: i,
        status: this.#a(r)
      })),
      waitTimers: [...this.#i].map(([r, { duration: i }]) => ({
        name: r.name,
        duration: i,
        status: this.#a(r)
      }))
    }), this.onRecord = (r) => {
      this.#o.set(r, {
        start: Date.now(),
        duration: 0
      });
    }, this.onClear = (r) => {
      this.#o.delete(r);
    }, this.onDone = (r) => {
      const i = this.#o.get(r);
      i && (i.duration = Date.now() - i.start);
    }, this.onWait = (r, i) => {
      const s = Date.now();
      i.finally(() => {
        this.#i.set(r, { duration: Date.now() - s });
      }).catch(console.error);
    }, this.onInject = (r) => {
      this.#n.add(r);
    }, this.onRemove = (r) => {
      this.#n.delete(r);
    }, this.onUse = (r) => {
      this.#s.add(r);
    }, this.#l = (r) => this.#e.get(r).get(), this.#a = (r) => this.#r.get(r).status, this.#e = t, this.#r = e, this.#t = n;
  }
  #l;
  #a;
}, Jg = class Oh {
  #t;
  #e;
  #r;
  #n;
  constructor(e, n, r) {
    this.produce = (i) => i && Object.keys(i).length ? new Oh(this.#t, this.#e, { ...i }) : this, this.inject = (i, s) => {
      const o = i.create(this.#t.sliceMap);
      return s != null && o.set(s), this.#n?.onInject(i), this;
    }, this.remove = (i) => (this.#t.remove(i), this.#n?.onRemove(i), this), this.record = (i) => (i.create(this.#e.store), this.#n?.onRecord(i), this), this.clearTimer = (i) => (this.#e.remove(i), this.#n?.onClear(i), this), this.isInjected = (i) => this.#t.has(i), this.isRecorded = (i) => this.#e.has(i), this.use = (i) => (this.#n?.onUse(i), this.#t.get(i)), this.get = (i) => this.use(i).get(), this.set = (i, s) => this.use(i).set(s), this.update = (i, s) => this.use(i).update(s), this.timer = (i) => this.#e.get(i), this.done = (i) => {
      this.timer(i).done(), this.#n?.onDone(i);
    }, this.wait = (i) => {
      const s = this.timer(i).start();
      return this.#n?.onWait(i, s), s;
    }, this.waitTimers = async (i) => {
      await Promise.all(this.get(i).map((s) => this.wait(s)));
    }, this.#t = e, this.#e = n, this.#r = r, r && (this.#n = new Kg(e, n, r));
  }
  get meta() {
    return this.#r;
  }
  get inspector() {
    return this.#n;
  }
}, Gg = class {
  constructor() {
    this.store = /* @__PURE__ */ new Map(), this.get = (t) => {
      const e = this.store.get(t.id);
      if (!e) throw Fg(t.name);
      return e;
    }, this.remove = (t) => {
      this.store.delete(t.id);
    }, this.has = (t) => this.store.has(t.id);
  }
}, Zg = class {
  #t;
  #e;
  #r;
  #n;
  #s;
  constructor(t, e) {
    this.#t = null, this.#e = null, this.#n = "pending", this.#s = null, this.start = () => (this.#t ??= new Promise((n, r) => {
      this.#e = (i) => {
        i instanceof CustomEvent && i.detail.id === this.#r && (this.#n = "resolved", this.#o(), i.stopImmediatePropagation(), n());
      }, this.#i(() => {
        this.#n === "pending" && (this.#n = "rejected"), this.#o(), r(/* @__PURE__ */ new Error(`Timing ${this.type.name} timeout.`));
      }), this.#n = "pending", addEventListener(this.type.name, this.#e);
    }), this.#t), this.done = () => {
      const n = new CustomEvent(this.type.name, { detail: { id: this.#r } });
      dispatchEvent(n);
    }, this.#o = () => {
      this.#s !== null && (clearTimeout(this.#s), this.#s = null), this.#e && removeEventListener(this.type.name, this.#e);
    }, this.#i = (n) => {
      this.#s = setTimeout(() => {
        this.#s = null, n();
      }, this.type.timeout);
    }, this.#r = Symbol(e.name), this.type = e, t.set(e.id, this);
  }
  get status() {
    return this.#n;
  }
  #o;
  #i;
}, Yg = class {
  constructor(t, e = 3e3) {
    this.create = (n) => new Zg(n, this), this.id = /* @__PURE__ */ Symbol(`Timer-${t}`), this.name = t, this.timeout = e;
  }
}, Ft = (t, e = 3e3) => new Yg(t, e);
const Xg = {};
function Il(t, e) {
  const n = Xg, r = typeof n.includeImageAlt == "boolean" ? n.includeImageAlt : !0, i = typeof n.includeHtml == "boolean" ? n.includeHtml : !0;
  return Dh(t, r, i);
}
function Dh(t, e, n) {
  if (Qg(t)) {
    if ("value" in t)
      return t.type === "html" && !n ? "" : t.value;
    if (e && "alt" in t && t.alt)
      return t.alt;
    if ("children" in t)
      return bu(t.children, e, n);
  }
  return Array.isArray(t) ? bu(t, e, n) : "";
}
function bu(t, e, n) {
  const r = [];
  let i = -1;
  for (; ++i < t.length; )
    r[i] = Dh(t[i], e, n);
  return r.join("");
}
function Qg(t) {
  return !!(t && typeof t == "object");
}
const xu = document.createElement("i");
function _l(t) {
  const e = "&" + t + ";";
  xu.innerHTML = e;
  const n = xu.textContent;
  return n.charCodeAt(n.length - 1) === 59 && t !== "semi" || n === e ? !1 : n;
}
function Tt(t, e, n, r) {
  const i = t.length;
  let s = 0, o;
  if (e < 0 ? e = -e > i ? 0 : i + e : e = e > i ? i : e, n = n > 0 ? n : 0, r.length < 1e4)
    o = Array.from(r), o.unshift(e, n), t.splice(...o);
  else
    for (n && t.splice(e, n); s < r.length; )
      o = r.slice(s, s + 1e4), o.unshift(e, 0), t.splice(...o), s += 1e4, e += 1e4;
}
function wt(t, e) {
  return t.length > 0 ? (Tt(t, t.length, 0, e), t) : e;
}
const Cu = {}.hasOwnProperty;
function Rh(t) {
  const e = {};
  let n = -1;
  for (; ++n < t.length; )
    ey(e, t[n]);
  return e;
}
function ey(t, e) {
  let n;
  for (n in e) {
    const i = (Cu.call(t, n) ? t[n] : void 0) || (t[n] = {}), s = e[n];
    let o;
    if (s)
      for (o in s) {
        Cu.call(i, o) || (i[o] = []);
        const l = s[o];
        ty(
          // @ts-expect-error Looks like a list.
          i[o],
          Array.isArray(l) ? l : l ? [l] : []
        );
      }
  }
}
function ty(t, e) {
  let n = -1;
  const r = [];
  for (; ++n < e.length; )
    (e[n].add === "after" ? t : r).push(e[n]);
  Tt(t, 0, 0, r);
}
function zh(t, e) {
  const n = Number.parseInt(t, e);
  return (
    // C0 except for HT, LF, FF, CR, space.
    n < 9 || n === 11 || n > 13 && n < 32 || // Control character (DEL) of C0, and C1 controls.
    n > 126 && n < 160 || // Lone high surrogates and low surrogates.
    n > 55295 && n < 57344 || // Noncharacters.
    n > 64975 && n < 65008 || /* eslint-disable no-bitwise */
    (n & 65535) === 65535 || (n & 65535) === 65534 || /* eslint-enable no-bitwise */
    // Out of range
    n > 1114111 ? "�" : String.fromCodePoint(n)
  );
}
function At(t) {
  return t.replace(/[\t\n\r ]+/g, " ").replace(/^ | $/g, "").toLowerCase().toUpperCase();
}
const Ve = Cn(/[A-Za-z]/), Ye = Cn(/[\dA-Za-z]/), ny = Cn(/[#-'*+\--9=?A-Z^-~]/);
function Zi(t) {
  return (
    // Special whitespace codes (which have negative values), C0 and Control
    // character DEL
    t !== null && (t < 32 || t === 127)
  );
}
const Do = Cn(/\d/), ry = Cn(/[\dA-Fa-f]/), Ph = Cn(/[!-/:-@[-`{-~]/);
function oe(t) {
  return t !== null && t < -2;
}
function Ne(t) {
  return t !== null && (t < 0 || t === 32);
}
function ge(t) {
  return t === -2 || t === -1 || t === 32;
}
const ks = Cn(new RegExp("\\p{P}|\\p{S}", "u")), $n = Cn(/\s/);
function Cn(t) {
  return e;
  function e(n) {
    return n !== null && n > -1 && t.test(String.fromCharCode(n));
  }
}
function xe(t, e, n, r) {
  const i = r ? r - 1 : 1 / 0;
  let s = 0;
  return o;
  function o(a) {
    return ge(a) ? (t.enter(n), l(a)) : e(a);
  }
  function l(a) {
    return ge(a) && s++ < i ? (t.consume(a), l) : (t.exit(n), e(a));
  }
}
function Lh(t, e, n, r, i, s) {
  let o = 0;
  return l;
  function l(c) {
    return ge(c) ? (t.enter(r), a(c)) : u(c);
  }
  function a(c) {
    return ge(c) && o < s ? (t.consume(c), o++, a) : (t.exit(r), u(c));
  }
  function u(c) {
    return o >= i ? e(c) : n(c);
  }
}
const iy = {
  tokenize: sy
};
function sy(t) {
  const e = t.attempt(this.parser.constructs.contentInitial, r, i);
  let n;
  return e;
  function r(l) {
    if (l === null) {
      t.consume(l);
      return;
    }
    return t.enter("lineEnding"), t.consume(l), t.exit("lineEnding"), xe(t, e, "linePrefix");
  }
  function i(l) {
    return t.enter("paragraph"), s(l);
  }
  function s(l) {
    const a = t.enter("chunkText", {
      contentType: "text",
      previous: n
    });
    return n && (n.next = a), n = a, o(l);
  }
  function o(l) {
    if (l === null) {
      t.exit("chunkText"), t.exit("paragraph"), t.consume(l);
      return;
    }
    return oe(l) ? (t.consume(l), t.exit("chunkText"), s) : (t.consume(l), o);
  }
}
let Yi = class {
  /**
   * Create a new edit map.
   *
   * @returns
   *   New instance.
   */
  constructor() {
    this.index = /* @__PURE__ */ new Map(), this.map = [];
  }
  /**
   * Create an edit: a remove and/or add at a certain place.
   *
   * @param {number} index
   *   Index at which to apply the edit.
   * @param {number} remove
   *   Count of items to remove at the index.
   * @param {Array<Event>} add
   *   Items to add at the index.
   * @returns {undefined}
   *   Nothing.
   */
  add(e, n, r) {
    Su(this, e, n, r, !1);
  }
  /**
   * Create an edit: but insert `add` before existing additions, instead of
   * after them.
   *
   * @param {number} index
   *   Index at which to apply the edit.
   * @param {number} remove
   *   Count of items to remove at the index.
   * @param {Array<Event>} add
   *   Items to add at the index.
   * @returns {undefined}
   *   Nothing.
   */
  addBefore(e, n, r) {
    Su(this, e, n, r, !0);
  }
  /**
   * Done, change the events.
   *
   * @param {Array<Event>} events
   *   List of events to apply the edits to.
   * @returns {undefined}
   *   Nothing.
   */
  consume(e) {
    if (this.map.sort(function(s, o) {
      return s[0] - o[0];
    }), this.map.length === 0)
      return;
    let n = this.map.length;
    const r = [];
    for (; n > 0; )
      n -= 1, r.push(e.slice(this.map[n][0] + this.map[n][1]), this.map[n][2]), e.length = this.map[n][0];
    r.push(e.slice()), e.length = 0;
    let i = r.pop();
    for (; i; ) {
      for (const s of i)
        e.push(s);
      i = r.pop();
    }
    this.map.length = 0, this.index.clear();
  }
};
function Su(t, e, n, r, i) {
  if (n === 0 && r.length === 0)
    return;
  const s = t.index.get(e);
  if (s) {
    s[1] += n, i ? (r.push(...s[2]), s[2] = r) : s[2].push(...r);
    return;
  }
  const o = [e, n, r];
  t.map.push(o), t.index.set(e, o);
}
const oy = {
  tokenize: ly
}, vu = {
  tokenize: ay
};
function ly(t) {
  const e = this, n = [];
  let r = 0, i, s, o;
  return l;
  function l(x) {
    if (r < n.length) {
      const A = n[r];
      return e.containerState = A[1], t.attempt(A[0].continuation, a, u)(x);
    }
    return u(x);
  }
  function a(x) {
    if (r++, e.containerState._closeFlow) {
      e.containerState._closeFlow = void 0, i && b();
      const A = e.events.length;
      let E = A, v;
      for (; E--; )
        if (e.events[E][0] === "exit" && e.events[E][1].type === "chunkFlow") {
          v = e.events[E][1].end;
          break;
        }
      g(r);
      let M = A;
      for (; M < e.events.length; )
        e.events[M][1].end = {
          ...v
        }, M++;
      const R = new Yi();
      return R.add(E + 1, 0, e.events.slice(A)), R.add(A, M - A, []), R.consume(e.events), u(x);
    }
    return l(x);
  }
  function u(x) {
    if (r === n.length) {
      if (!i)
        return d(x);
      if (i.currentConstruct && i.currentConstruct.concrete)
        return p(x);
      e.interrupt = !!(i.currentConstruct && !i._gfmTableDynamicInterruptHack);
    }
    return e.containerState = {}, t.check(vu, c, h)(x);
  }
  function c(x) {
    return i && b(), g(r), d(x);
  }
  function h(x) {
    return e.parser.lazy[e.now().line] = r !== n.length, o = e.now().offset, p(x);
  }
  function d(x) {
    return e.containerState = {}, t.attempt(vu, f, p)(x);
  }
  function f(x) {
    return r++, n.push([e.currentConstruct, e.containerState]), d(x);
  }
  function p(x) {
    if (x === null) {
      i && b(), g(0), t.consume(x);
      return;
    }
    return i = i || e.parser.flow(e.now()), t.enter("chunkFlow", {
      _tokenizer: i,
      contentType: "flow",
      previous: s
    }), m(x);
  }
  function m(x) {
    if (x === null) {
      y(t.exit("chunkFlow"), !0), g(0), t.consume(x);
      return;
    }
    return oe(x) ? (t.consume(x), y(t.exit("chunkFlow")), r = 0, e.interrupt = void 0, l) : (t.consume(x), m);
  }
  function y(x, A) {
    const E = e.sliceStream(x);
    if (A && E.push(null), x.previous = s, s && (s.next = x), s = x, i.defineSkip(x.start), i.write(E), e.parser.lazy[x.start.line]) {
      let v = i.events.length;
      for (; v--; )
        if (
          // The token starts before the line ending…
          i.events[v][1].start.offset < o && // …and either is not ended yet…
          (!i.events[v][1].end || // …or ends after it.
          i.events[v][1].end.offset > o)
        )
          return;
      const M = e.events.length;
      let R = M, O, T;
      for (; R--; )
        if (e.events[R][0] === "exit" && e.events[R][1].type === "chunkFlow") {
          if (O) {
            T = e.events[R][1].end;
            break;
          }
          O = !0;
        }
      for (g(r), v = M; v < e.events.length; )
        e.events[v][1].end = {
          ...T
        }, v++;
      const V = new Yi();
      V.add(R + 1, 0, e.events.slice(M)), V.add(M, v - M, []), V.consume(e.events);
    }
  }
  function g(x) {
    let A = n.length;
    for (; A-- > x; ) {
      const E = n[A];
      e.containerState = E[1], E[0].exit.call(e, t);
    }
    n.length = x;
  }
  function b() {
    i.write([null]), s = void 0, i = void 0, e.containerState._closeFlow = void 0;
  }
}
function ay(t, e, n) {
  return xe(t, t.attempt(this.parser.constructs.document, e, n), "linePrefix", this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
}
function zt(t) {
  if (t === null || Ne(t) || $n(t))
    return 1;
  if (ks(t))
    return 2;
}
function ws(t, e, n) {
  const r = [];
  let i = -1;
  for (; ++i < t.length; ) {
    const s = t[i].resolveAll;
    s && !r.includes(s) && (e = s(e, n), r.push(s));
  }
  return e;
}
const Ro = {
  name: "attention",
  resolveAll: uy,
  tokenize: cy
};
function uy(t, e) {
  let n = -1, r;
  for (; ++n < t.length; )
    if (t[n][0] === "enter" && t[n][1].type === "attentionSequence" && t[n][1]._close) {
      let i = n;
      for (; i--; )
        if (t[i][0] === "exit" && t[i][1].type === "attentionSequence" && t[i][1]._open && // If the markers are the same:
        e.sliceSerialize(t[i][1]).charCodeAt(0) === e.sliceSerialize(t[n][1]).charCodeAt(0)) {
          if ((t[i][1]._close || t[n][1]._open) && (t[n][1].end.offset - t[n][1].start.offset) % 3 && !((t[i][1].end.offset - t[i][1].start.offset + t[n][1].end.offset - t[n][1].start.offset) % 3))
            continue;
          const s = t[i][1].end.offset - t[i][1].start.offset > 1 && t[n][1].end.offset - t[n][1].start.offset > 1 ? 2 : 1, o = {
            ...t[i][1].end
          }, l = {
            ...t[n][1].start
          };
          Nu(o, -s), Nu(l, s);
          const a = {
            type: s > 1 ? "strongSequence" : "emphasisSequence",
            start: o,
            end: {
              ...t[i][1].end
            }
          }, u = {
            type: s > 1 ? "strongSequence" : "emphasisSequence",
            start: {
              ...t[n][1].start
            },
            end: l
          }, c = {
            type: s > 1 ? "strongText" : "emphasisText",
            start: {
              ...t[i][1].end
            },
            end: {
              ...t[n][1].start
            }
          }, h = {
            type: s > 1 ? "strong" : "emphasis",
            start: {
              ...a.start
            },
            end: {
              ...u.end
            }
          };
          t[i][1].end = {
            ...a.start
          }, t[n][1].start = {
            ...u.end
          }, r = [], t[i][1].end.offset - t[i][1].start.offset && (r = wt(r, [["enter", t[i][1], e], ["exit", t[i][1], e]])), r = wt(r, [["enter", h, e], ["enter", a, e], ["exit", a, e], ["enter", c, e]]), r = wt(r, ws(e.parser.constructs.insideSpan.null, t.slice(i + 1, n), e)), r = wt(r, [["exit", c, e], ["enter", u, e], ["exit", u, e], ["exit", h, e]]);
          let d = 0;
          t[n][1].end.offset - t[n][1].start.offset && (d = 2, r = wt(r, [["enter", t[n][1], e], ["exit", t[n][1], e]])), Tt(t, i - 1, n - i + 3, r), n = i + r.length - d - 2;
          break;
        }
    }
  for (n = -1; ++n < t.length; )
    t[n][1].type === "attentionSequence" && (t[n][1].type = "data");
  return t;
}
function cy(t, e) {
  const n = this.parser.constructs.attentionMarkers.null, r = this.previous, i = zt(r);
  let s;
  return o;
  function o(a) {
    return s = a, t.enter("attentionSequence"), l(a);
  }
  function l(a) {
    if (a === s)
      return t.consume(a), l;
    const u = t.exit("attentionSequence"), c = zt(a), h = !c || c === 2 && i || n.includes(a) && a !== 42 && a !== 95, d = !i || i === 2 && c || n.includes(r) && r !== 42 && r !== 95;
    return u._open = !!(s === 42 ? h : h && (i || !d)), u._close = !!(s === 42 ? d : d && (c || !h)), e(a);
  }
}
function Nu(t, e) {
  t.column += e, t.offset += e, t._bufferIndex += e;
}
const hy = {
  name: "autolink",
  tokenize: fy
};
function fy(t, e, n) {
  let r = 0;
  return i;
  function i(f) {
    return t.enter("autolink"), t.enter("autolinkMarker"), t.consume(f), t.exit("autolinkMarker"), t.enter("autolinkProtocol"), s;
  }
  function s(f) {
    return Ve(f) ? (t.consume(f), o) : f === 64 ? n(f) : u(f);
  }
  function o(f) {
    return f === 43 || f === 45 || f === 46 || Ye(f) ? (r = 1, l(f)) : u(f);
  }
  function l(f) {
    return f === 58 ? (t.consume(f), r = 0, a) : (f === 43 || f === 45 || f === 46 || Ye(f)) && r++ < 32 ? (t.consume(f), l) : (r = 0, u(f));
  }
  function a(f) {
    return f === 62 ? (t.exit("autolinkProtocol"), t.enter("autolinkMarker"), t.consume(f), t.exit("autolinkMarker"), t.exit("autolink"), e) : f === null || f === 32 || f === 60 || Zi(f) ? n(f) : (t.consume(f), a);
  }
  function u(f) {
    return f === 64 ? (t.consume(f), c) : ny(f) ? (t.consume(f), u) : n(f);
  }
  function c(f) {
    return Ye(f) ? h(f) : n(f);
  }
  function h(f) {
    return f === 46 ? (t.consume(f), r = 0, c) : f === 62 ? (t.exit("autolinkProtocol").type = "autolinkEmail", t.enter("autolinkMarker"), t.consume(f), t.exit("autolinkMarker"), t.exit("autolink"), e) : d(f);
  }
  function d(f) {
    if ((f === 45 || Ye(f)) && r++ < 63) {
      const p = f === 45 ? d : h;
      return t.consume(f), p;
    }
    return n(f);
  }
}
const ni = {
  partial: !0,
  tokenize: dy
};
function dy(t, e, n) {
  return r;
  function r(s) {
    return ge(s) ? xe(t, i, "linePrefix")(s) : i(s);
  }
  function i(s) {
    return s === null || oe(s) ? e(s) : n(s);
  }
}
const Bh = {
  continuation: {
    tokenize: my
  },
  exit: gy,
  name: "blockQuote",
  tokenize: py
};
function py(t, e, n) {
  const r = this;
  return i;
  function i(o) {
    if (o === 62) {
      const l = r.containerState;
      return l.open || (t.enter("blockQuote", {
        _container: !0
      }), l.open = !0), t.enter("blockQuotePrefix"), t.enter("blockQuoteMarker"), t.consume(o), t.exit("blockQuoteMarker"), s;
    }
    return n(o);
  }
  function s(o) {
    return ge(o) ? (t.enter("blockQuotePrefixWhitespace"), t.consume(o), t.exit("blockQuotePrefixWhitespace"), t.exit("blockQuotePrefix"), e) : (t.exit("blockQuotePrefix"), e(o));
  }
}
function my(t, e, n) {
  const r = this;
  return i;
  function i(o) {
    return ge(o) ? xe(t, s, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(o) : s(o);
  }
  function s(o) {
    return t.attempt(Bh, e, n)(o);
  }
}
function gy(t) {
  t.exit("blockQuote");
}
const Fh = {
  name: "characterEscape",
  tokenize: yy
};
function yy(t, e, n) {
  return r;
  function r(s) {
    return t.enter("characterEscape"), t.enter("escapeMarker"), t.consume(s), t.exit("escapeMarker"), i;
  }
  function i(s) {
    return Ph(s) ? (t.enter("characterEscapeValue"), t.consume(s), t.exit("characterEscapeValue"), t.exit("characterEscape"), e) : n(s);
  }
}
const $h = {
  name: "characterReference",
  tokenize: ky
};
function ky(t, e, n) {
  const r = this;
  let i = 0, s, o;
  return l;
  function l(h) {
    return t.enter("characterReference"), t.enter("characterReferenceMarker"), t.consume(h), t.exit("characterReferenceMarker"), a;
  }
  function a(h) {
    return h === 35 ? (t.enter("characterReferenceMarkerNumeric"), t.consume(h), t.exit("characterReferenceMarkerNumeric"), u) : (t.enter("characterReferenceValue"), s = 31, o = Ye, c(h));
  }
  function u(h) {
    return h === 88 || h === 120 ? (t.enter("characterReferenceMarkerHexadecimal"), t.consume(h), t.exit("characterReferenceMarkerHexadecimal"), t.enter("characterReferenceValue"), s = 6, o = ry, c) : (t.enter("characterReferenceValue"), s = 7, o = Do, c(h));
  }
  function c(h) {
    if (h === 59 && i) {
      const d = t.exit("characterReferenceValue");
      return o === Ye && !_l(r.sliceSerialize(d)) ? n(h) : (t.enter("characterReferenceMarker"), t.consume(h), t.exit("characterReferenceMarker"), t.exit("characterReference"), e);
    }
    return o(h) && i++ < s ? (t.consume(h), c) : n(h);
  }
}
const zo = {
  partial: !0,
  tokenize: wy
};
function wy(t, e, n) {
  const r = this;
  return i;
  function i(o) {
    return o === null ? n(o) : (t.enter("lineEnding"), t.consume(o), t.exit("lineEnding"), s);
  }
  function s(o) {
    return r.parser.lazy[r.now().line] ? n(o) : e(o);
  }
}
const Iu = {
  concrete: !0,
  name: "codeFenced",
  tokenize: by
};
function by(t, e, n) {
  const r = this, i = {
    partial: !0,
    tokenize: E
  };
  let s = 0, o = 0, l;
  return a;
  function a(v) {
    return u(v);
  }
  function u(v) {
    const M = r.events[r.events.length - 1];
    return s = M && M[1].type === "linePrefix" ? M[2].sliceSerialize(M[1], !0).length : 0, l = v, t.enter("codeFenced"), t.enter("codeFencedFence"), t.enter("codeFencedFenceSequence"), c(v);
  }
  function c(v) {
    return v === l ? (o++, t.consume(v), c) : o < 3 ? n(v) : (t.exit("codeFencedFenceSequence"), ge(v) ? xe(t, h, "whitespace")(v) : h(v));
  }
  function h(v) {
    return v === null || oe(v) ? (t.exit("codeFencedFence"), r.interrupt ? e(v) : t.check(zo, m, A)(v)) : (t.enter("codeFencedFenceInfo"), t.enter("chunkString", {
      contentType: "string"
    }), d(v));
  }
  function d(v) {
    return v === null || oe(v) ? (t.exit("chunkString"), t.exit("codeFencedFenceInfo"), h(v)) : ge(v) ? (t.exit("chunkString"), t.exit("codeFencedFenceInfo"), xe(t, f, "whitespace")(v)) : v === 96 && v === l ? n(v) : (t.consume(v), d);
  }
  function f(v) {
    return v === null || oe(v) ? h(v) : (t.enter("codeFencedFenceMeta"), t.enter("chunkString", {
      contentType: "string"
    }), p(v));
  }
  function p(v) {
    return v === null || oe(v) ? (t.exit("chunkString"), t.exit("codeFencedFenceMeta"), h(v)) : v === 96 && v === l ? n(v) : (t.consume(v), p);
  }
  function m(v) {
    return t.attempt(i, A, y)(v);
  }
  function y(v) {
    return t.enter("lineEnding"), t.consume(v), t.exit("lineEnding"), g;
  }
  function g(v) {
    return s > 0 && ge(v) ? xe(t, b, "linePrefix", s + 1)(v) : b(v);
  }
  function b(v) {
    return v === null || oe(v) ? t.check(zo, m, A)(v) : (t.enter("codeFlowValue"), x(v));
  }
  function x(v) {
    return v === null || oe(v) ? (t.exit("codeFlowValue"), b(v)) : (t.consume(v), x);
  }
  function A(v) {
    return t.exit("codeFenced"), e(v);
  }
  function E(v, M, R) {
    let O = 0;
    return T;
    function T($) {
      return v.enter("lineEnding"), v.consume($), v.exit("lineEnding"), V;
    }
    function V($) {
      return v.enter("codeFencedFence"), ge($) ? xe(v, S, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)($) : S($);
    }
    function S($) {
      return $ === l ? (v.enter("codeFencedFenceSequence"), F($)) : R($);
    }
    function F($) {
      return $ === l ? (O++, v.consume($), F) : O >= o ? (v.exit("codeFencedFenceSequence"), ge($) ? xe(v, w, "whitespace")($) : w($)) : R($);
    }
    function w($) {
      return $ === null || oe($) ? (v.exit("codeFencedFence"), M($)) : R($);
    }
  }
}
const Ls = {
  name: "codeIndented",
  tokenize: Cy
}, xy = {
  partial: !0,
  tokenize: Sy
};
function Cy(t, e, n) {
  return r;
  function r(l) {
    return t.enter("codeIndented"), Lh(t, i, n, "linePrefix", 4, 4)(l);
  }
  function i(l) {
    return l === null ? o(l) : oe(l) ? t.attempt(xy, i, o)(l) : (t.enter("codeFlowValue"), s(l));
  }
  function s(l) {
    return l === null || oe(l) ? (t.exit("codeFlowValue"), i(l)) : (t.consume(l), s);
  }
  function o(l) {
    return t.exit("codeIndented"), e(l);
  }
}
function Sy(t, e, n) {
  const r = this;
  return i;
  function i(o) {
    return r.parser.lazy[r.now().line] ? n(o) : oe(o) ? (t.enter("lineEnding"), t.consume(o), t.exit("lineEnding"), i) : Lh(t, e, s, "linePrefix", 4, 4)(o);
  }
  function s(o) {
    return oe(o) ? i(o) : n(o);
  }
}
const vy = {
  name: "codeText",
  previous: Iy,
  resolve: Ny,
  tokenize: _y
};
function Ny(t) {
  let e = t.length - 4, n = 3, r, i;
  if ((t[n][1].type === "lineEnding" || t[n][1].type === "space") && (t[e][1].type === "lineEnding" || t[e][1].type === "space")) {
    for (r = n; ++r < e; )
      if (t[r][1].type === "codeTextData") {
        t[n][1].type = "codeTextPadding", t[e][1].type = "codeTextPadding", n += 2, e -= 2;
        break;
      }
  }
  for (r = n - 1, e++; ++r <= e; )
    i === void 0 ? r !== e && t[r][1].type !== "lineEnding" && (i = r) : (r === e || t[r][1].type === "lineEnding") && (t[i][1].type = "codeTextData", r !== i + 2 && (t[i][1].end = t[r - 1][1].end, t.splice(i + 2, r - i - 2), e -= r - i - 2, r = i + 2), i = void 0);
  return t;
}
function Iy(t) {
  return t !== 96 || this.events[this.events.length - 1][1].type === "characterEscape";
}
function _y(t, e, n) {
  let r = 0, i, s;
  return o;
  function o(h) {
    return t.enter("codeText"), t.enter("codeTextSequence"), l(h);
  }
  function l(h) {
    return h === 96 ? (t.consume(h), r++, l) : (t.exit("codeTextSequence"), a(h));
  }
  function a(h) {
    return h === null ? n(h) : h === 32 ? (t.enter("space"), t.consume(h), t.exit("space"), a) : h === 96 ? (s = t.enter("codeTextSequence"), i = 0, c(h)) : oe(h) ? (t.enter("lineEnding"), t.consume(h), t.exit("lineEnding"), a) : (t.enter("codeTextData"), u(h));
  }
  function u(h) {
    return h === null || h === 32 || h === 96 || oe(h) ? (t.exit("codeTextData"), a(h)) : (t.consume(h), u);
  }
  function c(h) {
    return h === 96 ? (t.consume(h), i++, c) : i === r ? (t.exit("codeTextSequence"), t.exit("codeText"), e(h)) : (s.type = "codeTextData", u(h));
  }
}
class Ty {
  /**
   * @param {ReadonlyArray<T> | null | undefined} [initial]
   *   Initial items (optional).
   * @returns
   *   Splice buffer.
   */
  constructor(e) {
    this.left = e ? [...e] : [], this.right = [];
  }
  /**
   * Array access;
   * does not move the cursor.
   *
   * @param {number} index
   *   Index.
   * @return {T}
   *   Item.
   */
  get(e) {
    if (e < 0 || e >= this.left.length + this.right.length)
      throw new RangeError("Cannot access index `" + e + "` in a splice buffer of size `" + (this.left.length + this.right.length) + "`");
    return e < this.left.length ? this.left[e] : this.right[this.right.length - e + this.left.length - 1];
  }
  /**
   * The length of the splice buffer, one greater than the largest index in the
   * array.
   */
  get length() {
    return this.left.length + this.right.length;
  }
  /**
   * Remove and return `list[0]`;
   * moves the cursor to `0`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  shift() {
    return this.setCursor(0), this.right.pop();
  }
  /**
   * Slice the buffer to get an array;
   * does not move the cursor.
   *
   * @param {number} start
   *   Start.
   * @param {number | null | undefined} [end]
   *   End (optional).
   * @returns {Array<T>}
   *   Array of items.
   */
  slice(e, n) {
    const r = n ?? Number.POSITIVE_INFINITY;
    return r < this.left.length ? this.left.slice(e, r) : e > this.left.length ? this.right.slice(this.right.length - r + this.left.length, this.right.length - e + this.left.length).reverse() : this.left.slice(e).concat(this.right.slice(this.right.length - r + this.left.length).reverse());
  }
  /**
   * Mimics the behavior of Array.prototype.splice() except for the change of
   * interface necessary to avoid segfaults when patching in very large arrays.
   *
   * This operation moves cursor is moved to `start` and results in the cursor
   * placed after any inserted items.
   *
   * @param {number} start
   *   Start;
   *   zero-based index at which to start changing the array;
   *   negative numbers count backwards from the end of the array and values
   *   that are out-of bounds are clamped to the appropriate end of the array.
   * @param {number | null | undefined} [deleteCount=0]
   *   Delete count (default: `0`);
   *   maximum number of elements to delete, starting from start.
   * @param {Array<T> | null | undefined} [items=[]]
   *   Items to include in place of the deleted items (default: `[]`).
   * @return {Array<T>}
   *   Any removed items.
   */
  splice(e, n, r) {
    const i = n || 0;
    this.setCursor(Math.trunc(e));
    const s = this.right.splice(this.right.length - i, Number.POSITIVE_INFINITY);
    return r && Cr(this.left, r), s.reverse();
  }
  /**
   * Remove and return the highest-numbered item in the array, so
   * `list[list.length - 1]`;
   * Moves the cursor to `length`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  pop() {
    return this.setCursor(Number.POSITIVE_INFINITY), this.left.pop();
  }
  /**
   * Inserts a single item to the high-numbered side of the array;
   * moves the cursor to `length`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  push(e) {
    this.setCursor(Number.POSITIVE_INFINITY), this.left.push(e);
  }
  /**
   * Inserts many items to the high-numbered side of the array.
   * Moves the cursor to `length`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  pushMany(e) {
    this.setCursor(Number.POSITIVE_INFINITY), Cr(this.left, e);
  }
  /**
   * Inserts a single item to the low-numbered side of the array;
   * Moves the cursor to `0`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  unshift(e) {
    this.setCursor(0), this.right.push(e);
  }
  /**
   * Inserts many items to the low-numbered side of the array;
   * moves the cursor to `0`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  unshiftMany(e) {
    this.setCursor(0), Cr(this.right, e.reverse());
  }
  /**
   * Move the cursor to a specific position in the array. Requires
   * time proportional to the distance moved.
   *
   * If `n < 0`, the cursor will end up at the beginning.
   * If `n > length`, the cursor will end up at the end.
   *
   * @param {number} n
   *   Position.
   * @return {undefined}
   *   Nothing.
   */
  setCursor(e) {
    if (!(e === this.left.length || e > this.left.length && this.right.length === 0 || e < 0 && this.left.length === 0))
      if (e < this.left.length) {
        const n = this.left.splice(e, Number.POSITIVE_INFINITY);
        Cr(this.right, n.reverse());
      } else {
        const n = this.right.splice(this.left.length + this.right.length - e, Number.POSITIVE_INFINITY);
        Cr(this.left, n.reverse());
      }
  }
}
function Cr(t, e) {
  let n = 0;
  if (e.length < 1e4)
    t.push(...e);
  else
    for (; n < e.length; )
      t.push(...e.slice(n, n + 1e4)), n += 1e4;
}
function jh(t) {
  const e = {};
  let n = -1, r, i, s, o, l, a, u;
  const c = new Ty(t);
  for (; ++n < c.length; ) {
    for (; n in e; )
      n = e[n];
    if (r = c.get(n), n && r[1].type === "chunkFlow" && c.get(n - 1)[1].type === "listItemPrefix" && (a = r[1]._tokenizer.events, s = 0, s < a.length && a[s][1].type === "lineEndingBlank" && (s += 2), s < a.length && a[s][1].type === "content"))
      for (; ++s < a.length && a[s][1].type !== "content"; )
        a[s][1].type === "chunkText" && (a[s][1]._isInFirstContentOfListItem = !0, s++);
    if (r[0] === "enter")
      r[1].contentType && (Object.assign(e, Ay(c, n)), n = e[n], u = !0);
    else if (r[1]._container) {
      for (s = n, i = void 0; s--; )
        if (o = c.get(s), o[1].type === "lineEnding" || o[1].type === "lineEndingBlank")
          o[0] === "enter" && (i && (c.get(i)[1].type = "lineEndingBlank"), o[1].type = "lineEnding", i = s);
        else if (!(o[1].type === "linePrefix" || o[1].type === "listItemIndent")) break;
      i && (r[1].end = {
        ...c.get(i)[1].start
      }, l = c.slice(i, n), l.unshift(r), c.splice(i, n - i + 1, l));
    }
  }
  return Tt(t, 0, Number.POSITIVE_INFINITY, c.slice(0)), !u;
}
function Ay(t, e) {
  const n = t.get(e)[1], r = t.get(e)[2];
  let i = e - 1;
  const s = [];
  let o = n._tokenizer;
  o || (o = r.parser[n.contentType](n.start), n._contentTypeTextTrailing && (o._contentTypeTextTrailing = !0));
  const l = o.events, a = [], u = {};
  let c, h, d = -1, f = n, p = 0, m = 0;
  const y = [m];
  for (; f; ) {
    for (; t.get(++i)[1] !== f; )
      ;
    s.push(i), f._tokenizer || (c = r.sliceStream(f), f.next || c.push(null), h && o.defineSkip(f.start), f._isInFirstContentOfListItem && (o._gfmTasklistFirstContentOfListItem = !0), o.write(c), f._isInFirstContentOfListItem && (o._gfmTasklistFirstContentOfListItem = void 0)), h = f, f = f.next;
  }
  for (f = n; ++d < l.length; )
    // Find a void token that includes a break.
    l[d][0] === "exit" && l[d - 1][0] === "enter" && l[d][1].type === l[d - 1][1].type && l[d][1].start.line !== l[d][1].end.line && (m = d + 1, y.push(m), f._tokenizer = void 0, f.previous = void 0, f = f.next);
  for (o.events = [], f ? (f._tokenizer = void 0, f.previous = void 0) : y.pop(), d = y.length; d--; ) {
    const g = l.slice(y[d], y[d + 1]), b = s.pop();
    a.push([b, b + g.length - 1]), t.splice(b, 2, g);
  }
  for (a.reverse(), d = -1; ++d < a.length; )
    u[p + a[d][0]] = p + a[d][1], p += a[d][1] - a[d][0] - 1;
  return u;
}
const Ey = {
  resolve: Oy,
  tokenize: Dy
}, My = {
  partial: !0,
  tokenize: Ry
};
function Oy(t) {
  return jh(t), t;
}
function Dy(t, e) {
  let n;
  return r;
  function r(l) {
    return t.enter("content"), n = t.enter("chunkContent", {
      contentType: "content"
    }), i(l);
  }
  function i(l) {
    return l === null ? s(l) : oe(l) ? t.check(My, o, s)(l) : (t.consume(l), i);
  }
  function s(l) {
    return t.exit("chunkContent"), t.exit("content"), e(l);
  }
  function o(l) {
    return t.consume(l), t.exit("chunkContent"), n.next = t.enter("chunkContent", {
      contentType: "content",
      previous: n
    }), n = n.next, i;
  }
}
function Ry(t, e, n) {
  const r = this;
  return i;
  function i(o) {
    return t.exit("chunkContent"), t.enter("lineEnding"), t.consume(o), t.exit("lineEnding"), xe(t, s, "linePrefix");
  }
  function s(o) {
    if (o === null || oe(o))
      return n(o);
    const l = r.events[r.events.length - 1];
    return !r.parser.constructs.disable.null.includes("codeIndented") && l && l[1].type === "linePrefix" && l[2].sliceSerialize(l[1], !0).length >= 4 ? e(o) : t.interrupt(r.parser.constructs.flow, n, e)(o);
  }
}
function Vh(t, e, n, r, i, s, o, l, a) {
  const u = a || Number.POSITIVE_INFINITY;
  let c = 0;
  return h;
  function h(g) {
    return g === 60 ? (t.enter(r), t.enter(i), t.enter(s), t.consume(g), t.exit(s), d) : g === null || g === 32 || g === 41 || Zi(g) ? n(g) : (t.enter(r), t.enter(o), t.enter(l), t.enter("chunkString", {
      contentType: "string"
    }), m(g));
  }
  function d(g) {
    return g === 62 ? (t.enter(s), t.consume(g), t.exit(s), t.exit(i), t.exit(r), e) : (t.enter(l), t.enter("chunkString", {
      contentType: "string"
    }), f(g));
  }
  function f(g) {
    return g === 62 ? (t.exit("chunkString"), t.exit(l), d(g)) : g === null || g === 60 || oe(g) ? n(g) : (t.consume(g), g === 92 ? p : f);
  }
  function p(g) {
    return g === 60 || g === 62 || g === 92 ? (t.consume(g), f) : f(g);
  }
  function m(g) {
    return !c && (g === null || g === 41 || Ne(g)) ? (t.exit("chunkString"), t.exit(l), t.exit(o), t.exit(r), e(g)) : c < u && g === 40 ? (t.consume(g), c++, m) : g === 41 ? (t.consume(g), c--, m) : g === null || g === 32 || g === 40 || Zi(g) ? n(g) : (t.consume(g), g === 92 ? y : m);
  }
  function y(g) {
    return g === 40 || g === 41 || g === 92 ? (t.consume(g), m) : m(g);
  }
}
function Wh(t, e, n, r, i, s) {
  const o = this;
  let l = 0, a;
  return u;
  function u(f) {
    return t.enter(r), t.enter(i), t.consume(f), t.exit(i), t.enter(s), c;
  }
  function c(f) {
    return l > 999 || f === null || f === 91 || f === 93 && !a || // To do: remove in the future once we’ve switched from
    // `micromark-extension-footnote` to `micromark-extension-gfm-footnote`,
    // which doesn’t need this.
    // Hidden footnotes hook.
    /* c8 ignore next 3 */
    f === 94 && !l && "_hiddenFootnoteSupport" in o.parser.constructs ? n(f) : f === 93 ? (t.exit(s), t.enter(i), t.consume(f), t.exit(i), t.exit(r), e) : oe(f) ? (t.enter("lineEnding"), t.consume(f), t.exit("lineEnding"), c) : (t.enter("chunkString", {
      contentType: "string"
    }), h(f));
  }
  function h(f) {
    return f === null || f === 91 || f === 93 || oe(f) || l++ > 999 ? (t.exit("chunkString"), c(f)) : (t.consume(f), a || (a = !ge(f)), f === 92 ? d : h);
  }
  function d(f) {
    return f === 91 || f === 92 || f === 93 ? (t.consume(f), l++, h) : h(f);
  }
}
function Hh(t, e, n, r, i, s) {
  let o;
  return l;
  function l(d) {
    return d === 34 || d === 39 || d === 40 ? (t.enter(r), t.enter(i), t.consume(d), t.exit(i), o = d === 40 ? 41 : d, a) : n(d);
  }
  function a(d) {
    return d === o ? (t.enter(i), t.consume(d), t.exit(i), t.exit(r), e) : (t.enter(s), u(d));
  }
  function u(d) {
    return d === o ? (t.exit(s), a(o)) : d === null ? n(d) : oe(d) ? (t.enter("lineEnding"), t.consume(d), t.exit("lineEnding"), xe(t, u, "linePrefix")) : (t.enter("chunkString", {
      contentType: "string"
    }), c(d));
  }
  function c(d) {
    return d === o || d === null || oe(d) ? (t.exit("chunkString"), u(d)) : (t.consume(d), d === 92 ? h : c);
  }
  function h(d) {
    return d === o || d === 92 ? (t.consume(d), c) : c(d);
  }
}
function Er(t, e) {
  let n;
  return r;
  function r(i) {
    return oe(i) ? (t.enter("lineEnding"), t.consume(i), t.exit("lineEnding"), n = !0, r) : ge(i) ? xe(t, r, n ? "linePrefix" : "lineSuffix")(i) : e(i);
  }
}
const zy = {
  name: "definition",
  tokenize: Ly
}, Py = {
  partial: !0,
  tokenize: By
};
function Ly(t, e, n) {
  const r = this;
  let i;
  return s;
  function s(f) {
    return t.enter("definition"), o(f);
  }
  function o(f) {
    return Wh.call(
      r,
      t,
      l,
      // Note: we don’t need to reset the way `markdown-rs` does.
      n,
      "definitionLabel",
      "definitionLabelMarker",
      "definitionLabelString"
    )(f);
  }
  function l(f) {
    return i = At(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1)), f === 58 ? (t.enter("definitionMarker"), t.consume(f), t.exit("definitionMarker"), a) : n(f);
  }
  function a(f) {
    return Ne(f) ? Er(t, u)(f) : u(f);
  }
  function u(f) {
    return Vh(
      t,
      c,
      // Note: we don’t need to reset the way `markdown-rs` does.
      n,
      "definitionDestination",
      "definitionDestinationLiteral",
      "definitionDestinationLiteralMarker",
      "definitionDestinationRaw",
      "definitionDestinationString"
    )(f);
  }
  function c(f) {
    return t.attempt(Py, h, h)(f);
  }
  function h(f) {
    return ge(f) ? xe(t, d, "whitespace")(f) : d(f);
  }
  function d(f) {
    return f === null || oe(f) ? (t.exit("definition"), r.parser.defined.push(i), e(f)) : n(f);
  }
}
function By(t, e, n) {
  return r;
  function r(l) {
    return Ne(l) ? Er(t, i)(l) : n(l);
  }
  function i(l) {
    return Hh(t, s, n, "definitionTitle", "definitionTitleMarker", "definitionTitleString")(l);
  }
  function s(l) {
    return ge(l) ? xe(t, o, "whitespace")(l) : o(l);
  }
  function o(l) {
    return l === null || oe(l) ? e(l) : n(l);
  }
}
const Fy = {
  name: "hardBreakEscape",
  tokenize: $y
};
function $y(t, e, n) {
  return r;
  function r(s) {
    return t.enter("hardBreakEscape"), t.consume(s), i;
  }
  function i(s) {
    return oe(s) ? (t.exit("hardBreakEscape"), e(s)) : n(s);
  }
}
const jy = {
  name: "headingAtx",
  resolve: Vy,
  tokenize: Wy
};
function Vy(t, e) {
  let n = t.length - 2, r = 3;
  if (t[r][1].type === "whitespace" && (r += 2), n - 2 > r && t[n][1].type === "whitespace" && (n -= 2), t[n][1].type === "atxHeadingSequence" && (r === n - 1 || n - 4 > r && t[n - 2][1].type === "whitespace") && (n -= r + 1 === n ? 2 : 4), n > r) {
    const i = {
      type: "atxHeadingText",
      start: t[r][1].start,
      end: t[n][1].end
    }, s = {
      type: "chunkText",
      start: t[r][1].start,
      end: t[n][1].end,
      contentType: "text"
    };
    Tt(t, r, n - r + 1, [["enter", i, e], ["enter", s, e], ["exit", s, e], ["exit", i, e]]);
  }
  return t;
}
function Wy(t, e, n) {
  let r = 0;
  return i;
  function i(c) {
    return t.enter("atxHeading"), s(c);
  }
  function s(c) {
    return t.enter("atxHeadingSequence"), o(c);
  }
  function o(c) {
    return c === 35 && r++ < 6 ? (t.consume(c), o) : c === null || Ne(c) ? (t.exit("atxHeadingSequence"), l(c)) : n(c);
  }
  function l(c) {
    return c === 35 ? (t.enter("atxHeadingSequence"), a(c)) : c === null || oe(c) ? (t.exit("atxHeading"), e(c)) : ge(c) ? xe(t, l, "whitespace")(c) : (t.enter("atxHeadingText"), u(c));
  }
  function a(c) {
    return c === 35 ? (t.consume(c), a) : (t.exit("atxHeadingSequence"), l(c));
  }
  function u(c) {
    return c === null || c === 35 || Ne(c) ? (t.exit("atxHeadingText"), l(c)) : (t.consume(c), u);
  }
}
const Uh = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
], Po = ["pre", "script", "style", "textarea"], Hy = {
  concrete: !0,
  name: "htmlFlow",
  resolveTo: qy,
  tokenize: Ky
}, Uy = {
  partial: !0,
  tokenize: Jy
};
function qy(t) {
  let e = t.length;
  for (; e-- && !(t[e][0] === "enter" && t[e][1].type === "htmlFlow"); )
    ;
  return e > 1 && t[e - 2][1].type === "linePrefix" && (t[e][1].start = t[e - 2][1].start, t[e + 1][1].start = t[e - 2][1].start, t.splice(e - 2, 2)), t;
}
function Ky(t, e, n) {
  const r = this;
  let i, s, o, l, a;
  return u;
  function u(N) {
    return c(N);
  }
  function c(N) {
    return t.enter("htmlFlow"), t.enter("htmlFlowData"), t.consume(N), h;
  }
  function h(N) {
    return N === 33 ? (t.consume(N), d) : N === 47 ? (t.consume(N), s = !0, m) : N === 63 ? (t.consume(N), i = 3, r.interrupt ? e : I) : Ve(N) ? (t.consume(N), o = String.fromCharCode(N), y) : n(N);
  }
  function d(N) {
    return N === 45 ? (t.consume(N), i = 2, f) : N === 91 ? (t.consume(N), i = 5, l = 0, p) : Ve(N) ? (t.consume(N), i = 4, r.interrupt ? e : I) : n(N);
  }
  function f(N) {
    return N === 45 ? (t.consume(N), r.interrupt ? e : I) : n(N);
  }
  function p(N) {
    const ee = "CDATA[";
    return N === ee.charCodeAt(l++) ? (t.consume(N), l === ee.length ? r.interrupt ? e : S : p) : n(N);
  }
  function m(N) {
    return Ve(N) ? (t.consume(N), o = String.fromCharCode(N), y) : n(N);
  }
  function y(N) {
    if (N === null || N === 47 || N === 62 || Ne(N)) {
      const ee = N === 47, X = o.toLowerCase();
      return !ee && !s && Po.includes(X) ? (i = 1, r.interrupt ? e(N) : S(N)) : Uh.includes(o.toLowerCase()) ? (i = 6, ee ? (t.consume(N), g) : r.interrupt ? e(N) : S(N)) : (i = 7, r.interrupt && !r.parser.lazy[r.now().line] ? n(N) : s ? b(N) : x(N));
    }
    return N === 45 || Ye(N) ? (t.consume(N), o += String.fromCharCode(N), y) : n(N);
  }
  function g(N) {
    return N === 62 ? (t.consume(N), r.interrupt ? e : S) : n(N);
  }
  function b(N) {
    return ge(N) ? (t.consume(N), b) : T(N);
  }
  function x(N) {
    return N === 47 ? (t.consume(N), T) : N === 58 || N === 95 || Ve(N) ? (t.consume(N), A) : ge(N) ? (t.consume(N), x) : T(N);
  }
  function A(N) {
    return N === 45 || N === 46 || N === 58 || N === 95 || Ye(N) ? (t.consume(N), A) : E(N);
  }
  function E(N) {
    return N === 61 ? (t.consume(N), v) : ge(N) ? (t.consume(N), E) : x(N);
  }
  function v(N) {
    return N === null || N === 60 || N === 61 || N === 62 || N === 96 ? n(N) : N === 34 || N === 39 ? (t.consume(N), a = N, M) : ge(N) ? (t.consume(N), v) : R(N);
  }
  function M(N) {
    return N === a ? (t.consume(N), a = null, O) : N === null || oe(N) ? n(N) : (t.consume(N), M);
  }
  function R(N) {
    return N === null || N === 34 || N === 39 || N === 47 || N === 60 || N === 61 || N === 62 || N === 96 || Ne(N) ? E(N) : (t.consume(N), R);
  }
  function O(N) {
    return N === 47 || N === 62 || ge(N) ? x(N) : n(N);
  }
  function T(N) {
    return N === 62 ? (t.consume(N), V) : n(N);
  }
  function V(N) {
    return N === null || oe(N) ? S(N) : ge(N) ? (t.consume(N), V) : n(N);
  }
  function S(N) {
    return N === 45 && i === 2 ? (t.consume(N), ie) : N === 60 && i === 1 ? (t.consume(N), U) : N === 62 && i === 4 ? (t.consume(N), B) : N === 63 && i === 3 ? (t.consume(N), I) : N === 93 && i === 5 ? (t.consume(N), Z) : oe(N) && (i === 6 || i === 7) ? (t.exit("htmlFlowData"), t.check(Uy, P, F)(N)) : N === null || oe(N) ? (t.exit("htmlFlowData"), F(N)) : (t.consume(N), S);
  }
  function F(N) {
    return t.check(zo, w, P)(N);
  }
  function w(N) {
    return t.enter("lineEnding"), t.consume(N), t.exit("lineEnding"), $;
  }
  function $(N) {
    return N === null || oe(N) ? F(N) : (t.enter("htmlFlowData"), S(N));
  }
  function ie(N) {
    return N === 45 ? (t.consume(N), I) : S(N);
  }
  function U(N) {
    return N === 47 ? (t.consume(N), o = "", le) : S(N);
  }
  function le(N) {
    if (N === 62) {
      const ee = o.toLowerCase();
      return Po.includes(ee) ? (t.consume(N), B) : S(N);
    }
    return Ve(N) && o.length < 8 ? (t.consume(N), o += String.fromCharCode(N), le) : S(N);
  }
  function Z(N) {
    return N === 93 ? (t.consume(N), I) : S(N);
  }
  function I(N) {
    return N === 62 ? (t.consume(N), B) : N === 45 && i === 2 ? (t.consume(N), I) : S(N);
  }
  function B(N) {
    return N === null || oe(N) ? (t.exit("htmlFlowData"), P(N)) : (t.consume(N), B);
  }
  function P(N) {
    return t.exit("htmlFlow"), e(N);
  }
}
function Jy(t, e, n) {
  return r;
  function r(i) {
    return t.enter("lineEnding"), t.consume(i), t.exit("lineEnding"), t.attempt(ni, e, n);
  }
}
const Gy = {
  name: "htmlText",
  tokenize: Zy
};
function Zy(t, e, n) {
  const r = this;
  let i, s, o;
  return l;
  function l(I) {
    return t.enter("htmlText"), t.enter("htmlTextData"), t.consume(I), a;
  }
  function a(I) {
    return I === 33 ? (t.consume(I), u) : I === 47 ? (t.consume(I), E) : I === 63 ? (t.consume(I), x) : Ve(I) ? (t.consume(I), R) : n(I);
  }
  function u(I) {
    return I === 45 ? (t.consume(I), c) : I === 91 ? (t.consume(I), s = 0, p) : Ve(I) ? (t.consume(I), b) : n(I);
  }
  function c(I) {
    return I === 45 ? (t.consume(I), f) : n(I);
  }
  function h(I) {
    return I === null ? n(I) : I === 45 ? (t.consume(I), d) : oe(I) ? (o = h, U(I)) : (t.consume(I), h);
  }
  function d(I) {
    return I === 45 ? (t.consume(I), f) : h(I);
  }
  function f(I) {
    return I === 62 ? ie(I) : I === 45 ? d(I) : h(I);
  }
  function p(I) {
    const B = "CDATA[";
    return I === B.charCodeAt(s++) ? (t.consume(I), s === B.length ? m : p) : n(I);
  }
  function m(I) {
    return I === null ? n(I) : I === 93 ? (t.consume(I), y) : oe(I) ? (o = m, U(I)) : (t.consume(I), m);
  }
  function y(I) {
    return I === 93 ? (t.consume(I), g) : m(I);
  }
  function g(I) {
    return I === 62 ? ie(I) : I === 93 ? (t.consume(I), g) : m(I);
  }
  function b(I) {
    return I === null || I === 62 ? ie(I) : oe(I) ? (o = b, U(I)) : (t.consume(I), b);
  }
  function x(I) {
    return I === null ? n(I) : I === 63 ? (t.consume(I), A) : oe(I) ? (o = x, U(I)) : (t.consume(I), x);
  }
  function A(I) {
    return I === 62 ? ie(I) : x(I);
  }
  function E(I) {
    return Ve(I) ? (t.consume(I), v) : n(I);
  }
  function v(I) {
    return I === 45 || Ye(I) ? (t.consume(I), v) : M(I);
  }
  function M(I) {
    return oe(I) ? (o = M, U(I)) : ge(I) ? (t.consume(I), M) : ie(I);
  }
  function R(I) {
    return I === 45 || Ye(I) ? (t.consume(I), R) : I === 47 || I === 62 || Ne(I) ? O(I) : n(I);
  }
  function O(I) {
    return I === 47 ? (t.consume(I), ie) : I === 58 || I === 95 || Ve(I) ? (t.consume(I), T) : oe(I) ? (o = O, U(I)) : ge(I) ? (t.consume(I), O) : ie(I);
  }
  function T(I) {
    return I === 45 || I === 46 || I === 58 || I === 95 || Ye(I) ? (t.consume(I), T) : V(I);
  }
  function V(I) {
    return I === 61 ? (t.consume(I), S) : oe(I) ? (o = V, U(I)) : ge(I) ? (t.consume(I), V) : O(I);
  }
  function S(I) {
    return I === null || I === 60 || I === 61 || I === 62 || I === 96 ? n(I) : I === 34 || I === 39 ? (t.consume(I), i = I, F) : oe(I) ? (o = S, U(I)) : ge(I) ? (t.consume(I), S) : (t.consume(I), w);
  }
  function F(I) {
    return I === i ? (t.consume(I), i = void 0, $) : I === null ? n(I) : oe(I) ? (o = F, U(I)) : (t.consume(I), F);
  }
  function w(I) {
    return I === null || I === 34 || I === 39 || I === 60 || I === 61 || I === 96 ? n(I) : I === 47 || I === 62 || Ne(I) ? O(I) : (t.consume(I), w);
  }
  function $(I) {
    return I === 47 || I === 62 || Ne(I) ? O(I) : n(I);
  }
  function ie(I) {
    return I === 62 ? (t.consume(I), t.exit("htmlTextData"), t.exit("htmlText"), e) : n(I);
  }
  function U(I) {
    return t.exit("htmlTextData"), t.enter("lineEnding"), t.consume(I), t.exit("lineEnding"), le;
  }
  function le(I) {
    return ge(I) ? xe(t, Z, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(I) : Z(I);
  }
  function Z(I) {
    return t.enter("htmlTextData"), o(I);
  }
}
const Tl = {
  name: "labelEnd",
  resolveAll: ek,
  resolveTo: tk,
  tokenize: nk
}, Yy = {
  tokenize: rk
}, Xy = {
  tokenize: ik
}, Qy = {
  tokenize: sk
};
function ek(t) {
  let e = -1;
  const n = [];
  for (; ++e < t.length; ) {
    const r = t[e][1];
    if (n.push(t[e]), r.type === "labelImage" || r.type === "labelLink" || r.type === "labelEnd") {
      const i = r.type === "labelImage" ? 4 : 2;
      r.type = "data", e += i;
    }
  }
  return t.length !== n.length && Tt(t, 0, t.length, n), t;
}
function tk(t, e) {
  let n = t.length, r = 0, i, s, o;
  for (; n--; ) {
    const c = t[n][1];
    if (i) {
      if (c.type === "link" || c.type === "labelLink" && c._inactive)
        break;
      t[n][0] === "enter" && c.type === "labelLink" && (c._inactive = !0);
    } else if (s) {
      if (t[n][0] === "enter" && (c.type === "labelImage" || c.type === "labelLink") && !c._balanced && (i = n, c.type !== "labelLink")) {
        r = 2;
        break;
      }
    } else c.type === "labelEnd" && (s = n);
  }
  const l = {
    type: t[i][1].type === "labelLink" ? "link" : "image",
    start: {
      ...t[i][1].start
    },
    end: {
      ...t[t.length - 1][1].end
    }
  }, a = {
    type: "label",
    start: {
      ...t[i][1].start
    },
    end: {
      ...t[s][1].end
    }
  }, u = {
    type: "labelText",
    start: {
      ...t[i + r + 2][1].end
    },
    end: {
      ...t[s - 2][1].start
    }
  };
  return o = [["enter", l, e], ["enter", a, e]], o = wt(o, t.slice(i + 1, i + r + 3)), o = wt(o, [["enter", u, e]]), o = wt(o, ws(e.parser.constructs.insideSpan.null, t.slice(i + r + 4, s - 3), e)), o = wt(o, [["exit", u, e], t[s - 2], t[s - 1], ["exit", a, e]]), o = wt(o, t.slice(s + 1)), o = wt(o, [["exit", l, e]]), Tt(t, i, t.length, o), t;
}
function nk(t, e, n) {
  const r = this, i = r._labelStarts;
  let s, o;
  if (i) {
    for (; i.length > 0 && i[i.length - 1]._balanced; )
      i.pop();
    s = i[i.length - 1];
  }
  return l;
  function l(d) {
    return s ? s._inactive ? h(d) : (o = r.parser.defined.includes(At(r.sliceSerialize({
      start: s.end,
      end: r.now()
    }))), t.enter("labelEnd"), t.enter("labelMarker"), t.consume(d), t.exit("labelMarker"), t.exit("labelEnd"), a) : n(d);
  }
  function a(d) {
    return d === 40 ? t.attempt(Yy, c, o ? c : h)(d) : d === 91 ? t.attempt(Xy, c, o ? u : h)(d) : o ? c(d) : h(d);
  }
  function u(d) {
    return t.attempt(Qy, c, h)(d);
  }
  function c(d) {
    return i.pop(), e(d);
  }
  function h(d) {
    return s._balanced = !0, n(d);
  }
}
function rk(t, e, n) {
  return r;
  function r(h) {
    return t.enter("resource"), t.enter("resourceMarker"), t.consume(h), t.exit("resourceMarker"), i;
  }
  function i(h) {
    return Ne(h) ? Er(t, s)(h) : s(h);
  }
  function s(h) {
    return h === 41 ? c(h) : Vh(t, o, l, "resourceDestination", "resourceDestinationLiteral", "resourceDestinationLiteralMarker", "resourceDestinationRaw", "resourceDestinationString", 32)(h);
  }
  function o(h) {
    return Ne(h) ? Er(t, a)(h) : c(h);
  }
  function l(h) {
    return n(h);
  }
  function a(h) {
    return h === 34 || h === 39 || h === 40 ? Hh(t, u, n, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(h) : c(h);
  }
  function u(h) {
    return Ne(h) ? Er(t, c)(h) : c(h);
  }
  function c(h) {
    return h === 41 ? (t.enter("resourceMarker"), t.consume(h), t.exit("resourceMarker"), t.exit("resource"), e) : n(h);
  }
}
function ik(t, e, n) {
  const r = this;
  return i;
  function i(l) {
    return Wh.call(r, t, s, o, "reference", "referenceMarker", "referenceString")(l);
  }
  function s(l) {
    return r.parser.defined.includes(At(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1))) ? e(l) : n(l);
  }
  function o(l) {
    return n(l);
  }
}
function sk(t, e, n) {
  return r;
  function r(s) {
    return t.enter("reference"), t.enter("referenceMarker"), t.consume(s), t.exit("referenceMarker"), i;
  }
  function i(s) {
    return s === 93 ? (t.enter("referenceMarker"), t.consume(s), t.exit("referenceMarker"), t.exit("reference"), e) : n(s);
  }
}
const ok = {
  name: "labelStartImage",
  resolveAll: Tl.resolveAll,
  tokenize: lk
};
function lk(t, e, n) {
  const r = this;
  let i;
  return s;
  function s(a) {
    return t.enter("labelImage"), t.enter("labelImageMarker"), t.consume(a), t.exit("labelImageMarker"), o;
  }
  function o(a) {
    return a === 91 ? (t.enter("labelMarker"), t.consume(a), t.exit("labelMarker"), i = t.exit("labelImage"), l) : n(a);
  }
  function l(a) {
    return a === 94 && "_hiddenFootnoteSupport" in r.parser.constructs ? n(a) : (r._labelStarts = r._labelStarts || [], r._labelStarts.push(i), e(a));
  }
}
const ak = {
  name: "labelStartLink",
  resolveAll: Tl.resolveAll,
  tokenize: uk
};
function uk(t, e, n) {
  const r = this;
  let i;
  return s;
  function s(l) {
    return t.enter("labelLink"), t.enter("labelMarker"), t.consume(l), t.exit("labelMarker"), i = t.exit("labelLink"), o;
  }
  function o(l) {
    return l === 94 && "_hiddenFootnoteSupport" in r.parser.constructs ? n(l) : (r._labelStarts = r._labelStarts || [], r._labelStarts.push(i), e(l));
  }
}
const Bs = {
  name: "lineEnding",
  tokenize: ck
};
function ck(t, e) {
  return n;
  function n(r) {
    return t.enter("lineEnding"), t.consume(r), t.exit("lineEnding"), xe(t, e, "linePrefix");
  }
}
const Di = {
  name: "thematicBreak",
  tokenize: hk
};
function hk(t, e, n) {
  let r = 0, i;
  return s;
  function s(u) {
    return t.enter("thematicBreak"), o(u);
  }
  function o(u) {
    return i = u, l(u);
  }
  function l(u) {
    return u === i ? (t.enter("thematicBreakSequence"), a(u)) : r >= 3 && (u === null || oe(u)) ? (t.exit("thematicBreak"), e(u)) : n(u);
  }
  function a(u) {
    return u === i ? (t.consume(u), r++, a) : (t.exit("thematicBreakSequence"), ge(u) ? xe(t, l, "whitespace")(u) : l(u));
  }
}
const et = {
  continuation: {
    tokenize: mk
  },
  exit: yk,
  name: "list",
  tokenize: pk
}, fk = {
  partial: !0,
  tokenize: kk
}, dk = {
  partial: !0,
  tokenize: gk
};
function pk(t, e, n) {
  const r = this, i = r.events[r.events.length - 1];
  let s = i && i[1].type === "linePrefix" ? i[2].sliceSerialize(i[1], !0).length : 0, o = 0;
  return l;
  function l(f) {
    const p = r.containerState.type || (f === 42 || f === 43 || f === 45 ? "listUnordered" : "listOrdered");
    if (p === "listUnordered" ? !r.containerState.marker || f === r.containerState.marker : Do(f)) {
      if (r.containerState.type || (r.containerState.type = p, t.enter(p, {
        _container: !0
      })), p === "listUnordered")
        return t.enter("listItemPrefix"), f === 42 || f === 45 ? t.check(Di, n, u)(f) : u(f);
      if (!r.interrupt || f === 49)
        return t.enter("listItemPrefix"), t.enter("listItemValue"), a(f);
    }
    return n(f);
  }
  function a(f) {
    return Do(f) && ++o < 10 ? (t.consume(f), a) : (!r.interrupt || o < 2) && (r.containerState.marker ? f === r.containerState.marker : f === 41 || f === 46) ? (t.exit("listItemValue"), u(f)) : n(f);
  }
  function u(f) {
    return t.enter("listItemMarker"), t.consume(f), t.exit("listItemMarker"), r.containerState.marker = r.containerState.marker || f, t.check(
      ni,
      // Can’t be empty when interrupting.
      r.interrupt ? n : c,
      t.attempt(fk, d, h)
    );
  }
  function c(f) {
    return r.containerState.initialBlankLine = !0, s++, d(f);
  }
  function h(f) {
    return ge(f) ? (t.enter("listItemPrefixWhitespace"), t.consume(f), t.exit("listItemPrefixWhitespace"), d) : n(f);
  }
  function d(f) {
    return r.containerState.size = s + r.sliceSerialize(t.exit("listItemPrefix"), !0).length, e(f);
  }
}
function mk(t, e, n) {
  const r = this;
  return r.containerState._closeFlow = void 0, t.check(ni, i, s);
  function i(l) {
    return r.containerState.furtherBlankLines = r.containerState.furtherBlankLines || r.containerState.initialBlankLine, xe(t, e, "listItemIndent", r.containerState.size + 1)(l);
  }
  function s(l) {
    return r.containerState.furtherBlankLines || !ge(l) ? (r.containerState.furtherBlankLines = void 0, r.containerState.initialBlankLine = void 0, o(l)) : (r.containerState.furtherBlankLines = void 0, r.containerState.initialBlankLine = void 0, t.attempt(dk, e, o)(l));
  }
  function o(l) {
    return r.containerState._closeFlow = !0, r.interrupt = void 0, xe(t, t.attempt(et, e, n), "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(l);
  }
}
function gk(t, e, n) {
  const r = this;
  return xe(t, i, "listItemIndent", r.containerState.size + 1);
  function i(s) {
    const o = r.events[r.events.length - 1];
    return o && o[1].type === "listItemIndent" && o[2].sliceSerialize(o[1], !0).length === r.containerState.size ? e(s) : n(s);
  }
}
function yk(t) {
  t.exit(this.containerState.type);
}
function kk(t, e, n) {
  const r = this;
  return xe(t, i, "listItemPrefixWhitespace", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 5);
  function i(s) {
    const o = r.events[r.events.length - 1];
    return !ge(s) && o && o[1].type === "listItemPrefixWhitespace" ? e(s) : n(s);
  }
}
const _u = {
  name: "setextUnderline",
  resolveTo: wk,
  tokenize: bk
};
function wk(t, e) {
  const n = new Yi();
  let r = t.length, i, s, o;
  for (; r--; )
    if (t[r][0] === "enter") {
      if (t[r][1].type === "content") {
        i = r;
        break;
      }
      t[r][1].type === "paragraph" && (s = r);
    } else
      t[r][1].type === "content" && n.add(r, 1, []), !o && t[r][1].type === "definition" && (o = r);
  const l = {
    type: "setextHeading",
    start: {
      ...t[i][1].start
    },
    end: {
      ...t[t.length - 1][1].end
    }
  };
  return t[s][1].type = "setextHeadingText", o ? (n.add(s, 0, [["enter", l, e]]), n.add(o + 1, 0, [["exit", t[i][1], e]]), t[i][1].end = {
    ...t[o][1].end
  }) : t[i][1] = l, n.add(t.length, 0, [["exit", l, e]]), n.consume(t), t;
}
function bk(t, e, n) {
  const r = this;
  let i;
  return s;
  function s(u) {
    let c = r.events.length, h;
    for (; c--; )
      if (r.events[c][1].type !== "lineEnding" && r.events[c][1].type !== "linePrefix" && r.events[c][1].type !== "content") {
        h = r.events[c][1].type === "paragraph";
        break;
      }
    return !r.parser.lazy[r.now().line] && (r.interrupt || h) ? (t.enter("setextHeadingLine"), i = u, o(u)) : n(u);
  }
  function o(u) {
    return t.enter("setextHeadingLineSequence"), l(u);
  }
  function l(u) {
    return u === i ? (t.consume(u), l) : (t.exit("setextHeadingLineSequence"), ge(u) ? xe(t, a, "lineSuffix")(u) : a(u));
  }
  function a(u) {
    return u === null || oe(u) ? (t.exit("setextHeadingLine"), e(u)) : n(u);
  }
}
const xk = {
  tokenize: Ck
};
function Ck(t) {
  const e = this, n = t.attempt(
    // Try to parse a blank line.
    ni,
    r,
    // Try to parse initial flow (essentially, only code).
    t.attempt(this.parser.constructs.flowInitial, i, xe(t, t.attempt(this.parser.constructs.flow, i, t.attempt(Ey, i)), "linePrefix"))
  );
  return n;
  function r(s) {
    if (s === null) {
      t.consume(s);
      return;
    }
    return t.enter("lineEndingBlank"), t.consume(s), t.exit("lineEndingBlank"), e.currentConstruct = void 0, n;
  }
  function i(s) {
    if (s === null) {
      t.consume(s);
      return;
    }
    return t.enter("lineEnding"), t.consume(s), t.exit("lineEnding"), e.currentConstruct = void 0, n;
  }
}
const Sk = {
  resolveAll: Kh()
}, vk = qh("string"), Nk = qh("text");
function qh(t) {
  return {
    resolveAll: Kh(t === "text" ? Ik : void 0),
    tokenize: e
  };
  function e(n) {
    const r = this, i = this.parser.constructs[t], s = n.attempt(i, o, l);
    return o;
    function o(c) {
      return u(c) ? s(c) : l(c);
    }
    function l(c) {
      if (c === null) {
        n.consume(c);
        return;
      }
      return n.enter("data"), n.consume(c), a;
    }
    function a(c) {
      return u(c) ? (n.exit("data"), s(c)) : (n.consume(c), a);
    }
    function u(c) {
      if (c === null)
        return !0;
      const h = i[c];
      let d = -1;
      if (h)
        for (; ++d < h.length; ) {
          const f = h[d];
          if (!f.previous || f.previous.call(r, r.previous))
            return !0;
        }
      return !1;
    }
  }
}
function Kh(t) {
  return e;
  function e(n, r) {
    let i = -1, s;
    for (; ++i <= n.length; )
      s === void 0 ? n[i] && n[i][1].type === "data" && (s = i, i++) : (!n[i] || n[i][1].type !== "data") && (i !== s + 2 && (n[s][1].end = n[i - 1][1].end, n.splice(s + 2, i - s - 2), i = s + 2), s = void 0);
    return t ? t(n, r) : n;
  }
}
function Ik(t, e) {
  const n = new Yi();
  let r = 0;
  for (; ++r <= t.length; )
    if ((r === t.length || t[r][1].type === "lineEnding") && t[r - 1][1].type === "data") {
      const i = t[r - 1][1], s = e.sliceStream(i);
      let o = s.length, l = -1, a = 0, u;
      for (; o--; ) {
        const c = s[o];
        if (typeof c == "string") {
          for (l = c.length; c.charCodeAt(l - 1) === 32; )
            a++, l--;
          if (l)
            break;
          l = -1;
        } else if (c === -2)
          u = !0, a++;
        else if (c !== -1) {
          o++;
          break;
        }
      }
      if (e._contentTypeTextTrailing && r === t.length && (a = 0), a) {
        const c = {
          type: r === t.length || u || a < 2 ? "lineSuffix" : "hardBreakTrailing",
          start: {
            _bufferIndex: o ? l : i.start._bufferIndex + l,
            _index: i.start._index + o,
            line: i.end.line,
            column: i.end.column - a,
            offset: i.end.offset - a
          },
          end: {
            ...i.end
          }
        };
        i.end = {
          ...c.start
        }, i.start.offset === i.end.offset ? Object.assign(i, c) : n.add(r, 0, [["enter", c, e], ["exit", c, e]]);
      }
      r++;
    }
  return n.consume(t), t;
}
const _k = {
  42: et,
  43: et,
  45: et,
  48: et,
  49: et,
  50: et,
  51: et,
  52: et,
  53: et,
  54: et,
  55: et,
  56: et,
  57: et,
  62: Bh
}, Tk = {
  91: zy
}, Ak = {
  [-2]: Ls,
  [-1]: Ls,
  32: Ls
}, Ek = {
  35: jy,
  42: Di,
  45: [_u, Di],
  60: Hy,
  61: _u,
  95: Di,
  96: Iu,
  126: Iu
}, Mk = {
  38: $h,
  92: Fh
}, Ok = {
  [-5]: Bs,
  [-4]: Bs,
  [-3]: Bs,
  33: ok,
  38: $h,
  42: Ro,
  60: [hy, Gy],
  91: ak,
  92: [Fy, Fh],
  93: Tl,
  95: Ro,
  96: vy
}, Dk = {
  null: [Ro, Sk]
}, Rk = {
  null: [42, 95]
}, zk = {
  null: []
}, Pk = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  attentionMarkers: Rk,
  contentInitial: Tk,
  disable: zk,
  document: _k,
  flow: Ek,
  flowInitial: Ak,
  insideSpan: Dk,
  string: Mk,
  text: Ok
}, Symbol.toStringTag, { value: "Module" }));
function Lk(t, e, n) {
  let r = {
    _bufferIndex: -1,
    _index: 0,
    line: n && n.line || 1,
    column: n && n.column || 1,
    offset: n && n.offset || 0
  };
  const i = {}, s = [];
  let o = [], l = [];
  const a = {
    attempt: M(E),
    check: M(v),
    consume: b,
    enter: x,
    exit: A,
    interrupt: M(v, {
      interrupt: !0
    })
  }, u = {
    code: null,
    containerState: {},
    defineSkip: m,
    events: [],
    now: p,
    parser: t,
    previous: null,
    sliceSerialize: d,
    sliceStream: f,
    write: h
  };
  let c = e.tokenize.call(u, a);
  return e.resolveAll && s.push(e), u;
  function h(V) {
    return o = wt(o, V), y(), o[o.length - 1] !== null ? [] : (R(e, 0), u.events = ws(s, u.events, u), u.events);
  }
  function d(V, S) {
    return Fk(f(V), S);
  }
  function f(V) {
    return Bk(o, V);
  }
  function p() {
    const {
      _bufferIndex: V,
      _index: S,
      line: F,
      column: w,
      offset: $
    } = r;
    return {
      _bufferIndex: V,
      _index: S,
      line: F,
      column: w,
      offset: $
    };
  }
  function m(V) {
    i[V.line] = V.column, T();
  }
  function y() {
    for (; r._index < o.length; ) {
      const V = o[r._index];
      if (typeof V == "string") {
        const S = r._index;
        for (r._bufferIndex < 0 && (r._bufferIndex = 0); r._index === S && r._bufferIndex < V.length; )
          g(V.charCodeAt(r._bufferIndex));
      } else
        g(V);
    }
  }
  function g(V) {
    c = c(V);
  }
  function b(V) {
    oe(V) ? (r.line++, r.column = 1, r.offset += V === -3 ? 2 : 1, T()) : V !== -1 && (r.column++, r.offset++), r._bufferIndex < 0 ? r._index++ : (r._bufferIndex++, r._bufferIndex === // Points w/ non-negative `_bufferIndex` reference
    // strings.
    /** @type {string} */
    o[r._index].length && (r._bufferIndex = -1, r._index++)), u.previous = V;
  }
  function x(V, S) {
    const F = S || {};
    return F.type = V, F.start = p(), u.events.push(["enter", F, u]), l.push(F), F;
  }
  function A(V) {
    const S = l.pop();
    return S.end = p(), u.events.push(["exit", S, u]), S;
  }
  function E(V, S) {
    R(V, S.from);
  }
  function v(V, S) {
    S.restore();
  }
  function M(V, S) {
    return F;
    function F(w, $, ie) {
      let U, le, Z, I;
      return Array.isArray(w) ? (
        /* c8 ignore next 1 */
        P(w)
      ) : "tokenize" in w ? (
        // Looks like a construct.
        P([
          /** @type {Construct} */
          w
        ])
      ) : B(w);
      function B(me) {
        return Oe;
        function Oe(de) {
          const ye = de !== null && me[de], _e = de !== null && me.null, Ie = [
            // To do: add more extension tests.
            /* c8 ignore next 2 */
            ...Array.isArray(ye) ? ye : ye ? [ye] : [],
            ...Array.isArray(_e) ? _e : _e ? [_e] : []
          ];
          return P(Ie)(de);
        }
      }
      function P(me) {
        return U = me, le = 0, me.length === 0 ? ie : N(me[le]);
      }
      function N(me) {
        return Oe;
        function Oe(de) {
          return I = O(), Z = me, me.partial || (u.currentConstruct = me), me.name && u.parser.constructs.disable.null.includes(me.name) ? X() : me.tokenize.call(
            // If we do have fields, create an object w/ `context` as its
            // prototype.
            // This allows a “live binding”, which is needed for `interrupt`.
            S ? Object.assign(Object.create(u), S) : u,
            a,
            ee,
            X
          )(de);
        }
      }
      function ee(me) {
        return V(Z, I), $;
      }
      function X(me) {
        return I.restore(), ++le < U.length ? N(U[le]) : ie;
      }
    }
  }
  function R(V, S) {
    V.resolveAll && !s.includes(V) && s.push(V), V.resolve && Tt(u.events, S, u.events.length - S, V.resolve(u.events.slice(S), u)), V.resolveTo && (u.events = V.resolveTo(u.events, u));
  }
  function O() {
    const V = p(), S = u.previous, F = u.currentConstruct, w = u.events.length, $ = Array.from(l);
    return {
      from: w,
      restore: ie
    };
    function ie() {
      r = V, u.previous = S, u.currentConstruct = F, u.events.length = w, l = $, T();
    }
  }
  function T() {
    r.line in i && r.column < 2 && (r.column = i[r.line], r.offset += i[r.line] - 1);
  }
}
function Bk(t, e) {
  const n = e.start._index, r = e.start._bufferIndex, i = e.end._index, s = e.end._bufferIndex;
  let o;
  if (n === i)
    o = [t[n].slice(r, s)];
  else {
    if (o = t.slice(n, i), r > -1) {
      const l = o[0];
      typeof l == "string" ? o[0] = l.slice(r) : o.shift();
    }
    s > 0 && o.push(t[i].slice(0, s));
  }
  return o;
}
function Fk(t, e) {
  let n = -1;
  const r = [];
  let i;
  for (; ++n < t.length; ) {
    const s = t[n];
    let o;
    if (typeof s == "string")
      o = s;
    else
      switch (s) {
        case -5: {
          o = "\r";
          break;
        }
        case -4: {
          o = `
`;
          break;
        }
        case -3: {
          o = `\r
`;
          break;
        }
        case -2: {
          o = e ? " " : "	";
          break;
        }
        case -1: {
          if (!e && i)
            continue;
          o = " ";
          break;
        }
        default:
          o = String.fromCharCode(s);
      }
    i = s === -2, r.push(o);
  }
  return r.join("");
}
function $k(t) {
  const r = {
    constructs: (
      /** @type {FullNormalizedExtension} */
      Rh([Pk, ...(t || {}).extensions || []])
    ),
    content: i(iy),
    defined: [],
    document: i(oy),
    flow: i(xk),
    lazy: {},
    string: i(vk),
    text: i(Nk)
  };
  return r;
  function i(s) {
    return o;
    function o(l) {
      return Lk(r, s, l);
    }
  }
}
function jk(t) {
  for (; !jh(t); )
    ;
  return t;
}
const Tu = /[\0\t\n\r]/g;
function Vk() {
  let t = 1, e = "", n = !0, r;
  return i;
  function i(s, o, l) {
    s = e + (typeof s == "string" ? s.toString() : new TextDecoder(o || void 0).decode(s));
    const a = [];
    let u = 0;
    for (e = "", n && (s.charCodeAt(0) === 65279 && u++, n = void 0); u < s.length; ) {
      Tu.lastIndex = u;
      const c = Tu.exec(s), h = c && c.index !== void 0 ? c.index : s.length, d = s.charCodeAt(h);
      if (!c) {
        e = s.slice(u);
        break;
      }
      if (d === 10 && u === h && r)
        a.push(-3), r = void 0;
      else
        switch (r && (a.push(-5), r = void 0), u < h && (a.push(s.slice(u, h)), t += h - u), d) {
          case 0: {
            a.push(65533), t++;
            break;
          }
          case 9: {
            const f = Math.ceil(t / 4) * 4;
            for (a.push(-2); t++ < f; )
              a.push(-1);
            break;
          }
          case 10: {
            a.push(-4), t = 1;
            break;
          }
          default:
            r = !0, t = 1;
        }
      u = h + 1;
    }
    return l && (r && a.push(-5), e && a.push(e), a.push(null)), a;
  }
}
const Wk = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
function Jh(t) {
  return t.replace(Wk, Hk);
}
function Hk(t, e, n) {
  if (e)
    return e;
  if (n.charCodeAt(0) === 35) {
    const i = n.charCodeAt(1), s = i === 120 || i === 88;
    return zh(n.slice(s ? 2 : 1), s ? 16 : 10);
  }
  return _l(n) || t;
}
function Mr(t) {
  return !t || typeof t != "object" ? "" : "position" in t || "type" in t ? Au(t.position) : "start" in t || "end" in t ? Au(t) : "line" in t || "column" in t ? Lo(t) : "";
}
function Lo(t) {
  return Eu(t && t.line) + ":" + Eu(t && t.column);
}
function Au(t) {
  return Lo(t && t.start) + "-" + Lo(t && t.end);
}
function Eu(t) {
  return t && typeof t == "number" ? t : 1;
}
const Gh = {}.hasOwnProperty;
function Uk(t, e, n) {
  return e && typeof e == "object" && (n = e, e = void 0), qk(n)(jk($k(n).document().write(Vk()(t, e, !0))));
}
function qk(t) {
  const e = {
    transforms: [],
    canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
    enter: {
      autolink: s(D),
      autolinkProtocol: O,
      autolinkEmail: O,
      atxHeading: s(H),
      blockQuote: s(_e),
      characterEscape: O,
      characterReference: O,
      codeFenced: s(Ie),
      codeFencedFenceInfo: o,
      codeFencedFenceMeta: o,
      codeIndented: s(Ie, o),
      codeText: s(gt, o),
      codeTextData: O,
      data: O,
      codeFlowValue: O,
      definition: s(lt),
      definitionDestinationString: o,
      definitionLabelString: o,
      definitionTitleString: o,
      emphasis: s(k),
      hardBreakEscape: s(j),
      hardBreakTrailing: s(j),
      htmlFlow: s(_, o),
      htmlFlowData: O,
      htmlText: s(_, o),
      htmlTextData: O,
      image: s(C),
      label: o,
      link: s(D),
      listItem: s(G),
      listItemValue: d,
      listOrdered: s(q, h),
      listUnordered: s(q),
      paragraph: s(L),
      reference: N,
      referenceString: o,
      resourceDestinationString: o,
      resourceTitleString: o,
      setextHeading: s(H),
      strong: s(Y),
      thematicBreak: s(Q)
    },
    exit: {
      atxHeading: a(),
      atxHeadingSequence: E,
      autolink: a(),
      autolinkEmail: ye,
      autolinkProtocol: de,
      blockQuote: a(),
      characterEscapeValue: T,
      characterReferenceMarkerHexadecimal: X,
      characterReferenceMarkerNumeric: X,
      characterReferenceValue: me,
      characterReference: Oe,
      codeFenced: a(y),
      codeFencedFence: m,
      codeFencedFenceInfo: f,
      codeFencedFenceMeta: p,
      codeFlowValue: T,
      codeIndented: a(g),
      codeText: a($),
      codeTextData: T,
      data: T,
      definition: a(),
      definitionDestinationString: A,
      definitionLabelString: b,
      definitionTitleString: x,
      emphasis: a(),
      hardBreakEscape: a(S),
      hardBreakTrailing: a(S),
      htmlFlow: a(F),
      htmlFlowData: T,
      htmlText: a(w),
      htmlTextData: T,
      image: a(U),
      label: Z,
      labelText: le,
      lineEnding: V,
      link: a(ie),
      listItem: a(),
      listOrdered: a(),
      listUnordered: a(),
      paragraph: a(),
      referenceString: ee,
      resourceDestinationString: I,
      resourceTitleString: B,
      resource: P,
      setextHeading: a(R),
      setextHeadingLineSequence: M,
      setextHeadingText: v,
      strong: a(),
      thematicBreak: a()
    }
  };
  Zh(e, (t || {}).mdastExtensions || []);
  const n = {};
  return r;
  function r(z) {
    let J = {
      type: "root",
      children: []
    };
    const te = {
      stack: [J],
      tokenStack: [],
      config: e,
      enter: l,
      exit: u,
      buffer: o,
      resume: c,
      data: n
    }, ue = [];
    let we = -1;
    for (; ++we < z.length; )
      if (z[we][1].type === "listOrdered" || z[we][1].type === "listUnordered")
        if (z[we][0] === "enter")
          ue.push(we);
        else {
          const De = ue.pop();
          we = i(z, De, we);
        }
    for (we = -1; ++we < z.length; ) {
      const De = e[z[we][0]];
      Gh.call(De, z[we][1].type) && De[z[we][1].type].call(Object.assign({
        sliceSerialize: z[we][2].sliceSerialize
      }, te), z[we][1]);
    }
    if (te.tokenStack.length > 0) {
      const De = te.tokenStack[te.tokenStack.length - 1];
      (De[1] || Mu).call(te, void 0, De[0]);
    }
    for (J.position = {
      start: sn(z.length > 0 ? z[0][1].start : {
        line: 1,
        column: 1,
        offset: 0
      }),
      end: sn(z.length > 0 ? z[z.length - 2][1].end : {
        line: 1,
        column: 1,
        offset: 0
      })
    }, we = -1; ++we < e.transforms.length; )
      J = e.transforms[we](J) || J;
    return J;
  }
  function i(z, J, te) {
    let ue = J - 1, we = -1, De = !1, at, Ce, Ot, jt;
    for (; ++ue <= te; ) {
      const Ee = z[ue];
      switch (Ee[1].type) {
        case "listUnordered":
        case "listOrdered":
        case "blockQuote": {
          Ee[0] === "enter" ? we++ : we--, jt = void 0;
          break;
        }
        case "lineEndingBlank": {
          Ee[0] === "enter" && (at && !jt && !we && !Ot && (Ot = ue), jt = void 0);
          break;
        }
        case "linePrefix":
        case "listItemValue":
        case "listItemMarker":
        case "listItemPrefix":
        case "listItemPrefixWhitespace":
          break;
        default:
          jt = void 0;
      }
      if (!we && Ee[0] === "enter" && Ee[1].type === "listItemPrefix" || we === -1 && Ee[0] === "exit" && (Ee[1].type === "listUnordered" || Ee[1].type === "listOrdered")) {
        if (at) {
          let Vt = ue;
          for (Ce = void 0; Vt--; ) {
            const It = z[Vt];
            if (It[1].type === "lineEnding" || It[1].type === "lineEndingBlank") {
              if (It[0] === "exit") continue;
              Ce && (z[Ce][1].type = "lineEndingBlank", De = !0), It[1].type = "lineEnding", Ce = Vt;
            } else if (!(It[1].type === "linePrefix" || It[1].type === "blockQuotePrefix" || It[1].type === "blockQuotePrefixWhitespace" || It[1].type === "blockQuoteMarker" || It[1].type === "listItemIndent")) break;
          }
          Ot && (!Ce || Ot < Ce) && (at._spread = !0), at.end = Object.assign({}, Ce ? z[Ce][1].start : Ee[1].end), z.splice(Ce || ue, 0, ["exit", at, Ee[2]]), ue++, te++;
        }
        if (Ee[1].type === "listItemPrefix") {
          const Vt = {
            type: "listItem",
            _spread: !1,
            start: Object.assign({}, Ee[1].start),
            // @ts-expect-error: we’ll add `end` in a second.
            end: void 0
          };
          at = Vt, z.splice(ue, 0, ["enter", Vt, Ee[2]]), ue++, te++, Ot = void 0, jt = !0;
        }
      }
    }
    return z[J][1]._spread = De, te;
  }
  function s(z, J) {
    return te;
    function te(ue) {
      l.call(this, z(ue), ue), J && J.call(this, ue);
    }
  }
  function o() {
    this.stack.push({
      type: "fragment",
      children: []
    });
  }
  function l(z, J, te) {
    this.stack[this.stack.length - 1].children.push(z), this.stack.push(z), this.tokenStack.push([J, te || void 0]), z.position = {
      start: sn(J.start),
      // @ts-expect-error: `end` will be patched later.
      end: void 0
    };
  }
  function a(z) {
    return J;
    function J(te) {
      z && z.call(this, te), u.call(this, te);
    }
  }
  function u(z, J) {
    const te = this.stack.pop(), ue = this.tokenStack.pop();
    if (ue)
      ue[0].type !== z.type && (J ? J.call(this, z, ue[0]) : (ue[1] || Mu).call(this, z, ue[0]));
    else throw new Error("Cannot close `" + z.type + "` (" + Mr({
      start: z.start,
      end: z.end
    }) + "): it’s not open");
    te.position.end = sn(z.end);
  }
  function c() {
    return Il(this.stack.pop());
  }
  function h() {
    this.data.expectingFirstListItemValue = !0;
  }
  function d(z) {
    if (this.data.expectingFirstListItemValue) {
      const J = this.stack[this.stack.length - 2];
      J.start = Number.parseInt(this.sliceSerialize(z), 10), this.data.expectingFirstListItemValue = void 0;
    }
  }
  function f() {
    const z = this.resume(), J = this.stack[this.stack.length - 1];
    J.lang = z;
  }
  function p() {
    const z = this.resume(), J = this.stack[this.stack.length - 1];
    J.meta = z;
  }
  function m() {
    this.data.flowCodeInside || (this.buffer(), this.data.flowCodeInside = !0);
  }
  function y() {
    const z = this.resume(), J = this.stack[this.stack.length - 1];
    J.value = z.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, ""), this.data.flowCodeInside = void 0;
  }
  function g() {
    const z = this.resume(), J = this.stack[this.stack.length - 1];
    J.value = z.replace(/(\r?\n|\r)$/g, "");
  }
  function b(z) {
    const J = this.resume(), te = this.stack[this.stack.length - 1];
    te.label = J, te.identifier = At(this.sliceSerialize(z)).toLowerCase();
  }
  function x() {
    const z = this.resume(), J = this.stack[this.stack.length - 1];
    J.title = z;
  }
  function A() {
    const z = this.resume(), J = this.stack[this.stack.length - 1];
    J.url = z;
  }
  function E(z) {
    const J = this.stack[this.stack.length - 1];
    if (!J.depth) {
      const te = this.sliceSerialize(z).length;
      J.depth = te;
    }
  }
  function v() {
    this.data.setextHeadingSlurpLineEnding = !0;
  }
  function M(z) {
    const J = this.stack[this.stack.length - 1];
    J.depth = this.sliceSerialize(z).codePointAt(0) === 61 ? 1 : 2;
  }
  function R() {
    this.data.setextHeadingSlurpLineEnding = void 0;
  }
  function O(z) {
    const te = this.stack[this.stack.length - 1].children;
    let ue = te[te.length - 1];
    (!ue || ue.type !== "text") && (ue = re(), ue.position = {
      start: sn(z.start),
      // @ts-expect-error: we’ll add `end` later.
      end: void 0
    }, te.push(ue)), this.stack.push(ue);
  }
  function T(z) {
    const J = this.stack.pop();
    J.value += this.sliceSerialize(z), J.position.end = sn(z.end);
  }
  function V(z) {
    const J = this.stack[this.stack.length - 1];
    if (this.data.atHardBreak) {
      const te = J.children[J.children.length - 1];
      te.position.end = sn(z.end), this.data.atHardBreak = void 0;
      return;
    }
    !this.data.setextHeadingSlurpLineEnding && e.canContainEols.includes(J.type) && (O.call(this, z), T.call(this, z));
  }
  function S() {
    this.data.atHardBreak = !0;
  }
  function F() {
    const z = this.resume(), J = this.stack[this.stack.length - 1];
    J.value = z;
  }
  function w() {
    const z = this.resume(), J = this.stack[this.stack.length - 1];
    J.value = z;
  }
  function $() {
    const z = this.resume(), J = this.stack[this.stack.length - 1];
    J.value = z;
  }
  function ie() {
    const z = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const J = this.data.referenceType || "shortcut";
      z.type += "Reference", z.referenceType = J, delete z.url, delete z.title;
    } else
      delete z.identifier, delete z.label;
    this.data.referenceType = void 0;
  }
  function U() {
    const z = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const J = this.data.referenceType || "shortcut";
      z.type += "Reference", z.referenceType = J, delete z.url, delete z.title;
    } else
      delete z.identifier, delete z.label;
    this.data.referenceType = void 0;
  }
  function le(z) {
    const J = this.sliceSerialize(z), te = this.stack[this.stack.length - 2];
    te.label = Jh(J), te.identifier = At(J).toLowerCase();
  }
  function Z() {
    const z = this.stack[this.stack.length - 1], J = this.resume(), te = this.stack[this.stack.length - 1];
    if (this.data.inReference = !0, te.type === "link") {
      const ue = z.children;
      te.children = ue;
    } else
      te.alt = J;
  }
  function I() {
    const z = this.resume(), J = this.stack[this.stack.length - 1];
    J.url = z;
  }
  function B() {
    const z = this.resume(), J = this.stack[this.stack.length - 1];
    J.title = z;
  }
  function P() {
    this.data.inReference = void 0;
  }
  function N() {
    this.data.referenceType = "collapsed";
  }
  function ee(z) {
    const J = this.resume(), te = this.stack[this.stack.length - 1];
    te.label = J, te.identifier = At(this.sliceSerialize(z)).toLowerCase(), this.data.referenceType = "full";
  }
  function X(z) {
    this.data.characterReferenceType = z.type;
  }
  function me(z) {
    const J = this.sliceSerialize(z), te = this.data.characterReferenceType;
    let ue;
    te ? (ue = zh(J, te === "characterReferenceMarkerNumeric" ? 10 : 16), this.data.characterReferenceType = void 0) : ue = _l(J);
    const we = this.stack[this.stack.length - 1];
    we.value += ue;
  }
  function Oe(z) {
    const J = this.stack.pop();
    J.position.end = sn(z.end);
  }
  function de(z) {
    T.call(this, z);
    const J = this.stack[this.stack.length - 1];
    J.url = this.sliceSerialize(z);
  }
  function ye(z) {
    T.call(this, z);
    const J = this.stack[this.stack.length - 1];
    J.url = "mailto:" + this.sliceSerialize(z);
  }
  function _e() {
    return {
      type: "blockquote",
      children: []
    };
  }
  function Ie() {
    return {
      type: "code",
      lang: null,
      meta: null,
      value: ""
    };
  }
  function gt() {
    return {
      type: "inlineCode",
      value: ""
    };
  }
  function lt() {
    return {
      type: "definition",
      identifier: "",
      label: null,
      title: null,
      url: ""
    };
  }
  function k() {
    return {
      type: "emphasis",
      children: []
    };
  }
  function H() {
    return {
      type: "heading",
      // @ts-expect-error `depth` will be set later.
      depth: 0,
      children: []
    };
  }
  function j() {
    return {
      type: "break"
    };
  }
  function _() {
    return {
      type: "html",
      value: ""
    };
  }
  function C() {
    return {
      type: "image",
      title: null,
      url: "",
      alt: null
    };
  }
  function D() {
    return {
      type: "link",
      title: null,
      url: "",
      children: []
    };
  }
  function q(z) {
    return {
      type: "list",
      ordered: z.type === "listOrdered",
      start: null,
      spread: z._spread,
      children: []
    };
  }
  function G(z) {
    return {
      type: "listItem",
      spread: z._spread,
      checked: null,
      children: []
    };
  }
  function L() {
    return {
      type: "paragraph",
      children: []
    };
  }
  function Y() {
    return {
      type: "strong",
      children: []
    };
  }
  function re() {
    return {
      type: "text",
      value: ""
    };
  }
  function Q() {
    return {
      type: "thematicBreak"
    };
  }
}
function sn(t) {
  return {
    line: t.line,
    column: t.column,
    offset: t.offset
  };
}
function Zh(t, e) {
  let n = -1;
  for (; ++n < e.length; ) {
    const r = e[n];
    Array.isArray(r) ? Zh(t, r) : Kk(t, r);
  }
}
function Kk(t, e) {
  let n;
  for (n in e)
    if (Gh.call(e, n))
      switch (n) {
        case "canContainEols": {
          const r = e[n];
          r && t[n].push(...r);
          break;
        }
        case "transforms": {
          const r = e[n];
          r && t[n].push(...r);
          break;
        }
        case "enter":
        case "exit": {
          const r = e[n];
          r && Object.assign(t[n], r);
          break;
        }
      }
}
function Mu(t, e) {
  throw t ? new Error("Cannot close `" + t.type + "` (" + Mr({
    start: t.start,
    end: t.end
  }) + "): a different token (`" + e.type + "`, " + Mr({
    start: e.start,
    end: e.end
  }) + ") is open") : new Error("Cannot close document, a token (`" + e.type + "`, " + Mr({
    start: e.start,
    end: e.end
  }) + ") is still open");
}
function Bo(t) {
  const e = this;
  e.parser = n;
  function n(r) {
    return Uk(r, {
      ...e.data("settings"),
      ...t,
      // Note: these options are not in the readme.
      // The goal is for them to be set by plugins on `data` instead of being
      // passed by users.
      extensions: e.data("micromarkExtensions") || [],
      mdastExtensions: e.data("fromMarkdownExtensions") || []
    });
  }
}
const bs = (
  // Note: overloads in JSDoc can’t yet use different `@template`s.
  /**
   * @type {(
   *   (<Condition extends string>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & {type: Condition}) &
   *   (<Condition extends Props>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Condition) &
   *   (<Condition extends TestFunction>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Predicate<Condition, Node>) &
   *   ((test?: null | undefined) => (node?: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node) &
   *   ((test?: Test) => Check)
   * )}
   */
  /**
   * @param {Test} [test]
   * @returns {Check}
   */
  (function(t) {
    if (t == null)
      return Yk;
    if (typeof t == "function")
      return xs(t);
    if (typeof t == "object")
      return Array.isArray(t) ? Jk(t) : (
        // Cast because `ReadonlyArray` goes into the above but `isArray`
        // narrows to `Array`.
        Gk(
          /** @type {Props} */
          t
        )
      );
    if (typeof t == "string")
      return Zk(t);
    throw new Error("Expected function, string, or object as test");
  })
);
function Jk(t) {
  const e = [];
  let n = -1;
  for (; ++n < t.length; )
    e[n] = bs(t[n]);
  return xs(r);
  function r(...i) {
    let s = -1;
    for (; ++s < e.length; )
      if (e[s].apply(this, i)) return !0;
    return !1;
  }
}
function Gk(t) {
  const e = (
    /** @type {Record<string, unknown>} */
    t
  );
  return xs(n);
  function n(r) {
    const i = (
      /** @type {Record<string, unknown>} */
      /** @type {unknown} */
      r
    );
    let s;
    for (s in t)
      if (i[s] !== e[s]) return !1;
    return !0;
  }
}
function Zk(t) {
  return xs(e);
  function e(n) {
    return n && n.type === t;
  }
}
function xs(t) {
  return e;
  function e(n, r, i) {
    return !!(Xk(n) && t.call(
      this,
      n,
      typeof r == "number" ? r : void 0,
      i || void 0
    ));
  }
}
function Yk() {
  return !0;
}
function Xk(t) {
  return t !== null && typeof t == "object" && "type" in t;
}
const Yh = (
  /** @type {(node?: unknown) => node is Exclude<PhrasingContent, Html>} */
  bs([
    "break",
    "delete",
    "emphasis",
    // To do: next major: removed since footnotes were added to GFM.
    "footnote",
    "footnoteReference",
    "image",
    "imageReference",
    "inlineCode",
    // Enabled by `mdast-util-math`:
    "inlineMath",
    "link",
    "linkReference",
    // Enabled by `mdast-util-mdx`:
    "mdxJsxTextElement",
    // Enabled by `mdast-util-mdx`:
    "mdxTextExpression",
    "strong",
    "text",
    // Enabled by `mdast-util-directive`:
    "textDirective"
  ])
), Ou = {}.hasOwnProperty;
function Qk(t, e) {
  const n = e || {};
  function r(i, ...s) {
    let o = r.invalid;
    const l = r.handlers;
    if (i && Ou.call(i, t)) {
      const a = String(i[t]);
      o = Ou.call(l, a) ? l[a] : r.unknown;
    }
    if (o)
      return o.call(this, i, ...s);
  }
  return r.handlers = n.handlers || {}, r.invalid = n.invalid, r.unknown = n.unknown, r;
}
const ew = {}.hasOwnProperty;
function Xh(t, e) {
  let n = -1, r;
  if (e.extensions)
    for (; ++n < e.extensions.length; )
      Xh(t, e.extensions[n]);
  for (r in e)
    if (ew.call(e, r))
      switch (r) {
        case "extensions":
          break;
        /* c8 ignore next 4 */
        case "unsafe": {
          Du(t[r], e[r]);
          break;
        }
        case "join": {
          Du(t[r], e[r]);
          break;
        }
        case "handlers": {
          tw(t[r], e[r]);
          break;
        }
        default:
          t.options[r] = e[r];
      }
  return t;
}
function Du(t, e) {
  e && t.push(...e);
}
function tw(t, e) {
  e && Object.assign(t, e);
}
function nw(t, e, n, r) {
  const i = n.enter("blockquote"), s = n.createTracker(r);
  s.move("> "), s.shift(2);
  const o = n.indentLines(
    n.containerFlow(t, s.current()),
    rw
  );
  return i(), o;
}
function rw(t, e, n) {
  return ">" + (n ? "" : " ") + t;
}
function Qh(t, e) {
  return Ru(t, e.inConstruct, !0) && !Ru(t, e.notInConstruct, !1);
}
function Ru(t, e, n) {
  if (typeof e == "string" && (e = [e]), !e || e.length === 0)
    return n;
  let r = -1;
  for (; ++r < e.length; )
    if (t.includes(e[r]))
      return !0;
  return !1;
}
function zu(t, e, n, r) {
  let i = -1;
  for (; ++i < n.unsafe.length; ) {
    const s = n.unsafe[i];
    if (s.character === `
` && !s.before && !s.after && Qh(n.stack, s))
      return /[\t ]/.test(r.before) ? "" : " ";
  }
  return `\\
`;
}
function iw(t, e) {
  const n = String(t);
  let r = n.indexOf(e), i = r, s = 0, o = 0;
  if (typeof e != "string")
    throw new TypeError("Expected substring");
  for (; r !== -1; )
    r === i ? ++s > o && (o = s) : s = 1, i = r + e.length, r = n.indexOf(e, i);
  return o;
}
function Fo(t, e) {
  return !!(e.options.fences === !1 && t.value && // If there’s no info…
  !t.lang && // And there’s a non-whitespace character…
  /[^\n\r ]/.test(t.value) && // And the value doesn’t start or end in a blank…
  !/^[\t ]*(?:[\n\r]|$)|(?:^|[\n\r])[\t ]*$/.test(t.value));
}
function sw(t) {
  const e = t.options.fence || "`";
  if (e !== "`" && e !== "~")
    throw new Error(
      "Cannot serialize code with `" + e + "` for `options.fence`, expected `` ` `` or `~`"
    );
  return e;
}
function ow(t, e, n, r) {
  const i = sw(n), s = t.value || "";
  if (Fo(t, n)) {
    const h = n.enter("codeIndented"), d = n.indentLines(s, lw);
    return h(), d;
  }
  const o = n.createTracker(r), l = i.repeat(Math.max(iw(s, i) + 1, 3)), a = n.enter("codeFenced"), u = i === "`" ? "GraveAccent" : "Tilde";
  let c = o.move(l);
  if (t.lang) {
    const h = n.enter(`codeFencedLang${u}`);
    c += o.move(
      n.safe(t.lang, {
        before: c,
        after: " ",
        encode: ["`"],
        ...o.current()
      })
    ), h();
  }
  if (t.lang && t.meta) {
    const h = n.enter(`codeFencedMeta${u}`);
    c += o.move(" "), c += o.move(
      n.safe(t.meta, {
        before: c,
        after: `
`,
        encode: ["`"],
        ...o.current()
      })
    ), h();
  }
  return c += o.move(`
`), s && (c += o.move(s + `
`)), c += o.move(l), a(), c;
}
function lw(t, e, n) {
  return (n ? "" : "    ") + t;
}
function Al(t) {
  const e = t.options.quote || '"';
  if (e !== '"' && e !== "'")
    throw new Error(
      "Cannot serialize title with `" + e + "` for `options.quote`, expected `\"`, or `'`"
    );
  return e;
}
function aw(t, e, n, r) {
  const i = Al(n), s = i === '"' ? "Quote" : "Apostrophe", o = n.enter("definition");
  let l = n.enter("label");
  const a = n.createTracker(r);
  let u = a.move("[");
  return u += a.move(
    n.safe(n.associationId(t), {
      before: u,
      after: "]",
      ...a.current()
    })
  ), u += a.move("]: "), l(), // If there’s no url, or…
  !t.url || // If there are control characters or whitespace.
  /[\0- \u007F]/.test(t.url) ? (l = n.enter("destinationLiteral"), u += a.move("<"), u += a.move(
    n.safe(t.url, { before: u, after: ">", ...a.current() })
  ), u += a.move(">")) : (l = n.enter("destinationRaw"), u += a.move(
    n.safe(t.url, {
      before: u,
      after: t.title ? " " : `
`,
      ...a.current()
    })
  )), l(), t.title && (l = n.enter(`title${s}`), u += a.move(" " + i), u += a.move(
    n.safe(t.title, {
      before: u,
      after: i,
      ...a.current()
    })
  ), u += a.move(i), l()), o(), u;
}
function uw(t) {
  const e = t.options.emphasis || "*";
  if (e !== "*" && e !== "_")
    throw new Error(
      "Cannot serialize emphasis with `" + e + "` for `options.emphasis`, expected `*`, or `_`"
    );
  return e;
}
El.attention = cw;
El.peek = hw;
function El(t, e, n, r) {
  const i = n.enter("phrasing"), s = n.containerPhrasing({ type: "root", children: [t] }, r);
  return i(), s;
}
function cw(t, e) {
  return {
    construct: "emphasis",
    markers: uw(e) === "*" ? ["*", "_"] : ["_", "*"],
    sizes: [1]
  };
}
function hw(t, e, n) {
  return n.options.emphasis || "*";
}
function Ml(t) {
  return "&#x" + t.toString(16).toUpperCase() + ";";
}
const ef = [], fw = !0, $o = !1, Xi = "skip";
function Ol(t, e, n, r) {
  let i;
  typeof e == "function" && typeof n != "function" ? (r = n, n = e) : i = e;
  const s = bs(i), o = r ? -1 : 1;
  l(t, void 0, [])();
  function l(a, u, c) {
    const h = (
      /** @type {Record<string, unknown>} */
      a && typeof a == "object" ? a : {}
    );
    if (typeof h.type == "string") {
      const f = (
        // `hast`
        typeof h.tagName == "string" ? h.tagName : (
          // `xast`
          typeof h.name == "string" ? h.name : void 0
        )
      );
      Object.defineProperty(d, "name", {
        value: "node (" + (a.type + (f ? "<" + f + ">" : "")) + ")"
      });
    }
    return d;
    function d() {
      let f = ef, p, m, y;
      if ((!e || s(a, u, c[c.length - 1] || void 0)) && (f = dw(n(a, c)), f[0] === $o))
        return f;
      if ("children" in a && a.children) {
        const g = (
          /** @type {UnistParent} */
          a
        );
        if (g.children && f[0] !== Xi)
          for (m = (r ? g.children.length : -1) + o, y = c.concat(g); m > -1 && m < g.children.length; ) {
            const b = g.children[m];
            if (p = l(b, m, y)(), p[0] === $o)
              return p;
            m = typeof p[1] == "number" ? p[1] : m + o;
          }
      }
      return f;
    }
  }
}
function dw(t) {
  return Array.isArray(t) ? t : typeof t == "number" ? [fw, t] : t == null ? ef : [t];
}
function hr(t, e, n, r) {
  let i, s, o;
  typeof e == "function" && typeof n != "function" ? (s = void 0, o = e, i = n) : (s = e, o = n, i = r), Ol(t, s, l, i);
  function l(a, u) {
    const c = u[u.length - 1], h = c ? c.children.indexOf(a) : void 0;
    return o(a, h, c);
  }
}
function tf(t, e) {
  let n = !1;
  return hr(t, function(r) {
    if ("value" in r && /\r?\n|\r/.test(r.value) || r.type === "break")
      return n = !0, $o;
  }), !!((!t.depth || t.depth < 3) && Il(t) && (e.options.setext || n));
}
function pw(t, e, n, r) {
  const i = Math.max(Math.min(6, t.depth || 1), 1), s = n.createTracker(r);
  if (tf(t, n)) {
    const h = n.enter("headingSetext"), d = n.enter("phrasing"), f = n.containerPhrasing(t, {
      ...s.current(),
      before: `
`,
      after: `
`
    });
    return d(), h(), f + `
` + (i === 1 ? "=" : "-").repeat(
      // The whole size…
      f.length - // Minus the position of the character after the last EOL (or
      // 0 if there is none)…
      (Math.max(f.lastIndexOf("\r"), f.lastIndexOf(`
`)) + 1)
    );
  }
  const o = "#".repeat(i), l = n.enter("headingAtx"), a = n.enter("phrasing");
  s.move(o + " ");
  let u = n.containerPhrasing(t, {
    before: "# ",
    after: `
`,
    ...s.current()
  });
  const c = u.charCodeAt(0);
  return (c === 9 || c === 32) && (u = Ml(c) + u.slice(1)), u = u ? o + " " + u : o, n.options.closeAtx && (u += " " + o), a(), l(), u;
}
nf.peek = mw;
function nf(t) {
  return t.value || "";
}
function mw() {
  return "<";
}
rf.peek = gw;
function rf(t, e, n, r) {
  const i = Al(n), s = i === '"' ? "Quote" : "Apostrophe", o = n.enter("image");
  let l = n.enter("label");
  const a = n.createTracker(r);
  let u = a.move("![");
  return u += a.move(
    n.safe(t.alt, { before: u, after: "]", ...a.current() })
  ), u += a.move("]("), l(), // If there’s no url but there is a title…
  !t.url && t.title || // If there are control characters or whitespace.
  /[\0- \u007F]/.test(t.url) ? (l = n.enter("destinationLiteral"), u += a.move("<"), u += a.move(
    n.safe(t.url, { before: u, after: ">", ...a.current() })
  ), u += a.move(">")) : (l = n.enter("destinationRaw"), u += a.move(
    n.safe(t.url, {
      before: u,
      after: t.title ? " " : ")",
      ...a.current()
    })
  )), l(), t.title && (l = n.enter(`title${s}`), u += a.move(" " + i), u += a.move(
    n.safe(t.title, {
      before: u,
      after: i,
      ...a.current()
    })
  ), u += a.move(i), l()), u += a.move(")"), o(), u;
}
function gw() {
  return "!";
}
sf.peek = yw;
function sf(t, e, n, r) {
  const i = t.referenceType, s = n.enter("imageReference");
  let o = n.enter("label");
  const l = n.createTracker(r);
  let a = l.move("![");
  const u = n.safe(t.alt, {
    before: a,
    after: "]",
    ...l.current()
  });
  a += l.move(u + "]["), o();
  const c = n.stack;
  n.stack = c.filter(function(d) {
    return d !== "phrasing";
  }), o = n.enter("reference");
  const h = n.safe(n.associationId(t), {
    before: a,
    after: "]",
    ...l.current()
  });
  return o(), n.stack = c, s(), i === "full" || !u || u !== h ? a += l.move(h + "]") : i === "shortcut" ? a = a.slice(0, -1) : a += l.move("]"), a;
}
function yw() {
  return "!";
}
of.peek = kw;
function of(t, e, n) {
  let r = t.value || "", i = "`", s = -1;
  for (; new RegExp("(^|[^`])" + i + "([^`]|$)").test(r); )
    i += "`";
  for (/[^\n\r ]/.test(r) && (/^[\n\r ]/.test(r) && /[\n\r ]$/.test(r) || /^`|`$/.test(r)) && (r = " " + r + " "); ++s < n.unsafe.length; ) {
    const o = n.unsafe[s], l = n.compilePattern(o);
    if (!o.atBreak) continue;
    let a;
    for (; a = l.exec(r); ) {
      let u = a.index;
      r.charCodeAt(u) === 10 && r.charCodeAt(u - 1) === 13 && u--, r = r.slice(0, u) + " " + r.slice(a.index + 1);
    }
  }
  return i + r + i;
}
function kw() {
  return "`";
}
function lf(t, e) {
  const n = Il(t);
  return !!(!e.options.resourceLink && // If there’s a url…
  t.url && // And there’s no title…
  !t.title && // And the content of `node` is a single text node…
  t.children && t.children.length === 1 && t.children[0].type === "text" && // And if the url is the same as the content…
  (n === t.url || "mailto:" + n === t.url) && // And that starts w/ a protocol…
  /^[a-z][+\-.a-z]+:/i.test(t.url) && // And that doesn’t contain ASCII control codes (character escapes and
  // references don’t work), space, or angle brackets…
  !/[\0- <>\u007F]/.test(t.url));
}
af.peek = ww;
function af(t, e, n, r) {
  const i = Al(n), s = i === '"' ? "Quote" : "Apostrophe", o = n.createTracker(r);
  if (lf(t, n)) {
    const c = n.stack;
    n.stack = c.filter(function(f) {
      return f !== "phrasing";
    });
    const h = n.enter("autolink");
    let d = o.move("<");
    return d += o.move(
      n.containerPhrasing(t, {
        before: d,
        after: ">",
        ...o.current()
      })
    ), d += o.move(">"), h(), n.stack = c, d;
  }
  const l = n.enter("link");
  let a = n.enter("label"), u = o.move("[");
  return u += o.move(
    n.containerPhrasing(t, {
      before: u,
      after: "](",
      ...o.current()
    })
  ), u += o.move("]("), a(), // If there’s no url but there is a title…
  !t.url && t.title || // If there are control characters or whitespace.
  /[\0- \u007F]/.test(t.url) ? (a = n.enter("destinationLiteral"), u += o.move("<"), u += o.move(
    n.safe(t.url, { before: u, after: ">", ...o.current() })
  ), u += o.move(">")) : (a = n.enter("destinationRaw"), u += o.move(
    n.safe(t.url, {
      before: u,
      after: t.title ? " " : ")",
      ...o.current()
    })
  )), a(), t.title && (a = n.enter(`title${s}`), u += o.move(" " + i), u += o.move(
    n.safe(t.title, {
      before: u,
      after: i,
      ...o.current()
    })
  ), u += o.move(i), a()), u += o.move(")"), l(), u;
}
function ww(t, e, n) {
  return lf(t, n) ? "<" : "[";
}
uf.peek = bw;
function uf(t, e, n, r) {
  const i = t.referenceType, s = n.enter("linkReference");
  let o = n.enter("label");
  const l = n.createTracker(r);
  let a = l.move("[");
  const u = n.containerPhrasing(t, {
    before: a,
    after: "]",
    ...l.current()
  });
  a += l.move(u + "]["), o();
  const c = n.stack;
  n.stack = c.filter(function(d) {
    return d !== "phrasing";
  }), o = n.enter("reference");
  const h = n.safe(n.associationId(t), {
    before: a,
    after: "]",
    ...l.current()
  });
  return o(), n.stack = c, s(), i === "full" || !u || u !== h ? a += l.move(h + "]") : i === "shortcut" ? a = a.slice(0, -1) : a += l.move("]"), a;
}
function bw() {
  return "[";
}
function Dl(t) {
  const e = t.options.bullet || "*";
  if (e !== "*" && e !== "+" && e !== "-")
    throw new Error(
      "Cannot serialize items with `" + e + "` for `options.bullet`, expected `*`, `+`, or `-`"
    );
  return e;
}
function xw(t) {
  const e = Dl(t), n = t.options.bulletOther;
  if (!n)
    return e === "*" ? "-" : "*";
  if (n !== "*" && n !== "+" && n !== "-")
    throw new Error(
      "Cannot serialize items with `" + n + "` for `options.bulletOther`, expected `*`, `+`, or `-`"
    );
  if (n === e)
    throw new Error(
      "Expected `bullet` (`" + e + "`) and `bulletOther` (`" + n + "`) to be different"
    );
  return n;
}
function Cw(t) {
  const e = t.options.bulletOrdered || ".";
  if (e !== "." && e !== ")")
    throw new Error(
      "Cannot serialize items with `" + e + "` for `options.bulletOrdered`, expected `.` or `)`"
    );
  return e;
}
function cf(t) {
  const e = t.options.rule || "*";
  if (e !== "*" && e !== "-" && e !== "_")
    throw new Error(
      "Cannot serialize rules with `" + e + "` for `options.rule`, expected `*`, `-`, or `_`"
    );
  return e;
}
function Sw(t, e, n, r) {
  const i = n.enter("list"), s = n.bulletCurrent;
  let o = t.ordered ? Cw(n) : Dl(n);
  const l = t.ordered ? o === "." ? ")" : "." : xw(n);
  let a = e && n.bulletLastUsed ? o === n.bulletLastUsed : !1;
  if (!t.ordered) {
    const c = t.children ? t.children[0] : void 0;
    if (
      // Bullet could be used as a thematic break marker:
      (o === "*" || o === "-") && // Empty first list item:
      c && (!c.children || !c.children[0]) && // Directly in two other list items:
      n.stack[n.stack.length - 1] === "list" && n.stack[n.stack.length - 2] === "listItem" && n.stack[n.stack.length - 3] === "list" && n.stack[n.stack.length - 4] === "listItem" && // That are each the first child.
      n.indexStack[n.indexStack.length - 1] === 0 && n.indexStack[n.indexStack.length - 2] === 0 && n.indexStack[n.indexStack.length - 3] === 0 && (a = !0), cf(n) === o && c
    ) {
      let h = -1;
      for (; ++h < t.children.length; ) {
        const d = t.children[h];
        if (d && d.type === "listItem" && d.children && d.children[0] && d.children[0].type === "thematicBreak") {
          a = !0;
          break;
        }
      }
    }
  }
  a && (o = l), n.bulletCurrent = o;
  const u = n.containerFlow(t, r);
  return n.bulletLastUsed = o, n.bulletCurrent = s, i(), u;
}
function vw(t) {
  const e = t.options.listItemIndent || "one";
  if (e !== "tab" && e !== "one" && e !== "mixed")
    throw new Error(
      "Cannot serialize items with `" + e + "` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`"
    );
  return e;
}
function Nw(t, e, n, r) {
  const i = vw(n);
  let s = n.bulletCurrent || Dl(n);
  e && e.type === "list" && e.ordered && (s = (typeof e.start == "number" && e.start > -1 ? e.start : 1) + (n.options.incrementListMarker === !1 ? 0 : e.children.indexOf(t)) + s);
  let o = s.length + 1;
  (i === "tab" || i === "mixed" && (e && e.type === "list" && e.spread || t.spread)) && (o = Math.ceil(o / 4) * 4);
  const l = n.createTracker(r);
  l.move(s + " ".repeat(o - s.length)), l.shift(o);
  const a = n.enter("listItem"), u = n.indentLines(
    n.containerFlow(t, l.current()),
    c
  );
  return a(), u;
  function c(h, d, f) {
    return d ? (f ? "" : " ".repeat(o)) + h : (f ? s : s + " ".repeat(o - s.length)) + h;
  }
}
function Iw(t, e, n, r) {
  const i = n.enter("paragraph"), s = n.enter("phrasing"), o = n.containerPhrasing(t, r);
  return s(), i(), o;
}
function _w(t, e, n, r) {
  if (!t.children.some(function(l) {
    return Yh(l);
  })) return n.containerFlow(t, r);
  const s = n.enter("phrasing"), o = n.containerPhrasing(t, r);
  return s(), o;
}
function Tw(t) {
  const e = t.options.strong || "*";
  if (e !== "*" && e !== "_")
    throw new Error(
      "Cannot serialize strong with `" + e + "` for `options.strong`, expected `*`, or `_`"
    );
  return e;
}
Rl.attention = Aw;
Rl.peek = Ew;
function Rl(t, e, n, r) {
  const i = n.enter("phrasing"), s = n.containerPhrasing({ type: "root", children: [t] }, r);
  return i(), s;
}
function Aw(t, e) {
  return {
    construct: "strong",
    markers: Tw(e) === "*" ? ["*", "_"] : ["_", "*"],
    sizes: [2]
  };
}
function Ew(t, e, n) {
  return n.options.strong || "*";
}
function Mw(t, e, n, r) {
  return n.safe(t.value, r);
}
function Ow(t) {
  const e = t.options.ruleRepetition || 3;
  if (e < 3)
    throw new Error(
      "Cannot serialize rules with repetition `" + e + "` for `options.ruleRepetition`, expected `3` or more"
    );
  return e;
}
function Dw(t, e, n) {
  const r = (cf(n) + (n.options.ruleSpaces ? " " : "")).repeat(Ow(n));
  return n.options.ruleSpaces ? r.slice(0, -1) : r;
}
const zl = {
  blockquote: nw,
  break: zu,
  code: ow,
  definition: aw,
  emphasis: El,
  hardBreak: zu,
  heading: pw,
  html: nf,
  image: rf,
  imageReference: sf,
  inlineCode: of,
  link: af,
  linkReference: uf,
  list: Sw,
  listItem: Nw,
  paragraph: Iw,
  root: _w,
  strong: Rl,
  text: Mw,
  thematicBreak: Dw
};
function jo(t) {
  if (t.charCodeAt(0) !== 60) return;
  const e = t.charCodeAt(1);
  if (e === 33) {
    const l = t.charCodeAt(2);
    return l === 45 ? 2 : l === 91 ? 5 : Ve(l) ? 4 : void 0;
  }
  if (e === 63) return 3;
  const n = e === 47, r = n ? 2 : 1;
  let i = r, s = t.charCodeAt(i);
  if (!Ve(s)) return;
  for (; s === 45 || Ye(s); )
    s = t.charCodeAt(++i);
  const o = t.slice(r, i).toLowerCase();
  return !n && s !== 47 && Po.includes(o) ? 1 : Uh.includes(o) ? 6 : 7;
}
const Rw = [zw];
function zw(t, e, n, r) {
  if (e.type === "code" && Fo(e, r) && (t.type === "list" || t.type === e.type && Fo(t, r)))
    return !1;
  if ("spread" in n && typeof n.spread == "boolean") {
    if (t.type === "paragraph" && // Two paragraphs.
    (t.type === e.type || e.type === "definition" || // Paragraph followed by a setext heading.
    e.type === "heading" && tf(e, r)))
      return;
    if (t.type === "html") {
      const i = jo(t.value);
      if (i === void 0 || i === 6 || i === 7) return 1;
    }
    if (t.type === "paragraph" && e.type === "html") {
      const i = jo(e.value);
      if (i === void 0 || i === 7) return 1;
    }
    return n.spread ? 1 : 0;
  }
}
const _n = [
  "autolink",
  "destinationLiteral",
  "destinationRaw",
  "reference",
  "titleQuote",
  "titleApostrophe"
], hf = [
  { character: "	", after: "[\\r\\n]", inConstruct: "phrasing" },
  { character: "	", before: "[\\r\\n]", inConstruct: "phrasing" },
  {
    character: "	",
    inConstruct: ["codeFencedLangGraveAccent", "codeFencedLangTilde"]
  },
  {
    character: "\r",
    inConstruct: [
      "codeFencedLangGraveAccent",
      "codeFencedLangTilde",
      "codeFencedMetaGraveAccent",
      "codeFencedMetaTilde",
      "destinationLiteral",
      "headingAtx"
    ]
  },
  {
    character: `
`,
    inConstruct: [
      "codeFencedLangGraveAccent",
      "codeFencedLangTilde",
      "codeFencedMetaGraveAccent",
      "codeFencedMetaTilde",
      "destinationLiteral",
      "headingAtx"
    ]
  },
  { character: "\r", before: "[\\r\\n]", inConstruct: "phrasing" },
  { character: "\r", after: "\\r", inConstruct: "phrasing" },
  { character: `
`, before: "\\n", inConstruct: "phrasing" },
  { character: `
`, after: "[\\r\\n]", inConstruct: "phrasing" },
  { character: " ", after: "[\\r\\n]", inConstruct: "phrasing" },
  { character: " ", before: "[\\r\\n]", inConstruct: "phrasing" },
  {
    character: " ",
    inConstruct: ["codeFencedLangGraveAccent", "codeFencedLangTilde"]
  },
  // An exclamation mark can start an image, if it is followed by a link or
  // a link reference.
  {
    character: "!",
    after: "\\[",
    inConstruct: "phrasing",
    notInConstruct: _n
  },
  // A quote can break out of a title.
  { character: '"', inConstruct: "titleQuote" },
  // A number sign could start an ATX heading if it starts a line.
  { atBreak: !0, character: "#" },
  { character: "#", inConstruct: "headingAtx", after: `(?:[\r
]|$)` },
  // Dollar sign and percentage are not used in markdown.
  // An ampersand could start a character reference.
  { character: "&", after: "[#A-Za-z]", inConstruct: "phrasing" },
  // An apostrophe can break out of a title.
  { character: "'", inConstruct: "titleApostrophe" },
  // A left paren could break out of a destination raw.
  { character: "(", inConstruct: "destinationRaw" },
  // A left paren followed by `]` could make something into a link or image.
  {
    before: "\\]",
    character: "(",
    inConstruct: "phrasing",
    notInConstruct: _n
  },
  // A right paren could start a list item or break out of a destination
  // raw.
  { atBreak: !0, before: "\\d+", character: ")" },
  { character: ")", inConstruct: "destinationRaw" },
  // An asterisk can start thematic breaks, list items, emphasis, strong.
  { atBreak: !0, character: "*", after: `(?:[ 	\r
*])` },
  { character: "*", inConstruct: "phrasing", notInConstruct: _n },
  // A plus sign could start a list item.
  { atBreak: !0, character: "+", after: `(?:[ 	\r
])` },
  // A dash can start thematic breaks, list items, and setext heading
  // underlines.
  { atBreak: !0, character: "-", after: `(?:[ 	\r
-])` },
  // A dot could start a list item.
  { atBreak: !0, before: "\\d+", character: ".", after: `(?:[ 	\r
]|$)` },
  // Slash, colon, and semicolon are not used in markdown for constructs.
  // A less than can start html (flow or text) or an autolink.
  // HTML could start with an exclamation mark (declaration, cdata, comment),
  // slash (closing tag), question mark (instruction), or a letter (tag).
  // An autolink also starts with a letter.
  // Finally, it could break out of a destination literal.
  { atBreak: !0, character: "<", after: "[!/?A-Za-z]" },
  {
    character: "<",
    after: "[!/?A-Za-z]",
    inConstruct: "phrasing",
    notInConstruct: _n
  },
  { character: "<", inConstruct: "destinationLiteral" },
  // An equals to can start setext heading underlines.
  { atBreak: !0, character: "=" },
  // A greater than can start block quotes and it can break out of a
  // destination literal.
  { atBreak: !0, character: ">" },
  { character: ">", inConstruct: "destinationLiteral" },
  // Question mark and at sign are not used in markdown for constructs.
  // A left bracket can start definitions, references, labels,
  { atBreak: !0, character: "[" },
  { character: "[", inConstruct: "phrasing", notInConstruct: _n },
  { character: "[", inConstruct: ["label", "reference"] },
  // A backslash can start an escape (when followed by punctuation) or a
  // hard break (when followed by an eol).
  // Note: typical escapes are handled in `safe`!
  { character: "\\", after: "[\\r\\n]", inConstruct: "phrasing" },
  // A right bracket can exit labels.
  { character: "]", inConstruct: ["label", "reference"] },
  // Caret is not used in markdown for constructs.
  // An underscore can start emphasis, strong, or a thematic break.
  { atBreak: !0, character: "_" },
  { character: "_", inConstruct: "phrasing", notInConstruct: _n },
  // A grave accent can start code (fenced or text), or it can break out of
  // a grave accent code fence.
  { atBreak: !0, character: "`" },
  {
    character: "`",
    inConstruct: ["codeFencedLangGraveAccent", "codeFencedMetaGraveAccent"]
  },
  { character: "`", inConstruct: "phrasing", notInConstruct: _n },
  // Left brace, vertical bar, right brace are not used in markdown for
  // constructs.
  // A tilde can start code (fenced).
  { atBreak: !0, character: "~" },
  { character: "<", inConstruct: "autolink" },
  { character: ">", inConstruct: "autolink" },
  { character: "", inConstruct: "autolink" }
];
let Pu = -1;
for (; ++Pu < 33; )
  hf.push({ character: String.fromCharCode(Pu), inConstruct: "autolink" });
function Pw(t) {
  return t.label || !t.identifier ? t.label || "" : Jh(t.identifier);
}
function Lw(t) {
  if (!t._compiled) {
    const e = (t.atBreak ? "[\\r\\n][\\t ]*" : "") + (t.before ? "(?:" + t.before + ")" : "");
    t._compiled = new RegExp(
      (e ? "(" + e + ")" : "") + (/[$()*+\-.?[\\\]^{|}]/.test(t.character) ? "\\" : "") + t.character + (t.after ? "(?:" + t.after + ")" : ""),
      "g"
    );
  }
  return t._compiled;
}
function Qi(t) {
  const e = t.codePointAt(0);
  return e === void 0 ? "" : String.fromCodePoint(e);
}
function Or(t) {
  const e = t.codePointAt(t.length - 2);
  return e !== void 0 && e > 65535 ? t.slice(-2) : t.slice(-1);
}
function Lu(t, e, n) {
  const r = zt(t), i = zt(e);
  return r === void 0 ? i === void 0 ? (
    // Letter inside:
    // we have to encode *both* letters for `_` as it is looser.
    // it already forms for `*` (and GFMs `~`).
    n === "_" ? { inside: !0, outside: !0 } : { inside: !1, outside: !1 }
  ) : i === 1 ? (
    // Whitespace inside: encode both (letter, whitespace).
    { inside: !0, outside: !0 }
  ) : (
    // Punctuation inside: encode outer (letter)
    { inside: !1, outside: !0 }
  ) : r === 1 ? i === void 0 ? (
    // Letter inside: already forms.
    { inside: !1, outside: !1 }
  ) : i === 1 ? (
    // Whitespace inside: encode both (whitespace).
    { inside: !0, outside: !0 }
  ) : (
    // Punctuation inside: already forms.
    { inside: !1, outside: !1 }
  ) : i === void 0 ? (
    // Letter inside: already forms.
    { inside: !1, outside: !1 }
  ) : i === 1 ? (
    // Whitespace inside: encode inner (whitespace).
    { inside: !0, outside: !1 }
  ) : (
    // Punctuation inside: already forms.
    { inside: !1, outside: !1 }
  );
}
const Bw = /* @__PURE__ */ new Map([
  ["*", !1],
  ["_", !0]
]);
function Fw(t, e, n) {
  const r = /* @__PURE__ */ new Set();
  for (const s of t) {
    const o = n.get(s);
    if (o && s.attention && e.some((l) => l.attention === s.attention))
      for (const l of o.tokens)
        r.add(l.attention);
  }
  const i = [];
  for (const s of t)
    s.attention && r.delete(s.attention) && i.push(s.attention);
  return i.reverse(), i;
}
function ff(t, e, n) {
  const r = [], i = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map();
  let o = 0;
  for (; o < t.length; ) {
    if (!t[o].attention) {
      o++;
      continue;
    }
    const l = t[o].value.charAt(0), a = Bw.get(l);
    let u = o + 1;
    for (; u < t.length && t[u].attention && t[u].value.charAt(0) === l; )
      u++;
    const c = o ? t[o - 1].value : e, h = zt(c.charCodeAt(c.length - 1)), d = zt(
      (u < t.length ? t[u].value : n).charCodeAt(0)
    ), f = !d || d === 2 && !!h, p = !h || h === 2 && !!d, m = {
      tokens: t.slice(o, u),
      markers: [],
      start: 0,
      end: 0,
      // Underscores are strict, they cannot open or close inside words.
      open: a ? f && (!!h || !p) : f,
      close: a ? p && (!!d || !f) : p,
      // All builtins can split runs.
      split: a !== void 0
    };
    for (const y of m.tokens) {
      i.set(y, [...m.tokens]), s.set(y, m);
      let g = y.value.length;
      for (; g--; ) m.markers.push(y);
    }
    m.end = m.markers.length, r.push(m), o = u;
  }
  for (Vw(r, i), o = -1; ++o < t.length; ) {
    const l = i.get(t[o]);
    if (l) return { attention: Fw(t, l, s), index: o };
  }
}
function $w(t, e, n) {
  return Vo(df(t, e, n), n.before, n.after);
}
function bi(t, e) {
  const n = t[e ? 0 : t.length - 1];
  if (!n || n.attention) return;
  const r = e ? Qi(n.value) : Or(n.value), i = Ml(
    /** @type {number} */
    r.codePointAt(0)
  );
  n.value = e ? i + n.value.slice(r.length) : n.value.slice(0, n.value.length - r.length) + i;
}
function jw(t, e, n, r, i) {
  for (const s of n.attention) {
    const o = e.get(s) || s.sequences[0];
    for (const l of s.sequences) {
      if (l === o) continue;
      const a = new Map(e);
      a.set(s, l);
      const u = Pl(t, a, r, i), c = ff(u, r, i);
      if (!c || c.index > n.index)
        return { chosen: a, mistake: c, tokens: u };
    }
  }
}
function Vw(t, e) {
  let n = 0;
  for (; n < t.length; ) {
    const r = t[n], i = r.tokens[0].value.charAt(0), s = r.end - r.start;
    let o = r.close && s ? n : 0;
    for (; o--; ) {
      const l = t[o], a = l.end - l.start;
      if (l.tokens[0].value.charAt(0) === i && l.open && a && (r.split ? (
        // The rule of 3, on the sizes that are left.
        !((l.close || r.open) && s % 3) || (a + s) % 3
      ) : (
        // Others pair whole runs of the same size.
        a === l.markers.length && a === s
      ))) {
        const u = r.split ? a > 1 && s > 1 ? 2 : 1 : s, c = l.markers.slice(l.end - u, l.end), h = r.markers.slice(r.start, r.start + u), d = c[0], f = h[0];
        if (
          // Whole sequences:
          // the markers of a sequence are next to each other,
          // so if the first and last marker are of one sequence of that size,
          // all markers are exactly that sequence.
          d === c[u - 1] && d.value.length === u && f === h[u - 1] && f.value.length === u && // Of the same attention, so its opening and closing sequence.
          d.attention === f.attention
        )
          e.delete(d), e.delete(f);
        else {
          const p = [.../* @__PURE__ */ new Set([...c, ...h])];
          for (const m of p) {
            const y = e.get(m);
            y && y.push(...p);
          }
        }
        l.end -= u, r.start += u;
        break;
      }
    }
    (o === -1 || r.start === r.end) && n++;
  }
}
function Ww(t, e, n) {
  if (e.length === 0)
    throw new Error(
      "Cannot serialize `" + t + "` as attention without markers, expected one or more markers"
    );
  if (n.length === 0)
    throw new Error(
      "Cannot serialize `" + t + "` as attention without sizes, expected one or more sizes"
    );
  for (const i of n)
    if (!Number.isSafeInteger(i) || i < 1)
      throw new Error(
        "Cannot serialize `" + t + "` as attention with `" + i + "` as size, expected positive integer"
      );
  const r = [];
  for (const i of e) {
    if (i.length !== 1)
      throw new Error(
        "Cannot serialize `" + t + "` as attention with `" + i + "` as marker, expected a single ascii character"
      );
    if (!Ph(i.charCodeAt(0)))
      throw new Error(
        "Cannot serialize `" + t + "` as attention with `" + i + "` as marker, expected ascii punctuation"
      );
    for (const s of n)
      r.push(i.repeat(s));
  }
  return r;
}
function df(t, e, n) {
  const r = e.indexStack, i = t.children || [], s = [];
  let o = -1, l = n.before;
  r.push(-1);
  let a = e.createTracker(n);
  for (; ++o < i.length; ) {
    const u = i[o];
    let c;
    if (r[r.length - 1] = o, o + 1 < i.length) {
      let f = e.handle.handlers[i[o + 1].type];
      f && f.peek && (f = f.peek), c = f ? Qi(
        f(i[o + 1], t, e, {
          before: "",
          after: "",
          ...a.current()
        })
      ) : "";
    } else
      c = n.after;
    const h = s[s.length - 1];
    typeof h == "string" && (l === "\r" || l === `
`) && u.type === "html" && jo(u.value) !== 7 && (s[s.length - 1] = h.replace(/(\r?\n|\r)$/, " "), l = " ", a = e.createTracker(n), a.move(Vo(s, n.before, n.after)));
    const d = e.handle.handlers[u.type];
    if (d && d.attention) {
      const { construct: f, markers: p, sizes: m } = d.attention(u, e), y = Ww(u.type, p, m), g = y[0], b = e.enter(f);
      a.move(g);
      const x = df(
        /** @type {PhrasingParents} */
        u,
        e,
        {
          ...a.current(),
          before: g,
          after: g
        }
      );
      a.move(Vo(x, g, g)), a.move(g), b(), s.push({ children: x, sequences: y }), l = g.charAt(g.length - 1);
    } else {
      const f = e.handle(u, t, e, {
        ...a.current(),
        after: c,
        before: l
      });
      if (!f) continue;
      a.move(f), s.push(f), l = Or(f);
    }
  }
  return r.pop(), s;
}
function Pl(t, e, n, r) {
  const i = [];
  let s, o = Or(n), l = -1;
  for (; ++l < t.length; ) {
    const a = t[l];
    if (typeof a == "string") {
      const x = { value: a, attention: void 0 };
      s && s === Qi(a) && bi([x], !0), s = void 0, i.push(x), x.value && (o = Or(x.value));
      continue;
    }
    const u = e.get(a) || a.sequences[0], c = u.charAt(0), h = t[l + 1], d = o, f = Qi(
      h === void 0 ? r : typeof h == "string" ? h : e.get(h) || h.sequences[0]
    ), p = Pl(a.children, e, u, u), m = p.length > 0 ? p[0].value : "", y = Lu(
      d.charCodeAt(d.length - 1),
      m.charCodeAt(0),
      c
    );
    y.inside && bi(p, !0);
    const g = p.length > 0 ? Or(p[p.length - 1].value) : "", b = Lu(
      f.charCodeAt(0),
      g.charCodeAt(g.length - 1),
      c
    );
    b.inside && bi(p, !1), y.outside && d !== `
` && d !== "\r" && bi(i, !1), b.outside && (s = f), i.push({ value: u, attention: a }, ...p, {
      value: u,
      attention: a
    }), o = u.charAt(u.length - 1);
  }
  return i;
}
function Vo(t, e, n) {
  let r = /* @__PURE__ */ new Map();
  const i = Pl(t, r, e, n);
  let s = i, o = ff(s, e, n);
  for (; o; ) {
    const a = jw(t, r, o, e, n);
    if (!a) {
      s = i;
      break;
    }
    r = a.chosen, s = a.tokens, o = a.mistake;
  }
  let l = "";
  for (const a of s) l += a.value;
  return l;
}
function Hw(t, e, n) {
  const r = e.indexStack, i = t.children || [], s = e.createTracker(n), o = [];
  let l = -1;
  for (r.push(-1); ++l < i.length; ) {
    const a = i[l];
    r[r.length - 1] = l, o.push(
      s.move(
        e.handle(a, t, e, {
          before: `
`,
          after: `
`,
          ...s.current()
        })
      )
    ), a.type !== "list" && (e.bulletLastUsed = void 0), l < i.length - 1 && o.push(
      s.move(Uw(a, i[l + 1], t, e))
    );
  }
  return r.pop(), o.join("");
}
function Uw(t, e, n, r) {
  let i = r.join.length;
  for (; i--; ) {
    const s = r.join[i](t, e, n, r);
    if (s === !0 || s === 1)
      break;
    if (typeof s == "number")
      return `
`.repeat(1 + s);
    if (s === !1)
      return `

<!---->

`;
  }
  return `

`;
}
const qw = /\r?\n|\r/g;
function Kw(t, e) {
  const n = [];
  let r = 0, i = 0, s;
  for (; s = qw.exec(t); )
    o(t.slice(r, s.index)), n.push(s[0]), r = s.index + s[0].length, i++;
  return o(t.slice(r)), n.join("");
  function o(l) {
    n.push(e(l, i, !l));
  }
}
const Fs = {}.hasOwnProperty;
function Jw(t, e, n) {
  const r = (n.before || "") + (e || "") + (n.after || ""), i = [], s = [], o = {}, l = t.stack.includes("autolink");
  let a = -1;
  for (; ++a < t.unsafe.length; ) {
    const f = t.unsafe[a];
    if (!Qh(t.stack, f))
      continue;
    const p = t.compilePattern(f);
    let m;
    for (; m = p.exec(r); ) {
      const y = "before" in f || !!f.atBreak, g = "after" in f, b = m.index + (y ? m[1].length : 0);
      Fs.call(o, b) ? (o[b].before && !y && (o[b].before = !1), o[b].after && !g && (o[b].after = !1)) : (i.push(b), o[b] = { before: y, after: g });
    }
  }
  i.sort(Gw);
  const u = n.before ? n.before.length : 0, c = r.length - (n.after ? n.after.length : 0);
  let h = u;
  for (a = -1; ++a < i.length; ) {
    const f = i[a];
    if (!(f < h || f >= c)) {
      if (r.charAt(f) === "_" && // Preceded by an unescaped character that is not punctuation or whitespace:
      f > 0 && zt(r.charCodeAt(f - 1)) === void 0 && !Fs.call(o, f - 1) && // Characters next to attention markers can become character references
      // later, turning `a` into `&#x61;`, so those do not count.
      !(f - 1 === u && /[*_]/.test(r.charAt(u - 1)))) {
        let p = f + 1;
        for (; p < c && r.charAt(p) === "_"; )
          p++;
        const m = p - f - 1;
        if (
          // All underscores in the run are unsafe positions, so they can be
          // skipped.
          i[a + m] === p - 1 && // Rest as above.
          p < r.length && zt(r.charCodeAt(p)) === void 0 && !Fs.call(o, p) && !(p === c - 1 && /[*_]/.test(r.charAt(c)))
        ) {
          a += m;
          continue;
        }
      }
      if (!(f + 1 < c && i[a + 1] === f + 1 && o[f].after && !o[f + 1].before && !o[f + 1].after || i[a - 1] === f - 1 && o[f].before && !o[f - 1].before && !o[f - 1].after)) {
        if (h !== f) {
          const p = r.slice(h, f);
          s.push(l ? p : Bu(p, "\\"));
        }
        h = f, l ? (s.push(
          "%" + r.charCodeAt(f).toString(16).toUpperCase().padStart(2, "0")
        ), h++) : /[!-/:-@[-`{-~]/.test(r.charAt(f)) && (!n.encode || !n.encode.includes(r.charAt(f))) ? s.push("\\") : (s.push(Ml(r.charCodeAt(f))), h++);
      }
    }
  }
  const d = r.slice(h, c);
  return s.push(l ? d : Bu(d, n.after)), s.join("");
}
function Gw(t, e) {
  return t - e;
}
function Bu(t, e) {
  const n = /\\(?=[!-/:-@[-`{-~])/g, r = [], i = [], s = t + e;
  let o = -1, l = 0, a;
  for (; a = n.exec(s); )
    r.push(a.index);
  for (; ++o < r.length; )
    l !== r[o] && i.push(t.slice(l, r[o])), i.push("\\"), l = r[o];
  return i.push(t.slice(l)), i.join("");
}
function Zw(t) {
  const e = t || {}, n = e.now || {};
  let r = e.lineShift || 0, i = n.line || 1, s = n.column || 1;
  return { move: a, current: o, shift: l };
  function o() {
    return { now: { line: i, column: s }, lineShift: r };
  }
  function l(u) {
    r += u;
  }
  function a(u) {
    const c = u || "", h = c.split(/\r?\n|\r/g), d = h[h.length - 1];
    return i += h.length - 1, s = h.length === 1 ? s + d.length : 1 + d.length + r, c;
  }
}
function Yw(t, e) {
  const n = e || {}, r = {
    associationId: Pw,
    bulletCurrent: void 0,
    bulletLastUsed: void 0,
    containerPhrasing: t0,
    containerFlow: n0,
    createTracker: Zw,
    compilePattern: Lw,
    enter: s,
    // @ts-expect-error: GFM / frontmatter are typed in `mdast` but not defined
    // here.
    handlers: { ...zl },
    // @ts-expect-error: add `handle` in a second.
    handle: void 0,
    indentLines: Kw,
    indexStack: [],
    join: [...Rw],
    options: {},
    safe: r0,
    stack: [],
    unsafe: [...hf]
  };
  Xh(r, n), r.options.tightDefinitions && r.join.push(e0), r.handle = Qk("type", {
    invalid: Xw,
    unknown: Qw,
    handlers: r.handlers
  });
  let i = r.handle(
    Yh(t) ? { type: "root", children: [t] } : t,
    void 0,
    r,
    { before: `
`, after: `
`, now: { line: 1, column: 1 }, lineShift: 0 }
  );
  return i && i.charCodeAt(i.length - 1) !== 10 && i.charCodeAt(i.length - 1) !== 13 && (i += `
`), i;
  function s(o) {
    return r.stack.push(o), l;
    function l() {
      r.stack.pop();
    }
  }
}
function Xw(t) {
  throw new Error("Cannot handle value `" + t + "`, expected node");
}
function Qw(t) {
  const e = (
    /** @type {Nodes} */
    t
  );
  throw new Error("Cannot handle unknown node `" + e.type + "`");
}
function e0(t, e) {
  if (t.type === "definition" && t.type === e.type)
    return 0;
}
function t0(t, e) {
  return $w(t, this, e);
}
function n0(t, e) {
  return Hw(t, this, e);
}
function r0(t, e) {
  return Jw(this, t, e);
}
function Wo(t) {
  const e = this;
  e.compiler = n;
  function n(r) {
    return Yw(r, {
      ...e.data("settings"),
      ...t,
      // Note: this option is not in the readme.
      // The goal is for it to be set by plugins on `data` instead of being
      // passed by users.
      extensions: e.data("toMarkdownExtensions") || []
    });
  }
}
function Fu(t) {
  if (t)
    throw t;
}
var xi = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function pf(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var $s, $u;
function i0() {
  if ($u) return $s;
  $u = 1;
  var t = Object.prototype.hasOwnProperty, e = Object.prototype.toString, n = Object.defineProperty, r = Object.getOwnPropertyDescriptor, i = function(u) {
    return typeof Array.isArray == "function" ? Array.isArray(u) : e.call(u) === "[object Array]";
  }, s = function(u) {
    if (!u || e.call(u) !== "[object Object]")
      return !1;
    var c = t.call(u, "constructor"), h = u.constructor && u.constructor.prototype && t.call(u.constructor.prototype, "isPrototypeOf");
    if (u.constructor && !c && !h)
      return !1;
    var d;
    for (d in u)
      ;
    return typeof d > "u" || t.call(u, d);
  }, o = function(u, c) {
    n && c.name === "__proto__" ? n(u, c.name, {
      enumerable: !0,
      configurable: !0,
      value: c.newValue,
      writable: !0
    }) : u[c.name] = c.newValue;
  }, l = function(u, c) {
    if (c === "__proto__")
      if (t.call(u, c)) {
        if (r)
          return r(u, c).value;
      } else return;
    return u[c];
  };
  return $s = function a() {
    var u, c, h, d, f, p, m = arguments[0], y = 1, g = arguments.length, b = !1;
    for (typeof m == "boolean" && (b = m, m = arguments[1] || {}, y = 2), (m == null || typeof m != "object" && typeof m != "function") && (m = {}); y < g; ++y)
      if (u = arguments[y], u != null)
        for (c in u)
          h = l(m, c), d = l(u, c), m !== d && (b && d && (s(d) || (f = i(d))) ? (f ? (f = !1, p = h && i(h) ? h : []) : p = h && s(h) ? h : {}, o(m, { name: c, newValue: a(b, p, d) })) : typeof d < "u" && o(m, { name: c, newValue: d }));
    return m;
  }, $s;
}
var s0 = i0();
const js = /* @__PURE__ */ pf(s0);
function Ho(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = Object.getPrototypeOf(t);
  return (e === null || e === Object.prototype || Object.getPrototypeOf(e) === null) && !(Symbol.toStringTag in t) && !(Symbol.iterator in t);
}
function o0() {
  const t = [], e = { run: n, use: r };
  return e;
  function n(...i) {
    let s = -1;
    const o = i.pop();
    if (typeof o != "function")
      throw new TypeError("Expected function as last argument, not " + o);
    l(null, ...i);
    function l(a, ...u) {
      const c = t[++s];
      let h = -1;
      if (a) {
        o(a);
        return;
      }
      for (; ++h < i.length; )
        (u[h] === null || u[h] === void 0) && (u[h] = i[h]);
      i = u, c ? l0(c, l)(...u) : o(null, ...u);
    }
  }
  function r(i) {
    if (typeof i != "function")
      throw new TypeError(
        "Expected `middelware` to be a function, not " + i
      );
    return t.push(i), e;
  }
}
function l0(t, e) {
  let n;
  return r;
  function r(...o) {
    const l = t.length > o.length;
    let a;
    l && o.push(i);
    try {
      a = t.apply(this, o);
    } catch (u) {
      const c = (
        /** @type {Error} */
        u
      );
      if (l && n)
        throw c;
      return i(c);
    }
    l || (a && a.then && typeof a.then == "function" ? a.then(s, i) : a instanceof Error ? i(a) : s(a));
  }
  function i(o, ...l) {
    n || (n = !0, e(o, ...l));
  }
  function s(o) {
    i(null, o);
  }
}
class rt extends Error {
  /**
   * Create a message for `reason`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {Options | null | undefined} [options]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | Options | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns
   *   Instance of `VFileMessage`.
   */
  // eslint-disable-next-line complexity
  constructor(e, n, r) {
    super(), typeof n == "string" && (r = n, n = void 0);
    let i = "", s = {}, o = !1;
    if (n && ("line" in n && "column" in n ? s = { place: n } : "start" in n && "end" in n ? s = { place: n } : "type" in n ? s = {
      ancestors: [n],
      place: n.position
    } : s = { ...n }), typeof e == "string" ? i = e : !s.cause && e && (o = !0, i = e.message, s.cause = e), !s.ruleId && !s.source && typeof r == "string") {
      const a = r.indexOf(":");
      a === -1 ? s.ruleId = r : (s.source = r.slice(0, a), s.ruleId = r.slice(a + 1));
    }
    if (!s.place && s.ancestors && s.ancestors) {
      const a = s.ancestors[s.ancestors.length - 1];
      a && (s.place = a.position);
    }
    const l = s.place && "start" in s.place ? s.place.start : s.place;
    this.ancestors = s.ancestors || void 0, this.cause = s.cause || void 0, this.column = l ? l.column : void 0, this.fatal = void 0, this.file = "", this.message = i, this.line = l ? l.line : void 0, this.name = Mr(s.place) || "1:1", this.place = s.place || void 0, this.reason = this.message, this.ruleId = s.ruleId || void 0, this.source = s.source || void 0, this.stack = o && s.cause && typeof s.cause.stack == "string" ? s.cause.stack : "", this.actual = void 0, this.expected = void 0, this.note = void 0, this.url = void 0;
  }
}
rt.prototype.file = "";
rt.prototype.name = "";
rt.prototype.reason = "";
rt.prototype.message = "";
rt.prototype.stack = "";
rt.prototype.column = void 0;
rt.prototype.line = void 0;
rt.prototype.ancestors = void 0;
rt.prototype.cause = void 0;
rt.prototype.fatal = void 0;
rt.prototype.place = void 0;
rt.prototype.ruleId = void 0;
rt.prototype.source = void 0;
const Dt = { basename: a0, dirname: u0, extname: c0, join: h0, sep: "/" };
function a0(t, e) {
  if (e !== void 0 && typeof e != "string")
    throw new TypeError('"ext" argument must be a string');
  ri(t);
  let n = 0, r = -1, i = t.length, s;
  if (e === void 0 || e.length === 0 || e.length > t.length) {
    for (; i--; )
      if (t.codePointAt(i) === 47) {
        if (s) {
          n = i + 1;
          break;
        }
      } else r < 0 && (s = !0, r = i + 1);
    return r < 0 ? "" : t.slice(n, r);
  }
  if (e === t)
    return "";
  let o = -1, l = e.length - 1;
  for (; i--; )
    if (t.codePointAt(i) === 47) {
      if (s) {
        n = i + 1;
        break;
      }
    } else
      o < 0 && (s = !0, o = i + 1), l > -1 && (t.codePointAt(i) === e.codePointAt(l--) ? l < 0 && (r = i) : (l = -1, r = o));
  return n === r ? r = o : r < 0 && (r = t.length), t.slice(n, r);
}
function u0(t) {
  if (ri(t), t.length === 0)
    return ".";
  let e = -1, n = t.length, r;
  for (; --n; )
    if (t.codePointAt(n) === 47) {
      if (r) {
        e = n;
        break;
      }
    } else r || (r = !0);
  return e < 0 ? t.codePointAt(0) === 47 ? "/" : "." : e === 1 && t.codePointAt(0) === 47 ? "//" : t.slice(0, e);
}
function c0(t) {
  ri(t);
  let e = t.length, n = -1, r = 0, i = -1, s = 0, o;
  for (; e--; ) {
    const l = t.codePointAt(e);
    if (l === 47) {
      if (o) {
        r = e + 1;
        break;
      }
      continue;
    }
    n < 0 && (o = !0, n = e + 1), l === 46 ? i < 0 ? i = e : s !== 1 && (s = 1) : i > -1 && (s = -1);
  }
  return i < 0 || n < 0 || // We saw a non-dot character immediately before the dot.
  s === 0 || // The (right-most) trimmed path component is exactly `..`.
  s === 1 && i === n - 1 && i === r + 1 ? "" : t.slice(i, n);
}
function h0(...t) {
  let e = -1, n;
  for (; ++e < t.length; )
    ri(t[e]), t[e] && (n = n === void 0 ? t[e] : n + "/" + t[e]);
  return n === void 0 ? "." : f0(n);
}
function f0(t) {
  ri(t);
  const e = t.codePointAt(0) === 47;
  let n = d0(t, !e);
  return n.length === 0 && !e && (n = "."), n.length > 0 && t.codePointAt(t.length - 1) === 47 && (n += "/"), e ? "/" + n : n;
}
function d0(t, e) {
  let n = "", r = 0, i = -1, s = 0, o = -1, l, a;
  for (; ++o <= t.length; ) {
    if (o < t.length)
      l = t.codePointAt(o);
    else {
      if (l === 47)
        break;
      l = 47;
    }
    if (l === 47) {
      if (!(i === o - 1 || s === 1)) if (i !== o - 1 && s === 2) {
        if (n.length < 2 || r !== 2 || n.codePointAt(n.length - 1) !== 46 || n.codePointAt(n.length - 2) !== 46) {
          if (n.length > 2) {
            if (a = n.lastIndexOf("/"), a !== n.length - 1) {
              a < 0 ? (n = "", r = 0) : (n = n.slice(0, a), r = n.length - 1 - n.lastIndexOf("/")), i = o, s = 0;
              continue;
            }
          } else if (n.length > 0) {
            n = "", r = 0, i = o, s = 0;
            continue;
          }
        }
        e && (n = n.length > 0 ? n + "/.." : "..", r = 2);
      } else
        n.length > 0 ? n += "/" + t.slice(i + 1, o) : n = t.slice(i + 1, o), r = o - i - 1;
      i = o, s = 0;
    } else l === 46 && s > -1 ? s++ : s = -1;
  }
  return n;
}
function ri(t) {
  if (typeof t != "string")
    throw new TypeError(
      "Path must be a string. Received " + JSON.stringify(t)
    );
}
const p0 = { cwd: m0 };
function m0() {
  return "/";
}
function Uo(t) {
  return !!(t !== null && typeof t == "object" && "href" in t && t.href && "protocol" in t && t.protocol && // @ts-expect-error: indexing is fine.
  t.auth === void 0);
}
function g0(t) {
  if (typeof t == "string")
    t = new URL(t);
  else if (!Uo(t)) {
    const e = new TypeError(
      'The "path" argument must be of type string or an instance of URL. Received `' + t + "`"
    );
    throw e.code = "ERR_INVALID_ARG_TYPE", e;
  }
  if (t.protocol !== "file:") {
    const e = new TypeError("The URL must be of scheme file");
    throw e.code = "ERR_INVALID_URL_SCHEME", e;
  }
  return y0(t);
}
function y0(t) {
  if (t.hostname !== "") {
    const r = new TypeError(
      'File URL host must be "localhost" or empty on darwin'
    );
    throw r.code = "ERR_INVALID_FILE_URL_HOST", r;
  }
  const e = t.pathname;
  let n = -1;
  for (; ++n < e.length; )
    if (e.codePointAt(n) === 37 && e.codePointAt(n + 1) === 50) {
      const r = e.codePointAt(n + 2);
      if (r === 70 || r === 102) {
        const i = new TypeError(
          "File URL path must not include encoded / characters"
        );
        throw i.code = "ERR_INVALID_FILE_URL_PATH", i;
      }
    }
  return decodeURIComponent(e);
}
const Vs = (
  /** @type {const} */
  [
    "history",
    "path",
    "basename",
    "stem",
    "extname",
    "dirname"
  ]
);
class k0 {
  /**
   * Create a new virtual file.
   *
   * `options` is treated as:
   *
   * *   `string` or `Uint8Array` — `{value: options}`
   * *   `URL` — `{path: options}`
   * *   `VFile` — shallow copies its data over to the new file
   * *   `object` — all fields are shallow copied over to the new file
   *
   * Path related fields are set in the following order (least specific to
   * most specific): `history`, `path`, `basename`, `stem`, `extname`,
   * `dirname`.
   *
   * You cannot set `dirname` or `extname` without setting either `history`,
   * `path`, `basename`, or `stem` too.
   *
   * @param {Compatible | null | undefined} [value]
   *   File value.
   * @returns
   *   New instance.
   */
  constructor(e) {
    let n;
    e ? Uo(e) ? n = { path: e } : typeof e == "string" || w0(e) ? n = { value: e } : n = e : n = {}, this.cwd = "cwd" in n ? "" : p0.cwd(), this.data = {}, this.history = [], this.messages = [], this.value, this.map, this.result, this.stored;
    let r = -1;
    for (; ++r < Vs.length; ) {
      const s = Vs[r];
      s in n && n[s] !== void 0 && n[s] !== null && (this[s] = s === "history" ? [...n[s]] : n[s]);
    }
    let i;
    for (i in n)
      Vs.includes(i) || (this[i] = n[i]);
  }
  /**
   * Get the basename (including extname) (example: `'index.min.js'`).
   *
   * @returns {string | undefined}
   *   Basename.
   */
  get basename() {
    return typeof this.path == "string" ? Dt.basename(this.path) : void 0;
  }
  /**
   * Set basename (including extname) (`'index.min.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} basename
   *   Basename.
   * @returns {undefined}
   *   Nothing.
   */
  set basename(e) {
    Hs(e, "basename"), Ws(e, "basename"), this.path = Dt.join(this.dirname || "", e);
  }
  /**
   * Get the parent path (example: `'~'`).
   *
   * @returns {string | undefined}
   *   Dirname.
   */
  get dirname() {
    return typeof this.path == "string" ? Dt.dirname(this.path) : void 0;
  }
  /**
   * Set the parent path (example: `'~'`).
   *
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} dirname
   *   Dirname.
   * @returns {undefined}
   *   Nothing.
   */
  set dirname(e) {
    ju(this.basename, "dirname"), this.path = Dt.join(e || "", this.basename);
  }
  /**
   * Get the extname (including dot) (example: `'.js'`).
   *
   * @returns {string | undefined}
   *   Extname.
   */
  get extname() {
    return typeof this.path == "string" ? Dt.extname(this.path) : void 0;
  }
  /**
   * Set the extname (including dot) (example: `'.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} extname
   *   Extname.
   * @returns {undefined}
   *   Nothing.
   */
  set extname(e) {
    if (Ws(e, "extname"), ju(this.dirname, "extname"), e) {
      if (e.codePointAt(0) !== 46)
        throw new Error("`extname` must start with `.`");
      if (e.includes(".", 1))
        throw new Error("`extname` cannot contain multiple dots");
    }
    this.path = Dt.join(this.dirname, this.stem + (e || ""));
  }
  /**
   * Get the full path (example: `'~/index.min.js'`).
   *
   * @returns {string}
   *   Path.
   */
  get path() {
    return this.history[this.history.length - 1];
  }
  /**
   * Set the full path (example: `'~/index.min.js'`).
   *
   * Cannot be nullified.
   * You can set a file URL (a `URL` object with a `file:` protocol) which will
   * be turned into a path with `url.fileURLToPath`.
   *
   * @param {URL | string} path
   *   Path.
   * @returns {undefined}
   *   Nothing.
   */
  set path(e) {
    Uo(e) && (e = g0(e)), Hs(e, "path"), this.path !== e && this.history.push(e);
  }
  /**
   * Get the stem (basename w/o extname) (example: `'index.min'`).
   *
   * @returns {string | undefined}
   *   Stem.
   */
  get stem() {
    return typeof this.path == "string" ? Dt.basename(this.path, this.extname) : void 0;
  }
  /**
   * Set the stem (basename w/o extname) (example: `'index.min'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} stem
   *   Stem.
   * @returns {undefined}
   *   Nothing.
   */
  set stem(e) {
    Hs(e, "stem"), Ws(e, "stem"), this.path = Dt.join(this.dirname || "", e + (this.extname || ""));
  }
  // Normal prototypal methods.
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(e, n, r) {
    const i = this.message(e, n, r);
    throw i.fatal = !0, i;
  }
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(e, n, r) {
    const i = this.message(e, n, r);
    return i.fatal = void 0, i;
  }
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(e, n, r) {
    const i = new rt(
      // @ts-expect-error: the overloads are fine.
      e,
      n,
      r
    );
    return this.path && (i.name = this.path + ":" + i.name, i.file = this.path), i.fatal = !1, this.messages.push(i), i;
  }
  /**
   * Serialize the file.
   *
   * > **Note**: which encodings are supported depends on the engine.
   * > For info on Node.js, see:
   * > <https://nodejs.org/api/util.html#whatwg-supported-encodings>.
   *
   * @param {string | null | undefined} [encoding='utf8']
   *   Character encoding to understand `value` as when it’s a `Uint8Array`
   *   (default: `'utf-8'`).
   * @returns {string}
   *   Serialized file.
   */
  toString(e) {
    return this.value === void 0 ? "" : typeof this.value == "string" ? this.value : new TextDecoder(e || void 0).decode(this.value);
  }
}
function Ws(t, e) {
  if (t && t.includes(Dt.sep))
    throw new Error(
      "`" + e + "` cannot be a path: did not expect `" + Dt.sep + "`"
    );
}
function Hs(t, e) {
  if (!t)
    throw new Error("`" + e + "` cannot be empty");
}
function ju(t, e) {
  if (!t)
    throw new Error("Setting `" + e + "` requires `path` to be set too");
}
function w0(t) {
  return !!(t && typeof t == "object" && "byteLength" in t && "byteOffset" in t);
}
const b0 = (
  /**
   * @type {new <Parameters extends Array<unknown>, Result>(property: string | symbol) => (...parameters: Parameters) => Result}
   */
  /** @type {unknown} */
  /**
   * @this {Function}
   * @param {string | symbol} property
   * @returns {(...parameters: Array<unknown>) => unknown}
   */
  (function(t) {
    const r = (
      /** @type {Record<string | symbol, Function>} */
      // Prototypes do exist.
      // type-coverage:ignore-next-line
      this.constructor.prototype
    ), i = r[t], s = function() {
      return i.apply(s, arguments);
    };
    return Object.setPrototypeOf(s, r), s;
  })
), x0 = {}.hasOwnProperty;
class Ll extends b0 {
  /**
   * Create a processor.
   */
  constructor() {
    super("copy"), this.Compiler = void 0, this.Parser = void 0, this.attachers = [], this.compiler = void 0, this.freezeIndex = -1, this.frozen = void 0, this.namespace = {}, this.parser = void 0, this.transformers = o0();
  }
  /**
   * Copy a processor.
   *
   * @deprecated
   *   This is a private internal method and should not be used.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   New *unfrozen* processor ({@linkcode Processor}) that is
   *   configured to work the same as its ancestor.
   *   When the descendant processor is configured in the future it does not
   *   affect the ancestral processor.
   */
  copy() {
    const e = (
      /** @type {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>} */
      new Ll()
    );
    let n = -1;
    for (; ++n < this.attachers.length; ) {
      const r = this.attachers[n];
      e.use(...r);
    }
    return e.data(js(!0, {}, this.namespace)), e;
  }
  /**
   * Configure the processor with info available to all plugins.
   * Information is stored in an object.
   *
   * Typically, options can be given to a specific plugin, but sometimes it
   * makes sense to have information shared with several plugins.
   * For example, a list of HTML elements that are self-closing, which is
   * needed during all phases.
   *
   * > **Note**: setting information cannot occur on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * > **Note**: to register custom data in TypeScript, augment the
   * > {@linkcode Data} interface.
   *
   * @example
   *   This example show how to get and set info:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   const processor = unified().data('alpha', 'bravo')
   *
   *   processor.data('alpha') // => 'bravo'
   *
   *   processor.data() // => {alpha: 'bravo'}
   *
   *   processor.data({charlie: 'delta'})
   *
   *   processor.data() // => {charlie: 'delta'}
   *   ```
   *
   * @template {keyof Data} Key
   *
   * @overload
   * @returns {Data}
   *
   * @overload
   * @param {Data} dataset
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Key} key
   * @returns {Data[Key]}
   *
   * @overload
   * @param {Key} key
   * @param {Data[Key]} value
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @param {Data | Key} [key]
   *   Key to get or set, or entire dataset to set, or nothing to get the
   *   entire dataset (optional).
   * @param {Data[Key]} [value]
   *   Value to set (optional).
   * @returns {unknown}
   *   The current processor when setting, the value at `key` when getting, or
   *   the entire dataset when getting without key.
   */
  data(e, n) {
    return typeof e == "string" ? arguments.length === 2 ? (Ks("data", this.frozen), this.namespace[e] = n, this) : x0.call(this.namespace, e) && this.namespace[e] || void 0 : e ? (Ks("data", this.frozen), this.namespace = e, this) : this.namespace;
  }
  /**
   * Freeze a processor.
   *
   * Frozen processors are meant to be extended and not to be configured
   * directly.
   *
   * When a processor is frozen it cannot be unfrozen.
   * New processors working the same way can be created by calling the
   * processor.
   *
   * It’s possible to freeze processors explicitly by calling `.freeze()`.
   * Processors freeze automatically when `.parse()`, `.run()`, `.runSync()`,
   * `.stringify()`, `.process()`, or `.processSync()` are called.
   *
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   The current processor.
   */
  freeze() {
    if (this.frozen)
      return this;
    const e = (
      /** @type {Processor} */
      /** @type {unknown} */
      this
    );
    for (; ++this.freezeIndex < this.attachers.length; ) {
      const [n, ...r] = this.attachers[this.freezeIndex];
      if (r[0] === !1)
        continue;
      r[0] === !0 && (r[0] = void 0);
      const i = n.call(e, ...r);
      typeof i == "function" && this.transformers.use(i);
    }
    return this.frozen = !0, this.freezeIndex = Number.POSITIVE_INFINITY, this;
  }
  /**
   * Parse text to a syntax tree.
   *
   * > **Note**: `parse` freezes the processor if not already *frozen*.
   *
   * > **Note**: `parse` performs the parse phase, not the run phase or other
   * > phases.
   *
   * @param {Compatible | undefined} [file]
   *   file to parse (optional); typically `string` or `VFile`; any value
   *   accepted as `x` in `new VFile(x)`.
   * @returns {ParseTree extends undefined ? Node : ParseTree}
   *   Syntax tree representing `file`.
   */
  parse(e) {
    this.freeze();
    const n = Ci(e), r = this.parser || this.Parser;
    return Us("parse", r), r(String(n), n);
  }
  /**
   * Process the given file as configured on the processor.
   *
   * > **Note**: `process` freezes the processor if not already *frozen*.
   *
   * > **Note**: `process` performs the parse, run, and stringify phases.
   *
   * @overload
   * @param {Compatible | undefined} file
   * @param {ProcessCallback<VFileWithOutput<CompileResult>>} done
   * @returns {undefined}
   *
   * @overload
   * @param {Compatible | undefined} [file]
   * @returns {Promise<VFileWithOutput<CompileResult>>}
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`]; any value accepted as
   *   `x` in `new VFile(x)`.
   * @param {ProcessCallback<VFileWithOutput<CompileResult>> | undefined} [done]
   *   Callback (optional).
   * @returns {Promise<VFile> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise a promise, rejected with a fatal error or resolved with the
   *   processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  process(e, n) {
    const r = this;
    return this.freeze(), Us("process", this.parser || this.Parser), qs("process", this.compiler || this.Compiler), n ? i(void 0, n) : new Promise(i);
    function i(s, o) {
      const l = Ci(e), a = (
        /** @type {HeadTree extends undefined ? Node : HeadTree} */
        /** @type {unknown} */
        r.parse(l)
      );
      r.run(a, l, function(c, h, d) {
        if (c || !h || !d)
          return u(c);
        const f = (
          /** @type {CompileTree extends undefined ? Node : CompileTree} */
          /** @type {unknown} */
          h
        ), p = r.stringify(f, d);
        S0(p) ? d.value = p : d.result = p, u(
          c,
          /** @type {VFileWithOutput<CompileResult>} */
          d
        );
      });
      function u(c, h) {
        c || !h ? o(c) : s ? s(h) : n(void 0, h);
      }
    }
  }
  /**
   * Process the given file as configured on the processor.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `processSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `processSync` performs the parse, run, and stringify phases.
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`; any value accepted as
   *   `x` in `new VFile(x)`.
   * @returns {VFileWithOutput<CompileResult>}
   *   The processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  processSync(e) {
    let n = !1, r;
    return this.freeze(), Us("processSync", this.parser || this.Parser), qs("processSync", this.compiler || this.Compiler), this.process(e, i), Wu("processSync", "process", n), r;
    function i(s, o) {
      n = !0, Fu(s), r = o;
    }
  }
  /**
   * Run *transformers* on a syntax tree.
   *
   * > **Note**: `run` freezes the processor if not already *frozen*.
   *
   * > **Note**: `run` performs the run phase, not other phases.
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} file
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} [file]
   * @returns {Promise<TailTree extends undefined ? Node : TailTree>}
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {(
   *   RunCallback<TailTree extends undefined ? Node : TailTree> |
   *   Compatible
   * )} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} [done]
   *   Callback (optional).
   * @returns {Promise<TailTree extends undefined ? Node : TailTree> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise, a promise rejected with a fatal error or resolved with the
   *   transformed tree.
   */
  run(e, n, r) {
    Vu(e), this.freeze();
    const i = this.transformers;
    return !r && typeof n == "function" && (r = n, n = void 0), r ? s(void 0, r) : new Promise(s);
    function s(o, l) {
      const a = Ci(n);
      i.run(e, a, u);
      function u(c, h, d) {
        const f = (
          /** @type {TailTree extends undefined ? Node : TailTree} */
          h || e
        );
        c ? l(c) : o ? o(f) : r(void 0, f, d);
      }
    }
  }
  /**
   * Run *transformers* on a syntax tree.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `runSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `runSync` performs the run phase, not other phases.
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {TailTree extends undefined ? Node : TailTree}
   *   Transformed tree.
   */
  runSync(e, n) {
    let r = !1, i;
    return this.run(e, n, s), Wu("runSync", "run", r), i;
    function s(o, l) {
      Fu(o), i = l, r = !0;
    }
  }
  /**
   * Compile a syntax tree.
   *
   * > **Note**: `stringify` freezes the processor if not already *frozen*.
   *
   * > **Note**: `stringify` performs the stringify phase, not the run phase
   * > or other phases.
   *
   * @param {CompileTree extends undefined ? Node : CompileTree} tree
   *   Tree to compile.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {CompileResult extends undefined ? Value : CompileResult}
   *   Textual representation of the tree (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most compilers
   *   > return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  stringify(e, n) {
    this.freeze();
    const r = Ci(n), i = this.compiler || this.Compiler;
    return qs("stringify", i), Vu(e), i(e, r);
  }
  /**
   * Configure the processor to use a plugin, a list of usable values, or a
   * preset.
   *
   * If the processor is already using a plugin, the previous plugin
   * configuration is changed based on the options that are passed in.
   * In other words, the plugin is not added a second time.
   *
   * > **Note**: `use` cannot be called on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * @example
   *   There are many ways to pass plugins to `.use()`.
   *   This example gives an overview:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   unified()
   *     // Plugin with options:
   *     .use(pluginA, {x: true, y: true})
   *     // Passing the same plugin again merges configuration (to `{x: true, y: false, z: true}`):
   *     .use(pluginA, {y: false, z: true})
   *     // Plugins:
   *     .use([pluginB, pluginC])
   *     // Two plugins, the second with options:
   *     .use([pluginD, [pluginE, {}]])
   *     // Preset with plugins and settings:
   *     .use({plugins: [pluginF, [pluginG, {}]], settings: {position: false}})
   *     // Settings only:
   *     .use({settings: {position: false}})
   *   ```
   *
   * @template {Array<unknown>} [Parameters=[]]
   * @template {Node | string | undefined} [Input=undefined]
   * @template [Output=Input]
   *
   * @overload
   * @param {Preset | null | undefined} [preset]
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {PluggableList} list
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Plugin<Parameters, Input, Output>} plugin
   * @param {...(Parameters | [boolean])} parameters
   * @returns {UsePlugin<ParseTree, HeadTree, TailTree, CompileTree, CompileResult, Input, Output>}
   *
   * @param {PluggableList | Plugin | Preset | null | undefined} value
   *   Usable value.
   * @param {...unknown} parameters
   *   Parameters, when a plugin is given as a usable value.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   Current processor.
   */
  use(e, ...n) {
    const r = this.attachers, i = this.namespace;
    if (Ks("use", this.frozen), e != null) if (typeof e == "function")
      a(e, n);
    else if (typeof e == "object")
      Array.isArray(e) ? l(e) : o(e);
    else
      throw new TypeError("Expected usable value, not `" + e + "`");
    return this;
    function s(u) {
      if (typeof u == "function")
        a(u, []);
      else if (typeof u == "object")
        if (Array.isArray(u)) {
          const [c, ...h] = (
            /** @type {PluginTuple<Array<unknown>>} */
            u
          );
          a(c, h);
        } else
          o(u);
      else
        throw new TypeError("Expected usable value, not `" + u + "`");
    }
    function o(u) {
      if (!("plugins" in u) && !("settings" in u))
        throw new Error(
          "Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither"
        );
      l(u.plugins), u.settings && (i.settings = js(!0, i.settings, u.settings));
    }
    function l(u) {
      let c = -1;
      if (u != null) if (Array.isArray(u))
        for (; ++c < u.length; ) {
          const h = u[c];
          s(h);
        }
      else
        throw new TypeError("Expected a list of plugins, not `" + u + "`");
    }
    function a(u, c) {
      let h = -1, d = -1;
      for (; ++h < r.length; )
        if (r[h][0] === u) {
          d = h;
          break;
        }
      if (d === -1)
        r.push([u, ...c]);
      else if (c.length > 0) {
        let [f, ...p] = c;
        const m = r[d][1];
        Ho(m) && Ho(f) && (f = js(!0, m, f)), r[d] = [u, f, ...p];
      }
    }
  }
}
const qo = new Ll().freeze();
function Us(t, e) {
  if (typeof e != "function")
    throw new TypeError("Cannot `" + t + "` without `parser`");
}
function qs(t, e) {
  if (typeof e != "function")
    throw new TypeError("Cannot `" + t + "` without `compiler`");
}
function Ks(t, e) {
  if (e)
    throw new Error(
      "Cannot call `" + t + "` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`."
    );
}
function Vu(t) {
  if (!Ho(t) || typeof t.type != "string")
    throw new TypeError("Expected node, got `" + t + "`");
}
function Wu(t, e, n) {
  if (!n)
    throw new Error(
      "`" + t + "` finished async. Use `" + e + "` instead"
    );
}
function Ci(t) {
  return C0(t) ? t : new k0(t);
}
function C0(t) {
  return !!(t && typeof t == "object" && "message" in t && "messages" in t);
}
function S0(t) {
  return typeof t == "string" || v0(t);
}
function v0(t) {
  return !!(t && typeof t == "object" && "byteLength" in t && "byteOffset" in t);
}
function Fe(t) {
  this.content = t;
}
Fe.prototype = {
  constructor: Fe,
  find: function(t) {
    for (var e = 0; e < this.content.length; e += 2)
      if (this.content[e] === t) return e;
    return -1;
  },
  // :: (string) → ?any
  // Retrieve the value stored under `key`, or return undefined when
  // no such key exists.
  get: function(t) {
    var e = this.find(t);
    return e == -1 ? void 0 : this.content[e + 1];
  },
  // :: (string, any, ?string) → OrderedMap
  // Create a new map by replacing the value of `key` with a new
  // value, or adding a binding to the end of the map. If `newKey` is
  // given, the key of the binding will be replaced with that key.
  update: function(t, e, n) {
    var r = n && n != t ? this.remove(n) : this, i = r.find(t), s = r.content.slice();
    return i == -1 ? s.push(n || t, e) : (s[i + 1] = e, n && (s[i] = n)), new Fe(s);
  },
  // :: (string) → OrderedMap
  // Return a map with the given key removed, if it existed.
  remove: function(t) {
    var e = this.find(t);
    if (e == -1) return this;
    var n = this.content.slice();
    return n.splice(e, 2), new Fe(n);
  },
  // :: (string, any) → OrderedMap
  // Add a new key to the start of the map.
  addToStart: function(t, e) {
    return new Fe([t, e].concat(this.remove(t).content));
  },
  // :: (string, any) → OrderedMap
  // Add a new key to the end of the map.
  addToEnd: function(t, e) {
    var n = this.remove(t).content.slice();
    return n.push(t, e), new Fe(n);
  },
  // :: (string, string, any) → OrderedMap
  // Add a key after the given key. If `place` is not found, the new
  // key is added to the end.
  addBefore: function(t, e, n) {
    var r = this.remove(e), i = r.content.slice(), s = r.find(t);
    return i.splice(s == -1 ? i.length : s, 0, e, n), new Fe(i);
  },
  // :: ((key: string, value: any))
  // Call the given function for each key/value pair in the map, in
  // order.
  forEach: function(t) {
    for (var e = 0; e < this.content.length; e += 2)
      t(this.content[e], this.content[e + 1]);
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a new map by prepending the keys in this map that don't
  // appear in `map` before the keys in `map`.
  prepend: function(t) {
    return t = Fe.from(t), t.size ? new Fe(t.content.concat(this.subtract(t).content)) : this;
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a new map by appending the keys in this map that don't
  // appear in `map` after the keys in `map`.
  append: function(t) {
    return t = Fe.from(t), t.size ? new Fe(this.subtract(t).content.concat(t.content)) : this;
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a map containing all the keys in this map that don't
  // appear in `map`.
  subtract: function(t) {
    var e = this;
    t = Fe.from(t);
    for (var n = 0; n < t.content.length; n += 2)
      e = e.remove(t.content[n]);
    return e;
  },
  // :: () → Object
  // Turn ordered map into a plain object.
  toObject: function() {
    var t = {};
    return this.forEach(function(e, n) {
      t[e] = n;
    }), t;
  },
  // :: number
  // The amount of keys in this map.
  get size() {
    return this.content.length >> 1;
  }
};
Fe.from = function(t) {
  if (t instanceof Fe) return t;
  var e = [];
  if (t) for (var n in t) e.push(n, t[n]);
  return new Fe(e);
};
function mf(t, e, n) {
  for (let r = 0; ; r++) {
    if (r == t.childCount || r == e.childCount)
      return t.childCount == e.childCount ? null : n;
    let i = t.child(r), s = e.child(r);
    if (i == s) {
      n += i.nodeSize;
      continue;
    }
    if (!i.sameMarkup(s))
      return n;
    if (i.isText && i.text != s.text) {
      let o = i.text, l = s.text, a = 0;
      for (; o[a] == l[a]; a++)
        n++;
      return a && a < o.length && a < l.length && kf(o.charCodeAt(a - 1)) && yf(o.charCodeAt(a)) && n--, n;
    }
    if (i.content.size || s.content.size) {
      let o = mf(i.content, s.content, n + 1);
      if (o != null)
        return o;
    }
    n += i.nodeSize;
  }
}
function gf(t, e, n, r) {
  for (let i = t.childCount, s = e.childCount; ; ) {
    if (i == 0 || s == 0)
      return i == s ? null : { a: n, b: r };
    let o = t.child(--i), l = e.child(--s), a = o.nodeSize;
    if (o == l) {
      n -= a, r -= a;
      continue;
    }
    if (!o.sameMarkup(l))
      return { a: n, b: r };
    if (o.isText && o.text != l.text) {
      let u = o.text, c = l.text, h = u.length, d = c.length;
      for (; h > 0 && d > 0 && u[h - 1] == c[d - 1]; )
        h--, d--, n--, r--;
      return h && d && h < u.length && kf(u.charCodeAt(h - 1)) && yf(u.charCodeAt(h)) && (n++, r++), { a: n, b: r };
    }
    if (o.content.size || l.content.size) {
      let u = gf(o.content, l.content, n - 1, r - 1);
      if (u)
        return u;
    }
    n -= a, r -= a;
  }
}
function yf(t) {
  return t >= 56320 && t < 57344;
}
function kf(t) {
  return t >= 55296 && t < 56320;
}
class K {
  /**
  @internal
  */
  constructor(e, n) {
    if (this.content = e, this.size = n || 0, n == null)
      for (let r = 0; r < e.length; r++)
        this.size += e[r].nodeSize;
  }
  /**
  Invoke a callback for all descendant nodes between the given two
  positions (relative to start of this fragment). Doesn't descend
  into a node when the callback returns `false`.
  */
  nodesBetween(e, n, r, i = 0, s) {
    for (let o = 0, l = 0; l < n; o++) {
      let a = this.content[o], u = l + a.nodeSize;
      if (u > e && r(a, i + l, s || null, o) !== !1 && a.content.size) {
        let c = l + 1;
        a.nodesBetween(Math.max(0, e - c), Math.min(a.content.size, n - c), r, i + c);
      }
      l = u;
    }
  }
  /**
  Call the given callback for every descendant node. `pos` will be
  relative to the start of the fragment. The callback may return
  `false` to prevent traversal of a given node's children.
  */
  descendants(e) {
    this.nodesBetween(0, this.size, e);
  }
  /**
  Extract the text between `from` and `to`. See the same method on
  [`Node`](https://prosemirror.net/docs/ref/#model.Node.textBetween).
  */
  textBetween(e, n, r, i) {
    let s = "", o = !0;
    return this.nodesBetween(e, n, (l, a) => {
      let u = l.isText ? l.text.slice(Math.max(e, a) - a, n - a) : l.isLeaf ? i ? typeof i == "function" ? i(l) : i : l.type.spec.leafText ? l.type.spec.leafText(l) : "" : "";
      l.isBlock && (l.isLeaf && u || l.isTextblock) && r && (o ? o = !1 : s += r), s += u;
    }, 0), s;
  }
  /**
  Create a new fragment containing the combined content of this
  fragment and the other.
  */
  append(e) {
    if (!e.size)
      return this;
    if (!this.size)
      return e;
    let n = this.lastChild, r = e.firstChild, i = this.content.slice(), s = 0;
    for (n.isText && n.sameMarkup(r) && (i[i.length - 1] = n.withText(n.text + r.text), s = 1); s < e.content.length; s++)
      i.push(e.content[s]);
    return new K(i, this.size + e.size);
  }
  /**
  Cut out the sub-fragment between the two given positions.
  */
  cut(e, n = this.size) {
    if (e == 0 && n == this.size)
      return this;
    let r = [], i = 0;
    if (n > e)
      for (let s = 0, o = 0; o < n; s++) {
        let l = this.content[s], a = o + l.nodeSize;
        a > e && ((o < e || a > n) && (l.isText ? l = l.cut(Math.max(0, e - o), Math.min(l.text.length, n - o)) : l = l.cut(Math.max(0, e - o - 1), Math.min(l.content.size, n - o - 1))), r.push(l), i += l.nodeSize), o = a;
      }
    return new K(r, i);
  }
  /**
  @internal
  */
  cutByIndex(e, n) {
    return e == n ? K.empty : e == 0 && n == this.content.length ? this : new K(this.content.slice(e, n));
  }
  /**
  Create a new fragment in which the node at the given index is
  replaced by the given node.
  */
  replaceChild(e, n) {
    let r = this.content[e];
    if (r == n)
      return this;
    let i = this.content.slice(), s = this.size + n.nodeSize - r.nodeSize;
    return i[e] = n, new K(i, s);
  }
  /**
  Create a new fragment by prepending the given node to this
  fragment.
  */
  addToStart(e) {
    return new K([e].concat(this.content), this.size + e.nodeSize);
  }
  /**
  Create a new fragment by appending the given node to this
  fragment.
  */
  addToEnd(e) {
    return new K(this.content.concat(e), this.size + e.nodeSize);
  }
  /**
  Compare this fragment to another one.
  */
  eq(e) {
    if (this.content.length != e.content.length)
      return !1;
    for (let n = 0; n < this.content.length; n++)
      if (!this.content[n].eq(e.content[n]))
        return !1;
    return !0;
  }
  /**
  The first child of the fragment, or `null` if it is empty.
  */
  get firstChild() {
    return this.content.length ? this.content[0] : null;
  }
  /**
  The last child of the fragment, or `null` if it is empty.
  */
  get lastChild() {
    return this.content.length ? this.content[this.content.length - 1] : null;
  }
  /**
  The number of child nodes in this fragment.
  */
  get childCount() {
    return this.content.length;
  }
  /**
  Get the child node at the given index. Raise an error when the
  index is out of range.
  */
  child(e) {
    let n = this.content[e];
    if (!n)
      throw new RangeError("Index " + e + " out of range for " + this);
    return n;
  }
  /**
  Get the child node at the given index, if it exists.
  */
  maybeChild(e) {
    return this.content[e] || null;
  }
  /**
  Call `f` for every child node, passing the node, its offset
  into this parent node, and its index.
  */
  forEach(e) {
    for (let n = 0, r = 0; n < this.content.length; n++) {
      let i = this.content[n];
      e(i, r, n), r += i.nodeSize;
    }
  }
  /**
  Find the first position at which this fragment and another
  fragment differ, or `null` if they are the same.
  */
  findDiffStart(e, n = 0) {
    return mf(this, e, n);
  }
  /**
  Find the first position, searching from the end, at which this
  fragment and the given fragment differ, or `null` if they are
  the same. Since this position will not be the same in both
  nodes, an object with two separate positions is returned.
  */
  findDiffEnd(e, n = this.size, r = e.size) {
    return gf(this, e, n, r);
  }
  /**
  Find the index and inner offset corresponding to a given relative
  position in this fragment. The result object will be reused
  (overwritten) the next time the function is called. @internal
  */
  findIndex(e) {
    if (e == 0)
      return Si(0, e);
    if (e == this.size)
      return Si(this.content.length, e);
    if (e > this.size || e < 0)
      throw new RangeError(`Position ${e} outside of fragment (${this})`);
    for (let n = 0, r = 0; ; n++) {
      let i = this.child(n), s = r + i.nodeSize;
      if (s >= e)
        return s == e ? Si(n + 1, s) : Si(n, r);
      r = s;
    }
  }
  /**
  Return a debugging string that describes this fragment.
  */
  toString() {
    return "<" + this.toStringInner() + ">";
  }
  /**
  @internal
  */
  toStringInner() {
    return this.content.join(", ");
  }
  /**
  Create a JSON-serializeable representation of this fragment.
  */
  toJSON() {
    return this.content.length ? this.content.map((e) => e.toJSON()) : null;
  }
  /**
  Deserialize a fragment from its JSON representation.
  */
  static fromJSON(e, n) {
    if (!n)
      return K.empty;
    if (!Array.isArray(n))
      throw new RangeError("Invalid input for Fragment.fromJSON");
    return K.fromArray(n.map(e.nodeFromJSON));
  }
  /**
  Build a fragment from an array of nodes. Ensures that adjacent
  text nodes with the same marks are joined together.
  */
  static fromArray(e) {
    if (!e.length)
      return K.empty;
    let n, r = 0;
    for (let i = 0; i < e.length; i++) {
      let s = e[i];
      r += s.nodeSize, i && s.isText && e[i - 1].sameMarkup(s) ? (n || (n = e.slice(0, i)), n[n.length - 1] = s.withText(n[n.length - 1].text + s.text)) : n && n.push(s);
    }
    return new K(n || e, r);
  }
  /**
  Create a fragment from something that can be interpreted as a
  set of nodes. For `null`, it returns the empty fragment. For a
  fragment, the fragment itself. For a node or array of nodes, a
  fragment containing those nodes.
  */
  static from(e) {
    if (!e)
      return K.empty;
    if (e instanceof K)
      return e;
    if (Array.isArray(e))
      return this.fromArray(e);
    if (e.attrs)
      return new K([e], e.nodeSize);
    throw new RangeError("Can not convert " + e + " to a Fragment" + (e.nodesBetween ? " (looks like multiple versions of prosemirror-model were loaded)" : ""));
  }
}
K.empty = new K([], 0);
const Js = { index: 0, offset: 0 };
function Si(t, e) {
  return Js.index = t, Js.offset = e, Js;
}
function es(t, e) {
  if (t === e)
    return !0;
  if (!(t && typeof t == "object") || !(e && typeof e == "object"))
    return !1;
  let n = Array.isArray(t);
  if (Array.isArray(e) != n)
    return !1;
  if (n) {
    if (t.length != e.length)
      return !1;
    for (let r = 0; r < t.length; r++)
      if (!es(t[r], e[r]))
        return !1;
  } else {
    for (let r in t)
      if (!(r in e) || !es(t[r], e[r]))
        return !1;
    for (let r in e)
      if (!(r in t))
        return !1;
  }
  return !0;
}
class be {
  /**
  @internal
  */
  constructor(e, n) {
    this.type = e, this.attrs = n;
  }
  /**
  Given a set of marks, create a new set which contains this one as
  well, in the right position. If this mark is already in the set,
  the set itself is returned. If any marks that are set to be
  [exclusive](https://prosemirror.net/docs/ref/#model.MarkSpec.excludes) with this mark are present,
  those are replaced by this one.
  */
  addToSet(e) {
    let n, r = !1;
    for (let i = 0; i < e.length; i++) {
      let s = e[i];
      if (this.eq(s))
        return e;
      if (this.type.excludes(s.type))
        n || (n = e.slice(0, i));
      else {
        if (s.type.excludes(this.type))
          return e;
        !r && s.type.rank > this.type.rank && (n || (n = e.slice(0, i)), n.push(this), r = !0), n && n.push(s);
      }
    }
    return n || (n = e.slice()), r || n.push(this), n;
  }
  /**
  Remove this mark from the given set, returning a new set. If this
  mark is not in the set, the set itself is returned.
  */
  removeFromSet(e) {
    for (let n = 0; n < e.length; n++)
      if (this.eq(e[n]))
        return e.slice(0, n).concat(e.slice(n + 1));
    return e;
  }
  /**
  Test whether this mark is in the given set of marks.
  */
  isInSet(e) {
    for (let n = 0; n < e.length; n++)
      if (this.eq(e[n]))
        return !0;
    return !1;
  }
  /**
  Test whether this mark has the same type and attributes as
  another mark.
  */
  eq(e) {
    return this == e || this.type == e.type && es(this.attrs, e.attrs);
  }
  /**
  Convert this mark to a JSON-serializeable representation.
  */
  toJSON() {
    let e = { type: this.type.name };
    for (let n in this.attrs) {
      e.attrs = this.attrs;
      break;
    }
    return e;
  }
  /**
  Deserialize a mark from JSON.
  */
  static fromJSON(e, n) {
    if (!n)
      throw new RangeError("Invalid input for Mark.fromJSON");
    let r = e.marks[n.type];
    if (!r)
      throw new RangeError(`There is no mark type ${n.type} in this schema`);
    return r.create(n.attrs);
  }
  /**
  Test whether two sets of marks are identical.
  */
  static sameSet(e, n) {
    if (e == n)
      return !0;
    if (e.length != n.length)
      return !1;
    for (let r = 0; r < e.length; r++)
      if (!e[r].eq(n[r]))
        return !1;
    return !0;
  }
  /**
  Create a properly sorted mark set from null, a single mark, or an
  unsorted array of marks.
  */
  static setFrom(e) {
    if (!e || Array.isArray(e) && e.length == 0)
      return be.none;
    if (e instanceof be)
      return [e];
    let n = e.slice();
    return n.sort((r, i) => r.type.rank - i.type.rank), n;
  }
}
be.none = [];
class Ur extends Error {
}
class ne {
  /**
  Create a slice. When specifying a non-zero open depth, you must
  make sure that there are nodes of at least that depth at the
  appropriate side of the fragment—i.e. if the fragment is an
  empty paragraph node, `openStart` and `openEnd` can't be greater
  than 1.
  
  It is not necessary for the content of open nodes to conform to
  the schema's content constraints, though it should be a valid
  start/end/middle for such a node, depending on which sides are
  open.
  */
  constructor(e, n, r) {
    this.content = e, this.openStart = n, this.openEnd = r;
  }
  /**
  The size this slice would add when inserted into a document.
  */
  get size() {
    return this.content.size - this.openStart - this.openEnd;
  }
  /**
  @internal
  */
  insertAt(e, n) {
    let r = bf(this.content, e + this.openStart, n, this.openStart + 1, this.openEnd + 1);
    return r && new ne(r, this.openStart, this.openEnd);
  }
  /**
  @internal
  */
  removeBetween(e, n) {
    return new ne(wf(this.content, e + this.openStart, n + this.openStart), this.openStart, this.openEnd);
  }
  /**
  Tests whether this slice is equal to another slice.
  */
  eq(e) {
    return this.content.eq(e.content) && this.openStart == e.openStart && this.openEnd == e.openEnd;
  }
  /**
  @internal
  */
  toString() {
    return this.content + "(" + this.openStart + "," + this.openEnd + ")";
  }
  /**
  Convert a slice to a JSON-serializable representation.
  */
  toJSON() {
    if (!this.content.size)
      return null;
    let e = { content: this.content.toJSON() };
    return this.openStart > 0 && (e.openStart = this.openStart), this.openEnd > 0 && (e.openEnd = this.openEnd), e;
  }
  /**
  Deserialize a slice from its JSON representation.
  */
  static fromJSON(e, n) {
    if (!n)
      return ne.empty;
    let r = n.openStart || 0, i = n.openEnd || 0;
    if (typeof r != "number" || typeof i != "number")
      throw new RangeError("Invalid input for Slice.fromJSON");
    return new ne(K.fromJSON(e, n.content), r, i);
  }
  /**
  Create a slice from a fragment by taking the maximum possible
  open value on both side of the fragment.
  */
  static maxOpen(e, n = !0) {
    let r = 0, i = 0;
    for (let s = e.firstChild; s && !s.isLeaf && (n || !s.type.spec.isolating); s = s.firstChild)
      r++;
    for (let s = e.lastChild; s && !s.isLeaf && (n || !s.type.spec.isolating); s = s.lastChild)
      i++;
    return new ne(e, r, i);
  }
}
ne.empty = new ne(K.empty, 0, 0);
function wf(t, e, n) {
  let { index: r, offset: i } = t.findIndex(e), s = t.maybeChild(r), { index: o, offset: l } = t.findIndex(n);
  if (i == e || s.isText) {
    if (l != n && !t.child(o).isText)
      throw new RangeError("Removing non-flat range");
    return t.cut(0, e).append(t.cut(n));
  }
  if (r != o)
    throw new RangeError("Removing non-flat range");
  return t.replaceChild(r, s.copy(wf(s.content, e - i - 1, n - i - 1)));
}
function bf(t, e, n, r, i, s) {
  let { index: o, offset: l } = t.findIndex(e), a = t.maybeChild(o);
  if (l == e || a.isText)
    return s && r <= 0 && i <= 0 && !s.canReplace(o, o, n) ? null : t.cut(0, e).append(n).append(t.cut(e));
  let u = bf(a.content, e - l - 1, n, o == 0 ? r - 1 : 0, o == t.childCount - 1 ? i - 1 : 0, a);
  return u && t.replaceChild(o, a.copy(u));
}
function N0(t, e, n) {
  if (n.openStart > t.depth)
    throw new Ur("Inserted content deeper than insertion position");
  if (t.depth - n.openStart != e.depth - n.openEnd)
    throw new Ur("Inconsistent open depths");
  return xf(t, e, n, 0);
}
function xf(t, e, n, r) {
  let i = t.index(r), s = t.node(r);
  if (i == e.index(r) && r < t.depth - n.openStart) {
    let o = xf(t, e, n, r + 1);
    return s.copy(s.content.replaceChild(i, o));
  } else if (n.content.size)
    if (!n.openStart && !n.openEnd && t.depth == r && e.depth == r) {
      let o = t.parent, l = o.content;
      return Rn(o, l.cut(0, t.parentOffset).append(n.content).append(l.cut(e.parentOffset)));
    } else {
      let { start: o, end: l } = I0(n, t);
      return Rn(s, Sf(t, o, l, e, r));
    }
  else return Rn(s, ts(t, e, r));
}
function Cf(t, e) {
  if (!e.type.compatibleContent(t.type))
    throw new Ur("Cannot join " + e.type.name + " onto " + t.type.name);
}
function Ko(t, e, n) {
  let r = t.node(n);
  return Cf(r, e.node(n)), r;
}
function Dn(t, e) {
  let n = e.length - 1;
  n >= 0 && t.isText && t.sameMarkup(e[n]) ? e[n] = t.withText(e[n].text + t.text) : e.push(t);
}
function Dr(t, e, n, r) {
  let i = (e || t).node(n), s = 0, o = e ? e.index(n) : i.childCount;
  t && (s = t.index(n), t.depth > n ? s++ : t.textOffset && (Dn(t.nodeAfter, r), s++));
  for (let l = s; l < o; l++)
    Dn(i.child(l), r);
  e && e.depth == n && e.textOffset && Dn(e.nodeBefore, r);
}
function Rn(t, e) {
  if (!t.type.validContent(e))
    throw new Ur("Invalid content for node " + t.type.name);
  return t.copy(e);
}
function Sf(t, e, n, r, i) {
  let s = t.depth > i && Ko(t, e, i + 1), o = r.depth > i && Ko(n, r, i + 1), l = [];
  return Dr(null, t, i, l), s && o && e.index(i) == n.index(i) ? (Cf(s, o), Dn(Rn(s, Sf(t, e, n, r, i + 1)), l)) : (s && Dn(Rn(s, ts(t, e, i + 1)), l), Dr(e, n, i, l), o && Dn(Rn(o, ts(n, r, i + 1)), l)), Dr(r, null, i, l), new K(l);
}
function ts(t, e, n) {
  let r = [];
  if (Dr(null, t, n, r), t.depth > n) {
    let i = Ko(t, e, n + 1);
    Dn(Rn(i, ts(t, e, n + 1)), r);
  }
  return Dr(e, null, n, r), new K(r);
}
function I0(t, e) {
  let n = e.depth - t.openStart, i = e.node(n).copy(t.content);
  for (let s = n - 1; s >= 0; s--)
    i = e.node(s).copy(K.from(i));
  return {
    start: i.resolveNoCache(t.openStart + n),
    end: i.resolveNoCache(i.content.size - t.openEnd - n)
  };
}
class qr {
  /**
  @internal
  */
  constructor(e, n, r) {
    this.pos = e, this.path = n, this.parentOffset = r, this.depth = n.length / 3 - 1;
  }
  /**
  @internal
  */
  resolveDepth(e) {
    return e == null ? this.depth : e < 0 ? this.depth + e : e;
  }
  /**
  The parent node that the position points into. Note that even if
  a position points into a text node, that node is not considered
  the parent—text nodes are ‘flat’ in this model, and have no content.
  */
  get parent() {
    return this.node(this.depth);
  }
  /**
  The root node in which the position was resolved.
  */
  get doc() {
    return this.node(0);
  }
  /**
  The ancestor node at the given level. `p.node(p.depth)` is the
  same as `p.parent`.
  */
  node(e) {
    return this.path[this.resolveDepth(e) * 3];
  }
  /**
  The index into the ancestor at the given level. If this points
  at the 3rd node in the 2nd paragraph on the top level, for
  example, `p.index(0)` is 1 and `p.index(1)` is 2.
  */
  index(e) {
    return this.path[this.resolveDepth(e) * 3 + 1];
  }
  /**
  The index pointing after this position into the ancestor at the
  given level.
  */
  indexAfter(e) {
    return e = this.resolveDepth(e), this.index(e) + (e == this.depth && !this.textOffset ? 0 : 1);
  }
  /**
  The (absolute) position at the start of the node at the given
  level.
  */
  start(e) {
    return e = this.resolveDepth(e), e == 0 ? 0 : this.path[e * 3 - 1] + 1;
  }
  /**
  The (absolute) position at the end of the node at the given
  level.
  */
  end(e) {
    return e = this.resolveDepth(e), this.start(e) + this.node(e).content.size;
  }
  /**
  The (absolute) position directly before the wrapping node at the
  given level, or, when `depth` is `this.depth + 1`, the original
  position.
  */
  before(e) {
    if (e = this.resolveDepth(e), !e)
      throw new RangeError("There is no position before the top-level node");
    return e == this.depth + 1 ? this.pos : this.path[e * 3 - 1];
  }
  /**
  The (absolute) position directly after the wrapping node at the
  given level, or the original position when `depth` is `this.depth + 1`.
  */
  after(e) {
    if (e = this.resolveDepth(e), !e)
      throw new RangeError("There is no position after the top-level node");
    return e == this.depth + 1 ? this.pos : this.path[e * 3 - 1] + this.path[e * 3].nodeSize;
  }
  /**
  When this position points into a text node, this returns the
  distance between the position and the start of the text node.
  Will be zero for positions that point between nodes.
  */
  get textOffset() {
    return this.pos - this.path[this.path.length - 1];
  }
  /**
  Get the node directly after the position, if any. If the position
  points into a text node, only the part of that node after the
  position is returned.
  */
  get nodeAfter() {
    let e = this.parent, n = this.index(this.depth);
    if (n == e.childCount)
      return null;
    let r = this.pos - this.path[this.path.length - 1], i = e.child(n);
    return r ? e.child(n).cut(r) : i;
  }
  /**
  Get the node directly before the position, if any. If the
  position points into a text node, only the part of that node
  before the position is returned.
  */
  get nodeBefore() {
    let e = this.index(this.depth), n = this.pos - this.path[this.path.length - 1];
    return n ? this.parent.child(e).cut(0, n) : e == 0 ? null : this.parent.child(e - 1);
  }
  /**
  Get the position at the given index in the parent node at the
  given depth (which defaults to `this.depth`).
  */
  posAtIndex(e, n) {
    n = this.resolveDepth(n);
    let r = this.path[n * 3], i = n == 0 ? 0 : this.path[n * 3 - 1] + 1;
    for (let s = 0; s < e; s++)
      i += r.child(s).nodeSize;
    return i;
  }
  /**
  Get the marks at this position, factoring in the surrounding
  marks' [`inclusive`](https://prosemirror.net/docs/ref/#model.MarkSpec.inclusive) property. If the
  position is at the start of a non-empty node, the marks of the
  node after it (if any) are returned.
  */
  marks() {
    let e = this.parent, n = this.index();
    if (e.content.size == 0)
      return be.none;
    if (this.textOffset)
      return e.child(n).marks;
    let r = e.maybeChild(n - 1), i = e.maybeChild(n);
    if (!r) {
      let l = r;
      r = i, i = l;
    }
    let s = r.marks;
    for (var o = 0; o < s.length; o++)
      s[o].type.spec.inclusive === !1 && (!i || !s[o].isInSet(i.marks)) && (s = s[o--].removeFromSet(s));
    return s;
  }
  /**
  Get the marks after the current position, if any, except those
  that are non-inclusive and not present at position `$end`. This
  is mostly useful for getting the set of marks to preserve after a
  deletion. Will return `null` if this position is at the end of
  its parent node or its parent node isn't a textblock (in which
  case no marks should be preserved).
  */
  marksAcross(e) {
    let n = this.parent.maybeChild(this.index());
    if (!n || !n.isInline)
      return null;
    let r = n.marks, i = e.parent.maybeChild(e.index());
    for (var s = 0; s < r.length; s++)
      r[s].type.spec.inclusive === !1 && (!i || !r[s].isInSet(i.marks)) && (r = r[s--].removeFromSet(r));
    return r;
  }
  /**
  The depth up to which this position and the given (non-resolved)
  position share the same parent nodes.
  */
  sharedDepth(e) {
    for (let n = this.depth; n > 0; n--)
      if (this.start(n) <= e && this.end(n) >= e)
        return n;
    return 0;
  }
  /**
  Returns a range based on the place where this position and the
  given position diverge around block content. If both point into
  the same textblock, for example, a range around that textblock
  will be returned. If they point into different blocks, the range
  around those blocks in their shared ancestor is returned. You can
  pass in an optional predicate that will be called with a parent
  node to see if a range into that parent is acceptable.
  */
  blockRange(e = this, n) {
    if (e.pos < this.pos)
      return e.blockRange(this);
    for (let r = this.depth - (this.parent.inlineContent || this.pos == e.pos ? 1 : 0); r >= 0; r--)
      if (e.pos <= this.end(r) && (!n || n(this.node(r))))
        return new vf(this, e, r);
    return null;
  }
  /**
  Query whether the given position shares the same parent node.
  */
  sameParent(e) {
    return this.pos - this.parentOffset == e.pos - e.parentOffset;
  }
  /**
  Return the greater of this and the given position.
  */
  max(e) {
    return e.pos > this.pos ? e : this;
  }
  /**
  Return the smaller of this and the given position.
  */
  min(e) {
    return e.pos < this.pos ? e : this;
  }
  /**
  @internal
  */
  toString() {
    let e = "";
    for (let n = 1; n <= this.depth; n++)
      e += (e ? "/" : "") + this.node(n).type.name + "_" + this.index(n - 1);
    return e + ":" + this.parentOffset;
  }
  /**
  @internal
  */
  static resolve(e, n) {
    if (!(n >= 0 && n <= e.content.size))
      throw new RangeError("Position " + n + " out of range");
    let r = [], i = 0, s = n;
    for (let o = e; ; ) {
      let { index: l, offset: a } = o.content.findIndex(s), u = s - a;
      if (r.push(o, l, i + a), !u || (o = o.child(l), o.isText))
        break;
      s = u - 1, i += a + 1;
    }
    return new qr(n, r, s);
  }
  /**
  @internal
  */
  static resolveCached(e, n) {
    let r = Hu.get(e);
    if (r)
      for (let s = 0; s < r.elts.length; s++) {
        let o = r.elts[s];
        if (o.pos == n)
          return o;
      }
    else
      Hu.set(e, r = new _0());
    let i = r.elts[r.i] = qr.resolve(e, n);
    return r.i = (r.i + 1) % T0, i;
  }
}
class _0 {
  constructor() {
    this.elts = [], this.i = 0;
  }
}
const T0 = 12, Hu = /* @__PURE__ */ new WeakMap();
class vf {
  /**
  Construct a node range. `$from` and `$to` should point into the
  same node until at least the given `depth`, since a node range
  denotes an adjacent set of nodes in a single parent node.
  */
  constructor(e, n, r) {
    this.$from = e, this.$to = n, this.depth = r;
  }
  /**
  The position at the start of the range.
  */
  get start() {
    return this.$from.before(this.depth + 1);
  }
  /**
  The position at the end of the range.
  */
  get end() {
    return this.$to.after(this.depth + 1);
  }
  /**
  The parent node that the range points into.
  */
  get parent() {
    return this.$from.node(this.depth);
  }
  /**
  The start index of the range in the parent node.
  */
  get startIndex() {
    return this.$from.index(this.depth);
  }
  /**
  The end index of the range in the parent node.
  */
  get endIndex() {
    return this.$to.indexAfter(this.depth);
  }
}
const A0 = /* @__PURE__ */ Object.create(null);
class bt {
  /**
  @internal
  */
  constructor(e, n, r, i = be.none) {
    this.type = e, this.attrs = n, this.marks = i, this.content = r || K.empty;
  }
  /**
  The array of this node's child nodes.
  */
  get children() {
    return this.content.content;
  }
  /**
  The size of this node, as defined by the integer-based [indexing
  scheme](https://prosemirror.net/docs/guide/#doc.indexing). For text nodes, this is the
  amount of characters. For other leaf nodes, it is one. For
  non-leaf nodes, it is the size of the content plus two (the
  start and end token).
  */
  get nodeSize() {
    return this.isLeaf ? 1 : 2 + this.content.size;
  }
  /**
  The number of children that the node has.
  */
  get childCount() {
    return this.content.childCount;
  }
  /**
  Get the child node at the given index. Raises an error when the
  index is out of range.
  */
  child(e) {
    return this.content.child(e);
  }
  /**
  Get the child node at the given index, if it exists.
  */
  maybeChild(e) {
    return this.content.maybeChild(e);
  }
  /**
  Call `f` for every child node, passing the node, its offset
  into this parent node, and its index.
  */
  forEach(e) {
    this.content.forEach(e);
  }
  /**
  Invoke a callback for all descendant nodes recursively overlapping
  the given two positions that are relative to start of this
  node's content. This includes all ancestors of the nodes
  containing the two positions. The callback is invoked with the
  node, its position relative to the original node (method receiver),
  its parent node, and its child index. When the callback returns
  false for a given node, that node's children will not be
  recursed over. The last parameter can be used to specify a
  starting position to count from.
  */
  nodesBetween(e, n, r, i = 0) {
    this.content.nodesBetween(e, n, r, i, this);
  }
  /**
  Call the given callback for every descendant node. Doesn't
  descend into a node when the callback returns `false`.
  */
  descendants(e) {
    this.nodesBetween(0, this.content.size, e);
  }
  /**
  Concatenates all the text nodes found in this fragment and its
  children.
  */
  get textContent() {
    return this.isLeaf && this.type.spec.leafText ? this.type.spec.leafText(this) : this.textBetween(0, this.content.size, "");
  }
  /**
  Get all text between positions `from` and `to`. When
  `blockSeparator` is given, it will be inserted to separate text
  from different block nodes. If `leafText` is given, it'll be
  inserted for every non-text leaf node encountered, otherwise
  [`leafText`](https://prosemirror.net/docs/ref/#model.NodeSpec.leafText) will be used.
  */
  textBetween(e, n, r, i) {
    return this.content.textBetween(e, n, r, i);
  }
  /**
  Returns this node's first child, or `null` if there are no
  children.
  */
  get firstChild() {
    return this.content.firstChild;
  }
  /**
  Returns this node's last child, or `null` if there are no
  children.
  */
  get lastChild() {
    return this.content.lastChild;
  }
  /**
  Test whether two nodes represent the same piece of document.
  */
  eq(e) {
    return this == e || this.sameMarkup(e) && this.content.eq(e.content);
  }
  /**
  Compare the markup (type, attributes, and marks) of this node to
  those of another. Returns `true` if both have the same markup.
  */
  sameMarkup(e) {
    return this.hasMarkup(e.type, e.attrs, e.marks);
  }
  /**
  Check whether this node's markup correspond to the given type,
  attributes, and marks.
  */
  hasMarkup(e, n, r) {
    return this.type == e && es(this.attrs, n || e.defaultAttrs || A0) && be.sameSet(this.marks, r || be.none);
  }
  /**
  Create a new node with the same markup as this node, containing
  the given content (or empty, if no content is given).
  */
  copy(e = null) {
    return e == this.content ? this : new bt(this.type, this.attrs, e, this.marks);
  }
  /**
  Create a copy of this node, with the given set of marks instead
  of the node's own marks.
  */
  mark(e) {
    return e == this.marks ? this : new bt(this.type, this.attrs, this.content, e);
  }
  /**
  Create a copy of this node with only the content between the
  given positions. If `to` is not given, it defaults to the end of
  the node.
  */
  cut(e, n = this.content.size) {
    return e == 0 && n == this.content.size ? this : this.copy(this.content.cut(e, n));
  }
  /**
  Cut out the part of the document between the given positions, and
  return it as a `Slice` object.
  */
  slice(e, n = this.content.size, r = !1) {
    if (e == n)
      return ne.empty;
    let i = this.resolve(e), s = this.resolve(n), o = r ? 0 : i.sharedDepth(n), l = i.start(o), u = i.node(o).content.cut(i.pos - l, s.pos - l);
    return new ne(u, i.depth - o, s.depth - o);
  }
  /**
  Replace the part of the document between the given positions with
  the given slice. The slice must 'fit', meaning its open sides
  must be able to connect to the surrounding content, and its
  content nodes must be valid children for the node they are placed
  into. If any of this is violated, an error of type
  [`ReplaceError`](https://prosemirror.net/docs/ref/#model.ReplaceError) is thrown.
  */
  replace(e, n, r) {
    return N0(this.resolve(e), this.resolve(n), r);
  }
  /**
  Find the node directly after the given position.
  */
  nodeAt(e) {
    for (let n = this; ; ) {
      let { index: r, offset: i } = n.content.findIndex(e);
      if (n = n.maybeChild(r), !n)
        return null;
      if (i == e || n.isText)
        return n;
      e -= i + 1;
    }
  }
  /**
  Find the (direct) child node after the given offset, if any,
  and return it along with its index and offset relative to this
  node.
  */
  childAfter(e) {
    let { index: n, offset: r } = this.content.findIndex(e);
    return { node: this.content.maybeChild(n), index: n, offset: r };
  }
  /**
  Find the (direct) child node before the given offset, if any,
  and return it along with its index and offset relative to this
  node.
  */
  childBefore(e) {
    if (e == 0)
      return { node: null, index: 0, offset: 0 };
    let { index: n, offset: r } = this.content.findIndex(e);
    if (r < e)
      return { node: this.content.child(n), index: n, offset: r };
    let i = this.content.child(n - 1);
    return { node: i, index: n - 1, offset: r - i.nodeSize };
  }
  /**
  Resolve the given position in the document, returning an
  [object](https://prosemirror.net/docs/ref/#model.ResolvedPos) with information about its context.
  */
  resolve(e) {
    return qr.resolveCached(this, e);
  }
  /**
  @internal
  */
  resolveNoCache(e) {
    return qr.resolve(this, e);
  }
  /**
  Test whether a given mark or mark type occurs in this document
  between the two given positions.
  */
  rangeHasMark(e, n, r) {
    let i = !1;
    return n > e && this.nodesBetween(e, n, (s) => (r.isInSet(s.marks) && (i = !0), !i)), i;
  }
  /**
  True when this is a block (non-inline node)
  */
  get isBlock() {
    return this.type.isBlock;
  }
  /**
  True when this is a textblock node, a block node with inline
  content.
  */
  get isTextblock() {
    return this.type.isTextblock;
  }
  /**
  True when this node allows inline content.
  */
  get inlineContent() {
    return this.type.inlineContent;
  }
  /**
  True when this is an inline node (a text node or a node that can
  appear among text).
  */
  get isInline() {
    return this.type.isInline;
  }
  /**
  True when this is a text node.
  */
  get isText() {
    return this.type.isText;
  }
  /**
  True when this is a leaf node.
  */
  get isLeaf() {
    return this.type.isLeaf;
  }
  /**
  True when this is an atom, i.e. when it does not have directly
  editable content. This is usually the same as `isLeaf`, but can
  be configured with the [`atom` property](https://prosemirror.net/docs/ref/#model.NodeSpec.atom)
  on a node's spec (typically used when the node is displayed as
  an uneditable [node view](https://prosemirror.net/docs/ref/#view.NodeView)).
  */
  get isAtom() {
    return this.type.isAtom;
  }
  /**
  Return a string representation of this node for debugging
  purposes.
  */
  toString() {
    if (this.type.spec.toDebugString)
      return this.type.spec.toDebugString(this);
    let e = this.type.name;
    return this.content.size && (e += "(" + this.content.toStringInner() + ")"), Nf(this.marks, e);
  }
  /**
  Get the content match in this node at the given index.
  */
  contentMatchAt(e) {
    let n = this.type.contentMatch.matchFragment(this.content, 0, e);
    if (!n)
      throw new Error("Called contentMatchAt on a node with invalid content");
    return n;
  }
  /**
  Test whether replacing the range between `from` and `to` (by
  child index) with the given replacement fragment (which defaults
  to the empty fragment) would leave the node's content valid. You
  can optionally pass `start` and `end` indices into the
  replacement fragment.
  */
  canReplace(e, n, r = K.empty, i = 0, s = r.childCount) {
    let o = this.contentMatchAt(e).matchFragment(r, i, s), l = o && o.matchFragment(this.content, n);
    if (!l || !l.validEnd)
      return !1;
    for (let a = i; a < s; a++)
      if (!this.type.allowsMarks(r.child(a).marks))
        return !1;
    return !0;
  }
  /**
  Test whether replacing the range `from` to `to` (by index) with
  a node of the given type would leave the node's content valid.
  */
  canReplaceWith(e, n, r, i) {
    if (i && !this.type.allowsMarks(i))
      return !1;
    let s = this.contentMatchAt(e).matchType(r), o = s && s.matchFragment(this.content, n);
    return o ? o.validEnd : !1;
  }
  /**
  Test whether the given node's content could be appended to this
  node. If that node is empty, this will only return true if there
  is at least one node type that can appear in both nodes (to avoid
  merging completely incompatible nodes).
  */
  canAppend(e) {
    return e.content.size ? this.canReplace(this.childCount, this.childCount, e.content) : this.type.compatibleContent(e.type);
  }
  /**
  Check whether this node and its descendants conform to the
  schema, and raise an exception when they do not.
  */
  check() {
    this.type.checkContent(this.content), Uu(this.type.attrs, this.attrs, "node", this.type.name);
    let e = be.none;
    for (let n = 0; n < this.marks.length; n++) {
      let r = this.marks[n];
      Uu(r.type.attrs, r.attrs, "mark", r.type.name), e = r.addToSet(e);
    }
    if (!be.sameSet(e, this.marks))
      throw new RangeError(`Invalid collection of marks for node ${this.type.name}: ${this.marks.map((n) => n.type.name)}`);
    this.content.forEach((n) => n.check());
  }
  /**
  Return a JSON-serializeable representation of this node.
  */
  toJSON() {
    let e = { type: this.type.name };
    for (let n in this.attrs) {
      e.attrs = this.attrs;
      break;
    }
    return this.content.size && (e.content = this.content.toJSON()), this.marks.length && (e.marks = this.marks.map((n) => n.toJSON())), e;
  }
  /**
  Deserialize a node from its JSON representation.
  */
  static fromJSON(e, n) {
    if (!n)
      throw new RangeError("Invalid input for Node.fromJSON");
    let r;
    if (n.marks) {
      if (!Array.isArray(n.marks))
        throw new RangeError("Invalid mark data for Node.fromJSON");
      r = n.marks.map(e.markFromJSON);
    }
    if (n.type == "text") {
      if (typeof n.text != "string")
        throw new RangeError("Invalid text node in JSON");
      return e.text(n.text, r);
    }
    let i = K.fromJSON(e, n.content);
    return e.nodeType(n.type).create(n.attrs, i, r);
  }
}
bt.prototype.text = void 0;
class ns extends bt {
  /**
  @internal
  */
  constructor(e, n, r, i) {
    if (super(e, n, null, i), !r)
      throw new RangeError("Empty text nodes are not allowed");
    this.text = r;
  }
  toString() {
    return this.type.spec.toDebugString ? this.type.spec.toDebugString(this) : Nf(this.marks, JSON.stringify(this.text));
  }
  get textContent() {
    return this.text;
  }
  textBetween(e, n) {
    return this.text.slice(e, n);
  }
  get nodeSize() {
    return this.text.length;
  }
  mark(e) {
    return e == this.marks ? this : new ns(this.type, this.attrs, this.text, e);
  }
  withText(e) {
    return e == this.text ? this : new ns(this.type, this.attrs, e, this.marks);
  }
  cut(e = 0, n = this.text.length) {
    return e == 0 && n == this.text.length ? this : this.withText(this.text.slice(e, n));
  }
  eq(e) {
    return this.sameMarkup(e) && this.text == e.text;
  }
  toJSON() {
    let e = super.toJSON();
    return e.text = this.text, e;
  }
}
function Nf(t, e) {
  for (let n = t.length - 1; n >= 0; n--)
    e = t[n].type.name + "(" + e + ")";
  return e;
}
function Uu(t, e, n, r) {
  for (let i in e)
    if (!(i in t))
      throw new RangeError(`Unsupported attribute ${i} for ${n} of type ${r}`);
  for (let i in t)
    t[i].validate && t[i].validate(e[i]);
}
class jn {
  /**
  @internal
  */
  constructor(e) {
    this.validEnd = e, this.next = [], this.wrapCache = [];
  }
  /**
  @internal
  */
  static parse(e, n) {
    let r = new E0(e, n);
    if (r.next == null)
      return jn.empty;
    let i = If(r);
    r.next && r.err("Unexpected trailing text");
    let s = L0(P0(i));
    return B0(s, r), s;
  }
  /**
  Match a node type, returning a match after that node if
  successful.
  */
  matchType(e) {
    for (let n = 0; n < this.next.length; n++)
      if (this.next[n].type == e)
        return this.next[n].next;
    return null;
  }
  /**
  Try to match a fragment. Returns the resulting match when
  successful.
  */
  matchFragment(e, n = 0, r = e.childCount) {
    let i = this;
    for (let s = n; i && s < r; s++)
      i = i.matchType(e.child(s).type);
    return i;
  }
  /**
  @internal
  */
  get inlineContent() {
    return this.next.length != 0 && this.next[0].type.isInline;
  }
  /**
  Get the first matching node type at this match position that can
  be generated.
  */
  get defaultType() {
    for (let e = 0; e < this.next.length; e++) {
      let { type: n } = this.next[e];
      if (!(n.isText || n.hasRequiredAttrs()))
        return n;
    }
    return null;
  }
  /**
  @internal
  */
  compatible(e) {
    for (let n = 0; n < this.next.length; n++)
      for (let r = 0; r < e.next.length; r++)
        if (this.next[n].type == e.next[r].type)
          return !0;
    return !1;
  }
  /**
  Try to match the given fragment, and if that fails, see if it can
  be made to match by inserting nodes in front of it. When
  successful, return a fragment of inserted nodes (which may be
  empty if nothing had to be inserted). When `toEnd` is true, only
  return a fragment if the resulting match goes to the end of the
  content expression.
  */
  fillBefore(e, n = !1, r = 0) {
    let i = [this];
    function s(o, l) {
      let a = o.matchFragment(e, r);
      if (a && (!n || a.validEnd))
        return K.from(l.map((u) => u.createAndFill()));
      for (let u = 0; u < o.next.length; u++) {
        let { type: c, next: h } = o.next[u];
        if (!(c.isText || c.hasRequiredAttrs()) && i.indexOf(h) == -1) {
          i.push(h);
          let d = s(h, l.concat(c));
          if (d)
            return d;
        }
      }
      return null;
    }
    return s(this, []);
  }
  /**
  Find a set of wrapping node types that would allow a node of the
  given type to appear at this position. The result may be empty
  (when it fits directly) and will be null when no such wrapping
  exists.
  */
  findWrapping(e) {
    for (let r = 0; r < this.wrapCache.length; r += 2)
      if (this.wrapCache[r] == e)
        return this.wrapCache[r + 1];
    let n = this.computeWrapping(e);
    return this.wrapCache.push(e, n), n;
  }
  /**
  @internal
  */
  computeWrapping(e) {
    let n = /* @__PURE__ */ Object.create(null), r = [{ match: this, type: null, via: null }];
    for (; r.length; ) {
      let i = r.shift(), s = i.match;
      if (s.matchType(e)) {
        let o = [];
        for (let l = i; l.type; l = l.via)
          o.push(l.type);
        return o.reverse();
      }
      for (let o = 0; o < s.next.length; o++) {
        let { type: l, next: a } = s.next[o];
        !l.isLeaf && !l.hasRequiredAttrs() && !(l.name in n) && (!i.type || a.validEnd) && (r.push({ match: l.contentMatch, type: l, via: i }), n[l.name] = !0);
      }
    }
    return null;
  }
  /**
  The number of outgoing edges this node has in the finite
  automaton that describes the content expression.
  */
  get edgeCount() {
    return this.next.length;
  }
  /**
  Get the _n_​th outgoing edge from this node in the finite
  automaton that describes the content expression.
  */
  edge(e) {
    if (e >= this.next.length)
      throw new RangeError(`There's no ${e}th edge in this content match`);
    return this.next[e];
  }
  /**
  @internal
  */
  toString() {
    let e = [];
    function n(r) {
      e.push(r);
      for (let i = 0; i < r.next.length; i++)
        e.indexOf(r.next[i].next) == -1 && n(r.next[i].next);
    }
    return n(this), e.map((r, i) => {
      let s = i + (r.validEnd ? "*" : " ") + " ";
      for (let o = 0; o < r.next.length; o++)
        s += (o ? ", " : "") + r.next[o].type.name + "->" + e.indexOf(r.next[o].next);
      return s;
    }).join(`
`);
  }
}
jn.empty = new jn(!0);
class E0 {
  constructor(e, n) {
    this.string = e, this.nodeTypes = n, this.inline = null, this.pos = 0, this.tokens = e.split(/\s*(?=\b|\W|$)/), this.tokens[this.tokens.length - 1] == "" && this.tokens.pop(), this.tokens[0] == "" && this.tokens.shift();
  }
  get next() {
    return this.tokens[this.pos];
  }
  eat(e) {
    return this.next == e && (this.pos++ || !0);
  }
  err(e) {
    throw new SyntaxError(e + " (in content expression '" + this.string + "')");
  }
}
function If(t) {
  let e = [];
  do
    e.push(M0(t));
  while (t.eat("|"));
  return e.length == 1 ? e[0] : { type: "choice", exprs: e };
}
function M0(t) {
  let e = [];
  do
    e.push(O0(t));
  while (t.next && t.next != ")" && t.next != "|");
  return e.length == 1 ? e[0] : { type: "seq", exprs: e };
}
function O0(t) {
  let e = z0(t);
  for (; ; )
    if (t.eat("+"))
      e = { type: "plus", expr: e };
    else if (t.eat("*"))
      e = { type: "star", expr: e };
    else if (t.eat("?"))
      e = { type: "opt", expr: e };
    else if (t.eat("{"))
      e = D0(t, e);
    else
      break;
  return e;
}
function qu(t) {
  /\D/.test(t.next) && t.err("Expected number, got '" + t.next + "'");
  let e = Number(t.next);
  return t.pos++, e;
}
function D0(t, e) {
  let n = qu(t), r = n;
  return t.eat(",") && (t.next != "}" ? r = qu(t) : r = -1), t.eat("}") || t.err("Unclosed braced range"), { type: "range", min: n, max: r, expr: e };
}
function R0(t, e) {
  let n = t.nodeTypes, r = n[e];
  if (r)
    return [r];
  let i = [];
  for (let s in n) {
    let o = n[s];
    o.isInGroup(e) && i.push(o);
  }
  return i.length == 0 && t.err("No node type or group '" + e + "' found"), i;
}
function z0(t) {
  if (t.eat("(")) {
    let e = If(t);
    return t.eat(")") || t.err("Missing closing paren"), e;
  } else if (/\W/.test(t.next))
    t.err("Unexpected token '" + t.next + "'");
  else {
    let e = R0(t, t.next).map((n) => (t.inline == null ? t.inline = n.isInline : t.inline != n.isInline && t.err("Mixing inline and block content"), { type: "name", value: n }));
    return t.pos++, e.length == 1 ? e[0] : { type: "choice", exprs: e };
  }
}
function P0(t) {
  let e = [[]];
  return i(s(t, 0), n()), e;
  function n() {
    return e.push([]) - 1;
  }
  function r(o, l, a) {
    let u = { term: a, to: l };
    return e[o].push(u), u;
  }
  function i(o, l) {
    o.forEach((a) => a.to = l);
  }
  function s(o, l) {
    if (o.type == "choice")
      return o.exprs.reduce((a, u) => a.concat(s(u, l)), []);
    if (o.type == "seq")
      for (let a = 0; ; a++) {
        let u = s(o.exprs[a], l);
        if (a == o.exprs.length - 1)
          return u;
        i(u, l = n());
      }
    else if (o.type == "star") {
      let a = n();
      return r(l, a), i(s(o.expr, a), a), [r(a)];
    } else if (o.type == "plus") {
      let a = n();
      return i(s(o.expr, l), a), i(s(o.expr, a), a), [r(a)];
    } else {
      if (o.type == "opt")
        return [r(l)].concat(s(o.expr, l));
      if (o.type == "range") {
        let a = l;
        for (let u = 0; u < o.min; u++) {
          let c = n();
          i(s(o.expr, a), c), a = c;
        }
        if (o.max == -1)
          i(s(o.expr, a), a);
        else
          for (let u = o.min; u < o.max; u++) {
            let c = n();
            r(a, c), i(s(o.expr, a), c), a = c;
          }
        return [r(a)];
      } else {
        if (o.type == "name")
          return [r(l, void 0, o.value)];
        throw new Error("Unknown expr type");
      }
    }
  }
}
function _f(t, e) {
  return e - t;
}
function Ku(t, e) {
  let n = [];
  return r(e), n.sort(_f);
  function r(i) {
    let s = t[i];
    if (s.length == 1 && !s[0].term)
      return r(s[0].to);
    n.push(i);
    for (let o = 0; o < s.length; o++) {
      let { term: l, to: a } = s[o];
      !l && n.indexOf(a) == -1 && r(a);
    }
  }
}
function L0(t) {
  let e = /* @__PURE__ */ Object.create(null);
  return n(Ku(t, 0));
  function n(r) {
    let i = [];
    r.forEach((o) => {
      t[o].forEach(({ term: l, to: a }) => {
        if (!l)
          return;
        let u;
        for (let c = 0; c < i.length; c++)
          i[c][0] == l && (u = i[c][1]);
        Ku(t, a).forEach((c) => {
          u || i.push([l, u = []]), u.indexOf(c) == -1 && u.push(c);
        });
      });
    });
    let s = e[r.join(",")] = new jn(r.indexOf(t.length - 1) > -1);
    for (let o = 0; o < i.length; o++) {
      let l = i[o][1].sort(_f);
      s.next.push({ type: i[o][0], next: e[l.join(",")] || n(l) });
    }
    return s;
  }
}
function B0(t, e) {
  for (let n = 0, r = [t]; n < r.length; n++) {
    let i = r[n], s = !i.validEnd, o = [];
    for (let l = 0; l < i.next.length; l++) {
      let { type: a, next: u } = i.next[l];
      o.push(a.name), s && !(a.isText || a.hasRequiredAttrs()) && (s = !1), r.indexOf(u) == -1 && r.push(u);
    }
    s && e.err("Only non-generatable nodes (" + o.join(", ") + ") in a required position (see https://prosemirror.net/docs/guide/#generatable)");
  }
}
function Tf(t) {
  let e = /* @__PURE__ */ Object.create(null);
  for (let n in t) {
    let r = t[n];
    if (!r.hasDefault)
      return null;
    e[n] = r.default;
  }
  return e;
}
function Af(t, e) {
  let n = /* @__PURE__ */ Object.create(null);
  for (let r in t) {
    let i = t[r], s = e && e[r];
    if (s === void 0)
      if (i.hasDefault)
        s = i.default;
      else
        throw new RangeError("No value supplied for attribute " + r);
    else i.validate && i.validate(s);
    n[r] = s;
  }
  return n;
}
function Ef(t, e) {
  let n = /* @__PURE__ */ Object.create(null);
  if (e)
    for (let r in e)
      n[r] = new $0(t, r, e[r]);
  return n;
}
let Ju = class Mf {
  /**
  @internal
  */
  constructor(e, n, r) {
    this.name = e, this.schema = n, this.spec = r, this.markSet = null, this.groups = r.group ? r.group.split(" ") : [], this.attrs = Ef(e, r.attrs), this.defaultAttrs = Tf(this.attrs), this.contentMatch = null, this.inlineContent = null, this.isBlock = !(r.inline || e == "text"), this.isText = e == "text";
  }
  /**
  True if this is an inline type.
  */
  get isInline() {
    return !this.isBlock;
  }
  /**
  True if this is a textblock type, a block that contains inline
  content.
  */
  get isTextblock() {
    return this.isBlock && this.inlineContent;
  }
  /**
  True for node types that allow no content.
  */
  get isLeaf() {
    return this.contentMatch == jn.empty;
  }
  /**
  True when this node is an atom, i.e. when it does not have
  directly editable content.
  */
  get isAtom() {
    return this.isLeaf || !!this.spec.atom;
  }
  /**
  Return true when this node type is part of the given
  [group](https://prosemirror.net/docs/ref/#model.NodeSpec.group).
  */
  isInGroup(e) {
    return this.groups.indexOf(e) > -1;
  }
  /**
  The node type's [whitespace](https://prosemirror.net/docs/ref/#model.NodeSpec.whitespace) option.
  */
  get whitespace() {
    return this.spec.whitespace || (this.spec.code ? "pre" : "normal");
  }
  /**
  Tells you whether this node type has any required attributes.
  */
  hasRequiredAttrs() {
    for (let e in this.attrs)
      if (this.attrs[e].isRequired)
        return !0;
    return !1;
  }
  /**
  Indicates whether this node allows some of the same content as
  the given node type.
  */
  compatibleContent(e) {
    return this == e || this.contentMatch.compatible(e.contentMatch);
  }
  /**
  @internal
  */
  computeAttrs(e) {
    return !e && this.defaultAttrs ? this.defaultAttrs : Af(this.attrs, e);
  }
  /**
  Create a `Node` of this type. The given attributes are
  checked and defaulted (you can pass `null` to use the type's
  defaults entirely, if no required attributes exist). `content`
  may be a `Fragment`, a node, an array of nodes, or
  `null`. Similarly `marks` may be `null` to default to the empty
  set of marks.
  */
  create(e = null, n, r) {
    if (this.isText)
      throw new Error("NodeType.create can't construct text nodes");
    return new bt(this, this.computeAttrs(e), K.from(n), be.setFrom(r));
  }
  /**
  Like [`create`](https://prosemirror.net/docs/ref/#model.NodeType.create), but check the given content
  against the node type's content restrictions, and throw an error
  if it doesn't match.
  */
  createChecked(e = null, n, r) {
    return n = K.from(n), this.checkContent(n), new bt(this, this.computeAttrs(e), n, be.setFrom(r));
  }
  /**
  Like [`create`](https://prosemirror.net/docs/ref/#model.NodeType.create), but see if it is
  necessary to add nodes to the start or end of the given fragment
  to make it fit the node. If no fitting wrapping can be found,
  return null. Note that, due to the fact that required nodes can
  always be created, this will always succeed if you pass null or
  `Fragment.empty` as content.
  */
  createAndFill(e = null, n, r) {
    if (e = this.computeAttrs(e), n = K.from(n), n.size) {
      let o = this.contentMatch.fillBefore(n);
      if (!o)
        return null;
      n = o.append(n);
    }
    let i = this.contentMatch.matchFragment(n), s = i && i.fillBefore(K.empty, !0);
    return s ? new bt(this, e, n.append(s), be.setFrom(r)) : null;
  }
  /**
  Returns true if the given fragment is valid content for this node
  type.
  */
  validContent(e) {
    let n = this.contentMatch.matchFragment(e);
    if (!n || !n.validEnd)
      return !1;
    for (let r = 0; r < e.childCount; r++)
      if (!this.allowsMarks(e.child(r).marks))
        return !1;
    return !0;
  }
  /**
  Throws a RangeError if the given fragment is not valid content for this
  node type.
  @internal
  */
  checkContent(e) {
    if (!this.validContent(e))
      throw new RangeError(`Invalid content for node ${this.name}: ${e.toString().slice(0, 50)}`);
  }
  /**
  @internal no longer useful, but called by old prosemirror-view versions
  */
  checkAttrs(e) {
  }
  /**
  Check whether the given mark type is allowed in this node.
  */
  allowsMarkType(e) {
    return this.markSet == null || this.markSet.indexOf(e) > -1;
  }
  /**
  Test whether the given set of marks are allowed in this node.
  */
  allowsMarks(e) {
    if (this.markSet == null)
      return !0;
    for (let n = 0; n < e.length; n++)
      if (!this.allowsMarkType(e[n].type))
        return !1;
    return !0;
  }
  /**
  Removes the marks that are not allowed in this node from the given set.
  */
  allowedMarks(e) {
    if (this.markSet == null)
      return e;
    let n;
    for (let r = 0; r < e.length; r++)
      this.allowsMarkType(e[r].type) ? n && n.push(e[r]) : n || (n = e.slice(0, r));
    return n ? n.length ? n : be.none : e;
  }
  /**
  @internal
  */
  static compile(e, n) {
    let r = /* @__PURE__ */ Object.create(null);
    e.forEach((s, o) => r[s] = new Mf(s, n, o));
    let i = n.spec.topNode || "doc";
    if (!r[i])
      throw new RangeError("Schema is missing its top node type ('" + i + "')");
    if (!r.text)
      throw new RangeError("Every schema needs a 'text' type");
    for (let s in r.text.attrs)
      throw new RangeError("The text node type should not have attributes");
    return r;
  }
};
function F0(t, e, n) {
  let r = n.split("|");
  return (i) => {
    let s = i === null ? "null" : typeof i;
    if (r.indexOf(s) < 0)
      throw new RangeError(`Expected value of type ${r} for attribute ${e} on type ${t}, got ${s}`);
  };
}
class $0 {
  constructor(e, n, r) {
    this.hasDefault = Object.prototype.hasOwnProperty.call(r, "default"), this.default = r.default, this.validate = typeof r.validate == "string" ? F0(e, n, r.validate) : r.validate;
  }
  get isRequired() {
    return !this.hasDefault;
  }
}
class Cs {
  /**
  @internal
  */
  constructor(e, n, r, i) {
    this.name = e, this.rank = n, this.schema = r, this.spec = i, this.attrs = Ef(e, i.attrs), this.excluded = null;
    let s = Tf(this.attrs);
    this.instance = s ? new be(this, s) : null;
  }
  /**
  Create a mark of this type. `attrs` may be `null` or an object
  containing only some of the mark's attributes. The others, if
  they have defaults, will be added.
  */
  create(e = null) {
    return !e && this.instance ? this.instance : new be(this, Af(this.attrs, e));
  }
  /**
  @internal
  */
  static compile(e, n) {
    let r = /* @__PURE__ */ Object.create(null), i = 0;
    return e.forEach((s, o) => r[s] = new Cs(s, i++, n, o)), r;
  }
  /**
  When there is a mark of this type in the given set, a new set
  without it is returned. Otherwise, the input set is returned.
  */
  removeFromSet(e) {
    for (var n = 0; n < e.length; n++)
      e[n].type == this && (e = e.slice(0, n).concat(e.slice(n + 1)), n--);
    return e;
  }
  /**
  Tests whether there is a mark of this type in the given set.
  */
  isInSet(e) {
    for (let n = 0; n < e.length; n++)
      if (e[n].type == this)
        return e[n];
  }
  /**
  Queries whether a given mark type is
  [excluded](https://prosemirror.net/docs/ref/#model.MarkSpec.excludes) by this one.
  */
  excludes(e) {
    return this.excluded.indexOf(e) > -1;
  }
}
class j0 {
  /**
  Construct a schema from a schema [specification](https://prosemirror.net/docs/ref/#model.SchemaSpec).
  */
  constructor(e) {
    this.linebreakReplacement = null, this.cached = /* @__PURE__ */ Object.create(null);
    let n = this.spec = {};
    for (let i in e)
      n[i] = e[i];
    n.nodes = Fe.from(e.nodes), n.marks = Fe.from(e.marks || {}), this.nodes = Ju.compile(this.spec.nodes, this), this.marks = Cs.compile(this.spec.marks, this);
    let r = /* @__PURE__ */ Object.create(null);
    for (let i in this.nodes) {
      if (i in this.marks)
        throw new RangeError(i + " can not be both a node and a mark");
      let s = this.nodes[i], o = s.spec.content || "", l = s.spec.marks;
      if (s.contentMatch = r[o] || (r[o] = jn.parse(o, this.nodes)), s.inlineContent = s.contentMatch.inlineContent, s.spec.linebreakReplacement) {
        if (this.linebreakReplacement)
          throw new RangeError("Multiple linebreak nodes defined");
        if (!s.isInline || !s.isLeaf)
          throw new RangeError("Linebreak replacement nodes must be inline leaf nodes");
        this.linebreakReplacement = s;
      }
      s.markSet = l == "_" ? null : l ? Gu(this, l.split(" ")) : l == "" || !s.inlineContent ? [] : null;
    }
    for (let i in this.marks) {
      let s = this.marks[i], o = s.spec.excludes;
      s.excluded = o == null ? [s] : o == "" ? [] : Gu(this, o.split(" "));
    }
    this.nodeFromJSON = (i) => bt.fromJSON(this, i), this.markFromJSON = (i) => be.fromJSON(this, i), this.topNodeType = this.nodes[this.spec.topNode || "doc"], this.cached.wrappings = /* @__PURE__ */ Object.create(null);
  }
  /**
  Create a node in this schema. The `type` may be a string or a
  `NodeType` instance. Attributes will be extended with defaults,
  `content` may be a `Fragment`, `null`, a `Node`, or an array of
  nodes.
  */
  node(e, n = null, r, i) {
    if (typeof e == "string")
      e = this.nodeType(e);
    else if (e instanceof Ju) {
      if (e.schema != this)
        throw new RangeError("Node type from different schema used (" + e.name + ")");
    } else throw new RangeError("Invalid node type: " + e);
    return e.createChecked(n, r, i);
  }
  /**
  Create a text node in the schema. Empty text nodes are not
  allowed.
  */
  text(e, n) {
    let r = this.nodes.text;
    return new ns(r, r.defaultAttrs, e, be.setFrom(n));
  }
  /**
  Create a mark with the given type and attributes.
  */
  mark(e, n) {
    return typeof e == "string" && (e = this.marks[e]), e.create(n);
  }
  /**
  @internal
  */
  nodeType(e) {
    let n = this.nodes[e];
    if (!n)
      throw new RangeError("Unknown node type: " + e);
    return n;
  }
}
function Gu(t, e) {
  let n = [];
  for (let r = 0; r < e.length; r++) {
    let i = e[r], s = t.marks[i], o = s;
    if (s)
      n.push(s);
    else
      for (let l in t.marks) {
        let a = t.marks[l];
        (i == "_" || a.spec.group && a.spec.group.split(" ").indexOf(i) > -1) && n.push(o = a);
      }
    if (!o)
      throw new SyntaxError("Unknown mark type: '" + e[r] + "'");
  }
  return n;
}
function V0(t) {
  return t.tag != null;
}
function W0(t) {
  return t.style != null;
}
class ir {
  /**
  Create a parser that targets the given schema, using the given
  parsing rules.
  */
  constructor(e, n) {
    this.schema = e, this.rules = n, this.tags = [], this.styles = [];
    let r = this.matchedStyles = [];
    n.forEach((i) => {
      if (V0(i))
        this.tags.push(i);
      else if (W0(i)) {
        let s = /[^=]*/.exec(i.style)[0];
        r.indexOf(s) < 0 && r.push(s), this.styles.push(i);
      }
    }), this.normalizeLists = !this.tags.some((i) => {
      if (!/^(ul|ol)\b/.test(i.tag) || !i.node)
        return !1;
      let s = e.nodes[i.node];
      return s.contentMatch.matchType(s);
    });
  }
  /**
  Parse a document from the content of a DOM node.
  */
  parse(e, n = {}) {
    let r = new Yu(this, n, !1);
    return r.addAll(e, be.none, n.from, n.to), r.finish();
  }
  /**
  Parses the content of the given DOM node, like
  [`parse`](https://prosemirror.net/docs/ref/#model.DOMParser.parse), and takes the same set of
  options. But unlike that method, which produces a whole node,
  this one returns a slice that is open at the sides, meaning that
  the schema constraints aren't applied to the start of nodes to
  the left of the input and the end of nodes at the end.
  */
  parseSlice(e, n = {}) {
    let r = new Yu(this, n, !0);
    return r.addAll(e, be.none, n.from, n.to), ne.maxOpen(r.finish());
  }
  /**
  @internal
  */
  matchTag(e, n, r) {
    for (let i = r ? this.tags.indexOf(r) + 1 : 0; i < this.tags.length; i++) {
      let s = this.tags[i];
      if (q0(e, s.tag) && (s.namespace === void 0 || e.namespaceURI == s.namespace) && (!s.context || n.matchesContext(s.context))) {
        if (s.getAttrs) {
          let o = s.getAttrs(e);
          if (o === !1)
            continue;
          s.attrs = o || void 0;
        }
        return s;
      }
    }
  }
  /**
  @internal
  */
  matchStyle(e, n, r, i) {
    for (let s = i ? this.styles.indexOf(i) + 1 : 0; s < this.styles.length; s++) {
      let o = this.styles[s], l = o.style;
      if (!(l.indexOf(e) != 0 || o.context && !r.matchesContext(o.context) || // Test that the style string either precisely matches the prop,
      // or has an '=' sign after the prop, followed by the given
      // value.
      l.length > e.length && (l.charCodeAt(e.length) != 61 || l.slice(e.length + 1) != n))) {
        if (o.getAttrs) {
          let a = o.getAttrs(n);
          if (a === !1)
            continue;
          o.attrs = a || void 0;
        }
        return o;
      }
    }
  }
  /**
  @internal
  */
  static schemaRules(e) {
    let n = [];
    function r(i) {
      let s = i.priority == null ? 50 : i.priority, o = 0;
      for (; o < n.length; o++) {
        let l = n[o];
        if ((l.priority == null ? 50 : l.priority) < s)
          break;
      }
      n.splice(o, 0, i);
    }
    for (let i in e.marks) {
      let s = e.marks[i].spec.parseDOM;
      s && s.forEach((o) => {
        r(o = Xu(o)), o.mark || o.ignore || o.clearMark || (o.mark = i);
      });
    }
    for (let i in e.nodes) {
      let s = e.nodes[i].spec.parseDOM;
      s && s.forEach((o) => {
        r(o = Xu(o)), o.node || o.ignore || o.mark || (o.node = i);
      });
    }
    return n;
  }
  /**
  Construct a DOM parser using the parsing rules listed in a
  schema's [node specs](https://prosemirror.net/docs/ref/#model.NodeSpec.parseDOM), reordered by
  [priority](https://prosemirror.net/docs/ref/#model.GenericParseRule.priority).
  */
  static fromSchema(e) {
    return e.cached.domParser || (e.cached.domParser = new ir(e, ir.schemaRules(e)));
  }
}
const Of = {
  address: !0,
  article: !0,
  aside: !0,
  blockquote: !0,
  body: !0,
  canvas: !0,
  dd: !0,
  div: !0,
  dl: !0,
  fieldset: !0,
  figcaption: !0,
  figure: !0,
  footer: !0,
  form: !0,
  h1: !0,
  h2: !0,
  h3: !0,
  h4: !0,
  h5: !0,
  h6: !0,
  header: !0,
  hgroup: !0,
  hr: !0,
  li: !0,
  noscript: !0,
  ol: !0,
  output: !0,
  p: !0,
  pre: !0,
  section: !0,
  table: !0,
  tfoot: !0,
  ul: !0
}, H0 = {
  head: !0,
  noscript: !0,
  object: !0,
  script: !0,
  style: !0,
  title: !0
}, Df = { ol: !0, ul: !0 }, Kr = 1, Jo = 2, Rr = 4;
function Zu(t, e, n) {
  return e != null ? (e ? Kr : 0) | (e === "full" ? Jo : 0) : t && t.whitespace == "pre" ? Kr | Jo : n & ~Rr;
}
class vi {
  constructor(e, n, r, i, s, o) {
    this.type = e, this.attrs = n, this.marks = r, this.solid = i, this.options = o, this.content = [], this.activeMarks = be.none, this.match = s || (o & Rr ? null : e.contentMatch);
  }
  findWrapping(e) {
    if (!this.match) {
      if (!this.type)
        return [];
      let n = this.type.contentMatch.fillBefore(K.from(e));
      if (n)
        this.match = this.type.contentMatch.matchFragment(n);
      else {
        let r = this.type.contentMatch, i;
        return (i = r.findWrapping(e.type)) ? (this.match = r, i) : null;
      }
    }
    return this.match.findWrapping(e.type);
  }
  finish(e) {
    if (!(this.options & Kr)) {
      let r = this.content[this.content.length - 1], i;
      if (r && r.isText && (i = /[ \t\r\n\u000c]+$/.exec(r.text))) {
        let s = r;
        r.text.length == i[0].length ? this.content.pop() : this.content[this.content.length - 1] = s.withText(s.text.slice(0, s.text.length - i[0].length));
      }
    }
    let n = K.from(this.content);
    return !e && this.match && (n = n.append(this.match.fillBefore(K.empty, !0))), this.type ? this.type.create(this.attrs, n, this.marks) : n;
  }
  inlineContext(e) {
    return this.type ? this.type.inlineContent : this.content.length ? this.content[0].isInline : e.parentNode && !Of.hasOwnProperty(e.parentNode.nodeName.toLowerCase());
  }
}
class Yu {
  constructor(e, n, r) {
    this.parser = e, this.options = n, this.isOpen = r, this.open = 0, this.localPreserveWS = !1;
    let i = n.topNode, s, o = Zu(null, n.preserveWhitespace, 0) | (r ? Rr : 0);
    i ? s = new vi(i.type, i.attrs, be.none, !0, n.topMatch || i.type.contentMatch, o) : r ? s = new vi(null, null, be.none, !0, null, o) : s = new vi(e.schema.topNodeType, null, be.none, !0, null, o), this.nodes = [s], this.find = n.findPositions, this.needsBlock = !1;
  }
  get top() {
    return this.nodes[this.open];
  }
  // Add a DOM node to the content. Text is inserted as text node,
  // otherwise, the node is passed to `addElement` or, if it has a
  // `style` attribute, `addElementWithStyles`.
  addDOM(e, n) {
    e.nodeType == 3 ? this.addTextNode(e, n) : e.nodeType == 1 && this.addElement(e, n);
  }
  addTextNode(e, n) {
    let r = e.nodeValue, i = this.top, s = i.options & Jo ? "full" : this.localPreserveWS || (i.options & Kr) > 0, { schema: o } = this.parser;
    if (s === "full" || i.inlineContext(e) || /[^ \t\r\n\u000c]/.test(r)) {
      if (s)
        if (s === "full")
          r = r.replace(/\r\n?/g, `
`);
        else if (o.linebreakReplacement && /[\r\n]/.test(r) && this.top.findWrapping(o.linebreakReplacement.create())) {
          let l = r.split(/\r?\n|\r/);
          for (let a = 0; a < l.length; a++)
            a && this.insertNode(o.linebreakReplacement.create(), n, !0), l[a] && this.insertNode(o.text(l[a]), n, !/\S/.test(l[a]));
          r = "";
        } else
          r = r.replace(/\r?\n|\r/g, " ");
      else if (r = r.replace(/[ \t\r\n\u000c]+/g, " "), /^[ \t\r\n\u000c]/.test(r) && this.open == this.nodes.length - 1) {
        let l = i.content[i.content.length - 1], a = e.previousSibling;
        (!l || a && a.nodeName == "BR" || l.isText && /[ \t\r\n\u000c]$/.test(l.text)) && (r = r.slice(1));
      }
      r && this.insertNode(o.text(r), n, !/\S/.test(r)), this.findInText(e);
    } else
      this.findInside(e);
  }
  // Try to find a handler for the given tag and use that to parse. If
  // none is found, the element's content nodes are added directly.
  addElement(e, n, r) {
    let i = this.localPreserveWS, s = this.top;
    (e.tagName == "PRE" || /pre/.test(e.style && e.style.whiteSpace)) && (this.localPreserveWS = !0);
    let o = e.nodeName.toLowerCase(), l;
    Df.hasOwnProperty(o) && this.parser.normalizeLists && U0(e);
    let a = this.options.ruleFromNode && this.options.ruleFromNode(e) || (l = this.parser.matchTag(e, this, r));
    e: if (a ? a.ignore : H0.hasOwnProperty(o))
      this.findInside(e), this.ignoreFallback(e, n);
    else if (!a || a.skip || a.closeParent) {
      a && a.closeParent ? this.open = Math.max(0, this.open - 1) : a && a.skip.nodeType && (e = a.skip);
      let u, c = this.needsBlock;
      if (Of.hasOwnProperty(o))
        s.content.length && s.content[0].isInline && this.open && (this.open--, s = this.top), u = !0, s.type || (this.needsBlock = !0);
      else if (!e.firstChild) {
        this.leafFallback(e, n);
        break e;
      }
      let h = a && a.skip ? n : this.readStyles(e, n);
      h && this.addAll(e, h), u && this.sync(s), this.needsBlock = c;
    } else {
      let u = this.readStyles(e, n);
      u && this.addElementByRule(e, a, u, a.consuming === !1 ? l : void 0);
    }
    this.localPreserveWS = i;
  }
  // Called for leaf DOM nodes that would otherwise be ignored
  leafFallback(e, n) {
    e.nodeName == "BR" && this.top.type && this.top.type.inlineContent && this.addTextNode(e.ownerDocument.createTextNode(`
`), n);
  }
  // Called for ignored nodes
  ignoreFallback(e, n) {
    e.nodeName == "BR" && (!this.top.type || !this.top.type.inlineContent) && this.findPlace(this.parser.schema.text("-"), n, !0);
  }
  // Run any style parser associated with the node's styles. Either
  // return an updated array of marks, or null to indicate some of the
  // styles had a rule with `ignore` set.
  readStyles(e, n) {
    let r = e.style;
    if (r && r.length)
      for (let i = 0; i < this.parser.matchedStyles.length; i++) {
        let s = this.parser.matchedStyles[i], o = r.getPropertyValue(s);
        if (o)
          for (let l = void 0; ; ) {
            let a = this.parser.matchStyle(s, o, this, l);
            if (!a)
              break;
            if (a.ignore)
              return null;
            if (a.clearMark ? n = n.filter((u) => !a.clearMark(u)) : n = n.concat(this.parser.schema.marks[a.mark].create(a.attrs)), a.consuming === !1)
              l = a;
            else
              break;
          }
      }
    return n;
  }
  // Look up a handler for the given node. If none are found, return
  // false. Otherwise, apply it, use its return value to drive the way
  // the node's content is wrapped, and return true.
  addElementByRule(e, n, r, i) {
    let s, o;
    if (n.node)
      if (o = this.parser.schema.nodes[n.node], o.isLeaf)
        this.insertNode(o.create(n.attrs), r, e.nodeName == "BR") || this.leafFallback(e, r);
      else {
        let a = this.enter(o, n.attrs || null, r, n.preserveWhitespace);
        a && (s = !0, r = a);
      }
    else {
      let a = this.parser.schema.marks[n.mark];
      r = r.concat(a.create(n.attrs));
    }
    let l = this.top;
    if (o && o.isLeaf)
      this.findInside(e);
    else if (i)
      this.addElement(e, r, i);
    else if (n.getContent)
      this.findInside(e), n.getContent(e, this.parser.schema).forEach((a) => this.insertNode(a, r, !1));
    else {
      let a = e;
      typeof n.contentElement == "string" ? a = e.querySelector(n.contentElement) : typeof n.contentElement == "function" ? a = n.contentElement(e) : n.contentElement && (a = n.contentElement), this.findAround(e, a, !0), this.addAll(a, r), this.findAround(e, a, !1);
    }
    s && this.sync(l) && this.open--;
  }
  // Add all child nodes between `startIndex` and `endIndex` (or the
  // whole node, if not given). If `sync` is passed, use it to
  // synchronize after every block element.
  addAll(e, n, r, i) {
    let s = r || 0;
    for (let o = r ? e.childNodes[r] : e.firstChild, l = i == null ? null : e.childNodes[i]; o != l; o = o.nextSibling, ++s)
      this.findAtPoint(e, s), this.addDOM(o, n);
    this.findAtPoint(e, s);
  }
  // Try to find a way to fit the given node type into the current
  // context. May add intermediate wrappers and/or leave non-solid
  // nodes that we're in.
  findPlace(e, n, r) {
    let i, s;
    for (let o = this.open, l = 0; o >= 0; o--) {
      let a = this.nodes[o], u = a.findWrapping(e);
      if (u && (!i || i.length > u.length + l) && (i = u, s = a, !u.length))
        break;
      if (a.solid) {
        if (r)
          break;
        l += 2;
      }
    }
    if (!i)
      return null;
    this.sync(s);
    for (let o = 0; o < i.length; o++)
      n = this.enterInner(i[o], null, n, !1);
    return n;
  }
  // Try to insert the given node, adjusting the context when needed.
  insertNode(e, n, r) {
    if (e.isInline && this.needsBlock && !this.top.type) {
      let s = this.textblockFromContext();
      s && (n = this.enterInner(s, null, n));
    }
    let i = this.findPlace(e, n, r);
    if (i) {
      this.closeExtra();
      let s = this.top;
      s.match && (s.match = s.match.matchType(e.type));
      let o = be.none;
      for (let l of i.concat(e.marks))
        (s.type ? s.type.allowsMarkType(l.type) : Qu(l.type, e.type)) && (o = l.addToSet(o));
      return s.content.push(e.mark(o)), !0;
    }
    return !1;
  }
  // Try to start a node of the given type, adjusting the context when
  // necessary.
  enter(e, n, r, i) {
    let s = this.findPlace(e.create(n), r, !1);
    return s && (s = this.enterInner(e, n, r, !0, i)), s;
  }
  // Open a node of the given type
  enterInner(e, n, r, i = !1, s) {
    this.closeExtra();
    let o = this.top;
    o.match = o.match && o.match.matchType(e);
    let l = Zu(e, s, o.options);
    o.options & Rr && o.content.length == 0 && (l |= Rr);
    let a = be.none;
    return r = r.filter((u) => (o.type ? o.type.allowsMarkType(u.type) : Qu(u.type, e)) ? (a = u.addToSet(a), !1) : !0), this.nodes.push(new vi(e, n, a, i, null, l)), this.open++, r;
  }
  // Make sure all nodes above this.open are finished and added to
  // their parents
  closeExtra(e = !1) {
    let n = this.nodes.length - 1;
    if (n > this.open) {
      for (; n > this.open; n--)
        this.nodes[n - 1].content.push(this.nodes[n].finish(e));
      this.nodes.length = this.open + 1;
    }
  }
  finish() {
    return this.open = 0, this.closeExtra(this.isOpen), this.nodes[0].finish(!!(this.isOpen || this.options.topOpen));
  }
  sync(e) {
    for (let n = this.open; n >= 0; n--) {
      if (this.nodes[n] == e)
        return this.open = n, !0;
      this.localPreserveWS && (this.nodes[n].options |= Kr);
    }
    return !1;
  }
  get currentPos() {
    this.closeExtra();
    let e = 0;
    for (let n = this.open; n >= 0; n--) {
      let r = this.nodes[n].content;
      for (let i = r.length - 1; i >= 0; i--)
        e += r[i].nodeSize;
      n && e++;
    }
    return e;
  }
  findAtPoint(e, n) {
    if (this.find)
      for (let r = 0; r < this.find.length; r++)
        this.find[r].node == e && this.find[r].offset == n && (this.find[r].pos = this.currentPos);
  }
  findInside(e) {
    if (this.find)
      for (let n = 0; n < this.find.length; n++)
        this.find[n].pos == null && e.nodeType == 1 && e.contains(this.find[n].node) && (this.find[n].pos = this.currentPos);
  }
  findAround(e, n, r) {
    if (e != n && this.find)
      for (let i = 0; i < this.find.length; i++)
        this.find[i].pos == null && e.nodeType == 1 && e.contains(this.find[i].node) && n.compareDocumentPosition(this.find[i].node) & (r ? 2 : 4) && (this.find[i].pos = this.currentPos);
  }
  findInText(e) {
    if (this.find)
      for (let n = 0; n < this.find.length; n++)
        this.find[n].node == e && (this.find[n].pos = this.currentPos - (e.nodeValue.length - this.find[n].offset));
  }
  // Determines whether the given context string matches this context.
  matchesContext(e) {
    if (e.indexOf("|") > -1)
      return e.split(/\s*\|\s*/).some(this.matchesContext, this);
    let n = e.split("/"), r = this.options.context, i = !this.isOpen && (!r || r.parent.type == this.nodes[0].type), s = -(r ? r.depth + 1 : 0) + (i ? 0 : 1), o = (l, a) => {
      for (; l >= 0; l--) {
        let u = n[l];
        if (u == "") {
          if (l == n.length - 1 || l == 0)
            continue;
          for (; a >= s; a--)
            if (o(l - 1, a))
              return !0;
          return !1;
        } else {
          let c = a > 0 || a == 0 && i ? this.nodes[a].type : r && a >= s ? r.node(a - s).type : null;
          if (!c || c.name != u && !c.isInGroup(u))
            return !1;
          a--;
        }
      }
      return !0;
    };
    return o(n.length - 1, this.open);
  }
  textblockFromContext() {
    let e = this.options.context;
    if (e)
      for (let n = e.depth; n >= 0; n--) {
        let r = e.node(n).contentMatchAt(e.indexAfter(n)).defaultType;
        if (r && r.isTextblock && r.defaultAttrs)
          return r;
      }
    for (let n in this.parser.schema.nodes) {
      let r = this.parser.schema.nodes[n];
      if (r.isTextblock && r.defaultAttrs)
        return r;
    }
  }
}
function U0(t) {
  for (let e = t.firstChild, n = null; e; e = e.nextSibling) {
    let r = e.nodeType == 1 ? e.nodeName.toLowerCase() : null;
    r && Df.hasOwnProperty(r) && n ? (n.appendChild(e), e = n) : r == "li" ? n = e : r && (n = null);
  }
}
function q0(t, e) {
  return (t.matches || t.msMatchesSelector || t.webkitMatchesSelector || t.mozMatchesSelector).call(t, e);
}
function Xu(t) {
  let e = {};
  for (let n in t)
    e[n] = t[n];
  return e;
}
function Qu(t, e) {
  let n = e.schema.nodes;
  for (let r in n) {
    let i = n[r];
    if (!i.allowsMarkType(t))
      continue;
    let s = [], o = (l) => {
      s.push(l);
      for (let a = 0; a < l.edgeCount; a++) {
        let { type: u, next: c } = l.edge(a);
        if (u == e || s.indexOf(c) < 0 && o(c))
          return !0;
      }
    };
    if (o(i.contentMatch))
      return !0;
  }
}
class fr {
  /**
  Create a serializer. `nodes` should map node names to functions
  that take a node and return a description of the corresponding
  DOM. `marks` does the same for mark names, but also gets an
  argument that tells it whether the mark's content is block or
  inline content (for typical use, it'll always be inline). A mark
  serializer may be `null` to indicate that marks of that type
  should not be serialized.
  */
  constructor(e, n) {
    this.nodes = e, this.marks = n;
  }
  /**
  Serialize the content of this fragment to a DOM fragment. When
  not in the browser, the `document` option, containing a DOM
  document, should be passed so that the serializer can create
  nodes.
  */
  serializeFragment(e, n = {}, r) {
    r || (r = Ni(n).createDocumentFragment());
    let i = r, s = [];
    return e.forEach((o) => {
      if (s.length || o.marks.length) {
        let l = 0, a = 0;
        for (; l < s.length && a < o.marks.length; ) {
          let u = o.marks[a];
          if (!this.marks[u.type.name]) {
            a++;
            continue;
          }
          if (!u.eq(s[l][0]) || u.type.spec.spanning === !1)
            break;
          l++, a++;
        }
        for (; l < s.length; )
          i = s.pop()[1];
        for (; a < o.marks.length; ) {
          let u = o.marks[a++], c = this.serializeMark(u, o.isInline, n);
          c && (s.push([u, i]), i.appendChild(c.dom), i = c.contentDOM || c.dom);
        }
      }
      i.appendChild(this.serializeNodeInner(o, n));
    }), r;
  }
  /**
  @internal
  */
  serializeNodeInner(e, n) {
    if (e.isText)
      return Ni(n).createTextNode(e.text);
    let { dom: r, contentDOM: i } = Ri(Ni(n), this.nodes[e.type.name](e), null, e.attrs);
    if (i) {
      if (e.isLeaf)
        throw new RangeError("Content hole not allowed in a leaf node spec");
      this.serializeFragment(e.content, n, i);
    }
    return r;
  }
  /**
  Serialize this node to a DOM node. This can be useful when you
  need to serialize a part of a document, as opposed to the whole
  document. To serialize a whole document, use
  [`serializeFragment`](https://prosemirror.net/docs/ref/#model.DOMSerializer.serializeFragment) on
  its [content](https://prosemirror.net/docs/ref/#model.Node.content).
  */
  serializeNode(e, n = {}) {
    let r = this.serializeNodeInner(e, n);
    for (let i = e.marks.length - 1; i >= 0; i--) {
      let s = this.serializeMark(e.marks[i], e.isInline, n);
      s && ((s.contentDOM || s.dom).appendChild(r), r = s.dom);
    }
    return r;
  }
  /**
  @internal
  */
  serializeMark(e, n, r = {}) {
    let i = this.marks[e.type.name];
    return i && Ri(Ni(r), i(e, n), null, e.attrs);
  }
  static renderSpec(e, n, r = null, i) {
    return typeof n == "string" ? { dom: e.createTextNode(n) } : Ri(e, n, r, i);
  }
  /**
  Build a serializer using the [`toDOM`](https://prosemirror.net/docs/ref/#model.NodeSpec.toDOM)
  properties in a schema's node and mark specs.
  */
  static fromSchema(e) {
    return e.cached.domSerializer || (e.cached.domSerializer = new fr(this.nodesFromSchema(e), this.marksFromSchema(e)));
  }
  /**
  Gather the serializers in a schema's node specs into an object.
  This can be useful as a base to build a custom serializer from.
  */
  static nodesFromSchema(e) {
    let n = ec(e.nodes);
    return n.text || (n.text = (r) => r.text), n;
  }
  /**
  Gather the serializers in a schema's mark specs into an object.
  */
  static marksFromSchema(e) {
    return ec(e.marks);
  }
}
function ec(t) {
  let e = {};
  for (let n in t) {
    let r = t[n].spec.toDOM;
    r && (e[n] = r);
  }
  return e;
}
function Ni(t) {
  return t.document || window.document;
}
const tc = /* @__PURE__ */ new WeakMap();
function K0(t) {
  let e = tc.get(t);
  return e === void 0 && tc.set(t, e = J0(t)), e;
}
function J0(t) {
  let e = null;
  function n(r) {
    if (r && typeof r == "object")
      if (Array.isArray(r))
        if (typeof r[0] == "string")
          e || (e = []), e.push(r);
        else
          for (let i = 0; i < r.length; i++)
            n(r[i]);
      else
        for (let i in r)
          n(r[i]);
  }
  return n(t), e;
}
function Ri(t, e, n, r) {
  if (e.nodeType == 1)
    return { dom: e };
  if (e.dom && e.dom.nodeType == 1)
    return e;
  let i = e[0], s;
  if (typeof i != "string")
    throw new RangeError("Invalid array passed to renderSpec");
  if (r && (s = K0(r)) && s.indexOf(e) > -1)
    throw new RangeError("Using an array from an attribute object as a DOM spec. This may be an attempted cross site scripting attack.");
  let o = i.indexOf(" ");
  o > 0 && (n = i.slice(0, o), i = i.slice(o + 1));
  let l, a = n ? t.createElementNS(n, i) : t.createElement(i), u = e[1], c = 1;
  if (u && typeof u == "object" && u.nodeType == null && !Array.isArray(u)) {
    c = 2;
    for (let h in u)
      if (u[h] != null) {
        let d = h.indexOf(" ");
        d > 0 ? a.setAttributeNS(h.slice(0, d), h.slice(d + 1), u[h]) : h == "style" && a.style ? a.style.cssText = u[h] : a.setAttribute(h, u[h]);
      }
  }
  for (let h = c; h < e.length; h++) {
    let d = e[h];
    if (d === 0) {
      if (h < e.length - 1 || h > c)
        throw new RangeError("Content hole must be the only child of its parent node");
      return { dom: a, contentDOM: a };
    } else if (typeof d == "string")
      a.appendChild(t.createTextNode(d));
    else {
      let { dom: f, contentDOM: p } = Ri(t, d, n, r);
      if (a.appendChild(f), p) {
        if (l)
          throw new RangeError("Multiple content holes");
        l = p;
      }
    }
  }
  return { dom: a, contentDOM: l };
}
const Rf = 65535, zf = Math.pow(2, 16);
function G0(t, e) {
  return t + e * zf;
}
function nc(t) {
  return t & Rf;
}
function Z0(t) {
  return (t - (t & Rf)) / zf;
}
const Pf = 1, Lf = 2, zi = 4, Bf = 8;
class Go {
  /**
  @internal
  */
  constructor(e, n, r) {
    this.pos = e, this.delInfo = n, this.recover = r;
  }
  /**
  Tells you whether the position was deleted, that is, whether the
  step removed the token on the side queried (via the `assoc`)
  argument from the document.
  */
  get deleted() {
    return (this.delInfo & Bf) > 0;
  }
  /**
  Tells you whether the token before the mapped position was deleted.
  */
  get deletedBefore() {
    return (this.delInfo & (Pf | zi)) > 0;
  }
  /**
  True when the token after the mapped position was deleted.
  */
  get deletedAfter() {
    return (this.delInfo & (Lf | zi)) > 0;
  }
  /**
  Tells whether any of the steps mapped through deletes across the
  position (including both the token before and after the
  position).
  */
  get deletedAcross() {
    return (this.delInfo & zi) > 0;
  }
}
class ct {
  /**
  Create a position map. The modifications to the document are
  represented as an array of numbers, in which each group of three
  represents a modified chunk as `[start, oldSize, newSize]`.
  */
  constructor(e, n = !1) {
    if (this.ranges = e, this.inverted = n, !e.length && ct.empty)
      return ct.empty;
  }
  /**
  @internal
  */
  recover(e) {
    let n = 0, r = nc(e);
    if (!this.inverted)
      for (let i = 0; i < r; i++)
        n += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1];
    return this.ranges[r * 3] + n + Z0(e);
  }
  mapResult(e, n = 1) {
    return this._map(e, n, !1);
  }
  map(e, n = 1) {
    return this._map(e, n, !0);
  }
  /**
  @internal
  */
  _map(e, n, r) {
    let i = 0, s = this.inverted ? 2 : 1, o = this.inverted ? 1 : 2;
    for (let l = 0; l < this.ranges.length; l += 3) {
      let a = this.ranges[l] - (this.inverted ? i : 0);
      if (a > e)
        break;
      let u = this.ranges[l + s], c = this.ranges[l + o], h = a + u;
      if (e <= h) {
        let d = u ? e == a ? -1 : e == h ? 1 : n : n, f = a + i + (d < 0 ? 0 : c);
        if (r)
          return f;
        let p = e == (n < 0 ? a : h) ? null : G0(l / 3, e - a), m = 0;
        return u && (m |= e == a ? Lf : e == h ? Pf : zi, (n < 0 ? e != a : e != h) && (m |= Bf)), new Go(f, m, p);
      }
      i += c - u;
    }
    return r ? e + i : new Go(e + i, 0, null);
  }
  /**
  @internal
  */
  touches(e, n) {
    let r = 0, i = nc(n), s = this.inverted ? 2 : 1, o = this.inverted ? 1 : 2;
    for (let l = 0; l < this.ranges.length; l += 3) {
      let a = this.ranges[l] - (this.inverted ? r : 0);
      if (a > e)
        break;
      let u = this.ranges[l + s], c = a + u;
      if (e <= c && l == i * 3)
        return !0;
      r += this.ranges[l + o] - u;
    }
    return !1;
  }
  /**
  Calls the given function on each of the changed ranges included in
  this map.
  */
  forEach(e) {
    let n = this.inverted ? 2 : 1, r = this.inverted ? 1 : 2;
    for (let i = 0, s = 0; i < this.ranges.length; i += 3) {
      let o = this.ranges[i], l = o - (this.inverted ? s : 0), a = o + (this.inverted ? 0 : s), u = this.ranges[i + n], c = this.ranges[i + r];
      e(l, l + u, a, a + c), s += c - u;
    }
  }
  /**
  Create an inverted version of this map. The result can be used to
  map positions in the post-step document to the pre-step document.
  */
  invert() {
    return new ct(this.ranges, !this.inverted);
  }
  /**
  @internal
  */
  toString() {
    return (this.inverted ? "-" : "") + JSON.stringify(this.ranges);
  }
  /**
  Create a map that moves all positions by offset `n` (which may be
  negative). This can be useful when applying steps meant for a
  sub-document to a larger document, or vice-versa.
  */
  static offset(e) {
    return e == 0 ? ct.empty : new ct(e < 0 ? [0, -e, 0] : [0, 0, e]);
  }
}
ct.empty = new ct([]);
class rs {
  /**
  Create a new mapping with the given position maps.
  */
  constructor(e, n, r = 0, i = e ? e.length : 0) {
    this.mirror = n, this.from = r, this.to = i, this._maps = e || [], this.ownData = !(e || n);
  }
  /**
  The step maps in this mapping.
  */
  get maps() {
    return this._maps;
  }
  /**
  Create a mapping that maps only through a part of this one.
  */
  slice(e = 0, n = this.maps.length) {
    return new rs(this._maps, this.mirror, e, n);
  }
  /**
  Add a step map to the end of this mapping. If `mirrors` is
  given, it should be the index of the step map that is the mirror
  image of this one.
  */
  appendMap(e, n) {
    this.ownData || (this._maps = this._maps.slice(), this.mirror = this.mirror && this.mirror.slice(), this.ownData = !0), this.to = this._maps.push(e), n != null && this.setMirror(this._maps.length - 1, n);
  }
  /**
  Add all the step maps in a given mapping to this one (preserving
  mirroring information).
  */
  appendMapping(e) {
    for (let n = 0, r = this._maps.length; n < e._maps.length; n++) {
      let i = e.getMirror(n);
      this.appendMap(e._maps[n], i != null && i < n ? r + i : void 0);
    }
  }
  /**
  Finds the offset of the step map that mirrors the map at the
  given offset, in this mapping (as per the second argument to
  `appendMap`).
  */
  getMirror(e) {
    if (this.mirror) {
      for (let n = 0; n < this.mirror.length; n++)
        if (this.mirror[n] == e)
          return this.mirror[n + (n % 2 ? -1 : 1)];
    }
  }
  /**
  @internal
  */
  setMirror(e, n) {
    this.mirror || (this.mirror = []), this.mirror.push(e, n);
  }
  /**
  Append the inverse of the given mapping to this one.
  */
  appendMappingInverted(e) {
    for (let n = e.maps.length - 1, r = this._maps.length + e._maps.length; n >= 0; n--) {
      let i = e.getMirror(n);
      this.appendMap(e._maps[n].invert(), i != null && i > n ? r - i - 1 : void 0);
    }
  }
  /**
  Create an inverted version of this mapping.
  */
  invert() {
    let e = new rs();
    return e.appendMappingInverted(this), e;
  }
  /**
  Map a position through this mapping.
  */
  map(e, n = 1) {
    if (this.mirror)
      return this._map(e, n, !0);
    for (let r = this.from; r < this.to; r++)
      e = this._maps[r].map(e, n);
    return e;
  }
  /**
  Map a position through this mapping, returning a mapping
  result.
  */
  mapResult(e, n = 1) {
    return this._map(e, n, !1);
  }
  /**
  @internal
  */
  _map(e, n, r) {
    let i = 0;
    for (let s = this.from; s < this.to; s++) {
      let o = this._maps[s], l = o.mapResult(e, n);
      if (l.recover != null) {
        let a = this.getMirror(s);
        if (a != null && a > s && a < this.to) {
          s = a, e = this._maps[a].recover(l.recover);
          continue;
        }
      }
      i |= l.delInfo, e = l.pos;
    }
    return r ? e : new Go(e, i, null);
  }
}
const Gs = /* @__PURE__ */ Object.create(null);
class Ze {
  /**
  Get the step map that represents the changes made by this step,
  and which can be used to transform between positions in the old
  and the new document.
  */
  getMap() {
    return ct.empty;
  }
  /**
  Try to merge this step with another one, to be applied directly
  after it. Returns the merged step when possible, null if the
  steps can't be merged.
  */
  merge(e) {
    return null;
  }
  /**
  Deserialize a step from its JSON representation. Will call
  through to the step class' own implementation of this method.
  */
  static fromJSON(e, n) {
    if (!n || !n.stepType)
      throw new RangeError("Invalid input for Step.fromJSON");
    let r = Gs[n.stepType];
    if (!r)
      throw new RangeError(`No step type ${n.stepType} defined`);
    return r.fromJSON(e, n);
  }
  /**
  To be able to serialize steps to JSON, each step needs a string
  ID to attach to its JSON representation. Use this method to
  register an ID for your step classes. Try to pick something
  that's unlikely to clash with steps from other modules.
  */
  static jsonID(e, n) {
    if (e in Gs)
      throw new RangeError("Duplicate use of step JSON ID " + e);
    return Gs[e] = n, n.prototype.jsonID = e, n;
  }
}
class Pe {
  /**
  @internal
  */
  constructor(e, n) {
    this.doc = e, this.failed = n;
  }
  /**
  Create a successful step result.
  */
  static ok(e) {
    return new Pe(e, null);
  }
  /**
  Create a failed step result.
  */
  static fail(e) {
    return new Pe(null, e);
  }
  /**
  Call [`Node.replace`](https://prosemirror.net/docs/ref/#model.Node.replace) with the given
  arguments. Create a successful result if it succeeds, and a
  failed one if it throws a `ReplaceError`.
  */
  static fromReplace(e, n, r, i) {
    try {
      return Pe.ok(e.replace(n, r, i));
    } catch (s) {
      if (s instanceof Ur)
        return Pe.fail(s.message);
      throw s;
    }
  }
}
function Bl(t, e, n) {
  let r = [];
  for (let i = 0; i < t.childCount; i++) {
    let s = t.child(i);
    s.content.size && (s = s.copy(Bl(s.content, e, s))), s.isInline && (s = e(s, n, i)), r.push(s);
  }
  return K.fromArray(r);
}
class Kt extends Ze {
  /**
  Create a mark step.
  */
  constructor(e, n, r) {
    super(), this.from = e, this.to = n, this.mark = r;
  }
  apply(e) {
    let n = e.slice(this.from, this.to), r = e.resolve(this.from), i = r.node(r.sharedDepth(this.to)), s = new ne(Bl(n.content, (o, l) => !o.isAtom || !l.type.allowsMarkType(this.mark.type) ? o : o.mark(this.mark.addToSet(o.marks)), i), n.openStart, n.openEnd);
    return Pe.fromReplace(e, this.from, this.to, s);
  }
  invert() {
    return new Rt(this.from, this.to, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.from, 1), r = e.mapResult(this.to, -1);
    return n.deleted && r.deleted || n.pos >= r.pos ? null : new Kt(n.pos, r.pos, this.mark);
  }
  merge(e) {
    return e instanceof Kt && e.mark.eq(this.mark) && this.from <= e.to && this.to >= e.from ? new Kt(Math.min(this.from, e.from), Math.max(this.to, e.to), this.mark) : null;
  }
  toJSON() {
    return {
      stepType: "addMark",
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to
    };
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.from != "number" || typeof n.to != "number")
      throw new RangeError("Invalid input for AddMarkStep.fromJSON");
    return new Kt(n.from, n.to, e.markFromJSON(n.mark));
  }
}
Ze.jsonID("addMark", Kt);
class Rt extends Ze {
  /**
  Create a mark-removing step.
  */
  constructor(e, n, r) {
    super(), this.from = e, this.to = n, this.mark = r;
  }
  apply(e) {
    let n = e.slice(this.from, this.to), r = new ne(Bl(n.content, (i) => i.mark(this.mark.removeFromSet(i.marks)), e), n.openStart, n.openEnd);
    return Pe.fromReplace(e, this.from, this.to, r);
  }
  invert() {
    return new Kt(this.from, this.to, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.from, 1), r = e.mapResult(this.to, -1);
    return n.deleted && r.deleted || n.pos >= r.pos ? null : new Rt(n.pos, r.pos, this.mark);
  }
  merge(e) {
    return e instanceof Rt && e.mark.eq(this.mark) && this.from <= e.to && this.to >= e.from ? new Rt(Math.min(this.from, e.from), Math.max(this.to, e.to), this.mark) : null;
  }
  toJSON() {
    return {
      stepType: "removeMark",
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to
    };
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.from != "number" || typeof n.to != "number")
      throw new RangeError("Invalid input for RemoveMarkStep.fromJSON");
    return new Rt(n.from, n.to, e.markFromJSON(n.mark));
  }
}
Ze.jsonID("removeMark", Rt);
class hn extends Ze {
  /**
  Create a node mark step.
  */
  constructor(e, n) {
    super(), this.pos = e, this.mark = n;
  }
  apply(e) {
    let n = e.nodeAt(this.pos);
    if (!n)
      return Pe.fail("No node at mark step's position");
    let r = n.type.create(n.attrs, null, this.mark.addToSet(n.marks));
    return Pe.fromReplace(e, this.pos, this.pos + 1, new ne(K.from(r), 0, n.isLeaf ? 0 : 1));
  }
  invert(e) {
    let n = e.nodeAt(this.pos);
    if (n) {
      let r = this.mark.addToSet(n.marks);
      if (r.length == n.marks.length) {
        for (let i = 0; i < n.marks.length; i++)
          if (!n.marks[i].isInSet(r))
            return new hn(this.pos, n.marks[i]);
        return new hn(this.pos, this.mark);
      }
    }
    return new Vn(this.pos, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.pos, 1);
    return n.deletedAfter ? null : new hn(n.pos, this.mark);
  }
  toJSON() {
    return { stepType: "addNodeMark", pos: this.pos, mark: this.mark.toJSON() };
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.pos != "number")
      throw new RangeError("Invalid input for AddNodeMarkStep.fromJSON");
    return new hn(n.pos, e.markFromJSON(n.mark));
  }
}
Ze.jsonID("addNodeMark", hn);
class Vn extends Ze {
  /**
  Create a mark-removing step.
  */
  constructor(e, n) {
    super(), this.pos = e, this.mark = n;
  }
  apply(e) {
    let n = e.nodeAt(this.pos);
    if (!n)
      return Pe.fail("No node at mark step's position");
    let r = n.type.create(n.attrs, null, this.mark.removeFromSet(n.marks));
    return Pe.fromReplace(e, this.pos, this.pos + 1, new ne(K.from(r), 0, n.isLeaf ? 0 : 1));
  }
  invert(e) {
    let n = e.nodeAt(this.pos);
    return !n || !this.mark.isInSet(n.marks) ? this : new hn(this.pos, this.mark);
  }
  map(e) {
    let n = e.mapResult(this.pos, 1);
    return n.deletedAfter ? null : new Vn(n.pos, this.mark);
  }
  toJSON() {
    return { stepType: "removeNodeMark", pos: this.pos, mark: this.mark.toJSON() };
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.pos != "number")
      throw new RangeError("Invalid input for RemoveNodeMarkStep.fromJSON");
    return new Vn(n.pos, e.markFromJSON(n.mark));
  }
}
Ze.jsonID("removeNodeMark", Vn);
class ze extends Ze {
  /**
  The given `slice` should fit the 'gap' between `from` and
  `to`—the depths must line up, and the surrounding nodes must be
  able to be joined with the open sides of the slice. When
  `structure` is true, the step will fail if the content between
  from and to is not just a sequence of closing and then opening
  tokens (this is to guard against rebased replace steps
  overwriting something they weren't supposed to).
  */
  constructor(e, n, r, i = !1) {
    super(), this.from = e, this.to = n, this.slice = r, this.structure = i;
  }
  apply(e) {
    return this.structure && Zo(e, this.from, this.to) ? Pe.fail("Structure replace would overwrite content") : Pe.fromReplace(e, this.from, this.to, this.slice);
  }
  getMap() {
    return new ct([this.from, this.to - this.from, this.slice.size]);
  }
  invert(e) {
    return new ze(this.from, this.from + this.slice.size, e.slice(this.from, this.to));
  }
  map(e) {
    let n = e.mapResult(this.to, -1), r = this.from == this.to && ze.MAP_BIAS < 0 ? n : e.mapResult(this.from, 1);
    return r.deletedAcross && n.deletedAcross ? null : new ze(r.pos, Math.max(r.pos, n.pos), this.slice, this.structure);
  }
  merge(e) {
    if (!(e instanceof ze) || e.structure || this.structure)
      return null;
    if (this.from + this.slice.size == e.from && !this.slice.openEnd && !e.slice.openStart) {
      let n = this.slice.size + e.slice.size == 0 ? ne.empty : new ne(this.slice.content.append(e.slice.content), this.slice.openStart, e.slice.openEnd);
      return new ze(this.from, this.to + (e.to - e.from), n, this.structure);
    } else if (e.to == this.from && !this.slice.openStart && !e.slice.openEnd) {
      let n = this.slice.size + e.slice.size == 0 ? ne.empty : new ne(e.slice.content.append(this.slice.content), e.slice.openStart, this.slice.openEnd);
      return new ze(e.from, this.to, n, this.structure);
    } else
      return null;
  }
  toJSON() {
    let e = { stepType: "replace", from: this.from, to: this.to };
    return this.slice.size && (e.slice = this.slice.toJSON()), this.structure && (e.structure = !0), e;
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.from != "number" || typeof n.to != "number")
      throw new RangeError("Invalid input for ReplaceStep.fromJSON");
    return new ze(n.from, n.to, ne.fromJSON(e, n.slice), !!n.structure);
  }
}
ze.MAP_BIAS = 1;
Ze.jsonID("replace", ze);
class Je extends Ze {
  /**
  Create a replace-around step with the given range and gap.
  `insert` should be the point in the slice into which the content
  of the gap should be moved. `structure` has the same meaning as
  it has in the [`ReplaceStep`](https://prosemirror.net/docs/ref/#transform.ReplaceStep) class.
  */
  constructor(e, n, r, i, s, o, l = !1) {
    super(), this.from = e, this.to = n, this.gapFrom = r, this.gapTo = i, this.slice = s, this.insert = o, this.structure = l;
  }
  apply(e) {
    if (this.structure && (Zo(e, this.from, this.gapFrom) || Zo(e, this.gapTo, this.to)))
      return Pe.fail("Structure gap-replace would overwrite content");
    let n = e.slice(this.gapFrom, this.gapTo);
    if (n.openStart || n.openEnd)
      return Pe.fail("Gap is not a flat range");
    let r = this.slice.insertAt(this.insert, n.content);
    return r ? Pe.fromReplace(e, this.from, this.to, r) : Pe.fail("Content does not fit in gap");
  }
  getMap() {
    return new ct([
      this.from,
      this.gapFrom - this.from,
      this.insert,
      this.gapTo,
      this.to - this.gapTo,
      this.slice.size - this.insert
    ]);
  }
  invert(e) {
    let n = this.gapTo - this.gapFrom;
    return new Je(this.from, this.from + this.slice.size + n, this.from + this.insert, this.from + this.insert + n, e.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from), this.gapFrom - this.from, this.structure);
  }
  map(e) {
    let n = e.mapResult(this.from, 1), r = e.mapResult(this.to, -1), i = this.from == this.gapFrom ? n.pos : e.map(this.gapFrom, -1), s = this.to == this.gapTo ? r.pos : e.map(this.gapTo, 1);
    return n.deletedAcross && r.deletedAcross || i < n.pos || s > r.pos ? null : new Je(n.pos, r.pos, i, s, this.slice, this.insert, this.structure);
  }
  toJSON() {
    let e = {
      stepType: "replaceAround",
      from: this.from,
      to: this.to,
      gapFrom: this.gapFrom,
      gapTo: this.gapTo,
      insert: this.insert
    };
    return this.slice.size && (e.slice = this.slice.toJSON()), this.structure && (e.structure = !0), e;
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.from != "number" || typeof n.to != "number" || typeof n.gapFrom != "number" || typeof n.gapTo != "number" || typeof n.insert != "number")
      throw new RangeError("Invalid input for ReplaceAroundStep.fromJSON");
    return new Je(n.from, n.to, n.gapFrom, n.gapTo, ne.fromJSON(e, n.slice), n.insert, !!n.structure);
  }
}
Ze.jsonID("replaceAround", Je);
function Zo(t, e, n) {
  let r = t.resolve(e), i = n - e, s = r.depth;
  for (; i > 0 && s > 0 && r.indexAfter(s) == r.node(s).childCount; )
    s--, i--;
  if (i > 0) {
    let o = r.node(s).maybeChild(r.indexAfter(s));
    for (; i > 0; ) {
      if (!o || o.isLeaf)
        return !0;
      o = o.firstChild, i--;
    }
  }
  return !1;
}
function Y0(t, e, n, r) {
  let i = [], s = [], o, l;
  t.doc.nodesBetween(e, n, (a, u, c) => {
    if (!a.isInline)
      return;
    let h = a.marks;
    if (!r.isInSet(h) && c.type.allowsMarkType(r.type)) {
      let d = Math.max(u, e), f = Math.min(u + a.nodeSize, n), p = r.addToSet(h);
      for (let m = 0; m < h.length; m++)
        h[m].isInSet(p) || (o && o.to == d && o.mark.eq(h[m]) ? o.to = f : i.push(o = new Rt(d, f, h[m])));
      l && l.to == d ? l.to = f : s.push(l = new Kt(d, f, r));
    }
  }), i.forEach((a) => t.step(a)), s.forEach((a) => t.step(a));
}
function X0(t, e, n, r) {
  let i = [], s = 0;
  t.doc.nodesBetween(e, n, (o, l) => {
    if (!o.isInline)
      return;
    s++;
    let a = null;
    if (r instanceof Cs) {
      let u = o.marks, c;
      for (; c = r.isInSet(u); )
        (a || (a = [])).push(c), u = c.removeFromSet(u);
    } else r ? r.isInSet(o.marks) && (a = [r]) : a = o.marks;
    if (a && a.length) {
      let u = Math.min(l + o.nodeSize, n);
      for (let c = 0; c < a.length; c++) {
        let h = a[c], d;
        for (let f = 0; f < i.length; f++) {
          let p = i[f];
          p.step == s - 1 && h.eq(i[f].style) && (d = p);
        }
        d ? (d.to = u, d.step = s) : i.push({ style: h, from: Math.max(l, e), to: u, step: s });
      }
    }
  }), i.forEach((o) => t.step(new Rt(o.from, o.to, o.style)));
}
function Fl(t, e, n, r = n.contentMatch, i = !0) {
  let s = t.doc.nodeAt(e), o = [], l = e + 1;
  for (let a = 0; a < s.childCount; a++) {
    let u = s.child(a), c = l + u.nodeSize, h = r.matchType(u.type);
    if (!h)
      o.push(new ze(l, c, ne.empty));
    else {
      r = h;
      for (let d = 0; d < u.marks.length; d++)
        n.allowsMarkType(u.marks[d].type) || t.step(new Rt(l, c, u.marks[d]));
      if (i && u.isText && n.whitespace != "pre") {
        let d, f = /\r?\n|\r/g, p;
        for (; d = f.exec(u.text); )
          p || (p = new ne(K.from(n.schema.text(" ", n.allowedMarks(u.marks))), 0, 0)), o.push(new ze(l + d.index, l + d.index + d[0].length, p));
      }
    }
    l = c;
  }
  if (!r.validEnd) {
    let a = r.fillBefore(K.empty, !0);
    t.replace(l, l, new ne(a, 0, 0));
  }
  for (let a = o.length - 1; a >= 0; a--)
    t.step(o[a]);
}
function Q0(t, e, n) {
  return (e == 0 || t.canReplace(e, t.childCount)) && (n == t.childCount || t.canReplace(0, n));
}
function Ss(t) {
  let n = t.parent.content.cutByIndex(t.startIndex, t.endIndex);
  for (let r = t.depth, i = 0, s = 0; ; --r) {
    let o = t.$from.node(r), l = t.$from.index(r) + i, a = t.$to.indexAfter(r) - s;
    if (r < t.depth && o.canReplace(l, a, n))
      return r;
    if (r == 0 || o.type.spec.isolating || !Q0(o, l, a))
      break;
    l && (i = 1), a < o.childCount && (s = 1);
  }
  return null;
}
function e1(t, e, n) {
  let { $from: r, $to: i, depth: s } = e, o = r.before(s + 1), l = i.after(s + 1), a = o, u = l, c = K.empty, h = 0;
  for (let p = s, m = !1; p > n; p--)
    m || r.index(p) > 0 ? (m = !0, c = K.from(r.node(p).copy(c)), h++) : a--;
  let d = K.empty, f = 0;
  for (let p = s, m = !1; p > n; p--)
    m || i.after(p + 1) < i.end(p) ? (m = !0, d = K.from(i.node(p).copy(d)), f++) : u++;
  t.step(new Je(a, u, o, l, new ne(c.append(d), h, f), c.size - h, !0));
}
function $l(t, e, n = null, r = t) {
  let i = t1(t, e), s = i && n1(r, e);
  return s ? i.map(rc).concat({ type: e, attrs: n }).concat(s.map(rc)) : null;
}
function rc(t) {
  return { type: t, attrs: null };
}
function t1(t, e) {
  let { parent: n, startIndex: r, endIndex: i } = t, s = n.contentMatchAt(r).findWrapping(e);
  if (!s)
    return null;
  let o = s.length ? s[0] : e;
  return n.canReplaceWith(r, i, o) ? s : null;
}
function n1(t, e) {
  let { parent: n, startIndex: r, endIndex: i } = t, s = n.child(r), o = e.contentMatch.findWrapping(s.type);
  if (!o)
    return null;
  let a = (o.length ? o[o.length - 1] : e).contentMatch;
  for (let u = r; a && u < i; u++)
    a = a.matchType(n.child(u).type);
  return !a || !a.validEnd ? null : o;
}
function r1(t, e, n) {
  let r = K.empty;
  for (let o = n.length - 1; o >= 0; o--) {
    if (r.size) {
      let l = n[o].type.contentMatch.matchFragment(r);
      if (!l || !l.validEnd)
        throw new RangeError("Wrapper type given to Transform.wrap does not form valid content of its parent wrapper");
    }
    r = K.from(n[o].type.create(n[o].attrs, r));
  }
  let i = e.start, s = e.end;
  t.step(new Je(i, s, i, s, new ne(r, 0, 0), n.length, !0));
}
function i1(t, e, n, r, i) {
  if (!r.isTextblock)
    throw new RangeError("Type given to setBlockType should be a textblock");
  let s = t.steps.length;
  t.doc.nodesBetween(e, n, (o, l) => {
    let a = typeof i == "function" ? i(o) : i;
    if (o.isTextblock && !o.hasMarkup(r, a) && s1(t.doc, t.mapping.slice(s).map(l), r)) {
      let u = null;
      if (r.schema.linebreakReplacement) {
        let f = r.whitespace == "pre", p = !!r.contentMatch.matchType(r.schema.linebreakReplacement);
        f && !p ? u = !1 : !f && p && (u = !0);
      }
      u === !1 && $f(t, o, l, s), Fl(t, t.mapping.slice(s).map(l, 1), r, void 0, u === null);
      let c = t.mapping.slice(s), h = c.map(l, 1), d = c.map(l + o.nodeSize, 1);
      return t.step(new Je(h, d, h + 1, d - 1, new ne(K.from(r.create(a, null, o.marks)), 0, 0), 1, !0)), u === !0 && Ff(t, o, l, s), !1;
    }
  });
}
function Ff(t, e, n, r) {
  e.forEach((i, s) => {
    if (i.isText) {
      let o, l = /\r?\n|\r/g;
      for (; o = l.exec(i.text); ) {
        let a = t.mapping.slice(r).map(n + 1 + s + o.index);
        t.replaceWith(a, a + 1, e.type.schema.linebreakReplacement.create());
      }
    }
  });
}
function $f(t, e, n, r) {
  e.forEach((i, s) => {
    if (i.type == i.type.schema.linebreakReplacement) {
      let o = t.mapping.slice(r).map(n + 1 + s);
      t.replaceWith(o, o + 1, e.type.schema.text(`
`));
    }
  });
}
function s1(t, e, n) {
  let r = t.resolve(e), i = r.index();
  return r.parent.canReplaceWith(i, i + 1, n);
}
function o1(t, e, n, r, i) {
  let s = t.doc.nodeAt(e);
  if (!s)
    throw new RangeError("No node at given position");
  n || (n = s.type);
  let o = n.create(r, null, i || s.marks);
  if (s.isLeaf)
    return t.replaceWith(e, e + s.nodeSize, o);
  if (!n.validContent(s.content))
    throw new RangeError("Invalid content for node type " + n.name);
  t.step(new Je(e, e + s.nodeSize, e + 1, e + s.nodeSize - 1, new ne(K.from(o), 0, 0), 1, !0));
}
function zr(t, e, n = 1, r) {
  let i = t.resolve(e), s = i.depth - n, o = r && r[r.length - 1] || i.parent;
  if (s < 0 || i.parent.type.spec.isolating || !i.parent.canReplace(i.index(), i.parent.childCount) || !o.type.validContent(i.parent.content.cutByIndex(i.index(), i.parent.childCount)))
    return !1;
  for (let u = i.depth - 1, c = n - 2; u > s; u--, c--) {
    let h = i.node(u), d = i.index(u);
    if (h.type.spec.isolating)
      return !1;
    let f = h.content.cutByIndex(d, h.childCount), p = r && r[c + 1];
    p && (f = f.replaceChild(0, p.type.create(p.attrs)));
    let m = r && r[c] || h;
    if (!h.canReplace(d + 1, h.childCount) || !m.type.validContent(f))
      return !1;
  }
  let l = i.indexAfter(s), a = r && r[0];
  return i.node(s).canReplaceWith(l, l, a ? a.type : i.node(s + 1).type);
}
function l1(t, e, n = 1, r) {
  let i = t.doc.resolve(e), s = K.empty, o = K.empty;
  for (let l = i.depth, a = i.depth - n, u = n - 1; l > a; l--, u--) {
    s = K.from(i.node(l).copy(s));
    let c = r && r[u];
    o = K.from(c ? c.type.create(c.attrs, o) : i.node(l).copy(o));
  }
  t.step(new ze(e, e, new ne(s.append(o), n, n), !0));
}
function vs(t, e) {
  let n = t.resolve(e), r = n.index();
  return u1(n.nodeBefore, n.nodeAfter) && n.parent.canReplace(r, r + 1);
}
function a1(t, e) {
  e.content.size || t.type.compatibleContent(e.type);
  let n = t.contentMatchAt(t.childCount), { linebreakReplacement: r } = t.type.schema;
  for (let i = 0; i < e.childCount; i++) {
    let s = e.child(i), o = s.type == r ? t.type.schema.nodes.text : s.type;
    if (n = n.matchType(o), !n || !t.type.allowsMarks(s.marks))
      return !1;
  }
  return n.validEnd;
}
function u1(t, e) {
  return !!(t && e && !t.isLeaf && a1(t, e));
}
function c1(t, e, n) {
  let r = null, { linebreakReplacement: i } = t.doc.type.schema, s = t.doc.resolve(e - n), o = s.node().type;
  if (i && o.inlineContent) {
    let c = o.whitespace == "pre", h = !!o.contentMatch.matchType(i);
    c && !h ? r = !1 : !c && h && (r = !0);
  }
  let l = t.steps.length;
  if (r === !1) {
    let c = t.doc.resolve(e + n);
    $f(t, c.node(), c.before(), l);
  }
  o.inlineContent && Fl(t, e + n - 1, o, s.node().contentMatchAt(s.index()), r == null);
  let a = t.mapping.slice(l), u = a.map(e - n);
  if (t.step(new ze(u, a.map(e + n, -1), ne.empty, !0)), r === !0) {
    let c = t.doc.resolve(u);
    Ff(t, c.node(), c.before(), t.steps.length);
  }
  return t;
}
function h1(t, e, n) {
  let r = t.resolve(e);
  if (r.parent.canReplaceWith(r.index(), r.index(), n))
    return e;
  if (r.parentOffset == 0)
    for (let i = r.depth - 1; i >= 0; i--) {
      let s = r.index(i);
      if (r.node(i).canReplaceWith(s, s, n))
        return r.before(i + 1);
      if (s > 0)
        return null;
    }
  if (r.parentOffset == r.parent.content.size)
    for (let i = r.depth - 1; i >= 0; i--) {
      let s = r.indexAfter(i);
      if (r.node(i).canReplaceWith(s, s, n))
        return r.after(i + 1);
      if (s < r.node(i).childCount)
        return null;
    }
  return null;
}
function f1(t, e, n) {
  let r = t.resolve(e);
  if (!n.content.size)
    return e;
  let i = n.content;
  for (let s = 0; s < n.openStart; s++)
    i = i.firstChild.content;
  for (let s = 1; s <= (n.openStart == 0 && n.size ? 2 : 1); s++)
    for (let o = r.depth; o >= 0; o--) {
      let l = o == r.depth ? 0 : r.pos <= (r.start(o + 1) + r.end(o + 1)) / 2 ? -1 : 1, a = r.index(o) + (l > 0 ? 1 : 0), u = r.node(o), c = !1;
      if (s == 1)
        c = u.canReplace(a, a, i);
      else {
        let h = u.contentMatchAt(a).findWrapping(i.firstChild.type);
        c = h && u.canReplaceWith(a, a, h[0]);
      }
      if (c)
        return l == 0 ? r.pos : l < 0 ? r.before(o + 1) : r.after(o + 1);
    }
  return null;
}
function Ns(t, e, n = e, r = ne.empty) {
  if (e == n && !r.size)
    return null;
  let i = t.resolve(e), s = t.resolve(n);
  return jf(i, s, r) ? new ze(e, n, r) : new d1(i, s, r).fit();
}
function jf(t, e, n) {
  return !n.openStart && !n.openEnd && t.start() == e.start() && t.parent.canReplace(t.index(), e.index(), n.content);
}
class d1 {
  constructor(e, n, r) {
    this.$from = e, this.$to = n, this.unplaced = r, this.frontier = [], this.placed = K.empty;
    for (let i = 0; i <= e.depth; i++) {
      let s = e.node(i);
      this.frontier.push({
        type: s.type,
        match: s.contentMatchAt(e.indexAfter(i))
      });
    }
    for (let i = e.depth; i > 0; i--)
      this.placed = K.from(e.node(i).copy(this.placed));
  }
  get depth() {
    return this.frontier.length - 1;
  }
  fit() {
    for (; this.unplaced.size; ) {
      let u = this.findFittable();
      u ? this.placeNodes(u) : this.openMore() || this.dropNode();
    }
    let e = this.mustMoveInline(), n = this.placed.size - this.depth - this.$from.depth, r = this.$from, i = this.close(e < 0 ? this.$to : r.doc.resolve(e));
    if (!i)
      return null;
    let s = this.placed, o = r.depth, l = i.depth;
    for (; o && l && s.childCount == 1; )
      s = s.firstChild.content, o--, l--;
    let a = new ne(s, o, l);
    return e > -1 ? new Je(r.pos, e, this.$to.pos, this.$to.end(), a, n) : a.size || r.pos != this.$to.pos ? new ze(r.pos, i.pos, a) : null;
  }
  // Find a position on the start spine of `this.unplaced` that has
  // content that can be moved somewhere on the frontier. Returns two
  // depths, one for the slice and one for the frontier.
  findFittable() {
    let e = this.unplaced.openStart;
    for (let n = this.unplaced.content, r = 0, i = this.unplaced.openEnd; r < e; r++) {
      let s = n.firstChild;
      if (n.childCount > 1 && (i = 0), s.type.spec.isolating && i <= r) {
        e = r;
        break;
      }
      n = s.content;
    }
    for (let n = 1; n <= 2; n++)
      for (let r = n == 1 ? e : this.unplaced.openStart; r >= 0; r--) {
        let i, s = null;
        r ? (s = ic(this.unplaced.content, r - 1).firstChild, i = s.content) : i = this.unplaced.content;
        let o = i.firstChild;
        for (let l = this.depth; l >= 0; l--) {
          let { type: a, match: u } = this.frontier[l], c, h = null;
          if (n == 1 && (o ? u.matchType(o.type) || (h = u.fillBefore(K.from(o), !1)) : s && a.compatibleContent(s.type)))
            return { sliceDepth: r, frontierDepth: l, parent: s, inject: h };
          if (n == 2 && o && (c = u.findWrapping(o.type)))
            return { sliceDepth: r, frontierDepth: l, parent: s, wrap: c };
          if (s && u.matchType(s.type))
            break;
        }
      }
  }
  openMore() {
    let { content: e, openStart: n, openEnd: r } = this.unplaced;
    return sc(e, -1) <= n ? !1 : (this.unplaced.size > 1 && sc(e, 1) > r && r++, this.unplaced = new ne(e, n + 1, r), !0);
  }
  dropNode() {
    let { content: e, openStart: n, openEnd: r } = this.unplaced, i = ic(e, n);
    if (i.childCount <= 1 && n > 0) {
      let s = e.size - n <= n + i.size;
      this.unplaced = new ne(Ir(e, n - 1, 1), n - 1, s ? n - 1 : r);
    } else
      this.unplaced = new ne(Ir(e, n, 1), n, r);
  }
  // Move content from the unplaced slice at `sliceDepth` to the
  // frontier node at `frontierDepth`. Close that frontier node when
  // applicable.
  placeNodes({ sliceDepth: e, frontierDepth: n, parent: r, inject: i, wrap: s }) {
    for (; this.depth > n; )
      this.closeFrontierNode();
    if (s)
      for (let m = 0; m < s.length; m++)
        this.openFrontierNode(s[m]);
    let o = this.unplaced, l = r ? r.content : o.content, a = o.openStart - e, u = 0, c = [], { match: h, type: d } = this.frontier[n];
    if (i) {
      for (let m = 0; m < i.childCount; m++)
        c.push(i.child(m));
      h = h.matchFragment(i);
    }
    let f = l.size + e - (o.content.size - o.openEnd);
    for (; u < l.childCount; ) {
      let m = l.child(u), y = h.matchType(m.type);
      if (!y)
        break;
      u++, (u > 1 || a == 0 || m.content.size) && (h = y, c.push(Vf(m.mark(d.allowedMarks(m.marks)), u == 1 ? a : 0, u == l.childCount ? f : -1)));
    }
    let p = u == l.childCount;
    p || (f = -1), this.placed = _r(this.placed, n, K.from(c)), this.frontier[n].match = h, p && f < 0 && r && r.type == this.frontier[this.depth].type && this.frontier.length > 1 && this.closeFrontierNode();
    for (let m = 0, y = l; m < f; m++) {
      let g = y.lastChild;
      this.frontier.push({ type: g.type, match: g.contentMatchAt(g.childCount) }), y = g.content;
    }
    this.unplaced = p ? e == 0 ? ne.empty : new ne(Ir(o.content, e - 1, 1), e - 1, f < 0 ? o.openEnd : e - 1) : new ne(Ir(o.content, e, u), o.openStart, o.openEnd);
  }
  mustMoveInline() {
    if (!this.$to.parent.isTextblock)
      return -1;
    let e = this.frontier[this.depth], n;
    if (!e.type.isTextblock || !Zs(this.$to, this.$to.depth, e.type, e.match, !1) || this.$to.depth == this.depth && (n = this.findCloseLevel(this.$to)) && n.depth == this.depth)
      return -1;
    let { depth: r } = this.$to, i = this.$to.after(r);
    for (; r > 1 && i == this.$to.end(--r); )
      ++i;
    return i;
  }
  findCloseLevel(e) {
    e: for (let n = Math.min(this.depth, e.depth); n >= 0; n--) {
      let { match: r, type: i } = this.frontier[n], s = n < e.depth && e.end(n + 1) == e.pos + (e.depth - (n + 1)), o = Zs(e, n, i, r, s);
      if (o) {
        for (let l = n - 1; l >= 0; l--) {
          let { match: a, type: u } = this.frontier[l], c = Zs(e, l, u, a, !0);
          if (!c || c.childCount)
            continue e;
        }
        return { depth: n, fit: o, move: s ? e.doc.resolve(e.after(n + 1)) : e };
      }
    }
  }
  close(e) {
    let n = this.findCloseLevel(e);
    if (!n)
      return null;
    for (; this.depth > n.depth; )
      this.closeFrontierNode();
    n.fit.childCount && (this.placed = _r(this.placed, n.depth, n.fit)), e = n.move;
    for (let r = n.depth + 1; r <= e.depth; r++) {
      let i = e.node(r), s = i.type.contentMatch.fillBefore(i.content, !0, e.index(r));
      this.openFrontierNode(i.type, i.attrs, s);
    }
    return e;
  }
  openFrontierNode(e, n = null, r) {
    let i = this.frontier[this.depth];
    i.match = i.match.matchType(e), this.placed = _r(this.placed, this.depth, K.from(e.create(n, r))), this.frontier.push({ type: e, match: e.contentMatch });
  }
  closeFrontierNode() {
    let n = this.frontier.pop().match.fillBefore(K.empty, !0);
    n.childCount && (this.placed = _r(this.placed, this.frontier.length, n));
  }
}
function Ir(t, e, n) {
  return e == 0 ? t.cutByIndex(n, t.childCount) : t.replaceChild(0, t.firstChild.copy(Ir(t.firstChild.content, e - 1, n)));
}
function _r(t, e, n) {
  return e == 0 ? t.append(n) : t.replaceChild(t.childCount - 1, t.lastChild.copy(_r(t.lastChild.content, e - 1, n)));
}
function ic(t, e) {
  for (let n = 0; n < e; n++)
    t = t.firstChild.content;
  return t;
}
function Vf(t, e, n) {
  if (e <= 0)
    return t;
  let r = t.content;
  return e > 1 && (r = r.replaceChild(0, Vf(r.firstChild, e - 1, r.childCount == 1 ? n - 1 : 0))), e > 0 && (r = t.type.contentMatch.fillBefore(r).append(r), n <= 0 && (r = r.append(t.type.contentMatch.matchFragment(r).fillBefore(K.empty, !0)))), t.copy(r);
}
function Zs(t, e, n, r, i) {
  let s = t.node(e), o = i ? t.indexAfter(e) : t.index(e);
  if (o == s.childCount && !n.compatibleContent(s.type))
    return null;
  let l = r.fillBefore(s.content, !0, o);
  return l && !p1(n, s.content, o) ? l : null;
}
function p1(t, e, n) {
  for (let r = n; r < e.childCount; r++)
    if (!t.allowsMarks(e.child(r).marks))
      return !0;
  return !1;
}
function m1(t) {
  return t.spec.defining || t.spec.definingForContent;
}
function sc(t, e) {
  for (let n = 0; ; n++) {
    let r = e < 0 ? t.firstChild : t.lastChild;
    if (!r || r.isAtom)
      return n;
    t = r.content;
  }
}
function g1(t, e, n, r) {
  if (!r.size)
    return t.deleteRange(e, n);
  let i = t.doc.resolve(e), s = t.doc.resolve(n);
  if (jf(i, s, r))
    return t.step(new ze(e, n, r));
  let o = Hf(i, s);
  o[o.length - 1] == 0 && o.pop();
  let l = -(i.depth + 1);
  o.unshift(l);
  for (let d = i.depth, f = i.pos - 1; d > 0; d--, f--) {
    let p = i.node(d).type.spec;
    if (p.defining || p.definingAsContext || p.isolating)
      break;
    o.indexOf(d) > -1 ? l = d : i.before(d) == f && o.splice(1, 0, -d);
  }
  let a = o.indexOf(l), u = [], c = r.openStart;
  for (let d = r.content, f = 0; ; f++) {
    let p = d.firstChild;
    if (u.push(p), f == r.openStart)
      break;
    d = p.content;
  }
  for (let d = c - 1; d >= 0; d--) {
    let f = u[d], p = m1(f.type);
    if (p && !f.sameMarkup(i.node(Math.abs(l) - 1)))
      c = d;
    else if (p || !f.type.isTextblock)
      break;
  }
  for (let d = r.openStart; d >= 0; d--) {
    let f = (d + c + 1) % (r.openStart + 1), p = u[f];
    if (p)
      for (let m = 0; m < o.length; m++) {
        let y = o[(m + a) % o.length], g = !0;
        y < 0 && (g = !1, y = -y);
        let b = i.node(y - 1), x = i.index(y - 1);
        if (b.canReplaceWith(x, x, p.type, p.marks))
          return t.replace(i.before(y), g ? s.after(y) : n, new ne(Wf(r.content, 0, r.openStart, f), f, r.openEnd));
      }
  }
  let h = t.steps.length;
  for (let d = o.length - 1; d >= 0 && (t.replace(e, n, r), !(t.steps.length > h)); d--) {
    let f = o[d];
    f < 0 || (e = i.before(f), n = s.after(f));
  }
}
function Wf(t, e, n, r, i) {
  if (e < n) {
    let s = t.firstChild;
    t = t.replaceChild(0, s.copy(Wf(s.content, e + 1, n, r, s)));
  }
  if (e > r) {
    let s = i.contentMatchAt(0), o = s.fillBefore(t).append(t);
    t = o.append(s.matchFragment(o).fillBefore(K.empty, !0));
  }
  return t;
}
function y1(t, e, n, r) {
  if (!r.isInline && e == n && t.doc.resolve(e).parent.content.size) {
    let i = h1(t.doc, e, r.type);
    i != null && (e = n = i);
  }
  t.replaceRange(e, n, new ne(K.from(r), 0, 0));
}
function k1(t, e, n) {
  let r = t.doc.resolve(e), i = t.doc.resolve(n);
  if (r.parent.isTextblock && i.parent.isTextblock && r.start() != i.start() && r.parentOffset == 0 && i.parentOffset == 0) {
    let o = r.sharedDepth(n), l = !1;
    for (let a = r.depth; a > o; a--)
      r.node(a).type.spec.isolating && (l = !0);
    for (let a = i.depth; a > o; a--)
      i.node(a).type.spec.isolating && (l = !0);
    if (!l) {
      for (let a = r.depth; a > 0 && e == r.start(a); a--)
        e = r.before(a);
      for (let a = i.depth; a > 0 && n == i.start(a); a--)
        n = i.before(a);
      r = t.doc.resolve(e), i = t.doc.resolve(n);
    }
  }
  let s = Hf(r, i);
  for (let o = 0; o < s.length; o++) {
    let l = s[o], a = o == s.length - 1;
    if (a && l == 0 || r.node(l).type.contentMatch.validEnd)
      return t.delete(r.start(l), i.end(l));
    if (l > 0 && (a || r.node(l - 1).canReplace(r.index(l - 1), i.indexAfter(l - 1))))
      return t.delete(r.before(l), i.after(l));
  }
  for (let o = 1; o <= r.depth && o <= i.depth; o++)
    if (e - r.start(o) == r.depth - o && n > r.end(o) && i.end(o) - n != i.depth - o && r.start(o - 1) == i.start(o - 1) && r.node(o - 1).canReplace(r.index(o - 1), i.index(o - 1)))
      return t.delete(r.before(o), n);
  t.delete(e, n);
}
function Hf(t, e) {
  let n = [], r = Math.min(t.depth, e.depth);
  for (let i = r; i >= 0; i--) {
    let s = t.start(i);
    if (s < t.pos - (t.depth - i) || e.end(i) > e.pos + (e.depth - i) || t.node(i).type.spec.isolating || e.node(i).type.spec.isolating)
      break;
    (s == e.start(i) || i == t.depth && i == e.depth && t.parent.inlineContent && e.parent.inlineContent && i && e.start(i - 1) == s - 1) && n.push(i);
  }
  return n;
}
class nr extends Ze {
  /**
  Construct an attribute step.
  */
  constructor(e, n, r) {
    super(), this.pos = e, this.attr = n, this.value = r;
  }
  apply(e) {
    let n = e.nodeAt(this.pos);
    if (!n)
      return Pe.fail("No node at attribute step's position");
    let r = /* @__PURE__ */ Object.create(null);
    for (let s in n.attrs)
      r[s] = n.attrs[s];
    r[this.attr] = this.value;
    let i = n.type.create(r, null, n.marks);
    return Pe.fromReplace(e, this.pos, this.pos + 1, new ne(K.from(i), 0, n.isLeaf ? 0 : 1));
  }
  getMap() {
    return ct.empty;
  }
  invert(e) {
    return new nr(this.pos, this.attr, e.nodeAt(this.pos).attrs[this.attr]);
  }
  map(e) {
    let n = e.mapResult(this.pos, 1);
    return n.deletedAfter ? null : new nr(n.pos, this.attr, this.value);
  }
  toJSON() {
    return { stepType: "attr", pos: this.pos, attr: this.attr, value: this.value };
  }
  static fromJSON(e, n) {
    if (typeof n.pos != "number" || typeof n.attr != "string")
      throw new RangeError("Invalid input for AttrStep.fromJSON");
    return new nr(n.pos, n.attr, n.value);
  }
}
Ze.jsonID("attr", nr);
class Jr extends Ze {
  /**
  Construct an attribute step.
  */
  constructor(e, n) {
    super(), this.attr = e, this.value = n;
  }
  apply(e) {
    let n = /* @__PURE__ */ Object.create(null);
    for (let i in e.attrs)
      n[i] = e.attrs[i];
    n[this.attr] = this.value;
    let r = e.type.create(n, e.content, e.marks);
    return Pe.ok(r);
  }
  getMap() {
    return ct.empty;
  }
  invert(e) {
    return new Jr(this.attr, e.attrs[this.attr]);
  }
  map(e) {
    return this;
  }
  toJSON() {
    return { stepType: "docAttr", attr: this.attr, value: this.value };
  }
  static fromJSON(e, n) {
    if (typeof n.attr != "string")
      throw new RangeError("Invalid input for DocAttrStep.fromJSON");
    return new Jr(n.attr, n.value);
  }
}
Ze.jsonID("docAttr", Jr);
let sr = class extends Error {
};
sr = function t(e) {
  let n = Error.call(this, e);
  return n.__proto__ = t.prototype, n;
};
sr.prototype = Object.create(Error.prototype);
sr.prototype.constructor = sr;
sr.prototype.name = "TransformError";
class Uf {
  /**
  Create a transform that starts with the given document.
  */
  constructor(e) {
    this.doc = e, this.steps = [], this.docs = [], this.mapping = new rs();
  }
  /**
  The starting document.
  */
  get before() {
    return this.docs.length ? this.docs[0] : this.doc;
  }
  /**
  Apply a new step in this transform, saving the result. Throws an
  error when the step fails.
  */
  step(e) {
    let n = this.maybeStep(e);
    if (n.failed)
      throw new sr(n.failed);
    return this;
  }
  /**
  Try to apply a step in this transformation, ignoring it if it
  fails. Returns the step result.
  */
  maybeStep(e) {
    let n = e.apply(this.doc);
    return n.failed || this.addStep(e, n.doc), n;
  }
  /**
  True when the document has been changed (when there are any
  steps).
  */
  get docChanged() {
    return this.steps.length > 0;
  }
  /**
  Return a single range, in post-transform document positions,
  that covers all content changed by this transform. Returns null
  if no replacements are made. Note that this will ignore changes
  that add/remove marks without replacing the underlying content.
  */
  changedRange() {
    let e = 1e9, n = -1e9;
    for (let r = 0; r < this.mapping.maps.length; r++) {
      let i = this.mapping.maps[r];
      r && (e = i.map(e, 1), n = i.map(n, -1)), i.forEach((s, o, l, a) => {
        e = Math.min(e, l), n = Math.max(n, a);
      });
    }
    return e == 1e9 ? null : { from: e, to: n };
  }
  /**
  @internal
  */
  addStep(e, n) {
    this.docs.push(this.doc), this.steps.push(e), this.mapping.appendMap(e.getMap()), this.doc = n;
  }
  /**
  Replace the part of the document between `from` and `to` with the
  given `slice`.
  */
  replace(e, n = e, r = ne.empty) {
    let i = Ns(this.doc, e, n, r);
    return i && this.step(i), this;
  }
  /**
  Replace the given range with the given content, which may be a
  fragment, node, or array of nodes.
  */
  replaceWith(e, n, r) {
    return this.replace(e, n, new ne(K.from(r), 0, 0));
  }
  /**
  Delete the content between the given positions.
  */
  delete(e, n) {
    return this.replace(e, n, ne.empty);
  }
  /**
  Insert the given content at the given position.
  */
  insert(e, n) {
    return this.replaceWith(e, e, n);
  }
  /**
  Replace a range of the document with a given slice, using
  `from`, `to`, and the slice's
  [`openStart`](https://prosemirror.net/docs/ref/#model.Slice.openStart) property as hints, rather
  than fixed start and end points. This method may grow the
  replaced area or close open nodes in the slice in order to get a
  fit that is more in line with WYSIWYG expectations, by dropping
  fully covered parent nodes of the replaced region when they are
  marked [non-defining as
  context](https://prosemirror.net/docs/ref/#model.NodeSpec.definingAsContext), or including an
  open parent node from the slice that _is_ marked as [defining
  its content](https://prosemirror.net/docs/ref/#model.NodeSpec.definingForContent).
  
  This is the method, for example, to handle paste. The similar
  [`replace`](https://prosemirror.net/docs/ref/#transform.Transform.replace) method is a more
  primitive tool which will _not_ move the start and end of its given
  range, and is useful in situations where you need more precise
  control over what happens.
  */
  replaceRange(e, n, r) {
    return g1(this, e, n, r), this;
  }
  /**
  Replace the given range with a node, but use `from` and `to` as
  hints, rather than precise positions. When from and to are the same
  and are at the start or end of a parent node in which the given
  node doesn't fit, this method may _move_ them out towards a parent
  that does allow the given node to be placed. When the given range
  completely covers a parent node, this method may completely replace
  that parent node.
  */
  replaceRangeWith(e, n, r) {
    return y1(this, e, n, r), this;
  }
  /**
  Delete the given range, expanding it to cover fully covered
  parent nodes until a valid replace is found.
  */
  deleteRange(e, n) {
    return k1(this, e, n), this;
  }
  /**
  Split the content in the given range off from its parent, if there
  is sibling content before or after it, and move it up the tree to
  the depth specified by `target`. You'll probably want to use
  [`liftTarget`](https://prosemirror.net/docs/ref/#transform.liftTarget) to compute `target`, to make
  sure the lift is valid.
  */
  lift(e, n) {
    return e1(this, e, n), this;
  }
  /**
  Join the blocks around the given position. If depth is 2, their
  last and first siblings are also joined, and so on.
  */
  join(e, n = 1) {
    return c1(this, e, n), this;
  }
  /**
  Wrap the given [range](https://prosemirror.net/docs/ref/#model.NodeRange) in the given set of wrappers.
  The wrappers are assumed to be valid in this position, and should
  probably be computed with [`findWrapping`](https://prosemirror.net/docs/ref/#transform.findWrapping).
  */
  wrap(e, n) {
    return r1(this, e, n), this;
  }
  /**
  Set the type of all textblocks (partly) between `from` and `to` to
  the given node type with the given attributes.
  */
  setBlockType(e, n = e, r, i = null) {
    return i1(this, e, n, r, i), this;
  }
  /**
  Change the type, attributes, and/or marks of the node at `pos`.
  When `type` isn't given, the existing node type is preserved,
  */
  setNodeMarkup(e, n, r = null, i) {
    return o1(this, e, n, r, i), this;
  }
  /**
  Set a single attribute on a given node to a new value.
  The `pos` addresses the document content. Use `setDocAttribute`
  to set attributes on the document itself.
  */
  setNodeAttribute(e, n, r) {
    return this.step(new nr(e, n, r)), this;
  }
  /**
  Set a single attribute on the document to a new value.
  */
  setDocAttribute(e, n) {
    return this.step(new Jr(e, n)), this;
  }
  /**
  Add a mark to the node at position `pos`.
  */
  addNodeMark(e, n) {
    return this.step(new hn(e, n)), this;
  }
  /**
  Remove a mark (or all marks of the given type) from the node at
  position `pos`.
  */
  removeNodeMark(e, n) {
    let r = this.doc.nodeAt(e);
    if (!r)
      throw new RangeError("No node at position " + e);
    if (n instanceof be)
      n.isInSet(r.marks) && this.step(new Vn(e, n));
    else {
      let i = r.marks, s, o = [];
      for (; s = n.isInSet(i); )
        o.push(new Vn(e, s)), i = s.removeFromSet(i);
      for (let l = o.length - 1; l >= 0; l--)
        this.step(o[l]);
    }
    return this;
  }
  /**
  Split the node at the given position, and optionally, if `depth` is
  greater than one, any number of nodes above that. By default, the
  parts split off will inherit the node type of the original node.
  This can be changed by passing an array of types and attributes to
  use after the split (with the outermost nodes coming first).
  */
  split(e, n = 1, r) {
    return l1(this, e, n, r), this;
  }
  /**
  Add the given mark to the inline content between `from` and `to`.
  */
  addMark(e, n, r) {
    return Y0(this, e, n, r), this;
  }
  /**
  Remove marks from inline nodes between `from` and `to`. When
  `mark` is a single mark, remove precisely that mark. When it is
  a mark type, remove all marks of that type. When it is null,
  remove all marks of any type.
  */
  removeMark(e, n, r) {
    return X0(this, e, n, r), this;
  }
  /**
  Removes all marks and nodes from the content of the node at
  `pos` that don't match the given new parent node type. Accepts
  an optional starting [content match](https://prosemirror.net/docs/ref/#model.ContentMatch) as
  third argument.
  */
  clearIncompatible(e, n, r) {
    return Fl(this, e, n, r), this;
  }
}
const Ys = /* @__PURE__ */ Object.create(null);
class he {
  /**
  Initialize a selection with the head and anchor and ranges. If no
  ranges are given, constructs a single range across `$anchor` and
  `$head`.
  */
  constructor(e, n, r) {
    this.$anchor = e, this.$head = n, this.ranges = r || [new qf(e.min(n), e.max(n))];
  }
  /**
  The selection's anchor, as an unresolved position.
  */
  get anchor() {
    return this.$anchor.pos;
  }
  /**
  The selection's head.
  */
  get head() {
    return this.$head.pos;
  }
  /**
  The lower bound of the selection's main range.
  */
  get from() {
    return this.$from.pos;
  }
  /**
  The upper bound of the selection's main range.
  */
  get to() {
    return this.$to.pos;
  }
  /**
  The resolved lower  bound of the selection's main range.
  */
  get $from() {
    return this.ranges[0].$from;
  }
  /**
  The resolved upper bound of the selection's main range.
  */
  get $to() {
    return this.ranges[0].$to;
  }
  /**
  Indicates whether the selection contains any content.
  */
  get empty() {
    let e = this.ranges;
    for (let n = 0; n < e.length; n++)
      if (e[n].$from.pos != e[n].$to.pos)
        return !1;
    return !0;
  }
  /**
  Get the content of this selection as a slice.
  */
  content() {
    return this.$from.doc.slice(this.from, this.to, !0);
  }
  /**
  Replace the selection with a slice or, if no slice is given,
  delete the selection. Will append to the given transaction.
  */
  replace(e, n = ne.empty) {
    let r = n.content.lastChild, i = null;
    for (let l = 0; l < n.openEnd; l++)
      i = r, r = r.lastChild;
    let s = e.steps.length, o = this.ranges;
    for (let l = 0; l < o.length; l++) {
      let { $from: a, $to: u } = o[l], c = e.mapping.slice(s);
      e.replaceRange(c.map(a.pos), c.map(u.pos), l ? ne.empty : n), l == 0 && ac(e, s, (r ? r.isInline : i && i.isTextblock) ? -1 : 1);
    }
  }
  /**
  Replace the selection with the given node, appending the changes
  to the given transaction.
  */
  replaceWith(e, n) {
    let r = e.steps.length, i = this.ranges;
    for (let s = 0; s < i.length; s++) {
      let { $from: o, $to: l } = i[s], a = e.mapping.slice(r), u = a.map(o.pos), c = a.map(l.pos);
      s ? e.deleteRange(u, c) : (e.replaceRangeWith(u, c, n), ac(e, r, n.isInline ? -1 : 1));
    }
  }
  /**
  Find a valid cursor or leaf node selection starting at the given
  position and searching back if `dir` is negative, and forward if
  positive. When `textOnly` is true, only consider cursor
  selections. Will return null when no valid selection position is
  found.
  */
  static findFrom(e, n, r = !1) {
    let i = e.parent.inlineContent ? new pe(e) : Zn(e.node(0), e.parent, e.pos, e.index(), n, r);
    if (i)
      return i;
    for (let s = e.depth - 1; s >= 0; s--) {
      let o = n < 0 ? Zn(e.node(0), e.node(s), e.before(s + 1), e.index(s), n, r) : Zn(e.node(0), e.node(s), e.after(s + 1), e.index(s) + 1, n, r);
      if (o)
        return o;
    }
    return null;
  }
  /**
  Find a valid cursor or leaf node selection near the given
  position. Searches forward first by default, but if `bias` is
  negative, it will search backwards first.
  */
  static near(e, n = 1) {
    return this.findFrom(e, n) || this.findFrom(e, -n) || new ft(e.node(0));
  }
  /**
  Find the cursor or leaf node selection closest to the start of
  the given document. Will return an
  [`AllSelection`](https://prosemirror.net/docs/ref/#state.AllSelection) if no valid position
  exists.
  */
  static atStart(e) {
    return Zn(e, e, 0, 0, 1) || new ft(e);
  }
  /**
  Find the cursor or leaf node selection closest to the end of the
  given document.
  */
  static atEnd(e) {
    return Zn(e, e, e.content.size, e.childCount, -1) || new ft(e);
  }
  /**
  Deserialize the JSON representation of a selection. Must be
  implemented for custom classes (as a static class method).
  */
  static fromJSON(e, n) {
    if (!n || !n.type)
      throw new RangeError("Invalid input for Selection.fromJSON");
    let r = Ys[n.type];
    if (!r)
      throw new RangeError(`No selection type ${n.type} defined`);
    return r.fromJSON(e, n);
  }
  /**
  To be able to deserialize selections from JSON, custom selection
  classes must register themselves with an ID string, so that they
  can be disambiguated. Try to pick something that's unlikely to
  clash with classes from other modules.
  */
  static jsonID(e, n) {
    if (e in Ys)
      throw new RangeError("Duplicate use of selection JSON ID " + e);
    return Ys[e] = n, n.prototype.jsonID = e, n;
  }
  /**
  Get a [bookmark](https://prosemirror.net/docs/ref/#state.SelectionBookmark) for this selection,
  which is a value that can be mapped without having access to a
  current document, and later resolved to a real selection for a
  given document again. (This is used mostly by the history to
  track and restore old selections.) The default implementation of
  this method just converts the selection to a text selection and
  returns the bookmark for that.
  */
  getBookmark() {
    return pe.between(this.$anchor, this.$head).getBookmark();
  }
}
he.prototype.visible = !0;
class qf {
  /**
  Create a range.
  */
  constructor(e, n) {
    this.$from = e, this.$to = n;
  }
}
let oc = !1;
function lc(t) {
  !oc && !t.parent.inlineContent && (oc = !0, console.warn("TextSelection endpoint not pointing into a node with inline content (" + t.parent.type.name + ")"));
}
class pe extends he {
  /**
  Construct a text selection between the given points.
  */
  constructor(e, n = e) {
    lc(e), lc(n), super(e, n);
  }
  /**
  Returns a resolved position if this is a cursor selection (an
  empty text selection), and null otherwise.
  */
  get $cursor() {
    return this.$anchor.pos == this.$head.pos ? this.$head : null;
  }
  map(e, n) {
    let r = e.resolve(n.map(this.head));
    if (!r.parent.inlineContent)
      return he.near(r);
    let i = e.resolve(n.map(this.anchor));
    return new pe(i.parent.inlineContent ? i : r, r);
  }
  replace(e, n = ne.empty) {
    if (super.replace(e, n), n == ne.empty) {
      let r = this.$from.marksAcross(this.$to);
      r && e.ensureMarks(r);
    }
  }
  eq(e) {
    return e instanceof pe && e.anchor == this.anchor && e.head == this.head;
  }
  getBookmark() {
    return new Is(this.anchor, this.head);
  }
  toJSON() {
    return { type: "text", anchor: this.anchor, head: this.head };
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.anchor != "number" || typeof n.head != "number")
      throw new RangeError("Invalid input for TextSelection.fromJSON");
    return new pe(e.resolve(n.anchor), e.resolve(n.head));
  }
  /**
  Create a text selection from non-resolved positions.
  */
  static create(e, n, r = n) {
    let i = e.resolve(n);
    return new this(i, r == n ? i : e.resolve(r));
  }
  /**
  Return a text selection that spans the given positions or, if
  they aren't text positions, find a text selection near them.
  `bias` determines whether the method searches forward (default)
  or backwards (negative number) first. Will fall back to calling
  [`Selection.near`](https://prosemirror.net/docs/ref/#state.Selection^near) when the document
  doesn't contain a valid text position.
  */
  static between(e, n, r) {
    let i = e.pos - n.pos;
    if ((!r || i) && (r = i >= 0 ? 1 : -1), !n.parent.inlineContent) {
      let s = he.findFrom(n, r, !0) || he.findFrom(n, -r, !0);
      if (s)
        n = s.$head;
      else
        return he.near(n, r);
    }
    return e.parent.inlineContent || (i == 0 ? e = n : (e = (he.findFrom(e, -r, !0) || he.findFrom(e, r, !0)).$anchor, e.pos < n.pos != i < 0 && (e = n))), new pe(e, n);
  }
}
he.jsonID("text", pe);
class Is {
  constructor(e, n) {
    this.anchor = e, this.head = n;
  }
  map(e) {
    return new Is(e.map(this.anchor), e.map(this.head));
  }
  resolve(e) {
    return pe.between(e.resolve(this.anchor), e.resolve(this.head));
  }
}
class ce extends he {
  /**
  Create a node selection. Does not verify the validity of its
  argument.
  */
  constructor(e) {
    let n = e.nodeAfter, r = e.node(0).resolve(e.pos + n.nodeSize);
    super(e, r), this.node = n;
  }
  map(e, n) {
    let { deleted: r, pos: i } = n.mapResult(this.anchor), s = e.resolve(i);
    return r ? he.near(s) : new ce(s);
  }
  content() {
    return new ne(K.from(this.node), 0, 0);
  }
  eq(e) {
    return e instanceof ce && e.anchor == this.anchor;
  }
  toJSON() {
    return { type: "node", anchor: this.anchor };
  }
  getBookmark() {
    return new jl(this.anchor);
  }
  /**
  @internal
  */
  static fromJSON(e, n) {
    if (typeof n.anchor != "number")
      throw new RangeError("Invalid input for NodeSelection.fromJSON");
    return new ce(e.resolve(n.anchor));
  }
  /**
  Create a node selection from non-resolved positions.
  */
  static create(e, n) {
    return new ce(e.resolve(n));
  }
  /**
  Determines whether the given node may be selected as a node
  selection.
  */
  static isSelectable(e) {
    return !e.isText && e.type.spec.selectable !== !1;
  }
}
ce.prototype.visible = !1;
he.jsonID("node", ce);
class jl {
  constructor(e) {
    this.anchor = e;
  }
  map(e) {
    let { deleted: n, pos: r } = e.mapResult(this.anchor);
    return n ? new Is(r, r) : new jl(r);
  }
  resolve(e) {
    let n = e.resolve(this.anchor), r = n.nodeAfter;
    return r && ce.isSelectable(r) ? new ce(n) : he.near(n);
  }
}
class ft extends he {
  /**
  Create an all-selection over the given document.
  */
  constructor(e) {
    super(e.resolve(0), e.resolve(e.content.size));
  }
  replace(e, n = ne.empty) {
    if (n == ne.empty) {
      e.delete(0, e.doc.content.size);
      let r = he.atStart(e.doc);
      r.eq(e.selection) || e.setSelection(r);
    } else
      super.replace(e, n);
  }
  toJSON() {
    return { type: "all" };
  }
  /**
  @internal
  */
  static fromJSON(e) {
    return new ft(e);
  }
  map(e) {
    return new ft(e);
  }
  eq(e) {
    return e instanceof ft;
  }
  getBookmark() {
    return w1;
  }
}
he.jsonID("all", ft);
const w1 = {
  map() {
    return this;
  },
  resolve(t) {
    return new ft(t);
  }
};
function Zn(t, e, n, r, i, s = !1) {
  if (e.inlineContent)
    return pe.create(t, n);
  for (let o = r - (i > 0 ? 0 : 1); i > 0 ? o < e.childCount : o >= 0; o += i) {
    let l = e.child(o);
    if (l.isAtom) {
      if (!s && ce.isSelectable(l))
        return ce.create(t, n - (i < 0 ? l.nodeSize : 0));
    } else {
      let a = Zn(t, l, n + i, i < 0 ? l.childCount : 0, i, s);
      if (a)
        return a;
    }
    n += l.nodeSize * i;
  }
  return null;
}
function ac(t, e, n) {
  let r = t.steps.length - 1;
  if (r < e)
    return;
  let i = t.steps[r];
  if (!(i instanceof ze || i instanceof Je))
    return;
  let s = t.mapping.maps[r], o;
  s.forEach((l, a, u, c) => {
    o == null && (o = c);
  }), t.setSelection(he.near(t.doc.resolve(o), n));
}
const uc = 1, Ii = 2, cc = 4;
class b1 extends Uf {
  /**
  @internal
  */
  constructor(e) {
    super(e.doc), this.curSelectionFor = 0, this.updated = 0, this.meta = /* @__PURE__ */ Object.create(null), this.time = Date.now(), this.curSelection = e.selection, this.storedMarks = e.storedMarks;
  }
  /**
  The transaction's current selection. This defaults to the editor
  selection [mapped](https://prosemirror.net/docs/ref/#state.Selection.map) through the steps in the
  transaction, but can be overwritten with
  [`setSelection`](https://prosemirror.net/docs/ref/#state.Transaction.setSelection).
  */
  get selection() {
    return this.curSelectionFor < this.steps.length && (this.curSelection = this.curSelection.map(this.doc, this.mapping.slice(this.curSelectionFor)), this.curSelectionFor = this.steps.length), this.curSelection;
  }
  /**
  Update the transaction's current selection. Will determine the
  selection that the editor gets when the transaction is applied.
  */
  setSelection(e) {
    if (e.$from.doc != this.doc)
      throw new RangeError("Selection passed to setSelection must point at the current document");
    return this.curSelection = e, this.curSelectionFor = this.steps.length, this.updated = (this.updated | uc) & ~Ii, this.storedMarks = null, this;
  }
  /**
  Whether the selection was explicitly updated by this transaction.
  */
  get selectionSet() {
    return (this.updated & uc) > 0;
  }
  /**
  Set the current stored marks.
  */
  setStoredMarks(e) {
    return this.storedMarks = e, this.updated |= Ii, this;
  }
  /**
  Make sure the current stored marks or, if that is null, the marks
  at the selection, match the given set of marks. Does nothing if
  this is already the case.
  */
  ensureMarks(e) {
    return be.sameSet(this.storedMarks || this.selection.$from.marks(), e) || this.setStoredMarks(e), this;
  }
  /**
  Add a mark to the set of stored marks.
  */
  addStoredMark(e) {
    return this.ensureMarks(e.addToSet(this.storedMarks || this.selection.$head.marks()));
  }
  /**
  Remove a mark or mark type from the set of stored marks.
  */
  removeStoredMark(e) {
    return this.ensureMarks(e.removeFromSet(this.storedMarks || this.selection.$head.marks()));
  }
  /**
  Whether the stored marks were explicitly set for this transaction.
  */
  get storedMarksSet() {
    return (this.updated & Ii) > 0;
  }
  /**
  @internal
  */
  addStep(e, n) {
    super.addStep(e, n), this.updated = this.updated & ~Ii, this.storedMarks = null;
  }
  /**
  Update the timestamp for the transaction.
  */
  setTime(e) {
    return this.time = e, this;
  }
  /**
  Replace the current selection with the given slice.
  */
  replaceSelection(e) {
    return this.selection.replace(this, e), this;
  }
  /**
  Replace the selection with the given node. When `inheritMarks` is
  true and the content is inline, it inherits the marks from the
  place where it is inserted.
  */
  replaceSelectionWith(e, n = !0) {
    let r = this.selection;
    return n && (e = e.mark(this.storedMarks || (r.empty ? r.$from.marks() : r.$from.marksAcross(r.$to) || be.none))), r.replaceWith(this, e), this;
  }
  /**
  Delete the selection.
  */
  deleteSelection() {
    return this.selection.replace(this), this;
  }
  /**
  Replace the given range, or the selection if no range is given,
  with a text node containing the given string.
  */
  insertText(e, n, r) {
    let i = this.doc.type.schema;
    if (n == null)
      return e ? this.replaceSelectionWith(i.text(e), !0) : this.deleteSelection();
    {
      if (r == null && (r = n), !e)
        return this.deleteRange(n, r);
      let s = this.storedMarks;
      if (!s) {
        let o = this.doc.resolve(n);
        s = r == n ? o.marks() : o.marksAcross(this.doc.resolve(r));
      }
      return this.replaceRangeWith(n, r, i.text(e, s)), !this.selection.empty && this.selection.to == n + e.length && this.setSelection(he.near(this.selection.$to)), this;
    }
  }
  /**
  Store a metadata property in this transaction, keyed either by
  name or by plugin.
  */
  setMeta(e, n) {
    return this.meta[typeof e == "string" ? e : e.key] = n, this;
  }
  /**
  Retrieve a metadata property for a given name or plugin.
  */
  getMeta(e) {
    return this.meta[typeof e == "string" ? e : e.key];
  }
  /**
  Returns true if this transaction doesn't contain any metadata,
  and can thus safely be extended.
  */
  get isGeneric() {
    for (let e in this.meta)
      return !1;
    return !0;
  }
  /**
  Indicate that the editor should scroll the selection into view
  when updated to the state produced by this transaction.
  */
  scrollIntoView() {
    return this.updated |= cc, this;
  }
  /**
  True when this transaction has had `scrollIntoView` called on it.
  */
  get scrolledIntoView() {
    return (this.updated & cc) > 0;
  }
}
function hc(t, e) {
  return !e || !t ? t : t.bind(e);
}
class Tr {
  constructor(e, n, r) {
    this.name = e, this.init = hc(n.init, r), this.apply = hc(n.apply, r);
  }
}
const x1 = [
  new Tr("doc", {
    init(t) {
      return t.doc || t.schema.topNodeType.createAndFill();
    },
    apply(t) {
      return t.doc;
    }
  }),
  new Tr("selection", {
    init(t, e) {
      return t.selection || he.atStart(e.doc);
    },
    apply(t) {
      return t.selection;
    }
  }),
  new Tr("storedMarks", {
    init(t) {
      return t.storedMarks || null;
    },
    apply(t, e, n, r) {
      return r.selection.$cursor ? t.storedMarks : null;
    }
  }),
  new Tr("scrollToSelection", {
    init() {
      return 0;
    },
    apply(t, e) {
      return t.scrolledIntoView ? e + 1 : e;
    }
  })
];
class Xs {
  constructor(e, n) {
    this.schema = e, this.plugins = [], this.pluginsByKey = /* @__PURE__ */ Object.create(null), this.fields = x1.slice(), n && n.forEach((r) => {
      if (this.pluginsByKey[r.key])
        throw new RangeError("Adding different instances of a keyed plugin (" + r.key + ")");
      this.plugins.push(r), this.pluginsByKey[r.key] = r, r.spec.state && this.fields.push(new Tr(r.key, r.spec.state, r));
    });
  }
}
class tr {
  /**
  @internal
  */
  constructor(e) {
    this.config = e;
  }
  /**
  The schema of the state's document.
  */
  get schema() {
    return this.config.schema;
  }
  /**
  The plugins that are active in this state.
  */
  get plugins() {
    return this.config.plugins;
  }
  /**
  Apply the given transaction to produce a new state.
  */
  apply(e) {
    return this.applyTransaction(e).state;
  }
  /**
  @internal
  */
  filterTransaction(e, n = -1) {
    for (let r = 0; r < this.config.plugins.length; r++)
      if (r != n) {
        let i = this.config.plugins[r];
        if (i.spec.filterTransaction && !i.spec.filterTransaction.call(i, e, this))
          return !1;
      }
    return !0;
  }
  /**
  Verbose variant of [`apply`](https://prosemirror.net/docs/ref/#state.EditorState.apply) that
  returns the precise transactions that were applied (which might
  be influenced by the [transaction
  hooks](https://prosemirror.net/docs/ref/#state.PluginSpec.filterTransaction) of
  plugins) along with the new state.
  */
  applyTransaction(e) {
    if (!this.filterTransaction(e))
      return { state: this, transactions: [] };
    let n = [e], r = this.applyInner(e), i = null;
    for (; ; ) {
      let s = !1;
      for (let o = 0; o < this.config.plugins.length; o++) {
        let l = this.config.plugins[o];
        if (l.spec.appendTransaction) {
          let a = i ? i[o].n : 0, u = i ? i[o].state : this, c = a < n.length && l.spec.appendTransaction.call(l, a ? n.slice(a) : n, u, r);
          if (c && r.filterTransaction(c, o)) {
            if (c.setMeta("appendedTransaction", e), !i) {
              i = [];
              for (let h = 0; h < this.config.plugins.length; h++)
                i.push(h < o ? { state: r, n: n.length } : { state: this, n: 0 });
            }
            n.push(c), r = r.applyInner(c), s = !0;
          }
          i && (i[o] = { state: r, n: n.length });
        }
      }
      if (!s)
        return { state: r, transactions: n };
    }
  }
  /**
  @internal
  */
  applyInner(e) {
    if (!e.before.eq(this.doc))
      throw new RangeError("Applying a mismatched transaction");
    let n = new tr(this.config), r = this.config.fields;
    for (let i = 0; i < r.length; i++) {
      let s = r[i];
      n[s.name] = s.apply(e, this[s.name], this, n);
    }
    return n;
  }
  /**
  Accessor that constructs and returns a new [transaction](https://prosemirror.net/docs/ref/#state.Transaction) from this state.
  */
  get tr() {
    return new b1(this);
  }
  /**
  Create a new state.
  */
  static create(e) {
    let n = new Xs(e.doc ? e.doc.type.schema : e.schema, e.plugins), r = new tr(n);
    for (let i = 0; i < n.fields.length; i++)
      r[n.fields[i].name] = n.fields[i].init(e, r);
    return r;
  }
  /**
  Create a new state based on this one, but with an adjusted set
  of active plugins. State fields that exist in both sets of
  plugins are kept unchanged. Those that no longer exist are
  dropped, and those that are new are initialized using their
  [`init`](https://prosemirror.net/docs/ref/#state.StateField.init) method, passing in the new
  configuration object..
  */
  reconfigure(e) {
    let n = new Xs(this.schema, e.plugins), r = n.fields, i = new tr(n);
    for (let s = 0; s < r.length; s++) {
      let o = r[s].name;
      i[o] = this.hasOwnProperty(o) ? this[o] : r[s].init(e, i);
    }
    return i;
  }
  /**
  Serialize this state to JSON. If you want to serialize the state
  of plugins, pass an object mapping property names to use in the
  resulting JSON object to plugin objects. The argument may also be
  a string or number, in which case it is ignored, to support the
  way `JSON.stringify` calls `toString` methods.
  */
  toJSON(e) {
    let n = { doc: this.doc.toJSON(), selection: this.selection.toJSON() };
    if (this.storedMarks && (n.storedMarks = this.storedMarks.map((r) => r.toJSON())), e && typeof e == "object")
      for (let r in e) {
        if (r == "doc" || r == "selection")
          throw new RangeError("The JSON fields `doc` and `selection` are reserved");
        let i = e[r], s = i.spec.state;
        s && s.toJSON && (n[r] = s.toJSON.call(i, this[i.key]));
      }
    return n;
  }
  /**
  Deserialize a JSON representation of a state. `config` should
  have at least a `schema` field, and should contain array of
  plugins to initialize the state with. `pluginFields` can be used
  to deserialize the state of plugins, by associating plugin
  instances with the property names they use in the JSON object.
  */
  static fromJSON(e, n, r) {
    if (!n)
      throw new RangeError("Invalid input for EditorState.fromJSON");
    if (!e.schema)
      throw new RangeError("Required config field 'schema' missing");
    let i = new Xs(e.schema, e.plugins), s = new tr(i);
    return i.fields.forEach((o) => {
      if (o.name == "doc")
        s.doc = bt.fromJSON(e.schema, n.doc);
      else if (o.name == "selection")
        s.selection = he.fromJSON(s.doc, n.selection);
      else if (o.name == "storedMarks")
        n.storedMarks && (s.storedMarks = n.storedMarks.map(e.schema.markFromJSON));
      else {
        if (r)
          for (let l in r) {
            let a = r[l], u = a.spec.state;
            if (a.key == o.name && u && u.fromJSON && Object.prototype.hasOwnProperty.call(n, l)) {
              s[o.name] = u.fromJSON.call(a, e, n[l], s);
              return;
            }
          }
        s[o.name] = o.init(e, s);
      }
    }), s;
  }
}
function Kf(t, e, n) {
  for (let r in t) {
    let i = t[r];
    i instanceof Function ? i = i.bind(e) : r == "handleDOMEvents" && (i = Kf(i, e, {})), n[r] = i;
  }
  return n;
}
class it {
  /**
  Create a plugin.
  */
  constructor(e) {
    this.spec = e, this.props = {}, e.props && Kf(e.props, this, this.props), this.key = e.key ? e.key.key : Jf("plugin");
  }
  /**
  Extract the plugin's state field from an editor state.
  */
  getState(e) {
    return e[this.key];
  }
}
const Qs = /* @__PURE__ */ Object.create(null);
function Jf(t) {
  return t in Qs ? t + "$" + ++Qs[t] : (Qs[t] = 0, t + "$");
}
class st {
  /**
  Create a plugin key.
  */
  constructor(e = "key") {
    this.key = Jf(e);
  }
  /**
  Get the active plugin with this key, if any, from an editor
  state.
  */
  get(e) {
    return e.config.pluginsByKey[this.key];
  }
  /**
  Get the plugin's state from an editor state.
  */
  getState(e) {
    return e[this.key];
  }
}
const Vl = (t, e) => t.selection.empty ? !1 : (e && e(t.tr.deleteSelection().scrollIntoView()), !0);
function Gf(t, e) {
  let { $cursor: n } = t.selection;
  return !n || (e ? !e.endOfTextblock("backward", t) : n.parentOffset > 0) ? null : n;
}
const Zf = (t, e, n) => {
  let r = Gf(t, n);
  if (!r)
    return !1;
  let i = Wl(r);
  if (!i) {
    let o = r.blockRange(), l = o && Ss(o);
    return l == null ? !1 : (e && e(t.tr.lift(o, l).scrollIntoView()), !0);
  }
  let s = i.nodeBefore;
  if (Qf(t, i, e, -1))
    return !0;
  if (r.parent.content.size == 0 && (or(s, "end") || ce.isSelectable(s)))
    for (let o = r.depth; ; o--) {
      let l = Ns(t.doc, r.before(o), r.after(o), ne.empty);
      if (l && l.slice.size < l.to - l.from) {
        if (e) {
          let a = t.tr.step(l);
          a.setSelection(or(s, "end") ? he.findFrom(a.doc.resolve(a.mapping.map(i.pos, -1)), -1) : ce.create(a.doc, i.pos - s.nodeSize)), e(a.scrollIntoView());
        }
        return !0;
      }
      if (o == 1 || r.node(o - 1).childCount > 1)
        break;
    }
  return s.isAtom && i.depth == r.depth - 1 ? (e && e(t.tr.delete(i.pos - s.nodeSize, i.pos).scrollIntoView()), !0) : !1;
}, C1 = (t, e, n) => {
  let r = Gf(t, n);
  if (!r)
    return !1;
  let i = Wl(r);
  return i ? S1(t, i, e) : !1;
};
function S1(t, e, n) {
  let r = e.nodeBefore, i = r, s = e.pos - 1;
  for (; !i.isTextblock; s--) {
    if (i.type.spec.isolating)
      return !1;
    let c = i.lastChild;
    if (!c)
      return !1;
    i = c;
  }
  let o = e.nodeAfter, l = o, a = e.pos + 1;
  for (; !l.isTextblock; a++) {
    if (l.type.spec.isolating)
      return !1;
    let c = l.firstChild;
    if (!c)
      return !1;
    l = c;
  }
  let u = Ns(t.doc, s, a, ne.empty);
  if (!u || u.from != s || u instanceof ze && u.slice.size >= a - s)
    return !1;
  if (n) {
    let c = t.tr.step(u);
    c.setSelection(pe.create(c.doc, s)), n(c.scrollIntoView());
  }
  return !0;
}
function or(t, e, n = !1) {
  for (let r = t; r; r = e == "start" ? r.firstChild : r.lastChild) {
    if (r.isTextblock)
      return !0;
    if (n && r.childCount != 1)
      return !1;
  }
  return !1;
}
const Yf = (t, e, n) => {
  let { $head: r, empty: i } = t.selection, s = r;
  if (!i)
    return !1;
  if (r.parent.isTextblock) {
    if (n ? !n.endOfTextblock("backward", t) : r.parentOffset > 0)
      return !1;
    s = Wl(r);
  }
  let o = s && s.nodeBefore;
  return !o || !ce.isSelectable(o) ? !1 : (e && e(t.tr.setSelection(ce.create(t.doc, s.pos - o.nodeSize)).scrollIntoView()), !0);
};
function Wl(t) {
  if (!t.parent.type.spec.isolating)
    for (let e = t.depth - 1; e >= 0; e--) {
      if (t.index(e) > 0)
        return t.doc.resolve(t.before(e + 1));
      if (t.node(e).type.spec.isolating)
        break;
    }
  return null;
}
function v1(t, e) {
  let { $cursor: n } = t.selection;
  return !n || (e ? !e.endOfTextblock("forward", t) : n.parentOffset < n.parent.content.size) ? null : n;
}
const N1 = (t, e, n) => {
  let r = v1(t, n);
  if (!r)
    return !1;
  let i = Xf(r);
  if (!i)
    return !1;
  let s = i.nodeAfter;
  if (Qf(t, i, e, 1))
    return !0;
  if (r.parent.content.size == 0 && (or(s, "start") || ce.isSelectable(s))) {
    let o = Ns(t.doc, r.before(), r.after(), ne.empty);
    if (o && o.slice.size < o.to - o.from) {
      if (e) {
        let l = t.tr.step(o);
        l.setSelection(or(s, "start") ? he.findFrom(l.doc.resolve(l.mapping.map(i.pos)), 1) : ce.create(l.doc, l.mapping.map(i.pos))), e(l.scrollIntoView());
      }
      return !0;
    }
  }
  return s.isAtom && i.depth == r.depth - 1 ? (e && e(t.tr.delete(i.pos, i.pos + s.nodeSize).scrollIntoView()), !0) : !1;
}, I1 = (t, e, n) => {
  let { $head: r, empty: i } = t.selection, s = r;
  if (!i)
    return !1;
  if (r.parent.isTextblock) {
    if (n ? !n.endOfTextblock("forward", t) : r.parentOffset < r.parent.content.size)
      return !1;
    s = Xf(r);
  }
  let o = s && s.nodeAfter;
  return !o || !ce.isSelectable(o) ? !1 : (e && e(t.tr.setSelection(ce.create(t.doc, s.pos)).scrollIntoView()), !0);
};
function Xf(t) {
  if (!t.parent.type.spec.isolating)
    for (let e = t.depth - 1; e >= 0; e--) {
      let n = t.node(e);
      if (t.index(e) + 1 < n.childCount)
        return t.doc.resolve(t.after(e + 1));
      if (n.type.spec.isolating)
        break;
    }
  return null;
}
const _1 = (t, e) => {
  let { $head: n, $anchor: r } = t.selection;
  return !n.parent.type.spec.code || !n.sameParent(r) ? !1 : (e && e(t.tr.insertText(`
`).scrollIntoView()), !0);
};
function Hl(t) {
  for (let e = 0; e < t.edgeCount; e++) {
    let { type: n } = t.edge(e);
    if (n.isTextblock && !n.hasRequiredAttrs())
      return n;
  }
  return null;
}
const T1 = (t, e) => {
  let { $head: n, $anchor: r } = t.selection;
  if (!n.parent.type.spec.code || !n.sameParent(r))
    return !1;
  let i = n.node(-1), s = n.indexAfter(-1), o = Hl(i.contentMatchAt(s));
  if (!o || !i.canReplaceWith(s, s, o))
    return !1;
  if (e) {
    let l = n.after(), a = t.tr.replaceWith(l, l, o.createAndFill());
    a.setSelection(he.near(a.doc.resolve(l), 1)), e(a.scrollIntoView());
  }
  return !0;
}, A1 = (t, e) => {
  let n = t.selection, { $from: r, $to: i } = n;
  if (n instanceof ft || r.parent.inlineContent || i.parent.inlineContent)
    return !1;
  let s = Hl(i.parent.contentMatchAt(i.indexAfter()));
  if (!s || !s.isTextblock)
    return !1;
  if (e) {
    let o = (!r.parentOffset && i.index() < i.parent.childCount ? r : i).pos, l = t.tr.insert(o, s.createAndFill());
    l.setSelection(pe.create(l.doc, o + 1)), e(l.scrollIntoView());
  }
  return !0;
}, E1 = (t, e) => {
  let { $cursor: n } = t.selection;
  if (!n || n.parent.content.size)
    return !1;
  if (n.depth > 1 && n.after() != n.end(-1)) {
    let s = n.before();
    if (zr(t.doc, s))
      return e && e(t.tr.split(s).scrollIntoView()), !0;
  }
  let r = n.blockRange(), i = r && Ss(r);
  return i == null ? !1 : (e && e(t.tr.lift(r, i).scrollIntoView()), !0);
};
function M1(t) {
  return (e, n) => {
    if (e.selection instanceof ce && e.selection.node.isBlock) {
      let { $from: f } = e.selection;
      return !f.parentOffset || !zr(e.doc, f.pos) ? !1 : (n && n(e.tr.split(f.pos).scrollIntoView()), !0);
    }
    if (!e.selection.$from.depth)
      return !1;
    let r = e.tr;
    !e.selection.empty && (e.selection instanceof pe || e.selection instanceof ft) && r.deleteSelection();
    let { $from: i } = r.selection, s = r.steps.length, o = [], l, a, u = !1, c = !1;
    for (let f = i.depth; ; f--)
      if (i.node(f).isBlock) {
        u = i.end(f) == i.pos + (i.depth - f), c = i.start(f) == i.pos - (i.depth - f), a = Hl(i.node(f - 1).contentMatchAt(i.indexAfter(f - 1))), o.unshift(u && a ? { type: a } : null), l = f;
        break;
      } else {
        if (f == 1)
          return !1;
        o.unshift(null);
      }
    let h = i.pos, d = zr(r.doc, h, o.length, o);
    if (d || (o[0] = a ? { type: a } : null, d = zr(r.doc, h, o.length, o)), !d)
      return !1;
    if (r.split(h, o.length, o), !u && c && i.node(l).type != a) {
      let f = r.mapping.slice(s), p = f.map(i.before(l)), m = r.doc.resolve(p);
      a && i.node(l - 1).canReplaceWith(m.index(), m.index() + 1, a) && r.setNodeMarkup(f.map(i.before(l)), a);
    }
    return n && n(r.scrollIntoView()), !0;
  };
}
const O1 = M1(), D1 = (t, e) => (e && e(t.tr.setSelection(new ft(t.doc))), !0);
function R1(t, e, n) {
  let r = e.nodeBefore, i = e.nodeAfter, s = e.index();
  return !r || !i || !r.type.compatibleContent(i.type) ? !1 : !r.content.size && e.parent.canReplace(s - 1, s) ? (n && n(t.tr.delete(e.pos - r.nodeSize, e.pos).scrollIntoView()), !0) : !e.parent.canReplace(s, s + 1) || !(i.isTextblock || vs(t.doc, e.pos)) ? !1 : (n && n(t.tr.join(e.pos).scrollIntoView()), !0);
}
function Qf(t, e, n, r) {
  let i = e.nodeBefore, s = e.nodeAfter, o, l, a = i.type.spec.isolating || s.type.spec.isolating;
  if (!a && R1(t, e, n))
    return !0;
  let u = !a && e.parent.canReplace(e.index(), e.index() + 1);
  if (u && (o = (l = i.contentMatchAt(i.childCount)).findWrapping(s.type)) && l.matchType(o[0] || s.type).validEnd) {
    if (n) {
      let f = e.pos + s.nodeSize, p = K.empty;
      for (let g = o.length - 1; g >= 0; g--)
        p = K.from(o[g].create(null, p));
      p = K.from(i.copy(p));
      let m = t.tr.step(new Je(e.pos - 1, f, e.pos, f, new ne(p, 1, 0), o.length, !0)), y = m.doc.resolve(f + 2 * o.length);
      y.nodeAfter && y.nodeAfter.type == i.type && vs(m.doc, y.pos) && m.join(y.pos), n(m.scrollIntoView());
    }
    return !0;
  }
  let c = s.type.spec.isolating || r > 0 && a ? null : he.findFrom(e, 1), h = c && c.$from.blockRange(c.$to), d = h && Ss(h);
  if (d != null && d >= e.depth)
    return n && n(t.tr.lift(h, d).scrollIntoView()), !0;
  if (u && or(s, "start", !0) && or(i, "end")) {
    let f = i, p = [];
    for (; p.push(f), !f.isTextblock; )
      f = f.lastChild;
    let m = s, y = 1;
    for (; !m.isTextblock; m = m.firstChild)
      y++;
    if (f.canReplace(f.childCount, f.childCount, m.content)) {
      if (n) {
        let g = K.empty;
        for (let x = p.length - 1; x >= 0; x--)
          g = K.from(p[x].copy(g));
        let b = t.tr.step(new Je(e.pos - p.length, e.pos + s.nodeSize, e.pos + y, e.pos + s.nodeSize - y, new ne(g, p.length, 0), 0, !0));
        n(b.scrollIntoView());
      }
      return !0;
    }
  }
  return !1;
}
function ed(t) {
  return function(e, n) {
    let r = e.selection, i = t < 0 ? r.$from : r.$to, s = i.depth;
    for (; i.node(s).isInline; ) {
      if (!s)
        return !1;
      s--;
    }
    return i.node(s).isTextblock ? (n && n(e.tr.setSelection(pe.create(e.doc, t < 0 ? i.start(s) : i.end(s)))), !0) : !1;
  };
}
const z1 = ed(-1), P1 = ed(1);
function Ul(t, e = null) {
  return function(n, r) {
    let { $from: i, $to: s } = n.selection, o = i.blockRange(s), l = o && $l(o, t, e);
    return l ? (r && r(n.tr.wrap(o, l).scrollIntoView()), !0) : !1;
  };
}
function Gr(t, e = null) {
  return function(n, r) {
    let i = !1;
    for (let s = 0; s < n.selection.ranges.length && !i; s++) {
      let { $from: { pos: o }, $to: { pos: l } } = n.selection.ranges[s];
      n.doc.nodesBetween(o, l, (a, u) => {
        if (i)
          return !1;
        if (!(!a.isTextblock || a.hasMarkup(t, e)))
          if (a.type == t)
            i = !0;
          else {
            let c = n.doc.resolve(u), h = c.index();
            i = c.parent.canReplaceWith(h, h + 1, t);
          }
      });
    }
    if (!i)
      return !1;
    if (r) {
      let s = n.tr;
      for (let o = 0; o < n.selection.ranges.length; o++) {
        let { $from: { pos: l }, $to: { pos: a } } = n.selection.ranges[o];
        s.setBlockType(l, a, t, e);
      }
      r(s.scrollIntoView());
    }
    return !0;
  };
}
function L1(t, e, n, r) {
  for (let i = 0; i < e.length; i++) {
    let { $from: s, $to: o } = e[i], l = s.depth == 0 ? t.inlineContent && t.type.allowsMarkType(n) : !1;
    if (t.nodesBetween(s.pos, o.pos, (a, u) => {
      if (l)
        return !1;
      l = a.inlineContent && a.type.allowsMarkType(n);
    }), l)
      return !0;
  }
  return !1;
}
function _s(t, e = null, n) {
  return function(r, i) {
    let { empty: s, $cursor: o, ranges: l } = r.selection;
    if (s && !o || !L1(r.doc, l, t))
      return !1;
    if (i)
      if (o)
        t.isInSet(r.storedMarks || o.marks()) ? i(r.tr.removeStoredMark(t)) : i(r.tr.addStoredMark(t.create(e)));
      else {
        let a, u = r.tr;
        a = !l.some((c) => r.doc.rangeHasMark(c.$from.pos, c.$to.pos, t));
        for (let c = 0; c < l.length; c++) {
          let { $from: h, $to: d } = l[c];
          if (!a)
            u.removeMark(h.pos, d.pos, t);
          else {
            let f = h.pos, p = d.pos, m = h.nodeAfter, y = d.nodeBefore, g = m && m.isText ? /^\s*/.exec(m.text)[0].length : 0, b = y && y.isText ? /\s*$/.exec(y.text)[0].length : 0;
            f + g < p && (f += g, p -= b), u.addMark(f, p, t.create(e));
          }
        }
        i(u.scrollIntoView());
      }
    return !0;
  };
}
function dr(...t) {
  return function(e, n, r) {
    for (let i = 0; i < t.length; i++)
      if (t[i](e, n, r))
        return !0;
    return !1;
  };
}
let eo = dr(Vl, Zf, Yf), fc = dr(Vl, N1, I1);
const qt = {
  Enter: dr(_1, A1, E1, O1),
  "Mod-Enter": T1,
  Backspace: eo,
  "Mod-Backspace": eo,
  "Shift-Backspace": eo,
  Delete: fc,
  "Mod-Delete": fc,
  "Mod-a": D1
}, td = {
  "Ctrl-h": qt.Backspace,
  "Alt-Backspace": qt["Mod-Backspace"],
  "Ctrl-d": qt.Delete,
  "Ctrl-Alt-Backspace": qt["Mod-Delete"],
  "Alt-Delete": qt["Mod-Delete"],
  "Alt-d": qt["Mod-Delete"],
  "Ctrl-a": z1,
  "Ctrl-e": P1
};
for (let t in qt)
  td[t] = qt[t];
const B1 = typeof navigator < "u" ? /Mac|iP(hone|[oa]d)/.test(navigator.platform) : typeof os < "u" && os.platform ? os.platform() == "darwin" : !1, F1 = B1 ? td : qt;
class pt {
  /**
  Create an input rule. The rule applies when the user typed
  something and the text directly in front of the cursor matches
  `match`, which should end with `$`.
  
  The `handler` can be a string, in which case the matched text, or
  the first matched group in the regexp, is replaced by that
  string.
  
  Or a it can be a function, which will be called with the match
  array produced by
  [`RegExp.exec`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec),
  as well as the start and end of the matched range, and which can
  return a [transaction](https://prosemirror.net/docs/ref/#state.Transaction) that describes the
  rule's effect, or null to indicate the input was not handled.
  */
  constructor(e, n, r = {}) {
    this.match = e, this.match = e, this.handler = typeof n == "string" ? $1(n) : n, this.undoable = r.undoable !== !1, this.inCode = r.inCode || !1, this.inCodeMark = r.inCodeMark !== !1;
  }
}
function $1(t) {
  return function(e, n, r, i) {
    let s = t;
    if (n[1]) {
      let o = n[0].lastIndexOf(n[1]);
      s += n[0].slice(o + n[1].length), r += o;
      let l = r - i;
      l > 0 && (s = n[0].slice(o - l, o) + s, r = i);
    }
    return e.tr.insertText(s, r, i);
  };
}
const j1 = (t, e) => {
  let n = t.plugins;
  for (let r = 0; r < n.length; r++) {
    let i = n[r], s;
    if (i.spec.isInputRules && (s = i.getState(t))) {
      if (e) {
        let o = t.tr, l = s.transform;
        for (let a = l.steps.length - 1; a >= 0; a--)
          o.step(l.steps[a].invert(l.docs[a]));
        if (s.text) {
          let a = o.doc.resolve(s.from).marks();
          o.replaceWith(s.from, s.to, t.schema.text(s.text, a));
        } else
          o.delete(s.from, s.to);
        e(o);
      }
      return !0;
    }
  }
  return !1;
};
new pt(/--$/, "—", { inCodeMark: !1 });
new pt(/\.\.\.$/, "…", { inCodeMark: !1 });
new pt(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/, "“", { inCodeMark: !1 });
new pt(/"$/, "”", { inCodeMark: !1 });
new pt(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/, "‘", { inCodeMark: !1 });
new pt(/'$/, "’", { inCodeMark: !1 });
function ql(t, e, n = null, r) {
  return new pt(t, (i, s, o, l) => {
    let a = n instanceof Function ? n(s) : n, u = i.tr.delete(o, l), c = u.doc.resolve(o), h = c.blockRange(), d = h && $l(h, e, a);
    if (!d)
      return null;
    u.wrap(h, d);
    let f = u.doc.resolve(o - 1).nodeBefore;
    return f && f.type == e && vs(u.doc, o - 1) && (!r || r(s, f)) && u.join(o - 1), u;
  });
}
function nd(t, e, n = null) {
  return new pt(t, (r, i, s, o) => {
    let l = r.doc.resolve(s), a = n instanceof Function ? n(i) : n;
    return l.node(-1).canReplaceWith(l.index(-1), l.indexAfter(-1), e) ? r.tr.delete(s, o).setBlockType(s, s, e, a) : null;
  });
}
const wn = typeof navigator < "u" ? navigator : null, dc = typeof document < "u" ? document : null, Sn = wn && wn.userAgent || "", Yo = /Edge\/(\d+)/.exec(Sn), rd = /MSIE \d/.exec(Sn), Xo = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(Sn), Kl = !!(rd || Xo || Yo);
rd ? document.documentMode : Xo ? +Xo[1] : Yo && +Yo[1];
const V1 = !Kl && /gecko\/(\d+)/i.test(Sn);
V1 && +(/Firefox\/(\d+)/.exec(Sn) || [0, 0])[1];
const Qo = !Kl && /Chrome\/(\d+)/.exec(Sn), W1 = !!Qo;
Qo && +Qo[1];
const H1 = !Kl && !!wn && /Apple Computer/.test(wn.vendor), U1 = H1 && (/Mobile\/\w+/.test(Sn) || !!wn && wn.maxTouchPoints > 2);
U1 || wn && /Mac/.test(wn.platform);
const q1 = /Android \d/.test(Sn), K1 = !!dc && "webkitFontSmoothing" in dc.documentElement.style;
K1 && +(/\bAppleWebKit\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1];
function to(t, e, n, r, i, s) {
  if (t.composing) return !1;
  const o = t.state, l = o.doc.resolve(e);
  if (l.parent.type.spec.code) return !1;
  const a = l.parent.textBetween(
    Math.max(0, l.parentOffset - 500),
    l.parentOffset,
    void 0,
    "￼"
  ) + r;
  for (let u of i) {
    const c = u, h = c.match.exec(a), d = h && h[0] && c.handler(o, h, e - (h[0].length - r.length), n);
    if (d)
      return c.undoable !== !1 && d.setMeta(s, { transform: d, from: e, to: n, text: r }), t.dispatch(d), !0;
  }
  return !1;
}
const J1 = new st("MILKDOWN_CUSTOM_INPUTRULES");
function G1({ rules: t }) {
  const e = new it({
    key: J1,
    isInputRules: !0,
    state: {
      init() {
        return null;
      },
      apply(n, r) {
        const i = n.getMeta(this);
        return i || (n.selectionSet || n.docChanged ? null : r);
      }
    },
    props: {
      handleTextInput(n, r, i, s) {
        return to(n, r, i, s, t, e);
      },
      handleDOMEvents: {
        compositionend: (n) => (setTimeout(() => {
          const { $cursor: r } = n.state.selection;
          r && to(n, r.pos, r.pos, "", t, e);
        }), !1),
        keydown: (n, r) => !(q1 && W1 && r.key === "Enter") || n.composing ? !1 : n.someProp(
          "handleKeyDown",
          (i) => i(n, r)
        ) ? (r.preventDefault(), !0) : !1
      },
      handleKeyDown(n, r) {
        if (r.key !== "Enter") return !1;
        const { $cursor: i } = n.state.selection;
        return i ? to(n, i.pos, i.pos, `
`, t, e) : !1;
      }
    }
  });
  return e;
}
function id(t) {
  return t.some((e) => e.type.spec.code);
}
function pc(t, e, n) {
  if (e >= n) return !1;
  let r = !1;
  return t.doc.nodesBetween(e, n, (i) => (i.isInline && id(i.marks) && (r = !0), !r)), r;
}
function Z1(t, e) {
  var n;
  return id((n = t.storedMarks) != null ? n : t.doc.resolve(e).marks());
}
function ii(t, e, n = {}) {
  return new pt(t, (r, i, s, o) => {
    var l, a, u, c;
    const { tr: h } = r, d = i.length;
    let f = i[d - 1], p = i[0], m = [], y;
    const g = {
      group: f,
      fullMatch: p,
      start: s,
      end: o
    }, b = (l = n.updateCaptured) == null ? void 0 : l.call(n, g);
    if (Object.assign(g, b), { group: f, fullMatch: p, start: s, end: o } = g, p === null || f?.trim() === "") return null;
    if (f) {
      const x = p.search(/\S/), A = s + p.indexOf(f), E = A + f.length, v = pc(
        r,
        s + x,
        A
      ), M = E < o && pc(r, E, o);
      if (v || M || Z1(r, o))
        return null;
      m = (a = h.storedMarks) != null ? a : [], E < o && h.delete(E, o), A > s && h.delete(s + x, A), y = s + x + f.length;
      const R = (u = n.getAttr) == null ? void 0 : u.call(n, i);
      h.addMark(s, y, e.create(R)), h.setStoredMarks(m), (c = n.beforeDispatch) == null || c.call(n, { match: i, start: s, end: o, tr: h });
    }
    return h;
  });
}
function sd(t) {
  return Object.assign(Object.create(t), t).setTime(Date.now());
}
function Y1(t, e) {
  return Array.isArray(t) && t.includes(e.type) || e.type === t;
}
function X1(t) {
  return (e) => {
    for (let n = e.depth; n > 0; n -= 1) {
      const r = e.node(n);
      if (t(r)) {
        const i = e.before(n), s = e.after(n);
        return {
          from: i,
          to: s,
          node: r
        };
      }
    }
  };
}
function Q1(t, e) {
  return X1((n) => n.type === e)(t);
}
function eb(t) {
  return (e) => {
    for (let n = e.depth; n > 0; n--) {
      const r = e.node(n);
      if (t(r))
        return {
          pos: e.before(n),
          start: e.start(n),
          depth: n,
          node: r
        };
    }
  };
}
function tb(t, e) {
  if (!(t instanceof ce)) return;
  const { node: n, $from: r } = t;
  if (Y1(e, n))
    return {
      node: n,
      pos: r.pos,
      start: r.start(r.depth),
      depth: r.depth
    };
}
const nb = (t, e) => {
  const { selection: n, doc: r } = t;
  if (n instanceof ce)
    return {
      hasNode: n.node.type === e,
      pos: n.from,
      target: n.node
    };
  const { from: i, to: s } = n;
  let o = !1, l = -1, a = null;
  return r.nodesBetween(i, s, (u, c) => a ? !1 : u.type === e ? (o = !0, l = c, a = u, !1) : !0), {
    hasNode: o,
    pos: l,
    target: a
  };
};
var bn = {
  8: "Backspace",
  9: "Tab",
  10: "Enter",
  12: "NumLock",
  13: "Enter",
  16: "Shift",
  17: "Control",
  18: "Alt",
  20: "CapsLock",
  27: "Escape",
  32: " ",
  33: "PageUp",
  34: "PageDown",
  35: "End",
  36: "Home",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  44: "PrintScreen",
  45: "Insert",
  46: "Delete",
  59: ";",
  61: "=",
  91: "Meta",
  92: "Meta",
  106: "*",
  107: "+",
  108: ",",
  109: "-",
  110: ".",
  111: "/",
  144: "NumLock",
  145: "ScrollLock",
  160: "Shift",
  161: "Shift",
  162: "Control",
  163: "Control",
  164: "Alt",
  165: "Alt",
  173: "-",
  186: ";",
  187: "=",
  188: ",",
  189: "-",
  190: ".",
  191: "/",
  192: "`",
  219: "[",
  220: "\\",
  221: "]",
  222: "'"
}, is = {
  48: ")",
  49: "!",
  50: "@",
  51: "#",
  52: "$",
  53: "%",
  54: "^",
  55: "&",
  56: "*",
  57: "(",
  59: ":",
  61: "+",
  173: "_",
  186: ":",
  187: "+",
  188: "<",
  189: "_",
  190: ">",
  191: "?",
  192: "~",
  219: "{",
  220: "|",
  221: "}",
  222: '"'
}, rb = typeof navigator < "u" && /Mac/.test(navigator.platform), ib = typeof navigator < "u" && /MSIE \d|Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(navigator.userAgent);
for (var $e = 0; $e < 10; $e++) bn[48 + $e] = bn[96 + $e] = String($e);
for (var $e = 1; $e <= 24; $e++) bn[$e + 111] = "F" + $e;
for (var $e = 65; $e <= 90; $e++)
  bn[$e] = String.fromCharCode($e + 32), is[$e] = String.fromCharCode($e);
for (var no in bn) is.hasOwnProperty(no) || (is[no] = bn[no]);
function sb(t) {
  var e = rb && t.metaKey && t.shiftKey && !t.ctrlKey && !t.altKey || ib && t.shiftKey && t.key && t.key.length == 1 || t.key == "Unidentified", n = !e && t.key || (t.shiftKey ? is : bn)[t.keyCode] || t.key || "Unidentified";
  return n == "Esc" && (n = "Escape"), n == "Del" && (n = "Delete"), n == "Left" && (n = "ArrowLeft"), n == "Up" && (n = "ArrowUp"), n == "Right" && (n = "ArrowRight"), n == "Down" && (n = "ArrowDown"), n;
}
const ob = typeof navigator < "u" && /Mac|iP(hone|[oa]d)/.test(navigator.platform), lb = typeof navigator < "u" && /Win/.test(navigator.platform);
function ab(t) {
  let e = t.split(/-(?!$)/), n = e[e.length - 1];
  n == "Space" && (n = " ");
  let r, i, s, o;
  for (let l = 0; l < e.length - 1; l++) {
    let a = e[l];
    if (/^(cmd|meta|m)$/i.test(a))
      o = !0;
    else if (/^a(lt)?$/i.test(a))
      r = !0;
    else if (/^(c|ctrl|control)$/i.test(a))
      i = !0;
    else if (/^s(hift)?$/i.test(a))
      s = !0;
    else if (/^mod$/i.test(a))
      ob ? o = !0 : i = !0;
    else
      throw new Error("Unrecognized modifier name: " + a);
  }
  return r && (n = "Alt-" + n), i && (n = "Ctrl-" + n), o && (n = "Meta-" + n), s && (n = "Shift-" + n), n;
}
function ub(t) {
  let e = /* @__PURE__ */ Object.create(null);
  for (let n in t)
    e[ab(n)] = t[n];
  return e;
}
function ro(t, e, n = !0) {
  return e.altKey && (t = "Alt-" + t), e.ctrlKey && (t = "Ctrl-" + t), e.metaKey && (t = "Meta-" + t), n && e.shiftKey && (t = "Shift-" + t), t;
}
function cb(t) {
  return new it({ props: { handleKeyDown: od(t) } });
}
function od(t) {
  let e = ub(t);
  return function(n, r) {
    let i = sb(r), s, o = e[ro(i, r)];
    if (o && o(n.state, n.dispatch, n))
      return !0;
    if (i.length == 1 && i != " ") {
      if (r.shiftKey) {
        let l = e[ro(i, r, !1)];
        if (l && l(n.state, n.dispatch, n))
          return !0;
      }
      if ((r.altKey || r.metaKey || r.ctrlKey) && // Ctrl-Alt may be used for AltGr on Windows
      !(lb && r.ctrlKey && r.altKey) && (s = bn[r.keyCode]) && s != i) {
        let l = e[ro(s, r)];
        if (l && l(n.state, n.dispatch, n))
          return !0;
      }
    }
    return !1;
  };
}
var ld = class {
}, ad = class {
  constructor() {
    this.elements = [], this.size = () => this.elements.length, this.top = () => this.elements.at(-1), this.push = (t) => {
      this.top()?.push(t);
    }, this.open = (t) => {
      this.elements.push(t);
    }, this.close = () => {
      const t = this.elements.pop();
      if (!t) throw Eh();
      return t;
    };
  }
}, hb = class ud extends ld {
  constructor(e, n, r) {
    super(), this.type = e, this.content = n, this.attrs = r;
  }
  push(e, ...n) {
    this.content.push(e, ...n);
  }
  pop() {
    return this.content.pop();
  }
  static create(e, n, r) {
    return new ud(e, n, r);
  }
}, fb = class extends ad {
  #t;
  static {
    this.create = (t, e) => {
      const n = new this(t);
      return (r) => (n.run(e, r), n.toDoc());
    };
  }
  constructor(t) {
    super(), this.#t = be.none, this.#e = (e) => e.isText, this.#r = (e, n) => {
      if (this.#e(e) && this.#e(n) && be.sameSet(e.marks, n.marks)) return this.schema.text(e.text + n.text, e.marks);
    }, this.#n = (e) => {
      const n = Object.values({
        ...this.schema.nodes,
        ...this.schema.marks
      }).find((r) => r.spec.parseMarkdown.match(e));
      if (!n) throw jg(e);
      return n;
    }, this.#s = (e) => {
      const n = this.#n(e);
      n.spec.parseMarkdown.runner(this, e, n);
    }, this.injectRoot = (e, n, r) => (this.openNode(n, r), this.next(e.children), this), this.openNode = (e, n) => (this.open(hb.create(e, [], n)), this), this.#o = () => {
      this.#t = be.none;
      const e = this.close();
      return this.#i(e.type, e.attrs, e.content);
    }, this.closeNode = () => {
      try {
        this.#o();
      } catch (e) {
        console.error(e);
      }
      return this;
    }, this.#i = (e, n, r) => {
      const i = e.createAndFill(n, r, this.#t);
      if (!i) throw $g(e, n, r);
      return this.push(i), i;
    }, this.addNode = (e, n, r) => {
      try {
        this.#i(e, n, r);
      } catch (i) {
        console.error(i);
      }
      return this;
    }, this.openMark = (e, n) => {
      const r = e.create(n);
      return this.#t = r.addToSet(this.#t), this;
    }, this.closeMark = (e) => (this.#t = e.removeFromSet(this.#t), this), this.addText = (e) => {
      try {
        const n = this.top();
        if (!n) throw Eh();
        const r = n.pop(), i = this.schema.text(e, this.#t);
        if (!r)
          return n.push(i), this;
        const s = this.#r(r, i);
        return s ? (n.push(s), this) : (n.push(r, i), this);
      } catch (n) {
        return console.error(n), this;
      }
    }, this.build = () => {
      let e;
      do
        e = this.#o();
      while (this.size());
      return e;
    }, this.next = (e = []) => ([e].flat().forEach((n) => this.#s(n)), this), this.toDoc = () => this.build(), this.run = (e, n) => {
      const r = e.runSync(e.parse(n), n);
      return this.next(r), this;
    }, this.schema = t;
  }
  #e;
  #r;
  #n;
  #s;
  #o;
  #i;
}, mc = class cd extends ld {
  constructor(e, n, r, i = {}) {
    super(), this.type = e, this.children = n, this.value = r, this.props = i, this.push = (s, ...o) => {
      this.children || (this.children = []), this.children.push(s, ...o);
    }, this.pop = () => this.children?.pop();
  }
  static {
    this.create = (e, n, r, i = {}) => new cd(e, n, r, i);
  }
}, db = (t) => Object.prototype.hasOwnProperty.call(t, "size"), pb = class extends ad {
  #t;
  static {
    this.create = (t, e) => {
      const n = new this(t);
      return (r) => (n.run(r), n.toString(e));
    };
  }
  constructor(t) {
    super(), this.#t = [], this.#e = (e) => {
      const n = Object.values({
        ...this.schema.nodes,
        ...this.schema.marks
      }).find((r) => r.spec.toMarkdown.match(e));
      if (!n) throw Vg(e.type);
      return n;
    }, this.#r = (e) => this.#e(e).spec.toMarkdown.runner(this, e), this.#n = (e, n) => this.#e(e).spec.toMarkdown.runner(this, e, n), this.#s = (e) => {
      const n = (s) => s.type.spec.priority ?? 50, r = [...e].sort((s, o) => n(s) - n(o)), i = [];
      return this.#t.forEach(({ mark: s }) => {
        const o = r.findIndex((l) => l.eq(s));
        o >= 0 && i.push(...r.splice(o, 1));
      }), i.concat(r);
    }, this.#o = (e) => {
      const n = e?.marks;
      let r = 0;
      for (; r < this.#t.length; ) {
        const { mark: i, spanning: s } = this.#t[r];
        if (s && n?.some((o) => o.eq(i))) r++;
        else break;
      }
      for (let i = this.#t.length - 1; i >= r; i--) this.#h(this.#t[i].mark);
    }, this.#i = (e, n) => {
      this.#s(e.marks).every((r) => !this.#n(r, e)) && this.#r(e), this.#o(n);
    }, this.#l = (e) => {
      const { children: n } = e;
      return n && (e.children = n.reduce((r, i, s) => {
        if (s === 0) return [i];
        const o = r.at(-1);
        if (o && o.isMark && i.isMark) {
          const { children: l, ...a } = i, { children: u, ...c } = o;
          if (i.type === o.type && l && u && JSON.stringify(a) === JSON.stringify(c)) {
            const h = {
              ...c,
              children: [...u, ...l]
            };
            return r.slice(0, -1).concat(this.#l(h));
          }
        }
        return r.concat(i);
      }, [])), e;
    }, this.#a = (e) => {
      const n = {
        ...e.props,
        type: e.type
      };
      return e.children && (n.children = e.children), e.value && (n.value = e.value), n;
    }, this.openNode = (e, n, r) => (this.open(mc.create(e, void 0, n, r)), this), this.#f = (e, n) => {
      let r = "", i = "";
      const s = e.children;
      if (s) {
        const l = s[0], a = s.at(-1);
        if (a && a.type === "text" && a.value.endsWith(" ")) {
          const u = a.value, c = u.trimEnd();
          i = u.slice(c.length), a.value = c;
        }
        if (l && l.type === "text" && l.value.startsWith(" ")) {
          const u = l.value, c = u.trimStart();
          r = u.slice(0, u.length - c.length), l.value = c;
        }
      }
      r.length && this.#c("text", void 0, r);
      const o = n();
      return i.length && this.#c("text", void 0, i), o;
    }, this.#u = (e = !1) => {
      const n = this.close(), r = () => this.#c(n.type, n.children, n.value, n.props);
      return e ? this.#f(n, r) : r();
    }, this.closeNode = () => (this.#u(), this), this.#c = (e, n, r, i) => {
      const s = mc.create(e, n, r, i), o = this.#l(this.#a(s));
      return this.push(o), o;
    }, this.addNode = (e, n, r, i) => (this.#c(e, n, r, i), this), this.#d = (e, n, r, i) => this.#t.some((s) => s.mark.eq(e)) ? this : (this.#t.push({
      mark: e,
      spanning: r == null
    }), this.openNode(n, r, {
      ...i,
      isMark: !0
    })), this.#h = (e) => {
      let n = -1;
      for (let r = this.#t.length - 1; r >= 0; r--) if (this.#t[r].mark.eq(e)) {
        n = r;
        break;
      }
      n < 0 || (this.#t.splice(n, 1), this.#u(!0));
    }, this.withMark = (e, n, r, i) => (this.#d(e, n, r, i), this), this.closeMark = (e) => (this.#h(e), this), this.build = () => {
      let e = null;
      do
        e = this.#u();
      while (this.size());
      return e.children || (e.children = []), e;
    }, this.next = (e) => db(e) ? (e.forEach((n, r, i) => {
      this.#i(n, e.maybeChild(i + 1) ?? void 0);
    }), this) : (this.#i(e), this), this.toString = (e) => e.stringify(this.build()), this.run = (e) => (this.#t = [], this.next(e), this), this.schema = t;
  }
  #e;
  #r;
  #n;
  #s;
  #o;
  #i;
  #l;
  #a;
  #f;
  #u;
  #c;
  #d;
  #h;
};
const je = function(t) {
  for (var e = 0; ; e++)
    if (t = t.previousSibling, !t)
      return e;
}, lr = function(t) {
  let e = t.assignedSlot || t.parentNode;
  return e && e.nodeType == 11 ? e.host : e;
};
let el = null;
const Ut = function(t, e, n) {
  let r = el || (el = document.createRange());
  return r.setEnd(t, n ?? t.nodeValue.length), r.setStart(t, e || 0), r;
}, mb = function() {
  el = null;
}, Wn = function(t, e, n, r) {
  return n && (gc(t, e, n, r, -1) || gc(t, e, n, r, 1));
}, gb = /^(img|br|input|textarea|hr)$/i;
function gc(t, e, n, r, i) {
  for (var s; ; ) {
    if (t == n && e == r)
      return !0;
    if (e == (i < 0 ? 0 : Ke(t))) {
      let o = t.parentNode;
      if (!o || !se(o) || si(t) || gb.test(t.nodeName) || t.contentEditable == "false")
        return !1;
      e = je(t) + (i < 0 ? 0 : 1), t = o;
    } else if (se(t)) {
      let o = t.childNodes[e + (i < 0 ? -1 : 0)];
      if (se(o) && o.contentEditable == "false")
        if (!((s = o.pmViewDesc) === null || s === void 0) && s.ignoreForSelection)
          e += i;
        else
          return !1;
      else
        t = o, e = i < 0 ? Ke(t) : 0;
    } else
      return !1;
  }
}
function Ke(t) {
  return t.nodeType == 3 ? t.nodeValue.length : t.childNodes.length;
}
function se(t) {
  return t.nodeType == 1;
}
function Le(t) {
  return t.nodeType == 3;
}
function Hn(t, e) {
  return e ? t.contains(se(e) ? e : e.parentNode) : !1;
}
function yb(t, e) {
  for (; ; ) {
    if (Le(t) && e)
      return t;
    if (se(t) && e > 0) {
      if (t.contentEditable == "false")
        return null;
      t = t.childNodes[e - 1], e = Ke(t);
    } else if (t.parentNode && !si(t))
      e = je(t), t = t.parentNode;
    else
      return null;
  }
}
function kb(t, e) {
  for (; ; ) {
    if (Le(t) && e < t.nodeValue.length)
      return t;
    if (se(t) && e < t.childNodes.length) {
      if (t.contentEditable == "false")
        return null;
      t = t.childNodes[e], e = 0;
    } else if (t.parentNode && !si(t))
      e = je(t) + 1, t = t.parentNode;
    else
      return null;
  }
}
function wb(t, e, n) {
  for (let r = e == 0, i = e == Ke(t); r || i; ) {
    if (t == n)
      return !0;
    let s = je(t);
    if (t = t.parentNode, !t)
      return !1;
    r = r && s == 0, i = i && s == Ke(t);
  }
}
function si(t) {
  let e;
  for (let n = t; n && !(e = n.pmViewDesc); n = n.parentNode)
    ;
  return e && e.node && e.node.isBlock && (e.dom == t || e.contentDOM == t);
}
const Ts = function(t) {
  return t.focusNode && Wn(t.focusNode, t.focusOffset, t.anchorNode, t.anchorOffset);
};
function An(t, e) {
  let n = document.createEvent("Event");
  return n.initEvent("keydown", !0, !0), n.keyCode = t, n.key = n.code = e, n;
}
function bb(t) {
  let e = t.activeElement;
  for (; e && e.shadowRoot; )
    e = e.shadowRoot.activeElement;
  return e;
}
function xb(t, e, n) {
  if (t.caretPositionFromPoint)
    try {
      let r = t.caretPositionFromPoint(e, n);
      if (r)
        return { node: r.offsetNode, offset: Math.min(Ke(r.offsetNode), r.offset) };
    } catch {
    }
  if (t.caretRangeFromPoint) {
    let r = t.caretRangeFromPoint(e, n);
    if (r)
      return { node: r.startContainer, offset: Math.min(Ke(r.startContainer), r.startOffset) };
  }
}
const Pt = typeof navigator < "u" ? navigator : null, yc = typeof document < "u" ? document : null, vn = Pt && Pt.userAgent || "", tl = /Edge\/(\d+)/.exec(vn), hd = /MSIE \d/.exec(vn), nl = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(vn), tt = !!(hd || nl || tl), dn = hd ? document.documentMode : nl ? +nl[1] : tl ? +tl[1] : 0, dt = !tt && /gecko\/(\d+)/i.test(vn);
dt && +(/Firefox\/(\d+)/.exec(vn) || [0, 0])[1];
const rl = !tt && /Chrome\/(\d+)/.exec(vn), We = !!rl, fd = rl ? +rl[1] : 0, Ge = !tt && !!Pt && /Apple Computer/.test(Pt.vendor), ar = Ge && (/Mobile\/\w+/.test(vn) || !!Pt && Pt.maxTouchPoints > 2), kt = ar || (Pt ? /Mac/.test(Pt.platform) : !1), dd = Pt ? /Win/.test(Pt.platform) : !1, Jt = /Android \d/.test(vn), As = !!yc && "webkitFontSmoothing" in yc.documentElement.style, Cb = As ? +(/\bAppleWebKit\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1] : 0;
function Sb(t) {
  let e = t.defaultView && t.defaultView.visualViewport;
  return e ? {
    left: 0,
    right: e.width,
    top: 0,
    bottom: e.height
  } : {
    left: 0,
    right: t.documentElement.clientWidth,
    top: 0,
    bottom: t.documentElement.clientHeight
  };
}
function Wt(t, e) {
  return typeof t == "number" ? t : t[e];
}
function vb(t) {
  let e = t.getBoundingClientRect(), n = e.width / t.offsetWidth || 1, r = e.height / t.offsetHeight || 1;
  return {
    left: e.left,
    right: e.left + t.clientWidth * n,
    top: e.top,
    bottom: e.top + t.clientHeight * r
  };
}
function kc(t, e, n) {
  if (!il(e) && e.left == 0)
    return;
  let r = t.someProp("scrollThreshold") || 0, i = t.someProp("scrollMargin") || 5, s = t.dom.ownerDocument;
  for (let o = n || t.dom; o; ) {
    if (!se(o)) {
      o = lr(o);
      continue;
    }
    let l = o == s.body, a = l ? Sb(s) : vb(o), u = 0, c = 0;
    if (e.top < a.top + Wt(r, "top") ? c = -(a.top - e.top + Wt(i, "top")) : e.bottom > a.bottom - Wt(r, "bottom") && (c = e.bottom - e.top > a.bottom - a.top ? e.top + Wt(i, "top") - a.top : e.bottom - a.bottom + Wt(i, "bottom")), e.left < a.left + Wt(r, "left") ? u = -(a.left - e.left + Wt(i, "left")) : e.right > a.right - Wt(r, "right") && (u = e.right - a.right + Wt(i, "right")), u || c)
      if (l)
        s.defaultView.scrollBy(u, c);
      else {
        let d = o.scrollLeft, f = o.scrollTop;
        c && (o.scrollTop += c), u && (o.scrollLeft += u);
        let p = o.scrollLeft - d, m = o.scrollTop - f;
        e = { left: e.left - p, top: e.top - m, right: e.right - p, bottom: e.bottom - m };
      }
    let h = l ? "fixed" : getComputedStyle(o).position;
    if (/^(fixed|sticky)$/.test(h))
      break;
    o = h == "absolute" ? o.offsetParent : lr(o);
  }
}
function Nb(t) {
  let e = t.dom.getBoundingClientRect(), n = Math.max(0, e.top), r, i;
  for (let s = (e.left + e.right) / 2, o = n + 1; o < Math.min(innerHeight, e.bottom); o += 5) {
    let l = t.root.elementFromPoint(s, o);
    if (!l || l == t.dom || !t.dom.contains(l))
      continue;
    let a = l.getBoundingClientRect();
    if (a.top >= n - 20) {
      r = l, i = a.top;
      break;
    }
  }
  return { refDOM: r, refTop: i, stack: pd(t.dom) };
}
function pd(t) {
  let e = [], n = t.ownerDocument;
  for (let r = t; r && (e.push({ dom: r, top: r.scrollTop, left: r.scrollLeft }), t != n); r = lr(r))
    ;
  return e;
}
function Ib({ refDOM: t, refTop: e, stack: n }) {
  let r = t ? t.getBoundingClientRect().top : 0;
  md(n, r == 0 ? 0 : r - e);
}
function md(t, e) {
  for (let n = 0; n < t.length; n++) {
    let { dom: r, top: i, left: s } = t[n];
    r.scrollTop != i + e && (r.scrollTop = i + e), r.scrollLeft != s && (r.scrollLeft = s);
  }
}
let Kn = null;
function _b(t) {
  if (t.setActive)
    return t.setActive();
  if (Kn)
    return t.focus(Kn);
  let e = pd(t);
  t.focus(Kn == null ? {
    get preventScroll() {
      return Kn = { preventScroll: !0 }, !0;
    }
  } : void 0), Kn || (Kn = !1, md(e, 0));
}
function gd(t, e) {
  let n, r = 2e8, i, s = 0, o = e.top, l = e.top, a, u;
  for (let c = t.firstChild, h = 0; c; c = c.nextSibling, h++) {
    let d;
    if (se(c))
      d = c.getClientRects();
    else if (Le(c))
      d = Ut(c).getClientRects();
    else
      continue;
    for (let f = 0; f < d.length; f++) {
      let p = d[f];
      if (p.top <= o && p.bottom >= l) {
        o = Math.max(p.bottom, o), l = Math.min(p.top, l);
        let m = p.left > e.left ? p.left - e.left : p.right < e.left ? e.left - p.right : 0;
        if (m < r) {
          n = c, r = m, i = m && Le(n) ? {
            left: p.right < e.left ? p.right : p.left,
            top: e.top
          } : e, se(c) && m && (s = h + (e.left >= (p.left + p.right) / 2 ? 1 : 0));
          continue;
        }
      } else p.top > e.top && !a && p.left <= e.left && p.right >= e.left && (a = c, u = { left: Math.max(p.left, Math.min(p.right, e.left)), top: p.top });
      !n && (e.left >= p.right && e.top >= p.top || e.left >= p.left && e.top >= p.bottom) && (s = h + 1);
    }
  }
  return !n && a && (n = a, i = u, r = 0), n && Le(n) ? Tb(n, i) : !n || r ? { node: t, offset: s } : gd(n, i);
}
function Tb(t, e) {
  let n = t.nodeValue.length, r = document.createRange(), i;
  for (let s = 0; s < n; s++) {
    r.setEnd(t, s + 1), r.setStart(t, s);
    let o = on(r, 1);
    if (o.top != o.bottom && Jl(e, o)) {
      i = { node: t, offset: s + (e.left >= (o.left + o.right) / 2 ? 1 : 0) };
      break;
    }
  }
  return r.detach(), i || { node: t, offset: 0 };
}
function Jl(t, e) {
  return t.left >= e.left - 1 && t.left <= e.right + 1 && t.top >= e.top - 1 && t.top <= e.bottom + 1;
}
function Ab(t, e) {
  let n = t.parentNode;
  return n && /^li$/i.test(n.nodeName) && e.left < t.getBoundingClientRect().left ? n : t;
}
function Eb(t, e, n) {
  let { node: r, offset: i } = gd(e, n), s = -1;
  if (se(r) && !r.firstChild) {
    let o = r.getBoundingClientRect();
    s = o.left != o.right && n.left > (o.left + o.right) / 2 ? 1 : -1;
  }
  return t.docView.posFromDOM(r, i, s);
}
function Mb(t, e, n, r) {
  let i = -1;
  for (let s = e, o = !1; s != t.dom; ) {
    let l = t.docView.nearestDesc(s, !0), a;
    if (!l)
      return null;
    if (se(l.dom) && (l.node.isBlock && l.parent || !l.contentDOM) && // Ignore elements with zero-size bounding rectangles
    ((a = l.dom.getBoundingClientRect()).width || a.height) && (l.node.isBlock && l.parent && !/^T(R|BODY|HEAD|FOOT)$/.test(l.dom.nodeName) && (!o && a.left > r.left || a.top > r.top ? i = l.posBefore : (!o && a.right < r.left || a.bottom < r.top) && (i = l.posAfter), o = !0), !l.contentDOM && i < 0 && !l.node.isText))
      return (l.node.isBlock ? r.top < (a.top + a.bottom) / 2 : r.left < (a.left + a.right) / 2) ? l.posBefore : l.posAfter;
    s = l.dom.parentNode;
  }
  return i > -1 ? i : t.docView.posFromDOM(e, n, -1);
}
function yd(t, e, n) {
  let r = t.childNodes.length;
  if (r && n.top < n.bottom)
    for (let i = Math.max(0, Math.min(r - 1, Math.floor(r * (e.top - n.top) / (n.bottom - n.top)) - 2)), s = i; ; ) {
      let o = t.childNodes[s];
      if (se(o)) {
        let l = o.getClientRects();
        for (let a = 0; a < l.length; a++) {
          let u = l[a];
          if (Jl(e, u))
            return yd(o, e, u);
        }
      }
      if ((s = (s + 1) % r) == i)
        break;
    }
  return t;
}
function Ob(t, e) {
  let n = t.dom.ownerDocument, r, i = 0, s = xb(n, e.left, e.top);
  s && ({ node: r, offset: i } = s);
  let o = (t.root.elementFromPoint ? t.root : n).elementFromPoint(e.left, e.top), l;
  if (!o || !t.dom.contains(o)) {
    let u = t.dom.getBoundingClientRect();
    if (!Jl(e, u) || (o = yd(t.dom, e, u), !o))
      return null;
  }
  if (Ge)
    for (let u = o; r && u; u = lr(u))
      u.draggable && (r = void 0);
  if (o = Ab(o, e), r) {
    if (dt && se(r) && (i = Math.min(i, r.childNodes.length), i < r.childNodes.length)) {
      let c = r.childNodes[i], h;
      c.nodeName == "IMG" && (h = c.getBoundingClientRect()).right <= e.left && h.bottom > e.top && i++;
    }
    let u;
    As && i && se(r) && se(u = r.childNodes[i - 1]) && u.contentEditable == "false" && u.getBoundingClientRect().top >= e.top && i--, r == t.dom && i == r.childNodes.length - 1 && se(r.lastChild) && e.top > r.lastChild.getBoundingClientRect().bottom ? l = t.state.doc.content.size : (i == 0 || !se(r) || r.childNodes[i - 1].nodeName != "BR") && (l = Mb(t, r, i, e));
  }
  l == null && (l = Eb(t, o, e));
  let a = t.docView.nearestDesc(o, !0);
  return { pos: l, inside: a ? a.posAtStart - a.border : -1 };
}
function il(t) {
  return t.top < t.bottom || t.left < t.right;
}
function on(t, e) {
  let n = t.getClientRects();
  if (n.length) {
    let r = n[e < 0 ? 0 : n.length - 1];
    if (il(r))
      return r;
  }
  return Array.prototype.find.call(n, il) || t.getBoundingClientRect();
}
const Db = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
function kd(t, e, n) {
  let { node: r, offset: i, atom: s } = t.docView.domFromPos(e, n < 0 ? -1 : 1), o = As || dt;
  if (Le(r))
    if (o && (Db.test(r.nodeValue) || (n < 0 ? !i : i == r.nodeValue.length))) {
      let a = on(Ut(r, i, i), n);
      if (dt && i && /\s/.test(r.nodeValue[i - 1]) && i < r.nodeValue.length) {
        let u = on(Ut(r, i - 1, i - 1), -1);
        if (u.top == a.top) {
          let c = on(Ut(r, i, i + 1), -1);
          if (c.top != a.top)
            return Sr(c, c.left < u.left);
        }
      }
      return a;
    } else {
      let a = i, u = i, c = n < 0 ? 1 : -1;
      return n < 0 && !i ? (u++, c = -1) : n >= 0 && i == r.nodeValue.length ? (a--, c = 1) : n < 0 ? a-- : u++, Sr(on(Ut(r, a, u), c), c < 0);
    }
  if (!t.state.doc.resolve(e - (s || 0)).parent.inlineContent) {
    if (s == null && i && (n < 0 || i == Ke(r))) {
      let a = r.childNodes[i - 1];
      if (se(a))
        return io(a.getBoundingClientRect(), !1);
    }
    if (s == null && i < Ke(r)) {
      let a = r.childNodes[i];
      if (se(a))
        return io(a.getBoundingClientRect(), !0);
    }
    return io(r.getBoundingClientRect(), n >= 0);
  }
  if (s == null && i && (n < 0 || i == Ke(r))) {
    let a = r.childNodes[i - 1], u = Le(a) ? Ut(a, Ke(a) - (o ? 0 : 1)) : se(a) && (a.nodeName != "BR" || !a.nextSibling) ? a : null;
    if (u)
      return Sr(on(u, 1), !1);
  }
  if (s == null && i < Ke(r)) {
    let a = r.childNodes[i];
    for (; a.pmViewDesc && a.pmViewDesc.ignoreForCoords; )
      a = a.nextSibling;
    let u = a ? Le(a) ? Ut(a, 0, o ? 0 : 1) : se(a) ? a : null : null;
    if (u)
      return Sr(on(u, -1), !0);
  }
  return Sr(on(Le(r) ? Ut(r) : r, -n), n >= 0);
}
function Sr(t, e) {
  if (t.width == 0)
    return t;
  let n = e ? t.left : t.right;
  return { top: t.top, bottom: t.bottom, left: n, right: n };
}
function io(t, e) {
  if (t.height == 0)
    return t;
  let n = e ? t.top : t.bottom;
  return { top: n, bottom: n, left: t.left, right: t.right };
}
function wd(t, e, n) {
  let r = t.state, i = t.root.activeElement;
  r != e && t.updateState(e), i != t.dom && t.focus();
  try {
    return n();
  } finally {
    r != e && t.updateState(r), i != t.dom && i && i.focus();
  }
}
function Rb(t, e, n) {
  let r = e.selection, i = n == "up" ? r.$from : r.$to;
  return wd(t, e, () => {
    let { node: s } = t.docView.domFromPos(i.pos, n == "up" ? -1 : 1);
    for (; ; ) {
      let l = t.docView.nearestDesc(s, !0);
      if (!l)
        break;
      if (l.node.isBlock) {
        s = l.contentDOM || l.dom;
        break;
      }
      s = l.dom.parentNode;
    }
    let o = kd(t, i.pos, 1);
    for (let l = s.firstChild; l; l = l.nextSibling) {
      let a;
      if (se(l))
        a = l.getClientRects();
      else if (Le(l))
        a = Ut(l, 0, l.nodeValue.length).getClientRects();
      else
        continue;
      for (let u = 0; u < a.length; u++) {
        let c = a[u];
        if (c.bottom > c.top + 1 && (n == "up" ? o.top - c.top > (c.bottom - o.top) * 2 : c.bottom - o.bottom > (o.bottom - c.top) * 2))
          return !1;
      }
    }
    return !0;
  });
}
const zb = /[\u0590-\u08ac]/;
function Pb(t, e, n) {
  let { $head: r } = e.selection;
  if (!r.parent.isTextblock)
    return !1;
  let i = r.parentOffset, s = !i, o = i == r.parent.content.size, l = t.domSelection();
  return l ? !zb.test(r.parent.textContent) || !l.modify ? n == "left" || n == "backward" ? s : o : wd(t, e, () => {
    let { focusNode: a, focusOffset: u, anchorNode: c, anchorOffset: h } = t.domSelectionRange(), d = l.caretBidiLevel;
    l.modify("move", n, "character");
    let f = r.depth ? t.docView.domAfterPos(r.before()) : t.dom, { focusNode: p, focusOffset: m } = t.domSelectionRange(), y = p && !Hn(f, p) || a == p && u == m;
    try {
      l.collapse(c, h), a && (a != c || u != h) && l.extend && l.extend(a, u);
    } catch {
    }
    return d != null && (l.caretBidiLevel = d), y;
  }) : r.pos == r.start() || r.pos == r.end();
}
let wc = null, bc = null, xc = !1;
function Lb(t, e, n) {
  return wc == e && bc == n ? xc : (wc = e, bc = n, xc = n == "up" || n == "down" ? Rb(t, e, n) : Pb(t, e, n));
}
const xt = 0, Cc = 1, Mn = 2, Et = 3;
class oi {
  constructor(e, n, r, i) {
    this.parent = e, this.children = n, this.dom = r, this.contentDOM = i, this.dirty = xt, r.pmViewDesc = this;
  }
  // Used to check whether a given description corresponds to a
  // widget/mark/node.
  matchesWidget(e) {
    return !1;
  }
  matchesMark(e) {
    return !1;
  }
  matchesNode(e, n, r) {
    return !1;
  }
  matchesHack(e) {
    return !1;
  }
  // When parsing in-editor content (in domchange.js), we allow
  // descriptions to determine the parse rules that should be used to
  // parse them.
  parseRule(e) {
    return null;
  }
  // Used by the editor's event handler to ignore events that come
  // from certain descs.
  stopEvent(e) {
    return !1;
  }
  // The size of the content represented by this desc.
  get size() {
    let e = 0;
    for (let n = 0; n < this.children.length; n++)
      e += this.children[n].size;
    return e;
  }
  // For block nodes, this represents the space taken up by their
  // start/end tokens.
  get border() {
    return 0;
  }
  destroy() {
    this.parent = void 0, this.dom.pmViewDesc == this && (this.dom.pmViewDesc = void 0);
    for (let e = 0; e < this.children.length; e++)
      this.children[e].destroy();
  }
  posBeforeChild(e) {
    for (let n = 0, r = this.posAtStart; ; n++) {
      let i = this.children[n];
      if (i == e)
        return r;
      r += i.size;
    }
  }
  get posBefore() {
    return this.parent.posBeforeChild(this);
  }
  get posAtStart() {
    return this.parent ? this.parent.posBeforeChild(this) + this.border : 0;
  }
  get posAfter() {
    return this.posBefore + this.size;
  }
  get posAtEnd() {
    return this.posAtStart + this.size - 2 * this.border;
  }
  localPosFromDOM(e, n, r) {
    if (this.contentDOM && Hn(this.contentDOM, e))
      if (r < 0) {
        let s, o;
        if (e == this.contentDOM)
          s = e.childNodes[n - 1];
        else {
          for (; e.parentNode != this.contentDOM; )
            e = e.parentNode;
          s = e.previousSibling;
        }
        for (; s && !((o = s.pmViewDesc) && o.parent == this); )
          s = s.previousSibling;
        return s ? this.posBeforeChild(o) + o.size : this.posAtStart;
      } else {
        let s, o;
        if (e == this.contentDOM)
          s = e.childNodes[n];
        else {
          for (; e.parentNode != this.contentDOM; )
            e = e.parentNode;
          s = e.nextSibling;
        }
        for (; s && !((o = s.pmViewDesc) && o.parent == this); )
          s = s.nextSibling;
        return s ? this.posBeforeChild(o) : this.posAtEnd;
      }
    let i;
    if (e == this.dom && this.contentDOM)
      i = n > je(this.contentDOM);
    else if (this.contentDOM && this.contentDOM != this.dom && this.dom.contains(this.contentDOM))
      i = !!(e.compareDocumentPosition(this.contentDOM) & 4);
    else if (this.dom.firstChild) {
      if (n == 0)
        for (let s = e; ; s = s.parentNode) {
          if (s == this.dom) {
            i = !1;
            break;
          }
          if (s.previousSibling)
            break;
        }
      if (i == null && n == e.childNodes.length)
        for (let s = e; ; s = s.parentNode) {
          if (s == this.dom) {
            i = !0;
            break;
          }
          if (s.nextSibling)
            break;
        }
    }
    return i ?? r > 0 ? this.posAtEnd : this.posAtStart;
  }
  nearestDesc(e, n = !1) {
    for (let r = !0, i = e; i; i = i.parentNode) {
      let s = this.getDesc(i), o;
      if (s && (!n || s.node))
        if (r && (o = s.nodeDOM) && !(se(o) ? Hn(o, e) : o == e))
          r = !1;
        else
          return s;
    }
  }
  getDesc(e) {
    let n = e.pmViewDesc;
    for (let r = n; r; r = r.parent)
      if (r == this)
        return n;
  }
  posFromDOM(e, n, r) {
    for (let i = e; i; i = i.parentNode) {
      let s = this.getDesc(i);
      if (s)
        return s.localPosFromDOM(e, n, r);
    }
    return -1;
  }
  // Find the desc for the node after the given pos, if any. (When a
  // parent node overrode rendering, there might not be one.)
  descAt(e) {
    for (let n = 0, r = 0; n < this.children.length; n++) {
      let i = this.children[n], s = r + i.size;
      if (r == e && s != r) {
        for (; !i.border && i.children.length; )
          for (let o = 0; o < i.children.length; o++) {
            let l = i.children[o];
            if (l.size) {
              i = l;
              break;
            }
          }
        return i;
      }
      if (e < s)
        return i.descAt(e - r - i.border);
      r = s;
    }
  }
  domFromPos(e, n) {
    if (!this.contentDOM)
      return { node: this.dom, offset: 0, atom: e + 1 };
    let r = 0, i = 0;
    for (let s = 0; r < this.children.length; r++) {
      let o = this.children[r], l = s + o.size;
      if (l > e) {
        i = e - s;
        break;
      }
      s = l;
    }
    if (i)
      return this.children[r].domFromPos(i - this.children[r].border, n);
    for (; r > 0; r--) {
      let s = this.children[r - 1];
      if (s.size || !(s instanceof xd || s instanceof bd && s.side >= 0))
        break;
    }
    if (n <= 0) {
      let s, o = !0;
      for (; s = r ? this.children[r - 1] : null, !(!s || s.dom.parentNode == this.contentDOM); r--, o = !1)
        ;
      return s && n && o && !s.border && !s.domAtom ? s.domFromPos(s.size, n) : { node: this.contentDOM, offset: s ? je(s.dom) + 1 : 0 };
    } else {
      let s, o = !0;
      for (; s = r < this.children.length ? this.children[r] : null, !(!s || s.dom.parentNode == this.contentDOM); r++, o = !1)
        ;
      return s && o && !s.border && !s.domAtom ? s.domFromPos(0, n) : { node: this.contentDOM, offset: s ? je(s.dom) : this.contentDOM.childNodes.length };
    }
  }
  // Used to find a DOM range in a single parent for a given changed
  // range.
  parseRange(e, n, r = 0) {
    if (this.children.length == 0)
      return { node: this.contentDOM, from: e, to: n, fromOffset: 0, toOffset: this.contentDOM.childNodes.length };
    let i = -1, s = -1;
    for (let o = r, l = 0; ; l++) {
      let a = this.children[l], u = o + a.size;
      if (i == -1 && e <= u) {
        let c = o + a.border;
        if (e >= c && n <= u - a.border && a.node && a.contentDOM && this.contentDOM.contains(a.contentDOM))
          return a.parseRange(e, n, c);
        e = o;
        for (let h = l; h > 0; h--) {
          let d = this.children[h - 1];
          if (d.size && d.dom.parentNode == this.contentDOM && !d.emptyChildAt(1)) {
            i = je(d.dom) + 1;
            break;
          }
          e -= d.size;
        }
        i == -1 && (i = 0);
      }
      if (i > -1 && (u > n || l == this.children.length - 1)) {
        n = u;
        for (let c = l + 1; c < this.children.length; c++) {
          let h = this.children[c];
          if (h.size && h.dom.parentNode == this.contentDOM && !h.emptyChildAt(-1)) {
            s = je(h.dom);
            break;
          }
          n += h.size;
        }
        s == -1 && (s = this.contentDOM.childNodes.length);
        break;
      }
      o = u;
    }
    return { node: this.contentDOM, from: e, to: n, fromOffset: i, toOffset: s };
  }
  emptyChildAt(e) {
    if (this.border || !this.contentDOM || !this.children.length)
      return !1;
    let n = this.children[e < 0 ? 0 : this.children.length - 1];
    return n.size == 0 || n.emptyChildAt(e);
  }
  domAfterPos(e) {
    let { node: n, offset: r } = this.domFromPos(e, 0);
    if (!se(n) || r == n.childNodes.length)
      throw new RangeError("No node after pos " + e);
    return n.childNodes[r];
  }
  // View descs are responsible for setting any selection that falls
  // entirely inside of them, so that custom implementations can do
  // custom things with the selection. Note that this falls apart when
  // a selection starts in such a node and ends in another, in which
  // case we just use whatever domFromPos produces as a best effort.
  setSelection(e, n, r, i = !1) {
    let s = Math.min(e, n), o = Math.max(e, n);
    for (let f = 0, p = 0; f < this.children.length; f++) {
      let m = this.children[f], y = p + m.size;
      if (s > p && o < y)
        return m.setSelection(e - p - m.border, n - p - m.border, r, i);
      p = y;
    }
    let l = this.domFromPos(e, e ? -1 : 1), a = n == e ? l : this.domFromPos(n, n ? -1 : 1), u = r.root.getSelection(), c = r.domSelectionRange(), h = !1;
    if ((dt || Ge) && e == n) {
      let { node: f, offset: p } = l;
      if (Le(f)) {
        if (h = !!(p && f.nodeValue[p - 1] == `
`), h && p == f.nodeValue.length)
          for (let m = f, y; m; m = m.parentNode) {
            if (y = m.nextSibling) {
              y.nodeName == "BR" && (l = a = { node: y.parentNode, offset: je(y) + 1 });
              break;
            }
            let g = m.pmViewDesc;
            if (g && g.node && g.node.isBlock)
              break;
          }
      } else {
        let m = f.childNodes[p - 1];
        h = m && (m.nodeName == "BR" || m.contentEditable == "false");
      }
    }
    if (dt && c.focusNode && c.focusNode != a.node && se(c.focusNode)) {
      let f = c.focusNode.childNodes[c.focusOffset];
      f && f.contentEditable == "false" && (i = !0);
    }
    if (!(i || h && Ge) && Wn(l.node, l.offset, c.anchorNode, c.anchorOffset) && Wn(a.node, a.offset, c.focusNode, c.focusOffset))
      return;
    let d = !1;
    if ((u.extend || e == n) && !(h && dt)) {
      u.collapse(l.node, l.offset);
      try {
        e != n && u.extend(a.node, a.offset), d = !0;
      } catch {
      }
    }
    if (!d) {
      if (e > n) {
        let p = l;
        l = a, a = p;
      }
      let f = document.createRange();
      f.setEnd(a.node, a.offset), f.setStart(l.node, l.offset), u.removeAllRanges(), u.addRange(f);
    }
  }
  ignoreMutation(e) {
    return !this.contentDOM && e.type != "selection";
  }
  get contentLost() {
    return this.contentDOM && this.contentDOM != this.dom && !this.dom.contains(this.contentDOM);
  }
  // Remove a subtree of the element tree that has been touched
  // by a DOM change, so that the next update will redraw it.
  markDirty(e, n) {
    for (let r = 0, i = 0; i < this.children.length; i++) {
      let s = this.children[i], o = r + s.size;
      if (r == o ? e <= o && n >= r : e < o && n > r) {
        let l = r + s.border, a = o - s.border;
        if (e >= l && n <= a) {
          this.dirty = e == r || n == o ? Mn : Cc, e == l && n == a && (s.contentLost || s.dom.parentNode != this.contentDOM) ? s.dirty = Et : s.markDirty(e - l, n - l);
          return;
        } else
          s.dirty = s.dom == s.contentDOM && s.dom.parentNode == this.contentDOM && !s.children.length ? Mn : Et;
      }
      r = o;
    }
    this.dirty = Mn;
  }
  markParentsDirty() {
    let e = 1;
    for (let n = this.parent; n; n = n.parent, e++) {
      let r = e == 1 ? Mn : Cc;
      n.dirty < r && (n.dirty = r);
    }
  }
  get domAtom() {
    return !1;
  }
  get ignoreForCoords() {
    return !1;
  }
  get ignoreForSelection() {
    return !1;
  }
  isText(e) {
    return !1;
  }
}
class bd extends oi {
  constructor(e, n, r, i) {
    let s, o = n.type.toDOM;
    if (typeof o == "function" && (o = o(r, () => {
      if (!s)
        return i;
      if (s.parent)
        return s.parent.posBeforeChild(s);
    })), !n.type.spec.raw) {
      let l = se(o) ? o : document.createElement("span");
      l != o && l.appendChild(o), l.hasAttribute("contenteditable") || (l.contentEditable = "false"), l.classList.add("ProseMirror-widget");
    }
    super(e, [], o, null), this.widget = n, this.widget = n, s = this;
  }
  matchesWidget(e) {
    return this.dirty == xt && e.type.eq(this.widget.type);
  }
  parseRule() {
    return { ignore: !0 };
  }
  stopEvent(e) {
    let n = this.widget.spec.stopEvent;
    return n ? n(e) : !1;
  }
  ignoreMutation(e) {
    return e.type != "selection" || this.widget.spec.ignoreSelection;
  }
  destroy() {
    this.widget.type.destroy(this.dom), super.destroy();
  }
  get domAtom() {
    return !0;
  }
  get ignoreForSelection() {
    return !!this.widget.type.spec.relaxedSide;
  }
  get side() {
    return this.widget.type.side;
  }
}
class Bb extends oi {
  constructor(e, n, r, i) {
    super(e, [], n, null), this.textDOM = r, this.text = i;
  }
  get size() {
    return this.text.length;
  }
  localPosFromDOM(e, n) {
    return e != this.textDOM ? this.posAtStart + (n ? this.size : 0) : this.posAtStart + n;
  }
  domFromPos(e) {
    return { node: this.textDOM, offset: e };
  }
  ignoreMutation(e) {
    return e.type === "characterData" && e.target.nodeValue == e.oldValue;
  }
}
class pn extends oi {
  constructor(e, n, r, i, s) {
    super(e, [], r, i), this.mark = n, this.spec = s;
  }
  static create(e, n, r, i) {
    let s = i.nodeViews[n.type.name], o = s && s(n, i, r);
    return (!o || !o.dom) && (o = fr.renderSpec(document, n.type.spec.toDOM(n, r), null, n.attrs)), new pn(e, n, o.dom, o.contentDOM || o.dom, o);
  }
  parseRule() {
    return this.dirty & Et || this.mark.type.spec.reparseInView ? null : { mark: this.mark.type.name, attrs: this.mark.attrs, contentElement: this.contentDOM };
  }
  matchesMark(e) {
    return this.dirty != Et && this.mark.eq(e);
  }
  markDirty(e, n) {
    if (super.markDirty(e, n), this.dirty != xt) {
      let r = this.parent;
      for (; !r.node; )
        r = r.parent;
      r.dirty < this.dirty && (r.dirty = this.dirty), this.dirty = xt;
    }
  }
  slice(e, n, r) {
    let i = pn.create(this.parent, this.mark, !0, r), s = this.children, o = this.size;
    n < o && (s = ol(s, n, o, r)), e > 0 && (s = ol(s, 0, e, r));
    for (let l = 0; l < s.length; l++)
      s[l].parent = i;
    return i.children = s, i;
  }
  ignoreMutation(e) {
    return this.spec.ignoreMutation ? this.spec.ignoreMutation(e) : super.ignoreMutation(e);
  }
  destroy() {
    this.spec.destroy && this.spec.destroy(), super.destroy();
  }
}
class mn extends oi {
  constructor(e, n, r, i, s, o, l) {
    super(e, [], s, o), this.node = n, this.outerDeco = r, this.innerDeco = i, this.nodeDOM = l;
  }
  // By default, a node is rendered using the `toDOM` method from the
  // node type spec. But client code can use the `nodeViews` spec to
  // supply a custom node view, which can influence various aspects of
  // the way the node works.
  //
  // (Using subclassing for this was intentionally decided against,
  // since it'd require exposing a whole slew of finicky
  // implementation details to the user code that they probably will
  // never need.)
  static create(e, n, r, i, s, o) {
    let l = s.nodeViews[n.type.name], a, u = l && l(n, s, () => {
      if (!a)
        return o;
      if (a.parent)
        return a.parent.posBeforeChild(a);
    }, r, i), c = u && u.dom, h = u && u.contentDOM;
    if (n.isText) {
      if (!c)
        c = document.createTextNode(n.text);
      else if (!Le(c))
        throw new RangeError("Text must be rendered as a DOM text node");
    } else c || ({ dom: c, contentDOM: h } = fr.renderSpec(document, n.type.spec.toDOM(n), null, n.attrs));
    !h && !n.isText && c.nodeName != "BR" && (c.hasAttribute("contenteditable") || (c.contentEditable = "false"), n.type.spec.draggable && (c.draggable = !0));
    let d = c;
    return c = vd(c, r, n), u ? a = new Fb(e, n, r, i, c, h || null, d, u) : n.isText ? new Es(e, n, r, i, c, d) : new mn(e, n, r, i, c, h || null, d);
  }
  parseRule(e) {
    if (this.node.type.spec.reparseInView)
      return null;
    let n = { node: this.node.type.name, attrs: this.node.attrs };
    if (this.node.type.whitespace == "pre" && (n.preserveWhitespace = "full"), !this.contentDOM)
      n.getContent = () => this.node.content;
    else if (!this.contentLost)
      n.contentElement = this.contentDOM;
    else {
      for (let r = this.children.length - 1; r >= 0; r--) {
        let i = this.children[r];
        if (this.dom.contains(i.dom.parentNode)) {
          n.contentElement = i.dom.parentNode;
          break;
        }
      }
      if (!n.contentElement) {
        let r = e && e.find((i) => se(i) && e.indexOf(i.parentNode) < 0 && this.dom.contains(i));
        r ? n.contentElement = r : n.getContent = () => K.empty;
      }
    }
    return n;
  }
  matchesNode(e, n, r) {
    return this.dirty == xt && e.eq(this.node) && ss(n, this.outerDeco) && r.eq(this.innerDeco);
  }
  get size() {
    return this.node.nodeSize;
  }
  get border() {
    return this.node.isLeaf ? 0 : 1;
  }
  // Syncs `this.children` to match `this.node.content` and the local
  // decorations, possibly introducing nesting for marks. Then, in a
  // separate step, syncs the DOM inside `this.contentDOM` to
  // `this.children`.
  updateChildren(e, n) {
    let r = this.node.inlineContent, i = n, s = e.composing ? this.localCompositionInfo(e, n) : null, o = s && s.pos > -1 ? s : null, l = s && s.pos < 0, a = new jb(this, o && o.node, e), u = this.node.inlineContent, c = u && this.node.isBlock;
    Hb(this.node, this.innerDeco, (h, d, f) => {
      h.spec.marks ? a.syncToMarks(h.spec.marks, r, e, d) : h.type.side >= 0 && !f && a.syncToMarks(d == this.node.childCount ? be.none : this.node.child(d).marks, r, e, d), a.placeWidget(h, e, i);
    }, (h, d, f, p) => {
      a.syncToMarks(h.marks, r, e, p), c && h.isAtom && !h.isText && a.addHackNode("IMG", a.top);
      let m;
      a.findNodeMatch(h, d, f, p) || l && e.state.selection.from > i && e.state.selection.to < i + h.nodeSize && (m = a.findIndexWithChild(s.node)) > -1 && a.updateNodeAt(h, d, f, m, e) || a.updateNextNode(h, d, f, e, p, i) || a.addNode(h, d, f, e, i), i += h.nodeSize, u && (c = h.isAtom && !h.isText);
    }), a.syncToMarks([], r, e, 0), this.node.isTextblock && a.addTextblockHacks(), a.destroyRest(), (a.changed || this.dirty == Mn) && (o && this.protectLocalComposition(e, o), Cd(this.contentDOM, this.children, e), ar && Ub(this.dom));
  }
  localCompositionInfo(e, n) {
    let { from: r, to: i } = e.state.selection;
    if (!(e.state.selection instanceof pe) || r < n || i > n + this.node.content.size)
      return null;
    let s = e.input.compositionNode;
    if (!s || !this.dom.contains(s.parentNode))
      return null;
    if (this.node.inlineContent) {
      let o = s.nodeValue, l = qb(this.node.content, o, r - n, i - n);
      return l < 0 ? null : { node: s, pos: l, text: o };
    } else
      return { node: s, pos: -1, text: "" };
  }
  protectLocalComposition(e, { node: n, pos: r, text: i }) {
    if (this.getDesc(n))
      return;
    let s = n;
    for (; s.parentNode != this.contentDOM; s = s.parentNode) {
      for (; s.previousSibling; )
        s.parentNode.removeChild(s.previousSibling);
      for (; s.nextSibling; )
        s.parentNode.removeChild(s.nextSibling);
      s.pmViewDesc && (s.pmViewDesc = void 0);
    }
    let o = new Bb(this, s, n, i);
    e.input.compositionNodes.push(o), this.children = ol(this.children, r, r + i.length, e, o);
  }
  // If this desc must be updated to match the given node decoration,
  // do so and return true.
  update(e, n, r, i) {
    return this.dirty == Et || !e.sameMarkup(this.node) ? !1 : (this.updateInner(e, n, r, i), !0);
  }
  updateInner(e, n, r, i) {
    this.updateOuterDeco(n), this.node = e, this.innerDeco = r, this.contentDOM && this.updateChildren(i, this.posAtStart), this.dirty = xt;
  }
  updateOuterDeco(e) {
    if (ss(e, this.outerDeco))
      return;
    let n = !se(this.nodeDOM), r = this.dom;
    this.dom = Sd(this.dom, this.nodeDOM, sl(this.outerDeco, this.node, n), sl(e, this.node, n)), this.dom != r && (r.pmViewDesc = void 0, this.dom.pmViewDesc = this), this.outerDeco = e;
  }
  // Mark this node as being the selected node.
  selectNode() {
    se(this.nodeDOM) && (this.nodeDOM.classList.add("ProseMirror-selectednode"), (this.contentDOM || !this.node.type.spec.draggable) && (this.nodeDOM.draggable = !0));
  }
  // Remove selected node marking from this node.
  deselectNode() {
    se(this.nodeDOM) && (this.nodeDOM.classList.remove("ProseMirror-selectednode"), (this.contentDOM || !this.node.type.spec.draggable) && this.nodeDOM.removeAttribute("draggable"));
  }
  get domAtom() {
    return this.node.isAtom;
  }
}
function Sc(t, e, n, r, i) {
  vd(r, e, t);
  let s = new mn(void 0, t, e, n, r, r, r);
  return s.contentDOM && s.updateChildren(i, 0), s;
}
class Es extends mn {
  constructor(e, n, r, i, s, o) {
    super(e, n, r, i, s, null, o);
  }
  parseRule() {
    let e = this.nodeDOM.parentNode;
    for (; e && e != this.dom && !e.pmIsDeco; )
      e = e.parentNode;
    return { skip: e || !0 };
  }
  update(e, n, r, i) {
    return this.dirty == Et || this.dirty != xt && !this.inParent() || !e.sameMarkup(this.node) ? !1 : (this.updateOuterDeco(n), (this.dirty != xt || e.text != this.node.text) && e.text != this.nodeDOM.nodeValue && (this.nodeDOM.nodeValue = e.text, i.trackWrites == this.nodeDOM && (i.trackWrites = null)), this.node = e, this.dirty = xt, !0);
  }
  inParent() {
    let e = this.parent.contentDOM;
    for (let n = this.nodeDOM; n; n = n.parentNode)
      if (n == e)
        return !0;
    return !1;
  }
  domFromPos(e) {
    return { node: this.nodeDOM, offset: e };
  }
  localPosFromDOM(e, n, r) {
    return e == this.nodeDOM ? this.posAtStart + Math.min(n, this.node.text.length) : super.localPosFromDOM(e, n, r);
  }
  ignoreMutation(e) {
    return e.type != "characterData" && e.type != "selection";
  }
  slice(e, n, r) {
    let i = this.node.cut(e, n), s = document.createTextNode(i.text);
    return new Es(this.parent, i, this.outerDeco, this.innerDeco, s, s);
  }
  markDirty(e, n) {
    super.markDirty(e, n), this.dom != this.nodeDOM && (e == 0 || n == this.nodeDOM.nodeValue.length) && (this.dirty = Et);
  }
  get domAtom() {
    return !1;
  }
  isText(e) {
    return this.node.text == e;
  }
}
class xd extends oi {
  parseRule() {
    return { ignore: !0 };
  }
  matchesHack(e) {
    return this.dirty == xt && this.dom.nodeName == e;
  }
  get domAtom() {
    return !0;
  }
  get ignoreForCoords() {
    return this.dom.nodeName == "IMG";
  }
}
class Fb extends mn {
  constructor(e, n, r, i, s, o, l, a) {
    super(e, n, r, i, s, o, l), this.spec = a;
  }
  // A custom `update` method gets to decide whether the update goes
  // through. If it does, and there's a `contentDOM` node, our logic
  // updates the children.
  update(e, n, r, i) {
    if (this.dirty == Et)
      return !1;
    if (this.spec.update && (this.node.type == e.type || this.spec.multiType)) {
      let s = this.spec.update(e, n, r);
      return s && this.updateInner(e, n, r, i), s;
    } else return !this.contentDOM && !e.isLeaf ? !1 : super.update(e, n, r, i);
  }
  selectNode() {
    this.spec.selectNode ? this.spec.selectNode() : super.selectNode();
  }
  deselectNode() {
    this.spec.deselectNode ? this.spec.deselectNode() : super.deselectNode();
  }
  setSelection(e, n, r, i) {
    this.spec.setSelection ? this.spec.setSelection(e, n, r.root) : super.setSelection(e, n, r, i);
  }
  destroy() {
    this.spec.destroy && this.spec.destroy(), super.destroy();
  }
  stopEvent(e) {
    return this.spec.stopEvent ? this.spec.stopEvent(e) : !1;
  }
  ignoreMutation(e) {
    return this.spec.ignoreMutation ? this.spec.ignoreMutation(e) : super.ignoreMutation(e);
  }
}
function Cd(t, e, n) {
  let r = t.firstChild, i = !1;
  for (let s = 0; s < e.length; s++) {
    let o = e[s], l = o.dom;
    if (l.parentNode == t) {
      for (; l != r; )
        r = vc(r), i = !0;
      r = r.nextSibling;
    } else
      i = !0, t.insertBefore(l, r);
    if (o instanceof pn) {
      let a = r ? r.previousSibling : t.lastChild;
      Cd(o.contentDOM, o.children, n), r = a ? a.nextSibling : t.firstChild;
    }
  }
  for (; r; )
    r = vc(r), i = !0;
  i && n.trackWrites == t && (n.trackWrites = null);
}
const Pr = function(t) {
  t && (this.nodeName = t);
};
Pr.prototype = /* @__PURE__ */ Object.create(null);
const On = [new Pr()];
function sl(t, e, n) {
  if (t.length == 0)
    return On;
  let r = n ? On[0] : new Pr(), i = [r];
  for (let s = 0; s < t.length; s++) {
    let o = t[s].type.attrs;
    if (o) {
      o.nodeName && i.push(r = new Pr(o.nodeName));
      for (let l in o) {
        let a = o[l];
        a != null && (n && i.length == 1 && i.push(r = new Pr(e.isInline ? "span" : "div")), l == "class" ? r.class = (r.class ? r.class + " " : "") + a : l == "style" ? r.style = (r.style ? r.style + ";" : "") + a : l != "nodeName" && (r[l] = a));
      }
    }
  }
  return i;
}
function Sd(t, e, n, r) {
  if (n == On && r == On)
    return e;
  let i = e;
  for (let s = 0; s < r.length; s++) {
    let o = r[s], l = n[s];
    if (s) {
      let a;
      l && l.nodeName == o.nodeName && i != t && (a = i.parentNode) && a.nodeName.toLowerCase() == o.nodeName || (a = document.createElement(o.nodeName), a.pmIsDeco = !0, a.appendChild(i), l = On[0]), i = a;
    }
    $b(i, l || On[0], o);
  }
  return i;
}
function $b(t, e, n) {
  for (let r in e)
    r != "class" && r != "style" && r != "nodeName" && !(r in n) && t.removeAttribute(r);
  for (let r in n)
    r != "class" && r != "style" && r != "nodeName" && n[r] != e[r] && t.setAttribute(r, n[r]);
  if (e.class != n.class) {
    let r = e.class ? e.class.split(" ").filter(Boolean) : [], i = n.class ? n.class.split(" ").filter(Boolean) : [];
    for (let s = 0; s < r.length; s++)
      i.indexOf(r[s]) == -1 && t.classList.remove(r[s]);
    for (let s = 0; s < i.length; s++)
      r.indexOf(i[s]) == -1 && t.classList.add(i[s]);
    t.classList.length == 0 && t.removeAttribute("class");
  }
  if (e.style != n.style) {
    if (e.style) {
      let r = /\s*([\w\-\xa1-\uffff]+)\s*:(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\(.*?\)|[^;])*/g, i;
      for (; i = r.exec(e.style); )
        t.style.removeProperty(i[1]);
    }
    n.style && (t.style.cssText += n.style);
  }
}
function vd(t, e, n) {
  return Sd(t, t, On, sl(e, n, !se(t)));
}
function ss(t, e) {
  if (t.length != e.length)
    return !1;
  for (let n = 0; n < t.length; n++)
    if (!t[n].type.eq(e[n].type))
      return !1;
  return !0;
}
function vc(t) {
  let e = t.nextSibling;
  return t.parentNode.removeChild(t), e;
}
class jb {
  constructor(e, n, r) {
    this.lock = n, this.view = r, this.index = 0, this.stack = [], this.changed = !1, this.top = e, this.preMatch = Vb(e.node.content, e);
  }
  // Destroy and remove the children between the given indices in
  // `this.top`.
  destroyBetween(e, n) {
    if (e != n) {
      for (let r = e; r < n; r++)
        this.top.children[r].destroy();
      this.top.children.splice(e, n - e), this.changed = !0;
    }
  }
  // Destroy all remaining children in `this.top`.
  destroyRest() {
    this.destroyBetween(this.index, this.top.children.length);
  }
  // Sync the current stack of mark descs with the given array of
  // marks, reusing existing mark descs when possible.
  syncToMarks(e, n, r, i) {
    let s = 0, o = this.stack.length >> 1, l = Math.min(o, e.length);
    for (; s < l && (s == o - 1 ? this.top : this.stack[s + 1 << 1]).matchesMark(e[s]) && e[s].type.spec.spanning !== !1; )
      s++;
    for (; s < o; )
      this.destroyRest(), this.top.dirty = xt, this.index = this.stack.pop(), this.top = this.stack.pop(), o--;
    for (; o < e.length; ) {
      this.stack.push(this.top, this.index + 1);
      let a = -1, u = this.top.children.length;
      i < this.preMatch.index && (u = Math.min(this.index + 3, u));
      for (let c = this.index; c < u; c++) {
        let h = this.top.children[c];
        if (h.matchesMark(e[o]) && !this.isLocked(h.dom)) {
          a = c;
          break;
        }
      }
      if (a < 0 && this.index < this.top.children.length) {
        let c = this.top.children[this.index];
        c instanceof pn && c.dirty != Et && c.mark.type == e[o].type && c.spec.update && !this.isLocked(c.dom) && c.spec.update(e[o]) && (c.mark = e[o], a = this.index, this.changed = !0);
      }
      if (a > -1)
        a > this.index && (this.changed = !0, this.destroyBetween(this.index, a)), this.top = this.top.children[this.index];
      else {
        let c = pn.create(this.top, e[o], n, r);
        this.top.children.splice(this.index, 0, c), this.top = c, this.changed = !0;
      }
      this.index = 0, o++;
    }
  }
  // Try to find a node desc matching the given data. Skip over it and
  // return true when successful.
  findNodeMatch(e, n, r, i) {
    let s = -1, o;
    if (i >= this.preMatch.index && (o = this.preMatch.matches[i - this.preMatch.index]).parent == this.top && o.matchesNode(e, n, r))
      s = this.top.children.indexOf(o, this.index);
    else
      for (let l = this.index, a = Math.min(this.top.children.length, l + 5); l < a; l++) {
        let u = this.top.children[l];
        if (u.matchesNode(e, n, r) && !this.preMatch.matched.has(u)) {
          s = l;
          break;
        }
      }
    return s < 0 ? !1 : (this.destroyBetween(this.index, s), this.index++, !0);
  }
  updateNodeAt(e, n, r, i, s) {
    let o = this.top.children[i];
    return o.dirty == Et && o.dom == o.contentDOM && (o.dirty = Mn), o.update(e, n, r, s) ? (this.destroyBetween(this.index, i), this.index++, !0) : !1;
  }
  findIndexWithChild(e) {
    for (; ; ) {
      let n = e.parentNode;
      if (!n)
        return -1;
      if (n == this.top.contentDOM) {
        let r = e.pmViewDesc;
        if (r) {
          for (let i = this.index; i < this.top.children.length; i++)
            if (this.top.children[i] == r)
              return i;
        }
        return -1;
      }
      e = n;
    }
  }
  // Try to update the next node, if any, to the given data. Checks
  // pre-matches to avoid overwriting nodes that could still be used.
  updateNextNode(e, n, r, i, s, o) {
    for (let l = this.index; l < this.top.children.length; l++) {
      let a = this.top.children[l];
      if (a instanceof mn) {
        let u = this.preMatch.matched.get(a);
        if (u != null && u != s)
          return !1;
        let c = a.dom, h, d = this.isLocked(c) && !(e.isText && a.node && a.node.isText && a.nodeDOM.nodeValue == e.text && a.dirty != Et && ss(n, a.outerDeco));
        if (!d && a.update(e, n, r, i))
          return this.destroyBetween(this.index, l), a.dom != c && (this.changed = !0), this.index++, !0;
        if (!d && (h = this.recreateWrapper(a, e, n, r, i, o)))
          return this.destroyBetween(this.index, l), this.top.children[this.index] = h, h.contentDOM && (h.dirty = Mn, h.updateChildren(i, o + 1), h.dirty = xt), this.changed = !0, this.index++, !0;
        break;
      }
    }
    return !1;
  }
  // When a node with content is replaced by a different node with
  // identical content, move over its children.
  recreateWrapper(e, n, r, i, s, o) {
    if (e.dirty || n.isAtom || !e.children.length || !e.node.content.eq(n.content) || !ss(r, e.outerDeco) || !i.eq(e.innerDeco))
      return null;
    let l = mn.create(this.top, n, r, i, s, o);
    if (l.contentDOM) {
      l.children = e.children, e.children = [];
      for (let a of l.children)
        a.parent = l;
    }
    return e.destroy(), l;
  }
  // Insert the node as a newly created node desc.
  addNode(e, n, r, i, s) {
    let o = mn.create(this.top, e, n, r, i, s);
    o.contentDOM && o.updateChildren(i, s + 1), this.top.children.splice(this.index++, 0, o), this.changed = !0;
  }
  placeWidget(e, n, r) {
    let i = this.index < this.top.children.length ? this.top.children[this.index] : null;
    if (i && i.matchesWidget(e) && (e == i.widget || !i.widget.type.toDOM.parentNode))
      this.index++;
    else {
      let s = new bd(this.top, e, n, r);
      this.top.children.splice(this.index++, 0, s), this.changed = !0;
    }
  }
  // Make sure a textblock looks and behaves correctly in
  // contentEditable.
  addTextblockHacks() {
    let e = this.top.children[this.index - 1], n = this.top;
    for (; e instanceof pn; )
      n = e, e = n.children[n.children.length - 1];
    (!e || // Empty textblock
    !(e instanceof Es) || /\n$/.test(e.node.text) || this.view.requiresGeckoHackNode && /\s$/.test(e.node.text)) && ((Ge || We) && e && e.dom.contentEditable == "false" && this.addHackNode("IMG", n), this.addHackNode("BR", this.top));
  }
  addHackNode(e, n) {
    if (n == this.top && this.index < n.children.length && n.children[this.index].matchesHack(e))
      this.index++;
    else {
      let r = document.createElement(e);
      e == "IMG" && (r.className = "ProseMirror-separator", r.alt = ""), e == "BR" && (r.className = "ProseMirror-trailingBreak");
      let i = new xd(this.top, [], r, null);
      n != this.top ? n.children.push(i) : n.children.splice(this.index++, 0, i), this.changed = !0;
    }
  }
  isLocked(e) {
    return this.lock && (e == this.lock || se(e) && e.contains(this.lock.parentNode));
  }
}
function Vb(t, e) {
  let n = e, r = n.children.length, i = t.childCount, s = /* @__PURE__ */ new Map(), o = [];
  e: for (; i > 0; ) {
    let l;
    for (; ; )
      if (r) {
        let u = n.children[r - 1];
        if (u instanceof pn)
          n = u, r = u.children.length;
        else {
          l = u, r--;
          break;
        }
      } else {
        if (n == e)
          break e;
        r = n.parent.children.indexOf(n), n = n.parent;
      }
    let a = l.node;
    if (a) {
      if (a != t.child(i - 1))
        break;
      --i, s.set(l, i), o.push(l);
    }
  }
  return { index: i, matched: s, matches: o.reverse() };
}
function Wb(t, e) {
  return t.type.side - e.type.side;
}
function Hb(t, e, n, r) {
  let i = e.locals(t), s = 0;
  if (i.length == 0) {
    for (let u = 0; u < t.childCount; u++) {
      let c = t.child(u);
      r(c, i, e.forChild(s, c), u), s += c.nodeSize;
    }
    return;
  }
  let o = 0, l = [], a = null;
  for (let u = 0; ; ) {
    let c, h;
    for (; o < i.length && i[o].to == s; ) {
      let y = i[o++];
      y.widget && (c ? (h || (h = [c])).push(y) : c = y);
    }
    if (c)
      if (h) {
        h.sort(Wb);
        for (let y = 0; y < h.length; y++)
          n(h[y], u, !!a);
      } else
        n(c, u, !!a);
    let d, f;
    if (a)
      f = -1, d = a, a = null;
    else if (u < t.childCount)
      f = u, d = t.child(u++);
    else
      break;
    for (let y = 0; y < l.length; y++)
      l[y].to <= s && l.splice(y--, 1);
    for (; o < i.length && i[o].from <= s && i[o].to > s; )
      l.push(i[o++]);
    let p = s + d.nodeSize;
    if (d.isText) {
      let y = p;
      o < i.length && i[o].from < y && (y = i[o].from);
      for (let g = 0; g < l.length; g++)
        l[g].to < y && (y = l[g].to);
      y < p && (a = d.cut(y - s), d = d.cut(0, y - s), p = y, f = -1);
    } else
      for (; o < i.length && i[o].to < p; )
        o++;
    let m = d.isInline && !d.isLeaf ? l.filter((y) => !y.inline) : l.slice();
    r(d, m, e.forChild(s, d), f), s = p;
  }
}
function Ub(t) {
  if (t.nodeName == "UL" || t.nodeName == "OL") {
    let e = t.style.cssText;
    t.style.cssText = e + "; list-style: square !important", window.getComputedStyle(t).listStyle, t.style.cssText = e;
  }
}
function qb(t, e, n, r) {
  for (let i = 0, s = 0; i < t.childCount && s <= r; ) {
    let o = t.child(i++), l = s;
    if (s += o.nodeSize, !o.isText)
      continue;
    let a = o.text;
    for (; i < t.childCount; ) {
      let u = t.child(i++);
      if (s += u.nodeSize, !u.isText)
        break;
      a += u.text;
    }
    if (s >= n) {
      if (s >= r && a.slice(r - e.length - l, r - l) == e)
        return r - e.length;
      let u = l < r ? a.lastIndexOf(e, r - l - 1) : -1;
      if (u >= 0 && u + e.length + l >= n)
        return l + u;
      if (n == r && a.length >= r + e.length - l && a.slice(r - l, r - l + e.length) == e)
        return r;
    }
  }
  return -1;
}
function ol(t, e, n, r, i) {
  let s = [];
  for (let o = 0, l = 0; o < t.length; o++) {
    let a = t[o], u = l, c = l += a.size;
    u >= n || c <= e ? s.push(a) : (u < e && s.push(a.slice(0, e - u, r)), i && (s.push(i), i = void 0), c > n && s.push(a.slice(n - u, a.size, r)));
  }
  return s;
}
function Gl(t, e = null) {
  let n = t.domSelectionRange(), r = t.state.doc;
  if (!n.focusNode)
    return null;
  let i = t.docView.nearestDesc(n.focusNode), s = i && i.size == 0, o = t.docView.posFromDOM(n.focusNode, n.focusOffset, 1);
  if (o < 0)
    return null;
  let l = r.resolve(o), a, u;
  if (Ts(n)) {
    for (a = o; i && !i.node; )
      i = i.parent;
    if (i && i.node.isAtom && ce.isSelectable(i.node) && i.parent && !(i.node.isInline && wb(n.focusNode, n.focusOffset, i.dom))) {
      let h = i.posBefore;
      u = new ce(o == h ? l : r.resolve(h));
    } else if (dt && e == "key" && o > t.state.selection.to && se(n.focusNode) && n.focusOffset == n.focusNode.childNodes.length && i && i.posAtStart > t.state.selection.to)
      for (let h = n.focusNode; ; h = h.parentNode) {
        if (getComputedStyle(h).overflow != "visible") {
          u = he.findFrom(r.resolve(i.posAtStart), 1);
          break;
        }
        if (h == i.dom || h.nextSibling || !h.parentNode || !se(h.parentNode))
          break;
      }
  } else {
    if (n instanceof t.dom.ownerDocument.defaultView.Selection && n.rangeCount > 1) {
      let h = o, d = o;
      for (let f = 0; f < n.rangeCount; f++) {
        let p = n.getRangeAt(f);
        h = Math.min(h, t.docView.posFromDOM(p.startContainer, p.startOffset, 1)), d = Math.max(d, t.docView.posFromDOM(p.endContainer, p.endOffset, -1));
      }
      if (h < 0)
        return null;
      [a, o] = d == t.state.selection.anchor ? [d, h] : [h, d], l = r.resolve(o);
    } else
      a = t.docView.posFromDOM(n.anchorNode, n.anchorOffset, 1);
    if (a < 0)
      return null;
  }
  let c = r.resolve(a);
  if (!u) {
    let h = e == "pointer" || t.state.selection.head < l.pos && !s ? 1 : -1;
    u = Zl(t, c, l, h);
  }
  return u;
}
function Nd(t) {
  return t.editable ? t.hasFocus() : _d(t) && document.activeElement && document.activeElement.contains(t.dom);
}
function Zt(t, e = !1) {
  let n = t.state.selection;
  if (Id(t, n), !Nd(t))
    return;
  let r = t.input.mouseDown;
  if (!e && We && r) {
    let i = t.domSelectionRange(), s = t.domObserver.currentSelection;
    if (i.anchorNode && s.anchorNode && Wn(i.anchorNode, i.anchorOffset, s.anchorNode, s.anchorOffset) && r.delaySelUpdate()) {
      t.domObserver.setCurSelection();
      return;
    }
  }
  if (t.domObserver.disconnectSelection(), t.cursorWrapper)
    Jb(t);
  else {
    let { anchor: i, head: s } = n, o, l;
    Nc && !(n instanceof pe) && (n.$from.parent.inlineContent || (o = Ic(t, n.from)), !n.empty && !n.$from.parent.inlineContent && (l = Ic(t, n.to))), t.docView.setSelection(i, s, t, e), Nc && (o && _c(o), l && _c(l)), n.visible ? t.dom.classList.remove("ProseMirror-hideselection") : (t.dom.classList.add("ProseMirror-hideselection"), "onselectionchange" in document && Kb(t));
  }
  t.domObserver.setCurSelection(), t.domObserver.connectSelection();
}
const Nc = Ge || We && fd < 63;
function Ic(t, e) {
  let { node: n, offset: r } = t.docView.domFromPos(e, 0), i = r < n.childNodes.length ? n.childNodes[r] : null, s = r ? n.childNodes[r - 1] : null;
  if (Ge && i && i.contentEditable == "false")
    return so(i);
  if ((!i || i.contentEditable == "false") && (!s || s.contentEditable == "false")) {
    if (i)
      return so(i);
    if (s)
      return so(s);
  }
}
function so(t) {
  return t.contentEditable = "true", Ge && t.draggable && (t.draggable = !1, t.wasDraggable = !0), t;
}
function _c(t) {
  t.contentEditable = "false", t.wasDraggable && (t.draggable = !0, t.wasDraggable = null);
}
function Kb(t) {
  let e = t.dom.ownerDocument;
  e.removeEventListener("selectionchange", t.input.hideSelectionGuard);
  let n = t.domSelectionRange(), r = n.anchorNode, i = n.anchorOffset;
  e.addEventListener("selectionchange", t.input.hideSelectionGuard = () => {
    (n.anchorNode != r || n.anchorOffset != i) && (e.removeEventListener("selectionchange", t.input.hideSelectionGuard), setTimeout(() => {
      (!Nd(t) || t.state.selection.visible) && t.dom.classList.remove("ProseMirror-hideselection");
    }, 20));
  });
}
function Jb(t) {
  let e = t.domSelection();
  if (!e)
    return;
  let n = t.cursorWrapper.dom, r = n.nodeName == "IMG";
  r ? e.collapse(n.parentNode, je(n) + 1) : e.collapse(n, 0), !r && !t.state.selection.visible && tt && dn <= 11 && (n.disabled = !0, n.disabled = !1);
}
function Id(t, e) {
  if (e instanceof ce) {
    let n = t.docView.descAt(e.from);
    n != t.lastSelectedViewDesc && (Tc(t), n && n.selectNode(), t.lastSelectedViewDesc = n);
  } else
    Tc(t);
}
function Tc(t) {
  t.lastSelectedViewDesc && (t.lastSelectedViewDesc.parent && t.lastSelectedViewDesc.deselectNode(), t.lastSelectedViewDesc = void 0);
}
function Zl(t, e, n, r) {
  return t.someProp("createSelectionBetween", (i) => i(t, e, n)) || pe.between(e, n, r);
}
function Ac(t) {
  return t.editable && !t.hasFocus() ? !1 : _d(t);
}
function _d(t) {
  let e = t.domSelectionRange();
  if (!e.anchorNode)
    return !1;
  try {
    return Hn(t.dom, e.anchorNode) && (t.editable || Hn(t.dom, e.focusNode));
  } catch {
    return !1;
  }
}
function Gb(t) {
  let e = t.docView.domFromPos(t.state.selection.anchor, 0), n = t.domSelectionRange();
  return Wn(e.node, e.offset, n.anchorNode, n.anchorOffset);
}
function ll(t, e) {
  let { $anchor: n, $head: r } = t.selection, i = e > 0 ? n.max(r) : n.min(r), s = i.parent.inlineContent ? i.depth ? t.doc.resolve(e > 0 ? i.after() : i.before()) : null : i;
  return s && he.findFrom(s, e);
}
function ln(t, e) {
  return t.dispatch(t.state.tr.setSelection(e).scrollIntoView()), !0;
}
function Ec(t, e, n) {
  let r = t.state.selection;
  if (r instanceof pe)
    if (n.indexOf("s") > -1) {
      let { $head: i } = r, s = i.textOffset ? null : e < 0 ? i.nodeBefore : i.nodeAfter;
      if (!s || s.isText || !s.isLeaf)
        return !1;
      let o = t.state.doc.resolve(i.pos + s.nodeSize * (e < 0 ? -1 : 1));
      return ln(t, new pe(r.$anchor, o));
    } else if (r.empty) {
      if (t.endOfTextblock(e > 0 ? "forward" : "backward")) {
        let i = ll(t.state, e);
        return i && i instanceof ce ? ln(t, i) : !1;
      } else if (!(kt && n.indexOf("m") > -1)) {
        let i = r.$head, s = i.textOffset ? null : e < 0 ? i.nodeBefore : i.nodeAfter, o;
        if (!s || s.isText)
          return !1;
        let l = e < 0 ? i.pos - s.nodeSize : i.pos;
        return s.isAtom || (o = t.docView.descAt(l)) && !o.contentDOM ? ce.isSelectable(s) ? ln(t, new ce(e < 0 ? t.state.doc.resolve(i.pos - s.nodeSize) : i)) : ln(t, new pe(t.state.doc.resolve(e < 0 ? l : l + s.nodeSize))) : !1;
      }
    } else return !1;
  else {
    if (r instanceof ce && r.node.isInline)
      return ln(t, new pe(e > 0 ? r.$to : r.$from));
    {
      let i = ll(t.state, e);
      return i ? ln(t, i) : !1;
    }
  }
}
function Lr(t, e) {
  let n = t.pmViewDesc;
  return n ? n.size == 0 && (e < 0 || t.nextSibling || t.nodeName != "BR") : se(t) && t.contentEditable == "false";
}
function Jn(t, e) {
  return e < 0 ? Zb(t) : Yb(t);
}
function Zb(t) {
  let e = t.domSelectionRange(), n = e.focusNode, r = e.focusOffset;
  if (!n)
    return;
  let i, s, o = !1;
  for (dt && se(n) && r < Ke(n) && Lr(n.childNodes[r], -1) && (o = !0); ; )
    if (r > 0) {
      if (!se(n))
        break;
      let l = n.childNodes[r - 1];
      if (Lr(l, -1))
        i = n, s = --r;
      else if (Le(l))
        n = l, r = n.nodeValue.length;
      else
        break;
    } else {
      if (Td(n))
        break;
      {
        let l = n.previousSibling;
        for (; l && Lr(l, -1); )
          i = n.parentNode, s = je(l), l = l.previousSibling;
        if (l)
          n = l, r = Ke(n);
        else {
          if (n = n.parentNode, n == t.dom)
            break;
          r = 0;
        }
      }
    }
  o ? al(t, n, r) : i && al(t, i, s);
}
function Yb(t) {
  let e = t.domSelectionRange(), n = e.focusNode, r = e.focusOffset;
  if (!n)
    return;
  let i = Ke(n), s, o;
  for (; ; )
    if (r < i) {
      if (!se(n))
        break;
      let l = n.childNodes[r];
      if (Lr(l, 1))
        s = n, o = ++r;
      else
        break;
    } else {
      if (Td(n))
        break;
      {
        let l = n.nextSibling;
        for (; l && Lr(l, 1); )
          s = l.parentNode, o = je(l) + 1, l = l.nextSibling;
        if (l)
          n = l, r = 0, i = Ke(n);
        else {
          if (n = n.parentNode, n == t.dom)
            break;
          r = i = 0;
        }
      }
    }
  s && al(t, s, o);
}
function Td(t) {
  let e = t.pmViewDesc;
  return e && e.node && e.node.isBlock;
}
function Xb(t, e) {
  for (; t && e == t.childNodes.length && !si(t); )
    e = je(t) + 1, t = t.parentNode;
  for (; t && e < t.childNodes.length; ) {
    let n = t.childNodes[e];
    if (Le(n))
      return n;
    if (se(n) && n.contentEditable == "false")
      break;
    t = n, e = 0;
  }
}
function Qb(t, e) {
  for (; t && !e && !si(t); )
    e = je(t), t = t.parentNode;
  for (; t && e; ) {
    let n = t.childNodes[e - 1];
    if (Le(n))
      return n;
    if (se(n) && n.contentEditable == "false")
      break;
    t = n, e = t.childNodes.length;
  }
}
function al(t, e, n) {
  if (!Le(e)) {
    let s, o;
    (o = Xb(e, n)) ? (e = o, n = 0) : (s = Qb(e, n)) && (e = s, n = s.nodeValue.length);
  }
  let r = t.domSelection();
  if (!r)
    return;
  if (Ts(r)) {
    let s = document.createRange();
    s.setEnd(e, n), s.setStart(e, n), r.removeAllRanges(), r.addRange(s);
  } else r.extend && r.extend(e, n);
  t.domObserver.setCurSelection();
  let { state: i } = t;
  setTimeout(() => {
    t.state == i && Zt(t);
  }, 50);
}
function Mc(t, e) {
  let n = t.state.doc.resolve(e);
  if (!(We || dd) && n.parent.inlineContent) {
    let i = t.coordsAtPos(e);
    if (e > n.start()) {
      let s = t.coordsAtPos(e - 1), o = (s.top + s.bottom) / 2;
      if (o > i.top && o < i.bottom && Math.abs(s.left - i.left) > 1)
        return s.left < i.left ? "ltr" : "rtl";
    }
    if (e < n.end()) {
      let s = t.coordsAtPos(e + 1), o = (s.top + s.bottom) / 2;
      if (o > i.top && o < i.bottom && Math.abs(s.left - i.left) > 1)
        return s.left > i.left ? "ltr" : "rtl";
    }
  }
  return getComputedStyle(t.dom).direction == "rtl" ? "rtl" : "ltr";
}
function Oc(t, e, n) {
  let r = t.state.selection;
  if (r instanceof pe && !r.empty || n.indexOf("s") > -1 || kt && n.indexOf("m") > -1)
    return !1;
  let { $from: i, $to: s } = r;
  if (!i.parent.inlineContent || t.endOfTextblock(e < 0 ? "up" : "down")) {
    let o = ll(t.state, e);
    if (o && o instanceof ce)
      return ln(t, o);
  }
  if (!i.parent.inlineContent) {
    let o = e < 0 ? i : s, l = r instanceof ft ? he.near(o, e) : he.findFrom(o, e);
    return l ? ln(t, l) : !1;
  }
  return !1;
}
function Dc(t, e) {
  if (!(t.state.selection instanceof pe))
    return !0;
  let { $head: n, $anchor: r, empty: i } = t.state.selection;
  if (!n.sameParent(r))
    return !0;
  if (!i)
    return !1;
  if (t.endOfTextblock(e > 0 ? "forward" : "backward"))
    return !0;
  let s = !n.textOffset && (e < 0 ? n.nodeBefore : n.nodeAfter);
  if (s && !s.isText) {
    let o = t.state.tr;
    return e < 0 ? o.delete(n.pos - s.nodeSize, n.pos) : o.delete(n.pos, n.pos + s.nodeSize), t.dispatch(o), !0;
  }
  return !1;
}
function Rc(t, e, n) {
  t.domObserver.stop(), e.contentEditable = n, t.domObserver.start();
}
function ex(t) {
  if (!Ge || t.state.selection.$head.parentOffset > 0)
    return !1;
  let { focusNode: e, focusOffset: n } = t.domSelectionRange();
  if (e && se(e) && n == 0 && e.firstChild && se(e.firstChild) && e.firstChild.contentEditable == "false") {
    let r = e.firstChild;
    Rc(t, r, "true"), setTimeout(() => Rc(t, r, "false"), 20);
  }
  return !1;
}
function tx(t) {
  let e = "";
  return t.ctrlKey && (e += "c"), t.metaKey && (e += "m"), t.altKey && (e += "a"), t.shiftKey && (e += "s"), e;
}
function nx(t, e) {
  let n = e.keyCode, r = tx(e);
  if (n == 8 || kt && n == 72 && r == "c")
    return Dc(t, -1) || Jn(t, -1);
  if (n == 46 && !e.shiftKey || kt && n == 68 && r == "c")
    return Dc(t, 1) || Jn(t, 1);
  if (n == 13 || n == 27)
    return !0;
  if (n == 37 || kt && n == 66 && r == "c") {
    let i = n == 37 ? Mc(t, t.state.selection.from) == "ltr" ? -1 : 1 : -1;
    return Ec(t, i, r) || Jn(t, i);
  } else if (n == 39 || kt && n == 70 && r == "c") {
    let i = n == 39 ? Mc(t, t.state.selection.from) == "ltr" ? 1 : -1 : 1;
    return Ec(t, i, r) || Jn(t, i);
  } else {
    if (n == 38 || kt && n == 80 && r == "c")
      return Oc(t, -1, r) || Jn(t, -1);
    if (n == 40 || kt && n == 78 && r == "c")
      return ex(t) || Oc(t, 1, r) || Jn(t, 1);
    if (r == (kt ? "m" : "c") && (n == 66 || n == 73 || n == 89 || n == 90))
      return !0;
  }
  return !1;
}
function Yl(t, e) {
  t.someProp("transformCopied", (f) => {
    e = f(e, t);
  });
  let n = [], { content: r, openStart: i, openEnd: s } = e;
  for (; i > 1 && s > 1 && r.childCount == 1 && r.firstChild.childCount == 1; ) {
    i--, s--;
    let f = r.firstChild;
    n.push(f.type.name, f.attrs != f.type.defaultAttrs ? f.attrs : null), r = f.content;
  }
  let o = t.someProp("clipboardSerializer") || fr.fromSchema(t.state.schema), l = Rd(), a = l.createElement("div");
  a.appendChild(o.serializeFragment(r, { document: l }));
  let u = a.firstChild, c, h = 0;
  for (; u && se(u) && (c = Dd[u.nodeName.toLowerCase()]); ) {
    for (let f = c.length - 1; f >= 0; f--) {
      let p = l.createElement(c[f]);
      for (; a.firstChild; )
        p.appendChild(a.firstChild);
      a.appendChild(p), h++;
    }
    u = a.firstChild;
  }
  u && se(u) && u.setAttribute("data-pm-slice", `${i} ${s}${h ? ` -${h}` : ""} ${JSON.stringify(n)}`);
  let d = t.someProp("clipboardTextSerializer", (f) => f(e, t)) || e.content.textBetween(0, e.content.size, `

`);
  return { dom: a, text: d, slice: e };
}
function Ad(t, e, n, r, i) {
  let s = i.parent.type.spec.code, o, l;
  if (!n && !e)
    return null;
  let a = !!e && (r || s || !n);
  if (a) {
    if (t.someProp("transformPastedText", (d) => {
      e = d(e, s || r, t);
    }), s)
      return l = new ne(K.from(t.state.schema.text(e.replace(/\r\n?/g, `
`))), 0, 0), t.someProp("transformPasted", (d) => {
        l = d(l, t, !0);
      }), l;
    let h = t.someProp("clipboardTextParser", (d) => d(e, i, r, t));
    if (h)
      l = h;
    else {
      let d = i.marks(), { schema: f } = t.state, p = fr.fromSchema(f);
      o = document.createElement("div"), e.split(/(?:\r\n?|\n)+/).forEach((m) => {
        let y = o.appendChild(document.createElement("p"));
        m && y.appendChild(p.serializeNode(f.text(m, d)));
      });
    }
  } else
    t.someProp("transformPastedHTML", (h) => {
      n = h(n, t);
    }), o = ox(n), As && lx(o);
  let u = o && o.querySelector("[data-pm-slice]"), c = u && /^(\d+) (\d+)(?: -(\d+))? (.*)/.exec(u.getAttribute("data-pm-slice") || "");
  if (c && c[3])
    for (let h = +c[3]; h > 0; h--) {
      let d = o.firstChild;
      for (; d && !se(d); )
        d = d.nextSibling;
      if (!d)
        break;
      o = d;
    }
  if (l || (l = (t.someProp("clipboardParser") || t.someProp("domParser") || ir.fromSchema(t.state.schema)).parseSlice(o, {
    preserveWhitespace: !!(a || c),
    context: i,
    ruleFromNode(d) {
      return d.nodeName == "BR" && !d.nextSibling && d.parentNode && !rx.test(d.parentNode.nodeName) ? { ignore: !0 } : null;
    }
  })), c)
    l = ax(zc(l, +c[1], +c[2]), c[4]);
  else if (l = ne.maxOpen(ix(l.content, i), !0), l.openStart || l.openEnd) {
    let h = 0, d = 0;
    for (let f = l.content.firstChild; h < l.openStart && !f.type.spec.isolating; h++, f = f.firstChild)
      ;
    for (let f = l.content.lastChild; d < l.openEnd && !f.type.spec.isolating; d++, f = f.lastChild)
      ;
    l = zc(l, h, d);
  }
  return t.someProp("transformPasted", (h) => {
    l = h(l, t, a);
  }), l;
}
const rx = /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var)$/i;
function ix(t, e) {
  if (t.childCount < 2)
    return t;
  for (let n = e.depth; n >= 0; n--) {
    let i = e.node(n).contentMatchAt(e.index(n)), s, o = [];
    if (t.forEach((l) => {
      if (!o)
        return;
      let a = i.findWrapping(l.type), u;
      if (!a)
        return o = null;
      if (u = o.length && s.length && Md(a, s, l, o[o.length - 1], 0))
        o[o.length - 1] = u;
      else {
        o.length && (o[o.length - 1] = Od(o[o.length - 1], s.length));
        let c = Ed(l, a);
        o.push(c), i = i.matchType(c.type), s = a;
      }
    }), o)
      return K.from(o);
  }
  return t;
}
function Ed(t, e, n = 0) {
  for (let r = e.length - 1; r >= n; r--)
    t = e[r].create(null, K.from(t));
  return t;
}
function Md(t, e, n, r, i) {
  if (i < t.length && i < e.length && t[i] == e[i]) {
    let s = Md(t, e, n, r.lastChild, i + 1);
    if (s)
      return r.copy(r.content.replaceChild(r.childCount - 1, s));
    if (r.contentMatchAt(r.childCount).matchType(i == t.length - 1 ? n.type : t[i + 1]))
      return r.copy(r.content.append(K.from(Ed(n, t, i + 1))));
  }
}
function Od(t, e) {
  if (e == 0)
    return t;
  let n = t.content.replaceChild(t.childCount - 1, Od(t.lastChild, e - 1)), r = t.contentMatchAt(t.childCount).fillBefore(K.empty, !0);
  return t.copy(n.append(r));
}
function ul(t, e, n, r, i, s) {
  let o = e < 0 ? t.firstChild : t.lastChild, l = o.content;
  return t.childCount > 1 && (s = 0), i < r - 1 && (l = ul(l, e, n, r, i + 1, s)), i >= n && (l = e < 0 ? o.contentMatchAt(0).fillBefore(l, s <= i).append(l) : l.append(o.contentMatchAt(o.childCount).fillBefore(K.empty, !0))), t.replaceChild(e < 0 ? 0 : t.childCount - 1, o.copy(l));
}
function zc(t, e, n) {
  return e < t.openStart && (t = new ne(ul(t.content, -1, e, t.openStart, 0, t.openEnd), e, t.openEnd)), n < t.openEnd && (t = new ne(ul(t.content, 1, n, t.openEnd, 0, 0), t.openStart, n)), t;
}
const Dd = {
  thead: ["table"],
  tbody: ["table"],
  tfoot: ["table"],
  caption: ["table"],
  colgroup: ["table"],
  col: ["table", "colgroup"],
  tr: ["table", "tbody"],
  td: ["table", "tbody", "tr"],
  th: ["table", "tbody", "tr"]
};
function Rd() {
  return document.implementation.createHTMLDocument("title");
}
let vr = null;
function sx(t) {
  let e = window.trustedTypes;
  if (!e)
    return t;
  if (!vr) {
    if (vr = e.defaultPolicy)
      try {
        return vr.createHTML(t);
      } catch {
      }
    vr = e.createPolicy("ProseMirrorClipboard", { createHTML: (n) => n });
  }
  return vr.createHTML(t);
}
function ox(t) {
  let e = /^(\s*<meta [^>]*>)*/.exec(t);
  e && (t = t.slice(e[0].length));
  let n = Rd(), r = n.body, i = /<([a-z][^>\s]+)/i.exec(t), s;
  if ((s = i && Dd[i[1].toLowerCase()]) && (t = s.map((o) => "<" + o + ">").join("") + t + s.map((o) => "</" + o + ">").reverse().join("")), r.innerHTML = sx(t), s)
    for (let o = 0; o < s.length; o++)
      r = r.querySelector(s[o]) || r;
  for (let o = 0; o < n.styleSheets.length; o++) {
    let l = n.styleSheets[o];
    for (let a = 0; a < l.rules.length; a++) {
      let u = l.rules[a];
      if (u instanceof CSSStyleRule) {
        let c = r.querySelectorAll(u.selectorText);
        for (let h = 0; h < c.length; h++)
          c[h].style.cssText += u.style.cssText;
      }
    }
  }
  return r;
}
function lx(t) {
  let e = t.querySelectorAll(We ? "span:not([class]):not([style])" : "span.Apple-converted-space");
  for (let n = 0; n < e.length; n++) {
    let r = e[n];
    r.childNodes.length == 1 && r.textContent == " " && r.parentNode && r.parentNode.replaceChild(t.ownerDocument.createTextNode(" "), r);
  }
}
function ax(t, e) {
  if (!t.size)
    return t;
  let n = t.content.firstChild.type.schema, r;
  try {
    r = JSON.parse(e);
  } catch {
    return t;
  }
  let { content: i, openStart: s, openEnd: o } = t;
  for (let l = r.length - 2; l >= 0; l -= 2) {
    let a = n.nodes[r[l]];
    if (!a || a.hasRequiredAttrs())
      break;
    try {
      i = K.from(a.create(r[l + 1], i));
    } catch {
      break;
    }
    s++, o++;
  }
  return new ne(i, s, o);
}
const Xe = {}, Qe = {}, ux = { touchstart: !0, touchmove: !0 };
class cx {
  constructor() {
    this.shiftKey = !1, this.mouseDown = null, this.lastKeyCode = null, this.lastKeyCodeTime = 0, this.lastClick = { time: 0, x: 0, y: 0, type: "", button: 0 }, this.lastSelectionOrigin = null, this.lastSelectionTime = 0, this.lastIOSEnter = 0, this.lastIOSEnterFallbackTimeout = -1, this.lastFocus = 0, this.lastTouch = 0, this.lastChromeDelete = 0, this.composing = !1, this.compositionNode = null, this.composingTimeout = -1, this.compositionNodes = [], this.compositionEndedAt = -2e8, this.compositionID = 1, this.badSafariComposition = !1, this.compositionPendingChanges = 0, this.domChangeCount = 0, this.eventHandlers = /* @__PURE__ */ Object.create(null), this.hideSelectionGuard = null;
  }
}
function hx(t) {
  for (let e in Xe) {
    let n = Xe[e];
    t.dom.addEventListener(e, t.input.eventHandlers[e] = (r) => {
      dx(t, r) && !Xl(t, r) && (t.editable || !(r.type in Qe)) && n(t, r);
    }, ux[e] ? { passive: !0 } : void 0);
  }
  Ge && t.dom.addEventListener("input", () => null), cl(t);
}
function Gt(t, e) {
  t.input.lastSelectionOrigin = e, t.input.lastSelectionTime = Date.now();
}
function fx(t) {
  t.input.mouseDown && t.input.mouseDown.done(), t.domObserver.stop();
  for (let e in t.input.eventHandlers)
    t.dom.removeEventListener(e, t.input.eventHandlers[e]);
  clearTimeout(t.input.composingTimeout), clearTimeout(t.input.lastIOSEnterFallbackTimeout);
}
function cl(t) {
  t.someProp("handleDOMEvents", (e) => {
    for (let n in e)
      t.input.eventHandlers[n] || t.dom.addEventListener(n, t.input.eventHandlers[n] = (r) => Xl(t, r));
  });
}
function Xl(t, e) {
  return t.someProp("handleDOMEvents", (n) => {
    let r = n[e.type];
    return r ? r(t, e) || e.defaultPrevented : !1;
  });
}
function dx(t, e) {
  if (!e.bubbles)
    return !0;
  if (e.defaultPrevented)
    return !1;
  for (let n = e.target; n != t.dom; n = n.parentNode)
    if (!n || n.nodeType == 11 || n.pmViewDesc && n.pmViewDesc.stopEvent(e))
      return !1;
  return !0;
}
function px(t, e) {
  !Xl(t, e) && Xe[e.type] && (t.editable || !(e.type in Qe)) && Xe[e.type](t, e);
}
Qe.keydown = (t, e) => {
  let n = e;
  if (t.input.shiftKey = n.keyCode == 16 || n.shiftKey, !Bd(t) && (t.input.lastKeyCode = n.keyCode, t.input.lastKeyCodeTime = Date.now(), !(Jt && We && n.keyCode == 13)))
    if (n.keyCode != 229 && t.domObserver.forceFlush(), ar && n.keyCode == 13 && !n.ctrlKey && !n.altKey && !n.metaKey) {
      let r = Date.now();
      t.input.lastIOSEnter = r, t.input.lastIOSEnterFallbackTimeout = setTimeout(() => {
        t.input.lastIOSEnter == r && (t.someProp("handleKeyDown", (i) => i(t, An(13, "Enter"))), t.input.lastIOSEnter = 0);
      }, 200);
    } else t.someProp("handleKeyDown", (r) => r(t, n)) || nx(t, n) ? n.preventDefault() : Gt(t, "key");
};
Qe.keyup = (t, e) => {
  e.keyCode == 16 && (t.input.shiftKey = !1);
};
Qe.keypress = (t, e) => {
  let n = e;
  if (Bd(t) || !n.charCode || n.ctrlKey && !n.altKey || kt && n.metaKey)
    return;
  if (t.someProp("handleKeyPress", (i) => i(t, n))) {
    n.preventDefault();
    return;
  }
  let r = t.state.selection;
  if (!(r instanceof pe) || !r.$from.sameParent(r.$to)) {
    let i = String.fromCharCode(n.charCode), s = () => t.state.tr.insertText(i).scrollIntoView();
    !/[\r\n]/.test(i) && !t.someProp("handleTextInput", (o) => o(t, r.$from.pos, r.$to.pos, i, s)) && t.dispatch(s()), n.preventDefault();
  }
};
function li(t) {
  return { left: t.clientX, top: t.clientY };
}
function mx(t, e) {
  let n = e.x - t.clientX, r = e.y - t.clientY;
  return n * n + r * r < 100;
}
function Ql(t, e, n, r, i) {
  if (r == -1)
    return !1;
  let s = t.state.doc.resolve(r);
  for (let o = s.depth + 1; o > 0; o--)
    if (t.someProp(e, (l) => o > s.depth ? l(t, n, s.nodeAfter, s.before(o), i, !0) : l(t, n, s.node(o), s.before(o), i, !1)))
      return !0;
  return !1;
}
function ai(t, e, n) {
  if (t.focused || t.focus(), t.state.selection.eq(e))
    return;
  let r = t.state.tr.setSelection(e);
  r.setMeta("pointer", !0), t.dispatch(r);
}
function gx(t, e) {
  if (e == -1)
    return !1;
  let n = t.state.doc.resolve(e), r = n.nodeAfter;
  return r && r.isAtom && ce.isSelectable(r) ? (ai(t, new ce(n)), !0) : !1;
}
function yx(t, e) {
  if (e == -1)
    return !1;
  let n = t.state.selection, r, i;
  n instanceof ce && (r = n.node);
  let s = t.state.doc.resolve(e);
  for (let o = s.depth + 1; o > 0; o--) {
    let l = o > s.depth ? s.nodeAfter : s.node(o);
    if (ce.isSelectable(l)) {
      r && n.$from.depth > 0 && o >= n.$from.depth && s.before(n.$from.depth + 1) == n.$from.pos ? i = s.before(n.$from.depth) : i = s.before(o);
      break;
    }
  }
  return i != null ? (ai(t, ce.create(t.state.doc, i)), !0) : !1;
}
function kx(t, e, n, r, i) {
  return Ql(t, "handleClickOn", e, n, r) || t.someProp("handleClick", (s) => s(t, e, r)) || (i ? yx(t, n) : gx(t, n));
}
function wx(t, e, n, r) {
  return Ql(t, "handleDoubleClickOn", e, n, r) || t.someProp("handleDoubleClick", (i) => i(t, e, r));
}
function bx(t, e, n, r) {
  return Ql(t, "handleTripleClickOn", e, n, r) || t.someProp("handleTripleClick", (i) => i(t, e, r)) || xx(t, n, r);
}
function xx(t, e, n) {
  if (n.button != 0)
    return !1;
  let r = zd(t, e, !0), i = t.state.doc;
  return r ? (ai(t, r), r instanceof pe && i.eq(t.state.doc) && (t.input.mouseDown = new Sx(t, r)), !0) : !1;
}
function zd(t, e, n) {
  let r = t.state.doc;
  if (e == -1)
    return r.inlineContent ? pe.create(r, 0, r.content.size) : null;
  let i = r.resolve(e);
  for (let s = i.depth + 1; s > 0; s--) {
    let o = s > i.depth ? i.nodeAfter : i.node(s), l = i.before(s);
    if (o.inlineContent)
      return pe.create(r, l + 1, l + 1 + o.content.size);
    if (n && ce.isSelectable(o))
      return ce.create(r, l);
  }
  return null;
}
function ea(t) {
  return ls(t);
}
const Pd = kt ? "metaKey" : "ctrlKey";
Xe.mousedown = (t, e) => {
  let n = e;
  t.input.shiftKey = n.shiftKey;
  let r = ea(t), i = Date.now(), s = "singleClick";
  i - t.input.lastClick.time < 500 && mx(n, t.input.lastClick) && !n[Pd] && t.input.lastClick.button == n.button && (t.input.lastClick.type == "singleClick" ? s = "doubleClick" : t.input.lastClick.type == "doubleClick" && (s = "tripleClick")), t.input.lastClick = { time: i, x: n.clientX, y: n.clientY, type: s, button: n.button }, t.input.mouseDown && t.input.mouseDown.done();
  let o = t.posAtCoords(li(n));
  o && (s == "singleClick" ? t.input.mouseDown = new Cx(t, o, n, !!r) : (s == "doubleClick" ? wx : bx)(t, o.pos, o.inside, n) ? n.preventDefault() : Gt(t, "pointer"));
};
class Ld {
  constructor(e) {
    this.view = e, this.mightDrag = null, e.root.addEventListener("mouseup", this.up = this.up.bind(this)), e.root.addEventListener("mousemove", this.move = this.move.bind(this));
  }
  up(e) {
    this.done();
  }
  move(e) {
    e.buttons == 0 && this.done();
  }
  done() {
    this.view.root.removeEventListener("mouseup", this.up), this.view.root.removeEventListener("mousemove", this.move), this.view.input.mouseDown == this && (this.view.input.mouseDown = null);
  }
  delaySelUpdate() {
    return !1;
  }
}
class Cx extends Ld {
  constructor(e, n, r, i) {
    super(e), this.pos = n, this.event = r, this.flushed = i, this.delayedSelectionSync = !1, this.startDoc = e.state.doc, this.selectNode = !!r[Pd], this.allowDefault = r.shiftKey;
    let s, o;
    if (n.inside > -1)
      s = e.state.doc.nodeAt(n.inside), o = n.inside;
    else {
      let c = e.state.doc.resolve(n.pos);
      s = c.parent, o = c.depth ? c.before() : 0;
    }
    const l = i ? null : r.target, a = l ? e.docView.nearestDesc(l, !0) : null;
    this.target = a && se(a.nodeDOM) ? a.nodeDOM : null;
    let { selection: u } = e.state;
    r.button == 0 && (s.type.spec.draggable && s.type.spec.selectable !== !1 || u instanceof ce && u.from <= o && u.to > o) && (this.mightDrag = {
      node: s,
      pos: o,
      addAttr: !!(this.target && !this.target.draggable),
      setUneditable: !!(this.target && dt && !this.target.hasAttribute("contentEditable"))
    }), this.target && this.mightDrag && (this.mightDrag.addAttr || this.mightDrag.setUneditable) && (this.view.domObserver.stop(), this.mightDrag.addAttr && (this.target.draggable = !0), this.mightDrag.setUneditable && setTimeout(() => {
      this.view.input.mouseDown == this && this.target.setAttribute("contentEditable", "false");
    }, 20), this.view.domObserver.start()), Gt(e, "pointer");
  }
  done() {
    super.done(), this.mightDrag && this.target && (this.view.domObserver.stop(), this.mightDrag.addAttr && this.target.removeAttribute("draggable"), this.mightDrag.setUneditable && this.target.removeAttribute("contentEditable"), this.view.domObserver.start()), this.delayedSelectionSync && setTimeout(() => {
      this.view.isDestroyed || Zt(this.view);
    });
  }
  up(e) {
    if (this.done(), !this.view.dom.contains(e.target))
      return;
    let n = this.pos;
    this.view.state.doc != this.startDoc && (n = this.view.posAtCoords(li(e))), this.updateAllowDefault(e), this.allowDefault || !n ? Gt(this.view, "pointer") : kx(this.view, n.pos, n.inside, e, this.selectNode) ? e.preventDefault() : e.button == 0 && (this.flushed || // Safari ignores clicks on draggable elements
    Ge && this.mightDrag && !this.mightDrag.node.isAtom || // Chrome will sometimes treat a node selection as a
    // cursor, but still report that the node is selected
    // when asked through getSelection. You'll then get a
    // situation where clicking at the point where that
    // (hidden) cursor is doesn't change the selection, and
    // thus doesn't get a reaction from ProseMirror. This
    // works around that.
    We && !this.view.state.selection.visible && Math.min(Math.abs(n.pos - this.view.state.selection.from), Math.abs(n.pos - this.view.state.selection.to)) <= 2) ? (ai(this.view, he.near(this.view.state.doc.resolve(n.pos))), e.preventDefault()) : Gt(this.view, "pointer");
  }
  move(e) {
    this.updateAllowDefault(e), Gt(this.view, "pointer"), super.move(e);
  }
  updateAllowDefault(e) {
    !this.allowDefault && (Math.abs(this.event.x - e.clientX) > 4 || Math.abs(this.event.y - e.clientY) > 4) && (this.allowDefault = !0);
  }
  delaySelUpdate() {
    return this.allowDefault ? (this.delayedSelectionSync = !0, !0) : !1;
  }
}
class Sx extends Ld {
  constructor(e, n) {
    super(e), this.startSelection = n, this.startDoc = e.state.doc;
  }
  move(e) {
    if (e.buttons == 0 || this.view.isDestroyed || !this.view.state.doc.eq(this.startDoc)) {
      this.done();
      return;
    }
    e.preventDefault(), Gt(this.view, "pointer");
    let n = this.view.posAtCoords(li(e)), r = n && zd(this.view, n.inside, !1);
    if (!r)
      return;
    let { doc: i } = this.view.state, s = this.startSelection, [o, l] = r.from < s.from ? [s.to, r.from] : [s.from, r.to];
    ai(this.view, pe.create(i, o, l));
  }
}
Xe.touchstart = (t) => {
  t.input.lastTouch = Date.now(), ea(t), Gt(t, "pointer");
};
Xe.touchmove = (t) => {
  t.input.lastTouch = Date.now(), Gt(t, "pointer");
};
Xe.contextmenu = (t) => ea(t);
function Bd(t, e) {
  return t.composing ? !0 : Ge && Math.abs(Date.now() - t.input.compositionEndedAt) < 500 ? (t.input.compositionEndedAt = -2e8, !0) : !1;
}
const vx = Jt ? 5e3 : -1;
Qe.compositionstart = Qe.compositionupdate = (t) => {
  if (!t.composing) {
    t.domObserver.flush();
    let { state: e } = t, n = e.selection.$to;
    if (e.selection instanceof pe && e.selection.empty && (e.storedMarks || !n.textOffset && n.parentOffset && n.nodeBefore.marks.some((r) => r.type.spec.inclusive === !1) || We && dd && Nx(t)))
      t.markCursor = t.state.storedMarks || n.marks(), ls(t, !0), t.markCursor = null;
    else if (ls(t, !e.selection.empty), dt && e.selection.empty && n.parentOffset && !n.textOffset && n.nodeBefore.marks.length) {
      let r = t.domSelectionRange();
      for (let i = r.focusNode, s = r.focusOffset; i && se(i) && s != 0; ) {
        let o = s < 0 ? i.lastChild : i.childNodes[s - 1];
        if (!o)
          break;
        if (Le(o)) {
          let l = t.domSelection();
          l && l.collapse(o, o.nodeValue.length);
          break;
        } else
          i = o, s = -1;
      }
    }
    t.input.composing = !0;
  }
  Fd(t, vx);
};
function Nx(t) {
  let { focusNode: e, focusOffset: n } = t.domSelectionRange();
  if (!e || !se(e) || n >= e.childNodes.length)
    return !1;
  let r = e.childNodes[n];
  return se(r) && r.contentEditable == "false";
}
Qe.compositionend = (t, e) => {
  t.composing && (t.input.composing = !1, t.input.compositionEndedAt = Date.now(), t.input.compositionPendingChanges = t.domObserver.pendingRecords().length ? t.input.compositionID : 0, t.input.compositionNode = null, t.input.badSafariComposition ? t.domObserver.forceFlush() : t.input.compositionPendingChanges && Promise.resolve().then(() => t.domObserver.flush()), t.input.compositionID++, Fd(t, 20));
};
function Fd(t, e) {
  clearTimeout(t.input.composingTimeout), e > -1 && (t.input.composingTimeout = setTimeout(() => ls(t), e));
}
function $d(t) {
  for (t.composing && (t.input.composing = !1, t.input.compositionEndedAt = Date.now()); t.input.compositionNodes.length > 0; )
    t.input.compositionNodes.pop().markParentsDirty();
}
function Ix(t) {
  let e = t.domSelectionRange();
  if (!e.focusNode)
    return null;
  let n = yb(e.focusNode, e.focusOffset), r = kb(e.focusNode, e.focusOffset);
  if (n && r && n != r) {
    let i = r.pmViewDesc, s = t.domObserver.lastChangedTextNode;
    if (n == s || r == s)
      return s;
    if (!i || !i.isText(r.nodeValue))
      return r;
    if (t.input.compositionNode == r) {
      let o = n.pmViewDesc;
      if (!(!o || !o.isText(n.nodeValue)))
        return r;
    }
  }
  return n || r;
}
function ls(t, e = !1) {
  if (!(Jt && t.domObserver.flushingSoon >= 0)) {
    if (t.domObserver.forceFlush(), $d(t), e || t.docView && t.docView.dirty) {
      let n = Gl(t), r = t.state.selection;
      return n && !n.eq(r) ? t.dispatch(t.state.tr.setSelection(n)) : (t.markCursor || e) && !r.$from.node(r.$from.sharedDepth(r.to)).inlineContent ? t.dispatch(t.state.tr.deleteSelection()) : t.updateState(t.state), !0;
    }
    return !1;
  }
}
function _x(t, e) {
  if (!t.dom.parentNode)
    return;
  let n = t.dom.parentNode.appendChild(document.createElement("div"));
  n.appendChild(e), n.style.cssText = "position: fixed; left: -10000px; top: 10px";
  let r = getSelection(), i = document.createRange();
  i.selectNodeContents(e), t.dom.blur(), r.removeAllRanges(), r.addRange(i), setTimeout(() => {
    n.parentNode && n.parentNode.removeChild(n), t.focus();
  }, 50);
}
const Zr = tt && dn < 15 || ar && Cb < 604;
Xe.copy = Qe.cut = (t, e) => {
  let n = e, r = t.state.selection, i = n.type == "cut";
  if (r.empty)
    return;
  let s = Zr ? null : n.clipboardData, o = r.content(), { dom: l, text: a } = Yl(t, o);
  s ? (n.preventDefault(), s.clearData(), s.setData("text/html", l.innerHTML), s.setData("text/plain", a)) : _x(t, l), i && t.dispatch(t.state.tr.deleteSelection().scrollIntoView().setMeta("uiEvent", "cut"));
};
function Tx(t) {
  return t.openStart == 0 && t.openEnd == 0 && t.content.childCount == 1 ? t.content.firstChild : null;
}
function Ax(t, e) {
  if (!t.dom.parentNode)
    return;
  let n = t.input.shiftKey || t.state.selection.$from.parent.type.spec.code, r = t.dom.parentNode.appendChild(document.createElement(n ? "textarea" : "div"));
  n || (r.contentEditable = "true"), r.style.cssText = "position: fixed; left: -10000px; top: 10px", r.focus();
  let i = t.input.shiftKey && t.input.lastKeyCode != 45;
  setTimeout(() => {
    t.focus(), r.parentNode && r.parentNode.removeChild(r), n ? Yr(t, r.value, null, i, e) : Yr(t, r.textContent, r.innerHTML, i, e);
  }, 50);
}
function Yr(t, e, n, r, i) {
  let s = Ad(t, e, n, r, t.state.selection.$from);
  if (t.someProp("handlePaste", (a) => a(t, i, s || ne.empty)))
    return !0;
  if (!s)
    return !1;
  let o = Tx(s), l = o ? t.state.tr.replaceSelectionWith(o, r) : t.state.tr.replaceSelection(s);
  return t.dispatch(l.scrollIntoView().setMeta("paste", !0).setMeta("uiEvent", "paste")), !0;
}
function jd(t) {
  let e = t.getData("text/plain") || t.getData("Text");
  if (e)
    return e;
  let n = t.getData("text/uri-list");
  return n ? n.replace(/\r?\n/g, " ") : "";
}
Qe.paste = (t, e) => {
  let n = e;
  if (t.composing && !Jt)
    return;
  let r = Zr ? null : n.clipboardData, i = t.input.shiftKey && t.input.lastKeyCode != 45;
  r && Yr(t, jd(r), r.getData("text/html"), i, n) ? n.preventDefault() : Ax(t, n);
};
class Vd {
  constructor(e, n, r) {
    this.slice = e, this.move = n, this.node = r;
  }
}
const Ex = kt ? "altKey" : "ctrlKey";
function Wd(t, e) {
  let n;
  return t.someProp("dragCopies", (r) => {
    n = n || r(e);
  }), n != null ? !n : !e[Ex];
}
Xe.dragstart = (t, e) => {
  let n = e, r = t.input.mouseDown;
  if (r && r.done(), !n.dataTransfer)
    return;
  let i = t.state.selection, s = i.empty ? null : t.posAtCoords(li(n)), o;
  if (!(s && s.pos >= i.from && s.pos <= (i instanceof ce ? i.to - 1 : i.to))) {
    if (r && r.mightDrag)
      o = ce.create(t.state.doc, r.mightDrag.pos);
    else if (n.target && se(n.target)) {
      let h = t.docView.nearestDesc(n.target, !0);
      h && h.node.type.spec.draggable && h != t.docView && (o = ce.create(t.state.doc, h.posBefore));
    }
  }
  let l = (o || t.state.selection).content(), { dom: a, text: u, slice: c } = Yl(t, l);
  (!n.dataTransfer.files.length || !We || fd > 120) && n.dataTransfer.clearData(), n.dataTransfer.setData(Zr ? "Text" : "text/html", a.innerHTML), n.dataTransfer.effectAllowed = "copyMove", Zr || n.dataTransfer.setData("text/plain", u), t.dragging = new Vd(c, Wd(t, n), o);
};
Xe.dragend = (t) => {
  let e = t.dragging;
  window.setTimeout(() => {
    t.dragging == e && (t.dragging = null);
  }, 50);
};
Qe.dragover = Qe.dragenter = (t, e) => e.preventDefault();
Qe.drop = (t, e) => {
  try {
    Mx(t, e, t.dragging);
  } finally {
    t.dragging = null;
  }
};
function Mx(t, e, n) {
  if (!e.dataTransfer)
    return;
  let r = t.posAtCoords(li(e));
  if (!r)
    return;
  let i = t.state.doc.resolve(r.pos), s = n && n.slice;
  s ? t.someProp("transformPasted", (f) => {
    s = f(s, t, !1);
  }) : s = Ad(t, jd(e.dataTransfer), Zr ? null : e.dataTransfer.getData("text/html"), !1, i);
  let o = !!(n && Wd(t, e));
  if (t.someProp("handleDrop", (f) => f(t, e, s || ne.empty, o))) {
    e.preventDefault();
    return;
  }
  if (!s)
    return;
  e.preventDefault();
  let l = s ? f1(t.state.doc, i.pos, s) : i.pos;
  l == null && (l = i.pos);
  let a = t.state.tr;
  if (o) {
    let { node: f } = n;
    f ? f.replace(a) : a.deleteSelection();
  }
  let u = a.mapping.map(l), c = s.openStart == 0 && s.openEnd == 0 && s.content.childCount == 1, h = a.doc;
  if (c ? a.replaceRangeWith(u, u, s.content.firstChild) : a.replaceRange(u, u, s), a.doc.eq(h))
    return;
  let d = a.doc.resolve(u);
  if (c && ce.isSelectable(s.content.firstChild) && d.nodeAfter && d.nodeAfter.sameMarkup(s.content.firstChild))
    a.setSelection(new ce(d));
  else {
    let f = a.mapping.map(l);
    a.mapping.maps[a.mapping.maps.length - 1].forEach((p, m, y, g) => f = g), a.setSelection(Zl(t, d, a.doc.resolve(f)));
  }
  t.focus(), t.dispatch(a.setMeta("uiEvent", "drop"));
}
Xe.focus = (t) => {
  t.input.lastFocus = Date.now(), t.focused || (t.domObserver.stop(), t.dom.classList.add("ProseMirror-focused"), t.domObserver.start(), t.focused = !0, setTimeout(() => {
    t.docView && t.hasFocus() && !t.domObserver.currentSelection.eq(t.domSelectionRange()) && Zt(t);
  }, 20));
};
Xe.blur = (t, e) => {
  let n = e;
  t.focused && (t.domObserver.stop(), t.dom.classList.remove("ProseMirror-focused"), t.domObserver.start(), n.relatedTarget && t.dom.contains(n.relatedTarget) && t.domObserver.currentSelection.clear(), t.focused = !1);
};
Xe.beforeinput = (t, e) => {
  if (Jt && e.inputType == "deleteContentBackward") {
    t.domObserver.flushSoon();
    let { domChangeCount: r } = t.input;
    setTimeout(() => {
      if (t.input.domChangeCount != r || (t.dom.blur(), t.focus(), t.someProp("handleKeyDown", (s) => s(t, An(8, "Backspace")))))
        return;
      let { $cursor: i } = t.state.selection;
      i && i.pos > 0 && t.dispatch(t.state.tr.delete(i.pos - 1, i.pos).scrollIntoView());
    }, 50);
  }
};
for (let t in Qe)
  Xe[t] = Qe[t];
function Xr(t, e) {
  if (t == e)
    return !0;
  for (let n in t)
    if (t[n] !== e[n])
      return !1;
  for (let n in e)
    if (!(n in t))
      return !1;
  return !0;
}
class as {
  constructor(e, n) {
    this.toDOM = e, this.spec = n || zn, this.side = this.spec.side || 0;
  }
  map(e, n, r, i) {
    let { pos: s, deleted: o } = e.mapResult(n.from + i, this.side < 0 ? -1 : 1);
    return o ? null : new He(s - r, s - r, this);
  }
  valid() {
    return !0;
  }
  eq(e) {
    return this == e || e instanceof as && (this.spec.key && this.spec.key == e.spec.key || this.toDOM == e.toDOM && Xr(this.spec, e.spec));
  }
  destroy(e) {
    this.spec.destroy && this.spec.destroy(e);
  }
}
class gn {
  constructor(e, n) {
    this.attrs = e, this.spec = n || zn;
  }
  map(e, n, r, i) {
    let s = e.map(n.from + i, this.spec.inclusiveStart ? -1 : 1) - r, o = e.map(n.to + i, this.spec.inclusiveEnd ? 1 : -1) - r;
    return s >= o ? null : new He(s, o, this);
  }
  valid(e, n) {
    return n.from < n.to;
  }
  eq(e) {
    return this == e || e instanceof gn && Xr(this.attrs, e.attrs) && Xr(this.spec, e.spec);
  }
  static is(e) {
    return e.type instanceof gn;
  }
  destroy() {
  }
}
class ta {
  constructor(e, n) {
    this.attrs = e, this.spec = n || zn;
  }
  map(e, n, r, i) {
    let s = e.mapResult(n.from + i, 1);
    if (s.deleted)
      return null;
    let o = e.mapResult(n.to + i, -1);
    return o.deleted || o.pos <= s.pos ? null : new He(s.pos - r, o.pos - r, this);
  }
  valid(e, n) {
    let { index: r, offset: i } = e.content.findIndex(n.from), s;
    return i == n.from && !(s = e.child(r)).isText && i + s.nodeSize == n.to;
  }
  eq(e) {
    return this == e || e instanceof ta && Xr(this.attrs, e.attrs) && Xr(this.spec, e.spec);
  }
  destroy() {
  }
}
class He {
  /**
  @internal
  */
  constructor(e, n, r) {
    this.from = e, this.to = n, this.type = r;
  }
  /**
  @internal
  */
  copy(e, n) {
    return new He(e, n, this.type);
  }
  /**
  @internal
  */
  eq(e, n = 0) {
    return this.type.eq(e.type) && this.from + n == e.from && this.to + n == e.to;
  }
  /**
  @internal
  */
  map(e, n, r) {
    return this.type.map(e, this, n, r);
  }
  /**
  Creates a widget decoration, which is a DOM node that's shown in
  the document at the given position. It is recommended that you
  delay rendering the widget by passing a function that will be
  called when the widget is actually drawn in a view, but you can
  also directly pass a DOM node. `getPos` can be used to find the
  widget's current document position.
  */
  static widget(e, n, r) {
    return new He(e, e, new as(n, r));
  }
  /**
  Creates an inline decoration, which adds the given attributes to
  each inline node between `from` and `to`.
  */
  static inline(e, n, r, i) {
    return new He(e, n, new gn(r, i));
  }
  /**
  Creates a node decoration. `from` and `to` should point precisely
  before and after a node in the document. That node, and only that
  node, will receive the given attributes.
  */
  static node(e, n, r, i) {
    return new He(e, n, new ta(r, i));
  }
  /**
  The spec provided when creating this decoration. Can be useful
  if you've stored extra information in that object.
  */
  get spec() {
    return this.type.spec;
  }
  /**
  @internal
  */
  get inline() {
    return this.type instanceof gn;
  }
  /**
  @internal
  */
  get widget() {
    return this.type instanceof as;
  }
}
const Yn = [], zn = {};
class Ae {
  /**
  @internal
  */
  constructor(e, n) {
    this.local = e.length ? e : Yn, this.children = n.length ? n : Yn;
  }
  /**
  Create a set of decorations, using the structure of the given
  document. This will consume (modify) the `decorations` array, so
  you must make a copy if you want need to preserve that.
  */
  static create(e, n) {
    return n.length ? us(n, e, 0, zn) : qe;
  }
  /**
  Find all decorations in this set which touch the given range
  (including decorations that start or end directly at the
  boundaries) and match the given predicate on their spec. When
  `start` and `end` are omitted, all decorations in the set are
  considered. When `predicate` isn't given, all decorations are
  assumed to match.
  */
  find(e, n, r) {
    let i = [];
    return this.findInner(e ?? 0, n ?? 1e9, i, 0, r), i;
  }
  findInner(e, n, r, i, s) {
    for (let o = 0; o < this.local.length; o++) {
      let l = this.local[o];
      l.from <= n && l.to >= e && (!s || s(l.spec)) && r.push(l.copy(l.from + i, l.to + i));
    }
    for (let o = 0; o < this.children.length; o += 3)
      if (this.children[o] < n && this.children[o + 1] > e) {
        let l = this.children[o] + 1;
        this.children[o + 2].findInner(e - l, n - l, r, i + l, s);
      }
  }
  /**
  Map the set of decorations in response to a change in the
  document.
  */
  map(e, n, r) {
    return this == qe || e.maps.length == 0 ? this : this.mapInner(e, n, 0, 0, r || zn);
  }
  /**
  @internal
  */
  mapInner(e, n, r, i, s) {
    let o;
    for (let l = 0; l < this.local.length; l++) {
      let a = this.local[l].map(e, r, i);
      a && a.type.valid(n, a) ? (o || (o = [])).push(a) : s.onRemove && s.onRemove(this.local[l].spec);
    }
    return this.children.length ? Ox(this.children, o || [], e, n, r, i, s) : o ? new Ae(o.sort(Pn), Yn) : qe;
  }
  /**
  Add the given array of decorations to the ones in the set,
  producing a new set. Consumes the `decorations` array. Needs
  access to the current document to create the appropriate tree
  structure.
  */
  add(e, n) {
    return n.length ? this == qe ? Ae.create(e, n) : this.addInner(e, n, 0) : this;
  }
  addInner(e, n, r) {
    let i, s = 0;
    e.forEach((l, a) => {
      let u = a + r, c;
      if (c = Ud(n, l, u)) {
        for (i || (i = this.children.slice()); s < i.length && i[s] < a; )
          s += 3;
        i[s] == a ? i[s + 2] = i[s + 2].addInner(l, c, u + 1) : i.splice(s, 0, a, a + l.nodeSize, us(c, l, u + 1, zn)), s += 3;
      }
    });
    let o = Hd(s ? qd(n) : n, -r);
    for (let l = 0; l < o.length; l++)
      o[l].type.valid(e, o[l]) || o.splice(l--, 1);
    return new Ae(o.length ? this.local.concat(o).sort(Pn) : this.local, i || this.children);
  }
  /**
  Create a new set that contains the decorations in this set, minus
  the ones in the given array.
  */
  remove(e) {
    return e.length == 0 || this == qe ? this : this.removeInner(e, 0);
  }
  removeInner(e, n) {
    let r = this.children, i = this.local;
    for (let s = 0; s < r.length; s += 3) {
      let o, l = r[s] + n, a = r[s + 1] + n;
      for (let c = 0, h; c < e.length; c++)
        (h = e[c]) && h.from > l && h.to < a && (e[c] = null, (o || (o = [])).push(h));
      if (!o)
        continue;
      r == this.children && (r = this.children.slice());
      let u = r[s + 2].removeInner(o, l + 1);
      u != qe ? r[s + 2] = u : (r.splice(s, 3), s -= 3);
    }
    if (i.length) {
      for (let s = 0, o; s < e.length; s++)
        if (o = e[s])
          for (let l = 0; l < i.length; l++)
            i[l].eq(o, n) && (i == this.local && (i = this.local.slice()), i.splice(l--, 1));
    }
    return r == this.children && i == this.local ? this : i.length || r.length ? new Ae(i, r) : qe;
  }
  forChild(e, n) {
    if (this == qe)
      return this;
    if (n.isLeaf)
      return Ae.empty;
    let r, i;
    for (let l = 0; l < this.children.length; l += 3)
      if (this.children[l] >= e) {
        this.children[l] == e && (r = this.children[l + 2]);
        break;
      }
    let s = e + 1, o = s + n.content.size;
    for (let l = 0; l < this.local.length; l++) {
      let a = this.local[l];
      if (a.from < o && a.to > s && a.type instanceof gn) {
        let u = Math.max(s, a.from) - s, c = Math.min(o, a.to) - s;
        u < c && (i || (i = [])).push(a.copy(u, c));
      }
    }
    if (i) {
      let l = new Ae(i.sort(Pn), Yn);
      return r ? new un([l, r]) : l;
    }
    return r || qe;
  }
  /**
  @internal
  */
  eq(e) {
    if (this == e)
      return !0;
    if (!(e instanceof Ae) || this.local.length != e.local.length || this.children.length != e.children.length)
      return !1;
    for (let n = 0; n < this.local.length; n++)
      if (!this.local[n].eq(e.local[n]))
        return !1;
    for (let n = 0; n < this.children.length; n += 3)
      if (this.children[n] != e.children[n] || this.children[n + 1] != e.children[n + 1] || !this.children[n + 2].eq(e.children[n + 2]))
        return !1;
    return !0;
  }
  /**
  @internal
  */
  locals(e) {
    return na(this.localsInner(e));
  }
  /**
  @internal
  */
  localsInner(e) {
    if (this == qe)
      return Yn;
    if (e.inlineContent || !this.local.some(gn.is))
      return this.local;
    let n = [];
    for (let r = 0; r < this.local.length; r++)
      this.local[r].type instanceof gn || n.push(this.local[r]);
    return n;
  }
  forEachSet(e) {
    e(this);
  }
}
Ae.empty = new Ae([], []);
Ae.removeOverlap = na;
const qe = Ae.empty;
class un {
  constructor(e) {
    this.members = e;
  }
  map(e, n) {
    const r = this.members.map((i) => i.map(e, n, zn));
    return un.from(r);
  }
  forChild(e, n) {
    if (n.isLeaf)
      return Ae.empty;
    let r = [];
    for (let i = 0; i < this.members.length; i++) {
      let s = this.members[i].forChild(e, n);
      s != qe && (s instanceof un ? r = r.concat(s.members) : r.push(s));
    }
    return un.from(r);
  }
  eq(e) {
    if (!(e instanceof un) || e.members.length != this.members.length)
      return !1;
    for (let n = 0; n < this.members.length; n++)
      if (!this.members[n].eq(e.members[n]))
        return !1;
    return !0;
  }
  locals(e) {
    let n, r = !0;
    for (let i = 0; i < this.members.length; i++) {
      let s = this.members[i].localsInner(e);
      if (s.length)
        if (!n)
          n = s;
        else {
          r && (n = n.slice(), r = !1);
          for (let o = 0; o < s.length; o++)
            n.push(s[o]);
        }
    }
    return n ? na(r ? n : n.sort(Pn)) : Yn;
  }
  // Create a group for the given array of decoration sets, or return
  // a single set when possible.
  static from(e) {
    switch (e.length) {
      case 0:
        return qe;
      case 1:
        return e[0];
      default:
        return new un(e.every((n) => n instanceof Ae) ? e : e.reduce((n, r) => n.concat(r instanceof Ae ? r : r.members), []));
    }
  }
  forEachSet(e) {
    for (let n = 0; n < this.members.length; n++)
      this.members[n].forEachSet(e);
  }
}
function Ox(t, e, n, r, i, s, o) {
  let l = t.slice();
  for (let u = 0, c = s; u < n.maps.length; u++) {
    let h = 0;
    n.maps[u].forEach((d, f, p, m) => {
      let y = m - p - (f - d);
      for (let g = 0; g < l.length; g += 3) {
        let b = l[g + 1];
        if (b < 0 || d > b + c - h)
          continue;
        let x = l[g] + c - h;
        f >= x ? l[g + 1] = d <= x ? -2 : -1 : d >= c && y && (l[g] += y, l[g + 1] += y);
      }
      h += y;
    }), c = n.maps[u].map(c, -1);
  }
  let a = !1;
  for (let u = 0; u < l.length; u += 3)
    if (l[u + 1] < 0) {
      if (l[u + 1] == -2) {
        a = !0, l[u + 1] = -1;
        continue;
      }
      let c = n.map(t[u] + s), h = c - i;
      if (h < 0 || h >= r.content.size) {
        a = !0;
        continue;
      }
      let d = n.map(t[u + 1] + s, -1), f = d - i, { index: p, offset: m } = r.content.findIndex(h), y = r.maybeChild(p);
      if (y && m == h && m + y.nodeSize == f) {
        let g = l[u + 2].mapInner(n, y, c + 1, t[u] + s + 1, o);
        g != qe ? (l[u] = h, l[u + 1] = f, l[u + 2] = g) : (l[u + 1] = -2, a = !0);
      } else
        a = !0;
    }
  if (a) {
    let u = Dx(l, t, e, n, i, s, o), c = us(u, r, 0, o);
    e = c.local;
    for (let h = 0; h < l.length; h += 3)
      l[h + 1] < 0 && (l.splice(h, 3), h -= 3);
    for (let h = 0, d = 0; h < c.children.length; h += 3) {
      let f = c.children[h];
      for (; d < l.length && l[d] < f; )
        d += 3;
      l.splice(d, 0, c.children[h], c.children[h + 1], c.children[h + 2]);
    }
  }
  return new Ae(e.sort(Pn), l);
}
function Hd(t, e) {
  if (!e || !t.length)
    return t;
  let n = [];
  for (let r = 0; r < t.length; r++) {
    let i = t[r];
    n.push(new He(i.from + e, i.to + e, i.type));
  }
  return n;
}
function Dx(t, e, n, r, i, s, o) {
  function l(a, u) {
    for (let c = 0; c < a.local.length; c++) {
      let h = a.local[c].map(r, i, u);
      h ? n.push(h) : o.onRemove && o.onRemove(a.local[c].spec);
    }
    for (let c = 0; c < a.children.length; c += 3)
      l(a.children[c + 2], a.children[c] + u + 1);
  }
  for (let a = 0; a < t.length; a += 3)
    t[a + 1] == -1 && l(t[a + 2], e[a] + s + 1);
  return n;
}
function Ud(t, e, n) {
  if (e.isLeaf)
    return null;
  let r = n + e.nodeSize, i = null;
  for (let s = 0, o; s < t.length; s++)
    (o = t[s]) && o.from > n && o.to < r && ((i || (i = [])).push(o), t[s] = null);
  return i;
}
function qd(t) {
  let e = [];
  for (let n = 0; n < t.length; n++)
    t[n] != null && e.push(t[n]);
  return e;
}
function us(t, e, n, r) {
  let i = [], s = !1;
  e.forEach((l, a) => {
    let u = Ud(t, l, a + n);
    if (u) {
      s = !0;
      let c = us(u, l, n + a + 1, r);
      c != qe && i.push(a, a + l.nodeSize, c);
    }
  });
  let o = Hd(s ? qd(t) : t, -n).sort(Pn);
  for (let l = 0; l < o.length; l++)
    o[l].type.valid(e, o[l]) || (r.onRemove && r.onRemove(o[l].spec), o.splice(l--, 1));
  return o.length || i.length ? new Ae(o, i) : qe;
}
function Pn(t, e) {
  return t.from - e.from || t.to - e.to;
}
function na(t) {
  let e = t;
  for (let n = 0; n < e.length - 1; n++) {
    let r = e[n];
    if (r.from != r.to)
      for (let i = n + 1; i < e.length; i++) {
        let s = e[i];
        if (s.from == r.from) {
          s.to != r.to && (e == t && (e = t.slice()), e[i] = s.copy(s.from, r.to), Pc(e, i + 1, s.copy(r.to, s.to)));
          continue;
        } else {
          s.from < r.to && (e == t && (e = t.slice()), e[n] = r.copy(r.from, s.from), Pc(e, i, r.copy(s.from, r.to)));
          break;
        }
      }
  }
  return e;
}
function Pc(t, e, n) {
  for (; e < t.length && Pn(n, t[e]) > 0; )
    e++;
  t.splice(e, 0, n);
}
function oo(t) {
  let e = [];
  return t.someProp("decorations", (n) => {
    let r = n(t.state);
    r && r != qe && e.push(r);
  }), t.cursorWrapper && e.push(Ae.create(t.state.doc, [t.cursorWrapper.deco])), un.from(e);
}
const Rx = {
  childList: !0,
  characterData: !0,
  characterDataOldValue: !0,
  attributes: !0,
  attributeOldValue: !0,
  subtree: !0
}, zx = tt && dn <= 11;
class Px {
  constructor() {
    this.anchorNode = null, this.anchorOffset = 0, this.focusNode = null, this.focusOffset = 0;
  }
  set(e) {
    this.anchorNode = e.anchorNode, this.anchorOffset = e.anchorOffset, this.focusNode = e.focusNode, this.focusOffset = e.focusOffset;
  }
  clear() {
    this.anchorNode = this.focusNode = null;
  }
  eq(e) {
    return e.anchorNode == this.anchorNode && e.anchorOffset == this.anchorOffset && e.focusNode == this.focusNode && e.focusOffset == this.focusOffset;
  }
}
class Lx {
  constructor(e, n) {
    this.view = e, this.handleDOMChange = n, this.queue = [], this.flushingSoon = -1, this.observer = null, this.currentSelection = new Px(), this.onCharData = null, this.suppressingSelectionUpdates = !1, this.lastChangedTextNode = null, this.observer = window.MutationObserver && new window.MutationObserver((r) => {
      for (let i = 0; i < r.length; i++)
        this.queue.push(r[i]);
      tt && dn <= 11 && r.some((i) => i.type == "childList" && i.removedNodes.length || i.type == "characterData" && i.oldValue.length > i.target.nodeValue.length) ? this.flushSoon() : Ge && e.composing && r.some((i) => i.type == "childList" && i.target.nodeName == "TR") ? (e.input.badSafariComposition = !0, this.flushSoon()) : this.flush();
    }), zx && (this.onCharData = (r) => {
      this.queue.push({ target: r.target, type: "characterData", oldValue: r.prevValue }), this.flushSoon();
    }), this.onSelectionChange = this.onSelectionChange.bind(this);
  }
  flushSoon() {
    this.flushingSoon < 0 && (this.flushingSoon = window.setTimeout(() => {
      this.flushingSoon = -1, this.flush();
    }, 20));
  }
  forceFlush() {
    this.flushingSoon > -1 && (window.clearTimeout(this.flushingSoon), this.flushingSoon = -1, this.flush());
  }
  start() {
    this.observer && (this.observer.takeRecords(), this.observer.observe(this.view.dom, Rx)), this.onCharData && this.view.dom.addEventListener("DOMCharacterDataModified", this.onCharData), this.connectSelection();
  }
  stop() {
    if (this.observer) {
      let e = this.observer.takeRecords();
      if (e.length) {
        for (let n = 0; n < e.length; n++)
          this.queue.push(e[n]);
        window.setTimeout(() => this.flush(), 20);
      }
      this.observer.disconnect();
    }
    this.onCharData && this.view.dom.removeEventListener("DOMCharacterDataModified", this.onCharData), this.disconnectSelection();
  }
  connectSelection() {
    this.view.dom.ownerDocument.addEventListener("selectionchange", this.onSelectionChange);
  }
  disconnectSelection() {
    this.view.dom.ownerDocument.removeEventListener("selectionchange", this.onSelectionChange);
  }
  suppressSelectionUpdates() {
    this.suppressingSelectionUpdates = !0, setTimeout(() => this.suppressingSelectionUpdates = !1, 50);
  }
  onSelectionChange() {
    if (Ac(this.view)) {
      if (this.suppressingSelectionUpdates)
        return Zt(this.view);
      if (tt && dn <= 11 && !this.view.state.selection.empty) {
        let e = this.view.domSelectionRange();
        if (e.focusNode && Wn(e.focusNode, e.focusOffset, e.anchorNode, e.anchorOffset))
          return this.flushSoon();
      }
      this.flush();
    }
  }
  setCurSelection() {
    this.currentSelection.set(this.view.domSelectionRange());
  }
  ignoreSelectionChange(e) {
    if (!e.focusNode)
      return !0;
    let n = /* @__PURE__ */ new Set(), r;
    for (let s = e.focusNode; s; s = lr(s))
      n.add(s);
    for (let s = e.anchorNode; s; s = lr(s))
      if (n.has(s)) {
        r = s;
        break;
      }
    let i = r && this.view.docView.nearestDesc(r);
    if (i && i.ignoreMutation({
      type: "selection",
      target: Le(r) ? r.parentNode : r
    }))
      return this.setCurSelection(), !0;
  }
  pendingRecords() {
    if (this.observer)
      for (let e of this.observer.takeRecords())
        this.queue.push(e);
    return this.queue;
  }
  flush() {
    let { view: e } = this;
    if (!e.docView || this.flushingSoon > -1)
      return;
    let n = this.pendingRecords();
    n.length && (this.queue = []);
    let r = e.domSelectionRange(), i = !this.suppressingSelectionUpdates && !this.currentSelection.eq(r) && Ac(e) && !this.ignoreSelectionChange(r), s = -1, o = -1, l = !1, a = [];
    if (e.editable)
      for (let c = 0; c < n.length; c++) {
        let h = this.registerMutation(n[c], a);
        h && (s = s < 0 ? h.from : Math.min(h.from, s), o = o < 0 ? h.to : Math.max(h.to, o), h.typeOver && (l = !0));
      }
    if (a.some((c) => c.nodeName == "BR") && (e.input.lastKeyCode == 8 || e.input.lastKeyCode == 46 || We && (e.composing || e.input.compositionEndedAt > Date.now() - 50) && n.some((c) => c.type == "childList" && c.removedNodes.length))) {
      for (let c of a)
        if (c.nodeName == "BR" && c.parentNode) {
          let h = c.nextSibling;
          for (; h && se(h); ) {
            if (h.contentEditable == "false") {
              c.parentNode.removeChild(c);
              break;
            }
            h = h.firstChild;
          }
        }
    } else if (dt && a.length) {
      let c = a.filter((h) => h.nodeName == "BR");
      if (c.length == 2) {
        let [h, d] = c;
        h.parentNode && h.parentNode.parentNode == d.parentNode ? d.remove() : h.remove();
      } else {
        let { focusNode: h } = this.currentSelection;
        for (let d of c) {
          let f = d.parentNode;
          f && f.nodeName == "LI" && (!h || $x(e, h) != f) && d.remove();
        }
      }
    }
    let u = null;
    s < 0 && i && e.input.lastFocus > Date.now() - 200 && Math.max(e.input.lastTouch, e.input.lastClick.time) < Date.now() - 300 && Ts(r) && (u = Gl(e)) && u.eq(he.near(e.state.doc.resolve(0), 1)) ? (e.input.lastFocus = 0, Zt(e), this.currentSelection.set(r), e.scrollToSelection()) : (s > -1 || i) && (s > -1 && (e.docView.markDirty(s, o), Bx(e)), e.input.badSafariComposition && (e.input.badSafariComposition = !1, jx(e, a)), this.handleDOMChange(s, o, l, a), e.docView && e.docView.dirty ? e.updateState(e.state) : this.currentSelection.eq(r) || Zt(e), this.currentSelection.set(r));
  }
  registerMutation(e, n) {
    if (n.indexOf(e.target) > -1)
      return null;
    let r = this.view.docView.nearestDesc(e.target);
    if (e.type == "attributes" && (r == this.view.docView || e.attributeName == "contenteditable" || // Firefox sometimes fires spurious events for null/empty styles
    e.attributeName == "style" && !e.oldValue && !e.target.getAttribute("style")) || !r || r.ignoreMutation(e))
      return null;
    if (e.type == "childList") {
      for (let c = 0; c < e.addedNodes.length; c++) {
        let h = e.addedNodes[c];
        n.push(h), Le(h) && (this.lastChangedTextNode = h);
      }
      if (r.contentDOM && r.contentDOM != r.dom && !r.contentDOM.contains(e.target))
        return { from: r.posBefore, to: r.posAfter };
      let i = e.previousSibling, s = e.nextSibling;
      if (tt && dn <= 11 && e.addedNodes.length)
        for (let c = 0; c < e.addedNodes.length; c++) {
          let { previousSibling: h, nextSibling: d } = e.addedNodes[c];
          (!h || Array.prototype.indexOf.call(e.addedNodes, h) < 0) && (i = h), (!d || Array.prototype.indexOf.call(e.addedNodes, d) < 0) && (s = d);
        }
      let o = i && i.parentNode == e.target ? je(i) + 1 : 0, l = r.localPosFromDOM(e.target, o, -1), a = s && s.parentNode == e.target ? je(s) : e.target.childNodes.length, u = r.localPosFromDOM(e.target, a, 1);
      return { from: l, to: u };
    } else return e.type == "attributes" ? { from: r.posAtStart - r.border, to: r.posAtEnd + r.border } : (this.lastChangedTextNode = e.target, {
      from: r.posAtStart,
      to: r.posAtEnd,
      // An event was generated for a text change that didn't change
      // any text. Mark the dom change to fall back to assuming the
      // selection was typed over with an identical value if it can't
      // find another change.
      typeOver: e.target.nodeValue == e.oldValue
    });
  }
}
let Lc = /* @__PURE__ */ new WeakMap(), Bc = !1;
function Bx(t) {
  if (!Lc.has(t) && (Lc.set(t, null), ["normal", "nowrap", "pre-line"].indexOf(getComputedStyle(t.dom).whiteSpace) !== -1)) {
    if (t.requiresGeckoHackNode = dt, Bc)
      return;
    console.warn("ProseMirror expects the CSS white-space property to be set, preferably to 'pre-wrap'. It is recommended to load style/prosemirror.css from the prosemirror-view package."), Bc = !0;
  }
}
function Fc(t, e) {
  let n = e.startContainer, r = e.startOffset, i = e.endContainer, s = e.endOffset, o = t.domAtPos(t.state.selection.anchor);
  return Wn(o.node, o.offset, i, s) && ([n, r, i, s] = [i, s, n, r]), { anchorNode: n, anchorOffset: r, focusNode: i, focusOffset: s };
}
function Fx(t, e) {
  if (e.getComposedRanges) {
    let i = e.getComposedRanges(t.root)[0];
    if (i)
      return Fc(t, i);
  }
  let n;
  function r(i) {
    i.preventDefault(), i.stopImmediatePropagation(), n = i.getTargetRanges()[0];
  }
  return t.dom.addEventListener("beforeinput", r, !0), document.execCommand("indent"), t.dom.removeEventListener("beforeinput", r, !0), n ? Fc(t, n) : null;
}
function $x(t, e) {
  for (let n = e.parentNode; n && n != t.dom; n = n.parentNode) {
    let r = t.docView.nearestDesc(n, !0);
    if (r && r.node.isBlock)
      return n;
  }
  return null;
}
function jx(t, e) {
  var n;
  let { focusNode: r, focusOffset: i } = t.domSelectionRange();
  for (let s of e)
    if (((n = s.parentNode) === null || n === void 0 ? void 0 : n.nodeName) == "TR") {
      let o = s.nextSibling;
      for (; o && o.nodeName != "TD" && o.nodeName != "TH"; )
        o = o.nextSibling;
      if (o) {
        let l = o;
        for (; ; ) {
          let a = l.firstChild;
          if (!a || !se(a) || a.contentEditable == "false" || /^(BR|IMG)$/.test(a.nodeName))
            break;
          l = a;
        }
        l.insertBefore(s, l.firstChild), r == s && t.domSelection().collapse(s, i);
      } else
        s.parentNode.removeChild(s);
    }
}
function Vx(t, e, n, r) {
  let { node: i, fromOffset: s, toOffset: o, from: l, to: a } = t.docView.parseRange(e, n), u = t.domSelectionRange(), c, h = u.anchorNode;
  if (h && Hn(t.dom, h) && (c = [{ node: h, offset: u.anchorOffset }], Ts(u) || c.push({ node: u.focusNode, offset: u.focusOffset })), We && t.input.lastKeyCode === 8)
    for (let g = o; g > s; g--) {
      let b = i.childNodes[g - 1], x = b.pmViewDesc;
      if (b.nodeName == "BR" && !x) {
        o = g;
        break;
      }
      if (!x || x.size)
        break;
    }
  let d = t.state.doc, f = t.someProp("domParser") || ir.fromSchema(t.state.schema), p = d.resolve(l), m = null, y = f.parse(i, {
    topNode: p.parent,
    topMatch: p.parent.contentMatchAt(p.index()),
    topOpen: !0,
    from: s,
    to: o,
    preserveWhitespace: p.parent.type.whitespace == "pre" ? "full" : !0,
    findPositions: c,
    ruleFromNode: Wx(r),
    context: p
  });
  if (c && c[0].pos != null) {
    let g = c[0].pos, b = c[1] && c[1].pos;
    b == null && (b = g), m = { anchor: g + l, head: b + l };
  }
  return { doc: y, sel: m, from: l, to: a };
}
const Wx = (t) => (e) => {
  let n = e.pmViewDesc;
  if (n)
    return n.parseRule(t);
  if (e.nodeName == "BR" && e.parentNode) {
    if (Ge && /^(ul|ol)$/i.test(e.parentNode.nodeName)) {
      let r = document.createElement("div");
      return r.appendChild(document.createElement("li")), { skip: r };
    } else if (e.parentNode.lastChild == e || Ge && /^(tr|table)$/i.test(e.parentNode.nodeName))
      return { ignore: !0 };
  } else if (e.nodeName == "IMG" && e.getAttribute("mark-placeholder"))
    return { ignore: !0 };
  return null;
}, Hx = /^(a|abbr|acronym|b|bd[io]|big|br|button|cite|code|data(list)?|del|dfn|em|i|img|ins|kbd|label|map|mark|meter|output|q|ruby|s|samp|small|span|strong|su[bp]|time|u|tt|var)$/i;
function Ux(t, e, n, r, i) {
  let s = t.input.compositionPendingChanges || (t.composing ? t.input.compositionID : 0);
  if (t.input.compositionPendingChanges = 0, e < 0) {
    let M = t.input.lastSelectionTime > Date.now() - 50 ? t.input.lastSelectionOrigin : null, R = Gl(t, M);
    if (R && !t.state.selection.eq(R)) {
      if (We && Jt && t.input.lastKeyCode === 13 && Date.now() - 100 < t.input.lastKeyCodeTime && t.someProp("handleKeyDown", (T) => T(t, An(13, "Enter"))))
        return;
      let O = t.state.tr.setSelection(R);
      M == "pointer" ? O.setMeta("pointer", !0) : M == "key" && O.scrollIntoView(), s && O.setMeta("composition", s), t.dispatch(O);
    }
    return;
  }
  let o = t.state.doc.resolve(e), l = o.sharedDepth(n);
  e = o.before(l + 1), n = t.state.doc.resolve(n).after(l + 1);
  let a = t.state.selection, u = Vx(t, e, n, i), c = t.state.doc, h = c.slice(u.from, u.to), d, f;
  t.input.lastKeyCode === 8 && Date.now() - 100 < t.input.lastKeyCodeTime ? (d = t.state.selection.to, f = "end") : (d = t.state.selection.from, f = "start"), t.input.lastKeyCode = null;
  let p = Gx(h.content, u.doc.content, u.from, d, f);
  if (p && t.input.domChangeCount++, (ar && t.input.lastIOSEnter > Date.now() - 225 || Jt) && i.some((M) => se(M) && !Hx.test(M.nodeName)) && (!p || p.endA >= p.endB) && t.someProp("handleKeyDown", (M) => M(t, An(13, "Enter")))) {
    t.input.lastIOSEnter = 0;
    return;
  }
  if (!p)
    if (r && a instanceof pe && !a.empty && a.$head.sameParent(a.$anchor) && !t.composing && !(u.sel && u.sel.anchor != u.sel.head))
      p = { start: a.from, endA: a.to, endB: a.to };
    else {
      if (u.sel) {
        let M = $c(t, t.state.doc, u.sel);
        if (M && !M.eq(t.state.selection)) {
          let R = t.state.tr.setSelection(M);
          s && R.setMeta("composition", s), t.dispatch(R);
        }
      }
      return;
    }
  t.state.selection.from < t.state.selection.to && p.start == p.endB && t.state.selection instanceof pe && (p.start > t.state.selection.from && p.start <= t.state.selection.from + 2 && t.state.selection.from >= u.from ? p.start = t.state.selection.from : p.endA < t.state.selection.to && p.endA >= t.state.selection.to - 2 && t.state.selection.to <= u.to && (p.endB += t.state.selection.to - p.endA, p.endA = t.state.selection.to)), tt && dn <= 11 && p.endB == p.start + 1 && p.endA == p.start && p.start > u.from && u.doc.textBetween(p.start - u.from - 1, p.start - u.from + 1) == "  " && (p.start--, p.endA--, p.endB--);
  let m = u.doc.resolveNoCache(p.start - u.from), y = u.doc.resolveNoCache(p.endB - u.from), g = c.resolve(p.start), b = m.sameParent(y) && m.parent.inlineContent && g.end() >= p.endA;
  if ((ar && t.input.lastIOSEnter > Date.now() - 225 && (!b || i.some((M) => M.nodeName == "DIV" || M.nodeName == "P")) || !b && Jx(u.doc, m.pos, y.pos)) && t.someProp("handleKeyDown", (M) => M(t, An(13, "Enter")))) {
    t.input.lastIOSEnter = 0;
    return;
  }
  if (t.state.selection.anchor > p.start && Kx(c, p.start, p.endA, m, y) && t.someProp("handleKeyDown", (M) => M(t, An(8, "Backspace")))) {
    Jt && We && t.domObserver.suppressSelectionUpdates();
    return;
  }
  We && p.endB == p.start && (t.input.lastChromeDelete = Date.now()), Jt && !b && m.start() != y.start() && y.parentOffset == 0 && m.depth == y.depth && u.sel && u.sel.anchor == u.sel.head && u.sel.head == p.endA && (p.endB -= 2, y = u.doc.resolveNoCache(p.endB - u.from), setTimeout(() => {
    t.someProp("handleKeyDown", function(M) {
      return M(t, An(13, "Enter"));
    });
  }, 20));
  let x = p.start, A = p.endA, E = (M) => {
    let R = M || t.state.tr.replace(x, A, u.doc.slice(p.start - u.from, p.endB - u.from));
    if (u.sel) {
      let O = $c(t, R.doc, u.sel);
      O && !(We && t.composing && O.empty && (p.start != p.endB || t.input.lastChromeDelete < Date.now() - 100) && (O.head == x || O.head == R.mapping.map(A) - 1) || tt && O.empty && O.head == x) && R.setSelection(O);
    }
    return s && R.setMeta("composition", s), R.scrollIntoView();
  }, v;
  if (b)
    if (m.pos == y.pos) {
      tt && dn <= 11 && m.parentOffset == 0 && (t.domObserver.suppressSelectionUpdates(), setTimeout(() => Zt(t), 20));
      let M = E(t.state.tr.delete(x, A)), R = c.resolve(p.start).marksAcross(c.resolve(p.endA));
      R && M.ensureMarks(R), t.dispatch(M);
    } else if (
      // Adding or removing a mark
      p.endA == p.endB && (v = qx(m.parent.content.cut(m.parentOffset, y.parentOffset), g.parent.content.cut(g.parentOffset, p.endA - g.start())))
    ) {
      let M = E(t.state.tr);
      v.type == "add" ? M.addMark(x, A, v.mark) : M.removeMark(x, A, v.mark), t.dispatch(M);
    } else if (m.parent.child(m.index()).isText && m.index() == y.index() - (y.textOffset ? 0 : 1)) {
      let M = m.parent.textBetween(m.parentOffset, y.parentOffset), R = () => E(t.state.tr.insertText(M, x, A));
      t.someProp("handleTextInput", (O) => O(t, x, A, M, R)) || t.dispatch(R());
    } else
      t.dispatch(E());
  else
    t.dispatch(E());
}
function $c(t, e, n) {
  return Math.max(n.anchor, n.head) > e.content.size ? null : Zl(t, e.resolve(n.anchor), e.resolve(n.head));
}
function qx(t, e) {
  let n = t.firstChild.marks, r = e.firstChild.marks, i = n, s = r, o, l, a;
  for (let c = 0; c < r.length; c++)
    i = r[c].removeFromSet(i);
  for (let c = 0; c < n.length; c++)
    s = n[c].removeFromSet(s);
  if (i.length == 1 && s.length == 0)
    l = i[0], o = "add", a = (c) => c.mark(l.addToSet(c.marks));
  else if (i.length == 0 && s.length == 1)
    l = s[0], o = "remove", a = (c) => c.mark(l.removeFromSet(c.marks));
  else
    return null;
  let u = [];
  for (let c = 0; c < e.childCount; c++)
    u.push(a(e.child(c)));
  if (K.from(u).eq(t))
    return { mark: l, type: o };
}
function Kx(t, e, n, r, i) {
  if (
    // The content must have shrunk
    n - e <= i.pos - r.pos || // newEnd must point directly at or after the end of the block that newStart points into
    lo(r, !0, !1) < i.pos
  )
    return !1;
  let s = t.resolve(e);
  if (!r.parent.isTextblock) {
    let l = s.nodeAfter;
    return l != null && n == e + l.nodeSize;
  }
  if (s.parentOffset < s.parent.content.size || !s.parent.isTextblock)
    return !1;
  let o = t.resolve(lo(s, !0, !0));
  return !o.parent.isTextblock || o.pos > n || lo(o, !0, !1) < n ? !1 : r.parent.content.cut(r.parentOffset).eq(o.parent.content);
}
function Jx(t, e, n) {
  let r = 0, i = 0;
  return t.nodesBetween(e, n, (s, o) => {
    s.isTextblock && o >= e && o < n ? r++ : (s.isText ? /\S/.test(s.text.slice(Math.max(0, e - o), Math.min(s.nodeSize, n - o))) : s.isLeaf) && i++;
  }), i == 0 && r == 1;
}
function lo(t, e, n) {
  let r = t.depth, i = e ? t.end() : t.pos;
  for (; r > 0 && (e || t.indexAfter(r) == t.node(r).childCount); )
    r--, i++, e = !1;
  if (n) {
    let s = t.node(r).maybeChild(t.indexAfter(r));
    for (; s && !s.isLeaf; )
      s = s.firstChild, i++;
  }
  return i;
}
function Gx(t, e, n, r, i) {
  let s = t.findDiffStart(e, n), o = n + t.size, l = n + e.size;
  if (s == null)
    return null;
  let { a, b: u } = t.findDiffEnd(e, o, l);
  if (i == "end") {
    let c = Math.max(0, s - Math.min(a, u));
    r -= a + c - s;
  }
  if (a < s && o < l) {
    let c = r <= s && r >= a ? s - r : 0;
    s -= c, u = s + (u - a), a = s;
  } else if (u < s) {
    let c = r <= s && r >= u ? s - r : 0;
    s -= c, a = s + (a - u), u = s;
  }
  return { start: s, endA: a, endB: u };
}
class Kd {
  /**
  Create a view. `place` may be a DOM node that the editor should
  be appended to, a function that will place it into the document,
  or an object whose `mount` property holds the node to use as the
  document container. If it is `null`, the editor will not be
  added to the document.
  */
  constructor(e, n) {
    this._root = null, this.focused = !1, this.trackWrites = null, this.mounted = !1, this.markCursor = null, this.cursorWrapper = null, this.lastSelectedViewDesc = void 0, this.input = new cx(), this.prevDirectPlugins = [], this.pluginViews = [], this.requiresGeckoHackNode = !1, this.dragging = null, this._props = n, this.state = n.state, this.directPlugins = n.plugins || [], this.directPlugins.forEach(Uc), this.dispatch = this.dispatch.bind(this), this.dom = e && e.mount || document.createElement("div"), e && (e.appendChild ? e.appendChild(this.dom) : typeof e == "function" ? e(this.dom) : e.mount && (this.mounted = !0)), this.editable = Wc(this), Vc(this), this.nodeViews = Hc(this), this.docView = Sc(this.state.doc, jc(this), oo(this), this.dom, this), this.domObserver = new Lx(this, (r, i, s, o) => Ux(this, r, i, s, o)), this.domObserver.start(), hx(this), this.updatePluginViews();
  }
  /**
  Holds `true` when a
  [composition](https://w3c.github.io/uievents/#events-compositionevents)
  is active.
  */
  get composing() {
    return this.input.composing;
  }
  /**
  The view's current [props](https://prosemirror.net/docs/ref/#view.EditorProps).
  */
  get props() {
    if (this._props.state != this.state) {
      let e = this._props;
      this._props = {};
      for (let n in e)
        this._props[n] = e[n];
      this._props.state = this.state;
    }
    return this._props;
  }
  /**
  Update the view's props. Will immediately cause an update to
  the DOM.
  */
  update(e) {
    e.handleDOMEvents != this._props.handleDOMEvents && cl(this);
    let n = this._props;
    this._props = e, e.plugins && (e.plugins.forEach(Uc), this.directPlugins = e.plugins), this.updateStateInner(e.state, n);
  }
  /**
  Update the view by updating existing props object with the object
  given as argument. Equivalent to `view.update(Object.assign({},
  view.props, props))`.
  */
  setProps(e) {
    let n = {};
    for (let r in this._props)
      n[r] = this._props[r];
    n.state = this.state;
    for (let r in e)
      n[r] = e[r];
    this.update(n);
  }
  /**
  Update the editor's `state` prop, without touching any of the
  other props.
  */
  updateState(e) {
    this.updateStateInner(e, this._props);
  }
  updateStateInner(e, n) {
    var r;
    let i = this.state, s = !1, o = !1;
    e.storedMarks && this.composing && ($d(this), o = !0), this.state = e;
    let l = i.plugins != e.plugins || this._props.plugins != n.plugins;
    if (l || this._props.plugins != n.plugins || this._props.nodeViews != n.nodeViews) {
      let f = Hc(this);
      Yx(f, this.nodeViews) && (this.nodeViews = f, s = !0);
    }
    (l || n.handleDOMEvents != this._props.handleDOMEvents) && cl(this), this.editable = Wc(this), Vc(this);
    let a = oo(this), u = jc(this), c = i.plugins != e.plugins && !i.doc.eq(e.doc) ? "reset" : e.scrollToSelection > i.scrollToSelection ? "to selection" : "preserve", h = s || !this.docView.matchesNode(e.doc, u, a);
    (h || !e.selection.eq(i.selection)) && (o = !0);
    let d = c == "preserve" && o && this.dom.style.overflowAnchor == null && Nb(this);
    if (o) {
      this.domObserver.stop();
      let f = h && (tt || We) && !this.composing && !i.selection.empty && !e.selection.empty && Zx(i.selection, e.selection);
      if (h) {
        let m = We ? this.trackWrites = this.domSelectionRange().focusNode : null;
        this.composing && (this.input.compositionNode = Ix(this)), (s || !this.docView.update(e.doc, u, a, this)) && (this.docView.updateOuterDeco(u), this.docView.destroy(), this.docView = Sc(e.doc, u, a, this.dom, this)), m && (!this.trackWrites || !this.dom.contains(this.trackWrites)) && (f = !0);
      }
      let p = this.input.mouseDown;
      f || !(p && this.domObserver.currentSelection.eq(this.domSelectionRange()) && Gb(this) && p.delaySelUpdate()) ? Zt(this, f) : (Id(this, e.selection), this.domObserver.setCurSelection()), this.domObserver.start();
    }
    this.updatePluginViews(i), !((r = this.dragging) === null || r === void 0) && r.node && !i.doc.eq(e.doc) && this.updateDraggedNode(this.dragging, i), c == "reset" ? this.dom.scrollTop = 0 : c == "to selection" ? this.scrollToSelection() : d && Ib(d);
  }
  /**
  @internal
  */
  scrollToSelection() {
    let e = this.domSelectionRange().focusNode;
    if (!(!e || !Hn(this.dom, e))) {
      if (!this.someProp("handleScrollToSelection", (n) => n(this))) if (this.state.selection instanceof ce) {
        let n = this.docView.domAfterPos(this.state.selection.from);
        se(n) && kc(this, n.getBoundingClientRect(), e);
      } else
        kc(this, this.coordsAtPos(this.state.selection.head, 1), e);
    }
  }
  destroyPluginViews() {
    let e;
    for (; e = this.pluginViews.pop(); )
      e.destroy && e.destroy();
  }
  updatePluginViews(e) {
    if (!e || e.plugins != this.state.plugins || this.directPlugins != this.prevDirectPlugins) {
      this.prevDirectPlugins = this.directPlugins, this.destroyPluginViews();
      for (let n = 0; n < this.directPlugins.length; n++) {
        let r = this.directPlugins[n];
        r.spec.view && this.pluginViews.push(r.spec.view(this));
      }
      for (let n = 0; n < this.state.plugins.length; n++) {
        let r = this.state.plugins[n];
        r.spec.view && this.pluginViews.push(r.spec.view(this));
      }
    } else
      for (let n = 0; n < this.pluginViews.length; n++) {
        let r = this.pluginViews[n];
        r.update && r.update(this, e);
      }
  }
  updateDraggedNode(e, n) {
    let r = e.node, i = -1;
    if (r.from < this.state.doc.content.size && this.state.doc.nodeAt(r.from) == r.node)
      i = r.from;
    else {
      let s = r.from + (this.state.doc.content.size - n.doc.content.size);
      (s > 0 && s < this.state.doc.content.size && this.state.doc.nodeAt(s)) == r.node && (i = s);
    }
    this.dragging = new Vd(e.slice, e.move, i < 0 ? void 0 : ce.create(this.state.doc, i));
  }
  someProp(e, n) {
    let r = this._props && this._props[e], i;
    if (r != null && (i = n ? n(r) : r))
      return i;
    for (let o = 0; o < this.directPlugins.length; o++) {
      let l = this.directPlugins[o].props[e];
      if (l != null && (i = n ? n(l) : l))
        return i;
    }
    let s = this.state.plugins;
    if (s)
      for (let o = 0; o < s.length; o++) {
        let l = s[o].props[e];
        if (l != null && (i = n ? n(l) : l))
          return i;
      }
  }
  /**
  Query whether the view has focus.
  */
  hasFocus() {
    if (tt) {
      let e = this.root.activeElement;
      if (e == this.dom)
        return !0;
      if (!e || !this.dom.contains(e))
        return !1;
      for (; e && this.dom != e && this.dom.contains(e); ) {
        if (e.contentEditable == "false")
          return !1;
        e = e.parentElement;
      }
      return !0;
    }
    return this.root.activeElement == this.dom;
  }
  /**
  Focus the editor.
  */
  focus() {
    this.domObserver.stop(), this.editable && _b(this.dom), Zt(this), this.domObserver.start();
  }
  /**
  Get the document root in which the editor exists. This will
  usually be the top-level `document`, but might be a [shadow
  DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Shadow_DOM)
  root if the editor is inside one.
  */
  get root() {
    let e = this._root;
    if (e == null) {
      for (let n = this.dom.parentNode; n; n = n.parentNode)
        if (n.nodeType == 9 || n.nodeType == 11 && n.host)
          return n.getSelection || (Object.getPrototypeOf(n).getSelection = () => n.ownerDocument.getSelection()), this._root = n;
    }
    return e || document;
  }
  /**
  When an existing editor view is moved to a new document or
  shadow tree, call this to make it recompute its root.
  */
  updateRoot() {
    this._root = null;
  }
  /**
  Given a pair of viewport coordinates, return the document
  position that corresponds to them. May return null if the given
  coordinates aren't inside of the editor. When an object is
  returned, its `pos` property is the position nearest to the
  coordinates, and its `inside` property holds the position of the
  inner node that the position falls inside of, or -1 if it is at
  the top level, not in any node.
  */
  posAtCoords(e) {
    return Ob(this, e);
  }
  /**
  Returns the viewport rectangle at a given document position.
  `left` and `right` will be the same number, as this returns a
  flat cursor-ish rectangle. If the position is between two things
  that aren't directly adjacent, `side` determines which element
  is used. When < 0, the element before the position is used,
  otherwise the element after.
  */
  coordsAtPos(e, n = 1) {
    return kd(this, e, n);
  }
  /**
  Find the DOM position that corresponds to the given document
  position. When `side` is negative, find the position as close as
  possible to the content before the position. When positive,
  prefer positions close to the content after the position. When
  zero, prefer as shallow a position as possible.
  
  Note that you should **not** mutate the editor's internal DOM,
  only inspect it (and even that is usually not necessary).
  */
  domAtPos(e, n = 0) {
    return this.docView.domFromPos(e, n);
  }
  /**
  Find the DOM node that represents the document node after the
  given position. May return `null` when the position doesn't point
  in front of a node or if the node is inside an opaque node view.
  
  This is intended to be able to call things like
  `getBoundingClientRect` on that DOM node. Do **not** mutate the
  editor DOM directly, or add styling this way, since that will be
  immediately overriden by the editor as it redraws the node.
  */
  nodeDOM(e) {
    let n = this.docView.descAt(e);
    return n ? n.nodeDOM : null;
  }
  /**
  Find the document position that corresponds to a given DOM
  position. (Whenever possible, it is preferable to inspect the
  document structure directly, rather than poking around in the
  DOM, but sometimes—for example when interpreting an event
  target—you don't have a choice.)
  
  The `bias` parameter can be used to influence which side of a DOM
  node to use when the position is inside a leaf node.
  */
  posAtDOM(e, n, r = -1) {
    let i = this.docView.posFromDOM(e, n, r);
    if (i == null)
      throw new RangeError("DOM position not inside the editor");
    return i;
  }
  /**
  Find out whether the selection is at the end of a textblock when
  moving in a given direction. When, for example, given `"left"`,
  it will return true if moving left from the current cursor
  position would leave that position's parent textblock. Will apply
  to the view's current state by default, but it is possible to
  pass a different state.
  */
  endOfTextblock(e, n) {
    return Lb(this, n || this.state, e);
  }
  /**
  Run the editor's paste logic with the given HTML string. The
  `event`, if given, will be passed to the
  [`handlePaste`](https://prosemirror.net/docs/ref/#view.EditorProps.handlePaste) hook.
  */
  pasteHTML(e, n) {
    return Yr(this, "", e, !1, n || new ClipboardEvent("paste"));
  }
  /**
  Run the editor's paste logic with the given plain-text input.
  */
  pasteText(e, n) {
    return Yr(this, e, null, !0, n || new ClipboardEvent("paste"));
  }
  /**
  Serialize the given slice as it would be if it was copied from
  this editor. Returns a DOM element that contains a
  representation of the slice as its children, a textual
  representation, and the transformed slice (which can be
  different from the given input due to hooks like
  [`transformCopied`](https://prosemirror.net/docs/ref/#view.EditorProps.transformCopied)).
  */
  serializeForClipboard(e) {
    return Yl(this, e);
  }
  /**
  Removes the editor from the DOM and destroys all [node
  views](https://prosemirror.net/docs/ref/#view.NodeView).
  */
  destroy() {
    this.docView && (fx(this), this.destroyPluginViews(), this.mounted ? (this.docView.update(this.state.doc, [], oo(this), this), this.dom.textContent = "") : this.dom.parentNode && this.dom.parentNode.removeChild(this.dom), this.docView.destroy(), this.docView = null, mb());
  }
  /**
  This is true when the view has been
  [destroyed](https://prosemirror.net/docs/ref/#view.EditorView.destroy) (and thus should not be
  used anymore).
  */
  get isDestroyed() {
    return this.docView == null;
  }
  /**
  Used for testing.
  */
  dispatchEvent(e) {
    return px(this, e);
  }
  /**
  @internal
  */
  domSelectionRange() {
    let e = this.dom.isConnected !== !1 && this.domSelection();
    return e ? Ge && this.root.nodeType === 11 && bb(this.dom.ownerDocument) == this.dom && Fx(this, e) || e : { focusNode: null, focusOffset: 0, anchorNode: null, anchorOffset: 0 };
  }
  /**
  @internal
  */
  domSelection() {
    return this.root.getSelection();
  }
}
Kd.prototype.dispatch = function(t) {
  let e = this._props.dispatchTransaction;
  e ? e.call(this, t) : this.updateState(this.state.apply(t));
};
function jc(t) {
  let e = /* @__PURE__ */ Object.create(null);
  return e.class = "ProseMirror", e.contenteditable = String(t.editable), t.someProp("attributes", (n) => {
    if (typeof n == "function" && (n = n(t.state)), n)
      for (let r in n)
        r == "class" ? e.class += " " + n[r] : r == "style" ? e.style = (e.style ? e.style + ";" : "") + n[r] : !e[r] && r != "contenteditable" && r != "nodeName" && (e[r] = String(n[r]));
  }), e.translate || (e.translate = "no"), [He.node(0, t.state.doc.content.size, e)];
}
function Vc(t) {
  if (t.markCursor) {
    let e = document.createElement("img");
    e.className = "ProseMirror-separator", e.setAttribute("mark-placeholder", "true"), e.setAttribute("alt", ""), t.cursorWrapper = { dom: e, deco: He.widget(t.state.selection.from, e, { raw: !0, marks: t.markCursor }) };
  } else
    t.cursorWrapper = null;
}
function Wc(t) {
  return !t.someProp("editable", (e) => e(t.state) === !1);
}
function Zx(t, e) {
  let n = Math.min(t.$anchor.sharedDepth(t.head), e.$anchor.sharedDepth(e.head));
  return t.$anchor.start(n) != e.$anchor.start(n);
}
function Hc(t) {
  let e = /* @__PURE__ */ Object.create(null);
  function n(r) {
    for (let i in r)
      Object.prototype.hasOwnProperty.call(e, i) || (e[i] = r[i]);
  }
  return t.someProp("nodeViews", n), t.someProp("markViews", n), e;
}
function Yx(t, e) {
  let n = 0, r = 0;
  for (let i in t) {
    if (t[i] != e[i])
      return !0;
    n++;
  }
  for (let i in e)
    r++;
  return n != r;
}
function Uc(t) {
  if (t.spec.state || t.spec.filterTransaction || t.spec.appendTransaction)
    throw new RangeError("Plugins passed directly to the view must not have a state component");
}
function Xt(t, e) {
  return t.meta = {
    package: "@milkdown/core",
    group: "System",
    ...e
  }, t;
}
var Jd = {
  text: (t, e, n, r) => {
    const i = t.value;
    return /^[^*_\\]*\s+$/.test(i) ? i : n.safe(i, {
      ...r,
      encode: []
    });
  },
  strong: (t, e, n, r) => {
    const i = t.marker || n.options.strong || "*", s = n.enter("strong"), o = n.createTracker(r);
    let l = o.move(i + i);
    return l += o.move(n.containerPhrasing(t, {
      before: l,
      after: i,
      ...o.current()
    })), l += o.move(i + i), s(), l;
  },
  emphasis: (t, e, n, r) => {
    const i = t.marker || n.options.emphasis || "*", s = n.enter("emphasis"), o = n.createTracker(r);
    let l = o.move(i);
    return l += o.move(n.containerPhrasing(t, {
      before: l,
      after: i,
      ...o.current()
    })), l += o.move(i), s(), l;
  }
}, yn = ke({}, "editorView"), Ar = ke({}, "editorState"), ao = ke([], "initTimer"), qc = ke({}, "editor"), Qr = ke([], "inputRules"), xn = ke([], "prosePlugins"), ei = ke([], "remarkPlugins"), hl = ke([], "nodeView"), fl = ke([], "markView"), Ln = ke(qo().use(Bo).use(Wo), "remark"), Br = ke({
  handlers: Jd,
  encode: []
}, "remarkStringifyOptions"), Pi = Ft("ConfigReady");
function Xx(t) {
  const e = (n) => (n.record(Pi), async () => (await t(n), n.done(Pi), () => {
    n.clearTimer(Pi);
  }));
  return Xt(e, { displayName: "Config" }), e;
}
var Bn = Ft("InitReady");
function Qx(t) {
  const e = (n) => (n.inject(qc, t).inject(xn, []).inject(ei, []).inject(Qr, []).inject(hl, []).inject(fl, []).inject(Br, {
    handlers: Jd,
    encode: []
  }).inject(Ln, qo().use(Bo).use(Wo)).inject(ao, [Pi]).record(Bn), async () => {
    await n.waitTimers(ao);
    const r = n.get(Br);
    return n.set(Ln, qo().use(Bo).use(Wo, r)), n.done(Bn), () => {
      n.remove(qc).remove(xn).remove(ei).remove(Qr).remove(hl).remove(fl).remove(Br).remove(Ln).remove(ao).clearTimer(Bn);
    };
  });
  return Xt(e, { displayName: "Init" }), e;
}
var nt = Ft("SchemaReady"), uo = ke([], "schemaTimer"), kn = ke({}, "schema"), Fr = ke([], "nodes"), $r = ke([], "marks");
function Kc(t) {
  return {
    ...t,
    parseDOM: t.parseDOM?.map((e) => ({
      priority: t.priority,
      ...e
    }))
  };
}
var Gd = (t) => (t.inject(kn, {}).inject(Fr, []).inject($r, []).inject(uo, [Bn]).record(nt), async () => {
  await t.waitTimers(uo);
  const e = t.get(Ln), n = t.get(ei).reduce((o, l) => o.use(l.plugin, l.options), e);
  t.set(Ln, n);
  const r = Object.fromEntries(t.get(Fr).map(([o, l]) => [o, Kc(l)])), i = Object.fromEntries(t.get($r).map(([o, l]) => [o, Kc(l)])), s = new j0({
    nodes: r,
    marks: i
  });
  return t.set(kn, s), t.done(nt), () => {
    t.remove(kn).remove(Fr).remove($r).remove(uo).clearTimer(nt);
  };
});
Xt(Gd, { displayName: "Schema" });
var Zd = class {
  constructor() {
    this.#t = new Mh(), this.#e = null, this.setCtx = (t) => {
      this.#e = t;
    }, this.chain = () => {
      if (this.#e == null) throw Ps();
      const t = this.#e, e = [], n = this.get.bind(this), r = {
        run: () => {
          const s = dr(...e), o = t.get(yn);
          return s(o.state, o.dispatch, o);
        },
        inline: (s) => (e.push(s), r),
        pipe: i.bind(this)
      };
      function i(s, o) {
        const l = n(s);
        return e.push(l(o)), r;
      }
      return r;
    };
  }
  #t;
  #e;
  get ctx() {
    return this.#e;
  }
  create(t, e) {
    const n = t.create(this.#t.sliceMap);
    return n.set(e), n;
  }
  get(t) {
    return this.#t.get(t).get();
  }
  remove(t) {
    return this.#t.remove(t);
  }
  call(t, e) {
    if (this.#e == null) throw Ps();
    const n = this.get(t)(e), r = this.#e.get(yn);
    return n(r.state, r.dispatch, r);
  }
  inline(t) {
    if (this.#e == null) throw Ps();
    const e = this.#e.get(yn);
    return t(e.state, e.dispatch, e);
  }
};
function eC(t = "cmdKey") {
  return ke((() => () => !1), t);
}
var ve = ke(new Zd(), "commands"), co = ke([nt], "commandsTimer"), jr = Ft("CommandsReady"), Yd = (t) => {
  const e = new Zd();
  return e.setCtx(t), t.inject(ve, e).inject(co, [nt]).record(jr), async () => (await t.waitTimers(co), t.done(jr), () => {
    t.remove(ve).remove(co).clearTimer(jr);
  });
};
Xt(Yd, { displayName: "Commands" });
function tC(t) {
  return t.Backspace = dr(j1, Vl, C1, Yf), t;
}
var Xd = class {
  constructor() {
    this.#t = null, this.#e = [], this.setCtx = (t) => {
      this.#t = t;
    }, this.add = (t) => (this.#e.push(t), () => {
      this.#e = this.#e.filter((e) => e !== t);
    }), this.addObjectKeymap = (t) => {
      const e = [];
      return Object.entries(t).forEach(([n, r]) => {
        if (typeof r == "function") {
          const i = {
            key: n,
            onRun: () => r
          };
          this.#e.push(i), e.push(() => {
            this.#e = this.#e.filter((s) => s !== i);
          });
        } else
          this.#e.push(r), e.push(() => {
            this.#e = this.#e.filter((i) => i !== r);
          });
      }), () => {
        e.forEach((n) => n());
      };
    }, this.addBaseKeymap = () => {
      const t = tC(F1);
      return this.addObjectKeymap(t);
    }, this.build = () => {
      const t = {};
      return this.#e.forEach((e) => {
        t[e.key] = [...t[e.key] || [], e];
      }), Object.fromEntries(Object.entries(t).map(([e, n]) => {
        const r = n.sort((s, o) => (o.priority ?? 50) - (s.priority ?? 50));
        return [e, (s, o, l) => {
          const a = this.#t;
          if (a == null) throw ys();
          const u = r.map((c) => c.onRun(a));
          return dr(...u)(s, o, l);
        }];
      }));
    };
  }
  #t;
  #e;
  get ctx() {
    return this.#t;
  }
}, cs = ke(new Xd(), "keymap"), ho = ke([nt], "keymapTimer"), Vr = Ft("KeymapReady"), nC = (t) => {
  const e = new Xd();
  return e.setCtx(t), t.inject(cs, e).inject(ho, [nt]).record(Vr), async () => (await t.waitTimers(ho), t.done(Vr), () => {
    t.remove(cs).remove(ho).clearTimer(Vr);
  });
}, Li = Ft("ParserReady"), Qd = (() => {
  throw ys();
}), Bi = ke(Qd, "parser"), fo = ke([], "parserTimer"), ep = (t) => (t.inject(Bi, Qd).inject(fo, [nt]).record(Li), async () => {
  await t.waitTimers(fo);
  const e = t.get(Ln), n = t.get(kn);
  return t.set(Bi, fb.create(n, e)), t.done(Li), () => {
    t.remove(Bi).remove(fo).clearTimer(Li);
  };
});
Xt(ep, { displayName: "Parser" });
var Wr = Ft("SerializerReady"), po = ke([], "serializerTimer"), tp = (() => {
  throw ys();
}), Fi = ke(tp, "serializer"), np = (t) => (t.inject(Fi, tp).inject(po, [nt]).record(Wr), async () => {
  await t.waitTimers(po);
  const e = t.get(Ln), n = t.get(kn);
  return t.set(Fi, pb.create(n, e)), t.done(Wr), () => {
    t.remove(Fi).remove(po).clearTimer(Wr);
  };
});
Xt(np, { displayName: "Serializer" });
var $i = ke("", "defaultValue"), mo = ke((t) => t, "stateOptions"), go = ke([], "editorStateTimer"), ji = Ft("EditorStateReady");
function rC(t, e, n) {
  if (typeof t == "string") return e(t);
  if (t.type === "html") return ir.fromSchema(n).parse(t.dom);
  if (t.type === "json") return bt.fromJSON(n, t.value);
  throw Lg(t);
}
var iC = new st("MILKDOWN_STATE_TRACKER"), rp = (t) => (t.inject($i, "").inject(Ar, {}).inject(mo, (e) => e).inject(go, [
  Li,
  Wr,
  jr,
  Vr
]).record(ji), async () => {
  await t.waitTimers(go);
  const e = t.get(kn), n = t.get(Bi), r = t.get(Qr), i = t.get(mo), s = t.get(xn), o = rC(t.get($i), n, e), l = t.get(cs), a = l.addBaseKeymap(), u = [
    ...s,
    new it({
      key: iC,
      state: {
        init: () => {
        },
        apply: (d, f, p, m) => {
          t.set(Ar, m);
        }
      }
    }),
    G1({ rules: r }),
    cb(l.build())
  ];
  t.set(xn, u);
  const c = i({
    schema: e,
    doc: o,
    plugins: u
  }), h = tr.create(c);
  return t.set(Ar, h), t.done(ji), () => {
    a(), t.remove($i).remove(Ar).remove(mo).remove(go).clearTimer(ji);
  };
});
Xt(rp, { displayName: "EditorState" });
var ti = ke([], "pasteRule"), yo = ke([nt], "pasteRuleTimer"), Vi = Ft("PasteRuleReady"), ip = (t) => (t.inject(ti, []).inject(yo, [nt]).record(Vi), async () => (await t.waitTimers(yo), t.done(Vi), () => {
  t.remove(ti).remove(yo).clearTimer(Vi);
}));
Xt(ip, { displayName: "PasteRule" });
var Wi = Ft("EditorViewReady"), ko = ke([], "editorViewTimer"), Hi = ke({}, "editorViewOptions"), Ui = ke(null, "root"), dl = ke(null, "rootDOM"), pl = ke({}, "rootAttrs");
function sC(t, e) {
  const n = document.createElement("div");
  n.className = "milkdown", t.appendChild(n), e.set(dl, n);
  const r = e.get(pl);
  return Object.entries(r).forEach(([i, s]) => n.setAttribute(i, s)), n;
}
function oC(t) {
  t.classList.add("editor"), t.setAttribute("role", "textbox");
}
var lC = new st("MILKDOWN_VIEW_CLEAR"), sp = (t) => (t.inject(Ui, document.body).inject(yn, {}).inject(Hi, {}).inject(dl, null).inject(pl, {}).inject(ko, [ji, Vi]).record(Wi), async () => {
  await t.wait(Bn);
  const e = t.get(Ui) || document.body, n = typeof e == "string" ? document.querySelector(e) : e;
  t.update(xn, (a) => [new it({
    key: lC,
    view: (u) => {
      const c = n ? sC(n, t) : void 0;
      return (() => {
        if (c && n) {
          const d = u.dom;
          n.replaceChild(c, d), c.appendChild(d);
        }
      })(), { destroy: () => {
        c?.parentNode && c?.parentNode.replaceChild(u.dom, c), c?.remove();
      } };
    }
  }), ...a]), await t.waitTimers(ko);
  const r = t.get(Ar), i = t.get(Hi), s = Object.fromEntries(t.get(hl)), o = Object.fromEntries(t.get(fl)), l = new Kd(n, {
    state: r,
    nodeViews: s,
    markViews: o,
    transformPasted: (a, u, c) => (t.get(ti).sort((h, d) => (d.priority ?? 50) - (h.priority ?? 50)).map((h) => h.run).forEach((h) => {
      a = h(a, u, c);
    }), a),
    ...i
  });
  return oC(l.dom), t.set(yn, l), t.done(Wi), () => {
    l?.destroy(), t.remove(Ui).remove(yn).remove(Hi).remove(dl).remove(pl).remove(ko).clearTimer(Wi);
  };
});
Xt(sp, { displayName: "EditorView" });
var aC = class op {
  constructor() {
    this.#t = !1, this.#e = "Idle", this.#r = [], this.#n = () => {
    }, this.#s = new Mh(), this.#o = new Gg(), this.#i = /* @__PURE__ */ new Map(), this.#l = /* @__PURE__ */ new Map(), this.#a = new Jg(this.#s, this.#o), this.#f = () => {
      const e = Xx(async (r) => {
        await Promise.all(this.#r.map((i) => Promise.resolve(i(r))));
      }), n = [
        Gd,
        ep,
        np,
        Yd,
        nC,
        ip,
        rp,
        sp,
        Qx(this),
        e
      ];
      this.#u(n, this.#l);
    }, this.#u = (e, n) => {
      e.forEach((r) => {
        const i = this.#a.produce(this.#t ? r.meta : void 0), s = r(i);
        n.set(r, {
          ctx: i,
          handler: s,
          cleanup: void 0
        });
      });
    }, this.#c = (e, n = !1) => Promise.all([e].flat().map(async (r) => {
      const i = this.#i.get(r)?.cleanup;
      return n ? this.#i.delete(r) : this.#i.set(r, {
        ctx: void 0,
        handler: void 0,
        cleanup: void 0
      }), typeof i == "function" ? i() : i;
    })), this.#d = async () => {
      await Promise.all([...this.#l.entries()].map(async ([e, { cleanup: n }]) => typeof n == "function" ? n() : n)), this.#l.clear();
    }, this.#h = (e) => {
      this.#e = e, this.#n(e);
    }, this.#p = (e) => [...e.entries()].map(async ([n, r]) => {
      const { ctx: i, handler: s } = r;
      if (!s) return;
      const o = await s();
      e.set(n, {
        ctx: i,
        handler: s,
        cleanup: o
      });
    }), this.enableInspector = (e = !0) => (this.#t = e, this), this.onStatusChange = (e) => (this.#n = e, this), this.config = (e) => (this.#r.push(e), this), this.removeConfig = (e) => (this.#r = this.#r.filter((n) => n !== e), this), this.use = (e) => {
      const n = [e].flat();
      return n.flat().forEach((r) => {
        this.#i.set(r, {
          ctx: void 0,
          handler: void 0,
          cleanup: void 0
        });
      }), this.#e === "Created" && this.#u(n, this.#i), this;
    }, this.remove = async (e) => this.#e === "OnCreate" ? (console.warn("[Milkdown]: You are trying to remove plugins when the editor is creating, this is not recommended, please check your code."), new Promise((n) => {
      setTimeout(() => {
        n(this.remove(e));
      }, 50);
    })) : (await this.#c([e].flat(), !0), this), this.create = async () => this.#e === "OnCreate" ? this : (this.#e === "Created" && await this.destroy(), this.#h("OnCreate"), this.#f(), this.#u([...this.#i.keys()], this.#i), await Promise.all([this.#p(this.#l), this.#p(this.#i)].flat()), this.#h("Created"), this), this.destroy = async (e = !1) => this.#e === "Destroyed" || this.#e === "OnDestroy" ? this : this.#e === "OnCreate" ? new Promise((n) => {
      setTimeout(() => {
        n(this.destroy(e));
      }, 50);
    }) : (e && (this.#r = []), this.#h("OnDestroy"), await this.#c([...this.#i.keys()], e), await this.#d(), this.#h("Destroyed"), this), this.action = (e) => e(this.#a), this.inspect = () => this.#t ? [...this.#l.values(), ...this.#i.values()].map(({ ctx: e }) => e?.inspector?.read()).filter((e) => !!e) : (console.warn("[Milkdown]: You are trying to collect inspection when inspector is disabled, please enable inspector by `editor.enableInspector()` first."), []);
  }
  static make() {
    return new op();
  }
  #t;
  #e;
  #r;
  #n;
  #s;
  #o;
  #i;
  #l;
  #a;
  #f;
  #u;
  #c;
  #d;
  #h;
  #p;
  get ctx() {
    return this.#a;
  }
  get status() {
    return this.#e;
  }
};
function lp(t, e, n) {
  const r = t.findIndex(([s]) => s === e);
  if (r === -1) return [...t, n];
  const i = t.slice();
  return i[r] = n, i;
}
function fe(t, e) {
  const n = eC(t), r = (i) => async () => {
    r.key = n, await i.wait(jr);
    const s = e(i);
    return i.get(ve).create(n, s), r.run = (o) => i.get(ve).call(t, o), () => {
      i.get(ve).remove(n);
    };
  };
  return r;
}
function ot(t) {
  const e = (n) => async () => {
    await n.wait(nt);
    const r = t(n);
    return n.update(Qr, (i) => [...i, r]), e.inputRule = r, () => {
      n.update(Qr, (i) => i.filter((s) => s !== r));
    };
  };
  return e;
}
function uC(t) {
  const e = (n) => async () => {
    await n.wait(nt);
    const r = t(n);
    return n.update(ti, (i) => [...i, r]), e.pasteRule = r, () => {
      n.update(ti, (i) => i.filter((s) => s !== r));
    };
  };
  return e;
}
function cC(t, e) {
  const n = (r) => async () => {
    const i = e(r);
    return r.update($r, (s) => lp(s, t, [t, i])), n.id = t, n.schema = i, () => {
      r.update($r, (s) => s.filter(([o]) => o !== t));
    };
  };
  return n.type = (r) => {
    const i = r.get(kn).marks[t];
    if (!i) throw Hg(t);
    return i;
  }, n;
}
function ra(t, e) {
  const n = (r) => async () => {
    const i = e(r);
    return r.update(Fr, (s) => lp(s, t, [t, i])), n.id = t, n.schema = i, () => {
      r.update(Fr, (s) => s.filter(([o]) => o !== t));
    };
  };
  return n.type = (r) => {
    const i = r.get(kn).nodes[t];
    if (!i) throw Wg(t);
    return i;
  }, n;
}
function Qt(t) {
  let e;
  const n = (r) => async () => (await r.wait(nt), e = t(r), r.update(xn, (i) => [...i, e]), () => {
    r.update(xn, (i) => i.filter((s) => s !== e));
  });
  return n.plugin = () => e, n.key = () => e.spec.key, n;
}
function hC(t) {
  const e = (n) => async () => {
    await n.wait(Vr);
    const r = n.get(cs), i = t(n), s = r.addObjectKeymap(i);
    return e.keymap = i, () => {
      s();
    };
  };
  return e;
}
function en(t, e) {
  const n = ke(t, e), r = (i) => (i.inject(n), () => () => {
    i.remove(n);
  });
  return r.key = n, r;
}
function Be(t, e) {
  const n = en(e, t), r = ra(t, (s) => s.get(n.key)(s)), i = [n, r];
  return i.id = r.id, i.node = r, i.type = (s) => r.type(s), i.ctx = n, i.key = n.key, i.extendSchema = (s) => Be(t, s(e)), i;
}
function pr(t, e) {
  const n = en(e, t), r = cC(t, (s) => s.get(n.key)(s)), i = [n, r];
  return i.id = r.id, i.mark = r, i.type = (s) => r.type(s), i.ctx = n, i.key = n.key, i.extendSchema = (s) => pr(t, s(e)), i;
}
function mt(t, e) {
  const n = en(Object.fromEntries(Object.entries(e).map(([s, { shortcuts: o, priority: l }]) => [s, {
    shortcuts: o,
    priority: l
  }])), `${t}Keymap`), r = hC((s) => {
    const o = s.get(n.key), l = Object.entries(e).flatMap(([a, { command: u }]) => {
      const c = o[a], h = [c.shortcuts].flat(), d = c.priority;
      return h.map((f) => [f, {
        key: f,
        onRun: u,
        priority: d
      }]);
    });
    return Object.fromEntries(l);
  }), i = [n, r];
  return i.ctx = n, i.shortcuts = r, i.key = n.key, i.keymap = r.keymap, i;
}
var Mt = (t, e = () => ({})) => en(e, `${t}Attr`), ui = (t, e = () => ({})) => en(e, `${t}Attr`);
function Nn(t, e, n) {
  const r = en({}, t), i = (o) => async () => {
    await o.wait(Bn);
    const l = {
      plugin: e(o),
      options: o.get(r.key)
    };
    return o.update(ei, (a) => [...a, l]), () => {
      o.update(ei, (a) => a.filter((u) => u !== l));
    };
  }, s = [r, i];
  return s.id = t, s.plugin = i, s.options = r, s;
}
function fC(t, e) {
  return function(n, r) {
    let { $from: i, $to: s, node: o } = n.selection;
    if (o && o.isBlock || i.depth < 2 || !i.sameParent(s))
      return !1;
    let l = i.node(-1);
    if (l.type != t)
      return !1;
    if (i.parent.content.size == 0 && i.node(-1).childCount == i.indexAfter(-1)) {
      if (i.depth == 3 || i.node(-3).type != t || i.index(-2) != i.node(-2).childCount - 1)
        return !1;
      if (r) {
        let h = K.empty, d = i.index(-1) ? 1 : i.index(-2) ? 2 : 3;
        for (let g = i.depth - d; g >= i.depth - 3; g--)
          h = K.from(i.node(g).copy(h));
        let f = i.indexAfter(-1) < i.node(-2).childCount ? 1 : i.indexAfter(-2) < i.node(-3).childCount ? 2 : 3;
        h = h.append(K.from(t.createAndFill()));
        let p = i.before(i.depth - (d - 1)), m = n.tr.replace(p, i.after(-f), new ne(h, 4 - d, 0)), y = -1;
        m.doc.nodesBetween(p, m.doc.content.size, (g, b) => {
          if (y > -1)
            return !1;
          g.isTextblock && g.content.size == 0 && (y = b + 1);
        }), y > -1 && m.setSelection(he.near(m.doc.resolve(y))), r(m.scrollIntoView());
      }
      return !0;
    }
    let a = s.pos == i.end() ? l.contentMatchAt(0).defaultType : null, u = n.tr.delete(i.pos, s.pos), c = a ? [null, { type: a }] : void 0;
    return zr(u.doc, i.pos, 2, c) ? (r && r(u.split(i.pos, 2, c).scrollIntoView()), !0) : !1;
  };
}
function dC(t) {
  return function(e, n) {
    let { $from: r, $to: i } = e.selection, s = r.blockRange(i, (o) => o.childCount > 0 && o.firstChild.type == t);
    return s ? n ? r.node(s.depth - 1).type == t ? pC(e, n, t, s) : mC(e, n, s) : !0 : !1;
  };
}
function pC(t, e, n, r) {
  let i = t.tr, s = r.end, o = r.$to.end(r.depth);
  s < o && (i.step(new Je(s - 1, o, s, o, new ne(K.from(n.create(null, r.parent.copy())), 1, 0), 1, !0)), r = new vf(i.doc.resolve(r.$from.pos), i.doc.resolve(o), r.depth));
  const l = Ss(r);
  if (l == null)
    return !1;
  i.lift(r, l);
  let a = i.doc.resolve(i.mapping.map(s, -1) - 1);
  return vs(i.doc, a.pos) && a.nodeBefore.type == a.nodeAfter.type && i.join(a.pos), e(i.scrollIntoView()), !0;
}
function mC(t, e, n) {
  let r = t.tr, i = n.parent;
  for (let f = n.end, p = n.endIndex - 1, m = n.startIndex; p > m; p--)
    f -= i.child(p).nodeSize, r.delete(f - 1, f + 1);
  let s = r.doc.resolve(n.start), o = s.nodeAfter;
  if (r.mapping.map(n.end) != n.start + s.nodeAfter.nodeSize)
    return !1;
  let l = n.startIndex == 0, a = n.endIndex == i.childCount, u = s.node(-1), c = s.index(-1);
  if (!u.canReplace(c + (l ? 0 : 1), c + 1, o.content.append(a ? K.empty : K.from(i))))
    return !1;
  let h = s.pos, d = h + o.nodeSize;
  return r.step(new Je(h - (l ? 1 : 0), d + (a ? 1 : 0), h + 1, d - 1, new ne((l ? K.empty : K.from(i.copy(K.empty))).append(a ? K.empty : K.from(i.copy(K.empty))), l ? 0 : 1, a ? 0 : 1), l ? 0 : 1)), e(r.scrollIntoView()), !0;
}
function gC(t) {
  return function(e, n) {
    let { $from: r, $to: i } = e.selection, s = r.blockRange(i, (u) => u.childCount > 0 && u.firstChild.type == t);
    if (!s)
      return !1;
    let o = s.startIndex;
    if (o == 0)
      return !1;
    let l = s.parent, a = l.child(o - 1);
    if (a.type != t)
      return !1;
    if (n) {
      let u = a.lastChild && a.lastChild.type == l.type, c = K.from(u ? t.create() : null), h = new ne(K.from(t.create(null, K.from(l.type.create(null, c)))), u ? 3 : 1, 0), d = s.start, f = s.end;
      n(e.tr.step(new Je(d - (u ? 3 : 1), f, d, f, h, 1, !0)).scrollIntoView());
    }
    return !0;
  };
}
function yC(t) {
  const e = /* @__PURE__ */ new Map();
  if (!t || !t.type)
    throw new Error("mdast-util-definitions expected node");
  return hr(t, "definition", function(r) {
    const i = Jc(r.identifier);
    i && !e.get(i) && e.set(i, r);
  }), n;
  function n(r) {
    const i = Jc(r);
    return e.get(i);
  }
}
function Jc(t) {
  return String(t || "").toUpperCase();
}
function kC() {
  return function(t) {
    const e = yC(t);
    hr(t, function(n, r, i) {
      if (n.type === "definition" && i !== void 0 && typeof r == "number")
        return i.children.splice(r, 1), [Xi, r];
      if (n.type === "imageReference" || n.type === "linkReference") {
        const s = e(n.identifier);
        if (s && i && typeof r == "number")
          return i.children[r] = n.type === "imageReference" ? { type: "image", url: s.url, title: s.title, alt: n.alt } : {
            type: "link",
            url: s.url,
            title: s.title,
            children: n.children
          }, [Xi, r];
      }
    });
  };
}
function wC(t) {
  const e = { ...t };
  return e.position && (e.position = {
    start: { ...e.position.start },
    end: { ...e.position.end }
  }), delete e.children, e;
}
var bC = "<br />", xC = /^<br\s*\/?\s*>$/i, CC = (t) => typeof t == "string" && xC.test(t.trim());
function ap(t, e) {
  if (!(e.childCount >= 1 && e.lastChild?.type.name === "hardbreak")) {
    t.next(e.content);
    return;
  }
  const n = [];
  e.content.forEach((r, i, s) => {
    s !== e.childCount - 1 && n.push(r);
  }), t.next(K.fromArray(n));
}
function W(t, e) {
  return Object.assign(t, { meta: {
    package: "@milkdown/preset-commonmark",
    ...e
  } }), t;
}
var ia = ui("emphasis");
W(ia, {
  displayName: "Attr<emphasis>",
  group: "Emphasis"
});
var mr = pr("emphasis", (t) => ({
  attrs: { marker: {
    default: t.get(Br).emphasis || "*",
    validate: "string"
  } },
  parseDOM: [
    { tag: "i" },
    { tag: "em" },
    {
      style: "font-style",
      getAttrs: (e) => e === "italic"
    }
  ],
  toDOM: (e) => ["em", t.get(ia.key)(e)],
  parseMarkdown: {
    match: (e) => e.type === "emphasis",
    runner: (e, n, r) => {
      e.openMark(r, { marker: n.marker }), e.next(n.children), e.closeMark(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "emphasis",
    runner: (e, n) => {
      e.withMark(n, "emphasis", void 0, { marker: n.attrs.marker });
    }
  }
}));
W(mr.mark, {
  displayName: "MarkSchema<emphasis>",
  group: "Emphasis"
});
W(mr.ctx, {
  displayName: "MarkSchemaCtx<emphasis>",
  group: "Emphasis"
});
var sa = fe("ToggleEmphasis", (t) => () => _s(mr.type(t)));
W(sa, {
  displayName: "Command<toggleEmphasisCommand>",
  group: "Emphasis"
});
var up = ot((t) => ii(/(?:^|[^*])\*([^*]+)\*$/, mr.type(t), {
  getAttr: () => ({ marker: "*" }),
  updateCaptured: ({ fullMatch: e, start: n }) => e.startsWith("*") ? {} : {
    fullMatch: e.slice(1),
    start: n + 1
  }
}));
W(up, {
  displayName: "InputRule<emphasis>|Star",
  group: "Emphasis"
});
var cp = ot((t) => ii(/\b_(?![_\s])(.*?[^_\s])_$/, mr.type(t), {
  getAttr: () => ({ marker: "_" }),
  updateCaptured: ({ fullMatch: e, start: n }) => e.startsWith("_") ? {} : {
    fullMatch: e.slice(1),
    start: n + 1
  }
}));
W(cp, {
  displayName: "InputRule<emphasis>|Underscore",
  group: "Emphasis"
});
var oa = mt("emphasisKeymap", { ToggleEmphasis: {
  shortcuts: "Mod-i",
  command: (t) => {
    const e = t.get(ve);
    return () => e.call(sa.key);
  }
} });
W(oa.ctx, {
  displayName: "KeymapCtx<emphasis>",
  group: "Emphasis"
});
W(oa.shortcuts, {
  displayName: "Keymap<emphasis>",
  group: "Emphasis"
});
var la = ui("strong");
W(la, {
  displayName: "Attr<strong>",
  group: "Strong"
});
var ci = pr("strong", (t) => ({
  attrs: { marker: {
    default: t.get(Br).strong || "*",
    validate: "string"
  } },
  parseDOM: [
    {
      tag: "b",
      getAttrs: (e) => e.style.fontWeight != "normal" && null
    },
    { tag: "strong" },
    {
      style: "font-style",
      getAttrs: (e) => e === "bold"
    },
    {
      style: "font-weight=400",
      clearMark: (e) => e.type.name == "strong"
    },
    {
      style: "font-weight",
      getAttrs: (e) => /^(bold(er)?|[5-9]\d{2,})$/.test(e) && null
    }
  ],
  toDOM: (e) => ["strong", t.get(la.key)(e)],
  parseMarkdown: {
    match: (e) => e.type === "strong",
    runner: (e, n, r) => {
      e.openMark(r, { marker: n.marker }), e.next(n.children), e.closeMark(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "strong",
    runner: (e, n) => {
      e.withMark(n, "strong", void 0, { marker: n.attrs.marker });
    }
  }
}));
W(ci.mark, {
  displayName: "MarkSchema<strong>",
  group: "Strong"
});
W(ci.ctx, {
  displayName: "MarkSchemaCtx<strong>",
  group: "Strong"
});
var aa = fe("ToggleStrong", (t) => () => _s(ci.type(t)));
W(aa, {
  displayName: "Command<toggleStrongCommand>",
  group: "Strong"
});
var hp = ot((t) => ii(/(?<![\w:/])(?:\*\*|__)([^*_]+?)(?:\*\*|__)(?![\w/])$/, ci.type(t), { getAttr: (e) => ({ marker: e[0].startsWith("*") ? "*" : "_" }) }));
W(hp, {
  displayName: "InputRule<strong>",
  group: "Strong"
});
var ua = mt("strongKeymap", { ToggleBold: {
  shortcuts: ["Mod-b"],
  command: (t) => {
    const e = t.get(ve);
    return () => e.call(aa.key);
  }
} });
W(ua.ctx, {
  displayName: "KeymapCtx<strong>",
  group: "Strong"
});
W(ua.shortcuts, {
  displayName: "Keymap<strong>",
  group: "Strong"
});
var ca = ui("inlineCode");
W(ca, {
  displayName: "Attr<inlineCode>",
  group: "InlineCode"
});
var fn = pr("inlineCode", (t) => ({
  priority: 100,
  code: !0,
  inclusive: !1,
  parseDOM: [{ tag: "code" }],
  toDOM: (e) => ["code", t.get(ca.key)(e)],
  parseMarkdown: {
    match: (e) => e.type === "inlineCode",
    runner: (e, n, r) => {
      e.openMark(r), e.addText(n.value), e.closeMark(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "inlineCode",
    runner: (e, n, r) => (e.withMark(n, "inlineCode", r.text || ""), !0)
  }
}));
W(fn.mark, {
  displayName: "MarkSchema<inlineCode>",
  group: "InlineCode"
});
W(fn.ctx, {
  displayName: "MarkSchemaCtx<inlineCode>",
  group: "InlineCode"
});
var ha = fe("ToggleInlineCode", (t) => () => (e, n) => {
  const { selection: r, tr: i } = e;
  if (r.empty) return !1;
  const { from: s, to: o } = r;
  return e.doc.rangeHasMark(s, o, fn.type(t)) ? (n?.(i.removeMark(s, o, fn.type(t))), !0) : (Object.keys(e.schema.marks).filter((l) => l !== fn.type.name).map((l) => e.schema.marks[l]).forEach((l) => {
    i.removeMark(s, o, l);
  }), n?.(i.addMark(s, o, fn.type(t).create())), !0);
});
W(ha, {
  displayName: "Command<toggleInlineCodeCommand>",
  group: "InlineCode"
});
var fp = ot((t) => ii(/(?:`)([^`]+)(?:`)$/, fn.type(t)));
W(fp, {
  displayName: "InputRule<inlineCodeInputRule>",
  group: "InlineCode"
});
var fa = mt("inlineCodeKeymap", { ToggleInlineCode: {
  shortcuts: "Mod-e",
  command: (t) => {
    const e = t.get(ve);
    return () => e.call(ha.key);
  }
} });
W(fa.ctx, {
  displayName: "KeymapCtx<inlineCode>",
  group: "InlineCode"
});
W(fa.shortcuts, {
  displayName: "Keymap<inlineCode>",
  group: "InlineCode"
});
var SC = /* @__PURE__ */ new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
  "ftp:"
]);
function vC(t) {
  return t <= 32 || t >= 127 && t <= 160 || t >= 8203 && t <= 8205 || t === 8232 || t === 8233 || t === 65279;
}
function NC(t) {
  let e = "";
  for (const n of t) vC(n.codePointAt(0) ?? 0) || (e += n);
  return e;
}
function IC(t) {
  if (typeof t != "string") return "";
  const e = t.trim();
  if (!e) return "";
  const n = NC(e), r = /^([a-z][a-z0-9+.-]*):/i.exec(n)?.[1];
  return !r || SC.has(`${r.toLowerCase()}:`) ? e : "";
}
var da = ui("link");
W(da, {
  displayName: "Attr<link>",
  group: "Link"
});
var rr = pr("link", (t) => ({
  attrs: {
    href: { validate: "string" },
    title: {
      default: null,
      validate: "string|null"
    }
  },
  parseDOM: [{
    tag: "a[href]",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw Bt(e);
      return {
        href: e.getAttribute("href"),
        title: e.getAttribute("title")
      };
    }
  }],
  toDOM: (e) => ["a", {
    ...t.get(da.key)(e),
    ...e.attrs,
    href: IC(e.attrs.href)
  }],
  parseMarkdown: {
    match: (e) => e.type === "link",
    runner: (e, n, r) => {
      const i = n.url, s = n.title;
      e.openMark(r, {
        href: i,
        title: s
      }), e.next(n.children), e.closeMark(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "link",
    runner: (e, n) => {
      e.withMark(n, "link", void 0, {
        title: n.attrs.title,
        url: n.attrs.href
      });
    }
  }
}));
W(rr.mark, {
  displayName: "MarkSchema<link>",
  group: "Link"
});
var dp = fe("ToggleLink", (t) => (e = {}) => _s(rr.type(t), e));
W(dp, {
  displayName: "Command<toggleLinkCommand>",
  group: "Link"
});
var pp = fe("UpdateLink", (t) => (e = {}) => (n, r) => {
  if (!r) return !1;
  let i, s = -1;
  const { selection: o } = n, { from: l, to: a } = o;
  if (n.doc.nodesBetween(l, l === a ? a + 1 : a, (p, m) => {
    if (rr.type(t).isInSet(p.marks))
      return i = p, s = m, !1;
  }), !i) return !1;
  const u = i.marks.find(({ type: p }) => p === rr.type(t));
  if (!u) return !1;
  const c = s, h = s + i.nodeSize, { tr: d } = n, f = rr.type(t).create({
    ...u.attrs,
    ...e
  });
  return f ? (r(d.removeMark(c, h, u).addMark(c, h, f).setSelection(new pe(d.selection.$anchor)).scrollIntoView()), !0) : !1;
});
W(pp, {
  displayName: "Command<updateLinkCommand>",
  group: "Link"
});
var mp = ra("doc", () => ({
  content: "block+",
  parseMarkdown: {
    match: ({ type: t }) => t === "root",
    runner: (t, e, n) => {
      t.injectRoot(e, n);
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "doc",
    runner: (t, e) => {
      t.openNode("root");
      const n = e.childCount > 0 ? e.child(e.childCount - 1) : null, r = n?.type.name === "paragraph" && n.content.size === 0 ? e.content.cut(0, e.content.size - n.nodeSize) : e.content;
      t.next(r);
    }
  }
}));
W(mp, {
  displayName: "NodeSchema<doc>",
  group: "Doc"
});
var gp = Object.freeze([
  "root",
  "blockquote",
  "listItem",
  "footnoteDefinition"
]), _C = /* @__PURE__ */ new Set([
  "paragraph",
  "heading",
  "tableCell",
  "link",
  "linkReference",
  "emphasis",
  "strong",
  "delete",
  "footnote"
]), hs = en(gp, "blockContainerTypes");
W(hs, {
  displayName: "Ctx<blockContainerTypes>",
  group: "Remark"
});
var Gc = /* @__PURE__ */ new Set();
function yp(t) {
  const e = t.isInjected(hs.key) ? t.get(hs.key) : gp, n = /* @__PURE__ */ new Set();
  for (const r of e) {
    if (_C.has(r)) {
      Gc.has(r) || (Gc.add(r), console.warn(`[milkdown/preset-commonmark] "${r}" holds phrasing content and cannot be a block container; it is ignored in blockContainerTypes.`));
      continue;
    }
    n.add(r);
  }
  return n;
}
var TC = /* @__PURE__ */ new Set(["paragraph", "tableCell"]);
function AC(t, e) {
  return Ol(t, (n) => n.type === "html" && CC(n.value), (n, r) => {
    const i = r[r.length - 1];
    if (i) {
      if (TC.has(i.type)) {
        i.children.length === 1 && (i.children = []);
        return;
      }
      if (e.has(i.type)) {
        const s = n;
        return s.children = [], delete s.value, s.type = "paragraph", Xi;
      }
    }
  });
}
var Ms = Nn("remark-preserve-empty-line", (t) => () => (e) => AC(e, yp(t)));
W(Ms.plugin, {
  displayName: "Remark<remarkPreserveEmptyLine>",
  group: "Remark"
});
W(Ms.options, {
  displayName: "RemarkConfig<remarkPreserveEmptyLine>",
  group: "Remark"
});
var pa = Mt("paragraph");
W(pa, {
  displayName: "Attr<paragraph>",
  group: "Paragraph"
});
var Lt = Be("paragraph", (t) => ({
  content: "inline*",
  group: "block",
  parseDOM: [{ tag: "p" }],
  toDOM: (e) => [
    "p",
    t.get(pa.key)(e),
    0
  ],
  parseMarkdown: {
    match: (e) => e.type === "paragraph",
    runner: (e, n, r) => {
      e.openNode(r), n.children ? e.next(n.children) : e.addText(n.value || ""), e.closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "paragraph",
    runner: (e, n) => {
      e.openNode("paragraph"), (!n.content || n.content.size === 0) && EC(t) ? e.addNode("html", void 0, bC) : ap(e, n), e.closeNode();
    }
  }
}));
function EC(t) {
  return t.isInjected(Ms.options.key);
}
W(Lt.node, {
  displayName: "NodeSchema<paragraph>",
  group: "Paragraph"
});
W(Lt.ctx, {
  displayName: "NodeSchemaCtx<paragraph>",
  group: "Paragraph"
});
var ma = fe("TurnIntoText", (t) => () => Gr(Lt.type(t)));
W(ma, {
  displayName: "Command<turnIntoTextCommand>",
  group: "Paragraph"
});
var ga = mt("paragraphKeymap", { TurnIntoText: {
  shortcuts: "Mod-Alt-0",
  command: (t) => {
    const e = t.get(ve);
    return () => e.call(ma.key);
  }
} });
W(ga.ctx, {
  displayName: "KeymapCtx<paragraph>",
  group: "Paragraph"
});
W(ga.shortcuts, {
  displayName: "Keymap<paragraph>",
  group: "Paragraph"
});
var MC = Array(6).fill(0).map((t, e) => e + 1);
function OC(t) {
  return t.textContent.toLowerCase().trim().replace(/\s+/g, "-");
}
var Os = en(OC, "headingIdGenerator");
W(Os, {
  displayName: "Ctx<HeadingIdGenerator>",
  group: "Heading"
});
var ya = Mt("heading");
W(ya, {
  displayName: "Attr<heading>",
  group: "Heading"
});
var qn = Be("heading", (t) => {
  const e = t.get(Os.key);
  return {
    content: "inline*",
    group: "block",
    defining: !0,
    attrs: {
      id: {
        default: "",
        validate: "string"
      },
      level: {
        default: 1,
        validate: "number"
      }
    },
    parseDOM: MC.map((n) => ({
      tag: `h${n}`,
      getAttrs: (r) => {
        if (!(r instanceof HTMLElement)) throw Bt(r);
        return {
          level: n,
          id: r.id
        };
      }
    })),
    toDOM: (n) => [
      `h${n.attrs.level}`,
      {
        ...t.get(ya.key)(n),
        id: n.attrs.id || e(n)
      },
      0
    ],
    parseMarkdown: {
      match: ({ type: n }) => n === "heading",
      runner: (n, r, i) => {
        const s = r.depth;
        n.openNode(i, { level: s }), n.next(r.children), n.closeNode();
      }
    },
    toMarkdown: {
      match: (n) => n.type.name === "heading",
      runner: (n, r) => {
        n.openNode("heading", void 0, { depth: r.attrs.level }), ap(n, r), n.closeNode();
      }
    }
  };
});
W(qn.node, {
  displayName: "NodeSchema<heading>",
  group: "Heading"
});
W(qn.ctx, {
  displayName: "NodeSchemaCtx<heading>",
  group: "Heading"
});
var kp = ot((t) => nd(/^(?<hashes>#+)\s$/, qn.type(t), (e) => {
  const n = e.groups?.hashes?.length || 0, { $from: r } = t.get(yn).state.selection, i = r.node();
  if (i.type.name === "heading") {
    let s = Number(i.attrs.level) + Number(n);
    return s > 6 && (s = 6), { level: s };
  }
  return { level: n };
}));
W(kp, {
  displayName: "InputRule<wrapInHeadingInputRule>",
  group: "Heading"
});
var an = fe("WrapInHeading", (t) => (e) => (e ??= 1, e < 1 ? Gr(Lt.type(t)) : Gr(qn.type(t), { level: e })));
W(an, {
  displayName: "Command<wrapInHeadingCommand>",
  group: "Heading"
});
var ka = fe("DowngradeHeading", (t) => () => (e, n, r) => {
  const { $from: i } = e.selection, s = i.node();
  if (s.type !== qn.type(t) || !e.selection.empty || i.parentOffset !== 0) return !1;
  const o = s.attrs.level - 1;
  return o ? (n?.(e.tr.setNodeMarkup(e.selection.$from.before(), void 0, {
    ...s.attrs,
    level: o
  })), !0) : Gr(Lt.type(t))(e, n, r);
});
W(ka, {
  displayName: "Command<downgradeHeadingCommand>",
  group: "Heading"
});
var wa = mt("headingKeymap", {
  TurnIntoH1: {
    shortcuts: "Mod-Alt-1",
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(an.key, 1);
    }
  },
  TurnIntoH2: {
    shortcuts: "Mod-Alt-2",
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(an.key, 2);
    }
  },
  TurnIntoH3: {
    shortcuts: "Mod-Alt-3",
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(an.key, 3);
    }
  },
  TurnIntoH4: {
    shortcuts: "Mod-Alt-4",
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(an.key, 4);
    }
  },
  TurnIntoH5: {
    shortcuts: "Mod-Alt-5",
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(an.key, 5);
    }
  },
  TurnIntoH6: {
    shortcuts: "Mod-Alt-6",
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(an.key, 6);
    }
  },
  DowngradeHeading: {
    shortcuts: ["Delete", "Backspace"],
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(ka.key);
    }
  }
});
W(wa.ctx, {
  displayName: "KeymapCtx<heading>",
  group: "Heading"
});
W(wa.shortcuts, {
  displayName: "Keymap<heading>",
  group: "Heading"
});
var ba = Mt("blockquote");
W(ba, {
  displayName: "Attr<blockquote>",
  group: "Blockquote"
});
var hi = Be("blockquote", (t) => ({
  content: "block+",
  group: "block",
  defining: !0,
  parseDOM: [{ tag: "blockquote" }],
  toDOM: (e) => [
    "blockquote",
    t.get(ba.key)(e),
    0
  ],
  parseMarkdown: {
    match: ({ type: e }) => e === "blockquote",
    runner: (e, n, r) => {
      e.openNode(r).next(n.children).closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "blockquote",
    runner: (e, n) => {
      e.openNode("blockquote").next(n.content).closeNode();
    }
  }
}));
W(hi.node, {
  displayName: "NodeSchema<blockquote>",
  group: "Blockquote"
});
W(hi.ctx, {
  displayName: "NodeSchemaCtx<blockquote>",
  group: "Blockquote"
});
var wp = ot((t) => ql(/^\s*>\s$/, hi.type(t)));
W(wp, {
  displayName: "InputRule<wrapInBlockquoteInputRule>",
  group: "Blockquote"
});
var xa = fe("WrapInBlockquote", (t) => () => Ul(hi.type(t)));
W(xa, {
  displayName: "Command<wrapInBlockquoteCommand>",
  group: "Blockquote"
});
var Ca = mt("blockquoteKeymap", { WrapInBlockquote: {
  shortcuts: "Mod-Shift-b",
  command: (t) => {
    const e = t.get(ve);
    return () => e.call(xa.key);
  }
} });
W(Ca.ctx, {
  displayName: "KeymapCtx<blockquote>",
  group: "Blockquote"
});
W(Ca.shortcuts, {
  displayName: "Keymap<blockquote>",
  group: "Blockquote"
});
var Sa = Mt("codeBlock", () => ({
  pre: {},
  code: {}
}));
W(Sa, {
  displayName: "Attr<codeBlock>",
  group: "CodeBlock"
});
var fi = Be("code_block", (t) => ({
  content: "text*",
  group: "block",
  marks: "",
  defining: !0,
  code: !0,
  attrs: { language: {
    default: "",
    validate: "string"
  } },
  parseDOM: [{
    tag: "pre",
    preserveWhitespace: "full",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw Bt(e);
      return { language: e.dataset.language };
    }
  }],
  toDOM: (e) => {
    const n = t.get(Sa.key)(e), r = e.attrs.language, i = r && r.length > 0 ? { "data-language": r } : void 0;
    return [
      "pre",
      {
        ...n.pre,
        ...i
      },
      [
        "code",
        n.code,
        0
      ]
    ];
  },
  parseMarkdown: {
    match: ({ type: e }) => e === "code",
    runner: (e, n, r) => {
      const i = n.lang ?? "", s = n.value;
      e.openNode(r, { language: i }), s && e.addText(s), e.closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "code_block",
    runner: (e, n) => {
      e.addNode("code", void 0, n.content.firstChild?.text || "", { lang: n.attrs.language });
    }
  }
}));
W(fi.node, {
  displayName: "NodeSchema<codeBlock>",
  group: "CodeBlock"
});
W(fi.ctx, {
  displayName: "NodeSchemaCtx<codeBlock>",
  group: "CodeBlock"
});
var bp = ot((t) => nd(/^```(?<language>[a-z]*)?[\s\n]$/, fi.type(t), (e) => ({ language: e.groups?.language ?? "" })));
W(bp, {
  displayName: "InputRule<createCodeBlockInputRule>",
  group: "CodeBlock"
});
var va = fe("CreateCodeBlock", (t) => (e = "") => Gr(fi.type(t), { language: e }));
W(va, {
  displayName: "Command<createCodeBlockCommand>",
  group: "CodeBlock"
});
var DC = fe("UpdateCodeBlockLanguage", () => ({ pos: t, language: e } = {
  pos: -1,
  language: ""
}) => (n, r) => t >= 0 ? (r?.(n.tr.setNodeAttribute(t, "language", e)), !0) : !1);
W(DC, {
  displayName: "Command<updateCodeBlockLanguageCommand>",
  group: "CodeBlock"
});
var Na = mt("codeBlockKeymap", { CreateCodeBlock: {
  shortcuts: "Mod-Alt-c",
  command: (t) => {
    const e = t.get(ve);
    return () => e.call(va.key);
  }
} });
W(Na.ctx, {
  displayName: "KeymapCtx<codeBlock>",
  group: "CodeBlock"
});
W(Na.shortcuts, {
  displayName: "Keymap<codeBlock>",
  group: "CodeBlock"
});
var Ia = Mt("image");
W(Ia, {
  displayName: "Attr<image>",
  group: "Image"
});
var gr = Be("image", (t) => ({
  inline: !0,
  group: "inline",
  selectable: !0,
  draggable: !0,
  marks: "",
  atom: !0,
  defining: !0,
  isolating: !0,
  attrs: {
    src: {
      default: "",
      validate: "string"
    },
    alt: {
      default: "",
      validate: "string"
    },
    title: {
      default: "",
      validate: "string"
    }
  },
  parseDOM: [{
    tag: "img[src]",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw Bt(e);
      return {
        src: e.getAttribute("src") || "",
        alt: e.getAttribute("alt") || "",
        title: e.getAttribute("title") || e.getAttribute("alt") || ""
      };
    }
  }],
  toDOM: (e) => ["img", {
    ...t.get(Ia.key)(e),
    ...e.attrs
  }],
  parseMarkdown: {
    match: ({ type: e }) => e === "image",
    runner: (e, n, r) => {
      const i = n.url, s = n.alt, o = n.title;
      e.addNode(r, {
        src: i,
        alt: s,
        title: o
      });
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "image",
    runner: (e, n) => {
      e.addNode("image", void 0, void 0, {
        title: n.attrs.title,
        url: n.attrs.src,
        alt: n.attrs.alt
      });
    }
  }
}));
W(gr.node, {
  displayName: "NodeSchema<image>",
  group: "Image"
});
W(gr.ctx, {
  displayName: "NodeSchemaCtx<image>",
  group: "Image"
});
var xp = fe("InsertImage", (t) => (e = {}) => (n, r) => {
  if (!r) return !0;
  const { src: i = "", alt: s = "", title: o = "" } = e, l = gr.type(t).create({
    src: i,
    alt: s,
    title: o
  });
  return l && r(n.tr.replaceSelectionWith(l).scrollIntoView()), !0;
});
W(xp, {
  displayName: "Command<insertImageCommand>",
  group: "Image"
});
var Cp = fe("UpdateImage", (t) => (e = {}) => (n, r) => {
  const i = tb(n.selection, gr.type(t));
  if (!i) return !1;
  const { node: s, pos: o } = i, l = { ...s.attrs }, { src: a, alt: u, title: c } = e;
  return a !== void 0 && (l.src = a), u !== void 0 && (l.alt = u), c !== void 0 && (l.title = c), r?.(n.tr.setNodeMarkup(o, void 0, l).scrollIntoView()), !0;
});
W(Cp, {
  displayName: "Command<updateImageCommand>",
  group: "Image"
});
var RC = ot((t) => new pt(/!\[(?<alt>.*?)]\((?<filename>.*?)\s*(?="|\))"?(?<title>[^"]+)?"?\)/, (e, n, r, i) => {
  const [s, o, l = "", a] = n;
  return s ? e.tr.replaceWith(r, i, gr.type(t).create({
    src: l,
    alt: o,
    title: a
  })) : null;
}));
W(RC, {
  displayName: "InputRule<insertImageInputRule>",
  group: "Image"
});
var fs = Mt("hardbreak", (t) => ({
  "data-type": "hardbreak",
  "data-is-inline": t.attrs.isInline
}));
W(fs, {
  displayName: "Attr<hardbreak>",
  group: "Hardbreak"
});
var Fn = Be("hardbreak", (t) => ({
  inline: !0,
  group: "inline",
  attrs: { isInline: {
    default: !1,
    validate: "boolean"
  } },
  selectable: !1,
  parseDOM: [{ tag: "br" }, {
    tag: 'span[data-type="hardbreak"]',
    getAttrs: () => ({ isInline: !0 })
  }],
  toDOM: (e) => e.attrs.isInline ? [
    "span",
    t.get(fs.key)(e),
    " "
  ] : ["br", t.get(fs.key)(e)],
  parseMarkdown: {
    match: ({ type: e }) => e === "break",
    runner: (e, n, r) => {
      e.addNode(r, { isInline: !!n.data?.isInline });
    }
  },
  leafText: () => `
`,
  toMarkdown: {
    match: (e) => e.type.name === "hardbreak",
    runner: (e, n) => {
      n.attrs.isInline ? e.addNode("text", void 0, `
`) : e.addNode("break");
    }
  }
}));
W(Fn.node, {
  displayName: "NodeSchema<hardbreak>",
  group: "Hardbreak"
});
W(Fn.ctx, {
  displayName: "NodeSchemaCtx<hardbreak>",
  group: "Hardbreak"
});
var _a = fe("InsertHardbreak", (t) => () => (e, n) => {
  const { selection: r, tr: i } = e;
  if (!(r instanceof pe)) return !1;
  if (r.empty) {
    const s = r.$from.node();
    if (s.childCount > 0 && s.lastChild?.type.name === "hardbreak")
      return n?.(i.replaceRangeWith(r.to - 1, r.to, e.schema.node("paragraph")).setSelection(he.near(i.doc.resolve(r.to))).scrollIntoView()), !0;
  }
  return n?.(i.setMeta("hardbreak", !0).replaceSelectionWith(Fn.type(t).create()).scrollIntoView()), !0;
});
W(_a, {
  displayName: "Command<insertHardbreakCommand>",
  group: "Hardbreak"
});
var Ta = mt("hardbreakKeymap", { InsertHardbreak: {
  shortcuts: "Shift-Enter",
  command: (t) => {
    const e = t.get(ve);
    return () => e.call(_a.key);
  }
} });
W(Ta.ctx, {
  displayName: "KeymapCtx<hardbreak>",
  group: "Hardbreak"
});
W(Ta.shortcuts, {
  displayName: "Keymap<hardbreak>",
  group: "Hardbreak"
});
var Aa = Mt("hr");
W(Aa, {
  displayName: "Attr<hr>",
  group: "Hr"
});
var di = Be("hr", (t) => ({
  group: "block",
  parseDOM: [{ tag: "hr" }],
  toDOM: (e) => ["hr", t.get(Aa.key)(e)],
  parseMarkdown: {
    match: ({ type: e }) => e === "thematicBreak",
    runner: (e, n, r) => {
      e.addNode(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "hr",
    runner: (e) => {
      e.addNode("thematicBreak");
    }
  }
}));
W(di.node, {
  displayName: "NodeSchema<hr>",
  group: "Hr"
});
W(di.ctx, {
  displayName: "NodeSchemaCtx<hr>",
  group: "Hr"
});
var Sp = ot((t) => new pt(/^(?:---|___\s|\*\*\*\s)$/, (e, n, r, i) => {
  const { tr: s } = e;
  return n[0] && s.replaceWith(r - 1, i, di.type(t).create()), s;
}));
W(Sp, {
  displayName: "InputRule<insertHrInputRule>",
  group: "Hr"
});
var vp = fe("InsertHr", (t) => () => (e, n) => {
  if (!n) return !0;
  const r = Lt.node.type(t).create(), { tr: i, selection: s } = e, { from: o } = s, l = di.type(t).create();
  if (!l) return !0;
  const a = i.replaceSelectionWith(l).insert(o, r), u = he.findFrom(a.doc.resolve(o), 1, !0);
  return u && n(a.setSelection(u).scrollIntoView()), !0;
});
W(vp, {
  displayName: "Command<insertHrCommand>",
  group: "Hr"
});
var Ea = Mt("bulletList");
W(Ea, {
  displayName: "Attr<bulletList>",
  group: "BulletList"
});
var yr = Be("bullet_list", (t) => ({
  content: "listItem+",
  group: "block",
  attrs: { spread: {
    default: !1,
    validate: "boolean"
  } },
  parseDOM: [{
    tag: "ul",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw Bt(e);
      return { spread: e.dataset.spread === "true" };
    }
  }],
  toDOM: (e) => [
    "ul",
    {
      ...t.get(Ea.key)(e),
      "data-spread": e.attrs.spread
    },
    0
  ],
  parseMarkdown: {
    match: ({ type: e, ordered: n }) => e === "list" && !n,
    runner: (e, n, r) => {
      const i = n.spread ?? !1;
      e.openNode(r, { spread: i }).next(n.children).closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "bullet_list",
    runner: (e, n) => {
      e.openNode("list", void 0, {
        ordered: !1,
        spread: n.attrs.spread
      }).next(n.content).closeNode();
    }
  }
}));
W(yr.node, {
  displayName: "NodeSchema<bulletList>",
  group: "BulletList"
});
W(yr.ctx, {
  displayName: "NodeSchemaCtx<bulletList>",
  group: "BulletList"
});
var Np = ot((t) => ql(/^\s*([-+*])\s$/, yr.type(t)));
W(Np, {
  displayName: "InputRule<wrapInBulletListInputRule>",
  group: "BulletList"
});
var Ma = fe("WrapInBulletList", (t) => () => Ul(yr.type(t)));
W(Ma, {
  displayName: "Command<wrapInBulletListCommand>",
  group: "BulletList"
});
var Oa = mt("bulletListKeymap", { WrapInBulletList: {
  shortcuts: "Mod-Alt-8",
  command: (t) => {
    const e = t.get(ve);
    return () => e.call(Ma.key);
  }
} });
W(Oa.ctx, {
  displayName: "KeymapCtx<bulletListKeymap>",
  group: "BulletList"
});
W(Oa.shortcuts, {
  displayName: "Keymap<bulletListKeymap>",
  group: "BulletList"
});
var Da = Mt("orderedList");
W(Da, {
  displayName: "Attr<orderedList>",
  group: "OrderedList"
});
var kr = Be("ordered_list", (t) => ({
  content: "listItem+",
  group: "block",
  attrs: {
    order: {
      default: 1,
      validate: "number"
    },
    spread: {
      default: !1,
      validate: "boolean"
    }
  },
  parseDOM: [{
    tag: "ol",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw Bt(e);
      return {
        spread: e.dataset.spread === "true",
        order: e.hasAttribute("start") ? Number(e.getAttribute("start")) : 1
      };
    }
  }],
  toDOM: (e) => [
    "ol",
    {
      ...t.get(Da.key)(e),
      ...e.attrs.order === 1 ? {} : { start: e.attrs.order },
      "data-spread": e.attrs.spread
    },
    0
  ],
  parseMarkdown: {
    match: ({ type: e, ordered: n }) => e === "list" && !!n,
    runner: (e, n, r) => {
      const i = n.spread ?? !0;
      e.openNode(r, {
        spread: i,
        order: n.start ?? 1
      }).next(n.children).closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "ordered_list",
    runner: (e, n) => {
      e.openNode("list", void 0, {
        ordered: !0,
        start: n.attrs.order ?? 1,
        spread: n.attrs.spread
      }), e.next(n.content), e.closeNode();
    }
  }
}));
W(kr.node, {
  displayName: "NodeSchema<orderedList>",
  group: "OrderedList"
});
W(kr.ctx, {
  displayName: "NodeSchemaCtx<orderedList>",
  group: "OrderedList"
});
var Ip = ot((t) => ql(/^\s*(\d+)\.\s$/, kr.type(t), (e) => ({ order: Number(e[1]) }), (e, n) => n.childCount + n.attrs.order === Number(e[1])));
W(Ip, {
  displayName: "InputRule<wrapInOrderedListInputRule>",
  group: "OrderedList"
});
var Ra = fe("WrapInOrderedList", (t) => () => Ul(kr.type(t)));
W(Ra, {
  displayName: "Command<wrapInOrderedListCommand>",
  group: "OrderedList"
});
var za = mt("orderedListKeymap", { WrapInOrderedList: {
  shortcuts: "Mod-Alt-7",
  command: (t) => {
    const e = t.get(ve);
    return () => e.call(Ra.key);
  }
} });
W(za.ctx, {
  displayName: "KeymapCtx<orderedList>",
  group: "OrderedList"
});
W(za.shortcuts, {
  displayName: "Keymap<orderedList>",
  group: "OrderedList"
});
var Pa = Mt("listItem");
W(Pa, {
  displayName: "Attr<listItem>",
  group: "ListItem"
});
var tn = Be("list_item", (t) => ({
  group: "listItem",
  content: "paragraph block*",
  attrs: {
    label: {
      default: "•",
      validate: "string"
    },
    listType: {
      default: "bullet",
      validate: "string"
    },
    spread: {
      default: !0,
      validate: "boolean"
    }
  },
  defining: !0,
  parseDOM: [{
    tag: "li",
    getAttrs: (e) => {
      if (!(e instanceof HTMLElement)) throw Bt(e);
      return {
        label: e.dataset.label,
        listType: e.dataset.listType,
        spread: e.dataset.spread === "true"
      };
    }
  }],
  toDOM: (e) => [
    "li",
    {
      ...t.get(Pa.key)(e),
      "data-label": e.attrs.label,
      "data-list-type": e.attrs.listType,
      "data-spread": e.attrs.spread
    },
    0
  ],
  parseMarkdown: {
    match: ({ type: e }) => e === "listItem",
    runner: (e, n, r) => {
      const i = n.label != null ? `${n.label}.` : "•", s = n.label != null ? "ordered" : "bullet", o = n.spread ?? !0;
      e.openNode(r, {
        label: i,
        listType: s,
        spread: o
      }), e.next(n.children), e.closeNode();
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "list_item",
    runner: (e, n) => {
      e.openNode("listItem", void 0, { spread: n.attrs.spread }), e.next(n.content), e.closeNode();
    }
  }
}));
W(tn.node, {
  displayName: "NodeSchema<listItem>",
  group: "ListItem"
});
W(tn.ctx, {
  displayName: "NodeSchemaCtx<listItem>",
  group: "ListItem"
});
var La = fe("SinkListItem", (t) => () => gC(tn.type(t)));
W(La, {
  displayName: "Command<sinkListItemCommand>",
  group: "ListItem"
});
var Ba = fe("LiftListItem", (t) => () => dC(tn.type(t)));
W(Ba, {
  displayName: "Command<liftListItemCommand>",
  group: "ListItem"
});
var Fa = fe("SplitListItem", (t) => () => fC(tn.type(t)));
W(Fa, {
  displayName: "Command<splitListItemCommand>",
  group: "ListItem"
});
function zC(t) {
  return (e, n, r) => {
    const { selection: i } = e;
    if (!(i instanceof pe)) return !1;
    const { empty: s, $from: o } = i;
    return !s || o.parentOffset !== 0 || o.node(-1).type !== tn.type(t) ? !1 : Zf(e, n, r);
  };
}
var $a = fe("LiftFirstListItem", (t) => () => zC(t));
W($a, {
  displayName: "Command<liftFirstListItemCommand>",
  group: "ListItem"
});
var ja = mt("listItemKeymap", {
  NextListItem: {
    shortcuts: "Enter",
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(Fa.key);
    }
  },
  SinkListItem: {
    shortcuts: ["Tab", "Mod-]"],
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(La.key);
    }
  },
  LiftListItem: {
    shortcuts: ["Shift-Tab", "Mod-["],
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(Ba.key);
    }
  },
  LiftFirstListItem: {
    shortcuts: ["Backspace", "Delete"],
    command: (t) => {
      const e = t.get(ve);
      return () => e.call($a.key);
    }
  }
});
W(ja.ctx, {
  displayName: "KeymapCtx<listItem>",
  group: "ListItem"
});
W(ja.shortcuts, {
  displayName: "Keymap<listItem>",
  group: "ListItem"
});
var _p = ra("text", () => ({
  group: "inline",
  parseMarkdown: {
    match: ({ type: t }) => t === "text",
    runner: (t, e) => {
      t.addText(e.value);
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "text",
    runner: (t, e) => {
      t.addNode("text", void 0, e.text);
    }
  }
}));
W(_p, {
  displayName: "NodeSchema<text>",
  group: "Text"
});
var Va = Mt("html");
W(Va, {
  displayName: "Attr<html>",
  group: "Html"
});
var Wa = Be("html", (t) => ({
  atom: !0,
  group: "inline",
  inline: !0,
  attrs: { value: {
    default: "",
    validate: "string"
  } },
  toDOM: (e) => {
    const n = document.createElement("span"), r = {
      ...t.get(Va.key)(e),
      "data-value": e.attrs.value,
      "data-type": "html"
    };
    return n.textContent = e.attrs.value, [
      "span",
      r,
      e.attrs.value
    ];
  },
  parseDOM: [{
    tag: 'span[data-type="html"]',
    getAttrs: (e) => ({ value: e.dataset.value ?? "" })
  }],
  parseMarkdown: {
    match: ({ type: e }) => e === "html",
    runner: (e, n, r) => {
      e.addNode(r, { value: n.value });
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "html",
    runner: (e, n) => {
      e.addNode("html", void 0, n.attrs.value);
    }
  }
}));
W(Wa.node, {
  displayName: "NodeSchema<html>",
  group: "Html"
});
W(Wa.ctx, {
  displayName: "NodeSchemaCtx<html>",
  group: "Html"
});
var PC = [
  mp,
  pa,
  Lt,
  Os,
  ya,
  qn,
  fs,
  Fn,
  ba,
  hi,
  Sa,
  fi,
  Aa,
  di,
  Ia,
  gr,
  Ea,
  yr,
  Da,
  kr,
  Pa,
  tn,
  ia,
  mr,
  la,
  ci,
  ca,
  fn,
  da,
  rr,
  Va,
  Wa,
  _p
].flat(), LC = [
  wp,
  Np,
  Ip,
  bp,
  Sp,
  kp
].flat(), BC = [
  up,
  cp,
  fp,
  hp
], FC = fe("IsMarkSelected", () => (t) => (e) => {
  if (!t) return !1;
  const { doc: n, selection: r } = e;
  return n.rangeHasMark(r.from, r.to, t);
}), $C = fe("IsNoteSelected", () => (t) => (e) => t ? nb(e, t).hasNode : !1), jC = fe("ClearTextInCurrentBlock", () => () => (t, e) => {
  let n = t.tr;
  const { $from: r, $to: i } = n.selection, { pos: s } = r, { pos: o } = i, l = s - r.node().content.size;
  return l < 0 ? !1 : (n = n.deleteRange(l, o), e?.(n), !0);
}), VC = fe("SetBlockType", () => (t) => (e, n) => {
  const { nodeType: r, attrs: i = null } = t ?? {};
  if (!r) return !1;
  const s = e.tr, { from: o, to: l } = s.selection;
  try {
    s.setBlockType(o, l, r, i);
  } catch {
    return !1;
  }
  return n?.(s), !0;
}), WC = fe("WrapInBlockType", () => (t) => (e, n) => {
  const { nodeType: r, attrs: i = null } = t ?? {};
  if (!r) return !1;
  let s = e.tr;
  try {
    const { $from: o, $to: l } = s.selection, a = o.blockRange(l), u = a && $l(a, r, i);
    if (!u) return !1;
    s = s.wrap(a, u);
  } catch {
    return !1;
  }
  return n?.(s), !0;
}), HC = fe("AddBlockType", () => (t) => (e, n) => {
  const { nodeType: r, attrs: i = null } = t ?? {};
  if (!r) return !1;
  const s = e.tr;
  try {
    const o = r instanceof bt ? r : r.createAndFill(i);
    if (!o) return !1;
    s.replaceSelectionWith(o);
  } catch {
    return !1;
  }
  return n?.(s), !0;
}), UC = fe("SelectTextNearPos", () => (t) => (e, n) => {
  const { pos: r } = t ?? {};
  if (r == null) return !1;
  const i = (o, l, a) => Math.min(Math.max(o, l), a), s = e.tr;
  try {
    const o = e.doc.resolve(i(r, 0, e.doc.content.size));
    s.setSelection(pe.near(o));
  } catch {
    return !1;
  }
  return n?.(s.scrollIntoView()), !0;
}), qC = [
  ma,
  xa,
  an,
  ka,
  va,
  _a,
  vp,
  xp,
  Cp,
  Ra,
  Ma,
  La,
  Fa,
  Ba,
  $a,
  sa,
  ha,
  aa,
  dp,
  pp,
  FC,
  $C,
  jC,
  VC,
  WC,
  HC,
  UC
], KC = [
  Ca,
  Na,
  Ta,
  wa,
  ja,
  za,
  Oa,
  ga,
  oa,
  fa,
  ua
].flat(), Ha = Nn("remarkAddOrderInList", () => () => (t) => {
  hr(t, "list", (e) => {
    if (e.ordered) {
      const n = e.start ?? 1;
      e.children.forEach((r, i) => {
        r.label = i + n;
      });
    }
  });
});
W(Ha.plugin, {
  displayName: "Remark<remarkAddOrderInListPlugin>",
  group: "Remark"
});
W(Ha.options, {
  displayName: "RemarkConfig<remarkAddOrderInListPlugin>",
  group: "Remark"
});
var Ua = Nn("remarkLineBreak", () => () => (t) => {
  const e = /[\t ]*(?:\r?\n|\r)/g;
  hr(t, "text", (n, r, i) => {
    if (!n.value || typeof n.value != "string") return;
    const s = [];
    let o = 0;
    e.lastIndex = 0;
    let l = e.exec(n.value);
    for (; l; ) {
      const a = l.index;
      o !== a && s.push({
        type: "text",
        value: n.value.slice(o, a)
      }), s.push({
        type: "break",
        data: { isInline: !0 }
      }), o = a + l[0].length, l = e.exec(n.value);
    }
    if (s.length > 0 && i && typeof r == "number")
      return o < n.value.length && s.push({
        type: "text",
        value: n.value.slice(o)
      }), i.children.splice(r, 1, ...s), r + s.length;
  });
});
W(Ua.plugin, {
  displayName: "Remark<remarkLineBreak>",
  group: "Remark"
});
W(Ua.options, {
  displayName: "RemarkConfig<remarkLineBreak>",
  group: "Remark"
});
var qa = Nn("remarkInlineLink", () => kC);
W(qa.plugin, {
  displayName: "Remark<remarkInlineLinkPlugin>",
  group: "Remark"
});
W(qa.options, {
  displayName: "RemarkConfig<remarkInlineLinkPlugin>",
  group: "Remark"
});
var JC = (t) => !!t.children, GC = (t) => t.type === "html";
function ZC(t, e) {
  return n(t, 0, null)[0];
  function n(r, i, s) {
    if (JC(r)) {
      const o = [];
      for (let l = 0, a = r.children.length; l < a; l++) {
        const u = r.children[l];
        if (u) {
          const c = n(u, l, r);
          if (c) for (let h = 0, d = c.length; h < d; h++) {
            const f = c[h];
            f && o.push(f);
          }
        }
      }
      r.children = o;
    }
    return e(r, i, s);
  }
}
var Ka = Nn("remarkHTMLTransformer", (t) => () => (e) => {
  const n = yp(t);
  ZC(e, (r, i, s) => GC(r) ? (s && n.has(s.type) && (r.children = [wC(r)], delete r.value, r.type = "paragraph"), [r]) : [r]);
});
W(Ka.plugin, {
  displayName: "Remark<remarkHtmlTransformer>",
  group: "Remark"
});
W(Ka.options, {
  displayName: "RemarkConfig<remarkHtmlTransformer>",
  group: "Remark"
});
var Ja = Nn("remarkMarker", () => () => (t, e) => {
  const n = (r) => e.value.charAt(r.position.start.offset);
  hr(t, (r) => ["strong", "emphasis"].includes(r.type), (r) => {
    r.marker = n(r);
  });
});
W(Ja.plugin, {
  displayName: "Remark<remarkMarker>",
  group: "Remark"
});
W(Ja.options, {
  displayName: "RemarkConfig<remarkMarker>",
  group: "Remark"
});
var Tp = Qt(() => {
  let t = !1;
  const e = new st("MILKDOWN_INLINE_NODES_CURSOR"), n = new it({
    key: e,
    state: {
      init() {
        return !1;
      },
      apply(r) {
        if (!r.selection.empty) return !1;
        const i = r.selection.$from, s = i.nodeBefore, o = i.nodeAfter;
        return !!(s && o && s.isInline && !s.isText && o.isInline && !o.isText);
      }
    },
    props: {
      handleDOMEvents: {
        compositionend: (r, i) => t ? (t = !1, requestAnimationFrame(() => {
          if (n.getState(r.state)) {
            const s = r.state.selection.from;
            i.preventDefault(), r.dispatch(r.state.tr.insertText(i.data || "", s));
          }
        }), !0) : !1,
        compositionstart: (r) => (n.getState(r.state) && (t = !0), !1),
        beforeinput: (r, i) => {
          if (n.getState(r.state) && i instanceof InputEvent && i.data && !t) {
            const s = r.state.selection.from;
            return i.preventDefault(), r.dispatch(r.state.tr.insertText(i.data || "", s)), !0;
          }
          return !1;
        }
      },
      decorations(r) {
        if (n.getState(r)) {
          const i = r.selection.$from.pos, s = document.createElement("span"), o = He.widget(i, s, { side: -1 }), l = document.createElement("span"), a = He.widget(i, l);
          return setTimeout(() => {
            s.contentEditable = "true", l.contentEditable = "true";
          }), Ae.create(r.doc, [o, a]);
        }
        return Ae.empty;
      }
    }
  });
  return n;
});
W(Tp, {
  displayName: "Prose<inlineNodesCursorPlugin>",
  group: "Prose"
});
var Ap = Qt((t) => new it({
  key: new st("MILKDOWN_HARDBREAK_MARKS"),
  appendTransaction: (e, n, r) => {
    if (!e.length) return;
    const [i] = e;
    if (!i) return;
    const [s] = i.steps;
    if (i.getMeta("hardbreak")) {
      if (!(s instanceof ze)) return;
      const { from: o } = s;
      return r.tr.setNodeMarkup(o, Fn.type(t), void 0, []);
    }
    if (s instanceof Kt) {
      let o = r.tr;
      const { from: l, to: a } = s;
      return r.doc.nodesBetween(l, a, (u, c) => {
        u.type === Fn.type(t) && (o = o.setNodeMarkup(c, Fn.type(t), void 0, []));
      }), o;
    }
  }
}));
W(Ap, {
  displayName: "Prose<hardbreakClearMarkPlugin>",
  group: "Prose"
});
var Ga = en(["table", "code_block"], "hardbreakFilterNodes");
W(Ga, {
  displayName: "Ctx<hardbreakFilterNodes>",
  group: "Prose"
});
var Ep = Qt((t) => {
  const e = t.get(Ga.key);
  return new it({
    key: new st("MILKDOWN_HARDBREAK_FILTER"),
    filterTransaction: (n, r) => {
      const i = n.getMeta("hardbreak"), [s] = n.steps;
      if (i && s) {
        const { from: o } = s, l = r.doc.resolve(o);
        let a = l.depth, u = !0;
        for (; a > 0; )
          e.includes(l.node(a).type.name) && (u = !1), a--;
        return u;
      }
      return !0;
    }
  });
});
W(Ep, {
  displayName: "Prose<hardbreakFilterPlugin>",
  group: "Prose"
});
var Mp = Qt((t) => {
  const e = new st("MILKDOWN_HEADING_ID"), n = (r) => {
    if (r.composing) return;
    const i = t.get(Os.key), s = r.state.tr.setMeta("addToHistory", !1);
    let o = !1;
    const l = {};
    r.state.doc.descendants((a, u) => {
      if (a.type === qn.type(t)) {
        if (a.textContent.trim().length === 0) return;
        const c = a.attrs;
        let h = i(a);
        l[h] ? (l[h] += 1, h += `-#${l[h]}`) : l[h] = 1, c.id !== h && (o = !0, s.setMeta(e, !0).setNodeMarkup(u, void 0, {
          ...c,
          id: h
        }));
      }
    }), o && r.dispatch(s);
  };
  return new it({
    key: e,
    view: (r) => (n(r), { update: (i, s) => {
      i.state.doc.eq(s.doc) || n(i);
    } })
  });
});
W(Mp, {
  displayName: "Prose<syncHeadingIdPlugin>",
  group: "Prose"
});
var Op = Qt((t) => {
  const e = (n, r, i) => {
    if (!i.selection || n.some((h) => h.getMeta("addToHistory") === !1 || !h.isGeneric)) return null;
    const s = kr.type(t), o = yr.type(t), l = tn.type(t), a = (h, d, f = 1) => {
      let p = !1;
      const m = `${d + f}.`;
      return h.label !== m && (h.label = m, p = !0), p;
    };
    let u = i.tr, c = !1;
    return i.doc.descendants((h, d, f, p) => {
      if (h.type === o) {
        const m = h.maybeChild(0);
        m?.type === l && m.attrs.listType === "ordered" && (c = !0, u.setNodeMarkup(d, s, { spread: !0 }), h.descendants((y, g, b, x) => {
          if (y.type === l) {
            const A = { ...y.attrs };
            a(A, x) && (u = u.setNodeMarkup(g, void 0, A));
          }
          return !1;
        }));
      } else if (h.type === l && f?.type === s) {
        const m = { ...h.attrs };
        let y = !1;
        m.listType !== "ordered" && (m.listType = "ordered", y = !0), f?.maybeChild(0) && (y = a(m, p, f?.attrs.order ?? 1)), y && (u = u.setNodeMarkup(d, void 0, m), c = !0);
      }
    }), c ? u.setMeta("addToHistory", !1) : null;
  };
  return new it({
    key: new st("MILKDOWN_KEEP_LIST_ORDER"),
    appendTransaction: e
  });
});
W(Op, {
  displayName: "Prose<syncListOrderPlugin>",
  group: "Prose"
});
var YC = [
  Ap,
  Ga,
  Ep,
  Tp,
  hs,
  Ha,
  qa,
  Ua,
  Ka,
  Ja,
  Ms,
  Mp,
  Op
].flat(), XC = [
  PC,
  LC,
  BC,
  qC,
  KC,
  YC
].flat();
let ml, gl;
if (typeof WeakMap < "u") {
  let t = /* @__PURE__ */ new WeakMap();
  ml = (e) => t.get(e), gl = (e, n) => (t.set(e, n), n);
} else {
  const t = [];
  let n = 0;
  ml = (r) => {
    for (let i = 0; i < t.length; i += 2) if (t[i] == r) return t[i + 1];
  }, gl = (r, i) => (n == 10 && (n = 0), t[n++] = r, t[n++] = i);
}
var Se = class {
  constructor(t, e, n, r) {
    this.width = t, this.height = e, this.map = n, this.problems = r;
  }
  findCell(t) {
    for (let e = 0; e < this.map.length; e++) {
      const n = this.map[e];
      if (n != t) continue;
      const r = e % this.width, i = e / this.width | 0;
      let s = r + 1, o = i + 1;
      for (let l = 1; s < this.width && this.map[e + l] == n; l++) s++;
      for (let l = 1; o < this.height && this.map[e + this.width * l] == n; l++) o++;
      return {
        left: r,
        top: i,
        right: s,
        bottom: o
      };
    }
    throw new RangeError(`No cell with offset ${t} found`);
  }
  colCount(t) {
    for (let e = 0; e < this.map.length; e++) if (this.map[e] == t) return e % this.width;
    throw new RangeError(`No cell with offset ${t} found`);
  }
  nextCell(t, e, n) {
    const { left: r, right: i, top: s, bottom: o } = this.findCell(t);
    return e == "horiz" ? (n < 0 ? r == 0 : i == this.width) ? null : this.map[s * this.width + (n < 0 ? r - 1 : i)] : (n < 0 ? s == 0 : o == this.height) ? null : this.map[r + this.width * (n < 0 ? s - 1 : o)];
  }
  rectBetween(t, e) {
    const { left: n, right: r, top: i, bottom: s } = this.findCell(t), { left: o, right: l, top: a, bottom: u } = this.findCell(e);
    return {
      left: Math.min(n, o),
      top: Math.min(i, a),
      right: Math.max(r, l),
      bottom: Math.max(s, u)
    };
  }
  cellsInRect(t) {
    const e = [], n = {};
    for (let r = t.top; r < t.bottom; r++) for (let i = t.left; i < t.right; i++) {
      const s = r * this.width + i, o = this.map[s];
      n[o] || (n[o] = !0, !(i == t.left && i && this.map[s - 1] == o || r == t.top && r && this.map[s - this.width] == o) && e.push(o));
    }
    return e;
  }
  positionAt(t, e, n) {
    for (let r = 0, i = 0; ; r++) {
      const s = i + n.child(r).nodeSize;
      if (r == t) {
        let o = e + t * this.width;
        const l = (t + 1) * this.width;
        for (; o < l && this.map[o] < i; ) o++;
        return o == l ? s - 1 : this.map[o];
      }
      i = s;
    }
  }
  static get(t) {
    return ml(t) || gl(t, QC(t));
  }
};
function QC(t) {
  if (t.type.spec.tableRole != "table") throw new RangeError("Not a table node: " + t.type.name);
  const e = eS(t), n = t.childCount, r = [];
  let i = 0, s = null;
  const o = [];
  for (let u = 0, c = e * n; u < c; u++) r[u] = 0;
  for (let u = 0, c = 0; u < n; u++) {
    const h = t.child(u);
    c++;
    for (let p = 0; ; p++) {
      for (; i < r.length && r[i] != 0; ) i++;
      if (p == h.childCount) break;
      const m = h.child(p), { colspan: y, rowspan: g, colwidth: b } = m.attrs;
      for (let x = 0; x < g; x++) {
        if (x + u >= n) {
          (s || (s = [])).push({
            type: "overlong_rowspan",
            pos: c,
            n: g - x
          });
          break;
        }
        const A = i + x * e;
        for (let E = 0; E < y; E++) {
          r[A + E] == 0 ? r[A + E] = c : (s || (s = [])).push({
            type: "collision",
            row: u,
            pos: c,
            n: y - E
          });
          const v = b && b[E];
          if (v) {
            const M = (A + E) % e * 2, R = o[M];
            R == null || R != v && o[M + 1] == 1 ? (o[M] = v, o[M + 1] = 1) : R == v && o[M + 1]++;
          }
        }
      }
      i += y, c += m.nodeSize;
    }
    const d = (u + 1) * e;
    let f = 0;
    for (; i < d; ) r[i++] == 0 && f++;
    f && (s || (s = [])).push({
      type: "missing",
      row: u,
      n: f
    }), c++;
  }
  (e === 0 || n === 0) && (s || (s = [])).push({ type: "zero_sized" });
  const l = new Se(e, n, r, s);
  let a = !1;
  for (let u = 0; !a && u < o.length; u += 2) o[u] != null && o[u + 1] < n && (a = !0);
  return a && tS(l, o, t), l;
}
function eS(t) {
  let e = -1, n = !1;
  for (let r = 0; r < t.childCount; r++) {
    const i = t.child(r);
    let s = 0;
    if (n) for (let o = 0; o < r; o++) {
      const l = t.child(o);
      for (let a = 0; a < l.childCount; a++) {
        const u = l.child(a);
        o + u.attrs.rowspan > r && (s += u.attrs.colspan);
      }
    }
    for (let o = 0; o < i.childCount; o++) {
      const l = i.child(o);
      s += l.attrs.colspan, l.attrs.rowspan > 1 && (n = !0);
    }
    e == -1 ? e = s : e != s && (e = Math.max(e, s));
  }
  return e;
}
function tS(t, e, n) {
  t.problems || (t.problems = []);
  const r = {};
  for (let i = 0; i < t.map.length; i++) {
    const s = t.map[i];
    if (r[s]) continue;
    r[s] = !0;
    const o = n.nodeAt(s);
    if (!o) throw new RangeError(`No cell with offset ${s} found`);
    let l = null;
    const a = o.attrs;
    for (let u = 0; u < a.colspan; u++) {
      const c = e[(i + u) % t.width * 2];
      c != null && (!a.colwidth || a.colwidth[u] != c) && ((l || (l = nS(a)))[u] = c);
    }
    l && t.problems.unshift({
      type: "colwidth mismatch",
      pos: s,
      colwidth: l
    });
  }
}
function nS(t) {
  if (t.colwidth) return t.colwidth.slice();
  const e = [];
  for (let n = 0; n < t.colspan; n++) e.push(0);
  return e;
}
function Zc(t, e) {
  if (typeof t == "string") return {};
  const n = t.getAttribute("data-colwidth"), r = n && /^\d+(,\d+)*$/.test(n) ? n.split(",").map((o) => Number(o)) : null, i = Number(t.getAttribute("colspan") || 1), s = {
    colspan: i,
    rowspan: Number(t.getAttribute("rowspan") || 1),
    colwidth: r && r.length == i ? r : null
  };
  for (const o in e) {
    const l = e[o].getFromDOM, a = l && l(t);
    a != null && (s[o] = a);
  }
  return s;
}
function Yc(t, e) {
  const n = {};
  t.attrs.colspan != 1 && (n.colspan = t.attrs.colspan), t.attrs.rowspan != 1 && (n.rowspan = t.attrs.rowspan), t.attrs.colwidth && (n["data-colwidth"] = t.attrs.colwidth.join(","));
  for (const r in e) {
    const i = e[r].setDOMAttr;
    i && i(t.attrs[r], n);
  }
  return n;
}
function rS(t) {
  if (t !== null) {
    if (!Array.isArray(t)) throw new TypeError("colwidth must be null or an array");
    for (const e of t) if (typeof e != "number") throw new TypeError("colwidth must be null or an array of numbers");
  }
}
function iS(t) {
  const e = t.cellAttributes || {}, n = {
    colspan: {
      default: 1,
      validate: "number"
    },
    rowspan: {
      default: 1,
      validate: "number"
    },
    colwidth: {
      default: null,
      validate: rS
    }
  };
  for (const r in e) n[r] = {
    default: e[r].default,
    validate: e[r].validate
  };
  return {
    table: {
      content: "table_row+",
      tableRole: "table",
      isolating: !0,
      group: t.tableGroup,
      parseDOM: [{ tag: "table" }],
      toDOM() {
        return ["table", ["tbody", 0]];
      }
    },
    table_row: {
      content: "(table_cell | table_header)*",
      tableRole: "row",
      parseDOM: [{ tag: "tr" }],
      toDOM() {
        return ["tr", 0];
      }
    },
    table_cell: {
      content: t.cellContent,
      attrs: n,
      tableRole: "cell",
      isolating: !0,
      parseDOM: [{
        tag: "td",
        getAttrs: (r) => Zc(r, e)
      }],
      toDOM(r) {
        return [
          "td",
          Yc(r, e),
          0
        ];
      }
    },
    table_header: {
      content: t.cellContent,
      attrs: n,
      tableRole: "header_cell",
      isolating: !0,
      parseDOM: [{
        tag: "th",
        getAttrs: (r) => Zc(r, e)
      }],
      toDOM(r) {
        return [
          "th",
          Yc(r, e),
          0
        ];
      }
    }
  };
}
function Ct(t) {
  let e = t.cached.tableNodeTypes;
  if (!e) {
    e = t.cached.tableNodeTypes = {};
    for (const n in t.nodes) {
      const r = t.nodes[n], i = r.spec.tableRole;
      i && (e[i] = r);
    }
  }
  return e;
}
const cn = new st("selectingCells");
function ur(t) {
  for (let e = t.depth - 1; e > 0; e--) if (t.node(e).type.spec.tableRole == "row") return t.node(0).resolve(t.before(e + 1));
  return null;
}
function Nt(t) {
  const e = t.selection.$head;
  for (let n = e.depth; n > 0; n--) if (e.node(n).type.spec.tableRole == "row") return !0;
  return !1;
}
function Ds(t) {
  const e = t.selection;
  if ("$anchorCell" in e && e.$anchorCell) return e.$anchorCell.pos > e.$headCell.pos ? e.$anchorCell : e.$headCell;
  if ("node" in e && e.node && e.node.type.spec.tableRole == "cell") return e.$anchor;
  const n = ur(e.$head) || sS(e.$head);
  if (n) return n;
  throw new RangeError(`No cell found around position ${e.head}`);
}
function sS(t) {
  for (let e = t.nodeAfter, n = t.pos; e; e = e.firstChild, n++) {
    const r = e.type.spec.tableRole;
    if (r == "cell" || r == "header_cell") return t.doc.resolve(n);
  }
  for (let e = t.nodeBefore, n = t.pos; e; e = e.lastChild, n--) {
    const r = e.type.spec.tableRole;
    if (r == "cell" || r == "header_cell") return t.doc.resolve(n - e.nodeSize);
  }
}
function yl(t) {
  return t.parent.type.spec.tableRole == "row" && !!t.nodeAfter;
}
function oS(t) {
  return t.node(0).resolve(t.pos + t.nodeAfter.nodeSize);
}
function Za(t, e) {
  return t.depth == e.depth && t.pos >= e.start(-1) && t.pos <= e.end(-1);
}
function Dp(t, e, n) {
  const r = t.node(-1), i = Se.get(r), s = t.start(-1), o = i.nextCell(t.pos - s, e, n);
  return o == null ? null : t.node(0).resolve(s + o);
}
function Un(t, e, n = 1) {
  const r = {
    ...t,
    colspan: t.colspan - n
  };
  return r.colwidth && (r.colwidth = r.colwidth.slice(), r.colwidth.splice(e, n), r.colwidth.some((i) => i > 0) || (r.colwidth = null)), r;
}
function lS(t, e, n = 1) {
  const r = {
    ...t,
    colspan: t.colspan + n
  };
  if (r.colwidth) {
    r.colwidth = r.colwidth.slice();
    for (let i = 0; i < n; i++) r.colwidth.splice(e, 0, 0);
  }
  return r;
}
function aS(t, e, n) {
  const r = Ct(e.type.schema).header_cell;
  for (let i = 0; i < t.height; i++) if (e.nodeAt(t.map[n + i * t.width]).type != r) return !1;
  return !0;
}
var Te = class Ht extends he {
  constructor(e, n = e) {
    const r = e.node(-1), i = Se.get(r), s = e.start(-1), o = i.rectBetween(e.pos - s, n.pos - s), l = e.node(0), a = i.cellsInRect(o).filter((c) => c != n.pos - s);
    a.unshift(n.pos - s);
    const u = a.map((c) => {
      const h = r.nodeAt(c);
      if (!h) throw new RangeError(`No cell with offset ${c} found`);
      const d = s + c + 1;
      return new qf(l.resolve(d), l.resolve(d + h.content.size));
    });
    super(u[0].$from, u[0].$to, u), this.$anchorCell = e, this.$headCell = n;
  }
  map(e, n) {
    const r = e.resolve(n.map(this.$anchorCell.pos)), i = e.resolve(n.map(this.$headCell.pos));
    if (yl(r) && yl(i) && Za(r, i)) {
      const s = this.$anchorCell.node(-1) != r.node(-1);
      return s && this.isRowSelection() ? Ht.rowSelection(r, i) : s && this.isColSelection() ? Ht.colSelection(r, i) : new Ht(r, i);
    }
    return pe.between(r, i);
  }
  content() {
    const e = this.$anchorCell.node(-1), n = Se.get(e), r = this.$anchorCell.start(-1), i = n.rectBetween(this.$anchorCell.pos - r, this.$headCell.pos - r), s = {}, o = [];
    for (let a = i.top; a < i.bottom; a++) {
      const u = [];
      for (let c = a * n.width + i.left, h = i.left; h < i.right; h++, c++) {
        const d = n.map[c];
        if (s[d]) continue;
        s[d] = !0;
        const f = n.findCell(d);
        let p = e.nodeAt(d);
        if (!p) throw new RangeError(`No cell with offset ${d} found`);
        const m = i.left - f.left, y = f.right - i.right;
        if (m > 0 || y > 0) {
          let g = p.attrs;
          if (m > 0 && (g = Un(g, 0, m)), y > 0 && (g = Un(g, g.colspan - y, y)), f.left < i.left) {
            if (p = p.type.createAndFill(g), !p) throw new RangeError(`Could not create cell with attrs ${JSON.stringify(g)}`);
          } else p = p.type.create(g, p.content);
        }
        if (f.top < i.top || f.bottom > i.bottom) {
          const g = {
            ...p.attrs,
            rowspan: Math.min(f.bottom, i.bottom) - Math.max(f.top, i.top)
          };
          f.top < i.top ? p = p.type.createAndFill(g) : p = p.type.create(g, p.content);
        }
        u.push(p);
      }
      o.push(e.child(a).copy(K.from(u)));
    }
    const l = this.isColSelection() && this.isRowSelection() ? e : o;
    return new ne(K.from(l), 1, 1);
  }
  replace(e, n = ne.empty) {
    const r = e.steps.length, i = this.ranges;
    for (let o = 0; o < i.length; o++) {
      const { $from: l, $to: a } = i[o], u = e.mapping.slice(r);
      e.replace(u.map(l.pos), u.map(a.pos), o ? ne.empty : n);
    }
    const s = he.findFrom(e.doc.resolve(e.mapping.slice(r).map(this.to)), -1);
    s && e.setSelection(s);
  }
  replaceWith(e, n) {
    this.replace(e, new ne(K.from(n), 0, 0));
  }
  forEachCell(e) {
    const n = this.$anchorCell.node(-1), r = Se.get(n), i = this.$anchorCell.start(-1), s = r.cellsInRect(r.rectBetween(this.$anchorCell.pos - i, this.$headCell.pos - i));
    for (let o = 0; o < s.length; o++) e(n.nodeAt(s[o]), i + s[o]);
  }
  isColSelection() {
    const e = this.$anchorCell.index(-1), n = this.$headCell.index(-1);
    if (Math.min(e, n) > 0) return !1;
    const r = e + this.$anchorCell.nodeAfter.attrs.rowspan, i = n + this.$headCell.nodeAfter.attrs.rowspan;
    return Math.max(r, i) == this.$headCell.node(-1).childCount;
  }
  static colSelection(e, n = e) {
    const r = e.node(-1), i = Se.get(r), s = e.start(-1), o = i.findCell(e.pos - s), l = i.findCell(n.pos - s), a = e.node(0);
    return o.top <= l.top ? (o.top > 0 && (e = a.resolve(s + i.map[o.left])), l.bottom < i.height && (n = a.resolve(s + i.map[i.width * (i.height - 1) + l.right - 1]))) : (l.top > 0 && (n = a.resolve(s + i.map[l.left])), o.bottom < i.height && (e = a.resolve(s + i.map[i.width * (i.height - 1) + o.right - 1]))), new Ht(e, n);
  }
  isRowSelection() {
    const e = this.$anchorCell.node(-1), n = Se.get(e), r = this.$anchorCell.start(-1), i = n.colCount(this.$anchorCell.pos - r), s = n.colCount(this.$headCell.pos - r);
    if (Math.min(i, s) > 0) return !1;
    const o = i + this.$anchorCell.nodeAfter.attrs.colspan, l = s + this.$headCell.nodeAfter.attrs.colspan;
    return Math.max(o, l) == n.width;
  }
  eq(e) {
    return e instanceof Ht && e.$anchorCell.pos == this.$anchorCell.pos && e.$headCell.pos == this.$headCell.pos;
  }
  static rowSelection(e, n = e) {
    const r = e.node(-1), i = Se.get(r), s = e.start(-1), o = i.findCell(e.pos - s), l = i.findCell(n.pos - s), a = e.node(0);
    return o.left <= l.left ? (o.left > 0 && (e = a.resolve(s + i.map[o.top * i.width])), l.right < i.width && (n = a.resolve(s + i.map[i.width * (l.top + 1) - 1]))) : (l.left > 0 && (n = a.resolve(s + i.map[l.top * i.width])), o.right < i.width && (e = a.resolve(s + i.map[i.width * (o.top + 1) - 1]))), new Ht(e, n);
  }
  toJSON() {
    return {
      type: "cell",
      anchor: this.$anchorCell.pos,
      head: this.$headCell.pos
    };
  }
  static fromJSON(e, n) {
    return new Ht(e.resolve(n.anchor), e.resolve(n.head));
  }
  static create(e, n, r = n) {
    return new Ht(e.resolve(n), e.resolve(r));
  }
  getBookmark() {
    return new uS(this.$anchorCell.pos, this.$headCell.pos);
  }
};
Te.prototype.visible = !1;
he.jsonID("cell", Te);
var uS = class Rp {
  constructor(e, n) {
    this.anchor = e, this.head = n;
  }
  map(e) {
    return new Rp(e.map(this.anchor), e.map(this.head));
  }
  resolve(e) {
    const n = e.resolve(this.anchor), r = e.resolve(this.head);
    return n.parent.type.spec.tableRole == "row" && r.parent.type.spec.tableRole == "row" && n.index() < n.parent.childCount && r.index() < r.parent.childCount && Za(n, r) ? new Te(n, r) : he.near(r, 1);
  }
};
function cS(t) {
  if (!(t.selection instanceof Te)) return null;
  const e = [];
  return t.selection.forEachCell((n, r) => {
    e.push(He.node(r, r + n.nodeSize, { class: "selectedCell" }));
  }), Ae.create(t.doc, e);
}
function hS({ $from: t, $to: e }) {
  if (t.pos == e.pos || t.pos < e.pos - 6) return !1;
  let n = t.pos, r = e.pos, i = t.depth;
  for (; i >= 0 && !(t.after(i + 1) < t.end(i)); i--, n++) ;
  for (let s = e.depth; s >= 0 && !(e.before(s + 1) > e.start(s)); s--, r--) ;
  return n == r && /row|table/.test(t.node(i).type.spec.tableRole);
}
function fS({ $from: t, $to: e }) {
  let n, r;
  for (let i = t.depth; i > 0; i--) {
    const s = t.node(i);
    if (s.type.spec.tableRole === "cell" || s.type.spec.tableRole === "header_cell") {
      n = s;
      break;
    }
  }
  for (let i = e.depth; i > 0; i--) {
    const s = e.node(i);
    if (s.type.spec.tableRole === "cell" || s.type.spec.tableRole === "header_cell") {
      r = s;
      break;
    }
  }
  return n !== r && e.parentOffset === 0;
}
function dS(t, e, n) {
  const r = (e || t).selection, i = (e || t).doc;
  let s, o;
  if (r instanceof ce && (o = r.node.type.spec.tableRole)) {
    if (o == "cell" || o == "header_cell") s = Te.create(i, r.from);
    else if (o == "row") {
      const l = i.resolve(r.from + 1);
      s = Te.rowSelection(l, l);
    } else if (!n) {
      const l = Se.get(r.node), a = r.from + 1, u = a + l.map[l.width * l.height - 1];
      s = Te.create(i, a + 1, u);
    }
  } else r instanceof pe && hS(r) ? s = pe.create(i, r.from) : r instanceof pe && fS(r) && (s = pe.create(i, r.$from.start(), r.$from.end()));
  return s && (e || (e = t.tr)).setSelection(s), e;
}
const pS = new st("fix-tables");
function zp(t, e, n, r) {
  const i = t.childCount, s = e.childCount;
  e: for (let o = 0, l = 0; o < s; o++) {
    const a = e.child(o);
    for (let u = l, c = Math.min(i, o + 3); u < c; u++) if (t.child(u) == a) {
      l = u + 1, n += a.nodeSize;
      continue e;
    }
    r(a, n), l < i && t.child(l).sameMarkup(a) ? zp(t.child(l), a, n + 1, r) : a.nodesBetween(0, a.content.size, r, n + 1), n += a.nodeSize;
  }
}
function mS(t, e) {
  let n;
  const r = (i, s) => {
    i.type.spec.tableRole == "table" && (n = gS(t, i, s, n));
  };
  return e ? e.doc != t.doc && zp(e.doc, t.doc, 0, r) : t.doc.descendants(r), n;
}
function gS(t, e, n, r) {
  const i = Se.get(e);
  if (!i.problems) return r;
  r || (r = t.tr);
  const s = [];
  for (let a = 0; a < i.height; a++) s.push(0);
  for (let a = 0; a < i.problems.length; a++) {
    const u = i.problems[a];
    if (u.type == "collision") {
      const c = e.nodeAt(u.pos);
      if (!c) continue;
      const h = c.attrs;
      for (let d = 0; d < h.rowspan; d++) s[u.row + d] += u.n;
      r.setNodeMarkup(r.mapping.map(n + 1 + u.pos), null, Un(h, h.colspan - u.n, u.n));
    } else if (u.type == "missing") s[u.row] += u.n;
    else if (u.type == "overlong_rowspan") {
      const c = e.nodeAt(u.pos);
      if (!c) continue;
      r.setNodeMarkup(r.mapping.map(n + 1 + u.pos), null, {
        ...c.attrs,
        rowspan: c.attrs.rowspan - u.n
      });
    } else if (u.type == "colwidth mismatch") {
      const c = e.nodeAt(u.pos);
      if (!c) continue;
      r.setNodeMarkup(r.mapping.map(n + 1 + u.pos), null, {
        ...c.attrs,
        colwidth: u.colwidth
      });
    } else if (u.type == "zero_sized") {
      const c = r.mapping.map(n);
      r.delete(c, c + e.nodeSize);
    }
  }
  let o, l;
  for (let a = 0; a < s.length; a++) s[a] && (o == null && (o = a), l = a);
  for (let a = 0, u = n + 1; a < i.height; a++) {
    const c = e.child(a), h = u + c.nodeSize, d = s[a];
    if (d > 0) {
      let f = "cell";
      c.firstChild && (f = c.firstChild.type.spec.tableRole);
      const p = [];
      for (let y = 0; y < d; y++) {
        const g = Ct(t.schema)[f].createAndFill();
        g && p.push(g);
      }
      const m = (a == 0 || o == a - 1) && l == a ? u + 1 : h - 1;
      r.insert(r.mapping.map(m), p);
    }
    u = h;
  }
  return r.setMeta(pS, { fixTables: !0 });
}
function Pp(t) {
  const e = Se.get(t), n = [], r = e.height, i = e.width;
  for (let s = 0; s < r; s++) {
    const o = [];
    for (let l = 0; l < i; l++) {
      const a = s * i + l, u = e.map[a];
      if (s > 0) {
        const c = a - i;
        if (u === e.map[c]) {
          o.push(null);
          continue;
        }
      }
      if (l > 0) {
        const c = a - 1;
        if (u === e.map[c]) {
          o.push(null);
          continue;
        }
      }
      o.push(t.nodeAt(u));
    }
    n.push(o);
  }
  return n;
}
function Lp(t, e) {
  const n = [], r = Se.get(t), i = r.height, s = r.width;
  for (let o = 0; o < i; o++) {
    const l = t.child(o), a = [];
    for (let c = 0; c < s; c++) {
      const h = e[o][c];
      if (!h) continue;
      const d = r.map[o * r.width + c], f = t.nodeAt(d);
      if (!f) continue;
      const p = f.type.createChecked(h.attrs, h.content, h.marks);
      a.push(p);
    }
    const u = l.type.createChecked(l.attrs, a, l.marks);
    n.push(u);
  }
  return t.type.createChecked(t.attrs, n, t.marks);
}
function Bp(t, e, n, r) {
  const i = e[0] > n[0] ? -1 : 1, s = t.splice(e[0], e.length), o = s.length % 2 === 0 ? 1 : 0;
  let l;
  return l = i === -1 ? n[0] : n[n.length - 1] - o, t.splice(l, 0, ...s), t;
}
function pi(t) {
  return yS((e) => e.type.spec.tableRole === "table", t);
}
function yS(t, e) {
  for (let n = e.depth; n >= 0; n -= 1) {
    const r = e.node(n);
    if (t(r)) return {
      node: r,
      pos: n === 0 ? 0 : e.before(n),
      start: e.start(n),
      depth: n
    };
  }
  return null;
}
function Xn(t, e) {
  const n = pi(e.$from);
  if (!n) return;
  const r = Se.get(n.node);
  if (!(t < 0 || t > r.width - 1))
    return r.cellsInRect({
      left: t,
      right: t + 1,
      top: 0,
      bottom: r.height
    }).map((i) => {
      const s = n.node.nodeAt(i), o = i + n.start;
      return {
        pos: o,
        start: o + 1,
        node: s,
        depth: n.depth + 2
      };
    });
}
function Qn(t, e) {
  const n = pi(e.$from);
  if (!n) return;
  const r = Se.get(n.node);
  if (!(t < 0 || t > r.height - 1))
    return r.cellsInRect({
      left: 0,
      right: r.width,
      top: t,
      bottom: t + 1
    }).map((i) => {
      const s = n.node.nodeAt(i), o = i + n.start;
      return {
        pos: o,
        start: o + 1,
        node: s,
        depth: n.depth + 2
      };
    });
}
function Xc(t, e, n = e) {
  let r = e, i = n;
  for (let c = e; c >= 0; c--) {
    const h = Xn(c, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.colspan + c - 1;
      f >= r && (r = c), f > i && (i = f);
    });
  }
  for (let c = e; c <= i; c++) {
    const h = Xn(c, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.colspan + c - 1;
      d.node.attrs.colspan > 1 && f > i && (i = f);
    });
  }
  const s = [];
  for (let c = r; c <= i; c++) {
    const h = Xn(c, t.selection);
    h && h.length > 0 && s.push(c);
  }
  r = s[0], i = s[s.length - 1];
  const o = Xn(r, t.selection), l = Qn(0, t.selection);
  if (!o || !l) return;
  const a = t.doc.resolve(o[o.length - 1].pos);
  let u;
  for (let c = i; c >= r; c--) {
    const h = Xn(c, t.selection);
    if (h && h.length > 0) {
      for (let d = l.length - 1; d >= 0; d--) if (l[d].pos === h[0].pos) {
        u = h[0];
        break;
      }
      if (u) break;
    }
  }
  if (u)
    return {
      $anchor: a,
      $head: t.doc.resolve(u.pos),
      indexes: s
    };
}
function Qc(t, e, n = e) {
  let r = e, i = n;
  for (let c = e; c >= 0; c--) {
    const h = Qn(c, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.rowspan + c - 1;
      f >= r && (r = c), f > i && (i = f);
    });
  }
  for (let c = e; c <= i; c++) {
    const h = Qn(c, t.selection);
    h && h.forEach((d) => {
      const f = d.node.attrs.rowspan + c - 1;
      d.node.attrs.rowspan > 1 && f > i && (i = f);
    });
  }
  const s = [];
  for (let c = r; c <= i; c++) {
    const h = Qn(c, t.selection);
    h && h.length > 0 && s.push(c);
  }
  r = s[0], i = s[s.length - 1];
  const o = Qn(r, t.selection), l = Xn(0, t.selection);
  if (!o || !l) return;
  const a = t.doc.resolve(o[o.length - 1].pos);
  let u;
  for (let c = i; c >= r; c--) {
    const h = Qn(c, t.selection);
    if (h && h.length > 0) {
      for (let d = l.length - 1; d >= 0; d--) if (l[d].pos === h[0].pos) {
        u = h[0];
        break;
      }
      if (u) break;
    }
  }
  if (u)
    return {
      $anchor: a,
      $head: t.doc.resolve(u.pos),
      indexes: s
    };
}
function eh(t) {
  return t[0].map((e, n) => t.map((r) => r[n]));
}
function kS(t) {
  var e, n;
  const { tr: r, originIndex: i, targetIndex: s, select: o, pos: l } = t, a = pi(r.doc.resolve(l));
  if (!a) return !1;
  const u = (e = Xc(r, i)) === null || e === void 0 ? void 0 : e.indexes, c = (n = Xc(r, s)) === null || n === void 0 ? void 0 : n.indexes;
  if (!u || !c || u.includes(s)) return !1;
  const h = wS(a.node, u, c);
  if (r.replaceWith(a.pos, a.pos + a.node.nodeSize, h), !o) return !0;
  const d = Se.get(h), f = a.start, p = s, m = d.positionAt(d.height - 1, p, h), y = r.doc.resolve(f + m), g = d.positionAt(0, p, h), b = r.doc.resolve(f + g);
  return r.setSelection(Te.colSelection(y, b)), !0;
}
function wS(t, e, n, r) {
  let i = eh(Pp(t));
  return i = Bp(i, e, n), i = eh(i), Lp(t, i);
}
function bS(t) {
  var e, n;
  const { tr: r, originIndex: i, targetIndex: s, select: o, pos: l } = t, a = pi(r.doc.resolve(l));
  if (!a) return !1;
  const u = (e = Qc(r, i)) === null || e === void 0 ? void 0 : e.indexes, c = (n = Qc(r, s)) === null || n === void 0 ? void 0 : n.indexes;
  if (!u || !c || u.includes(s)) return !1;
  const h = xS(a.node, u, c);
  if (r.replaceWith(a.pos, a.pos + a.node.nodeSize, h), !o) return !0;
  const d = Se.get(h), f = a.start, p = s, m = d.positionAt(p, d.width - 1, h), y = r.doc.resolve(f + m), g = d.positionAt(p, 0, h), b = r.doc.resolve(f + g);
  return r.setSelection(Te.rowSelection(y, b)), !0;
}
function xS(t, e, n, r) {
  let i = Pp(t);
  return i = Bp(i, e, n), Lp(t, i);
}
function In(t) {
  const e = t.selection, n = Ds(t), r = n.node(-1), i = n.start(-1), s = Se.get(r);
  return {
    ...e instanceof Te ? s.rectBetween(e.$anchorCell.pos - i, e.$headCell.pos - i) : s.findCell(n.pos - i),
    tableStart: i,
    map: s,
    table: r
  };
}
function Fp(t, { map: e, tableStart: n, table: r }, i) {
  let s = i > 0 ? -1 : 0;
  aS(e, r, i + s) && (s = i == 0 || i == e.width ? null : 0);
  for (let o = 0; o < e.height; o++) {
    const l = o * e.width + i;
    if (i > 0 && i < e.width && e.map[l - 1] == e.map[l]) {
      const a = e.map[l], u = r.nodeAt(a);
      t.setNodeMarkup(t.mapping.map(n + a), null, lS(u.attrs, i - e.colCount(a))), o += u.attrs.rowspan - 1;
    } else {
      const a = s == null ? Ct(r.type.schema).cell : r.nodeAt(e.map[l + s]).type, u = e.positionAt(o, i, r);
      t.insert(t.mapping.map(n + u), a.createAndFill());
    }
  }
  return t;
}
function CS(t, e) {
  if (!Nt(t)) return !1;
  if (e) {
    const n = In(t);
    e(Fp(t.tr, n, n.left));
  }
  return !0;
}
function SS(t, e) {
  if (!Nt(t)) return !1;
  if (e) {
    const n = In(t);
    e(Fp(t.tr, n, n.right));
  }
  return !0;
}
function vS(t, { map: e, table: n, tableStart: r }, i) {
  const s = t.mapping.maps.length;
  for (let o = 0; o < e.height; ) {
    const l = o * e.width + i, a = e.map[l], u = n.nodeAt(a), c = u.attrs;
    if (i > 0 && e.map[l - 1] == a || i < e.width - 1 && e.map[l + 1] == a) t.setNodeMarkup(t.mapping.slice(s).map(r + a), null, Un(c, i - e.colCount(a)));
    else {
      const h = t.mapping.slice(s).map(r + a);
      t.delete(h, h + u.nodeSize);
    }
    o += c.rowspan;
  }
}
function NS(t, e) {
  if (!Nt(t)) return !1;
  if (e) {
    const n = In(t), r = t.tr;
    if (n.left == 0 && n.right == n.map.width) return !1;
    for (let i = n.right - 1; vS(r, n, i), i != n.left; i--) {
      const s = n.tableStart ? r.doc.nodeAt(n.tableStart - 1) : r.doc;
      if (!s) throw new RangeError("No table found");
      n.table = s, n.map = Se.get(s);
    }
    e(r);
  }
  return !0;
}
function IS(t, { map: e, table: n, tableStart: r }, i) {
  let s = 0;
  for (let u = 0; u < i; u++) s += n.child(u).nodeSize;
  const o = s + n.child(i).nodeSize, l = t.mapping.maps.length;
  t.delete(s + r, o + r);
  const a = /* @__PURE__ */ new Set();
  for (let u = 0, c = i * e.width; u < e.width; u++, c++) {
    const h = e.map[c];
    if (!a.has(h)) {
      if (a.add(h), i > 0 && h == e.map[c - e.width]) {
        const d = n.nodeAt(h).attrs;
        t.setNodeMarkup(t.mapping.slice(l).map(h + r), null, {
          ...d,
          rowspan: d.rowspan - 1
        }), u += d.colspan - 1;
      } else if (i < e.height && h == e.map[c + e.width]) {
        const d = n.nodeAt(h), f = d.attrs, p = d.type.create({
          ...f,
          rowspan: d.attrs.rowspan - 1
        }, d.content), m = e.positionAt(i + 1, u, n);
        t.insert(t.mapping.slice(l).map(r + m), p), u += f.colspan - 1;
      }
    }
  }
}
function _S(t, e) {
  if (!Nt(t)) return !1;
  if (e) {
    const n = In(t), r = t.tr;
    if (n.top == 0 && n.bottom == n.map.height) return !1;
    for (let i = n.bottom - 1; IS(r, n, i), i != n.top; i--) {
      const s = n.tableStart ? r.doc.nodeAt(n.tableStart - 1) : r.doc;
      if (!s) throw new RangeError("No table found");
      n.table = s, n.map = Se.get(n.table);
    }
    e(r);
  }
  return !0;
}
function TS(t, e) {
  return function(n, r) {
    if (!Nt(n)) return !1;
    const i = Ds(n);
    if (i.nodeAfter.attrs[t] === e) return !1;
    if (r) {
      const s = n.tr;
      n.selection instanceof Te ? n.selection.forEachCell((o, l) => {
        o.attrs[t] !== e && s.setNodeMarkup(l, null, {
          ...o.attrs,
          [t]: e
        });
      }) : s.setNodeMarkup(i.pos, null, {
        ...i.nodeAfter.attrs,
        [t]: e
      }), r(s);
    }
    return !0;
  };
}
function AS(t) {
  return function(e, n) {
    if (!Nt(e)) return !1;
    if (n) {
      const r = Ct(e.schema), i = In(e), s = e.tr, o = i.map.cellsInRect(t == "column" ? {
        left: i.left,
        top: 0,
        right: i.right,
        bottom: i.map.height
      } : t == "row" ? {
        left: 0,
        top: i.top,
        right: i.map.width,
        bottom: i.bottom
      } : i), l = o.map((a) => i.table.nodeAt(a));
      for (let a = 0; a < o.length; a++) l[a].type == r.header_cell && s.setNodeMarkup(i.tableStart + o[a], r.cell, l[a].attrs);
      if (s.steps.length === 0) for (let a = 0; a < o.length; a++) s.setNodeMarkup(i.tableStart + o[a], r.header_cell, l[a].attrs);
      n(s);
    }
    return !0;
  };
}
function th(t, e, n) {
  const r = e.map.cellsInRect({
    left: 0,
    top: 0,
    right: t == "row" ? e.map.width : 1,
    bottom: t == "column" ? e.map.height : 1
  });
  for (let i = 0; i < r.length; i++) {
    const s = e.table.nodeAt(r[i]);
    if (s && s.type !== n.header_cell) return !1;
  }
  return !0;
}
function Ya(t, e) {
  return e = e || { useDeprecatedLogic: !1 }, e.useDeprecatedLogic ? AS(t) : function(n, r) {
    if (!Nt(n)) return !1;
    if (r) {
      const i = Ct(n.schema), s = In(n), o = n.tr, l = th("row", s, i), a = th("column", s, i), u = (t === "column" ? l : t === "row" && a) ? 1 : 0, c = t == "column" ? {
        left: 0,
        top: u,
        right: 1,
        bottom: s.map.height
      } : t == "row" ? {
        left: u,
        top: 0,
        right: s.map.width,
        bottom: 1
      } : s, h = t == "column" ? a ? i.cell : i.header_cell : t == "row" ? l ? i.cell : i.header_cell : i.cell;
      s.map.cellsInRect(c).forEach((d) => {
        const f = d + s.tableStart, p = o.doc.nodeAt(f);
        p && o.setNodeMarkup(f, h, p.attrs);
      }), r(o);
    }
    return !0;
  };
}
Ya("row", { useDeprecatedLogic: !0 });
Ya("column", { useDeprecatedLogic: !0 });
Ya("cell", { useDeprecatedLogic: !0 });
function ES(t, e) {
  if (e < 0) {
    const n = t.nodeBefore;
    if (n) return t.pos - n.nodeSize;
    for (let r = t.index(-1) - 1, i = t.before(); r >= 0; r--) {
      const s = t.node(-1).child(r), o = s.lastChild;
      if (o) return i - 1 - o.nodeSize;
      i -= s.nodeSize;
    }
  } else {
    if (t.index() < t.parent.childCount - 1) return t.pos + t.nodeAfter.nodeSize;
    const n = t.node(-1);
    for (let r = t.indexAfter(-1), i = t.after(); r < n.childCount; r++) {
      const s = n.child(r);
      if (s.childCount) return i + 1;
      i += s.nodeSize;
    }
  }
  return null;
}
function $p(t) {
  return function(e, n) {
    if (!Nt(e)) return !1;
    const r = ES(Ds(e), t);
    if (r == null) return !1;
    if (n) {
      const i = e.doc.resolve(r);
      n(e.tr.setSelection(pe.between(i, oS(i))).scrollIntoView());
    }
    return !0;
  };
}
function MS(t, e) {
  const n = t.selection.$anchor;
  for (let r = n.depth; r > 0; r--) if (n.node(r).type.spec.tableRole == "table")
    return e && e(t.tr.delete(n.before(r), n.after(r)).scrollIntoView()), !0;
  return !1;
}
function _i(t, e) {
  const n = t.selection;
  if (!(n instanceof Te)) return !1;
  if (e) {
    const r = t.tr, i = Ct(t.schema).cell.createAndFill().content;
    n.forEachCell((s, o) => {
      s.content.eq(i) || r.replace(r.mapping.map(o + 1), r.mapping.map(o + s.nodeSize - 1), new ne(i, 0, 0));
    }), r.docChanged && e(r);
  }
  return !0;
}
function OS(t) {
  return (e, n) => {
    const { from: r, to: i, select: s = !0, pos: o = e.selection.from } = t, l = e.tr;
    return bS({
      tr: l,
      originIndex: r,
      targetIndex: i,
      select: s,
      pos: o
    }) ? (n?.(l), !0) : !1;
  };
}
function DS(t) {
  return (e, n) => {
    const { from: r, to: i, select: s = !0, pos: o = e.selection.from } = t, l = e.tr;
    return kS({
      tr: l,
      originIndex: r,
      targetIndex: i,
      select: s,
      pos: o
    }) ? (n?.(l), !0) : !1;
  };
}
function RS(t) {
  if (t.size === 0) return null;
  let { content: e, openStart: n, openEnd: r } = t;
  for (; e.childCount == 1 && (n > 0 && r > 0 || e.child(0).type.spec.tableRole == "table"); )
    n--, r--, e = e.child(0).content;
  const i = e.child(0), s = i.type.spec.tableRole, o = i.type.schema, l = [];
  if (s == "row") for (let a = 0; a < e.childCount; a++) {
    let u = e.child(a).content;
    const c = a ? 0 : Math.max(0, n - 1), h = a < e.childCount - 1 ? 0 : Math.max(0, r - 1);
    (c || h) && (u = kl(Ct(o).row, new ne(u, c, h)).content), l.push(u);
  }
  else if (s == "cell" || s == "header_cell") l.push(n || r ? kl(Ct(o).row, new ne(e, n, r)).content : e);
  else return null;
  return zS(o, l);
}
function zS(t, e) {
  const n = [];
  for (let i = 0; i < e.length; i++) {
    const s = e[i];
    for (let o = s.childCount - 1; o >= 0; o--) {
      const { rowspan: l, colspan: a } = s.child(o).attrs;
      for (let u = i; u < i + l; u++) n[u] = (n[u] || 0) + a;
    }
  }
  let r = 0;
  for (let i = 0; i < n.length; i++) r = Math.max(r, n[i]);
  for (let i = 0; i < n.length; i++)
    if (i >= e.length && e.push(K.empty), n[i] < r) {
      const s = Ct(t).cell.createAndFill(), o = [];
      for (let l = n[i]; l < r; l++) o.push(s);
      e[i] = e[i].append(K.from(o));
    }
  return {
    height: e.length,
    width: r,
    rows: e
  };
}
function kl(t, e) {
  const n = t.createAndFill();
  return new Uf(n).replace(0, n.content.size, e).doc;
}
function PS({ width: t, height: e, rows: n }, r, i) {
  if (t != r) {
    const s = [], o = [];
    for (let l = 0; l < n.length; l++) {
      const a = n[l], u = [];
      for (let c = s[l] || 0, h = 0; c < r; h++) {
        let d = a.child(h % a.childCount);
        c + d.attrs.colspan > r && (d = d.type.createChecked(Un(d.attrs, d.attrs.colspan, c + d.attrs.colspan - r), d.content)), u.push(d), c += d.attrs.colspan;
        for (let f = 1; f < d.attrs.rowspan; f++) s[l + f] = (s[l + f] || 0) + d.attrs.colspan;
      }
      o.push(K.from(u));
    }
    n = o, t = r;
  }
  if (e != i) {
    const s = [];
    for (let o = 0, l = 0; o < i; o++, l++) {
      const a = [], u = n[l % e];
      for (let c = 0; c < u.childCount; c++) {
        let h = u.child(c);
        o + h.attrs.rowspan > i && (h = h.type.create({
          ...h.attrs,
          rowspan: Math.max(1, i - h.attrs.rowspan)
        }, h.content)), a.push(h);
      }
      s.push(K.from(a));
    }
    n = s, e = i;
  }
  return {
    width: t,
    height: e,
    rows: n
  };
}
function LS(t, e, n, r, i, s, o) {
  const l = t.doc.type.schema, a = Ct(l);
  let u, c;
  if (i > e.width) for (let h = 0, d = 0; h < e.height; h++) {
    const f = n.child(h);
    d += f.nodeSize;
    const p = [];
    let m;
    f.lastChild == null || f.lastChild.type == a.cell ? m = u || (u = a.cell.createAndFill()) : m = c || (c = a.header_cell.createAndFill());
    for (let y = e.width; y < i; y++) p.push(m);
    t.insert(t.mapping.slice(o).map(d - 1 + r), p);
  }
  if (s > e.height) {
    const h = [];
    for (let p = 0, m = (e.height - 1) * e.width; p < Math.max(e.width, i); p++) {
      const y = p >= e.width ? !1 : n.nodeAt(e.map[m + p]).type == a.header_cell;
      h.push(y ? c || (c = a.header_cell.createAndFill()) : u || (u = a.cell.createAndFill()));
    }
    const d = a.row.create(null, K.from(h)), f = [];
    for (let p = e.height; p < s; p++) f.push(d);
    t.insert(t.mapping.slice(o).map(r + n.nodeSize - 2), f);
  }
  return !!(u || c);
}
function nh(t, e, n, r, i, s, o, l) {
  if (o == 0 || o == e.height) return !1;
  let a = !1;
  for (let u = i; u < s; u++) {
    const c = o * e.width + u, h = e.map[c];
    if (e.map[c - e.width] == h) {
      a = !0;
      const d = n.nodeAt(h), { top: f, left: p } = e.findCell(h);
      t.setNodeMarkup(t.mapping.slice(l).map(h + r), null, {
        ...d.attrs,
        rowspan: o - f
      }), t.insert(t.mapping.slice(l).map(e.positionAt(o, p, n)), d.type.createAndFill({
        ...d.attrs,
        rowspan: f + d.attrs.rowspan - o
      })), u += d.attrs.colspan - 1;
    }
  }
  return a;
}
function rh(t, e, n, r, i, s, o, l) {
  if (o == 0 || o == e.width) return !1;
  let a = !1;
  for (let u = i; u < s; u++) {
    const c = u * e.width + o, h = e.map[c];
    if (e.map[c - 1] == h) {
      a = !0;
      const d = n.nodeAt(h), f = e.colCount(h), p = t.mapping.slice(l).map(h + r);
      t.setNodeMarkup(p, null, Un(d.attrs, o - f, d.attrs.colspan - (o - f))), t.insert(p + d.nodeSize, d.type.createAndFill(Un(d.attrs, 0, o - f))), u += d.attrs.rowspan - 1;
    }
  }
  return a;
}
function ih(t, e, n, r, i) {
  let s = n ? t.doc.nodeAt(n - 1) : t.doc;
  if (!s) throw new Error("No table found");
  let o = Se.get(s);
  const { top: l, left: a } = r, u = a + i.width, c = l + i.height, h = t.tr;
  let d = 0;
  function f() {
    if (s = n ? h.doc.nodeAt(n - 1) : h.doc, !s) throw new Error("No table found");
    o = Se.get(s), d = h.mapping.maps.length;
  }
  LS(h, o, s, n, u, c, d) && f(), nh(h, o, s, n, a, u, l, d) && f(), nh(h, o, s, n, a, u, c, d) && f(), rh(h, o, s, n, l, c, a, d) && f(), rh(h, o, s, n, l, c, u, d) && f();
  for (let p = l; p < c; p++) {
    const m = o.positionAt(p, a, s), y = o.positionAt(p, u, s);
    h.replace(h.mapping.slice(d).map(m + n), h.mapping.slice(d).map(y + n), new ne(i.rows[p - l], 0, 0));
  }
  f(), h.setSelection(new Te(h.doc.resolve(n + o.positionAt(l, a, s)), h.doc.resolve(n + o.positionAt(c - 1, u - 1, s)))), e(h);
}
const BS = od({
  ArrowLeft: Ti("horiz", -1),
  ArrowRight: Ti("horiz", 1),
  ArrowUp: Ti("vert", -1),
  ArrowDown: Ti("vert", 1),
  "Shift-ArrowLeft": Ai("horiz", -1),
  "Shift-ArrowRight": Ai("horiz", 1),
  "Shift-ArrowUp": Ai("vert", -1),
  "Shift-ArrowDown": Ai("vert", 1),
  Backspace: _i,
  "Mod-Backspace": _i,
  Delete: _i,
  "Mod-Delete": _i
});
function qi(t, e, n) {
  return n.eq(t.selection) ? !1 : (e && e(t.tr.setSelection(n).scrollIntoView()), !0);
}
function Ti(t, e) {
  return (n, r, i) => {
    if (!i) return !1;
    const s = n.selection;
    if (s instanceof Te) return qi(n, r, he.near(s.$headCell, e));
    if (t != "horiz" && !s.empty) return !1;
    const o = jp(i, t, e);
    if (o == null) return !1;
    if (t == "horiz") return qi(n, r, he.near(n.doc.resolve(s.head + e), e));
    {
      const l = n.doc.resolve(o), a = Dp(l, t, e);
      let u;
      return a ? u = he.near(a, 1) : e < 0 ? u = he.near(n.doc.resolve(l.before(-1)), -1) : u = he.near(n.doc.resolve(l.after(-1)), 1), qi(n, r, u);
    }
  };
}
function Ai(t, e) {
  return (n, r, i) => {
    if (!i) return !1;
    const s = n.selection;
    let o;
    if (s instanceof Te) o = s;
    else {
      const a = jp(i, t, e);
      if (a == null) return !1;
      o = new Te(n.doc.resolve(a));
    }
    const l = Dp(o.$headCell, t, e);
    return l ? qi(n, r, new Te(o.$anchorCell, l)) : !1;
  };
}
function FS(t, e) {
  const n = t.state.doc, r = ur(n.resolve(e));
  return r ? (t.dispatch(t.state.tr.setSelection(new Te(r))), !0) : !1;
}
function $S(t, e, n) {
  if (!Nt(t.state)) return !1;
  let r = RS(n);
  const i = t.state.selection;
  if (i instanceof Te) {
    r || (r = {
      width: 1,
      height: 1,
      rows: [K.from(kl(Ct(t.state.schema).cell, n))]
    });
    const s = i.$anchorCell.node(-1), o = i.$anchorCell.start(-1), l = Se.get(s).rectBetween(i.$anchorCell.pos - o, i.$headCell.pos - o);
    return r = PS(r, l.right - l.left, l.bottom - l.top), ih(t.state, t.dispatch, o, l, r), !0;
  } else if (r) {
    const s = Ds(t.state), o = s.start(-1);
    return ih(t.state, t.dispatch, o, Se.get(s.node(-1)).findCell(s.pos - o), r), !0;
  } else return !1;
}
function jS(t, e) {
  var n;
  if (e.button != 0 || e.ctrlKey || e.metaKey) return;
  const r = sh(t, e.target);
  let i;
  if (e.shiftKey && t.state.selection instanceof Te)
    s(t.state.selection.$anchorCell, e), e.preventDefault();
  else if (e.shiftKey && r && (i = ur(t.state.selection.$anchor)) != null && ((n = wo(t, e)) === null || n === void 0 ? void 0 : n.pos) != i.pos)
    s(i, e), e.preventDefault();
  else if (!r) return;
  function s(a, u) {
    let c = wo(t, u);
    const h = cn.getState(t.state) == null;
    if (!c || !Za(a, c)) if (h) c = a;
    else return;
    const d = new Te(a, c);
    if (h || !t.state.selection.eq(d)) {
      const f = t.state.tr.setSelection(d);
      h && f.setMeta(cn, a.pos), t.dispatch(f);
    }
  }
  function o() {
    t.root.removeEventListener("mouseup", o), t.root.removeEventListener("dragstart", o), t.root.removeEventListener("mousemove", l), cn.getState(t.state) != null && t.dispatch(t.state.tr.setMeta(cn, -1));
  }
  function l(a) {
    const u = a, c = cn.getState(t.state);
    let h;
    if (c != null) h = t.state.doc.resolve(c);
    else if (sh(t, u.target) != r && (h = wo(t, e), !h))
      return o();
    h && s(h, u);
  }
  t.root.addEventListener("mouseup", o), t.root.addEventListener("dragstart", o), t.root.addEventListener("mousemove", l);
}
function jp(t, e, n) {
  if (!(t.state.selection instanceof pe)) return null;
  const { $head: r } = t.state.selection;
  for (let i = r.depth - 1; i >= 0; i--) {
    const s = r.node(i);
    if ((n < 0 ? r.index(i) : r.indexAfter(i)) != (n < 0 ? 0 : s.childCount)) return null;
    if (s.type.spec.tableRole == "cell" || s.type.spec.tableRole == "header_cell") {
      const o = r.before(i), l = e == "vert" ? n > 0 ? "down" : "up" : n > 0 ? "right" : "left";
      return t.endOfTextblock(l) ? o : null;
    }
  }
  return null;
}
function sh(t, e) {
  for (; e && e != t.dom; e = e.parentNode) if (e.nodeName == "TD" || e.nodeName == "TH") return e;
  return null;
}
function wo(t, e) {
  const n = t.posAtCoords({
    left: e.clientX,
    top: e.clientY
  });
  if (!n) return null;
  let { inside: r, pos: i } = n;
  return r >= 0 && ur(t.state.doc.resolve(r)) || ur(t.state.doc.resolve(i));
}
var VS = class {
  constructor(t, e) {
    this.node = t, this.defaultCellMinWidth = e, this.dom = document.createElement("div"), this.dom.className = "tableWrapper", this.table = this.dom.appendChild(document.createElement("table")), this.table.style.setProperty("--default-cell-min-width", `${e}px`), this.colgroup = this.table.appendChild(document.createElement("colgroup")), wl(t, this.colgroup, this.table, e), this.contentDOM = this.table.appendChild(document.createElement("tbody"));
  }
  update(t) {
    return t.type != this.node.type ? !1 : (this.node = t, wl(t, this.colgroup, this.table, this.defaultCellMinWidth), !0);
  }
  ignoreMutation(t) {
    return t.type == "attributes" && (t.target == this.table || this.colgroup.contains(t.target));
  }
};
function wl(t, e, n, r, i, s) {
  let o = 0, l = !0, a = e.firstChild;
  const u = t.firstChild;
  if (u) {
    for (let h = 0, d = 0; h < u.childCount; h++) {
      const { colspan: f, colwidth: p } = u.child(h).attrs;
      for (let m = 0; m < f; m++, d++) {
        const y = i == d ? s : p && p[m], g = y ? y + "px" : "";
        if (o += y || r, y || (l = !1), a)
          a.style.width != g && (a.style.width = g), a = a.nextSibling;
        else {
          const b = document.createElement("col");
          b.style.width = g, e.appendChild(b);
        }
      }
    }
    for (; a; ) {
      var c;
      const h = a.nextSibling;
      (c = a.parentNode) === null || c === void 0 || c.removeChild(a), a = h;
    }
    l ? (n.style.width = o + "px", n.style.minWidth = "") : (n.style.width = "", n.style.minWidth = o + "px");
  }
}
const ht = new st("tableColumnResizing");
function WS({ handleWidth: t = 5, cellMinWidth: e = 25, defaultCellMinWidth: n = 100, View: r = VS, lastColumnResizable: i = !0 } = {}) {
  const s = new it({
    key: ht,
    state: {
      init(o, l) {
        var a;
        const u = (a = s.spec) === null || a === void 0 || (a = a.props) === null || a === void 0 ? void 0 : a.nodeViews, c = Ct(l.schema).table.name;
        return r && u && (u[c] = (h, d) => new r(h, n, d)), new HS(-1, !1);
      },
      apply(o, l) {
        return l.apply(o);
      }
    },
    props: {
      attributes: (o) => {
        const l = ht.getState(o);
        return l && l.activeHandle > -1 ? { class: "resize-cursor" } : {};
      },
      handleDOMEvents: {
        mousemove: (o, l) => {
          US(o, l, t, i);
        },
        mouseleave: (o) => {
          qS(o);
        },
        mousedown: (o, l) => {
          KS(o, l, e, n);
        }
      },
      decorations: (o) => {
        const l = ht.getState(o);
        if (l && l.activeHandle > -1) return XS(o, l.activeHandle);
      },
      nodeViews: {}
    }
  });
  return s;
}
var HS = class Ki {
  constructor(e, n) {
    this.activeHandle = e, this.dragging = n;
  }
  apply(e) {
    const n = this, r = e.getMeta(ht);
    if (r && r.setHandle != null) return new Ki(r.setHandle, !1);
    if (r && r.setDragging !== void 0) return new Ki(n.activeHandle, r.setDragging);
    if (n.activeHandle > -1 && e.docChanged) {
      let i = e.mapping.map(n.activeHandle, -1);
      return yl(e.doc.resolve(i)) || (i = -1), new Ki(i, n.dragging);
    }
    return n;
  }
};
function US(t, e, n, r) {
  if (!t.editable) return;
  const i = ht.getState(t.state);
  if (i && !i.dragging) {
    const s = GS(e.target);
    let o = -1;
    if (s) {
      const { left: l, right: a } = s.getBoundingClientRect();
      e.clientX - l <= n ? o = oh(t, e, "left", n) : a - e.clientX <= n && (o = oh(t, e, "right", n));
    }
    if (o != i.activeHandle) {
      if (!r && o !== -1) {
        const l = t.state.doc.resolve(o), a = l.node(-1), u = Se.get(a), c = l.start(-1);
        if (u.colCount(l.pos - c) + l.nodeAfter.attrs.colspan - 1 == u.width - 1) return;
      }
      Vp(t, o);
    }
  }
}
function qS(t) {
  if (!t.editable) return;
  const e = ht.getState(t.state);
  e && e.activeHandle > -1 && !e.dragging && Vp(t, -1);
}
function KS(t, e, n, r) {
  var i;
  if (!t.editable) return !1;
  const s = (i = t.dom.ownerDocument.defaultView) !== null && i !== void 0 ? i : window, o = ht.getState(t.state);
  if (!o || o.activeHandle == -1 || o.dragging) return !1;
  const l = t.state.doc.nodeAt(o.activeHandle), a = JS(t, o.activeHandle, l.attrs);
  t.dispatch(t.state.tr.setMeta(ht, { setDragging: {
    startX: e.clientX,
    startWidth: a
  } }));
  function u(h) {
    s.removeEventListener("mouseup", u), s.removeEventListener("mousemove", c);
    const d = ht.getState(t.state);
    d?.dragging && (ZS(t, d.activeHandle, lh(d.dragging, h, n)), t.dispatch(t.state.tr.setMeta(ht, { setDragging: null })));
  }
  function c(h) {
    if (!h.which) return u(h);
    const d = ht.getState(t.state);
    if (d && d.dragging) {
      const f = lh(d.dragging, h, n);
      ah(t, d.activeHandle, f, r);
    }
  }
  return ah(t, o.activeHandle, a, r), s.addEventListener("mouseup", u), s.addEventListener("mousemove", c), e.preventDefault(), !0;
}
function JS(t, e, { colspan: n, colwidth: r }) {
  const i = r && r[r.length - 1];
  if (i) return i;
  const s = t.domAtPos(e);
  let o = s.node.childNodes[s.offset].offsetWidth, l = n;
  if (r)
    for (let a = 0; a < n; a++) r[a] && (o -= r[a], l--);
  return o / l;
}
function GS(t) {
  for (; t && t.nodeName != "TD" && t.nodeName != "TH"; ) t = t.classList && t.classList.contains("ProseMirror") ? null : t.parentNode;
  return t;
}
function oh(t, e, n, r) {
  const i = n == "right" ? -r : r, s = t.posAtCoords({
    left: e.clientX + i,
    top: e.clientY
  });
  if (!s) return -1;
  const { pos: o } = s, l = ur(t.state.doc.resolve(o));
  if (!l) return -1;
  if (n == "right") return l.pos;
  const a = Se.get(l.node(-1)), u = l.start(-1), c = a.map.indexOf(l.pos - u);
  return c % a.width == 0 ? -1 : u + a.map[c - 1];
}
function lh(t, e, n) {
  const r = e.clientX - t.startX;
  return Math.max(n, t.startWidth + r);
}
function Vp(t, e) {
  t.dispatch(t.state.tr.setMeta(ht, { setHandle: e }));
}
function ZS(t, e, n) {
  const r = t.state.doc.resolve(e), i = r.node(-1), s = Se.get(i), o = r.start(-1), l = s.colCount(r.pos - o) + r.nodeAfter.attrs.colspan - 1, a = t.state.tr;
  for (let u = 0; u < s.height; u++) {
    const c = u * s.width + l;
    if (u && s.map[c] == s.map[c - s.width]) continue;
    const h = s.map[c], d = i.nodeAt(h).attrs, f = d.colspan == 1 ? 0 : l - s.colCount(h);
    if (d.colwidth && d.colwidth[f] == n) continue;
    const p = d.colwidth ? d.colwidth.slice() : YS(d.colspan);
    p[f] = n, a.setNodeMarkup(o + h, null, {
      ...d,
      colwidth: p
    });
  }
  a.docChanged && t.dispatch(a);
}
function ah(t, e, n, r) {
  const i = t.state.doc.resolve(e), s = i.node(-1), o = i.start(-1), l = Se.get(s).colCount(i.pos - o) + i.nodeAfter.attrs.colspan - 1;
  let a = t.domAtPos(i.start(-1)).node;
  for (; a && a.nodeName != "TABLE"; ) a = a.parentNode;
  a && wl(s, a.firstChild, a, r, l, n);
}
function YS(t) {
  return Array(t).fill(0);
}
function XS(t, e) {
  const n = [], r = t.doc.resolve(e), i = r.node(-1);
  if (!i) return Ae.empty;
  const s = Se.get(i), o = r.start(-1), l = s.colCount(r.pos - o) + r.nodeAfter.attrs.colspan - 1;
  for (let u = 0; u < s.height; u++) {
    const c = l + u * s.width;
    if ((l == s.width - 1 || s.map[c] != s.map[c + 1]) && (u == 0 || s.map[c] != s.map[c - s.width])) {
      var a;
      const h = s.map[c], d = o + h + i.nodeAt(h).nodeSize - 1, f = document.createElement("div");
      f.className = "column-resize-handle", !((a = ht.getState(t)) === null || a === void 0) && a.dragging && n.push(He.node(o + h, o + h + i.nodeAt(h).nodeSize, { class: "column-resize-dragging" })), n.push(He.widget(d, f));
    }
  }
  return Ae.create(t.doc, n);
}
function QS({ allowTableNodeSelection: t = !1 } = {}) {
  return new it({
    key: cn,
    state: {
      init() {
        return null;
      },
      apply(e, n) {
        const r = e.getMeta(cn);
        if (r != null) return r == -1 ? null : r;
        if (n == null || !e.docChanged) return n;
        const { deleted: i, pos: s } = e.mapping.mapResult(n);
        return i ? null : s;
      }
    },
    props: {
      decorations: cS,
      handleDOMEvents: { mousedown: jS },
      createSelectionBetween(e) {
        return cn.getState(e.state) != null ? e.state.selection : null;
      },
      handleTripleClick: FS,
      handleKeyDown: BS,
      handlePaste: $S
    },
    appendTransaction(e, n, r) {
      return dS(r, mS(r, n), t);
    }
  });
}
var ds = typeof navigator < "u" ? navigator : null, Xa = ds && ds.userAgent || "", ev = /Edge\/(\d+)/.exec(Xa), tv = /MSIE \d/.exec(Xa), nv = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(Xa), rv = !!(tv || nv || ev), iv = !rv && !!ds && /Apple Computer/.test(ds.vendor), Wp = new st("safari-ime-span"), bl = !1, sv = {
  key: Wp,
  props: {
    decorations: ov,
    handleDOMEvents: {
      compositionstart: () => {
        bl = !0;
      },
      compositionend: () => {
        bl = !1;
      }
    }
  }
};
function ov(t) {
  const { $from: e, $to: n, to: r } = t.selection;
  if (bl && e.sameParent(n)) {
    const i = He.widget(r, lv, {
      ignoreSelection: !0,
      key: "safari-ime-span"
    });
    return Ae.create(t.doc, [i]);
  }
}
function lv(t) {
  const e = t.dom.ownerDocument.createElement("span");
  return e.className = "ProseMirror-safari-ime-span", e;
}
var av = new it(iv ? sv : { key: Wp });
function uh(t, e) {
  const n = String(t);
  if (typeof e != "string")
    throw new TypeError("Expected character");
  let r = 0, i = n.indexOf(e);
  for (; i !== -1; )
    r++, i = n.indexOf(e, i + e.length);
  return r;
}
function uv(t) {
  if (typeof t != "string")
    throw new TypeError("Expected a string");
  return t.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}
function cv(t, e, n) {
  const i = bs((n || {}).ignore || []), s = hv(e);
  let o = -1;
  for (; ++o < s.length; )
    Ol(t, "text", l);
  function l(u, c) {
    let h = -1, d;
    for (; ++h < c.length; ) {
      const f = c[h], p = d ? d.children : void 0;
      if (i(
        f,
        p ? p.indexOf(f) : void 0,
        d
      ))
        return;
      d = f;
    }
    if (d)
      return a(u, c);
  }
  function a(u, c) {
    const h = c[c.length - 1], d = s[o][0], f = s[o][1];
    let p = 0;
    const y = h.children.indexOf(u);
    let g = !1, b = [];
    d.lastIndex = 0;
    let x = d.exec(u.value);
    for (; x; ) {
      const A = x.index, E = {
        index: x.index,
        input: x.input,
        stack: [...c, u]
      };
      let v = f(...x, E);
      if (typeof v == "string" && (v = v.length > 0 ? { type: "text", value: v } : void 0), v === !1 ? d.lastIndex = A + 1 : (p !== A && b.push({
        type: "text",
        value: u.value.slice(p, A)
      }), Array.isArray(v) ? b.push(...v) : v && b.push(v), p = A + x[0].length, g = !0), !d.global)
        break;
      x = d.exec(u.value);
    }
    return g ? (p < u.value.length && b.push({ type: "text", value: u.value.slice(p) }), h.children.splice(y, 1, ...b)) : b = [u], y + b.length;
  }
}
function hv(t) {
  const e = [];
  if (!Array.isArray(t))
    throw new TypeError("Expected find and replace tuple or list of tuples");
  const n = !t[0] || Array.isArray(t[0]) ? t : [t];
  let r = -1;
  for (; ++r < n.length; ) {
    const i = n[r];
    e.push([fv(i[0]), dv(i[1])]);
  }
  return e;
}
function fv(t) {
  return typeof t == "string" ? new RegExp(uv(t), "g") : t;
}
function dv(t) {
  return typeof t == "function" ? t : function() {
    return t;
  };
}
const bo = "phrasing", xo = ["autolink", "link", "image", "label"];
function pv() {
  return {
    transforms: [xv],
    enter: {
      literalAutolink: gv,
      literalAutolinkEmail: Co,
      literalAutolinkHttp: Co,
      literalAutolinkWww: Co
    },
    exit: {
      literalAutolink: bv,
      literalAutolinkEmail: wv,
      literalAutolinkHttp: yv,
      literalAutolinkWww: kv
    }
  };
}
function mv() {
  return {
    unsafe: [
      {
        character: "@",
        before: "[+\\-.\\w]",
        after: "[\\-.\\w]",
        inConstruct: bo,
        notInConstruct: xo
      },
      {
        character: ".",
        before: "[Ww]",
        after: "[\\-.\\w]",
        inConstruct: bo,
        notInConstruct: xo
      },
      {
        character: ":",
        before: "[ps]",
        after: "\\/",
        inConstruct: bo,
        notInConstruct: xo
      }
    ]
  };
}
function gv(t) {
  this.enter({ type: "link", title: null, url: "", children: [] }, t);
}
function Co(t) {
  this.config.enter.autolinkProtocol.call(this, t);
}
function yv(t) {
  this.config.exit.autolinkProtocol.call(this, t);
}
function kv(t) {
  this.config.exit.data.call(this, t);
  const e = this.stack[this.stack.length - 1];
  e.type, e.url = "http://" + this.sliceSerialize(t);
}
function wv(t) {
  this.config.exit.autolinkEmail.call(this, t);
}
function bv(t) {
  this.exit(t);
}
function xv(t) {
  cv(
    t,
    [
      [/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi, Cv],
      [new RegExp("(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)", "gu"), Sv]
    ],
    { ignore: ["link", "linkReference"] }
  );
}
function Cv(t, e, n, r, i) {
  let s = "";
  if (!Hp(i) || (/^w/i.test(e) && (n = e + n, e = "", s = "http://"), !vv(n)))
    return !1;
  const o = Nv(n + r);
  if (!o[0]) return !1;
  const l = {
    type: "link",
    title: null,
    url: s + e + o[0],
    children: [{ type: "text", value: e + o[0] }]
  };
  return o[1] ? [l, { type: "text", value: o[1] }] : l;
}
function Sv(t, e, n, r) {
  return (
    // Not an expected previous character.
    !Hp(r, !0) || // Label ends in not allowed character.
    /[-\d_]$/.test(n) ? !1 : {
      type: "link",
      title: null,
      url: "mailto:" + e + "@" + n,
      children: [{ type: "text", value: e + "@" + n }]
    }
  );
}
function vv(t) {
  const e = t.split(".");
  return !(e.length < 2 || e[e.length - 1] && (/_/.test(e[e.length - 1]) || !/[a-zA-Z\d]/.test(e[e.length - 1])) || e[e.length - 2] && (/_/.test(e[e.length - 2]) || !/[a-zA-Z\d]/.test(e[e.length - 2])));
}
function Nv(t) {
  const e = /[!"&'),.:;<>?\]}]+$/.exec(t);
  if (!e)
    return [t, void 0];
  t = t.slice(0, e.index);
  let n = e[0], r = n.indexOf(")");
  const i = uh(t, "(");
  let s = uh(t, ")");
  for (; r !== -1 && i > s; )
    t += n.slice(0, r + 1), n = n.slice(r + 1), r = n.indexOf(")"), s++;
  return [t, n];
}
function Hp(t, e) {
  const n = t.input.charCodeAt(t.index - 1);
  return (t.index === 0 || $n(n) || ks(n)) && // If it’s an email, the previous character should not be a slash.
  (!e || n !== 47);
}
Up.peek = Rv;
function Iv() {
  this.buffer();
}
function _v(t) {
  this.enter({ type: "footnoteReference", identifier: "", label: "" }, t);
}
function Tv() {
  this.buffer();
}
function Av(t) {
  this.enter(
    { type: "footnoteDefinition", identifier: "", label: "", children: [] },
    t
  );
}
function Ev(t) {
  const e = this.resume(), n = this.stack[this.stack.length - 1];
  n.type, n.identifier = At(
    this.sliceSerialize(t)
  ).toLowerCase(), n.label = e;
}
function Mv(t) {
  this.exit(t);
}
function Ov(t) {
  const e = this.resume(), n = this.stack[this.stack.length - 1];
  n.type, n.identifier = At(
    this.sliceSerialize(t)
  ).toLowerCase(), n.label = e;
}
function Dv(t) {
  this.exit(t);
}
function Rv() {
  return "[";
}
function Up(t, e, n, r) {
  const i = n.createTracker(r);
  let s = i.move("[^");
  const o = n.enter("footnoteReference"), l = n.enter("reference");
  return s += i.move(
    n.safe(n.associationId(t), { after: "]", before: s })
  ), l(), o(), s += i.move("]"), s;
}
function zv() {
  return {
    enter: {
      gfmFootnoteCallString: Iv,
      gfmFootnoteCall: _v,
      gfmFootnoteDefinitionLabelString: Tv,
      gfmFootnoteDefinition: Av
    },
    exit: {
      gfmFootnoteCallString: Ev,
      gfmFootnoteCall: Mv,
      gfmFootnoteDefinitionLabelString: Ov,
      gfmFootnoteDefinition: Dv
    }
  };
}
function Pv(t) {
  let e = !1;
  return t && t.firstLineBlank && (e = !0), {
    handlers: { footnoteDefinition: n, footnoteReference: Up },
    // This is on by default already.
    unsafe: [{ character: "[", inConstruct: ["label", "phrasing", "reference"] }]
  };
  function n(r, i, s, o) {
    const l = s.createTracker(o);
    let a = l.move("[^");
    const u = s.enter("footnoteDefinition"), c = s.enter("label");
    return a += l.move(
      s.safe(s.associationId(r), { before: a, after: "]" })
    ), c(), a += l.move("]:"), r.children && r.children.length > 0 && (l.shift(4), a += l.move(
      (e ? `
` : " ") + s.indentLines(
        s.containerFlow(r, l.current()),
        e ? qp : Lv
      )
    )), u(), a;
  }
}
function Lv(t, e, n) {
  return e === 0 ? t : qp(t, e, n);
}
function qp(t, e, n) {
  return (n ? "" : "    ") + t;
}
const Bv = [
  "autolink",
  "destinationLiteral",
  "destinationRaw",
  "reference",
  "titleQuote",
  "titleApostrophe"
];
Qa.attention = Wv;
Qa.peek = Hv;
function Fv() {
  return {
    canContainEols: ["delete"],
    enter: { strikethrough: jv },
    exit: { strikethrough: Vv }
  };
}
function $v() {
  return {
    handlers: { delete: Qa },
    unsafe: [
      {
        character: "~",
        inConstruct: "phrasing",
        notInConstruct: Bv
      }
    ]
  };
}
function jv(t) {
  this.enter({ type: "delete", children: [], position: void 0 }, t);
}
function Vv(t) {
  this.exit(t);
}
function Qa(t, e, n, r) {
  const i = n.createTracker(r), s = n.stack.includes("strikethrough") ? "~" : "~~", o = n.enter("strikethrough");
  let l = i.move(s);
  return l += n.containerPhrasing(t, {
    ...i.current(),
    before: l,
    after: "~"
  }), l += i.move(s), o(), l;
}
function Wv() {
  return { construct: "strikethrough", markers: ["~"], sizes: [2, 1] };
}
function Hv() {
  return "~";
}
function Uv(t) {
  return t.length;
}
function qv(t, e) {
  const n = e || {}, r = (n.align || []).concat(), i = n.stringLength || Uv, s = [], o = [], l = [], a = [];
  let u = 0, c = -1;
  for (; ++c < t.length; ) {
    const m = [], y = [];
    let g = -1;
    for (t[c].length > u && (u = t[c].length); ++g < t[c].length; ) {
      const b = Kv(t[c][g]);
      if (n.alignDelimiters !== !1) {
        const x = i(b);
        y[g] = x, (a[g] === void 0 || x > a[g]) && (a[g] = x);
      }
      m.push(b);
    }
    o[c] = m, l[c] = y;
  }
  let h = -1;
  if (typeof r == "object" && "length" in r)
    for (; ++h < u; )
      s[h] = ch(r[h]);
  else {
    const m = ch(r);
    for (; ++h < u; )
      s[h] = m;
  }
  h = -1;
  const d = [], f = [];
  for (; ++h < u; ) {
    const m = s[h];
    let y = "", g = "";
    m === 99 ? (y = ":", g = ":") : m === 108 ? y = ":" : m === 114 && (g = ":");
    let b = n.alignDelimiters === !1 ? 1 : Math.max(
      1,
      a[h] - y.length - g.length
    );
    const x = y + "-".repeat(b) + g;
    n.alignDelimiters !== !1 && (b = y.length + b + g.length, b > a[h] && (a[h] = b), f[h] = b), d[h] = x;
  }
  o.splice(1, 0, d), l.splice(1, 0, f), c = -1;
  const p = [];
  for (; ++c < o.length; ) {
    const m = o[c], y = l[c];
    h = -1;
    const g = [];
    for (; ++h < u; ) {
      const b = m[h] || "";
      let x = "", A = "";
      if (n.alignDelimiters !== !1) {
        const E = a[h] - (y[h] || 0), v = s[h];
        v === 114 ? x = " ".repeat(E) : v === 99 ? E % 2 ? (x = " ".repeat(E / 2 + 0.5), A = " ".repeat(E / 2 - 0.5)) : (x = " ".repeat(E / 2), A = x) : A = " ".repeat(E);
      }
      n.delimiterStart !== !1 && !h && g.push("|"), n.padding !== !1 && // Don’t add the opening space if we’re not aligning and the cell is
      // empty: there will be a closing space.
      !(n.alignDelimiters === !1 && b === "") && (n.delimiterStart !== !1 || h) && g.push(" "), n.alignDelimiters !== !1 && g.push(x), g.push(b), n.alignDelimiters !== !1 && g.push(A), n.padding !== !1 && g.push(" "), (n.delimiterEnd !== !1 || h !== u - 1) && g.push("|");
    }
    p.push(
      n.delimiterEnd === !1 ? g.join("").replace(/ +$/, "") : g.join("")
    );
  }
  return p.join(`
`);
}
function Kv(t) {
  return t == null ? "" : String(t);
}
function ch(t) {
  const e = typeof t == "string" ? t.codePointAt(0) : 0;
  return e === 67 || e === 99 ? 99 : e === 76 || e === 108 ? 108 : e === 82 || e === 114 ? 114 : 0;
}
function Jv() {
  return {
    enter: {
      table: Gv,
      tableData: hh,
      tableHeader: hh,
      tableRow: Yv
    },
    exit: {
      codeText: Xv,
      table: Zv,
      tableData: So,
      tableHeader: So,
      tableRow: So
    }
  };
}
function Gv(t) {
  const e = t._align;
  this.enter(
    {
      type: "table",
      align: e.map(function(n) {
        return n === "none" ? null : n;
      }),
      children: []
    },
    t
  ), this.data.inTable = !0;
}
function Zv(t) {
  this.exit(t), this.data.inTable = void 0;
}
function Yv(t) {
  this.enter({ type: "tableRow", children: [] }, t);
}
function So(t) {
  this.exit(t);
}
function hh(t) {
  this.enter({ type: "tableCell", children: [] }, t);
}
function Xv(t) {
  let e = this.resume();
  this.data.inTable && (e = e.replace(/\\([\\|])/g, Qv));
  const n = this.stack[this.stack.length - 1];
  n.type, n.value = e, this.exit(t);
}
function Qv(t, e) {
  return e === "|" ? e : t;
}
function eN(t) {
  const e = t || {}, n = e.tableCellPadding, r = e.tablePipeAlign, i = e.stringLength, s = n ? " " : "|";
  return {
    unsafe: [
      { character: "\r", inConstruct: "tableCell" },
      { character: `
`, inConstruct: "tableCell" },
      // A pipe, when followed by a tab or space (padding), or a dash or colon
      // (unpadded delimiter row), could result in a table.
      { atBreak: !0, character: "|", after: "[	 :-]" },
      // A pipe in a cell must be encoded.
      { character: "|", inConstruct: "tableCell" },
      // A colon must be followed by a dash, in which case it could start a
      // delimiter row.
      { atBreak: !0, character: ":", after: "-" },
      // A delimiter row can also start with a dash, when followed by more
      // dashes, a colon, or a pipe.
      // This is a stricter version than the built in check for lists, thematic
      // breaks, and setex heading underlines though:
      // <https://github.com/syntax-tree/mdast-util-to-markdown/blob/51a2038/lib/unsafe.js#L57>
      { atBreak: !0, character: "-", after: "[:|-]" }
    ],
    handlers: {
      inlineCode: d,
      table: o,
      tableCell: a,
      tableRow: l
    }
  };
  function o(f, p, m, y) {
    return u(c(f, m, y), f.align);
  }
  function l(f, p, m, y) {
    const g = h(f, m, y), b = u([g]);
    return b.slice(0, b.indexOf(`
`));
  }
  function a(f, p, m, y) {
    const g = m.enter("tableCell"), b = m.enter("phrasing"), x = m.containerPhrasing(f, {
      ...y,
      before: s,
      after: s
    });
    return b(), g(), x;
  }
  function u(f, p) {
    return qv(f, {
      align: p,
      // @ts-expect-error: `markdown-table` types should support `null`.
      alignDelimiters: r,
      // @ts-expect-error: `markdown-table` types should support `null`.
      padding: n,
      // @ts-expect-error: `markdown-table` types should support `null`.
      stringLength: i
    });
  }
  function c(f, p, m) {
    const y = f.children;
    let g = -1;
    const b = [], x = p.enter("table");
    for (; ++g < y.length; )
      b[g] = h(y[g], p, m);
    return x(), b;
  }
  function h(f, p, m) {
    const y = f.children;
    let g = -1;
    const b = [], x = p.enter("tableRow");
    for (; ++g < y.length; )
      b[g] = a(y[g], f, p, m);
    return x(), b;
  }
  function d(f, p, m) {
    let y = zl.inlineCode(f, p, m);
    return m.stack.includes("tableCell") && (y = y.replace(/\|/g, "\\$&")), y;
  }
}
function tN() {
  return {
    exit: {
      taskListCheckValueChecked: fh,
      taskListCheckValueUnchecked: fh,
      paragraph: rN
    }
  };
}
function nN() {
  return {
    unsafe: [{ atBreak: !0, character: "-", after: "[:|-]" }],
    handlers: { listItem: iN }
  };
}
function fh(t) {
  const e = this.stack[this.stack.length - 2];
  e.type, e.checked = t.type === "taskListCheckValueChecked";
}
function rN(t) {
  const e = this.stack[this.stack.length - 2];
  if (e && e.type === "listItem" && typeof e.checked == "boolean") {
    const n = this.stack[this.stack.length - 1];
    n.type;
    const r = n.children[0];
    if (r && r.type === "text") {
      const i = e.children;
      let s = -1, o;
      for (; ++s < i.length; ) {
        const l = i[s];
        if (l.type === "paragraph") {
          o = l;
          break;
        }
      }
      o === n && (r.value = r.value.slice(1), r.value.length === 0 ? n.children.shift() : n.position && r.position && typeof r.position.start.offset == "number" && (r.position.start.column++, r.position.start.offset++, n.position.start = Object.assign({}, r.position.start)));
    }
  }
  this.exit(t);
}
function iN(t, e, n, r) {
  const i = t.children[0], s = typeof t.checked == "boolean" && i && i.type === "paragraph", o = "[" + (t.checked ? "x" : " ") + "] ", l = n.createTracker(r);
  s && l.move(o);
  let a = zl.listItem(t, e, n, {
    ...r,
    ...l.current()
  });
  return s && (a = a.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/, u)), a;
  function u(c) {
    return c + o;
  }
}
function sN() {
  return [
    pv(),
    zv(),
    Fv(),
    Jv(),
    tN()
  ];
}
function oN(t) {
  return {
    extensions: [
      mv(),
      Pv(t),
      $v(),
      eN(t),
      nN()
    ]
  };
}
const lN = {
  tokenize: dN,
  partial: !0
}, Kp = {
  tokenize: pN,
  partial: !0
}, Jp = {
  tokenize: mN,
  partial: !0
}, Gp = {
  tokenize: gN,
  partial: !0
}, aN = {
  tokenize: yN,
  partial: !0
}, Zp = {
  name: "wwwAutolink",
  tokenize: hN,
  previous: Xp
}, Yp = {
  name: "protocolAutolink",
  tokenize: fN,
  previous: Qp
}, nn = {
  name: "emailAutolink",
  tokenize: cN,
  previous: em
}, $t = {};
function uN() {
  return {
    text: $t
  };
}
let Tn = 48;
for (; Tn < 123; )
  $t[Tn] = nn, Tn++, Tn === 58 ? Tn = 65 : Tn === 91 && (Tn = 97);
$t[43] = nn;
$t[45] = nn;
$t[46] = nn;
$t[95] = nn;
$t[72] = [nn, Yp];
$t[104] = [nn, Yp];
$t[87] = [nn, Zp];
$t[119] = [nn, Zp];
function cN(t, e, n) {
  const r = this;
  let i, s;
  return o;
  function o(h) {
    return !xl(h) || !em.call(r, r.previous) || eu(r.events) ? n(h) : (t.enter("literalAutolink"), t.enter("literalAutolinkEmail"), l(h));
  }
  function l(h) {
    return xl(h) ? (t.consume(h), l) : h === 64 ? (t.consume(h), a) : n(h);
  }
  function a(h) {
    return h === 46 ? t.check(aN, c, u)(h) : h === 45 || h === 95 || Ye(h) ? (s = !0, t.consume(h), a) : c(h);
  }
  function u(h) {
    return t.consume(h), i = !0, a;
  }
  function c(h) {
    return s && i && Ve(r.previous) ? (t.exit("literalAutolinkEmail"), t.exit("literalAutolink"), e(h)) : n(h);
  }
}
function hN(t, e, n) {
  const r = this;
  return i;
  function i(o) {
    return o !== 87 && o !== 119 || !Xp.call(r, r.previous) || eu(r.events) ? n(o) : (t.enter("literalAutolink"), t.enter("literalAutolinkWww"), t.check(lN, t.attempt(Kp, t.attempt(Jp, s), n), n)(o));
  }
  function s(o) {
    return t.exit("literalAutolinkWww"), t.exit("literalAutolink"), e(o);
  }
}
function fN(t, e, n) {
  const r = this;
  let i = "", s = !1;
  return o;
  function o(h) {
    return (h === 72 || h === 104) && Qp.call(r, r.previous) && !eu(r.events) ? (t.enter("literalAutolink"), t.enter("literalAutolinkHttp"), i += String.fromCodePoint(h), t.consume(h), l) : n(h);
  }
  function l(h) {
    if (Ve(h) && i.length < 5)
      return i += String.fromCodePoint(h), t.consume(h), l;
    if (h === 58) {
      const d = i.toLowerCase();
      if (d === "http" || d === "https")
        return t.consume(h), a;
    }
    return n(h);
  }
  function a(h) {
    return h === 47 ? (t.consume(h), s ? u : (s = !0, a)) : n(h);
  }
  function u(h) {
    return h === null || Zi(h) || Ne(h) || $n(h) || ks(h) ? n(h) : t.attempt(Kp, t.attempt(Jp, c), n)(h);
  }
  function c(h) {
    return t.exit("literalAutolinkHttp"), t.exit("literalAutolink"), e(h);
  }
}
function dN(t, e, n) {
  let r = 0;
  return i;
  function i(o) {
    return (o === 87 || o === 119) && r < 3 ? (r++, t.consume(o), i) : o === 46 && r === 3 ? (t.consume(o), s) : n(o);
  }
  function s(o) {
    return o === null ? n(o) : e(o);
  }
}
function pN(t, e, n) {
  let r, i, s;
  return o;
  function o(u) {
    return u === 46 || u === 95 ? t.check(Gp, a, l)(u) : u === null || Ne(u) || $n(u) || u !== 45 && ks(u) ? a(u) : (s = !0, t.consume(u), o);
  }
  function l(u) {
    return u === 95 ? r = !0 : (i = r, r = void 0), t.consume(u), o;
  }
  function a(u) {
    return i || r || !s ? n(u) : e(u);
  }
}
function mN(t, e) {
  let n = 0, r = 0;
  return i;
  function i(o) {
    return o === 40 ? (n++, t.consume(o), i) : o === 41 && r < n ? s(o) : o === 33 || o === 34 || o === 38 || o === 39 || o === 41 || o === 42 || o === 44 || o === 46 || o === 58 || o === 59 || o === 60 || o === 63 || o === 93 || o === 95 || o === 126 ? t.check(Gp, e, s)(o) : o === null || Ne(o) || $n(o) ? e(o) : (t.consume(o), i);
  }
  function s(o) {
    return o === 41 && r++, t.consume(o), i;
  }
}
function gN(t, e, n) {
  return r;
  function r(l) {
    return l === 33 || l === 34 || l === 39 || l === 41 || l === 42 || l === 44 || l === 46 || l === 58 || l === 59 || l === 63 || l === 95 || l === 126 ? (t.consume(l), r) : l === 38 ? (t.consume(l), s) : l === 93 ? (t.consume(l), i) : (
      // `<` is an end.
      l === 60 || // So is whitespace.
      l === null || Ne(l) || $n(l) ? e(l) : n(l)
    );
  }
  function i(l) {
    return l === null || l === 40 || l === 91 || Ne(l) || $n(l) ? e(l) : r(l);
  }
  function s(l) {
    return Ve(l) ? o(l) : n(l);
  }
  function o(l) {
    return l === 59 ? (t.consume(l), r) : Ve(l) ? (t.consume(l), o) : n(l);
  }
}
function yN(t, e, n) {
  return r;
  function r(s) {
    return t.consume(s), i;
  }
  function i(s) {
    return Ye(s) ? n(s) : e(s);
  }
}
function Xp(t) {
  return t === null || t === 40 || t === 42 || t === 95 || t === 91 || t === 93 || t === 126 || Ne(t);
}
function Qp(t) {
  return !Ve(t);
}
function em(t) {
  return !(t === 47 || xl(t));
}
function xl(t) {
  return t === 43 || t === 45 || t === 46 || t === 95 || Ye(t);
}
function eu(t) {
  let e = t.length, n = !1;
  for (; e--; ) {
    const r = t[e][1];
    if ((r.type === "labelLink" || r.type === "labelImage") && !r._balanced) {
      n = !0;
      break;
    }
    if (r._gfmAutolinkLiteralWalkedInto) {
      n = !1;
      break;
    }
  }
  return t.length > 0 && !n && (t[t.length - 1][1]._gfmAutolinkLiteralWalkedInto = !0), n;
}
const kN = {
  tokenize: IN,
  partial: !0
};
function wN() {
  return {
    document: {
      91: {
        name: "gfmFootnoteDefinition",
        tokenize: SN,
        continuation: {
          tokenize: vN
        },
        exit: NN
      }
    },
    text: {
      91: {
        name: "gfmFootnoteCall",
        tokenize: CN
      },
      93: {
        name: "gfmPotentialFootnoteCall",
        add: "after",
        tokenize: bN,
        resolveTo: xN
      }
    }
  };
}
function bN(t, e, n) {
  const r = this;
  let i = r.events.length;
  const s = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []);
  let o;
  for (; i--; ) {
    const a = r.events[i][1];
    if (a.type === "labelImage") {
      o = a;
      break;
    }
    if (a.type === "gfmFootnoteCall" || a.type === "labelLink" || a.type === "label" || a.type === "image" || a.type === "link")
      break;
  }
  return l;
  function l(a) {
    if (!o || !o._balanced)
      return n(a);
    const u = At(r.sliceSerialize({
      start: o.end,
      end: r.now()
    }));
    return u.codePointAt(0) !== 94 || !s.includes(u.slice(1)) ? n(a) : (t.enter("gfmFootnoteCallLabelMarker"), t.consume(a), t.exit("gfmFootnoteCallLabelMarker"), e(a));
  }
}
function xN(t, e) {
  let n = t.length;
  for (; n--; )
    if (t[n][1].type === "labelImage" && t[n][0] === "enter") {
      t[n][1];
      break;
    }
  t[n + 1][1].type = "data", t[n + 3][1].type = "gfmFootnoteCallLabelMarker";
  const r = {
    type: "gfmFootnoteCall",
    start: Object.assign({}, t[n + 3][1].start),
    end: Object.assign({}, t[t.length - 1][1].end)
  }, i = {
    type: "gfmFootnoteCallMarker",
    start: Object.assign({}, t[n + 3][1].end),
    end: Object.assign({}, t[n + 3][1].end)
  };
  i.end.column++, i.end.offset++, i.end._bufferIndex++;
  const s = {
    type: "gfmFootnoteCallString",
    start: Object.assign({}, i.end),
    end: Object.assign({}, t[t.length - 1][1].start)
  }, o = {
    type: "chunkString",
    contentType: "string",
    start: Object.assign({}, s.start),
    end: Object.assign({}, s.end)
  }, l = [
    // Take the `labelImageMarker` (now `data`, the `!`)
    t[n + 1],
    t[n + 2],
    ["enter", r, e],
    // The `[`
    t[n + 3],
    t[n + 4],
    // The `^`.
    ["enter", i, e],
    ["exit", i, e],
    // Everything in between.
    ["enter", s, e],
    ["enter", o, e],
    ["exit", o, e],
    ["exit", s, e],
    // The ending (`]`, properly parsed and labelled).
    t[t.length - 2],
    t[t.length - 1],
    ["exit", r, e]
  ];
  return t.splice(n, t.length - n + 1, ...l), t;
}
function CN(t, e, n) {
  const r = this, i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []);
  let s = 0, o;
  return l;
  function l(h) {
    return t.enter("gfmFootnoteCall"), t.enter("gfmFootnoteCallLabelMarker"), t.consume(h), t.exit("gfmFootnoteCallLabelMarker"), a;
  }
  function a(h) {
    return h !== 94 ? n(h) : (t.enter("gfmFootnoteCallMarker"), t.consume(h), t.exit("gfmFootnoteCallMarker"), t.enter("gfmFootnoteCallString"), t.enter("chunkString").contentType = "string", u);
  }
  function u(h) {
    if (
      // Too long.
      s > 999 || // Closing brace with nothing.
      h === 93 && !o || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      h === null || h === 91 || Ne(h)
    )
      return n(h);
    if (h === 93) {
      t.exit("chunkString");
      const d = t.exit("gfmFootnoteCallString");
      return i.includes(At(r.sliceSerialize(d))) ? (t.enter("gfmFootnoteCallLabelMarker"), t.consume(h), t.exit("gfmFootnoteCallLabelMarker"), t.exit("gfmFootnoteCall"), e) : n(h);
    }
    return Ne(h) || (o = !0), s++, t.consume(h), h === 92 ? c : u;
  }
  function c(h) {
    return h === 91 || h === 92 || h === 93 ? (t.consume(h), s++, u) : u(h);
  }
}
function SN(t, e, n) {
  const r = this, i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []);
  let s, o = 0, l;
  return a;
  function a(p) {
    return t.enter("gfmFootnoteDefinition")._container = !0, t.enter("gfmFootnoteDefinitionLabel"), t.enter("gfmFootnoteDefinitionLabelMarker"), t.consume(p), t.exit("gfmFootnoteDefinitionLabelMarker"), u;
  }
  function u(p) {
    return p === 94 ? (t.enter("gfmFootnoteDefinitionMarker"), t.consume(p), t.exit("gfmFootnoteDefinitionMarker"), t.enter("gfmFootnoteDefinitionLabelString"), t.enter("chunkString").contentType = "string", c) : n(p);
  }
  function c(p) {
    if (
      // Too long.
      o > 999 || // Closing brace with nothing.
      p === 93 && !l || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      p === null || p === 91 || Ne(p)
    )
      return n(p);
    if (p === 93) {
      t.exit("chunkString");
      const m = t.exit("gfmFootnoteDefinitionLabelString");
      return s = At(r.sliceSerialize(m)), t.enter("gfmFootnoteDefinitionLabelMarker"), t.consume(p), t.exit("gfmFootnoteDefinitionLabelMarker"), t.exit("gfmFootnoteDefinitionLabel"), d;
    }
    return Ne(p) || (l = !0), o++, t.consume(p), p === 92 ? h : c;
  }
  function h(p) {
    return p === 91 || p === 92 || p === 93 ? (t.consume(p), o++, c) : c(p);
  }
  function d(p) {
    return p === 58 ? (t.enter("definitionMarker"), t.consume(p), t.exit("definitionMarker"), i.includes(s) || i.push(s), xe(t, f, "gfmFootnoteDefinitionWhitespace")) : n(p);
  }
  function f(p) {
    return e(p);
  }
}
function vN(t, e, n) {
  return t.check(ni, e, t.attempt(kN, e, n));
}
function NN(t) {
  t.exit("gfmFootnoteDefinition");
}
function IN(t, e, n) {
  const r = this;
  return xe(t, i, "gfmFootnoteDefinitionIndent", 5);
  function i(s) {
    const o = r.events[r.events.length - 1];
    return o && o[1].type === "gfmFootnoteDefinitionIndent" && o[2].sliceSerialize(o[1], !0).length === 4 ? e(s) : n(s);
  }
}
function _N(t) {
  let n = (t || {}).singleTilde;
  const r = {
    name: "strikethrough",
    tokenize: s,
    resolveAll: i
  };
  return n == null && (n = !0), {
    text: {
      126: r
    },
    insideSpan: {
      null: [r]
    },
    attentionMarkers: {
      null: [126]
    }
  };
  function i(o, l) {
    let a = -1;
    for (; ++a < o.length; )
      if (o[a][0] === "enter" && o[a][1].type === "strikethroughSequenceTemporary" && o[a][1]._close) {
        let u = a;
        for (; u--; )
          if (o[u][0] === "exit" && o[u][1].type === "strikethroughSequenceTemporary" && o[u][1]._open && // If the sizes are the same:
          o[a][1].end.offset - o[a][1].start.offset === o[u][1].end.offset - o[u][1].start.offset) {
            o[a][1].type = "strikethroughSequence", o[u][1].type = "strikethroughSequence";
            const c = {
              type: "strikethrough",
              start: Object.assign({}, o[u][1].start),
              end: Object.assign({}, o[a][1].end)
            }, h = {
              type: "strikethroughText",
              start: Object.assign({}, o[u][1].end),
              end: Object.assign({}, o[a][1].start)
            }, d = [["enter", c, l], ["enter", o[u][1], l], ["exit", o[u][1], l], ["enter", h, l]], f = l.parser.constructs.insideSpan.null;
            f && Tt(d, d.length, 0, ws(f, o.slice(u + 1, a), l)), Tt(d, d.length, 0, [["exit", h, l], ["enter", o[a][1], l], ["exit", o[a][1], l], ["exit", c, l]]), Tt(o, u - 1, a - u + 3, d), a = u + d.length - 2;
            break;
          }
      }
    for (a = -1; ++a < o.length; )
      o[a][1].type === "strikethroughSequenceTemporary" && (o[a][1].type = "data");
    return o;
  }
  function s(o, l, a) {
    const u = this.previous, c = this.events;
    let h = 0;
    return d;
    function d(p) {
      return u === 126 && c[c.length - 1][1].type !== "characterEscape" ? a(p) : (o.enter("strikethroughSequenceTemporary"), f(p));
    }
    function f(p) {
      const m = zt(u);
      if (p === 126)
        return h > 1 ? a(p) : (o.consume(p), h++, f);
      if (h < 2 && !n) return a(p);
      const y = o.exit("strikethroughSequenceTemporary"), g = zt(p);
      return y._open = !g || g === 2 && !!m, y._close = !m || m === 2 && !!g, l(p);
    }
  }
}
class TN {
  /**
   * Create a new edit map.
   */
  constructor() {
    this.map = [], this.index = /* @__PURE__ */ new Map();
  }
  /**
   * Create an edit: a remove and/or add at a certain place.
   *
   * @param {number} index
   *   Index at which to apply the edit.
   * @param {number} remove
   *   Count of items to remove at the index.
   * @param {Array<Event>} add
   *   Items to add at the index.
   * @returns {undefined}
   *   Nothing.
   */
  add(e, n, r) {
    AN(this, e, n, r);
  }
  // To do: add this when moving to `micromark`.
  // /**
  //  * Create an edit: but insert `add` before existing additions.
  //  *
  //  * @param {number} index
  //  * @param {number} remove
  //  * @param {Array<Event>} add
  //  * @returns {undefined}
  //  */
  // addBefore(index, remove, add) {
  //   addImplementation(this, index, remove, add, true)
  // }
  /**
   * Done, change the events.
   *
   * @param {Array<Event>} events
   *   List of events to apply the edits to.
   * @returns {undefined}
   *   Nothing.
   */
  consume(e) {
    if (this.map.sort(function(s, o) {
      return s[0] - o[0];
    }), this.map.length === 0)
      return;
    let n = this.map.length;
    const r = [];
    for (; n > 0; )
      n -= 1, r.push(e.slice(this.map[n][0] + this.map[n][1]), this.map[n][2]), e.length = this.map[n][0];
    r.push(e.slice()), e.length = 0;
    let i = r.pop();
    for (; i; ) {
      for (const s of i)
        e.push(s);
      i = r.pop();
    }
    this.map.length = 0, this.index.clear();
  }
}
function AN(t, e, n, r) {
  if (n === 0 && r.length === 0)
    return;
  const i = t.index.get(e);
  if (i) {
    i[1] += n, i[2].push(...r);
    return;
  }
  const s = [e, n, r];
  t.map.push(s), t.index.set(e, s);
}
function EN(t, e) {
  let n = !1;
  const r = [];
  for (; e < t.length; ) {
    const i = t[e];
    if (n) {
      if (i[0] === "enter")
        i[1].type === "tableContent" && r.push(t[e + 1][1].type === "tableDelimiterMarker" ? "left" : "none");
      else if (i[1].type === "tableContent") {
        if (t[e - 1][1].type === "tableDelimiterMarker") {
          const s = r.length - 1;
          r[s] = r[s] === "left" ? "center" : "right";
        }
      } else if (i[1].type === "tableDelimiterRow")
        break;
    } else i[0] === "enter" && i[1].type === "tableDelimiterRow" && (n = !0);
    e += 1;
  }
  return r;
}
function MN() {
  return {
    flow: {
      null: {
        name: "table",
        tokenize: ON,
        resolveAll: DN
      }
    }
  };
}
function ON(t, e, n) {
  const r = this;
  let i = 0, s = 0, o;
  return l;
  function l(T) {
    let V = r.events.length - 1;
    for (; V > -1; ) {
      const {
        type: w
      } = r.events[V][1];
      if (w === "lineEnding" || // Note: markdown-rs uses `whitespace` instead of `linePrefix`
      w === "linePrefix")
        V--;
      else
        break;
    }
    const S = V > -1 ? r.events[V][1].type : null, F = S === "tableHead" || S === "tableRow" ? v : a;
    return F === v && r.parser.lazy[r.now().line] ? n(T) : F(T);
  }
  function a(T) {
    return t.enter("tableHead"), t.enter("tableRow"), u(T);
  }
  function u(T) {
    return T === 124 || (o = !0, s += 1), c(T);
  }
  function c(T) {
    return T === null ? n(T) : oe(T) ? s > 1 ? (s = 0, r.interrupt = !0, t.exit("tableRow"), t.enter("lineEnding"), t.consume(T), t.exit("lineEnding"), f) : n(T) : ge(T) ? xe(t, c, "whitespace")(T) : (s += 1, o && (o = !1, i += 1), T === 124 ? (t.enter("tableCellDivider"), t.consume(T), t.exit("tableCellDivider"), o = !0, c) : (t.enter("data"), h(T)));
  }
  function h(T) {
    return T === null || T === 124 || Ne(T) ? (t.exit("data"), c(T)) : (t.consume(T), T === 92 ? d : h);
  }
  function d(T) {
    return T === 92 || T === 124 ? (t.consume(T), h) : h(T);
  }
  function f(T) {
    return r.interrupt = !1, r.parser.lazy[r.now().line] ? n(T) : (t.enter("tableDelimiterRow"), o = !1, ge(T) ? xe(t, p, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(T) : p(T));
  }
  function p(T) {
    return T === 45 || T === 58 ? y(T) : T === 124 ? (o = !0, t.enter("tableCellDivider"), t.consume(T), t.exit("tableCellDivider"), m) : E(T);
  }
  function m(T) {
    return ge(T) ? xe(t, y, "whitespace")(T) : y(T);
  }
  function y(T) {
    return T === 58 ? (s += 1, o = !0, t.enter("tableDelimiterMarker"), t.consume(T), t.exit("tableDelimiterMarker"), g) : T === 45 ? (s += 1, g(T)) : T === null || oe(T) ? A(T) : E(T);
  }
  function g(T) {
    return T === 45 ? (t.enter("tableDelimiterFiller"), b(T)) : E(T);
  }
  function b(T) {
    return T === 45 ? (t.consume(T), b) : T === 58 ? (o = !0, t.exit("tableDelimiterFiller"), t.enter("tableDelimiterMarker"), t.consume(T), t.exit("tableDelimiterMarker"), x) : (t.exit("tableDelimiterFiller"), x(T));
  }
  function x(T) {
    return ge(T) ? xe(t, A, "whitespace")(T) : A(T);
  }
  function A(T) {
    return T === 124 ? p(T) : T === null || oe(T) ? !o || i !== s ? E(T) : (t.exit("tableDelimiterRow"), t.exit("tableHead"), e(T)) : E(T);
  }
  function E(T) {
    return n(T);
  }
  function v(T) {
    return t.enter("tableRow"), M(T);
  }
  function M(T) {
    return T === 124 ? (t.enter("tableCellDivider"), t.consume(T), t.exit("tableCellDivider"), M) : T === null || oe(T) ? (t.exit("tableRow"), e(T)) : ge(T) ? xe(t, M, "whitespace")(T) : (t.enter("data"), R(T));
  }
  function R(T) {
    return T === null || T === 124 || Ne(T) ? (t.exit("data"), M(T)) : (t.consume(T), T === 92 ? O : R);
  }
  function O(T) {
    return T === 92 || T === 124 ? (t.consume(T), R) : R(T);
  }
}
function DN(t, e) {
  let n = -1, r = !0, i = 0, s = [0, 0, 0, 0], o = [0, 0, 0, 0], l = !1, a = 0, u, c, h;
  const d = new TN();
  for (; ++n < t.length; ) {
    const f = t[n], p = f[1];
    f[0] === "enter" ? p.type === "tableHead" ? (l = !1, a !== 0 && (dh(d, e, a, u, c), c = void 0, a = 0), u = {
      type: "table",
      start: Object.assign({}, p.start),
      // Note: correct end is set later.
      end: Object.assign({}, p.end)
    }, d.add(n, 0, [["enter", u, e]])) : p.type === "tableRow" || p.type === "tableDelimiterRow" ? (r = !0, h = void 0, s = [0, 0, 0, 0], o = [0, n + 1, 0, 0], l && (l = !1, c = {
      type: "tableBody",
      start: Object.assign({}, p.start),
      // Note: correct end is set later.
      end: Object.assign({}, p.end)
    }, d.add(n, 0, [["enter", c, e]])), i = p.type === "tableDelimiterRow" ? 2 : c ? 3 : 1) : i && (p.type === "data" || p.type === "tableDelimiterMarker" || p.type === "tableDelimiterFiller") ? (r = !1, o[2] === 0 && (s[1] !== 0 && (o[0] = o[1], h = Ei(d, e, s, i, void 0, h), s = [0, 0, 0, 0]), o[2] = n)) : p.type === "tableCellDivider" && (r ? r = !1 : (s[1] !== 0 && (o[0] = o[1], h = Ei(d, e, s, i, void 0, h)), s = o, o = [s[1], n, 0, 0])) : p.type === "tableHead" ? (l = !0, a = n) : p.type === "tableRow" || p.type === "tableDelimiterRow" ? (a = n, s[1] !== 0 ? (o[0] = o[1], h = Ei(d, e, s, i, n, h)) : o[1] !== 0 && (h = Ei(d, e, o, i, n, h)), i = 0) : i && (p.type === "data" || p.type === "tableDelimiterMarker" || p.type === "tableDelimiterFiller") && (o[3] = n);
  }
  for (a !== 0 && dh(d, e, a, u, c), d.consume(e.events), n = -1; ++n < e.events.length; ) {
    const f = e.events[n];
    f[0] === "enter" && f[1].type === "table" && (f[1]._align = EN(e.events, n));
  }
  return t;
}
function Ei(t, e, n, r, i, s) {
  const o = r === 1 ? "tableHeader" : r === 2 ? "tableDelimiter" : "tableData", l = "tableContent";
  n[0] !== 0 && (s.end = Object.assign({}, er(e.events, n[0])), t.add(n[0], 0, [["exit", s, e]]));
  const a = er(e.events, n[1]);
  if (s = {
    type: o,
    start: Object.assign({}, a),
    // Note: correct end is set later.
    end: Object.assign({}, a)
  }, t.add(n[1], 0, [["enter", s, e]]), n[2] !== 0) {
    const u = er(e.events, n[2]), c = er(e.events, n[3]), h = {
      type: l,
      start: Object.assign({}, u),
      end: Object.assign({}, c)
    };
    if (t.add(n[2], 0, [["enter", h, e]]), r !== 2) {
      const d = e.events[n[2]], f = e.events[n[3]];
      if (d[1].end = Object.assign({}, f[1].end), d[1].type = "chunkText", d[1].contentType = "text", n[3] > n[2] + 1) {
        const p = n[2] + 1, m = n[3] - n[2] - 1;
        t.add(p, m, []);
      }
    }
    t.add(n[3] + 1, 0, [["exit", h, e]]);
  }
  return i !== void 0 && (s.end = Object.assign({}, er(e.events, i)), t.add(i, 0, [["exit", s, e]]), s = void 0), s;
}
function dh(t, e, n, r, i) {
  const s = [], o = er(e.events, n);
  i && (i.end = Object.assign({}, o), s.push(["exit", i, e])), r.end = Object.assign({}, o), s.push(["exit", r, e]), t.add(n + 1, 0, s);
}
function er(t, e) {
  const n = t[e], r = n[0] === "enter" ? "start" : "end";
  return n[1][r];
}
const RN = {
  name: "tasklistCheck",
  tokenize: PN
};
function zN() {
  return {
    text: {
      91: RN
    }
  };
}
function PN(t, e, n) {
  const r = this;
  return i;
  function i(a) {
    return (
      // Exit if there’s stuff before.
      r.previous !== null || // Exit if not in the first content that is the first child of a list
      // item.
      !r._gfmTasklistFirstContentOfListItem ? n(a) : (t.enter("taskListCheck"), t.enter("taskListCheckMarker"), t.consume(a), t.exit("taskListCheckMarker"), s)
    );
  }
  function s(a) {
    return Ne(a) ? (t.enter("taskListCheckValueUnchecked"), t.consume(a), t.exit("taskListCheckValueUnchecked"), o) : a === 88 || a === 120 ? (t.enter("taskListCheckValueChecked"), t.consume(a), t.exit("taskListCheckValueChecked"), o) : n(a);
  }
  function o(a) {
    return a === 93 ? (t.enter("taskListCheckMarker"), t.consume(a), t.exit("taskListCheckMarker"), t.exit("taskListCheck"), l) : n(a);
  }
  function l(a) {
    return oe(a) ? e(a) : ge(a) ? t.check({
      tokenize: LN
    }, e, n)(a) : n(a);
  }
}
function LN(t, e, n) {
  return xe(t, r, "whitespace");
  function r(i) {
    return i === null ? n(i) : e(i);
  }
}
function BN(t) {
  return Rh([
    uN(),
    wN(),
    _N(t),
    MN(),
    zN()
  ]);
}
const FN = {};
function $N(t) {
  const e = (
    /** @type {Processor<Root>} */
    this
  ), n = t || FN, r = e.data(), i = r.micromarkExtensions || (r.micromarkExtensions = []), s = r.fromMarkdownExtensions || (r.fromMarkdownExtensions = []), o = r.toMarkdownExtensions || (r.toMarkdownExtensions = []);
  i.push(BN(n)), s.push(sN()), o.push(oN(n));
}
function ae(t, e) {
  return Object.assign(t, { meta: {
    package: "@milkdown/preset-gfm",
    ...e
  } }), t;
}
var tu = ui("strike_through");
ae(tu, {
  displayName: "Attr<strikethrough>",
  group: "Strikethrough"
});
var mi = pr("strike_through", (t) => ({
  parseDOM: [{ tag: "del" }, {
    style: "text-decoration",
    getAttrs: (e) => e === "line-through"
  }],
  toDOM: (e) => ["del", t.get(tu.key)(e)],
  parseMarkdown: {
    match: (e) => e.type === "delete",
    runner: (e, n, r) => {
      e.openMark(r), e.next(n.children), e.closeMark(r);
    }
  },
  toMarkdown: {
    match: (e) => e.type.name === "strike_through",
    runner: (e, n) => {
      e.withMark(n, "delete");
    }
  }
}));
ae(mi.mark, {
  displayName: "MarkSchema<strikethrough>",
  group: "Strikethrough"
});
ae(mi.ctx, {
  displayName: "MarkSchemaCtx<strikethrough>",
  group: "Strikethrough"
});
var nu = fe("ToggleStrikeThrough", (t) => () => _s(mi.type(t)));
ae(nu, {
  displayName: "Command<ToggleStrikethrough>",
  group: "Strikethrough"
});
var tm = ot((t) => ii(/(?<![\w:/])(~{1,2})(.+?)\1(?!\w|\/)$/, mi.type(t)));
ae(tm, {
  displayName: "InputRule<strikethrough>",
  group: "Strikethrough"
});
var ru = mt("strikeThroughKeymap", { ToggleStrikethrough: {
  shortcuts: "Mod-Alt-x",
  command: (t) => {
    const e = t.get(ve);
    return () => e.call(nu.key);
  }
} });
ae(ru.ctx, {
  displayName: "KeymapCtx<strikethrough>",
  group: "Strikethrough"
});
ae(ru.shortcuts, {
  displayName: "Keymap<strikethrough>",
  group: "Strikethrough"
});
function nm(t, e) {
  const n = e.content.firstChild;
  if (e.childCount !== 1 || n?.type.name !== "paragraph") {
    t.next(e.content);
    return;
  }
  const r = n.lastChild, i = r?.type.name === "hardbreak" ? n.content.cut(0, n.content.size - r.nodeSize) : n.content;
  t.next(i);
}
var gi = iS({
  tableGroup: "block",
  cellContent: "paragraph",
  cellAttributes: { alignment: {
    default: "left",
    getFromDOM: (t) => t.style.textAlign || "left",
    setDOMAttr: (t, e) => {
      e.style = `text-align: ${t || "left"}`;
    }
  } }
}), Yt = Be("table", () => ({
  ...gi.table,
  content: "table_header_row table_row+",
  disableDropCursor: !0,
  parseMarkdown: {
    match: (t) => t.type === "table",
    runner: (t, e, n) => {
      const r = e.align, i = e.children.map((s, o) => ({
        ...s,
        align: r,
        isHeader: o === 0
      }));
      t.openNode(n), t.next(i), t.closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "table",
    runner: (t, e) => {
      const n = e.content.firstChild?.content;
      if (!n) return;
      const r = [];
      n.forEach((i) => {
        r.push(i.attrs.alignment);
      }), t.openNode("table", void 0, { align: r }), t.next(e.content), t.closeNode();
    }
  }
}));
ae(Yt.node, {
  displayName: "NodeSchema<table>",
  group: "Table"
});
ae(Yt.ctx, {
  displayName: "NodeSchemaCtx<table>",
  group: "Table"
});
var yi = Be("table_header_row", () => ({
  ...gi.table_row,
  disableDropCursor: !0,
  content: "(table_header)*",
  parseDOM: [{ tag: "tr[data-is-header]" }, {
    tag: "tr",
    getAttrs: (t) => t instanceof HTMLElement && t.querySelector("th") ? {} : !1
  }],
  toDOM() {
    return [
      "tr",
      { "data-is-header": !0 },
      0
    ];
  },
  parseMarkdown: {
    match: (t) => !!(t.type === "tableRow" && t.isHeader),
    runner: (t, e, n) => {
      const r = e.align, i = e.children.map((s, o) => ({
        ...s,
        align: r[o],
        isHeader: e.isHeader
      }));
      t.openNode(n), t.next(i), t.closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "table_header_row",
    runner: (t, e) => {
      e.content.size !== 0 && (t.openNode("tableRow", void 0, { isHeader: !0 }), t.next(e.content), t.closeNode());
    }
  }
}));
ae(yi.node, {
  displayName: "NodeSchema<tableHeaderRow>",
  group: "Table"
});
ae(yi.ctx, {
  displayName: "NodeSchemaCtx<tableHeaderRow>",
  group: "Table"
});
var wr = Be("table_row", () => ({
  ...gi.table_row,
  disableDropCursor: !0,
  content: "(table_cell)*",
  parseMarkdown: {
    match: (t) => t.type === "tableRow",
    runner: (t, e, n) => {
      const r = e.align, i = e.children.map((s, o) => ({
        ...s,
        align: r[o]
      }));
      t.openNode(n), t.next(i), t.closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "table_row",
    runner: (t, e) => {
      e.content.size !== 0 && (t.openNode("tableRow"), t.next(e.content), t.closeNode());
    }
  }
}));
ae(wr.node, {
  displayName: "NodeSchema<tableRow>",
  group: "Table"
});
ae(wr.ctx, {
  displayName: "NodeSchemaCtx<tableRow>",
  group: "Table"
});
var ki = Be("table_cell", () => ({
  ...gi.table_cell,
  disableDropCursor: !0,
  parseMarkdown: {
    match: (t) => t.type === "tableCell" && !t.isHeader,
    runner: (t, e, n) => {
      const r = e.align;
      t.openNode(n, { alignment: r }).openNode(t.schema.nodes.paragraph).next(e.children).closeNode().closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "table_cell",
    runner: (t, e) => {
      t.openNode("tableCell"), nm(t, e), t.closeNode();
    }
  }
}));
ae(ki.node, {
  displayName: "NodeSchema<tableCell>",
  group: "Table"
});
ae(ki.ctx, {
  displayName: "NodeSchemaCtx<tableCell>",
  group: "Table"
});
var cr = Be("table_header", () => ({
  ...gi.table_header,
  disableDropCursor: !0,
  parseMarkdown: {
    match: (t) => t.type === "tableCell" && !!t.isHeader,
    runner: (t, e, n) => {
      const r = e.align;
      t.openNode(n, { alignment: r }), t.openNode(t.schema.nodes.paragraph), t.next(e.children), t.closeNode(), t.closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === "table_header",
    runner: (t, e) => {
      t.openNode("tableCell"), nm(t, e), t.closeNode();
    }
  }
}));
ae(cr.node, {
  displayName: "NodeSchema<tableHeader>",
  group: "Table"
});
ae(cr.ctx, {
  displayName: "NodeSchemaCtx<tableHeader>",
  group: "Table"
});
function rm(t, e = 3, n = 3) {
  const r = Array(n).fill(0).map(() => ki.type(t).createAndFill()), i = Array(n).fill(0).map(() => cr.type(t).createAndFill()), s = Array(e).fill(0).map((o, l) => l === 0 ? yi.type(t).create(null, i) : wr.type(t).create(null, r));
  return Yt.type(t).create(null, s);
}
function im(t) {
  return (e, n) => (r) => {
    n = n ?? r.selection.from;
    const i = r.doc.resolve(n), s = eb((a) => a.type.name === "table")(i), o = s ? {
      node: s.node,
      from: s.start
    } : void 0, l = t === "row";
    if (o) {
      const a = Se.get(o.node);
      if (e >= 0 && e < (l ? a.height : a.width)) {
        const u = a.positionAt(l ? e : a.height - 1, l ? a.width - 1 : e, o.node), c = r.doc.resolve(o.from + u), h = l ? Te.rowSelection : Te.colSelection, d = a.positionAt(l ? e : 0, l ? 0 : e, o.node), f = r.doc.resolve(o.from + d);
        return sd(r.setSelection(h(c, f)));
      }
    }
    return r;
  };
}
var jN = im("row"), VN = im("col");
function sm(t, e, { map: n, tableStart: r, table: i }, s) {
  const o = Array(s).fill(0).reduce((a, u, c) => a + i.child(c).nodeSize, r), l = Array(n.width).fill(0).map((a, u) => {
    const c = i.nodeAt(n.map[u]);
    return ki.type(t).createAndFill({ alignment: c?.attrs.alignment });
  });
  return e.insert(o, wr.type(t).create(null, l)), e;
}
function WN(t) {
  const e = pi(t.$from);
  if (!e) return;
  const n = Se.get(e.node);
  return n.cellsInRect({
    left: 0,
    right: n.width,
    top: 0,
    bottom: n.height
  }).map((r) => {
    const i = e.node.nodeAt(r), s = r + e.start;
    return {
      pos: s,
      start: s + 1,
      node: i
    };
  });
}
function HN(t) {
  const e = WN(t.selection);
  if (e && e[0]) {
    const n = t.doc.resolve(e[0].pos), r = e[e.length - 1];
    if (r) {
      const i = t.doc.resolve(r.pos);
      return sd(t.setSelection(new Te(i, n)));
    }
  }
  return t;
}
var iu = fe("GoToPrevTableCell", () => () => $p(-1));
ae(iu, {
  displayName: "Command<goToPrevTableCellCommand>",
  group: "Table"
});
var su = fe("GoToNextTableCell", () => () => $p(1));
ae(su, {
  displayName: "Command<goToNextTableCellCommand>",
  group: "Table"
});
var ou = fe("ExitTable", (t) => () => (e, n) => {
  if (!Nt(e)) return !1;
  const { $head: r } = e.selection, i = Q1(r, Yt.type(t));
  if (!i) return !1;
  const { to: s } = i, o = e.tr.replaceWith(s, s, Lt.type(t).createAndFill());
  return o.setSelection(he.near(o.doc.resolve(s), 1)).scrollIntoView(), n?.(o), !0;
});
ae(ou, {
  displayName: "Command<breakTableCommand>",
  group: "Table"
});
var om = fe("InsertTable", (t) => ({ row: e, col: n } = {}) => (r, i) => {
  const { selection: s, tr: o } = r, { from: l } = s, a = rm(t, e, n), u = o.replaceSelectionWith(a), c = he.findFrom(u.doc.resolve(l), 1, !0);
  return c && u.setSelection(c), i?.(u), !0;
});
ae(om, {
  displayName: "Command<insertTableCommand>",
  group: "Table"
});
var lm = fe("MoveRow", () => ({ from: t, to: e, pos: n } = {}) => OS({
  from: t ?? 0,
  to: e ?? 0,
  pos: n
}));
ae(lm, {
  displayName: "Command<moveRowCommand>",
  group: "Table"
});
var am = fe("MoveCol", () => ({ from: t, to: e, pos: n } = {}) => DS({
  from: t ?? 0,
  to: e ?? 0,
  pos: n
}));
ae(am, {
  displayName: "Command<moveColCommand>",
  group: "Table"
});
var um = fe("SelectRow", () => (t = { index: 0 }) => (e, n) => {
  const { tr: r } = e;
  return !!n?.(jN(t.index, t.pos)(r));
});
ae(um, {
  displayName: "Command<selectRowCommand>",
  group: "Table"
});
var cm = fe("SelectCol", () => (t = { index: 0 }) => (e, n) => {
  const { tr: r } = e;
  return !!n?.(VN(t.index, t.pos)(r));
});
ae(cm, {
  displayName: "Command<selectColCommand>",
  group: "Table"
});
var hm = fe("SelectTable", () => () => (t, e) => {
  const { tr: n } = t;
  return !!e?.(HN(n));
});
ae(hm, {
  displayName: "Command<selectTableCommand>",
  group: "Table"
});
var fm = fe("DeleteSelectedCells", () => () => (t, e) => {
  const { selection: n } = t;
  if (!(n instanceof Te)) return !1;
  const r = n.isRowSelection(), i = n.isColSelection();
  return r && i ? MS(t, e) : i ? NS(t, e) : _S(t, e);
});
ae(fm, {
  displayName: "Command<deleteSelectedCellsCommand>",
  group: "Table"
});
var dm = fe("AddColBefore", () => () => CS);
ae(dm, {
  displayName: "Command<addColBeforeCommand>",
  group: "Table"
});
var pm = fe("AddColAfter", () => () => SS);
ae(pm, {
  displayName: "Command<addColAfterCommand>",
  group: "Table"
});
var mm = fe("AddRowBefore", (t) => () => (e, n) => {
  if (!Nt(e)) return !1;
  if (n) {
    const r = In(e);
    n(sm(t, e.tr, r, r.top));
  }
  return !0;
});
ae(mm, {
  displayName: "Command<addRowBeforeCommand>",
  group: "Table"
});
var gm = fe("AddRowAfter", (t) => () => (e, n) => {
  if (!Nt(e)) return !1;
  if (n) {
    const r = In(e);
    n(sm(t, e.tr, r, r.bottom));
  }
  return !0;
});
ae(gm, {
  displayName: "Command<addRowAfterCommand>",
  group: "Table"
});
var ym = fe("SetAlign", () => (t = "left") => TS("alignment", t));
ae(ym, {
  displayName: "Command<setAlignCommand>",
  group: "Table"
});
var km = ot((t) => new pt(/^\|(?<col>\d+)[xX](?<row>\d+)\|\s$/, (e, n, r, i) => {
  const s = e.doc.resolve(r);
  if (!s.node(-1).canReplaceWith(s.index(-1), s.indexAfter(-1), Yt.type(t))) return null;
  const o = rm(t, Math.max(Number(n.groups?.row ?? 0), 2), Number(n.groups?.col)), l = e.tr.replaceRangeWith(r, i, o);
  return l.setSelection(pe.create(l.doc, r + 3)).scrollIntoView();
}));
ae(km, {
  displayName: "InputRule<insertTableInputRule>",
  group: "Table"
});
var wm = uC((t) => ({ run: (e, n, r) => {
  if (r) return e;
  function i(u) {
    const c = u.childCount, h = u.lastChild?.childCount ?? 0;
    if (c === 0 || h === 0) return Lt.type(t).create();
    const d = u.firstChild;
    if (!(h > 0 && d && d.childCount === 0)) return u;
    if (c >= 3) {
      const y = u.child(1), g = [];
      for (let A = 0; A < y.childCount; A++) {
        const E = y.child(A);
        g.push(cr.type(t).create(E.attrs, E.content, E.marks));
      }
      const b = d.type.create(d.attrs, g), x = [];
      for (let A = 2; A < c; A++) x.push(u.child(A));
      return u.type.create(u.attrs, [b, ...x]);
    }
    const f = Array(h).fill(0).map(() => cr.type(t).createAndFill()), p = new ne(K.from(f), 0, 0), m = d.replace(0, 0, p);
    return u.replace(0, d.nodeSize, new ne(K.from(m), 0, 0));
  }
  function s(u) {
    const c = wr.type(t), h = [];
    let d = [], f = !1;
    function p() {
      if (d.length === 0) return;
      const m = yi.type(t).createAndFill(), y = Yt.type(t).create(null, [m, ...d]);
      h.push(i(y)), d = [];
    }
    return u.forEach((m) => {
      m.type === c ? (f = !0, d.push(m)) : (p(), h.push(m));
    }), p(), f ? K.from(h) : u;
  }
  function o(u) {
    let c = s(u), h = c !== u;
    const d = [];
    return c.forEach((f) => {
      if (f.type === Yt.type(t)) {
        const p = i(f);
        p !== f && (h = !0), d.push(p);
      } else if (f.childCount > 0) {
        const p = o(f.content);
        p !== f.content ? (h = !0, d.push(f.copy(p))) : d.push(f);
      } else d.push(f);
    }), h ? K.from(d) : u;
  }
  function l(u) {
    const c = [], h = [];
    u.forEach((d) => h.push(d));
    for (let d = 0; d < h.length; d++) {
      const f = h[d], p = h[d + 1];
      f.type === Lt.type(t) && f.content.size === 0 && p && p.type === Yt.type(t) || c.push(f);
    }
    return c.length < h.length ? K.from(c) : u;
  }
  let a = o(e.content);
  return a = l(a), new ne(K.from(a), e.openStart, e.openEnd);
} }));
ae(wm, {
  displayName: "PasteRule<table>",
  group: "Table"
});
var lu = mt("tableKeymap", {
  NextCell: {
    priority: 100,
    shortcuts: ["Mod-]", "Tab"],
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(su.key);
    }
  },
  PrevCell: {
    shortcuts: ["Mod-[", "Shift-Tab"],
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(iu.key);
    }
  },
  ExitTable: {
    shortcuts: ["Mod-Enter", "Enter"],
    command: (t) => {
      const e = t.get(ve);
      return () => e.call(ou.key);
    }
  }
});
ae(lu.ctx, {
  displayName: "KeymapCtx<table>",
  group: "Table"
});
ae(lu.shortcuts, {
  displayName: "Keymap<table>",
  group: "Table"
});
var vo = "footnote_definition", ph = "footnoteDefinition", au = Be("footnote_definition", () => ({
  group: "block",
  content: "block+",
  defining: !0,
  attrs: { label: {
    default: "",
    validate: "string"
  } },
  parseDOM: [{
    tag: `dl[data-type="${vo}"]`,
    getAttrs: (t) => {
      if (!(t instanceof HTMLElement)) throw Bt(t);
      return { label: t.dataset.label };
    },
    contentElement: "dd"
  }],
  toDOM: (t) => {
    const e = t.attrs.label;
    return [
      "dl",
      {
        "data-label": e,
        "data-type": vo
      },
      ["dt", e],
      ["dd", 0]
    ];
  },
  parseMarkdown: {
    match: ({ type: t }) => t === ph,
    runner: (t, e, n) => {
      t.openNode(n, { label: e.label }).next(e.children).closeNode();
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === vo,
    runner: (t, e) => {
      t.openNode(ph, void 0, {
        label: e.attrs.label,
        identifier: e.attrs.label
      }).next(e.content).closeNode();
    }
  }
}));
ae(au.ctx, {
  displayName: "NodeSchemaCtx<footnodeDef>",
  group: "footnote"
});
ae(au.node, {
  displayName: "NodeSchema<footnodeDef>",
  group: "footnote"
});
var No = "footnote_reference", uu = Be("footnote_reference", () => ({
  group: "inline",
  inline: !0,
  atom: !0,
  attrs: { label: {
    default: "",
    validate: "string"
  } },
  parseDOM: [{
    tag: `sup[data-type="${No}"]`,
    getAttrs: (t) => {
      if (!(t instanceof HTMLElement)) throw Bt(t);
      return { label: t.dataset.label };
    }
  }],
  toDOM: (t) => {
    const e = t.attrs.label;
    return [
      "sup",
      {
        "data-label": e,
        "data-type": No
      },
      e
    ];
  },
  parseMarkdown: {
    match: ({ type: t }) => t === "footnoteReference",
    runner: (t, e, n) => {
      t.addNode(n, { label: e.label });
    }
  },
  toMarkdown: {
    match: (t) => t.type.name === No,
    runner: (t, e) => {
      t.addNode("footnoteReference", void 0, void 0, {
        label: e.attrs.label,
        identifier: e.attrs.label
      });
    }
  }
}));
ae(uu.ctx, {
  displayName: "NodeSchemaCtx<footnodeRef>",
  group: "footnote"
});
ae(uu.node, {
  displayName: "NodeSchema<footnodeRef>",
  group: "footnote"
});
var cu = tn.extendSchema((t) => (e) => {
  const n = t(e);
  return {
    ...n,
    attrs: {
      ...n.attrs,
      checked: {
        default: null,
        validate: "boolean|null"
      }
    },
    parseDOM: [{
      tag: 'li[data-item-type="task"]',
      getAttrs: (r) => {
        if (!(r instanceof HTMLElement)) throw Bt(r);
        return {
          label: r.dataset.label,
          listType: r.dataset.listType,
          spread: r.dataset.spread === "true",
          checked: r.dataset.checked ? r.dataset.checked === "true" : null
        };
      }
    }, ...n?.parseDOM || []],
    toDOM: (r) => n.toDOM && r.attrs.checked == null ? n.toDOM(r) : [
      "li",
      {
        "data-item-type": "task",
        "data-label": r.attrs.label,
        "data-list-type": r.attrs.listType,
        "data-spread": r.attrs.spread,
        "data-checked": r.attrs.checked
      },
      0
    ],
    parseMarkdown: {
      match: ({ type: r }) => r === "listItem",
      runner: (r, i, s) => {
        if (i.checked == null) {
          n.parseMarkdown.runner(r, i, s);
          return;
        }
        const o = i.label != null ? `${i.label}.` : "•", l = i.checked != null ? !!i.checked : null, a = i.label != null ? "ordered" : "bullet", u = i.spread ?? !0;
        r.openNode(s, {
          label: o,
          listType: a,
          spread: u,
          checked: l
        }), r.next(i.children), r.closeNode();
      }
    },
    toMarkdown: {
      match: (r) => r.type.name === "list_item",
      runner: (r, i) => {
        if (i.attrs.checked == null) {
          n.toMarkdown.runner(r, i);
          return;
        }
        const s = i.attrs.label, o = i.attrs.listType, l = i.attrs.spread, a = i.attrs.checked;
        r.openNode("listItem", void 0, {
          label: s,
          listType: o,
          spread: l,
          checked: a
        }), r.next(i.content), r.closeNode();
      }
    }
  };
});
ae(cu.node, {
  displayName: "NodeSchema<taskListItem>",
  group: "ListItem"
});
ae(cu.ctx, {
  displayName: "NodeSchemaCtx<taskListItem>",
  group: "ListItem"
});
var bm = ot(() => new pt(/^\[(?<checked>\s|x)\]\s$/, (t, e, n, r) => {
  const i = t.doc.resolve(n);
  let s = 0, o = i.node(s);
  for (; o && o.type.name !== "list_item"; )
    s--, o = i.node(s);
  if (!o || o.attrs.checked != null) return null;
  const l = e.groups?.checked === "x", a = i.before(s), u = t.tr;
  return u.deleteRange(n, r).setNodeMarkup(a, void 0, {
    ...o.attrs,
    checked: l
  }), u;
}));
ae(bm, {
  displayName: "InputRule<wrapInTaskListInputRule>",
  group: "ListItem"
});
var UN = [ru, lu].flat(), qN = [km, bm], KN = [tm], JN = [wm], xm = Qt(() => av);
ae(xm, {
  displayName: "Prose<autoInsertSpanPlugin>",
  group: "Prose"
});
var GN = Qt(() => WS({}));
ae(GN, {
  displayName: "Prose<columnResizingPlugin>",
  group: "Prose"
});
var Cm = Qt(() => QS({ allowTableNodeSelection: !0 }));
ae(Cm, {
  displayName: "Prose<tableEditingPlugin>",
  group: "Prose"
});
var Rs = Nn("remarkGFM", () => $N);
ae(Rs.plugin, {
  displayName: "Remark<remarkGFMPlugin>",
  group: "Remark"
});
ae(Rs.options, {
  displayName: "RemarkConfig<remarkGFMPlugin>",
  group: "Remark"
});
var ZN = new st("MILKDOWN_KEEP_TABLE_ALIGN_PLUGIN");
function YN(t, e) {
  let n = 0;
  return e.forEach((r, i, s) => {
    r === t && (n = s);
  }), n;
}
function XN(t, e) {
  const n = t.content.findDiffStart(e.content);
  if (n == null) return null;
  const r = t.content.findDiffEnd(e.content);
  return r ? {
    from: n,
    to: Math.max(r.b, n)
  } : null;
}
var Sm = Qt(() => new it({
  key: ZN,
  appendTransaction: (t, e, n) => {
    if (e.doc === n.doc) return;
    const r = XN(e.doc, n.doc);
    if (!r) return;
    let i;
    const s = (o, l) => {
      if (o.type.name !== "table_cell") return;
      const a = n.doc.resolve(l), u = a.node(a.depth), c = a.node(a.depth - 1).firstChild;
      if (!c) return;
      const h = YN(o, u), d = c.maybeChild(h);
      if (!d) return;
      const f = d.attrs.alignment;
      f !== o.attrs.alignment && (i || (i = n.tr), i.setNodeMarkup(l, void 0, {
        ...o.attrs,
        alignment: f
      }));
    };
    return n.doc.nodesBetween(r.from, r.to, (o, l) => o.type.name !== "table" ? !0 : (n.doc.nodesBetween(l, l + o.nodeSize, s), !1)), i;
  }
}));
ae(Sm, {
  displayName: "Prose<keepTableAlignPlugin>",
  group: "Prose"
});
var QN = [
  Sm,
  xm,
  Rs,
  Cm
].flat(), eI = [
  cu,
  Yt,
  yi,
  wr,
  cr,
  ki,
  au,
  uu,
  tu,
  mi
].flat(), tI = [
  su,
  iu,
  ou,
  om,
  lm,
  am,
  um,
  cm,
  hm,
  fm,
  mm,
  gm,
  dm,
  pm,
  ym,
  nu
], nI = [
  eI,
  qN,
  JN,
  KN,
  UN,
  tI,
  QN
].flat(), rI = typeof global == "object" && global && global.Object === Object && global, iI = typeof self == "object" && self && self.Object === Object && self, vm = rI || iI || Function("return this")(), ps = vm.Symbol, Nm = Object.prototype, sI = Nm.hasOwnProperty, oI = Nm.toString, Nr = ps ? ps.toStringTag : void 0;
function lI(t) {
  var e = sI.call(t, Nr), n = t[Nr];
  try {
    t[Nr] = void 0;
    var r = !0;
  } catch {
  }
  var i = oI.call(t);
  return r && (e ? t[Nr] = n : delete t[Nr]), i;
}
var aI = Object.prototype, uI = aI.toString;
function cI(t) {
  return uI.call(t);
}
var hI = "[object Null]", fI = "[object Undefined]", mh = ps ? ps.toStringTag : void 0;
function dI(t) {
  return t == null ? t === void 0 ? fI : hI : mh && mh in Object(t) ? lI(t) : cI(t);
}
function pI(t) {
  return t != null && typeof t == "object";
}
var mI = "[object Symbol]";
function gI(t) {
  return typeof t == "symbol" || pI(t) && dI(t) == mI;
}
var yI = /\s/;
function kI(t) {
  for (var e = t.length; e-- && yI.test(t.charAt(e)); )
    ;
  return e;
}
var wI = /^\s+/;
function bI(t) {
  return t && t.slice(0, kI(t) + 1).replace(wI, "");
}
function Cl(t) {
  var e = typeof t;
  return t != null && (e == "object" || e == "function");
}
var gh = NaN, xI = /^[-+]0x[0-9a-f]+$/i, CI = /^0b[01]+$/i, SI = /^0o[0-7]+$/i, vI = parseInt;
function yh(t) {
  if (typeof t == "number")
    return t;
  if (gI(t))
    return gh;
  if (Cl(t)) {
    var e = typeof t.valueOf == "function" ? t.valueOf() : t;
    t = Cl(e) ? e + "" : e;
  }
  if (typeof t != "string")
    return t === 0 ? t : +t;
  t = bI(t);
  var n = CI.test(t);
  return n || SI.test(t) ? vI(t.slice(2), n ? 2 : 8) : xI.test(t) ? gh : +t;
}
var Io = function() {
  return vm.Date.now();
}, NI = "Expected a function", II = Math.max, _I = Math.min;
function TI(t, e, n) {
  var r, i, s, o, l, a, u = 0, c = !1, h = !1, d = !0;
  if (typeof t != "function")
    throw new TypeError(NI);
  e = yh(e) || 0, Cl(n) && (c = !!n.leading, h = "maxWait" in n, s = h ? II(yh(n.maxWait) || 0, e) : s, d = "trailing" in n ? !!n.trailing : d);
  function f(v) {
    var M = r, R = i;
    return r = i = void 0, u = v, o = t.apply(R, M), o;
  }
  function p(v) {
    return u = v, l = setTimeout(g, e), c ? f(v) : o;
  }
  function m(v) {
    var M = v - a, R = v - u, O = e - M;
    return h ? _I(O, s - R) : O;
  }
  function y(v) {
    var M = v - a, R = v - u;
    return a === void 0 || M >= e || M < 0 || h && R >= s;
  }
  function g() {
    var v = Io();
    if (y(v))
      return b(v);
    l = setTimeout(g, m(v));
  }
  function b(v) {
    return l = void 0, d && r ? f(v) : (r = i = void 0, o);
  }
  function x() {
    l !== void 0 && clearTimeout(l), u = 0, r = a = i = l = void 0;
  }
  function A() {
    return l === void 0 ? o : b(Io());
  }
  function E() {
    var v = Io(), M = y(v);
    if (r = arguments, i = this, a = v, M) {
      if (l === void 0)
        return p(a);
      if (h)
        return clearTimeout(l), l = setTimeout(g, e), f(a);
    }
    return l === void 0 && (l = setTimeout(g, e)), o;
  }
  return E.cancel = x, E.flush = A, E;
}
var Im = class {
  constructor() {
    this.beforeMountedListeners = [], this.mountedListeners = [], this.updatedListeners = [], this.selectionUpdatedListeners = [], this.markdownUpdatedListeners = [], this.blurListeners = [], this.focusListeners = [], this.destroyListeners = [], this.beforeMount = (t) => (this.beforeMountedListeners.push(t), this), this.mounted = (t) => (this.mountedListeners.push(t), this), this.updated = (t) => (this.updatedListeners.push(t), this);
  }
  get listeners() {
    return {
      beforeMount: this.beforeMountedListeners,
      mounted: this.mountedListeners,
      updated: this.updatedListeners,
      markdownUpdated: this.markdownUpdatedListeners,
      blur: this.blurListeners,
      focus: this.focusListeners,
      destroy: this.destroyListeners,
      selectionUpdated: this.selectionUpdatedListeners
    };
  }
  markdownUpdated(t) {
    return this.markdownUpdatedListeners.push(t), this;
  }
  blur(t) {
    return this.blurListeners.push(t), this;
  }
  focus(t) {
    return this.focusListeners.push(t), this;
  }
  destroy(t) {
    return this.destroyListeners.push(t), this;
  }
  selectionUpdated(t) {
    return this.selectionUpdatedListeners.push(t), this;
  }
}, Sl = ke(new Im(), "listener"), AI = new st("MILKDOWN_LISTENER"), _m = (t) => (t.inject(Sl, new Im()), async () => {
  await t.wait(Bn);
  const { listeners: e } = t.get(Sl);
  e.beforeMount.forEach((u) => u(t)), await t.wait(Wr);
  const n = t.get(Fi);
  let r = null, i = null, s = null, o = null;
  const l = TI(() => {
    if (!o) return;
    const { doc: u } = o;
    if (e.updated.length > 0 && r && !r.eq(u) && e.updated.forEach((c) => {
      c(t, u, r);
    }), e.markdownUpdated.length > 0 && r && !r.eq(u)) {
      const c = n(u);
      e.markdownUpdated.forEach((h) => {
        h(t, c, i);
      }), i = c;
    }
    r = u, o = null;
  }, 200), a = new it({
    key: AI,
    view: () => ({ destroy: () => {
      l.cancel(), e.destroy.forEach((u) => u(t));
    } }),
    props: { handleDOMEvents: {
      focus: () => (e.focus.forEach((u) => u(t)), !1),
      blur: () => (e.blur.forEach((u) => u(t)), !1)
    } },
    state: {
      init: (u, c) => {
        r = c.doc, i = n(c.doc);
      },
      apply: (u) => {
        const c = u.selection;
        (!s && c || s && !c.eq(s)) && (e.selectionUpdated.forEach((h) => {
          h(t, c, s);
        }), s = c), !(!(u.docChanged || u.storedMarksSet) || u.getMeta("addToHistory") === !1) && (o = u, l());
      }
    }
  });
  t.update(xn, (u) => u.concat(a)), await t.wait(Wi), e.mounted.forEach((u) => u(t));
});
_m.meta = {
  package: "@milkdown/plugin-listener",
  displayName: "Listener"
};
const EI = /* @__PURE__ */ new Set(["paragraph", "heading", "tableCell"]);
function Tm(t) {
  t.type === "image" && ((t.alt === null || t.alt === void 0) && (t.alt = ""), (t.title === null || t.title === void 0) && (t.title = ""));
  const e = t.children;
  if (e !== void 0)
    for (let n = 0; n < e.length; n += 1) {
      const r = e[n];
      r !== void 0 && (r.type === "html" && !EI.has(t.type) && (e[n] = { type: "paragraph", children: [r] }), Tm(r));
    }
}
const kh = Nn("chipsWordParseNormalize", () => () => (t) => {
  Tm(t);
}), MI = [kh.options, kh.plugin];
function OI(t) {
  return t.replace(/\r\n?/g, `
`).replace(/\u00a0/g, " ").replace(/[\t ]+$/gm, "").replace(/^\n+/, "").replace(/\n{3,}/g, `

`).trimEnd();
}
async function DI(t) {
  const e = await aC.make().config((n) => {
    n.set(Ui, t.host), n.set($i, t.defaultValue), n.set(Rs.options.key, { singleTilde: !1 }), n.update(Hi, (r) => ({
      ...r,
      attributes: {
        ...typeof r.attributes == "object" && r.attributes !== null ? r.attributes : {},
        spellcheck: "true",
        autocapitalize: "off",
        autocorrect: "off",
        translate: "no"
      }
    }));
  }).use(XC).use(nI).use(MI).use(_m).create();
  return e.action((n) => {
    n.get(Sl).markdownUpdated((r, i) => {
      t.onMarkdownChange(OI(i));
    });
  }), e;
}
function RI(t) {
  t.action((e) => {
    e.get(yn).focus();
  });
}
function Mi(t) {
  throw new Error('Could not dynamically require "' + t + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}
var _o = { exports: {} };
var wh;
function zI() {
  return wh || (wh = 1, (function(t, e) {
    (function(n) {
      t.exports = n();
    })(function() {
      return (function n(r, i, s) {
        function o(u, c) {
          if (!i[u]) {
            if (!r[u]) {
              var h = typeof Mi == "function" && Mi;
              if (!c && h) return h(u, !0);
              if (l) return l(u, !0);
              var d = new Error("Cannot find module '" + u + "'");
              throw d.code = "MODULE_NOT_FOUND", d;
            }
            var f = i[u] = { exports: {} };
            r[u][0].call(f.exports, function(p) {
              var m = r[u][1][p];
              return o(m || p);
            }, f, f.exports, n, r, i, s);
          }
          return i[u].exports;
        }
        for (var l = typeof Mi == "function" && Mi, a = 0; a < s.length; a++) o(s[a]);
        return o;
      })({ 1: [function(n, r, i) {
        var s = n("./utils"), o = n("./support"), l = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        i.encode = function(a) {
          for (var u, c, h, d, f, p, m, y = [], g = 0, b = a.length, x = b, A = s.getTypeOf(a) !== "string"; g < a.length; ) x = b - g, h = A ? (u = a[g++], c = g < b ? a[g++] : 0, g < b ? a[g++] : 0) : (u = a.charCodeAt(g++), c = g < b ? a.charCodeAt(g++) : 0, g < b ? a.charCodeAt(g++) : 0), d = u >> 2, f = (3 & u) << 4 | c >> 4, p = 1 < x ? (15 & c) << 2 | h >> 6 : 64, m = 2 < x ? 63 & h : 64, y.push(l.charAt(d) + l.charAt(f) + l.charAt(p) + l.charAt(m));
          return y.join("");
        }, i.decode = function(a) {
          var u, c, h, d, f, p, m = 0, y = 0, g = "data:";
          if (a.substr(0, g.length) === g) throw new Error("Invalid base64 input, it looks like a data url.");
          var b, x = 3 * (a = a.replace(/[^A-Za-z0-9+/=]/g, "")).length / 4;
          if (a.charAt(a.length - 1) === l.charAt(64) && x--, a.charAt(a.length - 2) === l.charAt(64) && x--, x % 1 != 0) throw new Error("Invalid base64 input, bad content length.");
          for (b = o.uint8array ? new Uint8Array(0 | x) : new Array(0 | x); m < a.length; ) u = l.indexOf(a.charAt(m++)) << 2 | (d = l.indexOf(a.charAt(m++))) >> 4, c = (15 & d) << 4 | (f = l.indexOf(a.charAt(m++))) >> 2, h = (3 & f) << 6 | (p = l.indexOf(a.charAt(m++))), b[y++] = u, f !== 64 && (b[y++] = c), p !== 64 && (b[y++] = h);
          return b;
        };
      }, { "./support": 30, "./utils": 32 }], 2: [function(n, r, i) {
        var s = n("./external"), o = n("./stream/DataWorker"), l = n("./stream/Crc32Probe"), a = n("./stream/DataLengthProbe");
        function u(c, h, d, f, p) {
          this.compressedSize = c, this.uncompressedSize = h, this.crc32 = d, this.compression = f, this.compressedContent = p;
        }
        u.prototype = { getContentWorker: function() {
          var c = new o(s.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new a("data_length")), h = this;
          return c.on("end", function() {
            if (this.streamInfo.data_length !== h.uncompressedSize) throw new Error("Bug : uncompressed data size mismatch");
          }), c;
        }, getCompressedWorker: function() {
          return new o(s.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
        } }, u.createWorkerFrom = function(c, h, d) {
          return c.pipe(new l()).pipe(new a("uncompressedSize")).pipe(h.compressWorker(d)).pipe(new a("compressedSize")).withStreamInfo("compression", h);
        }, r.exports = u;
      }, { "./external": 6, "./stream/Crc32Probe": 25, "./stream/DataLengthProbe": 26, "./stream/DataWorker": 27 }], 3: [function(n, r, i) {
        var s = n("./stream/GenericWorker");
        i.STORE = { magic: "\0\0", compressWorker: function() {
          return new s("STORE compression");
        }, uncompressWorker: function() {
          return new s("STORE decompression");
        } }, i.DEFLATE = n("./flate");
      }, { "./flate": 7, "./stream/GenericWorker": 28 }], 4: [function(n, r, i) {
        var s = n("./utils"), o = (function() {
          for (var l, a = [], u = 0; u < 256; u++) {
            l = u;
            for (var c = 0; c < 8; c++) l = 1 & l ? 3988292384 ^ l >>> 1 : l >>> 1;
            a[u] = l;
          }
          return a;
        })();
        r.exports = function(l, a) {
          return l !== void 0 && l.length ? s.getTypeOf(l) !== "string" ? (function(u, c, h, d) {
            var f = o, p = d + h;
            u ^= -1;
            for (var m = d; m < p; m++) u = u >>> 8 ^ f[255 & (u ^ c[m])];
            return -1 ^ u;
          })(0 | a, l, l.length, 0) : (function(u, c, h, d) {
            var f = o, p = d + h;
            u ^= -1;
            for (var m = d; m < p; m++) u = u >>> 8 ^ f[255 & (u ^ c.charCodeAt(m))];
            return -1 ^ u;
          })(0 | a, l, l.length, 0) : 0;
        };
      }, { "./utils": 32 }], 5: [function(n, r, i) {
        i.base64 = !1, i.binary = !1, i.dir = !1, i.createFolders = !0, i.date = null, i.compression = null, i.compressionOptions = null, i.comment = null, i.unixPermissions = null, i.dosPermissions = null;
      }, {}], 6: [function(n, r, i) {
        var s = null;
        s = typeof Promise < "u" ? Promise : n("lie"), r.exports = { Promise: s };
      }, { lie: 37 }], 7: [function(n, r, i) {
        var s = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Uint32Array < "u", o = n("pako"), l = n("./utils"), a = n("./stream/GenericWorker"), u = s ? "uint8array" : "array";
        function c(h, d) {
          a.call(this, "FlateWorker/" + h), this._pako = null, this._pakoAction = h, this._pakoOptions = d, this.meta = {};
        }
        i.magic = "\b\0", l.inherits(c, a), c.prototype.processChunk = function(h) {
          this.meta = h.meta, this._pako === null && this._createPako(), this._pako.push(l.transformTo(u, h.data), !1);
        }, c.prototype.flush = function() {
          a.prototype.flush.call(this), this._pako === null && this._createPako(), this._pako.push([], !0);
        }, c.prototype.cleanUp = function() {
          a.prototype.cleanUp.call(this), this._pako = null;
        }, c.prototype._createPako = function() {
          this._pako = new o[this._pakoAction]({ raw: !0, level: this._pakoOptions.level || -1 });
          var h = this;
          this._pako.onData = function(d) {
            h.push({ data: d, meta: h.meta });
          };
        }, i.compressWorker = function(h) {
          return new c("Deflate", h);
        }, i.uncompressWorker = function() {
          return new c("Inflate", {});
        };
      }, { "./stream/GenericWorker": 28, "./utils": 32, pako: 38 }], 8: [function(n, r, i) {
        function s(f, p) {
          var m, y = "";
          for (m = 0; m < p; m++) y += String.fromCharCode(255 & f), f >>>= 8;
          return y;
        }
        function o(f, p, m, y, g, b) {
          var x, A, E = f.file, v = f.compression, M = b !== u.utf8encode, R = l.transformTo("string", b(E.name)), O = l.transformTo("string", u.utf8encode(E.name)), T = E.comment, V = l.transformTo("string", b(T)), S = l.transformTo("string", u.utf8encode(T)), F = O.length !== E.name.length, w = S.length !== T.length, $ = "", ie = "", U = "", le = E.dir, Z = E.date, I = { crc32: 0, compressedSize: 0, uncompressedSize: 0 };
          p && !m || (I.crc32 = f.crc32, I.compressedSize = f.compressedSize, I.uncompressedSize = f.uncompressedSize);
          var B = 0;
          p && (B |= 8), M || !F && !w || (B |= 2048);
          var P = 0, N = 0;
          le && (P |= 16), g === "UNIX" ? (N = 798, P |= (function(X, me) {
            var Oe = X;
            return X || (Oe = me ? 16893 : 33204), (65535 & Oe) << 16;
          })(E.unixPermissions, le)) : (N = 20, P |= (function(X) {
            return 63 & (X || 0);
          })(E.dosPermissions)), x = Z.getUTCHours(), x <<= 6, x |= Z.getUTCMinutes(), x <<= 5, x |= Z.getUTCSeconds() / 2, A = Z.getUTCFullYear() - 1980, A <<= 4, A |= Z.getUTCMonth() + 1, A <<= 5, A |= Z.getUTCDate(), F && (ie = s(1, 1) + s(c(R), 4) + O, $ += "up" + s(ie.length, 2) + ie), w && (U = s(1, 1) + s(c(V), 4) + S, $ += "uc" + s(U.length, 2) + U);
          var ee = "";
          return ee += `
\0`, ee += s(B, 2), ee += v.magic, ee += s(x, 2), ee += s(A, 2), ee += s(I.crc32, 4), ee += s(I.compressedSize, 4), ee += s(I.uncompressedSize, 4), ee += s(R.length, 2), ee += s($.length, 2), { fileRecord: h.LOCAL_FILE_HEADER + ee + R + $, dirRecord: h.CENTRAL_FILE_HEADER + s(N, 2) + ee + s(V.length, 2) + "\0\0\0\0" + s(P, 4) + s(y, 4) + R + $ + V };
        }
        var l = n("../utils"), a = n("../stream/GenericWorker"), u = n("../utf8"), c = n("../crc32"), h = n("../signature");
        function d(f, p, m, y) {
          a.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = p, this.zipPlatform = m, this.encodeFileName = y, this.streamFiles = f, this.accumulate = !1, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
        }
        l.inherits(d, a), d.prototype.push = function(f) {
          var p = f.meta.percent || 0, m = this.entriesCount, y = this._sources.length;
          this.accumulate ? this.contentBuffer.push(f) : (this.bytesWritten += f.data.length, a.prototype.push.call(this, { data: f.data, meta: { currentFile: this.currentFile, percent: m ? (p + 100 * (m - y - 1)) / m : 100 } }));
        }, d.prototype.openedSource = function(f) {
          this.currentSourceOffset = this.bytesWritten, this.currentFile = f.file.name;
          var p = this.streamFiles && !f.file.dir;
          if (p) {
            var m = o(f, p, !1, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
            this.push({ data: m.fileRecord, meta: { percent: 0 } });
          } else this.accumulate = !0;
        }, d.prototype.closedSource = function(f) {
          this.accumulate = !1;
          var p = this.streamFiles && !f.file.dir, m = o(f, p, !0, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
          if (this.dirRecords.push(m.dirRecord), p) this.push({ data: (function(y) {
            return h.DATA_DESCRIPTOR + s(y.crc32, 4) + s(y.compressedSize, 4) + s(y.uncompressedSize, 4);
          })(f), meta: { percent: 100 } });
          else for (this.push({ data: m.fileRecord, meta: { percent: 0 } }); this.contentBuffer.length; ) this.push(this.contentBuffer.shift());
          this.currentFile = null;
        }, d.prototype.flush = function() {
          for (var f = this.bytesWritten, p = 0; p < this.dirRecords.length; p++) this.push({ data: this.dirRecords[p], meta: { percent: 100 } });
          var m = this.bytesWritten - f, y = (function(g, b, x, A, E) {
            var v = l.transformTo("string", E(A));
            return h.CENTRAL_DIRECTORY_END + "\0\0\0\0" + s(g, 2) + s(g, 2) + s(b, 4) + s(x, 4) + s(v.length, 2) + v;
          })(this.dirRecords.length, m, f, this.zipComment, this.encodeFileName);
          this.push({ data: y, meta: { percent: 100 } });
        }, d.prototype.prepareNextSource = function() {
          this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
        }, d.prototype.registerPrevious = function(f) {
          this._sources.push(f);
          var p = this;
          return f.on("data", function(m) {
            p.processChunk(m);
          }), f.on("end", function() {
            p.closedSource(p.previous.streamInfo), p._sources.length ? p.prepareNextSource() : p.end();
          }), f.on("error", function(m) {
            p.error(m);
          }), this;
        }, d.prototype.resume = function() {
          return !!a.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(), !0) : this.previous || this._sources.length || this.generatedError ? void 0 : (this.end(), !0));
        }, d.prototype.error = function(f) {
          var p = this._sources;
          if (!a.prototype.error.call(this, f)) return !1;
          for (var m = 0; m < p.length; m++) try {
            p[m].error(f);
          } catch {
          }
          return !0;
        }, d.prototype.lock = function() {
          a.prototype.lock.call(this);
          for (var f = this._sources, p = 0; p < f.length; p++) f[p].lock();
        }, r.exports = d;
      }, { "../crc32": 4, "../signature": 23, "../stream/GenericWorker": 28, "../utf8": 31, "../utils": 32 }], 9: [function(n, r, i) {
        var s = n("../compressions"), o = n("./ZipFileWorker");
        i.generateWorker = function(l, a, u) {
          var c = new o(a.streamFiles, u, a.platform, a.encodeFileName), h = 0;
          try {
            l.forEach(function(d, f) {
              h++;
              var p = (function(b, x) {
                var A = b || x, E = s[A];
                if (!E) throw new Error(A + " is not a valid compression method !");
                return E;
              })(f.options.compression, a.compression), m = f.options.compressionOptions || a.compressionOptions || {}, y = f.dir, g = f.date;
              f._compressWorker(p, m).withStreamInfo("file", { name: d, dir: y, date: g, comment: f.comment || "", unixPermissions: f.unixPermissions, dosPermissions: f.dosPermissions }).pipe(c);
            }), c.entriesCount = h;
          } catch (d) {
            c.error(d);
          }
          return c;
        };
      }, { "../compressions": 3, "./ZipFileWorker": 8 }], 10: [function(n, r, i) {
        function s() {
          if (!(this instanceof s)) return new s();
          if (arguments.length) throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
          this.files = /* @__PURE__ */ Object.create(null), this.comment = null, this.root = "", this.clone = function() {
            var o = new s();
            for (var l in this) typeof this[l] != "function" && (o[l] = this[l]);
            return o;
          };
        }
        (s.prototype = n("./object")).loadAsync = n("./load"), s.support = n("./support"), s.defaults = n("./defaults"), s.version = "3.10.1", s.loadAsync = function(o, l) {
          return new s().loadAsync(o, l);
        }, s.external = n("./external"), r.exports = s;
      }, { "./defaults": 5, "./external": 6, "./load": 11, "./object": 15, "./support": 30 }], 11: [function(n, r, i) {
        var s = n("./utils"), o = n("./external"), l = n("./utf8"), a = n("./zipEntries"), u = n("./stream/Crc32Probe"), c = n("./nodejsUtils");
        function h(d) {
          return new o.Promise(function(f, p) {
            var m = d.decompressed.getContentWorker().pipe(new u());
            m.on("error", function(y) {
              p(y);
            }).on("end", function() {
              m.streamInfo.crc32 !== d.decompressed.crc32 ? p(new Error("Corrupted zip : CRC32 mismatch")) : f();
            }).resume();
          });
        }
        r.exports = function(d, f) {
          var p = this;
          return f = s.extend(f || {}, { base64: !1, checkCRC32: !1, optimizedBinaryString: !1, createFolders: !1, decodeFileName: l.utf8decode }), c.isNode && c.isStream(d) ? o.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : s.prepareContent("the loaded zip file", d, !0, f.optimizedBinaryString, f.base64).then(function(m) {
            var y = new a(f);
            return y.load(m), y;
          }).then(function(m) {
            var y = [o.Promise.resolve(m)], g = m.files;
            if (f.checkCRC32) for (var b = 0; b < g.length; b++) y.push(h(g[b]));
            return o.Promise.all(y);
          }).then(function(m) {
            for (var y = m.shift(), g = y.files, b = 0; b < g.length; b++) {
              var x = g[b], A = x.fileNameStr, E = s.resolve(x.fileNameStr);
              p.file(E, x.decompressed, { binary: !0, optimizedBinaryString: !0, date: x.date, dir: x.dir, comment: x.fileCommentStr.length ? x.fileCommentStr : null, unixPermissions: x.unixPermissions, dosPermissions: x.dosPermissions, createFolders: f.createFolders }), x.dir || (p.file(E).unsafeOriginalName = A);
            }
            return y.zipComment.length && (p.comment = y.zipComment), p;
          });
        };
      }, { "./external": 6, "./nodejsUtils": 14, "./stream/Crc32Probe": 25, "./utf8": 31, "./utils": 32, "./zipEntries": 33 }], 12: [function(n, r, i) {
        var s = n("../utils"), o = n("../stream/GenericWorker");
        function l(a, u) {
          o.call(this, "Nodejs stream input adapter for " + a), this._upstreamEnded = !1, this._bindStream(u);
        }
        s.inherits(l, o), l.prototype._bindStream = function(a) {
          var u = this;
          (this._stream = a).pause(), a.on("data", function(c) {
            u.push({ data: c, meta: { percent: 0 } });
          }).on("error", function(c) {
            u.isPaused ? this.generatedError = c : u.error(c);
          }).on("end", function() {
            u.isPaused ? u._upstreamEnded = !0 : u.end();
          });
        }, l.prototype.pause = function() {
          return !!o.prototype.pause.call(this) && (this._stream.pause(), !0);
        }, l.prototype.resume = function() {
          return !!o.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(), !0);
        }, r.exports = l;
      }, { "../stream/GenericWorker": 28, "../utils": 32 }], 13: [function(n, r, i) {
        var s = n("readable-stream").Readable;
        function o(l, a, u) {
          s.call(this, a), this._helper = l;
          var c = this;
          l.on("data", function(h, d) {
            c.push(h) || c._helper.pause(), u && u(d);
          }).on("error", function(h) {
            c.emit("error", h);
          }).on("end", function() {
            c.push(null);
          });
        }
        n("../utils").inherits(o, s), o.prototype._read = function() {
          this._helper.resume();
        }, r.exports = o;
      }, { "../utils": 32, "readable-stream": 16 }], 14: [function(n, r, i) {
        r.exports = { isNode: typeof Buffer < "u", newBufferFrom: function(s, o) {
          if (Buffer.from && Buffer.from !== Uint8Array.from) return Buffer.from(s, o);
          if (typeof s == "number") throw new Error('The "data" argument must not be a number');
          return new Buffer(s, o);
        }, allocBuffer: function(s) {
          if (Buffer.alloc) return Buffer.alloc(s);
          var o = new Buffer(s);
          return o.fill(0), o;
        }, isBuffer: function(s) {
          return Buffer.isBuffer(s);
        }, isStream: function(s) {
          return s && typeof s.on == "function" && typeof s.pause == "function" && typeof s.resume == "function";
        } };
      }, {}], 15: [function(n, r, i) {
        function s(E, v, M) {
          var R, O = l.getTypeOf(v), T = l.extend(M || {}, c);
          T.date = T.date || /* @__PURE__ */ new Date(), T.compression !== null && (T.compression = T.compression.toUpperCase()), typeof T.unixPermissions == "string" && (T.unixPermissions = parseInt(T.unixPermissions, 8)), T.unixPermissions && 16384 & T.unixPermissions && (T.dir = !0), T.dosPermissions && 16 & T.dosPermissions && (T.dir = !0), T.dir && (E = g(E)), T.createFolders && (R = y(E)) && b.call(this, R, !0);
          var V = O === "string" && T.binary === !1 && T.base64 === !1;
          M && M.binary !== void 0 || (T.binary = !V), (v instanceof h && v.uncompressedSize === 0 || T.dir || !v || v.length === 0) && (T.base64 = !1, T.binary = !0, v = "", T.compression = "STORE", O = "string");
          var S = null;
          S = v instanceof h || v instanceof a ? v : p.isNode && p.isStream(v) ? new m(E, v) : l.prepareContent(E, v, T.binary, T.optimizedBinaryString, T.base64);
          var F = new d(E, S, T);
          this.files[E] = F;
        }
        var o = n("./utf8"), l = n("./utils"), a = n("./stream/GenericWorker"), u = n("./stream/StreamHelper"), c = n("./defaults"), h = n("./compressedObject"), d = n("./zipObject"), f = n("./generate"), p = n("./nodejsUtils"), m = n("./nodejs/NodejsStreamInputAdapter"), y = function(E) {
          E.slice(-1) === "/" && (E = E.substring(0, E.length - 1));
          var v = E.lastIndexOf("/");
          return 0 < v ? E.substring(0, v) : "";
        }, g = function(E) {
          return E.slice(-1) !== "/" && (E += "/"), E;
        }, b = function(E, v) {
          return v = v !== void 0 ? v : c.createFolders, E = g(E), this.files[E] || s.call(this, E, null, { dir: !0, createFolders: v }), this.files[E];
        };
        function x(E) {
          return Object.prototype.toString.call(E) === "[object RegExp]";
        }
        var A = { load: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, forEach: function(E) {
          var v, M, R;
          for (v in this.files) R = this.files[v], (M = v.slice(this.root.length, v.length)) && v.slice(0, this.root.length) === this.root && E(M, R);
        }, filter: function(E) {
          var v = [];
          return this.forEach(function(M, R) {
            E(M, R) && v.push(R);
          }), v;
        }, file: function(E, v, M) {
          if (arguments.length !== 1) return E = this.root + E, s.call(this, E, v, M), this;
          if (x(E)) {
            var R = E;
            return this.filter(function(T, V) {
              return !V.dir && R.test(T);
            });
          }
          var O = this.files[this.root + E];
          return O && !O.dir ? O : null;
        }, folder: function(E) {
          if (!E) return this;
          if (x(E)) return this.filter(function(O, T) {
            return T.dir && E.test(O);
          });
          var v = this.root + E, M = b.call(this, v), R = this.clone();
          return R.root = M.name, R;
        }, remove: function(E) {
          E = this.root + E;
          var v = this.files[E];
          if (v || (E.slice(-1) !== "/" && (E += "/"), v = this.files[E]), v && !v.dir) delete this.files[E];
          else for (var M = this.filter(function(O, T) {
            return T.name.slice(0, E.length) === E;
          }), R = 0; R < M.length; R++) delete this.files[M[R].name];
          return this;
        }, generate: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, generateInternalStream: function(E) {
          var v, M = {};
          try {
            if ((M = l.extend(E || {}, { streamFiles: !1, compression: "STORE", compressionOptions: null, type: "", platform: "DOS", comment: null, mimeType: "application/zip", encodeFileName: o.utf8encode })).type = M.type.toLowerCase(), M.compression = M.compression.toUpperCase(), M.type === "binarystring" && (M.type = "string"), !M.type) throw new Error("No output type specified.");
            l.checkSupport(M.type), M.platform !== "darwin" && M.platform !== "freebsd" && M.platform !== "linux" && M.platform !== "sunos" || (M.platform = "UNIX"), M.platform === "win32" && (M.platform = "DOS");
            var R = M.comment || this.comment || "";
            v = f.generateWorker(this, M, R);
          } catch (O) {
            (v = new a("error")).error(O);
          }
          return new u(v, M.type || "string", M.mimeType);
        }, generateAsync: function(E, v) {
          return this.generateInternalStream(E).accumulate(v);
        }, generateNodeStream: function(E, v) {
          return (E = E || {}).type || (E.type = "nodebuffer"), this.generateInternalStream(E).toNodejsStream(v);
        } };
        r.exports = A;
      }, { "./compressedObject": 2, "./defaults": 5, "./generate": 9, "./nodejs/NodejsStreamInputAdapter": 12, "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31, "./utils": 32, "./zipObject": 35 }], 16: [function(n, r, i) {
        r.exports = n("stream");
      }, { stream: void 0 }], 17: [function(n, r, i) {
        var s = n("./DataReader");
        function o(l) {
          s.call(this, l);
          for (var a = 0; a < this.data.length; a++) l[a] = 255 & l[a];
        }
        n("../utils").inherits(o, s), o.prototype.byteAt = function(l) {
          return this.data[this.zero + l];
        }, o.prototype.lastIndexOfSignature = function(l) {
          for (var a = l.charCodeAt(0), u = l.charCodeAt(1), c = l.charCodeAt(2), h = l.charCodeAt(3), d = this.length - 4; 0 <= d; --d) if (this.data[d] === a && this.data[d + 1] === u && this.data[d + 2] === c && this.data[d + 3] === h) return d - this.zero;
          return -1;
        }, o.prototype.readAndCheckSignature = function(l) {
          var a = l.charCodeAt(0), u = l.charCodeAt(1), c = l.charCodeAt(2), h = l.charCodeAt(3), d = this.readData(4);
          return a === d[0] && u === d[1] && c === d[2] && h === d[3];
        }, o.prototype.readData = function(l) {
          if (this.checkOffset(l), l === 0) return [];
          var a = this.data.slice(this.zero + this.index, this.zero + this.index + l);
          return this.index += l, a;
        }, r.exports = o;
      }, { "../utils": 32, "./DataReader": 18 }], 18: [function(n, r, i) {
        var s = n("../utils");
        function o(l) {
          this.data = l, this.length = l.length, this.index = 0, this.zero = 0;
        }
        o.prototype = { checkOffset: function(l) {
          this.checkIndex(this.index + l);
        }, checkIndex: function(l) {
          if (this.length < this.zero + l || l < 0) throw new Error("End of data reached (data length = " + this.length + ", asked index = " + l + "). Corrupted zip ?");
        }, setIndex: function(l) {
          this.checkIndex(l), this.index = l;
        }, skip: function(l) {
          this.setIndex(this.index + l);
        }, byteAt: function() {
        }, readInt: function(l) {
          var a, u = 0;
          for (this.checkOffset(l), a = this.index + l - 1; a >= this.index; a--) u = (u << 8) + this.byteAt(a);
          return this.index += l, u;
        }, readString: function(l) {
          return s.transformTo("string", this.readData(l));
        }, readData: function() {
        }, lastIndexOfSignature: function() {
        }, readAndCheckSignature: function() {
        }, readDate: function() {
          var l = this.readInt(4);
          return new Date(Date.UTC(1980 + (l >> 25 & 127), (l >> 21 & 15) - 1, l >> 16 & 31, l >> 11 & 31, l >> 5 & 63, (31 & l) << 1));
        } }, r.exports = o;
      }, { "../utils": 32 }], 19: [function(n, r, i) {
        var s = n("./Uint8ArrayReader");
        function o(l) {
          s.call(this, l);
        }
        n("../utils").inherits(o, s), o.prototype.readData = function(l) {
          this.checkOffset(l);
          var a = this.data.slice(this.zero + this.index, this.zero + this.index + l);
          return this.index += l, a;
        }, r.exports = o;
      }, { "../utils": 32, "./Uint8ArrayReader": 21 }], 20: [function(n, r, i) {
        var s = n("./DataReader");
        function o(l) {
          s.call(this, l);
        }
        n("../utils").inherits(o, s), o.prototype.byteAt = function(l) {
          return this.data.charCodeAt(this.zero + l);
        }, o.prototype.lastIndexOfSignature = function(l) {
          return this.data.lastIndexOf(l) - this.zero;
        }, o.prototype.readAndCheckSignature = function(l) {
          return l === this.readData(4);
        }, o.prototype.readData = function(l) {
          this.checkOffset(l);
          var a = this.data.slice(this.zero + this.index, this.zero + this.index + l);
          return this.index += l, a;
        }, r.exports = o;
      }, { "../utils": 32, "./DataReader": 18 }], 21: [function(n, r, i) {
        var s = n("./ArrayReader");
        function o(l) {
          s.call(this, l);
        }
        n("../utils").inherits(o, s), o.prototype.readData = function(l) {
          if (this.checkOffset(l), l === 0) return new Uint8Array(0);
          var a = this.data.subarray(this.zero + this.index, this.zero + this.index + l);
          return this.index += l, a;
        }, r.exports = o;
      }, { "../utils": 32, "./ArrayReader": 17 }], 22: [function(n, r, i) {
        var s = n("../utils"), o = n("../support"), l = n("./ArrayReader"), a = n("./StringReader"), u = n("./NodeBufferReader"), c = n("./Uint8ArrayReader");
        r.exports = function(h) {
          var d = s.getTypeOf(h);
          return s.checkSupport(d), d !== "string" || o.uint8array ? d === "nodebuffer" ? new u(h) : o.uint8array ? new c(s.transformTo("uint8array", h)) : new l(s.transformTo("array", h)) : new a(h);
        };
      }, { "../support": 30, "../utils": 32, "./ArrayReader": 17, "./NodeBufferReader": 19, "./StringReader": 20, "./Uint8ArrayReader": 21 }], 23: [function(n, r, i) {
        i.LOCAL_FILE_HEADER = "PK", i.CENTRAL_FILE_HEADER = "PK", i.CENTRAL_DIRECTORY_END = "PK", i.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07", i.ZIP64_CENTRAL_DIRECTORY_END = "PK", i.DATA_DESCRIPTOR = "PK\x07\b";
      }, {}], 24: [function(n, r, i) {
        var s = n("./GenericWorker"), o = n("../utils");
        function l(a) {
          s.call(this, "ConvertWorker to " + a), this.destType = a;
        }
        o.inherits(l, s), l.prototype.processChunk = function(a) {
          this.push({ data: o.transformTo(this.destType, a.data), meta: a.meta });
        }, r.exports = l;
      }, { "../utils": 32, "./GenericWorker": 28 }], 25: [function(n, r, i) {
        var s = n("./GenericWorker"), o = n("../crc32");
        function l() {
          s.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
        }
        n("../utils").inherits(l, s), l.prototype.processChunk = function(a) {
          this.streamInfo.crc32 = o(a.data, this.streamInfo.crc32 || 0), this.push(a);
        }, r.exports = l;
      }, { "../crc32": 4, "../utils": 32, "./GenericWorker": 28 }], 26: [function(n, r, i) {
        var s = n("../utils"), o = n("./GenericWorker");
        function l(a) {
          o.call(this, "DataLengthProbe for " + a), this.propName = a, this.withStreamInfo(a, 0);
        }
        s.inherits(l, o), l.prototype.processChunk = function(a) {
          if (a) {
            var u = this.streamInfo[this.propName] || 0;
            this.streamInfo[this.propName] = u + a.data.length;
          }
          o.prototype.processChunk.call(this, a);
        }, r.exports = l;
      }, { "../utils": 32, "./GenericWorker": 28 }], 27: [function(n, r, i) {
        var s = n("../utils"), o = n("./GenericWorker");
        function l(a) {
          o.call(this, "DataWorker");
          var u = this;
          this.dataIsReady = !1, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = !1, a.then(function(c) {
            u.dataIsReady = !0, u.data = c, u.max = c && c.length || 0, u.type = s.getTypeOf(c), u.isPaused || u._tickAndRepeat();
          }, function(c) {
            u.error(c);
          });
        }
        s.inherits(l, o), l.prototype.cleanUp = function() {
          o.prototype.cleanUp.call(this), this.data = null;
        }, l.prototype.resume = function() {
          return !!o.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = !0, s.delay(this._tickAndRepeat, [], this)), !0);
        }, l.prototype._tickAndRepeat = function() {
          this._tickScheduled = !1, this.isPaused || this.isFinished || (this._tick(), this.isFinished || (s.delay(this._tickAndRepeat, [], this), this._tickScheduled = !0));
        }, l.prototype._tick = function() {
          if (this.isPaused || this.isFinished) return !1;
          var a = null, u = Math.min(this.max, this.index + 16384);
          if (this.index >= this.max) return this.end();
          switch (this.type) {
            case "string":
              a = this.data.substring(this.index, u);
              break;
            case "uint8array":
              a = this.data.subarray(this.index, u);
              break;
            case "array":
            case "nodebuffer":
              a = this.data.slice(this.index, u);
          }
          return this.index = u, this.push({ data: a, meta: { percent: this.max ? this.index / this.max * 100 : 0 } });
        }, r.exports = l;
      }, { "../utils": 32, "./GenericWorker": 28 }], 28: [function(n, r, i) {
        function s(o) {
          this.name = o || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = !0, this.isFinished = !1, this.isLocked = !1, this._listeners = { data: [], end: [], error: [] }, this.previous = null;
        }
        s.prototype = { push: function(o) {
          this.emit("data", o);
        }, end: function() {
          if (this.isFinished) return !1;
          this.flush();
          try {
            this.emit("end"), this.cleanUp(), this.isFinished = !0;
          } catch (o) {
            this.emit("error", o);
          }
          return !0;
        }, error: function(o) {
          return !this.isFinished && (this.isPaused ? this.generatedError = o : (this.isFinished = !0, this.emit("error", o), this.previous && this.previous.error(o), this.cleanUp()), !0);
        }, on: function(o, l) {
          return this._listeners[o].push(l), this;
        }, cleanUp: function() {
          this.streamInfo = this.generatedError = this.extraStreamInfo = null, this._listeners = [];
        }, emit: function(o, l) {
          if (this._listeners[o]) for (var a = 0; a < this._listeners[o].length; a++) this._listeners[o][a].call(this, l);
        }, pipe: function(o) {
          return o.registerPrevious(this);
        }, registerPrevious: function(o) {
          if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
          this.streamInfo = o.streamInfo, this.mergeStreamInfo(), this.previous = o;
          var l = this;
          return o.on("data", function(a) {
            l.processChunk(a);
          }), o.on("end", function() {
            l.end();
          }), o.on("error", function(a) {
            l.error(a);
          }), this;
        }, pause: function() {
          return !this.isPaused && !this.isFinished && (this.isPaused = !0, this.previous && this.previous.pause(), !0);
        }, resume: function() {
          if (!this.isPaused || this.isFinished) return !1;
          var o = this.isPaused = !1;
          return this.generatedError && (this.error(this.generatedError), o = !0), this.previous && this.previous.resume(), !o;
        }, flush: function() {
        }, processChunk: function(o) {
          this.push(o);
        }, withStreamInfo: function(o, l) {
          return this.extraStreamInfo[o] = l, this.mergeStreamInfo(), this;
        }, mergeStreamInfo: function() {
          for (var o in this.extraStreamInfo) Object.prototype.hasOwnProperty.call(this.extraStreamInfo, o) && (this.streamInfo[o] = this.extraStreamInfo[o]);
        }, lock: function() {
          if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
          this.isLocked = !0, this.previous && this.previous.lock();
        }, toString: function() {
          var o = "Worker " + this.name;
          return this.previous ? this.previous + " -> " + o : o;
        } }, r.exports = s;
      }, {}], 29: [function(n, r, i) {
        var s = n("../utils"), o = n("./ConvertWorker"), l = n("./GenericWorker"), a = n("../base64"), u = n("../support"), c = n("../external"), h = null;
        if (u.nodestream) try {
          h = n("../nodejs/NodejsStreamOutputAdapter");
        } catch {
        }
        function d(p, m) {
          return new c.Promise(function(y, g) {
            var b = [], x = p._internalType, A = p._outputType, E = p._mimeType;
            p.on("data", function(v, M) {
              b.push(v), m && m(M);
            }).on("error", function(v) {
              b = [], g(v);
            }).on("end", function() {
              try {
                var v = (function(M, R, O) {
                  switch (M) {
                    case "blob":
                      return s.newBlob(s.transformTo("arraybuffer", R), O);
                    case "base64":
                      return a.encode(R);
                    default:
                      return s.transformTo(M, R);
                  }
                })(A, (function(M, R) {
                  var O, T = 0, V = null, S = 0;
                  for (O = 0; O < R.length; O++) S += R[O].length;
                  switch (M) {
                    case "string":
                      return R.join("");
                    case "array":
                      return Array.prototype.concat.apply([], R);
                    case "uint8array":
                      for (V = new Uint8Array(S), O = 0; O < R.length; O++) V.set(R[O], T), T += R[O].length;
                      return V;
                    case "nodebuffer":
                      return Buffer.concat(R);
                    default:
                      throw new Error("concat : unsupported type '" + M + "'");
                  }
                })(x, b), E);
                y(v);
              } catch (M) {
                g(M);
              }
              b = [];
            }).resume();
          });
        }
        function f(p, m, y) {
          var g = m;
          switch (m) {
            case "blob":
            case "arraybuffer":
              g = "uint8array";
              break;
            case "base64":
              g = "string";
          }
          try {
            this._internalType = g, this._outputType = m, this._mimeType = y, s.checkSupport(g), this._worker = p.pipe(new o(g)), p.lock();
          } catch (b) {
            this._worker = new l("error"), this._worker.error(b);
          }
        }
        f.prototype = { accumulate: function(p) {
          return d(this, p);
        }, on: function(p, m) {
          var y = this;
          return p === "data" ? this._worker.on(p, function(g) {
            m.call(y, g.data, g.meta);
          }) : this._worker.on(p, function() {
            s.delay(m, arguments, y);
          }), this;
        }, resume: function() {
          return s.delay(this._worker.resume, [], this._worker), this;
        }, pause: function() {
          return this._worker.pause(), this;
        }, toNodejsStream: function(p) {
          if (s.checkSupport("nodestream"), this._outputType !== "nodebuffer") throw new Error(this._outputType + " is not supported by this method");
          return new h(this, { objectMode: this._outputType !== "nodebuffer" }, p);
        } }, r.exports = f;
      }, { "../base64": 1, "../external": 6, "../nodejs/NodejsStreamOutputAdapter": 13, "../support": 30, "../utils": 32, "./ConvertWorker": 24, "./GenericWorker": 28 }], 30: [function(n, r, i) {
        if (i.base64 = !0, i.array = !0, i.string = !0, i.arraybuffer = typeof ArrayBuffer < "u" && typeof Uint8Array < "u", i.nodebuffer = typeof Buffer < "u", i.uint8array = typeof Uint8Array < "u", typeof ArrayBuffer > "u") i.blob = !1;
        else {
          var s = new ArrayBuffer(0);
          try {
            i.blob = new Blob([s], { type: "application/zip" }).size === 0;
          } catch {
            try {
              var o = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              o.append(s), i.blob = o.getBlob("application/zip").size === 0;
            } catch {
              i.blob = !1;
            }
          }
        }
        try {
          i.nodestream = !!n("readable-stream").Readable;
        } catch {
          i.nodestream = !1;
        }
      }, { "readable-stream": 16 }], 31: [function(n, r, i) {
        for (var s = n("./utils"), o = n("./support"), l = n("./nodejsUtils"), a = n("./stream/GenericWorker"), u = new Array(256), c = 0; c < 256; c++) u[c] = 252 <= c ? 6 : 248 <= c ? 5 : 240 <= c ? 4 : 224 <= c ? 3 : 192 <= c ? 2 : 1;
        u[254] = u[254] = 1;
        function h() {
          a.call(this, "utf-8 decode"), this.leftOver = null;
        }
        function d() {
          a.call(this, "utf-8 encode");
        }
        i.utf8encode = function(f) {
          return o.nodebuffer ? l.newBufferFrom(f, "utf-8") : (function(p) {
            var m, y, g, b, x, A = p.length, E = 0;
            for (b = 0; b < A; b++) (64512 & (y = p.charCodeAt(b))) == 55296 && b + 1 < A && (64512 & (g = p.charCodeAt(b + 1))) == 56320 && (y = 65536 + (y - 55296 << 10) + (g - 56320), b++), E += y < 128 ? 1 : y < 2048 ? 2 : y < 65536 ? 3 : 4;
            for (m = o.uint8array ? new Uint8Array(E) : new Array(E), b = x = 0; x < E; b++) (64512 & (y = p.charCodeAt(b))) == 55296 && b + 1 < A && (64512 & (g = p.charCodeAt(b + 1))) == 56320 && (y = 65536 + (y - 55296 << 10) + (g - 56320), b++), y < 128 ? m[x++] = y : (y < 2048 ? m[x++] = 192 | y >>> 6 : (y < 65536 ? m[x++] = 224 | y >>> 12 : (m[x++] = 240 | y >>> 18, m[x++] = 128 | y >>> 12 & 63), m[x++] = 128 | y >>> 6 & 63), m[x++] = 128 | 63 & y);
            return m;
          })(f);
        }, i.utf8decode = function(f) {
          return o.nodebuffer ? s.transformTo("nodebuffer", f).toString("utf-8") : (function(p) {
            var m, y, g, b, x = p.length, A = new Array(2 * x);
            for (m = y = 0; m < x; ) if ((g = p[m++]) < 128) A[y++] = g;
            else if (4 < (b = u[g])) A[y++] = 65533, m += b - 1;
            else {
              for (g &= b === 2 ? 31 : b === 3 ? 15 : 7; 1 < b && m < x; ) g = g << 6 | 63 & p[m++], b--;
              1 < b ? A[y++] = 65533 : g < 65536 ? A[y++] = g : (g -= 65536, A[y++] = 55296 | g >> 10 & 1023, A[y++] = 56320 | 1023 & g);
            }
            return A.length !== y && (A.subarray ? A = A.subarray(0, y) : A.length = y), s.applyFromCharCode(A);
          })(f = s.transformTo(o.uint8array ? "uint8array" : "array", f));
        }, s.inherits(h, a), h.prototype.processChunk = function(f) {
          var p = s.transformTo(o.uint8array ? "uint8array" : "array", f.data);
          if (this.leftOver && this.leftOver.length) {
            if (o.uint8array) {
              var m = p;
              (p = new Uint8Array(m.length + this.leftOver.length)).set(this.leftOver, 0), p.set(m, this.leftOver.length);
            } else p = this.leftOver.concat(p);
            this.leftOver = null;
          }
          var y = (function(b, x) {
            var A;
            for ((x = x || b.length) > b.length && (x = b.length), A = x - 1; 0 <= A && (192 & b[A]) == 128; ) A--;
            return A < 0 || A === 0 ? x : A + u[b[A]] > x ? A : x;
          })(p), g = p;
          y !== p.length && (o.uint8array ? (g = p.subarray(0, y), this.leftOver = p.subarray(y, p.length)) : (g = p.slice(0, y), this.leftOver = p.slice(y, p.length))), this.push({ data: i.utf8decode(g), meta: f.meta });
        }, h.prototype.flush = function() {
          this.leftOver && this.leftOver.length && (this.push({ data: i.utf8decode(this.leftOver), meta: {} }), this.leftOver = null);
        }, i.Utf8DecodeWorker = h, s.inherits(d, a), d.prototype.processChunk = function(f) {
          this.push({ data: i.utf8encode(f.data), meta: f.meta });
        }, i.Utf8EncodeWorker = d;
      }, { "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./support": 30, "./utils": 32 }], 32: [function(n, r, i) {
        var s = n("./support"), o = n("./base64"), l = n("./nodejsUtils"), a = n("./external");
        function u(m) {
          return m;
        }
        function c(m, y) {
          for (var g = 0; g < m.length; ++g) y[g] = 255 & m.charCodeAt(g);
          return y;
        }
        n("setimmediate"), i.newBlob = function(m, y) {
          i.checkSupport("blob");
          try {
            return new Blob([m], { type: y });
          } catch {
            try {
              var g = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              return g.append(m), g.getBlob(y);
            } catch {
              throw new Error("Bug : can't construct the Blob.");
            }
          }
        };
        var h = { stringifyByChunk: function(m, y, g) {
          var b = [], x = 0, A = m.length;
          if (A <= g) return String.fromCharCode.apply(null, m);
          for (; x < A; ) y === "array" || y === "nodebuffer" ? b.push(String.fromCharCode.apply(null, m.slice(x, Math.min(x + g, A)))) : b.push(String.fromCharCode.apply(null, m.subarray(x, Math.min(x + g, A)))), x += g;
          return b.join("");
        }, stringifyByChar: function(m) {
          for (var y = "", g = 0; g < m.length; g++) y += String.fromCharCode(m[g]);
          return y;
        }, applyCanBeUsed: { uint8array: (function() {
          try {
            return s.uint8array && String.fromCharCode.apply(null, new Uint8Array(1)).length === 1;
          } catch {
            return !1;
          }
        })(), nodebuffer: (function() {
          try {
            return s.nodebuffer && String.fromCharCode.apply(null, l.allocBuffer(1)).length === 1;
          } catch {
            return !1;
          }
        })() } };
        function d(m) {
          var y = 65536, g = i.getTypeOf(m), b = !0;
          if (g === "uint8array" ? b = h.applyCanBeUsed.uint8array : g === "nodebuffer" && (b = h.applyCanBeUsed.nodebuffer), b) for (; 1 < y; ) try {
            return h.stringifyByChunk(m, g, y);
          } catch {
            y = Math.floor(y / 2);
          }
          return h.stringifyByChar(m);
        }
        function f(m, y) {
          for (var g = 0; g < m.length; g++) y[g] = m[g];
          return y;
        }
        i.applyFromCharCode = d;
        var p = {};
        p.string = { string: u, array: function(m) {
          return c(m, new Array(m.length));
        }, arraybuffer: function(m) {
          return p.string.uint8array(m).buffer;
        }, uint8array: function(m) {
          return c(m, new Uint8Array(m.length));
        }, nodebuffer: function(m) {
          return c(m, l.allocBuffer(m.length));
        } }, p.array = { string: d, array: u, arraybuffer: function(m) {
          return new Uint8Array(m).buffer;
        }, uint8array: function(m) {
          return new Uint8Array(m);
        }, nodebuffer: function(m) {
          return l.newBufferFrom(m);
        } }, p.arraybuffer = { string: function(m) {
          return d(new Uint8Array(m));
        }, array: function(m) {
          return f(new Uint8Array(m), new Array(m.byteLength));
        }, arraybuffer: u, uint8array: function(m) {
          return new Uint8Array(m);
        }, nodebuffer: function(m) {
          return l.newBufferFrom(new Uint8Array(m));
        } }, p.uint8array = { string: d, array: function(m) {
          return f(m, new Array(m.length));
        }, arraybuffer: function(m) {
          return m.buffer;
        }, uint8array: u, nodebuffer: function(m) {
          return l.newBufferFrom(m);
        } }, p.nodebuffer = { string: d, array: function(m) {
          return f(m, new Array(m.length));
        }, arraybuffer: function(m) {
          return p.nodebuffer.uint8array(m).buffer;
        }, uint8array: function(m) {
          return f(m, new Uint8Array(m.length));
        }, nodebuffer: u }, i.transformTo = function(m, y) {
          if (y = y || "", !m) return y;
          i.checkSupport(m);
          var g = i.getTypeOf(y);
          return p[g][m](y);
        }, i.resolve = function(m) {
          for (var y = m.split("/"), g = [], b = 0; b < y.length; b++) {
            var x = y[b];
            x === "." || x === "" && b !== 0 && b !== y.length - 1 || (x === ".." ? g.pop() : g.push(x));
          }
          return g.join("/");
        }, i.getTypeOf = function(m) {
          return typeof m == "string" ? "string" : Object.prototype.toString.call(m) === "[object Array]" ? "array" : s.nodebuffer && l.isBuffer(m) ? "nodebuffer" : s.uint8array && m instanceof Uint8Array ? "uint8array" : s.arraybuffer && m instanceof ArrayBuffer ? "arraybuffer" : void 0;
        }, i.checkSupport = function(m) {
          if (!s[m.toLowerCase()]) throw new Error(m + " is not supported by this platform");
        }, i.MAX_VALUE_16BITS = 65535, i.MAX_VALUE_32BITS = -1, i.pretty = function(m) {
          var y, g, b = "";
          for (g = 0; g < (m || "").length; g++) b += "\\x" + ((y = m.charCodeAt(g)) < 16 ? "0" : "") + y.toString(16).toUpperCase();
          return b;
        }, i.delay = function(m, y, g) {
          setImmediate(function() {
            m.apply(g || null, y || []);
          });
        }, i.inherits = function(m, y) {
          function g() {
          }
          g.prototype = y.prototype, m.prototype = new g();
        }, i.extend = function() {
          var m, y, g = {};
          for (m = 0; m < arguments.length; m++) for (y in arguments[m]) Object.prototype.hasOwnProperty.call(arguments[m], y) && g[y] === void 0 && (g[y] = arguments[m][y]);
          return g;
        }, i.prepareContent = function(m, y, g, b, x) {
          return a.Promise.resolve(y).then(function(A) {
            return s.blob && (A instanceof Blob || ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(A)) !== -1) && typeof FileReader < "u" ? new a.Promise(function(E, v) {
              var M = new FileReader();
              M.onload = function(R) {
                E(R.target.result);
              }, M.onerror = function(R) {
                v(R.target.error);
              }, M.readAsArrayBuffer(A);
            }) : A;
          }).then(function(A) {
            var E = i.getTypeOf(A);
            return E ? (E === "arraybuffer" ? A = i.transformTo("uint8array", A) : E === "string" && (x ? A = o.decode(A) : g && b !== !0 && (A = (function(v) {
              return c(v, s.uint8array ? new Uint8Array(v.length) : new Array(v.length));
            })(A))), A) : a.Promise.reject(new Error("Can't read the data of '" + m + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
          });
        };
      }, { "./base64": 1, "./external": 6, "./nodejsUtils": 14, "./support": 30, setimmediate: 54 }], 33: [function(n, r, i) {
        var s = n("./reader/readerFor"), o = n("./utils"), l = n("./signature"), a = n("./zipEntry"), u = n("./support");
        function c(h) {
          this.files = [], this.loadOptions = h;
        }
        c.prototype = { checkSignature: function(h) {
          if (!this.reader.readAndCheckSignature(h)) {
            this.reader.index -= 4;
            var d = this.reader.readString(4);
            throw new Error("Corrupted zip or bug: unexpected signature (" + o.pretty(d) + ", expected " + o.pretty(h) + ")");
          }
        }, isSignature: function(h, d) {
          var f = this.reader.index;
          this.reader.setIndex(h);
          var p = this.reader.readString(4) === d;
          return this.reader.setIndex(f), p;
        }, readBlockEndOfCentral: function() {
          this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
          var h = this.reader.readData(this.zipCommentLength), d = u.uint8array ? "uint8array" : "array", f = o.transformTo(d, h);
          this.zipComment = this.loadOptions.decodeFileName(f);
        }, readBlockZip64EndOfCentral: function() {
          this.zip64EndOfCentralSize = this.reader.readInt(8), this.reader.skip(4), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
          for (var h, d, f, p = this.zip64EndOfCentralSize - 44; 0 < p; ) h = this.reader.readInt(2), d = this.reader.readInt(4), f = this.reader.readData(d), this.zip64ExtensibleData[h] = { id: h, length: d, value: f };
        }, readBlockZip64EndOfCentralLocator: function() {
          if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), 1 < this.disksCount) throw new Error("Multi-volumes zip are not supported");
        }, readLocalFiles: function() {
          var h, d;
          for (h = 0; h < this.files.length; h++) d = this.files[h], this.reader.setIndex(d.localHeaderOffset), this.checkSignature(l.LOCAL_FILE_HEADER), d.readLocalPart(this.reader), d.handleUTF8(), d.processAttributes();
        }, readCentralDir: function() {
          var h;
          for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(l.CENTRAL_FILE_HEADER); ) (h = new a({ zip64: this.zip64 }, this.loadOptions)).readCentralPart(this.reader), this.files.push(h);
          if (this.centralDirRecords !== this.files.length && this.centralDirRecords !== 0 && this.files.length === 0) throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
        }, readEndOfCentral: function() {
          var h = this.reader.lastIndexOfSignature(l.CENTRAL_DIRECTORY_END);
          if (h < 0) throw this.isSignature(0, l.LOCAL_FILE_HEADER) ? new Error("Corrupted zip: can't find end of central directory") : new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html");
          this.reader.setIndex(h);
          var d = h;
          if (this.checkSignature(l.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === o.MAX_VALUE_16BITS || this.diskWithCentralDirStart === o.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === o.MAX_VALUE_16BITS || this.centralDirRecords === o.MAX_VALUE_16BITS || this.centralDirSize === o.MAX_VALUE_32BITS || this.centralDirOffset === o.MAX_VALUE_32BITS) {
            if (this.zip64 = !0, (h = this.reader.lastIndexOfSignature(l.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
            if (this.reader.setIndex(h), this.checkSignature(l.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, l.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(l.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0)) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
            this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(l.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
          }
          var f = this.centralDirOffset + this.centralDirSize;
          this.zip64 && (f += 20, f += 12 + this.zip64EndOfCentralSize);
          var p = d - f;
          if (0 < p) this.isSignature(d, l.CENTRAL_FILE_HEADER) || (this.reader.zero = p);
          else if (p < 0) throw new Error("Corrupted zip: missing " + Math.abs(p) + " bytes.");
        }, prepareReader: function(h) {
          this.reader = s(h);
        }, load: function(h) {
          this.prepareReader(h), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
        } }, r.exports = c;
      }, { "./reader/readerFor": 22, "./signature": 23, "./support": 30, "./utils": 32, "./zipEntry": 34 }], 34: [function(n, r, i) {
        var s = n("./reader/readerFor"), o = n("./utils"), l = n("./compressedObject"), a = n("./crc32"), u = n("./utf8"), c = n("./compressions"), h = n("./support");
        function d(f, p) {
          this.options = f, this.loadOptions = p;
        }
        d.prototype = { isEncrypted: function() {
          return (1 & this.bitFlag) == 1;
        }, useUTF8: function() {
          return (2048 & this.bitFlag) == 2048;
        }, readLocalPart: function(f) {
          var p, m;
          if (f.skip(22), this.fileNameLength = f.readInt(2), m = f.readInt(2), this.fileName = f.readData(this.fileNameLength), f.skip(m), this.compressedSize === -1 || this.uncompressedSize === -1) throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
          if ((p = (function(y) {
            for (var g in c) if (Object.prototype.hasOwnProperty.call(c, g) && c[g].magic === y) return c[g];
            return null;
          })(this.compressionMethod)) === null) throw new Error("Corrupted zip : compression " + o.pretty(this.compressionMethod) + " unknown (inner file : " + o.transformTo("string", this.fileName) + ")");
          this.decompressed = new l(this.compressedSize, this.uncompressedSize, this.crc32, p, f.readData(this.compressedSize));
        }, readCentralPart: function(f) {
          this.versionMadeBy = f.readInt(2), f.skip(2), this.bitFlag = f.readInt(2), this.compressionMethod = f.readString(2), this.date = f.readDate(), this.crc32 = f.readInt(4), this.compressedSize = f.readInt(4), this.uncompressedSize = f.readInt(4);
          var p = f.readInt(2);
          if (this.extraFieldsLength = f.readInt(2), this.fileCommentLength = f.readInt(2), this.diskNumberStart = f.readInt(2), this.internalFileAttributes = f.readInt(2), this.externalFileAttributes = f.readInt(4), this.localHeaderOffset = f.readInt(4), this.isEncrypted()) throw new Error("Encrypted zip are not supported");
          f.skip(p), this.readExtraFields(f), this.parseZIP64ExtraField(f), this.fileComment = f.readData(this.fileCommentLength);
        }, processAttributes: function() {
          this.unixPermissions = null, this.dosPermissions = null;
          var f = this.versionMadeBy >> 8;
          this.dir = !!(16 & this.externalFileAttributes), f == 0 && (this.dosPermissions = 63 & this.externalFileAttributes), f == 3 && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), this.dir || this.fileNameStr.slice(-1) !== "/" || (this.dir = !0);
        }, parseZIP64ExtraField: function() {
          if (this.extraFields[1]) {
            var f = s(this.extraFields[1].value);
            this.uncompressedSize === o.MAX_VALUE_32BITS && (this.uncompressedSize = f.readInt(8)), this.compressedSize === o.MAX_VALUE_32BITS && (this.compressedSize = f.readInt(8)), this.localHeaderOffset === o.MAX_VALUE_32BITS && (this.localHeaderOffset = f.readInt(8)), this.diskNumberStart === o.MAX_VALUE_32BITS && (this.diskNumberStart = f.readInt(4));
          }
        }, readExtraFields: function(f) {
          var p, m, y, g = f.index + this.extraFieldsLength;
          for (this.extraFields || (this.extraFields = {}); f.index + 4 < g; ) p = f.readInt(2), m = f.readInt(2), y = f.readData(m), this.extraFields[p] = { id: p, length: m, value: y };
          f.setIndex(g);
        }, handleUTF8: function() {
          var f = h.uint8array ? "uint8array" : "array";
          if (this.useUTF8()) this.fileNameStr = u.utf8decode(this.fileName), this.fileCommentStr = u.utf8decode(this.fileComment);
          else {
            var p = this.findExtraFieldUnicodePath();
            if (p !== null) this.fileNameStr = p;
            else {
              var m = o.transformTo(f, this.fileName);
              this.fileNameStr = this.loadOptions.decodeFileName(m);
            }
            var y = this.findExtraFieldUnicodeComment();
            if (y !== null) this.fileCommentStr = y;
            else {
              var g = o.transformTo(f, this.fileComment);
              this.fileCommentStr = this.loadOptions.decodeFileName(g);
            }
          }
        }, findExtraFieldUnicodePath: function() {
          var f = this.extraFields[28789];
          if (f) {
            var p = s(f.value);
            return p.readInt(1) !== 1 || a(this.fileName) !== p.readInt(4) ? null : u.utf8decode(p.readData(f.length - 5));
          }
          return null;
        }, findExtraFieldUnicodeComment: function() {
          var f = this.extraFields[25461];
          if (f) {
            var p = s(f.value);
            return p.readInt(1) !== 1 || a(this.fileComment) !== p.readInt(4) ? null : u.utf8decode(p.readData(f.length - 5));
          }
          return null;
        } }, r.exports = d;
      }, { "./compressedObject": 2, "./compressions": 3, "./crc32": 4, "./reader/readerFor": 22, "./support": 30, "./utf8": 31, "./utils": 32 }], 35: [function(n, r, i) {
        function s(p, m, y) {
          this.name = p, this.dir = y.dir, this.date = y.date, this.comment = y.comment, this.unixPermissions = y.unixPermissions, this.dosPermissions = y.dosPermissions, this._data = m, this._dataBinary = y.binary, this.options = { compression: y.compression, compressionOptions: y.compressionOptions };
        }
        var o = n("./stream/StreamHelper"), l = n("./stream/DataWorker"), a = n("./utf8"), u = n("./compressedObject"), c = n("./stream/GenericWorker");
        s.prototype = { internalStream: function(p) {
          var m = null, y = "string";
          try {
            if (!p) throw new Error("No output type specified.");
            var g = (y = p.toLowerCase()) === "string" || y === "text";
            y !== "binarystring" && y !== "text" || (y = "string"), m = this._decompressWorker();
            var b = !this._dataBinary;
            b && !g && (m = m.pipe(new a.Utf8EncodeWorker())), !b && g && (m = m.pipe(new a.Utf8DecodeWorker()));
          } catch (x) {
            (m = new c("error")).error(x);
          }
          return new o(m, y, "");
        }, async: function(p, m) {
          return this.internalStream(p).accumulate(m);
        }, nodeStream: function(p, m) {
          return this.internalStream(p || "nodebuffer").toNodejsStream(m);
        }, _compressWorker: function(p, m) {
          if (this._data instanceof u && this._data.compression.magic === p.magic) return this._data.getCompressedWorker();
          var y = this._decompressWorker();
          return this._dataBinary || (y = y.pipe(new a.Utf8EncodeWorker())), u.createWorkerFrom(y, p, m);
        }, _decompressWorker: function() {
          return this._data instanceof u ? this._data.getContentWorker() : this._data instanceof c ? this._data : new l(this._data);
        } };
        for (var h = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], d = function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, f = 0; f < h.length; f++) s.prototype[h[f]] = d;
        r.exports = s;
      }, { "./compressedObject": 2, "./stream/DataWorker": 27, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31 }], 36: [function(n, r, i) {
        (function(s) {
          var o, l, a = s.MutationObserver || s.WebKitMutationObserver;
          if (a) {
            var u = 0, c = new a(p), h = s.document.createTextNode("");
            c.observe(h, { characterData: !0 }), o = function() {
              h.data = u = ++u % 2;
            };
          } else if (s.setImmediate || s.MessageChannel === void 0) o = "document" in s && "onreadystatechange" in s.document.createElement("script") ? function() {
            var m = s.document.createElement("script");
            m.onreadystatechange = function() {
              p(), m.onreadystatechange = null, m.parentNode.removeChild(m), m = null;
            }, s.document.documentElement.appendChild(m);
          } : function() {
            setTimeout(p, 0);
          };
          else {
            var d = new s.MessageChannel();
            d.port1.onmessage = p, o = function() {
              d.port2.postMessage(0);
            };
          }
          var f = [];
          function p() {
            var m, y;
            l = !0;
            for (var g = f.length; g; ) {
              for (y = f, f = [], m = -1; ++m < g; ) y[m]();
              g = f.length;
            }
            l = !1;
          }
          r.exports = function(m) {
            f.push(m) !== 1 || l || o();
          };
        }).call(this, typeof xi < "u" ? xi : typeof self < "u" ? self : typeof window < "u" ? window : {});
      }, {}], 37: [function(n, r, i) {
        var s = n("immediate");
        function o() {
        }
        var l = {}, a = ["REJECTED"], u = ["FULFILLED"], c = ["PENDING"];
        function h(g) {
          if (typeof g != "function") throw new TypeError("resolver must be a function");
          this.state = c, this.queue = [], this.outcome = void 0, g !== o && m(this, g);
        }
        function d(g, b, x) {
          this.promise = g, typeof b == "function" && (this.onFulfilled = b, this.callFulfilled = this.otherCallFulfilled), typeof x == "function" && (this.onRejected = x, this.callRejected = this.otherCallRejected);
        }
        function f(g, b, x) {
          s(function() {
            var A;
            try {
              A = b(x);
            } catch (E) {
              return l.reject(g, E);
            }
            A === g ? l.reject(g, new TypeError("Cannot resolve promise with itself")) : l.resolve(g, A);
          });
        }
        function p(g) {
          var b = g && g.then;
          if (g && (typeof g == "object" || typeof g == "function") && typeof b == "function") return function() {
            b.apply(g, arguments);
          };
        }
        function m(g, b) {
          var x = !1;
          function A(M) {
            x || (x = !0, l.reject(g, M));
          }
          function E(M) {
            x || (x = !0, l.resolve(g, M));
          }
          var v = y(function() {
            b(E, A);
          });
          v.status === "error" && A(v.value);
        }
        function y(g, b) {
          var x = {};
          try {
            x.value = g(b), x.status = "success";
          } catch (A) {
            x.status = "error", x.value = A;
          }
          return x;
        }
        (r.exports = h).prototype.finally = function(g) {
          if (typeof g != "function") return this;
          var b = this.constructor;
          return this.then(function(x) {
            return b.resolve(g()).then(function() {
              return x;
            });
          }, function(x) {
            return b.resolve(g()).then(function() {
              throw x;
            });
          });
        }, h.prototype.catch = function(g) {
          return this.then(null, g);
        }, h.prototype.then = function(g, b) {
          if (typeof g != "function" && this.state === u || typeof b != "function" && this.state === a) return this;
          var x = new this.constructor(o);
          return this.state !== c ? f(x, this.state === u ? g : b, this.outcome) : this.queue.push(new d(x, g, b)), x;
        }, d.prototype.callFulfilled = function(g) {
          l.resolve(this.promise, g);
        }, d.prototype.otherCallFulfilled = function(g) {
          f(this.promise, this.onFulfilled, g);
        }, d.prototype.callRejected = function(g) {
          l.reject(this.promise, g);
        }, d.prototype.otherCallRejected = function(g) {
          f(this.promise, this.onRejected, g);
        }, l.resolve = function(g, b) {
          var x = y(p, b);
          if (x.status === "error") return l.reject(g, x.value);
          var A = x.value;
          if (A) m(g, A);
          else {
            g.state = u, g.outcome = b;
            for (var E = -1, v = g.queue.length; ++E < v; ) g.queue[E].callFulfilled(b);
          }
          return g;
        }, l.reject = function(g, b) {
          g.state = a, g.outcome = b;
          for (var x = -1, A = g.queue.length; ++x < A; ) g.queue[x].callRejected(b);
          return g;
        }, h.resolve = function(g) {
          return g instanceof this ? g : l.resolve(new this(o), g);
        }, h.reject = function(g) {
          var b = new this(o);
          return l.reject(b, g);
        }, h.all = function(g) {
          var b = this;
          if (Object.prototype.toString.call(g) !== "[object Array]") return this.reject(new TypeError("must be an array"));
          var x = g.length, A = !1;
          if (!x) return this.resolve([]);
          for (var E = new Array(x), v = 0, M = -1, R = new this(o); ++M < x; ) O(g[M], M);
          return R;
          function O(T, V) {
            b.resolve(T).then(function(S) {
              E[V] = S, ++v !== x || A || (A = !0, l.resolve(R, E));
            }, function(S) {
              A || (A = !0, l.reject(R, S));
            });
          }
        }, h.race = function(g) {
          var b = this;
          if (Object.prototype.toString.call(g) !== "[object Array]") return this.reject(new TypeError("must be an array"));
          var x = g.length, A = !1;
          if (!x) return this.resolve([]);
          for (var E = -1, v = new this(o); ++E < x; ) M = g[E], b.resolve(M).then(function(R) {
            A || (A = !0, l.resolve(v, R));
          }, function(R) {
            A || (A = !0, l.reject(v, R));
          });
          var M;
          return v;
        };
      }, { immediate: 36 }], 38: [function(n, r, i) {
        var s = {};
        (0, n("./lib/utils/common").assign)(s, n("./lib/deflate"), n("./lib/inflate"), n("./lib/zlib/constants")), r.exports = s;
      }, { "./lib/deflate": 39, "./lib/inflate": 40, "./lib/utils/common": 41, "./lib/zlib/constants": 44 }], 39: [function(n, r, i) {
        var s = n("./zlib/deflate"), o = n("./utils/common"), l = n("./utils/strings"), a = n("./zlib/messages"), u = n("./zlib/zstream"), c = Object.prototype.toString, h = 0, d = -1, f = 0, p = 8;
        function m(g) {
          if (!(this instanceof m)) return new m(g);
          this.options = o.assign({ level: d, method: p, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: f, to: "" }, g || {});
          var b = this.options;
          b.raw && 0 < b.windowBits ? b.windowBits = -b.windowBits : b.gzip && 0 < b.windowBits && b.windowBits < 16 && (b.windowBits += 16), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new u(), this.strm.avail_out = 0;
          var x = s.deflateInit2(this.strm, b.level, b.method, b.windowBits, b.memLevel, b.strategy);
          if (x !== h) throw new Error(a[x]);
          if (b.header && s.deflateSetHeader(this.strm, b.header), b.dictionary) {
            var A;
            if (A = typeof b.dictionary == "string" ? l.string2buf(b.dictionary) : c.call(b.dictionary) === "[object ArrayBuffer]" ? new Uint8Array(b.dictionary) : b.dictionary, (x = s.deflateSetDictionary(this.strm, A)) !== h) throw new Error(a[x]);
            this._dict_set = !0;
          }
        }
        function y(g, b) {
          var x = new m(b);
          if (x.push(g, !0), x.err) throw x.msg || a[x.err];
          return x.result;
        }
        m.prototype.push = function(g, b) {
          var x, A, E = this.strm, v = this.options.chunkSize;
          if (this.ended) return !1;
          A = b === ~~b ? b : b === !0 ? 4 : 0, typeof g == "string" ? E.input = l.string2buf(g) : c.call(g) === "[object ArrayBuffer]" ? E.input = new Uint8Array(g) : E.input = g, E.next_in = 0, E.avail_in = E.input.length;
          do {
            if (E.avail_out === 0 && (E.output = new o.Buf8(v), E.next_out = 0, E.avail_out = v), (x = s.deflate(E, A)) !== 1 && x !== h) return this.onEnd(x), !(this.ended = !0);
            E.avail_out !== 0 && (E.avail_in !== 0 || A !== 4 && A !== 2) || (this.options.to === "string" ? this.onData(l.buf2binstring(o.shrinkBuf(E.output, E.next_out))) : this.onData(o.shrinkBuf(E.output, E.next_out)));
          } while ((0 < E.avail_in || E.avail_out === 0) && x !== 1);
          return A === 4 ? (x = s.deflateEnd(this.strm), this.onEnd(x), this.ended = !0, x === h) : A !== 2 || (this.onEnd(h), !(E.avail_out = 0));
        }, m.prototype.onData = function(g) {
          this.chunks.push(g);
        }, m.prototype.onEnd = function(g) {
          g === h && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = o.flattenChunks(this.chunks)), this.chunks = [], this.err = g, this.msg = this.strm.msg;
        }, i.Deflate = m, i.deflate = y, i.deflateRaw = function(g, b) {
          return (b = b || {}).raw = !0, y(g, b);
        }, i.gzip = function(g, b) {
          return (b = b || {}).gzip = !0, y(g, b);
        };
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/deflate": 46, "./zlib/messages": 51, "./zlib/zstream": 53 }], 40: [function(n, r, i) {
        var s = n("./zlib/inflate"), o = n("./utils/common"), l = n("./utils/strings"), a = n("./zlib/constants"), u = n("./zlib/messages"), c = n("./zlib/zstream"), h = n("./zlib/gzheader"), d = Object.prototype.toString;
        function f(m) {
          if (!(this instanceof f)) return new f(m);
          this.options = o.assign({ chunkSize: 16384, windowBits: 0, to: "" }, m || {});
          var y = this.options;
          y.raw && 0 <= y.windowBits && y.windowBits < 16 && (y.windowBits = -y.windowBits, y.windowBits === 0 && (y.windowBits = -15)), !(0 <= y.windowBits && y.windowBits < 16) || m && m.windowBits || (y.windowBits += 32), 15 < y.windowBits && y.windowBits < 48 && (15 & y.windowBits) == 0 && (y.windowBits |= 15), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new c(), this.strm.avail_out = 0;
          var g = s.inflateInit2(this.strm, y.windowBits);
          if (g !== a.Z_OK) throw new Error(u[g]);
          this.header = new h(), s.inflateGetHeader(this.strm, this.header);
        }
        function p(m, y) {
          var g = new f(y);
          if (g.push(m, !0), g.err) throw g.msg || u[g.err];
          return g.result;
        }
        f.prototype.push = function(m, y) {
          var g, b, x, A, E, v, M = this.strm, R = this.options.chunkSize, O = this.options.dictionary, T = !1;
          if (this.ended) return !1;
          b = y === ~~y ? y : y === !0 ? a.Z_FINISH : a.Z_NO_FLUSH, typeof m == "string" ? M.input = l.binstring2buf(m) : d.call(m) === "[object ArrayBuffer]" ? M.input = new Uint8Array(m) : M.input = m, M.next_in = 0, M.avail_in = M.input.length;
          do {
            if (M.avail_out === 0 && (M.output = new o.Buf8(R), M.next_out = 0, M.avail_out = R), (g = s.inflate(M, a.Z_NO_FLUSH)) === a.Z_NEED_DICT && O && (v = typeof O == "string" ? l.string2buf(O) : d.call(O) === "[object ArrayBuffer]" ? new Uint8Array(O) : O, g = s.inflateSetDictionary(this.strm, v)), g === a.Z_BUF_ERROR && T === !0 && (g = a.Z_OK, T = !1), g !== a.Z_STREAM_END && g !== a.Z_OK) return this.onEnd(g), !(this.ended = !0);
            M.next_out && (M.avail_out !== 0 && g !== a.Z_STREAM_END && (M.avail_in !== 0 || b !== a.Z_FINISH && b !== a.Z_SYNC_FLUSH) || (this.options.to === "string" ? (x = l.utf8border(M.output, M.next_out), A = M.next_out - x, E = l.buf2string(M.output, x), M.next_out = A, M.avail_out = R - A, A && o.arraySet(M.output, M.output, x, A, 0), this.onData(E)) : this.onData(o.shrinkBuf(M.output, M.next_out)))), M.avail_in === 0 && M.avail_out === 0 && (T = !0);
          } while ((0 < M.avail_in || M.avail_out === 0) && g !== a.Z_STREAM_END);
          return g === a.Z_STREAM_END && (b = a.Z_FINISH), b === a.Z_FINISH ? (g = s.inflateEnd(this.strm), this.onEnd(g), this.ended = !0, g === a.Z_OK) : b !== a.Z_SYNC_FLUSH || (this.onEnd(a.Z_OK), !(M.avail_out = 0));
        }, f.prototype.onData = function(m) {
          this.chunks.push(m);
        }, f.prototype.onEnd = function(m) {
          m === a.Z_OK && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = o.flattenChunks(this.chunks)), this.chunks = [], this.err = m, this.msg = this.strm.msg;
        }, i.Inflate = f, i.inflate = p, i.inflateRaw = function(m, y) {
          return (y = y || {}).raw = !0, p(m, y);
        }, i.ungzip = p;
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/constants": 44, "./zlib/gzheader": 47, "./zlib/inflate": 49, "./zlib/messages": 51, "./zlib/zstream": 53 }], 41: [function(n, r, i) {
        var s = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Int32Array < "u";
        i.assign = function(a) {
          for (var u = Array.prototype.slice.call(arguments, 1); u.length; ) {
            var c = u.shift();
            if (c) {
              if (typeof c != "object") throw new TypeError(c + "must be non-object");
              for (var h in c) c.hasOwnProperty(h) && (a[h] = c[h]);
            }
          }
          return a;
        }, i.shrinkBuf = function(a, u) {
          return a.length === u ? a : a.subarray ? a.subarray(0, u) : (a.length = u, a);
        };
        var o = { arraySet: function(a, u, c, h, d) {
          if (u.subarray && a.subarray) a.set(u.subarray(c, c + h), d);
          else for (var f = 0; f < h; f++) a[d + f] = u[c + f];
        }, flattenChunks: function(a) {
          var u, c, h, d, f, p;
          for (u = h = 0, c = a.length; u < c; u++) h += a[u].length;
          for (p = new Uint8Array(h), u = d = 0, c = a.length; u < c; u++) f = a[u], p.set(f, d), d += f.length;
          return p;
        } }, l = { arraySet: function(a, u, c, h, d) {
          for (var f = 0; f < h; f++) a[d + f] = u[c + f];
        }, flattenChunks: function(a) {
          return [].concat.apply([], a);
        } };
        i.setTyped = function(a) {
          a ? (i.Buf8 = Uint8Array, i.Buf16 = Uint16Array, i.Buf32 = Int32Array, i.assign(i, o)) : (i.Buf8 = Array, i.Buf16 = Array, i.Buf32 = Array, i.assign(i, l));
        }, i.setTyped(s);
      }, {}], 42: [function(n, r, i) {
        var s = n("./common"), o = !0, l = !0;
        try {
          String.fromCharCode.apply(null, [0]);
        } catch {
          o = !1;
        }
        try {
          String.fromCharCode.apply(null, new Uint8Array(1));
        } catch {
          l = !1;
        }
        for (var a = new s.Buf8(256), u = 0; u < 256; u++) a[u] = 252 <= u ? 6 : 248 <= u ? 5 : 240 <= u ? 4 : 224 <= u ? 3 : 192 <= u ? 2 : 1;
        function c(h, d) {
          if (d < 65537 && (h.subarray && l || !h.subarray && o)) return String.fromCharCode.apply(null, s.shrinkBuf(h, d));
          for (var f = "", p = 0; p < d; p++) f += String.fromCharCode(h[p]);
          return f;
        }
        a[254] = a[254] = 1, i.string2buf = function(h) {
          var d, f, p, m, y, g = h.length, b = 0;
          for (m = 0; m < g; m++) (64512 & (f = h.charCodeAt(m))) == 55296 && m + 1 < g && (64512 & (p = h.charCodeAt(m + 1))) == 56320 && (f = 65536 + (f - 55296 << 10) + (p - 56320), m++), b += f < 128 ? 1 : f < 2048 ? 2 : f < 65536 ? 3 : 4;
          for (d = new s.Buf8(b), m = y = 0; y < b; m++) (64512 & (f = h.charCodeAt(m))) == 55296 && m + 1 < g && (64512 & (p = h.charCodeAt(m + 1))) == 56320 && (f = 65536 + (f - 55296 << 10) + (p - 56320), m++), f < 128 ? d[y++] = f : (f < 2048 ? d[y++] = 192 | f >>> 6 : (f < 65536 ? d[y++] = 224 | f >>> 12 : (d[y++] = 240 | f >>> 18, d[y++] = 128 | f >>> 12 & 63), d[y++] = 128 | f >>> 6 & 63), d[y++] = 128 | 63 & f);
          return d;
        }, i.buf2binstring = function(h) {
          return c(h, h.length);
        }, i.binstring2buf = function(h) {
          for (var d = new s.Buf8(h.length), f = 0, p = d.length; f < p; f++) d[f] = h.charCodeAt(f);
          return d;
        }, i.buf2string = function(h, d) {
          var f, p, m, y, g = d || h.length, b = new Array(2 * g);
          for (f = p = 0; f < g; ) if ((m = h[f++]) < 128) b[p++] = m;
          else if (4 < (y = a[m])) b[p++] = 65533, f += y - 1;
          else {
            for (m &= y === 2 ? 31 : y === 3 ? 15 : 7; 1 < y && f < g; ) m = m << 6 | 63 & h[f++], y--;
            1 < y ? b[p++] = 65533 : m < 65536 ? b[p++] = m : (m -= 65536, b[p++] = 55296 | m >> 10 & 1023, b[p++] = 56320 | 1023 & m);
          }
          return c(b, p);
        }, i.utf8border = function(h, d) {
          var f;
          for ((d = d || h.length) > h.length && (d = h.length), f = d - 1; 0 <= f && (192 & h[f]) == 128; ) f--;
          return f < 0 || f === 0 ? d : f + a[h[f]] > d ? f : d;
        };
      }, { "./common": 41 }], 43: [function(n, r, i) {
        r.exports = function(s, o, l, a) {
          for (var u = 65535 & s | 0, c = s >>> 16 & 65535 | 0, h = 0; l !== 0; ) {
            for (l -= h = 2e3 < l ? 2e3 : l; c = c + (u = u + o[a++] | 0) | 0, --h; ) ;
            u %= 65521, c %= 65521;
          }
          return u | c << 16 | 0;
        };
      }, {}], 44: [function(n, r, i) {
        r.exports = { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_BUF_ERROR: -5, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, Z_BINARY: 0, Z_TEXT: 1, Z_UNKNOWN: 2, Z_DEFLATED: 8 };
      }, {}], 45: [function(n, r, i) {
        var s = (function() {
          for (var o, l = [], a = 0; a < 256; a++) {
            o = a;
            for (var u = 0; u < 8; u++) o = 1 & o ? 3988292384 ^ o >>> 1 : o >>> 1;
            l[a] = o;
          }
          return l;
        })();
        r.exports = function(o, l, a, u) {
          var c = s, h = u + a;
          o ^= -1;
          for (var d = u; d < h; d++) o = o >>> 8 ^ c[255 & (o ^ l[d])];
          return -1 ^ o;
        };
      }, {}], 46: [function(n, r, i) {
        var s, o = n("../utils/common"), l = n("./trees"), a = n("./adler32"), u = n("./crc32"), c = n("./messages"), h = 0, d = 4, f = 0, p = -2, m = -1, y = 4, g = 2, b = 8, x = 9, A = 286, E = 30, v = 19, M = 2 * A + 1, R = 15, O = 3, T = 258, V = T + O + 1, S = 42, F = 113, w = 1, $ = 2, ie = 3, U = 4;
        function le(k, H) {
          return k.msg = c[H], H;
        }
        function Z(k) {
          return (k << 1) - (4 < k ? 9 : 0);
        }
        function I(k) {
          for (var H = k.length; 0 <= --H; ) k[H] = 0;
        }
        function B(k) {
          var H = k.state, j = H.pending;
          j > k.avail_out && (j = k.avail_out), j !== 0 && (o.arraySet(k.output, H.pending_buf, H.pending_out, j, k.next_out), k.next_out += j, H.pending_out += j, k.total_out += j, k.avail_out -= j, H.pending -= j, H.pending === 0 && (H.pending_out = 0));
        }
        function P(k, H) {
          l._tr_flush_block(k, 0 <= k.block_start ? k.block_start : -1, k.strstart - k.block_start, H), k.block_start = k.strstart, B(k.strm);
        }
        function N(k, H) {
          k.pending_buf[k.pending++] = H;
        }
        function ee(k, H) {
          k.pending_buf[k.pending++] = H >>> 8 & 255, k.pending_buf[k.pending++] = 255 & H;
        }
        function X(k, H) {
          var j, _, C = k.max_chain_length, D = k.strstart, q = k.prev_length, G = k.nice_match, L = k.strstart > k.w_size - V ? k.strstart - (k.w_size - V) : 0, Y = k.window, re = k.w_mask, Q = k.prev, z = k.strstart + T, J = Y[D + q - 1], te = Y[D + q];
          k.prev_length >= k.good_match && (C >>= 2), G > k.lookahead && (G = k.lookahead);
          do
            if (Y[(j = H) + q] === te && Y[j + q - 1] === J && Y[j] === Y[D] && Y[++j] === Y[D + 1]) {
              D += 2, j++;
              do
                ;
              while (Y[++D] === Y[++j] && Y[++D] === Y[++j] && Y[++D] === Y[++j] && Y[++D] === Y[++j] && Y[++D] === Y[++j] && Y[++D] === Y[++j] && Y[++D] === Y[++j] && Y[++D] === Y[++j] && D < z);
              if (_ = T - (z - D), D = z - T, q < _) {
                if (k.match_start = H, G <= (q = _)) break;
                J = Y[D + q - 1], te = Y[D + q];
              }
            }
          while ((H = Q[H & re]) > L && --C != 0);
          return q <= k.lookahead ? q : k.lookahead;
        }
        function me(k) {
          var H, j, _, C, D, q, G, L, Y, re, Q = k.w_size;
          do {
            if (C = k.window_size - k.lookahead - k.strstart, k.strstart >= Q + (Q - V)) {
              for (o.arraySet(k.window, k.window, Q, Q, 0), k.match_start -= Q, k.strstart -= Q, k.block_start -= Q, H = j = k.hash_size; _ = k.head[--H], k.head[H] = Q <= _ ? _ - Q : 0, --j; ) ;
              for (H = j = Q; _ = k.prev[--H], k.prev[H] = Q <= _ ? _ - Q : 0, --j; ) ;
              C += Q;
            }
            if (k.strm.avail_in === 0) break;
            if (q = k.strm, G = k.window, L = k.strstart + k.lookahead, Y = C, re = void 0, re = q.avail_in, Y < re && (re = Y), j = re === 0 ? 0 : (q.avail_in -= re, o.arraySet(G, q.input, q.next_in, re, L), q.state.wrap === 1 ? q.adler = a(q.adler, G, re, L) : q.state.wrap === 2 && (q.adler = u(q.adler, G, re, L)), q.next_in += re, q.total_in += re, re), k.lookahead += j, k.lookahead + k.insert >= O) for (D = k.strstart - k.insert, k.ins_h = k.window[D], k.ins_h = (k.ins_h << k.hash_shift ^ k.window[D + 1]) & k.hash_mask; k.insert && (k.ins_h = (k.ins_h << k.hash_shift ^ k.window[D + O - 1]) & k.hash_mask, k.prev[D & k.w_mask] = k.head[k.ins_h], k.head[k.ins_h] = D, D++, k.insert--, !(k.lookahead + k.insert < O)); ) ;
          } while (k.lookahead < V && k.strm.avail_in !== 0);
        }
        function Oe(k, H) {
          for (var j, _; ; ) {
            if (k.lookahead < V) {
              if (me(k), k.lookahead < V && H === h) return w;
              if (k.lookahead === 0) break;
            }
            if (j = 0, k.lookahead >= O && (k.ins_h = (k.ins_h << k.hash_shift ^ k.window[k.strstart + O - 1]) & k.hash_mask, j = k.prev[k.strstart & k.w_mask] = k.head[k.ins_h], k.head[k.ins_h] = k.strstart), j !== 0 && k.strstart - j <= k.w_size - V && (k.match_length = X(k, j)), k.match_length >= O) if (_ = l._tr_tally(k, k.strstart - k.match_start, k.match_length - O), k.lookahead -= k.match_length, k.match_length <= k.max_lazy_match && k.lookahead >= O) {
              for (k.match_length--; k.strstart++, k.ins_h = (k.ins_h << k.hash_shift ^ k.window[k.strstart + O - 1]) & k.hash_mask, j = k.prev[k.strstart & k.w_mask] = k.head[k.ins_h], k.head[k.ins_h] = k.strstart, --k.match_length != 0; ) ;
              k.strstart++;
            } else k.strstart += k.match_length, k.match_length = 0, k.ins_h = k.window[k.strstart], k.ins_h = (k.ins_h << k.hash_shift ^ k.window[k.strstart + 1]) & k.hash_mask;
            else _ = l._tr_tally(k, 0, k.window[k.strstart]), k.lookahead--, k.strstart++;
            if (_ && (P(k, !1), k.strm.avail_out === 0)) return w;
          }
          return k.insert = k.strstart < O - 1 ? k.strstart : O - 1, H === d ? (P(k, !0), k.strm.avail_out === 0 ? ie : U) : k.last_lit && (P(k, !1), k.strm.avail_out === 0) ? w : $;
        }
        function de(k, H) {
          for (var j, _, C; ; ) {
            if (k.lookahead < V) {
              if (me(k), k.lookahead < V && H === h) return w;
              if (k.lookahead === 0) break;
            }
            if (j = 0, k.lookahead >= O && (k.ins_h = (k.ins_h << k.hash_shift ^ k.window[k.strstart + O - 1]) & k.hash_mask, j = k.prev[k.strstart & k.w_mask] = k.head[k.ins_h], k.head[k.ins_h] = k.strstart), k.prev_length = k.match_length, k.prev_match = k.match_start, k.match_length = O - 1, j !== 0 && k.prev_length < k.max_lazy_match && k.strstart - j <= k.w_size - V && (k.match_length = X(k, j), k.match_length <= 5 && (k.strategy === 1 || k.match_length === O && 4096 < k.strstart - k.match_start) && (k.match_length = O - 1)), k.prev_length >= O && k.match_length <= k.prev_length) {
              for (C = k.strstart + k.lookahead - O, _ = l._tr_tally(k, k.strstart - 1 - k.prev_match, k.prev_length - O), k.lookahead -= k.prev_length - 1, k.prev_length -= 2; ++k.strstart <= C && (k.ins_h = (k.ins_h << k.hash_shift ^ k.window[k.strstart + O - 1]) & k.hash_mask, j = k.prev[k.strstart & k.w_mask] = k.head[k.ins_h], k.head[k.ins_h] = k.strstart), --k.prev_length != 0; ) ;
              if (k.match_available = 0, k.match_length = O - 1, k.strstart++, _ && (P(k, !1), k.strm.avail_out === 0)) return w;
            } else if (k.match_available) {
              if ((_ = l._tr_tally(k, 0, k.window[k.strstart - 1])) && P(k, !1), k.strstart++, k.lookahead--, k.strm.avail_out === 0) return w;
            } else k.match_available = 1, k.strstart++, k.lookahead--;
          }
          return k.match_available && (_ = l._tr_tally(k, 0, k.window[k.strstart - 1]), k.match_available = 0), k.insert = k.strstart < O - 1 ? k.strstart : O - 1, H === d ? (P(k, !0), k.strm.avail_out === 0 ? ie : U) : k.last_lit && (P(k, !1), k.strm.avail_out === 0) ? w : $;
        }
        function ye(k, H, j, _, C) {
          this.good_length = k, this.max_lazy = H, this.nice_length = j, this.max_chain = _, this.func = C;
        }
        function _e() {
          this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = b, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new o.Buf16(2 * M), this.dyn_dtree = new o.Buf16(2 * (2 * E + 1)), this.bl_tree = new o.Buf16(2 * (2 * v + 1)), I(this.dyn_ltree), I(this.dyn_dtree), I(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new o.Buf16(R + 1), this.heap = new o.Buf16(2 * A + 1), I(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new o.Buf16(2 * A + 1), I(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
        }
        function Ie(k) {
          var H;
          return k && k.state ? (k.total_in = k.total_out = 0, k.data_type = g, (H = k.state).pending = 0, H.pending_out = 0, H.wrap < 0 && (H.wrap = -H.wrap), H.status = H.wrap ? S : F, k.adler = H.wrap === 2 ? 0 : 1, H.last_flush = h, l._tr_init(H), f) : le(k, p);
        }
        function gt(k) {
          var H = Ie(k);
          return H === f && (function(j) {
            j.window_size = 2 * j.w_size, I(j.head), j.max_lazy_match = s[j.level].max_lazy, j.good_match = s[j.level].good_length, j.nice_match = s[j.level].nice_length, j.max_chain_length = s[j.level].max_chain, j.strstart = 0, j.block_start = 0, j.lookahead = 0, j.insert = 0, j.match_length = j.prev_length = O - 1, j.match_available = 0, j.ins_h = 0;
          })(k.state), H;
        }
        function lt(k, H, j, _, C, D) {
          if (!k) return p;
          var q = 1;
          if (H === m && (H = 6), _ < 0 ? (q = 0, _ = -_) : 15 < _ && (q = 2, _ -= 16), C < 1 || x < C || j !== b || _ < 8 || 15 < _ || H < 0 || 9 < H || D < 0 || y < D) return le(k, p);
          _ === 8 && (_ = 9);
          var G = new _e();
          return (k.state = G).strm = k, G.wrap = q, G.gzhead = null, G.w_bits = _, G.w_size = 1 << G.w_bits, G.w_mask = G.w_size - 1, G.hash_bits = C + 7, G.hash_size = 1 << G.hash_bits, G.hash_mask = G.hash_size - 1, G.hash_shift = ~~((G.hash_bits + O - 1) / O), G.window = new o.Buf8(2 * G.w_size), G.head = new o.Buf16(G.hash_size), G.prev = new o.Buf16(G.w_size), G.lit_bufsize = 1 << C + 6, G.pending_buf_size = 4 * G.lit_bufsize, G.pending_buf = new o.Buf8(G.pending_buf_size), G.d_buf = 1 * G.lit_bufsize, G.l_buf = 3 * G.lit_bufsize, G.level = H, G.strategy = D, G.method = j, gt(k);
        }
        s = [new ye(0, 0, 0, 0, function(k, H) {
          var j = 65535;
          for (j > k.pending_buf_size - 5 && (j = k.pending_buf_size - 5); ; ) {
            if (k.lookahead <= 1) {
              if (me(k), k.lookahead === 0 && H === h) return w;
              if (k.lookahead === 0) break;
            }
            k.strstart += k.lookahead, k.lookahead = 0;
            var _ = k.block_start + j;
            if ((k.strstart === 0 || k.strstart >= _) && (k.lookahead = k.strstart - _, k.strstart = _, P(k, !1), k.strm.avail_out === 0) || k.strstart - k.block_start >= k.w_size - V && (P(k, !1), k.strm.avail_out === 0)) return w;
          }
          return k.insert = 0, H === d ? (P(k, !0), k.strm.avail_out === 0 ? ie : U) : (k.strstart > k.block_start && (P(k, !1), k.strm.avail_out), w);
        }), new ye(4, 4, 8, 4, Oe), new ye(4, 5, 16, 8, Oe), new ye(4, 6, 32, 32, Oe), new ye(4, 4, 16, 16, de), new ye(8, 16, 32, 32, de), new ye(8, 16, 128, 128, de), new ye(8, 32, 128, 256, de), new ye(32, 128, 258, 1024, de), new ye(32, 258, 258, 4096, de)], i.deflateInit = function(k, H) {
          return lt(k, H, b, 15, 8, 0);
        }, i.deflateInit2 = lt, i.deflateReset = gt, i.deflateResetKeep = Ie, i.deflateSetHeader = function(k, H) {
          return k && k.state ? k.state.wrap !== 2 ? p : (k.state.gzhead = H, f) : p;
        }, i.deflate = function(k, H) {
          var j, _, C, D;
          if (!k || !k.state || 5 < H || H < 0) return k ? le(k, p) : p;
          if (_ = k.state, !k.output || !k.input && k.avail_in !== 0 || _.status === 666 && H !== d) return le(k, k.avail_out === 0 ? -5 : p);
          if (_.strm = k, j = _.last_flush, _.last_flush = H, _.status === S) if (_.wrap === 2) k.adler = 0, N(_, 31), N(_, 139), N(_, 8), _.gzhead ? (N(_, (_.gzhead.text ? 1 : 0) + (_.gzhead.hcrc ? 2 : 0) + (_.gzhead.extra ? 4 : 0) + (_.gzhead.name ? 8 : 0) + (_.gzhead.comment ? 16 : 0)), N(_, 255 & _.gzhead.time), N(_, _.gzhead.time >> 8 & 255), N(_, _.gzhead.time >> 16 & 255), N(_, _.gzhead.time >> 24 & 255), N(_, _.level === 9 ? 2 : 2 <= _.strategy || _.level < 2 ? 4 : 0), N(_, 255 & _.gzhead.os), _.gzhead.extra && _.gzhead.extra.length && (N(_, 255 & _.gzhead.extra.length), N(_, _.gzhead.extra.length >> 8 & 255)), _.gzhead.hcrc && (k.adler = u(k.adler, _.pending_buf, _.pending, 0)), _.gzindex = 0, _.status = 69) : (N(_, 0), N(_, 0), N(_, 0), N(_, 0), N(_, 0), N(_, _.level === 9 ? 2 : 2 <= _.strategy || _.level < 2 ? 4 : 0), N(_, 3), _.status = F);
          else {
            var q = b + (_.w_bits - 8 << 4) << 8;
            q |= (2 <= _.strategy || _.level < 2 ? 0 : _.level < 6 ? 1 : _.level === 6 ? 2 : 3) << 6, _.strstart !== 0 && (q |= 32), q += 31 - q % 31, _.status = F, ee(_, q), _.strstart !== 0 && (ee(_, k.adler >>> 16), ee(_, 65535 & k.adler)), k.adler = 1;
          }
          if (_.status === 69) if (_.gzhead.extra) {
            for (C = _.pending; _.gzindex < (65535 & _.gzhead.extra.length) && (_.pending !== _.pending_buf_size || (_.gzhead.hcrc && _.pending > C && (k.adler = u(k.adler, _.pending_buf, _.pending - C, C)), B(k), C = _.pending, _.pending !== _.pending_buf_size)); ) N(_, 255 & _.gzhead.extra[_.gzindex]), _.gzindex++;
            _.gzhead.hcrc && _.pending > C && (k.adler = u(k.adler, _.pending_buf, _.pending - C, C)), _.gzindex === _.gzhead.extra.length && (_.gzindex = 0, _.status = 73);
          } else _.status = 73;
          if (_.status === 73) if (_.gzhead.name) {
            C = _.pending;
            do {
              if (_.pending === _.pending_buf_size && (_.gzhead.hcrc && _.pending > C && (k.adler = u(k.adler, _.pending_buf, _.pending - C, C)), B(k), C = _.pending, _.pending === _.pending_buf_size)) {
                D = 1;
                break;
              }
              D = _.gzindex < _.gzhead.name.length ? 255 & _.gzhead.name.charCodeAt(_.gzindex++) : 0, N(_, D);
            } while (D !== 0);
            _.gzhead.hcrc && _.pending > C && (k.adler = u(k.adler, _.pending_buf, _.pending - C, C)), D === 0 && (_.gzindex = 0, _.status = 91);
          } else _.status = 91;
          if (_.status === 91) if (_.gzhead.comment) {
            C = _.pending;
            do {
              if (_.pending === _.pending_buf_size && (_.gzhead.hcrc && _.pending > C && (k.adler = u(k.adler, _.pending_buf, _.pending - C, C)), B(k), C = _.pending, _.pending === _.pending_buf_size)) {
                D = 1;
                break;
              }
              D = _.gzindex < _.gzhead.comment.length ? 255 & _.gzhead.comment.charCodeAt(_.gzindex++) : 0, N(_, D);
            } while (D !== 0);
            _.gzhead.hcrc && _.pending > C && (k.adler = u(k.adler, _.pending_buf, _.pending - C, C)), D === 0 && (_.status = 103);
          } else _.status = 103;
          if (_.status === 103 && (_.gzhead.hcrc ? (_.pending + 2 > _.pending_buf_size && B(k), _.pending + 2 <= _.pending_buf_size && (N(_, 255 & k.adler), N(_, k.adler >> 8 & 255), k.adler = 0, _.status = F)) : _.status = F), _.pending !== 0) {
            if (B(k), k.avail_out === 0) return _.last_flush = -1, f;
          } else if (k.avail_in === 0 && Z(H) <= Z(j) && H !== d) return le(k, -5);
          if (_.status === 666 && k.avail_in !== 0) return le(k, -5);
          if (k.avail_in !== 0 || _.lookahead !== 0 || H !== h && _.status !== 666) {
            var G = _.strategy === 2 ? (function(L, Y) {
              for (var re; ; ) {
                if (L.lookahead === 0 && (me(L), L.lookahead === 0)) {
                  if (Y === h) return w;
                  break;
                }
                if (L.match_length = 0, re = l._tr_tally(L, 0, L.window[L.strstart]), L.lookahead--, L.strstart++, re && (P(L, !1), L.strm.avail_out === 0)) return w;
              }
              return L.insert = 0, Y === d ? (P(L, !0), L.strm.avail_out === 0 ? ie : U) : L.last_lit && (P(L, !1), L.strm.avail_out === 0) ? w : $;
            })(_, H) : _.strategy === 3 ? (function(L, Y) {
              for (var re, Q, z, J, te = L.window; ; ) {
                if (L.lookahead <= T) {
                  if (me(L), L.lookahead <= T && Y === h) return w;
                  if (L.lookahead === 0) break;
                }
                if (L.match_length = 0, L.lookahead >= O && 0 < L.strstart && (Q = te[z = L.strstart - 1]) === te[++z] && Q === te[++z] && Q === te[++z]) {
                  J = L.strstart + T;
                  do
                    ;
                  while (Q === te[++z] && Q === te[++z] && Q === te[++z] && Q === te[++z] && Q === te[++z] && Q === te[++z] && Q === te[++z] && Q === te[++z] && z < J);
                  L.match_length = T - (J - z), L.match_length > L.lookahead && (L.match_length = L.lookahead);
                }
                if (L.match_length >= O ? (re = l._tr_tally(L, 1, L.match_length - O), L.lookahead -= L.match_length, L.strstart += L.match_length, L.match_length = 0) : (re = l._tr_tally(L, 0, L.window[L.strstart]), L.lookahead--, L.strstart++), re && (P(L, !1), L.strm.avail_out === 0)) return w;
              }
              return L.insert = 0, Y === d ? (P(L, !0), L.strm.avail_out === 0 ? ie : U) : L.last_lit && (P(L, !1), L.strm.avail_out === 0) ? w : $;
            })(_, H) : s[_.level].func(_, H);
            if (G !== ie && G !== U || (_.status = 666), G === w || G === ie) return k.avail_out === 0 && (_.last_flush = -1), f;
            if (G === $ && (H === 1 ? l._tr_align(_) : H !== 5 && (l._tr_stored_block(_, 0, 0, !1), H === 3 && (I(_.head), _.lookahead === 0 && (_.strstart = 0, _.block_start = 0, _.insert = 0))), B(k), k.avail_out === 0)) return _.last_flush = -1, f;
          }
          return H !== d ? f : _.wrap <= 0 ? 1 : (_.wrap === 2 ? (N(_, 255 & k.adler), N(_, k.adler >> 8 & 255), N(_, k.adler >> 16 & 255), N(_, k.adler >> 24 & 255), N(_, 255 & k.total_in), N(_, k.total_in >> 8 & 255), N(_, k.total_in >> 16 & 255), N(_, k.total_in >> 24 & 255)) : (ee(_, k.adler >>> 16), ee(_, 65535 & k.adler)), B(k), 0 < _.wrap && (_.wrap = -_.wrap), _.pending !== 0 ? f : 1);
        }, i.deflateEnd = function(k) {
          var H;
          return k && k.state ? (H = k.state.status) !== S && H !== 69 && H !== 73 && H !== 91 && H !== 103 && H !== F && H !== 666 ? le(k, p) : (k.state = null, H === F ? le(k, -3) : f) : p;
        }, i.deflateSetDictionary = function(k, H) {
          var j, _, C, D, q, G, L, Y, re = H.length;
          if (!k || !k.state || (D = (j = k.state).wrap) === 2 || D === 1 && j.status !== S || j.lookahead) return p;
          for (D === 1 && (k.adler = a(k.adler, H, re, 0)), j.wrap = 0, re >= j.w_size && (D === 0 && (I(j.head), j.strstart = 0, j.block_start = 0, j.insert = 0), Y = new o.Buf8(j.w_size), o.arraySet(Y, H, re - j.w_size, j.w_size, 0), H = Y, re = j.w_size), q = k.avail_in, G = k.next_in, L = k.input, k.avail_in = re, k.next_in = 0, k.input = H, me(j); j.lookahead >= O; ) {
            for (_ = j.strstart, C = j.lookahead - (O - 1); j.ins_h = (j.ins_h << j.hash_shift ^ j.window[_ + O - 1]) & j.hash_mask, j.prev[_ & j.w_mask] = j.head[j.ins_h], j.head[j.ins_h] = _, _++, --C; ) ;
            j.strstart = _, j.lookahead = O - 1, me(j);
          }
          return j.strstart += j.lookahead, j.block_start = j.strstart, j.insert = j.lookahead, j.lookahead = 0, j.match_length = j.prev_length = O - 1, j.match_available = 0, k.next_in = G, k.input = L, k.avail_in = q, j.wrap = D, f;
        }, i.deflateInfo = "pako deflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./messages": 51, "./trees": 52 }], 47: [function(n, r, i) {
        r.exports = function() {
          this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = !1;
        };
      }, {}], 48: [function(n, r, i) {
        r.exports = function(s, o) {
          var l, a, u, c, h, d, f, p, m, y, g, b, x, A, E, v, M, R, O, T, V, S, F, w, $;
          l = s.state, a = s.next_in, w = s.input, u = a + (s.avail_in - 5), c = s.next_out, $ = s.output, h = c - (o - s.avail_out), d = c + (s.avail_out - 257), f = l.dmax, p = l.wsize, m = l.whave, y = l.wnext, g = l.window, b = l.hold, x = l.bits, A = l.lencode, E = l.distcode, v = (1 << l.lenbits) - 1, M = (1 << l.distbits) - 1;
          e: do {
            x < 15 && (b += w[a++] << x, x += 8, b += w[a++] << x, x += 8), R = A[b & v];
            t: for (; ; ) {
              if (b >>>= O = R >>> 24, x -= O, (O = R >>> 16 & 255) === 0) $[c++] = 65535 & R;
              else {
                if (!(16 & O)) {
                  if ((64 & O) == 0) {
                    R = A[(65535 & R) + (b & (1 << O) - 1)];
                    continue t;
                  }
                  if (32 & O) {
                    l.mode = 12;
                    break e;
                  }
                  s.msg = "invalid literal/length code", l.mode = 30;
                  break e;
                }
                T = 65535 & R, (O &= 15) && (x < O && (b += w[a++] << x, x += 8), T += b & (1 << O) - 1, b >>>= O, x -= O), x < 15 && (b += w[a++] << x, x += 8, b += w[a++] << x, x += 8), R = E[b & M];
                n: for (; ; ) {
                  if (b >>>= O = R >>> 24, x -= O, !(16 & (O = R >>> 16 & 255))) {
                    if ((64 & O) == 0) {
                      R = E[(65535 & R) + (b & (1 << O) - 1)];
                      continue n;
                    }
                    s.msg = "invalid distance code", l.mode = 30;
                    break e;
                  }
                  if (V = 65535 & R, x < (O &= 15) && (b += w[a++] << x, (x += 8) < O && (b += w[a++] << x, x += 8)), f < (V += b & (1 << O) - 1)) {
                    s.msg = "invalid distance too far back", l.mode = 30;
                    break e;
                  }
                  if (b >>>= O, x -= O, (O = c - h) < V) {
                    if (m < (O = V - O) && l.sane) {
                      s.msg = "invalid distance too far back", l.mode = 30;
                      break e;
                    }
                    if (F = g, (S = 0) === y) {
                      if (S += p - O, O < T) {
                        for (T -= O; $[c++] = g[S++], --O; ) ;
                        S = c - V, F = $;
                      }
                    } else if (y < O) {
                      if (S += p + y - O, (O -= y) < T) {
                        for (T -= O; $[c++] = g[S++], --O; ) ;
                        if (S = 0, y < T) {
                          for (T -= O = y; $[c++] = g[S++], --O; ) ;
                          S = c - V, F = $;
                        }
                      }
                    } else if (S += y - O, O < T) {
                      for (T -= O; $[c++] = g[S++], --O; ) ;
                      S = c - V, F = $;
                    }
                    for (; 2 < T; ) $[c++] = F[S++], $[c++] = F[S++], $[c++] = F[S++], T -= 3;
                    T && ($[c++] = F[S++], 1 < T && ($[c++] = F[S++]));
                  } else {
                    for (S = c - V; $[c++] = $[S++], $[c++] = $[S++], $[c++] = $[S++], 2 < (T -= 3); ) ;
                    T && ($[c++] = $[S++], 1 < T && ($[c++] = $[S++]));
                  }
                  break;
                }
              }
              break;
            }
          } while (a < u && c < d);
          a -= T = x >> 3, b &= (1 << (x -= T << 3)) - 1, s.next_in = a, s.next_out = c, s.avail_in = a < u ? u - a + 5 : 5 - (a - u), s.avail_out = c < d ? d - c + 257 : 257 - (c - d), l.hold = b, l.bits = x;
        };
      }, {}], 49: [function(n, r, i) {
        var s = n("../utils/common"), o = n("./adler32"), l = n("./crc32"), a = n("./inffast"), u = n("./inftrees"), c = 1, h = 2, d = 0, f = -2, p = 1, m = 852, y = 592;
        function g(S) {
          return (S >>> 24 & 255) + (S >>> 8 & 65280) + ((65280 & S) << 8) + ((255 & S) << 24);
        }
        function b() {
          this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new s.Buf16(320), this.work = new s.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
        }
        function x(S) {
          var F;
          return S && S.state ? (F = S.state, S.total_in = S.total_out = F.total = 0, S.msg = "", F.wrap && (S.adler = 1 & F.wrap), F.mode = p, F.last = 0, F.havedict = 0, F.dmax = 32768, F.head = null, F.hold = 0, F.bits = 0, F.lencode = F.lendyn = new s.Buf32(m), F.distcode = F.distdyn = new s.Buf32(y), F.sane = 1, F.back = -1, d) : f;
        }
        function A(S) {
          var F;
          return S && S.state ? ((F = S.state).wsize = 0, F.whave = 0, F.wnext = 0, x(S)) : f;
        }
        function E(S, F) {
          var w, $;
          return S && S.state ? ($ = S.state, F < 0 ? (w = 0, F = -F) : (w = 1 + (F >> 4), F < 48 && (F &= 15)), F && (F < 8 || 15 < F) ? f : ($.window !== null && $.wbits !== F && ($.window = null), $.wrap = w, $.wbits = F, A(S))) : f;
        }
        function v(S, F) {
          var w, $;
          return S ? ($ = new b(), (S.state = $).window = null, (w = E(S, F)) !== d && (S.state = null), w) : f;
        }
        var M, R, O = !0;
        function T(S) {
          if (O) {
            var F;
            for (M = new s.Buf32(512), R = new s.Buf32(32), F = 0; F < 144; ) S.lens[F++] = 8;
            for (; F < 256; ) S.lens[F++] = 9;
            for (; F < 280; ) S.lens[F++] = 7;
            for (; F < 288; ) S.lens[F++] = 8;
            for (u(c, S.lens, 0, 288, M, 0, S.work, { bits: 9 }), F = 0; F < 32; ) S.lens[F++] = 5;
            u(h, S.lens, 0, 32, R, 0, S.work, { bits: 5 }), O = !1;
          }
          S.lencode = M, S.lenbits = 9, S.distcode = R, S.distbits = 5;
        }
        function V(S, F, w, $) {
          var ie, U = S.state;
          return U.window === null && (U.wsize = 1 << U.wbits, U.wnext = 0, U.whave = 0, U.window = new s.Buf8(U.wsize)), $ >= U.wsize ? (s.arraySet(U.window, F, w - U.wsize, U.wsize, 0), U.wnext = 0, U.whave = U.wsize) : ($ < (ie = U.wsize - U.wnext) && (ie = $), s.arraySet(U.window, F, w - $, ie, U.wnext), ($ -= ie) ? (s.arraySet(U.window, F, w - $, $, 0), U.wnext = $, U.whave = U.wsize) : (U.wnext += ie, U.wnext === U.wsize && (U.wnext = 0), U.whave < U.wsize && (U.whave += ie))), 0;
        }
        i.inflateReset = A, i.inflateReset2 = E, i.inflateResetKeep = x, i.inflateInit = function(S) {
          return v(S, 15);
        }, i.inflateInit2 = v, i.inflate = function(S, F) {
          var w, $, ie, U, le, Z, I, B, P, N, ee, X, me, Oe, de, ye, _e, Ie, gt, lt, k, H, j, _, C = 0, D = new s.Buf8(4), q = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
          if (!S || !S.state || !S.output || !S.input && S.avail_in !== 0) return f;
          (w = S.state).mode === 12 && (w.mode = 13), le = S.next_out, ie = S.output, I = S.avail_out, U = S.next_in, $ = S.input, Z = S.avail_in, B = w.hold, P = w.bits, N = Z, ee = I, H = d;
          e: for (; ; ) switch (w.mode) {
            case p:
              if (w.wrap === 0) {
                w.mode = 13;
                break;
              }
              for (; P < 16; ) {
                if (Z === 0) break e;
                Z--, B += $[U++] << P, P += 8;
              }
              if (2 & w.wrap && B === 35615) {
                D[w.check = 0] = 255 & B, D[1] = B >>> 8 & 255, w.check = l(w.check, D, 2, 0), P = B = 0, w.mode = 2;
                break;
              }
              if (w.flags = 0, w.head && (w.head.done = !1), !(1 & w.wrap) || (((255 & B) << 8) + (B >> 8)) % 31) {
                S.msg = "incorrect header check", w.mode = 30;
                break;
              }
              if ((15 & B) != 8) {
                S.msg = "unknown compression method", w.mode = 30;
                break;
              }
              if (P -= 4, k = 8 + (15 & (B >>>= 4)), w.wbits === 0) w.wbits = k;
              else if (k > w.wbits) {
                S.msg = "invalid window size", w.mode = 30;
                break;
              }
              w.dmax = 1 << k, S.adler = w.check = 1, w.mode = 512 & B ? 10 : 12, P = B = 0;
              break;
            case 2:
              for (; P < 16; ) {
                if (Z === 0) break e;
                Z--, B += $[U++] << P, P += 8;
              }
              if (w.flags = B, (255 & w.flags) != 8) {
                S.msg = "unknown compression method", w.mode = 30;
                break;
              }
              if (57344 & w.flags) {
                S.msg = "unknown header flags set", w.mode = 30;
                break;
              }
              w.head && (w.head.text = B >> 8 & 1), 512 & w.flags && (D[0] = 255 & B, D[1] = B >>> 8 & 255, w.check = l(w.check, D, 2, 0)), P = B = 0, w.mode = 3;
            case 3:
              for (; P < 32; ) {
                if (Z === 0) break e;
                Z--, B += $[U++] << P, P += 8;
              }
              w.head && (w.head.time = B), 512 & w.flags && (D[0] = 255 & B, D[1] = B >>> 8 & 255, D[2] = B >>> 16 & 255, D[3] = B >>> 24 & 255, w.check = l(w.check, D, 4, 0)), P = B = 0, w.mode = 4;
            case 4:
              for (; P < 16; ) {
                if (Z === 0) break e;
                Z--, B += $[U++] << P, P += 8;
              }
              w.head && (w.head.xflags = 255 & B, w.head.os = B >> 8), 512 & w.flags && (D[0] = 255 & B, D[1] = B >>> 8 & 255, w.check = l(w.check, D, 2, 0)), P = B = 0, w.mode = 5;
            case 5:
              if (1024 & w.flags) {
                for (; P < 16; ) {
                  if (Z === 0) break e;
                  Z--, B += $[U++] << P, P += 8;
                }
                w.length = B, w.head && (w.head.extra_len = B), 512 & w.flags && (D[0] = 255 & B, D[1] = B >>> 8 & 255, w.check = l(w.check, D, 2, 0)), P = B = 0;
              } else w.head && (w.head.extra = null);
              w.mode = 6;
            case 6:
              if (1024 & w.flags && (Z < (X = w.length) && (X = Z), X && (w.head && (k = w.head.extra_len - w.length, w.head.extra || (w.head.extra = new Array(w.head.extra_len)), s.arraySet(w.head.extra, $, U, X, k)), 512 & w.flags && (w.check = l(w.check, $, X, U)), Z -= X, U += X, w.length -= X), w.length)) break e;
              w.length = 0, w.mode = 7;
            case 7:
              if (2048 & w.flags) {
                if (Z === 0) break e;
                for (X = 0; k = $[U + X++], w.head && k && w.length < 65536 && (w.head.name += String.fromCharCode(k)), k && X < Z; ) ;
                if (512 & w.flags && (w.check = l(w.check, $, X, U)), Z -= X, U += X, k) break e;
              } else w.head && (w.head.name = null);
              w.length = 0, w.mode = 8;
            case 8:
              if (4096 & w.flags) {
                if (Z === 0) break e;
                for (X = 0; k = $[U + X++], w.head && k && w.length < 65536 && (w.head.comment += String.fromCharCode(k)), k && X < Z; ) ;
                if (512 & w.flags && (w.check = l(w.check, $, X, U)), Z -= X, U += X, k) break e;
              } else w.head && (w.head.comment = null);
              w.mode = 9;
            case 9:
              if (512 & w.flags) {
                for (; P < 16; ) {
                  if (Z === 0) break e;
                  Z--, B += $[U++] << P, P += 8;
                }
                if (B !== (65535 & w.check)) {
                  S.msg = "header crc mismatch", w.mode = 30;
                  break;
                }
                P = B = 0;
              }
              w.head && (w.head.hcrc = w.flags >> 9 & 1, w.head.done = !0), S.adler = w.check = 0, w.mode = 12;
              break;
            case 10:
              for (; P < 32; ) {
                if (Z === 0) break e;
                Z--, B += $[U++] << P, P += 8;
              }
              S.adler = w.check = g(B), P = B = 0, w.mode = 11;
            case 11:
              if (w.havedict === 0) return S.next_out = le, S.avail_out = I, S.next_in = U, S.avail_in = Z, w.hold = B, w.bits = P, 2;
              S.adler = w.check = 1, w.mode = 12;
            case 12:
              if (F === 5 || F === 6) break e;
            case 13:
              if (w.last) {
                B >>>= 7 & P, P -= 7 & P, w.mode = 27;
                break;
              }
              for (; P < 3; ) {
                if (Z === 0) break e;
                Z--, B += $[U++] << P, P += 8;
              }
              switch (w.last = 1 & B, P -= 1, 3 & (B >>>= 1)) {
                case 0:
                  w.mode = 14;
                  break;
                case 1:
                  if (T(w), w.mode = 20, F !== 6) break;
                  B >>>= 2, P -= 2;
                  break e;
                case 2:
                  w.mode = 17;
                  break;
                case 3:
                  S.msg = "invalid block type", w.mode = 30;
              }
              B >>>= 2, P -= 2;
              break;
            case 14:
              for (B >>>= 7 & P, P -= 7 & P; P < 32; ) {
                if (Z === 0) break e;
                Z--, B += $[U++] << P, P += 8;
              }
              if ((65535 & B) != (B >>> 16 ^ 65535)) {
                S.msg = "invalid stored block lengths", w.mode = 30;
                break;
              }
              if (w.length = 65535 & B, P = B = 0, w.mode = 15, F === 6) break e;
            case 15:
              w.mode = 16;
            case 16:
              if (X = w.length) {
                if (Z < X && (X = Z), I < X && (X = I), X === 0) break e;
                s.arraySet(ie, $, U, X, le), Z -= X, U += X, I -= X, le += X, w.length -= X;
                break;
              }
              w.mode = 12;
              break;
            case 17:
              for (; P < 14; ) {
                if (Z === 0) break e;
                Z--, B += $[U++] << P, P += 8;
              }
              if (w.nlen = 257 + (31 & B), B >>>= 5, P -= 5, w.ndist = 1 + (31 & B), B >>>= 5, P -= 5, w.ncode = 4 + (15 & B), B >>>= 4, P -= 4, 286 < w.nlen || 30 < w.ndist) {
                S.msg = "too many length or distance symbols", w.mode = 30;
                break;
              }
              w.have = 0, w.mode = 18;
            case 18:
              for (; w.have < w.ncode; ) {
                for (; P < 3; ) {
                  if (Z === 0) break e;
                  Z--, B += $[U++] << P, P += 8;
                }
                w.lens[q[w.have++]] = 7 & B, B >>>= 3, P -= 3;
              }
              for (; w.have < 19; ) w.lens[q[w.have++]] = 0;
              if (w.lencode = w.lendyn, w.lenbits = 7, j = { bits: w.lenbits }, H = u(0, w.lens, 0, 19, w.lencode, 0, w.work, j), w.lenbits = j.bits, H) {
                S.msg = "invalid code lengths set", w.mode = 30;
                break;
              }
              w.have = 0, w.mode = 19;
            case 19:
              for (; w.have < w.nlen + w.ndist; ) {
                for (; ye = (C = w.lencode[B & (1 << w.lenbits) - 1]) >>> 16 & 255, _e = 65535 & C, !((de = C >>> 24) <= P); ) {
                  if (Z === 0) break e;
                  Z--, B += $[U++] << P, P += 8;
                }
                if (_e < 16) B >>>= de, P -= de, w.lens[w.have++] = _e;
                else {
                  if (_e === 16) {
                    for (_ = de + 2; P < _; ) {
                      if (Z === 0) break e;
                      Z--, B += $[U++] << P, P += 8;
                    }
                    if (B >>>= de, P -= de, w.have === 0) {
                      S.msg = "invalid bit length repeat", w.mode = 30;
                      break;
                    }
                    k = w.lens[w.have - 1], X = 3 + (3 & B), B >>>= 2, P -= 2;
                  } else if (_e === 17) {
                    for (_ = de + 3; P < _; ) {
                      if (Z === 0) break e;
                      Z--, B += $[U++] << P, P += 8;
                    }
                    P -= de, k = 0, X = 3 + (7 & (B >>>= de)), B >>>= 3, P -= 3;
                  } else {
                    for (_ = de + 7; P < _; ) {
                      if (Z === 0) break e;
                      Z--, B += $[U++] << P, P += 8;
                    }
                    P -= de, k = 0, X = 11 + (127 & (B >>>= de)), B >>>= 7, P -= 7;
                  }
                  if (w.have + X > w.nlen + w.ndist) {
                    S.msg = "invalid bit length repeat", w.mode = 30;
                    break;
                  }
                  for (; X--; ) w.lens[w.have++] = k;
                }
              }
              if (w.mode === 30) break;
              if (w.lens[256] === 0) {
                S.msg = "invalid code -- missing end-of-block", w.mode = 30;
                break;
              }
              if (w.lenbits = 9, j = { bits: w.lenbits }, H = u(c, w.lens, 0, w.nlen, w.lencode, 0, w.work, j), w.lenbits = j.bits, H) {
                S.msg = "invalid literal/lengths set", w.mode = 30;
                break;
              }
              if (w.distbits = 6, w.distcode = w.distdyn, j = { bits: w.distbits }, H = u(h, w.lens, w.nlen, w.ndist, w.distcode, 0, w.work, j), w.distbits = j.bits, H) {
                S.msg = "invalid distances set", w.mode = 30;
                break;
              }
              if (w.mode = 20, F === 6) break e;
            case 20:
              w.mode = 21;
            case 21:
              if (6 <= Z && 258 <= I) {
                S.next_out = le, S.avail_out = I, S.next_in = U, S.avail_in = Z, w.hold = B, w.bits = P, a(S, ee), le = S.next_out, ie = S.output, I = S.avail_out, U = S.next_in, $ = S.input, Z = S.avail_in, B = w.hold, P = w.bits, w.mode === 12 && (w.back = -1);
                break;
              }
              for (w.back = 0; ye = (C = w.lencode[B & (1 << w.lenbits) - 1]) >>> 16 & 255, _e = 65535 & C, !((de = C >>> 24) <= P); ) {
                if (Z === 0) break e;
                Z--, B += $[U++] << P, P += 8;
              }
              if (ye && (240 & ye) == 0) {
                for (Ie = de, gt = ye, lt = _e; ye = (C = w.lencode[lt + ((B & (1 << Ie + gt) - 1) >> Ie)]) >>> 16 & 255, _e = 65535 & C, !(Ie + (de = C >>> 24) <= P); ) {
                  if (Z === 0) break e;
                  Z--, B += $[U++] << P, P += 8;
                }
                B >>>= Ie, P -= Ie, w.back += Ie;
              }
              if (B >>>= de, P -= de, w.back += de, w.length = _e, ye === 0) {
                w.mode = 26;
                break;
              }
              if (32 & ye) {
                w.back = -1, w.mode = 12;
                break;
              }
              if (64 & ye) {
                S.msg = "invalid literal/length code", w.mode = 30;
                break;
              }
              w.extra = 15 & ye, w.mode = 22;
            case 22:
              if (w.extra) {
                for (_ = w.extra; P < _; ) {
                  if (Z === 0) break e;
                  Z--, B += $[U++] << P, P += 8;
                }
                w.length += B & (1 << w.extra) - 1, B >>>= w.extra, P -= w.extra, w.back += w.extra;
              }
              w.was = w.length, w.mode = 23;
            case 23:
              for (; ye = (C = w.distcode[B & (1 << w.distbits) - 1]) >>> 16 & 255, _e = 65535 & C, !((de = C >>> 24) <= P); ) {
                if (Z === 0) break e;
                Z--, B += $[U++] << P, P += 8;
              }
              if ((240 & ye) == 0) {
                for (Ie = de, gt = ye, lt = _e; ye = (C = w.distcode[lt + ((B & (1 << Ie + gt) - 1) >> Ie)]) >>> 16 & 255, _e = 65535 & C, !(Ie + (de = C >>> 24) <= P); ) {
                  if (Z === 0) break e;
                  Z--, B += $[U++] << P, P += 8;
                }
                B >>>= Ie, P -= Ie, w.back += Ie;
              }
              if (B >>>= de, P -= de, w.back += de, 64 & ye) {
                S.msg = "invalid distance code", w.mode = 30;
                break;
              }
              w.offset = _e, w.extra = 15 & ye, w.mode = 24;
            case 24:
              if (w.extra) {
                for (_ = w.extra; P < _; ) {
                  if (Z === 0) break e;
                  Z--, B += $[U++] << P, P += 8;
                }
                w.offset += B & (1 << w.extra) - 1, B >>>= w.extra, P -= w.extra, w.back += w.extra;
              }
              if (w.offset > w.dmax) {
                S.msg = "invalid distance too far back", w.mode = 30;
                break;
              }
              w.mode = 25;
            case 25:
              if (I === 0) break e;
              if (X = ee - I, w.offset > X) {
                if ((X = w.offset - X) > w.whave && w.sane) {
                  S.msg = "invalid distance too far back", w.mode = 30;
                  break;
                }
                me = X > w.wnext ? (X -= w.wnext, w.wsize - X) : w.wnext - X, X > w.length && (X = w.length), Oe = w.window;
              } else Oe = ie, me = le - w.offset, X = w.length;
              for (I < X && (X = I), I -= X, w.length -= X; ie[le++] = Oe[me++], --X; ) ;
              w.length === 0 && (w.mode = 21);
              break;
            case 26:
              if (I === 0) break e;
              ie[le++] = w.length, I--, w.mode = 21;
              break;
            case 27:
              if (w.wrap) {
                for (; P < 32; ) {
                  if (Z === 0) break e;
                  Z--, B |= $[U++] << P, P += 8;
                }
                if (ee -= I, S.total_out += ee, w.total += ee, ee && (S.adler = w.check = w.flags ? l(w.check, ie, ee, le - ee) : o(w.check, ie, ee, le - ee)), ee = I, (w.flags ? B : g(B)) !== w.check) {
                  S.msg = "incorrect data check", w.mode = 30;
                  break;
                }
                P = B = 0;
              }
              w.mode = 28;
            case 28:
              if (w.wrap && w.flags) {
                for (; P < 32; ) {
                  if (Z === 0) break e;
                  Z--, B += $[U++] << P, P += 8;
                }
                if (B !== (4294967295 & w.total)) {
                  S.msg = "incorrect length check", w.mode = 30;
                  break;
                }
                P = B = 0;
              }
              w.mode = 29;
            case 29:
              H = 1;
              break e;
            case 30:
              H = -3;
              break e;
            case 31:
              return -4;
            default:
              return f;
          }
          return S.next_out = le, S.avail_out = I, S.next_in = U, S.avail_in = Z, w.hold = B, w.bits = P, (w.wsize || ee !== S.avail_out && w.mode < 30 && (w.mode < 27 || F !== 4)) && V(S, S.output, S.next_out, ee - S.avail_out) ? (w.mode = 31, -4) : (N -= S.avail_in, ee -= S.avail_out, S.total_in += N, S.total_out += ee, w.total += ee, w.wrap && ee && (S.adler = w.check = w.flags ? l(w.check, ie, ee, S.next_out - ee) : o(w.check, ie, ee, S.next_out - ee)), S.data_type = w.bits + (w.last ? 64 : 0) + (w.mode === 12 ? 128 : 0) + (w.mode === 20 || w.mode === 15 ? 256 : 0), (N == 0 && ee === 0 || F === 4) && H === d && (H = -5), H);
        }, i.inflateEnd = function(S) {
          if (!S || !S.state) return f;
          var F = S.state;
          return F.window && (F.window = null), S.state = null, d;
        }, i.inflateGetHeader = function(S, F) {
          var w;
          return S && S.state ? (2 & (w = S.state).wrap) == 0 ? f : ((w.head = F).done = !1, d) : f;
        }, i.inflateSetDictionary = function(S, F) {
          var w, $ = F.length;
          return S && S.state ? (w = S.state).wrap !== 0 && w.mode !== 11 ? f : w.mode === 11 && o(1, F, $, 0) !== w.check ? -3 : V(S, F, $, $) ? (w.mode = 31, -4) : (w.havedict = 1, d) : f;
        }, i.inflateInfo = "pako inflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./inffast": 48, "./inftrees": 50 }], 50: [function(n, r, i) {
        var s = n("../utils/common"), o = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], l = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], a = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0], u = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
        r.exports = function(c, h, d, f, p, m, y, g) {
          var b, x, A, E, v, M, R, O, T, V = g.bits, S = 0, F = 0, w = 0, $ = 0, ie = 0, U = 0, le = 0, Z = 0, I = 0, B = 0, P = null, N = 0, ee = new s.Buf16(16), X = new s.Buf16(16), me = null, Oe = 0;
          for (S = 0; S <= 15; S++) ee[S] = 0;
          for (F = 0; F < f; F++) ee[h[d + F]]++;
          for (ie = V, $ = 15; 1 <= $ && ee[$] === 0; $--) ;
          if ($ < ie && (ie = $), $ === 0) return p[m++] = 20971520, p[m++] = 20971520, g.bits = 1, 0;
          for (w = 1; w < $ && ee[w] === 0; w++) ;
          for (ie < w && (ie = w), S = Z = 1; S <= 15; S++) if (Z <<= 1, (Z -= ee[S]) < 0) return -1;
          if (0 < Z && (c === 0 || $ !== 1)) return -1;
          for (X[1] = 0, S = 1; S < 15; S++) X[S + 1] = X[S] + ee[S];
          for (F = 0; F < f; F++) h[d + F] !== 0 && (y[X[h[d + F]]++] = F);
          if (M = c === 0 ? (P = me = y, 19) : c === 1 ? (P = o, N -= 257, me = l, Oe -= 257, 256) : (P = a, me = u, -1), S = w, v = m, le = F = B = 0, A = -1, E = (I = 1 << (U = ie)) - 1, c === 1 && 852 < I || c === 2 && 592 < I) return 1;
          for (; ; ) {
            for (R = S - le, T = y[F] < M ? (O = 0, y[F]) : y[F] > M ? (O = me[Oe + y[F]], P[N + y[F]]) : (O = 96, 0), b = 1 << S - le, w = x = 1 << U; p[v + (B >> le) + (x -= b)] = R << 24 | O << 16 | T | 0, x !== 0; ) ;
            for (b = 1 << S - 1; B & b; ) b >>= 1;
            if (b !== 0 ? (B &= b - 1, B += b) : B = 0, F++, --ee[S] == 0) {
              if (S === $) break;
              S = h[d + y[F]];
            }
            if (ie < S && (B & E) !== A) {
              for (le === 0 && (le = ie), v += w, Z = 1 << (U = S - le); U + le < $ && !((Z -= ee[U + le]) <= 0); ) U++, Z <<= 1;
              if (I += 1 << U, c === 1 && 852 < I || c === 2 && 592 < I) return 1;
              p[A = B & E] = ie << 24 | U << 16 | v - m | 0;
            }
          }
          return B !== 0 && (p[v + B] = S - le << 24 | 64 << 16 | 0), g.bits = ie, 0;
        };
      }, { "../utils/common": 41 }], 51: [function(n, r, i) {
        r.exports = { 2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version" };
      }, {}], 52: [function(n, r, i) {
        var s = n("../utils/common"), o = 0, l = 1;
        function a(C) {
          for (var D = C.length; 0 <= --D; ) C[D] = 0;
        }
        var u = 0, c = 29, h = 256, d = h + 1 + c, f = 30, p = 19, m = 2 * d + 1, y = 15, g = 16, b = 7, x = 256, A = 16, E = 17, v = 18, M = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0], R = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13], O = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7], T = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], V = new Array(2 * (d + 2));
        a(V);
        var S = new Array(2 * f);
        a(S);
        var F = new Array(512);
        a(F);
        var w = new Array(256);
        a(w);
        var $ = new Array(c);
        a($);
        var ie, U, le, Z = new Array(f);
        function I(C, D, q, G, L) {
          this.static_tree = C, this.extra_bits = D, this.extra_base = q, this.elems = G, this.max_length = L, this.has_stree = C && C.length;
        }
        function B(C, D) {
          this.dyn_tree = C, this.max_code = 0, this.stat_desc = D;
        }
        function P(C) {
          return C < 256 ? F[C] : F[256 + (C >>> 7)];
        }
        function N(C, D) {
          C.pending_buf[C.pending++] = 255 & D, C.pending_buf[C.pending++] = D >>> 8 & 255;
        }
        function ee(C, D, q) {
          C.bi_valid > g - q ? (C.bi_buf |= D << C.bi_valid & 65535, N(C, C.bi_buf), C.bi_buf = D >> g - C.bi_valid, C.bi_valid += q - g) : (C.bi_buf |= D << C.bi_valid & 65535, C.bi_valid += q);
        }
        function X(C, D, q) {
          ee(C, q[2 * D], q[2 * D + 1]);
        }
        function me(C, D) {
          for (var q = 0; q |= 1 & C, C >>>= 1, q <<= 1, 0 < --D; ) ;
          return q >>> 1;
        }
        function Oe(C, D, q) {
          var G, L, Y = new Array(y + 1), re = 0;
          for (G = 1; G <= y; G++) Y[G] = re = re + q[G - 1] << 1;
          for (L = 0; L <= D; L++) {
            var Q = C[2 * L + 1];
            Q !== 0 && (C[2 * L] = me(Y[Q]++, Q));
          }
        }
        function de(C) {
          var D;
          for (D = 0; D < d; D++) C.dyn_ltree[2 * D] = 0;
          for (D = 0; D < f; D++) C.dyn_dtree[2 * D] = 0;
          for (D = 0; D < p; D++) C.bl_tree[2 * D] = 0;
          C.dyn_ltree[2 * x] = 1, C.opt_len = C.static_len = 0, C.last_lit = C.matches = 0;
        }
        function ye(C) {
          8 < C.bi_valid ? N(C, C.bi_buf) : 0 < C.bi_valid && (C.pending_buf[C.pending++] = C.bi_buf), C.bi_buf = 0, C.bi_valid = 0;
        }
        function _e(C, D, q, G) {
          var L = 2 * D, Y = 2 * q;
          return C[L] < C[Y] || C[L] === C[Y] && G[D] <= G[q];
        }
        function Ie(C, D, q) {
          for (var G = C.heap[q], L = q << 1; L <= C.heap_len && (L < C.heap_len && _e(D, C.heap[L + 1], C.heap[L], C.depth) && L++, !_e(D, G, C.heap[L], C.depth)); ) C.heap[q] = C.heap[L], q = L, L <<= 1;
          C.heap[q] = G;
        }
        function gt(C, D, q) {
          var G, L, Y, re, Q = 0;
          if (C.last_lit !== 0) for (; G = C.pending_buf[C.d_buf + 2 * Q] << 8 | C.pending_buf[C.d_buf + 2 * Q + 1], L = C.pending_buf[C.l_buf + Q], Q++, G === 0 ? X(C, L, D) : (X(C, (Y = w[L]) + h + 1, D), (re = M[Y]) !== 0 && ee(C, L -= $[Y], re), X(C, Y = P(--G), q), (re = R[Y]) !== 0 && ee(C, G -= Z[Y], re)), Q < C.last_lit; ) ;
          X(C, x, D);
        }
        function lt(C, D) {
          var q, G, L, Y = D.dyn_tree, re = D.stat_desc.static_tree, Q = D.stat_desc.has_stree, z = D.stat_desc.elems, J = -1;
          for (C.heap_len = 0, C.heap_max = m, q = 0; q < z; q++) Y[2 * q] !== 0 ? (C.heap[++C.heap_len] = J = q, C.depth[q] = 0) : Y[2 * q + 1] = 0;
          for (; C.heap_len < 2; ) Y[2 * (L = C.heap[++C.heap_len] = J < 2 ? ++J : 0)] = 1, C.depth[L] = 0, C.opt_len--, Q && (C.static_len -= re[2 * L + 1]);
          for (D.max_code = J, q = C.heap_len >> 1; 1 <= q; q--) Ie(C, Y, q);
          for (L = z; q = C.heap[1], C.heap[1] = C.heap[C.heap_len--], Ie(C, Y, 1), G = C.heap[1], C.heap[--C.heap_max] = q, C.heap[--C.heap_max] = G, Y[2 * L] = Y[2 * q] + Y[2 * G], C.depth[L] = (C.depth[q] >= C.depth[G] ? C.depth[q] : C.depth[G]) + 1, Y[2 * q + 1] = Y[2 * G + 1] = L, C.heap[1] = L++, Ie(C, Y, 1), 2 <= C.heap_len; ) ;
          C.heap[--C.heap_max] = C.heap[1], (function(te, ue) {
            var we, De, at, Ce, Ot, jt, Ee = ue.dyn_tree, Vt = ue.max_code, It = ue.stat_desc.static_tree, Fm = ue.stat_desc.has_stree, $m = ue.stat_desc.extra_bits, hu = ue.stat_desc.extra_base, br = ue.stat_desc.max_length, wi = 0;
            for (Ce = 0; Ce <= y; Ce++) te.bl_count[Ce] = 0;
            for (Ee[2 * te.heap[te.heap_max] + 1] = 0, we = te.heap_max + 1; we < m; we++) br < (Ce = Ee[2 * Ee[2 * (De = te.heap[we]) + 1] + 1] + 1) && (Ce = br, wi++), Ee[2 * De + 1] = Ce, Vt < De || (te.bl_count[Ce]++, Ot = 0, hu <= De && (Ot = $m[De - hu]), jt = Ee[2 * De], te.opt_len += jt * (Ce + Ot), Fm && (te.static_len += jt * (It[2 * De + 1] + Ot)));
            if (wi !== 0) {
              do {
                for (Ce = br - 1; te.bl_count[Ce] === 0; ) Ce--;
                te.bl_count[Ce]--, te.bl_count[Ce + 1] += 2, te.bl_count[br]--, wi -= 2;
              } while (0 < wi);
              for (Ce = br; Ce !== 0; Ce--) for (De = te.bl_count[Ce]; De !== 0; ) Vt < (at = te.heap[--we]) || (Ee[2 * at + 1] !== Ce && (te.opt_len += (Ce - Ee[2 * at + 1]) * Ee[2 * at], Ee[2 * at + 1] = Ce), De--);
            }
          })(C, D), Oe(Y, J, C.bl_count);
        }
        function k(C, D, q) {
          var G, L, Y = -1, re = D[1], Q = 0, z = 7, J = 4;
          for (re === 0 && (z = 138, J = 3), D[2 * (q + 1) + 1] = 65535, G = 0; G <= q; G++) L = re, re = D[2 * (G + 1) + 1], ++Q < z && L === re || (Q < J ? C.bl_tree[2 * L] += Q : L !== 0 ? (L !== Y && C.bl_tree[2 * L]++, C.bl_tree[2 * A]++) : Q <= 10 ? C.bl_tree[2 * E]++ : C.bl_tree[2 * v]++, Y = L, J = (Q = 0) === re ? (z = 138, 3) : L === re ? (z = 6, 3) : (z = 7, 4));
        }
        function H(C, D, q) {
          var G, L, Y = -1, re = D[1], Q = 0, z = 7, J = 4;
          for (re === 0 && (z = 138, J = 3), G = 0; G <= q; G++) if (L = re, re = D[2 * (G + 1) + 1], !(++Q < z && L === re)) {
            if (Q < J) for (; X(C, L, C.bl_tree), --Q != 0; ) ;
            else L !== 0 ? (L !== Y && (X(C, L, C.bl_tree), Q--), X(C, A, C.bl_tree), ee(C, Q - 3, 2)) : Q <= 10 ? (X(C, E, C.bl_tree), ee(C, Q - 3, 3)) : (X(C, v, C.bl_tree), ee(C, Q - 11, 7));
            Y = L, J = (Q = 0) === re ? (z = 138, 3) : L === re ? (z = 6, 3) : (z = 7, 4);
          }
        }
        a(Z);
        var j = !1;
        function _(C, D, q, G) {
          ee(C, (u << 1) + (G ? 1 : 0), 3), (function(L, Y, re, Q) {
            ye(L), N(L, re), N(L, ~re), s.arraySet(L.pending_buf, L.window, Y, re, L.pending), L.pending += re;
          })(C, D, q);
        }
        i._tr_init = function(C) {
          j || ((function() {
            var D, q, G, L, Y, re = new Array(y + 1);
            for (L = G = 0; L < c - 1; L++) for ($[L] = G, D = 0; D < 1 << M[L]; D++) w[G++] = L;
            for (w[G - 1] = L, L = Y = 0; L < 16; L++) for (Z[L] = Y, D = 0; D < 1 << R[L]; D++) F[Y++] = L;
            for (Y >>= 7; L < f; L++) for (Z[L] = Y << 7, D = 0; D < 1 << R[L] - 7; D++) F[256 + Y++] = L;
            for (q = 0; q <= y; q++) re[q] = 0;
            for (D = 0; D <= 143; ) V[2 * D + 1] = 8, D++, re[8]++;
            for (; D <= 255; ) V[2 * D + 1] = 9, D++, re[9]++;
            for (; D <= 279; ) V[2 * D + 1] = 7, D++, re[7]++;
            for (; D <= 287; ) V[2 * D + 1] = 8, D++, re[8]++;
            for (Oe(V, d + 1, re), D = 0; D < f; D++) S[2 * D + 1] = 5, S[2 * D] = me(D, 5);
            ie = new I(V, M, h + 1, d, y), U = new I(S, R, 0, f, y), le = new I(new Array(0), O, 0, p, b);
          })(), j = !0), C.l_desc = new B(C.dyn_ltree, ie), C.d_desc = new B(C.dyn_dtree, U), C.bl_desc = new B(C.bl_tree, le), C.bi_buf = 0, C.bi_valid = 0, de(C);
        }, i._tr_stored_block = _, i._tr_flush_block = function(C, D, q, G) {
          var L, Y, re = 0;
          0 < C.level ? (C.strm.data_type === 2 && (C.strm.data_type = (function(Q) {
            var z, J = 4093624447;
            for (z = 0; z <= 31; z++, J >>>= 1) if (1 & J && Q.dyn_ltree[2 * z] !== 0) return o;
            if (Q.dyn_ltree[18] !== 0 || Q.dyn_ltree[20] !== 0 || Q.dyn_ltree[26] !== 0) return l;
            for (z = 32; z < h; z++) if (Q.dyn_ltree[2 * z] !== 0) return l;
            return o;
          })(C)), lt(C, C.l_desc), lt(C, C.d_desc), re = (function(Q) {
            var z;
            for (k(Q, Q.dyn_ltree, Q.l_desc.max_code), k(Q, Q.dyn_dtree, Q.d_desc.max_code), lt(Q, Q.bl_desc), z = p - 1; 3 <= z && Q.bl_tree[2 * T[z] + 1] === 0; z--) ;
            return Q.opt_len += 3 * (z + 1) + 5 + 5 + 4, z;
          })(C), L = C.opt_len + 3 + 7 >>> 3, (Y = C.static_len + 3 + 7 >>> 3) <= L && (L = Y)) : L = Y = q + 5, q + 4 <= L && D !== -1 ? _(C, D, q, G) : C.strategy === 4 || Y === L ? (ee(C, 2 + (G ? 1 : 0), 3), gt(C, V, S)) : (ee(C, 4 + (G ? 1 : 0), 3), (function(Q, z, J, te) {
            var ue;
            for (ee(Q, z - 257, 5), ee(Q, J - 1, 5), ee(Q, te - 4, 4), ue = 0; ue < te; ue++) ee(Q, Q.bl_tree[2 * T[ue] + 1], 3);
            H(Q, Q.dyn_ltree, z - 1), H(Q, Q.dyn_dtree, J - 1);
          })(C, C.l_desc.max_code + 1, C.d_desc.max_code + 1, re + 1), gt(C, C.dyn_ltree, C.dyn_dtree)), de(C), G && ye(C);
        }, i._tr_tally = function(C, D, q) {
          return C.pending_buf[C.d_buf + 2 * C.last_lit] = D >>> 8 & 255, C.pending_buf[C.d_buf + 2 * C.last_lit + 1] = 255 & D, C.pending_buf[C.l_buf + C.last_lit] = 255 & q, C.last_lit++, D === 0 ? C.dyn_ltree[2 * q]++ : (C.matches++, D--, C.dyn_ltree[2 * (w[q] + h + 1)]++, C.dyn_dtree[2 * P(D)]++), C.last_lit === C.lit_bufsize - 1;
        }, i._tr_align = function(C) {
          ee(C, 2, 3), X(C, x, V), (function(D) {
            D.bi_valid === 16 ? (N(D, D.bi_buf), D.bi_buf = 0, D.bi_valid = 0) : 8 <= D.bi_valid && (D.pending_buf[D.pending++] = 255 & D.bi_buf, D.bi_buf >>= 8, D.bi_valid -= 8);
          })(C);
        };
      }, { "../utils/common": 41 }], 53: [function(n, r, i) {
        r.exports = function() {
          this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
        };
      }, {}], 54: [function(n, r, i) {
        (function(s) {
          (function(o, l) {
            if (!o.setImmediate) {
              var a, u, c, h, d = 1, f = {}, p = !1, m = o.document, y = Object.getPrototypeOf && Object.getPrototypeOf(o);
              y = y && y.setTimeout ? y : o, a = {}.toString.call(o.process) === "[object process]" ? function(A) {
                process.nextTick(function() {
                  b(A);
                });
              } : (function() {
                if (o.postMessage && !o.importScripts) {
                  var A = !0, E = o.onmessage;
                  return o.onmessage = function() {
                    A = !1;
                  }, o.postMessage("", "*"), o.onmessage = E, A;
                }
              })() ? (h = "setImmediate$" + Math.random() + "$", o.addEventListener ? o.addEventListener("message", x, !1) : o.attachEvent("onmessage", x), function(A) {
                o.postMessage(h + A, "*");
              }) : o.MessageChannel ? ((c = new MessageChannel()).port1.onmessage = function(A) {
                b(A.data);
              }, function(A) {
                c.port2.postMessage(A);
              }) : m && "onreadystatechange" in m.createElement("script") ? (u = m.documentElement, function(A) {
                var E = m.createElement("script");
                E.onreadystatechange = function() {
                  b(A), E.onreadystatechange = null, u.removeChild(E), E = null;
                }, u.appendChild(E);
              }) : function(A) {
                setTimeout(b, 0, A);
              }, y.setImmediate = function(A) {
                typeof A != "function" && (A = new Function("" + A));
                for (var E = new Array(arguments.length - 1), v = 0; v < E.length; v++) E[v] = arguments[v + 1];
                var M = { callback: A, args: E };
                return f[d] = M, a(d), d++;
              }, y.clearImmediate = g;
            }
            function g(A) {
              delete f[A];
            }
            function b(A) {
              if (p) setTimeout(b, 0, A);
              else {
                var E = f[A];
                if (E) {
                  p = !0;
                  try {
                    (function(v) {
                      var M = v.callback, R = v.args;
                      switch (R.length) {
                        case 0:
                          M();
                          break;
                        case 1:
                          M(R[0]);
                          break;
                        case 2:
                          M(R[0], R[1]);
                          break;
                        case 3:
                          M(R[0], R[1], R[2]);
                          break;
                        default:
                          M.apply(l, R);
                      }
                    })(E);
                  } finally {
                    g(A), p = !1;
                  }
                }
              }
            }
            function x(A) {
              A.source === o && typeof A.data == "string" && A.data.indexOf(h) === 0 && b(+A.data.slice(h.length));
            }
          })(typeof self > "u" ? s === void 0 ? this : s : self);
        }).call(this, typeof xi < "u" ? xi : typeof self < "u" ? self : typeof window < "u" ? window : {});
      }, {}] }, {}, [10])(10);
    });
  })(_o)), _o.exports;
}
var PI = zI();
const Am = /* @__PURE__ */ pf(PI), LI = new Date(Date.UTC(2026, 9, 1, 0, 0, 0)), To = "http://schemas.openxmlformats.org/wordprocessingml/2006/main", BI = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
function Em(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function Mm(t) {
  return Em(t).replace(/"/g, "&quot;");
}
function Re(t, e) {
  const n = new RegExp(`\\b${e}="([^"]*)"`).exec(t);
  return n ? Om(n[1] ?? "") : null;
}
function Om(t) {
  return t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function Dm(t) {
  const e = [];
  let n = 0;
  for (; n < t.length; ) {
    const r = bh(t, n, "w:p"), i = bh(t, n, "w:tbl");
    if (r === -1 && i === -1)
      break;
    if (i !== -1 && (r === -1 || i < r)) {
      const u = FI(t, i);
      if (u === -1)
        break;
      e.push({ kind: "table", xml: t.slice(i, u) }), n = u;
      continue;
    }
    const s = r, o = t.indexOf(">", s);
    if (o === -1)
      break;
    const l = t.slice(s, o + 1);
    if (l.endsWith("/>")) {
      e.push({ kind: "paragraph", xml: l }), n = o + 1;
      continue;
    }
    const a = t.indexOf("</w:p>", o);
    if (a === -1)
      break;
    e.push({ kind: "paragraph", xml: t.slice(s, a + 6) }), n = a + 6;
  }
  return e;
}
function bh(t, e, n) {
  let r = t.indexOf(`<${n}`, e);
  for (; r !== -1; ) {
    const i = t.charAt(r + 1 + n.length);
    if (i === "" || /\s/.test(i) || i === ">" || i === "/")
      return r;
    r = t.indexOf(`<${n}`, r + 1);
  }
  return -1;
}
function FI(t, e) {
  const n = /<w:tbl[\s>]|<\/w:tbl>/g;
  n.lastIndex = e;
  let r = 0, i;
  for (; (i = n.exec(t)) !== null; )
    if (r += i[0].startsWith("</") ? -1 : 1, r === 0)
      return i.index + i[0].length;
  return -1;
}
function Ao(t, e) {
  const n = new RegExp(`<w:${e}(\\s[^>]*)?/>`).exec(t);
  if (!n)
    return !1;
  const r = n[1];
  if (r === void 0)
    return !0;
  const i = /w:val="([^"]*)"/.exec(r)?.[1];
  return !(i === "false" || i === "0" || i === "off");
}
function $I(t) {
  return /<w:rPr(?:\s[^>]*)?>([\s\S]*?)<\/w:rPr>/.exec(t)?.[1] ?? "";
}
function jI(t) {
  const e = Re(t, "w:ascii") ?? Re(t, "w:hAnsi");
  return e !== null && /courier|consolas|mono/i.test(e);
}
function Gn(t, e) {
  t.includes(e) || t.push(e);
}
function Rm(t, e) {
  const n = $I(t), r = [];
  Ao(n, "b") && Gn(r, "bold"), Ao(n, "i") && Gn(r, "italic"), Ao(n, "strike") && Gn(r, "strike"), /<w:u(?:\s[^>]*)?\/>/.test(n) && !/<w:u[^>]*w:val="(?:none|false|0)"/.test(n) && Gn(r, "underline"), /<w:rStyle(?:\s[^>]*)?\/>/.test(n) && Re(n, "w:val") === "Hyperlink" && Gn(r, "underline"), jI(n) && Gn(r, "code");
  let i = "";
  for (const s of t.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
    i += Om(s[1] ?? "");
  return /<w:tab(?:\s[^>]*)?\/>/.test(t) && (i += "	"), /<w:br(?:\s[^>]*)?\/>/.test(t) && (i += `
`), { text: i, marks: r, href: e };
}
function VI(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const r = n[0], i = Re(r, "Id");
    i !== null && /TargetMode="External"/.test(r) && e.set(i, Re(r, "Target") ?? "");
  }
  return e;
}
function zm(t, e) {
  const n = /<w:pPr(?:\s[^>]*)?>([\s\S]*?)<\/w:pPr>/.exec(t)?.[1] ?? "", r = Re(/<w:pStyle(?:\s[^>]*)?\/>/.exec(n)?.[0] ?? "", "w:val"), i = _h(Re(/<w:jc(?:\s[^>]*)?\/>/.exec(n)?.[0] ?? "", "w:val")), s = /<w:numPr(?:\s[^>]*)?>([\s\S]*?)<\/w:numPr>/.exec(n)?.[1] ?? "", o = Re(/<w:numId(?:\s[^>]*)?\/>/.exec(s)?.[0] ?? "", "w:val"), l = Re(/<w:ilvl(?:\s[^>]*)?\/>/.exec(s)?.[0] ?? "", "w:val"), a = o === null || o === "0" ? null : Number(o), u = [];
  let c = 0;
  const h = /<w:hyperlink(?:\s[^>]*)?>[\s\S]*?<\/w:hyperlink>/g;
  h.lastIndex = 0;
  let d;
  for (; (d = h.exec(t)) !== null; ) {
    xh(u, t.slice(c, d.index));
    const f = d[0], p = Re(f, "r:id"), m = p !== null ? e.get(p) ?? null : null;
    for (const y of f.matchAll(/<w:r\b[^>]*(?:\/>|>[\s\S]*?<\/w:r>)/g))
      u.push(Rm(y[0], m));
    c = d.index + f.length;
  }
  return xh(u, t.slice(c)), {
    styleId: r,
    alignment: i,
    numId: a,
    level: l === null ? 0 : Number(l),
    runs: u
  };
}
function xh(t, e) {
  for (const n of e.matchAll(/<w:r\b[^>]*(?:\/>|>[\s\S]*?<\/w:r>)/g))
    t.push(Rm(n[0], null));
}
function WI(t) {
  const e = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map();
  for (const r of t.matchAll(/<w:abstractNum\b[^>]*>[\s\S]*?<\/w:abstractNum>/g)) {
    const i = r[0], s = Re(/<w:abstractNum\b[^>]*>/.exec(i)?.[0] ?? "", "w:abstractNumId");
    if (s === null)
      continue;
    const o = /* @__PURE__ */ new Map();
    for (const l of i.matchAll(/<w:lvl\b[^>]*>[\s\S]*?<\/w:lvl>/g)) {
      const a = l[0], u = Number(Re(/<w:lvl\b[^>]*>/.exec(a)?.[0] ?? "", "w:ilvl") ?? "0"), c = Re(/<w:numFmt(?:\s[^>]*)?\/>/.exec(a)?.[0] ?? "", "w:val");
      c !== null && o.set(u, c);
    }
    n.set(s, o);
  }
  for (const r of t.matchAll(/<w:num\b[^>]*>[\s\S]*?<\/w:num>/g)) {
    const i = r[0], s = Number(Re(/<w:num\b[^>]*>/.exec(i)?.[0] ?? "", "w:numId") ?? "NaN"), o = Re(/<w:abstractNumId(?:\s[^>]*)?\/>/.exec(i)?.[0] ?? "", "w:val");
    if (Number.isFinite(s) && o !== null) {
      const l = n.get(o);
      l !== void 0 && e.set(s, l);
    }
  }
  return e;
}
function HI(t, e) {
  const n = Dm(t).find((i) => i.kind === "paragraph"), r = n !== void 0 ? zm(n.xml, e) : null;
  return {
    alignment: r?.alignment ?? null,
    runs: r?.runs ?? []
  };
}
function UI(t, e) {
  const n = [...t.matchAll(/<w:gridCol(?:\s[^>]*)?\/>/g)].map(
    (i) => Number(Re(i[0], "w:w") ?? "0")
  ), r = [];
  for (const i of t.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)) {
    const s = i[0], o = [];
    for (const l of s.matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g))
      o.push(HI(l[0], e));
    r.push({ header: /<w:tblHeader(?:\s[^>]*)?\/>/.test(s), cells: o });
  }
  return {
    kind: "table",
    rows: r,
    columnWidthsTwips: n.every((i) => Number.isFinite(i) && i > 0) ? n : null
  };
}
function qI(t) {
  const e = /<w:pgSz(?:\s[^>]*)?\/>/.exec(t)?.[0], n = /<w:pgMar(?:\s[^>]*)?\/>/.exec(t)?.[0];
  if (e === void 0 || n === void 0)
    return null;
  const r = Number(Re(e, "w:w")), i = Number(Re(e, "w:h")), s = Number(Re(n, "w:top")), o = Number(Re(n, "w:right")), l = Number(Re(n, "w:bottom")), a = Number(Re(n, "w:left"));
  return [r, i, s, o, l, a].some((u) => !Number.isFinite(u)) ? null : {
    pageWidthTwips: r,
    pageHeightTwips: i,
    marginTopTwips: s,
    marginRightTwips: o,
    marginBottomTwips: l,
    marginLeftTwips: a
  };
}
async function KI(t) {
  const e = await Am.loadAsync(t), n = e.file("word/document.xml");
  if (n === null)
    throw new Error("docx 缺少 word/document.xml 部件");
  const r = await n.async("text"), i = /<w:body(?:\s[^>]*)?>([\s\S]*)<\/w:body>/.exec(r);
  if (!i)
    throw new Error("docx 缺少 w:body 正文容器");
  const s = i[1] ?? "", o = e.file("word/_rels/document.xml.rels"), l = VI(o !== null ? await o.async("text") : ""), a = e.file("word/numbering.xml"), u = WI(
    a !== null ? await a.async("text") : ""
  ), c = [];
  for (const d of Dm(s)) {
    if (d.kind === "table") {
      c.push(UI(d.xml, l));
      continue;
    }
    const f = zm(d.xml, l);
    if (f.numId !== null) {
      const m = xg(u.get(f.numId)?.get(f.level) ?? "bullet");
      c.push({
        kind: "listItem",
        styleId: f.styleId,
        alignment: f.alignment,
        list: { kind: m, numId: f.numId, level: f.level },
        runs: f.runs
      });
      continue;
    }
    const p = Ih(f.styleId);
    if (p !== null) {
      c.push({
        kind: "heading",
        level: p,
        styleId: f.styleId,
        alignment: f.alignment,
        runs: f.runs
      });
      continue;
    }
    c.push({
      kind: "paragraph",
      styleId: f.styleId,
      alignment: f.alignment,
      runs: f.runs
    });
  }
  const h = /<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>|<w:sectPr(?:\s[^>]*)?\/>/.exec(s);
  return {
    blocks: c.length > 0 ? c : [{ kind: "paragraph", styleId: null, alignment: null, runs: [] }],
    section: h ? qI(h[0]) : null
  };
}
function Ch(t) {
  const e = [];
  t.href !== null && e.push('<w:rStyle w:val="Hyperlink"/>'), t.marks.includes("bold") && e.push("<w:b/>"), t.marks.includes("italic") && e.push("<w:i/>"), t.marks.includes("strike") && e.push("<w:strike/>"), t.marks.includes("underline") && e.push('<w:u w:val="single"/>'), t.marks.includes("code") && e.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>');
  const n = e.length > 0 ? `<w:rPr>${e.join("")}</w:rPr>` : "", r = Em(t.text);
  return `<w:r>${n}<w:t xml:space="preserve">${r}</w:t></w:r>`;
}
function Pm(t, e, n) {
  const r = [];
  t !== null && r.push(`<w:pStyle w:val="${Mm(t)}"/>`), n !== null && r.push(
    `<w:numPr><w:ilvl w:val="${n.list.level}"/><w:numId w:val="${n.list.numId}"/></w:numPr>`
  );
  const i = bg(e);
  return i !== null && r.push(`<w:jc w:val="${i}"/>`), r.length > 0 ? `<w:pPr>${r.join("")}</w:pPr>` : "";
}
function Lm(t, e) {
  let n = "", r = 0;
  for (; r < t.length; ) {
    const i = t[r];
    if (i === void 0)
      break;
    if (i.href === null) {
      n += Ch(i), r += 1;
      continue;
    }
    let s = r;
    for (; s < t.length && t[s]?.href === i.href; )
      s += 1;
    const o = t.slice(r, s).map((l) => Ch(l));
    n += `<w:hyperlink r:id="${e(i.href)}">${o.join("")}</w:hyperlink>`, r = s;
  }
  return n;
}
function JI(t, e, n) {
  const r = `<w:p>${Pm(null, t.alignment, null)}${Lm(t.runs, n)}</w:p>`;
  return `<w:tc><w:tcPr><w:tcW w:w="${e}" w:type="dxa"/></w:tcPr>${r}</w:tc>`;
}
function GI(t, e) {
  if (t.kind !== "table")
    throw new Error("表格序列化入参须为表格块");
  const n = Math.max(1, ...t.rows.map((l) => l.cells.length)), r = t.columnWidthsTwips !== null && t.columnWidthsTwips.length === n ? t.columnWidthsTwips : Array.from({ length: n }, () => 4680), i = "<w:tblBorders>" + ["top", "left", "bottom", "right", "insideH", "insideV"].map((l) => `<w:${l} w:val="single" w:sz="4" w:color="auto"/>`).join("") + "</w:tblBorders>", s = `<w:tblGrid>${r.map((l) => `<w:gridCol w:w="${l}"/>`).join("")}</w:tblGrid>`, o = t.rows.map((l) => {
    const a = l.header ? "<w:trPr><w:tblHeader/></w:trPr>" : "", u = l.cells.map((c, h) => JI(c, r[h] ?? 4680, e)).join("");
    return `<w:tr>${a}${u}</w:tr>`;
  }).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${i}</w:tblPr>${s}${o}</w:tbl>`;
}
function ZI(t, e) {
  return t.blocks.map((n) => {
    if (n.kind === "table")
      return GI(n, e);
    const r = n.kind === "listItem" ? n : null, i = Pm(n.styleId, n.alignment, r), s = Lm(n.runs, e);
    return i.length === 0 && s.length === 0 ? "<w:p/>" : `<w:p>${i}${s}</w:p>`;
  }).join("");
}
function YI(t) {
  const e = t ?? {
    pageWidthTwips: 11906,
    pageHeightTwips: 16838,
    marginTopTwips: 1440,
    marginRightTwips: 1800,
    marginBottomTwips: 1440,
    marginLeftTwips: 1800
  };
  return `<w:sectPr><w:pgSz w:w="${e.pageWidthTwips}" w:h="${e.pageHeightTwips}"/><w:pgMar w:top="${e.marginTopTwips}" w:right="${e.marginRightTwips}" w:bottom="${e.marginBottomTwips}" w:left="${e.marginLeftTwips}" w:header="851" w:footer="992" w:gutter="0"/></w:sectPr>`;
}
function XI(t) {
  const e = [], n = (r) => {
    for (const i of r)
      i.href !== null && !e.includes(i.href) && e.push(i.href);
  };
  for (const r of t.blocks) {
    if (r.kind === "table") {
      for (const i of r.rows)
        for (const s of i.cells)
          n(s.runs);
      continue;
    }
    n(r.runs);
  }
  return e;
}
function QI(t) {
  const e = [], n = /* @__PURE__ */ new Map();
  for (const r of t.blocks) {
    if (r.kind !== "listItem")
      continue;
    let i = n.get(r.list.numId);
    i === void 0 && (i = { kind: r.list.kind, levels: [] }, n.set(r.list.numId, i), e.push({ numId: r.list.numId, kind: i.kind, levels: i.levels })), i.levels.includes(r.list.level) || i.levels.push(r.list.level);
  }
  for (const r of e)
    r.levels.sort((i, s) => i - s);
  return e;
}
async function e_(t) {
  const e = XI(t), n = new Map(
    e.map((f, p) => [f, `rId${p + 1}`])
  ), r = (f) => n.get(f) ?? `rId${e.length + 1}`, i = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${To}" xmlns:r="${BI}"><w:body>` + ZI(t, r) + YI(t.section) + `</w:body></w:document>
`, s = QI(t), o = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${To}">` + s.map((f, p) => {
    const m = f.levels.map(
      (y) => f.kind === "bullet" ? `<w:lvl w:ilvl="${y}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl>` : `<w:lvl w:ilvl="${y}"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%${y + 1}."/></w:lvl>`
    ).join("");
    return `<w:abstractNum w:abstractNumId="${p + 1}"><w:multiLevelType w:val="hybridMultilevel"/>${m}</w:abstractNum>`;
  }).join("") + s.map((f, p) => `<w:num w:numId="${f.numId}"><w:abstractNumId w:val="${p + 1}"/></w:num>`).join("") + `</w:numbering>
`, l = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${To}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="宋体" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="56"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="3"/></w:pPr><w:rPr><w:b/><w:i/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="4"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="5"/></w:pPr><w:rPr><w:b/><w:i/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="HTMLPreformatted"><w:name w:val="HTML Preformatted"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style></w:styles>
`, a = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` + e.map(
    (f, p) => `<Relationship Id="rId${p + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${Mm(f)}" TargetMode="External"/>`
  ).join("") + `</Relationships>
`, u = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` + (s.length > 0 ? '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' : "") + `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>
`, c = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>
`, h = new Am(), d = [
    ["[Content_Types].xml", u],
    ["_rels/.rels", c],
    ["word/document.xml", i],
    ["word/_rels/document.xml.rels", a]
  ];
  s.length > 0 && d.push(["word/numbering.xml", o]), d.push(["word/styles.xml", l]);
  for (const [f, p] of d)
    h.file(f, p, { date: LI });
  return h.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
}
function vl(t) {
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return null;
}
function Bm(t) {
  if (typeof t == "object" && t !== null && "message" in t) {
    const e = t.message;
    if (typeof e == "string")
      return e;
  }
  return "";
}
function t_(t) {
  return Buffer.from(t, "base64");
}
function n_(t) {
  let e = "";
  for (let r = 0; r < t.length; r += 32768)
    e += String.fromCharCode(...t.subarray(r, r + 32768));
  return btoa(e);
}
async function r_(t, e) {
  try {
    const n = await t("file:read", { path: e, encoding: "base64" });
    if (typeof n?.content != "string" || n.encoding !== "base64")
      return {
        status: "failed",
        path: e,
        errorCode: "WORD_IMPORT_PAYLOAD_INVALID",
        message: "导入失败：file:read 回执缺少 base64 内容字段。"
      };
    const r = t_(n.content), i = await KI(r);
    return { status: "imported", path: e, document: i, markdown: Tg(i), bytes: r };
  } catch (n) {
    const r = vl(n) ?? "WORD_IMPORT_PARSE_FAILED", i = Bm(n);
    return {
      status: "failed",
      path: e,
      errorCode: r,
      message: i.length > 0 ? `导入失败：${i}` : `导入失败：能力返回错误（${r}）。`
    };
  }
}
async function i_(t, e, n) {
  let r;
  try {
    r = await e_(n);
  } catch (i) {
    const s = vl(i) ?? "WORD_EXPORT_SERIALIZE_FAILED";
    return {
      status: "failed",
      path: e,
      errorCode: s,
      message: `导出失败：文档序列化未完成（${s}）。未写入任何文件。`
    };
  }
  try {
    await t("file:write", { path: e, data: n_(r), encoding: "base64" });
  } catch (i) {
    const s = vl(i) ?? "WORD_EXPORT_WRITE_FAILED", o = Bm(i);
    return {
      status: "failed",
      path: e,
      errorCode: s,
      message: o.length > 0 ? `落盘未完成：写入能力返回错误（${s}；${o}）。文档仍在编辑面，未写入任何虚假成功状态。` : `落盘未完成：写入能力返回错误（${s}）。文档仍在编辑面，未写入任何虚假成功状态。`
    };
  }
  return { status: "written", path: e };
}
const s_ = ({ request: t }) => {
  const e = zs(
    () => t ?? ((R, O) => Mo.request(R, O)),
    [t]
  ), { token: n } = ms.useToken(), [r, i] = _t("idle"), [s, o] = _t(""), [l, a] = _t(""), [u, c] = _t(null), [h, d] = _t(""), [f, p] = _t(""), [m, y] = _t(null), [g, b] = _t(null), x = qm(null);
  vh(() => {
    if (r !== "editing" || x.current === null)
      return;
    let R = !1, O = null;
    return (async () => {
      const T = x.current;
      if (T !== null)
        try {
          if (O = await DI({
            host: T,
            defaultValue: f,
            onMarkdownChange: (V) => {
              R || d(V);
            }
          }), R) {
            O.destroy(), O = null;
            return;
          }
          b(O), RI(O);
        } catch (V) {
          R || y(
            "编辑器装载失败：" + (typeof V == "object" && V !== null && "message" in V ? String(V.message) : "未知错误")
          );
        }
    })(), () => {
      R = !0, O !== null && O.destroy(), b(null);
    };
  }, [r, f]);
  const A = Eo(async () => {
    const R = s.trim();
    if (R.length === 0) {
      y("请先填写要打开的 .docx 路径。");
      return;
    }
    i("importing"), y(null);
    const O = await r_(e, R);
    if (O.status === "failed") {
      i(u === null ? "idle" : "editing"), y(`导入失败（${O.errorCode}）：${O.message}`);
      return;
    }
    c(O.document), d(O.markdown), p(O.markdown), a(O.path), i("editing"), y(`已导入：${O.path}`);
  }, [u, s, e]), E = Eo(async () => {
    const R = l.trim();
    if (R.length === 0) {
      y("请先填写保存目标路径。");
      return;
    }
    const O = wu(h);
    c(O);
    const T = await i_(e, R, O);
    if (T.status === "failed") {
      y(`保存失败（${T.errorCode}）：${T.message}`);
      return;
    }
    p(h), y(`已保存：${T.path}`);
  }, [e, h, l]), v = zs(() => h !== f, [h, f]), M = zs(() => zg(wu(h)), [h]);
  return r !== "editing" ? /* @__PURE__ */ ut("section", { style: { display: "flex", flexDirection: "column", gap: n.marginSM }, children: [
    /* @__PURE__ */ Me("p", { style: { margin: 0, color: n.colorTextSecondary }, children: "迁移状态：领域逻辑与编辑面已迁移（统一编辑引擎 Milkdown；docx 字节级读写网关已就位）" }),
    /* @__PURE__ */ Me("p", { style: { margin: 0 }, children: "打开本机 .docx（file:read 正式能力链）进入编辑；保存经 file:write 正式能力链落盘。 受控提交编排归 file-processing 服务（在途），能力未就绪时如实回码。" }),
    /* @__PURE__ */ ut("div", { style: { display: "flex", gap: n.marginXS }, children: [
      /* @__PURE__ */ Me(
        fu,
        {
          style: { maxWidth: 420 },
          value: s,
          placeholder: "例如 ~/文档/示例.docx",
          onChange: (R) => o(R.target.value)
        }
      ),
      /* @__PURE__ */ Me(Ji, { onClick: () => {
        A();
      }, disabled: r === "importing", children: r === "importing" ? "导入中" : "打开文档" })
    ] }),
    m === null ? null : /* @__PURE__ */ Me("p", { style: { margin: 0 }, children: m }),
    /* @__PURE__ */ Me(
      Sh,
      {
        title: "尚未打开文档",
        description: "输入 .docx 路径后打开，编辑面将装配统一编辑引擎 Milkdown。",
        compact: !0
      }
    )
  ] }) : /* @__PURE__ */ ut("section", { style: { display: "flex", flexDirection: "column", gap: n.marginSM }, children: [
    /* @__PURE__ */ ut("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: n.marginXS }, children: [
      /* @__PURE__ */ Me(
        fu,
        {
          style: { maxWidth: 420 },
          value: l,
          onChange: (R) => a(R.target.value)
        }
      ),
      /* @__PURE__ */ Me(Ji, { onClick: () => {
        E();
      }, children: "保存 docx" }),
      /* @__PURE__ */ ut("span", { style: { color: n.colorTextSecondary }, children: [
        "字数 ",
        M.words,
        " · 字符 ",
        M.characters,
        " ·",
        " ",
        v ? "有未保存变更" : "与上次保存一致"
      ] })
    ] }),
    m === null ? null : /* @__PURE__ */ Me("p", { style: { margin: 0 }, children: m }),
    /* @__PURE__ */ Me(
      "div",
      {
        ref: x,
        style: {
          border: `1px solid ${n.colorBorderSecondary}`,
          borderRadius: n.borderRadiusLG,
          padding: n.padding,
          minHeight: 320
        }
      }
    ),
    g === null ? /* @__PURE__ */ Me("p", { style: { margin: 0 }, children: "编辑器装载中" }) : null
  ] });
}, o_ = "chips.official.office", l_ = [
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
    status: "领域逻辑与编辑面已迁移",
    description: "文档模型/段落样式映射/docx 字节级读写网关已就位（最小合法 docx 夹具全链测试通过）；编辑面为统一编辑引擎 Milkdown（Markdown 唯一编辑表示），保存经 file:write 正式能力链落盘。"
  }
], a_ = ({ domainKey: t, status: e, description: n }) => {
  const { token: r } = ms.useToken();
  return /* @__PURE__ */ ut("section", { style: { display: "flex", flexDirection: "column", gap: r.marginSM }, children: [
    /* @__PURE__ */ ut("p", { style: { margin: 0, color: r.colorTextSecondary }, children: [
      "迁移状态：",
      e
    ] }),
    /* @__PURE__ */ Me("p", { style: { margin: 0 }, children: n }),
    t === "word" ? /* @__PURE__ */ Me(s_, {}) : /* @__PURE__ */ Me(
      Sh,
      {
        title: "域界面待端到端臂装配",
        description: "文档打开与编辑界面将随宿主会话链与渲染帧通道收口后接入。",
        compact: !0
      }
    )
  ] });
}, u_ = () => {
  const { token: t } = ms.useToken();
  return /* @__PURE__ */ ut(
    "section",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: t.margin,
        padding: t.padding
      },
      children: [
        /* @__PURE__ */ Me(
          Hm,
          {
            title: "薯片办公",
            description: "Word / 表格 / 演示 / PDF 四件套查看与编辑（.docx / .xlsx / .csv / .pptx / .pdf）"
          }
        ),
        /* @__PURE__ */ Me(
          Um,
          {
            defaultActiveKey: "sheet",
            items: l_.map((e) => ({
              key: e.key,
              label: e.label,
              children: /* @__PURE__ */ Me(a_, { domainKey: e.key, status: e.status, description: e.description })
            }))
          }
        )
      ]
    }
  );
}, c_ = () => {
  const { token: t } = ms.useToken(), { phase: e, errorCode: n, lastInvoked: r, invokeOpenCard: i, invokeRefreshView: s } = hg();
  return /* @__PURE__ */ ut(
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
        /* @__PURE__ */ ut("p", { style: { margin: 0 }, children: [
          "命令注册状态：",
          cg[e]
        ] }),
        n === null ? null : /* @__PURE__ */ ut("p", { style: { margin: 0 }, children: [
          "最近错误码：",
          n
        ] }),
        /* @__PURE__ */ ut("div", { style: { display: "flex", gap: t.marginXS }, children: [
          /* @__PURE__ */ Me(Ji, { onClick: () => {
            i("~/文档/示例.cpk");
          }, children: "触发打开卡片命令" }),
          /* @__PURE__ */ Me(Ji, { onClick: () => {
            s();
          }, children: "触发刷新视图命令" })
        ] }),
        /* @__PURE__ */ Me("p", { style: { margin: 0 }, children: r === null ? "本窗口尚未执行过命令派发" : "最近执行：" + r.commandId })
      ]
    }
  );
}, g_ = () => /* @__PURE__ */ Me(Vm, { appId: o_, surface: "window", children: /* @__PURE__ */ ut(Wm, { children: [
  /* @__PURE__ */ Me(u_, {}),
  /* @__PURE__ */ Me(c_, {})
] }) });
export {
  g_ as AppView,
  g_ as default
};
