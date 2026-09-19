import { describe, expect, it } from 'vitest';
import { runSyntheticSelftest, SELFTEST_SCENARIOS } from '../src/fixtures/selftest';
import { DEFAULT_CONFIG } from '../src/thresholds';

const FIXED_TIME = '2026-09-19T00:00:00.000Z';

describe('合成数据端到端自测（selftest）', () => {
  it('达标必过、劣化必拦、回归比较全部可检出', async () => {
    const result = await runSyntheticSelftest({ writeReports: false, generatedAt: FIXED_TIME });
    const failedChecks = result.checks.filter((check) => !check.passed);
    expect(failedChecks.map((check) => `${check.id}: ${check.detail}`)).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.checks.length).toBeGreaterThanOrEqual(8);
  }, 30_000);

  it('覆盖全部登记场景且金/劣两档一一对应', async () => {
    const result = await runSyntheticSelftest({ writeReports: false, generatedAt: FIXED_TIME });
    expect(result.goldenReports.map((report) => report.meta.scenarioId)).toEqual([
      ...SELFTEST_SCENARIOS,
    ]);
    expect(result.regressedReports.map((report) => report.meta.scenarioId)).toEqual([
      ...SELFTEST_SCENARIOS,
    ]);
    expect(result.comparisons).toHaveLength(SELFTEST_SCENARIOS.length);
    for (const report of result.goldenReports) {
      expect(report.summary.verdict).toBe('pass');
    }
    for (const report of result.regressedReports) {
      expect(report.summary.verdict).toBe('fail');
    }
    for (const comparison of result.comparisons) {
      expect(comparison.summary.verdict).toBe('fail');
    }
  }, 30_000);

  it('自测报告的构建类型与 Phase 与配置一致', async () => {
    const result = await runSyntheticSelftest({ writeReports: false, generatedAt: FIXED_TIME });
    for (const report of result.goldenReports) {
      expect(report.meta.buildType).toBe('release');
      expect(report.meta.phase).toBe(DEFAULT_CONFIG.phase);
      expect(report.meta.deviceLabel).toBe('synthetic-device');
    }
  }, 30_000);
});
