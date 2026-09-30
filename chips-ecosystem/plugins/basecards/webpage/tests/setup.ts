/**
 * jsdom 测试环境补充：只补齐 jsdom 未实现的浏览器平台面
 * （matchMedia 供 antd 响应式观测、ResizeObserver 供 @rc-component/resize-observer），
 * 不 mock 任何业务行为。
 */

// React 18 act() 环境声明：测试环境启用 act 语义（消除 "not configured to support act" 警告）。
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (!window.ResizeObserver) {
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: class ResizeObserverStub implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  });
}
