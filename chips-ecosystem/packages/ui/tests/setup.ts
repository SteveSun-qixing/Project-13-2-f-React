/**
 * DOM 测试补充 setup：补齐 jsdom 缺失的 `matchMedia` 与 `ResizeObserver`，
 * 与 `packages/antd/tests/setup.ts` 同口径（共享层测试不安装任何平台 Mock）。
 */

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
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

if (!('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe(): void {
      return undefined;
    }

    unobserve(): void {
      return undefined;
    }

    disconnect(): void {
      return undefined;
    }
  }

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverStub,
  });
}
