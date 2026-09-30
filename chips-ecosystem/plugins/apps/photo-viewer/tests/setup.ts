/**
 * jsdom 测试环境补充：只补齐 jsdom 未实现的浏览器平台面
 * （matchMedia 供 antd 响应式观测、ResizeObserver 供相机视口观测、
 * URL.createObjectURL/revokeObjectURL 供图片字节 → 展示 URL 转换），
 * 不 mock 任何业务行为。
 */

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

if (typeof URL.createObjectURL !== 'function') {
  let objectUrlSequence = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    configurable: true,
    value: (blob: Blob): string => {
      objectUrlSequence += 1;
      return `blob:mock-${objectUrlSequence}-${blob.size}`;
    },
  });
}

if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    configurable: true,
    value: (_url: string): void => undefined,
  });
}
