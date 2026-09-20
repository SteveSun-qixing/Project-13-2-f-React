/**
 * G6 委托调用面（工单 017）：覆盖率判定唯一归属 `tools/gates/check-coverage.mjs`，
 * 本模块负责以 `--json --no-report` 执行 G6 并解析其结构化报告。
 *
 * 退出码语义沿用 G6 约定：`0` 判定通过、`1` 判定未通过（含豁免未命中）、
 * 其余视为基础设施失败（委托不可用，调用方按报告缺失同级的 exit 2 处理）。
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/** G6 单维度判定明细（`summary.coverage[*].metrics[*]`）。 */
export interface G6MetricResult {
  readonly pct: number;
  readonly covered: number;
  readonly total: number;
  readonly threshold: number;
  readonly pass: boolean;
  readonly exemption?: {
    readonly id: string;
    readonly deadline: string;
    readonly approver: string;
  };
}

/** G6 分组判定明细。 */
export interface G6GroupResult {
  readonly id: string;
  readonly threshold: number;
  readonly pass: boolean;
  readonly skipped?: boolean;
  readonly exempted?: readonly string[];
  readonly metrics?: Readonly<Record<string, G6MetricResult>>;
}

/** G6 违规/警告留痕条目。 */
export interface G6Trace {
  readonly code: string;
  readonly message: string;
}

/** G6 JSON 报告（只声明本侧消费的字段）。 */
export interface G6CoverageReport {
  readonly gate: string;
  readonly title: string;
  readonly status: 'pass' | 'fail';
  readonly summary: {
    readonly tsFiles?: number;
    readonly groups?: string;
    readonly coverage?: G6GroupResult[];
  };
  readonly violations: readonly G6Trace[];
  readonly warnings: readonly G6Trace[];
}

/** 委托执行结果。 */
export type G6RunOutcome =
  | { readonly ok: true; readonly report: G6CoverageReport }
  | { readonly ok: false; readonly message: string };

const isG6Report = (value: unknown): value is G6CoverageReport => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<G6CoverageReport>;
  return (
    (candidate.status === 'pass' || candidate.status === 'fail') &&
    Array.isArray(candidate.violations) &&
    Array.isArray(candidate.warnings) &&
    Array.isArray(candidate.summary?.coverage)
  );
};

/** 以子进程执行 G6 并解析 JSON 报告。 */
export function runG6CoverageGate(repoRoot: string): G6RunOutcome {
  const scriptPath = join(repoRoot, 'tools', 'gates', 'check-coverage.mjs');
  const result = spawnSync(process.execPath, [scriptPath, '--json', '--no-report'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.error !== undefined) {
    return { ok: false, message: `G6 委托启动失败：${result.error.message}` };
  }
  if (result.status !== 0 && result.status !== 1) {
    const detail = (result.stderr ?? '').trim() || (result.stdout ?? '').trim();
    return {
      ok: false,
      message: `G6 委托执行异常（退出码 ${String(result.status)}）：${detail}`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    return {
      ok: false,
      message: `G6 委托输出不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!isG6Report(parsed)) {
    return { ok: false, message: 'G6 委托输出结构非法（缺少 status/violations/warnings/summary.coverage）' };
  }
  return { ok: true, report: parsed };
}
