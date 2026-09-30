import { jsx as i, jsxs as E, Fragment as we } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import p from "chips-resource://platform/vendor/react.js";
import { flushSync as he } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as me } from "chips-resource://platform/vendor/react-dom-client.js";
import { theme as w, MenuFoldOutlined as Ae, MenuUnfoldOutlined as Le, Form as v, Select as fe, Segmented as pe, Switch as Oe, EmbeddedDocumentFrame as C, LayoutSkeleton as De, SkeletonBlock as ke, SkeletonLine as Z, EmptyHint as Pe, Button as I, Input as U, Checkbox as Ce } from "chips-resource://platform/vendor/chips-ui.js";
const Be = "1.0.0", H = {
  sort_mode: "manual",
  sidebar_width: "regular",
  show_summary: !0
}, ge = 8, V = 500, K = 120, G = 160, Me = {
  compact: 220,
  regular: 280,
  wide: 360
}, ye = 16, Xe = ["manual", "name-asc", "name-desc"], $e = {
  manual: "手动顺序",
  "name-asc": "按名称升序",
  "name-desc": "按名称降序"
}, He = ["compact", "regular", "wide"], We = {
  compact: "紧凑",
  regular: "常规",
  wide: "宽"
}, Fe = "这里还没有内容", ze = "在编辑器中添加卡片或箱子，开始填充这个箱子", Ue = "文档库箱子布局", Ve = "文档目录", J = "隐藏目录", ee = "显示目录", _e = "背景区域", Ee = "顶部内容区", Ge = "缺失条目", Ye = "此目录节点引用的条目当前不在箱子中，配置会继续保留。", Te = "目录", te = "打开文档", re = {
  card: "卡片",
  box: "箱子"
}, Ke = "标签", je = "展开目录", qe = "收起目录", Qe = "条目内容暂时不可用", Ze = "条目暂时无法打开，请稍后重试", Je = "显示", et = "调整目录排序、侧栏宽度与摘要显隐", tt = "目录树", rt = "配置目录层级、默认折叠状态和标题覆盖；未放入目录树的条目仍会在查看态展示。", nt = "保持目录树与未归档条目的手动顺序", it = "查看态按目录标题动态排序", ot = "侧边栏宽度", st = "封面态显示摘要", dt = "当前箱子包含", at = "个条目", lt = "添加目录", ct = "目录节点", ut = "条目：", ht = "缺失条目：", mt = "展示方式：", ft = "卡片内容", pt = "卡片封面", gt = "箱子条目固定显示封面", yt = "默认折叠", _t = "上移", Et = "下移", Tt = "缩进", St = "取消缩进", bt = "移除", vt = "尚未配置目录树，未放入目录树的条目会直接展示。", It = "未放入目录树的条目", Nt = "没有未放入目录树的条目", xt = "加入：", Rt = "覆盖标题：", wt = /^assets\/[^\\:?#/]+(?:\/[^\\:?#/]+)*$/;
function O(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Se(e) {
  return e === "manual" || e === "name-asc" || e === "name-desc";
}
function be(e) {
  return e === "compact" || e === "regular" || e === "wide";
}
function ve(e) {
  return e === "content" || e === "cover";
}
function Ie(e) {
  return e === "none" || e === "image" || e === "html";
}
function M(e) {
  const t = e.trim();
  return t !== e || !wt.test(t) || t.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t) ? !1 : t.split("/").every((r) => r.length > 0 && r !== "." && r !== "..");
}
function ne(e) {
  const t = O(e) ? e : {}, r = Ie(t.mode) ? t.mode : "none", n = typeof t.assetPath == "string" ? t.assetPath : "", o = n.length > 0 && M(n) ? n : void 0, s = typeof t.html == "string" && t.html.trim().length > 0 ? t.html : void 0;
  return r === "image" ? o === void 0 ? { mode: "image" } : { mode: "image", assetPath: o } : r === "html" ? s === void 0 ? { mode: "html", html: typeof t.html == "string" ? t.html : "" } : { mode: "html", html: s } : { mode: "none" };
}
function Y(e) {
  return e.mode === "image" ? typeof e.assetPath == "string" && e.assetPath.trim().length > 0 : e.mode === "html" ? typeof e.html == "string" && e.html.trim().length > 0 : !1;
}
function At(e, t) {
  return typeof e == "string" && e.trim().length > 0 ? e.trim().slice(0, K) : t;
}
function ie(e) {
  if (typeof e != "string")
    return;
  const t = e.trim();
  return t.length > 0 ? t.slice(0, G) : void 0;
}
function Lt(e) {
  const t = /* @__PURE__ */ new Set();
  let r = 0;
  const n = (o, s, c) => {
    if (!Array.isArray(o) || s >= ge || r >= V)
      return [];
    const h = [];
    return o.forEach((f, a) => {
      if (r >= V)
        return;
      const u = O(f) ? f : {}, m = At(u.id, `${c}-${a + 1}`), T = t.has(m) ? `${m.slice(0, K)}-${a + 1}` : m;
      t.add(T), r += 1;
      const l = ie(u.entryId), g = {
        id: T,
        collapsed: u.collapsed === !0,
        children: n(u.children, s + 1, T)
      };
      l !== void 0 && (g.entryId = l, g.presentation = ve(u.presentation) ? u.presentation : "content");
      const y = ie(u.titleOverride);
      y !== void 0 && (g.titleOverride = y), h.push(g);
    }), h;
  };
  return n(e, 0, "node");
}
function A(e) {
  const t = O(e) ? e : {};
  return {
    sort_mode: Se(t.sort_mode) ? t.sort_mode : H.sort_mode,
    tree_nodes: Lt(t.tree_nodes),
    sidebar_width: be(t.sidebar_width) ? t.sidebar_width : H.sidebar_width,
    show_summary: typeof t.show_summary == "boolean" ? t.show_summary : H.show_summary,
    background: ne(t.background),
    top_region: ne(t.top_region)
  };
}
function Ne(e, t, r, n) {
  if (!O(e) || t >= ge || (n.count += 1, n.count > V) || typeof e.id != "string" || e.id.trim().length === 0)
    return !1;
  const o = e.id.trim();
  if (o.length > K || r.has(o))
    return !1;
  if (r.add(o), e.entryId !== void 0) {
    if (typeof e.entryId != "string" || e.entryId.trim().length === 0 || e.entryId.length > G || e.presentation !== void 0 && !ve(e.presentation))
      return !1;
  } else if (e.presentation !== void 0)
    return !1;
  if (e.titleOverride !== void 0 && (typeof e.titleOverride != "string" || e.titleOverride.length > G) || e.collapsed !== void 0 && typeof e.collapsed != "boolean")
    return !1;
  if (e.children !== void 0) {
    if (!Array.isArray(e.children))
      return !1;
    for (const s of e.children)
      if (!Ne(s, t + 1, r, n))
        return !1;
  }
  return !0;
}
function Ot(e) {
  if (e == null)
    return !0;
  if (!O(e) || e.sort_mode !== void 0 && !Se(e.sort_mode) || e.sidebar_width !== void 0 && !be(e.sidebar_width) || e.show_summary !== void 0 && typeof e.show_summary != "boolean")
    return !1;
  if (e.tree_nodes !== void 0) {
    if (!Array.isArray(e.tree_nodes))
      return !1;
    const t = /* @__PURE__ */ new Set(), r = { count: 0 };
    for (const n of e.tree_nodes)
      if (!Ne(n, 0, t, r))
        return !1;
  }
  return !(e.background !== void 0 && !oe(e.background) || e.top_region !== void 0 && !oe(e.top_region));
}
function oe(e) {
  return !O(e) || !Ie(e.mode) ? !1 : e.mode === "image" ? typeof e.assetPath == "string" && e.assetPath.length > 0 && M(e.assetPath) : e.mode === "html" ? typeof e.html == "string" && e.html.trim().length > 0 : !0;
}
function Dt(e) {
  const t = /* @__PURE__ */ new Set(), r = (n) => {
    for (const o of n)
      o.entryId !== void 0 && t.add(o.entryId), r(o.children);
  };
  return r(e), t;
}
function W(e) {
  return e?.contentType === "chips/box";
}
function kt(e, t) {
  return e.localeCompare(t, "zh-CN");
}
function xe(e, t) {
  const r = e.map((o) => ({ ...o, children: xe(o.children, t) }));
  if (t === "manual")
    return r;
  const n = t === "name-desc" ? -1 : 1;
  return r.sort((o, s) => {
    const c = kt(o.title, s.title);
    return c === 0 ? o.id.localeCompare(s.id) : c * n;
  });
}
function Pt(e) {
  const { configNodes: t, entries: r, sortMode: n } = e, o = new Map(r.map((a) => [a.entry_id, a])), s = Dt(t), c = (a, u) => {
    const m = a.entryId === void 0 ? void 0 : o.get(a.entryId), T = W(m?.snapshot), l = a.entryId !== void 0 && m === void 0, g = l ? Ge : m !== void 0 ? m.displayTitle : Te, y = {
      id: a.id,
      title: a.titleOverride ?? g,
      depth: u,
      collapsed: a.collapsed,
      configured: !0,
      missing: l,
      presentation: T ? "cover" : a.presentation ?? "content",
      isBox: T,
      children: a.children.map((_) => c(_, u + 1))
    };
    return a.entryId !== void 0 && (y.entryId = a.entryId), y;
  }, h = t.map((a) => c(a, 0)), f = r.filter((a) => a.enabled && !s.has(a.entry_id)).map(
    (a) => ({
      id: `unconfigured-${a.entry_id}`,
      entryId: a.entry_id,
      title: a.displayTitle,
      depth: 0,
      collapsed: !1,
      configured: !1,
      missing: !1,
      presentation: W(a.snapshot) ? "cover" : "content",
      isBox: W(a.snapshot),
      children: []
    })
  );
  return xe([...h, ...f], n);
}
function Ct(e, t) {
  const r = [], n = (o, s) => {
    const c = t[o.id] ?? o.collapsed;
    r.push({ ...o, depth: s, collapsed: c }), c || o.children.forEach((h) => {
      n(h, s + 1);
    });
  };
  return e.forEach((o) => {
    n(o, 0);
  }), r;
}
function Bt(e) {
  const t = "3 / 4", r = e?.aspectRatio;
  if (typeof r == "number" && Number.isFinite(r) && r > 0)
    return `${r}`;
  if (typeof r == "string" && r.trim().length > 0) {
    const n = r.trim();
    return n.includes(":") ? n.replace(":", " / ") : n;
  }
  return t;
}
function j(e) {
  const t = {
    id: e.id,
    collapsed: e.collapsed,
    children: e.children.map(j)
  };
  return e.entryId !== void 0 && (t.entryId = e.entryId), e.titleOverride !== void 0 && (t.titleOverride = e.titleOverride), e.presentation !== void 0 && (t.presentation = e.presentation), t;
}
function S(e) {
  return e.map(j);
}
function L(e, t) {
  let r = e;
  for (const n of t)
    r = r[n]?.children ?? [];
  return r;
}
function F(e, t, r) {
  const n = S(e), o = L(n, t.slice(0, -1)), s = t[t.length - 1];
  if (typeof s == "number" && o[s] !== void 0) {
    const c = o[s];
    c !== void 0 && (o[s] = r(c));
  }
  return n;
}
function q(e, t) {
  const r = S(e), n = L(r, t.slice(0, -1)), o = t[t.length - 1];
  if (typeof o != "number")
    return { nodes: r };
  const [s] = n.splice(o, 1);
  return s === void 0 ? { nodes: r } : { nodes: r, removed: s };
}
function Mt(e, t, r, n) {
  const o = S(e);
  return L(o, t).splice(r, 0, j(n)), o;
}
function Re(e, t = 0, r = []) {
  return e.flatMap((n, o) => {
    const s = [...r, o];
    return [{ node: n, path: s, depth: t }, ...Re(n.children, t + 1, s)];
  });
}
function se(e, t, r) {
  const n = t.slice(0, -1), o = t[t.length - 1];
  if (typeof o != "number")
    return S(e);
  const s = L(e, n), c = o + r;
  if (c < 0 || c >= s.length)
    return S(e);
  const h = S(e), f = L(h, n), [a] = f.splice(o, 1);
  return a === void 0 || f.splice(c, 0, a), h;
}
function Xt(e, t) {
  const r = t.slice(0, -1), n = t[t.length - 1];
  if (typeof n != "number" || n <= 0)
    return S(e);
  const o = q(e, t);
  return o.removed === void 0 ? S(e) : (L(o.nodes, [...r, n - 1]).push(o.removed), o.nodes);
}
function $t(e, t) {
  if (t.length <= 1)
    return S(e);
  const r = t.slice(0, -1), n = t.slice(0, -2), o = r[r.length - 1];
  if (typeof o != "number")
    return S(e);
  const s = q(e, t);
  return s.removed === void 0 ? S(e) : Mt(s.nodes, n, o + 1, s.removed);
}
let Q = null;
function Ht(e) {
  Q = e;
}
const z = 720;
function Wt(e) {
  const [t, r] = p.useState(
    () => e !== null && e.clientWidth <= z
  );
  return p.useEffect(() => {
    if (e === null)
      return;
    r(e.clientWidth <= z);
    const n = new ResizeObserver((o) => {
      const s = o[0];
      s !== void 0 && r(s.contentRect.width <= z);
    });
    return n.observe(e), () => {
      n.disconnect();
    };
  }, [e]), t;
}
function de({
  region: e,
  title: t,
  variant: r
}) {
  return Y(e) ? e.mode === "html" && e.html !== void 0 ? r === "background" ? /* @__PURE__ */ i(C, { title: t, srcDoc: e.html, ratio: "16:9", sandbox: "allow-scripts" }) : /* @__PURE__ */ i(
    C,
    {
      title: t,
      srcDoc: e.html,
      autoHeight: !0,
      maxHeightFactor: 3,
      sandbox: "allow-scripts"
    }
  ) : e.mode === "image" && e.assetPath !== void 0 && M(e.assetPath) ? r === "background" ? /* @__PURE__ */ i(C, { title: t, src: e.assetPath, ratio: "16:9", sandbox: "allow-scripts" }) : /* @__PURE__ */ i(C, { title: t, src: e.assetPath, autoHeight: !0, sandbox: "allow-scripts" }) : null : null;
}
function ae({ entry: e }) {
  const { token: t } = w.useToken(), r = p.useRef(null), [n, o] = p.useState(null);
  return p.useEffect(() => {
    const s = Q, c = r.current;
    if (s === null || c === null)
      return;
    let h = !1, f = null;
    return s.requestEntries({ entryIds: [e.entry_id] }).then(async (a) => {
      const u = a[0];
      if (h || u === void 0)
        return;
      const m = await s.mountEntry(u, c);
      h ? m() : f = m;
    }).catch(() => {
      h || o(Qe);
    }), () => {
      h = !0, f?.();
    };
  }, [e.entry_id]), /* @__PURE__ */ E(
    "div",
    {
      style: {
        position: "relative",
        width: "100%",
        minWidth: 0,
        minHeight: 240,
        boxSizing: "border-box"
      },
      children: [
        /* @__PURE__ */ i(
          "div",
          {
            ref: r,
            "data-entry-slot": !0,
            style: { width: "100%", minHeight: 240, overflow: "hidden" }
          }
        ),
        n !== null ? /* @__PURE__ */ i(
          "div",
          {
            "data-entry-status": !0,
            role: "status",
            style: {
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: t.padding,
              color: t.colorTextSecondary,
              textAlign: "center",
              pointerEvents: "none"
            },
            children: n
          }
        ) : null
      ]
    }
  );
}
function Ft(e) {
  if (e === void 0)
    return [];
  const t = e.tags;
  if (!Array.isArray(t))
    return [];
  const r = [];
  for (const n of t)
    if (typeof n == "string" && n.length > 0)
      r.push(n);
    else if (Array.isArray(n)) {
      const o = n.filter(
        (s) => typeof s == "string" && s.length > 0
      );
      o.length > 0 && r.push(o.join(" / "));
    }
  return r;
}
function zt(e, t) {
  const r = Q;
  r !== null && r.openDocument(e.url).catch(() => {
    t(Ze);
  });
}
function Ut({ node: e, entry: t, showSummary: r }) {
  const { token: n } = w.useToken(), [o, s] = p.useState(null);
  if (e.entryId === void 0 || t === void 0)
    return /* @__PURE__ */ E("div", { "data-document-preview": !0, "data-missing": "true", children: [
      /* @__PURE__ */ i("h1", { "data-document-title": !0, style: { margin: 0, fontSize: n.fontSizeXL, color: n.colorText }, children: e.title }),
      /* @__PURE__ */ i("p", { style: { margin: 0, color: n.colorTextSecondary }, children: Ye })
    ] });
  const c = () => {
    s(null), zt(t, s);
  };
  if (e.presentation === "content" && !e.isBox)
    return /* @__PURE__ */ i(
      "div",
      {
        "data-document-preview": !0,
        "data-presentation": "content",
        "data-entry-id": t.entry_id,
        style: { minWidth: 0 },
        children: /* @__PURE__ */ i(ae, { entry: t })
      }
    );
  const h = typeof t.snapshot?.summary == "string" ? t.snapshot.summary.trim() : "", f = Ft(t.snapshot), a = Bt(t.layout_hints);
  return /* @__PURE__ */ E(
    "article",
    {
      "data-document-preview": !0,
      "data-presentation": "cover",
      "data-entry-id": t.entry_id,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: n.marginXS,
        minWidth: 0,
        color: n.colorText
      },
      children: [
        /* @__PURE__ */ i(
          "div",
          {
            "data-cover-shell": !0,
            "data-cover-ratio": a,
            role: "button",
            tabIndex: 0,
            "aria-label": `${te}：${e.title}`,
            style: {
              width: "min(100%, 520px)",
              aspectRatio: a,
              overflow: "hidden",
              borderRadius: n.borderRadiusLG,
              border: `1px solid ${n.colorBorderSecondary}`,
              background: n.colorBgContainer,
              cursor: "pointer",
              boxSizing: "border-box"
            },
            onClick: c,
            onKeyDown: (u) => {
              (u.key === "Enter" || u.key === " ") && (u.preventDefault(), c());
            },
            children: /* @__PURE__ */ i(ae, { entry: t })
          }
        ),
        /* @__PURE__ */ i("h1", { "data-document-title": !0, style: { margin: 0, fontSize: n.fontSizeXL }, children: e.title }),
        /* @__PURE__ */ i("p", { style: { margin: 0, color: n.colorTextSecondary }, children: e.isBox ? re.box : re.card }),
        r && h.length > 0 ? /* @__PURE__ */ i("p", { "data-document-summary": !0, style: { margin: 0, color: n.colorTextSecondary }, children: h }) : null,
        f.length > 0 ? /* @__PURE__ */ i(
          "div",
          {
            "data-document-tags": !0,
            "aria-label": Ke,
            style: { display: "flex", flexWrap: "wrap", gap: n.marginXXS },
            children: f.map((u) => /* @__PURE__ */ i(
              "span",
              {
                style: {
                  padding: "2px 8px",
                  borderRadius: n.borderRadiusSM,
                  background: n.colorFillQuaternary,
                  color: n.colorTextSecondary,
                  fontSize: n.fontSizeSM
                },
                children: u
              },
              u
            ))
          }
        ) : null,
        /* @__PURE__ */ i("div", { children: /* @__PURE__ */ i(I, { "data-open-document": !0, onClick: c, children: te }) }),
        o !== null ? /* @__PURE__ */ i("p", { role: "alert", style: { margin: 0, color: n.colorError }, children: o }) : null
      ]
    }
  );
}
const Vt = [0, 0, 24, 24, 48, 48];
function Gt() {
  const { token: e } = w.useToken();
  return /* @__PURE__ */ i(
    De,
    {
      hint: /* @__PURE__ */ i(Pe, { title: Fe, description: ze }),
      children: /* @__PURE__ */ i(
        "div",
        {
          "data-library-skeleton": !0,
          "aria-hidden": "true",
          style: { display: "grid", gap: e.marginXS, width: "100%" },
          children: Vt.map((t, r) => /* @__PURE__ */ E(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: e.marginSM,
                paddingBlock: e.paddingXS,
                paddingInlineStart: t,
                borderBottom: `1px solid ${e.colorBorderSecondary}`
              },
              children: [
                /* @__PURE__ */ i(ke, { width: 28, height: 28, radius: 8 }),
                /* @__PURE__ */ i(Z, { style: { flex: 1, maxWidth: 260 } }),
                /* @__PURE__ */ i(Z, { width: 64, height: 8 })
              ]
            },
            `skeleton-row-${r}`
          ))
        }
      )
    }
  );
}
function Yt({ box: e }) {
  const { token: t } = w.useToken(), [r, n] = p.useState(null), o = Wt(r), s = p.useMemo(() => A(e.layout_config), [e.layout_config]), [c, h] = p.useState({}), [f, a] = p.useState(void 0), [u, m] = p.useState(!0), T = p.useMemo(
    () => e.entries.filter((d) => d.enabled),
    [e.entries]
  ), l = p.useMemo(
    () => new Map(T.map((d) => [d.entry_id, d])),
    [T]
  ), g = p.useMemo(
    () => Pt({
      configNodes: s.tree_nodes,
      entries: T,
      sortMode: s.sort_mode
    }),
    [s.sort_mode, s.tree_nodes, T]
  ), y = p.useMemo(
    () => Ct(g, c),
    [c, g]
  ), _ = p.useMemo(() => {
    if (f !== void 0) {
      const d = y.find((b) => b.id === f);
      if (d !== void 0)
        return d;
    }
    return y.find((d) => d.entryId !== void 0 && !d.missing) ?? y[0];
  }, [y, f]), D = _ !== void 0 && _.entryId !== void 0 ? l.get(_.entryId) : void 0, k = (d) => {
    const b = c[d.id] ?? d.collapsed;
    h((R) => ({ ...R, [d.id]: !b }));
  }, X = (d) => {
    if (y.length === 0)
      return;
    const b = Math.max(
      0,
      y.findIndex((P) => P.id === _?.id)
    );
    if (d.key === "ArrowDown") {
      d.preventDefault(), a(y[Math.min(y.length - 1, b + 1)]?.id);
      return;
    }
    if (d.key === "ArrowUp") {
      d.preventDefault(), a(y[Math.max(0, b - 1)]?.id);
      return;
    }
    const R = _;
    if (!(R === void 0 || R.children.length === 0)) {
      if (d.key === "ArrowRight") {
        d.preventDefault(), h((P) => ({ ...P, [R.id]: !1 }));
        return;
      }
      if (d.key === "ArrowLeft") {
        d.preventDefault(), h((P) => ({ ...P, [R.id]: !0 }));
        return;
      }
      (d.key === "Enter" || d.key === " ") && (d.preventDefault(), a(R.id));
    }
  }, N = Y(s.background), x = Y(s.top_region), $ = {
    display: "grid",
    gridTemplateColumns: o ? "minmax(0, 1fr)" : u ? `minmax(0, ${Me[s.sidebar_width]}px) minmax(0, 1fr)` : "minmax(0, 1fr)",
    gap: t.margin,
    alignItems: "start",
    alignContent: "start",
    minWidth: 0
  };
  return /* @__PURE__ */ E(
    "div",
    {
      ref: n,
      "aria-label": Ue,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: t.marginXS,
        minHeight: "100%",
        padding: t.padding,
        boxSizing: "border-box"
      },
      children: [
        N ? /* @__PURE__ */ i("div", { "aria-hidden": "true", style: { width: "100%" }, children: /* @__PURE__ */ i(
          de,
          {
            region: s.background,
            title: _e,
            variant: "background"
          }
        ) }) : null,
        x ? /* @__PURE__ */ i("div", { style: { width: "100%" }, children: /* @__PURE__ */ i(de, { region: s.top_region, title: Ee, variant: "top" }) }) : null,
        y.length === 0 ? /* @__PURE__ */ i(Gt, {}) : /* @__PURE__ */ E(we, { children: [
          /* @__PURE__ */ i("div", { style: { display: "flex", justifyContent: "flex-end", minWidth: 0 }, children: /* @__PURE__ */ i(
            "button",
            {
              type: "button",
              "data-sidebar-toggle": !0,
              "aria-expanded": u,
              "aria-controls": "document-library-tree",
              "aria-label": u ? J : ee,
              title: u ? J : ee,
              onClick: () => {
                m((d) => !d);
              },
              style: {
                display: "inline-grid",
                placeItems: "center",
                width: 36,
                height: 36,
                padding: 0,
                border: `1px solid ${t.colorBorderSecondary}`,
                borderRadius: t.borderRadius,
                background: t.colorBgContainer,
                color: t.colorText,
                cursor: "pointer"
              },
              children: u ? /* @__PURE__ */ i(Ae, { "aria-hidden": "true" }) : /* @__PURE__ */ i(Le, { "aria-hidden": "true" })
            }
          ) }),
          /* @__PURE__ */ E("div", { "data-library-main": !0, style: $, children: [
            u ? /* @__PURE__ */ i(
              "nav",
              {
                id: "document-library-tree",
                "data-document-tree": !0,
                "aria-label": Ve,
                onKeyDown: X,
                style: {
                  alignSelf: "start",
                  display: "grid",
                  gap: t.paddingXS,
                  minWidth: 0,
                  maxHeight: "calc(100vh - 64px)",
                  overflow: "auto",
                  padding: t.paddingSM,
                  border: `1px solid ${t.colorBorderSecondary}`,
                  borderRadius: t.borderRadiusLG,
                  background: t.colorBgContainer,
                  boxSizing: "border-box"
                },
                children: /* @__PURE__ */ i("div", { role: "tree", style: { display: "grid", gap: t.marginXXS, minWidth: 0 }, children: y.map((d) => {
                  const b = _?.id === d.id;
                  return /* @__PURE__ */ E(
                    "div",
                    {
                      "data-tree-row": !0,
                      "data-node-id": d.id,
                      role: "treeitem",
                      "aria-selected": b,
                      "aria-expanded": d.children.length > 0 ? !d.collapsed : void 0,
                      "data-missing": d.missing ? "true" : void 0,
                      "data-unconfigured": d.configured ? void 0 : "true",
                      style: {
                        display: "grid",
                        gridTemplateColumns: "28px minmax(0, 1fr)",
                        alignItems: "center",
                        minWidth: 0,
                        borderRadius: t.borderRadius,
                        paddingInlineStart: `calc(${d.depth} * ${ye}px)`,
                        background: b ? t.colorFillQuaternary : "transparent"
                      },
                      children: [
                        /* @__PURE__ */ i(
                          "button",
                          {
                            type: "button",
                            "data-tree-toggle": !0,
                            disabled: d.children.length === 0,
                            "aria-label": d.collapsed ? je : qe,
                            onClick: () => {
                              k(d);
                            },
                            style: {
                              width: 28,
                              height: 28,
                              display: "grid",
                              placeItems: "center",
                              border: 0,
                              margin: 0,
                              background: "none",
                              color: t.colorTextSecondary,
                              font: "inherit",
                              cursor: d.children.length > 0 ? "pointer" : "default"
                            },
                            children: d.children.length > 0 ? d.collapsed ? "+" : "-" : ""
                          }
                        ),
                        /* @__PURE__ */ i(
                          "button",
                          {
                            type: "button",
                            "data-tree-title": !0,
                            title: d.title,
                            onClick: () => {
                              a(d.id);
                            },
                            style: {
                              display: "block",
                              minWidth: 0,
                              padding: `${t.paddingXXS}px ${t.paddingXS}px`,
                              border: 0,
                              margin: 0,
                              background: "none",
                              color: d.missing ? t.colorTextSecondary : t.colorText,
                              fontStyle: d.missing ? "italic" : "normal",
                              font: "inherit",
                              textAlign: "start",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              cursor: "pointer"
                            },
                            children: d.title
                          }
                        )
                      ]
                    },
                    d.id
                  );
                }) })
              }
            ) : null,
            _ !== void 0 ? /* @__PURE__ */ i(
              Ut,
              {
                node: _,
                entry: D,
                showSummary: s.show_summary
              }
            ) : null
          ] })
        ] })
      ]
    }
  );
}
const B = /* @__PURE__ */ new WeakMap();
function Kt(e, t) {
  B.get(t)?.(), t.replaceChildren();
  const r = me(t);
  he(() => {
    r.render(/* @__PURE__ */ i(Yt, { box: e }));
  });
  let n = !1;
  const o = () => {
    n || (n = !0, r.unmount(), B.get(t) === o && B.delete(t));
  };
  return B.set(t, o), o;
}
function le({ title: e, field: t }) {
  const { token: r } = w.useToken();
  return /* @__PURE__ */ E(
    "fieldset",
    {
      "data-editor-section": t,
      style: {
        border: `1px solid ${r.colorBorderSecondary}`,
        borderRadius: r.borderRadius,
        padding: r.paddingXS,
        margin: 0,
        minWidth: 0
      },
      children: [
        /* @__PURE__ */ i("legend", { style: { paddingInline: r.paddingXXS }, children: e }),
        /* @__PURE__ */ i(v.Item, { label: "呈现模式", name: [t, "mode"], children: /* @__PURE__ */ i(
          fe,
          {
            options: ["none", "image", "html"].map((n) => ({
              value: n,
              label: n === "none" ? "不显示" : n === "image" ? "图片" : "代码"
            }))
          }
        ) }),
        /* @__PURE__ */ i(v.Item, { noStyle: !0, shouldUpdate: !0, children: ({ getFieldValue: n }) => {
          const o = n([t, "mode"]);
          return o === "image" ? /* @__PURE__ */ i(
            v.Item,
            {
              label: "箱子资源路径",
              name: [t, "assetPath"],
              extra: "以 assets/ 开头的箱子自有资源相对路径",
              rules: [
                {
                  validator: (s, c) => typeof c == "string" && c.length > 0 && !M(c) ? Promise.reject(
                    new Error("请输入以 assets/ 开头的合法箱子资源路径")
                  ) : Promise.resolve()
                }
              ],
              children: /* @__PURE__ */ i(U, { id: `${t}-asset-path`, placeholder: `assets/layouts/${t}/banner.png` })
            }
          ) : o === "html" ? /* @__PURE__ */ i(v.Item, { label: "HTML 代码", name: [t, "html"], children: /* @__PURE__ */ i(U.TextArea, { id: `${t}-html`, rows: 6, placeholder: "<section>…</section>" }) }) : null;
        } })
      ]
    }
  );
}
function ce(e) {
  return e.displayTitle;
}
function ue(e) {
  return e?.snapshot?.contentType === "chips/box";
}
function jt({ nodes: e, entries: t, onChange: r }) {
  const { token: n } = w.useToken(), o = p.useRef(0), s = p.useMemo(() => Re(e), [e]), c = p.useMemo(
    () => new Map(t.map((l) => [l.entry_id, l])),
    [t]
  ), h = p.useMemo(() => {
    const l = /* @__PURE__ */ new Set(), g = (y) => {
      for (const _ of y)
        _.entryId !== void 0 && l.add(_.entryId), g(_.children);
    };
    return g(e), l;
  }, [e]), f = t.filter((l) => !h.has(l.entry_id)), a = (l) => ({
    display: "grid",
    gap: n.marginXXS,
    minWidth: 0,
    marginInlineStart: l * ye,
    padding: n.paddingXS,
    border: `1px solid ${n.colorBorderSecondary}`,
    borderRadius: n.borderRadiusSM,
    background: n.colorBgContainer
  }), u = { display: "flex", flexWrap: "wrap", gap: n.marginXXS }, m = () => {
    o.current += 1, r([
      ...e,
      { id: `group-${o.current}`, titleOverride: "", collapsed: !1, children: [] }
    ]);
  }, T = (l) => {
    r([
      ...e,
      {
        id: `entry-${l.entry_id}`,
        entryId: l.entry_id,
        presentation: ue(l) ? "cover" : "content",
        collapsed: !1,
        children: []
      }
    ]);
  };
  return /* @__PURE__ */ E("div", { style: { display: "grid", gap: n.marginSM, minWidth: 0 }, children: [
    /* @__PURE__ */ i("div", { style: u, children: /* @__PURE__ */ i(I, { "data-action": "add-group", onClick: m, children: lt }) }),
    s.length > 0 ? /* @__PURE__ */ i("div", { style: { display: "grid", gap: n.marginXS, minWidth: 0 }, children: s.map(({ node: l, path: g, depth: y }) => {
      const _ = l.entryId === void 0 ? void 0 : c.get(l.entryId), D = _ !== void 0 ? ce(_) : l.entryId !== void 0 ? l.entryId : Te, k = ue(_), X = k ? "cover" : l.presentation ?? "content";
      return /* @__PURE__ */ E("div", { "data-editor-node": l.id, style: a(y), children: [
        /* @__PURE__ */ i(
          U,
          {
            "data-node-title": l.id,
            id: `node-title-${l.id}`,
            value: l.titleOverride ?? "",
            placeholder: D,
            "aria-label": `${Rt}${D}`,
            onChange: (N) => {
              const x = N.currentTarget.value;
              r(
                F(e, g, ($) => ({
                  ...$,
                  titleOverride: x
                }))
              );
            }
          }
        ),
        /* @__PURE__ */ i(
          "div",
          {
            style: {
              minWidth: 0,
              color: n.colorTextSecondary,
              fontSize: n.fontSizeSM,
              overflowWrap: "anywhere"
            },
            children: l.entryId === void 0 ? ct : _ !== void 0 ? `${ut}${l.entryId}` : `${ht}${l.entryId}`
          }
        ),
        l.entryId !== void 0 ? /* @__PURE__ */ E("div", { "data-node-presentation": l.id, style: { minWidth: 0 }, children: [
          /* @__PURE__ */ i(
            pe,
            {
              block: !0,
              "aria-label": `${mt}${D}`,
              value: X,
              disabled: k,
              options: [
                { label: ft, value: "content" },
                { label: pt, value: "cover" }
              ],
              onChange: (N) => {
                r(
                  F(e, g, (x) => ({
                    ...x,
                    presentation: N === "cover" ? "cover" : "content"
                  }))
                );
              }
            }
          ),
          k ? /* @__PURE__ */ i("div", { style: { color: n.colorTextSecondary, fontSize: n.fontSizeSM }, children: gt }) : null
        ] }) : null,
        /* @__PURE__ */ i(
          Ce,
          {
            checked: l.collapsed,
            onChange: (N) => {
              r(
                F(e, g, (x) => ({
                  ...x,
                  collapsed: N.target.checked
                }))
              );
            },
            children: yt
          }
        ),
        /* @__PURE__ */ E("div", { style: u, children: [
          /* @__PURE__ */ i(
            I,
            {
              size: "small",
              "data-action": "move-up",
              onClick: () => {
                r(se(e, g, -1));
              },
              children: _t
            }
          ),
          /* @__PURE__ */ i(
            I,
            {
              size: "small",
              "data-action": "move-down",
              onClick: () => {
                r(se(e, g, 1));
              },
              children: Et
            }
          ),
          /* @__PURE__ */ i(
            I,
            {
              size: "small",
              "data-action": "indent",
              onClick: () => {
                r(Xt(e, g));
              },
              children: Tt
            }
          ),
          /* @__PURE__ */ i(
            I,
            {
              size: "small",
              "data-action": "outdent",
              onClick: () => {
                r($t(e, g));
              },
              children: St
            }
          ),
          /* @__PURE__ */ i(
            I,
            {
              size: "small",
              danger: !0,
              "data-action": "remove",
              onClick: () => {
                r(q(e, g).nodes);
              },
              children: bt
            }
          )
        ] })
      ] }, l.id);
    }) }) : /* @__PURE__ */ i("span", { style: { color: n.colorTextSecondary }, children: vt }),
    /* @__PURE__ */ E(
      "fieldset",
      {
        style: {
          border: `1px solid ${n.colorBorderSecondary}`,
          borderRadius: n.borderRadius,
          padding: n.paddingXS,
          margin: 0,
          minWidth: 0
        },
        children: [
          /* @__PURE__ */ i("legend", { style: { paddingInline: n.paddingXXS }, children: It }),
          /* @__PURE__ */ i("div", { style: u, children: f.length > 0 ? f.map((l) => /* @__PURE__ */ i(
            I,
            {
              "data-add-entry": l.entry_id,
              onClick: () => {
                T(l);
              },
              children: `${xt}${ce(l)}`
            },
            l.entry_id
          )) : /* @__PURE__ */ i("span", { style: { color: n.colorTextSecondary }, children: Nt }) })
        ]
      }
    )
  ] });
}
function qt({
  config: e,
  entries: t,
  onChange: r
}) {
  const { token: n } = w.useToken(), [o] = v.useForm(), [s, c] = p.useState(
    e.tree_nodes
  ), h = p.useRef(e.tree_nodes), f = (m, T) => {
    r(A({ ...T, tree_nodes: h.current }));
  }, a = (m) => {
    h.current = m, c(m), r(A({ ...o.getFieldsValue(!0), tree_nodes: m }));
  }, u = {
    border: `1px solid ${n.colorBorderSecondary}`,
    borderRadius: n.borderRadius,
    padding: n.paddingXS,
    margin: 0,
    minWidth: 0
  };
  return /* @__PURE__ */ i(
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
      children: /* @__PURE__ */ E(
        v,
        {
          layout: "vertical",
          initialValues: e,
          onValuesChange: f,
          children: [
            /* @__PURE__ */ E("fieldset", { "data-editor-section": "display", style: u, children: [
              /* @__PURE__ */ i("legend", { style: { paddingInline: n.paddingXXS }, children: Je }),
              /* @__PURE__ */ i("p", { style: { margin: 0, color: n.colorTextSecondary }, children: et }),
              /* @__PURE__ */ i(
                v.Item,
                {
                  label: "排序方式",
                  name: "sort_mode",
                  extra: e.sort_mode === "manual" ? nt : it,
                  children: /* @__PURE__ */ i(
                    fe,
                    {
                      options: Xe.map((m) => ({ value: m, label: $e[m] }))
                    }
                  )
                }
              ),
              /* @__PURE__ */ i(v.Item, { label: ot, name: "sidebar_width", children: /* @__PURE__ */ i(
                pe,
                {
                  options: He.map((m) => ({
                    value: m,
                    label: We[m]
                  }))
                }
              ) }),
              /* @__PURE__ */ i(v.Item, { label: st, name: "show_summary", valuePropName: "checked", children: /* @__PURE__ */ i(Oe, {}) }),
              /* @__PURE__ */ i("p", { style: { margin: 0, color: n.colorTextSecondary }, children: `${dt} ${t.length} ${at}` })
            ] }),
            /* @__PURE__ */ E("fieldset", { "data-editor-section": "tree", style: u, children: [
              /* @__PURE__ */ i("legend", { style: { paddingInline: n.paddingXXS }, children: tt }),
              /* @__PURE__ */ i("p", { style: { margin: 0, color: n.colorTextSecondary }, children: rt }),
              /* @__PURE__ */ i(jt, { nodes: s, entries: t, onChange: a })
            ] }),
            /* @__PURE__ */ i(le, { title: _e, field: "background" }),
            /* @__PURE__ */ i(le, { title: Ee, field: "top_region" })
          ]
        }
      )
    }
  );
}
class Qt {
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
  constructor(t, r) {
    this.base = A(t.layout_config), this.entries = t.entries, this.revision = t.revision, this.host = r, r.replaceChildren(), this.root = me(r), this.mount();
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
    const r = this.pending;
    this.revision = t, r !== null && r.kind === "replace" && (this.base = A(r.config)), this.pending === r && (this.pending = null, this.setDirty(!1));
  }
  update(t, r) {
    this.state === "disposed" || r <= this.revision || (this.revision = r, this.base = A(t.layout_config), this.entries = t.entries, this.pending = null, this.setDirty(!1), this.mount());
  }
  subscribe(t, r) {
    if (this.state === "disposed")
      return { dispose: () => {
      } };
    if (t === "change") {
      const o = r;
      return this.changeHandlers.add(o), {
        dispose: () => {
          this.changeHandlers.delete(o);
        }
      };
    }
    const n = r;
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
    he(() => {
      this.root.render(
        /* @__PURE__ */ i(
          qt,
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
    const r = {
      kind: "replace",
      config: { ...t },
      schemaVersion: Be
    }, n = this.pending !== null;
    this.pending = r, n || this.setDirty(!0);
    for (const o of this.changeHandlers)
      o({ change: r });
  };
  setDirty(t) {
    if (this.dirty !== t) {
      this.dirty = t;
      for (const r of this.dirtyHandlers)
        r({ isDirty: t });
    }
  }
}
function Zt(e, t) {
  return new Qt(e, t);
}
const ir = {
  attachRuntime: Ht,
  renderLayout: Kt,
  renderEditor: Zt,
  validateConfig: Ot
};
export {
  Ht as attachRuntime,
  ir as default,
  Zt as renderEditor,
  Kt as renderLayout,
  ir as renderPlugin
};
