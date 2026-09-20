import { jsx as i, jsxs as d } from 'chips-resource://platform/vendor/react-jsx-runtime.js';
import s from 'chips-resource://platform/vendor/react.js';
import {
  ChipsProvider as C,
  theme as x,
  Spin as A,
  Empty as G,
  Button as m,
} from 'chips-resource://platform/vendor/chips-ui.js';
const k = 'SDK_BRIDGE_UNAVAILABLE',
  b = 'SDK_UNKNOWN_ERROR',
  y = '发生未知错误';
class o extends Error {
  code;
  details;
  retryable;
  constructor(t) {
    (super(t.message),
      (this.name = 'ChipsError'),
      (this.code = t.code),
      (this.details = t.details),
      (this.retryable = t.retryable ?? !1));
  }
}
function I(e) {
  if (typeof e != 'object' || e === null) return !1;
  const t = e;
  return typeof t.code == 'string' && typeof t.message == 'string';
}
function D(e) {
  return e instanceof Error;
}
function K(e) {
  if (e instanceof o) return e;
  if (I(e)) {
    const t = e,
      n = {
        code: t.code,
        message: t.message,
        retryable: t.retryable ?? !1,
        ...(t.details !== void 0 ? { details: t.details } : {}),
      };
    return new o(n);
  }
  return D(e)
    ? new o({
        code: b,
        message: y,
        details: { name: e.name, cause: e.message },
        retryable: !1,
      })
    : new o({
        code: b,
        message: y,
        details: { value: String(e) },
        retryable: !1,
      });
}
function B() {
  return new o({
    code: k,
    message: '未找到可用的 Bridge：window.chips 尚未注入',
    retryable: !1,
  });
}
function T() {
  return globalThis.window?.chips;
}
class U {
  #e;
  constructor(t) {
    this.#e = t;
  }
  /**
   * 解析本次调用的目标 Bridge。
   *
   * @returns 注入目标或当前 `window.chips`
   * @throws ChipsError 两者均不可用时抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  #t() {
    if (this.#e !== void 0) return this.#e;
    const t = T();
    if (t === void 0) throw B();
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
    let a;
    try {
      a = this.#t();
    } catch (l) {
      return Promise.reject(K(l));
    }
    return a.request(t, n);
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
    return this.#t().subscribe(t, n);
  }
  /**
   * 创建 `chips-resource://` 懒打开句柄；转发给目标 Bridge。
   *
   * @param uri - 资源 URI
   * @returns 资源句柄；预检失败由目标同步抛出 `ChipsError`
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  resource(t) {
    return this.#t().resource(t);
  }
}
function L(e) {
  return new U(e?.bridge);
}
const f = L(),
  S = 'chips.example.hello',
  w = `plugins.${S}`,
  N = 'greeting',
  j = `${w}.${N}`,
  O = '你好，世界！',
  V = (e) => (typeof e != 'object' || e === null ? !1 : e.key === j),
  W = () => {
    const { token: e } = x.useToken(),
      [t, n] = s.useState(O),
      [a, l] = s.useState(0),
      [p, g] = s.useState(null),
      [h, E] = s.useState('loading');
    s.useEffect(() => {
      let r = !0;
      (async () => {
        try {
          const c = {
              namespace: w,
              key: N,
            },
            u = await f.request('config:get', c);
          if (!r) return;
          (typeof u.value == 'string' && u.value.length > 0 && n(u.value), E('ready'));
        } catch {
          r && E('error');
        }
      })();
      const v = f.subscribe('config:changed', (c) => {
        !V(c) ||
          typeof c.effectiveValue != 'string' ||
          (c.effectiveValue.length > 0 && n(c.effectiveValue));
      });
      return () => {
        ((r = !1), v.dispose());
      };
    }, []);
    const R = s.useCallback(() => {
        l((r) => r + 1);
      }, []),
      _ = s.useCallback(() => {
        const r = { text: t };
        f.request('clipboard:write', r)
          .then(() => g('问候语已复制到剪贴板'))
          .catch(() => g('复制失败，请检查剪贴板权限'));
      }, [t]);
    return h === 'loading'
      ? /* @__PURE__ */ i(A, {})
      : h === 'error'
        ? /* @__PURE__ */ i(G, { description: '读取应用配置失败' })
        : /* @__PURE__ */ d('section', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: e.marginSM,
              padding: e.padding,
              color: e.colorText,
            },
            children: [
              /* @__PURE__ */ i('p', {
                style: { margin: 0, fontSize: e.fontSizeHeading5 },
                children: t,
              }),
              /* @__PURE__ */ d('div', {
                style: { display: 'flex', flexWrap: 'wrap', gap: e.marginSM },
                children: [
                  /* @__PURE__ */ d(m, {
                    type: 'primary',
                    onClick: R,
                    children: ['点击次数：', a],
                  }),
                  /* @__PURE__ */ i(m, { onClick: _, children: '复制问候语' }),
                ],
              }),
              p !== null
                ? /* @__PURE__ */ i('div', { style: { color: e.colorTextSecondary }, children: p })
                : null,
            ],
          });
  },
  $ = () =>
    /* @__PURE__ */ i(C, { appId: S, surface: 'window', children: /* @__PURE__ */ i(W, {}) });
export { $ as AppView, $ as default };
