class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverMock;
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

type AnimationFrameHandle = ReturnType<typeof setTimeout>;
type RequestAnimationFrameGlobal = (callback: FrameRequestCallback) => AnimationFrameHandle;

if (typeof globalThis.requestAnimationFrame !== "function") {
  const requestAnimationFrame: RequestAnimationFrameGlobal = (callback) =>
    setTimeout(() => callback(performance.now()), 16) as unknown as AnimationFrameHandle;
  (globalThis as unknown as { requestAnimationFrame: RequestAnimationFrameGlobal }).requestAnimationFrame =
    requestAnimationFrame;
  (globalThis as unknown as { cancelAnimationFrame: (id: AnimationFrameHandle) => void }).cancelAnimationFrame =
    (id: AnimationFrameHandle) => clearTimeout(id);
}
