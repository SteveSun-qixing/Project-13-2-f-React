import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { COVERAGE_REPORT_PATHS } from '../src/thresholds';
import { runCoverageGate } from '../src/coverage/runner';

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
  readonly rustCovered?: number;
  readonly rustTotal?: number;
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
            covered: options.rustCovered ?? 0,
            coverable: options.rustTotal ?? 1,
          },
        ],
      }),
      'utf8'
    );
  }
};

describe('runCoverageGate', () => {
  let repoRoot: string;
  let output: string[];

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'chips-coverage-gate-'));
    output = [];
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('全部达标时退出码 0，并写出 JSON 与 Markdown 报告', () => {
    writeFixture(repoRoot, {
      tsCovered: 90,
      tsTotal: 100,
      uiCovered: 95,
      uiTotal: 100,
      rustCovered: 92,
      rustTotal: 100,
      coreCovered: 92,
      coreTotal: 100,
    });

    const result = runCoverageGate({
      repoRoot,
      write: (line) => output.push(line),
    });

    expect(result.exitCode).toBe(0);
    expect(result.report?.passed).toBe(true);
    const summaryJson = JSON.parse(
      readFileSync(join(repoRoot, COVERAGE_REPORT_PATHS.outputDir, 'summary.json'), 'utf8')
    ) as { passed: boolean };
    expect(summaryJson.passed).toBe(true);
    const summaryMarkdown = readFileSync(
      join(repoRoot, COVERAGE_REPORT_PATHS.outputDir, 'summary.md'),
      'utf8'
    );
    expect(summaryMarkdown).toContain('结论：通过');
    expect(output.some((line) => line.includes('覆盖率门禁：通过'))).toBe(true);
  });

  it('阈值未达标时退出码 1 且报告标记未通过', () => {
    writeFixture(repoRoot, {
      tsCovered: 90,
      tsTotal: 100,
      uiCovered: 89,
      uiTotal: 100,
      rustCovered: 85,
      rustTotal: 100,
      coreCovered: 80,
      coreTotal: 100,
    });

    const result = runCoverageGate({ repoRoot, write: (line) => output.push(line) });

    expect(result.exitCode).toBe(1);
    expect(result.report?.passed).toBe(false);
    expect(
      output.some((line) => line.includes('共享层 packages/ui') && line.includes('未通过'))
    ).toBe(true);
    expect(output.some((line) => line.includes('Rust 核心') && line.includes('未通过'))).toBe(true);
  });

  it('报告缺失时退出码 2 并给出缺失路径', () => {
    const result = runCoverageGate({ repoRoot, write: (line) => output.push(line) });

    expect(result.exitCode).toBe(2);
    expect(result.message).toContain('覆盖率报告缺失');
    expect(result.message).toContain('coverage/ts/coverage-summary.json');
    expect(result.message).toContain('coverage/rust/tarpaulin-report.json');
  });

  it('只缺失 Rust 报告时同样退出码 2', () => {
    writeFixture(repoRoot, { tsCovered: 90, tsTotal: 100, omitTarpaulin: true });

    const result = runCoverageGate({ repoRoot, write: (line) => output.push(line) });

    expect(result.exitCode).toBe(2);
    expect(result.message).toContain('tarpaulin-report.json');
    expect(result.message).not.toContain('coverage-summary.json');
  });

  it('报告内容非法时退出码 2', () => {
    mkdirSync(join(repoRoot, 'coverage/ts'), { recursive: true });
    mkdirSync(join(repoRoot, 'coverage/rust'), { recursive: true });
    writeFileSync(join(repoRoot, COVERAGE_REPORT_PATHS.vitestSummary), 'null', 'utf8');
    writeFileSync(join(repoRoot, COVERAGE_REPORT_PATHS.tarpaulinJson), 'null', 'utf8');

    const result = runCoverageGate({ repoRoot, write: (line) => output.push(line) });

    expect(result.exitCode).toBe(2);
    expect(result.message).toContain('解析失败');
  });
});
