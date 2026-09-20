/**
 * 覆盖率测量聚合与人读报告渲染。
 *
 * 本模块不做任何门禁判定（工单 017 裁决：G6 `check-coverage.mjs` 为唯一判定面）；
 * 判定明细只把 G6 JSON 报告（`g6.ts`）渲染成表格与行文本。
 *
 * 分组口径与 G6 对应：
 * - TS：`ts-overall`（全部 TS 源文件）+ 每个共享层 glob 一个分组（与根 vitest
 *   `coverage.thresholds[glob]` 完全对应）；
 * - Rust：`rust-overall`（Rust 总体）+ `rust-core`（`CORE_RUST_CRATE_PATH_PREFIXES`
 *   声明的核心统计面；阈值与统计面口径见 `../thresholds.ts` 装载的门禁配置）。
 */

import type { G6CoverageReport } from './g6';
import type {
  CoverageCount,
  CoverageCounts,
  CoverageGateReport,
  CoverageGroup,
  CoverageVerdict,
  CoveredFile,
} from './model';
import type { CoverageMetric } from '../thresholds';
import {
  COVERAGE_METRICS,
  CORE_RUST_CRATE_PATH_PREFIXES,
  SHARED_LAYER_GLOBS,
} from '../thresholds';

/** 计算覆盖率百分比；总量为 0 时返回 `null`（口径不适用）。 */
export function coveragePercent(count: CoverageCount): number | null {
  if (count.total === 0) {
    return null;
  }
  return (count.covered / count.total) * 100;
}

/** 聚合文件列表在指定维度上的命中/总量。 */
export function sumMetric(files: readonly CoveredFile[], metric: CoverageMetric): CoverageCount {
  let covered = 0;
  let total = 0;
  for (const file of files) {
    covered += file.counts[metric].covered;
    total += file.counts[metric].total;
  }
  return { covered, total };
}

/** 聚合文件列表的全部统计维度。 */
export function sumCounts(files: readonly CoveredFile[]): CoverageCounts {
  return {
    lines: sumMetric(files, 'lines'),
    functions: sumMetric(files, 'functions'),
    branches: sumMetric(files, 'branches'),
    statements: sumMetric(files, 'statements'),
  };
}

/** 构造覆盖率分组。 */
export function createGroup(
  id: string,
  label: string,
  files: readonly CoveredFile[]
): CoverageGroup {
  return { id, label, counts: sumCounts(files), fileCount: files.length };
}

/** 把 `packages/ui/**` 这类目录 glob 转为仓库相对路径前缀。 */
export function globToPathPrefix(glob: string): string {
  const trimmed = glob.replace(/\/+$/, '');
  return trimmed.endsWith('/**') ? trimmed.slice(0, -3) : trimmed;
}

/** 判断仓库相对路径是否命中目录 glob（含目录自身）。 */
export function matchesGlob(glob: string, repoRelativePath: string): boolean {
  const prefix = globToPathPrefix(glob);
  return repoRelativePath === prefix || repoRelativePath.startsWith(`${prefix}/`);
}

const filterFiles = (
  files: readonly CoveredFile[],
  predicate: (path: string) => boolean
): CoveredFile[] => files.filter((file) => predicate(file.path));

/** 构造 TS 测量分组：总体 + 每个共享层 glob。 */
export function createTsGroups(files: readonly CoveredFile[]): CoverageGroup[] {
  const groups: CoverageGroup[] = [createGroup('ts-overall', 'TypeScript 总体', files)];
  for (const glob of SHARED_LAYER_GLOBS) {
    const prefix = globToPathPrefix(glob);
    groups.push(
      createGroup(`ts-shared:${prefix}`, `共享层 ${prefix}`, filterFiles(files, (path) =>
        matchesGlob(glob, path)
      ))
    );
  }
  return groups;
}

/** 判断仓库相对路径是否落在 Rust 核心（`chips-*` crates）统计面内。 */
export function isCoreRustPath(repoRelativePath: string): boolean {
  return CORE_RUST_CRATE_PATH_PREFIXES.some((prefix) => repoRelativePath.startsWith(prefix));
}

/** 构造 Rust 测量分组：总体 + 核心 crate 统计面。 */
export function createRustGroups(files: readonly CoveredFile[]): CoverageGroup[] {
  const coreLabel = `Rust 核心 chips-* crates（${CORE_RUST_CRATE_PATH_PREFIXES.join('、')}）`;
  return [
    createGroup('rust-overall', 'Rust 总体', files),
    createGroup('rust-core', coreLabel, filterFiles(files, (path) => isCoreRustPath(path))),
  ];
}

/** G6 分组 id → 展示名。 */
export const GROUP_LABELS: Readonly<Record<string, string>> = {
  total: 'TS 总体',
  shared: 'TS 共享层（packages/ui、packages/bridge）',
  'rust-overall': 'Rust 总体',
  'rust-core': 'Rust 核心 chips-* crates',
};

const verdictLabel = (groupId: string): string => GROUP_LABELS[groupId] ?? groupId;

