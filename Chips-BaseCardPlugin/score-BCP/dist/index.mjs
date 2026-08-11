function _S(e, n) {
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
function er(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var Xu = { exports: {} }, Me = {};
var km;
function RS() {
  if (km) return Me;
  km = 1;
  var e = /* @__PURE__ */ Symbol.for("react.element"), n = /* @__PURE__ */ Symbol.for("react.portal"), o = /* @__PURE__ */ Symbol.for("react.fragment"), i = /* @__PURE__ */ Symbol.for("react.strict_mode"), l = /* @__PURE__ */ Symbol.for("react.profiler"), c = /* @__PURE__ */ Symbol.for("react.provider"), f = /* @__PURE__ */ Symbol.for("react.context"), p = /* @__PURE__ */ Symbol.for("react.forward_ref"), g = /* @__PURE__ */ Symbol.for("react.suspense"), m = /* @__PURE__ */ Symbol.for("react.memo"), y = /* @__PURE__ */ Symbol.for("react.lazy"), v = Symbol.iterator;
  function w(k) {
    return k === null || typeof k != "object" ? null : (k = v && k[v] || k["@@iterator"], typeof k == "function" ? k : null);
  }
  var x = { isMounted: function() {
    return !1;
  }, enqueueForceUpdate: function() {
  }, enqueueReplaceState: function() {
  }, enqueueSetState: function() {
  } }, b = Object.assign, C = {};
  function E(k, A, ee) {
    this.props = k, this.context = A, this.refs = C, this.updater = ee || x;
  }
  E.prototype.isReactComponent = {}, E.prototype.setState = function(k, A) {
    if (typeof k != "object" && typeof k != "function" && k != null) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, k, A, "setState");
  }, E.prototype.forceUpdate = function(k) {
    this.updater.enqueueForceUpdate(this, k, "forceUpdate");
  };
  function P() {
  }
  P.prototype = E.prototype;
  function N(k, A, ee) {
    this.props = k, this.context = A, this.refs = C, this.updater = ee || x;
  }
  var _ = N.prototype = new P();
  _.constructor = N, b(_, E.prototype), _.isPureReactComponent = !0;
  var R = Array.isArray, M = Object.prototype.hasOwnProperty, F = { current: null }, O = { key: !0, ref: !0, __self: !0, __source: !0 };
  function z(k, A, ee) {
    var te, se = {}, re = null, fe = null;
    if (A != null) for (te in A.ref !== void 0 && (fe = A.ref), A.key !== void 0 && (re = "" + A.key), A) M.call(A, te) && !O.hasOwnProperty(te) && (se[te] = A[te]);
    var ie = arguments.length - 2;
    if (ie === 1) se.children = ee;
    else if (1 < ie) {
      for (var Z = Array(ie), ae = 0; ae < ie; ae++) Z[ae] = arguments[ae + 2];
      se.children = Z;
    }
    if (k && k.defaultProps) for (te in ie = k.defaultProps, ie) se[te] === void 0 && (se[te] = ie[te]);
    return { $$typeof: e, type: k, key: re, ref: fe, props: se, _owner: F.current };
  }
  function H(k, A) {
    return { $$typeof: e, type: k.type, key: A, ref: k.ref, props: k.props, _owner: k._owner };
  }
  function Y(k) {
    return typeof k == "object" && k !== null && k.$$typeof === e;
  }
  function V(k) {
    var A = { "=": "=0", ":": "=2" };
    return "$" + k.replace(/[=:]/g, function(ee) {
      return A[ee];
    });
  }
  var X = /\/+/g;
  function Q(k, A) {
    return typeof k == "object" && k !== null && k.key != null ? V("" + k.key) : A.toString(36);
  }
  function oe(k, A, ee, te, se) {
    var re = typeof k;
    (re === "undefined" || re === "boolean") && (k = null);
    var fe = !1;
    if (k === null) fe = !0;
    else switch (re) {
      case "string":
      case "number":
        fe = !0;
        break;
      case "object":
        switch (k.$$typeof) {
          case e:
          case n:
            fe = !0;
        }
    }
    if (fe) return fe = k, se = se(fe), k = te === "" ? "." + Q(fe, 0) : te, R(se) ? (ee = "", k != null && (ee = k.replace(X, "$&/") + "/"), oe(se, A, ee, "", function(ae) {
      return ae;
    })) : se != null && (Y(se) && (se = H(se, ee + (!se.key || fe && fe.key === se.key ? "" : ("" + se.key).replace(X, "$&/") + "/") + k)), A.push(se)), 1;
    if (fe = 0, te = te === "" ? "." : te + ":", R(k)) for (var ie = 0; ie < k.length; ie++) {
      re = k[ie];
      var Z = te + Q(re, ie);
      fe += oe(re, A, ee, Z, se);
    }
    else if (Z = w(k), typeof Z == "function") for (k = Z.call(k), ie = 0; !(re = k.next()).done; ) re = re.value, Z = te + Q(re, ie++), fe += oe(re, A, ee, Z, se);
    else if (re === "object") throw A = String(k), Error("Objects are not valid as a React child (found: " + (A === "[object Object]" ? "object with keys {" + Object.keys(k).join(", ") + "}" : A) + "). If you meant to render a collection of children, use an array instead.");
    return fe;
  }
  function G(k, A, ee) {
    if (k == null) return k;
    var te = [], se = 0;
    return oe(k, te, "", "", function(re) {
      return A.call(ee, re, se++);
    }), te;
  }
  function le(k) {
    if (k._status === -1) {
      var A = k._result;
      A = A(), A.then(function(ee) {
        (k._status === 0 || k._status === -1) && (k._status = 1, k._result = ee);
      }, function(ee) {
        (k._status === 0 || k._status === -1) && (k._status = 2, k._result = ee);
      }), k._status === -1 && (k._status = 0, k._result = A);
    }
    if (k._status === 1) return k._result.default;
    throw k._result;
  }
  var he = { current: null }, j = { transition: null }, J = { ReactCurrentDispatcher: he, ReactCurrentBatchConfig: j, ReactCurrentOwner: F };
  function U() {
    throw Error("act(...) is not supported in production builds of React.");
  }
  return Me.Children = { map: G, forEach: function(k, A, ee) {
    G(k, function() {
      A.apply(this, arguments);
    }, ee);
  }, count: function(k) {
    var A = 0;
    return G(k, function() {
      A++;
    }), A;
  }, toArray: function(k) {
    return G(k, function(A) {
      return A;
    }) || [];
  }, only: function(k) {
    if (!Y(k)) throw Error("React.Children.only expected to receive a single React element child.");
    return k;
  } }, Me.Component = E, Me.Fragment = o, Me.Profiler = l, Me.PureComponent = N, Me.StrictMode = i, Me.Suspense = g, Me.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = J, Me.act = U, Me.cloneElement = function(k, A, ee) {
    if (k == null) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + k + ".");
    var te = b({}, k.props), se = k.key, re = k.ref, fe = k._owner;
    if (A != null) {
      if (A.ref !== void 0 && (re = A.ref, fe = F.current), A.key !== void 0 && (se = "" + A.key), k.type && k.type.defaultProps) var ie = k.type.defaultProps;
      for (Z in A) M.call(A, Z) && !O.hasOwnProperty(Z) && (te[Z] = A[Z] === void 0 && ie !== void 0 ? ie[Z] : A[Z]);
    }
    var Z = arguments.length - 2;
    if (Z === 1) te.children = ee;
    else if (1 < Z) {
      ie = Array(Z);
      for (var ae = 0; ae < Z; ae++) ie[ae] = arguments[ae + 2];
      te.children = ie;
    }
    return { $$typeof: e, type: k.type, key: se, ref: re, props: te, _owner: fe };
  }, Me.createContext = function(k) {
    return k = { $$typeof: f, _currentValue: k, _currentValue2: k, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null }, k.Provider = { $$typeof: c, _context: k }, k.Consumer = k;
  }, Me.createElement = z, Me.createFactory = function(k) {
    var A = z.bind(null, k);
    return A.type = k, A;
  }, Me.createRef = function() {
    return { current: null };
  }, Me.forwardRef = function(k) {
    return { $$typeof: p, render: k };
  }, Me.isValidElement = Y, Me.lazy = function(k) {
    return { $$typeof: y, _payload: { _status: -1, _result: k }, _init: le };
  }, Me.memo = function(k, A) {
    return { $$typeof: m, type: k, compare: A === void 0 ? null : A };
  }, Me.startTransition = function(k) {
    var A = j.transition;
    j.transition = {};
    try {
      k();
    } finally {
      j.transition = A;
    }
  }, Me.unstable_act = U, Me.useCallback = function(k, A) {
    return he.current.useCallback(k, A);
  }, Me.useContext = function(k) {
    return he.current.useContext(k);
  }, Me.useDebugValue = function() {
  }, Me.useDeferredValue = function(k) {
    return he.current.useDeferredValue(k);
  }, Me.useEffect = function(k, A) {
    return he.current.useEffect(k, A);
  }, Me.useId = function() {
    return he.current.useId();
  }, Me.useImperativeHandle = function(k, A, ee) {
    return he.current.useImperativeHandle(k, A, ee);
  }, Me.useInsertionEffect = function(k, A) {
    return he.current.useInsertionEffect(k, A);
  }, Me.useLayoutEffect = function(k, A) {
    return he.current.useLayoutEffect(k, A);
  }, Me.useMemo = function(k, A) {
    return he.current.useMemo(k, A);
  }, Me.useReducer = function(k, A, ee) {
    return he.current.useReducer(k, A, ee);
  }, Me.useRef = function(k) {
    return he.current.useRef(k);
  }, Me.useState = function(k) {
    return he.current.useState(k);
  }, Me.useSyncExternalStore = function(k, A, ee) {
    return he.current.useSyncExternalStore(k, A, ee);
  }, Me.useTransition = function() {
    return he.current.useTransition();
  }, Me.version = "18.3.1", Me;
}
var Tm;
function Nd() {
  return Tm || (Tm = 1, Xu.exports = RS()), Xu.exports;
}
var h = Nd();
const ye = /* @__PURE__ */ er(h), NS = /* @__PURE__ */ _S({
  __proto__: null,
  default: ye
}, [h]);
function Xs(e) {
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
function Zn() {
  return !!(typeof window < "u" && window.document && window.document.createElement);
}
function kS(e, n) {
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
const Mm = "data-rc-order", Im = "data-rc-priority", TS = "rc-util-key", $f = /* @__PURE__ */ new Map();
function j0({
  mark: e
} = {}) {
  return e ? e.startsWith("data-") ? e : `data-${e}` : TS;
}
function tc(e) {
  return e.attachTo ? e.attachTo : document.querySelector("head") || document.body;
}
function MS(e) {
  return e === "queue" ? "prependQueue" : e ? "prepend" : "append";
}
function kd(e) {
  return Array.from(($f.get(e) || e).children).filter((n) => n.tagName === "STYLE");
}
function H0(e, n = {}) {
  if (!Zn())
    return null;
  const {
    csp: o,
    prepend: i,
    priority: l = 0
  } = n, c = MS(i), f = c === "prependQueue", p = document.createElement("style");
  p.setAttribute(Mm, c), f && l && p.setAttribute(Im, `${l}`), o?.nonce && (p.nonce = o?.nonce), p.innerHTML = e;
  const g = tc(n), {
    firstChild: m
  } = g;
  if (i) {
    if (f) {
      const y = (n.styles || kd(g)).filter((v) => {
        if (!["prepend", "prependQueue"].includes(v.getAttribute(Mm)))
          return !1;
        const w = Number(v.getAttribute(Im) || 0);
        return l >= w;
      });
      if (y.length)
        return g.insertBefore(p, y[y.length - 1].nextSibling), p;
    }
    g.insertBefore(p, m);
  } else
    g.appendChild(p);
  return p;
}
function V0(e, n = {}) {
  let {
    styles: o
  } = n;
  return o ||= kd(tc(n)), o.find((i) => i.getAttribute(j0(n)) === e);
}
function Gs(e, n = {}) {
  const o = V0(e, n);
  o && tc(n).removeChild(o);
}
function IS(e, n) {
  const o = $f.get(e);
  if (!o || !kS(document, o)) {
    const i = H0("", n), {
      parentNode: l
    } = i;
    $f.set(e, l), e.removeChild(i);
  }
}
function Vo(e, n, o = {}) {
  const i = tc(o), l = kd(i), c = {
    ...o,
    styles: l
  };
  IS(i, c);
  const f = V0(n, c);
  if (f)
    return c.csp?.nonce && f.nonce !== c.csp?.nonce && (f.nonce = c.csp?.nonce), f.innerHTML !== e && (f.innerHTML = e), f;
  const p = H0(e, c);
  return p.setAttribute(j0(c), n), p;
}
function nc(e, n, o) {
  const i = h.useRef({});
  return (!("value" in i.current) || o(i.current.condition, n)) && (i.current.value = e(), i.current.condition = n), i.current.value;
}
let Pf = {};
const FS = (e) => {
};
function OS(e, n) {
}
function zS(e, n) {
}
function AS() {
  Pf = {};
}
function W0(e, n, o) {
  !n && !Pf[o] && (e(!1, o), Pf[o] = !0);
}
function Fn(e, n) {
  W0(OS, e, n);
}
function LS(e, n) {
  W0(zS, e, n);
}
Fn.preMessage = FS;
Fn.resetWarned = AS;
Fn.noteOnce = LS;
function Ys(e, n, o = !1) {
  const i = /* @__PURE__ */ new Set();
  function l(c, f, p = 1) {
    const g = i.has(c);
    if (Fn(!g, "Warning: There may be circular references"), g)
      return !1;
    if (c === f)
      return !0;
    if (o && p > 1)
      return !1;
    i.add(c);
    const m = p + 1;
    if (Array.isArray(c)) {
      if (!Array.isArray(f) || c.length !== f.length)
        return !1;
      for (let y = 0; y < c.length; y++)
        if (!l(c[y], f[y], m))
          return !1;
      return !0;
    }
    if (c && f && typeof c == "object" && typeof f == "object") {
      const y = Object.keys(c);
      return y.length !== Object.keys(f).length ? !1 : y.every((v) => l(c[v], f[v], m));
    }
    return !1;
  }
  return l(e, n);
}
const BS = "%";
function _f(e) {
  return e.join(BS);
}
let Fm = 0;
class DS {
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
    return this.opGet(_f(n));
  }
  /** A fast get cache with `get` concat. */
  opGet(n) {
    return this.cache.get(n) || null;
  }
  update(n, o) {
    return this.opUpdate(_f(n), o);
  }
  /** A fast get cache with `get` concat. */
  opUpdate(n, o) {
    const i = this.cache.get(n), l = o(i);
    l === null ? (this.cache.delete(n), this.updateTimes.delete(n)) : (this.cache.set(n, l), this.updateTimes.set(n, Fm), Fm += 1);
  }
}
const jS = {}, Td = "data-token-hash", Hr = "data-css-hash", Wo = "__cssinjs_instance__";
function Md() {
  const e = Math.random().toString(12).slice(2);
  if (typeof document < "u" && document.head && document.body) {
    const n = document.body.querySelectorAll(`style[${Hr}]`) || [], {
      firstChild: o
    } = document.head;
    Array.from(n).forEach((l) => {
      l[Wo] ||= e, l[Wo] === e && document.head.insertBefore(l, o);
    });
    const i = {};
    Array.from(document.querySelectorAll(`style[${Hr}]`)).forEach((l) => {
      const c = l.getAttribute(Hr);
      i[c] ? l[Wo] === e && l.parentNode?.removeChild(l) : i[c] = !0;
    });
  }
  return new DS(e);
}
const Go = /* @__PURE__ */ h.createContext({
  hashPriority: "low",
  cache: Md(),
  defaultCache: !0,
  autoPrefix: !1
}), HS = (e) => {
  const {
    children: n,
    ...o
  } = e, i = h.useContext(Go), l = nc(() => {
    const c = {
      ...i
    };
    Object.keys(o).forEach((g) => {
      const m = o[g];
      o[g] !== void 0 && (c[g] = m);
    });
    const {
      cache: f,
      transformers: p = []
    } = o;
    return c.cache = c.cache || Md(), c.defaultCache = !f && i.defaultCache, p.includes(jS) && (c.autoPrefix = !0), c;
  }, [i, o], (c, f) => !Ys(c[0], f[0], !0) || !Ys(c[1], f[1], !0));
  return /* @__PURE__ */ h.createElement(Go.Provider, {
    value: l
  }, n);
};
function VS(e, n) {
  if (e.length !== n.length)
    return !1;
  for (let o = 0; o < e.length; o++)
    if (e[o] !== n[o])
      return !1;
  return !0;
}
class ja {
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
      if (this.size() + 1 > ja.MAX_CACHE_SIZE + ja.MAX_CACHE_OFFSET) {
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
      return this.keys = this.keys.filter((o) => !VS(o, n)), this.deleteByPath(this.cache, n);
  }
}
let Om = 0;
class U0 {
  derivatives;
  id;
  constructor(n) {
    this.derivatives = Array.isArray(n) ? n : [n], this.id = Om, n.length === 0 && (n.length > 0, void 0), Om += 1;
  }
  getDerivativeToken(n) {
    return this.derivatives.reduce((o, i) => i(n, o), void 0);
  }
}
const Gu = new ja();
function Ha(e) {
  const n = Array.isArray(e) ? e : [e];
  return Gu.has(n) || Gu.set(n, new U0(n)), Gu.get(n);
}
const WS = /* @__PURE__ */ new WeakMap(), Yu = {};
function US(e, n) {
  let o = WS;
  for (let i = 0; i < n.length; i += 1) {
    const l = n[i];
    o.has(l) || o.set(l, /* @__PURE__ */ new WeakMap()), o = o.get(l);
  }
  return o.has(Yu) || o.set(Yu, e()), o.get(Yu);
}
const zm = /* @__PURE__ */ new WeakMap();
function Vs(e) {
  let n = zm.get(e) || "";
  return n || (Object.keys(e).forEach((o) => {
    const i = e[o];
    n += o, i instanceof U0 ? n += i.id : i && typeof i == "object" ? n += Vs(i) : n += i;
  }), n = Xs(n), zm.set(e, n)), n;
}
function qS(e, n) {
  return Xs(`${n}_${Vs(e)}`);
}
const Rf = Zn();
function $e(e) {
  return typeof e == "number" ? `${e}px` : e;
}
function q0(e) {
  const {
    hashCls: n,
    hashPriority: o = "low"
  } = e || {};
  if (!n)
    return "";
  const i = `.${n}`;
  return o === "low" ? `:where(${i})` : i;
}
const XS = (e) => e != null;
function Id(e, n) {
  const o = typeof n == "function" ? n() : n;
  return o ? {
    ...e,
    csp: {
      ...e.csp,
      nonce: o
    }
  } : e;
}
const Fa = (e, n = "") => `--${n ? `${n}-` : ""}${e}`.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, "$1-$2").replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase(), GS = (e, n, o) => {
  const {
    hashCls: i,
    hashPriority: l = "low",
    scope: c
  } = o || {};
  if (!Object.keys(e).length)
    return "";
  const f = `${q0({
    hashCls: i,
    hashPriority: l
  })}.${n}`, p = [c].flat().filter(Boolean);
  return `${p.length ? p.map((m) => `${f}.${m}`).join(", ") : f}{${Object.entries(e).map(([m, y]) => `${m}:${y};`).join("")}}`;
}, X0 = (e, n, o) => {
  const {
    hashCls: i,
    hashPriority: l = "low",
    prefix: c,
    unitless: f,
    ignore: p,
    preserve: g
  } = o || {}, m = {}, y = {};
  return Object.entries(e).forEach(([v, w]) => {
    if (g?.[v])
      y[v] = w;
    else if ((typeof w == "string" || typeof w == "number") && !p?.[v]) {
      const x = Fa(v, c);
      m[x] = typeof w == "number" && !f?.[v] ? `${w}px` : String(w), y[v] = `var(${x})`;
    }
  }), [y, GS(m, n, {
    scope: o?.scope,
    hashCls: i,
    hashPriority: l
  })];
}, da = /* @__PURE__ */ new Map();
function Fd(e, n, o, i, l) {
  const {
    cache: c
  } = h.useContext(Go), f = [e, ...n], p = _f(f), g = (v) => {
    c.opUpdate(p, (w) => {
      const [x = 0, b] = w || [void 0, void 0], E = b || o(), P = [x, E];
      return v ? v(P) : P;
    });
  };
  h.useMemo(
    () => {
      g();
    },
    /* eslint-disable react-hooks/exhaustive-deps */
    [p]
    /* eslint-enable */
  );
  const y = c.opGet(p)[1];
  return h.useInsertionEffect(() => (g(([v, w]) => [v + 1, w]), da.has(p) || (l?.(y), da.set(p, !0), Promise.resolve().then(() => {
    da.delete(p);
  })), () => {
    c.opUpdate(p, (v) => {
      const [w = 0, x] = v || [];
      return w - 1 === 0 ? (i?.(x, !1), da.delete(p), null) : [w - 1, x];
    });
  }), [p]), y;
}
const YS = {}, KS = "css", Ao = /* @__PURE__ */ new Map();
function QS(e) {
  Ao.set(e, (Ao.get(e) || 0) + 1);
}
function ZS(e, n) {
  typeof document < "u" && document.querySelectorAll(`style[${Td}="${e}"]`).forEach((i) => {
    i[Wo] === n && i.parentNode?.removeChild(i);
  });
}
const JS = -1;
function ew(e, n) {
  Ao.set(e, (Ao.get(e) || 0) - 1);
  const o = /* @__PURE__ */ new Set();
  Ao.forEach((i, l) => {
    i <= 0 && o.add(l);
  }), Ao.size - o.size > JS && o.forEach((i) => {
    ZS(i, n), Ao.delete(i);
  });
}
const G0 = (e, n, o, i) => {
  let c = {
    ...o.getDerivativeToken(e),
    ...n
  };
  return i && (c = i(c)), c;
}, tw = "token";
function nw(e, n, o) {
  const {
    cache: {
      instanceId: i
    },
    container: l,
    hashPriority: c
  } = h.useContext(Go), {
    salt: f = "",
    override: p = YS,
    formatToken: g,
    getComputedToken: m,
    cssVar: y,
    nonce: v
  } = o, w = US(() => Object.assign({}, ...n), n), x = Vs(w), b = Vs(p), C = Vs(y);
  return Fd(tw, [f, e.id, x, b, C], () => {
    const P = m ? m(w, p, e) : G0(w, p, e, g), N = {
      ...P
    }, _ = `${f}_${y.prefix}`, R = Xs(_), M = `${KS}-${R}`;
    N._tokenKey = qS(N, _);
    const [F, O] = X0(P, y.key, {
      prefix: y.prefix,
      ignore: y.ignore,
      unitless: y.unitless,
      preserve: y.preserve,
      hashPriority: c,
      hashCls: y.hashed ? M : void 0
    });
    return F._hashId = R, QS(y.key), [F, M, N, O, y.key];
  }, ([, , , , P]) => {
    ew(P, i);
  }, ([, , , P, N]) => {
    if (!P)
      return;
    let _ = {
      mark: Hr,
      prepend: "queue",
      attachTo: l,
      priority: -999
    };
    _ = Id(_, v);
    const R = Vo(P, Xs(`css-var-${N}`), _);
    R[Wo] = i, R.setAttribute(Td, N);
  });
}
var rw = {
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
}, lt = "-ms-", Ws = "-moz-", We = "-webkit-", Y0 = "comm", Od = "rule", zd = "decl", ow = "@import", iw = "@namespace", K0 = "@keyframes", sw = "@layer", lw = Math.abs, Us = String.fromCharCode, Nf = Object.assign;
function aw(e, n) {
  return zt(e, 0) ^ 45 ? (((n << 2 ^ zt(e, 0)) << 2 ^ zt(e, 1)) << 2 ^ zt(e, 2)) << 2 ^ zt(e, 3) : 0;
}
function Q0(e) {
  return e.trim();
}
function Dr(e, n) {
  return (e = n.exec(e)) ? e[0] : e;
}
function Te(e, n, o) {
  return e.replace(n, o);
}
function Ku(e, n) {
  return e.indexOf(n);
}
function zt(e, n) {
  return e.charCodeAt(n) | 0;
}
function Yo(e, n, o) {
  return e.slice(n, o);
}
function fr(e) {
  return e.length;
}
function Z0(e) {
  return e.length;
}
function Bs(e, n) {
  return n.push(e), e;
}
function cw(e, n) {
  return e.map(n).join("");
}
function Am(e, n) {
  return e.filter(function(o) {
    return !Dr(o, n);
  });
}
var rc = 1, Mi = 1, J0 = 0, Jn = 0, _t = 0, ji = "";
function oc(e, n, o, i, l, c, f, p) {
  return { value: e, root: n, parent: o, type: i, props: l, children: c, line: rc, column: Mi, length: f, return: "", siblings: p };
}
function mo(e, n) {
  return Nf(oc("", null, null, "", null, null, 0, e.siblings), e, { length: -e.length }, n);
}
function Ci(e) {
  for (; e.root; )
    e = mo(e.root, { children: [e] });
  Bs(e, e.siblings);
}
function uw() {
  return _t;
}
function fw() {
  return _t = Jn > 0 ? zt(ji, --Jn) : 0, Mi--, _t === 10 && (Mi = 1, rc--), _t;
}
function pr() {
  return _t = Jn < J0 ? zt(ji, Jn++) : 0, Mi++, _t === 10 && (Mi = 1, rc++), _t;
}
function go() {
  return zt(ji, Jn);
}
function Oa() {
  return Jn;
}
function ic(e, n) {
  return Yo(ji, e, n);
}
function Ks(e) {
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
function dw(e) {
  return rc = Mi = 1, J0 = fr(ji = e), Jn = 0, [];
}
function pw(e) {
  return ji = "", e;
}
function Qu(e) {
  return Q0(ic(Jn - 1, kf(e === 91 ? e + 2 : e === 40 ? e + 1 : e)));
}
function hw(e) {
  for (; (_t = go()) && _t < 33; )
    pr();
  return Ks(e) > 2 || Ks(_t) > 3 ? "" : " ";
}
function mw(e, n) {
  for (; --n && pr() && !(_t < 48 || _t > 102 || _t > 57 && _t < 65 || _t > 70 && _t < 97); )
    ;
  return ic(e, Oa() + (n < 6 && go() == 32 && pr() == 32));
}
function kf(e) {
  for (; pr(); )
    switch (_t) {
      // ] ) " '
      case e:
        return Jn;
      // " '
      case 34:
      case 39:
        e !== 34 && e !== 39 && kf(_t);
        break;
      // (
      case 40:
        e === 41 && kf(e);
        break;
      // \
      case 92:
        pr();
        break;
    }
  return Jn;
}
function gw(e, n) {
  for (; pr() && e + _t !== 57; )
    if (e + _t === 84 && go() === 47)
      break;
  return "/*" + ic(n, Jn - 1) + "*" + Us(e === 47 ? e : pr());
}
function yw(e) {
  for (; !Ks(go()); )
    pr();
  return ic(e, Jn);
}
function Lm(e) {
  return pw(za("", null, null, null, [""], e = dw(e), 0, [0], e));
}
function za(e, n, o, i, l, c, f, p, g) {
  for (var m = 0, y = 0, v = f, w = 0, x = 0, b = 0, C = 1, E = 1, P = 1, N = 0, _ = 0, R = "", M = l, F = c, O = i, z = R; E; )
    switch (b = _, _ = pr()) {
      // (
      case 40:
        b != 108 && zt(z, v - 1) == 58 ? (N++, z += "(") : z += Qu(_);
        break;
      // )
      case 41:
        N--, z += ")";
        break;
      // " ' [
      case 34:
      case 39:
      case 91:
        z += Qu(_);
        break;
      // \t \n \r \s
      case 9:
      case 10:
      case 13:
      case 32:
        if (N > 0) {
          z += Us(_);
          break;
        }
        z += hw(b);
        break;
      // \
      case 92:
        z += mw(Oa() - 1, 7);
        continue;
      // /
      case 47:
        switch (go()) {
          case 42:
          case 47:
            Bs(vw(gw(pr(), Oa()), n, o, g), g), (Ks(b || 1) == 5 || Ks(go() || 1) == 5) && fr(z) && Yo(z, -1, void 0) !== " " && (z += " ");
            break;
          default:
            z += "/";
        }
        break;
      // {
      case 123 * C:
        p[m++] = fr(z) * P;
      // } ; \0
      case 125 * C:
      case 59:
      case 0:
        if (N > 0 && _) {
          z += Us(_);
          break;
        }
        switch (_) {
          // \0 }
          case 0:
          case 125:
            E = 0;
          // ;
          case 59 + y:
            P == -1 && (z = Te(z, /\f/g, "")), x > 0 && (fr(z) - v || C === 0) && Bs(x > 32 ? Dm(z + ";", i, o, v - 1, g) : Dm(Te(z, " ", "") + ";", i, o, v - 2, g), g);
            break;
          // @ ;
          case 59:
            z += ";";
          // { rule/at-rule
          default:
            if (Bs(O = Bm(z, n, o, m, y, l, p, R, M = [], F = [], v, c), c), _ === 123)
              if (y === 0)
                za(z, n, O, O, M, c, v, p, F);
              else {
                switch (w) {
                  // c(ontainer)
                  case 99:
                    if (zt(z, 3) === 110) break;
                  // l(ayer)
                  case 108:
                    if (zt(z, 2) === 97) break;
                  default:
                    y = 0;
                  // d(ocument) m(edia) s(upports)
                  case 100:
                  case 109:
                  case 115:
                }
                y ? za(e, O, O, i && Bs(Bm(e, O, O, 0, 0, l, p, R, l, M = [], v, F), F), l, F, v, p, i ? M : F) : za(z, O, O, O, [""], F, 0, p, F);
              }
        }
        m = y = x = 0, C = P = 1, R = z = "", v = f;
        break;
      // :
      case 58:
        v = 1 + fr(z), x = b;
      default:
        if (C < 1) {
          if (_ == 123)
            --C;
          else if (_ == 125 && C++ == 0 && fw() == 125)
            continue;
        }
        switch (z += Us(_), _ * C) {
          // &
          case 38:
            P = y > 0 ? 1 : (z += "\f", -1);
            break;
          // ,
          case 44:
            if (N > 0) break;
            p[m++] = (fr(z) - 1) * P, P = 1;
            break;
          // @
          case 64:
            go() === 45 && (z += Qu(pr())), w = go(), y = v = fr(R = z += yw(Oa())), _++;
            break;
          // -
          case 45:
            b === 45 && fr(z) == 2 && (C = 0);
        }
    }
  return c;
}
function Bm(e, n, o, i, l, c, f, p, g, m, y, v) {
  for (var w = l - 1, x = l === 0 ? c : [""], b = Z0(x), C = 0, E = 0, P = 0; C < i; ++C)
    for (var N = 0, _ = Yo(e, w + 1, w = lw(E = f[C])), R = e; N < b; ++N)
      (R = Q0(E > 0 ? x[N] + " " + _ : Te(_, /&\f/g, x[N]))) && (g[P++] = R);
  return oc(e, n, o, l === 0 ? Od : p, g, m, y, v);
}
function vw(e, n, o, i) {
  return oc(e, n, o, Y0, Us(uw()), Yo(e, 2, -2), 0, i);
}
function Dm(e, n, o, i, l) {
  return oc(e, n, o, zd, Yo(e, 0, i), Yo(e, i + 1, -1), i, l);
}
function ey(e, n, o) {
  switch (aw(e, n)) {
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
      return Ws + e + e;
    // appearance, user-select, transform, hyphens, text-size-adjust
    case 5349:
    case 4246:
    case 4810:
    case 6968:
    case 2756:
      return We + e + Ws + e + lt + e + e;
    // writing-mode
    case 5936:
      switch (zt(e, n + 11)) {
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
      return We + e + lt + "flex-item-" + Te(e, /flex-|-self/g, "") + (Dr(e, /flex-|baseline/) ? "" : lt + "grid-row-" + Te(e, /flex-|-self/g, "")) + e;
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
      if (!Dr(e, /flex-|baseline/)) return lt + "grid-column-align" + Yo(e, n) + e;
      break;
    // grid-template-(columns|rows)
    case 2592:
    case 3360:
      return lt + Te(e, "template-", "") + e;
    // grid-(row|column)-start
    case 4384:
    case 3616:
      return o && o.some(function(i, l) {
        return n = l, Dr(i.props, /grid-\w+-end/);
      }) ? ~Ku(e + (o = o[n].value), "span") ? e : lt + Te(e, "-start", "") + e + lt + "grid-row-span:" + (~Ku(o, "span") ? Dr(o, /\d+/) : +Dr(o, /\d+/) - +Dr(e, /\d+/)) + ";" : lt + Te(e, "-start", "") + e;
    // grid-(row|column)-end
    case 4896:
    case 4128:
      return o && o.some(function(i) {
        return Dr(i.props, /grid-\w+-start/);
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
      if (fr(e) - 1 - n > 6)
        switch (zt(e, n + 1)) {
          // (m)ax-content, (m)in-content
          case 109:
            if (zt(e, n + 4) !== 45)
              break;
          // (f)ill-available, (f)it-content
          case 102:
            return Te(e, /(.+:)(.+)-([^]+)/, "$1" + We + "$2-$3$1" + Ws + (zt(e, n + 3) == 108 ? "$3" : "$2-$3")) + e;
          // (s)tretch
          case 115:
            return ~Ku(e, "stretch") ? ey(Te(e, "stretch", "fill-available"), n, o) + e : e;
        }
      break;
    // grid-(column|row)
    case 5152:
    case 5920:
      return Te(e, /(.+?):(\d+)(\s*\/\s*(span)?\s*(\d+))?(.*)/, function(i, l, c, f, p, g, m) {
        return lt + l + ":" + c + m + (f ? lt + l + "-span:" + (p ? g : +g - +c) + m : "") + e;
      });
    // position: sticky
    case 4949:
      if (zt(e, n + 6) === 121)
        return Te(e, ":", ":" + We) + e;
      break;
    // display: (flex|inline-flex|grid|inline-grid)
    case 6444:
      switch (zt(e, zt(e, 14) === 45 ? 18 : 11)) {
        // (inline-)?fle(x)
        case 120:
          return Te(e, /(.+:)([^;\s!]+)(;|(\s+)?!.+)?/, "$1" + We + (zt(e, 14) === 45 ? "inline-" : "") + "box$3$1" + We + "$2$3$1" + lt + "$2box$3") + e;
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
function Qs(e, n) {
  for (var o = "", i = 0; i < e.length; i++)
    o += n(e[i], i, e, n) || "";
  return o;
}
function jm(e, n, o, i) {
  switch (e.type) {
    case sw:
      if (e.children.length) break;
    case ow:
    case iw:
    case zd:
      return e.return = e.return || e.value;
    case Y0:
      return "";
    case K0:
      return e.return = e.value + "{" + Qs(e.children, i) + "}";
    case Od:
      if (!fr(e.value = e.props.join(","))) return "";
  }
  return fr(o = Qs(e.children, i)) ? e.return = e.value + "{" + o + "}" : "";
}
function Sw(e) {
  var n = Z0(e);
  return function(o, i, l, c) {
    for (var f = "", p = 0; p < n; p++)
      f += e[p](o, i, l, c) || "";
    return f;
  };
}
function ww(e, n, o, i) {
  if (e.length > -1 && !e.return)
    switch (e.type) {
      case zd:
        e.return = ey(e.value, e.length, o);
        return;
      case K0:
        return Qs([mo(e, { value: Te(e.value, "@", "@" + We) })], i);
      case Od:
        if (e.length)
          return cw(o = e.props, function(l) {
            switch (Dr(l, i = /(::plac\w+|:read-\w+)/)) {
              // :read-(only|write)
              case ":read-only":
              case ":read-write":
                Ci(mo(e, { props: [Te(l, /:(read-\w+)/, ":" + Ws + "$1")] })), Ci(mo(e, { props: [l] })), Nf(e, { props: Am(o, i) });
                break;
              // :placeholder
              case "::placeholder":
                Ci(mo(e, { props: [Te(l, /:(plac\w+)/, ":" + We + "input-$1")] })), Ci(mo(e, { props: [Te(l, /:(plac\w+)/, ":" + Ws + "$1")] })), Ci(mo(e, { props: [Te(l, /:(plac\w+)/, lt + "input-$1")] })), Ci(mo(e, { props: [l] })), Nf(e, { props: Am(o, i) });
                break;
            }
            return "";
          });
    }
}
const Hm = "data-ant-cssinjs-cache-path", ty = "_FILE_STYLE__";
let Uo, ny = !0;
function Cw() {
  if (!Uo && (Uo = {}, Zn())) {
    const e = document.createElement("div");
    e.className = Hm, e.style.position = "fixed", e.style.visibility = "hidden", e.style.top = "-9999px", document.body.appendChild(e);
    let n = getComputedStyle(e).content || "";
    n = n.replace(/^"/, "").replace(/"$/, ""), n.split(";").forEach((i) => {
      const [l, c] = i.split(":");
      Uo[l] = c;
    });
    const o = document.querySelector(`style[${Hm}]`);
    o && (ny = !1, o.parentNode?.removeChild(o)), document.body.removeChild(e);
  }
}
function xw(e) {
  return Cw(), !!Uo[e];
}
function bw(e) {
  const n = Uo[e];
  let o = null;
  if (n && Zn())
    if (ny)
      o = ty;
    else {
      const i = document.querySelector(`style[${Hr}="${Uo[e]}"]`);
      i ? o = i.innerHTML : delete Uo[e];
    }
  return [o, n];
}
const Ew = "_skip_check_", ry = "_multi_value_";
function Zu(e, n) {
  return (n ? Qs(Lm(e), Sw([ww, jm])) : Qs(Lm(e), jm)).replace(/\{%%%\:[^;];}/g, ";");
}
function $w(e) {
  return typeof e == "object" && e && (Ew in e || ry in e);
}
function Vm(e, n, o = "high") {
  if (!n)
    return e;
  const i = q0({
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
const Tf = (e, n = {}, {
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
    transformers: m = [],
    linters: y = []
  } = n;
  let v = "", w = {};
  function x(E) {
    const P = E.getName(c);
    if (!w[P]) {
      const [N] = Tf(E.style, n, {
        root: !1,
        parentSelectors: l
      });
      w[P] = `@keyframes ${E.getName(c)}${N}`;
    }
  }
  function b(E, P = []) {
    return E.forEach((N) => {
      Array.isArray(N) ? b(N, P) : N && P.push(N);
    }), P;
  }
  return b(Array.isArray(e) ? e : [e]).forEach((E) => {
    const P = typeof E == "string" && !o ? {} : E;
    if (typeof P == "string")
      v += `${P}
`;
    else if (P._keyframe)
      x(P);
    else {
      const N = m.reduce((_, R) => R?.visit?.(_) || _, P);
      Object.keys(N).forEach((_) => {
        const R = N[_];
        if (typeof R == "object" && R && (_ !== "animationName" || !R._keyframe) && !$w(R)) {
          let M = !1, F = _.trim(), O = !1;
          (o || i) && c ? F.startsWith("@") ? M = !0 : F === "&" ? F = Vm("", c, g) : F = Vm(_, c, g) : o && !c && (F === "&" || F === "") && (F = "", O = !0);
          const [z, H] = Tf(R, n, {
            root: O,
            injectHash: M,
            parentSelectors: [...l, F]
          });
          w = {
            ...w,
            ...H
          }, v += `${F}${z}`;
        } else {
          let M = function(O, z) {
            const H = O.replace(/[A-Z]/g, (V) => `-${V.toLowerCase()}`);
            let Y = z;
            !rw[O] && typeof Y == "number" && Y !== 0 && (Y = `${Y}px`), O === "animationName" && z?._keyframe && (x(z), Y = z.getName(c)), v += `${H}:${Y};`;
          };
          const F = R?.value ?? R;
          typeof R == "object" && R?.[ry] && Array.isArray(F) ? F.forEach((O) => {
            M(_, O);
          }) : XS(F) && M(_, F);
        }
      });
    }
  }), o ? f && (v && (v = `@layer ${f.name} {${v}}`), f.dependencies && (w[`@layer ${f.name}`] = f.dependencies.map((E) => `@layer ${E}, ${f.name};`).join(`
`))) : v = `{${v}}`, [v, w];
};
function oy(e, n) {
  return Xs(`${e.join("%")}${n}`);
}
const Pw = "style";
function Mf(e, n) {
  const {
    path: o,
    hashId: i,
    layer: l,
    nonce: c,
    clientOnly: f,
    order: p = 0
  } = e, {
    mock: g,
    hashPriority: m,
    container: y,
    transformers: v,
    linters: w,
    cache: x,
    layer: b,
    autoPrefix: C
  } = h.useContext(Go), E = [i || ""];
  b && E.push("layer"), E.push(...o);
  let P = Rf;
  Fd(
    Pw,
    E,
    // Create cache if needed
    () => {
      const N = E.join("|");
      if (xw(N)) {
        const [z, H] = bw(N);
        if (z)
          return [z, H, {}, f, p];
      }
      const _ = n(), [R, M] = Tf(_, {
        hashId: i,
        hashPriority: m,
        layer: b ? l : void 0,
        path: o.join("-"),
        transformers: v,
        linters: w
      }), F = Zu(R, C || !1), O = oy(E, F);
      return [F, O, M, f, p];
    },
    // Remove cache if no need
    (N, _) => {
      const [, R] = N;
      _ && Rf && Gs(R, {
        mark: Hr,
        attachTo: y
      });
    },
    // Effect: Inject style here
    (N) => {
      const [_, R, M, , F] = N;
      if (P && _ !== ty) {
        let O = {
          mark: Hr,
          prepend: b ? !1 : "queue",
          attachTo: y,
          priority: F
        };
        O = Id(O, c);
        const z = [], H = [];
        Object.keys(M).forEach((V) => {
          V.startsWith("@layer") ? z.push(V) : H.push(V);
        }), z.forEach((V) => {
          Vo(Zu(M[V], C || !1), `_layer-${V}`, {
            ...O,
            prepend: !0
          });
        });
        const Y = Vo(_, R, O);
        Y[Wo] = x.instanceId, H.forEach((V) => {
          Vo(Zu(M[V], C || !1), `_effect-${V}`, O);
        });
      }
    }
  );
}
const _w = "cssVar", Rw = (e, n) => {
  const {
    key: o,
    prefix: i,
    unitless: l,
    ignore: c,
    token: f,
    hashId: p,
    scope: g,
    nonce: m
  } = e, {
    cache: {
      instanceId: y
    },
    container: v,
    hashPriority: w
  } = h.useContext(Go), {
    _tokenKey: x
  } = f, b = Array.isArray(g) ? g.join("@@") : g, C = [...e.path, o, b, x];
  return Fd(_w, C, () => {
    const P = n(), [N, _] = X0(P, o, {
      prefix: i,
      unitless: l,
      ignore: c,
      scope: g,
      hashPriority: w,
      hashCls: p
    }), R = oy(C, _);
    return [N, _, R, o];
  }, ([, , P]) => {
    Rf && Gs(P, {
      mark: Hr,
      attachTo: v
    });
  }, ([, P, N]) => {
    if (!P)
      return;
    let _ = {
      mark: Hr,
      prepend: "queue",
      attachTo: v,
      priority: -999
    };
    _ = Id(_, m);
    const R = Vo(P, N, _);
    R[Wo] = y, R.setAttribute(Td, o);
  });
};
class sn {
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
function xi(e) {
  return e.notSplit = !0, e;
}
xi(["borderTop", "borderBottom"]), xi(["borderTop"]), xi(["borderBottom"]), xi(["borderLeft", "borderRight"]), xi(["borderLeft"]), xi(["borderRight"]);
const wt = (e) => {
  const n = h.useRef(e);
  return n.current = e, h.useCallback((...i) => n.current?.(...i), []);
}, Wm = Zn() ? h.useLayoutEffect : h.useEffect, un = (e, n) => {
  const o = h.useRef(!0);
  Wm(() => e(o.current), n), Wm(() => (o.current = !1, () => {
    o.current = !0;
  }), []);
}, Ju = (e, n) => {
  un((o) => {
    if (!o)
      return e();
  }, n);
}, Nw = (e) => {
  const n = h.useRef(!1), [o, i] = h.useState(e);
  h.useEffect(() => (n.current = !1, () => {
    n.current = !0;
  }), []);
  function l(c, f) {
    f && n.current || i(c);
  }
  return [o, l];
};
function Zs(e, n) {
  const [o, i] = h.useState(e), l = n !== void 0 ? n : o;
  return un((c) => {
    c || i(n);
  }, [n]), [
    // Value
    l,
    // Update function
    i
  ];
}
let iy = (e) => +setTimeout(e, 16), sy = (e) => clearTimeout(e);
typeof window < "u" && "requestAnimationFrame" in window && (iy = (e) => window.requestAnimationFrame(e), sy = (e) => window.cancelAnimationFrame(e));
let Um = 0;
const Ad = /* @__PURE__ */ new Map();
function ly(e) {
  Ad.delete(e);
}
const vo = (e, n = 1) => {
  Um += 1;
  const o = Um;
  function i(l) {
    if (l === 0)
      ly(o), e();
    else {
      const c = iy(() => {
        i(l - 1);
      });
      Ad.set(o, c);
    }
  }
  return i(n), o;
};
vo.cancel = (e) => {
  const n = Ad.get(e);
  return ly(e), sy(n);
};
function kw() {
  return {
    ...NS
  }.useId;
}
let qm = 0;
const Xm = kw(), ol = Xm ? (
  // Use React `useId`
  (function(n) {
    const o = Xm();
    return n || o;
  })
) : (
  // Use compatible of `useId`
  (function(n) {
    const [o, i] = h.useState("ssr-id");
    return h.useEffect(() => {
      const l = qm;
      qm += 1, i(`rc_unique_${l}`);
    }, []), n || o;
  })
);
function Tw(e) {
  const [, n] = h.useReducer((c) => c + 1, 0), o = h.useRef(e), i = wt(() => o.current), l = wt((c) => {
    o.current = typeof c == "function" ? c(o.current) : c, n();
  });
  return [i, l];
}
var ef = { exports: {} }, Ye = {};
var Gm;
function Mw() {
  if (Gm) return Ye;
  Gm = 1;
  var e = /* @__PURE__ */ Symbol.for("react.transitional.element"), n = /* @__PURE__ */ Symbol.for("react.portal"), o = /* @__PURE__ */ Symbol.for("react.fragment"), i = /* @__PURE__ */ Symbol.for("react.strict_mode"), l = /* @__PURE__ */ Symbol.for("react.profiler"), c = /* @__PURE__ */ Symbol.for("react.consumer"), f = /* @__PURE__ */ Symbol.for("react.context"), p = /* @__PURE__ */ Symbol.for("react.forward_ref"), g = /* @__PURE__ */ Symbol.for("react.suspense"), m = /* @__PURE__ */ Symbol.for("react.suspense_list"), y = /* @__PURE__ */ Symbol.for("react.memo"), v = /* @__PURE__ */ Symbol.for("react.lazy"), w = /* @__PURE__ */ Symbol.for("react.view_transition"), x = /* @__PURE__ */ Symbol.for("react.client.reference");
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
            case m:
            case w:
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
  return Ye.ContextConsumer = c, Ye.ContextProvider = f, Ye.Element = e, Ye.ForwardRef = p, Ye.Fragment = o, Ye.Lazy = v, Ye.Memo = y, Ye.Portal = n, Ye.Profiler = l, Ye.StrictMode = i, Ye.Suspense = g, Ye.SuspenseList = m, Ye.isContextConsumer = function(C) {
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
    return b(C) === m;
  }, Ye.isValidElementType = function(C) {
    return typeof C == "string" || typeof C == "function" || C === o || C === l || C === i || C === g || C === m || typeof C == "object" && C !== null && (C.$$typeof === v || C.$$typeof === y || C.$$typeof === f || C.$$typeof === c || C.$$typeof === p || C.$$typeof === x || C.getModuleId !== void 0);
  }, Ye.typeOf = b, Ye;
}
var Ym;
function Iw() {
  return Ym || (Ym = 1, ef.exports = /* @__PURE__ */ Mw()), ef.exports;
}
var tf = /* @__PURE__ */ Iw();
const Fw = /* @__PURE__ */ Symbol.for("react.element"), Ow = /* @__PURE__ */ Symbol.for("react.transitional.element"), zw = /* @__PURE__ */ Symbol.for("react.fragment");
function ay(e) {
  return (
    // Base object type
    e && typeof e == "object" && // React Element type
    (e.$$typeof === Fw || e.$$typeof === Ow) && // React Fragment type
    e.type === zw
  );
}
const Aw = Number(h.version.split(".")[0]), Lw = (e, n) => {
  typeof e == "function" ? e(n) : typeof e == "object" && e && "current" in e && (e.current = n);
}, il = (...e) => {
  const n = e.filter(Boolean);
  return n.length <= 1 ? n[0] : (o) => {
    e.forEach((i) => {
      Lw(i, o);
    });
  };
}, Ld = (...e) => nc(
  () => il(...e),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  e,
  (n, o) => n.length !== o.length || n.every((i, l) => i !== o[l])
), Bd = (e) => {
  if (!e)
    return !1;
  if (Dd(e) && Aw >= 19)
    return !0;
  const n = tf.isMemo(e) ? e.type.type : e.type;
  return !(typeof n == "function" && !n.prototype?.render && n.$$typeof !== tf.ForwardRef || typeof e == "function" && !e.prototype?.render && e.$$typeof !== tf.ForwardRef);
};
function Dd(e) {
  return /* @__PURE__ */ h.isValidElement(e) && !ay(e);
}
const Bw = (e) => Dd(e) && Bd(e), sc = (e) => {
  if (e && Dd(e)) {
    const n = e;
    return n.props.propertyIsEnumerable("ref") ? n.props.ref : n.ref;
  }
  return null;
};
function Ii(e) {
  return e instanceof HTMLElement || e instanceof SVGElement;
}
function jd(e) {
  return e && typeof e == "object" && Ii(e.nativeElement) ? e.nativeElement : Ii(e) ? e : null;
}
const Dw = ((e) => {
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
function jw(e, n) {
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
function cy(e) {
  return e?.getRootNode?.();
}
function Hw(e) {
  return cy(e) instanceof ShadowRoot;
}
function If(e) {
  return Hw(e) ? cy(e) : null;
}
const Ds = {
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
function Vw(e) {
  const n = `rc-scrollbar-measure-${Math.random().toString(36).substring(7)}`, o = document.createElement("div");
  o.id = n;
  const i = o.style;
  i.position = "absolute", i.left = "0", i.top = "0", i.width = "100px", i.height = "100px", i.overflow = "scroll";
  let l, c;
  if (e) {
    const g = getComputedStyle(e);
    i.scrollbarColor = g.scrollbarColor, i.scrollbarWidth = g.scrollbarWidth;
    const m = getComputedStyle(e, "::-webkit-scrollbar"), y = parseInt(m.width, 10), v = parseInt(m.height, 10);
    try {
      const w = y ? `width: ${m.width};` : "", x = v ? `height: ${m.height};` : "";
      Vo(`
#${n}::-webkit-scrollbar {
${w}
${x}
}`, n);
    } catch (w) {
      console.error(w), l = y, c = v;
    }
  }
  document.body.appendChild(o);
  const f = e && l && !Number.isNaN(l) ? l : o.offsetWidth - o.clientWidth, p = e && c && !Number.isNaN(c) ? c : o.offsetHeight - o.clientHeight;
  return document.body.removeChild(o), Gs(n), {
    width: f,
    height: p
  };
}
function Ww(e) {
  return typeof document > "u" || !e || !(e instanceof Element) ? {
    width: 0,
    height: 0
  } : Vw(e);
}
var Ps = { exports: {} }, Km;
function Uw() {
  if (Km) return Ps.exports;
  Km = 1, Ps.exports = i, Ps.exports.isMobile = i, Ps.exports.default = i;
  const e = /(android|bb\d+|meego).+mobile|armv7l|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|redmi|series[46]0|samsungbrowser.*mobile|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i, n = /CrOS/, o = /android|ipad|playbook|silk/i;
  function i(l) {
    l || (l = {});
    let c = l.ua;
    if (!c && typeof navigator < "u" && (c = navigator.userAgent), c && c.headers && typeof c.headers["user-agent"] == "string" && (c = c.headers["user-agent"]), typeof c != "string") return !1;
    let f = e.test(c) && !n.test(c) || !!l.tablet && o.test(c);
    return !f && l.tablet && l.featureDetect && navigator && navigator.maxTouchPoints > 1 && c.indexOf("Macintosh") !== -1 && c.indexOf("Safari") !== -1 && (f = !0), f;
  }
  return Ps.exports;
}
Uw();
function Va(e, n) {
  const o = Object.assign({}, e);
  return Array.isArray(n) && n.forEach((i) => {
    delete o[i];
  }), o;
}
const qw = `accept acceptCharset accessKey action allowFullScreen allowTransparency
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
    summary tabIndex target title type useMap value width wmode wrap`, Xw = `onCopy onCut onPaste onCompositionEnd onCompositionStart onCompositionUpdate onKeyDown
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
    onAuxClick onToggle onBeforeToggle onCancel onClose onResize onScrollEnd`, Gw = `${qw} ${Xw}`.split(/[\s\n]+/), Yw = "aria-", Kw = "data-";
function Qm(e, n) {
  return e.indexOf(n) === 0;
}
function Qw(e, n = !1) {
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
    (o.aria && (l === "role" || Qm(l, Yw)) || // Data
    o.data && Qm(l, Kw) || // Attr
    o.attr && Gw.includes(l)) && (i[l] = e[l]);
  }), i;
}
function Zw(e, n) {
  return typeof Proxy < "u" && e ? new Proxy(e, {
    get(o, i) {
      if (n[i])
        return n[i];
      const l = o[i];
      return typeof l == "function" ? l.bind(o) : l;
    }
  }) : e;
}
function Js(e, n = {}) {
  let o = [];
  return ye.Children.forEach(e, (i) => {
    i == null && !n.keepEmpty || (Array.isArray(i) ? o = o.concat(Js(i)) : ay(i) && i.props ? o = o.concat(Js(i.props.children, n)) : o.push(i));
  }), o;
}
function Qn(e, n) {
  let o = e;
  for (let i = 0; i < n.length; i += 1) {
    if (o == null)
      return;
    o = o[n[i]];
  }
  return o;
}
function uy(e, n, o, i) {
  if (!n.length)
    return o;
  const [l, ...c] = n;
  let f;
  return !e && typeof l == "number" ? f = [] : Array.isArray(e) ? f = [...e] : f = {
    ...e
  }, i && o === void 0 && c.length === 1 ? delete f[l][c[0]] : f[l] = uy(f[l], c, o, i), f;
}
function Mn(e, n, o, i = !1) {
  return n.length && i && o === void 0 && !Qn(e, n.slice(0, -1)) ? e : uy(e, n, o, i);
}
function Jw(e) {
  return typeof e == "object" && e !== null && Object.getPrototypeOf(e) === Object.prototype;
}
function Zm(e) {
  return Array.isArray(e) ? [] : {};
}
const eC = typeof Reflect > "u" ? Object.keys : Reflect.ownKeys;
function tC(e, n = {}) {
  const {
    prepareArray: o
  } = n, i = o || (() => []);
  let l = Zm(e[0]);
  return e.forEach((c) => {
    function f(p, g) {
      const m = new Set(g), y = Qn(c, p), v = Array.isArray(y);
      if (v || Jw(y)) {
        if (!m.has(y)) {
          m.add(y);
          const w = Qn(l, p);
          v ? l = Mn(l, p, i(w, y)) : (!w || typeof w != "object") && (l = Mn(l, p, Zm(y))), eC(y).forEach((x) => {
            Object.getOwnPropertyDescriptor(y, x).enumerable && f([...p, x], m);
          });
        }
      } else
        l = Mn(l, p, y);
    }
    f([]);
  }), l;
}
function Ni(...e) {
  return tC(e);
}
var pa = {}, nf = { exports: {} }, Cn = {}, rf = { exports: {} }, of = {};
var Jm;
function nC() {
  return Jm || (Jm = 1, (function(e) {
    function n(j, J) {
      var U = j.length;
      j.push(J);
      e: for (; 0 < U; ) {
        var k = U - 1 >>> 1, A = j[k];
        if (0 < l(A, J)) j[k] = J, j[U] = A, U = k;
        else break e;
      }
    }
    function o(j) {
      return j.length === 0 ? null : j[0];
    }
    function i(j) {
      if (j.length === 0) return null;
      var J = j[0], U = j.pop();
      if (U !== J) {
        j[0] = U;
        e: for (var k = 0, A = j.length, ee = A >>> 1; k < ee; ) {
          var te = 2 * (k + 1) - 1, se = j[te], re = te + 1, fe = j[re];
          if (0 > l(se, U)) re < A && 0 > l(fe, se) ? (j[k] = fe, j[re] = U, k = re) : (j[k] = se, j[te] = U, k = te);
          else if (re < A && 0 > l(fe, U)) j[k] = fe, j[re] = U, k = re;
          else break e;
        }
      }
      return J;
    }
    function l(j, J) {
      var U = j.sortIndex - J.sortIndex;
      return U !== 0 ? U : j.id - J.id;
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
    var g = [], m = [], y = 1, v = null, w = 3, x = !1, b = !1, C = !1, E = typeof setTimeout == "function" ? setTimeout : null, P = typeof clearTimeout == "function" ? clearTimeout : null, N = typeof setImmediate < "u" ? setImmediate : null;
    typeof navigator < "u" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 && navigator.scheduling.isInputPending.bind(navigator.scheduling);
    function _(j) {
      for (var J = o(m); J !== null; ) {
        if (J.callback === null) i(m);
        else if (J.startTime <= j) i(m), J.sortIndex = J.expirationTime, n(g, J);
        else break;
        J = o(m);
      }
    }
    function R(j) {
      if (C = !1, _(j), !b) if (o(g) !== null) b = !0, le(M);
      else {
        var J = o(m);
        J !== null && he(R, J.startTime - j);
      }
    }
    function M(j, J) {
      b = !1, C && (C = !1, P(z), z = -1), x = !0;
      var U = w;
      try {
        for (_(J), v = o(g); v !== null && (!(v.expirationTime > J) || j && !V()); ) {
          var k = v.callback;
          if (typeof k == "function") {
            v.callback = null, w = v.priorityLevel;
            var A = k(v.expirationTime <= J);
            J = e.unstable_now(), typeof A == "function" ? v.callback = A : v === o(g) && i(g), _(J);
          } else i(g);
          v = o(g);
        }
        if (v !== null) var ee = !0;
        else {
          var te = o(m);
          te !== null && he(R, te.startTime - J), ee = !1;
        }
        return ee;
      } finally {
        v = null, w = U, x = !1;
      }
    }
    var F = !1, O = null, z = -1, H = 5, Y = -1;
    function V() {
      return !(e.unstable_now() - Y < H);
    }
    function X() {
      if (O !== null) {
        var j = e.unstable_now();
        Y = j;
        var J = !0;
        try {
          J = O(!0, j);
        } finally {
          J ? Q() : (F = !1, O = null);
        }
      } else F = !1;
    }
    var Q;
    if (typeof N == "function") Q = function() {
      N(X);
    };
    else if (typeof MessageChannel < "u") {
      var oe = new MessageChannel(), G = oe.port2;
      oe.port1.onmessage = X, Q = function() {
        G.postMessage(null);
      };
    } else Q = function() {
      E(X, 0);
    };
    function le(j) {
      O = j, F || (F = !0, Q());
    }
    function he(j, J) {
      z = E(function() {
        j(e.unstable_now());
      }, J);
    }
    e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(j) {
      j.callback = null;
    }, e.unstable_continueExecution = function() {
      b || x || (b = !0, le(M));
    }, e.unstable_forceFrameRate = function(j) {
      0 > j || 125 < j ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : H = 0 < j ? Math.floor(1e3 / j) : 5;
    }, e.unstable_getCurrentPriorityLevel = function() {
      return w;
    }, e.unstable_getFirstCallbackNode = function() {
      return o(g);
    }, e.unstable_next = function(j) {
      switch (w) {
        case 1:
        case 2:
        case 3:
          var J = 3;
          break;
        default:
          J = w;
      }
      var U = w;
      w = J;
      try {
        return j();
      } finally {
        w = U;
      }
    }, e.unstable_pauseExecution = function() {
    }, e.unstable_requestPaint = function() {
    }, e.unstable_runWithPriority = function(j, J) {
      switch (j) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          j = 3;
      }
      var U = w;
      w = j;
      try {
        return J();
      } finally {
        w = U;
      }
    }, e.unstable_scheduleCallback = function(j, J, U) {
      var k = e.unstable_now();
      switch (typeof U == "object" && U !== null ? (U = U.delay, U = typeof U == "number" && 0 < U ? k + U : k) : U = k, j) {
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
      return A = U + A, j = { id: y++, callback: J, priorityLevel: j, startTime: U, expirationTime: A, sortIndex: -1 }, U > k ? (j.sortIndex = U, n(m, j), o(g) === null && j === o(m) && (C ? (P(z), z = -1) : C = !0, he(R, U - k))) : (j.sortIndex = A, n(g, j), b || x || (b = !0, le(M))), j;
    }, e.unstable_shouldYield = V, e.unstable_wrapCallback = function(j) {
      var J = w;
      return function() {
        var U = w;
        w = J;
        try {
          return j.apply(this, arguments);
        } finally {
          w = U;
        }
      };
    };
  })(of)), of;
}
var eg;
function rC() {
  return eg || (eg = 1, rf.exports = nC()), rf.exports;
}
var tg;
function oC() {
  if (tg) return Cn;
  tg = 1;
  var e = Nd(), n = rC();
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
  var p = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), g = Object.prototype.hasOwnProperty, m = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, y = {}, v = {};
  function w(t) {
    return g.call(v, t) ? !0 : g.call(y, t) ? !1 : m.test(t) ? v[t] = !0 : (y[t] = !0, !1);
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
  function C(t, r, s, a, u, d, S) {
    this.acceptsBooleans = r === 2 || r === 3 || r === 4, this.attributeName = a, this.attributeNamespace = u, this.mustUseProperty = s, this.propertyName = t, this.type = r, this.sanitizeURL = d, this.removeEmptyString = S;
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
  var P = /[\-:]([a-z])/g;
  function N(t) {
    return t[1].toUpperCase();
  }
  "accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(t) {
    var r = t.replace(
      P,
      N
    );
    E[r] = new C(r, 1, !1, t, null, !1, !1);
  }), "xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(t) {
    var r = t.replace(P, N);
    E[r] = new C(r, 1, !1, t, "http://www.w3.org/1999/xlink", !1, !1);
  }), ["xml:base", "xml:lang", "xml:space"].forEach(function(t) {
    var r = t.replace(P, N);
    E[r] = new C(r, 1, !1, t, "http://www.w3.org/XML/1998/namespace", !1, !1);
  }), ["tabIndex", "crossOrigin"].forEach(function(t) {
    E[t] = new C(t, 1, !1, t.toLowerCase(), null, !1, !1);
  }), E.xlinkHref = new C("xlinkHref", 1, !1, "xlink:href", "http://www.w3.org/1999/xlink", !0, !1), ["src", "href", "action", "formAction"].forEach(function(t) {
    E[t] = new C(t, 1, !1, t.toLowerCase(), null, !0, !0);
  });
  function _(t, r, s, a) {
    var u = E.hasOwnProperty(r) ? E[r] : null;
    (u !== null ? u.type !== 0 : a || !(2 < r.length) || r[0] !== "o" && r[0] !== "O" || r[1] !== "n" && r[1] !== "N") && (b(r, s, u, a) && (s = null), a || u === null ? w(r) && (s === null ? t.removeAttribute(r) : t.setAttribute(r, "" + s)) : u.mustUseProperty ? t[u.propertyName] = s === null ? u.type === 3 ? !1 : "" : s : (r = u.attributeName, a = u.attributeNamespace, s === null ? t.removeAttribute(r) : (u = u.type, s = u === 3 || u === 4 && s === !0 ? "" : "" + s, a ? t.setAttributeNS(a, r, s) : t.setAttribute(r, s))));
  }
  var R = e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, M = /* @__PURE__ */ Symbol.for("react.element"), F = /* @__PURE__ */ Symbol.for("react.portal"), O = /* @__PURE__ */ Symbol.for("react.fragment"), z = /* @__PURE__ */ Symbol.for("react.strict_mode"), H = /* @__PURE__ */ Symbol.for("react.profiler"), Y = /* @__PURE__ */ Symbol.for("react.provider"), V = /* @__PURE__ */ Symbol.for("react.context"), X = /* @__PURE__ */ Symbol.for("react.forward_ref"), Q = /* @__PURE__ */ Symbol.for("react.suspense"), oe = /* @__PURE__ */ Symbol.for("react.suspense_list"), G = /* @__PURE__ */ Symbol.for("react.memo"), le = /* @__PURE__ */ Symbol.for("react.lazy"), he = /* @__PURE__ */ Symbol.for("react.offscreen"), j = Symbol.iterator;
  function J(t) {
    return t === null || typeof t != "object" ? null : (t = j && t[j] || t["@@iterator"], typeof t == "function" ? t : null);
  }
  var U = Object.assign, k;
  function A(t) {
    if (k === void 0) try {
      throw Error();
    } catch (s) {
      var r = s.stack.trim().match(/\n( *(at )?)/);
      k = r && r[1] || "";
    }
    return `
` + k + t;
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
        } catch (D) {
          var a = D;
        }
        Reflect.construct(t, [], r);
      } else {
        try {
          r.call();
        } catch (D) {
          a = D;
        }
        t.call(r.prototype);
      }
      else {
        try {
          throw Error();
        } catch (D) {
          a = D;
        }
        t();
      }
    } catch (D) {
      if (D && a && typeof D.stack == "string") {
        for (var u = D.stack.split(`
`), d = a.stack.split(`
`), S = u.length - 1, $ = d.length - 1; 1 <= S && 0 <= $ && u[S] !== d[$]; ) $--;
        for (; 1 <= S && 0 <= $; S--, $--) if (u[S] !== d[$]) {
          if (S !== 1 || $ !== 1)
            do
              if (S--, $--, 0 > $ || u[S] !== d[$]) {
                var T = `
` + u[S].replace(" at new ", " at ");
                return t.displayName && T.includes("<anonymous>") && (T = T.replace("<anonymous>", t.displayName)), T;
              }
            while (1 <= S && 0 <= $);
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
      case O:
        return "Fragment";
      case F:
        return "Portal";
      case H:
        return "Profiler";
      case z:
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
        return r === z ? "StrictMode" : "Mode";
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
      }, set: function(S) {
        a = "" + S, d.call(this, S);
      } }), Object.defineProperty(t, r, { enumerable: s.enumerable }), { getValue: function() {
        return a;
      }, setValue: function(S) {
        a = "" + S;
      }, stopTracking: function() {
        t._valueTracker = null, delete t[r];
      } };
    }
  }
  function ce(t) {
    t._valueTracker || (t._valueTracker = ae(t));
  }
  function ke(t) {
    if (!t) return !1;
    var r = t._valueTracker;
    if (!r) return !0;
    var s = r.getValue(), a = "";
    return t && (a = Z(t) ? t.checked ? "true" : "false" : t.value), t = a, t !== s ? (r.setValue(t), !0) : !1;
  }
  function qe(t) {
    if (t = t || (typeof document < "u" ? document : void 0), typeof t > "u") return null;
    try {
      return t.activeElement || t.body;
    } catch {
      return t.body;
    }
  }
  function Qe(t, r) {
    var s = r.checked;
    return U({}, r, { defaultChecked: void 0, defaultValue: void 0, value: void 0, checked: s ?? t._wrapperState.initialChecked });
  }
  function Ne(t, r) {
    var s = r.defaultValue == null ? "" : r.defaultValue, a = r.checked != null ? r.checked : r.defaultChecked;
    s = ie(r.value != null ? r.value : s), t._wrapperState = { initialChecked: a, initialValue: s, controlled: r.type === "checkbox" || r.type === "radio" ? r.checked != null : r.value != null };
  }
  function Xe(t, r) {
    r = r.checked, r != null && _(t, "checked", r, !1);
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
  function ze(t, r, s) {
    if (r.hasOwnProperty("value") || r.hasOwnProperty("defaultValue")) {
      var a = r.type;
      if (!(a !== "submit" && a !== "reset" || r.value !== void 0 && r.value !== null)) return;
      r = "" + t._wrapperState.initialValue, s || r === t.value || (t.value = r), t.defaultValue = r;
    }
    s = t.name, s !== "" && (t.name = ""), t.defaultChecked = !!t._wrapperState.initialChecked, s !== "" && (t.name = s);
  }
  function xt(t, r, s) {
    (r !== "number" || qe(t.ownerDocument) !== t) && (s == null ? t.defaultValue = "" + t._wrapperState.initialValue : t.defaultValue !== "" + s && (t.defaultValue = "" + s));
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
  function He(t, r) {
    if (r.dangerouslySetInnerHTML != null) throw Error(o(91));
    return U({}, r, { value: void 0, defaultValue: void 0, children: "" + t._wrapperState.initialValue });
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
  function fn(t) {
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
  function Wt(t, r) {
    return t == null || t === "http://www.w3.org/1999/xhtml" ? Rt(r) : t === "http://www.w3.org/2000/svg" && r === "foreignObject" ? "http://www.w3.org/1999/xhtml" : t;
  }
  var Ut, Nt = (function(t) {
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
  var kt = {
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
  }, Ue = ["Webkit", "ms", "Moz", "O"];
  Object.keys(kt).forEach(function(t) {
    Ue.forEach(function(r) {
      r = r + t.charAt(0).toUpperCase() + t.substring(1), kt[r] = kt[t];
    });
  });
  function Yt(t, r, s) {
    return r == null || typeof r == "boolean" || r === "" ? "" : s || typeof r != "number" || r === 0 || kt.hasOwnProperty(t) && kt[t] ? ("" + r).trim() : r + "px";
  }
  function Ve(t, r) {
    t = t.style;
    for (var s in r) if (r.hasOwnProperty(s)) {
      var a = s.indexOf("--") === 0, u = Yt(s, r[s], a);
      s === "float" && (s = "cssFloat"), a ? t.setProperty(s, u) : t[s] = u;
    }
  }
  var Ae = U({ menuitem: !0 }, { area: !0, base: !0, br: !0, col: !0, embed: !0, hr: !0, img: !0, input: !0, keygen: !0, link: !0, meta: !0, param: !0, source: !0, track: !0, wbr: !0 });
  function Oe(t, r) {
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
  function qt(t) {
    return t = t.target || t.srcElement || window, t.correspondingUseElement && (t = t.correspondingUseElement), t.nodeType === 3 ? t.parentNode : t;
  }
  var nt = null, Kt = null, Tt = null;
  function En(t) {
    if (t = fs(t)) {
      if (typeof nt != "function") throw Error(o(280));
      var r = t.stateNode;
      r && (r = _l(r), nt(t.stateNode, t.type, r));
    }
  }
  function $n(t) {
    Kt ? Tt ? Tt.push(t) : Tt = [t] : Kt = t;
  }
  function de() {
    if (Kt) {
      var t = Kt, r = Tt;
      if (Tt = Kt = null, En(t), r) for (t = 0; t < r.length; t++) En(r[t]);
    }
  }
  function Ee(t, r) {
    return t(r);
  }
  function Ce() {
  }
  var Et = !1;
  function Qt(t, r, s) {
    if (Et) return t(r, s);
    Et = !0;
    try {
      return Ee(t, r, s);
    } finally {
      Et = !1, (Kt !== null || Tt !== null) && (Ce(), de());
    }
  }
  function Mt(t, r) {
    var s = t.stateNode;
    if (s === null) return null;
    var a = _l(s);
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
  var zn = !1;
  if (p) try {
    var ln = {};
    Object.defineProperty(ln, "passive", { get: function() {
      zn = !0;
    } }), window.addEventListener("test", ln, ln), window.removeEventListener("test", ln, ln);
  } catch {
    zn = !1;
  }
  function mr(t, r, s, a, u, d, S, $, T) {
    var D = Array.prototype.slice.call(arguments, 3);
    try {
      r.apply(s, D);
    } catch (q) {
      this.onError(q);
    }
  }
  var An = !1, nr = null, Pn = !1, rr = null, dn = { onError: function(t) {
    An = !0, nr = t;
  } };
  function Zt(t, r, s, a, u, d, S, $, T) {
    An = !1, nr = null, mr.apply(dn, arguments);
  }
  function It(t, r, s, a, u, d, S, $, T) {
    if (Zt.apply(this, arguments), An) {
      if (An) {
        var D = nr;
        An = !1, nr = null;
      } else throw Error(o(198));
      Pn || (Pn = !0, rr = D);
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
  function pn(t) {
    if (t.tag === 13) {
      var r = t.memoizedState;
      if (r === null && (t = t.alternate, t !== null && (r = t.memoizedState)), r !== null) return r.dehydrated;
    }
    return null;
  }
  function Lt(t) {
    if (yt(t) !== t) throw Error(o(188));
  }
  function hn(t) {
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
        for (var S = !1, $ = u.child; $; ) {
          if ($ === s) {
            S = !0, s = u, a = d;
            break;
          }
          if ($ === a) {
            S = !0, a = u, s = d;
            break;
          }
          $ = $.sibling;
        }
        if (!S) {
          for ($ = d.child; $; ) {
            if ($ === s) {
              S = !0, s = d, a = u;
              break;
            }
            if ($ === a) {
              S = !0, a = d, s = u;
              break;
            }
            $ = $.sibling;
          }
          if (!S) throw Error(o(189));
        }
      }
      if (s.alternate !== a) throw Error(o(190));
    }
    if (s.tag !== 3) throw Error(o(188));
    return s.stateNode.current === s ? t : r;
  }
  function qr(t) {
    return t = hn(t), t !== null ? rt(t) : null;
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
  var gr = n.unstable_scheduleCallback, Xr = n.unstable_cancelCallback, dt = n.unstable_shouldYield, Jt = n.unstable_requestPaint, Be = n.unstable_now, Ln = n.unstable_getCurrentPriorityLevel, Bn = n.unstable_ImmediatePriority, _r = n.unstable_UserBlockingPriority, en = n.unstable_NormalPriority, Rr = n.unstable_LowPriority, Dn = n.unstable_IdlePriority, mn = null, at = null;
  function Re(t) {
    if (at && typeof at.onCommitFiberRoot == "function") try {
      at.onCommitFiberRoot(mn, t, void 0, (t.current.flags & 128) === 128);
    } catch {
    }
  }
  var et = Math.clz32 ? Math.clz32 : Nr, Bt = Math.log, wo = Math.LN2;
  function Nr(t) {
    return t >>>= 0, t === 0 ? 32 : 31 - (Bt(t) / wo | 0) | 0;
  }
  var kr = 64, Tr = 4194304;
  function yr(t) {
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
  function Co(t, r) {
    var s = t.pendingLanes;
    if (s === 0) return 0;
    var a = 0, u = t.suspendedLanes, d = t.pingedLanes, S = s & 268435455;
    if (S !== 0) {
      var $ = S & ~u;
      $ !== 0 ? a = yr($) : (d &= S, d !== 0 && (a = yr(d)));
    } else S = s & ~u, S !== 0 ? a = yr(S) : d !== 0 && (a = yr(d));
    if (a === 0) return 0;
    if (r !== 0 && r !== a && (r & u) === 0 && (u = a & -a, d = r & -r, u >= d || u === 16 && (d & 4194240) !== 0)) return r;
    if ((a & 4) !== 0 && (a |= s & 16), r = t.entangledLanes, r !== 0) for (t = t.entanglements, r &= a; 0 < r; ) s = 31 - et(r), u = 1 << s, a |= t[s], r &= ~u;
    return a;
  }
  function qi(t, r) {
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
  function Xi(t, r) {
    for (var s = t.suspendedLanes, a = t.pingedLanes, u = t.expirationTimes, d = t.pendingLanes; 0 < d; ) {
      var S = 31 - et(d), $ = 1 << S, T = u[S];
      T === -1 ? (($ & s) === 0 || ($ & a) !== 0) && (u[S] = qi($, r)) : T <= r && (t.expiredLanes |= $), d &= ~$;
    }
  }
  function Gi(t) {
    return t = t.pendingLanes & -1073741825, t !== 0 ? t : t & 1073741824 ? 1073741824 : 0;
  }
  function ue() {
    var t = kr;
    return kr <<= 1, (kr & 4194240) === 0 && (kr = 64), t;
  }
  function Fe(t) {
    for (var r = [], s = 0; 31 > s; s++) r.push(t);
    return r;
  }
  function vr(t, r, s) {
    t.pendingLanes |= r, r !== 536870912 && (t.suspendedLanes = 0, t.pingedLanes = 0), t = t.eventTimes, r = 31 - et(r), t[r] = s;
  }
  function gc(t, r) {
    var s = t.pendingLanes & ~r;
    t.pendingLanes = r, t.suspendedLanes = 0, t.pingedLanes = 0, t.expiredLanes &= r, t.mutableReadLanes &= r, t.entangledLanes &= r, r = t.entanglements;
    var a = t.eventTimes;
    for (t = t.expirationTimes; 0 < s; ) {
      var u = 31 - et(s), d = 1 << u;
      r[u] = 0, a[u] = -1, t[u] = -1, s &= ~d;
    }
  }
  function Zo(t, r) {
    var s = t.entangledLanes |= r;
    for (t = t.entanglements; s; ) {
      var a = 31 - et(s), u = 1 << a;
      u & r | t[a] & r && (t[a] |= r), s &= ~u;
    }
  }
  var De = 0;
  function fl(t) {
    return t &= -t, 1 < t ? 4 < t ? (t & 268435455) !== 0 ? 16 : 536870912 : 4 : 1;
  }
  var cp, yc, up, fp, dp, vc = !1, dl = [], Gr = null, Yr = null, Kr = null, Yi = /* @__PURE__ */ new Map(), Ki = /* @__PURE__ */ new Map(), Qr = [], Yv = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
  function pp(t, r) {
    switch (t) {
      case "focusin":
      case "focusout":
        Gr = null;
        break;
      case "dragenter":
      case "dragleave":
        Yr = null;
        break;
      case "mouseover":
      case "mouseout":
        Kr = null;
        break;
      case "pointerover":
      case "pointerout":
        Yi.delete(r.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        Ki.delete(r.pointerId);
    }
  }
  function Qi(t, r, s, a, u, d) {
    return t === null || t.nativeEvent !== d ? (t = { blockedOn: r, domEventName: s, eventSystemFlags: a, nativeEvent: d, targetContainers: [u] }, r !== null && (r = fs(r), r !== null && yc(r)), t) : (t.eventSystemFlags |= a, r = t.targetContainers, u !== null && r.indexOf(u) === -1 && r.push(u), t);
  }
  function Kv(t, r, s, a, u) {
    switch (r) {
      case "focusin":
        return Gr = Qi(Gr, t, r, s, a, u), !0;
      case "dragenter":
        return Yr = Qi(Yr, t, r, s, a, u), !0;
      case "mouseover":
        return Kr = Qi(Kr, t, r, s, a, u), !0;
      case "pointerover":
        var d = u.pointerId;
        return Yi.set(d, Qi(Yi.get(d) || null, t, r, s, a, u)), !0;
      case "gotpointercapture":
        return d = u.pointerId, Ki.set(d, Qi(Ki.get(d) || null, t, r, s, a, u)), !0;
    }
    return !1;
  }
  function hp(t) {
    var r = xo(t.target);
    if (r !== null) {
      var s = yt(r);
      if (s !== null) {
        if (r = s.tag, r === 13) {
          if (r = pn(s), r !== null) {
            t.blockedOn = r, dp(t.priority, function() {
              up(s);
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
  function pl(t) {
    if (t.blockedOn !== null) return !1;
    for (var r = t.targetContainers; 0 < r.length; ) {
      var s = wc(t.domEventName, t.eventSystemFlags, r[0], t.nativeEvent);
      if (s === null) {
        s = t.nativeEvent;
        var a = new s.constructor(s.type, s);
        gt = a, s.target.dispatchEvent(a), gt = null;
      } else return r = fs(s), r !== null && yc(r), t.blockedOn = s, !1;
      r.shift();
    }
    return !0;
  }
  function mp(t, r, s) {
    pl(t) && s.delete(r);
  }
  function Qv() {
    vc = !1, Gr !== null && pl(Gr) && (Gr = null), Yr !== null && pl(Yr) && (Yr = null), Kr !== null && pl(Kr) && (Kr = null), Yi.forEach(mp), Ki.forEach(mp);
  }
  function Zi(t, r) {
    t.blockedOn === r && (t.blockedOn = null, vc || (vc = !0, n.unstable_scheduleCallback(n.unstable_NormalPriority, Qv)));
  }
  function Ji(t) {
    function r(u) {
      return Zi(u, t);
    }
    if (0 < dl.length) {
      Zi(dl[0], t);
      for (var s = 1; s < dl.length; s++) {
        var a = dl[s];
        a.blockedOn === t && (a.blockedOn = null);
      }
    }
    for (Gr !== null && Zi(Gr, t), Yr !== null && Zi(Yr, t), Kr !== null && Zi(Kr, t), Yi.forEach(r), Ki.forEach(r), s = 0; s < Qr.length; s++) a = Qr[s], a.blockedOn === t && (a.blockedOn = null);
    for (; 0 < Qr.length && (s = Qr[0], s.blockedOn === null); ) hp(s), s.blockedOn === null && Qr.shift();
  }
  var Jo = R.ReactCurrentBatchConfig, hl = !0;
  function Zv(t, r, s, a) {
    var u = De, d = Jo.transition;
    Jo.transition = null;
    try {
      De = 1, Sc(t, r, s, a);
    } finally {
      De = u, Jo.transition = d;
    }
  }
  function Jv(t, r, s, a) {
    var u = De, d = Jo.transition;
    Jo.transition = null;
    try {
      De = 4, Sc(t, r, s, a);
    } finally {
      De = u, Jo.transition = d;
    }
  }
  function Sc(t, r, s, a) {
    if (hl) {
      var u = wc(t, r, s, a);
      if (u === null) Ac(t, r, a, ml, s), pp(t, a);
      else if (Kv(u, t, r, s, a)) a.stopPropagation();
      else if (pp(t, a), r & 4 && -1 < Yv.indexOf(t)) {
        for (; u !== null; ) {
          var d = fs(u);
          if (d !== null && cp(d), d = wc(t, r, s, a), d === null && Ac(t, r, a, ml, s), d === u) break;
          u = d;
        }
        u !== null && a.stopPropagation();
      } else Ac(t, r, a, null, s);
    }
  }
  var ml = null;
  function wc(t, r, s, a) {
    if (ml = null, t = qt(a), t = xo(t), t !== null) if (r = yt(t), r === null) t = null;
    else if (s = r.tag, s === 13) {
      if (t = pn(r), t !== null) return t;
      t = null;
    } else if (s === 3) {
      if (r.stateNode.current.memoizedState.isDehydrated) return r.tag === 3 ? r.stateNode.containerInfo : null;
      t = null;
    } else r !== t && (t = null);
    return ml = t, null;
  }
  function gp(t) {
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
        switch (Ln()) {
          case Bn:
            return 1;
          case _r:
            return 4;
          case en:
          case Rr:
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
  var Zr = null, Cc = null, gl = null;
  function yp() {
    if (gl) return gl;
    var t, r = Cc, s = r.length, a, u = "value" in Zr ? Zr.value : Zr.textContent, d = u.length;
    for (t = 0; t < s && r[t] === u[t]; t++) ;
    var S = s - t;
    for (a = 1; a <= S && r[s - a] === u[d - a]; a++) ;
    return gl = u.slice(t, 1 < a ? 1 - a : void 0);
  }
  function yl(t) {
    var r = t.keyCode;
    return "charCode" in t ? (t = t.charCode, t === 0 && r === 13 && (t = 13)) : t = r, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
  }
  function vl() {
    return !0;
  }
  function vp() {
    return !1;
  }
  function _n(t) {
    function r(s, a, u, d, S) {
      this._reactName = s, this._targetInst = u, this.type = a, this.nativeEvent = d, this.target = S, this.currentTarget = null;
      for (var $ in t) t.hasOwnProperty($) && (s = t[$], this[$] = s ? s(d) : d[$]);
      return this.isDefaultPrevented = (d.defaultPrevented != null ? d.defaultPrevented : d.returnValue === !1) ? vl : vp, this.isPropagationStopped = vp, this;
    }
    return U(r.prototype, { preventDefault: function() {
      this.defaultPrevented = !0;
      var s = this.nativeEvent;
      s && (s.preventDefault ? s.preventDefault() : typeof s.returnValue != "unknown" && (s.returnValue = !1), this.isDefaultPrevented = vl);
    }, stopPropagation: function() {
      var s = this.nativeEvent;
      s && (s.stopPropagation ? s.stopPropagation() : typeof s.cancelBubble != "unknown" && (s.cancelBubble = !0), this.isPropagationStopped = vl);
    }, persist: function() {
    }, isPersistent: vl }), r;
  }
  var ei = { eventPhase: 0, bubbles: 0, cancelable: 0, timeStamp: function(t) {
    return t.timeStamp || Date.now();
  }, defaultPrevented: 0, isTrusted: 0 }, xc = _n(ei), es = U({}, ei, { view: 0, detail: 0 }), e1 = _n(es), bc, Ec, ts, Sl = U({}, es, { screenX: 0, screenY: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, getModifierState: Pc, button: 0, buttons: 0, relatedTarget: function(t) {
    return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
  }, movementX: function(t) {
    return "movementX" in t ? t.movementX : (t !== ts && (ts && t.type === "mousemove" ? (bc = t.screenX - ts.screenX, Ec = t.screenY - ts.screenY) : Ec = bc = 0, ts = t), bc);
  }, movementY: function(t) {
    return "movementY" in t ? t.movementY : Ec;
  } }), Sp = _n(Sl), t1 = U({}, Sl, { dataTransfer: 0 }), n1 = _n(t1), r1 = U({}, es, { relatedTarget: 0 }), $c = _n(r1), o1 = U({}, ei, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }), i1 = _n(o1), s1 = U({}, ei, { clipboardData: function(t) {
    return "clipboardData" in t ? t.clipboardData : window.clipboardData;
  } }), l1 = _n(s1), a1 = U({}, ei, { data: 0 }), wp = _n(a1), c1 = {
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
  }, u1 = {
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
  }, f1 = { Alt: "altKey", Control: "ctrlKey", Meta: "metaKey", Shift: "shiftKey" };
  function d1(t) {
    var r = this.nativeEvent;
    return r.getModifierState ? r.getModifierState(t) : (t = f1[t]) ? !!r[t] : !1;
  }
  function Pc() {
    return d1;
  }
  var p1 = U({}, es, { key: function(t) {
    if (t.key) {
      var r = c1[t.key] || t.key;
      if (r !== "Unidentified") return r;
    }
    return t.type === "keypress" ? (t = yl(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? u1[t.keyCode] || "Unidentified" : "";
  }, code: 0, location: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, repeat: 0, locale: 0, getModifierState: Pc, charCode: function(t) {
    return t.type === "keypress" ? yl(t) : 0;
  }, keyCode: function(t) {
    return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
  }, which: function(t) {
    return t.type === "keypress" ? yl(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
  } }), h1 = _n(p1), m1 = U({}, Sl, { pointerId: 0, width: 0, height: 0, pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0, pointerType: 0, isPrimary: 0 }), Cp = _n(m1), g1 = U({}, es, { touches: 0, targetTouches: 0, changedTouches: 0, altKey: 0, metaKey: 0, ctrlKey: 0, shiftKey: 0, getModifierState: Pc }), y1 = _n(g1), v1 = U({}, ei, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }), S1 = _n(v1), w1 = U({}, Sl, {
    deltaX: function(t) {
      return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
    },
    deltaY: function(t) {
      return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), C1 = _n(w1), x1 = [9, 13, 27, 32], _c = p && "CompositionEvent" in window, ns = null;
  p && "documentMode" in document && (ns = document.documentMode);
  var b1 = p && "TextEvent" in window && !ns, xp = p && (!_c || ns && 8 < ns && 11 >= ns), bp = " ", Ep = !1;
  function $p(t, r) {
    switch (t) {
      case "keyup":
        return x1.indexOf(r.keyCode) !== -1;
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
  function Pp(t) {
    return t = t.detail, typeof t == "object" && "data" in t ? t.data : null;
  }
  var ti = !1;
  function E1(t, r) {
    switch (t) {
      case "compositionend":
        return Pp(r);
      case "keypress":
        return r.which !== 32 ? null : (Ep = !0, bp);
      case "textInput":
        return t = r.data, t === bp && Ep ? null : t;
      default:
        return null;
    }
  }
  function $1(t, r) {
    if (ti) return t === "compositionend" || !_c && $p(t, r) ? (t = yp(), gl = Cc = Zr = null, ti = !1, t) : null;
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
        return xp && r.locale !== "ko" ? null : r.data;
      default:
        return null;
    }
  }
  var P1 = { color: !0, date: !0, datetime: !0, "datetime-local": !0, email: !0, month: !0, number: !0, password: !0, range: !0, search: !0, tel: !0, text: !0, time: !0, url: !0, week: !0 };
  function _p(t) {
    var r = t && t.nodeName && t.nodeName.toLowerCase();
    return r === "input" ? !!P1[t.type] : r === "textarea";
  }
  function Rp(t, r, s, a) {
    $n(a), r = El(r, "onChange"), 0 < r.length && (s = new xc("onChange", "change", null, s, a), t.push({ event: s, listeners: r }));
  }
  var rs = null, os = null;
  function _1(t) {
    qp(t, 0);
  }
  function wl(t) {
    var r = si(t);
    if (ke(r)) return t;
  }
  function R1(t, r) {
    if (t === "change") return r;
  }
  var Np = !1;
  if (p) {
    var Rc;
    if (p) {
      var Nc = "oninput" in document;
      if (!Nc) {
        var kp = document.createElement("div");
        kp.setAttribute("oninput", "return;"), Nc = typeof kp.oninput == "function";
      }
      Rc = Nc;
    } else Rc = !1;
    Np = Rc && (!document.documentMode || 9 < document.documentMode);
  }
  function Tp() {
    rs && (rs.detachEvent("onpropertychange", Mp), os = rs = null);
  }
  function Mp(t) {
    if (t.propertyName === "value" && wl(os)) {
      var r = [];
      Rp(r, os, t, qt(t)), Qt(_1, r);
    }
  }
  function N1(t, r, s) {
    t === "focusin" ? (Tp(), rs = r, os = s, rs.attachEvent("onpropertychange", Mp)) : t === "focusout" && Tp();
  }
  function k1(t) {
    if (t === "selectionchange" || t === "keyup" || t === "keydown") return wl(os);
  }
  function T1(t, r) {
    if (t === "click") return wl(r);
  }
  function M1(t, r) {
    if (t === "input" || t === "change") return wl(r);
  }
  function I1(t, r) {
    return t === r && (t !== 0 || 1 / t === 1 / r) || t !== t && r !== r;
  }
  var or = typeof Object.is == "function" ? Object.is : I1;
  function is(t, r) {
    if (or(t, r)) return !0;
    if (typeof t != "object" || t === null || typeof r != "object" || r === null) return !1;
    var s = Object.keys(t), a = Object.keys(r);
    if (s.length !== a.length) return !1;
    for (a = 0; a < s.length; a++) {
      var u = s[a];
      if (!g.call(r, u) || !or(t[u], r[u])) return !1;
    }
    return !0;
  }
  function Ip(t) {
    for (; t && t.firstChild; ) t = t.firstChild;
    return t;
  }
  function Fp(t, r) {
    var s = Ip(t);
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
      s = Ip(s);
    }
  }
  function Op(t, r) {
    return t && r ? t === r ? !0 : t && t.nodeType === 3 ? !1 : r && r.nodeType === 3 ? Op(t, r.parentNode) : "contains" in t ? t.contains(r) : t.compareDocumentPosition ? !!(t.compareDocumentPosition(r) & 16) : !1 : !1;
  }
  function zp() {
    for (var t = window, r = qe(); r instanceof t.HTMLIFrameElement; ) {
      try {
        var s = typeof r.contentWindow.location.href == "string";
      } catch {
        s = !1;
      }
      if (s) t = r.contentWindow;
      else break;
      r = qe(t.document);
    }
    return r;
  }
  function kc(t) {
    var r = t && t.nodeName && t.nodeName.toLowerCase();
    return r && (r === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || r === "textarea" || t.contentEditable === "true");
  }
  function F1(t) {
    var r = zp(), s = t.focusedElem, a = t.selectionRange;
    if (r !== s && s && s.ownerDocument && Op(s.ownerDocument.documentElement, s)) {
      if (a !== null && kc(s)) {
        if (r = a.start, t = a.end, t === void 0 && (t = r), "selectionStart" in s) s.selectionStart = r, s.selectionEnd = Math.min(t, s.value.length);
        else if (t = (r = s.ownerDocument || document) && r.defaultView || window, t.getSelection) {
          t = t.getSelection();
          var u = s.textContent.length, d = Math.min(a.start, u);
          a = a.end === void 0 ? d : Math.min(a.end, u), !t.extend && d > a && (u = a, a = d, d = u), u = Fp(s, d);
          var S = Fp(
            s,
            a
          );
          u && S && (t.rangeCount !== 1 || t.anchorNode !== u.node || t.anchorOffset !== u.offset || t.focusNode !== S.node || t.focusOffset !== S.offset) && (r = r.createRange(), r.setStart(u.node, u.offset), t.removeAllRanges(), d > a ? (t.addRange(r), t.extend(S.node, S.offset)) : (r.setEnd(S.node, S.offset), t.addRange(r)));
        }
      }
      for (r = [], t = s; t = t.parentNode; ) t.nodeType === 1 && r.push({ element: t, left: t.scrollLeft, top: t.scrollTop });
      for (typeof s.focus == "function" && s.focus(), s = 0; s < r.length; s++) t = r[s], t.element.scrollLeft = t.left, t.element.scrollTop = t.top;
    }
  }
  var O1 = p && "documentMode" in document && 11 >= document.documentMode, ni = null, Tc = null, ss = null, Mc = !1;
  function Ap(t, r, s) {
    var a = s.window === s ? s.document : s.nodeType === 9 ? s : s.ownerDocument;
    Mc || ni == null || ni !== qe(a) || (a = ni, "selectionStart" in a && kc(a) ? a = { start: a.selectionStart, end: a.selectionEnd } : (a = (a.ownerDocument && a.ownerDocument.defaultView || window).getSelection(), a = { anchorNode: a.anchorNode, anchorOffset: a.anchorOffset, focusNode: a.focusNode, focusOffset: a.focusOffset }), ss && is(ss, a) || (ss = a, a = El(Tc, "onSelect"), 0 < a.length && (r = new xc("onSelect", "select", null, r, s), t.push({ event: r, listeners: a }), r.target = ni)));
  }
  function Cl(t, r) {
    var s = {};
    return s[t.toLowerCase()] = r.toLowerCase(), s["Webkit" + t] = "webkit" + r, s["Moz" + t] = "moz" + r, s;
  }
  var ri = { animationend: Cl("Animation", "AnimationEnd"), animationiteration: Cl("Animation", "AnimationIteration"), animationstart: Cl("Animation", "AnimationStart"), transitionend: Cl("Transition", "TransitionEnd") }, Ic = {}, Lp = {};
  p && (Lp = document.createElement("div").style, "AnimationEvent" in window || (delete ri.animationend.animation, delete ri.animationiteration.animation, delete ri.animationstart.animation), "TransitionEvent" in window || delete ri.transitionend.transition);
  function xl(t) {
    if (Ic[t]) return Ic[t];
    if (!ri[t]) return t;
    var r = ri[t], s;
    for (s in r) if (r.hasOwnProperty(s) && s in Lp) return Ic[t] = r[s];
    return t;
  }
  var Bp = xl("animationend"), Dp = xl("animationiteration"), jp = xl("animationstart"), Hp = xl("transitionend"), Vp = /* @__PURE__ */ new Map(), Wp = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
  function Jr(t, r) {
    Vp.set(t, r), c(r, [t]);
  }
  for (var Fc = 0; Fc < Wp.length; Fc++) {
    var Oc = Wp[Fc], z1 = Oc.toLowerCase(), A1 = Oc[0].toUpperCase() + Oc.slice(1);
    Jr(z1, "on" + A1);
  }
  Jr(Bp, "onAnimationEnd"), Jr(Dp, "onAnimationIteration"), Jr(jp, "onAnimationStart"), Jr("dblclick", "onDoubleClick"), Jr("focusin", "onFocus"), Jr("focusout", "onBlur"), Jr(Hp, "onTransitionEnd"), f("onMouseEnter", ["mouseout", "mouseover"]), f("onMouseLeave", ["mouseout", "mouseover"]), f("onPointerEnter", ["pointerout", "pointerover"]), f("onPointerLeave", ["pointerout", "pointerover"]), c("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), c("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), c("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]), c("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), c("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), c("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
  var ls = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), L1 = new Set("cancel close invalid load scroll toggle".split(" ").concat(ls));
  function Up(t, r, s) {
    var a = t.type || "unknown-event";
    t.currentTarget = s, It(a, r, void 0, t), t.currentTarget = null;
  }
  function qp(t, r) {
    r = (r & 4) !== 0;
    for (var s = 0; s < t.length; s++) {
      var a = t[s], u = a.event;
      a = a.listeners;
      e: {
        var d = void 0;
        if (r) for (var S = a.length - 1; 0 <= S; S--) {
          var $ = a[S], T = $.instance, D = $.currentTarget;
          if ($ = $.listener, T !== d && u.isPropagationStopped()) break e;
          Up(u, $, D), d = T;
        }
        else for (S = 0; S < a.length; S++) {
          if ($ = a[S], T = $.instance, D = $.currentTarget, $ = $.listener, T !== d && u.isPropagationStopped()) break e;
          Up(u, $, D), d = T;
        }
      }
    }
    if (Pn) throw t = rr, Pn = !1, rr = null, t;
  }
  function it(t, r) {
    var s = r[Vc];
    s === void 0 && (s = r[Vc] = /* @__PURE__ */ new Set());
    var a = t + "__bubble";
    s.has(a) || (Xp(r, t, 2, !1), s.add(a));
  }
  function zc(t, r, s) {
    var a = 0;
    r && (a |= 4), Xp(s, t, a, r);
  }
  var bl = "_reactListening" + Math.random().toString(36).slice(2);
  function as(t) {
    if (!t[bl]) {
      t[bl] = !0, i.forEach(function(s) {
        s !== "selectionchange" && (L1.has(s) || zc(s, !1, t), zc(s, !0, t));
      });
      var r = t.nodeType === 9 ? t : t.ownerDocument;
      r === null || r[bl] || (r[bl] = !0, zc("selectionchange", !1, r));
    }
  }
  function Xp(t, r, s, a) {
    switch (gp(r)) {
      case 1:
        var u = Zv;
        break;
      case 4:
        u = Jv;
        break;
      default:
        u = Sc;
    }
    s = u.bind(null, r, s, t), u = void 0, !zn || r !== "touchstart" && r !== "touchmove" && r !== "wheel" || (u = !0), a ? u !== void 0 ? t.addEventListener(r, s, { capture: !0, passive: u }) : t.addEventListener(r, s, !0) : u !== void 0 ? t.addEventListener(r, s, { passive: u }) : t.addEventListener(r, s, !1);
  }
  function Ac(t, r, s, a, u) {
    var d = a;
    if ((r & 1) === 0 && (r & 2) === 0 && a !== null) e: for (; ; ) {
      if (a === null) return;
      var S = a.tag;
      if (S === 3 || S === 4) {
        var $ = a.stateNode.containerInfo;
        if ($ === u || $.nodeType === 8 && $.parentNode === u) break;
        if (S === 4) for (S = a.return; S !== null; ) {
          var T = S.tag;
          if ((T === 3 || T === 4) && (T = S.stateNode.containerInfo, T === u || T.nodeType === 8 && T.parentNode === u)) return;
          S = S.return;
        }
        for (; $ !== null; ) {
          if (S = xo($), S === null) return;
          if (T = S.tag, T === 5 || T === 6) {
            a = d = S;
            continue e;
          }
          $ = $.parentNode;
        }
      }
      a = a.return;
    }
    Qt(function() {
      var D = d, q = qt(s), K = [];
      e: {
        var W = Vp.get(t);
        if (W !== void 0) {
          var pe = xc, ge = t;
          switch (t) {
            case "keypress":
              if (yl(s) === 0) break e;
            case "keydown":
            case "keyup":
              pe = h1;
              break;
            case "focusin":
              ge = "focus", pe = $c;
              break;
            case "focusout":
              ge = "blur", pe = $c;
              break;
            case "beforeblur":
            case "afterblur":
              pe = $c;
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
              pe = Sp;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              pe = n1;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              pe = y1;
              break;
            case Bp:
            case Dp:
            case jp:
              pe = i1;
              break;
            case Hp:
              pe = S1;
              break;
            case "scroll":
              pe = e1;
              break;
            case "wheel":
              pe = C1;
              break;
            case "copy":
            case "cut":
            case "paste":
              pe = l1;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              pe = Cp;
          }
          var ve = (r & 4) !== 0, bt = !ve && t === "scroll", L = ve ? W !== null ? W + "Capture" : null : W;
          ve = [];
          for (var I = D, B; I !== null; ) {
            B = I;
            var ne = B.stateNode;
            if (B.tag === 5 && ne !== null && (B = ne, L !== null && (ne = Mt(I, L), ne != null && ve.push(cs(I, ne, B)))), bt) break;
            I = I.return;
          }
          0 < ve.length && (W = new pe(W, ge, null, s, q), K.push({ event: W, listeners: ve }));
        }
      }
      if ((r & 7) === 0) {
        e: {
          if (W = t === "mouseover" || t === "pointerover", pe = t === "mouseout" || t === "pointerout", W && s !== gt && (ge = s.relatedTarget || s.fromElement) && (xo(ge) || ge[Mr])) break e;
          if ((pe || W) && (W = q.window === q ? q : (W = q.ownerDocument) ? W.defaultView || W.parentWindow : window, pe ? (ge = s.relatedTarget || s.toElement, pe = D, ge = ge ? xo(ge) : null, ge !== null && (bt = yt(ge), ge !== bt || ge.tag !== 5 && ge.tag !== 6) && (ge = null)) : (pe = null, ge = D), pe !== ge)) {
            if (ve = Sp, ne = "onMouseLeave", L = "onMouseEnter", I = "mouse", (t === "pointerout" || t === "pointerover") && (ve = Cp, ne = "onPointerLeave", L = "onPointerEnter", I = "pointer"), bt = pe == null ? W : si(pe), B = ge == null ? W : si(ge), W = new ve(ne, I + "leave", pe, s, q), W.target = bt, W.relatedTarget = B, ne = null, xo(q) === D && (ve = new ve(L, I + "enter", ge, s, q), ve.target = B, ve.relatedTarget = bt, ne = ve), bt = ne, pe && ge) t: {
              for (ve = pe, L = ge, I = 0, B = ve; B; B = oi(B)) I++;
              for (B = 0, ne = L; ne; ne = oi(ne)) B++;
              for (; 0 < I - B; ) ve = oi(ve), I--;
              for (; 0 < B - I; ) L = oi(L), B--;
              for (; I--; ) {
                if (ve === L || L !== null && ve === L.alternate) break t;
                ve = oi(ve), L = oi(L);
              }
              ve = null;
            }
            else ve = null;
            pe !== null && Gp(K, W, pe, ve, !1), ge !== null && bt !== null && Gp(K, bt, ge, ve, !0);
          }
        }
        e: {
          if (W = D ? si(D) : window, pe = W.nodeName && W.nodeName.toLowerCase(), pe === "select" || pe === "input" && W.type === "file") var Se = R1;
          else if (_p(W)) if (Np) Se = M1;
          else {
            Se = k1;
            var xe = N1;
          }
          else (pe = W.nodeName) && pe.toLowerCase() === "input" && (W.type === "checkbox" || W.type === "radio") && (Se = T1);
          if (Se && (Se = Se(t, D))) {
            Rp(K, Se, s, q);
            break e;
          }
          xe && xe(t, W, D), t === "focusout" && (xe = W._wrapperState) && xe.controlled && W.type === "number" && xt(W, "number", W.value);
        }
        switch (xe = D ? si(D) : window, t) {
          case "focusin":
            (_p(xe) || xe.contentEditable === "true") && (ni = xe, Tc = D, ss = null);
            break;
          case "focusout":
            ss = Tc = ni = null;
            break;
          case "mousedown":
            Mc = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            Mc = !1, Ap(K, s, q);
            break;
          case "selectionchange":
            if (O1) break;
          case "keydown":
          case "keyup":
            Ap(K, s, q);
        }
        var be;
        if (_c) e: {
          switch (t) {
            case "compositionstart":
              var _e = "onCompositionStart";
              break e;
            case "compositionend":
              _e = "onCompositionEnd";
              break e;
            case "compositionupdate":
              _e = "onCompositionUpdate";
              break e;
          }
          _e = void 0;
        }
        else ti ? $p(t, s) && (_e = "onCompositionEnd") : t === "keydown" && s.keyCode === 229 && (_e = "onCompositionStart");
        _e && (xp && s.locale !== "ko" && (ti || _e !== "onCompositionStart" ? _e === "onCompositionEnd" && ti && (be = yp()) : (Zr = q, Cc = "value" in Zr ? Zr.value : Zr.textContent, ti = !0)), xe = El(D, _e), 0 < xe.length && (_e = new wp(_e, t, null, s, q), K.push({ event: _e, listeners: xe }), be ? _e.data = be : (be = Pp(s), be !== null && (_e.data = be)))), (be = b1 ? E1(t, s) : $1(t, s)) && (D = El(D, "onBeforeInput"), 0 < D.length && (q = new wp("onBeforeInput", "beforeinput", null, s, q), K.push({ event: q, listeners: D }), q.data = be));
      }
      qp(K, r);
    });
  }
  function cs(t, r, s) {
    return { instance: t, listener: r, currentTarget: s };
  }
  function El(t, r) {
    for (var s = r + "Capture", a = []; t !== null; ) {
      var u = t, d = u.stateNode;
      u.tag === 5 && d !== null && (u = d, d = Mt(t, s), d != null && a.unshift(cs(t, d, u)), d = Mt(t, r), d != null && a.push(cs(t, d, u))), t = t.return;
    }
    return a;
  }
  function oi(t) {
    if (t === null) return null;
    do
      t = t.return;
    while (t && t.tag !== 5);
    return t || null;
  }
  function Gp(t, r, s, a, u) {
    for (var d = r._reactName, S = []; s !== null && s !== a; ) {
      var $ = s, T = $.alternate, D = $.stateNode;
      if (T !== null && T === a) break;
      $.tag === 5 && D !== null && ($ = D, u ? (T = Mt(s, d), T != null && S.unshift(cs(s, T, $))) : u || (T = Mt(s, d), T != null && S.push(cs(s, T, $)))), s = s.return;
    }
    S.length !== 0 && t.push({ event: r, listeners: S });
  }
  var B1 = /\r\n?/g, D1 = /\u0000|\uFFFD/g;
  function Yp(t) {
    return (typeof t == "string" ? t : "" + t).replace(B1, `
`).replace(D1, "");
  }
  function $l(t, r, s) {
    if (r = Yp(r), Yp(t) !== r && s) throw Error(o(425));
  }
  function Pl() {
  }
  var Lc = null, Bc = null;
  function Dc(t, r) {
    return t === "textarea" || t === "noscript" || typeof r.children == "string" || typeof r.children == "number" || typeof r.dangerouslySetInnerHTML == "object" && r.dangerouslySetInnerHTML !== null && r.dangerouslySetInnerHTML.__html != null;
  }
  var jc = typeof setTimeout == "function" ? setTimeout : void 0, j1 = typeof clearTimeout == "function" ? clearTimeout : void 0, Kp = typeof Promise == "function" ? Promise : void 0, H1 = typeof queueMicrotask == "function" ? queueMicrotask : typeof Kp < "u" ? function(t) {
    return Kp.resolve(null).then(t).catch(V1);
  } : jc;
  function V1(t) {
    setTimeout(function() {
      throw t;
    });
  }
  function Hc(t, r) {
    var s = r, a = 0;
    do {
      var u = s.nextSibling;
      if (t.removeChild(s), u && u.nodeType === 8) if (s = u.data, s === "/$") {
        if (a === 0) {
          t.removeChild(u), Ji(r);
          return;
        }
        a--;
      } else s !== "$" && s !== "$?" && s !== "$!" || a++;
      s = u;
    } while (s);
    Ji(r);
  }
  function eo(t) {
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
  function Qp(t) {
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
  var ii = Math.random().toString(36).slice(2), Sr = "__reactFiber$" + ii, us = "__reactProps$" + ii, Mr = "__reactContainer$" + ii, Vc = "__reactEvents$" + ii, W1 = "__reactListeners$" + ii, U1 = "__reactHandles$" + ii;
  function xo(t) {
    var r = t[Sr];
    if (r) return r;
    for (var s = t.parentNode; s; ) {
      if (r = s[Mr] || s[Sr]) {
        if (s = r.alternate, r.child !== null || s !== null && s.child !== null) for (t = Qp(t); t !== null; ) {
          if (s = t[Sr]) return s;
          t = Qp(t);
        }
        return r;
      }
      t = s, s = t.parentNode;
    }
    return null;
  }
  function fs(t) {
    return t = t[Sr] || t[Mr], !t || t.tag !== 5 && t.tag !== 6 && t.tag !== 13 && t.tag !== 3 ? null : t;
  }
  function si(t) {
    if (t.tag === 5 || t.tag === 6) return t.stateNode;
    throw Error(o(33));
  }
  function _l(t) {
    return t[us] || null;
  }
  var Wc = [], li = -1;
  function to(t) {
    return { current: t };
  }
  function st(t) {
    0 > li || (t.current = Wc[li], Wc[li] = null, li--);
  }
  function ot(t, r) {
    li++, Wc[li] = t.current, t.current = r;
  }
  var no = {}, tn = to(no), gn = to(!1), bo = no;
  function ai(t, r) {
    var s = t.type.contextTypes;
    if (!s) return no;
    var a = t.stateNode;
    if (a && a.__reactInternalMemoizedUnmaskedChildContext === r) return a.__reactInternalMemoizedMaskedChildContext;
    var u = {}, d;
    for (d in s) u[d] = r[d];
    return a && (t = t.stateNode, t.__reactInternalMemoizedUnmaskedChildContext = r, t.__reactInternalMemoizedMaskedChildContext = u), u;
  }
  function yn(t) {
    return t = t.childContextTypes, t != null;
  }
  function Rl() {
    st(gn), st(tn);
  }
  function Zp(t, r, s) {
    if (tn.current !== no) throw Error(o(168));
    ot(tn, r), ot(gn, s);
  }
  function Jp(t, r, s) {
    var a = t.stateNode;
    if (r = r.childContextTypes, typeof a.getChildContext != "function") return s;
    a = a.getChildContext();
    for (var u in a) if (!(u in r)) throw Error(o(108, fe(t) || "Unknown", u));
    return U({}, s, a);
  }
  function Nl(t) {
    return t = (t = t.stateNode) && t.__reactInternalMemoizedMergedChildContext || no, bo = tn.current, ot(tn, t), ot(gn, gn.current), !0;
  }
  function eh(t, r, s) {
    var a = t.stateNode;
    if (!a) throw Error(o(169));
    s ? (t = Jp(t, r, bo), a.__reactInternalMemoizedMergedChildContext = t, st(gn), st(tn), ot(tn, t)) : st(gn), ot(gn, s);
  }
  var Ir = null, kl = !1, Uc = !1;
  function th(t) {
    Ir === null ? Ir = [t] : Ir.push(t);
  }
  function q1(t) {
    kl = !0, th(t);
  }
  function ro() {
    if (!Uc && Ir !== null) {
      Uc = !0;
      var t = 0, r = De;
      try {
        var s = Ir;
        for (De = 1; t < s.length; t++) {
          var a = s[t];
          do
            a = a(!0);
          while (a !== null);
        }
        Ir = null, kl = !1;
      } catch (u) {
        throw Ir !== null && (Ir = Ir.slice(t + 1)), gr(Bn, ro), u;
      } finally {
        De = r, Uc = !1;
      }
    }
    return null;
  }
  var ci = [], ui = 0, Tl = null, Ml = 0, jn = [], Hn = 0, Eo = null, Fr = 1, Or = "";
  function $o(t, r) {
    ci[ui++] = Ml, ci[ui++] = Tl, Tl = t, Ml = r;
  }
  function nh(t, r, s) {
    jn[Hn++] = Fr, jn[Hn++] = Or, jn[Hn++] = Eo, Eo = t;
    var a = Fr;
    t = Or;
    var u = 32 - et(a) - 1;
    a &= ~(1 << u), s += 1;
    var d = 32 - et(r) + u;
    if (30 < d) {
      var S = u - u % 5;
      d = (a & (1 << S) - 1).toString(32), a >>= S, u -= S, Fr = 1 << 32 - et(r) + u | s << u | a, Or = d + t;
    } else Fr = 1 << d | s << u | a, Or = t;
  }
  function qc(t) {
    t.return !== null && ($o(t, 1), nh(t, 1, 0));
  }
  function Xc(t) {
    for (; t === Tl; ) Tl = ci[--ui], ci[ui] = null, Ml = ci[--ui], ci[ui] = null;
    for (; t === Eo; ) Eo = jn[--Hn], jn[Hn] = null, Or = jn[--Hn], jn[Hn] = null, Fr = jn[--Hn], jn[Hn] = null;
  }
  var Rn = null, Nn = null, ct = !1, ir = null;
  function rh(t, r) {
    var s = qn(5, null, null, 0);
    s.elementType = "DELETED", s.stateNode = r, s.return = t, r = t.deletions, r === null ? (t.deletions = [s], t.flags |= 16) : r.push(s);
  }
  function oh(t, r) {
    switch (t.tag) {
      case 5:
        var s = t.type;
        return r = r.nodeType !== 1 || s.toLowerCase() !== r.nodeName.toLowerCase() ? null : r, r !== null ? (t.stateNode = r, Rn = t, Nn = eo(r.firstChild), !0) : !1;
      case 6:
        return r = t.pendingProps === "" || r.nodeType !== 3 ? null : r, r !== null ? (t.stateNode = r, Rn = t, Nn = null, !0) : !1;
      case 13:
        return r = r.nodeType !== 8 ? null : r, r !== null ? (s = Eo !== null ? { id: Fr, overflow: Or } : null, t.memoizedState = { dehydrated: r, treeContext: s, retryLane: 1073741824 }, s = qn(18, null, null, 0), s.stateNode = r, s.return = t, t.child = s, Rn = t, Nn = null, !0) : !1;
      default:
        return !1;
    }
  }
  function Gc(t) {
    return (t.mode & 1) !== 0 && (t.flags & 128) === 0;
  }
  function Yc(t) {
    if (ct) {
      var r = Nn;
      if (r) {
        var s = r;
        if (!oh(t, r)) {
          if (Gc(t)) throw Error(o(418));
          r = eo(s.nextSibling);
          var a = Rn;
          r && oh(t, r) ? rh(a, s) : (t.flags = t.flags & -4097 | 2, ct = !1, Rn = t);
        }
      } else {
        if (Gc(t)) throw Error(o(418));
        t.flags = t.flags & -4097 | 2, ct = !1, Rn = t;
      }
    }
  }
  function ih(t) {
    for (t = t.return; t !== null && t.tag !== 5 && t.tag !== 3 && t.tag !== 13; ) t = t.return;
    Rn = t;
  }
  function Il(t) {
    if (t !== Rn) return !1;
    if (!ct) return ih(t), ct = !0, !1;
    var r;
    if ((r = t.tag !== 3) && !(r = t.tag !== 5) && (r = t.type, r = r !== "head" && r !== "body" && !Dc(t.type, t.memoizedProps)), r && (r = Nn)) {
      if (Gc(t)) throw sh(), Error(o(418));
      for (; r; ) rh(t, r), r = eo(r.nextSibling);
    }
    if (ih(t), t.tag === 13) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
      e: {
        for (t = t.nextSibling, r = 0; t; ) {
          if (t.nodeType === 8) {
            var s = t.data;
            if (s === "/$") {
              if (r === 0) {
                Nn = eo(t.nextSibling);
                break e;
              }
              r--;
            } else s !== "$" && s !== "$!" && s !== "$?" || r++;
          }
          t = t.nextSibling;
        }
        Nn = null;
      }
    } else Nn = Rn ? eo(t.stateNode.nextSibling) : null;
    return !0;
  }
  function sh() {
    for (var t = Nn; t; ) t = eo(t.nextSibling);
  }
  function fi() {
    Nn = Rn = null, ct = !1;
  }
  function Kc(t) {
    ir === null ? ir = [t] : ir.push(t);
  }
  var X1 = R.ReactCurrentBatchConfig;
  function ds(t, r, s) {
    if (t = s.ref, t !== null && typeof t != "function" && typeof t != "object") {
      if (s._owner) {
        if (s = s._owner, s) {
          if (s.tag !== 1) throw Error(o(309));
          var a = s.stateNode;
        }
        if (!a) throw Error(o(147, t));
        var u = a, d = "" + t;
        return r !== null && r.ref !== null && typeof r.ref == "function" && r.ref._stringRef === d ? r.ref : (r = function(S) {
          var $ = u.refs;
          S === null ? delete $[d] : $[d] = S;
        }, r._stringRef = d, r);
      }
      if (typeof t != "string") throw Error(o(284));
      if (!s._owner) throw Error(o(290, t));
    }
    return t;
  }
  function Fl(t, r) {
    throw t = Object.prototype.toString.call(r), Error(o(31, t === "[object Object]" ? "object with keys {" + Object.keys(r).join(", ") + "}" : t));
  }
  function lh(t) {
    var r = t._init;
    return r(t._payload);
  }
  function ah(t) {
    function r(L, I) {
      if (t) {
        var B = L.deletions;
        B === null ? (L.deletions = [I], L.flags |= 16) : B.push(I);
      }
    }
    function s(L, I) {
      if (!t) return null;
      for (; I !== null; ) r(L, I), I = I.sibling;
      return null;
    }
    function a(L, I) {
      for (L = /* @__PURE__ */ new Map(); I !== null; ) I.key !== null ? L.set(I.key, I) : L.set(I.index, I), I = I.sibling;
      return L;
    }
    function u(L, I) {
      return L = fo(L, I), L.index = 0, L.sibling = null, L;
    }
    function d(L, I, B) {
      return L.index = B, t ? (B = L.alternate, B !== null ? (B = B.index, B < I ? (L.flags |= 2, I) : B) : (L.flags |= 2, I)) : (L.flags |= 1048576, I);
    }
    function S(L) {
      return t && L.alternate === null && (L.flags |= 2), L;
    }
    function $(L, I, B, ne) {
      return I === null || I.tag !== 6 ? (I = ju(B, L.mode, ne), I.return = L, I) : (I = u(I, B), I.return = L, I);
    }
    function T(L, I, B, ne) {
      var Se = B.type;
      return Se === O ? q(L, I, B.props.children, ne, B.key) : I !== null && (I.elementType === Se || typeof Se == "object" && Se !== null && Se.$$typeof === le && lh(Se) === I.type) ? (ne = u(I, B.props), ne.ref = ds(L, I, B), ne.return = L, ne) : (ne = oa(B.type, B.key, B.props, null, L.mode, ne), ne.ref = ds(L, I, B), ne.return = L, ne);
    }
    function D(L, I, B, ne) {
      return I === null || I.tag !== 4 || I.stateNode.containerInfo !== B.containerInfo || I.stateNode.implementation !== B.implementation ? (I = Hu(B, L.mode, ne), I.return = L, I) : (I = u(I, B.children || []), I.return = L, I);
    }
    function q(L, I, B, ne, Se) {
      return I === null || I.tag !== 7 ? (I = Io(B, L.mode, ne, Se), I.return = L, I) : (I = u(I, B), I.return = L, I);
    }
    function K(L, I, B) {
      if (typeof I == "string" && I !== "" || typeof I == "number") return I = ju("" + I, L.mode, B), I.return = L, I;
      if (typeof I == "object" && I !== null) {
        switch (I.$$typeof) {
          case M:
            return B = oa(I.type, I.key, I.props, null, L.mode, B), B.ref = ds(L, null, I), B.return = L, B;
          case F:
            return I = Hu(I, L.mode, B), I.return = L, I;
          case le:
            var ne = I._init;
            return K(L, ne(I._payload), B);
        }
        if (Ze(I) || J(I)) return I = Io(I, L.mode, B, null), I.return = L, I;
        Fl(L, I);
      }
      return null;
    }
    function W(L, I, B, ne) {
      var Se = I !== null ? I.key : null;
      if (typeof B == "string" && B !== "" || typeof B == "number") return Se !== null ? null : $(L, I, "" + B, ne);
      if (typeof B == "object" && B !== null) {
        switch (B.$$typeof) {
          case M:
            return B.key === Se ? T(L, I, B, ne) : null;
          case F:
            return B.key === Se ? D(L, I, B, ne) : null;
          case le:
            return Se = B._init, W(
              L,
              I,
              Se(B._payload),
              ne
            );
        }
        if (Ze(B) || J(B)) return Se !== null ? null : q(L, I, B, ne, null);
        Fl(L, B);
      }
      return null;
    }
    function pe(L, I, B, ne, Se) {
      if (typeof ne == "string" && ne !== "" || typeof ne == "number") return L = L.get(B) || null, $(I, L, "" + ne, Se);
      if (typeof ne == "object" && ne !== null) {
        switch (ne.$$typeof) {
          case M:
            return L = L.get(ne.key === null ? B : ne.key) || null, T(I, L, ne, Se);
          case F:
            return L = L.get(ne.key === null ? B : ne.key) || null, D(I, L, ne, Se);
          case le:
            var xe = ne._init;
            return pe(L, I, B, xe(ne._payload), Se);
        }
        if (Ze(ne) || J(ne)) return L = L.get(B) || null, q(I, L, ne, Se, null);
        Fl(I, ne);
      }
      return null;
    }
    function ge(L, I, B, ne) {
      for (var Se = null, xe = null, be = I, _e = I = 0, Ht = null; be !== null && _e < B.length; _e++) {
        be.index > _e ? (Ht = be, be = null) : Ht = be.sibling;
        var je = W(L, be, B[_e], ne);
        if (je === null) {
          be === null && (be = Ht);
          break;
        }
        t && be && je.alternate === null && r(L, be), I = d(je, I, _e), xe === null ? Se = je : xe.sibling = je, xe = je, be = Ht;
      }
      if (_e === B.length) return s(L, be), ct && $o(L, _e), Se;
      if (be === null) {
        for (; _e < B.length; _e++) be = K(L, B[_e], ne), be !== null && (I = d(be, I, _e), xe === null ? Se = be : xe.sibling = be, xe = be);
        return ct && $o(L, _e), Se;
      }
      for (be = a(L, be); _e < B.length; _e++) Ht = pe(be, L, _e, B[_e], ne), Ht !== null && (t && Ht.alternate !== null && be.delete(Ht.key === null ? _e : Ht.key), I = d(Ht, I, _e), xe === null ? Se = Ht : xe.sibling = Ht, xe = Ht);
      return t && be.forEach(function(po) {
        return r(L, po);
      }), ct && $o(L, _e), Se;
    }
    function ve(L, I, B, ne) {
      var Se = J(B);
      if (typeof Se != "function") throw Error(o(150));
      if (B = Se.call(B), B == null) throw Error(o(151));
      for (var xe = Se = null, be = I, _e = I = 0, Ht = null, je = B.next(); be !== null && !je.done; _e++, je = B.next()) {
        be.index > _e ? (Ht = be, be = null) : Ht = be.sibling;
        var po = W(L, be, je.value, ne);
        if (po === null) {
          be === null && (be = Ht);
          break;
        }
        t && be && po.alternate === null && r(L, be), I = d(po, I, _e), xe === null ? Se = po : xe.sibling = po, xe = po, be = Ht;
      }
      if (je.done) return s(
        L,
        be
      ), ct && $o(L, _e), Se;
      if (be === null) {
        for (; !je.done; _e++, je = B.next()) je = K(L, je.value, ne), je !== null && (I = d(je, I, _e), xe === null ? Se = je : xe.sibling = je, xe = je);
        return ct && $o(L, _e), Se;
      }
      for (be = a(L, be); !je.done; _e++, je = B.next()) je = pe(be, L, _e, je.value, ne), je !== null && (t && je.alternate !== null && be.delete(je.key === null ? _e : je.key), I = d(je, I, _e), xe === null ? Se = je : xe.sibling = je, xe = je);
      return t && be.forEach(function(PS) {
        return r(L, PS);
      }), ct && $o(L, _e), Se;
    }
    function bt(L, I, B, ne) {
      if (typeof B == "object" && B !== null && B.type === O && B.key === null && (B = B.props.children), typeof B == "object" && B !== null) {
        switch (B.$$typeof) {
          case M:
            e: {
              for (var Se = B.key, xe = I; xe !== null; ) {
                if (xe.key === Se) {
                  if (Se = B.type, Se === O) {
                    if (xe.tag === 7) {
                      s(L, xe.sibling), I = u(xe, B.props.children), I.return = L, L = I;
                      break e;
                    }
                  } else if (xe.elementType === Se || typeof Se == "object" && Se !== null && Se.$$typeof === le && lh(Se) === xe.type) {
                    s(L, xe.sibling), I = u(xe, B.props), I.ref = ds(L, xe, B), I.return = L, L = I;
                    break e;
                  }
                  s(L, xe);
                  break;
                } else r(L, xe);
                xe = xe.sibling;
              }
              B.type === O ? (I = Io(B.props.children, L.mode, ne, B.key), I.return = L, L = I) : (ne = oa(B.type, B.key, B.props, null, L.mode, ne), ne.ref = ds(L, I, B), ne.return = L, L = ne);
            }
            return S(L);
          case F:
            e: {
              for (xe = B.key; I !== null; ) {
                if (I.key === xe) if (I.tag === 4 && I.stateNode.containerInfo === B.containerInfo && I.stateNode.implementation === B.implementation) {
                  s(L, I.sibling), I = u(I, B.children || []), I.return = L, L = I;
                  break e;
                } else {
                  s(L, I);
                  break;
                }
                else r(L, I);
                I = I.sibling;
              }
              I = Hu(B, L.mode, ne), I.return = L, L = I;
            }
            return S(L);
          case le:
            return xe = B._init, bt(L, I, xe(B._payload), ne);
        }
        if (Ze(B)) return ge(L, I, B, ne);
        if (J(B)) return ve(L, I, B, ne);
        Fl(L, B);
      }
      return typeof B == "string" && B !== "" || typeof B == "number" ? (B = "" + B, I !== null && I.tag === 6 ? (s(L, I.sibling), I = u(I, B), I.return = L, L = I) : (s(L, I), I = ju(B, L.mode, ne), I.return = L, L = I), S(L)) : s(L, I);
    }
    return bt;
  }
  var di = ah(!0), ch = ah(!1), Ol = to(null), zl = null, pi = null, Qc = null;
  function Zc() {
    Qc = pi = zl = null;
  }
  function Jc(t) {
    var r = Ol.current;
    st(Ol), t._currentValue = r;
  }
  function eu(t, r, s) {
    for (; t !== null; ) {
      var a = t.alternate;
      if ((t.childLanes & r) !== r ? (t.childLanes |= r, a !== null && (a.childLanes |= r)) : a !== null && (a.childLanes & r) !== r && (a.childLanes |= r), t === s) break;
      t = t.return;
    }
  }
  function hi(t, r) {
    zl = t, Qc = pi = null, t = t.dependencies, t !== null && t.firstContext !== null && ((t.lanes & r) !== 0 && (vn = !0), t.firstContext = null);
  }
  function Vn(t) {
    var r = t._currentValue;
    if (Qc !== t) if (t = { context: t, memoizedValue: r, next: null }, pi === null) {
      if (zl === null) throw Error(o(308));
      pi = t, zl.dependencies = { lanes: 0, firstContext: t };
    } else pi = pi.next = t;
    return r;
  }
  var Po = null;
  function tu(t) {
    Po === null ? Po = [t] : Po.push(t);
  }
  function uh(t, r, s, a) {
    var u = r.interleaved;
    return u === null ? (s.next = s, tu(r)) : (s.next = u.next, u.next = s), r.interleaved = s, zr(t, a);
  }
  function zr(t, r) {
    t.lanes |= r;
    var s = t.alternate;
    for (s !== null && (s.lanes |= r), s = t, t = t.return; t !== null; ) t.childLanes |= r, s = t.alternate, s !== null && (s.childLanes |= r), s = t, t = t.return;
    return s.tag === 3 ? s.stateNode : null;
  }
  var oo = !1;
  function nu(t) {
    t.updateQueue = { baseState: t.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
  }
  function fh(t, r) {
    t = t.updateQueue, r.updateQueue === t && (r.updateQueue = { baseState: t.baseState, firstBaseUpdate: t.firstBaseUpdate, lastBaseUpdate: t.lastBaseUpdate, shared: t.shared, effects: t.effects });
  }
  function Ar(t, r) {
    return { eventTime: t, lane: r, tag: 0, payload: null, callback: null, next: null };
  }
  function io(t, r, s) {
    var a = t.updateQueue;
    if (a === null) return null;
    if (a = a.shared, (Le & 2) !== 0) {
      var u = a.pending;
      return u === null ? r.next = r : (r.next = u.next, u.next = r), a.pending = r, zr(t, s);
    }
    return u = a.interleaved, u === null ? (r.next = r, tu(a)) : (r.next = u.next, u.next = r), a.interleaved = r, zr(t, s);
  }
  function Al(t, r, s) {
    if (r = r.updateQueue, r !== null && (r = r.shared, (s & 4194240) !== 0)) {
      var a = r.lanes;
      a &= t.pendingLanes, s |= a, r.lanes = s, Zo(t, s);
    }
  }
  function dh(t, r) {
    var s = t.updateQueue, a = t.alternate;
    if (a !== null && (a = a.updateQueue, s === a)) {
      var u = null, d = null;
      if (s = s.firstBaseUpdate, s !== null) {
        do {
          var S = { eventTime: s.eventTime, lane: s.lane, tag: s.tag, payload: s.payload, callback: s.callback, next: null };
          d === null ? u = d = S : d = d.next = S, s = s.next;
        } while (s !== null);
        d === null ? u = d = r : d = d.next = r;
      } else u = d = r;
      s = { baseState: a.baseState, firstBaseUpdate: u, lastBaseUpdate: d, shared: a.shared, effects: a.effects }, t.updateQueue = s;
      return;
    }
    t = s.lastBaseUpdate, t === null ? s.firstBaseUpdate = r : t.next = r, s.lastBaseUpdate = r;
  }
  function Ll(t, r, s, a) {
    var u = t.updateQueue;
    oo = !1;
    var d = u.firstBaseUpdate, S = u.lastBaseUpdate, $ = u.shared.pending;
    if ($ !== null) {
      u.shared.pending = null;
      var T = $, D = T.next;
      T.next = null, S === null ? d = D : S.next = D, S = T;
      var q = t.alternate;
      q !== null && (q = q.updateQueue, $ = q.lastBaseUpdate, $ !== S && ($ === null ? q.firstBaseUpdate = D : $.next = D, q.lastBaseUpdate = T));
    }
    if (d !== null) {
      var K = u.baseState;
      S = 0, q = D = T = null, $ = d;
      do {
        var W = $.lane, pe = $.eventTime;
        if ((a & W) === W) {
          q !== null && (q = q.next = {
            eventTime: pe,
            lane: 0,
            tag: $.tag,
            payload: $.payload,
            callback: $.callback,
            next: null
          });
          e: {
            var ge = t, ve = $;
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
                K = U({}, K, W);
                break e;
              case 2:
                oo = !0;
            }
          }
          $.callback !== null && $.lane !== 0 && (t.flags |= 64, W = u.effects, W === null ? u.effects = [$] : W.push($));
        } else pe = { eventTime: pe, lane: W, tag: $.tag, payload: $.payload, callback: $.callback, next: null }, q === null ? (D = q = pe, T = K) : q = q.next = pe, S |= W;
        if ($ = $.next, $ === null) {
          if ($ = u.shared.pending, $ === null) break;
          W = $, $ = W.next, W.next = null, u.lastBaseUpdate = W, u.shared.pending = null;
        }
      } while (!0);
      if (q === null && (T = K), u.baseState = T, u.firstBaseUpdate = D, u.lastBaseUpdate = q, r = u.shared.interleaved, r !== null) {
        u = r;
        do
          S |= u.lane, u = u.next;
        while (u !== r);
      } else d === null && (u.shared.lanes = 0);
      No |= S, t.lanes = S, t.memoizedState = K;
    }
  }
  function ph(t, r, s) {
    if (t = r.effects, r.effects = null, t !== null) for (r = 0; r < t.length; r++) {
      var a = t[r], u = a.callback;
      if (u !== null) {
        if (a.callback = null, a = s, typeof u != "function") throw Error(o(191, u));
        u.call(a);
      }
    }
  }
  var ps = {}, wr = to(ps), hs = to(ps), ms = to(ps);
  function _o(t) {
    if (t === ps) throw Error(o(174));
    return t;
  }
  function ru(t, r) {
    switch (ot(ms, r), ot(hs, t), ot(wr, ps), t = r.nodeType, t) {
      case 9:
      case 11:
        r = (r = r.documentElement) ? r.namespaceURI : Wt(null, "");
        break;
      default:
        t = t === 8 ? r.parentNode : r, r = t.namespaceURI || null, t = t.tagName, r = Wt(r, t);
    }
    st(wr), ot(wr, r);
  }
  function mi() {
    st(wr), st(hs), st(ms);
  }
  function hh(t) {
    _o(ms.current);
    var r = _o(wr.current), s = Wt(r, t.type);
    r !== s && (ot(hs, t), ot(wr, s));
  }
  function ou(t) {
    hs.current === t && (st(wr), st(hs));
  }
  var pt = to(0);
  function Bl(t) {
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
  var iu = [];
  function su() {
    for (var t = 0; t < iu.length; t++) iu[t]._workInProgressVersionPrimary = null;
    iu.length = 0;
  }
  var Dl = R.ReactCurrentDispatcher, lu = R.ReactCurrentBatchConfig, Ro = 0, ht = null, Ft = null, Dt = null, jl = !1, gs = !1, ys = 0, G1 = 0;
  function nn() {
    throw Error(o(321));
  }
  function au(t, r) {
    if (r === null) return !1;
    for (var s = 0; s < r.length && s < t.length; s++) if (!or(t[s], r[s])) return !1;
    return !0;
  }
  function cu(t, r, s, a, u, d) {
    if (Ro = d, ht = r, r.memoizedState = null, r.updateQueue = null, r.lanes = 0, Dl.current = t === null || t.memoizedState === null ? Z1 : J1, t = s(a, u), gs) {
      d = 0;
      do {
        if (gs = !1, ys = 0, 25 <= d) throw Error(o(301));
        d += 1, Dt = Ft = null, r.updateQueue = null, Dl.current = eS, t = s(a, u);
      } while (gs);
    }
    if (Dl.current = Wl, r = Ft !== null && Ft.next !== null, Ro = 0, Dt = Ft = ht = null, jl = !1, r) throw Error(o(300));
    return t;
  }
  function uu() {
    var t = ys !== 0;
    return ys = 0, t;
  }
  function Cr() {
    var t = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
    return Dt === null ? ht.memoizedState = Dt = t : Dt = Dt.next = t, Dt;
  }
  function Wn() {
    if (Ft === null) {
      var t = ht.alternate;
      t = t !== null ? t.memoizedState : null;
    } else t = Ft.next;
    var r = Dt === null ? ht.memoizedState : Dt.next;
    if (r !== null) Dt = r, Ft = t;
    else {
      if (t === null) throw Error(o(310));
      Ft = t, t = { memoizedState: Ft.memoizedState, baseState: Ft.baseState, baseQueue: Ft.baseQueue, queue: Ft.queue, next: null }, Dt === null ? ht.memoizedState = Dt = t : Dt = Dt.next = t;
    }
    return Dt;
  }
  function vs(t, r) {
    return typeof r == "function" ? r(t) : r;
  }
  function fu(t) {
    var r = Wn(), s = r.queue;
    if (s === null) throw Error(o(311));
    s.lastRenderedReducer = t;
    var a = Ft, u = a.baseQueue, d = s.pending;
    if (d !== null) {
      if (u !== null) {
        var S = u.next;
        u.next = d.next, d.next = S;
      }
      a.baseQueue = u = d, s.pending = null;
    }
    if (u !== null) {
      d = u.next, a = a.baseState;
      var $ = S = null, T = null, D = d;
      do {
        var q = D.lane;
        if ((Ro & q) === q) T !== null && (T = T.next = { lane: 0, action: D.action, hasEagerState: D.hasEagerState, eagerState: D.eagerState, next: null }), a = D.hasEagerState ? D.eagerState : t(a, D.action);
        else {
          var K = {
            lane: q,
            action: D.action,
            hasEagerState: D.hasEagerState,
            eagerState: D.eagerState,
            next: null
          };
          T === null ? ($ = T = K, S = a) : T = T.next = K, ht.lanes |= q, No |= q;
        }
        D = D.next;
      } while (D !== null && D !== d);
      T === null ? S = a : T.next = $, or(a, r.memoizedState) || (vn = !0), r.memoizedState = a, r.baseState = S, r.baseQueue = T, s.lastRenderedState = a;
    }
    if (t = s.interleaved, t !== null) {
      u = t;
      do
        d = u.lane, ht.lanes |= d, No |= d, u = u.next;
      while (u !== t);
    } else u === null && (s.lanes = 0);
    return [r.memoizedState, s.dispatch];
  }
  function du(t) {
    var r = Wn(), s = r.queue;
    if (s === null) throw Error(o(311));
    s.lastRenderedReducer = t;
    var a = s.dispatch, u = s.pending, d = r.memoizedState;
    if (u !== null) {
      s.pending = null;
      var S = u = u.next;
      do
        d = t(d, S.action), S = S.next;
      while (S !== u);
      or(d, r.memoizedState) || (vn = !0), r.memoizedState = d, r.baseQueue === null && (r.baseState = d), s.lastRenderedState = d;
    }
    return [d, a];
  }
  function mh() {
  }
  function gh(t, r) {
    var s = ht, a = Wn(), u = r(), d = !or(a.memoizedState, u);
    if (d && (a.memoizedState = u, vn = !0), a = a.queue, pu(Sh.bind(null, s, a, t), [t]), a.getSnapshot !== r || d || Dt !== null && Dt.memoizedState.tag & 1) {
      if (s.flags |= 2048, Ss(9, vh.bind(null, s, a, u, r), void 0, null), jt === null) throw Error(o(349));
      (Ro & 30) !== 0 || yh(s, r, u);
    }
    return u;
  }
  function yh(t, r, s) {
    t.flags |= 16384, t = { getSnapshot: r, value: s }, r = ht.updateQueue, r === null ? (r = { lastEffect: null, stores: null }, ht.updateQueue = r, r.stores = [t]) : (s = r.stores, s === null ? r.stores = [t] : s.push(t));
  }
  function vh(t, r, s, a) {
    r.value = s, r.getSnapshot = a, wh(r) && Ch(t);
  }
  function Sh(t, r, s) {
    return s(function() {
      wh(r) && Ch(t);
    });
  }
  function wh(t) {
    var r = t.getSnapshot;
    t = t.value;
    try {
      var s = r();
      return !or(t, s);
    } catch {
      return !0;
    }
  }
  function Ch(t) {
    var r = zr(t, 1);
    r !== null && cr(r, t, 1, -1);
  }
  function xh(t) {
    var r = Cr();
    return typeof t == "function" && (t = t()), r.memoizedState = r.baseState = t, t = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: vs, lastRenderedState: t }, r.queue = t, t = t.dispatch = Q1.bind(null, ht, t), [r.memoizedState, t];
  }
  function Ss(t, r, s, a) {
    return t = { tag: t, create: r, destroy: s, deps: a, next: null }, r = ht.updateQueue, r === null ? (r = { lastEffect: null, stores: null }, ht.updateQueue = r, r.lastEffect = t.next = t) : (s = r.lastEffect, s === null ? r.lastEffect = t.next = t : (a = s.next, s.next = t, t.next = a, r.lastEffect = t)), t;
  }
  function bh() {
    return Wn().memoizedState;
  }
  function Hl(t, r, s, a) {
    var u = Cr();
    ht.flags |= t, u.memoizedState = Ss(1 | r, s, void 0, a === void 0 ? null : a);
  }
  function Vl(t, r, s, a) {
    var u = Wn();
    a = a === void 0 ? null : a;
    var d = void 0;
    if (Ft !== null) {
      var S = Ft.memoizedState;
      if (d = S.destroy, a !== null && au(a, S.deps)) {
        u.memoizedState = Ss(r, s, d, a);
        return;
      }
    }
    ht.flags |= t, u.memoizedState = Ss(1 | r, s, d, a);
  }
  function Eh(t, r) {
    return Hl(8390656, 8, t, r);
  }
  function pu(t, r) {
    return Vl(2048, 8, t, r);
  }
  function $h(t, r) {
    return Vl(4, 2, t, r);
  }
  function Ph(t, r) {
    return Vl(4, 4, t, r);
  }
  function _h(t, r) {
    if (typeof r == "function") return t = t(), r(t), function() {
      r(null);
    };
    if (r != null) return t = t(), r.current = t, function() {
      r.current = null;
    };
  }
  function Rh(t, r, s) {
    return s = s != null ? s.concat([t]) : null, Vl(4, 4, _h.bind(null, r, t), s);
  }
  function hu() {
  }
  function Nh(t, r) {
    var s = Wn();
    r = r === void 0 ? null : r;
    var a = s.memoizedState;
    return a !== null && r !== null && au(r, a[1]) ? a[0] : (s.memoizedState = [t, r], t);
  }
  function kh(t, r) {
    var s = Wn();
    r = r === void 0 ? null : r;
    var a = s.memoizedState;
    return a !== null && r !== null && au(r, a[1]) ? a[0] : (t = t(), s.memoizedState = [t, r], t);
  }
  function Th(t, r, s) {
    return (Ro & 21) === 0 ? (t.baseState && (t.baseState = !1, vn = !0), t.memoizedState = s) : (or(s, r) || (s = ue(), ht.lanes |= s, No |= s, t.baseState = !0), r);
  }
  function Y1(t, r) {
    var s = De;
    De = s !== 0 && 4 > s ? s : 4, t(!0);
    var a = lu.transition;
    lu.transition = {};
    try {
      t(!1), r();
    } finally {
      De = s, lu.transition = a;
    }
  }
  function Mh() {
    return Wn().memoizedState;
  }
  function K1(t, r, s) {
    var a = co(t);
    if (s = { lane: a, action: s, hasEagerState: !1, eagerState: null, next: null }, Ih(t)) Fh(r, s);
    else if (s = uh(t, r, s, a), s !== null) {
      var u = cn();
      cr(s, t, a, u), Oh(s, r, a);
    }
  }
  function Q1(t, r, s) {
    var a = co(t), u = { lane: a, action: s, hasEagerState: !1, eagerState: null, next: null };
    if (Ih(t)) Fh(r, u);
    else {
      var d = t.alternate;
      if (t.lanes === 0 && (d === null || d.lanes === 0) && (d = r.lastRenderedReducer, d !== null)) try {
        var S = r.lastRenderedState, $ = d(S, s);
        if (u.hasEagerState = !0, u.eagerState = $, or($, S)) {
          var T = r.interleaved;
          T === null ? (u.next = u, tu(r)) : (u.next = T.next, T.next = u), r.interleaved = u;
          return;
        }
      } catch {
      }
      s = uh(t, r, u, a), s !== null && (u = cn(), cr(s, t, a, u), Oh(s, r, a));
    }
  }
  function Ih(t) {
    var r = t.alternate;
    return t === ht || r !== null && r === ht;
  }
  function Fh(t, r) {
    gs = jl = !0;
    var s = t.pending;
    s === null ? r.next = r : (r.next = s.next, s.next = r), t.pending = r;
  }
  function Oh(t, r, s) {
    if ((s & 4194240) !== 0) {
      var a = r.lanes;
      a &= t.pendingLanes, s |= a, r.lanes = s, Zo(t, s);
    }
  }
  var Wl = { readContext: Vn, useCallback: nn, useContext: nn, useEffect: nn, useImperativeHandle: nn, useInsertionEffect: nn, useLayoutEffect: nn, useMemo: nn, useReducer: nn, useRef: nn, useState: nn, useDebugValue: nn, useDeferredValue: nn, useTransition: nn, useMutableSource: nn, useSyncExternalStore: nn, useId: nn, unstable_isNewReconciler: !1 }, Z1 = { readContext: Vn, useCallback: function(t, r) {
    return Cr().memoizedState = [t, r === void 0 ? null : r], t;
  }, useContext: Vn, useEffect: Eh, useImperativeHandle: function(t, r, s) {
    return s = s != null ? s.concat([t]) : null, Hl(
      4194308,
      4,
      _h.bind(null, r, t),
      s
    );
  }, useLayoutEffect: function(t, r) {
    return Hl(4194308, 4, t, r);
  }, useInsertionEffect: function(t, r) {
    return Hl(4, 2, t, r);
  }, useMemo: function(t, r) {
    var s = Cr();
    return r = r === void 0 ? null : r, t = t(), s.memoizedState = [t, r], t;
  }, useReducer: function(t, r, s) {
    var a = Cr();
    return r = s !== void 0 ? s(r) : r, a.memoizedState = a.baseState = r, t = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: t, lastRenderedState: r }, a.queue = t, t = t.dispatch = K1.bind(null, ht, t), [a.memoizedState, t];
  }, useRef: function(t) {
    var r = Cr();
    return t = { current: t }, r.memoizedState = t;
  }, useState: xh, useDebugValue: hu, useDeferredValue: function(t) {
    return Cr().memoizedState = t;
  }, useTransition: function() {
    var t = xh(!1), r = t[0];
    return t = Y1.bind(null, t[1]), Cr().memoizedState = t, [r, t];
  }, useMutableSource: function() {
  }, useSyncExternalStore: function(t, r, s) {
    var a = ht, u = Cr();
    if (ct) {
      if (s === void 0) throw Error(o(407));
      s = s();
    } else {
      if (s = r(), jt === null) throw Error(o(349));
      (Ro & 30) !== 0 || yh(a, r, s);
    }
    u.memoizedState = s;
    var d = { value: s, getSnapshot: r };
    return u.queue = d, Eh(Sh.bind(
      null,
      a,
      d,
      t
    ), [t]), a.flags |= 2048, Ss(9, vh.bind(null, a, d, s, r), void 0, null), s;
  }, useId: function() {
    var t = Cr(), r = jt.identifierPrefix;
    if (ct) {
      var s = Or, a = Fr;
      s = (a & ~(1 << 32 - et(a) - 1)).toString(32) + s, r = ":" + r + "R" + s, s = ys++, 0 < s && (r += "H" + s.toString(32)), r += ":";
    } else s = G1++, r = ":" + r + "r" + s.toString(32) + ":";
    return t.memoizedState = r;
  }, unstable_isNewReconciler: !1 }, J1 = {
    readContext: Vn,
    useCallback: Nh,
    useContext: Vn,
    useEffect: pu,
    useImperativeHandle: Rh,
    useInsertionEffect: $h,
    useLayoutEffect: Ph,
    useMemo: kh,
    useReducer: fu,
    useRef: bh,
    useState: function() {
      return fu(vs);
    },
    useDebugValue: hu,
    useDeferredValue: function(t) {
      var r = Wn();
      return Th(r, Ft.memoizedState, t);
    },
    useTransition: function() {
      var t = fu(vs)[0], r = Wn().memoizedState;
      return [t, r];
    },
    useMutableSource: mh,
    useSyncExternalStore: gh,
    useId: Mh,
    unstable_isNewReconciler: !1
  }, eS = { readContext: Vn, useCallback: Nh, useContext: Vn, useEffect: pu, useImperativeHandle: Rh, useInsertionEffect: $h, useLayoutEffect: Ph, useMemo: kh, useReducer: du, useRef: bh, useState: function() {
    return du(vs);
  }, useDebugValue: hu, useDeferredValue: function(t) {
    var r = Wn();
    return Ft === null ? r.memoizedState = t : Th(r, Ft.memoizedState, t);
  }, useTransition: function() {
    var t = du(vs)[0], r = Wn().memoizedState;
    return [t, r];
  }, useMutableSource: mh, useSyncExternalStore: gh, useId: Mh, unstable_isNewReconciler: !1 };
  function sr(t, r) {
    if (t && t.defaultProps) {
      r = U({}, r), t = t.defaultProps;
      for (var s in t) r[s] === void 0 && (r[s] = t[s]);
      return r;
    }
    return r;
  }
  function mu(t, r, s, a) {
    r = t.memoizedState, s = s(a, r), s = s == null ? r : U({}, r, s), t.memoizedState = s, t.lanes === 0 && (t.updateQueue.baseState = s);
  }
  var Ul = { isMounted: function(t) {
    return (t = t._reactInternals) ? yt(t) === t : !1;
  }, enqueueSetState: function(t, r, s) {
    t = t._reactInternals;
    var a = cn(), u = co(t), d = Ar(a, u);
    d.payload = r, s != null && (d.callback = s), r = io(t, d, u), r !== null && (cr(r, t, u, a), Al(r, t, u));
  }, enqueueReplaceState: function(t, r, s) {
    t = t._reactInternals;
    var a = cn(), u = co(t), d = Ar(a, u);
    d.tag = 1, d.payload = r, s != null && (d.callback = s), r = io(t, d, u), r !== null && (cr(r, t, u, a), Al(r, t, u));
  }, enqueueForceUpdate: function(t, r) {
    t = t._reactInternals;
    var s = cn(), a = co(t), u = Ar(s, a);
    u.tag = 2, r != null && (u.callback = r), r = io(t, u, a), r !== null && (cr(r, t, a, s), Al(r, t, a));
  } };
  function zh(t, r, s, a, u, d, S) {
    return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(a, d, S) : r.prototype && r.prototype.isPureReactComponent ? !is(s, a) || !is(u, d) : !0;
  }
  function Ah(t, r, s) {
    var a = !1, u = no, d = r.contextType;
    return typeof d == "object" && d !== null ? d = Vn(d) : (u = yn(r) ? bo : tn.current, a = r.contextTypes, d = (a = a != null) ? ai(t, u) : no), r = new r(s, d), t.memoizedState = r.state !== null && r.state !== void 0 ? r.state : null, r.updater = Ul, t.stateNode = r, r._reactInternals = t, a && (t = t.stateNode, t.__reactInternalMemoizedUnmaskedChildContext = u, t.__reactInternalMemoizedMaskedChildContext = d), r;
  }
  function Lh(t, r, s, a) {
    t = r.state, typeof r.componentWillReceiveProps == "function" && r.componentWillReceiveProps(s, a), typeof r.UNSAFE_componentWillReceiveProps == "function" && r.UNSAFE_componentWillReceiveProps(s, a), r.state !== t && Ul.enqueueReplaceState(r, r.state, null);
  }
  function gu(t, r, s, a) {
    var u = t.stateNode;
    u.props = s, u.state = t.memoizedState, u.refs = {}, nu(t);
    var d = r.contextType;
    typeof d == "object" && d !== null ? u.context = Vn(d) : (d = yn(r) ? bo : tn.current, u.context = ai(t, d)), u.state = t.memoizedState, d = r.getDerivedStateFromProps, typeof d == "function" && (mu(t, r, d, s), u.state = t.memoizedState), typeof r.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (r = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), r !== u.state && Ul.enqueueReplaceState(u, u.state, null), Ll(t, s, u, a), u.state = t.memoizedState), typeof u.componentDidMount == "function" && (t.flags |= 4194308);
  }
  function gi(t, r) {
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
  function yu(t, r, s) {
    return { value: t, source: null, stack: s ?? null, digest: r ?? null };
  }
  function vu(t, r) {
    try {
      console.error(r.value);
    } catch (s) {
      setTimeout(function() {
        throw s;
      });
    }
  }
  var tS = typeof WeakMap == "function" ? WeakMap : Map;
  function Bh(t, r, s) {
    s = Ar(-1, s), s.tag = 3, s.payload = { element: null };
    var a = r.value;
    return s.callback = function() {
      Zl || (Zl = !0, Iu = a), vu(t, r);
    }, s;
  }
  function Dh(t, r, s) {
    s = Ar(-1, s), s.tag = 3;
    var a = t.type.getDerivedStateFromError;
    if (typeof a == "function") {
      var u = r.value;
      s.payload = function() {
        return a(u);
      }, s.callback = function() {
        vu(t, r);
      };
    }
    var d = t.stateNode;
    return d !== null && typeof d.componentDidCatch == "function" && (s.callback = function() {
      vu(t, r), typeof a != "function" && (lo === null ? lo = /* @__PURE__ */ new Set([this]) : lo.add(this));
      var S = r.stack;
      this.componentDidCatch(r.value, { componentStack: S !== null ? S : "" });
    }), s;
  }
  function jh(t, r, s) {
    var a = t.pingCache;
    if (a === null) {
      a = t.pingCache = new tS();
      var u = /* @__PURE__ */ new Set();
      a.set(r, u);
    } else u = a.get(r), u === void 0 && (u = /* @__PURE__ */ new Set(), a.set(r, u));
    u.has(s) || (u.add(s), t = mS.bind(null, t, r, s), r.then(t, t));
  }
  function Hh(t) {
    do {
      var r;
      if ((r = t.tag === 13) && (r = t.memoizedState, r = r !== null ? r.dehydrated !== null : !0), r) return t;
      t = t.return;
    } while (t !== null);
    return null;
  }
  function Vh(t, r, s, a, u) {
    return (t.mode & 1) === 0 ? (t === r ? t.flags |= 65536 : (t.flags |= 128, s.flags |= 131072, s.flags &= -52805, s.tag === 1 && (s.alternate === null ? s.tag = 17 : (r = Ar(-1, 1), r.tag = 2, io(s, r, 1))), s.lanes |= 1), t) : (t.flags |= 65536, t.lanes = u, t);
  }
  var nS = R.ReactCurrentOwner, vn = !1;
  function an(t, r, s, a) {
    r.child = t === null ? ch(r, null, s, a) : di(r, t.child, s, a);
  }
  function Wh(t, r, s, a, u) {
    s = s.render;
    var d = r.ref;
    return hi(r, u), a = cu(t, r, s, a, d, u), s = uu(), t !== null && !vn ? (r.updateQueue = t.updateQueue, r.flags &= -2053, t.lanes &= ~u, Lr(t, r, u)) : (ct && s && qc(r), r.flags |= 1, an(t, r, a, u), r.child);
  }
  function Uh(t, r, s, a, u) {
    if (t === null) {
      var d = s.type;
      return typeof d == "function" && !Du(d) && d.defaultProps === void 0 && s.compare === null && s.defaultProps === void 0 ? (r.tag = 15, r.type = d, qh(t, r, d, a, u)) : (t = oa(s.type, null, a, r, r.mode, u), t.ref = r.ref, t.return = r, r.child = t);
    }
    if (d = t.child, (t.lanes & u) === 0) {
      var S = d.memoizedProps;
      if (s = s.compare, s = s !== null ? s : is, s(S, a) && t.ref === r.ref) return Lr(t, r, u);
    }
    return r.flags |= 1, t = fo(d, a), t.ref = r.ref, t.return = r, r.child = t;
  }
  function qh(t, r, s, a, u) {
    if (t !== null) {
      var d = t.memoizedProps;
      if (is(d, a) && t.ref === r.ref) if (vn = !1, r.pendingProps = a = d, (t.lanes & u) !== 0) (t.flags & 131072) !== 0 && (vn = !0);
      else return r.lanes = t.lanes, Lr(t, r, u);
    }
    return Su(t, r, s, a, u);
  }
  function Xh(t, r, s) {
    var a = r.pendingProps, u = a.children, d = t !== null ? t.memoizedState : null;
    if (a.mode === "hidden") if ((r.mode & 1) === 0) r.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, ot(vi, kn), kn |= s;
    else {
      if ((s & 1073741824) === 0) return t = d !== null ? d.baseLanes | s : s, r.lanes = r.childLanes = 1073741824, r.memoizedState = { baseLanes: t, cachePool: null, transitions: null }, r.updateQueue = null, ot(vi, kn), kn |= t, null;
      r.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, a = d !== null ? d.baseLanes : s, ot(vi, kn), kn |= a;
    }
    else d !== null ? (a = d.baseLanes | s, r.memoizedState = null) : a = s, ot(vi, kn), kn |= a;
    return an(t, r, u, s), r.child;
  }
  function Gh(t, r) {
    var s = r.ref;
    (t === null && s !== null || t !== null && t.ref !== s) && (r.flags |= 512, r.flags |= 2097152);
  }
  function Su(t, r, s, a, u) {
    var d = yn(s) ? bo : tn.current;
    return d = ai(r, d), hi(r, u), s = cu(t, r, s, a, d, u), a = uu(), t !== null && !vn ? (r.updateQueue = t.updateQueue, r.flags &= -2053, t.lanes &= ~u, Lr(t, r, u)) : (ct && a && qc(r), r.flags |= 1, an(t, r, s, u), r.child);
  }
  function Yh(t, r, s, a, u) {
    if (yn(s)) {
      var d = !0;
      Nl(r);
    } else d = !1;
    if (hi(r, u), r.stateNode === null) Xl(t, r), Ah(r, s, a), gu(r, s, a, u), a = !0;
    else if (t === null) {
      var S = r.stateNode, $ = r.memoizedProps;
      S.props = $;
      var T = S.context, D = s.contextType;
      typeof D == "object" && D !== null ? D = Vn(D) : (D = yn(s) ? bo : tn.current, D = ai(r, D));
      var q = s.getDerivedStateFromProps, K = typeof q == "function" || typeof S.getSnapshotBeforeUpdate == "function";
      K || typeof S.UNSAFE_componentWillReceiveProps != "function" && typeof S.componentWillReceiveProps != "function" || ($ !== a || T !== D) && Lh(r, S, a, D), oo = !1;
      var W = r.memoizedState;
      S.state = W, Ll(r, a, S, u), T = r.memoizedState, $ !== a || W !== T || gn.current || oo ? (typeof q == "function" && (mu(r, s, q, a), T = r.memoizedState), ($ = oo || zh(r, s, $, a, W, T, D)) ? (K || typeof S.UNSAFE_componentWillMount != "function" && typeof S.componentWillMount != "function" || (typeof S.componentWillMount == "function" && S.componentWillMount(), typeof S.UNSAFE_componentWillMount == "function" && S.UNSAFE_componentWillMount()), typeof S.componentDidMount == "function" && (r.flags |= 4194308)) : (typeof S.componentDidMount == "function" && (r.flags |= 4194308), r.memoizedProps = a, r.memoizedState = T), S.props = a, S.state = T, S.context = D, a = $) : (typeof S.componentDidMount == "function" && (r.flags |= 4194308), a = !1);
    } else {
      S = r.stateNode, fh(t, r), $ = r.memoizedProps, D = r.type === r.elementType ? $ : sr(r.type, $), S.props = D, K = r.pendingProps, W = S.context, T = s.contextType, typeof T == "object" && T !== null ? T = Vn(T) : (T = yn(s) ? bo : tn.current, T = ai(r, T));
      var pe = s.getDerivedStateFromProps;
      (q = typeof pe == "function" || typeof S.getSnapshotBeforeUpdate == "function") || typeof S.UNSAFE_componentWillReceiveProps != "function" && typeof S.componentWillReceiveProps != "function" || ($ !== K || W !== T) && Lh(r, S, a, T), oo = !1, W = r.memoizedState, S.state = W, Ll(r, a, S, u);
      var ge = r.memoizedState;
      $ !== K || W !== ge || gn.current || oo ? (typeof pe == "function" && (mu(r, s, pe, a), ge = r.memoizedState), (D = oo || zh(r, s, D, a, W, ge, T) || !1) ? (q || typeof S.UNSAFE_componentWillUpdate != "function" && typeof S.componentWillUpdate != "function" || (typeof S.componentWillUpdate == "function" && S.componentWillUpdate(a, ge, T), typeof S.UNSAFE_componentWillUpdate == "function" && S.UNSAFE_componentWillUpdate(a, ge, T)), typeof S.componentDidUpdate == "function" && (r.flags |= 4), typeof S.getSnapshotBeforeUpdate == "function" && (r.flags |= 1024)) : (typeof S.componentDidUpdate != "function" || $ === t.memoizedProps && W === t.memoizedState || (r.flags |= 4), typeof S.getSnapshotBeforeUpdate != "function" || $ === t.memoizedProps && W === t.memoizedState || (r.flags |= 1024), r.memoizedProps = a, r.memoizedState = ge), S.props = a, S.state = ge, S.context = T, a = D) : (typeof S.componentDidUpdate != "function" || $ === t.memoizedProps && W === t.memoizedState || (r.flags |= 4), typeof S.getSnapshotBeforeUpdate != "function" || $ === t.memoizedProps && W === t.memoizedState || (r.flags |= 1024), a = !1);
    }
    return wu(t, r, s, a, d, u);
  }
  function wu(t, r, s, a, u, d) {
    Gh(t, r);
    var S = (r.flags & 128) !== 0;
    if (!a && !S) return u && eh(r, s, !1), Lr(t, r, d);
    a = r.stateNode, nS.current = r;
    var $ = S && typeof s.getDerivedStateFromError != "function" ? null : a.render();
    return r.flags |= 1, t !== null && S ? (r.child = di(r, t.child, null, d), r.child = di(r, null, $, d)) : an(t, r, $, d), r.memoizedState = a.state, u && eh(r, s, !0), r.child;
  }
  function Kh(t) {
    var r = t.stateNode;
    r.pendingContext ? Zp(t, r.pendingContext, r.pendingContext !== r.context) : r.context && Zp(t, r.context, !1), ru(t, r.containerInfo);
  }
  function Qh(t, r, s, a, u) {
    return fi(), Kc(u), r.flags |= 256, an(t, r, s, a), r.child;
  }
  var Cu = { dehydrated: null, treeContext: null, retryLane: 0 };
  function xu(t) {
    return { baseLanes: t, cachePool: null, transitions: null };
  }
  function Zh(t, r, s) {
    var a = r.pendingProps, u = pt.current, d = !1, S = (r.flags & 128) !== 0, $;
    if (($ = S) || ($ = t !== null && t.memoizedState === null ? !1 : (u & 2) !== 0), $ ? (d = !0, r.flags &= -129) : (t === null || t.memoizedState !== null) && (u |= 1), ot(pt, u & 1), t === null)
      return Yc(r), t = r.memoizedState, t !== null && (t = t.dehydrated, t !== null) ? ((r.mode & 1) === 0 ? r.lanes = 1 : t.data === "$!" ? r.lanes = 8 : r.lanes = 1073741824, null) : (S = a.children, t = a.fallback, d ? (a = r.mode, d = r.child, S = { mode: "hidden", children: S }, (a & 1) === 0 && d !== null ? (d.childLanes = 0, d.pendingProps = S) : d = ia(S, a, 0, null), t = Io(t, a, s, null), d.return = r, t.return = r, d.sibling = t, r.child = d, r.child.memoizedState = xu(s), r.memoizedState = Cu, t) : bu(r, S));
    if (u = t.memoizedState, u !== null && ($ = u.dehydrated, $ !== null)) return rS(t, r, S, a, $, u, s);
    if (d) {
      d = a.fallback, S = r.mode, u = t.child, $ = u.sibling;
      var T = { mode: "hidden", children: a.children };
      return (S & 1) === 0 && r.child !== u ? (a = r.child, a.childLanes = 0, a.pendingProps = T, r.deletions = null) : (a = fo(u, T), a.subtreeFlags = u.subtreeFlags & 14680064), $ !== null ? d = fo($, d) : (d = Io(d, S, s, null), d.flags |= 2), d.return = r, a.return = r, a.sibling = d, r.child = a, a = d, d = r.child, S = t.child.memoizedState, S = S === null ? xu(s) : { baseLanes: S.baseLanes | s, cachePool: null, transitions: S.transitions }, d.memoizedState = S, d.childLanes = t.childLanes & ~s, r.memoizedState = Cu, a;
    }
    return d = t.child, t = d.sibling, a = fo(d, { mode: "visible", children: a.children }), (r.mode & 1) === 0 && (a.lanes = s), a.return = r, a.sibling = null, t !== null && (s = r.deletions, s === null ? (r.deletions = [t], r.flags |= 16) : s.push(t)), r.child = a, r.memoizedState = null, a;
  }
  function bu(t, r) {
    return r = ia({ mode: "visible", children: r }, t.mode, 0, null), r.return = t, t.child = r;
  }
  function ql(t, r, s, a) {
    return a !== null && Kc(a), di(r, t.child, null, s), t = bu(r, r.pendingProps.children), t.flags |= 2, r.memoizedState = null, t;
  }
  function rS(t, r, s, a, u, d, S) {
    if (s)
      return r.flags & 256 ? (r.flags &= -257, a = yu(Error(o(422))), ql(t, r, S, a)) : r.memoizedState !== null ? (r.child = t.child, r.flags |= 128, null) : (d = a.fallback, u = r.mode, a = ia({ mode: "visible", children: a.children }, u, 0, null), d = Io(d, u, S, null), d.flags |= 2, a.return = r, d.return = r, a.sibling = d, r.child = a, (r.mode & 1) !== 0 && di(r, t.child, null, S), r.child.memoizedState = xu(S), r.memoizedState = Cu, d);
    if ((r.mode & 1) === 0) return ql(t, r, S, null);
    if (u.data === "$!") {
      if (a = u.nextSibling && u.nextSibling.dataset, a) var $ = a.dgst;
      return a = $, d = Error(o(419)), a = yu(d, a, void 0), ql(t, r, S, a);
    }
    if ($ = (S & t.childLanes) !== 0, vn || $) {
      if (a = jt, a !== null) {
        switch (S & -S) {
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
        u = (u & (a.suspendedLanes | S)) !== 0 ? 0 : u, u !== 0 && u !== d.retryLane && (d.retryLane = u, zr(t, u), cr(a, t, u, -1));
      }
      return Bu(), a = yu(Error(o(421))), ql(t, r, S, a);
    }
    return u.data === "$?" ? (r.flags |= 128, r.child = t.child, r = gS.bind(null, t), u._reactRetry = r, null) : (t = d.treeContext, Nn = eo(u.nextSibling), Rn = r, ct = !0, ir = null, t !== null && (jn[Hn++] = Fr, jn[Hn++] = Or, jn[Hn++] = Eo, Fr = t.id, Or = t.overflow, Eo = r), r = bu(r, a.children), r.flags |= 4096, r);
  }
  function Jh(t, r, s) {
    t.lanes |= r;
    var a = t.alternate;
    a !== null && (a.lanes |= r), eu(t.return, r, s);
  }
  function Eu(t, r, s, a, u) {
    var d = t.memoizedState;
    d === null ? t.memoizedState = { isBackwards: r, rendering: null, renderingStartTime: 0, last: a, tail: s, tailMode: u } : (d.isBackwards = r, d.rendering = null, d.renderingStartTime = 0, d.last = a, d.tail = s, d.tailMode = u);
  }
  function em(t, r, s) {
    var a = r.pendingProps, u = a.revealOrder, d = a.tail;
    if (an(t, r, a.children, s), a = pt.current, (a & 2) !== 0) a = a & 1 | 2, r.flags |= 128;
    else {
      if (t !== null && (t.flags & 128) !== 0) e: for (t = r.child; t !== null; ) {
        if (t.tag === 13) t.memoizedState !== null && Jh(t, s, r);
        else if (t.tag === 19) Jh(t, s, r);
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
        for (s = r.child, u = null; s !== null; ) t = s.alternate, t !== null && Bl(t) === null && (u = s), s = s.sibling;
        s = u, s === null ? (u = r.child, r.child = null) : (u = s.sibling, s.sibling = null), Eu(r, !1, u, s, d);
        break;
      case "backwards":
        for (s = null, u = r.child, r.child = null; u !== null; ) {
          if (t = u.alternate, t !== null && Bl(t) === null) {
            r.child = u;
            break;
          }
          t = u.sibling, u.sibling = s, s = u, u = t;
        }
        Eu(r, !0, s, null, d);
        break;
      case "together":
        Eu(r, !1, null, null, void 0);
        break;
      default:
        r.memoizedState = null;
    }
    return r.child;
  }
  function Xl(t, r) {
    (r.mode & 1) === 0 && t !== null && (t.alternate = null, r.alternate = null, r.flags |= 2);
  }
  function Lr(t, r, s) {
    if (t !== null && (r.dependencies = t.dependencies), No |= r.lanes, (s & r.childLanes) === 0) return null;
    if (t !== null && r.child !== t.child) throw Error(o(153));
    if (r.child !== null) {
      for (t = r.child, s = fo(t, t.pendingProps), r.child = s, s.return = r; t.sibling !== null; ) t = t.sibling, s = s.sibling = fo(t, t.pendingProps), s.return = r;
      s.sibling = null;
    }
    return r.child;
  }
  function oS(t, r, s) {
    switch (r.tag) {
      case 3:
        Kh(r), fi();
        break;
      case 5:
        hh(r);
        break;
      case 1:
        yn(r.type) && Nl(r);
        break;
      case 4:
        ru(r, r.stateNode.containerInfo);
        break;
      case 10:
        var a = r.type._context, u = r.memoizedProps.value;
        ot(Ol, a._currentValue), a._currentValue = u;
        break;
      case 13:
        if (a = r.memoizedState, a !== null)
          return a.dehydrated !== null ? (ot(pt, pt.current & 1), r.flags |= 128, null) : (s & r.child.childLanes) !== 0 ? Zh(t, r, s) : (ot(pt, pt.current & 1), t = Lr(t, r, s), t !== null ? t.sibling : null);
        ot(pt, pt.current & 1);
        break;
      case 19:
        if (a = (s & r.childLanes) !== 0, (t.flags & 128) !== 0) {
          if (a) return em(t, r, s);
          r.flags |= 128;
        }
        if (u = r.memoizedState, u !== null && (u.rendering = null, u.tail = null, u.lastEffect = null), ot(pt, pt.current), a) break;
        return null;
      case 22:
      case 23:
        return r.lanes = 0, Xh(t, r, s);
    }
    return Lr(t, r, s);
  }
  var tm, $u, nm, rm;
  tm = function(t, r) {
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
  }, $u = function() {
  }, nm = function(t, r, s, a) {
    var u = t.memoizedProps;
    if (u !== a) {
      t = r.stateNode, _o(wr.current);
      var d = null;
      switch (s) {
        case "input":
          u = Qe(t, u), a = Qe(t, a), d = [];
          break;
        case "select":
          u = U({}, u, { value: void 0 }), a = U({}, a, { value: void 0 }), d = [];
          break;
        case "textarea":
          u = He(t, u), a = He(t, a), d = [];
          break;
        default:
          typeof u.onClick != "function" && typeof a.onClick == "function" && (t.onclick = Pl);
      }
      Oe(s, a);
      var S;
      s = null;
      for (D in u) if (!a.hasOwnProperty(D) && u.hasOwnProperty(D) && u[D] != null) if (D === "style") {
        var $ = u[D];
        for (S in $) $.hasOwnProperty(S) && (s || (s = {}), s[S] = "");
      } else D !== "dangerouslySetInnerHTML" && D !== "children" && D !== "suppressContentEditableWarning" && D !== "suppressHydrationWarning" && D !== "autoFocus" && (l.hasOwnProperty(D) ? d || (d = []) : (d = d || []).push(D, null));
      for (D in a) {
        var T = a[D];
        if ($ = u?.[D], a.hasOwnProperty(D) && T !== $ && (T != null || $ != null)) if (D === "style") if ($) {
          for (S in $) !$.hasOwnProperty(S) || T && T.hasOwnProperty(S) || (s || (s = {}), s[S] = "");
          for (S in T) T.hasOwnProperty(S) && $[S] !== T[S] && (s || (s = {}), s[S] = T[S]);
        } else s || (d || (d = []), d.push(
          D,
          s
        )), s = T;
        else D === "dangerouslySetInnerHTML" ? (T = T ? T.__html : void 0, $ = $ ? $.__html : void 0, T != null && $ !== T && (d = d || []).push(D, T)) : D === "children" ? typeof T != "string" && typeof T != "number" || (d = d || []).push(D, "" + T) : D !== "suppressContentEditableWarning" && D !== "suppressHydrationWarning" && (l.hasOwnProperty(D) ? (T != null && D === "onScroll" && it("scroll", t), d || $ === T || (d = [])) : (d = d || []).push(D, T));
      }
      s && (d = d || []).push("style", s);
      var D = d;
      (r.updateQueue = D) && (r.flags |= 4);
    }
  }, rm = function(t, r, s, a) {
    s !== a && (r.flags |= 4);
  };
  function ws(t, r) {
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
  function rn(t) {
    var r = t.alternate !== null && t.alternate.child === t.child, s = 0, a = 0;
    if (r) for (var u = t.child; u !== null; ) s |= u.lanes | u.childLanes, a |= u.subtreeFlags & 14680064, a |= u.flags & 14680064, u.return = t, u = u.sibling;
    else for (u = t.child; u !== null; ) s |= u.lanes | u.childLanes, a |= u.subtreeFlags, a |= u.flags, u.return = t, u = u.sibling;
    return t.subtreeFlags |= a, t.childLanes = s, r;
  }
  function iS(t, r, s) {
    var a = r.pendingProps;
    switch (Xc(r), r.tag) {
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
        return rn(r), null;
      case 1:
        return yn(r.type) && Rl(), rn(r), null;
      case 3:
        return a = r.stateNode, mi(), st(gn), st(tn), su(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Il(r) ? r.flags |= 4 : t === null || t.memoizedState.isDehydrated && (r.flags & 256) === 0 || (r.flags |= 1024, ir !== null && (zu(ir), ir = null))), $u(t, r), rn(r), null;
      case 5:
        ou(r);
        var u = _o(ms.current);
        if (s = r.type, t !== null && r.stateNode != null) nm(t, r, s, a, u), t.ref !== r.ref && (r.flags |= 512, r.flags |= 2097152);
        else {
          if (!a) {
            if (r.stateNode === null) throw Error(o(166));
            return rn(r), null;
          }
          if (t = _o(wr.current), Il(r)) {
            a = r.stateNode, s = r.type;
            var d = r.memoizedProps;
            switch (a[Sr] = r, a[us] = d, t = (r.mode & 1) !== 0, s) {
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
                for (u = 0; u < ls.length; u++) it(ls[u], a);
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
                Ne(a, d), it("invalid", a);
                break;
              case "select":
                a._wrapperState = { wasMultiple: !!d.multiple }, it("invalid", a);
                break;
              case "textarea":
                Je(a, d), it("invalid", a);
            }
            Oe(s, d), u = null;
            for (var S in d) if (d.hasOwnProperty(S)) {
              var $ = d[S];
              S === "children" ? typeof $ == "string" ? a.textContent !== $ && (d.suppressHydrationWarning !== !0 && $l(a.textContent, $, t), u = ["children", $]) : typeof $ == "number" && a.textContent !== "" + $ && (d.suppressHydrationWarning !== !0 && $l(
                a.textContent,
                $,
                t
              ), u = ["children", "" + $]) : l.hasOwnProperty(S) && $ != null && S === "onScroll" && it("scroll", a);
            }
            switch (s) {
              case "input":
                ce(a), ze(a, d, !0);
                break;
              case "textarea":
                ce(a), fn(a);
                break;
              case "select":
              case "option":
                break;
              default:
                typeof d.onClick == "function" && (a.onclick = Pl);
            }
            a = u, r.updateQueue = a, a !== null && (r.flags |= 4);
          } else {
            S = u.nodeType === 9 ? u : u.ownerDocument, t === "http://www.w3.org/1999/xhtml" && (t = Rt(s)), t === "http://www.w3.org/1999/xhtml" ? s === "script" ? (t = S.createElement("div"), t.innerHTML = "<script><\/script>", t = t.removeChild(t.firstChild)) : typeof a.is == "string" ? t = S.createElement(s, { is: a.is }) : (t = S.createElement(s), s === "select" && (S = t, a.multiple ? S.multiple = !0 : a.size && (S.size = a.size))) : t = S.createElementNS(t, s), t[Sr] = r, t[us] = a, tm(t, r, !1, !1), r.stateNode = t;
            e: {
              switch (S = Ge(s, a), s) {
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
                  for (u = 0; u < ls.length; u++) it(ls[u], t);
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
                  Ne(t, a), u = Qe(t, a), it("invalid", t);
                  break;
                case "option":
                  u = a;
                  break;
                case "select":
                  t._wrapperState = { wasMultiple: !!a.multiple }, u = U({}, a, { value: void 0 }), it("invalid", t);
                  break;
                case "textarea":
                  Je(t, a), u = He(t, a), it("invalid", t);
                  break;
                default:
                  u = a;
              }
              Oe(s, u), $ = u;
              for (d in $) if ($.hasOwnProperty(d)) {
                var T = $[d];
                d === "style" ? Ve(t, T) : d === "dangerouslySetInnerHTML" ? (T = T ? T.__html : void 0, T != null && Nt(t, T)) : d === "children" ? typeof T == "string" ? (s !== "textarea" || T !== "") && mt(t, T) : typeof T == "number" && mt(t, "" + T) : d !== "suppressContentEditableWarning" && d !== "suppressHydrationWarning" && d !== "autoFocus" && (l.hasOwnProperty(d) ? T != null && d === "onScroll" && it("scroll", t) : T != null && _(t, d, T, S));
              }
              switch (s) {
                case "input":
                  ce(t), ze(t, a, !1);
                  break;
                case "textarea":
                  ce(t), fn(t);
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
                  typeof u.onClick == "function" && (t.onclick = Pl);
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
        return rn(r), null;
      case 6:
        if (t && r.stateNode != null) rm(t, r, t.memoizedProps, a);
        else {
          if (typeof a != "string" && r.stateNode === null) throw Error(o(166));
          if (s = _o(ms.current), _o(wr.current), Il(r)) {
            if (a = r.stateNode, s = r.memoizedProps, a[Sr] = r, (d = a.nodeValue !== s) && (t = Rn, t !== null)) switch (t.tag) {
              case 3:
                $l(a.nodeValue, s, (t.mode & 1) !== 0);
                break;
              case 5:
                t.memoizedProps.suppressHydrationWarning !== !0 && $l(a.nodeValue, s, (t.mode & 1) !== 0);
            }
            d && (r.flags |= 4);
          } else a = (s.nodeType === 9 ? s : s.ownerDocument).createTextNode(a), a[Sr] = r, r.stateNode = a;
        }
        return rn(r), null;
      case 13:
        if (st(pt), a = r.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
          if (ct && Nn !== null && (r.mode & 1) !== 0 && (r.flags & 128) === 0) sh(), fi(), r.flags |= 98560, d = !1;
          else if (d = Il(r), a !== null && a.dehydrated !== null) {
            if (t === null) {
              if (!d) throw Error(o(318));
              if (d = r.memoizedState, d = d !== null ? d.dehydrated : null, !d) throw Error(o(317));
              d[Sr] = r;
            } else fi(), (r.flags & 128) === 0 && (r.memoizedState = null), r.flags |= 4;
            rn(r), d = !1;
          } else ir !== null && (zu(ir), ir = null), d = !0;
          if (!d) return r.flags & 65536 ? r : null;
        }
        return (r.flags & 128) !== 0 ? (r.lanes = s, r) : (a = a !== null, a !== (t !== null && t.memoizedState !== null) && a && (r.child.flags |= 8192, (r.mode & 1) !== 0 && (t === null || (pt.current & 1) !== 0 ? Ot === 0 && (Ot = 3) : Bu())), r.updateQueue !== null && (r.flags |= 4), rn(r), null);
      case 4:
        return mi(), $u(t, r), t === null && as(r.stateNode.containerInfo), rn(r), null;
      case 10:
        return Jc(r.type._context), rn(r), null;
      case 17:
        return yn(r.type) && Rl(), rn(r), null;
      case 19:
        if (st(pt), d = r.memoizedState, d === null) return rn(r), null;
        if (a = (r.flags & 128) !== 0, S = d.rendering, S === null) if (a) ws(d, !1);
        else {
          if (Ot !== 0 || t !== null && (t.flags & 128) !== 0) for (t = r.child; t !== null; ) {
            if (S = Bl(t), S !== null) {
              for (r.flags |= 128, ws(d, !1), a = S.updateQueue, a !== null && (r.updateQueue = a, r.flags |= 4), r.subtreeFlags = 0, a = s, s = r.child; s !== null; ) d = s, t = a, d.flags &= 14680066, S = d.alternate, S === null ? (d.childLanes = 0, d.lanes = t, d.child = null, d.subtreeFlags = 0, d.memoizedProps = null, d.memoizedState = null, d.updateQueue = null, d.dependencies = null, d.stateNode = null) : (d.childLanes = S.childLanes, d.lanes = S.lanes, d.child = S.child, d.subtreeFlags = 0, d.deletions = null, d.memoizedProps = S.memoizedProps, d.memoizedState = S.memoizedState, d.updateQueue = S.updateQueue, d.type = S.type, t = S.dependencies, d.dependencies = t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }), s = s.sibling;
              return ot(pt, pt.current & 1 | 2), r.child;
            }
            t = t.sibling;
          }
          d.tail !== null && Be() > Si && (r.flags |= 128, a = !0, ws(d, !1), r.lanes = 4194304);
        }
        else {
          if (!a) if (t = Bl(S), t !== null) {
            if (r.flags |= 128, a = !0, s = t.updateQueue, s !== null && (r.updateQueue = s, r.flags |= 4), ws(d, !0), d.tail === null && d.tailMode === "hidden" && !S.alternate && !ct) return rn(r), null;
          } else 2 * Be() - d.renderingStartTime > Si && s !== 1073741824 && (r.flags |= 128, a = !0, ws(d, !1), r.lanes = 4194304);
          d.isBackwards ? (S.sibling = r.child, r.child = S) : (s = d.last, s !== null ? s.sibling = S : r.child = S, d.last = S);
        }
        return d.tail !== null ? (r = d.tail, d.rendering = r, d.tail = r.sibling, d.renderingStartTime = Be(), r.sibling = null, s = pt.current, ot(pt, a ? s & 1 | 2 : s & 1), r) : (rn(r), null);
      case 22:
      case 23:
        return Lu(), a = r.memoizedState !== null, t !== null && t.memoizedState !== null !== a && (r.flags |= 8192), a && (r.mode & 1) !== 0 ? (kn & 1073741824) !== 0 && (rn(r), r.subtreeFlags & 6 && (r.flags |= 8192)) : rn(r), null;
      case 24:
        return null;
      case 25:
        return null;
    }
    throw Error(o(156, r.tag));
  }
  function sS(t, r) {
    switch (Xc(r), r.tag) {
      case 1:
        return yn(r.type) && Rl(), t = r.flags, t & 65536 ? (r.flags = t & -65537 | 128, r) : null;
      case 3:
        return mi(), st(gn), st(tn), su(), t = r.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (r.flags = t & -65537 | 128, r) : null;
      case 5:
        return ou(r), null;
      case 13:
        if (st(pt), t = r.memoizedState, t !== null && t.dehydrated !== null) {
          if (r.alternate === null) throw Error(o(340));
          fi();
        }
        return t = r.flags, t & 65536 ? (r.flags = t & -65537 | 128, r) : null;
      case 19:
        return st(pt), null;
      case 4:
        return mi(), null;
      case 10:
        return Jc(r.type._context), null;
      case 22:
      case 23:
        return Lu(), null;
      case 24:
        return null;
      default:
        return null;
    }
  }
  var Gl = !1, on = !1, lS = typeof WeakSet == "function" ? WeakSet : Set, me = null;
  function yi(t, r) {
    var s = t.ref;
    if (s !== null) if (typeof s == "function") try {
      s(null);
    } catch (a) {
      vt(t, r, a);
    }
    else s.current = null;
  }
  function Pu(t, r, s) {
    try {
      s();
    } catch (a) {
      vt(t, r, a);
    }
  }
  var om = !1;
  function aS(t, r) {
    if (Lc = hl, t = zp(), kc(t)) {
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
          var S = 0, $ = -1, T = -1, D = 0, q = 0, K = t, W = null;
          t: for (; ; ) {
            for (var pe; K !== s || u !== 0 && K.nodeType !== 3 || ($ = S + u), K !== d || a !== 0 && K.nodeType !== 3 || (T = S + a), K.nodeType === 3 && (S += K.nodeValue.length), (pe = K.firstChild) !== null; )
              W = K, K = pe;
            for (; ; ) {
              if (K === t) break t;
              if (W === s && ++D === u && ($ = S), W === d && ++q === a && (T = S), (pe = K.nextSibling) !== null) break;
              K = W, W = K.parentNode;
            }
            K = pe;
          }
          s = $ === -1 || T === -1 ? null : { start: $, end: T };
        } else s = null;
      }
      s = s || { start: 0, end: 0 };
    } else s = null;
    for (Bc = { focusedElem: t, selectionRange: s }, hl = !1, me = r; me !== null; ) if (r = me, t = r.child, (r.subtreeFlags & 1028) !== 0 && t !== null) t.return = r, me = t;
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
              var ve = ge.memoizedProps, bt = ge.memoizedState, L = r.stateNode, I = L.getSnapshotBeforeUpdate(r.elementType === r.type ? ve : sr(r.type, ve), bt);
              L.__reactInternalSnapshotBeforeUpdate = I;
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
    return ge = om, om = !1, ge;
  }
  function Cs(t, r, s) {
    var a = r.updateQueue;
    if (a = a !== null ? a.lastEffect : null, a !== null) {
      var u = a = a.next;
      do {
        if ((u.tag & t) === t) {
          var d = u.destroy;
          u.destroy = void 0, d !== void 0 && Pu(r, s, d);
        }
        u = u.next;
      } while (u !== a);
    }
  }
  function Yl(t, r) {
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
  function _u(t) {
    var r = t.ref;
    if (r !== null) {
      var s = t.stateNode;
      t.tag, t = s, typeof r == "function" ? r(t) : r.current = t;
    }
  }
  function im(t) {
    var r = t.alternate;
    r !== null && (t.alternate = null, im(r)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (r = t.stateNode, r !== null && (delete r[Sr], delete r[us], delete r[Vc], delete r[W1], delete r[U1])), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
  }
  function sm(t) {
    return t.tag === 5 || t.tag === 3 || t.tag === 4;
  }
  function lm(t) {
    e: for (; ; ) {
      for (; t.sibling === null; ) {
        if (t.return === null || sm(t.return)) return null;
        t = t.return;
      }
      for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
        if (t.flags & 2 || t.child === null || t.tag === 4) continue e;
        t.child.return = t, t = t.child;
      }
      if (!(t.flags & 2)) return t.stateNode;
    }
  }
  function Ru(t, r, s) {
    var a = t.tag;
    if (a === 5 || a === 6) t = t.stateNode, r ? s.nodeType === 8 ? s.parentNode.insertBefore(t, r) : s.insertBefore(t, r) : (s.nodeType === 8 ? (r = s.parentNode, r.insertBefore(t, s)) : (r = s, r.appendChild(t)), s = s._reactRootContainer, s != null || r.onclick !== null || (r.onclick = Pl));
    else if (a !== 4 && (t = t.child, t !== null)) for (Ru(t, r, s), t = t.sibling; t !== null; ) Ru(t, r, s), t = t.sibling;
  }
  function Nu(t, r, s) {
    var a = t.tag;
    if (a === 5 || a === 6) t = t.stateNode, r ? s.insertBefore(t, r) : s.appendChild(t);
    else if (a !== 4 && (t = t.child, t !== null)) for (Nu(t, r, s), t = t.sibling; t !== null; ) Nu(t, r, s), t = t.sibling;
  }
  var Xt = null, lr = !1;
  function so(t, r, s) {
    for (s = s.child; s !== null; ) am(t, r, s), s = s.sibling;
  }
  function am(t, r, s) {
    if (at && typeof at.onCommitFiberUnmount == "function") try {
      at.onCommitFiberUnmount(mn, s);
    } catch {
    }
    switch (s.tag) {
      case 5:
        on || yi(s, r);
      case 6:
        var a = Xt, u = lr;
        Xt = null, so(t, r, s), Xt = a, lr = u, Xt !== null && (lr ? (t = Xt, s = s.stateNode, t.nodeType === 8 ? t.parentNode.removeChild(s) : t.removeChild(s)) : Xt.removeChild(s.stateNode));
        break;
      case 18:
        Xt !== null && (lr ? (t = Xt, s = s.stateNode, t.nodeType === 8 ? Hc(t.parentNode, s) : t.nodeType === 1 && Hc(t, s), Ji(t)) : Hc(Xt, s.stateNode));
        break;
      case 4:
        a = Xt, u = lr, Xt = s.stateNode.containerInfo, lr = !0, so(t, r, s), Xt = a, lr = u;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        if (!on && (a = s.updateQueue, a !== null && (a = a.lastEffect, a !== null))) {
          u = a = a.next;
          do {
            var d = u, S = d.destroy;
            d = d.tag, S !== void 0 && ((d & 2) !== 0 || (d & 4) !== 0) && Pu(s, r, S), u = u.next;
          } while (u !== a);
        }
        so(t, r, s);
        break;
      case 1:
        if (!on && (yi(s, r), a = s.stateNode, typeof a.componentWillUnmount == "function")) try {
          a.props = s.memoizedProps, a.state = s.memoizedState, a.componentWillUnmount();
        } catch ($) {
          vt(s, r, $);
        }
        so(t, r, s);
        break;
      case 21:
        so(t, r, s);
        break;
      case 22:
        s.mode & 1 ? (on = (a = on) || s.memoizedState !== null, so(t, r, s), on = a) : so(t, r, s);
        break;
      default:
        so(t, r, s);
    }
  }
  function cm(t) {
    var r = t.updateQueue;
    if (r !== null) {
      t.updateQueue = null;
      var s = t.stateNode;
      s === null && (s = t.stateNode = new lS()), r.forEach(function(a) {
        var u = yS.bind(null, t, a);
        s.has(a) || (s.add(a), a.then(u, u));
      });
    }
  }
  function ar(t, r) {
    var s = r.deletions;
    if (s !== null) for (var a = 0; a < s.length; a++) {
      var u = s[a];
      try {
        var d = t, S = r, $ = S;
        e: for (; $ !== null; ) {
          switch ($.tag) {
            case 5:
              Xt = $.stateNode, lr = !1;
              break e;
            case 3:
              Xt = $.stateNode.containerInfo, lr = !0;
              break e;
            case 4:
              Xt = $.stateNode.containerInfo, lr = !0;
              break e;
          }
          $ = $.return;
        }
        if (Xt === null) throw Error(o(160));
        am(d, S, u), Xt = null, lr = !1;
        var T = u.alternate;
        T !== null && (T.return = null), u.return = null;
      } catch (D) {
        vt(u, r, D);
      }
    }
    if (r.subtreeFlags & 12854) for (r = r.child; r !== null; ) um(r, t), r = r.sibling;
  }
  function um(t, r) {
    var s = t.alternate, a = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        if (ar(r, t), xr(t), a & 4) {
          try {
            Cs(3, t, t.return), Yl(3, t);
          } catch (ve) {
            vt(t, t.return, ve);
          }
          try {
            Cs(5, t, t.return);
          } catch (ve) {
            vt(t, t.return, ve);
          }
        }
        break;
      case 1:
        ar(r, t), xr(t), a & 512 && s !== null && yi(s, s.return);
        break;
      case 5:
        if (ar(r, t), xr(t), a & 512 && s !== null && yi(s, s.return), t.flags & 32) {
          var u = t.stateNode;
          try {
            mt(u, "");
          } catch (ve) {
            vt(t, t.return, ve);
          }
        }
        if (a & 4 && (u = t.stateNode, u != null)) {
          var d = t.memoizedProps, S = s !== null ? s.memoizedProps : d, $ = t.type, T = t.updateQueue;
          if (t.updateQueue = null, T !== null) try {
            $ === "input" && d.type === "radio" && d.name != null && Xe(u, d), Ge($, S);
            var D = Ge($, d);
            for (S = 0; S < T.length; S += 2) {
              var q = T[S], K = T[S + 1];
              q === "style" ? Ve(u, K) : q === "dangerouslySetInnerHTML" ? Nt(u, K) : q === "children" ? mt(u, K) : _(u, q, K, D);
            }
            switch ($) {
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
            u[us] = d;
          } catch (ve) {
            vt(t, t.return, ve);
          }
        }
        break;
      case 6:
        if (ar(r, t), xr(t), a & 4) {
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
        if (ar(r, t), xr(t), a & 4 && s !== null && s.memoizedState.isDehydrated) try {
          Ji(r.containerInfo);
        } catch (ve) {
          vt(t, t.return, ve);
        }
        break;
      case 4:
        ar(r, t), xr(t);
        break;
      case 13:
        ar(r, t), xr(t), u = t.child, u.flags & 8192 && (d = u.memoizedState !== null, u.stateNode.isHidden = d, !d || u.alternate !== null && u.alternate.memoizedState !== null || (Mu = Be())), a & 4 && cm(t);
        break;
      case 22:
        if (q = s !== null && s.memoizedState !== null, t.mode & 1 ? (on = (D = on) || q, ar(r, t), on = D) : ar(r, t), xr(t), a & 8192) {
          if (D = t.memoizedState !== null, (t.stateNode.isHidden = D) && !q && (t.mode & 1) !== 0) for (me = t, q = t.child; q !== null; ) {
            for (K = me = q; me !== null; ) {
              switch (W = me, pe = W.child, W.tag) {
                case 0:
                case 11:
                case 14:
                case 15:
                  Cs(4, W, W.return);
                  break;
                case 1:
                  yi(W, W.return);
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
                  yi(W, W.return);
                  break;
                case 22:
                  if (W.memoizedState !== null) {
                    pm(K);
                    continue;
                  }
              }
              pe !== null ? (pe.return = W, me = pe) : pm(K);
            }
            q = q.sibling;
          }
          e: for (q = null, K = t; ; ) {
            if (K.tag === 5) {
              if (q === null) {
                q = K;
                try {
                  u = K.stateNode, D ? (d = u.style, typeof d.setProperty == "function" ? d.setProperty("display", "none", "important") : d.display = "none") : ($ = K.stateNode, T = K.memoizedProps.style, S = T != null && T.hasOwnProperty("display") ? T.display : null, $.style.display = Yt("display", S));
                } catch (ve) {
                  vt(t, t.return, ve);
                }
              }
            } else if (K.tag === 6) {
              if (q === null) try {
                K.stateNode.nodeValue = D ? "" : K.memoizedProps;
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
              q === K && (q = null), K = K.return;
            }
            q === K && (q = null), K.sibling.return = K.return, K = K.sibling;
          }
        }
        break;
      case 19:
        ar(r, t), xr(t), a & 4 && cm(t);
        break;
      case 21:
        break;
      default:
        ar(
          r,
          t
        ), xr(t);
    }
  }
  function xr(t) {
    var r = t.flags;
    if (r & 2) {
      try {
        e: {
          for (var s = t.return; s !== null; ) {
            if (sm(s)) {
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
            var d = lm(t);
            Nu(t, d, u);
            break;
          case 3:
          case 4:
            var S = a.stateNode.containerInfo, $ = lm(t);
            Ru(t, $, S);
            break;
          default:
            throw Error(o(161));
        }
      } catch (T) {
        vt(t, t.return, T);
      }
      t.flags &= -3;
    }
    r & 4096 && (t.flags &= -4097);
  }
  function cS(t, r, s) {
    me = t, fm(t);
  }
  function fm(t, r, s) {
    for (var a = (t.mode & 1) !== 0; me !== null; ) {
      var u = me, d = u.child;
      if (u.tag === 22 && a) {
        var S = u.memoizedState !== null || Gl;
        if (!S) {
          var $ = u.alternate, T = $ !== null && $.memoizedState !== null || on;
          $ = Gl;
          var D = on;
          if (Gl = S, (on = T) && !D) for (me = u; me !== null; ) S = me, T = S.child, S.tag === 22 && S.memoizedState !== null ? hm(u) : T !== null ? (T.return = S, me = T) : hm(u);
          for (; d !== null; ) me = d, fm(d), d = d.sibling;
          me = u, Gl = $, on = D;
        }
        dm(t);
      } else (u.subtreeFlags & 8772) !== 0 && d !== null ? (d.return = u, me = d) : dm(t);
    }
  }
  function dm(t) {
    for (; me !== null; ) {
      var r = me;
      if ((r.flags & 8772) !== 0) {
        var s = r.alternate;
        try {
          if ((r.flags & 8772) !== 0) switch (r.tag) {
            case 0:
            case 11:
            case 15:
              on || Yl(5, r);
              break;
            case 1:
              var a = r.stateNode;
              if (r.flags & 4 && !on) if (s === null) a.componentDidMount();
              else {
                var u = r.elementType === r.type ? s.memoizedProps : sr(r.type, s.memoizedProps);
                a.componentDidUpdate(u, s.memoizedState, a.__reactInternalSnapshotBeforeUpdate);
              }
              var d = r.updateQueue;
              d !== null && ph(r, d, a);
              break;
            case 3:
              var S = r.updateQueue;
              if (S !== null) {
                if (s = null, r.child !== null) switch (r.child.tag) {
                  case 5:
                    s = r.child.stateNode;
                    break;
                  case 1:
                    s = r.child.stateNode;
                }
                ph(r, S, s);
              }
              break;
            case 5:
              var $ = r.stateNode;
              if (s === null && r.flags & 4) {
                s = $;
                var T = r.memoizedProps;
                switch (r.type) {
                  case "button":
                  case "input":
                  case "select":
                  case "textarea":
                    T.autoFocus && s.focus();
                    break;
                  case "img":
                    T.src && (s.src = T.src);
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
                var D = r.alternate;
                if (D !== null) {
                  var q = D.memoizedState;
                  if (q !== null) {
                    var K = q.dehydrated;
                    K !== null && Ji(K);
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
          on || r.flags & 512 && _u(r);
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
  function pm(t) {
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
  function hm(t) {
    for (; me !== null; ) {
      var r = me;
      try {
        switch (r.tag) {
          case 0:
          case 11:
          case 15:
            var s = r.return;
            try {
              Yl(4, r);
            } catch (T) {
              vt(r, s, T);
            }
            break;
          case 1:
            var a = r.stateNode;
            if (typeof a.componentDidMount == "function") {
              var u = r.return;
              try {
                a.componentDidMount();
              } catch (T) {
                vt(r, u, T);
              }
            }
            var d = r.return;
            try {
              _u(r);
            } catch (T) {
              vt(r, d, T);
            }
            break;
          case 5:
            var S = r.return;
            try {
              _u(r);
            } catch (T) {
              vt(r, S, T);
            }
        }
      } catch (T) {
        vt(r, r.return, T);
      }
      if (r === t) {
        me = null;
        break;
      }
      var $ = r.sibling;
      if ($ !== null) {
        $.return = r.return, me = $;
        break;
      }
      me = r.return;
    }
  }
  var uS = Math.ceil, Kl = R.ReactCurrentDispatcher, ku = R.ReactCurrentOwner, Un = R.ReactCurrentBatchConfig, Le = 0, jt = null, $t = null, Gt = 0, kn = 0, vi = to(0), Ot = 0, xs = null, No = 0, Ql = 0, Tu = 0, bs = null, Sn = null, Mu = 0, Si = 1 / 0, Br = null, Zl = !1, Iu = null, lo = null, Jl = !1, ao = null, ea = 0, Es = 0, Fu = null, ta = -1, na = 0;
  function cn() {
    return (Le & 6) !== 0 ? Be() : ta !== -1 ? ta : ta = Be();
  }
  function co(t) {
    return (t.mode & 1) === 0 ? 1 : (Le & 2) !== 0 && Gt !== 0 ? Gt & -Gt : X1.transition !== null ? (na === 0 && (na = ue()), na) : (t = De, t !== 0 || (t = window.event, t = t === void 0 ? 16 : gp(t.type)), t);
  }
  function cr(t, r, s, a) {
    if (50 < Es) throw Es = 0, Fu = null, Error(o(185));
    vr(t, s, a), ((Le & 2) === 0 || t !== jt) && (t === jt && ((Le & 2) === 0 && (Ql |= s), Ot === 4 && uo(t, Gt)), wn(t, a), s === 1 && Le === 0 && (r.mode & 1) === 0 && (Si = Be() + 500, kl && ro()));
  }
  function wn(t, r) {
    var s = t.callbackNode;
    Xi(t, r);
    var a = Co(t, t === jt ? Gt : 0);
    if (a === 0) s !== null && Xr(s), t.callbackNode = null, t.callbackPriority = 0;
    else if (r = a & -a, t.callbackPriority !== r) {
      if (s != null && Xr(s), r === 1) t.tag === 0 ? q1(gm.bind(null, t)) : th(gm.bind(null, t)), H1(function() {
        (Le & 6) === 0 && ro();
      }), s = null;
      else {
        switch (fl(a)) {
          case 1:
            s = Bn;
            break;
          case 4:
            s = _r;
            break;
          case 16:
            s = en;
            break;
          case 536870912:
            s = Dn;
            break;
          default:
            s = en;
        }
        s = Em(s, mm.bind(null, t));
      }
      t.callbackPriority = r, t.callbackNode = s;
    }
  }
  function mm(t, r) {
    if (ta = -1, na = 0, (Le & 6) !== 0) throw Error(o(327));
    var s = t.callbackNode;
    if (wi() && t.callbackNode !== s) return null;
    var a = Co(t, t === jt ? Gt : 0);
    if (a === 0) return null;
    if ((a & 30) !== 0 || (a & t.expiredLanes) !== 0 || r) r = ra(t, a);
    else {
      r = a;
      var u = Le;
      Le |= 2;
      var d = vm();
      (jt !== t || Gt !== r) && (Br = null, Si = Be() + 500, To(t, r));
      do
        try {
          pS();
          break;
        } catch ($) {
          ym(t, $);
        }
      while (!0);
      Zc(), Kl.current = d, Le = u, $t !== null ? r = 0 : (jt = null, Gt = 0, r = Ot);
    }
    if (r !== 0) {
      if (r === 2 && (u = Gi(t), u !== 0 && (a = u, r = Ou(t, u))), r === 1) throw s = xs, To(t, 0), uo(t, a), wn(t, Be()), s;
      if (r === 6) uo(t, a);
      else {
        if (u = t.current.alternate, (a & 30) === 0 && !fS(u) && (r = ra(t, a), r === 2 && (d = Gi(t), d !== 0 && (a = d, r = Ou(t, d))), r === 1)) throw s = xs, To(t, 0), uo(t, a), wn(t, Be()), s;
        switch (t.finishedWork = u, t.finishedLanes = a, r) {
          case 0:
          case 1:
            throw Error(o(345));
          case 2:
            Mo(t, Sn, Br);
            break;
          case 3:
            if (uo(t, a), (a & 130023424) === a && (r = Mu + 500 - Be(), 10 < r)) {
              if (Co(t, 0) !== 0) break;
              if (u = t.suspendedLanes, (u & a) !== a) {
                cn(), t.pingedLanes |= t.suspendedLanes & u;
                break;
              }
              t.timeoutHandle = jc(Mo.bind(null, t, Sn, Br), r);
              break;
            }
            Mo(t, Sn, Br);
            break;
          case 4:
            if (uo(t, a), (a & 4194240) === a) break;
            for (r = t.eventTimes, u = -1; 0 < a; ) {
              var S = 31 - et(a);
              d = 1 << S, S = r[S], S > u && (u = S), a &= ~d;
            }
            if (a = u, a = Be() - a, a = (120 > a ? 120 : 480 > a ? 480 : 1080 > a ? 1080 : 1920 > a ? 1920 : 3e3 > a ? 3e3 : 4320 > a ? 4320 : 1960 * uS(a / 1960)) - a, 10 < a) {
              t.timeoutHandle = jc(Mo.bind(null, t, Sn, Br), a);
              break;
            }
            Mo(t, Sn, Br);
            break;
          case 5:
            Mo(t, Sn, Br);
            break;
          default:
            throw Error(o(329));
        }
      }
    }
    return wn(t, Be()), t.callbackNode === s ? mm.bind(null, t) : null;
  }
  function Ou(t, r) {
    var s = bs;
    return t.current.memoizedState.isDehydrated && (To(t, r).flags |= 256), t = ra(t, r), t !== 2 && (r = Sn, Sn = s, r !== null && zu(r)), t;
  }
  function zu(t) {
    Sn === null ? Sn = t : Sn.push.apply(Sn, t);
  }
  function fS(t) {
    for (var r = t; ; ) {
      if (r.flags & 16384) {
        var s = r.updateQueue;
        if (s !== null && (s = s.stores, s !== null)) for (var a = 0; a < s.length; a++) {
          var u = s[a], d = u.getSnapshot;
          u = u.value;
          try {
            if (!or(d(), u)) return !1;
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
  function uo(t, r) {
    for (r &= ~Tu, r &= ~Ql, t.suspendedLanes |= r, t.pingedLanes &= ~r, t = t.expirationTimes; 0 < r; ) {
      var s = 31 - et(r), a = 1 << s;
      t[s] = -1, r &= ~a;
    }
  }
  function gm(t) {
    if ((Le & 6) !== 0) throw Error(o(327));
    wi();
    var r = Co(t, 0);
    if ((r & 1) === 0) return wn(t, Be()), null;
    var s = ra(t, r);
    if (t.tag !== 0 && s === 2) {
      var a = Gi(t);
      a !== 0 && (r = a, s = Ou(t, a));
    }
    if (s === 1) throw s = xs, To(t, 0), uo(t, r), wn(t, Be()), s;
    if (s === 6) throw Error(o(345));
    return t.finishedWork = t.current.alternate, t.finishedLanes = r, Mo(t, Sn, Br), wn(t, Be()), null;
  }
  function Au(t, r) {
    var s = Le;
    Le |= 1;
    try {
      return t(r);
    } finally {
      Le = s, Le === 0 && (Si = Be() + 500, kl && ro());
    }
  }
  function ko(t) {
    ao !== null && ao.tag === 0 && (Le & 6) === 0 && wi();
    var r = Le;
    Le |= 1;
    var s = Un.transition, a = De;
    try {
      if (Un.transition = null, De = 1, t) return t();
    } finally {
      De = a, Un.transition = s, Le = r, (Le & 6) === 0 && ro();
    }
  }
  function Lu() {
    kn = vi.current, st(vi);
  }
  function To(t, r) {
    t.finishedWork = null, t.finishedLanes = 0;
    var s = t.timeoutHandle;
    if (s !== -1 && (t.timeoutHandle = -1, j1(s)), $t !== null) for (s = $t.return; s !== null; ) {
      var a = s;
      switch (Xc(a), a.tag) {
        case 1:
          a = a.type.childContextTypes, a != null && Rl();
          break;
        case 3:
          mi(), st(gn), st(tn), su();
          break;
        case 5:
          ou(a);
          break;
        case 4:
          mi();
          break;
        case 13:
          st(pt);
          break;
        case 19:
          st(pt);
          break;
        case 10:
          Jc(a.type._context);
          break;
        case 22:
        case 23:
          Lu();
      }
      s = s.return;
    }
    if (jt = t, $t = t = fo(t.current, null), Gt = kn = r, Ot = 0, xs = null, Tu = Ql = No = 0, Sn = bs = null, Po !== null) {
      for (r = 0; r < Po.length; r++) if (s = Po[r], a = s.interleaved, a !== null) {
        s.interleaved = null;
        var u = a.next, d = s.pending;
        if (d !== null) {
          var S = d.next;
          d.next = u, a.next = S;
        }
        s.pending = a;
      }
      Po = null;
    }
    return t;
  }
  function ym(t, r) {
    do {
      var s = $t;
      try {
        if (Zc(), Dl.current = Wl, jl) {
          for (var a = ht.memoizedState; a !== null; ) {
            var u = a.queue;
            u !== null && (u.pending = null), a = a.next;
          }
          jl = !1;
        }
        if (Ro = 0, Dt = Ft = ht = null, gs = !1, ys = 0, ku.current = null, s === null || s.return === null) {
          Ot = 1, xs = r, $t = null;
          break;
        }
        e: {
          var d = t, S = s.return, $ = s, T = r;
          if (r = Gt, $.flags |= 32768, T !== null && typeof T == "object" && typeof T.then == "function") {
            var D = T, q = $, K = q.tag;
            if ((q.mode & 1) === 0 && (K === 0 || K === 11 || K === 15)) {
              var W = q.alternate;
              W ? (q.updateQueue = W.updateQueue, q.memoizedState = W.memoizedState, q.lanes = W.lanes) : (q.updateQueue = null, q.memoizedState = null);
            }
            var pe = Hh(S);
            if (pe !== null) {
              pe.flags &= -257, Vh(pe, S, $, d, r), pe.mode & 1 && jh(d, D, r), r = pe, T = D;
              var ge = r.updateQueue;
              if (ge === null) {
                var ve = /* @__PURE__ */ new Set();
                ve.add(T), r.updateQueue = ve;
              } else ge.add(T);
              break e;
            } else {
              if ((r & 1) === 0) {
                jh(d, D, r), Bu();
                break e;
              }
              T = Error(o(426));
            }
          } else if (ct && $.mode & 1) {
            var bt = Hh(S);
            if (bt !== null) {
              (bt.flags & 65536) === 0 && (bt.flags |= 256), Vh(bt, S, $, d, r), Kc(gi(T, $));
              break e;
            }
          }
          d = T = gi(T, $), Ot !== 4 && (Ot = 2), bs === null ? bs = [d] : bs.push(d), d = S;
          do {
            switch (d.tag) {
              case 3:
                d.flags |= 65536, r &= -r, d.lanes |= r;
                var L = Bh(d, T, r);
                dh(d, L);
                break e;
              case 1:
                $ = T;
                var I = d.type, B = d.stateNode;
                if ((d.flags & 128) === 0 && (typeof I.getDerivedStateFromError == "function" || B !== null && typeof B.componentDidCatch == "function" && (lo === null || !lo.has(B)))) {
                  d.flags |= 65536, r &= -r, d.lanes |= r;
                  var ne = Dh(d, $, r);
                  dh(d, ne);
                  break e;
                }
            }
            d = d.return;
          } while (d !== null);
        }
        wm(s);
      } catch (Se) {
        r = Se, $t === s && s !== null && ($t = s = s.return);
        continue;
      }
      break;
    } while (!0);
  }
  function vm() {
    var t = Kl.current;
    return Kl.current = Wl, t === null ? Wl : t;
  }
  function Bu() {
    (Ot === 0 || Ot === 3 || Ot === 2) && (Ot = 4), jt === null || (No & 268435455) === 0 && (Ql & 268435455) === 0 || uo(jt, Gt);
  }
  function ra(t, r) {
    var s = Le;
    Le |= 2;
    var a = vm();
    (jt !== t || Gt !== r) && (Br = null, To(t, r));
    do
      try {
        dS();
        break;
      } catch (u) {
        ym(t, u);
      }
    while (!0);
    if (Zc(), Le = s, Kl.current = a, $t !== null) throw Error(o(261));
    return jt = null, Gt = 0, Ot;
  }
  function dS() {
    for (; $t !== null; ) Sm($t);
  }
  function pS() {
    for (; $t !== null && !dt(); ) Sm($t);
  }
  function Sm(t) {
    var r = bm(t.alternate, t, kn);
    t.memoizedProps = t.pendingProps, r === null ? wm(t) : $t = r, ku.current = null;
  }
  function wm(t) {
    var r = t;
    do {
      var s = r.alternate;
      if (t = r.return, (r.flags & 32768) === 0) {
        if (s = iS(s, r, kn), s !== null) {
          $t = s;
          return;
        }
      } else {
        if (s = sS(s, r), s !== null) {
          s.flags &= 32767, $t = s;
          return;
        }
        if (t !== null) t.flags |= 32768, t.subtreeFlags = 0, t.deletions = null;
        else {
          Ot = 6, $t = null;
          return;
        }
      }
      if (r = r.sibling, r !== null) {
        $t = r;
        return;
      }
      $t = r = t;
    } while (r !== null);
    Ot === 0 && (Ot = 5);
  }
  function Mo(t, r, s) {
    var a = De, u = Un.transition;
    try {
      Un.transition = null, De = 1, hS(t, r, s, a);
    } finally {
      Un.transition = u, De = a;
    }
    return null;
  }
  function hS(t, r, s, a) {
    do
      wi();
    while (ao !== null);
    if ((Le & 6) !== 0) throw Error(o(327));
    s = t.finishedWork;
    var u = t.finishedLanes;
    if (s === null) return null;
    if (t.finishedWork = null, t.finishedLanes = 0, s === t.current) throw Error(o(177));
    t.callbackNode = null, t.callbackPriority = 0;
    var d = s.lanes | s.childLanes;
    if (gc(t, d), t === jt && ($t = jt = null, Gt = 0), (s.subtreeFlags & 2064) === 0 && (s.flags & 2064) === 0 || Jl || (Jl = !0, Em(en, function() {
      return wi(), null;
    })), d = (s.flags & 15990) !== 0, (s.subtreeFlags & 15990) !== 0 || d) {
      d = Un.transition, Un.transition = null;
      var S = De;
      De = 1;
      var $ = Le;
      Le |= 4, ku.current = null, aS(t, s), um(s, t), F1(Bc), hl = !!Lc, Bc = Lc = null, t.current = s, cS(s), Jt(), Le = $, De = S, Un.transition = d;
    } else t.current = s;
    if (Jl && (Jl = !1, ao = t, ea = u), d = t.pendingLanes, d === 0 && (lo = null), Re(s.stateNode), wn(t, Be()), r !== null) for (a = t.onRecoverableError, s = 0; s < r.length; s++) u = r[s], a(u.value, { componentStack: u.stack, digest: u.digest });
    if (Zl) throw Zl = !1, t = Iu, Iu = null, t;
    return (ea & 1) !== 0 && t.tag !== 0 && wi(), d = t.pendingLanes, (d & 1) !== 0 ? t === Fu ? Es++ : (Es = 0, Fu = t) : Es = 0, ro(), null;
  }
  function wi() {
    if (ao !== null) {
      var t = fl(ea), r = Un.transition, s = De;
      try {
        if (Un.transition = null, De = 16 > t ? 16 : t, ao === null) var a = !1;
        else {
          if (t = ao, ao = null, ea = 0, (Le & 6) !== 0) throw Error(o(331));
          var u = Le;
          for (Le |= 4, me = t.current; me !== null; ) {
            var d = me, S = d.child;
            if ((me.flags & 16) !== 0) {
              var $ = d.deletions;
              if ($ !== null) {
                for (var T = 0; T < $.length; T++) {
                  var D = $[T];
                  for (me = D; me !== null; ) {
                    var q = me;
                    switch (q.tag) {
                      case 0:
                      case 11:
                      case 15:
                        Cs(8, q, d);
                    }
                    var K = q.child;
                    if (K !== null) K.return = q, me = K;
                    else for (; me !== null; ) {
                      q = me;
                      var W = q.sibling, pe = q.return;
                      if (im(q), q === D) {
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
                      var bt = ve.sibling;
                      ve.sibling = null, ve = bt;
                    } while (ve !== null);
                  }
                }
                me = d;
              }
            }
            if ((d.subtreeFlags & 2064) !== 0 && S !== null) S.return = d, me = S;
            else e: for (; me !== null; ) {
              if (d = me, (d.flags & 2048) !== 0) switch (d.tag) {
                case 0:
                case 11:
                case 15:
                  Cs(9, d, d.return);
              }
              var L = d.sibling;
              if (L !== null) {
                L.return = d.return, me = L;
                break e;
              }
              me = d.return;
            }
          }
          var I = t.current;
          for (me = I; me !== null; ) {
            S = me;
            var B = S.child;
            if ((S.subtreeFlags & 2064) !== 0 && B !== null) B.return = S, me = B;
            else e: for (S = I; me !== null; ) {
              if ($ = me, ($.flags & 2048) !== 0) try {
                switch ($.tag) {
                  case 0:
                  case 11:
                  case 15:
                    Yl(9, $);
                }
              } catch (Se) {
                vt($, $.return, Se);
              }
              if ($ === S) {
                me = null;
                break e;
              }
              var ne = $.sibling;
              if (ne !== null) {
                ne.return = $.return, me = ne;
                break e;
              }
              me = $.return;
            }
          }
          if (Le = u, ro(), at && typeof at.onPostCommitFiberRoot == "function") try {
            at.onPostCommitFiberRoot(mn, t);
          } catch {
          }
          a = !0;
        }
        return a;
      } finally {
        De = s, Un.transition = r;
      }
    }
    return !1;
  }
  function Cm(t, r, s) {
    r = gi(s, r), r = Bh(t, r, 1), t = io(t, r, 1), r = cn(), t !== null && (vr(t, 1, r), wn(t, r));
  }
  function vt(t, r, s) {
    if (t.tag === 3) Cm(t, t, s);
    else for (; r !== null; ) {
      if (r.tag === 3) {
        Cm(r, t, s);
        break;
      } else if (r.tag === 1) {
        var a = r.stateNode;
        if (typeof r.type.getDerivedStateFromError == "function" || typeof a.componentDidCatch == "function" && (lo === null || !lo.has(a))) {
          t = gi(s, t), t = Dh(r, t, 1), r = io(r, t, 1), t = cn(), r !== null && (vr(r, 1, t), wn(r, t));
          break;
        }
      }
      r = r.return;
    }
  }
  function mS(t, r, s) {
    var a = t.pingCache;
    a !== null && a.delete(r), r = cn(), t.pingedLanes |= t.suspendedLanes & s, jt === t && (Gt & s) === s && (Ot === 4 || Ot === 3 && (Gt & 130023424) === Gt && 500 > Be() - Mu ? To(t, 0) : Tu |= s), wn(t, r);
  }
  function xm(t, r) {
    r === 0 && ((t.mode & 1) === 0 ? r = 1 : (r = Tr, Tr <<= 1, (Tr & 130023424) === 0 && (Tr = 4194304)));
    var s = cn();
    t = zr(t, r), t !== null && (vr(t, r, s), wn(t, s));
  }
  function gS(t) {
    var r = t.memoizedState, s = 0;
    r !== null && (s = r.retryLane), xm(t, s);
  }
  function yS(t, r) {
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
    a !== null && a.delete(r), xm(t, s);
  }
  var bm;
  bm = function(t, r, s) {
    if (t !== null) if (t.memoizedProps !== r.pendingProps || gn.current) vn = !0;
    else {
      if ((t.lanes & s) === 0 && (r.flags & 128) === 0) return vn = !1, oS(t, r, s);
      vn = (t.flags & 131072) !== 0;
    }
    else vn = !1, ct && (r.flags & 1048576) !== 0 && nh(r, Ml, r.index);
    switch (r.lanes = 0, r.tag) {
      case 2:
        var a = r.type;
        Xl(t, r), t = r.pendingProps;
        var u = ai(r, tn.current);
        hi(r, s), u = cu(null, r, a, t, u, s);
        var d = uu();
        return r.flags |= 1, typeof u == "object" && u !== null && typeof u.render == "function" && u.$$typeof === void 0 ? (r.tag = 1, r.memoizedState = null, r.updateQueue = null, yn(a) ? (d = !0, Nl(r)) : d = !1, r.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, nu(r), u.updater = Ul, r.stateNode = u, u._reactInternals = r, gu(r, a, t, s), r = wu(null, r, a, !0, d, s)) : (r.tag = 0, ct && d && qc(r), an(null, r, u, s), r = r.child), r;
      case 16:
        a = r.elementType;
        e: {
          switch (Xl(t, r), t = r.pendingProps, u = a._init, a = u(a._payload), r.type = a, u = r.tag = SS(a), t = sr(a, t), u) {
            case 0:
              r = Su(null, r, a, t, s);
              break e;
            case 1:
              r = Yh(null, r, a, t, s);
              break e;
            case 11:
              r = Wh(null, r, a, t, s);
              break e;
            case 14:
              r = Uh(null, r, a, sr(a.type, t), s);
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
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : sr(a, u), Su(t, r, a, u, s);
      case 1:
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : sr(a, u), Yh(t, r, a, u, s);
      case 3:
        e: {
          if (Kh(r), t === null) throw Error(o(387));
          a = r.pendingProps, d = r.memoizedState, u = d.element, fh(t, r), Ll(r, a, null, s);
          var S = r.memoizedState;
          if (a = S.element, d.isDehydrated) if (d = { element: a, isDehydrated: !1, cache: S.cache, pendingSuspenseBoundaries: S.pendingSuspenseBoundaries, transitions: S.transitions }, r.updateQueue.baseState = d, r.memoizedState = d, r.flags & 256) {
            u = gi(Error(o(423)), r), r = Qh(t, r, a, s, u);
            break e;
          } else if (a !== u) {
            u = gi(Error(o(424)), r), r = Qh(t, r, a, s, u);
            break e;
          } else for (Nn = eo(r.stateNode.containerInfo.firstChild), Rn = r, ct = !0, ir = null, s = ch(r, null, a, s), r.child = s; s; ) s.flags = s.flags & -3 | 4096, s = s.sibling;
          else {
            if (fi(), a === u) {
              r = Lr(t, r, s);
              break e;
            }
            an(t, r, a, s);
          }
          r = r.child;
        }
        return r;
      case 5:
        return hh(r), t === null && Yc(r), a = r.type, u = r.pendingProps, d = t !== null ? t.memoizedProps : null, S = u.children, Dc(a, u) ? S = null : d !== null && Dc(a, d) && (r.flags |= 32), Gh(t, r), an(t, r, S, s), r.child;
      case 6:
        return t === null && Yc(r), null;
      case 13:
        return Zh(t, r, s);
      case 4:
        return ru(r, r.stateNode.containerInfo), a = r.pendingProps, t === null ? r.child = di(r, null, a, s) : an(t, r, a, s), r.child;
      case 11:
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : sr(a, u), Wh(t, r, a, u, s);
      case 7:
        return an(t, r, r.pendingProps, s), r.child;
      case 8:
        return an(t, r, r.pendingProps.children, s), r.child;
      case 12:
        return an(t, r, r.pendingProps.children, s), r.child;
      case 10:
        e: {
          if (a = r.type._context, u = r.pendingProps, d = r.memoizedProps, S = u.value, ot(Ol, a._currentValue), a._currentValue = S, d !== null) if (or(d.value, S)) {
            if (d.children === u.children && !gn.current) {
              r = Lr(t, r, s);
              break e;
            }
          } else for (d = r.child, d !== null && (d.return = r); d !== null; ) {
            var $ = d.dependencies;
            if ($ !== null) {
              S = d.child;
              for (var T = $.firstContext; T !== null; ) {
                if (T.context === a) {
                  if (d.tag === 1) {
                    T = Ar(-1, s & -s), T.tag = 2;
                    var D = d.updateQueue;
                    if (D !== null) {
                      D = D.shared;
                      var q = D.pending;
                      q === null ? T.next = T : (T.next = q.next, q.next = T), D.pending = T;
                    }
                  }
                  d.lanes |= s, T = d.alternate, T !== null && (T.lanes |= s), eu(
                    d.return,
                    s,
                    r
                  ), $.lanes |= s;
                  break;
                }
                T = T.next;
              }
            } else if (d.tag === 10) S = d.type === r.type ? null : d.child;
            else if (d.tag === 18) {
              if (S = d.return, S === null) throw Error(o(341));
              S.lanes |= s, $ = S.alternate, $ !== null && ($.lanes |= s), eu(S, s, r), S = d.sibling;
            } else S = d.child;
            if (S !== null) S.return = d;
            else for (S = d; S !== null; ) {
              if (S === r) {
                S = null;
                break;
              }
              if (d = S.sibling, d !== null) {
                d.return = S.return, S = d;
                break;
              }
              S = S.return;
            }
            d = S;
          }
          an(t, r, u.children, s), r = r.child;
        }
        return r;
      case 9:
        return u = r.type, a = r.pendingProps.children, hi(r, s), u = Vn(u), a = a(u), r.flags |= 1, an(t, r, a, s), r.child;
      case 14:
        return a = r.type, u = sr(a, r.pendingProps), u = sr(a.type, u), Uh(t, r, a, u, s);
      case 15:
        return qh(t, r, r.type, r.pendingProps, s);
      case 17:
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : sr(a, u), Xl(t, r), r.tag = 1, yn(a) ? (t = !0, Nl(r)) : t = !1, hi(r, s), Ah(r, a, u), gu(r, a, u, s), wu(null, r, a, !0, t, s);
      case 19:
        return em(t, r, s);
      case 22:
        return Xh(t, r, s);
    }
    throw Error(o(156, r.tag));
  };
  function Em(t, r) {
    return gr(t, r);
  }
  function vS(t, r, s, a) {
    this.tag = t, this.key = s, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.ref = null, this.pendingProps = r, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = a, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function qn(t, r, s, a) {
    return new vS(t, r, s, a);
  }
  function Du(t) {
    return t = t.prototype, !(!t || !t.isReactComponent);
  }
  function SS(t) {
    if (typeof t == "function") return Du(t) ? 1 : 0;
    if (t != null) {
      if (t = t.$$typeof, t === X) return 11;
      if (t === G) return 14;
    }
    return 2;
  }
  function fo(t, r) {
    var s = t.alternate;
    return s === null ? (s = qn(t.tag, r, t.key, t.mode), s.elementType = t.elementType, s.type = t.type, s.stateNode = t.stateNode, s.alternate = t, t.alternate = s) : (s.pendingProps = r, s.type = t.type, s.flags = 0, s.subtreeFlags = 0, s.deletions = null), s.flags = t.flags & 14680064, s.childLanes = t.childLanes, s.lanes = t.lanes, s.child = t.child, s.memoizedProps = t.memoizedProps, s.memoizedState = t.memoizedState, s.updateQueue = t.updateQueue, r = t.dependencies, s.dependencies = r === null ? null : { lanes: r.lanes, firstContext: r.firstContext }, s.sibling = t.sibling, s.index = t.index, s.ref = t.ref, s;
  }
  function oa(t, r, s, a, u, d) {
    var S = 2;
    if (a = t, typeof t == "function") Du(t) && (S = 1);
    else if (typeof t == "string") S = 5;
    else e: switch (t) {
      case O:
        return Io(s.children, u, d, r);
      case z:
        S = 8, u |= 8;
        break;
      case H:
        return t = qn(12, s, r, u | 2), t.elementType = H, t.lanes = d, t;
      case Q:
        return t = qn(13, s, r, u), t.elementType = Q, t.lanes = d, t;
      case oe:
        return t = qn(19, s, r, u), t.elementType = oe, t.lanes = d, t;
      case he:
        return ia(s, u, d, r);
      default:
        if (typeof t == "object" && t !== null) switch (t.$$typeof) {
          case Y:
            S = 10;
            break e;
          case V:
            S = 9;
            break e;
          case X:
            S = 11;
            break e;
          case G:
            S = 14;
            break e;
          case le:
            S = 16, a = null;
            break e;
        }
        throw Error(o(130, t == null ? t : typeof t, ""));
    }
    return r = qn(S, s, r, u), r.elementType = t, r.type = a, r.lanes = d, r;
  }
  function Io(t, r, s, a) {
    return t = qn(7, t, a, r), t.lanes = s, t;
  }
  function ia(t, r, s, a) {
    return t = qn(22, t, a, r), t.elementType = he, t.lanes = s, t.stateNode = { isHidden: !1 }, t;
  }
  function ju(t, r, s) {
    return t = qn(6, t, null, r), t.lanes = s, t;
  }
  function Hu(t, r, s) {
    return r = qn(4, t.children !== null ? t.children : [], t.key, r), r.lanes = s, r.stateNode = { containerInfo: t.containerInfo, pendingChildren: null, implementation: t.implementation }, r;
  }
  function wS(t, r, s, a, u) {
    this.tag = r, this.containerInfo = t, this.finishedWork = this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.pendingContext = this.context = null, this.callbackPriority = 0, this.eventTimes = Fe(0), this.expirationTimes = Fe(-1), this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Fe(0), this.identifierPrefix = a, this.onRecoverableError = u, this.mutableSourceEagerHydrationData = null;
  }
  function Vu(t, r, s, a, u, d, S, $, T) {
    return t = new wS(t, r, s, $, T), r === 1 ? (r = 1, d === !0 && (r |= 8)) : r = 0, d = qn(3, null, null, r), t.current = d, d.stateNode = t, d.memoizedState = { element: a, isDehydrated: s, cache: null, transitions: null, pendingSuspenseBoundaries: null }, nu(d), t;
  }
  function CS(t, r, s) {
    var a = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return { $$typeof: F, key: a == null ? null : "" + a, children: t, containerInfo: r, implementation: s };
  }
  function $m(t) {
    if (!t) return no;
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
            if (yn(r.type)) {
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
      if (yn(s)) return Jp(t, s, r);
    }
    return r;
  }
  function Pm(t, r, s, a, u, d, S, $, T) {
    return t = Vu(s, a, !0, t, u, d, S, $, T), t.context = $m(null), s = t.current, a = cn(), u = co(s), d = Ar(a, u), d.callback = r ?? null, io(s, d, u), t.current.lanes = u, vr(t, u, a), wn(t, a), t;
  }
  function sa(t, r, s, a) {
    var u = r.current, d = cn(), S = co(u);
    return s = $m(s), r.context === null ? r.context = s : r.pendingContext = s, r = Ar(d, S), r.payload = { element: t }, a = a === void 0 ? null : a, a !== null && (r.callback = a), t = io(u, r, S), t !== null && (cr(t, u, S, d), Al(t, u, S)), S;
  }
  function la(t) {
    return t = t.current, t.child ? (t.child.tag === 5, t.child.stateNode) : null;
  }
  function _m(t, r) {
    if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
      var s = t.retryLane;
      t.retryLane = s !== 0 && s < r ? s : r;
    }
  }
  function Wu(t, r) {
    _m(t, r), (t = t.alternate) && _m(t, r);
  }
  function xS() {
    return null;
  }
  var Rm = typeof reportError == "function" ? reportError : function(t) {
    console.error(t);
  };
  function Uu(t) {
    this._internalRoot = t;
  }
  aa.prototype.render = Uu.prototype.render = function(t) {
    var r = this._internalRoot;
    if (r === null) throw Error(o(409));
    sa(t, r, null, null);
  }, aa.prototype.unmount = Uu.prototype.unmount = function() {
    var t = this._internalRoot;
    if (t !== null) {
      this._internalRoot = null;
      var r = t.containerInfo;
      ko(function() {
        sa(null, t, null, null);
      }), r[Mr] = null;
    }
  };
  function aa(t) {
    this._internalRoot = t;
  }
  aa.prototype.unstable_scheduleHydration = function(t) {
    if (t) {
      var r = fp();
      t = { blockedOn: null, target: t, priority: r };
      for (var s = 0; s < Qr.length && r !== 0 && r < Qr[s].priority; s++) ;
      Qr.splice(s, 0, t), s === 0 && hp(t);
    }
  };
  function qu(t) {
    return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11);
  }
  function ca(t) {
    return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11 && (t.nodeType !== 8 || t.nodeValue !== " react-mount-point-unstable "));
  }
  function Nm() {
  }
  function bS(t, r, s, a, u) {
    if (u) {
      if (typeof a == "function") {
        var d = a;
        a = function() {
          var D = la(S);
          d.call(D);
        };
      }
      var S = Pm(r, a, t, 0, null, !1, !1, "", Nm);
      return t._reactRootContainer = S, t[Mr] = S.current, as(t.nodeType === 8 ? t.parentNode : t), ko(), S;
    }
    for (; u = t.lastChild; ) t.removeChild(u);
    if (typeof a == "function") {
      var $ = a;
      a = function() {
        var D = la(T);
        $.call(D);
      };
    }
    var T = Vu(t, 0, !1, null, null, !1, !1, "", Nm);
    return t._reactRootContainer = T, t[Mr] = T.current, as(t.nodeType === 8 ? t.parentNode : t), ko(function() {
      sa(r, T, s, a);
    }), T;
  }
  function ua(t, r, s, a, u) {
    var d = s._reactRootContainer;
    if (d) {
      var S = d;
      if (typeof u == "function") {
        var $ = u;
        u = function() {
          var T = la(S);
          $.call(T);
        };
      }
      sa(r, S, t, u);
    } else S = bS(s, r, t, u, a);
    return la(S);
  }
  cp = function(t) {
    switch (t.tag) {
      case 3:
        var r = t.stateNode;
        if (r.current.memoizedState.isDehydrated) {
          var s = yr(r.pendingLanes);
          s !== 0 && (Zo(r, s | 1), wn(r, Be()), (Le & 6) === 0 && (Si = Be() + 500, ro()));
        }
        break;
      case 13:
        ko(function() {
          var a = zr(t, 1);
          if (a !== null) {
            var u = cn();
            cr(a, t, 1, u);
          }
        }), Wu(t, 1);
    }
  }, yc = function(t) {
    if (t.tag === 13) {
      var r = zr(t, 134217728);
      if (r !== null) {
        var s = cn();
        cr(r, t, 134217728, s);
      }
      Wu(t, 134217728);
    }
  }, up = function(t) {
    if (t.tag === 13) {
      var r = co(t), s = zr(t, r);
      if (s !== null) {
        var a = cn();
        cr(s, t, r, a);
      }
      Wu(t, r);
    }
  }, fp = function() {
    return De;
  }, dp = function(t, r) {
    var s = De;
    try {
      return De = t, r();
    } finally {
      De = s;
    }
  }, nt = function(t, r, s) {
    switch (r) {
      case "input":
        if (ut(t, s), r = s.name, s.type === "radio" && r != null) {
          for (s = t; s.parentNode; ) s = s.parentNode;
          for (s = s.querySelectorAll("input[name=" + JSON.stringify("" + r) + '][type="radio"]'), r = 0; r < s.length; r++) {
            var a = s[r];
            if (a !== t && a.form === t.form) {
              var u = _l(a);
              if (!u) throw Error(o(90));
              ke(a), ut(a, u);
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
  }, Ee = Au, Ce = ko;
  var ES = { usingClientEntryPoint: !1, Events: [fs, si, _l, $n, de, Au] }, $s = { findFiberByHostInstance: xo, bundleType: 0, version: "18.3.1", rendererPackageName: "react-dom" }, $S = { bundleType: $s.bundleType, version: $s.version, rendererPackageName: $s.rendererPackageName, rendererConfig: $s.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: R.ReactCurrentDispatcher, findHostInstanceByFiber: function(t) {
    return t = qr(t), t === null ? null : t.stateNode;
  }, findFiberByHostInstance: $s.findFiberByHostInstance || xS, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1-next-f1338f8080-20240426" };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var fa = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!fa.isDisabled && fa.supportsFiber) try {
      mn = fa.inject($S), at = fa;
    } catch {
    }
  }
  return Cn.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ES, Cn.createPortal = function(t, r) {
    var s = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!qu(r)) throw Error(o(200));
    return CS(t, r, null, s);
  }, Cn.createRoot = function(t, r) {
    if (!qu(t)) throw Error(o(299));
    var s = !1, a = "", u = Rm;
    return r != null && (r.unstable_strictMode === !0 && (s = !0), r.identifierPrefix !== void 0 && (a = r.identifierPrefix), r.onRecoverableError !== void 0 && (u = r.onRecoverableError)), r = Vu(t, 1, !1, null, null, s, !1, a, u), t[Mr] = r.current, as(t.nodeType === 8 ? t.parentNode : t), new Uu(r);
  }, Cn.findDOMNode = function(t) {
    if (t == null) return null;
    if (t.nodeType === 1) return t;
    var r = t._reactInternals;
    if (r === void 0)
      throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
    return t = qr(r), t = t === null ? null : t.stateNode, t;
  }, Cn.flushSync = function(t) {
    return ko(t);
  }, Cn.hydrate = function(t, r, s) {
    if (!ca(r)) throw Error(o(200));
    return ua(null, t, r, !0, s);
  }, Cn.hydrateRoot = function(t, r, s) {
    if (!qu(t)) throw Error(o(405));
    var a = s != null && s.hydratedSources || null, u = !1, d = "", S = Rm;
    if (s != null && (s.unstable_strictMode === !0 && (u = !0), s.identifierPrefix !== void 0 && (d = s.identifierPrefix), s.onRecoverableError !== void 0 && (S = s.onRecoverableError)), r = Pm(r, null, t, 1, s ?? null, u, !1, d, S), t[Mr] = r.current, as(t), a) for (t = 0; t < a.length; t++) s = a[t], u = s._getVersion, u = u(s._source), r.mutableSourceEagerHydrationData == null ? r.mutableSourceEagerHydrationData = [s, u] : r.mutableSourceEagerHydrationData.push(
      s,
      u
    );
    return new aa(r);
  }, Cn.render = function(t, r, s) {
    if (!ca(r)) throw Error(o(200));
    return ua(null, t, r, !1, s);
  }, Cn.unmountComponentAtNode = function(t) {
    if (!ca(t)) throw Error(o(40));
    return t._reactRootContainer ? (ko(function() {
      ua(null, null, t, !1, function() {
        t._reactRootContainer = null, t[Mr] = null;
      });
    }), !0) : !1;
  }, Cn.unstable_batchedUpdates = Au, Cn.unstable_renderSubtreeIntoContainer = function(t, r, s, a) {
    if (!ca(s)) throw Error(o(200));
    if (t == null || t._reactInternals === void 0) throw Error(o(38));
    return ua(t, r, s, !1, a);
  }, Cn.version = "18.3.1-next-f1338f8080-20240426", Cn;
}
var ng;
function fy() {
  if (ng) return nf.exports;
  ng = 1;
  function e() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(e);
      } catch (n) {
        console.error(n);
      }
  }
  return e(), nf.exports = oC(), nf.exports;
}
var rg;
function iC() {
  if (rg) return pa;
  rg = 1;
  var e = fy();
  return pa.createRoot = e.createRoot, pa.hydrateRoot = e.hydrateRoot, pa;
}
var dy = iC(), lc = fy();
const sC = /* @__PURE__ */ h.createContext({}), Ff = /* @__PURE__ */ h.createContext(null);
function lC({
  children: e,
  onBatchResize: n
}) {
  const o = h.useRef(0), i = h.useRef([]), l = h.useContext(Ff), c = h.useCallback((f, p, g) => {
    o.current += 1;
    const m = o.current;
    i.current.push({
      size: f,
      element: p,
      data: g
    }), Promise.resolve().then(() => {
      m === o.current && (n?.(i.current), i.current = []);
    }), l?.(f, p, g);
  }, [n, l]);
  return /* @__PURE__ */ h.createElement(Ff.Provider, {
    value: c
  }, e);
}
const yo = /* @__PURE__ */ new Map();
function aC(e) {
  e.forEach((n) => {
    const {
      target: o
    } = n;
    yo.get(o)?.forEach((i) => i(o));
  });
}
let sf;
function py() {
  return sf || (sf = new ResizeObserver(aC)), sf;
}
function cC(e, n) {
  yo.has(e) || (yo.set(e, /* @__PURE__ */ new Set()), py().observe(e)), yo.get(e).add(n);
}
function uC(e, n) {
  yo.has(e) && (yo.get(e).delete(n), yo.get(e).size || (py().unobserve(e), yo.delete(e)));
}
function hy(e, n, o, i) {
  const l = h.useRef({
    width: -1,
    height: -1,
    offsetWidth: -1,
    offsetHeight: -1
  }), c = wt((g) => {
    const {
      width: m,
      height: y
    } = g.getBoundingClientRect(), {
      offsetWidth: v,
      offsetHeight: w
    } = g, x = Math.floor(m), b = Math.floor(y);
    if (l.current.width !== x || l.current.height !== b || l.current.offsetWidth !== v || l.current.offsetHeight !== w) {
      const C = {
        width: x,
        height: b,
        offsetWidth: v,
        offsetHeight: w
      };
      l.current = C;
      const E = v === Math.round(m) ? m : v, P = w === Math.round(y) ? y : w, N = {
        ...C,
        offsetWidth: E,
        offsetHeight: P
      };
      i?.(N, g), Promise.resolve().then(() => {
        o?.(N, g);
      });
    }
  }), f = typeof n == "function", p = h.useRef(0);
  h.useEffect(() => {
    const g = f ? n() : n;
    return g && e ? cC(g, c) : e && f && (p.current += 1), () => {
      g && uC(g, c);
    };
  }, [
    e,
    // If function target resolves after a parent render, the bumped ref value
    // lets the next render re-run this effect without watching the function identity.
    f ? p.current : n
  ]);
}
function fC(e, n) {
  const {
    children: o,
    disabled: i,
    onResize: l,
    data: c
  } = e, f = h.useRef(null), p = h.useContext(Ff), g = typeof o == "function", m = g ? o(f) : o, y = !g && /* @__PURE__ */ h.isValidElement(m) && Bd(m), v = y ? sc(m) : null, w = Ld(v, f), x = () => jd(f.current);
  return h.useImperativeHandle(n, () => x()), hy(!i, x, l, (b, C) => {
    p?.(b, C, c);
  }), y ? /* @__PURE__ */ h.cloneElement(m, {
    ref: w
  }) : m;
}
const dC = /* @__PURE__ */ h.forwardRef(fC);
function Of() {
  return Of = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Of.apply(this, arguments);
}
const pC = "rc-observer-key";
function hC(e, n) {
  const {
    children: o
  } = e;
  return (typeof o == "function" ? [o] : Js(o)).map((l, c) => {
    const f = l?.key || `${pC}-${c}`;
    return /* @__PURE__ */ h.createElement(dC, Of({}, e, {
      key: f,
      ref: c === 0 ? n : void 0
    }), l);
  });
}
const my = /* @__PURE__ */ h.forwardRef(hC);
my.Collection = lC;
function gy(e) {
  var n, o, i = "";
  if (typeof e == "string" || typeof e == "number") i += e;
  else if (typeof e == "object") if (Array.isArray(e)) {
    var l = e.length;
    for (n = 0; n < l; n++) e[n] && (o = gy(e[n])) && (i && (i += " "), i += o);
  } else for (o in e) e[o] && (i && (i += " "), i += o);
  return i;
}
function we() {
  for (var e, n, o = 0, i = "", l = arguments.length; o < l; o++) (e = arguments[o]) && (n = gy(e)) && (i && (i += " "), i += n);
  return i;
}
function zf(e, n) {
  (n == null || n > e.length) && (n = e.length);
  for (var o = 0, i = Array(n); o < n; o++) i[o] = e[o];
  return i;
}
function mC(e) {
  if (Array.isArray(e)) return zf(e);
}
function gC(e) {
  if (typeof Symbol < "u" && e[Symbol.iterator] != null || e["@@iterator"] != null) return Array.from(e);
}
function yy(e, n) {
  if (e) {
    if (typeof e == "string") return zf(e, n);
    var o = {}.toString.call(e).slice(8, -1);
    return o === "Object" && e.constructor && (o = e.constructor.name), o === "Map" || o === "Set" ? Array.from(e) : o === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(o) ? zf(e, n) : void 0;
  }
}
function yC() {
  throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function el(e) {
  return mC(e) || gC(e) || yy(e) || yC();
}
const og = "ant", Hd = "anticon", vC = ["outlined", "borderless", "filled", "underlined"], SC = (e, n) => n || (e ? `${og}-${e}` : og), On = /* @__PURE__ */ h.createContext({
  // We provide a default function for Context without provider
  getPrefixCls: SC,
  iconPrefixCls: Hd
}), {
  Consumer: d_
} = On, ig = {};
function Qo(e) {
  const n = h.useContext(On), {
    getPrefixCls: o,
    direction: i,
    getPopupContainer: l,
    renderEmpty: c
  } = n, f = n[e];
  return {
    classNames: ig,
    styles: ig,
    ...f,
    getPrefixCls: o,
    direction: i,
    getPopupContainer: l,
    renderEmpty: c
  };
}
function hr(e) {
  "@babel/helpers - typeof";
  return hr = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(n) {
    return typeof n;
  } : function(n) {
    return n && typeof Symbol == "function" && n.constructor === Symbol && n !== Symbol.prototype ? "symbol" : typeof n;
  }, hr(e);
}
function wC(e) {
  if (Array.isArray(e)) return e;
}
function CC(e, n) {
  var o = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
  if (o != null) {
    var i, l, c, f, p = [], g = !0, m = !1;
    try {
      if (c = (o = o.call(e)).next, n === 0) {
        if (Object(o) !== o) return;
        g = !1;
      } else for (; !(g = (i = c.call(o)).done) && (p.push(i.value), p.length !== n); g = !0) ;
    } catch (y) {
      m = !0, l = y;
    } finally {
      try {
        if (!g && o.return != null && (f = o.return(), Object(f) !== f)) return;
      } finally {
        if (m) throw l;
      }
    }
    return p;
  }
}
function xC() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function Wa(e, n) {
  return wC(e) || CC(e, n) || yy(e, n) || xC();
}
function bC(e, n) {
  if (hr(e) != "object" || !e) return e;
  var o = e[Symbol.toPrimitive];
  if (o !== void 0) {
    var i = o.call(e, n);
    if (hr(i) != "object") return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (n === "string" ? String : Number)(e);
}
function vy(e) {
  var n = bC(e, "string");
  return hr(n) == "symbol" ? n : n + "";
}
function Pt(e, n, o) {
  return (n = vy(n)) in e ? Object.defineProperty(e, n, {
    value: o,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[n] = o, e;
}
function sg(e, n) {
  var o = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var i = Object.getOwnPropertySymbols(e);
    n && (i = i.filter(function(l) {
      return Object.getOwnPropertyDescriptor(e, l).enumerable;
    })), o.push.apply(o, i);
  }
  return o;
}
function bn(e) {
  for (var n = 1; n < arguments.length; n++) {
    var o = arguments[n] != null ? arguments[n] : {};
    n % 2 ? sg(Object(o), !0).forEach(function(i) {
      Pt(e, i, o[i]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(o)) : sg(Object(o)).forEach(function(i) {
      Object.defineProperty(e, i, Object.getOwnPropertyDescriptor(o, i));
    });
  }
  return e;
}
function Hi(e, n) {
  if (!(e instanceof n)) throw new TypeError("Cannot call a class as a function");
}
function EC(e, n) {
  for (var o = 0; o < n.length; o++) {
    var i = n[o];
    i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, vy(i.key), i);
  }
}
function Vi(e, n, o) {
  return n && EC(e.prototype, n), Object.defineProperty(e, "prototype", {
    writable: !1
  }), e;
}
function Aa(e) {
  if (e === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  return e;
}
function Af(e, n) {
  return Af = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(o, i) {
    return o.__proto__ = i, o;
  }, Af(e, n);
}
function $C(e, n) {
  if (typeof n != "function" && n !== null) throw new TypeError("Super expression must either be null or a function");
  e.prototype = Object.create(n && n.prototype, {
    constructor: {
      value: e,
      writable: !0,
      configurable: !0
    }
  }), Object.defineProperty(e, "prototype", {
    writable: !1
  }), n && Af(e, n);
}
function Ua(e) {
  return Ua = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(n) {
    return n.__proto__ || Object.getPrototypeOf(n);
  }, Ua(e);
}
function Sy() {
  try {
    var e = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (Sy = function() {
    return !!e;
  })();
}
function PC(e, n) {
  if (n && (hr(n) == "object" || typeof n == "function")) return n;
  if (n !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
  return Aa(e);
}
function _C(e) {
  var n = Sy();
  return function() {
    var o, i = Ua(e);
    if (n) {
      var l = Ua(this).constructor;
      o = Reflect.construct(i, arguments, l);
    } else o = i.apply(this, arguments);
    return PC(this, o);
  };
}
var RC = /* @__PURE__ */ Vi(function e() {
  Hi(this, e);
}), wy = "CALC_UNIT", NC = new RegExp(wy, "g");
function lf(e) {
  return typeof e == "number" ? "".concat(e).concat(wy) : e;
}
var kC = /* @__PURE__ */ (function(e) {
  $C(o, e);
  var n = _C(o);
  function o(i, l) {
    var c;
    Hi(this, o), c = n.call(this), Pt(Aa(c), "result", ""), Pt(Aa(c), "unitlessCssVar", void 0), Pt(Aa(c), "lowPriority", void 0);
    var f = hr(i);
    return c.unitlessCssVar = l, i instanceof o ? c.result = "(".concat(i.result, ")") : f === "number" ? c.result = lf(i) : f === "string" && (c.result = i), c;
  }
  return Vi(o, [{
    key: "add",
    value: function(l) {
      return l instanceof o ? this.result = "".concat(this.result, " + ").concat(l.getResult()) : (typeof l == "number" || typeof l == "string") && (this.result = "".concat(this.result, " + ").concat(lf(l))), this.lowPriority = !0, this;
    }
  }, {
    key: "sub",
    value: function(l) {
      return l instanceof o ? this.result = "".concat(this.result, " - ").concat(l.getResult()) : (typeof l == "number" || typeof l == "string") && (this.result = "".concat(this.result, " - ").concat(lf(l))), this.lowPriority = !0, this;
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
      return typeof p == "boolean" ? g = p : Array.from(this.unitlessCssVar).some(function(m) {
        return c.result.includes(m);
      }) && (g = !1), this.result = this.result.replace(NC, g ? "px" : ""), typeof this.lowPriority < "u" ? "calc(".concat(this.result, ")") : this.result;
    }
  }]), o;
})(RC), TC = function(n, o) {
  var i = kC;
  return function(l) {
    return new i(l, o);
  };
}, lg = function(n, o) {
  return "".concat([o, n.replace(/([A-Z]+)([A-Z][a-z]+)/g, "$1-$2").replace(/([a-z])([A-Z])/g, "$1-$2")].filter(Boolean).join("-"));
};
function ag(e, n, o, i) {
  var l = bn({}, n[e]);
  if (i != null && i.deprecatedTokens) {
    var c = i.deprecatedTokens;
    c.forEach(function(p) {
      var g = Wa(p, 2), m = g[0], y = g[1];
      if (l != null && l[m] || l != null && l[y]) {
        var v;
        (v = l[y]) !== null && v !== void 0 || (l[y] = l?.[m]);
      }
    });
  }
  var f = bn(bn({}, o), l);
  return Object.keys(f).forEach(function(p) {
    f[p] === n[p] && delete f[p];
  }), f;
}
var Cy = typeof CSSINJS_STATISTIC < "u", Lf = !0;
function tr() {
  for (var e = arguments.length, n = new Array(e), o = 0; o < e; o++)
    n[o] = arguments[o];
  if (!Cy)
    return Object.assign.apply(Object, [{}].concat(n));
  Lf = !1;
  var i = {};
  return n.forEach(function(l) {
    if (hr(l) === "object") {
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
  }), Lf = !0, i;
}
var cg = {};
function MC() {
}
var IC = function(n) {
  var o, i = n, l = MC;
  return Cy && typeof Proxy < "u" && (o = /* @__PURE__ */ new Set(), i = new Proxy(n, {
    get: function(f, p) {
      if (Lf) {
        var g;
        (g = o) === null || g === void 0 || g.add(p);
      }
      return f[p];
    }
  }), l = function(f, p) {
    var g;
    cg[f] = {
      global: Array.from(o),
      component: bn(bn({}, (g = cg[f]) === null || g === void 0 ? void 0 : g.component), p)
    };
  }), {
    token: i,
    keys: o,
    flush: l
  };
};
function ug(e, n, o) {
  if (typeof o == "function") {
    var i;
    return o(tr(n, (i = n[e]) !== null && i !== void 0 ? i : {}));
  }
  return o ?? {};
}
function FC(e) {
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
var OC = 1e3 * 60 * 10, zC = /* @__PURE__ */ (function() {
  function e() {
    Hi(this, e), Pt(this, "map", /* @__PURE__ */ new Map()), Pt(this, "objectIDMap", /* @__PURE__ */ new WeakMap()), Pt(this, "nextID", 0), Pt(this, "lastAccessBeat", /* @__PURE__ */ new Map()), Pt(this, "accessBeat", 0);
  }
  return Vi(e, [{
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
        return c && hr(c) === "object" ? "obj_".concat(i.getObjectID(c)) : "".concat(hr(c), "_").concat(c);
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
          i - l > OC && (o.map.delete(c), o.lastAccessBeat.delete(c));
        }), this.accessBeat = 0;
      }
    }
  }]), e;
})(), fg = new zC();
function AC(e, n) {
  return ye.useMemo(function() {
    var o = fg.get(n);
    if (o)
      return o;
    var i = e();
    return fg.set(n, i), i;
  }, n);
}
var LC = function() {
  return {};
};
function BC(e) {
  var n = e.useCSP, o = n === void 0 ? LC : n, i = e.useToken, l = e.usePrefix, c = e.getResetStyles, f = e.getCommonStyle, p = e.getCompUnitless;
  function g(w, x, b, C) {
    var E = Array.isArray(w) ? w[0] : w;
    function P(z) {
      return "".concat(String(E)).concat(z.slice(0, 1).toUpperCase()).concat(z.slice(1));
    }
    var N = C?.unitless || {}, _ = typeof p == "function" ? p(w) : {}, R = bn(bn({}, _), {}, Pt({}, P("zIndexPopup"), !0));
    Object.keys(N).forEach(function(z) {
      R[P(z)] = N[z];
    });
    var M = bn(bn({}, C), {}, {
      unitless: R,
      prefixToken: P
    }), F = y(w, x, b, M), O = m(E, b, M);
    return function(z) {
      var H = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : z, Y = F(z, H), V = C?.extraCssVarPrefixCls, X = typeof V == "function" ? V({
        prefixCls: z,
        rootCls: H
      }) : V, Q = O(X != null && X.length ? [H].concat(el(X)) : H);
      return [Y, Q];
    };
  }
  function m(w, x, b) {
    var C = b.unitless, E = b.prefixToken, P = b.ignore;
    return function(N) {
      var _ = i(), R = _.cssVar, M = _.realToken, F = o();
      return Rw({
        path: [w],
        prefix: R.prefix,
        key: R.key,
        unitless: C,
        ignore: P,
        token: M,
        scope: N,
        nonce: function() {
          return F.nonce;
        }
      }, function() {
        var O = ug(w, M, x), z = ag(w, M, O, {
          deprecatedTokens: b?.deprecatedTokens
        });
        return O && Object.keys(O).forEach(function(H) {
          z[E(H)] = z[H], delete z[H];
        }), z;
      }), R?.key;
    };
  }
  function y(w, x, b) {
    var C = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {}, E = Array.isArray(w) ? w : [w, w], P = Wa(E, 1), N = P[0], _ = E.join("-"), R = e.layer || {
      name: "antd"
    };
    return function(M) {
      var F = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : M, O = i(), z = O.theme, H = O.realToken, Y = O.hashId, V = O.token, X = O.cssVar, Q = O.zeroRuntime, oe = h.useMemo(function() {
        return Q;
      }, []);
      if (oe)
        return Y;
      var G = l(), le = G.rootPrefixCls, he = G.iconPrefixCls, j = o(), J = "css", U = AC(function() {
        var se = /* @__PURE__ */ new Set();
        return Object.keys(C.unitless || {}).forEach(function(re) {
          se.add(Fa(re, X.prefix)), se.add(Fa(re, lg(N, X.prefix)));
        }), TC(J, se);
      }, [J, N, X?.prefix]), k = FC(), A = k.max, ee = k.min, te = {
        theme: z,
        token: V,
        hashId: Y,
        nonce: function() {
          return j.nonce;
        },
        clientOnly: C.clientOnly,
        layer: R,
        // antd is always at top of styles
        order: C.order || -999
      };
      return typeof c == "function" && Mf(bn(bn({}, te), {}, {
        clientOnly: !1,
        path: ["Shared", le]
      }), function() {
        return c(V, {
          prefix: {
            rootPrefixCls: le,
            iconPrefixCls: he
          },
          csp: j
        });
      }), Mf(bn(bn({}, te), {}, {
        path: [_, M, he]
      }), function() {
        if (C.injectStyle === !1)
          return [];
        var se = IC(V), re = se.token, fe = se.flush, ie = ug(N, H, b), Z = ".".concat(M), ae = ag(N, H, ie, {
          deprecatedTokens: C.deprecatedTokens
        });
        ie && hr(ie) === "object" && Object.keys(ie).forEach(function(Qe) {
          ie[Qe] = "var(".concat(Fa(Qe, lg(N, X.prefix)), ")");
        });
        var ce = tr(re, {
          componentCls: Z,
          prefixCls: M,
          iconCls: ".".concat(he),
          antCls: ".".concat(le),
          calc: U,
          max: A,
          min: ee
        }, ie), ke = x(ce, {
          hashId: Y,
          prefixCls: M,
          rootPrefixCls: le,
          iconPrefixCls: he
        });
        fe(N, ae);
        var qe = typeof f == "function" ? f(ce, M, F, C.resetFont) : null;
        return [C.resetStyle === !1 ? null : qe, ke];
      }), Y;
    };
  }
  function v(w, x, b) {
    var C = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {}, E = y(w, x, b, bn({
      resetStyle: !1,
      // Sub Style should default after root one
      order: -998
    }, C)), P = function(_) {
      var R = _.prefixCls, M = _.rootCls, F = M === void 0 ? R : M;
      return E(R, F), null;
    };
    return P;
  }
  return {
    genStyleHooks: g,
    genSubStyleComponent: v,
    genComponentStyleHook: y
  };
}
const Fi = ["blue", "purple", "cyan", "green", "magenta", "pink", "red", "orange", "yellow", "volcano", "geekblue", "lime", "gold"];
function DC(e) {
  return (e + 8) / e;
}
function jC(e) {
  const n = Array.from({
    length: 10
  }).map((o, i) => {
    const l = i - 1, c = e * Math.E ** (l / 5), f = i > 1 ? Math.floor(c) : Math.ceil(c);
    return Math.floor(f / 2) * 2;
  });
  return n[1] = e, n.map((o) => ({
    size: o,
    lineHeight: DC(o)
  }));
}
const HC = "6.5.4", Vd = {
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
}, Oi = {
  // preset color palettes
  ...Vd,
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
}, VC = {
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
function af(e, n) {
  const o = e.replace(/^[^(]*\((.*)/, "$1").replace(/\).*/, "").match(/\d*\.?\d+%?/g) || [], i = o.map((l) => parseFloat(l));
  for (let l = 0; l < 3; l += 1)
    i[l] = n(i[l] || 0, o[l] || "", l);
  return o[3] ? i[3] = o[3].includes("%") ? i[3] / 100 : i[3] : i[3] = 1, i;
}
const dg = (e, n, o) => o === 0 ? e : e / 100;
function _s(e, n) {
  const o = n || 255;
  return e > o ? o : e < 0 ? 0 : e;
}
class Ct {
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
        const c = VC[i.toLowerCase()];
        c && this.fromHexString(
          // Convert 36 hex to 16 hex
          parseInt(c, 36).toString(16).padStart(6, "0")
        );
      }
    } else if (n instanceof Ct)
      this.r = n.r, this.g = n.g, this.b = n.b, this.a = n.a, this._h = n._h, this._hsl_s = n._hsl_s, this._hsv_s = n._hsv_s, this._l = n._l, this._v = n._v;
    else if (o("rgb"))
      this.r = _s(n.r), this.g = _s(n.g), this.b = _s(n.b), this.a = typeof n.a == "number" ? _s(n.a, 1) : 1;
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
    return l[n] = _s(o, i), l;
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
    const m = c / 60, y = (1 - Math.abs(2 * i - 1)) * o, v = y * (1 - Math.abs(m % 2 - 1));
    m >= 0 && m < 1 ? (f = y, p = v) : m >= 1 && m < 2 ? (f = v, p = y) : m >= 2 && m < 3 ? (p = y, g = v) : m >= 3 && m < 4 ? (p = v, g = y) : m >= 4 && m < 5 ? (f = v, g = y) : m >= 5 && m < 6 && (f = y, g = v);
    const w = i - y / 2;
    this.r = Vt((f + w) * 255), this.g = Vt((p + w) * 255), this.b = Vt((g + w) * 255);
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
    const p = c / 60, g = Math.floor(p), m = p - g, y = Vt(i * (1 - o) * 255), v = Vt(i * (1 - o * m) * 255), w = Vt(i * (1 - o * (1 - m)) * 255);
    switch (g) {
      case 0:
        this.g = w, this.b = y;
        break;
      case 1:
        this.r = v, this.b = y;
        break;
      case 2:
        this.r = y, this.b = w;
        break;
      case 3:
        this.r = y, this.g = v;
        break;
      case 4:
        this.r = w, this.g = y;
        break;
      default:
        this.g = y, this.b = v;
        break;
    }
  }
  fromHsvString(n) {
    const o = af(n, dg);
    this.fromHsv({
      h: o[0],
      s: o[1],
      v: o[2],
      a: o[3]
    });
  }
  fromHslString(n) {
    const o = af(n, dg);
    this.fromHsl({
      h: o[0],
      s: o[1],
      l: o[2],
      a: o[3]
    });
  }
  fromRgbString(n) {
    const o = af(n, (i, l) => (
      // Convert percentage to number. e.g. 50% -> 128
      l.includes("%") ? Vt(i / 100 * 255) : i
    ));
    this.r = o[0], this.g = o[1], this.b = o[2], this.a = o[3];
  }
}
const ha = 2, pg = 0.16, WC = 0.05, UC = 0.05, qC = 0.15, xy = 5, by = 4, XC = [{
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
function hg(e, n, o) {
  let i;
  return Math.round(e.h) >= 60 && Math.round(e.h) <= 240 ? i = o ? Math.round(e.h) - ha * n : Math.round(e.h) + ha * n : i = o ? Math.round(e.h) + ha * n : Math.round(e.h) - ha * n, i < 0 ? i += 360 : i >= 360 && (i -= 360), i;
}
function mg(e, n, o) {
  if (e.h === 0 && e.s === 0)
    return e.s;
  let i;
  return o ? i = e.s - pg * n : n === by ? i = e.s + pg : i = e.s + WC * n, i > 1 && (i = 1), o && n === xy && i > 0.1 && (i = 0.1), i < 0.06 && (i = 0.06), Math.round(i * 100) / 100;
}
function gg(e, n, o) {
  let i;
  return o ? i = e.v + UC * n : i = e.v - qC * n, i = Math.max(0, Math.min(1, i)), Math.round(i * 100) / 100;
}
function ac(e, n = {}) {
  const o = [], i = new Ct(e), l = i.toHsv();
  for (let c = xy; c > 0; c -= 1) {
    const f = new Ct({
      h: hg(l, c, !0),
      s: mg(l, c, !0),
      v: gg(l, c, !0)
    });
    o.push(f);
  }
  o.push(i);
  for (let c = 1; c <= by; c += 1) {
    const f = new Ct({
      h: hg(l, c),
      s: mg(l, c),
      v: gg(l, c)
    });
    o.push(f);
  }
  return n.theme === "dark" ? XC.map(({
    index: c,
    amount: f
  }) => new Ct(n.backgroundColor || "#141414").mix(o[c], f).toHexString()) : o.map((c) => c.toHexString());
}
const ki = {
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
}, Bf = ["#fff1f0", "#ffccc7", "#ffa39e", "#ff7875", "#ff4d4f", "#f5222d", "#cf1322", "#a8071a", "#820014", "#5c0011"];
Bf.primary = Bf[5];
const Df = ["#fff2e8", "#ffd8bf", "#ffbb96", "#ff9c6e", "#ff7a45", "#fa541c", "#d4380d", "#ad2102", "#871400", "#610b00"];
Df.primary = Df[5];
const jf = ["#fff7e6", "#ffe7ba", "#ffd591", "#ffc069", "#ffa940", "#fa8c16", "#d46b08", "#ad4e00", "#873800", "#612500"];
jf.primary = jf[5];
const Hf = ["#fffbe6", "#fff1b8", "#ffe58f", "#ffd666", "#ffc53d", "#faad14", "#d48806", "#ad6800", "#874d00", "#613400"];
Hf.primary = Hf[5];
const Vf = ["#feffe6", "#ffffb8", "#fffb8f", "#fff566", "#ffec3d", "#fadb14", "#d4b106", "#ad8b00", "#876800", "#614700"];
Vf.primary = Vf[5];
const Wf = ["#fcffe6", "#f4ffb8", "#eaff8f", "#d3f261", "#bae637", "#a0d911", "#7cb305", "#5b8c00", "#3f6600", "#254000"];
Wf.primary = Wf[5];
const Uf = ["#f6ffed", "#d9f7be", "#b7eb8f", "#95de64", "#73d13d", "#52c41a", "#389e0d", "#237804", "#135200", "#092b00"];
Uf.primary = Uf[5];
const qf = ["#e6fffb", "#b5f5ec", "#87e8de", "#5cdbd3", "#36cfc9", "#13c2c2", "#08979c", "#006d75", "#00474f", "#002329"];
qf.primary = qf[5];
const Xf = ["#e6f4ff", "#bae0ff", "#91caff", "#69b1ff", "#4096ff", "#1677ff", "#0958d9", "#003eb3", "#002c8c", "#001d66"];
Xf.primary = Xf[5];
const Gf = ["#f0f5ff", "#d6e4ff", "#adc6ff", "#85a5ff", "#597ef7", "#2f54eb", "#1d39c4", "#10239e", "#061178", "#030852"];
Gf.primary = Gf[5];
const Yf = ["#f9f0ff", "#efdbff", "#d3adf7", "#b37feb", "#9254de", "#722ed1", "#531dab", "#391085", "#22075e", "#120338"];
Yf.primary = Yf[5];
const Kf = ["#fff0f6", "#ffd6e7", "#ffadd2", "#ff85c0", "#f759ab", "#eb2f96", "#c41d7f", "#9e1068", "#780650", "#520339"];
Kf.primary = Kf[5];
const Qf = ["#a6a6a6", "#999999", "#8c8c8c", "#808080", "#737373", "#666666", "#404040", "#1a1a1a", "#000000", "#000000"];
Qf.primary = Qf[5];
const cf = {
  red: Bf,
  volcano: Df,
  orange: jf,
  gold: Hf,
  yellow: Vf,
  lime: Wf,
  green: Uf,
  cyan: qf,
  blue: Xf,
  geekblue: Gf,
  purple: Yf,
  magenta: Kf,
  grey: Qf
};
function Ey(e, {
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
    colorTextBase: m
  } = e, y = n(p), v = n(i), w = n(l), x = n(c), b = n(f), C = o(g, m), E = e.colorLink || e.colorInfo, P = n(E), N = new Ct(x[1]).mix(new Ct(x[3]), 50).toHexString(), _ = {};
  return Fi.forEach((R) => {
    const M = e[R];
    if (M) {
      const F = n(M);
      _[`${R}Hover`] = F[5], _[`${R}Active`] = F[7];
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
    colorErrorBgFilledHover: N,
    colorErrorBgActive: x[3],
    colorErrorBorder: x[3],
    colorErrorBorderHover: x[4],
    colorErrorHover: x[5],
    colorError: x[6],
    colorErrorActive: x[7],
    colorErrorTextHover: x[8],
    colorErrorText: x[9],
    colorErrorTextActive: x[10],
    colorWarningBg: w[1],
    colorWarningBgHover: w[2],
    colorWarningBorder: w[3],
    colorWarningBorderHover: w[4],
    colorWarningHover: w[4],
    colorWarning: w[6],
    colorWarningActive: w[7],
    colorWarningTextHover: w[8],
    colorWarningText: w[9],
    colorWarningTextActive: w[10],
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
    colorLinkHover: P[4],
    colorLink: P[6],
    colorLinkActive: P[7],
    ..._,
    colorBgMask: new Ct("#000").setA(0.45).toRgbString(),
    colorWhite: "#fff"
  };
}
const GC = (e) => {
  let n = e, o = e, i = e, l = e;
  return e < 6 && e >= 5 ? n = e + 1 : e < 16 && e >= 6 ? n = e + 2 : e >= 16 && (n = 16), e < 7 && e >= 5 ? o = 4 : e < 8 && e >= 7 ? o = 5 : e < 14 && e >= 8 ? o = 6 : e < 16 && e >= 14 ? o = 7 : e >= 16 && (o = 8), e < 6 && e >= 2 ? i = 1 : e >= 6 && (i = 2), e > 4 && e < 8 ? l = 4 : e >= 8 && (l = 6), {
    borderRadius: e,
    borderRadiusXS: i,
    borderRadiusSM: o,
    borderRadiusLG: n,
    borderRadiusOuter: l
  };
};
function YC(e) {
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
    ...GC(i)
  };
}
const $y = (e) => {
  const {
    controlHeight: n
  } = e;
  return {
    controlHeightSM: n * 0.75,
    controlHeightXS: n * 0.5,
    controlHeightLG: n * 1.25
  };
}, Py = (e) => {
  const n = jC(e), o = n.map((y) => y.size), i = n.map((y) => y.lineHeight), l = o[1], c = o[0], f = o[2], p = i[1], g = i[0], m = i[2];
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
    lineHeightLG: m,
    lineHeightSM: g,
    fontHeight: Math.round(p * l),
    fontHeightLG: Math.round(m * f),
    fontHeightSM: Math.round(g * c),
    lineHeightHeading1: i[6],
    lineHeightHeading2: i[5],
    lineHeightHeading3: i[4],
    lineHeightHeading4: i[3],
    lineHeightHeading5: i[2]
  };
};
function KC(e) {
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
const Xn = (e, n) => new Ct(e).setA(n).toRgbString(), bi = (e, n) => new Ct(e).darken(n).toHexString(), QC = (e) => {
  const n = ac(e);
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
}, ZC = (e, n, o) => {
  const i = e || "#fff", l = n || "#000";
  return {
    colorBgBase: i,
    colorTextBase: l,
    colorShadow: o || "#000",
    colorText: Xn(l, 0.88),
    colorTextSecondary: Xn(l, 0.65),
    colorTextTertiary: Xn(l, 0.45),
    colorTextQuaternary: Xn(l, 0.25),
    colorFill: Xn(l, 0.15),
    colorFillSecondary: Xn(l, 0.06),
    colorFillTertiary: Xn(l, 0.04),
    colorFillQuaternary: Xn(l, 0.02),
    colorBgSolid: Xn(l, 1),
    colorBgSolidHover: Xn(l, 0.75),
    colorBgSolidActive: Xn(l, 0.95),
    colorBgLayout: bi(i, 4),
    colorBgContainer: bi(i, 0),
    colorBgElevated: bi(i, 0),
    colorBgSpotlight: Xn(l, 0.85),
    colorBgBlur: "transparent",
    colorBorder: bi(i, 15),
    colorBorderDisabled: bi(i, 15),
    colorBorderSecondary: bi(i, 6)
  };
};
function cc(e) {
  ki.pink = ki.magenta, cf.pink = cf.magenta;
  const n = Object.keys(Vd).map((o) => {
    const i = e[o] === ki[o] ? cf[o] : ac(e[o]);
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
    ...Ey(e, {
      generateColorPalettes: QC,
      generateNeutralColorPalettes: ZC
    }),
    // Font
    ...Py(e.fontSize),
    // Size
    ...KC(e),
    // Height
    ...$y(e),
    // Others
    ...YC(e)
  };
}
const Wd = Ha(cc), tl = {
  token: Oi,
  override: {
    override: Oi
  },
  hashed: !0
}, Ud = /* @__PURE__ */ ye.createContext(tl);
function uf(e) {
  return e >= 0 && e <= 255;
}
function ma(e, n) {
  const {
    r: o,
    g: i,
    b: l,
    a: c
  } = new Ct(e).toRgb();
  if (c < 1)
    return e;
  const {
    r: f,
    g: p,
    b: g
  } = new Ct(n).toRgb();
  for (let m = 0.01; m <= 1; m += 0.01) {
    const y = Math.round((o - f * (1 - m)) / m), v = Math.round((i - p * (1 - m)) / m), w = Math.round((l - g * (1 - m)) / m);
    if (uf(y) && uf(v) && uf(w))
      return new Ct({
        r: y,
        g: v,
        b: w,
        a: Math.round(m * 100) / 100
      }).toRgbString();
  }
  return new Ct({
    r: o,
    g: i,
    b: l,
    a: 1
  }).toRgbString();
}
function _y(e) {
  const {
    override: n,
    ...o
  } = e, i = {
    ...n
  };
  Object.keys(Oi).forEach((E) => {
    delete i[E];
  });
  const l = {
    ...o,
    ...i
  }, c = new Ct(l.colorShadow), f = c.a, p = (E) => c.clone().setA(f * E).toRgbString(), g = 480, m = 576, y = 768, v = 992, w = 1200, x = 1600, b = 1920;
  return l.motion === !1 && (l.motionDurationFast = "0s", l.motionDurationMid = "0s", l.motionDurationSlow = "0s"), {
    ...l,
    // ============== Background ============== //
    colorFillContent: l.colorFillSecondary,
    colorFillContentHover: l.colorFill,
    colorFillAlter: l.colorFillQuaternary,
    colorBgContainerDisabled: l.colorFillTertiary,
    // ============== Split ============== //
    colorBorderBg: l.colorBgContainer,
    colorSplit: ma(l.colorBorderSecondary, l.colorBgContainer),
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
    colorErrorOutline: ma(l.colorErrorBg, l.colorBgContainer),
    colorWarningOutline: ma(l.colorWarningBg, l.colorBgContainer),
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
    controlOutline: ma(l.colorPrimaryBg, l.colorBgContainer),
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
    screenXSMax: m - 1,
    screenSM: m,
    screenSMMin: m,
    screenSMMax: y - 1,
    screenMD: y,
    screenMDMin: y,
    screenMDMax: v - 1,
    screenLG: v,
    screenLGMin: v,
    screenLGMax: w - 1,
    screenXL: w,
    screenXLMin: w,
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
const Ry = {
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
}, JC = {
  motionBase: !0,
  motionUnit: !0
}, ex = {
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
}, Ny = (e, n, o) => {
  const i = o.getDerivativeToken(e), {
    override: l,
    ...c
  } = n;
  let f = {
    ...i,
    override: l
  };
  return f = _y(f), c && Object.entries(c).forEach(([p, g]) => {
    const {
      theme: m,
      ...y
    } = g;
    let v = y;
    m && (v = Ny({
      ...f,
      ...y
    }, {
      override: y
    }, m)), f[p] = v;
  }), f;
};
function Wi() {
  const {
    token: e,
    hashed: n,
    theme: o,
    override: i,
    cssVar: l,
    zeroRuntime: c
  } = ye.useContext(Ud), {
    csp: f,
    getPrefixCls: p
  } = ye.useContext(On), g = {
    prefix: l?.prefix ?? p(),
    key: l?.key ?? "css-var-root"
  }, m = `${HC}-${n || ""}`, y = o || Wd, [v, w, x] = nw(y, [Oi, e], {
    salt: m,
    override: i,
    getComputedToken: Ny,
    cssVar: {
      ...g,
      unitless: Ry,
      ignore: JC,
      preserve: ex
    },
    nonce: f?.nonce
  });
  return [y, x, n ? w : "", v, g, !!c];
}
const tx = {
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis"
}, Vr = (e, n = !1) => ({
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
}), ky = () => ({
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
}), nx = new sn("loadingCircle", {
  "100%": {
    transform: "rotate(360deg)"
  }
}), rx = () => ({
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
}), qd = (e, n) => ({
  outline: `${$e(e.lineWidthFocus)} solid ${e.colorPrimaryBorder}`,
  outlineOffset: 1,
  transition: ["outline-offset", "outline"].map((o) => `${o} 0s`).join(", ")
}), Ty = (e, n) => ({
  "&:focus-visible": qd(e)
}), ox = (e) => ({
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
    ...Ty(e),
    "&[disabled]": {
      color: e.colorTextDisabled,
      cursor: "not-allowed"
    }
  }
}), ix = (e, n, o, i) => {
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
}, My = (e) => ({
  [`.${e}`]: {
    ...ky(),
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
    animationName: nx,
    animationDuration: "1s",
    animationIterationCount: "infinite",
    animationTimingFunction: "linear"
  }
}), {
  genStyleHooks: Wr
} = BC({
  usePrefix: () => {
    const {
      getPrefixCls: e,
      iconPrefixCls: n
    } = h.useContext(On);
    return {
      rootPrefixCls: e(),
      iconPrefixCls: n
    };
  },
  useToken: () => {
    const [e, n, o, i, l, c] = Wi();
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
    } = h.useContext(On);
    return e ?? {};
  },
  getResetStyles: (e, n) => {
    const o = ox(e);
    return [o, {
      "&": o
    }, My(n?.prefix.iconPrefixCls ?? Hd)];
  },
  getCommonStyle: ix,
  getCompUnitless: () => Ry
}), sl = (e, n) => {
  const o = `--${e.replace(/\./g, "")}-${n}-`;
  return [(c) => `${o}${c}`, (c, f) => f ? `var(${o}${c}, ${f})` : `var(${o}${c})`];
};
function sx(e, n) {
  return Fi.reduce((o, i) => {
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
const lx = (e, n) => (Wi(), Mf({
  hashId: "",
  path: ["ant-design-icons", e],
  nonce: () => n?.nonce,
  layer: {
    name: "antd"
  }
}, () => My(e)));
var ga = {}, yg;
function ax() {
  if (yg) return ga;
  yg = 1, Object.defineProperty(ga, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm193.5 301.7l-210.6 292a31.8 31.8 0 01-51.7 0L318.5 484.9c-3.8-5.3 0-12.7 6.5-12.7h46.9c10.2 0 19.9 4.9 25.9 13.3l71.2 98.8 157.2-218c6-8.3 15.6-13.3 25.9-13.3H699c6.5 0 10.3 7.4 6.5 12.7z" } }] }, name: "check-circle", theme: "filled" };
  return ga.default = e, ga;
}
var cx = /* @__PURE__ */ ax();
const ux = /* @__PURE__ */ er(cx), Xd = /* @__PURE__ */ h.createContext({}), vg = "data-rc-order", Sg = "data-rc-priority", fx = "rc-util-key", Zf = /* @__PURE__ */ new Map();
function Iy() {
  return !!(typeof window < "u" && window.document && window.document.createElement);
}
function dx(e, n) {
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
function Fy({
  mark: e
} = {}) {
  return e ? e.startsWith("data-") ? e : `data-${e}` : fx;
}
function Gd(e) {
  return e.attachTo ? e.attachTo : document.querySelector("head") || document.body;
}
function px(e) {
  return e === "queue" ? "prependQueue" : e ? "prepend" : "append";
}
function Yd(e) {
  return Array.from((Zf.get(e) || e).children).filter((n) => n.tagName === "STYLE");
}
function Oy(e, n = {}) {
  if (!Iy())
    return null;
  const {
    csp: o,
    prepend: i,
    priority: l = 0
  } = n, c = px(i), f = c === "prependQueue", p = document.createElement("style");
  p.setAttribute(vg, c), f && l && p.setAttribute(Sg, `${l}`), o?.nonce && (p.nonce = o.nonce), p.innerHTML = e;
  const g = Gd(n), {
    firstChild: m
  } = g;
  if (i) {
    if (f) {
      const y = (n.styles || Yd(g)).filter((v) => {
        if (!["prepend", "prependQueue"].includes(v.getAttribute(vg)))
          return !1;
        const w = Number(v.getAttribute(Sg) || 0);
        return l >= w;
      });
      if (y.length)
        return g.insertBefore(p, y[y.length - 1].nextSibling), p;
    }
    g.insertBefore(p, m);
  } else
    g.appendChild(p);
  return p;
}
function hx(e, n = {}) {
  let {
    styles: o
  } = n;
  return o ||= Yd(Gd(n)), o.find((i) => i.getAttribute(Fy(n)) === e);
}
function mx(e, n) {
  const o = Zf.get(e);
  if (!o || !dx(document, o)) {
    const i = Oy("", n);
    if (!i)
      return;
    const {
      parentNode: l
    } = i;
    Zf.set(e, l), e.removeChild(i);
  }
}
function gx(e, n, o = {}) {
  if (!Iy())
    return null;
  const i = Gd(o), l = Yd(i), c = {
    ...o,
    styles: l
  };
  mx(i, c);
  const f = hx(n, c);
  if (f)
    return c.csp?.nonce && f.nonce !== c.csp.nonce && (f.nonce = c.csp.nonce), f.innerHTML !== e && (f.innerHTML = e), f;
  const p = Oy(e, c);
  return p?.setAttribute(Fy(c), n), p;
}
function yx(e) {
  return e?.getRootNode?.();
}
function vx(e) {
  const n = yx(e);
  return typeof ShadowRoot < "u" && n instanceof ShadowRoot ? n : null;
}
const wg = {};
function Sx(e, n) {
  e || wg[n] || (wg[n] = !0);
}
function wx(e) {
  return e.replace(/-(.)/g, (n, o) => o.toUpperCase());
}
function Cx(e, n) {
  Sx(e, `[@ant-design/icons] ${n}`);
}
function Cg(e) {
  return typeof e == "object" && typeof e.name == "string" && typeof e.theme == "string" && (typeof e.icon == "object" || typeof e.icon == "function");
}
function xg(e = {}) {
  return Object.keys(e).reduce((n, o) => {
    const i = e[o];
    return o === "class" ? (n.className = i, delete n.class) : (delete n[o], n[wx(o)] = i), n;
  }, {});
}
function Jf(e, n, o) {
  return o ? /* @__PURE__ */ ye.createElement(e.tag, {
    key: n,
    ...xg(e.attrs),
    ...o
  }, (e.children || []).map((i, l) => Jf(i, `${n}-${e.tag}-${l}`))) : /* @__PURE__ */ ye.createElement(e.tag, {
    key: n,
    ...xg(e.attrs)
  }, (e.children || []).map((i, l) => Jf(i, `${n}-${e.tag}-${l}`)));
}
const xx = `
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
`, bx = (e) => {
  const {
    csp: n,
    prefixCls: o,
    layer: i,
    zeroRuntime: l
  } = h.useContext(Xd);
  let c = xx;
  o && (c = c.replace(/anticon/g, o)), i && (c = `@layer ${i} {
${c}
}`), h.useEffect(() => {
    if (l)
      return;
    const f = e.current, p = vx(f);
    gx(c, "@ant-design-icons", {
      prepend: !i,
      csp: n,
      attachTo: p
    });
  }, []);
}, zy = (e) => {
  const {
    icon: n,
    className: o,
    onClick: i,
    style: l,
    primaryColor: c,
    secondaryColor: f,
    ...p
  } = e, g = h.useRef(null);
  if (bx(g), Cx(Cg(n), `icon should be icon definiton, but got ${n}`), !Cg(n))
    return null;
  const m = n;
  return Jf(m.icon, `svg-${m.name}`, {
    className: o,
    onClick: i,
    style: l,
    "data-icon": m.name,
    width: "1em",
    height: "1em",
    fill: "currentColor",
    "aria-hidden": "true",
    ...p,
    ref: g
  });
};
zy.displayName = "IconReact";
function ed() {
  return ed = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, ed.apply(this, arguments);
}
const Pr = /* @__PURE__ */ h.forwardRef((e, n) => {
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
    ...m
  } = e, {
    prefixCls: y = "anticon",
    rootClassName: v
  } = h.useContext(Xd), w = we(v, y, {
    [`${y}-${i.name}`]: !!i.name,
    [`${y}-spin`]: !!l || i.name === "loading"
  }, o);
  let x = f;
  x === void 0 && p && (x = -1);
  const b = c ? {
    msTransform: `rotate(${c}deg)`,
    transform: `rotate(${c}deg)`
  } : void 0;
  return /* @__PURE__ */ h.createElement("span", ed({
    role: "img",
    "aria-label": i.name
  }, m, {
    ref: n,
    tabIndex: x,
    onClick: p,
    className: w
  }), /* @__PURE__ */ h.createElement(zy, {
    icon: i,
    style: b
  }));
});
function td() {
  return td = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, td.apply(this, arguments);
}
const Ex = (e, n) => /* @__PURE__ */ h.createElement(Pr, td({}, e, {
  ref: n,
  icon: ux
})), $x = /* @__PURE__ */ h.forwardRef(Ex);
var ya = {}, bg;
function Px() {
  if (bg) return ya;
  bg = 1, Object.defineProperty(ya, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { "fill-rule": "evenodd", viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M512 64c247.4 0 448 200.6 448 448S759.4 960 512 960 64 759.4 64 512 264.6 64 512 64zm127.98 274.82h-.04l-.08.06L512 466.75 384.14 338.88c-.04-.05-.06-.06-.08-.06a.12.12 0 00-.07 0c-.03 0-.05.01-.09.05l-45.02 45.02a.2.2 0 00-.05.09.12.12 0 000 .07v.02a.27.27 0 00.06.06L466.75 512 338.88 639.86c-.05.04-.06.06-.06.08a.12.12 0 000 .07c0 .03.01.05.05.09l45.02 45.02a.2.2 0 00.09.05.12.12 0 00.07 0c.02 0 .04-.01.08-.05L512 557.25l127.86 127.87c.04.04.06.05.08.05a.12.12 0 00.07 0c.03 0 .05-.01.09-.05l45.02-45.02a.2.2 0 00.05-.09.12.12 0 000-.07v-.02a.27.27 0 00-.05-.06L557.25 512l127.87-127.86c.04-.04.05-.06.05-.08a.12.12 0 000-.07c0-.03-.01-.05-.05-.09l-45.02-45.02a.2.2 0 00-.09-.05.12.12 0 00-.07 0z" } }] }, name: "close-circle", theme: "filled" };
  return ya.default = e, ya;
}
var _x = /* @__PURE__ */ Px();
const Rx = /* @__PURE__ */ er(_x);
function nd() {
  return nd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, nd.apply(this, arguments);
}
const Nx = (e, n) => /* @__PURE__ */ h.createElement(Pr, nd({}, e, {
  ref: n,
  icon: Rx
})), kx = /* @__PURE__ */ h.forwardRef(Nx);
var va = {}, Eg;
function Tx() {
  if (Eg) return va;
  Eg = 1, Object.defineProperty(va, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { "fill-rule": "evenodd", viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M799.86 166.31c.02 0 .04.02.08.06l57.69 57.7c.04.03.05.05.06.08a.12.12 0 010 .06c0 .03-.02.05-.06.09L569.93 512l287.7 287.7c.04.04.05.06.06.09a.12.12 0 010 .07c0 .02-.02.04-.06.08l-57.7 57.69c-.03.04-.05.05-.07.06a.12.12 0 01-.07 0c-.03 0-.05-.02-.09-.06L512 569.93l-287.7 287.7c-.04.04-.06.05-.09.06a.12.12 0 01-.07 0c-.02 0-.04-.02-.08-.06l-57.69-57.7c-.04-.03-.05-.05-.06-.07a.12.12 0 010-.07c0-.03.02-.05.06-.09L454.07 512l-287.7-287.7c-.04-.04-.05-.06-.06-.09a.12.12 0 010-.07c0-.02.02-.04.06-.08l57.7-57.69c.03-.04.05-.05.07-.06a.12.12 0 01.07 0c.03 0 .05.02.09.06L512 454.07l287.7-287.7c.04-.04.06-.05.09-.06a.12.12 0 01.07 0z" } }] }, name: "close", theme: "outlined" };
  return va.default = e, va;
}
var Mx = /* @__PURE__ */ Tx();
const Ix = /* @__PURE__ */ er(Mx);
function rd() {
  return rd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, rd.apply(this, arguments);
}
const Fx = (e, n) => /* @__PURE__ */ h.createElement(Pr, rd({}, e, {
  ref: n,
  icon: Ix
})), Ox = /* @__PURE__ */ h.forwardRef(Fx), Ay = /* @__PURE__ */ h.createContext({}), zx = (e) => {
  const {
    children: n,
    ...o
  } = e, i = h.useMemo(() => ({
    motion: o.motion
  }), [o.motion]);
  return /* @__PURE__ */ h.createElement(Ay.Provider, {
    value: i
  }, n);
}, Er = "none", Sa = "appear", wa = "enter", Ca = "leave", $g = "none", dr = "prepare", Lo = "start", Bo = "active", Kd = "end", Ly = "prepared";
function Pg(e, n) {
  const o = {};
  return o[e.toLowerCase()] = n.toLowerCase(), o[`Webkit${e}`] = `webkit${n}`, o[`Moz${e}`] = `moz${n}`, o[`ms${e}`] = `MS${n}`, o[`O${e}`] = `o${n.toLowerCase()}`, o;
}
function Ax(e, n) {
  const o = {
    animationend: Pg("Animation", "AnimationEnd"),
    transitionend: Pg("Transition", "TransitionEnd")
  };
  return e && ("AnimationEvent" in n || delete o.animationend.animation, "TransitionEvent" in n || delete o.transitionend.transition), o;
}
const Lx = Ax(Zn(), typeof window < "u" ? window : {});
let By = {};
Zn() && ({
  style: By
} = document.createElement("div"));
const xa = {};
function Dy(e) {
  if (xa[e])
    return xa[e];
  const n = Lx[e];
  if (n) {
    const o = Object.keys(n), i = o.length;
    for (let l = 0; l < i; l += 1) {
      const c = o[l];
      if (Object.prototype.hasOwnProperty.call(n, c) && c in By)
        return xa[e] = n[c], xa[e];
    }
  }
  return "";
}
const jy = Dy("animationend"), Hy = Dy("transitionend"), Bx = !!(jy && Hy), _g = jy || "animationend", Rg = Hy || "transitionend";
function Ng(e, n) {
  if (!e) return null;
  if (typeof e == "object") {
    const o = n.replace(/-\w/g, (i) => i[1].toUpperCase());
    return e[o];
  }
  return `${e}-${n}`;
}
const Dx = ((e) => {
  const n = h.useRef();
  function o(l) {
    l && (l.removeEventListener(Rg, e), l.removeEventListener(_g, e));
  }
  function i(l) {
    n.current && n.current !== l && o(n.current), l && l !== n.current && (l.addEventListener(Rg, e), l.addEventListener(_g, e), n.current = l);
  }
  return h.useEffect(() => () => {
    o(n.current), n.current = null;
  }, []), [i, o];
}), Vy = Zn() ? h.useLayoutEffect : h.useEffect, jx = (() => {
  const e = h.useRef(null);
  function n() {
    vo.cancel(e.current);
  }
  function o(i, l = 2) {
    n();
    const c = vo(() => {
      l <= 1 ? i({
        isCanceled: () => c !== e.current
      }) : o(i, l - 1);
    });
    e.current = c;
  }
  return h.useEffect(() => () => {
    n();
  }, []), [o, n];
}), Hx = [dr, Lo, Bo, Kd], Vx = [dr, Ly], Wy = !1, Wx = !0;
function Uy(e) {
  return e === Bo || e === Kd;
}
const Ux = ((e, n, o) => {
  const [i, l] = Nw($g), [c, f] = jx();
  function p() {
    l(dr, !0);
  }
  const g = n ? Vx : Hx;
  return Vy(() => {
    if (i !== $g && i !== Kd) {
      const m = g.indexOf(i), y = g[m + 1], v = o(i);
      v === Wy ? l(y, !0) : y && c((w) => {
        function x() {
          w.isCanceled() || l(y, !0);
        }
        v === !0 ? x() : Promise.resolve(v).then(x);
      });
    }
  }, [e, i]), h.useEffect(() => () => {
    f();
  }, []), [p, i];
});
function qx(e, n, o, {
  motionEnter: i = !0,
  motionAppear: l = !0,
  motionLeave: c = !0,
  motionDeadline: f,
  motionLeaveImmediately: p,
  onAppearPrepare: g,
  onEnterPrepare: m,
  onLeavePrepare: y,
  onAppearStart: v,
  onEnterStart: w,
  onLeaveStart: x,
  onAppearActive: b,
  onEnterActive: C,
  onLeaveActive: E,
  onAppearEnd: P,
  onEnterEnd: N,
  onLeaveEnd: _,
  onVisibleChanged: R
}) {
  const [M, F] = h.useState(), [O, z] = Tw(Er), [H, Y] = h.useState([null, null]), V = O(), X = h.useRef(!1), Q = h.useRef(null);
  function oe() {
    return o();
  }
  const G = h.useRef(!1);
  function le() {
    z(Er), Y([null, null]);
  }
  const he = wt((ie) => {
    const Z = O();
    if (Z === Er)
      return;
    const ae = oe();
    if (ie && !ie.deadline && ie.target !== ae)
      return;
    const ce = G.current;
    let ke;
    Z === Sa && ce ? ke = P?.(ae, ie) : Z === wa && ce ? ke = N?.(ae, ie) : Z === Ca && ce && (ke = _?.(ae, ie)), ce && ke !== !1 && le();
  }), [j] = Dx(he), J = (ie) => {
    switch (ie) {
      case Sa:
        return {
          [dr]: g,
          [Lo]: v,
          [Bo]: b
        };
      case wa:
        return {
          [dr]: m,
          [Lo]: w,
          [Bo]: C
        };
      case Ca:
        return {
          [dr]: y,
          [Lo]: x,
          [Bo]: E
        };
      default:
        return {};
    }
  }, U = h.useMemo(() => J(V), [V]), [k, A] = Ux(V, !e, (ie) => {
    if (ie === dr) {
      const Z = U[dr];
      return Z ? Z(oe()) : Wy;
    }
    return ie in U && Y([U[ie]?.(oe(), null) || null, ie]), ie === Bo && V !== Er && (j(oe()), f > 0 && (clearTimeout(Q.current), Q.current = setTimeout(() => {
      he({
        deadline: !0
      });
    }, f))), ie === Ly && le(), Wx;
  }), ee = Uy(A);
  G.current = ee;
  const te = h.useRef(null);
  Vy(() => {
    if (X.current && te.current === n)
      return;
    F(n);
    const ie = X.current;
    X.current = !0;
    let Z;
    !ie && n && l && (Z = Sa), ie && n && i && (Z = wa), (ie && !n && c || !ie && p && !n && c) && (Z = Ca);
    const ae = J(Z);
    Z && (e || ae[dr]) ? (z(Z), k()) : z(Er), te.current = n;
  }, [n]), h.useEffect(() => {
    // Cancel appear
    (V === Sa && !l || // Cancel enter
    V === wa && !i || // Cancel leave
    V === Ca && !c) && z(Er);
  }, [l, i, c]), h.useEffect(() => () => {
    X.current = !1, clearTimeout(Q.current);
  }, []);
  const se = h.useRef(!1);
  h.useEffect(() => {
    M && (se.current = !0), M !== void 0 && V === Er && ((se.current || M) && R?.(M), se.current = !0);
  }, [M, V]);
  let re = H[0];
  U[dr] && A === Lo && (re = {
    transition: "none",
    ...re
  });
  const fe = H[1];
  return [
    O,
    A,
    re,
    M ?? n,
    // Appear Check
    !X.current && V === Er && e && l ? "NONE" : (
      // Enter or Leave check
      A === Lo || A === Bo ? fe === A : !0
    )
  ];
}
function Xx(e) {
  return e?.length < 2;
}
function Gx(e) {
  let n = e;
  typeof e == "object" && ({
    transitionSupport: n
  } = e);
  function o(l, c) {
    return !!(l.motionName && n && c !== !1);
  }
  const i = /* @__PURE__ */ h.forwardRef((l, c) => {
    const {
      // Default config
      visible: f = !0,
      removeOnLeave: p = !0,
      forceRender: g,
      children: m,
      motionName: y,
      leavedClassName: v,
      eventProps: w
    } = l, {
      motion: x
    } = h.useContext(Ay), b = o(l, x), C = h.useRef();
    function E() {
      return jd(C.current);
    }
    const [P, N, _, R, M] = qx(b, f, E, l), F = P(), O = h.useRef(R);
    R && (O.current = !0);
    const z = h.useMemo(() => {
      const V = {};
      return Object.defineProperties(V, {
        nativeElement: {
          enumerable: !0,
          get: E
        },
        inMotion: {
          enumerable: !0,
          get: () => () => P() !== Er
        },
        enableMotion: {
          enumerable: !0,
          get: () => () => b
        }
      }), V;
    }, []);
    h.useImperativeHandle(c, () => z, []);
    const H = h.useRef(0);
    M && (H.current += 1);
    const Y = h.useMemo(() => {
      if (M === "NONE")
        return null;
      let V;
      const X = {
        ...w,
        visible: f
      };
      if (!m)
        V = null;
      else if (F === Er)
        R ? V = m({
          ...X
        }, C) : !p && O.current && v ? V = m({
          ...X,
          className: v
        }, C) : g || !p && !v ? V = m({
          ...X,
          style: {
            display: "none"
          }
        }, C) : V = null;
      else {
        let Q;
        N === dr ? Q = "prepare" : Uy(N) ? Q = "active" : N === Lo && (Q = "start");
        const oe = Ng(y, `${F}-${Q}`);
        V = m({
          ...X,
          className: we(Ng(y, F), {
            [oe]: oe && Q,
            [y]: typeof y == "string"
          }),
          style: _
        }, C);
      }
      return V;
    }, [H.current]);
    if (Xx(m) && Bw(Y)) {
      const V = sc(Y);
      if (V !== C)
        return /* @__PURE__ */ h.cloneElement(Y, {
          ref: il(V, C)
        });
    }
    return Y;
  });
  return i.displayName = "CSSMotion", i;
}
const ll = Gx(Bx), Yx = (e) => e != null, Kx = (e) => Yx(e) && e !== !1 && e !== "", ff = (e) => typeof e == "number" && !Number.isNaN(e), Qx = (e) => typeof e == "string", Ur = (e) => e !== null && typeof e == "object", Ui = (e) => typeof e == "function", qy = (e = {}, ...n) => n.filter((o) => !!o).reduce((o, i) => (Object.keys(i).forEach((l) => {
  const c = e[l], f = i[l];
  if (c)
    if (Ur(f))
      o[l] = qy(c, o[l], f);
    else {
      const {
        _default: p
      } = c;
      p && (o[l] = o[l] || {}, o[l][p] = we(o[l][p], f));
    }
  else
    o[l] = we(o[l], f);
}), o), {}), Zx = (e, ...n) => h.useMemo(() => qy.apply(void 0, [e].concat(n)), [e].concat(n)), Jx = (...e) => e.filter((n) => !!n).reduce((n, o = {}) => (Object.keys(o).forEach((i) => {
  n[i] = {
    ...n[i],
    ...o[i]
  };
}), n), {}), eb = (...e) => h.useMemo(() => Jx.apply(void 0, e), [].concat(e)), zi = (e) => h.useMemo(() => e ? {
  root: e
} : void 0, [e]), kg = (e, n) => Ui(e) ? e(n) : e, al = (e, n, o, i) => {
  const l = e.map((g) => g ? kg(g, o) : void 0), c = n.map((g) => g ? kg(g, o) : void 0), f = Zx.apply(void 0, [i].concat(el(l))), p = eb.apply(void 0, el(c));
  return h.useMemo(() => [f, p], [f, p, i]);
}, Qd = (e) => `${e}-css-var`, tb = /* @__PURE__ */ h.createContext(void 0), Tn = "${label} is not a valid ${type}", uc = {
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
        string: Tn,
        method: Tn,
        array: Tn,
        object: Tn,
        number: Tn,
        date: Tn,
        boolean: Tn,
        integer: Tn,
        float: Tn,
        regexp: Tn,
        email: Tn,
        url: Tn,
        hex: Tn
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
  ...uc.Modal
});
let La = [];
const Tg = () => La.reduce((e, n) => ({
  ...e,
  ...n
}), uc.Modal);
function nb(e) {
  if (e) {
    const n = {
      ...e
    };
    return La.push(n), Tg(), () => {
      La = La.filter((o) => o !== n), Tg();
    };
  }
  ({
    ...uc.Modal
  });
}
const Xy = /* @__PURE__ */ h.createContext(void 0), rb = "internalMark", ob = (e) => {
  const {
    locale: n = {},
    children: o,
    _ANT_MARK__: i
  } = e;
  h.useEffect(() => nb(n?.Modal), [n]);
  const l = h.useMemo(() => ({
    ...n,
    exist: !0
  }), [n]);
  return /* @__PURE__ */ h.createElement(Xy.Provider, {
    value: l
  }, o);
}, Gy = /* @__PURE__ */ h.createContext(null);
let ib = !1;
function sb(e) {
  return ib;
}
const Mg = [];
function lb(e, n) {
  const [o] = h.useState(() => Zn() ? document.createElement("div") : null), i = h.useRef(!1), l = h.useContext(Gy), [c, f] = h.useState(Mg), p = l || (i.current ? void 0 : (y) => {
    f((v) => [y, ...v]);
  });
  function g() {
    o.parentElement || document.body.appendChild(o), i.current = !0;
  }
  function m() {
    o.parentElement?.removeChild(o), i.current = !1;
  }
  return un(() => (e ? l ? l(g) : g() : m(), m), [e]), un(() => {
    c.length && (c.forEach((y) => y()), f(Mg));
  }, [c]), [o, p];
}
function ab() {
  return document.body.scrollHeight > (window.innerHeight || document.documentElement.clientHeight) && window.innerWidth > document.body.offsetWidth;
}
const cb = `rc-util-locker-${Date.now()}`;
let Ig = 0;
function ub(e) {
  const n = !!e, [o] = h.useState(() => (Ig += 1, `${cb}_${Ig}`));
  un(() => {
    if (n) {
      const i = Ww(document.body).width, l = ab();
      Vo(`
html body {
  overflow-y: hidden;
  ${l ? `width: calc(100% - ${i}px);` : ""}
}`, o);
    } else
      Gs(o);
    return () => {
      Gs(o);
    };
  }, [n, o]);
}
let jo = [];
const fb = 200;
let Yy = 0;
const Ky = (e) => {
  if (e.key === "Escape" && !e.isComposing) {
    if (Date.now() - Yy < fb)
      return;
    const o = jo.length;
    for (let i = o - 1; i >= 0; i -= 1)
      jo[i].onEsc({
        top: i === o - 1,
        event: e
      });
  }
}, Qy = () => {
  Yy = Date.now();
};
function db() {
  window.addEventListener("keydown", Ky), window.addEventListener("compositionend", Qy);
}
function pb() {
  jo.length === 0 && (window.removeEventListener("keydown", Ky), window.removeEventListener("compositionend", Qy));
}
function hb(e, n) {
  const o = ol(), i = wt(n), l = () => {
    jo.find((f) => f.id === o) || jo.push({
      id: o,
      onEsc: i
    });
  }, c = () => {
    jo = jo.filter((f) => f.id !== o);
  };
  h.useMemo(() => {
    e ? l() : e || c();
  }, [e]), h.useEffect(() => {
    if (e)
      return l(), db(), () => {
        c(), pb();
      };
  }, [e]);
}
const Fg = (e) => e === !1 ? !1 : !Zn() || !e ? null : typeof e == "string" ? document.querySelector(e) : typeof e == "function" ? e() : e, Zd = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    open: o,
    autoLock: i,
    getContainer: l,
    debug: c,
    autoDestroy: f = !0,
    children: p,
    onEsc: g
  } = e, [m, y] = h.useState(o), v = m || o;
  h.useEffect(() => {
    (f || o) && y(o);
  }, [o, f]);
  const [w, x] = h.useState(() => Fg(l));
  h.useEffect(() => {
    const M = Fg(l);
    x(() => (
      // React do the state update even the value is the same,
      // Use function call to force React to compare update
      M ?? null
    ));
  });
  const [b, C] = lb(v && !w), E = w ?? b;
  ub(i && o && Zn() && (E === b || E === document.body)), hb(o, g);
  let P = null;
  p && Bd(p) && n && (P = sc(p));
  const N = Ld(P, n);
  if (!v || !Zn() || w === void 0)
    return null;
  const _ = E === !1 || sb();
  let R = p;
  return n && (R = /* @__PURE__ */ h.cloneElement(p, {
    ref: N
  })), /* @__PURE__ */ h.createElement(Gy.Provider, {
    value: C
  }, _ ? R : /* @__PURE__ */ lc.createPortal(R, E));
});
function mb(e) {
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
    y: m = 0
  } = l, y = h.useRef(null);
  if (!o || !o.points)
    return null;
  const v = {
    position: "absolute"
  };
  if (o.autoArrow !== !1) {
    const w = o.points[0], x = o.points[1], b = w[0], C = w[1], E = x[0], P = x[1];
    b === E || !["t", "b"].includes(b) ? v.top = m : b === "t" ? v.top = 0 : v.bottom = 0, C === P || !["l", "r"].includes(C) ? v.left = g : C === "l" ? v.left = 0 : v.right = 0;
  }
  return /* @__PURE__ */ h.createElement("div", {
    ref: y,
    className: we(`${n}-arrow`, c),
    style: {
      ...v,
      ...p
    }
  }, f);
}
function od() {
  return od = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, od.apply(this, arguments);
}
function gb(e) {
  const {
    prefixCls: n,
    open: o,
    zIndex: i,
    mask: l,
    motion: c,
    mobile: f
  } = e;
  return l ? /* @__PURE__ */ h.createElement(ll, od({}, c, {
    motionAppear: !0,
    visible: o,
    removeOnLeave: !0
  }), ({
    className: p
  }) => /* @__PURE__ */ h.createElement("div", {
    style: {
      zIndex: i
    },
    className: we(`${n}-mask`, f && `${n}-mobile-mask`, p)
  })) : null;
}
const yb = /* @__PURE__ */ h.memo(({
  children: e
}) => e, (e, n) => n.cache);
function Zy(e, n, o, i, l, c, f, p) {
  const g = "auto", m = e ? {} : {
    left: "-1000vw",
    top: "-1000vh",
    right: g,
    bottom: g
  };
  if (!e && (n || !o)) {
    const {
      points: y
    } = i, v = i.dynamicInset || i._experimental?.dynamicInset, w = v && y[0][1] === "r", x = v && y[0][0] === "b";
    w ? (m.right = l, m.left = g) : (m.left = f, m.right = g), x ? (m.bottom = c, m.top = g) : (m.top = p, m.bottom = g);
  }
  return m;
}
function id() {
  return id = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, id.apply(this, arguments);
}
const Jy = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    onEsc: o,
    popup: i,
    className: l,
    prefixCls: c,
    style: f,
    target: p,
    onVisibleChanged: g,
    // Open
    open: m,
    keepDom: y,
    fresh: v,
    // Click
    onClick: w,
    // Mask
    mask: x,
    // Arrow
    arrow: b,
    arrowPos: C,
    align: E,
    // Motion
    motion: P,
    maskMotion: N,
    // Mobile
    mobile: _,
    // Portal
    forceRender: R,
    getPopupContainer: M,
    autoDestroy: F,
    portal: O,
    children: z,
    zIndex: H,
    onMouseEnter: Y,
    onMouseLeave: V,
    onPointerEnter: X,
    onPointerDownCapture: Q,
    ready: oe,
    offsetX: G,
    offsetY: le,
    offsetR: he,
    offsetB: j,
    onAlign: J,
    onPrepare: U,
    // Resize
    onResize: k,
    stretch: A,
    targetWidth: ee,
    targetHeight: te
  } = e, se = typeof i == "function" ? i() : i, re = m || y, fe = !!_, [ie, Z, ae] = h.useMemo(() => _ ? [_.mask, _.maskMotion, _.motion] : [x, N, P], [_, x, N, P]), ce = M?.length > 0, [ke, qe] = h.useState(!M || !ce);
  un(() => {
    !ke && ce && p && qe(!0);
  }, [ke, ce, p]);
  const Qe = wt((ut, ze) => {
    k?.(ut, ze), J();
  }), Ne = Zy(fe, oe, m, E, he, j, G, le);
  if (!ke)
    return null;
  const Xe = {};
  return A && (A.includes("height") && te ? Xe.height = te : A.includes("minHeight") && te && (Xe.minHeight = te), A.includes("width") && ee ? Xe.width = ee : A.includes("minWidth") && ee && (Xe.minWidth = ee)), m || (Xe.pointerEvents = "none"), /* @__PURE__ */ h.createElement(O, {
    open: R || re,
    getContainer: M && (() => M(p)),
    autoDestroy: F,
    onEsc: o
  }, /* @__PURE__ */ h.createElement(gb, {
    prefixCls: c,
    open: m,
    zIndex: H,
    mask: ie,
    motion: Z,
    mobile: fe
  }), /* @__PURE__ */ h.createElement(my, {
    onResize: Qe,
    disabled: !m
  }, (ut) => /* @__PURE__ */ h.createElement(ll, id({
    motionAppear: !0,
    motionEnter: !0,
    motionLeave: !0,
    removeOnLeave: !1,
    forceRender: R,
    leavedClassName: `${c}-hidden`
  }, ae, {
    onAppearPrepare: U,
    onEnterPrepare: U,
    visible: m,
    onVisibleChanged: (ze) => {
      P?.onVisibleChanged?.(ze), g(ze);
    }
  }), ({
    className: ze,
    style: xt
  }, Ze) => {
    const tt = we(c, ze, l, {
      [`${c}-mobile`]: fe
    });
    return /* @__PURE__ */ h.createElement("div", {
      ref: il(ut, n, Ze),
      className: tt,
      style: {
        "--arrow-x": `${C.x || 0}px`,
        "--arrow-y": `${C.y || 0}px`,
        ...Ne,
        ...Xe,
        ...xt,
        boxSizing: "border-box",
        zIndex: H,
        ...f
      },
      onMouseEnter: Y,
      onMouseLeave: V,
      onPointerEnter: X,
      onClick: w,
      onPointerDownCapture: Q
    }, b && /* @__PURE__ */ h.createElement(mb, {
      prefixCls: c,
      arrow: b,
      arrowPos: C,
      align: E
    }), /* @__PURE__ */ h.createElement(yb, {
      cache: !m && !v
    }, se));
  })), z);
}), qa = /* @__PURE__ */ h.createContext(null), ev = /* @__PURE__ */ h.createContext(null);
function Og(e) {
  return e ? Array.isArray(e) ? e : [e] : [];
}
function vb(e, n, o) {
  return h.useMemo(() => {
    const i = Og(n ?? e), l = Og(o ?? e), c = new Set(i), f = new Set(l);
    return c.has("hover") && !c.has("click") && c.add("touch"), f.has("hover") && !f.has("click") && f.add("touch"), [c, f];
  }, [e, n, o]);
}
function Sb(e = [], n = [], o) {
  const i = (l, c) => l[c] || "";
  return o ? i(e, 0) === i(n, 0) : i(e, 0) === i(n, 0) && i(e, 1) === i(n, 1);
}
function tv(e, n, o, i) {
  const {
    points: l
  } = o, c = Object.keys(e);
  for (let f = 0; f < c.length; f += 1) {
    const p = c[f];
    if (Sb(e[p]?.points, l, i))
      return `${n}-placement-${p}`;
  }
  return "";
}
function cl(e) {
  return e.ownerDocument.defaultView;
}
function sd(e) {
  const n = [];
  let o = e?.parentElement;
  const i = ["hidden", "scroll", "clip", "auto"];
  for (; o; ) {
    const {
      overflowX: l,
      overflowY: c,
      overflow: f
    } = cl(o).getComputedStyle(o);
    [l, c, f].some((p) => i.includes(p)) && n.push(o), o = o.parentElement;
  }
  return n;
}
function nl(e, n = 1) {
  return Number.isNaN(e) ? n : e;
}
function Rs(e) {
  return nl(parseFloat(e), 0);
}
function zg(e, n) {
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
      borderRightWidth: m
    } = cl(i).getComputedStyle(i), y = i.getBoundingClientRect(), {
      offsetHeight: v,
      clientHeight: w,
      offsetWidth: x,
      clientWidth: b
    } = i, C = Rs(f), E = Rs(p), P = Rs(g), N = Rs(m), _ = nl(Math.round(y.width / x * 1e3) / 1e3), R = nl(Math.round(y.height / v * 1e3) / 1e3), M = (x - b - P - N) * _, F = (v - w - C - E) * R, O = C * R, z = E * R, H = P * _, Y = N * _;
    let V = 0, X = 0;
    if (l === "clip") {
      const he = Rs(c);
      V = he * _, X = he * R;
    }
    const Q = y.x + H - V, oe = y.y + O - X, G = Q + y.width + 2 * V - H - Y - M, le = oe + y.height + 2 * X - O - z - F;
    o.left = Math.max(o.left, Q), o.top = Math.max(o.top, oe), o.right = Math.min(o.right, G), o.bottom = Math.min(o.bottom, le);
  }), o;
}
function Ag(e, n = 0) {
  const o = `${n}`, i = o.match(/^(.*)\%$/);
  return i ? e * (parseFloat(i[1]) / 100) : parseFloat(o);
}
function Lg(e, n) {
  const [o, i] = n || [];
  return [Ag(e.width, o), Ag(e.height, i)];
}
function Bg(e = "") {
  return [e[0], e[1]];
}
function Ei(e, n) {
  const o = n[0], i = n[1];
  let l, c;
  return o === "t" ? c = e.y : o === "b" ? c = e.y + e.height : c = e.y + e.height / 2, i === "l" ? l = e.x : i === "r" ? l = e.x + e.width : l = e.x + e.width / 2, {
    x: l,
    y: c
  };
}
function ho(e, n) {
  const o = {
    t: "b",
    b: "t",
    l: "r",
    r: "l"
  }, i = [...e];
  return i[n] = o[e[n]] || "c", i;
}
function Dg(e) {
  return e.join("");
}
function nv(e, n, o, i, l, c, f, p) {
  const [g, m] = h.useState({
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
  }), y = h.useRef(0), v = h.useMemo(() => !n || p ? [] : sd(n), [n]), w = h.useRef({});
  e || (w.current = {});
  const b = wt(() => {
    if (n && o && e && !p) {
      let Ge = function(Re, et, Bt = Xe) {
        const wo = G.x + Re, Nr = G.y + et, kr = wo + se, Tr = Nr + te, yr = Math.max(wo, Bt.left), Co = Math.max(Nr, Bt.top), qi = Math.min(kr, Bt.right), Xi = Math.min(Tr, Bt.bottom);
        return Math.max(0, (qi - yr) * (Xi - Co));
      }, An = function() {
        Mt = G.y + Oe, zn = Mt + te, ln = G.x + Ae, mr = ln + se;
      };
      const P = n, N = P.ownerDocument, _ = cl(P), {
        position: R
      } = _.getComputedStyle(P), M = P.style.left, F = P.style.top, O = P.style.right, z = P.style.bottom, H = P.style.overflow, Y = P.style.overflowX, V = P.style.overflowY, X = {
        ...l[i],
        ...c
      }, Q = N.createElement("div");
      P.parentElement?.appendChild(Q), Q.style.left = `${P.offsetLeft}px`, Q.style.top = `${P.offsetTop}px`, Q.style.position = R, Q.style.height = `${P.offsetHeight}px`, Q.style.width = `${P.offsetWidth}px`, P.style.left = "0", P.style.top = "0", P.style.right = "auto", P.style.bottom = "auto", P.style.overflow = "hidden";
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
      const G = P.getBoundingClientRect(), {
        height: le,
        width: he
      } = _.getComputedStyle(P);
      G.x = G.x ?? G.left, G.y = G.y ?? G.top;
      const {
        clientWidth: j,
        clientHeight: J,
        scrollWidth: U,
        scrollHeight: k,
        scrollTop: A,
        scrollLeft: ee
      } = N.documentElement, te = G.height, se = G.width, re = oe.height, fe = oe.width, ie = {
        left: 0,
        top: 0,
        right: j,
        bottom: J
      }, Z = {
        left: -ee,
        top: -A,
        right: U - ee,
        bottom: k - A
      };
      let {
        htmlRegion: ae
      } = X;
      const ce = "visible", ke = "visibleFirst";
      ae !== "scroll" && ae !== ke && (ae = ce);
      const qe = ae === ke, Qe = zg(Z, v), Ne = zg(ie, v), Xe = ae === ce ? Ne : Qe, ut = qe ? Ne : Xe;
      P.style.left = "auto", P.style.top = "auto", P.style.right = "0", P.style.bottom = "0";
      const ze = P.getBoundingClientRect();
      P.style.left = M, P.style.top = F, P.style.right = O, P.style.bottom = z, P.style.overflow = H, P.style.overflowX = Y, P.style.overflowY = V, P.parentElement?.removeChild(Q);
      const xt = nl(Math.round(se / parseFloat(he) * 1e3) / 1e3), Ze = nl(Math.round(te / parseFloat(le) * 1e3) / 1e3);
      if (xt === 0 || Ze === 0 || Ii(o) && !Dw(o))
        return;
      const {
        offset: tt,
        targetOffset: He
      } = X;
      let [Je, ft] = Lg(G, tt);
      const [fn, Rt] = Lg(oe, He);
      oe.x -= fn, oe.y -= Rt;
      const [Wt, Ut] = X.points || [], Nt = Bg(Ut), mt = Bg(Wt), kt = Ei(oe, Nt), Ue = Ei(G, mt), Yt = {
        ...X
      };
      let Ve = [mt, Nt], Ae = kt.x - Ue.x + Je, Oe = kt.y - Ue.y + ft;
      const gt = Ge(Ae, Oe), qt = Ge(Ae, Oe, Ne), nt = Ei(oe, ["t", "l"]), Kt = Ei(G, ["t", "l"]), Tt = Ei(oe, ["b", "r"]), En = Ei(G, ["b", "r"]), $n = X.overflow || {}, {
        adjustX: de,
        adjustY: Ee,
        shiftX: Ce,
        shiftY: Et
      } = $n, Qt = (Re) => typeof Re == "boolean" ? Re : Re >= 0;
      let Mt, zn, ln, mr;
      An();
      const nr = Qt(Ee), Pn = mt[0] === Nt[0];
      if (nr && mt[0] === "t" && (zn > ut.bottom || w.current.bt)) {
        let Re = Oe;
        Pn ? Re -= te - re : Re = nt.y - En.y - ft;
        const et = Ge(Ae, Re), Bt = Ge(Ae, Re, Ne);
        // Of course use larger one
        et > gt || et === gt && (!qe || // Choose recommend one
        Bt >= qt) ? (w.current.bt = !0, Oe = Re, ft = -ft, Ve = [ho(Ve[0], 0), ho(Ve[1], 0)]) : w.current.bt = !1;
      }
      if (nr && mt[0] === "b" && (Mt < ut.top || w.current.tb)) {
        let Re = Oe;
        Pn ? Re += te - re : Re = Tt.y - Kt.y - ft;
        const et = Ge(Ae, Re), Bt = Ge(Ae, Re, Ne);
        // Of course use larger one
        et > gt || et === gt && (!qe || // Choose recommend one
        Bt >= qt) ? (w.current.tb = !0, Oe = Re, ft = -ft, Ve = [ho(Ve[0], 0), ho(Ve[1], 0)]) : w.current.tb = !1;
      }
      const rr = Qt(de), dn = mt[1] === Nt[1];
      if (rr && mt[1] === "l" && (mr > ut.right || w.current.rl)) {
        let Re = Ae;
        dn ? Re -= se - fe : Re = nt.x - En.x - Je;
        const et = Ge(Re, Oe), Bt = Ge(Re, Oe, Ne);
        // Of course use larger one
        et > gt || et === gt && (!qe || // Choose recommend one
        Bt >= qt) ? (w.current.rl = !0, Ae = Re, Je = -Je, Ve = [ho(Ve[0], 1), ho(Ve[1], 1)]) : w.current.rl = !1;
      }
      if (rr && mt[1] === "r" && (ln < ut.left || w.current.lr)) {
        let Re = Ae;
        dn ? Re += se - fe : Re = Tt.x - Kt.x - Je;
        const et = Ge(Re, Oe), Bt = Ge(Re, Oe, Ne);
        // Of course use larger one
        et > gt || et === gt && (!qe || // Choose recommend one
        Bt >= qt) ? (w.current.lr = !0, Ae = Re, Je = -Je, Ve = [ho(Ve[0], 1), ho(Ve[1], 1)]) : w.current.lr = !1;
      }
      Yt.points = [Dg(Ve[0]), Dg(Ve[1])], An();
      const Zt = Ce === !0 ? 0 : Ce;
      typeof Zt == "number" && (ln < Ne.left && (Ae -= ln - Ne.left - Je, oe.x + fe < Ne.left + Zt && (Ae += oe.x - Ne.left + fe - Zt)), mr > Ne.right && (Ae -= mr - Ne.right - Je, oe.x > Ne.right - Zt && (Ae += oe.x - Ne.right + Zt)));
      const It = Et === !0 ? 0 : Et;
      typeof It == "number" && (Mt < Ne.top && (Oe -= Mt - Ne.top - ft, oe.y + re < Ne.top + It && (Oe += oe.y - Ne.top + re - It)), zn > Ne.bottom && (Oe -= zn - Ne.bottom - ft, oe.y > Ne.bottom - It && (Oe += oe.y - Ne.bottom + It)));
      const yt = G.x + Ae, pn = yt + se, Lt = G.y + Oe, hn = Lt + te, qr = oe.x, rt = qr + fe, gr = oe.y, Xr = gr + re, dt = Math.max(yt, qr), Jt = Math.min(pn, rt), Ln = (dt + Jt) / 2 - yt, Bn = Math.max(Lt, gr), _r = Math.min(hn, Xr), Rr = (Bn + _r) / 2 - Lt;
      f?.(n, Yt);
      let Dn = ze.right - G.x - (Ae + G.width), mn = ze.bottom - G.y - (Oe + G.height);
      xt === 1 && (Ae = Math.floor(Ae), Dn = Math.floor(Dn)), Ze === 1 && (Oe = Math.floor(Oe), mn = Math.floor(mn));
      const at = {
        ready: !0,
        offsetX: Ae / xt,
        offsetY: Oe / Ze,
        offsetR: Dn / xt,
        offsetB: mn / Ze,
        arrowX: Ln / xt,
        arrowY: Rr / Ze,
        scaleX: xt,
        scaleY: Ze,
        align: Yt
      };
      m(at);
    }
  }), C = () => {
    y.current += 1;
    const P = y.current;
    Promise.resolve().then(() => {
      y.current === P && b();
    });
  }, E = () => {
    m((P) => ({
      ...P,
      ready: !1
    }));
  };
  return un(E, [i]), un(() => {
    e || E();
  }, [e]), [g.ready, g.offsetX, g.offsetY, g.offsetR, g.offsetB, g.arrowX, g.arrowY, g.scaleX, g.scaleY, g.align, C];
}
function rv() {
  const e = h.useRef(null), n = () => {
    e.current && (clearTimeout(e.current), e.current = null);
  }, o = (i, l) => {
    n(), l === 0 ? i() : e.current = setTimeout(() => {
      i();
    }, l * 1e3);
  };
  return h.useEffect(() => () => {
    n();
  }, []), o;
}
function wb(e, n, o, i, l) {
  un(() => {
    if (e && n && o) {
      let v = function() {
        i(), l();
      };
      const c = n, f = o, p = sd(c), g = sd(f), m = cl(f), y = /* @__PURE__ */ new Set([m, ...p, ...g]);
      return y.forEach((w) => {
        w.addEventListener("scroll", v, {
          passive: !0
        });
      }), m.addEventListener("resize", v, {
        passive: !0
      }), i(), () => {
        y.forEach((w) => {
          w.removeEventListener("scroll", v), m.removeEventListener("resize", v);
        });
      };
    }
  }, [e, n, o]);
}
function Cb(e, n, o, i, l, c, f, p) {
  const g = h.useRef(e);
  g.current = e;
  const m = h.useRef(!1);
  h.useEffect(() => {
    if (n && i && (!l || c)) {
      const v = () => {
        m.current = !1;
      }, w = (C) => {
        g.current && !f(C.composedPath?.()?.[0] || C.target) && !m.current && p(!1);
      }, x = cl(i);
      x.addEventListener("pointerdown", v, !0), x.addEventListener("mousedown", w, !0), x.addEventListener("contextmenu", w, !0);
      const b = If(o);
      return b && (b.addEventListener("mousedown", w, !0), b.addEventListener("contextmenu", w, !0)), () => {
        x.removeEventListener("pointerdown", v, !0), x.removeEventListener("mousedown", w, !0), x.removeEventListener("contextmenu", w, !0), b && (b.removeEventListener("mousedown", w, !0), b.removeEventListener("contextmenu", w, !0));
      };
    }
  }, [n, o, i, l, c]);
  function y() {
    m.current = !0;
  }
  return y;
}
function xb() {
  const [e, n] = ye.useState(null), [o, i] = ye.useState(!1), [l, c] = ye.useState(!1), f = ye.useRef(null), p = wt((m) => {
    m === !1 ? (f.current = null, i(!1)) : l && o ? f.current = m : (i(!0), n(m), f.current = null, o || c(!0));
  }), g = wt((m) => {
    m ? (c(!1), f.current && (n(f.current), f.current = null)) : (c(!1), f.current = null);
  });
  return [p, o, e, g];
}
function ld() {
  return ld = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, ld.apply(this, arguments);
}
const bb = (e) => {
  const {
    prefixCls: n,
    isMobile: o,
    ready: i,
    open: l,
    align: c,
    offsetR: f,
    offsetB: p,
    offsetX: g,
    offsetY: m,
    arrowPos: y,
    popupSize: v,
    motion: w,
    uniqueContainerClassName: x,
    uniqueContainerStyle: b
  } = e, C = `${n}-unique-container`, [E, P] = ye.useState(!1), N = Zy(o, i, l, c, f, p, g, m), _ = ye.useRef(N);
  i && (_.current = N);
  const R = {};
  return v && (R.width = v.width, R.height = v.height), /* @__PURE__ */ ye.createElement(ll, ld({
    motionAppear: !0,
    motionEnter: !0,
    motionLeave: !0,
    removeOnLeave: !1,
    leavedClassName: `${C}-hidden`
  }, w, {
    visible: l,
    onVisibleChanged: (M) => {
      P(M);
    }
  }), ({
    className: M,
    style: F
  }) => {
    const O = we(C, M, x, {
      [`${C}-visible`]: E
    });
    return /* @__PURE__ */ ye.createElement("div", {
      className: O,
      style: {
        "--arrow-x": `${y?.x || 0}px`,
        "--arrow-y": `${y?.y || 0}px`,
        ..._.current,
        ...R,
        ...F,
        ...b
      }
    });
  });
}, Eb = ({
  children: e,
  postTriggerProps: n
}) => {
  const [o, i, l, c] = xb(), f = h.useMemo(() => !l || !n ? l : n(l), [l, n]), [p, g] = h.useState(null), [m, y] = h.useState(null), v = h.useRef(null), w = wt((j) => {
    v.current = j, Ii(j) && p !== j && g(j);
  }), x = h.useRef(null), b = rv(), C = wt((j, J) => {
    x.current = J, b(() => {
      o(j);
    }, j.delay);
  }), E = (j) => {
    b(() => {
      x.current?.() || o(!1);
    }, j);
  }, P = wt((j) => {
    c(j);
  }), [
    N,
    _,
    R,
    M,
    F,
    O,
    z,
    // scaleX - not used in UniqueProvider
    ,
    ,
    // scaleY - not used in UniqueProvider
    H,
    Y
  ] = nv(
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
  ), V = h.useMemo(() => {
    if (!f)
      return "";
    const j = tv(
      f.builtinPlacements || {},
      f.prefixCls || "",
      H,
      !1
      // alignPoint is false for UniqueProvider
    );
    return we(j, f.getPopupClassNameFromAlign?.(H));
  }, [H, f?.getPopupClassNameFromAlign, f?.builtinPlacements, f?.prefixCls]), X = h.useMemo(() => ({
    show: C,
    hide: E
  }), []);
  h.useEffect(() => {
    Y();
  }, [f?.target]);
  const Q = wt(() => (Y(), Promise.resolve())), oe = h.useRef({}), G = h.useContext(qa), le = h.useMemo(() => ({
    registerSubPopup: (j, J) => {
      oe.current[j] = J, G?.registerSubPopup(j, J);
    }
  }), [G]), he = f?.prefixCls;
  return /* @__PURE__ */ h.createElement(ev.Provider, {
    value: X
  }, e, f && /* @__PURE__ */ h.createElement(qa.Provider, {
    value: le
  }, /* @__PURE__ */ h.createElement(Jy, {
    ref: w,
    portal: Zd,
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
    onVisibleChanged: P,
    ready: N,
    offsetX: _,
    offsetY: R,
    offsetR: M,
    offsetB: F,
    onAlign: Y,
    onPrepare: Q,
    onResize: (j) => y({
      width: j.offsetWidth,
      height: j.offsetHeight
    }),
    arrowPos: {
      x: O,
      y: z
    },
    align: H,
    zIndex: f.zIndex,
    mask: f.mask,
    arrow: f.arrow,
    motion: f.popupMotion,
    maskMotion: f.maskMotion,
    getPopupContainer: f.getPopupContainer
  }, /* @__PURE__ */ h.createElement(bb, {
    prefixCls: he,
    isMobile: !1,
    ready: N,
    open: i,
    align: H,
    offsetR: M,
    offsetB: F,
    offsetX: _,
    offsetY: R,
    arrowPos: {
      x: O,
      y: z
    },
    popupSize: m,
    motion: f.popupMotion,
    uniqueContainerClassName: we(f.uniqueContainerClassName, V),
    uniqueContainerStyle: f.uniqueContainerStyle
  }))));
};
function $b(e = Zd) {
  return /* @__PURE__ */ h.forwardRef((o, i) => {
    const {
      prefixCls: l = "rc-trigger-popup",
      children: c,
      // Action
      action: f = "hover",
      showAction: p,
      hideAction: g,
      disabled: m = !1,
      // Open
      popupVisible: y,
      defaultPopupVisible: v,
      onOpenChange: w,
      afterOpenChange: x,
      onPopupVisibleChange: b,
      afterPopupVisibleChange: C,
      // Delay
      mouseEnterDelay: E,
      mouseLeaveDelay: P = 0.1,
      focusDelay: N,
      blurDelay: _,
      // Mask
      mask: R,
      maskClosable: M = !0,
      // Portal
      getPopupContainer: F,
      forceRender: O,
      autoDestroy: z,
      // Popup
      popup: H,
      popupClassName: Y,
      uniqueContainerClassName: V,
      uniqueContainerStyle: X,
      popupStyle: Q,
      popupPlacement: oe,
      builtinPlacements: G = {},
      popupAlign: le,
      zIndex: he,
      stretch: j,
      getPopupClassNameFromAlign: J,
      fresh: U,
      unique: k,
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
    } = o, ae = z || !1, ce = y === void 0, ke = !!ie, qe = h.useRef({}), Qe = h.useContext(qa), Ne = h.useMemo(() => ({
      registerSubPopup: (ue, Fe) => {
        qe.current[ue] = Fe, Qe?.registerSubPopup(ue, Fe);
      }
    }), [Qe]), Xe = h.useContext(ev), ut = ol(), [ze, xt] = h.useState(null), Ze = h.useRef(null), tt = wt((ue) => {
      Ze.current = ue, Ii(ue) && ze !== ue && xt(ue), Qe?.registerSubPopup(ut, ue);
    }), [He, Je] = h.useState(null), ft = h.useRef(null), fn = wt((ue) => {
      const Fe = jd(ue);
      Ii(Fe) && He !== Fe && (Je(Fe), ft.current = Fe);
    }), Rt = {}, Wt = wt((ue) => {
      const Fe = He;
      return Fe?.contains(ue) || If(Fe)?.host === ue || ue === Fe || ze?.contains(ue) || If(ze)?.host === ue || ue === ze || Object.values(qe.current).some((vr) => vr?.contains(ue) || ue === vr);
    }), Ut = se ? {
      // true and Object likely
      ...se !== !0 ? se : {}
    } : null, [Nt, mt] = Zs(v || !1, y), kt = Nt || !1, Ue = kt && !m, Yt = h.useMemo(() => {
      const ue = typeof c == "function" ? c({
        open: Ue
      }) : c;
      return h.Children.only(ue);
    }, [c, Ue]), Ve = Yt?.props || {}, Ae = wt(() => Ue), Oe = wt((ue = 0) => ({
      popup: H,
      target: He,
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
      getPopupContainer: F,
      getPopupClassNameFromAlign: J,
      id: ut,
      onEsc: Kt
    }));
    un(() => {
      Xe && k && He && !ce && !Qe && (Ue ? Xe.show(Oe(E), Ae) : Xe.hide(P));
    }, [Ue, He]);
    const Ge = h.useRef(Ue);
    Ge.current = Ue;
    const gt = wt((ue) => {
      lc.flushSync(() => {
        kt !== ue && (mt(ue), w?.(ue), b?.(ue));
      });
    }), qt = rv(), nt = (ue, Fe = 0) => {
      if (y !== void 0) {
        qt(() => {
          gt(ue);
        }, Fe);
        return;
      }
      if (Xe && k && ce && !Qe) {
        ue ? Xe.show(Oe(Fe), Ae) : Xe.hide(Fe);
        return;
      }
      qt(() => {
        gt(ue);
      }, Fe);
    };
    function Kt({
      top: ue
    }) {
      ue && nt(!1);
    }
    const [Tt, En] = h.useState(!1);
    un((ue) => {
      (!ue || Ue) && En(!0);
    }, [Ue]);
    const [$n, de] = h.useState(null), [Ee, Ce] = h.useState(null), Et = (ue) => {
      Ce([ue.clientX, ue.clientY]);
    }, [Qt, Mt, zn, ln, mr, An, nr, Pn, rr, dn, Zt] = nv(Ue, ze, A && Ee !== null ? Ee : He, oe, G, le, te, ke), [It, yt] = vb(f, p, g), pn = It.has("click"), Lt = yt.has("click") || yt.has("contextMenu"), hn = wt(() => {
      Tt || Zt();
    });
    wb(Ue, He, ze, hn, () => {
      Ge.current && A && Lt && nt(!1);
    }), un(() => {
      hn();
    }, [Ee, oe]), un(() => {
      Ue && !G?.[oe] && hn();
    }, [JSON.stringify(le)]);
    const rt = h.useMemo(() => {
      const ue = tv(G, l, dn, A);
      return we(ue, J?.(dn));
    }, [dn, J, G, l, A]);
    h.useImperativeHandle(i, () => ({
      nativeElement: ft.current,
      popupElement: Ze.current,
      forceAlign: hn
    }));
    const [gr, Xr] = h.useState(0), [dt, Jt] = h.useState(0), Be = () => {
      if (j && He) {
        const ue = He.getBoundingClientRect();
        Xr(ue.width), Jt(ue.height);
      }
    }, Ln = () => {
      Be(), hn();
    }, Bn = (ue) => {
      En(!1), Zt(), x?.(ue), C?.(ue);
    }, _r = () => new Promise((ue) => {
      Be(), de(() => ue);
    });
    un(() => {
      $n && (Zt(), $n(), de(null));
    }, [$n]);
    function en(ue, Fe, vr, gc, Zo) {
      Rt[ue] = (De, ...fl) => {
        (!Zo || !Zo()) && (gc?.(De), nt(Fe, vr)), Ve[ue]?.(De, ...fl);
      };
    }
    const Rr = It.has("touch"), Dn = yt.has("touch"), mn = h.useRef(!1);
    (Rr || Dn) && (Rt.onTouchStart = (...ue) => {
      mn.current = !0, Ge.current && Dn ? nt(!1) : !Ge.current && Rr && nt(!0), Ve.onTouchStart?.(...ue);
    }), (pn || Lt) && (Rt.onClick = (ue, ...Fe) => {
      Ge.current && Lt ? nt(!1) : !Ge.current && pn && (Et(ue), nt(!0)), Ve.onClick?.(ue, ...Fe), mn.current = !1;
    });
    const at = Cb(Ue, Lt || Dn, He, ze, R, M, Wt, nt), Re = It.has("hover"), et = yt.has("hover");
    let Bt, wo;
    const Nr = () => mn.current;
    if (Re) {
      const ue = (Fe) => {
        Et(Fe);
      };
      en("onMouseEnter", !0, E, ue, Nr), en("onPointerEnter", !0, E, ue, Nr), Bt = (Fe) => {
        (Ue || Tt) && ze?.contains(Fe.target) && nt(!0, E);
      }, A && (Rt.onMouseMove = (Fe) => {
        Ve.onMouseMove?.(Fe);
      });
    }
    et && (en("onMouseLeave", !1, P, void 0, Nr), en("onPointerLeave", !1, P, void 0, Nr), wo = () => {
      nt(!1, P);
    }), It.has("focus") && en("onFocus", !0, N), yt.has("focus") && en("onBlur", !1, _), It.has("contextMenu") && (Rt.onContextMenu = (ue, ...Fe) => {
      Ge.current && yt.has("contextMenu") ? nt(!1) : (Et(ue), nt(!0)), ue.preventDefault(), Ve.onContextMenu?.(ue, ...Fe);
    });
    const kr = h.useRef(!1);
    kr.current ||= O || Ue || Tt;
    const Tr = {
      ...Ve,
      ...Rt
    }, yr = {};
    ["onContextMenu", "onClick", "onMouseDown", "onTouchStart", "onMouseEnter", "onMouseLeave", "onFocus", "onBlur"].forEach((ue) => {
      Z[ue] && (yr[ue] = (...Fe) => {
        Tr[ue]?.(...Fe), Z[ue](...Fe);
      });
    });
    const qi = {
      x: An,
      y: nr
    };
    hy(Ue, He, Ln);
    const Xi = Ld(fn, sc(Yt)), Gi = /* @__PURE__ */ h.cloneElement(Yt, {
      ...Tr,
      ...yr,
      ref: Xi
    });
    return /* @__PURE__ */ h.createElement(h.Fragment, null, Gi, kr.current && (!Xe || !k) && /* @__PURE__ */ h.createElement(qa.Provider, {
      value: Ne
    }, /* @__PURE__ */ h.createElement(Jy, {
      portal: e,
      ref: tt,
      prefixCls: l,
      popup: H,
      className: we(Y, !ke && rt),
      style: Q,
      target: He,
      onMouseEnter: Bt,
      onMouseLeave: wo,
      onPointerEnter: Bt,
      zIndex: he,
      open: Ue,
      keepDom: Tt,
      fresh: U,
      onClick: ee,
      onPointerDownCapture: at,
      mask: R,
      motion: re,
      maskMotion: fe,
      onVisibleChanged: Bn,
      onPrepare: _r,
      forceRender: O,
      autoDestroy: ae,
      getPopupContainer: F,
      onEsc: Kt,
      align: dn,
      arrow: Ut,
      arrowPos: qi,
      ready: Qt,
      offsetX: Mt,
      offsetY: zn,
      offsetR: ln,
      offsetB: mr,
      onAlign: hn,
      stretch: j,
      targetWidth: gr / Pn,
      targetHeight: dt / rr,
      mobile: ie
    })));
  });
}
const Pb = $b(Zd);
function _b(e) {
  return e && /* @__PURE__ */ ye.isValidElement(e) && e.type === ye.Fragment;
}
const Rb = (e, n, o) => /* @__PURE__ */ ye.isValidElement(e) ? /* @__PURE__ */ ye.cloneElement(e, Ui(o) ? o(e.props || {}) : o) : n;
function ov(e, n) {
  return Rb(e, e, n);
}
const Nb = ({
  children: e
}) => {
  const {
    getPrefixCls: n
  } = ye.useContext(On), o = n();
  return /* @__PURE__ */ ye.isValidElement(e) ? /* @__PURE__ */ ye.createElement(ll, {
    visible: !0,
    motionName: `${o}-fade`,
    motionAppear: !0,
    motionEnter: !0,
    motionLeave: !1,
    removeOnLeave: !1
  }, ({
    style: i,
    className: l
  }) => ov(e, (c) => ({
    className: we(c.className, l),
    style: {
      ...c.style,
      ...i
    }
  }))) : e;
}, ba = [null, null];
function kb(e) {
  if (ba[0] !== e) {
    const n = {};
    Object.keys(e).forEach((o) => {
      n[o] = {
        ...e[o],
        dynamicInset: !1
      };
    }), ba[0] = e, ba[1] = n;
  }
  return ba[1];
}
const iv = ({
  children: e
}) => {
  const n = (o) => {
    const {
      id: i,
      builtinPlacements: l,
      popup: c
    } = o, f = Ui(c) ? c() : c, p = kb(l);
    return {
      ...o,
      getPopupContainer: null,
      arrow: !1,
      popup: /* @__PURE__ */ ye.createElement(Nb, {
        key: i
      }, f),
      builtinPlacements: p
    };
  };
  return /* @__PURE__ */ ye.createElement(Eb, {
    postTriggerProps: n
  }, e);
}, rl = /* @__PURE__ */ h.createContext(!1), Tb = ({
  children: e,
  disabled: n
}) => {
  const o = h.useContext(rl);
  return /* @__PURE__ */ h.createElement(rl.Provider, {
    value: n ?? o
  }, e);
}, Ai = /* @__PURE__ */ h.createContext(void 0), Mb = ({
  children: e,
  size: n
}) => {
  const o = h.useContext(Ai);
  return /* @__PURE__ */ h.createElement(Ai.Provider, {
    value: n || o
  }, e);
};
function Ib() {
  const e = h.useContext(rl), n = h.useContext(Ai);
  return {
    componentDisabled: e,
    componentSize: n
  };
}
function Fb(e, n, o) {
  const i = e || {}, l = i.inherit === !1 || !n ? {
    ...tl,
    hashed: n?.hashed ?? tl.hashed,
    cssVar: n?.cssVar
  } : n, c = h.useId();
  return nc(() => {
    if (!e)
      return n;
    const f = {
      ...l.components
    };
    Object.keys(e.components || {}).forEach((m) => {
      f[m] = {
        ...f[m],
        ...e.components[m]
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
  }, [i, l, o?.prefixCls, c], (f, p) => f.some((g, m) => {
    const y = p[m];
    return !Ys(g, y, !0);
  }));
}
const jg = /* @__PURE__ */ h.createContext(!0);
function Ob(e) {
  const n = h.useContext(jg), {
    children: o
  } = e, [, i] = Wi(), {
    motion: l
  } = i, c = h.useRef(!1);
  return c.current || (c.current = n !== l), c.current ? /* @__PURE__ */ h.createElement(jg.Provider, {
    value: l
  }, /* @__PURE__ */ h.createElement(zx, {
    motion: l
  }, o)) : o;
}
const zb = () => null, Ab = ({
  iconPrefixCls: e,
  csp: n
}) => (lx(e, n), null), Lb = ["getTargetContainer", "getPopupContainer", "renderEmpty", "input", "pagination", "form", "select", "button"], Bb = (e) => {
  const {
    prefixCls: n,
    iconPrefixCls: o,
    theme: i,
    holderRender: l
  } = e;
}, Db = (e) => {
  const {
    children: n,
    csp: o,
    autoInsertSpaceInButton: i,
    alert: l,
    affix: c,
    anchor: f,
    app: p,
    form: g,
    locale: m,
    componentSize: y,
    direction: v,
    space: w,
    splitter: x,
    virtual: b,
    dropdownMatchSelectWidth: C,
    popupMatchSelectWidth: E,
    popupOverflow: P,
    legacyLocale: N,
    parentContext: _,
    iconPrefixCls: R,
    theme: M,
    componentDisabled: F,
    segmented: O,
    statistic: z,
    spin: H,
    calendar: Y,
    carousel: V,
    cascader: X,
    collapse: Q,
    typography: oe,
    checkbox: G,
    descriptions: le,
    divider: he,
    drawer: j,
    skeleton: J,
    steps: U,
    image: k,
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
    pagination: ke,
    input: qe,
    inputPassword: Qe,
    inputSearch: Ne,
    textArea: Xe,
    otp: ut,
    empty: ze,
    badge: xt,
    borderBeam: Ze,
    radio: tt,
    rate: He,
    ribbon: Je,
    switch: ft,
    transfer: fn,
    avatar: Rt,
    message: Wt,
    tag: Ut,
    table: Nt,
    card: mt,
    cardMeta: kt,
    tabs: Ue,
    timeline: Yt,
    timePicker: Ve,
    upload: Ae,
    notification: Oe,
    tree: Ge,
    colorPicker: gt,
    datePicker: qt,
    rangePicker: nt,
    flex: Kt,
    wave: Tt,
    dropdown: En,
    warning: $n,
    tour: de,
    tooltip: Ee,
    popover: Ce,
    popconfirm: Et,
    qrcode: Qt,
    floatButton: Mt,
    floatButtonGroup: zn,
    variant: ln,
    inputNumber: mr,
    treeSelect: An,
    watermark: nr
  } = e, Pn = h.useMemo(() => Ur(m) && Object.prototype.hasOwnProperty.call(m, "default") && m.default?.locale ? m.default : m, [m]), rr = h.useCallback((dt, Jt) => {
    const {
      prefixCls: Be
    } = e;
    if (Jt)
      return Jt;
    const Ln = Be || _.getPrefixCls("");
    return dt ? `${Ln}-${dt}` : Ln;
  }, [_.getPrefixCls, e.prefixCls]), dn = R || _.iconPrefixCls || Hd, Zt = o || _.csp, It = Fb(M, _.theme, {
    prefixCls: rr("")
  }), yt = {
    csp: Zt,
    autoInsertSpaceInButton: i,
    alert: l,
    affix: c,
    anchor: f,
    app: p,
    locale: Pn || N,
    direction: v,
    space: w,
    splitter: x,
    virtual: b,
    popupMatchSelectWidth: E ?? C,
    popupOverflow: P,
    getPrefixCls: rr,
    iconPrefixCls: dn,
    theme: It,
    segmented: O,
    statistic: z,
    spin: H,
    calendar: Y,
    carousel: V,
    cascader: X,
    collapse: Q,
    typography: oe,
    checkbox: G,
    descriptions: le,
    divider: he,
    drawer: j,
    skeleton: J,
    steps: U,
    image: k,
    input: qe,
    inputPassword: Qe,
    inputSearch: Ne,
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
    pagination: ke,
    empty: ze,
    badge: xt,
    borderBeam: Ze,
    radio: tt,
    rate: He,
    ribbon: Je,
    switch: ft,
    transfer: fn,
    avatar: Rt,
    message: Wt,
    tag: Ut,
    table: Nt,
    card: mt,
    cardMeta: kt,
    tabs: Ue,
    timeline: Yt,
    timePicker: Ve,
    upload: Ae,
    notification: Oe,
    tree: Ge,
    colorPicker: gt,
    datePicker: qt,
    rangePicker: nt,
    flex: Kt,
    wave: Tt,
    dropdown: En,
    warning: $n,
    tour: de,
    tooltip: Ee,
    popover: Ce,
    popconfirm: Et,
    qrcode: Qt,
    floatButton: Mt,
    floatButtonGroup: zn,
    variant: ln,
    inputNumber: mr,
    treeSelect: An,
    watermark: nr
  }, pn = {
    ..._
  };
  Object.keys(yt).forEach((dt) => {
    yt[dt] !== void 0 && (pn[dt] = yt[dt]);
  }), Lb.forEach((dt) => {
    const Jt = e[dt];
    Jt && (pn[dt] = Jt);
  }), typeof i < "u" && (pn.button = {
    autoInsertSpace: i,
    ...pn.button
  });
  const Lt = nc(() => pn, pn, (dt, Jt) => {
    const Be = Object.keys(dt), Ln = Object.keys(Jt);
    return Be.length !== Ln.length || Be.some((Bn) => dt[Bn] !== Jt[Bn]);
  }), {
    layer: hn
  } = h.useContext(Go), qr = h.useMemo(() => ({
    prefixCls: dn,
    csp: Zt,
    layer: hn ? "antd" : void 0,
    zeroRuntime: !!hn || It?.zeroRuntime
  }), [dn, Zt, hn, It?.zeroRuntime]);
  let rt = /* @__PURE__ */ h.createElement(h.Fragment, null, /* @__PURE__ */ h.createElement(Ab, {
    iconPrefixCls: dn,
    csp: Zt
  }), /* @__PURE__ */ h.createElement(zb, {
    dropdownMatchSelectWidth: C
  }), n);
  const gr = h.useMemo(() => Ni(uc.Form?.defaultValidateMessages || {}, Lt.locale?.Form?.defaultValidateMessages || {}, Lt.form?.validateMessages || {}, g?.validateMessages || {}), [Lt, g?.validateMessages]);
  Object.keys(gr).length > 0 && (rt = /* @__PURE__ */ h.createElement(tb.Provider, {
    value: gr
  }, rt)), Pn && (rt = /* @__PURE__ */ h.createElement(ob, {
    locale: Pn,
    _ANT_MARK__: rb
  }, rt)), rt = /* @__PURE__ */ h.createElement(Xd.Provider, {
    value: qr
  }, rt), y && (rt = /* @__PURE__ */ h.createElement(Mb, {
    size: y
  }, rt)), rt = /* @__PURE__ */ h.createElement(Ob, null, rt), Ee?.unique && (rt = /* @__PURE__ */ h.createElement(iv, null, rt));
  const Xr = h.useMemo(() => {
    const {
      algorithm: dt,
      token: Jt,
      components: Be,
      cssVar: Ln,
      ...Bn
    } = It || {}, _r = dt && (!Array.isArray(dt) || dt.length > 0) ? Ha(dt) : Wd, en = {};
    Object.entries(Be || {}).forEach(([Dn, mn]) => {
      const at = {
        ...mn
      };
      "algorithm" in at && (at.algorithm === !0 ? at.theme = _r : (Array.isArray(at.algorithm) || Ui(at.algorithm)) && (at.theme = Ha(at.algorithm)), delete at.algorithm), en[Dn] = at;
    });
    const Rr = {
      ...Oi,
      ...Jt
    };
    return {
      ...Bn,
      theme: _r,
      token: Rr,
      components: en,
      override: {
        override: Rr,
        ...en
      },
      cssVar: Ln
    };
  }, [It]);
  return M && (rt = /* @__PURE__ */ h.createElement(Ud.Provider, {
    value: Xr
  }, rt)), Lt.warning && (rt = /* @__PURE__ */ h.createElement(sC.Provider, {
    value: Lt.warning
  }, rt)), F !== void 0 && (rt = /* @__PURE__ */ h.createElement(Tb, {
    disabled: F
  }, rt)), /* @__PURE__ */ h.createElement(On.Provider, {
    value: Lt
  }, rt);
}, So = (e) => {
  const n = h.useContext(On), o = h.useContext(Xy);
  return /* @__PURE__ */ h.createElement(Db, {
    parentContext: n,
    legacyLocale: o,
    ...e
  });
};
So.ConfigContext = On;
So.SizeContext = Ai;
So.config = Bb;
So.useConfig = Ib;
Object.defineProperty(So, "SizeContext", {
  get: () => Ai
});
const Hg = (e) => e === "horizontal" || e === "vertical", sv = (e, n, o) => h.useMemo(() => {
  const i = Hg(e);
  let l;
  return i ? l = e : typeof n == "boolean" ? l = n ? "vertical" : "horizontal" : l = Hg(o) ? o : "horizontal", [l, l === "vertical"];
}, [o, e, n]), lv = /* @__PURE__ */ ye.createContext(void 0), Fo = 100, av = {
  Modal: Fo,
  Drawer: Fo,
  Popover: Fo,
  Popconfirm: Fo,
  Tooltip: Fo,
  Tour: Fo,
  FloatButton: Fo
}, jb = {
  SelectLike: 50,
  Dropdown: 50,
  DatePicker: 50,
  Menu: 50,
  ImagePreview: 1
}, Hb = (e) => e in av, Vb = (e, n) => {
  const [, o] = Wi(), i = ye.useContext(lv), l = Hb(e);
  let c;
  if (n !== void 0)
    c = [n, n];
  else {
    let f = i ?? 0;
    l ? f += // Use preset token zIndex by default but not stack when has parent container
    (i ? 0 : o.zIndexPopupBase) + // Container offset
    av[e] : f += jb[e], c = [i === void 0 ? n : f, f];
  }
  return c;
}, Wb = (e, n, o) => o !== void 0 ? o : `${e}-${n}`, fc = (e) => {
  const n = ye.useContext(Ai);
  return ye.useMemo(() => e ? Qx(e) ? e ?? n : Ui(e) ? e(n) : n : n, [e, n]);
}, Ub = (e) => {
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
}, qb = Wr(["Space", "Compact"], Ub, () => ({}), {
  // Space component don't apply extra font style
  // https://github.com/ant-design/ant-design/issues/40315
  resetStyle: !1
}), dc = /* @__PURE__ */ h.createContext(null), cv = (e, n) => {
  const o = h.useContext(dc), i = h.useMemo(() => {
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
}, Xb = (e) => {
  const {
    children: n
  } = e;
  return /* @__PURE__ */ h.createElement(dc.Provider, {
    value: null
  }, n);
}, Gb = (e) => {
  const {
    children: n,
    ...o
  } = e;
  return /* @__PURE__ */ h.createElement(dc.Provider, {
    value: h.useMemo(() => o, [o])
  }, n);
}, Yb = (e) => {
  const {
    getPrefixCls: n,
    direction: o
  } = h.useContext(On), {
    size: i,
    direction: l,
    orientation: c,
    block: f,
    prefixCls: p,
    className: g,
    rootClassName: m,
    children: y,
    vertical: v,
    ...w
  } = e, [x, b] = sv(c, v, l), C = fc((F) => i ?? F), E = n("space-compact", p), [P] = qb(E), N = we(E, P, {
    [`${E}-rtl`]: o === "rtl",
    [`${E}-block`]: f,
    [`${E}-vertical`]: b
  }, g, m), _ = h.useContext(dc), R = Js(y), M = h.useMemo(() => R.map((F, O) => {
    const z = F?.key || `${E}-item-${O}`;
    return /* @__PURE__ */ h.createElement(Gb, {
      key: z,
      compactSize: C,
      compactDirection: x,
      isFirstItem: O === 0 && (!_ || _?.isFirstItem),
      isLastItem: O === R.length - 1 && (!_ || _?.isLastItem)
    }, F);
  }), [R, _, x, C, E]);
  return R.length === 0 ? null : /* @__PURE__ */ h.createElement("div", {
    className: N,
    ...w
  }, M);
}, Vg = (e) => ({
  animationDuration: e,
  animationFillMode: "both"
}), uv = (e, n, o, i, l = !1) => {
  const c = l ? "&" : "";
  return {
    [`
      ${c}${e}-enter,
      ${c}${e}-appear
    `]: {
      ...Vg(i),
      animationPlayState: "paused"
    },
    [`${c}${e}-leave`]: {
      ...Vg(i),
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
}, Kb = new sn("antFadeIn", {
  "0%": {
    opacity: 0
  },
  "100%": {
    opacity: 1
  }
}), Qb = new sn("antFadeOut", {
  "0%": {
    opacity: 1
  },
  "100%": {
    opacity: 0
  }
}), Zb = (e, n = !1) => {
  const {
    antCls: o
  } = e, i = `${o}-fade`, l = n ? "&" : "";
  return [uv(i, Kb, Qb, e.motionDurationMid, n), {
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
}, Jb = new sn("antZoomIn", {
  "0%": {
    transform: "scale(0.2)",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    opacity: 1
  }
}), eE = new sn("antZoomOut", {
  "0%": {
    transform: "scale(1)"
  },
  "100%": {
    transform: "scale(0.2)",
    opacity: 0
  }
}), Wg = new sn("antZoomBigIn", {
  "0%": {
    transform: "scale(0.8)",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    opacity: 1
  }
}), Ug = new sn("antZoomBigOut", {
  "0%": {
    transform: "scale(1)"
  },
  "100%": {
    transform: "scale(0.8)",
    opacity: 0
  }
}), tE = new sn("antZoomUpIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 0%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "50% 0%"
  }
}), nE = new sn("antZoomUpOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "50% 0%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 0%",
    opacity: 0
  }
}), rE = new sn("antZoomLeftIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "0% 50%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "0% 50%"
  }
}), oE = new sn("antZoomLeftOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "0% 50%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "0% 50%",
    opacity: 0
  }
}), iE = new sn("antZoomRightIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "100% 50%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "100% 50%"
  }
}), sE = new sn("antZoomRightOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "100% 50%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "100% 50%",
    opacity: 0
  }
}), lE = new sn("antZoomDownIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 100%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "50% 100%"
  }
}), aE = new sn("antZoomDownOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "50% 100%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 100%",
    opacity: 0
  }
}), cE = {
  zoom: {
    inKeyframes: Jb,
    outKeyframes: eE
  },
  "zoom-big": {
    inKeyframes: Wg,
    outKeyframes: Ug
  },
  "zoom-big-fast": {
    inKeyframes: Wg,
    outKeyframes: Ug
  },
  "zoom-left": {
    inKeyframes: rE,
    outKeyframes: oE
  },
  "zoom-right": {
    inKeyframes: iE,
    outKeyframes: sE
  },
  "zoom-up": {
    inKeyframes: tE,
    outKeyframes: nE
  },
  "zoom-down": {
    inKeyframes: lE,
    outKeyframes: aE
  }
}, uE = (e, n) => {
  const {
    antCls: o
  } = e, i = `${o}-${n}`, {
    inKeyframes: l,
    outKeyframes: c
  } = cE[n];
  return [uv(i, l, c, e.motionDurationFast), {
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
}, df = (e) => Math.round(Number(e || 0)), fE = (e) => {
  if (e instanceof Ct)
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
class Xa extends Ct {
  constructor(n) {
    super(fE(n));
  }
  toHsbString() {
    const n = this.toHsb(), o = df(n.s * 100), i = df(n.b * 100), l = df(n.h), c = n.a, f = `hsb(${l}, ${o}%, ${i}%)`, p = `hsba(${l}, ${o}%, ${i}%, ${c.toFixed(c === 0 ? 0 : 2)})`;
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
const dE = (e) => e instanceof Xa ? e : new Xa(e);
dE("#1677ff");
const pE = (e, n) => e?.replace(/[^0-9a-f]/gi, "").slice(0, n ? 8 : 6) || "", hE = (e, n) => e ? pE(e, n) : "";
let qg = /* @__PURE__ */ (function() {
  function e(n) {
    if (Hi(this, e), this.cleared = !1, n instanceof e) {
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
    })), this.metaColor = new Xa(this.colors[0].color.metaColor)) : this.metaColor = new Xa(o ? "" : n), (!n || o && !this.colors) && (this.metaColor = this.metaColor.setA(0), this.cleared = !0);
  }
  return Vi(e, [{
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
      return hE(this.toHexString(), this.metaColor.a < 1);
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
function Ga() {
  return Ga = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o) ({}).hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Ga.apply(null, arguments);
}
const mE = (e) => e instanceof qg ? e : new qg(e);
function gE(e, n, o, i) {
  const {
    focusElCls: l,
    focus: c,
    borderElCls: f
  } = o, p = f ? "> *" : "", g = p ? ` ${p}` : "", m = (w) => w.filter(Boolean).map((x) => `&:${x}${g}`).join(","), y = m(["hover", l ? `hover${l}` : null]), v = m([c ? "focus" : null, "active"]);
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
function yE(e, n, o) {
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
function Jd(e, n = {
  focus: !0
}) {
  const {
    componentCls: o
  } = e, {
    componentCls: i
  } = n, l = i || o, c = `${l}-compact`;
  return {
    [c]: {
      ...gE(e, c, n, l),
      ...yE(l, c, n)
    }
  };
}
const Ho = "RC_FORM_INTERNAL_HOOKS", Ke = () => {
  Fn(!1, "Can not find FormContext. Please make sure you wrap Field under Form.");
}, Li = /* @__PURE__ */ h.createContext({
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
}), Ya = /* @__PURE__ */ h.createContext(null);
function ad(e) {
  return e == null ? [] : Array.isArray(e) ? e : [e];
}
function vE(e) {
  return e && !!e._init;
}
function cd() {
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
const pf = cd(), SE = /%[sdj%]/g;
let wE = () => {
};
typeof process < "u" && process.env;
function ud(e) {
  if (!e || !e.length) return null;
  const n = {};
  return e.forEach((o) => {
    const i = o.field;
    n[i] = n[i] || [], n[i].push(o);
  }), n;
}
function In(e, ...n) {
  let o = 0;
  const i = n.length;
  return typeof e == "function" ? e.apply(null, n) : typeof e == "string" ? e.replace(SE, (c) => {
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
function CE(e) {
  return e === "string" || e === "url" || e === "hex" || e === "email" || e === "date" || e === "pattern" || e === "tel";
}
function At(e, n) {
  return !!(e == null || n === "array" && Array.isArray(e) && !e.length || CE(n) && typeof e == "string" && !e);
}
function xE(e, n, o) {
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
function Xg(e, n, o) {
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
function bE(e) {
  const n = [];
  return Object.keys(e).forEach((o) => {
    n.push(...e[o] || []);
  }), n;
}
class Gg extends Error {
  errors;
  fields;
  constructor(n, o) {
    super("Async Validation Error"), this.errors = n, this.fields = o;
  }
}
function EE(e, n, o, i, l) {
  if (n.first) {
    const v = new Promise((w, x) => {
      const b = (E) => (i(E), E.length ? x(new Gg(E, ud(E))) : w(l)), C = bE(e);
      Xg(C, o, b);
    });
    return v.catch((w) => w), v;
  }
  const c = n.firstFields === !0 ? Object.keys(e) : n.firstFields || [], f = Object.keys(e), p = f.length;
  let g = 0;
  const m = [], y = new Promise((v, w) => {
    const x = (b) => {
      if (m.push.apply(m, b), g++, g === p)
        return i(m), m.length ? w(new Gg(m, ud(m))) : v(l);
    };
    f.length || (i(m), v(l)), f.forEach((b) => {
      const C = e[b];
      c.indexOf(b) !== -1 ? Xg(C, o, x) : xE(C, o, x);
    });
  });
  return y.catch((v) => v), y;
}
function $E(e) {
  return !!(e && e.message !== void 0);
}
function PE(e, n) {
  let o = e;
  for (let i = 0; i < n.length; i++) {
    if (o == null)
      return o;
    o = o[n[i]];
  }
  return o;
}
function Yg(e, n) {
  return (o) => {
    let i;
    return e.fullFields ? i = PE(n, e.fullFields) : i = n[o.field || e.fullField], $E(o) ? (o.field = o.field || e.fullField, o.fieldValue = i, o) : {
      message: typeof o == "function" ? o() : o,
      fieldValue: i,
      field: o.field || e.fullField
    };
  };
}
function Kg(e, n) {
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
const $i = "enum", _E = (e, n, o, i, l) => {
  e[$i] = Array.isArray(e[$i]) ? e[$i] : [], e[$i].indexOf(n) === -1 && i.push(In(l.messages[$i], e.fullField, e[$i].join(", ")));
}, RE = (e, n, o, i, l) => {
  e.pattern && (e.pattern instanceof RegExp ? (e.pattern.lastIndex = 0, e.pattern.test(n) || i.push(In(l.messages.pattern.mismatch, e.fullField, n, e.pattern))) : typeof e.pattern == "string" && (new RegExp(e.pattern).test(n) || i.push(In(l.messages.pattern.mismatch, e.fullField, n, e.pattern))));
}, NE = (e, n, o, i, l) => {
  const c = typeof e.len == "number", f = typeof e.min == "number", p = typeof e.max == "number", g = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
  let m = n, y = null;
  const v = typeof n == "number", w = typeof n == "string", x = Array.isArray(n);
  if (v ? y = "number" : w ? y = "string" : x && (y = "array"), !y)
    return !1;
  x && (m = n.length), w && (m = n.replace(g, "_").length), c ? m !== e.len && i.push(In(l.messages[y].len, e.fullField, e.len)) : f && !p && m < e.min ? i.push(In(l.messages[y].min, e.fullField, e.min)) : p && !f && m > e.max ? i.push(In(l.messages[y].max, e.fullField, e.max)) : f && p && (m < e.min || m > e.max) && i.push(In(l.messages[y].range, e.fullField, e.min, e.max));
}, fv = (e, n, o, i, l, c) => {
  e.required && (!o.hasOwnProperty(e.field) || At(n, c || e.type)) && i.push(In(l.messages.required, e.fullField));
};
let Ea;
const kE = (() => {
  if (Ea)
    return Ea;
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
  ].join("|")})(?:%[0-9a-zA-Z]{1,})?`, p = new RegExp(`(?:^${o}$)|(?:^${f}$)`), g = new RegExp(`^${o}$`), m = new RegExp(`^${f}$`), y = (M) => M && M.exact ? p : new RegExp(`(?:${n(M)}${o}${n(M)})|(?:${n(M)}${f}${n(M)})`, "g");
  y.v4 = (M) => M && M.exact ? g : new RegExp(`${n(M)}${o}${n(M)}`, "g"), y.v6 = (M) => M && M.exact ? m : new RegExp(`${n(M)}${f}${n(M)}`, "g");
  const v = "(?:(?:[a-z]+:)?//)", w = "(?:\\S+(?::\\S*)?@)?", x = y.v4().source, b = y.v6().source, R = `(?:${v}|www\\.)${w}(?:localhost|${x}|${b}|(?:(?:[a-z\\u00a1-\\uffff0-9][-_]*)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))(?::\\d{2,5})?(?:[/?#][^\\s"]*)?`;
  return Ea = new RegExp(`(?:^${R}$)`, "i"), Ea;
}), hf = {
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
}, js = {
  integer(e) {
    return js.number(e) && parseInt(e, 10) === e;
  },
  float(e) {
    return js.number(e) && !js.integer(e);
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
    return typeof e == "object" && !js.array(e);
  },
  method(e) {
    return typeof e == "function";
  },
  email(e) {
    return typeof e == "string" && e.length <= 320 && !!e.match(hf.email);
  },
  tel(e) {
    return typeof e == "string" && e.length <= 32 && !!e.match(hf.tel);
  },
  url(e) {
    return typeof e == "string" && e.length <= 2048 && !!e.match(kE());
  },
  hex(e) {
    return typeof e == "string" && !!e.match(hf.hex);
  }
}, TE = (e, n, o, i, l) => {
  if (e.required && n === void 0) {
    fv(e, n, o, i, l);
    return;
  }
  const c = ["integer", "float", "array", "regexp", "object", "method", "email", "tel", "number", "date", "url", "hex"], f = e.type;
  c.indexOf(f) > -1 ? js[f](n) || i.push(In(l.messages.types[f], e.fullField, e.type)) : f && typeof n !== e.type && i.push(In(l.messages.types[f], e.fullField, e.type));
}, ME = (e, n, o, i, l) => {
  (/^\s+$/.test(n) || n === "") && i.push(In(l.messages.whitespace, e.fullField));
}, Ie = {
  required: fv,
  whitespace: ME,
  type: TE,
  range: NE,
  enum: _E,
  pattern: RE
}, IE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l);
  }
  o(c);
}, FE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (n == null && !e.required)
      return o();
    Ie.required(e, n, i, c, l, "array"), n != null && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, OE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie.type(e, n, i, c, l);
  }
  o(c);
}, zE = (e, n, o, i, l) => {
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
}, AE = "enum", LE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie[AE](e, n, i, c, l);
  }
  o(c);
}, BE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, DE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, jE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie.type(e, n, i, c, l);
  }
  o(c);
}, HE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (n === "" && (n = void 0), At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, VE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie.type(e, n, i, c, l);
  }
  o(c);
}, WE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n, "string") && !e.required)
      return o();
    Ie.required(e, n, i, c, l), At(n, "string") || Ie.pattern(e, n, i, c, l);
  }
  o(c);
}, UE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), At(n) || Ie.type(e, n, i, c, l);
  }
  o(c);
}, qE = (e, n, o, i, l) => {
  const c = [], f = Array.isArray(n) ? "array" : typeof n;
  Ie.required(e, n, i, c, l, f), o(c);
}, XE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n, "string") && !e.required)
      return o();
    Ie.required(e, n, i, c, l, "string"), At(n, "string") || (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l), Ie.pattern(e, n, i, c, l), e.whitespace === !0 && Ie.whitespace(e, n, i, c, l));
  }
  o(c);
}, $a = (e, n, o, i, l) => {
  const c = e.type, f = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (At(n, c) && !e.required)
      return o();
    Ie.required(e, n, i, f, l, c), At(n, c) || Ie.type(e, n, i, f, l);
  }
  o(f);
}, Ns = {
  string: XE,
  method: jE,
  number: HE,
  boolean: OE,
  regexp: UE,
  integer: DE,
  float: BE,
  array: FE,
  object: VE,
  enum: LE,
  pattern: WE,
  date: zE,
  url: $a,
  hex: $a,
  email: $a,
  tel: $a,
  required: qE,
  any: IE
};
class Ka {
  // ========================= Static =========================
  static register = function(o, i) {
    if (typeof i != "function")
      throw new Error("Cannot register a validator by type, validator is not a function");
    Ns[o] = i;
  };
  static warning = wE;
  static messages = pf;
  static validators = Ns;
  // ======================== Instance ========================
  rules = null;
  _messages = pf;
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
    return n && (this._messages = Kg(cd(), n)), this._messages;
  }
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  validate(n, o = {}, i = () => {
  }) {
    let l = n, c = o, f = i;
    if (typeof c == "function" && (f = c, c = {}), !this.rules || Object.keys(this.rules).length === 0)
      return f && f(null, l), Promise.resolve(l);
    function p(v) {
      let w = [], x = {};
      function b(C) {
        Array.isArray(C) ? w = w.concat(...C) : w.push(C);
      }
      for (let C = 0; C < v.length; C++)
        b(v[C]);
      w.length ? (x = ud(w), f(w, x)) : f(null, l);
    }
    if (c.messages) {
      let v = this.messages();
      v === pf && (v = cd()), Kg(v, c.messages), c.messages = v;
    } else
      c.messages = this.messages();
    const g = {};
    (c.keys || Object.keys(this.rules)).forEach((v) => {
      const w = this.rules[v];
      let x = l[v];
      w.forEach((b) => {
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
    return EE(g, c, (v, w) => {
      const x = v.rule;
      let b = (x.type === "object" || x.type === "array") && (typeof x.fields == "object" || typeof x.defaultField == "object");
      b = b && (x.required || !x.required && v.value), x.field = v.field;
      function C(N, _) {
        return {
          ..._,
          fullField: `${x.fullField}.${N}`,
          fullFields: x.fullFields ? [...x.fullFields, N] : [N]
        };
      }
      function E(N = []) {
        let _ = Array.isArray(N) ? N : [N];
        !c.suppressWarning && _.length && Ka.warning("async-validator:", _), _.length && x.message !== void 0 && x.message !== null && (_ = [].concat(x.message));
        let R = _.map(Yg(x, l));
        if (c.first && R.length)
          return y[x.field] = 1, w(R);
        if (!b)
          w(R);
        else {
          if (x.required && !v.value)
            return x.message !== void 0 ? R = [].concat(x.message).map(Yg(x, l)) : c.error && (R = [c.error(x, In(c.messages.required, x.field))]), w(R);
          let M = {};
          x.defaultField && Object.keys(v.value).map((z) => {
            M[z] = x.defaultField;
          }), M = {
            ...M,
            ...v.rule.fields
          };
          const F = {};
          Object.keys(M).forEach((z) => {
            const H = M[z], Y = Array.isArray(H) ? H : [H];
            F[z] = Y.map(C.bind(null, z));
          });
          const O = new Ka(F);
          O.messages(c.messages), v.rule.options && (v.rule.options.messages = c.messages, v.rule.options.error = c.error), O.validate(v.value, v.rule.options || c, (z) => {
            const H = [];
            R && R.length && H.push(...R), z && z.length && H.push(...z), w(H.length ? H : null);
          });
        }
      }
      let P;
      if (x.asyncValidator)
        P = x.asyncValidator(x, v.value, E, v.source, c);
      else if (x.validator) {
        try {
          P = x.validator(x, v.value, E, v.source, c);
        } catch (N) {
          console.error?.(N), c.suppressValidatorError || setTimeout(() => {
            throw N;
          }, 0), E(N.message);
        }
        P === !0 ? E() : P === !1 ? E(typeof x.message == "function" ? x.message(x.fullField || x.field) : x.message || `${x.fullField || x.field} fails`) : P instanceof Array ? E(P) : P instanceof Error && E(P.message);
      }
      P && P.then && P.then(() => E(), (N) => E(N));
    }, (v) => {
      p(v);
    }, l);
  }
  getType(n) {
    if (n.type === void 0 && n.pattern instanceof RegExp && (n.type = "pattern"), typeof n.validator != "function" && n.type && !Ns.hasOwnProperty(n.type))
      throw new Error(In("Unknown rule type %s", n.type));
    return n.type || "string";
  }
  getValidationMethod(n) {
    if (typeof n.validator == "function")
      return n.validator;
    const o = Object.keys(n), i = o.indexOf("message");
    return i !== -1 && o.splice(i, 1), o.length === 1 && o[0] === "required" ? Ns.required : Ns[this.getType(n)] || void 0;
  }
}
const xn = "'${name}' is not a valid ${type}", dv = {
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
    string: xn,
    method: xn,
    array: xn,
    object: xn,
    number: xn,
    date: xn,
    boolean: xn,
    integer: xn,
    float: xn,
    regexp: xn,
    email: xn,
    tel: xn,
    url: xn,
    hex: xn
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
}, Qg = Ka;
function GE(e, n) {
  return e.replace(/\\?\$\{\w+\}/g, (o) => {
    if (o.startsWith("\\"))
      return o.slice(1);
    const i = o.slice(2, -1);
    return n[i];
  });
}
const Zg = "CODE_LOGIC_ERROR";
async function fd(e, n, o, i, l) {
  const c = {
    ...o
  };
  if (delete c.ruleIndex, Qg.warning = () => {
  }, c.validator) {
    const w = c.validator;
    c.validator = (...x) => {
      try {
        return w(...x);
      } catch (b) {
        return console.error(b), Promise.reject(Zg);
      }
    };
  }
  let f = null;
  c && c.type === "array" && c.defaultField && (f = c.defaultField, delete c.defaultField);
  const p = new Qg({
    [e]: [c]
  }), g = Ni(dv, i.validateMessages);
  p.messages(g);
  let m = [];
  try {
    await Promise.resolve(p.validate({
      [e]: n
    }, {
      ...i
    }));
  } catch (w) {
    w.errors && (m = w.errors.map(({
      message: x
    }, b) => {
      const C = x === Zg ? g.default : x;
      return /* @__PURE__ */ h.isValidElement(C) ? (
        // Wrap ReactNode with `key`
        /* @__PURE__ */ h.cloneElement(C, {
          key: `error_${b}`
        })
      ) : C;
    }));
  }
  if (!m.length && f && Array.isArray(n) && n.length > 0)
    return (await Promise.all(n.map((x, b) => fd(`${e}.${b}`, x, f, i, l)))).reduce((x, b) => [...x, ...b], []);
  const y = {
    ...o,
    name: e,
    enum: (o.enum || []).join(", "),
    ...l
  };
  return m.map((w) => typeof w == "string" ? GE(w, y) : w);
}
function YE(e, n, o, i, l, c) {
  const f = e.join("."), p = o.map((m, y) => {
    const v = m.validator, w = {
      ...m,
      ruleIndex: y
    };
    return v && (w.validator = (x, b, C) => {
      let E = !1;
      const N = v(x, b, (..._) => {
        Promise.resolve().then(() => {
          Fn(!E, "Your validator function has already return a promise. `callback` will be ignored."), E || C(..._);
        });
      });
      E = N && typeof N.then == "function" && typeof N.catch == "function", Fn(E, "`callback` is deprecated. Please return a promise instead."), E && N.then(() => {
        C();
      }).catch((_) => {
        C(_ || " ");
      });
    }), w;
  }).sort(({
    warningOnly: m,
    ruleIndex: y
  }, {
    warningOnly: v,
    ruleIndex: w
  }) => !!m == !!v ? y - w : m ? 1 : -1);
  let g;
  if (l === !0)
    g = new Promise(async (m, y) => {
      for (let v = 0; v < p.length; v += 1) {
        const w = p[v], x = await fd(f, n, w, i, c);
        if (x.length) {
          y([{
            errors: x,
            rule: w
          }]);
          return;
        }
      }
      m([]);
    });
  else {
    const m = p.map((y) => fd(f, n, y, i, c).then((v) => ({
      errors: v,
      rule: y
    })));
    g = (l ? QE(m) : KE(m)).then((y) => Promise.reject(y));
  }
  return g.catch((m) => m), g;
}
async function KE(e) {
  return Promise.all(e).then((n) => [].concat(...n));
}
async function QE(e) {
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
  return ad(e);
}
function Jg(e, n) {
  let o = {};
  return n.forEach((i) => {
    const l = Qn(e, i);
    o = Mn(o, i, l);
  }), o;
}
function Ti(e, n, o = !1) {
  return e && e.some((i) => Qa(n, i, o));
}
function Qa(e, n, o = !1) {
  return !e || !n || !o && e.length !== n.length ? !1 : n.every((i, l) => e[l] === i);
}
function ZE(e, n) {
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
function JE(e, ...n) {
  const o = n[0];
  return o && o.target && typeof o.target == "object" && e in o.target ? o.target[e] : o;
}
function e0(e, n, o) {
  const {
    length: i
  } = e;
  if (n < 0 || n >= i || o < 0 || o >= i)
    return e;
  const l = e[n], c = n - o;
  return c > 0 ? [...e.slice(0, o), l, ...e.slice(o, n), ...e.slice(n + 1, i)] : c < 0 ? [...e.slice(0, n), ...e.slice(n + 1, o + 1), l, ...e.slice(o + 1, i)] : e;
}
const pv = (e) => {
  const n = new MessageChannel();
  n.port1.onmessage = e, n.port2.postMessage(null);
};
class e$ {
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
      this.namePathList.every((i) => !Qa(i, o)) && this.namePathList.push(o);
    }), this.doBatch();
  }
  doBatch() {
    this.taskId += 1;
    const n = this.taskId;
    pv(() => {
      if (n === this.taskId && this.watcherList.size) {
        const o = this.form.getForm(), i = o.getFieldsValue(), l = o.getFieldsValue(!0);
        this.watcherList.forEach((c) => {
          c(i, l, this.namePathList);
        }), this.namePathList = [];
      }
    });
  }
}
async function t$() {
  return new Promise((e) => {
    pv(() => {
      vo(() => {
        e();
      });
    });
  });
}
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
const Oo = [], ks = [];
function mf(e, n, o, i, l, c) {
  return typeof e == "function" ? e(n, o, "source" in c ? {
    source: c.source
  } : {}) : i !== l;
}
class n$ extends h.PureComponent {
  static contextType = Li;
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
  errors = Oo;
  warnings = ks;
  // ============================== Subscriptions ==============================
  constructor(n) {
    if (super(n), n.fieldContext) {
      const {
        getInternalHooks: o
      } = n.fieldContext, {
        initEntityValue: i
      } = o(Ho);
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
      } = i(Ho);
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
      Ys(this.metaCache, i) || o(i), this.metaCache = i;
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
    } = i, g = this.getNamePath(), m = this.getValue(n), y = this.getValue(p), v = o && Ti(o, g);
    switch (i.type === "valueUpdate" && i.source === "external" && !Ys(m, y) && (this.touched = !0, this.dirty = !0, this.validatePromise = null, this.errors = Oo, this.warnings = ks, this.triggerMetaEvent()), i.type) {
      case "reset":
        if (!o || v) {
          this.touched = !1, this.dirty = !1, this.validatePromise = void 0, this.errors = Oo, this.warnings = ks, this.triggerMetaEvent(), f?.(), this.refresh();
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
        if (l && mf(l, n, p, m, y, i)) {
          this.reRender();
          return;
        }
        break;
      }
      case "setField": {
        const {
          data: w
        } = i;
        if (v) {
          "touched" in w && (this.touched = w.touched), "validating" in w && !("originRCField" in w) && (this.validatePromise = w.validating ? Promise.resolve([]) : null), "errors" in w && (this.errors = w.errors || Oo), "warnings" in w && (this.warnings = w.warnings || ks), this.dirty = !0, this.triggerMetaEvent(), this.reRender();
          return;
        } else if ("value" in w && Ti(o, g, !0)) {
          this.reRender();
          return;
        }
        if (l && !g.length && mf(l, n, p, m, y, i)) {
          this.reRender();
          return;
        }
        break;
      }
      case "dependenciesUpdate": {
        if (c.map(St).some((x) => Ti(i.relatedFields, x))) {
          this.reRender();
          return;
        }
        break;
      }
      default:
        if (v || (!c.length || g.length || l) && mf(l, n, p, m, y, i)) {
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
        messageVariables: m,
        validateDebounce: y
      } = this.props;
      f && await t$();
      let v = this.getRules();
      if (l && (v = v.filter((x) => x).filter((x) => {
        const {
          validateTrigger: b
        } = x;
        return b ? ad(b).includes(l) : !0;
      })), y && l && (await new Promise((x) => {
        setTimeout(x, y);
      }), this.validatePromise !== p))
        return [];
      const w = YE(o, i, v, n, g, m);
      return w.catch((x) => x).then((x = Oo) => {
        if (this.validatePromise === p) {
          this.validatePromise = null;
          const b = [], C = [];
          x.forEach?.(({
            rule: {
              warningOnly: E
            },
            errors: P = Oo
          }) => {
            E ? C.push(...P) : b.push(...P);
          }), this.errors = b, this.warnings = C, this.triggerMetaEvent(), this.reRender();
        }
      }), w;
    });
    return c || (this.validatePromise = p, this.dirty = !0, this.errors = Oo, this.warnings = ks, this.triggerMetaEvent(), this.reRender()), p;
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
    } = n.getInternalHooks(Ho);
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
    const o = Js(n);
    return o.length !== 1 || !/* @__PURE__ */ h.isValidElement(o[0]) ? {
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
    return Qn(n || o(!0), i);
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
      fieldContext: m
    } = this.props, y = l !== void 0 ? l : m.validateTrigger, v = this.getNamePath(), {
      getInternalHooks: w,
      getFieldsValue: x
    } = m, {
      dispatch: b
    } = w(Ho), C = this.getValue(), E = g || ((M) => ({
      [p]: M
    })), P = n[i], N = o !== void 0 ? E(C) : {}, _ = {
      ...n,
      ...N
    };
    return _[i] = (...M) => {
      this.touched = !0, this.dirty = !0, this.triggerMetaEvent();
      const F = this.getValue();
      let O;
      c ? O = c(...M) : O = JE(p, ...M), f && (O = f(O, F, x(!0))), O !== F && b({
        type: "updateValue",
        namePath: v,
        value: O
      }), P && P(...M);
    }, ad(y || []).forEach((M) => {
      const F = _[M];
      _[M] = (...O) => {
        F && F(...O);
        const {
          rules: z
        } = this.props;
        z && z.length && b({
          type: "validateField",
          namePath: v,
          triggerName: M
        });
      };
    }), _;
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
    return l ? c = i : /* @__PURE__ */ h.isValidElement(i) ? c = /* @__PURE__ */ h.cloneElement(i, this.getControlled(i.props)) : (Fn(!i, "`children` of Field is not validate ReactElement."), c = i), /* @__PURE__ */ h.createElement(h.Fragment, {
      key: n
    }, c);
  }
}
function hv({
  name: e,
  ...n
}) {
  const o = h.useContext(Li), i = h.useContext(Ya), l = e !== void 0 ? St(e) : void 0, c = n.isListField ?? !!i;
  let f = "keep";
  return c || (f = `_${(l || []).join("_")}`), /* @__PURE__ */ h.createElement(n$, dd({
    key: f,
    name: l,
    isListField: c
  }, n, {
    fieldContext: o
  }));
}
function r$({
  name: e,
  initialValue: n,
  children: o,
  rules: i,
  validateTrigger: l,
  isListField: c
}) {
  const f = h.useContext(Li), p = h.useContext(Ya), m = h.useRef({
    keys: [],
    id: 0
  }).current, y = h.useMemo(() => [...St(f.prefixName) || [], ...St(e)], [f.prefixName, e]), v = h.useMemo(() => ({
    ...f,
    prefixName: y
  }), [f, y]), w = h.useMemo(() => ({
    getKey: (b) => {
      const C = y.length, E = b[C];
      return [m.keys[E], b.slice(C + 1)];
    }
  }), [m, y]);
  if (typeof o != "function")
    return Fn(!1, "Form.List only accepts function as children."), null;
  const x = (b, C, {
    source: E
  }) => E === "internal" ? !1 : b !== C;
  return /* @__PURE__ */ h.createElement(Ya.Provider, {
    value: w
  }, /* @__PURE__ */ h.createElement(Li.Provider, {
    value: v
  }, /* @__PURE__ */ h.createElement(hv, {
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
      getFieldValue: P
    } = f, N = () => P(y || []) || [], _ = {
      add: (M, F) => {
        const O = N();
        F >= 0 && F <= O.length ? (m.keys = [...m.keys.slice(0, F), m.id, ...m.keys.slice(F)], C([...O.slice(0, F), M, ...O.slice(F)])) : (m.keys = [...m.keys, m.id], C([...O, M])), m.id += 1;
      },
      remove: (M) => {
        const F = N(), O = new Set(Array.isArray(M) ? M : [M]);
        O.size <= 0 || (m.keys = m.keys.filter((z, H) => !O.has(H)), C(F.filter((z, H) => !O.has(H))));
      },
      move(M, F) {
        if (M === F)
          return;
        const O = N();
        M < 0 || M >= O.length || F < 0 || F >= O.length || (m.keys = e0(m.keys, M, F), C(e0(O, M, F)));
      }
    };
    let R = b || [];
    return Array.isArray(R) || (R = []), o(R.map((M, F) => {
      let O = m.keys[F];
      return O === void 0 && (m.keys[F] = m.id, O = m.keys[F], m.id += 1), {
        name: F,
        key: O,
        isListField: !0
      };
    }), _, E);
  })));
}
function o$(e) {
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
const pd = "__@field_split__";
function Pa(e) {
  return e.map((n) => `${typeof n}:${n}`).join(pd);
}
class Pi {
  kvs = /* @__PURE__ */ new Map();
  set(n, o) {
    this.kvs.set(Pa(n), o);
  }
  get(n) {
    return this.kvs.get(Pa(n));
  }
  getAsPrefix(n) {
    const o = Pa(n), i = o + pd, l = [], c = this.kvs.get(o);
    return c !== void 0 && l.push(c), this.kvs.forEach((f, p) => {
      p.startsWith(i) && l.push(f);
    }), l;
  }
  update(n, o) {
    const i = this.get(n), l = o(i);
    l ? this.set(n, l) : this.delete(n);
  }
  delete(n) {
    this.kvs.delete(Pa(n));
  }
  // Since we only use this in test, let simply realize this
  map(n) {
    return [...this.kvs.entries()].map(([o, i]) => {
      const l = o.split(pd);
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
class i$ {
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
  watcherCenter = new e$(this);
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
  getInternalHooks = (n) => n === Ho ? (this.formHooked = !0, {
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
  }) : (Fn(!1, "`getInternalHooks` is internal usage. Should not call directly."), null);
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
      let i = Ni(n, this.store);
      this.prevWithoutPreserves?.map(({
        key: l
      }) => {
        i = Mn(i, l, Qn(n, l));
      }), this.prevWithoutPreserves = null, this.updateStore(i);
    }
  };
  destroyForm = (n) => {
    if (n)
      this.updateStore({});
    else {
      const o = new Pi();
      this.getFieldEntities(!0).forEach((i) => {
        this.isMergedPreserve(i.isPreserve()) || o.set(i.getNamePath(), !0);
      }), this.prevWithoutPreserves = o;
    }
  };
  getInitialValue = (n) => {
    const o = Qn(this.initialValues, n);
    return n.length ? Ni(o) : o;
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
    const o = new Pi();
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
    c.forEach((m) => {
      const y = m.INVALIDATE_NAME_PATH || m.getNamePath();
      if (m.isList?.()) {
        p.push(y);
        return;
      }
      if (!l)
        f.push(y);
      else {
        const v = "getMeta" in m ? m.getMeta() : null;
        l(v) && f.push(y);
      }
    });
    let g = Jg(this.store, f.map(St));
    return p.forEach((m) => {
      Qn(g, m) || (g = Mn(g, m, []));
    }), g;
  };
  getFieldValue = (n) => {
    this.warningUnhooked();
    const o = St(n);
    return Qn(this.store, o);
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
    const g = new Pi();
    l.forEach((v) => {
      g.set(v, []);
    }), f.forEach((v) => {
      const w = v.getNamePath();
      l.forEach((x) => {
        x.every((b, C) => w[C] === b) && g.update(x, (b) => [...b, v]);
      });
    });
    const m = (v) => v.some(p), y = g.map(({
      value: v
    }) => v);
    return c ? y.every(m) : y.some(m);
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
      return Ti(i, c) && l.isFieldValidating();
    });
  };
  isFieldValidating = (n) => (this.warningUnhooked(), this.isFieldsValidating([n]));
  /**
   * Reset Field with field `initialValue` prop.
   * Can pass `entities` or `namePathList` or just nothing.
   */
  resetWithFieldInitialValue = (n = {}) => {
    const o = new Pi(), i = this.getFieldEntities(!0);
    i.forEach((f) => {
      const {
        initialValue: p
      } = f.props, g = f.getNamePath();
      if (p !== void 0) {
        const m = o.get(g) || /* @__PURE__ */ new Set();
        m.add({
          entity: f,
          value: p
        }), o.set(g, m);
      }
    });
    const l = (f) => {
      f.forEach((p) => {
        const {
          initialValue: g
        } = p.props;
        if (g !== void 0) {
          const m = p.getNamePath();
          if (this.getInitialValue(m) !== void 0)
            Fn(!1, `Form already set 'initialValues' with path '${m.join(".")}'. Field can not overwrite it.`);
          else {
            const v = o.get(m);
            if (v && v.size > 1)
              Fn(!1, `Multiple Field with path '${m.join(".")}' set 'initialValue'. Can not decide which one to pick.`);
            else if (v) {
              const w = this.getFieldValue(m);
              !p.isListField() && (!n.skipExist || w === void 0) && this.updateStore(Mn(this.store, m, [...v][0].value));
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
      this.updateStore(Ni(this.initialValues)), this.resetWithFieldInitialValue(), this.notifyObservers(o, null, {
        type: "reset"
      }), this.notifyWatch();
      return;
    }
    const i = n.map(St);
    i.forEach((l) => {
      const c = this.getInitialValue(l);
      this.updateStore(Mn(this.store, l, c));
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
      i.push(p), "value" in f && this.updateStore(Mn(this.store, p, f.value)), this.notifyObservers(o, [p], {
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
      Qn(this.store, i) === void 0 && this.updateStore(Mn(this.store, i, o));
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
          !Qa(p.getNamePath(), o)
        ))) {
          const p = this.store;
          this.updateStore(Mn(p, o, f, !0)), this.notifyObservers(p, [o], {
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
    this.updateStore(Mn(this.store, i, o)), this.notifyObservers(l, [i], {
      type: "valueUpdate",
      source: "internal"
    }), this.notifyWatch([i]);
    const c = this.triggerDependenciesUpdate(l, i), {
      onValuesChange: f
    } = this.callbacks;
    if (f) {
      const p = Jg(this.store, [i]), g = this.getFieldsValue(), m = Mn(g, i, Qn(p, i));
      f(p, m);
    }
    this.triggerOnFieldsChange([i, ...c]);
  };
  // Let all child Field get update.
  setFieldsValue = (n) => {
    this.warningUnhooked();
    const o = this.store;
    if (n) {
      const i = Ni(this.store, n);
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
    const o = /* @__PURE__ */ new Set(), i = [], l = new Pi();
    this.getFieldEntities().forEach((f) => {
      const {
        dependencies: p
      } = f.props;
      (p || []).forEach((g) => {
        const m = St(g);
        l.update(m, (y = /* @__PURE__ */ new Set()) => (y.add(f), y));
      });
    });
    const c = (f) => {
      (l.get(f) || /* @__PURE__ */ new Set()).forEach((g) => {
        if (!o.has(g)) {
          o.add(g);
          const m = g.getNamePath();
          g.isFieldDirty() && m.length && (i.push(m), c(m));
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
        const f = new Pi();
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
      }) => Ti(n, f));
      c.length && i(c, l);
    }
  };
  // =========================== Validate ===========================
  validateFields = (n, o) => {
    this.warningUnhooked();
    let i, l;
    Array.isArray(n) || typeof n == "string" || typeof o == "string" ? (i = n, l = o) : l = n;
    const c = !!i, f = c ? i.map(St) : [], p = [...f], g = [], m = String(Date.now()), y = /* @__PURE__ */ new Set(), {
      recursive: v,
      dirty: w
    } = l || {};
    this.getFieldEntities(!0).forEach((E) => {
      const P = E.getNamePath();
      if (c || // If is field, pass directly
      ((!E.isList() || // If is list, do not add if already exist sub field in the namePathList
      !f.some((N) => Qa(N, P, !0))) && p.push(P), f.push(P)), !(!E.props.rules || !E.props.rules.length) && !(w && !E.isFieldDirty()) && (y.add(P.join(m)), !c || Ti(f, P, v))) {
        const N = E.validateRules({
          validateMessages: {
            ...dv,
            ...this.validateMessages
          },
          ...l
        });
        g.push(N.then(() => ({
          name: P,
          errors: [],
          warnings: []
        })).catch((_) => {
          const R = [], M = [];
          return _.forEach?.(({
            rule: {
              warningOnly: F
            },
            errors: O
          }) => {
            F ? M.push(...O) : R.push(...O);
          }), R.length ? Promise.reject({
            name: P,
            errors: R,
            warnings: M
          }) : {
            name: P,
            errors: R,
            warnings: M
          };
        }));
      }
    });
    const x = o$(g);
    this.lastValidatePromise = x, x.catch((E) => E).then((E) => {
      const P = E.map(({
        name: N
      }) => N);
      this.notifyObservers(this.store, P, {
        type: "validateFinish"
      }), this.triggerOnFieldsChange(P, E);
    });
    const b = x.then(() => this.lastValidatePromise === x ? Promise.resolve(this.getFieldsValue(p)) : Promise.reject([])).catch((E) => {
      const P = E.filter((_) => _ && _.errors.length), N = P[0]?.errors?.[0];
      return Promise.reject({
        message: N,
        values: this.getFieldsValue(f),
        errorFields: P,
        outOfDate: this.lastValidatePromise !== x
      });
    });
    b.catch((E) => E);
    const C = f.filter((E) => y.has(E.join(m)));
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
function mv(e) {
  const n = h.useRef(null), [, o] = h.useState({});
  if (!n.current)
    if (e)
      n.current = e;
    else {
      const i = () => {
        o({});
      }, l = new i$(i);
      n.current = l.getForm();
    }
  return [n.current];
}
const hd = /* @__PURE__ */ h.createContext({
  triggerFormChange: () => {
  },
  triggerFormFinish: () => {
  },
  registerForm: () => {
  },
  unregisterForm: () => {
  }
}), s$ = ({
  validateMessages: e,
  onFormChange: n,
  onFormFinish: o,
  children: i
}) => {
  const l = h.useContext(hd), c = h.useRef({});
  return /* @__PURE__ */ h.createElement(hd.Provider, {
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
function md() {
  return md = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, md.apply(this, arguments);
}
const l$ = (e, n) => {
  const {
    name: o,
    initialValues: i,
    fields: l,
    form: c,
    preserve: f,
    children: p,
    component: g = "form",
    validateMessages: m,
    validateTrigger: y = "onChange",
    onValuesChange: v,
    onFieldsChange: w,
    onFinish: x,
    onFinishFailed: b,
    clearOnDestroy: C,
    ...E
  } = e, P = h.useRef(null), N = h.useContext(hd), [_] = mv(c), {
    useSubscribe: R,
    setInitialValues: M,
    setCallbacks: F,
    setValidateMessages: O,
    setPreserve: z,
    destroyForm: H
  } = _.getInternalHooks(Ho);
  h.useImperativeHandle(n, () => ({
    ..._,
    nativeElement: P.current
  })), h.useEffect(() => (N.registerForm(o, _), () => {
    N.unregisterForm(o);
  }), [N, _, o]), O({
    ...N.validateMessages,
    ...m
  }), F({
    onValuesChange: v,
    onFieldsChange: (le, ...he) => {
      N.triggerFormChange(o, le), w && w(le, ...he);
    },
    onFinish: (le) => {
      N.triggerFormFinish(o, le), x && x(le);
    },
    onFinishFailed: b
  }), z(f);
  const Y = h.useRef(null);
  M(i, !Y.current), Y.current || (Y.current = !0), h.useEffect(
    () => () => H(C),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  let V;
  const X = typeof p == "function";
  if (X) {
    const le = _.getFieldsValue(!0);
    V = p(le, _);
  } else
    V = p;
  R(!X);
  const Q = h.useRef(null);
  h.useEffect(() => {
    ZE(Q.current || [], l || []) || _.setFields(l || []), Q.current = l;
  }, [l, _]);
  const oe = h.useMemo(() => ({
    ..._,
    validateTrigger: y
  }), [_, y]), G = /* @__PURE__ */ h.createElement(Ya.Provider, {
    value: null
  }, /* @__PURE__ */ h.createElement(Li.Provider, {
    value: oe
  }, V));
  return g === !1 ? G : /* @__PURE__ */ h.createElement(g, md({}, E, {
    ref: P,
    onSubmit: (le) => {
      le.preventDefault(), le.stopPropagation(), _.submit();
    },
    onReset: (le) => {
      le.preventDefault(), _.resetFields(), E.onReset?.(le);
    }
  }), G);
};
function gf(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return Math.random();
  }
}
function a$(...e) {
  const [n, o = {}] = e, i = vE(o) ? {
    form: o
  } : o, l = i.form, [c, f] = h.useState(() => typeof n == "function" ? n({}) : void 0), p = h.useMemo(() => gf(c), [c]), g = h.useRef(p);
  g.current = p;
  const m = h.useContext(Li), y = l || m, v = y && y._init, {
    getFieldsValue: w,
    getInternalHooks: x
  } = y, {
    registerWatch: b
  } = x(Ho), C = wt((P, N) => {
    const _ = i.preserve ? N ?? w(!0) : P ?? w(), R = typeof n == "function" ? n(_) : Qn(_, St(n));
    gf(c) !== gf(R) && f(R);
  }), E = typeof n == "function" ? n : JSON.stringify(n);
  return h.useEffect(() => {
    v && C();
  }, [v, E]), h.useEffect(() => v ? b((N, _) => {
    C(N, _);
  }) : void 0, [v]), c;
}
const c$ = /* @__PURE__ */ h.forwardRef(l$), ul = c$;
ul.FormProvider = s$;
ul.Field = hv;
ul.List = r$;
ul.useForm = mv;
ul.useWatch = a$;
const Za = /* @__PURE__ */ h.createContext({}), u$ = ({
  children: e,
  status: n,
  override: o
}) => {
  const i = h.useContext(Za), l = h.useMemo(() => {
    const c = {
      ...i
    };
    return o && delete c.isFormItemInput, n && (delete c.status, delete c.hasFeedback, delete c.feedbackIcon), c;
  }, [n, o, i]);
  return /* @__PURE__ */ h.createElement(Za.Provider, {
    value: l
  }, e);
}, f$ = /* @__PURE__ */ h.createContext(void 0), gv = (e) => {
  const {
    space: n,
    form: o,
    children: i
  } = e;
  if (!Kx(i))
    return null;
  let l = i;
  return o && (l = /* @__PURE__ */ ye.createElement(u$, {
    override: !0,
    status: !0
  }, l)), n && (l = /* @__PURE__ */ ye.createElement(Xb, null, l)), l;
}, yv = (e, n, o) => we({
  [`${e}-status-success`]: n === "success",
  [`${e}-status-warning`]: n === "warning",
  [`${e}-status-error`]: n === "error",
  [`${e}-status-validating`]: n === "validating",
  [`${e}-has-feedback`]: o
}), d$ = (e, n) => n || e, p$ = (e, n, o) => {
  const {
    variant: i,
    [e]: l
  } = h.useContext(On), c = h.useContext(f$), f = l?.variant;
  let p;
  typeof n < "u" ? p = n : o === !1 ? p = "borderless" : p = c ?? f ?? i ?? "outlined";
  const g = vC.includes(p);
  return [p, g];
};
var _a = {}, t0;
function h$() {
  if (t0) return _a;
  t0 = 1, Object.defineProperty(_a, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 00-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z" } }] }, name: "check", theme: "outlined" };
  return _a.default = e, _a;
}
var m$ = /* @__PURE__ */ h$();
const g$ = /* @__PURE__ */ er(m$);
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
const y$ = (e, n) => /* @__PURE__ */ h.createElement(Pr, gd({}, e, {
  ref: n,
  icon: g$
})), v$ = /* @__PURE__ */ h.forwardRef(y$);
var Ra = {}, n0;
function S$() {
  if (n0) return Ra;
  n0 = 1, Object.defineProperty(Ra, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M884 256h-75c-5.1 0-9.9 2.5-12.9 6.6L512 654.2 227.9 262.6c-3-4.1-7.8-6.6-12.9-6.6h-75c-6.5 0-10.3 7.4-6.5 12.7l352.6 486.1c12.8 17.6 39 17.6 51.7 0l352.6-486.1c3.9-5.3.1-12.7-6.4-12.7z" } }] }, name: "down", theme: "outlined" };
  return Ra.default = e, Ra;
}
var w$ = /* @__PURE__ */ S$();
const C$ = /* @__PURE__ */ er(w$);
function yd() {
  return yd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, yd.apply(this, arguments);
}
const x$ = (e, n) => /* @__PURE__ */ h.createElement(Pr, yd({}, e, {
  ref: n,
  icon: C$
})), b$ = /* @__PURE__ */ h.forwardRef(x$), vv = (e) => {
  const {
    children: n,
    prefixCls: o,
    id: i,
    classNames: l,
    styles: c,
    className: f,
    style: p
  } = e;
  return /* @__PURE__ */ h.createElement("div", {
    id: i,
    className: we(`${o}-container`, l?.container, f),
    style: {
      ...c?.container,
      ...p
    },
    role: "tooltip"
  }, typeof n == "function" ? n() : n);
}, _i = {
  shiftX: 64,
  adjustY: 1
}, Ri = {
  adjustX: 1,
  shiftY: !0
}, Gn = [0, 0], E$ = {
  left: {
    points: ["cr", "cl"],
    overflow: Ri,
    offset: [-4, 0],
    targetOffset: Gn
  },
  right: {
    points: ["cl", "cr"],
    overflow: Ri,
    offset: [4, 0],
    targetOffset: Gn
  },
  top: {
    points: ["bc", "tc"],
    overflow: _i,
    offset: [0, -4],
    targetOffset: Gn
  },
  bottom: {
    points: ["tc", "bc"],
    overflow: _i,
    offset: [0, 4],
    targetOffset: Gn
  },
  topLeft: {
    points: ["bl", "tl"],
    overflow: _i,
    offset: [0, -4],
    targetOffset: Gn
  },
  leftTop: {
    points: ["tr", "tl"],
    overflow: Ri,
    offset: [-4, 0],
    targetOffset: Gn
  },
  topRight: {
    points: ["br", "tr"],
    overflow: _i,
    offset: [0, -4],
    targetOffset: Gn
  },
  rightTop: {
    points: ["tl", "tr"],
    overflow: Ri,
    offset: [4, 0],
    targetOffset: Gn
  },
  bottomRight: {
    points: ["tr", "br"],
    overflow: _i,
    offset: [0, 4],
    targetOffset: Gn
  },
  rightBottom: {
    points: ["bl", "br"],
    overflow: Ri,
    offset: [4, 0],
    targetOffset: Gn
  },
  bottomLeft: {
    points: ["tl", "bl"],
    overflow: _i,
    offset: [0, 4],
    targetOffset: Gn
  },
  leftBottom: {
    points: ["br", "bl"],
    overflow: Ri,
    offset: [-4, 0],
    targetOffset: Gn
  }
};
function vd() {
  return vd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, vd.apply(this, arguments);
}
const $$ = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    trigger: o = ["hover"],
    mouseEnterDelay: i = 0,
    mouseLeaveDelay: l = 0.1,
    prefixCls: c = "rc-tooltip",
    children: f,
    onVisibleChange: p,
    afterVisibleChange: g,
    motion: m,
    placement: y = "right",
    align: v = {},
    destroyOnHidden: w = !1,
    defaultVisible: x,
    getTooltipContainer: b,
    arrowContent: C,
    overlay: E,
    id: P,
    showArrow: N = !0,
    classNames: _,
    styles: R,
    ...M
  } = e, F = ol(P), O = h.useRef(null);
  h.useImperativeHandle(n, () => O.current);
  const z = {
    ...M
  };
  "visible" in e && (z.popupVisible = e.visible);
  const H = h.useMemo(() => {
    if (!N)
      return !1;
    const V = N === !0 ? {} : N;
    return {
      ...V,
      className: we(V.className, _?.arrow),
      style: {
        ...V.style,
        ...R?.arrow
      },
      content: V.content ?? C
    };
  }, [N, _?.arrow, R?.arrow, C]), Y = ({
    open: V
  }) => {
    const X = h.Children.only(f), Q = {
      "aria-describedby": E && V ? F : void 0
    };
    return /* @__PURE__ */ h.cloneElement(X, Q);
  };
  return /* @__PURE__ */ h.createElement(Pb, vd({
    popupClassName: _?.root,
    prefixCls: c,
    popup: /* @__PURE__ */ h.createElement(vv, {
      key: "content",
      prefixCls: c,
      id: F,
      classNames: _,
      styles: R
    }, E),
    action: o,
    builtinPlacements: E$,
    popupPlacement: y,
    ref: O,
    popupAlign: v,
    getPopupContainer: b,
    onOpenChange: p,
    afterOpenChange: g,
    popupMotion: m,
    defaultPopupVisible: x,
    autoDestroy: w,
    mouseLeaveDelay: l,
    popupStyle: R?.root,
    mouseEnterDelay: i,
    arrow: H,
    uniqueContainerClassName: _?.uniqueContainer,
    uniqueContainerStyle: R?.uniqueContainer
  }, z), Y);
});
function P$(e) {
  const {
    sizePopupArrow: n,
    borderRadiusXS: o,
    borderRadiusOuter: i
  } = e, l = n / 2, c = 0, f = l, p = i * 1 / Math.sqrt(2), g = l - i * (1 - 1 / Math.sqrt(2)), m = l - o * (1 / Math.sqrt(2)), y = i * (Math.sqrt(2) - 1) + o * (1 / Math.sqrt(2)), v = 2 * l - m, w = y, x = 2 * l - p, b = g, C = 2 * l - c, E = f, P = l * Math.sqrt(2) + i * (Math.sqrt(2) - 2), N = i * (Math.sqrt(2) - 1), _ = `polygon(${N}px 100%, 50% ${N}px, ${2 * l - N}px 100%, ${N}px 100%)`, R = `path('M ${c} ${f} A ${i} ${i} 0 0 0 ${p} ${g} L ${m} ${y} A ${o} ${o} 0 0 1 ${v} ${w} L ${x} ${b} A ${i} ${i} 0 0 0 ${C} ${E} Z')`;
  return {
    arrowShadowWidth: P,
    arrowPath: R,
    arrowPolygon: _
  };
}
const _$ = (e, n, o) => {
  const {
    sizePopupArrow: i,
    arrowPolygon: l,
    arrowPath: c,
    arrowShadowWidth: f,
    borderRadiusXS: p,
    calc: g
  } = e, m = {
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
  return o && (m.boxShadow = o), {
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
    "&::after": m
  };
}, Sv = 8;
function wv(e) {
  const {
    contentRadius: n,
    limitVerticalRadius: o
  } = e, i = n > 12 ? n + 2 : 12;
  return {
    arrowOffsetHorizontal: i,
    arrowOffsetVertical: o ? Sv : i
  };
}
const R$ = (e, n, o) => {
  const {
    componentCls: i,
    boxShadowPopoverArrow: l,
    arrowOffsetVertical: c,
    arrowOffsetHorizontal: f,
    antCls: p
  } = e, [g] = sl(p, "tooltip"), {
    arrowDistance: m = 0,
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
        ..._$(e, n, y ? l : !1),
        "&:before": {
          background: n
        }
      }],
      // ========================== Placement ==========================
      // Here handle the arrow position and rotate stuff
      // >>>>> Top
      [[`&-placement-top > ${i}-arrow`, `&-placement-topLeft > ${i}-arrow`, `&-placement-topRight > ${i}-arrow`].join(",")]: {
        bottom: m,
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
        top: m,
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
          value: m
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
          value: m
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
function N$(e, n, o, i) {
  if (i === !1)
    return {
      adjustX: !1,
      adjustY: !1
    };
  const l = Ur(i) ? i : {}, c = {};
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
const r0 = {
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
}, k$ = {
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
}, T$ = /* @__PURE__ */ new Set(["topLeft", "topRight", "bottomLeft", "bottomRight", "leftTop", "leftBottom", "rightTop", "rightBottom"]);
function M$(e) {
  const {
    arrowWidth: n,
    autoAdjustOverflow: o,
    arrowPointAtCenter: i,
    offset: l,
    borderRadius: c
  } = e, f = n / 2, p = {}, g = wv({
    contentRadius: c,
    limitVerticalRadius: !0
  });
  return Object.keys(r0).forEach((m) => {
    const v = {
      ...i && k$[m] || r0[m],
      offset: [0, 0],
      dynamicInset: !0
    };
    switch (p[m] = v, T$.has(m) && (v.autoArrow = !1), m) {
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
      switch (m) {
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
    v.overflow = N$(m, g, n, o), v.htmlRegion = "visibleFirst";
  }), p;
}
const I$ = /* @__PURE__ */ ye.createContext(!1), F$ = (e, n) => {
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
}, o0 = "50%", O$ = (e) => {
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
    dropShadowPopover: m,
    paddingSM: y,
    paddingXS: v,
    arrowOffsetHorizontal: w,
    sizePopupArrow: x,
    antCls: b
  } = e, [C, E] = sl(b, "tooltip"), P = n(f).add(x).add(w).equal(), _ = {
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
    transformOrigin: [E("valid-offset-x", o0), `var(--arrow-y, ${o0})`].join(" ")
  };
  return [
    {
      [o]: {
        ...Vr(e),
        position: "absolute",
        zIndex: p,
        display: "block",
        width: "max-content",
        maxWidth: i,
        visibility: "visible",
        filter: m,
        ...R,
        "&-hidden": {
          display: "none"
        },
        [C("arrow-background-color")]: c,
        // Wrapper for the tooltip content
        [`${o}-container`]: [_, Zb(e, !0)],
        [`&:has(~ ${o}-unique-container)`]: {
          [`${o}-container`]: {
            border: "none",
            background: "transparent"
          }
        },
        // Align placement should have another min width
        [["&-placement-topLeft", "&-placement-topRight", "&-placement-bottomLeft", "&-placement-bottomRight"].join(",")]: {
          minWidth: P
        },
        // Limit left and right placement radius
        [["&-placement-left", "&-placement-leftTop", "&-placement-leftBottom", "&-placement-right", "&-placement-rightTop", "&-placement-rightBottom"].join(",")]: {
          [`${o}-inner`]: {
            borderRadius: e.min(f, Sv)
          }
        },
        [`${o}-content`]: {
          position: "relative"
        },
        // generator for preset color
        ...sx(e, (M, {
          darkColor: F
        }) => ({
          [`&${o}-${M}`]: {
            [`${o}-container`]: {
              backgroundColor: F
            },
            [`${o}-arrow`]: {
              [C("arrow-background-color")]: F
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
    R$(e, E("arrow-background-color"), {
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
        ..._,
        ...R,
        position: "absolute",
        zIndex: n(p).sub(1).equal(),
        filter: m,
        "&-hidden": {
          display: "none"
        },
        "&-visible": {
          transition: `all ${e.motionDurationSlow}`
        }
      }
    }
  ];
}, z$ = (e) => ({
  zIndexPopup: e.zIndexPopupBase + 70,
  maxWidth: 250,
  ...wv({
    contentRadius: e.borderRadius,
    limitVerticalRadius: !0
  }),
  ...P$(tr(e, {
    borderRadiusOuter: Math.min(e.borderRadiusOuter, 4)
  }))
}), Cv = (e, n, o = !0) => Wr("Tooltip", (l) => {
  const {
    borderRadius: c,
    colorTextLightSolid: f,
    colorBgSpotlight: p,
    maxWidth: g
  } = l, m = tr(l, {
    // default variables
    tooltipMaxWidth: g,
    tooltipColor: f,
    tooltipBorderRadius: c,
    tooltipBg: p
  });
  return [O$(m), uE(l, "zoom-big-fast")];
}, z$, {
  resetStyle: !1,
  // Popover use Tooltip as internal component. We do not need to handle this.
  injectStyle: o
})(e, n), A$ = Fi.map((e) => `${e}-inverse`);
function L$(e, n = !0) {
  return n ? [].concat(el(A$), el(Fi)).includes(e) : Fi.includes(e);
}
const xv = (e, n, o) => {
  const i = L$(o), [l] = sl(e, "tooltip"), c = we({
    [`${n}-${o}`]: o && i
  }), f = {}, p = {}, g = mE(o).toRgb(), y = (0.299 * g.r + 0.587 * g.g + 0.114 * g.b) / 255 < 0.5 ? "#FFF" : "#000";
  return o && !i && (f.background = o, f[l("overlay-color")] = y, p[l("arrow-background-color")] = o), {
    className: c,
    overlayStyle: f,
    arrowStyle: p
  };
}, B$ = (e) => {
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
    getPrefixCls: m
  } = h.useContext(On), y = m("tooltip", n), v = m(), w = Qd(y), [x, b] = Cv(y, w), C = xv(v, y, c), E = C.arrowStyle, P = h.useMemo(() => ({
    container: {
      ...f,
      ...C.overlayStyle
    }
  }), [f, C.overlayStyle]), N = {
    ...e,
    placement: i
  }, [_, R] = al([p], [P, g], {
    props: N
  }), M = we(w, x, b, y, `${y}-pure`, `${y}-placement-${i}`, o, C.className);
  return /* @__PURE__ */ h.createElement("div", {
    className: M,
    style: E
  }, /* @__PURE__ */ h.createElement("div", {
    className: `${y}-arrow`
  }), /* @__PURE__ */ h.createElement(vv, {
    ...e,
    className: x,
    prefixCls: y,
    classNames: _,
    styles: R
  }, l));
}, D$ = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    prefixCls: o,
    openClassName: i,
    getTooltipContainer: l,
    color: c,
    children: f,
    afterOpenChange: p,
    arrow: g,
    destroyTooltipOnHide: m,
    destroyOnHidden: y,
    title: v,
    overlay: w,
    trigger: x,
    builtinPlacements: b,
    autoAdjustOverflow: C = !0,
    motion: E,
    getPopupContainer: P,
    placement: N = "top",
    mouseEnterDelay: _ = 0.1,
    mouseLeaveDelay: R = 0.1,
    rootClassName: M,
    styles: F,
    classNames: O,
    onOpenChange: z,
    // Legacy
    overlayInnerStyle: H,
    overlayStyle: Y,
    overlayClassName: V,
    ...X
  } = e, [, Q] = Wi(), oe = e["data-popover-inject"], {
    getPopupContainer: G,
    getPrefixCls: le,
    direction: he,
    ...j
  } = Qo("tooltip"), {
    className: J,
    style: U,
    classNames: k,
    styles: A,
    arrow: ee,
    trigger: te
  } = oe ? {} : j, se = F$(g, ee), re = se.show, fe = x || te || "hover", ie = P || G, Z = y ?? !!m, ae = h.useContext(I$), ce = h.useRef(null), ke = () => {
    ce.current?.forceAlign();
  };
  h.useImperativeHandle(n, () => ({
    forceAlign: ke,
    nativeElement: ce.current?.nativeElement,
    popupElement: ce.current?.popupElement
  }));
  const [qe, Qe] = Zs(e.defaultOpen ?? !1, e.open), Ne = !v && !w && v !== 0, Xe = (nt) => {
    Qe(Ne ? !1 : nt), !Ne && z && z(nt);
  }, ut = h.useMemo(() => b || M$({
    arrowPointAtCenter: se?.pointAtCenter ?? !1,
    autoAdjustOverflow: C,
    arrowWidth: re ? Q.sizePopupArrow : 0,
    borderRadius: Q.borderRadius,
    offset: Q.marginXXS
  }), [se, b, Q, re, C]), ze = h.useMemo(() => v === 0 ? v : w || v || "", [w, v]), xt = /* @__PURE__ */ h.createElement(gv, {
    space: !0,
    form: !0
  }, Ui(ze) ? ze() : ze), Ze = {
    ...e,
    trigger: fe,
    builtinPlacements: ut,
    getPopupContainer: ie,
    destroyOnHidden: Z
  }, [tt, He] = al([k, O], [A, F], {
    props: Ze
  }), Je = le("tooltip", o), ft = le();
  let fn = qe;
  (!("open" in e) && Ne || ae) && (fn = !1);
  const Rt = /* @__PURE__ */ h.isValidElement(f) && !_b(f) ? f : /* @__PURE__ */ h.createElement("span", null, f), Wt = Rt.props, Ut = !Wt.className || typeof Wt.className == "string" ? we(Wt.className, i || `${Je}-open`) : Wt.className, Nt = Qd(Je), [mt, kt] = Cv(Je, Nt, !oe), Ue = xv(ft, Je, c), Yt = Ue.arrowStyle, Ve = we(Nt, mt, kt), Ae = we(V, {
    [`${Je}-rtl`]: he === "rtl"
  }, Ue.className, M, Ve, J, tt.root), [Oe, Ge] = Vb("Tooltip", X.zIndex), gt = {
    ...He.container,
    ...H,
    ...Ue.overlayStyle
  }, qt = /* @__PURE__ */ h.createElement($$, {
    unique: !0,
    ...X,
    zIndex: Oe,
    showArrow: re,
    placement: N,
    mouseEnterDelay: _,
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
        ...Yt,
        ...He.root,
        ...U,
        ...Y
      },
      container: gt,
      uniqueContainer: gt,
      arrow: He.arrow
    },
    ref: ce,
    overlay: xt,
    visible: fn,
    onVisibleChange: Xe,
    afterVisibleChange: p,
    arrowContent: /* @__PURE__ */ h.createElement("span", {
      className: `${Je}-arrow-content`
    }),
    motion: {
      motionName: Wb(ft, "zoom-big-fast", typeof E?.motionName == "string" ? E?.motionName : void 0),
      motionDeadline: 1e3
    },
    trigger: fe,
    builtinPlacements: ut,
    getTooltipContainer: ie,
    destroyOnHidden: Z
  }, fn ? ov(Rt, {
    className: Ut
  }) : Rt);
  return /* @__PURE__ */ h.createElement(lv.Provider, {
    value: Ge
  }, qt);
}), Bi = D$;
Bi._InternalPanelDoNotUseOrYouWillBeFired = B$;
Bi.UniqueProvider = iv;
function ep(e) {
  return tr(e, {
    inputAffixPadding: e.paddingXXS
  });
}
const tp = (e) => {
  const {
    controlHeight: n,
    fontSize: o,
    lineHeight: i,
    lineWidth: l,
    controlHeightSM: c,
    controlHeightLG: f,
    fontSizeLG: p,
    lineHeightLG: g,
    paddingSM: m,
    controlPaddingHorizontalSM: y,
    controlPaddingHorizontal: v,
    colorFillAlter: w,
    colorPrimaryHover: x,
    colorPrimary: b,
    controlOutlineWidth: C,
    controlOutline: E,
    colorErrorOutline: P,
    colorWarningOutline: N,
    colorBgContainer: _,
    inputFontSize: R,
    inputFontSizeLG: M,
    inputFontSizeSM: F
  } = e, O = R || o, z = F || O, H = M || p, Y = Math.round((n - O * i) / 2 * 10) / 10 - l, V = Math.round((c - z * i) / 2 * 10) / 10 - l, X = Math.ceil((f - H * g) / 2 * 10) / 10 - l;
  return {
    paddingBlock: Math.max(Y, 0),
    paddingBlockSM: Math.max(V, 0),
    paddingBlockLG: Math.max(X, 0),
    paddingInline: m - l,
    paddingInlineSM: y - l,
    paddingInlineLG: v - l,
    addonBg: w,
    activeBorderColor: b,
    hoverBorderColor: x,
    activeShadow: `0 0 0 ${C}px ${E}`,
    errorActiveShadow: `0 0 0 ${C}px ${P}`,
    warningActiveShadow: `0 0 0 ${C}px ${N}`,
    hoverBg: _,
    activeBg: _,
    inputFontSize: O,
    inputFontSizeLG: H,
    inputFontSizeSM: z
  };
}, j$ = (e) => ({
  borderColor: e.hoverBorderColor,
  backgroundColor: e.hoverBg
}), np = (e) => ({
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
    ...j$(tr(e, {
      hoverBorderColor: e.colorBorderDisabled,
      hoverBg: e.colorBgContainerDisabled
    }))
  }
}), bv = (e, n) => ({
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
}), i0 = (e, n) => ({
  [`&${e.componentCls}-status-${n.status}:not(${e.componentCls}-disabled)`]: {
    ...bv(e, n),
    [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
      color: n.affixColor
    }
  },
  [`&${e.componentCls}-status-${n.status}${e.componentCls}-disabled`]: {
    borderColor: n.borderColor
  }
}), Ev = (e, n) => ({
  "&-outlined": {
    ...bv(e, {
      borderColor: e.colorBorder,
      hoverBorderColor: e.hoverBorderColor,
      activeBorderColor: e.activeBorderColor,
      activeShadow: e.activeShadow
    }),
    [`&${e.componentCls}-disabled, &[disabled]`]: {
      ...np(e)
    },
    ...i0(e, {
      status: "error",
      borderColor: e.colorError,
      hoverBorderColor: e.colorErrorBorderHover,
      activeBorderColor: e.colorError,
      activeShadow: e.errorActiveShadow,
      affixColor: e.colorErrorAffix
    }),
    ...i0(e, {
      status: "warning",
      borderColor: e.colorWarning,
      hoverBorderColor: e.colorWarningBorderHover,
      activeBorderColor: e.colorWarning,
      activeShadow: e.warningActiveShadow,
      affixColor: e.colorWarningAffix
    }),
    ...n
  }
}), s0 = (e, n) => ({
  [`&${e.componentCls}-group-wrapper-status-${n.status}`]: {
    [`${e.componentCls}-group-addon`]: {
      borderColor: n.addonBorderColor,
      color: n.addonColor
    }
  }
}), H$ = (e) => ({
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
    ...s0(e, {
      status: "error",
      addonBorderColor: e.colorError,
      addonColor: e.colorErrorText
    }),
    ...s0(e, {
      status: "warning",
      addonBorderColor: e.colorWarning,
      addonColor: e.colorWarningText
    }),
    [`&${e.componentCls}-group-wrapper-disabled`]: {
      [`${e.componentCls}-group-addon`]: {
        ...np(e)
      }
    }
  }
}), $v = "&:focus-visible, &:has(input:focus-visible), &:has(textarea:focus-visible)", Pv = (e, n) => ({
  outline: `${$e(e.lineWidth)} ${e.lineType} ${n}`,
  outlineOffset: $e(e.calc(e.lineWidth).mul(-1).equal()),
  transition: ["outline-offset", "outline"].map((o) => `${o} 0s`).join(", ")
}), l0 = (e, n) => ({
  "&, & input, & textarea": {
    color: n.color
  },
  [$v]: Pv(e, n.color),
  [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
    color: n.affixColor
  }
}), _v = (e, n) => {
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
      [$v]: Pv(e, e.activeBorderColor),
      // >>>>> Disabled
      [`&${o}-disabled, &[disabled]`]: {
        color: e.colorTextDisabled,
        cursor: "not-allowed"
      },
      // >>>>> Status
      [`&${o}-status-error`]: l0(e, {
        color: e.colorError,
        affixColor: e.colorErrorAffix
      }),
      [`&${o}-status-warning`]: l0(e, {
        color: e.colorWarning,
        affixColor: e.colorWarningAffix
      }),
      ...n
    }
  };
}, Rv = (e, n) => ({
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
}), a0 = (e, n) => ({
  [`&${e.componentCls}-status-${n.status}:not(${e.componentCls}-disabled)`]: {
    ...Rv(e, n),
    [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
      color: n.affixColor
    }
  }
}), Nv = (e, n) => ({
  "&-filled": {
    ...Rv(e, {
      bg: e.colorFillTertiary,
      hoverBg: e.colorFillSecondary,
      activeBorderColor: e.activeBorderColor,
      inputColor: e.colorText
    }),
    [`&${e.componentCls}-disabled, &[disabled]`]: {
      ...np(e)
    },
    ...a0(e, {
      status: "error",
      bg: e.colorErrorBg,
      hoverBg: e.colorErrorBgHover,
      activeBorderColor: e.colorError,
      inputColor: e.colorErrorText,
      affixColor: e.colorErrorAffix
    }),
    ...a0(e, {
      status: "warning",
      bg: e.colorWarningBg,
      hoverBg: e.colorWarningBgHover,
      activeBorderColor: e.colorWarning,
      inputColor: e.colorWarningText,
      affixColor: e.colorWarningAffix
    }),
    ...n
  }
}), c0 = (e, n) => ({
  [`&${e.componentCls}-group-wrapper-status-${n.status}`]: {
    [`${e.componentCls}-group-addon`]: {
      background: n.addonBg,
      color: n.addonColor
    }
  }
}), V$ = (e) => ({
  "&-filled": {
    [`${e.componentCls}-group-addon`]: {
      background: e.colorFillTertiary,
      "&:last-child": {
        position: "static"
      }
    },
    ...c0(e, {
      status: "error",
      addonBg: e.colorErrorBg,
      addonColor: e.colorErrorText
    }),
    ...c0(e, {
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
}), kv = (e, n) => ({
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
}), u0 = (e, n) => ({
  [`&${e.componentCls}-status-${n.status}:not(${e.componentCls}-disabled)`]: {
    ...kv(e, n),
    [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
      color: n.affixColor
    }
  },
  [`&${e.componentCls}-status-${n.status}${e.componentCls}-disabled`]: {
    borderColor: `transparent transparent ${n.borderColor} transparent`
  }
}), Tv = (e, n) => ({
  "&-underlined": {
    ...kv(e, {
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
    ...u0(e, {
      status: "error",
      borderColor: e.colorError,
      hoverBorderColor: e.colorErrorBorderHover,
      activeBorderColor: e.colorError,
      activeShadow: e.errorActiveShadow,
      affixColor: e.colorErrorAffix
    }),
    ...u0(e, {
      status: "warning",
      borderColor: e.colorWarning,
      hoverBorderColor: e.colorWarningBorderHover,
      activeBorderColor: e.colorWarning,
      activeShadow: e.warningActiveShadow,
      affixColor: e.colorWarningAffix
    }),
    ...n
  }
}), Mv = (e) => ({
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
}), Iv = (e) => {
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
}, Fv = (e) => ({
  padding: `${$e(e.paddingBlockSM)} ${$e(e.paddingInlineSM)}`,
  fontSize: e.inputFontSizeSM,
  borderRadius: e.borderRadiusSM
}), rp = (e, n = {}) => ({
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
  ...Mv(e.colorTextPlaceholder),
  // Size
  "&-lg": {
    ...Iv(e),
    ...n.largeStyle
  },
  "&-sm": {
    ...Fv(e),
    ...n.smallStyle
  },
  // RTL
  "&-rtl, &-textarea-rtl": {
    direction: "rtl"
  }
}), W$ = (e) => {
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
      ...Iv(e)
    },
    [`&-sm ${n}, &-sm > ${n}-group-addon`]: {
      ...Fv(e)
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
      ...rx(),
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
}, U$ = (e) => {
  const {
    componentCls: n,
    controlHeightSM: o,
    lineWidth: i,
    calc: l
  } = e, f = l(o).sub(l(i).mul(2)).sub(16).div(2).equal();
  return {
    [n]: {
      ...Vr(e),
      ...rp(e),
      // Variants
      ...Ev(e),
      ...Nv(e),
      ..._v(e),
      ...Tv(e),
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
}, q$ = (e) => {
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
        ...qd(e)
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
}, X$ = (e) => {
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
      ...rp(e),
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
      ...q$(e)
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
}, G$ = (e) => {
  const {
    componentCls: n,
    borderRadiusLG: o,
    borderRadiusSM: i
  } = e;
  return {
    [`${n}-group`]: {
      // Style for input-group: input with label, with button or dropdown...
      ...Vr(e),
      ...W$(e),
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
        ...H$(e),
        ...V$(e),
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
}, Y$ = (e) => {
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
Wr(["Input", "Shared"], (e) => {
  const n = tr(e, ep(e));
  return [U$(n), X$(n)];
}, tp, {
  resetFont: !1
});
Wr(["Input", "Component"], (e) => {
  const n = tr(e, ep(e));
  return [
    G$(n),
    Y$(n),
    // =====================================================
    // ==             Space Compact                       ==
    // =====================================================
    Jd(n, {
      focus: !0,
      focusElCls: `${n.componentCls}-affix-wrapper-focused`
    })
  ];
}, tp, {
  resetFont: !1
});
var Na = {}, f0;
function K$() {
  if (f0) return Na;
  f0 = 1, Object.defineProperty(Na, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M482 152h60q8 0 8 8v704q0 8-8 8h-60q-8 0-8-8V160q0-8 8-8z" } }, { tag: "path", attrs: { d: "M192 474h672q8 0 8 8v60q0 8-8 8H160q-8 0-8-8v-60q0-8 8-8z" } }] }, name: "plus", theme: "outlined" };
  return Na.default = e, Na;
}
var Q$ = /* @__PURE__ */ K$();
const Z$ = /* @__PURE__ */ er(Q$);
function Sd() {
  return Sd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Sd.apply(this, arguments);
}
const J$ = (e, n) => /* @__PURE__ */ h.createElement(Pr, Sd({}, e, {
  ref: n,
  icon: Z$
})), e2 = /* @__PURE__ */ h.forwardRef(J$), d0 = (e, n) => {
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
}, br = (e) => e !== void 0 ? `${e}px` : void 0;
function t2(e) {
  const {
    prefixCls: n,
    containerRef: o,
    value: i,
    getValueIndex: l,
    motionName: c,
    onMotionStart: f,
    onMotionEnd: p,
    direction: g,
    vertical: m = !1
  } = e, y = h.useRef(null), [v, w] = h.useState(i), x = (O) => {
    const z = l(O), H = o.current?.querySelectorAll(`.${n}-item`)[z];
    return H?.offsetParent && H;
  }, [b, C] = h.useState(null), [E, P] = h.useState(null);
  un(() => {
    if (v !== i) {
      const O = x(v), z = x(i), H = d0(O, m), Y = d0(z, m);
      w(i), C(H), P(Y), O && z ? f() : p();
    }
  }, [i]);
  const N = h.useMemo(() => br(m ? b?.top ?? 0 : g === "rtl" ? -b?.right : b?.left), [m, g, b]), _ = h.useMemo(() => br(m ? E?.top ?? 0 : g === "rtl" ? -E?.right : E?.left), [m, g, E]), R = () => m ? {
    transform: "translateY(var(--thumb-start-top))",
    height: "var(--thumb-start-height)"
  } : {
    transform: "translateX(var(--thumb-start-left))",
    width: "var(--thumb-start-width)"
  }, M = () => m ? {
    transform: "translateY(var(--thumb-active-top))",
    height: "var(--thumb-active-height)"
  } : {
    transform: "translateX(var(--thumb-active-left))",
    width: "var(--thumb-active-width)"
  }, F = () => {
    C(null), P(null), p();
  };
  return !b || !E ? null : /* @__PURE__ */ h.createElement(ll, {
    visible: !0,
    motionName: c,
    motionAppear: !0,
    onAppearStart: R,
    onAppearActive: M,
    onVisibleChanged: F
  }, ({
    className: O,
    style: z
  }, H) => {
    const Y = {
      ...z,
      "--thumb-start-left": N,
      "--thumb-start-width": br(b?.width),
      "--thumb-active-left": _,
      "--thumb-active-width": br(E?.width),
      "--thumb-start-top": N,
      "--thumb-start-height": br(b?.height),
      "--thumb-active-top": _,
      "--thumb-active-height": br(E?.height)
    }, V = {
      ref: il(y, H),
      style: Y,
      className: we(`${n}-thumb`, O)
    };
    return /* @__PURE__ */ h.createElement("div", V);
  });
}
function n2(e) {
  if (typeof e.title < "u")
    return e.title;
  if (typeof e.label != "object")
    return e.label?.toString();
}
function r2(e) {
  return e.map((n) => {
    if (typeof n == "object" && n !== null) {
      const o = n2(n);
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
const o2 = ({
  prefixCls: e,
  className: n,
  style: o,
  styles: i,
  classNames: l,
  data: c,
  disabled: f,
  checked: p,
  label: g,
  title: m,
  value: y,
  name: v,
  onChange: w,
  onFocus: x,
  onBlur: b,
  onKeyDown: C,
  onKeyUp: E,
  onMouseDown: P,
  itemRender: N = (_) => _
}) => {
  const _ = (M) => {
    f || w(M, y);
  }, R = /* @__PURE__ */ h.createElement("label", {
    className: we(n, {
      [`${e}-item-disabled`]: f
    }),
    style: o,
    onMouseDown: P
  }, /* @__PURE__ */ h.createElement("input", {
    name: v,
    className: `${e}-item-input`,
    type: "radio",
    disabled: f,
    checked: p,
    onChange: _,
    onFocus: x,
    onBlur: b,
    onKeyDown: C,
    onKeyUp: E
  }), /* @__PURE__ */ h.createElement("div", {
    className: we(`${e}-item-label`, l?.label),
    title: m,
    style: i?.label
  }, g));
  return N(R, {
    item: c
  });
}, i2 = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    prefixCls: o = "rc-segmented",
    direction: i,
    vertical: l,
    options: c = [],
    disabled: f,
    defaultValue: p,
    value: g,
    name: m,
    onChange: y,
    className: v = "",
    style: w,
    styles: x,
    classNames: b,
    motionName: C = "thumb-motion",
    itemRender: E,
    ...P
  } = e, N = h.useRef(null), _ = h.useMemo(() => il(N, n), [N, n]), R = h.useMemo(() => r2(c), [c]), [M, F] = Zs(p ?? R[0]?.value, g), [O, z] = h.useState(!1), H = (A, ee) => {
    F(ee), y?.(ee);
  }, Y = Va(P, ["children"]), [V, X] = h.useState(!1), [Q, oe] = h.useState(!1), G = () => {
    oe(!0);
  }, le = () => {
    oe(!1);
  }, he = () => {
    X(!1);
  }, j = (A) => {
    A.key === "Tab" && X(!0);
  }, J = (A) => {
    const ee = R.findIndex((fe) => fe.value === M), te = R.length, se = (ee + A + te) % te, re = R[se];
    re && (F(re.value), y?.(re.value));
  }, U = (A) => {
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
  }, k = (A) => {
    const {
      value: ee,
      disabled: te
    } = A;
    return /* @__PURE__ */ h.createElement(o2, Ga({}, A, {
      name: m,
      data: A,
      itemRender: E,
      key: ee,
      prefixCls: o,
      className: we(A.className, `${o}-item`, b?.item, {
        [`${o}-item-selected`]: ee === M && !O,
        [`${o}-item-focused`]: Q && V && ee === M
      }),
      style: x?.item,
      classNames: b,
      styles: x,
      checked: ee === M,
      onChange: H,
      onFocus: G,
      onBlur: le,
      onKeyDown: U,
      onKeyUp: j,
      onMouseDown: he,
      disabled: !!f || !!te
    }));
  };
  return /* @__PURE__ */ h.createElement("div", Ga({
    role: "radiogroup",
    "aria-label": "segmented control",
    tabIndex: f ? void 0 : 0,
    "aria-orientation": l ? "vertical" : "horizontal",
    style: w
  }, Y, {
    className: we(o, {
      [`${o}-rtl`]: i === "rtl",
      [`${o}-disabled`]: f,
      [`${o}-vertical`]: l
    }, v),
    ref: _
  }), /* @__PURE__ */ h.createElement("div", {
    className: `${o}-group`
  }, /* @__PURE__ */ h.createElement(t2, {
    vertical: l,
    prefixCls: o,
    value: M,
    containerRef: N,
    motionName: `${o}-${C}`,
    direction: i,
    getValueIndex: (A) => R.findIndex((ee) => ee.value === A),
    onMotionStart: () => {
      z(!0);
    },
    onMotionEnd: () => {
      z(!1);
    }
  }), R.map(k)));
}), s2 = i2;
function p0(e, n) {
  return {
    [`${e}, ${e}:hover, ${e}:focus`]: {
      color: n.colorTextDisabled,
      cursor: "not-allowed"
    }
  };
}
const h0 = (e) => ({
  background: e.itemSelectedBg,
  boxShadow: e.boxShadowTertiary
}), l2 = {
  overflow: "hidden",
  // handle text ellipsis
  ...tx
}, a2 = (e) => {
  const {
    componentCls: n,
    motionDurationSlow: o,
    motionEaseInOut: i,
    motionDurationMid: l
  } = e, c = e.calc(e.controlHeight).sub(e.calc(e.trackPadding).mul(2)).equal(), f = e.calc(e.controlHeightLG).sub(e.calc(e.trackPadding).mul(2)).equal(), p = e.calc(e.controlHeightSM).sub(e.calc(e.trackPadding).mul(2)).equal();
  return {
    [n]: {
      ...Vr(e),
      display: "inline-block",
      padding: e.trackPadding,
      color: e.itemColor,
      background: e.trackBg,
      borderRadius: e.borderRadius,
      transition: `all ${l}`,
      ...Ty(e),
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
          ...h0(e),
          color: e.itemSelectedColor
        },
        "&-focused": qd(e),
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
          ...l2
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
        ...h0(e),
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
      ...p0(`&-disabled ${n}-item`, e),
      ...p0(`${n}-item-disabled`, e),
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
}, c2 = (e) => {
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
}, u2 = Wr("Segmented", (e) => {
  const {
    lineWidth: n,
    calc: o
  } = e, i = tr(e, {
    segmentedPaddingHorizontal: o(e.controlPaddingHorizontal).sub(n).equal(),
    segmentedPaddingHorizontalSM: o(e.controlPaddingHorizontalSM).sub(n).equal()
  });
  return a2(i);
}, c2);
function f2(e) {
  return Ur(e) && !!e?.icon;
}
const d2 = /* @__PURE__ */ h.forwardRef((e, n) => {
  const o = ol(), {
    prefixCls: i,
    className: l,
    rootClassName: c,
    block: f,
    options: p = [],
    size: g,
    style: m,
    vertical: y,
    orientation: v,
    shape: w = "default",
    name: x = o,
    styles: b,
    classNames: C,
    ...E
  } = e, {
    getPrefixCls: P,
    direction: N,
    className: _,
    style: R,
    classNames: M,
    styles: F
  } = Qo("segmented"), O = {
    ...e,
    options: p,
    size: g,
    shape: w
  }, z = zi(R), H = zi(m), [Y, V] = al([M, C], [F, z, b, H], {
    props: O
  }), X = P("segmented", i), [Q, oe] = u2(X), G = fc(g), le = h.useMemo(() => p.map((U) => {
    if (f2(U)) {
      const {
        icon: k,
        label: A,
        ...ee
      } = U;
      return {
        ...ee,
        label: /* @__PURE__ */ h.createElement(h.Fragment, null, /* @__PURE__ */ h.createElement("span", {
          className: we(`${X}-item-icon`, Y.icon),
          style: V.icon
        }, k), A && /* @__PURE__ */ h.createElement("span", null, A))
      };
    }
    return U;
  }), [p, X, Y.icon, V.icon]), [, he] = sv(v, y), j = we(l, c, _, Y.root, {
    [`${X}-block`]: f,
    [`${X}-sm`]: G === "small",
    [`${X}-lg`]: G === "large",
    [`${X}-vertical`]: he,
    [`${X}-shape-${w}`]: w === "round"
  }, Q, oe), J = (U, {
    item: k
  }) => {
    if (!k.tooltip)
      return U;
    const A = Ur(k.tooltip) ? k.tooltip : {
      title: k.tooltip
    };
    return /* @__PURE__ */ h.createElement(Bi, {
      ...A
    }, U);
  };
  return /* @__PURE__ */ h.createElement(s2, {
    ...E,
    name: x,
    className: j,
    style: V.root,
    classNames: Y,
    styles: V,
    itemRender: J,
    options: le,
    ref: n,
    prefixCls: X,
    direction: N,
    vertical: he
  });
}), p2 = d2;
var ka = {}, m0;
function h2() {
  if (m0) return ka;
  m0 = 1, Object.defineProperty(ka, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M872 474H152c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h720c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8z" } }] }, name: "minus", theme: "outlined" };
  return ka.default = e, ka;
}
var m2 = /* @__PURE__ */ h2();
const g2 = /* @__PURE__ */ er(m2);
function wd() {
  return wd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, wd.apply(this, arguments);
}
const y2 = (e, n) => /* @__PURE__ */ h.createElement(Pr, wd({}, e, {
  ref: n,
  icon: g2
})), v2 = /* @__PURE__ */ h.forwardRef(y2);
var Ta = {}, g0;
function S2() {
  if (g0) return Ta;
  g0 = 1, Object.defineProperty(Ta, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M890.5 755.3L537.9 269.2c-12.8-17.6-39-17.6-51.7 0L133.5 755.3A8 8 0 00140 768h75c5.1 0 9.9-2.5 12.9-6.6L512 369.8l284.1 391.6c3 4.1 7.8 6.6 12.9 6.6h75c6.5 0 10.3-7.4 6.5-12.7z" } }] }, name: "up", theme: "outlined" };
  return Ta.default = e, Ta;
}
var w2 = /* @__PURE__ */ S2();
const C2 = /* @__PURE__ */ er(w2);
function Cd() {
  return Cd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Cd.apply(this, arguments);
}
const x2 = (e, n) => /* @__PURE__ */ h.createElement(Pr, Cd({}, e, {
  ref: n,
  icon: C2
})), b2 = /* @__PURE__ */ h.forwardRef(x2);
function xd() {
  return typeof BigInt == "function";
}
function Ov(e) {
  return !e && e !== 0 && !Number.isNaN(e) || !String(e).trim();
}
function qo(e) {
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
function pc(e) {
  var n = String(e);
  return !Number.isNaN(Number(n)) && n.includes("e");
}
function zv(e) {
  var n = e.toLowerCase().split("e"), o = Wa(n, 2), i = o[0], l = o[1], c = l === void 0 ? "0" : l, f = i.startsWith("-"), p = f ? i.slice(1) : i, g = p.split("."), m = Wa(g, 2), y = m[0], v = y === void 0 ? "0" : y, w = m[1], x = w === void 0 ? "" : w, b = "".concat(v).concat(x).replace(/^0+/, "") || "0";
  return {
    decimal: x,
    digits: b,
    exponent: Number(c),
    integer: v,
    negative: f
  };
}
function E2(e) {
  var n = e.decimal, o = e.digits, i = e.exponent, l = e.integer, c = e.negative;
  if (o === "0")
    return "0";
  var f = l.replace(/^0+/, "").length, p = (n.match(/^0*/) || [""])[0].length, g = f || -p, m = g + i, y = "";
  return m <= 0 ? y = "0.".concat("0".repeat(-m)).concat(o) : m >= o.length ? y = "".concat(o).concat("0".repeat(m - o.length)) : y = "".concat(o.slice(0, m), ".").concat(o.slice(m)), "".concat(c ? "-" : "").concat(y);
}
function Av(e) {
  return e.exponent >= 0 ? Math.max(0, e.decimal.length - e.exponent) : Math.abs(e.exponent) + e.decimal.length;
}
function Do(e) {
  var n = String(e);
  return pc(e) ? Av(zv(n)) : n.includes(".") && op(n) ? n.length - n.indexOf(".") - 1 : 0;
}
function hc(e) {
  var n = String(e);
  if (pc(e)) {
    if (e > Number.MAX_SAFE_INTEGER)
      return String(xd() ? BigInt(e).toString() : Number.MAX_SAFE_INTEGER);
    if (e < Number.MIN_SAFE_INTEGER)
      return String(xd() ? BigInt(e).toString() : Number.MIN_SAFE_INTEGER);
    var o = zv(n), i = Av(o);
    n = i > 100 ? E2(o) : e.toFixed(i);
  }
  return qo(n).fullStr;
}
function op(e) {
  return typeof e == "number" ? !Number.isNaN(e) : e ? (
    // Normal type: 11.28
    /^\s*-?\d+(\.\d+)?\s*$/.test(e) || // Pre-number: 1.
    /^\s*-?\d+\.\s*$/.test(e) || // Post-number: .1
    /^\s*-?\.\d+\s*$/.test(e)
  ) : !1;
}
var $2 = /* @__PURE__ */ (function() {
  function e(n) {
    if (Hi(this, e), Pt(this, "origin", ""), Pt(this, "negative", void 0), Pt(this, "integer", void 0), Pt(this, "decimal", void 0), Pt(this, "decimalLen", void 0), Pt(this, "empty", void 0), Pt(this, "nan", void 0), Ov(n)) {
      this.empty = !0;
      return;
    }
    if (this.origin = String(n), n === "-" || Number.isNaN(n)) {
      this.nan = !0;
      return;
    }
    var o = n;
    if (pc(o) && (o = Number(o)), o = typeof o == "string" ? o : hc(o), op(o)) {
      var i = qo(o);
      this.negative = i.negative;
      var l = i.trimStr.split(".");
      this.integer = BigInt(l[0]);
      var c = l[1] || "0";
      this.decimal = BigInt(c), this.decimalLen = c.length;
    } else
      this.nan = !0;
  }
  return Vi(e, [{
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
      var c = Math.max(this.getDecimalStr().length, o.getDecimalStr().length), f = this.alignDecimal(c), p = o.alignDecimal(c), g = i(f, p).toString(), m = l(c), y = qo(g), v = y.negativeStr, w = y.trimStr, x = "".concat(v).concat(w.padStart(m + 1, "0"));
      return new e("".concat(x.slice(0, -m), ".").concat(x.slice(-m)));
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
      return o ? this.isInvalidate() ? "" : qo("".concat(this.getMark()).concat(this.getIntegerStr(), ".").concat(this.getDecimalStr())).fullStr : this.origin;
    }
  }]), e;
})(), P2 = /* @__PURE__ */ (function() {
  function e(n) {
    if (Hi(this, e), Pt(this, "origin", ""), Pt(this, "number", void 0), Pt(this, "empty", void 0), Ov(n)) {
      this.empty = !0;
      return;
    }
    this.origin = String(n), this.number = Number(n);
  }
  return Vi(e, [{
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
      var c = Math.max(Do(this.number), Do(i));
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
      var c = Math.max(Do(this.number), Do(i));
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
      return o ? this.isInvalidate() ? "" : pc(this.number) && Do(this.number) > 100 ? String(this.number) : hc(this.number) : this.origin;
    }
  }]), e;
})();
function ur(e) {
  return xd() ? new $2(e) : new P2(e);
}
function Ba(e, n, o) {
  var i = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : !1;
  if (e === "")
    return "";
  var l = qo(e), c = l.negativeStr, f = l.integerStr, p = l.decimalStr, g = "".concat(n).concat(p), m = "".concat(c).concat(f);
  if (o >= 0) {
    var y = Number(p[o]);
    if (y >= 5 && !i) {
      var v = ur(e).add("".concat(c, "0.").concat("0".repeat(o)).concat(10 - y));
      return Ba(v.toString(), n, o, i);
    }
    return o === 0 ? m : "".concat(m).concat(n).concat(p.padEnd(o, "0").slice(0, o));
  }
  return g === ".0" ? m : "".concat(m).concat(g);
}
function _2(e, n) {
  const o = h.useRef(null);
  function i() {
    try {
      const {
        selectionStart: c,
        selectionEnd: f,
        value: p
      } = e, g = p.substring(0, c), m = p.substring(f);
      o.current = {
        start: c,
        end: f,
        value: p,
        beforeTxt: g,
        afterTxt: m
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
        let m = c.length;
        if (c.startsWith(f))
          m = f.length;
        else if (c.endsWith(p))
          m = c.length - o.current.afterTxt.length;
        else {
          const y = f[g - 1], v = c.indexOf(y, g - 1);
          v !== -1 && (m = v + 1);
        }
        e.setSelectionRange(m, m);
      } catch (c) {
        Fn(!1, `Something warning of cursor restore. Please fire issue about this: ${c.message}`);
      }
  }
  return [i, l];
}
const R2 = 200, N2 = 600;
function y0({
  prefixCls: e,
  action: n,
  children: o,
  disabled: i,
  className: l,
  style: c,
  onStep: f
}) {
  const p = n === "up", g = h.useRef(), m = h.useRef([]), y = () => {
    clearTimeout(g.current);
  }, v = (C) => {
    C.preventDefault(), y(), f(p, "handler");
    function E() {
      f(p, "handler"), g.current = setTimeout(E, R2);
    }
    g.current = setTimeout(E, N2);
  };
  h.useEffect(() => () => {
    y(), m.current.forEach((C) => {
      vo.cancel(C);
    });
  }, []);
  const w = `${e}-action`, x = we(w, `${w}-${n}`, {
    [`${w}-${n}-disabled`]: i
  }, l), b = () => m.current.push(vo(y));
  return /* @__PURE__ */ h.createElement("span", {
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
  }, o || /* @__PURE__ */ h.createElement("span", {
    unselectable: "on",
    className: `${e}-action-${n}-inner`
  }));
}
function v0(e) {
  const n = typeof e == "number" ? hc(e) : qo(e).fullStr;
  return n.includes(".") ? qo(n.replace(/(\d)\.(\d)/g, "$1$2.")).fullStr : e + "0";
}
const k2 = (() => {
  const e = h.useRef(0), n = () => {
    vo.cancel(e.current);
  };
  return h.useEffect(() => n, []), (o) => {
    n(), e.current = vo(() => {
      o();
    });
  };
});
function qs() {
  return qs = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, qs.apply(this, arguments);
}
const S0 = (e, n) => e || n.isEmpty() ? n.toString() : n.toNumber(), w0 = (e) => {
  const n = ur(e);
  return n.isInvalidate() ? null : n;
}, T2 = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    mode: o = "input",
    prefixCls: i = "rc-input-number",
    className: l,
    style: c,
    classNames: f,
    styles: p,
    min: g,
    max: m,
    step: y = 1,
    defaultValue: v,
    value: w,
    disabled: x,
    readOnly: b,
    upHandler: C,
    downHandler: E,
    keyboard: P,
    changeOnWheel: N = !1,
    controls: _ = !0,
    prefix: R,
    suffix: M,
    stringMode: F,
    parser: O,
    formatter: z,
    precision: H,
    decimalSeparator: Y,
    onChange: V,
    onInput: X,
    onPressEnter: Q,
    onStep: oe,
    // Mouse Events
    onMouseDown: G,
    onClick: le,
    onMouseUp: he,
    onMouseLeave: j,
    onMouseMove: J,
    onMouseEnter: U,
    onMouseOut: k,
    changeOnBlur: A = !0,
    ...ee
  } = e, [te, se] = h.useState(!1), re = h.useRef(!1), fe = h.useRef(!1), ie = h.useRef(!1), Z = h.useRef(null), ae = h.useRef(null);
  h.useImperativeHandle(n, () => Zw(ae.current, {
    focus: (de) => {
      jw(ae.current, de);
    },
    blur: () => {
      ae.current?.blur();
    },
    nativeElement: Z.current
  }));
  const [ce, ke] = h.useState(() => ur(w ?? v));
  function qe(de) {
    w === void 0 && ke(de);
  }
  const Qe = h.useCallback((de, Ee) => {
    if (!Ee)
      return H >= 0 ? H : Math.max(Do(de), Do(y));
  }, [H, y]), Ne = h.useCallback((de) => {
    const Ee = String(de);
    if (O)
      return O(Ee);
    let Ce = Ee;
    return Y && (Ce = Ce.replace(Y, ".")), Ce.replace(/[^\w.-]+/g, "");
  }, [O, Y]), Xe = h.useRef(""), ut = h.useCallback((de, Ee) => {
    if (z)
      return z(de, {
        userTyping: Ee,
        input: String(Xe.current)
      });
    let Ce = typeof de == "number" ? hc(de) : de;
    if (!Ee) {
      const Et = Qe(Ce, Ee);
      op(Ce) && (Y || Et >= 0) && (Ce = Ba(Ce, Y || ".", Et));
    }
    return Ce;
  }, [z, Qe, Y]), [ze, xt] = h.useState(() => {
    const de = v ?? w;
    return ce.isInvalidate() && ["string", "number"].includes(typeof de) ? Number.isNaN(de) ? "" : de : ut(ce.toString(), !1);
  });
  Xe.current = ze;
  function Ze(de, Ee) {
    xt(ut(
      // Invalidate number is sometime passed by external control, we should let it go
      // Otherwise is controlled by internal interactive logic which check by userTyping
      // You can ref 'show limited value when input is not focused' test for more info.
      de.isInvalidate() ? de.toString(!1) : de.toString(!Ee),
      Ee
    ));
  }
  const tt = h.useMemo(() => w0(m), [m, H]), He = h.useMemo(() => w0(g), [g, H]), Je = h.useMemo(() => !tt || !ce || ce.isInvalidate() ? !1 : tt.lessEquals(ce), [tt, ce]), ft = h.useMemo(() => !He || !ce || ce.isInvalidate() ? !1 : ce.lessEquals(He), [He, ce]), [fn, Rt] = _2(ae.current, te), Wt = (de) => tt && !de.lessEquals(tt) ? tt : He && !He.lessEquals(de) ? He : null, Ut = (de) => !Wt(de), Nt = (de, Ee) => {
    let Ce = de, Et = Ut(Ce) || Ce.isEmpty();
    if (!Ce.isEmpty() && !Ee && (Ce = Wt(Ce) || Ce, Et = !0), !b && !x && Et) {
      const Qt = Ce.toString(), Mt = Qe(Qt, Ee);
      return Mt >= 0 && (Ce = ur(Ba(Qt, ".", Mt)), Ut(Ce) || (Ce = ur(Ba(Qt, ".", Mt, !0)))), Ce.equals(ce) || (qe(Ce), V?.(Ce.isEmpty() ? null : S0(F, Ce)), w === void 0 && Ze(Ce, Ee)), Ce;
    }
    return ce;
  }, mt = k2(), kt = (de) => {
    if (fn(), Xe.current = de, xt(de), !fe.current) {
      const Ee = Ne(de), Ce = ur(Ee);
      Ce.isNaN() || Nt(Ce, !0);
    }
    X?.(de), mt(() => {
      let Ee = de;
      O || (Ee = de.replace(/。/g, ".")), Ee !== de && kt(Ee);
    });
  }, Ue = () => {
    fe.current = !0;
  }, Yt = () => {
    fe.current = !1, kt(ae.current.value);
  }, Ve = (de) => {
    kt(de.target.value);
  }, Ae = wt((de, Ee) => {
    if (de && Je || !de && ft)
      return;
    re.current = !1;
    let Ce = ur(ie.current ? v0(y) : y);
    de || (Ce = Ce.negate());
    const Et = (ce || ur(0)).add(Ce.toString()), Qt = Nt(Et, !1);
    oe?.(S0(F, Qt), {
      offset: ie.current ? v0(y) : y,
      type: de ? "up" : "down",
      emitter: Ee
    }), ae.current?.focus();
  }), Oe = (de) => {
    const Ee = ur(Ne(ze));
    let Ce;
    Ee.isNaN() ? Ce = Nt(ce, de) : Ce = Nt(Ee, de), w !== void 0 ? Ze(ce, !1) : Ce.isNaN() || Ze(Ce, !1);
  }, Ge = () => {
    re.current = !0;
  }, gt = (de) => {
    const {
      key: Ee,
      shiftKey: Ce
    } = de;
    re.current = !0, ie.current = Ce, Ee === "Enter" && (fe.current || (re.current = !1), Oe(!1), Q?.(de)), P !== !1 && !fe.current && ["Up", "ArrowUp", "Down", "ArrowDown"].includes(Ee) && (Ae(Ee === "Up" || Ee === "ArrowUp", "keyboard"), de.preventDefault());
  }, qt = () => {
    re.current = !1, ie.current = !1;
  };
  h.useEffect(() => {
    if (N && te) {
      const de = (Ce) => {
        Ae(Ce.deltaY < 0, "wheel"), Ce.preventDefault();
      }, Ee = ae.current;
      if (Ee)
        return Ee.addEventListener("wheel", de, {
          passive: !1
        }), () => Ee.removeEventListener("wheel", de);
    }
  });
  const nt = () => {
    A && Oe(!1), se(!1), re.current = !1;
  }, Kt = (de) => {
    ae.current && de.target !== ae.current && (ae.current.focus(), de.preventDefault()), G?.(de);
  };
  Ju(() => {
    ce.isInvalidate() || Ze(ce, !1);
  }, [H, z]), Ju(() => {
    const de = ur(w);
    ke(de);
    const Ee = ur(Ne(ze));
    (!de.equals(Ee) || !re.current || z) && Ze(de, re.current);
  }, [w]), Ju(() => {
    z && Rt();
  }, [ze]);
  const Tt = {
    prefixCls: i,
    onStep: Ae,
    className: f?.action,
    style: p?.action
  }, En = /* @__PURE__ */ h.createElement(y0, qs({}, Tt, {
    action: "up",
    disabled: Je
  }), C), $n = /* @__PURE__ */ h.createElement(y0, qs({}, Tt, {
    action: "down",
    disabled: ft
  }), E);
  return /* @__PURE__ */ h.createElement("div", {
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
    onMouseDown: Kt,
    onMouseUp: he,
    onMouseLeave: j,
    onMouseMove: J,
    onMouseEnter: U,
    onMouseOut: k,
    onClick: le,
    onFocus: () => {
      se(!0);
    },
    onBlur: nt,
    onKeyDown: gt,
    onKeyUp: qt,
    onCompositionStart: Ue,
    onCompositionEnd: Yt,
    onBeforeInput: Ge
  }, o === "spinner" && _ && $n, R !== void 0 && /* @__PURE__ */ h.createElement("div", {
    className: we(`${i}-prefix`, f?.prefix),
    style: p?.prefix
  }, R), /* @__PURE__ */ h.createElement("input", qs({
    autoComplete: "off",
    role: "spinbutton",
    "aria-valuemin": g,
    "aria-valuemax": m,
    "aria-valuenow": ce.isInvalidate() ? null : ce.toString(),
    step: y,
    ref: ae,
    className: we(`${i}-input`, f?.input),
    style: p?.input,
    value: ze,
    onChange: Ve,
    disabled: x,
    readOnly: b
  }, ee)), M !== void 0 && /* @__PURE__ */ h.createElement("div", {
    className: we(`${i}-suffix`, f?.suffix),
    style: p?.suffix
  }, M), o === "spinner" && _ && En, o === "input" && _ && /* @__PURE__ */ h.createElement("div", {
    className: we(`${i}-actions`, f?.actions),
    style: p?.actions
  }, En, $n));
}), M2 = (e) => {
  const {
    componentCls: n,
    borderRadius: o,
    paddingSM: i,
    colorBorder: l,
    paddingXS: c,
    fontSizeLG: f,
    fontSizeSM: p,
    borderRadiusLG: g,
    borderRadiusSM: m,
    colorBgContainerDisabled: y,
    lineWidth: v,
    lineType: w,
    antCls: x
  } = e, [b, C] = sl(x, "space-addon");
  return {
    [n]: [
      // ==========================================================
      // ==                         Base                         ==
      // ==========================================================
      {
        ...Vr(e),
        display: "inline-flex",
        alignItems: "center",
        gap: 0,
        whiteSpace: "nowrap",
        paddingInline: i,
        margin: 0,
        borderWidth: v,
        borderStyle: w,
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
          borderRadius: m,
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
}, I2 = Wr("Addon", (e) => [M2(e), Jd(e, {
  focus: !1
})]), F2 = /* @__PURE__ */ ye.forwardRef((e, n) => {
  const {
    className: o,
    children: i,
    style: l,
    prefixCls: c,
    variant: f = "outlined",
    disabled: p,
    status: g,
    ...m
  } = e, {
    getPrefixCls: y,
    direction: v
  } = ye.useContext(On), w = y("space-addon", c), [x, b] = I2(w), {
    compactItemClassnames: C,
    compactSize: E
  } = cv(w, v), P = yv(w, g), N = we(w, x, C, b, `${w}-variant-${f}`, P, {
    [`${w}-${E}`]: E,
    [`${w}-disabled`]: p
  }, o);
  return /* @__PURE__ */ ye.createElement("div", {
    ref: n,
    className: N,
    style: l,
    ...m
  }, i);
}), O2 = (e) => {
  const n = e.handleVisible ?? "auto", o = e.controlHeightSM - e.lineWidth * 2;
  return {
    ...tp(e),
    controlWidth: 90,
    handleWidth: o,
    handleFontSize: e.fontSize / 2,
    handleVisible: n,
    handleActiveBg: e.colorFillAlter,
    handleBg: e.colorBgContainer,
    filledHandleBg: new Ct(e.colorFillSecondary).onBackground(e.colorBgContainer).toHexString(),
    handleHoverColor: e.colorPrimary,
    handleBorderColor: e.colorBorder,
    handleOpacity: n === !0 ? 1 : 0,
    handleVisibleWidth: n === !0 ? o : 0
  };
}, z2 = (e) => {
  const {
    componentCls: n,
    lineWidth: o,
    lineType: i,
    borderRadius: l,
    inputFontSizeSM: c,
    inputFontSizeLG: f,
    colorError: p,
    paddingInlineSM: g,
    paddingBlockSM: m,
    paddingBlockLG: y,
    paddingInlineLG: v,
    colorIcon: w,
    colorTextDisabled: x,
    motionDurationMid: b,
    handleHoverColor: C,
    handleOpacity: E,
    paddingInline: P,
    paddingBlock: N,
    handleBg: _,
    handleActiveBg: R,
    inputAffixPadding: M,
    borderRadiusSM: F,
    controlWidth: O,
    handleBorderColor: z,
    filledHandleBg: H,
    lineHeightLG: Y,
    antCls: V
  } = e, X = `${$e(o)} ${i} ${z}`, [Q, oe] = sl(V, "input-number");
  return [
    // ==========================================================
    // ==                         Base                         ==
    // ==========================================================
    {
      [n]: {
        ...Vr(e),
        ...rp(e),
        [Q("input-padding-block")]: $e(N),
        [Q("input-padding-inline")]: $e(P),
        display: "inline-flex",
        width: O,
        margin: 0,
        paddingBlock: 0,
        borderRadius: l,
        // ======================= Variants =======================
        ...Ev(e, {
          [`${n}-actions`]: {
            background: _,
            [`${n}-action-down`]: {
              borderBlockStart: X
            }
          }
        }),
        ...Nv(e, {
          [`${n}-actions`]: {
            background: H,
            [`${n}-action-down`]: {
              borderBlockStart: X
            }
          },
          "&:focus-within": {
            [`${n}-actions`]: {
              background: _
            }
          }
        }),
        ...Tv(e, {
          [`${n}-actions`]: {
            background: _,
            [`${n}-action-down`]: {
              borderBlockStart: X
            }
          }
        }),
        ..._v(e),
        // InputNumber 两层结构：borderless 补偿只加在内层 input 的 CSS 变量上，避免外层+内层双重 padding 导致高度异常
        [`&${n}-borderless`]: {
          paddingBlock: 0,
          [Q("input-padding-block")]: $e(e.calc(N).add(o).equal())
        },
        [`&${n}-borderless${n}-sm`]: {
          paddingBlock: 0,
          [Q("input-padding-block")]: $e(e.calc(m).add(o).equal())
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
          ...Vr(e),
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
          ...Mv(e.colorTextPlaceholder),
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
          ...ky(),
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
            color: w,
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
          [Q("input-padding-block")]: $e(m),
          [Q("input-padding-inline")]: $e(g),
          paddingBlock: 0,
          fontSize: c,
          borderRadius: F
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
}, A2 = (e) => {
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
}, L2 = Wr("InputNumber", (e) => {
  const n = tr(e, ep(e));
  return [
    z2(n),
    A2(n),
    // =====================================================
    // ==             Space Compact                       ==
    // =====================================================
    Jd(n)
  ];
}, O2, {
  unitless: {
    handleOpacity: !0
  },
  resetFont: !1
}), B2 = /* @__PURE__ */ h.forwardRef((e, n) => {
  const o = h.useRef(null);
  h.useImperativeHandle(n, () => o.current);
  const {
    rootClassName: i,
    size: l,
    disabled: c,
    prefixCls: f,
    addonBefore: p,
    addonAfter: g,
    prefix: m,
    suffix: y,
    bordered: v,
    readOnly: w,
    status: x,
    controls: b = !0,
    variant: C,
    className: E,
    style: P,
    classNames: N,
    styles: _,
    mode: R,
    ...M
  } = e, {
    direction: F,
    className: O,
    style: z,
    styles: H,
    classNames: Y
  } = Qo("inputNumber"), V = h.useContext(rl), X = c ?? V, Q = h.useMemo(() => !b || X || w ? !1 : b, [b, X, w]), {
    compactSize: oe,
    compactItemClassnames: G
  } = cv(f, F);
  let le = R === "spinner" ? /* @__PURE__ */ h.createElement(e2, null) : /* @__PURE__ */ h.createElement(b2, null), he = R === "spinner" ? /* @__PURE__ */ h.createElement(v2, null) : /* @__PURE__ */ h.createElement(b$, null);
  const j = typeof Q == "boolean" ? Q : void 0;
  Ur(Q) && (le = Q.upIcon || le, he = Q.downIcon || he);
  const {
    hasFeedback: J,
    isFormItemInput: U,
    feedbackIcon: k
  } = h.useContext(Za), A = fc((ce) => l ?? oe ?? ce), [ee, te] = p$("inputNumber", C, v), se = (J || y) && /* @__PURE__ */ h.createElement(h.Fragment, null, y, J && k), re = {
    ...e,
    size: A,
    disabled: X,
    controls: Q
  }, fe = zi(z), ie = zi(P), [Z, ae] = al([Y, N], [H, fe, _, ie], {
    props: re
  });
  return /* @__PURE__ */ h.createElement(T2, {
    ref: o,
    mode: R,
    disabled: X,
    className: we(E, i, Z.root, O, G, yv(f, x, J), {
      [`${f}-${ee}`]: te,
      [`${f}-lg`]: A === "large",
      [`${f}-sm`]: A === "small",
      [`${f}-rtl`]: F === "rtl",
      [`${f}-in-form-item`]: U,
      [`${f}-without-controls`]: !Q
    }),
    style: ae.root,
    upHandler: le,
    downHandler: he,
    prefixCls: f,
    readOnly: w,
    controls: j,
    prefix: m,
    suffix: se,
    classNames: Z,
    styles: ae,
    ...M
  });
}), Lv = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    addonBefore: o,
    addonAfter: i,
    prefixCls: l,
    className: c,
    status: f,
    rootClassName: p,
    ...g
  } = e, {
    getPrefixCls: m
  } = Qo("inputNumber"), y = m("input-number", l), {
    status: v
  } = h.useContext(Za), w = d$(v, f), x = Qd(y), [b, C] = L2(y, x), E = o || i, P = /* @__PURE__ */ h.createElement(B2, {
    ref: n,
    ...g,
    prefixCls: y,
    status: w,
    className: we(C, x, b, c),
    rootClassName: E ? void 0 : p
  });
  if (E) {
    const N = (M) => M ? /* @__PURE__ */ h.createElement(F2, {
      className: we(`${y}-addon`, C, b),
      variant: e.variant,
      disabled: e.disabled,
      status: w
    }, /* @__PURE__ */ h.createElement(gv, {
      form: !0
    }, M)) : null, _ = N(o), R = N(i);
    return /* @__PURE__ */ h.createElement(Yb, {
      rootClassName: p
    }, _, P, R);
  }
  return P;
}), bd = Lv, D2 = (e) => /* @__PURE__ */ h.createElement(So, {
  theme: {
    components: {
      InputNumber: {
        handleVisible: !0
      }
    }
  }
}, /* @__PURE__ */ h.createElement(Lv, {
  ...e
}));
bd._InternalPanelDoNotUseOrYouWillBeFired = D2;
const j2 = {
  percent: 0,
  prefixCls: "rc-progress",
  strokeColor: "#2db7f5",
  strokeLinecap: "round",
  strokeWidth: 1,
  railColor: "#D9D9D9",
  railWidth: 1,
  gapPosition: "bottom",
  loading: !1
}, H2 = () => {
  const e = h.useRef([]), n = h.useRef(null);
  return h.useEffect(() => {
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
}, C0 = ({
  bg: e,
  children: n
}) => /* @__PURE__ */ h.createElement("div", {
  style: {
    width: "100%",
    height: "100%",
    background: e
  }
}, n);
function x0(e, n) {
  return Object.keys(e).map((o) => {
    const i = parseFloat(o), l = `${Math.floor(i * n)}%`;
    return `${e[o]} ${l}`;
  });
}
const V2 = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    prefixCls: o,
    color: i,
    gradientId: l,
    radius: c,
    className: f,
    style: p,
    ptg: g,
    strokeLinecap: m,
    strokeWidth: y,
    size: v,
    gapDegree: w
  } = e, x = i && typeof i == "object", b = x ? "#FFF" : void 0, C = v / 2, E = /* @__PURE__ */ h.createElement("circle", {
    className: we(`${o}-circle-path`, f),
    r: c,
    cx: C,
    cy: C,
    stroke: b,
    strokeLinecap: m,
    strokeWidth: y,
    opacity: g === 0 ? 0 : 1,
    style: p,
    ref: n
  });
  if (!x)
    return E;
  const P = `${l}-conic`, N = w ? `${180 + w / 2}deg` : "0deg", _ = x0(i, (360 - w) / 360), R = x0(i, 1), M = `conic-gradient(from ${N}, ${_.join(", ")})`, F = `linear-gradient(to ${w ? "bottom" : "top"}, ${R.join(", ")})`;
  return /* @__PURE__ */ h.createElement(h.Fragment, null, /* @__PURE__ */ h.createElement("mask", {
    id: P
  }, E), /* @__PURE__ */ h.createElement("foreignObject", {
    x: 0,
    y: 0,
    width: v,
    height: v,
    mask: `url(#${P})`
  }, /* @__PURE__ */ h.createElement(C0, {
    bg: F
  }, /* @__PURE__ */ h.createElement(C0, {
    bg: M
  }))));
}), Hs = 100, yf = (e, n, o, i, l, c, f, p, g, m, y = 0) => {
  const v = o / 100 * 360 * ((360 - c) / 360), w = c === 0 ? 0 : {
    bottom: 0,
    top: 180,
    left: 90,
    right: -90
  }[f];
  let x = (100 - i) / 100 * n;
  g === "round" && i !== 100 && (x += m / 2, x >= n && (x = n - 0.01));
  const b = Hs / 2;
  return {
    stroke: typeof p == "string" ? p : void 0,
    strokeDasharray: `${n}px ${e}`,
    strokeDashoffset: x + y,
    transform: `rotate(${l + v + w}deg)`,
    transformOrigin: `${b}px ${b}px`,
    transition: "stroke-dashoffset .3s ease 0s, stroke-dasharray .3s ease 0s, stroke .3s, stroke-width .06s ease .3s, opacity .3s ease 0s",
    fillOpacity: 0
  };
}, W2 = (({
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
function b0(e) {
  const n = e ?? [];
  return Array.isArray(n) ? n : [n];
}
const U2 = (e) => {
  const {
    id: n,
    prefixCls: o,
    classNames: i = {},
    styles: l = {},
    steps: c,
    strokeWidth: f,
    railWidth: p,
    gapDegree: g = 0,
    gapPosition: m,
    railColor: y,
    strokeLinecap: v,
    style: w,
    className: x,
    strokeColor: b,
    percent: C,
    loading: E,
    ...P
  } = {
    ...j2,
    ...e
  }, N = Hs / 2, _ = ol(n), R = `${_}-gradient`, M = N - f / 2, F = Math.PI * 2 * M, O = g > 0 ? 90 + g / 2 : -90, z = F * ((360 - g) / 360), {
    count: H,
    gap: Y
  } = typeof c == "object" ? c : {
    count: c,
    gap: 2
  }, V = b0(C), X = b0(b), Q = X.find((A) => A && typeof A == "object"), G = Q && typeof Q == "object" ? "butt" : v, {
    indeterminateStyleProps: le,
    indeterminateStyleAnimation: he
  } = W2({
    id: _,
    loading: E
  }), j = yf(F, z, 0, 100, O, g, m, y, G, f), J = H2(), U = () => {
    let A = 0;
    return V.map((ee, te) => {
      const se = X[te] || X[X.length - 1], re = yf(F, z, A, ee, O, g, m, se, G, f);
      return A += ee, /* @__PURE__ */ h.createElement(V2, {
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
        size: Hs
      });
    }).reverse();
  }, k = () => {
    const A = Math.round(H * (V[0] / 100)), ee = 100 / H;
    let te = 0;
    return new Array(H).fill(null).map((se, re) => {
      const fe = re <= A - 1 ? X[0] : y, ie = fe && typeof fe == "object" ? `url(#${R})` : void 0, Z = yf(F, z, te, ee, O, g, m, fe, "butt", f, Y);
      return te += (z - Z.strokeDashoffset + Y) * 100 / z, /* @__PURE__ */ h.createElement("circle", {
        key: re,
        className: we(`${o}-circle-path`, i.track),
        r: M,
        cx: N,
        cy: N,
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
  return /* @__PURE__ */ h.createElement("svg", Ed({
    className: we(`${o}-circle`, i.root, x),
    viewBox: `0 0 ${Hs} ${Hs}`,
    style: {
      ...l.root,
      ...w
    },
    id: n,
    role: "presentation"
  }, P), !H && /* @__PURE__ */ h.createElement("circle", {
    className: we(`${o}-circle-rail`, i.rail),
    r: M,
    cx: N,
    cy: N,
    stroke: y,
    strokeLinecap: G,
    strokeWidth: p || f,
    style: {
      ...j,
      ...l.rail
    }
  }), H ? k() : U(), he);
};
function Xo(e) {
  return !e || e < 0 ? 0 : e > 100 ? 100 : e;
}
function Ja({
  success: e
}) {
  let n;
  return e && "percent" in e && (n = e.percent), n;
}
const q2 = ({
  percent: e,
  success: n
}) => {
  const o = Xo(Ja({
    success: n
  }));
  return [o, Xo(Xo(e) - o)];
}, X2 = ({
  success: e = {},
  strokeColor: n
}) => {
  const {
    strokeColor: o
  } = e;
  return [o || ki.green, n || null];
}, mc = (e, n, o) => {
  let i = -1, l = -1;
  if (n === "step") {
    const c = o.steps, f = o.strokeWidth;
    typeof e == "string" || typeof e > "u" ? (i = e === "small" ? 2 : 14, l = f ?? 8) : ff(e) ? [i, l] = [e, e] : [i = 14, l = 8] = Array.isArray(e) ? e : [e.width, e.height], i *= c;
  } else if (n === "line") {
    const c = o?.strokeWidth;
    typeof e == "string" || typeof e > "u" ? l = c || (e === "small" ? 6 : 8) : ff(e) ? [i, l] = [e, e] : [i = -1, l = 8] = Array.isArray(e) ? e : [e.width, e.height];
  } else (n === "circle" || n === "dashboard") && (typeof e == "string" || typeof e > "u" ? [i, l] = e === "small" ? [60, 60] : [120, 120] : ff(e) ? [i, l] = [e, e] : Array.isArray(e) && (i = e[0] ?? e[1] ?? 120, l = e[0] ?? e[1] ?? 120));
  return [i, l];
}, G2 = 3, Y2 = (e) => G2 / e * 100, E0 = ["root", "body", "indicator"], K2 = (e) => {
  const {
    prefixCls: n,
    classNames: o,
    styles: i,
    railColor: l,
    trailColor: c,
    strokeLinecap: f = "round",
    gapPosition: p,
    gapPlacement: g,
    gapDegree: m,
    width: y = 120,
    type: v,
    children: w,
    success: x,
    size: b = y,
    steps: C
  } = e, {
    direction: E
  } = Qo("progress"), P = l ?? c, [N, _] = mc(b, "circle");
  let {
    strokeWidth: R
  } = e;
  R === void 0 && (R = Math.max(Y2(N), 6));
  const M = {
    width: N,
    height: _,
    fontSize: N * 0.15 + 6
  }, F = h.useMemo(() => {
    if (m || m === 0)
      return m;
    if (v === "dashboard")
      return 75;
  }, [m, v]), O = q2(e), z = h.useMemo(() => {
    const G = (g ?? p) || v === "dashboard" && "bottom" || void 0, le = E === "rtl";
    switch (G) {
      case "start":
        return le ? "right" : "left";
      case "end":
        return le ? "left" : "right";
      default:
        return G;
    }
  }, [E, g, p, v]), H = Ur(e.strokeColor), Y = X2({
    success: x,
    strokeColor: e.strokeColor
  }), V = we(`${n}-body`, {
    [`${n}-circle-gradient`]: H
  }, o.body), X = /* @__PURE__ */ h.createElement(U2, {
    steps: C,
    percent: C ? O[1] : O,
    strokeWidth: R,
    railWidth: R,
    strokeColor: C ? Y[1] : Y,
    strokeLinecap: f,
    railColor: P,
    prefixCls: n,
    gapDegree: F,
    gapPosition: z,
    classNames: Va(o, E0),
    styles: Va(i, E0)
  }), Q = N <= 20, oe = /* @__PURE__ */ h.createElement("div", {
    className: V,
    style: {
      ...M,
      ...i.body
    }
  }, X, !Q && w);
  return Q ? /* @__PURE__ */ h.createElement(Bi, {
    title: w
  }, oe) : oe;
}, $d = "--progress-line-stroke-color", Q2 = (e) => {
  const n = "-100%";
  return new sn("antProgressLTRActive", {
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
}, Z2 = (e) => {
  const {
    componentCls: n,
    iconCls: o
  } = e;
  return {
    [n]: {
      ...Vr(e),
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
}, J2 = (e) => {
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
          animationName: Q2(),
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
}, eP = (e) => {
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
}, tP = (e) => {
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
}, nP = (e) => {
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
}, rP = (e) => ({
  circleTextColor: e.colorText,
  defaultColor: e.colorInfo,
  remainingColor: e.colorFillSecondary,
  lineBorderRadius: 100,
  // magic for capsule shape, should be a very large number
  circleTextFontSize: "1em",
  circleIconFontSize: `${e.fontSize / e.fontSizeSM}em`
}), oP = Wr("Progress", (e) => {
  const n = e.calc(e.marginXXS).div(2).equal(), o = tr(e, {
    progressStepMarginInlineEnd: n,
    progressStepMinWidth: n,
    progressActiveMotionDuration: "2.4s"
  });
  return [Z2(o), J2(o), eP(o), tP(o), nP(o)];
}, rP), iP = (e) => {
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
}, sP = (e, n) => {
  const {
    from: o = ki.blue,
    to: i = ki.blue,
    direction: l = n === "rtl" ? "to left" : "to right",
    ...c
  } = e;
  if (Object.keys(c).length !== 0) {
    const p = iP(c), g = `linear-gradient(${l}, ${p})`;
    return {
      background: g,
      [$d]: g
    };
  }
  const f = `linear-gradient(${l}, ${o}, ${i})`;
  return {
    background: f,
    [$d]: f
  };
}, lP = (e) => {
  const {
    prefixCls: n,
    classNames: o,
    styles: i,
    direction: l,
    percent: c,
    size: f,
    strokeWidth: p,
    strokeColor: g,
    strokeLinecap: m = "round",
    children: y,
    railColor: v,
    trailColor: w,
    percentPosition: x,
    success: b
  } = e, {
    align: C,
    type: E
  } = x, P = v ?? w, N = m === "square" || m === "butt" ? 0 : void 0, _ = f ?? [-1, p || (f === "small" ? 6 : 8)], [R, M] = mc(_, "line", {
    strokeWidth: p
  }), F = {
    backgroundColor: P || void 0,
    borderRadius: N,
    height: M
  }, O = `${n}-track`, z = g && typeof g != "string" ? sP(g, l) : {
    [$d]: g,
    background: g
  }, H = {
    width: `${Xo(c)}%`,
    height: M,
    borderRadius: N,
    ...z
  }, Y = Ja(e), V = {
    width: `${Xo(Y)}%`,
    height: M,
    borderRadius: N,
    backgroundColor: b?.strokeColor
  };
  return /* @__PURE__ */ h.createElement("div", {
    className: we(`${n}-body`, o.body, {
      [`${n}-body-layout-bottom`]: C === "center" && E === "outer"
    }),
    style: {
      width: R > 0 ? R : "100%",
      ...i.body
    }
  }, /* @__PURE__ */ h.createElement("div", {
    className: we(`${n}-rail`, o.rail),
    style: {
      ...F,
      ...i.rail
    }
  }, /* @__PURE__ */ h.createElement("div", {
    className: we(O, o.track),
    style: {
      ...H,
      ...i.track
    }
  }, E === "inner" && y), Y !== void 0 && /* @__PURE__ */ h.createElement("div", {
    className: we(O, `${O}-success`, o.track),
    style: {
      ...V,
      ...i.track
    }
  })), E === "outer" && y);
}, aP = (e) => {
  const {
    classNames: n,
    styles: o,
    size: i,
    steps: l,
    rounding: c = Math.round,
    percent: f = 0,
    strokeWidth: p = 8,
    strokeColor: g,
    railColor: m,
    trailColor: y,
    prefixCls: v,
    children: w
  } = e, x = c(l * (f / 100)), C = i ?? [i === "small" ? 2 : 14, p], [E, P] = mc(C, "step", {
    steps: l,
    strokeWidth: p
  }), N = E / l, _ = Array.from({
    length: l
  }), R = m ?? y;
  for (let M = 0; M < l; M++) {
    const F = Array.isArray(g) ? g[M] : g;
    _[M] = /* @__PURE__ */ h.createElement("div", {
      key: M,
      className: we(`${v}-steps-item`, {
        [`${v}-steps-item-active`]: M <= x - 1
      }, n.track),
      style: {
        backgroundColor: M <= x - 1 ? F : R,
        width: N,
        height: P,
        ...o.track
      }
    });
  }
  return /* @__PURE__ */ h.createElement("div", {
    className: we(`${v}-steps-body`, n.body),
    style: o.body
  }, _, w);
}, cP = ["normal", "exception", "active", "success"], Bv = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    prefixCls: o,
    className: i,
    rootClassName: l,
    classNames: c,
    styles: f,
    steps: p,
    strokeColor: g,
    percent: m = 0,
    size: y = "medium",
    showInfo: v = !0,
    type: w = "line",
    status: x,
    format: b,
    style: C,
    percentPosition: E = {},
    ...P
  } = e, {
    align: N = "end",
    type: _ = "outer"
  } = E, R = Array.isArray(g) ? g[0] : g, M = typeof g == "string" || Array.isArray(g) ? g : void 0, F = h.useMemo(() => {
    if (R) {
      const Z = typeof R == "string" ? R : Object.values(R)[0];
      return new Ct(Z).isLight();
    }
    return !1;
  }, [g]), O = h.useMemo(() => {
    const Z = Ja(e);
    return Number.parseInt(Z !== void 0 ? (Z ?? 0)?.toString() : (m ?? 0)?.toString(), 10);
  }, [m, e.success]), z = h.useMemo(() => !cP.includes(x) && O >= 100 ? "success" : x || "normal", [x, O]), {
    getPrefixCls: H,
    direction: Y,
    className: V,
    style: X,
    classNames: Q,
    styles: oe
  } = Qo("progress"), G = H("progress", o), [le, he] = oP(G), j = {
    ...e,
    percent: m,
    type: w,
    size: y,
    showInfo: v,
    percentPosition: E
  }, J = zi(X), U = zi(C), [k, A] = al([Q, c], [oe, J, f, U], {
    props: j
  }), ee = w === "line", te = ee && !p, se = h.useMemo(() => {
    if (!v)
      return null;
    const Z = Ja(e);
    let ae;
    const ce = b || ((qe) => `${qe}%`), ke = ee && F && _ === "inner";
    return _ === "inner" || b || z !== "exception" && z !== "success" ? ae = ce(Xo(m), Xo(Z)) : z === "exception" ? ae = ee ? /* @__PURE__ */ h.createElement(kx, null) : /* @__PURE__ */ h.createElement(Ox, null) : z === "success" && (ae = ee ? /* @__PURE__ */ h.createElement($x, null) : /* @__PURE__ */ h.createElement(v$, null)), /* @__PURE__ */ h.createElement("span", {
      className: we(`${G}-indicator`, {
        [`${G}-indicator-bright`]: ke,
        [`${G}-indicator-${N}`]: te,
        [`${G}-indicator-${_}`]: te
      }, k.indicator),
      style: A.indicator,
      title: typeof ae == "string" ? ae : void 0
    }, ae);
  }, [v, m, O, z, w, G, b, ee, F, _, N, te, k.indicator, A.indicator]), re = {
    ...e,
    classNames: k,
    styles: A
  };
  let fe;
  w === "line" ? fe = p ? /* @__PURE__ */ h.createElement(aP, {
    ...re,
    strokeColor: M,
    prefixCls: G,
    steps: Ur(p) ? p.count : p
  }, se) : /* @__PURE__ */ h.createElement(lP, {
    ...re,
    strokeColor: R,
    prefixCls: G,
    direction: Y,
    percentPosition: {
      align: N,
      type: _
    }
  }, se) : (w === "circle" || w === "dashboard") && (fe = /* @__PURE__ */ h.createElement(K2, {
    ...re,
    strokeColor: R,
    prefixCls: G,
    progressStatus: z
  }, se));
  const ie = we(G, `${G}-status-${z}`, {
    [`${G}-${w === "dashboard" && "circle" || w}`]: w !== "line",
    [`${G}-inline-circle`]: w === "circle" && mc(y, "circle")[0] <= 20,
    [`${G}-line`]: te,
    [`${G}-line-align-${N}`]: te,
    [`${G}-line-position-${_}`]: te,
    [`${G}-steps`]: p,
    [`${G}-show-info`]: v,
    [`${G}-small`]: y === "small",
    [`${G}-rtl`]: Y === "rtl"
  }, V, i, l, k.root, le, he);
  return /* @__PURE__ */ h.createElement("div", {
    ref: n,
    style: A.root,
    className: ie,
    role: "progressbar",
    "aria-valuenow": O,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    ...Va(P, ["railColor", "trailColor", "strokeWidth", "width", "gapDegree", "gapPosition", "gapPlacement", "strokeLinecap", "success"])
  }, fe);
});
var Ma = {}, $0;
function uP() {
  if ($0) return Ma;
  $0 = 1, Object.defineProperty(Ma, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M908.1 353.1l-253.9-36.9L540.7 86.1c-3.1-6.3-8.2-11.4-14.5-14.5-15.8-7.8-35-1.3-42.9 14.5L369.8 316.2l-253.9 36.9c-7 1-13.4 4.3-18.3 9.3a32.05 32.05 0 00.6 45.3l183.7 179.1-43.4 252.9a31.95 31.95 0 0046.4 33.7L512 754l227.1 119.4c6.2 3.3 13.4 4.4 20.3 3.2 17.4-3 29.1-19.5 26.1-36.9l-43.4-252.9 183.7-179.1c5-4.9 8.3-11.3 9.3-18.3 2.7-17.5-9.5-33.7-27-36.3z" } }] }, name: "star", theme: "filled" };
  return Ma.default = e, Ma;
}
var fP = /* @__PURE__ */ uP();
const dP = /* @__PURE__ */ er(fP);
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
const pP = (e, n) => /* @__PURE__ */ h.createElement(Pr, Pd({}, e, {
  ref: n,
  icon: dP
})), hP = /* @__PURE__ */ h.forwardRef(pP);
function mP(e, n) {
  const {
    disabled: o,
    prefixCls: i,
    character: l,
    characterRender: c,
    index: f,
    count: p,
    value: g,
    allowHalf: m,
    focused: y,
    onHover: v,
    onClick: w
  } = e, x = (R) => {
    v(R, f);
  }, b = (R) => {
    w(R, f);
  }, C = (R) => {
    R.keyCode === Ds.ENTER && w(R, f);
  }, E = f + 1, P = /* @__PURE__ */ new Set([i]);
  g === 0 && f === 0 && y ? P.add(`${i}-focused`) : m && g + 0.5 >= E && g < E ? (P.add(`${i}-half`), P.add(`${i}-active`), y && P.add(`${i}-focused`)) : (E <= g ? P.add(`${i}-full`) : P.add(`${i}-zero`), E === g && y && P.add(`${i}-focused`));
  const N = typeof l == "function" ? l(e) : l;
  let _ = /* @__PURE__ */ ye.createElement("li", {
    className: we(Array.from(P)),
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
  }, N), /* @__PURE__ */ ye.createElement("div", {
    className: `${i}-second`
  }, N)));
  return c && (_ = c(_, e)), _;
}
const gP = /* @__PURE__ */ ye.forwardRef(mP);
function yP() {
  const e = h.useRef({});
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
function vP(e) {
  let n = e.pageXOffset;
  const o = "scrollLeft";
  if (typeof n != "number") {
    const i = e.document;
    n = i.documentElement[o], typeof n != "number" && (n = i.body[o]);
  }
  return n;
}
function SP(e) {
  let n, o;
  const i = e.ownerDocument, {
    body: l
  } = i, c = i && i.documentElement, f = e.getBoundingClientRect();
  return n = f.left, o = f.top, n -= c.clientLeft || l.clientLeft || 0, o -= c.clientTop || l.clientTop || 0, {
    left: n,
    top: o
  };
}
function wP(e) {
  const n = SP(e), o = e.ownerDocument, i = o.defaultView || o.parentWindow;
  return n.left += vP(i), n.left;
}
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
function CP(e, n) {
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
    keyboard: m = !0,
    // Display
    character: y = "★",
    characterRender: v,
    // Meta
    disabled: w,
    direction: x = "ltr",
    tabIndex: b = 0,
    autoFocus: C,
    // Events
    onHoverChange: E,
    onChange: P,
    onFocus: N,
    onBlur: _,
    onKeyDown: R,
    onMouseLeave: M,
    ...F
  } = e, [O, z] = yP(), H = ye.useRef(null), Y = () => {
    w || H.current?.focus();
  };
  ye.useImperativeHandle(n, () => ({
    focus: Y,
    blur: () => {
      w || H.current?.blur();
    }
  }));
  const [V, X] = Zs(l || 0, c), [Q, oe] = Zs(null), G = (Z, ae) => {
    const ce = x === "rtl";
    let ke = Z + 1;
    if (p) {
      const qe = O(Z), Qe = wP(qe), Ne = qe.clientWidth;
      (ce && ae - Qe > Ne / 2 || !ce && ae - Qe < Ne / 2) && (ke -= 0.5);
    }
    return ke;
  }, le = (Z) => {
    X(Z), P?.(Z);
  }, [he, j] = ye.useState(!1), J = () => {
    j(!0), N?.();
  }, U = () => {
    j(!1), _?.();
  }, [k, A] = ye.useState(null), ee = (Z, ae) => {
    const ce = G(ae, Z.pageX);
    ce !== Q && (A(ce), oe(null)), E?.(ce);
  }, te = (Z) => {
    w || (A(null), oe(null), E?.(void 0)), Z && M?.(Z);
  }, se = (Z, ae) => {
    const ce = G(ae, Z.pageX);
    let ke = !1;
    g && (ke = ce === V), te(), le(ke ? 0 : ce), oe(ke ? ce : null);
  }, re = (Z) => {
    const {
      keyCode: ae
    } = Z, ce = x === "rtl", ke = p ? 0.5 : 1;
    m && (ae === Ds.RIGHT && V < f && !ce ? (le(V + ke), Z.preventDefault()) : ae === Ds.LEFT && V > 0 && !ce || ae === Ds.RIGHT && V > 0 && ce ? (le(V - ke), Z.preventDefault()) : ae === Ds.LEFT && V < f && ce && (le(V + ke), Z.preventDefault())), R?.(Z);
  };
  ye.useEffect(() => {
    C && !w && Y();
  }, []);
  const fe = new Array(f).fill(0).map((Z, ae) => /* @__PURE__ */ ye.createElement(gP, {
    ref: z(ae),
    index: ae,
    count: f,
    disabled: w,
    prefixCls: `${o}-star`,
    allowHalf: p,
    value: k === null ? V : k,
    onClick: se,
    onHover: ee,
    key: Z || ae,
    character: y,
    characterRender: v,
    focused: he
  })), ie = we(o, i, {
    [`${o}-disabled`]: w,
    [`${o}-rtl`]: x === "rtl"
  });
  return /* @__PURE__ */ ye.createElement("ul", _d({
    className: ie,
    onMouseLeave: te,
    tabIndex: w ? -1 : b,
    onFocus: w ? null : J,
    onBlur: w ? null : U,
    onKeyDown: w ? null : re,
    ref: H
  }, Qw(F, {
    aria: !0,
    data: !0,
    attr: !0
  })), fe);
}
const xP = /* @__PURE__ */ ye.forwardRef(CP), bP = (e) => {
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
}, EP = (e) => ({
  [`&-rtl${e.componentCls}`]: {
    direction: "rtl"
  }
}), $P = (e) => {
  const {
    componentCls: n
  } = e;
  return {
    [n]: {
      ...Vr(e),
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
      ...bP(e),
      // rtl styles
      ...EP(e)
    }
  };
}, PP = (e) => ({
  starColor: e.yellow6,
  starSize: e.controlHeight * 0.625,
  starSizeSM: e.controlHeightSM * 0.625,
  starSizeLG: e.controlHeightLG * 0.625,
  starHoverScale: "scale(1.1)",
  starBg: e.colorFillContent
}), _P = Wr("Rate", (e) => {
  const n = tr(e, {});
  return $P(n);
}, PP), Dv = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    prefixCls: o,
    className: i,
    rootClassName: l,
    style: c,
    tooltips: f,
    character: p = /* @__PURE__ */ h.createElement(hP, null),
    disabled: g,
    size: m,
    ...y
  } = e, v = (O, {
    index: z = 0
  }) => {
    if (!f)
      return O;
    const H = f[z];
    return Ur(H) ? /* @__PURE__ */ h.createElement(Bi, {
      ...H
    }, O) : /* @__PURE__ */ h.createElement(Bi, {
      title: H
    }, O);
  }, {
    getPrefixCls: w,
    direction: x,
    className: b,
    style: C
  } = Qo("rate"), E = w("rate", o), [P, N] = _P(E), _ = {
    ...C,
    ...c
  }, R = h.useContext(rl), M = g ?? R, F = fc((O) => m ?? O);
  return /* @__PURE__ */ h.createElement(xP, {
    ref: n,
    character: p,
    characterRender: v,
    disabled: M,
    ...y,
    className: we({
      [`${E}-large`]: F === "large",
      [`${E}-small`]: F === "small"
    }, i, l, P, N, b),
    style: _,
    prefixCls: E,
    direction: x
  });
}), RP = (e) => {
  const n = e?.algorithm ? Ha(e.algorithm) : Wd, o = {
    ...Oi,
    ...e?.token
  };
  return G0(o, {
    override: e?.token
  }, n, _y);
};
function NP(e) {
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
const kP = (e, n) => {
  const o = n ?? cc(e), i = o.fontSizeSM, l = o.controlHeight - 4;
  return {
    ...o,
    ...NP(n ?? e),
    // font
    ...Py(i),
    // controlHeight
    controlHeight: l,
    ...$y({
      ...o,
      controlHeight: l
    })
  };
}, Yn = (e, n) => new Ct(e).setA(n).toRgbString(), zo = (e, n) => new Ct(e).lighten(n).toHexString(), P0 = (e) => {
  const n = ac(e, {
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
}, TP = (e, n, o) => {
  const i = e || "#000", l = n || "#fff";
  return {
    colorBgBase: i,
    colorTextBase: l,
    colorShadow: o || "rgba(255, 255, 255, 0.2)",
    colorText: Yn(l, 0.85),
    colorTextSecondary: Yn(l, 0.65),
    colorTextTertiary: Yn(l, 0.45),
    colorTextQuaternary: Yn(l, 0.25),
    colorFill: Yn(l, 0.18),
    colorFillSecondary: Yn(l, 0.12),
    colorFillTertiary: Yn(l, 0.08),
    colorFillQuaternary: Yn(l, 0.04),
    colorBgSolid: Yn(l, 0.95),
    colorBgSolidHover: Yn(l, 1),
    colorBgSolidActive: Yn(l, 0.9),
    colorBgElevated: zo(i, 12),
    colorBgContainer: zo(i, 8),
    colorBgLayout: zo(i, 0),
    colorBgSpotlight: zo(i, 26),
    colorBgBlur: Yn(l, 0.04),
    colorBorder: zo(i, 26),
    colorBorderDisabled: zo(i, 26),
    colorBorderSecondary: zo(i, 19)
  };
}, MP = (e, n) => {
  const o = Object.keys(Vd).map((f) => {
    const p = ac(e[f], {
      theme: "dark"
    });
    return Array.from({
      length: 10
    }, () => 1).reduce((g, m, y) => (g[`${f}-${y + 1}`] = p[y], g[`${f}${y + 1}`] = p[y], g), {});
  }).reduce((f, p) => (f = {
    ...f,
    ...p
  }, f), {}), i = n ?? cc(e), l = Ey(e, {
    generateColorPalettes: P0,
    generateNeutralColorPalettes: TP
  }), c = Fi.reduce((f, p) => {
    const g = e[p];
    if (g) {
      const m = P0(g);
      f[`${p}Hover`] = m[7], f[`${p}Active`] = m[5];
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
function IP() {
  const [e, n, o, i] = Wi();
  return {
    theme: e,
    token: n,
    hashId: o,
    cssVar: i
  };
}
const ip = {
  /** Default seedToken */
  defaultSeed: tl.token,
  useToken: IP,
  defaultAlgorithm: cc,
  darkAlgorithm: MP,
  compactAlgorithm: kP,
  getDesignToken: RP,
  /**
   * @private Private variable
   * @warring 🔥 Do not use in production. 🔥
   */
  defaultConfig: tl,
  /**
   * @private Private variable
   * @warring 🔥 Do not use in production. 🔥
   */
  _internalContext: Ud
};
var Ts = {}, vf = { exports: {} }, _0;
function sp() {
  return _0 || (_0 = 1, (function(e) {
    function n(o) {
      return o && o.__esModule ? o : {
        default: o
      };
    }
    e.exports = n, e.exports.__esModule = !0, e.exports.default = e.exports;
  })(vf)), vf.exports;
}
var Ms = {}, R0;
function FP() {
  if (R0) return Ms;
  R0 = 1, Object.defineProperty(Ms, "__esModule", {
    value: !0
  }), Ms.default = void 0;
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
  return Ms.default = e, Ms;
}
var Is = {}, Fs = {}, Os = {}, zs = {}, N0;
function OP() {
  return N0 || (N0 = 1, Object.defineProperty(zs, "__esModule", {
    value: !0
  }), zs.commonLocale = void 0, zs.commonLocale = {
    yearFormat: "YYYY",
    dayFormat: "D",
    cellMeridiemFormat: "A",
    monthBeforeYear: !0
  }), zs;
}
var k0;
function zP() {
  if (k0) return Os;
  k0 = 1, Object.defineProperty(Os, "__esModule", {
    value: !0
  }), Os.default = void 0;
  var e = OP();
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
  return Os.default = n, Os;
}
var As = {}, T0;
function jv() {
  if (T0) return As;
  T0 = 1, Object.defineProperty(As, "__esModule", {
    value: !0
  }), As.default = void 0;
  const e = {
    placeholder: "请选择时间",
    rangePlaceholder: ["开始时间", "结束时间"]
  };
  return As.default = e, As;
}
var M0;
function Hv() {
  if (M0) return Fs;
  M0 = 1;
  var e = sp().default;
  Object.defineProperty(Fs, "__esModule", {
    value: !0
  }), Fs.default = void 0;
  var n = e(zP()), o = e(/* @__PURE__ */ jv());
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
  return i.lang.ok = "确定", Fs.default = i, Fs;
}
var I0;
function AP() {
  if (I0) return Is;
  I0 = 1;
  var e = sp().default;
  Object.defineProperty(Is, "__esModule", {
    value: !0
  }), Is.default = void 0;
  var n = e(/* @__PURE__ */ Hv());
  return Is.default = n.default, Is;
}
var F0;
function LP() {
  if (F0) return Ts;
  F0 = 1;
  var e = sp().default;
  Object.defineProperty(Ts, "__esModule", {
    value: !0
  }), Ts.default = void 0;
  var n = e(FP()), o = e(/* @__PURE__ */ AP()), i = e(/* @__PURE__ */ Hv()), l = e(/* @__PURE__ */ jv());
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
  return Ts.default = f, Ts;
}
var Sf, O0;
function BP() {
  return O0 || (O0 = 1, Sf = /* @__PURE__ */ LP()), Sf;
}
var DP = /* @__PURE__ */ BP();
const Vv = /* @__PURE__ */ er(DP), Wv = {
  algorithm: ip.defaultAlgorithm,
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
var wf = { exports: {} }, Ls = {};
var z0;
function jP() {
  if (z0) return Ls;
  z0 = 1;
  var e = Nd(), n = /* @__PURE__ */ Symbol.for("react.element"), o = /* @__PURE__ */ Symbol.for("react.fragment"), i = Object.prototype.hasOwnProperty, l = e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, c = { key: !0, ref: !0, __self: !0, __source: !0 };
  function f(p, g, m) {
    var y, v = {}, w = null, x = null;
    m !== void 0 && (w = "" + m), g.key !== void 0 && (w = "" + g.key), g.ref !== void 0 && (x = g.ref);
    for (y in g) i.call(g, y) && !c.hasOwnProperty(y) && (v[y] = g[y]);
    if (p && p.defaultProps) for (y in g = p.defaultProps, g) v[y] === void 0 && (v[y] = g[y]);
    return { $$typeof: n, type: p, key: w, ref: x, props: v, _owner: l.current };
  }
  return Ls.Fragment = o, Ls.jsx = f, Ls.jsxs = f, Ls;
}
var A0;
function HP() {
  return A0 || (A0 = 1, wf.exports = jP()), wf.exports;
}
var Pe = HP();
h.createContext({
  client: null,
  launchContext: null,
  ready: !1
});
h.createContext(null);
var Ia = {}, L0;
function VP() {
  if (L0) return Ia;
  L0 = 1, Object.defineProperty(Ia, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M923 283.6a260.04 260.04 0 00-56.9-82.8 264.4 264.4 0 00-84-55.5A265.34 265.34 0 00679.7 125c-49.3 0-97.4 13.5-139.2 39-10 6.1-19.5 12.8-28.5 20.1-9-7.3-18.5-14-28.5-20.1-41.8-25.5-89.9-39-139.2-39-35.5 0-69.9 6.8-102.4 20.3-31.4 13-59.7 31.7-84 55.5a258.44 258.44 0 00-56.9 82.8c-13.9 32.3-21 66.6-21 101.9 0 33.3 6.8 68 20.3 103.3 11.3 29.5 27.5 60.1 48.2 91 32.8 48.9 77.9 99.9 133.9 151.6 92.8 85.7 184.7 144.9 188.6 147.3l23.7 15.2c10.5 6.7 24 6.7 34.5 0l23.7-15.2c3.9-2.5 95.7-61.6 188.6-147.3 56-51.7 101.1-102.7 133.9-151.6 20.7-30.9 37-61.5 48.2-91 13.5-35.3 20.3-70 20.3-103.3.1-35.3-7-69.6-20.9-101.9z" } }] }, name: "heart", theme: "filled" };
  return Ia.default = e, Ia;
}
var WP = /* @__PURE__ */ VP();
const UP = /* @__PURE__ */ er(WP);
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
const qP = (e, n) => /* @__PURE__ */ h.createElement(Pr, Rd({}, e, {
  ref: n,
  icon: UP
})), Uv = /* @__PURE__ */ h.forwardRef(qP), jr = 5, qv = 1, ec = 1e5, lp = [
  "stars",
  "hearts",
  "score",
  "progress"
], Di = {
  theme: "",
  style: "stars",
  score: 0,
  total_score: jr,
  locale: "zh-CN"
};
function B0(e) {
  return typeof e == "string" ? e.trim() : void 0;
}
function Xv(e) {
  if (typeof e == "number" && Number.isFinite(e))
    return e;
  if (typeof e == "string" && e.trim().length > 0) {
    const n = Number(e);
    return Number.isFinite(n) ? n : void 0;
  }
}
function ap(e, n, o) {
  return Math.min(Math.max(e, n), o);
}
function Ko(e) {
  return e === "stars" || e === "hearts";
}
function XP(e) {
  return lp.includes(e) ? e : Di.style;
}
function GP(e, n) {
  return Ko(e) ? jr : ap(
    Xv(n) ?? Di.total_score,
    qv,
    ec
  );
}
function YP(e, n, o) {
  const i = ap(Xv(n) ?? Di.score, 0, o);
  return Ko(e) ? Math.round(i) : i;
}
function $r(e) {
  const n = e ?? {}, o = XP(n.style), i = GP(o, n.total_score), l = YP(o, n.score, i);
  return {
    card_type: "ScoreCard",
    theme: B0(n.theme) ?? Di.theme,
    style: o,
    score: l,
    total_score: i,
    locale: B0(n.locale) ?? Di.locale
  };
}
function Gv(e) {
  return !Number.isFinite(e.total_score) || e.total_score <= 0 ? 0 : ap(e.score / e.total_score, 0, 1);
}
function Da(e) {
  const n = {};
  return e.card_type !== "ScoreCard" && (n.card_type = "score.validation.cardType"), lp.includes(e.style) || (n.style = "score.validation.style"), (!Number.isFinite(e.total_score) || e.total_score < qv) && (n.total_score = "score.validation.totalMin"), e.total_score > ec && (n.total_score = "score.validation.totalMax"), (!Number.isFinite(e.score) || e.score < 0) && (n.score = "score.validation.scoreMin"), Number.isFinite(e.total_score) && e.score > e.total_score && (n.score = "score.validation.scoreMax"), Ko(e.style) && (e.total_score !== jr && (n.total_score = "score.validation.symbolTotal"), Number.isInteger(e.score) || (n.score = "score.validation.symbolInteger")), {
    valid: Object.keys(n).length === 0,
    errors: n
  };
}
const KP = {
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
function Kn(e, n) {
  const o = KP[e] ?? e;
  return Object.entries(n ?? {}).reduce((i, [l, c]) => i.replace(new RegExp(`\\{${l}\\}`, "g"), String(c)), o);
}
const QP = `
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
function Cf(e) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2
  }).format(e);
}
function ZP(e) {
  return e.style === "hearts" ? "heart" : "star";
}
function JP(e, n, o, i) {
  const c = ZP(e) === "heart";
  return /* @__PURE__ */ Pe.jsxs(Pe.Fragment, { children: [
    /* @__PURE__ */ Pe.jsx("span", { className: "chips-score-card__sr-only", id: o, children: n }),
    /* @__PURE__ */ Pe.jsx(
      Dv,
      {
        "aria-labelledby": o,
        className: [
          "chips-score-card__rating",
          c ? "chips-score-card__rating--hearts" : ""
        ].filter(Boolean).join(" "),
        count: e.total_score,
        character: c ? /* @__PURE__ */ Pe.jsx(Uv, {}) : void 0,
        disabled: !0,
        style: c ? { color: i } : void 0,
        value: e.score
      }
    )
  ] });
}
function e_({ config: e }) {
  const { token: n } = ip.useToken(), o = Cf(e.score), i = Cf(e.total_score), l = Gv(e), c = Cf(l * 100), f = o.length + i.length >= 9, p = Kn("score.accessible.value", {
    score: o,
    total: i
  }), g = ye.useId(), m = ye.useId();
  return /* @__PURE__ */ Pe.jsx("div", { className: "chips-score-card", "data-card-type": e.card_type, "data-score-style": e.style, children: /* @__PURE__ */ Pe.jsxs(
    "div",
    {
      className: [
        "chips-score-card__surface",
        Ko(e.style) ? "chips-score-card__surface--symbols" : ""
      ].filter(Boolean).join(" "),
      children: [
        Ko(e.style) ? JP(e, p, m, n.colorError) : null,
        e.style === "score" ? /* @__PURE__ */ Pe.jsxs(
          "div",
          {
            className: [
              "chips-score-card__numeric",
              f ? "chips-score-card__numeric--compact" : ""
            ].filter(Boolean).join(" "),
            role: "img",
            "aria-label": p,
            children: [
              /* @__PURE__ */ Pe.jsx("span", { "aria-hidden": "true", className: "chips-score-card__numeric-score", children: o }),
              /* @__PURE__ */ Pe.jsx(
                "span",
                {
                  "aria-hidden": "true",
                  className: "chips-score-card__numeric-separator",
                  style: { color: n.colorTextBase, opacity: 0.36 },
                  children: "/"
                }
              ),
              /* @__PURE__ */ Pe.jsx("span", { "aria-hidden": "true", className: "chips-score-card__numeric-total", children: i })
            ]
          }
        ) : null,
        e.style === "progress" ? /* @__PURE__ */ Pe.jsxs("div", { className: "chips-score-card__progress", children: [
          /* @__PURE__ */ Pe.jsx("span", { className: "chips-score-card__sr-only", id: g, children: p }),
          /* @__PURE__ */ Pe.jsx(
            Bv,
            {
              "aria-labelledby": g,
              "aria-valuetext": Kn("score.progress.percent", { percent: c }),
              className: "chips-score-card__progress-control",
              "aria-valuenow": Math.round(l * 100),
              percent: l * 100,
              showInfo: !1,
              size: ["100%", 14]
            }
          ),
          /* @__PURE__ */ Pe.jsxs("div", { className: "chips-score-card__progress-meta", "aria-hidden": "true", children: [
            /* @__PURE__ */ Pe.jsxs("span", { className: "chips-score-card__progress-score", children: [
              o,
              " / ",
              i
            ] }),
            /* @__PURE__ */ Pe.jsx("span", { className: "chips-score-card__progress-percent", children: Kn("score.progress.percent", { percent: c }) })
          ] })
        ] }) : null
      ]
    }
  ) });
}
const D0 = /* @__PURE__ */ new WeakMap();
function t_(e) {
  const n = D0.get(e);
  if (n)
    return n;
  const o = Md();
  return D0.set(e, o), o;
}
function n_(e) {
  const { container: n, config: o } = e, i = n.ownerDocument;
  for (; n.firstChild; )
    n.removeChild(n.firstChild);
  const l = i.createElement("div");
  l.setAttribute("data-chips-basecard-view-root", "true"), l.style.width = "100%", n.appendChild(l);
  const c = i === document ? { container: i.head } : {
    cache: t_(i),
    container: i.head
  }, f = {
    root: dy.createRoot(l)
  };
  return lc.flushSync(() => {
    f.root.render(
      ye.createElement(
        HS,
        c,
        ye.createElement(
          So,
          { locale: Vv, theme: Wv },
          ye.createElement(
            ye.Fragment,
            null,
            ye.createElement("style", null, QP),
            ye.createElement(e_, {
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
const r_ = `
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
`, o_ = {
  stars: "score.style.stars",
  hearts: "score.style.hearts",
  score: "score.style.score",
  progress: "score.style.progress"
};
function xf(e) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2
  }).format(e);
}
function i_(e) {
  return e.style === "hearts" ? "heart" : "star";
}
function s_(e) {
  const { token: n } = ip.useToken(), [o, i] = h.useState(() => $r(e.initialConfig)), l = h.useRef(o), [c, f] = h.useState(
    () => Da($r(e.initialConfig)).errors
  ), p = h.useMemo(() => Gv(o), [o]), g = xf(o.score), m = xf(o.total_score), y = xf(p * 100), v = g.length + m.length >= 9, w = ye.useId(), x = ye.useId(), b = ye.useId(), C = ye.useId(), E = ye.useId();
  h.useEffect(() => {
    const F = $r(e.initialConfig);
    l.current = F, i(F), f(Da(F).errors);
  }, [e.initialConfig]);
  function P(F) {
    const O = $r({
      ...l.current,
      ...F
    }), z = Da(O);
    l.current = O, i(O), f(z.errors), z.valid && e.onChange(O);
  }
  const N = lp.map((F) => ({
    value: F,
    label: Kn(o_[F])
  })), _ = Kn("score.accessible.value", {
    score: g,
    total: m
  }), R = i_(o) === "heart";
  function M(F) {
    F.key === "Home" ? (F.preventDefault(), P({ score: 1, total_score: jr })) : F.key === "End" && (F.preventDefault(), P({ score: jr, total_score: jr }));
  }
  return /* @__PURE__ */ Pe.jsxs("div", { className: "chips-basecard-editor chips-basecard-editor--standard", children: [
    /* @__PURE__ */ Pe.jsxs("section", { className: "chips-score-editor__group", "aria-labelledby": w, children: [
      /* @__PURE__ */ Pe.jsx("div", { className: "chips-score-editor__label", id: w, children: Kn("score.style") }),
      /* @__PURE__ */ Pe.jsx(
        p2,
        {
          "aria-labelledby": w,
          className: "chips-score-editor__segmented",
          options: N,
          value: o.style,
          onChange: (F) => {
            const O = F;
            P({
              style: O,
              total_score: Ko(O) ? jr : o.total_score
            });
          }
        }
      )
    ] }),
    /* @__PURE__ */ Pe.jsxs("section", { className: "chips-score-editor__group", "aria-labelledby": x, children: [
      /* @__PURE__ */ Pe.jsx("div", { className: "chips-score-editor__label", id: x, children: Kn("score.earnedScore") }),
      Ko(o.style) ? /* @__PURE__ */ Pe.jsx("div", { className: "chips-score-editor__rating-wrap", onKeyDown: M, children: /* @__PURE__ */ Pe.jsx(
        Dv,
        {
          "aria-labelledby": x,
          className: [
            "chips-score-editor__rating",
            R ? "chips-score-editor__rating--hearts" : ""
          ].filter(Boolean).join(" "),
          count: jr,
          character: R ? /* @__PURE__ */ Pe.jsx(Uv, {}) : void 0,
          style: R ? { color: n.colorError } : void 0,
          value: o.score,
          onChange: (F) => {
            P({ score: F, total_score: jr });
          }
        }
      ) }) : /* @__PURE__ */ Pe.jsxs("div", { className: "chips-score-editor__number-grid", children: [
        /* @__PURE__ */ Pe.jsxs("div", { className: "chips-score-editor__number-field", children: [
          /* @__PURE__ */ Pe.jsx("label", { className: "chips-score-editor__label", htmlFor: C, children: Kn("score.totalScore") }),
          /* @__PURE__ */ Pe.jsx(
            bd,
            {
              className: "chips-score-editor__number-input",
              id: C,
              max: ec,
              min: 1,
              step: 0.1,
              value: o.total_score,
              onChange: (F) => {
                P({ total_score: F ?? 1 });
              }
            }
          )
        ] }),
        /* @__PURE__ */ Pe.jsxs("div", { className: "chips-score-editor__number-field", children: [
          /* @__PURE__ */ Pe.jsx("label", { className: "chips-score-editor__label", htmlFor: E, children: Kn("score.scoreValue") }),
          /* @__PURE__ */ Pe.jsx(
            bd,
            {
              className: "chips-score-editor__number-input",
              id: E,
              max: o.total_score,
              min: 0,
              step: 0.1,
              value: o.score,
              onChange: (F) => {
                P({ score: F ?? 0 });
              }
            }
          )
        ] })
      ] }),
      o.style === "progress" ? /* @__PURE__ */ Pe.jsxs("div", { className: "chips-score-editor__preview", children: [
        /* @__PURE__ */ Pe.jsx("span", { className: "chips-score-editor__sr-only", id: b, children: Kn("score.progressPreview", {
          score: g,
          total: m,
          percent: y
        }) }),
        /* @__PURE__ */ Pe.jsx(
          Bv,
          {
            "aria-labelledby": b,
            "aria-valuetext": Kn("score.progress.percent", { percent: y }),
            percent: p * 100,
            showInfo: !1,
            size: ["100%", 12]
          }
        ),
        /* @__PURE__ */ Pe.jsxs("div", { "aria-hidden": "true", className: "chips-score-editor__preview-value", children: [
          g,
          " / ",
          m
        ] })
      ] }) : null,
      o.style === "score" ? /* @__PURE__ */ Pe.jsx("div", { className: "chips-score-editor__preview", children: /* @__PURE__ */ Pe.jsxs(
        "div",
        {
          className: [
            "chips-score-editor__preview-numeric",
            v ? "chips-score-editor__preview-numeric--compact" : ""
          ].filter(Boolean).join(" "),
          role: "img",
          "aria-label": _,
          children: [
            /* @__PURE__ */ Pe.jsx("span", { "aria-hidden": "true", className: "chips-score-editor__preview-numeric-score", children: g }),
            /* @__PURE__ */ Pe.jsx(
              "span",
              {
                "aria-hidden": "true",
                className: "chips-score-editor__preview-numeric-separator",
                style: { color: n.colorTextBase, opacity: 0.36 },
                children: "/"
              }
            ),
            /* @__PURE__ */ Pe.jsx("span", { "aria-hidden": "true", className: "chips-score-editor__preview-numeric-total", children: m })
          ]
        }
      ) }) : null,
      /* @__PURE__ */ Pe.jsx(
        "div",
        {
          className: "chips-basecard-editor__errors",
          role: "alert",
          "aria-live": "polite",
          style: { color: n.colorError },
          children: Object.keys(c).length > 0 ? /* @__PURE__ */ Pe.jsx("ul", { className: "chips-basecard-editor__errors-list", children: Object.entries(c).map(([F, O]) => /* @__PURE__ */ Pe.jsx("li", { children: Kn(O, { max: ec }) }, F)) }) : null
        }
      )
    ] })
  ] });
}
function l_(e) {
  const n = document.createElement("div");
  n.setAttribute("data-chips-basecard-editor-root", "true"), n.style.width = "100%", n.style.height = "100%", n.style.minHeight = "0";
  const o = dy.createRoot(n);
  return lc.flushSync(() => {
    o.render(
      /* @__PURE__ */ Pe.jsxs(So, { locale: Vv, theme: Wv, children: [
        /* @__PURE__ */ Pe.jsx("style", { children: r_ }),
        /* @__PURE__ */ Pe.jsx(s_, { ...e })
      ] })
    );
  }), n.__chipsDispose = () => {
    o.unmount();
  }, n;
}
function bf(e) {
  return {
    height: e.style.height,
    minHeight: e.style.minHeight,
    width: e.style.width,
    overflow: e.style.overflow,
    display: e.style.display
  };
}
function Ef(e, n) {
  e.style.height = n.height, e.style.minHeight = n.minHeight, e.style.width = n.width, e.style.overflow = n.overflow, e.style.display = n.display;
}
function a_(e) {
  const n = e.container.ownerDocument, o = n.documentElement, i = n.body, l = bf(o), c = bf(i), f = bf(e.container);
  for (o.style.width = "100%", o.style.height = "100%", o.style.minHeight = "0", o.style.overflow = "hidden", i.style.width = "100%", i.style.height = "100%", i.style.minHeight = "0", i.style.overflow = "hidden", e.container.style.display = "flex", e.container.style.width = "100%", e.container.style.height = "100%", e.container.style.minHeight = "0", e.container.style.overflow = "hidden"; e.container.firstChild; )
    e.container.removeChild(e.container.firstChild);
  const p = l_({
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
    for (p.__chipsDispose?.(), Ef(o, l), Ef(i, c), Ef(e.container, f); e.container.firstChild; )
      e.container.removeChild(e.container.firstChild);
  };
}
function c_(e) {
  return n_({
    ...e,
    config: $r(e.config)
  });
}
function u_(e) {
  return a_(e);
}
const f_ = {
  name: "star",
  decorative: !0
}, p_ = {
  pluginId: "chips.basecard.score",
  cardType: "base.score",
  displayName: "评分基础卡片",
  description: "用星星、爱心、数字分数或进度条展示评分数据。",
  icon: f_,
  aliases: ["ScoreCard"],
  commitDebounceMs: 260,
  createInitialConfig(e) {
    return $r(
      Di
    );
  },
  normalizeConfig(e, n) {
    return $r(e);
  },
  validateConfig(e) {
    return Da(
      $r(e)
    );
  },
  collectResourcePaths(e) {
    return [];
  },
  renderView(e) {
    return c_({
      container: e.container,
      config: $r(e.config),
      themeCssText: e.themeCssText,
      resolveResourceUrl: e.resolveResourceUrl,
      releaseResourceUrl: e.releaseResourceUrl,
      openResource: e.openResource
    });
  },
  renderEditor(e) {
    return u_({
      container: e.container,
      initialConfig: $r(e.initialConfig),
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
  p_ as basecardDefinition,
  u_ as renderBasecardEditor,
  c_ as renderBasecardView
};
