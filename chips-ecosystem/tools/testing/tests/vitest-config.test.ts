import { describe, expect, it } from 'vitest';
import type { UserConfig } from 'vitest/config';

import { defineChipsProject } from '../src/vitest';

const domSetupSuffix = 'dom-setup.ts';

/**
 * vitest 的 coverage 类型按 provider 形成联合（custom 变体不含 thresholds 等键），
 * 工厂恒定产出 `provider: 'v8'` 配置，这里按实际形状读取断言。
 */
interface CoverageView {
  readonly thresholds?: Readonly<Record<string, number>>;
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly reportOnFailure?: boolean;
}

const coverageOf = (config: UserConfig): CoverageView =>
  (config.test?.coverage ?? {}) as CoverageView;

describe('defineChipsProject', () => {
  it('node 环境默认值：globals、测试范围、无 DOM setup、总体 80% 阈值', () => {
    const config = defineChipsProject({ name: '@chips/example' });
    const test = config.test;

    expect(test?.name).toBe('@chips/example');
    expect(test?.environment).toBe('node');
    expect(test?.globals).toBe(true);
    expect(test?.include).toEqual(['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.test.{ts,tsx}']);
    expect(test?.setupFiles).toEqual([]);
    expect(test?.testTimeout).toBe(5_000);
    expect(test?.passWithNoTests).toBe(false);
    expect(config.plugins).toEqual([]);
    const coverage = coverageOf(config);
    expect(coverage.thresholds).toEqual({
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    });
    expect(coverage.reportOnFailure).toBe(true);
    expect(coverage.include).toEqual(['src/**/*.{ts,tsx}']);
  });

  it('jsdom 环境自动注入 React 插件与共享 DOM setup', () => {
    const config = defineChipsProject({ environment: 'jsdom' });

    expect(config.plugins).toHaveLength(1);
    const setupFiles = config.test?.setupFiles ?? [];
    expect(setupFiles).toHaveLength(1);
    expect(String(setupFiles[0])).toMatch(new RegExp(`${domSetupSuffix}$`));
    expect(config.test?.environment).toBe('jsdom');
  });

  it('shared/core 层级使用 90% 阈值，standard 使用 80%', () => {
    expect(coverageOf(defineChipsProject({ tier: 'shared' })).thresholds).toEqual({
      lines: 90,
      functions: 90,
      branches: 90,
      statements: 90,
    });
    expect(coverageOf(defineChipsProject({ tier: 'core' })).thresholds).toEqual({
      lines: 90,
      functions: 90,
      branches: 90,
      statements: 90,
    });
    expect(coverageOf(defineChipsProject({ tier: 'standard' })).thresholds).toEqual({
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    });
  });

  it('coverageExclude 在默认排除项之后叠加，不污染默认值', () => {
    const config = defineChipsProject({ coverageExclude: ['src/index.ts'] });
    const exclude = config.test?.coverage?.exclude ?? [];

    expect(exclude).toContain('src/index.ts');
    expect(exclude).toContain('**/tests/**');
    expect(defineChipsProject().test?.coverage?.exclude).not.toContain('src/index.ts');
  });

  it('调用方可通过 overrides 覆盖默认值', () => {
    const config = defineChipsProject({
      overrides: { testTimeout: 30_000, include: ['tests/**/*.test.ts'] },
    });

    expect(config.test?.testTimeout).toBe(30_000);
    expect(config.test?.include).toEqual(['tests/**/*.test.ts']);
  });

  it('自定义 setup 与 DOM setup 叠加，且不共享同一个数组实例', () => {
    const custom = ['tests/setup.ts'];
    const config = defineChipsProject({ environment: 'jsdom', setupFiles: custom });
    const setupFiles = config.test?.setupFiles ?? [];

    expect(setupFiles).toHaveLength(2);
    expect(setupFiles[1]).toBe('tests/setup.ts');
    expect(setupFiles).not.toBe(custom);
    expect(defineChipsProject().test?.exclude).not.toBe(defineChipsProject().test?.exclude);
  });
});
