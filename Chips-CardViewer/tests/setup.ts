import { vi } from "vitest";

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverMock;
}

const createMatchMediaMock = (query: string) => ({
  matches: query.includes("prefers-reduced-motion: reduce"),
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
