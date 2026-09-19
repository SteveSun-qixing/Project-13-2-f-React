import { readFileSync } from 'node:fs';
import { PerfError, isPerfError } from './errors';
import {
  METRIC_IDS,
  METRICS,
  gateValueFor,
  isMetricId,
  type GateComparison,
  type MetricId,
  type MetricUnit,
} from './metrics';
import type { StatisticName } from './stats';

/**
 * 性能工具配置：Phase、门禁覆盖、回归策略、测量策略、报告输出。
 *
 * 说明：门禁值不写在本文件——它编码在 `metrics.ts` 并引用权威文档；
 * 本文件只承载「工具策略」（容差、轮次、窗口、输出目录），这些策略不等同门禁。
 */

/** 配置模式版本；第一版发布前不做兼容，版本不匹配即拒绝加载。 */
export const CONFIG_SCHEMA_VERSION = '1.0.0';

/** 门禁覆盖项：必须显式给出理由，且受 `allowGateOverride` 开关约束。 */
export interface ThresholdOverride {
  readonly value: number;
  readonly rationale: string;
}

/** 回归判定策略：相对容差百分比 + 绝对噪声下限，按单位配置。 */
export interface RegressionPolicy {
  readonly tolerancePercent: Readonly<Record<MetricUnit, number>>;
  readonly absoluteFloor: Readonly<Record<MetricUnit, number>>;
}

/**
 * 测量策略：轮次与窗口。
 *
 * 帧率采样时长由场景声明的协议（`scenarios.ts` 的 `sampling.minDurationMs`）定义，
 * 不在此重复配置；空闲内存窗口默认取门禁表 G7 的 5 分钟，可按需调小
 * （《调试指南》§8.4 的 60 秒稳定态用于快速分析）。
 */
export interface MeasurementPolicy {
  /** 标记点场景轮次（多轮取中位数）。 */
  readonly rounds: number;
  readonly warmupRounds: number;
  /** 空闲内存窗口（毫秒）；默认取门禁表 G7 的 5 分钟。 */
  readonly idleWindowMs: number;
}

/** 报告输出策略。 */
export interface ReportsPolicy {
  readonly outputDir: string;
}

/** 完整配置。 */
export interface PerfConfig {
  readonly schemaVersion: string;
  readonly phase: 2 | 4;
  readonly allowGateOverride: boolean;
  readonly overrides: Readonly<Record<string, ThresholdOverride>>;
  readonly regression: RegressionPolicy;
  readonly measurement: MeasurementPolicy;
  readonly reports: ReportsPolicy;
}

const ALL_UNITS: readonly MetricUnit[] = ['ms', 'fps', 'mb', 'us', 'count'];

/** 默认配置：Phase 4 正式基线；门禁零覆盖；策略参数见各字段注释。 */
export const DEFAULT_CONFIG: PerfConfig = {
  schemaVersion: CONFIG_SCHEMA_VERSION,
  phase: 4,
  allowGateOverride: false,
  overrides: {},
  regression: {
    tolerancePercent: { ms: 10, fps: 5, mb: 5, us: 10, count: 10 },
    absoluteFloor: { ms: 1, fps: 0.5, mb: 5, us: 0.05, count: 1 },
  },
  measurement: {
    rounds: 5,
    warmupRounds: 1,
    idleWindowMs: 300_000,
  },
  reports: { outputDir: 'reports' },
};

/** 解析后的门禁：数值 + 统计量 + 比较符 + 来源。 */
export interface ThresholdResolution {
  readonly metricId: MetricId;
  readonly phase: 2 | 4;
  readonly value: number;
  readonly statistic: StatisticName;
  readonly comparison: GateComparison;
  readonly source: 'R18' | 'config';
  readonly citation: string;
  /** Phase 2 无放宽值时回落到正式门禁的说明。 */
  readonly phaseFallback?: boolean;
  readonly overrideRationale?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, reason: string): never {
  throw new PerfError('PERF_CONFIG_INVALID', `配置项 ${path} 非法：${reason}`);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    fail(path, '必须是对象');
  }
  return value;
}

function requireNumber(
  value: unknown,
  path: string,
  options: { min: number; integer?: boolean }
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(path, '必须是有限数值');
  }
  if (options.integer === true && !Number.isInteger(value)) {
    fail(path, '必须是整数');
  }
  if (value < options.min) {
    fail(path, `必须 ≥ ${String(options.min)}`);
  }
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(path, '必须是非空字符串');
  }
  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    fail(path, '必须是布尔值');
  }
  return value;
}

function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  path: string
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      fail(`${path}.${key}`, `未登记配置项（允许：${allowed.join('、')}）`);
    }
  }
}

function parseUnitRecord(
  value: unknown,
  path: string,
  options: { min: number }
): Readonly<Record<MetricUnit, number>> {
  const record = requireRecord(value, path);
  rejectUnknownKeys(record, ALL_UNITS, path);
  const parsed = {} as Record<MetricUnit, number>;
  for (const unit of ALL_UNITS) {
    parsed[unit] = requireNumber(record[unit], `${path}.${unit}`, { min: options.min });
  }
  return parsed;
}

