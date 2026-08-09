function gS(e, n) {
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
function Jn(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var Du = { exports: {} }, Te = {};
var Cm;
function yS() {
  if (Cm) return Te;
  Cm = 1;
  var e = /* @__PURE__ */ Symbol.for("react.element"), n = /* @__PURE__ */ Symbol.for("react.portal"), o = /* @__PURE__ */ Symbol.for("react.fragment"), i = /* @__PURE__ */ Symbol.for("react.strict_mode"), l = /* @__PURE__ */ Symbol.for("react.profiler"), c = /* @__PURE__ */ Symbol.for("react.provider"), f = /* @__PURE__ */ Symbol.for("react.context"), p = /* @__PURE__ */ Symbol.for("react.forward_ref"), g = /* @__PURE__ */ Symbol.for("react.suspense"), m = /* @__PURE__ */ Symbol.for("react.memo"), v = /* @__PURE__ */ Symbol.for("react.lazy"), y = Symbol.iterator;
  function w(k) {
    return k === null || typeof k != "object" ? null : (k = y && k[y] || k["@@iterator"], typeof k == "function" ? k : null);
  }
  var x = { isMounted: function() {
    return !1;
  }, enqueueForceUpdate: function() {
  }, enqueueReplaceState: function() {
  }, enqueueSetState: function() {
  } }, E = Object.assign, C = {};
  function b(k, O, ee) {
    this.props = k, this.context = O, this.refs = C, this.updater = ee || x;
  }
  b.prototype.isReactComponent = {}, b.prototype.setState = function(k, O) {
    if (typeof k != "object" && typeof k != "function" && k != null) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, k, O, "setState");
  }, b.prototype.forceUpdate = function(k) {
    this.updater.enqueueForceUpdate(this, k, "forceUpdate");
  };
  function $() {
  }
  $.prototype = b.prototype;
  function _(k, O, ee) {
    this.props = k, this.context = O, this.refs = C, this.updater = ee || x;
  }
  var R = _.prototype = new $();
  R.constructor = _, E(R, b.prototype), R.isPureReactComponent = !0;
  var N = Array.isArray, T = Object.prototype.hasOwnProperty, L = { current: null }, F = { key: !0, ref: !0, __self: !0, __source: !0 };
  function A(k, O, ee) {
    var te, se = {}, re = null, fe = null;
    if (O != null) for (te in O.ref !== void 0 && (fe = O.ref), O.key !== void 0 && (re = "" + O.key), O) T.call(O, te) && !F.hasOwnProperty(te) && (se[te] = O[te]);
    var ie = arguments.length - 2;
    if (ie === 1) se.children = ee;
    else if (1 < ie) {
      for (var Z = Array(ie), ae = 0; ae < ie; ae++) Z[ae] = arguments[ae + 2];
      se.children = Z;
    }
    if (k && k.defaultProps) for (te in ie = k.defaultProps, ie) se[te] === void 0 && (se[te] = ie[te]);
    return { $$typeof: e, type: k, key: re, ref: fe, props: se, _owner: L.current };
  }
  function H(k, O) {
    return { $$typeof: e, type: k.type, key: O, ref: k.ref, props: k.props, _owner: k._owner };
  }
  function Y(k) {
    return typeof k == "object" && k !== null && k.$$typeof === e;
  }
  function V(k) {
    var O = { "=": "=0", ":": "=2" };
    return "$" + k.replace(/[=:]/g, function(ee) {
      return O[ee];
    });
  }
  var X = /\/+/g;
  function Q(k, O) {
    return typeof k == "object" && k !== null && k.key != null ? V("" + k.key) : O.toString(36);
  }
  function oe(k, O, ee, te, se) {
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
    if (fe) return fe = k, se = se(fe), k = te === "" ? "." + Q(fe, 0) : te, N(se) ? (ee = "", k != null && (ee = k.replace(X, "$&/") + "/"), oe(se, O, ee, "", function(ae) {
      return ae;
    })) : se != null && (Y(se) && (se = H(se, ee + (!se.key || fe && fe.key === se.key ? "" : ("" + se.key).replace(X, "$&/") + "/") + k)), O.push(se)), 1;
    if (fe = 0, te = te === "" ? "." : te + ":", N(k)) for (var ie = 0; ie < k.length; ie++) {
      re = k[ie];
      var Z = te + Q(re, ie);
      fe += oe(re, O, ee, Z, se);
    }
    else if (Z = w(k), typeof Z == "function") for (k = Z.call(k), ie = 0; !(re = k.next()).done; ) re = re.value, Z = te + Q(re, ie++), fe += oe(re, O, ee, Z, se);
    else if (re === "object") throw O = String(k), Error("Objects are not valid as a React child (found: " + (O === "[object Object]" ? "object with keys {" + Object.keys(k).join(", ") + "}" : O) + "). If you meant to render a collection of children, use an array instead.");
    return fe;
  }
  function G(k, O, ee) {
    if (k == null) return k;
    var te = [], se = 0;
    return oe(k, te, "", "", function(re) {
      return O.call(ee, re, se++);
    }), te;
  }
  function le(k) {
    if (k._status === -1) {
      var O = k._result;
      O = O(), O.then(function(ee) {
        (k._status === 0 || k._status === -1) && (k._status = 1, k._result = ee);
      }, function(ee) {
        (k._status === 0 || k._status === -1) && (k._status = 2, k._result = ee);
      }), k._status === -1 && (k._status = 0, k._result = O);
    }
    if (k._status === 1) return k._result.default;
    throw k._result;
  }
  var he = { current: null }, j = { transition: null }, J = { ReactCurrentDispatcher: he, ReactCurrentBatchConfig: j, ReactCurrentOwner: L };
  function U() {
    throw Error("act(...) is not supported in production builds of React.");
  }
  return Te.Children = { map: G, forEach: function(k, O, ee) {
    G(k, function() {
      O.apply(this, arguments);
    }, ee);
  }, count: function(k) {
    var O = 0;
    return G(k, function() {
      O++;
    }), O;
  }, toArray: function(k) {
    return G(k, function(O) {
      return O;
    }) || [];
  }, only: function(k) {
    if (!Y(k)) throw Error("React.Children.only expected to receive a single React element child.");
    return k;
  } }, Te.Component = b, Te.Fragment = o, Te.Profiler = l, Te.PureComponent = _, Te.StrictMode = i, Te.Suspense = g, Te.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = J, Te.act = U, Te.cloneElement = function(k, O, ee) {
    if (k == null) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + k + ".");
    var te = E({}, k.props), se = k.key, re = k.ref, fe = k._owner;
    if (O != null) {
      if (O.ref !== void 0 && (re = O.ref, fe = L.current), O.key !== void 0 && (se = "" + O.key), k.type && k.type.defaultProps) var ie = k.type.defaultProps;
      for (Z in O) T.call(O, Z) && !F.hasOwnProperty(Z) && (te[Z] = O[Z] === void 0 && ie !== void 0 ? ie[Z] : O[Z]);
    }
    var Z = arguments.length - 2;
    if (Z === 1) te.children = ee;
    else if (1 < Z) {
      ie = Array(Z);
      for (var ae = 0; ae < Z; ae++) ie[ae] = arguments[ae + 2];
      te.children = ie;
    }
    return { $$typeof: e, type: k.type, key: se, ref: re, props: te, _owner: fe };
  }, Te.createContext = function(k) {
    return k = { $$typeof: f, _currentValue: k, _currentValue2: k, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null }, k.Provider = { $$typeof: c, _context: k }, k.Consumer = k;
  }, Te.createElement = A, Te.createFactory = function(k) {
    var O = A.bind(null, k);
    return O.type = k, O;
  }, Te.createRef = function() {
    return { current: null };
  }, Te.forwardRef = function(k) {
    return { $$typeof: p, render: k };
  }, Te.isValidElement = Y, Te.lazy = function(k) {
    return { $$typeof: v, _payload: { _status: -1, _result: k }, _init: le };
  }, Te.memo = function(k, O) {
    return { $$typeof: m, type: k, compare: O === void 0 ? null : O };
  }, Te.startTransition = function(k) {
    var O = j.transition;
    j.transition = {};
    try {
      k();
    } finally {
      j.transition = O;
    }
  }, Te.unstable_act = U, Te.useCallback = function(k, O) {
    return he.current.useCallback(k, O);
  }, Te.useContext = function(k) {
    return he.current.useContext(k);
  }, Te.useDebugValue = function() {
  }, Te.useDeferredValue = function(k) {
    return he.current.useDeferredValue(k);
  }, Te.useEffect = function(k, O) {
    return he.current.useEffect(k, O);
  }, Te.useId = function() {
    return he.current.useId();
  }, Te.useImperativeHandle = function(k, O, ee) {
    return he.current.useImperativeHandle(k, O, ee);
  }, Te.useInsertionEffect = function(k, O) {
    return he.current.useInsertionEffect(k, O);
  }, Te.useLayoutEffect = function(k, O) {
    return he.current.useLayoutEffect(k, O);
  }, Te.useMemo = function(k, O) {
    return he.current.useMemo(k, O);
  }, Te.useReducer = function(k, O, ee) {
    return he.current.useReducer(k, O, ee);
  }, Te.useRef = function(k) {
    return he.current.useRef(k);
  }, Te.useState = function(k) {
    return he.current.useState(k);
  }, Te.useSyncExternalStore = function(k, O, ee) {
    return he.current.useSyncExternalStore(k, O, ee);
  }, Te.useTransition = function() {
    return he.current.useTransition();
  }, Te.version = "18.3.1", Te;
}
var xm;
function Ed() {
  return xm || (xm = 1, Du.exports = yS()), Du.exports;
}
var h = Ed();
const Se = /* @__PURE__ */ Jn(h), vS = /* @__PURE__ */ gS({
  __proto__: null,
  default: Se
}, [h]), wt = (e) => {
  const n = h.useRef(e);
  return n.current = e, h.useCallback((...i) => n.current?.(...i), []);
};
function Qn() {
  return !!(typeof window < "u" && window.document && window.document.createElement);
}
const bm = Qn() ? h.useLayoutEffect : h.useEffect, un = (e, n) => {
  const o = h.useRef(!0);
  bm(() => e(o.current), n), bm(() => (o.current = !1, () => {
    o.current = !0;
  }), []);
}, ju = (e, n) => {
  un((o) => {
    if (!o)
      return e();
  }, n);
}, SS = (e) => {
  const n = h.useRef(!1), [o, i] = h.useState(e);
  h.useEffect(() => (n.current = !1, () => {
    n.current = !0;
  }), []);
  function l(c, f) {
    f && n.current || i(c);
  }
  return [o, l];
};
function js(e, n) {
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
let k0 = (e) => +setTimeout(e, 16), M0 = (e) => clearTimeout(e);
typeof window < "u" && "requestAnimationFrame" in window && (k0 = (e) => window.requestAnimationFrame(e), M0 = (e) => window.cancelAnimationFrame(e));
let Em = 0;
const $d = /* @__PURE__ */ new Map();
function T0(e) {
  $d.delete(e);
}
const go = (e, n = 1) => {
  Em += 1;
  const o = Em;
  function i(l) {
    if (l === 0)
      T0(o), e();
    else {
      const c = k0(() => {
        i(l - 1);
      });
      $d.set(o, c);
    }
  }
  return i(n), o;
};
go.cancel = (e) => {
  const n = $d.get(e);
  return T0(e), M0(n);
};
function wS() {
  return {
    ...vS
  }.useId;
}
let $m = 0;
const Pm = wS(), Zs = Pm ? (
  // Use React `useId`
  (function(n) {
    const o = Pm();
    return n || o;
  })
) : (
  // Use compatible of `useId`
  (function(n) {
    const [o, i] = h.useState("ssr-id");
    return h.useEffect(() => {
      const l = $m;
      $m += 1, i(`rc_unique_${l}`);
    }, []), n || o;
  })
);
function Pd(e, n, o) {
  const i = h.useRef({});
  return (!("value" in i.current) || o(i.current.condition, n)) && (i.current.value = e(), i.current.condition = n), i.current.value;
}
function CS(e) {
  const [, n] = h.useReducer((c) => c + 1, 0), o = h.useRef(e), i = wt(() => o.current), l = wt((c) => {
    o.current = typeof c == "function" ? c(o.current) : c, n();
  });
  return [i, l];
}
var Hu = { exports: {} }, Ye = {};
var Rm;
function xS() {
  if (Rm) return Ye;
  Rm = 1;
  var e = /* @__PURE__ */ Symbol.for("react.transitional.element"), n = /* @__PURE__ */ Symbol.for("react.portal"), o = /* @__PURE__ */ Symbol.for("react.fragment"), i = /* @__PURE__ */ Symbol.for("react.strict_mode"), l = /* @__PURE__ */ Symbol.for("react.profiler"), c = /* @__PURE__ */ Symbol.for("react.consumer"), f = /* @__PURE__ */ Symbol.for("react.context"), p = /* @__PURE__ */ Symbol.for("react.forward_ref"), g = /* @__PURE__ */ Symbol.for("react.suspense"), m = /* @__PURE__ */ Symbol.for("react.suspense_list"), v = /* @__PURE__ */ Symbol.for("react.memo"), y = /* @__PURE__ */ Symbol.for("react.lazy"), w = /* @__PURE__ */ Symbol.for("react.view_transition"), x = /* @__PURE__ */ Symbol.for("react.client.reference");
  function E(C) {
    if (typeof C == "object" && C !== null) {
      var b = C.$$typeof;
      switch (b) {
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
                case y:
                case v:
                  return C;
                case c:
                  return C;
                default:
                  return b;
              }
          }
        case n:
          return b;
      }
    }
  }
  return Ye.ContextConsumer = c, Ye.ContextProvider = f, Ye.Element = e, Ye.ForwardRef = p, Ye.Fragment = o, Ye.Lazy = y, Ye.Memo = v, Ye.Portal = n, Ye.Profiler = l, Ye.StrictMode = i, Ye.Suspense = g, Ye.SuspenseList = m, Ye.isContextConsumer = function(C) {
    return E(C) === c;
  }, Ye.isContextProvider = function(C) {
    return E(C) === f;
  }, Ye.isElement = function(C) {
    return typeof C == "object" && C !== null && C.$$typeof === e;
  }, Ye.isForwardRef = function(C) {
    return E(C) === p;
  }, Ye.isFragment = function(C) {
    return E(C) === o;
  }, Ye.isLazy = function(C) {
    return E(C) === y;
  }, Ye.isMemo = function(C) {
    return E(C) === v;
  }, Ye.isPortal = function(C) {
    return E(C) === n;
  }, Ye.isProfiler = function(C) {
    return E(C) === l;
  }, Ye.isStrictMode = function(C) {
    return E(C) === i;
  }, Ye.isSuspense = function(C) {
    return E(C) === g;
  }, Ye.isSuspenseList = function(C) {
    return E(C) === m;
  }, Ye.isValidElementType = function(C) {
    return typeof C == "string" || typeof C == "function" || C === o || C === l || C === i || C === g || C === m || typeof C == "object" && C !== null && (C.$$typeof === y || C.$$typeof === v || C.$$typeof === f || C.$$typeof === c || C.$$typeof === p || C.$$typeof === x || C.getModuleId !== void 0);
  }, Ye.typeOf = E, Ye;
}
var _m;
function bS() {
  return _m || (_m = 1, Hu.exports = /* @__PURE__ */ xS()), Hu.exports;
}
var Vu = /* @__PURE__ */ bS();
const ES = /* @__PURE__ */ Symbol.for("react.element"), $S = /* @__PURE__ */ Symbol.for("react.transitional.element"), PS = /* @__PURE__ */ Symbol.for("react.fragment");
function I0(e) {
  return (
    // Base object type
    e && typeof e == "object" && // React Element type
    (e.$$typeof === ES || e.$$typeof === $S) && // React Fragment type
    e.type === PS
  );
}
const RS = Number(h.version.split(".")[0]), _S = (e, n) => {
  typeof e == "function" ? e(n) : typeof e == "object" && e && "current" in e && (e.current = n);
}, Js = (...e) => {
  const n = e.filter(Boolean);
  return n.length <= 1 ? n[0] : (o) => {
    e.forEach((i) => {
      _S(i, o);
    });
  };
}, Rd = (...e) => Pd(
  () => Js(...e),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  e,
  (n, o) => n.length !== o.length || n.every((i, l) => i !== o[l])
), _d = (e) => {
  if (!e)
    return !1;
  if (Nd(e) && RS >= 19)
    return !0;
  const n = Vu.isMemo(e) ? e.type.type : e.type;
  return !(typeof n == "function" && !n.prototype?.render && n.$$typeof !== Vu.ForwardRef || typeof e == "function" && !e.prototype?.render && e.$$typeof !== Vu.ForwardRef);
};
function Nd(e) {
  return /* @__PURE__ */ h.isValidElement(e) && !I0(e);
}
const NS = (e) => Nd(e) && _d(e), Qa = (e) => {
  if (e && Nd(e)) {
    const n = e;
    return n.props.propertyIsEnumerable("ref") ? n.props.ref : n.ref;
  }
  return null;
};
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
const Nm = "data-rc-order", km = "data-rc-priority", MS = "rc-util-key", vf = /* @__PURE__ */ new Map();
function F0({
  mark: e
} = {}) {
  return e ? e.startsWith("data-") ? e : `data-${e}` : MS;
}
function Za(e) {
  return e.attachTo ? e.attachTo : document.querySelector("head") || document.body;
}
function TS(e) {
  return e === "queue" ? "prependQueue" : e ? "prepend" : "append";
}
function kd(e) {
  return Array.from((vf.get(e) || e).children).filter((n) => n.tagName === "STYLE");
}
function O0(e, n = {}) {
  if (!Qn())
    return null;
  const {
    csp: o,
    prepend: i,
    priority: l = 0
  } = n, c = TS(i), f = c === "prependQueue", p = document.createElement("style");
  p.setAttribute(Nm, c), f && l && p.setAttribute(km, `${l}`), o?.nonce && (p.nonce = o?.nonce), p.innerHTML = e;
  const g = Za(n), {
    firstChild: m
  } = g;
  if (i) {
    if (f) {
      const v = (n.styles || kd(g)).filter((y) => {
        if (!["prepend", "prependQueue"].includes(y.getAttribute(Nm)))
          return !1;
        const w = Number(y.getAttribute(km) || 0);
        return l >= w;
      });
      if (v.length)
        return g.insertBefore(p, v[v.length - 1].nextSibling), p;
    }
    g.insertBefore(p, m);
  } else
    g.appendChild(p);
  return p;
}
function A0(e, n = {}) {
  let {
    styles: o
  } = n;
  return o ||= kd(Za(n)), o.find((i) => i.getAttribute(F0(n)) === e);
}
function Hs(e, n = {}) {
  const o = A0(e, n);
  o && Za(n).removeChild(o);
}
function IS(e, n) {
  const o = vf.get(e);
  if (!o || !kS(document, o)) {
    const i = O0("", n), {
      parentNode: l
    } = i;
    vf.set(e, l), e.removeChild(i);
  }
}
function Do(e, n, o = {}) {
  const i = Za(o), l = kd(i), c = {
    ...o,
    styles: l
  };
  IS(i, c);
  const f = A0(n, c);
  if (f)
    return c.csp?.nonce && f.nonce !== c.csp?.nonce && (f.nonce = c.csp?.nonce), f.innerHTML !== e && (f.innerHTML = e), f;
  const p = O0(e, c);
  return p.setAttribute(F0(c), n), p;
}
function Ni(e) {
  return e instanceof HTMLElement || e instanceof SVGElement;
}
function Md(e) {
  return e && typeof e == "object" && Ni(e.nativeElement) ? e.nativeElement : Ni(e) ? e : null;
}
const FS = ((e) => {
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
function OS(e, n) {
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
function L0(e) {
  return e?.getRootNode?.();
}
function AS(e) {
  return L0(e) instanceof ShadowRoot;
}
function Sf(e) {
  return AS(e) ? L0(e) : null;
}
const Is = {
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
function LS(e) {
  const n = `rc-scrollbar-measure-${Math.random().toString(36).substring(7)}`, o = document.createElement("div");
  o.id = n;
  const i = o.style;
  i.position = "absolute", i.left = "0", i.top = "0", i.width = "100px", i.height = "100px", i.overflow = "scroll";
  let l, c;
  if (e) {
    const g = getComputedStyle(e);
    i.scrollbarColor = g.scrollbarColor, i.scrollbarWidth = g.scrollbarWidth;
    const m = getComputedStyle(e, "::-webkit-scrollbar"), v = parseInt(m.width, 10), y = parseInt(m.height, 10);
    try {
      const w = v ? `width: ${m.width};` : "", x = y ? `height: ${m.height};` : "";
      Do(`
#${n}::-webkit-scrollbar {
${w}
${x}
}`, n);
    } catch (w) {
      console.error(w), l = v, c = y;
    }
  }
  document.body.appendChild(o);
  const f = e && l && !Number.isNaN(l) ? l : o.offsetWidth - o.clientWidth, p = e && c && !Number.isNaN(c) ? c : o.offsetHeight - o.clientHeight;
  return document.body.removeChild(o), Hs(n), {
    width: f,
    height: p
  };
}
function zS(e) {
  return typeof document > "u" || !e || !(e instanceof Element) ? {
    width: 0,
    height: 0
  } : LS(e);
}
let wf = {};
const BS = (e) => {
};
function DS(e, n) {
}
function jS(e, n) {
}
function HS() {
  wf = {};
}
function z0(e, n, o) {
  !n && !wf[o] && (e(!1, o), wf[o] = !0);
}
function Fn(e, n) {
  z0(DS, e, n);
}
function VS(e, n) {
  z0(jS, e, n);
}
Fn.preMessage = BS;
Fn.resetWarned = HS;
Fn.noteOnce = VS;
function Cf(e, n, o = !1) {
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
      for (let v = 0; v < c.length; v++)
        if (!l(c[v], f[v], m))
          return !1;
      return !0;
    }
    if (c && f && typeof c == "object" && typeof f == "object") {
      const v = Object.keys(c);
      return v.length !== Object.keys(f).length ? !1 : v.every((y) => l(c[y], f[y], m));
    }
    return !1;
  }
  return l(e, n);
}
var ws = { exports: {} }, Mm;
function WS() {
  if (Mm) return ws.exports;
  Mm = 1, ws.exports = i, ws.exports.isMobile = i, ws.exports.default = i;
  const e = /(android|bb\d+|meego).+mobile|armv7l|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|redmi|series[46]0|samsungbrowser.*mobile|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i, n = /CrOS/, o = /android|ipad|playbook|silk/i;
  function i(l) {
    l || (l = {});
    let c = l.ua;
    if (!c && typeof navigator < "u" && (c = navigator.userAgent), c && c.headers && typeof c.headers["user-agent"] == "string" && (c = c.headers["user-agent"]), typeof c != "string") return !1;
    let f = e.test(c) && !n.test(c) || !!l.tablet && o.test(c);
    return !f && l.tablet && l.featureDetect && navigator && navigator.maxTouchPoints > 1 && c.indexOf("Macintosh") !== -1 && c.indexOf("Safari") !== -1 && (f = !0), f;
  }
  return ws.exports;
}
WS();
function La(e, n) {
  const o = Object.assign({}, e);
  return Array.isArray(n) && n.forEach((i) => {
    delete o[i];
  }), o;
}
const US = `accept acceptCharset accessKey action allowFullScreen allowTransparency
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
    summary tabIndex target title type useMap value width wmode wrap`, qS = `onCopy onCut onPaste onCompositionEnd onCompositionStart onCompositionUpdate onKeyDown
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
    onAuxClick onToggle onBeforeToggle onCancel onClose onResize onScrollEnd`, XS = `${US} ${qS}`.split(/[\s\n]+/), GS = "aria-", YS = "data-";
function Tm(e, n) {
  return e.indexOf(n) === 0;
}
function KS(e, n = !1) {
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
    (o.aria && (l === "role" || Tm(l, GS)) || // Data
    o.data && Tm(l, YS) || // Attr
    o.attr && XS.includes(l)) && (i[l] = e[l]);
  }), i;
}
function QS(e, n) {
  return typeof Proxy < "u" && e ? new Proxy(e, {
    get(o, i) {
      if (n[i])
        return n[i];
      const l = o[i];
      return typeof l == "function" ? l.bind(o) : l;
    }
  }) : e;
}
function Vs(e, n = {}) {
  let o = [];
  return Se.Children.forEach(e, (i) => {
    i == null && !n.keepEmpty || (Array.isArray(i) ? o = o.concat(Vs(i)) : I0(i) && i.props ? o = o.concat(Vs(i.props.children, n)) : o.push(i));
  }), o;
}
function Kn(e, n) {
  let o = e;
  for (let i = 0; i < n.length; i += 1) {
    if (o == null)
      return;
    o = o[n[i]];
  }
  return o;
}
function B0(e, n, o, i) {
  if (!n.length)
    return o;
  const [l, ...c] = n;
  let f;
  return !e && typeof l == "number" ? f = [] : Array.isArray(e) ? f = [...e] : f = {
    ...e
  }, i && o === void 0 && c.length === 1 ? delete f[l][c[0]] : f[l] = B0(f[l], c, o, i), f;
}
function Tn(e, n, o, i = !1) {
  return n.length && i && o === void 0 && !Kn(e, n.slice(0, -1)) ? e : B0(e, n, o, i);
}
function ZS(e) {
  return typeof e == "object" && e !== null && Object.getPrototypeOf(e) === Object.prototype;
}
function Im(e) {
  return Array.isArray(e) ? [] : {};
}
const JS = typeof Reflect > "u" ? Object.keys : Reflect.ownKeys;
function ew(e, n = {}) {
  const {
    prepareArray: o
  } = n, i = o || (() => []);
  let l = Im(e[0]);
  return e.forEach((c) => {
    function f(p, g) {
      const m = new Set(g), v = Kn(c, p), y = Array.isArray(v);
      if (y || ZS(v)) {
        if (!m.has(v)) {
          m.add(v);
          const w = Kn(l, p);
          y ? l = Tn(l, p, i(w, v)) : (!w || typeof w != "object") && (l = Tn(l, p, Im(v))), JS(v).forEach((x) => {
            Object.getOwnPropertyDescriptor(v, x).enumerable && f([...p, x], m);
          });
        }
      } else
        l = Tn(l, p, v);
    }
    f([]);
  }), l;
}
function $i(...e) {
  return ew(e);
}
var aa = {}, Wu = { exports: {} }, Cn = {}, Uu = { exports: {} }, qu = {};
var Fm;
function tw() {
  return Fm || (Fm = 1, (function(e) {
    function n(j, J) {
      var U = j.length;
      j.push(J);
      e: for (; 0 < U; ) {
        var k = U - 1 >>> 1, O = j[k];
        if (0 < l(O, J)) j[k] = J, j[U] = O, U = k;
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
        e: for (var k = 0, O = j.length, ee = O >>> 1; k < ee; ) {
          var te = 2 * (k + 1) - 1, se = j[te], re = te + 1, fe = j[re];
          if (0 > l(se, U)) re < O && 0 > l(fe, se) ? (j[k] = fe, j[re] = U, k = re) : (j[k] = se, j[te] = U, k = te);
          else if (re < O && 0 > l(fe, U)) j[k] = fe, j[re] = U, k = re;
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
    var g = [], m = [], v = 1, y = null, w = 3, x = !1, E = !1, C = !1, b = typeof setTimeout == "function" ? setTimeout : null, $ = typeof clearTimeout == "function" ? clearTimeout : null, _ = typeof setImmediate < "u" ? setImmediate : null;
    typeof navigator < "u" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 && navigator.scheduling.isInputPending.bind(navigator.scheduling);
    function R(j) {
      for (var J = o(m); J !== null; ) {
        if (J.callback === null) i(m);
        else if (J.startTime <= j) i(m), J.sortIndex = J.expirationTime, n(g, J);
        else break;
        J = o(m);
      }
    }
    function N(j) {
      if (C = !1, R(j), !E) if (o(g) !== null) E = !0, le(T);
      else {
        var J = o(m);
        J !== null && he(N, J.startTime - j);
      }
    }
    function T(j, J) {
      E = !1, C && (C = !1, $(A), A = -1), x = !0;
      var U = w;
      try {
        for (R(J), y = o(g); y !== null && (!(y.expirationTime > J) || j && !V()); ) {
          var k = y.callback;
          if (typeof k == "function") {
            y.callback = null, w = y.priorityLevel;
            var O = k(y.expirationTime <= J);
            J = e.unstable_now(), typeof O == "function" ? y.callback = O : y === o(g) && i(g), R(J);
          } else i(g);
          y = o(g);
        }
        if (y !== null) var ee = !0;
        else {
          var te = o(m);
          te !== null && he(N, te.startTime - J), ee = !1;
        }
        return ee;
      } finally {
        y = null, w = U, x = !1;
      }
    }
    var L = !1, F = null, A = -1, H = 5, Y = -1;
    function V() {
      return !(e.unstable_now() - Y < H);
    }
    function X() {
      if (F !== null) {
        var j = e.unstable_now();
        Y = j;
        var J = !0;
        try {
          J = F(!0, j);
        } finally {
          J ? Q() : (L = !1, F = null);
        }
      } else L = !1;
    }
    var Q;
    if (typeof _ == "function") Q = function() {
      _(X);
    };
    else if (typeof MessageChannel < "u") {
      var oe = new MessageChannel(), G = oe.port2;
      oe.port1.onmessage = X, Q = function() {
        G.postMessage(null);
      };
    } else Q = function() {
      b(X, 0);
    };
    function le(j) {
      F = j, L || (L = !0, Q());
    }
    function he(j, J) {
      A = b(function() {
        j(e.unstable_now());
      }, J);
    }
    e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(j) {
      j.callback = null;
    }, e.unstable_continueExecution = function() {
      E || x || (E = !0, le(T));
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
          var O = -1;
          break;
        case 2:
          O = 250;
          break;
        case 5:
          O = 1073741823;
          break;
        case 4:
          O = 1e4;
          break;
        default:
          O = 5e3;
      }
      return O = U + O, j = { id: v++, callback: J, priorityLevel: j, startTime: U, expirationTime: O, sortIndex: -1 }, U > k ? (j.sortIndex = U, n(m, j), o(g) === null && j === o(m) && (C ? ($(A), A = -1) : C = !0, he(N, U - k))) : (j.sortIndex = O, n(g, j), E || x || (E = !0, le(T))), j;
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
  })(qu)), qu;
}
var Om;
function nw() {
  return Om || (Om = 1, Uu.exports = tw()), Uu.exports;
}
var Am;
function rw() {
  if (Am) return Cn;
  Am = 1;
  var e = Ed(), n = nw();
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
  var p = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), g = Object.prototype.hasOwnProperty, m = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, v = {}, y = {};
  function w(t) {
    return g.call(y, t) ? !0 : g.call(v, t) ? !1 : m.test(t) ? y[t] = !0 : (v[t] = !0, !1);
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
  function E(t, r, s, a) {
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
  var b = {};
  "children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(t) {
    b[t] = new C(t, 0, !1, t, null, !1, !1);
  }), [["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(t) {
    var r = t[0];
    b[r] = new C(r, 1, !1, t[1], null, !1, !1);
  }), ["contentEditable", "draggable", "spellCheck", "value"].forEach(function(t) {
    b[t] = new C(t, 2, !1, t.toLowerCase(), null, !1, !1);
  }), ["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(t) {
    b[t] = new C(t, 2, !1, t, null, !1, !1);
  }), "allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(t) {
    b[t] = new C(t, 3, !1, t.toLowerCase(), null, !1, !1);
  }), ["checked", "multiple", "muted", "selected"].forEach(function(t) {
    b[t] = new C(t, 3, !0, t, null, !1, !1);
  }), ["capture", "download"].forEach(function(t) {
    b[t] = new C(t, 4, !1, t, null, !1, !1);
  }), ["cols", "rows", "size", "span"].forEach(function(t) {
    b[t] = new C(t, 6, !1, t, null, !1, !1);
  }), ["rowSpan", "start"].forEach(function(t) {
    b[t] = new C(t, 5, !1, t.toLowerCase(), null, !1, !1);
  });
  var $ = /[\-:]([a-z])/g;
  function _(t) {
    return t[1].toUpperCase();
  }
  "accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(t) {
    var r = t.replace(
      $,
      _
    );
    b[r] = new C(r, 1, !1, t, null, !1, !1);
  }), "xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(t) {
    var r = t.replace($, _);
    b[r] = new C(r, 1, !1, t, "http://www.w3.org/1999/xlink", !1, !1);
  }), ["xml:base", "xml:lang", "xml:space"].forEach(function(t) {
    var r = t.replace($, _);
    b[r] = new C(r, 1, !1, t, "http://www.w3.org/XML/1998/namespace", !1, !1);
  }), ["tabIndex", "crossOrigin"].forEach(function(t) {
    b[t] = new C(t, 1, !1, t.toLowerCase(), null, !1, !1);
  }), b.xlinkHref = new C("xlinkHref", 1, !1, "xlink:href", "http://www.w3.org/1999/xlink", !0, !1), ["src", "href", "action", "formAction"].forEach(function(t) {
    b[t] = new C(t, 1, !1, t.toLowerCase(), null, !0, !0);
  });
  function R(t, r, s, a) {
    var u = b.hasOwnProperty(r) ? b[r] : null;
    (u !== null ? u.type !== 0 : a || !(2 < r.length) || r[0] !== "o" && r[0] !== "O" || r[1] !== "n" && r[1] !== "N") && (E(r, s, u, a) && (s = null), a || u === null ? w(r) && (s === null ? t.removeAttribute(r) : t.setAttribute(r, "" + s)) : u.mustUseProperty ? t[u.propertyName] = s === null ? u.type === 3 ? !1 : "" : s : (r = u.attributeName, a = u.attributeNamespace, s === null ? t.removeAttribute(r) : (u = u.type, s = u === 3 || u === 4 && s === !0 ? "" : "" + s, a ? t.setAttributeNS(a, r, s) : t.setAttribute(r, s))));
  }
  var N = e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, T = /* @__PURE__ */ Symbol.for("react.element"), L = /* @__PURE__ */ Symbol.for("react.portal"), F = /* @__PURE__ */ Symbol.for("react.fragment"), A = /* @__PURE__ */ Symbol.for("react.strict_mode"), H = /* @__PURE__ */ Symbol.for("react.profiler"), Y = /* @__PURE__ */ Symbol.for("react.provider"), V = /* @__PURE__ */ Symbol.for("react.context"), X = /* @__PURE__ */ Symbol.for("react.forward_ref"), Q = /* @__PURE__ */ Symbol.for("react.suspense"), oe = /* @__PURE__ */ Symbol.for("react.suspense_list"), G = /* @__PURE__ */ Symbol.for("react.memo"), le = /* @__PURE__ */ Symbol.for("react.lazy"), he = /* @__PURE__ */ Symbol.for("react.offscreen"), j = Symbol.iterator;
  function J(t) {
    return t === null || typeof t != "object" ? null : (t = j && t[j] || t["@@iterator"], typeof t == "function" ? t : null);
  }
  var U = Object.assign, k;
  function O(t) {
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
`), S = u.length - 1, P = d.length - 1; 1 <= S && 0 <= P && u[S] !== d[P]; ) P--;
        for (; 1 <= S && 0 <= P; S--, P--) if (u[S] !== d[P]) {
          if (S !== 1 || P !== 1)
            do
              if (S--, P--, 0 > P || u[S] !== d[P]) {
                var M = `
` + u[S].replace(" at new ", " at ");
                return t.displayName && M.includes("<anonymous>") && (M = M.replace("<anonymous>", t.displayName)), M;
              }
            while (1 <= S && 0 <= P);
          break;
        }
      }
    } finally {
      ee = !1, Error.prepareStackTrace = s;
    }
    return (t = t ? t.displayName || t.name : "") ? O(t) : "";
  }
  function se(t) {
    switch (t.tag) {
      case 5:
        return O(t.type);
      case 16:
        return O("Lazy");
      case 13:
        return O("Suspense");
      case 19:
        return O("SuspenseList");
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
      case F:
        return "Fragment";
      case L:
        return "Portal";
      case H:
        return "Profiler";
      case A:
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
        return r === A ? "StrictMode" : "Mode";
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
  function _e(t, r) {
    var s = r.defaultValue == null ? "" : r.defaultValue, a = r.checked != null ? r.checked : r.defaultChecked;
    s = ie(r.value != null ? r.value : s), t._wrapperState = { initialChecked: a, initialValue: s, controlled: r.type === "checkbox" || r.type === "radio" ? r.checked != null : r.value != null };
  }
  function Xe(t, r) {
    r = r.checked, r != null && R(t, "checked", r, !1);
  }
  function ut(t, r) {
    Xe(t, r);
    var s = ie(r.value), a = r.type;
    if (s != null) a === "number" ? (s === 0 && t.value === "" || t.value != s) && (t.value = "" + s) : t.value !== "" + s && (t.value = "" + s);
    else if (a === "submit" || a === "reset") {
      t.removeAttribute("value");
      return;
    }
    r.hasOwnProperty("value") ? Ct(t, r.type, s) : r.hasOwnProperty("defaultValue") && Ct(t, r.type, ie(r.defaultValue)), r.checked == null && r.defaultChecked != null && (t.defaultChecked = !!r.defaultChecked);
  }
  function Ae(t, r, s) {
    if (r.hasOwnProperty("value") || r.hasOwnProperty("defaultValue")) {
      var a = r.type;
      if (!(a !== "submit" && a !== "reset" || r.value !== void 0 && r.value !== null)) return;
      r = "" + t._wrapperState.initialValue, s || r === t.value || (t.value = r), t.defaultValue = r;
    }
    s = t.name, s !== "" && (t.name = ""), t.defaultChecked = !!t._wrapperState.initialChecked, s !== "" && (t.name = s);
  }
  function Ct(t, r, s) {
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
  function _t(t) {
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
    return t == null || t === "http://www.w3.org/1999/xhtml" ? _t(r) : t === "http://www.w3.org/2000/svg" && r === "foreignObject" ? "http://www.w3.org/1999/xhtml" : t;
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
  var Le = U({ menuitem: !0 }, { area: !0, base: !0, br: !0, col: !0, embed: !0, hr: !0, img: !0, input: !0, keygen: !0, link: !0, meta: !0, param: !0, source: !0, track: !0, wbr: !0 });
  function Oe(t, r) {
    if (r) {
      if (Le[t] && (r.children != null || r.dangerouslySetInnerHTML != null)) throw Error(o(137, t));
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
  var nt = null, Kt = null, Mt = null;
  function En(t) {
    if (t = is(t)) {
      if (typeof nt != "function") throw Error(o(280));
      var r = t.stateNode;
      r && (r = bl(r), nt(t.stateNode, t.type, r));
    }
  }
  function $n(t) {
    Kt ? Mt ? Mt.push(t) : Mt = [t] : Kt = t;
  }
  function de() {
    if (Kt) {
      var t = Kt, r = Mt;
      if (Mt = Kt = null, En(t), r) for (t = 0; t < r.length; t++) En(r[t]);
    }
  }
  function Ee(t, r) {
    return t(r);
  }
  function Ce() {
  }
  var bt = !1;
  function Qt(t, r, s) {
    if (bt) return t(r, s);
    bt = !0;
    try {
      return Ee(t, r, s);
    } finally {
      bt = !1, (Kt !== null || Mt !== null) && (Ce(), de());
    }
  }
  function Tt(t, r) {
    var s = t.stateNode;
    if (s === null) return null;
    var a = bl(s);
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
    var ln = {};
    Object.defineProperty(ln, "passive", { get: function() {
      An = !0;
    } }), window.addEventListener("test", ln, ln), window.removeEventListener("test", ln, ln);
  } catch {
    An = !1;
  }
  function hr(t, r, s, a, u, d, S, P, M) {
    var D = Array.prototype.slice.call(arguments, 3);
    try {
      r.apply(s, D);
    } catch (q) {
      this.onError(q);
    }
  }
  var Ln = !1, tr = null, Pn = !1, nr = null, dn = { onError: function(t) {
    Ln = !0, tr = t;
  } };
  function Zt(t, r, s, a, u, d, S, P, M) {
    Ln = !1, tr = null, hr.apply(dn, arguments);
  }
  function It(t, r, s, a, u, d, S, P, M) {
    if (Zt.apply(this, arguments), Ln) {
      if (Ln) {
        var D = tr;
        Ln = !1, tr = null;
      } else throw Error(o(198));
      Pn || (Pn = !0, nr = D);
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
  function zt(t) {
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
          if (d === s) return zt(u), t;
          if (d === a) return zt(u), r;
          d = d.sibling;
        }
        throw Error(o(188));
      }
      if (s.return !== a.return) s = u, a = d;
      else {
        for (var S = !1, P = u.child; P; ) {
          if (P === s) {
            S = !0, s = u, a = d;
            break;
          }
          if (P === a) {
            S = !0, a = u, s = d;
            break;
          }
          P = P.sibling;
        }
        if (!S) {
          for (P = d.child; P; ) {
            if (P === s) {
              S = !0, s = d, a = u;
              break;
            }
            if (P === a) {
              S = !0, a = d, s = u;
              break;
            }
            P = P.sibling;
          }
          if (!S) throw Error(o(189));
        }
      }
      if (s.alternate !== a) throw Error(o(190));
    }
    if (s.tag !== 3) throw Error(o(188));
    return s.stateNode.current === s ? t : r;
  }
  function Wr(t) {
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
  var mr = n.unstable_scheduleCallback, Ur = n.unstable_cancelCallback, dt = n.unstable_shouldYield, Jt = n.unstable_requestPaint, Be = n.unstable_now, zn = n.unstable_getCurrentPriorityLevel, Bn = n.unstable_ImmediatePriority, $r = n.unstable_UserBlockingPriority, en = n.unstable_NormalPriority, Pr = n.unstable_LowPriority, Dn = n.unstable_IdlePriority, mn = null, at = null;
  function Re(t) {
    if (at && typeof at.onCommitFiberRoot == "function") try {
      at.onCommitFiberRoot(mn, t, void 0, (t.current.flags & 128) === 128);
    } catch {
    }
  }
  var et = Math.clz32 ? Math.clz32 : Rr, Bt = Math.log, vo = Math.LN2;
  function Rr(t) {
    return t >>>= 0, t === 0 ? 32 : 31 - (Bt(t) / vo | 0) | 0;
  }
  var _r = 64, Nr = 4194304;
  function gr(t) {
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
  function So(t, r) {
    var s = t.pendingLanes;
    if (s === 0) return 0;
    var a = 0, u = t.suspendedLanes, d = t.pingedLanes, S = s & 268435455;
    if (S !== 0) {
      var P = S & ~u;
      P !== 0 ? a = gr(P) : (d &= S, d !== 0 && (a = gr(d)));
    } else S = s & ~u, S !== 0 ? a = gr(S) : d !== 0 && (a = gr(d));
    if (a === 0) return 0;
    if (r !== 0 && r !== a && (r & u) === 0 && (u = a & -a, d = r & -r, u >= d || u === 16 && (d & 4194240) !== 0)) return r;
    if ((a & 4) !== 0 && (a |= s & 16), r = t.entangledLanes, r !== 0) for (t = t.entanglements, r &= a; 0 < r; ) s = 31 - et(r), u = 1 << s, a |= t[s], r &= ~u;
    return a;
  }
  function Di(t, r) {
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
  function ji(t, r) {
    for (var s = t.suspendedLanes, a = t.pingedLanes, u = t.expirationTimes, d = t.pendingLanes; 0 < d; ) {
      var S = 31 - et(d), P = 1 << S, M = u[S];
      M === -1 ? ((P & s) === 0 || (P & a) !== 0) && (u[S] = Di(P, r)) : M <= r && (t.expiredLanes |= P), d &= ~P;
    }
  }
  function Hi(t) {
    return t = t.pendingLanes & -1073741825, t !== 0 ? t : t & 1073741824 ? 1073741824 : 0;
  }
  function ue() {
    var t = _r;
    return _r <<= 1, (_r & 4194240) === 0 && (_r = 64), t;
  }
  function Fe(t) {
    for (var r = [], s = 0; 31 > s; s++) r.push(t);
    return r;
  }
  function yr(t, r, s) {
    t.pendingLanes |= r, r !== 536870912 && (t.suspendedLanes = 0, t.pingedLanes = 0), t = t.eventTimes, r = 31 - et(r), t[r] = s;
  }
  function cc(t, r) {
    var s = t.pendingLanes & ~r;
    t.pendingLanes = r, t.suspendedLanes = 0, t.pingedLanes = 0, t.expiredLanes &= r, t.mutableReadLanes &= r, t.entangledLanes &= r, r = t.entanglements;
    var a = t.eventTimes;
    for (t = t.expirationTimes; 0 < s; ) {
      var u = 31 - et(s), d = 1 << u;
      r[u] = 0, a[u] = -1, t[u] = -1, s &= ~d;
    }
  }
  function Go(t, r) {
    var s = t.entangledLanes |= r;
    for (t = t.entanglements; s; ) {
      var a = 31 - et(s), u = 1 << a;
      u & r | t[a] & r && (t[a] |= r), s &= ~u;
    }
  }
  var De = 0;
  function ll(t) {
    return t &= -t, 1 < t ? 4 < t ? (t & 268435455) !== 0 ? 16 : 536870912 : 4 : 1;
  }
  var ep, uc, tp, np, rp, fc = !1, al = [], qr = null, Xr = null, Gr = null, Vi = /* @__PURE__ */ new Map(), Wi = /* @__PURE__ */ new Map(), Yr = [], zv = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
  function op(t, r) {
    switch (t) {
      case "focusin":
      case "focusout":
        qr = null;
        break;
      case "dragenter":
      case "dragleave":
        Xr = null;
        break;
      case "mouseover":
      case "mouseout":
        Gr = null;
        break;
      case "pointerover":
      case "pointerout":
        Vi.delete(r.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        Wi.delete(r.pointerId);
    }
  }
  function Ui(t, r, s, a, u, d) {
    return t === null || t.nativeEvent !== d ? (t = { blockedOn: r, domEventName: s, eventSystemFlags: a, nativeEvent: d, targetContainers: [u] }, r !== null && (r = is(r), r !== null && uc(r)), t) : (t.eventSystemFlags |= a, r = t.targetContainers, u !== null && r.indexOf(u) === -1 && r.push(u), t);
  }
  function Bv(t, r, s, a, u) {
    switch (r) {
      case "focusin":
        return qr = Ui(qr, t, r, s, a, u), !0;
      case "dragenter":
        return Xr = Ui(Xr, t, r, s, a, u), !0;
      case "mouseover":
        return Gr = Ui(Gr, t, r, s, a, u), !0;
      case "pointerover":
        var d = u.pointerId;
        return Vi.set(d, Ui(Vi.get(d) || null, t, r, s, a, u)), !0;
      case "gotpointercapture":
        return d = u.pointerId, Wi.set(d, Ui(Wi.get(d) || null, t, r, s, a, u)), !0;
    }
    return !1;
  }
  function ip(t) {
    var r = wo(t.target);
    if (r !== null) {
      var s = yt(r);
      if (s !== null) {
        if (r = s.tag, r === 13) {
          if (r = pn(s), r !== null) {
            t.blockedOn = r, rp(t.priority, function() {
              tp(s);
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
  function cl(t) {
    if (t.blockedOn !== null) return !1;
    for (var r = t.targetContainers; 0 < r.length; ) {
      var s = pc(t.domEventName, t.eventSystemFlags, r[0], t.nativeEvent);
      if (s === null) {
        s = t.nativeEvent;
        var a = new s.constructor(s.type, s);
        gt = a, s.target.dispatchEvent(a), gt = null;
      } else return r = is(s), r !== null && uc(r), t.blockedOn = s, !1;
      r.shift();
    }
    return !0;
  }
  function sp(t, r, s) {
    cl(t) && s.delete(r);
  }
  function Dv() {
    fc = !1, qr !== null && cl(qr) && (qr = null), Xr !== null && cl(Xr) && (Xr = null), Gr !== null && cl(Gr) && (Gr = null), Vi.forEach(sp), Wi.forEach(sp);
  }
  function qi(t, r) {
    t.blockedOn === r && (t.blockedOn = null, fc || (fc = !0, n.unstable_scheduleCallback(n.unstable_NormalPriority, Dv)));
  }
  function Xi(t) {
    function r(u) {
      return qi(u, t);
    }
    if (0 < al.length) {
      qi(al[0], t);
      for (var s = 1; s < al.length; s++) {
        var a = al[s];
        a.blockedOn === t && (a.blockedOn = null);
      }
    }
    for (qr !== null && qi(qr, t), Xr !== null && qi(Xr, t), Gr !== null && qi(Gr, t), Vi.forEach(r), Wi.forEach(r), s = 0; s < Yr.length; s++) a = Yr[s], a.blockedOn === t && (a.blockedOn = null);
    for (; 0 < Yr.length && (s = Yr[0], s.blockedOn === null); ) ip(s), s.blockedOn === null && Yr.shift();
  }
  var Yo = N.ReactCurrentBatchConfig, ul = !0;
  function jv(t, r, s, a) {
    var u = De, d = Yo.transition;
    Yo.transition = null;
    try {
      De = 1, dc(t, r, s, a);
    } finally {
      De = u, Yo.transition = d;
    }
  }
  function Hv(t, r, s, a) {
    var u = De, d = Yo.transition;
    Yo.transition = null;
    try {
      De = 4, dc(t, r, s, a);
    } finally {
      De = u, Yo.transition = d;
    }
  }
  function dc(t, r, s, a) {
    if (ul) {
      var u = pc(t, r, s, a);
      if (u === null) kc(t, r, a, fl, s), op(t, a);
      else if (Bv(u, t, r, s, a)) a.stopPropagation();
      else if (op(t, a), r & 4 && -1 < zv.indexOf(t)) {
        for (; u !== null; ) {
          var d = is(u);
          if (d !== null && ep(d), d = pc(t, r, s, a), d === null && kc(t, r, a, fl, s), d === u) break;
          u = d;
        }
        u !== null && a.stopPropagation();
      } else kc(t, r, a, null, s);
    }
  }
  var fl = null;
  function pc(t, r, s, a) {
    if (fl = null, t = qt(a), t = wo(t), t !== null) if (r = yt(t), r === null) t = null;
    else if (s = r.tag, s === 13) {
      if (t = pn(r), t !== null) return t;
      t = null;
    } else if (s === 3) {
      if (r.stateNode.current.memoizedState.isDehydrated) return r.tag === 3 ? r.stateNode.containerInfo : null;
      t = null;
    } else r !== t && (t = null);
    return fl = t, null;
  }
  function lp(t) {
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
        switch (zn()) {
          case Bn:
            return 1;
          case $r:
            return 4;
          case en:
          case Pr:
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
  var Kr = null, hc = null, dl = null;
  function ap() {
    if (dl) return dl;
    var t, r = hc, s = r.length, a, u = "value" in Kr ? Kr.value : Kr.textContent, d = u.length;
    for (t = 0; t < s && r[t] === u[t]; t++) ;
    var S = s - t;
    for (a = 1; a <= S && r[s - a] === u[d - a]; a++) ;
    return dl = u.slice(t, 1 < a ? 1 - a : void 0);
  }
  function pl(t) {
    var r = t.keyCode;
    return "charCode" in t ? (t = t.charCode, t === 0 && r === 13 && (t = 13)) : t = r, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
  }
  function hl() {
    return !0;
  }
  function cp() {
    return !1;
  }
  function Rn(t) {
    function r(s, a, u, d, S) {
      this._reactName = s, this._targetInst = u, this.type = a, this.nativeEvent = d, this.target = S, this.currentTarget = null;
      for (var P in t) t.hasOwnProperty(P) && (s = t[P], this[P] = s ? s(d) : d[P]);
      return this.isDefaultPrevented = (d.defaultPrevented != null ? d.defaultPrevented : d.returnValue === !1) ? hl : cp, this.isPropagationStopped = cp, this;
    }
    return U(r.prototype, { preventDefault: function() {
      this.defaultPrevented = !0;
      var s = this.nativeEvent;
      s && (s.preventDefault ? s.preventDefault() : typeof s.returnValue != "unknown" && (s.returnValue = !1), this.isDefaultPrevented = hl);
    }, stopPropagation: function() {
      var s = this.nativeEvent;
      s && (s.stopPropagation ? s.stopPropagation() : typeof s.cancelBubble != "unknown" && (s.cancelBubble = !0), this.isPropagationStopped = hl);
    }, persist: function() {
    }, isPersistent: hl }), r;
  }
  var Ko = { eventPhase: 0, bubbles: 0, cancelable: 0, timeStamp: function(t) {
    return t.timeStamp || Date.now();
  }, defaultPrevented: 0, isTrusted: 0 }, mc = Rn(Ko), Gi = U({}, Ko, { view: 0, detail: 0 }), Vv = Rn(Gi), gc, yc, Yi, ml = U({}, Gi, { screenX: 0, screenY: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, getModifierState: Sc, button: 0, buttons: 0, relatedTarget: function(t) {
    return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
  }, movementX: function(t) {
    return "movementX" in t ? t.movementX : (t !== Yi && (Yi && t.type === "mousemove" ? (gc = t.screenX - Yi.screenX, yc = t.screenY - Yi.screenY) : yc = gc = 0, Yi = t), gc);
  }, movementY: function(t) {
    return "movementY" in t ? t.movementY : yc;
  } }), up = Rn(ml), Wv = U({}, ml, { dataTransfer: 0 }), Uv = Rn(Wv), qv = U({}, Gi, { relatedTarget: 0 }), vc = Rn(qv), Xv = U({}, Ko, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }), Gv = Rn(Xv), Yv = U({}, Ko, { clipboardData: function(t) {
    return "clipboardData" in t ? t.clipboardData : window.clipboardData;
  } }), Kv = Rn(Yv), Qv = U({}, Ko, { data: 0 }), fp = Rn(Qv), Zv = {
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
  }, Jv = {
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
  }, e1 = { Alt: "altKey", Control: "ctrlKey", Meta: "metaKey", Shift: "shiftKey" };
  function t1(t) {
    var r = this.nativeEvent;
    return r.getModifierState ? r.getModifierState(t) : (t = e1[t]) ? !!r[t] : !1;
  }
  function Sc() {
    return t1;
  }
  var n1 = U({}, Gi, { key: function(t) {
    if (t.key) {
      var r = Zv[t.key] || t.key;
      if (r !== "Unidentified") return r;
    }
    return t.type === "keypress" ? (t = pl(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? Jv[t.keyCode] || "Unidentified" : "";
  }, code: 0, location: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, repeat: 0, locale: 0, getModifierState: Sc, charCode: function(t) {
    return t.type === "keypress" ? pl(t) : 0;
  }, keyCode: function(t) {
    return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
  }, which: function(t) {
    return t.type === "keypress" ? pl(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
  } }), r1 = Rn(n1), o1 = U({}, ml, { pointerId: 0, width: 0, height: 0, pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0, pointerType: 0, isPrimary: 0 }), dp = Rn(o1), i1 = U({}, Gi, { touches: 0, targetTouches: 0, changedTouches: 0, altKey: 0, metaKey: 0, ctrlKey: 0, shiftKey: 0, getModifierState: Sc }), s1 = Rn(i1), l1 = U({}, Ko, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }), a1 = Rn(l1), c1 = U({}, ml, {
    deltaX: function(t) {
      return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
    },
    deltaY: function(t) {
      return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), u1 = Rn(c1), f1 = [9, 13, 27, 32], wc = p && "CompositionEvent" in window, Ki = null;
  p && "documentMode" in document && (Ki = document.documentMode);
  var d1 = p && "TextEvent" in window && !Ki, pp = p && (!wc || Ki && 8 < Ki && 11 >= Ki), hp = " ", mp = !1;
  function gp(t, r) {
    switch (t) {
      case "keyup":
        return f1.indexOf(r.keyCode) !== -1;
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
  function yp(t) {
    return t = t.detail, typeof t == "object" && "data" in t ? t.data : null;
  }
  var Qo = !1;
  function p1(t, r) {
    switch (t) {
      case "compositionend":
        return yp(r);
      case "keypress":
        return r.which !== 32 ? null : (mp = !0, hp);
      case "textInput":
        return t = r.data, t === hp && mp ? null : t;
      default:
        return null;
    }
  }
  function h1(t, r) {
    if (Qo) return t === "compositionend" || !wc && gp(t, r) ? (t = ap(), dl = hc = Kr = null, Qo = !1, t) : null;
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
        return pp && r.locale !== "ko" ? null : r.data;
      default:
        return null;
    }
  }
  var m1 = { color: !0, date: !0, datetime: !0, "datetime-local": !0, email: !0, month: !0, number: !0, password: !0, range: !0, search: !0, tel: !0, text: !0, time: !0, url: !0, week: !0 };
  function vp(t) {
    var r = t && t.nodeName && t.nodeName.toLowerCase();
    return r === "input" ? !!m1[t.type] : r === "textarea";
  }
  function Sp(t, r, s, a) {
    $n(a), r = wl(r, "onChange"), 0 < r.length && (s = new mc("onChange", "change", null, s, a), t.push({ event: s, listeners: r }));
  }
  var Qi = null, Zi = null;
  function g1(t) {
    Lp(t, 0);
  }
  function gl(t) {
    var r = ni(t);
    if (ke(r)) return t;
  }
  function y1(t, r) {
    if (t === "change") return r;
  }
  var wp = !1;
  if (p) {
    var Cc;
    if (p) {
      var xc = "oninput" in document;
      if (!xc) {
        var Cp = document.createElement("div");
        Cp.setAttribute("oninput", "return;"), xc = typeof Cp.oninput == "function";
      }
      Cc = xc;
    } else Cc = !1;
    wp = Cc && (!document.documentMode || 9 < document.documentMode);
  }
  function xp() {
    Qi && (Qi.detachEvent("onpropertychange", bp), Zi = Qi = null);
  }
  function bp(t) {
    if (t.propertyName === "value" && gl(Zi)) {
      var r = [];
      Sp(r, Zi, t, qt(t)), Qt(g1, r);
    }
  }
  function v1(t, r, s) {
    t === "focusin" ? (xp(), Qi = r, Zi = s, Qi.attachEvent("onpropertychange", bp)) : t === "focusout" && xp();
  }
  function S1(t) {
    if (t === "selectionchange" || t === "keyup" || t === "keydown") return gl(Zi);
  }
  function w1(t, r) {
    if (t === "click") return gl(r);
  }
  function C1(t, r) {
    if (t === "input" || t === "change") return gl(r);
  }
  function x1(t, r) {
    return t === r && (t !== 0 || 1 / t === 1 / r) || t !== t && r !== r;
  }
  var rr = typeof Object.is == "function" ? Object.is : x1;
  function Ji(t, r) {
    if (rr(t, r)) return !0;
    if (typeof t != "object" || t === null || typeof r != "object" || r === null) return !1;
    var s = Object.keys(t), a = Object.keys(r);
    if (s.length !== a.length) return !1;
    for (a = 0; a < s.length; a++) {
      var u = s[a];
      if (!g.call(r, u) || !rr(t[u], r[u])) return !1;
    }
    return !0;
  }
  function Ep(t) {
    for (; t && t.firstChild; ) t = t.firstChild;
    return t;
  }
  function $p(t, r) {
    var s = Ep(t);
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
      s = Ep(s);
    }
  }
  function Pp(t, r) {
    return t && r ? t === r ? !0 : t && t.nodeType === 3 ? !1 : r && r.nodeType === 3 ? Pp(t, r.parentNode) : "contains" in t ? t.contains(r) : t.compareDocumentPosition ? !!(t.compareDocumentPosition(r) & 16) : !1 : !1;
  }
  function Rp() {
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
  function bc(t) {
    var r = t && t.nodeName && t.nodeName.toLowerCase();
    return r && (r === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || r === "textarea" || t.contentEditable === "true");
  }
  function b1(t) {
    var r = Rp(), s = t.focusedElem, a = t.selectionRange;
    if (r !== s && s && s.ownerDocument && Pp(s.ownerDocument.documentElement, s)) {
      if (a !== null && bc(s)) {
        if (r = a.start, t = a.end, t === void 0 && (t = r), "selectionStart" in s) s.selectionStart = r, s.selectionEnd = Math.min(t, s.value.length);
        else if (t = (r = s.ownerDocument || document) && r.defaultView || window, t.getSelection) {
          t = t.getSelection();
          var u = s.textContent.length, d = Math.min(a.start, u);
          a = a.end === void 0 ? d : Math.min(a.end, u), !t.extend && d > a && (u = a, a = d, d = u), u = $p(s, d);
          var S = $p(
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
  var E1 = p && "documentMode" in document && 11 >= document.documentMode, Zo = null, Ec = null, es = null, $c = !1;
  function _p(t, r, s) {
    var a = s.window === s ? s.document : s.nodeType === 9 ? s : s.ownerDocument;
    $c || Zo == null || Zo !== qe(a) || (a = Zo, "selectionStart" in a && bc(a) ? a = { start: a.selectionStart, end: a.selectionEnd } : (a = (a.ownerDocument && a.ownerDocument.defaultView || window).getSelection(), a = { anchorNode: a.anchorNode, anchorOffset: a.anchorOffset, focusNode: a.focusNode, focusOffset: a.focusOffset }), es && Ji(es, a) || (es = a, a = wl(Ec, "onSelect"), 0 < a.length && (r = new mc("onSelect", "select", null, r, s), t.push({ event: r, listeners: a }), r.target = Zo)));
  }
  function yl(t, r) {
    var s = {};
    return s[t.toLowerCase()] = r.toLowerCase(), s["Webkit" + t] = "webkit" + r, s["Moz" + t] = "moz" + r, s;
  }
  var Jo = { animationend: yl("Animation", "AnimationEnd"), animationiteration: yl("Animation", "AnimationIteration"), animationstart: yl("Animation", "AnimationStart"), transitionend: yl("Transition", "TransitionEnd") }, Pc = {}, Np = {};
  p && (Np = document.createElement("div").style, "AnimationEvent" in window || (delete Jo.animationend.animation, delete Jo.animationiteration.animation, delete Jo.animationstart.animation), "TransitionEvent" in window || delete Jo.transitionend.transition);
  function vl(t) {
    if (Pc[t]) return Pc[t];
    if (!Jo[t]) return t;
    var r = Jo[t], s;
    for (s in r) if (r.hasOwnProperty(s) && s in Np) return Pc[t] = r[s];
    return t;
  }
  var kp = vl("animationend"), Mp = vl("animationiteration"), Tp = vl("animationstart"), Ip = vl("transitionend"), Fp = /* @__PURE__ */ new Map(), Op = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
  function Qr(t, r) {
    Fp.set(t, r), c(r, [t]);
  }
  for (var Rc = 0; Rc < Op.length; Rc++) {
    var _c = Op[Rc], $1 = _c.toLowerCase(), P1 = _c[0].toUpperCase() + _c.slice(1);
    Qr($1, "on" + P1);
  }
  Qr(kp, "onAnimationEnd"), Qr(Mp, "onAnimationIteration"), Qr(Tp, "onAnimationStart"), Qr("dblclick", "onDoubleClick"), Qr("focusin", "onFocus"), Qr("focusout", "onBlur"), Qr(Ip, "onTransitionEnd"), f("onMouseEnter", ["mouseout", "mouseover"]), f("onMouseLeave", ["mouseout", "mouseover"]), f("onPointerEnter", ["pointerout", "pointerover"]), f("onPointerLeave", ["pointerout", "pointerover"]), c("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), c("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), c("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]), c("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), c("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), c("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
  var ts = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), R1 = new Set("cancel close invalid load scroll toggle".split(" ").concat(ts));
  function Ap(t, r, s) {
    var a = t.type || "unknown-event";
    t.currentTarget = s, It(a, r, void 0, t), t.currentTarget = null;
  }
  function Lp(t, r) {
    r = (r & 4) !== 0;
    for (var s = 0; s < t.length; s++) {
      var a = t[s], u = a.event;
      a = a.listeners;
      e: {
        var d = void 0;
        if (r) for (var S = a.length - 1; 0 <= S; S--) {
          var P = a[S], M = P.instance, D = P.currentTarget;
          if (P = P.listener, M !== d && u.isPropagationStopped()) break e;
          Ap(u, P, D), d = M;
        }
        else for (S = 0; S < a.length; S++) {
          if (P = a[S], M = P.instance, D = P.currentTarget, P = P.listener, M !== d && u.isPropagationStopped()) break e;
          Ap(u, P, D), d = M;
        }
      }
    }
    if (Pn) throw t = nr, Pn = !1, nr = null, t;
  }
  function it(t, r) {
    var s = r[Ac];
    s === void 0 && (s = r[Ac] = /* @__PURE__ */ new Set());
    var a = t + "__bubble";
    s.has(a) || (zp(r, t, 2, !1), s.add(a));
  }
  function Nc(t, r, s) {
    var a = 0;
    r && (a |= 4), zp(s, t, a, r);
  }
  var Sl = "_reactListening" + Math.random().toString(36).slice(2);
  function ns(t) {
    if (!t[Sl]) {
      t[Sl] = !0, i.forEach(function(s) {
        s !== "selectionchange" && (R1.has(s) || Nc(s, !1, t), Nc(s, !0, t));
      });
      var r = t.nodeType === 9 ? t : t.ownerDocument;
      r === null || r[Sl] || (r[Sl] = !0, Nc("selectionchange", !1, r));
    }
  }
  function zp(t, r, s, a) {
    switch (lp(r)) {
      case 1:
        var u = jv;
        break;
      case 4:
        u = Hv;
        break;
      default:
        u = dc;
    }
    s = u.bind(null, r, s, t), u = void 0, !An || r !== "touchstart" && r !== "touchmove" && r !== "wheel" || (u = !0), a ? u !== void 0 ? t.addEventListener(r, s, { capture: !0, passive: u }) : t.addEventListener(r, s, !0) : u !== void 0 ? t.addEventListener(r, s, { passive: u }) : t.addEventListener(r, s, !1);
  }
  function kc(t, r, s, a, u) {
    var d = a;
    if ((r & 1) === 0 && (r & 2) === 0 && a !== null) e: for (; ; ) {
      if (a === null) return;
      var S = a.tag;
      if (S === 3 || S === 4) {
        var P = a.stateNode.containerInfo;
        if (P === u || P.nodeType === 8 && P.parentNode === u) break;
        if (S === 4) for (S = a.return; S !== null; ) {
          var M = S.tag;
          if ((M === 3 || M === 4) && (M = S.stateNode.containerInfo, M === u || M.nodeType === 8 && M.parentNode === u)) return;
          S = S.return;
        }
        for (; P !== null; ) {
          if (S = wo(P), S === null) return;
          if (M = S.tag, M === 5 || M === 6) {
            a = d = S;
            continue e;
          }
          P = P.parentNode;
        }
      }
      a = a.return;
    }
    Qt(function() {
      var D = d, q = qt(s), K = [];
      e: {
        var W = Fp.get(t);
        if (W !== void 0) {
          var pe = mc, ge = t;
          switch (t) {
            case "keypress":
              if (pl(s) === 0) break e;
            case "keydown":
            case "keyup":
              pe = r1;
              break;
            case "focusin":
              ge = "focus", pe = vc;
              break;
            case "focusout":
              ge = "blur", pe = vc;
              break;
            case "beforeblur":
            case "afterblur":
              pe = vc;
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
              pe = up;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              pe = Uv;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              pe = s1;
              break;
            case kp:
            case Mp:
            case Tp:
              pe = Gv;
              break;
            case Ip:
              pe = a1;
              break;
            case "scroll":
              pe = Vv;
              break;
            case "wheel":
              pe = u1;
              break;
            case "copy":
            case "cut":
            case "paste":
              pe = Kv;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              pe = dp;
          }
          var ye = (r & 4) !== 0, xt = !ye && t === "scroll", z = ye ? W !== null ? W + "Capture" : null : W;
          ye = [];
          for (var I = D, B; I !== null; ) {
            B = I;
            var ne = B.stateNode;
            if (B.tag === 5 && ne !== null && (B = ne, z !== null && (ne = Tt(I, z), ne != null && ye.push(rs(I, ne, B)))), xt) break;
            I = I.return;
          }
          0 < ye.length && (W = new pe(W, ge, null, s, q), K.push({ event: W, listeners: ye }));
        }
      }
      if ((r & 7) === 0) {
        e: {
          if (W = t === "mouseover" || t === "pointerover", pe = t === "mouseout" || t === "pointerout", W && s !== gt && (ge = s.relatedTarget || s.fromElement) && (wo(ge) || ge[kr])) break e;
          if ((pe || W) && (W = q.window === q ? q : (W = q.ownerDocument) ? W.defaultView || W.parentWindow : window, pe ? (ge = s.relatedTarget || s.toElement, pe = D, ge = ge ? wo(ge) : null, ge !== null && (xt = yt(ge), ge !== xt || ge.tag !== 5 && ge.tag !== 6) && (ge = null)) : (pe = null, ge = D), pe !== ge)) {
            if (ye = up, ne = "onMouseLeave", z = "onMouseEnter", I = "mouse", (t === "pointerout" || t === "pointerover") && (ye = dp, ne = "onPointerLeave", z = "onPointerEnter", I = "pointer"), xt = pe == null ? W : ni(pe), B = ge == null ? W : ni(ge), W = new ye(ne, I + "leave", pe, s, q), W.target = xt, W.relatedTarget = B, ne = null, wo(q) === D && (ye = new ye(z, I + "enter", ge, s, q), ye.target = B, ye.relatedTarget = xt, ne = ye), xt = ne, pe && ge) t: {
              for (ye = pe, z = ge, I = 0, B = ye; B; B = ei(B)) I++;
              for (B = 0, ne = z; ne; ne = ei(ne)) B++;
              for (; 0 < I - B; ) ye = ei(ye), I--;
              for (; 0 < B - I; ) z = ei(z), B--;
              for (; I--; ) {
                if (ye === z || z !== null && ye === z.alternate) break t;
                ye = ei(ye), z = ei(z);
              }
              ye = null;
            }
            else ye = null;
            pe !== null && Bp(K, W, pe, ye, !1), ge !== null && xt !== null && Bp(K, xt, ge, ye, !0);
          }
        }
        e: {
          if (W = D ? ni(D) : window, pe = W.nodeName && W.nodeName.toLowerCase(), pe === "select" || pe === "input" && W.type === "file") var ve = y1;
          else if (vp(W)) if (wp) ve = C1;
          else {
            ve = S1;
            var xe = v1;
          }
          else (pe = W.nodeName) && pe.toLowerCase() === "input" && (W.type === "checkbox" || W.type === "radio") && (ve = w1);
          if (ve && (ve = ve(t, D))) {
            Sp(K, ve, s, q);
            break e;
          }
          xe && xe(t, W, D), t === "focusout" && (xe = W._wrapperState) && xe.controlled && W.type === "number" && Ct(W, "number", W.value);
        }
        switch (xe = D ? ni(D) : window, t) {
          case "focusin":
            (vp(xe) || xe.contentEditable === "true") && (Zo = xe, Ec = D, es = null);
            break;
          case "focusout":
            es = Ec = Zo = null;
            break;
          case "mousedown":
            $c = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            $c = !1, _p(K, s, q);
            break;
          case "selectionchange":
            if (E1) break;
          case "keydown":
          case "keyup":
            _p(K, s, q);
        }
        var be;
        if (wc) e: {
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
        else Qo ? gp(t, s) && (Pe = "onCompositionEnd") : t === "keydown" && s.keyCode === 229 && (Pe = "onCompositionStart");
        Pe && (pp && s.locale !== "ko" && (Qo || Pe !== "onCompositionStart" ? Pe === "onCompositionEnd" && Qo && (be = ap()) : (Kr = q, hc = "value" in Kr ? Kr.value : Kr.textContent, Qo = !0)), xe = wl(D, Pe), 0 < xe.length && (Pe = new fp(Pe, t, null, s, q), K.push({ event: Pe, listeners: xe }), be ? Pe.data = be : (be = yp(s), be !== null && (Pe.data = be)))), (be = d1 ? p1(t, s) : h1(t, s)) && (D = wl(D, "onBeforeInput"), 0 < D.length && (q = new fp("onBeforeInput", "beforeinput", null, s, q), K.push({ event: q, listeners: D }), q.data = be));
      }
      Lp(K, r);
    });
  }
  function rs(t, r, s) {
    return { instance: t, listener: r, currentTarget: s };
  }
  function wl(t, r) {
    for (var s = r + "Capture", a = []; t !== null; ) {
      var u = t, d = u.stateNode;
      u.tag === 5 && d !== null && (u = d, d = Tt(t, s), d != null && a.unshift(rs(t, d, u)), d = Tt(t, r), d != null && a.push(rs(t, d, u))), t = t.return;
    }
    return a;
  }
  function ei(t) {
    if (t === null) return null;
    do
      t = t.return;
    while (t && t.tag !== 5);
    return t || null;
  }
  function Bp(t, r, s, a, u) {
    for (var d = r._reactName, S = []; s !== null && s !== a; ) {
      var P = s, M = P.alternate, D = P.stateNode;
      if (M !== null && M === a) break;
      P.tag === 5 && D !== null && (P = D, u ? (M = Tt(s, d), M != null && S.unshift(rs(s, M, P))) : u || (M = Tt(s, d), M != null && S.push(rs(s, M, P)))), s = s.return;
    }
    S.length !== 0 && t.push({ event: r, listeners: S });
  }
  var _1 = /\r\n?/g, N1 = /\u0000|\uFFFD/g;
  function Dp(t) {
    return (typeof t == "string" ? t : "" + t).replace(_1, `
`).replace(N1, "");
  }
  function Cl(t, r, s) {
    if (r = Dp(r), Dp(t) !== r && s) throw Error(o(425));
  }
  function xl() {
  }
  var Mc = null, Tc = null;
  function Ic(t, r) {
    return t === "textarea" || t === "noscript" || typeof r.children == "string" || typeof r.children == "number" || typeof r.dangerouslySetInnerHTML == "object" && r.dangerouslySetInnerHTML !== null && r.dangerouslySetInnerHTML.__html != null;
  }
  var Fc = typeof setTimeout == "function" ? setTimeout : void 0, k1 = typeof clearTimeout == "function" ? clearTimeout : void 0, jp = typeof Promise == "function" ? Promise : void 0, M1 = typeof queueMicrotask == "function" ? queueMicrotask : typeof jp < "u" ? function(t) {
    return jp.resolve(null).then(t).catch(T1);
  } : Fc;
  function T1(t) {
    setTimeout(function() {
      throw t;
    });
  }
  function Oc(t, r) {
    var s = r, a = 0;
    do {
      var u = s.nextSibling;
      if (t.removeChild(s), u && u.nodeType === 8) if (s = u.data, s === "/$") {
        if (a === 0) {
          t.removeChild(u), Xi(r);
          return;
        }
        a--;
      } else s !== "$" && s !== "$?" && s !== "$!" || a++;
      s = u;
    } while (s);
    Xi(r);
  }
  function Zr(t) {
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
  function Hp(t) {
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
  var ti = Math.random().toString(36).slice(2), vr = "__reactFiber$" + ti, os = "__reactProps$" + ti, kr = "__reactContainer$" + ti, Ac = "__reactEvents$" + ti, I1 = "__reactListeners$" + ti, F1 = "__reactHandles$" + ti;
  function wo(t) {
    var r = t[vr];
    if (r) return r;
    for (var s = t.parentNode; s; ) {
      if (r = s[kr] || s[vr]) {
        if (s = r.alternate, r.child !== null || s !== null && s.child !== null) for (t = Hp(t); t !== null; ) {
          if (s = t[vr]) return s;
          t = Hp(t);
        }
        return r;
      }
      t = s, s = t.parentNode;
    }
    return null;
  }
  function is(t) {
    return t = t[vr] || t[kr], !t || t.tag !== 5 && t.tag !== 6 && t.tag !== 13 && t.tag !== 3 ? null : t;
  }
  function ni(t) {
    if (t.tag === 5 || t.tag === 6) return t.stateNode;
    throw Error(o(33));
  }
  function bl(t) {
    return t[os] || null;
  }
  var Lc = [], ri = -1;
  function Jr(t) {
    return { current: t };
  }
  function st(t) {
    0 > ri || (t.current = Lc[ri], Lc[ri] = null, ri--);
  }
  function ot(t, r) {
    ri++, Lc[ri] = t.current, t.current = r;
  }
  var eo = {}, tn = Jr(eo), gn = Jr(!1), Co = eo;
  function oi(t, r) {
    var s = t.type.contextTypes;
    if (!s) return eo;
    var a = t.stateNode;
    if (a && a.__reactInternalMemoizedUnmaskedChildContext === r) return a.__reactInternalMemoizedMaskedChildContext;
    var u = {}, d;
    for (d in s) u[d] = r[d];
    return a && (t = t.stateNode, t.__reactInternalMemoizedUnmaskedChildContext = r, t.__reactInternalMemoizedMaskedChildContext = u), u;
  }
  function yn(t) {
    return t = t.childContextTypes, t != null;
  }
  function El() {
    st(gn), st(tn);
  }
  function Vp(t, r, s) {
    if (tn.current !== eo) throw Error(o(168));
    ot(tn, r), ot(gn, s);
  }
  function Wp(t, r, s) {
    var a = t.stateNode;
    if (r = r.childContextTypes, typeof a.getChildContext != "function") return s;
    a = a.getChildContext();
    for (var u in a) if (!(u in r)) throw Error(o(108, fe(t) || "Unknown", u));
    return U({}, s, a);
  }
  function $l(t) {
    return t = (t = t.stateNode) && t.__reactInternalMemoizedMergedChildContext || eo, Co = tn.current, ot(tn, t), ot(gn, gn.current), !0;
  }
  function Up(t, r, s) {
    var a = t.stateNode;
    if (!a) throw Error(o(169));
    s ? (t = Wp(t, r, Co), a.__reactInternalMemoizedMergedChildContext = t, st(gn), st(tn), ot(tn, t)) : st(gn), ot(gn, s);
  }
  var Mr = null, Pl = !1, zc = !1;
  function qp(t) {
    Mr === null ? Mr = [t] : Mr.push(t);
  }
  function O1(t) {
    Pl = !0, qp(t);
  }
  function to() {
    if (!zc && Mr !== null) {
      zc = !0;
      var t = 0, r = De;
      try {
        var s = Mr;
        for (De = 1; t < s.length; t++) {
          var a = s[t];
          do
            a = a(!0);
          while (a !== null);
        }
        Mr = null, Pl = !1;
      } catch (u) {
        throw Mr !== null && (Mr = Mr.slice(t + 1)), mr(Bn, to), u;
      } finally {
        De = r, zc = !1;
      }
    }
    return null;
  }
  var ii = [], si = 0, Rl = null, _l = 0, jn = [], Hn = 0, xo = null, Tr = 1, Ir = "";
  function bo(t, r) {
    ii[si++] = _l, ii[si++] = Rl, Rl = t, _l = r;
  }
  function Xp(t, r, s) {
    jn[Hn++] = Tr, jn[Hn++] = Ir, jn[Hn++] = xo, xo = t;
    var a = Tr;
    t = Ir;
    var u = 32 - et(a) - 1;
    a &= ~(1 << u), s += 1;
    var d = 32 - et(r) + u;
    if (30 < d) {
      var S = u - u % 5;
      d = (a & (1 << S) - 1).toString(32), a >>= S, u -= S, Tr = 1 << 32 - et(r) + u | s << u | a, Ir = d + t;
    } else Tr = 1 << d | s << u | a, Ir = t;
  }
  function Bc(t) {
    t.return !== null && (bo(t, 1), Xp(t, 1, 0));
  }
  function Dc(t) {
    for (; t === Rl; ) Rl = ii[--si], ii[si] = null, _l = ii[--si], ii[si] = null;
    for (; t === xo; ) xo = jn[--Hn], jn[Hn] = null, Ir = jn[--Hn], jn[Hn] = null, Tr = jn[--Hn], jn[Hn] = null;
  }
  var _n = null, Nn = null, ct = !1, or = null;
  function Gp(t, r) {
    var s = qn(5, null, null, 0);
    s.elementType = "DELETED", s.stateNode = r, s.return = t, r = t.deletions, r === null ? (t.deletions = [s], t.flags |= 16) : r.push(s);
  }
  function Yp(t, r) {
    switch (t.tag) {
      case 5:
        var s = t.type;
        return r = r.nodeType !== 1 || s.toLowerCase() !== r.nodeName.toLowerCase() ? null : r, r !== null ? (t.stateNode = r, _n = t, Nn = Zr(r.firstChild), !0) : !1;
      case 6:
        return r = t.pendingProps === "" || r.nodeType !== 3 ? null : r, r !== null ? (t.stateNode = r, _n = t, Nn = null, !0) : !1;
      case 13:
        return r = r.nodeType !== 8 ? null : r, r !== null ? (s = xo !== null ? { id: Tr, overflow: Ir } : null, t.memoizedState = { dehydrated: r, treeContext: s, retryLane: 1073741824 }, s = qn(18, null, null, 0), s.stateNode = r, s.return = t, t.child = s, _n = t, Nn = null, !0) : !1;
      default:
        return !1;
    }
  }
  function jc(t) {
    return (t.mode & 1) !== 0 && (t.flags & 128) === 0;
  }
  function Hc(t) {
    if (ct) {
      var r = Nn;
      if (r) {
        var s = r;
        if (!Yp(t, r)) {
          if (jc(t)) throw Error(o(418));
          r = Zr(s.nextSibling);
          var a = _n;
          r && Yp(t, r) ? Gp(a, s) : (t.flags = t.flags & -4097 | 2, ct = !1, _n = t);
        }
      } else {
        if (jc(t)) throw Error(o(418));
        t.flags = t.flags & -4097 | 2, ct = !1, _n = t;
      }
    }
  }
  function Kp(t) {
    for (t = t.return; t !== null && t.tag !== 5 && t.tag !== 3 && t.tag !== 13; ) t = t.return;
    _n = t;
  }
  function Nl(t) {
    if (t !== _n) return !1;
    if (!ct) return Kp(t), ct = !0, !1;
    var r;
    if ((r = t.tag !== 3) && !(r = t.tag !== 5) && (r = t.type, r = r !== "head" && r !== "body" && !Ic(t.type, t.memoizedProps)), r && (r = Nn)) {
      if (jc(t)) throw Qp(), Error(o(418));
      for (; r; ) Gp(t, r), r = Zr(r.nextSibling);
    }
    if (Kp(t), t.tag === 13) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
      e: {
        for (t = t.nextSibling, r = 0; t; ) {
          if (t.nodeType === 8) {
            var s = t.data;
            if (s === "/$") {
              if (r === 0) {
                Nn = Zr(t.nextSibling);
                break e;
              }
              r--;
            } else s !== "$" && s !== "$!" && s !== "$?" || r++;
          }
          t = t.nextSibling;
        }
        Nn = null;
      }
    } else Nn = _n ? Zr(t.stateNode.nextSibling) : null;
    return !0;
  }
  function Qp() {
    for (var t = Nn; t; ) t = Zr(t.nextSibling);
  }
  function li() {
    Nn = _n = null, ct = !1;
  }
  function Vc(t) {
    or === null ? or = [t] : or.push(t);
  }
  var A1 = N.ReactCurrentBatchConfig;
  function ss(t, r, s) {
    if (t = s.ref, t !== null && typeof t != "function" && typeof t != "object") {
      if (s._owner) {
        if (s = s._owner, s) {
          if (s.tag !== 1) throw Error(o(309));
          var a = s.stateNode;
        }
        if (!a) throw Error(o(147, t));
        var u = a, d = "" + t;
        return r !== null && r.ref !== null && typeof r.ref == "function" && r.ref._stringRef === d ? r.ref : (r = function(S) {
          var P = u.refs;
          S === null ? delete P[d] : P[d] = S;
        }, r._stringRef = d, r);
      }
      if (typeof t != "string") throw Error(o(284));
      if (!s._owner) throw Error(o(290, t));
    }
    return t;
  }
  function kl(t, r) {
    throw t = Object.prototype.toString.call(r), Error(o(31, t === "[object Object]" ? "object with keys {" + Object.keys(r).join(", ") + "}" : t));
  }
  function Zp(t) {
    var r = t._init;
    return r(t._payload);
  }
  function Jp(t) {
    function r(z, I) {
      if (t) {
        var B = z.deletions;
        B === null ? (z.deletions = [I], z.flags |= 16) : B.push(I);
      }
    }
    function s(z, I) {
      if (!t) return null;
      for (; I !== null; ) r(z, I), I = I.sibling;
      return null;
    }
    function a(z, I) {
      for (z = /* @__PURE__ */ new Map(); I !== null; ) I.key !== null ? z.set(I.key, I) : z.set(I.index, I), I = I.sibling;
      return z;
    }
    function u(z, I) {
      return z = co(z, I), z.index = 0, z.sibling = null, z;
    }
    function d(z, I, B) {
      return z.index = B, t ? (B = z.alternate, B !== null ? (B = B.index, B < I ? (z.flags |= 2, I) : B) : (z.flags |= 2, I)) : (z.flags |= 1048576, I);
    }
    function S(z) {
      return t && z.alternate === null && (z.flags |= 2), z;
    }
    function P(z, I, B, ne) {
      return I === null || I.tag !== 6 ? (I = Fu(B, z.mode, ne), I.return = z, I) : (I = u(I, B), I.return = z, I);
    }
    function M(z, I, B, ne) {
      var ve = B.type;
      return ve === F ? q(z, I, B.props.children, ne, B.key) : I !== null && (I.elementType === ve || typeof ve == "object" && ve !== null && ve.$$typeof === le && Zp(ve) === I.type) ? (ne = u(I, B.props), ne.ref = ss(z, I, B), ne.return = z, ne) : (ne = ea(B.type, B.key, B.props, null, z.mode, ne), ne.ref = ss(z, I, B), ne.return = z, ne);
    }
    function D(z, I, B, ne) {
      return I === null || I.tag !== 4 || I.stateNode.containerInfo !== B.containerInfo || I.stateNode.implementation !== B.implementation ? (I = Ou(B, z.mode, ne), I.return = z, I) : (I = u(I, B.children || []), I.return = z, I);
    }
    function q(z, I, B, ne, ve) {
      return I === null || I.tag !== 7 ? (I = Mo(B, z.mode, ne, ve), I.return = z, I) : (I = u(I, B), I.return = z, I);
    }
    function K(z, I, B) {
      if (typeof I == "string" && I !== "" || typeof I == "number") return I = Fu("" + I, z.mode, B), I.return = z, I;
      if (typeof I == "object" && I !== null) {
        switch (I.$$typeof) {
          case T:
            return B = ea(I.type, I.key, I.props, null, z.mode, B), B.ref = ss(z, null, I), B.return = z, B;
          case L:
            return I = Ou(I, z.mode, B), I.return = z, I;
          case le:
            var ne = I._init;
            return K(z, ne(I._payload), B);
        }
        if (Ze(I) || J(I)) return I = Mo(I, z.mode, B, null), I.return = z, I;
        kl(z, I);
      }
      return null;
    }
    function W(z, I, B, ne) {
      var ve = I !== null ? I.key : null;
      if (typeof B == "string" && B !== "" || typeof B == "number") return ve !== null ? null : P(z, I, "" + B, ne);
      if (typeof B == "object" && B !== null) {
        switch (B.$$typeof) {
          case T:
            return B.key === ve ? M(z, I, B, ne) : null;
          case L:
            return B.key === ve ? D(z, I, B, ne) : null;
          case le:
            return ve = B._init, W(
              z,
              I,
              ve(B._payload),
              ne
            );
        }
        if (Ze(B) || J(B)) return ve !== null ? null : q(z, I, B, ne, null);
        kl(z, B);
      }
      return null;
    }
    function pe(z, I, B, ne, ve) {
      if (typeof ne == "string" && ne !== "" || typeof ne == "number") return z = z.get(B) || null, P(I, z, "" + ne, ve);
      if (typeof ne == "object" && ne !== null) {
        switch (ne.$$typeof) {
          case T:
            return z = z.get(ne.key === null ? B : ne.key) || null, M(I, z, ne, ve);
          case L:
            return z = z.get(ne.key === null ? B : ne.key) || null, D(I, z, ne, ve);
          case le:
            var xe = ne._init;
            return pe(z, I, B, xe(ne._payload), ve);
        }
        if (Ze(ne) || J(ne)) return z = z.get(B) || null, q(I, z, ne, ve, null);
        kl(I, ne);
      }
      return null;
    }
    function ge(z, I, B, ne) {
      for (var ve = null, xe = null, be = I, Pe = I = 0, Ht = null; be !== null && Pe < B.length; Pe++) {
        be.index > Pe ? (Ht = be, be = null) : Ht = be.sibling;
        var je = W(z, be, B[Pe], ne);
        if (je === null) {
          be === null && (be = Ht);
          break;
        }
        t && be && je.alternate === null && r(z, be), I = d(je, I, Pe), xe === null ? ve = je : xe.sibling = je, xe = je, be = Ht;
      }
      if (Pe === B.length) return s(z, be), ct && bo(z, Pe), ve;
      if (be === null) {
        for (; Pe < B.length; Pe++) be = K(z, B[Pe], ne), be !== null && (I = d(be, I, Pe), xe === null ? ve = be : xe.sibling = be, xe = be);
        return ct && bo(z, Pe), ve;
      }
      for (be = a(z, be); Pe < B.length; Pe++) Ht = pe(be, z, Pe, B[Pe], ne), Ht !== null && (t && Ht.alternate !== null && be.delete(Ht.key === null ? Pe : Ht.key), I = d(Ht, I, Pe), xe === null ? ve = Ht : xe.sibling = Ht, xe = Ht);
      return t && be.forEach(function(uo) {
        return r(z, uo);
      }), ct && bo(z, Pe), ve;
    }
    function ye(z, I, B, ne) {
      var ve = J(B);
      if (typeof ve != "function") throw Error(o(150));
      if (B = ve.call(B), B == null) throw Error(o(151));
      for (var xe = ve = null, be = I, Pe = I = 0, Ht = null, je = B.next(); be !== null && !je.done; Pe++, je = B.next()) {
        be.index > Pe ? (Ht = be, be = null) : Ht = be.sibling;
        var uo = W(z, be, je.value, ne);
        if (uo === null) {
          be === null && (be = Ht);
          break;
        }
        t && be && uo.alternate === null && r(z, be), I = d(uo, I, Pe), xe === null ? ve = uo : xe.sibling = uo, xe = uo, be = Ht;
      }
      if (je.done) return s(
        z,
        be
      ), ct && bo(z, Pe), ve;
      if (be === null) {
        for (; !je.done; Pe++, je = B.next()) je = K(z, je.value, ne), je !== null && (I = d(je, I, Pe), xe === null ? ve = je : xe.sibling = je, xe = je);
        return ct && bo(z, Pe), ve;
      }
      for (be = a(z, be); !je.done; Pe++, je = B.next()) je = pe(be, z, Pe, je.value, ne), je !== null && (t && je.alternate !== null && be.delete(je.key === null ? Pe : je.key), I = d(je, I, Pe), xe === null ? ve = je : xe.sibling = je, xe = je);
      return t && be.forEach(function(mS) {
        return r(z, mS);
      }), ct && bo(z, Pe), ve;
    }
    function xt(z, I, B, ne) {
      if (typeof B == "object" && B !== null && B.type === F && B.key === null && (B = B.props.children), typeof B == "object" && B !== null) {
        switch (B.$$typeof) {
          case T:
            e: {
              for (var ve = B.key, xe = I; xe !== null; ) {
                if (xe.key === ve) {
                  if (ve = B.type, ve === F) {
                    if (xe.tag === 7) {
                      s(z, xe.sibling), I = u(xe, B.props.children), I.return = z, z = I;
                      break e;
                    }
                  } else if (xe.elementType === ve || typeof ve == "object" && ve !== null && ve.$$typeof === le && Zp(ve) === xe.type) {
                    s(z, xe.sibling), I = u(xe, B.props), I.ref = ss(z, xe, B), I.return = z, z = I;
                    break e;
                  }
                  s(z, xe);
                  break;
                } else r(z, xe);
                xe = xe.sibling;
              }
              B.type === F ? (I = Mo(B.props.children, z.mode, ne, B.key), I.return = z, z = I) : (ne = ea(B.type, B.key, B.props, null, z.mode, ne), ne.ref = ss(z, I, B), ne.return = z, z = ne);
            }
            return S(z);
          case L:
            e: {
              for (xe = B.key; I !== null; ) {
                if (I.key === xe) if (I.tag === 4 && I.stateNode.containerInfo === B.containerInfo && I.stateNode.implementation === B.implementation) {
                  s(z, I.sibling), I = u(I, B.children || []), I.return = z, z = I;
                  break e;
                } else {
                  s(z, I);
                  break;
                }
                else r(z, I);
                I = I.sibling;
              }
              I = Ou(B, z.mode, ne), I.return = z, z = I;
            }
            return S(z);
          case le:
            return xe = B._init, xt(z, I, xe(B._payload), ne);
        }
        if (Ze(B)) return ge(z, I, B, ne);
        if (J(B)) return ye(z, I, B, ne);
        kl(z, B);
      }
      return typeof B == "string" && B !== "" || typeof B == "number" ? (B = "" + B, I !== null && I.tag === 6 ? (s(z, I.sibling), I = u(I, B), I.return = z, z = I) : (s(z, I), I = Fu(B, z.mode, ne), I.return = z, z = I), S(z)) : s(z, I);
    }
    return xt;
  }
  var ai = Jp(!0), eh = Jp(!1), Ml = Jr(null), Tl = null, ci = null, Wc = null;
  function Uc() {
    Wc = ci = Tl = null;
  }
  function qc(t) {
    var r = Ml.current;
    st(Ml), t._currentValue = r;
  }
  function Xc(t, r, s) {
    for (; t !== null; ) {
      var a = t.alternate;
      if ((t.childLanes & r) !== r ? (t.childLanes |= r, a !== null && (a.childLanes |= r)) : a !== null && (a.childLanes & r) !== r && (a.childLanes |= r), t === s) break;
      t = t.return;
    }
  }
  function ui(t, r) {
    Tl = t, Wc = ci = null, t = t.dependencies, t !== null && t.firstContext !== null && ((t.lanes & r) !== 0 && (vn = !0), t.firstContext = null);
  }
  function Vn(t) {
    var r = t._currentValue;
    if (Wc !== t) if (t = { context: t, memoizedValue: r, next: null }, ci === null) {
      if (Tl === null) throw Error(o(308));
      ci = t, Tl.dependencies = { lanes: 0, firstContext: t };
    } else ci = ci.next = t;
    return r;
  }
  var Eo = null;
  function Gc(t) {
    Eo === null ? Eo = [t] : Eo.push(t);
  }
  function th(t, r, s, a) {
    var u = r.interleaved;
    return u === null ? (s.next = s, Gc(r)) : (s.next = u.next, u.next = s), r.interleaved = s, Fr(t, a);
  }
  function Fr(t, r) {
    t.lanes |= r;
    var s = t.alternate;
    for (s !== null && (s.lanes |= r), s = t, t = t.return; t !== null; ) t.childLanes |= r, s = t.alternate, s !== null && (s.childLanes |= r), s = t, t = t.return;
    return s.tag === 3 ? s.stateNode : null;
  }
  var no = !1;
  function Yc(t) {
    t.updateQueue = { baseState: t.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
  }
  function nh(t, r) {
    t = t.updateQueue, r.updateQueue === t && (r.updateQueue = { baseState: t.baseState, firstBaseUpdate: t.firstBaseUpdate, lastBaseUpdate: t.lastBaseUpdate, shared: t.shared, effects: t.effects });
  }
  function Or(t, r) {
    return { eventTime: t, lane: r, tag: 0, payload: null, callback: null, next: null };
  }
  function ro(t, r, s) {
    var a = t.updateQueue;
    if (a === null) return null;
    if (a = a.shared, (ze & 2) !== 0) {
      var u = a.pending;
      return u === null ? r.next = r : (r.next = u.next, u.next = r), a.pending = r, Fr(t, s);
    }
    return u = a.interleaved, u === null ? (r.next = r, Gc(a)) : (r.next = u.next, u.next = r), a.interleaved = r, Fr(t, s);
  }
  function Il(t, r, s) {
    if (r = r.updateQueue, r !== null && (r = r.shared, (s & 4194240) !== 0)) {
      var a = r.lanes;
      a &= t.pendingLanes, s |= a, r.lanes = s, Go(t, s);
    }
  }
  function rh(t, r) {
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
  function Fl(t, r, s, a) {
    var u = t.updateQueue;
    no = !1;
    var d = u.firstBaseUpdate, S = u.lastBaseUpdate, P = u.shared.pending;
    if (P !== null) {
      u.shared.pending = null;
      var M = P, D = M.next;
      M.next = null, S === null ? d = D : S.next = D, S = M;
      var q = t.alternate;
      q !== null && (q = q.updateQueue, P = q.lastBaseUpdate, P !== S && (P === null ? q.firstBaseUpdate = D : P.next = D, q.lastBaseUpdate = M));
    }
    if (d !== null) {
      var K = u.baseState;
      S = 0, q = D = M = null, P = d;
      do {
        var W = P.lane, pe = P.eventTime;
        if ((a & W) === W) {
          q !== null && (q = q.next = {
            eventTime: pe,
            lane: 0,
            tag: P.tag,
            payload: P.payload,
            callback: P.callback,
            next: null
          });
          e: {
            var ge = t, ye = P;
            switch (W = r, pe = s, ye.tag) {
              case 1:
                if (ge = ye.payload, typeof ge == "function") {
                  K = ge.call(pe, K, W);
                  break e;
                }
                K = ge;
                break e;
              case 3:
                ge.flags = ge.flags & -65537 | 128;
              case 0:
                if (ge = ye.payload, W = typeof ge == "function" ? ge.call(pe, K, W) : ge, W == null) break e;
                K = U({}, K, W);
                break e;
              case 2:
                no = !0;
            }
          }
          P.callback !== null && P.lane !== 0 && (t.flags |= 64, W = u.effects, W === null ? u.effects = [P] : W.push(P));
        } else pe = { eventTime: pe, lane: W, tag: P.tag, payload: P.payload, callback: P.callback, next: null }, q === null ? (D = q = pe, M = K) : q = q.next = pe, S |= W;
        if (P = P.next, P === null) {
          if (P = u.shared.pending, P === null) break;
          W = P, P = W.next, W.next = null, u.lastBaseUpdate = W, u.shared.pending = null;
        }
      } while (!0);
      if (q === null && (M = K), u.baseState = M, u.firstBaseUpdate = D, u.lastBaseUpdate = q, r = u.shared.interleaved, r !== null) {
        u = r;
        do
          S |= u.lane, u = u.next;
        while (u !== r);
      } else d === null && (u.shared.lanes = 0);
      Ro |= S, t.lanes = S, t.memoizedState = K;
    }
  }
  function oh(t, r, s) {
    if (t = r.effects, r.effects = null, t !== null) for (r = 0; r < t.length; r++) {
      var a = t[r], u = a.callback;
      if (u !== null) {
        if (a.callback = null, a = s, typeof u != "function") throw Error(o(191, u));
        u.call(a);
      }
    }
  }
  var ls = {}, Sr = Jr(ls), as = Jr(ls), cs = Jr(ls);
  function $o(t) {
    if (t === ls) throw Error(o(174));
    return t;
  }
  function Kc(t, r) {
    switch (ot(cs, r), ot(as, t), ot(Sr, ls), t = r.nodeType, t) {
      case 9:
      case 11:
        r = (r = r.documentElement) ? r.namespaceURI : Wt(null, "");
        break;
      default:
        t = t === 8 ? r.parentNode : r, r = t.namespaceURI || null, t = t.tagName, r = Wt(r, t);
    }
    st(Sr), ot(Sr, r);
  }
  function fi() {
    st(Sr), st(as), st(cs);
  }
  function ih(t) {
    $o(cs.current);
    var r = $o(Sr.current), s = Wt(r, t.type);
    r !== s && (ot(as, t), ot(Sr, s));
  }
  function Qc(t) {
    as.current === t && (st(Sr), st(as));
  }
  var pt = Jr(0);
  function Ol(t) {
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
  var Zc = [];
  function Jc() {
    for (var t = 0; t < Zc.length; t++) Zc[t]._workInProgressVersionPrimary = null;
    Zc.length = 0;
  }
  var Al = N.ReactCurrentDispatcher, eu = N.ReactCurrentBatchConfig, Po = 0, ht = null, Ft = null, Dt = null, Ll = !1, us = !1, fs = 0, L1 = 0;
  function nn() {
    throw Error(o(321));
  }
  function tu(t, r) {
    if (r === null) return !1;
    for (var s = 0; s < r.length && s < t.length; s++) if (!rr(t[s], r[s])) return !1;
    return !0;
  }
  function nu(t, r, s, a, u, d) {
    if (Po = d, ht = r, r.memoizedState = null, r.updateQueue = null, r.lanes = 0, Al.current = t === null || t.memoizedState === null ? j1 : H1, t = s(a, u), us) {
      d = 0;
      do {
        if (us = !1, fs = 0, 25 <= d) throw Error(o(301));
        d += 1, Dt = Ft = null, r.updateQueue = null, Al.current = V1, t = s(a, u);
      } while (us);
    }
    if (Al.current = Dl, r = Ft !== null && Ft.next !== null, Po = 0, Dt = Ft = ht = null, Ll = !1, r) throw Error(o(300));
    return t;
  }
  function ru() {
    var t = fs !== 0;
    return fs = 0, t;
  }
  function wr() {
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
  function ds(t, r) {
    return typeof r == "function" ? r(t) : r;
  }
  function ou(t) {
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
      var P = S = null, M = null, D = d;
      do {
        var q = D.lane;
        if ((Po & q) === q) M !== null && (M = M.next = { lane: 0, action: D.action, hasEagerState: D.hasEagerState, eagerState: D.eagerState, next: null }), a = D.hasEagerState ? D.eagerState : t(a, D.action);
        else {
          var K = {
            lane: q,
            action: D.action,
            hasEagerState: D.hasEagerState,
            eagerState: D.eagerState,
            next: null
          };
          M === null ? (P = M = K, S = a) : M = M.next = K, ht.lanes |= q, Ro |= q;
        }
        D = D.next;
      } while (D !== null && D !== d);
      M === null ? S = a : M.next = P, rr(a, r.memoizedState) || (vn = !0), r.memoizedState = a, r.baseState = S, r.baseQueue = M, s.lastRenderedState = a;
    }
    if (t = s.interleaved, t !== null) {
      u = t;
      do
        d = u.lane, ht.lanes |= d, Ro |= d, u = u.next;
      while (u !== t);
    } else u === null && (s.lanes = 0);
    return [r.memoizedState, s.dispatch];
  }
  function iu(t) {
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
      rr(d, r.memoizedState) || (vn = !0), r.memoizedState = d, r.baseQueue === null && (r.baseState = d), s.lastRenderedState = d;
    }
    return [d, a];
  }
  function sh() {
  }
  function lh(t, r) {
    var s = ht, a = Wn(), u = r(), d = !rr(a.memoizedState, u);
    if (d && (a.memoizedState = u, vn = !0), a = a.queue, su(uh.bind(null, s, a, t), [t]), a.getSnapshot !== r || d || Dt !== null && Dt.memoizedState.tag & 1) {
      if (s.flags |= 2048, ps(9, ch.bind(null, s, a, u, r), void 0, null), jt === null) throw Error(o(349));
      (Po & 30) !== 0 || ah(s, r, u);
    }
    return u;
  }
  function ah(t, r, s) {
    t.flags |= 16384, t = { getSnapshot: r, value: s }, r = ht.updateQueue, r === null ? (r = { lastEffect: null, stores: null }, ht.updateQueue = r, r.stores = [t]) : (s = r.stores, s === null ? r.stores = [t] : s.push(t));
  }
  function ch(t, r, s, a) {
    r.value = s, r.getSnapshot = a, fh(r) && dh(t);
  }
  function uh(t, r, s) {
    return s(function() {
      fh(r) && dh(t);
    });
  }
  function fh(t) {
    var r = t.getSnapshot;
    t = t.value;
    try {
      var s = r();
      return !rr(t, s);
    } catch {
      return !0;
    }
  }
  function dh(t) {
    var r = Fr(t, 1);
    r !== null && ar(r, t, 1, -1);
  }
  function ph(t) {
    var r = wr();
    return typeof t == "function" && (t = t()), r.memoizedState = r.baseState = t, t = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: ds, lastRenderedState: t }, r.queue = t, t = t.dispatch = D1.bind(null, ht, t), [r.memoizedState, t];
  }
  function ps(t, r, s, a) {
    return t = { tag: t, create: r, destroy: s, deps: a, next: null }, r = ht.updateQueue, r === null ? (r = { lastEffect: null, stores: null }, ht.updateQueue = r, r.lastEffect = t.next = t) : (s = r.lastEffect, s === null ? r.lastEffect = t.next = t : (a = s.next, s.next = t, t.next = a, r.lastEffect = t)), t;
  }
  function hh() {
    return Wn().memoizedState;
  }
  function zl(t, r, s, a) {
    var u = wr();
    ht.flags |= t, u.memoizedState = ps(1 | r, s, void 0, a === void 0 ? null : a);
  }
  function Bl(t, r, s, a) {
    var u = Wn();
    a = a === void 0 ? null : a;
    var d = void 0;
    if (Ft !== null) {
      var S = Ft.memoizedState;
      if (d = S.destroy, a !== null && tu(a, S.deps)) {
        u.memoizedState = ps(r, s, d, a);
        return;
      }
    }
    ht.flags |= t, u.memoizedState = ps(1 | r, s, d, a);
  }
  function mh(t, r) {
    return zl(8390656, 8, t, r);
  }
  function su(t, r) {
    return Bl(2048, 8, t, r);
  }
  function gh(t, r) {
    return Bl(4, 2, t, r);
  }
  function yh(t, r) {
    return Bl(4, 4, t, r);
  }
  function vh(t, r) {
    if (typeof r == "function") return t = t(), r(t), function() {
      r(null);
    };
    if (r != null) return t = t(), r.current = t, function() {
      r.current = null;
    };
  }
  function Sh(t, r, s) {
    return s = s != null ? s.concat([t]) : null, Bl(4, 4, vh.bind(null, r, t), s);
  }
  function lu() {
  }
  function wh(t, r) {
    var s = Wn();
    r = r === void 0 ? null : r;
    var a = s.memoizedState;
    return a !== null && r !== null && tu(r, a[1]) ? a[0] : (s.memoizedState = [t, r], t);
  }
  function Ch(t, r) {
    var s = Wn();
    r = r === void 0 ? null : r;
    var a = s.memoizedState;
    return a !== null && r !== null && tu(r, a[1]) ? a[0] : (t = t(), s.memoizedState = [t, r], t);
  }
  function xh(t, r, s) {
    return (Po & 21) === 0 ? (t.baseState && (t.baseState = !1, vn = !0), t.memoizedState = s) : (rr(s, r) || (s = ue(), ht.lanes |= s, Ro |= s, t.baseState = !0), r);
  }
  function z1(t, r) {
    var s = De;
    De = s !== 0 && 4 > s ? s : 4, t(!0);
    var a = eu.transition;
    eu.transition = {};
    try {
      t(!1), r();
    } finally {
      De = s, eu.transition = a;
    }
  }
  function bh() {
    return Wn().memoizedState;
  }
  function B1(t, r, s) {
    var a = lo(t);
    if (s = { lane: a, action: s, hasEagerState: !1, eagerState: null, next: null }, Eh(t)) $h(r, s);
    else if (s = th(t, r, s, a), s !== null) {
      var u = cn();
      ar(s, t, a, u), Ph(s, r, a);
    }
  }
  function D1(t, r, s) {
    var a = lo(t), u = { lane: a, action: s, hasEagerState: !1, eagerState: null, next: null };
    if (Eh(t)) $h(r, u);
    else {
      var d = t.alternate;
      if (t.lanes === 0 && (d === null || d.lanes === 0) && (d = r.lastRenderedReducer, d !== null)) try {
        var S = r.lastRenderedState, P = d(S, s);
        if (u.hasEagerState = !0, u.eagerState = P, rr(P, S)) {
          var M = r.interleaved;
          M === null ? (u.next = u, Gc(r)) : (u.next = M.next, M.next = u), r.interleaved = u;
          return;
        }
      } catch {
      }
      s = th(t, r, u, a), s !== null && (u = cn(), ar(s, t, a, u), Ph(s, r, a));
    }
  }
  function Eh(t) {
    var r = t.alternate;
    return t === ht || r !== null && r === ht;
  }
  function $h(t, r) {
    us = Ll = !0;
    var s = t.pending;
    s === null ? r.next = r : (r.next = s.next, s.next = r), t.pending = r;
  }
  function Ph(t, r, s) {
    if ((s & 4194240) !== 0) {
      var a = r.lanes;
      a &= t.pendingLanes, s |= a, r.lanes = s, Go(t, s);
    }
  }
  var Dl = { readContext: Vn, useCallback: nn, useContext: nn, useEffect: nn, useImperativeHandle: nn, useInsertionEffect: nn, useLayoutEffect: nn, useMemo: nn, useReducer: nn, useRef: nn, useState: nn, useDebugValue: nn, useDeferredValue: nn, useTransition: nn, useMutableSource: nn, useSyncExternalStore: nn, useId: nn, unstable_isNewReconciler: !1 }, j1 = { readContext: Vn, useCallback: function(t, r) {
    return wr().memoizedState = [t, r === void 0 ? null : r], t;
  }, useContext: Vn, useEffect: mh, useImperativeHandle: function(t, r, s) {
    return s = s != null ? s.concat([t]) : null, zl(
      4194308,
      4,
      vh.bind(null, r, t),
      s
    );
  }, useLayoutEffect: function(t, r) {
    return zl(4194308, 4, t, r);
  }, useInsertionEffect: function(t, r) {
    return zl(4, 2, t, r);
  }, useMemo: function(t, r) {
    var s = wr();
    return r = r === void 0 ? null : r, t = t(), s.memoizedState = [t, r], t;
  }, useReducer: function(t, r, s) {
    var a = wr();
    return r = s !== void 0 ? s(r) : r, a.memoizedState = a.baseState = r, t = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: t, lastRenderedState: r }, a.queue = t, t = t.dispatch = B1.bind(null, ht, t), [a.memoizedState, t];
  }, useRef: function(t) {
    var r = wr();
    return t = { current: t }, r.memoizedState = t;
  }, useState: ph, useDebugValue: lu, useDeferredValue: function(t) {
    return wr().memoizedState = t;
  }, useTransition: function() {
    var t = ph(!1), r = t[0];
    return t = z1.bind(null, t[1]), wr().memoizedState = t, [r, t];
  }, useMutableSource: function() {
  }, useSyncExternalStore: function(t, r, s) {
    var a = ht, u = wr();
    if (ct) {
      if (s === void 0) throw Error(o(407));
      s = s();
    } else {
      if (s = r(), jt === null) throw Error(o(349));
      (Po & 30) !== 0 || ah(a, r, s);
    }
    u.memoizedState = s;
    var d = { value: s, getSnapshot: r };
    return u.queue = d, mh(uh.bind(
      null,
      a,
      d,
      t
    ), [t]), a.flags |= 2048, ps(9, ch.bind(null, a, d, s, r), void 0, null), s;
  }, useId: function() {
    var t = wr(), r = jt.identifierPrefix;
    if (ct) {
      var s = Ir, a = Tr;
      s = (a & ~(1 << 32 - et(a) - 1)).toString(32) + s, r = ":" + r + "R" + s, s = fs++, 0 < s && (r += "H" + s.toString(32)), r += ":";
    } else s = L1++, r = ":" + r + "r" + s.toString(32) + ":";
    return t.memoizedState = r;
  }, unstable_isNewReconciler: !1 }, H1 = {
    readContext: Vn,
    useCallback: wh,
    useContext: Vn,
    useEffect: su,
    useImperativeHandle: Sh,
    useInsertionEffect: gh,
    useLayoutEffect: yh,
    useMemo: Ch,
    useReducer: ou,
    useRef: hh,
    useState: function() {
      return ou(ds);
    },
    useDebugValue: lu,
    useDeferredValue: function(t) {
      var r = Wn();
      return xh(r, Ft.memoizedState, t);
    },
    useTransition: function() {
      var t = ou(ds)[0], r = Wn().memoizedState;
      return [t, r];
    },
    useMutableSource: sh,
    useSyncExternalStore: lh,
    useId: bh,
    unstable_isNewReconciler: !1
  }, V1 = { readContext: Vn, useCallback: wh, useContext: Vn, useEffect: su, useImperativeHandle: Sh, useInsertionEffect: gh, useLayoutEffect: yh, useMemo: Ch, useReducer: iu, useRef: hh, useState: function() {
    return iu(ds);
  }, useDebugValue: lu, useDeferredValue: function(t) {
    var r = Wn();
    return Ft === null ? r.memoizedState = t : xh(r, Ft.memoizedState, t);
  }, useTransition: function() {
    var t = iu(ds)[0], r = Wn().memoizedState;
    return [t, r];
  }, useMutableSource: sh, useSyncExternalStore: lh, useId: bh, unstable_isNewReconciler: !1 };
  function ir(t, r) {
    if (t && t.defaultProps) {
      r = U({}, r), t = t.defaultProps;
      for (var s in t) r[s] === void 0 && (r[s] = t[s]);
      return r;
    }
    return r;
  }
  function au(t, r, s, a) {
    r = t.memoizedState, s = s(a, r), s = s == null ? r : U({}, r, s), t.memoizedState = s, t.lanes === 0 && (t.updateQueue.baseState = s);
  }
  var jl = { isMounted: function(t) {
    return (t = t._reactInternals) ? yt(t) === t : !1;
  }, enqueueSetState: function(t, r, s) {
    t = t._reactInternals;
    var a = cn(), u = lo(t), d = Or(a, u);
    d.payload = r, s != null && (d.callback = s), r = ro(t, d, u), r !== null && (ar(r, t, u, a), Il(r, t, u));
  }, enqueueReplaceState: function(t, r, s) {
    t = t._reactInternals;
    var a = cn(), u = lo(t), d = Or(a, u);
    d.tag = 1, d.payload = r, s != null && (d.callback = s), r = ro(t, d, u), r !== null && (ar(r, t, u, a), Il(r, t, u));
  }, enqueueForceUpdate: function(t, r) {
    t = t._reactInternals;
    var s = cn(), a = lo(t), u = Or(s, a);
    u.tag = 2, r != null && (u.callback = r), r = ro(t, u, a), r !== null && (ar(r, t, a, s), Il(r, t, a));
  } };
  function Rh(t, r, s, a, u, d, S) {
    return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(a, d, S) : r.prototype && r.prototype.isPureReactComponent ? !Ji(s, a) || !Ji(u, d) : !0;
  }
  function _h(t, r, s) {
    var a = !1, u = eo, d = r.contextType;
    return typeof d == "object" && d !== null ? d = Vn(d) : (u = yn(r) ? Co : tn.current, a = r.contextTypes, d = (a = a != null) ? oi(t, u) : eo), r = new r(s, d), t.memoizedState = r.state !== null && r.state !== void 0 ? r.state : null, r.updater = jl, t.stateNode = r, r._reactInternals = t, a && (t = t.stateNode, t.__reactInternalMemoizedUnmaskedChildContext = u, t.__reactInternalMemoizedMaskedChildContext = d), r;
  }
  function Nh(t, r, s, a) {
    t = r.state, typeof r.componentWillReceiveProps == "function" && r.componentWillReceiveProps(s, a), typeof r.UNSAFE_componentWillReceiveProps == "function" && r.UNSAFE_componentWillReceiveProps(s, a), r.state !== t && jl.enqueueReplaceState(r, r.state, null);
  }
  function cu(t, r, s, a) {
    var u = t.stateNode;
    u.props = s, u.state = t.memoizedState, u.refs = {}, Yc(t);
    var d = r.contextType;
    typeof d == "object" && d !== null ? u.context = Vn(d) : (d = yn(r) ? Co : tn.current, u.context = oi(t, d)), u.state = t.memoizedState, d = r.getDerivedStateFromProps, typeof d == "function" && (au(t, r, d, s), u.state = t.memoizedState), typeof r.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (r = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), r !== u.state && jl.enqueueReplaceState(u, u.state, null), Fl(t, s, u, a), u.state = t.memoizedState), typeof u.componentDidMount == "function" && (t.flags |= 4194308);
  }
  function di(t, r) {
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
  function uu(t, r, s) {
    return { value: t, source: null, stack: s ?? null, digest: r ?? null };
  }
  function fu(t, r) {
    try {
      console.error(r.value);
    } catch (s) {
      setTimeout(function() {
        throw s;
      });
    }
  }
  var W1 = typeof WeakMap == "function" ? WeakMap : Map;
  function kh(t, r, s) {
    s = Or(-1, s), s.tag = 3, s.payload = { element: null };
    var a = r.value;
    return s.callback = function() {
      Gl || (Gl = !0, Pu = a), fu(t, r);
    }, s;
  }
  function Mh(t, r, s) {
    s = Or(-1, s), s.tag = 3;
    var a = t.type.getDerivedStateFromError;
    if (typeof a == "function") {
      var u = r.value;
      s.payload = function() {
        return a(u);
      }, s.callback = function() {
        fu(t, r);
      };
    }
    var d = t.stateNode;
    return d !== null && typeof d.componentDidCatch == "function" && (s.callback = function() {
      fu(t, r), typeof a != "function" && (io === null ? io = /* @__PURE__ */ new Set([this]) : io.add(this));
      var S = r.stack;
      this.componentDidCatch(r.value, { componentStack: S !== null ? S : "" });
    }), s;
  }
  function Th(t, r, s) {
    var a = t.pingCache;
    if (a === null) {
      a = t.pingCache = new W1();
      var u = /* @__PURE__ */ new Set();
      a.set(r, u);
    } else u = a.get(r), u === void 0 && (u = /* @__PURE__ */ new Set(), a.set(r, u));
    u.has(s) || (u.add(s), t = oS.bind(null, t, r, s), r.then(t, t));
  }
  function Ih(t) {
    do {
      var r;
      if ((r = t.tag === 13) && (r = t.memoizedState, r = r !== null ? r.dehydrated !== null : !0), r) return t;
      t = t.return;
    } while (t !== null);
    return null;
  }
  function Fh(t, r, s, a, u) {
    return (t.mode & 1) === 0 ? (t === r ? t.flags |= 65536 : (t.flags |= 128, s.flags |= 131072, s.flags &= -52805, s.tag === 1 && (s.alternate === null ? s.tag = 17 : (r = Or(-1, 1), r.tag = 2, ro(s, r, 1))), s.lanes |= 1), t) : (t.flags |= 65536, t.lanes = u, t);
  }
  var U1 = N.ReactCurrentOwner, vn = !1;
  function an(t, r, s, a) {
    r.child = t === null ? eh(r, null, s, a) : ai(r, t.child, s, a);
  }
  function Oh(t, r, s, a, u) {
    s = s.render;
    var d = r.ref;
    return ui(r, u), a = nu(t, r, s, a, d, u), s = ru(), t !== null && !vn ? (r.updateQueue = t.updateQueue, r.flags &= -2053, t.lanes &= ~u, Ar(t, r, u)) : (ct && s && Bc(r), r.flags |= 1, an(t, r, a, u), r.child);
  }
  function Ah(t, r, s, a, u) {
    if (t === null) {
      var d = s.type;
      return typeof d == "function" && !Iu(d) && d.defaultProps === void 0 && s.compare === null && s.defaultProps === void 0 ? (r.tag = 15, r.type = d, Lh(t, r, d, a, u)) : (t = ea(s.type, null, a, r, r.mode, u), t.ref = r.ref, t.return = r, r.child = t);
    }
    if (d = t.child, (t.lanes & u) === 0) {
      var S = d.memoizedProps;
      if (s = s.compare, s = s !== null ? s : Ji, s(S, a) && t.ref === r.ref) return Ar(t, r, u);
    }
    return r.flags |= 1, t = co(d, a), t.ref = r.ref, t.return = r, r.child = t;
  }
  function Lh(t, r, s, a, u) {
    if (t !== null) {
      var d = t.memoizedProps;
      if (Ji(d, a) && t.ref === r.ref) if (vn = !1, r.pendingProps = a = d, (t.lanes & u) !== 0) (t.flags & 131072) !== 0 && (vn = !0);
      else return r.lanes = t.lanes, Ar(t, r, u);
    }
    return du(t, r, s, a, u);
  }
  function zh(t, r, s) {
    var a = r.pendingProps, u = a.children, d = t !== null ? t.memoizedState : null;
    if (a.mode === "hidden") if ((r.mode & 1) === 0) r.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, ot(hi, kn), kn |= s;
    else {
      if ((s & 1073741824) === 0) return t = d !== null ? d.baseLanes | s : s, r.lanes = r.childLanes = 1073741824, r.memoizedState = { baseLanes: t, cachePool: null, transitions: null }, r.updateQueue = null, ot(hi, kn), kn |= t, null;
      r.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, a = d !== null ? d.baseLanes : s, ot(hi, kn), kn |= a;
    }
    else d !== null ? (a = d.baseLanes | s, r.memoizedState = null) : a = s, ot(hi, kn), kn |= a;
    return an(t, r, u, s), r.child;
  }
  function Bh(t, r) {
    var s = r.ref;
    (t === null && s !== null || t !== null && t.ref !== s) && (r.flags |= 512, r.flags |= 2097152);
  }
  function du(t, r, s, a, u) {
    var d = yn(s) ? Co : tn.current;
    return d = oi(r, d), ui(r, u), s = nu(t, r, s, a, d, u), a = ru(), t !== null && !vn ? (r.updateQueue = t.updateQueue, r.flags &= -2053, t.lanes &= ~u, Ar(t, r, u)) : (ct && a && Bc(r), r.flags |= 1, an(t, r, s, u), r.child);
  }
  function Dh(t, r, s, a, u) {
    if (yn(s)) {
      var d = !0;
      $l(r);
    } else d = !1;
    if (ui(r, u), r.stateNode === null) Vl(t, r), _h(r, s, a), cu(r, s, a, u), a = !0;
    else if (t === null) {
      var S = r.stateNode, P = r.memoizedProps;
      S.props = P;
      var M = S.context, D = s.contextType;
      typeof D == "object" && D !== null ? D = Vn(D) : (D = yn(s) ? Co : tn.current, D = oi(r, D));
      var q = s.getDerivedStateFromProps, K = typeof q == "function" || typeof S.getSnapshotBeforeUpdate == "function";
      K || typeof S.UNSAFE_componentWillReceiveProps != "function" && typeof S.componentWillReceiveProps != "function" || (P !== a || M !== D) && Nh(r, S, a, D), no = !1;
      var W = r.memoizedState;
      S.state = W, Fl(r, a, S, u), M = r.memoizedState, P !== a || W !== M || gn.current || no ? (typeof q == "function" && (au(r, s, q, a), M = r.memoizedState), (P = no || Rh(r, s, P, a, W, M, D)) ? (K || typeof S.UNSAFE_componentWillMount != "function" && typeof S.componentWillMount != "function" || (typeof S.componentWillMount == "function" && S.componentWillMount(), typeof S.UNSAFE_componentWillMount == "function" && S.UNSAFE_componentWillMount()), typeof S.componentDidMount == "function" && (r.flags |= 4194308)) : (typeof S.componentDidMount == "function" && (r.flags |= 4194308), r.memoizedProps = a, r.memoizedState = M), S.props = a, S.state = M, S.context = D, a = P) : (typeof S.componentDidMount == "function" && (r.flags |= 4194308), a = !1);
    } else {
      S = r.stateNode, nh(t, r), P = r.memoizedProps, D = r.type === r.elementType ? P : ir(r.type, P), S.props = D, K = r.pendingProps, W = S.context, M = s.contextType, typeof M == "object" && M !== null ? M = Vn(M) : (M = yn(s) ? Co : tn.current, M = oi(r, M));
      var pe = s.getDerivedStateFromProps;
      (q = typeof pe == "function" || typeof S.getSnapshotBeforeUpdate == "function") || typeof S.UNSAFE_componentWillReceiveProps != "function" && typeof S.componentWillReceiveProps != "function" || (P !== K || W !== M) && Nh(r, S, a, M), no = !1, W = r.memoizedState, S.state = W, Fl(r, a, S, u);
      var ge = r.memoizedState;
      P !== K || W !== ge || gn.current || no ? (typeof pe == "function" && (au(r, s, pe, a), ge = r.memoizedState), (D = no || Rh(r, s, D, a, W, ge, M) || !1) ? (q || typeof S.UNSAFE_componentWillUpdate != "function" && typeof S.componentWillUpdate != "function" || (typeof S.componentWillUpdate == "function" && S.componentWillUpdate(a, ge, M), typeof S.UNSAFE_componentWillUpdate == "function" && S.UNSAFE_componentWillUpdate(a, ge, M)), typeof S.componentDidUpdate == "function" && (r.flags |= 4), typeof S.getSnapshotBeforeUpdate == "function" && (r.flags |= 1024)) : (typeof S.componentDidUpdate != "function" || P === t.memoizedProps && W === t.memoizedState || (r.flags |= 4), typeof S.getSnapshotBeforeUpdate != "function" || P === t.memoizedProps && W === t.memoizedState || (r.flags |= 1024), r.memoizedProps = a, r.memoizedState = ge), S.props = a, S.state = ge, S.context = M, a = D) : (typeof S.componentDidUpdate != "function" || P === t.memoizedProps && W === t.memoizedState || (r.flags |= 4), typeof S.getSnapshotBeforeUpdate != "function" || P === t.memoizedProps && W === t.memoizedState || (r.flags |= 1024), a = !1);
    }
    return pu(t, r, s, a, d, u);
  }
  function pu(t, r, s, a, u, d) {
    Bh(t, r);
    var S = (r.flags & 128) !== 0;
    if (!a && !S) return u && Up(r, s, !1), Ar(t, r, d);
    a = r.stateNode, U1.current = r;
    var P = S && typeof s.getDerivedStateFromError != "function" ? null : a.render();
    return r.flags |= 1, t !== null && S ? (r.child = ai(r, t.child, null, d), r.child = ai(r, null, P, d)) : an(t, r, P, d), r.memoizedState = a.state, u && Up(r, s, !0), r.child;
  }
  function jh(t) {
    var r = t.stateNode;
    r.pendingContext ? Vp(t, r.pendingContext, r.pendingContext !== r.context) : r.context && Vp(t, r.context, !1), Kc(t, r.containerInfo);
  }
  function Hh(t, r, s, a, u) {
    return li(), Vc(u), r.flags |= 256, an(t, r, s, a), r.child;
  }
  var hu = { dehydrated: null, treeContext: null, retryLane: 0 };
  function mu(t) {
    return { baseLanes: t, cachePool: null, transitions: null };
  }
  function Vh(t, r, s) {
    var a = r.pendingProps, u = pt.current, d = !1, S = (r.flags & 128) !== 0, P;
    if ((P = S) || (P = t !== null && t.memoizedState === null ? !1 : (u & 2) !== 0), P ? (d = !0, r.flags &= -129) : (t === null || t.memoizedState !== null) && (u |= 1), ot(pt, u & 1), t === null)
      return Hc(r), t = r.memoizedState, t !== null && (t = t.dehydrated, t !== null) ? ((r.mode & 1) === 0 ? r.lanes = 1 : t.data === "$!" ? r.lanes = 8 : r.lanes = 1073741824, null) : (S = a.children, t = a.fallback, d ? (a = r.mode, d = r.child, S = { mode: "hidden", children: S }, (a & 1) === 0 && d !== null ? (d.childLanes = 0, d.pendingProps = S) : d = ta(S, a, 0, null), t = Mo(t, a, s, null), d.return = r, t.return = r, d.sibling = t, r.child = d, r.child.memoizedState = mu(s), r.memoizedState = hu, t) : gu(r, S));
    if (u = t.memoizedState, u !== null && (P = u.dehydrated, P !== null)) return q1(t, r, S, a, P, u, s);
    if (d) {
      d = a.fallback, S = r.mode, u = t.child, P = u.sibling;
      var M = { mode: "hidden", children: a.children };
      return (S & 1) === 0 && r.child !== u ? (a = r.child, a.childLanes = 0, a.pendingProps = M, r.deletions = null) : (a = co(u, M), a.subtreeFlags = u.subtreeFlags & 14680064), P !== null ? d = co(P, d) : (d = Mo(d, S, s, null), d.flags |= 2), d.return = r, a.return = r, a.sibling = d, r.child = a, a = d, d = r.child, S = t.child.memoizedState, S = S === null ? mu(s) : { baseLanes: S.baseLanes | s, cachePool: null, transitions: S.transitions }, d.memoizedState = S, d.childLanes = t.childLanes & ~s, r.memoizedState = hu, a;
    }
    return d = t.child, t = d.sibling, a = co(d, { mode: "visible", children: a.children }), (r.mode & 1) === 0 && (a.lanes = s), a.return = r, a.sibling = null, t !== null && (s = r.deletions, s === null ? (r.deletions = [t], r.flags |= 16) : s.push(t)), r.child = a, r.memoizedState = null, a;
  }
  function gu(t, r) {
    return r = ta({ mode: "visible", children: r }, t.mode, 0, null), r.return = t, t.child = r;
  }
  function Hl(t, r, s, a) {
    return a !== null && Vc(a), ai(r, t.child, null, s), t = gu(r, r.pendingProps.children), t.flags |= 2, r.memoizedState = null, t;
  }
  function q1(t, r, s, a, u, d, S) {
    if (s)
      return r.flags & 256 ? (r.flags &= -257, a = uu(Error(o(422))), Hl(t, r, S, a)) : r.memoizedState !== null ? (r.child = t.child, r.flags |= 128, null) : (d = a.fallback, u = r.mode, a = ta({ mode: "visible", children: a.children }, u, 0, null), d = Mo(d, u, S, null), d.flags |= 2, a.return = r, d.return = r, a.sibling = d, r.child = a, (r.mode & 1) !== 0 && ai(r, t.child, null, S), r.child.memoizedState = mu(S), r.memoizedState = hu, d);
    if ((r.mode & 1) === 0) return Hl(t, r, S, null);
    if (u.data === "$!") {
      if (a = u.nextSibling && u.nextSibling.dataset, a) var P = a.dgst;
      return a = P, d = Error(o(419)), a = uu(d, a, void 0), Hl(t, r, S, a);
    }
    if (P = (S & t.childLanes) !== 0, vn || P) {
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
        u = (u & (a.suspendedLanes | S)) !== 0 ? 0 : u, u !== 0 && u !== d.retryLane && (d.retryLane = u, Fr(t, u), ar(a, t, u, -1));
      }
      return Tu(), a = uu(Error(o(421))), Hl(t, r, S, a);
    }
    return u.data === "$?" ? (r.flags |= 128, r.child = t.child, r = iS.bind(null, t), u._reactRetry = r, null) : (t = d.treeContext, Nn = Zr(u.nextSibling), _n = r, ct = !0, or = null, t !== null && (jn[Hn++] = Tr, jn[Hn++] = Ir, jn[Hn++] = xo, Tr = t.id, Ir = t.overflow, xo = r), r = gu(r, a.children), r.flags |= 4096, r);
  }
  function Wh(t, r, s) {
    t.lanes |= r;
    var a = t.alternate;
    a !== null && (a.lanes |= r), Xc(t.return, r, s);
  }
  function yu(t, r, s, a, u) {
    var d = t.memoizedState;
    d === null ? t.memoizedState = { isBackwards: r, rendering: null, renderingStartTime: 0, last: a, tail: s, tailMode: u } : (d.isBackwards = r, d.rendering = null, d.renderingStartTime = 0, d.last = a, d.tail = s, d.tailMode = u);
  }
  function Uh(t, r, s) {
    var a = r.pendingProps, u = a.revealOrder, d = a.tail;
    if (an(t, r, a.children, s), a = pt.current, (a & 2) !== 0) a = a & 1 | 2, r.flags |= 128;
    else {
      if (t !== null && (t.flags & 128) !== 0) e: for (t = r.child; t !== null; ) {
        if (t.tag === 13) t.memoizedState !== null && Wh(t, s, r);
        else if (t.tag === 19) Wh(t, s, r);
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
        for (s = r.child, u = null; s !== null; ) t = s.alternate, t !== null && Ol(t) === null && (u = s), s = s.sibling;
        s = u, s === null ? (u = r.child, r.child = null) : (u = s.sibling, s.sibling = null), yu(r, !1, u, s, d);
        break;
      case "backwards":
        for (s = null, u = r.child, r.child = null; u !== null; ) {
          if (t = u.alternate, t !== null && Ol(t) === null) {
            r.child = u;
            break;
          }
          t = u.sibling, u.sibling = s, s = u, u = t;
        }
        yu(r, !0, s, null, d);
        break;
      case "together":
        yu(r, !1, null, null, void 0);
        break;
      default:
        r.memoizedState = null;
    }
    return r.child;
  }
  function Vl(t, r) {
    (r.mode & 1) === 0 && t !== null && (t.alternate = null, r.alternate = null, r.flags |= 2);
  }
  function Ar(t, r, s) {
    if (t !== null && (r.dependencies = t.dependencies), Ro |= r.lanes, (s & r.childLanes) === 0) return null;
    if (t !== null && r.child !== t.child) throw Error(o(153));
    if (r.child !== null) {
      for (t = r.child, s = co(t, t.pendingProps), r.child = s, s.return = r; t.sibling !== null; ) t = t.sibling, s = s.sibling = co(t, t.pendingProps), s.return = r;
      s.sibling = null;
    }
    return r.child;
  }
  function X1(t, r, s) {
    switch (r.tag) {
      case 3:
        jh(r), li();
        break;
      case 5:
        ih(r);
        break;
      case 1:
        yn(r.type) && $l(r);
        break;
      case 4:
        Kc(r, r.stateNode.containerInfo);
        break;
      case 10:
        var a = r.type._context, u = r.memoizedProps.value;
        ot(Ml, a._currentValue), a._currentValue = u;
        break;
      case 13:
        if (a = r.memoizedState, a !== null)
          return a.dehydrated !== null ? (ot(pt, pt.current & 1), r.flags |= 128, null) : (s & r.child.childLanes) !== 0 ? Vh(t, r, s) : (ot(pt, pt.current & 1), t = Ar(t, r, s), t !== null ? t.sibling : null);
        ot(pt, pt.current & 1);
        break;
      case 19:
        if (a = (s & r.childLanes) !== 0, (t.flags & 128) !== 0) {
          if (a) return Uh(t, r, s);
          r.flags |= 128;
        }
        if (u = r.memoizedState, u !== null && (u.rendering = null, u.tail = null, u.lastEffect = null), ot(pt, pt.current), a) break;
        return null;
      case 22:
      case 23:
        return r.lanes = 0, zh(t, r, s);
    }
    return Ar(t, r, s);
  }
  var qh, vu, Xh, Gh;
  qh = function(t, r) {
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
  }, vu = function() {
  }, Xh = function(t, r, s, a) {
    var u = t.memoizedProps;
    if (u !== a) {
      t = r.stateNode, $o(Sr.current);
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
          typeof u.onClick != "function" && typeof a.onClick == "function" && (t.onclick = xl);
      }
      Oe(s, a);
      var S;
      s = null;
      for (D in u) if (!a.hasOwnProperty(D) && u.hasOwnProperty(D) && u[D] != null) if (D === "style") {
        var P = u[D];
        for (S in P) P.hasOwnProperty(S) && (s || (s = {}), s[S] = "");
      } else D !== "dangerouslySetInnerHTML" && D !== "children" && D !== "suppressContentEditableWarning" && D !== "suppressHydrationWarning" && D !== "autoFocus" && (l.hasOwnProperty(D) ? d || (d = []) : (d = d || []).push(D, null));
      for (D in a) {
        var M = a[D];
        if (P = u?.[D], a.hasOwnProperty(D) && M !== P && (M != null || P != null)) if (D === "style") if (P) {
          for (S in P) !P.hasOwnProperty(S) || M && M.hasOwnProperty(S) || (s || (s = {}), s[S] = "");
          for (S in M) M.hasOwnProperty(S) && P[S] !== M[S] && (s || (s = {}), s[S] = M[S]);
        } else s || (d || (d = []), d.push(
          D,
          s
        )), s = M;
        else D === "dangerouslySetInnerHTML" ? (M = M ? M.__html : void 0, P = P ? P.__html : void 0, M != null && P !== M && (d = d || []).push(D, M)) : D === "children" ? typeof M != "string" && typeof M != "number" || (d = d || []).push(D, "" + M) : D !== "suppressContentEditableWarning" && D !== "suppressHydrationWarning" && (l.hasOwnProperty(D) ? (M != null && D === "onScroll" && it("scroll", t), d || P === M || (d = [])) : (d = d || []).push(D, M));
      }
      s && (d = d || []).push("style", s);
      var D = d;
      (r.updateQueue = D) && (r.flags |= 4);
    }
  }, Gh = function(t, r, s, a) {
    s !== a && (r.flags |= 4);
  };
  function hs(t, r) {
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
  function G1(t, r, s) {
    var a = r.pendingProps;
    switch (Dc(r), r.tag) {
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
        return yn(r.type) && El(), rn(r), null;
      case 3:
        return a = r.stateNode, fi(), st(gn), st(tn), Jc(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Nl(r) ? r.flags |= 4 : t === null || t.memoizedState.isDehydrated && (r.flags & 256) === 0 || (r.flags |= 1024, or !== null && (Nu(or), or = null))), vu(t, r), rn(r), null;
      case 5:
        Qc(r);
        var u = $o(cs.current);
        if (s = r.type, t !== null && r.stateNode != null) Xh(t, r, s, a, u), t.ref !== r.ref && (r.flags |= 512, r.flags |= 2097152);
        else {
          if (!a) {
            if (r.stateNode === null) throw Error(o(166));
            return rn(r), null;
          }
          if (t = $o(Sr.current), Nl(r)) {
            a = r.stateNode, s = r.type;
            var d = r.memoizedProps;
            switch (a[vr] = r, a[os] = d, t = (r.mode & 1) !== 0, s) {
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
                for (u = 0; u < ts.length; u++) it(ts[u], a);
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
                _e(a, d), it("invalid", a);
                break;
              case "select":
                a._wrapperState = { wasMultiple: !!d.multiple }, it("invalid", a);
                break;
              case "textarea":
                Je(a, d), it("invalid", a);
            }
            Oe(s, d), u = null;
            for (var S in d) if (d.hasOwnProperty(S)) {
              var P = d[S];
              S === "children" ? typeof P == "string" ? a.textContent !== P && (d.suppressHydrationWarning !== !0 && Cl(a.textContent, P, t), u = ["children", P]) : typeof P == "number" && a.textContent !== "" + P && (d.suppressHydrationWarning !== !0 && Cl(
                a.textContent,
                P,
                t
              ), u = ["children", "" + P]) : l.hasOwnProperty(S) && P != null && S === "onScroll" && it("scroll", a);
            }
            switch (s) {
              case "input":
                ce(a), Ae(a, d, !0);
                break;
              case "textarea":
                ce(a), fn(a);
                break;
              case "select":
              case "option":
                break;
              default:
                typeof d.onClick == "function" && (a.onclick = xl);
            }
            a = u, r.updateQueue = a, a !== null && (r.flags |= 4);
          } else {
            S = u.nodeType === 9 ? u : u.ownerDocument, t === "http://www.w3.org/1999/xhtml" && (t = _t(s)), t === "http://www.w3.org/1999/xhtml" ? s === "script" ? (t = S.createElement("div"), t.innerHTML = "<script><\/script>", t = t.removeChild(t.firstChild)) : typeof a.is == "string" ? t = S.createElement(s, { is: a.is }) : (t = S.createElement(s), s === "select" && (S = t, a.multiple ? S.multiple = !0 : a.size && (S.size = a.size))) : t = S.createElementNS(t, s), t[vr] = r, t[os] = a, qh(t, r, !1, !1), r.stateNode = t;
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
                  for (u = 0; u < ts.length; u++) it(ts[u], t);
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
                  _e(t, a), u = Qe(t, a), it("invalid", t);
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
              Oe(s, u), P = u;
              for (d in P) if (P.hasOwnProperty(d)) {
                var M = P[d];
                d === "style" ? Ve(t, M) : d === "dangerouslySetInnerHTML" ? (M = M ? M.__html : void 0, M != null && Nt(t, M)) : d === "children" ? typeof M == "string" ? (s !== "textarea" || M !== "") && mt(t, M) : typeof M == "number" && mt(t, "" + M) : d !== "suppressContentEditableWarning" && d !== "suppressHydrationWarning" && d !== "autoFocus" && (l.hasOwnProperty(d) ? M != null && d === "onScroll" && it("scroll", t) : M != null && R(t, d, M, S));
              }
              switch (s) {
                case "input":
                  ce(t), Ae(t, a, !1);
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
                  typeof u.onClick == "function" && (t.onclick = xl);
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
        if (t && r.stateNode != null) Gh(t, r, t.memoizedProps, a);
        else {
          if (typeof a != "string" && r.stateNode === null) throw Error(o(166));
          if (s = $o(cs.current), $o(Sr.current), Nl(r)) {
            if (a = r.stateNode, s = r.memoizedProps, a[vr] = r, (d = a.nodeValue !== s) && (t = _n, t !== null)) switch (t.tag) {
              case 3:
                Cl(a.nodeValue, s, (t.mode & 1) !== 0);
                break;
              case 5:
                t.memoizedProps.suppressHydrationWarning !== !0 && Cl(a.nodeValue, s, (t.mode & 1) !== 0);
            }
            d && (r.flags |= 4);
          } else a = (s.nodeType === 9 ? s : s.ownerDocument).createTextNode(a), a[vr] = r, r.stateNode = a;
        }
        return rn(r), null;
      case 13:
        if (st(pt), a = r.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
          if (ct && Nn !== null && (r.mode & 1) !== 0 && (r.flags & 128) === 0) Qp(), li(), r.flags |= 98560, d = !1;
          else if (d = Nl(r), a !== null && a.dehydrated !== null) {
            if (t === null) {
              if (!d) throw Error(o(318));
              if (d = r.memoizedState, d = d !== null ? d.dehydrated : null, !d) throw Error(o(317));
              d[vr] = r;
            } else li(), (r.flags & 128) === 0 && (r.memoizedState = null), r.flags |= 4;
            rn(r), d = !1;
          } else or !== null && (Nu(or), or = null), d = !0;
          if (!d) return r.flags & 65536 ? r : null;
        }
        return (r.flags & 128) !== 0 ? (r.lanes = s, r) : (a = a !== null, a !== (t !== null && t.memoizedState !== null) && a && (r.child.flags |= 8192, (r.mode & 1) !== 0 && (t === null || (pt.current & 1) !== 0 ? Ot === 0 && (Ot = 3) : Tu())), r.updateQueue !== null && (r.flags |= 4), rn(r), null);
      case 4:
        return fi(), vu(t, r), t === null && ns(r.stateNode.containerInfo), rn(r), null;
      case 10:
        return qc(r.type._context), rn(r), null;
      case 17:
        return yn(r.type) && El(), rn(r), null;
      case 19:
        if (st(pt), d = r.memoizedState, d === null) return rn(r), null;
        if (a = (r.flags & 128) !== 0, S = d.rendering, S === null) if (a) hs(d, !1);
        else {
          if (Ot !== 0 || t !== null && (t.flags & 128) !== 0) for (t = r.child; t !== null; ) {
            if (S = Ol(t), S !== null) {
              for (r.flags |= 128, hs(d, !1), a = S.updateQueue, a !== null && (r.updateQueue = a, r.flags |= 4), r.subtreeFlags = 0, a = s, s = r.child; s !== null; ) d = s, t = a, d.flags &= 14680066, S = d.alternate, S === null ? (d.childLanes = 0, d.lanes = t, d.child = null, d.subtreeFlags = 0, d.memoizedProps = null, d.memoizedState = null, d.updateQueue = null, d.dependencies = null, d.stateNode = null) : (d.childLanes = S.childLanes, d.lanes = S.lanes, d.child = S.child, d.subtreeFlags = 0, d.deletions = null, d.memoizedProps = S.memoizedProps, d.memoizedState = S.memoizedState, d.updateQueue = S.updateQueue, d.type = S.type, t = S.dependencies, d.dependencies = t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }), s = s.sibling;
              return ot(pt, pt.current & 1 | 2), r.child;
            }
            t = t.sibling;
          }
          d.tail !== null && Be() > mi && (r.flags |= 128, a = !0, hs(d, !1), r.lanes = 4194304);
        }
        else {
          if (!a) if (t = Ol(S), t !== null) {
            if (r.flags |= 128, a = !0, s = t.updateQueue, s !== null && (r.updateQueue = s, r.flags |= 4), hs(d, !0), d.tail === null && d.tailMode === "hidden" && !S.alternate && !ct) return rn(r), null;
          } else 2 * Be() - d.renderingStartTime > mi && s !== 1073741824 && (r.flags |= 128, a = !0, hs(d, !1), r.lanes = 4194304);
          d.isBackwards ? (S.sibling = r.child, r.child = S) : (s = d.last, s !== null ? s.sibling = S : r.child = S, d.last = S);
        }
        return d.tail !== null ? (r = d.tail, d.rendering = r, d.tail = r.sibling, d.renderingStartTime = Be(), r.sibling = null, s = pt.current, ot(pt, a ? s & 1 | 2 : s & 1), r) : (rn(r), null);
      case 22:
      case 23:
        return Mu(), a = r.memoizedState !== null, t !== null && t.memoizedState !== null !== a && (r.flags |= 8192), a && (r.mode & 1) !== 0 ? (kn & 1073741824) !== 0 && (rn(r), r.subtreeFlags & 6 && (r.flags |= 8192)) : rn(r), null;
      case 24:
        return null;
      case 25:
        return null;
    }
    throw Error(o(156, r.tag));
  }
  function Y1(t, r) {
    switch (Dc(r), r.tag) {
      case 1:
        return yn(r.type) && El(), t = r.flags, t & 65536 ? (r.flags = t & -65537 | 128, r) : null;
      case 3:
        return fi(), st(gn), st(tn), Jc(), t = r.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (r.flags = t & -65537 | 128, r) : null;
      case 5:
        return Qc(r), null;
      case 13:
        if (st(pt), t = r.memoizedState, t !== null && t.dehydrated !== null) {
          if (r.alternate === null) throw Error(o(340));
          li();
        }
        return t = r.flags, t & 65536 ? (r.flags = t & -65537 | 128, r) : null;
      case 19:
        return st(pt), null;
      case 4:
        return fi(), null;
      case 10:
        return qc(r.type._context), null;
      case 22:
      case 23:
        return Mu(), null;
      case 24:
        return null;
      default:
        return null;
    }
  }
  var Wl = !1, on = !1, K1 = typeof WeakSet == "function" ? WeakSet : Set, me = null;
  function pi(t, r) {
    var s = t.ref;
    if (s !== null) if (typeof s == "function") try {
      s(null);
    } catch (a) {
      vt(t, r, a);
    }
    else s.current = null;
  }
  function Su(t, r, s) {
    try {
      s();
    } catch (a) {
      vt(t, r, a);
    }
  }
  var Yh = !1;
  function Q1(t, r) {
    if (Mc = ul, t = Rp(), bc(t)) {
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
          var S = 0, P = -1, M = -1, D = 0, q = 0, K = t, W = null;
          t: for (; ; ) {
            for (var pe; K !== s || u !== 0 && K.nodeType !== 3 || (P = S + u), K !== d || a !== 0 && K.nodeType !== 3 || (M = S + a), K.nodeType === 3 && (S += K.nodeValue.length), (pe = K.firstChild) !== null; )
              W = K, K = pe;
            for (; ; ) {
              if (K === t) break t;
              if (W === s && ++D === u && (P = S), W === d && ++q === a && (M = S), (pe = K.nextSibling) !== null) break;
              K = W, W = K.parentNode;
            }
            K = pe;
          }
          s = P === -1 || M === -1 ? null : { start: P, end: M };
        } else s = null;
      }
      s = s || { start: 0, end: 0 };
    } else s = null;
    for (Tc = { focusedElem: t, selectionRange: s }, ul = !1, me = r; me !== null; ) if (r = me, t = r.child, (r.subtreeFlags & 1028) !== 0 && t !== null) t.return = r, me = t;
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
              var ye = ge.memoizedProps, xt = ge.memoizedState, z = r.stateNode, I = z.getSnapshotBeforeUpdate(r.elementType === r.type ? ye : ir(r.type, ye), xt);
              z.__reactInternalSnapshotBeforeUpdate = I;
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
    return ge = Yh, Yh = !1, ge;
  }
  function ms(t, r, s) {
    var a = r.updateQueue;
    if (a = a !== null ? a.lastEffect : null, a !== null) {
      var u = a = a.next;
      do {
        if ((u.tag & t) === t) {
          var d = u.destroy;
          u.destroy = void 0, d !== void 0 && Su(r, s, d);
        }
        u = u.next;
      } while (u !== a);
    }
  }
  function Ul(t, r) {
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
  function wu(t) {
    var r = t.ref;
    if (r !== null) {
      var s = t.stateNode;
      t.tag, t = s, typeof r == "function" ? r(t) : r.current = t;
    }
  }
  function Kh(t) {
    var r = t.alternate;
    r !== null && (t.alternate = null, Kh(r)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (r = t.stateNode, r !== null && (delete r[vr], delete r[os], delete r[Ac], delete r[I1], delete r[F1])), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
  }
  function Qh(t) {
    return t.tag === 5 || t.tag === 3 || t.tag === 4;
  }
  function Zh(t) {
    e: for (; ; ) {
      for (; t.sibling === null; ) {
        if (t.return === null || Qh(t.return)) return null;
        t = t.return;
      }
      for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
        if (t.flags & 2 || t.child === null || t.tag === 4) continue e;
        t.child.return = t, t = t.child;
      }
      if (!(t.flags & 2)) return t.stateNode;
    }
  }
  function Cu(t, r, s) {
    var a = t.tag;
    if (a === 5 || a === 6) t = t.stateNode, r ? s.nodeType === 8 ? s.parentNode.insertBefore(t, r) : s.insertBefore(t, r) : (s.nodeType === 8 ? (r = s.parentNode, r.insertBefore(t, s)) : (r = s, r.appendChild(t)), s = s._reactRootContainer, s != null || r.onclick !== null || (r.onclick = xl));
    else if (a !== 4 && (t = t.child, t !== null)) for (Cu(t, r, s), t = t.sibling; t !== null; ) Cu(t, r, s), t = t.sibling;
  }
  function xu(t, r, s) {
    var a = t.tag;
    if (a === 5 || a === 6) t = t.stateNode, r ? s.insertBefore(t, r) : s.appendChild(t);
    else if (a !== 4 && (t = t.child, t !== null)) for (xu(t, r, s), t = t.sibling; t !== null; ) xu(t, r, s), t = t.sibling;
  }
  var Xt = null, sr = !1;
  function oo(t, r, s) {
    for (s = s.child; s !== null; ) Jh(t, r, s), s = s.sibling;
  }
  function Jh(t, r, s) {
    if (at && typeof at.onCommitFiberUnmount == "function") try {
      at.onCommitFiberUnmount(mn, s);
    } catch {
    }
    switch (s.tag) {
      case 5:
        on || pi(s, r);
      case 6:
        var a = Xt, u = sr;
        Xt = null, oo(t, r, s), Xt = a, sr = u, Xt !== null && (sr ? (t = Xt, s = s.stateNode, t.nodeType === 8 ? t.parentNode.removeChild(s) : t.removeChild(s)) : Xt.removeChild(s.stateNode));
        break;
      case 18:
        Xt !== null && (sr ? (t = Xt, s = s.stateNode, t.nodeType === 8 ? Oc(t.parentNode, s) : t.nodeType === 1 && Oc(t, s), Xi(t)) : Oc(Xt, s.stateNode));
        break;
      case 4:
        a = Xt, u = sr, Xt = s.stateNode.containerInfo, sr = !0, oo(t, r, s), Xt = a, sr = u;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        if (!on && (a = s.updateQueue, a !== null && (a = a.lastEffect, a !== null))) {
          u = a = a.next;
          do {
            var d = u, S = d.destroy;
            d = d.tag, S !== void 0 && ((d & 2) !== 0 || (d & 4) !== 0) && Su(s, r, S), u = u.next;
          } while (u !== a);
        }
        oo(t, r, s);
        break;
      case 1:
        if (!on && (pi(s, r), a = s.stateNode, typeof a.componentWillUnmount == "function")) try {
          a.props = s.memoizedProps, a.state = s.memoizedState, a.componentWillUnmount();
        } catch (P) {
          vt(s, r, P);
        }
        oo(t, r, s);
        break;
      case 21:
        oo(t, r, s);
        break;
      case 22:
        s.mode & 1 ? (on = (a = on) || s.memoizedState !== null, oo(t, r, s), on = a) : oo(t, r, s);
        break;
      default:
        oo(t, r, s);
    }
  }
  function em(t) {
    var r = t.updateQueue;
    if (r !== null) {
      t.updateQueue = null;
      var s = t.stateNode;
      s === null && (s = t.stateNode = new K1()), r.forEach(function(a) {
        var u = sS.bind(null, t, a);
        s.has(a) || (s.add(a), a.then(u, u));
      });
    }
  }
  function lr(t, r) {
    var s = r.deletions;
    if (s !== null) for (var a = 0; a < s.length; a++) {
      var u = s[a];
      try {
        var d = t, S = r, P = S;
        e: for (; P !== null; ) {
          switch (P.tag) {
            case 5:
              Xt = P.stateNode, sr = !1;
              break e;
            case 3:
              Xt = P.stateNode.containerInfo, sr = !0;
              break e;
            case 4:
              Xt = P.stateNode.containerInfo, sr = !0;
              break e;
          }
          P = P.return;
        }
        if (Xt === null) throw Error(o(160));
        Jh(d, S, u), Xt = null, sr = !1;
        var M = u.alternate;
        M !== null && (M.return = null), u.return = null;
      } catch (D) {
        vt(u, r, D);
      }
    }
    if (r.subtreeFlags & 12854) for (r = r.child; r !== null; ) tm(r, t), r = r.sibling;
  }
  function tm(t, r) {
    var s = t.alternate, a = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        if (lr(r, t), Cr(t), a & 4) {
          try {
            ms(3, t, t.return), Ul(3, t);
          } catch (ye) {
            vt(t, t.return, ye);
          }
          try {
            ms(5, t, t.return);
          } catch (ye) {
            vt(t, t.return, ye);
          }
        }
        break;
      case 1:
        lr(r, t), Cr(t), a & 512 && s !== null && pi(s, s.return);
        break;
      case 5:
        if (lr(r, t), Cr(t), a & 512 && s !== null && pi(s, s.return), t.flags & 32) {
          var u = t.stateNode;
          try {
            mt(u, "");
          } catch (ye) {
            vt(t, t.return, ye);
          }
        }
        if (a & 4 && (u = t.stateNode, u != null)) {
          var d = t.memoizedProps, S = s !== null ? s.memoizedProps : d, P = t.type, M = t.updateQueue;
          if (t.updateQueue = null, M !== null) try {
            P === "input" && d.type === "radio" && d.name != null && Xe(u, d), Ge(P, S);
            var D = Ge(P, d);
            for (S = 0; S < M.length; S += 2) {
              var q = M[S], K = M[S + 1];
              q === "style" ? Ve(u, K) : q === "dangerouslySetInnerHTML" ? Nt(u, K) : q === "children" ? mt(u, K) : R(u, q, K, D);
            }
            switch (P) {
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
            u[os] = d;
          } catch (ye) {
            vt(t, t.return, ye);
          }
        }
        break;
      case 6:
        if (lr(r, t), Cr(t), a & 4) {
          if (t.stateNode === null) throw Error(o(162));
          u = t.stateNode, d = t.memoizedProps;
          try {
            u.nodeValue = d;
          } catch (ye) {
            vt(t, t.return, ye);
          }
        }
        break;
      case 3:
        if (lr(r, t), Cr(t), a & 4 && s !== null && s.memoizedState.isDehydrated) try {
          Xi(r.containerInfo);
        } catch (ye) {
          vt(t, t.return, ye);
        }
        break;
      case 4:
        lr(r, t), Cr(t);
        break;
      case 13:
        lr(r, t), Cr(t), u = t.child, u.flags & 8192 && (d = u.memoizedState !== null, u.stateNode.isHidden = d, !d || u.alternate !== null && u.alternate.memoizedState !== null || ($u = Be())), a & 4 && em(t);
        break;
      case 22:
        if (q = s !== null && s.memoizedState !== null, t.mode & 1 ? (on = (D = on) || q, lr(r, t), on = D) : lr(r, t), Cr(t), a & 8192) {
          if (D = t.memoizedState !== null, (t.stateNode.isHidden = D) && !q && (t.mode & 1) !== 0) for (me = t, q = t.child; q !== null; ) {
            for (K = me = q; me !== null; ) {
              switch (W = me, pe = W.child, W.tag) {
                case 0:
                case 11:
                case 14:
                case 15:
                  ms(4, W, W.return);
                  break;
                case 1:
                  pi(W, W.return);
                  var ge = W.stateNode;
                  if (typeof ge.componentWillUnmount == "function") {
                    a = W, s = W.return;
                    try {
                      r = a, ge.props = r.memoizedProps, ge.state = r.memoizedState, ge.componentWillUnmount();
                    } catch (ye) {
                      vt(a, s, ye);
                    }
                  }
                  break;
                case 5:
                  pi(W, W.return);
                  break;
                case 22:
                  if (W.memoizedState !== null) {
                    om(K);
                    continue;
                  }
              }
              pe !== null ? (pe.return = W, me = pe) : om(K);
            }
            q = q.sibling;
          }
          e: for (q = null, K = t; ; ) {
            if (K.tag === 5) {
              if (q === null) {
                q = K;
                try {
                  u = K.stateNode, D ? (d = u.style, typeof d.setProperty == "function" ? d.setProperty("display", "none", "important") : d.display = "none") : (P = K.stateNode, M = K.memoizedProps.style, S = M != null && M.hasOwnProperty("display") ? M.display : null, P.style.display = Yt("display", S));
                } catch (ye) {
                  vt(t, t.return, ye);
                }
              }
            } else if (K.tag === 6) {
              if (q === null) try {
                K.stateNode.nodeValue = D ? "" : K.memoizedProps;
              } catch (ye) {
                vt(t, t.return, ye);
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
        lr(r, t), Cr(t), a & 4 && em(t);
        break;
      case 21:
        break;
      default:
        lr(
          r,
          t
        ), Cr(t);
    }
  }
  function Cr(t) {
    var r = t.flags;
    if (r & 2) {
      try {
        e: {
          for (var s = t.return; s !== null; ) {
            if (Qh(s)) {
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
            var d = Zh(t);
            xu(t, d, u);
            break;
          case 3:
          case 4:
            var S = a.stateNode.containerInfo, P = Zh(t);
            Cu(t, P, S);
            break;
          default:
            throw Error(o(161));
        }
      } catch (M) {
        vt(t, t.return, M);
      }
      t.flags &= -3;
    }
    r & 4096 && (t.flags &= -4097);
  }
  function Z1(t, r, s) {
    me = t, nm(t);
  }
  function nm(t, r, s) {
    for (var a = (t.mode & 1) !== 0; me !== null; ) {
      var u = me, d = u.child;
      if (u.tag === 22 && a) {
        var S = u.memoizedState !== null || Wl;
        if (!S) {
          var P = u.alternate, M = P !== null && P.memoizedState !== null || on;
          P = Wl;
          var D = on;
          if (Wl = S, (on = M) && !D) for (me = u; me !== null; ) S = me, M = S.child, S.tag === 22 && S.memoizedState !== null ? im(u) : M !== null ? (M.return = S, me = M) : im(u);
          for (; d !== null; ) me = d, nm(d), d = d.sibling;
          me = u, Wl = P, on = D;
        }
        rm(t);
      } else (u.subtreeFlags & 8772) !== 0 && d !== null ? (d.return = u, me = d) : rm(t);
    }
  }
  function rm(t) {
    for (; me !== null; ) {
      var r = me;
      if ((r.flags & 8772) !== 0) {
        var s = r.alternate;
        try {
          if ((r.flags & 8772) !== 0) switch (r.tag) {
            case 0:
            case 11:
            case 15:
              on || Ul(5, r);
              break;
            case 1:
              var a = r.stateNode;
              if (r.flags & 4 && !on) if (s === null) a.componentDidMount();
              else {
                var u = r.elementType === r.type ? s.memoizedProps : ir(r.type, s.memoizedProps);
                a.componentDidUpdate(u, s.memoizedState, a.__reactInternalSnapshotBeforeUpdate);
              }
              var d = r.updateQueue;
              d !== null && oh(r, d, a);
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
                oh(r, S, s);
              }
              break;
            case 5:
              var P = r.stateNode;
              if (s === null && r.flags & 4) {
                s = P;
                var M = r.memoizedProps;
                switch (r.type) {
                  case "button":
                  case "input":
                  case "select":
                  case "textarea":
                    M.autoFocus && s.focus();
                    break;
                  case "img":
                    M.src && (s.src = M.src);
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
                    K !== null && Xi(K);
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
          on || r.flags & 512 && wu(r);
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
  function om(t) {
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
  function im(t) {
    for (; me !== null; ) {
      var r = me;
      try {
        switch (r.tag) {
          case 0:
          case 11:
          case 15:
            var s = r.return;
            try {
              Ul(4, r);
            } catch (M) {
              vt(r, s, M);
            }
            break;
          case 1:
            var a = r.stateNode;
            if (typeof a.componentDidMount == "function") {
              var u = r.return;
              try {
                a.componentDidMount();
              } catch (M) {
                vt(r, u, M);
              }
            }
            var d = r.return;
            try {
              wu(r);
            } catch (M) {
              vt(r, d, M);
            }
            break;
          case 5:
            var S = r.return;
            try {
              wu(r);
            } catch (M) {
              vt(r, S, M);
            }
        }
      } catch (M) {
        vt(r, r.return, M);
      }
      if (r === t) {
        me = null;
        break;
      }
      var P = r.sibling;
      if (P !== null) {
        P.return = r.return, me = P;
        break;
      }
      me = r.return;
    }
  }
  var J1 = Math.ceil, ql = N.ReactCurrentDispatcher, bu = N.ReactCurrentOwner, Un = N.ReactCurrentBatchConfig, ze = 0, jt = null, Et = null, Gt = 0, kn = 0, hi = Jr(0), Ot = 0, gs = null, Ro = 0, Xl = 0, Eu = 0, ys = null, Sn = null, $u = 0, mi = 1 / 0, Lr = null, Gl = !1, Pu = null, io = null, Yl = !1, so = null, Kl = 0, vs = 0, Ru = null, Ql = -1, Zl = 0;
  function cn() {
    return (ze & 6) !== 0 ? Be() : Ql !== -1 ? Ql : Ql = Be();
  }
  function lo(t) {
    return (t.mode & 1) === 0 ? 1 : (ze & 2) !== 0 && Gt !== 0 ? Gt & -Gt : A1.transition !== null ? (Zl === 0 && (Zl = ue()), Zl) : (t = De, t !== 0 || (t = window.event, t = t === void 0 ? 16 : lp(t.type)), t);
  }
  function ar(t, r, s, a) {
    if (50 < vs) throw vs = 0, Ru = null, Error(o(185));
    yr(t, s, a), ((ze & 2) === 0 || t !== jt) && (t === jt && ((ze & 2) === 0 && (Xl |= s), Ot === 4 && ao(t, Gt)), wn(t, a), s === 1 && ze === 0 && (r.mode & 1) === 0 && (mi = Be() + 500, Pl && to()));
  }
  function wn(t, r) {
    var s = t.callbackNode;
    ji(t, r);
    var a = So(t, t === jt ? Gt : 0);
    if (a === 0) s !== null && Ur(s), t.callbackNode = null, t.callbackPriority = 0;
    else if (r = a & -a, t.callbackPriority !== r) {
      if (s != null && Ur(s), r === 1) t.tag === 0 ? O1(lm.bind(null, t)) : qp(lm.bind(null, t)), M1(function() {
        (ze & 6) === 0 && to();
      }), s = null;
      else {
        switch (ll(a)) {
          case 1:
            s = Bn;
            break;
          case 4:
            s = $r;
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
        s = mm(s, sm.bind(null, t));
      }
      t.callbackPriority = r, t.callbackNode = s;
    }
  }
  function sm(t, r) {
    if (Ql = -1, Zl = 0, (ze & 6) !== 0) throw Error(o(327));
    var s = t.callbackNode;
    if (gi() && t.callbackNode !== s) return null;
    var a = So(t, t === jt ? Gt : 0);
    if (a === 0) return null;
    if ((a & 30) !== 0 || (a & t.expiredLanes) !== 0 || r) r = Jl(t, a);
    else {
      r = a;
      var u = ze;
      ze |= 2;
      var d = cm();
      (jt !== t || Gt !== r) && (Lr = null, mi = Be() + 500, No(t, r));
      do
        try {
          nS();
          break;
        } catch (P) {
          am(t, P);
        }
      while (!0);
      Uc(), ql.current = d, ze = u, Et !== null ? r = 0 : (jt = null, Gt = 0, r = Ot);
    }
    if (r !== 0) {
      if (r === 2 && (u = Hi(t), u !== 0 && (a = u, r = _u(t, u))), r === 1) throw s = gs, No(t, 0), ao(t, a), wn(t, Be()), s;
      if (r === 6) ao(t, a);
      else {
        if (u = t.current.alternate, (a & 30) === 0 && !eS(u) && (r = Jl(t, a), r === 2 && (d = Hi(t), d !== 0 && (a = d, r = _u(t, d))), r === 1)) throw s = gs, No(t, 0), ao(t, a), wn(t, Be()), s;
        switch (t.finishedWork = u, t.finishedLanes = a, r) {
          case 0:
          case 1:
            throw Error(o(345));
          case 2:
            ko(t, Sn, Lr);
            break;
          case 3:
            if (ao(t, a), (a & 130023424) === a && (r = $u + 500 - Be(), 10 < r)) {
              if (So(t, 0) !== 0) break;
              if (u = t.suspendedLanes, (u & a) !== a) {
                cn(), t.pingedLanes |= t.suspendedLanes & u;
                break;
              }
              t.timeoutHandle = Fc(ko.bind(null, t, Sn, Lr), r);
              break;
            }
            ko(t, Sn, Lr);
            break;
          case 4:
            if (ao(t, a), (a & 4194240) === a) break;
            for (r = t.eventTimes, u = -1; 0 < a; ) {
              var S = 31 - et(a);
              d = 1 << S, S = r[S], S > u && (u = S), a &= ~d;
            }
            if (a = u, a = Be() - a, a = (120 > a ? 120 : 480 > a ? 480 : 1080 > a ? 1080 : 1920 > a ? 1920 : 3e3 > a ? 3e3 : 4320 > a ? 4320 : 1960 * J1(a / 1960)) - a, 10 < a) {
              t.timeoutHandle = Fc(ko.bind(null, t, Sn, Lr), a);
              break;
            }
            ko(t, Sn, Lr);
            break;
          case 5:
            ko(t, Sn, Lr);
            break;
          default:
            throw Error(o(329));
        }
      }
    }
    return wn(t, Be()), t.callbackNode === s ? sm.bind(null, t) : null;
  }
  function _u(t, r) {
    var s = ys;
    return t.current.memoizedState.isDehydrated && (No(t, r).flags |= 256), t = Jl(t, r), t !== 2 && (r = Sn, Sn = s, r !== null && Nu(r)), t;
  }
  function Nu(t) {
    Sn === null ? Sn = t : Sn.push.apply(Sn, t);
  }
  function eS(t) {
    for (var r = t; ; ) {
      if (r.flags & 16384) {
        var s = r.updateQueue;
        if (s !== null && (s = s.stores, s !== null)) for (var a = 0; a < s.length; a++) {
          var u = s[a], d = u.getSnapshot;
          u = u.value;
          try {
            if (!rr(d(), u)) return !1;
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
  function ao(t, r) {
    for (r &= ~Eu, r &= ~Xl, t.suspendedLanes |= r, t.pingedLanes &= ~r, t = t.expirationTimes; 0 < r; ) {
      var s = 31 - et(r), a = 1 << s;
      t[s] = -1, r &= ~a;
    }
  }
  function lm(t) {
    if ((ze & 6) !== 0) throw Error(o(327));
    gi();
    var r = So(t, 0);
    if ((r & 1) === 0) return wn(t, Be()), null;
    var s = Jl(t, r);
    if (t.tag !== 0 && s === 2) {
      var a = Hi(t);
      a !== 0 && (r = a, s = _u(t, a));
    }
    if (s === 1) throw s = gs, No(t, 0), ao(t, r), wn(t, Be()), s;
    if (s === 6) throw Error(o(345));
    return t.finishedWork = t.current.alternate, t.finishedLanes = r, ko(t, Sn, Lr), wn(t, Be()), null;
  }
  function ku(t, r) {
    var s = ze;
    ze |= 1;
    try {
      return t(r);
    } finally {
      ze = s, ze === 0 && (mi = Be() + 500, Pl && to());
    }
  }
  function _o(t) {
    so !== null && so.tag === 0 && (ze & 6) === 0 && gi();
    var r = ze;
    ze |= 1;
    var s = Un.transition, a = De;
    try {
      if (Un.transition = null, De = 1, t) return t();
    } finally {
      De = a, Un.transition = s, ze = r, (ze & 6) === 0 && to();
    }
  }
  function Mu() {
    kn = hi.current, st(hi);
  }
  function No(t, r) {
    t.finishedWork = null, t.finishedLanes = 0;
    var s = t.timeoutHandle;
    if (s !== -1 && (t.timeoutHandle = -1, k1(s)), Et !== null) for (s = Et.return; s !== null; ) {
      var a = s;
      switch (Dc(a), a.tag) {
        case 1:
          a = a.type.childContextTypes, a != null && El();
          break;
        case 3:
          fi(), st(gn), st(tn), Jc();
          break;
        case 5:
          Qc(a);
          break;
        case 4:
          fi();
          break;
        case 13:
          st(pt);
          break;
        case 19:
          st(pt);
          break;
        case 10:
          qc(a.type._context);
          break;
        case 22:
        case 23:
          Mu();
      }
      s = s.return;
    }
    if (jt = t, Et = t = co(t.current, null), Gt = kn = r, Ot = 0, gs = null, Eu = Xl = Ro = 0, Sn = ys = null, Eo !== null) {
      for (r = 0; r < Eo.length; r++) if (s = Eo[r], a = s.interleaved, a !== null) {
        s.interleaved = null;
        var u = a.next, d = s.pending;
        if (d !== null) {
          var S = d.next;
          d.next = u, a.next = S;
        }
        s.pending = a;
      }
      Eo = null;
    }
    return t;
  }
  function am(t, r) {
    do {
      var s = Et;
      try {
        if (Uc(), Al.current = Dl, Ll) {
          for (var a = ht.memoizedState; a !== null; ) {
            var u = a.queue;
            u !== null && (u.pending = null), a = a.next;
          }
          Ll = !1;
        }
        if (Po = 0, Dt = Ft = ht = null, us = !1, fs = 0, bu.current = null, s === null || s.return === null) {
          Ot = 1, gs = r, Et = null;
          break;
        }
        e: {
          var d = t, S = s.return, P = s, M = r;
          if (r = Gt, P.flags |= 32768, M !== null && typeof M == "object" && typeof M.then == "function") {
            var D = M, q = P, K = q.tag;
            if ((q.mode & 1) === 0 && (K === 0 || K === 11 || K === 15)) {
              var W = q.alternate;
              W ? (q.updateQueue = W.updateQueue, q.memoizedState = W.memoizedState, q.lanes = W.lanes) : (q.updateQueue = null, q.memoizedState = null);
            }
            var pe = Ih(S);
            if (pe !== null) {
              pe.flags &= -257, Fh(pe, S, P, d, r), pe.mode & 1 && Th(d, D, r), r = pe, M = D;
              var ge = r.updateQueue;
              if (ge === null) {
                var ye = /* @__PURE__ */ new Set();
                ye.add(M), r.updateQueue = ye;
              } else ge.add(M);
              break e;
            } else {
              if ((r & 1) === 0) {
                Th(d, D, r), Tu();
                break e;
              }
              M = Error(o(426));
            }
          } else if (ct && P.mode & 1) {
            var xt = Ih(S);
            if (xt !== null) {
              (xt.flags & 65536) === 0 && (xt.flags |= 256), Fh(xt, S, P, d, r), Vc(di(M, P));
              break e;
            }
          }
          d = M = di(M, P), Ot !== 4 && (Ot = 2), ys === null ? ys = [d] : ys.push(d), d = S;
          do {
            switch (d.tag) {
              case 3:
                d.flags |= 65536, r &= -r, d.lanes |= r;
                var z = kh(d, M, r);
                rh(d, z);
                break e;
              case 1:
                P = M;
                var I = d.type, B = d.stateNode;
                if ((d.flags & 128) === 0 && (typeof I.getDerivedStateFromError == "function" || B !== null && typeof B.componentDidCatch == "function" && (io === null || !io.has(B)))) {
                  d.flags |= 65536, r &= -r, d.lanes |= r;
                  var ne = Mh(d, P, r);
                  rh(d, ne);
                  break e;
                }
            }
            d = d.return;
          } while (d !== null);
        }
        fm(s);
      } catch (ve) {
        r = ve, Et === s && s !== null && (Et = s = s.return);
        continue;
      }
      break;
    } while (!0);
  }
  function cm() {
    var t = ql.current;
    return ql.current = Dl, t === null ? Dl : t;
  }
  function Tu() {
    (Ot === 0 || Ot === 3 || Ot === 2) && (Ot = 4), jt === null || (Ro & 268435455) === 0 && (Xl & 268435455) === 0 || ao(jt, Gt);
  }
  function Jl(t, r) {
    var s = ze;
    ze |= 2;
    var a = cm();
    (jt !== t || Gt !== r) && (Lr = null, No(t, r));
    do
      try {
        tS();
        break;
      } catch (u) {
        am(t, u);
      }
    while (!0);
    if (Uc(), ze = s, ql.current = a, Et !== null) throw Error(o(261));
    return jt = null, Gt = 0, Ot;
  }
  function tS() {
    for (; Et !== null; ) um(Et);
  }
  function nS() {
    for (; Et !== null && !dt(); ) um(Et);
  }
  function um(t) {
    var r = hm(t.alternate, t, kn);
    t.memoizedProps = t.pendingProps, r === null ? fm(t) : Et = r, bu.current = null;
  }
  function fm(t) {
    var r = t;
    do {
      var s = r.alternate;
      if (t = r.return, (r.flags & 32768) === 0) {
        if (s = G1(s, r, kn), s !== null) {
          Et = s;
          return;
        }
      } else {
        if (s = Y1(s, r), s !== null) {
          s.flags &= 32767, Et = s;
          return;
        }
        if (t !== null) t.flags |= 32768, t.subtreeFlags = 0, t.deletions = null;
        else {
          Ot = 6, Et = null;
          return;
        }
      }
      if (r = r.sibling, r !== null) {
        Et = r;
        return;
      }
      Et = r = t;
    } while (r !== null);
    Ot === 0 && (Ot = 5);
  }
  function ko(t, r, s) {
    var a = De, u = Un.transition;
    try {
      Un.transition = null, De = 1, rS(t, r, s, a);
    } finally {
      Un.transition = u, De = a;
    }
    return null;
  }
  function rS(t, r, s, a) {
    do
      gi();
    while (so !== null);
    if ((ze & 6) !== 0) throw Error(o(327));
    s = t.finishedWork;
    var u = t.finishedLanes;
    if (s === null) return null;
    if (t.finishedWork = null, t.finishedLanes = 0, s === t.current) throw Error(o(177));
    t.callbackNode = null, t.callbackPriority = 0;
    var d = s.lanes | s.childLanes;
    if (cc(t, d), t === jt && (Et = jt = null, Gt = 0), (s.subtreeFlags & 2064) === 0 && (s.flags & 2064) === 0 || Yl || (Yl = !0, mm(en, function() {
      return gi(), null;
    })), d = (s.flags & 15990) !== 0, (s.subtreeFlags & 15990) !== 0 || d) {
      d = Un.transition, Un.transition = null;
      var S = De;
      De = 1;
      var P = ze;
      ze |= 4, bu.current = null, Q1(t, s), tm(s, t), b1(Tc), ul = !!Mc, Tc = Mc = null, t.current = s, Z1(s), Jt(), ze = P, De = S, Un.transition = d;
    } else t.current = s;
    if (Yl && (Yl = !1, so = t, Kl = u), d = t.pendingLanes, d === 0 && (io = null), Re(s.stateNode), wn(t, Be()), r !== null) for (a = t.onRecoverableError, s = 0; s < r.length; s++) u = r[s], a(u.value, { componentStack: u.stack, digest: u.digest });
    if (Gl) throw Gl = !1, t = Pu, Pu = null, t;
    return (Kl & 1) !== 0 && t.tag !== 0 && gi(), d = t.pendingLanes, (d & 1) !== 0 ? t === Ru ? vs++ : (vs = 0, Ru = t) : vs = 0, to(), null;
  }
  function gi() {
    if (so !== null) {
      var t = ll(Kl), r = Un.transition, s = De;
      try {
        if (Un.transition = null, De = 16 > t ? 16 : t, so === null) var a = !1;
        else {
          if (t = so, so = null, Kl = 0, (ze & 6) !== 0) throw Error(o(331));
          var u = ze;
          for (ze |= 4, me = t.current; me !== null; ) {
            var d = me, S = d.child;
            if ((me.flags & 16) !== 0) {
              var P = d.deletions;
              if (P !== null) {
                for (var M = 0; M < P.length; M++) {
                  var D = P[M];
                  for (me = D; me !== null; ) {
                    var q = me;
                    switch (q.tag) {
                      case 0:
                      case 11:
                      case 15:
                        ms(8, q, d);
                    }
                    var K = q.child;
                    if (K !== null) K.return = q, me = K;
                    else for (; me !== null; ) {
                      q = me;
                      var W = q.sibling, pe = q.return;
                      if (Kh(q), q === D) {
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
                  var ye = ge.child;
                  if (ye !== null) {
                    ge.child = null;
                    do {
                      var xt = ye.sibling;
                      ye.sibling = null, ye = xt;
                    } while (ye !== null);
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
                  ms(9, d, d.return);
              }
              var z = d.sibling;
              if (z !== null) {
                z.return = d.return, me = z;
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
              if (P = me, (P.flags & 2048) !== 0) try {
                switch (P.tag) {
                  case 0:
                  case 11:
                  case 15:
                    Ul(9, P);
                }
              } catch (ve) {
                vt(P, P.return, ve);
              }
              if (P === S) {
                me = null;
                break e;
              }
              var ne = P.sibling;
              if (ne !== null) {
                ne.return = P.return, me = ne;
                break e;
              }
              me = P.return;
            }
          }
          if (ze = u, to(), at && typeof at.onPostCommitFiberRoot == "function") try {
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
  function dm(t, r, s) {
    r = di(s, r), r = kh(t, r, 1), t = ro(t, r, 1), r = cn(), t !== null && (yr(t, 1, r), wn(t, r));
  }
  function vt(t, r, s) {
    if (t.tag === 3) dm(t, t, s);
    else for (; r !== null; ) {
      if (r.tag === 3) {
        dm(r, t, s);
        break;
      } else if (r.tag === 1) {
        var a = r.stateNode;
        if (typeof r.type.getDerivedStateFromError == "function" || typeof a.componentDidCatch == "function" && (io === null || !io.has(a))) {
          t = di(s, t), t = Mh(r, t, 1), r = ro(r, t, 1), t = cn(), r !== null && (yr(r, 1, t), wn(r, t));
          break;
        }
      }
      r = r.return;
    }
  }
  function oS(t, r, s) {
    var a = t.pingCache;
    a !== null && a.delete(r), r = cn(), t.pingedLanes |= t.suspendedLanes & s, jt === t && (Gt & s) === s && (Ot === 4 || Ot === 3 && (Gt & 130023424) === Gt && 500 > Be() - $u ? No(t, 0) : Eu |= s), wn(t, r);
  }
  function pm(t, r) {
    r === 0 && ((t.mode & 1) === 0 ? r = 1 : (r = Nr, Nr <<= 1, (Nr & 130023424) === 0 && (Nr = 4194304)));
    var s = cn();
    t = Fr(t, r), t !== null && (yr(t, r, s), wn(t, s));
  }
  function iS(t) {
    var r = t.memoizedState, s = 0;
    r !== null && (s = r.retryLane), pm(t, s);
  }
  function sS(t, r) {
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
    a !== null && a.delete(r), pm(t, s);
  }
  var hm;
  hm = function(t, r, s) {
    if (t !== null) if (t.memoizedProps !== r.pendingProps || gn.current) vn = !0;
    else {
      if ((t.lanes & s) === 0 && (r.flags & 128) === 0) return vn = !1, X1(t, r, s);
      vn = (t.flags & 131072) !== 0;
    }
    else vn = !1, ct && (r.flags & 1048576) !== 0 && Xp(r, _l, r.index);
    switch (r.lanes = 0, r.tag) {
      case 2:
        var a = r.type;
        Vl(t, r), t = r.pendingProps;
        var u = oi(r, tn.current);
        ui(r, s), u = nu(null, r, a, t, u, s);
        var d = ru();
        return r.flags |= 1, typeof u == "object" && u !== null && typeof u.render == "function" && u.$$typeof === void 0 ? (r.tag = 1, r.memoizedState = null, r.updateQueue = null, yn(a) ? (d = !0, $l(r)) : d = !1, r.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, Yc(r), u.updater = jl, r.stateNode = u, u._reactInternals = r, cu(r, a, t, s), r = pu(null, r, a, !0, d, s)) : (r.tag = 0, ct && d && Bc(r), an(null, r, u, s), r = r.child), r;
      case 16:
        a = r.elementType;
        e: {
          switch (Vl(t, r), t = r.pendingProps, u = a._init, a = u(a._payload), r.type = a, u = r.tag = aS(a), t = ir(a, t), u) {
            case 0:
              r = du(null, r, a, t, s);
              break e;
            case 1:
              r = Dh(null, r, a, t, s);
              break e;
            case 11:
              r = Oh(null, r, a, t, s);
              break e;
            case 14:
              r = Ah(null, r, a, ir(a.type, t), s);
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
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : ir(a, u), du(t, r, a, u, s);
      case 1:
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : ir(a, u), Dh(t, r, a, u, s);
      case 3:
        e: {
          if (jh(r), t === null) throw Error(o(387));
          a = r.pendingProps, d = r.memoizedState, u = d.element, nh(t, r), Fl(r, a, null, s);
          var S = r.memoizedState;
          if (a = S.element, d.isDehydrated) if (d = { element: a, isDehydrated: !1, cache: S.cache, pendingSuspenseBoundaries: S.pendingSuspenseBoundaries, transitions: S.transitions }, r.updateQueue.baseState = d, r.memoizedState = d, r.flags & 256) {
            u = di(Error(o(423)), r), r = Hh(t, r, a, s, u);
            break e;
          } else if (a !== u) {
            u = di(Error(o(424)), r), r = Hh(t, r, a, s, u);
            break e;
          } else for (Nn = Zr(r.stateNode.containerInfo.firstChild), _n = r, ct = !0, or = null, s = eh(r, null, a, s), r.child = s; s; ) s.flags = s.flags & -3 | 4096, s = s.sibling;
          else {
            if (li(), a === u) {
              r = Ar(t, r, s);
              break e;
            }
            an(t, r, a, s);
          }
          r = r.child;
        }
        return r;
      case 5:
        return ih(r), t === null && Hc(r), a = r.type, u = r.pendingProps, d = t !== null ? t.memoizedProps : null, S = u.children, Ic(a, u) ? S = null : d !== null && Ic(a, d) && (r.flags |= 32), Bh(t, r), an(t, r, S, s), r.child;
      case 6:
        return t === null && Hc(r), null;
      case 13:
        return Vh(t, r, s);
      case 4:
        return Kc(r, r.stateNode.containerInfo), a = r.pendingProps, t === null ? r.child = ai(r, null, a, s) : an(t, r, a, s), r.child;
      case 11:
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : ir(a, u), Oh(t, r, a, u, s);
      case 7:
        return an(t, r, r.pendingProps, s), r.child;
      case 8:
        return an(t, r, r.pendingProps.children, s), r.child;
      case 12:
        return an(t, r, r.pendingProps.children, s), r.child;
      case 10:
        e: {
          if (a = r.type._context, u = r.pendingProps, d = r.memoizedProps, S = u.value, ot(Ml, a._currentValue), a._currentValue = S, d !== null) if (rr(d.value, S)) {
            if (d.children === u.children && !gn.current) {
              r = Ar(t, r, s);
              break e;
            }
          } else for (d = r.child, d !== null && (d.return = r); d !== null; ) {
            var P = d.dependencies;
            if (P !== null) {
              S = d.child;
              for (var M = P.firstContext; M !== null; ) {
                if (M.context === a) {
                  if (d.tag === 1) {
                    M = Or(-1, s & -s), M.tag = 2;
                    var D = d.updateQueue;
                    if (D !== null) {
                      D = D.shared;
                      var q = D.pending;
                      q === null ? M.next = M : (M.next = q.next, q.next = M), D.pending = M;
                    }
                  }
                  d.lanes |= s, M = d.alternate, M !== null && (M.lanes |= s), Xc(
                    d.return,
                    s,
                    r
                  ), P.lanes |= s;
                  break;
                }
                M = M.next;
              }
            } else if (d.tag === 10) S = d.type === r.type ? null : d.child;
            else if (d.tag === 18) {
              if (S = d.return, S === null) throw Error(o(341));
              S.lanes |= s, P = S.alternate, P !== null && (P.lanes |= s), Xc(S, s, r), S = d.sibling;
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
        return u = r.type, a = r.pendingProps.children, ui(r, s), u = Vn(u), a = a(u), r.flags |= 1, an(t, r, a, s), r.child;
      case 14:
        return a = r.type, u = ir(a, r.pendingProps), u = ir(a.type, u), Ah(t, r, a, u, s);
      case 15:
        return Lh(t, r, r.type, r.pendingProps, s);
      case 17:
        return a = r.type, u = r.pendingProps, u = r.elementType === a ? u : ir(a, u), Vl(t, r), r.tag = 1, yn(a) ? (t = !0, $l(r)) : t = !1, ui(r, s), _h(r, a, u), cu(r, a, u, s), pu(null, r, a, !0, t, s);
      case 19:
        return Uh(t, r, s);
      case 22:
        return zh(t, r, s);
    }
    throw Error(o(156, r.tag));
  };
  function mm(t, r) {
    return mr(t, r);
  }
  function lS(t, r, s, a) {
    this.tag = t, this.key = s, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.ref = null, this.pendingProps = r, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = a, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function qn(t, r, s, a) {
    return new lS(t, r, s, a);
  }
  function Iu(t) {
    return t = t.prototype, !(!t || !t.isReactComponent);
  }
  function aS(t) {
    if (typeof t == "function") return Iu(t) ? 1 : 0;
    if (t != null) {
      if (t = t.$$typeof, t === X) return 11;
      if (t === G) return 14;
    }
    return 2;
  }
  function co(t, r) {
    var s = t.alternate;
    return s === null ? (s = qn(t.tag, r, t.key, t.mode), s.elementType = t.elementType, s.type = t.type, s.stateNode = t.stateNode, s.alternate = t, t.alternate = s) : (s.pendingProps = r, s.type = t.type, s.flags = 0, s.subtreeFlags = 0, s.deletions = null), s.flags = t.flags & 14680064, s.childLanes = t.childLanes, s.lanes = t.lanes, s.child = t.child, s.memoizedProps = t.memoizedProps, s.memoizedState = t.memoizedState, s.updateQueue = t.updateQueue, r = t.dependencies, s.dependencies = r === null ? null : { lanes: r.lanes, firstContext: r.firstContext }, s.sibling = t.sibling, s.index = t.index, s.ref = t.ref, s;
  }
  function ea(t, r, s, a, u, d) {
    var S = 2;
    if (a = t, typeof t == "function") Iu(t) && (S = 1);
    else if (typeof t == "string") S = 5;
    else e: switch (t) {
      case F:
        return Mo(s.children, u, d, r);
      case A:
        S = 8, u |= 8;
        break;
      case H:
        return t = qn(12, s, r, u | 2), t.elementType = H, t.lanes = d, t;
      case Q:
        return t = qn(13, s, r, u), t.elementType = Q, t.lanes = d, t;
      case oe:
        return t = qn(19, s, r, u), t.elementType = oe, t.lanes = d, t;
      case he:
        return ta(s, u, d, r);
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
  function Mo(t, r, s, a) {
    return t = qn(7, t, a, r), t.lanes = s, t;
  }
  function ta(t, r, s, a) {
    return t = qn(22, t, a, r), t.elementType = he, t.lanes = s, t.stateNode = { isHidden: !1 }, t;
  }
  function Fu(t, r, s) {
    return t = qn(6, t, null, r), t.lanes = s, t;
  }
  function Ou(t, r, s) {
    return r = qn(4, t.children !== null ? t.children : [], t.key, r), r.lanes = s, r.stateNode = { containerInfo: t.containerInfo, pendingChildren: null, implementation: t.implementation }, r;
  }
  function cS(t, r, s, a, u) {
    this.tag = r, this.containerInfo = t, this.finishedWork = this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.pendingContext = this.context = null, this.callbackPriority = 0, this.eventTimes = Fe(0), this.expirationTimes = Fe(-1), this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Fe(0), this.identifierPrefix = a, this.onRecoverableError = u, this.mutableSourceEagerHydrationData = null;
  }
  function Au(t, r, s, a, u, d, S, P, M) {
    return t = new cS(t, r, s, P, M), r === 1 ? (r = 1, d === !0 && (r |= 8)) : r = 0, d = qn(3, null, null, r), t.current = d, d.stateNode = t, d.memoizedState = { element: a, isDehydrated: s, cache: null, transitions: null, pendingSuspenseBoundaries: null }, Yc(d), t;
  }
  function uS(t, r, s) {
    var a = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return { $$typeof: L, key: a == null ? null : "" + a, children: t, containerInfo: r, implementation: s };
  }
  function gm(t) {
    if (!t) return eo;
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
      if (yn(s)) return Wp(t, s, r);
    }
    return r;
  }
  function ym(t, r, s, a, u, d, S, P, M) {
    return t = Au(s, a, !0, t, u, d, S, P, M), t.context = gm(null), s = t.current, a = cn(), u = lo(s), d = Or(a, u), d.callback = r ?? null, ro(s, d, u), t.current.lanes = u, yr(t, u, a), wn(t, a), t;
  }
  function na(t, r, s, a) {
    var u = r.current, d = cn(), S = lo(u);
    return s = gm(s), r.context === null ? r.context = s : r.pendingContext = s, r = Or(d, S), r.payload = { element: t }, a = a === void 0 ? null : a, a !== null && (r.callback = a), t = ro(u, r, S), t !== null && (ar(t, u, S, d), Il(t, u, S)), S;
  }
  function ra(t) {
    return t = t.current, t.child ? (t.child.tag === 5, t.child.stateNode) : null;
  }
  function vm(t, r) {
    if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
      var s = t.retryLane;
      t.retryLane = s !== 0 && s < r ? s : r;
    }
  }
  function Lu(t, r) {
    vm(t, r), (t = t.alternate) && vm(t, r);
  }
  function fS() {
    return null;
  }
  var Sm = typeof reportError == "function" ? reportError : function(t) {
    console.error(t);
  };
  function zu(t) {
    this._internalRoot = t;
  }
  oa.prototype.render = zu.prototype.render = function(t) {
    var r = this._internalRoot;
    if (r === null) throw Error(o(409));
    na(t, r, null, null);
  }, oa.prototype.unmount = zu.prototype.unmount = function() {
    var t = this._internalRoot;
    if (t !== null) {
      this._internalRoot = null;
      var r = t.containerInfo;
      _o(function() {
        na(null, t, null, null);
      }), r[kr] = null;
    }
  };
  function oa(t) {
    this._internalRoot = t;
  }
  oa.prototype.unstable_scheduleHydration = function(t) {
    if (t) {
      var r = np();
      t = { blockedOn: null, target: t, priority: r };
      for (var s = 0; s < Yr.length && r !== 0 && r < Yr[s].priority; s++) ;
      Yr.splice(s, 0, t), s === 0 && ip(t);
    }
  };
  function Bu(t) {
    return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11);
  }
  function ia(t) {
    return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11 && (t.nodeType !== 8 || t.nodeValue !== " react-mount-point-unstable "));
  }
  function wm() {
  }
  function dS(t, r, s, a, u) {
    if (u) {
      if (typeof a == "function") {
        var d = a;
        a = function() {
          var D = ra(S);
          d.call(D);
        };
      }
      var S = ym(r, a, t, 0, null, !1, !1, "", wm);
      return t._reactRootContainer = S, t[kr] = S.current, ns(t.nodeType === 8 ? t.parentNode : t), _o(), S;
    }
    for (; u = t.lastChild; ) t.removeChild(u);
    if (typeof a == "function") {
      var P = a;
      a = function() {
        var D = ra(M);
        P.call(D);
      };
    }
    var M = Au(t, 0, !1, null, null, !1, !1, "", wm);
    return t._reactRootContainer = M, t[kr] = M.current, ns(t.nodeType === 8 ? t.parentNode : t), _o(function() {
      na(r, M, s, a);
    }), M;
  }
  function sa(t, r, s, a, u) {
    var d = s._reactRootContainer;
    if (d) {
      var S = d;
      if (typeof u == "function") {
        var P = u;
        u = function() {
          var M = ra(S);
          P.call(M);
        };
      }
      na(r, S, t, u);
    } else S = dS(s, r, t, u, a);
    return ra(S);
  }
  ep = function(t) {
    switch (t.tag) {
      case 3:
        var r = t.stateNode;
        if (r.current.memoizedState.isDehydrated) {
          var s = gr(r.pendingLanes);
          s !== 0 && (Go(r, s | 1), wn(r, Be()), (ze & 6) === 0 && (mi = Be() + 500, to()));
        }
        break;
      case 13:
        _o(function() {
          var a = Fr(t, 1);
          if (a !== null) {
            var u = cn();
            ar(a, t, 1, u);
          }
        }), Lu(t, 1);
    }
  }, uc = function(t) {
    if (t.tag === 13) {
      var r = Fr(t, 134217728);
      if (r !== null) {
        var s = cn();
        ar(r, t, 134217728, s);
      }
      Lu(t, 134217728);
    }
  }, tp = function(t) {
    if (t.tag === 13) {
      var r = lo(t), s = Fr(t, r);
      if (s !== null) {
        var a = cn();
        ar(s, t, r, a);
      }
      Lu(t, r);
    }
  }, np = function() {
    return De;
  }, rp = function(t, r) {
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
              var u = bl(a);
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
  }, Ee = ku, Ce = _o;
  var pS = { usingClientEntryPoint: !1, Events: [is, ni, bl, $n, de, ku] }, Ss = { findFiberByHostInstance: wo, bundleType: 0, version: "18.3.1", rendererPackageName: "react-dom" }, hS = { bundleType: Ss.bundleType, version: Ss.version, rendererPackageName: Ss.rendererPackageName, rendererConfig: Ss.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: N.ReactCurrentDispatcher, findHostInstanceByFiber: function(t) {
    return t = Wr(t), t === null ? null : t.stateNode;
  }, findFiberByHostInstance: Ss.findFiberByHostInstance || fS, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1-next-f1338f8080-20240426" };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var la = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!la.isDisabled && la.supportsFiber) try {
      mn = la.inject(hS), at = la;
    } catch {
    }
  }
  return Cn.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = pS, Cn.createPortal = function(t, r) {
    var s = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!Bu(r)) throw Error(o(200));
    return uS(t, r, null, s);
  }, Cn.createRoot = function(t, r) {
    if (!Bu(t)) throw Error(o(299));
    var s = !1, a = "", u = Sm;
    return r != null && (r.unstable_strictMode === !0 && (s = !0), r.identifierPrefix !== void 0 && (a = r.identifierPrefix), r.onRecoverableError !== void 0 && (u = r.onRecoverableError)), r = Au(t, 1, !1, null, null, s, !1, a, u), t[kr] = r.current, ns(t.nodeType === 8 ? t.parentNode : t), new zu(r);
  }, Cn.findDOMNode = function(t) {
    if (t == null) return null;
    if (t.nodeType === 1) return t;
    var r = t._reactInternals;
    if (r === void 0)
      throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
    return t = Wr(r), t = t === null ? null : t.stateNode, t;
  }, Cn.flushSync = function(t) {
    return _o(t);
  }, Cn.hydrate = function(t, r, s) {
    if (!ia(r)) throw Error(o(200));
    return sa(null, t, r, !0, s);
  }, Cn.hydrateRoot = function(t, r, s) {
    if (!Bu(t)) throw Error(o(405));
    var a = s != null && s.hydratedSources || null, u = !1, d = "", S = Sm;
    if (s != null && (s.unstable_strictMode === !0 && (u = !0), s.identifierPrefix !== void 0 && (d = s.identifierPrefix), s.onRecoverableError !== void 0 && (S = s.onRecoverableError)), r = ym(r, null, t, 1, s ?? null, u, !1, d, S), t[kr] = r.current, ns(t), a) for (t = 0; t < a.length; t++) s = a[t], u = s._getVersion, u = u(s._source), r.mutableSourceEagerHydrationData == null ? r.mutableSourceEagerHydrationData = [s, u] : r.mutableSourceEagerHydrationData.push(
      s,
      u
    );
    return new oa(r);
  }, Cn.render = function(t, r, s) {
    if (!ia(r)) throw Error(o(200));
    return sa(null, t, r, !1, s);
  }, Cn.unmountComponentAtNode = function(t) {
    if (!ia(t)) throw Error(o(40));
    return t._reactRootContainer ? (_o(function() {
      sa(null, null, t, !1, function() {
        t._reactRootContainer = null, t[kr] = null;
      });
    }), !0) : !1;
  }, Cn.unstable_batchedUpdates = ku, Cn.unstable_renderSubtreeIntoContainer = function(t, r, s, a) {
    if (!ia(s)) throw Error(o(200));
    if (t == null || t._reactInternals === void 0) throw Error(o(38));
    return sa(t, r, s, !1, a);
  }, Cn.version = "18.3.1-next-f1338f8080-20240426", Cn;
}
var Lm;
function D0() {
  if (Lm) return Wu.exports;
  Lm = 1;
  function e() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(e);
      } catch (n) {
        console.error(n);
      }
  }
  return e(), Wu.exports = rw(), Wu.exports;
}
var zm;
function ow() {
  if (zm) return aa;
  zm = 1;
  var e = D0();
  return aa.createRoot = e.createRoot, aa.hydrateRoot = e.hydrateRoot, aa;
}
var j0 = ow(), Ja = D0();
const iw = /* @__PURE__ */ h.createContext({}), xf = /* @__PURE__ */ h.createContext(null);
function sw({
  children: e,
  onBatchResize: n
}) {
  const o = h.useRef(0), i = h.useRef([]), l = h.useContext(xf), c = h.useCallback((f, p, g) => {
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
  return /* @__PURE__ */ h.createElement(xf.Provider, {
    value: c
  }, e);
}
const ho = /* @__PURE__ */ new Map();
function lw(e) {
  e.forEach((n) => {
    const {
      target: o
    } = n;
    ho.get(o)?.forEach((i) => i(o));
  });
}
let Xu;
function H0() {
  return Xu || (Xu = new ResizeObserver(lw)), Xu;
}
function aw(e, n) {
  ho.has(e) || (ho.set(e, /* @__PURE__ */ new Set()), H0().observe(e)), ho.get(e).add(n);
}
function cw(e, n) {
  ho.has(e) && (ho.get(e).delete(n), ho.get(e).size || (H0().unobserve(e), ho.delete(e)));
}
function V0(e, n, o, i) {
  const l = h.useRef({
    width: -1,
    height: -1,
    offsetWidth: -1,
    offsetHeight: -1
  }), c = wt((g) => {
    const {
      width: m,
      height: v
    } = g.getBoundingClientRect(), {
      offsetWidth: y,
      offsetHeight: w
    } = g, x = Math.floor(m), E = Math.floor(v);
    if (l.current.width !== x || l.current.height !== E || l.current.offsetWidth !== y || l.current.offsetHeight !== w) {
      const C = {
        width: x,
        height: E,
        offsetWidth: y,
        offsetHeight: w
      };
      l.current = C;
      const b = y === Math.round(m) ? m : y, $ = w === Math.round(v) ? v : w, _ = {
        ...C,
        offsetWidth: b,
        offsetHeight: $
      };
      i?.(_, g), Promise.resolve().then(() => {
        o?.(_, g);
      });
    }
  }), f = typeof n == "function", p = h.useRef(0);
  h.useEffect(() => {
    const g = f ? n() : n;
    return g && e ? aw(g, c) : e && f && (p.current += 1), () => {
      g && cw(g, c);
    };
  }, [
    e,
    // If function target resolves after a parent render, the bumped ref value
    // lets the next render re-run this effect without watching the function identity.
    f ? p.current : n
  ]);
}
function uw(e, n) {
  const {
    children: o,
    disabled: i,
    onResize: l,
    data: c
  } = e, f = h.useRef(null), p = h.useContext(xf), g = typeof o == "function", m = g ? o(f) : o, v = !g && /* @__PURE__ */ h.isValidElement(m) && _d(m), y = v ? Qa(m) : null, w = Rd(y, f), x = () => Md(f.current);
  return h.useImperativeHandle(n, () => x()), V0(!i, x, l, (E, C) => {
    p?.(E, C, c);
  }), v ? /* @__PURE__ */ h.cloneElement(m, {
    ref: w
  }) : m;
}
const fw = /* @__PURE__ */ h.forwardRef(uw);
function bf() {
  return bf = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, bf.apply(this, arguments);
}
const dw = "rc-observer-key";
function pw(e, n) {
  const {
    children: o
  } = e;
  return (typeof o == "function" ? [o] : Vs(o)).map((l, c) => {
    const f = l?.key || `${dw}-${c}`;
    return /* @__PURE__ */ h.createElement(fw, bf({}, e, {
      key: f,
      ref: c === 0 ? n : void 0
    }), l);
  });
}
const W0 = /* @__PURE__ */ h.forwardRef(pw);
W0.Collection = sw;
function U0(e) {
  var n, o, i = "";
  if (typeof e == "string" || typeof e == "number") i += e;
  else if (typeof e == "object") if (Array.isArray(e)) {
    var l = e.length;
    for (n = 0; n < l; n++) e[n] && (o = U0(e[n])) && (i && (i += " "), i += o);
  } else for (o in e) e[o] && (i && (i += " "), i += o);
  return i;
}
function we() {
  for (var e, n, o = 0, i = "", l = arguments.length; o < l; o++) (e = arguments[o]) && (n = U0(e)) && (i && (i += " "), i += n);
  return i;
}
function Ef(e, n) {
  (n == null || n > e.length) && (n = e.length);
  for (var o = 0, i = Array(n); o < n; o++) i[o] = e[o];
  return i;
}
function hw(e) {
  if (Array.isArray(e)) return Ef(e);
}
function mw(e) {
  if (typeof Symbol < "u" && e[Symbol.iterator] != null || e["@@iterator"] != null) return Array.from(e);
}
function q0(e, n) {
  if (e) {
    if (typeof e == "string") return Ef(e, n);
    var o = {}.toString.call(e).slice(8, -1);
    return o === "Object" && e.constructor && (o = e.constructor.name), o === "Map" || o === "Set" ? Array.from(e) : o === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(o) ? Ef(e, n) : void 0;
  }
}
function gw() {
  throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function Ws(e) {
  return hw(e) || mw(e) || q0(e) || gw();
}
const Bm = "ant", Td = "anticon", yw = ["outlined", "borderless", "filled", "underlined"], vw = (e, n) => n || (e ? `${Bm}-${e}` : Bm), On = /* @__PURE__ */ h.createContext({
  // We provide a default function for Context without provider
  getPrefixCls: vw,
  iconPrefixCls: Td
}), {
  Consumer: JP
} = On, Dm = {};
function Xo(e) {
  const n = h.useContext(On), {
    getPrefixCls: o,
    direction: i,
    getPopupContainer: l,
    renderEmpty: c
  } = n, f = n[e];
  return {
    classNames: Dm,
    styles: Dm,
    ...f,
    getPrefixCls: o,
    direction: i,
    getPopupContainer: l,
    renderEmpty: c
  };
}
function Us(e) {
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
const Sw = "%";
function $f(e) {
  return e.join(Sw);
}
let jm = 0;
class ww {
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
    return this.opGet($f(n));
  }
  /** A fast get cache with `get` concat. */
  opGet(n) {
    return this.cache.get(n) || null;
  }
  update(n, o) {
    return this.opUpdate($f(n), o);
  }
  /** A fast get cache with `get` concat. */
  opUpdate(n, o) {
    const i = this.cache.get(n), l = o(i);
    l === null ? (this.cache.delete(n), this.updateTimes.delete(n)) : (this.cache.set(n, l), this.updateTimes.set(n, jm), jm += 1);
  }
}
const Id = "data-token-hash", Dr = "data-css-hash", jo = "__cssinjs_instance__";
function Cw() {
  const e = Math.random().toString(12).slice(2);
  if (typeof document < "u" && document.head && document.body) {
    const n = document.body.querySelectorAll(`style[${Dr}]`) || [], {
      firstChild: o
    } = document.head;
    Array.from(n).forEach((l) => {
      l[jo] ||= e, l[jo] === e && document.head.insertBefore(l, o);
    });
    const i = {};
    Array.from(document.querySelectorAll(`style[${Dr}]`)).forEach((l) => {
      const c = l.getAttribute(Dr);
      i[c] ? l[jo] === e && l.parentNode?.removeChild(l) : i[c] = !0;
    });
  }
  return new ww(e);
}
const el = /* @__PURE__ */ h.createContext({
  hashPriority: "low",
  cache: Cw(),
  defaultCache: !0,
  autoPrefix: !1
});
function xw(e, n) {
  if (e.length !== n.length)
    return !1;
  for (let o = 0; o < e.length; o++)
    if (e[o] !== n[o])
      return !1;
  return !0;
}
class za {
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
      if (this.size() + 1 > za.MAX_CACHE_SIZE + za.MAX_CACHE_OFFSET) {
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
      return this.keys = this.keys.filter((o) => !xw(o, n)), this.deleteByPath(this.cache, n);
  }
}
let Hm = 0;
class X0 {
  derivatives;
  id;
  constructor(n) {
    this.derivatives = Array.isArray(n) ? n : [n], this.id = Hm, n.length === 0 && (n.length > 0, void 0), Hm += 1;
  }
  getDerivativeToken(n) {
    return this.derivatives.reduce((o, i) => i(n, o), void 0);
  }
}
const Gu = new za();
function Pf(e) {
  const n = Array.isArray(e) ? e : [e];
  return Gu.has(n) || Gu.set(n, new X0(n)), Gu.get(n);
}
const bw = /* @__PURE__ */ new WeakMap(), Yu = {};
function Ew(e, n) {
  let o = bw;
  for (let i = 0; i < n.length; i += 1) {
    const l = n[i];
    o.has(l) || o.set(l, /* @__PURE__ */ new WeakMap()), o = o.get(l);
  }
  return o.has(Yu) || o.set(Yu, e()), o.get(Yu);
}
const Vm = /* @__PURE__ */ new WeakMap();
function Ls(e) {
  let n = Vm.get(e) || "";
  return n || (Object.keys(e).forEach((o) => {
    const i = e[o];
    n += o, i instanceof X0 ? n += i.id : i && typeof i == "object" ? n += Ls(i) : n += i;
  }), n = Us(n), Vm.set(e, n)), n;
}
function $w(e, n) {
  return Us(`${n}_${Ls(e)}`);
}
const Rf = Qn();
function $e(e) {
  return typeof e == "number" ? `${e}px` : e;
}
function G0(e) {
  const {
    hashCls: n,
    hashPriority: o = "low"
  } = e || {};
  if (!n)
    return "";
  const i = `.${n}`;
  return o === "low" ? `:where(${i})` : i;
}
const Pw = (e) => e != null;
function Fd(e, n) {
  const o = typeof n == "function" ? n() : n;
  return o ? {
    ...e,
    csp: {
      ...e.csp,
      nonce: o
    }
  } : e;
}
const ka = (e, n = "") => `--${n ? `${n}-` : ""}${e}`.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, "$1-$2").replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase(), Rw = (e, n, o) => {
  const {
    hashCls: i,
    hashPriority: l = "low",
    scope: c
  } = o || {};
  if (!Object.keys(e).length)
    return "";
  const f = `${G0({
    hashCls: i,
    hashPriority: l
  })}.${n}`, p = [c].flat().filter(Boolean);
  return `${p.length ? p.map((m) => `${f}.${m}`).join(", ") : f}{${Object.entries(e).map(([m, v]) => `${m}:${v};`).join("")}}`;
}, Y0 = (e, n, o) => {
  const {
    hashCls: i,
    hashPriority: l = "low",
    prefix: c,
    unitless: f,
    ignore: p,
    preserve: g
  } = o || {}, m = {}, v = {};
  return Object.entries(e).forEach(([y, w]) => {
    if (g?.[y])
      v[y] = w;
    else if ((typeof w == "string" || typeof w == "number") && !p?.[y]) {
      const x = ka(y, c);
      m[x] = typeof w == "number" && !f?.[y] ? `${w}px` : String(w), v[y] = `var(${x})`;
    }
  }), [v, Rw(m, n, {
    scope: o?.scope,
    hashCls: i,
    hashPriority: l
  })];
}, ca = /* @__PURE__ */ new Map();
function Od(e, n, o, i, l) {
  const {
    cache: c
  } = h.useContext(el), f = [e, ...n], p = $f(f), g = (y) => {
    c.opUpdate(p, (w) => {
      const [x = 0, E] = w || [void 0, void 0], b = E || o(), $ = [x, b];
      return y ? y($) : $;
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
  const v = c.opGet(p)[1];
  return h.useInsertionEffect(() => (g(([y, w]) => [y + 1, w]), ca.has(p) || (l?.(v), ca.set(p, !0), Promise.resolve().then(() => {
    ca.delete(p);
  })), () => {
    c.opUpdate(p, (y) => {
      const [w = 0, x] = y || [];
      return w - 1 === 0 ? (i?.(x, !1), ca.delete(p), null) : [w - 1, x];
    });
  }), [p]), v;
}
const _w = {}, Nw = "css", Fo = /* @__PURE__ */ new Map();
function kw(e) {
  Fo.set(e, (Fo.get(e) || 0) + 1);
}
function Mw(e, n) {
  typeof document < "u" && document.querySelectorAll(`style[${Id}="${e}"]`).forEach((i) => {
    i[jo] === n && i.parentNode?.removeChild(i);
  });
}
const Tw = -1;
function Iw(e, n) {
  Fo.set(e, (Fo.get(e) || 0) - 1);
  const o = /* @__PURE__ */ new Set();
  Fo.forEach((i, l) => {
    i <= 0 && o.add(l);
  }), Fo.size - o.size > Tw && o.forEach((i) => {
    Mw(i, n), Fo.delete(i);
  });
}
const Fw = (e, n, o, i) => {
  let c = {
    ...o.getDerivativeToken(e),
    ...n
  };
  return i && (c = i(c)), c;
}, Ow = "token";
function Aw(e, n, o) {
  const {
    cache: {
      instanceId: i
    },
    container: l,
    hashPriority: c
  } = h.useContext(el), {
    salt: f = "",
    override: p = _w,
    formatToken: g,
    getComputedToken: m,
    cssVar: v,
    nonce: y
  } = o, w = Ew(() => Object.assign({}, ...n), n), x = Ls(w), E = Ls(p), C = Ls(v);
  return Od(Ow, [f, e.id, x, E, C], () => {
    const $ = m ? m(w, p, e) : Fw(w, p, e, g), _ = {
      ...$
    }, R = `${f}_${v.prefix}`, N = Us(R), T = `${Nw}-${N}`;
    _._tokenKey = $w(_, R);
    const [L, F] = Y0($, v.key, {
      prefix: v.prefix,
      ignore: v.ignore,
      unitless: v.unitless,
      preserve: v.preserve,
      hashPriority: c,
      hashCls: v.hashed ? T : void 0
    });
    return L._hashId = N, kw(v.key), [L, T, _, F, v.key];
  }, ([, , , , $]) => {
    Iw($, i);
  }, ([, , , $, _]) => {
    if (!$)
      return;
    let R = {
      mark: Dr,
      prepend: "queue",
      attachTo: l,
      priority: -999
    };
    R = Fd(R, y);
    const N = Do($, Us(`css-var-${_}`), R);
    N[jo] = i, N.setAttribute(Id, _);
  });
}
var Lw = {
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
}, lt = "-ms-", zs = "-moz-", We = "-webkit-", K0 = "comm", Ad = "rule", Ld = "decl", zw = "@import", Bw = "@namespace", Q0 = "@keyframes", Dw = "@layer", jw = Math.abs, Bs = String.fromCharCode, _f = Object.assign;
function Hw(e, n) {
  return At(e, 0) ^ 45 ? (((n << 2 ^ At(e, 0)) << 2 ^ At(e, 1)) << 2 ^ At(e, 2)) << 2 ^ At(e, 3) : 0;
}
function Z0(e) {
  return e.trim();
}
function zr(e, n) {
  return (e = n.exec(e)) ? e[0] : e;
}
function Me(e, n, o) {
  return e.replace(n, o);
}
function Ku(e, n) {
  return e.indexOf(n);
}
function At(e, n) {
  return e.charCodeAt(n) | 0;
}
function Uo(e, n, o) {
  return e.slice(n, o);
}
function ur(e) {
  return e.length;
}
function J0(e) {
  return e.length;
}
function Fs(e, n) {
  return n.push(e), e;
}
function Vw(e, n) {
  return e.map(n).join("");
}
function Wm(e, n) {
  return e.filter(function(o) {
    return !zr(o, n);
  });
}
var ec = 1, ki = 1, ey = 0, Zn = 0, Pt = 0, Ai = "";
function tc(e, n, o, i, l, c, f, p) {
  return { value: e, root: n, parent: o, type: i, props: l, children: c, line: ec, column: ki, length: f, return: "", siblings: p };
}
function po(e, n) {
  return _f(tc("", null, null, "", null, null, 0, e.siblings), e, { length: -e.length }, n);
}
function yi(e) {
  for (; e.root; )
    e = po(e.root, { children: [e] });
  Fs(e, e.siblings);
}
function Ww() {
  return Pt;
}
function Uw() {
  return Pt = Zn > 0 ? At(Ai, --Zn) : 0, ki--, Pt === 10 && (ki = 1, ec--), Pt;
}
function dr() {
  return Pt = Zn < ey ? At(Ai, Zn++) : 0, ki++, Pt === 10 && (ki = 1, ec++), Pt;
}
function mo() {
  return At(Ai, Zn);
}
function Ma() {
  return Zn;
}
function nc(e, n) {
  return Uo(Ai, e, n);
}
function qs(e) {
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
function qw(e) {
  return ec = ki = 1, ey = ur(Ai = e), Zn = 0, [];
}
function Xw(e) {
  return Ai = "", e;
}
function Qu(e) {
  return Z0(nc(Zn - 1, Nf(e === 91 ? e + 2 : e === 40 ? e + 1 : e)));
}
function Gw(e) {
  for (; (Pt = mo()) && Pt < 33; )
    dr();
  return qs(e) > 2 || qs(Pt) > 3 ? "" : " ";
}
function Yw(e, n) {
  for (; --n && dr() && !(Pt < 48 || Pt > 102 || Pt > 57 && Pt < 65 || Pt > 70 && Pt < 97); )
    ;
  return nc(e, Ma() + (n < 6 && mo() == 32 && dr() == 32));
}
function Nf(e) {
  for (; dr(); )
    switch (Pt) {
      // ] ) " '
      case e:
        return Zn;
      // " '
      case 34:
      case 39:
        e !== 34 && e !== 39 && Nf(Pt);
        break;
      // (
      case 40:
        e === 41 && Nf(e);
        break;
      // \
      case 92:
        dr();
        break;
    }
  return Zn;
}
function Kw(e, n) {
  for (; dr() && e + Pt !== 57; )
    if (e + Pt === 84 && mo() === 47)
      break;
  return "/*" + nc(n, Zn - 1) + "*" + Bs(e === 47 ? e : dr());
}
function Qw(e) {
  for (; !qs(mo()); )
    dr();
  return nc(e, Zn);
}
function Um(e) {
  return Xw(Ta("", null, null, null, [""], e = qw(e), 0, [0], e));
}
function Ta(e, n, o, i, l, c, f, p, g) {
  for (var m = 0, v = 0, y = f, w = 0, x = 0, E = 0, C = 1, b = 1, $ = 1, _ = 0, R = 0, N = "", T = l, L = c, F = i, A = N; b; )
    switch (E = R, R = dr()) {
      // (
      case 40:
        E != 108 && At(A, y - 1) == 58 ? (_++, A += "(") : A += Qu(R);
        break;
      // )
      case 41:
        _--, A += ")";
        break;
      // " ' [
      case 34:
      case 39:
      case 91:
        A += Qu(R);
        break;
      // \t \n \r \s
      case 9:
      case 10:
      case 13:
      case 32:
        if (_ > 0) {
          A += Bs(R);
          break;
        }
        A += Gw(E);
        break;
      // \
      case 92:
        A += Yw(Ma() - 1, 7);
        continue;
      // /
      case 47:
        switch (mo()) {
          case 42:
          case 47:
            Fs(Zw(Kw(dr(), Ma()), n, o, g), g), (qs(E || 1) == 5 || qs(mo() || 1) == 5) && ur(A) && Uo(A, -1, void 0) !== " " && (A += " ");
            break;
          default:
            A += "/";
        }
        break;
      // {
      case 123 * C:
        p[m++] = ur(A) * $;
      // } ; \0
      case 125 * C:
      case 59:
      case 0:
        if (_ > 0 && R) {
          A += Bs(R);
          break;
        }
        switch (R) {
          // \0 }
          case 0:
          case 125:
            b = 0;
          // ;
          case 59 + v:
            $ == -1 && (A = Me(A, /\f/g, "")), x > 0 && (ur(A) - y || C === 0) && Fs(x > 32 ? Xm(A + ";", i, o, y - 1, g) : Xm(Me(A, " ", "") + ";", i, o, y - 2, g), g);
            break;
          // @ ;
          case 59:
            A += ";";
          // { rule/at-rule
          default:
            if (Fs(F = qm(A, n, o, m, v, l, p, N, T = [], L = [], y, c), c), R === 123)
              if (v === 0)
                Ta(A, n, F, F, T, c, y, p, L);
              else {
                switch (w) {
                  // c(ontainer)
                  case 99:
                    if (At(A, 3) === 110) break;
                  // l(ayer)
                  case 108:
                    if (At(A, 2) === 97) break;
                  default:
                    v = 0;
                  // d(ocument) m(edia) s(upports)
                  case 100:
                  case 109:
                  case 115:
                }
                v ? Ta(e, F, F, i && Fs(qm(e, F, F, 0, 0, l, p, N, l, T = [], y, L), L), l, L, y, p, i ? T : L) : Ta(A, F, F, F, [""], L, 0, p, L);
              }
        }
        m = v = x = 0, C = $ = 1, N = A = "", y = f;
        break;
      // :
      case 58:
        y = 1 + ur(A), x = E;
      default:
        if (C < 1) {
          if (R == 123)
            --C;
          else if (R == 125 && C++ == 0 && Uw() == 125)
            continue;
        }
        switch (A += Bs(R), R * C) {
          // &
          case 38:
            $ = v > 0 ? 1 : (A += "\f", -1);
            break;
          // ,
          case 44:
            if (_ > 0) break;
            p[m++] = (ur(A) - 1) * $, $ = 1;
            break;
          // @
          case 64:
            mo() === 45 && (A += Qu(dr())), w = mo(), v = y = ur(N = A += Qw(Ma())), R++;
            break;
          // -
          case 45:
            E === 45 && ur(A) == 2 && (C = 0);
        }
    }
  return c;
}
function qm(e, n, o, i, l, c, f, p, g, m, v, y) {
  for (var w = l - 1, x = l === 0 ? c : [""], E = J0(x), C = 0, b = 0, $ = 0; C < i; ++C)
    for (var _ = 0, R = Uo(e, w + 1, w = jw(b = f[C])), N = e; _ < E; ++_)
      (N = Z0(b > 0 ? x[_] + " " + R : Me(R, /&\f/g, x[_]))) && (g[$++] = N);
  return tc(e, n, o, l === 0 ? Ad : p, g, m, v, y);
}
function Zw(e, n, o, i) {
  return tc(e, n, o, K0, Bs(Ww()), Uo(e, 2, -2), 0, i);
}
function Xm(e, n, o, i, l) {
  return tc(e, n, o, Ld, Uo(e, 0, i), Uo(e, i + 1, -1), i, l);
}
function ty(e, n, o) {
  switch (Hw(e, n)) {
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
      return zs + e + e;
    // appearance, user-select, transform, hyphens, text-size-adjust
    case 5349:
    case 4246:
    case 4810:
    case 6968:
    case 2756:
      return We + e + zs + e + lt + e + e;
    // writing-mode
    case 5936:
      switch (At(e, n + 11)) {
        // vertical-l(r)
        case 114:
          return We + e + lt + Me(e, /[svh]\w+-[tblr]{2}/, "tb") + e;
        // vertical-r(l)
        case 108:
          return We + e + lt + Me(e, /[svh]\w+-[tblr]{2}/, "tb-rl") + e;
        // horizontal(-)tb
        case 45:
          return We + e + lt + Me(e, /[svh]\w+-[tblr]{2}/, "lr") + e;
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
      return We + e + Me(e, /(\w+).+(:[^]+)/, We + "box-$1$2" + lt + "flex-$1$2") + e;
    // align-self
    case 5443:
      return We + e + lt + "flex-item-" + Me(e, /flex-|-self/g, "") + (zr(e, /flex-|baseline/) ? "" : lt + "grid-row-" + Me(e, /flex-|-self/g, "")) + e;
    // align-content
    case 4675:
      return We + e + lt + "flex-line-pack" + Me(e, /align-content|flex-|-self/g, "") + e;
    // flex-shrink
    case 5548:
      return We + e + lt + Me(e, "shrink", "negative") + e;
    // flex-basis
    case 5292:
      return We + e + lt + Me(e, "basis", "preferred-size") + e;
    // flex-grow
    case 6060:
      return We + "box-" + Me(e, "-grow", "") + We + e + lt + Me(e, "grow", "positive") + e;
    // transition
    case 4554:
      return We + Me(e, /([^-])(transform)/g, "$1" + We + "$2") + e;
    // cursor
    case 6187:
      return Me(Me(Me(e, /(zoom-|grab)/, We + "$1"), /(image-set)/, We + "$1"), e, "") + e;
    // background, background-image
    case 5495:
    case 3959:
      return Me(e, /(image-set\([^]*)/, We + "$1$`$1");
    // justify-content
    case 4968:
      return Me(Me(e, /(.+:)(flex-)?(.*)/, We + "box-pack:$3" + lt + "flex-pack:$3"), /space-between/, "justify") + We + e + e;
    // justify-self
    case 4200:
      if (!zr(e, /flex-|baseline/)) return lt + "grid-column-align" + Uo(e, n) + e;
      break;
    // grid-template-(columns|rows)
    case 2592:
    case 3360:
      return lt + Me(e, "template-", "") + e;
    // grid-(row|column)-start
    case 4384:
    case 3616:
      return o && o.some(function(i, l) {
        return n = l, zr(i.props, /grid-\w+-end/);
      }) ? ~Ku(e + (o = o[n].value), "span") ? e : lt + Me(e, "-start", "") + e + lt + "grid-row-span:" + (~Ku(o, "span") ? zr(o, /\d+/) : +zr(o, /\d+/) - +zr(e, /\d+/)) + ";" : lt + Me(e, "-start", "") + e;
    // grid-(row|column)-end
    case 4896:
    case 4128:
      return o && o.some(function(i) {
        return zr(i.props, /grid-\w+-start/);
      }) ? e : lt + Me(Me(e, "-end", "-span"), "span ", "") + e;
    // (margin|padding)-inline-(start|end)
    case 4095:
    case 3583:
    case 4068:
    case 2532:
      return Me(e, /(.+)-inline(.+)/, We + "$1$2") + e;
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
      if (ur(e) - 1 - n > 6)
        switch (At(e, n + 1)) {
          // (m)ax-content, (m)in-content
          case 109:
            if (At(e, n + 4) !== 45)
              break;
          // (f)ill-available, (f)it-content
          case 102:
            return Me(e, /(.+:)(.+)-([^]+)/, "$1" + We + "$2-$3$1" + zs + (At(e, n + 3) == 108 ? "$3" : "$2-$3")) + e;
          // (s)tretch
          case 115:
            return ~Ku(e, "stretch") ? ty(Me(e, "stretch", "fill-available"), n, o) + e : e;
        }
      break;
    // grid-(column|row)
    case 5152:
    case 5920:
      return Me(e, /(.+?):(\d+)(\s*\/\s*(span)?\s*(\d+))?(.*)/, function(i, l, c, f, p, g, m) {
        return lt + l + ":" + c + m + (f ? lt + l + "-span:" + (p ? g : +g - +c) + m : "") + e;
      });
    // position: sticky
    case 4949:
      if (At(e, n + 6) === 121)
        return Me(e, ":", ":" + We) + e;
      break;
    // display: (flex|inline-flex|grid|inline-grid)
    case 6444:
      switch (At(e, At(e, 14) === 45 ? 18 : 11)) {
        // (inline-)?fle(x)
        case 120:
          return Me(e, /(.+:)([^;\s!]+)(;|(\s+)?!.+)?/, "$1" + We + (At(e, 14) === 45 ? "inline-" : "") + "box$3$1" + We + "$2$3$1" + lt + "$2box$3") + e;
        // (inline-)?gri(d)
        case 100:
          return Me(e, ":", ":" + lt) + e;
      }
      break;
    // scroll-margin, scroll-margin-(top|right|bottom|left)
    case 5719:
    case 2647:
    case 2135:
    case 3927:
    case 2391:
      return Me(e, "scroll-", "scroll-snap-") + e;
  }
  return e;
}
function Xs(e, n) {
  for (var o = "", i = 0; i < e.length; i++)
    o += n(e[i], i, e, n) || "";
  return o;
}
function Gm(e, n, o, i) {
  switch (e.type) {
    case Dw:
      if (e.children.length) break;
    case zw:
    case Bw:
    case Ld:
      return e.return = e.return || e.value;
    case K0:
      return "";
    case Q0:
      return e.return = e.value + "{" + Xs(e.children, i) + "}";
    case Ad:
      if (!ur(e.value = e.props.join(","))) return "";
  }
  return ur(o = Xs(e.children, i)) ? e.return = e.value + "{" + o + "}" : "";
}
function Jw(e) {
  var n = J0(e);
  return function(o, i, l, c) {
    for (var f = "", p = 0; p < n; p++)
      f += e[p](o, i, l, c) || "";
    return f;
  };
}
function eC(e, n, o, i) {
  if (e.length > -1 && !e.return)
    switch (e.type) {
      case Ld:
        e.return = ty(e.value, e.length, o);
        return;
      case Q0:
        return Xs([po(e, { value: Me(e.value, "@", "@" + We) })], i);
      case Ad:
        if (e.length)
          return Vw(o = e.props, function(l) {
            switch (zr(l, i = /(::plac\w+|:read-\w+)/)) {
              // :read-(only|write)
              case ":read-only":
              case ":read-write":
                yi(po(e, { props: [Me(l, /:(read-\w+)/, ":" + zs + "$1")] })), yi(po(e, { props: [l] })), _f(e, { props: Wm(o, i) });
                break;
              // :placeholder
              case "::placeholder":
                yi(po(e, { props: [Me(l, /:(plac\w+)/, ":" + We + "input-$1")] })), yi(po(e, { props: [Me(l, /:(plac\w+)/, ":" + zs + "$1")] })), yi(po(e, { props: [Me(l, /:(plac\w+)/, lt + "input-$1")] })), yi(po(e, { props: [l] })), _f(e, { props: Wm(o, i) });
                break;
            }
            return "";
          });
    }
}
const Ym = "data-ant-cssinjs-cache-path", ny = "_FILE_STYLE__";
let Ho, ry = !0;
function tC() {
  if (!Ho && (Ho = {}, Qn())) {
    const e = document.createElement("div");
    e.className = Ym, e.style.position = "fixed", e.style.visibility = "hidden", e.style.top = "-9999px", document.body.appendChild(e);
    let n = getComputedStyle(e).content || "";
    n = n.replace(/^"/, "").replace(/"$/, ""), n.split(";").forEach((i) => {
      const [l, c] = i.split(":");
      Ho[l] = c;
    });
    const o = document.querySelector(`style[${Ym}]`);
    o && (ry = !1, o.parentNode?.removeChild(o)), document.body.removeChild(e);
  }
}
function nC(e) {
  return tC(), !!Ho[e];
}
function rC(e) {
  const n = Ho[e];
  let o = null;
  if (n && Qn())
    if (ry)
      o = ny;
    else {
      const i = document.querySelector(`style[${Dr}="${Ho[e]}"]`);
      i ? o = i.innerHTML : delete Ho[e];
    }
  return [o, n];
}
const oC = "_skip_check_", oy = "_multi_value_";
function Zu(e, n) {
  return (n ? Xs(Um(e), Jw([eC, Gm])) : Xs(Um(e), Gm)).replace(/\{%%%\:[^;];}/g, ";");
}
function iC(e) {
  return typeof e == "object" && e && (oC in e || oy in e);
}
function Km(e, n, o = "high") {
  if (!n)
    return e;
  const i = G0({
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
const kf = (e, n = {}, {
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
    linters: v = []
  } = n;
  let y = "", w = {};
  function x(b) {
    const $ = b.getName(c);
    if (!w[$]) {
      const [_] = kf(b.style, n, {
        root: !1,
        parentSelectors: l
      });
      w[$] = `@keyframes ${b.getName(c)}${_}`;
    }
  }
  function E(b, $ = []) {
    return b.forEach((_) => {
      Array.isArray(_) ? E(_, $) : _ && $.push(_);
    }), $;
  }
  return E(Array.isArray(e) ? e : [e]).forEach((b) => {
    const $ = typeof b == "string" && !o ? {} : b;
    if (typeof $ == "string")
      y += `${$}
`;
    else if ($._keyframe)
      x($);
    else {
      const _ = m.reduce((R, N) => N?.visit?.(R) || R, $);
      Object.keys(_).forEach((R) => {
        const N = _[R];
        if (typeof N == "object" && N && (R !== "animationName" || !N._keyframe) && !iC(N)) {
          let T = !1, L = R.trim(), F = !1;
          (o || i) && c ? L.startsWith("@") ? T = !0 : L === "&" ? L = Km("", c, g) : L = Km(R, c, g) : o && !c && (L === "&" || L === "") && (L = "", F = !0);
          const [A, H] = kf(N, n, {
            root: F,
            injectHash: T,
            parentSelectors: [...l, L]
          });
          w = {
            ...w,
            ...H
          }, y += `${L}${A}`;
        } else {
          let T = function(F, A) {
            const H = F.replace(/[A-Z]/g, (V) => `-${V.toLowerCase()}`);
            let Y = A;
            !Lw[F] && typeof Y == "number" && Y !== 0 && (Y = `${Y}px`), F === "animationName" && A?._keyframe && (x(A), Y = A.getName(c)), y += `${H}:${Y};`;
          };
          const L = N?.value ?? N;
          typeof N == "object" && N?.[oy] && Array.isArray(L) ? L.forEach((F) => {
            T(R, F);
          }) : Pw(L) && T(R, L);
        }
      });
    }
  }), o ? f && (y && (y = `@layer ${f.name} {${y}}`), f.dependencies && (w[`@layer ${f.name}`] = f.dependencies.map((b) => `@layer ${b}, ${f.name};`).join(`
`))) : y = `{${y}}`, [y, w];
};
function iy(e, n) {
  return Us(`${e.join("%")}${n}`);
}
const sC = "style";
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
    container: v,
    transformers: y,
    linters: w,
    cache: x,
    layer: E,
    autoPrefix: C
  } = h.useContext(el), b = [i || ""];
  E && b.push("layer"), b.push(...o);
  let $ = Rf;
  Od(
    sC,
    b,
    // Create cache if needed
    () => {
      const _ = b.join("|");
      if (nC(_)) {
        const [A, H] = rC(_);
        if (A)
          return [A, H, {}, f, p];
      }
      const R = n(), [N, T] = kf(R, {
        hashId: i,
        hashPriority: m,
        layer: E ? l : void 0,
        path: o.join("-"),
        transformers: y,
        linters: w
      }), L = Zu(N, C || !1), F = iy(b, L);
      return [L, F, T, f, p];
    },
    // Remove cache if no need
    (_, R) => {
      const [, N] = _;
      R && Rf && Hs(N, {
        mark: Dr,
        attachTo: v
      });
    },
    // Effect: Inject style here
    (_) => {
      const [R, N, T, , L] = _;
      if ($ && R !== ny) {
        let F = {
          mark: Dr,
          prepend: E ? !1 : "queue",
          attachTo: v,
          priority: L
        };
        F = Fd(F, c);
        const A = [], H = [];
        Object.keys(T).forEach((V) => {
          V.startsWith("@layer") ? A.push(V) : H.push(V);
        }), A.forEach((V) => {
          Do(Zu(T[V], C || !1), `_layer-${V}`, {
            ...F,
            prepend: !0
          });
        });
        const Y = Do(R, N, F);
        Y[jo] = x.instanceId, H.forEach((V) => {
          Do(Zu(T[V], C || !1), `_effect-${V}`, F);
        });
      }
    }
  );
}
const lC = "cssVar", aC = (e, n) => {
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
      instanceId: v
    },
    container: y,
    hashPriority: w
  } = h.useContext(el), {
    _tokenKey: x
  } = f, E = Array.isArray(g) ? g.join("@@") : g, C = [...e.path, o, E, x];
  return Od(lC, C, () => {
    const $ = n(), [_, R] = Y0($, o, {
      prefix: i,
      unitless: l,
      ignore: c,
      scope: g,
      hashPriority: w,
      hashCls: p
    }), N = iy(C, R);
    return [_, R, N, o];
  }, ([, , $]) => {
    Rf && Hs($, {
      mark: Dr,
      attachTo: y
    });
  }, ([, $, _]) => {
    if (!$)
      return;
    let R = {
      mark: Dr,
      prepend: "queue",
      attachTo: y,
      priority: -999
    };
    R = Fd(R, m);
    const N = Do($, _, R);
    N[jo] = v, N.setAttribute(Id, o);
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
function vi(e) {
  return e.notSplit = !0, e;
}
vi(["borderTop", "borderBottom"]), vi(["borderTop"]), vi(["borderBottom"]), vi(["borderLeft", "borderRight"]), vi(["borderLeft"]), vi(["borderRight"]);
function pr(e) {
  "@babel/helpers - typeof";
  return pr = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(n) {
    return typeof n;
  } : function(n) {
    return n && typeof Symbol == "function" && n.constructor === Symbol && n !== Symbol.prototype ? "symbol" : typeof n;
  }, pr(e);
}
function cC(e) {
  if (Array.isArray(e)) return e;
}
function uC(e, n) {
  var o = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
  if (o != null) {
    var i, l, c, f, p = [], g = !0, m = !1;
    try {
      if (c = (o = o.call(e)).next, n === 0) {
        if (Object(o) !== o) return;
        g = !1;
      } else for (; !(g = (i = c.call(o)).done) && (p.push(i.value), p.length !== n); g = !0) ;
    } catch (v) {
      m = !0, l = v;
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
function fC() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function Ba(e, n) {
  return cC(e) || uC(e, n) || q0(e, n) || fC();
}
function dC(e, n) {
  if (pr(e) != "object" || !e) return e;
  var o = e[Symbol.toPrimitive];
  if (o !== void 0) {
    var i = o.call(e, n);
    if (pr(i) != "object") return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (n === "string" ? String : Number)(e);
}
function sy(e) {
  var n = dC(e, "string");
  return pr(n) == "symbol" ? n : n + "";
}
function $t(e, n, o) {
  return (n = sy(n)) in e ? Object.defineProperty(e, n, {
    value: o,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[n] = o, e;
}
function Qm(e, n) {
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
    n % 2 ? Qm(Object(o), !0).forEach(function(i) {
      $t(e, i, o[i]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(o)) : Qm(Object(o)).forEach(function(i) {
      Object.defineProperty(e, i, Object.getOwnPropertyDescriptor(o, i));
    });
  }
  return e;
}
function Li(e, n) {
  if (!(e instanceof n)) throw new TypeError("Cannot call a class as a function");
}
function pC(e, n) {
  for (var o = 0; o < n.length; o++) {
    var i = n[o];
    i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, sy(i.key), i);
  }
}
function zi(e, n, o) {
  return n && pC(e.prototype, n), Object.defineProperty(e, "prototype", {
    writable: !1
  }), e;
}
function Ia(e) {
  if (e === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  return e;
}
function Tf(e, n) {
  return Tf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(o, i) {
    return o.__proto__ = i, o;
  }, Tf(e, n);
}
function hC(e, n) {
  if (typeof n != "function" && n !== null) throw new TypeError("Super expression must either be null or a function");
  e.prototype = Object.create(n && n.prototype, {
    constructor: {
      value: e,
      writable: !0,
      configurable: !0
    }
  }), Object.defineProperty(e, "prototype", {
    writable: !1
  }), n && Tf(e, n);
}
function Da(e) {
  return Da = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(n) {
    return n.__proto__ || Object.getPrototypeOf(n);
  }, Da(e);
}
function ly() {
  try {
    var e = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (ly = function() {
    return !!e;
  })();
}
function mC(e, n) {
  if (n && (pr(n) == "object" || typeof n == "function")) return n;
  if (n !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
  return Ia(e);
}
function gC(e) {
  var n = ly();
  return function() {
    var o, i = Da(e);
    if (n) {
      var l = Da(this).constructor;
      o = Reflect.construct(i, arguments, l);
    } else o = i.apply(this, arguments);
    return mC(this, o);
  };
}
var yC = /* @__PURE__ */ zi(function e() {
  Li(this, e);
}), ay = "CALC_UNIT", vC = new RegExp(ay, "g");
function Ju(e) {
  return typeof e == "number" ? "".concat(e).concat(ay) : e;
}
var SC = /* @__PURE__ */ (function(e) {
  hC(o, e);
  var n = gC(o);
  function o(i, l) {
    var c;
    Li(this, o), c = n.call(this), $t(Ia(c), "result", ""), $t(Ia(c), "unitlessCssVar", void 0), $t(Ia(c), "lowPriority", void 0);
    var f = pr(i);
    return c.unitlessCssVar = l, i instanceof o ? c.result = "(".concat(i.result, ")") : f === "number" ? c.result = Ju(i) : f === "string" && (c.result = i), c;
  }
  return zi(o, [{
    key: "add",
    value: function(l) {
      return l instanceof o ? this.result = "".concat(this.result, " + ").concat(l.getResult()) : (typeof l == "number" || typeof l == "string") && (this.result = "".concat(this.result, " + ").concat(Ju(l))), this.lowPriority = !0, this;
    }
  }, {
    key: "sub",
    value: function(l) {
      return l instanceof o ? this.result = "".concat(this.result, " - ").concat(l.getResult()) : (typeof l == "number" || typeof l == "string") && (this.result = "".concat(this.result, " - ").concat(Ju(l))), this.lowPriority = !0, this;
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
      }) && (g = !1), this.result = this.result.replace(vC, g ? "px" : ""), typeof this.lowPriority < "u" ? "calc(".concat(this.result, ")") : this.result;
    }
  }]), o;
})(yC), wC = function(n, o) {
  var i = SC;
  return function(l) {
    return new i(l, o);
  };
}, Zm = function(n, o) {
  return "".concat([o, n.replace(/([A-Z]+)([A-Z][a-z]+)/g, "$1-$2").replace(/([a-z])([A-Z])/g, "$1-$2")].filter(Boolean).join("-"));
};
function Jm(e, n, o, i) {
  var l = bn({}, n[e]);
  if (i != null && i.deprecatedTokens) {
    var c = i.deprecatedTokens;
    c.forEach(function(p) {
      var g = Ba(p, 2), m = g[0], v = g[1];
      if (l != null && l[m] || l != null && l[v]) {
        var y;
        (y = l[v]) !== null && y !== void 0 || (l[v] = l?.[m]);
      }
    });
  }
  var f = bn(bn({}, o), l);
  return Object.keys(f).forEach(function(p) {
    f[p] === n[p] && delete f[p];
  }), f;
}
var cy = typeof CSSINJS_STATISTIC < "u", If = !0;
function er() {
  for (var e = arguments.length, n = new Array(e), o = 0; o < e; o++)
    n[o] = arguments[o];
  if (!cy)
    return Object.assign.apply(Object, [{}].concat(n));
  If = !1;
  var i = {};
  return n.forEach(function(l) {
    if (pr(l) === "object") {
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
  }), If = !0, i;
}
var eg = {};
function CC() {
}
var xC = function(n) {
  var o, i = n, l = CC;
  return cy && typeof Proxy < "u" && (o = /* @__PURE__ */ new Set(), i = new Proxy(n, {
    get: function(f, p) {
      if (If) {
        var g;
        (g = o) === null || g === void 0 || g.add(p);
      }
      return f[p];
    }
  }), l = function(f, p) {
    var g;
    eg[f] = {
      global: Array.from(o),
      component: bn(bn({}, (g = eg[f]) === null || g === void 0 ? void 0 : g.component), p)
    };
  }), {
    token: i,
    keys: o,
    flush: l
  };
};
function tg(e, n, o) {
  if (typeof o == "function") {
    var i;
    return o(er(n, (i = n[e]) !== null && i !== void 0 ? i : {}));
  }
  return o ?? {};
}
function bC(e) {
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
var EC = 1e3 * 60 * 10, $C = /* @__PURE__ */ (function() {
  function e() {
    Li(this, e), $t(this, "map", /* @__PURE__ */ new Map()), $t(this, "objectIDMap", /* @__PURE__ */ new WeakMap()), $t(this, "nextID", 0), $t(this, "lastAccessBeat", /* @__PURE__ */ new Map()), $t(this, "accessBeat", 0);
  }
  return zi(e, [{
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
        return c && pr(c) === "object" ? "obj_".concat(i.getObjectID(c)) : "".concat(pr(c), "_").concat(c);
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
          i - l > EC && (o.map.delete(c), o.lastAccessBeat.delete(c));
        }), this.accessBeat = 0;
      }
    }
  }]), e;
})(), ng = new $C();
function PC(e, n) {
  return Se.useMemo(function() {
    var o = ng.get(n);
    if (o)
      return o;
    var i = e();
    return ng.set(n, i), i;
  }, n);
}
var RC = function() {
  return {};
};
function _C(e) {
  var n = e.useCSP, o = n === void 0 ? RC : n, i = e.useToken, l = e.usePrefix, c = e.getResetStyles, f = e.getCommonStyle, p = e.getCompUnitless;
  function g(w, x, E, C) {
    var b = Array.isArray(w) ? w[0] : w;
    function $(A) {
      return "".concat(String(b)).concat(A.slice(0, 1).toUpperCase()).concat(A.slice(1));
    }
    var _ = C?.unitless || {}, R = typeof p == "function" ? p(w) : {}, N = bn(bn({}, R), {}, $t({}, $("zIndexPopup"), !0));
    Object.keys(_).forEach(function(A) {
      N[$(A)] = _[A];
    });
    var T = bn(bn({}, C), {}, {
      unitless: N,
      prefixToken: $
    }), L = v(w, x, E, T), F = m(b, E, T);
    return function(A) {
      var H = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : A, Y = L(A, H), V = C?.extraCssVarPrefixCls, X = typeof V == "function" ? V({
        prefixCls: A,
        rootCls: H
      }) : V, Q = F(X != null && X.length ? [H].concat(Ws(X)) : H);
      return [Y, Q];
    };
  }
  function m(w, x, E) {
    var C = E.unitless, b = E.prefixToken, $ = E.ignore;
    return function(_) {
      var R = i(), N = R.cssVar, T = R.realToken, L = o();
      return aC({
        path: [w],
        prefix: N.prefix,
        key: N.key,
        unitless: C,
        ignore: $,
        token: T,
        scope: _,
        nonce: function() {
          return L.nonce;
        }
      }, function() {
        var F = tg(w, T, x), A = Jm(w, T, F, {
          deprecatedTokens: E?.deprecatedTokens
        });
        return F && Object.keys(F).forEach(function(H) {
          A[b(H)] = A[H], delete A[H];
        }), A;
      }), N?.key;
    };
  }
  function v(w, x, E) {
    var C = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {}, b = Array.isArray(w) ? w : [w, w], $ = Ba(b, 1), _ = $[0], R = b.join("-"), N = e.layer || {
      name: "antd"
    };
    return function(T) {
      var L = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : T, F = i(), A = F.theme, H = F.realToken, Y = F.hashId, V = F.token, X = F.cssVar, Q = F.zeroRuntime, oe = h.useMemo(function() {
        return Q;
      }, []);
      if (oe)
        return Y;
      var G = l(), le = G.rootPrefixCls, he = G.iconPrefixCls, j = o(), J = "css", U = PC(function() {
        var se = /* @__PURE__ */ new Set();
        return Object.keys(C.unitless || {}).forEach(function(re) {
          se.add(ka(re, X.prefix)), se.add(ka(re, Zm(_, X.prefix)));
        }), wC(J, se);
      }, [J, _, X?.prefix]), k = bC(), O = k.max, ee = k.min, te = {
        theme: A,
        token: V,
        hashId: Y,
        nonce: function() {
          return j.nonce;
        },
        clientOnly: C.clientOnly,
        layer: N,
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
        path: [R, T, he]
      }), function() {
        if (C.injectStyle === !1)
          return [];
        var se = xC(V), re = se.token, fe = se.flush, ie = tg(_, H, E), Z = ".".concat(T), ae = Jm(_, H, ie, {
          deprecatedTokens: C.deprecatedTokens
        });
        ie && pr(ie) === "object" && Object.keys(ie).forEach(function(Qe) {
          ie[Qe] = "var(".concat(ka(Qe, Zm(_, X.prefix)), ")");
        });
        var ce = er(re, {
          componentCls: Z,
          prefixCls: T,
          iconCls: ".".concat(he),
          antCls: ".".concat(le),
          calc: U,
          max: O,
          min: ee
        }, ie), ke = x(ce, {
          hashId: Y,
          prefixCls: T,
          rootPrefixCls: le,
          iconPrefixCls: he
        });
        fe(_, ae);
        var qe = typeof f == "function" ? f(ce, T, L, C.resetFont) : null;
        return [C.resetStyle === !1 ? null : qe, ke];
      }), Y;
    };
  }
  function y(w, x, E) {
    var C = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {}, b = v(w, x, E, bn({
      resetStyle: !1,
      // Sub Style should default after root one
      order: -998
    }, C)), $ = function(R) {
      var N = R.prefixCls, T = R.rootCls, L = T === void 0 ? N : T;
      return b(N, L), null;
    };
    return $;
  }
  return {
    genStyleHooks: g,
    genSubStyleComponent: y,
    genComponentStyleHook: v
  };
}
const Gs = ["blue", "purple", "cyan", "green", "magenta", "pink", "red", "orange", "yellow", "volcano", "geekblue", "lime", "gold"];
function NC(e) {
  return (e + 8) / e;
}
function kC(e) {
  const n = Array.from({
    length: 10
  }).map((o, i) => {
    const l = i - 1, c = e * Math.E ** (l / 5), f = i > 1 ? Math.floor(c) : Math.ceil(c);
    return Math.floor(f / 2) * 2;
  });
  return n[1] = e, n.map((o) => ({
    size: o,
    lineHeight: NC(o)
  }));
}
const MC = "6.5.4", uy = {
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
}, Ys = {
  // preset color palettes
  ...uy,
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
}, TC = {
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
function ef(e, n) {
  const o = e.replace(/^[^(]*\((.*)/, "$1").replace(/\).*/, "").match(/\d*\.?\d+%?/g) || [], i = o.map((l) => parseFloat(l));
  for (let l = 0; l < 3; l += 1)
    i[l] = n(i[l] || 0, o[l] || "", l);
  return o[3] ? i[3] = o[3].includes("%") ? i[3] / 100 : i[3] : i[3] = 1, i;
}
const rg = (e, n, o) => o === 0 ? e : e / 100;
function Cs(e, n) {
  const o = n || 255;
  return e > o ? o : e < 0 ? 0 : e;
}
class Rt {
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
        const c = TC[i.toLowerCase()];
        c && this.fromHexString(
          // Convert 36 hex to 16 hex
          parseInt(c, 36).toString(16).padStart(6, "0")
        );
      }
    } else if (n instanceof Rt)
      this.r = n.r, this.g = n.g, this.b = n.b, this.a = n.a, this._h = n._h, this._hsl_s = n._hsl_s, this._hsv_s = n._hsv_s, this._l = n._l, this._v = n._v;
    else if (o("rgb"))
      this.r = Cs(n.r), this.g = Cs(n.g), this.b = Cs(n.b), this.a = typeof n.a == "number" ? Cs(n.a, 1) : 1;
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
    return l[n] = Cs(o, i), l;
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
    const m = c / 60, v = (1 - Math.abs(2 * i - 1)) * o, y = v * (1 - Math.abs(m % 2 - 1));
    m >= 0 && m < 1 ? (f = v, p = y) : m >= 1 && m < 2 ? (f = y, p = v) : m >= 2 && m < 3 ? (p = v, g = y) : m >= 3 && m < 4 ? (p = y, g = v) : m >= 4 && m < 5 ? (f = y, g = v) : m >= 5 && m < 6 && (f = v, g = y);
    const w = i - v / 2;
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
    const p = c / 60, g = Math.floor(p), m = p - g, v = Vt(i * (1 - o) * 255), y = Vt(i * (1 - o * m) * 255), w = Vt(i * (1 - o * (1 - m)) * 255);
    switch (g) {
      case 0:
        this.g = w, this.b = v;
        break;
      case 1:
        this.r = y, this.b = v;
        break;
      case 2:
        this.r = v, this.b = w;
        break;
      case 3:
        this.r = v, this.g = y;
        break;
      case 4:
        this.r = w, this.g = v;
        break;
      default:
        this.g = v, this.b = y;
        break;
    }
  }
  fromHsvString(n) {
    const o = ef(n, rg);
    this.fromHsv({
      h: o[0],
      s: o[1],
      v: o[2],
      a: o[3]
    });
  }
  fromHslString(n) {
    const o = ef(n, rg);
    this.fromHsl({
      h: o[0],
      s: o[1],
      l: o[2],
      a: o[3]
    });
  }
  fromRgbString(n) {
    const o = ef(n, (i, l) => (
      // Convert percentage to number. e.g. 50% -> 128
      l.includes("%") ? Vt(i / 100 * 255) : i
    ));
    this.r = o[0], this.g = o[1], this.b = o[2], this.a = o[3];
  }
}
const ua = 2, og = 0.16, IC = 0.05, FC = 0.05, OC = 0.15, fy = 5, dy = 4, AC = [{
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
function ig(e, n, o) {
  let i;
  return Math.round(e.h) >= 60 && Math.round(e.h) <= 240 ? i = o ? Math.round(e.h) - ua * n : Math.round(e.h) + ua * n : i = o ? Math.round(e.h) + ua * n : Math.round(e.h) - ua * n, i < 0 ? i += 360 : i >= 360 && (i -= 360), i;
}
function sg(e, n, o) {
  if (e.h === 0 && e.s === 0)
    return e.s;
  let i;
  return o ? i = e.s - og * n : n === dy ? i = e.s + og : i = e.s + IC * n, i > 1 && (i = 1), o && n === fy && i > 0.1 && (i = 0.1), i < 0.06 && (i = 0.06), Math.round(i * 100) / 100;
}
function lg(e, n, o) {
  let i;
  return o ? i = e.v + FC * n : i = e.v - OC * n, i = Math.max(0, Math.min(1, i)), Math.round(i * 100) / 100;
}
function py(e, n = {}) {
  const o = [], i = new Rt(e), l = i.toHsv();
  for (let c = fy; c > 0; c -= 1) {
    const f = new Rt({
      h: ig(l, c, !0),
      s: sg(l, c, !0),
      v: lg(l, c, !0)
    });
    o.push(f);
  }
  o.push(i);
  for (let c = 1; c <= dy; c += 1) {
    const f = new Rt({
      h: ig(l, c),
      s: sg(l, c),
      v: lg(l, c)
    });
    o.push(f);
  }
  return n.theme === "dark" ? AC.map(({
    index: c,
    amount: f
  }) => new Rt(n.backgroundColor || "#141414").mix(o[c], f).toHexString()) : o.map((c) => c.toHexString());
}
const Pi = {
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
}, Ff = ["#fff1f0", "#ffccc7", "#ffa39e", "#ff7875", "#ff4d4f", "#f5222d", "#cf1322", "#a8071a", "#820014", "#5c0011"];
Ff.primary = Ff[5];
const Of = ["#fff2e8", "#ffd8bf", "#ffbb96", "#ff9c6e", "#ff7a45", "#fa541c", "#d4380d", "#ad2102", "#871400", "#610b00"];
Of.primary = Of[5];
const Af = ["#fff7e6", "#ffe7ba", "#ffd591", "#ffc069", "#ffa940", "#fa8c16", "#d46b08", "#ad4e00", "#873800", "#612500"];
Af.primary = Af[5];
const Lf = ["#fffbe6", "#fff1b8", "#ffe58f", "#ffd666", "#ffc53d", "#faad14", "#d48806", "#ad6800", "#874d00", "#613400"];
Lf.primary = Lf[5];
const zf = ["#feffe6", "#ffffb8", "#fffb8f", "#fff566", "#ffec3d", "#fadb14", "#d4b106", "#ad8b00", "#876800", "#614700"];
zf.primary = zf[5];
const Bf = ["#fcffe6", "#f4ffb8", "#eaff8f", "#d3f261", "#bae637", "#a0d911", "#7cb305", "#5b8c00", "#3f6600", "#254000"];
Bf.primary = Bf[5];
const Df = ["#f6ffed", "#d9f7be", "#b7eb8f", "#95de64", "#73d13d", "#52c41a", "#389e0d", "#237804", "#135200", "#092b00"];
Df.primary = Df[5];
const jf = ["#e6fffb", "#b5f5ec", "#87e8de", "#5cdbd3", "#36cfc9", "#13c2c2", "#08979c", "#006d75", "#00474f", "#002329"];
jf.primary = jf[5];
const Hf = ["#e6f4ff", "#bae0ff", "#91caff", "#69b1ff", "#4096ff", "#1677ff", "#0958d9", "#003eb3", "#002c8c", "#001d66"];
Hf.primary = Hf[5];
const Vf = ["#f0f5ff", "#d6e4ff", "#adc6ff", "#85a5ff", "#597ef7", "#2f54eb", "#1d39c4", "#10239e", "#061178", "#030852"];
Vf.primary = Vf[5];
const Wf = ["#f9f0ff", "#efdbff", "#d3adf7", "#b37feb", "#9254de", "#722ed1", "#531dab", "#391085", "#22075e", "#120338"];
Wf.primary = Wf[5];
const Uf = ["#fff0f6", "#ffd6e7", "#ffadd2", "#ff85c0", "#f759ab", "#eb2f96", "#c41d7f", "#9e1068", "#780650", "#520339"];
Uf.primary = Uf[5];
const qf = ["#a6a6a6", "#999999", "#8c8c8c", "#808080", "#737373", "#666666", "#404040", "#1a1a1a", "#000000", "#000000"];
qf.primary = qf[5];
const tf = {
  red: Ff,
  volcano: Of,
  orange: Af,
  gold: Lf,
  yellow: zf,
  lime: Bf,
  green: Df,
  cyan: jf,
  blue: Hf,
  geekblue: Vf,
  purple: Wf,
  magenta: Uf,
  grey: qf
};
function LC(e, {
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
  } = e, v = n(p), y = n(i), w = n(l), x = n(c), E = n(f), C = o(g, m), b = e.colorLink || e.colorInfo, $ = n(b), _ = new Rt(x[1]).mix(new Rt(x[3]), 50).toHexString(), R = {};
  return Gs.forEach((N) => {
    const T = e[N];
    if (T) {
      const L = n(T);
      R[`${N}Hover`] = L[5], R[`${N}Active`] = L[7];
    }
  }), {
    ...C,
    colorPrimaryBg: v[1],
    colorPrimaryBgHover: v[2],
    colorPrimaryBorder: v[3],
    colorPrimaryBorderHover: v[4],
    colorPrimaryHover: v[5],
    colorPrimary: v[6],
    colorPrimaryActive: v[7],
    colorPrimaryTextHover: v[8],
    colorPrimaryText: v[9],
    colorPrimaryTextActive: v[10],
    colorSuccessBg: y[1],
    colorSuccessBgHover: y[2],
    colorSuccessBorder: y[3],
    colorSuccessBorderHover: y[4],
    colorSuccessHover: y[4],
    colorSuccess: y[6],
    colorSuccessActive: y[7],
    colorSuccessTextHover: y[8],
    colorSuccessText: y[9],
    colorSuccessTextActive: y[10],
    colorErrorBg: x[1],
    colorErrorBgHover: x[2],
    colorErrorBgFilledHover: _,
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
    colorInfoBg: E[1],
    colorInfoBgHover: E[2],
    colorInfoBorder: E[3],
    colorInfoBorderHover: E[4],
    colorInfoHover: E[4],
    colorInfo: E[6],
    colorInfoActive: E[7],
    colorInfoTextHover: E[8],
    colorInfoText: E[9],
    colorInfoTextActive: E[10],
    colorLinkHover: $[4],
    colorLink: $[6],
    colorLinkActive: $[7],
    ...R,
    colorBgMask: new Rt("#000").setA(0.45).toRgbString(),
    colorWhite: "#fff"
  };
}
const zC = (e) => {
  let n = e, o = e, i = e, l = e;
  return e < 6 && e >= 5 ? n = e + 1 : e < 16 && e >= 6 ? n = e + 2 : e >= 16 && (n = 16), e < 7 && e >= 5 ? o = 4 : e < 8 && e >= 7 ? o = 5 : e < 14 && e >= 8 ? o = 6 : e < 16 && e >= 14 ? o = 7 : e >= 16 && (o = 8), e < 6 && e >= 2 ? i = 1 : e >= 6 && (i = 2), e > 4 && e < 8 ? l = 4 : e >= 8 && (l = 6), {
    borderRadius: e,
    borderRadiusXS: i,
    borderRadiusSM: o,
    borderRadiusLG: n,
    borderRadiusOuter: l
  };
};
function BC(e) {
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
    ...zC(i)
  };
}
const DC = (e) => {
  const {
    controlHeight: n
  } = e;
  return {
    controlHeightSM: n * 0.75,
    controlHeightXS: n * 0.5,
    controlHeightLG: n * 1.25
  };
}, jC = (e) => {
  const n = kC(e), o = n.map((v) => v.size), i = n.map((v) => v.lineHeight), l = o[1], c = o[0], f = o[2], p = i[1], g = i[0], m = i[2];
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
function HC(e) {
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
const Xn = (e, n) => new Rt(e).setA(n).toRgbString(), Si = (e, n) => new Rt(e).darken(n).toHexString(), VC = (e) => {
  const n = py(e);
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
}, WC = (e, n, o) => {
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
    colorBgLayout: Si(i, 4),
    colorBgContainer: Si(i, 0),
    colorBgElevated: Si(i, 0),
    colorBgSpotlight: Xn(l, 0.85),
    colorBgBlur: "transparent",
    colorBorder: Si(i, 15),
    colorBorderDisabled: Si(i, 15),
    colorBorderSecondary: Si(i, 6)
  };
};
function hy(e) {
  Pi.pink = Pi.magenta, tf.pink = tf.magenta;
  const n = Object.keys(uy).map((o) => {
    const i = e[o] === Pi[o] ? tf[o] : py(e[o]);
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
    ...LC(e, {
      generateColorPalettes: VC,
      generateNeutralColorPalettes: WC
    }),
    // Font
    ...jC(e.fontSize),
    // Size
    ...HC(e),
    // Height
    ...DC(e),
    // Others
    ...BC(e)
  };
}
const my = Pf(hy), ja = {
  token: Ys,
  override: {
    override: Ys
  },
  hashed: !0
}, gy = /* @__PURE__ */ Se.createContext(ja);
function nf(e) {
  return e >= 0 && e <= 255;
}
function fa(e, n) {
  const {
    r: o,
    g: i,
    b: l,
    a: c
  } = new Rt(e).toRgb();
  if (c < 1)
    return e;
  const {
    r: f,
    g: p,
    b: g
  } = new Rt(n).toRgb();
  for (let m = 0.01; m <= 1; m += 0.01) {
    const v = Math.round((o - f * (1 - m)) / m), y = Math.round((i - p * (1 - m)) / m), w = Math.round((l - g * (1 - m)) / m);
    if (nf(v) && nf(y) && nf(w))
      return new Rt({
        r: v,
        g: y,
        b: w,
        a: Math.round(m * 100) / 100
      }).toRgbString();
  }
  return new Rt({
    r: o,
    g: i,
    b: l,
    a: 1
  }).toRgbString();
}
function UC(e) {
  const {
    override: n,
    ...o
  } = e, i = {
    ...n
  };
  Object.keys(Ys).forEach((b) => {
    delete i[b];
  });
  const l = {
    ...o,
    ...i
  }, c = new Rt(l.colorShadow), f = c.a, p = (b) => c.clone().setA(f * b).toRgbString(), g = 480, m = 576, v = 768, y = 992, w = 1200, x = 1600, E = 1920;
  return l.motion === !1 && (l.motionDurationFast = "0s", l.motionDurationMid = "0s", l.motionDurationSlow = "0s"), {
    ...l,
    // ============== Background ============== //
    colorFillContent: l.colorFillSecondary,
    colorFillContentHover: l.colorFill,
    colorFillAlter: l.colorFillQuaternary,
    colorBgContainerDisabled: l.colorFillTertiary,
    // ============== Split ============== //
    colorBorderBg: l.colorBgContainer,
    colorSplit: fa(l.colorBorderSecondary, l.colorBgContainer),
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
    colorErrorOutline: fa(l.colorErrorBg, l.colorBgContainer),
    colorWarningOutline: fa(l.colorWarningBg, l.colorBgContainer),
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
    controlOutline: fa(l.colorPrimaryBg, l.colorBgContainer),
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
    screenSMMax: v - 1,
    screenMD: v,
    screenMDMin: v,
    screenMDMax: y - 1,
    screenLG: y,
    screenLGMin: y,
    screenLGMax: w - 1,
    screenXL: w,
    screenXLMin: w,
    screenXLMax: x - 1,
    screenXXL: x,
    screenXXLMin: x,
    screenXXLMax: E - 1,
    screenXXXL: E,
    screenXXXLMin: E,
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
const yy = {
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
}, qC = {
  motionBase: !0,
  motionUnit: !0
}, XC = {
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
}, vy = (e, n, o) => {
  const i = o.getDerivativeToken(e), {
    override: l,
    ...c
  } = n;
  let f = {
    ...i,
    override: l
  };
  return f = UC(f), c && Object.entries(c).forEach(([p, g]) => {
    const {
      theme: m,
      ...v
    } = g;
    let y = v;
    m && (y = vy({
      ...f,
      ...v
    }, {
      override: v
    }, m)), f[p] = y;
  }), f;
};
function tl() {
  const {
    token: e,
    hashed: n,
    theme: o,
    override: i,
    cssVar: l,
    zeroRuntime: c
  } = Se.useContext(gy), {
    csp: f,
    getPrefixCls: p
  } = Se.useContext(On), g = {
    prefix: l?.prefix ?? p(),
    key: l?.key ?? "css-var-root"
  }, m = `${MC}-${n || ""}`, v = o || my, [y, w, x] = Aw(v, [Ys, e], {
    salt: m,
    override: i,
    getComputedToken: vy,
    cssVar: {
      ...g,
      unitless: yy,
      ignore: qC,
      preserve: XC
    },
    nonce: f?.nonce
  });
  return [v, x, n ? w : "", y, g, !!c];
}
const GC = {
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis"
}, jr = (e, n = !1) => ({
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
}), Sy = () => ({
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
}), YC = new sn("loadingCircle", {
  "100%": {
    transform: "rotate(360deg)"
  }
}), KC = () => ({
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
}), zd = (e, n) => ({
  outline: `${$e(e.lineWidthFocus)} solid ${e.colorPrimaryBorder}`,
  outlineOffset: 1,
  transition: ["outline-offset", "outline"].map((o) => `${o} 0s`).join(", ")
}), wy = (e, n) => ({
  "&:focus-visible": zd(e)
}), QC = (e) => ({
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
    ...wy(e),
    "&[disabled]": {
      color: e.colorTextDisabled,
      cursor: "not-allowed"
    }
  }
}), ZC = (e, n, o, i) => {
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
}, Cy = (e) => ({
  [`.${e}`]: {
    ...Sy(),
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
    animationName: YC,
    animationDuration: "1s",
    animationIterationCount: "infinite",
    animationTimingFunction: "linear"
  }
}), {
  genStyleHooks: Hr
} = _C({
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
    const [e, n, o, i, l, c] = tl();
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
    const o = QC(e);
    return [o, {
      "&": o
    }, Cy(n?.prefix.iconPrefixCls ?? Td)];
  },
  getCommonStyle: ZC,
  getCompUnitless: () => yy
}), nl = (e, n) => {
  const o = `--${e.replace(/\./g, "")}-${n}-`;
  return [(c) => `${o}${c}`, (c, f) => f ? `var(${o}${c}, ${f})` : `var(${o}${c})`];
};
function JC(e, n) {
  return Gs.reduce((o, i) => {
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
const ex = (e, n) => (tl(), Mf({
  hashId: "",
  path: ["ant-design-icons", e],
  nonce: () => n?.nonce,
  layer: {
    name: "antd"
  }
}, () => Cy(e)));
var da = {}, ag;
function tx() {
  if (ag) return da;
  ag = 1, Object.defineProperty(da, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm193.5 301.7l-210.6 292a31.8 31.8 0 01-51.7 0L318.5 484.9c-3.8-5.3 0-12.7 6.5-12.7h46.9c10.2 0 19.9 4.9 25.9 13.3l71.2 98.8 157.2-218c6-8.3 15.6-13.3 25.9-13.3H699c6.5 0 10.3 7.4 6.5 12.7z" } }] }, name: "check-circle", theme: "filled" };
  return da.default = e, da;
}
var nx = /* @__PURE__ */ tx();
const rx = /* @__PURE__ */ Jn(nx), Bd = /* @__PURE__ */ h.createContext({}), cg = "data-rc-order", ug = "data-rc-priority", ox = "rc-util-key", Xf = /* @__PURE__ */ new Map();
function xy() {
  return !!(typeof window < "u" && window.document && window.document.createElement);
}
function ix(e, n) {
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
function by({
  mark: e
} = {}) {
  return e ? e.startsWith("data-") ? e : `data-${e}` : ox;
}
function Dd(e) {
  return e.attachTo ? e.attachTo : document.querySelector("head") || document.body;
}
function sx(e) {
  return e === "queue" ? "prependQueue" : e ? "prepend" : "append";
}
function jd(e) {
  return Array.from((Xf.get(e) || e).children).filter((n) => n.tagName === "STYLE");
}
function Ey(e, n = {}) {
  if (!xy())
    return null;
  const {
    csp: o,
    prepend: i,
    priority: l = 0
  } = n, c = sx(i), f = c === "prependQueue", p = document.createElement("style");
  p.setAttribute(cg, c), f && l && p.setAttribute(ug, `${l}`), o?.nonce && (p.nonce = o.nonce), p.innerHTML = e;
  const g = Dd(n), {
    firstChild: m
  } = g;
  if (i) {
    if (f) {
      const v = (n.styles || jd(g)).filter((y) => {
        if (!["prepend", "prependQueue"].includes(y.getAttribute(cg)))
          return !1;
        const w = Number(y.getAttribute(ug) || 0);
        return l >= w;
      });
      if (v.length)
        return g.insertBefore(p, v[v.length - 1].nextSibling), p;
    }
    g.insertBefore(p, m);
  } else
    g.appendChild(p);
  return p;
}
function lx(e, n = {}) {
  let {
    styles: o
  } = n;
  return o ||= jd(Dd(n)), o.find((i) => i.getAttribute(by(n)) === e);
}
function ax(e, n) {
  const o = Xf.get(e);
  if (!o || !ix(document, o)) {
    const i = Ey("", n);
    if (!i)
      return;
    const {
      parentNode: l
    } = i;
    Xf.set(e, l), e.removeChild(i);
  }
}
function cx(e, n, o = {}) {
  if (!xy())
    return null;
  const i = Dd(o), l = jd(i), c = {
    ...o,
    styles: l
  };
  ax(i, c);
  const f = lx(n, c);
  if (f)
    return c.csp?.nonce && f.nonce !== c.csp.nonce && (f.nonce = c.csp.nonce), f.innerHTML !== e && (f.innerHTML = e), f;
  const p = Ey(e, c);
  return p?.setAttribute(by(c), n), p;
}
function ux(e) {
  return e?.getRootNode?.();
}
function fx(e) {
  const n = ux(e);
  return typeof ShadowRoot < "u" && n instanceof ShadowRoot ? n : null;
}
const fg = {};
function dx(e, n) {
  e || fg[n] || (fg[n] = !0);
}
function px(e) {
  return e.replace(/-(.)/g, (n, o) => o.toUpperCase());
}
function hx(e, n) {
  dx(e, `[@ant-design/icons] ${n}`);
}
function dg(e) {
  return typeof e == "object" && typeof e.name == "string" && typeof e.theme == "string" && (typeof e.icon == "object" || typeof e.icon == "function");
}
function pg(e = {}) {
  return Object.keys(e).reduce((n, o) => {
    const i = e[o];
    return o === "class" ? (n.className = i, delete n.class) : (delete n[o], n[px(o)] = i), n;
  }, {});
}
function Gf(e, n, o) {
  return o ? /* @__PURE__ */ Se.createElement(e.tag, {
    key: n,
    ...pg(e.attrs),
    ...o
  }, (e.children || []).map((i, l) => Gf(i, `${n}-${e.tag}-${l}`))) : /* @__PURE__ */ Se.createElement(e.tag, {
    key: n,
    ...pg(e.attrs)
  }, (e.children || []).map((i, l) => Gf(i, `${n}-${e.tag}-${l}`)));
}
const mx = `
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
`, gx = (e) => {
  const {
    csp: n,
    prefixCls: o,
    layer: i,
    zeroRuntime: l
  } = h.useContext(Bd);
  let c = mx;
  o && (c = c.replace(/anticon/g, o)), i && (c = `@layer ${i} {
${c}
}`), h.useEffect(() => {
    if (l)
      return;
    const f = e.current, p = fx(f);
    cx(c, "@ant-design-icons", {
      prepend: !i,
      csp: n,
      attachTo: p
    });
  }, []);
}, $y = (e) => {
  const {
    icon: n,
    className: o,
    onClick: i,
    style: l,
    primaryColor: c,
    secondaryColor: f,
    ...p
  } = e, g = h.useRef(null);
  if (gx(g), hx(dg(n), `icon should be icon definiton, but got ${n}`), !dg(n))
    return null;
  const m = n;
  return Gf(m.icon, `svg-${m.name}`, {
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
$y.displayName = "IconReact";
function Yf() {
  return Yf = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Yf.apply(this, arguments);
}
const Er = /* @__PURE__ */ h.forwardRef((e, n) => {
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
    prefixCls: v = "anticon",
    rootClassName: y
  } = h.useContext(Bd), w = we(y, v, {
    [`${v}-${i.name}`]: !!i.name,
    [`${v}-spin`]: !!l || i.name === "loading"
  }, o);
  let x = f;
  x === void 0 && p && (x = -1);
  const E = c ? {
    msTransform: `rotate(${c}deg)`,
    transform: `rotate(${c}deg)`
  } : void 0;
  return /* @__PURE__ */ h.createElement("span", Yf({
    role: "img",
    "aria-label": i.name
  }, m, {
    ref: n,
    tabIndex: x,
    onClick: p,
    className: w
  }), /* @__PURE__ */ h.createElement($y, {
    icon: i,
    style: E
  }));
});
function Kf() {
  return Kf = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Kf.apply(this, arguments);
}
const yx = (e, n) => /* @__PURE__ */ h.createElement(Er, Kf({}, e, {
  ref: n,
  icon: rx
})), vx = /* @__PURE__ */ h.forwardRef(yx);
var pa = {}, hg;
function Sx() {
  if (hg) return pa;
  hg = 1, Object.defineProperty(pa, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { "fill-rule": "evenodd", viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M512 64c247.4 0 448 200.6 448 448S759.4 960 512 960 64 759.4 64 512 264.6 64 512 64zm127.98 274.82h-.04l-.08.06L512 466.75 384.14 338.88c-.04-.05-.06-.06-.08-.06a.12.12 0 00-.07 0c-.03 0-.05.01-.09.05l-45.02 45.02a.2.2 0 00-.05.09.12.12 0 000 .07v.02a.27.27 0 00.06.06L466.75 512 338.88 639.86c-.05.04-.06.06-.06.08a.12.12 0 000 .07c0 .03.01.05.05.09l45.02 45.02a.2.2 0 00.09.05.12.12 0 00.07 0c.02 0 .04-.01.08-.05L512 557.25l127.86 127.87c.04.04.06.05.08.05a.12.12 0 00.07 0c.03 0 .05-.01.09-.05l45.02-45.02a.2.2 0 00.05-.09.12.12 0 000-.07v-.02a.27.27 0 00-.05-.06L557.25 512l127.87-127.86c.04-.04.05-.06.05-.08a.12.12 0 000-.07c0-.03-.01-.05-.05-.09l-45.02-45.02a.2.2 0 00-.09-.05.12.12 0 00-.07 0z" } }] }, name: "close-circle", theme: "filled" };
  return pa.default = e, pa;
}
var wx = /* @__PURE__ */ Sx();
const Cx = /* @__PURE__ */ Jn(wx);
function Qf() {
  return Qf = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Qf.apply(this, arguments);
}
const xx = (e, n) => /* @__PURE__ */ h.createElement(Er, Qf({}, e, {
  ref: n,
  icon: Cx
})), bx = /* @__PURE__ */ h.forwardRef(xx);
var ha = {}, mg;
function Ex() {
  if (mg) return ha;
  mg = 1, Object.defineProperty(ha, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { "fill-rule": "evenodd", viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M799.86 166.31c.02 0 .04.02.08.06l57.69 57.7c.04.03.05.05.06.08a.12.12 0 010 .06c0 .03-.02.05-.06.09L569.93 512l287.7 287.7c.04.04.05.06.06.09a.12.12 0 010 .07c0 .02-.02.04-.06.08l-57.7 57.69c-.03.04-.05.05-.07.06a.12.12 0 01-.07 0c-.03 0-.05-.02-.09-.06L512 569.93l-287.7 287.7c-.04.04-.06.05-.09.06a.12.12 0 01-.07 0c-.02 0-.04-.02-.08-.06l-57.69-57.7c-.04-.03-.05-.05-.06-.07a.12.12 0 010-.07c0-.03.02-.05.06-.09L454.07 512l-287.7-287.7c-.04-.04-.05-.06-.06-.09a.12.12 0 010-.07c0-.02.02-.04.06-.08l57.7-57.69c.03-.04.05-.05.07-.06a.12.12 0 01.07 0c.03 0 .05.02.09.06L512 454.07l287.7-287.7c.04-.04.06-.05.09-.06a.12.12 0 01.07 0z" } }] }, name: "close", theme: "outlined" };
  return ha.default = e, ha;
}
var $x = /* @__PURE__ */ Ex();
const Px = /* @__PURE__ */ Jn($x);
function Zf() {
  return Zf = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Zf.apply(this, arguments);
}
const Rx = (e, n) => /* @__PURE__ */ h.createElement(Er, Zf({}, e, {
  ref: n,
  icon: Px
})), _x = /* @__PURE__ */ h.forwardRef(Rx), Py = /* @__PURE__ */ h.createContext({}), Nx = (e) => {
  const {
    children: n,
    ...o
  } = e, i = h.useMemo(() => ({
    motion: o.motion
  }), [o.motion]);
  return /* @__PURE__ */ h.createElement(Py.Provider, {
    value: i
  }, n);
}, br = "none", ma = "appear", ga = "enter", ya = "leave", gg = "none", fr = "prepare", Oo = "start", Ao = "active", Hd = "end", Ry = "prepared";
function yg(e, n) {
  const o = {};
  return o[e.toLowerCase()] = n.toLowerCase(), o[`Webkit${e}`] = `webkit${n}`, o[`Moz${e}`] = `moz${n}`, o[`ms${e}`] = `MS${n}`, o[`O${e}`] = `o${n.toLowerCase()}`, o;
}
function kx(e, n) {
  const o = {
    animationend: yg("Animation", "AnimationEnd"),
    transitionend: yg("Transition", "TransitionEnd")
  };
  return e && ("AnimationEvent" in n || delete o.animationend.animation, "TransitionEvent" in n || delete o.transitionend.transition), o;
}
const Mx = kx(Qn(), typeof window < "u" ? window : {});
let _y = {};
Qn() && ({
  style: _y
} = document.createElement("div"));
const va = {};
function Ny(e) {
  if (va[e])
    return va[e];
  const n = Mx[e];
  if (n) {
    const o = Object.keys(n), i = o.length;
    for (let l = 0; l < i; l += 1) {
      const c = o[l];
      if (Object.prototype.hasOwnProperty.call(n, c) && c in _y)
        return va[e] = n[c], va[e];
    }
  }
  return "";
}
const ky = Ny("animationend"), My = Ny("transitionend"), Tx = !!(ky && My), vg = ky || "animationend", Sg = My || "transitionend";
function wg(e, n) {
  if (!e) return null;
  if (typeof e == "object") {
    const o = n.replace(/-\w/g, (i) => i[1].toUpperCase());
    return e[o];
  }
  return `${e}-${n}`;
}
const Ix = ((e) => {
  const n = h.useRef();
  function o(l) {
    l && (l.removeEventListener(Sg, e), l.removeEventListener(vg, e));
  }
  function i(l) {
    n.current && n.current !== l && o(n.current), l && l !== n.current && (l.addEventListener(Sg, e), l.addEventListener(vg, e), n.current = l);
  }
  return h.useEffect(() => () => {
    o(n.current), n.current = null;
  }, []), [i, o];
}), Ty = Qn() ? h.useLayoutEffect : h.useEffect, Fx = (() => {
  const e = h.useRef(null);
  function n() {
    go.cancel(e.current);
  }
  function o(i, l = 2) {
    n();
    const c = go(() => {
      l <= 1 ? i({
        isCanceled: () => c !== e.current
      }) : o(i, l - 1);
    });
    e.current = c;
  }
  return h.useEffect(() => () => {
    n();
  }, []), [o, n];
}), Ox = [fr, Oo, Ao, Hd], Ax = [fr, Ry], Iy = !1, Lx = !0;
function Fy(e) {
  return e === Ao || e === Hd;
}
const zx = ((e, n, o) => {
  const [i, l] = SS(gg), [c, f] = Fx();
  function p() {
    l(fr, !0);
  }
  const g = n ? Ax : Ox;
  return Ty(() => {
    if (i !== gg && i !== Hd) {
      const m = g.indexOf(i), v = g[m + 1], y = o(i);
      y === Iy ? l(v, !0) : v && c((w) => {
        function x() {
          w.isCanceled() || l(v, !0);
        }
        y === !0 ? x() : Promise.resolve(y).then(x);
      });
    }
  }, [e, i]), h.useEffect(() => () => {
    f();
  }, []), [p, i];
});
function Bx(e, n, o, {
  motionEnter: i = !0,
  motionAppear: l = !0,
  motionLeave: c = !0,
  motionDeadline: f,
  motionLeaveImmediately: p,
  onAppearPrepare: g,
  onEnterPrepare: m,
  onLeavePrepare: v,
  onAppearStart: y,
  onEnterStart: w,
  onLeaveStart: x,
  onAppearActive: E,
  onEnterActive: C,
  onLeaveActive: b,
  onAppearEnd: $,
  onEnterEnd: _,
  onLeaveEnd: R,
  onVisibleChanged: N
}) {
  const [T, L] = h.useState(), [F, A] = CS(br), [H, Y] = h.useState([null, null]), V = F(), X = h.useRef(!1), Q = h.useRef(null);
  function oe() {
    return o();
  }
  const G = h.useRef(!1);
  function le() {
    A(br), Y([null, null]);
  }
  const he = wt((ie) => {
    const Z = F();
    if (Z === br)
      return;
    const ae = oe();
    if (ie && !ie.deadline && ie.target !== ae)
      return;
    const ce = G.current;
    let ke;
    Z === ma && ce ? ke = $?.(ae, ie) : Z === ga && ce ? ke = _?.(ae, ie) : Z === ya && ce && (ke = R?.(ae, ie)), ce && ke !== !1 && le();
  }), [j] = Ix(he), J = (ie) => {
    switch (ie) {
      case ma:
        return {
          [fr]: g,
          [Oo]: y,
          [Ao]: E
        };
      case ga:
        return {
          [fr]: m,
          [Oo]: w,
          [Ao]: C
        };
      case ya:
        return {
          [fr]: v,
          [Oo]: x,
          [Ao]: b
        };
      default:
        return {};
    }
  }, U = h.useMemo(() => J(V), [V]), [k, O] = zx(V, !e, (ie) => {
    if (ie === fr) {
      const Z = U[fr];
      return Z ? Z(oe()) : Iy;
    }
    return ie in U && Y([U[ie]?.(oe(), null) || null, ie]), ie === Ao && V !== br && (j(oe()), f > 0 && (clearTimeout(Q.current), Q.current = setTimeout(() => {
      he({
        deadline: !0
      });
    }, f))), ie === Ry && le(), Lx;
  }), ee = Fy(O);
  G.current = ee;
  const te = h.useRef(null);
  Ty(() => {
    if (X.current && te.current === n)
      return;
    L(n);
    const ie = X.current;
    X.current = !0;
    let Z;
    !ie && n && l && (Z = ma), ie && n && i && (Z = ga), (ie && !n && c || !ie && p && !n && c) && (Z = ya);
    const ae = J(Z);
    Z && (e || ae[fr]) ? (A(Z), k()) : A(br), te.current = n;
  }, [n]), h.useEffect(() => {
    // Cancel appear
    (V === ma && !l || // Cancel enter
    V === ga && !i || // Cancel leave
    V === ya && !c) && A(br);
  }, [l, i, c]), h.useEffect(() => () => {
    X.current = !1, clearTimeout(Q.current);
  }, []);
  const se = h.useRef(!1);
  h.useEffect(() => {
    T && (se.current = !0), T !== void 0 && V === br && ((se.current || T) && N?.(T), se.current = !0);
  }, [T, V]);
  let re = H[0];
  U[fr] && O === Oo && (re = {
    transition: "none",
    ...re
  });
  const fe = H[1];
  return [
    F,
    O,
    re,
    T ?? n,
    // Appear Check
    !X.current && V === br && e && l ? "NONE" : (
      // Enter or Leave check
      O === Oo || O === Ao ? fe === O : !0
    )
  ];
}
function Dx(e) {
  return e?.length < 2;
}
function jx(e) {
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
      motionName: v,
      leavedClassName: y,
      eventProps: w
    } = l, {
      motion: x
    } = h.useContext(Py), E = o(l, x), C = h.useRef();
    function b() {
      return Md(C.current);
    }
    const [$, _, R, N, T] = Bx(E, f, b, l), L = $(), F = h.useRef(N);
    N && (F.current = !0);
    const A = h.useMemo(() => {
      const V = {};
      return Object.defineProperties(V, {
        nativeElement: {
          enumerable: !0,
          get: b
        },
        inMotion: {
          enumerable: !0,
          get: () => () => $() !== br
        },
        enableMotion: {
          enumerable: !0,
          get: () => () => E
        }
      }), V;
    }, []);
    h.useImperativeHandle(c, () => A, []);
    const H = h.useRef(0);
    T && (H.current += 1);
    const Y = h.useMemo(() => {
      if (T === "NONE")
        return null;
      let V;
      const X = {
        ...w,
        visible: f
      };
      if (!m)
        V = null;
      else if (L === br)
        N ? V = m({
          ...X
        }, C) : !p && F.current && y ? V = m({
          ...X,
          className: y
        }, C) : g || !p && !y ? V = m({
          ...X,
          style: {
            display: "none"
          }
        }, C) : V = null;
      else {
        let Q;
        _ === fr ? Q = "prepare" : Fy(_) ? Q = "active" : _ === Oo && (Q = "start");
        const oe = wg(v, `${L}-${Q}`);
        V = m({
          ...X,
          className: we(wg(v, L), {
            [oe]: oe && Q,
            [v]: typeof v == "string"
          }),
          style: R
        }, C);
      }
      return V;
    }, [H.current]);
    if (Dx(m) && NS(Y)) {
      const V = Qa(Y);
      if (V !== C)
        return /* @__PURE__ */ h.cloneElement(Y, {
          ref: Js(V, C)
        });
    }
    return Y;
  });
  return i.displayName = "CSSMotion", i;
}
const rl = jx(Tx), Hx = (e) => e != null, Vx = (e) => Hx(e) && e !== !1 && e !== "", rf = (e) => typeof e == "number" && !Number.isNaN(e), Wx = (e) => typeof e == "string", Vr = (e) => e !== null && typeof e == "object", Bi = (e) => typeof e == "function", Oy = (e = {}, ...n) => n.filter((o) => !!o).reduce((o, i) => (Object.keys(i).forEach((l) => {
  const c = e[l], f = i[l];
  if (c)
    if (Vr(f))
      o[l] = Oy(c, o[l], f);
    else {
      const {
        _default: p
      } = c;
      p && (o[l] = o[l] || {}, o[l][p] = we(o[l][p], f));
    }
  else
    o[l] = we(o[l], f);
}), o), {}), Ux = (e, ...n) => h.useMemo(() => Oy.apply(void 0, [e].concat(n)), [e].concat(n)), qx = (...e) => e.filter((n) => !!n).reduce((n, o = {}) => (Object.keys(o).forEach((i) => {
  n[i] = {
    ...n[i],
    ...o[i]
  };
}), n), {}), Xx = (...e) => h.useMemo(() => qx.apply(void 0, e), [].concat(e)), Mi = (e) => h.useMemo(() => e ? {
  root: e
} : void 0, [e]), Cg = (e, n) => Bi(e) ? e(n) : e, ol = (e, n, o, i) => {
  const l = e.map((g) => g ? Cg(g, o) : void 0), c = n.map((g) => g ? Cg(g, o) : void 0), f = Ux.apply(void 0, [i].concat(Ws(l))), p = Xx.apply(void 0, Ws(c));
  return h.useMemo(() => [f, p], [f, p, i]);
}, Vd = (e) => `${e}-css-var`, Gx = /* @__PURE__ */ h.createContext(void 0), Mn = "${label} is not a valid ${type}", rc = {
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
        string: Mn,
        method: Mn,
        array: Mn,
        object: Mn,
        number: Mn,
        date: Mn,
        boolean: Mn,
        integer: Mn,
        float: Mn,
        regexp: Mn,
        email: Mn,
        url: Mn,
        hex: Mn
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
  ...rc.Modal
});
let Fa = [];
const xg = () => Fa.reduce((e, n) => ({
  ...e,
  ...n
}), rc.Modal);
function Yx(e) {
  if (e) {
    const n = {
      ...e
    };
    return Fa.push(n), xg(), () => {
      Fa = Fa.filter((o) => o !== n), xg();
    };
  }
  ({
    ...rc.Modal
  });
}
const Ay = /* @__PURE__ */ h.createContext(void 0), Kx = "internalMark", Qx = (e) => {
  const {
    locale: n = {},
    children: o,
    _ANT_MARK__: i
  } = e;
  h.useEffect(() => Yx(n?.Modal), [n]);
  const l = h.useMemo(() => ({
    ...n,
    exist: !0
  }), [n]);
  return /* @__PURE__ */ h.createElement(Ay.Provider, {
    value: l
  }, o);
}, Ly = /* @__PURE__ */ h.createContext(null);
let Zx = !1;
function Jx(e) {
  return Zx;
}
const bg = [];
function eb(e, n) {
  const [o] = h.useState(() => Qn() ? document.createElement("div") : null), i = h.useRef(!1), l = h.useContext(Ly), [c, f] = h.useState(bg), p = l || (i.current ? void 0 : (v) => {
    f((y) => [v, ...y]);
  });
  function g() {
    o.parentElement || document.body.appendChild(o), i.current = !0;
  }
  function m() {
    o.parentElement?.removeChild(o), i.current = !1;
  }
  return un(() => (e ? l ? l(g) : g() : m(), m), [e]), un(() => {
    c.length && (c.forEach((v) => v()), f(bg));
  }, [c]), [o, p];
}
function tb() {
  return document.body.scrollHeight > (window.innerHeight || document.documentElement.clientHeight) && window.innerWidth > document.body.offsetWidth;
}
const nb = `rc-util-locker-${Date.now()}`;
let Eg = 0;
function rb(e) {
  const n = !!e, [o] = h.useState(() => (Eg += 1, `${nb}_${Eg}`));
  un(() => {
    if (n) {
      const i = zS(document.body).width, l = tb();
      Do(`
html body {
  overflow-y: hidden;
  ${l ? `width: calc(100% - ${i}px);` : ""}
}`, o);
    } else
      Hs(o);
    return () => {
      Hs(o);
    };
  }, [n, o]);
}
let zo = [];
const ob = 200;
let zy = 0;
const By = (e) => {
  if (e.key === "Escape" && !e.isComposing) {
    if (Date.now() - zy < ob)
      return;
    const o = zo.length;
    for (let i = o - 1; i >= 0; i -= 1)
      zo[i].onEsc({
        top: i === o - 1,
        event: e
      });
  }
}, Dy = () => {
  zy = Date.now();
};
function ib() {
  window.addEventListener("keydown", By), window.addEventListener("compositionend", Dy);
}
function sb() {
  zo.length === 0 && (window.removeEventListener("keydown", By), window.removeEventListener("compositionend", Dy));
}
function lb(e, n) {
  const o = Zs(), i = wt(n), l = () => {
    zo.find((f) => f.id === o) || zo.push({
      id: o,
      onEsc: i
    });
  }, c = () => {
    zo = zo.filter((f) => f.id !== o);
  };
  h.useMemo(() => {
    e ? l() : e || c();
  }, [e]), h.useEffect(() => {
    if (e)
      return l(), ib(), () => {
        c(), sb();
      };
  }, [e]);
}
const $g = (e) => e === !1 ? !1 : !Qn() || !e ? null : typeof e == "string" ? document.querySelector(e) : typeof e == "function" ? e() : e, Wd = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    open: o,
    autoLock: i,
    getContainer: l,
    debug: c,
    autoDestroy: f = !0,
    children: p,
    onEsc: g
  } = e, [m, v] = h.useState(o), y = m || o;
  h.useEffect(() => {
    (f || o) && v(o);
  }, [o, f]);
  const [w, x] = h.useState(() => $g(l));
  h.useEffect(() => {
    const T = $g(l);
    x(() => (
      // React do the state update even the value is the same,
      // Use function call to force React to compare update
      T ?? null
    ));
  });
  const [E, C] = eb(y && !w), b = w ?? E;
  rb(i && o && Qn() && (b === E || b === document.body)), lb(o, g);
  let $ = null;
  p && _d(p) && n && ($ = Qa(p));
  const _ = Rd($, n);
  if (!y || !Qn() || w === void 0)
    return null;
  const R = b === !1 || Jx();
  let N = p;
  return n && (N = /* @__PURE__ */ h.cloneElement(p, {
    ref: _
  })), /* @__PURE__ */ h.createElement(Ly.Provider, {
    value: C
  }, R ? N : /* @__PURE__ */ Ja.createPortal(N, b));
});
function ab(e) {
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
  } = l, v = h.useRef(null);
  if (!o || !o.points)
    return null;
  const y = {
    position: "absolute"
  };
  if (o.autoArrow !== !1) {
    const w = o.points[0], x = o.points[1], E = w[0], C = w[1], b = x[0], $ = x[1];
    E === b || !["t", "b"].includes(E) ? y.top = m : E === "t" ? y.top = 0 : y.bottom = 0, C === $ || !["l", "r"].includes(C) ? y.left = g : C === "l" ? y.left = 0 : y.right = 0;
  }
  return /* @__PURE__ */ h.createElement("div", {
    ref: v,
    className: we(`${n}-arrow`, c),
    style: {
      ...y,
      ...p
    }
  }, f);
}
function Jf() {
  return Jf = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Jf.apply(this, arguments);
}
function cb(e) {
  const {
    prefixCls: n,
    open: o,
    zIndex: i,
    mask: l,
    motion: c,
    mobile: f
  } = e;
  return l ? /* @__PURE__ */ h.createElement(rl, Jf({}, c, {
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
const ub = /* @__PURE__ */ h.memo(({
  children: e
}) => e, (e, n) => n.cache);
function jy(e, n, o, i, l, c, f, p) {
  const g = "auto", m = e ? {} : {
    left: "-1000vw",
    top: "-1000vh",
    right: g,
    bottom: g
  };
  if (!e && (n || !o)) {
    const {
      points: v
    } = i, y = i.dynamicInset || i._experimental?.dynamicInset, w = y && v[0][1] === "r", x = y && v[0][0] === "b";
    w ? (m.right = l, m.left = g) : (m.left = f, m.right = g), x ? (m.bottom = c, m.top = g) : (m.top = p, m.bottom = g);
  }
  return m;
}
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
const Hy = /* @__PURE__ */ h.forwardRef((e, n) => {
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
    keepDom: v,
    fresh: y,
    // Click
    onClick: w,
    // Mask
    mask: x,
    // Arrow
    arrow: E,
    arrowPos: C,
    align: b,
    // Motion
    motion: $,
    maskMotion: _,
    // Mobile
    mobile: R,
    // Portal
    forceRender: N,
    getPopupContainer: T,
    autoDestroy: L,
    portal: F,
    children: A,
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
    stretch: O,
    targetWidth: ee,
    targetHeight: te
  } = e, se = typeof i == "function" ? i() : i, re = m || v, fe = !!R, [ie, Z, ae] = h.useMemo(() => R ? [R.mask, R.maskMotion, R.motion] : [x, _, $], [R, x, _, $]), ce = T?.length > 0, [ke, qe] = h.useState(!T || !ce);
  un(() => {
    !ke && ce && p && qe(!0);
  }, [ke, ce, p]);
  const Qe = wt((ut, Ae) => {
    k?.(ut, Ae), J();
  }), _e = jy(fe, oe, m, b, he, j, G, le);
  if (!ke)
    return null;
  const Xe = {};
  return O && (O.includes("height") && te ? Xe.height = te : O.includes("minHeight") && te && (Xe.minHeight = te), O.includes("width") && ee ? Xe.width = ee : O.includes("minWidth") && ee && (Xe.minWidth = ee)), m || (Xe.pointerEvents = "none"), /* @__PURE__ */ h.createElement(F, {
    open: N || re,
    getContainer: T && (() => T(p)),
    autoDestroy: L,
    onEsc: o
  }, /* @__PURE__ */ h.createElement(cb, {
    prefixCls: c,
    open: m,
    zIndex: H,
    mask: ie,
    motion: Z,
    mobile: fe
  }), /* @__PURE__ */ h.createElement(W0, {
    onResize: Qe,
    disabled: !m
  }, (ut) => /* @__PURE__ */ h.createElement(rl, ed({
    motionAppear: !0,
    motionEnter: !0,
    motionLeave: !0,
    removeOnLeave: !1,
    forceRender: N,
    leavedClassName: `${c}-hidden`
  }, ae, {
    onAppearPrepare: U,
    onEnterPrepare: U,
    visible: m,
    onVisibleChanged: (Ae) => {
      $?.onVisibleChanged?.(Ae), g(Ae);
    }
  }), ({
    className: Ae,
    style: Ct
  }, Ze) => {
    const tt = we(c, Ae, l, {
      [`${c}-mobile`]: fe
    });
    return /* @__PURE__ */ h.createElement("div", {
      ref: Js(ut, n, Ze),
      className: tt,
      style: {
        "--arrow-x": `${C.x || 0}px`,
        "--arrow-y": `${C.y || 0}px`,
        ..._e,
        ...Xe,
        ...Ct,
        boxSizing: "border-box",
        zIndex: H,
        ...f
      },
      onMouseEnter: Y,
      onMouseLeave: V,
      onPointerEnter: X,
      onClick: w,
      onPointerDownCapture: Q
    }, E && /* @__PURE__ */ h.createElement(ab, {
      prefixCls: c,
      arrow: E,
      arrowPos: C,
      align: b
    }), /* @__PURE__ */ h.createElement(ub, {
      cache: !m && !y
    }, se));
  })), A);
}), Ha = /* @__PURE__ */ h.createContext(null), Vy = /* @__PURE__ */ h.createContext(null);
function Pg(e) {
  return e ? Array.isArray(e) ? e : [e] : [];
}
function fb(e, n, o) {
  return h.useMemo(() => {
    const i = Pg(n ?? e), l = Pg(o ?? e), c = new Set(i), f = new Set(l);
    return c.has("hover") && !c.has("click") && c.add("touch"), f.has("hover") && !f.has("click") && f.add("touch"), [c, f];
  }, [e, n, o]);
}
function db(e = [], n = [], o) {
  const i = (l, c) => l[c] || "";
  return o ? i(e, 0) === i(n, 0) : i(e, 0) === i(n, 0) && i(e, 1) === i(n, 1);
}
function Wy(e, n, o, i) {
  const {
    points: l
  } = o, c = Object.keys(e);
  for (let f = 0; f < c.length; f += 1) {
    const p = c[f];
    if (db(e[p]?.points, l, i))
      return `${n}-placement-${p}`;
  }
  return "";
}
function il(e) {
  return e.ownerDocument.defaultView;
}
function td(e) {
  const n = [];
  let o = e?.parentElement;
  const i = ["hidden", "scroll", "clip", "auto"];
  for (; o; ) {
    const {
      overflowX: l,
      overflowY: c,
      overflow: f
    } = il(o).getComputedStyle(o);
    [l, c, f].some((p) => i.includes(p)) && n.push(o), o = o.parentElement;
  }
  return n;
}
function Ks(e, n = 1) {
  return Number.isNaN(e) ? n : e;
}
function xs(e) {
  return Ks(parseFloat(e), 0);
}
function Rg(e, n) {
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
    } = il(i).getComputedStyle(i), v = i.getBoundingClientRect(), {
      offsetHeight: y,
      clientHeight: w,
      offsetWidth: x,
      clientWidth: E
    } = i, C = xs(f), b = xs(p), $ = xs(g), _ = xs(m), R = Ks(Math.round(v.width / x * 1e3) / 1e3), N = Ks(Math.round(v.height / y * 1e3) / 1e3), T = (x - E - $ - _) * R, L = (y - w - C - b) * N, F = C * N, A = b * N, H = $ * R, Y = _ * R;
    let V = 0, X = 0;
    if (l === "clip") {
      const he = xs(c);
      V = he * R, X = he * N;
    }
    const Q = v.x + H - V, oe = v.y + F - X, G = Q + v.width + 2 * V - H - Y - T, le = oe + v.height + 2 * X - F - A - L;
    o.left = Math.max(o.left, Q), o.top = Math.max(o.top, oe), o.right = Math.min(o.right, G), o.bottom = Math.min(o.bottom, le);
  }), o;
}
function _g(e, n = 0) {
  const o = `${n}`, i = o.match(/^(.*)\%$/);
  return i ? e * (parseFloat(i[1]) / 100) : parseFloat(o);
}
function Ng(e, n) {
  const [o, i] = n || [];
  return [_g(e.width, o), _g(e.height, i)];
}
function kg(e = "") {
  return [e[0], e[1]];
}
function wi(e, n) {
  const o = n[0], i = n[1];
  let l, c;
  return o === "t" ? c = e.y : o === "b" ? c = e.y + e.height : c = e.y + e.height / 2, i === "l" ? l = e.x : i === "r" ? l = e.x + e.width : l = e.x + e.width / 2, {
    x: l,
    y: c
  };
}
function fo(e, n) {
  const o = {
    t: "b",
    b: "t",
    l: "r",
    r: "l"
  }, i = [...e];
  return i[n] = o[e[n]] || "c", i;
}
function Mg(e) {
  return e.join("");
}
function Uy(e, n, o, i, l, c, f, p) {
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
  }), v = h.useRef(0), y = h.useMemo(() => !n || p ? [] : td(n), [n]), w = h.useRef({});
  e || (w.current = {});
  const E = wt(() => {
    if (n && o && e && !p) {
      let Ge = function(Re, et, Bt = Xe) {
        const vo = G.x + Re, Rr = G.y + et, _r = vo + se, Nr = Rr + te, gr = Math.max(vo, Bt.left), So = Math.max(Rr, Bt.top), Di = Math.min(_r, Bt.right), ji = Math.min(Nr, Bt.bottom);
        return Math.max(0, (Di - gr) * (ji - So));
      }, Ln = function() {
        Tt = G.y + Oe, An = Tt + te, ln = G.x + Le, hr = ln + se;
      };
      const $ = n, _ = $.ownerDocument, R = il($), {
        position: N
      } = R.getComputedStyle($), T = $.style.left, L = $.style.top, F = $.style.right, A = $.style.bottom, H = $.style.overflow, Y = $.style.overflowX, V = $.style.overflowY, X = {
        ...l[i],
        ...c
      }, Q = _.createElement("div");
      $.parentElement?.appendChild(Q), Q.style.left = `${$.offsetLeft}px`, Q.style.top = `${$.offsetTop}px`, Q.style.position = N, Q.style.height = `${$.offsetHeight}px`, Q.style.width = `${$.offsetWidth}px`, $.style.left = "0", $.style.top = "0", $.style.right = "auto", $.style.bottom = "auto", $.style.overflow = "hidden";
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
      } = R.getComputedStyle($);
      G.x = G.x ?? G.left, G.y = G.y ?? G.top;
      const {
        clientWidth: j,
        clientHeight: J,
        scrollWidth: U,
        scrollHeight: k,
        scrollTop: O,
        scrollLeft: ee
      } = _.documentElement, te = G.height, se = G.width, re = oe.height, fe = oe.width, ie = {
        left: 0,
        top: 0,
        right: j,
        bottom: J
      }, Z = {
        left: -ee,
        top: -O,
        right: U - ee,
        bottom: k - O
      };
      let {
        htmlRegion: ae
      } = X;
      const ce = "visible", ke = "visibleFirst";
      ae !== "scroll" && ae !== ke && (ae = ce);
      const qe = ae === ke, Qe = Rg(Z, y), _e = Rg(ie, y), Xe = ae === ce ? _e : Qe, ut = qe ? _e : Xe;
      $.style.left = "auto", $.style.top = "auto", $.style.right = "0", $.style.bottom = "0";
      const Ae = $.getBoundingClientRect();
      $.style.left = T, $.style.top = L, $.style.right = F, $.style.bottom = A, $.style.overflow = H, $.style.overflowX = Y, $.style.overflowY = V, $.parentElement?.removeChild(Q);
      const Ct = Ks(Math.round(se / parseFloat(he) * 1e3) / 1e3), Ze = Ks(Math.round(te / parseFloat(le) * 1e3) / 1e3);
      if (Ct === 0 || Ze === 0 || Ni(o) && !FS(o))
        return;
      const {
        offset: tt,
        targetOffset: He
      } = X;
      let [Je, ft] = Ng(G, tt);
      const [fn, _t] = Ng(oe, He);
      oe.x -= fn, oe.y -= _t;
      const [Wt, Ut] = X.points || [], Nt = kg(Ut), mt = kg(Wt), kt = wi(oe, Nt), Ue = wi(G, mt), Yt = {
        ...X
      };
      let Ve = [mt, Nt], Le = kt.x - Ue.x + Je, Oe = kt.y - Ue.y + ft;
      const gt = Ge(Le, Oe), qt = Ge(Le, Oe, _e), nt = wi(oe, ["t", "l"]), Kt = wi(G, ["t", "l"]), Mt = wi(oe, ["b", "r"]), En = wi(G, ["b", "r"]), $n = X.overflow || {}, {
        adjustX: de,
        adjustY: Ee,
        shiftX: Ce,
        shiftY: bt
      } = $n, Qt = (Re) => typeof Re == "boolean" ? Re : Re >= 0;
      let Tt, An, ln, hr;
      Ln();
      const tr = Qt(Ee), Pn = mt[0] === Nt[0];
      if (tr && mt[0] === "t" && (An > ut.bottom || w.current.bt)) {
        let Re = Oe;
        Pn ? Re -= te - re : Re = nt.y - En.y - ft;
        const et = Ge(Le, Re), Bt = Ge(Le, Re, _e);
        // Of course use larger one
        et > gt || et === gt && (!qe || // Choose recommend one
        Bt >= qt) ? (w.current.bt = !0, Oe = Re, ft = -ft, Ve = [fo(Ve[0], 0), fo(Ve[1], 0)]) : w.current.bt = !1;
      }
      if (tr && mt[0] === "b" && (Tt < ut.top || w.current.tb)) {
        let Re = Oe;
        Pn ? Re += te - re : Re = Mt.y - Kt.y - ft;
        const et = Ge(Le, Re), Bt = Ge(Le, Re, _e);
        // Of course use larger one
        et > gt || et === gt && (!qe || // Choose recommend one
        Bt >= qt) ? (w.current.tb = !0, Oe = Re, ft = -ft, Ve = [fo(Ve[0], 0), fo(Ve[1], 0)]) : w.current.tb = !1;
      }
      const nr = Qt(de), dn = mt[1] === Nt[1];
      if (nr && mt[1] === "l" && (hr > ut.right || w.current.rl)) {
        let Re = Le;
        dn ? Re -= se - fe : Re = nt.x - En.x - Je;
        const et = Ge(Re, Oe), Bt = Ge(Re, Oe, _e);
        // Of course use larger one
        et > gt || et === gt && (!qe || // Choose recommend one
        Bt >= qt) ? (w.current.rl = !0, Le = Re, Je = -Je, Ve = [fo(Ve[0], 1), fo(Ve[1], 1)]) : w.current.rl = !1;
      }
      if (nr && mt[1] === "r" && (ln < ut.left || w.current.lr)) {
        let Re = Le;
        dn ? Re += se - fe : Re = Mt.x - Kt.x - Je;
        const et = Ge(Re, Oe), Bt = Ge(Re, Oe, _e);
        // Of course use larger one
        et > gt || et === gt && (!qe || // Choose recommend one
        Bt >= qt) ? (w.current.lr = !0, Le = Re, Je = -Je, Ve = [fo(Ve[0], 1), fo(Ve[1], 1)]) : w.current.lr = !1;
      }
      Yt.points = [Mg(Ve[0]), Mg(Ve[1])], Ln();
      const Zt = Ce === !0 ? 0 : Ce;
      typeof Zt == "number" && (ln < _e.left && (Le -= ln - _e.left - Je, oe.x + fe < _e.left + Zt && (Le += oe.x - _e.left + fe - Zt)), hr > _e.right && (Le -= hr - _e.right - Je, oe.x > _e.right - Zt && (Le += oe.x - _e.right + Zt)));
      const It = bt === !0 ? 0 : bt;
      typeof It == "number" && (Tt < _e.top && (Oe -= Tt - _e.top - ft, oe.y + re < _e.top + It && (Oe += oe.y - _e.top + re - It)), An > _e.bottom && (Oe -= An - _e.bottom - ft, oe.y > _e.bottom - It && (Oe += oe.y - _e.bottom + It)));
      const yt = G.x + Le, pn = yt + se, zt = G.y + Oe, hn = zt + te, Wr = oe.x, rt = Wr + fe, mr = oe.y, Ur = mr + re, dt = Math.max(yt, Wr), Jt = Math.min(pn, rt), zn = (dt + Jt) / 2 - yt, Bn = Math.max(zt, mr), $r = Math.min(hn, Ur), Pr = (Bn + $r) / 2 - zt;
      f?.(n, Yt);
      let Dn = Ae.right - G.x - (Le + G.width), mn = Ae.bottom - G.y - (Oe + G.height);
      Ct === 1 && (Le = Math.floor(Le), Dn = Math.floor(Dn)), Ze === 1 && (Oe = Math.floor(Oe), mn = Math.floor(mn));
      const at = {
        ready: !0,
        offsetX: Le / Ct,
        offsetY: Oe / Ze,
        offsetR: Dn / Ct,
        offsetB: mn / Ze,
        arrowX: zn / Ct,
        arrowY: Pr / Ze,
        scaleX: Ct,
        scaleY: Ze,
        align: Yt
      };
      m(at);
    }
  }), C = () => {
    v.current += 1;
    const $ = v.current;
    Promise.resolve().then(() => {
      v.current === $ && E();
    });
  }, b = () => {
    m(($) => ({
      ...$,
      ready: !1
    }));
  };
  return un(b, [i]), un(() => {
    e || b();
  }, [e]), [g.ready, g.offsetX, g.offsetY, g.offsetR, g.offsetB, g.arrowX, g.arrowY, g.scaleX, g.scaleY, g.align, C];
}
function qy() {
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
function pb(e, n, o, i, l) {
  un(() => {
    if (e && n && o) {
      let y = function() {
        i(), l();
      };
      const c = n, f = o, p = td(c), g = td(f), m = il(f), v = /* @__PURE__ */ new Set([m, ...p, ...g]);
      return v.forEach((w) => {
        w.addEventListener("scroll", y, {
          passive: !0
        });
      }), m.addEventListener("resize", y, {
        passive: !0
      }), i(), () => {
        v.forEach((w) => {
          w.removeEventListener("scroll", y), m.removeEventListener("resize", y);
        });
      };
    }
  }, [e, n, o]);
}
function hb(e, n, o, i, l, c, f, p) {
  const g = h.useRef(e);
  g.current = e;
  const m = h.useRef(!1);
  h.useEffect(() => {
    if (n && i && (!l || c)) {
      const y = () => {
        m.current = !1;
      }, w = (C) => {
        g.current && !f(C.composedPath?.()?.[0] || C.target) && !m.current && p(!1);
      }, x = il(i);
      x.addEventListener("pointerdown", y, !0), x.addEventListener("mousedown", w, !0), x.addEventListener("contextmenu", w, !0);
      const E = Sf(o);
      return E && (E.addEventListener("mousedown", w, !0), E.addEventListener("contextmenu", w, !0)), () => {
        x.removeEventListener("pointerdown", y, !0), x.removeEventListener("mousedown", w, !0), x.removeEventListener("contextmenu", w, !0), E && (E.removeEventListener("mousedown", w, !0), E.removeEventListener("contextmenu", w, !0));
      };
    }
  }, [n, o, i, l, c]);
  function v() {
    m.current = !0;
  }
  return v;
}
function mb() {
  const [e, n] = Se.useState(null), [o, i] = Se.useState(!1), [l, c] = Se.useState(!1), f = Se.useRef(null), p = wt((m) => {
    m === !1 ? (f.current = null, i(!1)) : l && o ? f.current = m : (i(!0), n(m), f.current = null, o || c(!0));
  }), g = wt((m) => {
    m ? (c(!1), f.current && (n(f.current), f.current = null)) : (c(!1), f.current = null);
  });
  return [p, o, e, g];
}
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
const gb = (e) => {
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
    arrowPos: v,
    popupSize: y,
    motion: w,
    uniqueContainerClassName: x,
    uniqueContainerStyle: E
  } = e, C = `${n}-unique-container`, [b, $] = Se.useState(!1), _ = jy(o, i, l, c, f, p, g, m), R = Se.useRef(_);
  i && (R.current = _);
  const N = {};
  return y && (N.width = y.width, N.height = y.height), /* @__PURE__ */ Se.createElement(rl, nd({
    motionAppear: !0,
    motionEnter: !0,
    motionLeave: !0,
    removeOnLeave: !1,
    leavedClassName: `${C}-hidden`
  }, w, {
    visible: l,
    onVisibleChanged: (T) => {
      $(T);
    }
  }), ({
    className: T,
    style: L
  }) => {
    const F = we(C, T, x, {
      [`${C}-visible`]: b
    });
    return /* @__PURE__ */ Se.createElement("div", {
      className: F,
      style: {
        "--arrow-x": `${v?.x || 0}px`,
        "--arrow-y": `${v?.y || 0}px`,
        ...R.current,
        ...N,
        ...L,
        ...E
      }
    });
  });
}, yb = ({
  children: e,
  postTriggerProps: n
}) => {
  const [o, i, l, c] = mb(), f = h.useMemo(() => !l || !n ? l : n(l), [l, n]), [p, g] = h.useState(null), [m, v] = h.useState(null), y = h.useRef(null), w = wt((j) => {
    y.current = j, Ni(j) && p !== j && g(j);
  }), x = h.useRef(null), E = qy(), C = wt((j, J) => {
    x.current = J, E(() => {
      o(j);
    }, j.delay);
  }), b = (j) => {
    E(() => {
      x.current?.() || o(!1);
    }, j);
  }, $ = wt((j) => {
    c(j);
  }), [
    _,
    R,
    N,
    T,
    L,
    F,
    A,
    // scaleX - not used in UniqueProvider
    ,
    ,
    // scaleY - not used in UniqueProvider
    H,
    Y
  ] = Uy(
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
    const j = Wy(
      f.builtinPlacements || {},
      f.prefixCls || "",
      H,
      !1
      // alignPoint is false for UniqueProvider
    );
    return we(j, f.getPopupClassNameFromAlign?.(H));
  }, [H, f?.getPopupClassNameFromAlign, f?.builtinPlacements, f?.prefixCls]), X = h.useMemo(() => ({
    show: C,
    hide: b
  }), []);
  h.useEffect(() => {
    Y();
  }, [f?.target]);
  const Q = wt(() => (Y(), Promise.resolve())), oe = h.useRef({}), G = h.useContext(Ha), le = h.useMemo(() => ({
    registerSubPopup: (j, J) => {
      oe.current[j] = J, G?.registerSubPopup(j, J);
    }
  }), [G]), he = f?.prefixCls;
  return /* @__PURE__ */ h.createElement(Vy.Provider, {
    value: X
  }, e, f && /* @__PURE__ */ h.createElement(Ha.Provider, {
    value: le
  }, /* @__PURE__ */ h.createElement(Hy, {
    ref: w,
    portal: Wd,
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
    ready: _,
    offsetX: R,
    offsetY: N,
    offsetR: T,
    offsetB: L,
    onAlign: Y,
    onPrepare: Q,
    onResize: (j) => v({
      width: j.offsetWidth,
      height: j.offsetHeight
    }),
    arrowPos: {
      x: F,
      y: A
    },
    align: H,
    zIndex: f.zIndex,
    mask: f.mask,
    arrow: f.arrow,
    motion: f.popupMotion,
    maskMotion: f.maskMotion,
    getPopupContainer: f.getPopupContainer
  }, /* @__PURE__ */ h.createElement(gb, {
    prefixCls: he,
    isMobile: !1,
    ready: _,
    open: i,
    align: H,
    offsetR: T,
    offsetB: L,
    offsetX: R,
    offsetY: N,
    arrowPos: {
      x: F,
      y: A
    },
    popupSize: m,
    motion: f.popupMotion,
    uniqueContainerClassName: we(f.uniqueContainerClassName, V),
    uniqueContainerStyle: f.uniqueContainerStyle
  }))));
};
function vb(e = Wd) {
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
      popupVisible: v,
      defaultPopupVisible: y,
      onOpenChange: w,
      afterOpenChange: x,
      onPopupVisibleChange: E,
      afterPopupVisibleChange: C,
      // Delay
      mouseEnterDelay: b,
      mouseLeaveDelay: $ = 0.1,
      focusDelay: _,
      blurDelay: R,
      // Mask
      mask: N,
      maskClosable: T = !0,
      // Portal
      getPopupContainer: L,
      forceRender: F,
      autoDestroy: A,
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
      alignPoint: O,
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
    } = o, ae = A || !1, ce = v === void 0, ke = !!ie, qe = h.useRef({}), Qe = h.useContext(Ha), _e = h.useMemo(() => ({
      registerSubPopup: (ue, Fe) => {
        qe.current[ue] = Fe, Qe?.registerSubPopup(ue, Fe);
      }
    }), [Qe]), Xe = h.useContext(Vy), ut = Zs(), [Ae, Ct] = h.useState(null), Ze = h.useRef(null), tt = wt((ue) => {
      Ze.current = ue, Ni(ue) && Ae !== ue && Ct(ue), Qe?.registerSubPopup(ut, ue);
    }), [He, Je] = h.useState(null), ft = h.useRef(null), fn = wt((ue) => {
      const Fe = Md(ue);
      Ni(Fe) && He !== Fe && (Je(Fe), ft.current = Fe);
    }), _t = {}, Wt = wt((ue) => {
      const Fe = He;
      return Fe?.contains(ue) || Sf(Fe)?.host === ue || ue === Fe || Ae?.contains(ue) || Sf(Ae)?.host === ue || ue === Ae || Object.values(qe.current).some((yr) => yr?.contains(ue) || ue === yr);
    }), Ut = se ? {
      // true and Object likely
      ...se !== !0 ? se : {}
    } : null, [Nt, mt] = js(y || !1, v), kt = Nt || !1, Ue = kt && !m, Yt = h.useMemo(() => {
      const ue = typeof c == "function" ? c({
        open: Ue
      }) : c;
      return h.Children.only(ue);
    }, [c, Ue]), Ve = Yt?.props || {}, Le = wt(() => Ue), Oe = wt((ue = 0) => ({
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
      mask: N,
      maskClosable: T,
      popupMotion: re,
      maskMotion: fe,
      arrow: Ut,
      getPopupContainer: L,
      getPopupClassNameFromAlign: J,
      id: ut,
      onEsc: Kt
    }));
    un(() => {
      Xe && k && He && !ce && !Qe && (Ue ? Xe.show(Oe(b), Le) : Xe.hide($));
    }, [Ue, He]);
    const Ge = h.useRef(Ue);
    Ge.current = Ue;
    const gt = wt((ue) => {
      Ja.flushSync(() => {
        kt !== ue && (mt(ue), w?.(ue), E?.(ue));
      });
    }), qt = qy(), nt = (ue, Fe = 0) => {
      if (v !== void 0) {
        qt(() => {
          gt(ue);
        }, Fe);
        return;
      }
      if (Xe && k && ce && !Qe) {
        ue ? Xe.show(Oe(Fe), Le) : Xe.hide(Fe);
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
    const [Mt, En] = h.useState(!1);
    un((ue) => {
      (!ue || Ue) && En(!0);
    }, [Ue]);
    const [$n, de] = h.useState(null), [Ee, Ce] = h.useState(null), bt = (ue) => {
      Ce([ue.clientX, ue.clientY]);
    }, [Qt, Tt, An, ln, hr, Ln, tr, Pn, nr, dn, Zt] = Uy(Ue, Ae, O && Ee !== null ? Ee : He, oe, G, le, te, ke), [It, yt] = fb(f, p, g), pn = It.has("click"), zt = yt.has("click") || yt.has("contextMenu"), hn = wt(() => {
      Mt || Zt();
    });
    pb(Ue, He, Ae, hn, () => {
      Ge.current && O && zt && nt(!1);
    }), un(() => {
      hn();
    }, [Ee, oe]), un(() => {
      Ue && !G?.[oe] && hn();
    }, [JSON.stringify(le)]);
    const rt = h.useMemo(() => {
      const ue = Wy(G, l, dn, O);
      return we(ue, J?.(dn));
    }, [dn, J, G, l, O]);
    h.useImperativeHandle(i, () => ({
      nativeElement: ft.current,
      popupElement: Ze.current,
      forceAlign: hn
    }));
    const [mr, Ur] = h.useState(0), [dt, Jt] = h.useState(0), Be = () => {
      if (j && He) {
        const ue = He.getBoundingClientRect();
        Ur(ue.width), Jt(ue.height);
      }
    }, zn = () => {
      Be(), hn();
    }, Bn = (ue) => {
      En(!1), Zt(), x?.(ue), C?.(ue);
    }, $r = () => new Promise((ue) => {
      Be(), de(() => ue);
    });
    un(() => {
      $n && (Zt(), $n(), de(null));
    }, [$n]);
    function en(ue, Fe, yr, cc, Go) {
      _t[ue] = (De, ...ll) => {
        (!Go || !Go()) && (cc?.(De), nt(Fe, yr)), Ve[ue]?.(De, ...ll);
      };
    }
    const Pr = It.has("touch"), Dn = yt.has("touch"), mn = h.useRef(!1);
    (Pr || Dn) && (_t.onTouchStart = (...ue) => {
      mn.current = !0, Ge.current && Dn ? nt(!1) : !Ge.current && Pr && nt(!0), Ve.onTouchStart?.(...ue);
    }), (pn || zt) && (_t.onClick = (ue, ...Fe) => {
      Ge.current && zt ? nt(!1) : !Ge.current && pn && (bt(ue), nt(!0)), Ve.onClick?.(ue, ...Fe), mn.current = !1;
    });
    const at = hb(Ue, zt || Dn, He, Ae, N, T, Wt, nt), Re = It.has("hover"), et = yt.has("hover");
    let Bt, vo;
    const Rr = () => mn.current;
    if (Re) {
      const ue = (Fe) => {
        bt(Fe);
      };
      en("onMouseEnter", !0, b, ue, Rr), en("onPointerEnter", !0, b, ue, Rr), Bt = (Fe) => {
        (Ue || Mt) && Ae?.contains(Fe.target) && nt(!0, b);
      }, O && (_t.onMouseMove = (Fe) => {
        Ve.onMouseMove?.(Fe);
      });
    }
    et && (en("onMouseLeave", !1, $, void 0, Rr), en("onPointerLeave", !1, $, void 0, Rr), vo = () => {
      nt(!1, $);
    }), It.has("focus") && en("onFocus", !0, _), yt.has("focus") && en("onBlur", !1, R), It.has("contextMenu") && (_t.onContextMenu = (ue, ...Fe) => {
      Ge.current && yt.has("contextMenu") ? nt(!1) : (bt(ue), nt(!0)), ue.preventDefault(), Ve.onContextMenu?.(ue, ...Fe);
    });
    const _r = h.useRef(!1);
    _r.current ||= F || Ue || Mt;
    const Nr = {
      ...Ve,
      ..._t
    }, gr = {};
    ["onContextMenu", "onClick", "onMouseDown", "onTouchStart", "onMouseEnter", "onMouseLeave", "onFocus", "onBlur"].forEach((ue) => {
      Z[ue] && (gr[ue] = (...Fe) => {
        Nr[ue]?.(...Fe), Z[ue](...Fe);
      });
    });
    const Di = {
      x: Ln,
      y: tr
    };
    V0(Ue, He, zn);
    const ji = Rd(fn, Qa(Yt)), Hi = /* @__PURE__ */ h.cloneElement(Yt, {
      ...Nr,
      ...gr,
      ref: ji
    });
    return /* @__PURE__ */ h.createElement(h.Fragment, null, Hi, _r.current && (!Xe || !k) && /* @__PURE__ */ h.createElement(Ha.Provider, {
      value: _e
    }, /* @__PURE__ */ h.createElement(Hy, {
      portal: e,
      ref: tt,
      prefixCls: l,
      popup: H,
      className: we(Y, !ke && rt),
      style: Q,
      target: He,
      onMouseEnter: Bt,
      onMouseLeave: vo,
      onPointerEnter: Bt,
      zIndex: he,
      open: Ue,
      keepDom: Mt,
      fresh: U,
      onClick: ee,
      onPointerDownCapture: at,
      mask: N,
      motion: re,
      maskMotion: fe,
      onVisibleChanged: Bn,
      onPrepare: $r,
      forceRender: F,
      autoDestroy: ae,
      getPopupContainer: L,
      onEsc: Kt,
      align: dn,
      arrow: Ut,
      arrowPos: Di,
      ready: Qt,
      offsetX: Tt,
      offsetY: An,
      offsetR: ln,
      offsetB: hr,
      onAlign: hn,
      stretch: j,
      targetWidth: mr / Pn,
      targetHeight: dt / nr,
      mobile: ie
    })));
  });
}
const Sb = vb(Wd);
function wb(e) {
  return e && /* @__PURE__ */ Se.isValidElement(e) && e.type === Se.Fragment;
}
const Cb = (e, n, o) => /* @__PURE__ */ Se.isValidElement(e) ? /* @__PURE__ */ Se.cloneElement(e, Bi(o) ? o(e.props || {}) : o) : n;
function Xy(e, n) {
  return Cb(e, e, n);
}
const xb = ({
  children: e
}) => {
  const {
    getPrefixCls: n
  } = Se.useContext(On), o = n();
  return /* @__PURE__ */ Se.isValidElement(e) ? /* @__PURE__ */ Se.createElement(rl, {
    visible: !0,
    motionName: `${o}-fade`,
    motionAppear: !0,
    motionEnter: !0,
    motionLeave: !1,
    removeOnLeave: !1
  }, ({
    style: i,
    className: l
  }) => Xy(e, (c) => ({
    className: we(c.className, l),
    style: {
      ...c.style,
      ...i
    }
  }))) : e;
}, Sa = [null, null];
function bb(e) {
  if (Sa[0] !== e) {
    const n = {};
    Object.keys(e).forEach((o) => {
      n[o] = {
        ...e[o],
        dynamicInset: !1
      };
    }), Sa[0] = e, Sa[1] = n;
  }
  return Sa[1];
}
const Gy = ({
  children: e
}) => {
  const n = (o) => {
    const {
      id: i,
      builtinPlacements: l,
      popup: c
    } = o, f = Bi(c) ? c() : c, p = bb(l);
    return {
      ...o,
      getPopupContainer: null,
      arrow: !1,
      popup: /* @__PURE__ */ Se.createElement(xb, {
        key: i
      }, f),
      builtinPlacements: p
    };
  };
  return /* @__PURE__ */ Se.createElement(yb, {
    postTriggerProps: n
  }, e);
}, Qs = /* @__PURE__ */ h.createContext(!1), Eb = ({
  children: e,
  disabled: n
}) => {
  const o = h.useContext(Qs);
  return /* @__PURE__ */ h.createElement(Qs.Provider, {
    value: n ?? o
  }, e);
}, Ti = /* @__PURE__ */ h.createContext(void 0), $b = ({
  children: e,
  size: n
}) => {
  const o = h.useContext(Ti);
  return /* @__PURE__ */ h.createElement(Ti.Provider, {
    value: n || o
  }, e);
};
function Pb() {
  const e = h.useContext(Qs), n = h.useContext(Ti);
  return {
    componentDisabled: e,
    componentSize: n
  };
}
function Rb(e, n, o) {
  const i = e || {}, l = i.inherit === !1 || !n ? {
    ...ja,
    hashed: n?.hashed ?? ja.hashed,
    cssVar: n?.cssVar
  } : n, c = h.useId();
  return Pd(() => {
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
    const v = p[m];
    return !Cf(g, v, !0);
  }));
}
const Tg = /* @__PURE__ */ h.createContext(!0);
function _b(e) {
  const n = h.useContext(Tg), {
    children: o
  } = e, [, i] = tl(), {
    motion: l
  } = i, c = h.useRef(!1);
  return c.current || (c.current = n !== l), c.current ? /* @__PURE__ */ h.createElement(Tg.Provider, {
    value: l
  }, /* @__PURE__ */ h.createElement(Nx, {
    motion: l
  }, o)) : o;
}
const Nb = () => null, kb = ({
  iconPrefixCls: e,
  csp: n
}) => (ex(e, n), null), Mb = ["getTargetContainer", "getPopupContainer", "renderEmpty", "input", "pagination", "form", "select", "button"], Tb = (e) => {
  const {
    prefixCls: n,
    iconPrefixCls: o,
    theme: i,
    holderRender: l
  } = e;
}, Ib = (e) => {
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
    componentSize: v,
    direction: y,
    space: w,
    splitter: x,
    virtual: E,
    dropdownMatchSelectWidth: C,
    popupMatchSelectWidth: b,
    popupOverflow: $,
    legacyLocale: _,
    parentContext: R,
    iconPrefixCls: N,
    theme: T,
    componentDisabled: L,
    segmented: F,
    statistic: A,
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
    layout: O,
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
    inputSearch: _e,
    textArea: Xe,
    otp: ut,
    empty: Ae,
    badge: Ct,
    borderBeam: Ze,
    radio: tt,
    rate: He,
    ribbon: Je,
    switch: ft,
    transfer: fn,
    avatar: _t,
    message: Wt,
    tag: Ut,
    table: Nt,
    card: mt,
    cardMeta: kt,
    tabs: Ue,
    timeline: Yt,
    timePicker: Ve,
    upload: Le,
    notification: Oe,
    tree: Ge,
    colorPicker: gt,
    datePicker: qt,
    rangePicker: nt,
    flex: Kt,
    wave: Mt,
    dropdown: En,
    warning: $n,
    tour: de,
    tooltip: Ee,
    popover: Ce,
    popconfirm: bt,
    qrcode: Qt,
    floatButton: Tt,
    floatButtonGroup: An,
    variant: ln,
    inputNumber: hr,
    treeSelect: Ln,
    watermark: tr
  } = e, Pn = h.useMemo(() => Vr(m) && Object.prototype.hasOwnProperty.call(m, "default") && m.default?.locale ? m.default : m, [m]), nr = h.useCallback((dt, Jt) => {
    const {
      prefixCls: Be
    } = e;
    if (Jt)
      return Jt;
    const zn = Be || R.getPrefixCls("");
    return dt ? `${zn}-${dt}` : zn;
  }, [R.getPrefixCls, e.prefixCls]), dn = N || R.iconPrefixCls || Td, Zt = o || R.csp, It = Rb(T, R.theme, {
    prefixCls: nr("")
  }), yt = {
    csp: Zt,
    autoInsertSpaceInButton: i,
    alert: l,
    affix: c,
    anchor: f,
    app: p,
    locale: Pn || _,
    direction: y,
    space: w,
    splitter: x,
    virtual: E,
    popupMatchSelectWidth: b ?? C,
    popupOverflow: $,
    getPrefixCls: nr,
    iconPrefixCls: dn,
    theme: It,
    segmented: F,
    statistic: A,
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
    inputSearch: _e,
    textArea: Xe,
    otp: ut,
    layout: O,
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
    empty: Ae,
    badge: Ct,
    borderBeam: Ze,
    radio: tt,
    rate: He,
    ribbon: Je,
    switch: ft,
    transfer: fn,
    avatar: _t,
    message: Wt,
    tag: Ut,
    table: Nt,
    card: mt,
    cardMeta: kt,
    tabs: Ue,
    timeline: Yt,
    timePicker: Ve,
    upload: Le,
    notification: Oe,
    tree: Ge,
    colorPicker: gt,
    datePicker: qt,
    rangePicker: nt,
    flex: Kt,
    wave: Mt,
    dropdown: En,
    warning: $n,
    tour: de,
    tooltip: Ee,
    popover: Ce,
    popconfirm: bt,
    qrcode: Qt,
    floatButton: Tt,
    floatButtonGroup: An,
    variant: ln,
    inputNumber: hr,
    treeSelect: Ln,
    watermark: tr
  }, pn = {
    ...R
  };
  Object.keys(yt).forEach((dt) => {
    yt[dt] !== void 0 && (pn[dt] = yt[dt]);
  }), Mb.forEach((dt) => {
    const Jt = e[dt];
    Jt && (pn[dt] = Jt);
  }), typeof i < "u" && (pn.button = {
    autoInsertSpace: i,
    ...pn.button
  });
  const zt = Pd(() => pn, pn, (dt, Jt) => {
    const Be = Object.keys(dt), zn = Object.keys(Jt);
    return Be.length !== zn.length || Be.some((Bn) => dt[Bn] !== Jt[Bn]);
  }), {
    layer: hn
  } = h.useContext(el), Wr = h.useMemo(() => ({
    prefixCls: dn,
    csp: Zt,
    layer: hn ? "antd" : void 0,
    zeroRuntime: !!hn || It?.zeroRuntime
  }), [dn, Zt, hn, It?.zeroRuntime]);
  let rt = /* @__PURE__ */ h.createElement(h.Fragment, null, /* @__PURE__ */ h.createElement(kb, {
    iconPrefixCls: dn,
    csp: Zt
  }), /* @__PURE__ */ h.createElement(Nb, {
    dropdownMatchSelectWidth: C
  }), n);
  const mr = h.useMemo(() => $i(rc.Form?.defaultValidateMessages || {}, zt.locale?.Form?.defaultValidateMessages || {}, zt.form?.validateMessages || {}, g?.validateMessages || {}), [zt, g?.validateMessages]);
  Object.keys(mr).length > 0 && (rt = /* @__PURE__ */ h.createElement(Gx.Provider, {
    value: mr
  }, rt)), Pn && (rt = /* @__PURE__ */ h.createElement(Qx, {
    locale: Pn,
    _ANT_MARK__: Kx
  }, rt)), rt = /* @__PURE__ */ h.createElement(Bd.Provider, {
    value: Wr
  }, rt), v && (rt = /* @__PURE__ */ h.createElement($b, {
    size: v
  }, rt)), rt = /* @__PURE__ */ h.createElement(_b, null, rt), Ee?.unique && (rt = /* @__PURE__ */ h.createElement(Gy, null, rt));
  const Ur = h.useMemo(() => {
    const {
      algorithm: dt,
      token: Jt,
      components: Be,
      cssVar: zn,
      ...Bn
    } = It || {}, $r = dt && (!Array.isArray(dt) || dt.length > 0) ? Pf(dt) : my, en = {};
    Object.entries(Be || {}).forEach(([Dn, mn]) => {
      const at = {
        ...mn
      };
      "algorithm" in at && (at.algorithm === !0 ? at.theme = $r : (Array.isArray(at.algorithm) || Bi(at.algorithm)) && (at.theme = Pf(at.algorithm)), delete at.algorithm), en[Dn] = at;
    });
    const Pr = {
      ...Ys,
      ...Jt
    };
    return {
      ...Bn,
      theme: $r,
      token: Pr,
      components: en,
      override: {
        override: Pr,
        ...en
      },
      cssVar: zn
    };
  }, [It]);
  return T && (rt = /* @__PURE__ */ h.createElement(gy.Provider, {
    value: Ur
  }, rt)), zt.warning && (rt = /* @__PURE__ */ h.createElement(iw.Provider, {
    value: zt.warning
  }, rt)), L !== void 0 && (rt = /* @__PURE__ */ h.createElement(Eb, {
    disabled: L
  }, rt)), /* @__PURE__ */ h.createElement(On.Provider, {
    value: zt
  }, rt);
}, yo = (e) => {
  const n = h.useContext(On), o = h.useContext(Ay);
  return /* @__PURE__ */ h.createElement(Ib, {
    parentContext: n,
    legacyLocale: o,
    ...e
  });
};
yo.ConfigContext = On;
yo.SizeContext = Ti;
yo.config = Tb;
yo.useConfig = Pb;
Object.defineProperty(yo, "SizeContext", {
  get: () => Ti
});
const Ig = (e) => e === "horizontal" || e === "vertical", Yy = (e, n, o) => h.useMemo(() => {
  const i = Ig(e);
  let l;
  return i ? l = e : typeof n == "boolean" ? l = n ? "vertical" : "horizontal" : l = Ig(o) ? o : "horizontal", [l, l === "vertical"];
}, [o, e, n]), Ky = /* @__PURE__ */ Se.createContext(void 0), To = 100, Qy = {
  Modal: To,
  Drawer: To,
  Popover: To,
  Popconfirm: To,
  Tooltip: To,
  Tour: To,
  FloatButton: To
}, Fb = {
  SelectLike: 50,
  Dropdown: 50,
  DatePicker: 50,
  Menu: 50,
  ImagePreview: 1
}, Ob = (e) => e in Qy, Ab = (e, n) => {
  const [, o] = tl(), i = Se.useContext(Ky), l = Ob(e);
  let c;
  if (n !== void 0)
    c = [n, n];
  else {
    let f = i ?? 0;
    l ? f += // Use preset token zIndex by default but not stack when has parent container
    (i ? 0 : o.zIndexPopupBase) + // Container offset
    Qy[e] : f += Fb[e], c = [i === void 0 ? n : f, f];
  }
  return c;
}, Lb = (e, n, o) => o !== void 0 ? o : `${e}-${n}`, oc = (e) => {
  const n = Se.useContext(Ti);
  return Se.useMemo(() => e ? Wx(e) ? e ?? n : Bi(e) ? e(n) : n : n, [e, n]);
}, zb = (e) => {
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
}, Bb = Hr(["Space", "Compact"], zb, () => ({}), {
  // Space component don't apply extra font style
  // https://github.com/ant-design/ant-design/issues/40315
  resetStyle: !1
}), ic = /* @__PURE__ */ h.createContext(null), Zy = (e, n) => {
  const o = h.useContext(ic), i = h.useMemo(() => {
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
}, Db = (e) => {
  const {
    children: n
  } = e;
  return /* @__PURE__ */ h.createElement(ic.Provider, {
    value: null
  }, n);
}, jb = (e) => {
  const {
    children: n,
    ...o
  } = e;
  return /* @__PURE__ */ h.createElement(ic.Provider, {
    value: h.useMemo(() => o, [o])
  }, n);
}, Hb = (e) => {
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
    children: v,
    vertical: y,
    ...w
  } = e, [x, E] = Yy(c, y, l), C = oc((L) => i ?? L), b = n("space-compact", p), [$] = Bb(b), _ = we(b, $, {
    [`${b}-rtl`]: o === "rtl",
    [`${b}-block`]: f,
    [`${b}-vertical`]: E
  }, g, m), R = h.useContext(ic), N = Vs(v), T = h.useMemo(() => N.map((L, F) => {
    const A = L?.key || `${b}-item-${F}`;
    return /* @__PURE__ */ h.createElement(jb, {
      key: A,
      compactSize: C,
      compactDirection: x,
      isFirstItem: F === 0 && (!R || R?.isFirstItem),
      isLastItem: F === N.length - 1 && (!R || R?.isLastItem)
    }, L);
  }), [N, R, x, C, b]);
  return N.length === 0 ? null : /* @__PURE__ */ h.createElement("div", {
    className: _,
    ...w
  }, T);
}, Fg = (e) => ({
  animationDuration: e,
  animationFillMode: "both"
}), Jy = (e, n, o, i, l = !1) => {
  const c = l ? "&" : "";
  return {
    [`
      ${c}${e}-enter,
      ${c}${e}-appear
    `]: {
      ...Fg(i),
      animationPlayState: "paused"
    },
    [`${c}${e}-leave`]: {
      ...Fg(i),
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
}, Vb = new sn("antFadeIn", {
  "0%": {
    opacity: 0
  },
  "100%": {
    opacity: 1
  }
}), Wb = new sn("antFadeOut", {
  "0%": {
    opacity: 1
  },
  "100%": {
    opacity: 0
  }
}), Ub = (e, n = !1) => {
  const {
    antCls: o
  } = e, i = `${o}-fade`, l = n ? "&" : "";
  return [Jy(i, Vb, Wb, e.motionDurationMid, n), {
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
}, qb = new sn("antZoomIn", {
  "0%": {
    transform: "scale(0.2)",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    opacity: 1
  }
}), Xb = new sn("antZoomOut", {
  "0%": {
    transform: "scale(1)"
  },
  "100%": {
    transform: "scale(0.2)",
    opacity: 0
  }
}), Og = new sn("antZoomBigIn", {
  "0%": {
    transform: "scale(0.8)",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    opacity: 1
  }
}), Ag = new sn("antZoomBigOut", {
  "0%": {
    transform: "scale(1)"
  },
  "100%": {
    transform: "scale(0.8)",
    opacity: 0
  }
}), Gb = new sn("antZoomUpIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 0%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "50% 0%"
  }
}), Yb = new sn("antZoomUpOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "50% 0%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 0%",
    opacity: 0
  }
}), Kb = new sn("antZoomLeftIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "0% 50%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "0% 50%"
  }
}), Qb = new sn("antZoomLeftOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "0% 50%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "0% 50%",
    opacity: 0
  }
}), Zb = new sn("antZoomRightIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "100% 50%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "100% 50%"
  }
}), Jb = new sn("antZoomRightOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "100% 50%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "100% 50%",
    opacity: 0
  }
}), eE = new sn("antZoomDownIn", {
  "0%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 100%",
    opacity: 0
  },
  "100%": {
    transform: "scale(1)",
    transformOrigin: "50% 100%"
  }
}), tE = new sn("antZoomDownOut", {
  "0%": {
    transform: "scale(1)",
    transformOrigin: "50% 100%"
  },
  "100%": {
    transform: "scale(0.8)",
    transformOrigin: "50% 100%",
    opacity: 0
  }
}), nE = {
  zoom: {
    inKeyframes: qb,
    outKeyframes: Xb
  },
  "zoom-big": {
    inKeyframes: Og,
    outKeyframes: Ag
  },
  "zoom-big-fast": {
    inKeyframes: Og,
    outKeyframes: Ag
  },
  "zoom-left": {
    inKeyframes: Kb,
    outKeyframes: Qb
  },
  "zoom-right": {
    inKeyframes: Zb,
    outKeyframes: Jb
  },
  "zoom-up": {
    inKeyframes: Gb,
    outKeyframes: Yb
  },
  "zoom-down": {
    inKeyframes: eE,
    outKeyframes: tE
  }
}, rE = (e, n) => {
  const {
    antCls: o
  } = e, i = `${o}-${n}`, {
    inKeyframes: l,
    outKeyframes: c
  } = nE[n];
  return [Jy(i, l, c, e.motionDurationFast), {
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
}, of = (e) => Math.round(Number(e || 0)), oE = (e) => {
  if (e instanceof Rt)
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
class Va extends Rt {
  constructor(n) {
    super(oE(n));
  }
  toHsbString() {
    const n = this.toHsb(), o = of(n.s * 100), i = of(n.b * 100), l = of(n.h), c = n.a, f = `hsb(${l}, ${o}%, ${i}%)`, p = `hsba(${l}, ${o}%, ${i}%, ${c.toFixed(c === 0 ? 0 : 2)})`;
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
const iE = (e) => e instanceof Va ? e : new Va(e);
iE("#1677ff");
const sE = (e, n) => e?.replace(/[^0-9a-f]/gi, "").slice(0, n ? 8 : 6) || "", lE = (e, n) => e ? sE(e, n) : "";
let Lg = /* @__PURE__ */ (function() {
  function e(n) {
    if (Li(this, e), this.cleared = !1, n instanceof e) {
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
    })), this.metaColor = new Va(this.colors[0].color.metaColor)) : this.metaColor = new Va(o ? "" : n), (!n || o && !this.colors) && (this.metaColor = this.metaColor.setA(0), this.cleared = !0);
  }
  return zi(e, [{
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
      return lE(this.toHexString(), this.metaColor.a < 1);
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
function Wa() {
  return Wa = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o) ({}).hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Wa.apply(null, arguments);
}
const aE = (e) => e instanceof Lg ? e : new Lg(e);
function cE(e, n, o, i) {
  const {
    focusElCls: l,
    focus: c,
    borderElCls: f
  } = o, p = f ? "> *" : "", g = p ? ` ${p}` : "", m = (w) => w.filter(Boolean).map((x) => `&:${x}${g}`).join(","), v = m(["hover", l ? `hover${l}` : null]), y = m([c ? "focus" : null, "active"]);
  return {
    [`&-item:not(${n}-last-item)`]: {
      marginInlineEnd: e.calc(e.lineWidth).mul(-1).equal()
    },
    [`&-item:not(${i}-status-success)`]: {
      zIndex: 2
    },
    "&-item": {
      [y]: {
        zIndex: 3
      },
      [v]: {
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
function uE(e, n, o) {
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
function Ud(e, n = {
  focus: !0
}) {
  const {
    componentCls: o
  } = e, {
    componentCls: i
  } = n, l = i || o, c = `${l}-compact`;
  return {
    [c]: {
      ...cE(e, c, n, l),
      ...uE(l, c, n)
    }
  };
}
const Bo = "RC_FORM_INTERNAL_HOOKS", Ke = () => {
  Fn(!1, "Can not find FormContext. Please make sure you wrap Field under Form.");
}, Ii = /* @__PURE__ */ h.createContext({
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
}), Ua = /* @__PURE__ */ h.createContext(null);
function rd(e) {
  return e == null ? [] : Array.isArray(e) ? e : [e];
}
function fE(e) {
  return e && !!e._init;
}
function od() {
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
const sf = od(), dE = /%[sdj%]/g;
let pE = () => {
};
typeof process < "u" && process.env;
function id(e) {
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
  return typeof e == "function" ? e.apply(null, n) : typeof e == "string" ? e.replace(dE, (c) => {
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
function hE(e) {
  return e === "string" || e === "url" || e === "hex" || e === "email" || e === "date" || e === "pattern" || e === "tel";
}
function Lt(e, n) {
  return !!(e == null || n === "array" && Array.isArray(e) && !e.length || hE(n) && typeof e == "string" && !e);
}
function mE(e, n, o) {
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
function zg(e, n, o) {
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
function gE(e) {
  const n = [];
  return Object.keys(e).forEach((o) => {
    n.push(...e[o] || []);
  }), n;
}
class Bg extends Error {
  errors;
  fields;
  constructor(n, o) {
    super("Async Validation Error"), this.errors = n, this.fields = o;
  }
}
function yE(e, n, o, i, l) {
  if (n.first) {
    const y = new Promise((w, x) => {
      const E = (b) => (i(b), b.length ? x(new Bg(b, id(b))) : w(l)), C = gE(e);
      zg(C, o, E);
    });
    return y.catch((w) => w), y;
  }
  const c = n.firstFields === !0 ? Object.keys(e) : n.firstFields || [], f = Object.keys(e), p = f.length;
  let g = 0;
  const m = [], v = new Promise((y, w) => {
    const x = (E) => {
      if (m.push.apply(m, E), g++, g === p)
        return i(m), m.length ? w(new Bg(m, id(m))) : y(l);
    };
    f.length || (i(m), y(l)), f.forEach((E) => {
      const C = e[E];
      c.indexOf(E) !== -1 ? zg(C, o, x) : mE(C, o, x);
    });
  });
  return v.catch((y) => y), v;
}
function vE(e) {
  return !!(e && e.message !== void 0);
}
function SE(e, n) {
  let o = e;
  for (let i = 0; i < n.length; i++) {
    if (o == null)
      return o;
    o = o[n[i]];
  }
  return o;
}
function Dg(e, n) {
  return (o) => {
    let i;
    return e.fullFields ? i = SE(n, e.fullFields) : i = n[o.field || e.fullField], vE(o) ? (o.field = o.field || e.fullField, o.fieldValue = i, o) : {
      message: typeof o == "function" ? o() : o,
      fieldValue: i,
      field: o.field || e.fullField
    };
  };
}
function jg(e, n) {
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
const Ci = "enum", wE = (e, n, o, i, l) => {
  e[Ci] = Array.isArray(e[Ci]) ? e[Ci] : [], e[Ci].indexOf(n) === -1 && i.push(In(l.messages[Ci], e.fullField, e[Ci].join(", ")));
}, CE = (e, n, o, i, l) => {
  e.pattern && (e.pattern instanceof RegExp ? (e.pattern.lastIndex = 0, e.pattern.test(n) || i.push(In(l.messages.pattern.mismatch, e.fullField, n, e.pattern))) : typeof e.pattern == "string" && (new RegExp(e.pattern).test(n) || i.push(In(l.messages.pattern.mismatch, e.fullField, n, e.pattern))));
}, xE = (e, n, o, i, l) => {
  const c = typeof e.len == "number", f = typeof e.min == "number", p = typeof e.max == "number", g = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
  let m = n, v = null;
  const y = typeof n == "number", w = typeof n == "string", x = Array.isArray(n);
  if (y ? v = "number" : w ? v = "string" : x && (v = "array"), !v)
    return !1;
  x && (m = n.length), w && (m = n.replace(g, "_").length), c ? m !== e.len && i.push(In(l.messages[v].len, e.fullField, e.len)) : f && !p && m < e.min ? i.push(In(l.messages[v].min, e.fullField, e.min)) : p && !f && m > e.max ? i.push(In(l.messages[v].max, e.fullField, e.max)) : f && p && (m < e.min || m > e.max) && i.push(In(l.messages[v].range, e.fullField, e.min, e.max));
}, ev = (e, n, o, i, l, c) => {
  e.required && (!o.hasOwnProperty(e.field) || Lt(n, c || e.type)) && i.push(In(l.messages.required, e.fullField));
};
let wa;
const bE = (() => {
  if (wa)
    return wa;
  const e = "[a-fA-F\\d:]", n = (T) => T && T.includeBoundaries ? `(?:(?<=\\s|^)(?=${e})|(?<=${e})(?=\\s|$))` : "", o = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}", i = "[a-fA-F\\d]{1,4}", f = `(?:${[
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
  ].join("|")})(?:%[0-9a-zA-Z]{1,})?`, p = new RegExp(`(?:^${o}$)|(?:^${f}$)`), g = new RegExp(`^${o}$`), m = new RegExp(`^${f}$`), v = (T) => T && T.exact ? p : new RegExp(`(?:${n(T)}${o}${n(T)})|(?:${n(T)}${f}${n(T)})`, "g");
  v.v4 = (T) => T && T.exact ? g : new RegExp(`${n(T)}${o}${n(T)}`, "g"), v.v6 = (T) => T && T.exact ? m : new RegExp(`${n(T)}${f}${n(T)}`, "g");
  const y = "(?:(?:[a-z]+:)?//)", w = "(?:\\S+(?::\\S*)?@)?", x = v.v4().source, E = v.v6().source, N = `(?:${y}|www\\.)${w}(?:localhost|${x}|${E}|(?:(?:[a-z\\u00a1-\\uffff0-9][-_]*)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))(?::\\d{2,5})?(?:[/?#][^\\s"]*)?`;
  return wa = new RegExp(`(?:^${N}$)`, "i"), wa;
}), lf = {
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
}, Os = {
  integer(e) {
    return Os.number(e) && parseInt(e, 10) === e;
  },
  float(e) {
    return Os.number(e) && !Os.integer(e);
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
    return typeof e == "object" && !Os.array(e);
  },
  method(e) {
    return typeof e == "function";
  },
  email(e) {
    return typeof e == "string" && e.length <= 320 && !!e.match(lf.email);
  },
  tel(e) {
    return typeof e == "string" && e.length <= 32 && !!e.match(lf.tel);
  },
  url(e) {
    return typeof e == "string" && e.length <= 2048 && !!e.match(bE());
  },
  hex(e) {
    return typeof e == "string" && !!e.match(lf.hex);
  }
}, EE = (e, n, o, i, l) => {
  if (e.required && n === void 0) {
    ev(e, n, o, i, l);
    return;
  }
  const c = ["integer", "float", "array", "regexp", "object", "method", "email", "tel", "number", "date", "url", "hex"], f = e.type;
  c.indexOf(f) > -1 ? Os[f](n) || i.push(In(l.messages.types[f], e.fullField, e.type)) : f && typeof n !== e.type && i.push(In(l.messages.types[f], e.fullField, e.type));
}, $E = (e, n, o, i, l) => {
  (/^\s+$/.test(n) || n === "") && i.push(In(l.messages.whitespace, e.fullField));
}, Ie = {
  required: ev,
  whitespace: $E,
  type: EE,
  range: xE,
  enum: wE,
  pattern: CE
}, PE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l);
  }
  o(c);
}, RE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (n == null && !e.required)
      return o();
    Ie.required(e, n, i, c, l, "array"), n != null && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, _E = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie.type(e, n, i, c, l);
  }
  o(c);
}, NE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n, "date") && !e.required)
      return o();
    if (Ie.required(e, n, i, c, l), !Lt(n, "date")) {
      let p;
      n instanceof Date ? p = n : p = new Date(n), Ie.type(e, p, i, c, l), p && Ie.range(e, p.getTime(), i, c, l);
    }
  }
  o(c);
}, kE = "enum", ME = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie[kE](e, n, i, c, l);
  }
  o(c);
}, TE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, IE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, FE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie.type(e, n, i, c, l);
  }
  o(c);
}, OE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (n === "" && (n = void 0), Lt(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l));
  }
  o(c);
}, AE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), n !== void 0 && Ie.type(e, n, i, c, l);
  }
  o(c);
}, LE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n, "string") && !e.required)
      return o();
    Ie.required(e, n, i, c, l), Lt(n, "string") || Ie.pattern(e, n, i, c, l);
  }
  o(c);
}, zE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n) && !e.required)
      return o();
    Ie.required(e, n, i, c, l), Lt(n) || Ie.type(e, n, i, c, l);
  }
  o(c);
}, BE = (e, n, o, i, l) => {
  const c = [], f = Array.isArray(n) ? "array" : typeof n;
  Ie.required(e, n, i, c, l, f), o(c);
}, DE = (e, n, o, i, l) => {
  const c = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n, "string") && !e.required)
      return o();
    Ie.required(e, n, i, c, l, "string"), Lt(n, "string") || (Ie.type(e, n, i, c, l), Ie.range(e, n, i, c, l), Ie.pattern(e, n, i, c, l), e.whitespace === !0 && Ie.whitespace(e, n, i, c, l));
  }
  o(c);
}, Ca = (e, n, o, i, l) => {
  const c = e.type, f = [];
  if (e.required || !e.required && i.hasOwnProperty(e.field)) {
    if (Lt(n, c) && !e.required)
      return o();
    Ie.required(e, n, i, f, l, c), Lt(n, c) || Ie.type(e, n, i, f, l);
  }
  o(f);
}, bs = {
  string: DE,
  method: FE,
  number: OE,
  boolean: _E,
  regexp: zE,
  integer: IE,
  float: TE,
  array: RE,
  object: AE,
  enum: ME,
  pattern: LE,
  date: NE,
  url: Ca,
  hex: Ca,
  email: Ca,
  tel: Ca,
  required: BE,
  any: PE
};
class qa {
  // ========================= Static =========================
  static register = function(o, i) {
    if (typeof i != "function")
      throw new Error("Cannot register a validator by type, validator is not a function");
    bs[o] = i;
  };
  static warning = pE;
  static messages = sf;
  static validators = bs;
  // ======================== Instance ========================
  rules = null;
  _messages = sf;
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
    return n && (this._messages = jg(od(), n)), this._messages;
  }
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  validate(n, o = {}, i = () => {
  }) {
    let l = n, c = o, f = i;
    if (typeof c == "function" && (f = c, c = {}), !this.rules || Object.keys(this.rules).length === 0)
      return f && f(null, l), Promise.resolve(l);
    function p(y) {
      let w = [], x = {};
      function E(C) {
        Array.isArray(C) ? w = w.concat(...C) : w.push(C);
      }
      for (let C = 0; C < y.length; C++)
        E(y[C]);
      w.length ? (x = id(w), f(w, x)) : f(null, l);
    }
    if (c.messages) {
      let y = this.messages();
      y === sf && (y = od()), jg(y, c.messages), c.messages = y;
    } else
      c.messages = this.messages();
    const g = {};
    (c.keys || Object.keys(this.rules)).forEach((y) => {
      const w = this.rules[y];
      let x = l[y];
      w.forEach((E) => {
        let C = E;
        typeof C.transform == "function" && (l === n && (l = {
          ...l
        }), x = l[y] = C.transform(x), x != null && (C.type = C.type || (Array.isArray(x) ? "array" : typeof x))), typeof C == "function" ? C = {
          validator: C
        } : C = {
          ...C
        }, C.validator = this.getValidationMethod(C), C.validator && (C.field = y, C.fullField = C.fullField || y, C.type = this.getType(C), g[y] = g[y] || [], g[y].push({
          rule: C,
          value: x,
          source: l,
          field: y
        }));
      });
    });
    const v = {};
    return yE(g, c, (y, w) => {
      const x = y.rule;
      let E = (x.type === "object" || x.type === "array") && (typeof x.fields == "object" || typeof x.defaultField == "object");
      E = E && (x.required || !x.required && y.value), x.field = y.field;
      function C(_, R) {
        return {
          ...R,
          fullField: `${x.fullField}.${_}`,
          fullFields: x.fullFields ? [...x.fullFields, _] : [_]
        };
      }
      function b(_ = []) {
        let R = Array.isArray(_) ? _ : [_];
        !c.suppressWarning && R.length && qa.warning("async-validator:", R), R.length && x.message !== void 0 && x.message !== null && (R = [].concat(x.message));
        let N = R.map(Dg(x, l));
        if (c.first && N.length)
          return v[x.field] = 1, w(N);
        if (!E)
          w(N);
        else {
          if (x.required && !y.value)
            return x.message !== void 0 ? N = [].concat(x.message).map(Dg(x, l)) : c.error && (N = [c.error(x, In(c.messages.required, x.field))]), w(N);
          let T = {};
          x.defaultField && Object.keys(y.value).map((A) => {
            T[A] = x.defaultField;
          }), T = {
            ...T,
            ...y.rule.fields
          };
          const L = {};
          Object.keys(T).forEach((A) => {
            const H = T[A], Y = Array.isArray(H) ? H : [H];
            L[A] = Y.map(C.bind(null, A));
          });
          const F = new qa(L);
          F.messages(c.messages), y.rule.options && (y.rule.options.messages = c.messages, y.rule.options.error = c.error), F.validate(y.value, y.rule.options || c, (A) => {
            const H = [];
            N && N.length && H.push(...N), A && A.length && H.push(...A), w(H.length ? H : null);
          });
        }
      }
      let $;
      if (x.asyncValidator)
        $ = x.asyncValidator(x, y.value, b, y.source, c);
      else if (x.validator) {
        try {
          $ = x.validator(x, y.value, b, y.source, c);
        } catch (_) {
          console.error?.(_), c.suppressValidatorError || setTimeout(() => {
            throw _;
          }, 0), b(_.message);
        }
        $ === !0 ? b() : $ === !1 ? b(typeof x.message == "function" ? x.message(x.fullField || x.field) : x.message || `${x.fullField || x.field} fails`) : $ instanceof Array ? b($) : $ instanceof Error && b($.message);
      }
      $ && $.then && $.then(() => b(), (_) => b(_));
    }, (y) => {
      p(y);
    }, l);
  }
  getType(n) {
    if (n.type === void 0 && n.pattern instanceof RegExp && (n.type = "pattern"), typeof n.validator != "function" && n.type && !bs.hasOwnProperty(n.type))
      throw new Error(In("Unknown rule type %s", n.type));
    return n.type || "string";
  }
  getValidationMethod(n) {
    if (typeof n.validator == "function")
      return n.validator;
    const o = Object.keys(n), i = o.indexOf("message");
    return i !== -1 && o.splice(i, 1), o.length === 1 && o[0] === "required" ? bs.required : bs[this.getType(n)] || void 0;
  }
}
const xn = "'${name}' is not a valid ${type}", tv = {
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
}, Hg = qa;
function jE(e, n) {
  return e.replace(/\\?\$\{\w+\}/g, (o) => {
    if (o.startsWith("\\"))
      return o.slice(1);
    const i = o.slice(2, -1);
    return n[i];
  });
}
const Vg = "CODE_LOGIC_ERROR";
async function sd(e, n, o, i, l) {
  const c = {
    ...o
  };
  if (delete c.ruleIndex, Hg.warning = () => {
  }, c.validator) {
    const w = c.validator;
    c.validator = (...x) => {
      try {
        return w(...x);
      } catch (E) {
        return console.error(E), Promise.reject(Vg);
      }
    };
  }
  let f = null;
  c && c.type === "array" && c.defaultField && (f = c.defaultField, delete c.defaultField);
  const p = new Hg({
    [e]: [c]
  }), g = $i(tv, i.validateMessages);
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
    }, E) => {
      const C = x === Vg ? g.default : x;
      return /* @__PURE__ */ h.isValidElement(C) ? (
        // Wrap ReactNode with `key`
        /* @__PURE__ */ h.cloneElement(C, {
          key: `error_${E}`
        })
      ) : C;
    }));
  }
  if (!m.length && f && Array.isArray(n) && n.length > 0)
    return (await Promise.all(n.map((x, E) => sd(`${e}.${E}`, x, f, i, l)))).reduce((x, E) => [...x, ...E], []);
  const v = {
    ...o,
    name: e,
    enum: (o.enum || []).join(", "),
    ...l
  };
  return m.map((w) => typeof w == "string" ? jE(w, v) : w);
}
function HE(e, n, o, i, l, c) {
  const f = e.join("."), p = o.map((m, v) => {
    const y = m.validator, w = {
      ...m,
      ruleIndex: v
    };
    return y && (w.validator = (x, E, C) => {
      let b = !1;
      const _ = y(x, E, (...R) => {
        Promise.resolve().then(() => {
          Fn(!b, "Your validator function has already return a promise. `callback` will be ignored."), b || C(...R);
        });
      });
      b = _ && typeof _.then == "function" && typeof _.catch == "function", Fn(b, "`callback` is deprecated. Please return a promise instead."), b && _.then(() => {
        C();
      }).catch((R) => {
        C(R || " ");
      });
    }), w;
  }).sort(({
    warningOnly: m,
    ruleIndex: v
  }, {
    warningOnly: y,
    ruleIndex: w
  }) => !!m == !!y ? v - w : m ? 1 : -1);
  let g;
  if (l === !0)
    g = new Promise(async (m, v) => {
      for (let y = 0; y < p.length; y += 1) {
        const w = p[y], x = await sd(f, n, w, i, c);
        if (x.length) {
          v([{
            errors: x,
            rule: w
          }]);
          return;
        }
      }
      m([]);
    });
  else {
    const m = p.map((v) => sd(f, n, v, i, c).then((y) => ({
      errors: y,
      rule: v
    })));
    g = (l ? WE(m) : VE(m)).then((v) => Promise.reject(v));
  }
  return g.catch((m) => m), g;
}
async function VE(e) {
  return Promise.all(e).then((n) => [].concat(...n));
}
async function WE(e) {
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
  return rd(e);
}
function Wg(e, n) {
  let o = {};
  return n.forEach((i) => {
    const l = Kn(e, i);
    o = Tn(o, i, l);
  }), o;
}
function Ri(e, n, o = !1) {
  return e && e.some((i) => Xa(n, i, o));
}
function Xa(e, n, o = !1) {
  return !e || !n || !o && e.length !== n.length ? !1 : n.every((i, l) => e[l] === i);
}
function UE(e, n) {
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
function qE(e, ...n) {
  const o = n[0];
  return o && o.target && typeof o.target == "object" && e in o.target ? o.target[e] : o;
}
function Ug(e, n, o) {
  const {
    length: i
  } = e;
  if (n < 0 || n >= i || o < 0 || o >= i)
    return e;
  const l = e[n], c = n - o;
  return c > 0 ? [...e.slice(0, o), l, ...e.slice(o, n), ...e.slice(n + 1, i)] : c < 0 ? [...e.slice(0, n), ...e.slice(n + 1, o + 1), l, ...e.slice(o + 1, i)] : e;
}
const nv = (e) => {
  const n = new MessageChannel();
  n.port1.onmessage = e, n.port2.postMessage(null);
};
class XE {
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
      this.namePathList.every((i) => !Xa(i, o)) && this.namePathList.push(o);
    }), this.doBatch();
  }
  doBatch() {
    this.taskId += 1;
    const n = this.taskId;
    nv(() => {
      if (n === this.taskId && this.watcherList.size) {
        const o = this.form.getForm(), i = o.getFieldsValue(), l = o.getFieldsValue(!0);
        this.watcherList.forEach((c) => {
          c(i, l, this.namePathList);
        }), this.namePathList = [];
      }
    });
  }
}
async function GE() {
  return new Promise((e) => {
    nv(() => {
      go(() => {
        e();
      });
    });
  });
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
const Io = [], Es = [];
function af(e, n, o, i, l, c) {
  return typeof e == "function" ? e(n, o, "source" in c ? {
    source: c.source
  } : {}) : i !== l;
}
class YE extends h.PureComponent {
  static contextType = Ii;
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
  errors = Io;
  warnings = Es;
  // ============================== Subscriptions ==============================
  constructor(n) {
    if (super(n), n.fieldContext) {
      const {
        getInternalHooks: o
      } = n.fieldContext, {
        initEntityValue: i
      } = o(Bo);
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
      } = i(Bo);
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
      Cf(this.metaCache, i) || o(i), this.metaCache = i;
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
    } = i, g = this.getNamePath(), m = this.getValue(n), v = this.getValue(p), y = o && Ri(o, g);
    switch (i.type === "valueUpdate" && i.source === "external" && !Cf(m, v) && (this.touched = !0, this.dirty = !0, this.validatePromise = null, this.errors = Io, this.warnings = Es, this.triggerMetaEvent()), i.type) {
      case "reset":
        if (!o || y) {
          this.touched = !1, this.dirty = !1, this.validatePromise = void 0, this.errors = Io, this.warnings = Es, this.triggerMetaEvent(), f?.(), this.refresh();
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
        if (l && af(l, n, p, m, v, i)) {
          this.reRender();
          return;
        }
        break;
      }
      case "setField": {
        const {
          data: w
        } = i;
        if (y) {
          "touched" in w && (this.touched = w.touched), "validating" in w && !("originRCField" in w) && (this.validatePromise = w.validating ? Promise.resolve([]) : null), "errors" in w && (this.errors = w.errors || Io), "warnings" in w && (this.warnings = w.warnings || Es), this.dirty = !0, this.triggerMetaEvent(), this.reRender();
          return;
        } else if ("value" in w && Ri(o, g, !0)) {
          this.reRender();
          return;
        }
        if (l && !g.length && af(l, n, p, m, v, i)) {
          this.reRender();
          return;
        }
        break;
      }
      case "dependenciesUpdate": {
        if (c.map(St).some((x) => Ri(i.relatedFields, x))) {
          this.reRender();
          return;
        }
        break;
      }
      default:
        if (y || (!c.length || g.length || l) && af(l, n, p, m, v, i)) {
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
        validateDebounce: v
      } = this.props;
      f && await GE();
      let y = this.getRules();
      if (l && (y = y.filter((x) => x).filter((x) => {
        const {
          validateTrigger: E
        } = x;
        return E ? rd(E).includes(l) : !0;
      })), v && l && (await new Promise((x) => {
        setTimeout(x, v);
      }), this.validatePromise !== p))
        return [];
      const w = HE(o, i, y, n, g, m);
      return w.catch((x) => x).then((x = Io) => {
        if (this.validatePromise === p) {
          this.validatePromise = null;
          const E = [], C = [];
          x.forEach?.(({
            rule: {
              warningOnly: b
            },
            errors: $ = Io
          }) => {
            b ? C.push(...$) : E.push(...$);
          }), this.errors = E, this.warnings = C, this.triggerMetaEvent(), this.reRender();
        }
      }), w;
    });
    return c || (this.validatePromise = p, this.dirty = !0, this.errors = Io, this.warnings = Es, this.triggerMetaEvent(), this.reRender()), p;
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
    } = n.getInternalHooks(Bo);
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
    const o = Vs(n);
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
    return Kn(n || o(!0), i);
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
    } = this.props, v = l !== void 0 ? l : m.validateTrigger, y = this.getNamePath(), {
      getInternalHooks: w,
      getFieldsValue: x
    } = m, {
      dispatch: E
    } = w(Bo), C = this.getValue(), b = g || ((T) => ({
      [p]: T
    })), $ = n[i], _ = o !== void 0 ? b(C) : {}, R = {
      ...n,
      ..._
    };
    return R[i] = (...T) => {
      this.touched = !0, this.dirty = !0, this.triggerMetaEvent();
      const L = this.getValue();
      let F;
      c ? F = c(...T) : F = qE(p, ...T), f && (F = f(F, L, x(!0))), F !== L && E({
        type: "updateValue",
        namePath: y,
        value: F
      }), $ && $(...T);
    }, rd(v || []).forEach((T) => {
      const L = R[T];
      R[T] = (...F) => {
        L && L(...F);
        const {
          rules: A
        } = this.props;
        A && A.length && E({
          type: "validateField",
          namePath: y,
          triggerName: T
        });
      };
    }), R;
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
function rv({
  name: e,
  ...n
}) {
  const o = h.useContext(Ii), i = h.useContext(Ua), l = e !== void 0 ? St(e) : void 0, c = n.isListField ?? !!i;
  let f = "keep";
  return c || (f = `_${(l || []).join("_")}`), /* @__PURE__ */ h.createElement(YE, ld({
    key: f,
    name: l,
    isListField: c
  }, n, {
    fieldContext: o
  }));
}
function KE({
  name: e,
  initialValue: n,
  children: o,
  rules: i,
  validateTrigger: l,
  isListField: c
}) {
  const f = h.useContext(Ii), p = h.useContext(Ua), m = h.useRef({
    keys: [],
    id: 0
  }).current, v = h.useMemo(() => [...St(f.prefixName) || [], ...St(e)], [f.prefixName, e]), y = h.useMemo(() => ({
    ...f,
    prefixName: v
  }), [f, v]), w = h.useMemo(() => ({
    getKey: (E) => {
      const C = v.length, b = E[C];
      return [m.keys[b], E.slice(C + 1)];
    }
  }), [m, v]);
  if (typeof o != "function")
    return Fn(!1, "Form.List only accepts function as children."), null;
  const x = (E, C, {
    source: b
  }) => b === "internal" ? !1 : E !== C;
  return /* @__PURE__ */ h.createElement(Ua.Provider, {
    value: w
  }, /* @__PURE__ */ h.createElement(Ii.Provider, {
    value: y
  }, /* @__PURE__ */ h.createElement(rv, {
    name: [],
    shouldUpdate: x,
    rules: i,
    validateTrigger: l,
    initialValue: n,
    isList: !0,
    isListField: c ?? !!p
  }, ({
    value: E = [],
    onChange: C
  }, b) => {
    const {
      getFieldValue: $
    } = f, _ = () => $(v || []) || [], R = {
      add: (T, L) => {
        const F = _();
        L >= 0 && L <= F.length ? (m.keys = [...m.keys.slice(0, L), m.id, ...m.keys.slice(L)], C([...F.slice(0, L), T, ...F.slice(L)])) : (m.keys = [...m.keys, m.id], C([...F, T])), m.id += 1;
      },
      remove: (T) => {
        const L = _(), F = new Set(Array.isArray(T) ? T : [T]);
        F.size <= 0 || (m.keys = m.keys.filter((A, H) => !F.has(H)), C(L.filter((A, H) => !F.has(H))));
      },
      move(T, L) {
        if (T === L)
          return;
        const F = _();
        T < 0 || T >= F.length || L < 0 || L >= F.length || (m.keys = Ug(m.keys, T, L), C(Ug(F, T, L)));
      }
    };
    let N = E || [];
    return Array.isArray(N) || (N = []), o(N.map((T, L) => {
      let F = m.keys[L];
      return F === void 0 && (m.keys[L] = m.id, F = m.keys[L], m.id += 1), {
        name: L,
        key: F,
        isListField: !0
      };
    }), R, b);
  })));
}
function QE(e) {
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
const ad = "__@field_split__";
function xa(e) {
  return e.map((n) => `${typeof n}:${n}`).join(ad);
}
class xi {
  kvs = /* @__PURE__ */ new Map();
  set(n, o) {
    this.kvs.set(xa(n), o);
  }
  get(n) {
    return this.kvs.get(xa(n));
  }
  getAsPrefix(n) {
    const o = xa(n), i = o + ad, l = [], c = this.kvs.get(o);
    return c !== void 0 && l.push(c), this.kvs.forEach((f, p) => {
      p.startsWith(i) && l.push(f);
    }), l;
  }
  update(n, o) {
    const i = this.get(n), l = o(i);
    l ? this.set(n, l) : this.delete(n);
  }
  delete(n) {
    this.kvs.delete(xa(n));
  }
  // Since we only use this in test, let simply realize this
  map(n) {
    return [...this.kvs.entries()].map(([o, i]) => {
      const l = o.split(ad);
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
class ZE {
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
  watcherCenter = new XE(this);
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
  getInternalHooks = (n) => n === Bo ? (this.formHooked = !0, {
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
      let i = $i(n, this.store);
      this.prevWithoutPreserves?.map(({
        key: l
      }) => {
        i = Tn(i, l, Kn(n, l));
      }), this.prevWithoutPreserves = null, this.updateStore(i);
    }
  };
  destroyForm = (n) => {
    if (n)
      this.updateStore({});
    else {
      const o = new xi();
      this.getFieldEntities(!0).forEach((i) => {
        this.isMergedPreserve(i.isPreserve()) || o.set(i.getNamePath(), !0);
      }), this.prevWithoutPreserves = o;
    }
  };
  getInitialValue = (n) => {
    const o = Kn(this.initialValues, n);
    return n.length ? $i(o) : o;
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
    const o = new xi();
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
      const v = m.INVALIDATE_NAME_PATH || m.getNamePath();
      if (m.isList?.()) {
        p.push(v);
        return;
      }
      if (!l)
        f.push(v);
      else {
        const y = "getMeta" in m ? m.getMeta() : null;
        l(y) && f.push(v);
      }
    });
    let g = Wg(this.store, f.map(St));
    return p.forEach((m) => {
      Kn(g, m) || (g = Tn(g, m, []));
    }), g;
  };
  getFieldValue = (n) => {
    this.warningUnhooked();
    const o = St(n);
    return Kn(this.store, o);
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
    const f = this.getFieldEntities(!0), p = (y) => y.isFieldTouched();
    if (!l)
      return c ? f.every((y) => p(y) || y.isList()) : f.some(p);
    const g = new xi();
    l.forEach((y) => {
      g.set(y, []);
    }), f.forEach((y) => {
      const w = y.getNamePath();
      l.forEach((x) => {
        x.every((E, C) => w[C] === E) && g.update(x, (E) => [...E, y]);
      });
    });
    const m = (y) => y.some(p), v = g.map(({
      value: y
    }) => y);
    return c ? v.every(m) : v.some(m);
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
      return Ri(i, c) && l.isFieldValidating();
    });
  };
  isFieldValidating = (n) => (this.warningUnhooked(), this.isFieldsValidating([n]));
  /**
   * Reset Field with field `initialValue` prop.
   * Can pass `entities` or `namePathList` or just nothing.
   */
  resetWithFieldInitialValue = (n = {}) => {
    const o = new xi(), i = this.getFieldEntities(!0);
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
            const y = o.get(m);
            if (y && y.size > 1)
              Fn(!1, `Multiple Field with path '${m.join(".")}' set 'initialValue'. Can not decide which one to pick.`);
            else if (y) {
              const w = this.getFieldValue(m);
              !p.isListField() && (!n.skipExist || w === void 0) && this.updateStore(Tn(this.store, m, [...y][0].value));
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
      this.updateStore($i(this.initialValues)), this.resetWithFieldInitialValue(), this.notifyObservers(o, null, {
        type: "reset"
      }), this.notifyWatch();
      return;
    }
    const i = n.map(St);
    i.forEach((l) => {
      const c = this.getInitialValue(l);
      this.updateStore(Tn(this.store, l, c));
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
      i.push(p), "value" in f && this.updateStore(Tn(this.store, p, f.value)), this.notifyObservers(o, [p], {
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
      Kn(this.store, i) === void 0 && this.updateStore(Tn(this.store, i, o));
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
          !Xa(p.getNamePath(), o)
        ))) {
          const p = this.store;
          this.updateStore(Tn(p, o, f, !0)), this.notifyObservers(p, [o], {
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
    this.updateStore(Tn(this.store, i, o)), this.notifyObservers(l, [i], {
      type: "valueUpdate",
      source: "internal"
    }), this.notifyWatch([i]);
    const c = this.triggerDependenciesUpdate(l, i), {
      onValuesChange: f
    } = this.callbacks;
    if (f) {
      const p = Wg(this.store, [i]), g = this.getFieldsValue(), m = Tn(g, i, Kn(p, i));
      f(p, m);
    }
    this.triggerOnFieldsChange([i, ...c]);
  };
  // Let all child Field get update.
  setFieldsValue = (n) => {
    this.warningUnhooked();
    const o = this.store;
    if (n) {
      const i = $i(this.store, n);
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
    const o = /* @__PURE__ */ new Set(), i = [], l = new xi();
    this.getFieldEntities().forEach((f) => {
      const {
        dependencies: p
      } = f.props;
      (p || []).forEach((g) => {
        const m = St(g);
        l.update(m, (v = /* @__PURE__ */ new Set()) => (v.add(f), v));
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
        const f = new xi();
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
      }) => Ri(n, f));
      c.length && i(c, l);
    }
  };
  // =========================== Validate ===========================
  validateFields = (n, o) => {
    this.warningUnhooked();
    let i, l;
    Array.isArray(n) || typeof n == "string" || typeof o == "string" ? (i = n, l = o) : l = n;
    const c = !!i, f = c ? i.map(St) : [], p = [...f], g = [], m = String(Date.now()), v = /* @__PURE__ */ new Set(), {
      recursive: y,
      dirty: w
    } = l || {};
    this.getFieldEntities(!0).forEach((b) => {
      const $ = b.getNamePath();
      if (c || // If is field, pass directly
      ((!b.isList() || // If is list, do not add if already exist sub field in the namePathList
      !f.some((_) => Xa(_, $, !0))) && p.push($), f.push($)), !(!b.props.rules || !b.props.rules.length) && !(w && !b.isFieldDirty()) && (v.add($.join(m)), !c || Ri(f, $, y))) {
        const _ = b.validateRules({
          validateMessages: {
            ...tv,
            ...this.validateMessages
          },
          ...l
        });
        g.push(_.then(() => ({
          name: $,
          errors: [],
          warnings: []
        })).catch((R) => {
          const N = [], T = [];
          return R.forEach?.(({
            rule: {
              warningOnly: L
            },
            errors: F
          }) => {
            L ? T.push(...F) : N.push(...F);
          }), N.length ? Promise.reject({
            name: $,
            errors: N,
            warnings: T
          }) : {
            name: $,
            errors: N,
            warnings: T
          };
        }));
      }
    });
    const x = QE(g);
    this.lastValidatePromise = x, x.catch((b) => b).then((b) => {
      const $ = b.map(({
        name: _
      }) => _);
      this.notifyObservers(this.store, $, {
        type: "validateFinish"
      }), this.triggerOnFieldsChange($, b);
    });
    const E = x.then(() => this.lastValidatePromise === x ? Promise.resolve(this.getFieldsValue(p)) : Promise.reject([])).catch((b) => {
      const $ = b.filter((R) => R && R.errors.length), _ = $[0]?.errors?.[0];
      return Promise.reject({
        message: _,
        values: this.getFieldsValue(f),
        errorFields: $,
        outOfDate: this.lastValidatePromise !== x
      });
    });
    E.catch((b) => b);
    const C = f.filter((b) => v.has(b.join(m)));
    return this.triggerOnFieldsChange(C), E;
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
function ov(e) {
  const n = h.useRef(null), [, o] = h.useState({});
  if (!n.current)
    if (e)
      n.current = e;
    else {
      const i = () => {
        o({});
      }, l = new ZE(i);
      n.current = l.getForm();
    }
  return [n.current];
}
const cd = /* @__PURE__ */ h.createContext({
  triggerFormChange: () => {
  },
  triggerFormFinish: () => {
  },
  registerForm: () => {
  },
  unregisterForm: () => {
  }
}), JE = ({
  validateMessages: e,
  onFormChange: n,
  onFormFinish: o,
  children: i
}) => {
  const l = h.useContext(cd), c = h.useRef({});
  return /* @__PURE__ */ h.createElement(cd.Provider, {
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
const e$ = (e, n) => {
  const {
    name: o,
    initialValues: i,
    fields: l,
    form: c,
    preserve: f,
    children: p,
    component: g = "form",
    validateMessages: m,
    validateTrigger: v = "onChange",
    onValuesChange: y,
    onFieldsChange: w,
    onFinish: x,
    onFinishFailed: E,
    clearOnDestroy: C,
    ...b
  } = e, $ = h.useRef(null), _ = h.useContext(cd), [R] = ov(c), {
    useSubscribe: N,
    setInitialValues: T,
    setCallbacks: L,
    setValidateMessages: F,
    setPreserve: A,
    destroyForm: H
  } = R.getInternalHooks(Bo);
  h.useImperativeHandle(n, () => ({
    ...R,
    nativeElement: $.current
  })), h.useEffect(() => (_.registerForm(o, R), () => {
    _.unregisterForm(o);
  }), [_, R, o]), F({
    ..._.validateMessages,
    ...m
  }), L({
    onValuesChange: y,
    onFieldsChange: (le, ...he) => {
      _.triggerFormChange(o, le), w && w(le, ...he);
    },
    onFinish: (le) => {
      _.triggerFormFinish(o, le), x && x(le);
    },
    onFinishFailed: E
  }), A(f);
  const Y = h.useRef(null);
  T(i, !Y.current), Y.current || (Y.current = !0), h.useEffect(
    () => () => H(C),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  let V;
  const X = typeof p == "function";
  if (X) {
    const le = R.getFieldsValue(!0);
    V = p(le, R);
  } else
    V = p;
  N(!X);
  const Q = h.useRef(null);
  h.useEffect(() => {
    UE(Q.current || [], l || []) || R.setFields(l || []), Q.current = l;
  }, [l, R]);
  const oe = h.useMemo(() => ({
    ...R,
    validateTrigger: v
  }), [R, v]), G = /* @__PURE__ */ h.createElement(Ua.Provider, {
    value: null
  }, /* @__PURE__ */ h.createElement(Ii.Provider, {
    value: oe
  }, V));
  return g === !1 ? G : /* @__PURE__ */ h.createElement(g, ud({}, b, {
    ref: $,
    onSubmit: (le) => {
      le.preventDefault(), le.stopPropagation(), R.submit();
    },
    onReset: (le) => {
      le.preventDefault(), R.resetFields(), b.onReset?.(le);
    }
  }), G);
};
function cf(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return Math.random();
  }
}
function t$(...e) {
  const [n, o = {}] = e, i = fE(o) ? {
    form: o
  } : o, l = i.form, [c, f] = h.useState(() => typeof n == "function" ? n({}) : void 0), p = h.useMemo(() => cf(c), [c]), g = h.useRef(p);
  g.current = p;
  const m = h.useContext(Ii), v = l || m, y = v && v._init, {
    getFieldsValue: w,
    getInternalHooks: x
  } = v, {
    registerWatch: E
  } = x(Bo), C = wt(($, _) => {
    const R = i.preserve ? _ ?? w(!0) : $ ?? w(), N = typeof n == "function" ? n(R) : Kn(R, St(n));
    cf(c) !== cf(N) && f(N);
  }), b = typeof n == "function" ? n : JSON.stringify(n);
  return h.useEffect(() => {
    y && C();
  }, [y, b]), h.useEffect(() => y ? E((_, R) => {
    C(_, R);
  }) : void 0, [y]), c;
}
const n$ = /* @__PURE__ */ h.forwardRef(e$), sl = n$;
sl.FormProvider = JE;
sl.Field = rv;
sl.List = KE;
sl.useForm = ov;
sl.useWatch = t$;
const Ga = /* @__PURE__ */ h.createContext({}), r$ = ({
  children: e,
  status: n,
  override: o
}) => {
  const i = h.useContext(Ga), l = h.useMemo(() => {
    const c = {
      ...i
    };
    return o && delete c.isFormItemInput, n && (delete c.status, delete c.hasFeedback, delete c.feedbackIcon), c;
  }, [n, o, i]);
  return /* @__PURE__ */ h.createElement(Ga.Provider, {
    value: l
  }, e);
}, o$ = /* @__PURE__ */ h.createContext(void 0), iv = (e) => {
  const {
    space: n,
    form: o,
    children: i
  } = e;
  if (!Vx(i))
    return null;
  let l = i;
  return o && (l = /* @__PURE__ */ Se.createElement(r$, {
    override: !0,
    status: !0
  }, l)), n && (l = /* @__PURE__ */ Se.createElement(Db, null, l)), l;
}, sv = (e, n, o) => we({
  [`${e}-status-success`]: n === "success",
  [`${e}-status-warning`]: n === "warning",
  [`${e}-status-error`]: n === "error",
  [`${e}-status-validating`]: n === "validating",
  [`${e}-has-feedback`]: o
}), i$ = (e, n) => n || e, s$ = (e, n, o) => {
  const {
    variant: i,
    [e]: l
  } = h.useContext(On), c = h.useContext(o$), f = l?.variant;
  let p;
  typeof n < "u" ? p = n : o === !1 ? p = "borderless" : p = c ?? f ?? i ?? "outlined";
  const g = yw.includes(p);
  return [p, g];
};
var ba = {}, qg;
function l$() {
  if (qg) return ba;
  qg = 1, Object.defineProperty(ba, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 00-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z" } }] }, name: "check", theme: "outlined" };
  return ba.default = e, ba;
}
var a$ = /* @__PURE__ */ l$();
const c$ = /* @__PURE__ */ Jn(a$);
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
const u$ = (e, n) => /* @__PURE__ */ h.createElement(Er, fd({}, e, {
  ref: n,
  icon: c$
})), f$ = /* @__PURE__ */ h.forwardRef(u$);
var Ea = {}, Xg;
function d$() {
  if (Xg) return Ea;
  Xg = 1, Object.defineProperty(Ea, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M884 256h-75c-5.1 0-9.9 2.5-12.9 6.6L512 654.2 227.9 262.6c-3-4.1-7.8-6.6-12.9-6.6h-75c-6.5 0-10.3 7.4-6.5 12.7l352.6 486.1c12.8 17.6 39 17.6 51.7 0l352.6-486.1c3.9-5.3.1-12.7-6.4-12.7z" } }] }, name: "down", theme: "outlined" };
  return Ea.default = e, Ea;
}
var p$ = /* @__PURE__ */ d$();
const h$ = /* @__PURE__ */ Jn(p$);
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
const m$ = (e, n) => /* @__PURE__ */ h.createElement(Er, dd({}, e, {
  ref: n,
  icon: h$
})), g$ = /* @__PURE__ */ h.forwardRef(m$), lv = (e) => {
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
}, bi = {
  shiftX: 64,
  adjustY: 1
}, Ei = {
  adjustX: 1,
  shiftY: !0
}, Gn = [0, 0], y$ = {
  left: {
    points: ["cr", "cl"],
    overflow: Ei,
    offset: [-4, 0],
    targetOffset: Gn
  },
  right: {
    points: ["cl", "cr"],
    overflow: Ei,
    offset: [4, 0],
    targetOffset: Gn
  },
  top: {
    points: ["bc", "tc"],
    overflow: bi,
    offset: [0, -4],
    targetOffset: Gn
  },
  bottom: {
    points: ["tc", "bc"],
    overflow: bi,
    offset: [0, 4],
    targetOffset: Gn
  },
  topLeft: {
    points: ["bl", "tl"],
    overflow: bi,
    offset: [0, -4],
    targetOffset: Gn
  },
  leftTop: {
    points: ["tr", "tl"],
    overflow: Ei,
    offset: [-4, 0],
    targetOffset: Gn
  },
  topRight: {
    points: ["br", "tr"],
    overflow: bi,
    offset: [0, -4],
    targetOffset: Gn
  },
  rightTop: {
    points: ["tl", "tr"],
    overflow: Ei,
    offset: [4, 0],
    targetOffset: Gn
  },
  bottomRight: {
    points: ["tr", "br"],
    overflow: bi,
    offset: [0, 4],
    targetOffset: Gn
  },
  rightBottom: {
    points: ["bl", "br"],
    overflow: Ei,
    offset: [4, 0],
    targetOffset: Gn
  },
  bottomLeft: {
    points: ["tl", "bl"],
    overflow: bi,
    offset: [0, 4],
    targetOffset: Gn
  },
  leftBottom: {
    points: ["br", "bl"],
    overflow: Ei,
    offset: [-4, 0],
    targetOffset: Gn
  }
};
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
const v$ = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    trigger: o = ["hover"],
    mouseEnterDelay: i = 0,
    mouseLeaveDelay: l = 0.1,
    prefixCls: c = "rc-tooltip",
    children: f,
    onVisibleChange: p,
    afterVisibleChange: g,
    motion: m,
    placement: v = "right",
    align: y = {},
    destroyOnHidden: w = !1,
    defaultVisible: x,
    getTooltipContainer: E,
    arrowContent: C,
    overlay: b,
    id: $,
    showArrow: _ = !0,
    classNames: R,
    styles: N,
    ...T
  } = e, L = Zs($), F = h.useRef(null);
  h.useImperativeHandle(n, () => F.current);
  const A = {
    ...T
  };
  "visible" in e && (A.popupVisible = e.visible);
  const H = h.useMemo(() => {
    if (!_)
      return !1;
    const V = _ === !0 ? {} : _;
    return {
      ...V,
      className: we(V.className, R?.arrow),
      style: {
        ...V.style,
        ...N?.arrow
      },
      content: V.content ?? C
    };
  }, [_, R?.arrow, N?.arrow, C]), Y = ({
    open: V
  }) => {
    const X = h.Children.only(f), Q = {
      "aria-describedby": b && V ? L : void 0
    };
    return /* @__PURE__ */ h.cloneElement(X, Q);
  };
  return /* @__PURE__ */ h.createElement(Sb, pd({
    popupClassName: R?.root,
    prefixCls: c,
    popup: /* @__PURE__ */ h.createElement(lv, {
      key: "content",
      prefixCls: c,
      id: L,
      classNames: R,
      styles: N
    }, b),
    action: o,
    builtinPlacements: y$,
    popupPlacement: v,
    ref: F,
    popupAlign: y,
    getPopupContainer: E,
    onOpenChange: p,
    afterOpenChange: g,
    popupMotion: m,
    defaultPopupVisible: x,
    autoDestroy: w,
    mouseLeaveDelay: l,
    popupStyle: N?.root,
    mouseEnterDelay: i,
    arrow: H,
    uniqueContainerClassName: R?.uniqueContainer,
    uniqueContainerStyle: N?.uniqueContainer
  }, A), Y);
});
function S$(e) {
  const {
    sizePopupArrow: n,
    borderRadiusXS: o,
    borderRadiusOuter: i
  } = e, l = n / 2, c = 0, f = l, p = i * 1 / Math.sqrt(2), g = l - i * (1 - 1 / Math.sqrt(2)), m = l - o * (1 / Math.sqrt(2)), v = i * (Math.sqrt(2) - 1) + o * (1 / Math.sqrt(2)), y = 2 * l - m, w = v, x = 2 * l - p, E = g, C = 2 * l - c, b = f, $ = l * Math.sqrt(2) + i * (Math.sqrt(2) - 2), _ = i * (Math.sqrt(2) - 1), R = `polygon(${_}px 100%, 50% ${_}px, ${2 * l - _}px 100%, ${_}px 100%)`, N = `path('M ${c} ${f} A ${i} ${i} 0 0 0 ${p} ${g} L ${m} ${v} A ${o} ${o} 0 0 1 ${y} ${w} L ${x} ${E} A ${i} ${i} 0 0 0 ${C} ${b} Z')`;
  return {
    arrowShadowWidth: $,
    arrowPath: N,
    arrowPolygon: R
  };
}
const w$ = (e, n, o) => {
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
}, av = 8;
function cv(e) {
  const {
    contentRadius: n,
    limitVerticalRadius: o
  } = e, i = n > 12 ? n + 2 : 12;
  return {
    arrowOffsetHorizontal: i,
    arrowOffsetVertical: o ? av : i
  };
}
const C$ = (e, n, o) => {
  const {
    componentCls: i,
    boxShadowPopoverArrow: l,
    arrowOffsetVertical: c,
    arrowOffsetHorizontal: f,
    antCls: p
  } = e, [g] = nl(p, "tooltip"), {
    arrowDistance: m = 0,
    arrowShadow: v = !0
  } = o || {};
  return {
    [i]: {
      // ============================ Basic ============================
      [`${i}-arrow`]: [{
        position: "absolute",
        zIndex: 1,
        // lift it up so the menu wouldn't cask shadow on it
        display: "block",
        ...w$(e, n, v ? l : !1),
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
function x$(e, n, o, i) {
  if (i === !1)
    return {
      adjustX: !1,
      adjustY: !1
    };
  const l = Vr(i) ? i : {}, c = {};
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
const Gg = {
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
}, b$ = {
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
}, E$ = /* @__PURE__ */ new Set(["topLeft", "topRight", "bottomLeft", "bottomRight", "leftTop", "leftBottom", "rightTop", "rightBottom"]);
function $$(e) {
  const {
    arrowWidth: n,
    autoAdjustOverflow: o,
    arrowPointAtCenter: i,
    offset: l,
    borderRadius: c
  } = e, f = n / 2, p = {}, g = cv({
    contentRadius: c,
    limitVerticalRadius: !0
  });
  return Object.keys(Gg).forEach((m) => {
    const y = {
      ...i && b$[m] || Gg[m],
      offset: [0, 0],
      dynamicInset: !0
    };
    switch (p[m] = y, E$.has(m) && (y.autoArrow = !1), m) {
      case "top":
      case "topLeft":
      case "topRight":
        y.offset[1] = -f - l;
        break;
      case "bottom":
      case "bottomLeft":
      case "bottomRight":
        y.offset[1] = f + l;
        break;
      case "left":
      case "leftTop":
      case "leftBottom":
        y.offset[0] = -f - l;
        break;
      case "right":
      case "rightTop":
      case "rightBottom":
        y.offset[0] = f + l;
        break;
    }
    if (i)
      switch (m) {
        case "topLeft":
        case "bottomLeft":
          y.offset[0] = -g.arrowOffsetHorizontal - f;
          break;
        case "topRight":
        case "bottomRight":
          y.offset[0] = g.arrowOffsetHorizontal + f;
          break;
        case "leftTop":
        case "rightTop":
          y.offset[1] = -g.arrowOffsetHorizontal * 2 + f;
          break;
        case "leftBottom":
        case "rightBottom":
          y.offset[1] = g.arrowOffsetHorizontal * 2 - f;
          break;
      }
    y.overflow = x$(m, g, n, o), y.htmlRegion = "visibleFirst";
  }), p;
}
const P$ = /* @__PURE__ */ Se.createContext(!1), R$ = (e, n) => {
  const o = (i) => typeof i == "boolean" ? {
    show: i
  } : i || {};
  return Se.useMemo(() => {
    const i = o(e), l = o(n);
    return {
      ...l,
      ...i,
      show: i.show ?? l.show ?? !0
    };
  }, [e, n]);
}, Yg = "50%", _$ = (e) => {
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
    paddingSM: v,
    paddingXS: y,
    arrowOffsetHorizontal: w,
    sizePopupArrow: x,
    antCls: E
  } = e, [C, b] = nl(E, "tooltip"), $ = n(f).add(x).add(w).equal(), R = {
    minWidth: n(f).mul(2).add(x).equal(),
    minHeight: g,
    padding: `${$e(e.calc(v).div(2).equal())} ${$e(y)}`,
    color: b("overlay-color", l),
    textAlign: "start",
    textDecoration: "none",
    wordWrap: "break-word",
    backgroundColor: c,
    borderRadius: f,
    boxSizing: "border-box"
  }, N = {
    // When use `autoArrow`, origin will follow the arrow position
    [C("valid-offset-x")]: b("arrow-offset-x", "var(--arrow-x)"),
    transformOrigin: [b("valid-offset-x", Yg), `var(--arrow-y, ${Yg})`].join(" ")
  };
  return [
    {
      [o]: {
        ...jr(e),
        position: "absolute",
        zIndex: p,
        display: "block",
        width: "max-content",
        maxWidth: i,
        visibility: "visible",
        filter: m,
        ...N,
        "&-hidden": {
          display: "none"
        },
        [C("arrow-background-color")]: c,
        // Wrapper for the tooltip content
        [`${o}-container`]: [R, Ub(e, !0)],
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
            borderRadius: e.min(f, av)
          }
        },
        [`${o}-content`]: {
          position: "relative"
        },
        // generator for preset color
        ...JC(e, (T, {
          darkColor: L
        }) => ({
          [`&${o}-${T}`]: {
            [`${o}-container`]: {
              backgroundColor: L
            },
            [`${o}-arrow`]: {
              [C("arrow-background-color")]: L
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
    C$(e, b("arrow-background-color"), {
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
        ...R,
        ...N,
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
}, N$ = (e) => ({
  zIndexPopup: e.zIndexPopupBase + 70,
  maxWidth: 250,
  ...cv({
    contentRadius: e.borderRadius,
    limitVerticalRadius: !0
  }),
  ...S$(er(e, {
    borderRadiusOuter: Math.min(e.borderRadiusOuter, 4)
  }))
}), uv = (e, n, o = !0) => Hr("Tooltip", (l) => {
  const {
    borderRadius: c,
    colorTextLightSolid: f,
    colorBgSpotlight: p,
    maxWidth: g
  } = l, m = er(l, {
    // default variables
    tooltipMaxWidth: g,
    tooltipColor: f,
    tooltipBorderRadius: c,
    tooltipBg: p
  });
  return [_$(m), rE(l, "zoom-big-fast")];
}, N$, {
  resetStyle: !1,
  // Popover use Tooltip as internal component. We do not need to handle this.
  injectStyle: o
})(e, n), k$ = Gs.map((e) => `${e}-inverse`);
function M$(e, n = !0) {
  return n ? [].concat(Ws(k$), Ws(Gs)).includes(e) : Gs.includes(e);
}
const fv = (e, n, o) => {
  const i = M$(o), [l] = nl(e, "tooltip"), c = we({
    [`${n}-${o}`]: o && i
  }), f = {}, p = {}, g = aE(o).toRgb(), v = (0.299 * g.r + 0.587 * g.g + 0.114 * g.b) / 255 < 0.5 ? "#FFF" : "#000";
  return o && !i && (f.background = o, f[l("overlay-color")] = v, p[l("arrow-background-color")] = o), {
    className: c,
    overlayStyle: f,
    arrowStyle: p
  };
}, T$ = (e) => {
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
  } = h.useContext(On), v = m("tooltip", n), y = m(), w = Vd(v), [x, E] = uv(v, w), C = fv(y, v, c), b = C.arrowStyle, $ = h.useMemo(() => ({
    container: {
      ...f,
      ...C.overlayStyle
    }
  }), [f, C.overlayStyle]), _ = {
    ...e,
    placement: i
  }, [R, N] = ol([p], [$, g], {
    props: _
  }), T = we(w, x, E, v, `${v}-pure`, `${v}-placement-${i}`, o, C.className);
  return /* @__PURE__ */ h.createElement("div", {
    className: T,
    style: b
  }, /* @__PURE__ */ h.createElement("div", {
    className: `${v}-arrow`
  }), /* @__PURE__ */ h.createElement(lv, {
    ...e,
    className: x,
    prefixCls: v,
    classNames: R,
    styles: N
  }, l));
}, I$ = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    prefixCls: o,
    openClassName: i,
    getTooltipContainer: l,
    color: c,
    children: f,
    afterOpenChange: p,
    arrow: g,
    destroyTooltipOnHide: m,
    destroyOnHidden: v,
    title: y,
    overlay: w,
    trigger: x,
    builtinPlacements: E,
    autoAdjustOverflow: C = !0,
    motion: b,
    getPopupContainer: $,
    placement: _ = "top",
    mouseEnterDelay: R = 0.1,
    mouseLeaveDelay: N = 0.1,
    rootClassName: T,
    styles: L,
    classNames: F,
    onOpenChange: A,
    // Legacy
    overlayInnerStyle: H,
    overlayStyle: Y,
    overlayClassName: V,
    ...X
  } = e, [, Q] = tl(), oe = e["data-popover-inject"], {
    getPopupContainer: G,
    getPrefixCls: le,
    direction: he,
    ...j
  } = Xo("tooltip"), {
    className: J,
    style: U,
    classNames: k,
    styles: O,
    arrow: ee,
    trigger: te
  } = oe ? {} : j, se = R$(g, ee), re = se.show, fe = x || te || "hover", ie = $ || G, Z = v ?? !!m, ae = h.useContext(P$), ce = h.useRef(null), ke = () => {
    ce.current?.forceAlign();
  };
  h.useImperativeHandle(n, () => ({
    forceAlign: ke,
    nativeElement: ce.current?.nativeElement,
    popupElement: ce.current?.popupElement
  }));
  const [qe, Qe] = js(e.defaultOpen ?? !1, e.open), _e = !y && !w && y !== 0, Xe = (nt) => {
    Qe(_e ? !1 : nt), !_e && A && A(nt);
  }, ut = h.useMemo(() => E || $$({
    arrowPointAtCenter: se?.pointAtCenter ?? !1,
    autoAdjustOverflow: C,
    arrowWidth: re ? Q.sizePopupArrow : 0,
    borderRadius: Q.borderRadius,
    offset: Q.marginXXS
  }), [se, E, Q, re, C]), Ae = h.useMemo(() => y === 0 ? y : w || y || "", [w, y]), Ct = /* @__PURE__ */ h.createElement(iv, {
    space: !0,
    form: !0
  }, Bi(Ae) ? Ae() : Ae), Ze = {
    ...e,
    trigger: fe,
    builtinPlacements: ut,
    getPopupContainer: ie,
    destroyOnHidden: Z
  }, [tt, He] = ol([k, F], [O, L], {
    props: Ze
  }), Je = le("tooltip", o), ft = le();
  let fn = qe;
  (!("open" in e) && _e || ae) && (fn = !1);
  const _t = /* @__PURE__ */ h.isValidElement(f) && !wb(f) ? f : /* @__PURE__ */ h.createElement("span", null, f), Wt = _t.props, Ut = !Wt.className || typeof Wt.className == "string" ? we(Wt.className, i || `${Je}-open`) : Wt.className, Nt = Vd(Je), [mt, kt] = uv(Je, Nt, !oe), Ue = fv(ft, Je, c), Yt = Ue.arrowStyle, Ve = we(Nt, mt, kt), Le = we(V, {
    [`${Je}-rtl`]: he === "rtl"
  }, Ue.className, T, Ve, J, tt.root), [Oe, Ge] = Ab("Tooltip", X.zIndex), gt = {
    ...He.container,
    ...H,
    ...Ue.overlayStyle
  }, qt = /* @__PURE__ */ h.createElement(v$, {
    unique: !0,
    ...X,
    zIndex: Oe,
    showArrow: re,
    placement: _,
    mouseEnterDelay: R,
    mouseLeaveDelay: N,
    prefixCls: Je,
    classNames: {
      root: Le,
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
    overlay: Ct,
    visible: fn,
    onVisibleChange: Xe,
    afterVisibleChange: p,
    arrowContent: /* @__PURE__ */ h.createElement("span", {
      className: `${Je}-arrow-content`
    }),
    motion: {
      motionName: Lb(ft, "zoom-big-fast", typeof b?.motionName == "string" ? b?.motionName : void 0),
      motionDeadline: 1e3
    },
    trigger: fe,
    builtinPlacements: ut,
    getTooltipContainer: ie,
    destroyOnHidden: Z
  }, fn ? Xy(_t, {
    className: Ut
  }) : _t);
  return /* @__PURE__ */ h.createElement(Ky.Provider, {
    value: Ge
  }, qt);
}), Fi = I$;
Fi._InternalPanelDoNotUseOrYouWillBeFired = T$;
Fi.UniqueProvider = Gy;
function qd(e) {
  return er(e, {
    inputAffixPadding: e.paddingXXS
  });
}
const Xd = (e) => {
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
    controlPaddingHorizontalSM: v,
    controlPaddingHorizontal: y,
    colorFillAlter: w,
    colorPrimaryHover: x,
    colorPrimary: E,
    controlOutlineWidth: C,
    controlOutline: b,
    colorErrorOutline: $,
    colorWarningOutline: _,
    colorBgContainer: R,
    inputFontSize: N,
    inputFontSizeLG: T,
    inputFontSizeSM: L
  } = e, F = N || o, A = L || F, H = T || p, Y = Math.round((n - F * i) / 2 * 10) / 10 - l, V = Math.round((c - A * i) / 2 * 10) / 10 - l, X = Math.ceil((f - H * g) / 2 * 10) / 10 - l;
  return {
    paddingBlock: Math.max(Y, 0),
    paddingBlockSM: Math.max(V, 0),
    paddingBlockLG: Math.max(X, 0),
    paddingInline: m - l,
    paddingInlineSM: v - l,
    paddingInlineLG: y - l,
    addonBg: w,
    activeBorderColor: E,
    hoverBorderColor: x,
    activeShadow: `0 0 0 ${C}px ${b}`,
    errorActiveShadow: `0 0 0 ${C}px ${$}`,
    warningActiveShadow: `0 0 0 ${C}px ${_}`,
    hoverBg: R,
    activeBg: R,
    inputFontSize: F,
    inputFontSizeLG: H,
    inputFontSizeSM: A
  };
}, F$ = (e) => ({
  borderColor: e.hoverBorderColor,
  backgroundColor: e.hoverBg
}), Gd = (e) => ({
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
    ...F$(er(e, {
      hoverBorderColor: e.colorBorderDisabled,
      hoverBg: e.colorBgContainerDisabled
    }))
  }
}), dv = (e, n) => ({
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
}), Kg = (e, n) => ({
  [`&${e.componentCls}-status-${n.status}:not(${e.componentCls}-disabled)`]: {
    ...dv(e, n),
    [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
      color: n.affixColor
    }
  },
  [`&${e.componentCls}-status-${n.status}${e.componentCls}-disabled`]: {
    borderColor: n.borderColor
  }
}), pv = (e, n) => ({
  "&-outlined": {
    ...dv(e, {
      borderColor: e.colorBorder,
      hoverBorderColor: e.hoverBorderColor,
      activeBorderColor: e.activeBorderColor,
      activeShadow: e.activeShadow
    }),
    [`&${e.componentCls}-disabled, &[disabled]`]: {
      ...Gd(e)
    },
    ...Kg(e, {
      status: "error",
      borderColor: e.colorError,
      hoverBorderColor: e.colorErrorBorderHover,
      activeBorderColor: e.colorError,
      activeShadow: e.errorActiveShadow,
      affixColor: e.colorErrorAffix
    }),
    ...Kg(e, {
      status: "warning",
      borderColor: e.colorWarning,
      hoverBorderColor: e.colorWarningBorderHover,
      activeBorderColor: e.colorWarning,
      activeShadow: e.warningActiveShadow,
      affixColor: e.colorWarningAffix
    }),
    ...n
  }
}), Qg = (e, n) => ({
  [`&${e.componentCls}-group-wrapper-status-${n.status}`]: {
    [`${e.componentCls}-group-addon`]: {
      borderColor: n.addonBorderColor,
      color: n.addonColor
    }
  }
}), O$ = (e) => ({
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
    ...Qg(e, {
      status: "error",
      addonBorderColor: e.colorError,
      addonColor: e.colorErrorText
    }),
    ...Qg(e, {
      status: "warning",
      addonBorderColor: e.colorWarning,
      addonColor: e.colorWarningText
    }),
    [`&${e.componentCls}-group-wrapper-disabled`]: {
      [`${e.componentCls}-group-addon`]: {
        ...Gd(e)
      }
    }
  }
}), hv = "&:focus-visible, &:has(input:focus-visible), &:has(textarea:focus-visible)", mv = (e, n) => ({
  outline: `${$e(e.lineWidth)} ${e.lineType} ${n}`,
  outlineOffset: $e(e.calc(e.lineWidth).mul(-1).equal()),
  transition: ["outline-offset", "outline"].map((o) => `${o} 0s`).join(", ")
}), Zg = (e, n) => ({
  "&, & input, & textarea": {
    color: n.color
  },
  [hv]: mv(e, n.color),
  [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
    color: n.affixColor
  }
}), gv = (e, n) => {
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
      [hv]: mv(e, e.activeBorderColor),
      // >>>>> Disabled
      [`&${o}-disabled, &[disabled]`]: {
        color: e.colorTextDisabled,
        cursor: "not-allowed"
      },
      // >>>>> Status
      [`&${o}-status-error`]: Zg(e, {
        color: e.colorError,
        affixColor: e.colorErrorAffix
      }),
      [`&${o}-status-warning`]: Zg(e, {
        color: e.colorWarning,
        affixColor: e.colorWarningAffix
      }),
      ...n
    }
  };
}, yv = (e, n) => ({
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
}), Jg = (e, n) => ({
  [`&${e.componentCls}-status-${n.status}:not(${e.componentCls}-disabled)`]: {
    ...yv(e, n),
    [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
      color: n.affixColor
    }
  }
}), vv = (e, n) => ({
  "&-filled": {
    ...yv(e, {
      bg: e.colorFillTertiary,
      hoverBg: e.colorFillSecondary,
      activeBorderColor: e.activeBorderColor,
      inputColor: e.colorText
    }),
    [`&${e.componentCls}-disabled, &[disabled]`]: {
      ...Gd(e)
    },
    ...Jg(e, {
      status: "error",
      bg: e.colorErrorBg,
      hoverBg: e.colorErrorBgHover,
      activeBorderColor: e.colorError,
      inputColor: e.colorErrorText,
      affixColor: e.colorErrorAffix
    }),
    ...Jg(e, {
      status: "warning",
      bg: e.colorWarningBg,
      hoverBg: e.colorWarningBgHover,
      activeBorderColor: e.colorWarning,
      inputColor: e.colorWarningText,
      affixColor: e.colorWarningAffix
    }),
    ...n
  }
}), e0 = (e, n) => ({
  [`&${e.componentCls}-group-wrapper-status-${n.status}`]: {
    [`${e.componentCls}-group-addon`]: {
      background: n.addonBg,
      color: n.addonColor
    }
  }
}), A$ = (e) => ({
  "&-filled": {
    [`${e.componentCls}-group-addon`]: {
      background: e.colorFillTertiary,
      "&:last-child": {
        position: "static"
      }
    },
    ...e0(e, {
      status: "error",
      addonBg: e.colorErrorBg,
      addonColor: e.colorErrorText
    }),
    ...e0(e, {
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
}), Sv = (e, n) => ({
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
}), t0 = (e, n) => ({
  [`&${e.componentCls}-status-${n.status}:not(${e.componentCls}-disabled)`]: {
    ...Sv(e, n),
    [`${e.componentCls}-prefix, ${e.componentCls}-suffix`]: {
      color: n.affixColor
    }
  },
  [`&${e.componentCls}-status-${n.status}${e.componentCls}-disabled`]: {
    borderColor: `transparent transparent ${n.borderColor} transparent`
  }
}), wv = (e, n) => ({
  "&-underlined": {
    ...Sv(e, {
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
    ...t0(e, {
      status: "error",
      borderColor: e.colorError,
      hoverBorderColor: e.colorErrorBorderHover,
      activeBorderColor: e.colorError,
      activeShadow: e.errorActiveShadow,
      affixColor: e.colorErrorAffix
    }),
    ...t0(e, {
      status: "warning",
      borderColor: e.colorWarning,
      hoverBorderColor: e.colorWarningBorderHover,
      activeBorderColor: e.colorWarning,
      activeShadow: e.warningActiveShadow,
      affixColor: e.colorWarningAffix
    }),
    ...n
  }
}), Cv = (e) => ({
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
}), xv = (e) => {
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
}, bv = (e) => ({
  padding: `${$e(e.paddingBlockSM)} ${$e(e.paddingInlineSM)}`,
  fontSize: e.inputFontSizeSM,
  borderRadius: e.borderRadiusSM
}), Yd = (e, n = {}) => ({
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
  ...Cv(e.colorTextPlaceholder),
  // Size
  "&-lg": {
    ...xv(e),
    ...n.largeStyle
  },
  "&-sm": {
    ...bv(e),
    ...n.smallStyle
  },
  // RTL
  "&-rtl, &-textarea-rtl": {
    direction: "rtl"
  }
}), L$ = (e) => {
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
      ...xv(e)
    },
    [`&-sm ${n}, &-sm > ${n}-group-addon`]: {
      ...bv(e)
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
      ...KC(),
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
}, z$ = (e) => {
  const {
    componentCls: n,
    controlHeightSM: o,
    lineWidth: i,
    calc: l
  } = e, f = l(o).sub(l(i).mul(2)).sub(16).div(2).equal();
  return {
    [n]: {
      ...jr(e),
      ...Yd(e),
      // Variants
      ...pv(e),
      ...vv(e),
      ...gv(e),
      ...wv(e),
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
}, B$ = (e) => {
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
        ...zd(e)
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
}, D$ = (e) => {
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
      ...Yd(e),
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
      ...B$(e)
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
}, j$ = (e) => {
  const {
    componentCls: n,
    borderRadiusLG: o,
    borderRadiusSM: i
  } = e;
  return {
    [`${n}-group`]: {
      // Style for input-group: input with label, with button or dropdown...
      ...jr(e),
      ...L$(e),
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
        ...O$(e),
        ...A$(e),
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
}, H$ = (e) => {
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
Hr(["Input", "Shared"], (e) => {
  const n = er(e, qd(e));
  return [z$(n), D$(n)];
}, Xd, {
  resetFont: !1
});
Hr(["Input", "Component"], (e) => {
  const n = er(e, qd(e));
  return [
    j$(n),
    H$(n),
    // =====================================================
    // ==             Space Compact                       ==
    // =====================================================
    Ud(n, {
      focus: !0,
      focusElCls: `${n.componentCls}-affix-wrapper-focused`
    })
  ];
}, Xd, {
  resetFont: !1
});
var $a = {}, n0;
function V$() {
  if (n0) return $a;
  n0 = 1, Object.defineProperty($a, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M482 152h60q8 0 8 8v704q0 8-8 8h-60q-8 0-8-8V160q0-8 8-8z" } }, { tag: "path", attrs: { d: "M192 474h672q8 0 8 8v60q0 8-8 8H160q-8 0-8-8v-60q0-8 8-8z" } }] }, name: "plus", theme: "outlined" };
  return $a.default = e, $a;
}
var W$ = /* @__PURE__ */ V$();
const U$ = /* @__PURE__ */ Jn(W$);
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
const q$ = (e, n) => /* @__PURE__ */ h.createElement(Er, hd({}, e, {
  ref: n,
  icon: U$
})), X$ = /* @__PURE__ */ h.forwardRef(q$), r0 = (e, n) => {
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
}, xr = (e) => e !== void 0 ? `${e}px` : void 0;
function G$(e) {
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
  } = e, v = h.useRef(null), [y, w] = h.useState(i), x = (F) => {
    const A = l(F), H = o.current?.querySelectorAll(`.${n}-item`)[A];
    return H?.offsetParent && H;
  }, [E, C] = h.useState(null), [b, $] = h.useState(null);
  un(() => {
    if (y !== i) {
      const F = x(y), A = x(i), H = r0(F, m), Y = r0(A, m);
      w(i), C(H), $(Y), F && A ? f() : p();
    }
  }, [i]);
  const _ = h.useMemo(() => xr(m ? E?.top ?? 0 : g === "rtl" ? -E?.right : E?.left), [m, g, E]), R = h.useMemo(() => xr(m ? b?.top ?? 0 : g === "rtl" ? -b?.right : b?.left), [m, g, b]), N = () => m ? {
    transform: "translateY(var(--thumb-start-top))",
    height: "var(--thumb-start-height)"
  } : {
    transform: "translateX(var(--thumb-start-left))",
    width: "var(--thumb-start-width)"
  }, T = () => m ? {
    transform: "translateY(var(--thumb-active-top))",
    height: "var(--thumb-active-height)"
  } : {
    transform: "translateX(var(--thumb-active-left))",
    width: "var(--thumb-active-width)"
  }, L = () => {
    C(null), $(null), p();
  };
  return !E || !b ? null : /* @__PURE__ */ h.createElement(rl, {
    visible: !0,
    motionName: c,
    motionAppear: !0,
    onAppearStart: N,
    onAppearActive: T,
    onVisibleChanged: L
  }, ({
    className: F,
    style: A
  }, H) => {
    const Y = {
      ...A,
      "--thumb-start-left": _,
      "--thumb-start-width": xr(E?.width),
      "--thumb-active-left": R,
      "--thumb-active-width": xr(b?.width),
      "--thumb-start-top": _,
      "--thumb-start-height": xr(E?.height),
      "--thumb-active-top": R,
      "--thumb-active-height": xr(b?.height)
    }, V = {
      ref: Js(v, H),
      style: Y,
      className: we(`${n}-thumb`, F)
    };
    return /* @__PURE__ */ h.createElement("div", V);
  });
}
function Y$(e) {
  if (typeof e.title < "u")
    return e.title;
  if (typeof e.label != "object")
    return e.label?.toString();
}
function K$(e) {
  return e.map((n) => {
    if (typeof n == "object" && n !== null) {
      const o = Y$(n);
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
const Q$ = ({
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
  value: v,
  name: y,
  onChange: w,
  onFocus: x,
  onBlur: E,
  onKeyDown: C,
  onKeyUp: b,
  onMouseDown: $,
  itemRender: _ = (R) => R
}) => {
  const R = (T) => {
    f || w(T, v);
  }, N = /* @__PURE__ */ h.createElement("label", {
    className: we(n, {
      [`${e}-item-disabled`]: f
    }),
    style: o,
    onMouseDown: $
  }, /* @__PURE__ */ h.createElement("input", {
    name: y,
    className: `${e}-item-input`,
    type: "radio",
    disabled: f,
    checked: p,
    onChange: R,
    onFocus: x,
    onBlur: E,
    onKeyDown: C,
    onKeyUp: b
  }), /* @__PURE__ */ h.createElement("div", {
    className: we(`${e}-item-label`, l?.label),
    title: m,
    style: i?.label
  }, g));
  return _(N, {
    item: c
  });
}, Z$ = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    prefixCls: o = "rc-segmented",
    direction: i,
    vertical: l,
    options: c = [],
    disabled: f,
    defaultValue: p,
    value: g,
    name: m,
    onChange: v,
    className: y = "",
    style: w,
    styles: x,
    classNames: E,
    motionName: C = "thumb-motion",
    itemRender: b,
    ...$
  } = e, _ = h.useRef(null), R = h.useMemo(() => Js(_, n), [_, n]), N = h.useMemo(() => K$(c), [c]), [T, L] = js(p ?? N[0]?.value, g), [F, A] = h.useState(!1), H = (O, ee) => {
    L(ee), v?.(ee);
  }, Y = La($, ["children"]), [V, X] = h.useState(!1), [Q, oe] = h.useState(!1), G = () => {
    oe(!0);
  }, le = () => {
    oe(!1);
  }, he = () => {
    X(!1);
  }, j = (O) => {
    O.key === "Tab" && X(!0);
  }, J = (O) => {
    const ee = N.findIndex((fe) => fe.value === T), te = N.length, se = (ee + O + te) % te, re = N[se];
    re && (L(re.value), v?.(re.value));
  }, U = (O) => {
    switch (O.key) {
      case "ArrowLeft":
      case "ArrowUp":
        J(-1);
        break;
      case "ArrowRight":
      case "ArrowDown":
        J(1);
        break;
    }
  }, k = (O) => {
    const {
      value: ee,
      disabled: te
    } = O;
    return /* @__PURE__ */ h.createElement(Q$, Wa({}, O, {
      name: m,
      data: O,
      itemRender: b,
      key: ee,
      prefixCls: o,
      className: we(O.className, `${o}-item`, E?.item, {
        [`${o}-item-selected`]: ee === T && !F,
        [`${o}-item-focused`]: Q && V && ee === T
      }),
      style: x?.item,
      classNames: E,
      styles: x,
      checked: ee === T,
      onChange: H,
      onFocus: G,
      onBlur: le,
      onKeyDown: U,
      onKeyUp: j,
      onMouseDown: he,
      disabled: !!f || !!te
    }));
  };
  return /* @__PURE__ */ h.createElement("div", Wa({
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
    }, y),
    ref: R
  }), /* @__PURE__ */ h.createElement("div", {
    className: `${o}-group`
  }, /* @__PURE__ */ h.createElement(G$, {
    vertical: l,
    prefixCls: o,
    value: T,
    containerRef: _,
    motionName: `${o}-${C}`,
    direction: i,
    getValueIndex: (O) => N.findIndex((ee) => ee.value === O),
    onMotionStart: () => {
      A(!0);
    },
    onMotionEnd: () => {
      A(!1);
    }
  }), N.map(k)));
}), J$ = Z$;
function o0(e, n) {
  return {
    [`${e}, ${e}:hover, ${e}:focus`]: {
      color: n.colorTextDisabled,
      cursor: "not-allowed"
    }
  };
}
const i0 = (e) => ({
  background: e.itemSelectedBg,
  boxShadow: e.boxShadowTertiary
}), e2 = {
  overflow: "hidden",
  // handle text ellipsis
  ...GC
}, t2 = (e) => {
  const {
    componentCls: n,
    motionDurationSlow: o,
    motionEaseInOut: i,
    motionDurationMid: l
  } = e, c = e.calc(e.controlHeight).sub(e.calc(e.trackPadding).mul(2)).equal(), f = e.calc(e.controlHeightLG).sub(e.calc(e.trackPadding).mul(2)).equal(), p = e.calc(e.controlHeightSM).sub(e.calc(e.trackPadding).mul(2)).equal();
  return {
    [n]: {
      ...jr(e),
      display: "inline-block",
      padding: e.trackPadding,
      color: e.itemColor,
      background: e.trackBg,
      borderRadius: e.borderRadius,
      transition: `all ${l}`,
      ...wy(e),
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
          ...i0(e),
          color: e.itemSelectedColor
        },
        "&-focused": zd(e),
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
          ...e2
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
        ...i0(e),
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
      ...o0(`&-disabled ${n}-item`, e),
      ...o0(`${n}-item-disabled`, e),
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
}, n2 = (e) => {
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
}, r2 = Hr("Segmented", (e) => {
  const {
    lineWidth: n,
    calc: o
  } = e, i = er(e, {
    segmentedPaddingHorizontal: o(e.controlPaddingHorizontal).sub(n).equal(),
    segmentedPaddingHorizontalSM: o(e.controlPaddingHorizontalSM).sub(n).equal()
  });
  return t2(i);
}, n2);
function o2(e) {
  return Vr(e) && !!e?.icon;
}
const i2 = /* @__PURE__ */ h.forwardRef((e, n) => {
  const o = Zs(), {
    prefixCls: i,
    className: l,
    rootClassName: c,
    block: f,
    options: p = [],
    size: g,
    style: m,
    vertical: v,
    orientation: y,
    shape: w = "default",
    name: x = o,
    styles: E,
    classNames: C,
    ...b
  } = e, {
    getPrefixCls: $,
    direction: _,
    className: R,
    style: N,
    classNames: T,
    styles: L
  } = Xo("segmented"), F = {
    ...e,
    options: p,
    size: g,
    shape: w
  }, A = Mi(N), H = Mi(m), [Y, V] = ol([T, C], [L, A, E, H], {
    props: F
  }), X = $("segmented", i), [Q, oe] = r2(X), G = oc(g), le = h.useMemo(() => p.map((U) => {
    if (o2(U)) {
      const {
        icon: k,
        label: O,
        ...ee
      } = U;
      return {
        ...ee,
        label: /* @__PURE__ */ h.createElement(h.Fragment, null, /* @__PURE__ */ h.createElement("span", {
          className: we(`${X}-item-icon`, Y.icon),
          style: V.icon
        }, k), O && /* @__PURE__ */ h.createElement("span", null, O))
      };
    }
    return U;
  }), [p, X, Y.icon, V.icon]), [, he] = Yy(y, v), j = we(l, c, R, Y.root, {
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
    const O = Vr(k.tooltip) ? k.tooltip : {
      title: k.tooltip
    };
    return /* @__PURE__ */ h.createElement(Fi, {
      ...O
    }, U);
  };
  return /* @__PURE__ */ h.createElement(J$, {
    ...b,
    name: x,
    className: j,
    style: V.root,
    classNames: Y,
    styles: V,
    itemRender: J,
    options: le,
    ref: n,
    prefixCls: X,
    direction: _,
    vertical: he
  });
}), s2 = i2;
var Pa = {}, s0;
function l2() {
  if (s0) return Pa;
  s0 = 1, Object.defineProperty(Pa, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M872 474H152c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h720c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8z" } }] }, name: "minus", theme: "outlined" };
  return Pa.default = e, Pa;
}
var a2 = /* @__PURE__ */ l2();
const c2 = /* @__PURE__ */ Jn(a2);
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
const u2 = (e, n) => /* @__PURE__ */ h.createElement(Er, md({}, e, {
  ref: n,
  icon: c2
})), f2 = /* @__PURE__ */ h.forwardRef(u2);
var Ra = {}, l0;
function d2() {
  if (l0) return Ra;
  l0 = 1, Object.defineProperty(Ra, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M890.5 755.3L537.9 269.2c-12.8-17.6-39-17.6-51.7 0L133.5 755.3A8 8 0 00140 768h75c5.1 0 9.9-2.5 12.9-6.6L512 369.8l284.1 391.6c3 4.1 7.8 6.6 12.9 6.6h75c6.5 0 10.3-7.4 6.5-12.7z" } }] }, name: "up", theme: "outlined" };
  return Ra.default = e, Ra;
}
var p2 = /* @__PURE__ */ d2();
const h2 = /* @__PURE__ */ Jn(p2);
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
const m2 = (e, n) => /* @__PURE__ */ h.createElement(Er, gd({}, e, {
  ref: n,
  icon: h2
})), g2 = /* @__PURE__ */ h.forwardRef(m2);
function yd() {
  return typeof BigInt == "function";
}
function Ev(e) {
  return !e && e !== 0 && !Number.isNaN(e) || !String(e).trim();
}
function Vo(e) {
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
function sc(e) {
  var n = String(e);
  return !Number.isNaN(Number(n)) && n.includes("e");
}
function $v(e) {
  var n = e.toLowerCase().split("e"), o = Ba(n, 2), i = o[0], l = o[1], c = l === void 0 ? "0" : l, f = i.startsWith("-"), p = f ? i.slice(1) : i, g = p.split("."), m = Ba(g, 2), v = m[0], y = v === void 0 ? "0" : v, w = m[1], x = w === void 0 ? "" : w, E = "".concat(y).concat(x).replace(/^0+/, "") || "0";
  return {
    decimal: x,
    digits: E,
    exponent: Number(c),
    integer: y,
    negative: f
  };
}
function y2(e) {
  var n = e.decimal, o = e.digits, i = e.exponent, l = e.integer, c = e.negative;
  if (o === "0")
    return "0";
  var f = l.replace(/^0+/, "").length, p = (n.match(/^0*/) || [""])[0].length, g = f || -p, m = g + i, v = "";
  return m <= 0 ? v = "0.".concat("0".repeat(-m)).concat(o) : m >= o.length ? v = "".concat(o).concat("0".repeat(m - o.length)) : v = "".concat(o.slice(0, m), ".").concat(o.slice(m)), "".concat(c ? "-" : "").concat(v);
}
function Pv(e) {
  return e.exponent >= 0 ? Math.max(0, e.decimal.length - e.exponent) : Math.abs(e.exponent) + e.decimal.length;
}
function Lo(e) {
  var n = String(e);
  return sc(e) ? Pv($v(n)) : n.includes(".") && Kd(n) ? n.length - n.indexOf(".") - 1 : 0;
}
function lc(e) {
  var n = String(e);
  if (sc(e)) {
    if (e > Number.MAX_SAFE_INTEGER)
      return String(yd() ? BigInt(e).toString() : Number.MAX_SAFE_INTEGER);
    if (e < Number.MIN_SAFE_INTEGER)
      return String(yd() ? BigInt(e).toString() : Number.MIN_SAFE_INTEGER);
    var o = $v(n), i = Pv(o);
    n = i > 100 ? y2(o) : e.toFixed(i);
  }
  return Vo(n).fullStr;
}
function Kd(e) {
  return typeof e == "number" ? !Number.isNaN(e) : e ? (
    // Normal type: 11.28
    /^\s*-?\d+(\.\d+)?\s*$/.test(e) || // Pre-number: 1.
    /^\s*-?\d+\.\s*$/.test(e) || // Post-number: .1
    /^\s*-?\.\d+\s*$/.test(e)
  ) : !1;
}
var v2 = /* @__PURE__ */ (function() {
  function e(n) {
    if (Li(this, e), $t(this, "origin", ""), $t(this, "negative", void 0), $t(this, "integer", void 0), $t(this, "decimal", void 0), $t(this, "decimalLen", void 0), $t(this, "empty", void 0), $t(this, "nan", void 0), Ev(n)) {
      this.empty = !0;
      return;
    }
    if (this.origin = String(n), n === "-" || Number.isNaN(n)) {
      this.nan = !0;
      return;
    }
    var o = n;
    if (sc(o) && (o = Number(o)), o = typeof o == "string" ? o : lc(o), Kd(o)) {
      var i = Vo(o);
      this.negative = i.negative;
      var l = i.trimStr.split(".");
      this.integer = BigInt(l[0]);
      var c = l[1] || "0";
      this.decimal = BigInt(c), this.decimalLen = c.length;
    } else
      this.nan = !0;
  }
  return zi(e, [{
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
      var c = Math.max(this.getDecimalStr().length, o.getDecimalStr().length), f = this.alignDecimal(c), p = o.alignDecimal(c), g = i(f, p).toString(), m = l(c), v = Vo(g), y = v.negativeStr, w = v.trimStr, x = "".concat(y).concat(w.padStart(m + 1, "0"));
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
      return o ? this.isInvalidate() ? "" : Vo("".concat(this.getMark()).concat(this.getIntegerStr(), ".").concat(this.getDecimalStr())).fullStr : this.origin;
    }
  }]), e;
})(), S2 = /* @__PURE__ */ (function() {
  function e(n) {
    if (Li(this, e), $t(this, "origin", ""), $t(this, "number", void 0), $t(this, "empty", void 0), Ev(n)) {
      this.empty = !0;
      return;
    }
    this.origin = String(n), this.number = Number(n);
  }
  return zi(e, [{
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
      var c = Math.max(Lo(this.number), Lo(i));
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
      var c = Math.max(Lo(this.number), Lo(i));
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
      return o ? this.isInvalidate() ? "" : sc(this.number) && Lo(this.number) > 100 ? String(this.number) : lc(this.number) : this.origin;
    }
  }]), e;
})();
function cr(e) {
  return yd() ? new v2(e) : new S2(e);
}
function Oa(e, n, o) {
  var i = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : !1;
  if (e === "")
    return "";
  var l = Vo(e), c = l.negativeStr, f = l.integerStr, p = l.decimalStr, g = "".concat(n).concat(p), m = "".concat(c).concat(f);
  if (o >= 0) {
    var v = Number(p[o]);
    if (v >= 5 && !i) {
      var y = cr(e).add("".concat(c, "0.").concat("0".repeat(o)).concat(10 - v));
      return Oa(y.toString(), n, o, i);
    }
    return o === 0 ? m : "".concat(m).concat(n).concat(p.padEnd(o, "0").slice(0, o));
  }
  return g === ".0" ? m : "".concat(m).concat(g);
}
function w2(e, n) {
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
          const v = f[g - 1], y = c.indexOf(v, g - 1);
          y !== -1 && (m = y + 1);
        }
        e.setSelectionRange(m, m);
      } catch (c) {
        Fn(!1, `Something warning of cursor restore. Please fire issue about this: ${c.message}`);
      }
  }
  return [i, l];
}
const C2 = 200, x2 = 600;
function a0({
  prefixCls: e,
  action: n,
  children: o,
  disabled: i,
  className: l,
  style: c,
  onStep: f
}) {
  const p = n === "up", g = h.useRef(), m = h.useRef([]), v = () => {
    clearTimeout(g.current);
  }, y = (C) => {
    C.preventDefault(), v(), f(p, "handler");
    function b() {
      f(p, "handler"), g.current = setTimeout(b, C2);
    }
    g.current = setTimeout(b, x2);
  };
  h.useEffect(() => () => {
    v(), m.current.forEach((C) => {
      go.cancel(C);
    });
  }, []);
  const w = `${e}-action`, x = we(w, `${w}-${n}`, {
    [`${w}-${n}-disabled`]: i
  }, l), E = () => m.current.push(go(v));
  return /* @__PURE__ */ h.createElement("span", {
    unselectable: "on",
    role: "button",
    onMouseUp: E,
    onMouseLeave: E,
    onMouseDown: (C) => {
      y(C);
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
function c0(e) {
  const n = typeof e == "number" ? lc(e) : Vo(e).fullStr;
  return n.includes(".") ? Vo(n.replace(/(\d)\.(\d)/g, "$1$2.")).fullStr : e + "0";
}
const b2 = (() => {
  const e = h.useRef(0), n = () => {
    go.cancel(e.current);
  };
  return h.useEffect(() => n, []), (o) => {
    n(), e.current = go(() => {
      o();
    });
  };
});
function Ds() {
  return Ds = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, Ds.apply(this, arguments);
}
const u0 = (e, n) => e || n.isEmpty() ? n.toString() : n.toNumber(), f0 = (e) => {
  const n = cr(e);
  return n.isInvalidate() ? null : n;
}, E2 = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    mode: o = "input",
    prefixCls: i = "rc-input-number",
    className: l,
    style: c,
    classNames: f,
    styles: p,
    min: g,
    max: m,
    step: v = 1,
    defaultValue: y,
    value: w,
    disabled: x,
    readOnly: E,
    upHandler: C,
    downHandler: b,
    keyboard: $,
    changeOnWheel: _ = !1,
    controls: R = !0,
    prefix: N,
    suffix: T,
    stringMode: L,
    parser: F,
    formatter: A,
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
    changeOnBlur: O = !0,
    ...ee
  } = e, [te, se] = h.useState(!1), re = h.useRef(!1), fe = h.useRef(!1), ie = h.useRef(!1), Z = h.useRef(null), ae = h.useRef(null);
  h.useImperativeHandle(n, () => QS(ae.current, {
    focus: (de) => {
      OS(ae.current, de);
    },
    blur: () => {
      ae.current?.blur();
    },
    nativeElement: Z.current
  }));
  const [ce, ke] = h.useState(() => cr(w ?? y));
  function qe(de) {
    w === void 0 && ke(de);
  }
  const Qe = h.useCallback((de, Ee) => {
    if (!Ee)
      return H >= 0 ? H : Math.max(Lo(de), Lo(v));
  }, [H, v]), _e = h.useCallback((de) => {
    const Ee = String(de);
    if (F)
      return F(Ee);
    let Ce = Ee;
    return Y && (Ce = Ce.replace(Y, ".")), Ce.replace(/[^\w.-]+/g, "");
  }, [F, Y]), Xe = h.useRef(""), ut = h.useCallback((de, Ee) => {
    if (A)
      return A(de, {
        userTyping: Ee,
        input: String(Xe.current)
      });
    let Ce = typeof de == "number" ? lc(de) : de;
    if (!Ee) {
      const bt = Qe(Ce, Ee);
      Kd(Ce) && (Y || bt >= 0) && (Ce = Oa(Ce, Y || ".", bt));
    }
    return Ce;
  }, [A, Qe, Y]), [Ae, Ct] = h.useState(() => {
    const de = y ?? w;
    return ce.isInvalidate() && ["string", "number"].includes(typeof de) ? Number.isNaN(de) ? "" : de : ut(ce.toString(), !1);
  });
  Xe.current = Ae;
  function Ze(de, Ee) {
    Ct(ut(
      // Invalidate number is sometime passed by external control, we should let it go
      // Otherwise is controlled by internal interactive logic which check by userTyping
      // You can ref 'show limited value when input is not focused' test for more info.
      de.isInvalidate() ? de.toString(!1) : de.toString(!Ee),
      Ee
    ));
  }
  const tt = h.useMemo(() => f0(m), [m, H]), He = h.useMemo(() => f0(g), [g, H]), Je = h.useMemo(() => !tt || !ce || ce.isInvalidate() ? !1 : tt.lessEquals(ce), [tt, ce]), ft = h.useMemo(() => !He || !ce || ce.isInvalidate() ? !1 : ce.lessEquals(He), [He, ce]), [fn, _t] = w2(ae.current, te), Wt = (de) => tt && !de.lessEquals(tt) ? tt : He && !He.lessEquals(de) ? He : null, Ut = (de) => !Wt(de), Nt = (de, Ee) => {
    let Ce = de, bt = Ut(Ce) || Ce.isEmpty();
    if (!Ce.isEmpty() && !Ee && (Ce = Wt(Ce) || Ce, bt = !0), !E && !x && bt) {
      const Qt = Ce.toString(), Tt = Qe(Qt, Ee);
      return Tt >= 0 && (Ce = cr(Oa(Qt, ".", Tt)), Ut(Ce) || (Ce = cr(Oa(Qt, ".", Tt, !0)))), Ce.equals(ce) || (qe(Ce), V?.(Ce.isEmpty() ? null : u0(L, Ce)), w === void 0 && Ze(Ce, Ee)), Ce;
    }
    return ce;
  }, mt = b2(), kt = (de) => {
    if (fn(), Xe.current = de, Ct(de), !fe.current) {
      const Ee = _e(de), Ce = cr(Ee);
      Ce.isNaN() || Nt(Ce, !0);
    }
    X?.(de), mt(() => {
      let Ee = de;
      F || (Ee = de.replace(/。/g, ".")), Ee !== de && kt(Ee);
    });
  }, Ue = () => {
    fe.current = !0;
  }, Yt = () => {
    fe.current = !1, kt(ae.current.value);
  }, Ve = (de) => {
    kt(de.target.value);
  }, Le = wt((de, Ee) => {
    if (de && Je || !de && ft)
      return;
    re.current = !1;
    let Ce = cr(ie.current ? c0(v) : v);
    de || (Ce = Ce.negate());
    const bt = (ce || cr(0)).add(Ce.toString()), Qt = Nt(bt, !1);
    oe?.(u0(L, Qt), {
      offset: ie.current ? c0(v) : v,
      type: de ? "up" : "down",
      emitter: Ee
    }), ae.current?.focus();
  }), Oe = (de) => {
    const Ee = cr(_e(Ae));
    let Ce;
    Ee.isNaN() ? Ce = Nt(ce, de) : Ce = Nt(Ee, de), w !== void 0 ? Ze(ce, !1) : Ce.isNaN() || Ze(Ce, !1);
  }, Ge = () => {
    re.current = !0;
  }, gt = (de) => {
    const {
      key: Ee,
      shiftKey: Ce
    } = de;
    re.current = !0, ie.current = Ce, Ee === "Enter" && (fe.current || (re.current = !1), Oe(!1), Q?.(de)), $ !== !1 && !fe.current && ["Up", "ArrowUp", "Down", "ArrowDown"].includes(Ee) && (Le(Ee === "Up" || Ee === "ArrowUp", "keyboard"), de.preventDefault());
  }, qt = () => {
    re.current = !1, ie.current = !1;
  };
  h.useEffect(() => {
    if (_ && te) {
      const de = (Ce) => {
        Le(Ce.deltaY < 0, "wheel"), Ce.preventDefault();
      }, Ee = ae.current;
      if (Ee)
        return Ee.addEventListener("wheel", de, {
          passive: !1
        }), () => Ee.removeEventListener("wheel", de);
    }
  });
  const nt = () => {
    O && Oe(!1), se(!1), re.current = !1;
  }, Kt = (de) => {
    ae.current && de.target !== ae.current && (ae.current.focus(), de.preventDefault()), G?.(de);
  };
  ju(() => {
    ce.isInvalidate() || Ze(ce, !1);
  }, [H, A]), ju(() => {
    const de = cr(w);
    ke(de);
    const Ee = cr(_e(Ae));
    (!de.equals(Ee) || !re.current || A) && Ze(de, re.current);
  }, [w]), ju(() => {
    A && _t();
  }, [Ae]);
  const Mt = {
    prefixCls: i,
    onStep: Le,
    className: f?.action,
    style: p?.action
  }, En = /* @__PURE__ */ h.createElement(a0, Ds({}, Mt, {
    action: "up",
    disabled: Je
  }), C), $n = /* @__PURE__ */ h.createElement(a0, Ds({}, Mt, {
    action: "down",
    disabled: ft
  }), b);
  return /* @__PURE__ */ h.createElement("div", {
    ref: Z,
    className: we(i, `${i}-mode-${o}`, l, f?.root, {
      [`${i}-focused`]: te,
      [`${i}-disabled`]: x,
      [`${i}-readonly`]: E,
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
  }, o === "spinner" && R && $n, N !== void 0 && /* @__PURE__ */ h.createElement("div", {
    className: we(`${i}-prefix`, f?.prefix),
    style: p?.prefix
  }, N), /* @__PURE__ */ h.createElement("input", Ds({
    autoComplete: "off",
    role: "spinbutton",
    "aria-valuemin": g,
    "aria-valuemax": m,
    "aria-valuenow": ce.isInvalidate() ? null : ce.toString(),
    step: v,
    ref: ae,
    className: we(`${i}-input`, f?.input),
    style: p?.input,
    value: Ae,
    onChange: Ve,
    disabled: x,
    readOnly: E
  }, ee)), T !== void 0 && /* @__PURE__ */ h.createElement("div", {
    className: we(`${i}-suffix`, f?.suffix),
    style: p?.suffix
  }, T), o === "spinner" && R && En, o === "input" && R && /* @__PURE__ */ h.createElement("div", {
    className: we(`${i}-actions`, f?.actions),
    style: p?.actions
  }, En, $n));
}), $2 = (e) => {
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
    colorBgContainerDisabled: v,
    lineWidth: y,
    lineType: w,
    antCls: x
  } = e, [E, C] = nl(x, "space-addon");
  return {
    [n]: [
      // ==========================================================
      // ==                         Base                         ==
      // ==========================================================
      {
        ...jr(e),
        display: "inline-flex",
        alignItems: "center",
        gap: 0,
        whiteSpace: "nowrap",
        paddingInline: i,
        margin: 0,
        borderWidth: y,
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
        [E("addon-border-color")]: l,
        [E("addon-background")]: v,
        // Filled
        [E("addon-border-color-outlined")]: l,
        [E("addon-background-filled")]: v,
        borderColor: C("addon-border-color"),
        background: C("addon-background"),
        // ======================= Outlined =======================
        "&-variant-outlined": {
          [E("addon-border-color")]: C("addon-border-color-outlined")
        },
        // ======================== Filled ========================
        "&-variant-filled": {
          [E("addon-border-color")]: "transparent",
          [E("addon-background")]: C("addon-background-filled"),
          // Disabled
          [`&${n}-disabled`]: {
            [E("addon-border-color")]: l,
            [E("addon-background")]: v
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
          [E("addon-border-color-outlined")]: e.colorError,
          [E("addon-background-filled")]: e.colorErrorBg,
          color: e.colorError
        },
        "&-status-warning": {
          [E("addon-border-color-outlined")]: e.colorWarning,
          [E("addon-background-filled")]: e.colorWarningBg,
          color: e.colorWarning
        }
      }
    ]
  };
}, P2 = Hr("Addon", (e) => [$2(e), Ud(e, {
  focus: !1
})]), R2 = /* @__PURE__ */ Se.forwardRef((e, n) => {
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
    getPrefixCls: v,
    direction: y
  } = Se.useContext(On), w = v("space-addon", c), [x, E] = P2(w), {
    compactItemClassnames: C,
    compactSize: b
  } = Zy(w, y), $ = sv(w, g), _ = we(w, x, C, E, `${w}-variant-${f}`, $, {
    [`${w}-${b}`]: b,
    [`${w}-disabled`]: p
  }, o);
  return /* @__PURE__ */ Se.createElement("div", {
    ref: n,
    className: _,
    style: l,
    ...m
  }, i);
}), _2 = (e) => {
  const n = e.handleVisible ?? "auto", o = e.controlHeightSM - e.lineWidth * 2;
  return {
    ...Xd(e),
    controlWidth: 90,
    handleWidth: o,
    handleFontSize: e.fontSize / 2,
    handleVisible: n,
    handleActiveBg: e.colorFillAlter,
    handleBg: e.colorBgContainer,
    filledHandleBg: new Rt(e.colorFillSecondary).onBackground(e.colorBgContainer).toHexString(),
    handleHoverColor: e.colorPrimary,
    handleBorderColor: e.colorBorder,
    handleOpacity: n === !0 ? 1 : 0,
    handleVisibleWidth: n === !0 ? o : 0
  };
}, N2 = (e) => {
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
    paddingBlockLG: v,
    paddingInlineLG: y,
    colorIcon: w,
    colorTextDisabled: x,
    motionDurationMid: E,
    handleHoverColor: C,
    handleOpacity: b,
    paddingInline: $,
    paddingBlock: _,
    handleBg: R,
    handleActiveBg: N,
    inputAffixPadding: T,
    borderRadiusSM: L,
    controlWidth: F,
    handleBorderColor: A,
    filledHandleBg: H,
    lineHeightLG: Y,
    antCls: V
  } = e, X = `${$e(o)} ${i} ${A}`, [Q, oe] = nl(V, "input-number");
  return [
    // ==========================================================
    // ==                         Base                         ==
    // ==========================================================
    {
      [n]: {
        ...jr(e),
        ...Yd(e),
        [Q("input-padding-block")]: $e(_),
        [Q("input-padding-inline")]: $e($),
        display: "inline-flex",
        width: F,
        margin: 0,
        paddingBlock: 0,
        borderRadius: l,
        // ======================= Variants =======================
        ...pv(e, {
          [`${n}-actions`]: {
            background: R,
            [`${n}-action-down`]: {
              borderBlockStart: X
            }
          }
        }),
        ...vv(e, {
          [`${n}-actions`]: {
            background: H,
            [`${n}-action-down`]: {
              borderBlockStart: X
            }
          },
          "&:focus-within": {
            [`${n}-actions`]: {
              background: R
            }
          }
        }),
        ...wv(e, {
          [`${n}-actions`]: {
            background: R,
            [`${n}-action-down`]: {
              borderBlockStart: X
            }
          }
        }),
        ...gv(e),
        // InputNumber 两层结构：borderless 补偿只加在内层 input 的 CSS 变量上，避免外层+内层双重 padding 导致高度异常
        [`&${n}-borderless`]: {
          paddingBlock: 0,
          [Q("input-padding-block")]: $e(e.calc(_).add(o).equal())
        },
        [`&${n}-borderless${n}-sm`]: {
          paddingBlock: 0,
          [Q("input-padding-block")]: $e(e.calc(m).add(o).equal())
        },
        [`&${n}-borderless${n}-lg`]: {
          paddingBlock: 0,
          [Q("input-padding-block")]: $e(e.calc(v).add(o).equal())
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
          ...jr(e),
          width: "100%",
          paddingBlock: oe("input-padding-block"),
          textAlign: "start",
          backgroundColor: "transparent",
          border: 0,
          borderRadius: 0,
          outline: 0,
          transition: `all ${E} linear`,
          appearance: "textfield",
          fontSize: "inherit",
          lineHeight: "inherit",
          ...Cv(e.colorTextPlaceholder),
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
          ...Sy(),
          userSelect: "none",
          overflow: "hidden",
          fontWeight: "bold",
          lineHeight: 0,
          textAlign: "center",
          cursor: "pointer",
          transition: `all ${E} linear`,
          // Active: change background not disabled only;
          [`&:active:not(${n}-action-up-disabled):not(${n}-action-down-disabled)`]: {
            background: N
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
            opacity: b,
            height: "100%",
            borderRadius: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            transition: `all ${E}`,
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
          [Q("input-padding-block")]: $e(v),
          [Q("input-padding-inline")]: $e(y),
          paddingBlock: 0,
          fontSize: f,
          lineHeight: Y
        },
        "&-sm": {
          [Q("input-padding-block")]: $e(m),
          [Q("input-padding-inline")]: $e(g),
          paddingBlock: 0,
          fontSize: c,
          borderRadius: L
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
          marginInlineEnd: T
        },
        [`${n}-suffix`]: {
          height: "100%",
          marginInlineStart: T,
          transition: `margin ${E}`
        },
        [`&:hover:not(${n}-without-controls)`]: {
          [`${n}-suffix`]: {
            marginInlineEnd: e.handleWidth
          }
        }
      }
    }
  ];
}, k2 = (e) => {
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
}, M2 = Hr("InputNumber", (e) => {
  const n = er(e, qd(e));
  return [
    N2(n),
    k2(n),
    // =====================================================
    // ==             Space Compact                       ==
    // =====================================================
    Ud(n)
  ];
}, _2, {
  unitless: {
    handleOpacity: !0
  },
  resetFont: !1
}), T2 = /* @__PURE__ */ h.forwardRef((e, n) => {
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
    suffix: v,
    bordered: y,
    readOnly: w,
    status: x,
    controls: E = !0,
    variant: C,
    className: b,
    style: $,
    classNames: _,
    styles: R,
    mode: N,
    ...T
  } = e, {
    direction: L,
    className: F,
    style: A,
    styles: H,
    classNames: Y
  } = Xo("inputNumber"), V = h.useContext(Qs), X = c ?? V, Q = h.useMemo(() => !E || X || w ? !1 : E, [E, X, w]), {
    compactSize: oe,
    compactItemClassnames: G
  } = Zy(f, L);
  let le = N === "spinner" ? /* @__PURE__ */ h.createElement(X$, null) : /* @__PURE__ */ h.createElement(g2, null), he = N === "spinner" ? /* @__PURE__ */ h.createElement(f2, null) : /* @__PURE__ */ h.createElement(g$, null);
  const j = typeof Q == "boolean" ? Q : void 0;
  Vr(Q) && (le = Q.upIcon || le, he = Q.downIcon || he);
  const {
    hasFeedback: J,
    isFormItemInput: U,
    feedbackIcon: k
  } = h.useContext(Ga), O = oc((ce) => l ?? oe ?? ce), [ee, te] = s$("inputNumber", C, y), se = (J || v) && /* @__PURE__ */ h.createElement(h.Fragment, null, v, J && k), re = {
    ...e,
    size: O,
    disabled: X,
    controls: Q
  }, fe = Mi(A), ie = Mi($), [Z, ae] = ol([Y, _], [H, fe, R, ie], {
    props: re
  });
  return /* @__PURE__ */ h.createElement(E2, {
    ref: o,
    mode: N,
    disabled: X,
    className: we(b, i, Z.root, F, G, sv(f, x, J), {
      [`${f}-${ee}`]: te,
      [`${f}-lg`]: O === "large",
      [`${f}-sm`]: O === "small",
      [`${f}-rtl`]: L === "rtl",
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
    ...T
  });
}), Rv = /* @__PURE__ */ h.forwardRef((e, n) => {
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
  } = Xo("inputNumber"), v = m("input-number", l), {
    status: y
  } = h.useContext(Ga), w = i$(y, f), x = Vd(v), [E, C] = M2(v, x), b = o || i, $ = /* @__PURE__ */ h.createElement(T2, {
    ref: n,
    ...g,
    prefixCls: v,
    status: w,
    className: we(C, x, E, c),
    rootClassName: b ? void 0 : p
  });
  if (b) {
    const _ = (T) => T ? /* @__PURE__ */ h.createElement(R2, {
      className: we(`${v}-addon`, C, E),
      variant: e.variant,
      disabled: e.disabled,
      status: w
    }, /* @__PURE__ */ h.createElement(iv, {
      form: !0
    }, T)) : null, R = _(o), N = _(i);
    return /* @__PURE__ */ h.createElement(Hb, {
      rootClassName: p
    }, R, $, N);
  }
  return $;
}), vd = Rv, I2 = (e) => /* @__PURE__ */ h.createElement(yo, {
  theme: {
    components: {
      InputNumber: {
        handleVisible: !0
      }
    }
  }
}, /* @__PURE__ */ h.createElement(Rv, {
  ...e
}));
vd._InternalPanelDoNotUseOrYouWillBeFired = I2;
const F2 = {
  percent: 0,
  prefixCls: "rc-progress",
  strokeColor: "#2db7f5",
  strokeLinecap: "round",
  strokeWidth: 1,
  railColor: "#D9D9D9",
  railWidth: 1,
  gapPosition: "bottom",
  loading: !1
}, O2 = () => {
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
}, d0 = ({
  bg: e,
  children: n
}) => /* @__PURE__ */ h.createElement("div", {
  style: {
    width: "100%",
    height: "100%",
    background: e
  }
}, n);
function p0(e, n) {
  return Object.keys(e).map((o) => {
    const i = parseFloat(o), l = `${Math.floor(i * n)}%`;
    return `${e[o]} ${l}`;
  });
}
const A2 = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    prefixCls: o,
    color: i,
    gradientId: l,
    radius: c,
    className: f,
    style: p,
    ptg: g,
    strokeLinecap: m,
    strokeWidth: v,
    size: y,
    gapDegree: w
  } = e, x = i && typeof i == "object", E = x ? "#FFF" : void 0, C = y / 2, b = /* @__PURE__ */ h.createElement("circle", {
    className: we(`${o}-circle-path`, f),
    r: c,
    cx: C,
    cy: C,
    stroke: E,
    strokeLinecap: m,
    strokeWidth: v,
    opacity: g === 0 ? 0 : 1,
    style: p,
    ref: n
  });
  if (!x)
    return b;
  const $ = `${l}-conic`, _ = w ? `${180 + w / 2}deg` : "0deg", R = p0(i, (360 - w) / 360), N = p0(i, 1), T = `conic-gradient(from ${_}, ${R.join(", ")})`, L = `linear-gradient(to ${w ? "bottom" : "top"}, ${N.join(", ")})`;
  return /* @__PURE__ */ h.createElement(h.Fragment, null, /* @__PURE__ */ h.createElement("mask", {
    id: $
  }, b), /* @__PURE__ */ h.createElement("foreignObject", {
    x: 0,
    y: 0,
    width: y,
    height: y,
    mask: `url(#${$})`
  }, /* @__PURE__ */ h.createElement(d0, {
    bg: L
  }, /* @__PURE__ */ h.createElement(d0, {
    bg: T
  }))));
}), As = 100, uf = (e, n, o, i, l, c, f, p, g, m, v = 0) => {
  const y = o / 100 * 360 * ((360 - c) / 360), w = c === 0 ? 0 : {
    bottom: 0,
    top: 180,
    left: 90,
    right: -90
  }[f];
  let x = (100 - i) / 100 * n;
  g === "round" && i !== 100 && (x += m / 2, x >= n && (x = n - 0.01));
  const E = As / 2;
  return {
    stroke: typeof p == "string" ? p : void 0,
    strokeDasharray: `${n}px ${e}`,
    strokeDashoffset: x + v,
    transform: `rotate(${l + y + w}deg)`,
    transformOrigin: `${E}px ${E}px`,
    transition: "stroke-dashoffset .3s ease 0s, stroke-dasharray .3s ease 0s, stroke .3s, stroke-width .06s ease .3s, opacity .3s ease 0s",
    fillOpacity: 0
  };
}, L2 = (({
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
    indeterminateStyleAnimation: /* @__PURE__ */ Se.createElement("style", null, `@keyframes ${o} {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }`)
  };
});
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
function h0(e) {
  const n = e ?? [];
  return Array.isArray(n) ? n : [n];
}
const z2 = (e) => {
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
    railColor: v,
    strokeLinecap: y,
    style: w,
    className: x,
    strokeColor: E,
    percent: C,
    loading: b,
    ...$
  } = {
    ...F2,
    ...e
  }, _ = As / 2, R = Zs(n), N = `${R}-gradient`, T = _ - f / 2, L = Math.PI * 2 * T, F = g > 0 ? 90 + g / 2 : -90, A = L * ((360 - g) / 360), {
    count: H,
    gap: Y
  } = typeof c == "object" ? c : {
    count: c,
    gap: 2
  }, V = h0(C), X = h0(E), Q = X.find((O) => O && typeof O == "object"), G = Q && typeof Q == "object" ? "butt" : y, {
    indeterminateStyleProps: le,
    indeterminateStyleAnimation: he
  } = L2({
    id: R,
    loading: b
  }), j = uf(L, A, 0, 100, F, g, m, v, G, f), J = O2(), U = () => {
    let O = 0;
    return V.map((ee, te) => {
      const se = X[te] || X[X.length - 1], re = uf(L, A, O, ee, F, g, m, se, G, f);
      return O += ee, /* @__PURE__ */ h.createElement(A2, {
        key: te,
        color: se,
        ptg: ee,
        radius: T,
        prefixCls: o,
        gradientId: N,
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
        size: As
      });
    }).reverse();
  }, k = () => {
    const O = Math.round(H * (V[0] / 100)), ee = 100 / H;
    let te = 0;
    return new Array(H).fill(null).map((se, re) => {
      const fe = re <= O - 1 ? X[0] : v, ie = fe && typeof fe == "object" ? `url(#${N})` : void 0, Z = uf(L, A, te, ee, F, g, m, fe, "butt", f, Y);
      return te += (A - Z.strokeDashoffset + Y) * 100 / A, /* @__PURE__ */ h.createElement("circle", {
        key: re,
        className: we(`${o}-circle-path`, i.track),
        r: T,
        cx: _,
        cy: _,
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
  return /* @__PURE__ */ h.createElement("svg", Sd({
    className: we(`${o}-circle`, i.root, x),
    viewBox: `0 0 ${As} ${As}`,
    style: {
      ...l.root,
      ...w
    },
    id: n,
    role: "presentation"
  }, $), !H && /* @__PURE__ */ h.createElement("circle", {
    className: we(`${o}-circle-rail`, i.rail),
    r: T,
    cx: _,
    cy: _,
    stroke: v,
    strokeLinecap: G,
    strokeWidth: p || f,
    style: {
      ...j,
      ...l.rail
    }
  }), H ? k() : U(), he);
};
function Wo(e) {
  return !e || e < 0 ? 0 : e > 100 ? 100 : e;
}
function Ya({
  success: e
}) {
  let n;
  return e && "percent" in e && (n = e.percent), n;
}
const B2 = ({
  percent: e,
  success: n
}) => {
  const o = Wo(Ya({
    success: n
  }));
  return [o, Wo(Wo(e) - o)];
}, D2 = ({
  success: e = {},
  strokeColor: n
}) => {
  const {
    strokeColor: o
  } = e;
  return [o || Pi.green, n || null];
}, ac = (e, n, o) => {
  let i = -1, l = -1;
  if (n === "step") {
    const c = o.steps, f = o.strokeWidth;
    typeof e == "string" || typeof e > "u" ? (i = e === "small" ? 2 : 14, l = f ?? 8) : rf(e) ? [i, l] = [e, e] : [i = 14, l = 8] = Array.isArray(e) ? e : [e.width, e.height], i *= c;
  } else if (n === "line") {
    const c = o?.strokeWidth;
    typeof e == "string" || typeof e > "u" ? l = c || (e === "small" ? 6 : 8) : rf(e) ? [i, l] = [e, e] : [i = -1, l = 8] = Array.isArray(e) ? e : [e.width, e.height];
  } else (n === "circle" || n === "dashboard") && (typeof e == "string" || typeof e > "u" ? [i, l] = e === "small" ? [60, 60] : [120, 120] : rf(e) ? [i, l] = [e, e] : Array.isArray(e) && (i = e[0] ?? e[1] ?? 120, l = e[0] ?? e[1] ?? 120));
  return [i, l];
}, j2 = 3, H2 = (e) => j2 / e * 100, m0 = ["root", "body", "indicator"], V2 = (e) => {
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
    width: v = 120,
    type: y,
    children: w,
    success: x,
    size: E = v,
    steps: C
  } = e, {
    direction: b
  } = Xo("progress"), $ = l ?? c, [_, R] = ac(E, "circle");
  let {
    strokeWidth: N
  } = e;
  N === void 0 && (N = Math.max(H2(_), 6));
  const T = {
    width: _,
    height: R,
    fontSize: _ * 0.15 + 6
  }, L = h.useMemo(() => {
    if (m || m === 0)
      return m;
    if (y === "dashboard")
      return 75;
  }, [m, y]), F = B2(e), A = h.useMemo(() => {
    const G = (g ?? p) || y === "dashboard" && "bottom" || void 0, le = b === "rtl";
    switch (G) {
      case "start":
        return le ? "right" : "left";
      case "end":
        return le ? "left" : "right";
      default:
        return G;
    }
  }, [b, g, p, y]), H = Vr(e.strokeColor), Y = D2({
    success: x,
    strokeColor: e.strokeColor
  }), V = we(`${n}-body`, {
    [`${n}-circle-gradient`]: H
  }, o.body), X = /* @__PURE__ */ h.createElement(z2, {
    steps: C,
    percent: C ? F[1] : F,
    strokeWidth: N,
    railWidth: N,
    strokeColor: C ? Y[1] : Y,
    strokeLinecap: f,
    railColor: $,
    prefixCls: n,
    gapDegree: L,
    gapPosition: A,
    classNames: La(o, m0),
    styles: La(i, m0)
  }), Q = _ <= 20, oe = /* @__PURE__ */ h.createElement("div", {
    className: V,
    style: {
      ...T,
      ...i.body
    }
  }, X, !Q && w);
  return Q ? /* @__PURE__ */ h.createElement(Fi, {
    title: w
  }, oe) : oe;
}, wd = "--progress-line-stroke-color", W2 = (e) => {
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
}, U2 = (e) => {
  const {
    componentCls: n,
    iconCls: o
  } = e;
  return {
    [n]: {
      ...jr(e),
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
}, q2 = (e) => {
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
          animationName: W2(),
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
}, X2 = (e) => {
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
}, G2 = (e) => {
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
}, Y2 = (e) => {
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
}, K2 = (e) => ({
  circleTextColor: e.colorText,
  defaultColor: e.colorInfo,
  remainingColor: e.colorFillSecondary,
  lineBorderRadius: 100,
  // magic for capsule shape, should be a very large number
  circleTextFontSize: "1em",
  circleIconFontSize: `${e.fontSize / e.fontSizeSM}em`
}), Q2 = Hr("Progress", (e) => {
  const n = e.calc(e.marginXXS).div(2).equal(), o = er(e, {
    progressStepMarginInlineEnd: n,
    progressStepMinWidth: n,
    progressActiveMotionDuration: "2.4s"
  });
  return [U2(o), q2(o), X2(o), G2(o), Y2(o)];
}, K2), Z2 = (e) => {
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
}, J2 = (e, n) => {
  const {
    from: o = Pi.blue,
    to: i = Pi.blue,
    direction: l = n === "rtl" ? "to left" : "to right",
    ...c
  } = e;
  if (Object.keys(c).length !== 0) {
    const p = Z2(c), g = `linear-gradient(${l}, ${p})`;
    return {
      background: g,
      [wd]: g
    };
  }
  const f = `linear-gradient(${l}, ${o}, ${i})`;
  return {
    background: f,
    [wd]: f
  };
}, eP = (e) => {
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
    children: v,
    railColor: y,
    trailColor: w,
    percentPosition: x,
    success: E
  } = e, {
    align: C,
    type: b
  } = x, $ = y ?? w, _ = m === "square" || m === "butt" ? 0 : void 0, R = f ?? [-1, p || (f === "small" ? 6 : 8)], [N, T] = ac(R, "line", {
    strokeWidth: p
  }), L = {
    backgroundColor: $ || void 0,
    borderRadius: _,
    height: T
  }, F = `${n}-track`, A = g && typeof g != "string" ? J2(g, l) : {
    [wd]: g,
    background: g
  }, H = {
    width: `${Wo(c)}%`,
    height: T,
    borderRadius: _,
    ...A
  }, Y = Ya(e), V = {
    width: `${Wo(Y)}%`,
    height: T,
    borderRadius: _,
    backgroundColor: E?.strokeColor
  };
  return /* @__PURE__ */ h.createElement("div", {
    className: we(`${n}-body`, o.body, {
      [`${n}-body-layout-bottom`]: C === "center" && b === "outer"
    }),
    style: {
      width: N > 0 ? N : "100%",
      ...i.body
    }
  }, /* @__PURE__ */ h.createElement("div", {
    className: we(`${n}-rail`, o.rail),
    style: {
      ...L,
      ...i.rail
    }
  }, /* @__PURE__ */ h.createElement("div", {
    className: we(F, o.track),
    style: {
      ...H,
      ...i.track
    }
  }, b === "inner" && v), Y !== void 0 && /* @__PURE__ */ h.createElement("div", {
    className: we(F, `${F}-success`, o.track),
    style: {
      ...V,
      ...i.track
    }
  })), b === "outer" && v);
}, tP = (e) => {
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
    trailColor: v,
    prefixCls: y,
    children: w
  } = e, x = c(l * (f / 100)), C = i ?? [i === "small" ? 2 : 14, p], [b, $] = ac(C, "step", {
    steps: l,
    strokeWidth: p
  }), _ = b / l, R = Array.from({
    length: l
  }), N = m ?? v;
  for (let T = 0; T < l; T++) {
    const L = Array.isArray(g) ? g[T] : g;
    R[T] = /* @__PURE__ */ h.createElement("div", {
      key: T,
      className: we(`${y}-steps-item`, {
        [`${y}-steps-item-active`]: T <= x - 1
      }, n.track),
      style: {
        backgroundColor: T <= x - 1 ? L : N,
        width: _,
        height: $,
        ...o.track
      }
    });
  }
  return /* @__PURE__ */ h.createElement("div", {
    className: we(`${y}-steps-body`, n.body),
    style: o.body
  }, R, w);
}, nP = ["normal", "exception", "active", "success"], _v = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    prefixCls: o,
    className: i,
    rootClassName: l,
    classNames: c,
    styles: f,
    steps: p,
    strokeColor: g,
    percent: m = 0,
    size: v = "medium",
    showInfo: y = !0,
    type: w = "line",
    status: x,
    format: E,
    style: C,
    percentPosition: b = {},
    ...$
  } = e, {
    align: _ = "end",
    type: R = "outer"
  } = b, N = Array.isArray(g) ? g[0] : g, T = typeof g == "string" || Array.isArray(g) ? g : void 0, L = h.useMemo(() => {
    if (N) {
      const Z = typeof N == "string" ? N : Object.values(N)[0];
      return new Rt(Z).isLight();
    }
    return !1;
  }, [g]), F = h.useMemo(() => {
    const Z = Ya(e);
    return Number.parseInt(Z !== void 0 ? (Z ?? 0)?.toString() : (m ?? 0)?.toString(), 10);
  }, [m, e.success]), A = h.useMemo(() => !nP.includes(x) && F >= 100 ? "success" : x || "normal", [x, F]), {
    getPrefixCls: H,
    direction: Y,
    className: V,
    style: X,
    classNames: Q,
    styles: oe
  } = Xo("progress"), G = H("progress", o), [le, he] = Q2(G), j = {
    ...e,
    percent: m,
    type: w,
    size: v,
    showInfo: y,
    percentPosition: b
  }, J = Mi(X), U = Mi(C), [k, O] = ol([Q, c], [oe, J, f, U], {
    props: j
  }), ee = w === "line", te = ee && !p, se = h.useMemo(() => {
    if (!y)
      return null;
    const Z = Ya(e);
    let ae;
    const ce = E || ((qe) => `${qe}%`), ke = ee && L && R === "inner";
    return R === "inner" || E || A !== "exception" && A !== "success" ? ae = ce(Wo(m), Wo(Z)) : A === "exception" ? ae = ee ? /* @__PURE__ */ h.createElement(bx, null) : /* @__PURE__ */ h.createElement(_x, null) : A === "success" && (ae = ee ? /* @__PURE__ */ h.createElement(vx, null) : /* @__PURE__ */ h.createElement(f$, null)), /* @__PURE__ */ h.createElement("span", {
      className: we(`${G}-indicator`, {
        [`${G}-indicator-bright`]: ke,
        [`${G}-indicator-${_}`]: te,
        [`${G}-indicator-${R}`]: te
      }, k.indicator),
      style: O.indicator,
      title: typeof ae == "string" ? ae : void 0
    }, ae);
  }, [y, m, F, A, w, G, E, ee, L, R, _, te, k.indicator, O.indicator]), re = {
    ...e,
    classNames: k,
    styles: O
  };
  let fe;
  w === "line" ? fe = p ? /* @__PURE__ */ h.createElement(tP, {
    ...re,
    strokeColor: T,
    prefixCls: G,
    steps: Vr(p) ? p.count : p
  }, se) : /* @__PURE__ */ h.createElement(eP, {
    ...re,
    strokeColor: N,
    prefixCls: G,
    direction: Y,
    percentPosition: {
      align: _,
      type: R
    }
  }, se) : (w === "circle" || w === "dashboard") && (fe = /* @__PURE__ */ h.createElement(V2, {
    ...re,
    strokeColor: N,
    prefixCls: G,
    progressStatus: A
  }, se));
  const ie = we(G, `${G}-status-${A}`, {
    [`${G}-${w === "dashboard" && "circle" || w}`]: w !== "line",
    [`${G}-inline-circle`]: w === "circle" && ac(v, "circle")[0] <= 20,
    [`${G}-line`]: te,
    [`${G}-line-align-${_}`]: te,
    [`${G}-line-position-${R}`]: te,
    [`${G}-steps`]: p,
    [`${G}-show-info`]: y,
    [`${G}-small`]: v === "small",
    [`${G}-rtl`]: Y === "rtl"
  }, V, i, l, k.root, le, he);
  return /* @__PURE__ */ h.createElement("div", {
    ref: n,
    style: O.root,
    className: ie,
    role: "progressbar",
    "aria-valuenow": F,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    ...La($, ["railColor", "trailColor", "strokeWidth", "width", "gapDegree", "gapPosition", "gapPlacement", "strokeLinecap", "success"])
  }, fe);
});
var _a = {}, g0;
function rP() {
  if (g0) return _a;
  g0 = 1, Object.defineProperty(_a, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M908.1 353.1l-253.9-36.9L540.7 86.1c-3.1-6.3-8.2-11.4-14.5-14.5-15.8-7.8-35-1.3-42.9 14.5L369.8 316.2l-253.9 36.9c-7 1-13.4 4.3-18.3 9.3a32.05 32.05 0 00.6 45.3l183.7 179.1-43.4 252.9a31.95 31.95 0 0046.4 33.7L512 754l227.1 119.4c6.2 3.3 13.4 4.4 20.3 3.2 17.4-3 29.1-19.5 26.1-36.9l-43.4-252.9 183.7-179.1c5-4.9 8.3-11.3 9.3-18.3 2.7-17.5-9.5-33.7-27-36.3z" } }] }, name: "star", theme: "filled" };
  return _a.default = e, _a;
}
var oP = /* @__PURE__ */ rP();
const iP = /* @__PURE__ */ Jn(oP);
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
const sP = (e, n) => /* @__PURE__ */ h.createElement(Er, Cd({}, e, {
  ref: n,
  icon: iP
})), lP = /* @__PURE__ */ h.forwardRef(sP);
function aP(e, n) {
  const {
    disabled: o,
    prefixCls: i,
    character: l,
    characterRender: c,
    index: f,
    count: p,
    value: g,
    allowHalf: m,
    focused: v,
    onHover: y,
    onClick: w
  } = e, x = (N) => {
    y(N, f);
  }, E = (N) => {
    w(N, f);
  }, C = (N) => {
    N.keyCode === Is.ENTER && w(N, f);
  }, b = f + 1, $ = /* @__PURE__ */ new Set([i]);
  g === 0 && f === 0 && v ? $.add(`${i}-focused`) : m && g + 0.5 >= b && g < b ? ($.add(`${i}-half`), $.add(`${i}-active`), v && $.add(`${i}-focused`)) : (b <= g ? $.add(`${i}-full`) : $.add(`${i}-zero`), b === g && v && $.add(`${i}-focused`));
  const _ = typeof l == "function" ? l(e) : l;
  let R = /* @__PURE__ */ Se.createElement("li", {
    className: we(Array.from($)),
    ref: n
  }, /* @__PURE__ */ Se.createElement("div", {
    onClick: o ? null : E,
    onKeyDown: o ? null : C,
    onMouseMove: o ? null : x,
    role: "radio",
    "aria-checked": g > f ? "true" : "false",
    "aria-posinset": f + 1,
    "aria-setsize": p,
    tabIndex: o ? -1 : 0
  }, /* @__PURE__ */ Se.createElement("div", {
    className: `${i}-first`
  }, _), /* @__PURE__ */ Se.createElement("div", {
    className: `${i}-second`
  }, _)));
  return c && (R = c(R, e)), R;
}
const cP = /* @__PURE__ */ Se.forwardRef(aP);
function uP() {
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
function fP(e) {
  let n = e.pageXOffset;
  const o = "scrollLeft";
  if (typeof n != "number") {
    const i = e.document;
    n = i.documentElement[o], typeof n != "number" && (n = i.body[o]);
  }
  return n;
}
function dP(e) {
  let n, o;
  const i = e.ownerDocument, {
    body: l
  } = i, c = i && i.documentElement, f = e.getBoundingClientRect();
  return n = f.left, o = f.top, n -= c.clientLeft || l.clientLeft || 0, o -= c.clientTop || l.clientTop || 0, {
    left: n,
    top: o
  };
}
function pP(e) {
  const n = dP(e), o = e.ownerDocument, i = o.defaultView || o.parentWindow;
  return n.left += fP(i), n.left;
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
function hP(e, n) {
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
    character: v = "★",
    characterRender: y,
    // Meta
    disabled: w,
    direction: x = "ltr",
    tabIndex: E = 0,
    autoFocus: C,
    // Events
    onHoverChange: b,
    onChange: $,
    onFocus: _,
    onBlur: R,
    onKeyDown: N,
    onMouseLeave: T,
    ...L
  } = e, [F, A] = uP(), H = Se.useRef(null), Y = () => {
    w || H.current?.focus();
  };
  Se.useImperativeHandle(n, () => ({
    focus: Y,
    blur: () => {
      w || H.current?.blur();
    }
  }));
  const [V, X] = js(l || 0, c), [Q, oe] = js(null), G = (Z, ae) => {
    const ce = x === "rtl";
    let ke = Z + 1;
    if (p) {
      const qe = F(Z), Qe = pP(qe), _e = qe.clientWidth;
      (ce && ae - Qe > _e / 2 || !ce && ae - Qe < _e / 2) && (ke -= 0.5);
    }
    return ke;
  }, le = (Z) => {
    X(Z), $?.(Z);
  }, [he, j] = Se.useState(!1), J = () => {
    j(!0), _?.();
  }, U = () => {
    j(!1), R?.();
  }, [k, O] = Se.useState(null), ee = (Z, ae) => {
    const ce = G(ae, Z.pageX);
    ce !== Q && (O(ce), oe(null)), b?.(ce);
  }, te = (Z) => {
    w || (O(null), oe(null), b?.(void 0)), Z && T?.(Z);
  }, se = (Z, ae) => {
    const ce = G(ae, Z.pageX);
    let ke = !1;
    g && (ke = ce === V), te(), le(ke ? 0 : ce), oe(ke ? ce : null);
  }, re = (Z) => {
    const {
      keyCode: ae
    } = Z, ce = x === "rtl", ke = p ? 0.5 : 1;
    m && (ae === Is.RIGHT && V < f && !ce ? (le(V + ke), Z.preventDefault()) : ae === Is.LEFT && V > 0 && !ce || ae === Is.RIGHT && V > 0 && ce ? (le(V - ke), Z.preventDefault()) : ae === Is.LEFT && V < f && ce && (le(V + ke), Z.preventDefault())), N?.(Z);
  };
  Se.useEffect(() => {
    C && !w && Y();
  }, []);
  const fe = new Array(f).fill(0).map((Z, ae) => /* @__PURE__ */ Se.createElement(cP, {
    ref: A(ae),
    index: ae,
    count: f,
    disabled: w,
    prefixCls: `${o}-star`,
    allowHalf: p,
    value: k === null ? V : k,
    onClick: se,
    onHover: ee,
    key: Z || ae,
    character: v,
    characterRender: y,
    focused: he
  })), ie = we(o, i, {
    [`${o}-disabled`]: w,
    [`${o}-rtl`]: x === "rtl"
  });
  return /* @__PURE__ */ Se.createElement("ul", xd({
    className: ie,
    onMouseLeave: te,
    tabIndex: w ? -1 : E,
    onFocus: w ? null : J,
    onBlur: w ? null : U,
    onKeyDown: w ? null : re,
    ref: H
  }, KS(L, {
    aria: !0,
    data: !0,
    attr: !0
  })), fe);
}
const mP = /* @__PURE__ */ Se.forwardRef(hP), gP = (e) => {
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
}, yP = (e) => ({
  [`&-rtl${e.componentCls}`]: {
    direction: "rtl"
  }
}), vP = (e) => {
  const {
    componentCls: n
  } = e;
  return {
    [n]: {
      ...jr(e),
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
      ...gP(e),
      // rtl styles
      ...yP(e)
    }
  };
}, SP = (e) => ({
  starColor: e.yellow6,
  starSize: e.controlHeight * 0.625,
  starSizeSM: e.controlHeightSM * 0.625,
  starSizeLG: e.controlHeightLG * 0.625,
  starHoverScale: "scale(1.1)",
  starBg: e.colorFillContent
}), wP = Hr("Rate", (e) => {
  const n = er(e, {});
  return vP(n);
}, SP), Nv = /* @__PURE__ */ h.forwardRef((e, n) => {
  const {
    prefixCls: o,
    className: i,
    rootClassName: l,
    style: c,
    tooltips: f,
    character: p = /* @__PURE__ */ h.createElement(lP, null),
    disabled: g,
    size: m,
    ...v
  } = e, y = (F, {
    index: A = 0
  }) => {
    if (!f)
      return F;
    const H = f[A];
    return Vr(H) ? /* @__PURE__ */ h.createElement(Fi, {
      ...H
    }, F) : /* @__PURE__ */ h.createElement(Fi, {
      title: H
    }, F);
  }, {
    getPrefixCls: w,
    direction: x,
    className: E,
    style: C
  } = Xo("rate"), b = w("rate", o), [$, _] = wP(b), R = {
    ...C,
    ...c
  }, N = h.useContext(Qs), T = g ?? N, L = oc((F) => m ?? F);
  return /* @__PURE__ */ h.createElement(mP, {
    ref: n,
    character: p,
    characterRender: y,
    disabled: T,
    ...v,
    className: we({
      [`${b}-large`]: L === "large",
      [`${b}-small`]: L === "small"
    }, i, l, $, _, E),
    style: R,
    prefixCls: b,
    direction: x
  });
}), CP = {
  /** Default seedToken */
  defaultSeed: ja.token,
  defaultAlgorithm: hy
};
var $s = {}, ff = { exports: {} }, y0;
function Qd() {
  return y0 || (y0 = 1, (function(e) {
    function n(o) {
      return o && o.__esModule ? o : {
        default: o
      };
    }
    e.exports = n, e.exports.__esModule = !0, e.exports.default = e.exports;
  })(ff)), ff.exports;
}
var Ps = {}, v0;
function xP() {
  if (v0) return Ps;
  v0 = 1, Object.defineProperty(Ps, "__esModule", {
    value: !0
  }), Ps.default = void 0;
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
  return Ps.default = e, Ps;
}
var Rs = {}, _s = {}, Ns = {}, ks = {}, S0;
function bP() {
  return S0 || (S0 = 1, Object.defineProperty(ks, "__esModule", {
    value: !0
  }), ks.commonLocale = void 0, ks.commonLocale = {
    yearFormat: "YYYY",
    dayFormat: "D",
    cellMeridiemFormat: "A",
    monthBeforeYear: !0
  }), ks;
}
var w0;
function EP() {
  if (w0) return Ns;
  w0 = 1, Object.defineProperty(Ns, "__esModule", {
    value: !0
  }), Ns.default = void 0;
  var e = bP();
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
  return Ns.default = n, Ns;
}
var Ms = {}, C0;
function kv() {
  if (C0) return Ms;
  C0 = 1, Object.defineProperty(Ms, "__esModule", {
    value: !0
  }), Ms.default = void 0;
  const e = {
    placeholder: "请选择时间",
    rangePlaceholder: ["开始时间", "结束时间"]
  };
  return Ms.default = e, Ms;
}
var x0;
function Mv() {
  if (x0) return _s;
  x0 = 1;
  var e = Qd().default;
  Object.defineProperty(_s, "__esModule", {
    value: !0
  }), _s.default = void 0;
  var n = e(EP()), o = e(/* @__PURE__ */ kv());
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
  return i.lang.ok = "确定", _s.default = i, _s;
}
var b0;
function $P() {
  if (b0) return Rs;
  b0 = 1;
  var e = Qd().default;
  Object.defineProperty(Rs, "__esModule", {
    value: !0
  }), Rs.default = void 0;
  var n = e(/* @__PURE__ */ Mv());
  return Rs.default = n.default, Rs;
}
var E0;
function PP() {
  if (E0) return $s;
  E0 = 1;
  var e = Qd().default;
  Object.defineProperty($s, "__esModule", {
    value: !0
  }), $s.default = void 0;
  var n = e(xP()), o = e(/* @__PURE__ */ $P()), i = e(/* @__PURE__ */ Mv()), l = e(/* @__PURE__ */ kv());
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
  return $s.default = f, $s;
}
var df, $0;
function RP() {
  return $0 || ($0 = 1, df = /* @__PURE__ */ PP()), df;
}
var _P = /* @__PURE__ */ RP();
const Tv = /* @__PURE__ */ Jn(_P), Iv = {
  algorithm: CP.defaultAlgorithm,
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
var pf = { exports: {} }, Ts = {};
var P0;
function NP() {
  if (P0) return Ts;
  P0 = 1;
  var e = Ed(), n = /* @__PURE__ */ Symbol.for("react.element"), o = /* @__PURE__ */ Symbol.for("react.fragment"), i = Object.prototype.hasOwnProperty, l = e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, c = { key: !0, ref: !0, __self: !0, __source: !0 };
  function f(p, g, m) {
    var v, y = {}, w = null, x = null;
    m !== void 0 && (w = "" + m), g.key !== void 0 && (w = "" + g.key), g.ref !== void 0 && (x = g.ref);
    for (v in g) i.call(g, v) && !c.hasOwnProperty(v) && (y[v] = g[v]);
    if (p && p.defaultProps) for (v in g = p.defaultProps, g) y[v] === void 0 && (y[v] = g[v]);
    return { $$typeof: n, type: p, key: w, ref: x, props: y, _owner: l.current };
  }
  return Ts.Fragment = o, Ts.jsx = f, Ts.jsxs = f, Ts;
}
var R0;
function kP() {
  return R0 || (R0 = 1, pf.exports = NP()), pf.exports;
}
var Ne = kP();
h.createContext({
  client: null,
  launchContext: null,
  ready: !1
});
h.createContext(null);
var Na = {}, _0;
function MP() {
  if (_0) return Na;
  _0 = 1, Object.defineProperty(Na, "__esModule", { value: !0 });
  var e = { icon: { tag: "svg", attrs: { viewBox: "64 64 896 896", focusable: "false" }, children: [{ tag: "path", attrs: { d: "M923 283.6a260.04 260.04 0 00-56.9-82.8 264.4 264.4 0 00-84-55.5A265.34 265.34 0 00679.7 125c-49.3 0-97.4 13.5-139.2 39-10 6.1-19.5 12.8-28.5 20.1-9-7.3-18.5-14-28.5-20.1-41.8-25.5-89.9-39-139.2-39-35.5 0-69.9 6.8-102.4 20.3-31.4 13-59.7 31.7-84 55.5a258.44 258.44 0 00-56.9 82.8c-13.9 32.3-21 66.6-21 101.9 0 33.3 6.8 68 20.3 103.3 11.3 29.5 27.5 60.1 48.2 91 32.8 48.9 77.9 99.9 133.9 151.6 92.8 85.7 184.7 144.9 188.6 147.3l23.7 15.2c10.5 6.7 24 6.7 34.5 0l23.7-15.2c3.9-2.5 95.7-61.6 188.6-147.3 56-51.7 101.1-102.7 133.9-151.6 20.7-30.9 37-61.5 48.2-91 13.5-35.3 20.3-70 20.3-103.3.1-35.3-7-69.6-20.9-101.9z" } }] }, name: "heart", theme: "filled" };
  return Na.default = e, Na;
}
var TP = /* @__PURE__ */ MP();
const IP = /* @__PURE__ */ Jn(TP);
function bd() {
  return bd = Object.assign ? Object.assign.bind() : function(e) {
    for (var n = 1; n < arguments.length; n++) {
      var o = arguments[n];
      for (var i in o)
        Object.prototype.hasOwnProperty.call(o, i) && (e[i] = o[i]);
    }
    return e;
  }, bd.apply(this, arguments);
}
const FP = (e, n) => /* @__PURE__ */ h.createElement(Er, bd({}, e, {
  ref: n,
  icon: IP
})), Fv = /* @__PURE__ */ h.forwardRef(FP), _i = 5, Ov = 1, Ka = 1e5, Zd = [
  "stars",
  "hearts",
  "score",
  "progress"
], Oi = {
  theme: "",
  style: "stars",
  score: 0,
  total_score: _i,
  locale: "zh-CN"
};
function N0(e) {
  return typeof e == "string" ? e.trim() : void 0;
}
function Av(e) {
  if (typeof e == "number" && Number.isFinite(e))
    return e;
  if (typeof e == "string" && e.trim().length > 0) {
    const n = Number(e);
    return Number.isFinite(n) ? n : void 0;
  }
}
function Jd(e, n, o) {
  return Math.min(Math.max(e, n), o);
}
function qo(e) {
  return e === "stars" || e === "hearts";
}
function OP(e) {
  return Zd.includes(e) ? e : Oi.style;
}
function AP(e, n) {
  return qo(e) ? _i : Jd(
    Av(n) ?? Oi.total_score,
    Ov,
    Ka
  );
}
function LP(e, n, o) {
  const i = Jd(Av(n) ?? Oi.score, 0, o);
  return qo(e) ? Math.round(i) : i;
}
function Br(e) {
  const n = e ?? {}, o = OP(n.style), i = AP(o, n.total_score), l = LP(o, n.score, i);
  return {
    card_type: "ScoreCard",
    theme: N0(n.theme) ?? Oi.theme,
    style: o,
    score: l,
    total_score: i,
    locale: N0(n.locale) ?? Oi.locale
  };
}
function Lv(e) {
  return !Number.isFinite(e.total_score) || e.total_score <= 0 ? 0 : Jd(e.score / e.total_score, 0, 1);
}
function Aa(e) {
  const n = {};
  return e.card_type !== "ScoreCard" && (n.card_type = "score.validation.cardType"), Zd.includes(e.style) || (n.style = "score.validation.style"), (!Number.isFinite(e.total_score) || e.total_score < Ov) && (n.total_score = "score.validation.totalMin"), e.total_score > Ka && (n.total_score = "score.validation.totalMax"), (!Number.isFinite(e.score) || e.score < 0) && (n.score = "score.validation.scoreMin"), Number.isFinite(e.total_score) && e.score > e.total_score && (n.score = "score.validation.scoreMax"), qo(e.style) && (e.total_score !== _i && (n.total_score = "score.validation.symbolTotal"), Number.isInteger(e.score) || (n.score = "score.validation.symbolInteger")), {
    valid: Object.keys(n).length === 0,
    errors: n
  };
}
const zP = {
  "score.style": "样式",
  "score.style.stars": "星星",
  "score.style.hearts": "爱心",
  "score.style.score": "分数",
  "score.style.progress": "进度条",
  "score.earnedScore": "获得分数",
  "score.totalScore": "总分多少",
  "score.totalScore.decrement": "减少总分",
  "score.totalScore.increment": "增加总分",
  "score.scoreValue": "获得分数多少",
  "score.scoreValue.decrement": "减少获得分数",
  "score.scoreValue.increment": "增加获得分数",
  "score.setScore": "设置为 {score} 分",
  "score.accessible.value": "{score} / {total} 分",
  "score.rating.item.active": "{score} / {total}，已获得",
  "score.rating.item.inactive": "{score} / {total}，未获得",
  "score.separator": "/",
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
function Yn(e, n) {
  const o = zP[e] ?? e;
  return Object.entries(n ?? {}).reduce((i, [l, c]) => i.replace(new RegExp(`\\{${l}\\}`, "g"), String(c)), o);
}
const BP = `
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
  font-size: 38px;
}

.chips-score-card__rating--hearts .ant-rate {
  color: #ff3b30;
}

.chips-score-card__numeric {
  display: inline-flex;
  align-items: baseline;
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
  color: rgba(0, 0, 0, 0.36);
  font-size: 24px;
  font-weight: 600;
}

.chips-score-card__numeric-total {
  color: #6e6e73;
  font-size: 22px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
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
function hf(e) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2
  }).format(e);
}
function DP(e) {
  return e.style === "hearts" ? "heart" : "star";
}
function jP(e, n, o) {
  const l = DP(e) === "heart";
  return /* @__PURE__ */ Ne.jsxs(Ne.Fragment, { children: [
    /* @__PURE__ */ Ne.jsx("span", { className: "chips-score-card__sr-only", id: o, children: n }),
    /* @__PURE__ */ Ne.jsx(
      Nv,
      {
        "aria-labelledby": o,
        className: [
          "chips-score-card__rating",
          l ? "chips-score-card__rating--hearts" : ""
        ].filter(Boolean).join(" "),
        count: e.total_score,
        character: l ? /* @__PURE__ */ Ne.jsx(Fv, {}) : void 0,
        disabled: !0,
        value: e.score
      }
    )
  ] });
}
function HP({ config: e }) {
  const n = hf(e.score), o = hf(e.total_score), i = Lv(e), l = hf(i * 100), c = Yn("score.accessible.value", {
    score: n,
    total: o
  }), f = Se.useId(), p = Se.useId();
  return /* @__PURE__ */ Ne.jsx("div", { className: "chips-score-card", "data-card-type": e.card_type, "data-score-style": e.style, children: /* @__PURE__ */ Ne.jsxs(
    "div",
    {
      className: [
        "chips-score-card__surface",
        qo(e.style) ? "chips-score-card__surface--symbols" : ""
      ].filter(Boolean).join(" "),
      children: [
        qo(e.style) ? jP(e, c, p) : null,
        e.style === "score" ? /* @__PURE__ */ Ne.jsxs("div", { className: "chips-score-card__numeric", role: "img", "aria-label": c, children: [
          /* @__PURE__ */ Ne.jsx("span", { "aria-hidden": "true", className: "chips-score-card__numeric-score", children: n }),
          /* @__PURE__ */ Ne.jsx("span", { "aria-hidden": "true", className: "chips-score-card__numeric-separator", children: "/" }),
          /* @__PURE__ */ Ne.jsx("span", { "aria-hidden": "true", className: "chips-score-card__numeric-total", children: o })
        ] }) : null,
        e.style === "progress" ? /* @__PURE__ */ Ne.jsxs("div", { className: "chips-score-card__progress", children: [
          /* @__PURE__ */ Ne.jsx("span", { className: "chips-score-card__sr-only", id: f, children: c }),
          /* @__PURE__ */ Ne.jsx(
            _v,
            {
              "aria-labelledby": f,
              "aria-valuetext": Yn("score.progress.percent", { percent: l }),
              className: "chips-score-card__progress-control",
              percent: i * 100,
              showInfo: !1,
              size: ["100%", 14]
            }
          ),
          /* @__PURE__ */ Ne.jsxs("div", { className: "chips-score-card__progress-meta", "aria-hidden": "true", children: [
            /* @__PURE__ */ Ne.jsxs("span", { className: "chips-score-card__progress-score", children: [
              n,
              " / ",
              o
            ] }),
            /* @__PURE__ */ Ne.jsx("span", { className: "chips-score-card__progress-percent", children: Yn("score.progress.percent", { percent: l }) })
          ] })
        ] }) : null
      ]
    }
  ) });
}
function VP(e) {
  const { container: n, config: o } = e;
  for (; n.firstChild; )
    n.removeChild(n.firstChild);
  const i = document.createElement("div");
  i.setAttribute("data-chips-basecard-view-root", "true"), i.style.width = "100%", n.appendChild(i);
  const l = {
    root: j0.createRoot(i)
  };
  return Ja.flushSync(() => {
    l.root.render(
      Se.createElement(
        Se.Fragment,
        null,
        Se.createElement("style", null, BP),
        Se.createElement(
          yo,
          { locale: Tv, theme: Iv },
          Se.createElement(HP, {
            config: o
          })
        )
      )
    );
  }), () => {
    for (l.root.unmount(); n.firstChild; )
      n.removeChild(n.firstChild);
  };
}
const WP = `
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
  font-size: 30px;
}

.chips-score-editor__rating--hearts .ant-rate {
  color: #ff3b30;
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
  color: #ff3b30;
  font-size: 13px;
}

.chips-basecard-editor__errors-list {
  margin: 0;
  padding-left: 18px;
}
`, UP = {
  stars: "score.style.stars",
  hearts: "score.style.hearts",
  score: "score.style.score",
  progress: "score.style.progress"
};
function mf(e) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2
  }).format(e);
}
function qP(e) {
  return e.style === "hearts" ? "heart" : "star";
}
function XP(e) {
  const [n, o] = h.useState(() => Br(e.initialConfig)), i = h.useRef(n), [l, c] = h.useState(
    () => Aa(Br(e.initialConfig)).errors
  ), f = h.useMemo(() => Lv(n), [n]), p = mf(n.score), g = mf(n.total_score), m = mf(f * 100), v = Se.useId(), y = Se.useId(), w = Se.useId();
  h.useEffect(() => {
    const b = Br(e.initialConfig);
    i.current = b, o(b), c(Aa(b).errors);
  }, [e.initialConfig]);
  function x(b) {
    const $ = Br({
      ...i.current,
      ...b
    }), _ = Aa($);
    i.current = $, o($), c(_.errors), _.valid && e.onChange($);
  }
  const E = Zd.map((b) => ({
    value: b,
    label: Yn(UP[b])
  }));
  Yn("score.accessible.value", {
    score: p,
    total: g
  });
  const C = qP(n) === "heart";
  return /* @__PURE__ */ Ne.jsxs("div", { className: "chips-basecard-editor chips-basecard-editor--standard", children: [
    /* @__PURE__ */ Ne.jsxs("section", { className: "chips-score-editor__group", "aria-labelledby": v, children: [
      /* @__PURE__ */ Ne.jsx("div", { className: "chips-score-editor__label", id: v, children: Yn("score.style") }),
      /* @__PURE__ */ Ne.jsx(
        s2,
        {
          "aria-labelledby": v,
          className: "chips-score-editor__segmented",
          options: E,
          value: n.style,
          onChange: (b) => {
            const $ = b;
            x({
              style: $,
              total_score: qo($) ? _i : n.total_score
            });
          }
        }
      )
    ] }),
    /* @__PURE__ */ Ne.jsxs("section", { className: "chips-score-editor__group", "aria-labelledby": y, children: [
      /* @__PURE__ */ Ne.jsx("div", { className: "chips-score-editor__label", id: y, children: Yn("score.earnedScore") }),
      qo(n.style) ? /* @__PURE__ */ Ne.jsx(
        Nv,
        {
          "aria-labelledby": y,
          className: [
            "chips-score-editor__rating",
            C ? "chips-score-editor__rating--hearts" : ""
          ].filter(Boolean).join(" "),
          count: _i,
          character: C ? /* @__PURE__ */ Ne.jsx(Fv, {}) : void 0,
          value: n.score,
          onChange: (b) => {
            x({ score: b, total_score: _i });
          }
        }
      ) : /* @__PURE__ */ Ne.jsxs("div", { className: "chips-score-editor__number-grid", children: [
        /* @__PURE__ */ Ne.jsxs("div", { className: "chips-score-editor__number-field", children: [
          /* @__PURE__ */ Ne.jsx("div", { className: "chips-score-editor__label", children: Yn("score.totalScore") }),
          /* @__PURE__ */ Ne.jsx(
            vd,
            {
              className: "chips-score-editor__number-input",
              max: Ka,
              min: 1,
              step: 0.1,
              value: n.total_score,
              onChange: (b) => {
                x({ total_score: b ?? 1 });
              }
            }
          )
        ] }),
        /* @__PURE__ */ Ne.jsxs("div", { className: "chips-score-editor__number-field", children: [
          /* @__PURE__ */ Ne.jsx("div", { className: "chips-score-editor__label", children: Yn("score.scoreValue") }),
          /* @__PURE__ */ Ne.jsx(
            vd,
            {
              className: "chips-score-editor__number-input",
              max: n.total_score,
              min: 0,
              step: 0.1,
              value: n.score,
              onChange: (b) => {
                x({ score: b ?? 0 });
              }
            }
          )
        ] })
      ] }),
      n.style === "progress" ? /* @__PURE__ */ Ne.jsxs("div", { className: "chips-score-editor__preview", children: [
        /* @__PURE__ */ Ne.jsx("span", { className: "chips-score-editor__sr-only", id: w, children: Yn("score.progressPreview", {
          score: p,
          total: g,
          percent: m
        }) }),
        /* @__PURE__ */ Ne.jsx(
          _v,
          {
            "aria-labelledby": w,
            "aria-valuetext": Yn("score.progress.percent", { percent: m }),
            percent: f * 100,
            showInfo: !1,
            size: ["100%", 12]
          }
        ),
        /* @__PURE__ */ Ne.jsxs("div", { "aria-hidden": "true", className: "chips-score-editor__preview-value", children: [
          p,
          " / ",
          g
        ] })
      ] }) : null,
      /* @__PURE__ */ Ne.jsx("div", { className: "chips-basecard-editor__errors", children: Object.keys(l).length > 0 ? /* @__PURE__ */ Ne.jsx("ul", { className: "chips-basecard-editor__errors-list", children: Object.entries(l).map(([b, $]) => /* @__PURE__ */ Ne.jsx("li", { children: Yn($, { max: Ka }) }, b)) }) : null })
    ] })
  ] });
}
function GP(e) {
  const n = document.createElement("div");
  n.setAttribute("data-chips-basecard-editor-root", "true"), n.style.width = "100%", n.style.height = "100%", n.style.minHeight = "0";
  const o = j0.createRoot(n);
  return Ja.flushSync(() => {
    o.render(
      /* @__PURE__ */ Ne.jsxs(yo, { locale: Tv, theme: Iv, children: [
        /* @__PURE__ */ Ne.jsx("style", { children: WP }),
        /* @__PURE__ */ Ne.jsx(XP, { ...e })
      ] })
    );
  }), n.__chipsDispose = () => {
    o.unmount();
  }, n;
}
function gf(e) {
  return {
    height: e.style.height,
    minHeight: e.style.minHeight,
    width: e.style.width,
    overflow: e.style.overflow,
    display: e.style.display
  };
}
function yf(e, n) {
  e.style.height = n.height, e.style.minHeight = n.minHeight, e.style.width = n.width, e.style.overflow = n.overflow, e.style.display = n.display;
}
function YP(e) {
  const n = e.container.ownerDocument, o = n.documentElement, i = n.body, l = gf(o), c = gf(i), f = gf(e.container);
  for (o.style.width = "100%", o.style.height = "100%", o.style.minHeight = "0", o.style.overflow = "hidden", i.style.width = "100%", i.style.height = "100%", i.style.minHeight = "0", i.style.overflow = "hidden", e.container.style.display = "flex", e.container.style.width = "100%", e.container.style.height = "100%", e.container.style.minHeight = "0", e.container.style.overflow = "hidden"; e.container.firstChild; )
    e.container.removeChild(e.container.firstChild);
  const p = GP({
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
    for (p.__chipsDispose?.(), yf(o, l), yf(i, c), yf(e.container, f); e.container.firstChild; )
      e.container.removeChild(e.container.firstChild);
  };
}
function KP(e) {
  return VP(e);
}
function QP(e) {
  return YP(e);
}
const ZP = {
  name: "star",
  decorative: !0
}, eR = {
  pluginId: "chips.basecard.score",
  cardType: "base.score",
  displayName: "评分基础卡片",
  description: "用星星、爱心、数字分数或进度条展示评分数据。",
  icon: ZP,
  aliases: ["ScoreCard"],
  commitDebounceMs: 260,
  createInitialConfig(e) {
    return Br(
      Oi
    );
  },
  normalizeConfig(e, n) {
    return Br(e);
  },
  validateConfig(e) {
    return Aa(
      Br(e)
    );
  },
  collectResourcePaths(e) {
    return [];
  },
  renderView(e) {
    return KP({
      container: e.container,
      config: Br(e.config),
      themeCssText: e.themeCssText,
      resolveResourceUrl: e.resolveResourceUrl,
      releaseResourceUrl: e.releaseResourceUrl,
      openResource: e.openResource
    });
  },
  renderEditor(e) {
    return QP({
      container: e.container,
      initialConfig: Br(e.initialConfig),
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
  eR as basecardDefinition,
  QP as renderBasecardEditor,
  KP as renderBasecardView
};
