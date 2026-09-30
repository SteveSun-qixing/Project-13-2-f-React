import { defineConfig } from 'vitest/config';

/** 包级测试配置：服务插件为纯 Node 侧逻辑，使用 node 环境（《测试规范》《代码组织规范》§9）。 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
