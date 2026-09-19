import { describe, expect, it } from 'vitest';

import {
  coveragePercent,
  createGateReport,
  createRustSection,
  createTsGroups,
  createTsSection,
  evaluateGroup,
  formatPercent,
  globToPathPrefix,
  matchesGlob,
  renderReportMarkdown,
  sumCounts,
  sumMetric,
} from '../src/coverage/gate';
import type { CoverageCounts, CoveredFile } from '../src/coverage/model';

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

describe('覆盖率基础聚合', () => {
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
});

describe('共享层 90% 判定', () => {
  it('恰好 90% 判定通过，低于 90% 判定失败', () => {
    const group = createTsGroups([file('packages/ui/src/a.ts', 90, 100)])[1];
    expect(group).toBeDefined();
    if (group === undefined) {
      return;
    }

    const passed = evaluateGroup(group, { lines: 90, functions: 90, branches: 90, statements: 90 });
    expect(passed.every((verdict) => verdict.passed)).toBe(true);
    expect(passed[0]?.percent).toBe(90);

    const failingGroup = createTsGroups([file('packages/ui/src/a.ts', 899, 1000)])[1];
    expect(failingGroup).toBeDefined();
    if (failingGroup === undefined) {
      return;
    }
    const failed = evaluateGroup(failingGroup, {
      lines: 90,
      functions: 90,
      branches: 90,
      statements: 90,
    });
    expect(failed.some((verdict) => !verdict.passed)).toBe(true);
  });

  it('ts-overall 使用 80% 阈值，共享层分组使用 90% 阈值', () => {
    const section = createTsSection([
      file('packages/sdk/src/a.ts', 80, 100),
      file('packages/ui/src/b.ts', 95, 100),
      file('packages/bridge/src/c.ts', 90, 100),
    ]);

    expect(section.groups.map((group) => group.id)).toEqual([
      'ts-overall',
      'ts-shared:packages/ui',
      'ts-shared:packages/bridge',
    ]);
    const overallVerdicts = section.verdicts.filter(
      (verdict) => verdict.label === 'TypeScript 总体'
    );
    expect(overallVerdicts.every((verdict) => verdict.threshold === 80 && verdict.passed)).toBe(
      true
    );
    const sharedVerdicts = section.verdicts.filter(
      (verdict) => verdict.label !== 'TypeScript 总体'
    );
    expect(sharedVerdicts.every((verdict) => verdict.threshold === 90 && verdict.passed)).toBe(
      true
    );
  });

  it('共享层分组无文件时跳过判定', () => {
    const section = createTsSection([file('packages/sdk/src/a.ts', 100, 100)]);

    expect(section.verdicts.every((verdict) => verdict.id.startsWith('ts-overall'))).toBe(true);
  });

  it('共享层未达标时该分组判定失败，总体不受影响', () => {
    const section = createTsSection([
      file('packages/sdk/src/a.ts', 150, 150),
      file('packages/ui/src/b.ts', 50, 100),
    ]);

    const uiVerdicts = section.verdicts.filter((verdict) =>
      verdict.id.startsWith('ts-shared:packages/ui')
    );
    expect(uiVerdicts).toHaveLength(4);
    expect(uiVerdicts.every((verdict) => !verdict.passed)).toBe(true);
    const overall = section.verdicts.filter((verdict) => verdict.id.startsWith('ts-overall'));
    expect(overall.every((verdict) => verdict.passed)).toBe(true);
    expect(overall[0]?.percent).toBe(80);
  });
});

describe('Rust 核心 90% 判定', () => {
  it('只有行覆盖参与判定，核心 crate 用 90% 阈值', () => {
    const section = createRustSection([
      file('packages/core-rust/crates/chips-core/src/lib.rs', 90, 100),
      file('packages/core-rust/crates/chips-parser/src/lib.rs', 90, 100),
      file('packages/native/src/lib.rs', 90, 100),
    ]);

    const overall = section.verdicts.find((verdict) => verdict.id === 'rust-overall:lines');
    const core = section.verdicts.find((verdict) => verdict.id === 'rust-core:lines');
    expect(section.verdicts).toHaveLength(2);
    expect(overall?.threshold).toBe(80);
    expect(overall?.passed).toBe(true);
    expect(core?.threshold).toBe(90);
    expect(core?.passed).toBe(true);
  });

  it('核心 crate 低于 90% 判定失败', () => {
    const section = createRustSection([
      file('packages/core-rust/crates/chips-core/src/lib.rs', 89, 100),
      file('packages/native/src/lib.rs', 89, 100),
    ]);

    const core = section.verdicts.find((verdict) => verdict.id === 'rust-core:lines');
    expect(core?.passed).toBe(false);
  });

  it('Neon 绑定 crate chips-native（packages/native）并入核心统计面，不设豁免也不另计', () => {
    // 口径出处：《架构原则》R18 与 4.1、《测试规范》§一 与 §10.2、《CI/CD 与质量门禁》3.2：
    // Rust 核心按 crate 名 `chips-*` 判定；`packages/native/Cargo.toml` 的 crate 名为
    // `chips-native`，故其源码行必须进入 90% 组的分子与分母。
    const section = createRustSection([
      file('packages/core-rust/crates/chips-core/src/lib.rs', 100, 100),
      file('packages/native/src/convert.rs', 50, 202),
    ]);

    const core = section.verdicts.find((verdict) => verdict.id === 'rust-core:lines');
    expect(core?.covered).toBe(150);
    expect(core?.total).toBe(302);
    expect(core?.passed).toBe(false);
    expect(section.groups.find((group) => group.id === 'rust-core')?.fileCount).toBe(2);
  });
});

describe('聚合报告', () => {
  it('createGateReport 汇总两侧结论与通过状态', () => {
    const report = createGateReport(
      [file('packages/ui/src/a.ts', 95, 100)],
      [file('packages/core-rust/crates/chips-core/src/lib.rs', 95, 100)],
      '2026-09-19T00:00:00.000Z'
    );

    expect(report.generatedAt).toBe('2026-09-19T00:00:00.000Z');
    expect(report.passed).toBe(true);
    expect(report.ts.verdicts).toHaveLength(8);
    expect(report.rust.verdicts).toHaveLength(2);
  });

  it('任一侧失败时整体不通过', () => {
    const report = createGateReport(
      [file('packages/ui/src/a.ts', 10, 100)],
      [file('packages/core-rust/crates/chips-core/src/lib.rs', 95, 100)],
      '2026-09-19T00:00:00.000Z'
    );

    expect(report.passed).toBe(false);
  });

  it('Markdown 报告包含结论、阈值与逐条判定', () => {
    const report = createGateReport(
      [file('packages/ui/src/a.ts', 95, 100)],
      [file('packages/core-rust/crates/chips-core/src/lib.rs', 95, 100)],
      '2026-09-19T00:00:00.000Z'
    );
    const markdown = renderReportMarkdown(report);

    expect(markdown).toContain('# 覆盖率门禁报告');
    expect(markdown).toContain('结论：通过');
    expect(markdown).toContain('95.00%');
    expect(markdown).toContain('共享层 packages/ui');
    expect(markdown).toContain('Rust 核心');
  });

  it('formatPercent 对无数据展示占位符', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(89.996)).toBe('90.00%');
  });
});
