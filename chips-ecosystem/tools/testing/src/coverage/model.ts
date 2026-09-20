/**
 * 覆盖率报告数据模型：测量聚合结构与 G6 委托判定的渲染类型。
 *
 * 判定本身不在本侧建模（工单 017）：`CoverageVerdict` 只是 G6 JSON 报告
 * （`g6.ts`）的行渲染视图。
 */

import type { CoverageMetric } from '../thresholds.ts';
import type { G6Trace } from './g6.ts';

/** 单一维度的命中/总量统计。 */
export interface CoverageCount {
  readonly covered: number;
  readonly total: number;
}

/** 四个统计维度的覆盖数据。 */
export type CoverageCounts = Record<CoverageMetric, CoverageCount>;

/** 单个源文件的覆盖率记录（路径为仓库相对路径）。 */
export interface CoveredFile {
  readonly path: string;
  readonly counts: CoverageCounts;
}

/** 覆盖率测量分组（总体、共享层 glob、Rust 核心、Rust 总体等）。 */
export interface CoverageGroup {
  readonly id: string;
  readonly label: string;
  readonly counts: CoverageCounts;
  readonly fileCount: number;
}

/** 单条判定的渲染视图（数据全部来自 G6 报告）。 */
export interface CoverageVerdict {
  /** G6 分组 id（`total`/`shared`/`rust-overall`/`rust-core`）。 */
  readonly group: string;
  /** 分组展示名。 */
  readonly label: string;
  readonly metric: CoverageMetric;
  readonly threshold: number;
  readonly covered: number;
  readonly total: number;
  /** 百分比；分组无数据（skipped）时为 `null`。 */
  readonly percent: number | null;
  /** G6 判定结论（豁免命中时 G6 已置为放行）。 */
  readonly passed: boolean;
  /** §6.3 豁免留痕（命中时呈现编号与期限）。 */
  readonly exemption?: { readonly id: string; readonly deadline: string };
}

/** 某一侧（TS 或 Rust）的测量结果。 */
export interface CoverageSection {
  readonly groups: readonly CoverageGroup[];
}

/** 聚合报告（测量 + G6 判定渲染）。 */
export interface CoverageGateReport {
  readonly generatedAt: string;
  /** G6 判定结论原文（`pass` / `fail`）。 */
  readonly status: 'pass' | 'fail';
  /** 中文结论：`通过` / `未通过` / `豁免留痕通过`。 */
  readonly conclusion: string;
  readonly passed: boolean;
  readonly ts: CoverageSection;
  readonly rust: CoverageSection;
  readonly verdicts: readonly CoverageVerdict[];
  readonly violations: readonly G6Trace[];
  readonly warnings: readonly G6Trace[];
}
