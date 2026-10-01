import { describe, expect, it } from 'vitest';

import {
  assertNoSyntheticAdapterInRegistry,
  armTriStateCounts,
  BASELINE_FIVE_METRIC_IDS,
  baselineMetricDefinition,
  baselineScenarioOf,
  SCENARIO_ARM_REGISTRY,
  waitingArmCodesOf,
} from '../src/baseline-arms';
import { assertRealParseDomainAdapter, isSyntheticAdapterId } from '../src/adapters';
import { createSyntheticAdapter } from '../src/fixtures/synthetic';
import { METRICS } from '../src/metrics';
import { createRealHostAdapter } from '../src/real/adapter';
import { createRealParseAdapter, REAL_PARSE_ADAPTER_ID } from '../src/real/parser-adapter';
import { PARSE_DOMAIN_SCENARIO_IDS, SCENARIOS, SCENARIO_IDS } from '../src/scenarios';

/**
 * §4.2 五项基线 × 全场景真测臂登记表锁测（性能真测重验 2026-10-01 落册面）。
 *
 * 锁的是「哪只臂测什么、数值语义真假」的登记形制：登记表覆盖场景全集、五项门禁语义
 * 与指标注册表镜像、真测行只挂非合成适配器且适配器实例真实提供、contract-only 行无
 * 真臂数值位、候臂逐项在册。门禁数值的冻结期望表归 `metrics.test.ts`，本文件不重复。
 */

/** 真测行适配器 ID → 适配器实例（构造零副作用，既有锁测在案）。 */
function realAdapterInstanceOf(adapterId: string): { provides: readonly string[] } {
  if (adapterId === REAL_PARSE_ADAPTER_ID) {
    return createRealParseAdapter();
  }
  if (adapterId === 'chips-host-real-process') {
    return createRealHostAdapter();
  }
  throw new Error(`登记表挂载了未在测试面装配的在册真测适配器：${adapterId}`);
}

