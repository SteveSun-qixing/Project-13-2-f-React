import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { COVERAGE_REPORT_PATHS } from '../src/thresholds';
import { runCoverageGate } from '../src/coverage/runner';
import type { G6CoverageReport, G6GroupResult } from '../src/coverage/g6';
import type { G6RunOutcome } from '../src/coverage/g6';

const tsEntry = (
  covered: number,
  total: number
): { covered: number; total: number; pct: number } => ({
  covered,
  total,
  pct: total === 0 ? 100 : (covered / total) * 100,
});

interface FixtureOptions {
  readonly tsCovered?: number;
  readonly tsTotal?: number;
  readonly uiCovered?: number;
  readonly uiTotal?: number;
  readonly coreCovered?: number;
  readonly coreTotal?: number;
  readonly omitVitest?: boolean;
  readonly omitTarpaulin?: boolean;
}

const writeFixture = (repoRoot: string, options: FixtureOptions): void => {
  const tsPath = join(repoRoot, COVERAGE_REPORT_PATHS.vitestSummary);
  const rustPath = join(repoRoot, COVERAGE_REPORT_PATHS.tarpaulinJson);
  if (options.omitVitest !== true) {
    mkdirSync(join(repoRoot, 'coverage/ts'), { recursive: true });
    const summary: Record<string, unknown> = {
      total: { lines: tsEntry(options.tsCovered ?? 0, options.tsTotal ?? 1) },
      [`${repoRoot}/packages/sdk/src/a.ts`]: {
        lines: tsEntry(options.tsCovered ?? 0, options.tsTotal ?? 1),
        functions: tsEntry(options.tsCovered ?? 0, options.tsTotal ?? 1),
        branches: tsEntry(options.tsCovered ?? 0, options.tsTotal ?? 1),
        statements: tsEntry(options.tsCovered ?? 0, options.tsTotal ?? 1),
      },
      [`${repoRoot}/packages/ui/src/a.ts`]: {
        lines: tsEntry(options.uiCovered ?? 0, options.uiTotal ?? 1),
        functions: tsEntry(options.uiCovered ?? 0, options.uiTotal ?? 1),
        branches: tsEntry(options.uiCovered ?? 0, options.uiTotal ?? 1),
        statements: tsEntry(options.uiCovered ?? 0, options.uiTotal ?? 1),
      },
    };
    writeFileSync(tsPath, JSON.stringify(summary), 'utf8');
  }
  if (options.omitTarpaulin !== true) {
    mkdirSync(join(repoRoot, 'coverage/rust'), { recursive: true });
    writeFileSync(
      rustPath,
      JSON.stringify({
        coverage: 0,
        covered: 0,
        coverable: 0,
        files: [
          {
            path: ['packages', 'core-rust', 'crates', 'chips-core', 'src', 'lib.rs'],
            covered: options.coreCovered ?? 0,
            coverable: options.coreTotal ?? 1,
          },
          {
            path: ['packages', 'native', 'src', 'lib.rs'],
            covered: options.coreCovered ?? 0,
            coverable: options.coreTotal ?? 1,
          },
        ],
      }),
      'utf8'
    );
  }
};

const group = (
  id: string,
  threshold: number,
  pass: boolean,
  pct: number,
  covered: number,
  total: number,
  extra: Partial<G6GroupResult> = {}
): G6GroupResult => ({
  id,
  threshold,
  pass,
  metrics: {
    lines: { pct, covered, total, threshold, pass },
    functions: { pct, covered, total, threshold, pass },
    branches: { pct, covered, total, threshold, pass },
    statements: { pct, covered, total, threshold, pass },
  },
  ...extra,
});

