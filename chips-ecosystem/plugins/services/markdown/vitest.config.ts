import { defineConfig } from 'vitest/config';

/**
 * 服务插件测试配置：node 环境（纯处理服务，无 UI、无 DOM 依赖）。
 *
 * 断言全部落在真实解析输出上（HTML 字符串与结构化块），不 mock 解析内核；
 * XSS 用例按恶意输入臂逐条断言转义与协议白名单行为。
 */
export default defineConfig({
  test: {
    name: '@chips/plugin-markdown',
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/dist/**'],
    },
  },
});
