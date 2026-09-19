/**
 * 覆盖率门禁口径（单一事实源）。
 *
 * 与《测试规范》§10.2 与《CICD 与质量门禁》G6 / R18 一致：
 * - 总体 > 80%；
 * - Rust 核心（`chips-*` crates）与共享层（`@chips/ui`、`@chips/bridge`）> 90%。
 *
 * 根 vitest 工作区配置、`@chips/testing` 覆盖率门禁与各包配置只允许引用本模块，
 * 禁止在其他位置另写阈值数值。
 */

/** 覆盖率统计维度（与 vitest v8 provider 输出一致）。 */
export type CoverageMetric = 'lines' | 'functions' | 'branches' | 'statements';

/** 统计维度顺序（报告与判定顺序固定，保证产物确定性）。 */
export const COVERAGE_METRICS: readonly CoverageMetric[] = [
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

/** 总体覆盖率阈值（百分比）。 */
export const OVERALL_COVERAGE_THRESHOLD = 80;

/** 核心与共享层覆盖率阈值（百分比）。 */
export const CORE_SHARED_COVERAGE_THRESHOLD = 90;

const tierThreshold = (value: number): CoverageThreshold => ({
  lines: value,
  functions: value,
  branches: value,
  statements: value,
});

/** 三层覆盖率阈值：总体、Rust 核心、共享层。 */
export const COVERAGE_THRESHOLDS: {
  readonly overall: CoverageThreshold;
  readonly core: CoverageThreshold;
  readonly shared: CoverageThreshold;
} = {
  overall: tierThreshold(OVERALL_COVERAGE_THRESHOLD),
  core: tierThreshold(CORE_SHARED_COVERAGE_THRESHOLD),
  shared: tierThreshold(CORE_SHARED_COVERAGE_THRESHOLD),
};

/**
 * 共享层（> 90%）的仓库相对路径 glob。
 *
 * 与根 vitest 工作区配置的 `coverage.thresholds[glob]` 使用同一份清单。
 */
export const SHARED_LAYER_GLOBS: readonly string[] = ['packages/ui/**', 'packages/bridge/**'];

/**
 * `packages/core-rust/crates/` 下 Rust 核心 crate 的仓库相对路径前缀。
 *
 * 目录划分见《01-代码组织规范》§3.1：该目录内一个子目录即一个 crate，目录名即 crate 名。
 */
export const CORE_RUST_CRATE_PREFIX = 'packages/core-rust/crates/chips-';

/**
 * Neon 绑定 crate `chips-native` 的仓库相对路径前缀。
 *
 * 《01-代码组织规范》§3.1 规定 `chips-native` 与其余核心 crate 同处
 * `packages/core-rust/crates/`，当前仓库把它落在 `packages/native/`（`Cargo.toml`
 * 的 `[package] name = "chips-native"`，且为根 `Cargo.toml` workspace 成员）；
 * 该目录命名漂移已登记为工单 007，目录收口前统计面按 crate 身份归位。
 */
export const NATIVE_CRATE_PATH_PREFIX = 'packages/native/';

/**
 * Rust 核心统计面（> 90%）的仓库相对路径前缀集合。
 *
 * 口径依据：《架构原则》附录 R18 与 4.1 节、《测试规范》§一 与 §10.2、
 * 《超大型工程管理体系》6.1、《CI/CD 与质量门禁》3.2 一致规定
 * 「Rust 核心（`chips-*` crates）> 90%」——分组按 **crate 名 `chips-*`** 判定，
 * 不按目录位置判定；`chips-native` 命中该命名，因此 Neon 绑定层属于 90% 核心面，
 * 不设豁免、不另计（《测试规范》§一：覆盖率口径是全库唯一口径，
 * 核心与共享层之外的 Rust/TS 代码并入总体口径统计，不单独设指标）。
 *
 * 新增或迁移 `chips-*` crate 时必须同步本清单（《CI/CD 与质量门禁》6.4 禁止
 * 以缩小统计面、更换测量口径的方式通过门禁）。
 */
export const CORE_RUST_CRATE_PATH_PREFIXES: readonly string[] = [
  CORE_RUST_CRATE_PREFIX,
  NATIVE_CRATE_PATH_PREFIX,
];

/** 覆盖率报告与门禁产物目录（仓库根相对路径）。 */
export const COVERAGE_REPORT_PATHS = {
  /** vitest v8 `json-summary` 报告。 */
  vitestSummary: 'coverage/ts/coverage-summary.json',
  /** cargo-tarpaulin JSON 报告。 */
  tarpaulinJson: 'coverage/rust/tarpaulin-report.json',
  /** 聚合门禁报告输出目录。 */
  outputDir: 'reports/coverage',
} as const;
