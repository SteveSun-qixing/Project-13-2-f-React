import { jsxs as b, jsx as s } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import w, { useState as R, useEffect as _, useCallback as y, useRef as W, useMemo as te } from "chips-resource://platform/vendor/react.js";
import { useCommandRuntime as Se, theme as N, Typography as E, Input as Ee, Button as S, Descriptions as Ie, Empty as ce, Tabs as xe, CheckOutlined as G, Slider as ue, Tooltip as A, PauseOutlined as Ce, CaretRightOutlined as we, BackwardOutlined as Re, ForwardOutlined as Le, SoundOutlined as Me, SoundFilled as _e, Dropdown as ne, RetweetOutlined as Ae, FontColorsOutlined as Fe, CustomerServiceOutlined as De, Popover as Oe, MoreOutlined as Ne, SwitcherOutlined as Ue, FullscreenExitOutlined as Be, FullscreenOutlined as Ke, QuestionCircleOutlined as Ve, Spin as $e, ReloadOutlined as He, Modal as ze, ChipsProvider as Xe, CommandProvider as Ge } from "chips-resource://platform/vendor/chips-ui.js";
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
function We(e) {
  if (typeof e != "object" || e === null)
    return !1;
  const t = e;
  return typeof t.code == "string" && t.code.length > 0 && typeof t.message == "string" && (t.retryable === void 0 || typeof t.retryable == "boolean");
}
const je = "SDK_BRIDGE_UNAVAILABLE", de = "SDK_UNKNOWN_ERROR", pe = "发生未知错误";
function qe(e) {
  return e instanceof Error;
}
function Ye(e) {
  if (e instanceof D)
    return e;
  if (We(e)) {
    const t = e, n = {
      code: t.code,
      message: t.message,
      retryable: t.retryable ?? !1,
      ...t.details !== void 0 ? { details: t.details } : {}
    };
    return new D(n);
  }
  return qe(e) ? new D({
    code: de,
    message: pe,
    details: { name: e.name, cause: e.message },
    retryable: !1
  }) : new D({
    code: de,
    message: pe,
    details: { value: String(e) },
    retryable: !1
  });
}
function Je() {
  return new D({
    code: je,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function x(e, t, n) {
  let r;
  try {
    r = e();
  } catch (i) {
    return Promise.reject(Ye(i));
  }
  return r.request(t, n);
}
const Qe = "cli.command.list", Ze = "cli.command.get", et = "cli.command.resolve";
function tt(e) {
  return {
    list(t) {
      return x(e, Qe, t ?? {});
    },
    get(t) {
      return x(e, Ze, t);
    },
    resolve(t) {
      return x(e, et, t);
    }
  };
}
const X = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, nt = "cli.task.create", rt = "cli.task.bindInvocation", it = "cli.task.cancel";
function at(e) {
  return {
    create(t) {
      return x(e, nt, t).then((n) => n.task);
    },
    bindInvocation(t) {
      return x(e, rt, t).then((n) => n.task);
    },
    get(t) {
      const n = { taskId: t };
      return x(e, X.CLI_TASK_GET, n).then((r) => r.task);
    },
    active(t) {
      const n = { commandId: t };
      return x(e, X.CLI_TASK_ACTIVE, n).then((r) => r.task);
    },
    progress(t, n) {
      const r = { taskId: t, progress: n };
      return x(e, X.CLI_TASK_PROGRESS, r).then((i) => i.task);
    },
    complete(t, n) {
      const r = {
        taskId: t,
        ...n === void 0 ? {} : { output: n }
      };
      return x(e, X.CLI_TASK_COMPLETE, r).then((i) => i.task);
    },
    fail(t, n) {
      const r = { taskId: t, error: n };
      return x(e, X.CLI_TASK_FAIL, r).then((i) => i.task);
    },
    cancel(t) {
      return x(e, it, { taskId: t }).then((n) => n.task);
    }
  };
}
function st() {
  return globalThis.window?.chips;
}
class lt {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = tt(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = at(() => this.#e());
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
    const t = st();
    if (t === void 0)
      throw Je();
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
    return x(() => this.#e(), t, n);
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
function ot(e) {
  return new lt(e?.bridge);
}
const fe = ot(), M = "chips.official.video-player", P = {
  openCard: "video-player:open-card",
  refreshView: "video-player:refresh-view",
  togglePlayback: "video-player:toggle-playback",
  seekForward: "video-player:seek-forward",
  seekBackward: "video-player:seek-backward",
  toggleMute: "video-player:toggle-mute",
  cyclePlaybackRate: "video-player:cycle-playback-rate",
  toggleLoop: "video-player:toggle-loop",
  toggleFullscreen: "video-player:toggle-fullscreen",
  togglePictureInPicture: "video-player:toggle-picture-in-picture"
}, v = {
  openCard: "open-card",
  refreshView: "refresh-view",
  togglePlayback: "toggle-playback",
  seekForward: "seek-forward",
  seekBackward: "seek-backward",
  toggleMute: "toggle-mute",
  cyclePlaybackRate: "cycle-playback-rate",
  toggleLoop: "toggle-loop",
  toggleFullscreen: "toggle-fullscreen",
  togglePictureInPicture: "toggle-picture-in-picture"
}, ie = [
  {
    id: P.openCard,
    title: "打开卡片",
    description: "通过「视频播放器」打开指定卡片文件",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: M },
    handlerId: v.openCard,
    keywords: ["open", "card", "打开", "卡片", "视频"],
    group: "文件"
  },
  {
    id: P.refreshView,
    title: "刷新当前视图",
    description: "请求「视频播放器」重新拉取当前展示数据",
    shortcut: "F5",
    scope: { kind: "app", appId: M },
    handlerId: v.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  },
  {
    id: P.togglePlayback,
    title: "播放或暂停",
    description: "切换当前视频的播放状态（空格 / K）",
    scope: { kind: "app", appId: M },
    handlerId: v.togglePlayback,
    keywords: ["play", "pause", "播放", "暂停"],
    group: "播放控制"
  },
  {
    id: P.seekForward,
    title: "前进 5 秒",
    description: "当前视频快进 5 秒（→，Shift+→ 快进 30 秒）",
    scope: { kind: "app", appId: M },
    handlerId: v.seekForward,
    keywords: ["seek", "forward", "快进", "前进"],
    group: "播放控制"
  },
  {
    id: P.seekBackward,
    title: "后退 5 秒",
    description: "当前视频快退 5 秒（←，Shift+← 快退 30 秒）",
    scope: { kind: "app", appId: M },
    handlerId: v.seekBackward,
    keywords: ["seek", "backward", "快退", "后退"],
    group: "播放控制"
  },
  {
    id: P.toggleMute,
    title: "静音或取消静音",
    description: "切换当前视频的静音状态（M）",
    scope: { kind: "app", appId: M },
    handlerId: v.toggleMute,
    keywords: ["mute", "静音", "音量"],
    group: "播放控制"
  },
  {
    id: P.cyclePlaybackRate,
    title: "切换倍速",
    description: "在 0.5x 至 2x 的倍速序列中循环切换",
    scope: { kind: "app", appId: M },
    handlerId: v.cyclePlaybackRate,
    keywords: ["rate", "speed", "倍速", "速度"],
    group: "播放控制"
  },
  {
    id: P.toggleLoop,
    title: "循环播放",
    description: "开启或关闭当前视频的循环播放",
    scope: { kind: "app", appId: M },
    handlerId: v.toggleLoop,
    keywords: ["loop", "循环", "重复"],
    group: "播放控制"
  },
  {
    id: P.toggleFullscreen,
    title: "切换全屏",
    description: "进入或退出视频全屏模式（F）",
    scope: { kind: "app", appId: M },
    handlerId: v.toggleFullscreen,
    keywords: ["fullscreen", "全屏"],
    group: "画面"
  },
  {
    id: P.togglePictureInPicture,
    title: "切换画中画",
    description: "进入或退出视频画中画模式（P）",
    scope: { kind: "app", appId: M },
    handlerId: v.togglePictureInPicture,
    keywords: ["picture", "pip", "画中画"],
    group: "画面"
  }
];
new Set(Object.values(P));
function ct(e, t) {
  return ie.map((n) => {
    const r = n.handlerId ?? "";
    return {
      commandId: n.id,
      handlerId: r,
      handler: (i) => {
        e()[ut(r)]?.(i), t({ commandId: n.id, handlerId: r, payload: i });
      }
    };
  });
}
function ut(e) {
  switch (e) {
    case v.openCard:
      return "openCard";
    case v.refreshView:
      return "refreshView";
    case v.togglePlayback:
      return "togglePlayback";
    case v.seekForward:
      return "seekForward";
    case v.seekBackward:
      return "seekBackward";
    case v.toggleMute:
      return "toggleMute";
    case v.cyclePlaybackRate:
      return "cyclePlaybackRate";
    case v.toggleLoop:
      return "toggleLoop";
    case v.toggleFullscreen:
      return "toggleFullscreen";
    case v.togglePictureInPicture:
      return "togglePictureInPicture";
    default:
      return "togglePlayback";
  }
}
const dt = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function ge(e) {
  if (typeof e == "object" && e !== null && "code" in e) {
    const t = e.code;
    if (typeof t == "string" && t.length > 0)
      return t;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function pt(e) {
  const t = Se(), [n, r] = R("registering"), [i, p] = R(null), [u, c] = R(null), o = w.useRef(e ?? {});
  o.current = e ?? {}, _(() => {
    let f = !1, d = null;
    return r("registering"), p(null), (async () => {
      try {
        for (const a of ie)
          await fe.request("command:register", { definition: a });
        if (f)
          return;
        d = t.attach(ct(() => o.current, c)), r("ready");
      } catch (a) {
        f || (p(ge(a)), r("error"));
      }
    })(), () => {
      f = !0, d?.dispose();
      for (const a of ie)
        fe.request("command:unregister", { commandId: a.id }).catch(() => {
        });
    };
  }, [t]);
  const m = y(
    async (f, d) => {
      try {
        d === void 0 ? await t.invoke({ commandId: f, source: "api" }) : await t.invoke({ commandId: f, payload: d, source: "api" }), p(null);
      } catch (a) {
        p(ge(a));
      }
    },
    [t]
  );
  return {
    phase: n,
    errorCode: i,
    lastInvoked: u,
    invokeOpenCard: (f) => m(P.openCard, { path: f }),
    invokeRefreshView: () => m(P.refreshView),
    invokeTogglePlayback: () => m(P.togglePlayback)
  };
}
const ft = [".mp4", ".webm", ".mov", ".m4v", ".ogv"], ae = ft.join(" "), O = [0.5, 0.75, 1, 1.25, 1.5, 2], gt = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".ogv": "video/ogg"
};
function oe(e) {
  const t = e.trim().toLowerCase(), n = Math.max(t.lastIndexOf("/"), t.lastIndexOf("\\")), r = t.lastIndexOf(".");
  return r <= n ? "" : t.slice(r);
}
function ve(e) {
  const t = e.trim();
  if (!t)
    return "";
  try {
    const i = new URL(t).pathname.trim();
    if (i) {
      const p = i.split("/").filter(Boolean);
      return p[p.length - 1] ?? i;
    }
  } catch {
  }
  const n = t.split(/[\\/]/).filter((r) => r.length > 0);
  return n[n.length - 1] ?? t;
}
function mt(e) {
  return e.title?.trim() || e.fileName?.trim() || ve(e.filePath ?? e.sourceId) || e.sourceId;
}
function yt(e) {
  const t = oe(e);
  return gt[t];
}
function ht(e, t) {
  const n = oe(e);
  if (n)
    return n.slice(1).toUpperCase();
  const r = t?.trim().toLowerCase();
  return r ? (r.split("/")[1] ?? r).replace(/^x-/, "").toUpperCase() : "";
}
function Te(e) {
  const t = e.trim();
  if (!t)
    return !1;
  try {
    const n = new URL(t);
    return ["file:", "http:", "https:", "blob:", "data:"].includes(n.protocol);
  } catch {
    return !1;
  }
}
function kt(e) {
  try {
    return decodeURIComponent(e);
  } catch {
    return e;
  }
}
function bt(e) {
  const t = e.trim();
  if (!Te(t))
    return null;
  const n = kt(ve(t)), r = oe(n), i = yt(n);
  return {
    sourceId: t,
    fileName: n,
    title: mt({ sourceId: t, fileName: n }),
    resourceUri: t,
    ...i !== void 0 ? { mimeType: i } : {},
    ...r !== "" ? { extension: r } : {},
    revision: 1,
    isRemote: t.startsWith("http://") || t.startsWith("https://")
  };
}
function me(e) {
  return Number.isFinite(e) ? Math.min(1, Math.max(0, e)) : 0.85;
}
function se(e, t) {
  return Number.isFinite(e) ? !Number.isFinite(t) || t <= 0 ? Math.max(0, e) : Math.min(t, Math.max(0, e)) : 0;
}
function z(e) {
  if (!Number.isFinite(e) || e <= 0)
    return "00:00";
  const t = Math.floor(e), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = t % 60;
  return n > 0 ? `${String(n).padStart(2, "0")}:${String(r).padStart(2, "0")}:${String(i).padStart(2, "0")}` : `${String(r).padStart(2, "0")}:${String(i).padStart(2, "0")}`;
}
function le(e) {
  const t = Number.isFinite(e) ? e : 1;
  return `${t.toFixed(t % 1 === 0 ? 0 : 2).replace(/0+$/, "").replace(/\.$/, "")}x`;
}
function vt(e) {
  return !e || e.width <= 0 || e.height <= 0 ? "" : `${e.width} × ${e.height}`;
}
function ye(e) {
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
const F = {
  volume: 0.85,
  muted: !1,
  playbackRate: 1,
  subtitleIndex: null,
  loop: !1
};
function Tt(e, t) {
  return typeof e == "number" && Number.isFinite(e) ? e : t;
}
function he(e, t) {
  return typeof e == "boolean" ? e : t;
}
function Pt() {
  let e = { ...F };
  const t = (n) => {
    const r = { ...e, ...n };
    return {
      volume: Math.min(1, Math.max(0, Tt(r.volume, e.volume))),
      muted: he(r.muted, e.muted),
      playbackRate: O.includes(r.playbackRate) ? r.playbackRate : e.playbackRate,
      subtitleIndex: typeof r.subtitleIndex == "number" && Number.isInteger(r.subtitleIndex) ? r.subtitleIndex : e.subtitleIndex,
      loop: he(r.loop, e.loop)
    };
  };
  return e = t({}), {
    read: () => ({ ...e }),
    write: (n) => {
      e = t(n);
    }
  };
}
const St = Pt();
function Et() {
  return St;
}
function ke(e, t) {
  const n = t?.playbackRate ?? F.playbackRate;
  return {
    isReady: !1,
    isPlaying: !1,
    isBuffering: !1,
    isMuted: e?.muted === !0 ? !0 : t?.muted ?? F.muted,
    volume: e?.muted ? 0 : t?.volume ?? F.volume,
    playbackRate: O.includes(e?.playbackRate ?? -1) ? e?.playbackRate ?? 1 : O.includes(n) ? n : 1,
    duration: 0,
    currentTime: 0,
    bufferedUntil: 0,
    videoSize: null,
    errorKey: null,
    isEnded: !1,
    loop: e?.loop === !0 ? !0 : t?.loop ?? F.loop
  };
}
const It = 250;
function xt(e) {
  const { sessionKey: t, hints: n, preferences: r, videoRef: i } = e, [p, u] = R(() => ke(n, r)), c = W({ currentTime: 0, bufferedUntil: 0 }), o = W(null), m = y(() => {
    o.current = null, u((l) => {
      const g = c.current;
      return Math.abs(l.currentTime - g.currentTime) < 0.25 && Math.abs(l.bufferedUntil - g.bufferedUntil) < 0.5 ? l : { ...l, currentTime: g.currentTime, bufferedUntil: g.bufferedUntil };
    });
  }, []), f = y(() => {
    o.current === null && (o.current = window.setTimeout(m, It));
  }, [m]);
  _(() => () => {
    o.current !== null && (window.clearTimeout(o.current), o.current = null);
  }, []), _(() => {
    const l = i.current;
    if (!l)
      return;
    const g = n?.muted ? 0 : r?.volume ?? F.volume, k = O.includes(n?.playbackRate ?? -1) ? n?.playbackRate ?? 1 : O.includes(r?.playbackRate ?? -1) ? r?.playbackRate ?? 1 : 1;
    l.volume = g, l.playbackRate = k, l.muted = n?.muted === !0 ? !0 : r?.muted ?? F.muted, l.loop = n?.loop === !0 ? !0 : r?.loop ?? F.loop, n && n.startTime > 0 && (l.currentTime = n.startTime), c.current = {
      currentTime: Number.isFinite(l.currentTime) ? l.currentTime : 0,
      bufferedUntil: 0
    }, u((L) => ({
      ...L,
      isMuted: l.muted,
      volume: g,
      playbackRate: k,
      currentTime: c.current.currentTime
    })), n?.autoplay && l.play().catch(() => {
    });
  }, [n, t, i]), _(() => {
    const l = i.current;
    l && l.pause(), c.current = { currentTime: 0, bufferedUntil: 0 }, u(ke(n, r));
  }, [n, t, i]);
  const d = y(async () => {
    const l = i.current;
    if (l) {
      if (l.paused) {
        u((g) => ({ ...g, errorKey: null, isEnded: !1 }));
        try {
          await l.play();
        } catch {
          u((g) => ({ ...g, errorKey: ye(l.error) }));
        }
        return;
      }
      l.pause();
    }
  }, [i]), a = y(
    (l) => {
      const g = i.current;
      if (!g)
        return;
      const k = se(l, g.duration);
      g.currentTime = k, c.current = {
        currentTime: k,
        bufferedUntil: c.current.bufferedUntil
      }, u((L) => ({
        ...L,
        currentTime: k,
        duration: Number.isFinite(g.duration) ? g.duration : L.duration,
        isEnded: !1
      }));
    },
    [i]
  ), T = y(
    (l) => {
      const g = i.current;
      if (!g)
        return;
      const k = se(l, g.duration);
      c.current = { ...c.current, currentTime: k }, u((L) => ({ ...L, currentTime: k }));
    },
    [i]
  ), U = y(
    (l) => {
      const g = i.current;
      g && a(g.currentTime + l);
    },
    [a, i]
  ), C = y(
    (l) => {
      const g = i.current;
      if (!g)
        return;
      const k = me(l);
      g.volume = k, g.muted = k === 0, u((L) => ({ ...L, volume: k, isMuted: g.muted }));
    },
    [i]
  ), j = y(() => {
    const l = i.current;
    l && (l.muted = !l.muted, u((g) => ({ ...g, isMuted: l.muted })));
  }, [i]), q = y(
    (l) => {
      const g = i.current, k = O.includes(l) ? l : 1;
      g && (g.playbackRate = k), u((L) => ({ ...L, playbackRate: k }));
    },
    [i]
  ), B = y(() => {
    const l = i.current;
    u((g) => {
      const k = !g.loop;
      return l && (l.loop = k), { ...g, loop: k };
    });
  }, [i]), K = y(
    (l) => {
      const g = l.currentTarget;
      u((k) => ({
        ...k,
        videoSize: { width: g.videoWidth, height: g.videoHeight },
        duration: Number.isFinite(g.duration) ? g.duration : k.duration,
        currentTime: Number.isFinite(g.currentTime) ? g.currentTime : k.currentTime
      })), e.onTracksChanged?.();
    },
    [e]
  ), V = y(() => {
    u((l) => ({ ...l, isReady: !0, isBuffering: !1, errorKey: null })), e.onTracksChanged?.();
  }, [e]), Y = y(() => {
    u((l) => ({
      ...l,
      isReady: !0,
      isPlaying: !0,
      isBuffering: !1,
      errorKey: null,
      isEnded: !1
    }));
  }, []), J = y(() => {
    u((l) => ({ ...l, isPlaying: !1, isBuffering: !1 }));
  }, []), $ = y(() => {
    u((l) => ({ ...l, isBuffering: !0 }));
  }, []), H = y(() => {
    u((l) => ({ ...l, isPlaying: !1, isBuffering: !1, isEnded: !0 }));
  }, []), Q = y(() => {
    const l = i.current;
    l && (c.current = {
      currentTime: Number.isFinite(l.currentTime) ? l.currentTime : 0,
      bufferedUntil: c.current.bufferedUntil
    }, Number.isFinite(l.duration) && l.duration !== p.duration && u((g) => ({ ...g, duration: l.duration })), f());
  }, [f, p.duration, i]), ee = y(() => {
    const l = i.current;
    l && u((g) => ({ ...g, duration: Number.isFinite(l.duration) ? l.duration : 0 }));
  }, [i]), Z = y(() => {
    const l = i.current;
    if (!l || l.buffered.length === 0) {
      c.current = { ...c.current, bufferedUntil: 0 }, f();
      return;
    }
    c.current = {
      ...c.current,
      bufferedUntil: l.buffered.end(l.buffered.length - 1)
    }, f();
  }, [f, i]), h = y(() => {
    const l = i.current;
    l && u((g) => ({ ...g, volume: me(l.volume), isMuted: l.muted }));
  }, [i]), I = y(() => {
    const l = i.current;
    u((g) => ({
      ...g,
      isReady: !1,
      isPlaying: !1,
      isBuffering: !1,
      errorKey: ye(l?.error ?? null)
    }));
  }, [i]);
  return {
    state: p,
    togglePlayback: d,
    seekPreviewTo: T,
    commitSeek: a,
    seekBy: U,
    setVolumeLevel: C,
    toggleMute: j,
    setPlaybackRate: q,
    toggleLoop: B,
    handleLoadedMetadata: K,
    handleCanPlay: V,
    handlePlaying: Y,
    handlePause: J,
    handleWaiting: $,
    handleEnded: H,
    handleTimeUpdate: Q,
    handleDurationChange: ee,
    handleProgress: Z,
    handleVolumeChange: h,
    handleError: I
  };
}
function Pe(e) {
  return e.kind === "subtitles" || e.kind === "captions";
}
function Ct(e) {
  const { textTracks: t } = e, n = [];
  for (let r = 0; r < t.length; r += 1) {
    const i = t[r];
    !i || !Pe(i) || n.push({
      index: r,
      label: i.label?.trim() ?? "",
      language: i.language?.trim() ?? "",
      kind: i.kind?.trim() ?? "",
      selected: i.mode === "showing"
    });
  }
  return n;
}
function wt(e) {
  const t = e.audioTracks;
  if (!t)
    return [];
  const n = [];
  for (let r = 0; r < t.length; r += 1) {
    const i = t[r];
    i && n.push({
      index: r,
      label: i.label?.trim() ?? "",
      language: i.language?.trim() ?? "",
      kind: i.kind?.trim() ?? "",
      selected: i.enabled === !0
    });
  }
  return n;
}
function Rt(e) {
  const { videoRef: t, sessionKey: n } = e, [r, i] = R([]), [p, u] = R([]), c = y(() => {
    const f = t.current;
    if (!f) {
      i([]), u([]);
      return;
    }
    i(Ct(f)), u(wt(f));
  }, [t]), o = y(
    (f) => {
      const d = t.current;
      if (d) {
        for (let a = 0; a < d.textTracks.length; a += 1) {
          const T = d.textTracks[a];
          !T || !Pe(T) || (T.mode = f === a ? "showing" : "disabled");
        }
        c();
      }
    },
    [c, t]
  ), m = y(
    (f) => {
      const d = t.current, a = d?.audioTracks;
      if (!(!d || !a)) {
        for (let T = 0; T < a.length; T += 1) {
          const U = a[T];
          U && (U.enabled = f === null ? T === 0 : T === f);
        }
        c();
      }
    },
    [c, t]
  );
  return _(() => {
    const f = t.current;
    if (!f)
      return;
    const d = () => {
      c();
    };
    f.textTracks.addEventListener?.("addtrack", d), f.textTracks.addEventListener?.("removetrack", d), f.textTracks.addEventListener?.("change", d);
    const a = f.audioTracks;
    return a?.addEventListener?.("addtrack", d), a?.addEventListener?.("removetrack", d), a?.addEventListener?.("change", d), c(), () => {
      f.textTracks.removeEventListener?.("addtrack", d), f.textTracks.removeEventListener?.("removetrack", d), f.textTracks.removeEventListener?.("change", d), a?.removeEventListener?.("addtrack", d), a?.removeEventListener?.("removetrack", d), a?.removeEventListener?.("change", d);
    };
  }, [n, c, t]), {
    subtitleTracks: r,
    audioTracks: p,
    selectSubtitleTrack: o,
    selectAudioTrack: m,
    refresh: c
  };
}
function Lt(e, t) {
  return !!(t && e === t);
}
function Mt(e) {
  const { surfaceRef: t, videoRef: n, sessionKey: r } = e, [i, p] = R(!1), [u, c] = R(!1), o = typeof document < "u" && document.pictureInPictureEnabled === !0, m = y(async () => {
    if (typeof document > "u")
      return;
    const d = t.current;
    if (!(!d || typeof d.requestFullscreen != "function")) {
      if (document.fullscreenElement === d) {
        typeof document.exitFullscreen == "function" && await document.exitFullscreen();
        return;
      }
      await d.requestFullscreen();
    }
  }, [t]), f = y(async () => {
    if (typeof document > "u" || !o)
      return;
    const d = document, a = n.current;
    if (!(!a || typeof a.requestPictureInPicture != "function")) {
      if (d.pictureInPictureElement === a) {
        await d.exitPictureInPicture?.();
        return;
      }
      await a.requestPictureInPicture();
    }
  }, [o, n]);
  return _(() => {
    if (typeof document > "u")
      return;
    const d = () => {
      const a = t.current;
      p(Lt(document.fullscreenElement, a));
    };
    return document.addEventListener("fullscreenchange", d), () => {
      document.removeEventListener("fullscreenchange", d);
    };
  }, [t]), _(() => {
    const d = n.current;
    if (!d)
      return;
    const a = () => {
      c(!0);
    }, T = () => {
      c(!1);
    };
    return d.addEventListener("enterpictureinpicture", a), d.addEventListener("leavepictureinpicture", T), () => {
      d.removeEventListener("enterpictureinpicture", a), d.removeEventListener("leavepictureinpicture", T);
    };
  }, [r, n]), {
    isFullscreen: i,
    isPictureInPicture: u,
    canUsePictureInPicture: o,
    toggleFullscreen: m,
    togglePictureInPicture: f
  };
}
function _t(e) {
  return e.hasVideo && e.isPlaying && !e.isMorePanelOpen && !e.isDragActive && !e.hasOverlay;
}
const At = 2200;
function Ft(e) {
  const { state: t, autoHideDelayMs: n = At } = e, [r, i] = R(!0), p = W(null), u = _t(t), c = y(() => {
    p.current !== null && (window.clearTimeout(p.current), p.current = null);
  }, []), o = y(
    (d) => {
      u && (c(), p.current = window.setTimeout(() => {
        p.current = null, i(!1);
      }, d ?? n));
    },
    [n, c, u]
  ), m = y(() => {
    i(!0), o();
  }, [o]), f = y(() => {
    c(), i((d) => {
      const a = !d;
      return a && o(), a;
    });
  }, [c, o]);
  return _(() => {
    if (!u) {
      c(), i(!0);
      return;
    }
    o();
  }, [c, o, u]), _(() => () => {
    c();
  }, [c]), { visible: r, reveal: m, toggle: f, scheduleHide: o };
}
function Dt(e) {
  return e instanceof HTMLElement ? e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement || e instanceof HTMLSelectElement ? !0 : e.isContentEditable === !0 : !1;
}
function Ot(e) {
  return { handleKeyDown: y(
    (n) => {
      const r = n.target;
      if (r && (r.closest("input, textarea, select") || Dt(r)))
        return;
      const i = n.shiftKey;
      switch (n.key) {
        case " ":
        case "k":
        case "K":
          n.preventDefault(), e.togglePlayback();
          break;
        case "ArrowLeft":
          n.preventDefault(), i ? e.seekBy(-30) : e.seekBy(-5);
          break;
        case "ArrowRight":
          n.preventDefault(), i ? e.seekBy(30) : e.seekBy(5);
          break;
        case "ArrowUp":
          n.preventDefault(), e.adjustVolume(0.05);
          break;
        case "ArrowDown":
          n.preventDefault(), e.adjustVolume(-0.05);
          break;
        case "j":
        case "J":
          n.preventDefault(), e.seekBy(-10);
          break;
        case "l":
        case "L":
          n.preventDefault(), e.seekBy(10);
          break;
        case "f":
        case "F":
          n.preventDefault(), e.toggleFullscreen();
          break;
        case "p":
        case "P":
          n.preventDefault(), e.togglePictureInPicture();
          break;
        case "m":
        case "M":
          n.preventDefault(), e.toggleMute();
          break;
        case "?":
          n.preventDefault(), e.openKeyHelp();
          break;
        case "Home":
          n.preventDefault(), e.seekToFraction(0);
          break;
        case "End":
          n.preventDefault(), e.seekToFraction(1);
          break;
        case "[":
          n.preventDefault(), e.frameStep("backward");
          break;
        case "]":
          n.preventDefault(), e.frameStep("forward");
          break;
        default:
          n.key >= "0" && n.key <= "9" && (n.preventDefault(), e.seekToFraction(Number(n.key) / 10));
          break;
      }
    },
    [e]
  ) };
}
const re = [0.5, 0.75, 1, 1.25, 1.5, 2];
function Nt(e) {
  const { source: t, onOpenKeyHelp: n } = e, r = W(null), i = W(null), p = e.preferenceStore ?? Et(), u = t ? `${t.sourceId}#${t.revision}` : null, c = te(
    () => t ? p.read() : void 0,
    [p, t]
  ), o = xt({
    sessionKey: u,
    ...t?.playbackHints !== void 0 ? { hints: t.playbackHints } : {},
    ...c !== void 0 ? { preferences: c } : {},
    videoRef: i
  }), m = Rt({ videoRef: i, sessionKey: u }), f = Mt({ surfaceRef: r, videoRef: i, sessionKey: u }), [d, a] = R(!1), [T, U] = R(!1), C = Ft({
    state: {
      hasVideo: u !== null,
      isPlaying: o.state.isPlaying,
      isMorePanelOpen: d,
      isDragActive: !1,
      hasOverlay: T || d
    }
  }), j = y((h) => {
    a(h);
  }, []), q = y((h) => {
    U(h);
  }, []), B = y(
    (h) => {
      o.setVolumeLevel(h), p.write({ volume: h, muted: h === 0 });
    },
    [o, p]
  ), K = y(() => {
    o.toggleMute(), p.write({ muted: !o.state.isMuted });
  }, [o, p]), V = y(
    (h) => {
      o.setPlaybackRate(h), p.write({ playbackRate: h });
    },
    [o, p]
  ), Y = y(() => {
    o.toggleLoop(), p.write({ loop: !o.state.loop });
  }, [o, p]), J = y(
    (h) => {
      m.selectSubtitleTrack(h), p.write({ subtitleIndex: h });
    },
    [p, m]
  ), $ = y(
    (h) => {
      const I = i.current;
      if (!I)
        return;
      const l = Number.isFinite(I.duration) ? I.duration : 0;
      l <= 0 || o.commitSeek(l * Math.min(1, Math.max(0, h)));
    },
    [o]
  ), H = y(
    (h) => {
      const I = i.current;
      if (!I)
        return;
      I.paused || I.pause();
      const l = 1 / 24;
      o.commitSeek(I.currentTime + (h === "backward" ? -l : l));
    },
    [o]
  ), Q = y(() => {
    const h = re.indexOf(o.state.playbackRate), I = re[(h + 1) % re.length] ?? 1;
    V(I);
  }, [V, o.state.playbackRate]), ee = te(
    () => ({
      togglePlayback: o.togglePlayback,
      seekBy: o.seekBy,
      seekToFraction: $,
      adjustVolume: B,
      toggleMute: K,
      toggleFullscreen: f.toggleFullscreen,
      togglePictureInPicture: f.togglePictureInPicture,
      openKeyHelp: n ?? (() => {
      }),
      toggleChrome: C.toggle,
      frameStep: H
    }),
    [
      C.toggle,
      H,
      f.toggleFullscreen,
      f.togglePictureInPicture,
      n,
      K,
      B,
      o.seekBy,
      o.togglePlayback,
      $
    ]
  ), { handleKeyDown: Z } = Ot(ee);
  return te(() => {
    const h = o.state;
    return {
      surfaceRef: r,
      videoRef: i,
      source: t,
      sessionKey: u,
      isReady: h.isReady,
      isPlaying: h.isPlaying,
      isBuffering: h.isBuffering,
      isMuted: h.isMuted,
      volume: h.volume,
      playbackRate: h.playbackRate,
      duration: h.duration,
      currentTime: h.currentTime,
      bufferedUntil: h.bufferedUntil,
      isFullscreen: f.isFullscreen,
      isPictureInPicture: f.isPictureInPicture,
      canUsePictureInPicture: f.canUsePictureInPicture,
      videoSize: h.videoSize,
      errorKey: h.errorKey,
      subtitleTracks: m.subtitleTracks,
      audioTracks: m.audioTracks,
      isEnded: h.isEnded,
      chromeVisible: C.visible,
      loop: h.loop,
      toggleLoop: Y,
      togglePlayback: o.togglePlayback,
      seekBy: o.seekBy,
      seekPreviewTo: o.seekPreviewTo,
      commitSeek: o.commitSeek,
      seekToFraction: $,
      setVolumeLevel: B,
      toggleMute: K,
      setPlaybackRate: V,
      cyclePlaybackRate: Q,
      selectSubtitleTrack: J,
      selectAudioTrack: m.selectAudioTrack,
      toggleFullscreen: f.toggleFullscreen,
      togglePictureInPicture: f.togglePictureInPicture,
      toggleChrome: C.toggle,
      revealChrome: C.reveal,
      scheduleChromeHide: C.scheduleHide,
      setMorePanelOpen: j,
      setOverlayActive: q,
      frameStep: H,
      handleKeyDown: Z,
      handleLoadedMetadata: o.handleLoadedMetadata,
      handleCanPlay: o.handleCanPlay,
      handlePlaying: o.handlePlaying,
      handlePause: o.handlePause,
      handleWaiting: o.handleWaiting,
      handleEnded: o.handleEnded,
      handleTimeUpdate: o.handleTimeUpdate,
      handleDurationChange: o.handleDurationChange,
      handleProgress: o.handleProgress,
      handleVolumeChange: o.handleVolumeChange,
      handleError: o.handleError
    };
  }, [
    C.scheduleHide,
    C.toggle,
    C.visible,
    Q,
    f,
    H,
    Z,
    V,
    J,
    Y,
    K,
    B,
    o,
    $,
    u,
    j,
    q,
    t,
    m
  ]);
}
function Ut(e) {
  const t = e.trim();
  if (!t)
    return { error: "请输入视频地址。" };
  if (!Te(t))
    return { error: "暂不支持该地址形式：请使用 file://、http(s)://、blob: 或 data: 地址。" };
  const n = bt(t);
  if (!n)
    return { error: "无法识别的视频地址。" };
  const r = n.extension ?? "";
  return !n.isRemote && r && !ae.split(" ").includes(r) ? { error: `暂不支持 .${r.slice(1)} 格式，支持：${ae}` } : { source: n };
}
const Bt = ({ onOpen: e }) => {
  const { token: t } = N.useToken(), [n, r] = w.useState(""), [i, p] = w.useState(null), u = () => {
    const c = Ut(n);
    if (c.error !== void 0 || c.source === void 0) {
      p(c.error ?? "无法识别的视频地址。");
      return;
    }
    p(null), e(c.source);
  };
  return /* @__PURE__ */ b(
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
        /* @__PURE__ */ s(E.Title, { level: 4, style: { margin: 0 }, children: "打开视频" }),
        /* @__PURE__ */ s(E.Text, { type: "secondary", children: "粘贴可直接播放的视频地址开始会话；也支持拖入文件与资源路由投递（随宿主资源通道落波）。" }),
        /* @__PURE__ */ b("div", { style: { display: "flex", width: "min(560px, 100%)", gap: t.marginXS }, children: [
          /* @__PURE__ */ s(
            Ee,
            {
              value: n,
              placeholder: "视频地址（file://、https://、blob:）",
              "aria-label": "视频地址",
              onChange: (c) => {
                r(c.target.value), i !== null && p(null);
              },
              onPressEnter: u,
              allowClear: !0
            }
          ),
          /* @__PURE__ */ s(S, { type: "primary", "aria-label": "打开", onClick: u, children: "打开" })
        ] }),
        i === null ? null : /* @__PURE__ */ s(E.Text, { type: "danger", role: "alert", children: i }),
        /* @__PURE__ */ b(E.Text, { type: "secondary", children: [
          "支持格式：",
          ae
        ] }),
        /* @__PURE__ */ s(E.Text, { type: "secondary", children: "快捷键：空格播放或暂停，←→ 跳转，↑↓ 音量，F 全屏，M 静音，? 查看全部键位" })
      ]
    }
  );
};
function Kt(e, t) {
  const n = e.label || `${t} ${e.index + 1}`;
  return e.language ? `${n}（${e.language}）` : n;
}
const be = ({ tracks: e, offLabel: t, fallbackPrefix: n, selectedKey: r, onSelect: i }) => {
  const { token: p } = N.useToken(), u = [{ key: "off", label: t, selected: r === "off" }].concat(
    e.map((c) => ({
      key: String(c.index),
      label: Kt(c, n),
      selected: r === String(c.index)
    }))
  );
  return /* @__PURE__ */ s("div", { role: "listbox", "aria-label": n, children: u.map((c) => /* @__PURE__ */ b(
    "button",
    {
      type: "button",
      role: "option",
      "aria-selected": c.selected,
      onClick: () => i(c.key),
      style: {
        display: "flex",
        alignItems: "center",
        gap: p.marginXS,
        width: "100%",
        padding: `${p.paddingXXS}px ${p.paddingXS}px`,
        border: "none",
        borderRadius: p.borderRadius,
        background: c.selected ? p.colorPrimaryBg : "transparent",
        color: p.colorText,
        cursor: "pointer",
        textAlign: "left",
        fontSize: p.fontSize
      },
      children: [
        /* @__PURE__ */ s("span", { style: { width: 16 }, children: c.selected ? /* @__PURE__ */ s(G, { "aria-hidden": "true" }) : null }),
        c.label
      ]
    },
    c.key
  )) });
}, Vt = ({ controller: e }) => {
  const { token: t } = N.useToken(), n = e.source, r = e.duration > 0 ? `${Math.round(e.bufferedUntil / e.duration * 100)}%` : "0%", i = e.subtitleTracks.find((m) => m.selected) !== void 0 ? String(e.subtitleTracks.find((m) => m.selected)?.index) : "off", p = e.audioTracks.find((m) => m.selected) !== void 0 ? String(e.audioTracks.find((m) => m.selected)?.index) : "off", u = n ? /* @__PURE__ */ s(
    Ie,
    {
      size: "small",
      column: 1,
      items: [
        { key: "title", label: "标题", children: n.title },
        {
          key: "format",
          label: "格式",
          children: ht(n.resourceUri, n.mimeType) || "未知"
        },
        {
          key: "resolution",
          label: "分辨率",
          children: vt(e.videoSize) || "分辨率未知"
        },
        {
          key: "duration",
          label: "总时长",
          children: e.duration > 0 ? z(e.duration) : "时长未知"
        },
        { key: "position", label: "当前位置", children: z(e.currentTime) },
        { key: "rate", label: "播放速度", children: le(e.playbackRate) },
        { key: "volume", label: "音量", children: `${Math.round(e.volume * 100)}%` },
        { key: "buffered", label: "已缓冲", children: r },
        { key: "loop", label: "循环播放", children: e.loop ? "开" : "关" },
        { key: "uri", label: "来源地址", children: n.resourceUri }
      ]
    }
  ) : /* @__PURE__ */ s(ce, { description: "尚未打开视频", image: ce.PRESENTED_IMAGE_SIMPLE }), c = e.subtitleTracks.length === 0 ? /* @__PURE__ */ s(E.Text, { type: "secondary", children: "当前视频没有可切换的字幕轨道。" }) : /* @__PURE__ */ s(
    be,
    {
      tracks: e.subtitleTracks,
      offLabel: "关闭字幕",
      fallbackPrefix: "字幕轨",
      selectedKey: i,
      onSelect: (m) => e.selectSubtitleTrack(m === "off" ? null : Number(m))
    }
  ), o = e.audioTracks.length === 0 ? /* @__PURE__ */ s(E.Text, { type: "secondary", children: "当前视频没有可切换的音频轨道。" }) : /* @__PURE__ */ s(
    be,
    {
      tracks: e.audioTracks,
      offLabel: "默认音轨",
      fallbackPrefix: "音轨",
      selectedKey: p,
      onSelect: (m) => e.selectAudioTrack(m === "off" ? null : Number(m))
    }
  );
  return /* @__PURE__ */ s("div", { style: { minWidth: 280, padding: t.paddingXS }, children: /* @__PURE__ */ s(
    xe,
    {
      size: "small",
      items: [
        { key: "info", label: "视频信息", children: u },
        { key: "subtitles", label: "字幕", children: c },
        { key: "audio", label: "音频", children: o }
      ]
    }
  ) });
}, $t = ({ controller: e, onOpenKeyHelp: t }) => {
  const { token: n } = N.useToken(), r = e.sessionKey !== null, i = r && e.duration > 0, p = se(e.currentTime, e.duration), u = { color: n.colorTextLightSolid }, c = {
    items: O.map((a) => ({
      key: String(a),
      label: /* @__PURE__ */ b("span", { style: { display: "inline-flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ s("span", { style: { width: 14 }, children: e.playbackRate === a ? /* @__PURE__ */ s(G, {}) : null }),
        le(a)
      ] })
    })),
    onClick: ({ key: a }) => {
      e.setPlaybackRate(Number(a));
    },
    selectable: !1
  }, m = {
    items: [
      {
        key: "off",
        label: /* @__PURE__ */ b("span", { style: { display: "inline-flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ s("span", { style: { width: 14 }, children: e.subtitleTracks.every((a) => !a.selected) ? /* @__PURE__ */ s(G, {}) : null }),
          "关闭字幕"
        ] })
      }
    ].concat(
      e.subtitleTracks.map((a) => ({
        key: String(a.index),
        label: /* @__PURE__ */ b("span", { style: { display: "inline-flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ s("span", { style: { width: 14 }, children: a.selected ? /* @__PURE__ */ s(G, {}) : null }),
          a.label || `字幕轨 ${a.index + 1}`,
          a.language ? `（${a.language}）` : ""
        ] })
      }))
    ),
    onClick: ({ key: a }) => {
      e.selectSubtitleTrack(a === "off" ? null : Number(a));
    },
    selectable: !1
  }, f = e.audioTracks.map((a) => ({
    key: String(a.index),
    label: /* @__PURE__ */ b("span", { style: { display: "inline-flex", alignItems: "center", gap: 8 }, children: [
      /* @__PURE__ */ s("span", { style: { width: 14 }, children: a.selected ? /* @__PURE__ */ s(G, {}) : null }),
      a.label || `音轨 ${a.index + 1}`,
      a.language ? `（${a.language}）` : ""
    ] })
  })), d = {
    items: f.length > 0 ? f : [{ key: "empty", label: "当前视频没有可切换的音频轨道", disabled: !0 }],
    onClick: ({ key: a }) => {
      e.selectAudioTrack(Number(a));
    },
    selectable: !1
  };
  return /* @__PURE__ */ b(
    "section",
    {
      "aria-label": "视频播放控制",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: n.marginXXS,
        padding: `${n.paddingXXS}px ${n.paddingSM}px ${n.paddingXS}px`,
        background: n.colorBgLayout
      },
      children: [
        /* @__PURE__ */ s(
          ue,
          {
            ariaLabelForHandle: "播放进度",
            min: 0,
            max: e.duration > 0 ? e.duration : 1,
            step: 0.1,
            disabled: !i,
            value: p,
            tooltip: { formatter: (a) => z(Number(a ?? 0)) },
            onChange: (a) => {
              e.seekPreviewTo(Number(a));
            },
            onChangeComplete: (a) => {
              e.commitSeek(Number(a));
            },
            styles: { track: { padding: 0 } }
          }
        ),
        /* @__PURE__ */ b("div", { style: { display: "flex", alignItems: "center", gap: n.marginXXS, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ s(A, { title: e.isPlaying ? "暂停" : "播放", children: /* @__PURE__ */ s(
            S,
            {
              type: "text",
              "aria-label": e.isPlaying ? "暂停" : "播放",
              style: u,
              icon: e.isPlaying ? /* @__PURE__ */ s(Ce, {}) : /* @__PURE__ */ s(we, {}),
              disabled: !r,
              onClick: () => {
                e.togglePlayback();
              }
            }
          ) }),
          /* @__PURE__ */ s(A, { title: "后退 5 秒", children: /* @__PURE__ */ s(
            S,
            {
              type: "text",
              "aria-label": "后退 5 秒",
              style: u,
              icon: /* @__PURE__ */ s(Re, {}),
              disabled: !r,
              onClick: () => e.seekBy(-5)
            }
          ) }),
          /* @__PURE__ */ s(A, { title: "前进 5 秒", children: /* @__PURE__ */ s(
            S,
            {
              type: "text",
              "aria-label": "前进 5 秒",
              style: u,
              icon: /* @__PURE__ */ s(Le, {}),
              disabled: !r,
              onClick: () => e.seekBy(5)
            }
          ) }),
          /* @__PURE__ */ b(E.Text, { style: { color: n.colorTextLightSolid, fontSize: n.fontSizeSM, fontVariantNumeric: "tabular-nums" }, children: [
            z(e.currentTime),
            " / ",
            z(e.duration)
          ] }),
          /* @__PURE__ */ b("div", { style: { display: "flex", alignItems: "center", gap: 4, minWidth: 150 }, children: [
            /* @__PURE__ */ s(A, { title: e.isMuted ? "取消静音" : "静音", children: /* @__PURE__ */ s(
              S,
              {
                type: "text",
                "aria-label": e.isMuted ? "取消静音" : "静音",
                style: u,
                icon: e.isMuted || e.volume === 0 ? /* @__PURE__ */ s(Me, {}) : /* @__PURE__ */ s(_e, {}),
                disabled: !r,
                onClick: e.toggleMute
              }
            ) }),
            /* @__PURE__ */ s(
              ue,
              {
                ariaLabelForHandle: "音量",
                min: 0,
                max: 1,
                step: 0.05,
                disabled: !r,
                value: e.volume,
                tooltip: { formatter: (a) => `${Math.round(Number(a ?? 0) * 100)}%` },
                onChange: (a) => {
                  e.setVolumeLevel(Number(a));
                },
                style: { flex: 1, marginInline: 4 }
              }
            )
          ] }),
          /* @__PURE__ */ s(ne, { menu: c, trigger: ["click"], placement: "topRight", children: /* @__PURE__ */ s(S, { type: "text", "aria-label": "倍速", style: u, children: le(e.playbackRate) }) }),
          /* @__PURE__ */ s(A, { title: e.loop ? "关闭循环" : "循环播放", children: /* @__PURE__ */ s(
            S,
            {
              type: "text",
              "aria-label": e.loop ? "关闭循环" : "循环播放",
              style: { ...u, color: e.loop ? n.colorPrimary : n.colorTextLightSolid },
              icon: /* @__PURE__ */ s(Ae, {}),
              disabled: !r,
              onClick: e.toggleLoop
            }
          ) }),
          /* @__PURE__ */ s(ne, { menu: m, trigger: ["click"], placement: "topRight", disabled: !r, children: /* @__PURE__ */ s(S, { type: "text", "aria-label": "字幕", style: u, icon: /* @__PURE__ */ s(Fe, {}) }) }),
          /* @__PURE__ */ s(ne, { menu: d, trigger: ["click"], placement: "topRight", disabled: !r, children: /* @__PURE__ */ s(S, { type: "text", "aria-label": "音轨", style: u, icon: /* @__PURE__ */ s(De, {}) }) }),
          /* @__PURE__ */ s(Oe, { content: /* @__PURE__ */ s(Vt, { controller: e }), trigger: "click", placement: "topRight", children: /* @__PURE__ */ s(
            S,
            {
              type: "text",
              "aria-label": "更多",
              style: u,
              icon: /* @__PURE__ */ s(Ne, {}),
              disabled: !r,
              onClick: (a) => {
                a.stopPropagation();
              }
            }
          ) }),
          /* @__PURE__ */ s("div", { style: { flex: 1 } }),
          /* @__PURE__ */ s(A, { title: e.isPictureInPicture ? "退出画中画" : "画中画", children: /* @__PURE__ */ s(
            S,
            {
              type: "text",
              "aria-label": e.isPictureInPicture ? "退出画中画" : "画中画",
              style: u,
              icon: /* @__PURE__ */ s(Ue, {}),
              disabled: !r || !e.canUsePictureInPicture,
              onClick: () => {
                e.togglePictureInPicture();
              }
            }
          ) }),
          /* @__PURE__ */ s(A, { title: e.isFullscreen ? "退出全屏" : "全屏", children: /* @__PURE__ */ s(
            S,
            {
              type: "text",
              "aria-label": e.isFullscreen ? "退出全屏" : "全屏",
              style: u,
              icon: e.isFullscreen ? /* @__PURE__ */ s(Be, {}) : /* @__PURE__ */ s(Ke, {}),
              onClick: () => {
                e.toggleFullscreen();
              }
            }
          ) }),
          /* @__PURE__ */ s(A, { title: "快捷键帮助", children: /* @__PURE__ */ s(
            S,
            {
              type: "text",
              "aria-label": "快捷键帮助",
              style: u,
              icon: /* @__PURE__ */ s(Ve, {}),
              onClick: t
            }
          ) })
        ] })
      ]
    }
  );
}, Ht = {
  mediaAborted: "视频加载已取消。",
  mediaNetwork: "加载视频时发生网络错误。",
  mediaDecode: "当前运行时无法解码该视频（VIDEO_PLAYER_DECODE_UNSUPPORTED）。",
  mediaSource: "视频资源不可用（VIDEO_PLAYER_SOURCE_UNAVAILABLE）。",
  loadFailed: "视频加载失败，或当前运行时无法解码该视频。"
};
function zt(e) {
  return e === null ? null : {
    tone: "error",
    message: Ht[e] ?? "视频加载失败，或当前运行时无法解码该视频。"
  };
}
const Xt = [
  {
    title: "播放",
    items: [
      { keys: "空格 / K", label: "播放或暂停" },
      { keys: "← →", label: "后退 / 前进 5 秒" },
      { keys: "Shift + ← →", label: "后退 / 前进 30 秒" },
      { keys: "J / L", label: "后退 / 前进 10 秒" },
      { keys: "Home / End", label: "回到开头 / 跳到末尾" },
      { keys: "0-9", label: "跳转到 0%-90%" },
      { keys: "[ ]", label: "上一帧 / 下一帧" }
    ]
  },
  {
    title: "声音",
    items: [
      { keys: "↑ ↓", label: "音量增减" },
      { keys: "M", label: "静音" }
    ]
  },
  {
    title: "画面",
    items: [
      { keys: "F", label: "全屏" },
      { keys: "P", label: "画中画" },
      { keys: "双击", label: "全屏" }
    ]
  },
  {
    title: "其他",
    items: [
      { keys: "?", label: "打开快捷键帮助" },
      { keys: "Esc", label: "关闭面板 / 退出全屏" }
    ]
  }
], Gt = ({ controller: e, feedback: t, onOpenKeyHelp: n }) => {
  const { token: r } = N.useToken(), i = e.source, p = zt(e.errorKey), u = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: r.marginSM,
    background: "rgba(0, 0, 0, 0.45)",
    pointerEvents: "auto"
  };
  return /* @__PURE__ */ b(
    "div",
    {
      style: { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 },
      onKeyDown: (c) => {
        e.handleKeyDown(c);
      },
      tabIndex: 0,
      role: "region",
      "aria-label": "视频播放区域",
      children: [
        /* @__PURE__ */ b(
          "div",
          {
            ref: e.surfaceRef,
            style: {
              position: "relative",
              flex: 1,
              minHeight: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: r.colorBgLayout,
              overflow: "hidden"
            },
            onPointerMove: () => {
              e.revealChrome();
            },
            onPointerLeave: () => {
              e.scheduleChromeHide();
            },
            onClick: () => {
              e.revealChrome(), e.togglePlayback();
            },
            onDoubleClick: (c) => {
              c.stopPropagation(), e.toggleFullscreen();
            },
            children: [
              i === null ? null : /* @__PURE__ */ s(
                "video",
                {
                  ref: e.videoRef,
                  src: i.resourceUri,
                  style: { width: "100%", height: "100%", objectFit: "contain", background: "#000000" },
                  onLoadedMetadata: e.handleLoadedMetadata,
                  onCanPlay: e.handleCanPlay,
                  onPlaying: e.handlePlaying,
                  onPause: e.handlePause,
                  onWaiting: e.handleWaiting,
                  onEnded: e.handleEnded,
                  onTimeUpdate: e.handleTimeUpdate,
                  onDurationChange: e.handleDurationChange,
                  onProgress: e.handleProgress,
                  onVolumeChange: e.handleVolumeChange,
                  onError: e.handleError
                },
                e.sessionKey ?? void 0
              ),
              e.isBuffering ? /* @__PURE__ */ b("div", { style: u, role: "status", children: [
                /* @__PURE__ */ s($e, {}),
                /* @__PURE__ */ s(E.Text, { style: { color: r.colorTextLightSolid }, children: "正在缓冲…" })
              ] }) : null,
              e.isEnded ? /* @__PURE__ */ b("div", { style: u, children: [
                /* @__PURE__ */ s(E.Text, { style: { color: r.colorTextLightSolid, fontSize: r.fontSizeLG }, children: "播放结束" }),
                /* @__PURE__ */ s(
                  S,
                  {
                    type: "primary",
                    icon: /* @__PURE__ */ s(He, {}),
                    onClick: (c) => {
                      c.stopPropagation(), e.commitSeek(0), e.togglePlayback();
                    },
                    children: "重新播放"
                  }
                )
              ] }) : null,
              e.isBuffering || e.isEnded ? null : p !== null ? /* @__PURE__ */ s("div", { style: u, children: /* @__PURE__ */ s(E.Text, { role: "alert", style: { color: r.colorErrorText, fontSize: r.fontSizeLG }, children: p.message }) }) : null,
              t === null ? null : /* @__PURE__ */ b(
                "div",
                {
                  role: "status",
                  style: {
                    position: "absolute",
                    top: r.marginSM,
                    left: "50%",
                    transform: "translateX(-50%)",
                    padding: `${r.paddingXXS}px ${r.paddingSM}px`,
                    borderRadius: r.borderRadiusLG,
                    background: "rgba(0, 0, 0, 0.6)",
                    color: t.tone === "error" ? r.colorErrorText : r.colorTextLightSolid,
                    fontSize: r.fontSizeLG,
                    pointerEvents: "none"
                  },
                  children: [
                    t.message,
                    t.tone === "info" && e.duration > 0 ? ` · ${z(e.currentTime)}` : ""
                  ]
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ s(
          "div",
          {
            style: {
              opacity: e.chromeVisible ? 1 : 0,
              pointerEvents: e.chromeVisible ? "auto" : "none",
              transition: "opacity 200ms ease"
            },
            children: /* @__PURE__ */ s($t, { controller: e, onOpenKeyHelp: n })
          }
        )
      ]
    }
  );
}, Wt = ({ open: e, onClose: t }) => {
  const { token: n } = N.useToken();
  return /* @__PURE__ */ b(
    ze,
    {
      open: e,
      title: "快捷键",
      onCancel: t,
      footer: [
        /* @__PURE__ */ s(S, { type: "primary", onClick: t, children: "关闭" }, "close")
      ],
      width: 520,
      children: [
        /* @__PURE__ */ s("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: Xt.map((r) => /* @__PURE__ */ b("section", { children: [
          /* @__PURE__ */ s(E.Title, { level: 5, style: { marginTop: 0, marginBottom: 8 }, children: r.title }),
          /* @__PURE__ */ s("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }, children: r.items.map((i) => /* @__PURE__ */ b("li", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
            /* @__PURE__ */ s(
              "kbd",
              {
                style: {
                  minWidth: 96,
                  textAlign: "center",
                  padding: "2px 8px",
                  borderRadius: n.borderRadiusLG,
                  border: `1px solid ${n.colorBorder}`,
                  fontFamily: "inherit",
                  fontSize: n.fontSizeSM
                },
                children: i.keys
              }
            ),
            /* @__PURE__ */ s(E.Text, { children: i.label })
          ] }, `${r.title}-${i.keys}`)) })
        ] }, r.title)) }),
        /* @__PURE__ */ s(E.Text, { type: "secondary", style: { display: "block", marginTop: 16 }, children: "输入框聚焦时不触发单键快捷键；按 Esc 关闭本窗口。" })
      ]
    }
  );
}, jt = "chips.official.video-player", qt = 1600, Yt = () => {
  const { token: e } = N.useToken(), [t, n] = w.useState(null), [r, i] = w.useState(null), [p, u] = w.useState(!1), c = w.useRef(null), o = Nt({ source: t, onOpenKeyHelp: () => u(!0) }), m = w.useCallback((a) => {
    i(a), c.current !== null && window.clearTimeout(c.current), c.current = window.setTimeout(() => {
      c.current = null, i(null);
    }, qt);
  }, []);
  w.useEffect(() => () => {
    c.current !== null && window.clearTimeout(c.current);
  }, []);
  const f = w.useMemo(
    () => ({
      togglePlayback: () => {
        o.togglePlayback();
      },
      seekForward: () => {
        o.seekBy(5), m({ tone: "info", message: "前进 5 秒" });
      },
      seekBackward: () => {
        o.seekBy(-5), m({ tone: "info", message: "后退 5 秒" });
      },
      toggleMute: () => {
        o.toggleMute(), m({ tone: "info", message: o.isMuted ? "已取消静音" : "已静音" });
      },
      cyclePlaybackRate: () => {
        o.cyclePlaybackRate(), m({ tone: "info", message: `播放速度 ${o.playbackRate}x` });
      },
      toggleLoop: () => {
        o.toggleLoop(), m({ tone: "info", message: o.loop ? "已关闭循环播放" : "已开启循环播放" });
      },
      toggleFullscreen: () => {
        o.toggleFullscreen();
      },
      togglePictureInPicture: () => {
        o.togglePictureInPicture();
      },
      openCard: (a) => {
        const T = typeof a?.path == "string" ? a.path : "";
        m({
          tone: "error",
          message: `资源打开通道尚未就绪，暂不能打开：${T || "未提供路径"}`
        });
      },
      refreshView: () => {
        n((a) => a === null ? null : { ...a, revision: a.revision + 1 });
      }
    }),
    [o, m]
  ), d = pt(f);
  return w.useEffect(() => {
    const a = d.lastInvoked;
    a !== null && a.commandId !== P.openCard && a.commandId === P.refreshView && m({ tone: "info", message: "已刷新当前会话" });
  }, [d.lastInvoked, m]), /* @__PURE__ */ b(
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
      onKeyDown: (a) => {
        a.key === "Escape" && p && u(!1);
      },
      children: [
        t === null ? /* @__PURE__ */ s(
          Bt,
          {
            onOpen: (a) => {
              n(a), m({ tone: "info", message: "已打开视频会话" });
            }
          }
        ) : /* @__PURE__ */ s(Gt, { controller: o, feedback: r, onOpenKeyHelp: () => u(!0) }),
        /* @__PURE__ */ b(
          E.Text,
          {
            type: "secondary",
            style: { padding: `0 ${e.paddingSM}px ${e.paddingXXS}px`, fontSize: e.fontSizeSM },
            children: [
              "命令注册状态：",
              dt[d.phase],
              d.errorCode === null ? "" : `（${d.errorCode}）`
            ]
          }
        ),
        /* @__PURE__ */ s(Wt, { open: p, onClose: () => u(!1) })
      ]
    }
  );
}, en = () => /* @__PURE__ */ s(Xe, { appId: jt, surface: "window", children: /* @__PURE__ */ s(Ge, { children: /* @__PURE__ */ s(Yt, {}) }) });
export {
  en as AppView,
  en as default
};
