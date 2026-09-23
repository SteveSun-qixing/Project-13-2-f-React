import { jsx as i, jsxs as y } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import u from "chips-resource://platform/vendor/react.js";
import { flushSync as G } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as B } from "chips-resource://platform/vendor/react-dom-client.js";
import { theme as E, LayoutSkeleton as q, SkeletonBlock as Z, SkeletonLine as N, EmptyHint as $, Form as d, Slider as J, Select as k, Switch as Q, EmbeddedDocumentFrame as _, Input as H } from "chips-resource://platform/vendor/chips-ui.js";
const S = {
  gap: 16,
  show_tags: !0,
  information_density: "comfortable",
  sort_mode: "manual"
}, tt = "1.0.0", M = 0, A = 64, et = ["comfortable", "compact"], nt = {
  comfortable: "舒适",
  compact: "紧凑"
}, st = ["manual", "name-asc", "name-desc"], it = {
  manual: "手动顺序",
  "name-asc": "按名称升序",
  "name-desc": "按名称降序"
}, rt = ["none", "image", "html"], ot = {
  none: "不显示",
  image: "图片",
  html: "代码"
}, V = "背景区域", W = "顶部区域", at = 600, lt = 200, D = 2, dt = 8, ct = /^assets\/[^\\:?#/]+(?:\/[^\\:?#/]+)*$/;
function v(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function j(t) {
  return t === "compact" || t === "comfortable";
}
function U(t) {
  return t === "manual" || t === "name-asc" || t === "name-desc";
}
function K(t) {
  return t === "none" || t === "image" || t === "html";
}
function w(t) {
  const e = t.trim();
  return e !== t || !ct.test(e) || e.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(e) ? !1 : e.split("/").every((n) => n.length > 0 && n !== "." && n !== "..");
}
function L(t) {
  const e = v(t) ? t : {}, n = K(e.mode) ? e.mode : "none", s = typeof e.assetPath == "string" ? e.assetPath : "", r = s.length > 0 && w(s) ? s : void 0, o = typeof e.html == "string" && e.html.trim().length > 0 ? e.html : void 0;
  return n === "image" ? r === void 0 ? { mode: "image" } : { mode: "image", assetPath: r } : n === "html" ? o === void 0 ? { mode: "html", html: typeof e.html == "string" ? e.html : "" } : { mode: "html", html: o } : { mode: "none" };
}
function C(t) {
  return t.mode === "image" ? typeof t.assetPath == "string" && t.assetPath.trim().length > 0 : t.mode === "html" ? typeof t.html == "string" && t.html.trim().length > 0 : !1;
}
function p(t) {
  const e = v(t) ? t : {}, n = e.gap, s = e.show_tags, r = e.information_density;
  return {
    gap: typeof n == "number" && Number.isFinite(n) ? Math.min(Math.max(Math.round(n), M), A) : S.gap,
    show_tags: typeof s == "boolean" ? s : S.show_tags,
    information_density: j(r) ? r : S.information_density,
    sort_mode: U(e.sort_mode) ? e.sort_mode : S.sort_mode,
    background: L(e.background),
    top_region: L(e.top_region)
  };
}
function F(t) {
  return !v(t) || !K(t.mode) ? !1 : t.mode === "image" ? typeof t.assetPath == "string" && t.assetPath.length > 0 && w(t.assetPath) : t.mode === "html" ? typeof t.html == "string" && t.html.trim().length > 0 : !0;
}
function ut(t) {
  if (t == null)
    return !0;
  if (!v(t))
    return !1;
  const e = t.gap, n = t.show_tags, s = t.information_density;
  return !(e !== void 0 && (typeof e != "number" || !Number.isInteger(e) || e < M || e > A) || n !== void 0 && typeof n != "boolean" || s !== void 0 && !j(s) || t.sort_mode !== void 0 && !U(t.sort_mode) || t.background !== void 0 && !F(t.background) || t.top_region !== void 0 && !F(t.top_region));
}
function x(t) {
  if (!Number.isFinite(t) || t <= at)
    return D;
  const e = Math.floor(t / lt);
  return Math.min(dt, Math.max(D, e));
}
const ht = 80;
let R = null;
function mt(t) {
  R = t;
}
function ft(t) {
  const [e, n] = u.useState(
    () => t === null ? 0 : x(t.clientWidth)
  );
  return u.useEffect(() => {
    if (t === null)
      return;
    n(x(t.clientWidth));
    const s = new ResizeObserver((r) => {
      const o = r[0];
      o !== void 0 && n(x(o.contentRect.width));
    });
    return s.observe(t), () => {
      s.disconnect();
    };
  }, [t]), e;
}
function gt(t) {
  if (t === void 0)
    return [];
  const e = t.tags;
  if (!Array.isArray(e))
    return [];
  const n = [];
  for (const s of e)
    if (typeof s == "string" && s.length > 0)
      n.push(s);
    else if (Array.isArray(s)) {
      const r = s.filter(
        (o) => typeof o == "string" && o.length > 0
      );
      r.length > 0 && n.push(r.join(" / "));
    }
  return n;
}
function pt({ entry: t, dense: e, showTags: n }) {
  const { token: s } = E.useToken(), r = u.useRef(null), [o, c] = u.useState(!1), [m, b] = u.useState(null);
  u.useEffect(() => {
    const a = r.current;
    if (a === null)
      return;
    const f = new IntersectionObserver((h) => {
      for (const g of h)
        g.target === a && c(g.isIntersecting);
    });
    return f.observe(a), () => {
      f.disconnect();
    };
  }, []), u.useEffect(() => {
    const a = R, f = r.current;
    if (!o || f === null || a === null)
      return;
    let h = !1, g = null;
    return a.requestEntries({ entryIds: [t.entry_id] }).then(async (Y) => {
      const P = Y[0];
      if (h || P === void 0)
        return;
      const O = await a.mountEntry(P, f);
      h ? O() : g = O;
    }).catch(() => {
      h || b("条目内容暂时不可用");
    }), () => {
      h = !0, g?.();
    };
  }, [t.entry_id, o]);
  const I = () => {
    const a = R;
    a !== null && a.openDocument(t.url).catch(() => {
      b("条目暂时无法打开，请稍后重试");
    });
  }, l = n ? gt(t.snapshot) : [];
  return /* @__PURE__ */ y(
    "article",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: e ? s.marginXXS : s.marginXS,
        minWidth: 0
      },
      children: [
        /* @__PURE__ */ i(
          "div",
          {
            ref: r,
            style: {
              minHeight: ht,
              borderRadius: s.borderRadius,
              overflow: "hidden"
            }
          }
        ),
        /* @__PURE__ */ i(
          "button",
          {
            type: "button",
            onClick: I,
            style: {
              border: 0,
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              textAlign: "center",
              color: s.colorText,
              fontSize: s.fontSize,
              fontFamily: "inherit"
            },
            children: t.displayTitle.length > 0 ? t.displayTitle : "未命名条目"
          }
        ),
        l.length > 0 ? /* @__PURE__ */ i(
          "p",
          {
            style: {
              margin: 0,
              textAlign: "center",
              color: s.colorTextSecondary,
              fontSize: s.fontSizeSM
            },
            children: l.join(" · ")
          }
        ) : null,
        m !== null ? /* @__PURE__ */ i(
          "p",
          {
            style: {
              margin: 0,
              textAlign: "center",
              color: s.colorTextSecondary,
              fontSize: s.fontSizeSM
            },
            children: m
          }
        ) : null
      ]
    }
  );
}
function yt(t, e) {
  if (e === "manual")
    return [...t];
  const n = e === "name-desc" ? -1 : 1;
  return [...t].sort((s, r) => {
    const o = s.displayTitle.localeCompare(r.displayTitle, "zh-CN");
    return o !== 0 ? o * n : s.entry_id.localeCompare(r.entry_id);
  });
}
function z({
  region: t,
  title: e,
  variant: n
}) {
  return C(t) ? t.mode === "html" && t.html !== void 0 ? n === "background" ? /* @__PURE__ */ i(
    _,
    {
      title: e,
      srcDoc: t.html,
      ratio: "16:9",
      sandbox: "allow-scripts"
    }
  ) : /* @__PURE__ */ i(
    _,
    {
      title: e,
      srcDoc: t.html,
      autoHeight: !0,
      maxHeightFactor: 3,
      sandbox: "allow-scripts"
    }
  ) : t.mode === "image" && t.assetPath !== void 0 && w(t.assetPath) ? n === "background" ? /* @__PURE__ */ i(
    _,
    {
      title: e,
      src: t.assetPath,
      ratio: "16:9",
      sandbox: "allow-scripts"
    }
  ) : /* @__PURE__ */ i(
    _,
    {
      title: e,
      src: t.assetPath,
      autoHeight: !0,
      sandbox: "allow-scripts"
    }
  ) : null : null;
}
const bt = [0, 1, 2, 3, 4, 5];
function _t({ box: t }) {
  const { token: e } = E.useToken(), [n, s] = u.useState(null), r = ft(n), o = p(t.layout_config), c = yt(
    t.entries.filter((l) => l.enabled),
    o.sort_mode
  ), m = o.information_density === "compact", b = C(o.background), I = C(o.top_region);
  return /* @__PURE__ */ y(
    "div",
    {
      ref: s,
      "aria-label": "网格箱子布局",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: e.marginXS,
        minHeight: "100%",
        padding: m ? e.paddingSM : e.padding,
        boxSizing: "border-box"
      },
      children: [
        b ? /* @__PURE__ */ i("div", { "aria-hidden": "true", style: { width: "100%" }, children: /* @__PURE__ */ i(
          z,
          {
            region: o.background,
            title: V,
            variant: "background"
          }
        ) }) : null,
        I ? /* @__PURE__ */ i("div", { style: { width: "100%" }, children: /* @__PURE__ */ i(z, { region: o.top_region, title: W, variant: "top" }) }) : null,
        c.length === 0 ? /* @__PURE__ */ i(
          q,
          {
            hint: /* @__PURE__ */ i(
              $,
              {
                title: "这里还没有内容",
                description: "在编辑器中添加卡片或箱子，开始填充这个箱子"
              }
            ),
            children: /* @__PURE__ */ i(
              "div",
              {
                style: {
                  display: "grid",
                  gap: o.gap,
                  gridTemplateColumns: "repeat(" + String(Math.max(r, 2)) + ", minmax(0, 1fr))"
                },
                children: bt.map((l) => /* @__PURE__ */ y(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: e.marginXXS,
                      minWidth: 0
                    },
                    children: [
                      /* @__PURE__ */ i(Z, { width: "100%", radius: 12, style: { aspectRatio: "3 / 4" } }),
                      /* @__PURE__ */ i(N, { width: "62%" }),
                      /* @__PURE__ */ i(N, { width: "40%", height: 8, radius: 4 })
                    ]
                  },
                  l
                ))
              }
            )
          }
        ) : /* @__PURE__ */ i(
          "div",
          {
            style: {
              display: "grid",
              gap: o.gap,
              alignItems: "start",
              gridTemplateColumns: "repeat(" + String(Math.max(r, 2)) + ", minmax(0, 1fr))"
            },
            children: c.map((l) => /* @__PURE__ */ i(
              pt,
              {
                entry: l,
                dense: m,
                showTags: o.show_tags
              },
              l.entry_id
            ))
          }
        )
      ]
    }
  );
}
const T = /* @__PURE__ */ new WeakMap();
function St(t, e) {
  T.get(e)?.(), e.replaceChildren();
  const n = B(e);
  G(() => {
    n.render(/* @__PURE__ */ i(_t, { box: t }));
  });
  let s = !1;
  const r = () => {
    s || (s = !0, n.unmount(), T.get(e) === r && T.delete(e));
  };
  return T.set(e, r), r;
}
function X({ title: t, field: e }) {
  const { token: n } = E.useToken();
  return /* @__PURE__ */ y(
    "fieldset",
    {
      style: {
        border: `1px solid ${n.colorBorderSecondary}`,
        borderRadius: n.borderRadius,
        padding: n.paddingXS,
        margin: 0
      },
      children: [
        /* @__PURE__ */ i("legend", { style: { paddingInline: n.paddingXXS }, children: t }),
        /* @__PURE__ */ i(d.Item, { label: "呈现模式", name: [e, "mode"], children: /* @__PURE__ */ i(
          k,
          {
            options: rt.map((s) => ({
              value: s,
              label: ot[s]
            }))
          }
        ) }),
        /* @__PURE__ */ i(d.Item, { noStyle: !0, shouldUpdate: !0, children: ({ getFieldValue: s }) => {
          const r = s([e, "mode"]);
          return r === "image" ? /* @__PURE__ */ i(
            d.Item,
            {
              label: "箱子资源路径",
              name: [e, "assetPath"],
              extra: "以 assets/ 开头的箱子自有资源相对路径",
              rules: [
                {
                  validator: (o, c) => typeof c == "string" && c.length > 0 && !w(c) ? Promise.reject(new Error("请输入以 assets/ 开头的合法箱子资源路径")) : Promise.resolve()
                }
              ],
              children: /* @__PURE__ */ i(H, { placeholder: "assets/layouts/background.png" })
            }
          ) : r === "html" ? /* @__PURE__ */ i(d.Item, { label: "HTML 代码", name: [e, "html"], children: /* @__PURE__ */ i(H.TextArea, { rows: 6, placeholder: "<section>…</section>" }) }) : null;
        } })
      ]
    }
  );
}
function Tt({ config: t, onChange: e }) {
  const { token: n } = E.useToken(), s = (r, o) => {
    e(p(o));
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
      children: /* @__PURE__ */ y(
        d,
        {
          layout: "vertical",
          initialValues: t,
          onValuesChange: s,
          children: [
            /* @__PURE__ */ i(d.Item, { label: "间距（px）", name: "gap", children: /* @__PURE__ */ i(J, { min: M, max: A, step: 1 }) }),
            /* @__PURE__ */ i(d.Item, { label: "信息密度", name: "information_density", children: /* @__PURE__ */ i(
              k,
              {
                options: et.map((r) => ({ value: r, label: nt[r] }))
              }
            ) }),
            /* @__PURE__ */ i(d.Item, { label: "显示标签", name: "show_tags", valuePropName: "checked", children: /* @__PURE__ */ i(Q, {}) }),
            /* @__PURE__ */ i(d.Item, { label: "排序方式", name: "sort_mode", extra: "手动顺序请在「内容列表」标签页拖拽调整", children: /* @__PURE__ */ i(k, { options: st.map((r) => ({ value: r, label: it[r] })) }) }),
            /* @__PURE__ */ i(X, { title: V, field: "background" }),
            /* @__PURE__ */ i(X, { title: W, field: "top_region" })
          ]
        }
      )
    }
  );
}
class Et {
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
    this.base = p(e.layout_config), this.revision = e.revision, this.host = n, n.replaceChildren(), this.root = B(n), this.mount();
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
    this.revision = e, n !== null && n.kind === "replace" && (this.base = p(n.config)), this.pending === n && (this.pending = null, this.setDirty(!1));
  }
  update(e, n) {
    this.state === "disposed" || n <= this.revision || (this.revision = n, this.base = p(e.layout_config), this.pending = null, this.setDirty(!1), this.mount());
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
    const s = n;
    return this.dirtyHandlers.add(s), {
      dispose: () => {
        this.dirtyHandlers.delete(s);
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
    G(() => {
      this.root.render(
        /* @__PURE__ */ i(Tt, { config: this.base, onChange: this.handleConfigChange }, this.revision)
      );
    });
  }
  handleConfigChange = (e) => {
    if (this.state !== "active")
      return;
    const n = {
      kind: "replace",
      config: { ...e },
      schemaVersion: tt
    }, s = this.pending !== null;
    this.pending = n, s || this.setDirty(!0);
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
function vt(t, e) {
  return new Et(t, e);
}
const Rt = {
  attachRuntime: mt,
  renderLayout: St,
  renderEditor: vt,
  validateConfig: ut
};
export {
  mt as attachRuntime,
  Rt as default,
  vt as renderEditor,
  St as renderLayout,
  Rt as renderPlugin
};
