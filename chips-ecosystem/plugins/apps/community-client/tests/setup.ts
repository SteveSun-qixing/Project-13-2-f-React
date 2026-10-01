/**
 * jsdom 测试环境补充：只补齐 jsdom 未实现的浏览器平台面
 * （matchMedia 供 antd 响应式观测、ResizeObserver 供布局观测），
 * 并声明 React 18 act 测试环境（判例同 icon-maker）；不 mock 任何业务行为。
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: (): void => undefined,
      removeListener: (): void => undefined,
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined,
      dispatchEvent: (): boolean => false,
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
