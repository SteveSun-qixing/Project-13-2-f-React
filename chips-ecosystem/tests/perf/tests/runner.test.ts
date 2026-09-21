import { describe, expect, it } from 'vitest';
import {
  assertValidAdapter,
  validateMetricSamples,
  type AdapterRunContext,
  type AdapterRunResult,
  type PerfAdapter,
} from '../src/adapters';
import { PerfError } from '../src/errors';
import { MARKERS, type ScenarioId } from '../src/scenarios';
import { measureScenario, type MeasureScenarioRequest } from '../src/runner';
import { DEFAULT_CONFIG } from '../src/thresholds';
import { makeReport } from './helpers';

const GENERATED_AT = '2026-09-19T00:00:00.000Z';

const META = {
  buildType: 'release' as const,
  deviceLabel: 'runner-test',
  platform: 'test',
  nodeVersion: 'v0.0.0-test',
};

function cardMarkers(
  iteration: number,
  parseMs: number,
  frameReadyMs: number,
  commitMs: number
): AdapterRunResult {
  const accept = 2;
  const scheduling = 3;
  const base = 1000 + iteration;
  const parsed = base + accept + parseMs;
  const created = parsed + scheduling;
  const ready = created + frameReadyMs;
  return {
    markers: [
      { name: MARKERS.openCalled, at: base },
      { name: MARKERS.requestAccepted, at: base + accept },
      { name: MARKERS.documentParsed, at: parsed },
      { name: MARKERS.frameCreated, at: created },
      { name: MARKERS.frameReady, at: ready },
      { name: MARKERS.firstFrameCommit, at: ready + commitMs },
    ],
  };
}

function adapterOf(partial: Pick<PerfAdapter, 'id' | 'provides' | 'run'>): PerfAdapter {
  return {
    id: partial.id,
    title: `测试适配器 ${partial.id}`,
    description: '测试专用',
    provides: partial.provides,
    run: partial.run,
  };
}

function runOptions(adapter: PerfAdapter, scenarioId: ScenarioId): MeasureScenarioRequest {
  return { scenarioId, adapter, config: DEFAULT_CONFIG, meta: META, generatedAt: GENERATED_AT };
}

