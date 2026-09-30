import { jsx as c, jsxs as h } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import f, { useState as H, useEffect as je } from "chips-resource://platform/vendor/react.js";
import { useCommandRuntime as Be, ChipsProvider as $e, CommandProvider as ze, theme as Ge, Flex as y, Typography as I, Card as Y, Segmented as q, FileImageOutlined as Ke, FontColorsOutlined as pe, Button as M, UploadOutlined as We, Collapse as Ve, Checkbox as He, Radio as X, Input as Ye, Alert as he } from "chips-resource://platform/vendor/chips-ui.js";
class L extends Error {
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
    return new L({
      code: t.code,
      message: t.message,
      retryable: t.retryable ?? !1,
      ...t.details !== void 0 ? { details: t.details } : {}
    });
  }
}
function qe(e) {
  if (typeof e != "object" || e === null)
    return !1;
  const t = e;
  return typeof t.code == "string" && t.code.length > 0 && typeof t.message == "string" && (t.retryable === void 0 || typeof t.retryable == "boolean");
}
const Xe = "SDK_BRIDGE_UNAVAILABLE", ye = "SDK_UNKNOWN_ERROR", be = "发生未知错误";
function Ze(e) {
  return e instanceof Error;
}
function Je(e) {
  if (e instanceof L)
    return e;
  if (qe(e)) {
    const t = e, n = {
      code: t.code,
      message: t.message,
      retryable: t.retryable ?? !1,
      ...t.details !== void 0 ? { details: t.details } : {}
    };
    return new L(n);
  }
  return Ze(e) ? new L({
    code: ye,
    message: be,
    details: { name: e.name, cause: e.message },
    retryable: !1
  }) : new L({
    code: ye,
    message: be,
    details: { value: String(e) },
    retryable: !1
  });
}
function Qe() {
  return new L({
    code: Xe,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function w(e, t, n) {
  let r;
  try {
    r = e();
  } catch (i) {
    return Promise.reject(Je(i));
  }
  return r.request(t, n);
}
const et = "cli.command.list", tt = "cli.command.get", nt = "cli.command.resolve";
function rt(e) {
  return {
    list(t) {
      return w(e, et, t ?? {});
    },
    get(t) {
      return w(e, tt, t);
    },
    resolve(t) {
      return w(e, nt, t);
    }
  };
}
const O = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, it = "cli.task.create", ot = "cli.task.bindInvocation", at = "cli.task.cancel";
function st(e) {
  return {
    create(t) {
      return w(e, it, t).then((n) => n.task);
    },
    bindInvocation(t) {
      return w(e, ot, t).then((n) => n.task);
    },
    get(t) {
      const n = { taskId: t };
      return w(e, O.CLI_TASK_GET, n).then((r) => r.task);
    },
    active(t) {
      const n = { commandId: t };
      return w(e, O.CLI_TASK_ACTIVE, n).then((r) => r.task);
    },
    progress(t, n) {
      const r = { taskId: t, progress: n };
      return w(e, O.CLI_TASK_PROGRESS, r).then((i) => i.task);
    },
    complete(t, n) {
      const r = {
        taskId: t,
        ...n === void 0 ? {} : { output: n }
      };
      return w(e, O.CLI_TASK_COMPLETE, r).then((i) => i.task);
    },
    fail(t, n) {
      const r = { taskId: t, error: n };
      return w(e, O.CLI_TASK_FAIL, r).then((i) => i.task);
    },
    cancel(t) {
      return w(e, at, { taskId: t }).then((n) => n.task);
    }
  };
}
function ct() {
  return globalThis.window?.chips;
}
class lt {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = rt(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = st(() => this.#e());
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
    const t = ct();
    if (t === void 0)
      throw Qe();
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
    return w(() => this.#e(), t, n);
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
function dt(e) {
  return new lt(e?.bridge);
}
const T = dt(), Ce = "chips.official.iconmaker", Ee = {
  generate: "iconmaker:generate"
}, ut = {
  generate: "generate"
}, Z = [
  {
    id: Ee.generate,
    title: "生成图标",
    description: "从当前图片生成 PNG、ICO 与 ICNS 图标包",
    shortcut: "CommandOrControl+Alt+G",
    scope: { kind: "app", appId: Ce },
    paramsSchema: {
      type: "object",
      additionalProperties: !1,
      properties: {
        source: { type: "string", minLength: 1 },
        outputDir: { type: "string", minLength: 1 },
        overwrite: { type: "boolean", default: !1 }
      }
    },
    keywords: ["图标", "生成", "icns"],
    group: "导出",
    handlerId: ut.generate
  }
];
new Set(Object.values(Ee));
function ft(e) {
  return Z.map((t) => {
    const n = t.handlerId ?? "";
    return {
      commandId: t.id,
      handlerId: n,
      handler: (r) => e.generate(r)
    };
  });
}
const gt = {
  registering: "命令注册中",
  ready: "命令已就绪",
  error: "命令通道异常"
};
function mt(e) {
  if (typeof e == "object" && e !== null && "code" in e) {
    const t = e.code;
    if (typeof t == "string" && t.length > 0)
      return t;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function pt(e) {
  const t = Be(), [n, r] = H("registering"), [i, a] = H(null), [m, l] = H(null);
  return je(() => {
    let g = !1, p = null;
    return r("registering"), a(null), (async () => {
      try {
        for (const u of Z)
          await T.request("command:register", { definition: u });
        if (g)
          return;
        p = t.attach(
          ft({
            generate: (u) => e(u).then(() => {
              g || l(u ?? {});
            })
          })
        ), r("ready");
      } catch (u) {
        g || (a(mt(u)), r("error"));
      }
    })(), () => {
      g = !0, p?.dispose();
      for (const u of Z)
        T.request("command:unregister", { commandId: u.id }).catch(() => {
        });
    };
  }, [t, e]), {
    phase: n,
    errorCode: i,
    lastCommandGenerate: m
  };
}
const ht = [
  ["home", "e88a"],
  ["search", "e8b6"],
  ["settings", "e8b8"],
  ["favorite", "e87d"],
  ["star", "e838"],
  ["add", "e145"],
  ["check", "e5ca"],
  ["close", "e5cd"],
  ["menu", "e5d2"],
  ["download", "f090"],
  ["upload", "f09b"],
  ["image", "e3f4"],
  ["palette", "e40a"],
  ["bolt", "e0b7"],
  ["rocket", "eb9b"],
  ["folder", "e2c7"],
  ["lock", "e897"],
  ["key", "e73c"],
  ["mail", "e158"],
  ["calendar", "e935"],
  ["play", "e037"],
  ["pause", "e034"],
  ["volume", "e050"],
  ["wifi", "e63e"],
  ["cloud", "e2bd"],
  ["code", "e86f"],
  ["terminal", "eb8e"],
  ["brush", "e3ae"],
  ["camera", "e3af"],
  ["map", "e55b"],
  ["public", "e80b"],
  ["shield", "e9e0"],
  ["tune", "e429"],
  ["widgets", "e1bd"],
  ["extension", "e87b"],
  ["auto_awesome", "e65f"]
], yt = "assets/fonts/material-symbols/variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].codepoints", bt = [
  ["Material Symbols Outlined", "MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2"],
  ["Material Symbols Rounded", "MaterialSymbolsRounded[FILL,GRAD,opsz,wght].woff2"],
  ["Material Symbols Sharp", "MaterialSymbolsSharp[FILL,GRAD,opsz,wght].woff2"]
], St = [
  [9728, 10175],
  [126976, 127023],
  [127136, 127231],
  [127232, 127487],
  [127488, 127743],
  [127744, 128511],
  [128512, 128591],
  [128640, 128767],
  [128768, 128895],
  [128896, 129023],
  [129024, 129279],
  [129280, 129535],
  [129648, 129791]
], wt = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
function Ct(e = 60) {
  return Array.from({ length: e }, (t, n) => {
    const r = 57344 + n, i = r.toString(16).toUpperCase().padStart(4, "0");
    return {
      id: `custom-${i}`,
      label: `U+${i}`,
      display: String.fromCodePoint(r),
      codepoint: `U+${i}`
    };
  });
}
function Et() {
  return ht.map(([e, t]) => ({
    id: `material-${e}`,
    label: e,
    display: String.fromCodePoint(Number.parseInt(t, 16)),
    codepoint: `U+${t.toUpperCase()}`
  }));
}
function It(e) {
  return e.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).map((t) => {
    const [n, r] = t.split(/\s+/);
    if (n === void 0 || n.length === 0 || r === void 0)
      return null;
    const i = Number.parseInt(r, 16);
    return Number.isFinite(i) ? {
      id: `material-${n}`,
      label: n,
      display: String.fromCodePoint(i),
      codepoint: `U+${r.toUpperCase()}`
    } : null;
  }).filter((t) => t !== null);
}
function Rt() {
  return new URL(yt, new URL(
    /* @vite-ignore */
    ".",
    import.meta.url
  )).href;
}
async function Lt() {
  const e = await fetch(Rt());
  if (!e.ok)
    throw new Error("MATERIAL_SYMBOLS_CODEPOINTS_UNAVAILABLE");
  const t = It(await e.text());
  if (t.length === 0)
    throw new Error("MATERIAL_SYMBOLS_CODEPOINTS_EMPTY");
  return {
    ...$,
    glyphs: t
  };
}
async function _t() {
  const e = [], t = [];
  for (const [n, r] of bt) {
    const i = new URL(
      `assets/fonts/material-symbols/variablefont/${r}`,
      new URL(
        /* @vite-ignore */
        ".",
        import.meta.url
      )
    ).href;
    try {
      const a = new FontFace(n, `url(${i})`);
      await a.load(), document.fonts.add(a), e.push(n);
    } catch {
      t.push(n);
    }
  }
  return { registered: e, failed: t };
}
function At() {
  const e = [];
  for (const [t, n] of St)
    for (let r = t; r <= n; r += 1) {
      const i = String.fromCodePoint(r);
      if (!wt.test(i))
        continue;
      const a = r.toString(16).toUpperCase();
      e.push({
        id: `emoji-${a}`,
        label: `U+${a}`,
        display: i,
        codepoint: `U+${a}`
      });
    }
  return e;
}
const $ = {
  id: "material-symbols",
  kind: "material",
  name: "Material Symbols",
  family: "'Material Symbols Rounded', 'Material Symbols Outlined', 'Material Symbols Sharp'",
  glyphs: Et()
}, Mt = {
  id: "emoji",
  kind: "emoji",
  name: "Emoji",
  family: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
  glyphs: At()
}, Ut = /\.[^.\\/]+$/;
function Ot(e) {
  return e.trim().replace(Ut, "") || "icon";
}
function Tt(e) {
  return e.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^[.-]+|[.-]+$/g, "") || "icon";
}
const vt = /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
function Ie(e) {
  const t = e.name.toLowerCase();
  return vt.has(e.type) || [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].some((n) => t.endsWith(n));
}
function Re(e) {
  return new Promise((t, n) => {
    const r = new Image();
    r.onload = () => t(r), r.onerror = () => n(new Error("IMAGE_DECODE_FAILED")), r.src = e;
  });
}
async function Le(e) {
  const t = URL.createObjectURL(e);
  try {
    const n = await Re(t);
    return {
      id: `${e.name}-${e.size}-${e.lastModified}`,
      fileName: e.name,
      baseName: Tt(Ot(e.name)),
      objectUrl: t,
      width: n.naturalWidth || n.width,
      height: n.naturalHeight || n.height,
      file: e
    };
  } catch (n) {
    throw URL.revokeObjectURL(t), n;
  }
}
function Nt(e, t, n) {
  if (n.kind === "gradient" && n.start !== n.end) {
    const r = e.createLinearGradient(0, 0, t, t);
    r.addColorStop(0, n.start), r.addColorStop(1, n.end), e.fillStyle = r;
  } else
    e.fillStyle = n.start;
  e.fillRect(0, 0, t, t);
}
function kt(e, t, n) {
  const r = e.naturalWidth || e.width || 1, i = e.naturalHeight || e.height || 1, a = r / i;
  if (n === "fill") {
    const u = a > 1 ? i : r, U = a > 1 ? i : r;
    return {
      sx: Math.max(0, (r - u) / 2),
      sy: Math.max(0, (i - U) / 2),
      sw: u,
      sh: U,
      dx: 0,
      dy: 0,
      dw: t,
      dh: t
    };
  }
  const m = Math.max(0, Math.round(t * 0.08)), l = Math.max(1, t - m * 2), g = a >= 1 ? l : Math.round(l * a), p = a >= 1 ? Math.round(l / a) : l;
  return {
    sx: 0,
    sy: 0,
    sw: r,
    sh: i,
    dx: Math.round((t - g) / 2),
    dy: Math.round((t - p) / 2),
    dw: g,
    dh: p
  };
}
async function xt(e, t) {
  if (!t.imageSource)
    return;
  const n = await Re(t.imageSource.objectUrl), r = kt(n, t.size, t.settings.imageFit);
  e.drawImage(n, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
}
function Pt(e, t) {
  if (!t.selectedGlyph)
    return;
  const n = Math.round(t.size * 0.62);
  e.fillStyle = t.settings.foregroundColor, e.textAlign = "center", e.textBaseline = "middle", e.font = `400 ${n}px ${t.fontSource.family}`, e.fillText(t.selectedGlyph.display, t.size / 2, t.size / 2 + Math.round(t.size * 0.02));
}
async function Dt(e) {
  const t = document.createElement("canvas");
  return await _e(t, e), t;
}
async function _e(e, t) {
  const n = e.getContext("2d");
  if (!n)
    throw new Error("CANVAS_UNAVAILABLE");
  e.width = t.size, e.height = t.size, n.clearRect(0, 0, t.size, t.size), n.imageSmoothingEnabled = !0, n.imageSmoothingQuality = "high", t.sourceMode === "image" ? await xt(n, t) : (Nt(n, t.size, t.settings.background), Pt(n, t));
}
function Ft(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => {
      if (!r) {
        n(new Error("PNG_ENCODE_FAILED"));
        return;
      }
      r.arrayBuffer().then((i) => t(new Uint8Array(i))).catch(n);
    }, "image/png");
  });
}
function J(e) {
  const t = e.reduce((i, a) => i + a.byteLength, 0), n = new Uint8Array(t);
  let r = 0;
  for (const i of e)
    n.set(i, r), r += i.byteLength;
  return n;
}
function z(e) {
  return new TextEncoder().encode(e);
}
function d(e, t, n) {
  e.setUint16(t, n, !0);
}
function b(e, t, n) {
  e.setUint32(t, n >>> 0, !0);
}
function Se(e) {
  const t = new Uint8Array(4);
  return new DataView(t.buffer).setUint32(0, e >>> 0, !1), t;
}
function jt(e) {
  const t = e.map((r) => {
    const i = 8 + r.pngBytes.byteLength;
    return J([z(r.type), Se(i), r.pngBytes]);
  }), n = 8 + t.reduce((r, i) => r + i.byteLength, 0);
  return J([z("icns"), Se(n), ...t]);
}
function Bt(e) {
  const t = [...e].sort((l, g) => l.size - g.size), n = 6 + t.length * 16, r = n + t.reduce((l, g) => l + g.pngBytes.byteLength, 0), i = new Uint8Array(r), a = new DataView(i.buffer);
  d(a, 0, 0), d(a, 2, 1), d(a, 4, t.length);
  let m = n;
  return t.forEach((l, g) => {
    if (l.size > 256)
      throw new Error(`ICO payload exceeds 256 pixels: ${l.size}`);
    const p = 6 + g * 16, u = l.size >= 256 ? 0 : l.size;
    a.setUint8(p, u), a.setUint8(p + 1, u), a.setUint8(p + 2, 0), a.setUint8(p + 3, 0), d(a, p + 4, 1), d(a, p + 6, 32), b(a, p + 8, l.pngBytes.byteLength), b(a, p + 12, m), i.set(l.pngBytes, m), m += l.pngBytes.byteLength;
  }), i;
}
const Q = new Uint32Array(256);
for (let e = 0; e < Q.length; e += 1) {
  let t = e;
  for (let n = 0; n < 8; n += 1)
    t = t & 1 ? 3988292384 ^ t >>> 1 : t >>> 1;
  Q[e] = t >>> 0;
}
function $t(e) {
  let t = 4294967295;
  for (const n of e)
    t = Q[(t ^ n) & 255] ^ t >>> 8;
  return (t ^ 4294967295) >>> 0;
}
function zt(e, t) {
  const n = z(e.path), r = new Uint8Array(30 + n.byteLength), i = new DataView(r.buffer);
  return b(i, 0, 67324752), d(i, 4, 20), d(i, 6, 2048), d(i, 8, 0), d(i, 10, 0), d(i, 12, 0), b(i, 14, t), b(i, 18, e.bytes.byteLength), b(i, 22, e.bytes.byteLength), d(i, 26, n.byteLength), d(i, 28, 0), r.set(n, 30), r;
}
function Gt(e, t, n) {
  const r = z(e.path), i = new Uint8Array(46 + r.byteLength), a = new DataView(i.buffer);
  return b(a, 0, 33639248), d(a, 4, 20), d(a, 6, 20), d(a, 8, 2048), d(a, 10, 0), d(a, 12, 0), d(a, 14, 0), b(a, 16, t), b(a, 20, e.bytes.byteLength), b(a, 24, e.bytes.byteLength), d(a, 28, r.byteLength), d(a, 30, 0), d(a, 32, 0), d(a, 34, 0), d(a, 36, 0), b(a, 38, 0), b(a, 42, n), i.set(r, 46), i;
}
function Kt(e, t, n) {
  const r = new Uint8Array(22), i = new DataView(r.buffer);
  return b(i, 0, 101010256), d(i, 4, 0), d(i, 6, 0), d(i, 8, e), d(i, 10, e), b(i, 12, t), b(i, 16, n), d(i, 20, 0), r;
}
function Wt(e) {
  const t = [], n = [];
  let r = 0;
  for (const l of e) {
    const g = $t(l.bytes), p = zt(l, g), u = r;
    t.push(p, l.bytes), r += p.byteLength + l.bytes.byteLength, n.push({
      header: Gt(l, g, u),
      offset: u
    });
  }
  const i = n.map((l) => l.header), a = i.reduce((l, g) => l + g.byteLength, 0), m = Kt(e.length, a, r);
  return J([...t, ...i, m]);
}
const ee = {
  png: "image/png",
  ico: "image/x-icon",
  icns: "image/icns"
}, Vt = 256;
function Ht(e) {
  return e.sourceMode === "image" && e.imageSource ? e.imageSource.baseName : e.selectedGlyph?.label.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() || "icon";
}
function Yt(e) {
  return e <= 16 ? "ic04" : e <= 32 ? "ic05" : e <= 64 ? "ic12" : e <= 128 ? "ic07" : e <= 256 ? "ic08" : "ic09";
}
async function te(e, t = e.size) {
  const n = await Dt({
    ...e,
    size: t
  });
  return Ft(n);
}
async function qt(e, t) {
  const n = await te(e);
  return {
    fileName: `${t}.png`,
    mimeType: ee.png,
    bytes: n
  };
}
async function Xt(e, t) {
  const n = Math.min(e.size, Vt), r = await te(e, n);
  return {
    fileName: `${t}.ico`,
    mimeType: ee.ico,
    bytes: Bt([{ size: n, pngBytes: r }])
  };
}
async function Zt(e, t) {
  const n = await te(e);
  return {
    fileName: `${t}.icns`,
    mimeType: ee.icns,
    bytes: jt([{ type: Yt(e.size), pngBytes: n }])
  };
}
async function Ae(e) {
  const t = Ht(e), n = {
    png: () => qt(e, t),
    ico: () => Xt(e, t),
    icns: () => Zt(e, t)
  };
  return Promise.all(e.settings.formats.map((r) => n[r]()));
}
async function Jt(e, t = "icons.zip") {
  const n = await Ae(e);
  return {
    fileName: t,
    mimeType: "application/zip",
    bytes: Wt(
      n.map((r) => ({
        path: r.fileName,
        bytes: r.bytes
      }))
    )
  };
}
const Qt = [16, 32, 48, 64, 128, 256, 512], en = ["png", "ico", "icns"], Me = [
  {
    id: "white",
    label: "纯白",
    kind: "solid",
    start: "#ffffff",
    end: "#ffffff"
  },
  {
    id: "black",
    label: "纯黑",
    kind: "solid",
    start: "#050505",
    end: "#050505"
  },
  {
    id: "peach",
    label: "桃粉",
    kind: "gradient",
    start: "#ff9a9e",
    end: "#fad0c4"
  },
  {
    id: "ocean",
    label: "海蓝",
    kind: "gradient",
    start: "#0a84ff",
    end: "#06b6d4"
  },
  {
    id: "aurora",
    label: "极光",
    kind: "gradient",
    start: "#22c55e",
    end: "#a3e635"
  },
  {
    id: "violet",
    label: "紫莓",
    kind: "gradient",
    start: "#8b5cf6",
    end: "#ec4899"
  },
  {
    id: "ember",
    label: "暖焰",
    kind: "gradient",
    start: "#ff9f0a",
    end: "#ef4444"
  },
  {
    id: "slate",
    label: "石板",
    kind: "gradient",
    start: "#0f172a",
    end: "#64748b"
  }
], tn = {
  outputSize: 256,
  formats: ["png", "ico", "icns"],
  // 预设表为模块内字面量，首项恒存在（纯白）。
  background: Me[0],
  foregroundColor: "#000000",
  imageFit: "fit"
};
function nn(e) {
  if (e instanceof L)
    return e.code;
  if (typeof e == "object" && e !== null && "code" in e) {
    const t = e.code;
    if (typeof t == "string" && t.length > 0)
      return t;
  }
  return null;
}
function rn(e, t) {
  return `${e.replace(/[\\/]+$/g, "")}/${t}`;
}
function on(e) {
  let t = "";
  for (let r = 0; r < e.length; r += 32768)
    t += String.fromCharCode(...e.subarray(r, r + 32768));
  return btoa(t);
}
async function an(e, t) {
  const n = [];
  try {
    await T.request("file:mkdir", { path: t, recursive: !0 });
    for (const r of e) {
      const i = rn(t, r.fileName);
      await T.request("file:write", {
        path: i,
        data: on(r.bytes),
        encoding: "base64"
      }), n.push(i);
    }
  } catch (r) {
    const i = nn(r) ?? "ICON_SAVE_UNKNOWN_ERROR";
    return {
      status: "failed",
      outputDir: t,
      writtenPaths: n,
      errorCode: i,
      message: `落盘未完成：写入能力返回错误（${i}）。产物仍在预览中，未写入任何虚假成功状态。`
    };
  }
  return {
    status: "written",
    outputDir: t,
    writtenPaths: n,
    errorCode: null,
    message: `已写入 ${n.length} 个文件到 ${t}。`
  };
}
function sn(e) {
  const t = e.toLowerCase();
  return t.endsWith(".png") ? "image/png" : t.endsWith(".jpg") || t.endsWith(".jpeg") ? "image/jpeg" : t.endsWith(".webp") ? "image/webp" : t.endsWith(".gif") ? "image/gif" : t.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
}
function cn(e) {
  return e.split(/[\\/]/).filter(Boolean).pop() ?? "icon";
}
function ln(e, t) {
  const n = new Uint8Array(t);
  return new File([n.buffer], cn(e), {
    type: sn(e),
    lastModified: Date.now()
  });
}
async function dn(e) {
  const t = await T.request("file:read", { path: e, encoding: "base64" });
  if (typeof t != "object" || t === null || typeof t.content != "string")
    throw new Error("ICONMAKER_INPUT_NOT_BINARY");
  const n = atob(t.content), r = new Uint8Array(n.length);
  for (let a = 0; a < n.length; a += 1)
    r[a] = n.charCodeAt(a);
  const i = ln(e, r);
  if (!Ie(i))
    throw new Error("ICONMAKER_INPUT_UNSUPPORTED");
  return Le(i);
}
const un = "custom-font", fn = ["#000000", "#ffffff", "#0a84ff", "#34c759", "#ff9f0a", "#ff3b30"];
function gn(e) {
  return e.kind === "gradient" && e.start !== e.end ? `linear-gradient(135deg, ${e.start}, ${e.end})` : e.start;
}
function ne(e) {
  const t = e.fontSource.glyphs;
  return t.find((n) => n.id === e.selectedGlyphId) ?? t[0] ?? null;
}
function mn(e) {
  return {
    size: e.settings.outputSize,
    settings: e.settings,
    sourceMode: e.sourceMode,
    imageSource: e.imageSource,
    fontSource: e.fontSource,
    selectedGlyph: ne(e)
  };
}
function we(e) {
  return e.settings.formats.length === 0 ? "请至少选择一种输出格式。" : e.sourceMode === "image" && e.imageSource === null ? "请先上传图片或切换到图标字体。" : e.sourceMode === "font" && ne(e) === null ? "请先选择一个字体图标。" : null;
}
const pn = () => {
  const { token: e } = Ge.useToken(), t = f.useRef(null), n = f.useRef(null), r = f.useRef(null), [i, a] = f.useState("image"), [m, l] = f.useState(null), [g, p] = f.useState($), [u, U] = f.useState(null), [Ue, re] = f.useState($.id), [ie, G] = f.useState(
    $.glyphs[0]?.id ?? ""
  ), [S, oe] = f.useState(tn), [ae, v] = f.useState(!1), [K, E] = f.useState(null), [N, Oe] = f.useState(""), [k, se] = f.useState(!1), [A, Te] = f.useState(null), W = f.useMemo(
    () => [g, Mt, ...u ? [u] : []],
    [u, g]
  ), _ = W.find((o) => o.id === Ue) ?? g, x = f.useMemo(
    () => ({ sourceMode: i, imageSource: m, fontSource: _, selectedGlyphId: ie, settings: S }),
    [i, m, _, ie, S]
  ), P = we(x), D = mn(x), ce = f.useRef(D);
  ce.current = D;
  const le = f.useRef(N);
  le.current = N;
  const de = f.useRef(k);
  de.current = k, f.useEffect(() => () => {
    m && URL.revokeObjectURL(m.objectUrl), u?.objectUrl && URL.revokeObjectURL(u.objectUrl);
  }, [u, m]), f.useEffect(() => {
    let o = !1;
    return Lt().then((s) => {
      o || p(s);
    }).catch(() => {
    }), _t().then((s) => {
      !o && s.failed.length > 0 && E({
        kind: "info",
        text: `图标字体加载了 ${s.registered.length} 套，以下字体不可用：${s.failed.join("、")}。`
      });
    }), () => {
      o = !0;
    };
  }, []), f.useEffect(() => {
    let o = !1;
    const s = r.current;
    if (s)
      return _e(s, D).catch(() => {
        o || E({ kind: "error", text: "预览生成失败。" });
      }), () => {
        o = !0;
      };
  }, [D]);
  const F = (o) => {
    oe((s) => ({ ...s, ...o }));
  }, ve = (o, s) => {
    oe((C) => ({
      ...C,
      formats: s ? Array.from(/* @__PURE__ */ new Set([...C.formats, o])) : C.formats.filter((R) => R !== o)
    }));
  }, ue = (o) => {
    l((s) => (s && URL.revokeObjectURL(s.objectUrl), o)), E({ kind: "success", text: "图片已载入，预览已更新。" });
  }, fe = async (o) => {
    if (!Ie(o)) {
      E({ kind: "error", text: "这个文件格式暂不支持。" });
      return;
    }
    try {
      ue(await Le(o));
    } catch {
      E({ kind: "error", text: "图片解码失败。" });
    }
  }, Ne = () => {
    m && URL.revokeObjectURL(m.objectUrl), l(null), E(null);
  }, ke = async (o) => {
    const s = URL.createObjectURL(o), C = `IconMakerCustomFont-${Date.now()}`;
    try {
      const j = new FontFace(C, `url(${s})`);
      await j.load(), document.fonts.add(j);
    } catch {
      URL.revokeObjectURL(s), E({ kind: "error", text: "图标字体解码失败。" });
      return;
    }
    u?.objectUrl && URL.revokeObjectURL(u.objectUrl);
    const R = {
      id: un,
      kind: "custom",
      name: o.name,
      family: C,
      glyphs: Ct(72),
      objectUrl: s
    };
    U(R), re(R.id), G(R.glyphs[0]?.id ?? ""), a("font"), E({ kind: "success", text: "图标字体已载入。" });
  }, V = async (o) => {
    if (de.current)
      return;
    const s = we(x);
    if (s !== null)
      throw new Error(s);
    const C = (o?.outputDir ?? le.current).trim();
    if (C.length === 0)
      throw new Error("请先填写输出目录。");
    E(null), se(!0);
    try {
      o?.source !== void 0 && o.source.length > 0 && ue(await dn(o.source));
      const R = ce.current, j = await Ae(R), Fe = await Jt(R), B = await an([...j, Fe], C);
      if (Te(B), B.status === "failed")
        throw new Error(B.errorCode ?? "ICON_SAVE_FAILED");
      E({ kind: "success", text: B.message });
    } finally {
      se(!1);
    }
  }, ge = f.useRef(V);
  ge.current = V;
  const xe = f.useCallback(
    (o) => ge.current(o),
    []
  ), { phase: Pe, errorCode: me } = pt(xe), De = {
    display: "flex",
    flexWrap: "wrap",
    gap: e.marginXXS,
    maxHeight: 220,
    overflowY: "auto",
    padding: e.paddingXXS,
    border: `1px solid ${e.colorBorderSecondary}`,
    borderRadius: e.borderRadiusLG
  };
  return /* @__PURE__ */ h(y, { vertical: !0, gap: e.marginSM, style: { padding: e.padding, height: "100%", overflow: "auto" }, children: [
    /* @__PURE__ */ h(y, { justify: "space-between", align: "center", gap: e.marginSM, wrap: "wrap", children: [
      /* @__PURE__ */ c(I.Title, { level: 4, style: { margin: 0 }, children: "图标工坊" }),
      /* @__PURE__ */ h(I.Text, { type: "secondary", children: [
        "命令通道：",
        gt[Pe],
        me === null ? "" : `（${me}）`
      ] })
    ] }),
    /* @__PURE__ */ h(y, { gap: e.marginSM, align: "flex-start", wrap: "wrap", style: { flex: 1 }, children: [
      /* @__PURE__ */ h(y, { vertical: !0, gap: e.marginSM, style: { flex: 1, minWidth: 320 }, children: [
        /* @__PURE__ */ c(Y, { title: "基础设置", size: "small", children: /* @__PURE__ */ h(y, { vertical: !0, gap: e.marginSM, children: [
          /* @__PURE__ */ c(
            q,
            {
              value: i,
              onChange: (o) => a(o),
              options: [
                { label: "上传图片", value: "image", icon: /* @__PURE__ */ c(Ke, {}) },
                { label: "图标字体", value: "font", icon: /* @__PURE__ */ c(pe, {}) }
              ]
            }
          ),
          i === "image" ? /* @__PURE__ */ h(y, { vertical: !0, gap: e.marginSM, children: [
            /* @__PURE__ */ c(
              "input",
              {
                ref: t,
                type: "file",
                accept: ".svg,.png,.jpg,.jpeg,.webp,.gif,image/svg+xml,image/png,image/jpeg,image/webp,image/gif",
                style: { display: "none" },
                onChange: (o) => {
                  const s = o.currentTarget.files?.[0];
                  s && fe(s), o.currentTarget.value = "";
                }
              }
            ),
            /* @__PURE__ */ c(
              M,
              {
                onClick: () => t.current?.click(),
                onDragEnter: (o) => {
                  o.preventDefault(), v(!0);
                },
                onDragOver: (o) => {
                  o.preventDefault(), v(!0);
                },
                onDragLeave: () => v(!1),
                onDrop: (o) => {
                  o.preventDefault(), v(!1);
                  const s = o.dataTransfer.files[0];
                  s && fe(s);
                },
                style: {
                  height: 96,
                  borderStyle: ae ? "solid" : "dashed",
                  borderColor: ae ? e.colorPrimary : e.colorBorder
                },
                children: m ? /* @__PURE__ */ h(I.Text, { children: [
                  m.fileName,
                  "（点击可更换）"
                ] }) : /* @__PURE__ */ h("span", { children: [
                  /* @__PURE__ */ c(We, {}),
                  " 拖拽或点击上传图片"
                ] })
              }
            ),
            m ? /* @__PURE__ */ c(M, { onClick: Ne, children: "清除图片" }) : null
          ] }) : /* @__PURE__ */ h(y, { vertical: !0, gap: e.marginSM, children: [
            /* @__PURE__ */ c(
              q,
              {
                value: _.id,
                onChange: (o) => {
                  const s = W.find((C) => C.id === o);
                  s && (re(s.id), G(s.glyphs[0]?.id ?? ""));
                },
                options: W.map((o) => ({ label: o.name, value: o.id }))
              }
            ),
            /* @__PURE__ */ h(I.Text, { type: "secondary", children: [
              _.name,
              "，",
              _.glyphs.length,
              " 个图标"
            ] }),
            /* @__PURE__ */ c("div", { role: "listbox", "aria-label": "图标选择面板", style: De, children: _.glyphs.map((o) => {
              const s = ne(x)?.id === o.id;
              return /* @__PURE__ */ c(
                "button",
                {
                  type: "button",
                  role: "option",
                  "aria-selected": s,
                  title: o.codepoint ?? o.label,
                  onClick: () => G(o.id),
                  style: {
                    fontFamily: _.family,
                    minWidth: 32,
                    minHeight: 28,
                    fontSize: e.fontSizeLG,
                    cursor: "pointer",
                    borderRadius: e.borderRadiusSM,
                    border: `1px solid ${s ? e.colorPrimary : e.colorBorder}`,
                    background: s ? e.colorPrimaryBg : e.colorBgContainer,
                    color: e.colorText
                  },
                  children: o.display
                },
                o.id
              );
            }) }),
            /* @__PURE__ */ h(y, { align: "center", gap: e.marginSM, wrap: "wrap", children: [
              /* @__PURE__ */ c(I.Text, { children: "图标颜色" }),
              fn.map((o) => /* @__PURE__ */ c(
                M,
                {
                  type: S.foregroundColor === o ? "primary" : "default",
                  onClick: () => F({ foregroundColor: o }),
                  "aria-label": o,
                  style: { background: o, width: 28, height: 28, padding: 0 }
                },
                o
              ))
            ] }),
            /* @__PURE__ */ h(y, { align: "center", gap: e.marginSM, wrap: "wrap", children: [
              /* @__PURE__ */ c(I.Text, { children: "背景颜色" }),
              Me.map((o) => /* @__PURE__ */ c(
                M,
                {
                  type: S.background.id === o.id ? "primary" : "default",
                  onClick: () => F({ background: o }),
                  "aria-label": o.label,
                  title: o.label,
                  style: { background: gn(o), width: 28, height: 28, padding: 0 }
                },
                o.id
              ))
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ c(Y, { title: "高级设置", size: "small", children: /* @__PURE__ */ c(y, { vertical: !0, gap: e.marginSM, children: /* @__PURE__ */ c(
          Ve,
          {
            items: [
              {
                key: "output",
                label: "输出格式与尺寸",
                children: /* @__PURE__ */ h(y, { vertical: !0, gap: e.marginSM, children: [
                  /* @__PURE__ */ c(y, { gap: e.marginSM, wrap: "wrap", children: en.map((o) => /* @__PURE__ */ c(
                    He,
                    {
                      checked: S.formats.includes(o),
                      onChange: (s) => ve(o, s.target.checked),
                      children: o.toUpperCase()
                    },
                    o
                  )) }),
                  S.formats.length === 0 ? /* @__PURE__ */ c(I.Text, { type: "danger", children: "至少选择一种输出格式。" }) : null,
                  /* @__PURE__ */ c(
                    q,
                    {
                      value: S.outputSize,
                      onChange: (o) => F({ outputSize: Number(o) }),
                      options: Qt.map((o) => ({ label: `${o}px`, value: o }))
                    }
                  ),
                  i === "image" ? /* @__PURE__ */ h(
                    X.Group,
                    {
                      value: S.imageFit,
                      onChange: (o) => F({ imageFit: o.target.value }),
                      children: [
                        /* @__PURE__ */ c(X, { value: "fit", children: "适应（等比例缩放，空白区域显示背景）" }),
                        /* @__PURE__ */ c(X, { value: "fill", children: "填充（等比例铺满画布并居中裁剪）" })
                      ]
                    }
                  ) : /* @__PURE__ */ h(y, { vertical: !0, gap: e.marginXS, children: [
                    /* @__PURE__ */ c(I.Text, { children: "自定义图标字体" }),
                    /* @__PURE__ */ c(
                      "input",
                      {
                        ref: n,
                        type: "file",
                        accept: ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2",
                        style: { display: "none" },
                        onChange: (o) => {
                          const s = o.currentTarget.files?.[0];
                          s && ke(s), o.currentTarget.value = "";
                        }
                      }
                    ),
                    /* @__PURE__ */ c(M, { onClick: () => n.current?.click(), children: /* @__PURE__ */ h("span", { children: [
                      /* @__PURE__ */ c(pe, {}),
                      " 上传图标字体"
                    ] }) })
                  ] })
                ] })
              }
            ]
          }
        ) }) })
      ] }),
      /* @__PURE__ */ c(Y, { title: "实时预览", size: "small", style: { width: 320 }, children: /* @__PURE__ */ h(y, { vertical: !0, gap: e.marginSM, children: [
        /* @__PURE__ */ c(y, { justify: "center", align: "center", style: { minHeight: 200 }, children: /* @__PURE__ */ c(
          "canvas",
          {
            ref: r,
            "aria-label": "图标实时预览画布",
            style: {
              width: S.outputSize,
              height: S.outputSize,
              maxWidth: "100%",
              border: `1px solid ${e.colorBorderSecondary}`,
              borderRadius: e.borderRadiusLG
            }
          }
        ) }),
        /* @__PURE__ */ h(I.Text, { type: "secondary", children: [
          S.outputSize,
          " x ",
          S.outputSize,
          "px"
        ] }),
        /* @__PURE__ */ c(
          Ye,
          {
            value: N,
            placeholder: "输出目录，例如 ~/Pictures/chips-icons",
            onChange: (o) => Oe(o.target.value)
          }
        ),
        /* @__PURE__ */ c(
          M,
          {
            id: "icon-workbench-generate",
            type: "primary",
            block: !0,
            loading: k,
            disabled: P !== null || N.trim().length === 0,
            title: P ?? void 0,
            onClick: () => {
              V().catch(() => {
              });
            },
            children: k ? "正在生成" : "生成并写入目录"
          }
        ),
        P !== null ? /* @__PURE__ */ c(I.Text, { type: "secondary", children: P }) : null,
        A !== null && A.status === "failed" ? /* @__PURE__ */ c(
          he,
          {
            type: "error",
            showIcon: !0,
            message: "落盘未完成",
            description: `${A.message}（错误码：${A.errorCode}）${A.writtenPaths.length > 0 ? `已写入：${A.writtenPaths.join("、")}` : "尚未写入任何文件。"}`
          }
        ) : null,
        K !== null ? /* @__PURE__ */ c(he, { type: K.kind, showIcon: !0, message: K.text }) : null
      ] }) })
    ] })
  ] });
}, Sn = () => /* @__PURE__ */ c($e, { appId: Ce, surface: "window", children: /* @__PURE__ */ c(ze, { children: /* @__PURE__ */ c(pn, {}) }) });
export {
  Sn as AppView,
  Sn as default
};
