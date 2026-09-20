import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * CLI 链进程级 E2E 配置（任务 #88，P1-7 前段）。
 *
 * 与被测宿主无关的纯 Node 子进程链路：不经 Playwright、不适用
 * `CHIPS_E2E_REQUIRE_APP` 门控，任何用例都不默认 skip；根级入口
 * `pnpm test:e2e:cli`（先构建 `@chips/cli` 再运行本套件）。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    root: fileURLToPath(new URL('.', import.meta.url)),
    testTimeout: 240_000,
    hookTimeout: 240_000,
  },
});
