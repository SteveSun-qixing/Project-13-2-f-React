/**
 * 无承载环境的进程面边界（《07-CLI完整参考》§2.5：`CLI_TARGET_UNAVAILABLE / 6`）。
 *
 * 本地客户端在无平台承载适配器时：产物引擎离线可用（金链路面），全部平台操作与
 * `cli.command.*` 路由以 6 定性失败、`dev run` 先做本地角色/清单判定再触达承载边界。
 * 本文件断言的是「离线可定性」的边界行为本身；真实装载/运行闭环归集成波。
 */

import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { cleanupTempDir, expectFailure, makeTempDir, runChips } from './support/harness';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = makeTempDir('nocarrier');
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    cleanupTempDir(dir);
  }
});

describe('平台操作面：全部 CLI_TARGET_UNAVAILABLE / 6', () => {
  const cases: readonly (readonly string[])[] = [
    ['start'],
    ['stop'],
    ['status'],
    ['config', 'list'],
    ['logs'],
    ['doctor'],
    ['update', 'check'],
    ['plugin', 'list'],
    ['plugin', 'info', 'chips.e2e.nocarrier.x'],
    ['plugin', 'enable', 'chips.e2e.nocarrier.x'],
    ['plugin', 'disable', 'chips.e2e.nocarrier.x'],
    ['plugin', 'uninstall', 'chips.e2e.nocarrier.x'],
  ];

  for (const args of cases) {
    it(`chips ${args.join(' ')} → 6`, () => {
      const run = runChips(args, { cwd: process.cwd() });
      const envelope = expectFailure(run, 'CLI_TARGET_UNAVAILABLE', 6);
      expect(typeof envelope.details?.hint).toBe('string');
    });
  }

  it('chips open <已存在路径> → 6（open 直达承载适配器，无本地分支）', () => {
    const dir = tempDir();
    const envelope = expectFailure(
      runChips(['open', dir], { cwd: dir }),
      'CLI_TARGET_UNAVAILABLE',
      6
    );
    expect(envelope.details?.method).toBe('platform.open');
  });
});

describe('开发宿主面：先本地判定、后承载边界', () => {
  it('dev service invoke 缺少承载 → CLI_TARGET_UNAVAILABLE / 6', () => {
    expectFailure(
      runChips(['dev', 'service', 'invoke', '--capability', 'e2e:probe'], {
        cwd: process.cwd(),
      }),
      'CLI_TARGET_UNAVAILABLE',
      6
    );
  });

  it('dev run 目录缺少 manifest.yaml → CLI_PATH_NOT_FOUND / 5（本地判定先行）', () => {
    const dir = tempDir();
    expectFailure(runChips(['dev', 'run', '--dir', dir], { cwd: dir }), 'CLI_PATH_NOT_FOUND', 5);
  });

  it('dev run 非 app 角色工程 → CLI_ARGUMENT_INVALID / 2 + details.role', () => {
    const dir = tempDir();
    const cardDir = path.join(dir, 'card');
    const create = runChips(
      [
        'plugin',
        'create',
        '--role',
        'basecard',
        '--id',
        'chips.e2e.nocarrier.card',
        '--name',
        '卡',
        '--dir',
        cardDir,
      ],
      { cwd: dir }
    );
    expect(create.exitCode).toBe(0);
    const envelope = expectFailure(
      runChips(['dev', 'run', '--dir', cardDir], { cwd: dir }),
      'CLI_ARGUMENT_INVALID',
      2
    );
    expect(envelope.details?.role).toBe('basecard');
  });

  it('dev run app 角色工程触达承载边界 → CLI_TARGET_UNAVAILABLE / 6', () => {
    const dir = tempDir();
    const appDir = path.join(dir, 'app');
    const create = runChips(
      [
        'plugin',
        'create',
        '--role',
        'app',
        '--id',
        'chips.e2e.nocarrier.app',
        '--name',
        '应',
        '--dir',
        appDir,
      ],
      { cwd: dir }
    );
    expect(create.exitCode).toBe(0);
    expectFailure(
      runChips(['dev', 'run', '--dir', appDir], { cwd: dir }),
      'CLI_TARGET_UNAVAILABLE',
      6
    );
  });
});
