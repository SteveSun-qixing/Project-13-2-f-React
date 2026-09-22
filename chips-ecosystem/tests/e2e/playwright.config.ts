import { defineConfig } from '@playwright/test';

/**
 * 薯片生态 E2E 配置（Playwright Electron）。
 *
 * 应用必须从构建产物启动（《05-测试规范》§六）：先 `pnpm build`，再 `pnpm test:e2e`。
 * 失败产物（trace / 截图 / 视频）写入 `test-results/`，供《03-调试指南》定位。
 *
 * project 划分：
 * - `harness`：E2E 骨架自检（受控夹具应用），任何环境都必须可执行并通过；
 * - `golden-chain-w2`：W2 金链路（刀7 / 任务 #114 段B，真进程 document:* + 取视图通道，
 *   保存落盘不在面内）——`CHIPS_E2E_REQUIRE_APP=1` 必跑且绿（CI 门禁），
 *   `CHIPS_E2E_GOLDEN_PATH=1` 亦可显式启用；
 * - `golden-path`：含保存落盘与 DOM 回流断言臂的全链路骨架——金链路刀6 裁定落盘权威
 *   归 chips-resource（Rust 侧能力面已交付，W3 在途）；落盘链路的生产注册依赖工单 036
 *   收口（§11.3 Neon 暴露面尚无文档 scope/storage 端口载体，正式适配器未接线，`document:*`
 *   维持诚实回退），该套件随工单 036 收口转正；在此之前维持显式
 *   `CHIPS_E2E_GOLDEN_PATH=1` 启用形态（不再随 `CHIPS_E2E_REQUIRE_APP` 自动纳入，
 *   登记见工单 036 与开发日志刀7）。
 */

const requireHostApp = process.env.CHIPS_E2E_REQUIRE_APP === '1';
const goldenPathEnabled = process.env.CHIPS_E2E_GOLDEN_PATH === '1';
const goldenChainEnabled = requireHostApp || goldenPathEnabled;

if (!goldenChainEnabled) {
  process.stdout.write(
    '[chips-e2e] 金链路 project 未启用（默认关闭）：执行 pnpm build 后使用 ' +
      'CHIPS_E2E_GOLDEN_PATH=1 pnpm test:e2e 启用；CI 门禁使用 CHIPS_E2E_REQUIRE_APP=1' +
      '（门禁面必跑 golden-chain-w2；含保存落盘臂的 golden-path 套件维持显式 ' +
      'CHIPS_E2E_GOLDEN_PATH=1 启用，随工单 036 收口转正）。\n'
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
    ...(goldenChainEnabled
      ? [
          {
            name: 'golden-chain-w2',
            testMatch: /golden-chain-w2\.spec\.ts/,
          },
        ]
      : []),
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