const gatePass = (overrides: Partial<G6CoverageReport> = {}): G6RunOutcome => ({
  ok: true,
  report: {
    gate: 'coverage',
    title: '覆盖率门禁（G6）',
    status: 'pass',
    summary: {
      coverage: [
        group('total', 80, true, 90, 90, 100),
        group('shared', 90, true, 95, 95, 100),
        group('rust-overall', 80, true, 92, 92, 100, {}),
        group('rust-core', 90, true, 92, 92, 100, {}),
      ],
    },
    violations: [],
    warnings: [],
    ...overrides,
  },
});

describe('runCoverageGate（测量 + G6 委托，工单 017）', () => {
  let repoRoot: string;
  let output: string[];

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'chips-coverage-gate-'));
    output = [];
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('G6 判定通过时退出码 0，并写出 JSON 与 Markdown 报告', () => {
    writeFixture(repoRoot, {
      tsCovered: 90,
      tsTotal: 100,
      uiCovered: 95,
      uiTotal: 100,
      coreCovered: 92,
      coreTotal: 100,
    });

    const result = runCoverageGate({
      repoRoot,
      write: (line) => output.push(line),
      runG6: () => gatePass(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.report?.passed).toBe(true);
    expect(result.report?.conclusion).toBe('通过');
    const summaryJson = JSON.parse(
      readFileSync(join(repoRoot, COVERAGE_REPORT_PATHS.outputDir, 'summary.json'), 'utf8')
    ) as { passed: boolean; status: string };
    expect(summaryJson.passed).toBe(true);
    expect(summaryJson.status).toBe('pass');
    const summaryMarkdown = readFileSync(
      join(repoRoot, COVERAGE_REPORT_PATHS.outputDir, 'summary.md'),
      'utf8'
    );
    expect(summaryMarkdown).toContain('结论：通过');
    expect(output.some((line) => line.includes('覆盖率门禁：通过'))).toBe(true);
    expect(output.some((line) => line.includes('G6 判定委托'))).toBe(true);
  });

  it('G6 豁免留痕放行时结论为豁免留痕通过，数字照常呈现', () => {
    writeFixture(repoRoot, {
      tsCovered: 90,
      tsTotal: 100,
      uiCovered: 95,
      uiTotal: 100,
      coreCovered: 83,
      coreTotal: 100,
    });
    const exemptedCore: G6GroupResult = {
      id: 'rust-core',
      threshold: 90,
      pass: true,
      exempted: ['TD-001'],
      metrics: {
        lines: {
          pct: 83,
          covered: 83,
          total: 100,
          threshold: 90,
          pass: true,
          exemption: { id: 'TD-001', deadline: '2026-10-19', approver: '生态所有者' },
        },
      },
    };
    const result = runCoverageGate({
      repoRoot,
      write: (line) => output.push(line),
      runG6: () =>
        gatePass({
          summary: {
            coverage: [
              group('total', 80, true, 90, 90, 100),
              group('shared', 90, true, 95, 95, 100),
              group('rust-overall', 80, true, 90, 90, 100, {}),
              exemptedCore,
            ],
          },
          warnings: [
            {
              code: 'COVERAGE030',
              message:
                'rust-core 覆盖率 lines 83.00% 未达标（要求 > 90%），依 §6.3 豁免 TD-001 留痕放行',
            },
          ],
        }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.report?.conclusion).toBe('豁免留痕通过');
    expect(
      output.some(
        (line) =>
          line.includes('豁免留痕放行（TD-001，至 2026-10-19）') && line.includes('83/100（83.00%')
      )
    ).toBe(true);
    const markdown = readFileSync(
      join(repoRoot, COVERAGE_REPORT_PATHS.outputDir, 'summary.md'),
      'utf8'
    );
    expect(markdown).toContain('结论：豁免留痕通过');
    expect(markdown).toContain('[COVERAGE030]');
  });

  it('G6 判定未通过时退出码 1，违规逐条透出', () => {
    writeFixture(repoRoot, {
      tsCovered: 90,
      tsTotal: 100,
      uiCovered: 89,
      uiTotal: 100,
      coreCovered: 80,
      coreTotal: 100,
    });
    const failedShared: G6GroupResult = {
      id: 'shared',
      threshold: 90,
      pass: false,
      metrics: {
        lines: { pct: 89, covered: 89, total: 100, threshold: 90, pass: false },
      },
    };
    const failedCore: G6GroupResult = {
      id: 'rust-core',
      threshold: 90,
      pass: false,
      metrics: {
        lines: { pct: 80, covered: 80, total: 100, threshold: 90, pass: false },
      },
    };
    const result = runCoverageGate({
      repoRoot,
      write: (line) => output.push(line),
      runG6: () => ({
        ok: true,
        report: {
          gate: 'coverage',
          title: '覆盖率门禁（G6）',
          status: 'fail',
          summary: {
            coverage: [
              group('total', 80, true, 90, 90, 100),
              failedShared,
              group('rust-overall', 80, true, 90, 90, 100, {}),
              failedCore,
            ],
          },
          violations: [
            { code: 'COVERAGE010', message: 'shared 覆盖率 lines 89.00% 未达标（要求 > 90%）' },
            { code: 'COVERAGE010', message: 'rust-core 覆盖率 lines 80.00% 未达标（要求 > 90%）' },
          ],
          warnings: [],
        },
      }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.report?.passed).toBe(false);
    expect(output.some((line) => line.includes('TS 共享层') && line.includes('未通过'))).toBe(true);
    expect(output.some((line) => line.includes('Rust 核心') && line.includes('未通过'))).toBe(true);
    expect(output.filter((line) => line.includes('违规 [COVERAGE010]'))).toHaveLength(2);
  });

  it('G6 委托不可用时退出码 2 并给出委托失败原因', () => {
    writeFixture(repoRoot, { tsCovered: 90, tsTotal: 100, coreCovered: 92, coreTotal: 100 });

    const result = runCoverageGate({
      repoRoot,
      write: (line) => output.push(line),
      runG6: (): G6RunOutcome => ({ ok: false, message: 'G6 委托启动失败：模拟' }),
    });

    expect(result.exitCode).toBe(2);
    expect(result.message).toContain('G6 委托启动失败');
  });

  it('报告缺失时退出码 2 并给出缺失路径（委托不发生）', () => {
    let delegated = false;
    const result = runCoverageGate({
      repoRoot,
      write: (line) => output.push(line),
      runG6: () => {
        delegated = true;
        return gatePass();
      },
    });

    expect(result.exitCode).toBe(2);
    expect(result.message).toContain('覆盖率报告缺失');
    expect(result.message).toContain('coverage/ts/coverage-summary.json');
    expect(result.message).toContain('coverage/rust/tarpaulin-report.json');
    expect(delegated).toBe(false);
  });

  it('只缺失 Rust 报告时同样退出码 2', () => {
    writeFixture(repoRoot, { tsCovered: 90, tsTotal: 100, omitTarpaulin: true });

    const result = runCoverageGate({
      repoRoot,
      write: (line) => output.push(line),
      runG6: () => gatePass(),
    });

    expect(result.exitCode).toBe(2);
    expect(result.message).toContain('tarpaulin-report.json');
    expect(result.message).not.toContain('coverage-summary.json');
  });

  it('报告内容非法时退出码 2', () => {
    mkdirSync(join(repoRoot, 'coverage/ts'), { recursive: true });
    mkdirSync(join(repoRoot, 'coverage/rust'), { recursive: true });
    writeFileSync(join(repoRoot, COVERAGE_REPORT_PATHS.vitestSummary), 'null', 'utf8');
    writeFileSync(join(repoRoot, COVERAGE_REPORT_PATHS.tarpaulinJson), 'null', 'utf8');

    const result = runCoverageGate({
      repoRoot,
      write: (line) => output.push(line),
      runG6: () => gatePass(),
    });

    expect(result.exitCode).toBe(2);
    expect(result.message).toContain('解析失败');
  });
});
