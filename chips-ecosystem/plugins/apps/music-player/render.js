import { jsxs as k, jsx as s, Fragment as Ve } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import T, { useState as S, useRef as F, useEffect as W, useCallback as U } from "chips-resource://platform/vendor/react.js";
import { useCommandRuntime as Ke, theme as B, Form as $, Spin as Ge, Input as H, Button as N, Typography as x, Empty as ae, CustomerServiceOutlined as me, Image as be, Tag as je, Slider as Le, Tooltip as G, StepBackwardFilled as We, PauseOutlined as Xe, CaretRightOutlined as He, StepForwardFilled as Ye, SoundOutlined as Qe, SoundFilled as qe, RetweetOutlined as Ze, PlayCircleOutlined as Je, DeleteOutlined as et, ChipsProvider as tt, CommandProvider as nt, PlusOutlined as rt, Alert as ot, Modal as it } from "chips-resource://platform/vendor/chips-ui.js";
import "chips-resource://platform/vendor/react-dom.js";
import "chips-resource://platform/vendor/react-dom-client.js";
class D extends Error {
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
    return new D({
      code: t.code,
      message: t.message,
      retryable: t.retryable ?? !1,
      ...t.details !== void 0 ? { details: t.details } : {}
    });
  }
}
function at(e) {
  if (typeof e != "object" || e === null)
    return !1;
  const t = e;
  return typeof t.code == "string" && t.code.length > 0 && typeof t.message == "string" && (t.retryable === void 0 || typeof t.retryable == "boolean");
}
const lt = "SDK_BRIDGE_UNAVAILABLE", pe = "SDK_UNKNOWN_ERROR", ge = "发生未知错误";
function st(e) {
  return e instanceof Error;
}
function ct(e) {
  if (e instanceof D)
    return e;
  if (at(e)) {
    const t = e, r = {
      code: t.code,
      message: t.message,
      retryable: t.retryable ?? !1,
      ...t.details !== void 0 ? { details: t.details } : {}
    };
    return new D(r);
  }
  return st(e) ? new D({
    code: pe,
    message: ge,
    details: { name: e.name, cause: e.message },
    retryable: !1
  }) : new D({
    code: pe,
    message: ge,
    details: { value: String(e) },
    retryable: !1
  });
}
function ut() {
  return new D({
    code: lt,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function E(e, t, r) {
  let n;
  try {
    n = e();
  } catch (i) {
    return Promise.reject(ct(i));
  }
  return n.request(t, r);
}
const dt = "cli.command.list", ft = "cli.command.get", mt = "cli.command.resolve";
function pt(e) {
  return {
    list(t) {
      return E(e, dt, t ?? {});
    },
    get(t) {
      return E(e, ft, t);
    },
    resolve(t) {
      return E(e, mt, t);
    }
  };
}
const j = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, gt = "cli.task.create", ht = "cli.task.bindInvocation", yt = "cli.task.cancel";
function kt(e) {
  return {
    create(t) {
      return E(e, gt, t).then((r) => r.task);
    },
    bindInvocation(t) {
      return E(e, ht, t).then((r) => r.task);
    },
    get(t) {
      const r = { taskId: t };
      return E(e, j.CLI_TASK_GET, r).then((n) => n.task);
    },
    active(t) {
      const r = { commandId: t };
      return E(e, j.CLI_TASK_ACTIVE, r).then((n) => n.task);
    },
    progress(t, r) {
      const n = { taskId: t, progress: r };
      return E(e, j.CLI_TASK_PROGRESS, n).then((i) => i.task);
    },
    complete(t, r) {
      const n = {
        taskId: t,
        ...r === void 0 ? {} : { output: r }
      };
      return E(e, j.CLI_TASK_COMPLETE, n).then((i) => i.task);
    },
    fail(t, r) {
      const n = { taskId: t, error: r };
      return E(e, j.CLI_TASK_FAIL, n).then((i) => i.task);
    },
    cancel(t) {
      return E(e, yt, { taskId: t }).then((r) => r.task);
    }
  };
}
function wt() {
  return globalThis.window?.chips;
}
class vt {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = pt(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = kt(() => this.#e());
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
    const t = wt();
    if (t === void 0)
      throw ut();
    return t;
  }
  /**
   * 唯一能力调用入口；转发给目标 Bridge。
   *
   * @param capabilityId - 能力 ID（`<domain>:<action>[:<target>]`）
   * @param input - 能力输入，校验与权限判定由平台完成
   * @returns 能力输出；目标不可用或平台调用失败时以 `ChipsError` 拒绝
   */
  request(t, r) {
    return E(() => this.#e(), t, r);
  }
  /**
   * 订阅标准事件；转发给目标 Bridge。
   *
   * @param eventId - 事件 ID
   * @param handler - 载荷回调；同一 `(eventId, handler)` 多次订阅各自独立
   * @returns 可退订句柄，`dispose()` 幂等
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  subscribe(t, r) {
    return this.#e().subscribe(t, r);
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
function Tt(e) {
  return new vt(e?.bridge);
}
const he = Tt(), C = "chips.official.music-player", I = {
  openCard: "music-player:open-card",
  refreshView: "music-player:refresh-view",
  togglePlayback: "music-player:toggle-playback",
  seekForward: "music-player:seek-forward",
  seekBackward: "music-player:seek-backward",
  volumeUp: "music-player:volume-up",
  volumeDown: "music-player:volume-down",
  toggleMute: "music-player:toggle-mute",
  toggleLoop: "music-player:toggle-loop",
  nextTrack: "music-player:next-track",
  previousTrack: "music-player:previous-track"
}, w = {
  openCard: "open-card",
  refreshView: "refresh-view",
  togglePlayback: "toggle-playback",
  seekForward: "seek-forward",
  seekBackward: "seek-backward",
  volumeUp: "volume-up",
  volumeDown: "volume-down",
  toggleMute: "toggle-mute",
  toggleLoop: "toggle-loop",
  nextTrack: "next-track",
  previousTrack: "previous-track"
}, le = [
  {
    id: I.openCard,
    title: "打开卡片",
    description: "通过「音乐播放器」打开指定卡片文件",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: C },
    handlerId: w.openCard,
    keywords: ["open", "card", "打开", "卡片", "音乐"],
    group: "文件"
  },
  {
    id: I.refreshView,
    title: "刷新当前视图",
    description: "请求「音乐播放器」重新拉取当前展示数据",
    shortcut: "F5",
    scope: { kind: "app", appId: C },
    handlerId: w.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  },
  {
    id: I.togglePlayback,
    title: "播放或暂停",
    description: "切换当前曲目的播放状态（空格）",
    scope: { kind: "app", appId: C },
    handlerId: w.togglePlayback,
    keywords: ["play", "pause", "播放", "暂停"],
    group: "播放控制"
  },
  {
    id: I.seekForward,
    title: "前进 5 秒",
    description: "当前曲目快进 5 秒（→）",
    scope: { kind: "app", appId: C },
    handlerId: w.seekForward,
    keywords: ["seek", "forward", "快进", "前进"],
    group: "播放控制"
  },
  {
    id: I.seekBackward,
    title: "后退 5 秒",
    description: "当前曲目快退 5 秒（←）",
    scope: { kind: "app", appId: C },
    handlerId: w.seekBackward,
    keywords: ["seek", "backward", "快退", "后退"],
    group: "播放控制"
  },
  {
    id: I.volumeUp,
    title: "音量增大",
    description: "播放音量提高一档（↑）",
    scope: { kind: "app", appId: C },
    handlerId: w.volumeUp,
    keywords: ["volume", "up", "音量", "增大"],
    group: "播放控制"
  },
  {
    id: I.volumeDown,
    title: "音量减小",
    description: "播放音量降低一档（↓）",
    scope: { kind: "app", appId: C },
    handlerId: w.volumeDown,
    keywords: ["volume", "down", "音量", "减小"],
    group: "播放控制"
  },
  {
    id: I.toggleMute,
    title: "静音或取消静音",
    description: "切换当前曲目的静音状态（M）",
    scope: { kind: "app", appId: C },
    handlerId: w.toggleMute,
    keywords: ["mute", "静音", "音量"],
    group: "播放控制"
  },
  {
    id: I.toggleLoop,
    title: "单曲循环切换",
    description: "开启或关闭当前曲目的单曲循环（L）",
    scope: { kind: "app", appId: C },
    handlerId: w.toggleLoop,
    keywords: ["loop", "循环", "重复"],
    group: "播放控制"
  },
  {
    id: I.nextTrack,
    title: "下一首",
    description: "跳转到播放队列中的下一首（N）",
    scope: { kind: "app", appId: C },
    handlerId: w.nextTrack,
    keywords: ["next", "下一首", "队列"],
    group: "队列"
  },
  {
    id: I.previousTrack,
    title: "上一首",
    description: "返回播放队列中的上一首（P）",
    scope: { kind: "app", appId: C },
    handlerId: w.previousTrack,
    keywords: ["previous", "上一首", "队列"],
    group: "队列"
  }
];
new Set(Object.values(I));
function xt(e, t) {
  return le.map((r) => {
    const n = r.handlerId ?? "";
    return {
      commandId: r.id,
      handlerId: n,
      handler: (i) => {
        e()[It(n)]?.(i), t({ commandId: r.id, handlerId: n, payload: i });
      }
    };
  });
}
function It(e) {
  switch (e) {
    case w.openCard:
      return "openCard";
    case w.refreshView:
      return "refreshView";
    case w.togglePlayback:
      return "togglePlayback";
    case w.seekForward:
      return "seekForward";
    case w.seekBackward:
      return "seekBackward";
    case w.volumeUp:
      return "volumeUp";
    case w.volumeDown:
      return "volumeDown";
    case w.toggleMute:
      return "toggleMute";
    case w.toggleLoop:
      return "toggleLoop";
    case w.nextTrack:
      return "nextTrack";
    case w.previousTrack:
      return "previousTrack";
    default:
      return "togglePlayback";
  }
}
const Mt = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function ye(e) {
  if (typeof e == "object" && e !== null && "code" in e) {
    const t = e.code;
    if (typeof t == "string" && t.length > 0)
      return t;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function St(e) {
  const t = Ke(), [r, n] = S("registering"), [i, o] = S(null), [a, u] = S(null), c = F(e ?? {});
  c.current = e ?? {}, W(() => {
    let d = !1, m = null;
    return n("registering"), o(null), (async () => {
      try {
        for (const g of le)
          await he.request("command:register", { definition: g });
        if (d)
          return;
        m = t.attach(xt(() => c.current, u)), n("ready");
      } catch (g) {
        d || (o(ye(g)), n("error"));
      }
    })(), () => {
      d = !0, m?.dispose();
      for (const g of le)
        he.request("command:unregister", { commandId: g.id }).catch(() => {
        });
    };
  }, [t]);
  const f = U(
    async (d, m) => {
      try {
        m === void 0 ? await t.invoke({ commandId: d, source: "api" }) : await t.invoke({ commandId: d, payload: m, source: "api" }), o(null);
      } catch (g) {
        o(ye(g));
      }
    },
    [t]
  );
  return {
    phase: r,
    errorCode: i,
    lastInvoked: a,
    invokeOpenCard: (d) => f(I.openCard, { path: d }),
    invokeRefreshView: () => f(I.refreshView)
  };
}
const Et = [".mp3", ".flac", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".opus", ".webm"], bt = Et.join(" "), Lt = {
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".opus": "audio/ogg",
  ".webm": "audio/webm"
};
function Z(e) {
  const t = e.trim();
  if (!t)
    return "";
  try {
    const n = new URL(t).pathname.trim().toLowerCase(), i = n.lastIndexOf(".");
    return i >= 0 ? n.slice(i) : "";
  } catch {
    const r = t.toLowerCase(), n = Math.max(r.lastIndexOf("/"), r.lastIndexOf("\\")), i = r.lastIndexOf(".");
    return i <= n ? "" : r.slice(i);
  }
}
function Ce(e) {
  const t = e.trim();
  if (!t)
    return "";
  try {
    const i = new URL(t).pathname.trim();
    if (i) {
      const o = i.split("/").filter(Boolean);
      return o[o.length - 1] ?? i;
    }
  } catch {
  }
  const r = t.split(/[\\/]/).filter((n) => n.length > 0);
  return r[r.length - 1] ?? t;
}
function Ct(e) {
  return e.title?.trim() || e.fileName?.trim() || Ce(e.filePath ?? e.sourceId) || e.sourceId;
}
function At(e) {
  const t = Z(e);
  return Lt[t];
}
function Pt(e, t) {
  const r = Z(e);
  if (r)
    return r.slice(1).toUpperCase();
  const n = t?.trim().toLowerCase();
  return n ? (n.split("/")[1] ?? n).replace(/^x-/, "").toUpperCase() : "";
}
function Ae(e) {
  const t = e.trim();
  if (!t)
    return !1;
  try {
    const r = new URL(t);
    return ["file:", "http:", "https:", "blob:", "data:"].includes(r.protocol);
  } catch {
    return !1;
  }
}
function Ut(e) {
  return Number.isFinite(e) ? Math.min(1, Math.max(0, e)) : 0.85;
}
function Nt(e, t) {
  return Number.isFinite(e) ? !Number.isFinite(t) || t <= 0 ? Math.max(0, e) : Math.min(t, Math.max(0, e)) : 0;
}
function q(e) {
  if (!Number.isFinite(e) || e <= 0)
    return "00:00";
  const t = Math.floor(e), r = Math.floor(t / 3600), n = Math.floor(t % 3600 / 60), i = t % 60;
  return r > 0 ? `${String(r).padStart(2, "0")}:${String(n).padStart(2, "0")}:${String(i).padStart(2, "0")}` : `${String(n).padStart(2, "0")}:${String(i).padStart(2, "0")}`;
}
function _t(e, t) {
  const r = Math.max(0, e - t);
  return `-${q(r)}`;
}
const se = 0.82;
function ke(e) {
  if (!e)
    return "mediaSource";
  switch (e.code) {
    case 1:
      return "mediaAborted";
    case 2:
      return "mediaNetwork";
    case 3:
      return "mediaDecode";
    case 4:
      return "mediaSource";
    default:
      return "loadFailed";
  }
}
function Rt(e = {}) {
  const t = e.defaultVolume ?? se, r = e.defaultLoopMode ?? "one";
  let n = null, i = t;
  const o = {
    isReady: !1,
    isPlaying: !1,
    isBuffering: !1,
    isMuted: !1,
    volume: t,
    duration: 0,
    currentTime: 0,
    bufferedUntil: 0,
    loopMode: r,
    errorKey: null
  };
  function a() {
    e.onStateChange?.({ ...o });
  }
  function u(h) {
    n = h, n && (n.loop = o.loopMode === "one", n.volume = o.volume, n.muted = o.isMuted);
  }
  function c() {
    if (n) {
      if (o.currentTime = Number.isFinite(n.currentTime) ? n.currentTime : 0, o.duration = Number.isFinite(n.duration) ? n.duration : 0, n.buffered && n.buffered.length > 0) {
        o.bufferedUntil = n.buffered.end(n.buffered.length - 1);
        return;
      }
      o.bufferedUntil = 0;
    }
  }
  async function f() {
    if (n) {
      if (n.paused) {
        o.errorKey = null, a();
        try {
          await n.play();
        } catch {
          o.errorKey = ke(n.error), a();
        }
        return;
      }
      n.pause();
    }
  }
  function d(h) {
    if (!n)
      return;
    const R = Nt(h, n.duration);
    n.currentTime = R, c(), a();
  }
  function m(h) {
    n && d(n.currentTime + h);
  }
  function g(h) {
    if (!n)
      return;
    const R = Ut(h);
    n.volume = R, n.muted = R === 0, o.volume = R, o.isMuted = n.muted, R > 0 && (i = R), a();
  }
  function l() {
    if (n) {
      if (n.muted || n.volume === 0) {
        const h = i > 0 ? i : t;
        n.muted = !1, n.volume = h, o.volume = h, o.isMuted = !1, a();
        return;
      }
      i = n.volume > 0 ? n.volume : i, n.muted = !0, o.isMuted = !0, a();
    }
  }
  function p() {
    const h = o.loopMode === "one" ? "off" : "one";
    o.loopMode = h, n && (n.loop = h === "one"), a();
  }
  function L() {
    n && (n.pause(), n.currentTime = 0, n.loop = o.loopMode === "one", n.volume = o.volume, n.muted = o.isMuted), o.isReady = !1, o.isPlaying = !1, o.isBuffering = !1, o.duration = 0, o.currentTime = 0, o.bufferedUntil = 0, o.errorKey = null, a();
  }
  function P() {
    n && (n.loop = o.loopMode === "one", n.volume = o.volume, n.muted = o.isMuted, c(), a());
  }
  function z() {
    o.isReady = !0, o.isBuffering = !1, a();
  }
  function O() {
    o.isReady = !0, o.isPlaying = !0, o.isBuffering = !1, o.errorKey = null, a();
  }
  function y() {
    o.isPlaying = !1, o.isBuffering = !1, a();
  }
  function V() {
    o.isBuffering = !0, a();
  }
  function J() {
    o.isPlaying = o.loopMode === "one", o.isBuffering = !1, a(), o.loopMode !== "one" && e.onEnded?.();
  }
  function ee() {
    c(), a();
  }
  function te() {
    c(), a();
  }
  function K() {
    n && (o.volume = n.volume, o.isMuted = n.muted, !n.muted && n.volume > 0 && (i = n.volume), a());
  }
  function v() {
    o.isReady = !1, o.isPlaying = !1, o.isBuffering = !1, o.errorKey = ke(n?.error ?? null), a();
  }
  return {
    getSnapshot: () => ({ ...o }),
    attach: u,
    togglePlayback: f,
    seekBy: m,
    seekTo: d,
    setVolumeLevel: g,
    toggleMute: l,
    toggleLoopMode: p,
    resetSession: L,
    handleLoadedMetadata: P,
    handleCanPlay: z,
    handlePlaying: O,
    handlePause: y,
    handleWaiting: V,
    handleEnded: J,
    handleTimeUpdate: ee,
    handleProgress: te,
    handleVolumeChange: K,
    handleError: v
  };
}
const we = "one";
function Dt(e) {
  const { sessionKey: t } = e, r = F(null), n = F(e.onEnded), [i, o] = S(!1), [a, u] = S(!1), [c, f] = S(!1), [d, m] = S(!1), [g, l] = S(se), [p, L] = S(0), [P, z] = S(0), [O, y] = S(0), [V, J] = S(we), [ee, te] = S(null), K = F(null);
  K.current === null && (K.current = Rt({
    defaultVolume: se,
    defaultLoopMode: we,
    onStateChange: (h) => {
      o(h.isReady), u(h.isPlaying), f(h.isBuffering), m(h.isMuted), l(h.volume), L(h.duration), z(h.currentTime), y(h.bufferedUntil), J(h.loopMode), te(h.errorKey);
    },
    onEnded: () => {
      n.current?.();
    }
  }));
  const v = K.current;
  return W(() => {
    n.current = e.onEnded;
  }, [e.onEnded]), W(() => {
    v.attach(r.current ? r.current : null);
  }), W(() => {
    v.resetSession();
  }, [v, t]), {
    audioRef: r,
    isReady: i,
    isPlaying: a,
    isBuffering: c,
    isMuted: d,
    volume: g,
    duration: p,
    currentTime: P,
    bufferedUntil: O,
    loopMode: V,
    errorKey: ee,
    togglePlayback: () => v.togglePlayback(),
    seekBy: (h) => v.seekBy(h),
    seekTo: (h) => v.seekTo(h),
    setVolumeLevel: (h) => v.setVolumeLevel(h),
    toggleMute: () => v.toggleMute(),
    toggleLoopMode: () => v.toggleLoopMode(),
    handleLoadedMetadata: (h) => v.handleLoadedMetadata(),
    handleCanPlay: () => v.handleCanPlay(),
    handlePlaying: () => v.handlePlaying(),
    handlePause: () => v.handlePause(),
    handleWaiting: () => v.handleWaiting(),
    handleEnded: () => v.handleEnded(),
    handleTimeUpdate: () => v.handleTimeUpdate(),
    handleProgress: () => v.handleProgress(),
    handleVolumeChange: () => v.handleVolumeChange(),
    handleError: () => v.handleError()
  };
}
function Bt() {
  let e = [], t = -1;
  function r(n, i) {
    return i === 0 || n < -1 ? -1 : n >= i ? i - 1 : n;
  }
  return {
    items() {
      return e;
    },
    currentIndex() {
      return t;
    },
    current() {
      return t >= 0 && t < e.length ? e[t] ?? null : null;
    },
    setQueue(n, i = 0) {
      e = Array.isArray(n) ? [...n] : [], t = r(i, e.length);
    },
    append(n) {
      const i = Array.isArray(n) ? n : [];
      if (i.length !== 0) {
        if (e.length === 0) {
          e = [...i], t = 0;
          return;
        }
        e.push(...i);
      }
    },
    removeAt(n) {
      n < 0 || n >= e.length || (e.splice(n, 1), n < t ? t -= 1 : t >= e.length && (t = e.length - 1));
    },
    move(n, i) {
      if (n === i || n < 0 || n >= e.length || i < 0 || i >= e.length)
        return;
      const o = t >= 0 && t < e.length ? e[t] : void 0, [a] = e.splice(n, 1);
      e.splice(i, 0, a), o === void 0 ? t = -1 : t = e.indexOf(o);
    },
    clear() {
      e = [], t = -1;
    },
    goNext() {
      t < 0 || t >= e.length - 1 || (t += 1);
    },
    goPrevious() {
      t <= 0 || (t -= 1);
    },
    canGoPrevious() {
      return t > 0;
    },
    canGoNext() {
      return t >= 0 && t < e.length - 1;
    }
  };
}
function ve(e) {
  if (typeof e != "object" || e === null)
    return null;
  const t = e;
  if (!Array.isArray(t.items) || typeof t.currentIndex != "number")
    return null;
  const r = t.items.filter(
    (o) => typeof o == "object" && o !== null && typeof o.source?.resourceUri == "string"
  ), n = t.currentIndex, i = Number.isInteger(n) && n >= -1 && n < r.length ? n : r.length > 0 ? 0 : -1;
  return { items: r, currentIndex: i };
}
function Ot() {
  let e = null;
  return {
    load: () => e === null ? null : ve(e),
    save: (t) => {
      e = ve(t);
    },
    clear: () => {
      e = null;
    }
  };
}
const $t = Ot();
function Ft() {
  return $t;
}
function ne(e) {
  return { items: [...e.items()], currentIndex: e.currentIndex() };
}
function zt(e = {}) {
  const t = e.store ?? Ft(), r = F(null);
  r.current === null && (r.current = Bt());
  const n = r.current, [i, o] = S(() => ({
    items: [],
    currentIndex: -1
  })), a = U(() => {
    const l = ne(n);
    o(l), t.save(l);
  }, [n, t]);
  W(() => {
    const l = t.load();
    l !== null && l.items.length > 0 && n.items().length === 0 && (n.setQueue([...l.items], l.currentIndex), o(ne(n)));
  }, [n, t]);
  const u = U(
    (l) => {
      n.append([l]), a();
    },
    [n, a]
  ), c = U(
    (l) => {
      n.removeAt(l), a();
    },
    [n, a]
  ), f = U(
    (l) => {
      n.setQueue([...n.items()], l), a();
    },
    [n, a]
  ), d = U(() => {
    n.goNext(), a();
  }, [n, a]), m = U(() => {
    n.goPrevious(), a();
  }, [n, a]), g = U(() => {
    n.clear(), t.clear(), o(ne(n));
  }, [n, t]);
  return {
    presentations: i.items,
    currentIndex: i.currentIndex,
    current: i.currentIndex >= 0 ? i.items[i.currentIndex] ?? null : null,
    canGoNext: n.canGoNext(),
    canGoPrevious: n.canGoPrevious(),
    append: u,
    removeAt: c,
    playAt: f,
    goNext: d,
    goPrevious: m,
    clear: g
  };
}
const Te = 5;
function Vt(e) {
  return e instanceof HTMLElement && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable);
}
function Kt(e, t) {
  switch (t) {
    case " ":
      return e.togglePlayback(), !0;
    case "ArrowLeft":
      return e.seekBy(-Te), !0;
    case "ArrowRight":
      return e.seekBy(Te), !0;
    case "ArrowUp":
      return e.volumeStep(1), !0;
    case "ArrowDown":
      return e.volumeStep(-1), !0;
    case "m":
    case "M":
      return e.toggleMute(), !0;
    case "l":
    case "L":
      return e.toggleLoopMode(), !0;
    case "n":
    case "N":
      return e.goNext(), !0;
    case "p":
    case "P":
      return e.goPrevious(), !0;
    default:
      return !1;
  }
}
const Gt = [
  { keys: "空格", label: "播放或暂停" },
  { keys: "← →", label: "快退 / 快进 5 秒" },
  { keys: "↑ ↓", label: "音量增减" },
  { keys: "M", label: "静音切换" },
  { keys: "L", label: "单曲循环切换" },
  { keys: "N / P", label: "下一首 / 上一首" }
];
function jt(e) {
  const t = F(e);
  return t.current = e, U((r) => {
    Vt(r.target) || Kt(t.current, r.key) && r.preventDefault();
  }, []);
}
const Wt = 960, Xt = 1.08;
function xe(e, t) {
  return e <= 0 || t <= 0 ? !1 : e <= Wt && t / e >= Xt;
}
const Ht = {
  mediaAborted: "音频加载已取消。",
  mediaNetwork: "加载音频时发生网络错误。",
  mediaDecode: "当前运行时无法解码该音频（MUSIC_PLAYER_DECODE_UNSUPPORTED）。",
  mediaSource: "音频资源不可用（MUSIC_PLAYER_SOURCE_UNAVAILABLE）。",
  loadFailed: "音频加载失败，或当前运行时无法解码该音频。"
};
function Yt(e) {
  return e === null ? null : {
    tone: "error",
    message: Ht[e] ?? "音频加载失败，或当前运行时无法解码该音频。"
  };
}
function Qt(e) {
  return typeof e == "string" && e.trim().length > 0;
}
function qt(e) {
  if (!Qt(e))
    return;
  const t = e.trim();
  if (!t || t.includes("\\") || t.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(t))
    return;
  const r = t.replace(/^\.\//, "");
  if (!r)
    return;
  const n = r.split("/").filter(Boolean);
  if (!(n.length === 0 || n.some((i) => i === "." || i === "..")))
    return n.join("/");
}
function Zt(e) {
  const t = qt(e);
  if (!t)
    return "";
  const r = t.split("/");
  return r[r.length - 1] ?? "";
}
function Pe(e) {
  if (e instanceof Uint8Array) {
    const t = new ArrayBuffer(e.byteLength), r = new Uint8Array(t);
    return r.set(e), r;
  }
  return new Uint8Array(e.slice(0));
}
function Jt(e, t, r) {
  const n = e.slice(t, r);
  return Pe(n);
}
function A(e, t) {
  return new DataView(e.buffer, e.byteOffset, e.byteLength).getUint32(t, !1);
}
function re(e, t) {
  return new DataView(e.buffer, e.byteOffset, e.byteLength).getUint32(t, !0);
}
function en(e, t) {
  return A(e, t) * 2 ** 32 + A(e, t + 4);
}
function tn(e, t) {
  return (e[t] ?? 0) << 16 | (e[t + 1] ?? 0) << 8 | (e[t + 2] ?? 0);
}
function oe(e, t) {
  return ((e[t] ?? 0) & 127) << 21 | ((e[t + 1] ?? 0) & 127) << 14 | ((e[t + 2] ?? 0) & 127) << 7 | (e[t + 3] ?? 0) & 127;
}
function b(e) {
  return Array.from(e, (t) => String.fromCharCode(t)).join("");
}
function ce(e, t = !1) {
  let r = e, n = t;
  if (r.length >= 2 && (r[0] === 254 && r[1] === 255 ? (n = !0, r = r.slice(2)) : r[0] === 255 && r[1] === 254 && (n = !1, r = r.slice(2))), n) {
    const i = new Uint8Array(r.length);
    for (let o = 0; o < r.length; o += 2)
      i[o] = r[o + 1] ?? 0, i[o + 1] = r[o] ?? 0;
    r = i;
  }
  return new TextDecoder("utf-16le", { fatal: !1 }).decode(r).replace(/\u0000+$/g, "");
}
function _(e, t) {
  switch (t) {
    case 0:
      return b(e).replace(/\u0000+$/g, "");
    case 1:
      return ce(e);
    case 2:
      return ce(e, !0);
    case 3:
      return new TextDecoder("utf-8", { fatal: !1 }).decode(e).replace(/\u0000+$/g, "");
    default:
      return new TextDecoder("utf-8", { fatal: !1 }).decode(e).replace(/\u0000+$/g, "");
  }
}
function X(e, t, r) {
  if (r === 1 || r === 2) {
    for (let n = t; n + 1 < e.length; n += 2)
      if (e[n] === 0 && e[n + 1] === 0)
        return {
          text: _(e.slice(t, n), r),
          nextOffset: n + 2
        };
    return {
      text: _(e.slice(t), r),
      nextOffset: e.length
    };
  }
  for (let n = t; n < e.length; n += 1)
    if (e[n] === 0)
      return {
        text: _(e.slice(t, n), r),
        nextOffset: n + 1
      };
  return {
    text: _(e.slice(t), r),
    nextOffset: e.length
  };
}
function nn(e) {
  const t = [];
  for (let i = 0; i < e.length; i += 1) {
    const o = e[i] ?? 0, a = e[i + 1];
    t.push(o), o === 255 && a === 0 && (i += 1);
  }
  const r = new ArrayBuffer(t.length), n = new Uint8Array(r);
  return n.set(t), n;
}
function M(e, t) {
  return e?.trim() || t?.trim() || void 0;
}
function rn(e) {
  const t = e?.trim().toLowerCase();
  if (t)
    return t === "image/jpg" ? "image/jpeg" : t;
}
function on(e) {
  if (e.length >= 3 && e[0] === 255 && e[1] === 216 && e[2] === 255)
    return "image/jpeg";
  if (e.length >= 8 && e[0] === 137 && e[1] === 80 && e[2] === 78 && e[3] === 71 && e[4] === 13 && e[5] === 10 && e[6] === 26 && e[7] === 10)
    return "image/png";
  if (e.length >= 12 && b(e.slice(0, 4)) === "RIFF" && b(e.slice(8, 12)) === "WEBP")
    return "image/webp";
  if (e.length >= 6 && (b(e.slice(0, 6)) === "GIF87a" || b(e.slice(0, 6)) === "GIF89a"))
    return "image/gif";
  if (e.length >= 4 && (e[0] === 73 && e[1] === 73 && e[2] === 42 && e[3] === 0 || e[0] === 77 && e[1] === 77 && e[2] === 0 && (e[3] === 42 || e[3] === 43) || e[0] === 73 && e[1] === 73 && e[2] === 43 && e[3] === 0))
    return "image/tiff";
  if (e.length >= 2 && e[0] === 66 && e[1] === 77)
    return "image/bmp";
}
function Ue(e, t) {
  return on(e) ?? rn(t) ?? "image/jpeg";
}
function an(e) {
  const t = Math.max(0, e), r = Math.floor(t / 6e4), n = Math.floor(t % 6e4 / 1e3), i = Math.floor(t % 1e3 / 10);
  return `[${String(r).padStart(2, "0")}:${String(n).padStart(2, "0")}.${String(i).padStart(2, "0")}]`;
}
function ln(e) {
  if (e.length < 10)
    return;
  const t = e[0] ?? 0, r = e[4] ?? 0;
  let n = 6;
  if (n = X(e, n, t).nextOffset, r !== 1)
    return;
  const i = [];
  for (; n < e.length; ) {
    const o = X(e, n, t);
    if (n = o.nextOffset, n + 4 > e.length)
      break;
    const a = A(e, n);
    n += 4;
    const u = o.text.trim();
    u && i.push(`${an(a)}${u}`);
  }
  return i.length > 0 ? i.join(`
`) : void 0;
}
function Ie(e) {
  if (e.length < 10 || b(e.slice(0, 3)) !== "ID3")
    return {};
  const t = e[3] ?? 0, r = e[5] ?? 0, n = oe(e, 6);
  let i = Jt(e, 10, 10 + n);
  if ((r & 128) !== 0 && (i = nn(i)), (r & 64) !== 0 && i.length >= 4) {
    const a = t === 4 ? oe(i, 0) : A(i, 0) + 4;
    i = i.slice(Math.min(a, i.length));
  }
  const o = {};
  for (let a = 0; a + 10 <= i.length; ) {
    const u = b(i.slice(a, a + 4));
    if (!u.trim() || /^\x00+$/u.test(u))
      break;
    const c = t === 4 ? oe(i, a + 4) : A(i, a + 4);
    if (c <= 0 || a + 10 + c > i.length)
      break;
    const f = i.slice(a + 10, a + 10 + c);
    switch (u) {
      case "TIT2":
        o.title = M(o.title, _(f.slice(1), f[0] ?? 0).trim());
        break;
      case "TPE1":
        o.artist = M(o.artist, _(f.slice(1), f[0] ?? 0).trim());
        break;
      case "TALB":
        o.album = M(o.album, _(f.slice(1), f[0] ?? 0).trim());
        break;
      case "USLT": {
        const d = f[0] ?? 0, m = X(f, 4, d), g = _(f.slice(m.nextOffset), d).trim();
        o.lyricsText = M(o.lyricsText, g);
        break;
      }
      case "SYLT":
        o.timedLyricsText = M(o.timedLyricsText, ln(f));
        break;
      case "APIC": {
        const d = f[0] ?? 0, m = X(f, 1, 0), g = m.nextOffset, l = X(f, g + 1, d), p = f.slice(l.nextOffset);
        p.length > 0 && (o.artwork = {
          mimeType: Ue(p, m.text),
          bytes: p,
          description: l.text
        });
        break;
      }
    }
    a += 10 + c;
  }
  return o;
}
function sn(e) {
  const t = {};
  if (e.length < 8)
    return t;
  let r = 0;
  const n = re(e, r);
  if (r += 4 + n, r + 4 > e.length)
    return t;
  const i = re(e, r);
  r += 4;
  for (let o = 0; o < i && !(r + 4 > e.length); o += 1) {
    const a = re(e, r);
    if (r += 4, r + a > e.length)
      break;
    const u = new TextDecoder("utf-8", { fatal: !1 }).decode(e.slice(r, r + a));
    r += a;
    const c = u.indexOf("=");
    if (c <= 0)
      continue;
    const f = u.slice(0, c).trim().toUpperCase(), d = u.slice(c + 1).trim();
    f && d && (t[f] = d);
  }
  return t;
}
function cn(e) {
  if (e.length < 32)
    return;
  let t = 0;
  t += 4;
  const r = A(e, t);
  t += 4;
  const n = new TextDecoder("utf-8", { fatal: !1 }).decode(e.slice(t, t + r));
  t += r;
  const i = A(e, t);
  t += 4;
  const o = new TextDecoder("utf-8", { fatal: !1 }).decode(e.slice(t, t + i));
  t += i, t += 16;
  const a = A(e, t);
  if (t += 4, !(t + a > e.length))
    return {
      mimeType: Ue(e.slice(t, t + a), n),
      bytes: e.slice(t, t + a),
      description: o
    };
}
function Me(e) {
  if (e.length < 4 || b(e.slice(0, 4)) !== "fLaC")
    return {};
  const t = {};
  let r = 4, n = !1;
  for (; !n && r + 4 <= e.length; ) {
    const i = e[r] ?? 0;
    n = (i & 128) !== 0;
    const o = i & 127, a = tn(e, r + 1);
    if (r += 4, r + a > e.length)
      break;
    const u = e.slice(r, r + a);
    if (r += a, o === 4) {
      const c = sn(u);
      t.title = M(t.title, c.TITLE), t.artist = M(t.artist, c.ARTIST), t.album = M(t.album, c.ALBUM), t.lyricsText = M(t.lyricsText, c.LYRICS) ?? M(t.lyricsText, c.UNSYNCEDLYRICS) ?? M(t.lyricsText, c["UNSYNCED LYRICS"]);
    } else o === 6 && (t.artwork = t.artwork ?? cn(u));
  }
  return t;
}
const un = /* @__PURE__ */ new Set([
  "moov",
  "udta",
  "meta",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "dinf",
  "ilst"
]);
function ue(e, t, r) {
  if (t + 8 > r)
    return;
  let n = A(e, t);
  const i = b(e.slice(t + 4, t + 8));
  let o = 8;
  if (n === 1) {
    if (t + 16 > r)
      return;
    n = en(e, t + 8), o = 16;
  } else n === 0 && (n = r - t);
  if (!Number.isFinite(n) || n < o || t + n > r)
    return;
  let a = t + o;
  if (i === "meta") {
    if (a + 4 > t + n)
      return;
    a += 4;
  }
  return {
    type: i,
    start: t,
    end: t + n,
    payloadStart: a,
    payloadEnd: t + n
  };
}
function Y(e, t) {
  return t === 2 ? ce(e).replace(/\u0000+$/g, "").trim() : new TextDecoder("utf-8", { fatal: !1 }).decode(e).replace(/\u0000+$/g, "").trim();
}
function dn(e) {
  if (e.length >= 4 && e[0] === 137 && e[1] === 80 && e[2] === 78 && e[3] === 71)
    return "image/png";
  if (e.length >= 3 && e[0] === 255 && e[1] === 216 && e[2] === 255)
    return "image/jpeg";
  if (e.length >= 4 && e[0] === 82 && e[1] === 73 && e[2] === 70 && e[3] === 70)
    return "image/webp";
  if (e.length >= 4 && (e[0] === 73 && e[1] === 73 && e[2] === 42 && e[3] === 0 || e[0] === 77 && e[1] === 77 && e[2] === 0 && (e[3] === 42 || e[3] === 43) || e[0] === 73 && e[1] === 73 && e[2] === 43 && e[3] === 0))
    return "image/tiff";
}
function fn(e, t) {
  const r = (() => {
    switch (t) {
      case 13:
        return "image/jpeg";
      case 14:
        return "image/png";
      case 27:
        return "image/bmp";
      default:
        return dn(e);
    }
  })();
  if (!(!r || e.length === 0))
    return {
      mimeType: r,
      bytes: e
    };
}
function mn(e, t, r) {
  for (let n = t; n + 8 <= r; ) {
    const i = ue(e, n, r);
    if (!i)
      break;
    if (i.type === "data")
      return i.payloadStart + 8 > i.payloadEnd ? void 0 : {
        dataType: A(e, i.payloadStart),
        value: e.slice(i.payloadStart + 8, i.payloadEnd)
      };
    n = i.end;
  }
}
function pn(e, t, r) {
  const n = mn(e, t.payloadStart, t.payloadEnd);
  if (n)
    switch (t.type) {
      case "©nam":
        r.title = M(r.title, Y(n.value, n.dataType));
        break;
      case "©ART":
      case "aART":
        r.artist = M(r.artist, Y(n.value, n.dataType));
        break;
      case "©alb":
        r.album = M(r.album, Y(n.value, n.dataType));
        break;
      case "©lyr":
        r.lyricsText = M(r.lyricsText, Y(n.value, n.dataType));
        break;
      case "covr":
        r.artwork = r.artwork ?? fn(n.value, n.dataType);
        break;
    }
}
function Ne(e, t, r, n) {
  for (let i = t; i + 8 <= r; ) {
    const o = ue(e, i, r);
    if (!o)
      break;
    if (n(o), o.type === "ilst")
      for (let a = o.payloadStart; a + 8 <= o.payloadEnd; ) {
        const u = ue(e, a, o.payloadEnd);
        if (!u)
          break;
        n(u), a = u.end;
      }
    else un.has(o.type) && Ne(e, o.payloadStart, o.payloadEnd, n);
    i = o.end;
  }
}
function Se(e) {
  const t = {};
  return Ne(e, 0, e.length, (r) => {
    r.type !== "ilst" && r.type.length === 4 && pn(e, r, t);
  }), t;
}
function gn(e) {
  const t = Zt(e).toLowerCase(), r = t.lastIndexOf(".");
  return r >= 0 ? t.slice(r) : "";
}
function hn(e) {
  const t = Pe(e.bytes), r = e.mimeType?.trim().toLowerCase(), n = gn(e.fileName ?? "");
  return t.length >= 3 && b(t.slice(0, 3)) === "ID3" ? Ie(t) : t.length >= 4 && b(t.slice(0, 4)) === "fLaC" ? Me(t) : t.length >= 8 && b(t.slice(4, 8)) === "ftyp" ? Se(t) : r === "audio/mpeg" || n === ".mp3" ? Ie(t) : r === "audio/flac" || n === ".flac" ? Me(t) : r === "audio/mp4" || r === "audio/x-m4a" || n === ".m4a" || n === ".mp4" ? Se(t) : {};
}
const yn = ["utf-8", "utf-16le", "gbk", "big5", "shift_jis"];
function de(e = "none") {
  return {
    mode: "empty",
    source: e,
    lines: [],
    metadata: {},
    rawText: "",
    offsetMs: 0
  };
}
function kn(e) {
  return e ? e.length === 3 ? Number.parseInt(e, 10) : e.length === 2 ? Number.parseInt(e, 10) * 10 : Number.parseInt(e.padEnd(3, "0"), 10) : 0;
}
function wn(e) {
  const t = e instanceof Uint8Array ? e : new Uint8Array(e);
  for (const r of yn)
    try {
      return new TextDecoder(r, { fatal: !0 }).decode(t);
    } catch {
    }
  return new TextDecoder("utf-8", { fatal: !1 }).decode(t);
}
function fe(e, t = "companion") {
  const r = e.replace(/\r\n/g, `
`).replace(/\r/g, `
`).trim();
  if (!r)
    return de(t);
  const n = {};
  let i = 0;
  const o = [], a = [];
  for (const u of r.split(`
`)) {
    const c = u.trim();
    if (!c)
      continue;
    const f = Array.from(c.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g));
    if (f.length > 0) {
      const m = c.replace(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, "").trim();
      if (!m)
        continue;
      for (const g of f) {
        const l = Number.parseInt(g[1] ?? "0", 10), p = Number.parseInt(g[2] ?? "0", 10), L = kn(g[3]);
        o.push({
          timeMs: l * 6e4 + p * 1e3 + L,
          text: m
        });
      }
      continue;
    }
    const d = c.match(/^\[([a-zA-Z]+):(.*)\]$/);
    if (d) {
      const m = d[1]?.trim().toLowerCase(), g = d[2]?.trim();
      if (!g)
        continue;
      switch (m) {
        case "ar":
          n.artist = g;
          break;
        case "ti":
          n.title = g;
          break;
        case "al":
          n.album = g;
          break;
        case "by":
          n.by = g;
          break;
        case "offset":
          i = Number.parseInt(g, 10) || 0;
          break;
      }
      continue;
    }
    a.push(c);
  }
  if (o.length > 0) {
    const u = o.map((c, f) => ({
      id: `timed-${f}`,
      timeMs: Math.max(0, c.timeMs + i),
      text: c.text
    })).sort((c, f) => (c.timeMs ?? 0) - (f.timeMs ?? 0));
    return {
      mode: "timed",
      source: t,
      lines: u,
      metadata: n,
      rawText: r,
      offsetMs: i
    };
  }
  return a.length > 0 ? {
    mode: "plain",
    source: t,
    lines: a.map((u, c) => ({
      id: `plain-${c}`,
      timeMs: null,
      text: u
    })),
    metadata: n,
    rawText: r,
    offsetMs: i
  } : de(t);
}
function vn(e, t) {
  if (!Number.isFinite(t) || e.length === 0)
    return -1;
  let r = 0, n = e.length - 1, i = -1;
  for (; r <= n; ) {
    const o = Math.floor((r + n) / 2), u = e[o]?.timeMs ?? null;
    if (u === null || u > t) {
      n = o - 1;
      continue;
    }
    i = o, r = o + 1;
  }
  return i;
}
function Tn(e, t, r) {
  if (!Number.isFinite(t) || r < 0 || r >= e.length)
    return 0;
  const n = e[r]?.timeMs;
  if (typeof n != "number" || !Number.isFinite(n))
    return 0;
  for (let i = r + 1; i < e.length; i += 1) {
    const o = e[i]?.timeMs;
    if (typeof o != "number" || !Number.isFinite(o) || o <= n)
      continue;
    const a = (t - n) / (o - n);
    return Math.min(1, Math.max(0, a));
  }
  return t >= n ? 1 : 0;
}
function xn(e) {
  try {
    return decodeURIComponent(e);
  } catch {
    return e;
  }
}
function _e(e) {
  const t = e.trim();
  if (!t || !Ae(t))
    return null;
  const r = t.startsWith("data:"), n = r ? /^data:([^;,]+)/u.exec(t)?.[1] ?? "audio/mpeg" : void 0, i = r ? n : At(t), o = {
    sourceId: t,
    filePath: t,
    fileName: r ? "audio-data" : xn(Ce(t)),
    ...i !== void 0 ? { mimeType: i } : {}
  };
  return {
    sourceId: o.sourceId,
    ...o.filePath !== void 0 ? { filePath: o.filePath } : {},
    fileName: o.fileName || o.sourceId,
    title: Ct(o),
    resourceUri: t,
    ...o.mimeType !== void 0 ? { mimeType: o.mimeType } : {},
    ...Z(t) && !r ? { extension: Z(t) } : {},
    revision: 1,
    isRemote: t.startsWith("http:") || t.startsWith("https:")
  };
}
function In(e) {
  if (!e.audioUri.trim())
    return "请输入音频地址。";
  if (_e(e.audioUri) === null)
    return "暂不支持该地址形式：请使用 file://、http(s)://、blob: 或 data: 地址。";
  for (const [r, n] of [
    ["歌词", e.lyricsUri],
    ["封面", e.coverUri]
  ]) {
    const i = n?.trim() ?? "";
    if (i && !Ae(i))
      return `${r}地址不可用：请使用 file://、http(s)://、blob: 或 data: 地址。`;
  }
}
async function Mn(e) {
  if (e.resourceUri.startsWith("file:"))
    return null;
  try {
    const t = await fetch(e.resourceUri);
    if (!t.ok)
      return null;
    const r = await t.arrayBuffer();
    return hn({ bytes: r, fileName: e.fileName });
  } catch {
    return null;
  }
}
async function Sn(e) {
  try {
    const t = await fetch(e);
    if (!t.ok)
      return null;
    const r = await t.arrayBuffer(), n = fe(wn(r), "companion");
    return n.mode === "empty" ? null : n;
  } catch {
    return null;
  }
}
function En(e) {
  const t = e?.timedLyricsText?.trim();
  if (t)
    return fe(t, "embedded");
  const r = e?.lyricsText?.trim();
  return r ? fe(r, "embedded") : null;
}
function Re(e) {
  const { source: t } = e, r = e.metadata ?? null, n = e.cardDisplay?.title?.trim() || t.title || t.fileName, i = e.cardDisplay?.artist?.trim() || r?.artist?.trim() || "", o = r?.album?.trim() || "", a = e.companionLyrics && e.companionLyrics.mode !== "empty" ? e.companionLyrics : En(r) ?? de("none"), u = e.companionCoverUri?.trim(), c = r?.artwork, f = u && u.length > 0 ? { kind: "companion", uri: u } : c && c.bytes.length > 0 ? { kind: "embedded", artwork: c, cacheKey: `${t.sourceId}#${t.revision}` } : { kind: "default" };
  return {
    source: t,
    title: n,
    artist: i,
    album: o,
    artwork: f,
    lyrics: a
  };
}
function bn(e) {
  const t = In(e);
  if (t !== void 0)
    return { ok: !1, error: t };
  const r = _e(e.audioUri);
  return r === null ? { ok: !1, error: "无法识别的音频地址。" } : { ok: !0, presentation: Re({
    source: r,
    ...e.title !== void 0 || e.coverUri !== void 0 ? {
      cardDisplay: {
        ...e.title !== void 0 ? { title: e.title } : {}
      }
    } : {},
    ...e.coverUri?.trim() ? { companionCoverUri: e.coverUri.trim() } : {}
  }) };
}
function De(e) {
  return Pt(e.source.resourceUri, e.source.mimeType);
}
async function Ln(e) {
  const t = {
    audioUri: e.audioUri,
    ...e.title ? { title: e.title } : {},
    ...e.lyricsUri ? { lyricsUri: e.lyricsUri } : {},
    ...e.coverUri ? { coverUri: e.coverUri } : {}
  }, r = bn(t);
  if (!r.ok)
    throw new Error(r.error);
  const n = r.presentation.source, [i, o] = await Promise.all([
    Mn(n),
    t.lyricsUri ? Sn(t.lyricsUri.trim()) : Promise.resolve(null)
  ]);
  return Re({
    source: n,
    metadata: i,
    companionLyrics: o,
    ...t.coverUri ? { companionCoverUri: t.coverUri.trim() } : {},
    ...t.title ? { cardDisplay: { title: t.title.trim() } } : {}
  });
}
const Be = ({ onAppend: e, submitLabel: t }) => {
  const { token: r } = B.useToken(), [n] = $.useForm(), [i, o] = T.useState(null), [a, u] = T.useState(!1);
  return /* @__PURE__ */ k(Ge, { spinning: a, description: "正在装配曲目", children: [
    /* @__PURE__ */ k(
      $,
      {
        form: n,
        layout: "vertical",
        style: { width: "min(520px, 100%)" },
        onFinish: (f) => {
          o(null), u(!0), (async () => {
            try {
              const d = await Ln(f);
              e(d), n.resetFields();
            } catch (d) {
              o(d instanceof Error ? d.message : "无法识别的音频地址。");
            } finally {
              u(!1);
            }
          })();
        },
        children: [
          /* @__PURE__ */ s(
            $.Item,
            {
              name: "audioUri",
              label: "音频地址",
              required: !0,
              rules: [{ required: !0, message: "请输入音频地址。" }],
              children: /* @__PURE__ */ s(H, { placeholder: "音频地址（file://、https://、blob:、data:）", "aria-label": "音频地址", allowClear: !0 })
            }
          ),
          /* @__PURE__ */ s($.Item, { name: "title", label: "标题（可选，缺省按文件名）", children: /* @__PURE__ */ s(H, { placeholder: "展示标题", "aria-label": "展示标题", allowClear: !0 }) }),
          /* @__PURE__ */ s($.Item, { name: "lyricsUri", label: "歌词地址（可选，.lrc / .txt）", children: /* @__PURE__ */ s(H, { placeholder: "伴生歌词地址", "aria-label": "伴生歌词地址", allowClear: !0 }) }),
          /* @__PURE__ */ s($.Item, { name: "coverUri", label: "封面地址（可选）", children: /* @__PURE__ */ s(H, { placeholder: "伴生封面地址", "aria-label": "伴生封面地址", allowClear: !0 }) }),
          /* @__PURE__ */ s(N, { type: "primary", htmlType: "submit", block: !0, "aria-label": t, children: t })
        ]
      }
    ),
    i === null ? null : /* @__PURE__ */ s(x.Text, { type: "danger", role: "alert", children: i }),
    /* @__PURE__ */ k(
      x.Text,
      {
        type: "secondary",
        style: { display: "block", marginTop: r.marginSM, fontSize: r.fontSizeSM },
        children: [
          "支持格式：",
          bt
        ]
      }
    )
  ] });
}, Cn = ({ onAppend: e }) => {
  const { token: t } = B.useToken();
  return /* @__PURE__ */ k(
    "section",
    {
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: t.marginMD,
        padding: t.paddingXL
      },
      children: [
        /* @__PURE__ */ s(ae, { description: !1 }),
        /* @__PURE__ */ s(x.Title, { level: 4, style: { margin: 0 }, children: "打开音乐" }),
        /* @__PURE__ */ s(x.Text, { type: "secondary", children: "粘贴可直接播放的音频地址加入播放队列；资源路由投递（拖入文件与打开方式）随宿主资源通道落波。" }),
        /* @__PURE__ */ s(Be, { onAppend: e, submitLabel: "加入并播放" }),
        /* @__PURE__ */ k(x.Text, { type: "secondary", style: { fontSize: t.fontSizeSM }, children: [
          "快捷键：",
          Gt.map((r) => `${r.keys} ${r.label}`).join("，")
        ] })
      ]
    }
  );
}, An = /* @__PURE__ */ new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "image/bmp"
]);
function Oe(e) {
  const t = e?.trim().toLowerCase();
  return t && t.length > 0 ? t : "application/octet-stream";
}
function $e(e) {
  return e === "image/tiff" || e === "image/tif";
}
function Pn(e) {
  const t = new ArrayBuffer(e.byteLength), r = new Uint8Array(t);
  return r.set(e), r.buffer;
}
function Fe(e) {
  const t = new ArrayBuffer(e.byteLength), r = new Uint8Array(t);
  return r.set(e), r;
}
function Q(e, t) {
  return URL.createObjectURL(
    new Blob([Fe(e)], {
      type: t
    })
  );
}
function Un() {
  return typeof document > "u" || typeof document.createElement != "function" ? null : document.createElement("canvas");
}
function Nn(e) {
  const t = e.displayWidth ?? e.codedWidth ?? e.width, r = e.displayHeight ?? e.codedHeight ?? e.height;
  return !Number.isFinite(t) || !Number.isFinite(r) || !t || !r ? null : {
    width: t,
    height: r
  };
}
function _n(e) {
  return new Promise((t) => {
    e.toBlob((r) => {
      t(r);
    }, "image/png");
  });
}
async function ze(e) {
  const t = Un(), r = Nn(e);
  if (!t || !r)
    return null;
  const n = t.getContext("2d");
  return n ? (t.width = r.width, t.height = r.height, n.drawImage(e, 0, 0, r.width, r.height), _n(t)) : null;
}
async function Rn(e, t) {
  const r = globalThis.ImageDecoder;
  if (!r)
    return null;
  const n = r.isTypeSupported;
  if (typeof n == "function")
    try {
      if (!await n(t))
        return null;
    } catch {
      return null;
    }
  try {
    const i = new r({
      type: t,
      data: Pn(e)
    }), o = await i.decode(), a = await ze(o.image);
    return o.image.close?.(), i.close?.(), a;
  } catch {
    return null;
  }
}
async function Dn(e, t) {
  if (typeof createImageBitmap != "function")
    return null;
  try {
    const r = await createImageBitmap(
      new Blob([Fe(e)], {
        type: t
      })
    ), n = await ze(r);
    return r.close(), n;
  } catch {
    return null;
  }
}
async function Bn(e) {
  const t = Oe(e.mimeType);
  if ($e(t))
    return null;
  const r = await Rn(e.bytes, t);
  if (r)
    return new Uint8Array(await r.arrayBuffer());
  const n = await Dn(e.bytes, t);
  return n ? new Uint8Array(await n.arrayBuffer()) : null;
}
async function On(e) {
  const t = Oe(e.mimeType);
  if (An.has(t) || $e(t))
    return Q(e.bytes, t);
  const r = await Bn(e);
  return r ? Q(r, "image/png") : Q(e.bytes, t);
}
const $n = 3.5;
function Fn(e) {
  return !Number.isFinite(e) || e <= 0 ? 0 : e / $n;
}
const zn = ({ lyrics: e, currentTimeMs: t, viewportHeight: r = 320 }) => {
  const { token: n } = B.useToken(), i = T.useRef(null), o = T.useRef(null), a = e.mode === "timed" ? vn(e.lines, t) : -1, u = a >= 0 ? Tn(e.lines, t, a) : 0;
  return T.useEffect(() => {
    const c = i.current, f = o.current;
    if (!c || !f || a < 0 || typeof c.scrollTo != "function")
      return;
    const d = Fn(r);
    c.scrollTo({ top: Math.max(0, f.offsetTop - d), behavior: "smooth" });
  }, [a, r]), e.mode === "empty" ? /* @__PURE__ */ s(
    "div",
    {
      style: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 160
      },
      children: /* @__PURE__ */ s(x.Text, { type: "secondary", children: "暂无歌词" })
    }
  ) : /* @__PURE__ */ k(
    "div",
    {
      ref: i,
      "aria-label": e.mode === "timed" ? "同步歌词" : "文本歌词",
      style: {
        flex: 1,
        overflowY: "auto",
        scrollBehavior: "smooth",
        padding: `${n.paddingSM}px ${n.paddingMD}px`,
        display: "flex",
        flexDirection: "column",
        gap: n.marginSM
      },
      children: [
        e.mode === "timed" ? e.lines.map((c, f) => {
          const d = f === a, m = f < a;
          return /* @__PURE__ */ s(
            x.Paragraph,
            {
              ref: d ? o : void 0,
              style: {
                margin: 0,
                fontSize: d ? n.fontSizeLG : n.fontSize,
                fontWeight: d ? 600 : 400,
                color: d ? n.colorText : m ? n.colorTextSecondary : n.colorTextTertiary,
                transition: `color 200ms ease ${d ? 0 : 70}ms, font-size 200ms ease`,
                textAlign: "center"
              },
              children: c.text
            },
            c.id
          );
        }) : e.lines.map((c) => /* @__PURE__ */ s(
          x.Paragraph,
          {
            style: { margin: 0, color: n.colorTextSecondary, textAlign: "center" },
            children: c.text
          },
          c.id
        )),
        e.mode === "timed" && a >= 0 ? /* @__PURE__ */ s(
          x.Text,
          {
            type: "secondary",
            style: { fontSize: n.fontSizeSM, textAlign: "center" },
            "aria-label": "当前行进度",
            children: `歌词行进度 ${Math.round(u * 100)}%`
          }
        ) : null,
        e.lines.length === 0 ? /* @__PURE__ */ s("div", { style: { display: "flex", justifyContent: "center", padding: n.paddingMD }, children: /* @__PURE__ */ s(me, { style: { color: n.colorTextTertiary } }) }) : null
      ]
    }
  );
}, ie = /* @__PURE__ */ new Map();
function Vn({ presentation: e }) {
  const { artwork: t } = e, r = t.kind === "embedded" ? t.cacheKey : "", [n, i] = T.useState(
    r ? ie.get(r) ?? null : null
  );
  return T.useEffect(() => {
    if (t.kind !== "embedded")
      return;
    const o = ie.get(t.cacheKey);
    if (o !== void 0) {
      i(o);
      return;
    }
    let a = !1;
    return On(t.artwork).then((u) => {
      a || (ie.set(t.cacheKey, u), i(u));
    }), () => {
      a = !0;
    };
  }, [t]), n === null ? /* @__PURE__ */ s(me, { style: { fontSize: 96, color: "rgba(0,0,0,0.25)" }, "aria-label": "嵌入封面解析中" }) : /* @__PURE__ */ s(be, { src: n, alt: "嵌入封面", width: 192, height: 192, style: { objectFit: "cover", borderRadius: 8 } });
}
const Kn = ({
  presentation: e,
  currentTime: t,
  duration: r,
  bufferedUntil: n,
  onSeekPreview: i,
  onSeekCommit: o,
  seekPreview: a
}) => {
  const { token: u } = B.useToken(), c = De(e), f = r > 0, d = a ?? t;
  return /* @__PURE__ */ k(
    "section",
    {
      "aria-label": "播放舞台",
      style: {
        display: "flex",
        gap: u.marginLG,
        padding: `${u.paddingMD}px ${u.paddingLG}px 0`,
        flex: 1,
        minHeight: 0
      },
      children: [
        /* @__PURE__ */ k(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: u.marginSM,
              flex: "0 0 auto"
            },
            children: [
              /* @__PURE__ */ s(
                "div",
                {
                  style: {
                    width: 192,
                    height: 192,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: u.colorBgLayout,
                    borderRadius: 8,
                    overflow: "hidden"
                  },
                  children: e.artwork.kind === "companion" ? /* @__PURE__ */ s(
                    be,
                    {
                      src: e.artwork.uri,
                      alt: "伴生封面",
                      width: 192,
                      height: 192,
                      style: { objectFit: "cover" }
                    }
                  ) : e.artwork.kind === "embedded" ? /* @__PURE__ */ s(Vn, { presentation: e }) : /* @__PURE__ */ s(me, { style: { fontSize: 96, color: u.colorTextQuaternary }, "aria-label": "默认封面" })
                }
              ),
              /* @__PURE__ */ k("div", { style: { textAlign: "center", maxWidth: 220 }, children: [
                /* @__PURE__ */ s(x.Title, { level: 5, style: { margin: 0 }, ellipsis: !0, children: e.title }),
                /* @__PURE__ */ k(x.Text, { type: "secondary", style: { display: "block" }, ellipsis: !0, children: [
                  e.artist || "未知歌手",
                  e.album ? ` · ${e.album}` : ""
                ] }),
                c ? /* @__PURE__ */ s(je, { style: { marginTop: u.marginXXS }, "aria-label": "音频格式", children: c }) : null
              ] })
            ]
          }
        ),
        /* @__PURE__ */ k("div", { style: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }, children: [
          /* @__PURE__ */ s(zn, { lyrics: e.lyrics, currentTimeMs: t * 1e3 }),
          /* @__PURE__ */ k("div", { style: { display: "flex", alignItems: "center", gap: u.marginSM, paddingBlock: u.paddingXXS }, children: [
            /* @__PURE__ */ s(x.Text, { style: { fontVariantNumeric: "tabular-nums", fontSize: u.fontSizeSM }, children: q(t) }),
            /* @__PURE__ */ s(
              Le,
              {
                ariaLabelForHandle: "播放进度",
                min: 0,
                max: r > 0 ? r : 1,
                step: 0.1,
                disabled: !f,
                value: d,
                tooltip: { formatter: (m) => q(Number(m ?? 0)) },
                onChange: (m) => {
                  i(Number(m));
                },
                onChangeComplete: (m) => {
                  o(Number(m));
                },
                style: { flex: 1, marginInline: 0 }
              }
            ),
            /* @__PURE__ */ k(
              x.Text,
              {
                style: { fontVariantNumeric: "tabular-nums", fontSize: u.fontSizeSM },
                "aria-label": "剩余时长",
                children: [
                  n > 0 && n < r ? `已缓冲 ${q(n)} · ` : "",
                  _t(r, t)
                ]
              }
            )
          ] })
        ] })
      ]
    }
  );
}, Gn = ({
  isPlaying: e,
  isBuffering: t,
  isMuted: r,
  volume: n,
  loopMode: i,
  canGoNext: o,
  canGoPrevious: a,
  onTogglePlayback: u,
  onGoNext: c,
  onGoPrevious: f,
  onVolumeChange: d,
  onToggleMute: m,
  onToggleLoop: g
}) => {
  const { token: l } = B.useToken(), p = i === "one";
  return /* @__PURE__ */ k(
    "section",
    {
      "aria-label": "播放控制",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: l.marginSM,
        padding: `${l.paddingXXS}px ${l.paddingLG}px ${l.paddingSM}px`
      },
      children: [
        /* @__PURE__ */ s(G, { title: a ? "上一首（P）" : "已是队列开头", children: /* @__PURE__ */ s(
          N,
          {
            type: "text",
            "aria-label": "上一首",
            icon: /* @__PURE__ */ s(We, {}),
            disabled: !a,
            onClick: f
          }
        ) }),
        /* @__PURE__ */ s(G, { title: e ? "暂停（空格）" : "播放（空格）", children: /* @__PURE__ */ s(
          N,
          {
            type: "primary",
            shape: "circle",
            size: "large",
            "aria-label": e ? "暂停" : "播放",
            icon: e ? /* @__PURE__ */ s(Xe, {}) : /* @__PURE__ */ s(He, {}),
            loading: t,
            onClick: u
          }
        ) }),
        /* @__PURE__ */ s(G, { title: o ? "下一首（N）" : "已是队列末尾", children: /* @__PURE__ */ s(
          N,
          {
            type: "text",
            "aria-label": "下一首",
            icon: /* @__PURE__ */ s(Ye, {}),
            disabled: !o,
            onClick: c
          }
        ) }),
        /* @__PURE__ */ s(G, { title: r ? "取消静音（M）" : "静音（M）", children: /* @__PURE__ */ s(
          N,
          {
            type: "text",
            "aria-label": r ? "取消静音" : "静音",
            icon: r || n === 0 ? /* @__PURE__ */ s(Qe, {}) : /* @__PURE__ */ s(qe, {}),
            onClick: m
          }
        ) }),
        /* @__PURE__ */ s(
          Le,
          {
            ariaLabelForHandle: "音量",
            min: 0,
            max: 1,
            step: 0.05,
            value: n,
            tooltip: { formatter: (L) => `${Math.round(Number(L ?? 0) * 100)}%` },
            onChange: (L) => {
              d(Number(L));
            },
            style: { width: 120, marginInline: 0 }
          }
        ),
        /* @__PURE__ */ k(
          x.Text,
          {
            type: "secondary",
            style: { fontVariantNumeric: "tabular-nums", fontSize: l.fontSizeSM, minWidth: 36 },
            "aria-label": "音量百分比",
            children: [
              Math.round(n * 100),
              "%"
            ]
          }
        ),
        /* @__PURE__ */ s(G, { title: p ? "关闭单曲循环（L）" : "开启单曲循环（L）", children: /* @__PURE__ */ s(
          N,
          {
            type: "text",
            "aria-label": p ? "关闭单曲循环" : "开启单曲循环",
            icon: /* @__PURE__ */ s(Ze, {}),
            style: { color: p ? l.colorPrimary : void 0 },
            onClick: g
          }
        ) })
      ]
    }
  );
}, jn = ({
  presentations: e,
  currentIndex: t,
  onPlayAt: r,
  onRemoveAt: n,
  onClear: i
}) => {
  const { token: o } = B.useToken();
  return /* @__PURE__ */ k(
    "section",
    {
      "aria-label": "播放队列",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: o.marginXXS,
        padding: `0 ${o.paddingLG}px ${o.paddingSM}px`,
        minHeight: 0,
        flex: 1
      },
      children: [
        /* @__PURE__ */ k("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
          /* @__PURE__ */ s(x.Text, { strong: !0, children: `播放队列（${e.length}）` }),
          /* @__PURE__ */ s(
            N,
            {
              type: "text",
              size: "small",
              "aria-label": "清空播放队列",
              disabled: e.length === 0,
              onClick: i,
              children: "清空"
            }
          )
        ] }),
        e.length === 0 ? /* @__PURE__ */ s(ae, { description: "队列已清空", image: ae.PRESENTED_IMAGE_SIMPLE }) : /* @__PURE__ */ s("div", { role: "list", style: { overflowY: "auto", display: "flex", flexDirection: "column", gap: o.paddingXXS }, children: e.map((a, u) => {
          const c = u === t, f = De(a);
          return /* @__PURE__ */ k(
            "div",
            {
              role: "listitem",
              "aria-current": c ? "true" : void 0,
              onClick: () => r(u),
              style: {
                display: "flex",
                alignItems: "center",
                gap: o.marginSM,
                cursor: "pointer",
                padding: `${o.paddingXXS}px ${o.paddingSM}px`,
                borderRadius: o.borderRadiusLG,
                background: c ? o.colorPrimaryBg : void 0
              },
              children: [
                c ? /* @__PURE__ */ s(Je, { style: { color: o.colorPrimary, fontSize: 20 }, "aria-label": "正在播放" }) : /* @__PURE__ */ s(x.Text, { type: "secondary", style: { minWidth: 20, textAlign: "center" }, children: `${u + 1}.` }),
                /* @__PURE__ */ k("div", { style: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }, children: [
                  /* @__PURE__ */ s(x.Text, { strong: c, style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: a.title }),
                  /* @__PURE__ */ k(
                    x.Text,
                    {
                      type: "secondary",
                      style: { fontSize: o.fontSizeSM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                      children: [
                        a.artist || "未知歌手",
                        f ? ` · ${f}` : ""
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ s(
                  N,
                  {
                    type: "text",
                    size: "small",
                    "aria-label": `移除 ${a.title}`,
                    icon: /* @__PURE__ */ s(et, {}),
                    onClick: (d) => {
                      d.stopPropagation(), n(u);
                    }
                  }
                )
              ]
            },
            `${a.source.sourceId}#${u}`
          );
        }) })
      ]
    }
  );
}, Wn = "chips.official.music-player", Xn = 1600, Ee = 5, Hn = () => {
  const { token: e } = B.useToken(), t = zt(), [r, n] = T.useState(null), [i, o] = T.useState(null), [a, u] = T.useState(!1), [c, f] = T.useState(
    () => typeof window < "u" && xe(window.innerWidth, window.innerHeight)
  ), d = T.useRef(null), m = t.current, g = m ? `${m.source.sourceId}#${m.source.revision}` : null, l = Dt({
    sessionKey: g,
    onEnded: () => {
      t.canGoNext && t.goNext();
    }
  }), p = T.useCallback((y) => {
    n(y), d.current !== null && window.clearTimeout(d.current), d.current = window.setTimeout(() => {
      d.current = null, n(null);
    }, Xn);
  }, []);
  T.useEffect(() => () => {
    d.current !== null && window.clearTimeout(d.current);
  }, []), T.useEffect(() => {
    const y = () => {
      f(xe(window.innerWidth, window.innerHeight));
    };
    return window.addEventListener("resize", y), () => {
      window.removeEventListener("resize", y);
    };
  }, []), T.useEffect(() => {
    const y = Yt(l.errorKey);
    y !== null && p(y);
  }, [l.errorKey, p]);
  const L = T.useMemo(
    () => ({
      togglePlayback: () => {
        l.togglePlayback();
      },
      seekForward: () => {
        l.seekBy(Ee), p({ tone: "info", message: "前进 5 秒" });
      },
      seekBackward: () => {
        l.seekBy(-Ee), p({ tone: "info", message: "后退 5 秒" });
      },
      volumeUp: () => {
        const y = Math.min(1, l.volume + 0.1);
        l.setVolumeLevel(y), p({ tone: "info", message: `音量 ${Math.round(y * 100)}%` });
      },
      volumeDown: () => {
        const y = Math.max(0, l.volume - 0.1);
        l.setVolumeLevel(y), p({ tone: "info", message: `音量 ${Math.round(y * 100)}%` });
      },
      toggleMute: () => {
        l.toggleMute(), p({ tone: "info", message: l.isMuted ? "已取消静音" : "已静音" });
      },
      toggleLoop: () => {
        l.toggleLoopMode(), p({
          tone: "info",
          message: l.loopMode === "one" ? "已关闭单曲循环" : "已开启单曲循环"
        });
      },
      nextTrack: () => {
        t.canGoNext ? (t.goNext(), p({ tone: "info", message: "已切换到下一首" })) : p({ tone: "info", message: "已经是队列末尾" });
      },
      previousTrack: () => {
        t.canGoPrevious ? (t.goPrevious(), p({ tone: "info", message: "已返回上一首" })) : p({ tone: "info", message: "已经是队列开头" });
      },
      openCard: (y) => {
        const V = typeof y?.path == "string" ? y.path : "";
        p({
          tone: "error",
          message: `资源打开通道尚未就绪，暂不能打开：${V || "未提供路径"}`
        });
      },
      refreshView: () => {
        p({ tone: "info", message: "已刷新当前会话" });
      }
    }),
    [l, t, p]
  ), P = St(L), z = jt({
    togglePlayback: () => {
      l.togglePlayback();
    },
    seekBy: l.seekBy,
    volumeStep: (y) => {
      l.setVolumeLevel(
        Math.min(1, Math.max(0, Number((l.volume + y * 0.1).toFixed(2))))
      );
    },
    toggleMute: l.toggleMute,
    toggleLoopMode: l.toggleLoopMode,
    goNext: t.goNext,
    goPrevious: t.goPrevious
  });
  T.useEffect(() => {
    const y = P.lastInvoked;
    y !== null && y.commandId === I.refreshView && p({ tone: "info", message: "已刷新当前会话" });
  }, [P.lastInvoked, p]);
  const O = T.useCallback(
    (y) => {
      t.append(y), u(!1), p({ tone: "success", message: `已加入队列：${y.title}` });
    },
    [t, p]
  );
  return /* @__PURE__ */ k(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 320,
        background: e.colorBgBase,
        color: e.colorText
      },
      onKeyDown: z,
      children: [
        m === null ? /* @__PURE__ */ s(Cn, { onAppend: O }) : /* @__PURE__ */ k(Ve, { children: [
          /* @__PURE__ */ s(
            "audio",
            {
              ref: l.audioRef,
              src: m.source.resourceUri,
              onLoadedMetadata: l.handleLoadedMetadata,
              onCanPlay: l.handleCanPlay,
              onPlaying: l.handlePlaying,
              onPause: l.handlePause,
              onWaiting: l.handleWaiting,
              onEnded: l.handleEnded,
              onTimeUpdate: l.handleTimeUpdate,
              onProgress: l.handleProgress,
              onVolumeChange: l.handleVolumeChange,
              onError: l.handleError,
              style: { display: "none" }
            }
          ),
          /* @__PURE__ */ k(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: c ? "column" : "row",
                flex: 1,
                minHeight: 0,
                gap: c ? 0 : e.marginXS
              },
              children: [
                /* @__PURE__ */ k(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      flex: c ? void 0 : 3,
                      minWidth: 0
                    },
                    children: [
                      /* @__PURE__ */ s(
                        Kn,
                        {
                          presentation: m,
                          currentTime: l.currentTime,
                          duration: l.duration,
                          bufferedUntil: l.bufferedUntil,
                          seekPreview: i,
                          onSeekPreview: o,
                          onSeekCommit: (y) => {
                            o(null), l.seekTo(y);
                          }
                        }
                      ),
                      /* @__PURE__ */ s(
                        Gn,
                        {
                          isPlaying: l.isPlaying,
                          isBuffering: l.isBuffering,
                          isMuted: l.isMuted,
                          volume: l.volume,
                          loopMode: l.loopMode,
                          canGoNext: t.canGoNext,
                          canGoPrevious: t.canGoPrevious,
                          onTogglePlayback: () => {
                            l.togglePlayback();
                          },
                          onGoNext: t.goNext,
                          onGoPrevious: t.goPrevious,
                          onVolumeChange: l.setVolumeLevel,
                          onToggleMute: l.toggleMute,
                          onToggleLoop: l.toggleLoopMode
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ k(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      flex: c ? void 0 : 2,
                      minWidth: 0,
                      borderInlineStart: c ? void 0 : `1px solid ${e.colorBorderSecondary}`
                    },
                    children: [
                      /* @__PURE__ */ s("div", { style: { padding: `${e.paddingXXS}px ${e.paddingLG}px 0` }, children: /* @__PURE__ */ s(
                        N,
                        {
                          type: "dashed",
                          block: !0,
                          "aria-label": "添加曲目",
                          icon: /* @__PURE__ */ s(rt, {}),
                          onClick: () => {
                            u(!0);
                          },
                          children: "添加曲目"
                        }
                      ) }),
                      /* @__PURE__ */ s(
                        jn,
                        {
                          presentations: t.presentations,
                          currentIndex: t.currentIndex,
                          onPlayAt: t.playAt,
                          onRemoveAt: t.removeAt,
                          onClear: t.clear
                        }
                      )
                    ]
                  }
                )
              ]
            }
          )
        ] }),
        /* @__PURE__ */ s("div", { "aria-live": "polite", style: { paddingInline: e.paddingLG, minHeight: 24 }, children: r === null ? /* @__PURE__ */ s(
          x.Text,
          {
            type: "secondary",
            style: { fontSize: e.fontSizeSM },
            children: `命令注册状态：${Mt[P.phase]}${P.errorCode === null ? "" : `（${P.errorCode}）`}`
          }
        ) : /* @__PURE__ */ s(
          ot,
          {
            type: r.tone === "error" ? "error" : r.tone === "success" ? "success" : "info",
            title: r.message,
            showIcon: !0,
            style: { paddingBlock: 0 }
          }
        ) }),
        /* @__PURE__ */ s(
          it,
          {
            title: "添加曲目",
            open: a,
            footer: null,
            onCancel: () => {
              u(!1);
            },
            destroyOnHidden: !0,
            children: /* @__PURE__ */ s(Be, { onAppend: O, submitLabel: "加入队列" })
          }
        )
      ]
    }
  );
}, er = () => /* @__PURE__ */ s(tt, { appId: Wn, surface: "window", children: /* @__PURE__ */ s(nt, { children: /* @__PURE__ */ s(Hn, {}) }) });
export {
  er as AppView,
  er as default
};
