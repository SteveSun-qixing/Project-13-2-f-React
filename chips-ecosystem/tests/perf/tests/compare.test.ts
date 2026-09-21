import { describe, expect, it } from 'vitest';
import {
  compareReports,
  comparisonExitCode,
  comparisonFileName,
  comparisonToJson,
  comparisonToMarkdown,
  type ComparisonReport,
} from '../src/compare';
import { DEFAULT_CONFIG } from '../src/thresholds';
import { spread } from './helpers';
import { makeReport } from './helpers';

const COMPARE_AT = '2026-09-19T00:00:10.000Z';

function compare(
  baselineSamples: Parameters<typeof makeReport>[0]['samples'],
  candidateSamples: Parameters<typeof makeReport>[0]['samples'],
  overrides: {
    readonly baselineBuildType?: 'release' | 'debug';
    readonly candidateBuildType?: 'release' | 'debug';
    readonly baselineDevice?: string;
    readonly candidateDevice?: string;
  } = {}
): ComparisonReport {
  return compareReports(
    makeReport({
      samples: baselineSamples,
      buildType: overrides.baselineBuildType ?? 'release',
      deviceLabel: overrides.baselineDevice ?? 'device-a',
    }),
    makeReport({
      samples: candidateSamples,
      buildType: overrides.candidateBuildType ?? 'release',
      deviceLabel: overrides.candidateDevice ?? 'device-a',
    }),
    DEFAULT_CONFIG,
    { generatedAt: COMPARE_AT }
  );
}

function statusOf(report: ComparisonReport, metricId: string): string | undefined {
  return report.metrics.find((metric) => metric.metricId === metricId)?.status;
}

describe('回归比较（compare）', () => {
  it('容差内的轻微劣化判定通过', () => {
    const report = compare({ open_card_ms: spread(80) }, { open_card_ms: spread(84) });
    expect(statusOf(report, 'open_card_ms')).toBe('pass');
    expect(report.summary.verdict).toBe('pass');
    expect(comparisonExitCode(report)).toBe(0);
    expect(report.metrics[0]?.deltaPercent).toBeCloseTo(5, 4);
    expect(report.metrics[0]?.allowedDelta).toBeCloseTo(8, 4);
  });

  it('超出相对容差判定回归劣化', () => {
    const report = compare({ open_card_ms: spread(80) }, { open_card_ms: spread(95) });
    expect(statusOf(report, 'open_card_ms')).toBe('regression');
    expect(report.summary.regressions).toBe(1);
    expect(report.summary.verdict).toBe('fail');
    expect(comparisonExitCode(report)).toBe(1);
  });

  it('绝对噪声下限阻止小绝对值指标的假回归', () => {
    const within = compare({ open_card_ms: spread(5) }, { open_card_ms: spread(6) });
    expect(statusOf(within, 'open_card_ms')).toBe('pass');
    const beyond = compare({ open_card_ms: spread(5) }, { open_card_ms: spread(6.5) });
    expect(statusOf(beyond, 'open_card_ms')).toBe('regression');
  });

  it('绝对门禁失败优先判定为 gate-fail', () => {
    const report = compare({ open_card_ms: spread(80) }, { open_card_ms: spread(104) });
    expect(statusOf(report, 'open_card_ms')).toBe('gate-fail');
    expect(report.summary.gateFailures).toBe(1);
    expect(comparisonExitCode(report)).toBe(1);
  });

  it('越高越好指标的劣化方向相反', () => {
    const withinTolerance = compare({ sustained_fps: spread(62) }, { sustained_fps: spread(60.5) });
    expect(statusOf(withinTolerance, 'sustained_fps')).toBe('pass');
    const improved = compare({ sustained_fps: spread(62) }, { sustained_fps: spread(70) });
    expect(statusOf(improved, 'sustained_fps')).toBe('pass');
    // 候选仍满足绝对门禁（≥ 60 fps，工单045 算子修口）但相对基线劣化超过 5%：判 regression。
    const regression = compare({ sustained_fps: spread(70) }, { sustained_fps: spread(62) });
    expect(statusOf(regression, 'sustained_fps')).toBe('regression');
    // 候选同时跌破绝对门禁：gate-fail 优先，不降级为 regression。
    const gateFail = compare({ sustained_fps: spread(70) }, { sustained_fps: spread(55) });
    expect(statusOf(gateFail, 'sustained_fps')).toBe('gate-fail');
  });

  it('候选缺测指标记为 no-data 并判失败', () => {
    const report = compare(
      { open_card_ms: spread(80), sustained_fps: spread(62) },
      { sustained_fps: spread(62) }
    );
    expect(statusOf(report, 'open_card_ms')).toBe('no-data');
    expect(report.summary.noData).toBe(1);
    expect(report.summary.verdict).toBe('fail');
  });

  it('候选新增指标记为 no-baseline，仍是绝对门禁的一部分', () => {
    const pass = compare(
      { open_card_ms: spread(80) },
      { open_card_ms: spread(82), idle_memory_mb: spread(400) }
    );
    expect(statusOf(pass, 'idle_memory_mb')).toBe('no-baseline');
    expect(pass.summary.verdict).toBe('pass');
    const fail = compare(
      { open_card_ms: spread(80) },
      { open_card_ms: spread(82), idle_memory_mb: spread(620) }
    );
    expect(statusOf(fail, 'idle_memory_mb')).toBe('gate-fail');
    expect(fail.summary.verdict).toBe('fail');
  });

  it('debug 构建与设备不一致判不可比（退出码 3）', () => {
    const debug = compare(
      { open_card_ms: spread(80) },
      { open_card_ms: spread(150) },
      { candidateBuildType: 'debug' }
    );
    expect(debug.comparability.gatesApplicable).toBe(false);
    expect(debug.summary.verdict).toBe('incomparable');
    expect(comparisonExitCode(debug)).toBe(3);
    const device = compare(
      { open_card_ms: spread(80) },
      { open_card_ms: spread(82) },
      { candidateDevice: 'device-b' }
    );
    expect(device.summary.verdict).toBe('incomparable');
    expect(comparisonExitCode(device)).toBe(3);
  });

  it('比较报告可序列化并渲染 Markdown', () => {
    const report = compare({ open_card_ms: spread(80) }, { open_card_ms: spread(95) });
    expect(JSON.parse(comparisonToJson(report))).toEqual(JSON.parse(JSON.stringify(report)));
    const markdown = comparisonToMarkdown(report);
    expect(markdown).toContain('性能回归比较');
    expect(markdown).toContain('回归劣化');
    expect(markdown).toContain('**文档结束**');
    expect(comparisonFileName(report)).toBe('2026-09-19T00-00-10-000Z-compare-open-card');
  });
});