/** 校验并规整任意配置输入（通常来自 JSON）；非法时抛出 `PERF_CONFIG_INVALID`。 */
export function parseConfig(input: unknown): PerfConfig {
  const record = requireRecord(input, 'perfConfig');
  rejectUnknownKeys(
    record,
    [
      'schemaVersion',
      'phase',
      'allowGateOverride',
      'overrides',
      'regression',
      'measurement',
      'reports',
    ],
    'perfConfig'
  );
  const schemaVersion = requireString(record['schemaVersion'], 'schemaVersion');
  if (schemaVersion !== CONFIG_SCHEMA_VERSION) {
    fail('schemaVersion', `模式版本不匹配：期望 ${CONFIG_SCHEMA_VERSION}，实际 ${schemaVersion}`);
  }
  const phaseValue = requireNumber(record['phase'], 'phase', { min: 2, integer: true });
  if (phaseValue !== 2 && phaseValue !== 4) {
    fail('phase', `只支持 2 或 4，实际 ${String(phaseValue)}`);
  }
  const allowGateOverride = requireBoolean(record['allowGateOverride'], 'allowGateOverride');
  const overrideRecord = requireRecord(record['overrides'], 'overrides');
  const overrides: Record<string, ThresholdOverride> = {};
  for (const [metricId, overrideValue] of Object.entries(overrideRecord)) {
    if (!isMetricId(metricId)) {
      fail(`overrides.${metricId}`, '不是已登记指标 ID');
    }
    const entry = requireRecord(overrideValue, `overrides.${metricId}`);
    rejectUnknownKeys(entry, ['value', 'rationale'], `overrides.${metricId}`);
    overrides[metricId] = {
      value: requireNumber(entry['value'], `overrides.${metricId}.value`, {
        min: Number.MIN_VALUE,
      }),
      rationale: requireString(entry['rationale'], `overrides.${metricId}.rationale`),
    };
  }
  if (Object.keys(overrides).length > 0 && !allowGateOverride) {
    throw new PerfError(
      'PERF_THRESHOLD_OVERRIDE_DENIED',
      '存在门禁覆盖但 allowGateOverride=false；覆盖门禁必须在配置中显式开启并写明理由'
    );
  }
  const regressionRecord = requireRecord(record['regression'], 'regression');
  rejectUnknownKeys(regressionRecord, ['tolerancePercent', 'absoluteFloor'], 'regression');
  const regression: RegressionPolicy = {
    tolerancePercent: parseUnitRecord(
      regressionRecord['tolerancePercent'],
      'regression.tolerancePercent',
      { min: 0 }
    ),
    absoluteFloor: parseUnitRecord(regressionRecord['absoluteFloor'], 'regression.absoluteFloor', {
      min: 0,
    }),
  };
  const measurementRecord = requireRecord(record['measurement'], 'measurement');
  rejectUnknownKeys(measurementRecord, ['rounds', 'warmupRounds', 'idleWindowMs'], 'measurement');
  const measurement: MeasurementPolicy = {
    rounds: requireNumber(measurementRecord['rounds'], 'measurement.rounds', {
      min: 1,
      integer: true,
    }),
    warmupRounds: requireNumber(measurementRecord['warmupRounds'], 'measurement.warmupRounds', {
      min: 0,
      integer: true,
    }),
    idleWindowMs: requireNumber(measurementRecord['idleWindowMs'], 'measurement.idleWindowMs', {
      min: 1,
    }),
  };
  const reportsRecord = requireRecord(record['reports'], 'reports');
  rejectUnknownKeys(reportsRecord, ['outputDir'], 'reports');
  const reports: ReportsPolicy = {
    outputDir: requireString(reportsRecord['outputDir'], 'reports.outputDir'),
  };
  return {
    schemaVersion,
    phase: phaseValue === 2 ? 2 : 4,
    allowGateOverride,
    overrides,
    regression,
    measurement,
    reports,
  };
}

/** 从文件加载配置；解析失败统一为 `PERF_CONFIG_INVALID`。 */
export function loadConfigFile(path: string): PerfConfig {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PerfError('PERF_CONFIG_INVALID', `无法读取配置文件 ${path}：${reason}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PerfError('PERF_CONFIG_INVALID', `配置文件 ${path} 不是合法 JSON：${reason}`);
  }
  try {
    return parseConfig(parsed);
  } catch (error) {
    if (isPerfError(error)) {
      throw error;
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new PerfError('PERF_CONFIG_INVALID', `配置文件 ${path} 校验失败：${reason}`);
  }
}

/** 解析单指标门禁（含配置覆盖）。 */
export function resolveThreshold(metricId: MetricId, config: PerfConfig): ThresholdResolution {
  const definition = METRICS[metricId];
  const override = config.overrides[metricId];
  if (override !== undefined) {
    return {
      metricId,
      phase: config.phase,
      value: override.value,
      statistic: definition.gateStatistic,
      comparison: definition.gateComparison,
      source: 'config',
      citation: `${definition.citation}（配置覆盖）`,
      overrideRationale: override.rationale,
    };
  }
  const phaseFallback = config.phase === 2 && definition.phase2Gate === undefined;
  return {
    metricId,
    phase: config.phase,
    value: gateValueFor(definition, config.phase),
    statistic: definition.gateStatistic,
    comparison: definition.gateComparison,
    source: 'R18',
    citation: definition.citation,
    ...(phaseFallback ? { phaseFallback: true } : {}),
  };
}

/** 解析全部指标门禁。 */
export function resolveThresholds(config: PerfConfig): ReadonlyMap<MetricId, ThresholdResolution> {
  const resolved = new Map<MetricId, ThresholdResolution>();
  for (const metricId of METRIC_IDS) {
    resolved.set(metricId, resolveThreshold(metricId, config));
  }
  return resolved;
}
