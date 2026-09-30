import { defineConfig } from 'vitest/config';

/**
 * 包级测试配置：服务插件为纯处理逻辑，测试环境为 node（无 UI、无 DOM 依赖）。
 *
 * 断言全部落在真实算法输出上（分页预估器、打印几何、输入与选项归一），
 * 不 mock 分页预估内核；诚实抛错臂按已登记码逐字锁定。
 */
export default defineConfig({
  test: {
    name: '@chips/service-htmltopdf',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts'],
    },
  },
});
