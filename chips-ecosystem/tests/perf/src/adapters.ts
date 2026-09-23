import { PerfError } from './errors';
import { isMetricId, type MetricId } from './metrics';
import type { PerfMarker } from './markers';
import type { MemorySample } from './memory';
import { PARSE_DOMAIN_SCENARIO_IDS, isScenarioId, type ScenarioId } from './scenarios';

/**
 * 被测量系统接入契约。
 *
 * W2 金链路由 Host / RenderEngine / 解析器实现适配器：
 * - 标记点：从 `CHIPS_TRACE=startup,event` 追踪或 RenderEngine 会话回调采集（`src/markers.ts` 规范命名）；
 * - 帧时间戳：rAF 回调时间戳（`performance.now`）；
 * - 内存采样：`sampleProcessMemory()` 或 Electron `app.getAppMetrics()` 汇总；
 * - 显式样本：解析基准（`runParserBench`）、criterion 导出、资源上限核查。
 *
 * 适配器只采集原始信号，不做门禁判定；判定、统计与报告由本工具负责。
 */

/** 单轮运行上下文。 */
export interface AdapterRunContext {
  readonly scenarioId: ScenarioId;
  /** 轮次序号（从 0 开始）；适配器据此派生确定性抖动或轮换夹具。 */
  readonly iteration: number;
}

/** 单轮运行结果；按场景提供对应信号。 */
export interface AdapterRunResult {
  readonly markers?: readonly PerfMarker[];
  readonly frameTimestampsMs?: readonly number[];
  readonly memorySamples?: readonly MemorySample[];
  readonly metricSamples?: Readonly<Partial<Record<MetricId, readonly number[]>>>;
  /** 自由文本诊断（写入报告，不参与判定）。 */
  readonly notes?: readonly string[];
}

/** 测量形态标记（工单056 分流在册位）：`real` = 读数来自被测系统真实执行；`synthetic` = 自测夹具值。 */
export type MeasurementForm = 'real' | 'synthetic';

/** 适配器接口。 */
export interface PerfAdapter {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /**
   * 测量形态声明（可选；缺省视为未声明）。解析域场景（`PARSE_DOMAIN_SCENARIO_IDS`）
   * 的真测登记必须显式声明 `real`，合成臂的自测登记必须显式声明 `synthetic`，
   * 由 {@link assertRealParseDomainAdapter} 双闸把关。
   */
  readonly measurementForm?: MeasurementForm;
  /** 该适配器可执行的场景清单。 */
  readonly provides: readonly ScenarioId[];
  run(context: AdapterRunContext): Promise<AdapterRunResult>;
}

/** 合成适配器 ID 的在册前缀（`synthetic-golden` / `synthetic-regressed` 及一切派生）。 */
export const SYNTHETIC_ADAPTER_ID_PREFIX = 'synthetic-';

/** 判断适配器 ID 是否为合成臂命名。 */
export function isSyntheticAdapterId(adapterId: string): boolean {
  return adapterId.startsWith(SYNTHETIC_ADAPTER_ID_PREFIX);
}

/** 已声明真测形态、可承载解析域真测登记的适配器。 */
export interface RealMeasurementAdapter extends PerfAdapter {
  readonly measurementForm: 'real';
}

/**
 * 解析域真测分流闸（工单056 期望行为 1「合成臂与真臂可分辨」的执行位）：
 * 只有同时满足「契约合法 + 声明覆盖解析域场景 + `measurementForm === 'real'` +
 * ID 非 `synthetic-*`」的适配器才准予登记为解析域真测来源；任一不满足即
 * fail-closed 抛错。合成臂即使 `provides` 覆盖解析域场景，也在闸上被逐项点名拒绝，
 * 不可冒充真测。
 */
