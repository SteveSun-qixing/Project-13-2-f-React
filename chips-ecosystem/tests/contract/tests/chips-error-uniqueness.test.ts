/**
 * ChipsError 唯一性契约锚点（工单024 实施波 F）。
 *
 * 《RFC-ChipsError统一裁定》§3.2 裁定：全生态唯一的 `ChipsError` 源码级类定义
 * 归属 `@chips/bridge` 协议层（`packages/bridge/src/protocol/errors.ts`）；
 * `@chips/sdk` 主入口与 `@chips/cli` 只做薄再导出（RFC §3.3 条 1/4），再导出
 * 不构成定义。本锚点以源码面静态扫描固化该裁定：任何新增第二份
 * `export class ChipsError` 的分叉（工单024 型漂移）都必须在契约测试面报红
 * （先例：工单013 三方漂移锚定）。
 *
 * host 面：`packages/host/src/preload/chips-error.ts` 的本地错误类副本已随实施波 E
 * 删除并改为 `@chips/bridge` 薄再导出（RFC §3.3 条 5、§5.4）。本锚点自此收敛为「全
 * packages 各包 src 源码面仅 bridge 一处」的全仓唯一断言，不再有任何待收口例外。
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { WORKSPACE_ROOT } from '../src/paths.js';

/** 唯一权威定义（RFC §3.2、§4.1）。 */
const BRIDGE_DEFINITION = 'packages/bridge/src/protocol/errors.ts';

/** 唯一权威定义的源码级标志（词边界匹配，`ChipsErrorFactory` 等派生名不误报）。 */
const DEFINITION_PATTERN = /\bexport class ChipsError\b/;

/** 递归收集 rootDir 下全部 `.ts` 源文件（返回相对 rootDir 的 posix 路径）。 */
function collectTsFiles(rootDir: string, prefix = ''): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(path.join(rootDir, entry.name), relative));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(relative);
    }
  }
  return files;
}

/**
 * 扫描 rootDir 下全部 `.ts` 源文件，返回命中 `export class ChipsError` 的
 * 文件相对路径集合（`grep -rl "export class ChipsError"` 源码面口径的等价实现）。
 */
export function scanChipsErrorDefinitionFiles(rootDir: string): string[] {
  const hits: string[] = [];
  for (const relative of collectTsFiles(rootDir)) {
    const text = readFileSync(path.join(rootDir, relative), 'utf8');
    if (DEFINITION_PATTERN.test(text)) {
      hits.push(relative);
    }
  }
  return hits.sort();
}

/** 读取 `packages/<pkg>/src` 源码面并扫描，返回以 `packages/` 为前缀的命中路径。 */
function scanPackageSrc(pkg: string): string[] {
  const srcDir = path.join(WORKSPACE_ROOT, 'packages', pkg, 'src');
  return scanChipsErrorDefinitionFiles(srcDir).map((relative) => `packages/${pkg}/src/${relative}`);
}

/** 全部包含 src 源码面目录的包（与 packages 目录事实一致）。 */
function packagesWithSrc(): string[] {
  const packagesDir = path.join(WORKSPACE_ROOT, 'packages');
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => statDirSync(path.join(packagesDir, entry.name, 'src')))
    .map((entry) => entry.name)
    .sort();
}

function statDirSync(dir: string): boolean {
  return existsSync(dir);
}

