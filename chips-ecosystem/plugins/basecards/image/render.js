import { jsx as o, jsxs as m, Fragment as xe } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { flushSync as Ie } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as we } from "chips-resource://platform/vendor/react-dom-client.js";
import Te, { useRef as L, useState as x } from "chips-resource://platform/vendor/react.js";
import { theme as T, Empty as Ge, PictureOutlined as je, Button as D, DeleteOutlined as Ye, Tag as Ke, Input as X, Slider as Ve, Segmented as qe } from "chips-resource://platform/vendor/chips-ui.js";
class A extends Error {
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
    return new A({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function Ze(r) {
  if (typeof r != "object" || r === null)
    return !1;
  const e = r;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const Qe = "SDK_BRIDGE_UNAVAILABLE", fe = "SDK_UNKNOWN_ERROR", he = "发生未知错误";
function Je(r) {
  return r instanceof Error;
}
function et(r) {
  if (r instanceof A)
    return r;
  if (Ze(r)) {
    const e = r, t = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new A(t);
  }
  return Je(r) ? new A({
    code: fe,
    message: he,
    details: { name: r.name, cause: r.message },
    retryable: !1
  }) : new A({
    code: fe,
    message: he,
    details: { value: String(r) },
    retryable: !1
  });
}
function tt() {
  return new A({
    code: Qe,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function v(r, e, t) {
  let n;
  try {
    n = r();
  } catch (l) {
    return Promise.reject(et(l));
  }
  return n.request(e, t);
}
const rt = "cli.command.list", nt = "cli.command.get", it = "cli.command.resolve";
function ot(r) {
  return {
    list(e) {
      return v(r, rt, e ?? {});
    },
    get(e) {
      return v(r, nt, e);
    },
    resolve(e) {
      return v(r, it, e);
    }
  };
}
const P = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, lt = "cli.task.create", at = "cli.task.bindInvocation", st = "cli.task.cancel";
function dt(r) {
  return {
    create(e) {
      return v(r, lt, e).then((t) => t.task);
    },
    bindInvocation(e) {
      return v(r, at, e).then((t) => t.task);
    },
    get(e) {
      const t = { taskId: e };
      return v(r, P.CLI_TASK_GET, t).then((n) => n.task);
    },
    active(e) {
      const t = { commandId: e };
      return v(r, P.CLI_TASK_ACTIVE, t).then((n) => n.task);
    },
    progress(e, t) {
      const n = { taskId: e, progress: t };
      return v(r, P.CLI_TASK_PROGRESS, n).then((l) => l.task);
    },
    complete(e, t) {
      const n = {
        taskId: e,
        ...t === void 0 ? {} : { output: t }
      };
      return v(r, P.CLI_TASK_COMPLETE, n).then((l) => l.task);
    },
    fail(e, t) {
      const n = { taskId: e, error: t };
      return v(r, P.CLI_TASK_FAIL, n).then((l) => l.task);
    },
    cancel(e) {
      return v(r, st, { taskId: e }).then((t) => t.task);
    }
  };
}
function ct() {
  return globalThis.window?.chips;
}
class ut {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = ot(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = dt(() => this.#e());
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
    const e = ct();
    if (e === void 0)
      throw tt();
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
    return v(() => this.#e(), e, t);
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
function gt(r) {
  return new ut(r?.bridge);
}
const pt = gt(), me = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function Ce(r) {
  return typeof r == "string" && r.trim().length > 0;
}
function ft(r = 10) {
  let e = "";
  for (let t = 0; t < r; t += 1)
    e += me[Math.floor(Math.random() * me.length)];
  return `image-${e}`;
}
function W(r) {
  if (!Ce(r))
    return;
  const e = r.trim();
  if (!e || e.includes("\\") || e.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(e))
    return;
  const t = e.replace(/^\.\//, "");
  if (!t)
    return;
  const n = t.split("/").filter(Boolean);
  if (!(n.length === 0 || n.some((l) => l === "." || l === "..")))
    return n.join("/");
}
function ht(r) {
  const e = W(r);
  if (!e)
    return "";
  const t = e.split("/");
  return t[t.length - 1] ?? "";
}
function ye(r) {
  try {
    const t = new URL(r).pathname.split("/").filter(Boolean);
    return t[t.length - 1] ?? "";
  } catch {
    return "";
  }
}
function Se(r) {
  const e = r.toLowerCase();
  if (e.endsWith(".png"))
    return "image/png";
  if (e.endsWith(".jpg") || e.endsWith(".jpeg"))
    return "image/jpeg";
  if (e.endsWith(".webp"))
    return "image/webp";
  if (e.endsWith(".gif"))
    return "image/gif";
  if (e.endsWith(".bmp"))
    return "image/bmp";
  if (e.endsWith(".svg"))
    return "image/svg+xml";
  if (e.endsWith(".avif"))
    return "image/avif";
  if (e.endsWith(".tif") || e.endsWith(".tiff"))
    return "image/tiff";
}
function mt(r, e, t) {
  const n = r.slice(), l = n[e];
  return l === void 0 || (n.splice(e, 1), n.splice(t, 0, l)), n;
}
function yt(r, e, t, n) {
  if (t.length === 0)
    return Math.max(0, n);
  let l = 0, a = Number.POSITIVE_INFINITY;
  for (let d = 0; d < t.length; d += 1) {
    const u = t[d];
    if (!u)
      continue;
    const p = u.left + u.width / 2, f = u.top + u.height / 2, y = Math.hypot(r - p, e - f);
    y < a && (a = y, l = d);
  }
  return Math.max(0, Math.min(l, n));
}
const G = "base.image", $ = {
  grid_mode: "2x2",
  single_width_percent: 100,
  single_alignment: "center",
  spacing_mode: "comfortable"
}, St = {
  layout_type: "single"
}, Ee = [
  "single",
  "grid",
  "long-scroll",
  "horizontal-scroll"
], Re = ["2x2", "3x3", "3-column-infinite"], Le = ["left", "center", "right"], Ae = ["none", "comfortable"];
function K(r) {
  const e = typeof r == "string" ? r.trim() : "";
  if (e.length === 0)
    return { input: e, normalizedUrl: "", protocol: "", valid: !1 };
  let t;
  try {
    t = new URL(e);
  } catch {
    return { input: e, normalizedUrl: "", protocol: "", valid: !1 };
  }
  const n = t.protocol.toLowerCase(), l = n === "http:" || n === "https:" || n === "webdav:";
  return {
    input: e,
    normalizedUrl: l ? t.toString() : "",
    protocol: n,
    valid: l
  };
}
function F(r) {
  return typeof r == "string" ? r.trim() : "";
}
function _t(r, e) {
  const t = r !== null && typeof r == "object" ? r : {}, n = t.source === "url" ? "url" : "file", l = F(t.id);
  return {
    id: l.length > 0 ? l : `image-${e + 1}`,
    source: n,
    file_path: n === "file" ? W(t.file_path) ?? "" : "",
    url: n === "url" ? F(t.url) : "",
    alt: F(t.alt),
    title: F(t.title)
  };
}
function bt(r) {
  const e = r !== null && typeof r == "object" ? r : {}, t = e.single_width_percent;
  return {
    grid_mode: Re.includes(e.grid_mode) ? e.grid_mode : $.grid_mode,
    single_width_percent: typeof t == "number" && Number.isFinite(t) && t > 0 ? t : $.single_width_percent,
    single_alignment: Le.includes(e.single_alignment) ? e.single_alignment : $.single_alignment,
    spacing_mode: Ae.includes(e.spacing_mode) ? e.spacing_mode : $.spacing_mode
  };
}
function z(r) {
  const e = r !== null && typeof r == "object" ? r : {}, t = Array.isArray(e.images) ? e.images.map((a, d) => _t(a, d)) : [], n = Ee.includes(e.layout_type) ? e.layout_type : St.layout_type, l = t.length > 1 && n === "single" ? "grid" : n;
  return {
    images: t,
    layout_type: l,
    layout_options: bt(e.layout_options)
  };
}
function vt(r) {
  if (r == null)
    return !0;
  if (typeof r != "object" || Array.isArray(r))
    return !1;
  const e = r, t = e.images;
  if (t !== void 0) {
    if (!Array.isArray(t))
      return !1;
    for (const l of t) {
      if (l === null || typeof l != "object" || Array.isArray(l))
        return !1;
      const a = l;
      if (a.id !== void 0 && !Ce(a.id) || a.alt !== void 0 && typeof a.alt != "string" || a.title !== void 0 && typeof a.title != "string")
        return !1;
      const d = a.source;
      if (d !== void 0 && d !== "file" && d !== "url")
        return !1;
      if (d === "file") {
        if (W(a.file_path) === void 0)
          return !1;
      } else if (d === "url") {
        if (!K(a.url).valid)
          return !1;
      } else {
        const u = a.file_path;
        if (typeof u == "string" && u.trim().length > 0 && W(u) === void 0)
          return !1;
        const p = a.url;
        if (typeof p == "string" && p.trim().length > 0 && !K(p).valid)
          return !1;
      }
    }
  }
  if (e.layout_type !== void 0 && !Ee.includes(e.layout_type))
    return !1;
  const n = e.layout_options;
  if (n !== void 0) {
    if (n === null || typeof n != "object" || Array.isArray(n))
      return !1;
    const l = n;
    if (l.grid_mode !== void 0 && !Re.includes(l.grid_mode) || l.single_alignment !== void 0 && !Le.includes(l.single_alignment) || l.spacing_mode !== void 0 && !Ae.includes(l.spacing_mode))
      return !1;
    const a = l.single_width_percent;
    if (a !== void 0 && (typeof a != "number" || !Number.isFinite(a) || a < 10 || a > 100))
      return !1;
  }
  return !0;
}
function ke(r) {
  return r.images.length <= 1 ? "single" : r.layout_type === "single" ? "grid" : r.layout_type;
}
function xt(r) {
  return r === "2x2" ? 2 : 3;
}
function It(r) {
  return r === "2x2" ? 4 : r === "3x3" ? 9 : Number.POSITIVE_INFINITY;
}
function te(r) {
  return r === "none" ? { gap: 0, radius: 0 } : { gap: 10, radius: 12 };
}
function wt(r, e) {
  return r.images.length <= 1 ? e !== 0 ? r : {
    ...r,
    layout_type: "single",
    layout_options: {
      ...r.layout_options,
      single_width_percent: 70,
      single_alignment: "center"
    }
  } : e > 1 || r.layout_type !== "single" ? r : {
    ...r,
    layout_type: "grid",
    layout_options: {
      ...r.layout_options,
      grid_mode: "3x3",
      spacing_mode: "comfortable"
    }
  };
}
function _e(r) {
  return [r.title, r.alt].find((e) => e.trim().length > 0)?.trim() ?? "";
}
function ze(r) {
  if (r.source === "url") {
    const a = r.url.trim();
    if (a.length === 0)
      return null;
    const d = Se(ye(a) || a), u = _e(r), p = ye(a);
    return {
      intent: "view",
      resource: {
        uri: a,
        ...d === void 0 ? {} : { mimeType: d },
        ...p.length > 0 ? { fileName: p } : {},
        ...u.length > 0 ? { title: u } : {}
      }
    };
  }
  const e = W(r.file_path);
  if (!e)
    return null;
  const t = Se(e), n = ht(e), l = _e(r) || n;
  return {
    intent: "view",
    resource: {
      uri: e,
      ...t === void 0 ? {} : { mimeType: t },
      ...n.length > 0 ? { fileName: n } : {},
      ...l.length > 0 ? { title: l } : {}
    }
  };
}
function Tt(r) {
  return {
    id: ft(),
    source: "url",
    file_path: "",
    url: r,
    alt: "",
    title: ""
  };
}
const Ct = "图片暂时不可用", Et = "min(76vw, 560px)";
function Rt(r) {
  return r === "left" ? "flex-start" : r === "right" ? "flex-end" : "center";
}
function j(r) {
  const { item: e, src: t, radius: n, fillHeight: l = !1, aspectRatio: a, dimmed: d = !1, onOpen: u, onResourceError: p } = r, { token: f } = T.useToken(), [y, h] = x(!1);
  Te.useEffect(() => {
    h(!1);
  }, [t]);
  const g = t.trim().length > 0 && ze(e) !== null, S = {
    position: "relative",
    overflow: "hidden",
    borderRadius: `${n}px`,
    border: `1px solid ${f.colorBorderSecondary}`,
    background: f.colorFillQuaternary,
    boxShadow: f.boxShadowTertiary,
    ...a ? { aspectRatio: a } : {},
    ...l ? { height: "100%" } : {}
  };
  return /* @__PURE__ */ o(
    "div",
    {
      "data-role": "image-frame",
      "data-image-id": e.id,
      style: {
        cursor: g ? "pointer" : "default",
        ...S
      },
      ...g ? {
        role: "button",
        tabIndex: 0,
        "aria-label": `查看图片 ${Lt(e)}`,
        onClick: u,
        onKeyDown: (k) => {
          (k.key === "Enter" || k.key === " ") && (k.preventDefault(), u());
        }
      } : {},
      children: t.trim().length > 0 && !y ? /* @__PURE__ */ o(
        "img",
        {
          src: t,
          alt: e.alt,
          title: e.title.length > 0 ? e.title : void 0,
          style: {
            display: "block",
            width: "100%",
            height: l ? "100%" : "auto",
            objectFit: "cover",
            userSelect: "none",
            ...d ? { filter: "brightness(0.48)" } : {}
          },
          onError: () => {
            h(!0), p();
          },
          loading: "lazy",
          draggable: !1
        }
      ) : /* @__PURE__ */ o(
        "div",
        {
          "data-role": "image-placeholder",
          style: {
            display: "grid",
            placeItems: "center",
            minHeight: 180,
            padding: f.padding,
            color: f.colorTextSecondary,
            fontSize: f.fontSizeSM,
            textAlign: "center",
            height: l ? "100%" : void 0,
            boxSizing: "border-box"
          },
          children: Ct
        }
      )
    }
  );
}
function Lt(r) {
  return [r.title, r.alt, r.source === "url" ? r.url : r.file_path].find(
    (e) => e.trim().length > 0
  )?.trim() ?? "未命名图片";
}
function Y(r) {
  return r.source === "url" ? r.url : r.file_path;
}
function be(r) {
  const { config: e, onOpen: t, onResourceError: n } = r, { token: l } = T.useToken(), a = e.layout_options.grid_mode, d = te(e.layout_options.spacing_mode), u = It(a), p = Number.isFinite(u) && e.images.length > u, f = p ? e.images.slice(0, u) : e.images, y = p ? e.images.length - u + 1 : 0;
  return /* @__PURE__ */ o(
    "div",
    {
      "data-role": "grid-surface",
      style: {
        display: "grid",
        width: "100%",
        gap: `${d.gap}px`,
        gridTemplateColumns: `repeat(${xt(a)}, minmax(0, 1fr))`
      },
      children: f.map((h, g) => {
        const S = p && g === f.length - 1;
        return /* @__PURE__ */ m("div", { "data-role": "grid-cell", style: { position: "relative", minWidth: 0 }, children: [
          /* @__PURE__ */ o(
            j,
            {
              item: h,
              src: Y(h),
              radius: d.radius,
              aspectRatio: "1 / 1",
              fillHeight: !0,
              dimmed: S,
              onOpen: () => {
                t(h);
              },
              onResourceError: () => {
                n(h);
              }
            }
          ),
          S ? /* @__PURE__ */ m(
            "div",
            {
              "data-role": "grid-overflow-badge",
              "aria-label": `还有 ${y} 张图片未展示`,
              style: {
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                fontSize: 28,
                fontWeight: 700,
                color: l.colorWhite,
                background: "linear-gradient(180deg, rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.62))",
                pointerEvents: "none"
              },
              children: [
                "+",
                y
              ]
            }
          ) : null
        ] }, h.id);
      })
    }
  );
}
function At({ config: r }) {
  const { token: e } = T.useToken(), t = z(r), n = L(null), [l, a] = x({ state: "idle", message: null }), d = (g) => {
    const S = ze(g);
    S && (a({ state: "opening", message: "正在打开图片…" }), pt.request("resource:open", S).then(() => {
      a({ state: "idle", message: null });
    }).catch(() => {
      a({
        state: "error",
        message: "图片暂时无法打开：当前渲染环境未提供查看通道，请稍后重试"
      });
    }));
  }, u = (g) => {
    n.current && (n.current.scrollLeft += g.deltaY);
  };
  if (t.images.length === 0)
    return /* @__PURE__ */ o("div", { "data-card-type": G, children: /* @__PURE__ */ o(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          minHeight: 220,
          boxSizing: "border-box",
          borderRadius: e.borderRadiusLG,
          border: `1px dashed ${e.colorBorderSecondary}`,
          background: e.colorFillQuaternary
        },
        children: /* @__PURE__ */ o(
          Ge,
          {
            image: /* @__PURE__ */ o(je, { "aria-hidden": "true" }),
            description: /* @__PURE__ */ m(xe, { children: [
              /* @__PURE__ */ o("span", { style: { display: "block", fontWeight: 600 }, children: "暂无图片内容" }),
              /* @__PURE__ */ o("span", { style: { display: "block", marginTop: 4, fontSize: 13 }, children: "添加图片后，这里会按所选排版展示。" })
            ] })
          }
        )
      }
    ) });
  const p = ke(t), f = te(t.layout_options.spacing_mode), y = l.state === "idle" ? null : /* @__PURE__ */ o(
    "p",
    {
      role: "status",
      style: {
        margin: 0,
        marginTop: e.marginXXS,
        color: l.state === "error" ? e.colorError : e.colorTextSecondary,
        fontSize: e.fontSizeSM
      },
      children: l.message
    }
  );
  let h;
  if (p === "single") {
    const g = t.images[0];
    if (!g)
      return /* @__PURE__ */ o("div", { "data-card-type": G, children: /* @__PURE__ */ o(
        be,
        {
          config: t,
          onOpen: d,
          onResourceError: () => {
          }
        }
      ) });
    h = /* @__PURE__ */ o(
      "div",
      {
        "data-role": "single-surface",
        style: {
          display: "flex",
          width: "100%",
          justifyContent: Rt(t.layout_options.single_alignment)
        },
        children: /* @__PURE__ */ o("div", { style: { width: `${t.layout_options.single_width_percent}%`, maxWidth: "100%" }, children: /* @__PURE__ */ o(
          j,
          {
            item: g,
            src: Y(g),
            radius: f.radius,
            onOpen: () => {
              d(g);
            },
            onResourceError: () => {
            }
          }
        ) })
      }
    );
  } else p === "grid" ? h = /* @__PURE__ */ o(be, { config: t, onOpen: d, onResourceError: () => {
  } }) : p === "long-scroll" ? h = /* @__PURE__ */ o(
    "div",
    {
      "data-role": "long-scroll-stack",
      style: { display: "flex", flexDirection: "column", width: "100%", gap: `${f.gap}px` },
      children: t.images.map((g) => /* @__PURE__ */ o(
        j,
        {
          item: g,
          src: Y(g),
          radius: f.radius,
          onOpen: () => {
            d(g);
          },
          onResourceError: () => {
          }
        },
        g.id
      ))
    }
  ) : h = /* @__PURE__ */ o(
    "div",
    {
      ref: n,
      "data-role": "horizontal-scroller",
      onWheel: u,
      style: {
        width: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        overscrollBehaviorX: "contain"
      },
      children: /* @__PURE__ */ o(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "stretch",
            width: "max-content",
            minWidth: "100%",
            gap: `${f.gap}px`
          },
          children: t.images.map((g) => /* @__PURE__ */ o("div", { style: { flex: "0 0 auto", width: Et }, children: /* @__PURE__ */ o(
            j,
            {
              item: g,
              src: Y(g),
              radius: f.radius,
              fillHeight: !0,
              onOpen: () => {
                d(g);
              },
              onResourceError: () => {
              }
            }
          ) }, g.id))
        }
      )
    }
  );
  return /* @__PURE__ */ m("div", { "data-card-type": G, "data-layout": p, children: [
    h,
    y
  ] });
}
const kt = 6, zt = [
  {
    value: "grid",
    role: "layout-card-grid",
    title: "网格排版",
    description: "多图以规则网格展示，适合概览浏览。",
    glyph: "▦"
  },
  {
    value: "long-scroll",
    role: "layout-card-long_scroll",
    title: "纵向长图",
    description: "按顺序纵向完整展开，适合漫画、截图和长图。",
    glyph: "▤"
  },
  {
    value: "horizontal-scroll",
    role: "layout-card-horizontal_scroll",
    title: "横向滚动",
    description: "横向排列图片，适合画廊和分镜内容。",
    glyph: "▥"
  }
], Mt = [
  { label: "2 × 2", value: "2x2" },
  { label: "3 × 3", value: "3x3" },
  { label: "3 列无限", value: "3-column-infinite" }
];
function Ot(r) {
  return vt(r);
}
function ee({ children: r }) {
  const { token: e } = T.useToken();
  return /* @__PURE__ */ o(
    "h3",
    {
      style: {
        margin: 0,
        padding: `${e.paddingXS}px 0`,
        color: e.colorText,
        fontSize: e.fontSize,
        fontWeight: 700
      },
      children: r
    }
  );
}
function R({
  label: r,
  hint: e,
  error: t,
  children: n
}) {
  const { token: l } = T.useToken();
  return /* @__PURE__ */ m(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: "minmax(96px, 160px) minmax(0, 1fr)",
        gap: l.marginSM,
        padding: `${l.paddingSM}px 0`,
        borderBottom: `1px solid ${l.colorBorderSecondary}`,
        alignItems: "start"
      },
      children: [
        /* @__PURE__ */ m("div", { style: { display: "grid", gap: 2, paddingTop: 5 }, children: [
          /* @__PURE__ */ o("span", { style: { color: l.colorText, fontSize: l.fontSizeSM, fontWeight: 600 }, children: r }),
          e ? /* @__PURE__ */ o("span", { style: { color: l.colorTextSecondary, fontSize: l.fontSizeSM }, children: e }) : null
        ] }),
        /* @__PURE__ */ m("div", { style: { display: "grid", gap: l.marginXXS, minWidth: 0 }, children: [
          n,
          t ? /* @__PURE__ */ o("span", { role: "alert", style: { color: l.colorError, fontSize: l.fontSizeSM }, children: t }) : null
        ] })
      ]
    }
  );
}
function ve(r) {
  const { active: e, role: t, title: n, description: l, onClick: a } = r, { token: d } = T.useToken();
  return /* @__PURE__ */ m(
    "button",
    {
      type: "button",
      "data-role": t,
      "data-active": e ? "true" : "false",
      "aria-pressed": e,
      onClick: a,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: d.marginXXS,
        alignItems: "flex-start",
        minHeight: 72,
        padding: `${d.paddingSM}px ${d.padding}px`,
        borderRadius: d.borderRadius,
        border: `1px solid ${e ? d.colorPrimary : d.colorBorderSecondary}`,
        background: e ? d.colorPrimaryBg : d.colorBgContainer,
        color: e ? d.colorPrimary : d.colorText,
        textAlign: "left",
        cursor: "pointer",
        font: "inherit"
      },
      children: [
        /* @__PURE__ */ o("span", { style: { fontWeight: 700 }, children: n }),
        /* @__PURE__ */ o("span", { style: { color: d.colorTextSecondary, fontSize: d.fontSizeSM, lineHeight: 1.5 }, children: l })
      ]
    }
  );
}
function Dt(r) {
  const { item: e, selected: t, dragging: n, onPointerDown: l, onSelect: a } = r, { token: d } = T.useToken(), [u, p] = x(!1), f = e.source === "url" ? e.url : e.file_path;
  return Te.useEffect(() => {
    p(!1);
  }, [f]), /* @__PURE__ */ o(
    "div",
    {
      "data-role": "image-tile",
      "data-image-id": e.id,
      "data-dragging": n ? "true" : "false",
      "data-selected": t ? "true" : "false",
      role: "button",
      tabIndex: 0,
      onPointerDown: (y) => {
        l(e.id, y);
      },
      onClick: () => {
        a(e.id);
      },
      onKeyDown: (y) => {
        (y.key === "Enter" || y.key === " ") && (y.preventDefault(), a(e.id));
      },
      style: {
        position: "relative",
        width: 96,
        height: 96,
        overflow: "hidden",
        borderRadius: d.borderRadius,
        border: `1px solid ${t ? d.colorPrimary : d.colorBorderSecondary}`,
        boxShadow: t ? `0 0 0 3px ${d.colorPrimaryBg}` : "none",
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
        opacity: n ? 0.25 : 1,
        background: d.colorFillQuaternary,
        boxSizing: "border-box"
      },
      children: f.trim().length > 0 && !u ? /* @__PURE__ */ o(
        "img",
        {
          src: f,
          alt: "",
          draggable: !1,
          style: { display: "block", width: "100%", height: "100%", objectFit: "cover" },
          onError: () => {
            p(!0);
          }
        }
      ) : /* @__PURE__ */ o(
        "span",
        {
          style: {
            display: "grid",
            placeItems: "center",
            padding: d.paddingXS,
            height: "100%",
            boxSizing: "border-box",
            color: d.colorTextSecondary,
            fontSize: d.fontSizeSM,
            textAlign: "center"
          },
          children: "图片暂时不可用"
        }
      )
    }
  );
}
function Pt({ config: r, onChange: e }) {
  const { token: t } = T.useToken(), [n, l] = x(() => z(r)), a = L(n), [d, u] = x(n.images[0]?.id ?? null), [p, f] = x(""), [y, h] = x(""), g = L(""), S = L(""), [k, Me] = x([]), [V, re] = x(null), q = L(null), [w, Z] = x(null), [ne, Q] = x(!1), M = L(null), N = L(!1), ie = (i) => {
    const s = z(i);
    a.current = s, l(s), e(s);
  }, C = (i) => {
    ie({ ...a.current, ...i });
  }, O = (i) => {
    C({
      layout_options: { ...a.current.layout_options, ...i }
    });
  }, B = (i) => {
    Me(i.filter((s) => s.trim().length > 0));
  }, b = n.images.find((i) => i.id === d) ?? n.images[0] ?? null, J = ke(n), Oe = n.images.length > 1, oe = () => {
    const i = g.current.trim();
    if (i.length === 0)
      return;
    if (!K(i).valid) {
      B(["图片 URL 不合法，请输入 http(s) 或 webdav:// 地址。"]);
      return;
    }
    const s = Tt(i), c = a.current.images.length, _ = wt(
      { ...a.current, images: [...a.current.images, s] },
      c
    );
    ie(_), u(s.id), g.current = "", f(""), B([]);
  }, le = () => {
    const i = b;
    if (!i)
      return;
    const s = S.current.trim();
    if (s.length !== 0) {
      if (!K(s).valid) {
        B(["图片 URL 不合法，请输入 http(s) 或 webdav:// 地址。"]);
        return;
      }
      C({
        images: a.current.images.map(
          (c) => c.id === i.id ? { ...c, source: "url", file_path: "", url: s } : c
        )
      }), S.current = "", h(""), B([]);
    }
  }, ae = (i, s) => {
    C({
      images: a.current.images.map(
        (c) => c.id === i ? { ...c, ...s } : c
      )
    });
  }, se = (i) => {
    const s = a.current.images.filter((c) => c.id !== i);
    C({ images: s }), d === i && (u(s[0]?.id ?? null), S.current = "", h(""));
  }, De = () => {
    C({ images: [] }), u(null), S.current = "", h("");
  }, Pe = (i, s) => {
    const c = a.current.images.findIndex((I) => I.id === i);
    if (c === -1 || c === s)
      return;
    const _ = Math.max(0, Math.min(s, a.current.images.length - 1));
    C({ images: mt(a.current.images, c, _) });
  }, We = (i) => {
    a.current.images.length > 1 && i === "single" || C({ layout_type: i });
  }, de = (i, s) => {
    const c = M.current;
    if (M.current = null, window.removeEventListener("pointermove", ue), window.removeEventListener("pointerup", ge), window.removeEventListener("pointercancel", pe), re(null), Z(null), N.current = !1, Q(!1), !(!c || !c.started)) {
      if (i) {
        se(c.imageId);
        return;
      }
      s !== null && Pe(c.imageId, s);
    }
  };
  function ce(i, s) {
    const c = M.current, _ = q.current;
    if (!c || !_)
      return null;
    const I = Array.from(
      _.querySelectorAll('[data-role="image-tile"][data-dragging="false"]')
    ).filter((E) => E.dataset.imageId !== c.imageId).map((E) => E.getBoundingClientRect()), U = a.current.images.length - 1;
    return yt(i, s, I, U);
  }
  function Ne(i, s) {
    const c = q.current?.querySelector('[data-role="delete-tray"]');
    if (!c)
      return !1;
    const _ = c.getBoundingClientRect();
    return i >= _.left && i <= _.right && s >= _.top && s <= _.bottom;
  }
  function ue(i) {
    const s = M.current;
    if (!s)
      return;
    if (!s.started) {
      const I = i.clientX - s.startX, U = i.clientY - s.startY;
      if (Math.hypot(I, U) < kt)
        return;
      s.started = !0, re(s.imageId);
      const E = a.current.images.find((He) => He.id === s.imageId);
      Z({
        imageId: s.imageId,
        previewUrl: E?.source === "url" ? E?.url ?? "" : E?.file_path ?? "",
        width: 96,
        height: 96,
        offsetX: I,
        offsetY: U,
        clientX: i.clientX,
        clientY: i.clientY
      });
    }
    i.preventDefault();
    const c = Ne(i.clientX, i.clientY);
    if (N.current = c, Q(c), c)
      return;
    ce(i.clientX, i.clientY) !== null && Z((I) => I && { ...I, clientX: i.clientX, clientY: i.clientY });
  }
  function ge(i) {
    const s = N.current, c = s ? null : ce(i.clientX, i.clientY);
    de(s, c);
  }
  function pe() {
    de(!1, null);
  }
  const Be = (i, s) => {
    if (s.button !== 0 || s.pointerType === "touch")
      return;
    const c = a.current.images.findIndex((_) => _.id === i);
    c !== -1 && (s.preventDefault(), s.currentTarget.setPointerCapture?.(s.pointerId), M.current = {
      imageId: i,
      originIndex: c,
      startX: s.clientX,
      startY: s.clientY,
      started: !1
    }, N.current = !1, Q(!1), window.addEventListener("pointermove", ue, { passive: !1 }), window.addEventListener("pointerup", ge), window.addEventListener("pointercancel", pe));
  }, Ue = (i) => {
    g.current = i.currentTarget.value, f(i.currentTarget.value);
  }, Xe = (i) => {
    S.current = i.currentTarget.value, h(i.currentTarget.value);
  }, $e = te(n.layout_options.spacing_mode), Fe = {
    display: "flex",
    flexWrap: "wrap",
    gap: t.marginSM
  };
  return /* @__PURE__ */ m(
    "div",
    {
      ref: q,
      style: {
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "auto",
        padding: t.padding,
        boxSizing: "border-box"
      },
      children: [
        /* @__PURE__ */ m("section", { style: { display: "grid", gap: 0, maxWidth: 760, margin: "0 auto", paddingBottom: 64 }, children: [
          /* @__PURE__ */ m(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: t.marginXS
              },
              children: [
                /* @__PURE__ */ o(ee, { children: "图片列表" }),
                n.images.length > 0 ? /* @__PURE__ */ o(
                  D,
                  {
                    "data-role": "clear-all",
                    danger: !0,
                    icon: /* @__PURE__ */ o(Ye, { "aria-hidden": "true" }),
                    onClick: De,
                    children: "清空全部"
                  }
                ) : null
              ]
            }
          ),
          k.length > 0 ? /* @__PURE__ */ o("div", { style: { display: "grid", gap: t.marginXXS, paddingTop: t.marginXS }, children: k.map((i, s) => /* @__PURE__ */ o(
            "div",
            {
              role: "alert",
              "data-tone": "error",
              style: {
                padding: `${t.paddingXS}px ${t.paddingSM}px`,
                borderRadius: t.borderRadius,
                color: t.colorError,
                background: t.colorErrorBg,
                fontSize: t.fontSizeSM
              },
              children: i
            },
            `${i}-${s}`
          )) }) : null,
          n.images.length === 0 ? /* @__PURE__ */ o(
            "p",
            {
              style: {
                margin: 0,
                padding: `${t.paddingLG}px 0`,
                color: t.colorTextSecondary,
                textAlign: "center"
              },
              children: "还没有图片，请先通过链接添加远程图片。"
            }
          ) : /* @__PURE__ */ o("div", { style: { ...Fe, paddingTop: t.marginSM }, children: n.images.map((i) => /* @__PURE__ */ o(
            Dt,
            {
              item: i,
              selected: b?.id === i.id,
              dragging: V === i.id,
              onPointerDown: Be,
              onSelect: (s) => {
                u(s), S.current = "", h("");
              }
            },
            i.id
          )) }),
          n.images.length > 1 ? /* @__PURE__ */ o("p", { style: { margin: 0, paddingTop: t.marginXS, color: t.colorTextSecondary, fontSize: t.fontSizeSM }, children: "拖拽图片可调整顺序，拖到底部托盘可删除图片。" }) : null,
          b ? /* @__PURE__ */ m(
            "div",
            {
              style: {
                display: "grid",
                gap: t.marginSM,
                marginTop: t.marginSM,
                padding: t.paddingSM,
                border: `1px solid ${t.colorBorderSecondary}`,
                borderRadius: t.borderRadiusLG
              },
              children: [
                /* @__PURE__ */ m("div", { style: { display: "flex", alignItems: "center", gap: t.marginXS, flexWrap: "wrap" }, children: [
                  /* @__PURE__ */ o(Ke, { color: "processing", children: b.source === "file" ? "本地资源" : "远程链接" }),
                  /* @__PURE__ */ o("span", { style: { color: t.colorTextSecondary, fontSize: t.fontSizeSM }, children: b.source === "file" ? b.file_path : b.url }),
                  /* @__PURE__ */ o("span", { style: { flex: "1 1 auto" } }),
                  /* @__PURE__ */ o(D, { "data-role": "remove-image", size: "small", danger: !0, onClick: () => {
                    se(b.id);
                  }, children: "删除此图" })
                ] }),
                /* @__PURE__ */ o(R, { label: "图片标题", hint: "展示于查看器标题栏", children: /* @__PURE__ */ o(
                  X,
                  {
                    "data-role": "image-title-input",
                    value: b.title,
                    placeholder: "输入查看器标题",
                    onChange: (i) => {
                      ae(b.id, { title: i.currentTarget.value });
                    }
                  }
                ) }),
                /* @__PURE__ */ o(R, { label: "替代文本", hint: "描述图片内容，供辅助技术使用", children: /* @__PURE__ */ o(
                  X,
                  {
                    "data-role": "image-alt-input",
                    value: b.alt,
                    placeholder: "描述图片内容，供辅助技术使用",
                    onChange: (i) => {
                      ae(b.id, { alt: i.currentTarget.value });
                    }
                  }
                ) }),
                /* @__PURE__ */ o(R, { label: "替换链接", hint: "把当前图片替换为远程地址", children: /* @__PURE__ */ m("div", { style: { display: "flex", gap: t.marginXS, flexWrap: "wrap" }, children: [
                  /* @__PURE__ */ o(
                    X,
                    {
                      "data-role": "replace-url-input",
                      style: { flex: "1 1 240px" },
                      value: y,
                      placeholder: "https://example.com/photo.jpg",
                      onChange: Xe,
                      onPressEnter: le
                    }
                  ),
                  /* @__PURE__ */ o(D, { "data-role": "replace-by-url", onClick: le, children: "替换链接" })
                ] }) })
              ]
            }
          ) : null,
          /* @__PURE__ */ m(
            "div",
            {
              style: {
                display: "grid",
                gap: t.marginSM,
                marginTop: t.marginLG,
                padding: t.paddingSM,
                border: `1px solid ${t.colorBorderSecondary}`,
                borderRadius: t.borderRadiusLG
              },
              children: [
                /* @__PURE__ */ o(ee, { children: "排版设置" }),
                n.images.length === 0 ? /* @__PURE__ */ o("p", { style: { margin: 0, color: t.colorTextSecondary, fontSize: t.fontSizeSM }, children: "添加图片后可在此选择排版类型与间距。" }) : Oe ? /* @__PURE__ */ o("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: t.marginSM }, children: zt.map((i) => /* @__PURE__ */ m(
                  "button",
                  {
                    type: "button",
                    "data-role": i.role,
                    "data-active": n.layout_type === i.value ? "true" : "false",
                    "aria-pressed": n.layout_type === i.value,
                    onClick: () => {
                      We(i.value);
                    },
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: t.marginXXS,
                      alignItems: "flex-start",
                      minHeight: 96,
                      padding: t.paddingSM,
                      borderRadius: t.borderRadius,
                      border: `1px solid ${n.layout_type === i.value ? t.colorPrimary : t.colorBorderSecondary}`,
                      background: n.layout_type === i.value ? t.colorPrimaryBg : t.colorBgContainer,
                      color: n.layout_type === i.value ? t.colorPrimary : t.colorText,
                      textAlign: "left",
                      cursor: "pointer",
                      font: "inherit"
                    },
                    children: [
                      /* @__PURE__ */ o("span", { "aria-hidden": "true", style: { fontSize: t.fontSizeLG }, children: i.glyph }),
                      /* @__PURE__ */ o("span", { style: { fontWeight: 700 }, children: i.title }),
                      /* @__PURE__ */ o("span", { style: { color: t.colorTextSecondary, fontSize: t.fontSizeSM }, children: i.description })
                    ]
                  },
                  i.value
                )) }) : /* @__PURE__ */ o("p", { style: { margin: 0, color: t.colorTextSecondary, fontSize: t.fontSizeSM }, children: "当前只有 1 张图片，渲染时会自动使用单图模式。" }),
                n.images.length > 0 && J === "single" ? /* @__PURE__ */ m(xe, { children: [
                  /* @__PURE__ */ o(R, { label: "单图宽度", hint: `${n.layout_options.single_width_percent}%（10 ~ 100）`, children: /* @__PURE__ */ o("div", { "data-role": "single-width-slider", style: { paddingRight: t.marginSM }, children: /* @__PURE__ */ o(
                    Ve,
                    {
                      min: 10,
                      max: 100,
                      step: 5,
                      value: n.layout_options.single_width_percent,
                      onChange: (i) => {
                        O({ single_width_percent: i });
                      }
                    }
                  ) }) }),
                  /* @__PURE__ */ o(R, { label: "单图对齐", children: /* @__PURE__ */ o("div", { style: { display: "inline-flex", gap: t.marginXS, flexWrap: "wrap" }, children: [
                    ["left", "靠左"],
                    ["center", "居中"],
                    ["right", "靠右"]
                  ].map(([i, s]) => /* @__PURE__ */ o(
                    D,
                    {
                      "data-role": `align-${i}`,
                      type: n.layout_options.single_alignment === i ? "primary" : "default",
                      onClick: () => {
                        O({ single_alignment: i });
                      },
                      children: s
                    },
                    i
                  )) }) })
                ] }) : null,
                n.images.length > 0 && J === "grid" ? /* @__PURE__ */ o(R, { label: "网格模式", children: /* @__PURE__ */ o("span", { "data-role": "grid-mode-segmented", children: /* @__PURE__ */ o(
                  qe,
                  {
                    options: Mt.map((i) => ({ label: i.label, value: i.value })),
                    value: n.layout_options.grid_mode,
                    onChange: (i) => {
                      O({ grid_mode: i });
                    }
                  }
                ) }) }) : null,
                n.images.length > 0 && J !== "single" ? /* @__PURE__ */ o(
                  R,
                  {
                    label: "图片间距",
                    hint: $e.gap === 0 ? "图片之间无空隙，图片边角保持直角。" : "图片之间保留适当留白，并使用小圆角。",
                    children: /* @__PURE__ */ m("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: t.marginSM }, children: [
                      /* @__PURE__ */ o(
                        ve,
                        {
                          active: n.layout_options.spacing_mode === "none",
                          role: "spacing-none",
                          title: "零间距",
                          description: "图片之间无空隙，图片边角保持直角。",
                          onClick: () => {
                            O({ spacing_mode: "none" });
                          }
                        }
                      ),
                      /* @__PURE__ */ o(
                        ve,
                        {
                          active: n.layout_options.spacing_mode !== "none",
                          role: "spacing-comfortable",
                          title: "适当间距",
                          description: "图片之间保留适当留白，并使用小圆角。",
                          onClick: () => {
                            O({ spacing_mode: "comfortable" });
                          }
                        }
                      )
                    ] })
                  }
                ) : null
              ]
            }
          ),
          /* @__PURE__ */ m(
            "div",
            {
              style: {
                display: "grid",
                gap: t.marginSM,
                marginTop: t.marginLG,
                padding: t.paddingSM,
                border: `1px dashed ${t.colorBorderSecondary}`,
                borderRadius: t.borderRadiusLG
              },
              children: [
                /* @__PURE__ */ o(ee, { children: "添加图片" }),
                /* @__PURE__ */ o("p", { style: { margin: 0, color: t.colorTextSecondary, fontSize: t.fontSizeSM }, children: "本地图片文件导入依赖编辑器资源导入通道（工单063），通道交付前可先通过链接添加远程图片； 旧卡片中的本地图片仍可正常编辑信息与排版。" }),
                /* @__PURE__ */ m("div", { style: { display: "flex", gap: t.marginXS, flexWrap: "wrap" }, children: [
                  /* @__PURE__ */ o(
                    X,
                    {
                      "data-role": "add-url-input",
                      style: { flex: "1 1 240px" },
                      value: p,
                      placeholder: "输入图片 URL，例如 https://example.com/photo.jpg",
                      onChange: Ue,
                      onPressEnter: oe
                    }
                  ),
                  /* @__PURE__ */ o(D, { "data-role": "add-by-url", type: "primary", onClick: oe, children: "通过链接添加" })
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ o(
          "div",
          {
            "data-role": "delete-tray",
            "data-active": V ? "true" : "false",
            "data-over": ne ? "true" : "false",
            style: {
              position: "fixed",
              left: "50%",
              bottom: 16,
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "min(calc(100% - 32px), 280px)",
              minHeight: 52,
              padding: `0 ${t.padding}px`,
              borderRadius: t.borderRadius,
              border: `1px solid ${ne ? t.colorError : t.colorErrorBorder}`,
              background: t.colorErrorBg,
              color: t.colorError,
              fontSize: t.fontSizeSM,
              fontWeight: 700,
              opacity: V ? 1 : 0,
              pointerEvents: "none",
              boxSizing: "border-box"
            },
            children: "拖动到这里删除图片"
          }
        ),
        w ? /* @__PURE__ */ o(
          "div",
          {
            "data-role": "drag-preview",
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: 2147483647,
              width: w.width,
              height: w.height,
              pointerEvents: "none",
              transform: `translate3d(${w.clientX - w.offsetX}px, ${w.clientY - w.offsetY}px, 0)`,
              overflow: "hidden",
              borderRadius: t.borderRadius,
              border: `1px solid ${t.colorBorderSecondary}`,
              background: t.colorBgContainer,
              boxShadow: t.boxShadowSecondary
            },
            children: w.previewUrl.trim().length > 0 ? /* @__PURE__ */ o(
              "img",
              {
                src: w.previewUrl,
                alt: "",
                draggable: !1,
                style: { display: "block", width: "100%", height: "100%", objectFit: "cover" }
              }
            ) : /* @__PURE__ */ o(
              "span",
              {
                style: {
                  display: "grid",
                  placeItems: "center",
                  height: "100%",
                  color: t.colorTextSecondary,
                  fontSize: t.fontSizeSM
                },
                children: "图片暂时不可用"
              }
            )
          }
        ) : null
      ]
    }
  );
}
const H = /* @__PURE__ */ new WeakMap();
function Wt(r, e) {
  H.get(e)?.(), e.replaceChildren();
  const t = we(e);
  Ie(() => {
    t.render(/* @__PURE__ */ o(At, { config: r.content.config }));
  });
  let n = !1;
  const l = () => {
    n || (n = !0, t.unmount(), H.get(e) === l && H.delete(e));
  };
  return H.set(e, l), l;
}
function Nt(r) {
  return /* @__PURE__ */ o(Pt, { ...r });
}
class Bt {
  state = "active";
  base;
  revision;
  pending = null;
  dirty = !1;
  host;
  root;
  changeHandlers = /* @__PURE__ */ new Set();
  dirtyHandlers = /* @__PURE__ */ new Set();
  constructor(e, t) {
    this.base = z(e.content.config), this.revision = e.revision, this.host = t, t.replaceChildren(), this.root = we(t), this.mount();
  }
  isDirty() {
    return this.pending !== null;
  }
  getChange() {
    return this.pending;
  }
  markCommitted(e) {
    if (this.state === "disposed" || e <= this.revision)
      return;
    const t = this.pending;
    this.revision = e, t !== null && t.kind === "replace" && (this.base = z(t.content.config)), this.pending === t && (this.pending = null, this.setDirty(!1));
  }
  update(e, t) {
    this.state === "disposed" || t <= this.revision || (this.revision = t, this.base = z(e.content.config), this.pending = null, this.setDirty(!1), this.mount());
  }
  subscribe(e, t) {
    if (this.state === "disposed")
      return { dispose: () => {
      } };
    if (e === "change") {
      const l = t;
      return this.changeHandlers.add(l), {
        dispose: () => {
          this.changeHandlers.delete(l);
        }
      };
    }
    const n = t;
    return this.dirtyHandlers.add(n), {
      dispose: () => {
        this.dirtyHandlers.delete(n);
      }
    };
  }
  focus() {
    this.state === "active" && this.host.querySelector("input")?.focus();
  }
  dispose() {
    this.state !== "disposed" && (this.root.unmount(), this.changeHandlers.clear(), this.dirtyHandlers.clear(), this.pending = null, this.dirty = !1, this.state = "disposed");
  }
  mount() {
    Ie(() => {
      this.root.render(
        /* @__PURE__ */ o(
          Nt,
          {
            config: this.base,
            onChange: this.handleConfigChange
          },
          this.revision
        )
      );
    });
  }
  handleConfigChange = (e) => {
    if (this.state !== "active" || !Ot(e))
      return;
    const t = {
      kind: "replace",
      content: {
        card_type: G,
        config: { ...e }
      }
    }, n = this.pending !== null;
    this.pending = t, n || this.setDirty(!0);
    for (const l of this.changeHandlers)
      l({ change: t });
  };
  setDirty(e) {
    if (this.dirty !== e) {
      this.dirty = e;
      for (const t of this.dirtyHandlers)
        t({ isDirty: e });
    }
  }
}
function Ut(r, e) {
  return new Bt(r, e);
}
const jt = {
  renderView: Wt,
  renderEditor: Ut
};
export {
  jt as default,
  Ut as renderEditor,
  jt as renderPlugin,
  Wt as renderView
};
