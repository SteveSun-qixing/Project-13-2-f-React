import { jsx as r, jsxs as m, Fragment as q } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import _ from "chips-resource://platform/vendor/react.js";
import { flushSync as J } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as ee } from "chips-resource://platform/vendor/react-dom-client.js";
import { theme as R, Form as u, Select as $, Input as E, Slider as me, Switch as pe, Button as he, EmbeddedDocumentFrame as Z, LayoutSkeleton as fe, SkeletonBlock as ge, SkeletonDot as ye, EmptyHint as _e } from "chips-resource://platform/vendor/chips-ui.js";
const be = "1.0.0", B = { west: -180, south: -85, east: 180, north: 85 }, F = 0.5, H = 8, j = 0.25, C = 5, te = 120, ne = /^[A-Za-z0-9._:-]+$/, Se = /^assets\/[^\\:?#/]+(?:\/[^\\:?#/]+)*$/, T = {
  map_source: {
    mode: "image",
    projection: "linear-bounds"
  },
  default_view: { latitude: 0, longitude: 0, zoom: 1 },
  marker_style: "dot-title",
  show_cover_on_select: !0
}, Ee = ["dot-title", "pin-title"], ve = {
  "dot-title": "圆点和标题",
  "pin-title": "图钉和标题"
}, Y = "静态图片", we = "Host 地图", xe = "Host 地图能力尚未提供，当前布局按内置静态底图显示，不会联网加载地图。", Te = "Host 地图是预留模式；当前宿主未提供地图能力，请使用静态图片底图。", Ie = "静态图片经箱子自有资源引用，布局不联网获取瓦片。", Pe = "地图底图", Le = "默认视图", Ae = "条目定位", re = "顶部内容区", Me = {
  west: "西边界经度",
  south: "南边界纬度",
  east: "东边界经度",
  north: "北边界纬度"
}, ke = "这里还没有内容", Oe = "在编辑器中添加卡片或箱子，开始填充这个箱子";
function y(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function v(e, t) {
  if (typeof e == "number" && Number.isFinite(e))
    return e;
  if (typeof e == "string" && e.trim().length > 0) {
    const n = Number(e);
    if (Number.isFinite(n))
      return n;
  }
  return t;
}
function ie(e) {
  return e === "image" || e === "host-map";
}
function oe(e) {
  return e === "linear-bounds" || e === "web-mercator";
}
function ae(e) {
  return e === "dot-title" || e === "pin-title";
}
function se(e) {
  return e === "none" || e === "image" || e === "html";
}
function I(e) {
  const t = e.trim();
  return t !== e || !Se.test(t) || t.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t) ? !1 : t.split("/").every((n) => n.length > 0 && n !== "." && n !== "..");
}
function k(e) {
  return Number.isFinite(e) && e >= -90 && e <= 90;
}
function O(e) {
  return Number.isFinite(e) && e >= -180 && e <= 180;
}
function le(e) {
  return O(e.west) && O(e.east) && k(e.south) && k(e.north) && e.west < e.east && e.south < e.north;
}
function Re(e) {
  const t = y(e) ? e : {}, n = se(t.mode) ? t.mode : "none", i = typeof t.assetPath == "string" ? t.assetPath : "", o = i.length > 0 && I(i) ? i : void 0, d = typeof t.html == "string" && t.html.trim().length > 0 ? t.html : void 0;
  return n === "image" ? o === void 0 ? { mode: "image" } : { mode: "image", assetPath: o } : n === "html" ? d === void 0 ? { mode: "html", html: typeof t.html == "string" ? t.html : "" } : { mode: "html", html: d } : { mode: "none" };
}
function de(e) {
  return e.mode === "image" ? typeof e.assetPath == "string" && e.assetPath.trim().length > 0 : e.mode === "html" ? typeof e.html == "string" && e.html.trim().length > 0 : !1;
}
function Ne(e) {
  return e.mode === "image" && typeof e.assetPath == "string" && e.assetPath.length > 0;
}
function Be(e) {
  const t = y(e) ? e : {}, n = ie(t.mode) ? t.mode : T.map_source.mode, i = oe(t.projection) ? t.projection : T.map_source.projection, o = n === "host-map" ? i : "linear-bounds", d = typeof t.assetPath == "string" ? t.assetPath : "", f = n === "image" && d.length > 0 && I(d) ? d : void 0, c = y(t.bounds) ? t.bounds : {}, g = {
    west: v(c.west, B.west),
    south: v(c.south, B.south),
    east: v(c.east, B.east),
    north: v(c.north, B.north)
  };
  return f === void 0 ? { mode: n, projection: o, bounds: g } : { mode: n, projection: o, assetPath: f, bounds: g };
}
function Ce(e) {
  const t = y(e) ? e : {}, n = v(t.zoom, T.default_view.zoom);
  return {
    latitude: v(t.latitude, T.default_view.latitude),
    longitude: v(t.longitude, T.default_view.longitude),
    zoom: Math.min(H, Math.max(F, n))
  };
}
function ze(e) {
  const t = y(e) ? e : {}, n = {};
  for (const [i, o] of Object.entries(t)) {
    if (!ne.test(i))
      continue;
    const d = y(o) ? o : {}, f = v(d.latitude, Number.NaN), c = v(d.longitude, Number.NaN);
    if (!Number.isFinite(f) || !Number.isFinite(c))
      continue;
    const g = typeof d.labelOverride == "string" ? d.labelOverride.trim() : "";
    n[i] = {
      latitude: f,
      longitude: c,
      ...g.length > 0 ? { labelOverride: g.slice(0, te) } : {}
    };
  }
  return n;
}
function P(e) {
  const t = y(e) ? e : {};
  return {
    map_source: Be(t.map_source),
    default_view: Ce(t.default_view),
    marker_style: ae(t.marker_style) ? t.marker_style : T.marker_style,
    show_cover_on_select: typeof t.show_cover_on_select == "boolean" ? t.show_cover_on_select : T.show_cover_on_select,
    entries: ze(t.entries),
    top_region: Re(t.top_region)
  };
}
function Xe(e) {
  return !y(e) || !se(e.mode) ? !1 : e.mode === "image" ? typeof e.assetPath == "string" && e.assetPath.length > 0 && I(e.assetPath) : e.mode === "html" ? typeof e.html == "string" && e.html.trim().length > 0 : !0;
}
function Fe(e) {
  return !(!y(e) || typeof e.latitude != "number" || !k(e.latitude) || typeof e.longitude != "number" || !O(e.longitude) || e.labelOverride !== void 0 && (typeof e.labelOverride != "string" || e.labelOverride.length > te));
}
function He(e) {
  if (e == null)
    return !0;
  if (!y(e))
    return !1;
  if (e.map_source !== void 0) {
    const t = e.map_source;
    if (!y(t) || t.mode !== void 0 && !ie(t.mode) || t.projection !== void 0 && (!oe(t.projection) || t.mode === "image" && t.projection !== "linear-bounds") || t.assetPath !== void 0 && (typeof t.assetPath != "string" || t.assetPath.length === 0 || !I(t.assetPath)))
      return !1;
    if (t.bounds !== void 0) {
      const n = t.bounds;
      if (!y(n))
        return !1;
      const { west: i, south: o, east: d, north: f } = n;
      if (typeof i != "number" || typeof o != "number" || typeof d != "number" || typeof f != "number" || !le({ west: i, south: o, east: d, north: f }))
        return !1;
    }
  }
  if (e.default_view !== void 0) {
    const t = e.default_view;
    if (!y(t) || t.latitude !== void 0 && (typeof t.latitude != "number" || !k(t.latitude)) || t.longitude !== void 0 && (typeof t.longitude != "number" || !O(t.longitude)) || t.zoom !== void 0 && (typeof t.zoom != "number" || !Number.isFinite(t.zoom) || t.zoom < F || t.zoom > H))
      return !1;
  }
  if (e.marker_style !== void 0 && !ae(e.marker_style) || e.show_cover_on_select !== void 0 && typeof e.show_cover_on_select != "boolean")
    return !1;
  if (e.entries !== void 0) {
    const t = e.entries;
    if (!y(t))
      return !1;
    for (const [n, i] of Object.entries(t))
      if (!ne.test(n) || !Fe(i))
        return !1;
  }
  return !(e.top_region !== void 0 && !Xe(e.top_region));
}
function K(e, t) {
  if (!le(t) || !k(e.latitude) || !O(e.longitude))
    return;
  const n = (e.longitude - t.west) / (t.east - t.west) * 100, i = (t.north - e.latitude) / (t.north - t.south) * 100;
  if (!(!Number.isFinite(n) || !Number.isFinite(i)))
    return { x: n, y: i };
}
function W(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function De(e) {
  return Number(W(e, F, H).toFixed(2));
}
function Ve(e, t, n) {
  return {
    latitude: W(e.latitude + t, -90, 90),
    longitude: W(e.longitude + n, -180, 180)
  };
}
let X = null;
function $e(e) {
  X = e;
}
const ce = "条目暂时无法打开，请稍后重试", je = "条目预览暂时不可用", Q = "未定位条目", We = "地图视图控制", Ue = "放大", Ge = "缩小", Ze = "向北平移", Ye = "向南平移", Ke = "向西平移", Qe = "向东平移", qe = "重置视图", Je = "打开条目", et = "关闭", tt = "地图底图";
function U(e) {
  return {
    minHeight: 32,
    border: `1px solid ${e.colorBorderSecondary}`,
    borderRadius: e.borderRadius,
    paddingInline: e.paddingXS,
    background: e.colorBgContainer,
    color: e.colorText,
    font: "inherit",
    fontSize: e.fontSize,
    cursor: "pointer"
  };
}
function nt({ source: e }) {
  const { token: t } = R.useToken();
  return Ne(e) && e.assetPath !== void 0 ? /* @__PURE__ */ r(
    "img",
    {
      "data-map-asset-image": !0,
      src: e.assetPath,
      alt: tt,
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover"
      }
    }
  ) : /* @__PURE__ */ r(
    "div",
    {
      "data-map-default-image": !0,
      "aria-hidden": "true",
      style: {
        position: "absolute",
        inset: 0,
        background: `repeating-linear-gradient(0deg, ${t.colorBorderSecondary} 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, ${t.colorBorderSecondary} 0 1px, transparent 1px 40px), ${t.colorFillQuaternary}`
      }
    }
  );
}
function rt({ region: e, title: t }) {
  return de(e) ? e.mode === "html" && e.html !== void 0 ? /* @__PURE__ */ r(
    Z,
    {
      title: t,
      srcDoc: e.html,
      autoHeight: !0,
      maxHeightFactor: 3,
      sandbox: "allow-scripts"
    }
  ) : e.mode === "image" && e.assetPath !== void 0 && I(e.assetPath) ? /* @__PURE__ */ r(
    Z,
    {
      title: t,
      src: e.assetPath,
      autoHeight: !0,
      maxHeightFactor: 3,
      sandbox: "allow-scripts"
    }
  ) : null : null;
}
function it(e) {
  const t = e.snapshot?.summary;
  return typeof t == "string" ? t : "";
}
function ot({ entry: e, showCover: t, onClose: n }) {
  const { token: i } = R.useToken(), o = _.useRef(null), [d, f] = _.useState(null), [c, g] = _.useState(null);
  _.useEffect(() => {
    if (!t)
      return;
    const p = X, l = o.current;
    if (p === null || l === null)
      return;
    let w = !1, L = null;
    return p.requestEntries({ entryIds: [e.entry_id] }).then(async (D) => {
      const A = D[0];
      if (w || A === void 0)
        return;
      const M = await p.mountEntry(A, l);
      w ? M() : L = M;
    }).catch(() => {
      w || f(je);
    }), () => {
      w = !0, L?.();
    };
  }, [e.entry_id, t]);
  const b = () => {
    const p = X;
    p !== null && (g(null), p.openDocument(e.url).catch(() => {
      g(ce);
    }));
  }, s = it(e);
  return /* @__PURE__ */ m(
    "aside",
    {
      "data-map-selected": !0,
      "data-entry-id": e.entry_id,
      style: {
        position: "absolute",
        insetInline: i.marginSM,
        insetBlockEnd: i.marginSM,
        zIndex: 4,
        display: "flex",
        alignItems: "stretch",
        gap: i.marginXS,
        maxWidth: 520,
        padding: i.paddingSM,
        border: `1px solid ${i.colorBorderSecondary}`,
        borderRadius: i.borderRadiusLG,
        background: i.colorBgContainer,
        boxShadow: i.boxShadowSecondary,
        boxSizing: "border-box"
      },
      children: [
        t ? /* @__PURE__ */ r(
          "div",
          {
            style: {
              flex: "0 0 120px",
              minHeight: 160,
              overflow: "hidden",
              borderRadius: i.borderRadius,
              background: i.colorFillQuaternary
            },
            children: d !== null ? /* @__PURE__ */ r("div", { role: "status", style: { padding: i.paddingXS, color: i.colorTextSecondary, textAlign: "center" }, children: d }) : /* @__PURE__ */ r("div", { ref: o, "data-entry-slot": !0, style: { width: "100%", height: "100%" } })
          }
        ) : null,
        /* @__PURE__ */ m(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: i.marginXXS,
              minWidth: 0
            },
            children: [
              /* @__PURE__ */ r("h3", { style: { margin: 0, color: i.colorText, overflowWrap: "anywhere" }, children: e.displayTitle }),
              s !== "" ? /* @__PURE__ */ r("p", { style: { margin: 0, color: i.colorTextSecondary }, children: s }) : null,
              c !== null ? /* @__PURE__ */ r("p", { role: "alert", style: { margin: 0, color: i.colorError }, children: c }) : null,
              /* @__PURE__ */ m("div", { style: { display: "flex", flexWrap: "wrap", gap: i.marginXXS }, children: [
                /* @__PURE__ */ r("button", { type: "button", "data-open-entry": !0, onClick: b, style: U(i), children: Je }),
                /* @__PURE__ */ r("button", { type: "button", "data-close-preview": !0, onClick: n, style: U(i), children: et })
              ] })
            ]
          }
        )
      ]
    }
  );
}
const at = [
  { left: 24, top: 36 },
  { left: 56, top: 64 },
  { left: 78, top: 42 }
];
function st() {
  const { token: e } = R.useToken();
  return /* @__PURE__ */ r(
    fe,
    {
      minHeight: 320,
      hint: /* @__PURE__ */ r(_e, { title: ke, description: Oe }),
      children: /* @__PURE__ */ r(
        "div",
        {
          "data-map-skeleton": !0,
          "aria-hidden": "true",
          style: {
            position: "relative",
            width: "100%",
            height: 240,
            overflow: "hidden",
            borderRadius: e.borderRadiusLG,
            background: e.colorFillQuaternary,
            backgroundImage: `repeating-linear-gradient(0deg, ${e.colorBorderSecondary} 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, ${e.colorBorderSecondary} 0 1px, transparent 1px 40px)`,
            boxSizing: "border-box"
          },
          children: at.map((t) => /* @__PURE__ */ m(
            "div",
            {
              "aria-hidden": "true",
              style: {
                position: "absolute",
                left: `${t.left}%`,
                top: `${t.top}%`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                transform: "translate(-50%, -100%)"
              },
              children: [
                /* @__PURE__ */ r(ge, { width: 64, height: 44, radius: 10 }),
                /* @__PURE__ */ r(
                  "span",
                  {
                    style: {
                      width: 2,
                      height: 20,
                      flex: "0 0 auto",
                      background: e.colorBorderSecondary,
                      borderRadius: 1
                    }
                  }
                ),
                /* @__PURE__ */ r(ye, { size: 12 })
              ]
            },
            `${t.left}-${t.top}`
          ))
        }
      )
    }
  );
}
function lt({ box: e }) {
  const { token: t } = R.useToken(), n = _.useMemo(() => P(e.layout_config), [e.layout_config]), [i, o] = _.useState(() => ({
    center: {
      latitude: n.default_view.latitude,
      longitude: n.default_view.longitude
    },
    zoom: n.default_view.zoom
  })), [d, f] = _.useState(void 0);
  _.useEffect(() => {
    o({
      center: {
        latitude: n.default_view.latitude,
        longitude: n.default_view.longitude
      },
      zoom: n.default_view.zoom
    }), f(void 0);
  }, [n]);
  const c = _.useMemo(
    () => e.entries.filter((a) => a.enabled),
    [e.entries]
  ), g = n.map_source.bounds, b = _.useMemo(() => {
    const a = [];
    for (const h of c) {
      const S = n.entries[h.entry_id];
      if (S === void 0)
        continue;
      const V = K(S, g);
      V !== void 0 && a.push({
        entry: h,
        location: S,
        label: S.labelOverride ?? h.displayTitle,
        x: V.x,
        y: V.y
      });
    }
    return a;
  }, [g, n.entries, c]), s = _.useMemo(
    () => new Set(b.map((a) => a.entry.entry_id)),
    [b]
  ), p = _.useMemo(
    () => c.filter((a) => !s.has(a.entry_id)),
    [c, s]
  ), l = d === void 0 ? void 0 : c.find((a) => a.entry_id === d), w = de(n.top_region), L = K(i.center, g) ?? { x: 50, y: 50 }, D = `translate(${50 - L.x}%, ${50 - L.y}%) scale(${i.zoom})`, A = (a) => {
    const h = X;
    h !== null && h.openDocument(a.url).catch(() => {
      h.notify({ level: "error", message: ce });
    });
  }, M = (a) => {
    if (d === a.entry.entry_id) {
      A(a.entry);
      return;
    }
    f(a.entry.entry_id);
  }, G = (a) => {
    o((h) => ({ ...h, zoom: De(h.zoom + a) }));
  }, N = (a, h) => {
    o((S) => ({ ...S, center: Ve(S.center, a, h) }));
  }, ue = () => {
    o({
      center: {
        latitude: n.default_view.latitude,
        longitude: n.default_view.longitude
      },
      zoom: n.default_view.zoom
    });
  }, x = U(t);
  return /* @__PURE__ */ m(
    "div",
    {
      "aria-label": "地图箱子布局",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: t.marginXS,
        minHeight: "100%",
        padding: t.padding,
        boxSizing: "border-box"
      },
      children: [
        w ? /* @__PURE__ */ r("div", { style: { width: "100%" }, children: /* @__PURE__ */ r(rt, { region: n.top_region, title: re }) }) : null,
        /* @__PURE__ */ r(
          "div",
          {
            "data-map-stage": !0,
            style: {
              position: "relative",
              minHeight: 320,
              overflow: "hidden",
              border: `1px solid ${t.colorBorderSecondary}`,
              borderRadius: t.borderRadiusLG,
              background: t.colorBgContainer,
              isolation: "isolate"
            },
            children: c.length === 0 ? /* @__PURE__ */ r(st, {}) : /* @__PURE__ */ m(q, { children: [
              n.map_source.mode === "host-map" ? /* @__PURE__ */ r(
                "div",
                {
                  "data-map-unavailable": !0,
                  role: "status",
                  style: {
                    display: "grid",
                    placeItems: "center",
                    minHeight: 120,
                    padding: t.padding,
                    textAlign: "center",
                    color: t.colorTextSecondary
                  },
                  children: xe
                }
              ) : /* @__PURE__ */ m(
                "div",
                {
                  "data-map-world": !0,
                  style: {
                    position: "absolute",
                    inset: 0,
                    transform: D,
                    transformOrigin: "center",
                    transition: "transform 180ms ease"
                  },
                  children: [
                    /* @__PURE__ */ r(nt, { source: n.map_source }),
                    /* @__PURE__ */ r("div", { "data-map-markers": !0, style: { position: "absolute", inset: 0 }, children: b.map((a) => {
                      const h = d === a.entry.entry_id;
                      return /* @__PURE__ */ m(
                        "button",
                        {
                          type: "button",
                          "data-map-marker": !0,
                          "data-marker-style": n.marker_style,
                          "data-entry-id": a.entry.entry_id,
                          title: a.label,
                          onClick: () => M(a),
                          onKeyDown: (S) => {
                            S.key === "Enter" && (S.preventDefault(), M(a));
                          },
                          style: {
                            position: "absolute",
                            left: `${a.x}%`,
                            top: `${a.y}%`,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: t.marginXXS,
                            minHeight: 32,
                            maxWidth: "48vw",
                            border: `1px solid ${h ? t.colorPrimary : t.colorBorderSecondary}`,
                            borderRadius: n.marker_style === "pin-title" ? t.borderRadius : 999,
                            paddingInline: t.paddingXS,
                            paddingBlock: 4,
                            color: t.colorText,
                            background: t.colorBgContainer,
                            boxShadow: h ? t.boxShadowSecondary : t.boxShadowTertiary,
                            font: "inherit",
                            fontSize: t.fontSizeSM,
                            cursor: "pointer",
                            transform: h ? "translate(-50%, -50%) scale(1.04)" : "translate(-50%, -50%)",
                            zIndex: h ? 3 : 1
                          },
                          children: [
                            /* @__PURE__ */ r(
                              "span",
                              {
                                "aria-hidden": "true",
                                style: {
                                  width: n.marker_style === "pin-title" ? 12 : 10,
                                  height: n.marker_style === "pin-title" ? 12 : 10,
                                  flex: "0 0 auto",
                                  borderRadius: n.marker_style === "pin-title" ? "999px 999px 999px 2px" : 999,
                                  background: t.colorPrimary,
                                  transform: n.marker_style === "pin-title" ? "rotate(-45deg)" : void 0
                                }
                              }
                            ),
                            /* @__PURE__ */ r(
                              "span",
                              {
                                style: {
                                  minWidth: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  fontWeight: 600
                                },
                                children: a.label
                              }
                            )
                          ]
                        },
                        a.entry.entry_id
                      );
                    }) })
                  ]
                }
              ),
              /* @__PURE__ */ m(
                "div",
                {
                  "data-map-controls": !0,
                  role: "group",
                  "aria-label": We,
                  style: {
                    position: "absolute",
                    top: t.marginSM,
                    insetInlineEnd: t.marginSM,
                    zIndex: 4,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: t.marginXXS
                  },
                  children: [
                    /* @__PURE__ */ r("button", { type: "button", "data-map-zoom": "in", "aria-label": Ue, onClick: () => G(j), style: x, children: "+" }),
                    /* @__PURE__ */ r("button", { type: "button", "data-map-zoom": "out", "aria-label": Ge, onClick: () => G(-j), style: x, children: "-" }),
                    /* @__PURE__ */ r("button", { type: "button", "data-map-pan": "north", "aria-label": Ze, onClick: () => N(C, 0), style: x, children: "↑" }),
                    /* @__PURE__ */ r("button", { type: "button", "data-map-pan": "south", "aria-label": Ye, onClick: () => N(-C, 0), style: x, children: "↓" }),
                    /* @__PURE__ */ r("button", { type: "button", "data-map-pan": "west", "aria-label": Ke, onClick: () => N(0, -C), style: x, children: "←" }),
                    /* @__PURE__ */ r("button", { type: "button", "data-map-pan": "east", "aria-label": Qe, onClick: () => N(0, C), style: x, children: "→" }),
                    /* @__PURE__ */ r("button", { type: "button", "data-map-reset-view": !0, onClick: ue, style: x, children: qe })
                  ]
                }
              ),
              l !== void 0 ? /* @__PURE__ */ r(
                ot,
                {
                  entry: l,
                  showCover: n.show_cover_on_select,
                  onClose: () => f(void 0)
                }
              ) : null
            ] })
          }
        ),
        p.length > 0 ? /* @__PURE__ */ m(
          "section",
          {
            "data-unlocated": !0,
            "aria-label": Q,
            style: { display: "flex", flexDirection: "column", gap: t.marginXXS },
            children: [
              /* @__PURE__ */ r("strong", { style: { color: t.colorText }, children: Q }),
              /* @__PURE__ */ r("div", { style: { display: "flex", flexWrap: "wrap", gap: t.marginXXS }, children: p.map((a) => /* @__PURE__ */ r(
                "button",
                {
                  type: "button",
                  "data-unlocated-entry": !0,
                  onClick: () => A(a),
                  style: x,
                  children: a.displayTitle
                },
                a.entry_id
              )) })
            ]
          }
        ) : null
      ]
    }
  );
}
const z = /* @__PURE__ */ new WeakMap();
function dt(e, t) {
  z.get(t)?.(), t.replaceChildren();
  const n = ee(t);
  J(() => {
    n.render(/* @__PURE__ */ r(lt, { box: e }));
  });
  let i = !1;
  const o = () => {
    i || (i = !0, n.unmount(), z.get(t) === o && z.delete(t));
  };
  return z.set(t, o), o;
}
function ct({ config: e, entries: t, onChange: n }) {
  const { token: i } = R.useToken(), [o] = u.useForm(), d = (s, p) => {
    n(P(p));
  }, f = (s) => {
    o.setFieldValue(["entries", s], void 0);
    const p = o.getFieldsValue(!0);
    n(P(p));
  }, c = o.getFieldValue(["map_source", "mode"]), g = c === "host-map" ? [
    { value: "image", label: Y },
    { value: "host-map", label: we, disabled: !0 }
  ] : [{ value: "image", label: Y }], b = {
    border: `1px solid ${i.colorBorderSecondary}`,
    borderRadius: i.borderRadius,
    padding: i.paddingXS,
    margin: 0,
    minWidth: 0
  };
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
      children: /* @__PURE__ */ m(
        u,
        {
          form: o,
          layout: "vertical",
          initialValues: e,
          onValuesChange: d,
          children: [
            /* @__PURE__ */ m("fieldset", { style: b, "data-editor-section": "map_source", children: [
              /* @__PURE__ */ r("legend", { style: { paddingInline: i.paddingXXS }, children: Pe }),
              /* @__PURE__ */ r(
                u.Item,
                {
                  label: "底图来源",
                  name: ["map_source", "mode"],
                  extra: c === "host-map" ? Te : Ie,
                  children: /* @__PURE__ */ r($, { options: g })
                }
              ),
              /* @__PURE__ */ r(u.Item, { noStyle: !0, shouldUpdate: !0, children: () => o.getFieldValue(["map_source", "mode"]) !== "image" ? null : /* @__PURE__ */ r(
                u.Item,
                {
                  label: "底图图片路径",
                  name: ["map_source", "assetPath"],
                  extra: "以 assets/ 开头的箱子资源相对路径；留空使用内置静态底图",
                  rules: [
                    {
                      validator: (p, l) => typeof l == "string" && l.length > 0 && !I(l) ? Promise.reject(
                        new Error("请输入以 assets/ 开头的合法箱子资源路径")
                      ) : Promise.resolve()
                    }
                  ],
                  children: /* @__PURE__ */ r(E, { id: "map-source-asset-path", placeholder: "assets/layouts/map/base-map/world.png" })
                }
              ) }),
              /* @__PURE__ */ r("div", { style: { display: "grid", gap: i.marginXS, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, children: ["west", "south", "east", "north"].map((s) => /* @__PURE__ */ r(u.Item, { label: Me[s], name: ["map_source", "bounds", s], children: /* @__PURE__ */ r(E, { id: `map-bounds-${s}`, inputMode: "decimal" }) }, s)) })
            ] }),
            /* @__PURE__ */ m("fieldset", { style: b, "data-editor-section": "default_view", children: [
              /* @__PURE__ */ r("legend", { style: { paddingInline: i.paddingXXS }, children: Le }),
              /* @__PURE__ */ m("div", { style: { display: "grid", gap: i.marginXS, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, children: [
                /* @__PURE__ */ r(u.Item, { label: "中心纬度", name: ["default_view", "latitude"], children: /* @__PURE__ */ r(E, { id: "map-default-latitude", inputMode: "decimal" }) }),
                /* @__PURE__ */ r(u.Item, { label: "中心经度", name: ["default_view", "longitude"], children: /* @__PURE__ */ r(E, { id: "map-default-longitude", inputMode: "decimal" }) })
              ] }),
              /* @__PURE__ */ r(u.Item, { label: "缩放", name: ["default_view", "zoom"], children: /* @__PURE__ */ r(me, { min: F, max: H, step: j }) }),
              /* @__PURE__ */ r(u.Item, { label: "点位样式", name: "marker_style", children: /* @__PURE__ */ r(
                $,
                {
                  options: Ee.map((s) => ({ value: s, label: ve[s] }))
                }
              ) }),
              /* @__PURE__ */ r(
                u.Item,
                {
                  label: "选中点位时显示条目预览",
                  name: "show_cover_on_select",
                  valuePropName: "checked",
                  extra: "关闭后仅显示标题与摘要；开启后选中点位按需挂载条目预览帧",
                  children: /* @__PURE__ */ r(pe, {})
                }
              )
            ] }),
            /* @__PURE__ */ m("fieldset", { style: b, "data-editor-section": "entries", children: [
              /* @__PURE__ */ r("legend", { style: { paddingInline: i.paddingXXS }, children: Ae }),
              /* @__PURE__ */ r("p", { style: { margin: 0, color: i.colorTextSecondary }, children: `当前箱子包含 ${t.length} 个条目` }),
              /* @__PURE__ */ r(u.Item, { noStyle: !0, shouldUpdate: !0, children: () => {
                const s = o.getFieldValue("entries"), p = typeof s == "object" && s !== null ? s : {};
                return /* @__PURE__ */ r(q, { children: t.map((l) => {
                  const w = p[l.entry_id] !== void 0;
                  return /* @__PURE__ */ m(
                    "div",
                    {
                      "data-editor-entry": l.entry_id,
                      style: { display: "grid", gap: i.marginXXS, paddingBlock: i.paddingXXS },
                      children: [
                        /* @__PURE__ */ r(
                          u.Item,
                          {
                            label: l.displayTitle,
                            name: ["entries", l.entry_id, "labelOverride"],
                            children: /* @__PURE__ */ r(E, { id: `map-entry-label-${l.entry_id}`, placeholder: "显示名称覆盖" })
                          }
                        ),
                        /* @__PURE__ */ m(
                          "div",
                          {
                            style: {
                              display: "grid",
                              gap: i.marginXXS,
                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
                            },
                            children: [
                              /* @__PURE__ */ r(u.Item, { label: "纬度", name: ["entries", l.entry_id, "latitude"], children: /* @__PURE__ */ r(E, { id: `map-entry-latitude-${l.entry_id}`, inputMode: "decimal" }) }),
                              /* @__PURE__ */ r(u.Item, { label: "经度", name: ["entries", l.entry_id, "longitude"], children: /* @__PURE__ */ r(E, { id: `map-entry-longitude-${l.entry_id}`, inputMode: "decimal" }) })
                            ]
                          }
                        ),
                        /* @__PURE__ */ r(
                          he,
                          {
                            type: "default",
                            "data-clear-location": l.entry_id,
                            disabled: !w,
                            onClick: () => f(l.entry_id),
                            children: "清除定位"
                          }
                        )
                      ]
                    },
                    l.entry_id
                  );
                }) });
              } })
            ] }),
            /* @__PURE__ */ m("fieldset", { style: b, "data-editor-section": "top_region", children: [
              /* @__PURE__ */ r("legend", { style: { paddingInline: i.paddingXXS }, children: re }),
              /* @__PURE__ */ r(u.Item, { label: "呈现模式", name: ["top_region", "mode"], children: /* @__PURE__ */ r(
                $,
                {
                  options: ["none", "image", "html"].map((s) => ({
                    value: s,
                    label: s === "none" ? "不显示" : s === "image" ? "图片" : "代码"
                  }))
                }
              ) }),
              /* @__PURE__ */ r(u.Item, { noStyle: !0, shouldUpdate: !0, children: () => {
                const s = o.getFieldValue(["top_region", "mode"]);
                return s === "image" ? /* @__PURE__ */ r(
                  u.Item,
                  {
                    label: "箱子资源路径",
                    name: ["top_region", "assetPath"],
                    extra: "以 assets/ 开头的箱子资源相对路径",
                    rules: [
                      {
                        validator: (p, l) => typeof l == "string" && l.length > 0 && !I(l) ? Promise.reject(
                          new Error("请输入以 assets/ 开头的合法箱子资源路径")
                        ) : Promise.resolve()
                      }
                    ],
                    children: /* @__PURE__ */ r(E, { id: "map-top-region-asset-path", placeholder: "assets/layouts/map/top-region/header.png" })
                  }
                ) : s === "html" ? /* @__PURE__ */ r(u.Item, { label: "HTML 代码", name: ["top_region", "html"], children: /* @__PURE__ */ r(E.TextArea, { id: "map-top-region-html", rows: 6, placeholder: "<section>…</section>" }) }) : null;
              } })
            ] })
          ]
        }
      )
    }
  );
}
class ut {
  state = "active";
  base;
  entries;
  revision;
  pending = null;
  dirty = !1;
  host;
  root;
  changeHandlers = /* @__PURE__ */ new Set();
  dirtyHandlers = /* @__PURE__ */ new Set();
  constructor(t, n) {
    this.base = P(t.layout_config), this.entries = t.entries, this.revision = t.revision, this.host = n, n.replaceChildren(), this.root = ee(n), this.mount();
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
    this.revision = t, n !== null && n.kind === "replace" && (this.base = P(n.config)), this.pending === n && (this.pending = null, this.setDirty(!1));
  }
  update(t, n) {
    this.state === "disposed" || n <= this.revision || (this.revision = n, this.base = P(t.layout_config), this.entries = t.entries, this.pending = null, this.setDirty(!1), this.mount());
  }
  subscribe(t, n) {
    if (this.state === "disposed")
      return { dispose: () => {
      } };
    if (t === "change") {
      const o = n;
      return this.changeHandlers.add(o), {
        dispose: () => {
          this.changeHandlers.delete(o);
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
    J(() => {
      this.root.render(
        /* @__PURE__ */ r(
          ct,
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
      schemaVersion: be
    }, i = this.pending !== null;
    this.pending = n, i || this.setDirty(!0);
    for (const o of this.changeHandlers)
      o({ change: n });
  };
  setDirty(t) {
    if (this.dirty !== t) {
      this.dirty = t;
      for (const n of this.dirtyHandlers)
        n({ isDirty: t });
    }
  }
}
function mt(e, t) {
  return new ut(e, t);
}
const _t = {
  attachRuntime: $e,
  renderLayout: dt,
  renderEditor: mt,
  validateConfig: He
};
export {
  $e as attachRuntime,
  _t as default,
  mt as renderEditor,
  dt as renderLayout,
  _t as renderPlugin
};
