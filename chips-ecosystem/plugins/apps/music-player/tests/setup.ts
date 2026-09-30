/**
 * jsdom 测试环境补充：只补齐 jsdom 未实现的浏览器平台面，不 mock 任何业务行为。
 *
 * - `matchMedia`：antd 响应式观测所需（母型＝plugins/basecards/music/tests/setup.ts）；
 * - `ResizeObserver`：`@rc-component/resize-observer` 所需；
 * - `AnimationEvent`：React 检测不到该构造器时会摘除 `animationend` 等事件注册，
 *   导致 `onAnimationEnd` 在测试环境永不触发（vp 迁移判例随迁）；
 * - `CSSStyleDeclaration.animation`：jsdom 样式解析缺省时保持空串，避免 rc-motion 读数报错；
 * - `URL.createObjectURL/revokeObjectURL`：封面 blob URL 编排面所需（返回确定性的
 *   伪 URL，仅供断言调用发生，不做真实资源解析）；
 * - `HTMLMediaElement.prototype.play/pause`：jsdom 未实现的媒体面，补为可观测桩
 *   （记录调用并把 paused 置位，供播放状态机在测试环境可推进）。
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

if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    configurable: true,
    value: (object: Blob | MediaSource): string =>
      `blob:mock:${object instanceof Blob ? object.type : 'mediasource'}`,
  });
}

if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    configurable: true,
    value: (): void => undefined,
  });
}

const playCalls: number[] = [];
const pauseCalls: number[] = [];

/** 测试环境媒体元素调用观测口（跨用例累计，测试可读取后清空）。 */
export const mediaElementCalls = {
  get playCount(): number {
    return playCalls.length;
  },
  get pauseCount(): number {
    return pauseCalls.length;
  },
  reset(): void {
    playCalls.length = 0;
    pauseCalls.length = 0;
  },
};

// jsdom 的 play/pause 为「未实现」通道（经 virtualConsole 报错且状态不推进），
// 统一替换为确定性桩：记录调用并真实置位 paused，供播放状态机在测试环境推进。
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  writable: true,
  configurable: true,
  value: function play(this: HTMLMediaElement): Promise<void> {
    playCalls.push(this.currentTime);
    Object.defineProperty(this, 'paused', { value: false, configurable: true });
    return Promise.resolve();
  },
});

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  writable: true,
  configurable: true,
  value: function pause(this: HTMLMediaElement): void {
    pauseCalls.push(this.currentTime);
    Object.defineProperty(this, 'paused', { value: true, configurable: true });
  },
});

export {};
