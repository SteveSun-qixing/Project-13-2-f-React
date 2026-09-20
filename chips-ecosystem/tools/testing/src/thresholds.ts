#!/usr/bin/env tsx
/**
 * 覆盖率口径装载器。
 *
 * 单一事实源是 `tools/gates/gates.config.json` 的 `coverage` 段（工单 017 裁决：
 * G6 `check-coverage.mjs` 为唯一判定面，判定口径只登记一处）；本模块只做装载与
 * 类型化，不提供判定逻辑。阈值数值语义出处：《测试规范》§10.2 与
 * 《CI/CD 与质量门禁》G6 / R18——总体 > 80%；Rust 核心与共享层 > 90%。
 *
 * 根 vitest 工作区配置、`@chips/testing` 覆盖率报告面与各包配置只允许引用本模块，
 * 禁止在其他位置另写阈值数值（《CI/CD 与质量门禁》§6.5）。
 */

import { readFileSync } from 'node:fs';

/** 覆盖率统计维度（与 vitest v8 provider 输出一致）。 */
export type CoverageMetric = 'lines' | 'functions' | 'branches' | 'statements';

const SUPPORTED_METRICS: readonly CoverageMetric[] = [
  'lines',
  'functions',
  'branches',
  'statements',
];

/** 单一统计维度的覆盖率阈值（百分比）。 */
export interface CoverageThreshold {
  readonly lines: number;
  readonly functions: number;
  readonly branches: number;
  readonly statements: number;
}

interface GatesCoverageInput {
  readonly path: string;
  readonly json?: string;
  readonly required?: boolean;
}

interface GatesCoverageGroup {
  readonly id: string;
  readonly threshold?: number;
  readonly match?: readonly string[];
}

interface GatesCoverageConfig {
  readonly inputs?: { readonly ts?: GatesCoverageInput; readonly rust?: GatesCoverageInput };
  readonly metrics?: readonly string[];
  readonly defaultThreshold?: number;
  readonly groups?: readonly GatesCoverageGroup[];
  readonly rust?: { readonly coreThreshold?: number; readonly coreMatch?: readonly string[] };
}

const CONFIG_URL = new URL('../../gates/gates.config.json', import.meta.url);

function fail(message: string): never {
  throw new Error(`覆盖率口径装载失败：${message}（单一事实源 tools/gates/gates.config.json）`);
}

const asFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(label);
  }
  return value;
};

const loadConfig = (): GatesCoverageConfig => {
  let raw: string;
  try {
    raw = readFileSync(CONFIG_URL, 'utf8');
  } catch (error) {
    fail(`配置文件不可读（${error instanceof Error ? error.message : String(error)}）`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`配置文件不是合法 JSON（${error instanceof Error ? error.message : String(error)}）`);
  }
  const coverage = (parsed as { coverage?: GatesCoverageConfig }).coverage;
  if (coverage === undefined || coverage === null) {
    fail('缺少 coverage 段');
  }
  return coverage;
};

const config = loadConfig();

const metrics = config.metrics ?? SUPPORTED_METRICS;
for (const metric of metrics) {
  if (!SUPPORTED_METRICS.includes(metric as CoverageMetric)) {
    fail(`未知统计维度：${String(metric)}`);
  }
}

/** 统计维度顺序（与门禁配置一致，保证报告确定性）。 */
export const COVERAGE_METRICS: readonly CoverageMetric[] = [...metrics] as CoverageMetric[];

/** 总体覆盖率阈值（百分比，`coverage.defaultThreshold`）。 */
export const OVERALL_COVERAGE_THRESHOLD: number = asFiniteNumber(
  config.defaultThreshold ?? fail('缺少 defaultThreshold'),
  'defaultThreshold 非法'
);

const sharedGroup = (config.groups ?? []).find((group) => group.id === 'shared');
if (sharedGroup === undefined) {
  fail('缺少 groups 中的 shared 组');
}

const SHARED_THRESHOLD: number = asFiniteNumber(
  sharedGroup.threshold ?? fail('shared 组缺少 threshold'),
  'shared.threshold 非法'
);
const CORE_THRESHOLD: number = asFiniteNumber(
  config.rust?.coreThreshold ?? fail('缺少 rust.coreThreshold'),
  'rust.coreThreshold 非法'
);
if (SHARED_THRESHOLD !== CORE_THRESHOLD) {
  fail(`核心与共享层阈值应一致（rust=${CORE_THRESHOLD}，shared=${SHARED_THRESHOLD}，R18 口径）`);
}

/** 核心与共享层覆盖率阈值（百分比）。 */
export const CORE_SHARED_COVERAGE_THRESHOLD: number = CORE_THRESHOLD;

const tierThreshold = (value: number): CoverageThreshold => ({
  lines: value,
  functions: value,
  branches: value,
  statements: value,
});

/** 三层覆盖率阈值：总体、Rust 核心、共享层（全部装载自门禁配置）。 */
export const COVERAGE_THRESHOLDS: {
  readonly overall: CoverageThreshold;
  readonly core: CoverageThreshold;
  readonly shared: CoverageThreshold;
} = {
  overall: tierThreshold(OVERALL_COVERAGE_THRESHOLD),
  core: tierThreshold(CORE_THRESHOLD),
  shared: tierThreshold(SHARED_THRESHOLD),
};

/**
 * 共享层（> 90%）的仓库相对路径 glob。
 *
 * 由门禁配置 `shared.match` 目录前缀派生（如 `packages/ui/` → `packages/ui/**`），
 * 与根 vitest 工作区配置的 `coverage.thresholds[glob]` 使用同一份清单。
 */
export const SHARED_LAYER_GLOBS: readonly string[] = (sharedGroup.match ?? []).map(
  (prefix) => `${prefix.replace(/\/+$/, '')}/**`
);

/**
 * Rust 核心统计面（> 90%）的仓库相对路径前缀集合（装载自 `rust.coreMatch`）。
 *
 * 口径依据：《架构原则》附录 R18 与 4.1 节、《测试规范》§一 与 §10.2、
 * 《超大型工程管理体系》6.1、《CI/CD 与质量门禁》3.2 一致规定
 * 「Rust 核心（`chips-*` crates）> 90%」——分组按 **crate 名 `chips-*`** 判定，
 * 不按目录位置判定；`chips-native` 命中该命名，因此 Neon 绑定层属于 90% 统计面，
 * 统计面不另计、不缩小（判定层的 §6.3 豁免登记不改变统计面口径）。
 * 新增或迁移 `chips-*` crate 时必须同步门禁配置（《CI/CD 与质量门禁》6.4 禁止
 * 以缩小统计面、更换测量口径的方式通过门禁）。
 */
export const CORE_RUST_CRATE_PATH_PREFIXES: readonly string[] = [
  ...(config.rust?.coreMatch ?? fail('缺少 rust.coreMatch')),
];

const vitestSummary = config.inputs?.ts?.path ?? fail('缺少 inputs.ts.path');
const tarpaulinJson = config.inputs?.rust?.json ?? fail('缺少 inputs.rust.json');

/** 覆盖率报告与门禁产物路径（仓库根相对路径，装载自门禁配置）。 */
export const COVERAGE_REPORT_PATHS = {
  /** vitest v8 `json-summary` 报告（= G6 `inputs.ts.path`）。 */
  vitestSummary,
  /** cargo-tarpaulin JSON 报告（G6 消费同目录的 Cobertura XML）。 */
  tarpaulinJson,
  /** 聚合报告输出目录（@chips/testing 测量报告面专属，不参与判定）。 */
  outputDir: 'reports/coverage',
} as const;
