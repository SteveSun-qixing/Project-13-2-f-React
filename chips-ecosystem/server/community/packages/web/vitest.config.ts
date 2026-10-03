import { defineConfig } from 'vitest/config';

/** 包级测试配置：API 客户端契约测试、会话上下文与页面冒烟（jsdom 环境，fetch 一律注入 mock）。 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/vite-env.d.ts'],
    },
  },
});
