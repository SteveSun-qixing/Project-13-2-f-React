import { jsxs as U, jsx as s, Fragment as rt } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { useCommandRuntime as ot, theme as Ie, Button as _e, Descriptions as it, PictureOutlined as at, FileImageOutlined as Qe, Dropdown as lt, Tooltip as Xe, LeftOutlined as Je, RightOutlined as et, ReloadOutlined as st, Divider as ge, AimOutlined as ct, CheckOutlined as ut, RotateLeftOutlined as dt, RotateRightOutlined as ft, PlusOutlined as mt, MinusOutlined as ht, ColumnWidthOutlined as gt, InfoCircleOutlined as pt, ExpandOutlined as yt, SaveOutlined as bt, ChipsProvider as St, CommandProvider as It } from "chips-resource://platform/vendor/chips-ui.js";
import wt, { useState as k, useRef as M, useEffect as F, useCallback as m, useMemo as Ue } from "chips-resource://platform/vendor/react.js";
const ke = "chips.official.photo-viewer", Se = {
  openCard: "photo-viewer:open-card",
  refreshView: "photo-viewer:refresh-view"
}, Re = {
  openCard: "open-card",
  refreshView: "refresh-view"
}, Ne = [
  {
    id: Se.openCard,
    title: "打开卡片",
    description: "打开指定的卡片文件并在主窗口中展示",
    shortcut: "CommandOrControl+O",
    scope: { kind: "app", appId: ke },
    handlerId: Re.openCard,
    keywords: ["open", "card", "打开", "卡片"],
    group: "文件"
  },
  {
    id: Se.refreshView,
    title: "刷新当前视图",
    description: "重新拉取当前展示数据",
    shortcut: "F5",
    scope: { kind: "app", appId: ke },
    handlerId: Re.refreshView,
    keywords: ["refresh", "刷新"],
    group: "视图"
  }
];
new Set(Object.values(Se));
function xt(t) {
  return Ne.map((e) => {
    const r = e.handlerId ?? "";
    return {
      commandId: e.id,
      handlerId: r,
      handler: (a) => {
        t({ commandId: e.id, handlerId: r, payload: a });
      }
    };
  });
}
class ie extends Error {
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
    return new ie({
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    });
  }
}
function Ct(t) {
  if (typeof t != "object" || t === null)
    return !1;
  const e = t;
  return typeof e.code == "string" && e.code.length > 0 && typeof e.message == "string" && (e.retryable === void 0 || typeof e.retryable == "boolean");
}
const kt = "SDK_BRIDGE_UNAVAILABLE", Fe = "SDK_UNKNOWN_ERROR", Ke = "发生未知错误";
function Rt(t) {
  return t instanceof Error;
}
function Tt(t) {
  if (t instanceof ie)
    return t;
  if (Ct(t)) {
    const e = t, r = {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? !1,
      ...e.details !== void 0 ? { details: e.details } : {}
    };
    return new ie(r);
  }
  return Rt(t) ? new ie({
    code: Fe,
    message: Ke,
    details: { name: t.name, cause: t.message },
    retryable: !1
  }) : new ie({
    code: Fe,
    message: Ke,
    details: { value: String(t) },
    retryable: !1
  });
}
function Et() {
  return new ie({
    code: kt,
    message: "未找到可用的 Bridge：window.chips 尚未注入",
    retryable: !1
  });
}
function V(t, e, r) {
  let a;
  try {
    a = t();
  } catch (c) {
    return Promise.reject(Tt(c));
  }
  return a.request(e, r);
}
const vt = "cli.command.list", Ot = "cli.command.get", Pt = "cli.command.resolve";
function Lt(t) {
  return {
    list(e) {
      return V(t, vt, e ?? {});
    },
    get(e) {
      return V(t, Ot, e);
    },
    resolve(e) {
      return V(t, Pt, e);
    }
  };
}
const pe = {
  CLI_TASK_ACTIVE: "cli:task-active",
  CLI_TASK_GET: "cli:task-get",
  CLI_TASK_PROGRESS: "cli:task-progress",
  CLI_TASK_COMPLETE: "cli:task-complete",
  CLI_TASK_FAIL: "cli:task-fail"
}, Mt = "cli.task.create", At = "cli.task.bindInvocation", _t = "cli.task.cancel";
function Nt(t) {
  return {
    create(e) {
      return V(t, Mt, e).then((r) => r.task);
    },
    bindInvocation(e) {
      return V(t, At, e).then((r) => r.task);
    },
    get(e) {
      const r = { taskId: e };
      return V(t, pe.CLI_TASK_GET, r).then((a) => a.task);
    },
    active(e) {
      const r = { commandId: e };
      return V(t, pe.CLI_TASK_ACTIVE, r).then((a) => a.task);
    },
    progress(e, r) {
      const a = { taskId: e, progress: r };
      return V(t, pe.CLI_TASK_PROGRESS, a).then((c) => c.task);
    },
    complete(e, r) {
      const a = {
        taskId: e,
        ...r === void 0 ? {} : { output: r }
      };
      return V(t, pe.CLI_TASK_COMPLETE, a).then((c) => c.task);
    },
    fail(e, r) {
      const a = { taskId: e, error: r };
      return V(t, pe.CLI_TASK_FAIL, a).then((c) => c.task);
    },
    cancel(e) {
      return V(t, _t, { taskId: e }).then((r) => r.task);
    }
  };
}
function Dt() {
  return globalThis.window?.chips;
}
class zt {
  #t;
  /**
   * CLI 命令发现扩展命名空间（§3.5）。
   *
   * 只读实例成员，不是模块级值导出（§2.2 末段）；与三个方法面共用同一目标解析链路。
   */
  cliCommand = Lt(() => this.#e());
  /**
   * CLI 任务生命周期扩展命名空间（§3.5）。
   *
   * 只读实例成员；插件侧五方法经 `cli:task-active` 至 `cli:task-fail` 能力转发，
   * CLI 调度侧三方法经平台服务路由转发（§5.6、§5.8）。
   */
  cliTask = Nt(() => this.#e());
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
    const e = Dt();
    if (e === void 0)
      throw Et();
    return e;
  }
  /**
   * 唯一能力调用入口；转发给目标 Bridge。
   *
   * @param capabilityId - 能力 ID（`<domain>:<action>[:<target>]`）
   * @param input - 能力输入，校验与权限判定由平台完成
   * @returns 能力输出；目标不可用或平台调用失败时以 `ChipsError` 拒绝
   */
  request(e, r) {
    return V(() => this.#e(), e, r);
  }
  /**
   * 订阅标准事件；转发给目标 Bridge。
   *
   * @param eventId - 事件 ID
   * @param handler - 载荷回调；同一 `(eventId, handler)` 多次订阅各自独立
   * @returns 可退订句柄，`dispose()` 幂等
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  subscribe(e, r) {
    return this.#e().subscribe(e, r);
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
function Bt(t) {
  return new zt(t?.bridge);
}
const te = Bt();
function $e(t) {
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return "COMMAND_RUNTIME_ERROR";
}
function Xt(t) {
  const e = ot(), [r, a] = k("registering"), [c, l] = k(null), [g, y] = k(null), p = M(t);
  p.current = t, F(() => {
    let S = !1, b = null;
    return a("registering"), l(null), (async () => {
      try {
        for (const h of Ne)
          await te.request("command:register", { definition: h });
        if (S)
          return;
        b = e.attach(
          xt((h) => {
            y(h), p.current?.(h);
          })
        ), a("ready");
      } catch (h) {
        S || (l($e(h)), a("error"));
      }
    })(), () => {
      S = !0, b?.dispose();
      for (const h of Ne)
        te.request("command:unregister", { commandId: h.id }).catch(() => {
        });
    };
  }, [e]);
  const d = m(
    async (S, b) => {
      try {
        b === void 0 ? await e.invoke({ commandId: S, source: "api" }) : await e.invoke({ commandId: S, payload: b, source: "api" }), l(null);
      } catch (h) {
        l($e(h));
      }
    },
    [e]
  );
  return {
    phase: r,
    errorCode: c,
    lastInvoked: g,
    invokeOpenCard: (S) => d(Se.openCard, { path: S }),
    invokeRefreshView: () => d(Se.refreshView)
  };
}
const De = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg", ".avif"], Ut = De.join(" "), Ft = 0.1, Kt = 8, We = 1.25, Ve = 1;
function tt(t) {
  const e = t.trim().toLowerCase(), r = Math.max(e.lastIndexOf("/"), e.lastIndexOf("\\")), a = e.lastIndexOf(".");
  return a <= r ? "" : e.slice(a);
}
function ae(t) {
  return Number.isFinite(t) ? Math.min(Kt, Math.max(Ft, t)) : 1;
}
function $t(t, e, r = 0) {
  if (!t || !e || t.width <= 0 || t.height <= 0 || e.width <= 0 || e.height <= 0)
    return 1;
  const a = r === 90 || r === 270, c = a ? t.height : t.width, l = a ? t.width : t.height, g = e.width * Ve / c, y = e.height * Ve / l;
  let p;
  return c > l ? p = g : l > c ? p = y : p = Math.min(g, y), Math.min(ae(p), 1);
}
function ye(t, e, r) {
  const a = (c, l, g) => g <= l ? 0 : Math.min(0, Math.max(l - g, c));
  return {
    x: a(t.x, e.width, r.width),
    y: a(t.y, e.height, r.height)
  };
}
function Wt(t, e) {
  const r = ae(t);
  return ae(e === "in" ? r * We : r / We);
}
function Vt(t) {
  return t.ctrlKey || t.metaKey || t.deltaMode !== 0 ? !0 : Math.abs(t.deltaX) < 1 && Math.abs(t.deltaY) >= 24;
}
function Gt(t, e, r) {
  const a = r === 1 ? e * 14 : r === 2 ? e * 160 : e;
  return ae(t * Math.exp(-a * 2e-3));
}
function Ge(t) {
  const e = t.naturalLength * t.currentScale, r = t.naturalLength * t.nextScale, a = (t.viewportLength - e) / 2 + t.currentPan, c = (t.pointerOffset - a) / Math.max(t.currentScale, 1e-4), l = (t.viewportLength - r) / 2;
  return t.pointerOffset - c * t.nextScale - l;
}
function qe(t, e) {
  return Math.hypot(t.x - e.x, t.y - e.y);
}
function qt(t, e) {
  return {
    x: (t.x + e.x) / 2,
    y: (t.y + e.y) / 2
  };
}
function jt(t) {
  return `${Math.round(ae(t) * 100)}%`;
}
function ze(t) {
  const e = t.trim();
  if (!e)
    return "";
  const r = e.split(/[\\/]/).filter((a) => a.length > 0);
  return r[r.length - 1] ?? e;
}
function Ht(t) {
  if (!Number.isFinite(t) || t <= 0)
    return "0 B";
  if (t < 1024)
    return `${t} B`;
  const e = ["KB", "MB", "GB"];
  let r = t / 1024, a = 0;
  for (; r >= 1024 && a < e.length - 1; )
    r /= 1024, a += 1;
  const c = r >= 10 ? 0 : 1;
  return `${r.toFixed(c)} ${e[a]}`;
}
function Yt(t) {
  const { open: e, title: r, fileName: a, mimeType: c, byteSize: l, dimensions: g, position: y, onClose: p } = t, { token: d } = Ie.useToken();
  if (!e)
    return null;
  const S = l !== null ? Ht(l) : null, b = g !== null && g.width > 0 && g.height > 0 ? `${g.width} × ${g.height} 像素` : null, h = [];
  return a !== null && a.length > 0 && h.push({ key: "name", label: "名称", children: a }), r !== null && r.length > 0 && h.push({ key: "title", label: "标题", children: r }), c !== null && c.length > 0 && h.push({ key: "mime", label: "类型", children: c }), S !== null && h.push({ key: "size", label: "大小", children: S }), b !== null && h.push({ key: "dimensions", label: "尺寸", children: b }), y !== null && h.push({ key: "position", label: "队列位置", children: y }), /* @__PURE__ */ U(
    "aside",
    {
      "data-role": "info-panel",
      "aria-label": "图片信息",
      style: {
        flex: "0 0 264px",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: d.marginSM,
        padding: d.padding,
        borderLeft: `1px solid ${d.colorBorderSecondary}`,
        background: d.colorBgContainer,
        overflowY: "auto"
      },
      children: [
        /* @__PURE__ */ U("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
          /* @__PURE__ */ s("span", { style: { fontWeight: 600, fontSize: d.fontSizeLG }, children: "图片信息" }),
          /* @__PURE__ */ s(_e, { size: "small", type: "text", "aria-label": "收起信息面板", onClick: p, children: "收起" })
        ] }),
        /* @__PURE__ */ s(it, { column: 1, size: "small", items: h })
      ]
    }
  );
}
const Zt = 2, Qt = 1.9, je = 0.5, Jt = 150, en = 40, tn = 80;
function Ae(t, e) {
  return e === 1 ? t * 14 : e === 2 ? t * 160 : t;
}
function He(t, e) {
  if (e === "clockwise")
    switch (t) {
      case 0:
        return 90;
      case 90:
        return 180;
      case 180:
        return 270;
      default:
        return 0;
    }
  switch (t) {
    case 0:
      return 270;
    case 90:
      return 0;
    case 180:
      return 90;
    default:
      return 180;
  }
}
function nn(t) {
  const { imageDimensions: e, isImageLoaded: r, sessionKey: a, onNavigateRequest: c } = t, [l, g] = k("fit"), [y, p] = k(1), [d, S] = k(null), [b, h] = k({ x: 0, y: 0 }), [N, O] = k(!1), [T, X] = k(!1), [D, R] = k(0), P = M(null), x = M(null), A = M(/* @__PURE__ */ new Map()), K = M(null), z = M(null), u = M(null), I = M(null), v = M(0), ne = M({
    handleWheelEvent: () => {
    }
  }), Z = D === 90 || D === 270, G = $t(e, d, D), C = l === "fit" ? G : y, q = e ? Math.max(1, Math.round((Z ? e.height : e.width) * C)) : void 0, j = e ? Math.max(1, Math.round((Z ? e.width : e.height) * C)) : void 0, _ = q !== void 0 && j !== void 0 ? { width: q, height: j } : null, re = !!(e && r);
  let $ = b;
  if (_ && d) {
    const o = ye(b, d, _);
    $ = N ? {
      x: o.x + (b.x - o.x) * je,
      y: o.y + (b.y - o.y) * je
    } : o;
  }
  const Q = _ ? `translate(-50%, -50%) translate(${$.x}px, ${$.y}px) scale(${C})${D === 0 ? "" : ` rotate(${D}deg)`}` : void 0, W = m(() => {
    z.current !== null && (window.cancelAnimationFrame(z.current), z.current = null), u.current = null;
  }, []), J = m(() => {
    I.current !== null && (window.clearTimeout(I.current), I.current = null);
  }, []), oe = m(() => {
    x.current = null, K.current = null, A.current.clear(), W(), J(), v.current = 0, O(!1), X(!1);
  }, [W, J]), H = m((o) => {
    u.current = o, z.current === null && (z.current = window.requestAnimationFrame(() => {
      z.current = null;
      const w = u.current;
      u.current = null, w && w();
    }));
  }, []), we = m(() => {
    z.current !== null && (window.cancelAnimationFrame(z.current), z.current = null);
    const o = u.current;
    u.current = null, o && o();
  }, []), le = m(() => {
    X(!0), I.current !== null && window.clearTimeout(I.current), I.current = window.setTimeout(() => {
      I.current = null, X(!1);
    }, Jt);
  }, []), E = m(
    (o, w, i) => {
      const n = ae(o);
      e && d && h((f) => ({
        x: Ge({
          viewportLength: d.width,
          pointerOffset: w,
          naturalLength: e.width,
          currentScale: C,
          nextScale: n,
          currentPan: f.x
        }),
        y: Ge({
          viewportLength: d.height,
          pointerOffset: i,
          naturalLength: e.height,
          currentScale: C,
          nextScale: n,
          currentPan: f.y
        })
      })), g("manual"), p(n);
    },
    [C, e, d]
  ), se = m(
    (o) => {
      oe(), h({ x: 0, y: 0 }), g(o);
    },
    [oe]
  ), ce = m(() => {
    se("fit"), p(1);
  }, [se]), Ee = m(() => {
    se("manual"), p(1);
  }, [se]), ve = m(
    (o) => {
      const i = Wt(l === "fit" ? G : y, o);
      if (!d) {
        g("manual"), p(i);
        return;
      }
      E(i, d.width / 2, d.height / 2);
    },
    [E, G, y, d, l]
  ), Oe = m(
    (o) => {
      if (!e || !r)
        return;
      if (o.altKey || C >= Qt) {
        ce();
        return;
      }
      const w = o.currentTarget.getBoundingClientRect();
      E(Zt, o.clientX - w.left, o.clientY - w.top);
    },
    [E, C, e, r, ce]
  ), Pe = m(() => {
    R((o) => He(o, "clockwise"));
  }, []), Le = m(() => {
    R((o) => He(o, "counterclockwise"));
  }, []), ue = m(
    (o, w) => {
      if (!e || !r)
        return;
      if (Vt({
        deltaX: o.deltaX,
        deltaY: o.deltaY,
        deltaMode: o.deltaMode,
        ctrlKey: o.ctrlKey,
        metaKey: o.metaKey
      })) {
        o.preventDefault(), le();
        const B = w.getBoundingClientRect(), he = Gt(C, o.deltaY, o.deltaMode);
        E(he, o.clientX - B.left, o.clientY - B.top);
        return;
      }
      if (o.preventDefault(), le(), !d)
        return;
      const i = D === 90 || D === 270, n = (i ? e.height : e.width) * C, f = (i ? e.width : e.height) * C;
      if (!o.ctrlKey && !o.metaKey && !o.shiftKey && !o.altKey && n <= d.width && Math.abs(o.deltaX) >= en) {
        if (v.current += Ae(o.deltaX, o.deltaMode), Math.abs(v.current) >= tn) {
          const B = v.current > 0 ? "next" : "prev";
          v.current = 0, c?.(B);
        }
        return;
      }
      h(
        (B) => ye(
          {
            x: B.x - Ae(o.deltaX, o.deltaMode),
            y: B.y - Ae(o.deltaY, o.deltaMode)
          },
          d,
          { width: n, height: f }
        )
      );
    },
    [E, C, e, r, le, c, D, d]
  );
  ne.current = {
    handleWheelEvent: (o, w) => {
      ue(o, w);
    }
  };
  const de = m(
    (o) => {
      if (!e || !r || o.pointerType === "mouse" && o.button !== 0 || o.pointerType === "mouse" && o.detail === 2)
        return;
      if (o.currentTarget.setPointerCapture(o.pointerId), o.pointerType === "touch" && (A.current.set(o.pointerId, {
        x: o.clientX,
        y: o.clientY
      }), A.current.size === 2)) {
        const [n, f] = Array.from(A.current.values());
        if (n && f) {
          K.current = {
            pointerIds: Array.from(A.current.keys()),
            startDistance: qe(n, f),
            baseScale: C
          }, x.current = null, O(!1), X(!0);
          return;
        }
      }
      let i = b;
      _ && d && (i = ye(b, d, _), h(i)), x.current = {
        pointerId: o.pointerId,
        startX: o.clientX,
        startY: o.clientY,
        startPanX: i.x,
        startPanY: i.y
      }, O(!0), X(!0);
    },
    [_, C, e, r, b, d]
  ), fe = m(
    (o) => {
      o.pointerType === "touch" && A.current.set(o.pointerId, {
        x: o.clientX,
        y: o.clientY
      });
      const w = K.current;
      if (w && w.pointerIds.includes(o.pointerId)) {
        const n = A.current.get(w.pointerIds[0]), f = A.current.get(w.pointerIds[1]);
        if (n && f && e) {
          o.preventDefault();
          const L = qt(n, f), B = o.currentTarget.getBoundingClientRect(), he = w.baseScale * (qe(n, f) / Math.max(w.startDistance, 1));
          E(he, L.x - B.left, L.y - B.top);
          return;
        }
      }
      const i = x.current;
      !i || i.pointerId !== o.pointerId || (o.preventDefault(), H(() => {
        h({
          x: i.startPanX + (o.clientX - i.startX),
          y: i.startPanY + (o.clientY - i.startY)
        });
      }), O(!0));
    },
    [E, e, H]
  ), ee = m(
    (o) => {
      const w = x.current?.pointerId === o.pointerId;
      if (o.pointerType === "touch" && A.current.delete(o.pointerId), w && (we(), x.current = null), K.current?.pointerIds.includes(o.pointerId)) {
        K.current = null;
        const n = Array.from(A.current.entries())[0];
        if (n) {
          let f = b;
          _ && d && (f = ye(b, d, _), h(f)), x.current = {
            pointerId: n[0],
            startX: n[1].x,
            startY: n[1].y,
            startPanX: f.x,
            startPanY: f.y
          };
        }
      }
      w && _ && d && h((n) => ye(n, d, _)), O(!1), J(), !x.current && !K.current && X(!1), o.currentTarget.hasPointerCapture(o.pointerId) && o.currentTarget.releasePointerCapture(o.pointerId);
    },
    [J, _, we, b, d]
  ), me = m(
    (o) => {
      ee(o);
    },
    [ee]
  ), Me = m(
    (o) => {
      ee(o);
    },
    [ee]
  );
  return F(() => {
    const o = P.current;
    if (!o || typeof ResizeObserver != "function")
      return;
    const w = new ResizeObserver((i) => {
      const n = i[0];
      n && S({
        width: Math.max(1, n.contentRect.width),
        height: Math.max(1, n.contentRect.height)
      });
    });
    return w.observe(o), () => {
      w.disconnect();
    };
  }, [a]), F(() => {
    const o = P.current;
    if (!o)
      return;
    const w = (n) => {
      ne.current.handleWheelEvent(n, o);
    }, i = (n) => {
      const f = n.target;
      !(f instanceof Node) || !o.contains(f) || n.preventDefault();
    };
    return o.addEventListener("wheel", w, { passive: !1 }), document.addEventListener("gesturestart", i, { passive: !1 }), document.addEventListener("gesturechange", i, { passive: !1 }), document.addEventListener("gestureend", i, { passive: !1 }), () => {
      o.removeEventListener("wheel", w), document.removeEventListener("gesturestart", i), document.removeEventListener("gesturechange", i), document.removeEventListener("gestureend", i), J();
    };
  }, [a, J]), F(() => {
    oe(), h({ x: 0, y: 0 }), g("fit"), p(1), R(0);
  }, [a, oe]), F(() => {
    !r || l !== "fit" || h({ x: 0, y: 0 });
  }, [r, l, e, D]), {
    viewportRef: P,
    zoomMode: l,
    manualScale: y,
    effectiveScale: C,
    fitScale: G,
    imageWidth: q,
    imageHeight: j,
    panOffset: $,
    isPanningImage: N,
    isInteractive: re,
    isGesturing: T,
    transitionEnabled: !T,
    rotation: D,
    imageTransform: Q,
    setFitMode: ce,
    setActualSize: Ee,
    handleZoom: ve,
    handleDoubleClick: Oe,
    rotateClockwise: Pe,
    rotateCounterclockwise: Le,
    handlePointerDown: de,
    handlePointerMove: fe,
    handlePointerUp: me,
    handlePointerCancel: Me
  };
}
function rn(t) {
  const { items: e, currentIndex: r, onSelect: a, visible: c } = t, { token: l } = Ie.useToken(), g = M(null), y = M(/* @__PURE__ */ new Map());
  return F(() => {
    const p = g.current, d = y.current.get(r);
    if (!p || !d || typeof p.scrollTo != "function")
      return;
    const S = window.matchMedia("(prefers-reduced-motion: reduce)").matches, b = d.offsetLeft + d.offsetWidth / 2 - p.clientWidth / 2;
    p.scrollTo({ left: b, behavior: S ? "auto" : "smooth" });
  }, [r, e.length]), !c || e.length <= 1 ? /* @__PURE__ */ s(wt.Fragment, {}) : /* @__PURE__ */ s(
    "div",
    {
      "data-role": "filmstrip",
      ref: g,
      "aria-label": "图片队列",
      style: {
        position: "absolute",
        left: "50%",
        bottom: 76,
        transform: "translateX(-50%)",
        maxWidth: "calc(100% - 32px)",
        display: "flex",
        gap: l.marginXS,
        padding: l.paddingXXS,
        overflowX: "auto",
        overflowY: "hidden",
        borderRadius: l.borderRadiusLG,
        border: `1px solid ${l.colorBorderSecondary}`,
        background: l.colorBgElevated,
        boxShadow: l.boxShadowSecondary
      },
      children: e.map((p, d) => {
        const S = d === r;
        return /* @__PURE__ */ s(
          "button",
          {
            "data-role": "filmstrip-item",
            ref: (b) => {
              y.current.set(d, b);
            },
            type: "button",
            "aria-label": p.fileName,
            "aria-current": S ? "true" : void 0,
            onClick: () => {
              a(d);
            },
            style: {
              flex: "0 0 auto",
              width: 64,
              height: 44,
              display: "grid",
              placeItems: "center",
              padding: 2,
              cursor: "pointer",
              borderRadius: l.borderRadiusSM,
              border: `2px solid ${S ? l.colorPrimary : "transparent"}`,
              background: l.colorFillQuaternary,
              overflow: "hidden"
            },
            children: p.thumbSrc !== null ? /* @__PURE__ */ s(
              "img",
              {
                src: p.thumbSrc,
                alt: "",
                decoding: "async",
                draggable: !1,
                style: {
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  pointerEvents: "none"
                }
              }
            ) : /* @__PURE__ */ s("span", { "aria-hidden": "true", style: { color: l.colorTextSecondary, display: "grid" }, children: /* @__PURE__ */ s(at, {}) })
          },
          p.uri
        );
      })
    }
  );
}
const on = "transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)";
function Ye(t) {
  return {
    width: 40,
    height: 40,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    border: `1px solid ${t.colorBorderSecondary}`,
    background: t.colorBgElevated,
    color: t.colorText,
    cursor: "pointer",
    boxShadow: t.boxShadowTertiary
  };
}
function an(t) {
  const {
    currentImage: e,
    currentSrc: r,
    loadStatus: a,
    dimensions: c,
    isImageLoaded: l,
    bridgeReady: g,
    queueLength: y,
    hasPrevious: p,
    hasNext: d,
    filmstripItems: S,
    filmstripIndex: b,
    filmstripVisible: h,
    chromeVisible: N,
    feedback: O,
    registerCameraActions: T,
    onNavigate: X,
    onFilmstripSelect: D,
    onRetry: R,
    onOpenRequest: P,
    onSaveCopy: x,
    onImageLoad: A,
    onImageError: K,
    onPointerActivity: z
  } = t, { token: u } = Ie.useToken(), I = nn({
    imageDimensions: c,
    isImageLoaded: l,
    sessionKey: e?.uri ?? null,
    onNavigateRequest: X
  }), v = M(I);
  v.current = I, F(() => (T({
    zoomIn: () => v.current.handleZoom("in"),
    zoomOut: () => v.current.handleZoom("out"),
    fitToWindow: () => v.current.setFitMode(),
    actualSize: () => v.current.setActualSize(),
    rotateClockwise: () => v.current.rotateClockwise(),
    rotateCounterclockwise: () => v.current.rotateCounterclockwise()
  }), () => T(null)), [T]);
  const ne = I.rotation === 90 || I.rotation === 270, Z = c ? ne ? c.height : c.width : void 0, G = c ? ne ? c.width : c.height : void 0, C = Ue(() => {
    if (!(Z === void 0 || G === void 0 || I.imageTransform === void 0))
      return {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${Z}px`,
        height: `${G}px`,
        display: "grid",
        placeItems: "center",
        transform: I.imageTransform,
        transition: I.transitionEnabled ? on : "none",
        willChange: "transform"
      };
  }, [I.imageTransform, I.transitionEnabled, G, Z]), q = jt(I.effectiveScale), j = e !== null && l ? `${e.fileName}，${q}` : "图片查看视口", _ = Ue(
    () => [
      { key: "zoom-in", label: "放大", disabled: !l, onClick: () => v.current.handleZoom("in") },
      { key: "zoom-out", label: "缩小", disabled: !l, onClick: () => v.current.handleZoom("out") },
      { key: "fit", label: "适应窗口", disabled: !l, onClick: () => v.current.setFitMode() },
      { key: "actual", label: "实际大小", disabled: !l, onClick: () => v.current.setActualSize() },
      { type: "divider" },
      {
        key: "rotate-cw",
        label: "顺时针旋转",
        disabled: !l,
        onClick: () => v.current.rotateClockwise()
      },
      {
        key: "rotate-ccw",
        label: "逆时针旋转",
        disabled: !l,
        onClick: () => v.current.rotateCounterclockwise()
      },
      { type: "divider" },
      { key: "open", label: "打开图片", onClick: P },
      { key: "save-copy", label: "保存副本", disabled: e === null, onClick: x }
    ],
    [e, l, P, x]
  ), re = g ? "等待资源打开链路投递图片，或从本地选择一张图片开始查看。" : "窗口桥接未就绪，暂时无法接收图片投递；通道就绪前此提示如实保留。";
  return /* @__PURE__ */ U(
    "div",
    {
      "data-role": "photo-stage",
      style: {
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: u.colorBgLayout
      },
      onPointerMove: z,
      children: [
        e === null ? /* @__PURE__ */ U(
          "div",
          {
            "data-role": "photo-empty",
            style: {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: u.marginSM,
              padding: u.paddingXL,
              textAlign: "center"
            },
            children: [
              /* @__PURE__ */ s("span", { "aria-hidden": "true", style: { fontSize: 48, color: u.colorTextSecondary, display: "grid" }, children: /* @__PURE__ */ s(Qe, {}) }),
              /* @__PURE__ */ s("h2", { "data-role": "photo-empty-title", style: { margin: 0, fontSize: u.fontSizeXL }, children: "未打开图片" }),
              /* @__PURE__ */ s("p", { style: { margin: 0, color: u.colorTextSecondary }, children: re }),
              /* @__PURE__ */ U("p", { style: { margin: 0, color: u.colorTextSecondary, fontSize: u.fontSizeSM }, children: [
                "支持格式：",
                Ut
              ] }),
              /* @__PURE__ */ s("p", { style: { margin: 0, color: u.colorTextSecondary, fontSize: u.fontSizeSM }, children: "快捷键：Ctrl / ⌘ + O 打开图片" }),
              /* @__PURE__ */ s(
                "button",
                {
                  type: "button",
                  "data-role": "empty-open",
                  onClick: P,
                  style: {
                    marginTop: u.marginXXS,
                    padding: `${u.paddingXXS}px ${u.paddingLG}px`,
                    borderRadius: u.borderRadius,
                    border: `1px solid ${u.colorPrimary}`,
                    background: u.colorPrimary,
                    color: u.colorWhite,
                    fontSize: u.fontSize,
                    cursor: "pointer"
                  },
                  children: "打开图片"
                }
              )
            ]
          }
        ) : /* @__PURE__ */ s(lt, { trigger: ["contextMenu"], menu: { items: _ ?? [] }, children: /* @__PURE__ */ U(
          "div",
          {
            "data-role": "photo-viewport",
            ref: I.viewportRef,
            role: "group",
            "aria-label": j,
            tabIndex: 0,
            onPointerDown: I.handlePointerDown,
            onPointerMove: I.handlePointerMove,
            onPointerUp: I.handlePointerUp,
            onPointerCancel: I.handlePointerCancel,
            onDoubleClick: I.handleDoubleClick,
            style: {
              position: "relative",
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              touchAction: "none",
              overscrollBehavior: "none",
              cursor: I.isPanningImage ? "grabbing" : I.isInteractive ? "grab" : "default",
              outline: "none"
            },
            children: [
              /* @__PURE__ */ s("div", { style: C ?? { position: "absolute", left: "50%", top: "50%" }, children: r !== null ? /* @__PURE__ */ s(
                "img",
                {
                  "data-role": "stage-image",
                  src: r,
                  alt: e.fileName,
                  draggable: !1,
                  decoding: "async",
                  onLoad: ($) => {
                    A({
                      width: $.currentTarget.naturalWidth || $.currentTarget.width,
                      height: $.currentTarget.naturalHeight || $.currentTarget.height
                    });
                  },
                  onError: K,
                  style: {
                    display: "block",
                    width: "100%",
                    height: "100%",
                    maxWidth: "none",
                    maxHeight: "none",
                    objectFit: "contain",
                    userSelect: "none",
                    pointerEvents: "none"
                  }
                },
                e.uri
              ) : null }),
              N && y > 1 ? /* @__PURE__ */ U(rt, { children: [
                /* @__PURE__ */ s(Xe, { title: p ? "上一张" : "当前已经是第一张图片", children: /* @__PURE__ */ s("span", { style: { position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }, children: /* @__PURE__ */ s(
                  "button",
                  {
                    type: "button",
                    "aria-label": "上一张",
                    disabled: !p,
                    onClick: () => X("prev"),
                    style: Ye(u),
                    children: /* @__PURE__ */ s(Je, {})
                  }
                ) }) }),
                /* @__PURE__ */ s(Xe, { title: d ? "下一张" : "当前已经是最后一张图片", children: /* @__PURE__ */ s("span", { style: { position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }, children: /* @__PURE__ */ s(
                  "button",
                  {
                    type: "button",
                    "aria-label": "下一张",
                    disabled: !d,
                    onClick: () => X("next"),
                    style: Ye(u),
                    children: /* @__PURE__ */ s(et, {})
                  }
                ) }) })
              ] }) : null,
              N && l ? /* @__PURE__ */ s(
                "button",
                {
                  type: "button",
                  "data-role": "zoom-badge",
                  title: "点击恢复适应窗口",
                  onClick: () => I.setFitMode(),
                  style: {
                    position: "absolute",
                    left: 16,
                    bottom: 76,
                    padding: `${u.paddingXXS}px ${u.paddingSM}px`,
                    borderRadius: u.borderRadiusSM,
                    border: `1px solid ${u.colorBorderSecondary}`,
                    background: u.colorBgElevated,
                    color: u.colorText,
                    fontSize: u.fontSizeSM,
                    cursor: "pointer"
                  },
                  children: q
                }
              ) : null,
              N ? /* @__PURE__ */ s(
                rn,
                {
                  items: S,
                  currentIndex: b,
                  onSelect: D,
                  visible: h
                }
              ) : null,
              a.state === "loading" ? /* @__PURE__ */ s(
                "div",
                {
                  role: "status",
                  style: {
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    background: u.colorBgMask,
                    color: u.colorText
                  },
                  children: /* @__PURE__ */ U("span", { style: { display: "inline-flex", alignItems: "center", gap: u.marginXS }, children: [
                    /* @__PURE__ */ s(st, { spin: !0 }),
                    "正在读取图片…"
                  ] })
                }
              ) : null
            ]
          }
        ) }),
        O !== null ? /* @__PURE__ */ U(
          "div",
          {
            "data-role": "photo-feedback",
            role: O.tone === "error" ? "alert" : "status",
            "aria-live": O.tone === "error" ? "assertive" : "polite",
            style: {
              position: "absolute",
              left: "50%",
              bottom: 76,
              transform: "translateX(-50%)",
              zIndex: 2,
              maxWidth: "calc(100% - 32px)",
              display: "flex",
              alignItems: "center",
              gap: u.marginXS,
              padding: `${u.paddingXXS}px ${u.paddingSM}px`,
              borderRadius: u.borderRadiusSM,
              border: `1px solid ${O.tone === "error" ? u.colorErrorBorder : u.colorBorderSecondary}`,
              background: u.colorBgElevated,
              color: O.tone === "error" ? u.colorError : u.colorText,
              boxShadow: u.boxShadowSecondary
            },
            children: [
              /* @__PURE__ */ s("span", { children: O.message }),
              R !== null && O.tone === "error" ? /* @__PURE__ */ s(
                "button",
                {
                  type: "button",
                  "data-role": "feedback-retry",
                  onClick: R,
                  style: {
                    border: "none",
                    background: "transparent",
                    color: u.colorPrimary,
                    cursor: "pointer",
                    fontSize: u.fontSizeSM,
                    padding: 0
                  },
                  children: "重试"
                }
              ) : null
            ]
          }
        ) : null
      ]
    }
  );
}
function ln(t) {
  const {
    fileName: e,
    position: r,
    hasCurrent: a,
    canPrevious: c,
    canNext: l,
    hasQueue: g,
    filmstripVisible: y,
    infoPanelOpen: p,
    immersive: d,
    cameraActionsRef: S,
    onPrevious: b,
    onNext: h,
    onOpenRequest: N,
    onSaveCopy: O,
    onToggleFilmstrip: T,
    onToggleInfoPanel: X,
    onToggleImmersive: D
  } = t, { token: R } = Ie.useToken(), P = a ? null : "当前没有已加载图片", x = (A, K, z, u, I) => /* @__PURE__ */ s(
    _e,
    {
      "aria-label": A,
      title: z ?? K,
      type: "text",
      disabled: z !== null,
      onClick: u,
      icon: I
    }
  );
  return /* @__PURE__ */ U(
    "div",
    {
      "data-role": "viewer-dock",
      role: "toolbar",
      "aria-label": "图片查看器工具栏",
      style: {
        position: "absolute",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        zIndex: 3,
        maxWidth: "calc(100% - 32px)",
        display: "flex",
        alignItems: "center",
        gap: R.marginXXS,
        padding: `${R.paddingXXS}px ${R.paddingSM}px`,
        overflowX: "auto",
        overflowY: "hidden",
        borderRadius: R.borderRadiusLG,
        border: `1px solid ${R.colorBorderSecondary}`,
        background: R.colorBgElevated,
        boxShadow: R.boxShadowSecondary
      },
      children: [
        x(
          "上一张",
          "上一张",
          g ? c ? null : "当前已经是第一张图片" : "没有图片队列",
          b,
          /* @__PURE__ */ s(Je, {})
        ),
        x(
          "下一张",
          "下一张",
          g ? l ? null : "当前已经是最后一张图片" : "没有图片队列",
          h,
          /* @__PURE__ */ s(et, {})
        ),
        /* @__PURE__ */ s(ge, { type: "vertical", style: { height: 20 } }),
        /* @__PURE__ */ s(_e, { "aria-label": "打开图片", title: "打开图片（Ctrl / ⌘ + O）", type: "text", onClick: N, icon: /* @__PURE__ */ s(Qe, {}) }),
        /* @__PURE__ */ s(ge, { type: "vertical", style: { height: 20 } }),
        /* @__PURE__ */ s(
          "span",
          {
            "data-role": "dock-title",
            title: e ?? void 0,
            style: {
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: R.colorText,
              fontSize: R.fontSizeSM
            },
            children: e ?? "未打开图片"
          }
        ),
        r !== null ? /* @__PURE__ */ s(
          "span",
          {
            "data-role": "dock-position",
            style: { color: R.colorTextSecondary, fontSize: R.fontSizeSM, whiteSpace: "nowrap" },
            children: r
          }
        ) : null,
        /* @__PURE__ */ s(ge, { type: "vertical", style: { height: 20 } }),
        x("适应窗口", "适应窗口（0）", P, () => S.current?.fitToWindow(), /* @__PURE__ */ s(ct, {})),
        x("实际大小", "实际大小（1）", P, () => S.current?.actualSize(), /* @__PURE__ */ s(ut, {})),
        x("逆时针旋转", "逆时针旋转", P, () => S.current?.rotateCounterclockwise(), /* @__PURE__ */ s(dt, {})),
        x("顺时针旋转", "顺时针旋转", P, () => S.current?.rotateClockwise(), /* @__PURE__ */ s(ft, {})),
        /* @__PURE__ */ s(ge, { type: "vertical", style: { height: 20 } }),
        x("放大", "放大（+）", P, () => S.current?.zoomIn(), /* @__PURE__ */ s(mt, {})),
        x("缩小", "缩小（-）", P, () => S.current?.zoomOut(), /* @__PURE__ */ s(ht, {})),
        x(
          "胶片条",
          y ? "隐藏胶片条" : "显示胶片条",
          g ? null : "没有图片队列",
          T,
          /* @__PURE__ */ s(gt, {})
        ),
        x("信息面板", p ? "收起信息面板" : "查看图片信息", P, X, /* @__PURE__ */ s(pt, {})),
        x("沉浸模式", d ? "退出沉浸模式（F）" : "进入沉浸模式（F）", P, D, /* @__PURE__ */ s(yt, {})),
        /* @__PURE__ */ s(ge, { type: "vertical", style: { height: 20 } }),
        x("保存副本", "保存副本（Ctrl / ⌘ + S）", P, O, /* @__PURE__ */ s(bt, {}))
      ]
    }
  );
}
const sn = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif"
};
function Te(t) {
  return sn[tt(t)];
}
const Ze = De;
function Y(t) {
  return typeof t == "string" && t.trim().length > 0 ? t.trim() : void 0;
}
function Ce(t) {
  return t !== null && typeof t == "object" && !Array.isArray(t) ? t : null;
}
function cn(t) {
  const e = Ce(t);
  if (e === null)
    return null;
  const r = Y(e.version);
  if (e.kind !== "chips.book-card" || r === void 0 || !/^1\./.test(r) || e.cardType !== "base.book" || e.mode !== "image-sequence")
    return null;
  const c = Ce(e.resources)?.images;
  if (!Array.isArray(c) || c.length === 0)
    return null;
  const l = Ce(e.display), g = Y(l?.title);
  return {
    images: c,
    ...g === void 0 ? {} : { title: g }
  };
}
function un(t) {
  const e = Ce(t), r = Y(e?.uri);
  if (r === void 0)
    return null;
  const a = Y(e?.mimeType) ?? Te(r), c = Y(e?.fileName) ?? ze(r), l = Y(e?.relativePath);
  return {
    uri: r,
    fileName: c.length > 0 ? c : r,
    ...a === void 0 ? {} : { mimeType: a },
    ...l === void 0 ? {} : { relativePath: l }
  };
}
function dn(t) {
  const e = t.uri.trim();
  if (e.length === 0)
    return null;
  const r = cn(t.payload);
  if (r !== null) {
    const g = r.images.map(un).filter((y) => y !== null);
    if (g.length > 0) {
      const y = g.findIndex((d) => d.uri === e), p = r.title;
      return {
        images: g,
        initialIndex: y >= 0 ? y : 0,
        ...p === void 0 ? {} : { title: p }
      };
    }
  }
  const a = Y(t.mimeType) ?? Te(e), c = Y(t.fileName) ?? ze(e), l = Y(t.title);
  return {
    images: [
      {
        uri: e,
        fileName: c.length > 0 ? c : e,
        ...a === void 0 ? {} : { mimeType: a },
        ...l === void 0 ? {} : { title: l }
      }
    ],
    initialIndex: 0,
    ...l === void 0 ? {} : { title: l }
  };
}
const fn = 2400, mn = 2e3;
function be(t) {
  if (typeof t == "object" && t !== null && "code" in t) {
    const e = t.code;
    if (typeof e == "string" && e.length > 0)
      return e;
  }
  return "UNKNOWN";
}
function xe(t) {
  return /^https?:/i.test(t.trim());
}
function hn(t) {
  let e = "";
  for (let a = 0; a < t.length; a += 32768) {
    const c = t.subarray(a, a + 32768);
    e += String.fromCharCode(...c);
  }
  return btoa(e);
}
async function gn(t) {
  try {
    return await t.read();
  } catch (e) {
    if (be(e) !== "RESOURCE_TOO_LARGE")
      throw e;
    const r = t.stream().getReader(), a = [];
    let c = 0;
    for (; ; ) {
      const { done: y, value: p } = await r.read();
      if (y)
        break;
      p && (a.push(p), c += p.byteLength);
    }
    const l = new Uint8Array(c);
    let g = 0;
    for (const y of a)
      l.set(y, g), g += y.byteLength;
    return l;
  }
}
function pn(t) {
  if (typeof t != "object" || t === null)
    return null;
  const e = t;
  if (e.pluginId !== ke)
    return null;
  const r = e.context;
  if (typeof r != "object" || r === null)
    return null;
  const a = r;
  return typeof a.uri != "string" || a.uri.trim().length === 0 ? null : r;
}
function yn() {
  const [t, e] = k(null), [r, a] = k(0), [c, l] = k(null), [g, y] = k({ state: "idle", message: null }), [p, d] = k(null), [S, b] = k(!1), [h, N] = k(null), [O, T] = k(null), [X, D] = k(!1), [R, P] = k(!1), [x, A] = k(!1), [K, z] = k(!0), [u, I] = k(!1), [v, ne] = k(0), [Z, G] = k(0), C = M(/* @__PURE__ */ new Map()), q = M(null), j = M(null), _ = M(0), re = M(null), $ = M(!1), Q = M(null), W = t !== null && r >= 0 && r < t.images.length ? t.images[r] ?? null : null;
  re.current = W, j.current = t, _.current = r, $.current = S;
  const J = m((i) => {
    q.current = i;
  }, []), oe = m((i) => {
    const n = dn(i);
    if (n === null) {
      T({ tone: "error", message: "打开投递缺少可读取的资源入口" });
      return;
    }
    e(n), a(n.initialIndex);
  }, []);
  F(() => {
    let i = !1, n = null;
    try {
      n = te.subscribe("resource:opened", (f) => {
        if (i)
          return;
        const L = pn(f);
        L !== null && oe(L);
      }), i || D(!0);
    } catch {
      i || D(!1);
    }
    return () => {
      i = !0, n?.dispose();
    };
  }, [oe]), F(() => {
    const i = C.current;
    return () => {
      for (const n of i.values())
        URL.revokeObjectURL(n.url);
      i.clear(), Q.current !== null && window.clearTimeout(Q.current);
    };
  }, []);
  const H = m(async (i) => {
    const n = C.current.get(i);
    if (n !== void 0)
      return n;
    const f = te.resource(i);
    try {
      const L = await gn(f), B = Te(i), he = new Blob([L], { type: B ?? "application/octet-stream" }), Be = { url: URL.createObjectURL(he), bytes: L };
      return C.current.set(i, Be), G((nt) => nt + 1), Be;
    } finally {
      f.release();
    }
  }, []), we = m((i) => C.current.get(i)?.url ?? null, []), le = m(async (i) => {
    const n = await fetch(i);
    if (!n.ok)
      throw Object.assign(new Error(`远程图片响应异常：HTTP ${n.status}`), { code: "REMOTE_HTTP_ERROR" });
    const f = await n.arrayBuffer();
    return new Uint8Array(f);
  }, []);
  F(() => {
    if (!W) {
      l(null), y({ state: "idle", message: null }), d(null), b(!1), N(null);
      return;
    }
    const i = tt(W.uri);
    if (i.length > 0 && !De.includes(i)) {
      l(null), b(!1), N(null), y({ state: "error", message: `暂不支持预览 ${i} 格式：该格式由万能文件查看器兜底` }), T({ tone: "error", message: `暂不支持预览 ${i} 格式：该格式由万能文件查看器兜底` });
      return;
    }
    if (xe(W.uri)) {
      l(W.uri), N(null), b(!1), y({ state: "loading", message: null });
      return;
    }
    let n = !1;
    return b(!1), d(null), y({ state: "loading", message: null }), H(W.uri).then((f) => {
      n || (l(f.url), N(f.bytes.byteLength));
    }).catch((f) => {
      if (n)
        return;
      l(null), N(null);
      const L = `图片资源读取失败（${be(f)}）`;
      y({ state: "error", message: L }), T({ tone: "error", message: L });
    }), () => {
      n = !0;
    };
  }, [W, H, v]), F(() => {
    if (!(!t || t.images.length <= 1))
      for (const i of [r - 1, r + 1]) {
        if (i < 0 || i >= t.images.length)
          continue;
        const n = t.images[i];
        !n || xe(n.uri) || C.current.has(n.uri) || H(n.uri).catch(() => {
        });
      }
  }, [t, r, H]);
  const E = m((i) => {
    const n = j.current;
    if (!n || n.images.length === 0)
      return;
    const f = Math.min(n.images.length - 1, Math.max(0, i));
    a(f);
  }, []), se = m(() => {
    E(_.current - 1);
  }, [E]), ce = m(() => {
    E(_.current + 1);
  }, [E]), Ee = m(() => {
    E(0);
  }, [E]), ve = m(() => {
    const i = j.current;
    i && E(i.images.length - 1);
  }, [E]), Oe = m(() => {
    const i = re.current;
    if (!i || xe(i.uri))
      return;
    const n = C.current.get(i.uri);
    n !== void 0 && (URL.revokeObjectURL(n.url), C.current.delete(i.uri)), ne((f) => f + 1);
  }, []), Pe = m((i) => {
    d(i), b(!0), y({ state: "loaded", message: null }), T((n) => n !== null && n.tone === "error" ? null : n);
  }, []), Le = m(() => {
    b(!1);
    const i = "图片解码失败：文件可能已损坏或格式不受支持";
    y({ state: "error", message: i }), T({ tone: "error", message: i });
  }, []), ue = m(async (i) => {
    T({ tone: "info", message: "正在请求打开图片…" });
    try {
      const n = Te(i), f = ze(i);
      await te.request("resource:open", {
        intent: "view",
        resource: {
          uri: i,
          ...n === void 0 ? {} : { mimeType: n },
          ...f.length > 0 ? { fileName: f } : {}
        }
      }), T({ tone: "info", message: "已提交打开请求，等待系统路由投递" });
    } catch (n) {
      T({ tone: "error", message: `图片暂时无法打开：资源打开通道未就绪（${be(n)}）` });
    }
  }, []), de = m(async () => {
    let i;
    try {
      i = await te.request("dialog:open", {
        title: "选择图片",
        multiple: !1,
        filters: [{ name: "图片", extensions: [...Ze] }]
      });
    } catch (f) {
      T({ tone: "error", message: `图片暂时无法打开：资源打开通道未就绪（${be(f)}）` });
      return;
    }
    if (i.canceled)
      return;
    const n = i.paths[0];
    n === void 0 || n.trim().length === 0 || await ue(n.trim());
  }, [ue]), fe = m(async () => {
    const i = re.current;
    if (!i) {
      T({ tone: "error", message: "当前没有已加载的图片" });
      return;
    }
    try {
      const n = await te.request("dialog:save", {
        title: "保存图片副本",
        defaultPath: i.fileName,
        filters: [{ name: "图片", extensions: [...Ze] }]
      });
      if (n.canceled || n.path === null) {
        T({ tone: "info", message: "已取消保存副本" });
        return;
      }
      const f = C.current.get(i.uri), L = f !== void 0 ? f.bytes : xe(i.uri) ? await le(i.uri) : (await H(i.uri)).bytes;
      await te.request("file:write", { path: n.path, data: hn(L), encoding: "base64" }), T({ tone: "success", message: "图片副本已保存" });
    } catch (n) {
      T({ tone: "error", message: `暂时无法保存副本（${be(n)}）` });
    }
  }, [H, le]), ee = m(() => {
    A(!0), Q.current !== null && window.clearTimeout(Q.current), Q.current = window.setTimeout(() => {
      Q.current = null, A(!1);
    }, mn);
  }, []), me = m(() => {
    P((i) => !i), A(!1);
  }, []), Me = m(() => {
    z((i) => !i);
  }, []), o = m(() => {
    I((i) => !i);
  }, []);
  F(() => {
    const i = (n) => {
      if (n.isComposing || n.defaultPrevented)
        return;
      if (n.key === "Escape") {
        R ? (P(!1), A(!1)) : u && I(!1);
        return;
      }
      const f = n.metaKey || n.ctrlKey;
      if (f && !n.altKey && (n.key === "o" || n.key === "O")) {
        n.preventDefault(), de();
        return;
      }
      if (f && !n.altKey && (n.key === "s" || n.key === "S")) {
        n.preventDefault(), fe();
        return;
      }
      R && ee();
      const L = q.current;
      if ($.current && L !== null) {
        if (n.key === "+" || n.key === "=") {
          L.zoomIn();
          return;
        }
        if (n.key === "-") {
          L.zoomOut();
          return;
        }
        if (n.key === "0") {
          L.fitToWindow();
          return;
        }
        if (n.key === "1") {
          L.actualSize();
          return;
        }
      }
      if (n.key === "f" || n.key === "F") {
        me();
        return;
      }
      const B = j.current?.images.length ?? 0;
      if (!(B <= 1)) {
        if (n.key === "ArrowLeft") {
          n.preventDefault(), E(_.current - 1);
          return;
        }
        if (n.key === "ArrowRight") {
          n.preventDefault(), E(_.current + 1);
          return;
        }
        if (n.key === "Home") {
          n.preventDefault(), E(0);
          return;
        }
        n.key === "End" && (n.preventDefault(), E(B - 1));
      }
    };
    return window.addEventListener("keydown", i), () => {
      window.removeEventListener("keydown", i);
    };
  }, [E, R, u, de, ee, fe, me]), F(() => {
    if (!O || O.tone === "error")
      return;
    const i = window.setTimeout(() => {
      T((n) => n !== null && n.tone !== "error" ? null : n);
    }, fn);
    return () => {
      window.clearTimeout(i);
    };
  }, [O]);
  const w = t !== null ? t.title ?? W?.fileName ?? null : null;
  return {
    queue: t,
    queueTitle: w,
    currentIndex: r,
    currentImage: W,
    currentSrc: c,
    loadStatus: g,
    dimensions: p,
    isImageLoaded: S,
    byteSize: h,
    feedback: O,
    bridgeReady: X,
    immersive: R,
    chromeVisible: !R || x,
    filmstripVisible: K,
    infoPanelOpen: u,
    registerCameraActions: J,
    cameraActionsRef: q,
    goTo: E,
    previous: se,
    next: ce,
    first: Ee,
    last: ve,
    reloadCurrent: Oe,
    handleImageLoad: Pe,
    handleImageError: Le,
    openImageFile: de,
    saveCopy: fe,
    requestOpenResource: ue,
    toggleImmersive: me,
    toggleFilmstrip: Me,
    toggleInfoPanel: o,
    getThumbUrl: we,
    thumbVersion: Z,
    notifyPointerActivity: ee
  };
}
const bn = ke;
function Sn(t) {
  if (typeof t != "object" || t === null)
    return null;
  const e = t.path;
  return typeof e == "string" && e.trim().length > 0 ? e.trim() : null;
}
const In = () => {
  const { token: t } = Ie.useToken(), e = yn(), r = m(
    (h) => {
      if (h.handlerId === Re.refreshView) {
        e.reloadCurrent();
        return;
      }
      if (h.handlerId === Re.openCard) {
        const N = Sn(h.payload);
        N !== null && e.requestOpenResource(N);
      }
    },
    [e]
  ), a = Xt(r), c = (e.queue?.images ?? []).map((h) => ({
    uri: h.uri,
    fileName: h.fileName,
    thumbSrc: e.getThumbUrl(h.uri)
  })), l = e.queue?.images.length ?? 0, g = l > 0 ? `${e.currentIndex + 1} / ${l}` : null, y = e.currentIndex > 0, p = e.currentIndex >= 0 && e.currentIndex < l - 1, d = m(() => {
    e.openImageFile();
  }, [e]), S = m(() => {
    e.saveCopy();
  }, [e]), b = m(
    (h) => {
      h === "prev" ? e.previous() : e.next();
    },
    [e]
  );
  return /* @__PURE__ */ U(
    "div",
    {
      style: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        background: t.colorBgLayout
      },
      children: [
        a.phase === "error" ? /* @__PURE__ */ U(
          "div",
          {
            "data-role": "command-status",
            role: "alert",
            style: {
              display: "flex",
              alignItems: "center",
              gap: t.marginXS,
              padding: `${t.paddingXXS}px ${t.paddingSM}px`,
              background: t.colorWarningBg,
              color: t.colorWarningText,
              fontSize: t.fontSizeSM
            },
            children: [
              "命令通道异常（",
              a.errorCode ?? "COMMAND_RUNTIME_ERROR",
              "）：命令注册未完成，界面功能不受影响"
            ]
          }
        ) : null,
        /* @__PURE__ */ U("div", { style: { position: "relative", display: "flex", flex: 1, minHeight: 0 }, children: [
          /* @__PURE__ */ U("div", { style: { position: "relative", flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ s(
              an,
              {
                currentImage: e.currentImage,
                currentSrc: e.currentSrc,
                loadStatus: e.loadStatus,
                dimensions: e.dimensions,
                isImageLoaded: e.isImageLoaded,
                bridgeReady: e.bridgeReady,
                queueLength: l,
                hasPrevious: y,
                hasNext: p,
                filmstripItems: c,
                filmstripIndex: e.currentIndex,
                filmstripVisible: e.filmstripVisible,
                chromeVisible: e.chromeVisible,
                feedback: e.feedback,
                registerCameraActions: e.registerCameraActions,
                onNavigate: b,
                onFilmstripSelect: e.goTo,
                onRetry: e.loadStatus.state === "error" ? e.reloadCurrent : null,
                onOpenRequest: d,
                onSaveCopy: S,
                onImageLoad: e.handleImageLoad,
                onImageError: e.handleImageError,
                onPointerActivity: e.notifyPointerActivity
              }
            ),
            e.chromeVisible ? /* @__PURE__ */ s(
              ln,
              {
                fileName: e.queueTitle ?? e.currentImage?.fileName ?? null,
                position: g,
                hasCurrent: e.currentImage !== null,
                isImageLoaded: e.isImageLoaded,
                canPrevious: y,
                canNext: p,
                hasQueue: l > 0,
                filmstripVisible: e.filmstripVisible,
                infoPanelOpen: e.infoPanelOpen,
                immersive: e.immersive,
                cameraActionsRef: e.cameraActionsRef,
                onPrevious: e.previous,
                onNext: e.next,
                onOpenRequest: d,
                onSaveCopy: S,
                onToggleFilmstrip: e.toggleFilmstrip,
                onToggleInfoPanel: e.toggleInfoPanel,
                onToggleImmersive: e.toggleImmersive
              }
            ) : null
          ] }),
          /* @__PURE__ */ s(
            Yt,
            {
              open: e.infoPanelOpen && e.currentImage !== null,
              title: e.currentImage?.title ?? null,
              fileName: e.currentImage?.fileName ?? null,
              mimeType: e.currentImage?.mimeType ?? null,
              byteSize: e.byteSize,
              dimensions: e.dimensions,
              position: g,
              onClose: e.toggleInfoPanel
            }
          )
        ] })
      ]
    }
  );
}, kn = () => /* @__PURE__ */ s(St, { appId: bn, surface: "window", children: /* @__PURE__ */ s(It, { children: /* @__PURE__ */ s(In, {}) }) });
export {
  kn as AppView,
  kn as default
};