describe('真测臂登记表（baseline-arms）', () => {
  it('登记表覆盖场景全集：键集与场景登记表双向恰等', () => {
    expect(Object.keys(SCENARIO_ARM_REGISTRY).sort()).toEqual([...SCENARIO_IDS].sort());
    for (const scenarioId of SCENARIO_IDS) {
      expect(SCENARIO_ARM_REGISTRY[scenarioId]?.scenarioId).toBe(scenarioId);
      expect(SCENARIOS[scenarioId]).toBeDefined();
    }
  });

  it('三态计数恰等：6 真测 + 4 契约承载，无 synthetic-only 分类', () => {
    expect(armTriStateCounts()).toEqual({ real: 6, contractOnly: 4 });
    for (const scenarioId of SCENARIO_IDS) {
      expect(['real', 'contract-only']).toContain(SCENARIO_ARM_REGISTRY[scenarioId]?.triState);
    }
  });

  it('§4.2 五项映射恰等且门禁语义与指标注册表镜像（含工单045 gte 算子）', () => {
    expect([...BASELINE_FIVE_METRIC_IDS].sort()).toEqual(
      ['cold_start_ms', 'open_card_ms', 'open_box_ms', 'sustained_fps', 'idle_memory_mb'].sort()
    );
    const expectedGates = {
      cold_start_ms: { statistic: 'median', comparison: 'lt', formalGate: 1000, phase2Gate: 2000 },
      open_card_ms: {
        statistic: 'median',
        comparison: 'lt',
        formalGate: 100,
        phase2Gate: undefined,
      },
      open_box_ms: {
        statistic: 'median',
        comparison: 'lt',
        formalGate: 200,
        phase2Gate: undefined,
      },
      sustained_fps: { statistic: 'mean', comparison: 'gte', formalGate: 60, phase2Gate: 30 },
      idle_memory_mb: {
        statistic: 'median',
        comparison: 'lt',
        formalGate: 500,
        phase2Gate: undefined,
      },
    } as const;
    for (const metricId of BASELINE_FIVE_METRIC_IDS) {
      const registered = METRICS[metricId];
      const expected = expectedGates[metricId];
      expect(registered.gateStatistic).toBe(expected.statistic);
      expect(registered.gateComparison).toBe(expected.comparison);
      expect(registered.formalGate).toBe(expected.formalGate);
      expect(registered.phase2Gate).toBe(expected.phase2Gate);
      expect(baselineMetricDefinition(metricId)).toBe(registered);
      const scenarioId = baselineScenarioOf(metricId);
      expect(SCENARIO_ARM_REGISTRY[scenarioId]).toBeDefined();
    }
  });

  it('真测行只挂非合成适配器，且适配器实例真实提供该场景', () => {
    for (const scenarioId of SCENARIO_IDS) {
      const row = SCENARIO_ARM_REGISTRY[scenarioId];
      if (row?.triState !== 'real') {
        expect(row?.realAdapterIds).toBeUndefined();
        expect(row?.numericSemantics).toBeUndefined();
        continue;
      }
      const adapterIds = row.realAdapterIds ?? [];
      expect(adapterIds.length).toBeGreaterThan(0);
      for (const adapterId of adapterIds) {
        expect(isSyntheticAdapterId(adapterId)).toBe(false);
        const instance = realAdapterInstanceOf(adapterId);
        expect(instance.provides).toContain(scenarioId);
      }
      expect(['real-load', 'real-proxy']).toContain(row.numericSemantics);
    }
  });

  it('解析域真臂通过工单056 分流闸，两解析域场景行均挂该真臂（真登记形态双向闸的登记表侧复锁）', () => {
    const parseAdapter = createRealParseAdapter();
    expect(() => assertRealParseDomainAdapter(parseAdapter)).not.toThrow();
    expect(parseAdapter.provides).toEqual([...PARSE_DOMAIN_SCENARIO_IDS]);
    for (const scenarioId of PARSE_DOMAIN_SCENARIO_IDS) {
      expect(SCENARIO_ARM_REGISTRY[scenarioId]?.realAdapterIds).toEqual([REAL_PARSE_ADAPTER_ID]);
      expect(SCENARIO_ARM_REGISTRY[scenarioId]?.numericSemantics).toBe('real-load');
    }
  });

  it('contract-only 行无真测适配器提供（open-box 整场景显式不在宿主适配器 provides）', () => {
    const hostAdapter = createRealHostAdapter();
    const parseAdapter = createRealParseAdapter();
    for (const scenarioId of SCENARIO_IDS) {
      const row = SCENARIO_ARM_REGISTRY[scenarioId];
      if (row?.triState !== 'contract-only') {
        continue;
      }
      expect(hostAdapter.provides).not.toContain(scenarioId);
      expect(parseAdapter.provides).not.toContain(scenarioId);
    }
  });

  it('合成臂（golden/regressed）零进入登记表（裁决A：合成读数不成立）', () => {
    assertNoSyntheticAdapterInRegistry();
    for (const quality of ['golden', 'regressed'] as const) {
      const synthetic = createSyntheticAdapter(quality);
      expect(isSyntheticAdapterId(synthetic.id)).toBe(true);
      for (const scenarioId of SCENARIO_IDS) {
        const registered = SCENARIO_ARM_REGISTRY[scenarioId]?.realAdapterIds ?? [];
        expect(registered).not.toContain(synthetic.id);
      }
    }
  });

  it('候臂逐项在册：开卡首帧锚、箱子 W4 视图闸、滚动真实渲染负载通道', () => {
    expect(waitingArmCodesOf('open-card')).toEqual(['FIRST-FRAME-COMMIT-ANCHOR']);
    expect(waitingArmCodesOf('scroll-fps')).toEqual(['RENDER-LOAD-FRAME-CHANNEL']);
    expect(waitingArmCodesOf('open-box')).toEqual(['W4-BOX-VIEW-GATE']);
    expect(waitingArmCodesOf('cold-start')).toEqual([]);
    expect(waitingArmCodesOf('idle-memory')).toEqual([]);
  });

  it('open-box 基线判读的数据链承接位恰等：parse-box-10k × parse_box_full_ms 且场景登记在册', () => {
    const row = SCENARIO_ARM_REGISTRY['open-box'];
    expect(row?.triState).toBe('contract-only');
    expect(row?.dataChainEvidence).toEqual({
      scenarioId: 'parse-box-10k',
      metricId: 'parse_box_full_ms',
    });
    expect(SCENARIOS['parse-box-10k']?.metricIds).toContain('parse_box_full_ms');
  });
});
