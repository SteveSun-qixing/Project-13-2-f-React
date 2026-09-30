import { jsx as t, jsxs as c, Fragment as X } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { flushSync as M } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as N } from "chips-resource://platform/vendor/react-dom-client.js";
import G, { useState as Z, useRef as q } from "chips-resource://platform/vendor/react.js";
import { theme as k, Empty as W, SoundOutlined as Y, Tag as J, Input as l, Button as w } from "chips-resource://platform/vendor/chips-ui.js";
class P extends Error {
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
    return new P({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function _(A) {
  if (typeof A != "object" || A === null)
    return !1;
  const e = A;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const $ = "SDK_BRIDGE_UNAVAILABLE", F = "SDK_UNKNOWN_ERROR", j = "发生未知错误";
function ee(A) {
  return A instanceof Error;
}
function Ae(A) {
  if (A instanceof P)
    return A;
  if (_(A)) {
    const e = A, n = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new P(n);
  }
  return ee(A) ? new P({
    code: F,
    message: j,
    details: { name: A.name, cause: A.message },
    retryable: !1
  }) : new P({
    code: F,
    message: j,
    details: { value: String(A) },
    retryable: !1
  });
}
function ne() {
  return new P({
    code: $,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function a(A, e, n) {
  let g;
  try {
    g = A();
  } catch (r) {
    return Promise.reject(Ae(r));
  }
  return g.request(e, n);
}
const ge = "cli.command.list", re = "cli.command.get", te = "cli.command.resolve";
function Ce(A) {
  return {
    list(e) {
      return a(A, ge, e ?? {});
    },
    get(e) {
      return a(A, re, e);
    },
    resolve(e) {
      return a(A, te, e);
    }
  };
}
const h = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, ie = "cli.task.create", Ie = "cli.task.bindInvocation", oe = "cli.task.cancel";
function pe(A) {
  return {
    create(e) {
      return a(A, ie, e).then((n) => n.task);
    },
    bindInvocation(e) {
      return a(A, Ie, e).then((n) => n.task);
    },
    get(e) {
      const n = { taskId: e };
      return a(A, h.CLI_TASK_GET, n).then((g) => g.task);
    },
    active(e) {
      const n = { commandId: e };
      return a(A, h.CLI_TASK_ACTIVE, n).then((g) => g.task);
    },
    progress(e, n) {
      const g = { taskId: e, progress: n };
      return a(A, h.CLI_TASK_PROGRESS, g).then((r) => r.task);
    },
    complete(e, n) {
      const g = {
        taskId: e,
        ...n === void 0 ? {} : { output: n }
      };
      return a(A, h.CLI_TASK_COMPLETE, g).then((r) => r.task);
    },
    fail(e, n) {
      const g = { taskId: e, error: n };
      return a(A, h.CLI_TASK_FAIL, g).then((r) => r.task);
    },
    cancel(e) {
      return a(A, oe, { taskId: e }).then((n) => n.task);
    }
  };
}
function ae() {
  return globalThis.window?.chips;
}
class ce {
  #A;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = Ce(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = pe(() => this.#e());
  constructor(e) {
    this.#A = e;
  }
  /**
   * 解析本次调用的目标 Bridge。
   *
   * @returns 注入目标或当前 `window.chips`
   * @throws ChipsError 两者均不可用时抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  #e() {
    if (this.#A !== void 0)
      return this.#A;
    const e = ae();
    if (e === void 0)
      throw ne();
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
    return a(() => this.#e(), e, n);
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
function le(A) {
  return new ce(A?.bridge);
}
const fe = le(), y = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function Q(A) {
  return typeof A == "string" && A.trim().length > 0;
}
function se(A, e = 10) {
  let n = "";
  for (let g = 0; g < e; g += 1)
    n += y[Math.floor(Math.random() * y.length)];
  return `${A}-${n}`;
}
function z(A) {
  if (!Q(A))
    return;
  const e = A.trim();
  if (!e || e.includes("\\") || e.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(e))
    return;
  const n = e.replace(/^\.\//, "");
  if (!n)
    return;
  const g = n.split("/").filter(Boolean);
  if (!(g.length === 0 || g.some((r) => r === "." || r === "..")))
    return g.join("/");
}
function x(A) {
  const e = z(A);
  if (!e)
    return "";
  const n = e.split("/");
  return n[n.length - 1] ?? "";
}
function de(A) {
  return A.replace(/\.[^.]+$/u, "");
}
function Pe(A) {
  const e = x(A).toLowerCase();
  if (e.endsWith(".mp3"))
    return "audio/mpeg";
  if (e.endsWith(".flac"))
    return "audio/flac";
  if (e.endsWith(".wav"))
    return "audio/wav";
  if (e.endsWith(".ogg") || e.endsWith(".oga"))
    return "audio/ogg";
  if (e.endsWith(".m4a"))
    return "audio/mp4";
  if (e.endsWith(".aac"))
    return "audio/aac";
  if (e.endsWith(".opus"))
    return "audio/opus";
  if (e.endsWith(".webm"))
    return "audio/webm";
}
const B = "base.music", me = /^\d{4}-\d{2}-\d{2}$/;
function s(A) {
  return typeof A == "string" ? A.trim() : "";
}
function O(A) {
  return z(A) ?? "";
}
function Se(A, e) {
  const n = A !== null && typeof A == "object" ? A : {}, g = s(n.role), r = Array.isArray(n.people) ? n.people.map((i) => s(i)).filter((i) => i.length > 0) : [], o = typeof n.id == "string" || "role" in n || "people" in n;
  return !g && r.length === 0 && !o ? null : {
    id: s(n.id) || `team-role-${e + 1}`,
    role: g,
    people: r
  };
}
function S(A) {
  const e = typeof A == "object" && A !== null ? A : {}, n = Array.isArray(e.production_team) ? e.production_team.map((g, r) => Se(g, r)).filter((g) => g !== null) : [];
  return {
    audio_file: O(e.audio_file),
    music_name: s(e.music_name),
    album_cover: O(e.album_cover),
    lyrics_file: O(e.lyrics_file),
    production_team: n,
    release_date: s(e.release_date),
    album_name: s(e.album_name),
    language: s(e.language),
    genre: s(e.genre)
  };
}
function Te(A) {
  return A === void 0 ? !0 : typeof A != "string" ? !1 : A.trim().length === 0 ? !0 : z(A) !== void 0;
}
function he(A) {
  if (A == null)
    return !0;
  if (typeof A != "object" || Array.isArray(A))
    return !1;
  const e = A;
  for (const r of ["audio_file", "album_cover", "lyrics_file"])
    if (!Te(e[r]))
      return !1;
  for (const r of ["music_name", "album_name", "language", "genre", "release_date"])
    if (e[r] !== void 0 && typeof e[r] != "string")
      return !1;
  const n = e.release_date;
  if (typeof n == "string" && n.trim().length > 0 && !me.test(n.trim()))
    return !1;
  const g = e.production_team;
  if (g !== void 0) {
    if (!Array.isArray(g))
      return !1;
    for (const r of g) {
      if (r === null || typeof r != "object" || Array.isArray(r))
        return !1;
      const o = r;
      for (const I of ["id", "role"])
        if (o[I] !== void 0 && typeof o[I] != "string")
          return !1;
      const i = o.people;
      if (i !== void 0 && (!Array.isArray(i) || i.some((I) => typeof I != "string")))
        return !1;
    }
  }
  return !0;
}
function D(A) {
  if (Q(A.music_name))
    return A.music_name.trim();
  const e = x(A.audio_file);
  return e ? de(e) : "";
}
const Ke = [
  "歌手",
  "演唱",
  "主唱",
  "artist",
  "singer",
  "vocal",
  "vocals",
  "performer"
];
function Ue(A) {
  const e = A.trim().toLowerCase();
  return Ke.some((n) => e.includes(n.toLowerCase()));
}
function E(A) {
  const e = A.production_team.find(
    (g) => Ue(g.role) && g.people.length > 0
  );
  if (e)
    return e.people.join(" / ");
  const n = A.production_team.find((g) => g.people.length > 0);
  return n ? n.people.join(" / ") : "";
}
function R(A) {
  const e = z(A);
  if (!e)
    return null;
  const n = Pe(e);
  return {
    uri: e,
    relativePath: x(e),
    ...n === void 0 ? {} : { mimeType: n }
  };
}
function b(A) {
  const e = R(A.audio_file);
  if (!e)
    return null;
  const n = R(A.album_cover), g = R(A.lyrics_file), r = D(A), o = E(A), i = {
    kind: "chips.music-card",
    version: "1.0.0",
    cardType: B,
    resources: {
      audio: e,
      ...n === null ? {} : { cover: n },
      ...g === null ? {} : { lyrics: g }
    },
    display: {
      title: r,
      ...o.length === 0 ? {} : { artist: o }
    }
  };
  return {
    intent: "view",
    resource: {
      uri: e.uri,
      ...e.mimeType === void 0 ? {} : { mimeType: e.mimeType },
      fileName: e.relativePath,
      title: r,
      payload: i
    }
  };
}
const ve = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QDORXhpZgAATU0AKgAAAAgABgESAAMAAAABAAEAAAEaAAUAAAABAAAAVgEbAAUAAAABAAAAXgEoAAMAAAABAAIAAAExAAIAAAAVAAAAZodpAAQAAAABAAAAfAAAAAAAAABIAAAAAQAAAEgAAAABUGl4ZWxtYXRvciBQcm8gMy41LjYAAAAEkAQAAgAAABQAAACyoAEAAwAAAAEAAQAAoAIABAAAAAEAAAIAoAMABAAAAAEAAAIAAAAAADIwMjY6MDQ6MTggMjA6MzE6NTcA/+EJyWh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcDpNZXRhZGF0YURhdGU9IjIwMjYtMDQtMThUMjA6Mzk6MzIrMDg6MDAiIHhtcDpDcmVhdG9yVG9vbD0iUGl4ZWxtYXRvciBQcm8gMy41LjYiIHhtcDpDcmVhdGVEYXRlPSIyMDI2LTA0LTE4VDIwOjMxOjU3KzA4OjAwIi8+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg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", ue = ve, u = 88, L = 108, V = 16;
function He({
  coverReference: A,
  title: e,
  borderRadius: n,
  background: g
}) {
  return /* @__PURE__ */ t(
    "span",
    {
      "aria-hidden": "true",
      style: {
        display: "block",
        flex: `0 0 ${u}px`,
        width: u,
        height: u,
        minWidth: u,
        borderRadius: n,
        overflow: "hidden",
        background: g
      },
      children: /* @__PURE__ */ t(
        "img",
        {
          "data-role": "music-cover",
          src: A,
          alt: e,
          draggable: !1,
          loading: "lazy",
          style: {
            display: "block",
            margin: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }
        }
      )
    }
  );
}
function ke({ config: A, onOpen: e, outcome: n }) {
  const { token: g } = k.useToken(), r = D(A) || "未命名歌曲", o = E(A) || "未填写歌手", I = b(A) !== null, K = A.album_cover.length > 0 ? A.album_cover : ue, U = [
    A.album_name.length > 0 ? `专辑 · ${A.album_name}` : "",
    A.language.length > 0 ? `语种 · ${A.language}` : "",
    A.genre.length > 0 ? `流派 · ${A.genre}` : "",
    A.release_date.length > 0 ? `发行 · ${A.release_date}` : ""
  ].filter((m) => m.length > 0), T = /* @__PURE__ */ c(X, { children: [
    /* @__PURE__ */ t(
      He,
      {
        coverReference: K,
        title: r,
        borderRadius: g.borderRadiusLG,
        background: g.colorBgContainer
      }
    ),
    /* @__PURE__ */ c(
      "span",
      {
        style: {
          display: "grid",
          gap: g.marginXXS,
          flex: "1 1 auto",
          minWidth: 0
        },
        children: [
          /* @__PURE__ */ t(
            "span",
            {
              style: {
                margin: 0,
                color: g.colorText,
                fontSize: g.fontSizeLG,
                fontWeight: 600,
                lineHeight: 1.25,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                overflowWrap: "anywhere"
              },
              children: r
            }
          ),
          /* @__PURE__ */ t(
            "span",
            {
              style: {
                margin: 0,
                color: g.colorTextSecondary,
                fontSize: g.fontSizeSM,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              },
              children: o
            }
          ),
          U.length > 0 ? /* @__PURE__ */ t("span", { style: { display: "flex", flexWrap: "wrap", gap: g.marginXXS }, children: U.map((m) => /* @__PURE__ */ t(J, { style: { marginInlineEnd: 0 }, children: m }, m)) }) : null
        ]
      }
    )
  ] }), v = {
    display: "flex",
    alignItems: "center",
    gap: g.marginSM,
    width: "100%",
    minHeight: L,
    padding: `${g.paddingSM}px ${g.padding}px`,
    boxSizing: "border-box",
    borderRadius: V,
    border: `1px ${I ? "solid" : "dashed"} ${g.colorBorderSecondary}`,
    background: g.colorFillQuaternary,
    textAlign: "left"
  };
  return /* @__PURE__ */ c("div", { style: { width: "100%", minWidth: 0 }, children: [
    I ? /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        "data-role": "music-open",
        "aria-label": `打开《${r}》`,
        onClick: e,
        style: {
          cursor: "pointer",
          font: "inherit",
          color: "inherit",
          appearance: "none",
          ...v
        },
        children: T
      }
    ) : /* @__PURE__ */ t(
      "div",
      {
        role: "group",
        "aria-label": "音频引用缺失或非法，暂无法打开播放器",
        style: v,
        children: T
      }
    ),
    n.state !== "idle" ? /* @__PURE__ */ t(
      "p",
      {
        role: "status",
        style: {
          margin: 0,
          marginTop: g.marginXXS,
          color: n.state === "error" ? g.colorError : g.colorTextSecondary,
          fontSize: g.fontSizeSM
        },
        children: n.message
      }
    ) : null
  ] });
}
function ze({ config: A }) {
  const { token: e } = k.useToken(), n = S(A), [g, r] = G.useState({ state: "idle", message: null }), o = () => {
    const i = b(n);
    i && (r({ state: "opening", message: "正在打开音频…" }), fe.request("resource:open", i).then(() => {
      r({ state: "idle", message: null });
    }).catch(() => {
      r({
        state: "error",
        message: "音频暂时无法打开：当前渲染环境未提供播放通道，请稍后重试"
      });
    }));
  };
  return /* @__PURE__ */ t("div", { "data-card-type": B, children: n.audio_file.length === 0 ? /* @__PURE__ */ t(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: L,
        boxSizing: "border-box",
        borderRadius: V,
        border: `1px dashed ${e.colorBorderSecondary}`,
        background: e.colorFillQuaternary
      },
      children: /* @__PURE__ */ t(
        W,
        {
          image: /* @__PURE__ */ t(Y, { "aria-hidden": "true" }),
          description: /* @__PURE__ */ c(X, { children: [
            /* @__PURE__ */ t("span", { style: { display: "block", fontWeight: 600 }, children: "未命名歌曲" }),
            /* @__PURE__ */ t("span", { style: { display: "block", marginTop: 4, fontSize: 13 }, children: "上传音频文件后，这里会显示音乐基础卡片。" })
          ] })
        }
      )
    }
  ) : /* @__PURE__ */ t(ke, { config: n, onOpen: o, outcome: g }) });
}
function Oe(A) {
  return A.audio_file.length > 0 && he(A);
}
function f({
  label: A,
  hint: e,
  error: n,
  children: g
}) {
  const { token: r } = k.useToken();
  return /* @__PURE__ */ c(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: "minmax(96px, 160px) minmax(0, 1fr)",
        gap: r.marginSM,
        padding: `${r.paddingSM}px 0`,
        borderBottom: `1px solid ${r.colorBorderSecondary}`,
        alignItems: "start"
      },
      children: [
        /* @__PURE__ */ c("div", { style: { display: "grid", gap: 2, paddingTop: 5 }, children: [
          /* @__PURE__ */ t("span", { style: { color: r.colorText, fontSize: r.fontSizeSM, fontWeight: 600 }, children: A }),
          e ? /* @__PURE__ */ t("span", { style: { color: r.colorTextSecondary, fontSize: r.fontSizeSM }, children: e }) : null
        ] }),
        /* @__PURE__ */ c("div", { style: { display: "grid", gap: r.marginXXS, minWidth: 0 }, children: [
          g,
          n ? /* @__PURE__ */ t("span", { role: "alert", style: { color: r.colorError, fontSize: r.fontSizeSM }, children: n }) : null
        ] })
      ]
    }
  );
}
function Re({ config: A, onChange: e }) {
  const { token: n } = k.useToken(), [g, r] = Z(() => S(A)), o = q(g), i = (C) => {
    const p = S({ ...o.current, ...C });
    o.current = p, r(p), e(p);
  }, I = (C) => (p) => {
    i({ [C]: p.currentTarget.value });
  }, K = g.release_date.trim().length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(g.release_date.trim()), U = () => {
    const C = { id: se("team"), role: "", people: [] };
    i({ production_team: [...g.production_team, C] });
  }, T = (C, p) => {
    i({
      production_team: g.production_team.map(
        (d) => d.id === C ? { ...d, ...p } : d
      )
    });
  }, v = (C) => {
    i({ production_team: g.production_team.filter((p) => p.id !== C) });
  }, m = D(g) || "未命名歌曲";
  return /* @__PURE__ */ t(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "auto",
        padding: n.padding,
        boxSizing: "border-box"
      },
      children: /* @__PURE__ */ c("section", { style: { display: "grid", gap: 0, maxWidth: 720, margin: "0 auto" }, children: [
        /* @__PURE__ */ t(
          "h3",
          {
            style: {
              margin: 0,
              padding: `${n.paddingXS}px 0`,
              color: n.colorText,
              fontSize: n.fontSize,
              fontWeight: 700
            },
            children: "资源文件"
          }
        ),
        /* @__PURE__ */ t(f, { label: "音频文件", hint: "必填；卡片内相对路径，例如 tracks/demo.mp3", children: /* @__PURE__ */ t(
          l,
          {
            "data-role": "audio-path-input",
            value: g.audio_file,
            placeholder: "tracks/midnight-echo.mp3",
            onChange: I("audio_file")
          }
        ) }),
        /* @__PURE__ */ t(f, { label: "专辑封面", hint: "可选；卡片内相对路径，未填写时查看态显示默认占位封面", children: /* @__PURE__ */ t(
          l,
          {
            "data-role": "cover-path-input",
            value: g.album_cover,
            placeholder: "covers/midnight-echo.jpg",
            onChange: I("album_cover")
          }
        ) }),
        /* @__PURE__ */ t(f, { label: "歌词文件", hint: "可选；卡片内相对路径，随打开载荷交给音乐播放器", children: /* @__PURE__ */ t(
          l,
          {
            "data-role": "lyrics-path-input",
            value: g.lyrics_file,
            placeholder: "lyrics/midnight-echo.lrc",
            onChange: I("lyrics_file")
          }
        ) }),
        /* @__PURE__ */ t(
          "h3",
          {
            style: {
              margin: 0,
              paddingTop: n.paddingLG,
              color: n.colorText,
              fontSize: n.fontSize,
              fontWeight: 700
            },
            children: "歌曲信息"
          }
        ),
        /* @__PURE__ */ t(f, { label: "歌曲名", hint: `留空时查看态从音频文件名派生，当前展示：${m}`, children: /* @__PURE__ */ t(
          l,
          {
            "data-role": "music-name-input",
            value: g.music_name,
            placeholder: "输入歌曲名",
            onChange: I("music_name")
          }
        ) }),
        /* @__PURE__ */ t(f, { label: "专辑名字", children: /* @__PURE__ */ t(
          l,
          {
            "data-role": "album-name-input",
            value: g.album_name,
            placeholder: "输入专辑名字",
            onChange: I("album_name")
          }
        ) }),
        /* @__PURE__ */ t(
          f,
          {
            label: "发行日期",
            hint: "格式 YYYY-MM-DD",
            error: K ? "发行日期必须使用 YYYY-MM-DD" : void 0,
            children: /* @__PURE__ */ t(
              l,
              {
                "data-role": "release-date-input",
                value: g.release_date,
                placeholder: "2026-04-18",
                ...K ? { status: "error" } : {},
                onChange: I("release_date")
              }
            )
          }
        ),
        /* @__PURE__ */ t(f, { label: "语种", children: /* @__PURE__ */ t(
          l,
          {
            "data-role": "language-input",
            value: g.language,
            placeholder: "例如：中文、日语、英语",
            onChange: I("language")
          }
        ) }),
        /* @__PURE__ */ t(f, { label: "流派", children: /* @__PURE__ */ t(
          l,
          {
            "data-role": "genre-input",
            value: g.genre,
            placeholder: "例如：流行、摇滚、电子",
            onChange: I("genre")
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
              gap: n.marginXS,
              paddingTop: n.paddingLG
            },
            children: [
              /* @__PURE__ */ t("h3", { style: { margin: 0, color: n.colorText, fontSize: n.fontSize, fontWeight: 700 }, children: "制作团队" }),
              /* @__PURE__ */ t(w, { "data-role": "add-team-role", onClick: U, children: "添加身份" })
            ]
          }
        ),
        g.production_team.length > 0 ? /* @__PURE__ */ t("div", { style: { display: "grid", gap: n.marginSM, paddingTop: n.marginSM }, children: g.production_team.map((C) => /* @__PURE__ */ c(
          "div",
          {
            style: {
              display: "grid",
              gap: n.marginSM,
              padding: n.paddingSM,
              border: `1px solid ${n.colorBorderSecondary}`,
              borderRadius: n.borderRadiusLG
            },
            children: [
              /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: n.marginXS }, children: [
                /* @__PURE__ */ t(J, { color: "processing", children: C.role.trim().length > 0 ? C.role : "未命名身份" }),
                /* @__PURE__ */ t("span", { style: { flex: "1 1 auto" } }),
                /* @__PURE__ */ t(
                  w,
                  {
                    "data-role": `remove-team-role-${C.id}`,
                    size: "small",
                    onClick: () => {
                      v(C.id);
                    },
                    children: "删除身份"
                  }
                )
              ] }),
              /* @__PURE__ */ t(f, { label: "身份名称", children: /* @__PURE__ */ t(
                l,
                {
                  "data-role": `team-role-input-${C.id}`,
                  value: C.role,
                  placeholder: "例如：歌手、作词、作曲",
                  onChange: (p) => {
                    T(C.id, { role: p.currentTarget.value });
                  }
                }
              ) }),
              /* @__PURE__ */ t(f, { label: "成员列表", hint: "每行一个人名", children: /* @__PURE__ */ t(
                l.TextArea,
                {
                  "data-role": `team-people-input-${C.id}`,
                  rows: 3,
                  value: C.people.join(`
`),
                  placeholder: "每行输入一个人名",
                  onChange: (p) => {
                    T(C.id, {
                      people: p.currentTarget.value.split(/\r?\n/u).map((d) => d.trim()).filter((d) => d.length > 0)
                    });
                  }
                }
              ) })
            ]
          },
          C.id
        )) }) : /* @__PURE__ */ t(
          "p",
          {
            style: {
              margin: 0,
              paddingTop: n.marginSM,
              color: n.colorTextSecondary,
              fontSize: n.fontSizeSM
            },
            children: "还没有录入制作团队，可以先添加一个身份。"
          }
        )
      ] })
    }
  );
}
const H = /* @__PURE__ */ new WeakMap();
function xe(A, e) {
  H.get(e)?.(), e.replaceChildren();
  const n = N(e);
  M(() => {
    n.render(/* @__PURE__ */ t(ze, { config: A.content.config }));
  });
  let g = !1;
  const r = () => {
    g || (g = !0, n.unmount(), H.get(e) === r && H.delete(e));
  };
  return H.set(e, r), r;
}
function Be(A) {
  return /* @__PURE__ */ t(Re, { ...A });
}
class De {
  state = "active";
  base;
  revision;
  pending = null;
  dirty = !1;
  host;
  root;
  changeHandlers = /* @__PURE__ */ new Set();
  dirtyHandlers = /* @__PURE__ */ new Set();
  constructor(e, n) {
    this.base = S(e.content.config), this.revision = e.revision, this.host = n, n.replaceChildren(), this.root = N(n), this.mount();
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
    const n = this.pending;
    this.revision = e, n !== null && n.kind === "replace" && (this.base = S(n.content.config)), this.pending === n && (this.pending = null, this.setDirty(!1));
  }
  update(e, n) {
    this.state === "disposed" || n <= this.revision || (this.revision = n, this.base = S(e.content.config), this.pending = null, this.setDirty(!1), this.mount());
  }
  subscribe(e, n) {
    if (this.state === "disposed")
      return { dispose: () => {
      } };
    if (e === "change") {
      const r = n;
      return this.changeHandlers.add(r), {
        dispose: () => {
          this.changeHandlers.delete(r);
        }
      };
    }
    const g = n;
    return this.dirtyHandlers.add(g), {
      dispose: () => {
        this.dirtyHandlers.delete(g);
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
    M(() => {
      this.root.render(
        /* @__PURE__ */ t(
          Be,
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
    if (this.state !== "active" || !Oe(e))
      return;
    const n = {
      kind: "replace",
      content: {
        card_type: B,
        config: { ...e }
      }
    }, g = this.pending !== null;
    this.pending = n, g || this.setDirty(!0);
    for (const r of this.changeHandlers)
      r({ change: n });
  };
  setDirty(e) {
    if (this.dirty !== e) {
      this.dirty = e;
      for (const n of this.dirtyHandlers)
        n({ isDirty: e });
    }
  }
}
function we(A, e) {
  return new De(A, e);
}
const Ne = {
  renderView: xe,
  renderEditor: we
};
export {
  Ne as default,
  we as renderEditor,
  Ne as renderPlugin,
  xe as renderView
};
