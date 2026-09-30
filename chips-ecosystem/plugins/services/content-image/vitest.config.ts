import { defineConfig } from 'vitest/config';

/**
 * 包级测试配置：服务插件为纯处理逻辑，测试环境为 node（无 UI、无 DOM 依赖）。
 *
 * 断言全部落在真实算法输出上（合成 RGBA 样本 → 颜色与元数据），不 mock 色彩分析内核。
 */
export default defineConfig({
  test: {
    name: '@chips/service-content-image',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
