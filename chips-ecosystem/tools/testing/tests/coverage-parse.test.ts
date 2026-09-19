import { describe, expect, it } from 'vitest';

import {
  parseTarpaulinReport,
  parseVitestSummary,
  toRepoRelative,
  type TarpaulinReport,
  type VitestSummary,
} from '../src/coverage/parse';

const REPO_ROOT = '/workspace/chips-ecosystem';

const vitestEntry = (covered: number, total: number): { covered: number; total: number; pct: number } => ({
  covered,
  total,
  pct: total === 0 ? 100 : (covered / total) * 100,
});

describe('toRepoRelative', () => {
  it('把仓库内绝对路径转为以 / 分隔的相对路径', () => {
    expect(toRepoRelative(REPO_ROOT, `${REPO_ROOT}/packages/ui/src/a.ts`)).toBe(
      'packages/ui/src/a.ts'
    );
  });

  it('仓库外绝对路径保持绝对形式', () => {
    expect(toRepoRelative(REPO_ROOT, '/other/place/a.ts')).toBe('/other/place/a.ts');
  });

  it('相对路径统一为正斜杠', () => {
    expect(toRepoRelative(REPO_ROOT, 'packages\\ui\\src\\a.ts')).toBe('packages/ui/src/a.ts');
  });
});

describe('parseVitestSummary', () => {
  it('跳过 total 条目，逐文件归一四个维度并按路径排序', () => {
    const summary: VitestSummary = {
      total: { lines: vitestEntry(3, 4) },
      [`${REPO_ROOT}/packages/ui/src/b.ts`]: {
        lines: vitestEntry(1, 2),
        functions: vitestEntry(1, 1),
        branches: vitestEntry(0, 1),
        statements: vitestEntry(1, 2),
      },
      [`${REPO_ROOT}/packages/ui/src/a.ts`]: {
        lines: vitestEntry(2, 2),
      },
    };

    const files = parseVitestSummary(summary, REPO_ROOT);

    expect(files.map((file) => file.path)).toEqual(['packages/ui/src/a.ts', 'packages/ui/src/b.ts']);
    expect(files[0]?.counts.lines).toEqual({ covered: 2, total: 2 });
    expect(files[0]?.counts.branches).toEqual({ covered: 0, total: 0 });
    expect(files[1]?.counts.branches).toEqual({ covered: 0, total: 1 });
  });

  it('非法条目抛出明确错误', () => {
    expect(() => parseVitestSummary(null, REPO_ROOT)).toThrow('必须是对象');
    expect(() =>
      parseVitestSummary({ [`${REPO_ROOT}/a.ts`]: 'oops' }, REPO_ROOT)
    ).toThrow('条目非法');
    expect(() =>
      parseVitestSummary(
        { [`${REPO_ROOT}/a.ts`]: { lines: { covered: -1, total: 2 } } },
        REPO_ROOT
      )
    ).toThrow('数值非法');
  });
});

describe('parseTarpaulinReport', () => {
  it('拼接路径数组、只填充行覆盖并排序', () => {
    const report: TarpaulinReport = {
      coverage: 75,
      covered: 3,
      coverable: 4,
      files: [
        {
          path: ['packages', 'core-rust', 'crates', 'chips-core', 'src', 'b.rs'],
          covered: 1,
          coverable: 2,
        },
        {
          path: ['packages', 'core-rust', 'crates', 'chips-core', 'src', 'a.rs'],
          covered: 2,
          coverable: 2,
        },
      ],
    };

    const files = parseTarpaulinReport(report, REPO_ROOT);

    expect(files.map((file) => file.path)).toEqual([
      'packages/core-rust/crates/chips-core/src/a.rs',
      'packages/core-rust/crates/chips-core/src/b.rs',
    ]);
    expect(files[0]?.counts.lines).toEqual({ covered: 2, total: 2 });
    expect(files[0]?.counts.functions).toEqual({ covered: 0, total: 0 });
  });

  it('缺少 files 或条目非法时抛出明确错误', () => {
    expect(() => parseTarpaulinReport({}, REPO_ROOT)).toThrow('缺少 files');
    expect(() =>
      parseTarpaulinReport({ files: [{ path: ['a'], covered: '1', coverable: 2 }] }, REPO_ROOT)
    ).toThrow('文件条目非法');
  });
});
