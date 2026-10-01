import { jsx as r, jsxs as c, Fragment as G } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { flushSync as H } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as U } from "chips-resource://platform/vendor/react-dom-client.js";
import q, { useState as ee, useRef as te } from "chips-resource://platform/vendor/react.js";
import { theme as T, Empty as ie, VideoCameraOutlined as ne, CaretRightFilled as re, Tag as M, Input as y, Button as F, InputNumber as P, Switch as oe } from "chips-resource://platform/vendor/chips-ui.js";
class S extends Error {
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
    return new S({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function ae(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const le = "SDK_BRIDGE_UNAVAILABLE", K = "SDK_UNKNOWN_ERROR", V = "发生未知错误";
function se(t) {
  return t instanceof Error;
}
function de(t) {
  if (t instanceof S)
    return t;
  if (ae(t)) {
    const e = t, i = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new S(i);
  }
  return se(t) ? new S({
    code: K,
    message: V,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new S({
    code: K,
    message: V,
    details: { value: String(t) },
    retryable: !1
  });
}
function ce() {
  return new S({
    code: le,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function h(t, e, i) {
  let n;
  try {
    n = t();
  } catch (o) {
    return Promise.reject(de(o));
  }
  return n.request(e, i);
}
const ue = "cli.command.list", pe = "cli.command.get", he = "cli.command.resolve";
function fe(t) {
  return {
    list(e) {
      return h(t, ue, e ?? {});
    },
    get(e) {
      return h(t, pe, e);
    },
    resolve(e) {
      return h(t, he, e);
    }
  };
}
const k = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, me = "cli.task.create", ge = "cli.task.bindInvocation", ye = "cli.task.cancel";
function be(t) {
  return {
    create(e) {
      return h(t, me, e).then((i) => i.task);
    },
    bindInvocation(e) {
      return h(t, ge, e).then((i) => i.task);
    },
    get(e) {
      const i = { taskId: e };
      return h(t, k.CLI_TASK_GET, i).then((n) => n.task);
    },
    active(e) {
      const i = { commandId: e };
      return h(t, k.CLI_TASK_ACTIVE, i).then((n) => n.task);
    },
    progress(e, i) {
      const n = { taskId: e, progress: i };
      return h(t, k.CLI_TASK_PROGRESS, n).then((o) => o.task);
    },
    complete(e, i) {
      const n = {
        taskId: e,
        ...i === void 0 ? {} : { output: i }
      };
      return h(t, k.CLI_TASK_COMPLETE, n).then((o) => o.task);
    },
    fail(e, i) {
      const n = { taskId: e, error: i };
      return h(t, k.CLI_TASK_FAIL, n).then((o) => o.task);
    },
    cancel(e) {
      return h(t, ye, { taskId: e }).then((i) => i.task);
    }
  };
}
function Se() {
  return globalThis.window?.chips;
}
class ve {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = fe(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = be(() => this.#e());
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
    const e = Se();
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
  request(e, i) {
    return h(() => this.#e(), e, i);
  }
  /**
   * 订阅标准事件；转发给目标 Bridge。
   *
   * @param eventId - 事件 ID
   * @param handler - 载荷回调；同一 `(eventId, handler)` 多次订阅各自独立
   * @returns 可退订句柄，`dispose()` 幂等
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  subscribe(e, i) {
    return this.#e().subscribe(e, i);
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
function _e(t) {
  return new ve(t?.bridge);
}
const Ce = _e(), $ = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function I(t) {
  return typeof t == "string" && t.trim().length > 0;
}
function ke(t, e = 10) {
  let i = "";
  for (let n = 0; n < e; n += 1)
    i += $[Math.floor(Math.random() * $.length)];
  return `${t}-${i}`;
}
function v(t) {
  if (!I(t))
    return;
  const e = t.trim();
  if (!e || e.includes("\\") || e.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(e))
    return;
  const i = e.replace(/^\.\//, "");
  if (!i)
    return;
  const n = i.split("/").filter(Boolean);
  if (!(n.length === 0 || n.some((o) => o === "." || o === "..")))
    return n.join("/");
}
function z(t) {
  const e = v(t);
  if (!e)
    return "";
  const i = e.split("/");
  return i[i.length - 1] ?? "";
}
function Te(t) {
  return t.replace(/\.[^.]+$/u, "");
}
function Ee(t) {
  const e = z(t).toLowerCase();
  if (e.endsWith(".mp4"))
    return "video/mp4";
  if (e.endsWith(".webm"))
    return "video/webm";
  if (e.endsWith(".mov"))
    return "video/quicktime";
  if (e.endsWith(".m4v"))
    return "video/x-m4v";
  if (e.endsWith(".ogv") || e.endsWith(".ogg"))
    return "video/ogg";
}
function xe(t) {
  const e = z(t).toLowerCase();
  if (e.endsWith(".vtt"))
    return "text/vtt";
  if (e.endsWith(".srt"))
    return "application/x-subrip";
  if (e.endsWith(".ass") || e.endsWith(".ssa"))
    return "text/plain";
}
const B = "base.video", Q = 0.25, Y = 4;
function _(t) {
  return typeof t == "string" ? t.trim() : "";
}
function w(t) {
  return t === !0;
}
function j(t, e) {
  const i = typeof t == "number" ? t : Number(t);
  return Number.isFinite(i) ? i : e;
}
function Re(t, e, i) {
  return Math.min(Math.max(t, e), i);
}
function N(t) {
  return v(t) ?? "";
}
function Ae(t) {
  return t === "captions" ? "captions" : "subtitles";
}
function we(t, e) {
  const i = t !== null && typeof t == "object" ? t : {};
  return typeof i.id == "string" || typeof i.label == "string" || typeof i.language == "string" || "kind" in i || typeof i.file_path == "string" || "default" in i ? {
    id: _(i.id) || `subtitle-${e + 1}`,
    label: _(i.label),
    language: _(i.language),
    kind: Ae(i.kind),
    file_path: N(i.file_path),
    default: w(i.default)
  } : null;
}
function Ie(t) {
  const e = t !== null && typeof t == "object" ? t : {}, i = Re(
    j(e.playback_rate, 1),
    Q,
    Y
  ), n = Math.max(0, j(e.start_time, 0));
  return {
    autoplay: w(e.autoplay),
    loop: w(e.loop),
    muted: w(e.muted),
    playback_rate: Number(i.toFixed(2)),
    start_time: Number(n.toFixed(3))
  };
}
function C(t) {
  const e = typeof t == "object" && t !== null ? t : {}, i = Array.isArray(e.subtitles) ? e.subtitles.map((o, l) => we(o, l)).filter((o) => o !== null) : [], n = i.find((o) => o.default)?.id;
  return {
    video_file: N(e.video_file),
    cover_image: N(e.cover_image),
    subtitles: i.map((o) => ({
      ...o,
      default: !!(n && o.id === n)
    })),
    playback: Ie(e.playback),
    video_title: _(e.video_title),
    publish_time: _(e.publish_time),
    creator: _(e.creator)
  };
}
function ze(t) {
  return t === void 0 ? !0 : typeof t != "string" ? !1 : t.trim().length === 0 ? !0 : v(t) !== void 0;
}
function Le(t) {
  if (t === null || typeof t != "object" || Array.isArray(t))
    return !1;
  const e = t;
  if (!I(e.id) || !I(e.file_path) || v(e.file_path) === void 0)
    return !1;
  for (const i of ["label", "language"])
    if (e[i] !== void 0 && typeof e[i] != "string")
      return !1;
  return !(e.kind !== void 0 && e.kind !== "subtitles" && e.kind !== "captions" || e.default !== void 0 && typeof e.default != "boolean");
}
function Me(t) {
  if (t === void 0)
    return !0;
  if (t === null || typeof t != "object" || Array.isArray(t))
    return !1;
  const e = t;
  for (const i of ["autoplay", "loop", "muted"])
    if (e[i] !== void 0 && typeof e[i] != "boolean")
      return !1;
  if (e.playback_rate !== void 0) {
    const i = e.playback_rate;
    if (typeof i != "number" || !Number.isFinite(i) || i < Q || i > Y)
      return !1;
  }
  if (e.start_time !== void 0) {
    const i = e.start_time;
    if (typeof i != "number" || !Number.isFinite(i) || i < 0)
      return !1;
  }
  return !0;
}
function Ne(t) {
  if (t == null)
    return !0;
  if (typeof t != "object" || Array.isArray(t))
    return !1;
  const e = t;
  for (const i of ["video_file", "cover_image"])
    if (!ze(e[i]))
      return !1;
  for (const i of ["video_title", "publish_time", "creator"])
    if (e[i] !== void 0 && typeof e[i] != "string")
      return !1;
  return !(e.subtitles !== void 0 && (!Array.isArray(e.subtitles) || !e.subtitles.every((i) => Le(i))) || !Me(e.playback));
}
function O(t) {
  if (I(t.video_title))
    return t.video_title.trim();
  const e = z(t.video_file);
  return e ? Te(e) : "";
}
function We(t) {
  return [t.creator.trim(), t.publish_time.trim()].filter((e) => e.length > 0).join(" · ");
}
function W(t) {
  const e = v(t);
  if (!e)
    return null;
  const i = z(e), n = Ee(e);
  return {
    uri: e,
    relativePath: e,
    ...i ? { fileName: i } : {},
    ...n === void 0 ? {} : { mimeType: n }
  };
}
function Be(t) {
  const e = W(t.file_path);
  if (!e)
    return null;
  const i = xe(t.file_path);
  return {
    ...e,
    ...i === void 0 ? {} : { mimeType: i },
    id: t.id,
    ...t.label ? { label: t.label } : {},
    ...t.language ? { language: t.language } : {},
    kind: t.kind,
    default: t.default
  };
}
function Z(t) {
  const e = W(t.video_file);
  if (!e)
    return null;
  const i = W(t.cover_image), n = t.subtitles.map((p) => Be(p)).filter((p) => p !== null), o = O(t), l = t.creator.trim(), u = t.publish_time.trim(), f = {
    kind: "chips.video-card",
    version: "1.0.0",
    cardType: B,
    resources: {
      video: e,
      ...i === null ? {} : { cover: i },
      ...n.length === 0 ? {} : { subtitles: n }
    },
    display: {
      title: o,
      ...l ? { creator: l } : {},
      ...u ? { publishTime: u } : {}
    },
    playback: {
      autoplay: t.playback.autoplay,
      loop: t.playback.loop,
      muted: t.playback.muted,
      playbackRate: t.playback.playback_rate,
      startTime: t.playback.start_time
    }
  };
  return {
    intent: "view",
    resource: {
      uri: e.uri,
      ...e.mimeType === void 0 ? {} : { mimeType: e.mimeType },
      ...e.fileName === void 0 ? {} : { fileName: e.fileName },
      title: o,
      payload: f
    }
  };
}
const J = 16, X = 0.08;
function Oe({ src: t }) {
  const e = q.useRef(null);
  return /* @__PURE__ */ r(
    "video",
    {
      ref: e,
      "data-role": "video-fallback",
      src: t,
      preload: "metadata",
      muted: !0,
      onLoadedMetadata: () => {
        const n = e.current;
        if (!n)
          return;
        const o = Number.isFinite(n.duration) ? n.duration : 0, l = o > X ? Math.min(X, o / 2) : 0;
        if (l <= 0) {
          n.pause();
          return;
        }
        try {
          n.currentTime = l;
        } catch {
          n.pause();
        }
      },
      "aria-hidden": "true",
      style: {
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "cover"
      }
    }
  );
}
function De({ config: t, onOpen: e, outcome: i }) {
  const { token: n } = T.useToken(), o = O(t), l = We(t), f = Z(t) !== null, p = t.subtitles.filter((g) => g.file_path.length > 0).length, b = [
    p > 0 ? `${p} 条字幕` : "",
    t.playback.loop ? "循环" : "",
    t.playback.autoplay ? "自动播放" : "",
    t.playback.playback_rate !== 1 ? `倍速 ${t.playback.playback_rate}x` : "",
    t.playback.start_time > 0 ? `起始 ${t.playback.start_time} 秒` : ""
  ].filter((g) => g.length > 0), L = {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: n.borderRadiusLG,
    overflow: "hidden",
    background: n.colorFillQuaternary
  }, E = /* @__PURE__ */ c(G, { children: [
    /* @__PURE__ */ c("span", { style: L, children: [
      t.cover_image.length > 0 ? /* @__PURE__ */ r(
        "img",
        {
          "data-role": "video-cover",
          src: t.cover_image,
          alt: o,
          draggable: !1,
          loading: "lazy",
          style: {
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }
        }
      ) : /* @__PURE__ */ r(Oe, { src: t.video_file }),
      /* @__PURE__ */ r(
        "span",
        {
          "aria-hidden": "true",
          style: {
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: n.colorBgMask
          },
          children: /* @__PURE__ */ r(
            "span",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: n.colorBgSpotlight
              },
              children: /* @__PURE__ */ r(
                re,
                {
                  "aria-hidden": "true",
                  style: { marginLeft: 4, fontSize: 30, color: n.colorTextLightSolid }
                }
              )
            }
          )
        }
      )
    ] }),
    b.length > 0 || l ? /* @__PURE__ */ c(
      "span",
      {
        style: {
          display: "grid",
          gap: n.marginXXS,
          paddingTop: n.paddingXS
        },
        children: [
          t.video_title.trim() ? /* @__PURE__ */ r(
            "span",
            {
              style: {
                margin: 0,
                color: n.colorText,
                fontSize: n.fontSizeLG,
                fontWeight: 600,
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                overflowWrap: "anywhere"
              },
              children: t.video_title.trim()
            }
          ) : null,
          l ? /* @__PURE__ */ r(
            "span",
            {
              style: {
                margin: 0,
                color: n.colorTextSecondary,
                fontSize: n.fontSizeSM
              },
              children: l
            }
          ) : null,
          b.length > 0 ? /* @__PURE__ */ r("span", { style: { display: "flex", flexWrap: "wrap", gap: n.marginXXS }, children: b.map((g) => /* @__PURE__ */ r(M, { style: { marginInlineEnd: 0 }, children: g }, g)) }) : null
        ]
      }
    ) : null
  ] }), x = {
    display: "grid",
    gap: 0,
    width: "100%",
    padding: n.paddingSM,
    boxSizing: "border-box",
    borderRadius: J,
    border: `1px ${f ? "solid" : "dashed"} ${n.colorBorderSecondary}`,
    background: n.colorFillQuaternary,
    textAlign: "left"
  };
  return /* @__PURE__ */ c("div", { style: { width: "100%", minWidth: 0 }, children: [
    f ? /* @__PURE__ */ r(
      "button",
      {
        type: "button",
        "data-role": "video-open",
        "aria-label": o ? `打开视频：${o}` : "打开视频",
        onClick: e,
        style: {
          cursor: "pointer",
          font: "inherit",
          color: "inherit",
          appearance: "none",
          ...x
        },
        children: E
      }
    ) : /* @__PURE__ */ r(
      "div",
      {
        role: "group",
        "aria-label": "视频引用缺失或非法，暂无法打开播放器",
        style: x,
        children: E
      }
    ),
    i.state !== "idle" ? /* @__PURE__ */ r(
      "p",
      {
        role: "status",
        style: {
          margin: 0,
          marginTop: n.marginXXS,
          color: i.state === "error" ? n.colorError : n.colorTextSecondary,
          fontSize: n.fontSizeSM
        },
        children: i.message
      }
    ) : null
  ] });
}
function Fe({ config: t }) {
  const { token: e } = T.useToken(), i = C(t), [n, o] = q.useState({ state: "idle", message: null }), l = () => {
    const u = Z(i);
    u && (o({ state: "opening", message: "正在打开视频…" }), Ce.request("resource:open", u).then(() => {
      o({ state: "idle", message: null });
    }).catch(() => {
      o({
        state: "error",
        message: "视频暂时无法打开：当前渲染环境未提供播放通道，请稍后重试"
      });
    }));
  };
  return /* @__PURE__ */ r("div", { "data-card-type": B, children: i.video_file.length === 0 ? /* @__PURE__ */ r(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: 108,
        boxSizing: "border-box",
        borderRadius: J,
        border: `1px dashed ${e.colorBorderSecondary}`,
        background: e.colorFillQuaternary
      },
      children: /* @__PURE__ */ r(
        ie,
        {
          image: /* @__PURE__ */ r(ne, { "aria-hidden": "true" }),
          description: /* @__PURE__ */ c(G, { children: [
            /* @__PURE__ */ r("span", { style: { display: "block", fontWeight: 600 }, children: "还没有视频内容" }),
            /* @__PURE__ */ r("span", { style: { display: "block", marginTop: 4, fontSize: 13 }, children: "填写视频文件后，这里会显示视频基础卡片。" })
          ] })
        }
      )
    }
  ) : /* @__PURE__ */ r(De, { config: i, onOpen: l, outcome: n }) });
}
function Pe(t) {
  return t.video_file.length > 0 && Ne(t);
}
function m({
  label: t,
  hint: e,
  error: i,
  children: n
}) {
  const { token: o } = T.useToken();
  return /* @__PURE__ */ c(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: "minmax(96px, 160px) minmax(0, 1fr)",
        gap: o.marginSM,
        padding: `${o.paddingSM}px 0`,
        borderBottom: `1px solid ${o.colorBorderSecondary}`,
        alignItems: "start"
      },
      children: [
        /* @__PURE__ */ c("div", { style: { display: "grid", gap: 2, paddingTop: 5 }, children: [
          /* @__PURE__ */ r("span", { style: { color: o.colorText, fontSize: o.fontSizeSM, fontWeight: 600 }, children: t }),
          e ? /* @__PURE__ */ r("span", { style: { color: o.colorTextSecondary, fontSize: o.fontSizeSM }, children: e }) : null
        ] }),
        /* @__PURE__ */ c("div", { style: { display: "grid", gap: o.marginXXS, minWidth: 0 }, children: [
          n,
          i ? /* @__PURE__ */ r("span", { role: "alert", style: { color: o.colorError, fontSize: o.fontSizeSM }, children: i }) : null
        ] })
      ]
    }
  );
}
function R({
  label: t,
  checked: e,
  onChange: i,
  testId: n
}) {
  const { token: o } = T.useToken();
  return /* @__PURE__ */ c(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: o.marginSM,
        padding: `${o.paddingXS}px 0`,
        borderBottom: `1px solid ${o.colorBorderSecondary}`
      },
      children: [
        /* @__PURE__ */ r("span", { style: { color: o.colorText, fontSize: o.fontSizeSM }, children: t }),
        /* @__PURE__ */ r(oe, { "data-role": n, checked: e, onChange: i })
      ]
    }
  );
}
function Ke(t) {
  return t === null || !Number.isFinite(t) ? 1 : Math.min(4, Math.max(0.25, t));
}
function Ve(t) {
  return t === null || !Number.isFinite(t) ? 0 : t > 0 ? t : 0;
}
function $e(t) {
  return t.label || t.language || t.file_path || "未命名字幕";
}
function je({ config: t, onChange: e }) {
  const { token: i } = T.useToken(), [n, o] = ee(() => C(t)), l = te(n), u = (a) => {
    const d = C({ ...l.current, ...a });
    l.current = d, o(d), e(d);
  }, f = (a) => (d) => {
    u({ [a]: d.currentTarget.value });
  }, p = (a) => {
    u({ playback: { ...l.current.playback, ...a } });
  }, b = (a, d) => {
    u({
      subtitles: l.current.subtitles.map(
        (s) => s.id === a ? { ...s, ...d } : s
      )
    });
  }, L = (a, d) => {
    u({
      subtitles: l.current.subtitles.map(
        (s) => s.id === a ? { ...s, default: d } : { ...s, default: !1 }
      )
    });
  }, E = () => {
    const a = {
      id: ke("subtitle"),
      label: "",
      language: "",
      kind: "subtitles",
      file_path: "",
      default: !1
    };
    u({ subtitles: [...l.current.subtitles, a] });
  }, x = (a) => {
    u({ subtitles: l.current.subtitles.filter((d) => d.id !== a) });
  }, g = O(n) || "未命名视频", D = n.video_file.length > 0 && v(n.video_file) === void 0;
  return /* @__PURE__ */ r(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "auto",
        padding: i.padding,
        boxSizing: "border-box"
      },
      children: /* @__PURE__ */ c("section", { style: { display: "grid", gap: 0, maxWidth: 720, margin: "0 auto" }, children: [
        /* @__PURE__ */ r(
          "h3",
          {
            style: {
              margin: 0,
              padding: `${i.paddingXS}px 0`,
              color: i.colorText,
              fontSize: i.fontSize,
              fontWeight: 700
            },
            children: "资源文件"
          }
        ),
        /* @__PURE__ */ r(
          "p",
          {
            style: {
              margin: 0,
              paddingBottom: i.paddingXS,
              color: i.colorTextSecondary,
              fontSize: i.fontSizeSM
            },
            children: "本地视频、封面与字幕文件导入依赖编辑器资源导入通道（工单071），通道交付前请直接填写卡片内相对资源路径。"
          }
        ),
        /* @__PURE__ */ r(
          m,
          {
            label: "视频文件",
            hint: "必填；卡片内相对路径，例如 videos/tokyo-travel.mp4",
            error: D ? "视频文件必须是合法的卡片内相对路径" : void 0,
            children: /* @__PURE__ */ r(
              y,
              {
                "data-role": "video-path-input",
                value: n.video_file,
                placeholder: "videos/tokyo-travel.mp4",
                ...D ? { status: "error" } : {},
                onChange: f("video_file")
              }
            )
          }
        ),
        /* @__PURE__ */ r(m, { label: "视频封面", hint: "可选；卡片内相对路径，未填写时查看态以视频首帧回退呈现", children: /* @__PURE__ */ r(
          y,
          {
            "data-role": "cover-path-input",
            value: n.cover_image,
            placeholder: "covers/tokyo-travel.jpg",
            onChange: f("cover_image")
          }
        ) }),
        /* @__PURE__ */ c(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: i.marginXS,
              paddingTop: i.paddingLG
            },
            children: [
              /* @__PURE__ */ r("h3", { style: { margin: 0, color: i.colorText, fontSize: i.fontSize, fontWeight: 700 }, children: "字幕" }),
              /* @__PURE__ */ r(F, { "data-role": "add-subtitle", onClick: E, children: "添加字幕" })
            ]
          }
        ),
        n.subtitles.length > 0 ? /* @__PURE__ */ r("div", { style: { display: "grid", gap: i.marginSM, paddingTop: i.marginSM }, children: n.subtitles.map((a) => {
          const d = a.file_path.length > 0 && v(a.file_path) === void 0;
          return /* @__PURE__ */ c(
            "div",
            {
              style: {
                display: "grid",
                gap: i.marginSM,
                padding: i.paddingSM,
                border: `1px solid ${i.colorBorderSecondary}`,
                borderRadius: i.borderRadiusLG
              },
              children: [
                /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: i.marginXS }, children: [
                  /* @__PURE__ */ r(M, { color: "processing", children: $e(a) }),
                  a.default ? /* @__PURE__ */ r(M, { color: "success", children: "默认字幕" }) : null,
                  /* @__PURE__ */ r("span", { style: { flex: "1 1 auto" } }),
                  /* @__PURE__ */ r(
                    F,
                    {
                      "data-role": `remove-subtitle-${a.id}`,
                      size: "small",
                      onClick: () => {
                        x(a.id);
                      },
                      children: "删除字幕"
                    }
                  )
                ] }),
                /* @__PURE__ */ r(m, { label: "字幕名称", children: /* @__PURE__ */ r(
                  y,
                  {
                    "data-role": `subtitle-label-input-${a.id}`,
                    value: a.label,
                    placeholder: "例如：简体中文",
                    onChange: (s) => {
                      b(a.id, { label: s.currentTarget.value });
                    }
                  }
                ) }),
                /* @__PURE__ */ r(m, { label: "语言", hint: "BCP 47 标识", children: /* @__PURE__ */ r(
                  y,
                  {
                    "data-role": `subtitle-language-input-${a.id}`,
                    value: a.language,
                    placeholder: "例如：zh-CN",
                    onChange: (s) => {
                      b(a.id, { language: s.currentTarget.value });
                    }
                  }
                ) }),
                /* @__PURE__ */ r(
                  m,
                  {
                    label: "字幕文件",
                    error: d ? "字幕文件必须是合法的卡片内相对路径" : void 0,
                    children: /* @__PURE__ */ r(
                      y,
                      {
                        "data-role": `subtitle-path-input-${a.id}`,
                        value: a.file_path,
                        placeholder: "subtitles/tokyo-travel.zh.vtt",
                        ...d ? { status: "error" } : {},
                        onChange: (s) => {
                          b(a.id, { file_path: s.currentTarget.value });
                        }
                      }
                    )
                  }
                ),
                /* @__PURE__ */ r(
                  R,
                  {
                    label: "默认字幕",
                    testId: `subtitle-default-switch-${a.id}`,
                    checked: a.default,
                    onChange: (s) => {
                      L(a.id, s);
                    }
                  }
                )
              ]
            },
            a.id
          );
        }) }) : /* @__PURE__ */ r(
          "p",
          {
            style: {
              margin: 0,
              paddingTop: i.marginSM,
              color: i.colorTextSecondary,
              fontSize: i.fontSizeSM
            },
            children: "还没有添加字幕轨，可以为视频添加外挂字幕。"
          }
        ),
        /* @__PURE__ */ r(
          "h3",
          {
            style: {
              margin: 0,
              paddingTop: i.paddingLG,
              color: i.colorText,
              fontSize: i.fontSize,
              fontWeight: 700
            },
            children: "视频信息"
          }
        ),
        /* @__PURE__ */ r(m, { label: "视频标题", hint: `留空时查看态从视频文件名派生，当前展示：${g}`, children: /* @__PURE__ */ r(
          y,
          {
            "data-role": "video-title-input",
            value: n.video_title,
            placeholder: "例如：旅行 Vlog 第 12 集",
            onChange: f("video_title")
          }
        ) }),
        /* @__PURE__ */ r(m, { label: "创作者", children: /* @__PURE__ */ r(
          y,
          {
            "data-role": "creator-input",
            value: n.creator,
            placeholder: "例如：薯片工作室",
            onChange: f("creator")
          }
        ) }),
        /* @__PURE__ */ r(m, { label: "发布时间", children: /* @__PURE__ */ r(
          y,
          {
            "data-role": "publish-time-input",
            value: n.publish_time,
            placeholder: "例如：2026-04-18",
            onChange: f("publish_time")
          }
        ) }),
        /* @__PURE__ */ r(
          "h3",
          {
            style: {
              margin: 0,
              paddingTop: i.paddingLG,
              color: i.colorText,
              fontSize: i.fontSize,
              fontWeight: 700
            },
            children: "播放参数"
          }
        ),
        /* @__PURE__ */ c("div", { style: { display: "grid", gap: 0, paddingTop: i.paddingXS }, children: [
          /* @__PURE__ */ r(
            R,
            {
              label: "自动播放",
              testId: "autoplay-switch",
              checked: n.playback.autoplay,
              onChange: (a) => {
                p({ autoplay: a });
              }
            }
          ),
          /* @__PURE__ */ r(
            R,
            {
              label: "循环播放",
              testId: "loop-switch",
              checked: n.playback.loop,
              onChange: (a) => {
                p({ loop: a });
              }
            }
          ),
          /* @__PURE__ */ r(
            R,
            {
              label: "默认静音",
              testId: "muted-switch",
              checked: n.playback.muted,
              onChange: (a) => {
                p({ muted: a });
              }
            }
          ),
          /* @__PURE__ */ r(m, { label: "默认倍速", hint: "0.25 ~ 4，步长 0.25", children: /* @__PURE__ */ r(
            P,
            {
              "data-role": "playback-rate-input",
              value: n.playback.playback_rate,
              min: 0.25,
              max: 4,
              step: 0.25,
              onChange: (a) => {
                p({ playback_rate: Ke(a) });
              }
            }
          ) }),
          /* @__PURE__ */ r(m, { label: "起始秒数", hint: "从第几秒开始播放，最小 0", children: /* @__PURE__ */ r(
            P,
            {
              "data-role": "start-time-input",
              value: n.playback.start_time,
              min: 0,
              step: 1,
              onChange: (a) => {
                p({ start_time: Ve(a) });
              }
            }
          ) })
        ] })
      ] })
    }
  );
}
const A = /* @__PURE__ */ new WeakMap();
function Xe(t, e) {
  A.get(e)?.(), e.replaceChildren();
  const i = U(e);
  H(() => {
    i.render(/* @__PURE__ */ r(Fe, { config: t.content.config }));
  });
  let n = !1;
  const o = () => {
    n || (n = !0, i.unmount(), A.get(e) === o && A.delete(e));
  };
  return A.set(e, o), o;
}
function Ge(t) {
  return /* @__PURE__ */ r(je, { ...t });
}
class He {
  state = "active";
  base;
  revision;
  pending = null;
  dirty = !1;
  host;
  root;
  changeHandlers = /* @__PURE__ */ new Set();
  dirtyHandlers = /* @__PURE__ */ new Set();
  constructor(e, i) {
    this.base = C(e.content.config), this.revision = e.revision, this.host = i, i.replaceChildren(), this.root = U(i), this.mount();
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
    const i = this.pending;
    this.revision = e, i !== null && i.kind === "replace" && (this.base = C(i.content.config)), this.pending === i && (this.pending = null, this.setDirty(!1));
  }
  update(e, i) {
    this.state === "disposed" || i <= this.revision || (this.revision = i, this.base = C(e.content.config), this.pending = null, this.setDirty(!1), this.mount());
  }
  subscribe(e, i) {
    if (this.state === "disposed")
      return { dispose: () => {
      } };
    if (e === "change") {
      const o = i;
      return this.changeHandlers.add(o), {
        dispose: () => {
          this.changeHandlers.delete(o);
        }
      };
    }
    const n = i;
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
    H(() => {
      this.root.render(
        /* @__PURE__ */ r(
          Ge,
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
    if (this.state !== "active" || !Pe(e))
      return;
    const i = {
      kind: "replace",
      content: {
        card_type: B,
        config: { ...e }
      }
    }, n = this.pending !== null;
    this.pending = i, n || this.setDirty(!0);
    for (const o of this.changeHandlers)
      o({ change: i });
  };
  setDirty(e) {
    if (this.dirty !== e) {
      this.dirty = e;
      for (const i of this.dirtyHandlers)
        i({ isDirty: e });
    }
  }
}
function Ue(t, e) {
  return new He(t, e);
}
const et = {
  renderView: Xe,
  renderEditor: Ue
};
export {
  et as default,
  Ue as renderEditor,
  et as renderPlugin,
  Xe as renderView
};
