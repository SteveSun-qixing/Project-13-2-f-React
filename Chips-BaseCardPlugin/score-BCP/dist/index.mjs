function ow(e, n) {
  for (var o = 0; o < n.length; o++) {
    const i = n[o];
    if (typeof i != "string" && !Array.isArray(i)) {
      for (const l in i)
        if (l !== "default" && !(l in e)) {
          const c = Object.getOwnPropertyDescriptor(i, l);
          c && Object.defineProperty(e, l, c.get ? c : {
            enumerable: !0,
            get: () => i[l]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }));
}
function nr(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var Ju = { exports: {} }, Ne = {};
var Qm;
function iw() {
  if (Qm) return Ne;
  Qm = 1;
  var e = /* @__PURE__ */ Symbol.for("react.element"), n = /* @__PURE__ */ Symbol.for("react.portal"), o = /* @__PURE__ */ Symbol.for("react.fragment"), i = /* @__PURE__ */ Symbol.for("react.strict_mode"), l = /* @__PURE__ */ Symbol.for("react.profiler"), c = /* @__PURE__ */ Symbol.for("react.provider"), f = /* @__PURE__ */ Symbol.for("react.context"), p = /* @__PURE__ */ Symbol.for("react.forward_ref"), g = /* @__PURE__ */ Symbol.for("react.suspense"), h = /* @__PURE__ */ Symbol.for("react.memo"), y = /* @__PURE__ */ Symbol.for("react.lazy"), v = Symbol.iterator;
  function S(T) {
    return T === null || typeof T != "object" ? null : (T = v && T[v] || T["@@iterator"], typeof T == "function" ? T : null);
  }
  var x = { isMounted: function() {
    return !1;
  }, enqueueForceUpdate: function() {
  }, enqueueReplaceState: function() {
  }, enqueueSetState: function() {
  } }, b = Object.assign, C = {};
  function E(T, A, ee) {
    this.props = T, this.context = A, this.refs = C, this.updater = ee || x;
  }
  E.prototype.isReactComponent = {}, E.prototype.setState = function(T, A) {
    if (typeof T != "object" && typeof T != "function" && T != null) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, T, A, "setState");
  }, E.prototype.forceUpdate = function(T) {
    this.updater.enqueueForceUpdate(this, T, "forceUpdate");
  };
  function $() {
  }
  $.prototype = E.prototype;
  function k(T, A, ee) {
    this.props = T, this.context = A, this.refs = C, this.updater = ee || x;
  }
  var P = k.prototype = new $();
  P.constructor = k, b(P, E.prototype), P.isPureReactComponent = !0;
  var R = Array.isArray, M = Object.prototype.hasOwnProperty, I = { current: null }, z = { key: !0, ref: !0, __self: !0, __source: !0 };
  function O(T, A, ee) {
    var te, se = {}, re = null, fe = null;
    if (A != null) for (te in A.ref !== void 0 && (fe = A.ref), A.key !== void 0 && (re = "" + A.key), A) M.call(A, te) && !z.hasOwnProperty(te) && (se[te] = A[te]);
    var ie = arguments.length - 2;
    if (ie === 1) se.children = ee;
    else if (1 < ie) {
      for (var Z = Array(ie), ae = 0; ae < ie; ae++) Z[ae] = arguments[ae + 2];
      se.children = Z;
    }
    if (T && T.defaultProps) for (te in ie = T.defaultProps, ie) se[te] === void 0 && (se[te] = ie[te]);
    return { $$typeof: e, type: T, key: re, ref: fe, props: se, _owner: I.current };
  }
  function j(T, A) {
    return { $$typeof: e, type: T.type, key: A, ref: T.ref, props: T.props, _owner: T._owner };
  }
  function Y(T) {
    return typeof T == "object" && T !== null && T.$$typeof === e;
  }
  function V(T) {
    var A = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(ee) {
      return A[ee];
    });
  }
  var X = /\/+/g;
  function Q(T, A) {
    return typeof T == "object" && T !== null && T.key != null ? V("" + T.key) : A.toString(36);
  }
  function oe(T, A, ee, te, se) {
    var re = typeof T;
    (re === "undefined" || re === "boolean") && (T = null);
    var fe = !1;
    if (T === null) fe = !0;
    else switch (re) {
      case "string":
      case "number":
        fe = !0;
        break;
      case "object":
        switch (T.$$typeof) {
          case e:
          case n:
            fe = !0;
        }
    }
    if (fe) return fe = T, se = se(fe), T = te === "" ? "." + Q(fe, 0) : te, R(se) ? (ee = "", T != null && (ee = T.replace(X, "$&/") + "/"), oe(se, A, ee, "", function(ae) {
      return ae;
    })) : se != null && (Y(se) && (se = j(se, ee + (!se.key || fe && fe.key === se.key ? "" : ("" + se.key).replace(X, "$&/") + "/") + T)), A.push(se)), 1;
    if (fe = 0, te = te === "" ? "." : te + ":", R(T)) for (var ie = 0; ie < T.length; ie++) {
      re = T[ie];
      var Z = te + Q(re, ie);
      fe += oe(re, A, ee, Z, se);
    }
    else if (Z = S(T), typeof Z == "function") for (T = Z.call(T), ie = 0; !(re = T.next()).done; ) re = re.value, Z = te + Q(re, ie++), fe += oe(re, A, ee, Z, se);
    else if (re === "object") throw A = String(T), Error("Objects are not valid as a React child (found: " + (A === "[object Object]" ? "object with keys {" + Object.keys(T).join(", ") + "}" : A) + "). If you meant to render a collection of children, use an array instead.");
    return fe;
  }
  function G(T, A, ee) {
    if (T == null) return T;
    var te = [], se = 0;
    return oe(T, te, "", "", function(re) {
      return A.call(ee, re, se++);
    }), te;
  }
  function le(T) {
    if (T._status === -1) {
      var A = T._result;
      A = A(), A.then(function(ee) {
        (T._status === 0 || T._status === -1) && (T._status = 1, T._result = ee);
      }, function(ee) {
        (T._status === 0 || T._status === -1) && (T._status = 2, T._result = ee);
      }), T._status === -1 && (T._status = 0, T._result = A);
    }
    if (T._status === 1) return T._result.default;
    throw T._result;
  }
  var he = { current: null }, D = { transition: null }, J = { ReactCurrentDispatcher: he, ReactCurrentBatchConfig: D, ReactCurrentOwner: I };
  function q() {
    throw Error("act(...) is not supported in production builds of React.");
  }
  return Ne.Children = { map: G, forEach: function(T, A, ee) {
    G(T, function() {
      A.apply(this, arguments);
    }, ee);
  }, count: function(T) {
    var A = 0;
    return G(T, function() {
      A++;
    }), A;
  }, toArray: function(T) {
    return G(T, function(A) {
      return A;
    }) || [];
  }, only: function(T) {
    if (!Y(T)) throw Error("React.Children.only expected to receive a single React element child.");
    return T;
  } }, Ne.Component = E, Ne.Fragment = o, Ne.Profiler = l, Ne.PureComponent = k, Ne.StrictMode = i, Ne.Suspense = g, Ne.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = J, Ne.act = q, Ne.cloneElement = function(T, A, ee) {
    if (T == null) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + T + ".");
    var te = b({}, T.props), se = T.key, re = T.ref, fe = T._owner;
    if (A != null) {
      if (A.ref !== void 0 && (re = A.ref, fe = I.current), A.key !== void 0 && (se = "" + A.key), T.type && T.type.defaultProps) var ie = T.type.defaultProps;
      for (Z in A) M.call(A, Z) && !z.hasOwnProperty(Z) && (te[Z] = A[Z] === void 0 && ie !== void 0 ? ie[Z] : A[Z]);
    }
    var Z = arguments.length - 2;
    if (Z === 1) te.children = ee;
    else if (1 < Z) {
      ie = Array(Z);
      for (var ae = 0; ae < Z; ae++) ie[ae] = arguments[ae + 2];
      te.children = ie;
    }
    return { $$typeof: e, type: T.type, key: se, ref: re, props: te, _owner: fe };
  }, Ne.createContext = function(T) {
    return T = { $$typeof: f, _currentValue: T, _currentValue2: T, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null }, T.Provider = { $$typeof: c, _context: T }, T.Consumer = T;
  }, Ne.createElement = O, Ne.createFactory = function(T) {
    var A = O.bind(null, T);
    return A.type = T, A;
  }, Ne.createRef = function() {
    return { current: null };
  }, Ne.forwardRef = function(T) {
    return { $$typeof: p, render: T };
  }, Ne.isValidElement = Y, Ne.lazy = function(T) {
    return { $$typeof: y, _payload: { _status: -1, _result: T }, _init: le };
  }, Ne.memo = function(T, A) {
    return { $$typeof: h, type: T, compare: A === void 0 ? null : A };
  }, Ne.startTransition = function(T) {
    var A = D.transition;
    D.transition = {};
    try {
      T();
    } finally {
      D.transition = A;
    }
  }, Ne.unstable_act = q, Ne.useCallback = function(T, A) {
    return he.current.useCallback(T, A);
  }, Ne.useContext = function(T) {
    return he.current.useContext(T);
  }, Ne.useDebugValue = function() {
  }, Ne.useDeferredValue = function(T) {
    return he.current.useDeferredValue(T);
  }, Ne.useEffect = function(T, A) {
    return he.current.useEffect(T, A);
  }, Ne.useId = function() {
    return he.current.useId();
  }, Ne.useImperativeHandle = function(T, A, ee) {
    return he.current.useImperativeHandle(T, A, ee);
  }, Ne.useInsertionEffect = function(T, A) {
    return he.current.useInsertionEffect(T, A);
  }, Ne.useLayoutEffect = function(T, A) {
    return he.current.useLayoutEffect(T, A);
  }, Ne.useMemo = function(T, A) {
    return he.current.useMemo(T, A);
  }, Ne.useReducer = function(T, A, ee) {
    return he.current.useReducer(T, A, ee);
  }, Ne.useRef = function(T) {
    return he.current.useRef(T);
  }, Ne.useState = function(T) {
    return he.current.useState(T);
  }, Ne.useSyncExternalStore = function(T, A, ee) {
    return he.current.useSyncExternalStore(T, A, ee);
  }, Ne.useTransition = function() {
    return he.current.useTransition();
  }, Ne.version = "18.3.1", Ne;
}
var Zm;
function Qd() {
  return Zm || (Zm = 1, Ju.exports = iw()), Ju.exports;
}
var m = Qd();
const ye = /* @__PURE__ */ nr(m), sw = /* @__PURE__ */ ow({
  __proto__: null,
  default: ye
}, [m]);
function Zs(e) {
  for (var n = 0, o, i = 0, l = e.length; l >= 4; ++i, l -= 4)
    o = e.charCodeAt(i) & 255 | (e.charCodeAt(++i) & 255) << 8 | (e.charCodeAt(++i) & 255) << 16 | (e.charCodeAt(++i) & 255) << 24, o = /* Math.imul(k, m): */
    (o & 65535) * 1540483477 + ((o >>> 16) * 59797 << 16), o ^= /* k >>> r: */
    o >>> 24, n = /* Math.imul(k, m): */
    (o & 65535) * 1540483477 + ((o >>> 16) * 59797 << 16) ^ /* Math.imul(h, m): */
    (n & 65535) * 1540483477 + ((n >>> 16) * 59797 << 16);
  switch (l) {
    case 3:
      n ^= (e.charCodeAt(i + 2) & 255) << 16;
    case 2:
      n ^= (e.charCodeAt(i + 1) & 255) << 8;
    case 1:
      n ^= e.charCodeAt(i) & 255, n = /* Math.imul(h, m): */
      (n & 65535) * 1540483477 + ((n >>> 16) * 59797 << 16);
  }
  return n ^= n >>> 13, n = /* Math.imul(h, m): */
  (n & 65535) * 1540483477 + ((n >>> 16) * 59797 << 16), ((n ^ n >>> 15) >>> 0).toString(36);
}
function er() {
  return !!(typeof window < "u" && window.document && window.document.createElement);
}
function lw(e, n) {
  if (!e)
    return !1;
  if (e.contains)
    return e.contains(n);
  let o = n;
  for (; o; ) {
    if (o === e)
      return !0;
    o = o.parentNode;
  }
  return !1;
}
const Jm = "data-rc-order", eg = "data-rc-priority", aw = "rc-util-key", Ff = /* @__PURE__ */ new Map();
function py({
  mark: e
} = {}) {
  return e ? e.startsWith("data-") ? e : `data-${e}` : aw;
}
function lc(e) {
  return e.attachTo ? e.attachTo : document.querySelector("head") || document.body;
}
function cw(e) {
  return e === "queue" ? "prependQueue" : e ? "prepend" : "append";
}
function Zd(e) {
  return Array.from((Ff.get(e) || e).children).filter((n) => n.tagName === "STYLE");
}
function hy(e, n = {}) {
  if (!er())
    return null;
  const {
    csp: o,
    prepend: i,
    priority: l = 0
  } = n, c = cw(i), f = c === "prependQueue", p = document.createElement("style");
  p.setAttribute(Jm, c), f && l && p.setAttribute(eg, `${l}`), o?.nonce && (p.nonce = o?.nonce), p.innerHTML = e;
  const g = lc(n), {
    firstChild: h
  } = g;
  if (i) {
    if (f) {
      const y = (n.styles || Zd(g)).filter((v) => {
        if (!["prepend", "prependQueue"].includes(v.getAttribute(Jm)))
          return !1;
        const S = Number(v.getAttribute(eg) || 0);
        return l >= S;
      });
      if (y.length)
        return g.insertBefore(p, y[y.length - 1].nextSibling), p;
    }
    g.insertBefore(p, h);
  } else
    g.appendChild(p);
  return p;
}
function my(e, n = {}) {
  let {
    styles: o
  } = n;
  return o ||= Zd(lc(n)), o.find((i) => i.getAttribute(py(n)) === e);
}
function Js(e, n = {}) {
  const o = my(e, n);
  o && lc(n).removeChild(o);
}
function uw(e, n) {
  const o = Ff.get(e);
  if (!o || !lw(document, o)) {
    const i = hy("", n), {
      parentNode: l
    } = i;
    Ff.set(e, l), e.removeChild(i);
  }
}
function Uo(e, n, o = {}) {
  const i = lc(o), l = Zd(i), c = {
    ...o,
    styles: l
  };
  uw(i, c);
  const f = my(n, c);
  if (f)
    return c.csp?.nonce && f.nonce !== c.csp?.nonce && (f.nonce = c.csp?.nonce), f.innerHTML !== e && (f.innerHTML = e), f;
  const p = hy(e, c);
  return p.setAttribute(py(c), n), p;
}
function ac(e, n, o) {
  const i = m.useRef({});
  return (!("value" in i.current) || o(i.current.condition, n)) && (i.current.value = e(), i.current.condition = n), i.current.value;
}
let zf = {};
const fw = (e) => {
};
function dw(e, n) {
}
function pw(e, n) {
}
function hw() {
  zf = {};
}
function gy(e, n, o) {
  !n && !zf[o] && (e(!1, o), zf[o] = !0);
}
function zn(e, n) {
  gy(dw, e, n);
}
function mw(e, n) {
  gy(pw, e, n);
}
zn.preMessage = fw;
zn.resetWarned = hw;
zn.noteOnce = mw;
function el(e, n, o = !1) {
  const i = /* @__PURE__ */ new Set();
  function l(c, f, p = 1) {
    const g = i.has(c);
    if (zn(!g, "Warning: There may be circular references"), g)
      return !1;
    if (c === f)
      return !0;
    if (o && p > 1)
      return !1;
    i.add(c);
    const h = p + 1;
    if (Array.isArray(c)) {
      if (!Array.isArray(f) || c.length !== f.length)
        return !1;
      for (let y = 0; y < c.length; y++)
        if (!l(c[y], f[y], h))
          return !1;
      return !0;
    }
    if (c && f && typeof c == "object" && typeof f == "object") {
      const y = Object.keys(c);
      return y.length !== Object.keys(f).length ? !1 : y.every((v) => l(c[v], f[v], h));
    }
    return !1;
  }
  return l(e, n);
}
const gw = "%";
function Of(e) {
  return e.join(gw);
}
let tg = 0;
class yw {
  instanceId;
  constructor(n) {
    this.instanceId = n;
  }
  /** @private Internal cache map. Do not access this directly */
  cache = /* @__PURE__ */ new Map();
  /** @private Record update times for each key */
  updateTimes = /* @__PURE__ */ new Map();
  extracted = /* @__PURE__ */ new Set();
  get(n) {
    return this.opGet(Of(n));
  }
  /** A fast get cache with `get` concat. */
  opGet(n) {
    return this.cache.get(n) || null;
  }
  update(n, o) {
    return this.opUpdate(Of(n), o);
  }
  /** A fast get cache with `get` concat. */
  opUpdate(n, o) {
    const i = this.cache.get(n), l = o(i);
    l === null ? (this.cache.delete(n), this.updateTimes.delete(n)) : (this.cache.set(n, l), this.updateTimes.set(n, tg), tg += 1);
  }
}
const vw = {}, Jd = "data-token-hash", qr = "data-css-hash", Xo = "__cssinjs_instance__";
function ep() {
  const e = Math.random().toString(12).slice(2);
  if (typeof document < "u" && document.head && document.body) {
    const n = document.body.querySelectorAll(`style[${qr}]`) || [], {
      firstChild: o
    } = document.head;
    Array.from(n).forEach((l) => {
      l[Xo] ||= e, l[Xo] === e && document.head.insertBefore(l, o);
    });
    const i = {};
    Array.from(document.querySelectorAll(`style[${qr}]`)).forEach((l) => {
      const c = l.getAttribute(qr);
      i[c] ? l[Xo] === e && l.parentNode?.removeChild(l) : i[c] = !0;
    });
  }
  return new yw(e);
}
const Qo = /* @__PURE__ */ m.createContext({
  hashPriority: "low",
  cache: ep(),
  defaultCache: !0,
  autoPrefix: !1
}), Sw = (e) => {
  const {
    children: n,
    ...o
  } = e, i = m.useContext(Qo), l = ac(() => {
    const c = {
      ...i
    };
    Object.keys(o).forEach((g) => {
      const h = o[g];
      o[g] !== void 0 && (c[g] = h);
    });
    const {
      cache: f,
      transformers: p = []
    } = o;
    return c.cache = c.cache || ep(), c.defaultCache = !f && i.defaultCache, p.includes(vw) && (c.autoPrefix = !0), c;
  }, [i, o], (c, f) => !el(c[0], f[0], !0) || !el(c[1], f[1], !0));
  return /* @__PURE__ */ m.createElement(Qo.Provider, {
    value: l
  }, n);
};
function ww(e, n) {
  if (e.length !== n.length)
    return !1;
  for (let o = 0; o < e.length; o++)
    if (e[o] !== n[o])
      return !1;
  return !0;
}
class Xa {
  static MAX_CACHE_SIZE = 20;
  static MAX_CACHE_OFFSET = 5;
  cache;
  keys;
  cacheCallTimes;
  constructor() {
    this.cache = /* @__PURE__ */ new Map(), this.keys = [], this.cacheCallTimes = 0;
  }
  size() {
    return this.keys.length;
  }
  internalGet(n, o = !1) {
    let i = {
      map: this.cache
    };
    return n.forEach((l) => {
      i ? i = i?.map?.get(l) : i = void 0;
    }), i?.value && o && (i.value[1] = this.cacheCallTimes++), i?.value;
  }
  get(n) {
    return this.internalGet(n, !0)?.[0];
  }
  has(n) {
    return !!this.internalGet(n);
  }
  set(n, o) {
    if (!this.has(n)) {
      if (this.size() + 1 > Xa.MAX_CACHE_SIZE + Xa.MAX_CACHE_OFFSET) {
        const [l] = this.keys.reduce((c, f) => {
          const [, p] = c;
          return this.internalGet(f)[1] < p ? [f, this.internalGet(f)[1]] : c;
        }, [this.keys[0], this.cacheCallTimes]);
        this.delete(l);
      }
      this.keys.push(n);
    }
    let i = this.cache;
    n.forEach((l, c) => {
      if (c === n.length - 1)
        i.set(l, {
          value: [o, this.cacheCallTimes++]
        });
      else {
        const f = i.get(l);
        f ? f.map || (f.map = /* @__PURE__ */ new Map()) : i.set(l, {
          map: /* @__PURE__ */ new Map()
        }), i = i.get(l).map;
      }
    });
  }
  deleteByPath(n, o) {
    const i = n.get(o[0]);
    if (o.length === 1)
      return i.map ? n.set(o[0], {
        map: i.map
      }) : n.delete(o[0]), i.value?.[0];
    const l = this.deleteByPath(i.map, o.slice(1));
    return (!i.map || i.map.size === 0) && !i.value && n.delete(o[0]), l;
  }
  delete(n) {
    if (this.has(n))
      return this.keys = this.keys.filter((o) => !ww(o, n)), this.deleteByPath(this.cache, n);
  }
}
let ng = 0;
class yy {
  derivatives;
  id;
  constructor(n) {
    this.derivatives = Array.isArray(n) ? n : [n], this.id = ng, n.length === 0 && (n.length > 0, void 0), ng += 1;
  }
  getDerivativeToken(n) {
    return this.derivatives.reduce((o, i) => i(n, o), void 0);
  }
}
const ef = new Xa();
function Ga(e) {
  const n = Array.isArray(e) ? e : [e];
  return ef.has(n) || ef.set(n, new yy(n)), ef.get(n);
}
const xw = /* @__PURE__ */ new WeakMap(), tf = {};
function Cw(e, n) {
  let o = xw;
  for (let i = 0; i < n.length; i += 1) {
    const l = n[i];
    o.has(l) || o.set(l, /* @__PURE__ */ new WeakMap()), o = o.get(l);
  }
  return o.has(tf) || o.set(tf, e()), o.get(tf);
}
const rg = /* @__PURE__ */ new WeakMap();
function Gs(e) {
  let n = rg.get(e) || "";
  return n || (Object.keys(e).forEach((o) => {
    const i = e[o];
    n += o, i instanceof yy ? n += i.id : i && typeof i == "object" ? n += Gs(i) : n += i;
  }), n = Zs(n), rg.set(e, n)), n;
}
function bw(e, n) {
  return Zs(`${n}_${Gs(e)}`);
}
const Af = er();
function $e(e) {
  return typeof e == "number" ? `${e}px` : e;
}
function vy(e) {
  const {
    hashCls: n,
    hashPriority: o = "low"
  } = e || {};
  if (!n)
    return "";
  const i = `.${n}`;
  return o === "low" ? `:where(${i})` : i;
}
const Ew = (e) => e != null;
function tp(e, n) {
  const o = typeof n == "function" ? n() : n;
  return o ? {
    ...e,
    csp: {
      ...e.csp,
      nonce: o
    }
  } : e;
}
const Ha = (e, n = "") => `--${n ? `${n}-` : ""}${e}`.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, "$1-$2").replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase(), $w = (e, n, o) => {
  const {
    hashCls: i,
    hashPriority: l = "low",
    scope: c
  } = o || {};
  if (!Object.keys(e).length)
    return "";
  const f = `${vy({
    hashCls: i,
    hashPriority: l
  })}.${n}`, p = [c].flat().filter(Boolean);
  return `${p.length ? p.map((h) => `${f}.${h}`).join(", ") : f}{${Object.entries(e).map(([h, y]) => `${h}:${y};`).join("")}}`;
}, Sy = (e, n, o) => {
  const {
    hashCls: i,
    hashPriority: l = "low",
    prefix: c,
    unitless: f,
    ignore: p,
    preserve: g
  } = o || {}, h = {}, y = {};
  return Object.entries(e).forEach(([v, S]) => {
    if (g?.[v])
      y[v] = S;
    else if ((typeof S == "string" || typeof S == "number") && !p?.[v]) {
      const x = Ha(v, c);
      h[x] = typeof S == "number" && !f?.[v] ? `${S}px` : String(S), y[v] = `var(${x})`;
    }
  }), [y, $w(h, n, {
    scope: o?.scope,
    hashCls: i,
    hashPriority: l
  })];
}, ya = /* @__PURE__ */ new Map();
function np(e, n, o, i, l) {
  const {
    cache: c
  } = m.useContext(Qo), f = [e, ...n], p = Of(f), g = (v) => {
    c.opUpdate(p, (S) => {
      const [x = 0, b] = S || [void 0, void 0], E = b || o(), $ = [x, E];
      return v ? v($) : $;
    });
  };
  m.useMemo(
    () => {
      g();
    },
    /* eslint-disable react-hooks/exhaustive-deps */
    [p]
    /* eslint-enable */
  );
  const y = c.opGet(p)[1];
  return m.useInsertionEffect(() => (g(([v, S]) => [v + 1, S]), ya.has(p) || (l?.(y), ya.set(p, !0), Promise.resolve().then(() => {
    ya.delete(p);
  })), () => {
    c.opUpdate(p, (v) => {
      const [S = 0, x] = v || [];
      return S - 1 === 0 ? (i?.(x, !1), ya.delete(p), null) : [S - 1, x];
    });
  }), [p]), y;
}
const _w = {}, Pw = "css", Ho = /* @__PURE__ */ new Map();
function Rw(e) {
  Ho.set(e, (Ho.get(e) || 0) + 1);
}
function kw(e, n) {
  typeof document < "u" && document.querySelectorAll(`style[${Jd}="${e}"]`).forEach((i) => {
    i[Xo] === n && i.parentNode?.removeChild(i);
  });
}
const Mw = -1;
function Tw(e, n) {
  Ho.set(e, (Ho.get(e) || 0) - 1);
  const o = /* @__PURE__ */ new Set();
  Ho.forEach((i, l) => {
    i <= 0 && o.add(l);
  }), Ho.size - o.size > Mw && o.forEach((i) => {
    kw(i, n), Ho.delete(i);
  });
}
const wy = (e, n, o, i) => {
  let c = {
    ...o.getDerivativeToken(e),
    ...n
  };
  return i && (c = i(c)), c;
}, Nw = "token";
function Iw(e, n, o) {
  const {
    cache: {
      instanceId: i
    },
    container: l,
    hashPriority: c
  } = m.useContext(Qo), {
    salt: f = "",
    override: p = _w,
    formatToken: g,
    getComputedToken: h,
    cssVar: y,
    nonce: v
  } = o, S = Cw(() => Object.assign({}, ...n), n), x = Gs(S), b = Gs(p), C = Gs(y);
  return np(Nw, [f, e.id, x, b, C], () => {
    const $ = h ? h(S, p, e) : wy(S, p, e, g), k = {
      ...$
    }, P = `${f}_${y.prefix}`, R = Zs(P), M = `${Pw}-${R}`;
    k._tokenKey = bw(k, P);
    const [I, z] = Sy($, y.key, {
      prefix: y.prefix,
      ignore: y.ignore,
      unitless: y.unitless,
      preserve: y.preserve,
      hashPriority: c,
      hashCls: y.hashed ? M : void 0
    });
    return I._hashId = R, Rw(y.key), [I, M, k, z, y.key];
  }, ([, , , , $]) => {
    Tw($, i);
  }, ([, , , $, k]) => {
    if (!$)
      return;
    let P = {
      mark: qr,
      prepend: "queue",
      attachTo: l,
      priority: -999
    };
    P = tp(P, v);
    const R = Uo($, Zs(`css-var-${k}`), P);
    R[Xo] = i, R.setAttribute(Jd, k);
  });
}
var Fw = {
  animationIterationCount: 1,
  borderImageOutset: 1,
  borderImageSlice: 1,
  borderImageWidth: 1,
  boxFlex: 1,
  boxFlexGroup: 1,
  boxOrdinalGroup: 1,
  columnCount: 1,
  columns: 1,
  flex: 1,
  flexGrow: 1,
  flexPositive: 1,
  flexShrink: 1,
  flexNegative: 1,
  flexOrder: 1,
  gridRow: 1,
  gridRowEnd: 1,
  gridRowSpan: 1,
  gridRowStart: 1,
  gridColumn: 1,
  gridColumnEnd: 1,
  gridColumnSpan: 1,
  gridColumnStart: 1,
  msGridRow: 1,
  msGridRowSpan: 1,
  msGridColumn: 1,
  msGridColumnSpan: 1,
  fontWeight: 1,
  lineHeight: 1,
  opacity: 1,
  order: 1,
  orphans: 1,
  tabSize: 1,
  widows: 1,
  zIndex: 1,
  zoom: 1,
  WebkitLineClamp: 1,
  // SVG-related properties
  fillOpacity: 1,
  floodOpacity: 1,
  stopOpacity: 1,
  strokeDasharray: 1,
  strokeDashoffset: 1,
  strokeMiterlimit: 1,
  strokeOpacity: 1,
  strokeWidth: 1
}, lt = "-ms-", Ys = "-moz-", We = "-webkit-", xy = "comm", rp = "rule", op = "decl", zw = "@import", Ow = "@namespace", Cy = "@keyframes", Aw = "@layer", Lw = Math.abs, Ks = String.fromCharCode, Lf = Object.assign;
function Bw(e, n) {
  return Ot(e, 0) ^ 45 ? (((n << 2 ^ Ot(e, 0)) << 2 ^ Ot(e, 1)) << 2 ^ Ot(e, 2)) << 2 ^ Ot(e, 3) : 0;
}
function by(e) {
  return e.trim();
}
function Vr(e, n) {
  return (e = n.exec(e)) ? e[0] : e;
}
function Te(e, n, o) {
  return e.replace(n, o);
}
function nf(e, n) {
  return e.indexOf(n);
}
function Ot(e, n) {
  return e.charCodeAt(n) | 0;
}
function Zo(e, n, o) {
  return e.slice(n, o);
}
function pr(e) {
  return e.length;
}
function Ey(e) {
  return e.length;
}
function Ws(e, n) {
  return n.push(e), e;
}
function Hw(e, n) {
  return e.map(n).join("");
}
function og(e, n) {
  return e.filter(function(o) {
    return !Vr(o, n);
  });
}
var cc = 1, Oi = 1, $y = 0, tr = 0, _t = 0, qi = "";
function uc(e, n, o, i, l, c, f, p) {
  return { value: e, root: n, parent: o, type: i, props: l, children: c, line: cc, column: Oi, length: f, return: "", siblings: p };
}
function vo(e, n) {
  return Lf(uc("", null, null, "", null, null, 0, e.siblings), e, { length: -e.length }, n);
}
function Ei(e) {
  for (; e.root; )
    e = vo(e.root, { children: [e] });
  Ws(e, e.siblings);
}
function Dw() {
  return _t;
}
function jw() {
  return _t = tr > 0 ? Ot(qi, --tr) : 0, Oi--, _t === 10 && (Oi = 1, cc--), _t;
}
function gr() {
  return _t = tr < $y ? Ot(qi, tr++) : 0, Oi++, _t === 10 && (Oi = 1, cc++), _t;
}
function So() {
  return Ot(qi, tr);
}
function Da() {
  return tr;
}
function fc(e, n) {
  return Zo(qi, e, n);
}
function tl(e) {
  switch (e) {
    // \0 \t \n \r \s whitespace token
    case 0:
    case 9:
    case 10:
    case 13:
    case 32:
      return 5;
    // ! + , / > @ ~ isolate token
    case 33:
    case 43:
    case 44:
    case 47:
    case 62:
    case 64:
    case 126:
    // ; { } breakpoint token
    case 59:
    case 123:
    case 125:
      return 4;
    // : accompanied token
    case 58:
      return 3;
    // " ' ( [ opening delimit token
    case 34:
    case 39:
    case 40:
    case 91:
      return 2;
    // ) ] closing delimit token
    case 41:
    case 93:
      return 1;
  }
  return 0;
}
function Vw(e) {
  return cc = Oi = 1, $y = pr(qi = e), tr = 0, [];
}
function Ww(e) {
  return qi = "", e;
}
function rf(e) {
  return by(fc(tr - 1, Bf(e === 91 ? e + 2 : e === 40 ? e + 1 : e)));
}
function qw(e) {
  for (; (_t = So()) && _t < 33; )
    gr();
  return tl(e) > 2 || tl(_t) > 3 ? "" : " ";
}
function Uw(e, n) {
  for (; --n && gr() && !(_t < 48 || _t > 102 || _t > 57 && _t < 65 || _t > 70 && _t < 97); )
    ;
  return fc(e, Da() + (n < 6 && So() == 32 && gr() == 32));
}
function Bf(e) {
  for (; gr(); )
    switch (_t) {
      // ] ) " '
      case e:
        return tr;
      // " '
      case 34:
      case 39:
        e !== 34 && e !== 39 && Bf(_t);
        break;
      // (
      case 40:
        e === 41 && Bf(e);
        break;
      // \
      case 92:
        gr();
        break;
    }
  return tr;
}
function Xw(e, n) {
  for (; gr() && e + _t !== 57; )
    if (e + _t === 84 && So() === 47)
      break;
  return "/*" + fc(n, tr - 1) + "*" + Ks(e === 47 ? e : gr());
}
function Gw(e) {
  for (; !tl(So()); )
    gr();
  return fc(e, tr);
}
function ig(e) {
  return Ww(ja("", null, null, null, [""], e = Vw(e), 0, [0], e));
}
function ja(e, n, o, i, l, c, f, p, g) {
  for (var h = 0, y = 0, v = f, S = 0, x = 0, b = 0, C = 1, E = 1, $ = 1, k = 0, P = 0, R = "", M = l, I = c, z = i, O = R; E; )
    switch (b = P, P = gr()) {
      // (
      case 40:
        b != 108 && Ot(O, v - 1) == 58 ? (k++, O += "(") : O += rf(P);
        break;
      // )
      case 41:
        k--, O += ")";
        break;
      // " ' [
      case 34:
      case 39:
      case 91:
        O += rf(P);
        break;
      // \t \n \r \s
      case 9:
      case 10:
      case 13:
      case 32:
        if (k > 0) {
          O += Ks(P);
          break;
        }
        O += qw(b);
        break;
      // \
      case 92:
        O += Uw(Da() - 1, 7);
        continue;
      // /
      case 47:
        switch (So()) {
          case 42:
          case 47:
            Ws(Yw(Xw(gr(), Da()), n, o, g), g), (tl(b || 1) == 5 || tl(So() || 1) == 5) && pr(O) && Zo(O, -1, void 0) !== " " && (O += " ");
            break;
          default:
            O += "/";
        }
        break;
      // {
      case 123 * C:
        p[h++] = pr(O) * $;
      // } ; \0
      case 125 * C:
      case 59:
      case 0:
        if (k > 0 && P) {
          O += Ks(P);
          break;
        }
        switch (P) {
          // \0 }
          case 0:
          case 125:
            E = 0;
          // ;
          case 59 + y:
            $ == -1 && (O = Te(O, /\f/g, "")), x > 0 && (pr(O) - v || C === 0) && Ws(x > 32 ? lg(O + ";", i, o, v - 1, g) : lg(Te(O, " ", "") + ";", i, o, v - 2, g), g);
            break;
          // @ ;
          case 59:
            O += ";";
          // { rule/at-rule
          default:
            if (Ws(z = sg(O, n, o, h, y, l, p, R, M = [], I = [], v, c), c), P === 123)
              if (y === 0)
                ja(O, n, z, z, M, c, v, p, I);
              else {
                switch (S) {
                  // c(ontainer)
                  case 99:
                    if (Ot(O, 3) === 110) break;
                  // l(ayer)
                  case 108:
                    if (Ot(O, 2) === 97) break;
                  default:
                    y = 0;
                  // d(ocument) m(edia) s(upports)
                  case 100:
                  case 109:
                  case 115:
                }
                y ? ja(e, z, z, i && Ws(sg(e, z, z, 0, 0, l, p, R, l, M = [], v, I), I), l, I, v, p, i ? M : I) : ja(O, z, z, z, [""], I, 0, p, I);
              }
        }
        h = y = x = 0, C = $ = 1, R = O = "", v = f;
        break;
      // :
      case 58:
        v = 1 + pr(O), x = b;
      default:
        if (C < 1) {
          if (P == 123)
            --C;
          else if (P == 125 && C++ == 0 && jw() == 125)
            continue;
        }
        switch (O += Ks(P), P * C) {
          // &
          case 38:
            $ = y > 0 ? 1 : (O += "\f", -1);
            break;
          // ,
          case 44:
            if (k > 0) break;
            p[h++] = (pr(O) - 1) * $, $ = 1;
            break;
          // @
          case 64:
            So() === 45 && (O += rf(gr())), S = So(), y = v = pr(R = O += Gw(Da())), P++;
            break;
          // -
          case 45:
            b === 45 && pr(O) == 2 && (C = 0);
        }
    }
  return c;
}
function sg(e, n, o, i, l, c, f, p, g, h, y, v) {
  for (var S = l - 1, x = l === 0 ? c : [""], b = Ey(x), C = 0, E = 0, $ = 0; C < i; ++C)
    for (var k = 0, P = Zo(e, S + 1, S = Lw(E = f[C])), R = e; k < b; ++k)
      (R = by(E > 0 ? x[k] + " " + P : Te(P, /&\f/g, x[k]))) && (g[$++] = R);
  return uc(e, n, o, l === 0 ? rp : p, g, h, y, v);
}
function Yw(e, n, o, i) {
  return uc(e, n, o, xy, Ks(Dw()), Zo(e, 2, -2), 0, i);
}
function lg(e, n, o, i, l) {
  return uc(e, n, o, op, Zo(e, 0, i), Zo(e, i + 1, -1), i, l);
}
function _y(e, n, o) {
  switch (Bw(e, n)) {
    // color-adjust
    case 5103:
      return We + "print-" + e + e;
    // animation, animation-(delay|direction|duration|fill-mode|iteration-count|name|play-state|timing-function)
    case 5737:
    case 4201:
    case 3177:
    case 3433:
    case 1641:
    case 4457:
    case 2921:
    // text-decoration, filter, clip-path, backface-visibility, column, box-decoration-break
    case 5572:
    case 6356:
    case 5844:
    case 3191:
    case 6645:
    case 3005:
    // background-clip, columns, column-(count|fill|gap|rule|rule-color|rule-style|rule-width|span|width)
    case 4215:
    case 6389:
    case 5109:
    case 5365:
    case 5621:
    case 3829:
    // mask, mask-image, mask-(mode|clip|size), mask-(repeat|origin), mask-position
    case 6391:
    case 5879:
    case 5623:
    case 6135:
    case 4599:
      return We + e + e;
    // mask-composite
    case 4855:
      return We + e.replace("add", "source-over").replace("substract", "source-out").replace("intersect", "source-in").replace("exclude", "xor") + e;
    // tab-size
    case 4789:
      return Ys + e + e;
    // appearance, user-select, transform, hyphens, text-size-adjust
    case 5349:
    case 4246:
    case 4810:
    case 6968:
    case 2756:
      return We + e + Ys + e + lt + e + e;
    // writing-mode
    case 5936:
      switch (Ot(e, n + 11)) {
        // vertical-l(r)
        case 114:
          return We + e + lt + Te(e, /[svh]\w+-[tblr]{2}/, "tb") + e;
        // vertical-r(l)
        case 108:
          return We + e + lt + Te(e, /[svh]\w+-[tblr]{2}/, "tb-rl") + e;
        // horizontal(-)tb
        case 45:
          return We + e + lt + Te(e, /[svh]\w+-[tblr]{2}/, "lr") + e;
      }
    // flex, flex-direction, scroll-snap-type, writing-mode
    case 6828:
    case 4268:
    case 2903:
      return We + e + lt + e + e;
    // order
    case 6165:
      return We + e + lt + "flex-" + e + e;
    // align-items
    case 5187:
      return We + e + Te(e, /(\w+).+(:[^]+)/, We + "box-$1$2" + lt + "flex-$1$2") + e;
    // align-self
    case 5443:
      return We + e + lt + "flex-item-" + Te(e, /flex-|-self/g, "") + (Vr(e, /flex-|baseline/) ? "" : lt + "grid-row-" + Te(e, /flex-|-self/g, "")) + e;
    // align-content
    case 4675:
      return We + e + lt + "flex-line-pack" + Te(e, /align-content|flex-|-self/g, "") + e;
    // flex-shrink
    case 5548:
      return We + e + lt + Te(e, "shrink", "negative") + e;
    // flex-basis
    case 5292:
      return We + e + lt + Te(e, "basis", "preferred-size") + e;
    // flex-grow
    case 6060:
      return We + "box-" + Te(e, "-grow", "") + We + e + lt + Te(e, "grow", "positive") + e;
    // transition
    case 4554:
      return We + Te(e, /([^-])(transform)/g, "$1" + We + "$2") + e;
    // cursor
    case 6187:
      return Te(Te(Te(e, /(zoom-|grab)/, We + "$1"), /(image-set)/, We + "$1"), e, "") + e;
    // background, background-image
    case 5495:
    case 3959:
      return Te(e, /(image-set\([^]*)/, We + "$1$`$1");
    // justify-content
    case 4968:
      return Te(Te(e, /(.+:)(flex-)?(.*)/, We + "box-pack:$3" + lt + "flex-pack:$3"), /space-between/, "justify") + We + e + e;
    // justify-self
    case 4200:
      if (!Vr(e, /flex-|baseline/)) return lt + "grid-column-align" + Zo(e, n) + e;
      break;
    // grid-template-(columns|rows)
    case 2592:
    case 3360:
      return lt + Te(e, "template-", "") + e;
    // grid-(row|column)-start
    case 4384:
    case 3616:
      return o && o.some(function(i, l) {
        return n = l, Vr(i.props, /grid-\w+-end/);
      }) ? ~nf(e + (o = o[n].value), "span") ? e : lt + Te(e, "-start", "") + e + lt + "grid-row-span:" + (~nf(o, "span") ? Vr(o, /\d+/) : +Vr(o, /\d+/) - +Vr(e, /\d+/)) + ";" : lt + Te(e, "-start", "") + e;
    // grid-(row|column)-end
    case 4896:
    case 4128:
      return o && o.some(function(i) {
        return Vr(i.props, /grid-\w+-start/);
      }) ? e : lt + Te(Te(e, "-end", "-span"), "span ", "") + e;
    // (margin|padding)-inline-(start|end)
    case 4095:
    case 3583:
    case 4068:
    case 2532:
      return Te(e, /(.+)-inline(.+)/, We + "$1$2") + e;
    // (min|max)?(width|height|inline-size|block-size)
    case 8116:
    case 7059:
    case 5753:
    case 5535:
    case 5445:
    case 5701:
    case 4933:
    case 4677:
    case 5533:
    case 5789:
    case 5021:
    case 4765:
      if (pr(e) - 1 - n > 6)
        switch (Ot(e, n + 1)) {
          // (m)ax-content, (m)in-content
          case 109:
            if (Ot(e, n + 4) !== 45)
              break;
          // (f)ill-available, (f)it-content
          case 102:
            return Te(e, /(.+:)(.+)-([^]+)/, "$1" + We + "$2-$3$1" + Ys + (Ot(e, n + 3) == 108 ? "$3" : "$2-$3")) + e;
          // (s)tretch
          case 115:
            return ~nf(e, "stretch") ? _y(Te(e, "stretch", "fill-available"), n, o) + e : e;
        }
      break;
    // grid-(column|row)
    case 5152:
    case 5920:
      return Te(e, /(.+?):(\d+)(\s*\/\s*(span)?\s*(\d+))?(.*)/, function(i, l, c, f, p, g, h) {
        return lt + l + ":" + c + h + (f ? lt + l + "-span:" + (p ? g : +g - +c) + h : "") + e;
      });
    // position: sticky
    case 4949:
      if (Ot(e, n + 6) === 121)
        return Te(e, ":", ":" + We) + e;
      break;
    // display: (flex|inline-flex|grid|inline-grid)
    case 6444:
      switch (Ot(e, Ot(e, 14) === 45 ? 18 : 11)) {
        // (inline-)?fle(x)
        case 120:
          return Te(e, /(.+:)([^;\s!]+)(;|(\s+)?!.+)?/, "$1" + We + (Ot(e, 14) === 45 ? "inline-" : "") + "box$3$1" + We + "$2$3$1" + lt + "$2box$3") + e;
        // (inline-)?gri(d)
        case 100:
          return Te(e, ":", ":" + lt) + e;
      }
      break;
    // scroll-margin, scroll-margin-(top|right|bottom|left)
    case 5719:
    case 2647:
    case 2135:
    case 3927:
    case 2391:
      return Te(e, "scroll-", "scroll-snap-") + e;
  }
  return e;
}
function nl(e, n) {
  for (var o = "", i = 0; i < e.length; i++)
    o += n(e[i], i, e, n) || "";
  return o;
}
function ag(e, n, o, i) {
  switch (e.type) {
    case Aw:
      if (e.children.length) break;
    case zw:
    case Ow:
    case op:
      return e.return = e.return || e.value;
    case xy:
      return "";
    case Cy:
      return e.return = e.value + "{" + nl(e.children, i) + "}";
    case rp:
      if (!pr(e.value = e.props.join(","))) return "";
  }
  return pr(o = nl(e.children, i)) ? e.return = e.value + "{" + o + "}" : "";
}
function Kw(e) {
  var n = Ey(e);
  return function(o, i, l, c) {
    for (var f = "", p = 0; p < n; p++)
      f += e[p](o, i, l, c) || "";
    return f;
  };
}
function Qw(e, n, o, i) {
  if (e.length > -1 && !e.return)
    switch (e.type) {
      case op:
        e.return = _y(e.value, e.length, o);
        return;
      case Cy:
        return nl([vo(e, { value: Te(e.value, "@", "@" + We) })], i);
      case rp:
        if (e.length)
          return Hw(o = e.props, function(l) {
            switch (Vr(l, i = /(::plac\w+|:read-\w+)/)) {
              // :read-(only|write)
              case ":read-only":
              case ":read-write":
                Ei(vo(e, { props: [Te(l, /:(read-\w+)/, ":" + Ys + "$1")] })), Ei(vo(e, { props: [l] })), Lf(e, { props: og(o, i) });
                break;
              // :placeholder
              case "::placeholder":
                Ei(vo(e, { props: [Te(l, /:(plac\w+)/, ":" + We + "input-$1")] })), Ei(vo(e, { props: [Te(l, /:(plac\w+)/, ":" + Ys + "$1")] })), Ei(vo(e, { props: [Te(l, /:(plac\w+)/, lt + "input-$1")] })), Ei(vo(e, { props: [l] })), Lf(e, { props: og(o, i) });
                break;
            }
            return "";
          });
    }
}
const cg = "data-ant-cssinjs-cache-path", Py = "_FILE_STYLE__";
let Go, Ry = !0;
function Zw() {
  if (!Go && (Go = {}, er())) {
    const e = document.createElement("div");
    e.className = cg, e.style.position = "fixed", e.style.visibility = "hidden", e.style.top = "-9999px", document.body.appendChild(e);
    let n = getComputedStyle(e).content || "";
    n = n.replace(/^"/, "").replace(/"$/, ""), n.split(";").forEach((i) => {
      const [l, c] = i.split(":");
      Go[l] = c;
    });
    const o = document.querySelector(`style[${cg}]`);
    o && (Ry = !1, o.parentNode?.removeChild(o)), document.body.removeChild(e);
  }
}
function Jw(e) {
  return Zw(), !!Go[e];
}
function ex(e) {
  const n = Go[e];
  let o = null;
  if (n && er())
    if (Ry)
      o = Py;
    else {
      const i = document.querySelector(`style[${qr}="${Go[e]}"]`);
      i ? o = i.innerHTML : delete Go[e];
    }
  return [o, n];
}
const tx = "_skip_check_", ky = "_multi_value_";
function of(e, n) {
  return (n ? nl(ig(e), Kw([Qw, ag])) : nl(ig(e), ag)).replace(/\{%%%\:[^;];}/g, ";");
}
function nx(e) {
  return typeof e == "object" && e && (tx in e || ky in e);
}
function ug(e, n, o = "high") {
  if (!n)
    return e;
  const i = vy({
    hashCls: n,
    hashPriority: o
  });
  return e.split(",").map((c) => {
    const f = c.trim().split(/\s+/);
    let p = f[0] || "";
    const g = p.match(/^\w+/)?.[0] || "";
    return p = `${g}${i}${p.slice(g.length)}`, [p, ...f.slice(1)].join(" ");
  }).join(",");
}
const Hf = (e, n = {}, {
  root: o,
  injectHash: i,
  parentSelectors: l
} = {
  root: !0,
  parentSelectors: []
}) => {
  const {
    hashId: c,
    layer: f,
    path: p,
    hashPriority: g,
    transformers: h = [],
    linters: y = []
  } = n;
  let v = "", S = {};
  function x(E) {
    const $ = E.getName(c);
    if (!S[$]) {
      const [k] = Hf(E.style, n, {
        root: !1,
        parentSelectors: l
      });
      S[$] = `@keyframes ${E.getName(c)}${k}`;
    }
  }
  function b(E, $ = []) {
    return E.forEach((k) => {
      Array.isArray(k) ? b(k, $) : k && $.push(k);
    }), $;
  }
  return b(Array.isArray(e) ? e : [e]).forEach((E) => {
    const $ = typeof E == "string" && !o ? {} : E;
    if (typeof $ == "string")
      v += `${$}
`;
    else if ($._keyframe)
      x($);
    else {
      const k = h.reduce((P, R) => R?.visit?.(P) || P, $);
      Object.keys(k).forEach((P) => {
        const R = k[P];
        if (typeof R == "object" && R && (P !== "animationName" || !R._keyframe) && !nx(R)) {
          let M = !1, I = P.trim(), z = !1;
          (o || i) && c ? I.startsWith("@") ? M = !0 : I === "&" ? I = ug("", c, g) : I = ug(P, c, g) : o && !c && (I === "&" || I === "") && (I = "", z = !0);
          const [O, j] = Hf(R, n, {
            root: z,
            injectHash: M,
            parentSelectors: [...l, I]
          });
          S = {
            ...S,
            ...j
          }, v += `${I}${O}`;
        } else {
          let M = function(z, O) {
            const j = z.replace(/[A-Z]/g, (V) => `-${V.toLowerCase()}`);
            let Y = O;
            !Fw[z] && typeof Y == "number" && Y !== 0 && (Y = `${Y}px`), z === "animationName" && O?._keyframe && (x(O), Y = O.getName(c)), v += `${j}:${Y};`;
          };
          const I = R?.value ?? R;
          typeof R == "object" && R?.[ky] && Array.isArray(I) ? I.forEach((z) => {
            M(P, z);
          }) : Ew(I) && M(P, I);
        }
      });
    }
  }), o ? f && (v && (v = `@layer ${f.name} {${v}}`), f.dependencies && (S[`@layer ${f.name}`] = f.dependencies.map((E) => `@layer ${E}, ${f.name};`).join(`
`))) : v = `{${v}}`, [v, S];
};
function My(e, n) {
  return Zs(`${e.join("%")}${n}`);
}
const rx = "style";
function Df(e, n) {
  const {
    path: o,
    hashId: i,
    layer: l,
    nonce: c,
    clientOnly: f,
    order: p = 0
  } = e, {
    mock: g,
    hashPriority: h,
    container: y,
    transformers: v,
    linters: S,
    cache: x,
    layer: b,
    autoPrefix: C
  } = m.useContext(Qo), E = [i || ""];
  b && E.push("layer"), E.push(...o);
  let $ = Af;
  np(
    rx,
    E,
    // Create cache if needed
    () => {
      const k = E.join("|");
      if (Jw(k)) {
        const [O, j] = ex(k);
        if (O)
          return [O, j, {}, f, p];
      }
      const P = n(), [R, M] = Hf(P, {
        hashId: i,
        hashPriority: h,
        layer: b ? l : void 0,
        path: o.join("-"),
        transformers: v,
        linters: S
      }), I = of(R, C || !1), z = My(E, I);
      return [I, z, M, f, p];
    },
    // Remove cache if no need
    (k, P) => {
      const [, R] = k;
      P && Af && Js(R, {
        mark: qr,
        attachTo: y
      });
    },
    // Effect: Inject style here
    (k) => {
      const [P, R, M, , I] = k;
      if ($ && P !== Py) {
        let z = {
          mark: qr,
          prepend: b ? !1 : "queue",
          attachTo: y,
          priority: I
        };
        z = tp(z, c);
        const O = [], j = [];
        Object.keys(M).forEach((V) => {
          V.startsWith("@layer") ? O.push(V) : j.push(V);
        }), O.forEach((V) => {
          Uo(of(M[V], C || !1), `_layer-${V}`, {
            ...z,
            prepend: !0
          });
        });
        const Y = Uo(P, R, z);
        Y[Xo] = x.instanceId, j.forEach((V) => {
          Uo(of(M[V], C || !1), `_effect-${V}`, z);
        });
      }
    }
  );
}
const ox = "cssVar", ix = (e, n) => {
  const {
    key: o,
    prefix: i,
    unitless: l,
    ignore: c,
    token: f,
    hashId: p,
    scope: g,
    nonce: h
  } = e, {
    cache: {
      instanceId: y
    },
    container: v,
    hashPriority: S
  } = m.useContext(Qo), {
    _tokenKey: x
  } = f, b = Array.isArray(g) ? g.join("@@") : g, C = [...e.path, o, b, x];
  return np(ox, C, () => {
    const $ = n(), [k, P] = Sy($, o, {
      prefix: i,
      unitless: l,
      ignore: c,
      scope: g,
      hashPriority: S,
      hashCls: p
    }), R = My(C, P);
    return [k, P, R, o];
  }, ([, , $]) => {
    Af && Js($, {
      mark: qr,
      attachTo: v
    });
  }, ([, $, k]) => {
    if (!$)
      return;
    let P = {
      mark: qr,
      prepend: "queue",
      attachTo: v,
      priority: -999
    };
    P = tp(P, h);
    const R = Uo($, k, P);
    R[Xo] = y, R.setAttribute(Jd, o);
  });
};
class ln {
  name;
  style;
  constructor(n, o) {
    this.name = n, this.style = o;
  }
  getName(n = "") {
    return n ? `${n}-${this.name}` : this.name;
  }
  _keyframe = !0;
}
function $i(e) {
  return e.notSplit = !0, e;
}
$i(["borderTop", "borderBottom"]), $i(["borderTop"]), $i(["borderBottom"]), $i(["borderLeft", "borderRight"]), $i(["borderLeft"]), $i(["borderRight"]);
const wt = (e) => {
  const n = m.useRef(e);
  return n.current = e, m.useCallback((...i) => n.current?.(...i), []);
}, fg = er() ? m.useLayoutEffect : m.useEffect, fn = (e, n) => {
  const o = m.useRef(!0);
  fg(() => e(o.current), n), fg(() => (o.current = !1, () => {
    o.current = !0;
  }), []);
}, sf = (e, n) => {
  fn((o) => {
    if (!o)
      return e();
  }, n);
}, sx = (e) => {
  const n = m.useRef(!1), [o, i] = m.useState(e);
  m.useEffect(() => (n.current = !1, () => {
    n.current = !0;
  }), []);
  function l(c, f) {
    f && n.current || i(c);
  }
  return [o, l];
};
function rl(e, n) {
  const [o, i] = m.useState(e), l = n !== void 0 ? n : o;
  return fn((c) => {
    c || i(n);
  }, [n]), [
    // Value
    l,
    // Update function
    i
  ];
}
let Ty = (e) => +setTimeout(e, 16), Ny = (e) => clearTimeout(e);
typeof window < "u" && "requestAnimationFrame" in window && (Ty = (e) => window.requestAnimationFrame(e), Ny = (e) => window.cancelAnimationFrame(e));
let dg = 0;
const ip = /* @__PURE__ */ new Map();
function Iy(e) {
  ip.delete(e);
}
const xo = (e, n = 1) => {
  dg += 1;
  const o = dg;
  function i(l) {
    if (l === 0)
      Iy(o), e();
    else {
      const c = Ty(() => {
        i(l - 1);
      });
      ip.set(o, c);
    }
  }
  return i(n), o;
};
xo.cancel = (e) => {
  const n = ip.get(e);
  return Iy(e), Ny(n);
};
function lx() {
  return {
    ...sw
  }.useId;
}
let pg = 0;
const hg = lx(), cl = hg ? (
  // Use React `useId`
  (function(n) {
    const o = hg();
    return n || o;
  })
) : (
  // Use compatible of `useId`
  (function(n) {
    const [o, i] = m.useState("ssr-id");
    return m.useEffect(() => {
      const l = pg;
      pg += 1, i(`rc_unique_${l}`);
    }, []), n || o;
  })
);
function ax(e) {
  const [, n] = m.useReducer((c) => c + 1, 0), o = m.useRef(e), i = wt(() => o.current), l = wt((c) => {
    o.current = typeof c == "function" ? c(o.current) : c, n();
  });
  return [i, l];
}
var lf = { exports: {} }, Ye = {};
var mg;
function cx() {
  if (mg) return Ye;
  mg = 1;
  var e = /* @__PURE__ */ Symbol.for("react.transitional.element"), n = /* @__PURE__ */ Symbol.for("react.portal"), o = /* @__PURE__ */ Symbol.for("react.fragment"), i = /* @__PURE__ */ Symbol.for("react.strict_mode"), l = /* @__PURE__ */ Symbol.for("react.profiler"), c = /* @__PURE__ */ Symbol.for("react.consumer"), f = /* @__PURE__ */ Symbol.for("react.context"), p = /* @__PURE__ */ Symbol.for("react.forward_ref"), g = /* @__PURE__ */ Symbol.for("react.suspense"), h = /* @__PURE__ */ Symbol.for("react.suspense_list"), y = /* @__PURE__ */ Symbol.for("react.memo"), v = /* @__PURE__ */ Symbol.for("react.lazy"), S = /* @__PURE__ */ Symbol.for("react.view_transition"), x = /* @__PURE__ */ Symbol.for("react.client.reference");
  function b(C) {
    if (typeof C == "object" && C !== null) {
      var E = C.$$typeof;
      switch (E) {
        case e:
          switch (C = C.type, C) {
            case o:
            case l:
            case i:
            case g:
            case h:
            case S:
              return C;
            default:
              switch (C = C && C.$$typeof, C) {
                case f:
                case p:
                case v:
                case y:
                  return C;
                case c:
                  return C;
                default:
                  return E;
              }
          }
        case n:
          return E;
      }
    }
  }
  return Ye.ContextConsumer = c, Ye.ContextProvider = f, Ye.Element = e, Ye.ForwardRef = p, Ye.Fragment = o, Ye.Lazy = v, Ye.Memo = y, Ye.Portal = n, Ye.Profiler = l, Ye.StrictMode = i, Ye.Suspense = g, Ye.SuspenseList = h, Ye.isContextConsumer = function(C) {
    return b(C) === c;
  }, Ye.isContextProvider = function(C) {
    return b(C) === f;
  }, Ye.isElement = function(C) {
    return typeof C == "object" && C !== null && C.$$typeof === e;
  }, Ye.isForwardRef = function(C) {
    return b(C) === p;
  }, Ye.isFragment = function(C) {
    return b(C) === o;
  }, Ye.isLazy = function(C) {
    return b(C) === v;
  }, Ye.isMemo = function(C) {
    return b(C) === y;
  }, Ye.isPortal = function(C) {
    return b(C) === n;
  }, Ye.isProfiler = function(C) {
    return b(C) === l;
  }, Ye.isStrictMode = function(C) {
    return b(C) === i;
  }, Ye.isSuspense = function(C) {
    return b(C) === g;
  }, Ye.isSuspenseList = function(C) {
    return b(C) === h;
  }, Ye.isValidElementType = function(C) {
    return typeof C == "string" || typeof C == "function" || C === o || C === l || C === i || C === g || C === h || typeof C == "object" && C !== null && (C.$$typeof === v || C.$$typeof === y || C.$$typeof === f || C.$$typeof === c || C.$$typeof === p || C.$$typeof === x || C.getModuleId !== void 0);
  }, Ye.typeOf = b, Ye;
}
var gg;
function ux() {
  return gg || (gg = 1, lf.exports = /* @__PURE__ */ cx()), lf.exports;
}
var af = /* @__PURE__ */ ux();
const fx = /* @__PURE__ */ Symbol.for("react.element"), dx = /* @__PURE__ */ Symbol.for("react.transitional.element"), px = /* @__PURE__ */ Symbol.for("react.fragment");
function Fy(e) {
  return (
    // Base object type
    e && typeof e == "object" && // React Element type
    (e.$$typeof === fx || e.$$typeof === dx) && // React Fragment type
    e.type === px
  );
}
const hx = Number(m.version.split(".")[0]), mx = (e, n) => {
  typeof e == "function" ? e(n) : typeof e == "object" && e && "current" in e && (e.current = n);
}, ul = (...e) => {
  const n = e.filter(Boolean);
  return n.length <= 1 ? n[0] : (o) => {
    e.forEach((i) => {
      mx(i, o);
    });
  };
}, sp = (...e) => ac(
  () => ul(...e),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  e,
  (n, o) => n.length !== o.length || n.every((i, l) => i !== o[l])
), lp = (e) => {
  if (!e)
    return !1;
  if (ap(e) && hx >= 19)
    return !0;
  const n = af.isMemo(e) ? e.type.type : e.type;
  return !(typeof n == "function" && !n.prototype?.render && n.$$typeof !== af.ForwardRef || typeof e == "function" && !e.prototype?.render && e.$$typeof !== af.ForwardRef);
};
function ap(e) {
  return /* @__PURE__ */ m.isValidElement(e) && !Fy(e);
}
const gx = (e) => ap(e) && lp(e), dc = (e) => {
  if (e && ap(e)) {
    const n = e;
    return n.props.propertyIsEnumerable("ref") ? n.props.ref : n.ref;
  }
  return null;
};
function Ai(e) {
  return e instanceof HTMLElement || e instanceof SVGElement;
}
function cp(e) {
  return e && typeof e == "object" && Ai(e.nativeElement) ? e.nativeElement : Ai(e) ? e : null;
}
const yx = ((e) => {
  if (!e)
    return !1;
  if (e instanceof Element) {
    if (e.offsetParent)
      return !0;
    if (e.getBBox) {
      const {
        width: n,
        height: o
      } = e.getBBox();
      if (n || o)
        return !0;
    }
    if (e.getBoundingClientRect) {
      const {
        width: n,
        height: o
      } = e.getBoundingClientRect();
      if (n || o)
        return !0;
    }
  }
  return !1;
});
function vx(e, n) {
  if (!e) return;
  e.focus(n);
  const {
    cursor: o
  } = n || {};
  if (o && (e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement)) {
    const i = e.value.length;
    switch (o) {
      case "start":
        e.setSelectionRange(0, 0);
        break;
      case "end":
        e.setSelectionRange(i, i);
        break;
      default:
        e.setSelectionRange(0, i);
    }
  }
}
function zy(e) {
  return e?.getRootNode?.();
}
function Sx(e) {
  return zy(e) instanceof ShadowRoot;
}
function jf(e) {
  return Sx(e) ? zy(e) : null;
}
const qs = {
  // NUMLOCK on FF/Safari Mac
  /**
   * ENTER
   */
  ENTER: 13,
  // also NUM_NORTH_WEST
  /**
   * LEFT
   */
  LEFT: 37,
  // also NUM_NORTH
  /**
   * RIGHT
   */
  RIGHT: 39
};
function wx(e) {
  const n = `rc-scrollbar-measure-${Math.random().toString(36).substring(7)}`, o = document.createElement("div");
  o.id = n;
  const i = o.style;
  i.position = "absolute", i.left = "0", i.top = "0", i.width = "100px", i.height = "100px", i.overflow = "scroll";
  let l, c;
  if (e) {
    const g = getComputedStyle(e);
    i.scrollbarColor = g.scrollbarColor, i.scrollbarWidth = g.scrollbarWidth;
    const h = getComputedStyle(e, "::-webkit-scrollbar"), y = parseInt(h.width, 10), v = parseInt(h.height, 10);
    try {
      const S = y ? `width: ${h.width};` : "", x = v ? `height: ${h.height};` : "";
      Uo(`
#${n}::-webkit-scrollbar {
${S}
${x}
}`, n);
    } catch (S) {
      console.error(S), l = y, c = v;
    }
  }
  document.body.appendChild(o);
  const f = e && l && !Number.isNaN(l) ? l : o.offsetWidth - o.clientWidth, p = e && c && !Number.isNaN(c) ? c : o.offsetHeight - o.clientHeight;
  return document.body.removeChild(o), Js(n), {
    width: f,
    height: p
  };
}
function xx(e) {
  return typeof document > "u" || !e || !(e instanceof Element) ? {
    width: 0,
    height: 0
  } : wx(e);
}
var Ms = { exports: {} }, yg;
function Cx() {
  if (yg) return Ms.exports;
  yg = 1, Ms.exports = i, Ms.exports.isMobile = i, Ms.exports.default = i;
  const e = /(android|bb\d+|meego).+mobile|armv7l|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|redmi|series[46]0|samsungbrowser.*mobile|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i, n = /CrOS/, o = /android|ipad|playbook|silk/i;
  function i(l) {
    l || (l = {});
    let c = l.ua;
    if (!c && typeof navigator < "u" && (c = navigator.userAgent), c && c.headers && typeof c.headers["user-agent"] == "string" && (c = c.headers["user-agent"]), typeof c != "string") return !1;
    let f = e.test(c) && !n.test(c) || !!l.tablet && o.test(c);
    return !f && l.tablet && l.featureDetect && navigator && navigator.maxTouchPoints > 1 && c.indexOf("Macintosh") !== -1 && c.indexOf("Safari") !== -1 && (f = !0), f;
  }
  return Ms.exports;
}
Cx();
function Ya(e, n) {
  const o = Object.assign({}, e);
  return Array.isArray(n) && n.forEach((i) => {
    delete o[i];
  }), o;
}
const bx = `accept acceptCharset accessKey action allowFullScreen allowTransparency
    alt async autoComplete autoFocus autoPlay capture cellPadding cellSpacing challenge
    charSet checked classID className colSpan cols content contentEditable contextMenu
    controls coords crossOrigin data dateTime default defer dir disabled download draggable
    encType form formAction formEncType formMethod formNoValidate formTarget frameBorder
    headers height hidden high href hrefLang htmlFor httpEquiv icon id inputMode integrity
    is keyParams keyType kind label lang list loop low manifest marginHeight marginWidth max maxLength media
    mediaGroup method min minLength multiple muted name noValidate nonce open
    optimum pattern placeholder poster preload radioGroup readOnly rel required
    reversed role rowSpan rows sandbox scope scoped scrolling seamless selected
    shape size sizes span spellCheck src srcDoc srcLang srcSet start step style
    summary tabIndex target title type useMap value width wmode wrap`, Ex = `onCopy onCut onPaste onCompositionEnd onCompositionStart onCompositionUpdate onKeyDown
    onKeyPress onKeyUp onFocus onBlur onChange onInput onSubmit onClick onContextMenu onDoubleClick
    onDrag onDragEnd onDragEnter onDragExit onDragLeave onDragOver onDragStart onDrop onMouseDown
    onMouseEnter onMouseLeave onMouseMove onMouseOut onMouseOver onMouseUp onSelect onTouchCancel
    onTouchEnd onTouchMove onTouchStart onScroll onWheel onAbort onCanPlay onCanPlayThrough
    onDurationChange onEmptied onEncrypted onEnded onError onLoadedData onLoadedMetadata
    onLoadStart onPause onPlay onPlaying onProgress onRateChange onSeeked onSeeking onStalled onSuspend onTimeUpdate onVolumeChange onWaiting onLoad
    onPointerDown onPointerMove onPointerUp onPointerCancel onPointerEnter onPointerLeave onPointerOver onPointerOut onGotPointerCapture onLostPointerCapture
    onAnimationStart onAnimationEnd onAnimationIteration
    onTransitionEnd onTransitionRun onTransitionStart onTransitionCancel
    onBeforeInput onReset onInvalid
    onAuxClick onToggle onBeforeToggle onCancel onClose onResize onScrollEnd`, $x = `${bx} ${Ex}`.split(/[\s\n]+/), _x = "aria-", Px = "data-";
function vg(e, n) {
  return e.indexOf(n) === 0;
}
function Rx(e, n = !1) {
  let o;
  n === !1 ? o = {
    aria: !0,
    data: !0,
    attr: !0
  } : n === !0 ? o = {
    aria: !0
  } : o = {
    ...n
  };
  const i = {};
  return Object.keys(e).forEach((l) => {
    // Aria
    (o.aria && (l === "role" || vg(l, _x)) || // Data
    o.data && vg(l, Px) || // Attr
    o.attr && $x.includes(l)) && (i[l] = e[l]);
  }), i;
}
function kx(e, n) {
  return typeof Proxy < "u" && e ? new Proxy(e, {
    get(o, i) {
      if (n[i])
        return n[i];
      const l = o[i];
      return typeof l == "function" ? l.bind(o) : l;
    }
  }) : e;
}
function ol(e, n = {}) {
  let o = [];
  return ye.Children.forEach(e, (i) => {
    i == null && !n.keepEmpty || (Array.isArray(i) ? o = o.concat(ol(i)) : Fy(i) && i.props ? o = o.concat(ol(i.props.children, n)) : o.push(i));
  }), o;
}
function Jn(e, n) {
  let o = e;
  for (let i = 0; i < n.length; i += 1) {
    if (o == null)
      return;
    o = o[n[i]];
  }
  return o;
}
function Oy(e, n, o, i) {
  if (!n.length)
    return o;
  const [l, ...c] = n;
  let f;
  return !e && typeof l == "number" ? f = [] : Array.isArray(e) ? f = [...e] : f = {
    ...e
  }, i && o === void 0 && c.length === 1 ? delete f[l][c[0]] : f[l] = Oy(f[l], c, o, i), f;
}
function In(e, n, o, i = !1) {
  return n.length && i && o === void 0 && !Jn(e, n.slice(0, -1)) ? e : Oy(e, n, o, i);
}
function Mx(e) {
  return typeof e == "object" && e !== null && Object.getPrototypeOf(e) === Object.prototype;
}
function Sg(e) {
  return Array.isArray(e) ? [] : {};
}
const Tx = typeof Reflect > "u" ? Object.keys : Reflect.ownKeys;
function Nx(e, n = {}) {
  const {
    prepareArray: o
  } = n, i = o || (() => []);
  let l = Sg(e[0]);
  return e.forEach((c) => {
    function f(p, g) {
      const h = new Set(g), y = Jn(c, p), v = Array.isArray(y);
      if (v || Mx(y)) {
        if (!h.has(y)) {
          h.add(y);
          const S = Jn(l, p);
          v ? l = In(l, p, i(S, y)) : (!S || typeof S != "object") && (l = In(l, p, Sg(y))), Tx(y).forEach((x) => {
            Object.getOwnPropertyDescriptor(y, x).enumerable && f([...p, x], h);
          });
        }
      } else
        l = In(l, p, y);
    }
    f([]);
  }), l;
}
function Ii(...e) {
  return Nx(e);
}
var va = {}, cf = { exports: {} }, Cn = {}, uf = { exports: {} }, ff = {};
var wg;
function Ix() {
  return wg || (wg = 1, (function(e) {
    function n(D, J) {
      var q = D.length;
      D.push(J);
      e: for (; 0 < q; ) {
        var T = q - 1 >>> 1, A = D[T];
        if (0 < l(A, J)) D[T] = J, D[q] = A, q = T;
        else break e;
      }
    }
    function o(D) {
      return D.length === 0 ? null : D[0];
    }
    function i(D) {
      if (D.length === 0) return null;
      var J = D[0], q = D.pop();
      if (q !== J) {
        D[0] = q;
        e: for (var T = 0, A = D.length, ee = A >>> 1; T < ee; ) {
          var te = 2 * (T + 1) - 1, se = D[te], re = te + 1, fe = D[re];
          if (0 > l(se, q)) re < A && 0 > l(fe, se) ? (D[T] = fe, D[re] = q, T = re) : (D[T] = se, D[te] = q, T = te);
          else if (re < A && 0 > l(fe, q)) D[T] = fe, D[re] = q, T = re;
          else break e;
        }
      }
      return J;
    }
    function l(D, J) {
      var q = D.sortIndex - J.sortIndex;
      return q !== 0 ? q : D.id - J.id;
    }
    if (typeof performance == "object" && typeof performance.now == "function") {
      var c = performance;
      e.unstable_now = function() {
        return c.now();
      };
    } else {
      var f = Date, p = f.now();
      e.unstable_now = function() {
        return f.now() - p;
      };
    }
    var g = [], h = [], y = 1, v = null, S = 3, x = !1, b = !1, C = !1, E = typeof setTimeout == "function" ? setTimeout : null, $ = typeof clearTimeout == "function" ? clearTimeout : null, k = typeof setImmediate < "u" ? setImmediate : null;
    typeof navigator < "u" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 && navigator.scheduling.isInputPending.bind(navigator.scheduling);
    function P(D) {
      for (var J = o(h); J !== null; ) {
        if (J.callback === null) i(h);
        else if (J.startTime <= D) i(h), J.sortIndex = J.expirationTime, n(g, J);
        else break;
        J = o(h);
      }
    }
    function R(D) {
      if (C = !1, P(D), !b) if (o(g) !== null) b = !0, le(M);
      else {
        var J = o(h);
        J !== null && he(R, J.startTime - D);
      }
    }
    function M(D, J) {
      b = !1, C && (C = !1, $(O), O = -1), x = !0;
      var q = S;
      try {
        for (P(J), v = o(g); v !== null && (!(v.expirationTime > J) || D && !V()); ) {
          var T = v.callback;
          if (typeof T == "function") {
            v.callback = null, S = v.priorityLevel;
            var A = T(v.expirationTime <= J);
            J = e.unstable_now(), typeof A == "function" ? v.callback = A : v === o(g) && i(g), P(J);
          } else i(g);
          v = o(g);
        }
        if (v !== null) var ee = !0;
        else {
          var te = o(h);
          te !== null && he(R, te.startTime - J), ee = !1;
        }
        return ee;
      } finally {
        v = null, S = q, x = !1;
      }
    }
    var I = !1, z = null, O = -1, j = 5, Y = -1;
    function V() {
      return !(e.unstable_now() - Y < j);
    }
    function X() {
      if (z !== null) {
        var D = e.unstable_now();
        Y = D;
        var J = !0;
        try {
          J = z(!0, D);
        } finally {
          J ? Q() : (I = !1, z = null);
        }
      } else I = !1;
    }
    var Q;
    if (typeof k == "function") Q = function() {
      k(X);
    };
    else if (typeof MessageChannel < "u") {
      var oe = new MessageChannel(), G = oe.port2;
      oe.port1.onmessage = X, Q = function() {
        G.postMessage(null);
      };
    } else Q = function() {
      E(X, 0);
    };
    function le(D) {
      z = D, I || (I = !0, Q());
    }
    function he(D, J) {
      O = E(function() {
        D(e.unstable_now());
      }, J);
    }
    e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(D) {
      D.callback = null;
    }, e.unstable_continueExecution = function() {
      b || x || (b = !0, le(M));
    }, e.unstable_forceFrameRate = function(D) {
      0 > D || 125 < D ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : j = 0 < D ? Math.floor(1e3 / D) : 5;
    }, e.unstable_getCurrentPriorityLevel = function() {
      return S;
    }, e.unstable_getFirstCallbackNode = function() {
      return o(g);
    }, e.unstable_next = function(D) {
      switch (S) {
        case 1:
        case 2:
        case 3:
          var J = 3;
          break;
        default:
          J = S;
      }
      var q = S;
      S = J;
      try {
        return D();
      } finally {
        S = q;
      }
    }, e.unstable_pauseExecution = function() {
    }, e.unstable_requestPaint = function() {
    }, e.unstable_runWithPriority = function(D, J) {
      switch (D) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          D = 3;
      }
      var q = S;
      S = D;
      try {
        return J();
      } finally {
        S = q;
      }
    }, e.unstable_scheduleCallback = function(D, J, q) {
      var T = e.unstable_now();
      switch (typeof q == "object" && q !== null ? (q = q.delay, q = typeof q == "number" && 0 < q ? T + q : T) : q = T, D) {
        case 1:
          var A = -1;
          break;
        case 2:
          A = 250;
          break;
        case 5:
          A = 1073741823;
          break;
        case 4:
          A = 1e4;
          break;
        default:
          A = 5e3;
      }
      return A = q + A, D = { id: y++, callback: J, priorityLevel: D, startTime: q, expirationTime: A, sortIndex: -1 }, q > T ? (D.sortIndex = q, n(h, D), o(g) === null && D === o(h) && (C ? ($(O), O = -1) : C = !0, he(R, q - T))) : (D.sortIndex = A, n(g, D), b || x || (b = !0, le(M))), D;
    }, e.unstable_shouldYield = V, e.unstable_wrapCallback = function(D) {
      var J = S;
      return function() {
        var q = S;
        S = J;
        try {
          return D.apply(this, arguments);
        } finally {
          S = q;
        }
      };
    };
  })(ff)), ff;
}
var xg;
function Fx() {
  return xg || (xg = 1, uf.exports = Ix()), uf.exports;
}
var Cg;
function zx() {
  if (Cg) return Cn;
  Cg = 1;
  var e = Qd(), n = Fx();
  function o(t) {
    for (var r = "https://reactjs.org/docs/error-decoder.html?invariant=" + t, s = 1; s < arguments.length; s++) r += "&args[]=" + encodeURIComponent(arguments[s]);
    return "Minified React error #" + t + "; visit " + r + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  var i = /* @__PURE__ */ new Set(), l = {};
  function c(t, r) {
    f(t, r), f(t + "Capture", r);
  }
  function f(t, r) {
    for (l[t] = r, t = 0; t < r.length; t++) i.add(r[t]);
  }
  var p = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), g = Object.prototype.hasOwnProperty, h = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, y = {}, v = {};
  function S(t) {
    return g.call(v, t) ? !0 : g.call(y, t) ? !1 : h.test(t) ? v[t] = !0 : (y[t] = !0, !1);
  }
  function x(t, r, s, a) {
    if (s !== null && s.type === 0) return !1;
    switch (typeof r) {
      case "function":
      case "symbol":
        return !0;
      case "boolean":
        return a ? !1 : s !== null ? !s.acceptsBooleans : (t = t.toLowerCase().slice(0, 5), t !== "data-" && t !== "aria-");
      default:
        return !1;
    }
  }
  function b(t, r, s, a) {
    if (r === null || typeof r > "u" || x(t, r, s, a)) return !0;
    if (a) return !1;
    if (s !== null) switch (s.type) {
      case 3:
        return !r;
      case 4:
        return r === !1;
      case 5:
        return isNaN(r);
      case 6:
        return isNaN(r) || 1 > r;
    }
    return !1;
  }
  function C(t, r, s, a, u, d, w) {
    this.acceptsBooleans = r === 2 || r === 3 || r === 4, this.attributeName = a, this.attributeNamespace = u, this.mustUseProperty = s, this.propertyName = t, this.type = r, this.sanitizeURL = d, this.removeEmptyString = w;
  }
  var E = {};
  "children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(t) {
    E[t] = new C(t, 0, !1, t, null, !1, !1);
  }), [["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(t) {
    var r = t[0];
    E[r] = new C(r, 1, !1, t[1], null, !1, !1);
  }), ["contentEditable", "draggable", "spellCheck", "value"].forEach(function(t) {
    E[t] = new C(t, 2, !1, t.toLowerCase(), null, !1, !1);
  }), ["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(t) {
    E[t] = new C(t, 2, !1, t, null, !1, !1);
  }), "allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(t) {
    E[t] = new C(t, 3, !1, t.toLowerCase(), null, !1, !1);
  }), ["checked", "multiple", "muted", "selected"].forEach(function(t) {
    E[t] = new C(t, 3, !0, t, null, !1, !1);
  }), ["capture", "download"].forEach(function(t) {
    E[t] = new C(t, 4, !1, t, null, !1, !1);
  }), ["cols", "rows", "size", "span"].forEach(function(t) {
    E[t] = new C(t, 6, !1, t, null, !1, !1);
  }), ["rowSpan", "start"].forEach(function(t) {
    E[t] = new C(t, 5, !1, t.toLowerCase(), null, !1, !1);
  });
  var $ = /[\-:]([a-z])/g;
  function k(t) {
    return t[1].toUpperCase();
  }
  "accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(t) {
    var r = t.replace(
      $,
      k
    );
    E[r] = new C(r, 1, !1, t, null, !1, !1);
  }), "xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(t) {
    var r = t.replace($, k);
    E[r] = new C(r, 1, !1, t, "http://www.w3.org/1999/xlink", !1, !1);
  }), ["xml:base", "xml:lang", "xml:space"].forEach(function(t) {
    var r = t.replace($, k);
    E[r] = new C(r, 1, !1, t, "http://www.w3.org/XML/1998/namespace", !1, !1);
  }), ["tabIndex", "crossOrigin"].forEach(function(t) {
    E[t] = new C(t, 1, !1, t.toLowerCase(), null, !1, !1);
  }), E.xlinkHref = new C("xlinkHref", 1, !1, "xlink:href", "http://www.w3.org/1999/xlink", !0, !1), ["src", "href", "action", "formAction"].forEach(function(t) {
    E[t] = new C(t, 1, !1, t.toLowerCase(), null, !0, !0);
  });
  function P(t, r, s, a) {
    var u = E.hasOwnProperty(r) ? E[r] : null;
    (u !== null ? u.type !== 0 : a || !(2 < r.length) || r[0] !== "o" && r[0] !== "O" || r[1] !== "n" && r[1] !== "N") && (b(r, s, u, a) && (s = null), a || u === null ? S(r) && (s === null ? t.removeAttribute(r) : t.setAttribute(r, "" + s)) : u.mustUseProperty ? t[u.propertyName] = s === null ? u.type === 3 ? !1 : "" : s : (r = u.attributeName, a = u.attributeNamespace, s === null ? t.removeAttribute(r) : (u = u.type, s = u === 3 || u === 4 && s === !0 ? "" : "" + s, a ? t.setAttributeNS(a, r, s) : t.setAttribute(r, s))));
  }
  var R = e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, M = /* @__PURE__ */ Symbol.for("react.element"), I = /* @__PURE__ */ Symbol.for("react.portal"), z = /* @__PURE__ */ Symbol.for("react.fragment"), O = /* @__PURE__ */ Symbol.for("react.strict_mode"), j = /* @__PURE__ */ Symbol.for("react.profiler"), Y = /* @__PURE__ */ Symbol.for("react.provider"), V = /* @__PURE__ */ Symbol.for("react.context"), X = /* @__PURE__ */ Symbol.for("react.forward_ref"), Q = /* @__PURE__ */ Symbol.for("react.suspense"), oe = /* @__PURE__ */ Symbol.for("react.suspense_list"), G = /* @__PURE__ */ Symbol.for("react.memo"), le = /* @__PURE__ */ Symbol.for("react.lazy"), he = /* @__PURE__ */ Symbol.for("react.offscreen"), D = Symbol.iterator;
  function J(t) {
    return t === null || typeof t != "object" ? null : (t = D && t[D] || t["@@iterator"], typeof t == "function" ? t : null);
  }
  var q = Object.assign, T;
  function A(t) {
    if (T === void 0) try {
      throw Error();
    } catch (s) {
      var r = s.stack.trim().match(/\n( *(at )?)/);
      T = r && r[1] || "";
    }
    return `
` + T + t;
  }
  var ee = !1;
  function te(t, r) {
    if (!t || ee) return "";
    ee = !0;
    var s = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      if (r) if (r = function() {
        throw Error();
      }, Object.defineProperty(r.prototype, "props", { set: function() {
        throw Error();
      } }), typeof Reflect == "object" && Reflect.construct) {
        try {
          Reflect.construct(r, []);
        } catch (H) {
          var a = H;
        }
        Reflect.construct(t, [], r);
      } else {
        try {
          r.call();
        } catch (H) {
          a = H;
        }
        t.call(r.prototype);
      }
      else {
        try {
          throw Error();
        } catch (H) {
          a = H;
        }
        t();
      }
    } catch (H) {
      if (H && a && typeof H.stack == "string") {
        for (var u = H.stack.split(`
`), d = a.stack.split(`
`), w = u.length - 1, _ = d.length - 1; 1 <= w && 0 <= _ && u[w] !== d[_]; ) _--;
        for (; 1 <= w && 0 <= _; w--, _--) if (u[w] !== d[_]) {
          if (w !== 1 || _ !== 1)
            do
              if (w--, _--, 0 > _ || u[w] !== d[_]) {
                var N = `
` + u[w].replace(" at new ", " at ");
                return t.displayName && N.includes("<anonymous>") && (N = N.replace("<anonymous>", t.displayName)), N;
              }
            while (1 <= w && 0 <= _);
          break;
        }
      }
    } finally {
      ee = !1, Error.prepareStackTrace = s;
    }
    return (t = t ? t.displayName || t.name : "") ? A(t) : "";
  }
  function se(t) {
    switch (t.tag) {
      case 5:
        return A(t.type);
      case 16:
        return A("Lazy");
      case 13:
        return A("Suspense");
      case 19:
        return A("SuspenseList");
      case 0:
      case 2:
      case 15:
        return t = te(t.type, !1), t;
      case 11:
        return t = te(t.type.render, !1), t;
      case 1:
        return t = te(t.type, !0), t;
      default:
        return "";
    }
  }
  function re(t) {
    if (t == null) return null;
    if (typeof t == "function") return t.displayName || t.name || null;
    if (typeof t == "string") return t;
    switch (t) {
      case z:
        return "Fragment";
      case I:
        return "Portal";
      case j:
        return "Profiler";
      case O:
        return "StrictMode";
      case Q:
        return "Suspense";
      case oe:
        return "SuspenseList";
    }
    if (typeof t == "object") switch (t.$$typeof) {
      case V:
        return (t.displayName || "Context") + ".Consumer";
      case Y:
        return (t._context.displayName || "Context") + ".Provider";
      case X:
        var r = t.render;
        return t = t.displayName, t || (t = r.displayName || r.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
      case G:
        return r = t.displayName || null, r !== null ? r : re(t.type) || "Memo";
      case le:
        r = t._payload, t = t._init;
        try {
          return re(t(r));
        } catch {
        }
    }
    return null;
  }
  function fe(t) {
    var r = t.type;
    switch (t.tag) {
      case 24:
        return "Cache";
      case 9:
        return (r.displayName || "Context") + ".Consumer";
      case 10:
        return (r._context.displayName || "Context") + ".Provider";
      case 18:
        return "DehydratedFragment";
      case 11:
        return t = r.render, t = t.displayName || t.name || "", r.displayName || (t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef");
      case 7:
        return "Fragment";
      case 5:
        return r;
      case 4:
        return "Portal";
      case 3:
        return "Root";
      case 6:
        return "Text";
      case 16:
        return re(r);
      case 8:
        return r === O ? "StrictMode" : "Mode";
      case 22:
        return "Offscreen";
      case 12:
        return "Profiler";
      case 21:
        return "Scope";
      case 13:
        return "Suspense";
      case 19:
        return "SuspenseList";
      case 25:
        return "TracingMarker";
      case 1:
      case 0:
      case 17:
      case 2:
      case 14:
      case 15:
        if (typeof r == "function") return r.displayName || r.name || null;
        if (typeof r == "string") return r;
    }
    return null;
  }
  function ie(t) {
    switch (typeof t) {
      case "boolean":
      case "number":
      case "string":
      case "undefined":
        return t;
      case "object":
        return t;
      default:
        return "";
    }
  }
  function Z(t) {
    var r = t.type;
    return (t = t.nodeName) && t.toLowerCase() === "input" && (r === "checkbox" || r === "radio");
  }
  function ae(t) {
    var r = Z(t) ? "checked" : "value", s = Object.getOwnPropertyDescriptor(t.constructor.prototype, r), a = "" + t[r];
    if (!t.hasOwnProperty(r) && typeof s < "u" && typeof s.get == "function" && typeof s.set == "function") {
      var u = s.get, d = s.set;
      return Object.defineProperty(t, r, { configurable: !0, get: function() {
        return u.call(this);
      }, set: function(w) {
        a = "" + w, d.call(this, w);
      } }), Object.defineProperty(t, r, { enumerable: s.enumerable }), { getValue: function() {
        return a;
      }, setValue: function(w) {
        a = "" + w;
      }, stopTracking: function() {
        t._valueTracker = null, delete t[r];
      } };
    }
  }
  function ce(t) {
    t._valueTracker || (t._valueTracker = ae(t));
  }
  function Me(t) {
    if (!t) return !1;
    var r = t._valueTracker;
    if (!r) return !0;
    var s = r.getValue(), a = "";
    return t && (a = Z(t) ? t.checked ? "true" : "false" : t.value), t = a, t !== s ? (r.setValue(t), !0) : !1;
  }
  function Ue(t) {
    if (t = t || (typeof document < "u" ? document : void 0), typeof t > "u") return null;
    try {
      return t.activeElement || t.body;
    } catch {
      return t.body;
    }
  }
  function Qe(t, r) {
    var s = r.checked;
    return q({}, r, { defaultChecked: void 0, defaultValue: void 0, value: void 0, checked: s ?? t._wrapperState.initialChecked });
  }
  function ke(t, r) {
    var s = r.defaultValue == null ? "" : r.defaultValue, a = r.checked != null ? r.checked : r.defaultChecked;
    s = ie(r.value != null ? r.value : s), t._wrapperState = { initialChecked: a, initialValue: s, controlled: r.type === "checkbox" || r.type === "radio" ? r.checked != null : r.value != null };
  }
  function Xe(t, r) {
    r = r.checked, r != null && P(t, "checked", r, !1);
  }
  function ut(t, r) {
    Xe(t, r);
    var s = ie(r.value), a = r.type;
    if (s != null) a === "number" ? (s === 0 && t.value === "" || t.value != s) && (t.value = "" + s) : t.value !== "" + s && (t.value = "" + s);
    else if (a === "submit" || a === "reset") {
      t.removeAttribute("value");
      return;
    }
    r.hasOwnProperty("value") ? xt(t, r.type, s) : r.hasOwnProperty("defaultValue") && xt(t, r.type, ie(r.defaultValue)), r.checked == null && r.defaultChecked != null && (t.defaultChecked = !!r.defaultChecked);
  }
  function Oe(t, r, s) {
    if (r.hasOwnProperty("value") || r.hasOwnProperty("defaultValue")) {
      var a = r.type;
      if (!(a !== "submit" && a !== "reset" || r.value !== void 0 && r.value !== null)) return;
      r = "" + t._wrapperState.initialValue, s || r === t.value || (t.value = r), t.defaultValue = r;
    }
    s = t.name, s !== "" && (t.name = ""), t.defaultChecked = !!t._wrapperState.initialChecked, s !== "" && (t.name = s);
  }
  function xt(t, r, s) {
    (r !== "number" || Ue(t.ownerDocument) !== t) && (s == null ? t.defaultValue = "" + t._wrapperState.initialValue : t.defaultValue !== "" + s && (t.defaultValue = "" + s));
  }
  var Ze = Array.isArray;
  function tt(t, r, s, a) {
    if (t = t.options, r) {
      r = {};
      for (var u = 0; u < s.length; u++) r["$" + s[u]] = !0;
      for (s = 0; s < t.length; s++) u = r.hasOwnProperty("$" + t[s].value), t[s].selected !== u && (t[s].selected = u), u && a && (t[s].defaultSelected = !0);
    } else {
      for (s = "" + ie(s), r = null, u = 0; u < t.length; u++) {
        if (t[u].value === s) {
          t[u].selected = !0, a && (t[u].defaultSelected = !0);
          return;
        }
        r !== null || t[u].disabled || (r = t[u]);
      }
      r !== null && (r.selected = !0);
    }
  }
  function je(t, r) {
    if (r.dangerouslySetInnerHTML != null) throw Error(o(91));
    return q({}, r, { value: void 0, defaultValue: void 0, children: "" + t._wrapperState.initialValue });
  }
  function Je(t, r) {
    var s = r.value;
    if (s == null) {
      if (s = r.children, r = r.defaultValue, s != null) {
        if (r != null) throw Error(o(92));
        if (Ze(s)) {
          if (1 < s.length) throw Error(o(93));
          s = s[0];
        }
        r = s;
      }
      r == null && (r = ""), s = r;
    }
    t._wrapperState = { initialValue: ie(s) };
  }
  function ft(t, r) {
    var s = ie(r.value), a = ie(r.defaultValue);
    s != null && (s = "" + s, s !== t.value && (t.value = s), r.defaultValue == null && t.defaultValue !== s && (t.defaultValue = s)), a != null && (t.defaultValue = "" + a);
  }
  function dn(t) {
    var r = t.textContent;
    r === t._wrapperState.initialValue && r !== "" && r !== null && (t.value = r);
  }
  function Rt(t) {
    switch (t) {
      case "svg":
        return "http://www.w3.org/2000/svg";
      case "math":
        return "http://www.w3.org/1998/Math/MathML";
      default:
        return "http://www.w3.org/1999/xhtml";
    }
  }
  function qt(t, r) {
    return t == null || t === "http://www.w3.org/1999/xhtml" ? Rt(r) : t === "http://www.w3.org/2000/svg" && r === "foreignObject" ? "http://www.w3.org/1999/xhtml" : t;
  }
  var Ut, kt = (function(t) {
    return typeof MSApp < "u" && MSApp.execUnsafeLocalFunction ? function(r, s, a, u) {
      MSApp.execUnsafeLocalFunction(function() {
        return t(r, s, a, u);
      });
    } : t;
  })(function(t, r) {
    if (t.namespaceURI !== "http://www.w3.org/2000/svg" || "innerHTML" in t) t.innerHTML = r;
    else {
      for (Ut = Ut || document.createElement("div"), Ut.innerHTML = "<svg>" + r.valueOf().toString() + "</svg>", r = Ut.firstChild; t.firstChild; ) t.removeChild(t.firstChild);
      for (; r.firstChild; ) t.appendChild(r.firstChild);
    }
  });
  function mt(t, r) {
    if (r) {
      var s = t.firstChild;
      if (s && s === t.lastChild && s.nodeType === 3) {
        s.nodeValue = r;
        return;
      }
    }
    t.textContent = r;
  }
  var Mt = {
    animationIterationCount: !0,
    aspectRatio: !0,
    borderImageOutset: !0,
    borderImageSlice: !0,
    borderImageWidth: !0,
    boxFlex: !0,
    boxFlexGroup: !0,
    boxOrdinalGroup: !0,
    columnCount: !0,
    columns: !0,
    flex: !0,
    flexGrow: !0,
    flexPositive: !0,
    flexShrink: !0,
    flexNegative: !0,
    flexOrder: !0,
    gridArea: !0,
    gridRow: !0,
    gridRowEnd: !0,
    gridRowSpan: !0,
    gridRowStart: !0,
    gridColumn: !0,
    gridColumnEnd: !0,
    gridColumnSpan: !0,
    gridColumnStart: !0,
    fontWeight: !0,
    lineClamp: !0,
    lineHeight: !0,
    opacity: !0,
    order: !0,
    orphans: !0,
    tabSize: !0,
    widows: !0,
    zIndex: !0,
    zoom: !0,
    fillOpacity: !0,
    floodOpacity: !0,
    stopOpacity: !0,
    strokeDasharray: !0,
    strokeDashoffset: !0,
    strokeMiterlimit: !0,
    strokeOpacity: !0,
    strokeWidth: !0
  }, qe = ["Webkit", "ms", "Moz", "O"];
  Object.keys(Mt).forEach(function(t) {
    qe.forEach(function(r) {
      r = r + t.charAt(0).toUpperCase() + t.substring(1), Mt[r] = Mt[t];
    });
  });
  function Kt(t, r, s) {
    return r == null || typeof r == "boolean" || r === "" ? "" : s || typeof r != "number" || r === 0 || Mt.hasOwnProperty(t) && Mt[t] ? ("" + r).trim() : r + "px";
  }
  function Ve(t, r) {
    t = t.style;
    for (var s in r) if (r.hasOwnProperty(s)) {
      var a = s.indexOf("--") === 0, u = Kt(s, r[s], a);
      s === "float" && (s = "cssFloat"), a ? t.setProperty(s, u) : t[s] = u;
    }
  }
  var Ae = q({ menuitem: !0 }, { area: !0, base: !0, br: !0, col: !0, embed: !0, hr: !0, img: !0, input: !0, keygen: !0, link: !0, meta: !0, param: !0, source: !0, track: !0, wbr: !0 });
  function ze(t, r) {
    if (r) {
      if (Ae[t] && (r.children != null || r.dangerouslySetInnerHTML != null)) throw Error(o(137, t));
      if (r.dangerouslySetInnerHTML != null) {
        if (r.children != null) throw Error(o(60));
        if (typeof r.dangerouslySetInnerHTML != "object" || !("__html" in r.dangerouslySetInnerHTML)) throw Error(o(61));
      }
      if (r.style != null && typeof r.style != "object") throw Error(o(62));
    }
  }
  function Ge(t, r) {
    if (t.indexOf("-") === -1) return typeof r.is == "string";
    switch (t) {
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return !1;
      default:
        return !0;
    }
  }
  var gt = null;
  function Xt(t) {
    return t = t.target || t.srcElement || window, t.correspondingUseElement && (t = t.correspondingUseElement), t.nodeType === 3 ? t.parentNode : t;
  }
  var nt = null, Qt = null, Tt = null;
  function $n(t) {
    if (t = ms(t)) {
      if (typeof nt != "function") throw Error(o(280));
      var r = t.stateNode;
      r && (r = Nl(r), nt(t.stateNode, t.type, r));
    }
  }
  function _n(t) {
    Qt ? Tt ? Tt.push(t) : Tt = [t] : Qt = t;
  }
  function de() {
    if (Qt) {
      var t = Qt, r = Tt;
      if (Tt = Qt = null, $n(t), r) for (t = 0; t < r.length; t++) $n(r[t]);
    }
  }
  function Ee(t, r) {
    return t(r);
  }
  function xe() {
  }
  var bt = !1;
  function Zt(t, r, s) {
    if (bt) return t(r, s);
    bt = !0;
    try {
      return Ee(t, r, s);
    } finally {
      bt = !1, (Qt !== null || Tt !== null) && (xe(), de());
    }
  }
  function Nt(t, r) {
    var s = t.stateNode;
    if (s === null) return null;
    var a = Nl(s);
    if (a === null) return null;
    s = a[r];
    e: switch (r) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        (a = !a.disabled) || (t = t.type, a = !(t === "button" || t === "input" || t === "select" || t === "textarea")), t = !a;
        break e;
      default:
        t = !1;
    }
    if (t) return null;
    if (s && typeof s != "function") throw Error(o(231, r, typeof s));
    return s;
  }
  var An = !1;
  if (p) try {
    var an = {};
    Object.defineProperty(an, "passive", { get: function() {
      An = !0;
    } }), window.addEventListener("test", an, an), window.removeEventListener("test", an, an);
  } catch {
    An = !1;
  }
  function vr(t, r, s, a, u, d, w, _, N) {
    var H = Array.prototype.slice.call(arguments, 3);
    try {
      r.apply(s, H);
    } catch (U) {
      this.onError(U);
    }
  }
  var Ln = !1, or = null, Pn = !1, ir = null, pn = { onError: function(t) {
    Ln = !0, or = t;
  } };
  function Jt(t, r, s, a, u, d, w, _, N) {
    Ln = !1, or = null, vr.apply(pn, arguments);
  }
  function It(t, r, s, a, u, d, w, _, N) {
    if (Jt.apply(this, arguments), Ln) {
      if (Ln) {
        var H = or;
        Ln = !1, or = null;
      } else throw Error(o(198));
      Pn || (Pn = !0, ir = H);
    }
  }
  function yt(t) {
    var r = t, s = t;
    if (t.alternate) for (; r.return; ) r = r.return;
    else {
      t = r;
      do
        r = t, (r.flags & 4098) !== 0 && (s = r.return), t = r.return;
      while (t);
    }
    return r.tag === 3 ? s : null;
  }
  function hn(t) {
    if (t.tag === 13) {
      var r = t.memoizedState;
      if (r === null && (t = t.alternate, t !== null && (r = t.memoizedState)), r !== null) return r.dehydrated;
    }
    return null;
  }
  function Lt(t) {
    if (yt(t) !== t) throw Error(o(188));
  }
  function mn(t) {
    var r = t.alternate;
    if (!r) {
      if (r = yt(t), r === null) throw Error(o(188));
      return r !== t ? null : t;
    }
    for (var s = t, a = r; ; ) {
      var u = s.return;
      if (u === null) break;
      var d = u.alternate;
      if (d === null) {
        if (a = u.return, a !== null) {
          s = a;
          continue;
        }
        break;
      }
      if (u.child === d.child) {
        for (d = u.child; d; ) {
          if (d === s) return Lt(u), t;
          if (d === a) return Lt(u), r;
          d = d.sibling;
        }
        throw Error(o(188));
      }
      if (s.return !== a.return) s = u, a = d;
      else {
        for (var w = !1, _ = u.child; _; ) {
          if (_ === s) {
            w = !0, s = u, a = d;
            break;
          }
          if (_ === a) {
            w = !0, a = u, s = d;
            break;
          }
          _ = _.sibling;
        }
        if (!w) {
          for (_ = d.child; _; ) {
            if (_ === s) {
              w = !0, s = d, a = u;
              break;
            }
            if (_ === a) {
              w = !0, a = d, s = u;
              break;
            }
            _ = _.sibling;
          }
          if (!w) throw Error(o(189));
        }
      }
      if (s.alternate !== a) throw Error(o(190));
    }
    if (s.tag !== 3) throw Error(o(188));
    return s.stateNode.current === s ? t : r;
  }
  function Yr(t) {
    return t = mn(t), t !== null ? rt(t) : null;
  }
  function rt(t) {
    if (t.tag === 5 || t.tag === 6) return t;
    for (t = t.child; t !== null; ) {
      var r = rt(t);
      if (r !== null) return r;
      t = t.sibling;
    }
    return null;
  }
  var Sr = n.unstable_scheduleCallback, Kr = n.unstable_cancelCallback, dt = n.unstable_shouldYield, en = n.unstable_requestPaint, Be = n.unstable_now, Bn = n.unstable_getCurrentPriorityLevel, Hn = n.unstable_ImmediatePriority, Mr = n.unstable_UserBlockingPriority, tn = n.unstable_NormalPriority, Tr = n.unstable_LowPriority, Dn = n.unstable_IdlePriority, gn = null, at = null;
  function Re(t) {
    if (at && typeof at.onCommitFiberRoot == "function") try {
      at.onCommitFiberRoot(gn, t, void 0, (t.current.flags & 128) === 128);
    } catch {
    }
  }
  var et = Math.clz32 ? Math.clz32 : Nr, Bt = Math.log, bo = Math.LN2;
  function Nr(t) {
    return t >>>= 0, t === 0 ? 32 : 31 - (Bt(t) / bo | 0) | 0;
  }
  var Ir = 64, Fr = 4194304;
  function wr(t) {
    switch (t & -t) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 4:
        return 4;
      case 8:
        return 8;
      case 16:
        return 16;
      case 32:
        return 32;
      case 64:
      case 128:
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return t & 4194240;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
      case 67108864:
        return t & 130023424;
      case 134217728:
        return 134217728;
      case 268435456:
        return 268435456;
      case 536870912:
        return 536870912;
      case 1073741824:
        return 1073741824;
      default:
        return t;
    }
  }
  function Eo(t, r) {
    var s = t.pendingLanes;
    if (s === 0) return 0;
    var a = 0, u = t.suspendedLanes, d = t.pingedLanes, w = s & 268435455;
    if (w !== 0) {
      var _ = w & ~u;
      _ !== 0 ? a = wr(_) : (d &= w, d !== 0 && (a = wr(d)));
    } else w = s & ~u, w !== 0 ? a = wr(w) : d !== 0 && (a = wr(d));
    if (a === 0) return 0;
    if (r !== 0 && r !== a && (r & u) === 0 && (u = a & -a, d = r & -r, u >= d || u === 16 && (d & 4194240) !== 0)) return r;
    if ((a & 4) !== 0 && (a |= s & 16), r = t.entangledLanes, r !== 0) for (t = t.entanglements, r &= a; 0 < r; ) s = 31 - et(r), u = 1 << s, a |= t[s], r &= ~u;
    return a;
  }
  function Ki(t, r) {
    switch (t) {
      case 1:
      case 2:
      case 4:
        return r + 250;
      case 8:
      case 16:
      case 32:
      case 64:
      case 128:
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return r + 5e3;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
      case 67108864:
        return -1;
      case 134217728:
      case 268435456:
      case 536870912:
      case 1073741824:
        return -1;
      default:
        return -1;
    }
  }
  function Qi(t, r) {
    for (var s = t.suspendedLanes, a = t.pingedLanes, u = t.expirationTimes, d = t.pendingLanes; 0 < d; ) {
      var w = 31 - et(d), _ = 1 << w, N = u[w];
      N === -1 ? ((_ & s) === 0 || (_ & a) !== 0) && (u[w] = Ki(_, r)) : N <= r && (t.expiredLanes |= _), d &= ~_;
    }
  }
  function Zi(t) {
    return t = t.pendingLanes & -1073741825, t !== 0 ? t : t & 1073741824 ? 1073741824 : 0;
  }
  function ue() {
    var t = Ir;
    return Ir <<= 1, (Ir & 4194240) === 0 && (Ir = 64), t;
  }
  function Fe(t) {
    for (var r = [], s = 0; 31 > s; s++) r.push(t);
    return r;
  }
  function xr(t, r, s) {
    t.pendingLanes |= r, r !== 536870912 && (t.suspendedLanes = 0, t.pingedLanes = 0), t = t.eventTimes, r = 31 - et(r), t[r] = s;
  }
  function Cc(t, r) {
    var s = t.pendingLanes & ~r;
    t.pendingLanes = r, t.suspendedLanes = 0, t.pingedLanes = 0, t.expiredLanes &= r, t.mutableReadLanes &= r, t.entangledLanes &= r, r = t.entanglements;
    var a = t.eventTimes;
    for (t = t.expirationTimes; 0 < s; ) {
      var u = 31 - et(s), d = 1 << u;
      r[u] = 0, a[u] = -1, t[u] = -1, s &= ~d;
    }
  }
  function ti(t, r) {
    var s = t.entangledLanes |= r;
    for (t = t.entanglements; s; ) {
      var a = 31 - et(s), u = 1 << a;
      u & r | t[a] & r && (t[a] |= r), s &= ~u;
    }
  }
  var He = 0;
  function gl(t) {
    return t &= -t, 1 < t ? 4 < t ? (t & 268435455) !== 0 ? 16 : 536870912 : 4 : 1;
  }
  var Mp, bc, Tp, Np, Ip, Ec = !1, yl = [], Qr = null, Zr = null, Jr = null, Ji = /* @__PURE__ */ new Map(), es = /* @__PURE__ */ new Map(), eo = [], _1 = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
  function Fp(t, r) {
    switch (t) {
      case "focusin":
      case "focusout":
        Qr = null;
        break;
      case "dragenter":
      case "dragleave":
        Zr = null;
        break;
      case "mouseover":
      case "mouseout":
        Jr = null;
        break;
      case "pointerover":
      case "pointerout":
        Ji.delete(r.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        es.delete(r.pointerId);
    }
  }
  function ts(t, r, s, a, u, d) {
    return t === null || t.nativeEvent !== d ? (t = { blockedOn: r, domEventName: s, eventSystemFlags: a, nativeEvent: d, targetContainers: [u] }, r !== null && (r = ms(r), r !== null && bc(r)), t) : (t.eventSystemFlags |= a, r = t.targetContainers, u !== null && r.indexOf(u) === -1 && r.push(u), t);
  }
  function P1(t, r, s, a, u) {
    switch (r) {
      case "focusin":
        return Qr = ts(Qr, t, r, s, a, u), !0;
      case "dragenter":
        return Zr = ts(Zr, t, r, s, a, u), !0;
      case "mouseover":
        return Jr = ts(Jr, t, r, s, a, u), !0;
      case "pointerover":
        var d = u.pointerId;
        return Ji.set(d, ts(Ji.get(d) || null, t, r, s, a, u)), !0;
      case "gotpointercapture":
        return d = u.pointerId, es.set(d, ts(es.get(d) || null, t, r, s, a, u)), !0;
    }
    return !1;
  }
  function zp(t) {
    var r = $o(t.target);
    if (r !== null) {
      var s = yt(r);
      if (s !== null) {
        if (r = s.tag, r === 13) {
          if (r = hn(s), r !== null) {
            t.blockedOn = r, Ip(t.priority, function() {
              Tp(s);
            });
            return;
          }
        } else if (r === 3 && s.stateNode.current.memoizedState.isDehydrated) {
          t.blockedOn = s.tag === 3 ? s.stateNode.containerInfo : null;
          return;
        }
      }
    }
    t.blockedOn = null;
  }
  function vl(t) {
    if (t.blockedOn !== null) return !1;
    for (var r = t.targetContainers; 0 < r.length; ) {
      var s = _c(t.domEventName, t.eventSystemFlags, r[0], t.nativeEvent);
      if (s === null) {
        s = t.nativeEvent;
        var a = new s.constructor(s.type, s);
        gt = a, s.target.dispatchEvent(a), gt = null;
      } else return r = ms(s), r !== null && bc(r), t.blockedOn = s, !1;
      r.shift();
    }
    return !0;
  }
  function Op(t, r, s) {
    vl(t) && s.delete(r);
  }
  function R1() {
    Ec = !1, Qr !== null && vl(Qr) && (Qr = null), Zr !== null && vl(Zr) && (Zr = null), Jr !== null && vl(Jr) && (Jr = null), Ji.forEach(Op), es.forEach(Op);
  }
  function ns(t, r) {
    t.blockedOn === r && (t.blockedOn = null, Ec || (Ec = !0, n.unstable_scheduleCallback(n.unstable_NormalPriority, R1)));
  }
  function rs(t) {
    function r(u) {
      return ns(u, t);
    }
    if (0 < yl.length) {
      ns(yl[0], t);
      for (var s = 1; s < yl.length; s++) {
        var a = yl[s];
        a.blockedOn === t && (a.blockedOn = null);
      }
    }
    for (Qr !== null && ns(Qr, t), Zr !== null && ns(Zr, t), Jr !== null && ns(Jr, t), Ji.forEach(r), es.forEach(r), s = 0; s < eo.length; s++) a = eo[s], a.blockedOn === t && (a.blockedOn = null);
    for (; 0 < eo.length && (s = eo[0], s.blockedOn === null); ) zp(s), s.blockedOn === null && eo.shift();
  }
  var ni = R.ReactCurrentBatchConfig, Sl = !0;
  function k1(t, r, s, a) {
    var u = He, d = ni.transition;
    ni.transition = null;
    try {
      He = 1, $c(t, r, s, a);
    } finally {
      He = u, ni.transition = d;
    }
  }
  function M1(t, r, s, a) {
    var u = He, d = ni.transition;
    ni.transition = null;
    try {
      He = 4, $c(t, r, s, a);
    } finally {
      He = u, ni.transition = d;
    }
  }
  function $c(t, r, s, a) {
    if (Sl) {
      var u = _c(t, r, s, a);
      if (u === null) Vc(t, r, a, wl, s), Fp(t, a);
      else if (P1(u, t, r, s, a)) a.stopPropagation();
      else if (Fp(t, a), r & 4 && -1 < _1.indexOf(t)) {
        for (; u !== null; ) {
          var d = ms(u);
          if (d !== null && Mp(d), d = _c(t, r, s, a), d === null && Vc(t, r, a, wl, s), d === u) break;
          u = d;
        }
        u !== null && a.stopPropagation();
      } else Vc(t, r, a, null, s);
    }
  }
  var wl = null;
  function _c(t, r, s, a) {
    if (wl = null, t = Xt(a), t = $o(t), t !== null) if (r = yt(t), r === null) t = null;
    else if (s = r.tag, s === 13) {
      if (t = hn(r), t !== null) return t;
      t = null;
    } else if (s === 3) {
      if (r.stateNode.current.memoizedState.isDehydrated) return r.tag === 3 ? r.stateNode.containerInfo : null;
      t = null;
    } else r !== t && (t = null);
    return wl = t, null;
  }
  function Ap(t) {
    switch (t) {
      case "cancel":
      case "click":
      case "close":
      case "contextmenu":
      case "copy":
      case "cut":
      case "auxclick":
      case "dblclick":
      case "dragend":
      case "dragstart":
      case "drop":
      case "focusin":
      case "focusout":
      case "input":
      case "invalid":
      case "keydown":
      case "keypress":
      case "keyup":
      case "mousedown":
      case "mouseup":
      case "paste":
      case "pause":
      case "play":
      case "pointercancel":
      case "pointerdown":
      case "pointerup":
      case "ratechange":
      case "reset":
      case "resize":
      case "seeked":
      case "submit":
      case "touchcancel":
      case "touchend":
      case "touchstart":
      case "volumechange":
      case "change":
      case "selectionchange":
      case "textInput":
      case "compositionstart":
      case "compositionend":
      case "compositionupdate":
      case "beforeblur":
      case "afterblur":
      case "beforeinput":
      case "blur":
      case "fullscreenchange":
      case "focus":
      case "hashchange":
      case "popstate":
      case "select":
      case "selectstart":
        return 1;
      case "drag":
      case "dragenter":
      case "dragexit":
      case "dragleave":
      case "dragover":
      case "mousemove":
      case "mouseout":
      case "mouseover":
      case "pointermove":
      case "pointerout":
      case "pointerover":
      case "scroll":
      case "toggle":
      case "touchmove":
      case "wheel":
      case "mouseenter":
      case "mouseleave":
      case "pointerenter":
      case "pointerleave":
        return 4;
      case "message":
        switch (Bn()) {
          case Hn:
            return 1;
          case Mr:
            return 4;
          case tn:
          case Tr:
            return 16;
          case Dn:
            return 536870912;
          default:
            return 16;
        }
      default:
        return 16;
    }
  }
  var to = null, Pc = null, xl = null;
  function Lp() {
    if (xl) return xl;
    var t, r = Pc, s = r.length, a, u = "value" in to ? to.value : to.textContent, d = u.length;
    for (t = 0; t < s && r[t] === u[t]; t++) ;
    var w = s - t;
    for (a = 1; a <= w && r[s - a] === u[d - a]; a++) ;
    return xl = u.slice(t, 1 < a ? 1 - a : void 0);
  }
  function Cl(t) {
    var r = t.keyCode;
    return "charCode" in t ? (t = t.charCode, t === 0 && r === 13 && (t = 13)) : t = r, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
  }
  function bl() {
    return !0;
  }
  function Bp() {
    return !1;
  }
  function Rn(t) {
    function r(s, a, u, d, w) {
      this._reactName = s, this._targetInst = u, this.type = a, this.nativeEvent = d, this.target = w, this.currentTarget = null;
      for (var _ in t) t.hasOwnProperty(_) && (s = t[_], this[_] = s ? s(d) : d[_]);
      return this.isDefaultPrevented = (d.defaultPrevented != null ? d.defaultPrevented : d.returnValue === !1) ? bl : Bp, this.isPropagationStopped = Bp, this;
    }
    return q(r.prototype, { preventDefault: function() {
      this.defaultPrevented = !0;
      var s = this.nativeEvent;
      s && (s.preventDefault ? s.preventDefault() : typeof s.returnValue != "unknown" && (s.returnValue = !1), this.isDefaultPrevented = bl);
    }, stopPropagation: function() {
      var s = this.nativeEvent;
      s && (s.stopPropagation ? s.stopPropagation() : typeof s.cancelBubble != "unknown" && (s.cancelBubble = !0), this.isPropagationStopped = bl);
    }, persist: function() {
    }, isPersistent: bl }), r;
  }
  var ri = { eventPhase: 0, bubbles: 0, cancelable: 0, timeStamp: function(t) {
    return t.timeStamp || Date.now();
  }, defaultPrevented: 0, isTrusted: 0 }, Rc = Rn(ri), os = q({}, ri, { view: 0, detail: 0 }), T1 = Rn(os), kc, Mc, is, El = q({}, os, { screenX: 0, screenY: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, getModifierState: Nc, button: 0, buttons: 0, relatedTarget: function(t) {
    return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
  }, movementX: function(t) {
    return "movementX" in t ? t.movementX : (t !== is && (is && t.type === "mousemove" ? (kc = t.screenX - is.screenX, Mc = t.screenY - is.screenY) : Mc = kc = 0, is = t), kc);
  }, movementY: function(t) {
    return "movementY" in t ? t.movementY : Mc;
  } }), Hp = Rn(El), N1 = q({}, El, { dataTransfer: 0 }), I1 = Rn(N1), F1 = q({}, os, { relatedTarget: 0 }), Tc = Rn(F1), z1 = q({}, ri, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }), O1 = Rn(z1), A1 = q({}, ri, { clipboardData: function(t) {
    return "clipboardData" in t ? t.clipboardData : window.clipboardData;
  } }), L1 = Rn(A1), B1 = q({}, ri, { data: 0 }), Dp = Rn(B1), H1 = {
    Esc: "Escape",
    Spacebar: " ",
    Left: "ArrowLeft",
    Up: "ArrowUp",
    Right: "ArrowRight",
    Down: "ArrowDown",
    Del: "Delete",
    Win: "OS",
    Menu: "ContextMenu",
    Apps: "ContextMenu",
    Scroll: "ScrollLock",
    MozPrintableKey: "Unidentified"
  }, D1 = {
    8: "Backspace",
    9: "Tab",
    12: "Clear",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Escape",
    32: " ",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    45: "Insert",
    46: "Delete",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12",
    144: "NumLock",
    145: "ScrollLock",
    224: "Meta"
  }, j1 = { Alt: "altKey", Control: "ctrlKey", Meta: "metaKey", Shift: "shiftKey" };
  function V1(t) {
    var r = this.nativeEvent;
    return r.getModifierState ? r.getModifierState(t) : (t = j1[t]) ? !!r[t] : !1;
  }
  function Nc() {
    return V1;
  }
  var W1 = q({}, os, { key: function(t) {
    if (t.key) {
      var r = H1[t.key] || t.key;
      if (r !== "Unidentified") return r;
    }
    return t.type === "keypress" ? (t = Cl(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? D1[t.keyCode] || "Unidentified" : "";
  }, code: 0, location: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, repeat: 0, locale: 0, getModifierState: Nc, charCode: function(t) {
    return t.type === "keypress" ? Cl(t) : 0;
  }, keyCode: function(t) {
    return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
  }, which: function(t) {
    return t.type === "keypress" ? Cl(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
  } }), q1 = Rn(W1), U1 = q({}, El, { pointerId: 0, width: 0, height: 0, pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0, pointerType: 0, isPrimary: 0 }), jp = Rn(U1), X1 = q({}, os, { touches: 0, targetTouches: 0, changedTouches: 0, altKey: 0, metaKey: 0, ctrlKey: 0, shiftKey: 0, getModifierState: Nc }), G1 = Rn(X1), Y1 = q({}, ri, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }), K1 = Rn(Y1), Q1 = q({}, El, {
    deltaX: function(t) {
      return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
    },
    deltaY: function(t) {
      return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), Z1 = Rn(Q1), J1 = [9, 13, 27, 32], Ic = p && "CompositionEvent" in window, ss = null;
  p && "documentMode" in document && (ss = document.documentMode);
  var eS = p && "TextEvent" in window && !ss, Vp = p && (!Ic || ss && 8 < ss && 11 >= ss), Wp = " ", qp = !1;
  function Up(t, r) {
    switch (t) {
      case "keyup":
        return J1.indexOf(r.keyCode) !== -1;
      case "keydown":
        return r.keyCode !== 229;
      case "keypress":
      case "mousedown":
      case "focusout":
        return !0;
      default:
        return !1;
    }
  }
  function Xp(t) {
    return t = t.detail, typeof t == "object" && "data" in t ? t.data : null;
  }
  var oi = !1;
  function tS(t, r) {
    switch (t) {
      case "compositionend":
        return Xp(r);
      case "keypress":
        return r.which !== 32 ? null : (qp = !0, Wp);
      case "textInput":
        return t = r.data, t === Wp && qp ? null : t;
      default:
        return null;
    }
  }
  function nS(t, r) {
    if (oi) return t === "compositionend" || !Ic && Up(t, r) ? (t = Lp(), xl = Pc = to = null, oi = !1, t) : null;
    switch (t) {
      case "paste":
        return null;
      case "keypress":
        if (!(r.ctrlKey || r.altKey || r.metaKey) || r.ctrlKey && r.altKey) {
          if (r.char && 1 < r.char.length) return r.char;
          if (r.which) return String.fromCharCode(r.which);
        }
        return null;
      case "compositionend":
        return Vp && r.locale !== "ko" ? null : r.data;
      default:
        return null;
    }
  }
  var rS = { color: !0, date: !0, datetime: !0, "datetime-local": !0, email: !0, month: !0, number: !0, password: !0, range: !0, search: !0, tel: !0, text: !0, time: !0, url: !0, week: !0 };
  function Gp(t) {
    var r = t && t.nodeName && t.nodeName.toLowerCase();
    return r === "input" ? !!rS[t.type] : r === "textarea";
  }
  function Yp(t, r, s, a) {
    _n(a), r = kl(r, "onChange"), 0 < r.length && (s = new Rc("onChange", "change", null, s, a), t.push({ event: s, listeners: r }));
  }
  var ls = null, as = null;
  function oS(t) {
    ph(t, 0);
  }
  function $l(t) {
    var r = ci(t);
    if (Me(r)) return t;
  }
  function iS(t, r) {
    if (t === "change") return r;
  }
  var Kp = !1;
  if (p) {
    var Fc;
    if (p) {
      var zc = "oninput" in document;
      if (!zc) {
        var Qp = document.createElement("div");
        Qp.setAttribute("oninput", "return;"), zc = typeof Qp.oninput == "function";
      }
      Fc = zc;
    } else Fc = !1;
    Kp = Fc && (!document.documentMode || 9 < document.documentMode);
  }
  function Zp() {
    ls && (ls.detachEvent("onpropertychange", Jp), as = ls = null);
  }
  function Jp(t) {
    if (t.propertyName === "value" && $l(as)) {
      var r = [];
      Yp(r, as, t, Xt(t)), Zt(oS, r);
    }
  }
  function sS(t, r, s) {
    t === "focusin" ? (Zp(), ls = r, as = s, ls.attachEvent("onpropertychange", Jp)) : t === "focusout" && Zp();
  }
  function lS(t) {
    if (t === "selectionchange" || t === "keyup" || t === "keydown") return $l(as);
  }
  function aS(t, r) {
    if (t === "click") return $l(r);
  }
  function cS(t, r) {
    if (t === "input" || t === "change") return $l(r);
  }
  function uS(t, r) {
    return t === r && (t !== 0 || 1 / t === 1 / r) || t !== t && r !== r;
  }
  var sr = typeof Object.is == "function" ? Object.is : uS;
  function cs(t, r) {
    if (sr(t, r)) return !0;
    if (typeof t != "object" || t === null || typeof r != "object" || r === null) return !1;
    var s = Object.keys(t), a = Object.keys(r);
    if (s.length !== a.length) return !1;
    for (a = 0; a < s.length; a++) {
      var u = s[a];
      if (!g.call(r, u) || !sr(t[u], r[u])) return !1;
    }
    return !0;
  }
  function eh(t) {
    for (; t && t.firstChild; ) t = t.firstChild;
    return t;
  }
  function th(t, r) {
    var s = eh(t);
    t = 0;
    for (var a; s; ) {
      if (s.nodeType === 3) {
        if (a = t + s.textContent.length, t <= r && a >= r) return { node: s, offset: r - t };
        t = a;
      }
      e: {
        for (; s; ) {
          if (s.nextSibling) {
            s = s.nextSibling;
            break e;
          }
          s = s.parentNode;
        }
        s = void 0;
      }
      s = eh(s);
    }
  }
  function nh(t, r) {
    return t && r ? t === r ? !0 : t && t.nodeType === 3 ? !1 : r && r.nodeType === 3 ? nh(t, r.parentNode) : "contains" in t ? t.contains(r) : t.compareDocumentPosition ? !!(t.compareDocumentPosition(r) & 16) : !1 : !1;
  }
  function rh() {
    for (var t = window, r = Ue(); r instanceof t.HTMLIFrameElement; ) {
      try {
        var s = typeof r.contentWindow.location.href == "string";
      } catch {
        s = !1;
      }
      if (s) t = r.contentWindow;
      else break;
      r = Ue(t.document);
    }
    return r;
  }
  function Oc(t) {
    var r = t && t.nodeName && t.nodeName.toLowerCase();
    return r && (r === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || r === "textarea" || t.contentEditable === "true");
  }
  function fS(t) {
    var r = rh(), s = t.focusedElem, a = t.selectionRange;
    if (r !== s && s && s.ownerDocument && nh(s.ownerDocument.documentElement, s)) {
      if (a !== null && Oc(s)) {
        if (r = a.start, t = a.end, t === void 0 && (t = r), "selectionStart" in s) s.selectionStart = r, s.selectionEnd = Math.min(t, s.value.length);
        else if (t = (r = s.ownerDocument || document) && r.defaultView || window, t.getSelection) {
          t = t.getSelection();
          var u = s.textContent.length, d = Math.min(a.start, u);
          a = a.end === void 0 ? d : Math.min(a.end, u), !t.extend && d > a && (u = a, a = d, d = u), u = th(s, d);
          var w = th(
            s,
            a
          );
          u && w && (t.rangeCount !== 1 || t.anchorNode !== u.node || t.anchorOffset !== u.offset || t.focusNode !== w.node || t.focusOffset !== w.offset) && (r = r.createRange(), r.setStart(u.node, u.offset), t.removeAllRanges(), d > a ? (t.addRange(r), t.extend(w.node, w.offset)) : (r.setEnd(w.node, w.offset), t.addRange(r)));
        }
      }
      for (r = [], t = s; t = t.parentNode; ) t.nodeType === 1 && r.push({ element: t, left: t.scrollLeft, top: t.scrollTop });
      for (typeof s.focus == "function" && s.focus(), s = 0; s < r.length; s++) t = r[s], t.element.scrollLeft = t.left, t.element.scrollTop = t.top;
    }
  }
  var dS = p && "documentMode" in document && 11 >= document.documentMode, ii = null, Ac = null, us = null, Lc = !1;
  function oh(t, r, s) {
    var a = s.window === s ? s.document : s.nodeType === 9 ? s : s.ownerDocument;
    Lc || ii == null || ii !== Ue(a) || (a = ii, "selectionStart" in a && Oc(a) ? a = { start: a.selectionStart, end: a.selectionEnd } : (a = (a.ownerDocument && a.ownerDocument.defaultView || window).getSelection(), a = { anchorNode: a.anchorNode, anchorOffset: a.anchorOffset, focusNode: a.focusNode, focusOffset: a.focusOffset }), us && cs(us, a) || (us = a, a = kl(Ac, "onSelect"), 0 < a.length && (r = new Rc("onSelect", "select", null, r, s), t.push({ event: r, listeners: a }), r.target = ii)));
  }
  function _l(t, r) {
    var s = {};
    return s[t.toLowerCase()] = r.toLowerCase(), s["Webkit" + t] = "webkit" + r, s["Moz" + t] = "moz" + r, s;
  }
  var si = { animationend: _l("Animation", "AnimationEnd"), animationiteration: _l("Animation", "AnimationIteration"), animationstart: _l("Animation", "AnimationStart"), transitionend: _l("Transition", "TransitionEnd") }, Bc = {}, ih = {};
  p && (ih = document.createElement("div").style, "AnimationEvent" in window || (delete si.animationend.animation, delete si.animationiteration.animation, delete si.animationstart.animation), "TransitionEvent" in window || delete si.transitionend.transition);
  function Pl(t) {
    if (Bc[t]) return Bc[t];
    if (!si[t]) return t;
    var r = si[t], s;
    for (s in r) if (r.hasOwnProperty(s) && s in ih) return Bc[t] = r[s];
    return t;
  }
  var sh = Pl("animationend"), lh = Pl("animationiteration"), ah = Pl("animationstart"), ch = Pl("transitionend"), uh = /* @__PURE__ */ new Map(), fh = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
  function no(t, r) {
    uh.set(t, r), c(r, [t]);
  }
  for (var Hc = 0; Hc < fh.length; Hc++) {
    var Dc = fh[Hc], pS = Dc.toLowerCase(), hS = Dc[0].toUpperCase() + Dc.slice(1);
    no(pS, "on" + hS);
  }
  no(sh, "onAnimationEnd"), no(lh, "onAnimationIteration"), no(ah, "onAnimationStart"), no("dblclick", "onDoubleClick"), no("focusin", "onFocus"), no("focusout", "onBlur"), no(ch, "onTransitionEnd"), f("onMouseEnter", ["mouseout", "mouseover"]), f("onMouseLeave", ["mouseout", "mouseover"]), f("onPointerEnter", ["pointerout", "pointerover"]), f("onPointerLeave", ["pointerout", "pointerover"]), c("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), c("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), c("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]), c("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), c("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), c("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
  var fs = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), mS = new Set("cancel close invalid load scroll toggle".split(" ").concat(fs));
  function dh(t, r, s) {
    var a = t.type || "unknown-event";
    t.currentTarget = s, It(a, r, void 0, t), t.currentTarget = null;
  }
  function ph(t, r) {
    r = (r & 4) !== 0;
    for (var s = 0; s < t.length; s++) {
      var a = t[s], u = a.event;
      a = a.listeners;
      e: {
        var d = void 0;
        if (r) for (var w = a.length - 1; 0 <= w; w--) {
          var _ = a[w], N = _.instance, H = _.currentTarget;
          if (_ = _.listener, N !== d && u.isPropagationStopped()) break e;
          dh(u, _, H), d = N;
        }
        else for (w = 0; w < a.length; w++) {
          if (_ = a[w], N = _.instance, H = _.currentTarget, _ = _.listener, N !== d && u.isPropagationStopped()) break e;
          dh(u, _, H), d = N;
        }
      }
    }
    if (Pn) throw t = ir, Pn = !1, ir = null, t;
  }
  function it(t, r) {
    var s = r[Yc];
    s === void 0 && (s = r[Yc] = /* @__PURE__ */ new Set());
    var a = t + "__bubble";
    s.has(a) || (hh(r, t, 2, !1), s.add(a));
  }
  function jc(t, r, s) {
    var a = 0;
    r && (a |= 4), hh(s, t, a, r);
  }
  var Rl = "_reactListening" + Math.random().toString(36).slice(2);
  function ds(t) {
    if (!t[Rl]) {
      t[Rl] = !0, i.forEach(function(s) {
        s !== "selectionchange" && (mS.has(s) || jc(s, !1, t), jc(s, !0, t));
      });
      var r = t.nodeType === 9 ? t : t.ownerDocument;
      r === null || r[Rl] || (r[Rl] = !0, jc("selectionchange", !1, r));
    }
  }
  function hh(t, r, s, a) {
    switch (Ap(r)) {
      case 1:
        var u = k1;
        break;
      case 4:
        u = M1;
        break;
      default:
        u = $c;
    }
    s = u.bind(null, r, s, t), u = void 0, !An || r !== "touchstart" && r !== "touchmove" && r !== "wheel" || (u = !0), a ? u !== void 0 ? t.addEventListener(r, s, { capture: !0, passive: u }) : t.addEventListener(r, s, !0) : u !== void 0 ? t.addEventListener(r, s, { passive: u }) : t.addEventListener(r, s, !1);
  }
  function Vc(t, r, s, a, u) {
    var d = a;
    if ((r & 1) === 0 && (r & 2) === 0 && a !== null) e: for (; ; ) {
      if (a === null) return;
      var w = a.tag;
      if (w === 3 || w === 4) {
        var _ = a.stateNode.containerInfo;
        if (_ === u || _.nodeType === 8 && _.parentNode === u) break;
        if (w === 4) for (w = a.return; w !== null; ) {
          var N = w.tag;
          if ((N === 3 || N === 4) && (N = w.stateNode.containerInfo, N === u || N.nodeType === 8 && N.parentNode === u)) return;
          w = w.return;
        }
        for (; _ !== null; ) {
          if (w = $o(_), w === null) return;
          if (N = w.tag, N === 5 || N === 6) {
            a = d = w;
            continue e;
          }
          _ = _.parentNode;
        }
      }
      a = a.return;
    }
    Zt(function() {
      var H = d, U = Xt(s), K = [];
      e: {
        var W = uh.get(t);
        if (W !== void 0) {
          var pe = Rc, ge = t;
          switch (t) {
            case "keypress":
              if (Cl(s) === 0) break e;
            case "keydown":
            case "keyup":
              pe = q1;
              break;
            case "focusin":
              ge = "focus", pe = Tc;
              break;
            case "focusout":
              ge = "blur", pe = Tc;
              break;
            case "beforeblur":
            case "afterblur":
              pe = Tc;
              break;
            case "click":
              if (s.button === 2) break e;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              pe = Hp;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              pe = I1;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              pe = G1;
              break;
            case sh:
            case lh:
            case ah:
              pe = O1;
              break;
            case ch:
              pe = K1;
              break;
            case "scroll":
              pe = T1;
              break;
            case "wheel":
              pe = Z1;
              break;
            case "copy":
            case "cut":
            case "paste":
              pe = L1;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              pe = jp;
          }
          var ve = (r & 4) !== 0, Ct = !ve && t === "scroll", L = ve ? W !== null ? W + "Capture" : null : W;
          ve = [];
          for (var F = H, B; F !== null; ) {
            B = F;
            var ne = B.stateNode;
            if (B.tag === 5 && ne !== null && (B = ne, L !== null && (ne = Nt(F, L), ne != null && ve.push(ps(F, ne, B)))), Ct) break;
            F = F.return;
          }
          0 < ve.length && (W = new pe(W, ge, null, s, U), K.push({ event: W, listeners: ve }));
        }
      }
      if ((r & 7) === 0) {
        e: {
          if (W = t === "mouseover" || t === "pointerover", pe = t === "mouseout" || t === "pointerout", W && s !== gt && (ge = s.relatedTarget || s.fromElement) && ($o(ge) || ge[zr])) break e;
          if ((pe || W) && (W = U.window === U ? U : (W = U.ownerDocument) ? W.defaultView || W.parentWindow : window, pe ? (ge = s.relatedTarget || s.toElement, pe = H, ge = ge ? $o(ge) : null, ge !== null && (Ct = yt(ge), ge !== Ct || ge.tag !== 5 && ge.tag !== 6) && (ge = null)) : (pe = null, ge = H), pe !== ge)) {
            if (ve = Hp, ne = "onMouseLeave", L = "onMouseEnter", F = "mouse", (t === "pointerout" || t === "pointerover") && (ve = jp, ne = "onPointerLeave", L = "onPointerEnter", F = "pointer"), Ct = pe == null ? W : ci(pe), B = ge == null ? W : ci(ge), W = new ve(ne, F + "leave", pe, s, U), W.target = Ct, W.relatedTarget = B, ne = null, $o(U) === H && (ve = new ve(L, F + "enter", ge, s, U), ve.target = B, ve.relatedTarget = Ct, ne = ve), Ct = ne, pe && ge) t: {
              for (ve = pe, L = ge, F = 0, B = ve; B; B = li(B)) F++;
              for (B = 0, ne = L; ne; ne = li(ne)) B++;
              for (; 0 < F - B; ) ve = li(ve), F--;
              for (; 0 < B - F; ) L = li(L), B--;
              for (; F--; ) {
                if (ve === L || L !== null && ve === L.alternate) break t;
                ve = li(ve), L = li(L);
              }
              ve = null;
            }
            else ve = null;
            pe !== null && mh(K, W, pe, ve, !1), ge !== null && Ct !== null && mh(K, Ct, ge, ve, !0);
          }
        }
        e: {
          if (W = H ? ci(H) : window, pe = W.nodeName && W.nodeName.toLowerCase(), pe === "select" || pe === "input" && W.type === "file") var Se = iS;
          else if (Gp(W)) if (Kp) Se = cS;
          else {
            Se = lS;
            var Ce = sS;
          }
          else (pe = W.nodeName) && pe.toLowerCase() === "input" && (W.type === "checkbox" || W.type === "radio") && (Se = aS);
          if (Se && (Se = Se(t, H))) {
            Yp(K, Se, s, U);
            break e;
          }
          Ce && Ce(t, W, H), t === "focusout" && (Ce = W._wrapperState) && Ce.controlled && W.type === "number" && xt(W, "number", W.value);
        }
        switch (Ce = H ? ci(H) : window, t) {
          case "focusin":
            (Gp(Ce) || Ce.contentEditable === "true") && (ii = Ce, Ac = H, us = null);
            break;
          case "focusout":
            us = Ac = ii = null;
            break;
          case "mousedown":
            Lc = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            Lc = !1, oh(K, s, U);
            break;
          case "selectionchange":
            if (dS) break;
          case "keydown":
          case "keyup":
            oh(K, s, U);
        }
        var be;
        if (Ic) e: {
          switch (t) {
            case "compositionstart":
              var Pe = "onCompositionStart";
              break e;
            case "compositionend":
              Pe = "onCompositionEnd";
              break e;
            case "compositionupdate":
              Pe = "onCompositionUpdate";
              break e;
          }
          Pe = void 0;
        }
        else oi ? Up(t, s) && (Pe = "onCompositionEnd") : t === "keydown" && s.keyCode === 229 && (Pe = "onCompositionStart");
        Pe && (Vp && s.locale !== "ko" && (oi || Pe !== "onCompositionStart" ? Pe === "onCompositionEnd" && oi && (be = Lp()) : (to = U, Pc = "value" in to ? to.value : to.textContent, oi = !0)), Ce = kl(H, Pe), 0 < Ce.length && (Pe = new Dp(Pe, t, null, s, U), K.push({ event: Pe, listeners: Ce }), be ? Pe.data = be : (be = Xp(s), be !== null && (Pe.data = be)))), (be = eS ? tS(t, s) : nS(t, s)) && (H = kl(H, "onBeforeInput"), 0 < H.length && (U = new Dp("onBeforeInput", "beforeinput", null, s, U), K.push({ event: U, listeners: H }), U.data = be));
      }
      ph(K, r);
    });
  }
  function ps(t, r, s) {
    return { instance: t, listener: r, currentTarget: s };
  }
  function kl(t, r) {
    for (var s = r + "Capture", a = []; t !== null; ) {
      var u = t, d = u.stateNode;
      u.tag === 5 && d !== null && (u = d, d = Nt(t, s), d != null && a.unshift(ps(t, d, u)), d = Nt(t, r), d != null && a.push(ps(t, d, u))), t = t.return;
    }
    return a;
  }
  function li(t) {
    if (t === null) return null;
    do
      t = t.return;
    while (t && t.tag !== 5);
    return t || null;
  }
  function mh(t, r, s, a, u) {
    for (var d = r._reactName, w = []; s !== null && s !== a; ) {
      var _ = s, N = _.alternate, H = _.stateNode;
      if (N !== null && N === a) break;
      _.tag === 5 && H !== null && (_ = H, u ? (N = Nt(s, d), N != null && w.unshift(ps(s, N, _))) : u || (N = Nt(s, d), N != null && w.push(ps(s, N, _)))), s = s.return;
    }
    w.length !== 0 && t.push({ event: r, listeners: w });
  }
  var gS = /\r\n?/g, yS = /\u0000|\uFFFD/g;
  function gh(t) {
    return (typeof t == "string" ? t : "" + t).replace(gS, `
`).replace(yS, "");
  }
  function Ml(t, r, s) {
    if (r = gh(r), gh(t) !== r && s) throw Error(o(425));
  }
  function Tl() {
  }
  var Wc = null, qc = null;
  function Uc(t, r) {
    return t === "textarea" || t === "noscript" || typeof r.children == "string" || typeof r.children == "number" || typeof r.dangerouslySetInnerHTML == "object" && r.dangerouslySetInnerHTML !== null && r.dangerouslySetInnerHTML.__html != null;
  }
  var Xc = typeof setTimeout == "function" ? setTimeout : void 0, vS = typeof clearTimeout == "function" ? clearTimeout : void 0, yh = typeof Promise == "function" ? Promise : void 0, SS = typeof queueMicrotask == "function" ? queueMicrotask : typeof yh < "u" ? function(t) {
    return yh.resolve(null).then(t).catch(wS);
  } : Xc;
  function wS(t) {
    setTimeout(function() {
      throw t;
    });
  }
  function Gc(t, r) {
    var s = r, a = 0;
    do {
      var u = s.nextSibling;
      if (t.removeChild(s), u && u.nodeType === 8) if (s = u.data, s === "/$") {
        if (a === 0) {
          t.removeChild(u), rs(r);
          return;
        }
        a--;
      } else s !== "$" && s !== "$?" && s !== "$!" || a++;
      s = u;
    } while (s);
    rs(r);
  }
  function ro(t) {
    for (; t != null; t = t.nextSibling) {
      var r = t.nodeType;
      if (r === 1 || r === 3) break;
      if (r === 8) {
        if (r = t.data, r === "$" || r === "$!" || r === "$?") break;
        if (r === "/$") return null;
      }
    }
    return t;
  }
  function vh(t) {
    t = t.previousSibling;
    for (var r = 0; t; ) {
      if (t.nodeType === 8) {
        var s = t.data;
        if (s === "$" || s === "$!" || s === "$?") {
          if (r === 0) return t;
          r--;
        } else s === "/$" && r++;
      }
      t = t.previousSibling;
    }
    return null;
  }
  var ai = Math.random().toString(36).slice(2), Cr = "__reactFiber$" + ai, hs = "__reactProps$" + ai, zr = "__reactContainer$" + ai, Yc = "__reactEvents$" + ai, xS = "__reactListeners$" + ai, CS = "__reactHandles$" + ai;
  function $o(t) {
    var r = t[Cr];
    if (r) return r;
    for (var s = t.parentNode; s; ) {
      if (r = s[zr] || s[Cr]) {
        if (s = r.alternate, r.child !== null || s !== null && s.child !== null) for (t = vh(t); t !== null; ) {
          if (s = t[Cr]) return s;
          t = vh(t);
        }
        return r;
      }
      t = s, s = t.parentNode;
    }
    return null;
  }
  function ms(t) {
    return t = t[Cr] || t[zr], !t || t.tag !== 5 && t.tag !== 6 && t.tag !== 13 && t.tag !== 3 ? null : t;
  }
  function ci(t) {
    if (t.tag === 5 || t.tag === 6) return t.stateNode;
    throw Error(o(33));
  }
  function Nl(t) {
    return t[hs] || null;
  }
  var Kc = [], ui = -1;
  function oo(t) {
    return { current: t };
  }
  function st(t) {
    0 > ui || (t.current = Kc[ui], Kc[ui] = null, ui--);
  }
  function ot(t, r) {
    ui++, Kc[ui] = t.current, t.current = r;
  }
  var io = {}, nn = oo(io), yn = oo(!1), _o = io;
  function fi(t, r) {
    var s = t.type.contextTypes;
    if (!s) return io;
    var a = t.stateNode;
    if (a && a.__reactInternalMemoizedUnmaskedChildContext === r) return a.__reactInternalMemoizedMaskedChildContext;
    var u = {}, d;
    for (d in s) u[d] = r[d];
    return a && (t = t.stateNode, t.__reactInternalMemoizedUnmaskedChildContext = r, t.__reactInternalMemoizedMaskedChildContext = u), u;
  }
  function vn(t) {
    return t = t.childContextTypes, t != null;
  }
  function Il() {
    st(yn), st(nn);
  }
  function Sh(t, r, s) {
    if (nn.current !== io) throw Error(o(168));
    ot(nn, r), ot(yn, s);
  }
  function wh(t, r, s) {
    var a = t.stateNode;
    if (r = r.childContextTypes, typeof a.getChildContext != "function") return s;
    a = a.getChildContext();
    for (var u in a) if (!(u in r)) throw Error(o(108, fe(t) || "Unknown", u));
    return q({}, s, a);
  }
  function Fl(t) {
    return t = (t = t.stateNode) && t.__reactInternalMemoizedMergedChildContext || io, _o = nn.current, ot(nn, t), ot(yn, yn.current), !0;
  }
  function xh(t, r, s) {
    var a = t.stateNode;
    if (!a) throw Error(o(169));
    s ? (t = wh(t, r, _o), a.__reactInternalMemoizedMergedChildContext = t, st(yn), st(nn), ot(nn, t)) : st(yn), ot(yn, s);
  }
  var Or = null, zl = !1, Qc = !1;
  function Ch(t) {
    Or === null ? Or = [t] : Or.push(t);
  }
  function bS(t) {
    zl = !0, Ch(t);
  }
  function so() {
    if (!Qc && Or !== null) {
      Qc = !0;
      var t = 0, r = He;
      try {
        var s = Or;
        for (He = 1; t < s.length; t++) {
          var a = s[t];
          do
            a = a(!0);
          while (a !== null);
        }
        Or = null, zl = !1;
      } catch (u) {
        throw Or !== null && (Or = Or.slice(t + 1)), Sr(Hn, so), u;
      } finally {
        He = r, Qc = !1;
      }
    }
    return null;
  }
  var di = [], pi = 0, Ol = null, Al = 0, jn = [], Vn = 0, Po = null, Ar = 1, Lr = "";
  function Ro(t, r) {
    di[pi++] = Al, di[pi++] = Ol, Ol = t, Al = r;
  }
  function bh(t, r, s) {
    jn[Vn++] = Ar, jn[Vn++] = Lr, jn[Vn++] = Po, Po = t;
    var a = Ar;
    t = Lr;
    var u = 32 - et(a) - 1;
    a &= ~(1 << u), s += 1;
    var d = 32 - et(r) + u;
    if (30 < d) {
      var w = u - u % 5;
      d = (a & (1 << w) - 1).toString(32), a >>= w, u -= w, Ar = 1 << 32 - et(r) + u | s << u | a, Lr = d + t;
    } else Ar = 1 << d | s << u | a, Lr = t;
  }
  function Zc(t) {
    t.return !== null && (Ro(t, 1), bh(t, 1, 0));
  }
  function Jc(t) {
    for (; t === Ol; ) Ol = di[--pi], di[pi] = null, Al = di[--pi], di[pi] = null;
    for (; t === Po; ) Po = jn[--Vn], jn[Vn] = null, Lr = jn[--Vn], jn[Vn] = null, Ar = jn[--Vn], jn[Vn] = null;
  }
  var kn = null, Mn = null, ct = !1, lr = null;
  function Eh(t, r) {
    var s = Xn(5, null, null, 0);
    s.elementType = "DELETED", s.stateNode = r, s.return = t, r = t.deletions, r === null ? (t.deletions = [s], t.flags |= 16) : r.push(s);
  }
  function $h(t, r) {
    switch (t.tag) {
      case 5:
        var s = t.type;
        return r = r.nodeType !== 1 || s.toLowerCase() !== r.nodeName.toLowerCase() ? null : r, r !== null ? (t.stateNode = r, kn = t, Mn = ro(r.firstChild), !0) : !1;
      case 6:
        return r = t.pendingProps === "" || r.nodeType !== 3 ? null : r, r !== null ? (t.stateNode = r, kn = t, Mn = null, !0) : !1;
      case 13:
        return r = r.nodeType !== 8 ? null : r, r !== null ? (s = Po !== null ? { id: Ar, overflow: Lr } : null, t.memoizedState = { dehydrated: r, treeContext: s, retryLane: 1073741824 }, s = Xn(18, null, null, 0), s.stateNode = r, s.return = t, t.child = s, kn = t, Mn = null, !0) : !1;
      default:
        return !1;
    }
  }
  function eu(t) {
    return (t.mode & 1) !== 0 && (t.flags & 128) === 0;
  }
  function tu(t) {
    if (ct) {
      var r = Mn;
      if (r) {
        var s = r;
        if (!$h(t, r)) {
          if (eu(t)) throw Error(o(418));
          r = ro(s.nextSibling);
          var a = kn;
          r && $h(t, r) ? Eh(a, s) : (t.flags = t.flags & -4097 | 2, ct = !1, kn = t);
        }
      } else {
        if (eu(t)) throw Error(o(418));
        t.flags = t.flags & -4097 | 2, ct = !1, kn = t;
      }
    }
  }
  function _h(t) {
    for (t = t.return; t !== null && t.tag !== 5 && t.tag !== 3 && t.tag !== 13; ) t = t.return;
    kn = t;
  }
  function Ll(t) {
    if (t !== kn) return !1;
    if (!ct) return _h(t), ct = !0, !1;
    var r;
    if ((r = t.tag !== 3) && !(r = t.tag !== 5) && (r = t.type, r = r !== "head" && r !== "body" && !Uc(t.type, t.memoizedProps)), r && (r = Mn)) {
      if (eu(t)) throw Ph(), Error(o(418));
      for (; r; ) Eh(t, r), r = ro(r.nextSibling);
    }
    if (_h(t), t.tag === 13) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
      e: {
        for (t = t.nextSibling, r = 0; t; ) {
          if (t.nodeType === 8) {
            var s = t.data;
            if (s === "/$") {
              if (r === 0) {
                Mn = ro(t.nextSibling);
                break e;
              }
              r--;
            } else s !== "$" && s !== "$!" && s !== "$?" || r++;
          }
          t = t.nextSibling;
        }
        Mn = null;
      }
    } else Mn = kn ? ro(t.stateNode.nextSibling) : null;
    return !0;
  }
  function Ph() {
    for (var t = Mn; t; ) t = ro(t.nextSibling);
  }
  function hi() {
    Mn = kn = null, ct = !1;
  }
  function nu(t) {
    lr === null ? lr = [t] : lr.push(t);
  }
  var ES = R.ReactCurrentBatchConfig;
  function gs(t, r, s) {
    if (t = s.ref, t !== null && typeof t != "function" && typeof t != "object") {
      if (s._owner) {
        if (s = s._owner, s) {
          if (s.tag !== 1) throw Error(o(309));
          var a = s.stateNode;
        }
        if (!a) throw Error(o(147, t));
        var u = a, d = "" + t;
        return r !== null && r.ref !== null && typeof r.ref == "function" && r.ref._stringRef === d ? r.ref : (r = function(w) {
          var _ = u.refs;
          w === null ? delete _[d] : _[d] = w;
        }, r._stringRef = d, r);
      }
      if (typeof t != "string") throw Error(o(284));
      if (!s._owner) throw Error(o(290, t));
    }
    return t;
  }
  function Bl(t, r) {
    throw t = Object.prototype.toString.call(r), Error(o(31, t === "[object Object]" ? "object with keys {" + Object.keys(r).join(", ") + "}" : t));
  }
  function Rh(t) {
    var r = t._init;
    return r(t._payload);
  }
  function kh(t) {
    function r(L, F) {
      if (t) {
        var B = L.deletions;
        B === null ? (L.deletions = [F], L.flags |= 16) : B.push(F);
      }
    }
    function s(L, F) {
      if (!t) return null;
      for (; F !== null; ) r(L, F), F = F.sibling;
      return null;
    }
    function a(L, F) {
      for (L = /* @__PURE__ */ new Map(); F !== null; ) F.key !== null ? L.set(F.key, F) : L.set(F.index, F), F = F.sibling;
      return L;
    }
    function u(L, F) {
      return L = mo(L, F), L.index = 0, L.sibling = null, L;
    }
    function d(L, F, B) {
      return L.index = B, t ? (B = L.alternate, B !== null ? (B = B.index, B < F ? (L.flags |= 2, F) : B) : (L.flags |= 2, F)) : (L.flags |= 1048576, F);
    }
    function w(L) {
      return t && L.alternate === null && (L.flags |= 2), L;
    }
    function _(L, F, B, ne) {
      return F === null || F.tag !== 6 ? (F = Xu(B, L.mode, ne), F.return = L, F) : (F = u(F, B), F.return = L, F);
    }
    function N(L, F, B, ne) {
      var Se = B.type;
      return Se === z ? U(L, F, B.props.children, ne, B.key) : F !== null && (F.elementType === Se || typeof Se == "object" && Se !== null && Se.$$typeof === le && Rh(Se) === F.type) ? (ne = u(F, B.props), ne.ref = gs(L, F, B), ne.return = L, ne) : (ne = ca(B.type, B.key, B.props, null, L.mode, ne), ne.ref = gs(L, F, B), ne.return = L, ne);
    }
    function H(L, F, B, ne) {
      return F === null || F.tag !== 4 || F.stateNode.containerInfo !== B.containerInfo || F.stateNode.implementation !== B.implementation ? (F = Gu(B, L.mode, ne), F.return = L, F) : (F = u(F, B.children || []), F.return = L, F);
    }
    function U(L, F, B, ne, Se) {
      return F === null || F.tag !== 7 ? (F = Oo(B, L.mode, ne, Se), F.return = L, F) : (F = u(F, B), F.return = L, F);
    }
    function K(L, F, B) {
      if (typeof F == "string" && F !== "" || typeof F == "number") return F = Xu("" + F, L.mode, B), F.return = L, F;
      if (typeof F == "object" && F !== null) {
        switch (F.$$typeof) {
          case M:
            return B = ca(F.type, F.key, F.props, null, L.mode, B), B.ref = gs(L, null, F), B.return = L, B;
          case I:
            return F = Gu(F, L.mode, B), F.return = L, F;
          case le:
            var ne = F._init;
            return K(L, ne(F._payload), B);
        }
        if (Ze(F) || J(F)) return F = Oo(F, L.mode, B, null), F.return = L, F;
        Bl(L, F);
      }
      return null;
    }
    function W(L, F, B, ne) {
      var Se = F !== null ? F.key : null;
      if (typeof B == "string" && B !== "" || typeof B == "number") return Se !== null ? null : _(L, F, "" + B, ne);
      if (typeof B == "object" && B !== null) {
        switch (B.$$typeof) {
          case M:
            return B.key === Se ? N(L, F, B, ne) : null;
          case I:
            return B.key === Se ? H(L, F, B, ne) : null;
          case le:
            return Se = B._init, W(
              L,
              F,
              Se(B._payload),
              ne
            );
        }
        if (Ze(B) || J(B)) return Se !== null ? null : U(L, F, B, ne, null);
        Bl(L, B);
      }
      return null;
    }
    function pe(L, F, B, ne, Se) {
      if (typeof ne == "string" && ne !== "" || typeof ne == "number") return L = L.get(B) || null, _(F, L, "" + ne, Se);
      if (typeof ne == "object" && ne !== null) {
        switch (ne.$$typeof) {
          case M:
            return L = L.get(ne.key === null ? B : ne.key) || null, N(F, L, ne, Se);
          case I:
            return L = L.get(ne.key === null ? B : ne.key) || null, H(F, L, ne, Se);
          case le:
            var Ce = ne._init;
            return pe(L, F, B, Ce(ne._payload), Se);
        }
        if (Ze(ne) || J(ne)) return L = L.get(B) || null, U(F, L, ne, Se, null);
        Bl(F, ne);
      }
      return null;
    }
    function ge(L, F, B, ne) {
      for (var Se = null, Ce = null, be = F, Pe = F = 0, jt = null; be !== null && Pe < B.length; Pe++) {
        be.index > Pe ? (jt = be, be = null) : jt = be.sibling;
        var De = W(L, be, B[Pe], ne);
        if (De === null) {
          be === null && (be = jt);
          break;
        }
        t && be && De.alternate === null && r(L, be), F = d(De, F, Pe), Ce === null ? Se = De : Ce.sibling = De, Ce = De, be = jt;
      }
      if (Pe === B.length) return s(L, be), ct && Ro(L, Pe), Se;
      if (be === null) {
        for (; Pe < B.length; Pe++) be = K(L, B[Pe], ne), be !== null && (F = d(be, F, Pe), Ce === null ? Se = be : Ce.sibling = be, Ce = be);
        return ct && Ro(L, Pe), Se;
      }
      for (be = a(L, be); Pe < B.length; Pe++) jt = pe(be, L, Pe, B[Pe], ne), jt !== null && (t && jt.alternate !== null && be.delete(jt.key === null ? Pe : jt.key), F = d(jt, F, Pe), Ce === null ? Se = jt : Ce.sibling = jt, Ce = jt);
      return t && be.forEach(function(go) {
        return r(L, go);
      }), ct && Ro(L, Pe), Se;
    }
    function ve(L, F, B, ne) {
      var Se = J(B);
      if (typeof Se != "function") throw Error(o(150));
      if (B = Se.call(B), B == null) throw Error(o(151));
      for (var Ce = Se = null, be = F, Pe = F = 0, jt = null, De = B.next(); be !== null && !De.done; Pe++, De = B.next()) {
        be.index > Pe ? (jt = be, be = null) : jt = be.sibling;
        var go = W(L, be, De.value, ne);
        if (go === null) {
          be === null && (be = jt);
          break;
        }
        t && be && go.alternate === null && r(L, be), F = d(go, F, Pe), Ce === null ? Se = go : Ce.sibling = go, Ce = go, be = jt;
      }
      if (De.done) return s(
        L,
        be
      ), ct && Ro(L, Pe), Se;
      if (be === null) {
        for (; !De.done; Pe++, De = B.next()) De = K(L, De.value, ne), De !== null && (F = d(De, F, Pe), Ce === null ? Se = De : Ce.sibling = De, Ce = De);
        return ct && Ro(L, Pe), Se;
      }
      for (be = a(L, be); !De.done; Pe++, De = B.next()) De = pe(be, L, Pe, De.value, ne), De !== null && (t && De.alternate !== null && be.delete(De.key === null ? Pe : De.key), F = d(De, F, Pe), Ce === null ? Se = De : Ce.sibling = De, Ce = De);
      return t && be.forEach(function(rw) {
        return r(L, rw);
      }), ct && Ro(L, Pe), Se;
    }
    function Ct(L, F, B, ne) {
      if (typeof B == "object" && B !== null && B.type === z && B.key === null && (B = B.props.children), typeof B == "object" && B !== null) {
        switch (B.$$typeof) {
          case M:
            e: {
              for (var Se = B.key, Ce = F; Ce !== null; ) {
                if (Ce.key === Se) {
                  if (Se = B.type, Se === z) {
                    if (Ce.tag === 7) {
                      s(L, Ce.sibling), F = u(Ce, B.props.children), F.return = L, L = F;
                      break e;
                    }
                  } else if (Ce.elementType === Se || typeof Se == "object" && Se !== null && Se.$$typeof === le && Rh(Se) === Ce.type) {
                    s(L, Ce.sibling), F = u(Ce, B.props), F.ref = gs(L, Ce, B), F.return = L, L = F;
                    break e;
                  }
                  s(L, Ce);
                  break;
                } else r(L, Ce);
                Ce = Ce.sibling;
              }
              B.type === z ? (F = Oo(B.props.children, L.mode, ne, B.key), F.return = L, L = F) : (ne = ca(B.type, B.key, B.props, null, L.mode, ne), ne.ref = gs(L, F, B), ne.return = L, L = ne);
            }
            return w(L);
          case I:
            e: {
              for (Ce = B.key; F !== null; ) {
                if (F.key === Ce) if (F.tag === 4 && F.stateNode.containerInfo === B.containerInfo && F.stateNode.implementation === B.implementation) {
                  s(L, F.sibling), F = u(F, B.children || []), F.return = L, L = F;
                  break e;
                } else {
                  s(L, F);
                  break;
                }
                else r(L, F);
                F = F.sibling;
              }
              F = Gu(B, L.mode, ne), F.return = L, L = F;
            }
            return w(L);
          case le:
            return Ce = B._init, Ct(L, F, Ce(B._payload), ne);
        }
        if (Ze(B)) return ge(L, F, B, ne);
        if (J(B)) return ve(L, F, B, ne);
        Bl(L, B);
      }
      return typeof B == "string" && B !== "" || typeof B == "number" ? (B = "" + B, F !== null && F.tag === 6 ? (s(L, F.sibling), F = u(F, B), F.return = L, L = F) : (s(L, F), F = Xu(B, L.mode, ne), F.return = L, L = F), w(L)) : s(L, F);
    }
    return Ct;
  }
  var mi = kh(!0), Mh = kh(!1), Hl = oo(null), Dl = null, gi = null, ru = null;
  function ou() {
    ru = gi = Dl = null;
  }
  function iu(t) {
    var r = Hl.current;
    st(Hl), t._currentValue = r;
  }
  function su(t, r, s) {
    for (; t !== null; ) {
      var a = t.alternate;
      if ((t.childLanes & r) !== r ? (t.childLanes |= r, a !== null && (a.childLanes |= r)) : a !== null && (a.childLanes & r) !== r && (a.childLanes |= r), t === s) break;
      t = t.return;
    }
  }
  function yi(t, r) {
    Dl = t, ru = gi = null, t = t.dependencies, t !== null && t.firstContext !== null && ((t.lanes & r) !== 0 && (Sn = !0), t.firstContext = null);
  }
  function Wn(t) {
    var r = t._currentValue;
    if (ru !== t) if (t = { context: t, memoizedValue: r, next: null }, gi === null) {
      if (Dl === null) throw Error(o(308));
      gi = t, Dl.dependencies = { lanes: 0, firstContext: t };
    } else gi = gi.next = t;
    return r;
  }
  var ko = null;
  function lu(t) {
    ko === null ? ko = [t] : ko.push(t);
  }
  function Th(t, r, s, a) {
    var u = r.interleaved;
    return u === null ? (s.next = s, lu(r)) : (s.next = u.next, u.next = s), r.interleaved = s, Br(t, a);
  }
  function Br(t, r) {
    t.lanes |= r;
    var s = t.alternate;
    for (s !== null && (s.lanes |= r), s = t, t = t.return; t !== null; ) t.childLanes |= r, s = t.alternate, s !== null && (s.childLanes |= r), s = t, t = t.return;
    return s.tag === 3 ? s.stateNode : null;
  }
  var lo = !1;
  function au(t) {
    t.updateQueue = { baseState: t.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
  }
  function Nh(t, r) {
    t = t.updateQueue, r.updateQueue === t && (r.updateQueue = { baseState: t.baseState, firstBaseUpdate: t.firstBaseUpdate, lastBaseUpdate: t.lastBaseUpdate, shared: t.shared, effects: t.effects });
  }
  function Hr(t, r) {
    return { eventTime: t, lane: r, tag: 0, payload: null, callback: null, next: null };
  }
  function ao(t, r, s) {
    var a = t.updateQueue;
    if (a === null) return null;
    if (a = a.shared, (Le & 2) !== 0) {
      var u = a.pending;
      return u === null ? r.next = r : (r.next = u.next, u.next = r), a.pending = r, Br(t, s);
    }
    return u = a.interleaved, u === null ? (r.next = r, lu(a)) : (r.next = u.next, u.next = r), a.interleaved = r, Br(t, s);
  }
  function jl(t, r, s) {
    if (r = r.updateQueue, r !== null && (r = r.shared, (s & 4194240) !== 0)) {
      var a = r.lanes;
      a &= t.pendingLanes, s |= a, r.lanes = s, ti(t, s);
    }
  }
  function Ih(t, r) {
    var s = t.updateQueue, a = t.alternate;
    if (a !== null && (a = a.updateQueue, s === a)) {
      var u = null, d = null;
      if (s = s.firstBaseUpdate, s !== null) {
        do {
          var w = { eventTime: s.eventTime, lane: s.lane, tag: s.tag, payload: s.payload, callback: s.callback, next: null };
          d === null ? u = d = w : d = d.next = w, s = s.next;
        } while (s !== null);
        d === null ? u = d = r : d = d.next = r;
      } else u = d = r;
      s = { baseState: a.baseState, firstBaseUpdate: u, lastBaseUpdate: d, shared: a.shared, effects: a.effects }, t.updateQueue = s;
      return;
    }
    t = s.lastBaseUpdate, t === null ? s.firstBaseUpdate = r : t.next = r, s.lastBaseUpdate = r;
  }
  function Vl(t, r, s, a) {
    var u = t.updateQueue;
    lo = !1;
    var d = u.firstBaseUpdate, w = u.lastBaseUpdate, _ = u.shared.pending;
    if (_ !== null) {
      u.shared.pending = null;
      var N = _, H = N.next;
      N.next = null, w === null ? d = H : w.next = H, w = N;
      var U = t.alternate;
      U !== null && (U = U.updateQueue, _ = U.lastBaseUpdate, _ !== w && (_ === null ? U.firstBaseUpdate = H : _.next = H, U.lastBaseUpdate = N));
    }
    if (d !== null) {
      var K = u.baseState;
      w = 0, U = H = N = null, _ = d;
      do {
        var W = _.lane, pe = _.eventTime;
        if ((a & W) === W) {
          U !== null && (U = U.next = {
            eventTime: pe,
            lane: 0,
            tag: _.tag,
            payload: _.payload,
            callback: _.callback,
            next: null
          });
          e: {
            var ge = t, ve = _;
            switch (W = r, pe = s, ve.tag) {
              case 1:
                if (ge = ve.payload, typeof ge == "function") {
                  K = ge.call(pe, K, W);
                  break e;
                }
                K = ge;
                break e;
              case 3:
                ge.flags = ge.flags & -65537 | 128;
              case 0:
                if (ge = ve.payload, W = typeof ge == "function" ? ge.call(pe, K, W) : ge, W == null) break e;
                K = q({}, K, W);
                break e;
              case 2:
                lo = !0;
            }
          }
          _.callback !== null && _.lane !== 0 && (t.flags |= 64, W = u.effects, W === null ? u.effects = [_] : W.push(_));
        } else pe = { eventTime: pe, lane: W, tag: _.tag, payload: _.payload, callback: _.callback, next: null }, U === null ? (H = U = pe, N = K) : U = U.next = pe, w |= W;
        if (_ = _.next, _ === null) {
          if (_ = u.shared.pending, _ === null) break;
          W = _, _ = W.next, W.next = null, u.lastBaseUpdate = W, u.shared.pending = null;
        }
      } while (!0);
      if (U === null && (N = K), u.baseState = N, u.firstBaseUpdate = H, u.lastBaseUpdate = U, r = u.shared.interleaved, r !== null) {
        u = r;
        do
          w |= u.lane, u = u.next;
        while (u !== r);
      } else d === null && (u.shared.lanes = 0);
      No |= w, t.lanes = w, t.memoizedState = K;
    }
  }
  function Fh(t, r, s) {
    if (t = r.effects, r.effects = null, t !== null) for (r = 0; r < t.length; r++) {
      var a = t[r], u = a.callback;
      if (u !== null) {
        if (a.callback = null, a = s, typeof u != "function") throw Error(o(191, u));
        u.call(a);
      }
    }
  }
  var ys = {}, br = oo(ys), vs = oo(ys), Ss = oo(ys);
  function Mo(t) {
    if (t === ys) throw Error(o(174));
    return t;
  }
  function cu(t, r) {
    switch (ot(Ss, r), ot(vs, t), ot(br, ys), t = r.nodeType, t) {
      case 9:
      case 11:
        r = (r = r.documentElement) ? r.namespaceURI : qt(null, "");
        break;
      default:
        t = t === 8 ? r.parentNode : r, r = t.namespaceURI || null, t = t.tagName, r = qt(r, t);
    }
    st(br), ot(br, r);
  }
  function vi() {
    st(br), st(vs), st(Ss);
  }
  function zh(t) {
    Mo(Ss.current);
    var r = Mo(br.current), s = qt(r, t.type);
    r !== s && (ot(vs, t), ot(br, s));
  }
  function uu(t) {
    vs.current === t && (st(br), st(vs));
  }
  var pt = oo(0);
  function Wl(t) {
    for (var r = t; r !== null; ) {
      if (r.tag === 13) {
        var s = r.memoizedState;
        if (s !== null && (s = s.dehydrated, s === null || s.data === "$?" || s.data === "$!")) return r;
      } else if (r.tag === 19 && r.memoizedProps.revealOrder !== void 0) {
        if ((r.flags & 128) !== 0) return r;
      } else if (r.child !== null) {
        r.child.return = r, r = r.child;
        continue;
      }
      if (r === t) break;
      for (; r.sibling === null; ) {
        if (r.return === null || r.return === t) return null;
        r = r.return;
      }
      r.sibling.return = r.return, r = r.sibling;
    }
    return null;
  }
  var fu = [];
  function du() {
    for (var t = 0; t < fu.length; t++) fu[t]._workInProgressVersionPrimary = null;
    fu.length = 0;
  }
  var ql = R.ReactCurrentDispatcher, pu = R.ReactCurrentBatchConfig, To = 0, ht = null, Ft = null, Ht = null, Ul = !1, ws = !1, xs = 0, $S = 0;
  function rn() {
    throw Error(o(321));
  }
  function hu(t, r) {
    if (r === null) return !1;
    for (var s = 0; s < r.length && s < t.length; s++) if (!sr(t[s], r[s])) return !1;
    return !0;
  }
  function mu(t, r, s, a, u, d) {
    if (To = d, ht = r, r.memoizedState = null, r.updateQueue = null, r.lanes = 0, ql.current = t === null || t.memoizedState === null ? kS : MS, t = s(a, u), ws) {
      d = 0;
      do {
        if (ws = !1, xs = 0, 25 <= d) throw Error(o(301));
        d += 1, Ht = Ft = null, r.updateQueue = null, ql.current = TS, t = s(a, u);
      } while (ws);
    }
    if (ql.current = Yl, r = Ft !== null && Ft.next !== null, To = 0, Ht = Ft = ht = null, Ul = !1, r) throw Error(o(300));
    return t;
  }
  function gu() {
    var t = xs !== 0;
    return xs = 0, t;
  }
  function Er() {
    var t = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
    return Ht === null ? ht.memoizedState = Ht = t : Ht = Ht.next = t, Ht;
  }
  function qn() {
    if (Ft === null) {
      var t = ht.alternate;
      t = t !== null ? t.memoizedState : null;
    } else t = Ft.next;
    var r = Ht === null ? ht.memoizedState : Ht.next;
    if (r !== null) Ht = r, Ft = t;
    else {
      if (t === null) throw Error(o(310));
      Ft = t, t = { memoizedState: Ft.memoizedState, baseState: Ft.baseState, baseQueue: Ft.baseQueue, queue: Ft.queue, next: null }, Ht === null ? ht.memoizedState = Ht = t : Ht = Ht.next = t;
    }
    return Ht;
  }
  function Cs(t, r) {
    return typeof r == "function" ? r(t) : r;
  }
  function yu(t) {
    var r = qn(), s = r.queue;
    if (s === null) throw Error(o(311));
    s.lastRenderedReducer = t;
    var a = Ft, u = a.baseQueue, d = s.pending;
    if (d !== null) {
      if (u !== null) {
        var w = u.next;
        u.next = d.next, d.next = w;
      }
      a.baseQueue = u = d, s.pending = null;
    }
    if (u !== null) {
      d = u.next, a = a.baseState;
      var _ = w = null, N = null, H = d;
      do {
        var U = H.lane;
        if ((To & U) === U) N !== null && (N = N.next = { lane: 0, action: H.action, hasEagerState: H.hasEagerState, eagerState: H.eagerState, next: null }), a = H.hasEagerState ? H.eagerState : t(a, H.action);
        else {
          var K = {
            lane: U,
            action: H.action,
            hasEagerState: H.hasEagerState,
            eagerState: H.eagerState,
            next: null
          };
          N === null ? (_ = N = K, w = a) : N = N.next = K, ht.lanes |= U, No |= U;
        }
        H = H.next;
      } while (H !== null && H !== d);
      N === null ? w = a : N.next = _, sr(a, r.memoizedState) || (Sn = !0), r.memoizedState = a, r.baseState = w, r.baseQueue = N, s.lastRenderedState = a;
    }
    if (t = s.interleaved, t !== null) {
      u = t;
      do
        d = u.lane, ht.lanes |= d, No |= d, u = u.next;
      while (u !== t);
    } else u === null && (s.lanes = 0);
    return [r.memoizedState, s.dispatch];
  }
  function vu(t) {
    var r = qn(), s = r.queue;
    if (s === null) throw Error(o(311));
    s.lastRenderedReducer = t;
    var a = s.dispatch, u = s.pending, d = r.memoizedState;
    if (u !== null) {
      s.pending = null;
      var w = u = u.next;
      do
        d = t(d, w.action), w = w.next;
      while (w !== u);
      sr(d, r.memoizedState) || (Sn = !0), r.memoizedState = d, r.baseQueue === null && (r.baseState = d), s.lastRenderedState = d;
    }
    return [d, a];
  }
  function Oh() {
  }
  function Ah(t, r) {
    var s = ht, a = qn(), u = r(), d = !sr(a.memoizedState, u);
    if (d && (a.memoizedState = u, Sn = !0), a = a.queue, Su(Hh.bind(null, s, a, t), [t]), a.getSnapshot !== r || d || Ht !== null && Ht.memoizedState.tag & 1) {
      if (s.flags |= 2048, bs(9, Bh.bind(null, s, a, u, r), void 0, null), Dt === null) throw Error(o(349));
      (To & 30) !== 0 || Lh(s, r, u);
    }
    return u;
  }
  function Lh(t, r, s) {
    t.flags |= 16384, t = { getSnapshot: r, value: s }, r = ht.updateQueue, r === null ? (r = { lastEffect: null, stores: null }, ht.updateQueue = r, r.stores = [t]) : (s = r.stores, s === null ? r.stores = [t] : s.push(t));
  }
  function Bh(t, r, s, a) {
    r.value = s, r.getSnapshot = a, Dh(r) && jh(t);
  }
  function Hh(t, r, s) {
    return s(function() {
      Dh(r) && jh(t);
    });
  }
  function Dh(t) {
    var r = t.getSnapshot;
    t = t.value;
    try {
      var s = r();
      return !sr(t, s);
    } catch {
      return !0;
    }
  }
  function jh(t) {
    var r = Br(t, 1);
    r !== null && fr(r, t, 1, -1);
  }
  function Vh(t) {
    var r = Er();
    return typeof t == "function" && (t = t()), r.memoizedState = r.baseState = t, t = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: Cs, lastRenderedState: t }, r.queue = t, t = t.dispatch = RS.bind(null, ht, t), [r.memoizedState, t];
  }
  function bs(t, r, s, a) {
    return t = { tag: t, create: r, destroy: s, deps: a, next: null }, r = ht.updateQueue, r === null ? (r = { lastEffect: null, stores: null }, ht.updateQueue = r, r.lastEffect = t.next = t) : (s = r.lastEffect, s === null ? r.lastEffect = t.next = t : (a = s.next, s.next = t, t.next = a, r.lastEffect = t)), t;
  }
  function Wh() {
    return qn().memoizedState;
  }
  function Xl(t, r, s, a) {
    var u = Er();
    ht.flags |= t, u.memoizedState = bs(1 | r, s, void 0, a === void 0 ? null : a);
  }
  function Gl(t, r, s, a) {
    var u = qn();
    a = a === void 0 ? null : a;
    var d = void 0;
    if (Ft !== null) {
      var w = Ft.memoizedState;
      if (d = w.destroy, a !== null && hu(a, w.deps)) {
        u.memoizedState = bs(r, s, d, a);
        return;
      }
    }
    ht.flags |= t, u.memoizedState = bs(1 | r, s, d, a);
  }
  function qh(t, r) {
    return Xl(8390656, 8, t, r);
  }
  function Su(t, r) {
    return Gl(2048, 8, t, r);
  }
  function Uh(t, r) {
    return Gl(4, 2, t, r);
  }
  function Xh(t, r) {
    return Gl(4, 4, t, r);
  }
  function Gh(t, r) {
    if (typeof r == "function") return t = t(), r(t), function() {
      r(null);
    };
    if (r != null) return t = t(), r.current = t, function() {
      r.current = null;
    };
  }
  function Yh(t, r, s) {
    return s = s != null ? s.concat([t]) : null, Gl(4, 4, Gh.bind(null, r, t), s);
  }
  function wu() {
  }
  function Kh(t, r) {
    var s = qn();
    r = r === void 0 ? null : r;
    var a = s.memoizedState;
    return a !== null && r !== null && hu(r, a[1]) ? a[0] : (s.memoizedState = [t, r], t);
  }
  function Qh(t, r) {
    var s = qn();
    r = r === void 0 ? null : r;
    var a = s.memoizedState;
    return a !== null && r !== null && hu(r, a[1]) ? a[0] : (t = t(), s.memoizedState = [t, r], t);
  }
  function Zh(t, r, s) {
    return (To & 21) === 0 ? (t.baseState && (t.baseState = !1, Sn = !0), t.memoizedState = s) : (sr(s, r) || (s = ue(), ht.lanes |= s, No |= s, t.baseState = !0), r);
  }
  function _S(t, r) {
    var s = He;
    He = s !== 0 && 4 > s ? s : 4, t(!0);
    var a = pu.transition;
    pu.transition = {};
    try {
      t(!1), r();
    } finally {
      He = s, pu.transition = a;
    }
  }
  function Jh() {
    return qn().memoizedState;
  }
  function PS(t, r, s) {
    var a = po(t);
    if (s = { lane: a, action: s, hasEagerState: !1, eagerState: null, next: null }, em(t)) tm(r, s);
    else if (s = Th(t, r, s, a), s !== null) {
      var u = un();
      fr(s, t, a, u), nm(s, r, a);
    }
  }
  function RS(t, r, s) {
    var a = po(t), u = { lane: a, action: s, hasEagerState: !1, eagerState: null, next: null };
    if (em(t)) tm(r, u);
    else {
      var d = t.alternate;
      if (t.lanes === 0 && (d === null || d.lanes === 0) && (d = r.lastRenderedReducer, d !== null)) try {
        var w = r.lastRenderedState, _ = d(w, s);
        if (u.hasEagerState = !0, u.eagerState = _, sr(_, w)) {
          var N = r.interleaved;
          N === null ? (u.next = u, lu(r)) : (u.next = N.next, N.next = u), r.interleaved = u;
          return;
        }
      } catch {
      }
      s = Th(t, r, u, a), s !== null && (u = un(), fr(s, t, a, u), nm(s, r, a));
    }
  }
  function em(t) {
    var r = t.alternate;
    return t === ht || r !== null && r === ht;
  }
  function tm(t, r) {
    ws = Ul = !0;
    var s = t.pending;
    s === null ? r.next = r : (r.next = s.next, s.next = r), t.pending = r;
  }
  function nm(t, r, s) {
    if ((s & 4194240) !== 0) {
      var a = r.lanes;
      a &= t.pendingLanes, s |= a, r.lanes = s, ti(t, s);
    }
  }
  var Yl = { readContext: Wn, useCallback: rn, useContext: rn, useEffect: rn, useImperativeHandle: rn, useInsertionEffect: rn, useLayoutEffect: rn, useMemo: rn, useReducer: rn, useRef: rn, useState: rn, useDebugValue: rn, useDeferredValue: rn, useTransition: rn, useMutableSource: rn, useSyncExternalStore: rn, useId: rn, unstable_isNewReconciler: !1 }, kS = { readContext: Wn, useCallback: function(t, r) {
    return Er().memoizedState = [t, r === void 0 ? null : r], t;
  }, useContext: Wn, useEffect: qh, useImperativeHandle: function(t, r, s) {
    return s = s != null ? s.concat([t]) : null, Xl(
      4194308,
      4,
      Gh.bind(null, r, t),
      s
    );
  }, useLayoutEffect: function(t, r) {
    return Xl(4194308, 4, t, r);
  }, useInsertionEffect: function(t, r) {
    return Xl(4, 2, t, r);
  }, useMemo: function(t, r) {
    var s = Er();
    return r = r === void 0 ? null : r, t = t(), s.memoizedState = [t, r], t;
  }, useReducer: function(t, r, s) {
    var a = Er();
    return r = s !== void 0 ? s(r) : r, a.memoizedState = a.baseState = r, t = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: t, lastRenderedState: r }, a.queue = t, t = t.dispatch = PS.bind(null, ht, t), [a.memoizedState, t];
  }, useRef: function(t) {
    var r = Er();
    return t = { current: t }, r.memoizedState = t;
  }, useState: Vh, useDebugValue: wu, useDeferredValue: function(t) {
    return Er().memoizedState = t;
  }, useTransition: function() {
    var t = Vh(!1), r = t[0];
    return t = _S.bind(null, t[1]), Er().memoizedState = t, [r, t];
  }, useMutableSource: function() {
  }, useSyncExternalStore: function(t, r, s) {
    var a = ht, u = Er();
    if (ct) {
      if (s === void 0) throw Error(o(407));
      s = s();
    } else {
      if (s = r(), Dt === null) throw Error(o(349));
      (To & 30) !== 0 || Lh(a, r, s);
    }
    u.memoizedState = s;
    var d = { value: s, getSnapshot: r };
    return u.queue = d, qh(Hh.bind(
      null,
      a,
      d,
      t
    ), [t]), a.flags |= 2048, bs(9, Bh.bind(null, a, d, s, r), void 0, null), s;
  }, useId: function() {
    var t = Er(), r = Dt.identifierPrefix;
    if (ct) {
      var s = Lr, a = Ar;
      s = (a & ~(1 << 32 - et(a) - 1)).toString(32) + s, r = ":" + r + "R" + s, s = xs++, 0 < s && (r += "H" + s.toString(32)), r += ":";
    } else s = $S++, r = ":" + r + "r" + s.toString(32) + ":";
    return t.memoizedState = r;
  }, unstable_isNewReconciler: !1 }, MS = {
    readContext: Wn,
    useCallback: Kh,
    useContext: Wn,
    useEffect: Su,
    useImperativeHandle: Yh,
    useInsertionEffect: Uh,
    useLayoutEffect: Xh,
    useMemo: Qh,
    useReducer: yu,
    useRef: Wh,
    useState: function() {
      return yu(Cs);
    },
    useDebugValue: wu,
    useDeferredValue: function(t) {
      var r = qn();
      return Zh(r, Ft.memoizedState, t);
    },
    useTransition: function() {
      var t = yu(Cs)[0], r = qn().memoizedState;
      return [t, r];
    },
    useMutableSource: Oh,
    useSyncExternalStore: Ah,
    useId: Jh,
    unstable_isNewReconciler: !1
  }, TS = { readContext: Wn, useCallback: Kh, useContext: Wn, useEffect: Su, useImperativeHandle: Yh, useInsertionEffect: Uh, useLayoutEffect: Xh, useMemo: Qh, useReducer: vu, useRef: Wh, useState: function() {
    return vu(Cs);
  }, useDebugValue: wu, useDeferredValue: function(t) {
    var r = qn();
    return Ft === null ? r.memoizedState = t : Zh(r, Ft.memoizedState, t);
  }, useTransition: function() {
    var t = vu(Cs)[0], r = qn().memoizedState;
    return [t, r];
  }, useMutableSource: Oh, useSyncExternalStore: Ah, useId: Jh, unstable_isNewReconciler: !1 };
  function ar(t, r) {
    if (t && t.defaultProps) {
      r = q({}, r), t = t.defaultProps;
      for (var s in t) r[s] === void 0 && (r[s] = t[s]);
      return r;
    }
    return r;
  }
  function xu(t, r, s, a) {
    r = t.memoizedState, s = s(a, r), s = s == null ? r : q({}, r, s), t.memoizedState = s, t.lanes === 0 && (t.updateQueue.baseState = s);
  }
  var Kl = { isMounted: function(t) {
    return (t = t._reactInternals) ? yt(t) === t : !1;
  }, enqueueSetState: function(t, r, s) {
    t = t._reactInternals;
    var a = un(), u = po(t), d = Hr(a, u);
    d.payload = r, s != null && (d.callback = s), r = ao(t, d, u), r !== null && (fr(r, t, u, a), jl(r, t, u));
  }, enqueueReplaceState: function(t, r, s) {
    t = t._reactInternals;
    var a = un(), u = po(t), d = Hr(a, u);
    d.tag = 1, d.payload = r, s != null && (d.callback = s), r = ao(t, d, u), r !== null && (fr(r, t, u, a), jl(r, t, u));
  }, enqueueForceUpdate: function(t, r) {
    t = t._reactInternals;
    var s = un(), a = po(t), u = Hr(s, a);
    u.tag = 2, r != null && (u.callback = r), r = ao(t, u, a), r !== null && (fr(r, t, a, s), jl(r, t, a));
  } };
  function rm(t, r, s, a, u, d, w) {
    return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(a, d, w) : r.prototype && r.prototype.isPureReactComponent ? !cs(s, a) || !cs(u, d) : !0;
  }
  function om(t, r, s) {
    var a = !1, u = io, d = r.contextType;
    return typeof d == "object" && d !== null ? d = Wn(d) : (u = vn(r) ? _o : nn.current, a = r.contextTypes, d = (a = a != null) ? fi(t, u) : io), r = new r(s, d), t.memoizedState = r.state !== null && r.state !== void 0 ? r.state : null, r.updater = Kl, t.stateNode = r, r._reactInternals = t, a && (t = t.stateNode, t.__reactInternalMemoizedUnmaskedChildContext = u, t.__reactInternalMemoizedMaskedChildContext = d), r;
  }
  function im(t, r, s, a) {
    t = r.state, typeof r.componentWillReceiveProps == "function" && r.componentWillReceiveProps(s, a), typeof r.UNSAFE_componentWillReceiveProps == "function" && r.UNSAFE_componentWillReceiveProps(s, a), r.state !== t && Kl.enqueueReplaceState(r, r.state, null);
  }
  function Cu(t, r, s, a) {
    var u = t.stateNode;
    u.props = s, u.state = t.memoizedState, u.refs = {}, au(t);
    var d = r.contextType;
    typeof d == "object" && d !== null ? u.context = Wn(d) : (d = vn(r) ? _o : nn.current, u.context = fi(t, d)), u.state = t.memoizedState, d = r.getDerivedStateFromProps, typeof d == "function" && (xu(t, r, d, s), u.state = t.memoizedState), typeof r.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (r = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), r !== u.state && Kl.enqueueReplaceState(u, u.state, null), Vl(t, s, u, a), u.state = t.memoizedState), typeof u.componentDidMount == "function" && (t.flags |= 4194308);
  }
  function Si(t, r) {
    try {
      var s = "", a = r;
      do
        s += se(a), a = a.return;
      while (a);
      var u = s;
    } catch (d) {
      u = `
Error generating stack: ` + d.message + `
` + d.stack;
    }
    return { value: t, source: r, stack: u, digest: null };
  }
  function bu(t, r, s) {
    return { value: t, source: null, stack: s ?? null, digest: r ?? null };
  }
  function Eu(t, r) {
    try {
      console.error(r.value);
    } catch (s) {
      setTimeout(function() {
        throw s;
      });
    }
  }
  var NS = typeof WeakMap == "function" ? WeakMap : Map;
  function sm(t, r, s) {
    s = Hr(-1, s), s.tag = 3, s.payload = { element: null };
    var a = r.value;
    return s.callback = function() {
      ra || (ra = !0, Bu = a), Eu(t, r);
    }, s;
  }
  function lm(t, r, s) {
    s = Hr(-1, s), s.tag = 3;
    var a = t.type.getDerivedStateFromError;
    if (typeof a == "function") {
      var u = r.value;
      s.payload = function() {
        return a(u);
      }, s.callback = function() {
        Eu(t, r);
      };
    }
    var d = t.stateNode;
    return d !== null && typeof d.componentDidCatch == "function" && (s.callback = function() {
      Eu(t, r), typeof a != "function" && (uo === null ? uo = /* @__PURE__ */ new Set([this]) : uo.add(this));
      var w = r.stack;
      this.componentDidCatch(r.value, { componentStack: w !== null ? w : "" });
    }), s;
  }
  function am(t, r, s) {
    var a = t.pingCache;
    if (a === null) {
      a = t.pingCache = new NS();
      var u = /* @__PURE__ */ new Set();
      a.set(r, u);
    } else u = a.get(r), u === void 0 && (u = /* @__PURE__ */ new Set(), a.set(r, u));
    u.has(s) || (u.add(s), t = US.bind(null, t, r, s), r.then(t, t));
  }
  function cm(t) {
    do {
      var r;
      if ((r = t.tag === 13) && (r = t.memoizedState, r = r !== null ? r.dehydrated !== null : !0), r) return t;
      t = t.return;
    } while (t !== null);
    return null;
  }
  function um(t, r, s, a, u) {
    return (t.mode & 1) === 0 ? (t === r ? t.flags |= 65536 : (t.flags |= 128, s.flags |= 131072, s.flags &= -52805, s.tag === 1 && (s.alternate === null ? s.tag = 17 : (r = Hr(-1, 1), r.tag = 2, ao(s, r, 1))), s.lanes |= 1), t) : (t.flags |= 65536, t.lanes = u, t);
  }
  var IS = R.ReactCurrentOwner, Sn = !1;
  function cn(t, r, s, a) {
    r.child = t === null ? Mh(r, null, s, a) : mi(r, t.child, s, a);
  }
  function fm(t, r, s, a, u) {
    s = s.render;
    var d = r.ref;
    return yi(r, u), a = mu(t, r, s, a, d, u), s = gu(), t !== null && !Sn ? (r.updateQueue = t.updateQueue, r.flags &= -2053, t.lanes &= ~u, Dr(t, r, u)) : (ct && s && Zc(r), r.flags |= 1, cn(t, r, a, u), r.child);
  }
  function dm(t, r, s, a, u) {
    if (t === null) {
      var d = s.type;
      return typeof d == "function" && !Uu(d) && d.defaultProps === void 0 && s.compare === null && s.defaultProps === void 0 ? (r.tag = 15, r.type = d, pm(t, r, d, a, u)) : (t = ca(s.type, null, a, r, r.mode, u), t.ref = r.ref, t.return = r, r.child = t);
    }
    if (d = t.child, (t.lanes & u) === 0) {
      var w = d.memoizedProps;
      if (s = s.compare, s = s !== null ? s : cs, s(w, a) && t.ref === r.ref) return Dr(t, r, u);
    }
    return r.flags |= 1, t = mo(d, a), t.ref = r.ref, t.return = r, r.child = t;
  }
  function pm(t, r, s, a, u) {
    if (t !== null) {
      var d = t.memoizedProps;
      if (cs(d, a) && t.ref === r.ref) if (Sn = !1, r.pendingProps = a = d, (t.lanes & u) !== 0) (t.flags & 131072) !== 0 && (Sn = !0);
      else return r.lanes = t.lanes, Dr(t, r, u);
    }
    return $u(t, r, s, a, u);
  }
  function hm(t, r, s) {
    var a = r.pendingProps, u = a.children, d = t !== null ? t.memoizedState : null;
    if (a.mode === "hidden") if ((r.mode & 1) === 0) r.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, ot(xi, Tn), Tn |= s;
    else {
      if ((s & 1073741824) === 0) return t = d !== null ? d.baseLanes | s : s, r.lanes = r.childLanes = 1073741824, r.memoizedState = { baseLanes: t, cachePool: null, transitions: null }, r.updateQueue = null, ot(xi, Tn), Tn |= t, null;
      r.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, a = d !== null ? d.baseLanes : s, ot(xi, Tn), Tn |= a;
    }
    else d !== null ? (a = d.baseLanes | s, r.memoizedState = null) : a = s, ot(xi, Tn), Tn |= a;
    return cn(t, r, u, s), r.child;
  }
  function mm(t, r) {
    var s = r.ref;
    (t === null && s !== null || t !== null && t.ref !== s) && (r.flags |= 512, r.flags |= 2097152);
  }
  function $u(t, r, s, a, u) {
    var d = vn(s) ? _o : nn.current;
    return d = fi(r, d), yi(r, u), s = mu(t, r, s, a, d, u), a = gu(), t !== null && !Sn ? (r.updateQueue = t.updateQueue, r.flags &= -2053, t.lanes &= ~u, Dr(t, r, u)) : (ct && a && Zc(r), r.flags |= 1, cn(t, r, s, u), r.child);
  }
  function gm(t, r, s, a, u) {
    if (vn(s)) {
      var d = !0;
      Fl(r);
    } else d = !1;
    if (yi(r, u), r.stateNode === null) Zl(t, r), om(r, s, a), Cu(r, s, a, u), a = !0;
    else if (t === null) {
      var w = r.stateNode, _ = r.memoizedProps;
      w.props = _;
      var N = w.context, H = s.contextType;
      typeof H == "object" && H !== null ? H = Wn(H) : (H = vn(s) ? _o : nn.current, H = fi(r, H));
      var U = s.getDerivedStateFromProps, K = typeof U == "function" || typeof w.getSnapshotBeforeUpdate == "function";
      K || typeof w.UNSAFE_componentWillReceiveProps != "function" && typeof w.componentWillReceiveProps != "function" || (_ !== a || N !== H) && im(r, w, a, H), lo = !1;
      var W = r.memoizedState;
      w.state = W, Vl(r, a, w, u), N = r.memoizedState, _ !== a || W !== N || yn.current || lo ? (typeof U == "function" && (xu(r, s, U, a), N = r.memoizedState), (_ = lo || rm(r, s, _, a, W, N, H)) ? (K || typeof w.UNSAFE_componentWillMount != "function" && typeof w.componentWillMount != "function" || (typeof w.componentWillMount == "function" && w.componentWillMount(), typeof w.UNSAFE_componentWillMount == "function" && w.UNSAFE_componentWillMount()), typeof w.componentDidMount == "function" && (r.flags |= 4194308)) : (typeof w.componentDidMount == "function" && (r.flags |= 4194308), r.memoizedProps = a, r.memoizedState = N), w.props = a, w.state = N, w.context = H, a = _) : (typeof w.componentDidMount == "function" && (r.flags |= 4194308), a = !1);
    } else {
      w = r.stateNode, Nh(t, r), _ = r.memoizedProps, H = r.type === r.elementType ? _ : ar(r.type, _), w.props = H, K = r.pendingProps, W = w.context, N = s.contextType, typeof N == "object" && N !== null ? N = Wn(N) : (N = vn(s) ? _o : nn.current, N = fi(r, N));
      var pe = s.getDerivedStateFromProps;
      (U = typeof pe == "function" || typeof w.getSnapshotBeforeUpdate == "function") || typeof w.UNSAFE_componentWillReceiveProps != "function" && typeof w.componentWillReceiveProps != "function" || (_ !== K || W !== N) && im(r, w, a, N), lo = !1, W = r.memoizedState, w.state = W, Vl(r, a, w, u);
      var ge = r.memoizedState;
      _ !== K || W !== ge || yn.current || lo ? (typeof pe == "function" && (xu(r, s, pe, a), ge = r.memoizedState), (H = lo || rm(r, s, H, a, W, ge, N) || !1) ? (U || typeof w.UNSAFE_componentWillUpdate != "function" && typeof w.componentWillUpdate != "function" || (typeof w.componentWillUpdate == "function" && w.componentWillUpdate(a, ge, N), typeof w.UNSAFE_componentWillUpdate == "function" && w.UNSAFE_componentWillUpdate(a, ge, N)), typeof w.componentDidUpdate == "function" && (r.flags |= 4), typeof w.getSnapshotBeforeUpdate == "function" && (r.flags |= 1024)) : (typeof w.componentDidUpdate != "function" || _ === t.memoizedProps && W === t.memoizedState || (r.flags |= 4), typeof w.getSnapshotBeforeUpdate != "function" || _ === t.memoizedProps && W === t.memoizedState || (r.flags |= 1024), r.memoizedProps = a, r.memoizedState = ge), w.props = a, w.state = ge, w.context = N, a = H) : (typeof w.componentDidUpdate != "function" || _ === t.memoizedProps && W === t.memoizedState || (r.flags |= 4), typeof w.getSnapshotBeforeUpdate != "function" || _ === t.memoizedProps && W === t.memoizedState || (r.flags |= 1024), a = !1);
    }
    return _u(t, r, s, a, d, u);
  }
  function _u(t, r, s, a, u, d) {
    mm(t, r);
    var w = (r.flags & 128) !== 0;
    if (!a && !w) return u && xh(r, s, !1), Dr(t, r, d);
    a = r.stateNode, IS.current = r;
    var _ = w && typeof s.getDerivedStateFromError != "function" ? null : a.render();
    return r.flags |= 1, t !== null && w ? (r.child = mi(r, t.child, null, d), r.child = mi(r, null, _, d)) : cn(t, r, _, d), r.memoizedState = a.state, u && xh(r, s, !0), r.child;
  }
  function ym(t) {
    var r = t.stateNode;
    r.pendingContext ? Sh(t, r.pendingContext, r.pendingContext !== r.context) : r.context && Sh(t, r.context, !1), cu(t, r.containerInfo);
  }
  function vm(t, r, s, a, u) {
    return hi(), nu(u), r.flags |= 256, cn(t, r, s, a), r.child;
  }
  var Pu = { dehydrated: null, treeContext: null, retryLane: 0 };
  function Ru(t) {
    return { baseLanes: t, cachePool: null, transitions: null };
  }
  function Sm(t, r, s) {
    var a = r.pendingProps, u = pt.current, d = !1, w = (r.flags & 128) !== 0, _;
    if ((_ = w) || (_ = t !== null && t.memoizedState === null ? !1 : (u & 2) !== 0), _ ? (d = !0, r.flags &= -129) : (t === null || t.memoizedState !== null) && (u |= 1), ot(pt, u & 1), t === null)
      return tu(r), t = r.memoizedState, t !== null && (t = t.dehydrated, t !== null) ? ((r.mode & 1) === 0 ? r.lanes = 1 : t.data === "$!" ? r.lanes = 8 : r.lanes = 1073741824, null) : (w = a.children, t = a.fallback, d ? (a = r.mode, d = r.child, w = { mode: "hidden", children: w }, (a & 1) === 0 && d !== null ? (d.childLanes = 0, d.pendingProps = w) : d = ua(w, a, 0, null), t = Oo(t, a, s, null), d.return = r, t.return = r, d.sibling = t, r.child = d, r.child.memoizedState = Ru(s), r.memoizedState = Pu, t) : ku(r, w));
    if (u = t.memoizedState, u !== null && (_ = u.dehydrated, _ !== null)) return FS(t, r, w, a, _, u, s);
    if (d) {
      d = a.fallback, w = r.mode, u = t.child, _ = u.sibling;
      var N = { mode: "hidden", children: a.children };
      return (w & 1) === 0 && r.child !== u ? (a = r.child, a.childLanes = 0, a.pendingProps = N, r.deletions = null) : (a = mo(u, N), a.subtreeFlags = u.subtreeFlags & 14680064), _ !== null ? d = mo(_, d) : (d = Oo(d, w, s, null), d.flags |= 2), d.return = r, a.return = r, a.sibling = d, r.child = a, a = d, d = r.child, w = t.child.memoizedState, w = w === null ? Ru(s) : { baseLanes: w.baseLanes | s, cachePool: null, transitions: w.transitions }, d.memoizedState = w, d.childLanes = t.childLanes & ~s, r.memoizedState = Pu, a;
    }
    return d = t.child, t = d.sibling, a = mo(d, { mode: "visible", children: a.children }), (r.mode & 1) === 0 && (a.lanes = s), a.return = r, a.sibling = null, t !== null && (s = r.deletions, s === null ? (r.deletions = [t], r.flags |= 16) : s.push(t)), r.child = a, r.memoizedState = null, a;
  }
  function ku(t, r) {
    return r = ua({ mode: "visible", children: r }, t.mode, 0, null), r.return = t, t.child = r;
  }
  function Ql(t, r, s, a) {
    return a !== null && nu(a), mi(r, t.child, null, s), t = ku(r, r.pendingProps.children), t.flags |= 2, r.memoizedState = null, t;
  }
  function FS(t, r, s, a, u, d, w) {
    if (s)
      return r.flags & 256 ? (r.flags &= -257, a = bu(Error(o(422))), Ql(t, r, w, a)) : r.memoizedState !== null ? (r.child = t.child, r.flags |= 128, null) : (d = a.fallback, u = r.mode, a = ua({ mode: "visible", children: a.children }, u, 0, null), d = Oo(d, u, w, null), d.flags |= 2, a.return = r, d.return = r, a.sibling = d, r.child = a, (r.mode & 1) !== 0 && mi(r, t.child, null, w), r.child.memoizedState = Ru(w), r.memoizedState = Pu, d);
    if ((r.mode & 1) === 0) return Ql(t, r, w, null);
    if (u.data === "$!") {
      if (a = u.nextSibling && u.nextSibling.dataset, a) var _ = a.dgst;
      return a = _, d = Error(o(419)), a = bu(d, a, void 0), Ql(t, r, w, a);
    }
    if (_ = (w & t.childLanes) !== 0, Sn || _) {
      if (a = Dt, a !== null) {
        switch (w & -w) {
          case 4:
            u = 2;
            break;
          case 16:
            u = 8;
            break;
          case 64:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
          case 67108864:
            u = 32;
            break;
          case 536870912:
            u = 268435456;
            break;
          default:
            u = 0;
        }
        u = (u & (a.suspendedLanes | w)) !== 0 ? 0 : u, u !== 0 && u !== d.retryLane && (d.retryLane = u, Br(t, u), fr(a, t, u, -1));
      }
      return qu(), a = bu(Error(o(421))), Ql(t, r, w, a);
    }
    return u.data === "$?" ? (r.flags |= 128, r.child = t.child, r = XS.bind(null, t), u._reactRetry = r, null) : (t = d.treeContext, Mn = ro(u.nextSibling), kn = r, ct = !0, lr = null, t !== null && (jn[Vn++] = Ar, jn[Vn++] = Lr, jn[Vn++] = Po, Ar = t.id, Lr = t.overflow, Po = r), r = ku(r, a.children), r.flags |= 4096, r);
  }
  function wm(t, r, s) {
    t.lanes |= r;
    var a = t.alternate;
    a !== null && (a.lanes |= r), su(t.return, r, s);
  }
  function Mu(t, r, s, a, u) {
    var d = t.memoizedState;
    d === null ? t.memoizedState = { isBackwards: r, rendering: null, renderingStartTime: 0, last: a, tail: s, tailMode: u } : (d.isBackwards = r, d.rendering = null, d.renderingStartTime = 0, d.last = a, d.tail = s, d.tailMode = u);
  }
  function xm(t, r, s) {
    var a = r.pendingProps, u = a.revealOrder, d = a.tail;
    if (cn(t, r, a.children, s), a = pt.current, (a & 2) !== 0) a = a & 1 | 2, r.flags |= 128;
    else {
      if (t !== null && (t.flags & 128) !== 0) e: for (t = r.child; t !== null; ) {
        if (t.tag === 13) t.memoizedState !== null && wm(t, s, r);
        else if (t.tag === 19) wm(t, s, r);
        else if (t.child !== null) {
          t.child.return = t, t = t.child;
          continue;
        }
        if (t === r) break e;
        for (; t.sibling === null; ) {
          if (t.return === null || t.return === r) break e;
          t = t.return;
        }
        t.sibling.return = t.return, t = t.sibling;
      }
      a &= 1;
    }
    if (ot(pt, a), (r.mode & 1) === 0) r.memoizedState = null;
    else switch (u) {
      case "forwards":
        for (s = r.child, u = null; s !== null; ) t = s.alternate, t !== null && Wl(t) === null && (u = s), s = s.sibling;
        s = u, s === null ? (u = r.child, r.child = null) : (u = s.sibling, s.sibling = null), Mu(r, !1, u, s, d);
        break;
      case "backwards":
        for (s = null, u = r.child, r.child = null; u !== null; ) {
          if (t = u.alternate, t !== null && Wl(t) === null) {
            r.child = u;
            break;
          }
          t = u.sibling, u.sibling = s, s = u, u = t;
        }
        Mu(r, !0, s, null, d);
        break;
      case "together":
        Mu(r, !1, null, null, void 0);
        break;
      default:
        r.memoizedState = null;
    }
    return r.child;
  }
  function Zl(t, r) {
    (r.mode & 1) === 0 && t !== null && (t.alternate = null, r.alternate = null, r.flags |= 2);
  }
  function Dr(t, r, s) {
    if (t !== null && (r.dependencies = t.dependencies), No |= r.lanes, (s & r.childLanes) === 0) return null;
    if (t !== null && r.child !== t.child) throw Error(o(153));
    if (r.child !== null) {
      for (t = r.child, s = mo(t, t.pendingProps), r.child = s, s.return = r; t.sibling !== null; ) t = t.sibling, s = s.sibling = mo(t, t.pendingProps), s.return = r;
      s.sibling = null;
    }
    return r.child;
  }
  function zS(t, r, s) {
    switch (r.tag) {
      case 3:
        ym(r), hi();
        break;
      case 5:
        zh(r);
        break;
      case 1:
        vn(r.type) && Fl(r);
        break;
      case 4:
        cu(r, r.stateNode.containerInfo);
        break;
      case 10:
        var a = r.type._context, u = r.memoizedProps.value;
        ot(Hl, a._currentValue), a._currentValue = u;
        break;
      case 13:
        if (a = r.memoizedState, a !== null)
          return a.dehydrated !== null ? (ot(pt, pt.current & 1), r.flags |= 128, null) : (s & r.child.childLanes) !== 0 ? Sm(t, r, s) : (ot(pt, pt.current & 1), t = Dr(t, r, s), t !== null ? t.sibling : null);
        ot(pt, pt.current & 1);
        break;
      case 19:
        if (a = (s & r.childLanes) !== 0, (t.flags & 128) !== 0) {
          if (a) return xm(t, r, s);
          r.flags |= 128;
        }
        if (u = r.memoizedState, u !== null && (u.rendering = null, u.tail = null, u.lastEffect = null), ot(pt, pt.current), a) break;
        return null;
      case 22:
      case 23:
        return r.lanes = 0, hm(t, r, s);
    }
    return Dr(t, r, s);
  }
  var Cm, Tu, bm, Em;
  Cm = function(t, r) {
    for (var s = r.child; s !== null; ) {
      if (s.tag === 5 || s.tag === 6) t.appendChild(s.stateNode);
      else if (s.tag !== 4 && s.child !== null) {
        s.child.return = s, s = s.child;
        continue;
      }
      if (s === r) break;
      for (; s.sibling === null; ) {
        if (s.return === null || s.return === r) return;
        s = s.return;
      }
      s.sibling.return = s.return, s = s.sibling;
    }
  }, Tu = function() {
  }, bm = function(t, r, s, a) {
    var u = t.memoizedProps;
    if (u !== a) {
      t = r.stateNode, Mo(br.current);
      var d = null;
      switch (s) {
        case "input":
          u = Qe(t, u), a = Qe(t, a), d = [];
          break;
        case "select":
          u = q({}, u, { value: void 0 }), a = q({}, a, { value: void 0 }), d = [];
          break;
        case "textarea":
          u = je(t, u), a = je(t, a), d = [];
          break;
        default:
          typeof u.onClick != "function" && typeof a.onClick == "function" && (t.onclick = Tl);
      }
      ze(s, a);
      var w;
      s = null;
      for (H in u) if (!a.hasOwnProperty(H) && u.hasOwnProperty(H) && u[H] != null) if (H === "style") {
        var _ = u[H];
        for (w in _) _.hasOwnProperty(w) && (s || (s = {}), s[w] = "");
      } else H !== "dangerouslySetInnerHTML" && H !== "children" && H !== "suppressContentEditableWarning" && H !== "suppressHydrationWarning" && H !== "autoFocus" && (l.hasOwnProperty(H) ? d || (d = []) : (d = d || []).push(H, null));
      for (H in a) {
        var N = a[H];
        if (_ = u?.[H], a.hasOwnProperty(H) && N !== _ && (N != null || _ != null)) if (H === "style") if (_) {
          for (w in _) !_.hasOwnProperty(w) || N && N.hasOwnProperty(w) || (s || (s = {}), s[w] = "");
          for (w in N) N.hasOwnProperty(w) && _[w] !== N[w] && (s || (s = {}), s[w] = N[w]);
        } else s || (d || (d = []), d.push(
          H,
          s
        )), s = N;
        else H === "dangerouslySetInnerHTML" ? (N = N ? N.__html : void 0, _ = _ ? _.__html : void 0, N != null && _ !== N && (d = d || []).push(H, N)) : H === "children" ? typeof N != "string" && typeof N != "number" || (d = d || []).push(H, "" + N) : H !== "suppressContentEditableWarning" && H !== "suppressHydrationWarning" && (l.hasOwnProperty(H) ? (N != null && H === "onScroll" && it("scroll", t), d || _ === N || (d = [])) : (d = d || []).push(H, N));
      }
      s && (d = d || []).push("style", s);
      var H = d;
      (r.updateQueue = H) && (r.flags |= 4);
    }
  }, Em = function(t, r, s, a) {
    s !== a && (r.flags |= 4);
  };
  function Es(t, r) {
    if (!ct) switch (t.tailMode) {
      case "hidden":
        r = t.tail;
        for (var s = null; r !== null; ) r.alternate !== null && (s = r), r = r.sibling;
        s === null ? t.tail = null : s.sibling = null;
        break;
      case "collapsed":
        s = t.tail;
        for (var a = null; s !== null; ) s.alternate !== null && (a = s), s = s.sibling;
        a === null ? r || t.tail === null ? t.tail = null : t.tail.sibling = null : a.sibling = null;
    }
  }
  function on(t) {
    var r = t.alternate !== null && t.alternate.child === t.child, s = 0, a = 0;
    if (r) for (var u = t.child; u !== null; ) s |= u.lanes | u.childLanes, a |= u.subtreeFlags & 14680064, a |= u.flags & 14680064, u.return = t, u = u.sibling;
    else for (u = t.child; u !== null; ) s |= u.lanes | u.childLanes, a |= u.subtreeFlags, a |= u.flags, u.return = t, u = u.sibling;
    return t.subtreeFlags |= a, t.childLanes = s, r;
  }
  function OS(t, r, s) {
    var a = r.pendingProps;
    switch (Jc(r), r.tag) {
      case 2:
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return on(r), null;
      case 1:
        return vn(r.type) && Il(), on(r), null;
      case 3:
        return a = r.stateNode, vi(), st(yn), st(nn), du(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Ll(r) ? r.flags |= 4 : t === null || t.memoizedState.isDehydrated && (r.flags & 256) === 0 || (r.flags |= 1024, lr !== null && (ju(lr), lr = null))), Tu(t, r), on(r), null;
      case 5:
        uu(r);
        var u = Mo(Ss.current);
        if (s = r.type, t !== null && r.stateNode != null) bm(t, r, s, a, u), t.ref !== r.ref && (r.flags |= 512, r.flags |= 2097152);
        else {
          if (!a) {
            if (r.stateNode === null) throw Error(o(166));
            return on(r), null;
          }
          if (t = Mo(br.current), Ll(r)) {
            a = r.stateNode, s = r.type;
            var d = r.memoizedProps;
            switch (a[Cr] = r, a[hs] = d, t = (r.mode & 1) !== 0, s) {
              case "dialog":
                it("cancel", a), it("close", a);
                break;
              case "iframe":
              case "object":
              case "embed":
                it("load", a);
                break;
              case "video":
              case "audio":
                for (u = 0; u < fs.length; u++) it(fs[u], a);
                break;
              case "source":
                it("error", a);
                break;
              case "img":
              case "image":
              case "link":
                it(
                  "error",
                  a
                ), it("load", a);
                break;
              case "details":
                it("toggle", a);
                break;
              case "input":
                ke(a, d), it("invalid", a);
                break;
              case "select":
                a._wrapperState = { wasMultiple: !!d.multiple }, it("invalid", a);
                break;
              case "textarea":
                Je(a, d), it("invalid", a);
            }
            ze(s, d), u = null;
            for (var w in d) if (d.hasOwnProperty(w)) {
              var _ = d[w];
              w === "children" ? typeof _ == "string" ? a.textContent !== _ && (d.suppressHydrationWarning !== !0 && Ml(a.textContent, _, t), u = ["children", _]) : typeof _ == "number" && a.textContent !== "" + _ && (d.suppressHydrationWarning !== !0 && Ml(
                a.textContent,
                _,
                t
              ), u = ["children", "" + _]) : l.hasOwnProperty(w) && _ != null && w === "onScroll" && it("scroll", a);
            }
            switch (s) {
              case "input":
                ce(a), Oe(a, d, !0);
                break;
              case "textarea":
                ce(a), dn(a);
                break;
              case "select":
              case "option":
                break;
              default:
                typeof d.onClick == "function" && (a.onclick = Tl);
            }
            a = u, r.updateQueue = a, a !== null && (r.flags |= 4);
          } else {
            w = u.nodeType === 9 ? u : u.ownerDocument, t === "http://www.w3.org/1999/xhtml" && (t = Rt(s)), t === "http://www.w3.org/1999/xhtml" ? s === "script" ? (t = w.createElement("div"), t.innerHTML = "<script><\/script>", t = t.removeChild(t.firstChild)) : typeof a.is == "string" ? t = w.createElement(s, { is: a.is }) : (t = w.createElement(s), s === "select" && (w = t, a.multiple ? w.multiple = !0 : a.size && (w.size = a.size))) : t = w.createElementNS(t, s), t[Cr] = r, t[hs] = a, Cm(t, r, !1, !1), r.stateNode = t;
            e: {
              switch (w = Ge(s, a), s) {
                case "dialog":
                  it("cancel", t), it("close", t), u = a;
                  break;
                case "iframe":
                case "object":
                case "embed":
                  it("load", t), u = a;
                  break;
                case "video":
                case "audio":
                  for (u = 0; u < fs.length; u++) it(fs[u], t);
                  u = a;
                  break;
                case "source":
                  it("error", t), u = a;
                  break;
                case "img":
                case "image":
                case "link":
                  it(
                    "error",
                    t
                  ), it("load", t), u = a;
                  break;
                case "details":
                  it("toggle", t), u = a;
                  break;
                case "input":
                  ke(t, a), u = Qe(t, a), it("invalid", t);
                  break;
                case "option":
                  u = a;
                  break;
                case "select":
                  t._wrapperState = { wasMultiple: !!a.multiple }, u = q({}, a, { value: void 0 }), it("invalid", t);
                  break;
                case "textarea":
                  Je(t, a), u = je(t, a), it("invalid", t);
                  break;
                default:
                  u = a;
              }
              ze(s, u), _ = u;
              for (d in _) if (_.hasOwnProperty(d)) {
                var N = _[d];
                d === "style" ? Ve(t, N) : d === "dangerouslySetInnerHTML" ? (N = N ? N.__html : void 0, N != null && kt(t, N)) : d === "children" ? typeof N == "string" ? (s !== "textarea" || N !== "") && mt(t, N) : typeof N == "number" && mt(t, "" + N) : d !== "suppressContentEditableWarning" && d !== "suppressHydrationWarning" && d !== "autoFocus" && (l.hasOwnProperty(d) ? N != null && d === "onScroll" && it("scroll", t) : N != null && P(t, d, N, w));
              }
              switch (s) {
                case "input":
                  ce(t), Oe(t, a, !1);
                  break;
                case "textarea":
                  ce(t), dn(t);
                  break;
                case "option":
                  a.value != null && t.setAttribute("value", "" + ie(a.value));
                  break;
                case "select":
                  t.multiple = !!a.multiple, d = a.value, d != null ? tt(t, !!a.multiple, d, !1) : a.defaultValue != null && tt(
                    t,
                    !!a.multiple,
                    a.defaultValue,
                    !0
                  );
                  break;
                default:
                  typeof u.onClick == "function" && (t.onclick = Tl);
              }
              switch (s) {
                case "button":
                case "input":
                case "select":
                case "textarea":
                  a = !!a.autoFocus;
                  break e;
                case "img":
                  a = !0;
                  break e;
                default:
                  a = !1;
              }
            }
            a && (r.flags |= 4);
          }
          r.ref !== null && (r.flags |= 512, r.flags |= 2097152);
        }
        return on(r), null;
      case 6:
        if (t && r.stateNode != null) Em(t, r, t.memoizedProps, a);
        else {
          if (typeof a != "string" && r.stateNode === null) throw Error(o(166));
          if (s = Mo(Ss.current), Mo(br.current), Ll(r)) {
            if (a = r.stateNode, s = r.memoizedProps, a[Cr] = r, (d = a.nodeValue !== s) && (t = kn, t !== null)) switch (t.tag) {
              case 3:
                Ml(a.nodeValue, s, (t.mode & 1) !== 0);
                break;
              case 5:
                t.memoizedProps.suppressHydrationWarning !== !0 && Ml(a.nodeValue, s, (t.mode & 1) !== 0);
            }
            d && (r.flags |= 4);
          } else a = (s.nodeType === 9 ? s : s.ownerDocument).createTextNode(a), a[Cr] = r, r.stateNode = a;
        }
        return on(r), null;
      case 13:
        if (st(pt), a = r.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
          if (ct && Mn !== null && (r.mode & 1) !== 0 && (r.flags & 128) === 0) Ph(), hi(), r.flags |= 98560, d = !1;
          else if (d = Ll(r), a !== null && a.dehydrated !== null) {
            if (t === null) {
              if (!d) throw Error(o(318));
              if (d = r.memoizedState, d = d !== null ? d.dehydrated : null, !d) throw Error(o(317));
              d[Cr] = r;
            } else hi(), (r.flags & 128) === 0 && (r.memoizedState = null), r.flags |= 4;
            on(r), d = !1;
          } else lr !== null && (ju(lr), lr = null), d = !0;
          if (!d) return r.flags & 65536 ? r : null;
        }
        return (r.flags & 128) !== 0 ? (r.lanes = s, r) : (a = a !== null, a !== (t !== null && t.memoizedState !== null) && a && (r.child.flags |= 8192, (r.mode & 1) !== 0 && (t === null || (pt.current & 1) !== 0 ? zt === 0 && (zt = 3) : qu())), r.updateQueue !== null && (r.flags |= 4), on(r), null);
      case 4:
        return vi(), Tu(t, r), t === null && ds(r.stateNode.containerInfo), on(r), null;
      case 10:
        return iu(r.type._context), on(r), null;
      case 17:
        return vn(r.type) && Il(), on(r), null;
      case 19:
        if (st(pt), d = r.memoizedState, d === null) return on(r), null;
        if (a = (r.flags & 128) !== 0, w = d.rendering, w === null) if (a) Es(d, !1);
        else {
          if (zt !== 0 || t !== null && (t.flags & 128) !== 0) for (t = r.child; t !== null; ) {
            if (w = Wl(t), w !== null) {
              for (r.flags |= 128, Es(d, !1), a = w.updateQueue, a !== null && (r.updateQueue = a, r.flags |= 4), r.subtreeFlags = 0, a = s, s = r.child; s !== null; ) d = s, t = a, d.flags &= 14680066, w = d.alternate, w === null ? (d.childLanes = 0, d.lanes = t, d.child = null, d.subtreeFlags = 0, d.memoizedProps = null, d.memoizedState = null, d.updateQueue = null, d.dependencies = null, d.stateNode = null) : (d.childLanes = w.childLanes, d.lanes = w.lanes, d.child = w.child, d.subtreeFlags = 0, d.deletions = null, d.memoizedProps = w.memoizedProps, d.memoizedState = w.memoizedState, d.updateQueue = w.updateQueue, d.type = w.type, t = w.dependencies, d.dependencies = t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }), s = s.sibling;
              return ot(pt, pt.current & 1 | 2), r.child;
            }
            t = t.sibling;
          }
          d.tail !== null && Be() > Ci && (r.flags |= 128, a = !0, Es(d, !1), r.lanes = 4194304);
        }
        else {
          if (!a) if (t = Wl(w), t !== null) {
            if (r.flags |= 128, a = !0, s = t.updateQueue, s !== null && (r.updateQueue = s, r.flags |= 4), Es(d, !0), d.tail === null && d.tailMode === "hidden" && !w.alternate && !ct) return on(r), null;
          } else 2 * Be() - d.renderingStartTime > Ci && s !== 1073741824 && (r.flags |= 128, a = !0, Es(d, !1), r.lanes = 4194304);
          d.isBackwards ? (w.sibling = r.child, r.child = w) : (s = d.last, s !== null ? s.sibling = w : r.child = w, d.last = w);
        }
        return d.tail !== null ? (r = d.tail, d.rendering = r, d.tail = r.sibling, d.renderingStartTime = Be(), r.sibling = null, s = pt.current, ot(pt, a ? s & 1 | 2 : s & 1), r) : (on(r), null);
      case 22:
      case 23:
        return Wu(), a = r.memoizedState !== null, t !== null && t.memoizedState !== null !== a && (r.flags |= 8192), a && (r.mode & 1) !== 0 ? (Tn & 1073741824) !== 0 && (on(r), r.subtreeFlags & 6 && (r.flags |= 8192)) : on(r), null;
      case 24:
        return null;
      case 25:
        return null;
    }
    throw Error(o(156, r.tag));
  }
  function AS(t, r) {
    switch (Jc(r), r.tag) {
      case 1:
        return vn(r.type) && Il(), t = r.flags, t & 65536 ? (r.flags = t & -65537 | 128, r) : null;
      case 3:
        return vi(), st(yn), st(nn), du(), t = r.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (r.flags = t & -65537 | 128, r) : null;
      case 5:
        return uu(r), null;
      case 13:
        if (st(pt), t = r.memoizedState, t !== null && t.dehydrated !== null) {
          if (r.alternate === null) throw Error(o(340));
          hi();
        }
        return t = r.flags, t & 65536 ? (r.flags = t & -65537 | 128, r) : null;
      case 19:
        return st(pt), null;
      case 4:
        return vi(), null;
      case 10:
        return iu(r.type._context), null;
      case 22:
      case 23:
        return Wu(), null;
      case 24:
        return null;
      default:
        return null;
    }
  }
  var Jl = !1, sn = !1, LS = typeof WeakSet == "function" ? WeakSet : Set, me = null;
  function wi(t, r) {
    var s = t.ref;
    if (s !== null) if (typeof s == "function") try {
      s(null);
    } catch (a) {
      vt(t, r, a);
    }
    else s.current = null;
  }
  function Nu(t, r, s) {
    try {
      s();
    } catch (a) {
      vt(t, r, a);
    }
  }
  var $m = !1;
  function BS(t, r) {
    if (Wc = Sl, t = rh(), Oc(t)) {
      if ("selectionStart" in t) var s = { start: t.selectionStart, end: t.selectionEnd };
      else e: {
        s = (s = t.ownerDocument) && s.defaultView || window;
        var a = s.getSelection && s.getSelection();
        if (a && a.rangeCount !== 0) {
          s = a.anchorNode;
          var u = a.anchorOffset, d = a.focusNode;
          a = a.focusOffset;
          try {
            s.nodeType, d.nodeType;
          } catch {
            s = null;
            break e;
          }
          var w = 0, _ = -1, N = -1, H = 0, U = 0, K = t, W = null;
          t: for (; ; ) {
            for (var pe; K !== s || u !== 0 && K.nodeType !== 3 || (_ = w + u), K !== d || a !== 0 && K.nodeType !== 3 || (N = w + a), K.nodeType === 3 && (w += K.nodeValue.length), (pe = K.firstChild) !== null; )
              W = K, K = pe;
            for (; ; ) {
              if (K === t) break t;
              if (W === s && ++H === u && (_ = w), W === d && ++U === a && (N = w), (pe = K.nextSibling) !== null) break;
              K = W, W = K.parentNode;
            }
            K = pe;
          }
          s = _ === -1 || N === -1 ? null : { start: _, end: N };
        } else s = null;
      }
      s = s || { start: 0, end: 0 };
    } else s = null;
    for (qc = { focusedElem: t, selectionRange: s }, Sl = !1, me = r; me !== null; ) if (r = me, t = r.child, (r.subtreeFlags & 1028) !== 0 && t !== null) t.return = r, me = t;
    else for (; me !== null; ) {
      r = me;
      try {
        var ge = r.alternate;
        if ((r.flags & 1024) !== 0) switch (r.tag) {
          case 0:
          case 11:
          case 15:
            break;
          case 1:
            if (ge !== null) {
              var ve = ge.memoizedProps, Ct = ge.memoizedState, L = r.stateNode, F = L.getSnapshotBeforeUpdate(r.elementType === r.type ? ve : ar(r.type, ve), Ct);
              L.__reactInternalSnapshotBeforeUpdate = F;
            }
            break;
          case 3:
            var B = r.stateNode.containerInfo;
            B.nodeType === 1 ? B.textContent = "" : B.nodeType === 9 && B.documentElement && B.removeChild(B.documentElement);
            break;
          case 5:
          case 6:
          case 4:
          case 17:
            break;
          default:
            throw Error(o(163));
        }
      } catch (ne) {
        vt(r, r.return, ne);
      }
      if (t = r.sibling, t !== null) {
        t.return = r.return, me = t;
        break;
      }
      me = r.return;
    }
    return ge = $m, $m = !1, ge;
  }
  function $s(t, r, s) {
    var a = r.updateQueue;
    if (a = a !== null ? a.lastEffect : null, a !== null) {
      var u = a = a.next;
      do {
        if ((u.tag & t) === t) {
          var d = u.destroy;
          u.destroy = void 0, d !== void 0 && Nu(r, s, d);
        }
        u = u.next;
      } while (u !== a);
    }
  }
  function ea(t, r) {
    if (r = r.updateQueue, r = r !== null ? r.lastEffect : null, r !== null) {
      var s = r = r.next;
      do {
        if ((s.tag & t) === t) {
          var a = s.create;
          s.destroy = a();
        }
        s = s.next;
      } while (s !== r);
    }
  }
  function Iu(t) {
    var r = t.ref;
    if (r !== null) {
      var s = t.stateNode;
      t.tag, t = s, typeof r == "function" ? r(t) : r.current = t;
    }
  }
  function _m(t) {
    var r = t.alternate;
    r !== null && (t.alternate = null, _m(r)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (r = t.stateNode, r !== null && (delete r[Cr], delete r[hs], delete r[Yc], delete r[xS], delete r[CS])), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
  }
  function Pm(t) {
    return t.tag === 5 || t.tag === 3 || t.tag === 4;
  }
  function Rm(t) {
    e: for (; ; ) {
      for (; t.sibling === null; ) {
        if (t.return === null || Pm(t.return)) return null;
        t = t.return;
      }
      for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
        if (t.flags & 2 || t.child === null || t.tag === 4) continue e;
        t.child.return = t, t = t.child;
      }
      if (!(t.flags & 2)) return t.stateNode;
    }
  }
  function Fu(t, r, s) {
    var a = t.tag;
    if (a === 5 || a === 6) t = t.stateNode, r ? s.nodeType === 8 ? s.parentNode.insertBefore(t, r) : s.insertBefore(t, r) : (s.nodeType === 8 ? (r = s.parentNode, r.insertBefore(t, s)) : (r = s, r.appendChild(t)), s = s._reactRootContainer, s != null || r.onclick !== null || (r.onclick = Tl));
    else if (a !== 4 && (t = t.child, t !== null)) for (Fu(t, r, s), t = t.sibling; t !== null; ) Fu(t, r, s), t = t.sibling;
  }
  function zu(t, r, s) {
    var a = t.tag;
    if (a === 5 || a === 6) t = t.stateNode, r ? s.insertBefore(t, r) : s.appendChild(t);
    else if (a !== 4 && (t = t.child, t !== null)) for (zu(t, r, s), t = t.sibling; t !== null; ) zu(t, r, s), t = t.sibling;
  }
  var Gt = null, cr = !1;
  function co(t, r, s) {
    for (s = s.child; s !== null; ) km(t, r, s), s = s.sibling;
  }
  function km(t, r, s) {
    if (at && typeof at.onCommitFiberUnmount == "function") try {
      at.onCommitFiberUnmount(gn, s);
    } catch {
    }
    switch (s.tag) {
      case 5:
        sn || wi(s, r);
      case 6:
        var a = Gt, u = cr;
        Gt = null, co(t, r, s), Gt = a, cr = u, Gt !== null && (cr ? (t = Gt, s = s.stateNode, t.nodeType === 8 ? t.parentNode.removeChild(s) : t.removeChild(s)) : Gt.removeChild(s.stateNode));
        break;
      case 18:
        Gt !== null && (cr ? (t = Gt, s = s.stateNode, t.nodeType === 8 ? Gc(t.parentNode, s) : t.nodeType === 1 && Gc(t, s), rs(t)) : Gc(Gt, s.stateNode));
        break;
      case 4:
        a = Gt, u = cr, Gt = s.stateNode.containerInfo, cr = !0, co(t, r, s), Gt = a, cr = u;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        if (!sn && (a = s.updateQueue, a !== null && (a = a.lastEffect, a !== null))) {
          u = a = a.next;
          do {
            var d = u, w = d.destroy;
            d = d.tag, w !== void 0 && ((d & 2) !== 0 || (d & 4) !== 0) && Nu(s, r, w), u = u.next;
          } while (u !== a);
        }
        co(t, r, s);
        break;
      case 1:
        if (!sn && (wi(s, r), a = s.stateNode, typeof a.componentWillUnmount == "function")) try {
          a.props = s.memoizedProps, a.state = s.memoizedState, a.componentWillUnmount();
        } catch (_) {
          vt(s, r, _);
        }
        co(t, r, s);
        break;
      case 21:
        co(t, r, s);
        break;
      case 22:
        s.mode & 1 ? (sn = (a = sn) || s.memoizedState !== null, co(t, r, s), sn = a) : co(t, r, s);
        break;
      default:
        co(t, r, s);
    }
  }
  function Mm(t) {
    var r = t.updateQueue;
    if (r !== null) {
      t.updateQueue = null;
      var s = t.stateNode;
      s === null && (s = t.stateNode = new LS()), r.forEach(function(a) {
        var u = GS.bind(null, t, a);
        s.has(a) || (s.add(a), a.then(u, u));
      });
    }
  }
  function ur(t, r) {
    var s = r.deletions;
    if (s !== null) for (var a = 0; a < s.length; a++) {
      var u = s[a];
      try {
        var d = t, w = r, _ = w;
        e: for (; _ !== null; ) {
          switch (_.tag) {
            case 5:
              Gt = _.stateNode, cr = !1;
              break e;
            case 3:
              Gt = _.stateNode.containerInfo, cr = !0;
              break e;
            case 4:
              Gt = _.stateNode.containerInfo, cr = !0;
              break e;
          }
          _ = _.return;
        }
        if (Gt === null) throw Error(o(160));
        km(d, w, u), Gt = null, cr = !1;
        var N = u.alternate;
        N !== null && (N.return = null), u.return = null;
      } catch (H) {
        vt(u, r, H);
      }
    }
    if (r.subtreeFlags & 12854) for (r = r.child; r !== null; ) Tm(r, t), r = r.sibling;
  }
  function Tm(t, r) {
    var s = t.alternate, a = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        if (ur(r, t), $r(t), a & 4) {
          try {
            $s(3, t, t.return), ea(3, t);
          } catch (ve) {
            vt(t, t.return, ve);
          }
          try {
            $s(5, t, t.return);
          } catch (ve) {
            vt(t, t.return, ve);
          }
        }
        break;
      case 1:
        ur(r, t), $r(t), a & 512 && s !== null && wi(s, s.return);
        break;
      case 5:
        if (ur(r, t), $r(t), a & 512 && s !== null && wi(s, s.return), t.flags & 32) {
          var u = t.stateNode;
          try {
            mt(u, "");
          } catch (ve) {
            vt(t, t.return, ve);
          }
        }
        if (a & 4 && (u = t.stateNode, u != null)) {
          var d = t.memoizedProps, w = s !== null ? s.memoizedProps : d, _ = t.type, N = t.updateQueue;
          if (t.updateQueue = null, N !== null) try {
            _ === "input" && d.type === "radio" && d.name != null && Xe(u, d), Ge(_, w);
            var H = Ge(_, d);
            for (w = 0; w < N.length; w += 2) {
              var U = N[w], K = N[w + 1];
              U === "style" ? Ve(u, K) : U === "dangerouslySetInnerHTML" ? kt(u, K) : U === "children" ? mt(u, K) : P(u, U, K, H);
            }
            switch (_) {
              case "input":
                ut(u, d);
                break;
              case "textarea":
                ft(u, d);
                break;
              case "select":
                var W = u._wrapperState.wasMultiple;
                u._wrapperState.wasMultiple = !!d.multiple;
                var pe = d.value;
                pe != null ? tt(u, !!d.multiple, pe, !1) : W !== !!d.multiple && (d.defaultValue != null ? tt(
                  u,
                  !!d.multiple,
                  d.defaultValue,
                  !0
                ) : tt(u, !!d.multiple, d.multiple ? [] : "", !1));
            }
            u[hs] = d;
          } catch (ve) {
            vt(t, t.return, ve);
          }
        }
        break;
      case 6:
        if (ur(r, t), $r(t), a & 4) {
          if (t.stateNode === null) throw Error(o(162));
          u = t.stateNode, d = t.memoizedProps;
          try {
            u.nodeValue = d;
          } catch (ve) {
            vt(t, t.return, ve);
          }
        }
        break;
      case 3:
        if (ur(r, t), $r(t), a & 4 && s !== null && s.memoizedState.isDehydrated) try {
          rs(r.containerInfo);
        } catch (ve) {
          vt(t, t.return, ve);
        }
        break;
      case 4:
        ur(r, t), $r(t);
        break;
      case 13:
        ur(r, t), $r(t), u = t.child, u.flags & 8192 && (d = u.memoizedState !== null, u.stateNode.isHidden = d, !d || u.alternate !== null && u.alternate.memoizedState !== null || (Lu = Be())), a & 4 && Mm(t);
        break;
      case 22:
        if (U = s !== null && s.memoizedState !== null, t.mode & 1 ? (sn = (H = sn) || U, ur(r, t), sn = H) : ur(r, t), $r(t), a & 8192) {
          if (H = t.memoizedState !== null, (t.stateNode.isHidden = H) && !U && (t.mode & 1) !== 0) for (me = t, U = t.child; U !== null; ) {
            for (K = me = U; me !== null; ) {
              switch (W = me, pe = W.child, W.tag) {
                case 0:
                case 11:
                case 14:
                case 15:
                  $s(4, W, W.return);
                  break;
                case 1:
                  wi(W, W.return);
                  var ge = W.stateNode;
                  if (typeof ge.componentWillUnmount == "function") {
                    a = W, s = W.return;
                    try {
                      r = a, ge.props = r.memoizedProps, ge.state = r.memoizedState, ge.componentWillUnmount();
                    } catch (ve) {
                      vt(a, s, ve);
                    }
                  }
                  break;
                case 5:
                  wi(W, W.return);
                  break;
                case 22:
                  if (W.memoizedState !== null) {
                    Fm(K);
                    continue;
                  }
              }
              pe !== null ? (pe.return = W, me = pe) : Fm(K);
            }
            U = U.sibling;
          }
          e: for (U = null, K = t; ; ) {
            if (K.tag === 5) {
              if (U === null) {
                U = K;
                try {
                  u = K.stateNode, H ? (d = u.style, typeof d.setProperty == "function" ? d.setProperty("display", "none", "important") : d.display = "none") : (_ = K.stateNode, N = K.memoizedProps.style, w = N != null && N.hasOwnProperty("display") ? N.display : null, _.style.display = Kt("display", w));
                } catch (ve) {
                  vt(t, t.return, ve);
                }
              }
            } else if (K.tag === 6) {
              if (U === null) try {
                K.stateNode.nodeValue = H ? "" : K.memoizedProps;
              } catch (ve) {
                vt(t, t.return, ve);
              }
            } else if ((K.tag !== 22 && K.tag !== 23 || K.memoizedState === null || K === t) && K.child !== null) {
              K.child.return = K, K = K.child;
              continue;
            }
            if (K === t) break e;
            for (; K.sibling === null; ) {
              if (K.return === null || K.return === t) break e;
              U === K && (U = null), K = K.return;
            }
            U === K && (U = null), K.sibling.return = K.return, K = K.sibling;
          }
        }
        break;
      case 19:
        ur(r, t), $r(t), a & 4 && Mm(t);
        break;
      case 21:
        break;
      default:
        ur(
          r,
          t
        ), $r(t);
    }
  }
  function $r(t) {
    var r = t.flags;
    if (r & 2) {
      try {
        e: {
          for (var s = t.return; s !== null; ) {
            if (Pm(s)) {
              var a = s;
              break e;
            }
            s = s.return;
          }
          throw Error(o(160));
        }
        switch (a.tag) {
          case 5:
            var u = a.stateNode;
            a.flags & 32 && (mt(u, ""), a.flags &= -33);
            var d = Rm(t);
            zu(t, d, u);
            break;
          case 3:
          case 4:
            var w = a.stateNode.containerInfo, _ = Rm(t);
            Fu(t, _, w);
            break;
          default:
            throw Error(o(161));
        }
      } catch (N) {
        vt(t, t.return, N);
      }
      t.flags &= -3;
    }
    r & 4096 && (t.flags &= -4097);
  }
  function HS(t, r, s) {
    me = t, Nm(t);
  }
  function Nm(t, r, s) {
    for (var a = (t.mode & 1) !== 0; me !== null; ) {
      var u = me, d = u.child;
      if (u.tag === 22 && a) {
        var w = u.memoizedState !== null || Jl;
        if (!w) {
          var _ = u.alternate, N = _ !== null && _.memoizedState !== null || sn;
          _ = Jl;
          var H = sn;
          if (Jl = w, (sn = N) && !H) for (me = u; me !== null; ) w = me, N = w.child, w.tag === 22 && w.memoizedState !== null ? zm(u) : N !== null ? (N.return = w, me = N) : zm(u);
          for (; d !== null; ) me = d, Nm(d), d = d.sibling;
          me = u, Jl = _, sn = H;
        }
        Im(t);
      } else (u.subtreeFlags & 8772) !== 0 && d !== null ? (d.return = u, me = d) : Im(t);
    }
  }
  function Im(t) {
    for (; me !== null; ) {
      var r = me;
      if ((r.flags & 8772) !== 0) {
        var s = r.alternate;
        try {
          if ((r.flags & 8772) !== 0) switch (r.tag) {
            case 0:
            case 11:
            case 15:
              sn || ea(5, r);
              break;
            case 1:
              var a = r.stateNode;
              if (r.flags & 4 && !sn) if (s === null) a.componentDidMount();
              else {
                var u = r.elementType === r.type ? s.memoizedProps : ar(r.type, s.memoizedProps);
                a.componentDidUpdate(u, s.memoizedState, a.__reactInternalSnapshotBeforeUpdate);
              }
              var d = r.updateQueue;
              d !== null && Fh(r, d, a);
              break;
            case 3:
              var w = r.updateQueue;
              if (w !== null) {
                if (s = null, r.child !== null) switch (r.child.tag) {
                  case 5:
                    s = r.child.stateNode;
                    break;
                  case 1:
                    s = r.child.stateNode;
                }
                Fh(r, w, s);
              }
              break;
            case 5:
              var _ = r.stateNode;
              if (s === null && r.flags & 4) {
                s = _;
                var N = r.memoizedProps;
                switch (r.type) {
                  case "button":
                  case "input":
                  case "select":
                  case "textarea":
                    N.autoFocus && s.focus();
                    break;
                  case "img":
                    N.src && (s.src = N.src);
                }
              }
              break;
            case 6:
              break;
            case 4:
              break;
            case 12:
              break;
            case 13:
              if (r.memoizedState === null) {
                var H = r.alternate;
                if (H !== null) {
                  var U = H.memoizedState;
                  if (U !== null) {
                    var K = U.dehydrated;
                    K !== null && rs(K);
                  }
                }
              }
              break;
            case 19:
            case 17:
            case 21:
            case 22:
            case 23:
            case 25:
              break;
            default:
              throw Error(o(163));
          }
          sn || r.flags & 512 && Iu(r);
        } catch (W) {
          vt(r, r.return, W);
        }
      }
      if (r === t) {
        me = null;
        break;
      }
      if (s = r.sibling, s !== null) {
        s.return = r.return, me = s;
        break;
      }
      me = r.return;
    }
  }
  function Fm(t) {
    for (; me !== null; ) {
      var r = me;
      if (r === t) {
        me = null;
        break;
      }
      var s = r.sibling;
      if (s !== null) {
        s.return = r.return, me = s;
        break;
      }
      me = r.return;
    }
  }
  function zm(t) {
    for (; me !== null; ) {
      var r = me;
      try {
        switch (r.tag) {
          case 0:
          case 11:
          case 15:
            var s = r.return;
            try {
              ea(4, r);
            } catch (N) {
              vt(r, s, N);
            }
            break;
          case 1:
            var a = r.stateNode;
            if (typeof a.componentDidMount == "function") {
              var u = r.return;
              try {
                a.componentDidMount();
              } catch (N) {
                vt(r, u, N);
              }
            }
            var d = r.return;
            try {
              Iu(r);
            } catch (N) {
              vt(r, d, N);
            }
            break;
          case 5:
            var w = r.return;
            try {
              Iu(r);
            } catch (N) {
              vt(r, w, N);
            }
        }
      } catch (N) {
        vt(r, r.return, N);
      }
      if (r === t) {
        me = null;
        break;
      }
      var _ = r.sibling;
      if (_ !== null) {
        _.return = r.return, me = _;
        break;
      }
      me = r.return;
    }
  }
  var DS = Math.ceil, ta = R.ReactCurrentDispatcher, Ou = R.ReactCurrentOwner, Un = R.ReactCurrentBatchConfig, Le = 0, Dt = null, Et = null, Yt = 0, Tn = 0, xi = oo(0), zt = 0, _s = null, No = 0, na = 0, Au = 0, Ps = null, wn = null, Lu = 0, Ci = 1 / 0, jr = null, ra = !1, Bu = null, uo = null, oa = !1, fo = null, ia = 0, Rs = 0, Hu = null, sa = -1, la = 0;
  function un() {
    return (Le & 6) !== 0 ? Be() : sa !== -1 ? sa : sa = Be();
  }
  function po(t) {
    return (t.mode & 1) === 0 ? 1 : (Le & 2) !== 0 && Yt !== 0 ? Yt & -Yt : ES.transition !== null ? (la === 0 && (la = ue()), la) : (t = He, t !== 0 || (t = window.event, t = t === void 0 ? 16 : Ap(t.type)), t);
  }
  function fr(t, r, s, a) {
    if (50 < Rs) throw Rs = 0, Hu = null, Error(o(185));
    xr(t, s, a), ((Le & 2) === 0 || t !== Dt) && (t === Dt && ((Le & 2) === 0 && (na |= s), zt === 4 && ho(t, Yt)), xn(t, a), s === 1 && Le === 0 && (r.mode & 1) === 0 && (Ci = Be() + 500, zl && so()));
  }
  function xn(t, r) {
    var s = t.callbackNode;
    Qi(t, r);
    var a = Eo(t, t === Dt ? Yt : 0);
    if (a === 0) s !== null && Kr(s), t.callbackNode = null, t.callbackPriority = 0;
    else if (r = a & -a, t.callbackPriority !== r) {
      if (s != null && Kr(s), r === 1) t.tag === 0 ? bS(Am.bind(null, t)) : Ch(Am.bind(null, t)), SS(function() {
        (Le & 6) === 0 && so();
      }), s = null;
      else {
        switch (gl(a)) {
          case 1:
            s = Hn;
            break;
          case 4:
            s = Mr;
            break;
          case 16:
            s = tn;
            break;
          case 536870912:
            s = Dn;
            break;
          default:
            s = tn;
        }
        s = qm(s, Om.bind(null, t));
      }
      t.callbackPriority = r, t.callbackNode = s;
    }
  }
  function Om(t, r) {
    if (sa = -1, la = 0, (Le & 6) !== 0) throw Error(o(327));
    var s = t.callbackNode;
    if (bi() && t.callbackNode !== s) return null;
    var a = Eo(t, t === Dt ? Yt : 0);
    if (a === 0) return null;
    if ((a & 30) !== 0 || (a & t.expiredLanes) !== 0 || r) r = aa(t, a);
    else {
      r = a;
      var u = Le;
      Le |= 2;
      var d = Bm();
      (Dt !== t || Yt !== r) && (jr = null, Ci = Be() + 500, Fo(t, r));
      do
        try {
          WS();
          break;
        } catch (_) {
          Lm(t, _);
        }
      while (!0);
      ou(), ta.current = d, Le = u, Et !== null ? r = 0 : (Dt = null, Yt = 0, r = zt);
    }
    if (r !== 0) {
      if (r === 2 && (u = Zi(t), u !== 0 && (a = u, r = Du(t, u))), r === 1) throw s = _s, Fo(t, 0), ho(t, a), xn(t, Be()), s;
      if (r === 6) ho(t, a);
      else {
        if (u = t.current.alternate, (a & 30) === 0 && !jS(u) && (r = aa(t, a), r === 2 && (d = Zi(t), d !== 0 && (a = d, r = Du(t, d))), r === 1)) throw s = _s, Fo(t, 0), ho(t, a), xn(t, Be()), s;
        switch (t.finishedWork = u, t.finishedLanes = a, r) {
          case 0:
          case 1:
            throw Error(o(345));
          case 2:
            zo(t, wn, jr);
            break;
          case 3:
            if (ho(t, a), (a & 130023424) === a && (r = Lu + 500 - Be(), 10 < r)) {
              if (Eo(t, 0) !== 0) break;
              if (u = t.suspendedLanes, (u & a) !== a) {
                un(), t.pingedLanes |= t.suspendedLanes & u;
                break;
              }
              t.timeoutHandle = Xc(zo.bind(null, t, wn, jr), r);
              break;
            }
            zo(t, wn, jr);
            break;
          case 4:
            if (ho(t, a), (a & 4194240) === a) break;
            for (r = t.eventTimes, u = -1; 0 < a; ) {
              var w = 31 - et(a);
              d = 1 << w, w = r[w], w > u && (u = w), a &= ~d;
            }
            if (a = u, a = Be() - a, a = (120 > a ? 120 : 480 > a ? 480 : 1080 > a ? 1080 : 1920 > a ? 1920 : 3e3 > a ? 3e3 : 4320 > a ? 4320 : 1960 * DS(a / 1960)) - a, 10 < a) {
              t.timeoutHandle = Xc(zo.bind(null, t, wn, jr), a);
              break;
            }
            zo(t, wn, jr);
            break;
          case 5:
            zo(t, wn, jr);
            break;
          default:
            throw Error(o(329));
        }
      }
    }
    return xn(t, Be()), t.callbackNode === s ? Om.bind(null, t) : null;
  }
  function Du(t, r) {
    var s = Ps;
    return t.current.memoizedState.isDehydrated && (Fo(t, r).flags |= 256), t = aa(t, r), t !== 2 && (r = wn, wn = s, r !== null && ju(r)), t;
  }
  function ju(t) {
    wn === null ? wn = t : wn.push.apply(wn, t);
  }
  function jS(t) {
    for (var r = t; ; ) {
      if (r.flags & 16384) {
        var s = r.updateQueue;
        if (s !== null && (s = s.stores, s !== null)) for (var a = 0; a < s.length; a++) {
          var u = s[a], d = u.getSnapshot;
          u = u.value;
          try {
            if (!sr(d(), u)) return !1;
          } catch {
            return !1;
          }
        }
      }
      if (s = r.child, r.subtreeFlags & 16384 && s !== null) s.return = r, r = s;
      else {
        if (r === t) break;
        for (; r.sibling === null; ) {
          if (r.return === null || r.return === t) return !0;
          r = r.return;
        }
        r.sibling.return = r.return, r = r.sibling;
      }
    }
    return !0;
  }
  function ho(t, r) {
    for (r &= ~Au, r &= ~na, t.suspendedLanes |= r, t.pingedLanes &= ~r, t = t.expirationTimes; 0 < r; ) {
      var s = 31 - et(r), a = 1 << s;
      t[s] = -1, r &= ~a;
    }
  }
  function Am(t) {
    if ((Le & 6) !== 0) throw Error(o(327));
    bi();
    var r = Eo(t, 0);
    if ((r & 1) === 0) return xn(t, Be()), null;
    var s = aa(t, r);
    if (t.tag !== 0 && s === 2) {
      var a = Zi(t);
      a !== 0 && (r = a, s = Du(t, a));
    }
    if (s === 1) throw s = _s, Fo(t, 0), ho(t, r), xn(t, Be()), s;
    if (s === 6) throw Error(o(345));
    return t.finishedWork = t.current.alternate, t.finishedLanes = r, zo(t, wn, jr), xn(t, Be()), null;
  }
  function Vu(t, r) {
    var s = Le;
    Le |= 1;
    try {
      return t(r);
    } finally {
      Le = s, Le === 0 && (Ci = Be() + 500, zl && so());
    }
  }
  function Io(t) {
    fo !== null && fo.tag === 0 && (Le & 6) === 0 && bi();
    var r = Le;
    Le |= 1;
    var s = Un.transition, a = He;
    try {
      if (Un.transition = null, He = 1, t) return t();
    } finally {
      He = a, Un.transition = s, Le = r, (Le & 6) === 0 && so();
    }
  }
  function Wu() {
    Tn = xi.current, st(xi);
  }
  function Fo(t, r) {
    t.finishedWork = null, t.finishedLanes = 0;
    var s = t.timeoutHandle;
    if (s !== -1 && (t.timeoutHandle = -1, vS(s)), Et !== null) for (s = Et.return; s !== null; ) {
      var a = s;
      switch (Jc(a), a.tag) {
        case 1:
          a = a.type.childContextTypes, a != null && Il();
          break;
        case 3:
          vi(), st(yn), st(nn), du();
          break;
        case 5:
          uu(a);
          break;
        case 4:
          vi();
          break;
        case 13:
          st(pt);
          break;
        case 19:
          st(pt);
          break;
        case 10:
          iu(a.type._context);
          break;
        case 22:
        case 23:
          Wu();
      }
      s = s.return;
    }
    if (Dt = t, Et = t = mo(t.current, null), Yt = Tn = r, zt = 0, _s = null, Au = na = No = 0, wn = Ps = null, ko !== null) {
      for (r = 0; r < ko.length; r++) if (s = ko[r], a = s.interleaved, a !== null) {
        s.interleaved = null;
        var u = a.next, d = s.pending;
        if (d !== null) {
          var w = d.next;
          d.next = u, a.next = w;
        }
        s.pending = a;
      }
      ko = null;
    }
    return t;
  }
  function Lm(t, r) {
    do {
      var s = Et;
      try {
        if (ou(), ql.current = Yl, Ul) {
          for (var a = ht.memoizedState; a !== null; ) {
            var u = a.queue;
            u !== null && (u.pending = null), a = a.next;
          }
          Ul = !1;
        }
        if (To = 0, Ht = Ft = ht = null, ws = !1, xs = 0, Ou.current = null, s === null || s.return === null) {
          zt = 1, _s = r, Et = null;
          break;
        }
        e: {
          var d = t, w = s.return, _ = s, N = r;
          if (r = Yt, _.flags |= 32768, N !== null && typeof N == "object" && typeof N.then == "function") {
            var H = N, U = _, K = U.tag;
            if ((U.mode & 1) === 0 && (K === 0 || K === 11 || K === 15)) {
              var W = U.alternate;
              W ? (U.updateQueue = W.updateQueue, U.memoizedState = W.memoizedState, U.lanes = W.lanes) : (U.updateQueue = null, U.memoizedState = null);
            }
            var pe = cm(w);
            if (pe !== null) {
              pe.flags &= -257, um(pe, w, _, d, r), pe.mode & 1 && am(d, H, r), r = pe, N = H;
              var ge = r.updateQueue;
              if (ge === null) {
                var ve = /* @__PURE__ */ new Set();
                ve.add(N), r.updateQueue = ve;
              } else ge.add(N);
              break e;
            } else {
              if ((r & 1) === 0) {
                am(d, H, r), qu();
                break e;
              }
              N = Error(o(426));
            }
          } else if (ct && _.mode & 1) {
            var Ct = cm(w);
            if (Ct !== null) {
              (Ct.flags & 65536) === 0 && (Ct.flags |= 256), um(Ct, w, _, d, r), nu(Si(N, _));
              break e;
            }
          }
          d = N = Si(N, _), zt !== 4 && (zt = 2), Ps === null ? Ps = [d] : Ps.push(d), d = w;
          do {
            switch (d.tag) {
              case 3:
                d.flags |= 65536, r &= -r, d.lanes |= r;
                var L = sm(d, N, r);
                Ih(d, L);
                break e;
              case 1:
                _ = N;
                var F = d.type, B = d.stateNode;
                if ((d.flags & 128) === 0 && (typeof F.getDerivedStateFromError == "function" || B !== null && typeof B.componentDidCatch == "function" && (uo === null || !uo.has(B)))) {
                  d.flags |= 65536, r &= -r, d.lanes |= r;
                  var ne = lm(d, _, r);
                  Ih(d, ne);
                  break e;
                }
            }
            d = d.return;
          } while (d !== null);
        }
        Dm(s);
      } catch (Se) {
        r = Se, Et === s && s !== null && (Et = s = s.return);
        continue;
      }
      break;
    } while (!0);
  }
  function Bm() {
    var t = ta.current;
    return ta.current = Yl, t === null ? Yl : t;
  }
  function qu() {
    (zt === 0 || zt === 3 || zt === 2) && (zt = 4), Dt === null || (No & 268435455) === 0 && (na & 268435455) === 0 || ho(Dt, Yt);
  }
  function aa(t, r) {
    var s = Le;
    Le |= 2;
    var a = Bm();
    (Dt !== t || Yt !== r) && (jr = null, Fo(t, r));
    do
      try {
        VS();
        break;
      } catch (u) {
        Lm(t, u);
      }
    while (!0);
    if (ou(), Le = s, ta.current = a, Et !== null) throw Error(o(261));
    return Dt = null, Yt = 0, zt;
  }
  function VS() {
    for (; Et !== null; ) Hm(Et);
  }
  function WS() {
    for (; Et !== null && !dt(); ) Hm(Et);
  }
  function Hm(t) {
    var r = Wm(t.alternate, t, Tn);
    t.memoizedProps = t.pendingProps, r === null ? Dm(t) : Et = r, Ou.current = null;
  }
  function Dm(t) {
    var r = t;
    do {
      var s = r.alternate;
      if (t = r.return, (r.flags & 32768) === 0) {
        if (s = OS(s, r, Tn), s !== null) {
          Et = s;
          return;
        }
      } else {
        if (s = AS(s, r), s !== null) {
          s.flags &= 32767, Et = s;
          return;
        }
        if (t !== null) t.flags |= 32768, t.subtreeFlags = 0, t.deletions = null;
        else {
          zt = 6, Et = null;
          return;
        }
      }
      if (r = r.sibling, r !== null) {
        Et = r;
        return;
      }
      Et = r = t;
    } while (r !== null);
    zt === 0 && (zt = 5);
  }
  function zo(t, r, s) {
    var a = He, u = Un.transition;
    try {
      Un.transition = null, He = 1, qS(t, r, s, a);
    } finally {
      Un.transition = u, He = a;
    }
    return null;
  }
  function qS(t, r, s, a) {
    do
      bi();
    while (fo !== null);
    if ((Le & 6) !== 0) throw Error(o(327));
    s = t.finishedWork;
    var u = t.finishedLanes;
    if (s === null) return null;
    if (t.finishedWork = null, t.finishedLanes = 0, s === t.current) throw Error(o(177));
    t.callbackNode = null, t.callbackPriority = 0;
    var d = s.lanes | s.childLanes;
    if (Cc(t, d), t === Dt && (Et = Dt = null, Yt = 0), (s.subtreeFlags & 2064) === 0 && (s.flags & 2064) === 0 || oa || (oa = !0, qm(tn, function() {
      return bi(), null;
    })), d = (s.flags & 15990) !== 0, (s.subtreeFlags & 15990) !== 0 || d) {
      d = Un.transition, Un.transition = null;
      var w = He;
      He = 1;
      var _ = Le;
      Le |= 4, Ou.current = null, BS(t, s), Tm(s, t), fS(qc), Sl = !!Wc, qc = Wc = null, t.current = s, HS(s), en(), Le = _, He = w, Un.transition = d;
    } else t.current = s;
    if (oa && (oa = !1, fo = t, ia = u), d = t.pendingLanes, d === 0 && (uo = null), Re(s.stateNode), xn(t, Be()), r !== null) for (a = t.onRecoverableError, s = 0; s < r.length; s++) u = r[s], a(u.value, { componentStack: u.stack, digest: u.digest });
    if (ra) throw ra = !1, t = Bu, Bu = null, t;
    return (ia & 1) !== 0 && t.tag !== 0 && bi(), d = t.pendingLanes, (d & 1) !== 0 ? t === Hu ? Rs++ : (Rs = 0, Hu = t) : Rs = 0, so(), null;
  }
  function bi() {
    if (fo !== null) {
      var t = gl(ia), r = Un.transition, s = He;
      try {
        if (Un.transition = null, He = 16 > t ? 16 : t, fo === null) var a = !1;
        else {
          if (t = fo, fo = null, ia = 0, (Le & 6) !== 0) throw Error(o(331));
          var u = Le;
          for (Le |= 4, me = t.current; me !== null; ) {
            var d = me, w = d.child;
            if ((me.flags & 16) !== 0) {
              var _ = d.deletions;
              if (_ !== null) {
                for (var N = 0; N < _.length; N++) {
                  var H = _[N];
                  for (me = H; me !== null; ) {
                    var U = me;
                    switch (U.tag) {
                      case 0:
                      case 11:
                      case 15:
                        $s(8, U, d);
                    }
                    var K = U.child;
                    if (K !== null) K.return = U, me = K;
                    else for (; me !== null; ) {
                      U = me;
                      var W = U.sibling, pe = U.return;
                      if (_m(U), U === H) {
                        me = null;
                        break;
                      }
                      if (W !== null) {
                        W.return = pe, me = W;
                        break;
                      }
                      me = pe;
                    }
                  }
                }
                var ge = d.alternate;
                if (ge !== null) {
                  var ve = ge.child;
                  if (ve !== null) {
                    ge.child = null;
                    do {
                      var Ct = ve.sibling;
                      ve.sibling = null, ve = Ct;
                    } while (ve !== null);
                  }
                }
                me = d;
              }
            }
            if ((d.subtreeFlags & 2064) !== 0 && w !== null) w.return = d, me = w;
            else e: for (; me !== null; ) {
              if (d = me, (d.flags & 2048) !== 0) switch (d.tag) {
                case 0:
                case 11:
                case 15:
                  $s(9, d, d.return);
              }
              var L = d.sibling;
              if (L !== null) {
                L.return = d.return, me = L;
                break e;
              }
              me = d.return;
            }
          }
          var F = t.current;
          for (me = F; me !== null; ) {
            w = me;
            var B = w.child;
            if ((w.subtreeFlags & 2064) !== 0 && B !== null) B.return = w, me = B;
            else e: for (w = F; me !== null; ) {
              if (_ = me, (_.flags & 2048) !== 0) try {
                switch (_.tag) {
                  case 0:
                  case 11:
                  case 15:
                    ea(9, _);
                }
              } catch (Se) {
                vt(_, _.return, Se);
              }
              if (_ === w) {
                me = null;
                break e;
              }
              var ne = _.sibling;
              if (ne !== null) {
                ne.return = _.return, me = ne;
                break e;
              }
              me = _.return;
            }
          }
          if (Le = u, so(), at && typeof at.onPostCommitFiberRoot == "function") try {
            at.onPostCommitFiberRoot(gn, t);
          } catch {
          }
          a = !0;
        }
        return a;
      } finally {
        He = s, Un.transition = r;
      }
    }
    return !1;
  }
  function jm(t, r, s) {
    r = Si(s, r), r = sm(t, r, 1), t = ao(t, r, 1), r = un(), t !== null && (xr(t, 1, r), xn(t, r));
  }
  function vt(t, r, s) {
    if (t.tag === 3) jm(t, t, s);
    else for (; r !== null; ) {
      if (r.tag === 3) {
        jm(r, t, s);
        break;
      } else if (r.tag === 1) {
        var a = r.stateNode;
        if (typeof r.type.getDerivedStateFromError == "function" || typeof a.componentDidCatch == "function" && (uo === null || !uo.has(a))) {
          t = Si(s, t), t = lm(r, t, 1), r = ao(r, t, 1), t = un(), r !== null && (xr(r, 1, t), xn(r, t));
          break;
        }
      }
      r = r.return;
    }
  }
  function US(t, r, s) {
    var a = t.pingCache;
    a !== null && a.delete(r), r = un(), t.pingedLanes |= t.suspendedLanes & s, Dt === t && (Yt & s) === s && (zt === 4 || zt === 3 && (Yt & 130023424) === Yt && 500 > Be() - Lu ? Fo(t, 0) : Au |= s), xn(t, r);
  }
  function Vm(t, r) {
    r === 0 && ((t.mode & 1) === 0 ? r = 1 : (r = Fr, Fr <<= 1, (Fr & 130023424) === 0 && (Fr = 4194304)));
    var s = un();
    t = Br(t, r), t !== null && (xr(t, r, s), xn(t, s));
  }
  function XS(t) {
    var r = t.memoizedState, s = 0;
    r !== null && (s = r.retryLane), Vm(t, s);
  }
  function GS(t, r) {
    var s = 0;
    switch (t.tag) {
      case 13:
        var a = t.stateNode, u = t.memoizedState;
        u !== null && (s = u.retryLane);
        break;
      case 19:
        a = t.stateNode;
        break;
      default:
        throw Error(o(314));
    }
    a !== null && a.delete(r), Vm(t, s);
  }
  var Wm;
  Wm = function(t, r, s) {
    if (t !== null) if (t.memoizedProps !== r.pendingProps || yn.current) Sn = !0;
    else {
      if ((t.lanes & s) === 0 && (r.flags & 128) === 0) return Sn = !1, zS(t, r, s);
      Sn = (t.flags & 131072) !== 0;
    }
    else Sn = !1, ct && (r.flags & 1048576) !== 0 && bh(r, Al, r.index);
    switch (r.lanes = 0, r.tag) {
      case 2:
        var a = r.type;
        Zl(t, r), t = r.pendingProps;
        var u = fi(r, nn.current);
        yi(r, s), u = mu(null, r, a, t, u, s);
        var d = gu();
        return r.flags |= 1, typeof u == "object" && u !== null && typeof u.render == "function" && u.$$typeof === void 0 ? (r.tag = 1, r.memoizedState = null, r.updateQueue = null, vn(a) ? (d = !0, Fl(r)) : d = !1, r.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, au(r), u.updater = Kl, r.stateNode = u, u._reactInternals = r, Cu(r, a, t, s), r = _u(null, r, a, !0, d, s)) : (r.tag = 0, ct && d && Zc(r), cn(null, r, u, s), r = r.child), r;
      case 16:
        a = r.elementType;
        e: {
          switch (Zl(t, r), t = r.pendingProps, u = a._init, a = u(a._payload), r.type = a, u = r.tag = KS(a), t = ar(a, t), u) {
            case 0:
              r = $u(null, r, a, t, s);
              break e;
            case 1:
              r = gm(null, r, a, t, s);
              break e;
            case 11:
              r = fm(null, r, a, t, s);
              break e;
            case 14:
              r = dm(null, r, a, ar(a.type, t), s);
              break e;
          }
          throw Error(o(
            306,
            a,
            ""
          ));
        }
        return r;
      case 0:
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : ar(a, u), $u(t, r, a, u, s);
      case 1:
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : ar(a, u), gm(t, r, a, u, s);
      case 3:
        e: {
          if (ym(r), t === null) throw Error(o(387));
          a = r.pendingProps, d = r.memoizedState, u = d.element, Nh(t, r), Vl(r, a, null, s);
          var w = r.memoizedState;
          if (a = w.element, d.isDehydrated) if (d = { element: a, isDehydrated: !1, cache: w.cache, pendingSuspenseBoundaries: w.pendingSuspenseBoundaries, transitions: w.transitions }, r.updateQueue.baseState = d, r.memoizedState = d, r.flags & 256) {
            u = Si(Error(o(423)), r), r = vm(t, r, a, s, u);
            break e;
          } else if (a !== u) {
            u = Si(Error(o(424)), r), r = vm(t, r, a, s, u);
            break e;
          } else for (Mn = ro(r.stateNode.containerInfo.firstChild), kn = r, ct = !0, lr = null, s = Mh(r, null, a, s), r.child = s; s; ) s.flags = s.flags & -3 | 4096, s = s.sibling;
          else {
            if (hi(), a === u) {
              r = Dr(t, r, s);
              break e;
            }
            cn(t, r, a, s);
          }
          r = r.child;
        }
        return r;
      case 5:
        return zh(r), t === null && tu(r), a = r.type, u = r.pendingProps, d = t !== null ? t.memoizedProps : null, w = u.children, Uc(a, u) ? w = null : d !== null && Uc(a, d) && (r.flags |= 32), mm(t, r), cn(t, r, w, s), r.child;
      case 6:
        return t === null && tu(r), null;
      case 13:
        return Sm(t, r, s);
      case 4:
        return cu(r, r.stateNode.containerInfo), a = r.pendingProps, t === null ? r.child = mi(r, null, a, s) : cn(t, r, a, s), r.child;
      case 11:
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : ar(a, u), fm(t, r, a, u, s);
      case 7:
        return cn(t, r, r.pendingProps, s), r.child;
      case 8:
        return cn(t, r, r.pendingProps.children, s), r.child;
      case 12:
        return cn(t, r, r.pendingProps.children, s), r.child;
      case 10:
        e: {
          if (a = r.type._context, u = r.pendingProps, d = r.memoizedProps, w = u.value, ot(Hl, a._currentValue), a._currentValue = w, d !== null) if (sr(d.value, w)) {
            if (d.children === u.children && !yn.current) {
              r = Dr(t, r, s);
              break e;
            }
          } else for (d = r.child, d !== null && (d.return = r); d !== null; ) {
            var _ = d.dependencies;
            if (_ !== null) {
              w = d.child;
              for (var N = _.firstContext; N !== null; ) {
                if (N.context === a) {
                  if (d.tag === 1) {
                    N = Hr(-1, s & -s), N.tag = 2;
                    var H = d.updateQueue;
                    if (H !== null) {
                      H = H.shared;
                      var U = H.pending;
                      U === null ? N.next = N : (N.next = U.next, U.next = N), H.pending = N;
                    }
                  }
                  d.lanes |= s, N = d.alternate, N !== null && (N.lanes |= s), su(
                    d.return,
                    s,
                    r
                  ), _.lanes |= s;
                  break;
                }
                N = N.next;
              }
            } else if (d.tag === 10) w = d.type === r.type ? null : d.child;
            else if (d.tag === 18) {
              if (w = d.return, w === null) throw Error(o(341));
              w.lanes |= s, _ = w.alternate, _ !== null && (_.lanes |= s), su(w, s, r), w = d.sibling;
            } else w = d.child;
            if (w !== null) w.return = d;
            else for (w = d; w !== null; ) {
              if (w === r) {
                w = null;
                break;
              }
              if (d = w.sibling, d !== null) {
                d.return = w.return, w = d;
                break;
              }
              w = w.return;
            }
            d = w;
          }
          cn(t, r, u.children, s), r = r.child;
        }
        return r;
      case 9:
        return u = r.type, a = r.pendingProps.children, yi(r, s), u = Wn(u), a = a(u), r.flags |= 1, cn(t, r, a, s), r.child;
      case 14:
        return a = r.type, u = ar(a, r.pendingProps), u = ar(a.type, u), dm(t, r, a, u, s);
      case 15:
        return pm(t, r, r.type, r.pendingProps, s);
      case 17:
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : ar(a, u), Zl(t, r), r.tag = 1, vn(a) ? (t = !0, Fl(r)) : t = !1, yi(r, s), om(r, a, u), Cu(r, a, u, s), _u(null, r, a, !0, t, s);
      case 19:
        return xm(t, r, s);
      case 22:
        return hm(t, r, s);
    }
    throw Error(o(156, r.tag));
  };
  function qm(t, r) {
    return Sr(t, r);
  }
  function YS(t, r, s, a) {
    this.tag = t, this.key = s, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.ref = null, this.pendingProps = r, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = a, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function Xn(t, r, s, a) {
    return new YS(t, r, s, a);
  }
  function Uu(t) {
    return t = t.prototype, !(!t || !t.isReactComponent);
  }
  function KS(t) {
    if (typeof t == "function") return Uu(t) ? 1 : 0;
    if (t != null) {
      if (t = t.$$typeof, t === X) return 11;
      if (t === G) return 14;
    }
    return 2;
  }
  function mo(t, r) {
    var s = t.alternate;
    return s === null ? (s = Xn(t.tag, r, t.key, t.mode), s.elementType = t.elementType, s.type = t.type, s.stateNode = t.stateNode, s.alternate = t, t.alternate = s) : (s.pendingProps = r, s.type = t.type, s.flags = 0, s.subtreeFlags = 0, s.deletions = null), s.flags = t.flags & 14680064, s.childLanes = t.childLanes, s.lanes = t.lanes, s.child = t.child, s.memoizedProps = t.memoizedProps, s.memoizedState = t.memoizedState, s.updateQueue = t.updateQueue, r = t.dependencies, s.dependencies = r === null ? null : { lanes: r.lanes, firstContext: r.firstContext }, s.sibling = t.sibling, s.index = t.index, s.ref = t.ref, s;
  }
  function ca(t, r, s, a, u, d) {
    var w = 2;
    if (a = t, typeof t == "function") Uu(t) && (w = 1);
    else if (typeof t == "string") w = 5;
    else e: switch (t) {
      case z:
        return Oo(s.children, u, d, r);
      case O:
        w = 8, u |= 8;
        break;
      case j:
        return t = Xn(12, s, r, u | 2), t.elementType = j, t.lanes = d, t;
      case Q:
        return t = Xn(13, s, r, u), t.elementType = Q, t.lanes = d, t;
      case oe:
        return t = Xn(19, s, r, u), t.elementType = oe, t.lanes = d, t;
      case he:
        return ua(s, u, d, r);
      default:
        if (typeof t == "object" && t !== null) switch (t.$$typeof) {
          case Y:
            w = 10;
            break e;
          case V:
            w = 9;
            break e;
          case X:
            w = 11;
            break e;
          case G:
            w = 14;
            break e;
          case le:
            w = 16, a = null;
            break e;
        }
        throw Error(o(130, t == null ? t : typeof t, ""));
    }
    return r = Xn(w, s, r, u), r.elementType = t, r.type = a, r.lanes = d, r;
  }
  function Oo(t, r, s, a) {
    return t = Xn(7, t, a, r), t.lanes = s, t;
  }
  function ua(t, r, s, a) {
    return t = Xn(22, t, a, r), t.elementType = he, t.lanes = s, t.stateNode = { isHidden: !1 }, t;
  }
  function Xu(t, r, s) {
    return t = Xn(6, t, null, r), t.lanes = s, t;
  }
  function Gu(t, r, s) {
    return r = Xn(4, t.children !== null ? t.children : [], t.key, r), r.lanes = s, r.stateNode = { containerInfo: t.containerInfo, pendingChildren: null, implementation: t.implementation }, r;
  }
  function QS(t, r, s, a, u) {
    this.tag = r, this.containerInfo = t, this.finishedWork = this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.pendingContext = this.context = null, this.callbackPriority = 0, this.eventTimes = Fe(0), this.expirationTimes = Fe(-1), this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Fe(0), this.identifierPrefix = a, this.onRecoverableError = u, this.mutableSourceEagerHydrationData = null;
  }
  function Yu(t, r, s, a, u, d, w, _, N) {
    return t = new QS(t, r, s, _, N), r === 1 ? (r = 1, d === !0 && (r |= 8)) : r = 0, d = Xn(3, null, null, r), t.current = d, d.stateNode = t, d.memoizedState = { element: a, isDehydrated: s, cache: null, transitions: null, pendingSuspenseBoundaries: null }, au(d), t;
  }
  function ZS(t, r, s) {
    var a = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return { $$typeof: I, key: a == null ? null : "" + a, children: t, containerInfo: r, implementation: s };
  }
  function Um(t) {
    if (!t) return io;
    t = t._reactInternals;
    e: {
      if (yt(t) !== t || t.tag !== 1) throw Error(o(170));
      var r = t;
      do {
        switch (r.tag) {
          case 3:
            r = r.stateNode.context;
            break e;
          case 1:
            if (vn(r.type)) {
              r = r.stateNode.__reactInternalMemoizedMergedChildContext;
              break e;
            }
        }
        r = r.return;
      } while (r !== null);
      throw Error(o(171));
    }
    if (t.tag === 1) {
      var s = t.type;
      if (vn(s)) return wh(t, s, r);
    }
    return r;
  }
  function Xm(t, r, s, a, u, d, w, _, N) {
    return t = Yu(s, a, !0, t, u, d, w, _, N), t.context = Um(null), s = t.current, a = un(), u = po(s), d = Hr(a, u), d.callback = r ?? null, ao(s, d, u), t.current.lanes = u, xr(t, u, a), xn(t, a), t;
  }
  function fa(t, r, s, a) {
    var u = r.current, d = un(), w = po(u);
    return s = Um(s), r.context === null ? r.context = s : r.pendingContext = s, r = Hr(d, w), r.payload = { element: t }, a = a === void 0 ? null : a, a !== null && (r.callback = a), t = ao(u, r, w), t !== null && (fr(t, u, w, d), jl(t, u, w)), w;
  }
  function da(t) {
    return t = t.current, t.child ? (t.child.tag === 5, t.child.stateNode) : null;
  }
  function Gm(t, r) {
    if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
      var s = t.retryLane;
      t.retryLane = s !== 0 && s < r ? s : r;
    }
  }
  function Ku(t, r) {
    Gm(t, r), (t = t.alternate) && Gm(t, r);
  }
  function JS() {
    return null;
  }
  var Ym = typeof reportError == "function" ? reportError : function(t) {
    console.error(t);
  };
  function Qu(t) {
    this._internalRoot = t;
  }
  pa.prototype.render = Qu.prototype.render = function(t) {
    var r = this._internalRoot;
    if (r === null) throw Error(o(409));
    fa(t, r, null, null);
  }, pa.prototype.unmount = Qu.prototype.unmount = function() {
    var t = this._internalRoot;
    if (t !== null) {
      this._internalRoot = null;
      var r = t.containerInfo;
      Io(function() {
        fa(null, t, null, null);
      }), r[zr] = null;
    }
  };
  function pa(t) {
    this._internalRoot = t;
  }
  pa.prototype.unstable_scheduleHydration = function(t) {
    if (t) {
      var r = Np();
      t = { blockedOn: null, target: t, priority: r };
      for (var s = 0; s < eo.length && r !== 0 && r < eo[s].priority; s++) ;
      eo.splice(s, 0, t), s === 0 && zp(t);
    }
  };
  function Zu(t) {
    return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11);
  }
  function ha(t) {
    return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11 && (t.nodeType !== 8 || t.nodeValue !== " react-mount-point-unstable "));
  }
  function Km() {
  }
  function ew(t, r, s, a, u) {
    if (u) {
      if (typeof a == "function") {
        var d = a;
        a = function() {
          var H = da(w);
          d.call(H);
        };
      }
      var w = Xm(r, a, t, 0, null, !1, !1, "", Km);
      return t._reactRootContainer = w, t[zr] = w.current, ds(t.nodeType === 8 ? t.parentNode : t), Io(), w;
    }
    for (; u = t.lastChild; ) t.removeChild(u);
    if (typeof a == "function") {
      var _ = a;
      a = function() {
        var H = da(N);
        _.call(H);
      };
    }
    var N = Yu(t, 0, !1, null, null, !1, !1, "", Km);
    return t._reactRootContainer = N, t[zr] = N.current, ds(t.nodeType === 8 ? t.parentNode : t), Io(function() {
      fa(r, N, s, a);
    }), N;
  }
  function ma(t, r, s, a, u) {
    var d = s._reactRootContainer;
    if (d) {
      var w = d;
      if (typeof u == "function") {
        var _ = u;
        u = function() {
          var N = da(w);
          _.call(N);
        };
      }
      fa(r, w, t, u);
    } else w = ew(s, r, t, u, a);
    return da(w);
  }
  Mp = function(t) {
    switch (t.tag) {
      case 3:
        var r = t.stateNode;
        if (r.current.memoizedState.isDehydrated) {
          var s = wr(r.pendingLanes);
          s !== 0 && (ti(r, s | 1), xn(r, Be()), (Le & 6) === 0 && (Ci = Be() + 500, so()));
        }
        break;
      case 13:
        Io(function() {
          var a = Br(t, 1);
          if (a !== null) {
            var u = un();
            fr(a, t, 1, u);
          }
        }), Ku(t, 1);
    }
  }, bc = function(t) {
    if (t.tag === 13) {
      var r = Br(t, 134217728);
      if (r !== null) {
        var s = un();
        fr(r, t, 134217728, s);
      }
      Ku(t, 134217728);
    }
  }, Tp = function(t) {
    if (t.tag === 13) {
      var r = po(t), s = Br(t, r);
      if (s !== null) {
        var a = un();
        fr(s, t, r, a);
      }
      Ku(t, r);
    }
  }, Np = function() {
    return He;
  }, Ip = function(t, r) {
    var s = He;
    try {
      return He = t, r();
    } finally {
      He = s;
    }
  }, nt = function(t, r, s) {
    switch (r) {
      case "input":
        if (ut(t, s), r = s.name, s.type === "radio" && r != null) {
          for (s = t; s.parentNode; ) s = s.parentNode;
          for (s = s.querySelectorAll("input[name=" + JSON.stringify("" + r) + '][type="radio"]'), r = 0; r < s.length; r++) {
            var a = s[r];
            if (a !== t && a.form === t.form) {
              var u = Nl(a);
              if (!u) throw Error(o(90));
              Me(a), ut(a, u);
            }
          }
        }
        break;
      case "textarea":
        ft(t, s);
        break;
      case "select":
        r = s.value, r != null && tt(t, !!s.multiple, r, !1);
    }
  }, Ee = Vu, xe = Io;
  var tw = { usingClientEntryPoint: !1, Events: [ms, ci, Nl, _n, de, Vu] }, ks = { findFiberByHostInstance: $o, bundleType: 0, version: "18.3.1", rendererPackageName: "react-dom" }, nw = { bundleType: ks.bundleType, version: ks.version, rendererPackageName: ks.rendererPackageName, rendererConfig: ks.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: R.ReactCurrentDispatcher, findHostInstanceByFiber: function(t) {
    return t = Yr(t), t === null ? null : t.stateNode;
  }, findFiberByHostInstance: ks.findFiberByHostInstance || JS, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1-next-f1338f8080-20240426" };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var ga = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!ga.isDisabled && ga.supportsFiber) try {
      gn = ga.inject(nw), at = ga;
    } catch {
    }
  }
  return Cn.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = tw, Cn.createPortal = function(t, r) {
    var s = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!Zu(r)) throw Error(o(200));
    return ZS(t, r, null, s);
  }, Cn.createRoot = function(t, r) {
    if (!Zu(t)) throw Error(o(299));
    var s = !1, a = "", u = Ym;
    return r != null && (r.unstable_strictMode === !0 && (s = !0), r.identifierPrefix !== void 0 && (a = r.identifierPrefix), r.onRecoverableError !== void 0 && (u = r.onRecoverableError)), r = Yu(t, 1, !1, null, null, s, !1, a, u), t[zr] = r.current, ds(t.nodeType === 8 ? t.parentNode : t), new Qu(r);
  }, Cn.findDOMNode = function(t) {
    if (t == null) return null;
    if (t.nodeType === 1) return t;
    var r = t._reactInternals;
    if (r === void 0)
      throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
    return t = Yr(r), t = t === null ? null : t.stateNode, t;
  }, Cn.flushSync = function(t) {
    return Io(t);
  }, Cn.hydrate = function(t, r, s) {
    if (!ha(r)) throw Error(o(200));
    return ma(null, t, r, !0, s);
  }, Cn.hydrateRoot = function(t, r, s) {
    if (!Zu(t)) throw Error(o(405));
    var a = s != null && s.hydratedSources || null, u = !1, d = "", w = Ym;
    if (s != null && (s.unstable_strictMode === !0 && (u = !0), s.identifierPrefix !== void 0 && (d = s.identifierPrefix), s.onRecoverableError !== void 0 && (w = s.onRecoverableError)), r = Xm(r, null, t, 1, s ?? null, u, !1, d, w), t[zr] = r.current, ds(t), a) for (t = 0; t < a.length; t++) s = a[t], u = s._getVersion, u = u(s._source), r.mutableSourceEagerHydrationData == null ? r.mutableSourceEagerHydrationData = [s, u] : r.mutableSourceEagerHydrationData.push(
      s,
      u
    );
    return new pa(r);
  }, Cn.render = function(t, r, s) {
    if (!ha(r)) throw Error(o(200));
    return ma(null, t, r, !1, s);
  }, Cn.unmountComponentAtNode = function(t) {
    if (!ha(t)) throw Error(o(40));
    return t._reactRootContainer ? (Io(function() {
      ma(null, null, t, !1, function() {
        t._reactRootContainer = null, t[zr] = null;
      });
    }), !0) : !1;
  }, Cn.unstable_batchedUpdates = Vu, Cn.unstable_renderSubtreeIntoContainer = function(t, r, s, a) {
    if (!ha(s)) throw Error(o(200));
    if (t == null || t._reactInternals === void 0) throw Error(o(38));
    return ma(t, r, s, !1, a);
  }, Cn.version = "18.3.1-next-f1338f8080-20240426", Cn;
}
var bg;
function Ay() {
  if (bg) return cf.exports;
  bg = 1;
  function e() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(e);
      } catch (n) {
        console.error(n);
      }
  }
  return e(), cf.exports = zx(), cf.exports;
}
var Eg;
function Ox() {
  if (Eg) return va;
  Eg = 1;
  var e = Ay();
  return va.createRoot = e.createRoot, va.hydrateRoot = e.hydrateRoot, va;
}
var Ly = Ox(), pc = Ay();
const Ax = /* @__PURE__ */ m.createContext({}), Vf = /* @__PURE__ */ m.createContext(null);
function Lx({
  children: e,
  onBatchResize: n
}) {
  const o = m.useRef(0), i = m.useRef([]), l = m.useContext(Vf), c = m.useCallback((f, p, g) => {
    o.current += 1;
    const h = o.current;
    i.current.push({
      size: f,
      element: p,
      data: g
    }), Promise.resolve().then(() => {
      h === o.current && (n?.(i.current), i.current = []);
    }), l?.(f, p, g);
  }, [n, l]);
  return /* @__PURE__ */ m.createElement(Vf.Provider, {
    value: c
  }, e);
}
const wo = /* @__PURE__ */ new Map();
function Bx(e) {
  e.forEach((n) => {
    const {
      target: o
    } = n;
    wo.get(o)?.forEach((i) => i(o));
  });
}
let df;
function By() {
  return df || (df = new ResizeObserver(Bx)), df;
}
function Hx(e, n) {
  wo.has(e) || (wo.set(e, /* @__PURE__ */ new Set()), By().observe(e)), wo.get(e).add(n);
}
function Dx(e, n) {
  wo.has(e) && (wo.get(e).delete(n), wo.get(e).size || (By().unobserve(e), wo.delete(e)));
}
function Hy(e, n, o, i) {
  const l = m.useRef({
    width: -1,
    height: -1,
    offsetWidth: -1,
    offsetHeight: -1
  }), c = wt((g) => {
    const {
      width: h,
      height: y
    } = g.getBoundingClientRect(), {
      offsetWidth: v,
      offsetHeight: S
    } = g, x = Math.floor(h), b = Math.floor(y);
    if (l.current.width !== x || l.current.height !== b || l.current.offsetWidth !== v || l.current.offsetHeight !== S) {
      const C = {
        width: x,
        height: b,
        offsetWidth: v,
        offsetHeight: S
      };
      l.current = C;
      const E = v === Math.round(h) ? h : v, $ = S === Math.round(y) ? y : S, k = {
        ...C,
        offsetWidth: E,
        offsetHeight: $
      };
      i?.(k, g), Promise.resolve().then(() => {
        o?.(k, g);
      });
    }
  }), f = typeof n == "function", p = m.useRef(0);
  m.useEffect(() => {
    const g = f ? n() : n;
    return g && e ? Hx(g, c) : e && f && (p.current += 1), () => {
      g && Dx(g, c);
    };
  }, [
    e,
    // If function target resolves after a parent render, the bumped ref value
    // lets the next render re-run this effect without watching the function identity.
    f ? p.current : n
  ]);
}
function jx(e, n) {
  const {
    children: o,
    disabled: i,
    onResize: l,
    data: c
  } = e, f = m.useRef(null), p = m.useContext(Vf), g = typeof o == "function", h = g ? o(f) : o, y = !g && /* @__PURE__ */ m.isValidElement(h) && lp(h), v = y ? dc(h) : null, S = sp(v, f), x = () => cp(f.current);
  return m.useImperativeHandle(n, () => x()), Hy(!i, x, l, (b, C) => {
    p?.(b, C, c);
  }), y ? /* @__PURE__ */ m.cloneElement(h, {
    ref: S
  }) : h;
}
const Vx = /* @__PURE__ */ m.forwardRef(jx);
function Wf() {
  return Wf = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Wf.apply(this, arguments);
}
const Wx = "rc-observer-key";
function qx(e, n) {
  const {
    children: o
  } = e;
  return (typeof o == "function" ? [o] : ol(o)).map((l, c) => {
    const f = l?.key || `${Wx}-${c}`;
    return /* @__PURE__ */ m.createElement(Vx, Wf({}, e, {
      key: f,
      ref: c === 0 ? n : void 0
    }), l);
  });
}
const Dy = /* @__PURE__ */ m.forwardRef(qx);
Dy.Collection = Lx;
function jy(e) {
  var n, o, i = "";
  if (typeof e == "string" || typeof e == "number") i += e;
  else if (typeof e == "object") if (Array.isArray(e)) {
    var l = e.length;
    for (n = 0; n < l; n++) e[n] && (o = jy(e[n])) && (i && (i += " "), i += o);
  } else for (o in e) e[o] && (i && (i += " "), i += o);
  return i;
}
function we() {
  for (var e, n, o = 0, i = "", l = arguments.length; o < l; o++) (e = arguments[o]) && (n = jy(e)) && (i && (i += " "), i += n);
  return i;
}
function qf(e, n) {
  (n == null || n > e.length) && (n = e.length);
  for (var o = 0, i = Array(n); o < n; o++) i[o] = e[o];
  return i;
}
function Ux(e) {
  if (Array.isArray(e)) return qf(e);
}
function Xx(e) {
  if (typeof Symbol < "u" && e[Symbol.iterator] != null || e["@@iterator"] != null) return Array.from(e);
}
function Vy(e, n) {
  if (e) {
    if (typeof e == "string") return qf(e, n);
    var o = {}.toString.call(e).slice(8, -1);
    return o === "Object" && e.constructor && (o = e.constructor.name), o === "Map" || o === "Set" ? Array.from(e) : o === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(o) ? qf(e, n) : void 0;
  }
}
function Gx() {
  throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function il(e) {
  return Ux(e) || Xx(e) || Vy(e) || Gx();
}
const $g = "ant", up = "anticon", Yx = ["outlined", "borderless", "filled", "underlined"], Kx = (e, n) => n || (e ? `${$g}-${e}` : $g), On = /* @__PURE__ */ m.createContext({
  // We provide a default function for Context without provider
  getPrefixCls: Kx,
  iconPrefixCls: up
}), {
  Consumer: uR
} = On, _g = {};
function ei(e) {
  const n = m.useContext(On), {
    getPrefixCls: o,
    direction: i,
    getPopupContainer: l,
    renderEmpty: c
  } = n, f = n[e];
  return {
    classNames: _g,
    styles: _g,
    ...f,
    getPrefixCls: o,
    direction: i,
    getPopupContainer: l,
    renderEmpty: c
  };
}
function yr(e) {
  "@babel/helpers - typeof";
  return yr = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(n) {
    return typeof n;
  } : function(n) {
    return n && typeof Symbol == "function" && n.constructor === Symbol && n !== Symbol.prototype ? "symbol" : typeof n;
  }, yr(e);
}
function Qx(e) {
  if (Array.isArray(e)) return e;
}
function Zx(e, n) {
  var o = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
  if (o != null) {
    var i, l, c, f, p = [], g = !0, h = !1;
    try {
      if (c = (o = o.call(e)).next, n === 0) {
        if (Object(o) !== o) return;
        g = !1;
      } else for (; !(g = (i = c.call(o)).done) && (p.push(i.value), p.length !== n); g = !0) ;
    } catch (y) {
      h = !0, l = y;
    } finally {
      try {
        if (!g && o.return != null && (f = o.return(), Object(f) !== f)) return;
      } finally {
        if (h) throw l;
      }
    }
    return p;
  }
}
function Jx() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function Ka(e, n) {
  return Qx(e) || Zx(e, n) || Vy(e, n) || Jx();
}
function eC(e, n) {
  if (yr(e) != "object" || !e) return e;
  var o = e[Symbol.toPrimitive];
  if (o !== void 0) {
    var i = o.call(e, n);
    if (yr(i) != "object") return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (n === "string" ? String : Number)(e);
}
function Wy(e) {
  var n = eC(e, "string");
  return yr(n) == "symbol" ? n : n + "";
}
function $t(e, n, o) {
  return (n = Wy(n)) in e ? Object.defineProperty(e, n, {
    value: o,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[n] = o, e;
}
function Pg(e, n) {
  var o = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var i = Object.getOwnPropertySymbols(e);
    n && (i = i.filter(function(l) {
      return Object.getOwnPropertyDescriptor(e, l).enumerable;
    })), o.push.apply(o, i);
  }
  return o;
}
function En(e) {
  for (var n = 1; n < arguments.length; n++) {
    var o = arguments[n] != null ? arguments[n] : {};
    n % 2 ? Pg(Object(o), !0).forEach(function(i) {
      $t(e, i, o[i]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(o)) : Pg(Object(o)).forEach(function(i) {
      Object.defineProperty(e, i, Object.getOwnPropertyDescriptor(o, i));
    });
  }
  return e;
}
function Ui(e, n) {
  if (!(e instanceof n)) throw new TypeError("Cannot call a class as a function");
}
function tC(e, n) {
  for (var o = 0; o < n.length; o++) {
    var i = n[o];
    i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, Wy(i.key), i);
  }
}
function Xi(e, n, o) {
  return n && tC(e.prototype, n), Object.defineProperty(e, "prototype", {
    writable: !1
  }), e;
}
function Va(e) {
  if (e === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  return e;
}
function Uf(e, n) {
  return Uf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(o, i) {
    return o.__proto__ = i, o;
  }, Uf(e, n);
}
function nC(e, n) {
  if (typeof n != "function" && n !== null) throw new TypeError("Super expression must either be null or a function");
  e.prototype = Object.create(n && n.prototype, {
    constructor: {
      value: e,
      writable: !0,
      configurable: !0
    }
  }), Object.defineProperty(e, "prototype", {
    writable: !1
  }), n && Uf(e, n);
}
function Qa(e) {
  return Qa = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(n) {
    return n.__proto__ || Object.getPrototypeOf(n);
  }, Qa(e);
}
function qy() {
  try {
    var e = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (qy = function() {
    return !!e;
  })();
}
function rC(e, n) {
  if (n && (yr(n) == "object" || typeof n == "function")) return n;
  if (n !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
  return Va(e);
}
function oC(e) {
  var n = qy();
  return function() {
    var o, i = Qa(e);
    if (n) {
      var l = Qa(this).constructor;
      o = Reflect.construct(i, arguments, l);
    } else o = i.apply(this, arguments);
    return rC(this, o);
  };
}
var iC = /* @__PURE__ */ Xi(function e() {
  Ui(this, e);
}), Uy = "CALC_UNIT", sC = new RegExp(Uy, "g");
function pf(e) {
  return typeof e == "number" ? "".concat(e).concat(Uy) : e;
}
var lC = /* @__PURE__ */ (function(e) {
  nC(o, e);
  var n = oC(o);
  function o(i, l) {
    var c;
    Ui(this, o), c = n.call(this), $t(Va(c), "result", ""), $t(Va(c), "unitlessCssVar", void 0), $t(Va(c), "lowPriority", void 0);
    var f = yr(i);
    return c.unitlessCssVar = l, i instanceof o ? c.result = "(".concat(i.result, ")") : f === "number" ? c.result = pf(i) : f === "string" && (c.result = i), c;
  }
  return Xi(o, [{
    key: "add",
    value: function(l) {
      return l instanceof o ? this.result = "".concat(this.result, " + ").concat(l.getResult()) : (typeof l == "number" || typeof l == "string") && (this.result = "".concat(this.result, " + ").concat(pf(l))), this.lowPriority = !0, this;
    }
  }, {
    key: "sub",
    value: function(l) {
      return l instanceof o ? this.result = "".concat(this.result, " - ").concat(l.getResult()) : (typeof l == "number" || typeof l == "string") && (this.result = "".concat(this.result, " - ").concat(pf(l))), this.lowPriority = !0, this;
    }
  }, {
    key: "mul",
    value: function(l) {
      return this.lowPriority && (this.result = "(".concat(this.result, ")")), l instanceof o ? this.result = "".concat(this.result, " * ").concat(l.getResult(!0)) : (typeof l == "number" || typeof l == "string") && (this.result = "".concat(this.result, " * ").concat(l)), this.lowPriority = !1, this;
    }
  }, {
    key: "div",
    value: function(l) {
      return this.lowPriority && (this.result = "(".concat(this.result, ")")), l instanceof o ? this.result = "".concat(this.result, " / ").concat(l.getResult(!0)) : (typeof l == "number" || typeof l == "string") && (this.result = "".concat(this.result, " / ").concat(l)), this.lowPriority = !1, this;
    }
  }, {
    key: "getResult",
    value: function(l) {
      return this.lowPriority || l ? "(".concat(this.result, ")") : this.result;
    }
  }, {
    key: "equal",
    value: function(l) {
      var c = this, f = l || {}, p = f.unit, g = !0;
      return typeof p == "boolean" ? g = p : Array.from(this.unitlessCssVar).some(function(h) {
        return c.result.includes(h);
      }) && (g = !1), this.result = this.result.replace(sC, g ? "px" : ""), typeof this.lowPriority < "u" ? "calc(".concat(this.result, ")") : this.result;
    }
  }]), o;
})(iC), aC = function(n, o) {
  var i = lC;
  return function(l) {
    return new i(l, o);
  };
}, Rg = function(n, o) {
  return "".concat([o, n.replace(/([A-Z]+)([A-Z][a-z]+)/g, "$1-$2").replace(/([a-z])([A-Z])/g, "$1-$2")].filter(Boolean).join("-"));
};
function kg(e, n, o, i) {
  var l = En({}, n[e]);
  if (i != null && i.deprecatedTokens) {
    var c = i.deprecatedTokens;
    c.forEach(function(p) {
      var g = Ka(p, 2), h = g[0], y = g[1];
      if (l != null && l[h] || l != null && l[y]) {
        var v;
        (v = l[y]) !== null && v !== void 0 || (l[y] = l?.[h]);
      }
    });
  }
  var f = En(En({}, o), l);
  return Object.keys(f).forEach(function(p) {
    f[p] === n[p] && delete f[p];
  }), f;
}
var Xy = typeof CSSINJS_STATISTIC < "u", Xf = !0;
function rr() {
  for (var e = arguments.length, n = new Array(e), o = 0; o < e; o++)
    n[o] = arguments[o];
  if (!Xy)
    return Object.assign.apply(Object, [{}].concat(n));
  Xf = !1;
  var i = {};
  return n.forEach(function(l) {
    if (yr(l) === "object") {
      var c = Object.keys(l);
      c.forEach(function(f) {
        Object.defineProperty(i, f, {
          configurable: !0,
          enumerable: !0,
          get: function() {
            return l[f];
          }
        });
      });
    }
  }), Xf = !0, i;
}
var Mg = {};
function cC() {
}
var uC = function(n) {
  var o, i = n, l = cC;
  return Xy && typeof Proxy < "u" && (o = /* @__PURE__ */ new Set(), i = new Proxy(n, {
    get: function(f, p) {
      if (Xf) {
        var g;
        (g = o) === null || g === void 0 || g.add(p);
      }
      return f[p];
    }
  }), l = function(f, p) {
    var g;
    Mg[f] = {
      global: Array.from(o),
      component: En(En({}, (g = Mg[f]) === null || g === void 0 ? void 0 : g.component), p)
    };
  }), {
    token: i,
    keys: o,
    flush: l
  };
};
function Tg(e, n, o) {
  if (typeof o == "function") {
    var i;
    return o(rr(n, (i = n[e]) !== null && i !== void 0 ? i : {}));
  }
  return o ?? {};
}
function fC(e) {
  return {
    max: function() {
      for (var o = arguments.length, i = new Array(o), l = 0; l < o; l++)
        i[l] = arguments[l];
      return "max(".concat(i.map(function(c) {
        return $e(c);
      }).join(","), ")");
    },
    min: function() {
      for (var o = arguments.length, i = new Array(o), l = 0; l < o; l++)
        i[l] = arguments[l];
      return "min(".concat(i.map(function(c) {
        return $e(c);
      }).join(","), ")");
    }
  };
}
var dC = 1e3 * 60 * 10, pC = /* @__PURE__ */ (function() {
  function e() {
    Ui(this, e), $t(this, "map", /* @__PURE__ */ new Map()), $t(this, "objectIDMap", /* @__PURE__ */ new WeakMap()), $t(this, "nextID", 0), $t(this, "lastAccessBeat", /* @__PURE__ */ new Map()), $t(this, "accessBeat", 0);
  }
  return Xi(e, [{
    key: "set",
    value: function(o, i) {
      this.clear();
      var l = this.getCompositeKey(o);
      this.map.set(l, i), this.lastAccessBeat.set(l, Date.now());
    }
  }, {
    key: "get",
    value: function(o) {
      var i = this.getCompositeKey(o), l = this.map.get(i);
      return this.lastAccessBeat.set(i, Date.now()), this.accessBeat += 1, l;
    }
  }, {
    key: "getCompositeKey",
    value: function(o) {
      var i = this, l = o.map(function(c) {
        return c && yr(c) === "object" ? "obj_".concat(i.getObjectID(c)) : "".concat(yr(c), "_").concat(c);
      });
      return l.join("|");
    }
  }, {
    key: "getObjectID",
    value: function(o) {
      if (this.objectIDMap.has(o))
        return this.objectIDMap.get(o);
      var i = this.nextID;
      return this.objectIDMap.set(o, i), this.nextID += 1, i;
    }
  }, {
    key: "clear",
    value: function() {
      var o = this;
      if (this.accessBeat > 1e4) {
        var i = Date.now();
        this.lastAccessBeat.forEach(function(l, c) {
          i - l > dC && (o.map.delete(c), o.lastAccessBeat.delete(c));
        }), this.accessBeat = 0;
      }
    }
  }]), e;
})(), Ng = new pC();
function hC(e, n) {
  return ye.useMemo(function() {
    var o = Ng.get(n);
    if (o)
      return o;
    var i = e();
    return Ng.set(n, i), i;
  }, n);
}
var mC = function() {
  return {};
};
function gC(e) {
  var n = e.useCSP, o = n === void 0 ? mC : n, i = e.useToken, l = e.usePrefix, c = e.getResetStyles, f = e.getCommonStyle, p = e.getCompUnitless;
  function g(S, x, b, C) {
    var E = Array.isArray(S) ? S[0] : S;
    function $(O) {
      return "".concat(String(E)).concat(O.slice(0, 1).toUpperCase()).concat(O.slice(1));
    }
    var k = C?.unitless || {}, P = typeof p == "function" ? p(S) : {}, R = En(En({}, P), {}, $t({}, $("zIndexPopup"), !0));
    Object.keys(k).forEach(function(O) {
      R[$(O)] = k[O];
    });
    var M = En(En({}, C), {}, {
      unitless: R,
      prefixToken: $
    }), I = y(S, x, b, M), z = h(E, b, M);
    return function(O) {
      var j = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : O, Y = I(O, j), V = C?.extraCssVarPrefixCls, X = typeof V == "function" ? V({
        prefixCls: O,
        rootCls: j
      }) : V, Q = z(X != null && X.length ? [j].concat(il(X)) : j);
      return [Y, Q];
    };
  }
  function h(S, x, b) {
    var C = b.unitless, E = b.prefixToken, $ = b.ignore;
    return function(k) {
      var P = i(), R = P.cssVar, M = P.realToken, I = o();
      return ix({
        path: [S],
        prefix: R.prefix,
        key: R.key,
        unitless: C,
        ignore: $,
        token: M,
        scope: k,
        nonce: function() {
          return I.nonce;
        }
      }, function() {
        var z = Tg(S, M, x), O = kg(S, M, z, {
          deprecatedTokens: b?.deprecatedTokens
        });
        return z && Object.keys(z).forEach(function(j) {
          O[E(j)] = O[j], delete O[j];
        }), O;
      }), R?.key;
    };
  }
  function y(S, x, b) {
    var C = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {}, E = Array.isArray(S) ? S : [S, S], $ = Ka(E, 1), k = $[0], P = E.join("-"), R = e.layer || {
      name: "antd"
    };
    return function(M) {
      var I = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : M, z = i(), O = z.theme, j = z.realToken, Y = z.hashId, V = z.token, X = z.cssVar, Q = z.zeroRuntime, oe = m.useMemo(function() {
        return Q;
      }, []);
      if (oe)
        return Y;
      var G = l(), le = G.rootPrefixCls, he = G.iconPrefixCls, D = o(), J = "css", q = hC(function() {
        var se = /* @__PURE__ */ new Set();
        return Object.keys(C.unitless || {}).forEach(function(re) {
          se.add(Ha(re, X.prefix)), se.add(Ha(re, Rg(k, X.prefix)));
        }), aC(J, se);
      }, [J, k, X?.prefix]), T = fC(), A = T.max, ee = T.min, te = {
        theme: O,
        token: V,
        hashId: Y,
        nonce: function() {
          return D.nonce;
        },
        clientOnly: C.clientOnly,
        layer: R,
        // antd is always at top of styles
        order: C.order || -999
      };
      return typeof c == "function" && Df(En(En({}, te), {}, {
        clientOnly: !1,
        path: ["Shared", le]
      }), function() {
        return c(V, {
          prefix: {
            rootPrefixCls: le,
            iconPrefixCls: he
          },
          csp: D
        });
      }), Df(En(En({}, te), {}, {
        path: [P, M, he]
      }), function() {
        if (C.injectStyle === !1)
          return [];
        var se = uC(V), re = se.token, fe = se.flush, ie = Tg(k, j, b), Z = ".".concat(M), ae = kg(k, j, ie, {
          deprecatedTokens: C.deprecatedTokens
        });
        ie && yr(ie) === "object" && Object.keys(ie).forEach(function(Qe) {
          ie[Qe] = "var(".concat(Ha(Qe, Rg(k, X.prefix)), ")");
        });
        var ce = rr(re, {
          componentCls: Z,
          prefixCls: M,
          iconCls: ".".concat(he),
          antCls: ".".concat(le),
          calc: q,
          max: A,
          min: ee
        }, ie), Me = x(ce, {
          hashId: Y,
          prefixCls: M,
          rootPrefixCls: le,
          iconPrefixCls: he
        });
        fe(k, ae);
        var Ue = typeof f == "function" ? f(ce, M, I, C.resetFont) : null;
        return [C.resetStyle === !1 ? null : Ue, Me];
      }), Y;
    };
  }
  function v(S, x, b) {
    var C = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {}, E = y(S, x, b, En({
      resetStyle: !1,
      // Sub Style should default after root one
      order: -998
    }, C)), $ = function(P) {
      var R = P.prefixCls, M = P.rootCls, I = M === void 0 ? R : M;
      return E(R, I), null;
    };
    return $;
  }
  return {
    genStyleHooks: g,
    genSubStyleComponent: v,
    genComponentStyleHook: y
  };
}
const Li = ["blue", "purple", "cyan", "green", "magenta", "pink", "red", "orange", "yellow", "volcano", "geekblue", "lime", "gold"];
function yC(e) {
  return (e + 8) / e;
}
function vC(e) {
  const n = Array.from({
    length: 10
  }).map((o, i) => {
    const l = i - 1, c = e * Math.E ** (l / 5), f = i > 1 ? Math.floor(c) : Math.ceil(c);
    return Math.floor(f / 2) * 2;
  });
  return n[1] = e, n.map((o) => ({
    size: o,
    lineHeight: yC(o)
  }));
}
const SC = "6.5.4", fp = {
  blue: "#1677FF",
  purple: "#722ED1",
  cyan: "#13C2C2",
  green: "#52C41A",
  magenta: "#EB2F96",
  /**
   * @deprecated Use magenta instead
   */
  pink: "#EB2F96",
  red: "#F5222D",
  orange: "#FA8C16",
  yellow: "#FADB14",
  volcano: "#FA541C",
  geekblue: "#2F54EB",
  gold: "#FAAD14",
  lime: "#A0D911"
}, Bi = {
  // preset color palettes
  ...fp,
  // Color
  colorPrimary: "#1677ff",
  colorSuccess: "#52c41a",
  colorWarning: "#faad14",
  colorError: "#ff4d4f",
  colorInfo: "#1677ff",
  colorLink: "",
  colorTextBase: "",
  colorBgBase: "",
  // Font
  fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
'Noto Color Emoji'`,
  fontFamilyCode: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace",
  fontSize: 14,
  // Line
  lineWidth: 1,
  lineType: "solid",
  // Motion
  motionUnit: 0.1,
  motionBase: 0,
  motionEaseOutCirc: "cubic-bezier(0.08, 0.82, 0.17, 1)",
  motionEaseInOutCirc: "cubic-bezier(0.78, 0.14, 0.15, 0.86)",
  motionEaseOut: "cubic-bezier(0.215, 0.61, 0.355, 1)",
  motionEaseInOut: "cubic-bezier(0.645, 0.045, 0.355, 1)",
  motionEaseOutBack: "cubic-bezier(0.12, 0.4, 0.29, 1.46)",
  motionEaseInBack: "cubic-bezier(0.71, -0.46, 0.88, 0.6)",
  motionEaseInQuint: "cubic-bezier(0.755, 0.05, 0.855, 0.06)",
  motionEaseOutQuint: "cubic-bezier(0.23, 1, 0.32, 1)",
  // Radius
  borderRadius: 6,
  // Size
  sizeUnit: 4,
  sizeStep: 4,
  sizePopupArrow: 16,
  // Control Base
  controlHeight: 32,
  // zIndex
  zIndexBase: 0,
  zIndexPopupBase: 1e3,
  // Image
  opacityImage: 1,
  // Wireframe
  wireframe: !1,
  // Motion
  motion: !0
}, wC = {
  aliceblue: "9ehhb",
  antiquewhite: "9sgk7",
  aqua: "1ekf",
  aquamarine: "4zsno",
  azure: "9eiv3",
  beige: "9lhp8",
  bisque: "9zg04",
  black: "0",
  blanchedalmond: "9zhe5",
  blue: "73",
  blueviolet: "5e31e",
  brown: "6g016",
  burlywood: "8ouiv",
  cadetblue: "3qba8",
  chartreuse: "4zshs",
  chocolate: "87k0u",
  coral: "9yvyo",
  cornflowerblue: "3xael",
  cornsilk: "9zjz0",
  crimson: "8l4xo",
  cyan: "1ekf",
  darkblue: "3v",
  darkcyan: "rkb",
  darkgoldenrod: "776yz",
  darkgray: "6mbhl",
  darkgreen: "jr4",
  darkgrey: "6mbhl",
  darkkhaki: "7ehkb",
  darkmagenta: "5f91n",
  darkolivegreen: "3bzfz",
  darkorange: "9yygw",
  darkorchid: "5z6x8",
  darkred: "5f8xs",
  darksalmon: "9441m",
  darkseagreen: "5lwgf",
  darkslateblue: "2th1n",
  darkslategray: "1ugcv",
  darkslategrey: "1ugcv",
  darkturquoise: "14up",
  darkviolet: "5rw7n",
  deeppink: "9yavn",
  deepskyblue: "11xb",
  dimgray: "442g9",
  dimgrey: "442g9",
  dodgerblue: "16xof",
  firebrick: "6y7tu",
  floralwhite: "9zkds",
  forestgreen: "1cisi",
  fuchsia: "9y70f",
  gainsboro: "8m8kc",
  ghostwhite: "9pq0v",
  goldenrod: "8j4f4",
  gold: "9zda8",
  gray: "50i2o",
  green: "pa8",
  greenyellow: "6senj",
  grey: "50i2o",
  honeydew: "9eiuo",
  hotpink: "9yrp0",
  indianred: "80gnw",
  indigo: "2xcoy",
  ivory: "9zldc",
  khaki: "9edu4",
  lavenderblush: "9ziet",
  lavender: "90c8q",
  lawngreen: "4vk74",
  lemonchiffon: "9zkct",
  lightblue: "6s73a",
  lightcoral: "9dtog",
  lightcyan: "8s1rz",
  lightgoldenrodyellow: "9sjiq",
  lightgray: "89jo3",
  lightgreen: "5nkwg",
  lightgrey: "89jo3",
  lightpink: "9z6wx",
  lightsalmon: "9z2ii",
  lightseagreen: "19xgq",
  lightskyblue: "5arju",
  lightslategray: "4nwk9",
  lightslategrey: "4nwk9",
  lightsteelblue: "6wau6",
  lightyellow: "9zlcw",
  lime: "1edc",
  limegreen: "1zcxe",
  linen: "9shk6",
  magenta: "9y70f",
  maroon: "4zsow",
  mediumaquamarine: "40eju",
  mediumblue: "5p",
  mediumorchid: "79qkz",
  mediumpurple: "5r3rv",
  mediumseagreen: "2d9ip",
  mediumslateblue: "4tcku",
  mediumspringgreen: "1di2",
  mediumturquoise: "2uabw",
  mediumvioletred: "7rn9h",
  midnightblue: "z980",
  mintcream: "9ljp6",
  mistyrose: "9zg0x",
  moccasin: "9zfzp",
  navajowhite: "9zest",
  navy: "3k",
  oldlace: "9wq92",
  olive: "50hz4",
  olivedrab: "472ub",
  orange: "9z3eo",
  orangered: "9ykg0",
  orchid: "8iu3a",
  palegoldenrod: "9bl4a",
  palegreen: "5yw0o",
  paleturquoise: "6v4ku",
  palevioletred: "8k8lv",
  papayawhip: "9zi6t",
  peachpuff: "9ze0p",
  peru: "80oqn",
  pink: "9z8wb",
  plum: "8nba5",
  powderblue: "6wgdi",
  purple: "4zssg",
  rebeccapurple: "3zk49",
  red: "9y6tc",
  rosybrown: "7cv4f",
  royalblue: "2jvtt",
  saddlebrown: "5fmkz",
  salmon: "9rvci",
  sandybrown: "9jn1c",
  seagreen: "1tdnb",
  seashell: "9zje6",
  sienna: "6973h",
  silver: "7ir40",
  skyblue: "5arjf",
  slateblue: "45e4t",
  slategray: "4e100",
  slategrey: "4e100",
  snow: "9zke2",
  springgreen: "1egv",
  steelblue: "2r1kk",
  tan: "87yx8",
  teal: "pds",
  thistle: "8ggk8",
  tomato: "9yqfb",
  turquoise: "2j4r4",
  violet: "9b10u",
  wheat: "9ld4j",
  white: "9zldr",
  whitesmoke: "9lhpx",
  yellow: "9zl6o",
  yellowgreen: "61fzm"
}, Vt = Math.round;
function hf(e, n) {
  const o = e.replace(/^[^(]*\((.*)/, "$1").replace(/\).*/, "").match(/\d*\.?\d+%?/g) || [], i = o.map((l) => parseFloat(l));
  for (let l = 0; l < 3; l += 1)
    i[l] = n(i[l] || 0, o[l] || "", l);
  return o[3] ? i[3] = o[3].includes("%") ? i[3] / 100 : i[3] : i[3] = 1, i;
}
const Ig = (e, n, o) => o === 0 ? e : e / 100;
function Ts(e, n) {
  const o = n || 255;
  return e > o ? o : e < 0 ? 0 : e;
}
let Pt = class Gy {
  /**
   * All FastColor objects are valid. So isValid is always true. This property is kept to be compatible with TinyColor.
   */
  isValid = !0;
  /**
   * Red, R in RGB
   */
  r = 0;
  /**
   * Green, G in RGB
   */
  g = 0;
  /**
   * Blue, B in RGB
   */
  b = 0;
  /**
   * Alpha/Opacity, A in RGBA/HSLA
   */
  a = 1;
  // HSV privates
  _h;
  _hsl_s;
  _hsv_s;
  _l;
  _v;
  // intermediate variables to calculate HSL/HSV
  _max;
  _min;
  _brightness;
  constructor(n) {
    function o(i) {
      return i[0] in n && i[1] in n && i[2] in n;
    }
    if (n) if (typeof n == "string") {
      let l = function(c) {
        return i.startsWith(c);
      };
      const i = n.trim();
      if (/^#?[A-F\d]{3,8}$/i.test(i))
        this.fromHexString(i);
      else if (l("rgb"))
        this.fromRgbString(i);
      else if (l("hsl"))
        this.fromHslString(i);
      else if (l("hsv") || l("hsb"))
        this.fromHsvString(i);
      else {
        const c = wC[i.toLowerCase()];
        c && this.fromHexString(
          // Convert 36 hex to 16 hex
          parseInt(c, 36).toString(16).padStart(6, "0")
        );
      }
    } else if (n instanceof Gy)
      this.r = n.r, this.g = n.g, this.b = n.b, this.a = n.a, this._h = n._h, this._hsl_s = n._hsl_s, this._hsv_s = n._hsv_s, this._l = n._l, this._v = n._v;
    else if (o("rgb"))
      this.r = Ts(n.r), this.g = Ts(n.g), this.b = Ts(n.b), this.a = typeof n.a == "number" ? Ts(n.a, 1) : 1;
    else if (o("hsl"))
      this.fromHsl(n);
    else if (o("hsv"))
      this.fromHsv(n);
    else
      throw new Error("@ant-design/fast-color: unsupported input " + JSON.stringify(n));
  }
  // ======================= Setter =======================
  setR(n) {
    return this._sc("r", n);
  }
  setG(n) {
    return this._sc("g", n);
  }
  setB(n) {
    return this._sc("b", n);
  }
  setA(n) {
    return this._sc("a", n, 1);
  }
  setHue(n) {
    const o = this.toHsv();
    return o.h = n, this._c(o);
  }
  // ======================= Getter =======================
  /**
   * Returns the perceived luminance of a color, from 0-1.
   * @see http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
   */
  getLuminance() {
    function n(c) {
      const f = c / 255;
      return f <= 0.03928 ? f / 12.92 : Math.pow((f + 0.055) / 1.055, 2.4);
    }
    const o = n(this.r), i = n(this.g), l = n(this.b);
    return 0.2126 * o + 0.7152 * i + 0.0722 * l;
  }
  getHue() {
    if (typeof this._h > "u") {
      const n = this.getMax() - this.getMin();
      n === 0 ? this._h = 0 : this._h = Vt(60 * (this.r === this.getMax() ? (this.g - this.b) / n + (this.g < this.b ? 6 : 0) : this.g === this.getMax() ? (this.b - this.r) / n + 2 : (this.r - this.g) / n + 4));
    }
    return this._h;
  }
  /**
   * @deprecated should use getHSVSaturation or getHSLSaturation instead
   */
  getSaturation() {
    return this.getHSVSaturation();
  }
  getHSVSaturation() {
    if (typeof this._hsv_s > "u") {
      const n = this.getMax() - this.getMin();
      n === 0 ? this._hsv_s = 0 : this._hsv_s = n / this.getMax();
    }
    return this._hsv_s;
  }
  getHSLSaturation() {
    if (typeof this._hsl_s > "u") {
      const n = this.getMax() - this.getMin();
      if (n === 0)
        this._hsl_s = 0;
      else {
        const o = this.getLightness();
        this._hsl_s = n / 255 / (1 - Math.abs(2 * o - 1));
      }
    }
    return this._hsl_s;
  }
  getLightness() {
    return typeof this._l > "u" && (this._l = (this.getMax() + this.getMin()) / 510), this._l;
  }
  getValue() {
    return typeof this._v > "u" && (this._v = this.getMax() / 255), this._v;
  }
  /**
   * Returns the perceived brightness of the color, from 0-255.
   * Note: this is not the b of HSB
   * @see http://www.w3.org/TR/AERT#color-contrast
   */
  getBrightness() {
    return typeof this._brightness > "u" && (this._brightness = (this.r * 299 + this.g * 587 + this.b * 114) / 1e3), this._brightness;
  }
  // ======================== Func ========================
  darken(n = 10) {
    const o = this.getHue(), i = this.getSaturation();
    let l = this.getLightness() - n / 100;
    return l < 0 && (l = 0), this._c({
      h: o,
      s: i,
      l,
      a: this.a
    });
  }
  lighten(n = 10) {
    const o = this.getHue(), i = this.getSaturation();
    let l = this.getLightness() + n / 100;
    return l > 1 && (l = 1), this._c({
      h: o,
      s: i,
      l,
      a: this.a
    });
  }
  /**
   * Mix the current color a given amount with another color, from 0 to 100.
   * 0 means no mixing (return current color).
   */
  mix(n, o = 50) {
    const i = this._c(n), l = o / 100, c = (p) => (i[p] - this[p]) * l + this[p], f = {
      r: Vt(c("r")),
      g: Vt(c("g")),
      b: Vt(c("b")),
      a: Vt(c("a") * 100) / 100
    };
    return this._c(f);
  }
  /**
   * Mix the color with pure white, from 0 to 100.
   * Providing 0 will do nothing, providing 100 will always return white.
   */
  tint(n = 10) {
    return this.mix({
      r: 255,
      g: 255,
      b: 255,
      a: 1
    }, n);
  }
  /**
   * Mix the color with pure black, from 0 to 100.
   * Providing 0 will do nothing, providing 100 will always return black.
   */
  shade(n = 10) {
    return this.mix({
      r: 0,
      g: 0,
      b: 0,
      a: 1
    }, n);
  }
  onBackground(n) {
    const o = this._c(n), i = this.a + o.a * (1 - this.a), l = (c) => Vt((this[c] * this.a + o[c] * o.a * (1 - this.a)) / i);
    return this._c({
      r: l("r"),
      g: l("g"),
      b: l("b"),
      a: i
    });
  }
  // ======================= Status =======================
  isDark() {
    return this.getBrightness() < 128;
  }
  isLight() {
    return this.getBrightness() >= 128;
  }
  // ======================== MISC ========================
  equals(n) {
    return this.r === n.r && this.g === n.g && this.b === n.b && this.a === n.a;
  }
  clone() {
    return this._c(this);
  }
  // ======================= Format =======================
  toHexString() {
    let n = "#";
    const o = (this.r || 0).toString(16);
    n += o.length === 2 ? o : "0" + o;
    const i = (this.g || 0).toString(16);
    n += i.length === 2 ? i : "0" + i;
    const l = (this.b || 0).toString(16);
    if (n += l.length === 2 ? l : "0" + l, typeof this.a == "number" && this.a >= 0 && this.a < 1) {
      const c = Vt(this.a * 255).toString(16);
      n += c.length === 2 ? c : "0" + c;
    }
    return n;
  }
  /** CSS support color pattern */
  toHsl() {
    return {
      h: this.getHue(),
      s: this.getHSLSaturation(),
      l: this.getLightness(),
      a: this.a
    };
  }
  /** CSS support color pattern */
  toHslString() {
    const n = this.getHue(), o = Vt(this.getHSLSaturation() * 100), i = Vt(this.getLightness() * 100);
    return this.a !== 1 ? `hsla(${n},${o}%,${i}%,${this.a})` : `hsl(${n},${o}%,${i}%)`;
  }
  /** Same as toHsb */
  toHsv() {
    return {
      h: this.getHue(),
      s: this.getHSVSaturation(),
      v: this.getValue(),
      a: this.a
    };
  }
  toRgb() {
    return {
      r: this.r,
      g: this.g,
      b: this.b,
      a: this.a
    };
  }
  toRgbString() {
    return this.a !== 1 ? `rgba(${this.r},${this.g},${this.b},${this.a})` : `rgb(${this.r},${this.g},${this.b})`;
  }
  toString() {
    return this.toRgbString();
  }
  // ====================== Privates ======================
  /** Return a new FastColor object with one channel changed */
  _sc(n, o, i) {
    const l = this.clone();
    return l[n] = Ts(o, i), l;
  }
  _c(n) {
    return new this.constructor(n);
  }
  getMax() {
    return typeof this._max > "u" && (this._max = Math.max(this.r, this.g, this.b)), this._max;
  }
  getMin() {
    return typeof this._min > "u" && (this._min = Math.min(this.r, this.g, this.b)), this._min;
  }
  fromHexString(n) {
    const o = n.replace("#", "");
    function i(l, c) {
      return parseInt(o[l] + o[c || l], 16);
    }
    o.length < 6 ? (this.r = i(0), this.g = i(1), this.b = i(2), this.a = o[3] ? i(3) / 255 : 1) : (this.r = i(0, 1), this.g = i(2, 3), this.b = i(4, 5), this.a = o[6] ? i(6, 7) / 255 : 1);
  }
  fromHsl({
    h: n,
    s: o,
    l: i,
    a: l
  }) {
    const c = (n % 360 + 360) % 360;
    if (this._h = c, this._hsl_s = o, this._l = i, this.a = typeof l == "number" ? l : 1, o <= 0) {
      const x = Vt(i * 255);
      this.r = x, this.g = x, this.b = x;
      return;
    }
    let f = 0, p = 0, g = 0;
    const h = c / 60, y = (1 - Math.abs(2 * i - 1)) * o, v = y * (1 - Math.abs(h % 2 - 1));
    h >= 0 && h < 1 ? (f = y, p = v) : h >= 1 && h < 2 ? (f = v, p = y) : h >= 2 && h < 3 ? (p = y, g = v) : h >= 3 && h < 4 ? (p = v, g = y) : h >= 4 && h < 5 ? (f = v, g = y) : h >= 5 && h < 6 && (f = y, g = v);
    const S = i - y / 2;
    this.r = Vt((f + S) * 255), this.g = Vt((p + S) * 255), this.b = Vt((g + S) * 255);
  }
  fromHsv({
    h: n,
    s: o,
    v: i,
    a: l
  }) {
    const c = (n % 360 + 360) % 360;
    this._h = c, this._hsv_s = o, this._v = i, this.a = typeof l == "number" ? l : 1;
    const f = Vt(i * 255);
    if (this.r = f, this.g = f, this.b = f, o <= 0)
      return;
    const p = c / 60, g = Math.floor(p), h = p - g, y = Vt(i * (1 - o) * 255), v = Vt(i * (1 - o * h) * 255), S = Vt(i * (1 - o * (1 - h)) * 255);
    switch (g) {
      case 0:
        this.g = S, this.b = y;
        break;
      case 1:
        this.r = v, this.b = y;
        break;
      case 2:
        this.r = y, this.b = S;
        break;
      case 3:
        this.r = y, this.g = v;
        break;
      case 4:
        this.r = S, this.g = y;
        break;
      default:
        this.g = y, this.b = v;
        break;
    }
  }
  fromHsvString(n) {
    const o = hf(n, Ig);
    this.fromHsv({
      h: o[0],
      s: o[1],
      v: o[2],
      a: o[3]
    });
  }
  fromHslString(n) {
    const o = hf(n, Ig);
    this.fromHsl({
      h: o[0],
      s: o[1],
      l: o[2],
      a: o[3]
    });
  }
  fromRgbString(n) {
    const o = hf(n, (i, l) => (
      // Convert percentage to number. e.g. 50% -> 128
      l.includes("%") ? Vt(i / 100 * 255) : i
    ));
    this.r = o[0], this.g = o[1], this.b = o[2], this.a = o[3];
  }
};
const Sa = 2, Fg = 0.16, xC = 0.05, CC = 0.05, bC = 0.15, Yy = 5, Ky = 4, EC = [{
  index: 7,
  amount: 15
}, {
  index: 6,
  amount: 25
}, {
  index: 5,
  amount: 30
}, {
  index: 5,
  amount: 45
}, {
  index: 5,
  amount: 65
}, {
  index: 5,
  amount: 85
}, {
  index: 4,
  amount: 90
}, {
  index: 3,
  amount: 95
}, {
  index: 2,
  amount: 97
}, {
  index: 1,
  amount: 98
}];
function zg(e, n, o) {
  let i;
  return Math.round(e.h) >= 60 && Math.round(e.h) <= 240 ? i = o ? Math.round(e.h) - Sa * n : Math.round(e.h) + Sa * n : i = o ? Math.round(e.h) + Sa * n : Math.round(e.h) - Sa * n, i < 0 ? i += 360 : i >= 360 && (i -= 360), i;
}
function Og(e, n, o) {
  if (e.h === 0 && e.s === 0)
    return e.s;
  let i;
  return o ? i = e.s - Fg * n : n === Ky ? i = e.s + Fg : i = e.s + xC * n, i > 1 && (i = 1), o && n === Yy && i > 0.1 && (i = 0.1), i < 0.06 && (i = 0.06), Math.round(i * 100) / 100;
}
function Ag(e, n, o) {
  let i;
  return o ? i = e.v + CC * n : i = e.v - bC * n, i = Math.max(0, Math.min(1, i)), Math.round(i * 100) / 100;
}
function hc(e, n = {}) {
  const o = [], i = new Pt(e), l = i.toHsv();
  for (let c = Yy; c > 0; c -= 1) {
    const f = new Pt({
      h: zg(l, c, !0),
      s: Og(l, c, !0),
      v: Ag(l, c, !0)
    });
    o.push(f);
  }
  o.push(i);
  for (let c = 1; c <= Ky; c += 1) {
    const f = new Pt({
      h: zg(l, c),
      s: Og(l, c),
      v: Ag(l, c)
    });
    o.push(f);
  }
  return n.theme === "dark" ? EC.map(({
    index: c,
    amount: f
  }) => new Pt(n.backgroundColor || "#141414").mix(o[c], f).toHexString()) : o.map((c) => c.toHexString());
}
const Fi = {
  red: "#F5222D",
  volcano: "#FA541C",
  orange: "#FA8C16",
  gold: "#FAAD14",
  yellow: "#FADB14",
  lime: "#A0D911",
  green: "#52C41A",
  cyan: "#13C2C2",
  blue: "#1677FF",
  geekblue: "#2F54EB",
  purple: "#722ED1",
  magenta: "#EB2F96",
  grey: "#666666"
}, Gf = ["#fff1f0", "#ffccc7", "#ffa39e", "#ff7875", "#ff4d4f", "#f5222d", "#cf1322", "#a8071a", "#820014", "#5c0011"];
Gf.primary = Gf[5];
const Yf = ["#fff2e8", "#ffd8bf", "#ffbb96", "#ff9c6e", "#ff7a45", "#fa541c", "#d4380d", "#ad2102", "#871400", "#610b00"];
Yf.primary = Yf[5];
const Kf = ["#fff7e6", "#ffe7ba", "#ffd591", "#ffc069", "#ffa940", "#fa8c16", "#d46b08", "#ad4e00", "#873800", "#612500"];
Kf.primary = Kf[5];
const Qf = ["#fffbe6", "#fff1b8", "#ffe58f", "#ffd666", "#ffc53d", "#faad14", "#d48806", "#ad6800", "#874d00", "#613400"];
Qf.primary = Qf[5];
const Zf = ["#feffe6", "#ffffb8", "#fffb8f", "#fff566", "#ffec3d", "#fadb14", "#d4b106", "#ad8b00", "#876800", "#614700"];
Zf.primary = Zf[5];
const Jf = ["#fcffe6", "#f4ffb8", "#eaff8f", "#d3f261", "#bae637", "#a0d911", "#7cb305", "#5b8c00", "#3f6600", "#254000"];
Jf.primary = Jf[5];
const ed = ["#f6ffed", "#d9f7be", "#b7eb8f", "#95de64", "#73d13d", "#52c41a", "#389e0d", "#237804", "#135200", "#092b00"];
ed.primary = ed[5];
const td = ["#e6fffb", "#b5f5ec", "#87e8de", "#5cdbd3", "#36cfc9", "#13c2c2", "#08979c", "#006d75", "#00474f", "#002329"];
td.primary = td[5];
const nd = ["#e6f4ff", "#bae0ff", "#91caff", "#69b1ff", "#4096ff", "#1677ff", "#0958d9", "#003eb3", "#002c8c", "#001d66"];
nd.primary = nd[5];
const rd = ["#f0f5ff", "#d6e4ff", "#adc6ff", "#85a5ff", "#597ef7", "#2f54eb", "#1d39c4", "#10239e", "#061178", "#030852"];
rd.primary = rd[5];
const od = ["#f9f0ff", "#efdbff", "#d3adf7", "#b37feb", "#9254de", "#722ed1", "#531dab", "#391085", "#22075e", "#120338"];
od.primary = od[5];
const id = ["#fff0f6", "#ffd6e7", "#ffadd2", "#ff85c0", "#f759ab", "#eb2f96", "#c41d7f", "#9e1068", "#780650", "#520339"];
id.primary = id[5];
const sd = ["#a6a6a6", "#999999", "#8c8c8c", "#808080", "#737373", "#666666", "#404040", "#1a1a1a", "#000000", "#000000"];
sd.primary = sd[5];
const mf = {
  red: Gf,
  volcano: Yf,
  orange: Kf,
  gold: Qf,
  yellow: Zf,
  lime: Jf,
  green: ed,
  cyan: td,
  blue: nd,
  geekblue: rd,
  purple: od,
  magenta: id,
  grey: sd
};
function Qy(e, {
  generateColorPalettes: n,
  generateNeutralColorPalettes: o
}) {
  const {
    colorSuccess: i,
    colorWarning: l,
    colorError: c,
    colorInfo: f,
    colorPrimary: p,
    colorBgBase: g,
    colorTextBase: h
  } = e, y = n(p), v = n(i), S = n(l), x = n(c), b = n(f), C = o(g, h), E = e.colorLink || e.colorInfo, $ = n(E), k = new Pt(x[1]).mix(new Pt(x[3]), 50).toHexString(), P = {};
  return Li.forEach((R) => {
    const M = e[R];
    if (M) {
      const I = n(M);
      P[`${R}Hover`] = I[5], P[`${R}Active`] = I[7];
    }
  }), {
    ...C,
    colorPrimaryBg: y[1],
    colorPrimaryBgHover: y[2],
    colorPrimaryBorder: y[3],
    colorPrimaryBorderHover: y[4],
    colorPrimaryHover: y[5],
    colorPrimary: y[6],
    colorPrimaryActive: y[7],
    colorPrimaryTextHover: y[8],
    colorPrimaryText: y[9],
    colorPrimaryTextActive: y[10],
    colorSuccessBg: v[1],
    colorSuccessBgHover: v[2],
    colorSuccessBorder: v[3],
    colorSuccessBorderHover: v[4],
    colorSuccessHover: v[4],
    colorSuccess: v[6],
    colorSuccessActive: v[7],
    colorSuccessTextHover: v[8],
    colorSuccessText: v[9],
    colorSuccessTextActive: v[10],
    colorErrorBg: x[1],
    colorErrorBgHover: x[2],
    colorErrorBgFilledHover: k,
    colorErrorBgActive: x[3],
    colorErrorBorder: x[3],
    colorErrorBorderHover: x[4],
    colorErrorHover: x[5],
    colorError: x[6],
    colorErrorActive: x[7],
    colorErrorTextHover: x[8],
    colorErrorText: x[9],
    colorErrorTextActive: x[10],
    colorWarningBg: S[1],
    colorWarningBgHover: S[2],
    colorWarningBorder: S[3],
    colorWarningBorderHover: S[4],
    colorWarningHover: S[4],
    colorWarning: S[6],
    colorWarningActive: S[7],
    colorWarningTextHover: S[8],
    colorWarningText: S[9],
    colorWarningTextActive: S[10],
    colorInfoBg: b[1],
    colorInfoBgHover: b[2],
    colorInfoBorder: b[3],
    colorInfoBorderHover: b[4],
    colorInfoHover: b[4],
    colorInfo: b[6],
    colorInfoActive: b[7],
    colorInfoTextHover: b[8],
    colorInfoText: b[9],
    colorInfoTextActive: b[10],
    colorLinkHover: $[4],
    colorLink: $[6],
    colorLinkActive: $[7],
    ...P,
    colorBgMask: new Pt("#000").setA(0.45).toRgbString(),
    colorWhite: "#fff"
  };
}
const $C = (e) => {
  let n = e, o = e, i = e, l = e;
  return e < 6 && e >= 5 ? n = e + 1 : e < 16 && e >= 6 ? n = e + 2 : e >= 16 && (n = 16), e < 7 && e >= 5 ? o = 4 : e < 8 && e >= 7 ? o = 5 : e < 14 && e >= 8 ? o = 6 : e < 16 && e >= 14 ? o = 7 : e >= 16 && (o = 8), e < 6 && e >= 2 ? i = 1 : e >= 6 && (i = 2), e > 4 && e < 8 ? l = 4 : e >= 8 && (l = 6), {
    borderRadius: e,
    borderRadiusXS: i,
    borderRadiusSM: o,
    borderRadiusLG: n,
    borderRadiusOuter: l
  };
};
function _C(e) {
  const {
    motionUnit: n,
    motionBase: o,
    borderRadius: i,
    lineWidth: l
  } = e;
  return {
    // motion
    motionDurationFast: `${(o + n).toFixed(1)}s`,
    motionDurationMid: `${(o + n * 2).toFixed(1)}s`,
    motionDurationSlow: `${(o + n * 3).toFixed(1)}s`,
    // line
    lineWidthBold: l + 1,
    // radius
    ...$C(i)
  };
}
const Zy = (e) => {
  const {
    controlHeight: n
  } = e;
  return {
    controlHeightSM: n * 0.75,
    controlHeightXS: n * 0.5,
    controlHeightLG: n * 1.25
  };
}, Jy = (e) => {
  const n = vC(e), o = n.map((y) => y.size), i = n.map((y) => y.lineHeight), l = o[1], c = o[0], f = o[2], p = i[1], g = i[0], h = i[2];
  return {
    fontSizeSM: c,
    fontSize: l,
    fontSizeLG: f,
    fontSizeXL: o[3],
    fontSizeHeading1: o[6],
    fontSizeHeading2: o[5],
    fontSizeHeading3: o[4],
    fontSizeHeading4: o[3],
    fontSizeHeading5: o[2],
    lineHeight: p,
    lineHeightLG: h,
    lineHeightSM: g,
    fontHeight: Math.round(p * l),
    fontHeightLG: Math.round(h * f),
    fontHeightSM: Math.round(g * c),
    lineHeightHeading1: i[6],
    lineHeightHeading2: i[5],
    lineHeightHeading3: i[4],
    lineHeightHeading4: i[3],
    lineHeightHeading5: i[2]
  };
};
function PC(e) {
  const {
    sizeUnit: n,
    sizeStep: o
  } = e;
  return {
    sizeXXL: n * (o + 8),
    // 48
    sizeXL: n * (o + 4),
    // 32
    sizeLG: n * (o + 2),
    // 24
    sizeMD: n * (o + 1),
    // 20
    sizeMS: n * o,
    // 16
    size: n * o,
    // 16
    sizeSM: n * (o - 1),
    // 12
    sizeXS: n * (o - 2),
    // 8
    sizeXXS: n * (o - 3)
    // 4
  };
}
const Gn = (e, n) => new Pt(e).setA(n).toRgbString(), _i = (e, n) => new Pt(e).darken(n).toHexString(), RC = (e) => {
  const n = hc(e);
  return {
    1: n[0],
    2: n[1],
    3: n[2],
    4: n[3],
    5: n[4],
    6: n[5],
    7: n[6],
    8: n[4],
    9: n[5],
    10: n[6]
  };
}, kC = (e, n, o) => {
  const i = e || "#fff", l = n || "#000";
  return {
    colorBgBase: i,
    colorTextBase: l,
    colorShadow: o || "#000",
    colorText: Gn(l, 0.88),
    colorTextSecondary: Gn(l, 0.65),
    colorTextTertiary: Gn(l, 0.45),
    colorTextQuaternary: Gn(l, 0.25),
    colorFill: Gn(l, 0.15),
    colorFillSecondary: Gn(l, 0.06),
    colorFillTertiary: Gn(l, 0.04),
    colorFillQuaternary: Gn(l, 0.02),
    colorBgSolid: Gn(l, 1),
    colorBgSolidHover: Gn(l, 0.75),
    colorBgSolidActive: Gn(l, 0.95),
    colorBgLayout: _i(i, 4),
    colorBgContainer: _i(i, 0),
    colorBgElevated: _i(i, 0),
    colorBgSpotlight: Gn(l, 0.85),
    colorBgBlur: "transparent",
    colorBorder: _i(i, 15),
    colorBorderDisabled: _i(i, 15),
    colorBorderSecondary: _i(i, 6)
  };
};
function mc(e) {
  Fi.pink = Fi.magenta, mf.pink = mf.magenta;
  const n = Object.keys(fp).map((o) => {
    const i = e[o] === Fi[o] ? mf[o] : hc(e[o]);
    return Array.from({
      length: 10
    }, () => 1).reduce((l, c, f) => (l[`${o}-${f + 1}`] = i[f], l[`${o}${f + 1}`] = i[f], l), {});
  }).reduce((o, i) => (o = {
    ...o,
    ...i
  }, o), {});
  return {
    ...e,
    ...n,
    // Colors
    ...Qy(e, {
      generateColorPalettes: RC,
      generateNeutralColorPalettes: kC
    }),
    // Font
    ...Jy(e.fontSize),
    // Size
    ...PC(e),
    // Height
    ...Zy(e),
    // Others
    ..._C(e)
  };
}
const dp = Ga(mc), sl = {
  token: Bi,
  override: {
    override: Bi
  },
  hashed: !0
}, pp = /* @__PURE__ */ ye.createContext(sl);
function gf(e) {
  return e >= 0 && e <= 255;
}
function wa(e, n) {
  const {
    r: o,
    g: i,
    b: l,
    a: c
  } = new Pt(e).toRgb();
  if (c < 1)
    return e;
  const {
    r: f,
    g: p,
    b: g
  } = new Pt(n).toRgb();
  for (let h = 0.01; h <= 1; h += 0.01) {
    const y = Math.round((o - f * (1 - h)) / h), v = Math.round((i - p * (1 - h)) / h), S = Math.round((l - g * (1 - h)) / h);
    if (gf(y) && gf(v) && gf(S))
      return new Pt({
        r: y,
        g: v,
        b: S,
        a: Math.round(h * 100) / 100
      }).toRgbString();
  }
  return new Pt({
    r: o,
    g: i,
    b: l,
    a: 1
  }).toRgbString();
}
function ev(e) {
  const {
    override: n,
    ...o
  } = e, i = {
    ...n
  };
  Object.keys(Bi).forEach((E) => {
    delete i[E];
  });
  const l = {
    ...o,
    ...i
  }, c = new Pt(l.colorShadow), f = c.a, p = (E) => c.clone().setA(f * E).toRgbString(), g = 480, h = 576, y = 768, v = 992, S = 1200, x = 1600, b = 1920;
  return l.motion === !1 && (l.motionDurationFast = "0s", l.motionDurationMid = "0s", l.motionDurationSlow = "0s"), {
    ...l,
    // ============== Background ============== //
    colorFillContent: l.colorFillSecondary,
    colorFillContentHover: l.colorFill,
    colorFillAlter: l.colorFillQuaternary,
    colorBgContainerDisabled: l.colorFillTertiary,
    // ============== Split ============== //
    colorBorderBg: l.colorBgContainer,
    colorSplit: wa(l.colorBorderSecondary, l.colorBgContainer),
    // ============== Text ============== //
    colorTextPlaceholder: l.colorTextQuaternary,
    colorTextDisabled: l.colorTextQuaternary,
    colorTextHeading: l.colorText,
    colorTextLabel: l.colorTextSecondary,
    colorTextDescription: l.colorTextTertiary,
    colorTextLightSolid: l.colorWhite,
    colorHighlight: l.colorError,
    colorBgTextHover: l.colorFillSecondary,
    colorBgTextActive: l.colorFill,
    colorIcon: l.colorTextTertiary,
    colorIconHover: l.colorText,
    colorErrorOutline: wa(l.colorErrorBg, l.colorBgContainer),
    colorWarningOutline: wa(l.colorWarningBg, l.colorBgContainer),
    colorErrorAffix: l.colorError,
    colorWarningAffix: l.colorWarning,
    // Font
    fontSizeIcon: l.fontSizeSM,
    // Line
    lineWidthFocus: l.lineWidth * 3,
    // Control
    lineWidth: l.lineWidth,
    controlOutlineWidth: l.lineWidth * 2,
    // Checkbox size and expand icon size
    controlInteractiveSize: l.controlHeight / 2,
    controlItemBgHover: l.colorFillTertiary,
    controlItemBgActive: l.colorPrimaryBg,
    controlItemBgActiveHover: l.colorPrimaryBgHover,
    controlItemBgActiveDisabled: l.colorFill,
    controlTmpOutline: l.colorFillQuaternary,
    controlOutline: wa(l.colorPrimaryBg, l.colorBgContainer),
    lineType: l.lineType,
    borderRadius: l.borderRadius,
    borderRadiusXS: l.borderRadiusXS,
    borderRadiusSM: l.borderRadiusSM,
    borderRadiusLG: l.borderRadiusLG,
    fontWeightStrong: 600,
    opacityLoading: 0.65,
    linkDecoration: "none",
    linkHoverDecoration: "none",
    linkFocusDecoration: "none",
    controlPaddingHorizontal: 12,
    controlPaddingHorizontalSM: 8,
    paddingXXS: l.sizeXXS,
    paddingXS: l.sizeXS,
    paddingSM: l.sizeSM,
    padding: l.size,
    paddingMD: l.sizeMD,
    paddingLG: l.sizeLG,
    paddingXL: l.sizeXL,
    paddingContentHorizontalLG: l.sizeLG,
    paddingContentVerticalLG: l.sizeMS,
    paddingContentHorizontal: l.sizeMS,
    paddingContentVertical: l.sizeSM,
    paddingContentHorizontalSM: l.size,
    paddingContentVerticalSM: l.sizeXS,
    marginXXS: l.sizeXXS,
    marginXS: l.sizeXS,
    marginSM: l.sizeSM,
    margin: l.size,
    marginMD: l.sizeMD,
    marginLG: l.sizeLG,
    marginXL: l.sizeXL,
    marginXXL: l.sizeXXL,
    boxShadow: `
      0 6px 16px 0 ${p(0.08)},
      0 3px 6px -4px ${p(0.12)},
      0 9px 28px 8px ${p(0.05)}
    `,
    boxShadowSecondary: `
      0 6px 16px 0 ${p(0.08)},
      0 3px 6px -4px ${p(0.12)},
      0 9px 28px 8px ${p(0.05)}
    `,
    boxShadowTertiary: `
      0 1px 2px 0 ${p(0.05)},
      0 1px 6px -1px ${p(0.03)},
      0 2px 4px 0 ${p(0.03)}
    `,
    screenXS: g,
    screenXSMin: g,
    screenXSMax: h - 1,
    screenSM: h,
    screenSMMin: h,
    screenSMMax: y - 1,
    screenMD: y,
    screenMDMin: y,
    screenMDMax: v - 1,
    screenLG: v,
    screenLGMin: v,
    screenLGMax: S - 1,
    screenXL: S,
    screenXLMin: S,
    screenXLMax: x - 1,
    screenXXL: x,
    screenXXLMin: x,
    screenXXLMax: b - 1,
    screenXXXL: b,
    screenXXXLMin: b,
    boxShadowPopoverArrow: `2px 2px 5px ${p(0.05)}`,
    dropShadowPopover: `drop-shadow(0 6px 16px ${p(0.08)}) drop-shadow(0 3px 6px ${p(0.12)}) drop-shadow(0 9px 28px ${p(0.05)})`,
    boxShadowCard: `
      0 1px 2px -2px ${p(0.16)},
      0 3px 6px 0 ${p(0.12)},
      0 5px 12px 4px ${p(0.09)}
    `,
    boxShadowDrawerRight: `
      -6px 0 16px 0 ${p(0.08)},
      -3px 0 6px -4px ${p(0.12)},
      -9px 0 28px 8px ${p(0.05)}
    `,
    boxShadowDrawerLeft: `
      6px 0 16px 0 ${p(0.08)},
      3px 0 6px -4px ${p(0.12)},
      9px 0 28px 8px ${p(0.05)}
    `,
    boxShadowDrawerUp: `
      0 6px 16px 0 ${p(0.08)},
      0 3px 6px -4px ${p(0.12)},
      0 9px 28px 8px ${p(0.05)}
    `,
    boxShadowDrawerDown: `
      0 -6px 16px 0 ${p(0.08)},
      0 -3px 6px -4px ${p(0.12)},
      0 -9px 28px 8px ${p(0.05)}
    `,
    boxShadowTabsOverflowLeft: `inset 10px 0 8px -8px ${p(0.08)}`,
    boxShadowTabsOverflowRight: `inset -10px 0 8px -8px ${p(0.08)}`,
    boxShadowTabsOverflowTop: `inset 0 10px 8px -8px ${p(0.08)}`,
    boxShadowTabsOverflowBottom: `inset 0 -10px 8px -8px ${p(0.08)}`,
    // Override AliasToken
    ...i
  };
}
const tv = {
  lineHeight: !0,
  lineHeightSM: !0,
  lineHeightLG: !0,
  lineHeightHeading1: !0,
  lineHeightHeading2: !0,
  lineHeightHeading3: !0,
  lineHeightHeading4: !0,
  lineHeightHeading5: !0,
  opacityLoading: !0,
  fontWeightStrong: !0,
  zIndexPopupBase: !0,
  zIndexBase: !0,
  opacityImage: !0
}, MC = {
  motionBase: !0,
  motionUnit: !0
}, TC = {
  screenXS: !0,
  screenXSMin: !0,
  screenXSMax: !0,
  screenSM: !0,
  screenSMMin: !0,
  screenSMMax: !0,
  screenMD: !0,
  screenMDMin: !0,
  screenMDMax: !0,
  screenLG: !0,
  screenLGMin: !0,
  screenLGMax: !0,
  screenXL: !0,
  screenXLMin: !0,
  screenXLMax: !0,
  screenXXL: !0,
  screenXXLMin: !0,
  screenXXLMax: !0,
  screenXXXL: !0,
  screenXXXLMin: !0
}, nv = (e, n, o) => {
  const i = o.getDerivativeToken(e), {
    override: l,
    ...c
  } = n;
  let f = {
    ...i,
    override: l
  };
  return f = ev(f), c && Object.entries(c).forEach(([p, g]) => {
    const {
      theme: h,
      ...y
    } = g;
    let v = y;
    h && (v = nv({
      ...f,
      ...y
    }, {
      override: y
    }, h)), f[p] = v;
  }), f;
};
function Gi() {
  const {
    token: e,
    hashed: n,
    theme: o,
    override: i,
    cssVar: l,
    zeroRuntime: c
  } = ye.useContext(pp), {
    csp: f,
    getPrefixCls: p
  } = ye.useContext(On), g = {
    prefix: l?.prefix ?? p(),
    key: l?.key ?? "css-var-root"
  }, h = `${SC}-${n || ""}`, y = o || dp, [v, S, x] = Iw(y, [Bi, e], {
    salt: h,
    override: i,
    getComputedToken: nv,
    cssVar: {
      ...g,
      unitless: tv,
      ignore: MC,
      preserve: TC
    },
    nonce: f?.nonce
  });
  return [y, x, n ? S : "", v, g, !!c];
}
const NC = {
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis"
}, Ur = (e, n = !1) => ({
  boxSizing: "border-box",
  margin: 0,
  padding: 0,
  color: e.colorText,
  fontSize: e.fontSize,
  // font-variant: @font-variant-base;
  lineHeight: e.lineHeight,
  listStyle: "none",
  // font-feature-settings: @font-feature-settings-base;
  fontFamily: n ? "inherit" : e.fontFamily
}), rv = () => ({
  display: "inline-flex",
  alignItems: "center",
  color: "inherit",
  fontStyle: "normal",
  lineHeight: 0,
  textAlign: "center",
  textTransform: "none",
  // for SVG icon, see https://blog.prototypr.io/align-svg-icons-to-text-and-say-goodbye-to-font-icons-d44b3d7b26b4
  verticalAlign: "-0.125em",
  textRendering: "optimizeLegibility",
  "-webkit-font-smoothing": "antialiased",
  "-moz-osx-font-smoothing": "grayscale",
  "> *": {
    lineHeight: 1
  },
  svg: {
    display: "inline-block",
    verticalAlign: "inherit"
  }
}), IC = new ln("loadingCircle", {
  "100%": {
    transform: "rotate(360deg)"
  }
}), FC = () => ({
  // https://github.com/ant-design/ant-design/issues/21301#issuecomment-583955229
  "&::before": {
    display: "table",
    content: '""'
  },
  "&::after": {
    // https://github.com/ant-design/ant-design/issues/21864
    display: "table",
    clear: "both",
    content: '""'
  }
}), hp = (e, n) => ({
  outline: `${$e(e.lineWidthFocus)} solid ${e.colorPrimaryBorder}`,
  outlineOffset: 1,
  transition: ["outline-offset", "outline"].map((o) => `${o} 0s`).join(", ")
}), ov = (e, n) => ({
  "&:focus-visible": hp(e)
}), zC = (e) => ({
  a: {
    color: e.colorLink,
    textDecoration: e.linkDecoration,
    backgroundColor: "transparent",
    // remove the gray background on active links in IE 10.
    outline: "none",
    cursor: "pointer",
    transition: `color ${e.motionDurationSlow}`,
    "-webkit-text-decoration-skip": "objects",
    // remove gaps in links underline in iOS 8+ and Safari 8+.
    "&:hover": {
      color: e.colorLinkHover
    },
    "&:active": {
      color: e.colorLinkActive
    },
    "&:active, &:hover": {
      textDecoration: e.linkHoverDecoration,
      outline: 0
    },
    // https://github.com/ant-design/ant-design/issues/22503
    "&:focus": {
      textDecoration: e.linkFocusDecoration,
      outline: 0
    },
    ...ov(e),
    "&[disabled]": {
      color: e.colorTextDisabled,
      cursor: "not-allowed"
    }
  }
}), OC = (e, n, o, i) => {
  const l = `[class^="${n}"], [class*=" ${n}"]`, c = o ? `.${o}` : l, f = {
    boxSizing: "border-box",
    "&::before, &::after": {
      boxSizing: "border-box"
    }
  };
  let p = {};
  return i !== !1 && (p = {
    fontFamily: e.fontFamily,
    fontSize: e.fontSize
  }), {
    [c]: {
      ...p,
      ...f,
      [l]: f
    }
  };
}, iv = (e) => ({
  [`.${e}`]: {
    ...rv(),
    "&::before": {
      display: "none"
    },
    "&[tabindex]": {
      cursor: "pointer"
    }
  },
  [`.${e} .${e}-icon`]: {
    display: "block"
  },
  [`.${e}-spin`]: {
    animationName: IC,
    animationDuration: "1s",
    animationIterationCount: "infinite",
    animationTimingFunction: "linear"
  }
}), {
  genStyleHooks: Xr
} = gC({
  usePrefix: () => {
    const {
      getPrefixCls: e,
      iconPrefixCls: n
    } = m.useContext(On);
    return {
      rootPrefixCls: e(),
      iconPrefixCls: n
    };
  },
  useToken: () => {
    const [e, n, o, i, l, c] = Gi();
    return {
      theme: e,
      realToken: n,
      hashId: o,
      token: i,
      cssVar: l,
      zeroRuntime: c
    };
  },
  useCSP: () => {
    const {
      csp: e
    } = m.useContext(On);
    return e ?? {};
  },
  getResetStyles: (e, n) => {
    const o = zC(e);
    return [o, {
      "&": o
    }, iv(n?.prefix.iconPrefixCls ?? up)];
  },
  getCommonStyle: OC,
  getCompUnitless: () => tv
}), fl = (e, n) => {
  const o = `--${e.replace(/\./g, "")}-${n}-`;
  return [(c) => `${o}${c}`, (c, f) => f ? `var(${o}${c}, ${f})` : `var(${o}${c})`];
};
function AC(e, n) {
  return Li.reduce((o, i) => {
    const l = e[`${i}1`], c = e[`${i}3`], f = e[`${i}6`], p = e[`${i}7`];
    return {
      ...o,
      ...n(i, {
        lightColor: l,
        lightBorderColor: c,
        darkColor: f,
        textColor: p
      })
    };
  }, {});
}
const LC = (e, n) => (Gi(), Df({
  hashId: "",
  path: ["ant-design-icons", e],
  nonce: () => n?.nonce,
  layer: {
    name: "antd"
  }
}, () => iv(e)));
var xa = {}, Lg;
function BC() {
  if (Lg) return xa;
  Lg = 1, Object.defineProperty(xa, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm193.5 301.7l-210.6 292a31.8 31.8 0 01-51.7 0L318.5 484.9c-3.8-5.3 0-12.7 6.5-12.7h46.9c10.2 0 19.9 4.9 25.9 13.3l71.2 98.8 157.2-218c6-8.3 15.6-13.3 25.9-13.3H699c6.5 0 10.3 7.4 6.5 12.7z" } }] }, name: "check-circle", theme: "filled" };
  return xa.default = e, xa;
}
var HC = /* @__PURE__ */ BC();
const DC = /* @__PURE__ */ nr(HC), mp = /* @__PURE__ */ m.createContext({}), Bg = "data-rc-order", Hg = "data-rc-priority", jC = "rc-util-key", ld = /* @__PURE__ */ new Map();
function sv() {
  return !!(typeof window < "u" && window.document && window.document.createElement);
}
function VC(e, n) {
  if (!e || !n)
    return !1;
  if (e.contains)
    return e.contains(n);
  let o = n;
  for (; o; ) {
    if (o === e)
      return !0;
    o = o.parentNode;
  }
  return !1;
}
function lv({
  mark: e
} = {}) {
  return e ? e.startsWith("data-") ? e : `data-${e}` : jC;
}
function gp(e) {
  return e.attachTo ? e.attachTo : document.querySelector("head") || document.body;
}
function WC(e) {
  return e === "queue" ? "prependQueue" : e ? "prepend" : "append";
}
function yp(e) {
  return Array.from((ld.get(e) || e).children).filter((n) => n.tagName === "STYLE");
}
function av(e, n = {}) {
  if (!sv())
    return null;
  const {
    csp: o,
    prepend: i,
    priority: l = 0
  } = n, c = WC(i), f = c === "prependQueue", p = document.createElement("style");
  p.setAttribute(Bg, c), f && l && p.setAttribute(Hg, `${l}`), o?.nonce && (p.nonce = o.nonce), p.innerHTML = e;
  const g = gp(n), {
    firstChild: h
  } = g;
  if (i) {
    if (f) {
      const y = (n.styles || yp(g)).filter((v) => {
        if (!["prepend", "prependQueue"].includes(v.getAttribute(Bg)))
          return !1;
        const S = Number(v.getAttribute(Hg) || 0);
        return l >= S;
      });
      if (y.length)
        return g.insertBefore(p, y[y.length - 1].nextSibling), p;
    }
    g.insertBefore(p, h);
  } else
    g.appendChild(p);
  return p;
}
function qC(e, n = {}) {
  let {
    styles: o
  } = n;
  return o ||= yp(gp(n)), o.find((i) => i.getAttribute(lv(n)) === e);
}
function UC(e, n) {
  const o = ld.get(e);
  if (!o || !VC(document, o)) {
    const i = av("", n);
    if (!i)
      return;
    const {
      parentNode: l
    } = i;
    ld.set(e, l), e.removeChild(i);
  }
}
function XC(e, n, o = {}) {
  if (!sv())
    return null;
  const i = gp(o), l = yp(i), c = {
    ...o,
    styles: l
  };
  UC(i, c);
  const f = qC(n, c);
  if (f)
    return c.csp?.nonce && f.nonce !== c.csp.nonce && (f.nonce = c.csp.nonce), f.innerHTML !== e && (f.innerHTML = e), f;
  const p = av(e, c);
  return p?.setAttribute(lv(c), n), p;
}
function GC(e) {
  return e?.getRootNode?.();
}
function YC(e) {
  const n = GC(e);
  return typeof ShadowRoot < "u" && n instanceof ShadowRoot ? n : null;
}
const Dg = {};
function KC(e, n) {
  e || Dg[n] || (Dg[n] = !0);
}
function QC(e) {
  return e.replace(/-(.)/g, (n, o) => o.toUpperCase());
}
function ZC(e, n) {
  KC(e, `[@ant-design/icons] ${n}`);
}
function jg(e) {
  return typeof e == "object" && typeof e.name == "string" && typeof e.theme == "string" && (typeof e.icon == "object" || typeof e.icon == "function");
}
function Vg(e = {}) {
  return Object.keys(e).reduce((n, o) => {
    const i = e[o];
    return o === "class" ? (n.className = i, delete n.class) : (delete n[o], n[QC(o)] = i), n;
  }, {});
}
function ad(e, n, o) {
  return o ? /* @__PURE__ */ ye.createElement(e.tag, {
    key: n,
    ...Vg(e.attrs),
    ...o
  }, (e.children || []).map((i, l) => ad(i, `${n}-${e.tag}-${l}`))) : /* @__PURE__ */ ye.createElement(e.tag, {
    key: n,
    ...Vg(e.attrs)
  }, (e.children || []).map((i, l) => ad(i, `${n}-${e.tag}-${l}`)));
}
const JC = `
.anticon {
  display: inline-flex;
  align-items: center;
  color: inherit;
  font-style: normal;
  line-height: 0;
  text-align: center;
  text-transform: none;
  vertical-align: -0.125em;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.anticon > * {
  line-height: 1;
}

.anticon svg {
  display: inline-block;
  vertical-align: inherit;
}

.anticon::before {
  display: none;
}

.anticon .anticon-icon {
  display: block;
}

.anticon[tabindex] {
  cursor: pointer;
}

.anticon-spin {
  -webkit-animation: loadingCircle 1s infinite linear;
  animation: loadingCircle 1s infinite linear;
}

@-webkit-keyframes loadingCircle {
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}

@keyframes loadingCircle {
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}
`, eb = (e) => {
  const {
    csp: n,
    prefixCls: o,
    layer: i,
    zeroRuntime: l
  } = m.useContext(mp);
  let c = JC;
  o && (c = c.replace(/anticon/g, o)), i && (c = `@layer ${i} {
${c}
}`), m.useEffect(() => {
    if (l)
      return;
    const f = e.current, p = YC(f);
    XC(c, "@ant-design-icons", {
      prepend: !i,
      csp: n,
      attachTo: p
    });
  }, []);
}, cv = (e) => {
  const {
    icon: n,
    className: o,
    onClick: i,
    style: l,
    primaryColor: c,
    secondaryColor: f,
    ...p
  } = e, g = m.useRef(null);
  if (eb(g), ZC(jg(n), `icon should be icon definiton, but got ${n}`), !jg(n))
    return null;
  const h = n;
  return ad(h.icon, `svg-${h.name}`, {
    className: o,
    onClick: i,
    style: l,
    "data-icon": h.name,
    width: "1em",
    height: "1em",
    fill: "currentColor",
    "aria-hidden": "true",
    ...p,
    ref: g
  });
};
cv.displayName = "IconReact";
function cd() {
  return cd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, cd.apply(this, arguments);
}
const kr = /* @__PURE__ */ m.forwardRef((e, n) => {
  const {
    // affect outter <i>...</i>
    className: o,
    // affect inner <svg>...</svg>
    icon: i,
    spin: l,
    rotate: c,
    tabIndex: f,
    onClick: p,
    twoToneColor: g,
    // other
    ...h
  } = e, {
    prefixCls: y = "anticon",
    rootClassName: v
  } = m.useContext(mp), S = we(v, y, {
    [`${y}-${i.name}`]: !!i.name,
    [`${y}-spin`]: !!l || i.name === "loading"
  }, o);
  let x = f;
  x === void 0 && p && (x = -1);
  const b = c ? {
    msTransform: `rotate(${c}deg)`,
    transform: `rotate(${c}deg)`
  } : void 0;
  return /* @__PURE__ */ m.createElement("span", cd({
    role: "img",
    "aria-label": i.name
  }, h, {
    ref: n,
    tabIndex: x,
    onClick: p,
    className: S
  }), /* @__PURE__ */ m.createElement(cv, {
    icon: i,
    style: b
  }));
});
function ud() {
  return ud = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, ud.apply(this, arguments);
}
const tb = (e, n) => /* @__PURE__ */ m.createElement(kr, ud({}, e, {
  ref: n,
  icon: DC
})), nb = /* @__PURE__ */ m.forwardRef(tb);
var Ca = {}, Wg;
function rb() {
  if (Wg) return Ca;
  Wg = 1, Object.defineProperty(Ca, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { "fill-rule": "evenodd", viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M512 64c247.4 0 448 200.6 448 448S759.4 960 512 960 64 759.4 64 512 264.6 64 512 64zm127.98 274.82h-.04l-.08.06L512 466.75 384.14 338.88c-.04-.05-.06-.06-.08-.06a.12.12 0 00-.07 0c-.03 0-.05.01-.09.05l-45.02 45.02a.2.2 0 00-.05.09.12.12 0 000 .07v.02a.27.27 0 00.06.06L466.75 512 338.88 639.86c-.05.04-.06.06-.06.08a.12.12 0 000 .07c0 .03.01.05.05.09l45.02 45.02a.2.2 0 00.09.05.12.12 0 00.07 0c.02 0 .04-.01.08-.05L512 557.25l127.86 127.87c.04.04.06.05.08.05a.12.12 0 00.07 0c.03 0 .05-.01.09-.05l45.02-45.02a.2.2 0 00.05-.09.12.12 0 000-.07v-.02a.27.27 0 00-.05-.06L557.25 512l127.87-127.86c.04-.04.05-.06.05-.08a.12.12 0 000-.07c0-.03-.01-.05-.05-.09l-45.02-45.02a.2.2 0 00-.09-.05.12.12 0 00-.07 0z" } }] }, name: "close-circle", theme: "filled" };
  return Ca.default = e, Ca;
}
var ob = /* @__PURE__ */ rb();
const ib = /* @__PURE__ */ nr(ob);
function fd() {
  return fd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, fd.apply(this, arguments);
}
const sb = (e, n) => /* @__PURE__ */ m.createElement(kr, fd({}, e, {
  ref: n,
  icon: ib
})), lb = /* @__PURE__ */ m.forwardRef(sb);
var ba = {}, qg;
function ab() {
  if (qg) return ba;
  qg = 1, Object.defineProperty(ba, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { "fill-rule": "evenodd", viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M799.86 166.31c.02 0 .04.02.08.06l57.69 57.7c.04.03.05.05.06.08a.12.12 0 010 .06c0 .03-.02.05-.06.09L569.93 512l287.7 287.7c.04.04.05.06.06.09a.12.12 0 010 .07c0 .02-.02.04-.06.08l-57.7 57.69c-.03.04-.05.05-.07.06a.12.12 0 01-.07 0c-.03 0-.05-.02-.09-.06L512 569.93l-287.7 287.7c-.04.04-.06.05-.09.06a.12.12 0 01-.07 0c-.02 0-.04-.02-.08-.06l-57.69-57.7c-.04-.03-.05-.05-.06-.07a.12.12 0 010-.07c0-.03.02-.05.06-.09L454.07 512l-287.7-287.7c-.04-.04-.05-.06-.06-.09a.12.12 0 010-.07c0-.02.02-.04.06-.08l57.7-57.69c.03-.04.05-.05.07-.06a.12.12 0 01.07 0c.03 0 .05.02.09.06L512 454.07l287.7-287.7c.04-.04.06-.05.09-.06a.12.12 0 01.07 0z" } }] }, name: "close", theme: "outlined" };
  return ba.default = e, ba;
}
var cb = /* @__PURE__ */ ab();
const ub = /* @__PURE__ */ nr(cb);
function dd() {
  return dd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, dd.apply(this, arguments);
}
const fb = (e, n) => /* @__PURE__ */ m.createElement(kr, dd({}, e, {
  ref: n,
  icon: ub
})), db = /* @__PURE__ */ m.forwardRef(fb), uv = /* @__PURE__ */ m.createContext({}), pb = (e) => {
  const {
    children: n,
    ...o
  } = e, i = m.useMemo(() => ({
    motion: o.motion
  }), [o.motion]);
  return /* @__PURE__ */ m.createElement(uv.Provider, {
    value: i
  }, n);
}, Pr = "none", Ea = "appear", $a = "enter", _a = "leave", Ug = "none", hr = "prepare", Do = "start", jo = "active", vp = "end", fv = "prepared";
function Xg(e, n) {
  const o = {};
  return o[e.toLowerCase()] = n.toLowerCase(), o[`Webkit${e}`] = `webkit${n}`, o[`Moz${e}`] = `moz${n}`, o[`ms${e}`] = `MS${n}`, o[`O${e}`] = `o${n.toLowerCase()}`, o;
}
function hb(e, n) {
  const o = {
    animationend: Xg("Animation", "AnimationEnd"),
    transitionend: Xg("Transition", "TransitionEnd")
  };
  return e && ("AnimationEvent" in n || delete o.animationend.animation, "TransitionEvent" in n || delete o.transitionend.transition), o;
}
const mb = hb(er(), typeof window < "u" ? window : {});
let dv = {};
er() && ({
  style: dv
} = document.createElement("div"));
const Pa = {};
function pv(e) {
  if (Pa[e])
    return Pa[e];
  const n = mb[e];
  if (n) {
    const o = Object.keys(n), i = o.length;
    for (let l = 0; l < i; l += 1) {
      const c = o[l];
      if (Object.prototype.hasOwnProperty.call(n, c) && c in dv)
        return Pa[e] = n[c], Pa[e];
    }
  }
  return "";
}
const hv = pv("animationend"), mv = pv("transitionend"), gb = !!(hv && mv), Gg = hv || "animationend", Yg = mv || "transitionend";
function Kg(e, n) {
  if (!e) return null;
  if (typeof e == "object") {
    const o = n.replace(/-\w/g, (i) => i[1].toUpperCase());
    return e[o];
  }
  return `${e}-${n}`;
}
const yb = ((e) => {
  const n = m.useRef();
  function o(l) {
    l && (l.removeEventListener(Yg, e), l.removeEventListener(Gg, e));
  }
  function i(l) {
    n.current && n.current !== l && o(n.current), l && l !== n.current && (l.addEventListener(Yg, e), l.addEventListener(Gg, e), n.current = l);
  }
  return m.useEffect(() => () => {
    o(n.current), n.current = null;
  }, []), [i, o];
}), gv = er() ? m.useLayoutEffect : m.useEffect, vb = (() => {
  const e = m.useRef(null);
  function n() {
    xo.cancel(e.current);
  }
  function o(i, l = 2) {
    n();
    const c = xo(() => {
      l <= 1 ? i({
        isCanceled: () => c !== e.current
      }) : o(i, l - 1);
    });
    e.current = c;
  }
  return m.useEffect(() => () => {
    n();
  }, []), [o, n];
}), Sb = [hr, Do, jo, vp], wb = [hr, fv], yv = !1, xb = !0;
function vv(e) {
  return e === jo || e === vp;
}
const Cb = ((e, n, o) => {
  const [i, l] = sx(Ug), [c, f] = vb();
  function p() {
    l(hr, !0);
  }
  const g = n ? wb : Sb;
  return gv(() => {
    if (i !== Ug && i !== vp) {
      const h = g.indexOf(i), y = g[h + 1], v = o(i);
      v === yv ? l(y, !0) : y && c((S) => {
        function x() {
          S.isCanceled() || l(y, !0);
        }
        v === !0 ? x() : Promise.resolve(v).then(x);
      });
    }
  }, [e, i]), m.useEffect(() => () => {
    f();
  }, []), [p, i];
});
function bb(e, n, o, {
  motionEnter: i = !0,
  motionAppear: l = !0,
  motionLeave: c = !0,
  motionDeadline: f,
  motionLeaveImmediately: p,
  onAppearPrepare: g,
  onEnterPrepare: h,
  onLeavePrepare: y,
  onAppearStart: v,
  onEnterStart: S,
  onLeaveStart: x,
  onAppearActive: b,
  onEnterActive: C,
  onLeaveActive: E,
  onAppearEnd: $,
  onEnterEnd: k,
  onLeaveEnd: P,
  onVisibleChanged: R
}) {
  const [M, I] = m.useState(), [z, O] = ax(Pr), [j, Y] = m.useState([null, null]), V = z(), X = m.useRef(!1), Q = m.useRef(null);
  function oe() {
    return o();
  }
  const G = m.useRef(!1);
  function le() {
    O(Pr), Y([null, null]);
  }
  const he = wt((ie) => {
    const Z = z();
    if (Z === Pr)
      return;
    const ae = oe();
    if (ie && !ie.deadline && ie.target !== ae)
      return;
    const ce = G.current;
    let Me;
    Z === Ea && ce ? Me = $?.(ae, ie) : Z === $a && ce ? Me = k?.(ae, ie) : Z === _a && ce && (Me = P?.(ae, ie)), ce && Me !== !1 && le();
  }), [D] = yb(he), J = (ie) => {
    switch (ie) {
      case Ea:
        return {
          [hr]: g,
          [Do]: v,
          [jo]: b
        };
      case $a:
        return {
          [hr]: h,
          [Do]: S,
          [jo]: C
        };
      case _a:
        return {
          [hr]: y,
          [Do]: x,
          [jo]: E
        };
      default:
        return {};
    }
  }, q = m.useMemo(() => J(V), [V]), [T, A] = Cb(V, !e, (ie) => {
    if (ie === hr) {
      const Z = q[hr];
      return Z ? Z(oe()) : yv;
    }
    return ie in q && Y([q[ie]?.(oe(), null) || null, ie]), ie === jo && V !== Pr && (D(oe()), f > 0 && (clearTimeout(Q.current), Q.current = setTimeout(() => {
      he({
        deadline: !0
      });
    }, f))), ie === fv && le(), xb;
  }), ee = vv(A);
  G.current = ee;
  const te = m.useRef(null);
  gv(() => {
    if (X.current && te.current === n)
      return;
    I(n);
    const ie = X.current;
    X.current = !0;
    let Z;
    !ie && n && l && (Z = Ea), ie && n && i && (Z = $a), (ie && !n && c || !ie && p && !n && c) && (Z = _a);
    const ae = J(Z);
    Z && (e || ae[hr]) ? (O(Z), T()) : O(Pr), te.current = n;
  }, [n]), m.useEffect(() => {
    // Cancel appear
    (V === Ea && !l || // Cancel enter
    V === $a && !i || // Cancel leave
    V === _a && !c) && O(Pr);
  }, [l, i, c]), m.useEffect(() => () => {
    X.current = !1, clearTimeout(Q.current);
  }, []);
  const se = m.useRef(!1);
  m.useEffect(() => {
    M && (se.current = !0), M !== void 0 && V === Pr && ((se.current || M) && R?.(M), se.current = !0);
  }, [M, V]);
  let re = j[0];
  q[hr] && A === Do && (re = {
    transition: "none",
    ...re
  });
  const fe = j[1];
  return [
    z,
    A,
    re,
    M ?? n,
    // Appear Check
    !X.current && V === Pr && e && l ? "NONE" : (
      // Enter or Leave check
      A === Do || A === jo ? fe === A : !0
    )
  ];
}
function Eb(e) {
  return e?.length < 2;
}
function $b(e) {
  let n = e;
  typeof e == "object" && ({
    transitionSupport: n
  } = e);
  function o(l, c) {
    return !!(l.motionName && n && c !== !1);
  }
  const i = /* @__PURE__ */ m.forwardRef((l, c) => {
    const {
      // Default config
      visible: f = !0,
      removeOnLeave: p = !0,
      forceRender: g,
      children: h,
      motionName: y,
      leavedClassName: v,
      eventProps: S
    } = l, {
      motion: x
    } = m.useContext(uv), b = o(l, x), C = m.useRef();
    function E() {
      return cp(C.current);
    }
    const [$, k, P, R, M] = bb(b, f, E, l), I = $(), z = m.useRef(R);
    R && (z.current = !0);
    const O = m.useMemo(() => {
      const V = {};
      return Object.defineProperties(V, {
        nativeElement: {
          enumerable: !0,
          get: E
        },
        inMotion: {
          enumerable: !0,
          get: () => () => $() !== Pr
        },
        enableMotion: {
          enumerable: !0,
          get: () => () => b
        }
      }), V;
    }, []);
    m.useImperativeHandle(c, () => O, []);
    const j = m.useRef(0);
    M && (j.current += 1);
    const Y = m.useMemo(() => {
      if (M === "NONE")
        return null;
      let V;
      const X = {
        ...S,
        visible: f
      };
      if (!h)
        V = null;
      else if (I === Pr)
        R ? V = h({
          ...X
        }, C) : !p && z.current && v ? V = h({
          ...X,
          className: v
        }, C) : g || !p && !v ? V = h({
          ...X,
          style: {
            display: "none"
          }
        }, C) : V = null;
      else {
        let Q;
        k === hr ? Q = "prepare" : vv(k) ? Q = "active" : k === Do && (Q = "start");
        const oe = Kg(y, `${I}-${Q}`);
        V = h({
          ...X,
          className: we(Kg(y, I), {
            [oe]: oe && Q,
            [y]: typeof y == "string"
          }),
          style: P
        }, C);
      }
      return V;
    }, [j.current]);
    if (Eb(h) && gx(Y)) {
      const V = dc(Y);
      if (V !== C)
        return /* @__PURE__ */ m.cloneElement(Y, {
          ref: ul(V, C)
        });
    }
    return Y;
  });
  return i.displayName = "CSSMotion", i;
}
const dl = $b(gb), _b = (e) => e != null, Pb = (e) => _b(e) && e !== !1 && e !== "", yf = (e) => typeof e == "number" && !Number.isNaN(e), Rb = (e) => typeof e == "string", Gr = (e) => e !== null && typeof e == "object", Yi = (e) => typeof e == "function", Sv = (e = {}, ...n) => n.filter((o) => !!o).reduce((o, i) => (Object.keys(i).forEach((l) => {
  const c = e[l], f = i[l];
  if (c)
    if (Gr(f))
      o[l] = Sv(c, o[l], f);
    else {
      const {
        _default: p
      } = c;
      p && (o[l] = o[l] || {}, o[l][p] = we(o[l][p], f));
    }
  else
    o[l] = we(o[l], f);
}), o), {}), kb = (e, ...n) => m.useMemo(() => Sv.apply(void 0, [e].concat(n)), [e].concat(n)), Mb = (...e) => e.filter((n) => !!n).reduce((n, o = {}) => (Object.keys(o).forEach((i) => {
  n[i] = {
    ...n[i],
    ...o[i]
  };
}), n), {}), Tb = (...e) => m.useMemo(() => Mb.apply(void 0, e), [].concat(e)), Hi = (e) => m.useMemo(() => e ? {
  root: e
} : void 0, [e]), Qg = (e, n) => Yi(e) ? e(n) : e, pl = (e, n, o, i) => {
  const l = e.map((g) => g ? Qg(g, o) : void 0), c = n.map((g) => g ? Qg(g, o) : void 0), f = kb.apply(void 0, [i].concat(il(l))), p = Tb.apply(void 0, il(c));
  return m.useMemo(() => [f, p], [f, p, i]);
}, Sp = (e) => `${e}-css-var`, Nb = /* @__PURE__ */ m.createContext(void 0), Nn = "${label} is not a valid ${type}", gc = {
  Modal: {
    okText: "OK",
    cancelText: "Cancel",
    justOkText: "OK"
  },
  Form: {
    defaultValidateMessages: {
      default: "Field validation error for ${label}",
      required: "Please enter ${label}",
      enum: "${label} must be one of [${enum}]",
      whitespace: "${label} cannot be a blank character",
      date: {
        format: "${label} date format is invalid",
        parse: "${label} cannot be converted to a date",
        invalid: "${label} is an invalid date"
      },
      types: {
        string: Nn,
        method: Nn,
        array: Nn,
        object: Nn,
        number: Nn,
        date: Nn,
        boolean: Nn,
        integer: Nn,
        float: Nn,
        regexp: Nn,
        email: Nn,
        url: Nn,
        hex: Nn
      },
      string: {
        len: "${label} must be ${len} characters",
        min: "${label} must be at least ${min} characters",
        max: "${label} must be up to ${max} characters",
        range: "${label} must be between ${min}-${max} characters"
      },
      number: {
        len: "${label} must be equal to ${len}",
        min: "${label} must be minimum ${min}",
        max: "${label} must be maximum ${max}",
        range: "${label} must be between ${min}-${max}"
      },
      array: {
        len: "Must be ${len} ${label}",
        min: "At least ${min} ${label}",
        max: "At most ${max} ${label}",
        range: "The amount of ${label} must be between ${min}-${max}"
      },
      pattern: {
        mismatch: "${label} does not match the pattern ${pattern}"
      }
    }
  }
};
({
  ...gc.Modal
});
let Wa = [];
const Zg = () => Wa.reduce((e, n) => ({
  ...e,
  ...n
}), gc.Modal);
function Ib(e) {
  if (e) {
    const n = {
      ...e
    };
    return Wa.push(n), Zg(), () => {
      Wa = Wa.filter((o) => o !== n), Zg();
    };
  }
  ({
    ...gc.Modal
  });
}
const wv = /* @__PURE__ */ m.createContext(void 0), Fb = "internalMark", zb = (e) => {
  const {
    locale: n = {},
    children: o,
    _ANT_MARK__: i
  } = e;
  m.useEffect(() => Ib(n?.Modal), [n]);
  const l = m.useMemo(() => ({
    ...n,
    exist: !0
  }), [n]);
  return /* @__PURE__ */ m.createElement(wv.Provider, {
    value: l
  }, o);
}, xv = /* @__PURE__ */ m.createContext(null);
let Ob = !1;
function Ab(e) {
  return Ob;
}
const Jg = [];
function Lb(e, n) {
  const [o] = m.useState(() => er() ? document.createElement("div") : null), i = m.useRef(!1), l = m.useContext(xv), [c, f] = m.useState(Jg), p = l || (i.current ? void 0 : (y) => {
    f((v) => [y, ...v]);
  });
  function g() {
    o.parentElement || document.body.appendChild(o), i.current = !0;
  }
  function h() {
    o.parentElement?.removeChild(o), i.current = !1;
  }
  return fn(() => (e ? l ? l(g) : g() : h(), h), [e]), fn(() => {
    c.length && (c.forEach((y) => y()), f(Jg));
  }, [c]), [o, p];
}
function Bb() {
  return document.body.scrollHeight > (window.innerHeight || document.documentElement.clientHeight) && window.innerWidth > document.body.offsetWidth;
}
const Hb = `rc-util-locker-${Date.now()}`;
let e0 = 0;
function Db(e) {
  const n = !!e, [o] = m.useState(() => (e0 += 1, `${Hb}_${e0}`));
  fn(() => {
    if (n) {
      const i = xx(document.body).width, l = Bb();
      Uo(`
html body {
  overflow-y: hidden;
  ${l ? `width: calc(100% - ${i}px);` : ""}
}`, o);
    } else
      Js(o);
    return () => {
      Js(o);
    };
  }, [n, o]);
}
let Wo = [];
const jb = 200;
let Cv = 0;
const bv = (e) => {
  if (e.key === "Escape" && !e.isComposing) {
    if (Date.now() - Cv < jb)
      return;
    const o = Wo.length;
    for (let i = o - 1; i >= 0; i -= 1)
      Wo[i].onEsc({
        top: i === o - 1,
        event: e
      });
  }
}, Ev = () => {
  Cv = Date.now();
};
function Vb() {
  window.addEventListener("keydown", bv), window.addEventListener("compositionend", Ev);
}
function Wb() {
  Wo.length === 0 && (window.removeEventListener("keydown", bv), window.removeEventListener("compositionend", Ev));
}
function qb(e, n) {
  const o = cl(), i = wt(n), l = () => {
    Wo.find((f) => f.id === o) || Wo.push({
      id: o,
      onEsc: i
    });
  }, c = () => {
    Wo = Wo.filter((f) => f.id !== o);
  };
  m.useMemo(() => {
    e ? l() : e || c();
  }, [e]), m.useEffect(() => {
    if (e)
      return l(), Vb(), () => {
        c(), Wb();
      };
  }, [e]);
}
const t0 = (e) => e === !1 ? !1 : !er() || !e ? null : typeof e == "string" ? document.querySelector(e) : typeof e == "function" ? e() : e, wp = /* @__PURE__ */ m.forwardRef((e, n) => {
  const {
    open: o,
    autoLock: i,
    getContainer: l,
    debug: c,
    autoDestroy: f = !0,
    children: p,
    onEsc: g
  } = e, [h, y] = m.useState(o), v = h || o;
  m.useEffect(() => {
    (f || o) && y(o);
  }, [o, f]);
  const [S, x] = m.useState(() => t0(l));
  m.useEffect(() => {
    const M = t0(l);
    x(() => (
      // React do the state update even the value is the same,
      // Use function call to force React to compare update
      M ?? null
    ));
  });
  const [b, C] = Lb(v && !S), E = S ?? b;
  Db(i && o && er() && (E === b || E === document.body)), qb(o, g);
  let $ = null;
  p && lp(p) && n && ($ = dc(p));
  const k = sp($, n);
  if (!v || !er() || S === void 0)
    return null;
  const P = E === !1 || Ab();
  let R = p;
  return n && (R = /* @__PURE__ */ m.cloneElement(p, {
    ref: k
  })), /* @__PURE__ */ m.createElement(xv.Provider, {
    value: C
  }, P ? R : /* @__PURE__ */ pc.createPortal(R, E));
});
function Ub(e) {
  const {
    prefixCls: n,
    align: o,
    arrow: i,
    arrowPos: l
  } = e, {
    className: c,
    content: f,
    style: p
  } = i || {}, {
    x: g = 0,
    y: h = 0
  } = l, y = m.useRef(null);
  if (!o || !o.points)
    return null;
  const v = {
    position: "absolute"
  };
  if (o.autoArrow !== !1) {
    const S = o.points[0], x = o.points[1], b = S[0], C = S[1], E = x[0], $ = x[1];
    b === E || !["t", "b"].includes(b) ? v.top = h : b === "t" ? v.top = 0 : v.bottom = 0, C === $ || !["l", "r"].includes(C) ? v.left = g : C === "l" ? v.left = 0 : v.right = 0;
  }
  return /* @__PURE__ */ m.createElement("div", {
    ref: y,
    className: we(`${n}-arrow`, c),
    style: {
      ...v,
      ...p
    }
  }, f);
}
function pd() {
  return pd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, pd.apply(this, arguments);
}
function Xb(e) {
  const {
    prefixCls: n,
    open: o,
    zIndex: i,
    mask: l,
    motion: c,
    mobile: f
  } = e;
  return l ? /* @__PURE__ */ m.createElement(dl, pd({}, c, {
    motionAppear: !0,
    visible: o,
    removeOnLeave: !0
  }), ({
    className: p
  }) => /* @__PURE__ */ m.createElement("div", {
    style: {
      zIndex: i
    },
    className: we(`${n}-mask`, f && `${n}-mobile-mask`, p)
  })) : null;
}
const Gb = /* @__PURE__ */ m.memo(({
  children: e
}) => e, (e, n) => n.cache);
function $v(e, n, o, i, l, c, f, p) {
  const g = "auto", h = e ? {} : {
    left: "-1000vw",
    top: "-1000vh",
    right: g,
    bottom: g
  };
  if (!e && (n || !o)) {
    const {
      points: y
    } = i, v = i.dynamicInset || i._experimental?.dynamicInset, S = v && y[0][1] === "r", x = v && y[0][0] === "b";
    S ? (h.right = l, h.left = g) : (h.left = f, h.right = g), x ? (h.bottom = c, h.top = g) : (h.top = p, h.bottom = g);
  }
  return h;
}
function hd() {
  return hd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, hd.apply(this, arguments);
}
const _v = /* @__PURE__ */ m.forwardRef((e, n) => {
  const {
    onEsc: o,
    popup: i,
    className: l,
    prefixCls: c,
    style: f,
    target: p,
    onVisibleChanged: g,
    // Open
    open: h,
    keepDom: y,
    fresh: v,
    // Click
    onClick: S,
    // Mask
    mask: x,
    // Arrow
    arrow: b,
    arrowPos: C,
    align: E,
    // Motion
    motion: $,
    maskMotion: k,
    // Mobile
    mobile: P,
    // Portal
    forceRender: R,
    getPopupContainer: M,
    autoDestroy: I,
    portal: z,
    children: O,
    zIndex: j,
    onMouseEnter: Y,
    onMouseLeave: V,
    onPointerEnter: X,
    onPointerDownCapture: Q,
    ready: oe,
    offsetX: G,
    offsetY: le,
    offsetR: he,
    offsetB: D,
    onAlign: J,
    onPrepare: q,
    // Resize
    onResize: T,
    stretch: A,
    targetWidth: ee,
    targetHeight: te
  } = e, se = typeof i == "function" ? i() : i, re = h || y, fe = !!P, [ie, Z, ae] = m.useMemo(() => P ? [P.mask, P.maskMotion, P.motion] : [x, k, $], [P, x, k, $]), ce = M?.length > 0, [Me, Ue] = m.useState(!M || !ce);
  fn(() => {
    !Me && ce && p && Ue(!0);
  }, [Me, ce, p]);
  const Qe = wt((ut, Oe) => {
    T?.(ut, Oe), J();
  }), ke = $v(fe, oe, h, E, he, D, G, le);
  if (!Me)
    return null;
  const Xe = {};
  return A && (A.includes("height") && te ? Xe.height = te : A.includes("minHeight") && te && (Xe.minHeight = te), A.includes("width") && ee ? Xe.width = ee : A.includes("minWidth") && ee && (Xe.minWidth = ee)), h || (Xe.pointerEvents = "none"), /* @__PURE__ */ m.createElement(z, {
    open: R || re,
    getContainer: M && (() => M(p)),
    autoDestroy: I,
    onEsc: o
  }, /* @__PURE__ */ m.createElement(Xb, {
    prefixCls: c,
    open: h,
    zIndex: j,
    mask: ie,
    motion: Z,
    mobile: fe
  }), /* @__PURE__ */ m.createElement(Dy, {
    onResize: Qe,
    disabled: !h
  }, (ut) => /* @__PURE__ */ m.createElement(dl, hd({
    motionAppear: !0,
    motionEnter: !0,
    motionLeave: !0,
    removeOnLeave: !1,
    forceRender: R,
    leavedClassName: `${c}-hidden`
  }, ae, {
    onAppearPrepare: q,
    onEnterPrepare: q,
    visible: h,
    onVisibleChanged: (Oe) => {
      $?.onVisibleChanged?.(Oe), g(Oe);
    }
  }), ({
    className: Oe,
    style: xt
  }, Ze) => {
    const tt = we(c, Oe, l, {
      [`${c}-mobile`]: fe
    });
    return /* @__PURE__ */ m.createElement("div", {
      ref: ul(ut, n, Ze),
      className: tt,
      style: {
        "--arrow-x": `${C.x || 0}px`,
        "--arrow-y": `${C.y || 0}px`,
        ...ke,
        ...Xe,
        ...xt,
        boxSizing: "border-box",
        zIndex: j,
        ...f
      },
      onMouseEnter: Y,
      onMouseLeave: V,
      onPointerEnter: X,
      onClick: S,
      onPointerDownCapture: Q
    }, b && /* @__PURE__ */ m.createElement(Ub, {
      prefixCls: c,
      arrow: b,
      arrowPos: C,
      align: E
    }), /* @__PURE__ */ m.createElement(Gb, {
      cache: !h && !v
    }, se));
  })), O);
}), Za = /* @__PURE__ */ m.createContext(null), Pv = /* @__PURE__ */ m.createContext(null);
function n0(e) {
  return e ? Array.isArray(e) ? e : [e] : [];
}
function Yb(e, n, o) {
  return m.useMemo(() => {
    const i = n0(n ?? e), l = n0(o ?? e), c = new Set(i), f = new Set(l);
    return c.has("hover") && !c.has("click") && c.add("touch"), f.has("hover") && !f.has("click") && f.add("touch"), [c, f];
  }, [e, n, o]);
}
function Kb(e = [], n = [], o) {
  const i = (l, c) => l[c] || "";
  return o ? i(e, 0) === i(n, 0) : i(e, 0) === i(n, 0) && i(e, 1) === i(n, 1);
}
function Rv(e, n, o, i) {
  const {
    points: l
  } = o, c = Object.keys(e);
  for (let f = 0; f < c.length; f += 1) {
    const p = c[f];
    if (Kb(e[p]?.points, l, i))
      return `${n}-placement-${p}`;
  }
  return "";
}
function hl(e) {
  return e.ownerDocument.defaultView;
}
function md(e) {
  const n = [];
  let o = e?.parentElement;
  const i = ["hidden", "scroll", "clip", "auto"];
  for (; o; ) {
    const {
      overflowX: l,
      overflowY: c,
      overflow: f
    } = hl(o).getComputedStyle(o);
    [l, c, f].some((p) => i.includes(p)) && n.push(o), o = o.parentElement;
  }
  return n;
}
function ll(e, n = 1) {
  return Number.isNaN(e) ? n : e;
}
function Ns(e) {
  return ll(parseFloat(e), 0);
}
function r0(e, n) {
  const o = {
    ...e
  };
  return (n || []).forEach((i) => {
    if (i instanceof HTMLBodyElement || i instanceof HTMLHtmlElement)
      return;
    const {
      overflow: l,
      overflowClipMargin: c,
      borderTopWidth: f,
      borderBottomWidth: p,
      borderLeftWidth: g,
      borderRightWidth: h
    } = hl(i).getComputedStyle(i), y = i.getBoundingClientRect(), {
      offsetHeight: v,
      clientHeight: S,
      offsetWidth: x,
      clientWidth: b
    } = i, C = Ns(f), E = Ns(p), $ = Ns(g), k = Ns(h), P = ll(Math.round(y.width / x * 1e3) / 1e3), R = ll(Math.round(y.height / v * 1e3) / 1e3), M = (x - b - $ - k) * P, I = (v - S - C - E) * R, z = C * R, O = E * R, j = $ * P, Y = k * P;
    let V = 0, X = 0;
    if (l === "clip") {
      const he = Ns(c);
      V = he * P, X = he * R;
    }
    const Q = y.x + j - V, oe = y.y + z - X, G = Q + y.width + 2 * V - j - Y - M, le = oe + y.height + 2 * X - z - O - I;
    o.left = Math.max(o.left, Q), o.top = Math.max(o.top, oe), o.right = Math.min(o.right, G), o.bottom = Math.min(o.bottom, le);
  }), o;
}
function o0(e, n = 0) {
  const o = `${n}`, i = o.match(/^(.*)\%$/);
  return i ? e * (parseFloat(i[1]) / 100) : parseFloat(o);
}
function i0(e, n) {
  const [o, i] = n || [];
  return [o0(e.width, o), o0(e.height, i)];
}
function s0(e = "") {
  return [e[0], e[1]];
}
function Pi(e, n) {
  const o = n[0], i = n[1];
  let l, c;
  return o === "t" ? c = e.y : o === "b" ? c = e.y + e.height : c = e.y + e.height / 2, i === "l" ? l = e.x : i === "r" ? l = e.x + e.width : l = e.x + e.width / 2, {
    x: l,
    y: c
  };
}
function yo(e, n) {
  const o = {
    t: "b",
    b: "t",
    l: "r",
    r: "l"
  }, i = [...e];
  return i[n] = o[e[n]] || "c", i;
}
function l0(e) {
  return e.join("");
}
function kv(e, n, o, i, l, c, f, p) {
  const [g, h] = m.useState({
    ready: !1,
    offsetX: 0,
    offsetY: 0,
    offsetR: 0,
    offsetB: 0,
    arrowX: 0,
    arrowY: 0,
    scaleX: 1,
    scaleY: 1,
    align: l[i] || {}
  }), y = m.useRef(0), v = m.useMemo(() => !n || p ? [] : md(n), [n]), S = m.useRef({});
  e || (S.current = {});
  const b = wt(() => {
    if (n && o && e && !p) {
      let Ge = function(Re, et, Bt = Xe) {
        const bo = G.x + Re, Nr = G.y + et, Ir = bo + se, Fr = Nr + te, wr = Math.max(bo, Bt.left), Eo = Math.max(Nr, Bt.top), Ki = Math.min(Ir, Bt.right), Qi = Math.min(Fr, Bt.bottom);
        return Math.max(0, (Ki - wr) * (Qi - Eo));
      }, Ln = function() {
        Nt = G.y + ze, An = Nt + te, an = G.x + Ae, vr = an + se;
      };
      const $ = n, k = $.ownerDocument, P = hl($), {
        position: R
      } = P.getComputedStyle($), M = $.style.left, I = $.style.top, z = $.style.right, O = $.style.bottom, j = $.style.overflow, Y = $.style.overflowX, V = $.style.overflowY, X = {
        ...l[i],
        ...c
      }, Q = k.createElement("div");
      $.parentElement?.appendChild(Q), Q.style.left = `${$.offsetLeft}px`, Q.style.top = `${$.offsetTop}px`, Q.style.position = R, Q.style.height = `${$.offsetHeight}px`, Q.style.width = `${$.offsetWidth}px`, $.style.left = "0", $.style.top = "0", $.style.right = "auto", $.style.bottom = "auto", $.style.overflow = "hidden";
      let oe;
      if (Array.isArray(o))
        oe = {
          x: o[0],
          y: o[1],
          width: 0,
          height: 0
        };
      else {
        const Re = o.getBoundingClientRect();
        Re.x = Re.x ?? Re.left, Re.y = Re.y ?? Re.top, oe = {
          x: Re.x,
          y: Re.y,
          width: Re.width,
          height: Re.height
        };
      }
      const G = $.getBoundingClientRect(), {
        height: le,
        width: he
      } = P.getComputedStyle($);
      G.x = G.x ?? G.left, G.y = G.y ?? G.top;
      const {
        clientWidth: D,
        clientHeight: J,
        scrollWidth: q,
        scrollHeight: T,
        scrollTop: A,
        scrollLeft: ee
      } = k.documentElement, te = G.height, se = G.width, re = oe.height, fe = oe.width, ie = {
        left: 0,
        top: 0,
        right: D,
        bottom: J
      }, Z = {
        left: -ee,
        top: -A,
        right: q - ee,
        bottom: T - A
      };
      let {
        htmlRegion: ae
      } = X;
      const ce = "visible", Me = "visibleFirst";
      ae !== "scroll" && ae !== Me && (ae = ce);
      const Ue = ae === Me, Qe = r0(Z, v), ke = r0(ie, v), Xe = ae === ce ? ke : Qe, ut = Ue ? ke : Xe;
      $.style.left = "auto", $.style.top = "auto", $.style.right = "0", $.style.bottom = "0";
      const Oe = $.getBoundingClientRect();
      $.style.left = M, $.style.top = I, $.style.right = z, $.style.bottom = O, $.style.overflow = j, $.style.overflowX = Y, $.style.overflowY = V, $.parentElement?.removeChild(Q);
      const xt = ll(Math.round(se / parseFloat(he) * 1e3) / 1e3), Ze = ll(Math.round(te / parseFloat(le) * 1e3) / 1e3);
      if (xt === 0 || Ze === 0 || Ai(o) && !yx(o))
        return;
      const {
        offset: tt,
        targetOffset: je
      } = X;
      let [Je, ft] = i0(G, tt);
      const [dn, Rt] = i0(oe, je);
      oe.x -= dn, oe.y -= Rt;
      const [qt, Ut] = X.points || [], kt = s0(Ut), mt = s0(qt), Mt = Pi(oe, kt), qe = Pi(G, mt), Kt = {
        ...X
      };
      let Ve = [mt, kt], Ae = Mt.x - qe.x + Je, ze = Mt.y - qe.y + ft;
      const gt = Ge(Ae, ze), Xt = Ge(Ae, ze, ke), nt = Pi(oe, ["t", "l"]), Qt = Pi(G, ["t", "l"]), Tt = Pi(oe, ["b", "r"]), $n = Pi(G, ["b", "r"]), _n = X.overflow || {}, {
        adjustX: de,
        adjustY: Ee,
        shiftX: xe,
        shiftY: bt
      } = _n, Zt = (Re) => typeof Re == "boolean" ? Re : Re >= 0;
      let Nt, An, an, vr;
      Ln();
      const or = Zt(Ee), Pn = mt[0] === kt[0];
      if (or && mt[0] === "t" && (An > ut.bottom || S.current.bt)) {
        let Re = ze;
        Pn ? Re -= te - re : Re = nt.y - $n.y - ft;
        const et = Ge(Ae, Re), Bt = Ge(Ae, Re, ke);
        // Of course use larger one
        et > gt || et === gt && (!Ue || // Choose recommend one
        Bt >= Xt) ? (S.current.bt = !0, ze = Re, ft = -ft, Ve = [yo(Ve[0], 0), yo(Ve[1], 0)]) : S.current.bt = !1;
      }
      if (or && mt[0] === "b" && (Nt < ut.top || S.current.tb)) {
        let Re = ze;
        Pn ? Re += te - re : Re = Tt.y - Qt.y - ft;
        const et = Ge(Ae, Re), Bt = Ge(Ae, Re, ke);
        // Of course use larger one
        et > gt || et === gt && (!Ue || // Choose recommend one
        Bt >= Xt) ? (S.current.tb = !0, ze = Re, ft = -ft, Ve = [yo(Ve[0], 0), yo(Ve[1], 0)]) : S.current.tb = !1;
      }
      const ir = Zt(de), pn = mt[1] === kt[1];
      if (ir && mt[1] === "l" && (vr > ut.right || S.current.rl)) {
        let Re = Ae;
        pn ? Re -= se - fe : Re = nt.x - $n.x - Je;
        const et = Ge(Re, ze), Bt = Ge(Re, ze, ke);
        // Of course use larger one
        et > gt || et === gt && (!Ue || // Choose recommend one
        Bt >= Xt) ? (S.current.rl = !0, Ae = Re, Je = -Je, Ve = [yo(Ve[0], 1), yo(Ve[1], 1)]) : S.current.rl = !1;
      }
      if (ir && mt[1] === "r" && (an < ut.left || S.current.lr)) {
        let Re = Ae;
        pn ? Re += se - fe : Re = Tt.x - Qt.x - Je;
        const et = Ge(Re, ze), Bt = Ge(Re, ze, ke);
        // Of course use larger one
        et > gt || et === gt && (!Ue || // Choose recommend one
        Bt >= Xt) ? (S.current.lr = !0, Ae = Re, Je = -Je, Ve = [yo(Ve[0], 1), yo(Ve[1], 1)]) : S.current.lr = !1;
      }
      Kt.points = [l0(Ve[0]), l0(Ve[1])], Ln();
      const Jt = xe === !0 ? 0 : xe;
      typeof Jt == "number" && (an < ke.left && (Ae -= an - ke.left - Je, oe.x + fe < ke.left + Jt && (Ae += oe.x - ke.left + fe - Jt)), vr > ke.right && (Ae -= vr - ke.right - Je, oe.x > ke.right - Jt && (Ae += oe.x - ke.right + Jt)));
      const It = bt === !0 ? 0 : bt;
      typeof It == "number" && (Nt < ke.top && (ze -= Nt - ke.top - ft, oe.y + re < ke.top + It && (ze += oe.y - ke.top + re - It)), An > ke.bottom && (ze -= An - ke.bottom - ft, oe.y > ke.bottom - It && (ze += oe.y - ke.bottom + It)));
      const yt = G.x + Ae, hn = yt + se, Lt = G.y + ze, mn = Lt + te, Yr = oe.x, rt = Yr + fe, Sr = oe.y, Kr = Sr + re, dt = Math.max(yt, Yr), en = Math.min(hn, rt), Bn = (dt + en) / 2 - yt, Hn = Math.max(Lt, Sr), Mr = Math.min(mn, Kr), Tr = (Hn + Mr) / 2 - Lt;
      f?.(n, Kt);
      let Dn = Oe.right - G.x - (Ae + G.width), gn = Oe.bottom - G.y - (ze + G.height);
      xt === 1 && (Ae = Math.floor(Ae), Dn = Math.floor(Dn)), Ze === 1 && (ze = Math.floor(ze), gn = Math.floor(gn));
      const at = {
        ready: !0,
        offsetX: Ae / xt,
        offsetY: ze / Ze,
        offsetR: Dn / xt,
        offsetB: gn / Ze,
        arrowX: Bn / xt,
        arrowY: Tr / Ze,
        scaleX: xt,
        scaleY: Ze,
        align: Kt
      };
      h(at);
    }
  }), C = () => {
    y.current += 1;
    const $ = y.current;
    Promise.resolve().then(() => {
      y.current === $ && b();
    });
  }, E = () => {
    h(($) => ({
      ...$,
      ready: !1
    }));
  };
  return fn(E, [i]), fn(() => {
    e || E();
  }, [e]), [g.ready, g.offsetX, g.offsetY, g.offsetR, g.offsetB, g.arrowX, g.arrowY, g.scaleX, g.scaleY, g.align, C];
}
function Mv() {
  const e = m.useRef(null), n = () => {
    e.current && (clearTimeout(e.current), e.current = null);
  }, o = (i, l) => {
    n(), l === 0 ? i() : e.current = setTimeout(() => {
      i();
    }, l * 1e3);
  };
  return m.useEffect(() => () => {
    n();
  }, []), o;
}
function Qb(e, n, o, i, l) {
  fn(() => {
    if (e && n && o) {
      let v = function() {
        i(), l();
      };
      const c = n, f = o, p = md(c), g = md(f), h = hl(f), y = /* @__PURE__ */ new Set([h, ...p, ...g]);
      return y.forEach((S) => {
        S.addEventListener("scroll", v, {
          passive: !0
        });
      }), h.addEventListener("resize", v, {
        passive: !0
      }), i(), () => {
        y.forEach((S) => {
          S.removeEventListener("scroll", v), h.removeEventListener("resize", v);
        });
      };
    }
  }, [e, n, o]);
}
function Zb(e, n, o, i, l, c, f, p) {
  const g = m.useRef(e);
  g.current = e;
  const h = m.useRef(!1);
  m.useEffect(() => {
    if (n && i && (!l || c)) {
      const v = () => {
        h.current = !1;
      }, S = (C) => {
        g.current && !f(C.composedPath?.()?.[0] || C.target) && !h.current && p(!1);
      }, x = hl(i);
      x.addEventListener("pointerdown", v, !0), x.addEventListener("mousedown", S, !0), x.addEventListener("contextmenu", S, !0);
      const b = jf(o);
      return b && (b.addEventListener("mousedown", S, !0), b.addEventListener("contextmenu", S, !0)), () => {
        x.removeEventListener("pointerdown", v, !0), x.removeEventListener("mousedown", S, !0), x.removeEventListener("contextmenu", S, !0), b && (b.removeEventListener("mousedown", S, !0), b.removeEventListener("contextmenu", S, !0));
      };
    }
  }, [n, o, i, l, c]);
  function y() {
    h.current = !0;
  }
  return y;
}
function Jb() {
  const [e, n] = ye.useState(null), [o, i] = ye.useState(!1), [l, c] = ye.useState(!1), f = ye.useRef(null), p = wt((h) => {
    h === !1 ? (f.current = null, i(!1)) : l && o ? f.current = h : (i(!0), n(h), f.current = null, o || c(!0));
  }), g = wt((h) => {
    h ? (c(!1), f.current && (n(f.current), f.current = null)) : (c(!1), f.current = null);
  });
  return [p, o, e, g];
}
function gd() {
  return gd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, gd.apply(this, arguments);
}
const eE = (e) => {
  const {
    prefixCls: n,
    isMobile: o,
    ready: i,
    open: l,
    align: c,
    offsetR: f,
    offsetB: p,
    offsetX: g,
    offsetY: h,
    arrowPos: y,
    popupSize: v,
    motion: S,
    uniqueContainerClassName: x,
    uniqueContainerStyle: b
  } = e, C = `${n}-unique-container`, [E, $] = ye.useState(!1), k = $v(o, i, l, c, f, p, g, h), P = ye.useRef(k);
  i && (P.current = k);
  const R = {};
  return v && (R.width = v.width, R.height = v.height), /* @__PURE__ */ ye.createElement(dl, gd({
    motionAppear: !0,
    motionEnter: !0,
    motionLeave: !0,
    removeOnLeave: !1,
    leavedClassName: `${C}-hidden`
  }, S, {
    visible: l,
    onVisibleChanged: (M) => {
      $(M);
    }
  }), ({
    className: M,
    style: I
  }) => {
    const z = we(C, M, x, {
      [`${C}-visible`]: E
    });
    return /* @__PURE__ */ ye.createElement("div", {
      className: z,
      style: {
        "--arrow-x": `${y?.x || 0}px`,
        "--arrow-y": `${y?.y || 0}px`,
        ...P.current,
        ...R,
        ...I,
        ...b
      }
    });
  });
}, tE = ({
  children: e,
  postTriggerProps: n
}) => {
  const [o, i, l, c] = Jb(), f = m.useMemo(() => !l || !n ? l : n(l), [l, n]), [p, g] = m.useState(null), [h, y] = m.useState(null), v = m.useRef(null), S = wt((D) => {
    v.current = D, Ai(D) && p !== D && g(D);
  }), x = m.useRef(null), b = Mv(), C = wt((D, J) => {
    x.current = J, b(() => {
      o(D);
    }, D.delay);
  }), E = (D) => {
    b(() => {
      x.current?.() || o(!1);
    }, D);
  }, $ = wt((D) => {
    c(D);
  }), [
    k,
    P,
    R,
    M,
    I,
    z,
    O,
    // scaleX - not used in UniqueProvider
    ,
    ,
    // scaleY - not used in UniqueProvider
    j,
    Y
  ] = kv(
    i,
    p,
    f?.target,
    f?.popupPlacement,
    f?.builtinPlacements || {},
    f?.popupAlign,
    void 0,
    // onPopupAlign
    !1
    // isMobile
  ), V = m.useMemo(() => {
    if (!f)
      return "";
    const D = Rv(
      f.builtinPlacements || {},
      f.prefixCls || "",
      j,
      !1
      // alignPoint is false for UniqueProvider
    );
    return we(D, f.getPopupClassNameFromAlign?.(j));
  }, [j, f?.getPopupClassNameFromAlign, f?.builtinPlacements, f?.prefixCls]), X = m.useMemo(() => ({
    show: C,
    hide: E
  }), []);
  m.useEffect(() => {
    Y();
  }, [f?.target]);
  const Q = wt(() => (Y(), Promise.resolve())), oe = m.useRef({}), G = m.useContext(Za), le = m.useMemo(() => ({
    registerSubPopup: (D, J) => {
      oe.current[D] = J, G?.registerSubPopup(D, J);
    }
  }), [G]), he = f?.prefixCls;
  return /* @__PURE__ */ m.createElement(Pv.Provider, {
    value: X
  }, e, f && /* @__PURE__ */ m.createElement(Za.Provider, {
    value: le
  }, /* @__PURE__ */ m.createElement(_v, {
    ref: S,
    portal: wp,
    onEsc: f.onEsc,
    prefixCls: he,
    popup: f.popup,
    className: we(f.popupClassName, V, `${he}-unique-controlled`),
    style: f.popupStyle,
    target: f.target,
    open: i,
    keepDom: !0,
    fresh: !0,
    autoDestroy: !1,
    onVisibleChanged: $,
    ready: k,
    offsetX: P,
    offsetY: R,
    offsetR: M,
    offsetB: I,
    onAlign: Y,
    onPrepare: Q,
    onResize: (D) => y({
      width: D.offsetWidth,
      height: D.offsetHeight
    }),
    arrowPos: {
      x: z,
      y: O
    },
    align: j,
    zIndex: f.zIndex,
    mask: f.mask,
    arrow: f.arrow,
    motion: f.popupMotion,
    maskMotion: f.maskMotion,
    getPopupContainer: f.getPopupContainer
  }, /* @__PURE__ */ m.createElement(eE, {
    prefixCls: he,
    isMobile: !1,
    ready: k,
    open: i,
    align: j,
    offsetR: M,
    offsetB: I,
    offsetX: P,
    offsetY: R,
    arrowPos: {
      x: z,
      y: O
    },
    popupSize: h,
    motion: f.popupMotion,
    uniqueContainerClassName: we(f.uniqueContainerClassName, V),
    uniqueContainerStyle: f.uniqueContainerStyle
  }))));
};
function nE(e = wp) {
  return /* @__PURE__ */ m.forwardRef((o, i) => {
    const {
      prefixCls: l = "rc-trigger-popup",
      children: c,
      // Action
      action: f = "hover",
      showAction: p,
      hideAction: g,
      disabled: h = !1,
      // Open
      popupVisible: y,
      defaultPopupVisible: v,
      onOpenChange: S,
      afterOpenChange: x,
      onPopupVisibleChange: b,
      afterPopupVisibleChange: C,
      // Delay
      mouseEnterDelay: E,
      mouseLeaveDelay: $ = 0.1,
      focusDelay: k,
      blurDelay: P,
      // Mask
      mask: R,
      maskClosable: M = !0,
      // Portal
      getPopupContainer: I,
      forceRender: z,
      autoDestroy: O,
      // Popup
      popup: j,
      popupClassName: Y,
      uniqueContainerClassName: V,
      uniqueContainerStyle: X,
      popupStyle: Q,
      popupPlacement: oe,
      builtinPlacements: G = {},
      popupAlign: le,
      zIndex: he,
      stretch: D,
      getPopupClassNameFromAlign: J,
      fresh: q,
      unique: T,
      alignPoint: A,
      onPopupClick: ee,
      onPopupAlign: te,
      // Arrow
      arrow: se,
      // Motion
      popupMotion: re,
      maskMotion: fe,
      // Private
      mobile: ie,
      ...Z
    } = o, ae = O || !1, ce = y === void 0, Me = !!ie, Ue = m.useRef({}), Qe = m.useContext(Za), ke = m.useMemo(() => ({
      registerSubPopup: (ue, Fe) => {
        Ue.current[ue] = Fe, Qe?.registerSubPopup(ue, Fe);
      }
    }), [Qe]), Xe = m.useContext(Pv), ut = cl(), [Oe, xt] = m.useState(null), Ze = m.useRef(null), tt = wt((ue) => {
      Ze.current = ue, Ai(ue) && Oe !== ue && xt(ue), Qe?.registerSubPopup(ut, ue);
    }), [je, Je] = m.useState(null), ft = m.useRef(null), dn = wt((ue) => {
      const Fe = cp(ue);
      Ai(Fe) && je !== Fe && (Je(Fe), ft.current = Fe);
    }), Rt = {}, qt = wt((ue) => {
      const Fe = je;
      return Fe?.contains(ue) || jf(Fe)?.host === ue || ue === Fe || Oe?.contains(ue) || jf(Oe)?.host === ue || ue === Oe || Object.values(Ue.current).some((xr) => xr?.contains(ue) || ue === xr);
    }), Ut = se ? {
      // true and Object likely
      ...se !== !0 ? se : {}
    } : null, [kt, mt] = rl(v || !1, y), Mt = kt || !1, qe = Mt && !h, Kt = m.useMemo(() => {
      const ue = typeof c == "function" ? c({
        open: qe
      }) : c;
      return m.Children.only(ue);
    }, [c, qe]), Ve = Kt?.props || {}, Ae = wt(() => qe), ze = wt((ue = 0) => ({
      popup: j,
      target: je,
      delay: ue,
      prefixCls: l,
      popupClassName: Y,
      uniqueContainerClassName: V,
      uniqueContainerStyle: X,
      popupStyle: Q,
      popupPlacement: oe,
      builtinPlacements: G,
      popupAlign: le,
      zIndex: he,
      mask: R,
      maskClosable: M,
      popupMotion: re,
      maskMotion: fe,
      arrow: Ut,
      getPopupContainer: I,
      getPopupClassNameFromAlign: J,
      id: ut,
      onEsc: Qt
    }));
    fn(() => {
      Xe && T && je && !ce && !Qe && (qe ? Xe.show(ze(E), Ae) : Xe.hide($));
    }, [qe, je]);
    const Ge = m.useRef(qe);
    Ge.current = qe;
    const gt = wt((ue) => {
      pc.flushSync(() => {
        Mt !== ue && (mt(ue), S?.(ue), b?.(ue));
      });
    }), Xt = Mv(), nt = (ue, Fe = 0) => {
      if (y !== void 0) {
        Xt(() => {
          gt(ue);
        }, Fe);
        return;
      }
      if (Xe && T && ce && !Qe) {
        ue ? Xe.show(ze(Fe), Ae) : Xe.hide(Fe);
        return;
      }
      Xt(() => {
        gt(ue);
      }, Fe);
    };
    function Qt({
      top: ue
    }) {
      ue && nt(!1);
    }
    const [Tt, $n] = m.useState(!1);
    fn((ue) => {
      (!ue || qe) && $n(!0);
    }, [qe]);
    const [_n, de] = m.useState(null), [Ee, xe] = m.useState(null), bt = (ue) => {
      xe([ue.clientX, ue.clientY]);
    }, [Zt, Nt, An, an, vr, Ln, or, Pn, ir, pn, Jt] = kv(qe, Oe, A && Ee !== null ? Ee : je, oe, G, le, te, Me), [It, yt] = Yb(f, p, g), hn = It.has("click"), Lt = yt.has("click") || yt.has("contextMenu"), mn = wt(() => {
      Tt || Jt();
    });
    Qb(qe, je, Oe, mn, () => {
      Ge.current && A && Lt && nt(!1);
    }), fn(() => {
      mn();
    }, [Ee, oe]), fn(() => {
      qe && !G?.[oe] && mn();
    }, [JSON.stringify(le)]);
    const rt = m.useMemo(() => {
      const ue = Rv(G, l, pn, A);
      return we(ue, J?.(pn));
    }, [pn, J, G, l, A]);
    m.useImperativeHandle(i, () => ({
      nativeElement: ft.current,
      popupElement: Ze.current,
      forceAlign: mn
    }));
    const [Sr, Kr] = m.useState(0), [dt, en] = m.useState(0), Be = () => {
      if (D && je) {
        const ue = je.getBoundingClientRect();
        Kr(ue.width), en(ue.height);
      }
    }, Bn = () => {
      Be(), mn();
    }, Hn = (ue) => {
      $n(!1), Jt(), x?.(ue), C?.(ue);
    }, Mr = () => new Promise((ue) => {
      Be(), de(() => ue);
    });
    fn(() => {
      _n && (Jt(), _n(), de(null));
    }, [_n]);
    function tn(ue, Fe, xr, Cc, ti) {
      Rt[ue] = (He, ...gl) => {
        (!ti || !ti()) && (Cc?.(He), nt(Fe, xr)), Ve[ue]?.(He, ...gl);
      };
    }
    const Tr = It.has("touch"), Dn = yt.has("touch"), gn = m.useRef(!1);
    (Tr || Dn) && (Rt.onTouchStart = (...ue) => {
      gn.current = !0, Ge.current && Dn ? nt(!1) : !Ge.current && Tr && nt(!0), Ve.onTouchStart?.(...ue);
    }), (hn || Lt) && (Rt.onClick = (ue, ...Fe) => {
      Ge.current && Lt ? nt(!1) : !Ge.current && hn && (bt(ue), nt(!0)), Ve.onClick?.(ue, ...Fe), gn.current = !1;
    });
    const at = Zb(qe, Lt || Dn, je, Oe, R, M, qt, nt), Re = It.has("hover"), et = yt.has("hover");
    let Bt, bo;
    const Nr = () => gn.current;
    if (Re) {
      const ue = (Fe) => {
        bt(Fe);
      };
      tn("onMouseEnter", !0, E, ue, Nr), tn("onPointerEnter", !0, E, ue, Nr), Bt = (Fe) => {
        (qe || Tt) && Oe?.contains(Fe.target) && nt(!0, E);
      }, A && (Rt.onMouseMove = (Fe) => {
        Ve.onMouseMove?.(Fe);
      });
    }
    et && (tn("onMouseLeave", !1, $, void 0, Nr), tn("onPointerLeave", !1, $, void 0, Nr), bo = () => {
      nt(!1, $);
    }), It.has("focus") && tn("onFocus", !0, k), yt.has("focus") && tn("onBlur", !1, P), It.has("contextMenu") && (Rt.onContextMenu = (ue, ...Fe) => {
      Ge.current && yt.has("contextMenu") ? nt(!1) : (bt(ue), nt(!0)), ue.preventDefault(), Ve.onContextMenu?.(ue, ...Fe);
    });
    const Ir = m.useRef(!1);
    Ir.current ||= z || qe || Tt;
    const Fr = {
      ...Ve,
      ...Rt
    }, wr = {};
    ["onContextMenu", "onClick", "onMouseDown", "onTouchStart", "onMouseEnter", "onMouseLeave", "onFocus", "onBlur"].forEach((ue) => {
      Z[ue] && (wr[ue] = (...Fe) => {
        Fr[ue]?.(...Fe), Z[ue](...Fe);
      });
    });
    const Ki = {
      x: Ln,
      y: or
    };
    Hy(qe, je, Bn);
    const Qi = sp(dn, dc(Kt)), Zi = /* @__PURE__ */ m.cloneElement(Kt, {
      ...Fr,
      ...wr,
      ref: Qi
    });
    return /* @__PURE__ */ m.createElement(m.Fragment, null, Zi, Ir.current && (!Xe || !T) && /* @__PURE__ */ m.createElement(Za.Provider, {
      value: ke
    }, /* @__PURE__ */ m.createElement(_v, {
      portal: e,
      ref: tt,
      prefixCls: l,
      popup: j,
      className: we(Y, !Me && rt),
      style: Q,
      target: je,
      onMouseEnter: Bt,
      onMouseLeave: bo,
      onPointerEnter: Bt,
      zIndex: he,
      open: qe,
      keepDom: Tt,
      fresh: q,
      onClick: ee,
      onPointerDownCapture: at,
      mask: R,
      motion: re,
      maskMotion: fe,
      onVisibleChanged: Hn,
      onPrepare: Mr,
      forceRender: z,
      autoDestroy: ae,
      getPopupContainer: I,
      onEsc: Qt,
      align: pn,
      arrow: Ut,
      arrowPos: Ki,
      ready: Zt,
      offsetX: Nt,
      offsetY: An,
      offsetR: an,
      offsetB: vr,
      onAlign: mn,
      stretch: D,
      targetWidth: Sr / Pn,
      targetHeight: dt / ir,
      mobile: ie
    })));
  });
}
const rE = nE(wp);
function oE(e) {
  return e && /* @__PURE__ */ ye.isValidElement(e) && e.type === ye.Fragment;
}
const iE = (e, n, o) => /* @__PURE__ */ ye.isValidElement(e) ? /* @__PURE__ */ ye.cloneElement(e, Yi(o) ? o(e.props || {}) : o) : n;
function Tv(e, n) {
  return iE(e, e, n);
}
const sE = ({
  children: e
}) => {
  const {
    getPrefixCls: n
  } = ye.useContext(On), o = n();
  return /* @__PURE__ */ ye.isValidElement(e) ? /* @__PURE__ */ ye.createElement(dl, {
    visible: !0,
    motionName: `${o}-fade`,
    motionAppear: !0,
    motionEnter: !0,
    motionLeave: !1,
    removeOnLeave: !1
  }, ({
    style: i,
    className: l
  }) => Tv(e, (c) => ({
    className: we(c.className, l),
    style: {
      ...c.style,
      ...i
    }
  }))) : e;
}, Ra = [null, null];
function lE(e) {
  if (Ra[0] !== e) {
    const n = {};
    Object.keys(e).forEach((o) => {
      n[o] = {
        ...e[o],
        dynamicInset: !1
      };
    }), Ra[0] = e, Ra[1] = n;
  }
  return Ra[1];
}
const Nv = ({
  children: e
}) => {
  const n = (o) => {
    const {
      id: i,
      builtinPlacements: l,
      popup: c
    } = o, f = Yi(c) ? c() : c, p = lE(l);
    return {
      ...o,
      getPopupContainer: null,
      arrow: !1,
      popup: /* @__PURE__ */ ye.createElement(sE, {
        key: i
      }, f),
      builtinPlacements: p
    };
  };
  return /* @__PURE__ */ ye.createElement(tE, {
    postTriggerProps: n
  }, e);
}, al = /* @__PURE__ */ m.createContext(!1), aE = ({
  children: e,
  disabled: n
}) => {
  const o = m.useContext(al);
  return /* @__PURE__ */ m.createElement(al.Provider, {
    value: n ?? o
  }, e);
}, Di = /* @__PURE__ */ m.createContext(void 0), cE = ({
  children: e,
  size: n
}) => {
  const o = m.useContext(Di);
  return /* @__PURE__ */ m.createElement(Di.Provider, {
    value: n || o
  }, e);
};
function uE() {
  const e = m.useContext(al), n = m.useContext(Di);
  return {
    componentDisabled: e,
    componentSize: n
  };
}
function fE(e, n, o) {
  const i = e || {}, l = i.inherit === !1 || !n ? {
    ...sl,
    hashed: n?.hashed ?? sl.hashed,
    cssVar: n?.cssVar
  } : n, c = m.useId();
  return ac(() => {
    if (!e)
      return n;
    const f = {
      ...l.components
    };
    Object.keys(e.components || {}).forEach((h) => {
      f[h] = {
        ...f[h],
        ...e.components[h]
      };
    });
    const p = `css-var-${c.replace(/:/g, "")}`, g = {
      prefix: o?.prefixCls,
      // Same as prefixCls by default
      ...l.cssVar,
      ...i.cssVar,
      key: i.cssVar?.key || p
    };
    return {
      ...l,
      ...i,
      token: {
        ...l.token,
        ...i.token
      },
      components: f,
      cssVar: g
    };
  }, [i, l, o?.prefixCls, c], (f, p) => f.some((g, h) => {
    const y = p[h];
    return !el(g, y, !0);
  }));
}
const a0 = /* @__PURE__ */ m.createContext(!0);
function dE(e) {
  const n = m.useContext(a0), {
    children: o
  } = e, [, i] = Gi(), {
    motion: l
  } = i, c = m.useRef(!1);
  return c.current || (c.current = n !== l), c.current ? /* @__PURE__ */ m.createElement(a0.Provider, {
    value: l
  }, /* @__PURE__ */ m.createElement(pb, {
    motion: l
  }, o)) : o;
}
const pE = () => null, hE = ({
  iconPrefixCls: e,
  csp: n
}) => (LC(e, n), null), mE = ["getTargetContainer", "getPopupContainer", "renderEmpty", "input", "pagination", "form", "select", "button"], gE = (e) => {
  const {
    prefixCls: n,
    iconPrefixCls: o,
    theme: i,
    holderRender: l
  } = e;
}, yE = (e) => {
  const {
    children: n,
    csp: o,
    autoInsertSpaceInButton: i,
    alert: l,
    affix: c,
    anchor: f,
    app: p,
    form: g,
    locale: h,
    componentSize: y,
    direction: v,
    space: S,
    splitter: x,
    virtual: b,
    dropdownMatchSelectWidth: C,
    popupMatchSelectWidth: E,
    popupOverflow: $,
    legacyLocale: k,
    parentContext: P,
    iconPrefixCls: R,
    theme: M,
    componentDisabled: I,
    segmented: z,
    statistic: O,
    spin: j,
    calendar: Y,
    carousel: V,
    cascader: X,
    collapse: Q,
    typography: oe,
    checkbox: G,
    descriptions: le,
    divider: he,
    drawer: D,
    skeleton: J,
    steps: q,
    image: T,
    layout: A,
    list: ee,
    mentions: te,
    modal: se,
    progress: re,
    result: fe,
    slider: ie,
    breadcrumb: Z,
    masonry: ae,
    menu: ce,
    pagination: Me,
    input: Ue,
    inputPassword: Qe,
    inputSearch: ke,
    textArea: Xe,
    otp: ut,
    empty: Oe,
    badge: xt,
    borderBeam: Ze,
    radio: tt,
    rate: je,
    ribbon: Je,
    switch: ft,
    transfer: dn,
    avatar: Rt,
    message: qt,
    tag: Ut,
    table: kt,
    card: mt,
    cardMeta: Mt,
    tabs: qe,
    timeline: Kt,
    timePicker: Ve,
    upload: Ae,
    notification: ze,
    tree: Ge,
    colorPicker: gt,
    datePicker: Xt,
    rangePicker: nt,
    flex: Qt,
    wave: Tt,
    dropdown: $n,
    warning: _n,
    tour: de,
    tooltip: Ee,
    popover: xe,
    popconfirm: bt,
    qrcode: Zt,
    floatButton: Nt,
    floatButtonGroup: An,
    variant: an,
    inputNumber: vr,
    treeSelect: Ln,
    watermark: or
  } = e, Pn = m.useMemo(() => Gr(h) && Object.prototype.hasOwnProperty.call(h, "default") && h.default?.locale ? h.default : h, [h]), ir = m.useCallback((dt, en) => {
    const {
      prefixCls: Be
    } = e;
    if (en)
      return en;
    const Bn = Be || P.getPrefixCls("");
    return dt ? `${Bn}-${dt}` : Bn;
  }, [P.getPrefixCls, e.prefixCls]), pn = R || P.iconPrefixCls || up, Jt = o || P.csp, It = fE(M, P.theme, {
    prefixCls: ir("")
  }), yt = {
    csp: Jt,
    autoInsertSpaceInButton: i,
    alert: l,
    affix: c,
    anchor: f,
    app: p,
    locale: Pn || k,
    direction: v,
    space: S,
    splitter: x,
    virtual: b,
    popupMatchSelectWidth: E ?? C,
    popupOverflow: $,
    getPrefixCls: ir,
    iconPrefixCls: pn,
    theme: It,
    segmented: z,
    statistic: O,
    spin: j,
    calendar: Y,
    carousel: V,
    cascader: X,
    collapse: Q,
    typography: oe,
    checkbox: G,
    descriptions: le,
    divider: he,
    drawer: D,
    skeleton: J,
    steps: q,
    image: T,
    input: Ue,
    inputPassword: Qe,
    inputSearch: ke,
    textArea: Xe,
    otp: ut,
    layout: A,
    list: ee,
    mentions: te,
    modal: se,
    progress: re,
    result: fe,
    slider: ie,
    breadcrumb: Z,
    masonry: ae,
    menu: ce,
    pagination: Me,
    empty: Oe,
    badge: xt,
    borderBeam: Ze,
    radio: tt,
    rate: je,
    ribbon: Je,
    switch: ft,
    transfer: dn,
    avatar: Rt,
    message: qt,
    tag: Ut,
    table: kt,
    card: mt,
    cardMeta: Mt,
    tabs: qe,
    timeline: Kt,
    timePicker: Ve,
    upload: Ae,
    notification: ze,
    tree: Ge,
    colorPicker: gt,
    datePicker: Xt,
    rangePicker: nt,
    flex: Qt,
    wave: Tt,
    dropdown: $n,
    warning: _n,
    tour: de,
    tooltip: Ee,
    popover: xe,
    popconfirm: bt,
    qrcode: Zt,
    floatButton: Nt,
    floatButtonGroup: An,
    variant: an,
    inputNumber: vr,
    treeSelect: Ln,
    watermark: or
  }, hn = {
    ...P
  };
  Object.keys(yt).forEach((dt) => {
    yt[dt] !== void 0 && (hn[dt] = yt[dt]);
  }), mE.forEach((dt) => {
    const en = e[dt];
    en && (hn[dt] = en);
  }), typeof i < "u" && (hn.button = {
    autoInsertSpace: i,
    ...hn.button
  });
  const Lt = ac(() => hn, hn, (dt, en) => {
    const Be = Object.keys(dt), Bn = Object.keys(en);
    return Be.length !== Bn.length || Be.some((Hn) => dt[Hn] !== en[Hn]);
  }), {
    layer: mn
  } = m.useContext(Qo), Yr = m.useMemo(() => ({
    prefixCls: pn,
    csp: Jt,
    layer: mn ? "antd" : void 0,
    zeroRuntime: !!mn || It?.zeroRuntime
  }), [pn, Jt, mn, It?.zeroRuntime]);
  let rt = /* @__PURE__ */ m.createElement(m.Fragment, null, /* @__PURE__ */ m.createElement(hE, {
    iconPrefixCls: pn,
    csp: Jt
  }), /* @__PURE__ */ m.createElement(pE, {
    dropdownMatchSelectWidth: C
  }), n);
  const Sr = m.useMemo(() => Ii(gc.Form?.defaultValidateMessages || {}, Lt.locale?.Form?.defaultValidateMessages || {}, Lt.form?.validateMessages || {}, g?.validateMessages || {}), [Lt, g?.validateMessages]);
  Object.keys(Sr).length > 0 && (rt = /* @__PURE__ */ m.createElement(Nb.Provider, {
    value: Sr
  }, rt)), Pn && (rt = /* @__PURE__ */ m.createElement(zb, {
    locale: Pn,
    _ANT_MARK__: Fb
  }, rt)), rt = /* @__PURE__ */ m.createElement(mp.Provider, {
    value: Yr
  }, rt), y && (rt = /* @__PURE__ */ m.createElement(cE, {
    size: y
  }, rt)), rt = /* @__PURE__ */ m.createElement(dE, null, rt), Ee?.unique && (rt = /* @__PURE__ */ m.createElement(Nv, null, rt));
  const Kr = m.useMemo(() => {
    const {
      algorithm: dt,
      token: en,
      components: Be,
      cssVar: Bn,
      ...Hn
    } = It || {}, Mr = dt && (!Array.isArray(dt) || dt.length > 0) ? Ga(dt) : dp, tn = {};
    Object.entries(Be || {}).forEach(([Dn, gn]) => {
      const at = {
        ...gn
      };
      "algorithm" in at && (at.algorithm === !0 ? at.theme = Mr : (Array.isArray(at.algorithm) || Yi(at.algorithm)) && (at.theme = Ga(at.algorithm)), delete at.algorithm), tn[Dn] = at;
    });
    const Tr = {
      ...Bi,
      ...en
    };
    return {
      ...Hn,
      theme: Mr,
      token: Tr,
      components: tn,
      override: {
        override: Tr,
        ...tn
      },
      cssVar: Bn
    };
  }, [It]);
  return M && (rt = /* @__PURE__ */ m.createElement(pp.Provider, {
    value: Kr
  }, rt)), Lt.warning && (rt = /* @__PURE__ */ m.createElement(Ax.Provider, {
    value: Lt.warning
  }, rt)), I !== void 0 && (rt = /* @__PURE__ */ m.createElement(aE, {
    disabled: I
  }, rt)), /* @__PURE__ */ m.createElement(On.Provider, {
    value: Lt
  }, rt);
}, Co = (e) => {
  const n = m.useContext(On), o = m.useContext(wv);
  return /* @__PURE__ */ m.createElement(yE, {
    parentContext: n,
    legacyLocale: o,
    ...e
  });
};
Co.ConfigContext = On;
Co.SizeContext = Di;
Co.config = gE;
Co.useConfig = uE;
Object.defineProperty(Co, "SizeContext", {
  get: () => Di
});
const c0 = (e) => e === "horizontal" || e === "vertical", Iv = (e, n, o) => m.useMemo(() => {
  const i = c0(e);
  let l;
  return i ? l = e : typeof n == "boolean" ? l = n ? "vertical" : "horizontal" : l = c0(o) ? o : "horizontal", [l, l === "vertical"];
}, [o, e, n]), Fv = /* @__PURE__ */ ye.createContext(void 0), Ao = 100, zv = {
  Modal: Ao,
  Drawer: Ao,
  Popover: Ao,
  Popconfirm: Ao,
  Tooltip: Ao,
  Tour: Ao,
  FloatButton: Ao
}, vE = {
  SelectLike: 50,
  Dropdown: 50,
  DatePicker: 50,
  Menu: 50,
  ImagePreview: 1
}, SE = (e) => e in zv, wE = (e, n) => {
  const [, o] = Gi(), i = ye.useContext(Fv), l = SE(e);
  let c;
  if (n !== void 0)
    c = [n, n];
  else {
    let f = i ?? 0;
    l ? f += // Use preset token zIndex by default but not stack when has parent container
    (i ? 0 : o.zIndexPopupBase) + // Container offset
    zv[e] : f += vE[e], c = [i === void 0 ? n : f, f];
  }
  return c;
}, xE = (e, n, o) => o !== void 0 ? o : `${e}-${n}`, yc = (e) => {
  const n = ye.useContext(Di);
  return ye.useMemo(() => e ? Rb(e) ? e ?? n : Yi(e) ? e(n) : n : n, [e, n]);
}, CE = (e) => {
  const {
    componentCls: n
  } = e;
  return {
    [n]: {
      display: "inline-flex",
      "&-block": {
        display: "flex",
        width: "100%"
      },
      "&-vertical": {
        flexDirection: "column"
      },
      "&-rtl": {
        direction: "rtl"
      }
    }
  };
}, bE = Xr(["Space", "Compact"], CE, () => ({}), {
  // Space component don't apply extra font style
  // https://github.com/ant-design/ant-design/issues/40315
  resetStyle: !1
}), vc = /* @__PURE__ */ m.createContext(null), Ov = (e, n) => {
  const o = m.useContext(vc), i = m.useMemo(() => {
    if (!o)
      return "";
    const {
      compactDirection: l,
      isFirstItem: c,
      isLastItem: f
    } = o, p = l === "vertical" ? "-vertical-" : "-";
    return we(`${e}-compact${p}item`, {
      [`${e}-compact${p}first-item`]: c,
      [`${e}-compact${p}last-item`]: f,
      [`${e}-compact${p}item-rtl`]: n === "rtl"
    });
  }, [e, n, o]);
  return {
    compactSize: o?.compactSize,
    compactDirection: o?.compactDirection,
    compactItemClassnames: i
  };
}, EE = (e) => {
  const {
    children: n
  } = e;
  return /* @__PURE__ */ m.createElement(vc.Provider, {
    value: null
  }, n);
}, $E = (e) => {
  const {
    children: n,
    ...o
  } = e;
  return /* @__PURE__ */ m.createElement(vc.Provider, {
    value: m.useMemo(() => o, [o])
  }, n);
}, _E = (e) => {
  const {
    getPrefixCls: n,
    direction: o
  } = m.useContext(On), {
    size: i,
    direction: l,
    orientation: c,
    block: f,
    prefixCls: p,
    className: g,
    rootClassName: h,
    children: y,
    vertical: v,
    ...S
  } = e, [x, b] = Iv(c, v, l), C = yc((I) => i ?? I), E = n("space-compact", p), [$] = bE(E), k = we(E, $, {
    [`${E}-rtl`]: o === "rtl",
    [`${E}-block`]: f,
    [`${E}-vertical`]: b
  }, g, h), P = m.useContext(vc), R = ol(y), M = m.useMemo(() => R.map((I, z) => {
    const O = I?.key || `${E}-item-${z}`;
    return /* @__PURE__ */ m.createElement($E, {
      key: O,
      compactSize: C,
      compactDirection: x,
      isFirstItem: z === 0 && (!P || P?.isFirstItem),
      isLastItem: z === R.length - 1 && (!P || P?.isLastItem)
    }, I);
  }), [R, P, x, C, E]);
  return R.length === 0 ? null : /* @__PURE__ */ m.createElement("div", {
    className: k,
    ...S
  }, M);
}, u0 = (e) => ({
  animationDuration: e,
  animationFillMode: "both"
}), Av = (e, n, o, i, l = !1) => {
  const c = l ? "&" : "";
  return {
    [`
      ${c}${e}-enter,
      ${c}${e}-appear
    `]: {
      ...u0(i),
      animationPlayState: "paused"
    },
    [`${c}${e}-leave`]: {
      ...u0(i),
      animationPlayState: "paused"
    },
    [`
      ${c}${e}-enter${e}-enter-active,
      ${c}${e}-appear${e}-appear-active
    `]: {
      animationName: n,
      animationPlayState: "running"
    },
    [`${c}${e}-leave${e}-leave-active`]: {
      animationName: o,
      animationPlayState: "running",
      pointerEvents: "none"
    }
  };
}, PE = new ln("antFadeIn", {
  "0%": {
    opacity: 0
  },
  "100%": {
    opacity: 1
  }
}), RE = new ln("antFadeOut", {
  "0%": {
    opacity: 1
  },
  "100%": {
    opacity: 0
  }
}), kE = (e, n = !1) => {
  const {
    antCls: o
  } = e, i = `${o}-fade`, l = n ? "&" : "";
  return [Av(i, PE, RE, e.motionDurationMid, n), {
    [`
        ${l}${i}-enter,
        ${l}${i}-appear
      `]: {
      opacity: 0,
      animationTimingFunction: "linear"
    },
    [`${l}${i}-leave`]: {
      animationTimingFunction: "linear"
    }
  }];
}, ME = new ln("antZoomIn", {
  "0%": {
    transform: "scale(0.2)",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    opacity: 1
  }
}), TE = new ln("antZoomOut", {
  "0%": {
    transform: "scale(1)"
  },
  "100%": {
    transform: "scale(0.2)",
    opacity: 0
  }
}), f0 = new ln("antZoomBigIn", {
  "0%": {
    transform: "scale(0.8)",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    opacity: 1
  }
}), d0 = new ln("antZoomBigOut", {
  "0%": {
    transform: "scale(1)"
  },
  "100%": {
    transform: "scale(0.8)",
    opacity: 0
  }
}), NE = new ln("antZoomUpIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 0%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "50% 0%"
  }
}), IE = new ln("antZoomUpOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "50% 0%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 0%",
    opacity: 0
  }
}), FE = new ln("antZoomLeftIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "0% 50%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "0% 50%"
  }
}), zE = new ln("antZoomLeftOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "0% 50%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "0% 50%",
    opacity: 0
  }
}), OE = new ln("antZoomRightIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "100% 50%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "100% 50%"
  }
}), AE = new ln("antZoomRightOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "100% 50%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "100% 50%",
    opacity: 0
  }
}), LE = new ln("antZoomDownIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 100%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "50% 100%"
  }
}), BE = new ln("antZoomDownOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "50% 100%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 100%",
    opacity: 0
  }
}), HE = {
  zoom: {
    inKeyframes: ME,
    outKeyframes: TE
  },
  "zoom-big": {
    inKeyframes: f0,
    outKeyframes: d0
  },
  "zoom-big-fast": {
    inKeyframes: f0,
    outKeyframes: d0
  },
  "zoom-left": {
    inKeyframes: FE,
    outKeyframes: zE
  },
  "zoom-right": {
    inKeyframes: OE,
    outKeyframes: AE
  },
  "zoom-up": {
    inKeyframes: NE,
    outKeyframes: IE
  },
  "zoom-down": {
    inKeyframes: LE,
    outKeyframes: BE
  }
}, DE = (e, n) => {
  const {
    antCls: o
  } = e, i = `${o}-${n}`, {
    inKeyframes: l,
    outKeyframes: c
  } = HE[n];
  return [Av(i, l, c, e.motionDurationFast), {
    [`
        ${i}-enter,
        ${i}-appear
      `]: {
      transform: "scale(0)",
      opacity: 0,
      animationTimingFunction: e.motionEaseOutCirc,
      "&-prepare": {
        transform: "none"
      }
    },
    [`${i}-leave`]: {
      animationTimingFunction: e.motionEaseInOutCirc
    }
  }];
}, vf = (e) => Math.round(Number(e || 0)), jE = (e) => {
  if (e instanceof Pt)
    return e;
  if (e && typeof e == "object" && "h" in e && "b" in e) {
    const {
      b: n,
      ...o
    } = e;
    return {
      ...o,
      v: n
    };
  }
  return typeof e == "string" && /hsb/.test(e) ? e.replace(/hsb/, "hsv") : e;
};
class Ja extends Pt {
  constructor(n) {
    super(jE(n));
  }
  toHsbString() {
    const n = this.toHsb(), o = vf(n.s * 100), i = vf(n.b * 100), l = vf(n.h), c = n.a, f = `hsb(${l}, ${o}%, ${i}%)`, p = `hsba(${l}, ${o}%, ${i}%, ${c.toFixed(c === 0 ? 0 : 2)})`;
    return c === 1 ? f : p;
  }
  toHsb() {
    const {
      v: n,
      ...o
    } = this.toHsv();
    return {
      ...o,
      b: n,
      a: this.a
    };
  }
}
const VE = (e) => e instanceof Ja ? e : new Ja(e);
VE("#1677ff");
const WE = (e, n) => e?.replace(/[^0-9a-f]/gi, "").slice(0, n ? 8 : 6) || "", qE = (e, n) => e ? WE(e, n) : "";
let p0 = /* @__PURE__ */ (function() {
  function e(n) {
    if (Ui(this, e), this.cleared = !1, n instanceof e) {
      this.metaColor = n.metaColor.clone(), this.colors = n.colors?.map((i) => ({
        color: new e(i.color),
        percent: i.percent
      })), this.cleared = n.cleared;
      return;
    }
    const o = Array.isArray(n);
    o && n.length ? (this.colors = n.map(({
      color: i,
      percent: l
    }) => ({
      color: new e(i),
      percent: l
    })), this.metaColor = new Ja(this.colors[0].color.metaColor)) : this.metaColor = new Ja(o ? "" : n), (!n || o && !this.colors) && (this.metaColor = this.metaColor.setA(0), this.cleared = !0);
  }
  return Xi(e, [{
    key: "toHsb",
    value: function() {
      return this.metaColor.toHsb();
    }
  }, {
    key: "toHsbString",
    value: function() {
      return this.metaColor.toHsbString();
    }
  }, {
    key: "toHex",
    value: function() {
      return qE(this.toHexString(), this.metaColor.a < 1);
    }
  }, {
    key: "toHexString",
    value: function() {
      return this.metaColor.toHexString();
    }
  }, {
    key: "toRgb",
    value: function() {
      return this.metaColor.toRgb();
    }
  }, {
    key: "toRgbString",
    value: function() {
      return this.metaColor.toRgbString();
    }
  }, {
    key: "isGradient",
    value: function() {
      return !!this.colors && !this.cleared;
    }
  }, {
    key: "getColors",
    value: function() {
      return this.colors || [{
        color: this,
        percent: 0
      }];
    }
  }, {
    key: "toCssString",
    value: function() {
      const {
        colors: o
      } = this;
      return o ? `linear-gradient(90deg, ${o.map((l) => `${l.color.toRgbString()} ${l.percent}%`).join(", ")})` : this.metaColor.toRgbString();
    }
  }, {
    key: "equals",
    value: function(o) {
      return !o || this.isGradient() !== o.isGradient() ? !1 : this.isGradient() ? this.colors.length === o.colors.length && this.colors.every((i, l) => {
        const c = o.colors[l];
        return i.percent === c.percent && i.color.equals(c.color);
      }) : this.toHexString() === o.toHexString();
    }
  }]);
})();
function ec() {
  return ec = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o) ({}).hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, ec.apply(null, arguments);
}
const UE = (e) => e instanceof p0 ? e : new p0(e);
function XE(e, n, o, i) {
  const {
    focusElCls: l,
    focus: c,
    borderElCls: f
  } = o, p = f ? "> *" : "", g = p ? ` ${p}` : "", h = (S) => S.filter(Boolean).map((x) => `&:${x}${g}`).join(","), y = h(["hover", l ? `hover${l}` : null]), v = h([c ? "focus" : null, "active"]);
  return {
    [`&-item:not(${n}-last-item)`]: {
      marginInlineEnd: e.calc(e.lineWidth).mul(-1).equal()
    },
    [`&-item:not(${i}-status-success)`]: {
      zIndex: 2
    },
    "&-item": {
      [v]: {
        zIndex: 3
      },
      [y]: {
        zIndex: 4
      },
      ...l ? {
        [`&${l}`]: {
          zIndex: 3
        }
      } : {},
      [`&[disabled] ${p}`]: {
        zIndex: 0
      }
    }
  };
}
function GE(e, n, o) {
  const {
    borderElCls: i
  } = o, l = i ? `> ${i}` : "";
  return {
    [`&-item:not(${n}-first-item):not(${n}-last-item) ${l}`]: {
      borderRadius: 0
    },
    [`&-item:not(${n}-last-item)${n}-first-item`]: {
      [`& ${l}, &${e}-sm ${l}, &${e}-lg ${l}`]: {
        borderStartEndRadius: 0,
        borderEndEndRadius: 0
      }
    },
    [`&-item:not(${n}-first-item)${n}-last-item`]: {
      [`& ${l}, &${e}-sm ${l}, &${e}-lg ${l}`]: {
        borderStartStartRadius: 0,
        borderEndStartRadius: 0
      }
    }
  };
}
function xp(e, n = {
  focus: !0
}) {
  const {
    componentCls: o
  } = e, {
    componentCls: i
  } = n, l = i || o, c = `${l}-compact`;
  return {
    [c]: {
      ...XE(e, c, n, l),
      ...GE(l, c, n)
    }
  };
}
const qo = "RC_FORM_INTERNAL_HOOKS", Ke = () => {
  zn(!1, "Can not find FormContext. Please make sure you wrap Field under Form.");
}, ji = /* @__PURE__ */ m.createContext({
  getFieldValue: Ke,
  getFieldsValue: Ke,
  getFieldError: Ke,
  getFieldWarning: Ke,
  getFieldsError: Ke,
  isFieldsTouched: Ke,
  isFieldTouched: Ke,
  isFieldValidating: Ke,
  isFieldsValidating: Ke,
  resetFields: Ke,
  setFields: Ke,
  setFieldValue: Ke,
  setFieldsValue: Ke,
  validateFields: Ke,
  submit: Ke,
  getInternalHooks: () => (Ke(), {
    dispatch: Ke,
    initEntityValue: Ke,
    registerField: Ke,
    useSubscribe: Ke,
    setInitialValues: Ke,
    destroyForm: Ke,
    setCallbacks: Ke,
    registerWatch: Ke,
    getFields: Ke,
    setValidateMessages: Ke,
    setPreserve: Ke,
    getInitialValue: Ke
  })
}), tc = /* @__PURE__ */ m.createContext(null);
function yd(e) {
  return e == null ? [] : Array.isArray(e) ? e : [e];
}
function YE(e) {
  return e && !!e._init;
}
function vd() {
  return {
    default: "Validation error on field %s",
    required: "%s is required",
    enum: "%s must be one of %s",
    whitespace: "%s cannot be empty",
    date: {
      format: "%s date %s is invalid for format %s",
      parse: "%s date could not be parsed, %s is invalid ",
      invalid: "%s date %s is invalid"
    },
    types: {
      string: "%s is not a %s",
      method: "%s is not a %s (function)",
      array: "%s is not an %s",
      object: "%s is not an %s",
      number: "%s is not a %s",
      date: "%s is not a %s",
      boolean: "%s is not a %s",
      integer: "%s is not an %s",
      float: "%s is not a %s",
      regexp: "%s is not a valid %s",
      email: "%s is not a valid %s",
      tel: "%s is not a valid %s",
      url: "%s is not a valid %s",
      hex: "%s is not a valid %s"
    },
    string: {
      len: "%s must be exactly %s characters",
      min: "%s must be at least %s characters",
      max: "%s cannot be longer than %s characters",
      range: "%s must be between %s and %s characters"
    },
    number: {
      len: "%s must equal %s",
      min: "%s cannot be less than %s",
      max: "%s cannot be greater than %s",
      range: "%s must be between %s and %s"
    },
    array: {
      len: "%s must be exactly %s in length",
      min: "%s cannot be less than %s in length",
      max: "%s cannot be greater than %s in length",
      range: "%s must be between %s and %s in length"
    },
    pattern: {
      mismatch: "%s value %s does not match pattern %s"
    },
    clone() {
      const e = JSON.parse(JSON.stringify(this));
      return e.clone = this.clone, e;
    }
  };
}
const Sf = vd(), KE = /%[sdj%]/g;
let QE = () => {
};
typeof process < "u" && process.env;
function Sd(e) {
  if (!e || !e.length) return null;
  const n = {};
  return e.forEach((o) => {
    const i = o.field;
    n[i] = n[i] || [], n[i].push(o);
  }), n;
}
function Fn(e, ...n) {
  let o = 0;
  const i = n.length;
  return typeof e == "function" ? e.apply(null, n) : typeof e == "string" ? e.replace(KE, (c) => {
    if (c === "%%")
      return "%";
    if (o >= i)
      return c;
    switch (c) {
      case "%s":
        return String(n[o++]);
      case "%d":
        return Number(n[o++]);
      case "%j":
        try {
          return JSON.stringify(n[o++]);
        } catch {
          return "[Circular]";
        }
        break;
      default:
        return c;
    }
  }) : e;
}
function ZE(e) {
  return e === "string" || e === "url" || e === "hex" || e === "email" || e === "date" || e === "pattern" || e === "tel";
}
function At(e, n) {
  return !!(e == null || n === "array" && Array.isArray(e) && !e.length || ZE(n) && typeof e == "string" && !e);
}
function JE(e, n, o) {
  const i = [];
  let l = 0;
  const c = e.length;
  function f(p) {
    i.push(...p || []), l++, l === c && o(i);
  }
  e.forEach((p) => {
    n(p, f);
  });
}
function h0(e, n, o) {
  let i = 0;
  const l = e.length;
  function c(f) {
    if (f && f.length) {
      o(f);
      return;
    }
    const p = i;
    i = i + 1, p < l ? n(e[p], c) : o([]);
  }
  c([]);
}
function e$(e) {
  const n = [];
  return Object.keys(e).forEach((o) => {
    n.push(...e[o] || []);
  }), n;
}
class m0 extends Error {
  errors;
  fields;
  constructor(n, o) {
    super("Async Validation Error"), this.errors = n, this.fields = o;
  }
}
function t$(e, n, o, i, l) {
  if (n.first) {
    const v = new Promise((S, x) => {
      const b = (E) => (i(E), E.length ? x(new m0(E, Sd(E))) : S(l)), C = e$(e);
      h0(C, o, b);
    });
    return v.catch((S) => S), v;
  }
  const c = n.firstFields === !0 ? Object.keys(e) : n.firstFields || [], f = Object.keys(e), p = f.length;
  let g = 0;
  const h = [], y = new Promise((v, S) => {
    const x = (b) => {
      if (h.push.apply(h, b), g++, g === p)
        return i(h), h.length ? S(new m0(h, Sd(h))) : v(l);
    };
    f.length || (i(h), v(l)), f.forEach((b) => {
      const C = e[b];
      c.indexOf(b) !== -1 ? h0(C, o, x) : JE(C, o, x);
    });
  });
  return y.catch((v) => v), y;
}
function n$(e) {
  return !!(e && e.message !== void 0);
}
function r$(e, n) {
  let o = e;
  for (let i = 0; i < n.length; i++) {
    if (o == null)
      return o;
    o = o[n[i]];
  }
  return o;
}
function g0(e, n) {
  return (o) => {
    let i;
    return e.fullFields ? i = r$(n, e.fullFields) : i = n[o.field || e.fullField], n$(o) ? (o.field = o.field || e.fullField, o.fieldValue = i, o) : {
      message: typeof o == "function" ? o() : o,
      fieldValue: i,
      field: o.field || e.fullField
    };
  };
}
function y0(e, n) {
  if (n) {
    for (const o in n)
      if (n.hasOwnProperty(o)) {
        const i = n[o];
        typeof i == "object" && typeof e[o] == "object" ? e[o] = {
          ...e[o],
          ...i
        } : e[o] = i;
      }
  }
  return e;
}
const Ri = "enum", o$ = (e, n, o, i, l) => {
  e[Ri] = Array.isArray(e[Ri]) ? e[Ri] : [], e[Ri].indexOf(n) === -1 && i.push(Fn(l.messages[Ri], e.fullField, e[Ri].join(", ")));
}, i$ = (e, n, o, i, l) => {
  e.pattern && (e.pattern instanceof RegExp ? (e.pattern.lastIndex = 0, e.pattern.test(n) || i.push(Fn(l.messages.pattern.mismatch, e.fullField, n, e.pattern))) : typeof e.pattern == "string" && (new RegExp(e.pattern).test(n) || i.push(Fn(l.messages.pattern.mismatch, e.fullField, n, e.pattern))));
}, s$ = (e, n, o, i, l) => {
  const c = typeof e.len == "number", f = typeof e.min == "number", p = typeof e.max == "number", g = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
  let h = n, y = null;
  const v = typeof n == "number", S = typeof n == "string", x = Array.isArray(n);
  if (v ? y = "number" : S ? y = "string" : x && (y = "array"), !y)
    return !1;
  x && (h = n.length), S && (h = n.replace(g, "_").length), c ? h !== e.len && i.push(Fn(l.messages[y].len, e.fullField, e.len)) : f && !p && h < e.min ? i.push(Fn(l.messages[y].min, e.fullField, e.min)) : p && !f && h > e.max ? i.push(Fn(l.messages[y].max, e.fullField, e.max)) : f && p && (h < e.min || h > e.max) && i.push(Fn(l.messages[y].range, e.fullField, e.min, e.max));
}, Lv = (e, n, o, i, l, c) => {
  e.required && (!o.hasOwnProperty(e.field) || At(n, c || e.type)) && i.push(Fn(l.messages.required, e.fullField));
};
let ka;
const l$ = (() => {
  if (ka)
    return ka;
  const e = "[a-fA-F\\d:]", n = (M) => M && M.includeBoundaries ? `(?:(?<=\\s|^)(?=${e})|(?<=${e})(?=\\s|$))` : "", o = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}", i = "[a-fA-F\\d]{1,4}", f = `(?:${[
    `(?:${i}:){7}(?:${i}|:)`,
    // 1:2:3:4:5:6:7::  1:2:3:4:5:6:7:8
    `(?:${i}:){6}(?:${o}|:${i}|:)`,
    // 1:2:3:4:5:6::    1:2:3:4:5:6::8   1:2:3:4:5:6::8  1:2:3:4:5:6::
    `(?:${i}:){5}(?::${o}|(?::${i}){1,2}|:)`,
    // 1:2:3:4:5::      1:2:3:4:5::7:8   1:2:3:4:5::8    1:2:3:4:5::
    `(?:${i}:){4}(?:(?::${i}){0,1}:${o}|(?::${i}){1,3}|:)`,
    // 1:2:3:4::        1:2:3:4::6:7:8   1:2:3:4::8      1:2:3:4::
    `(?:${i}:){3}(?:(?::${i}){0,2}:${o}|(?::${i}){1,4}|:)`,
    // 1:2:3::          1:2:3::5:6:7:8   1:2:3::8        1:2:3::
    `(?:${i}:){2}(?:(?::${i}){0,3}:${o}|(?::${i}){1,5}|:)`,
    // 1:2::            1:2::4:5:6:7:8   1:2::8          1:2::
    `(?:${i}:){1}(?:(?::${i}){0,4}:${o}|(?::${i}){1,6}|:)`,
    // 1::              1::3:4:5:6:7:8   1::8            1::
    `(?::(?:(?::${i}){0,5}:${o}|(?::${i}){1,7}|:))`
    // ::2:3:4:5:6:7:8  ::2:3:4:5:6:7:8  ::8             ::
  ].join("|")})(?:%[0-9a-zA-Z]{1,})?`, p = new RegExp(`(?:^${o}$)|(?:^${f}$)`), g = new RegExp(`^${o}$`), h = new RegExp(`^${f}$`), y = (M) => M && M.exact ? p : new RegExp(`(?:${n(M)}${o}${n(M)})|(?:${n(M)}${f}${n(M)})`, "g");
  y.v4 = (M) => M && M.exact ? g : new RegExp(`${n(M)}${o}${n(M)}`, "g"), y.v6 = (M) => M && M.exact ? h : new RegExp(`${n(M)}${f}${n(M)}`, "g");
  const v = "(?:(?:[a-z]+:)?//)", S = "(?:\\S+(?::\\S*)?@)?", x = y.v4().source, b = y.v6().source, R = `(?:${v}|www\\.)${S}(?:localhost|${x}|${b}|(?:(?:[a-z\\u00a1-\\uffff0-9][-_]*)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))(?::\\d{2,5})?(?:[/?#][^\\s"]*)?`;
  return ka = new RegExp(`(?:^${R}$)`, "i"), ka;
}), wf = {
  // http://emailregex.com/
  email: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+\.)+[a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]{2,}))$/,
  // url: new RegExp(
  //   '^(?!mailto:)(?:(?:http|https|ftp)://|//)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-*)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-*)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$',
  //   'i',
  // ),
  /**
   * Phone number regex, support country code, brackets, spaces, and dashes (or non-breaking hyphen \u2011).
   * @see https://regexr.com/3c53v
   * @see https://ihateregex.io/expr/phone/
   * @see https://developers.google.com/style/phone-numbers using non-breaking hyphen \u2011
   */
  tel: /^(\+[0-9]{1,3}[-\s\u2011]?)?(\([0-9]{1,4}\)[-\s\u2011]?)?([0-9]+[-\s\u2011]?)*[0-9]+$/,
  hex: /^#?([a-f0-9]{6}|[a-f0-9]{3})$/i
}, Us = {
  integer(e) {
    return Us.number(e) && parseInt(e, 10) === e;
  },
  float(e) {
    return Us.number(e) && !Us.integer(e);
  },
  array(e) {
    return Array.isArray(e);
  },
  regexp(e) {
    if (e instanceof RegExp)
      return !0;
    try {
      return !!new RegExp(e);
    } catch {
      return !1;
    }
  },
  date(e) {
    return typeof e.getTime == "function" && typeof e.getMonth == "function" && typeof e.getYear == "function" && !isNaN(e.getTime());
  },
  number(e) {
    return isNaN(e) ? !1 : typeof e == "number";
  },
  object(e) {
    return typeof e == "object" && !Us.array(e);
  },
  method(e) {
    return typeof e == "function";
  },
  email(e) {
    return typeof e == "string" && e.length <= 320 && !!e.match(wf.email);
  },
  tel(e) {
    return typeof e == "string" && e.length <= 32 && !!e.match(wf.tel);
  },
  url(e) {
    return typeof e == "string" && e.length <= 2048 && !!e.match(l$());
  },
  hex(e) {
    return typeof e == "string" && !!e.match(wf.hex);
  }
}, a$ = (e, n, o, i, l) => {
  if (e.required && n === void 0) {
    Lv(e, n, o, i, l);
    return;
  }
  const c = ["integer", "float", "array", "regexp", "object", "method", "email", "tel", "number", "date", "url", "hex"], f = e.type;
  c.indexOf(f) > -1 ? Us[f](n) || i.push(Fn(l.messages.types[f], e.fullField, e.type)) : f && typeof n !== e.type && i.push(Fn(l.messages.types[f], e.fullField, e.type));
}, c$ = (e, n, o, i, l) => {
  (/^\s+$/.test(n) || n === "") && i.push(Fn(l.messages.whitespace, e.fullField));
}, Ie = {
  required: Lv,
  whitespace: c$,
  type: a$,
  range: s$,
  enum: o$,
  pattern: i$
}, u$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l);
  }
  o(c);
}, f$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (n == null && !e.required)
      return o();
    Ie.required(e, n, i, c, l, "array"), n != null && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, d$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie.type(e, n, i, c, l);
  }
  o(c);
}, p$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n, "date") && !e.required)
      return o();
    if (Ie.required(e, n, i, c, l), !At(n, "date")) {
      let p;
      n instanceof Date ? p = n : p = new Date(n), Ie.type(e, p, i, c, l), p && Ie.range(e, p.getTime(), i, c, l);
    }
  }
  o(c);
}, h$ = "enum", m$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie[h$](e, n, i, c, l);
  }
  o(c);
}, g$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, y$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, v$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie.type(e, n, i, c, l);
  }
  o(c);
}, S$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (n === "" && (n = void 0), At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, w$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie.type(e, n, i, c, l);
  }
  o(c);
}, x$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n, "string") && !e.required)
      return o();
    Ie.required(e, n, i, c, l), At(n, "string") || Ie.pattern(e, n, i, c, l);
  }
  o(c);
}, C$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), At(n) || Ie.type(e, n, i, c, l);
  }
  o(c);
}, b$ = (e, n, o, i, l) => {
  const c = [], f = Array.isArray(n) ? "array" : typeof n;
  Ie.required(e, n, i, c, l, f), o(c);
}, E$ = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n, "string") && !e.required)
      return o();
    Ie.required(e, n, i, c, l, "string"), At(n, "string") || (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l), Ie.pattern(e, n, i, c, l), e.whitespace === !0 && Ie.whitespace(e, n, i, c, l));
  }
  o(c);
}, Ma = (e, n, o, i, l) => {
  const c = e.type, f = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n, c) && !e.required)
      return o();
    Ie.required(e, n, i, f, l, c), At(n, c) || Ie.type(e, n, i, f, l);
  }
  o(f);
}, Is = {
  string: E$,
  method: v$,
  number: S$,
  boolean: d$,
  regexp: C$,
  integer: y$,
  float: g$,
  array: f$,
  object: w$,
  enum: m$,
  pattern: x$,
  date: p$,
  url: Ma,
  hex: Ma,
  email: Ma,
  tel: Ma,
  required: b$,
  any: u$
};
class nc {
  // ========================= Static =========================
  static register = function(o, i) {
    if (typeof i != "function")
      throw new Error("Cannot register a validator by type, validator is not a function");
    Is[o] = i;
  };
  static warning = QE;
  static messages = Sf;
  static validators = Is;
  // ======================== Instance ========================
  rules = null;
  _messages = Sf;
  constructor(n) {
    this.define(n);
  }
  define(n) {
    if (!n)
      throw new Error("Cannot configure a schema with no rules");
    if (typeof n != "object" || Array.isArray(n))
      throw new Error("Rules must be an object");
    this.rules = {}, Object.keys(n).forEach((o) => {
      const i = n[o];
      this.rules[o] = Array.isArray(i) ? i : [i];
    });
  }
  messages(n) {
    return n && (this._messages = y0(vd(), n)), this._messages;
  }
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  validate(n, o = {}, i = () => {
  }) {
    let l = n, c = o, f = i;
    if (typeof c == "function" && (f = c, c = {}), !this.rules || Object.keys(this.rules).length === 0)
      return f && f(null, l), Promise.resolve(l);
    function p(v) {
      let S = [], x = {};
      function b(C) {
        Array.isArray(C) ? S = S.concat(...C) : S.push(C);
      }
      for (let C = 0; C < v.length; C++)
        b(v[C]);
      S.length ? (x = Sd(S), f(S, x)) : f(null, l);
    }
    if (c.messages) {
      let v = this.messages();
      v === Sf && (v = vd()), y0(v, c.messages), c.messages = v;
    } else
      c.messages = this.messages();
    const g = {};
    (c.keys || Object.keys(this.rules)).forEach((v) => {
      const S = this.rules[v];
      let x = l[v];
      S.forEach((b) => {
        let C = b;
        typeof C.transform == "function" && (l === n && (l = {
          ...l
        }), x = l[v] = C.transform(x), x != null && (C.type = C.type || (Array.isArray(x) ? "array" : typeof x))), typeof C == "function" ? C = {
          validator: C
        } : C = {
          ...C
        }, C.validator = this.getValidationMethod(C), C.validator && (C.field = v, C.fullField = C.fullField || v, C.type = this.getType(C), g[v] = g[v] || [], g[v].push({
          rule: C,
          value: x,
          source: l,
          field: v
        }));
      });
    });
    const y = {};
    return t$(g, c, (v, S) => {
      const x = v.rule;
      let b = (x.type === "object" || x.type === "array") && (typeof x.fields == "object" || typeof x.defaultField == "object");
      b = b && (x.required || !x.required && v.value), x.field = v.field;
      function C(k, P) {
        return {
          ...P,
          fullField: `${x.fullField}.${k}`,
          fullFields: x.fullFields ? [...x.fullFields, k] : [k]
        };
      }
      function E(k = []) {
        let P = Array.isArray(k) ? k : [k];
        !c.suppressWarning && P.length && nc.warning("async-validator:", P), P.length && x.message !== void 0 && x.message !== null && (P = [].concat(x.message));
        let R = P.map(g0(x, l));
        if (c.first && R.length)
          return y[x.field] = 1, S(R);
        if (!b)
          S(R);
        else {
          if (x.required && !v.value)
            return x.message !== void 0 ? R = [].concat(x.message).map(g0(x, l)) : c.error && (R = [c.error(x, Fn(c.messages.required, x.field))]), S(R);
          let M = {};
          x.defaultField && Object.keys(v.value).map((O) => {
            M[O] = x.defaultField;
          }), M = {
            ...M,
            ...v.rule.fields
          };
          const I = {};
          Object.keys(M).forEach((O) => {
            const j = M[O], Y = Array.isArray(j) ? j : [j];
            I[O] = Y.map(C.bind(null, O));
          });
          const z = new nc(I);
          z.messages(c.messages), v.rule.options && (v.rule.options.messages = c.messages, v.rule.options.error = c.error), z.validate(v.value, v.rule.options || c, (O) => {
            const j = [];
            R && R.length && j.push(...R), O && O.length && j.push(...O), S(j.length ? j : null);
          });
        }
      }
      let $;
      if (x.asyncValidator)
        $ = x.asyncValidator(x, v.value, E, v.source, c);
      else if (x.validator) {
        try {
          $ = x.validator(x, v.value, E, v.source, c);
        } catch (k) {
          console.error?.(k), c.suppressValidatorError || setTimeout(() => {
            throw k;
          }, 0), E(k.message);
        }
        $ === !0 ? E() : $ === !1 ? E(typeof x.message == "function" ? x.message(x.fullField || x.field) : x.message || `${x.fullField || x.field} fails`) : $ instanceof Array ? E($) : $ instanceof Error && E($.message);
      }
      $ && $.then && $.then(() => E(), (k) => E(k));
    }, (v) => {
      p(v);
    }, l);
  }
  getType(n) {
    if (n.type === void 0 && n.pattern instanceof RegExp && (n.type = "pattern"), typeof n.validator != "function" && n.type && !Is.hasOwnProperty(n.type))
      throw new Error(Fn("Unknown rule type %s", n.type));
    return n.type || "string";
  }
  getValidationMethod(n) {
    if (typeof n.validator == "function")
      return n.validator;
    const o = Object.keys(n), i = o.indexOf("message");
    return i !== -1 && o.splice(i, 1), o.length === 1 && o[0] === "required" ? Is.required : Is[this.getType(n)] || void 0;
  }
}
const bn = "'${name}' is not a valid ${type}", Bv = {
  default: "Validation error on field '${name}'",
  required: "'${name}' is required",
  enum: "'${name}' must be one of [${enum}]",
  whitespace: "'${name}' cannot be empty",
  date: {
    format: "'${name}' is invalid for format date",
    parse: "'${name}' could not be parsed as date",
    invalid: "'${name}' is invalid date"
  },
  types: {
    string: bn,
    method: bn,
    array: bn,
    object: bn,
    number: bn,
    date: bn,
    boolean: bn,
    integer: bn,
    float: bn,
    regexp: bn,
    email: bn,
    tel: bn,
    url: bn,
    hex: bn
  },
  string: {
    len: "'${name}' must be exactly ${len} characters",
    min: "'${name}' must be at least ${min} characters",
    max: "'${name}' cannot be longer than ${max} characters",
    range: "'${name}' must be between ${min} and ${max} characters"
  },
  number: {
    len: "'${name}' must equal ${len}",
    min: "'${name}' cannot be less than ${min}",
    max: "'${name}' cannot be greater than ${max}",
    range: "'${name}' must be between ${min} and ${max}"
  },
  array: {
    len: "'${name}' must be exactly ${len} in length",
    min: "'${name}' cannot be less than ${min} in length",
    max: "'${name}' cannot be greater than ${max} in length",
    range: "'${name}' must be between ${min} and ${max} in length"
  },
  pattern: {
    mismatch: "'${name}' does not match pattern ${pattern}"
  }
}, v0 = nc;
function $$(e, n) {
  return e.replace(/\\?\$\{\w+\}/g, (o) => {
    if (o.startsWith("\\"))
      return o.slice(1);
    const i = o.slice(2, -1);
    return n[i];
  });
}
const S0 = "CODE_LOGIC_ERROR";
async function wd(e, n, o, i, l) {
  const c = {
    ...o
  };
  if (delete c.ruleIndex, v0.warning = () => {
  }, c.validator) {
    const S = c.validator;
    c.validator = (...x) => {
      try {
        return S(...x);
      } catch (b) {
        return console.error(b), Promise.reject(S0);
      }
    };
  }
  let f = null;
  c && c.type === "array" && c.defaultField && (f = c.defaultField, delete c.defaultField);
  const p = new v0({
    [e]: [c]
  }), g = Ii(Bv, i.validateMessages);
  p.messages(g);
  let h = [];
  try {
    await Promise.resolve(p.validate({
      [e]: n
    }, {
      ...i
    }));
  } catch (S) {
    S.errors && (h = S.errors.map(({
      message: x
    }, b) => {
      const C = x === S0 ? g.default : x;
      return /* @__PURE__ */ m.isValidElement(C) ? (
        // Wrap ReactNode with `key`
        /* @__PURE__ */ m.cloneElement(C, {
          key: `error_${b}`
        })
      ) : C;
    }));
  }
  if (!h.length && f && Array.isArray(n) && n.length > 0)
    return (await Promise.all(n.map((x, b) => wd(`${e}.${b}`, x, f, i, l)))).reduce((x, b) => [...x, ...b], []);
  const y = {
    ...o,
    name: e,
    enum: (o.enum || []).join(", "),
    ...l
  };
  return h.map((S) => typeof S == "string" ? $$(S, y) : S);
}
function _$(e, n, o, i, l, c) {
  const f = e.join("."), p = o.map((h, y) => {
    const v = h.validator, S = {
      ...h,
      ruleIndex: y
    };
    return v && (S.validator = (x, b, C) => {
      let E = !1;
      const k = v(x, b, (...P) => {
        Promise.resolve().then(() => {
          zn(!E, "Your validator function has already return a promise. `callback` will be ignored."), E || C(...P);
        });
      });
      E = k && typeof k.then == "function" && typeof k.catch == "function", zn(E, "`callback` is deprecated. Please return a promise instead."), E && k.then(() => {
        C();
      }).catch((P) => {
        C(P || " ");
      });
    }), S;
  }).sort(({
    warningOnly: h,
    ruleIndex: y
  }, {
    warningOnly: v,
    ruleIndex: S
  }) => !!h == !!v ? y - S : h ? 1 : -1);
  let g;
  if (l === !0)
    g = new Promise(async (h, y) => {
      for (let v = 0; v < p.length; v += 1) {
        const S = p[v], x = await wd(f, n, S, i, c);
        if (x.length) {
          y([{
            errors: x,
            rule: S
          }]);
          return;
        }
      }
      h([]);
    });
  else {
    const h = p.map((y) => wd(f, n, y, i, c).then((v) => ({
      errors: v,
      rule: y
    })));
    g = (l ? R$(h) : P$(h)).then((y) => Promise.reject(y));
  }
  return g.catch((h) => h), g;
}
async function P$(e) {
  return Promise.all(e).then((n) => [].concat(...n));
}
async function R$(e) {
  let n = 0;
  return new Promise((o) => {
    e.forEach((i) => {
      i.then((l) => {
        l.errors.length && o([l]), n += 1, n === e.length && o([]);
      });
    });
  });
}
function St(e) {
  return yd(e);
}
function w0(e, n) {
  let o = {};
  return n.forEach((i) => {
    const l = Jn(e, i);
    o = In(o, i, l);
  }), o;
}
function zi(e, n, o = !1) {
  return e && e.some((i) => rc(n, i, o));
}
function rc(e, n, o = !1) {
  return !e || !n || !o && e.length !== n.length ? !1 : n.every((i, l) => e[l] === i);
}
function k$(e, n) {
  if (e === n)
    return !0;
  if (!e && n || e && !n || !e || !n || typeof e != "object" || typeof n != "object")
    return !1;
  const o = Object.keys(e), i = Object.keys(n);
  return [.../* @__PURE__ */ new Set([...o, ...i])].every((c) => {
    const f = e[c], p = n[c];
    return typeof f == "function" && typeof p == "function" ? !0 : f === p;
  });
}
function M$(e, ...n) {
  const o = n[0];
  return o && o.target && typeof o.target == "object" && e in o.target ? o.target[e] : o;
}
function x0(e, n, o) {
  const {
    length: i
  } = e;
  if (n < 0 || n >= i || o < 0 || o >= i)
    return e;
  const l = e[n], c = n - o;
  return c > 0 ? [...e.slice(0, o), l, ...e.slice(o, n), ...e.slice(n + 1, i)] : c < 0 ? [...e.slice(0, n), ...e.slice(n + 1, o + 1), l, ...e.slice(o + 1, i)] : e;
}
const Hv = (e) => {
  const n = new MessageChannel();
  n.port1.onmessage = e, n.port2.postMessage(null);
};
class T$ {
  namePathList = [];
  taskId = 0;
  watcherList = /* @__PURE__ */ new Set();
  form;
  constructor(n) {
    this.form = n;
  }
  register(n) {
    return this.watcherList.add(n), () => {
      this.watcherList.delete(n);
    };
  }
  notify(n) {
    n.forEach((o) => {
      this.namePathList.every((i) => !rc(i, o)) && this.namePathList.push(o);
    }), this.doBatch();
  }
  doBatch() {
    this.taskId += 1;
    const n = this.taskId;
    Hv(() => {
      if (n === this.taskId && this.watcherList.size) {
        const o = this.form.getForm(), i = o.getFieldsValue(), l = o.getFieldsValue(!0);
        this.watcherList.forEach((c) => {
          c(i, l, this.namePathList);
        }), this.namePathList = [];
      }
    });
  }
}
async function N$() {
  return new Promise((e) => {
    Hv(() => {
      xo(() => {
        e();
      });
    });
  });
}
function xd() {
  return xd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, xd.apply(this, arguments);
}
const Lo = [], Fs = [];
function xf(e, n, o, i, l, c) {
  return typeof e == "function" ? e(n, o, "source" in c ? {
    source: c.source
  } : {}) : i !== l;
}
class I$ extends m.PureComponent {
  static contextType = ji;
  state = {
    resetCount: 0
  };
  cancelRegisterFunc = null;
  mounted = !1;
  /**
   * Follow state should not management in State since it will async update by React.
   * This makes first render of form can not get correct state value.
   */
  touched = !1;
  /**
   * Mark when touched & validated. Currently only used for `dependencies`.
   * Note that we do not think field with `initialValue` is dirty
   * but this will be by `isFieldDirty` func.
   */
  dirty = !1;
  validatePromise;
  prevValidating;
  errors = Lo;
  warnings = Fs;
  // ============================== Subscriptions ==============================
  constructor(n) {
    if (super(n), n.fieldContext) {
      const {
        getInternalHooks: o
      } = n.fieldContext, {
        initEntityValue: i
      } = o(qo);
      i(this);
    }
  }
  componentDidMount() {
    const {
      shouldUpdate: n,
      fieldContext: o
    } = this.props;
    if (this.mounted = !0, o) {
      const {
        getInternalHooks: i
      } = o, {
        registerField: l
      } = i(qo);
      this.cancelRegisterFunc = l(this);
    }
    n === !0 && this.reRender();
  }
  componentWillUnmount() {
    this.cancelRegister(), this.triggerMetaEvent(!0), this.mounted = !1;
  }
  cancelRegister = () => {
    const {
      preserve: n,
      isListField: o,
      name: i
    } = this.props;
    this.cancelRegisterFunc && this.cancelRegisterFunc(o, n, St(i)), this.cancelRegisterFunc = null;
  };
  // ================================== Utils ==================================
  getNamePath = () => {
    const {
      name: n,
      fieldContext: o
    } = this.props, {
      prefixName: i = []
    } = o;
    return n !== void 0 ? [...i, ...n] : [];
  };
  getRules = () => {
    const {
      rules: n = [],
      fieldContext: o
    } = this.props;
    return n.map((i) => typeof i == "function" ? i(o) : i);
  };
  reRender() {
    this.mounted && this.forceUpdate();
  }
  refresh = () => {
    this.mounted && this.setState(({
      resetCount: n
    }) => ({
      resetCount: n + 1
    }));
  };
  // Event should only trigger when meta changed
  metaCache = null;
  triggerMetaEvent = (n) => {
    const {
      onMetaChange: o
    } = this.props;
    if (o) {
      const i = {
        ...this.getMeta(),
        destroy: n
      };
      el(this.metaCache, i) || o(i), this.metaCache = i;
    } else
      this.metaCache = null;
  };
  // ========================= Field Entity Interfaces =========================
  // Trigger by store update. Check if need update the component
  onStoreChange = (n, o, i) => {
    const {
      shouldUpdate: l,
      dependencies: c = [],
      onReset: f
    } = this.props, {
      store: p
    } = i, g = this.getNamePath(), h = this.getValue(n), y = this.getValue(p), v = o && zi(o, g);
    switch (i.type === "valueUpdate" && i.source === "external" && !el(h, y) && (this.touched = !0, this.dirty = !0, this.validatePromise = null, this.errors = Lo, this.warnings = Fs, this.triggerMetaEvent()), i.type) {
      case "reset":
        if (!o || v) {
          this.touched = !1, this.dirty = !1, this.validatePromise = void 0, this.errors = Lo, this.warnings = Fs, this.triggerMetaEvent(), f?.(), this.refresh();
          return;
        }
        break;
      /**
       * In case field with `preserve = false` nest deps like:
       * - A = 1 => show B
       * - B = 1 => show C
       * - Reset A, need clean B, C
       */
      case "remove": {
        if (l && xf(l, n, p, h, y, i)) {
          this.reRender();
          return;
        }
        break;
      }
      case "setField": {
        const {
          data: S
        } = i;
        if (v) {
          "touched" in S && (this.touched = S.touched), "validating" in S && !("originRCField" in S) && (this.validatePromise = S.validating ? Promise.resolve([]) : null), "errors" in S && (this.errors = S.errors || Lo), "warnings" in S && (this.warnings = S.warnings || Fs), this.dirty = !0, this.triggerMetaEvent(), this.reRender();
          return;
        } else if ("value" in S && zi(o, g, !0)) {
          this.reRender();
          return;
        }
        if (l && !g.length && xf(l, n, p, h, y, i)) {
          this.reRender();
          return;
        }
        break;
      }
      case "dependenciesUpdate": {
        if (c.map(St).some((x) => zi(i.relatedFields, x))) {
          this.reRender();
          return;
        }
        break;
      }
      default:
        if (v || (!c.length || g.length || l) && xf(l, n, p, h, y, i)) {
          this.reRender();
          return;
        }
        break;
    }
    l === !0 && this.reRender();
  };
  validateRules = (n) => {
    const o = this.getNamePath(), i = this.getValue(), {
      triggerName: l,
      validateOnly: c = !1,
      delayFrame: f
    } = n || {}, p = Promise.resolve().then(async () => {
      if (!this.mounted)
        return [];
      const {
        validateFirst: g = !1,
        messageVariables: h,
        validateDebounce: y
      } = this.props;
      f && await N$();
      let v = this.getRules();
      if (l && (v = v.filter((x) => x).filter((x) => {
        const {
          validateTrigger: b
        } = x;
        return b ? yd(b).includes(l) : !0;
      })), y && l && (await new Promise((x) => {
        setTimeout(x, y);
      }), this.validatePromise !== p))
        return [];
      const S = _$(o, i, v, n, g, h);
      return S.catch((x) => x).then((x = Lo) => {
        if (this.validatePromise === p) {
          this.validatePromise = null;
          const b = [], C = [];
          x.forEach?.(({
            rule: {
              warningOnly: E
            },
            errors: $ = Lo
          }) => {
            E ? C.push(...$) : b.push(...$);
          }), this.errors = b, this.warnings = C, this.triggerMetaEvent(), this.reRender();
        }
      }), S;
    });
    return c || (this.validatePromise = p, this.dirty = !0, this.errors = Lo, this.warnings = Fs, this.triggerMetaEvent(), this.reRender()), p;
  };
  isFieldValidating = () => !!this.validatePromise;
  isFieldTouched = () => this.touched;
  isFieldDirty = () => {
    if (this.dirty || this.props.initialValue !== void 0)
      return !0;
    const {
      fieldContext: n
    } = this.props, {
      getInitialValue: o
    } = n.getInternalHooks(qo);
    return o(this.getNamePath()) !== void 0;
  };
  getErrors = () => this.errors;
  getWarnings = () => this.warnings;
  isListField = () => this.props.isListField;
  isList = () => this.props.isList;
  isPreserve = () => this.props.preserve;
  // ============================= Child Component =============================
  getMeta = () => (this.prevValidating = this.isFieldValidating(), {
    touched: this.isFieldTouched(),
    validating: this.prevValidating,
    errors: this.errors,
    warnings: this.warnings,
    name: this.getNamePath(),
    validated: this.validatePromise === null
  });
  // Only return validate child node. If invalidate, will do nothing about field.
  getOnlyChild = (n) => {
    if (typeof n == "function") {
      const i = this.getMeta();
      return {
        ...this.getOnlyChild(n(this.getControlled(), i, this.props.fieldContext)),
        isFunction: !0
      };
    }
    const o = ol(n);
    return o.length !== 1 || !/* @__PURE__ */ m.isValidElement(o[0]) ? {
      child: o,
      isFunction: !1
    } : {
      child: o[0],
      isFunction: !1
    };
  };
  // ============================== Field Control ==============================
  getValue = (n) => {
    const {
      getFieldsValue: o
    } = this.props.fieldContext, i = this.getNamePath();
    return Jn(n || o(!0), i);
  };
  getControlled = (n = {}) => {
    const {
      name: o,
      trigger: i = "onChange",
      validateTrigger: l,
      getValueFromEvent: c,
      normalize: f,
      valuePropName: p = "value",
      getValueProps: g,
      fieldContext: h
    } = this.props, y = l !== void 0 ? l : h.validateTrigger, v = this.getNamePath(), {
      getInternalHooks: S,
      getFieldsValue: x
    } = h, {
      dispatch: b
    } = S(qo), C = this.getValue(), E = g || ((M) => ({
      [p]: M
    })), $ = n[i], k = o !== void 0 ? E(C) : {}, P = {
      ...n,
      ...k
    };
    return P[i] = (...M) => {
      this.touched = !0, this.dirty = !0, this.triggerMetaEvent();
      const I = this.getValue();
      let z;
      c ? z = c(...M) : z = M$(p, ...M), f && (z = f(z, I, x(!0))), z !== I && b({
        type: "updateValue",
        namePath: v,
        value: z
      }), $ && $(...M);
    }, yd(y || []).forEach((M) => {
      const I = P[M];
      P[M] = (...z) => {
        I && I(...z);
        const {
          rules: O
        } = this.props;
        O && O.length && b({
          type: "validateField",
          namePath: v,
          triggerName: M
        });
      };
    }), P;
  };
  render() {
    const {
      resetCount: n
    } = this.state, {
      children: o
    } = this.props, {
      child: i,
      isFunction: l
    } = this.getOnlyChild(o);
    let c;
    return l ? c = i : /* @__PURE__ */ m.isValidElement(i) ? c = /* @__PURE__ */ m.cloneElement(i, this.getControlled(i.props)) : (zn(!i, "`children` of Field is not validate ReactElement."), c = i), /* @__PURE__ */ m.createElement(m.Fragment, {
      key: n
    }, c);
  }
}
function Dv({
  name: e,
  ...n
}) {
  const o = m.useContext(ji), i = m.useContext(tc), l = e !== void 0 ? St(e) : void 0, c = n.isListField ?? !!i;
  let f = "keep";
  return c || (f = `_${(l || []).join("_")}`), /* @__PURE__ */ m.createElement(I$, xd({
    key: f,
    name: l,
    isListField: c
  }, n, {
    fieldContext: o
  }));
}
function F$({
  name: e,
  initialValue: n,
  children: o,
  rules: i,
  validateTrigger: l,
  isListField: c
}) {
  const f = m.useContext(ji), p = m.useContext(tc), h = m.useRef({
    keys: [],
    id: 0
  }).current, y = m.useMemo(() => [...St(f.prefixName) || [], ...St(e)], [f.prefixName, e]), v = m.useMemo(() => ({
    ...f,
    prefixName: y
  }), [f, y]), S = m.useMemo(() => ({
    getKey: (b) => {
      const C = y.length, E = b[C];
      return [h.keys[E], b.slice(C + 1)];
    }
  }), [h, y]);
  if (typeof o != "function")
    return zn(!1, "Form.List only accepts function as children."), null;
  const x = (b, C, {
    source: E
  }) => E === "internal" ? !1 : b !== C;
  return /* @__PURE__ */ m.createElement(tc.Provider, {
    value: S
  }, /* @__PURE__ */ m.createElement(ji.Provider, {
    value: v
  }, /* @__PURE__ */ m.createElement(Dv, {
    name: [],
    shouldUpdate: x,
    rules: i,
    validateTrigger: l,
    initialValue: n,
    isList: !0,
    isListField: c ?? !!p
  }, ({
    value: b = [],
    onChange: C
  }, E) => {
    const {
      getFieldValue: $
    } = f, k = () => $(y || []) || [], P = {
      add: (M, I) => {
        const z = k();
        I >= 0 && I <= z.length ? (h.keys = [...h.keys.slice(0, I), h.id, ...h.keys.slice(I)], C([...z.slice(0, I), M, ...z.slice(I)])) : (h.keys = [...h.keys, h.id], C([...z, M])), h.id += 1;
      },
      remove: (M) => {
        const I = k(), z = new Set(Array.isArray(M) ? M : [M]);
        z.size <= 0 || (h.keys = h.keys.filter((O, j) => !z.has(j)), C(I.filter((O, j) => !z.has(j))));
      },
      move(M, I) {
        if (M === I)
          return;
        const z = k();
        M < 0 || M >= z.length || I < 0 || I >= z.length || (h.keys = x0(h.keys, M, I), C(x0(z, M, I)));
      }
    };
    let R = b || [];
    return Array.isArray(R) || (R = []), o(R.map((M, I) => {
      let z = h.keys[I];
      return z === void 0 && (h.keys[I] = h.id, z = h.keys[I], h.id += 1), {
        name: I,
        key: z,
        isListField: !0
      };
    }), P, E);
  })));
}
function z$(e) {
  let n = !1, o = e.length;
  const i = [];
  return e.length ? new Promise((l, c) => {
    e.forEach((f, p) => {
      f.catch((g) => (n = !0, g)).then((g) => {
        o -= 1, i[p] = g, !(o > 0) && (n && c(i), l(i));
      });
    });
  }) : Promise.resolve([]);
}
const Cd = "__@field_split__";
function Ta(e) {
  return e.map((n) => `${typeof n}:${n}`).join(Cd);
}
class ki {
  kvs = /* @__PURE__ */ new Map();
  set(n, o) {
    this.kvs.set(Ta(n), o);
  }
  get(n) {
    return this.kvs.get(Ta(n));
  }
  getAsPrefix(n) {
    const o = Ta(n), i = o + Cd, l = [], c = this.kvs.get(o);
    return c !== void 0 && l.push(c), this.kvs.forEach((f, p) => {
      p.startsWith(i) && l.push(f);
    }), l;
  }
  update(n, o) {
    const i = this.get(n), l = o(i);
    l ? this.set(n, l) : this.delete(n);
  }
  delete(n) {
    this.kvs.delete(Ta(n));
  }
  // Since we only use this in test, let simply realize this
  map(n) {
    return [...this.kvs.entries()].map(([o, i]) => {
      const l = o.split(Cd);
      return n({
        key: l.map((c) => {
          const [, f, p] = c.match(/^([^:]*):(.*)$/);
          return f === "number" ? Number(p) : p;
        }),
        value: i
      });
    });
  }
  toJSON() {
    const n = {};
    return this.map(({
      key: o,
      value: i
    }) => (n[o.join(".")] = i, null)), n;
  }
}
class O$ {
  formHooked = !1;
  forceRootUpdate;
  subscribable = !0;
  store = {};
  fieldEntities = [];
  initialValues = {};
  callbacks = {};
  validateMessages = null;
  preserve = null;
  lastValidatePromise = null;
  watcherCenter = new T$(this);
  constructor(n) {
    this.forceRootUpdate = n;
  }
  getForm = () => ({
    getFieldValue: this.getFieldValue,
    getFieldsValue: this.getFieldsValue,
    getFieldError: this.getFieldError,
    getFieldWarning: this.getFieldWarning,
    getFieldsError: this.getFieldsError,
    isFieldsTouched: this.isFieldsTouched,
    isFieldTouched: this.isFieldTouched,
    isFieldValidating: this.isFieldValidating,
    isFieldsValidating: this.isFieldsValidating,
    resetFields: this.resetFields,
    setFields: this.setFields,
    setFieldValue: this.setFieldValue,
    setFieldsValue: this.setFieldsValue,
    validateFields: this.validateFields,
    submit: this.submit,
    _init: !0,
    getInternalHooks: this.getInternalHooks
  });
  // ======================== Internal Hooks ========================
  getInternalHooks = (n) => n === qo ? (this.formHooked = !0, {
    dispatch: this.dispatch,
    initEntityValue: this.initEntityValue,
    registerField: this.registerField,
    useSubscribe: this.useSubscribe,
    setInitialValues: this.setInitialValues,
    destroyForm: this.destroyForm,
    setCallbacks: this.setCallbacks,
    setValidateMessages: this.setValidateMessages,
    getFields: this.getFields,
    setPreserve: this.setPreserve,
    getInitialValue: this.getInitialValue,
    registerWatch: this.registerWatch
  }) : (zn(!1, "`getInternalHooks` is internal usage. Should not call directly."), null);
  useSubscribe = (n) => {
    this.subscribable = n;
  };
  /**
   * Record prev Form unmount fieldEntities which config preserve false.
   * This need to be refill with initialValues instead of store value.
   */
  prevWithoutPreserves = null;
  /**
   * First time `setInitialValues` should update store with initial value
   */
  setInitialValues = (n, o) => {
    if (this.initialValues = n || {}, o) {
      let i = Ii(n, this.store);
      this.prevWithoutPreserves?.map(({
        key: l
      }) => {
        i = In(i, l, Jn(n, l));
      }), this.prevWithoutPreserves = null, this.updateStore(i);
    }
  };
  destroyForm = (n) => {
    if (n)
      this.updateStore({});
    else {
      const o = new ki();
      this.getFieldEntities(!0).forEach((i) => {
        this.isMergedPreserve(i.isPreserve()) || o.set(i.getNamePath(), !0);
      }), this.prevWithoutPreserves = o;
    }
  };
  getInitialValue = (n) => {
    const o = Jn(this.initialValues, n);
    return n.length ? Ii(o) : o;
  };
  setCallbacks = (n) => {
    this.callbacks = n;
  };
  setValidateMessages = (n) => {
    this.validateMessages = n;
  };
  setPreserve = (n) => {
    this.preserve = n;
  };
  // ============================= Watch ============================
  registerWatch = (n) => this.watcherCenter.register(n);
  notifyWatch = (n = []) => {
    this.watcherCenter.notify(n);
  };
  // ========================== Dev Warning =========================
  timeoutId = null;
  warningUnhooked = () => {
  };
  // ============================ Store =============================
  updateStore = (n) => {
    this.store = n;
  };
  // ============================ Fields ============================
  /**
   * Get registered field entities.
   * @param pure Only return field which has a `name`. Default: false
   */
  getFieldEntities = (n = !1) => n ? this.fieldEntities.filter((o) => o.getNamePath().length) : this.fieldEntities;
  /**
   * Get a map of registered field entities with their name path as the key.
   * @param pure Only include fields which have a `name`. Default: false
   * @returns A NameMap containing field entities indexed by their name paths
   */
  getFieldsMap = (n = !1) => {
    const o = new ki();
    return this.getFieldEntities(n).forEach((i) => {
      const l = i.getNamePath();
      o.set(l, i);
    }), o;
  };
  /**
   * Get field entities based on a list of name paths.
   * @param nameList - Array of name paths to search for. If not provided, returns all field entities with names.
   * @param includesSubNamePath - Whether to include fields that have the given name path as a prefix.
   */
  getFieldEntitiesForNamePathList = (n, o = !1) => {
    if (!n)
      return this.getFieldEntities(!0);
    const i = this.getFieldsMap(!0);
    return o ? n.flatMap((l) => {
      const c = St(l), f = i.getAsPrefix(c);
      return f.length ? f : [{
        INVALIDATE_NAME_PATH: c
      }];
    }) : n.map((l) => {
      const c = St(l);
      return i.get(c) || {
        INVALIDATE_NAME_PATH: St(l)
      };
    });
  };
  getFieldsValue = (n, o) => {
    this.warningUnhooked();
    let i, l;
    if (n === !0 || Array.isArray(n) ? (i = n, l = o) : n && typeof n == "object" && (l = n.filter), i === !0 && !l)
      return this.store;
    const c = this.getFieldEntitiesForNamePathList(Array.isArray(i) ? i : null, !0), f = [], p = [];
    c.forEach((h) => {
      const y = h.INVALIDATE_NAME_PATH || h.getNamePath();
      if (h.isList?.()) {
        p.push(y);
        return;
      }
      if (!l)
        f.push(y);
      else {
        const v = "getMeta" in h ? h.getMeta() : null;
        l(v) && f.push(y);
      }
    });
    let g = w0(this.store, f.map(St));
    return p.forEach((h) => {
      Jn(g, h) || (g = In(g, h, []));
    }), g;
  };
  getFieldValue = (n) => {
    this.warningUnhooked();
    const o = St(n);
    return Jn(this.store, o);
  };
  getFieldsError = (n) => (this.warningUnhooked(), this.getFieldEntitiesForNamePathList(n).map((i, l) => i && !i.INVALIDATE_NAME_PATH ? {
    name: i.getNamePath(),
    errors: i.getErrors(),
    warnings: i.getWarnings()
  } : {
    name: St(n[l]),
    errors: [],
    warnings: []
  }));
  getFieldError = (n) => {
    this.warningUnhooked();
    const o = St(n);
    return this.getFieldsError([o])[0].errors;
  };
  getFieldWarning = (n) => {
    this.warningUnhooked();
    const o = St(n);
    return this.getFieldsError([o])[0].warnings;
  };
  isFieldsTouched = (...n) => {
    this.warningUnhooked();
    const [o, i] = n;
    let l, c = !1;
    n.length === 0 ? l = null : n.length === 1 ? Array.isArray(o) ? (l = o.map(St), c = !1) : (l = null, c = o) : (l = o.map(St), c = i);
    const f = this.getFieldEntities(!0), p = (v) => v.isFieldTouched();
    if (!l)
      return c ? f.every((v) => p(v) || v.isList()) : f.some(p);
    const g = new ki();
    l.forEach((v) => {
      g.set(v, []);
    }), f.forEach((v) => {
      const S = v.getNamePath();
      l.forEach((x) => {
        x.every((b, C) => S[C] === b) && g.update(x, (b) => [...b, v]);
      });
    });
    const h = (v) => v.some(p), y = g.map(({
      value: v
    }) => v);
    return c ? y.every(h) : y.some(h);
  };
  isFieldTouched = (n) => (this.warningUnhooked(), this.isFieldsTouched([n]));
  isFieldsValidating = (n) => {
    this.warningUnhooked();
    const o = this.getFieldEntities();
    if (!n)
      return o.some((l) => l.isFieldValidating());
    const i = n.map(St);
    return o.some((l) => {
      const c = l.getNamePath();
      return zi(i, c) && l.isFieldValidating();
    });
  };
  isFieldValidating = (n) => (this.warningUnhooked(), this.isFieldsValidating([n]));
  /**
   * Reset Field with field `initialValue` prop.
   * Can pass `entities` or `namePathList` or just nothing.
   */
  resetWithFieldInitialValue = (n = {}) => {
    const o = new ki(), i = this.getFieldEntities(!0);
    i.forEach((f) => {
      const {
        initialValue: p
      } = f.props, g = f.getNamePath();
      if (p !== void 0) {
        const h = o.get(g) || /* @__PURE__ */ new Set();
        h.add({
          entity: f,
          value: p
        }), o.set(g, h);
      }
    });
    const l = (f) => {
      f.forEach((p) => {
        const {
          initialValue: g
        } = p.props;
        if (g !== void 0) {
          const h = p.getNamePath();
          if (this.getInitialValue(h) !== void 0)
            zn(!1, `Form already set 'initialValues' with path '${h.join(".")}'. Field can not overwrite it.`);
          else {
            const v = o.get(h);
            if (v && v.size > 1)
              zn(!1, `Multiple Field with path '${h.join(".")}' set 'initialValue'. Can not decide which one to pick.`);
            else if (v) {
              const S = this.getFieldValue(h);
              !p.isListField() && (!n.skipExist || S === void 0) && this.updateStore(In(this.store, h, [...v][0].value));
            }
          }
        }
      });
    };
    let c;
    n.entities ? c = n.entities : n.namePathList ? (c = [], n.namePathList.forEach((f) => {
      const p = o.get(f);
      p && c.push(...[...p].map((g) => g.entity));
    })) : c = i, l(c);
  };
  resetFields = (n) => {
    this.warningUnhooked();
    const o = this.store;
    if (!n) {
      this.updateStore(Ii(this.initialValues)), this.resetWithFieldInitialValue(), this.notifyObservers(o, null, {
        type: "reset"
      }), this.notifyWatch();
      return;
    }
    const i = n.map(St);
    i.forEach((l) => {
      const c = this.getInitialValue(l);
      this.updateStore(In(this.store, l, c));
    }), this.resetWithFieldInitialValue({
      namePathList: i
    }), this.notifyObservers(o, i, {
      type: "reset"
    }), this.notifyWatch(i);
  };
  setFields = (n) => {
    this.warningUnhooked();
    const o = this.store, i = [];
    n.forEach((l) => {
      const {
        name: c,
        ...f
      } = l, p = St(c);
      i.push(p), "value" in f && this.updateStore(In(this.store, p, f.value)), this.notifyObservers(o, [p], {
        type: "setField",
        data: l
      });
    }), this.notifyWatch(i);
  };
  getFields = () => this.getFieldEntities(!0).map((i) => {
    const l = i.getNamePath(), f = {
      ...i.getMeta(),
      name: l,
      value: this.getFieldValue(l)
    };
    return Object.defineProperty(f, "originRCField", {
      value: !0
    }), f;
  });
  // =========================== Observer ===========================
  /**
   * This only trigger when a field is on constructor to avoid we get initialValue too late
   */
  initEntityValue = (n) => {
    const {
      initialValue: o
    } = n.props;
    if (o !== void 0) {
      const i = n.getNamePath();
      Jn(this.store, i) === void 0 && this.updateStore(In(this.store, i, o));
    }
  };
  isMergedPreserve = (n) => (n !== void 0 ? n : this.preserve) ?? !0;
  registerField = (n) => {
    this.fieldEntities.push(n);
    const o = n.getNamePath();
    if (this.notifyWatch([o]), n.props.initialValue !== void 0) {
      const i = this.store;
      this.resetWithFieldInitialValue({
        entities: [n],
        skipExist: !0
      }), this.notifyObservers(i, [n.getNamePath()], {
        type: "valueUpdate",
        source: "internal"
      });
    }
    return (i, l, c = []) => {
      if (this.fieldEntities = this.fieldEntities.filter((f) => f !== n), !this.isMergedPreserve(l) && (!i || c.length > 1)) {
        const f = i ? void 0 : this.getInitialValue(o);
        if (o.length && this.getFieldValue(o) !== f && this.fieldEntities.every((p) => (
          // Only reset when no namePath exist
          !rc(p.getNamePath(), o)
        ))) {
          const p = this.store;
          this.updateStore(In(p, o, f, !0)), this.notifyObservers(p, [o], {
            type: "remove"
          }), this.triggerDependenciesUpdate(p, o);
        }
      }
      this.notifyWatch([o]);
    };
  };
  dispatch = (n) => {
    switch (n.type) {
      case "updateValue": {
        const {
          namePath: o,
          value: i
        } = n;
        this.updateValue(o, i);
        break;
      }
      case "validateField": {
        const {
          namePath: o,
          triggerName: i
        } = n;
        this.validateFields([o], {
          triggerName: i
        });
        break;
      }
    }
  };
  notifyObservers = (n, o, i) => {
    if (this.subscribable) {
      const l = {
        ...i,
        store: this.getFieldsValue(!0)
      };
      this.getFieldEntities().forEach(({
        onStoreChange: c
      }) => {
        c(n, o, l);
      });
    } else
      this.forceRootUpdate();
  };
  /**
   * Notify dependencies children with parent update
   * We need delay to trigger validate in case Field is under render props
   */
  triggerDependenciesUpdate = (n, o) => {
    const i = this.getDependencyChildrenFields(o);
    return i.length && this.validateFields(i, {
      // Delay to avoid `useWatch` dynamic adjust rules that deps not get latest one
      delayFrame: !0
    }), this.notifyObservers(n, i, {
      type: "dependenciesUpdate",
      relatedFields: [o, ...i]
    }), i;
  };
  updateValue = (n, o) => {
    const i = St(n), l = this.store;
    this.updateStore(In(this.store, i, o)), this.notifyObservers(l, [i], {
      type: "valueUpdate",
      source: "internal"
    }), this.notifyWatch([i]);
    const c = this.triggerDependenciesUpdate(l, i), {
      onValuesChange: f
    } = this.callbacks;
    if (f) {
      const p = w0(this.store, [i]), g = this.getFieldsValue(), h = In(g, i, Jn(p, i));
      f(p, h);
    }
    this.triggerOnFieldsChange([i, ...c]);
  };
  // Let all child Field get update.
  setFieldsValue = (n) => {
    this.warningUnhooked();
    const o = this.store;
    if (n) {
      const i = Ii(this.store, n);
      this.updateStore(i);
    }
    this.notifyObservers(o, null, {
      type: "valueUpdate",
      source: "external"
    }), this.notifyWatch();
  };
  setFieldValue = (n, o) => {
    this.setFields([{
      name: n,
      value: o,
      errors: [],
      warnings: [],
      touched: !0
    }]);
  };
  getDependencyChildrenFields = (n) => {
    const o = /* @__PURE__ */ new Set(), i = [], l = new ki();
    this.getFieldEntities().forEach((f) => {
      const {
        dependencies: p
      } = f.props;
      (p || []).forEach((g) => {
        const h = St(g);
        l.update(h, (y = /* @__PURE__ */ new Set()) => (y.add(f), y));
      });
    });
    const c = (f) => {
      (l.get(f) || /* @__PURE__ */ new Set()).forEach((g) => {
        if (!o.has(g)) {
          o.add(g);
          const h = g.getNamePath();
          g.isFieldDirty() && h.length && (i.push(h), c(h));
        }
      });
    };
    return c(n), i;
  };
  triggerOnFieldsChange = (n, o) => {
    const {
      onFieldsChange: i
    } = this.callbacks;
    if (i) {
      const l = this.getFields();
      if (o) {
        const f = new ki();
        o.forEach(({
          name: p,
          errors: g
        }) => {
          f.set(p, g);
        }), l.forEach((p) => {
          p.errors = f.get(p.name) || p.errors;
        });
      }
      const c = l.filter(({
        name: f
      }) => zi(n, f));
      c.length && i(c, l);
    }
  };
  // =========================== Validate ===========================
  validateFields = (n, o) => {
    this.warningUnhooked();
    let i, l;
    Array.isArray(n) || typeof n == "string" || typeof o == "string" ? (i = n, l = o) : l = n;
    const c = !!i, f = c ? i.map(St) : [], p = [...f], g = [], h = String(Date.now()), y = /* @__PURE__ */ new Set(), {
      recursive: v,
      dirty: S
    } = l || {};
    this.getFieldEntities(!0).forEach((E) => {
      const $ = E.getNamePath();
      if (c || // If is field, pass directly
      ((!E.isList() || // If is list, do not add if already exist sub field in the namePathList
      !f.some((k) => rc(k, $, !0))) && p.push($), f.push($)), !(!E.props.rules || !E.props.rules.length) && !(S && !E.isFieldDirty()) && (y.add($.join(h)), !c || zi(f, $, v))) {
        const k = E.validateRules({
          validateMessages: {
            ...Bv,
            ...this.validateMessages
          },
          ...l
        });
        g.push(k.then(() => ({
          name: $,
          errors: [],
          warnings: []
        })).catch((P) => {
          const R = [], M = [];
          return P.forEach?.(({
            rule: {
              warningOnly: I
            },
            errors: z
          }) => {
            I ? M.push(...z) : R.push(...z);
          }), R.length ? Promise.reject({
            name: $,
            errors: R,
            warnings: M
          }) : {
            name: $,
            errors: R,
            warnings: M
          };
        }));
      }
    });
    const x = z$(g);
    this.lastValidatePromise = x, x.catch((E) => E).then((E) => {
      const $ = E.map(({
        name: k
      }) => k);
      this.notifyObservers(this.store, $, {
        type: "validateFinish"
      }), this.triggerOnFieldsChange($, E);
    });
    const b = x.then(() => this.lastValidatePromise === x ? Promise.resolve(this.getFieldsValue(p)) : Promise.reject([])).catch((E) => {
      const $ = E.filter((P) => P && P.errors.length), k = $[0]?.errors?.[0];
      return Promise.reject({
        message: k,
        values: this.getFieldsValue(f),
        errorFields: $,
        outOfDate: this.lastValidatePromise !== x
      });
    });
    b.catch((E) => E);
    const C = f.filter((E) => y.has(E.join(h)));
    return this.triggerOnFieldsChange(C), b;
  };
  // ============================ Submit ============================
  submit = () => {
    this.warningUnhooked(), this.validateFields().then((n) => {
      const {
        onFinish: o
      } = this.callbacks;
      if (o)
        try {
          o(n);
        } catch (i) {
          console.error(i);
        }
    }).catch((n) => {
      const {
        onFinishFailed: o
      } = this.callbacks;
      o && o(n);
    });
  };
}
function jv(e) {
  const n = m.useRef(null), [, o] = m.useState({});
  if (!n.current)
    if (e)
      n.current = e;
    else {
      const i = () => {
        o({});
      }, l = new O$(i);
      n.current = l.getForm();
    }
  return [n.current];
}
const bd = /* @__PURE__ */ m.createContext({
  triggerFormChange: () => {
  },
  triggerFormFinish: () => {
  },
  registerForm: () => {
  },
  unregisterForm: () => {
  }
}), A$ = ({
  validateMessages: e,
  onFormChange: n,
  onFormFinish: o,
  children: i
}) => {
  const l = m.useContext(bd), c = m.useRef({});
  return /* @__PURE__ */ m.createElement(bd.Provider, {
    value: {
      ...l,
      validateMessages: {
        ...l.validateMessages,
        ...e
      },
      // =========================================================
      // =                  Global Form Control                  =
      // =========================================================
      triggerFormChange: (f, p) => {
        n && n(f, {
          changedFields: p,
          forms: c.current
        }), l.triggerFormChange(f, p);
      },
      triggerFormFinish: (f, p) => {
        o && o(f, {
          values: p,
          forms: c.current
        }), l.triggerFormFinish(f, p);
      },
      registerForm: (f, p) => {
        f && (c.current = {
          ...c.current,
          [f]: p
        }), l.registerForm(f, p);
      },
      unregisterForm: (f) => {
        const p = {
          ...c.current
        };
        delete p[f], c.current = p, l.unregisterForm(f);
      }
    }
  }, i);
};
function Ed() {
  return Ed = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Ed.apply(this, arguments);
}
const L$ = (e, n) => {
  const {
    name: o,
    initialValues: i,
    fields: l,
    form: c,
    preserve: f,
    children: p,
    component: g = "form",
    validateMessages: h,
    validateTrigger: y = "onChange",
    onValuesChange: v,
    onFieldsChange: S,
    onFinish: x,
    onFinishFailed: b,
    clearOnDestroy: C,
    ...E
  } = e, $ = m.useRef(null), k = m.useContext(bd), [P] = jv(c), {
    useSubscribe: R,
    setInitialValues: M,
    setCallbacks: I,
    setValidateMessages: z,
    setPreserve: O,
    destroyForm: j
  } = P.getInternalHooks(qo);
  m.useImperativeHandle(n, () => ({
    ...P,
    nativeElement: $.current
  })), m.useEffect(() => (k.registerForm(o, P), () => {
    k.unregisterForm(o);
  }), [k, P, o]), z({
    ...k.validateMessages,
    ...h
  }), I({
    onValuesChange: v,
    onFieldsChange: (le, ...he) => {
      k.triggerFormChange(o, le), S && S(le, ...he);
    },
    onFinish: (le) => {
      k.triggerFormFinish(o, le), x && x(le);
    },
    onFinishFailed: b
  }), O(f);
  const Y = m.useRef(null);
  M(i, !Y.current), Y.current || (Y.current = !0), m.useEffect(
    () => () => j(C),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  let V;
  const X = typeof p == "function";
  if (X) {
    const le = P.getFieldsValue(!0);
    V = p(le, P);
  } else
    V = p;
  R(!X);
  const Q = m.useRef(null);
  m.useEffect(() => {
    k$(Q.current || [], l || []) || P.setFields(l || []), Q.current = l;
  }, [l, P]);
  const oe = m.useMemo(() => ({
    ...P,
    validateTrigger: y
  }), [P, y]), G = /* @__PURE__ */ m.createElement(tc.Provider, {
    value: null
  }, /* @__PURE__ */ m.createElement(ji.Provider, {
    value: oe
  }, V));
  return g === !1 ? G : /* @__PURE__ */ m.createElement(g, Ed({}, E, {
    ref: $,
    onSubmit: (le) => {
      le.preventDefault(), le.stopPropagation(), P.submit();
    },
    onReset: (le) => {
      le.preventDefault(), P.resetFields(), E.onReset?.(le);
    }
  }), G);
};
function Cf(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return Math.random();
  }
}
function B$(...e) {
  const [n, o = {}] = e, i = YE(o) ? {
    form: o
  } : o, l = i.form, [c, f] = m.useState(() => typeof n == "function" ? n({}) : void 0), p = m.useMemo(() => Cf(c), [c]), g = m.useRef(p);
  g.current = p;
  const h = m.useContext(ji), y = l || h, v = y && y._init, {
    getFieldsValue: S,
    getInternalHooks: x
  } = y, {
    registerWatch: b
  } = x(qo), C = wt(($, k) => {
    const P = i.preserve ? k ?? S(!0) : $ ?? S(), R = typeof n == "function" ? n(P) : Jn(P, St(n));
    Cf(c) !== Cf(R) && f(R);
  }), E = typeof n == "function" ? n : JSON.stringify(n);
  return m.useEffect(() => {
    v && C();
  }, [v, E]), m.useEffect(() => v ? b((k, P) => {
    C(k, P);
  }) : void 0, [v]), c;
}
const H$ = /* @__PURE__ */ m.forwardRef(L$), ml = H$;
ml.FormProvider = A$;
ml.Field = Dv;
ml.List = F$;
ml.useForm = jv;
ml.useWatch = B$;
const oc = /* @__PURE__ */ m.createContext({}), D$ = ({
  children: e,
  status: n,
  override: o
}) => {
  const i = m.useContext(oc), l = m.useMemo(() => {
    const c = {
      ...i
    };
    return o && delete c.isFormItemInput, n && (delete c.status, delete c.hasFeedback, delete c.feedbackIcon), c;
  }, [n, o, i]);
  return /* @__PURE__ */ m.createElement(oc.Provider, {
    value: l
  }, e);
}, j$ = /* @__PURE__ */ m.createContext(void 0), Vv = (e) => {
  const {
    space: n,
    form: o,
    children: i
  } = e;
  if (!Pb(i))
    return null;
  let l = i;
  return o && (l = /* @__PURE__ */ ye.createElement(D$, {
    override: !0,
    status: !0
  }, l)), n && (l = /* @__PURE__ */ ye.createElement(EE, null, l)), l;
}, Wv = (e, n, o) => we({
  [`${e}-status-success`]: n === "success",
  [`${e}-status-warning`]: n === "warning",
  [`${e}-status-error`]: n === "error",
  [`${e}-status-validating`]: n === "validating",
  [`${e}-has-feedback`]: o
}), V$ = (e, n) => n || e, W$ = (e, n, o) => {
  const {
    variant: i,
    [e]: l
  } = m.useContext(On), c = m.useContext(j$), f = l?.variant;
  let p;
  typeof n < "u" ? p = n : o === !1 ? p = "borderless" : p = c ?? f ?? i ?? "outlined";
  const g = Yx.includes(p);
  return [p, g];
};
var Na = {}, C0;
function q$() {
  if (C0) return Na;
  C0 = 1, Object.defineProperty(Na, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 00-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z" } }] }, name: "check", theme: "outlined" };
  return Na.default = e, Na;
}
var U$ = /* @__PURE__ */ q$();
const X$ = /* @__PURE__ */ nr(U$);
function $d() {
  return $d = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, $d.apply(this, arguments);
}
const G$ = (e, n) => /* @__PURE__ */ m.createElement(kr, $d({}, e, {
  ref: n,
  icon: X$
})), Y$ = /* @__PURE__ */ m.forwardRef(G$);
var Ia = {}, b0;
function K$() {
  if (b0) return Ia;
  b0 = 1, Object.defineProperty(Ia, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M884 256h-75c-5.1 0-9.9 2.5-12.9 6.6L512 654.2 227.9 262.6c-3-4.1-7.8-6.6-12.9-6.6h-75c-6.5 0-10.3 7.4-6.5 12.7l352.6 486.1c12.8 17.6 39 17.6 51.7 0l352.6-486.1c3.9-5.3.1-12.7-6.4-12.7z" } }] }, name: "down", theme: "outlined" };
  return Ia.default = e, Ia;
}
var Q$ = /* @__PURE__ */ K$();
const Z$ = /* @__PURE__ */ nr(Q$);
function _d() {
  return _d = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, _d.apply(this, arguments);
}
const J$ = (e, n) => /* @__PURE__ */ m.createElement(kr, _d({}, e, {
  ref: n,
  icon: Z$
})), e2 = /* @__PURE__ */ m.forwardRef(J$), qv = (e) => {
  const {
    children: n,
    prefixCls: o,
    id: i,
    classNames: l,
    styles: c,
    className: f,
    style: p
  } = e;
  return /* @__PURE__ */ m.createElement("div", {
    id: i,
    className: we(`${o}-container`, l?.container, f),
    style: {
      ...c?.container,
      ...p
    },
    role: "tooltip"
  }, typeof n == "function" ? n() : n);
}, Mi = {
  shiftX: 64,
  adjustY: 1
}, Ti = {
  adjustX: 1,
  shiftY: !0
}, Yn = [0, 0], t2 = {
  left: {
    points: ["cr", "cl"],
    overflow: Ti,
    offset: [-4, 0],
    targetOffset: Yn
  },
  right: {
    points: ["cl", "cr"],
    overflow: Ti,
    offset: [4, 0],
    targetOffset: Yn
  },
  top: {
    points: ["bc", "tc"],
    overflow: Mi,
    offset: [0, -4],
    targetOffset: Yn
  },
  bottom: {
    points: ["tc", "bc"],
    overflow: Mi,
    offset: [0, 4],
    targetOffset: Yn
  },
  topLeft: {
    points: ["bl", "tl"],
    overflow: Mi,
    offset: [0, -4],
    targetOffset: Yn
  },
  leftTop: {
    points: ["tr", "tl"],
    overflow: Ti,
    offset: [-4, 0],
    targetOffset: Yn
  },
  topRight: {
    points: ["br", "tr"],
    overflow: Mi,
    offset: [0, -4],
    targetOffset: Yn
  },
  rightTop: {
    points: ["tl", "tr"],
    overflow: Ti,
    offset: [4, 0],
    targetOffset: Yn
  },
  bottomRight: {
    points: ["tr", "br"],
    overflow: Mi,
    offset: [0, 4],
    targetOffset: Yn
  },
  rightBottom: {
    points: ["bl", "br"],
    overflow: Ti,
    offset: [4, 0],
    targetOffset: Yn
  },
  bottomLeft: {
    points: ["tl", "bl"],
    overflow: Mi,
    offset: [0, 4],
    targetOffset: Yn
  },
  leftBottom: {
    points: ["br", "bl"],
    overflow: Ti,
    offset: [-4, 0],
    targetOffset: Yn
  }
};
function Pd() {
  return Pd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Pd.apply(this, arguments);
}
const n2 = /* @__PURE__ */ m.forwardRef((e, n) => {
  const {
    trigger: o = ["hover"],
    mouseEnterDelay: i = 0,
    mouseLeaveDelay: l = 0.1,
    prefixCls: c = "rc-tooltip",
    children: f,
    onVisibleChange: p,
    afterVisibleChange: g,
    motion: h,
    placement: y = "right",
    align: v = {},
    destroyOnHidden: S = !1,
    defaultVisible: x,
    getTooltipContainer: b,
    arrowContent: C,
    overlay: E,
    id: $,
    showArrow: k = !0,
    classNames: P,
    styles: R,
    ...M
  } = e, I = cl($), z = m.useRef(null);
  m.useImperativeHandle(n, () => z.current);
  const O = {
    ...M
  };
  "visible" in e && (O.popupVisible = e.visible);
  const j = m.useMemo(() => {
    if (!k)
      return !1;
    const V = k === !0 ? {} : k;
    return {
      ...V,
      className: we(V.className, P?.arrow),
      style: {
        ...V.style,
        ...R?.arrow
      },
      content: V.content ?? C
    };
  }, [k, P?.arrow, R?.arrow, C]), Y = ({
    open: V
  }) => {
    const X = m.Children.only(f), Q = {
      "aria-describedby": E && V ? I : void 0
    };
    return /* @__PURE__ */ m.cloneElement(X, Q);
  };
  return /* @__PURE__ */ m.createElement(rE, Pd({
    popupClassName: P?.root,
    prefixCls: c,
    popup: /* @__PURE__ */ m.createElement(qv, {
      key: "content",
      prefixCls: c,
      id: I,
      classNames: P,
      styles: R
    }, E),
    action: o,
    builtinPlacements: t2,
    popupPlacement: y,
    ref: z,
    popupAlign: v,
    getPopupContainer: b,
    onOpenChange: p,
    afterOpenChange: g,
    popupMotion: h,
    defaultPopupVisible: x,
    autoDestroy: S,
    mouseLeaveDelay: l,
    popupStyle: R?.root,
    mouseEnterDelay: i,
    arrow: j,
    uniqueContainerClassName: P?.uniqueContainer,
    uniqueContainerStyle: R?.uniqueContainer
  }, O), Y);
});
function r2(e) {
  const {
    sizePopupArrow: n,
    borderRadiusXS: o,
    borderRadiusOuter: i
  } = e, l = n / 2, c = 0, f = l, p = i * 1 / Math.sqrt(2), g = l - i * (1 - 1 / Math.sqrt(2)), h = l - o * (1 / Math.sqrt(2)), y = i * (Math.sqrt(2) - 1) + o * (1 / Math.sqrt(2)), v = 2 * l - h, S = y, x = 2 * l - p, b = g, C = 2 * l - c, E = f, $ = l * Math.sqrt(2) + i * (Math.sqrt(2) - 2), k = i * (Math.sqrt(2) - 1), P = `polygon(${k}px 100%, 50% ${k}px, ${2 * l - k}px 100%, ${k}px 100%)`, R = `path('M ${c} ${f} A ${i} ${i} 0 0 0 ${p} ${g} L ${h} ${y} A ${o} ${o} 0 0 1 ${v} ${S} L ${x} ${b} A ${i} ${i} 0 0 0 ${C} ${E} Z')`;
  return {
    arrowShadowWidth: $,
    arrowPath: R,
    arrowPolygon: P
  };
}
const o2 = (e, n, o) => {
  const {
    sizePopupArrow: i,
    arrowPolygon: l,
    arrowPath: c,
    arrowShadowWidth: f,
    borderRadiusXS: p,
    calc: g
  } = e, h = {
    content: '""',
    position: "absolute",
    width: f,
    height: f,
    bottom: 0,
    insetInline: 0,
    margin: "auto",
    borderRadius: {
      _skip_check_: !0,
      value: `0 0 ${$e(p)} 0`
    },
    transform: "translateY(50%) rotate(-135deg)",
    zIndex: 0,
    background: "transparent"
  };
  return o && (h.boxShadow = o), {
    pointerEvents: "none",
    width: i,
    height: i,
    overflow: "hidden",
    "&::before": {
      position: "absolute",
      bottom: 0,
      insetInlineStart: 0,
      width: i,
      height: g(i).div(2).equal(),
      background: n,
      clipPath: {
        _multi_value_: !0,
        value: [l, c]
      },
      content: '""'
    },
    "&::after": h
  };
}, Uv = 8;
function Xv(e) {
  const {
    contentRadius: n,
    limitVerticalRadius: o
  } = e, i = n > 12 ? n + 2 : 12;
  return {
    arrowOffsetHorizontal: i,
    arrowOffsetVertical: o ? Uv : i
  };
}
const i2 = (e, n, o) => {
  const {
    componentCls: i,
    boxShadowPopoverArrow: l,
    arrowOffsetVertical: c,
    arrowOffsetHorizontal: f,
    antCls: p
  } = e, [g] = fl(p, "tooltip"), {
    arrowDistance: h = 0,
    arrowShadow: y = !0
  } = o || {};
  return {
    [i]: {
      // ============================ Basic ============================
      [`${i}-arrow`]: [{
        position: "absolute",
        zIndex: 1,
        // lift it up so the menu wouldn't cask shadow on it
        display: "block",
        ...o2(e, n, y ? l : !1),
        "&:before": {
          background: n
        }
      }],
      // ========================== Placement ==========================
      // Here handle the arrow position and rotate stuff
      // >>>>> Top
      [[`&-placement-top > ${i}-arrow`, `&-placement-topLeft > ${i}-arrow`, `&-placement-topRight > ${i}-arrow`].join(",")]: {
        bottom: h,
        transform: "translateY(100%) rotate(180deg)"
      },
      [`&-placement-top > ${i}-arrow`]: {
        left: {
          _skip_check_: !0,
          value: "50%"
        },
        transform: "translateX(-50%) translateY(100%) rotate(180deg)"
      },
      "&-placement-topLeft": {
        [g("arrow-offset-x")]: f,
        [`> ${i}-arrow`]: {
          left: {
            _skip_check_: !0,
            value: f
          }
        }
      },
      "&-placement-topRight": {
        [g("arrow-offset-x")]: `calc(100% - ${$e(f)})`,
        [`> ${i}-arrow`]: {
          right: {
            _skip_check_: !0,
            value: f
          }
        }
      },
      // >>>>> Bottom
      [[`&-placement-bottom > ${i}-arrow`, `&-placement-bottomLeft > ${i}-arrow`, `&-placement-bottomRight > ${i}-arrow`].join(",")]: {
        top: h,
        transform: "translateY(-100%)"
      },
      [`&-placement-bottom > ${i}-arrow`]: {
        left: {
          _skip_check_: !0,
          value: "50%"
        },
        transform: "translateX(-50%) translateY(-100%)"
      },
      "&-placement-bottomLeft": {
        [g("arrow-offset-x")]: f,
        [`> ${i}-arrow`]: {
          left: {
            _skip_check_: !0,
            value: f
          }
        }
      },
      "&-placement-bottomRight": {
        [g("arrow-offset-x")]: `calc(100% - ${$e(f)})`,
        [`> ${i}-arrow`]: {
          right: {
            _skip_check_: !0,
            value: f
          }
        }
      },
      // >>>>> Left
      [[`&-placement-left > ${i}-arrow`, `&-placement-leftTop > ${i}-arrow`, `&-placement-leftBottom > ${i}-arrow`].join(",")]: {
        right: {
          _skip_check_: !0,
          value: h
        },
        transform: "translateX(100%) rotate(90deg)"
      },
      [`&-placement-left > ${i}-arrow`]: {
        top: {
          _skip_check_: !0,
          value: "50%"
        },
        transform: "translateY(-50%) translateX(100%) rotate(90deg)"
      },
      [`&-placement-leftTop > ${i}-arrow`]: {
        top: c
      },
      [`&-placement-leftBottom > ${i}-arrow`]: {
        bottom: c
      },
      // >>>>> Right
      [[`&-placement-right > ${i}-arrow`, `&-placement-rightTop > ${i}-arrow`, `&-placement-rightBottom > ${i}-arrow`].join(",")]: {
        left: {
          _skip_check_: !0,
          value: h
        },
        transform: "translateX(-100%) rotate(-90deg)"
      },
      [`&-placement-right > ${i}-arrow`]: {
        top: {
          _skip_check_: !0,
          value: "50%"
        },
        transform: "translateY(-50%) translateX(-100%) rotate(-90deg)"
      },
      [`&-placement-rightTop > ${i}-arrow`]: {
        top: c
      },
      [`&-placement-rightBottom > ${i}-arrow`]: {
        bottom: c
      }
    }
  };
};
function s2(e, n, o, i) {
  if (i === !1)
    return {
      adjustX: !1,
      adjustY: !1
    };
  const l = Gr(i) ? i : {}, c = {};
  switch (e) {
    case "top":
    case "bottom":
      c.shiftX = n.arrowOffsetHorizontal * 2 + o, c.shiftY = !0, c.adjustY = !0;
      break;
    case "left":
    case "right":
      c.shiftY = n.arrowOffsetVertical * 2 + o, c.shiftX = !0, c.adjustX = !0;
      break;
  }
  const f = {
    ...c,
    ...l
  };
  return f.shiftX || (f.adjustX = !0), f.shiftY || (f.adjustY = !0), f;
}
const E0 = {
  left: {
    points: ["cr", "cl"]
  },
  right: {
    points: ["cl", "cr"]
  },
  top: {
    points: ["bc", "tc"]
  },
  bottom: {
    points: ["tc", "bc"]
  },
  topLeft: {
    points: ["bl", "tl"]
  },
  leftTop: {
    points: ["tr", "tl"]
  },
  topRight: {
    points: ["br", "tr"]
  },
  rightTop: {
    points: ["tl", "tr"]
  },
  bottomRight: {
    points: ["tr", "br"]
  },
  rightBottom: {
    points: ["bl", "br"]
  },
  bottomLeft: {
    points: ["tl", "bl"]
  },
  leftBottom: {
    points: ["br", "bl"]
  }
}, l2 = {
  topLeft: {
    points: ["bl", "tc"]
  },
  leftTop: {
    points: ["tr", "cl"]
  },
  topRight: {
    points: ["br", "tc"]
  },
  rightTop: {
    points: ["tl", "cr"]
  },
  bottomRight: {
    points: ["tr", "bc"]
  },
  rightBottom: {
    points: ["bl", "cr"]
  },
  bottomLeft: {
    points: ["tl", "bc"]
  },
  leftBottom: {
    points: ["br", "cl"]
  }
}, a2 = /* @__PURE__ */ new Set(["topLeft", "topRight", "bottomLeft", "bottomRight", "leftTop", "leftBottom", "rightTop", "rightBottom"]);
function c2(e) {
  const {
    arrowWidth: n,
    autoAdjustOverflow: o,
    arrowPointAtCenter: i,
    offset: l,
    borderRadius: c
  } = e, f = n / 2, p = {}, g = Xv({
    contentRadius: c,
    limitVerticalRadius: !0
  });
  return Object.keys(E0).forEach((h) => {
    const v = {
      ...i && l2[h] || E0[h],
      offset: [0, 0],
      dynamicInset: !0
    };
    switch (p[h] = v, a2.has(h) && (v.autoArrow = !1), h) {
      case "top":
      case "topLeft":
      case "topRight":
        v.offset[1] = -f - l;
        break;
      case "bottom":
      case "bottomLeft":
      case "bottomRight":
        v.offset[1] = f + l;
        break;
      case "left":
      case "leftTop":
      case "leftBottom":
        v.offset[0] = -f - l;
        break;
      case "right":
      case "rightTop":
      case "rightBottom":
        v.offset[0] = f + l;
        break;
    }
    if (i)
      switch (h) {
        case "topLeft":
        case "bottomLeft":
          v.offset[0] = -g.arrowOffsetHorizontal - f;
          break;
        case "topRight":
        case "bottomRight":
          v.offset[0] = g.arrowOffsetHorizontal + f;
          break;
        case "leftTop":
        case "rightTop":
          v.offset[1] = -g.arrowOffsetHorizontal * 2 + f;
          break;
        case "leftBottom":
        case "rightBottom":
          v.offset[1] = g.arrowOffsetHorizontal * 2 - f;
          break;
      }
    v.overflow = s2(h, g, n, o), v.htmlRegion = "visibleFirst";
  }), p;
}
const u2 = /* @__PURE__ */ ye.createContext(!1), f2 = (e, n) => {
  const o = (i) => typeof i == "boolean" ? {
    show: i
  } : i || {};
  return ye.useMemo(() => {
    const i = o(e), l = o(n);
    return {
      ...l,
      ...i,
      show: i.show ?? l.show ?? !0
    };
  }, [e, n]);
}, $0 = "50%", d2 = (e) => {
  const {
    calc: n,
    componentCls: o,
    // ant-tooltip
    tooltipMaxWidth: i,
    tooltipColor: l,
    tooltipBg: c,
    tooltipBorderRadius: f,
    zIndexPopup: p,
    controlHeight: g,
    dropShadowPopover: h,
    paddingSM: y,
    paddingXS: v,
    arrowOffsetHorizontal: S,
    sizePopupArrow: x,
    antCls: b
  } = e, [C, E] = fl(b, "tooltip"), $ = n(f).add(x).add(S).equal(), P = {
    minWidth: n(f).mul(2).add(x).equal(),
    minHeight: g,
    padding: `${$e(e.calc(y).div(2).equal())} ${$e(v)}`,
    color: E("overlay-color", l),
    textAlign: "start",
    textDecoration: "none",
    wordWrap: "break-word",
    backgroundColor: c,
    borderRadius: f,
    boxSizing: "border-box"
  }, R = {
    // When use `autoArrow`, origin will follow the arrow position
    [C("valid-offset-x")]: E("arrow-offset-x", "var(--arrow-x)"),
    transformOrigin: [E("valid-offset-x", $0), `var(--arrow-y, ${$0})`].join(" ")
  };
  return [
    {
      [o]: {
        ...Ur(e),
        position: "absolute",
        zIndex: p,
        display: "block",
        width: "max-content",
        maxWidth: i,
        visibility: "visible",
        filter: h,
        ...R,
        "&-hidden": {
          display: "none"
        },
        [C("arrow-background-color")]: c,
        // Wrapper for the tooltip content
        [`${o}-container`]: [P, kE(e, !0)],
        [`&:has(~ ${o}-unique-container)`]: {
          [`${o}-container`]: {
            border: "none",
            background: "transparent"
          }
        },
        // Align placement should have another min width
        [["&-placement-topLeft", "&-placement-topRight", "&-placement-bottomLeft", "&-placement-bottomRight"].join(",")]: {
          minWidth: $
        },
        // Limit left and right placement radius
        [["&-placement-left", "&-placement-leftTop", "&-placement-leftBottom", "&-placement-right", "&-placement-rightTop", "&-placement-rightBottom"].join(",")]: {
          [`${o}-inner`]: {
            borderRadius: e.min(f, Uv)
          }
        },
        [`${o}-content`]: {
          position: "relative"
        },
        // generator for preset color
        ...AC(e, (M, {
          darkColor: I
        }) => ({
          [`&${o}-${M}`]: {
            [`${o}-container`]: {
              backgroundColor: I
            },
            [`${o}-arrow`]: {
              [C("arrow-background-color")]: I
            }
          }
        })),
        // RTL
        "&-rtl": {
          direction: "rtl"
        }
      }
    },
    // Arrow Style
    i2(e, E("arrow-background-color"), {
      arrowShadow: !1
    }),
    // Pure Render
    {
      [`${o}-pure`]: {
        position: "relative",
        maxWidth: "none",
        margin: e.sizePopupArrow
      }
    },
    // Unique Body
    {
      [`${o}-unique-container`]: {
        ...P,
        ...R,
        position: "absolute",
        zIndex: n(p).sub(1).equal(),
        filter: h,
        "&-hidden": {
          display: "none"
        },
        "&-visible": {
          transition: `all ${e.motionDurationSlow}`
        }
      }
    }
  ];
}, p2 = (e) => ({
  zIndexPopup: e.zIndexPopupBase + 70,
  maxWidth: 250,
  ...Xv({
    contentRadius: e.borderRadius,
    limitVerticalRadius: !0
  }),
  ...r2(rr(e, {
    borderRadiusOuter: Math.min(e.borderRadiusOuter, 4)
  }))
}), Gv = (e, n, o = !0) => Xr("Tooltip", (l) => {
  const {
    borderRadius: c,
    colorTextLightSolid: f,
    colorBgSpotlight: p,
    maxWidth: g
  } = l, h = rr(l, {
    // default variables
    tooltipMaxWidth: g,
    tooltipColor: f,
    tooltipBorderRadius: c,
    tooltipBg: p
  });
  return [d2(h), DE(l, "zoom-big-fast")];
}, p2, {
  resetStyle: !1,
  // Popover use Tooltip as internal component. We do not need to handle this.
  injectStyle: o
})(e, n), h2 = Li.map((e) => `${e}-inverse`);
function m2(e, n = !0) {
  return n ? [].concat(il(h2), il(Li)).includes(e) : Li.includes(e);
}
const Yv = (e, n, o) => {
  const i = m2(o), [l] = fl(e, "tooltip"), c = we({
    [`${n}-${o}`]: o && i
  }), f = {}, p = {}, g = UE(o).toRgb(), y = (0.299 * g.r + 0.587 * g.g + 0.114 * g.b) / 255 < 0.5 ? "#FFF" : "#000";
  return o && !i && (f.background = o, f[l("overlay-color")] = y, p[l("arrow-background-color")] = o), {
    className: c,
    overlayStyle: f,
    arrowStyle: p
  };
}, g2 = (e) => {
  const {
    prefixCls: n,
    className: o,
    placement: i = "top",
    title: l,
    color: c,
    overlayInnerStyle: f,
    classNames: p,
    styles: g
  } = e, {
    getPrefixCls: h
  } = m.useContext(On), y = h("tooltip", n), v = h(), S = Sp(y), [x, b] = Gv(y, S), C = Yv(v, y, c), E = C.arrowStyle, $ = m.useMemo(() => ({
    container: {
      ...f,
      ...C.overlayStyle
    }
  }), [f, C.overlayStyle]), k = {
    ...e,
    placement: i
  }, [P, R] = pl([p], [$, g], {
    props: k
  }), M = we(S, x, b, y, `${y}-pure`, `${y}-placement-${i}`, o, C.className);
  return /* @__PURE__ */ m.createElement("div", {
    className: M,
    style: E
  }, /* @__PURE__ */ m.createElement("div", {
    className: `${y}-arrow`
  }), /* @__PURE__ */ m.createElement(qv, {
    ...e,
    className: x,
    prefixCls: y,
    classNames: P,
    styles: R
  }, l));
}, y2 = /* @__PURE__ */ m.forwardRef((e, n) => {
  const {
    prefixCls: o,
    openClassName: i,
    getTooltipContainer: l,
    color: c,
    children: f,
    afterOpenChange: p,
    arrow: g,
    destroyTooltipOnHide: h,
    destroyOnHidden: y,
    title: v,
    overlay: S,
    trigger: x,
    builtinPlacements: b,
    autoAdjustOverflow: C = !0,
    motion: E,
    getPopupContainer: $,
    placement: k = "top",
    mouseEnterDelay: P = 0.1,
    mouseLeaveDelay: R = 0.1,
    rootClassName: M,
    styles: I,
    classNames: z,
    onOpenChange: O,
    // Legacy
    overlayInnerStyle: j,
    overlayStyle: Y,
    overlayClassName: V,
    ...X
  } = e, [, Q] = Gi(), oe = e["data-popover-inject"], {
    getPopupContainer: G,
    getPrefixCls: le,
    direction: he,
    ...D
  } = ei("tooltip"), {
    className: J,
    style: q,
    classNames: T,
    styles: A,
    arrow: ee,
    trigger: te
  } = oe ? {} : D, se = f2(g, ee), re = se.show, fe = x || te || "hover", ie = $ || G, Z = y ?? !!h, ae = m.useContext(u2), ce = m.useRef(null), Me = () => {
    ce.current?.forceAlign();
  };
  m.useImperativeHandle(n, () => ({
    forceAlign: Me,
    nativeElement: ce.current?.nativeElement,
    popupElement: ce.current?.popupElement
  }));
  const [Ue, Qe] = rl(e.defaultOpen ?? !1, e.open), ke = !v && !S && v !== 0, Xe = (nt) => {
    Qe(ke ? !1 : nt), !ke && O && O(nt);
  }, ut = m.useMemo(() => b || c2({
    arrowPointAtCenter: se?.pointAtCenter ?? !1,
    autoAdjustOverflow: C,
    arrowWidth: re ? Q.sizePopupArrow : 0,
    borderRadius: Q.borderRadius,
    offset: Q.marginXXS
  }), [se, b, Q, re, C]), Oe = m.useMemo(() => v === 0 ? v : S || v || "", [S, v]), xt = /* @__PURE__ */ m.createElement(Vv, {
    space: !0,
    form: !0
  }, Yi(Oe) ? Oe() : Oe), Ze = {
    ...e,
    trigger: fe,
    builtinPlacements: ut,
    getPopupContainer: ie,
    destroyOnHidden: Z
  }, [tt, je] = pl([T, z], [A, I], {
    props: Ze
  }), Je = le("tooltip", o), ft = le();
  let dn = Ue;
  (!("open" in e) && ke || ae) && (dn = !1);
  const Rt = /* @__PURE__ */ m.isValidElement(f) && !oE(f) ? f : /* @__PURE__ */ m.createElement("span", null, f), qt = Rt.props, Ut = !qt.className || typeof qt.className == "string" ? we(qt.className, i || `${Je}-open`) : qt.className, kt = Sp(Je), [mt, Mt] = Gv(Je, kt, !oe), qe = Yv(ft, Je, c), Kt = qe.arrowStyle, Ve = we(kt, mt, Mt), Ae = we(V, {
    [`${Je}-rtl`]: he === "rtl"
  }, qe.className, M, Ve, J, tt.root), [ze, Ge] = wE("Tooltip", X.zIndex), gt = {
    ...je.container,
    ...j,
    ...qe.overlayStyle
  }, Xt = /* @__PURE__ */ m.createElement(n2, {
    unique: !0,
    ...X,
    zIndex: ze,
    showArrow: re,
    placement: k,
    mouseEnterDelay: P,
    mouseLeaveDelay: R,
    prefixCls: Je,
    classNames: {
      root: Ae,
      container: tt.container,
      arrow: tt.arrow,
      uniqueContainer: we(Ve, tt.container)
    },
    styles: {
      root: {
        ...Kt,
        ...je.root,
        ...q,
        ...Y
      },
      container: gt,
      uniqueContainer: gt,
      arrow: je.arrow
    },
    ref: ce,
    overlay: xt,
    visible: dn,
    onVisibleChange: Xe,
    afterVisibleChange: p,
    arrowContent: /* @__PURE__ */ m.createElement("span", {
      className: `${Je}-arrow-content`
    }),
    motion: {
      motionName: xE(ft, "zoom-big-fast", typeof E?.motionName == "string" ? E?.motionName : void 0),
      motionDeadline: 1e3
    },
    trigger: fe,
    builtinPlacements: ut,
    getTooltipContainer: ie,
    destroyOnHidden: Z
  }, dn ? Tv(Rt, {
    className: Ut
  }) : Rt);
  return /* @__PURE__ */ m.createElement(Fv.Provider, {
    value: Ge
  }, Xt);
}), Vi = y2;
Vi._InternalPanelDoNotUseOrYouWillBeFired = g2;
Vi.UniqueProvider = Nv;
function Cp(e) {
  return rr(e, {
    inputAffixPadding: e.paddingXXS
  });
}
const bp = (e) => {
  const {
    controlHeight: n,
    fontSize: o,
    lineHeight: i,
    lineWidth: l,
    controlHeightSM: c,
    controlHeightLG: f,
    fontSizeLG: p,
    lineHeightLG: g,
    paddingSM: h,
    controlPaddingHorizontalSM: y,
    controlPaddingHorizontal: v,
    colorFillAlter: S,
    colorPrimaryHover: x,
    colorPrimary: b,
    controlOutlineWidth: C,
    controlOutline: E,
    colorErrorOutline: $,
    colorWarningOutline: k,
    colorBgContainer: P,
    inputFontSize: R,
    inputFontSizeLG: M,
    inputFontSizeSM: I
  } = e, z = R || o, O = I || z, j = M || p, Y = Math.round((n - z * i) / 2 * 10) / 10 - l, V = Math.round((c - O * i) / 2 * 10) / 10 - l, X = Math.ceil((f - j * g) / 2 * 10) / 10 - l;
  return {
    paddingBlock: Math.max(Y, 0),
    paddingBlockSM: Math.max(V, 0),
    paddingBlockLG: Math.max(X, 0),
    paddingInline: h - l,
    paddingInlineSM: y - l,
    paddingInlineLG: v - l,
    addonBg: S,
    activeBorderColor: b,
    hoverBorderColor: x,
    activeShadow: `0 0 0 ${C}px ${E}`,
    errorActiveShadow: `0 0 0 ${C}px ${$}`,
    warningActiveShadow: `0 0 0 ${C}px ${k}`,
    hoverBg: P,
    activeBg: P,
    inputFontSize: z,
    inputFontSizeLG: j,
    inputFontSizeSM: O
  };
}, v2 = (e) => ({
  borderColor: e.hoverBorderColor,
  backgroundColor: e.hoverBg
}), Ep = (e) => ({
  color: e.colorTextDisabled,
  backgroundColor: e.colorBgContainerDisabled,
  borderColor: e.colorBorderDisabled,
  boxShadow: "none",
  cursor: "not-allowed",
  opacity: 1,
  "input[disabled], textarea[disabled]": {
    cursor: "not-allowed"
  },
  "&:hover:not([disabled])": {
    ...v2(rr(e, {
      hoverBorderColor: e.colorBorderDisabled,
      hoverBg: e.colorBgContainerDisabled
    }))
  }
}), Kv = (e, n) => ({
  background: e.colorBgContainer,
  borderWidth: e.lineWidth,
  borderStyle: e.lineType,
  borderColor: n.borderColor,
  "&:hover": {
    borderColor: n.hoverBorderColor,
    backgroundColor: e.hoverBg
  },
  "&:focus, &:focus-within": {
    borderColor: n.activeBorderColor,
    boxShadow: n.activeShadow,
    outline: 0,
    backgroundColor: e.activeBg
  }
}), _0 = (e, n) => ({
  [`&${e.componentCls}-status-${n.status}:not(${e.componentCls}-disabled)`]: {
    ...Kv(e, n),
    [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
      color: n.affixColor
    }
  },
  [`&${e.componentCls}-status-${n.status}${e.componentCls}-disabled`]: {
    borderColor: n.borderColor
  }
}), Qv = (e, n) => ({
  "&-outlined": {
    ...Kv(e, {
      borderColor: e.colorBorder,
      hoverBorderColor: e.hoverBorderColor,
      activeBorderColor: e.activeBorderColor,
      activeShadow: e.activeShadow
    }),
    [`&${e.componentCls}-disabled, &[disabled]`]: {
      ...Ep(e)
    },
    ..._0(e, {
      status: "error",
      borderColor: e.colorError,
      hoverBorderColor: e.colorErrorBorderHover,
      activeBorderColor: e.colorError,
      activeShadow: e.errorActiveShadow,
      affixColor: e.colorErrorAffix
    }),
    ..._0(e, {
      status: "warning",
      borderColor: e.colorWarning,
      hoverBorderColor: e.colorWarningBorderHover,
      activeBorderColor: e.colorWarning,
      activeShadow: e.warningActiveShadow,
      affixColor: e.colorWarningAffix
    }),
    ...n
  }
}), P0 = (e, n) => ({
  [`&${e.componentCls}-group-wrapper-status-${n.status}`]: {
    [`${e.componentCls}-group-addon`]: {
      borderColor: n.addonBorderColor,
      color: n.addonColor
    }
  }
}), S2 = (e) => ({
  "&-outlined": {
    [`${e.componentCls}-group`]: {
      "&-addon": {
        background: e.addonBg,
        border: `${$e(e.lineWidth)} ${e.lineType} ${e.colorBorder}`
      },
      "&-addon:first-child": {
        borderInlineEnd: 0
      },
      "&-addon:last-child": {
        borderInlineStart: 0
      }
    },
    ...P0(e, {
      status: "error",
      addonBorderColor: e.colorError,
      addonColor: e.colorErrorText
    }),
    ...P0(e, {
      status: "warning",
      addonBorderColor: e.colorWarning,
      addonColor: e.colorWarningText
    }),
    [`&${e.componentCls}-group-wrapper-disabled`]: {
      [`${e.componentCls}-group-addon`]: {
        ...Ep(e)
      }
    }
  }
}), Zv = "&:focus-visible, &:has(input:focus-visible), &:has(textarea:focus-visible)", Jv = (e, n) => ({
  outline: `${$e(e.lineWidth)} ${e.lineType} ${n}`,
  outlineOffset: $e(e.calc(e.lineWidth).mul(-1).equal()),
  transition: ["outline-offset", "outline"].map((o) => `${o} 0s`).join(", ")
}), R0 = (e, n) => ({
  "&, & input, & textarea": {
    color: n.color
  },
  [Zv]: Jv(e, n.color),
  [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
    color: n.affixColor
  }
}), e1 = (e, n) => {
  const {
    componentCls: o
  } = e;
  return {
    "&-borderless": {
      background: "transparent",
      border: "none",
      // Compensate for the removed border to maintain consistent height with other components
      // (e.g. Select borderless) that keep a transparent border.
      paddingBlock: e.calc(e.paddingBlock).add(e.lineWidth).equal(),
      [`&${o}-sm, &${o}-affix-wrapper-sm`]: {
        paddingBlock: e.calc(e.paddingBlockSM).add(e.lineWidth).equal()
      },
      [`&${o}-lg, &${o}-affix-wrapper-lg`]: {
        paddingBlock: e.calc(e.paddingBlockLG).add(e.lineWidth).equal()
      },
      "&:focus, &:focus-within": {
        outline: "none"
      },
      [Zv]: Jv(e, e.activeBorderColor),
      // >>>>> Disabled
      [`&${o}-disabled, &[disabled]`]: {
        color: e.colorTextDisabled,
        cursor: "not-allowed"
      },
      // >>>>> Status
      [`&${o}-status-error`]: R0(e, {
        color: e.colorError,
        affixColor: e.colorErrorAffix
      }),
      [`&${o}-status-warning`]: R0(e, {
        color: e.colorWarning,
        affixColor: e.colorWarningAffix
      }),
      ...n
    }
  };
}, t1 = (e, n) => ({
  background: n.bg,
  borderWidth: e.lineWidth,
  borderStyle: e.lineType,
  borderColor: "transparent",
  "input&, & input, textarea&, & textarea": {
    color: n?.inputColor ?? "unset"
  },
  "&:hover": {
    background: n.hoverBg
  },
  "&:focus, &:focus-within": {
    outline: 0,
    borderColor: n.activeBorderColor,
    backgroundColor: e.activeBg
  }
}), k0 = (e, n) => ({
  [`&${e.componentCls}-status-${n.status}:not(${e.componentCls}-disabled)`]: {
    ...t1(e, n),
    [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
      color: n.affixColor
    }
  }
}), n1 = (e, n) => ({
  "&-filled": {
    ...t1(e, {
      bg: e.colorFillTertiary,
      hoverBg: e.colorFillSecondary,
      activeBorderColor: e.activeBorderColor,
      inputColor: e.colorText
    }),
    [`&${e.componentCls}-disabled, &[disabled]`]: {
      ...Ep(e)
    },
    ...k0(e, {
      status: "error",
      bg: e.colorErrorBg,
      hoverBg: e.colorErrorBgHover,
      activeBorderColor: e.colorError,
      inputColor: e.colorErrorText,
      affixColor: e.colorErrorAffix
    }),
    ...k0(e, {
      status: "warning",
      bg: e.colorWarningBg,
      hoverBg: e.colorWarningBgHover,
      activeBorderColor: e.colorWarning,
      inputColor: e.colorWarningText,
      affixColor: e.colorWarningAffix
    }),
    ...n
  }
}), M0 = (e, n) => ({
  [`&${e.componentCls}-group-wrapper-status-${n.status}`]: {
    [`${e.componentCls}-group-addon`]: {
      background: n.addonBg,
      color: n.addonColor
    }
  }
}), w2 = (e) => ({
  "&-filled": {
    [`${e.componentCls}-group-addon`]: {
      background: e.colorFillTertiary,
      "&:last-child": {
        position: "static"
      }
    },
    ...M0(e, {
      status: "error",
      addonBg: e.colorErrorBg,
      addonColor: e.colorErrorText
    }),
    ...M0(e, {
      status: "warning",
      addonBg: e.colorWarningBg,
      addonColor: e.colorWarningText
    }),
    [`&${e.componentCls}-group-wrapper-disabled`]: {
      [`${e.componentCls}-group`]: {
        "&-addon": {
          background: e.colorFillTertiary,
          color: e.colorTextDisabled
        },
        "&-addon:first-child": {
          borderInlineStart: `${$e(e.lineWidth)} ${e.lineType} ${e.colorBorder}`,
          borderTop: `${$e(e.lineWidth)} ${e.lineType} ${e.colorBorder}`,
          borderBottom: `${$e(e.lineWidth)} ${e.lineType} ${e.colorBorder}`
        },
        "&-addon:last-child": {
          borderInlineEnd: `${$e(e.lineWidth)} ${e.lineType} ${e.colorBorder}`,
          borderTop: `${$e(e.lineWidth)} ${e.lineType} ${e.colorBorder}`,
          borderBottom: `${$e(e.lineWidth)} ${e.lineType} ${e.colorBorder}`
        }
      }
    }
  }
}), r1 = (e, n) => ({
  background: e.colorBgContainer,
  borderWidth: `${$e(e.lineWidth)} 0`,
  borderStyle: `${e.lineType} none`,
  borderColor: `transparent transparent ${n.borderColor} transparent`,
  borderRadius: 0,
  "&:hover": {
    borderColor: `transparent transparent ${n.hoverBorderColor} transparent`,
    backgroundColor: e.hoverBg
  },
  "&:focus, &:focus-within": {
    borderColor: `transparent transparent ${n.activeBorderColor} transparent`,
    outline: 0,
    backgroundColor: e.activeBg
  }
}), T0 = (e, n) => ({
  [`&${e.componentCls}-status-${n.status}:not(${e.componentCls}-disabled)`]: {
    ...r1(e, n),
    [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
      color: n.affixColor
    }
  },
  [`&${e.componentCls}-status-${n.status}${e.componentCls}-disabled`]: {
    borderColor: `transparent transparent ${n.borderColor} transparent`
  }
}), o1 = (e, n) => ({
  "&-underlined": {
    ...r1(e, {
      borderColor: e.colorBorder,
      hoverBorderColor: e.hoverBorderColor,
      activeBorderColor: e.activeBorderColor,
      activeShadow: e.activeShadow
    }),
    // >>>>> Disabled
    [`&${e.componentCls}-disabled, &[disabled]`]: {
      color: e.colorTextDisabled,
      boxShadow: "none",
      cursor: "not-allowed",
      "&:hover": {
        borderColor: `transparent transparent ${e.colorBorder} transparent`
      }
    },
    "input[disabled], textarea[disabled]": {
      cursor: "not-allowed"
    },
    ...T0(e, {
      status: "error",
      borderColor: e.colorError,
      hoverBorderColor: e.colorErrorBorderHover,
      activeBorderColor: e.colorError,
      activeShadow: e.errorActiveShadow,
      affixColor: e.colorErrorAffix
    }),
    ...T0(e, {
      status: "warning",
      borderColor: e.colorWarning,
      hoverBorderColor: e.colorWarningBorderHover,
      activeBorderColor: e.colorWarning,
      activeShadow: e.warningActiveShadow,
      affixColor: e.colorWarningAffix
    }),
    ...n
  }
}), i1 = (e) => ({
  // Firefox
  "&::-moz-placeholder": {
    opacity: 1
  },
  "&::placeholder": {
    color: e,
    userSelect: "none"
    // https://github.com/ant-design/ant-design/pull/32639
  },
  "&:placeholder-shown": {
    textOverflow: "ellipsis"
  }
}), s1 = (e) => {
  const {
    paddingBlockLG: n,
    lineHeightLG: o,
    borderRadiusLG: i,
    paddingInlineLG: l
  } = e;
  return {
    padding: `${$e(n)} ${$e(l)}`,
    fontSize: e.inputFontSizeLG,
    lineHeight: o,
    borderRadius: i
  };
}, l1 = (e) => ({
  padding: `${$e(e.paddingBlockSM)} ${$e(e.paddingInlineSM)}`,
  fontSize: e.inputFontSizeSM,
  borderRadius: e.borderRadiusSM
}), $p = (e, n = {}) => ({
  position: "relative",
  display: "inline-block",
  width: "100%",
  minWidth: 0,
  padding: `${$e(e.paddingBlock)} ${$e(e.paddingInline)}`,
  color: e.colorText,
  fontSize: e.inputFontSize,
  lineHeight: e.lineHeight,
  borderRadius: e.borderRadius,
  transition: `all ${e.motionDurationMid}`,
  ...i1(e.colorTextPlaceholder),
  // Size
  "&-lg": {
    ...s1(e),
    ...n.largeStyle
  },
  "&-sm": {
    ...l1(e),
    ...n.smallStyle
  },
  // RTL
  "&-rtl, &-textarea-rtl": {
    direction: "rtl"
  }
}), x2 = (e) => {
  const {
    componentCls: n,
    antCls: o
  } = e;
  return {
    position: "relative",
    display: "table",
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    // Undo padding and float of grid classes
    "&[class*='col-']": {
      paddingInlineEnd: e.paddingXS,
      "&:last-child": {
        paddingInlineEnd: 0
      }
    },
    // Sizing options
    [`&-lg ${n}, &-lg > ${n}-group-addon`]: {
      ...s1(e)
    },
    [`&-sm ${n}, &-sm > ${n}-group-addon`]: {
      ...l1(e)
    },
    // Fix https://github.com/ant-design/ant-design/issues/5754
    [`&-lg ${o}-select-single`]: {
      height: e.controlHeightLG
    },
    [`&-sm ${o}-select-single`]: {
      height: e.controlHeightSM
    },
    [`> ${n}`]: {
      display: "table-cell",
      "&:not(:first-child):not(:last-child)": {
        borderRadius: 0
      }
    },
    [`${n}-group`]: {
      "&-addon, &-wrap": {
        display: "table-cell",
        width: 1,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        "&:not(:first-child):not(:last-child)": {
          borderRadius: 0
        }
      },
      "&-wrap > *": {
        display: "block !important"
      },
      "&-addon": {
        position: "relative",
        padding: `0 ${$e(e.paddingInline)}`,
        color: e.colorText,
        fontWeight: "normal",
        fontSize: e.inputFontSize,
        textAlign: "center",
        borderRadius: e.borderRadius,
        transition: `all ${e.motionDurationSlow}`,
        lineHeight: 1,
        // Reset Select's style in addon
        [`${o}-select`]: {
          margin: `${$e(e.calc(e.paddingBlock).add(1).mul(-1).equal())} ${$e(e.calc(e.paddingInline).mul(-1).equal())}`,
          [`&${o}-select-single:not(${o}-select-customize-input):not(${o}-pagination-size-changer)`]: {
            backgroundColor: "inherit",
            border: `${$e(e.lineWidth)} ${e.lineType} transparent`,
            boxShadow: "none"
          }
        },
        // https://github.com/ant-design/ant-design/issues/31333
        [`${o}-cascader-picker`]: {
          margin: `-9px ${$e(e.calc(e.paddingInline).mul(-1).equal())}`,
          backgroundColor: "transparent",
          [`${o}-cascader-input`]: {
            textAlign: "start",
            border: 0,
            boxShadow: "none"
          }
        }
      }
    },
    [n]: {
      width: "100%",
      marginBottom: 0,
      textAlign: "inherit",
      "&:focus": {
        zIndex: 1,
        // Fix https://gw.alipayobjects.com/zos/rmsportal/DHNpoqfMXSfrSnlZvhsJ.png
        borderInlineEndWidth: 1
      },
      "&:hover": {
        zIndex: 1,
        borderInlineEndWidth: 1
      }
    },
    // Reset rounded corners
    [`> ${n}:first-child, ${n}-group-addon:first-child`]: {
      borderStartEndRadius: 0,
      borderEndEndRadius: 0,
      // Reset Select's style in addon
      [`${o}-select`]: {
        borderStartEndRadius: 0,
        borderEndEndRadius: 0
      }
    },
    [`> ${n}-affix-wrapper`]: {
      [`&:not(:first-child) ${n}`]: {
        borderStartStartRadius: 0,
        borderEndStartRadius: 0
      },
      [`&:not(:last-child) ${n}`]: {
        borderStartEndRadius: 0,
        borderEndEndRadius: 0
      }
    },
    [`> ${n}:last-child, ${n}-group-addon:last-child`]: {
      borderStartStartRadius: 0,
      borderEndStartRadius: 0,
      // Reset Select's style in addon
      [`${o}-select`]: {
        borderStartStartRadius: 0,
        borderEndStartRadius: 0
      }
    },
    [`${n}-affix-wrapper`]: {
      "&:not(:last-child)": {
        borderStartEndRadius: 0,
        borderEndEndRadius: 0
      },
      "&:not(:first-child)": {
        borderStartStartRadius: 0,
        borderEndStartRadius: 0
      }
    },
    [`&${n}-group-compact`]: {
      display: "block",
      ...FC(),
      [`${n}-group-addon, ${n}-group-wrap, > ${n}`]: {
        "&:not(:first-child):not(:last-child)": {
          borderInlineEndWidth: e.lineWidth,
          "&:hover, &:focus": {
            zIndex: 1
          }
        }
      },
      "& > *": {
        display: "inline-flex",
        float: "none",
        verticalAlign: "top",
        // https://github.com/ant-design/ant-design-pro/issues/139
        borderRadius: 0
      },
      [`
        & > ${n}-affix-wrapper,
        & > ${n}-number-affix-wrapper,
        & > ${o}-picker-range
      `]: {
        display: "inline-flex"
      },
      "& > *:not(:last-child)": {
        marginInlineEnd: e.calc(e.lineWidth).mul(-1).equal(),
        borderInlineEndWidth: e.lineWidth
      },
      // Undo float for .ant-input-group .ant-input
      [n]: {
        float: "none"
      },
      // reset border for Select, DatePicker, AutoComplete, Cascader, Mention, TimePicker, Input
      [`& > ${o}-select,
      & > ${o}-select-auto-complete ${n},
      & > ${o}-cascader-picker ${n},
      & > ${n}-group-wrapper ${n}`]: {
        borderInlineEndWidth: e.lineWidth,
        borderRadius: 0,
        "&:hover, &:focus": {
          zIndex: 1
        }
      },
      [`& > ${o}-select-focused`]: {
        zIndex: 1
      },
      // update z-index for arrow icon
      [`& > ${o}-select > ${o}-select-arrow`]: {
        zIndex: 1
        // https://github.com/ant-design/ant-design/issues/20371
      },
      [`& > *:first-child,
      & > ${o}-select:first-child,
      & > ${o}-select-auto-complete:first-child ${n},
      & > ${o}-cascader-picker:first-child ${n}`]: {
        borderStartStartRadius: e.borderRadius,
        borderEndStartRadius: e.borderRadius
      },
      [`& > *:last-child,
      & > ${o}-select:last-child,
      & > ${o}-cascader-picker:last-child ${n},
      & > ${o}-cascader-picker-focused:last-child ${n}`]: {
        borderInlineEndWidth: e.lineWidth,
        borderStartEndRadius: e.borderRadius,
        borderEndEndRadius: e.borderRadius
      },
      // https://github.com/ant-design/ant-design/issues/12493
      [`& > ${o}-select-auto-complete ${n}`]: {
        verticalAlign: "top"
      },
      [`${n}-group-wrapper + ${n}-group-wrapper`]: {
        marginInlineStart: e.calc(e.lineWidth).mul(-1).equal(),
        [`${n}-affix-wrapper`]: {
          // borderRadius: 0,
        }
      }
    }
  };
}, C2 = (e) => {
  const {
    componentCls: n,
    controlHeightSM: o,
    lineWidth: i,
    calc: l
  } = e, f = l(o).sub(l(i).mul(2)).sub(16).div(2).equal();
  return {
    [n]: {
      ...Ur(e),
      ...$p(e),
      // Variants
      ...Qv(e),
      ...n1(e),
      ...e1(e),
      ...o1(e),
      '&[type="color"]': {
        height: e.controlHeight,
        [`&${n}-lg`]: {
          height: e.controlHeightLG
        },
        [`&${n}-sm`]: {
          height: o,
          paddingTop: f,
          paddingBottom: f
        }
      },
      '&[type="search"]::-webkit-search-cancel-button, &[type="search"]::-webkit-search-decoration': {
        appearance: "none"
      }
    }
  };
}, b2 = (e) => {
  const {
    componentCls: n
  } = e;
  return {
    // ========================= Input =========================
    [`${n}-clear-icon`]: {
      margin: 0,
      padding: 0,
      lineHeight: 0,
      color: e.colorTextQuaternary,
      fontSize: e.fontSizeIcon,
      verticalAlign: -1,
      // https://github.com/ant-design/ant-design/pull/18151
      // https://codesandbox.io/s/wizardly-sun-u10br
      cursor: "pointer",
      transition: `color ${e.motionDurationSlow}`,
      border: "none",
      outline: "none",
      backgroundColor: "transparent",
      "&:hover": {
        color: e.colorIcon
      },
      "&:focus-visible": {
        color: e.colorIcon,
        borderRadius: e.borderRadiusSM,
        ...hp(e)
      },
      "&:active": {
        color: e.colorText
      },
      "&-hidden": {
        visibility: "hidden"
      },
      "&-has-suffix": {
        margin: `0 ${$e(e.inputAffixPadding)}`
      }
    }
  };
}, E2 = (e) => {
  const {
    componentCls: n,
    inputAffixPadding: o,
    colorTextDescription: i,
    motionDurationSlow: l,
    colorIcon: c,
    colorIconHover: f
  } = e, p = `${n}-affix-wrapper`, g = `${n}-affix-wrapper-disabled`;
  return {
    [p]: {
      ...$p(e),
      display: "inline-flex",
      "&-focused, &:focus": {
        zIndex: 1
      },
      [`> input${n}`]: {
        padding: 0
      },
      [`> input${n}, > textarea${n}`]: {
        fontSize: "inherit",
        border: "none",
        borderRadius: 0,
        outline: "none",
        background: "transparent",
        color: "inherit",
        "&::-ms-reveal": {
          display: "none"
        },
        "&:focus": {
          boxShadow: "none !important"
        }
      },
      "&::before": {
        display: "inline-block",
        width: 0,
        visibility: "hidden",
        content: '"\\a0"'
      },
      [n]: {
        "&-prefix, &-suffix": {
          display: "flex",
          flex: "none",
          alignItems: "center",
          "> *:not(:last-child)": {
            marginInlineEnd: e.paddingXS
          }
        },
        "&-show-count-suffix": {
          color: i,
          direction: "ltr"
        },
        "&-show-count-has-suffix": {
          marginInlineEnd: e.paddingXXS
        },
        "&-prefix": {
          marginInlineEnd: o
        },
        "&-suffix": {
          marginInlineStart: o
        },
        // password
        "&-password-icon": {
          display: "inline-flex",
          color: c,
          cursor: "pointer",
          transition: `all ${l}`,
          "&:hover": {
            color: f
          }
        }
      },
      ...b2(e)
    },
    // 覆盖 affix-wrapper borderRadius！
    [`${n}-underlined`]: {
      borderRadius: 0
    },
    [g]: {
      // password disabled
      [`${n}-password-icon`]: {
        color: c,
        cursor: "not-allowed",
        "&:hover": {
          color: c
        }
      }
    }
  };
}, $2 = (e) => {
  const {
    componentCls: n,
    borderRadiusLG: o,
    borderRadiusSM: i
  } = e;
  return {
    [`${n}-group`]: {
      // Style for input-group: input with label, with button or dropdown...
      ...Ur(e),
      ...x2(e),
      "&-rtl": {
        direction: "rtl"
      },
      "&-wrapper": {
        display: "inline-block",
        width: "100%",
        textAlign: "start",
        verticalAlign: "top",
        // https://github.com/ant-design/ant-design/issues/6403
        "&-rtl": {
          direction: "rtl"
        },
        // Size
        "&-lg": {
          [`${n}-group-addon`]: {
            borderRadius: o,
            fontSize: e.inputFontSizeLG
          }
        },
        "&-sm": {
          [`${n}-group-addon`]: {
            borderRadius: i
          }
        },
        // Variants
        ...S2(e),
        ...w2(e),
        // '&-disabled': {
        //   [`${componentCls}-group-addon`]: {
        //     ...genDisabledStyle(token),
        //   },
        // },
        // Fix the issue of using icons in Space Compact mode
        // https://github.com/ant-design/ant-design/issues/42122
        [`&:not(${n}-compact-first-item):not(${n}-compact-last-item)${n}-compact-item`]: {
          [`${n}, ${n}-group-addon`]: {
            borderRadius: 0
          }
        },
        [`&:not(${n}-compact-last-item)${n}-compact-first-item`]: {
          [`${n}, ${n}-group-addon`]: {
            borderStartEndRadius: 0,
            borderEndEndRadius: 0
          }
        },
        [`&:not(${n}-compact-first-item)${n}-compact-last-item`]: {
          [`${n}, ${n}-group-addon`]: {
            borderStartStartRadius: 0,
            borderEndStartRadius: 0
          }
        },
        // Fix the issue of input use show-count param in space compact mode
        // https://github.com/ant-design/ant-design/issues/46872
        [`&:not(${n}-compact-last-item)${n}-compact-item`]: {
          [`${n}-affix-wrapper`]: {
            borderStartEndRadius: 0,
            borderEndEndRadius: 0
          }
        },
        // Fix the issue of input use `addonAfter` param in space compact mode
        // https://github.com/ant-design/ant-design/issues/52483
        [`&:not(${n}-compact-first-item)${n}-compact-item`]: {
          [`${n}-affix-wrapper`]: {
            borderStartStartRadius: 0,
            borderEndStartRadius: 0
          }
        }
      }
    }
  };
}, _2 = (e) => {
  const {
    componentCls: n
  } = e;
  return {
    [`${n}-out-of-range`]: {
      [`&, & input, & textarea, ${n}-show-count-suffix, ${n}-data-count`]: {
        color: e.colorError
      }
    }
  };
};
Xr(["Input", "Shared"], (e) => {
  const n = rr(e, Cp(e));
  return [C2(n), E2(n)];
}, bp, {
  resetFont: !1
});
Xr(["Input", "Component"], (e) => {
  const n = rr(e, Cp(e));
  return [
    $2(n),
    _2(n),
    // =====================================================
    // ==             Space Compact                       ==
    // =====================================================
    xp(n, {
      focus: !0,
      focusElCls: `${n.componentCls}-affix-wrapper-focused`
    })
  ];
}, bp, {
  resetFont: !1
});
var Fa = {}, N0;
function P2() {
  if (N0) return Fa;
  N0 = 1, Object.defineProperty(Fa, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M482 152h60q8 0 8 8v704q0 8-8 8h-60q-8 0-8-8V160q0-8 8-8z" } }, { tag: "path", attrs: { d: "M192 474h672q8 0 8 8v60q0 8-8 8H160q-8 0-8-8v-60q0-8 8-8z" } }] }, name: "plus", theme: "outlined" };
  return Fa.default = e, Fa;
}
var R2 = /* @__PURE__ */ P2();
const k2 = /* @__PURE__ */ nr(R2);
function Rd() {
  return Rd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Rd.apply(this, arguments);
}
const M2 = (e, n) => /* @__PURE__ */ m.createElement(kr, Rd({}, e, {
  ref: n,
  icon: k2
})), T2 = /* @__PURE__ */ m.forwardRef(M2), I0 = (e, n) => {
  if (!e) return null;
  const o = {
    left: e.offsetLeft,
    right: e.parentElement.clientWidth - e.clientWidth - e.offsetLeft,
    width: e.clientWidth,
    top: e.offsetTop,
    bottom: e.parentElement.clientHeight - e.clientHeight - e.offsetTop,
    height: e.clientHeight
  };
  return n ? {
    left: 0,
    right: 0,
    width: 0,
    top: o.top,
    bottom: o.bottom,
    height: o.height
  } : {
    left: o.left,
    right: o.right,
    width: o.width,
    top: 0,
    bottom: 0,
    height: 0
  };
}, _r = (e) => e !== void 0 ? `${e}px` : void 0;
function N2(e) {
  const {
    prefixCls: n,
    containerRef: o,
    value: i,
    getValueIndex: l,
    motionName: c,
    onMotionStart: f,
    onMotionEnd: p,
    direction: g,
    vertical: h = !1
  } = e, y = m.useRef(null), [v, S] = m.useState(i), x = (z) => {
    const O = l(z), j = o.current?.querySelectorAll(`.${n}-item`)[O];
    return j?.offsetParent && j;
  }, [b, C] = m.useState(null), [E, $] = m.useState(null);
  fn(() => {
    if (v !== i) {
      const z = x(v), O = x(i), j = I0(z, h), Y = I0(O, h);
      S(i), C(j), $(Y), z && O ? f() : p();
    }
  }, [i]);
  const k = m.useMemo(() => _r(h ? b?.top ?? 0 : g === "rtl" ? -b?.right : b?.left), [h, g, b]), P = m.useMemo(() => _r(h ? E?.top ?? 0 : g === "rtl" ? -E?.right : E?.left), [h, g, E]), R = () => h ? {
    transform: "translateY(var(--thumb-start-top))",
    height: "var(--thumb-start-height)"
  } : {
    transform: "translateX(var(--thumb-start-left))",
    width: "var(--thumb-start-width)"
  }, M = () => h ? {
    transform: "translateY(var(--thumb-active-top))",
    height: "var(--thumb-active-height)"
  } : {
    transform: "translateX(var(--thumb-active-left))",
    width: "var(--thumb-active-width)"
  }, I = () => {
    C(null), $(null), p();
  };
  return !b || !E ? null : /* @__PURE__ */ m.createElement(dl, {
    visible: !0,
    motionName: c,
    motionAppear: !0,
    onAppearStart: R,
    onAppearActive: M,
    onVisibleChanged: I
  }, ({
    className: z,
    style: O
  }, j) => {
    const Y = {
      ...O,
      "--thumb-start-left": k,
      "--thumb-start-width": _r(b?.width),
      "--thumb-active-left": P,
      "--thumb-active-width": _r(E?.width),
      "--thumb-start-top": k,
      "--thumb-start-height": _r(b?.height),
      "--thumb-active-top": P,
      "--thumb-active-height": _r(E?.height)
    }, V = {
      ref: ul(y, j),
      style: Y,
      className: we(`${n}-thumb`, z)
    };
    return /* @__PURE__ */ m.createElement("div", V);
  });
}
function I2(e) {
  if (typeof e.title < "u")
    return e.title;
  if (typeof e.label != "object")
    return e.label?.toString();
}
function F2(e) {
  return e.map((n) => {
    if (typeof n == "object" && n !== null) {
      const o = I2(n);
      return {
        ...n,
        title: o
      };
    }
    return {
      label: n?.toString(),
      title: n?.toString(),
      value: n
    };
  });
}
const z2 = ({
  prefixCls: e,
  className: n,
  style: o,
  styles: i,
  classNames: l,
  data: c,
  disabled: f,
  checked: p,
  label: g,
  title: h,
  value: y,
  name: v,
  onChange: S,
  onFocus: x,
  onBlur: b,
  onKeyDown: C,
  onKeyUp: E,
  onMouseDown: $,
  itemRender: k = (P) => P
}) => {
  const P = (M) => {
    f || S(M, y);
  }, R = /* @__PURE__ */ m.createElement("label", {
    className: we(n, {
      [`${e}-item-disabled`]: f
    }),
    style: o,
    onMouseDown: $
  }, /* @__PURE__ */ m.createElement("input", {
    name: v,
    className: `${e}-item-input`,
    type: "radio",
    disabled: f,
    checked: p,
    onChange: P,
    onFocus: x,
    onBlur: b,
    onKeyDown: C,
    onKeyUp: E
  }), /* @__PURE__ */ m.createElement("div", {
    className: we(`${e}-item-label`, l?.label),
    title: h,
    style: i?.label
  }, g));
  return k(R, {
    item: c
  });
}, O2 = /* @__PURE__ */ m.forwardRef((e, n) => {
  const {
    prefixCls: o = "rc-segmented",
    direction: i,
    vertical: l,
    options: c = [],
    disabled: f,
    defaultValue: p,
    value: g,
    name: h,
    onChange: y,
    className: v = "",
    style: S,
    styles: x,
    classNames: b,
    motionName: C = "thumb-motion",
    itemRender: E,
    ...$
  } = e, k = m.useRef(null), P = m.useMemo(() => ul(k, n), [k, n]), R = m.useMemo(() => F2(c), [c]), [M, I] = rl(p ?? R[0]?.value, g), [z, O] = m.useState(!1), j = (A, ee) => {
    I(ee), y?.(ee);
  }, Y = Ya($, ["children"]), [V, X] = m.useState(!1), [Q, oe] = m.useState(!1), G = () => {
    oe(!0);
  }, le = () => {
    oe(!1);
  }, he = () => {
    X(!1);
  }, D = (A) => {
    A.key === "Tab" && X(!0);
  }, J = (A) => {
    const ee = R.findIndex((fe) => fe.value === M), te = R.length, se = (ee + A + te) % te, re = R[se];
    re && (I(re.value), y?.(re.value));
  }, q = (A) => {
    switch (A.key) {
      case "ArrowLeft":
      case "ArrowUp":
        J(-1);
        break;
      case "ArrowRight":
      case "ArrowDown":
        J(1);
        break;
    }
  }, T = (A) => {
    const {
      value: ee,
      disabled: te
    } = A;
    return /* @__PURE__ */ m.createElement(z2, ec({}, A, {
      name: h,
      data: A,
      itemRender: E,
      key: ee,
      prefixCls: o,
      className: we(A.className, `${o}-item`, b?.item, {
        [`${o}-item-selected`]: ee === M && !z,
        [`${o}-item-focused`]: Q && V && ee === M
      }),
      style: x?.item,
      classNames: b,
      styles: x,
      checked: ee === M,
      onChange: j,
      onFocus: G,
      onBlur: le,
      onKeyDown: q,
      onKeyUp: D,
      onMouseDown: he,
      disabled: !!f || !!te
    }));
  };
  return /* @__PURE__ */ m.createElement("div", ec({
    role: "radiogroup",
    "aria-label": "segmented control",
    tabIndex: f ? void 0 : 0,
    "aria-orientation": l ? "vertical" : "horizontal",
    style: S
  }, Y, {
    className: we(o, {
      [`${o}-rtl`]: i === "rtl",
      [`${o}-disabled`]: f,
      [`${o}-vertical`]: l
    }, v),
    ref: P
  }), /* @__PURE__ */ m.createElement("div", {
    className: `${o}-group`
  }, /* @__PURE__ */ m.createElement(N2, {
    vertical: l,
    prefixCls: o,
    value: M,
    containerRef: k,
    motionName: `${o}-${C}`,
    direction: i,
    getValueIndex: (A) => R.findIndex((ee) => ee.value === A),
    onMotionStart: () => {
      O(!0);
    },
    onMotionEnd: () => {
      O(!1);
    }
  }), R.map(T)));
}), A2 = O2;
function F0(e, n) {
  return {
    [`${e}, ${e}:hover, ${e}:focus`]: {
      color: n.colorTextDisabled,
      cursor: "not-allowed"
    }
  };
}
const z0 = (e) => ({
  background: e.itemSelectedBg,
  boxShadow: e.boxShadowTertiary
}), L2 = {
  overflow: "hidden",
  // handle text ellipsis
  ...NC
}, B2 = (e) => {
  const {
    componentCls: n,
    motionDurationSlow: o,
    motionEaseInOut: i,
    motionDurationMid: l
  } = e, c = e.calc(e.controlHeight).sub(e.calc(e.trackPadding).mul(2)).equal(), f = e.calc(e.controlHeightLG).sub(e.calc(e.trackPadding).mul(2)).equal(), p = e.calc(e.controlHeightSM).sub(e.calc(e.trackPadding).mul(2)).equal();
  return {
    [n]: {
      ...Ur(e),
      display: "inline-block",
      padding: e.trackPadding,
      color: e.itemColor,
      background: e.trackBg,
      borderRadius: e.borderRadius,
      transition: `all ${l}`,
      ...ov(e),
      [`${n}-group`]: {
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        justifyItems: "flex-start",
        flexDirection: "row",
        width: "100%"
      },
      // RTL styles
      [`&${n}-rtl`]: {
        direction: "rtl"
      },
      [`&${n}-vertical`]: {
        [`${n}-group`]: {
          flexDirection: "column"
        },
        [`${n}-thumb`]: {
          width: "100%",
          height: 0,
          padding: `0 ${$e(e.paddingXXS)}`
        }
      },
      // block styles
      [`&${n}-block`]: {
        display: "flex"
      },
      [`&${n}-block ${n}-item`]: {
        flex: 1,
        minWidth: 0
      },
      // item styles
      [`${n}-item`]: {
        position: "relative",
        textAlign: "center",
        cursor: "pointer",
        transition: `color ${l}`,
        borderRadius: e.borderRadiusSM,
        // Fix Safari render bug
        // https://github.com/ant-design/ant-design/issues/45250
        transform: "translateZ(0)",
        "&-selected": {
          ...z0(e),
          color: e.itemSelectedColor
        },
        "&-focused": hp(e),
        "&::after": {
          content: '""',
          position: "absolute",
          zIndex: -1,
          width: "100%",
          height: "100%",
          top: 0,
          insetInlineStart: 0,
          borderRadius: "inherit",
          opacity: 0,
          // This is mandatory to make it not clickable or hoverable
          // Ref: https://github.com/ant-design/ant-design/issues/40888
          pointerEvents: "none",
          transition: ["opacity", "background-color"].map((g) => `${g} ${l}`).join(", ")
        },
        [`&:not(${n}-item-selected):not(${n}-item-disabled)`]: {
          "&:hover, &:active": {
            color: e.itemHoverColor
          },
          "&:hover::after": {
            opacity: 1,
            backgroundColor: e.itemHoverBg
          },
          "&:active::after": {
            opacity: 1,
            backgroundColor: e.itemActiveBg
          }
        },
        "&-label": {
          minHeight: c,
          lineHeight: $e(c),
          padding: `0 ${$e(e.segmentedPaddingHorizontal)}`,
          ...L2
        },
        // syntactic sugar to add `icon` for Segmented Item
        "&-icon + *": {
          marginInlineStart: e.calc(e.marginSM).div(2).equal()
        },
        // Icons from third-party libraries render as a bare `<svg>` inside the icon wrapper,
        // which the `.anticon` reset never reaches. An `<svg>` has no baseline of its own, so it
        // is aligned by its bottom margin edge (CSS 2.1 §10.8.1) and rides above the label.
        // `display: inline-block` keeps it an atomic inline box so `vertical-align` still applies
        // even under a CSS reset that forces `svg { display: block }` (e.g. Tailwind Preflight),
        // which would otherwise drop the icon onto its own line. `vertical-align: middle` centres its
        // margin box on the x-height line; `margin-block-end` then lifts it by half its own value onto
        // the cap-height centre (capHeight − xHeight ≈ 0.2em across typical fonts), keeping it centred
        // at any icon size.
        // Only matches a bare `<svg>`: an `.anticon` keeps its `<svg>` one level deeper.
        "&-icon > svg": {
          display: "inline-block",
          verticalAlign: "middle",
          marginBlockEnd: "0.2em"
        },
        "&-input": {
          position: "absolute",
          insetBlockStart: 0,
          insetInlineStart: 0,
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: "none"
        }
      },
      // thumb styles
      [`${n}-thumb`]: {
        ...z0(e),
        position: "absolute",
        insetBlockStart: 0,
        insetInlineStart: 0,
        width: 0,
        height: "100%",
        padding: `${$e(e.paddingXXS)} 0`,
        borderRadius: e.borderRadiusSM,
        [`& ~ ${n}-item:not(${n}-item-selected):not(${n}-item-disabled)::after`]: {
          backgroundColor: "transparent"
        }
      },
      // size styles
      [`&${n}-lg`]: {
        borderRadius: e.borderRadiusLG,
        [`${n}-item-label`]: {
          minHeight: f,
          lineHeight: $e(f),
          padding: `0 ${$e(e.segmentedPaddingHorizontal)}`,
          fontSize: e.fontSizeLG
        },
        [`${n}-item, ${n}-thumb`]: {
          borderRadius: e.borderRadius
        }
      },
      [`&${n}-sm`]: {
        borderRadius: e.borderRadiusSM,
        [`${n}-item-label`]: {
          minHeight: p,
          lineHeight: $e(p),
          padding: `0 ${$e(e.segmentedPaddingHorizontalSM)}`
        },
        [`${n}-item, ${n}-thumb`]: {
          borderRadius: e.borderRadiusXS
        }
      },
      // disabled styles
      ...F0(`&-disabled ${n}-item`, e),
      ...F0(`${n}-item-disabled`, e),
      // transition effect when `appear-active`
      [`${n}-thumb-motion-appear-active`]: {
        willChange: "transform, width",
        transition: ["transform", "width"].map((g) => `${g} ${o} ${i}`).join(", ")
      },
      [`&${n}-shape-round`]: {
        borderRadius: 9999,
        [`${n}-item, ${n}-thumb`]: {
          borderRadius: 9999
        }
      }
    }
  };
}, H2 = (e) => {
  const {
    colorTextLabel: n,
    colorText: o,
    colorFillSecondary: i,
    colorBgElevated: l,
    colorFill: c,
    lineWidthBold: f,
    colorBgLayout: p
  } = e;
  return {
    trackPadding: f,
    trackBg: p,
    itemColor: n,
    itemHoverColor: o,
    itemHoverBg: i,
    itemSelectedBg: l,
    itemActiveBg: c,
    itemSelectedColor: o
  };
}, D2 = Xr("Segmented", (e) => {
  const {
    lineWidth: n,
    calc: o
  } = e, i = rr(e, {
    segmentedPaddingHorizontal: o(e.controlPaddingHorizontal).sub(n).equal(),
    segmentedPaddingHorizontalSM: o(e.controlPaddingHorizontalSM).sub(n).equal()
  });
  return B2(i);
}, H2);
function j2(e) {
  return Gr(e) && !!e?.icon;
}
const V2 = /* @__PURE__ */ m.forwardRef((e, n) => {
  const o = cl(), {
    prefixCls: i,
    className: l,
    rootClassName: c,
    block: f,
    options: p = [],
    size: g,
    style: h,
    vertical: y,
    orientation: v,
    shape: S = "default",
    name: x = o,
    styles: b,
    classNames: C,
    ...E
  } = e, {
    getPrefixCls: $,
    direction: k,
    className: P,
    style: R,
    classNames: M,
    styles: I
  } = ei("segmented"), z = {
    ...e,
    options: p,
    size: g,
    shape: S
  }, O = Hi(R), j = Hi(h), [Y, V] = pl([M, C], [I, O, b, j], {
    props: z
  }), X = $("segmented", i), [Q, oe] = D2(X), G = yc(g), le = m.useMemo(() => p.map((q) => {
    if (j2(q)) {
      const {
        icon: T,
        label: A,
        ...ee
      } = q;
      return {
        ...ee,
        label: /* @__PURE__ */ m.createElement(m.Fragment, null, /* @__PURE__ */ m.createElement("span", {
          className: we(`${X}-item-icon`, Y.icon),
          style: V.icon
        }, T), A && /* @__PURE__ */ m.createElement("span", null, A))
      };
    }
    return q;
  }), [p, X, Y.icon, V.icon]), [, he] = Iv(v, y), D = we(l, c, P, Y.root, {
    [`${X}-block`]: f,
    [`${X}-sm`]: G === "small",
    [`${X}-lg`]: G === "large",
    [`${X}-vertical`]: he,
    [`${X}-shape-${S}`]: S === "round"
  }, Q, oe), J = (q, {
    item: T
  }) => {
    if (!T.tooltip)
      return q;
    const A = Gr(T.tooltip) ? T.tooltip : {
      title: T.tooltip
    };
    return /* @__PURE__ */ m.createElement(Vi, {
      ...A
    }, q);
  };
  return /* @__PURE__ */ m.createElement(A2, {
    ...E,
    name: x,
    className: D,
    style: V.root,
    classNames: Y,
    styles: V,
    itemRender: J,
    options: le,
    ref: n,
    prefixCls: X,
    direction: k,
    vertical: he
  });
}), W2 = V2;
var za = {}, O0;
function q2() {
  if (O0) return za;
  O0 = 1, Object.defineProperty(za, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M872 474H152c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h720c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8z" } }] }, name: "minus", theme: "outlined" };
  return za.default = e, za;
}
var U2 = /* @__PURE__ */ q2();
const X2 = /* @__PURE__ */ nr(U2);
function kd() {
  return kd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, kd.apply(this, arguments);
}
const G2 = (e, n) => /* @__PURE__ */ m.createElement(kr, kd({}, e, {
  ref: n,
  icon: X2
})), Y2 = /* @__PURE__ */ m.forwardRef(G2);
var Oa = {}, A0;
function K2() {
  if (A0) return Oa;
  A0 = 1, Object.defineProperty(Oa, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M890.5 755.3L537.9 269.2c-12.8-17.6-39-17.6-51.7 0L133.5 755.3A8 8 0 00140 768h75c5.1 0 9.9-2.5 12.9-6.6L512 369.8l284.1 391.6c3 4.1 7.8 6.6 12.9 6.6h75c6.5 0 10.3-7.4 6.5-12.7z" } }] }, name: "up", theme: "outlined" };
  return Oa.default = e, Oa;
}
var Q2 = /* @__PURE__ */ K2();
const Z2 = /* @__PURE__ */ nr(Q2);
function Md() {
  return Md = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Md.apply(this, arguments);
}
const J2 = (e, n) => /* @__PURE__ */ m.createElement(kr, Md({}, e, {
  ref: n,
  icon: Z2
})), e_ = /* @__PURE__ */ m.forwardRef(J2);
function Td() {
  return typeof BigInt == "function";
}
function a1(e) {
  return !e && e !== 0 && !Number.isNaN(e) || !String(e).trim();
}
function Yo(e) {
  var n = e.trim(), o = n.startsWith("-");
  o && (n = n.slice(1)), n = n.replace(/(\.\d*[^0])0*$/, "$1").replace(/\.0*$/, "").replace(/^0+/, ""), n.startsWith(".") && (n = "0".concat(n));
  var i = n || "0", l = i.split("."), c = l[0] || "0", f = l[1] || "0";
  c === "0" && f === "0" && (o = !1);
  var p = o ? "-" : "";
  return {
    negative: o,
    negativeStr: p,
    trimStr: i,
    integerStr: c,
    decimalStr: f,
    fullStr: "".concat(p).concat(i)
  };
}
function Sc(e) {
  var n = String(e);
  return !Number.isNaN(Number(n)) && n.includes("e");
}
function c1(e) {
  var n = e.toLowerCase().split("e"), o = Ka(n, 2), i = o[0], l = o[1], c = l === void 0 ? "0" : l, f = i.startsWith("-"), p = f ? i.slice(1) : i, g = p.split("."), h = Ka(g, 2), y = h[0], v = y === void 0 ? "0" : y, S = h[1], x = S === void 0 ? "" : S, b = "".concat(v).concat(x).replace(/^0+/, "") || "0";
  return {
    decimal: x,
    digits: b,
    exponent: Number(c),
    integer: v,
    negative: f
  };
}
function t_(e) {
  var n = e.decimal, o = e.digits, i = e.exponent, l = e.integer, c = e.negative;
  if (o === "0")
    return "0";
  var f = l.replace(/^0+/, "").length, p = (n.match(/^0*/) || [""])[0].length, g = f || -p, h = g + i, y = "";
  return h <= 0 ? y = "0.".concat("0".repeat(-h)).concat(o) : h >= o.length ? y = "".concat(o).concat("0".repeat(h - o.length)) : y = "".concat(o.slice(0, h), ".").concat(o.slice(h)), "".concat(c ? "-" : "").concat(y);
}
function u1(e) {
  return e.exponent >= 0 ? Math.max(0, e.decimal.length - e.exponent) : Math.abs(e.exponent) + e.decimal.length;
}
function Vo(e) {
  var n = String(e);
  return Sc(e) ? u1(c1(n)) : n.includes(".") && _p(n) ? n.length - n.indexOf(".") - 1 : 0;
}
function wc(e) {
  var n = String(e);
  if (Sc(e)) {
    if (e > Number.MAX_SAFE_INTEGER)
      return String(Td() ? BigInt(e).toString() : Number.MAX_SAFE_INTEGER);
    if (e < Number.MIN_SAFE_INTEGER)
      return String(Td() ? BigInt(e).toString() : Number.MIN_SAFE_INTEGER);
    var o = c1(n), i = u1(o);
    n = i > 100 ? t_(o) : e.toFixed(i);
  }
  return Yo(n).fullStr;
}
function _p(e) {
  return typeof e == "number" ? !Number.isNaN(e) : e ? (
    // Normal type: 11.28
    /^\s*-?\d+(\.\d+)?\s*$/.test(e) || // Pre-number: 1.
    /^\s*-?\d+\.\s*$/.test(e) || // Post-number: .1
    /^\s*-?\.\d+\s*$/.test(e)
  ) : !1;
}
var n_ = /* @__PURE__ */ (function() {
  function e(n) {
    if (Ui(this, e), $t(this, "origin", ""), $t(this, "negative", void 0), $t(this, "integer", void 0), $t(this, "decimal", void 0), $t(this, "decimalLen", void 0), $t(this, "empty", void 0), $t(this, "nan", void 0), a1(n)) {
      this.empty = !0;
      return;
    }
    if (this.origin = String(n), n === "-" || Number.isNaN(n)) {
      this.nan = !0;
      return;
    }
    var o = n;
    if (Sc(o) && (o = Number(o)), o = typeof o == "string" ? o : wc(o), _p(o)) {
      var i = Yo(o);
      this.negative = i.negative;
      var l = i.trimStr.split(".");
      this.integer = BigInt(l[0]);
      var c = l[1] || "0";
      this.decimal = BigInt(c), this.decimalLen = c.length;
    } else
      this.nan = !0;
  }
  return Xi(e, [{
    key: "getMark",
    value: function() {
      return this.negative ? "-" : "";
    }
  }, {
    key: "getIntegerStr",
    value: function() {
      return this.integer.toString();
    }
    /**
     * @private get decimal string
     */
  }, {
    key: "getDecimalStr",
    value: function() {
      return this.decimal.toString().padStart(this.decimalLen, "0");
    }
    /**
     * @private Align BigIntDecimal with same decimal length. e.g. 12.3 + 5 = 1230000
     * This is used for add function only.
     */
  }, {
    key: "alignDecimal",
    value: function(o) {
      var i = "".concat(this.getMark()).concat(this.getIntegerStr()).concat(this.getDecimalStr().padEnd(o, "0"));
      return BigInt(i);
    }
  }, {
    key: "negate",
    value: function() {
      var o = new e(this.toString());
      return o.negative = !o.negative, o;
    }
  }, {
    key: "cal",
    value: function(o, i, l) {
      var c = Math.max(this.getDecimalStr().length, o.getDecimalStr().length), f = this.alignDecimal(c), p = o.alignDecimal(c), g = i(f, p).toString(), h = l(c), y = Yo(g), v = y.negativeStr, S = y.trimStr, x = "".concat(v).concat(S.padStart(h + 1, "0"));
      return new e("".concat(x.slice(0, -h), ".").concat(x.slice(-h)));
    }
  }, {
    key: "add",
    value: function(o) {
      if (this.isInvalidate())
        return new e(o);
      var i = new e(o);
      return i.isInvalidate() ? this : this.cal(i, function(l, c) {
        return l + c;
      }, function(l) {
        return l;
      });
    }
  }, {
    key: "multi",
    value: function(o) {
      var i = new e(o);
      return this.isInvalidate() || i.isInvalidate() ? new e(NaN) : this.cal(i, function(l, c) {
        return l * c;
      }, function(l) {
        return l * 2;
      });
    }
  }, {
    key: "isEmpty",
    value: function() {
      return this.empty;
    }
  }, {
    key: "isNaN",
    value: function() {
      return this.nan;
    }
  }, {
    key: "isInvalidate",
    value: function() {
      return this.isEmpty() || this.isNaN();
    }
  }, {
    key: "equals",
    value: function(o) {
      return this.toString() === o?.toString();
    }
  }, {
    key: "lessEquals",
    value: function(o) {
      return this.add(o.negate().toString()).toNumber() <= 0;
    }
  }, {
    key: "toNumber",
    value: function() {
      return this.isNaN() ? NaN : Number(this.toString());
    }
  }, {
    key: "toString",
    value: function() {
      var o = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : !0;
      return o ? this.isInvalidate() ? "" : Yo("".concat(this.getMark()).concat(this.getIntegerStr(), ".").concat(this.getDecimalStr())).fullStr : this.origin;
    }
  }]), e;
})(), r_ = /* @__PURE__ */ (function() {
  function e(n) {
    if (Ui(this, e), $t(this, "origin", ""), $t(this, "number", void 0), $t(this, "empty", void 0), a1(n)) {
      this.empty = !0;
      return;
    }
    this.origin = String(n), this.number = Number(n);
  }
  return Xi(e, [{
    key: "negate",
    value: function() {
      return new e(-this.toNumber());
    }
  }, {
    key: "add",
    value: function(o) {
      if (this.isInvalidate())
        return new e(o);
      var i = Number(o);
      if (Number.isNaN(i))
        return this;
      var l = this.number + i;
      if (l > Number.MAX_SAFE_INTEGER)
        return new e(Number.MAX_SAFE_INTEGER);
      if (l < Number.MIN_SAFE_INTEGER)
        return new e(Number.MIN_SAFE_INTEGER);
      var c = Math.max(Vo(this.number), Vo(i));
      return new e(l.toFixed(c));
    }
  }, {
    key: "multi",
    value: function(o) {
      var i = Number(o);
      if (this.isInvalidate() || Number.isNaN(i))
        return new e(NaN);
      var l = this.number * i;
      if (l > Number.MAX_SAFE_INTEGER)
        return new e(Number.MAX_SAFE_INTEGER);
      if (l < Number.MIN_SAFE_INTEGER)
        return new e(Number.MIN_SAFE_INTEGER);
      var c = Math.max(Vo(this.number), Vo(i));
      return new e(l.toFixed(c));
    }
  }, {
    key: "isEmpty",
    value: function() {
      return this.empty;
    }
  }, {
    key: "isNaN",
    value: function() {
      return Number.isNaN(this.number);
    }
  }, {
    key: "isInvalidate",
    value: function() {
      return this.isEmpty() || this.isNaN();
    }
  }, {
    key: "equals",
    value: function(o) {
      return this.toNumber() === o?.toNumber();
    }
  }, {
    key: "lessEquals",
    value: function(o) {
      return this.add(o.negate().toString()).toNumber() <= 0;
    }
  }, {
    key: "toNumber",
    value: function() {
      return this.number;
    }
  }, {
    key: "toString",
    value: function() {
      var o = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : !0;
      return o ? this.isInvalidate() ? "" : Sc(this.number) && Vo(this.number) > 100 ? String(this.number) : wc(this.number) : this.origin;
    }
  }]), e;
})();
function dr(e) {
  return Td() ? new n_(e) : new r_(e);
}
function qa(e, n, o) {
  var i = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : !1;
  if (e === "")
    return "";
  var l = Yo(e), c = l.negativeStr, f = l.integerStr, p = l.decimalStr, g = "".concat(n).concat(p), h = "".concat(c).concat(f);
  if (o >= 0) {
    var y = Number(p[o]);
    if (y >= 5 && !i) {
      var v = dr(e).add("".concat(c, "0.").concat("0".repeat(o)).concat(10 - y));
      return qa(v.toString(), n, o, i);
    }
    return o === 0 ? h : "".concat(h).concat(n).concat(p.padEnd(o, "0").slice(0, o));
  }
  return g === ".0" ? h : "".concat(h).concat(g);
}
function o_(e, n) {
  const o = m.useRef(null);
  function i() {
    try {
      const {
        selectionStart: c,
        selectionEnd: f,
        value: p
      } = e, g = p.substring(0, c), h = p.substring(f);
      o.current = {
        start: c,
        end: f,
        value: p,
        beforeTxt: g,
        afterTxt: h
      };
    } catch {
    }
  }
  function l() {
    if (e && o.current && n)
      try {
        const {
          value: c
        } = e, {
          beforeTxt: f,
          afterTxt: p,
          start: g
        } = o.current;
        let h = c.length;
        if (c.startsWith(f))
          h = f.length;
        else if (c.endsWith(p))
          h = c.length - o.current.afterTxt.length;
        else {
          const y = f[g - 1], v = c.indexOf(y, g - 1);
          v !== -1 && (h = v + 1);
        }
        e.setSelectionRange(h, h);
      } catch (c) {
        zn(!1, `Something warning of cursor restore. Please fire issue about this: ${c.message}`);
      }
  }
  return [i, l];
}
const i_ = 200, s_ = 600;
function L0({
  prefixCls: e,
  action: n,
  children: o,
  disabled: i,
  className: l,
  style: c,
  onStep: f
}) {
  const p = n === "up", g = m.useRef(), h = m.useRef([]), y = () => {
    clearTimeout(g.current);
  }, v = (C) => {
    C.preventDefault(), y(), f(p, "handler");
    function E() {
      f(p, "handler"), g.current = setTimeout(E, i_);
    }
    g.current = setTimeout(E, s_);
  };
  m.useEffect(() => () => {
    y(), h.current.forEach((C) => {
      xo.cancel(C);
    });
  }, []);
  const S = `${e}-action`, x = we(S, `${S}-${n}`, {
    [`${S}-${n}-disabled`]: i
  }, l), b = () => h.current.push(xo(y));
  return /* @__PURE__ */ m.createElement("span", {
    unselectable: "on",
    role: "button",
    onMouseUp: b,
    onMouseLeave: b,
    onMouseDown: (C) => {
      v(C);
    },
    "aria-label": p ? "Increase Value" : "Decrease Value",
    "aria-disabled": i,
    className: x,
    style: c
  }, o || /* @__PURE__ */ m.createElement("span", {
    unselectable: "on",
    className: `${e}-action-${n}-inner`
  }));
}
function B0(e) {
  const n = typeof e == "number" ? wc(e) : Yo(e).fullStr;
  return n.includes(".") ? Yo(n.replace(/(\d)\.(\d)/g, "$1$2.")).fullStr : e + "0";
}
const l_ = (() => {
  const e = m.useRef(0), n = () => {
    xo.cancel(e.current);
  };
  return m.useEffect(() => n, []), (o) => {
    n(), e.current = xo(() => {
      o();
    });
  };
});
function Qs() {
  return Qs = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Qs.apply(this, arguments);
}
const H0 = (e, n) => e || n.isEmpty() ? n.toString() : n.toNumber(), D0 = (e) => {
  const n = dr(e);
  return n.isInvalidate() ? null : n;
}, a_ = /* @__PURE__ */ m.forwardRef((e, n) => {
  const {
    mode: o = "input",
    prefixCls: i = "rc-input-number",
    className: l,
    style: c,
    classNames: f,
    styles: p,
    min: g,
    max: h,
    step: y = 1,
    defaultValue: v,
    value: S,
    disabled: x,
    readOnly: b,
    upHandler: C,
    downHandler: E,
    keyboard: $,
    changeOnWheel: k = !1,
    controls: P = !0,
    prefix: R,
    suffix: M,
    stringMode: I,
    parser: z,
    formatter: O,
    precision: j,
    decimalSeparator: Y,
    onChange: V,
    onInput: X,
    onPressEnter: Q,
    onStep: oe,
    // Mouse Events
    onMouseDown: G,
    onClick: le,
    onMouseUp: he,
    onMouseLeave: D,
    onMouseMove: J,
    onMouseEnter: q,
    onMouseOut: T,
    changeOnBlur: A = !0,
    ...ee
  } = e, [te, se] = m.useState(!1), re = m.useRef(!1), fe = m.useRef(!1), ie = m.useRef(!1), Z = m.useRef(null), ae = m.useRef(null);
  m.useImperativeHandle(n, () => kx(ae.current, {
    focus: (de) => {
      vx(ae.current, de);
    },
    blur: () => {
      ae.current?.blur();
    },
    nativeElement: Z.current
  }));
  const [ce, Me] = m.useState(() => dr(S ?? v));
  function Ue(de) {
    S === void 0 && Me(de);
  }
  const Qe = m.useCallback((de, Ee) => {
    if (!Ee)
      return j >= 0 ? j : Math.max(Vo(de), Vo(y));
  }, [j, y]), ke = m.useCallback((de) => {
    const Ee = String(de);
    if (z)
      return z(Ee);
    let xe = Ee;
    return Y && (xe = xe.replace(Y, ".")), xe.replace(/[^\w.-]+/g, "");
  }, [z, Y]), Xe = m.useRef(""), ut = m.useCallback((de, Ee) => {
    if (O)
      return O(de, {
        userTyping: Ee,
        input: String(Xe.current)
      });
    let xe = typeof de == "number" ? wc(de) : de;
    if (!Ee) {
      const bt = Qe(xe, Ee);
      _p(xe) && (Y || bt >= 0) && (xe = qa(xe, Y || ".", bt));
    }
    return xe;
  }, [O, Qe, Y]), [Oe, xt] = m.useState(() => {
    const de = v ?? S;
    return ce.isInvalidate() && ["string", "number"].includes(typeof de) ? Number.isNaN(de) ? "" : de : ut(ce.toString(), !1);
  });
  Xe.current = Oe;
  function Ze(de, Ee) {
    xt(ut(
      // Invalidate number is sometime passed by external control, we should let it go
      // Otherwise is controlled by internal interactive logic which check by userTyping
      // You can ref 'show limited value when input is not focused' test for more info.
      de.isInvalidate() ? de.toString(!1) : de.toString(!Ee),
      Ee
    ));
  }
  const tt = m.useMemo(() => D0(h), [h, j]), je = m.useMemo(() => D0(g), [g, j]), Je = m.useMemo(() => !tt || !ce || ce.isInvalidate() ? !1 : tt.lessEquals(ce), [tt, ce]), ft = m.useMemo(() => !je || !ce || ce.isInvalidate() ? !1 : ce.lessEquals(je), [je, ce]), [dn, Rt] = o_(ae.current, te), qt = (de) => tt && !de.lessEquals(tt) ? tt : je && !je.lessEquals(de) ? je : null, Ut = (de) => !qt(de), kt = (de, Ee) => {
    let xe = de, bt = Ut(xe) || xe.isEmpty();
    if (!xe.isEmpty() && !Ee && (xe = qt(xe) || xe, bt = !0), !b && !x && bt) {
      const Zt = xe.toString(), Nt = Qe(Zt, Ee);
      return Nt >= 0 && (xe = dr(qa(Zt, ".", Nt)), Ut(xe) || (xe = dr(qa(Zt, ".", Nt, !0)))), xe.equals(ce) || (Ue(xe), V?.(xe.isEmpty() ? null : H0(I, xe)), S === void 0 && Ze(xe, Ee)), xe;
    }
    return ce;
  }, mt = l_(), Mt = (de) => {
    if (dn(), Xe.current = de, xt(de), !fe.current) {
      const Ee = ke(de), xe = dr(Ee);
      xe.isNaN() || kt(xe, !0);
    }
    X?.(de), mt(() => {
      let Ee = de;
      z || (Ee = de.replace(/。/g, ".")), Ee !== de && Mt(Ee);
    });
  }, qe = () => {
    fe.current = !0;
  }, Kt = () => {
    fe.current = !1, Mt(ae.current.value);
  }, Ve = (de) => {
    Mt(de.target.value);
  }, Ae = wt((de, Ee) => {
    if (de && Je || !de && ft)
      return;
    re.current = !1;
    let xe = dr(ie.current ? B0(y) : y);
    de || (xe = xe.negate());
    const bt = (ce || dr(0)).add(xe.toString()), Zt = kt(bt, !1);
    oe?.(H0(I, Zt), {
      offset: ie.current ? B0(y) : y,
      type: de ? "up" : "down",
      emitter: Ee
    }), ae.current?.focus();
  }), ze = (de) => {
    const Ee = dr(ke(Oe));
    let xe;
    Ee.isNaN() ? xe = kt(ce, de) : xe = kt(Ee, de), S !== void 0 ? Ze(ce, !1) : xe.isNaN() || Ze(xe, !1);
  }, Ge = () => {
    re.current = !0;
  }, gt = (de) => {
    const {
      key: Ee,
      shiftKey: xe
    } = de;
    re.current = !0, ie.current = xe, Ee === "Enter" && (fe.current || (re.current = !1), ze(!1), Q?.(de)), $ !== !1 && !fe.current && ["Up", "ArrowUp", "Down", "ArrowDown"].includes(Ee) && (Ae(Ee === "Up" || Ee === "ArrowUp", "keyboard"), de.preventDefault());
  }, Xt = () => {
    re.current = !1, ie.current = !1;
  };
  m.useEffect(() => {
    if (k && te) {
      const de = (xe) => {
        Ae(xe.deltaY < 0, "wheel"), xe.preventDefault();
      }, Ee = ae.current;
      if (Ee)
        return Ee.addEventListener("wheel", de, {
          passive: !1
        }), () => Ee.removeEventListener("wheel", de);
    }
  });
  const nt = () => {
    A && ze(!1), se(!1), re.current = !1;
  }, Qt = (de) => {
    ae.current && de.target !== ae.current && (ae.current.focus(), de.preventDefault()), G?.(de);
  };
  sf(() => {
    ce.isInvalidate() || Ze(ce, !1);
  }, [j, O]), sf(() => {
    const de = dr(S);
    Me(de);
    const Ee = dr(ke(Oe));
    (!de.equals(Ee) || !re.current || O) && Ze(de, re.current);
  }, [S]), sf(() => {
    O && Rt();
  }, [Oe]);
  const Tt = {
    prefixCls: i,
    onStep: Ae,
    className: f?.action,
    style: p?.action
  }, $n = /* @__PURE__ */ m.createElement(L0, Qs({}, Tt, {
    action: "up",
    disabled: Je
  }), C), _n = /* @__PURE__ */ m.createElement(L0, Qs({}, Tt, {
    action: "down",
    disabled: ft
  }), E);
  return /* @__PURE__ */ m.createElement("div", {
    ref: Z,
    className: we(i, `${i}-mode-${o}`, l, f?.root, {
      [`${i}-focused`]: te,
      [`${i}-disabled`]: x,
      [`${i}-readonly`]: b,
      [`${i}-not-a-number`]: ce.isNaN(),
      [`${i}-out-of-range`]: !ce.isInvalidate() && !Ut(ce)
    }),
    style: {
      ...p?.root,
      ...c
    },
    onMouseDown: Qt,
    onMouseUp: he,
    onMouseLeave: D,
    onMouseMove: J,
    onMouseEnter: q,
    onMouseOut: T,
    onClick: le,
    onFocus: () => {
      se(!0);
    },
    onBlur: nt,
    onKeyDown: gt,
    onKeyUp: Xt,
    onCompositionStart: qe,
    onCompositionEnd: Kt,
    onBeforeInput: Ge
  }, o === "spinner" && P && _n, R !== void 0 && /* @__PURE__ */ m.createElement("div", {
    className: we(`${i}-prefix`, f?.prefix),
    style: p?.prefix
  }, R), /* @__PURE__ */ m.createElement("input", Qs({
    autoComplete: "off",
    role: "spinbutton",
    "aria-valuemin": g,
    "aria-valuemax": h,
    "aria-valuenow": ce.isInvalidate() ? null : ce.toString(),
    step: y,
    ref: ae,
    className: we(`${i}-input`, f?.input),
    style: p?.input,
    value: Oe,
    onChange: Ve,
    disabled: x,
    readOnly: b
  }, ee)), M !== void 0 && /* @__PURE__ */ m.createElement("div", {
    className: we(`${i}-suffix`, f?.suffix),
    style: p?.suffix
  }, M), o === "spinner" && P && $n, o === "input" && P && /* @__PURE__ */ m.createElement("div", {
    className: we(`${i}-actions`, f?.actions),
    style: p?.actions
  }, $n, _n));
}), c_ = (e) => {
  const {
    componentCls: n,
    borderRadius: o,
    paddingSM: i,
    colorBorder: l,
    paddingXS: c,
    fontSizeLG: f,
    fontSizeSM: p,
    borderRadiusLG: g,
    borderRadiusSM: h,
    colorBgContainerDisabled: y,
    lineWidth: v,
    lineType: S,
    antCls: x
  } = e, [b, C] = fl(x, "space-addon");
  return {
    [n]: [
      // ==========================================================
      // ==                         Base                         ==
      // ==========================================================
      {
        ...Ur(e),
        display: "inline-flex",
        alignItems: "center",
        gap: 0,
        whiteSpace: "nowrap",
        paddingInline: i,
        margin: 0,
        borderWidth: v,
        borderStyle: S,
        borderRadius: o,
        "&:hover": {
          zIndex: 0
        },
        [`&${n}-disabled`]: {
          color: e.colorTextDisabled
        },
        "&-large": {
          fontSize: f,
          borderRadius: g
        },
        "&-small": {
          paddingInline: c,
          borderRadius: h,
          fontSize: p
        },
        "&-compact-last-item": {
          borderEndStartRadius: 0,
          borderStartStartRadius: 0
        },
        "&-compact-first-item": {
          borderEndEndRadius: 0,
          borderStartEndRadius: 0
        },
        "&-compact-item:not(:first-child):not(:last-child)": {
          borderRadius: 0
        },
        "&-compact-item:not(:last-child)": {
          borderInlineEndWidth: 0
        },
        "&-compact-item:not(:first-child)": {
          borderInlineStartWidth: 0
        }
      },
      // ==========================================================
      // ==                       Variants                       ==
      // ==========================================================
      {
        [b("addon-border-color")]: l,
        [b("addon-background")]: y,
        // Filled
        [b("addon-border-color-outlined")]: l,
        [b("addon-background-filled")]: y,
        borderColor: C("addon-border-color"),
        background: C("addon-background"),
        // ======================= Outlined =======================
        "&-variant-outlined": {
          [b("addon-border-color")]: C("addon-border-color-outlined")
        },
        // ======================== Filled ========================
        "&-variant-filled": {
          [b("addon-border-color")]: "transparent",
          [b("addon-background")]: C("addon-background-filled"),
          // Disabled
          [`&${n}-disabled`]: {
            [b("addon-border-color")]: l,
            [b("addon-background")]: y
          }
        },
        // ====================== Borderless ======================
        "&-variant-borderless": {
          border: "none",
          background: "transparent"
        },
        // ====================== Underlined ======================
        "&-variant-underlined": {
          border: "none",
          background: "transparent"
        }
      },
      // ==========================================================
      // ==                        Status                        ==
      // ==========================================================
      {
        "&-status-error": {
          [b("addon-border-color-outlined")]: e.colorError,
          [b("addon-background-filled")]: e.colorErrorBg,
          color: e.colorError
        },
        "&-status-warning": {
          [b("addon-border-color-outlined")]: e.colorWarning,
          [b("addon-background-filled")]: e.colorWarningBg,
          color: e.colorWarning
        }
      }
    ]
  };
}, u_ = Xr("Addon", (e) => [c_(e), xp(e, {
  focus: !1
})]), f_ = /* @__PURE__ */ ye.forwardRef((e, n) => {
  const {
    className: o,
    children: i,
    style: l,
    prefixCls: c,
    variant: f = "outlined",
    disabled: p,
    status: g,
    ...h
  } = e, {
    getPrefixCls: y,
    direction: v
  } = ye.useContext(On), S = y("space-addon", c), [x, b] = u_(S), {
    compactItemClassnames: C,
    compactSize: E
  } = Ov(S, v), $ = Wv(S, g), k = we(S, x, C, b, `${S}-variant-${f}`, $, {
    [`${S}-${E}`]: E,
    [`${S}-disabled`]: p
  }, o);
  return /* @__PURE__ */ ye.createElement("div", {
    ref: n,
    className: k,
    style: l,
    ...h
  }, i);
}), d_ = (e) => {
  const n = e.handleVisible ?? "auto", o = e.controlHeightSM - e.lineWidth * 2;
  return {
    ...bp(e),
    controlWidth: 90,
    handleWidth: o,
    handleFontSize: e.fontSize / 2,
    handleVisible: n,
    handleActiveBg: e.colorFillAlter,
    handleBg: e.colorBgContainer,
    filledHandleBg: new Pt(e.colorFillSecondary).onBackground(e.colorBgContainer).toHexString(),
    handleHoverColor: e.colorPrimary,
    handleBorderColor: e.colorBorder,
    handleOpacity: n === !0 ? 1 : 0,
    handleVisibleWidth: n === !0 ? o : 0
  };
}, p_ = (e) => {
  const {
    componentCls: n,
    lineWidth: o,
    lineType: i,
    borderRadius: l,
    inputFontSizeSM: c,
    inputFontSizeLG: f,
    colorError: p,
    paddingInlineSM: g,
    paddingBlockSM: h,
    paddingBlockLG: y,
    paddingInlineLG: v,
    colorIcon: S,
    colorTextDisabled: x,
    motionDurationMid: b,
    handleHoverColor: C,
    handleOpacity: E,
    paddingInline: $,
    paddingBlock: k,
    handleBg: P,
    handleActiveBg: R,
    inputAffixPadding: M,
    borderRadiusSM: I,
    controlWidth: z,
    handleBorderColor: O,
    filledHandleBg: j,
    lineHeightLG: Y,
    antCls: V
  } = e, X = `${$e(o)} ${i} ${O}`, [Q, oe] = fl(V, "input-number");
  return [
    // ==========================================================
    // ==                         Base                         ==
    // ==========================================================
    {
      [n]: {
        ...Ur(e),
        ...$p(e),
        [Q("input-padding-block")]: $e(k),
        [Q("input-padding-inline")]: $e($),
        display: "inline-flex",
        width: z,
        margin: 0,
        paddingBlock: 0,
        borderRadius: l,
        // ======================= Variants =======================
        ...Qv(e, {
          [`${n}-actions`]: {
            background: P,
            [`${n}-action-down`]: {
              borderBlockStart: X
            }
          }
        }),
        ...n1(e, {
          [`${n}-actions`]: {
            background: j,
            [`${n}-action-down`]: {
              borderBlockStart: X
            }
          },
          "&:focus-within": {
            [`${n}-actions`]: {
              background: P
            }
          }
        }),
        ...o1(e, {
          [`${n}-actions`]: {
            background: P,
            [`${n}-action-down`]: {
              borderBlockStart: X
            }
          }
        }),
        ...e1(e),
        // InputNumber 两层结构：borderless 补偿只加在内层 input 的 CSS 变量上，避免外层+内层双重 padding 导致高度异常
        [`&${n}-borderless`]: {
          paddingBlock: 0,
          [Q("input-padding-block")]: $e(e.calc(k).add(o).equal())
        },
        [`&${n}-borderless${n}-sm`]: {
          paddingBlock: 0,
          [Q("input-padding-block")]: $e(e.calc(h).add(o).equal())
        },
        [`&${n}-borderless${n}-lg`]: {
          paddingBlock: 0,
          [Q("input-padding-block")]: $e(e.calc(y).add(o).equal())
        },
        // ========================= RTL ==========================
        "&-rtl": {
          direction: "rtl",
          [`${n}-input`]: {
            direction: "rtl"
          }
        },
        // ===================== Out Of Range =====================
        [`&${n}-out-of-range`]: {
          [`${n}-input`]: {
            color: p
          }
        },
        // ======================== Input =========================
        [`${n}-input`]: {
          ...Ur(e),
          width: "100%",
          paddingBlock: oe("input-padding-block"),
          textAlign: "start",
          backgroundColor: "transparent",
          border: 0,
          borderRadius: 0,
          outline: 0,
          transition: `all ${b} linear`,
          appearance: "textfield",
          fontSize: "inherit",
          lineHeight: "inherit",
          ...i1(e.colorTextPlaceholder),
          '&[type="number"]::-webkit-inner-spin-button, &[type="number"]::-webkit-outer-spin-button': {
            margin: 0,
            appearance: "none"
          }
        },
        [`&:hover ${n}-handler-wrap, &-focused ${n}-handler-wrap`]: {
          width: e.handleWidth,
          opacity: 1
        },
        // ======================= Disabled =======================
        [`&-disabled ${n}-input`]: {
          cursor: "not-allowed",
          color: e.colorTextDisabled
        }
      }
    },
    // ==========================================================
    // ==                        Action                        ==
    // ==========================================================
    {
      [n]: {
        // ======================= Shared =======================
        [`${n}-action`]: {
          ...rv(),
          userSelect: "none",
          overflow: "hidden",
          fontWeight: "bold",
          lineHeight: 0,
          textAlign: "center",
          cursor: "pointer",
          transition: `all ${b} linear`,
          // Active: change background not disabled only;
          [`&:active:not(${n}-action-up-disabled):not(${n}-action-down-disabled)`]: {
            background: R
          },
          // Hover: change color not disabled only;
          [`&:hover:not(${n}-action-up-disabled):not(${n}-action-down-disabled)`]: {
            color: C
          },
          [`&${n}-action-up-disabled, &${n}-action-down-disabled`]: {
            cursor: "not-allowed",
            color: x
          }
        },
        // ===================== Input Mode =====================
        "&-mode-input": {
          overflow: "hidden",
          [`${n}-actions`]: {
            position: "absolute",
            insetBlockStart: 0,
            insetInlineEnd: 0,
            width: e.handleVisibleWidth,
            opacity: E,
            height: "100%",
            borderRadius: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            transition: `all ${b}`,
            overflow: "hidden",
            // Fix input number inside Menu makes icon too large
            // We arise the selector priority by nest selector here
            // https://github.com/ant-design/ant-design/issues/14367
            [`${n}-action`]: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "auto",
              height: "40%",
              marginInlineEnd: 0,
              fontSize: e.handleFontSize
            }
          },
          [`&:hover ${n}-actions, &-focused ${n}-actions`]: {
            width: e.handleWidth,
            opacity: 1
          },
          [`${n}-action`]: {
            color: S,
            height: "50%",
            borderInlineStart: X,
            // Hover: change height not disabled only;
            [`&:hover:not(${n}-action-up-disabled):not(${n}-action-down-disabled)`]: {
              height: "60%"
            }
          },
          [`&${n}-disabled, &${n}-readonly`]: {
            [`${n}-actions`]: {
              display: "none"
            }
          }
        },
        // ==================== Spinner Mode ====================
        [`&${n}-mode-spinner`]: {
          padding: 0,
          width: "auto",
          [`${n}-action`]: {
            flex: "none",
            paddingInline: oe("input-padding-inline"),
            "&-up": {
              borderInlineStart: X
            },
            "&-down": {
              borderInlineEnd: X
            }
          },
          [`${n}-input`]: {
            textAlign: "center",
            paddingInline: oe("input-padding-inline")
          }
        }
      }
    },
    // ==========================================================
    // ==                         Size                         ==
    // ==========================================================
    {
      [n]: {
        "&-lg": {
          [Q("input-padding-block")]: $e(y),
          [Q("input-padding-inline")]: $e(v),
          paddingBlock: 0,
          fontSize: f,
          lineHeight: Y
        },
        "&-sm": {
          [Q("input-padding-block")]: $e(h),
          [Q("input-padding-inline")]: $e(g),
          paddingBlock: 0,
          fontSize: c,
          borderRadius: I
        }
      }
    },
    // ==========================================================
    // ==                      Pre/Suffix                      ==
    // ==========================================================
    {
      [n]: {
        [`${n}-prefix, ${n}-suffix`]: {
          display: "flex",
          flex: "none",
          alignItems: "center",
          alignSelf: "center",
          pointerEvents: "none"
        },
        [`${n}-prefix`]: {
          marginInlineEnd: M
        },
        [`${n}-suffix`]: {
          height: "100%",
          marginInlineStart: M,
          transition: `margin ${b}`
        },
        [`&:hover:not(${n}-without-controls)`]: {
          [`${n}-suffix`]: {
            marginInlineEnd: e.handleWidth
          }
        }
      }
    }
  ];
}, h_ = (e) => {
  const {
    componentCls: n,
    antCls: o
  } = e;
  return {
    [`${n}-addon`]: {
      [`&:has(${o}-select)`]: {
        border: 0,
        padding: 0
      }
    }
  };
}, m_ = Xr("InputNumber", (e) => {
  const n = rr(e, Cp(e));
  return [
    p_(n),
    h_(n),
    // =====================================================
    // ==             Space Compact                       ==
    // =====================================================
    xp(n)
  ];
}, d_, {
  unitless: {
    handleOpacity: !0
  },
  resetFont: !1
}), g_ = /* @__PURE__ */ m.forwardRef((e, n) => {
  const o = m.useRef(null);
  m.useImperativeHandle(n, () => o.current);
  const {
    rootClassName: i,
    size: l,
    disabled: c,
    prefixCls: f,
    addonBefore: p,
    addonAfter: g,
    prefix: h,
    suffix: y,
    bordered: v,
    readOnly: S,
    status: x,
    controls: b = !0,
    variant: C,
    className: E,
    style: $,
    classNames: k,
    styles: P,
    mode: R,
    ...M
  } = e, {
    direction: I,
    className: z,
    style: O,
    styles: j,
    classNames: Y
  } = ei("inputNumber"), V = m.useContext(al), X = c ?? V, Q = m.useMemo(() => !b || X || S ? !1 : b, [b, X, S]), {
    compactSize: oe,
    compactItemClassnames: G
  } = Ov(f, I);
  let le = R === "spinner" ? /* @__PURE__ */ m.createElement(T2, null) : /* @__PURE__ */ m.createElement(e_, null), he = R === "spinner" ? /* @__PURE__ */ m.createElement(Y2, null) : /* @__PURE__ */ m.createElement(e2, null);
  const D = typeof Q == "boolean" ? Q : void 0;
  Gr(Q) && (le = Q.upIcon || le, he = Q.downIcon || he);
  const {
    hasFeedback: J,
    isFormItemInput: q,
    feedbackIcon: T
  } = m.useContext(oc), A = yc((ce) => l ?? oe ?? ce), [ee, te] = W$("inputNumber", C, v), se = (J || y) && /* @__PURE__ */ m.createElement(m.Fragment, null, y, J && T), re = {
    ...e,
    size: A,
    disabled: X,
    controls: Q
  }, fe = Hi(O), ie = Hi($), [Z, ae] = pl([Y, k], [j, fe, P, ie], {
    props: re
  });
  return /* @__PURE__ */ m.createElement(a_, {
    ref: o,
    mode: R,
    disabled: X,
    className: we(E, i, Z.root, z, G, Wv(f, x, J), {
      [`${f}-${ee}`]: te,
      [`${f}-lg`]: A === "large",
      [`${f}-sm`]: A === "small",
      [`${f}-rtl`]: I === "rtl",
      [`${f}-in-form-item`]: q,
      [`${f}-without-controls`]: !Q
    }),
    style: ae.root,
    upHandler: le,
    downHandler: he,
    prefixCls: f,
    readOnly: S,
    controls: D,
    prefix: h,
    suffix: se,
    classNames: Z,
    styles: ae,
    ...M
  });
}), f1 = /* @__PURE__ */ m.forwardRef((e, n) => {
  const {
    addonBefore: o,
    addonAfter: i,
    prefixCls: l,
    className: c,
    status: f,
    rootClassName: p,
    ...g
  } = e, {
    getPrefixCls: h
  } = ei("inputNumber"), y = h("input-number", l), {
    status: v
  } = m.useContext(oc), S = V$(v, f), x = Sp(y), [b, C] = m_(y, x), E = o || i, $ = /* @__PURE__ */ m.createElement(g_, {
    ref: n,
    ...g,
    prefixCls: y,
    status: S,
    className: we(C, x, b, c),
    rootClassName: E ? void 0 : p
  });
  if (E) {
    const k = (M) => M ? /* @__PURE__ */ m.createElement(f_, {
      className: we(`${y}-addon`, C, b),
      variant: e.variant,
      disabled: e.disabled,
      status: S
    }, /* @__PURE__ */ m.createElement(Vv, {
      form: !0
    }, M)) : null, P = k(o), R = k(i);
    return /* @__PURE__ */ m.createElement(_E, {
      rootClassName: p
    }, P, $, R);
  }
  return $;
}), Nd = f1, y_ = (e) => /* @__PURE__ */ m.createElement(Co, {
  theme: {
    components: {
      InputNumber: {
        handleVisible: !0
      }
    }
  }
}, /* @__PURE__ */ m.createElement(f1, {
  ...e
}));
Nd._InternalPanelDoNotUseOrYouWillBeFired = y_;
const v_ = {
  percent: 0,
  prefixCls: "rc-progress",
  strokeColor: "#2db7f5",
  strokeLinecap: "round",
  strokeWidth: 1,
  railColor: "#D9D9D9",
  railWidth: 1,
  gapPosition: "bottom",
  loading: !1
}, S_ = () => {
  const e = m.useRef([]), n = m.useRef(null);
  return m.useEffect(() => {
    const o = Date.now();
    let i = !1;
    e.current.forEach((l) => {
      if (!l)
        return;
      i = !0;
      const c = l.style;
      c.transitionDuration = ".3s, .3s, .3s, .06s", n.current && o - n.current < 100 && (c.transitionDuration = "0s, 0s");
    }), i && (n.current = Date.now());
  }), e.current;
}, j0 = ({
  bg: e,
  children: n
}) => /* @__PURE__ */ m.createElement("div", {
  style: {
    width: "100%",
    height: "100%",
    background: e
  }
}, n);
function V0(e, n) {
  return Object.keys(e).map((o) => {
    const i = parseFloat(o), l = `${Math.floor(i * n)}%`;
    return `${e[o]} ${l}`;
  });
}
const w_ = /* @__PURE__ */ m.forwardRef((e, n) => {
  const {
    prefixCls: o,
    color: i,
    gradientId: l,
    radius: c,
    className: f,
    style: p,
    ptg: g,
    strokeLinecap: h,
    strokeWidth: y,
    size: v,
    gapDegree: S
  } = e, x = i && typeof i == "object", b = x ? "#FFF" : void 0, C = v / 2, E = /* @__PURE__ */ m.createElement("circle", {
    className: we(`${o}-circle-path`, f),
    r: c,
    cx: C,
    cy: C,
    stroke: b,
    strokeLinecap: h,
    strokeWidth: y,
    opacity: g === 0 ? 0 : 1,
    style: p,
    ref: n
  });
  if (!x)
    return E;
  const $ = `${l}-conic`, k = S ? `${180 + S / 2}deg` : "0deg", P = V0(i, (360 - S) / 360), R = V0(i, 1), M = `conic-gradient(from ${k}, ${P.join(", ")})`, I = `linear-gradient(to ${S ? "bottom" : "top"}, ${R.join(", ")})`;
  return /* @__PURE__ */ m.createElement(m.Fragment, null, /* @__PURE__ */ m.createElement("mask", {
    id: $
  }, E), /* @__PURE__ */ m.createElement("foreignObject", {
    x: 0,
    y: 0,
    width: v,
    height: v,
    mask: `url(#${$})`
  }, /* @__PURE__ */ m.createElement(j0, {
    bg: I
  }, /* @__PURE__ */ m.createElement(j0, {
    bg: M
  }))));
}), Xs = 100, bf = (e, n, o, i, l, c, f, p, g, h, y = 0) => {
  const v = o / 100 * 360 * ((360 - c) / 360), S = c === 0 ? 0 : {
    bottom: 0,
    top: 180,
    left: 90,
    right: -90
  }[f];
  let x = (100 - i) / 100 * n;
  g === "round" && i !== 100 && (x += h / 2, x >= n && (x = n - 0.01));
  const b = Xs / 2;
  return {
    stroke: typeof p == "string" ? p : void 0,
    strokeDasharray: `${n}px ${e}`,
    strokeDashoffset: x + y,
    transform: `rotate(${l + v + S}deg)`,
    transformOrigin: `${b}px ${b}px`,
    transition: "stroke-dashoffset .3s ease 0s, stroke-dasharray .3s ease 0s, stroke .3s, stroke-width .06s ease .3s, opacity .3s ease 0s",
    fillOpacity: 0
  };
}, x_ = (({
  id: e,
  loading: n
}) => {
  if (!n)
    return {
      indeterminateStyleProps: {},
      indeterminateStyleAnimation: null
    };
  const o = `${e}-indeterminate-animate`;
  return {
    indeterminateStyleProps: {
      transform: "rotate(0deg)",
      animation: `${o} 1s linear infinite`
    },
    indeterminateStyleAnimation: /* @__PURE__ */ ye.createElement("style", null, `@keyframes ${o} {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }`)
  };
});
function Id() {
  return Id = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Id.apply(this, arguments);
}
function W0(e) {
  const n = e ?? [];
  return Array.isArray(n) ? n : [n];
}
const C_ = (e) => {
  const {
    id: n,
    prefixCls: o,
    classNames: i = {},
    styles: l = {},
    steps: c,
    strokeWidth: f,
    railWidth: p,
    gapDegree: g = 0,
    gapPosition: h,
    railColor: y,
    strokeLinecap: v,
    style: S,
    className: x,
    strokeColor: b,
    percent: C,
    loading: E,
    ...$
  } = {
    ...v_,
    ...e
  }, k = Xs / 2, P = cl(n), R = `${P}-gradient`, M = k - f / 2, I = Math.PI * 2 * M, z = g > 0 ? 90 + g / 2 : -90, O = I * ((360 - g) / 360), {
    count: j,
    gap: Y
  } = typeof c == "object" ? c : {
    count: c,
    gap: 2
  }, V = W0(C), X = W0(b), Q = X.find((A) => A && typeof A == "object"), G = Q && typeof Q == "object" ? "butt" : v, {
    indeterminateStyleProps: le,
    indeterminateStyleAnimation: he
  } = x_({
    id: P,
    loading: E
  }), D = bf(I, O, 0, 100, z, g, h, y, G, f), J = S_(), q = () => {
    let A = 0;
    return V.map((ee, te) => {
      const se = X[te] || X[X.length - 1], re = bf(I, O, A, ee, z, g, h, se, G, f);
      return A += ee, /* @__PURE__ */ m.createElement(w_, {
        key: te,
        color: se,
        ptg: ee,
        radius: M,
        prefixCls: o,
        gradientId: R,
        className: i.track,
        style: {
          ...re,
          ...le,
          ...l.track
        },
        strokeLinecap: G,
        strokeWidth: f,
        gapDegree: g,
        ref: (fe) => {
          J[te] = fe;
        },
        size: Xs
      });
    }).reverse();
  }, T = () => {
    const A = Math.round(j * (V[0] / 100)), ee = 100 / j;
    let te = 0;
    return new Array(j).fill(null).map((se, re) => {
      const fe = re <= A - 1 ? X[0] : y, ie = fe && typeof fe == "object" ? `url(#${R})` : void 0, Z = bf(I, O, te, ee, z, g, h, fe, "butt", f, Y);
      return te += (O - Z.strokeDashoffset + Y) * 100 / O, /* @__PURE__ */ m.createElement("circle", {
        key: re,
        className: we(`${o}-circle-path`, i.track),
        r: M,
        cx: k,
        cy: k,
        stroke: ie,
        strokeWidth: f,
        opacity: 1,
        style: {
          ...Z,
          ...l.track
        },
        ref: (ae) => {
          J[re] = ae;
        }
      });
    });
  };
  return /* @__PURE__ */ m.createElement("svg", Id({
    className: we(`${o}-circle`, i.root, x),
    viewBox: `0 0 ${Xs} ${Xs}`,
    style: {
      ...l.root,
      ...S
    },
    id: n,
    role: "presentation"
  }, $), !j && /* @__PURE__ */ m.createElement("circle", {
    className: we(`${o}-circle-rail`, i.rail),
    r: M,
    cx: k,
    cy: k,
    stroke: y,
    strokeLinecap: G,
    strokeWidth: p || f,
    style: {
      ...D,
      ...l.rail
    }
  }), j ? T() : q(), he);
};
function Ko(e) {
  return !e || e < 0 ? 0 : e > 100 ? 100 : e;
}
function ic({
  success: e
}) {
  let n;
  return e && "percent" in e && (n = e.percent), n;
}
const b_ = ({
  percent: e,
  success: n
}) => {
  const o = Ko(ic({
    success: n
  }));
  return [o, Ko(Ko(e) - o)];
}, E_ = ({
  success: e = {},
  strokeColor: n
}) => {
  const {
    strokeColor: o
  } = e;
  return [o || Fi.green, n || null];
}, xc = (e, n, o) => {
  let i = -1, l = -1;
  if (n === "step") {
    const c = o.steps, f = o.strokeWidth;
    typeof e == "string" || typeof e > "u" ? (i = e === "small" ? 2 : 14, l = f ?? 8) : yf(e) ? [i, l] = [e, e] : [i = 14, l = 8] = Array.isArray(e) ? e : [e.width, e.height], i *= c;
  } else if (n === "line") {
    const c = o?.strokeWidth;
    typeof e == "string" || typeof e > "u" ? l = c || (e === "small" ? 6 : 8) : yf(e) ? [i, l] = [e, e] : [i = -1, l = 8] = Array.isArray(e) ? e : [e.width, e.height];
  } else (n === "circle" || n === "dashboard") && (typeof e == "string" || typeof e > "u" ? [i, l] = e === "small" ? [60, 60] : [120, 120] : yf(e) ? [i, l] = [e, e] : Array.isArray(e) && (i = e[0] ?? e[1] ?? 120, l = e[0] ?? e[1] ?? 120));
  return [i, l];
}, $_ = 3, __ = (e) => $_ / e * 100, q0 = ["root", "body", "indicator"], P_ = (e) => {
  const {
    prefixCls: n,
    classNames: o,
    styles: i,
    railColor: l,
    trailColor: c,
    strokeLinecap: f = "round",
    gapPosition: p,
    gapPlacement: g,
    gapDegree: h,
    width: y = 120,
    type: v,
    children: S,
    success: x,
    size: b = y,
    steps: C
  } = e, {
    direction: E
  } = ei("progress"), $ = l ?? c, [k, P] = xc(b, "circle");
  let {
    strokeWidth: R
  } = e;
  R === void 0 && (R = Math.max(__(k), 6));
  const M = {
    width: k,
    height: P,
    fontSize: k * 0.15 + 6
  }, I = m.useMemo(() => {
    if (h || h === 0)
      return h;
    if (v === "dashboard")
      return 75;
  }, [h, v]), z = b_(e), O = m.useMemo(() => {
    const G = (g ?? p) || v === "dashboard" && "bottom" || void 0, le = E === "rtl";
    switch (G) {
      case "start":
        return le ? "right" : "left";
      case "end":
        return le ? "left" : "right";
      default:
        return G;
    }
  }, [E, g, p, v]), j = Gr(e.strokeColor), Y = E_({
    success: x,
    strokeColor: e.strokeColor
  }), V = we(`${n}-body`, {
    [`${n}-circle-gradient`]: j
  }, o.body), X = /* @__PURE__ */ m.createElement(C_, {
    steps: C,
    percent: C ? z[1] : z,
    strokeWidth: R,
    railWidth: R,
    strokeColor: C ? Y[1] : Y,
    strokeLinecap: f,
    railColor: $,
    prefixCls: n,
    gapDegree: I,
    gapPosition: O,
    classNames: Ya(o, q0),
    styles: Ya(i, q0)
  }), Q = k <= 20, oe = /* @__PURE__ */ m.createElement("div", {
    className: V,
    style: {
      ...M,
      ...i.body
    }
  }, X, !Q && S);
  return Q ? /* @__PURE__ */ m.createElement(Vi, {
    title: S
  }, oe) : oe;
}, Fd = "--progress-line-stroke-color", R_ = (e) => {
  const n = "-100%";
  return new ln("antProgressLTRActive", {
    "0%": {
      transform: `translateX(${n}) scaleX(0)`,
      opacity: 0.1
    },
    "20%": {
      transform: `translateX(${n}) scaleX(0)`,
      opacity: 0.5
    },
    to: {
      transform: "translateX(0) scaleX(1)",
      opacity: 0
    }
  });
}, k_ = (e) => {
  const {
    componentCls: n,
    iconCls: o
  } = e;
  return {
    [n]: {
      ...Ur(e),
      display: "inline-flex",
      "&-rtl": {
        direction: "rtl"
      },
      [`${n}-indicator`]: {
        color: e.colorText,
        lineHeight: 1,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        wordBreak: "normal",
        [o]: {
          fontSize: e.fontSize
        }
      },
      [`&${n}-status-exception`]: {
        [`${n}-indicator`]: {
          color: e.colorError
        }
      },
      [`&${n}-status-success`]: {
        [`${n}-indicator`]: {
          color: e.colorSuccess
        }
      }
    }
  };
}, M_ = (e) => {
  const {
    componentCls: n
  } = e;
  return {
    [`${n}-line`]: {
      position: "relative",
      width: "100%",
      fontSize: e.fontSize,
      [`${n}-body`]: {
        display: "inline-flex",
        alignItems: "center",
        width: "100%",
        gap: e.marginXS
      },
      [`${n}-rail`]: {
        flex: "auto",
        background: e.remainingColor,
        borderRadius: e.lineBorderRadius,
        position: "relative",
        width: "100%",
        overflow: "hidden"
      },
      [`&${n}-status-active`]: {
        [`${n}-track:after`]: {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundColor: e.colorBgContainer,
          borderRadius: "inherit",
          opacity: 0,
          animationName: R_(),
          animationDuration: e.progressActiveMotionDuration,
          animationTimingFunction: e.motionEaseOutQuint,
          animationIterationCount: "infinite"
        }
      },
      [`${n}-track`]: {
        position: "absolute",
        insetInlineStart: 0,
        insetBlock: 0,
        borderRadius: "inherit",
        background: e.defaultColor,
        transition: `all ${e.motionDurationSlow} ${e.motionEaseInOutCirc}`,
        minWidth: "max-content",
        display: "flex",
        alignItems: "center",
        "&-success": {
          background: e.colorSuccess
        }
      },
      [`&${n}-status-exception`]: {
        [`${n}-track`]: {
          background: e.colorError
        }
      },
      [`&${n}-status-success`]: {
        [`${n}-track`]: {
          background: e.colorSuccess
        }
      },
      // >>>>> indicator
      // >>> Outer
      [`${n}-indicator-outer`]: {
        [`&${n}-indicator-start`]: {
          order: -1
        }
      },
      [`${n}-body-layout-bottom`]: {
        flexDirection: "column",
        alignItems: "center",
        gap: e.marginXXS
      },
      // >>> Inner
      [`${n}-indicator${n}-indicator-inner`]: {
        color: e.colorWhite,
        paddingInline: e.paddingXXS,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        [`&${n}-indicator-end`]: {
          justifyContent: "end"
        },
        [`&${n}-indicator-start`]: {
          justifyContent: "start"
        },
        [`&${n}-indicator-bright`]: {
          color: "rgba(0, 0, 0, 0.45)"
        }
      }
    }
  };
}, T_ = (e) => {
  const {
    componentCls: n,
    iconCls: o
  } = e;
  return {
    [`${n}-circle`]: {
      [`${n}-circle-rail`]: {
        stroke: e.remainingColor
      },
      [`${n}-body:not(${n}-circle-gradient)`]: {
        [`${n}-circle-path`]: {
          stroke: e.defaultColor
        }
      },
      [`${n}-body`]: {
        position: "relative",
        lineHeight: 1,
        backgroundColor: "transparent"
      },
      [`${n}-indicator`]: {
        position: "absolute",
        insetBlockStart: "50%",
        insetInlineStart: 0,
        width: "100%",
        margin: 0,
        padding: 0,
        color: e.circleTextColor,
        fontSize: e.circleTextFontSize,
        lineHeight: 1,
        whiteSpace: "normal",
        textAlign: "center",
        transform: "translateY(-50%)",
        [o]: {
          fontSize: e.circleIconFontSize
        }
      },
      [`&${n}-status-exception`]: {
        [`${n}-body:not(${n}-circle-gradient)`]: {
          [`${n}-circle-path`]: {
            stroke: e.colorError
          }
        }
      },
      [`&${n}-status-success`]: {
        [`${n}-body:not(${n}-circle-gradient)`]: {
          [`${n}-circle-path`]: {
            stroke: e.colorSuccess
          }
        }
      }
    },
    [`${n}-inline-circle`]: {
      lineHeight: 1,
      [`${n}-inner`]: {
        verticalAlign: "bottom"
      }
    }
  };
}, N_ = (e) => {
  const {
    componentCls: n
  } = e;
  return {
    [n]: {
      [`${n}-steps`]: {
        display: "inline-block",
        "&-body": {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: e.progressStepMarginInlineEnd,
          [`${n}-indicator`]: {
            marginInlineStart: e.marginXS
          }
        },
        "&-item": {
          flexShrink: 0,
          minWidth: e.progressStepMinWidth,
          backgroundColor: e.remainingColor,
          transition: `all ${e.motionDurationSlow}`,
          "&-active": {
            backgroundColor: e.defaultColor
          }
        }
      }
    }
  };
}, I_ = (e) => {
  const {
    componentCls: n,
    iconCls: o
  } = e;
  return {
    [n]: {
      [`${n}-small&-line, ${n}-small&-line ${n}-indicator ${o}`]: {
        fontSize: e.fontSizeSM
      }
    }
  };
}, F_ = (e) => ({
  circleTextColor: e.colorText,
  defaultColor: e.colorInfo,
  remainingColor: e.colorFillSecondary,
  lineBorderRadius: 100,
  // magic for capsule shape, should be a very large number
  circleTextFontSize: "1em",
  circleIconFontSize: `${e.fontSize / e.fontSizeSM}em`
}), z_ = Xr("Progress", (e) => {
  const n = e.calc(e.marginXXS).div(2).equal(), o = rr(e, {
    progressStepMarginInlineEnd: n,
    progressStepMinWidth: n,
    progressActiveMotionDuration: "2.4s"
  });
  return [k_(o), M_(o), T_(o), N_(o), I_(o)];
}, F_), O_ = (e) => {
  let n = [];
  return Object.keys(e).forEach((o) => {
    const i = Number.parseFloat(o.replace(/%/g, ""));
    Number.isNaN(i) || n.push({
      key: i,
      value: e[o]
    });
  }), n = n.sort((o, i) => o.key - i.key), n.map(({
    key: o,
    value: i
  }) => `${i} ${o}%`).join(", ");
}, A_ = (e, n) => {
  const {
    from: o = Fi.blue,
    to: i = Fi.blue,
    direction: l = n === "rtl" ? "to left" : "to right",
    ...c
  } = e;
  if (Object.keys(c).length !== 0) {
    const p = O_(c), g = `linear-gradient(${l}, ${p})`;
    return {
      background: g,
      [Fd]: g
    };
  }
  const f = `linear-gradient(${l}, ${o}, ${i})`;
  return {
    background: f,
    [Fd]: f
  };
}, L_ = (e) => {
  const {
    prefixCls: n,
    classNames: o,
    styles: i,
    direction: l,
    percent: c,
    size: f,
    strokeWidth: p,
    strokeColor: g,
    strokeLinecap: h = "round",
    children: y,
    railColor: v,
    trailColor: S,
    percentPosition: x,
    success: b
  } = e, {
    align: C,
    type: E
  } = x, $ = v ?? S, k = h === "square" || h === "butt" ? 0 : void 0, P = f ?? [-1, p || (f === "small" ? 6 : 8)], [R, M] = xc(P, "line", {
    strokeWidth: p
  }), I = {
    backgroundColor: $ || void 0,
    borderRadius: k,
    height: M
  }, z = `${n}-track`, O = g && typeof g != "string" ? A_(g, l) : {
    [Fd]: g,
    background: g
  }, j = {
    width: `${Ko(c)}%`,
    height: M,
    borderRadius: k,
    ...O
  }, Y = ic(e), V = {
    width: `${Ko(Y)}%`,
    height: M,
    borderRadius: k,
    backgroundColor: b?.strokeColor
  };
  return /* @__PURE__ */ m.createElement("div", {
    className: we(`${n}-body`, o.body, {
      [`${n}-body-layout-bottom`]: C === "center" && E === "outer"
    }),
    style: {
      width: R > 0 ? R : "100%",
      ...i.body
    }
  }, /* @__PURE__ */ m.createElement("div", {
    className: we(`${n}-rail`, o.rail),
    style: {
      ...I,
      ...i.rail
    }
  }, /* @__PURE__ */ m.createElement("div", {
    className: we(z, o.track),
    style: {
      ...j,
      ...i.track
    }
  }, E === "inner" && y), Y !== void 0 && /* @__PURE__ */ m.createElement("div", {
    className: we(z, `${z}-success`, o.track),
    style: {
      ...V,
      ...i.track
    }
  })), E === "outer" && y);
}, B_ = (e) => {
  const {
    classNames: n,
    styles: o,
    size: i,
    steps: l,
    rounding: c = Math.round,
    percent: f = 0,
    strokeWidth: p = 8,
    strokeColor: g,
    railColor: h,
    trailColor: y,
    prefixCls: v,
    children: S
  } = e, x = c(l * (f / 100)), C = i ?? [i === "small" ? 2 : 14, p], [E, $] = xc(C, "step", {
    steps: l,
    strokeWidth: p
  }), k = E / l, P = Array.from({
    length: l
  }), R = h ?? y;
  for (let M = 0; M < l; M++) {
    const I = Array.isArray(g) ? g[M] : g;
    P[M] = /* @__PURE__ */ m.createElement("div", {
      key: M,
      className: we(`${v}-steps-item`, {
        [`${v}-steps-item-active`]: M <= x - 1
      }, n.track),
      style: {
        backgroundColor: M <= x - 1 ? I : R,
        width: k,
        height: $,
        ...o.track
      }
    });
  }
  return /* @__PURE__ */ m.createElement("div", {
    className: we(`${v}-steps-body`, n.body),
    style: o.body
  }, P, S);
}, H_ = ["normal", "exception", "active", "success"], d1 = /* @__PURE__ */ m.forwardRef((e, n) => {
  const {
    prefixCls: o,
    className: i,
    rootClassName: l,
    classNames: c,
    styles: f,
    steps: p,
    strokeColor: g,
    percent: h = 0,
    size: y = "medium",
    showInfo: v = !0,
    type: S = "line",
    status: x,
    format: b,
    style: C,
    percentPosition: E = {},
    ...$
  } = e, {
    align: k = "end",
    type: P = "outer"
  } = E, R = Array.isArray(g) ? g[0] : g, M = typeof g == "string" || Array.isArray(g) ? g : void 0, I = m.useMemo(() => {
    if (R) {
      const Z = typeof R == "string" ? R : Object.values(R)[0];
      return new Pt(Z).isLight();
    }
    return !1;
  }, [g]), z = m.useMemo(() => {
    const Z = ic(e);
    return Number.parseInt(Z !== void 0 ? (Z ?? 0)?.toString() : (h ?? 0)?.toString(), 10);
  }, [h, e.success]), O = m.useMemo(() => !H_.includes(x) && z >= 100 ? "success" : x || "normal", [x, z]), {
    getPrefixCls: j,
    direction: Y,
    className: V,
    style: X,
    classNames: Q,
    styles: oe
  } = ei("progress"), G = j("progress", o), [le, he] = z_(G), D = {
    ...e,
    percent: h,
    type: S,
    size: y,
    showInfo: v,
    percentPosition: E
  }, J = Hi(X), q = Hi(C), [T, A] = pl([Q, c], [oe, J, f, q], {
    props: D
  }), ee = S === "line", te = ee && !p, se = m.useMemo(() => {
    if (!v)
      return null;
    const Z = ic(e);
    let ae;
    const ce = b || ((Ue) => `${Ue}%`), Me = ee && I && P === "inner";
    return P === "inner" || b || O !== "exception" && O !== "success" ? ae = ce(Ko(h), Ko(Z)) : O === "exception" ? ae = ee ? /* @__PURE__ */ m.createElement(lb, null) : /* @__PURE__ */ m.createElement(db, null) : O === "success" && (ae = ee ? /* @__PURE__ */ m.createElement(nb, null) : /* @__PURE__ */ m.createElement(Y$, null)), /* @__PURE__ */ m.createElement("span", {
      className: we(`${G}-indicator`, {
        [`${G}-indicator-bright`]: Me,
        [`${G}-indicator-${k}`]: te,
        [`${G}-indicator-${P}`]: te
      }, T.indicator),
      style: A.indicator,
      title: typeof ae == "string" ? ae : void 0
    }, ae);
  }, [v, h, z, O, S, G, b, ee, I, P, k, te, T.indicator, A.indicator]), re = {
    ...e,
    classNames: T,
    styles: A
  };
  let fe;
  S === "line" ? fe = p ? /* @__PURE__ */ m.createElement(B_, {
    ...re,
    strokeColor: M,
    prefixCls: G,
    steps: Gr(p) ? p.count : p
  }, se) : /* @__PURE__ */ m.createElement(L_, {
    ...re,
    strokeColor: R,
    prefixCls: G,
    direction: Y,
    percentPosition: {
      align: k,
      type: P
    }
  }, se) : (S === "circle" || S === "dashboard") && (fe = /* @__PURE__ */ m.createElement(P_, {
    ...re,
    strokeColor: R,
    prefixCls: G,
    progressStatus: O
  }, se));
  const ie = we(G, `${G}-status-${O}`, {
    [`${G}-${S === "dashboard" && "circle" || S}`]: S !== "line",
    [`${G}-inline-circle`]: S === "circle" && xc(y, "circle")[0] <= 20,
    [`${G}-line`]: te,
    [`${G}-line-align-${k}`]: te,
    [`${G}-line-position-${P}`]: te,
    [`${G}-steps`]: p,
    [`${G}-show-info`]: v,
    [`${G}-small`]: y === "small",
    [`${G}-rtl`]: Y === "rtl"
  }, V, i, l, T.root, le, he);
  return /* @__PURE__ */ m.createElement("div", {
    ref: n,
    style: A.root,
    className: ie,
    role: "progressbar",
    "aria-valuenow": z,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    ...Ya($, ["railColor", "trailColor", "strokeWidth", "width", "gapDegree", "gapPosition", "gapPlacement", "strokeLinecap", "success"])
  }, fe);
});
var Aa = {}, U0;
function D_() {
  if (U0) return Aa;
  U0 = 1, Object.defineProperty(Aa, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M908.1 353.1l-253.9-36.9L540.7 86.1c-3.1-6.3-8.2-11.4-14.5-14.5-15.8-7.8-35-1.3-42.9 14.5L369.8 316.2l-253.9 36.9c-7 1-13.4 4.3-18.3 9.3a32.05 32.05 0 00.6 45.3l183.7 179.1-43.4 252.9a31.95 31.95 0 0046.4 33.7L512 754l227.1 119.4c6.2 3.3 13.4 4.4 20.3 3.2 17.4-3 29.1-19.5 26.1-36.9l-43.4-252.9 183.7-179.1c5-4.9 8.3-11.3 9.3-18.3 2.7-17.5-9.5-33.7-27-36.3z" } }] }, name: "star", theme: "filled" };
  return Aa.default = e, Aa;
}
var j_ = /* @__PURE__ */ D_();
const V_ = /* @__PURE__ */ nr(j_);
function zd() {
  return zd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, zd.apply(this, arguments);
}
const W_ = (e, n) => /* @__PURE__ */ m.createElement(kr, zd({}, e, {
  ref: n,
  icon: V_
})), q_ = /* @__PURE__ */ m.forwardRef(W_);
function U_(e, n) {
  const {
    disabled: o,
    prefixCls: i,
    character: l,
    characterRender: c,
    index: f,
    count: p,
    value: g,
    allowHalf: h,
    focused: y,
    onHover: v,
    onClick: S
  } = e, x = (R) => {
    v(R, f);
  }, b = (R) => {
    S(R, f);
  }, C = (R) => {
    R.keyCode === qs.ENTER && S(R, f);
  }, E = f + 1, $ = /* @__PURE__ */ new Set([i]);
  g === 0 && f === 0 && y ? $.add(`${i}-focused`) : h && g + 0.5 >= E && g < E ? ($.add(`${i}-half`), $.add(`${i}-active`), y && $.add(`${i}-focused`)) : (E <= g ? $.add(`${i}-full`) : $.add(`${i}-zero`), E === g && y && $.add(`${i}-focused`));
  const k = typeof l == "function" ? l(e) : l;
  let P = /* @__PURE__ */ ye.createElement("li", {
    className: we(Array.from($)),
    ref: n
  }, /* @__PURE__ */ ye.createElement("div", {
    onClick: o ? null : b,
    onKeyDown: o ? null : C,
    onMouseMove: o ? null : x,
    role: "radio",
    "aria-checked": g > f ? "true" : "false",
    "aria-posinset": f + 1,
    "aria-setsize": p,
    tabIndex: o ? -1 : 0
  }, /* @__PURE__ */ ye.createElement("div", {
    className: `${i}-first`
  }, k), /* @__PURE__ */ ye.createElement("div", {
    className: `${i}-second`
  }, k)));
  return c && (P = c(P, e)), P;
}
const X_ = /* @__PURE__ */ ye.forwardRef(U_);
function G_() {
  const e = m.useRef({});
  function n(i) {
    return e.current[i];
  }
  function o(i) {
    return (l) => {
      e.current[i] = l;
    };
  }
  return [n, o];
}
function Y_(e) {
  let n = e.pageXOffset;
  const o = "scrollLeft";
  if (typeof n != "number") {
    const i = e.document;
    n = i.documentElement[o], typeof n != "number" && (n = i.body[o]);
  }
  return n;
}
function K_(e) {
  let n, o;
  const i = e.ownerDocument, {
    body: l
  } = i, c = i && i.documentElement, f = e.getBoundingClientRect();
  return n = f.left, o = f.top, n -= c.clientLeft || l.clientLeft || 0, o -= c.clientTop || l.clientTop || 0, {
    left: n,
    top: o
  };
}
function Q_(e) {
  const n = K_(e), o = e.ownerDocument, i = o.defaultView || o.parentWindow;
  return n.left += Y_(i), n.left;
}
function Od() {
  return Od = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Od.apply(this, arguments);
}
function Z_(e, n) {
  const {
    // Base
    prefixCls: o = "rc-rate",
    className: i,
    // Value
    defaultValue: l,
    value: c,
    count: f = 5,
    allowHalf: p = !1,
    allowClear: g = !0,
    keyboard: h = !0,
    // Display
    character: y = "★",
    characterRender: v,
    // Meta
    disabled: S,
    direction: x = "ltr",
    tabIndex: b = 0,
    autoFocus: C,
    // Events
    onHoverChange: E,
    onChange: $,
    onFocus: k,
    onBlur: P,
    onKeyDown: R,
    onMouseLeave: M,
    ...I
  } = e, [z, O] = G_(), j = ye.useRef(null), Y = () => {
    S || j.current?.focus();
  };
  ye.useImperativeHandle(n, () => ({
    focus: Y,
    blur: () => {
      S || j.current?.blur();
    }
  }));
  const [V, X] = rl(l || 0, c), [Q, oe] = rl(null), G = (Z, ae) => {
    const ce = x === "rtl";
    let Me = Z + 1;
    if (p) {
      const Ue = z(Z), Qe = Q_(Ue), ke = Ue.clientWidth;
      (ce && ae - Qe > ke / 2 || !ce && ae - Qe < ke / 2) && (Me -= 0.5);
    }
    return Me;
  }, le = (Z) => {
    X(Z), $?.(Z);
  }, [he, D] = ye.useState(!1), J = () => {
    D(!0), k?.();
  }, q = () => {
    D(!1), P?.();
  }, [T, A] = ye.useState(null), ee = (Z, ae) => {
    const ce = G(ae, Z.pageX);
    ce !== Q && (A(ce), oe(null)), E?.(ce);
  }, te = (Z) => {
    S || (A(null), oe(null), E?.(void 0)), Z && M?.(Z);
  }, se = (Z, ae) => {
    const ce = G(ae, Z.pageX);
    let Me = !1;
    g && (Me = ce === V), te(), le(Me ? 0 : ce), oe(Me ? ce : null);
  }, re = (Z) => {
    const {
      keyCode: ae
    } = Z, ce = x === "rtl", Me = p ? 0.5 : 1;
    h && (ae === qs.RIGHT && V < f && !ce ? (le(V + Me), Z.preventDefault()) : ae === qs.LEFT && V > 0 && !ce || ae === qs.RIGHT && V > 0 && ce ? (le(V - Me), Z.preventDefault()) : ae === qs.LEFT && V < f && ce && (le(V + Me), Z.preventDefault())), R?.(Z);
  };
  ye.useEffect(() => {
    C && !S && Y();
  }, []);
  const fe = new Array(f).fill(0).map((Z, ae) => /* @__PURE__ */ ye.createElement(X_, {
    ref: O(ae),
    index: ae,
    count: f,
    disabled: S,
    prefixCls: `${o}-star`,
    allowHalf: p,
    value: T === null ? V : T,
    onClick: se,
    onHover: ee,
    key: Z || ae,
    character: y,
    characterRender: v,
    focused: he
  })), ie = we(o, i, {
    [`${o}-disabled`]: S,
    [`${o}-rtl`]: x === "rtl"
  });
  return /* @__PURE__ */ ye.createElement("ul", Od({
    className: ie,
    onMouseLeave: te,
    tabIndex: S ? -1 : b,
    onFocus: S ? null : J,
    onBlur: S ? null : q,
    onKeyDown: S ? null : re,
    ref: j
  }, Rx(I, {
    aria: !0,
    data: !0,
    attr: !0
  })), fe);
}
const J_ = /* @__PURE__ */ ye.forwardRef(Z_), eP = (e) => {
  const {
    componentCls: n
  } = e;
  return {
    [`${n}-star`]: {
      position: "relative",
      display: "inline-block",
      color: "inherit",
      cursor: "pointer",
      "&:not(:last-child)": {
        marginInlineEnd: e.marginXS
      },
      "> div": {
        transition: `all ${e.motionDurationMid}, outline 0s`,
        "&:hover": {
          transform: e.starHoverScale
        },
        "&:focus": {
          outline: 0
        },
        "&:focus-visible": {
          outline: `${$e(e.lineWidth)} dashed ${e.starColor}`,
          transform: e.starHoverScale
        }
      },
      "&-first, &-second": {
        color: e.starBg,
        transition: `all ${e.motionDurationMid}`,
        userSelect: "none"
      },
      "&-first": {
        position: "absolute",
        top: 0,
        insetInlineStart: 0,
        width: "50%",
        height: "100%",
        overflow: "hidden",
        opacity: 0
      },
      [`&-half ${n}-star-first, &-half ${n}-star-second`]: {
        opacity: 1
      },
      [`&-half ${n}-star-first, &-full ${n}-star-second`]: {
        color: "inherit"
      }
    }
  };
}, tP = (e) => ({
  [`&-rtl${e.componentCls}`]: {
    direction: "rtl"
  }
}), nP = (e) => {
  const {
    componentCls: n
  } = e;
  return {
    [n]: {
      ...Ur(e),
      display: "inline-block",
      margin: 0,
      padding: 0,
      color: e.starColor,
      fontSize: e.starSize,
      lineHeight: 1,
      listStyle: "none",
      outline: "none",
      "&-small": {
        fontSize: e.starSizeSM
      },
      "&-large": {
        fontSize: e.starSizeLG
      },
      // disable styles
      [`&-disabled${n} ${n}-star`]: {
        cursor: "default",
        "> div:hover": {
          transform: "scale(1)"
        }
      },
      // star styles
      ...eP(e),
      // rtl styles
      ...tP(e)
    }
  };
}, rP = (e) => ({
  starColor: e.yellow6,
  starSize: e.controlHeight * 0.625,
  starSizeSM: e.controlHeightSM * 0.625,
  starSizeLG: e.controlHeightLG * 0.625,
  starHoverScale: "scale(1.1)",
  starBg: e.colorFillContent
}), oP = Xr("Rate", (e) => {
  const n = rr(e, {});
  return nP(n);
}, rP), p1 = /* @__PURE__ */ m.forwardRef((e, n) => {
  const {
    prefixCls: o,
    className: i,
    rootClassName: l,
    style: c,
    tooltips: f,
    character: p = /* @__PURE__ */ m.createElement(q_, null),
    disabled: g,
    size: h,
    ...y
  } = e, v = (z, {
    index: O = 0
  }) => {
    if (!f)
      return z;
    const j = f[O];
    return Gr(j) ? /* @__PURE__ */ m.createElement(Vi, {
      ...j
    }, z) : /* @__PURE__ */ m.createElement(Vi, {
      title: j
    }, z);
  }, {
    getPrefixCls: S,
    direction: x,
    className: b,
    style: C
  } = ei("rate"), E = S("rate", o), [$, k] = oP(E), P = {
    ...C,
    ...c
  }, R = m.useContext(al), M = g ?? R, I = yc((z) => h ?? z);
  return /* @__PURE__ */ m.createElement(J_, {
    ref: n,
    character: p,
    characterRender: v,
    disabled: M,
    ...y,
    className: we({
      [`${E}-large`]: I === "large",
      [`${E}-small`]: I === "small"
    }, i, l, $, k, b),
    style: P,
    prefixCls: E,
    direction: x
  });
}), iP = (e) => {
  const n = e?.algorithm ? Ga(e.algorithm) : dp, o = {
    ...Bi,
    ...e?.token
  };
  return wy(o, {
    override: e?.token
  }, n, ev);
};
function sP(e) {
  const {
    sizeUnit: n,
    sizeStep: o
  } = e, i = o - 2;
  return {
    sizeXXL: n * (i + 10),
    sizeXL: n * (i + 6),
    sizeLG: n * (i + 2),
    sizeMD: n * (i + 2),
    sizeMS: n * (i + 1),
    size: n * i,
    sizeSM: n * i,
    sizeXS: n * (i - 1),
    sizeXXS: n * (i - 1)
  };
}
const lP = (e, n) => {
  const o = n ?? mc(e), i = o.fontSizeSM, l = o.controlHeight - 4;
  return {
    ...o,
    ...sP(n ?? e),
    // font
    ...Jy(i),
    // controlHeight
    controlHeight: l,
    ...Zy({
      ...o,
      controlHeight: l
    })
  };
}, Kn = (e, n) => new Pt(e).setA(n).toRgbString(), Bo = (e, n) => new Pt(e).lighten(n).toHexString(), X0 = (e) => {
  const n = hc(e, {
    theme: "dark"
  });
  return {
    1: n[0],
    2: n[1],
    3: n[2],
    4: n[3],
    5: n[6],
    6: n[5],
    7: n[4],
    8: n[6],
    9: n[5],
    10: n[4]
  };
}, aP = (e, n, o) => {
  const i = e || "#000", l = n || "#fff";
  return {
    colorBgBase: i,
    colorTextBase: l,
    colorShadow: o || "rgba(255, 255, 255, 0.2)",
    colorText: Kn(l, 0.85),
    colorTextSecondary: Kn(l, 0.65),
    colorTextTertiary: Kn(l, 0.45),
    colorTextQuaternary: Kn(l, 0.25),
    colorFill: Kn(l, 0.18),
    colorFillSecondary: Kn(l, 0.12),
    colorFillTertiary: Kn(l, 0.08),
    colorFillQuaternary: Kn(l, 0.04),
    colorBgSolid: Kn(l, 0.95),
    colorBgSolidHover: Kn(l, 1),
    colorBgSolidActive: Kn(l, 0.9),
    colorBgElevated: Bo(i, 12),
    colorBgContainer: Bo(i, 8),
    colorBgLayout: Bo(i, 0),
    colorBgSpotlight: Bo(i, 26),
    colorBgBlur: Kn(l, 0.04),
    colorBorder: Bo(i, 26),
    colorBorderDisabled: Bo(i, 26),
    colorBorderSecondary: Bo(i, 19)
  };
}, cP = (e, n) => {
  const o = Object.keys(fp).map((f) => {
    const p = hc(e[f], {
      theme: "dark"
    });
    return Array.from({
      length: 10
    }, () => 1).reduce((g, h, y) => (g[`${f}-${y + 1}`] = p[y], g[`${f}${y + 1}`] = p[y], g), {});
  }).reduce((f, p) => (f = {
    ...f,
    ...p
  }, f), {}), i = n ?? mc(e), l = Qy(e, {
    generateColorPalettes: X0,
    generateNeutralColorPalettes: aP
  }), c = Li.reduce((f, p) => {
    const g = e[p];
    if (g) {
      const h = X0(g);
      f[`${p}Hover`] = h[7], f[`${p}Active`] = h[5];
    }
    return f;
  }, {});
  return {
    ...i,
    // Dark tokens
    ...o,
    // Colors
    ...l,
    ...c,
    // Customize selected item background color
    // https://github.com/ant-design/ant-design/issues/30524#issuecomment-871961867
    colorPrimaryBg: l.colorPrimaryBorder,
    colorPrimaryBgHover: l.colorPrimaryBorderHover
  };
};
function uP() {
  const [e, n, o, i] = Gi();
  return {
    theme: e,
    token: n,
    hashId: o,
    cssVar: i
  };
}
const h1 = {
  /** Default seedToken */
  defaultSeed: sl.token,
  useToken: uP,
  defaultAlgorithm: mc,
  darkAlgorithm: cP,
  compactAlgorithm: lP,
  getDesignToken: iP,
  /**
   * @private Private variable
   * @warring 🔥 Do not use in production. 🔥
   */
  defaultConfig: sl,
  /**
   * @private Private variable
   * @warring 🔥 Do not use in production. 🔥
   */
  _internalContext: pp
};
var zs = {}, Ef = { exports: {} }, G0;
function Pp() {
  return G0 || (G0 = 1, (function(e) {
    function n(o) {
      return o && o.__esModule ? o : {
        default: o
      };
    }
    e.exports = n, e.exports.__esModule = !0, e.exports.default = e.exports;
  })(Ef)), Ef.exports;
}
var Os = {}, Y0;
function fP() {
  if (Y0) return Os;
  Y0 = 1, Object.defineProperty(Os, "__esModule", {
    value: !0
  }), Os.default = void 0;
  const e = {
    // Options
    items_per_page: "条/页",
    jump_to: "跳至",
    jump_to_confirm: "确定",
    page: "页",
    // Pagination
    prev_page: "上一页",
    next_page: "下一页",
    prev_5: "向前 5 页",
    next_5: "向后 5 页",
    prev_3: "向前 3 页",
    next_3: "向后 3 页",
    page_size: "页码"
  };
  return Os.default = e, Os;
}
var As = {}, Ls = {}, Bs = {}, Hs = {}, K0;
function dP() {
  return K0 || (K0 = 1, Object.defineProperty(Hs, "__esModule", {
    value: !0
  }), Hs.commonLocale = void 0, Hs.commonLocale = {
    yearFormat: "YYYY",
    dayFormat: "D",
    cellMeridiemFormat: "A",
    monthBeforeYear: !0
  }), Hs;
}
var Q0;
function pP() {
  if (Q0) return Bs;
  Q0 = 1, Object.defineProperty(Bs, "__esModule", {
    value: !0
  }), Bs.default = void 0;
  var e = dP();
  const n = {
    ...e.commonLocale,
    locale: "zh_CN",
    today: "今天",
    now: "此刻",
    backToToday: "返回今天",
    ok: "确定",
    timeSelect: "选择时间",
    dateSelect: "选择日期",
    weekSelect: "选择周",
    clear: "清除",
    week: "周",
    month: "月",
    year: "年",
    previousMonth: "上个月",
    nextMonth: "下个月",
    monthSelect: "选择月份",
    yearSelect: "选择年份",
    decadeSelect: "选择年代",
    previousYear: "上一年",
    nextYear: "下一年",
    previousDecade: "上一年代",
    nextDecade: "下一年代",
    previousCentury: "上一世纪",
    nextCentury: "下一世纪",
    yearFormat: "YYYY年",
    cellDateFormat: "D",
    monthBeforeYear: !1
  };
  return Bs.default = n, Bs;
}
var Ds = {}, Z0;
function m1() {
  if (Z0) return Ds;
  Z0 = 1, Object.defineProperty(Ds, "__esModule", {
    value: !0
  }), Ds.default = void 0;
  const e = {
    placeholder: "请选择时间",
    rangePlaceholder: ["开始时间", "结束时间"]
  };
  return Ds.default = e, Ds;
}
var J0;
function g1() {
  if (J0) return Ls;
  J0 = 1;
  var e = Pp().default;
  Object.defineProperty(Ls, "__esModule", {
    value: !0
  }), Ls.default = void 0;
  var n = e(pP()), o = e(/* @__PURE__ */ m1());
  const i = {
    lang: {
      placeholder: "请选择日期",
      yearPlaceholder: "请选择年份",
      quarterPlaceholder: "请选择季度",
      monthPlaceholder: "请选择月份",
      weekPlaceholder: "请选择周",
      rangePlaceholder: ["开始日期", "结束日期"],
      rangeYearPlaceholder: ["开始年份", "结束年份"],
      rangeMonthPlaceholder: ["开始月份", "结束月份"],
      rangeQuarterPlaceholder: ["开始季度", "结束季度"],
      rangeWeekPlaceholder: ["开始周", "结束周"],
      ...n.default
    },
    timePickerLocale: {
      ...o.default
    }
  };
  return i.lang.ok = "确定", Ls.default = i, Ls;
}
var ey;
function hP() {
  if (ey) return As;
  ey = 1;
  var e = Pp().default;
  Object.defineProperty(As, "__esModule", {
    value: !0
  }), As.default = void 0;
  var n = e(/* @__PURE__ */ g1());
  return As.default = n.default, As;
}
var ty;
function mP() {
  if (ty) return zs;
  ty = 1;
  var e = Pp().default;
  Object.defineProperty(zs, "__esModule", {
    value: !0
  }), zs.default = void 0;
  var n = e(fP()), o = e(/* @__PURE__ */ hP()), i = e(/* @__PURE__ */ g1()), l = e(/* @__PURE__ */ m1());
  const c = "${label}不是一个有效的${type}", f = {
    locale: "zh-cn",
    Pagination: n.default,
    DatePicker: i.default,
    TimePicker: l.default,
    Calendar: o.default,
    // locales for all components
    global: {
      placeholder: "请选择",
      close: "关闭",
      sortable: "可排序",
      show: "显示",
      hide: "隐藏"
    },
    Table: {
      filterTitle: "筛选",
      filterConfirm: "确定",
      filterReset: "重置",
      filterEmptyText: "无筛选项",
      filterCheckAll: "全选",
      filterSearchPlaceholder: "在筛选项中搜索",
      emptyText: "暂无数据",
      selectAll: "全选当页",
      selectInvert: "反选当页",
      selectNone: "清空所有",
      selectionAll: "全选所有",
      sortTitle: "排序",
      expand: "展开行",
      collapse: "关闭行",
      triggerDesc: "点击降序",
      triggerAsc: "点击升序",
      cancelSort: "取消排序"
    },
    Modal: {
      okText: "确定",
      cancelText: "取消",
      justOkText: "知道了"
    },
    Tour: {
      Next: "下一步",
      Previous: "上一步",
      Finish: "结束导览"
    },
    Popconfirm: {
      cancelText: "取消",
      okText: "确定"
    },
    Transfer: {
      titles: ["", ""],
      searchPlaceholder: "请输入搜索内容",
      itemUnit: "项",
      itemsUnit: "项",
      remove: "删除",
      selectCurrent: "全选当页",
      removeCurrent: "删除当页",
      selectAll: "全选所有",
      deselectAll: "取消全选",
      removeAll: "删除全部",
      selectInvert: "反选当页"
    },
    Upload: {
      uploading: "文件上传中",
      removeFile: "删除文件",
      uploadError: "上传错误",
      previewFile: "预览文件",
      downloadFile: "下载文件"
    },
    Empty: {
      description: "暂无数据"
    },
    Icon: {
      icon: "图标"
    },
    Text: {
      edit: "编辑",
      copy: "复制",
      copied: "复制成功",
      expand: "展开",
      collapse: "收起"
    },
    Form: {
      optional: "（可选）",
      defaultValidateMessages: {
        default: "字段验证错误${label}",
        required: "请输入${label}",
        enum: "${label}必须是其中一个[${enum}]",
        whitespace: "${label}不能为空字符",
        date: {
          format: "${label}日期格式无效",
          parse: "${label}不能转换为日期",
          invalid: "${label}是一个无效日期"
        },
        types: {
          string: c,
          method: c,
          array: c,
          object: c,
          number: c,
          date: c,
          boolean: c,
          integer: c,
          float: c,
          regexp: c,
          email: c,
          url: c,
          hex: c
        },
        string: {
          len: "${label}须为${len}个字符",
          min: "${label}最少${min}个字符",
          max: "${label}最多${max}个字符",
          range: "${label}须在${min}-${max}字符之间"
        },
        number: {
          len: "${label}必须等于${len}",
          min: "${label}最小值为${min}",
          max: "${label}最大值为${max}",
          range: "${label}须在${min}-${max}之间"
        },
        array: {
          len: "须为${len}个${label}",
          min: "最少${min}个${label}",
          max: "最多${max}个${label}",
          range: "${label}数量须在${min}-${max}之间"
        },
        pattern: {
          mismatch: "${label}与模式不匹配${pattern}"
        }
      }
    },
    QRCode: {
      expired: "二维码过期",
      refresh: "点击刷新",
      scanned: "已扫描"
    },
    ColorPicker: {
      presetEmpty: "暂无",
      transparent: "无色",
      singleColor: "单色",
      gradientColor: "渐变色"
    }
  };
  return zs.default = f, zs;
}
var $f, ny;
function gP() {
  return ny || (ny = 1, $f = /* @__PURE__ */ mP()), $f;
}
var yP = /* @__PURE__ */ gP();
const y1 = /* @__PURE__ */ nr(yP), vP = ["blue", "purple", "cyan", "green", "magenta", "pink", "red", "orange", "yellow", "volcano", "geekblue", "lime", "gold"];
function SP(e) {
  return (e + 8) / e;
}
function wP(e) {
  const n = Array.from({
    length: 10
  }).map((o, i) => {
    const l = i - 1, c = e * Math.E ** (l / 5), f = i > 1 ? Math.floor(c) : Math.ceil(c);
    return Math.floor(f / 2) * 2;
  });
  return n[1] = e, n.map((o) => ({
    size: o,
    lineHeight: SP(o)
  }));
}
const xP = {
  blue: "#1677FF",
  purple: "#722ED1",
  cyan: "#13C2C2",
  green: "#52C41A",
  magenta: "#EB2F96",
  /**
   * @deprecated Use magenta instead
   */
  pink: "#EB2F96",
  red: "#F5222D",
  orange: "#FA8C16",
  yellow: "#FADB14",
  volcano: "#FA541C",
  geekblue: "#2F54EB",
  gold: "#FAAD14",
  lime: "#A0D911"
}, CP = {}, bP = {
  aliceblue: "9ehhb",
  antiquewhite: "9sgk7",
  aqua: "1ekf",
  aquamarine: "4zsno",
  azure: "9eiv3",
  beige: "9lhp8",
  bisque: "9zg04",
  black: "0",
  blanchedalmond: "9zhe5",
  blue: "73",
  blueviolet: "5e31e",
  brown: "6g016",
  burlywood: "8ouiv",
  cadetblue: "3qba8",
  chartreuse: "4zshs",
  chocolate: "87k0u",
  coral: "9yvyo",
  cornflowerblue: "3xael",
  cornsilk: "9zjz0",
  crimson: "8l4xo",
  cyan: "1ekf",
  darkblue: "3v",
  darkcyan: "rkb",
  darkgoldenrod: "776yz",
  darkgray: "6mbhl",
  darkgreen: "jr4",
  darkgrey: "6mbhl",
  darkkhaki: "7ehkb",
  darkmagenta: "5f91n",
  darkolivegreen: "3bzfz",
  darkorange: "9yygw",
  darkorchid: "5z6x8",
  darkred: "5f8xs",
  darksalmon: "9441m",
  darkseagreen: "5lwgf",
  darkslateblue: "2th1n",
  darkslategray: "1ugcv",
  darkslategrey: "1ugcv",
  darkturquoise: "14up",
  darkviolet: "5rw7n",
  deeppink: "9yavn",
  deepskyblue: "11xb",
  dimgray: "442g9",
  dimgrey: "442g9",
  dodgerblue: "16xof",
  firebrick: "6y7tu",
  floralwhite: "9zkds",
  forestgreen: "1cisi",
  fuchsia: "9y70f",
  gainsboro: "8m8kc",
  ghostwhite: "9pq0v",
  goldenrod: "8j4f4",
  gold: "9zda8",
  gray: "50i2o",
  green: "pa8",
  greenyellow: "6senj",
  grey: "50i2o",
  honeydew: "9eiuo",
  hotpink: "9yrp0",
  indianred: "80gnw",
  indigo: "2xcoy",
  ivory: "9zldc",
  khaki: "9edu4",
  lavenderblush: "9ziet",
  lavender: "90c8q",
  lawngreen: "4vk74",
  lemonchiffon: "9zkct",
  lightblue: "6s73a",
  lightcoral: "9dtog",
  lightcyan: "8s1rz",
  lightgoldenrodyellow: "9sjiq",
  lightgray: "89jo3",
  lightgreen: "5nkwg",
  lightgrey: "89jo3",
  lightpink: "9z6wx",
  lightsalmon: "9z2ii",
  lightseagreen: "19xgq",
  lightskyblue: "5arju",
  lightslategray: "4nwk9",
  lightslategrey: "4nwk9",
  lightsteelblue: "6wau6",
  lightyellow: "9zlcw",
  lime: "1edc",
  limegreen: "1zcxe",
  linen: "9shk6",
  magenta: "9y70f",
  maroon: "4zsow",
  mediumaquamarine: "40eju",
  mediumblue: "5p",
  mediumorchid: "79qkz",
  mediumpurple: "5r3rv",
  mediumseagreen: "2d9ip",
  mediumslateblue: "4tcku",
  mediumspringgreen: "1di2",
  mediumturquoise: "2uabw",
  mediumvioletred: "7rn9h",
  midnightblue: "z980",
  mintcream: "9ljp6",
  mistyrose: "9zg0x",
  moccasin: "9zfzp",
  navajowhite: "9zest",
  navy: "3k",
  oldlace: "9wq92",
  olive: "50hz4",
  olivedrab: "472ub",
  orange: "9z3eo",
  orangered: "9ykg0",
  orchid: "8iu3a",
  palegoldenrod: "9bl4a",
  palegreen: "5yw0o",
  paleturquoise: "6v4ku",
  palevioletred: "8k8lv",
  papayawhip: "9zi6t",
  peachpuff: "9ze0p",
  peru: "80oqn",
  pink: "9z8wb",
  plum: "8nba5",
  powderblue: "6wgdi",
  purple: "4zssg",
  rebeccapurple: "3zk49",
  red: "9y6tc",
  rosybrown: "7cv4f",
  royalblue: "2jvtt",
  saddlebrown: "5fmkz",
  salmon: "9rvci",
  sandybrown: "9jn1c",
  seagreen: "1tdnb",
  seashell: "9zje6",
  sienna: "6973h",
  silver: "7ir40",
  skyblue: "5arjf",
  slateblue: "45e4t",
  slategray: "4e100",
  slategrey: "4e100",
  snow: "9zke2",
  springgreen: "1egv",
  steelblue: "2r1kk",
  tan: "87yx8",
  teal: "pds",
  thistle: "8ggk8",
  tomato: "9yqfb",
  turquoise: "2j4r4",
  violet: "9b10u",
  wheat: "9ld4j",
  white: "9zldr",
  whitesmoke: "9lhpx",
  yellow: "9zl6o",
  yellowgreen: "61fzm"
}, Wt = Math.round;
function _f(e, n) {
  const o = e.replace(/^[^(]*\((.*)/, "$1").replace(/\).*/, "").match(/\d*\.?\d+%?/g) || [], i = o.map((l) => parseFloat(l));
  for (let l = 0; l < 3; l += 1)
    i[l] = n(i[l] || 0, o[l] || "", l);
  return o[3] ? i[3] = o[3].includes("%") ? i[3] / 100 : i[3] : i[3] = 1, i;
}
const ry = (e, n, o) => o === 0 ? e : e / 100;
function js(e, n) {
  const o = n || 255;
  return e > o ? o : e < 0 ? 0 : e;
}
class mr {
  /**
   * All FastColor objects are valid. So isValid is always true. This property is kept to be compatible with TinyColor.
   */
  isValid = !0;
  /**
   * Red, R in RGB
   */
  r = 0;
  /**
   * Green, G in RGB
   */
  g = 0;
  /**
   * Blue, B in RGB
   */
  b = 0;
  /**
   * Alpha/Opacity, A in RGBA/HSLA
   */
  a = 1;
  // HSV privates
  _h;
  _hsl_s;
  _hsv_s;
  _l;
  _v;
  // intermediate variables to calculate HSL/HSV
  _max;
  _min;
  _brightness;
  constructor(n) {
    function o(i) {
      return i[0] in n && i[1] in n && i[2] in n;
    }
    if (n) if (typeof n == "string") {
      let l = function(c) {
        return i.startsWith(c);
      };
      const i = n.trim();
      if (/^#?[A-F\d]{3,8}$/i.test(i))
        this.fromHexString(i);
      else if (l("rgb"))
        this.fromRgbString(i);
      else if (l("hsl"))
        this.fromHslString(i);
      else if (l("hsv") || l("hsb"))
        this.fromHsvString(i);
      else {
        const c = bP[i.toLowerCase()];
        c && this.fromHexString(
          // Convert 36 hex to 16 hex
          parseInt(c, 36).toString(16).padStart(6, "0")
        );
      }
    } else if (n instanceof mr)
      this.r = n.r, this.g = n.g, this.b = n.b, this.a = n.a, this._h = n._h, this._hsl_s = n._hsl_s, this._hsv_s = n._hsv_s, this._l = n._l, this._v = n._v;
    else if (o("rgb"))
      this.r = js(n.r), this.g = js(n.g), this.b = js(n.b), this.a = typeof n.a == "number" ? js(n.a, 1) : 1;
    else if (o("hsl"))
      this.fromHsl(n);
    else if (o("hsv"))
      this.fromHsv(n);
    else
      throw new Error("@ant-design/fast-color: unsupported input " + JSON.stringify(n));
  }
  // ======================= Setter =======================
  setR(n) {
    return this._sc("r", n);
  }
  setG(n) {
    return this._sc("g", n);
  }
  setB(n) {
    return this._sc("b", n);
  }
  setA(n) {
    return this._sc("a", n, 1);
  }
  setHue(n) {
    const o = this.toHsv();
    return o.h = n, this._c(o);
  }
  // ======================= Getter =======================
  /**
   * Returns the perceived luminance of a color, from 0-1.
   * @see http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
   */
  getLuminance() {
    function n(c) {
      const f = c / 255;
      return f <= 0.03928 ? f / 12.92 : Math.pow((f + 0.055) / 1.055, 2.4);
    }
    const o = n(this.r), i = n(this.g), l = n(this.b);
    return 0.2126 * o + 0.7152 * i + 0.0722 * l;
  }
  getHue() {
    if (typeof this._h > "u") {
      const n = this.getMax() - this.getMin();
      n === 0 ? this._h = 0 : this._h = Wt(60 * (this.r === this.getMax() ? (this.g - this.b) / n + (this.g < this.b ? 6 : 0) : this.g === this.getMax() ? (this.b - this.r) / n + 2 : (this.r - this.g) / n + 4));
    }
    return this._h;
  }
  /**
   * @deprecated should use getHSVSaturation or getHSLSaturation instead
   */
  getSaturation() {
    return this.getHSVSaturation();
  }
  getHSVSaturation() {
    if (typeof this._hsv_s > "u") {
      const n = this.getMax() - this.getMin();
      n === 0 ? this._hsv_s = 0 : this._hsv_s = n / this.getMax();
    }
    return this._hsv_s;
  }
  getHSLSaturation() {
    if (typeof this._hsl_s > "u") {
      const n = this.getMax() - this.getMin();
      if (n === 0)
        this._hsl_s = 0;
      else {
        const o = this.getLightness();
        this._hsl_s = n / 255 / (1 - Math.abs(2 * o - 1));
      }
    }
    return this._hsl_s;
  }
  getLightness() {
    return typeof this._l > "u" && (this._l = (this.getMax() + this.getMin()) / 510), this._l;
  }
  getValue() {
    return typeof this._v > "u" && (this._v = this.getMax() / 255), this._v;
  }
  /**
   * Returns the perceived brightness of the color, from 0-255.
   * Note: this is not the b of HSB
   * @see http://www.w3.org/TR/AERT#color-contrast
   */
  getBrightness() {
    return typeof this._brightness > "u" && (this._brightness = (this.r * 299 + this.g * 587 + this.b * 114) / 1e3), this._brightness;
  }
  // ======================== Func ========================
  darken(n = 10) {
    const o = this.getHue(), i = this.getSaturation();
    let l = this.getLightness() - n / 100;
    return l < 0 && (l = 0), this._c({
      h: o,
      s: i,
      l,
      a: this.a
    });
  }
  lighten(n = 10) {
    const o = this.getHue(), i = this.getSaturation();
    let l = this.getLightness() + n / 100;
    return l > 1 && (l = 1), this._c({
      h: o,
      s: i,
      l,
      a: this.a
    });
  }
  /**
   * Mix the current color a given amount with another color, from 0 to 100.
   * 0 means no mixing (return current color).
   */
  mix(n, o = 50) {
    const i = this._c(n), l = o / 100, c = (p) => (i[p] - this[p]) * l + this[p], f = {
      r: Wt(c("r")),
      g: Wt(c("g")),
      b: Wt(c("b")),
      a: Wt(c("a") * 100) / 100
    };
    return this._c(f);
  }
  /**
   * Mix the color with pure white, from 0 to 100.
   * Providing 0 will do nothing, providing 100 will always return white.
   */
  tint(n = 10) {
    return this.mix({
      r: 255,
      g: 255,
      b: 255,
      a: 1
    }, n);
  }
  /**
   * Mix the color with pure black, from 0 to 100.
   * Providing 0 will do nothing, providing 100 will always return black.
   */
  shade(n = 10) {
    return this.mix({
      r: 0,
      g: 0,
      b: 0,
      a: 1
    }, n);
  }
  onBackground(n) {
    const o = this._c(n), i = this.a + o.a * (1 - this.a), l = (c) => Wt((this[c] * this.a + o[c] * o.a * (1 - this.a)) / i);
    return this._c({
      r: l("r"),
      g: l("g"),
      b: l("b"),
      a: i
    });
  }
  // ======================= Status =======================
  isDark() {
    return this.getBrightness() < 128;
  }
  isLight() {
    return this.getBrightness() >= 128;
  }
  // ======================== MISC ========================
  equals(n) {
    return this.r === n.r && this.g === n.g && this.b === n.b && this.a === n.a;
  }
  clone() {
    return this._c(this);
  }
  // ======================= Format =======================
  toHexString() {
    let n = "#";
    const o = (this.r || 0).toString(16);
    n += o.length === 2 ? o : "0" + o;
    const i = (this.g || 0).toString(16);
    n += i.length === 2 ? i : "0" + i;
    const l = (this.b || 0).toString(16);
    if (n += l.length === 2 ? l : "0" + l, typeof this.a == "number" && this.a >= 0 && this.a < 1) {
      const c = Wt(this.a * 255).toString(16);
      n += c.length === 2 ? c : "0" + c;
    }
    return n;
  }
  /** CSS support color pattern */
  toHsl() {
    return {
      h: this.getHue(),
      s: this.getHSLSaturation(),
      l: this.getLightness(),
      a: this.a
    };
  }
  /** CSS support color pattern */
  toHslString() {
    const n = this.getHue(), o = Wt(this.getHSLSaturation() * 100), i = Wt(this.getLightness() * 100);
    return this.a !== 1 ? `hsla(${n},${o}%,${i}%,${this.a})` : `hsl(${n},${o}%,${i}%)`;
  }
  /** Same as toHsb */
  toHsv() {
    return {
      h: this.getHue(),
      s: this.getHSVSaturation(),
      v: this.getValue(),
      a: this.a
    };
  }
  toRgb() {
    return {
      r: this.r,
      g: this.g,
      b: this.b,
      a: this.a
    };
  }
  toRgbString() {
    return this.a !== 1 ? `rgba(${this.r},${this.g},${this.b},${this.a})` : `rgb(${this.r},${this.g},${this.b})`;
  }
  toString() {
    return this.toRgbString();
  }
  // ====================== Privates ======================
  /** Return a new FastColor object with one channel changed */
  _sc(n, o, i) {
    const l = this.clone();
    return l[n] = js(o, i), l;
  }
  _c(n) {
    return new this.constructor(n);
  }
  getMax() {
    return typeof this._max > "u" && (this._max = Math.max(this.r, this.g, this.b)), this._max;
  }
  getMin() {
    return typeof this._min > "u" && (this._min = Math.min(this.r, this.g, this.b)), this._min;
  }
  fromHexString(n) {
    const o = n.replace("#", "");
    function i(l, c) {
      return parseInt(o[l] + o[c || l], 16);
    }
    o.length < 6 ? (this.r = i(0), this.g = i(1), this.b = i(2), this.a = o[3] ? i(3) / 255 : 1) : (this.r = i(0, 1), this.g = i(2, 3), this.b = i(4, 5), this.a = o[6] ? i(6, 7) / 255 : 1);
  }
  fromHsl({
    h: n,
    s: o,
    l: i,
    a: l
  }) {
    const c = (n % 360 + 360) % 360;
    if (this._h = c, this._hsl_s = o, this._l = i, this.a = typeof l == "number" ? l : 1, o <= 0) {
      const x = Wt(i * 255);
      this.r = x, this.g = x, this.b = x;
      return;
    }
    let f = 0, p = 0, g = 0;
    const h = c / 60, y = (1 - Math.abs(2 * i - 1)) * o, v = y * (1 - Math.abs(h % 2 - 1));
    h >= 0 && h < 1 ? (f = y, p = v) : h >= 1 && h < 2 ? (f = v, p = y) : h >= 2 && h < 3 ? (p = y, g = v) : h >= 3 && h < 4 ? (p = v, g = y) : h >= 4 && h < 5 ? (f = v, g = y) : h >= 5 && h < 6 && (f = y, g = v);
    const S = i - y / 2;
    this.r = Wt((f + S) * 255), this.g = Wt((p + S) * 255), this.b = Wt((g + S) * 255);
  }
  fromHsv({
    h: n,
    s: o,
    v: i,
    a: l
  }) {
    const c = (n % 360 + 360) % 360;
    this._h = c, this._hsv_s = o, this._v = i, this.a = typeof l == "number" ? l : 1;
    const f = Wt(i * 255);
    if (this.r = f, this.g = f, this.b = f, o <= 0)
      return;
    const p = c / 60, g = Math.floor(p), h = p - g, y = Wt(i * (1 - o) * 255), v = Wt(i * (1 - o * h) * 255), S = Wt(i * (1 - o * (1 - h)) * 255);
    switch (g) {
      case 0:
        this.g = S, this.b = y;
        break;
      case 1:
        this.r = v, this.b = y;
        break;
      case 2:
        this.r = y, this.b = S;
        break;
      case 3:
        this.r = y, this.g = v;
        break;
      case 4:
        this.r = S, this.g = y;
        break;
      default:
        this.g = y, this.b = v;
        break;
    }
  }
  fromHsvString(n) {
    const o = _f(n, ry);
    this.fromHsv({
      h: o[0],
      s: o[1],
      v: o[2],
      a: o[3]
    });
  }
  fromHslString(n) {
    const o = _f(n, ry);
    this.fromHsl({
      h: o[0],
      s: o[1],
      l: o[2],
      a: o[3]
    });
  }
  fromRgbString(n) {
    const o = _f(n, (i, l) => (
      // Convert percentage to number. e.g. 50% -> 128
      l.includes("%") ? Wt(i / 100 * 255) : i
    ));
    this.r = o[0], this.g = o[1], this.b = o[2], this.a = o[3];
  }
}
const La = 2, oy = 0.16, EP = 0.05, $P = 0.05, _P = 0.15, v1 = 5, S1 = 4, PP = [{
  index: 7,
  amount: 15
}, {
  index: 6,
  amount: 25
}, {
  index: 5,
  amount: 30
}, {
  index: 5,
  amount: 45
}, {
  index: 5,
  amount: 65
}, {
  index: 5,
  amount: 85
}, {
  index: 4,
  amount: 90
}, {
  index: 3,
  amount: 95
}, {
  index: 2,
  amount: 97
}, {
  index: 1,
  amount: 98
}];
function iy(e, n, o) {
  let i;
  return Math.round(e.h) >= 60 && Math.round(e.h) <= 240 ? i = o ? Math.round(e.h) - La * n : Math.round(e.h) + La * n : i = o ? Math.round(e.h) + La * n : Math.round(e.h) - La * n, i < 0 ? i += 360 : i >= 360 && (i -= 360), i;
}
function sy(e, n, o) {
  if (e.h === 0 && e.s === 0)
    return e.s;
  let i;
  return o ? i = e.s - oy * n : n === S1 ? i = e.s + oy : i = e.s + EP * n, i > 1 && (i = 1), o && n === v1 && i > 0.1 && (i = 0.1), i < 0.06 && (i = 0.06), Math.round(i * 100) / 100;
}
function ly(e, n, o) {
  let i;
  return o ? i = e.v + $P * n : i = e.v - _P * n, i = Math.max(0, Math.min(1, i)), Math.round(i * 100) / 100;
}
function w1(e, n = {}) {
  const o = [], i = new mr(e), l = i.toHsv();
  for (let c = v1; c > 0; c -= 1) {
    const f = new mr({
      h: iy(l, c, !0),
      s: sy(l, c, !0),
      v: ly(l, c, !0)
    });
    o.push(f);
  }
  o.push(i);
  for (let c = 1; c <= S1; c += 1) {
    const f = new mr({
      h: iy(l, c),
      s: sy(l, c),
      v: ly(l, c)
    });
    o.push(f);
  }
  return n.theme === "dark" ? PP.map(({
    index: c,
    amount: f
  }) => new mr(n.backgroundColor || "#141414").mix(o[c], f).toHexString()) : o.map((c) => c.toHexString());
}
const Pf = {
  red: "#F5222D",
  volcano: "#FA541C",
  orange: "#FA8C16",
  gold: "#FAAD14",
  yellow: "#FADB14",
  lime: "#A0D911",
  green: "#52C41A",
  cyan: "#13C2C2",
  blue: "#1677FF",
  geekblue: "#2F54EB",
  purple: "#722ED1",
  magenta: "#EB2F96",
  grey: "#666666"
}, Ad = ["#fff1f0", "#ffccc7", "#ffa39e", "#ff7875", "#ff4d4f", "#f5222d", "#cf1322", "#a8071a", "#820014", "#5c0011"];
Ad.primary = Ad[5];
const Ld = ["#fff2e8", "#ffd8bf", "#ffbb96", "#ff9c6e", "#ff7a45", "#fa541c", "#d4380d", "#ad2102", "#871400", "#610b00"];
Ld.primary = Ld[5];
const Bd = ["#fff7e6", "#ffe7ba", "#ffd591", "#ffc069", "#ffa940", "#fa8c16", "#d46b08", "#ad4e00", "#873800", "#612500"];
Bd.primary = Bd[5];
const Hd = ["#fffbe6", "#fff1b8", "#ffe58f", "#ffd666", "#ffc53d", "#faad14", "#d48806", "#ad6800", "#874d00", "#613400"];
Hd.primary = Hd[5];
const Dd = ["#feffe6", "#ffffb8", "#fffb8f", "#fff566", "#ffec3d", "#fadb14", "#d4b106", "#ad8b00", "#876800", "#614700"];
Dd.primary = Dd[5];
const jd = ["#fcffe6", "#f4ffb8", "#eaff8f", "#d3f261", "#bae637", "#a0d911", "#7cb305", "#5b8c00", "#3f6600", "#254000"];
jd.primary = jd[5];
const Vd = ["#f6ffed", "#d9f7be", "#b7eb8f", "#95de64", "#73d13d", "#52c41a", "#389e0d", "#237804", "#135200", "#092b00"];
Vd.primary = Vd[5];
const Wd = ["#e6fffb", "#b5f5ec", "#87e8de", "#5cdbd3", "#36cfc9", "#13c2c2", "#08979c", "#006d75", "#00474f", "#002329"];
Wd.primary = Wd[5];
const qd = ["#e6f4ff", "#bae0ff", "#91caff", "#69b1ff", "#4096ff", "#1677ff", "#0958d9", "#003eb3", "#002c8c", "#001d66"];
qd.primary = qd[5];
const Ud = ["#f0f5ff", "#d6e4ff", "#adc6ff", "#85a5ff", "#597ef7", "#2f54eb", "#1d39c4", "#10239e", "#061178", "#030852"];
Ud.primary = Ud[5];
const Xd = ["#f9f0ff", "#efdbff", "#d3adf7", "#b37feb", "#9254de", "#722ed1", "#531dab", "#391085", "#22075e", "#120338"];
Xd.primary = Xd[5];
const Gd = ["#fff0f6", "#ffd6e7", "#ffadd2", "#ff85c0", "#f759ab", "#eb2f96", "#c41d7f", "#9e1068", "#780650", "#520339"];
Gd.primary = Gd[5];
const Yd = ["#a6a6a6", "#999999", "#8c8c8c", "#808080", "#737373", "#666666", "#404040", "#1a1a1a", "#000000", "#000000"];
Yd.primary = Yd[5];
const Rf = {
  red: Ad,
  volcano: Ld,
  orange: Bd,
  gold: Hd,
  yellow: Dd,
  lime: jd,
  green: Vd,
  cyan: Wd,
  blue: qd,
  geekblue: Ud,
  purple: Xd,
  magenta: Gd,
  grey: Yd
};
function RP(e, {
  generateColorPalettes: n,
  generateNeutralColorPalettes: o
}) {
  const {
    colorSuccess: i,
    colorWarning: l,
    colorError: c,
    colorInfo: f,
    colorPrimary: p,
    colorBgBase: g,
    colorTextBase: h
  } = e, y = n(p), v = n(i), S = n(l), x = n(c), b = n(f), C = o(g, h), E = e.colorLink || e.colorInfo, $ = n(E), k = new mr(x[1]).mix(new mr(x[3]), 50).toHexString(), P = {};
  return vP.forEach((R) => {
    const M = e[R];
    if (M) {
      const I = n(M);
      P[`${R}Hover`] = I[5], P[`${R}Active`] = I[7];
    }
  }), {
    ...C,
    colorPrimaryBg: y[1],
    colorPrimaryBgHover: y[2],
    colorPrimaryBorder: y[3],
    colorPrimaryBorderHover: y[4],
    colorPrimaryHover: y[5],
    colorPrimary: y[6],
    colorPrimaryActive: y[7],
    colorPrimaryTextHover: y[8],
    colorPrimaryText: y[9],
    colorPrimaryTextActive: y[10],
    colorSuccessBg: v[1],
    colorSuccessBgHover: v[2],
    colorSuccessBorder: v[3],
    colorSuccessBorderHover: v[4],
    colorSuccessHover: v[4],
    colorSuccess: v[6],
    colorSuccessActive: v[7],
    colorSuccessTextHover: v[8],
    colorSuccessText: v[9],
    colorSuccessTextActive: v[10],
    colorErrorBg: x[1],
    colorErrorBgHover: x[2],
    colorErrorBgFilledHover: k,
    colorErrorBgActive: x[3],
    colorErrorBorder: x[3],
    colorErrorBorderHover: x[4],
    colorErrorHover: x[5],
    colorError: x[6],
    colorErrorActive: x[7],
    colorErrorTextHover: x[8],
    colorErrorText: x[9],
    colorErrorTextActive: x[10],
    colorWarningBg: S[1],
    colorWarningBgHover: S[2],
    colorWarningBorder: S[3],
    colorWarningBorderHover: S[4],
    colorWarningHover: S[4],
    colorWarning: S[6],
    colorWarningActive: S[7],
    colorWarningTextHover: S[8],
    colorWarningText: S[9],
    colorWarningTextActive: S[10],
    colorInfoBg: b[1],
    colorInfoBgHover: b[2],
    colorInfoBorder: b[3],
    colorInfoBorderHover: b[4],
    colorInfoHover: b[4],
    colorInfo: b[6],
    colorInfoActive: b[7],
    colorInfoTextHover: b[8],
    colorInfoText: b[9],
    colorInfoTextActive: b[10],
    colorLinkHover: $[4],
    colorLink: $[6],
    colorLinkActive: $[7],
    ...P,
    colorBgMask: new mr("#000").setA(0.45).toRgbString(),
    colorWhite: "#fff"
  };
}
const kP = (e) => {
  let n = e, o = e, i = e, l = e;
  return e < 6 && e >= 5 ? n = e + 1 : e < 16 && e >= 6 ? n = e + 2 : e >= 16 && (n = 16), e < 7 && e >= 5 ? o = 4 : e < 8 && e >= 7 ? o = 5 : e < 14 && e >= 8 ? o = 6 : e < 16 && e >= 14 ? o = 7 : e >= 16 && (o = 8), e < 6 && e >= 2 ? i = 1 : e >= 6 && (i = 2), e > 4 && e < 8 ? l = 4 : e >= 8 && (l = 6), {
    borderRadius: e,
    borderRadiusXS: i,
    borderRadiusSM: o,
    borderRadiusLG: n,
    borderRadiusOuter: l
  };
};
function MP(e) {
  const {
    motionUnit: n,
    motionBase: o,
    borderRadius: i,
    lineWidth: l
  } = e;
  return {
    // motion
    motionDurationFast: `${(o + n).toFixed(1)}s`,
    motionDurationMid: `${(o + n * 2).toFixed(1)}s`,
    motionDurationSlow: `${(o + n * 3).toFixed(1)}s`,
    // line
    lineWidthBold: l + 1,
    // radius
    ...kP(i)
  };
}
const TP = (e) => {
  const {
    controlHeight: n
  } = e;
  return {
    controlHeightSM: n * 0.75,
    controlHeightXS: n * 0.5,
    controlHeightLG: n * 1.25
  };
}, NP = (e) => {
  const n = wP(e), o = n.map((y) => y.size), i = n.map((y) => y.lineHeight), l = o[1], c = o[0], f = o[2], p = i[1], g = i[0], h = i[2];
  return {
    fontSizeSM: c,
    fontSize: l,
    fontSizeLG: f,
    fontSizeXL: o[3],
    fontSizeHeading1: o[6],
    fontSizeHeading2: o[5],
    fontSizeHeading3: o[4],
    fontSizeHeading4: o[3],
    fontSizeHeading5: o[2],
    lineHeight: p,
    lineHeightLG: h,
    lineHeightSM: g,
    fontHeight: Math.round(p * l),
    fontHeightLG: Math.round(h * f),
    fontHeightSM: Math.round(g * c),
    lineHeightHeading1: i[6],
    lineHeightHeading2: i[5],
    lineHeightHeading3: i[4],
    lineHeightHeading4: i[3],
    lineHeightHeading5: i[2]
  };
};
function IP(e) {
  const {
    sizeUnit: n,
    sizeStep: o
  } = e;
  return {
    sizeXXL: n * (o + 8),
    // 48
    sizeXL: n * (o + 4),
    // 32
    sizeLG: n * (o + 2),
    // 24
    sizeMD: n * (o + 1),
    // 20
    sizeMS: n * o,
    // 16
    size: n * o,
    // 16
    sizeSM: n * (o - 1),
    // 12
    sizeXS: n * (o - 2),
    // 8
    sizeXXS: n * (o - 3)
    // 4
  };
}
const Qn = (e, n) => new mr(e).setA(n).toRgbString(), Ni = (e, n) => new mr(e).darken(n).toHexString(), FP = (e) => {
  const n = w1(e);
  return {
    1: n[0],
    2: n[1],
    3: n[2],
    4: n[3],
    5: n[4],
    6: n[5],
    7: n[6],
    8: n[4],
    9: n[5],
    10: n[6]
  };
}, zP = (e, n, o) => {
  const i = e || "#fff", l = n || "#000";
  return {
    colorBgBase: i,
    colorTextBase: l,
    colorShadow: o || "#000",
    colorText: Qn(l, 0.88),
    colorTextSecondary: Qn(l, 0.65),
    colorTextTertiary: Qn(l, 0.45),
    colorTextQuaternary: Qn(l, 0.25),
    colorFill: Qn(l, 0.15),
    colorFillSecondary: Qn(l, 0.06),
    colorFillTertiary: Qn(l, 0.04),
    colorFillQuaternary: Qn(l, 0.02),
    colorBgSolid: Qn(l, 1),
    colorBgSolidHover: Qn(l, 0.75),
    colorBgSolidActive: Qn(l, 0.95),
    colorBgLayout: Ni(i, 4),
    colorBgContainer: Ni(i, 0),
    colorBgElevated: Ni(i, 0),
    colorBgSpotlight: Qn(l, 0.85),
    colorBgBlur: "transparent",
    colorBorder: Ni(i, 15),
    colorBorderDisabled: Ni(i, 15),
    colorBorderSecondary: Ni(i, 6)
  };
};
function OP(e) {
  Pf.pink = Pf.magenta, Rf.pink = Rf.magenta;
  const n = Object.keys(xP).map((o) => {
    const i = e[o] === Pf[o] ? Rf[o] : w1(e[o]);
    return Array.from({
      length: 10
    }, () => 1).reduce((l, c, f) => (l[`${o}-${f + 1}`] = i[f], l[`${o}${f + 1}`] = i[f], l), {});
  }).reduce((o, i) => (o = {
    ...o,
    ...i
  }, o), {});
  return {
    ...e,
    ...n,
    // Colors
    ...RP(e, {
      generateColorPalettes: FP,
      generateNeutralColorPalettes: zP
    }),
    // Font
    ...NP(e.fontSize),
    // Size
    ...IP(e),
    // Height
    ...TP(e),
    // Others
    ...MP(e)
  };
}
const AP = {
  token: CP
}, LP = {
  /** Default seedToken */
  defaultSeed: AP.token,
  defaultAlgorithm: OP
}, x1 = {
  algorithm: LP.defaultAlgorithm,
  token: {
    // ---- 颜色 ----
    colorPrimary: "#0a84ff",
    colorInfo: "#0a84ff",
    colorLink: "#0a84ff",
    colorPrimaryHover: "#3395ff",
    colorPrimaryActive: "#0060df",
    colorPrimaryBg: "rgba(10,132,255,0.08)",
    colorPrimaryBgHover: "rgba(10,132,255,0.12)",
    colorPrimaryBorder: "rgba(10,132,255,0.35)",
    colorSuccess: "#34c759",
    colorSuccessBg: "rgba(52,199,89,0.10)",
    colorWarning: "#ff9f0a",
    colorWarningBg: "rgba(255,159,10,0.10)",
    colorError: "#ff3b30",
    colorErrorBg: "rgba(255,59,48,0.10)",
    colorTextBase: "#1d1d1f",
    colorTextSecondary: "#6e6e73",
    colorTextTertiary: "#86868b",
    colorTextQuaternary: "#c7c7cc",
    colorBgBase: "#f5f5f7",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBgLayout: "#f5f5f7",
    colorBgSpotlight: "#3a3a3c",
    colorBorder: "rgba(0,0,0,0.10)",
    colorBorderSecondary: "rgba(0,0,0,0.06)",
    colorSplit: "rgba(0,0,0,0.06)",
    colorFillSecondary: "rgba(0,0,0,0.05)",
    colorFillTertiary: "rgba(0,0,0,0.03)",
    colorFillQuaternary: "rgba(0,0,0,0.02)",
    // iOS 系统灰阶（浅色模式）：系统灰 #8e8e93 / 系统灰5 #e5e5ea / 系统灰6 #f2f2f7
    colorTextPlaceholder: "#8e8e93",
    colorTextDisabled: "#c7c7cc",
    colorBgMask: "rgba(0,0,0,0.25)",
    // ---- 字体 ----
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif',
    fontFamilyCode: '"SF Mono", "JetBrains Mono", "Menlo", "Consolas", "PingFang SC", monospace',
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 20,
    fontSizeHeading1: 34,
    fontSizeHeading2: 28,
    fontSizeHeading3: 22,
    fontSizeHeading4: 20,
    fontSizeHeading5: 17,
    lineHeight: 1.5,
    fontWeightStrong: 600,
    // ---- 圆角 ----
    borderRadius: 10,
    borderRadiusLG: 12,
    borderRadiusSM: 8,
    borderRadiusXS: 6,
    // ---- 尺寸 ----
    controlHeight: 36,
    controlHeightSM: 28,
    controlHeightLG: 44,
    controlOutline: "rgba(10,132,255,0.35)",
    controlOutlineWidth: 2,
    // ---- 阴影（分层柔和阴影）----
    boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)",
    boxShadowSecondary: "0 2px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.10)",
    boxShadowTertiary: "0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.05)",
    // ---- 动效 ----
    motionDurationFast: "0.15s",
    motionDurationMid: "0.25s",
    motionDurationSlow: "0.4s",
    motionEaseInOut: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    motionEaseOut: "cubic-bezier(0.22, 1, 0.36, 1)"
  },
  components: {
    // ---- 按钮：白底灰边，主按钮蓝 ----
    Button: {
      borderRadius: 8,
      borderRadiusSM: 7,
      borderRadiusLG: 10,
      contentFontSize: 14,
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
      defaultBorderColor: "rgba(0,0,0,0.12)",
      defaultBg: "#ffffff",
      defaultColor: "#1d1d1f",
      defaultHoverBg: "#f5f5f7",
      defaultActiveBg: "#ebebed",
      textHoverBg: "rgba(0,0,0,0.05)",
      primaryColor: "#ffffff",
      paddingInline: 16,
      paddingInlineLG: 20,
      paddingInlineSM: 12,
      onlyIconSize: 18
    },
    // ---- 输入：浅灰底圆角，聚焦白底蓝环 ----
    Input: {
      colorBgContainer: "#f2f2f7",
      colorBorder: "transparent",
      hoverBorderColor: "rgba(0,0,0,0.15)",
      activeBorderColor: "#0a84ff",
      activeShadow: "0 0 0 3px rgba(10,132,255,0.25)",
      hoverBg: "#e5e5ea",
      activeBg: "#ffffff",
      borderRadius: 10,
      borderRadiusLG: 10,
      paddingInline: 12
    },
    // ---- 选择器：浅灰底，弹层白底圆角 ----
    Select: {
      selectorBg: "#f2f2f7",
      hoverBorderColor: "rgba(0,0,0,0.15)",
      activeBorderColor: "#0a84ff",
      optionSelectedBg: "rgba(10,132,255,0.10)",
      optionActiveBg: "rgba(0,0,0,0.05)",
      optionSelectedFontWeight: 600,
      borderRadius: 8,
      borderRadiusLG: 10
    },
    // ---- 弹窗：无边框白底大圆角 ----
    Modal: {
      borderRadiusLG: 14,
      titleFontSize: 17,
      titleColor: "#1d1d1f",
      contentBg: "#ffffff",
      headerBg: "transparent",
      footerBg: "transparent"
    },
    // ---- 卡片：无边框圆角浅阴影 ----
    Card: {
      borderRadiusLG: 12,
      headerFontSize: 15,
      headerBg: "transparent",
      bodyPadding: 20,
      headerPadding: 16
    },
    // ---- 表格：去边框、行 hover 浅灰 ----
    Table: {
      headerBg: "transparent",
      headerColor: "#6e6e73",
      headerSplitColor: "transparent",
      borderColor: "rgba(0,0,0,0.06)",
      rowHoverBg: "rgba(0,0,0,0.03)",
      rowSelectedBg: "rgba(10,132,255,0.10)",
      rowSelectedHoverBg: "rgba(10,132,255,0.14)",
      cellPaddingBlock: 14,
      cellFontSize: 13,
      headerBorderRadius: 8
    },
    // ---- 菜单：弹层白底圆角，选中浅蓝 ----
    Menu: {
      itemBorderRadius: 8,
      itemColor: "#1d1d1f",
      itemHoverBg: "rgba(0,0,0,0.05)",
      itemSelectedBg: "rgba(10,132,255,0.10)",
      itemSelectedColor: "#0a84ff",
      subMenuItemBg: "transparent",
      itemMarginInline: 4,
      itemHeight: 34,
      popupBg: "rgba(255,255,255,0.96)"
    },
    // ---- 分段控件：iOS 轨道灰 + 白色浮块 ----
    Segmented: {
      trackBg: "#f2f2f7",
      trackPadding: 2,
      itemColor: "#6e6e73",
      itemHoverColor: "#1d1d1f",
      itemSelectedColor: "#1d1d1f",
      itemSelectedBg: "#ffffff",
      itemHoverBg: "rgba(255,255,255,0.5)",
      itemActiveBg: "rgba(0,0,0,0.03)",
      borderRadius: 9,
      borderRadiusLG: 9,
      borderRadiusSM: 9
    },
    // ---- 开关：iOS 圆角矩形 ----
    Switch: {
      colorPrimary: "#34c759",
      colorPrimaryHover: "#34c759",
      handleBg: "#ffffff",
      trackHeight: 30,
      handleSize: 26,
      trackPadding: 2
    },
    // ---- 滑块：iOS 圆形手柄 ----
    Slider: {
      trackBg: "#0a84ff",
      trackHoverBg: "#3395ff",
      handleColor: "#ffffff",
      handleActiveColor: "#ffffff",
      handleSize: 22,
      handleLineWidth: 3,
      handleActiveOutlineColor: "rgba(10,132,255,0.25)",
      railBg: "rgba(0,0,0,0.12)",
      railHoverBg: "rgba(0,0,0,0.15)",
      dotBorderColor: "rgba(0,0,0,0.15)",
      dotActiveBorderColor: "#0a84ff"
    },
    // ---- 勾选 ----
    Checkbox: {
      colorPrimary: "#0a84ff",
      borderRadius: 5
    },
    Radio: {
      colorPrimary: "#0a84ff",
      buttonBg: "transparent",
      radioSize: 18
    },
    // ---- 标签页：细下划线 ----
    Tabs: {
      itemColor: "#6e6e73",
      itemHoverColor: "#1d1d1f",
      itemSelectedColor: "#1d1d1f",
      inkBarColor: "#0a84ff",
      titleFontSize: 14,
      horizontalItemPadding: "12px 0",
      horizontalItemGutter: 24,
      cardBg: "transparent"
    },
    // ---- 评分/进度 ----
    Rate: {
      starColor: "#ff9f0a",
      starBg: "rgba(0,0,0,0.10)",
      starSize: 22
    },
    Progress: {
      defaultColor: "#0a84ff",
      remainingColor: "rgba(0,0,0,0.08)",
      lineBorderRadius: 4
    },
    // ---- 徽标/标签：胶囊 ----
    Tag: {
      defaultBg: "rgba(0,0,0,0.05)",
      defaultColor: "#6e6e73",
      fontSize: 12
    },
    Badge: {
      indicatorHeight: 18,
      textFontWeight: 600
    },
    // ---- 列表 ----
    List: {
      itemPadding: "12px 16px",
      headerBg: "transparent",
      footerBg: "transparent"
    },
    // ---- 空态/结果 ----
    Result: {
      titleFontSize: 20,
      subtitleFontSize: 14
    },
    // ---- 通知/消息 ----
    Message: {
      contentBg: "rgba(255,255,255,0.96)"
    },
    // ---- 骨架屏 ----
    Skeleton: {
      gradientFromColor: "rgba(0,0,0,0.04)",
      gradientToColor: "rgba(0,0,0,0.09)"
    },
    // ---- 分页 ----
    Pagination: {
      itemBg: "transparent",
      itemActiveBg: "rgba(10,132,255,0.10)",
      itemActiveColor: "#0a84ff"
    }
  }
};
var kf = { exports: {} }, Vs = {};
var ay;
function BP() {
  if (ay) return Vs;
  ay = 1;
  var e = Qd(), n = /* @__PURE__ */ Symbol.for("react.element"), o = /* @__PURE__ */ Symbol.for("react.fragment"), i = Object.prototype.hasOwnProperty, l = e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, c = { key: !0, ref: !0, __self: !0, __source: !0 };
  function f(p, g, h) {
    var y, v = {}, S = null, x = null;
    h !== void 0 && (S = "" + h), g.key !== void 0 && (S = "" + g.key), g.ref !== void 0 && (x = g.ref);
    for (y in g) i.call(g, y) && !c.hasOwnProperty(y) && (v[y] = g[y]);
    if (p && p.defaultProps) for (y in g = p.defaultProps, g) v[y] === void 0 && (v[y] = g[y]);
    return { $$typeof: n, type: p, key: S, ref: x, props: v, _owner: l.current };
  }
  return Vs.Fragment = o, Vs.jsx = f, Vs.jsxs = f, Vs;
}
var cy;
function HP() {
  return cy || (cy = 1, kf.exports = BP()), kf.exports;
}
var _e = HP();
m.createContext({
  client: null,
  launchContext: null,
  ready: !1
});
m.createContext(null);
var Ba = {}, uy;
function DP() {
  if (uy) return Ba;
  uy = 1, Object.defineProperty(Ba, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M923 283.6a260.04 260.04 0 00-56.9-82.8 264.4 264.4 0 00-84-55.5A265.34 265.34 0 00679.7 125c-49.3 0-97.4 13.5-139.2 39-10 6.1-19.5 12.8-28.5 20.1-9-7.3-18.5-14-28.5-20.1-41.8-25.5-89.9-39-139.2-39-35.5 0-69.9 6.8-102.4 20.3-31.4 13-59.7 31.7-84 55.5a258.44 258.44 0 00-56.9 82.8c-13.9 32.3-21 66.6-21 101.9 0 33.3 6.8 68 20.3 103.3 11.3 29.5 27.5 60.1 48.2 91 32.8 48.9 77.9 99.9 133.9 151.6 92.8 85.7 184.7 144.9 188.6 147.3l23.7 15.2c10.5 6.7 24 6.7 34.5 0l23.7-15.2c3.9-2.5 95.7-61.6 188.6-147.3 56-51.7 101.1-102.7 133.9-151.6 20.7-30.9 37-61.5 48.2-91 13.5-35.3 20.3-70 20.3-103.3.1-35.3-7-69.6-20.9-101.9z" } }] }, name: "heart", theme: "filled" };
  return Ba.default = e, Ba;
}
var jP = /* @__PURE__ */ DP();
const VP = /* @__PURE__ */ nr(jP);
function Kd() {
  return Kd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Kd.apply(this, arguments);
}
const WP = (e, n) => /* @__PURE__ */ m.createElement(kr, Kd({}, e, {
  ref: n,
  icon: VP
})), C1 = /* @__PURE__ */ m.forwardRef(WP), Wr = 5, b1 = 1, sc = 1e5, Rp = [
  "stars",
  "hearts",
  "score",
  "progress"
], Wi = {
  theme: "",
  style: "stars",
  score: 0,
  total_score: Wr,
  locale: "zh-CN"
};
function fy(e) {
  return typeof e == "string" ? e.trim() : void 0;
}
function E1(e) {
  if (typeof e == "number" && Number.isFinite(e))
    return e;
  if (typeof e == "string" && e.trim().length > 0) {
    const n = Number(e);
    return Number.isFinite(n) ? n : void 0;
  }
}
function kp(e, n, o) {
  return Math.min(Math.max(e, n), o);
}
function Jo(e) {
  return e === "stars" || e === "hearts";
}
function qP(e) {
  return Rp.includes(e) ? e : Wi.style;
}
function UP(e, n) {
  return Jo(e) ? Wr : kp(
    E1(n) ?? Wi.total_score,
    b1,
    sc
  );
}
function XP(e, n, o) {
  const i = kp(E1(n) ?? Wi.score, 0, o);
  return Jo(e) ? Math.round(i) : i;
}
function Rr(e) {
  const n = e ?? {}, o = qP(n.style), i = UP(o, n.total_score), l = XP(o, n.score, i);
  return {
    card_type: "ScoreCard",
    theme: fy(n.theme) ?? Wi.theme,
    style: o,
    score: l,
    total_score: i,
    locale: fy(n.locale) ?? Wi.locale
  };
}
function $1(e) {
  return !Number.isFinite(e.total_score) || e.total_score <= 0 ? 0 : kp(e.score / e.total_score, 0, 1);
}
function Ua(e) {
  const n = {};
  return e.card_type !== "ScoreCard" && (n.card_type = "score.validation.cardType"), Rp.includes(e.style) || (n.style = "score.validation.style"), (!Number.isFinite(e.total_score) || e.total_score < b1) && (n.total_score = "score.validation.totalMin"), e.total_score > sc && (n.total_score = "score.validation.totalMax"), (!Number.isFinite(e.score) || e.score < 0) && (n.score = "score.validation.scoreMin"), Number.isFinite(e.total_score) && e.score > e.total_score && (n.score = "score.validation.scoreMax"), Jo(e.style) && (e.total_score !== Wr && (n.total_score = "score.validation.symbolTotal"), Number.isInteger(e.score) || (n.score = "score.validation.symbolInteger")), {
    valid: Object.keys(n).length === 0,
    errors: n
  };
}
const GP = {
  "score.style": "样式",
  "score.style.stars": "星星",
  "score.style.hearts": "爱心",
  "score.style.score": "分数",
  "score.style.progress": "进度条",
  "score.earnedScore": "获得分数",
  "score.totalScore": "总分",
  "score.scoreValue": "获得分数",
  "score.accessible.value": "{score} / {total} 分",
  "score.progress.percent": "{percent}%",
  "score.progressPreview": "进度预览：{score} / {total}，{percent}%",
  "score.validation.cardType": "卡片类型必须为 ScoreCard。",
  "score.validation.style": "评分样式必须为星星、爱心、分数或进度条。",
  "score.validation.totalMin": "总分必须大于或等于 1。",
  "score.validation.totalMax": "总分不能超过 {max}。",
  "score.validation.scoreMin": "获得分数必须大于或等于 0。",
  "score.validation.scoreMax": "获得分数不能超过总分。",
  "score.validation.symbolTotal": "星星和爱心评分固定为五分制。",
  "score.validation.symbolInteger": "星星和爱心评分必须为整数。"
};
function Zn(e, n) {
  const o = GP[e] ?? e;
  return Object.entries(n ?? {}).reduce((i, [l, c]) => i.replace(new RegExp(`\\{${l}\\}`, "g"), String(c)), o);
}
const YP = `
.chips-score-card {
  width: 100%;
  color: #1d1d1f;
  font: 14px/1.5 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-score-card,
.chips-score-card * {
  box-sizing: border-box;
}

.chips-score-card__surface {
  width: 100%;
  min-width: 0;
  container-type: inline-size;
}

.chips-score-card__surface--symbols {
  display: flex;
  justify-content: center;
}

.chips-score-card__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
  padding: 0;
}

.chips-score-card__rating {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
}

.chips-score-card__rating .ant-rate {
  display: inline-flex;
  justify-content: center;
  max-width: 100%;
  font-size: 38px;
}

@container (max-width: 240px) {
  .chips-score-card__rating .ant-rate {
    font-size: 30px;
  }
}

@container (max-width: 180px) {
  .chips-score-card__rating .ant-rate {
    font-size: 24px;
  }
}

@container (max-width: 140px) {
  .chips-score-card__rating .ant-rate {
    font-size: 19px;
  }
}

.chips-score-card__numeric {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 100%;
  min-width: 0;
  color: #1d1d1f;
}

.chips-score-card__numeric-score {
  font-size: 42px;
  font-weight: 750;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.chips-score-card__numeric-separator {
  margin: 0 8px;
  font-size: 24px;
  font-weight: 600;
}

.chips-score-card__numeric-total {
  color: #6e6e73;
  font-size: 22px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.chips-score-card__numeric--compact .chips-score-card__numeric-score {
  font-size: 30px;
}

.chips-score-card__numeric--compact .chips-score-card__numeric-separator {
  margin: 0 6px;
  font-size: 17px;
}

.chips-score-card__numeric--compact .chips-score-card__numeric-total {
  font-size: 15px;
}

.chips-score-card__progress {
  display: grid;
  gap: 10px;
  width: 100%;
}

.chips-score-card__progress-control {
  display: grid;
  gap: 6px;
  width: 100%;
}

.chips-score-card__progress-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: #6e6e73;
  font-size: 13px;
  line-height: 1.3;
}

.chips-score-card__progress-score {
  color: #1d1d1f;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.chips-score-card__progress-percent {
  color: #6e6e73;
  font-variant-numeric: tabular-nums;
}
`;
function Mf(e) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2
  }).format(e);
}
function KP(e) {
  return e.style === "hearts" ? "heart" : "star";
}
function QP(e, n, o, i) {
  const c = KP(e) === "heart";
  return /* @__PURE__ */ _e.jsxs(_e.Fragment, { children: [
    /* @__PURE__ */ _e.jsx("span", { className: "chips-score-card__sr-only", id: o, children: n }),
    /* @__PURE__ */ _e.jsx(
      p1,
      {
        "aria-labelledby": o,
        className: [
          "chips-score-card__rating",
          c ? "chips-score-card__rating--hearts" : ""
        ].filter(Boolean).join(" "),
        count: e.total_score,
        character: c ? /* @__PURE__ */ _e.jsx(C1, {}) : void 0,
        disabled: !0,
        style: c ? { color: i } : void 0,
        value: e.score
      }
    )
  ] });
}
function ZP({ config: e }) {
  const { token: n } = h1.useToken(), o = Mf(e.score), i = Mf(e.total_score), l = $1(e), c = Mf(l * 100), f = o.length + i.length >= 9, p = Zn("score.accessible.value", {
    score: o,
    total: i
  }), g = ye.useId(), h = ye.useId();
  return /* @__PURE__ */ _e.jsx("div", { className: "chips-score-card", "data-card-type": e.card_type, "data-score-style": e.style, children: /* @__PURE__ */ _e.jsxs(
    "div",
    {
      className: [
        "chips-score-card__surface",
        Jo(e.style) ? "chips-score-card__surface--symbols" : ""
      ].filter(Boolean).join(" "),
      children: [
        Jo(e.style) ? QP(e, p, h, n.colorError) : null,
        e.style === "score" ? /* @__PURE__ */ _e.jsxs(
          "div",
          {
            className: [
              "chips-score-card__numeric",
              f ? "chips-score-card__numeric--compact" : ""
            ].filter(Boolean).join(" "),
            role: "img",
            "aria-label": p,
            children: [
              /* @__PURE__ */ _e.jsx("span", { "aria-hidden": "true", className: "chips-score-card__numeric-score", children: o }),
              /* @__PURE__ */ _e.jsx(
                "span",
                {
                  "aria-hidden": "true",
                  className: "chips-score-card__numeric-separator",
                  style: { color: n.colorTextBase, opacity: 0.36 },
                  children: "/"
                }
              ),
              /* @__PURE__ */ _e.jsx("span", { "aria-hidden": "true", className: "chips-score-card__numeric-total", children: i })
            ]
          }
        ) : null,
        e.style === "progress" ? /* @__PURE__ */ _e.jsxs("div", { className: "chips-score-card__progress", children: [
          /* @__PURE__ */ _e.jsx("span", { className: "chips-score-card__sr-only", id: g, children: p }),
          /* @__PURE__ */ _e.jsx(
            d1,
            {
              "aria-labelledby": g,
              "aria-valuetext": Zn("score.progress.percent", { percent: c }),
              className: "chips-score-card__progress-control",
              "aria-valuenow": Math.round(l * 100),
              percent: l * 100,
              showInfo: !1,
              size: ["100%", 14]
            }
          ),
          /* @__PURE__ */ _e.jsxs("div", { className: "chips-score-card__progress-meta", "aria-hidden": "true", children: [
            /* @__PURE__ */ _e.jsxs("span", { className: "chips-score-card__progress-score", children: [
              o,
              " / ",
              i
            ] }),
            /* @__PURE__ */ _e.jsx("span", { className: "chips-score-card__progress-percent", children: Zn("score.progress.percent", { percent: c }) })
          ] })
        ] }) : null
      ]
    }
  ) });
}
const dy = /* @__PURE__ */ new WeakMap();
function JP(e) {
  const n = dy.get(e);
  if (n)
    return n;
  const o = ep();
  return dy.set(e, o), o;
}
function eR(e) {
  const { container: n, config: o } = e, i = n.ownerDocument;
  for (; n.firstChild; )
    n.removeChild(n.firstChild);
  const l = i.createElement("div");
  l.setAttribute("data-chips-basecard-view-root", "true"), l.style.width = "100%", n.appendChild(l);
  const c = i === document ? { container: i.head } : {
    cache: JP(i),
    container: i.head
  }, f = {
    root: Ly.createRoot(l)
  };
  return pc.flushSync(() => {
    f.root.render(
      ye.createElement(
        Sw,
        c,
        ye.createElement(
          Co,
          { locale: y1, theme: x1 },
          ye.createElement(
            ye.Fragment,
            null,
            ye.createElement("style", null, YP),
            ye.createElement(ZP, {
              config: o
            })
          )
        )
      )
    );
  }), () => {
    for (f.root.unmount(); n.firstChild; )
      n.removeChild(n.firstChild);
  };
}
const tR = `
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #ffffff;
}

.chips-basecard-editor {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  color: #1d1d1f;
  background: #ffffff;
  font: 14px/1.6 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-basecard-editor,
.chips-basecard-editor * {
  box-sizing: border-box;
}

.chips-score-editor__group {
  display: grid;
  gap: 10px;
}

.chips-score-editor__label {
  color: #1d1d1f;
  font-weight: 650;
}

.chips-score-editor__segmented {
  width: 100%;
}

.chips-score-editor__rating {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}

.chips-score-editor__rating .ant-rate {
  display: inline-flex;
  justify-content: center;
  max-width: 100%;
  font-size: 32px;
}

.chips-score-editor__number-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.chips-score-editor__number-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-score-editor__number-input {
  width: 100%;
  min-height: 44px;
}

.chips-score-editor__preview {
  display: grid;
  gap: 8px;
}

.chips-score-editor__preview-value {
  color: #6e6e73;
  font-size: 13px;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

.chips-score-editor__preview-numeric {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 100%;
  min-width: 0;
  color: #1d1d1f;
}

.chips-score-editor__preview-numeric-score {
  font-size: 42px;
  font-weight: 750;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.chips-score-editor__preview-numeric-separator {
  margin: 0 8px;
  font-size: 24px;
  font-weight: 600;
}

.chips-score-editor__preview-numeric-total {
  color: #6e6e73;
  font-size: 22px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.chips-score-editor__preview-numeric--compact .chips-score-editor__preview-numeric-score {
  font-size: 30px;
}

.chips-score-editor__preview-numeric--compact .chips-score-editor__preview-numeric-separator {
  margin: 0 6px;
  font-size: 17px;
}

.chips-score-editor__preview-numeric--compact .chips-score-editor__preview-numeric-total {
  font-size: 15px;
}

.chips-score-editor__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
  padding: 0;
}

.chips-basecard-editor__errors {
  min-height: 0;
  font-size: 13px;
}

.chips-basecard-editor__errors-list {
  margin: 0;
  padding-left: 18px;
}
`, nR = {
  stars: "score.style.stars",
  hearts: "score.style.hearts",
  score: "score.style.score",
  progress: "score.style.progress"
};
function Tf(e) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2
  }).format(e);
}
function rR(e) {
  return e.style === "hearts" ? "heart" : "star";
}
function oR(e) {
  const { token: n } = h1.useToken(), [o, i] = m.useState(() => Rr(e.initialConfig)), l = m.useRef(o), [c, f] = m.useState(
    () => Ua(Rr(e.initialConfig)).errors
  ), p = m.useMemo(() => $1(o), [o]), g = Tf(o.score), h = Tf(o.total_score), y = Tf(p * 100), v = g.length + h.length >= 9, S = ye.useId(), x = ye.useId(), b = ye.useId(), C = ye.useId(), E = ye.useId();
  m.useEffect(() => {
    const I = Rr(e.initialConfig);
    l.current = I, i(I), f(Ua(I).errors);
  }, [e.initialConfig]);
  function $(I) {
    const z = Rr({
      ...l.current,
      ...I
    }), O = Ua(z);
    l.current = z, i(z), f(O.errors), O.valid && e.onChange(z);
  }
  const k = Rp.map((I) => ({
    value: I,
    label: Zn(nR[I])
  })), P = Zn("score.accessible.value", {
    score: g,
    total: h
  }), R = rR(o) === "heart";
  function M(I) {
    I.key === "Home" ? (I.preventDefault(), $({ score: 1, total_score: Wr })) : I.key === "End" && (I.preventDefault(), $({ score: Wr, total_score: Wr }));
  }
  return /* @__PURE__ */ _e.jsxs("div", { className: "chips-basecard-editor chips-basecard-editor--standard", children: [
    /* @__PURE__ */ _e.jsxs("section", { className: "chips-score-editor__group", "aria-labelledby": S, children: [
      /* @__PURE__ */ _e.jsx("div", { className: "chips-score-editor__label", id: S, children: Zn("score.style") }),
      /* @__PURE__ */ _e.jsx(
        W2,
        {
          "aria-labelledby": S,
          className: "chips-score-editor__segmented",
          options: k,
          value: o.style,
          onChange: (I) => {
            const z = I;
            $({
              style: z,
              total_score: Jo(z) ? Wr : o.total_score
            });
          }
        }
      )
    ] }),
    /* @__PURE__ */ _e.jsxs("section", { className: "chips-score-editor__group", "aria-labelledby": x, children: [
      /* @__PURE__ */ _e.jsx("div", { className: "chips-score-editor__label", id: x, children: Zn("score.earnedScore") }),
      Jo(o.style) ? /* @__PURE__ */ _e.jsx("div", { className: "chips-score-editor__rating-wrap", onKeyDown: M, children: /* @__PURE__ */ _e.jsx(
        p1,
        {
          "aria-labelledby": x,
          className: [
            "chips-score-editor__rating",
            R ? "chips-score-editor__rating--hearts" : ""
          ].filter(Boolean).join(" "),
          count: Wr,
          character: R ? /* @__PURE__ */ _e.jsx(C1, {}) : void 0,
          style: R ? { color: n.colorError } : void 0,
          value: o.score,
          onChange: (I) => {
            $({ score: I, total_score: Wr });
          }
        }
      ) }) : /* @__PURE__ */ _e.jsxs("div", { className: "chips-score-editor__number-grid", children: [
        /* @__PURE__ */ _e.jsxs("div", { className: "chips-score-editor__number-field", children: [
          /* @__PURE__ */ _e.jsx("label", { className: "chips-score-editor__label", htmlFor: C, children: Zn("score.totalScore") }),
          /* @__PURE__ */ _e.jsx(
            Nd,
            {
              className: "chips-score-editor__number-input",
              id: C,
              max: sc,
              min: 1,
              step: 0.1,
              value: o.total_score,
              onChange: (I) => {
                $({ total_score: I ?? 1 });
              }
            }
          )
        ] }),
        /* @__PURE__ */ _e.jsxs("div", { className: "chips-score-editor__number-field", children: [
          /* @__PURE__ */ _e.jsx("label", { className: "chips-score-editor__label", htmlFor: E, children: Zn("score.scoreValue") }),
          /* @__PURE__ */ _e.jsx(
            Nd,
            {
              className: "chips-score-editor__number-input",
              id: E,
              max: o.total_score,
              min: 0,
              step: 0.1,
              value: o.score,
              onChange: (I) => {
                $({ score: I ?? 0 });
              }
            }
          )
        ] })
      ] }),
      o.style === "progress" ? /* @__PURE__ */ _e.jsxs("div", { className: "chips-score-editor__preview", children: [
        /* @__PURE__ */ _e.jsx("span", { className: "chips-score-editor__sr-only", id: b, children: Zn("score.progressPreview", {
          score: g,
          total: h,
          percent: y
        }) }),
        /* @__PURE__ */ _e.jsx(
          d1,
          {
            "aria-labelledby": b,
            "aria-valuetext": Zn("score.progress.percent", { percent: y }),
            percent: p * 100,
            showInfo: !1,
            size: ["100%", 12]
          }
        ),
        /* @__PURE__ */ _e.jsxs("div", { "aria-hidden": "true", className: "chips-score-editor__preview-value", children: [
          g,
          " / ",
          h
        ] })
      ] }) : null,
      o.style === "score" ? /* @__PURE__ */ _e.jsx("div", { className: "chips-score-editor__preview", children: /* @__PURE__ */ _e.jsxs(
        "div",
        {
          className: [
            "chips-score-editor__preview-numeric",
            v ? "chips-score-editor__preview-numeric--compact" : ""
          ].filter(Boolean).join(" "),
          role: "img",
          "aria-label": P,
          children: [
            /* @__PURE__ */ _e.jsx("span", { "aria-hidden": "true", className: "chips-score-editor__preview-numeric-score", children: g }),
            /* @__PURE__ */ _e.jsx(
              "span",
              {
                "aria-hidden": "true",
                className: "chips-score-editor__preview-numeric-separator",
                style: { color: n.colorTextBase, opacity: 0.36 },
                children: "/"
              }
            ),
            /* @__PURE__ */ _e.jsx("span", { "aria-hidden": "true", className: "chips-score-editor__preview-numeric-total", children: h })
          ]
        }
      ) }) : null,
      /* @__PURE__ */ _e.jsx(
        "div",
        {
          className: "chips-basecard-editor__errors",
          role: "alert",
          "aria-live": "polite",
          style: { color: n.colorError },
          children: Object.keys(c).length > 0 ? /* @__PURE__ */ _e.jsx("ul", { className: "chips-basecard-editor__errors-list", children: Object.entries(c).map(([I, z]) => /* @__PURE__ */ _e.jsx("li", { children: Zn(z, { max: sc }) }, I)) }) : null
        }
      )
    ] })
  ] });
}
function iR(e) {
  const n = document.createElement("div");
  n.setAttribute("data-chips-basecard-editor-root", "true"), n.style.width = "100%", n.style.height = "100%", n.style.minHeight = "0";
  const o = Ly.createRoot(n);
  return pc.flushSync(() => {
    o.render(
      /* @__PURE__ */ _e.jsxs(Co, { locale: y1, theme: x1, children: [
        /* @__PURE__ */ _e.jsx("style", { children: tR }),
        /* @__PURE__ */ _e.jsx(oR, { ...e })
      ] })
    );
  }), n.__chipsDispose = () => {
    o.unmount();
  }, n;
}
function Nf(e) {
  return {
    height: e.style.height,
    minHeight: e.style.minHeight,
    width: e.style.width,
    overflow: e.style.overflow,
    display: e.style.display
  };
}
function If(e, n) {
  e.style.height = n.height, e.style.minHeight = n.minHeight, e.style.width = n.width, e.style.overflow = n.overflow, e.style.display = n.display;
}
function sR(e) {
  const n = e.container.ownerDocument, o = n.documentElement, i = n.body, l = Nf(o), c = Nf(i), f = Nf(e.container);
  for (o.style.width = "100%", o.style.height = "100%", o.style.minHeight = "0", o.style.overflow = "hidden", i.style.width = "100%", i.style.height = "100%", i.style.minHeight = "0", i.style.overflow = "hidden", e.container.style.display = "flex", e.container.style.width = "100%", e.container.style.height = "100%", e.container.style.minHeight = "0", e.container.style.overflow = "hidden"; e.container.firstChild; )
    e.container.removeChild(e.container.firstChild);
  const p = iR({
    initialConfig: e.initialConfig,
    onChange: e.onChange,
    resolveResourceUrl: e.resolveResourceUrl,
    releaseResourceUrl: e.releaseResourceUrl,
    importResource: e.importResource,
    importArchiveBundle: e.importArchiveBundle,
    deleteResource: e.deleteResource,
    convertTiffToPng: e.convertTiffToPng
  });
  return e.container.appendChild(p), () => {
    for (p.__chipsDispose?.(), If(o, l), If(i, c), If(e.container, f); e.container.firstChild; )
      e.container.removeChild(e.container.firstChild);
  };
}
function lR(e) {
  return eR({
    ...e,
    config: Rr(e.config)
  });
}
function aR(e) {
  return sR(e);
}
const cR = {
  name: "star",
  decorative: !0
}, fR = {
  pluginId: "chips.basecard.score",
  cardType: "base.score",
  displayName: "评分基础卡片",
  description: "用星星、爱心、数字分数或进度条展示评分数据。",
  icon: cR,
  aliases: ["ScoreCard"],
  commitDebounceMs: 260,
  createInitialConfig(e) {
    return Rr(
      Wi
    );
  },
  normalizeConfig(e, n) {
    return Rr(e);
  },
  validateConfig(e) {
    return Ua(
      Rr(e)
    );
  },
  collectResourcePaths(e) {
    return [];
  },
  renderView(e) {
    return lR({
      container: e.container,
      config: Rr(e.config),
      themeCssText: e.themeCssText,
      resolveResourceUrl: e.resolveResourceUrl,
      releaseResourceUrl: e.releaseResourceUrl,
      openResource: e.openResource
    });
  },
  renderEditor(e) {
    return aR({
      container: e.container,
      initialConfig: Rr(e.initialConfig),
      onChange(n) {
        e.onChange(n);
      },
      resolveResourceUrl: e.resolveResourceUrl,
      releaseResourceUrl: e.releaseResourceUrl,
      importResource: e.importResource,
      importArchiveBundle: e.importArchiveBundle,
      deleteResource: e.deleteResource,
      convertTiffToPng: e.convertTiffToPng
    });
  }
};
export {
  fR as basecardDefinition,
  aR as renderBasecardEditor,
  lR as renderBasecardView
};
