import { describe, expect, it } from 'vitest';

import {
  buildVerdicts,
  conclusionOf,
  coveragePercent,
  createGateReport,
  createGroup,
  createRustGroups,
  createTsGroups,
  formatPercent,
  globToPathPrefix,
  isCoreRustPath,
  matchesGlob,
  renderReportMarkdown,
  sumCounts,
  sumMetric,
} from '../src/coverage/gate';
import type { CoverageCounts, CoveredFile } from '../src/coverage/model';
import type { G6CoverageReport, G6GroupResult, G6MetricResult } from '../src/coverage/g6';

const uniformCounts = (covered: number, total: number): CoverageCounts => ({
  lines: { covered, total },
  functions: { covered, total },
  branches: { covered, total },
  statements: { covered, total },
});

const file = (path: string, covered: number, total: number): CoveredFile => ({
  path,
  counts: uniformCounts(covered, total),
});

const groupResult = (
  id: string,
  threshold: number,
  pass: boolean,
  metrics: NonNullable<G6GroupResult['metrics']>,
  extra: Partial<G6GroupResult> = {}
): G6GroupResult => ({ id, threshold, pass, metrics, ...extra });

const gateReport = (
  status: 'pass' | 'fail',
  coverage: G6GroupResult[],
  options: Partial<Pick<G6CoverageReport, 'violations' | 'warnings'>> = {}
): G6CoverageReport => ({
  gate: 'coverage',
  title: '覆盖率门禁（G6）',
  status,
  summary: { coverage },
  violations: options.violations ?? [],
  warnings: options.warnings ?? [],
});

const passMetrics = (
  pct: number,
  covered: number,
  total: number,
  threshold: number
): Readonly<Record<string, G6MetricResult>> => ({
  lines: { pct, covered, total, threshold, pass: pct > threshold },
  functions: { pct, covered, total, threshold, pass: pct > threshold },
  branches: { pct, covered, total, threshold, pass: pct > threshold },
  statements: { pct, covered, total, threshold, pass: pct > threshold },
});

describe('覆盖率测量聚合（判定已委托 G6，本侧只测量与渲染）', () => {
  it('coveragePercent 在总量为 0 时返回 null', () => {
    expect(coveragePercent({ covered: 0, total: 0 })).toBeNull();
    expect(coveragePercent({ covered: 1, total: 4 })).toBe(25);
  });

  it('sumMetric 与 sumCounts 聚合多文件', () => {
    const files = [file('packages/ui/src/a.ts', 1, 2), file('packages/ui/src/b.ts', 3, 4)];

    expect(sumMetric(files, 'lines')).toEqual({ covered: 4, total: 6 });
    expect(sumCounts(files).lines).toEqual({ covered: 4, total: 6 });
    expect(sumCounts(files).branches).toEqual({ covered: 4, total: 6 });
  });

  it('globToPathPrefix 去掉 /** 后缀', () => {
    expect(globToPathPrefix('packages/ui/**')).toBe('packages/ui');
    expect(globToPathPrefix('packages/bridge/**/')).toBe('packages/bridge');
  });

  it('matchesGlob 精确匹配目录及其子路径，不匹配同名前缀目录', () => {
    expect(matchesGlob('packages/ui/**', 'packages/ui')).toBe(true);
    expect(matchesGlob('packages/ui/**', 'packages/ui/src/a.ts')).toBe(true);
    expect(matchesGlob('packages/ui/**', 'packages/ui-extra/a.ts')).toBe(false);
    expect(matchesGlob('packages/ui/**', 'packages/bridge/a.ts')).toBe(false);
  });

  it('createTsGroups 产出总体与共享层分组', () => {
    const groups = createTsGroups([
      file('packages/sdk/src/a.ts', 80, 100),
      file('packages/ui/src/b.ts', 95, 100),
      file('packages/bridge/src/c.ts', 90, 100),
    ]);
    expect(groups.map((group) => group.id)).toEqual([
      'ts-overall',
      'ts-shared:packages/ui',
      'ts-shared:packages/bridge',
    ]);
    expect(groups[1]?.counts.lines).toEqual({ covered: 95, total: 100 });
  });

  it('createRustGroups 把 chips-native 并入核心统计面（统计面不另计、不缩小）', () => {
    // 口径出处：《架构原则》R18 与 4.1、《测试规范》§一 与 §10.2、《CI/CD 与质量门禁》3.2。
    // §6.3 豁免只作用于判定层，不改变统计面归属（工单 017）。
    const groups = createRustGroups([
      file('packages/core-rust/crates/chips-core/src/lib.rs', 100, 100),
      file('packages/native/src/convert.rs', 50, 202),
    ]);
    const core = groups[1];
    expect(core?.id).toBe('rust-core');
    expect(core?.fileCount).toBe(2);
    expect(core?.counts.lines).toEqual({ covered: 150, total: 302 });
    expect(isCoreRustPath('packages/native/src/lib.rs')).toBe(true);
    expect(isCoreRustPath('packages/other-rust/src/lib.rs')).toBe(false);
  });

  it('createGroup 聚合维度与文件数', () => {
    const group = createGroup('g', '分组', [file('a.ts', 1, 2), file('b.ts', 3, 4)]);
    expect(group.id).toBe('g');
    expect(group.fileCount).toBe(2);
    expect(group.counts.statements).toEqual({ covered: 4, total: 6 });
  });
});