describe('测量编排（runner）', () => {
  it('标记点场景多轮取中位数并分解阶段', async () => {
    const adapter = adapterOf({
      id: 'card-fast',
      provides: ['open-card'],
      run: (context: AdapterRunContext): Promise<AdapterRunResult> =>
        Promise.resolve(cardMarkers(context.iteration, 26, 28, 20)),
    });
    const report = await measureScenario(runOptions(adapter, 'open-card'));
    const metric = report.metrics[0];
    expect(metric?.metricId).toBe('open_card_ms');
    expect(metric?.samples).toHaveLength(DEFAULT_CONFIG.measurement.rounds);
    expect(metric?.verdict).toBe('pass');
    expect(report.phases).toHaveLength(3);
    expect(report.phases.map((phase) => phase.stats.median)).toEqual([26, 28, 20]);
    expect(report.phases.every((phase) => phase.verdict === 'pass')).toBe(true);
    expect(report.summary.verdict).toBe('pass');
  });

  it('标记点场景超标时指标与阶段同时失败', async () => {
    const adapter = adapterOf({
      id: 'card-slow',
      provides: ['open-card'],
      run: (context: AdapterRunContext): Promise<AdapterRunResult> =>
        Promise.resolve(cardMarkers(context.iteration, 50, 52, 36)),
    });
    const report = await measureScenario(runOptions(adapter, 'open-card'));
    expect(report.metrics[0]?.verdict).toBe('fail');
    expect(report.phases.filter((phase) => phase.verdict === 'fail')).toHaveLength(3);
    expect(report.summary.verdict).toBe('fail');
  });

  it('帧场景按分桶帧率判定并可携带显式样本', async () => {
    // 门禁为 ≥ 60 fps（工单045 算子修口，值不变）：夹具取 62 fps（620 个帧间隔恰好覆盖 10 s，分桶 10 个）。
    const timestamps = Array.from({ length: 621 }, (_, index) => index * (1000 / 62));
    const adapter = adapterOf({
      id: 'frames',
      provides: ['scroll-fps'],
      run: (): Promise<AdapterRunResult> =>
        Promise.resolve({
          frameTimestampsMs: timestamps,
          metricSamples: { render_update_ms: [9, 9.5, 10] },
        }),
    });
    const report = await measureScenario(runOptions(adapter, 'scroll-fps'));
    const fps = report.metrics.find((metric) => metric.metricId === 'sustained_fps');
    const update = report.metrics.find((metric) => metric.metricId === 'render_update_ms');
    expect(fps?.verdict).toBe('pass');
    expect(fps?.samples).toHaveLength(10);
    expect(update?.verdict).toBe('pass');
    expect(report.summary.verdict).toBe('pass');
  });

  it('60Hz 零掉帧流全管线终判：10 桶均值恰 60.00 按 ≥ 60 判过（工单045 gte 算子修口）', async () => {
    // 60Hz VSync 参考机上限事实：600 个帧间隔（间隔 1000/60 ms）恰好覆盖 10 s，
    // 1 s 分桶 10 桶 × 60 fps，均值恰为 60.00——gte 语义下终判达标。
    const timestamps = Array.from({ length: 601 }, (_, index) => index * (1000 / 60));
    const adapter = adapterOf({
      id: 'frames-60hz',
      provides: ['scroll-fps'],
      run: (): Promise<AdapterRunResult> =>
        Promise.resolve({
          frameTimestampsMs: timestamps,
          metricSamples: { render_update_ms: [9, 9.5, 10] },
        }),
    });
    const report = await measureScenario(runOptions(adapter, 'scroll-fps'));
    const fps = report.metrics.find((metric) => metric.metricId === 'sustained_fps');
    expect(fps?.samples).toEqual([60, 60, 60, 60, 60, 60, 60, 60, 60, 60]);
    expect(fps?.stats?.mean).toBe(60);
    expect(fps?.gate.comparison).toBe('gte');
    expect(fps?.verdict).toBe('pass');
    expect(report.summary.verdict).toBe('pass');
  });

  it('帧采样时长不足协议要求时拒绝测量', async () => {
    const adapter = adapterOf({
      id: 'frames-short',
      provides: ['scroll-fps'],
      run: (): Promise<AdapterRunResult> =>
        Promise.resolve({
          frameTimestampsMs: Array.from({ length: 121 }, (_, index) => index * (1000 / 60)),
        }),
    });
    await expect(measureScenario(runOptions(adapter, 'scroll-fps'))).rejects.toThrowError(
      PerfError
    );
  });

  it('内存场景取稳定态中位数', async () => {
    const adapter = adapterOf({
      id: 'memory',
      provides: ['idle-memory'],
      run: (): Promise<AdapterRunResult> =>
        Promise.resolve({
          memorySamples: [
            { at: 0, rssBytes: 300 * 1024 * 1024 },
            { at: 600_000, rssBytes: 420 * 1024 * 1024 },
            { at: 660_000, rssBytes: 430 * 1024 * 1024 },
          ],
        }),
    });
    const report = await measureScenario(runOptions(adapter, 'idle-memory'));
    expect(report.metrics[0]?.verdict).toBe('pass');
    expect(report.metrics[0]?.samples).toEqual([420, 430]);
  });

  it('样本场景缺测记为 no-data', async () => {
    const adapter = adapterOf({
      id: 'samples-partial',
      provides: ['kernel-latency'],
      run: (): Promise<AdapterRunResult> =>
        Promise.resolve({ metricSamples: { plugin_load_ms: [70, 72, 74] } }),
    });
    const report = await measureScenario(runOptions(adapter, 'kernel-latency'));
    expect(report.metrics.find((metric) => metric.metricId === 'plugin_load_ms')?.verdict).toBe(
      'pass'
    );
    expect(
      report.metrics.find((metric) => metric.metricId === 'kernel_service_call_us')?.verdict
    ).toBe('no-data');
    expect(report.summary.verdict).toBe('no-data');
  });

  it('适配器未声明场景或缺少信号时抛出 PerfError', async () => {
    const adapter = adapterOf({
      id: 'empty',
      provides: ['open-card'],
      run: (): Promise<AdapterRunResult> => Promise.resolve({}),
    });
    await expect(measureScenario(runOptions(adapter, 'open-card'))).rejects.toThrowError(PerfError);
    await expect(measureScenario(runOptions(adapter, 'open-box'))).rejects.toThrowError(PerfError);
  });

  it('适配器上报未声明指标时抛出 PerfError', async () => {
    const adapter = adapterOf({
      id: 'extra-metric',
      provides: ['kernel-latency'],
      run: (): Promise<AdapterRunResult> =>
        Promise.resolve({ metricSamples: { open_card_ms: [80] } }),
    });
    await expect(measureScenario(runOptions(adapter, 'kernel-latency'))).rejects.toThrowError(
      PerfError
    );
  });

  it('适配器契约校验与样本校验', () => {
    expect(() => assertValidAdapter(null)).toThrowError(PerfError);
    expect(() =>
      assertValidAdapter({
        id: 'x',
        title: 'x',
        description: 'x',
        provides: ['unknown'],
        run: () => Promise.resolve({}),
      })
    ).toThrowError(PerfError);
    expect(validateMetricSamples(undefined)).toEqual({});
    expect(validateMetricSamples({ open_card_ms: [1, 2] })).toEqual({ open_card_ms: [1, 2] });
    expect(() => validateMetricSamples({ open_card_ms: [] })).toThrowError(PerfError);
    expect(() => validateMetricSamples({ open_card_ms: [Number.NaN] })).toThrowError(PerfError);
    expect(() => validateMetricSamples({ unknown: [1] })).toThrowError(PerfError);
  });

  it('报告元数据记录适配器、构建类型与生成时间', async () => {
    const adapter = adapterOf({
      id: 'card-meta',
      provides: ['open-card'],
      run: (context: AdapterRunContext): Promise<AdapterRunResult> =>
        Promise.resolve(cardMarkers(context.iteration, 26, 28, 20)),
    });
    const report = await measureScenario(runOptions(adapter, 'open-card'));
    expect(report.meta.adapterId).toBe('card-meta');
    expect(report.meta.buildType).toBe('release');
    expect(report.meta.generatedAt).toBe(GENERATED_AT);
    expect(report.meta.reportId).toBe(`open-card@${GENERATED_AT}`);
    expect(makeReport({ samples: { open_card_ms: [80] } }).meta.scenarioId).toBe('open-card');
  });
});
