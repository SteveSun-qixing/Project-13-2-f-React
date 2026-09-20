/**
 * 覆盖率报告解析：把 vitest v8 `json-summary` 与 cargo-tarpaulin JSON
 * 归一为 {@link CoveredFile} 列表，供测量聚合与报告渲染使用
 * （判定唯一归属 G6，见 `g6.ts` / 工单 017）。
 *
 * 解析函数为纯函数，不触碰文件系统；读写由 `cli.ts` / `run.ts` 负责。
 */

import { relative, isAbsolute, normalize, sep } from 'node:path';

import { type CoverageMetric } from '../thresholds.ts';
import { type CoverageCount, type CoverageCounts, type CoveredFile } from './model.ts';

/** vitest v8 `json-summary` 中单个维度的原始结构。 */
interface VitestMetricSummary {
  readonly total: number;
  readonly covered: number;
  readonly skipped?: number;
  readonly pct: number;
}

/** vitest v8 `json-summary` 中单个文件（或 `total`）的结构。 */
export type VitestFileSummary = Partial<Record<CoverageMetric | 'branchesTrue', VitestMetricSummary>>;

/** vitest v8 `json-summary` 根结构：`total` + 以绝对路径为键的文件条目。 */
export type VitestSummary = Record<string, VitestFileSummary>;

/** cargo-tarpaulin `tarpaulin-report.json` 中的单个文件结构。 */
export interface TarpaulinFile {
  readonly path: readonly string[];
  readonly covered: number;
  readonly coverable: number;
}

/** cargo-tarpaulin `tarpaulin-report.json` 根结构。 */
export interface TarpaulinReport {
  readonly files: readonly TarpaulinFile[];
  readonly coverage: number;
  readonly covered: number;
  readonly coverable: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asNonNegativeInteger = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`覆盖率报告中的数值非法：${String(value)}`);
  }
  return Math.trunc(value);
};

const readMetric = (summary: VitestFileSummary, metric: CoverageMetric): CoverageCount => {
  const value = summary[metric];
  if (value === undefined) {
    return { covered: 0, total: 0 };
  }
  return { covered: asNonNegativeInteger(value.covered), total: asNonNegativeInteger(value.total) };
};

/** 统一分隔符为正斜杠（Windows 报告与手工输入的路径都可能含反斜杠）。 */
const toPosix = (value: string): string => value.replace(/\\/g, '/');

/**
 * 把路径归一为仓库相对路径。
 *
 * 报告中的绝对路径统一转为以 `/` 分隔的相对路径；已在仓库外的绝对路径保持原样
 * （不会命中任何仓库内分组，但会进入总体口径并在报告中可见）。
 */
export function toRepoRelative(repoRoot: string, filePath: string): string {
  const normalized = normalize(toPosix(filePath));
  if (!isAbsolute(normalized)) {
    return toPosix(normalized);
  }
  const rel = relative(normalize(toPosix(repoRoot)), normalized);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return toPosix(normalized);
  }
  return toPosix(rel);
}

/**
 * 解析 vitest v8 `json-summary`。
 *
 * @param summary `coverage-summary.json` 的解析结果
 * @param repoRoot 仓库根绝对路径，用于把报告中的绝对路径转为相对路径
 */
export function parseVitestSummary(summary: unknown, repoRoot: string): CoveredFile[] {
  if (!isRecord(summary)) {
    throw new Error('vitest 覆盖率摘要必须是对象');
  }
  const files: CoveredFile[] = [];
  for (const [key, value] of Object.entries(summary)) {
    if (key === 'total') {
      continue;
    }
    if (!isRecord(value)) {
      throw new Error(`vitest 覆盖率摘要条目非法：${key}`);
    }
    const entry = value as VitestFileSummary;
    const counts: CoverageCounts = {
      lines: readMetric(entry, 'lines'),
      functions: readMetric(entry, 'functions'),
      branches: readMetric(entry, 'branches'),
      statements: readMetric(entry, 'statements'),
    };
    files.push({ path: toRepoRelative(repoRoot, key), counts });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return files;
}

const isTarpaulinFile = (value: unknown): value is TarpaulinFile =>
  isRecord(value) &&
  Array.isArray(value.path) &&
  value.path.every((part) => typeof part === 'string') &&
  typeof value.covered === 'number' &&
  typeof value.coverable === 'number';

/**
 * 解析 cargo-tarpaulin JSON 报告。
 *
 * tarpaulin 只提供行覆盖（branch 覆盖未实现），因此函数/分支/语句维度为 0/0，
 * 门禁判定只使用 `lines` 维度。
 */
export function parseTarpaulinReport(report: unknown, repoRoot: string): CoveredFile[] {
  if (!isRecord(report) || !Array.isArray(report.files)) {
    throw new Error('tarpaulin 报告缺少 files 字段');
  }
  const files: CoveredFile[] = [];
  for (const raw of report.files) {
    if (!isTarpaulinFile(raw)) {
      throw new Error('tarpaulin 报告中的文件条目非法');
    }
    const path = raw.path.join('/');
    const counts: CoverageCounts = {
      lines: {
        covered: asNonNegativeInteger(raw.covered),
        total: asNonNegativeInteger(raw.coverable),
      },
      functions: { covered: 0, total: 0 },
      branches: { covered: 0, total: 0 },
      statements: { covered: 0, total: 0 },
    };
    files.push({ path: toRepoRelative(repoRoot, path), counts });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return files;
}
