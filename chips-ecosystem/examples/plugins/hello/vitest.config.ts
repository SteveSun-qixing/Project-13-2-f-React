import { defineConfig } from 'vitest/config';

/**
 * 插件测试项目配置：jsdom 环境（组件测试），断言扩展见 ./tests/setup.ts。
 *
 * 平台调用一律在用例内经 `@chips/sdk/testing` 的 `installMockBridge` 安装，
 * 不使用 vi.mock 伪造 window.chips（《测试规范》§2.2）。
 */
export default defineConfig({
  test: {
    name: '@chips/plugin-hello',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/dist/**'],
    },
  },
});
