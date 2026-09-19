import { describe, expect, it } from 'vitest';

import {
  COVERAGE_METRICS,
  COVERAGE_REPORT_PATHS,
  COVERAGE_THRESHOLDS,
  CORE_RUST_CRATE_PREFIX,
  CORE_SHARED_COVERAGE_THRESHOLD,
  OVERALL_COVERAGE_THRESHOLD,
  SHARED_LAYER_GLOBS,
} from '../src/thresholds';

describe('覆盖率阈值单一事实源', () => {
  it('总体口径为 80%，核心与共享层为 90%', () => {
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

  it('统计维度固定为行、函数、分支、语句四项', () => {
    expect(COVERAGE_METRICS).toEqual(['lines', 'functions', 'branches', 'statements']);
  });

  it('共享层 glob 覆盖 @chips/ui 与 @chips/bridge', () => {
    expect(SHARED_LAYER_GLOBS).toEqual(['packages/ui/**', 'packages/bridge/**']);
  });

  it('Rust 核心 crate 前缀指向 core-rust/crates/chips-', () => {
    expect(CORE_RUST_CRATE_PREFIX).toBe('packages/core-rust/crates/chips-');
  });

  it('报告路径口径固定，供根脚本与门禁共用', () => {
    expect(COVERAGE_REPORT_PATHS).toEqual({
      vitestSummary: 'coverage/ts/coverage-summary.json',
      tarpaulinJson: 'coverage/rust/tarpaulin-report.json',
      outputDir: 'reports/coverage',
    });
  });
});
