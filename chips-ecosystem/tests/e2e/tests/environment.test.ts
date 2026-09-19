import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildLaunchArgs,
  isHostAppBuilt,
  resolveEcosystemRoot,
  resolveElectronExecutable,
  resolveHarnessAppPath,
  resolveHostApp,
} from '../src';

describe('环境解析', () => {
  it('解析工作区根目录到 chips-ecosystem', () => {
    const root = resolveEcosystemRoot();
    expect(path.basename(root)).toBe('chips-ecosystem');
    expect(existsSync(path.join(root, 'pnpm-workspace.yaml'))).toBe(true);
  });

  it('夹具应用目录存在且声明 main 入口', () => {
    const harnessAppPath = resolveHarnessAppPath();
    expect(existsSync(path.join(harnessAppPath, 'package.json'))).toBe(true);
    const resolution = resolveHostApp({ hostAppPath: harnessAppPath });
    expect(resolution.appEntry).toBe(path.join(harnessAppPath, 'main.cjs'));
    expect(existsSync(resolution.appEntry)).toBe(true);
  });

  it('宿主目录缺失时抛出可定位错误', () => {
    const missing = path.join(resolveEcosystemRoot(), 'packages', 'not-existing-host');
    expect(() => resolveHostApp({ hostAppPath: missing })).toThrow(/宿主应用目录不存在/);
    expect(isHostAppBuilt({ hostAppPath: missing })).toBe(false);
  });

  it('解析 Electron 可执行文件到已存在的路径', () => {
    const executable = resolveElectronExecutable();
    expect(path.isAbsolute(executable)).toBe(true);
    expect(existsSync(executable)).toBe(true);
  });

  it('启动参数按入口、工作区、打开路径顺序构造', () => {
    expect(buildLaunchArgs('/app/main.js')).toEqual(['/app/main.js']);
    expect(
      buildLaunchArgs('/app/main.js', {
        workspacePath: '/tmp/workspace',
        openPaths: ['/tmp/workspace/卡.card', '/tmp/workspace/箱.box'],
      })
    ).toEqual([
      '/app/main.js',
      '--workspace=/tmp/workspace',
      '/tmp/workspace/卡.card',
      '/tmp/workspace/箱.box',
    ]);
  });
});
