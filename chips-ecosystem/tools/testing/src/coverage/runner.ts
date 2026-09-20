/**
 * 覆盖率聚合报告执行器：读取报告文件、委托 G6 判定、写出聚合报告。
 *
 * 本侧不做判定（工单 017 裁决：G6 `check-coverage.mjs` 为唯一判定面）；
 * 判定结果通过 `runG6CoverageGate` 委托获得，本执行器只做测量、渲染与落盘。
 *
 * 退出码约定（CI 依据，与委托目标保持一致）：
 * - `0`：G6 判定通过（含 §6.3 豁免留痕放行）；
 * - `1`：G6 判定未通过；
 * - `2`：测量报告缺失、解析失败或 G6 委托不可用（基础设施/流水线问题）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COVERAGE_REPORT_PATHS } from '../thresholds.ts';
import { createGateReport, formatPercent, renderReportMarkdown } from './gate.ts';
import { runG6CoverageGate, type G6CoverageReport, type G6RunOutcome } from './g6.ts';
import { parseTarpaulinReport, parseVitestSummary } from './parse.ts';
import type { CoverageGateReport, CoverageVerdict, CoveredFile } from './model.ts';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/** 仓库根绝对路径（`chips-ecosystem/`）。 */
export const REPO_ROOT = resolve(MODULE_DIR, '..', '..', '..', '..');

/** 执行选项。 */
export interface RunCoverageGateOptions {
  /** 仓库根绝对路径；默认自动解析。 */
  readonly repoRoot?: string;
  /** 报告输出目录（仓库相对路径）；默认 `reports/coverage`。 */
  readonly outputDir?: string;
  /** 结果输出回调；默认写 `process.stdout`，测试时可注入。 */
  readonly write?: (line: string) => void;
  /** G6 委托执行回调；默认子进程运行 `tools/gates/check-coverage.mjs --json`，测试可注入。 */
  readonly runG6?: (repoRoot: string) => G6RunOutcome;
}

/** 执行结果。 */
export interface RunCoverageGateResult {
  readonly exitCode: 0 | 1 | 2;
  readonly report?: CoverageGateReport;
  readonly message?: string;
}

interface ReportInputs {
  readonly repoRoot: string;
  readonly vitestPath: string;
  readonly tarpaulinPath: string;
}

const readJson = (filePath: string): unknown => JSON.parse(readFileSync(filePath, 'utf8')) as unknown;

const writeReportFiles = (
  report: CoverageGateReport,
  outputDir: string,
  write: (line: string) => void
): void => {
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = join(outputDir, 'summary.json');
  const markdownPath = join(outputDir, 'summary.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(markdownPath, renderReportMarkdown(report), 'utf8');
  write(`覆盖率报告已写入：${jsonPath}`);
  write(`覆盖率报告已写入：${markdownPath}`);
};

const renderVerdictLine = (verdict: CoverageVerdict): string => {
  const state = verdict.passed
    ? verdict.exemption
      ? `豁免留痕放行（${verdict.exemption.id}，至 ${verdict.exemption.deadline}）`
      : '通过'
    : '未通过';
  return (
    `  [${state}] ${verdict.label} ${verdict.metric} ` +
    `${verdict.covered}/${verdict.total}（${formatPercent(verdict.percent)}，阈值 ${verdict.threshold}%）`
  );
};

/**
 * 执行覆盖率聚合报告流程：测量解析 → G6 委托判定 → 报告落盘与渲染。
 *
 * 报告文件缺失、解析失败或 G6 委托不可用返回退出码 2；G6 判定未通过返回 1；通过返回 0。
 */
export function runCoverageGate(options: RunCoverageGateOptions = {}): RunCoverageGateResult {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const outputDir = resolve(repoRoot, options.outputDir ?? COVERAGE_REPORT_PATHS.outputDir);
  const write = options.write ?? ((line: string): void => void process.stdout.write(`${line}\n`));
  const delegate = options.runG6 ?? runG6CoverageGate;

  const inputs: ReportInputs = {
    repoRoot,
    vitestPath: resolve(repoRoot, COVERAGE_REPORT_PATHS.vitestSummary),
    tarpaulinPath: resolve(repoRoot, COVERAGE_REPORT_PATHS.tarpaulinJson),
  };

  const missing: string[] = [];
  if (!existsSync(inputs.vitestPath)) {
    missing.push(inputs.vitestPath);
  }
  if (!existsSync(inputs.tarpaulinPath)) {
    missing.push(inputs.tarpaulinPath);
  }
  if (missing.length > 0) {
    return {
      exitCode: 2,
      message: `覆盖率报告缺失（请先运行 pnpm test:coverage:ts 与 pnpm test:coverage:rust）：\n${missing.join('\n')}`,
    };
  }

  let files: { readonly tsFiles: readonly CoveredFile[]; readonly rustFiles: readonly CoveredFile[] };
  try {
    files = {
      tsFiles: parseVitestSummary(readJson(inputs.vitestPath), repoRoot),
      rustFiles: parseTarpaulinReport(readJson(inputs.tarpaulinPath), repoRoot),
    };
  } catch (error) {
    return {
      exitCode: 2,
      message: `覆盖率报告解析失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const outcome = delegate(repoRoot);
  if (!outcome.ok) {
    return { exitCode: 2, message: outcome.message };
  }
  const gate: G6CoverageReport = outcome.report;

  const report = createGateReport(files.tsFiles, files.rustFiles, gate);
  writeReportFiles(report, outputDir, write);
  write(`G6 判定委托（${gate.gate} ${gate.title}）：`);
  for (const verdict of report.verdicts) {
    write(renderVerdictLine(verdict));
  }
  for (const violation of report.violations) {
    write(`  违规 [${violation.code}] ${violation.message}`);
  }
  write(`覆盖率门禁：${report.conclusion}`);
  return { exitCode: report.passed ? 0 : 1, report };
}
