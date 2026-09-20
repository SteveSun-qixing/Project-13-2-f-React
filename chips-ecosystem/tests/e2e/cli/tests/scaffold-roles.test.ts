/**
 * `chips plugin create` 四角色脚手架落盘面（§3.5.1；模板事实源 `@chips/sdk/scaffold`）。
 *
 * 每个角色独立临时目录、独立进程；断言=退出码 + 磁盘文件集合（不匹配文案）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  cleanupTempDir,
  expectFailure,
  makeTempDir,
  runChips,
  type ICliRun,
} from './support/harness';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = makeTempDir('create');
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    cleanupTempDir(dir);
  }
});

function createProject(role: string, pluginId: string, targetDir: string): ICliRun {
  return runChips(
    [
      'plugin',
      'create',
      '--role',
      role,
      '--id',
      pluginId,
      '--name',
      '脚手架验证',
      '--dir',
      targetDir,
    ],
    { cwd: process.cwd() }
  );
}

const COMMON_FILES: readonly string[] = [
  'manifest.yaml',
  'package.json',
  'tsconfig.json',
  'README.md',
  'vite.shared.ts',
  'vite.main.config.ts',
  'vitest.config.ts',
];

describe('plugin create：四角色文件矩阵', () => {
  it('basecard：公共件 + 渲染配置 + 双入口源码 + 图标与 schema', () => {
    const dir = path.join(tempDir(), 'card-proj');
    const run = createProject('basecard', 'chips.e2e.create.card', dir);
    expect(run.exitCode).toBe(0);
    for (const file of [
      ...COMMON_FILES,
      'vite.render.config.ts',
      'src/config.ts',
      'src/main.ts',
      'src/render.tsx',
      'src/index.ts',
      'tests/config.test.ts',
    ]) {
      expect(existsSync(path.join(dir, file)), file).toBe(true);
    }
    expect(existsSync(path.join(dir, 'assets/icons/card.svg'))).toBe(true);
    expect(existsSync(path.join(dir, 'assets/schemas/card-config.schema.json'))).toBe(true);
    expect(readFileSync(path.join(dir, 'manifest.yaml'), 'utf8')).toContain('type: basecard');
  });

  it('boxlayout：公共件 + 渲染配置 + jsdom 测试环境', () => {
    const dir = path.join(tempDir(), 'layout-proj');
    const run = createProject('boxlayout', 'chips.e2e.create.layout', dir);
    expect(run.exitCode).toBe(0);
    for (const file of [
      ...COMMON_FILES,
      'vite.render.config.ts',
      'src/render.tsx',
      'tests/render.test.ts',
    ]) {
      expect(existsSync(path.join(dir, file)), file).toBe(true);
    }
    expect(readFileSync(path.join(dir, 'vitest.config.ts'), 'utf8')).toContain('jsdom');
    expect(readFileSync(path.join(dir, 'manifest.yaml'), 'utf8')).toContain('type: boxlayout');
  });

  it('app：公共件 + AppView 与启动图标', () => {
    const dir = path.join(tempDir(), 'app-proj');
    const run = createProject('app', 'chips.e2e.create.app', dir);
    expect(run.exitCode).toBe(0);
    for (const file of [
      ...COMMON_FILES,
      'vite.render.config.ts',
      'src/index.ts',
      'src/ui/AppView.tsx',
    ]) {
      expect(existsSync(path.join(dir, file)), file).toBe(true);
    }
    expect(existsSync(path.join(dir, 'assets/icons/app.svg'))).toBe(true);
    expect(readFileSync(path.join(dir, 'manifest.yaml'), 'utf8')).toContain('type: app');
  });

  it('service：公共件、无渲染入口配置、含配置 schema', () => {
    const dir = path.join(tempDir(), 'service-proj');
    const run = createProject('service', 'chips.e2e.create.service', dir);
    expect(run.exitCode).toBe(0);
    for (const file of [...COMMON_FILES, 'src/index.ts', 'assets/schemas/config.schema.json']) {
      expect(existsSync(path.join(dir, file)), file).toBe(true);
    }
    expect(existsSync(path.join(dir, 'vite.render.config.ts'))).toBe(false);
    expect(readFileSync(path.join(dir, 'package.json'), 'utf8')).not.toContain(
      'vite.render.config.ts'
    );
    expect(readFileSync(path.join(dir, 'manifest.yaml'), 'utf8')).toContain('type: service');
  });

  it('package.json 冻结契约：version 与 manifest 一致、package 脚本走 chips pack、平台提供物只在 devDependencies', () => {
    const dir = path.join(tempDir(), 'pkg-proj');
    expect(createProject('basecard', 'chips.e2e.create.pkg', dir).exitCode).toBe(0);
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
      version?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const manifestText = readFileSync(path.join(dir, 'manifest.yaml'), 'utf8');
    const manifestVersion = /^version:\s*(.+)$/m.exec(manifestText)?.[1]?.trim();
    expect(pkg.version).toBe(manifestVersion);
    expect(pkg.scripts?.package).toContain('chips plugin pack');
    expect(pkg.dependencies).toBeUndefined();
    for (const provided of ['react', 'react-dom', '@chips/ui']) {
      expect(provided in (pkg.devDependencies ?? {})).toBe(true);
    }
  });
});

describe('plugin create：参数负例与占用拒绝', () => {
  it('theme / module 角色不存在 → CLI_ARGUMENT_INVALID / 2（§3.5.1）', () => {
    for (const role of ['theme', 'module']) {
      const run = createProject(role, 'chips.e2e.create.bad', path.join(tempDir(), `bad-${role}`));
      expectFailure(run, 'CLI_ARGUMENT_INVALID', 2);
    }
  });

  it('缺少 --role / --id / --name → CLI_ARGUMENT_INVALID / 2', () => {
    const base = ['plugin', 'create'];
    const cases: readonly (readonly string[])[] = [
      ['--id', 'chips.e2e.create.x', '--name', '验证'],
      ['--role', 'app', '--name', '验证'],
      ['--role', 'app', '--id', 'chips.e2e.create.x'],
    ];
    for (const args of cases) {
      const run = runChips([...base, ...args], { cwd: tempDir() });
      expectFailure(run, 'CLI_ARGUMENT_INVALID', 2);
    }
  });

  it('目标目录非空 → CLI_PATH_INVALID / 5 拒绝覆盖，既有文件不动（脚手架落盘占用判定）', () => {
    const dir = path.join(tempDir(), 'occupied');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'keep.txt'), 'placeholder');
    const run = createProject('service', 'chips.e2e.create.occupied', dir);
    expectFailure(run, 'CLI_PATH_INVALID', 5);
    expect(readFileSync(path.join(dir, 'keep.txt'), 'utf8')).toBe('placeholder');
    expect(existsSync(path.join(dir, 'manifest.yaml'))).toBe(false);
  });
});
