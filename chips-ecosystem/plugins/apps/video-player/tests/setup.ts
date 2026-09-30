/**
 * jsdom 测试环境补充：只补齐 jsdom 未实现的浏览器平台面，不 mock 任何业务行为。
 *
 * - `matchMedia`：antd 响应式观测所需（母型＝plugins/basecards/music/tests/setup.ts）；
 * - `ResizeObserver`：`@rc-component/resize-observer` 所需；
 * - `AnimationEvent`：React 检测不到该构造器时会摘除 `animationend` 等事件注册，
 *   导致 `onAnimationEnd` 在测试环境永不触发（旧仓 tests/unit/__animation-events.ts 判例随迁）；
 * - `CSSStyleDeclaration.animation`：jsdom 样式解析缺省时保持空串，避免 rc-motion 读数报错。
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
      public observe(): void {}
      public unobserve(): void {}
      public disconnect(): void {}
    },
  });
}

if (!('AnimationEvent' in window)) {
  class AnimationEventPolyfill extends Event {
    public animationName = '';
    public elapsedTime = 0;
    public pseudoElement = '';
  }
  Object.defineProperty(window, 'AnimationEvent', {
    value: AnimationEventPolyfill,
    configurable: true,
  });
}

Object.defineProperty(CSSStyleDeclaration.prototype, 'animation', {
  get: (): string => '',
  configurable: true,
});

export {};
