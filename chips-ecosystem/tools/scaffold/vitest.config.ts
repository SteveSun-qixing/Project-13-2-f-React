import { defineConfig } from 'vitest/config';

/**
 * `@chips/scaffold` 包级测试配置。
 *
 * 独立配置使本包既可被仓库根 vitest 工作区发现（tools 目录下的 vitest 配置），
 * 也可在包内直接执行 `vitest run`；测试为纯 Node 环境（生成器不触碰 DOM 与磁盘）。
 */
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
