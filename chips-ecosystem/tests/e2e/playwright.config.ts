import { defineConfig } from '@playwright/test';

/**
 * 薯片生态 E2E 配置（Playwright Electron）。
 *
 * 应用必须从构建产物启动（《05-测试规范》§六）：先 `pnpm build`，再 `pnpm test:e2e`。
 * 失败产物（trace / 截图 / 视频）写入 `test-results/`，供《03-调试指南》定位。
 *
 * project 划分：
 * - `harness`：E2E 骨架自检（受控夹具应用），任何环境都必须可执行并通过；
 * - `golden-path`：W2 金链路，默认不纳入；由 `CHIPS_E2E_GOLDEN_PATH=1` 启用，
 *   `CHIPS_E2E_REQUIRE_APP=1` 同时启用并强制要求宿主构建产物存在（CI 门禁使用）。
 */

const requireHostApp = process.env.CHIPS_E2E_REQUIRE_APP === '1';
const goldenPathEnabled = requireHostApp || process.env.CHIPS_E2E_GOLDEN_PATH === '1';

if (!goldenPathEnabled) {
  process.stdout.write(
    '[chips-e2e] 金链路 project 未启用（W2 准出前默认关闭）：执行 pnpm build 后使用 ' +
      'CHIPS_E2E_GOLDEN_PATH=1 pnpm test:e2e 启用；CI 门禁使用 CHIPS_E2E_REQUIRE_APP=1。\n'
  );
}

export default defineConfig({
  testDir: './specs',
  testMatch: ['**/*.spec.ts'],
  outputDir: './test-results',
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'harness',
      testMatch: /harness\.spec\.ts/,
    },
    ...(goldenPathEnabled
      ? [
          {
            name: 'golden-path',
            testMatch: /golden-path\.spec\.ts/,
          },
        ]
      : []),
  ],
});
