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
 * host 面：`packages/host/src/preload/chips-error.ts` 仍持有待收口副本
 * （RFC §八 波 E：待 #56 装载器收口后执行）。本锚点按 RFC §八「E 可后置于
 * 本波，锚点先覆盖四包面再扩 host 主进程面」口径，将该文件登记为唯一待收口
 * 例外；波 E 落地删除该副本后，`HOST_PENDING_WAVE_E` 必须同步清空，断言即
 * 自然收敛为「全 packages 各包 src 源码面仅 bridge 一处」的全仓唯一断言。
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

/** 波 E 待收口例外（RFC §八 波 E）：host-preload 副本，随波 E 删除后清空本常量。 */
const HOST_PENDING_WAVE_E = 'packages/host/src/preload/chips-error.ts';

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
  it('唯一权威定义：全 packages/*/src 源码面 `export class ChipsError` 仅命中 bridge 定义处（host-preload 为波 E 待收口唯一登记例外）', () => {
    const packages = packagesWithSrc();
    expect(packages.length).toBeGreaterThan(0);

    const hits: string[] = [];
    for (const pkg of packages) {
      hits.push(...scanPackageSrc(pkg));
    }

    // 权威定义必须在册且恰为 bridge 协议层一处（RFC §3.2）。
    expect(hits).toContain(BRIDGE_DEFINITION);

    // 除 bridge 定义与波 E 待收口例外外，任何包（含 sdk、cli）不得出现第二份定义。
    const allowed = new Set([BRIDGE_DEFINITION, HOST_PENDING_WAVE_E]);
    const forks = hits.filter((file) => !allowed.has(file));
    expect(forks).toEqual([]);

    // 待收口例外若仍存在，必须恰为登记路径本身（漂移到 host 其他面同样报红）。
    const hostHits = hits.filter((file) => file.startsWith('packages/host/src/'));
    for (const file of hostHits) {
      expect(file).toBe(HOST_PENDING_WAVE_E);
    }

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
