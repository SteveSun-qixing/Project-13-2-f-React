// 设置 jsdom 环境的基本 DOM 结构
if (typeof document !== 'undefined') {
  if (!document.body) {
    Object.defineProperty(document, 'body', {
      value: {
        appendChild: () => {},
        removeChild: () => {},
        childNodes: [],
      },
      writable: true,
    });
  }
}

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock konva node entry that requires canvas (not available in test env)
import { vi } from 'vitest';
vi.mock('konva/lib/index-node', () => ({}));
vi.mock('canvas', () => ({}));
