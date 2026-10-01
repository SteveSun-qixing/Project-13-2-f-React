import { jsx as o, jsxs as a, Fragment as P } from "chips-resource://platform/vendor/react-jsx-runtime.js";
import { flushSync as D } from "chips-resource://platform/vendor/react-dom.js";
import { createRoot as F } from "chips-resource://platform/vendor/react-dom-client.js";
import M, { useState as Y, useRef as G, useEffect as q, useMemo as k } from "chips-resource://platform/vendor/react.js";
import { theme as y, Rate as W, HeartFilled as j, Progress as L, Segmented as K, InputNumber as R } from "chips-resource://platform/vendor/chips-ui.js";
const U = "base.score", d = 5, S = 1, b = 1e5, x = ["stars", "hearts", "score", "progress"], J = {
  stars: "星星",
  hearts: "爱心",
  score: "分数",
  progress: "进度条"
}, C = {
  style: "stars",
  score: 0,
  total_score: d
};
function O(t) {
  if (typeof t == "number" && Number.isFinite(t))
    return t;
  if (typeof t == "string" && t.trim().length > 0) {
    const e = Number(t);
    return Number.isFinite(e) ? e : void 0;
  }
}
function w(t, e, r) {
  return Math.min(Math.max(t, e), r);
}
function h(t) {
  return t === "stars" || t === "hearts";
}
function Q(t) {
  return x.includes(t) ? t : C.style;
}
function Z(t, e) {
  return h(t) ? d : w(
    O(e) ?? C.total_score,
    S,
    b
  );
}
function ee(t, e, r) {
  const s = w(O(e) ?? C.score, 0, r);
  return h(t) ? Math.round(s) : s;
}
function p(t) {
  const e = typeof t == "object" && t !== null ? t : {}, r = Q(e.style), s = Z(r, e.total_score), n = ee(r, e.score, s);
  return { style: r, score: n, total_score: s };
}
function $(t) {
  return !Number.isFinite(t.total_score) || t.total_score <= 0 ? 0 : w(t.score / t.total_score, 0, 1);
}
function l(t) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(t);
}
function B(t) {
  const e = {};
  return x.includes(t.style) || (e.style = "评分样式必须为星星、爱心、分数或进度条。"), !Number.isFinite(t.total_score) || t.total_score < S ? e.total_score = "总分必须大于或等于 1。" : t.total_score > b && (e.total_score = `总分不能超过 ${l(b)}。`), !Number.isFinite(t.score) || t.score < 0 ? e.score = "获得分数必须大于或等于 0。" : Number.isFinite(t.total_score) && t.score > t.total_score && (e.score = "获得分数不能超过总分。"), x.includes(t.style) && h(t.style) && (t.total_score !== d && (e.total_score = "星星和爱心评分固定为五分制。"), Number.isInteger(t.score) || (e.score = "星星和爱心评分必须为整数。")), e;
}
function te(t) {
  return {
    card_type: U,
    config: { ...t }
  };
}
const re = 14, se = 9;
function oe({ config: t, ariaLabel: e }) {
  const { token: r } = y.useToken(), s = l(t.score), n = l(t.total_score), c = s.length + n.length >= se;
  return /* @__PURE__ */ a(
    "div",
    {
      role: "img",
      "aria-label": e,
      className: [
        "chips-score-card__numeric",
        c ? "chips-score-card__numeric--compact" : ""
      ].filter(Boolean).join(" "),
      style: {
        display: "inline-flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        justifyContent: "center",
        maxWidth: "100%",
        minWidth: 0,
        color: r.colorText
      },
      children: [
        /* @__PURE__ */ o(
          "span",
          {
            "aria-hidden": "true",
            className: "chips-score-card__numeric-score",
            style: {
              fontSize: c ? 30 : 42,
              fontWeight: 700,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums"
            },
            children: s
          }
        ),
        /* @__PURE__ */ o(
          "span",
          {
            "aria-hidden": "true",
            className: "chips-score-card__numeric-separator",
            style: {
              margin: "0 8px",
              fontSize: c ? 17 : 24,
              fontWeight: 600,
              color: r.colorText,
              opacity: 0.36
            },
            children: "/"
          }
        ),
        /* @__PURE__ */ o(
          "span",
          {
            "aria-hidden": "true",
            className: "chips-score-card__numeric-total",
            style: {
              color: r.colorTextSecondary,
              fontSize: c ? 15 : 22,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums"
            },
            children: n
          }
        )
      ]
    }
  );
}
function ne({ config: t, ariaLabel: e, labelId: r }) {
  const { token: s } = y.useToken(), n = t.style === "hearts";
  return /* @__PURE__ */ a(P, { children: [
    /* @__PURE__ */ o("span", { className: "chips-score-card__sr-only", id: r, children: e }),
    /* @__PURE__ */ o(
      W,
      {
        "aria-labelledby": r,
        className: [
          "chips-score-card__rating",
          n ? "chips-score-card__rating--hearts" : ""
        ].filter(Boolean).join(" "),
        count: t.total_score,
        character: n ? /* @__PURE__ */ o(j, {}) : void 0,
        disabled: !0,
        ...n ? { style: { color: s.colorError } } : {},
        value: t.score
      }
    )
  ] });
}
function ie({ config: t, ratio: e, ariaLabel: r, labelId: s }) {
  const { token: n } = y.useToken(), c = l(t.score), u = l(t.total_score), m = l(e * 100);
  return /* @__PURE__ */ a("div", { className: "chips-score-card__progress", style: { display: "grid", gap: 10, width: "100%" }, children: [
    /* @__PURE__ */ o("span", { className: "chips-score-card__sr-only", id: s, children: r }),
    /* @__PURE__ */ o(
      L,
      {
        "aria-labelledby": s,
        "aria-valuetext": `${m}%`,
        className: "chips-score-card__progress-control",
        "aria-valuenow": Math.round(e * 100),
        percent: e * 100,
        showInfo: !1,
        size: ["100%", re]
      }
    ),
    /* @__PURE__ */ a(
      "div",
      {
        className: "chips-score-card__progress-meta",
        "aria-hidden": "true",
        style: {
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          color: n.colorTextSecondary,
          fontSize: n.fontSizeSM,
          lineHeight: 1.3
        },
        children: [
          /* @__PURE__ */ a(
            "span",
            {
              className: "chips-score-card__progress-score",
              style: { color: n.colorText, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
              children: [
                c,
                " / ",
                u
              ]
            }
          ),
          /* @__PURE__ */ a(
            "span",
            {
              className: "chips-score-card__progress-percent",
              style: { fontVariantNumeric: "tabular-nums" },
              children: [
                m,
                "%"
              ]
            }
          )
        ]
      }
    )
  ] });
}
function ce({ config: t }) {
  const e = p(t), r = $(e), s = `${l(e.score)} / ${l(
    e.total_score
  )} 分`, n = M.useId(), c = M.useId();
  return /* @__PURE__ */ o(
    "div",
    {
      className: "chips-score-card",
      "data-card-type": "base.score",
      "data-score-style": e.style,
      style: { width: "100%", minWidth: 0 },
      children: /* @__PURE__ */ a(
        "div",
        {
          className: [
            "chips-score-card__surface",
            h(e.style) ? "chips-score-card__surface--symbols" : ""
          ].filter(Boolean).join(" "),
          style: {
            width: "100%",
            minWidth: 0,
            display: h(e.style) ? "flex" : "block",
            justifyContent: h(e.style) ? "center" : void 0
          },
          children: [
            h(e.style) ? /* @__PURE__ */ o(ne, { config: e, ariaLabel: s, labelId: n }) : null,
            e.style === "score" ? /* @__PURE__ */ o(oe, { config: e, ariaLabel: s }) : null,
            e.style === "progress" ? /* @__PURE__ */ o(
              ie,
              {
                config: e,
                ratio: r,
                ariaLabel: s,
                labelId: c
              }
            ) : null
          ]
        }
      )
    }
  );
}
function ae(t) {
  return Object.keys(B(t)).length === 0;
}
function g({ label: t, hint: e, htmlFor: r, children: s }) {
  const { token: n } = y.useToken();
  return /* @__PURE__ */ a(
    "div",
    {
      style: {
        display: "grid",
        gap: n.marginXXS,
        padding: `${n.paddingSM}px 0`,
        borderBottom: `1px solid ${n.colorBorderSecondary}`
      },
      children: [
        /* @__PURE__ */ o(
          "label",
          {
            htmlFor: r,
            style: { color: n.colorText, fontSize: n.fontSizeSM, fontWeight: 600 },
            children: t
          }
        ),
        e ? /* @__PURE__ */ o("span", { style: { color: n.colorTextSecondary, fontSize: n.fontSizeSM }, children: e }) : null,
        s
      ]
    }
  );
}
function le({ config: t, onChange: e }) {
  const { token: r } = y.useToken(), [s, n] = Y(() => p(t)), c = G(s);
  q(() => {
    const i = p(t);
    c.current = i, n(i);
  }, [t]);
  const u = (i) => {
    const f = p({ ...c.current, ...i });
    c.current = f, n(f), e(f);
  }, m = k(() => $(s), [s]), V = k(() => B(s), [s]), z = Object.entries(V), N = s.style === "hearts", A = h(s.style), T = l(s.score), v = l(s.total_score), E = l(m * 100), H = "chips-score-editor-total-score", I = "chips-score-editor-score-value", X = (i) => {
    i.key === "Home" ? (i.preventDefault(), u({ score: 1, total_score: d })) : i.key === "End" && (i.preventDefault(), u({ score: d, total_score: d }));
  };
  return /* @__PURE__ */ a(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "auto",
        padding: r.padding,
        boxSizing: "border-box"
      },
      children: [
        /* @__PURE__ */ o(g, { label: "样式", hint: "星星与爱心固定五分制，分数与进度条可自定义总分", children: /* @__PURE__ */ o(
          K,
          {
            style: { width: "100%" },
            options: x.map((i) => ({
              value: i,
              label: J[i]
            })),
            value: s.style,
            onChange: (i) => {
              u({
                style: i,
                total_score: h(i) ? d : c.current.total_score
              });
            }
          }
        ) }),
        /* @__PURE__ */ o(g, { label: "获得分数", children: A ? /* @__PURE__ */ o(
          "div",
          {
            className: "chips-score-editor__rating-wrap",
            onKeyDown: X,
            style: { display: "flex", justifyContent: "center", padding: `${r.paddingXXS}px 0` },
            children: /* @__PURE__ */ o(
              W,
              {
                className: [
                  "chips-score-editor__rating",
                  N ? "chips-score-editor__rating--hearts" : ""
                ].filter(Boolean).join(" "),
                count: d,
                character: N ? /* @__PURE__ */ o(j, {}) : void 0,
                ...N ? { style: { color: r.colorError } } : {},
                value: s.score,
                onChange: (i) => {
                  u({ score: i, total_score: d });
                }
              }
            )
          }
        ) : /* @__PURE__ */ a("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: r.marginSM }, children: [
          /* @__PURE__ */ a("div", { style: { display: "grid", gap: r.marginXXS, minWidth: 0 }, children: [
            /* @__PURE__ */ o(
              "label",
              {
                htmlFor: H,
                style: { color: r.colorTextSecondary, fontSize: r.fontSizeSM },
                children: "总分"
              }
            ),
            /* @__PURE__ */ o(
              R,
              {
                className: "chips-score-editor__number-input",
                id: H,
                max: b,
                min: S,
                step: 0.1,
                style: { width: "100%" },
                value: s.total_score,
                onChange: (i) => {
                  u({ total_score: i ?? S });
                }
              }
            )
          ] }),
          /* @__PURE__ */ a("div", { style: { display: "grid", gap: r.marginXXS, minWidth: 0 }, children: [
            /* @__PURE__ */ o(
              "label",
              {
                htmlFor: I,
                style: { color: r.colorTextSecondary, fontSize: r.fontSizeSM },
                children: "分数"
              }
            ),
            /* @__PURE__ */ o(
              R,
              {
                className: "chips-score-editor__number-input",
                id: I,
                max: s.total_score,
                min: 0,
                step: 0.1,
                style: { width: "100%" },
                value: s.score,
                onChange: (i) => {
                  u({ score: i ?? 0 });
                }
              }
            )
          ] })
        ] }) }),
        s.style === "progress" ? /* @__PURE__ */ o(g, { label: "进度预览", hint: `${T} / ${v}，${E}%`, children: /* @__PURE__ */ o(
          L,
          {
            "aria-valuetext": `${E}%`,
            "aria-valuenow": Math.round(m * 100),
            percent: m * 100,
            showInfo: !1,
            size: ["100%", 12]
          }
        ) }) : null,
        s.style === "score" ? /* @__PURE__ */ o(g, { label: "分数预览", children: /* @__PURE__ */ a(
          "div",
          {
            role: "img",
            "aria-label": `${T} / ${v} 分`,
            style: {
              display: "inline-flex",
              alignItems: "baseline",
              justifyContent: "center",
              width: "100%",
              color: r.colorText
            },
            children: [
              /* @__PURE__ */ o("span", { style: { fontSize: 36, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }, children: T }),
              /* @__PURE__ */ o(
                "span",
                {
                  style: {
                    margin: "0 8px",
                    fontSize: 22,
                    fontWeight: 600,
                    color: r.colorText,
                    opacity: 0.36
                  },
                  children: "/"
                }
              ),
              /* @__PURE__ */ o(
                "span",
                {
                  style: {
                    fontSize: 20,
                    fontWeight: 600,
                    color: r.colorTextSecondary,
                    fontVariantNumeric: "tabular-nums"
                  },
                  children: v
                }
              )
            ]
          }
        ) }) : null,
        /* @__PURE__ */ o("div", { role: "alert", "aria-live": "polite", style: { minHeight: 0, paddingTop: r.paddingSM }, children: z.length > 0 ? /* @__PURE__ */ o("ul", { style: { margin: 0, paddingLeft: 18, color: r.colorError, fontSize: r.fontSizeSM }, children: z.map(([i, f]) => /* @__PURE__ */ o("li", { children: f }, i)) }) : null })
      ]
    }
  );
}
const _ = /* @__PURE__ */ new WeakMap();
function de(t, e) {
  _.get(e)?.(), e.replaceChildren();
  const r = F(e);
  D(() => {
    r.render(/* @__PURE__ */ o(ce, { config: t.content.config }));
  });
  let s = !1;
  const n = () => {
    s || (s = !0, r.unmount(), _.get(e) === n && _.delete(e));
  };
  return _.set(e, n), n;
}
function he(t) {
  return /* @__PURE__ */ o(le, { ...t });
}
class ue {
  state = "active";
  base;
  revision;
  pending = null;
  dirty = !1;
  host;
  root;
  changeHandlers = /* @__PURE__ */ new Set();
  dirtyHandlers = /* @__PURE__ */ new Set();
  constructor(e, r) {
    this.base = p(e.content.config), this.revision = e.revision, this.host = r, r.replaceChildren(), this.root = F(r), this.mount();
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
    const r = this.pending;
    this.revision = e, r !== null && r.kind === "replace" && (this.base = p(r.content.config)), this.pending === r && (this.pending = null, this.setDirty(!1));
  }
  update(e, r) {
    this.state === "disposed" || r <= this.revision || (this.revision = r, this.base = p(e.content.config), this.pending = null, this.setDirty(!1), this.mount());
  }
  subscribe(e, r) {
    if (this.state === "disposed")
      return { dispose: () => {
      } };
    if (e === "change") {
      const n = r;
      return this.changeHandlers.add(n), {
        dispose: () => {
          this.changeHandlers.delete(n);
        }
      };
    }
    const s = r;
    return this.dirtyHandlers.add(s), {
      dispose: () => {
        this.dirtyHandlers.delete(s);
      }
    };
  }
  focus() {
    if (this.state !== "active")
      return;
    const e = this.host.querySelector(".ant-input-number input");
    if (e) {
      e.focus();
      return;
    }
    this.host.querySelector(".ant-rate")?.focus();
  }
  dispose() {
    this.state !== "disposed" && (this.root.unmount(), this.changeHandlers.clear(), this.dirtyHandlers.clear(), this.pending = null, this.dirty = !1, this.state = "disposed");
  }
  mount() {
    D(() => {
      this.root.render(
        /* @__PURE__ */ o(
          he,
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
    if (this.state !== "active" || !ae(e))
      return;
    const r = {
      kind: "replace",
      content: te(e)
    }, s = this.pending !== null;
    this.pending = r, s || this.setDirty(!0);
    for (const n of this.changeHandlers)
      n({ change: r });
  };
  setDirty(e) {
    if (this.dirty !== e) {
      this.dirty = e;
      for (const r of this.dirtyHandlers)
        r({ isDirty: e });
    }
  }
}
function pe(t, e) {
  return new ue(t, e);
}
const Se = {
  renderView: de,
  renderEditor: pe
};
export {
  Se as default,
  pe as renderEditor,
  Se as renderPlugin,
  de as renderView
};
