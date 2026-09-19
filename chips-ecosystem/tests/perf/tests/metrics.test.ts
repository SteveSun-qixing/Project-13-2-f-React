import { describe, expect, it } from 'vitest';
import {
  METRICS,
  METRIC_IDS,
  UNIT_LABELS,
  gateValueFor,
  isMetricId,
  metricById,
  metricDefinition,
  phaseBudgetOf,
  type MetricId,
} from '../src/metrics';
import { SCENARIOS, SCENARIO_IDS, scenarioPhaseBudgets } from '../src/scenarios';
import type { StatisticName } from '../src/stats';

/**
 * 冻结期望表：门禁数值与统计口径的唯一来源是权威文档；
 * 本测试防止实现漂移，任何改动必须同步核对文档（R16）。
 */
const FROZEN_GATES: Readonly<
  Record<
    MetricId,
    {
      readonly gate: number;
      readonly phase2?: number;
      readonly statistic: StatisticName;
      readonly citationAnchor: string;
    }
  >
> = {
  cold_start_ms: { gate: 1000, phase2: 2000, statistic: 'median', citationAnchor: 'R18' },
  open_card_ms: { gate: 100, statistic: 'median', citationAnchor: 'R18' },
  open_box_ms: { gate: 200, statistic: 'median', citationAnchor: 'R18' },
  sustained_fps: { gate: 60, phase2: 30, statistic: 'mean', citationAnchor: 'R18' },
  idle_memory_mb: { gate: 500, statistic: 'median', citationAnchor: 'R18' },
  render_update_ms: { gate: 16, statistic: 'p95', citationAnchor: '§10.1' },
  parse_10mb_ms: { gate: 100, statistic: 'median', citationAnchor: '§9.2' },
  parse_open_ms: { gate: 10, statistic: 'median', citationAnchor: '§9.2' },
  parse_metadata_ms: { gate: 5, statistic: 'median', citationAnchor: '§9.2' },
  parse_structure_ms: { gate: 10, statistic: 'median', citationAnchor: '§9.2' },
  parse_content_yaml_ms: { gate: 60, statistic: 'median', citationAnchor: '§9.2' },
  parse_entries_10k_ms: { gate: 100, statistic: 'median', citationAnchor: '§9.2' },
  parse_model_build_ms: { gate: 8, statistic: 'median', citationAnchor: '§9.2' },
  plugin_load_ms: { gate: 100, statistic: 'median', citationAnchor: '§11.1' },
  kernel_service_call_us: { gate: 1, statistic: 'median', citationAnchor: '§11.1' },
  kernel_event_emit_us: { gate: 1, statistic: 'p99', citationAnchor: '§9.1' },
  kernel_event_emit_empty_us: { gate: 0.1, statistic: 'median', citationAnchor: '§9.1' },
  bridge_forward_enqueue_ms: { gate: 1, statistic: 'p95', citationAnchor: '§9.1' },
  frame_pool_size: { gate: 32, statistic: 'max', citationAnchor: '§10.4' },
  parse_cache_entries: { gate: 64, statistic: 'max', citationAnchor: '§10.4' },
  cover_cache_entries: { gate: 64, statistic: 'max', citationAnchor: '§10.4' },
};