describe('G6 判定渲染', () => {
  it('buildVerdicts 逐组逐维度展开 G6 明细并映射展示名', () => {
    const gate = gateReport('pass', [
      groupResult('total', 80, true, passMetrics(90, 90, 100, 80)),
      groupResult('rust-core', 90, true, {
        lines: { pct: 95, covered: 95, total: 100, threshold: 90, pass: true },
      }),
    ]);
    const verdicts = buildVerdicts(gate);
    expect(verdicts).toHaveLength(5);
    expect(verdicts[0]).toMatchObject({
      group: 'total',
      label: 'TS 总体',
      metric: 'lines',
      covered: 90,
      total: 100,
      percent: 90,
      passed: true,
    });
    expect(verdicts[4]?.label).toBe('Rust 核心 chips-* crates');
  });

  it('skipped 分组（无维度数据）渲染为无数据行', () => {
    const gate = gateReport('pass', [groupResult('shared', 90, true, {}, { skipped: true })]);
    const verdicts = buildVerdicts(gate);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]?.percent).toBeNull();
  });

  it('豁免命中：判定行携带豁免编号与期限，结论转豁免留痕通过', () => {
    const gate = gateReport(
      'pass',
      [
        groupResult(
          'rust-core',
          90,
          true,
          {
            lines: {
              pct: 83,
              covered: 512,
              total: 617,
              threshold: 90,
              pass: true,
              exemption: { id: 'TD-001', deadline: '2026-10-19', approver: '生态所有者' },
            },
          },
          { exempted: ['TD-001'] }
        ),
      ],
      {
        warnings: [
          {
            code: 'COVERAGE030',
            message: 'rust-core 覆盖率 lines 83.00% 未达标，依 §6.3 豁免 TD-001 留痕放行',
          },
        ],
      }
    );
    expect(conclusionOf(gate)).toBe('豁免留痕通过');
    const verdicts = buildVerdicts(gate);
    expect(verdicts[0]?.exemption).toEqual({ id: 'TD-001', deadline: '2026-10-19' });
    expect(verdicts[0]?.passed).toBe(true);
    // 数字照常呈现：渲染层保留原始命中/总量。
    expect(verdicts[0]?.covered).toBe(512);
    expect(verdicts[0]?.total).toBe(617);
  });

  it('conclusionOf 区分通过/未通过', () => {
    expect(conclusionOf(gateReport('pass', []))).toBe('通过');
    expect(conclusionOf(gateReport('fail', []))).toBe('未通过');
  });
});

describe('聚合报告', () => {
  const tsFiles = [file('packages/ui/src/a.ts', 95, 100)];
  const rustFiles = [file('packages/core-rust/crates/chips-core/src/lib.rs', 95, 100)];

  it('createGateReport 渲染 G6 结论并保留两侧测量分组', () => {
    const gate = gateReport('pass', [
      groupResult('total', 80, true, passMetrics(95, 95, 100, 80)),
      groupResult('rust-core', 90, true, {
        lines: { pct: 95, covered: 95, total: 100, threshold: 90, pass: true },
      }),
    ]);
    const report = createGateReport(tsFiles, rustFiles, gate, '2026-09-20T00:00:00.000Z');

    expect(report.generatedAt).toBe('2026-09-20T00:00:00.000Z');
    expect(report.status).toBe('pass');
    expect(report.conclusion).toBe('通过');
    expect(report.passed).toBe(true);
    expect(report.verdicts).toHaveLength(5);
    expect(report.ts.groups.map((group) => group.id)).toEqual([
      'ts-overall',
      'ts-shared:packages/ui',
      'ts-shared:packages/bridge',
    ]);
    expect(report.rust.groups[1]?.id).toBe('rust-core');
  });

  it('G6 未通过时整体不通过并透传违规', () => {
    const gate: G6CoverageReport = {
      ...gateReport('fail', [
        groupResult('shared', 90, false, {
          ...passMetrics(88, 88, 100, 90),
          lines: { pct: 88, covered: 88, total: 100, threshold: 90, pass: false },
        }),
      ]),
      violations: [
        { code: 'COVERAGE010', message: 'shared 覆盖率 lines 88.00% 未达标（要求 > 90%）' },
      ],
    };
    const report = createGateReport(tsFiles, rustFiles, gate, '2026-09-20T00:00:00.000Z');

    expect(report.passed).toBe(false);
    expect(report.violations[0]?.code).toBe('COVERAGE010');
  });

  it('Markdown 报告包含结论、G6 判定明细、测量分组与留痕', () => {
    const gate = gateReport(
      'pass',
      [
        groupResult('total', 80, true, passMetrics(95, 95, 100, 80)),
        groupResult(
          'rust-core',
          90,
          true,
          {
            lines: {
              pct: 83,
              covered: 512,
              total: 617,
              threshold: 90,
              pass: true,
              exemption: { id: 'TD-001', deadline: '2026-10-19', approver: '生态所有者' },
            },
          },
          { exempted: ['TD-001'] }
        ),
      ],
      { warnings: [{ code: 'COVERAGE030', message: 'rust-core 豁免 TD-001 留痕放行' }] }
    );
    const markdown = renderReportMarkdown(
      createGateReport(tsFiles, rustFiles, gate, '2026-09-20T00:00:00.000Z')
    );

    expect(markdown).toContain('# 覆盖率报告（测量/报告面）');
    expect(markdown).toContain('结论：豁免留痕通过');
    expect(markdown).toContain('唯一判定面：G6');
    expect(markdown).toContain('95.00%');
    expect(markdown).toContain('共享层 packages/ui');
    expect(markdown).toContain('Rust 核心 chips-* crates');
    expect(markdown).toContain('TD-001（至 2026-10-19）');
    expect(markdown).toContain('512/617');
    expect(markdown).toContain('[COVERAGE030]');
  });

  it('formatPercent 对无数据展示占位符', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(89.996)).toBe('90.00%');
  });
});
