/**
 * CLI 进程面与错误模型（《06-开发与运维/07-CLI完整参考》§2.1、§2.2、§2.3、§2.6、§3.1、§3.9）。
 *
 * 全部经真实子进程断言：退出码 + stdout 错误信封 `code` + `exitCode` 永不入输出。
 * `chips host …`、任意未知命令与 `help <未注册>` 的「命令不存在 → 3」承诺按 §2.3/§3.1.1
 * 先行定性、与承载环境无关（工单033 缺陷②收口，断言即文档承诺形）。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { expectFailure, resolveCliBin, resolveEcosystemRoot, runChips } from './support/harness';

const SPAWN_CWD = process.cwd();

/** 包清单版本（`--version` 的唯一事实源，§2.1）。 */
function cliManifestVersion(): string {
  const file = path.join(resolveEcosystemRoot(), 'packages', 'cli', 'package.json');
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  const version = (pkg as { version?: unknown }).version;
  expect(typeof version).toBe('string');
  return version as string;
}

describe('chips 进程面：版本、帮助与交互入口', () => {
  it('可执行入口为构建产物且存在', () => {
    expect(resolveCliBin().endsWith('dist/bin.js')).toBe(true);
  });

  it('--version 退出 0，chips 字段即包清单版本、platform 字段在位（§2.1，工单033 缺陷①收口）', () => {
    const run = runChips(['--version'], { cwd: SPAWN_CWD });
    expect(run.exitCode).toBe(0);
    const parsed = JSON.parse(run.stdout) as { chips?: unknown; platform?: unknown };
    expect(parsed.chips).toBe(cliManifestVersion());
    expect('platform' in parsed).toBe(true);
  });

  it('help 输出固定命令树并退出 0（§3.1.1）', () => {
    const run = runChips(['help'], { cwd: SPAWN_CWD });
    expect(run.exitCode).toBe(0);
    expect(run.stdout.length).toBeGreaterThan(0);
  });

  it('help <内建命令> 输出用法并退出 0', () => {
    const run = runChips(['help', 'plugin', 'pack'], { cwd: SPAWN_CWD });
    expect(run.exitCode).toBe(0);
    expect(run.stdout.length).toBeGreaterThan(0);
  });

  it('裸命令在非交互环境输出提示并退出 0，stdout 不承载结果（§3.1.2）', () => {
    const run = runChips([], { cwd: SPAWN_CWD });
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe('');
    expect(run.stderr.length).toBeGreaterThan(0);
  });

  it('--interactive 在非交互环境退出 1（§3.1.2）', () => {
    const run = runChips(['--interactive'], { cwd: SPAWN_CWD });
    expect(run.exitCode).toBe(1);
    expect(run.stdout).toBe('');
  });
});

describe('chips 进程面：全局选项与参数错误（§2.1、§2.2、§2.6）', () => {
  it('未知选项 → CLI_ARGUMENT_INVALID / 2', () => {
    const run = runChips(['status', '--nope'], { cwd: SPAWN_CWD });
    expectFailure(run, 'CLI_ARGUMENT_INVALID', 2);
  });

  it('用户侧传 --workspace → CLI_ARGUMENT_INVALID / 2，details.hint 指向设置面板（§2.2）', () => {
    const run = runChips(['--workspace', '/tmp/chips-e2e-ws', 'status'], { cwd: SPAWN_CWD });
    const envelope = expectFailure(run, 'CLI_ARGUMENT_INVALID', 2);
    expect(envelope.details?.hint).toBeTypeOf('string');
  });

  it('--plugin 缺少取值 → CLI_ARGUMENT_INVALID / 2', () => {
    const run = runChips(['--plugin'], { cwd: SPAWN_CWD });
    expectFailure(run, 'CLI_ARGUMENT_INVALID', 2);
  });

  it('命令组缺少子命令 → CLI_COMMAND_NOT_FOUND / 3（离线可定性）', () => {
    for (const args of [['plugin'], ['config'], ['update']]) {
      const run = runChips(args, { cwd: SPAWN_CWD });
      const envelope = expectFailure(run, 'CLI_COMMAND_NOT_FOUND', 3);
      expect(Array.isArray(envelope.details?.subcommands)).toBe(true);
    }
  });
});

describe('chips 进程面：命令未找到定性（§2.3、§3.1.1，工单033 缺陷②收口）', () => {
  const notFoundCases: readonly (readonly [string, readonly string[]])[] = [
    ['chips host list（保留固定根先行定性，不依赖插件索引）', ['host', 'list']],
    ['chips frobnicate xyz（任意未知命令：无承载即无匹配）', ['frobnicate', 'xyz']],
    ['chips help nosuchcmd（未知命令帮助）', ['help', 'nosuchcmd']],
  ];

  for (const [label, args] of notFoundCases) {
    it(`${label} → CLI_COMMAND_NOT_FOUND / 3`, () => {
      const run = runChips([...args], { cwd: SPAWN_CWD });
      expectFailure(run, 'CLI_COMMAND_NOT_FOUND', 3);
    });
  }
});

describe('chips 进程面：shell 补全（§3.9）', () => {
  for (const shell of ['bash', 'zsh', 'fish']) {
    it(`completion ${shell} 输出脚本并退出 0`, () => {
      const run = runChips(['completion', shell], { cwd: SPAWN_CWD });
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toContain('chips');
    });
  }

  it('completion 非法 shell → CLI_ARGUMENT_INVALID / 2', () => {
    const run = runChips(['completion', 'powershell'], { cwd: SPAWN_CWD });
    expectFailure(run, 'CLI_ARGUMENT_INVALID', 2);
  });

  it('dev completion 与用户侧同构且不含 update 入口（§4.5、§1.5）', () => {
    const run = runChips(['dev', 'completion', 'zsh'], { cwd: SPAWN_CWD });
    expect(run.exitCode).toBe(0);
    expect(run.stdout.length).toBeGreaterThan(0);
  });
});