describe('指标注册表（metrics）', () => {
  it('门禁值、Phase 2 放宽值与统计口径与权威文档一致', () => {
    expect(new Set(Object.keys(FROZEN_GATES))).toEqual(new Set(METRIC_IDS));
    for (const [metricId, frozen] of Object.entries(FROZEN_GATES) as [
      MetricId,
      (typeof FROZEN_GATES)[MetricId],
    ][]) {
      const definition = metricDefinition(metricId);
      expect(definition.formalGate, metricId).toBe(frozen.gate);
      expect(definition.phase2Gate, metricId).toBe(frozen.phase2);
      expect(definition.gateStatistic, metricId).toBe(frozen.statistic);
      expect(definition.citation, metricId).toContain(frozen.citationAnchor);
    }
  });

  it('五项平台基线引用 R18（唯一数值源）', () => {
    for (const metricId of [
      'cold_start_ms',
      'open_card_ms',
      'open_box_ms',
      'sustained_fps',
      'idle_memory_mb',
    ] as const) {
      expect(metricDefinition(metricId).citation).toContain('R18');
    }
  });

  it('注册表字段完整且方向与比较符一致', () => {
    for (const metricId of METRIC_IDS) {
      const definition = METRICS[metricId];
      expect(definition.id).toBe(metricId);
      expect(definition.title.length).toBeGreaterThan(0);
      expect(definition.measurement.length).toBeGreaterThan(0);
      expect(definition.formalGate).toBeGreaterThan(0);
      expect(UNIT_LABELS[definition.unit].length).toBeGreaterThan(0);
      if (definition.direction === 'lower-is-better') {
        expect(['lt', 'lte']).toContain(definition.gateComparison);
      } else {
        expect(['gt', 'gte']).toContain(definition.gateComparison);
      }
    }
  });

  it('gateValueFor 按 Phase 解析', () => {
    expect(gateValueFor(metricDefinition('cold_start_ms'), 4)).toBe(1000);
    expect(gateValueFor(metricDefinition('cold_start_ms'), 2)).toBe(2000);
    expect(gateValueFor(metricDefinition('sustained_fps'), 2)).toBe(30);
    expect(gateValueFor(metricDefinition('parse_10mb_ms'), 2)).toBe(100);
  });

  it('metricById / isMetricId 校验', () => {
    expect(isMetricId('cold_start_ms')).toBe(true);
    expect(isMetricId('unknown_metric')).toBe(false);
    expect(metricById('open_box_ms').formalGate).toBe(200);
    expect(() => metricById('unknown_metric')).toThrowError();
  });

  it('渲染阶段预算与《渲染引擎设计》§10.1 一致', () => {
    const card = metricDefinition('open_card_ms').phaseBudgets;
    const box = metricDefinition('open_box_ms').phaseBudgets;
    expect(card?.map((entry) => entry.boundMs)).toEqual([30, 40, 30]);
    expect(box?.map((entry) => entry.boundMs)).toEqual([60, 80, 60]);
    expect(phaseBudgetOf('open_card_ms', 'open_card.parse').boundMs).toBe(30);
    expect(() => phaseBudgetOf('open_card_ms', 'missing')).toThrowError();
  });
});

describe('场景注册表（scenarios）', () => {
  it('场景指标与阶段预算均可解析', () => {
    expect(SCENARIO_IDS.length).toBeGreaterThan(0);
    for (const scenarioId of SCENARIO_IDS) {
      const definition = SCENARIOS[scenarioId];
      expect(definition.metricIds.length).toBeGreaterThan(0);
      for (const metricId of definition.metricIds) {
        expect(isMetricId(metricId)).toBe(true);
      }
      if (definition.kind === 'markers') {
        expect(definition.metricIds).toHaveLength(1);
        expect(definition.totalSpan).toBeDefined();
      }
      // 阶段预算是可选的：cold-start 只有总跨度，open-card / open-box 才有《渲染引擎设计》§10.1 的分解预算。
      for (const { budget } of scenarioPhaseBudgets(definition)) {
        expect(budget.boundMs).toBeGreaterThan(0);
      }
    }
  });

  it('标记点场景跨度与阶段标记点闭合', () => {
    const card = SCENARIOS['open-card'];
    const box = SCENARIOS['open-box'];
    expect(card.phases).toHaveLength(3);
    expect(box.phases).toHaveLength(3);
    expect(SCENARIOS['cold-start'].phases).toBeUndefined();
    const span = card.totalSpan;
    expect(span).toBeDefined();
    if (span === undefined) {
      return;
    }
    expect(span.from).toBe('render:open-called');
    expect(span.to).toBe('render:first-frame-commit');
    const phases = card.phases ?? [];
    expect(phases.some((phase) => phase.to === span.to)).toBe(true);
  });
});
