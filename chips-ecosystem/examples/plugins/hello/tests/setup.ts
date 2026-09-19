/**
 * 插件测试 setup：只安装断言扩展与 jsdom 缺失的浏览器 API，不伪造平台调用。
 *
 * 平台调用（window.chips）一律在用例内经 `@chips/sdk/testing` 的
 * `installMockBridge()` 安装（《测试规范》§8.1、§8.2）。
 */
import '@testing-library/jest-dom/vitest';

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
