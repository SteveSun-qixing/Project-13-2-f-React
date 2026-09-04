import { createMockChipsClient } from "chips-sdk/testing";

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverMock;
}

// pdf.js 标准 build 在模块顶层实例化 DOMMatrix / Path2D；
// jsdom 不提供这两个 API，测试环境以空实现补齐（测试不执行真实渲染）。
class DOMMatrixStub {
  static fromMatrix(): DOMMatrixStub {
    return new DOMMatrixStub();
  }
}

class Path2DStub {
  addPath(): void {}
}

if (typeof globalThis.DOMMatrix === "undefined") {
  (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrixStub;
}
if (typeof globalThis.Path2D === "undefined") {
  (globalThis as Record<string, unknown>).Path2D = Path2DStub;
}

class IntersectionObserverMock implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  disconnect(): void {}
  observe(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve(): void {}
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  (globalThis as Record<string, unknown>).IntersectionObserver = IntersectionObserverMock;
}

const createMatchMediaMock = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = createMatchMediaMock as unknown as typeof window.matchMedia;
}

if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

if (typeof globalThis.requestAnimationFrame !== "function") {
  const requestAnimationFrame = (callback: FrameRequestCallback): number =>
    setTimeout(() => callback(performance.now()), 16) as unknown as number;
  (globalThis as Record<string, unknown>).requestAnimationFrame = requestAnimationFrame;
  (globalThis as Record<string, unknown>).cancelAnimationFrame = (id: number): void =>
    clearTimeout(id);
}

// jsdom 环境下为 chips-sdk 安装测试宿主桥：src/runtime/chips-client 的真实客户端
// 在 createClient 时检测 window.chips 决定运行环境，缺失桥会退化为 browser
// 环境（命令事件不可用）。这里默认安装 mock host 桥，使测试与插件运行时一致。
const testBridgeClient =
  typeof window !== "undefined" && (window as { chips?: unknown }).chips === undefined
    ? createMockChipsClient()
    : null;
void testBridgeClient;
