import { defineConfig } from 'vitest/config';

/**
 * E2E 骨架单测配置：只覆盖启动器参数构造、环境解析、工作区装配与夹具校验等
 * 不依赖 Electron 运行时的纯逻辑；真实 Electron 链路由 `specs/` 下的 Playwright
 * 用例覆盖（`pnpm test:e2e`）。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
