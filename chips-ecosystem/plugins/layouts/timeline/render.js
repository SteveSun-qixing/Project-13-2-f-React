import { jsx as o, jsxs as m } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import y, { useCallback as T, useMemo as L } from "chips-resource://platform/vendor/react.js";
import { flushSync as Z } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as K } from "chips-resource://platform/vendor/react-dom-client.js";
import { theme as I, LayoutSkeleton as se, SkeletonDot as ae, SkeletonBlock as le, SkeletonLine as H, EmptyHint as de, Form as E, Segmented as N, Switch as ce, Button as O, Input as C, Select as Y, EmbeddedDocumentFrame as z } from "chips-resource://platform/vendor/chips-ui.js";
const R = {
  orientation: "vertical",
  scale_mode: "equal-points",
  show_covers: !0,
  card_density: "comfortable"
}, he = "1.0.0", ue = ["vertical", "horizontal"], me = {
  vertical: "竖向",
  horizontal: "横向"
}, fe = ["equal-points", "date-distance"], pe = {
  "equal-points": "时间点等距",
  "date-distance": "日期间距"
}, ge = "日期间距只对可解析日期生效，无法解析的日期按自由文本显示", ye = ["compact", "comfortable", "spacious"], Se = {
  compact: "紧凑",
  comfortable: "舒适",
  spacious: "宽松"
}, be = ["none", "image", "html"], _e = {
  none: "不显示",
  image: "图片",
  html: "代码"
}, J = "背景区域", Q = "顶部区域", ee = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, te = "__unscheduled", ve = "未安排条目", B = 2, $ = 320, we = {
  compact: 72,
  comfortable: 104,
  spacious: 132
}, Ee = 720, Te = /^assets\/[^\\:?#/]+(?:\/[^\\:?#/]+)*$/;
function k(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function ne(e) {
  return e === "vertical" || e === "horizontal";
}
function ie(e) {
  return e === "equal-points" || e === "date-distance";
}
function re(e) {
  return e === "compact" || e === "comfortable" || e === "spacious";
}
function oe(e) {
  return e === "none" || e === "image" || e === "html";
}
function M(e) {
  const t = e.trim();
  return t !== e || !Te.test(t) || t.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t) ? !1 : t.split("/").every((n) => n.length > 0 && n !== "." && n !== "..");
}
function F(e) {
  const t = k(e) ? e : {}, n = oe(t.mode) ? t.mode : "none", i = typeof t.assetPath == "string" ? t.assetPath : "", s = i.length > 0 && M(i) ? i : void 0, l = typeof t.html == "string" && t.html.trim().length > 0 ? t.html : void 0;
  return n === "image" ? s === void 0 ? { mode: "image" } : { mode: "image", assetPath: s } : n === "html" ? l === void 0 ? { mode: "html", html: typeof t.html == "string" ? t.html : "" } : { mode: "html", html: l } : { mode: "none" };
}
function X(e) {
  return e.mode === "image" ? typeof e.assetPath == "string" && e.assetPath.trim().length > 0 : e.mode === "html" ? typeof e.html == "string" && e.html.trim().length > 0 : !1;
}
function xe(e) {
  if (!Array.isArray(e))
    return [];
  const t = e.filter((n) => typeof n == "string").map((n) => n.trim()).filter((n) => n.length > 0);
  return [...new Set(t)];
}
function Ie(e, t, n) {
  const i = typeof e == "string" ? e.trim() : "", s = ee.test(i) ? i : `point-${t + 1}`;
  let l = s, a = 2;
  for (; n.has(l); )
    l = `${s}-${a}`, a += 1;
  return n.add(l), l;
}
function W(e) {
  if (typeof e != "string")
    return;
  const t = e.trim();
  return t.length > 0 ? t : void 0;
}
function ke(e) {
  if (!Array.isArray(e))
    return [];
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  return e.filter((i) => k(i)).map((i, s) => {
    const l = xe(i.entry_ids).filter((r) => n.has(r) ? !1 : (n.add(r), !0)), a = W(i.date), p = W(i.note);
    return {
      id: Ie(i.id, s, t),
      label: W(i.label) ?? `时间点 ${s + 1}`,
      entry_ids: l,
      ...a === void 0 ? {} : { date: a },
      ...p === void 0 ? {} : { note: p }
    };
  });
}
function Ce(e) {
  const t = new Set(e.map((s) => s.id));
  let n = e.length + 1, i = `point-${n}`;
  for (; t.has(i); )
    n += 1, i = `point-${n}`;
  return i;
}
function G(e) {
  return !k(e) || !oe(e.mode) ? !1 : e.mode === "image" ? typeof e.assetPath == "string" && e.assetPath.length > 0 && M(e.assetPath) : e.mode === "html" ? typeof e.html == "string" && e.html.trim().length > 0 : !0;
}
function ze(e, t) {
  if (!k(e))
    return !1;
  const { id: n, label: i, date: s, entry_ids: l, note: a } = e;
  if (typeof n != "string" || !ee.test(n) || t.has(n) || (t.add(n), typeof i != "string" || i.trim().length === 0) || s !== void 0 && (typeof s != "string" || s.trim().length === 0) || a !== void 0 && (typeof a != "string" || a.trim().length === 0) || !Array.isArray(l))
    return !1;
  const p = /* @__PURE__ */ new Set();
  for (const r of l) {
    if (typeof r != "string" || r.trim().length === 0 || p.has(r))
      return !1;
    p.add(r);
  }
  return !0;
}
function Re(e) {
  if (e == null)
    return !0;
  if (!k(e) || e.orientation !== void 0 && !ne(e.orientation) || e.scale_mode !== void 0 && !ie(e.scale_mode) || e.show_covers !== void 0 && typeof e.show_covers != "boolean" || e.card_density !== void 0 && !re(e.card_density))
    return !1;
  if (e.points !== void 0) {
    if (!Array.isArray(e.points))
      return !1;
    const t = /* @__PURE__ */ new Set();
    for (const n of e.points)
      if (!ze(n, t))
        return !1;
  }
  return !(e.background !== void 0 && !G(e.background) || e.top_region !== void 0 && !G(e.top_region));
}
function x(e) {
  const t = k(e) ? e : {}, n = t.orientation, i = t.scale_mode, s = t.show_covers, l = t.card_density;
  return {
    orientation: ne(n) ? n : R.orientation,
    scale_mode: ie(i) ? i : R.scale_mode,
    show_covers: typeof s == "boolean" ? s : R.show_covers,
    card_density: re(l) ? l : R.card_density,
    points: ke(t.points),
    background: F(t.background),
    top_region: F(t.top_region)
  };
}
function U(e) {
  if (e.date === void 0)
    return;
  const t = new Date(e.date).getTime();
  return Number.isNaN(t) ? void 0 : t;
}
function Pe(e, t) {
  const n = /* @__PURE__ */ new Map();
  if (e.length === 0)
    return n;
  if (t !== "date-distance")
    return e.forEach((r, f) => {
      n.set(r.id, f);
    }), n;
  const i = e.map((r) => ({ point: r, time: U(r) })).filter((r) => r.time !== void 0);
  if (i.length < 2)
    return e.forEach((r, f) => {
      n.set(r.id, f);
    }), n;
  const s = i.map((r) => r.time), l = Math.min(...s), a = Math.max(...s), p = Math.max(1, a - l);
  return e.forEach((r, f) => {
    const g = U(r);
    n.set(
      r.id,
      g === void 0 ? f : (g - l) / p * Math.max(1, e.length - 1)
    );
  }), n;
}
function Me(e, t) {
  const n = e.filter((r) => r.enabled), i = new Map(n.map((r) => [r.entry_id, r])), s = /* @__PURE__ */ new Set(), l = Pe(t.points, t.scale_mode), a = t.points.map((r, f) => {
    const g = [];
    for (const h of r.entry_ids) {
      if (s.has(h))
        continue;
      const S = i.get(h);
      S !== void 0 && (s.add(h), g.push(S));
    }
    return {
      id: r.id,
      label: r.label,
      ...r.date === void 0 ? {} : { date: r.date },
      ...r.note === void 0 ? {} : { note: r.note },
      entries: g,
      position: l.get(r.id) ?? f
    };
  }), p = n.filter((r) => !s.has(r.entry_id));
  return p.length > 0 && a.push({
    id: te,
    label: ve,
    entries: p,
    position: a.length,
    isUnscheduled: !0
  }), a;
}
function Ae(e) {
  if (e === void 0)
    return;
  const t = new Date(e);
  return Number.isNaN(t.getTime()) ? e : new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(t);
}
function De(e, t) {
  if (typeof e == "number" && Number.isFinite(e) && e > 0)
    return `${e}`;
  if (typeof e == "string" && e.trim().length > 0) {
    const n = e.trim();
    return n.includes(":") ? n.replace(":", " / ") : n;
  }
  return t;
}
function Ne(e) {
  return e > 0 && e <= Ee;
}
const V = [0, 1, 2, 3, 4], Oe = 96;
let A = null;
function We(e) {
  A = e;
}
function Xe(e) {
  const [t, n] = y.useState(0);
  return y.useEffect(() => {
    if (e === null)
      return;
    n(e.clientWidth);
    const i = new ResizeObserver((s) => {
      const l = s[0];
      l !== void 0 && n(l.contentRect.width);
    });
    return i.observe(e), () => {
      i.disconnect();
    };
  }, [e]), t;
}
function j({ region: e, title: t, variant: n }) {
  return X(e) ? e.mode === "html" && e.html !== void 0 ? n === "background" ? /* @__PURE__ */ o(
    z,
    {
      title: t,
      srcDoc: e.html,
      ratio: "16:9",
      sandbox: "allow-scripts"
    }
  ) : /* @__PURE__ */ o(
    z,
    {
      title: t,
      srcDoc: e.html,
      autoHeight: !0,
      maxHeightFactor: 3,
      sandbox: "allow-scripts"
    }
  ) : e.mode === "image" && e.assetPath !== void 0 && M(e.assetPath) ? n === "background" ? /* @__PURE__ */ o(
    z,
    {
      title: t,
      src: e.assetPath,
      ratio: "16:9",
      sandbox: "allow-scripts"
    }
  ) : /* @__PURE__ */ o(
    z,
    {
      title: t,
      src: e.assetPath,
      autoHeight: !0,
      sandbox: "allow-scripts"
    }
  ) : null : null;
}
function Le({ entry: e }) {
  const { token: t } = I.useToken(), n = y.useRef(null), [i, s] = y.useState(!1), [l, a] = y.useState(null);
  y.useEffect(() => {
    const r = n.current;
    if (r === null)
      return;
    const f = new IntersectionObserver((g) => {
      for (const h of g)
        h.target === r && s(h.isIntersecting);
    });
    return f.observe(r), () => {
      f.disconnect();
    };
  }, []), y.useEffect(() => {
    const r = A, f = n.current;
    if (!i || f === null || r === null)
      return;
    let g = !1, h = null;
    return r.requestEntries({ entryIds: [e.entry_id] }).then(async (S) => {
      const b = S[0];
      if (g || b === void 0)
        return;
      const _ = await r.mountEntry(b, f);
      g ? _() : h = _;
    }).catch(() => {
      g || a("条目内容暂时不可用");
    }), () => {
      g = !0, h?.();
    };
  }, [e.entry_id, i]);
  const p = De(e.layout_hints?.aspectRatio, "3 / 4");
  return /* @__PURE__ */ m("div", { style: { display: "grid", minWidth: 0 }, children: [
    /* @__PURE__ */ o(
      "div",
      {
        ref: n,
        "data-timeline-entry-slot": !0,
        style: {
          width: "100%",
          minHeight: Oe,
          aspectRatio: p,
          borderRadius: t.borderRadius,
          overflow: "hidden"
        }
      }
    ),
    l !== null ? /* @__PURE__ */ o(
      "p",
      {
        style: {
          margin: 0,
          textAlign: "center",
          color: t.colorTextSecondary,
          fontSize: t.fontSizeSM
        },
        children: l
      }
    ) : null
  ] });
}
function He({
  entry: e,
  showCover: t,
  coverSize: n,
  stackCover: i,
  padding: s
}) {
  const { token: l } = I.useToken(), [a, p] = y.useState(null), r = e.displayTitle.length > 0 ? e.displayTitle : "未命名条目", f = y.useMemo(() => {
    const h = e.snapshot?.summary;
    return typeof h == "string" && h.trim().length > 0 ? h : null;
  }, [e.snapshot]), g = () => {
    const h = A;
    h !== null && h.openDocument(e.url).catch(() => {
      p("条目暂时无法打开，请稍后重试");
    });
  };
  return /* @__PURE__ */ m(
    "article",
    {
      "data-timeline-entry": !0,
      "data-entry-id": e.entry_id,
      style: {
        display: "grid",
        gridTemplateColumns: t && !i ? `${n}px minmax(0, 1fr)` : "minmax(0, 1fr)",
        gap: l.marginXS,
        minWidth: 0,
        alignItems: "start",
        padding: s,
        border: `1px solid ${l.colorBorderSecondary}`,
        borderRadius: l.borderRadius,
        background: l.colorBgContainer
      },
      children: [
        t ? /* @__PURE__ */ o(Le, { entry: e }) : null,
        /* @__PURE__ */ m("div", { style: { display: "grid", gap: l.marginXS, minWidth: 0 }, children: [
          /* @__PURE__ */ o(
            "button",
            {
              type: "button",
              "data-timeline-entry-title": !0,
              onClick: g,
              title: r,
              style: {
                border: 0,
                margin: 0,
                padding: 0,
                background: "none",
                cursor: "pointer",
                color: l.colorText,
                fontFamily: "inherit",
                fontSize: l.fontSize,
                fontWeight: l.fontWeightStrong,
                textAlign: "start",
                minWidth: 0,
                overflowWrap: "anywhere"
              },
              children: r
            }
          ),
          f !== null ? /* @__PURE__ */ o(
            "p",
            {
              style: {
                margin: 0,
                color: l.colorTextSecondary,
                fontSize: l.fontSizeSM,
                overflowWrap: "anywhere"
              },
              children: f
            }
          ) : null,
          a !== null ? /* @__PURE__ */ o(
            "p",
            {
              style: {
                margin: 0,
                color: l.colorTextSecondary,
                fontSize: l.fontSizeSM
              },
              children: a
            }
          ) : null
        ] })
      ]
    }
  );
}
function Be(e, t, n, i) {
  return e === "compact" ? t : e === "spacious" ? i : n;
}
function $e({
  group: e,
  vertical: t,
  compact: n,
  config: i,
  expanded: s,
  onToggle: l
}) {
  const { token: a } = I.useToken(), p = e.isUnscheduled ? void 0 : Ae(e.date), r = s || e.entries.length <= B ? e.entries : e.entries.slice(0, B), f = we[i.card_density], g = Be(
    i.card_density,
    a.paddingXS,
    a.paddingSM,
    a.padding
  ), h = () => {
    if (e.entries.length === 1) {
      const b = e.entries[0];
      if (b !== void 0) {
        const _ = A;
        _ !== null && _.openDocument(b.url).catch(() => {
        });
      }
      return;
    }
    l(e.id);
  }, S = t && !n ? {
    position: "relative",
    display: "grid",
    gap: a.marginSM,
    minWidth: 0,
    paddingBottom: a.marginSM,
    gridTemplateColumns: "minmax(96px, 148px) minmax(0, 1fr)"
  } : {
    position: "relative",
    display: "grid",
    gap: a.marginSM,
    minWidth: 0,
    paddingBottom: a.marginSM,
    alignContent: "start",
    ...t ? {} : {
      flex: "0 0 clamp(240px, 32vw, 360px)",
      scrollSnapAlign: "start"
    }
  };
  return /* @__PURE__ */ m("article", { "data-timeline-point": !0, "data-point-id": e.id, style: S, children: [
    t && !n ? /* @__PURE__ */ o(
      "span",
      {
        "aria-hidden": "true",
        style: {
          position: "absolute",
          left: 7,
          top: 20,
          bottom: -12,
          width: 2,
          background: a.colorSplit
        }
      }
    ) : null,
    t ? null : /* @__PURE__ */ o(
      "span",
      {
        "aria-hidden": "true",
        style: {
          position: "absolute",
          left: 16,
          right: -16,
          top: 7,
          height: 2,
          background: a.colorSplit
        }
      }
    ),
    /* @__PURE__ */ m(
      "div",
      {
        style: {
          display: "grid",
          gap: a.marginXS,
          alignContent: "start",
          minWidth: 0,
          isolation: "isolate"
        },
        children: [
          /* @__PURE__ */ o(
            "span",
            {
              "aria-hidden": "true",
              "data-timeline-dot": !0,
              style: {
                width: 16,
                height: 16,
                borderRadius: 999,
                background: a.colorPrimary,
                boxShadow: `0 0 0 4px ${a.colorPrimaryBg}`
              }
            }
          ),
          /* @__PURE__ */ m(
            "button",
            {
              type: "button",
              onClick: h,
              "aria-expanded": e.entries.length > 1 ? s : void 0,
              style: {
                border: 0,
                padding: 0,
                background: "none",
                cursor: "pointer",
                display: "grid",
                gap: a.marginXXS,
                textAlign: "start",
                justifyItems: "start",
                color: a.colorText,
                fontFamily: "inherit",
                fontSize: a.fontSize
              },
              children: [
                /* @__PURE__ */ o(
                  "span",
                  {
                    style: {
                      fontSize: a.fontSizeLG,
                      fontWeight: a.fontWeightStrong,
                      overflowWrap: "anywhere"
                    },
                    children: e.label
                  }
                ),
                p !== void 0 ? /* @__PURE__ */ o(
                  "span",
                  {
                    "data-timeline-date": !0,
                    style: { color: a.colorTextSecondary, fontSize: a.fontSizeSM },
                    children: p
                  }
                ) : null,
                /* @__PURE__ */ o(
                  "span",
                  {
                    "data-timeline-count": !0,
                    style: { color: a.colorTextSecondary, fontSize: a.fontSizeSM },
                    children: `${e.entries.length} 个条目`
                  }
                )
              ]
            }
          ),
          e.note !== void 0 ? /* @__PURE__ */ o(
            "p",
            {
              style: {
                margin: 0,
                color: a.colorTextSecondary,
                fontSize: a.fontSizeSM,
                overflowWrap: "anywhere"
              },
              children: e.note
            }
          ) : null
        ]
      }
    ),
    /* @__PURE__ */ m("div", { style: { display: "grid", gap: a.marginXS, minWidth: 0, alignContent: "start" }, children: [
      r.map((b) => /* @__PURE__ */ o(
        He,
        {
          entry: b,
          showCover: i.show_covers,
          coverSize: f,
          stackCover: n,
          padding: g
        },
        b.entry_id
      )),
      !s && e.entries.length > r.length ? /* @__PURE__ */ o(
        "button",
        {
          type: "button",
          "data-timeline-expand": !0,
          onClick: () => {
            l(e.id);
          },
          style: {
            border: 0,
            margin: 0,
            padding: 0,
            background: "none",
            cursor: "pointer",
            color: a.colorPrimary,
            fontFamily: "inherit",
            fontSize: a.fontSizeSM,
            textAlign: "start"
          },
          children: `展开其余 ${e.entries.length - r.length} 个条目`
        }
      ) : null
    ] })
  ] });
}
const Fe = "未绑定任何时间点的条目会集中呈现在这里，不会丢失";
function Ge({ box: e }) {
  const { token: t } = I.useToken(), [n, i] = y.useState(null), s = Xe(n), l = Ne(s), [a, p] = y.useState(
    () => /* @__PURE__ */ new Set()
  ), r = y.useMemo(() => x(e.layout_config), [e.layout_config]), f = y.useMemo(
    () => [...Me(e.entries, r)].sort(
      (c, w) => c.position - w.position
    ),
    [e.entries, r]
  ), g = y.useMemo(
    () => e.entries.filter((c) => c.enabled),
    [e.entries]
  ), h = r.orientation === "vertical", S = X(r.background), b = X(r.top_region), _ = T((c) => {
    p((w) => {
      const u = new Set(w);
      return u.has(c) ? u.delete(c) : u.add(c), u;
    });
  }, []), d = T(
    (c) => {
      if (h || c.key !== "ArrowLeft" && c.key !== "ArrowRight")
        return;
      c.preventDefault();
      const w = c.currentTarget;
      typeof w.scrollBy == "function" && w.scrollBy({
        left: c.key === "ArrowRight" ? $ : -$,
        behavior: "smooth"
      });
    },
    [h]
  ), v = h ? {
    display: "grid",
    gap: t.margin,
    minWidth: 0
  } : {
    display: "flex",
    gap: t.margin,
    minWidth: 0,
    overflowX: "auto",
    scrollSnapType: "x proximity",
    paddingBottom: t.marginXS
  };
  return /* @__PURE__ */ m(
    "div",
    {
      ref: i,
      "aria-label": "时间线箱子布局",
      style: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: t.marginXS,
        width: "100%",
        minWidth: 0,
        minHeight: "100%",
        padding: t.padding,
        boxSizing: "border-box"
      },
      children: [
        S ? /* @__PURE__ */ o("div", { "aria-hidden": "true", style: { width: "100%" }, children: /* @__PURE__ */ o(
          j,
          {
            region: r.background,
            title: J,
            variant: "background"
          }
        ) }) : null,
        b ? /* @__PURE__ */ o("div", { style: { width: "100%" }, children: /* @__PURE__ */ o(j, { region: r.top_region, title: Q, variant: "top" }) }) : null,
        g.length === 0 ? /* @__PURE__ */ o(
          se,
          {
            minHeight: 320,
            hint: /* @__PURE__ */ o(
              de,
              {
                align: "start",
                title: "这里还没有内容",
                description: "在编辑器中添加卡片或箱子，开始填充这个箱子"
              }
            ),
            children: V.map((c) => /* @__PURE__ */ m(
              "div",
              {
                "data-timeline-skeleton-node": !0,
                style: {
                  display: "flex",
                  gap: t.marginSM,
                  alignItems: "stretch"
                },
                children: [
                  /* @__PURE__ */ m(
                    "div",
                    {
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        width: 40,
                        flexShrink: 0
                      },
                      children: [
                        /* @__PURE__ */ o(ae, { size: 12 }),
                        c < V.length - 1 ? /* @__PURE__ */ o(
                          "div",
                          {
                            style: {
                              width: 2,
                              flex: 1,
                              minHeight: 8,
                              marginTop: t.marginXXS,
                              background: t.colorSplit
                            }
                          }
                        ) : null
                      ]
                    }
                  ),
                  /* @__PURE__ */ m(
                    "div",
                    {
                      style: {
                        position: "relative",
                        width: "100%",
                        maxWidth: 420,
                        flexShrink: 0
                      },
                      children: [
                        /* @__PURE__ */ o(le, { width: "100%", height: 64, radius: 10, dashed: !0 }),
                        /* @__PURE__ */ m(
                          "div",
                          {
                            style: {
                              position: "absolute",
                              inset: 0,
                              padding: `${t.paddingSM}px ${t.padding}px`,
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              gap: t.marginXS
                            },
                            children: [
                              /* @__PURE__ */ o(H, { width: "50%" }),
                              /* @__PURE__ */ o(H, { width: "32%", height: 8 })
                            ]
                          }
                        )
                      ]
                    }
                  )
                ]
              },
              c
            ))
          }
        ) : /* @__PURE__ */ m(
          "div",
          {
            "data-timeline-root": !0,
            "data-orientation": r.orientation,
            "data-scale-mode": r.scale_mode,
            "data-density": r.card_density,
            tabIndex: h ? void 0 : 0,
            onKeyDown: d,
            style: v,
            children: [
              f.map((c) => /* @__PURE__ */ o(
                $e,
                {
                  group: c,
                  vertical: h,
                  compact: l,
                  config: r,
                  expanded: a.has(c.id),
                  onToggle: _
                },
                c.id === te ? `${c.id}-${c.position}` : c.id
              )),
              f.some((c) => c.isUnscheduled) ? /* @__PURE__ */ o(
                "p",
                {
                  style: {
                    margin: 0,
                    color: t.colorTextSecondary,
                    fontSize: t.fontSizeSM
                  },
                  children: Fe
                }
              ) : null
            ]
          }
        )
      ]
    }
  );
}
const P = /* @__PURE__ */ new WeakMap();
function Ue(e, t) {
  P.get(t)?.(), t.replaceChildren();
  const n = K(t);
  Z(() => {
    n.render(/* @__PURE__ */ o(Ge, { box: e }));
  });
  let i = !1;
  const s = () => {
    i || (i = !0, n.unmount(), P.get(t) === s && P.delete(t));
  };
  return P.set(t, s), s;
}
function q({ title: e, field: t }) {
  const { token: n } = I.useToken();
  return /* @__PURE__ */ m(
    "fieldset",
    {
      style: {
        border: `1px solid ${n.colorBorderSecondary}`,
        borderRadius: n.borderRadius,
        padding: n.paddingXS,
        margin: 0
      },
      children: [
        /* @__PURE__ */ o("legend", { style: { paddingInline: n.paddingXXS }, children: e }),
        /* @__PURE__ */ o(E.Item, { label: "呈现模式", name: [t, "mode"], children: /* @__PURE__ */ o(
          Y,
          {
            options: be.map((i) => ({
              value: i,
              label: _e[i]
            }))
          }
        ) }),
        /* @__PURE__ */ o(E.Item, { noStyle: !0, shouldUpdate: !0, children: ({ getFieldValue: i }) => {
          const s = i([t, "mode"]);
          return s === "image" ? /* @__PURE__ */ o(
            E.Item,
            {
              label: "箱子资源路径",
              name: [t, "assetPath"],
              extra: "以 assets/ 开头的箱子自有资源相对路径",
              rules: [
                {
                  validator: (l, a) => typeof a == "string" && a.length > 0 && !M(a) ? Promise.reject(new Error("请输入以 assets/ 开头的合法箱子资源路径")) : Promise.resolve()
                }
              ],
              children: /* @__PURE__ */ o(C, { placeholder: "assets/layouts/background.png" })
            }
          ) : s === "html" ? /* @__PURE__ */ o(E.Item, { label: "HTML 代码", name: [t, "html"], children: /* @__PURE__ */ o(C.TextArea, { rows: 6, placeholder: "<section>…</section>" }) }) : null;
        } })
      ]
    }
  );
}
function Ve({
  config: e,
  entries: t,
  onChange: n
}) {
  const { token: i } = I.useToken(), [s, l] = y.useState(() => x(e)), a = T(
    (d) => {
      const v = x(d);
      l(v), n(v);
    },
    [n]
  ), p = (d, v) => {
    a({ ...s, ...v });
  }, r = T(
    (d) => {
      a({ ...s, points: [...d] });
    },
    [a, s]
  ), f = T(() => {
    r([
      ...s.points,
      {
        id: Ce(s.points),
        label: `时间点 ${s.points.length + 1}`,
        entry_ids: []
      }
    ]);
  }, [r, s.points]), g = T(
    (d) => {
      r(s.points.filter((v) => v.id !== d));
    },
    [r, s.points]
  ), h = T(
    (d, v) => {
      r(
        s.points.map((c) => c.id === d ? { ...c, ...v } : c)
      );
    },
    [r, s.points]
  ), S = L(() => t.filter((d) => d.enabled), [t]), b = L(
    () => new Set(s.points.flatMap((d) => d.entry_ids)),
    [s.points]
  ), _ = {
    fontSize: i.fontSizeSM,
    color: i.colorTextSecondary
  };
  return /* @__PURE__ */ m(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "auto",
        padding: i.padding,
        boxSizing: "border-box",
        display: "grid",
        gap: i.margin
      },
      children: [
        /* @__PURE__ */ m(
          E,
          {
            layout: "vertical",
            initialValues: s,
            onValuesChange: p,
            children: [
              /* @__PURE__ */ o(E.Item, { label: "方向", name: "orientation", children: /* @__PURE__ */ o(
                N,
                {
                  options: ue.map((d) => ({
                    value: d,
                    label: me[d]
                  }))
                }
              ) }),
              /* @__PURE__ */ o(E.Item, { label: "比例方式", name: "scale_mode", extra: ge, children: /* @__PURE__ */ o(
                N,
                {
                  options: fe.map((d) => ({
                    value: d,
                    label: pe[d]
                  }))
                }
              ) }),
              /* @__PURE__ */ o(E.Item, { label: "卡片密度", name: "card_density", children: /* @__PURE__ */ o(
                N,
                {
                  options: ye.map((d) => ({ value: d, label: Se[d] }))
                }
              ) }),
              /* @__PURE__ */ o(
                E.Item,
                {
                  label: "显示条目封面",
                  name: "show_covers",
                  valuePropName: "checked",
                  extra: "开启后查看态为可见条目挂载平台条目帧，呈现正式封面",
                  children: /* @__PURE__ */ o(ce, {})
                }
              ),
              /* @__PURE__ */ o(q, { title: J, field: "background" }),
              /* @__PURE__ */ o(q, { title: Q, field: "top_region" })
            ]
          }
        ),
        /* @__PURE__ */ m(
          "section",
          {
            "aria-label": "时间点编辑",
            style: {
              display: "grid",
              gap: i.marginXS,
              border: `1px solid ${i.colorBorderSecondary}`,
              borderRadius: i.borderRadius,
              padding: i.paddingXS
            },
            children: [
              /* @__PURE__ */ m("div", { style: { display: "grid", gap: i.marginXXS }, children: [
                /* @__PURE__ */ o("p", { style: { margin: 0, fontWeight: i.fontWeightStrong, fontSize: i.fontSize }, children: "时间点" }),
                /* @__PURE__ */ o("p", { style: { margin: 0, color: i.colorTextSecondary, fontSize: i.fontSizeSM }, children: "新增、删除、重命名时间点，并维护日期、说明和已绑定条目" }),
                /* @__PURE__ */ o("p", { style: { margin: 0, color: i.colorTextSecondary, fontSize: i.fontSizeSM }, children: `当前箱子包含 ${S.length} 个条目` })
              ] }),
              /* @__PURE__ */ o("div", { children: /* @__PURE__ */ o(O, { onClick: f, children: "新增时间点" }) }),
              s.points.length === 0 ? /* @__PURE__ */ o("p", { style: { margin: 0, color: i.colorTextSecondary, fontSize: i.fontSizeSM }, children: "还没有时间点" }) : s.points.map((d, v) => {
                const c = S.map((u) => ({
                  value: u.entry_id,
                  label: u.displayTitle.length > 0 ? u.displayTitle : "未命名条目",
                  disabled: b.has(u.entry_id) && !d.entry_ids.includes(u.entry_id)
                })), w = d.entry_ids.map((u) => S.find((D) => D.entry_id === u)).filter((u) => u !== void 0);
                return /* @__PURE__ */ m(
                  "fieldset",
                  {
                    "data-point-id": d.id,
                    style: {
                      border: `1px solid ${i.colorBorderSecondary}`,
                      borderRadius: i.borderRadius,
                      padding: i.paddingXS,
                      margin: 0,
                      display: "grid",
                      gap: i.marginXS
                    },
                    children: [
                      /* @__PURE__ */ m(
                        "div",
                        {
                          style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: i.marginXS
                          },
                          children: [
                            /* @__PURE__ */ o("strong", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: `时间点 ${v + 1}` }),
                            /* @__PURE__ */ o(O, { type: "text", danger: !0, size: "small", onClick: () => g(d.id), children: "删除时间点" })
                          ]
                        }
                      ),
                      /* @__PURE__ */ m(
                        "div",
                        {
                          style: {
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                            gap: i.marginXS
                          },
                          children: [
                            /* @__PURE__ */ m(
                              "label",
                              {
                                style: {
                                  display: "grid",
                                  gap: i.marginXXS,
                                  minWidth: 0
                                },
                                children: [
                                  /* @__PURE__ */ o("span", { style: _, children: "名称" }),
                                  /* @__PURE__ */ o(
                                    C,
                                    {
                                      value: d.label,
                                      "aria-label": "名称",
                                      onChange: (u) => {
                                        h(d.id, { label: u.target.value });
                                      }
                                    }
                                  )
                                ]
                              }
                            ),
                            /* @__PURE__ */ m(
                              "label",
                              {
                                style: {
                                  display: "grid",
                                  gap: i.marginXXS,
                                  minWidth: 0
                                },
                                children: [
                                  /* @__PURE__ */ o("span", { style: _, children: "日期" }),
                                  /* @__PURE__ */ o(
                                    C,
                                    {
                                      value: d.date ?? "",
                                      "aria-label": "日期",
                                      placeholder: "2026-07-06 或 阶段一",
                                      onChange: (u) => {
                                        h(d.id, { date: u.target.value });
                                      }
                                    }
                                  )
                                ]
                              }
                            )
                          ]
                        }
                      ),
                      /* @__PURE__ */ m("label", { style: { display: "grid", gap: i.marginXXS, minWidth: 0 }, children: [
                        /* @__PURE__ */ o("span", { style: _, children: "说明" }),
                        /* @__PURE__ */ o(
                          C.TextArea,
                          {
                            value: d.note ?? "",
                            "aria-label": "说明",
                            rows: 3,
                            onChange: (u) => {
                              h(d.id, { note: u.target.value });
                            }
                          }
                        )
                      ] }),
                      /* @__PURE__ */ m("div", { style: { display: "grid", gap: i.marginXXS, minWidth: 0 }, children: [
                        /* @__PURE__ */ o("span", { style: _, children: "绑定条目" }),
                        /* @__PURE__ */ o(
                          Y,
                          {
                            mode: "multiple",
                            allowClear: !0,
                            style: { width: "100%" },
                            placeholder: "选择要绑定到这个时间点的条目",
                            value: d.entry_ids,
                            options: c,
                            disabled: S.length === 0,
                            onChange: (u) => {
                              h(d.id, { entry_ids: [...u] });
                            }
                          }
                        ),
                        w.length === 0 ? /* @__PURE__ */ o(
                          "p",
                          {
                            style: {
                              margin: 0,
                              color: i.colorTextSecondary,
                              fontSize: i.fontSizeSM
                            },
                            children: "这个时间点还没有绑定条目"
                          }
                        ) : w.map((u) => /* @__PURE__ */ m(
                          "div",
                          {
                            style: {
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: i.marginXS,
                              padding: i.paddingXXS,
                              border: `1px solid ${i.colorBorderSecondary}`,
                              borderRadius: i.borderRadius,
                              minWidth: 0
                            },
                            children: [
                              /* @__PURE__ */ o("span", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: u.displayTitle.length > 0 ? u.displayTitle : "未命名条目" }),
                              /* @__PURE__ */ o(
                                O,
                                {
                                  type: "text",
                                  danger: !0,
                                  size: "small",
                                  onClick: () => {
                                    h(d.id, {
                                      entry_ids: d.entry_ids.filter(
                                        (D) => D !== u.entry_id
                                      )
                                    });
                                  },
                                  children: "移出"
                                }
                              )
                            ]
                          },
                          u.entry_id
                        ))
                      ] })
                    ]
                  },
                  d.id
                );
              })
            ]
          }
        )
      ]
    }
  );
}
class je {
  state = "active";
  base;
  revision;
  pending = null;
  dirty = !1;
  entries;
  host;
  root;
  changeHandlers = /* @__PURE__ */ new Set();
  dirtyHandlers = /* @__PURE__ */ new Set();
  constructor(t, n) {
    this.base = x(t.layout_config), this.revision = t.revision, this.entries = [...t.entries], this.host = n, n.replaceChildren(), this.root = K(n), this.mount();
  }
  isDirty() {
    return this.pending !== null;
  }
  getChange() {
    return this.pending;
  }
  markCommitted(t) {
    if (this.state === "disposed" || t <= this.revision)
      return;
    const n = this.pending;
    this.revision = t, n !== null && n.kind === "replace" && (this.base = x(n.config)), this.pending === n && (this.pending = null, this.setDirty(!1));
  }
  update(t, n) {
    this.state === "disposed" || n <= this.revision || (this.revision = n, this.base = x(t.layout_config), this.entries = [...t.entries], this.pending = null, this.setDirty(!1), this.mount());
  }
  subscribe(t, n) {
    if (this.state === "disposed")
      return { dispose: () => {
      } };
    if (t === "change") {
      const s = n;
      return this.changeHandlers.add(s), {
        dispose: () => {
          this.changeHandlers.delete(s);
        }
      };
    }
    const i = n;
    return this.dirtyHandlers.add(i), {
      dispose: () => {
        this.dirtyHandlers.delete(i);
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
    Z(() => {
      this.root.render(
        /* @__PURE__ */ o(
          Ve,
          {
            config: this.base,
            entries: this.entries,
            onChange: this.handleConfigChange
          },
          this.revision
        )
      );
    });
  }
  handleConfigChange = (t) => {
    if (this.state !== "active")
      return;
    const n = {
      kind: "replace",
      config: { ...t },
      schemaVersion: he
    }, i = this.pending !== null;
    this.pending = n, i || this.setDirty(!0);
    for (const s of this.changeHandlers)
      s({ change: n });
  };
  setDirty(t) {
    if (this.dirty !== t) {
      this.dirty = t;
      for (const n of this.dirtyHandlers)
        n({ isDirty: t });
    }
  }
}
function qe(e, t) {
  return new je(e, t);
}
const et = {
  attachRuntime: We,
  renderLayout: Ue,
  renderEditor: qe,
  validateConfig: Re
};
export {
  We as attachRuntime,
  et as default,
  qe as renderEditor,
  Ue as renderLayout,
  et as renderPlugin
};