/** 把 G6 结构化判定明细渲染为逐维度行。 */
export function buildVerdicts(gate: G6CoverageReport): CoverageVerdict[] {
  const verdicts: CoverageVerdict[] = [];
  for (const group of gate.summary.coverage ?? []) {
    const entries = Object.entries(group.metrics ?? {});
    if (entries.length === 0) {
      verdicts.push({
        group: group.id,
        label: verdictLabel(group.id),
        metric: 'lines',
        threshold: group.threshold,
        covered: 0,
        total: 0,
        percent: null,
        passed: group.pass,
      });
      continue;
    }
    for (const [metric, value] of entries) {
      verdicts.push({
        group: group.id,
        label: verdictLabel(group.id),
        metric: metric as CoverageMetric,
        threshold: value.threshold,
        covered: value.covered,
        total: value.total,
        percent: value.pct,
        passed: value.pass,
        ...(value.exemption
          ? { exemption: { id: value.exemption.id, deadline: value.exemption.deadline } }
          : {}),
      });
    }
  }
  return verdicts;
}

/** 中文结论：豁免命中时显式标注留痕放行（不放行数字，只放行判定）。 */
export function conclusionOf(gate: G6CoverageReport): string {
  if (gate.status !== 'pass') {
    return '未通过';
  }
  const exempted = (gate.summary.coverage ?? []).some(
    (group) => (group.exempted?.length ?? 0) > 0
  );
  return exempted ? '豁免留痕通过' : '通过';
}

/** 汇总测量分组与 G6 判定，构造聚合报告。 */
export function createGateReport(
  tsFiles: readonly CoveredFile[],
  rustFiles: readonly CoveredFile[],
  gate: G6CoverageReport,
  generatedAt: string = new Date().toISOString()
): CoverageGateReport {
  return {
    generatedAt,
    status: gate.status,
    conclusion: conclusionOf(gate),
    passed: gate.status === 'pass',
    ts: { groups: createTsGroups(tsFiles) },
    rust: { groups: createRustGroups(rustFiles) },
    verdicts: buildVerdicts(gate),
    violations: gate.violations,
    warnings: gate.warnings,
  };
}

/** 百分比展示：`null` 显示为 `—`。 */
export function formatPercent(percent: number | null): string {
  return percent === null ? '—' : `${percent.toFixed(2)}%`;
}

const renderVerdictRows = (verdicts: readonly CoverageVerdict[]): string[] =>
  verdicts.map(
    (verdict) =>
      `| ${verdict.label} | ${verdict.metric} | ${verdict.covered}/${verdict.total} | ` +
      `${formatPercent(verdict.percent)} | ${verdict.threshold}% | ` +
      `${verdict.passed ? (verdict.exemption ? '豁免留痕放行' : '通过') : '未通过'} | ` +
      `${verdict.exemption ? `${verdict.exemption.id}（至 ${verdict.exemption.deadline}）` : '—'} |`
  );

const renderGroupRow = (group: CoverageGroup): string => {
  const cells = COVERAGE_METRICS.map((metric) => {
    const count = group.counts[metric];
    return `${count.covered}/${count.total}（${formatPercent(coveragePercent(count))}）`;
  });
  return `| ${group.label} | ${group.fileCount} | ${cells.join(' | ')} |`;
};

const measurementTableHead = [
  '| 分组 | 文件数 | lines | functions | branches | statements |',
  '| --- | --- | --- | --- | --- | --- |',
];

/** 渲染 Markdown 报告（供 CI 存档与人工复核；判定结论以 G6 为准）。 */
export function renderReportMarkdown(report: CoverageGateReport): string {
  const lines: string[] = [
    '# 覆盖率报告（测量/报告面）',
    '',
    `- 生成时间：${report.generatedAt}`,
    `- 结论：${report.conclusion}`,
    '- 唯一判定面：G6 `tools/gates/check-coverage.mjs`（工单 017）；本报告渲染其判定结果',
    '- 口径：《测试规范》§10.2 / G6 / R18；豁免依《CI/CD 与质量门禁》§6.3 登记并留痕',
    '',
    '## G6 判定明细',
    '',
    '| 分组 | 维度 | 命中/总量 | 覆盖率 | 阈值 | 结论 | 豁免 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...renderVerdictRows(report.verdicts),
    '',
    '## TypeScript 测量分组（vitest + v8）',
    '',
    ...measurementTableHead,
    ...report.ts.groups.map(renderGroupRow),
    '',
    '## Rust 测量分组（cargo-tarpaulin，仅行覆盖有数据）',
    '',
    ...measurementTableHead,
    ...report.rust.groups.map(renderGroupRow),
    '',
    '## 违规与豁免留痕（来自 G6）',
    '',
  ];
  if (report.violations.length === 0 && report.warnings.length === 0) {
    lines.push('- 无');
  }
  for (const item of [...report.violations, ...report.warnings]) {
    lines.push(`- [${item.code}] ${item.message}`);
  }
  lines.push('');
  return `${lines.join('\n')}`;
}