describe('ChipsError 唯一性锚点（工单024 波 F，RFC-ChipsError统一裁定）', () => {
  it('唯一权威定义：全 packages/*/src 源码面 `export class ChipsError` 仅命中 bridge 定义处（全仓唯一，无任何待收口例外）', () => {
    const packages = packagesWithSrc();
    expect(packages.length).toBeGreaterThan(0);

    const hits: string[] = [];
    for (const pkg of packages) {
      hits.push(...scanPackageSrc(pkg));
    }

    // 权威定义必须在册且恰为 bridge 协议层一处（RFC §3.2）。
    expect(hits).toContain(BRIDGE_DEFINITION);

    // 波 E 落地后 host-preload 副本已删除：全仓唯一断言生效，
    // 除 bridge 定义外任何包（含 sdk、cli、host）不得出现第二份源码级定义。
    const forks = hits.filter((file) => file !== BRIDGE_DEFINITION);
    expect(forks).toEqual([]);

    // host 源码面（含 preload 薄再导出面）：零定义命中（RFC §3.3 条 5、§5.4）。
    expect(hits.filter((file) => file.startsWith('packages/host/src/'))).toEqual([]);

    // sdk 与 cli 主消费面：零定义命中（薄再导出面，RFC §3.3 条 1/4）。
    expect(scanPackageSrc('sdk')).toEqual([]);
    expect(scanPackageSrc('cli')).toEqual([]);
  });

  it('负例注入：第二份 `export class ChipsError` 立即被扫描器检出（证明锚点非恒绿摆设）', () => {
    const fakeRoot = mkdtempSync(path.join(tmpdir(), 'chips-error-anchor-'));
    try {
      // 模拟分叉现场：bridge 定义处之外再造一份源码级定义。
      mkdirSync(path.join(fakeRoot, 'packages/bridge/src/protocol'), { recursive: true });
      mkdirSync(path.join(fakeRoot, 'packages/sdk/src'), { recursive: true });
      writeFileSync(
        path.join(fakeRoot, 'packages/bridge/src/protocol/errors.ts'),
        [
          '/** 权威定义（模拟）。 */',
          'export class ChipsError extends Error {',
          '  readonly code: string;',
          '}',
          '',
        ].join('\n')
      );
      writeFileSync(
        path.join(fakeRoot, 'packages/sdk/src/errors.ts'),
        [
          '/** 工单024 型分叉副本（模拟注入）。 */',
          'export class ChipsError extends Error {',
          '  readonly code: string;',
          '}',
          '',
        ].join('\n')
      );

      const hits = scanChipsErrorDefinitionFiles(fakeRoot);
      expect(hits).toEqual([
        'packages/bridge/src/protocol/errors.ts',
        'packages/sdk/src/errors.ts',
      ]);
      // 命中数大于 1 即违反唯一性：锚点对该分叉必然报红。
      expect(hits.length).toBeGreaterThan(1);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('负例对照：再导出面与派生命名不构成定义（无误报）', () => {
    const fakeRoot = mkdtempSync(path.join(tmpdir(), 'chips-error-anchor-'));
    try {
      mkdirSync(path.join(fakeRoot, 'src'), { recursive: true });
      writeFileSync(
        path.join(fakeRoot, 'src/reexport.ts'),
        [
          "import { ChipsError, isChipsError } from '@chips/bridge';",
          '',
          'export { ChipsError, isChipsError };',
          "export type { IChipsError, IChipsErrorInit } from '@chips/bridge';",
          '',
        ].join('\n')
      );
      writeFileSync(
        path.join(fakeRoot, 'src/derived.ts'),
        [
          '// 派生命名（ChipsErrorFactory）不得命中唯一性扫描。',
          'export class ChipsErrorFactory {',
          '  create(): unknown {',
          '    return undefined;',
          '  }',
          '}',
          '',
        ].join('\n')
      );

      expect(scanChipsErrorDefinitionFiles(fakeRoot)).toEqual([]);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('sdk 再导出面裁定：`@chips/sdk` errors 面为 bridge 薄再导出，无本地类定义（RFC §3.3 条 1、§4.1）', () => {
    const sdkErrors = readFileSync(path.join(WORKSPACE_ROOT, 'packages/sdk/src/errors.ts'), 'utf8');
    expect(sdkErrors).toContain("from '@chips/bridge'");
    expect(sdkErrors).toContain('export { ChipsError, isChipsError };');
    expect(DEFINITION_PATTERN.test(sdkErrors)).toBe(false);
  });

  it('cli 再导出面裁定：`@chips/cli` 错误面消费 bridge 唯一定义，无本地类定义（RFC §3.3 条 4）', () => {
    const cliErrors = readFileSync(path.join(WORKSPACE_ROOT, 'packages/cli/src/errors.ts'), 'utf8');
    expect(cliErrors).toContain("import { ChipsError, isChipsError } from '@chips/bridge';");
    expect(DEFINITION_PATTERN.test(cliErrors)).toBe(false);
  });
});
