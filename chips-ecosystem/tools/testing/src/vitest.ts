/**
 * 薯片生态 vitest 项目工厂。
 *
 * 各包 `vitest.config.ts` 统一继承本工厂，保证运行环境、测试文件范围、
 * 共享 setup 与覆盖率口径全仓一致：
 *
 * ```ts
 * import { defineChipsProject } from '@chips/testing/vitest';
 *
 * export default defineChipsProject({
 *   name: '@chips/ui',
 *   environment: 'jsdom',
 *   tier: 'shared',
 * });
 * ```
 *
 * 注意：工厂以 TypeScript 源导出（工作区包），vitest 默认的 bundle 配置加载器
 * 会把工作区包外置为 Node ESM，导致无法解析其中的 TS 源。继承本工厂的包，
 * 其 `test` / `test:coverage` 脚本必须带 `--configLoader runner`：
 *
 * ```json
 * { "test": "vitest run --configLoader runner" }
 * ```
 *
 * 覆盖率阈值装载自 `./thresholds`（单一事实源为 `tools/gates/gates.config.json`，
 * G6 为唯一判定面，工单 017）；包内 `test:coverage` 使用 tier 对应的阈值作为
 * vitest 本地守卫，权威判定仍以根脚本 `pnpm gates:coverage`（G6）为准。
 */

import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig, type UserConfig } from 'vitest/config';

import { COVERAGE_THRESHOLDS, type CoverageThreshold } from './thresholds';

/** 覆盖率层级：`standard`（总体 80%）/ `core` / `shared`（90%）。 */
export type ChipsCoverageTier = 'standard' | 'core' | 'shared';

/** {@link defineChipsProject} 的配置项。 */
export interface ChipsProjectOptions {
  /** vitest 项目名；缺省时由 vitest 依据包名推断。 */
  readonly name?: string;
  /** 运行环境；默认 `node`，React/DOM 测试使用 `jsdom`。 */
  readonly environment?: 'node' | 'jsdom';
  /** 覆盖率层级；默认 `standard`。 */
  readonly tier?: ChipsCoverageTier;
  /** 测试文件匹配；默认 `src/**` 与包级 `tests/**` 下的 `*.test.*`。 */
  readonly include?: readonly string[];
  /** 测试文件排除；默认叠加 vitest 默认排除、`dist/` 与契约测试目录。 */
  readonly exclude?: readonly string[];
  /** 追加的 setup 文件；jsdom 环境自动前置共享 DOM setup。 */
  readonly setupFiles?: readonly string[];
  /** 单个用例超时（毫秒）；默认 5000。 */
  readonly testTimeout?: number;
  /** 包内覆盖率统计范围；默认 `src/**`（排除测试、夹具与生成物）。 */
  readonly coverageInclude?: readonly string[];
  /** 追加的覆盖率排除项（在默认排除项之后叠加，用于入口聚合文件等）。 */
  readonly coverageExclude?: readonly string[];
  /** 追加或覆盖的 vitest `test` 配置（同名键整体覆盖）。 */
  readonly overrides?: UserConfig['test'];
}

const DOM_SETUP_FILE = fileURLToPath(new URL('./dom-setup.ts', import.meta.url));

const DEFAULT_INCLUDE: readonly string[] = [
  'src/**/*.{test,spec}.{ts,tsx}',
  'tests/**/*.test.{ts,tsx}',
];

const DEFAULT_EXCLUDE: readonly string[] = [
  ...configDefaults.exclude,
  '**/dist/**',
  '**/tests/contract/**',
];

const DEFAULT_COVERAGE_INCLUDE: readonly string[] = ['src/**/*.{ts,tsx}'];

const DEFAULT_COVERAGE_EXCLUDE: readonly string[] = [
  '**/*.test.{ts,tsx}',
  '**/*.spec.{ts,tsx}',
  '**/tests/**',
  '**/dist/**',
  '**/*.d.ts',
  '**/*-setup.ts',
];

const thresholdFor = (tier: ChipsCoverageTier): CoverageThreshold => {
  if (tier === 'core') {
    return COVERAGE_THRESHOLDS.core;
  }
  if (tier === 'shared') {
    return COVERAGE_THRESHOLDS.shared;
  }
  return COVERAGE_THRESHOLDS.overall;
};

/**
 * 生成薯片生态标准 vitest 项目配置。
 *
 * @param options 项目配置项；`overrides` 中的同名键整体覆盖工厂默认值。
 */
export function defineChipsProject(options: ChipsProjectOptions = {}): UserConfig {
  const environment = options.environment ?? 'node';
  const setupFiles: string[] = [
    ...(environment === 'jsdom' ? [DOM_SETUP_FILE] : []),
    ...(options.setupFiles ?? []),
  ];
  const baseTest: UserConfig['test'] = {
    ...(options.name === undefined ? {} : { name: options.name }),
    environment,
    globals: true,
    include: [...(options.include ?? DEFAULT_INCLUDE)],
    exclude: [...(options.exclude ?? DEFAULT_EXCLUDE)],
    setupFiles,
    testTimeout: options.testTimeout ?? 5_000,
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [...(options.coverageInclude ?? DEFAULT_COVERAGE_INCLUDE)],
      exclude: [...DEFAULT_COVERAGE_EXCLUDE, ...(options.coverageExclude ?? [])],
      thresholds: thresholdFor(options.tier ?? 'standard'),
      reportOnFailure: true,
    },
  };
  return defineConfig({
    plugins: environment === 'jsdom' ? [react()] : [],
    test: { ...baseTest, ...options.overrides },
  });
}
