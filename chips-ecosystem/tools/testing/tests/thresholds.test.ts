import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  COVERAGE_METRICS,
  COVERAGE_REPORT_PATHS,
  COVERAGE_THRESHOLDS,
  CORE_SHARED_COVERAGE_THRESHOLD,
  OVERALL_COVERAGE_THRESHOLD,
  SHARED_LAYER_GLOBS,
  CORE_RUST_CRATE_PATH_PREFIXES,
} from '../src/thresholds';

interface GatesCoverageSection {
  readonly inputs: { readonly ts: { path: string }; readonly rust: { path: string; json: string } };
  readonly metrics: readonly string[];
  readonly defaultThreshold: number;
  readonly groups: readonly {
    readonly id: string;
    readonly threshold?: number;
    readonly match?: readonly string[];
  }[];
  readonly rust: { readonly coreThreshold?: number; readonly coreMatch?: readonly string[] };
}

const gatesConfig = JSON.parse(
  readFileSync(new URL('../../gates/gates.config.json', import.meta.url), 'utf8')
) as { coverage: GatesCoverageSection };

describe('覆盖率口径装载器（单一事实源 = gates.config.json，工单 017）', () => {
  it('数值与《测试规范》§10.2 / R18 一致：总体 80，核心与共享层 90', () => {
    expect(OVERALL_COVERAGE_THRESHOLD).toBe(80);
    expect(CORE_SHARED_COVERAGE_THRESHOLD).toBe(90);
    expect(COVERAGE_THRESHOLDS.overall).toEqual({
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    });
    expect(COVERAGE_THRESHOLDS.core).toEqual({
      lines: 90,
      functions: 90,
      branches: 90,
      statements: 90,
    });
    expect(COVERAGE_THRESHOLDS.shared).toEqual(COVERAGE_THRESHOLDS.core);
  });

  it('全部导出口径与门禁配置逐项一致（漂移即失败）', () => {
    const coverage = gatesConfig.coverage;
    expect(COVERAGE_METRICS).toEqual(coverage.metrics);
    expect(OVERALL_COVERAGE_THRESHOLD).toBe(coverage.defaultThreshold);
    const shared = coverage.groups.find((group) => group.id === 'shared');
    expect(SHARED_LAYER_GLOBS).toEqual(
      (shared?.match ?? []).map((prefix) => `${prefix.replace(/\/+$/, '')}/**`)
    );
    expect(CORE_SHARED_COVERAGE_THRESHOLD).toBe(coverage.rust.coreThreshold);
    expect(CORE_RUST_CRATE_PATH_PREFIXES).toEqual(coverage.rust.coreMatch);
    expect(COVERAGE_REPORT_PATHS.vitestSummary).toBe(coverage.inputs.ts.path);
    expect(COVERAGE_REPORT_PATHS.tarpaulinJson).toBe(coverage.inputs.rust.json);
  });

  it('统计维度固定为行、函数、分支、语句四项', () => {
    expect(COVERAGE_METRICS).toEqual(['lines', 'functions', 'branches', 'statements']);
  });

  it('共享层清单覆盖 @chips/ui 与 @chips/bridge', () => {
    expect(SHARED_LAYER_GLOBS).toEqual(['packages/ui/**', 'packages/bridge/**']);
  });

  it('Rust 核心统计面按 chips-* crate 前缀登记（含 chips-native 目录归位）', () => {
    expect(CORE_RUST_CRATE_PATH_PREFIXES).toEqual([
      'packages/core-rust/crates/chips-',
      'packages/native/',
    ]);
  });

  it('报告路径口径固定，供根脚本与门禁共用', () => {
    expect(COVERAGE_REPORT_PATHS).toEqual({
      vitestSummary: 'coverage/ts/coverage-summary.json',
      tarpaulinJson: 'coverage/rust/tarpaulin-report.json',
      outputDir: 'reports/coverage',
    });
  });
});