export function assertRealParseDomainAdapter(
  value: unknown
): asserts value is RealMeasurementAdapter {
  assertValidAdapter(value);
  const coveredParseScenarios = PARSE_DOMAIN_SCENARIO_IDS.filter((scenarioId) =>
    value.provides.includes(scenarioId)
  );
  if (coveredParseScenarios.length === 0) {
    throw new PerfError(
      'PERF_ADAPTER_INVALID',
      `适配器 ${value.id} 未声明任何解析域场景（${PARSE_DOMAIN_SCENARIO_IDS.join('、')}），不是解析域真测来源`
    );
  }
  if (isSyntheticAdapterId(value.id)) {
    throw new PerfError(
      'PERF_ADAPTER_INVALID',
      `适配器 ${value.id} 命中合成臂命名前缀 ${SYNTHETIC_ADAPTER_ID_PREFIX}，禁止登记为解析域真测来源（工单056 分流闸）`
    );
  }
  if (value.measurementForm !== 'real') {
    throw new PerfError(
      'PERF_ADAPTER_INVALID',
      `适配器 ${value.id} 未显式声明 measurementForm: 'real'（实际 ${String(value.measurementForm)}），禁止登记为解析域真测来源`
    );
  }
  const unclaimed = PARSE_DOMAIN_SCENARIO_IDS.filter(
    (scenarioId) => !value.provides.includes(scenarioId)
  );
  if (unclaimed.length > 0) {
    throw new PerfError(
      'PERF_ADAPTER_INVALID',
      `适配器 ${value.id} 未覆盖解析域场景 ${unclaimed.join('、')}（解析域真测登记必须两场景齐备）`
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new PerfError('PERF_ADAPTER_INVALID', `适配器字段 ${field} 必须是非空字符串`);
  }
  return value;
}

/** 校验并窄化任意值为 `PerfAdapter`。 */
export function assertValidAdapter(value: unknown): asserts value is PerfAdapter {
  if (!isRecord(value)) {
    throw new PerfError(
      'PERF_ADAPTER_INVALID',
      '适配器必须是对象，并提供 id/title/description/provides/run'
    );
  }
  requireNonEmptyString(value['id'], 'id');
  requireNonEmptyString(value['title'], 'title');
  requireNonEmptyString(value['description'], 'description');
  if (typeof value['run'] !== 'function') {
    throw new PerfError('PERF_ADAPTER_INVALID', '适配器必须提供 run(context) 方法');
  }
  const provides = value['provides'];
  if (
    !Array.isArray(provides) ||
    provides.length === 0 ||
    !provides.every((entry) => typeof entry === 'string')
  ) {
    throw new PerfError('PERF_ADAPTER_INVALID', '适配器 provides 必须是非空场景 ID 数组');
  }
  for (const scenarioId of provides) {
    if (!isScenarioId(scenarioId)) {
      throw new PerfError('PERF_ADAPTER_INVALID', `适配器声明了未登记场景：${scenarioId}`);
    }
  }
}

/**
 * 校验显式样本表：键必须是已登记指标，值必须是非空有限数值数组。
 *
 * @returns 校验后的冻结副本（不修改入参）
 */
export function validateMetricSamples(
  input: unknown
): Readonly<Partial<Record<MetricId, readonly number[]>>> {
  if (input === undefined) {
    return {};
  }
  if (!isRecord(input)) {
    throw new PerfError('PERF_ADAPTER_INVALID', 'metricSamples 必须是 { 指标ID: 数值数组 } 对象');
  }
  const validated: Partial<Record<MetricId, number[]>> = {};
  for (const [metricId, rawSamples] of Object.entries(input)) {
    if (!isMetricId(metricId)) {
      throw new PerfError('PERF_ADAPTER_INVALID', `metricSamples 含未登记指标：${metricId}`);
    }
    if (!Array.isArray(rawSamples) || rawSamples.length === 0) {
      throw new PerfError('PERF_ADAPTER_INVALID', `metricSamples.${metricId} 必须是非空数值数组`);
    }
    const samples: number[] = [];
    for (let index = 0; index < rawSamples.length; index += 1) {
      const sample: unknown = rawSamples[index];
      if (typeof sample !== 'number' || !Number.isFinite(sample)) {
        throw new PerfError(
          'PERF_ADAPTER_INVALID',
          `metricSamples.${metricId}[${String(index)}] 不是有限数值`
        );
      }
      samples.push(sample);
    }
    validated[metricId] = samples;
  }
  return validated;
}
