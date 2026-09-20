/**
 * 薯片生态 vitest 工作区根配置。
 *
 * - `projects` 只发现“带 vitest 配置的包”，新增包只要提供 `vitest.config.ts`
 *   即自动纳入全仓测试与合并覆盖率；
 * - 合并覆盖率口径单一事实源为 `tools/gates/gates.config.json` 的 `coverage` 段
 *   （G6 为唯一判定面，工单 017），`tools/testing/src/thresholds.ts` 是其装载器；
 *   共享层按 glob 单独设置 vitest 门禁（与 G6 分组同源）；
 * - 报告输出：`coverage/ts/`（text/html/lcov/json-summary）、
 *   `reports/test/vitest.junit.xml`（CI 归档）；
 * - 运行时必须带 `--configLoader runner`（标准脚本已包含）：继承
 *   `@chips/testing/vitest` 工厂的包配置以 TS 源导出，默认 bundle 加载器
 *   会把工作区包外置为 Node ESM 而无法解析。
 */

import { defineConfig } from 'vitest/config';

import {
  COVERAGE_THRESHOLDS,
  OVERALL_COVERAGE_THRESHOLD,
  SHARED_LAYER_GLOBS,
  type CoverageThreshold,
} from './tools/testing/src/thresholds';

const sharedGlobThresholds: Record<string, CoverageThreshold> = {};
for (const glob of SHARED_LAYER_GLOBS) {
  sharedGlobThresholds[glob] = COVERAGE_THRESHOLDS.shared;
}

export default defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.ts',
      'plugins/*/vitest.config.ts',
      'plugins/*/*/vitest.config.ts',
      'tools/*/vitest.config.ts',
      'tests/*/vitest.config.ts',
      'examples/plugins/*/vitest.config.ts',
    ],
    reporters: [
      ['default', {}],
      ['junit', { outputFile: 'reports/test/vitest.junit.xml' }],
    ],
    coverage: {
      provider: 'v8',
      enabled: false,
      reportsDirectory: 'coverage/ts',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportOnFailure: true,
      include: [
        'packages/*/src/**/*.{ts,tsx}',
        'plugins/*/src/**/*.{ts,tsx}',
        'plugins/*/*/src/**/*.{ts,tsx}',
        'tools/*/src/**/*.{ts,tsx}',
        'examples/plugins/*/src/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/tests/**',
        '**/fixtures/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/*-setup.ts',
      ],
      thresholds: {
        lines: OVERALL_COVERAGE_THRESHOLD,
        functions: OVERALL_COVERAGE_THRESHOLD,
        branches: OVERALL_COVERAGE_THRESHOLD,
        statements: OVERALL_COVERAGE_THRESHOLD,
        ...sharedGlobThresholds,
      },
    },
  },
});
