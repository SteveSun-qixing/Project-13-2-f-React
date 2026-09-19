import { describe, expect, it } from 'vitest';
import { PerfError } from '../src/errors';
import { metricDefinition } from '../src/metrics';
import {
  buildMetricResult,
  buildPhaseResult,
  parseReport,
  reportFileName,
  reportToJson,
  reportToMarkdown,
  summarizeMetrics,
  type MetricResult,
} from '../src/report';
import { DEFAULT_CONFIG, resolveThreshold } from '../src/thresholds';
import { makeReport } from './helpers';

function build(
  metricId: Parameters<typeof buildMetricResult>[0]['id'],
  samples: readonly number[]
): MetricResult {
  return buildMetricResult(
    metricDefinition(metricId),
    samples,
    resolveThreshold(metricId, DEFAULT_CONFIG)
  );
}

describe('报告（report）', () => {
  it('达标与超限判定（中位数口径）', () => {
    const pass = build('open_card_ms', [70, 80, 90]);
    expect(pass.verdict).toBe('pass');
    expect(pass.stats?.median).toBe(80);
    const fail = build('open_card_ms', [90, 105, 120]);
    expect(fail.verdict).toBe('fail');
    expect(fail.failures[0]).toContain('未满足 <');
    expect(fail.failures[0]).toContain('R18');
  });

  it('越高越好指标与容量/百分位统计量', () => {
    expect(build('sustained_fps', [58, 62, 61, 63]).verdict).toBe('pass');
    expect(build('sustained_fps', [40, 50, 45]).verdict).toBe('fail');
    expect(build('frame_pool_size', [24, 30, 31]).verdict).toBe('pass');
    expect(build('frame_pool_size', [24, 30, 40]).verdict).toBe('fail');
    expect(build('kernel_event_emit_us', [0.5, 0.6, 0.7, 0.8]).verdict).toBe('pass');
    expect(build('kernel_event_emit_us', [0.5, 0.6, 0.7, 1.4]).verdict).toBe('fail');
  });

  it('空样本记为 no-data', () => {
    const result = build('parse_10mb_ms', []);
    expect(result.verdict).toBe('no-data');
    expect(result.stats).toBeNull();
    expect(result.failures[0]).toContain('无测量数据');
  });

  it('阶段结果按预算上限判定', () => {
    const phase = {
      id: 'p',
      title: '阶段',
      from: 'a',
      to: 'b',
      metricId: 'open_card_ms' as const,
      budgetId: 'open_card.parse',
    };
    const budget = {
      id: 'open_card.parse',
      title: '请求接受 → 解析完成',
      boundMs: 30,
      citation: '《渲染引擎设计》§10.1',
    };
    expect(buildPhaseResult(phase, budget, [20, 25, 28]).verdict).toBe('pass');
    expect(buildPhaseResult(phase, budget, [20, 40, 28]).verdict).toBe('fail');
  });

  it('汇总判定：任一失败即失败；全 no-data 为 no-data', () => {
    expect(
      summarizeMetrics([build('open_card_ms', [80]), build('open_box_ms', [150])]).verdict
    ).toBe('pass');
    expect(
      summarizeMetrics([build('open_card_ms', [80]), build('open_box_ms', [250])]).verdict
    ).toBe('fail');
    expect(summarizeMetrics([build('open_card_ms', []), build('open_box_ms', [])]).verdict).toBe(
      'no-data'
    );
  });

  it('JSON 往返一致，Markdown 含判定与引用', () => {
    const report = makeReport({
      samples: { open_card_ms: [70, 80, 90], sustained_fps: [40, 42, 41] },
    });
    expect(report.summary.verdict).toBe('fail');
    const json = reportToJson(report);
    expect(parseReport(json)).toEqual(report);
    const markdown = reportToMarkdown(report);
    expect(markdown).toContain('打开卡片');
    expect(markdown).toContain('通过');
    expect(markdown).toContain('失败');
    expect(markdown).toContain('R18');
    expect(markdown).toContain('**文档结束**');
  });

  it('parseReport 拒绝版本不匹配与非法字段', () => {
    const report = makeReport({ samples: { open_card_ms: [80] } });
    const wrongVersion = JSON.parse(reportToJson(report)) as Record<string, unknown>;
    wrongVersion['schemaVersion'] = '9.9.9';
    expect(() => parseReport(wrongVersion)).toThrowError(PerfError);
    const badMetric = JSON.parse(reportToJson(report)) as Record<string, unknown>;
    const metrics = badMetric['metrics'] as Record<string, unknown>[];
    if (metrics[0] !== undefined) {
      metrics[0]['metricId'] = 'not_a_metric';
    }
    expect(() => parseReport(badMetric)).toThrowError(PerfError);
    expect(() => parseReport('{')).toThrowError(PerfError);
  });

  it('报告文件名对 ISO 时间戳做安全化', () => {
    const report = makeReport({
      samples: { open_card_ms: [80] },
      generatedAt: '2026-09-19T01:02:03.456Z',
    });
    expect(reportFileName(report)).toBe('2026-09-19T01-02-03-456Z-open-card');
  });
});
