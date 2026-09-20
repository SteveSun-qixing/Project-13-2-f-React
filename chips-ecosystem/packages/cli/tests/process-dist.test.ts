/**
 * 构建产物进程级回归锁（工单033 缺陷①，《07-CLI完整参考》§2.1）。
 *
 * 单测直跑 `src` 与构建产物 `dist` 的目录深度不同：`version.ts` 曾按 src 布局写
 * `../../package.json`，产物面上解析落空、`--version` 恒回退 `0.0.0`，包内单测无法
 * 暴露。本文件以 `dist` 产物为对象经真子进程断言版本事实源与包清单一致，
 * 锁死该分叉不得复发。
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 包清单版本（唯一事实源）。 */
function manifestVersion(): string {
  const pkg = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as unknown;
  expect(pkg).toBeTypeOf('object');
  const version = (pkg as { version?: unknown }).version;
  expect(typeof version).toBe('string');
  return version as string;
}

beforeAll(() => {
  execFileSync('pnpm', ['run', 'build'], { cwd: PACKAGE_ROOT, encoding: 'utf8' });
});

describe('chips dist 产物：--version 版本事实源（§2.1）', () => {
  it('dist/bin.js 进程输出与 package.json 版本一致，不回退 0.0.0', () => {
    const stdout = execFileSync(
      process.execPath,
      [path.join(PACKAGE_ROOT, 'dist', 'bin.js'), '--version'],
      { cwd: PACKAGE_ROOT, encoding: 'utf8' }
    );
    const parsed = JSON.parse(stdout) as { chips?: unknown; platform?: unknown };
    expect(parsed.chips).toBe(manifestVersion());
    expect('platform' in parsed).toBe(true);
  });

  it('dist/version.js 模块导出的 CLI_VERSION 与包清单一致（相对路径解析直锁）', () => {
    const moduleUrl = new URL(`file://${path.join(PACKAGE_ROOT, 'dist', 'version.js')}`).href;
    const stdout = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { CLI_VERSION } from ${JSON.stringify(moduleUrl)}; process.stdout.write(CLI_VERSION);`,
      ],
      { cwd: PACKAGE_ROOT, encoding: 'utf8' }
    );
    expect(stdout).toBe(manifestVersion());
  });
});
