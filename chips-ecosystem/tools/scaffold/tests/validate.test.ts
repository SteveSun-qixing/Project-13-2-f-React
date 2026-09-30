import { describe, expect, it } from 'vitest';
import { ScaffoldError, isScaffoldError } from '../src/errors.js';
import { validateManifest } from '../src/manifest-validate.js';
import {
  deriveAssetSlug,
  deriveCapabilityId,
  derivePackageSlug,
  deriveTsconfigExtends,
  normalizeScaffoldOptions,
  normalizeTargetDir,
} from '../src/validate.js';

function expectScaffoldError(run: () => unknown): ScaffoldError {
  try {
    run();
  } catch (error) {
    expect(isScaffoldError(error)).toBe(true);
    const scaffoldError = error as ScaffoldError;
    expect(scaffoldError.code).toBe('SDK_INVALID_SCAFFOLD_OPTIONS');
    return scaffoldError;
  }
  throw new Error('预期抛出 ScaffoldError，但调用未抛出');
}

describe('normalizeScaffoldOptions', () => {
  it('归一合法选项并补默认许可证', () => {
    const { options, derived } = normalizeScaffoldOptions({
      role: 'basecard',
      pluginId: 'chips.basecard.markdown',
      name: '  Markdown 卡片  ',
      targetDir: 'examples/plugins/markdown-card/',
    });
    expect(options).toEqual({
      role: 'basecard',
      pluginId: 'chips.basecard.markdown',
      name: 'Markdown 卡片',
      targetDir: 'examples/plugins/markdown-card',
      license: 'MIT',
    });
    expect(derived.assetSlug).toBe('markdown');
    expect(derived.packageSlug).toBe('markdown-card');
    expect(derived.packageName).toBe('@chips/plugin-markdown-card');
    expect(derived.capabilityId).toBe('base.markdown');
    expect(derived.tsconfigExtends).toBe('../../../tsconfig.base.json');
  });

  it('保留显式 description、author 与 license', () => {
    const { options } = normalizeScaffoldOptions({
      role: 'service',
      pluginId: 'chips.service.example',
      name: '示例服务',
      targetDir: 'plugins/service-example',
      description: '示例描述',
      author: '示例作者',
      license: 'Apache-2.0',
    });
    expect(options.description).toBe('示例描述');
    expect(options.author).toBe('示例作者');
    expect(options.license).toBe('Apache-2.0');
  });

  it('拒绝不存在的角色（theme / module 等旧角色）', () => {
    const error = expectScaffoldError(() =>
      normalizeScaffoldOptions({
        role: 'module',
        pluginId: 'chips.service.example',
        name: '示例服务',
        targetDir: 'plugins/service-example',
      })
    );
    expect(error.message).toContain('不支持的角色');
  });

  it('拒绝非法插件 ID', () => {
    for (const pluginId of [
      'Chips.Example.Foo',
      'chips_example',
      'chips..foo',
      '-chips.foo',
      'chips.foo-',
      'foo',
      'chips.foo/bar',
    ]) {
      expectScaffoldError(() =>
        normalizeScaffoldOptions({
          role: 'app',
          pluginId,
          name: '示例应用',
          targetDir: 'plugins/app-example',
        })
      );
    }
  });

  it('拒绝命名空间与角色不一致', () => {
    const error = expectScaffoldError(() =>
      normalizeScaffoldOptions({
        role: 'basecard',
        pluginId: 'chips.official.viewer',
        name: '查看器',
        targetDir: 'plugins/viewer',
      })
    );
    expect(error.message).toContain('命名空间与角色不一致');
  });

  it('拒绝作废的旧式 ID', () => {
    for (const pluginId of [
      'com.chips.foo',
      'chips-official.foo',
      'chips.module.foo',
      'chips.layout.grid.blp',
    ]) {
      expectScaffoldError(() =>
        normalizeScaffoldOptions({
          role: 'app',
          pluginId,
          name: '示例应用',
          targetDir: 'plugins/app-example',
        })
      );
    }
  });

  it('拒绝空名称与空目标目录', () => {
    expectScaffoldError(() =>
      normalizeScaffoldOptions({
        role: 'app',
        pluginId: 'chips.example.app',
        name: '   ',
        targetDir: 'plugins/app-example',
      })
    );
    expectScaffoldError(() =>
      normalizeScaffoldOptions({
        role: 'app',
        pluginId: 'chips.example.app',
        name: '示例应用',
        targetDir: '',
      })
    );
  });

  it('app 拒绝末段以数字开头的插件 ID（命令域文法约束）', () => {
    const error = expectScaffoldError(() =>
      normalizeScaffoldOptions({
        role: 'app',
        pluginId: 'chips.example.2048',
        name: '示例应用',
        targetDir: 'plugins/app-example',
      })
    );
    expect(error.message).toContain('命令域文法');
  });

  it('拒绝非对象选项', () => {
    expectScaffoldError(() => normalizeScaffoldOptions(null));
    expectScaffoldError(() => normalizeScaffoldOptions('app'));
  });
});

describe('命名派生', () => {
  it('资源命名基取插件 ID 末段', () => {
    expect(deriveAssetSlug('chips.basecard.markdown')).toBe('markdown');
    expect(deriveAssetSlug('chips.layout.grid')).toBe('grid');
    expect(deriveAssetSlug('com.example.my-plugin')).toBe('my-plugin');
  });

  it('包名片段取目标目录末段并可容纳中文目录名回退', () => {
    expect(derivePackageSlug('plugins/Hello_World', 'chips.example.hello')).toBe('hello-world');
    expect(derivePackageSlug('plugins/示例', 'chips.example.fallback-name')).toBe('fallback-name');
  });

  it('能力标识按角色派生', () => {
    expect(deriveCapabilityId('basecard', 'markdown')).toBe('base.markdown');
    expect(deriveCapabilityId('boxlayout', 'grid')).toBe('chips.layout.grid');
    expect(deriveCapabilityId('app', 'viewer')).toBe('viewer');
  });

  it('tsconfig 继承路径按目标目录相对深度计算（一至四级全臂）', () => {
    expect(deriveTsconfigExtends('plugins')).toBe('../tsconfig.base.json');
    expect(deriveTsconfigExtends('plugins/app')).toBe('../../tsconfig.base.json');
    expect(deriveTsconfigExtends('plugins/layout/grid')).toBe('../../../tsconfig.base.json');
    expect(deriveTsconfigExtends('examples/plugins/basecard/notes')).toBe(
      '../../../../tsconfig.base.json'
    );
  });

  it('tsconfig 继承路径拒绝绝对路径与上级目录段（工单058：不再回退固定两级猜测）', () => {
    for (const targetDir of [
      '/abs/path/app',
      'C:/workspaces/app',
      '\\\\server/share/app',
      'plugins/../app',
    ]) {
      expectScaffoldError(() => deriveTsconfigExtends(targetDir));
    }
  });

  it('目标目录归一去除冗余当前目录段与重复分隔符，并拒绝绝对路径与上级目录段', () => {
    expect(normalizeTargetDir('./plugins/app')).toBe('plugins/app');
    expect(normalizeTargetDir('plugins/./app')).toBe('plugins/app');
    expect(normalizeTargetDir('plugins//app///')).toBe('plugins/app');
    expect(normalizeTargetDir('plugins\\app')).toBe('plugins/app');
    for (const targetDir of ['/abs/path/app', 'C:/workspaces/app', 'plugins/../app', '.', './']) {
      expectScaffoldError(() => normalizeTargetDir(targetDir));
    }
  });

  it('归一先于派生：冗余当前目录段不参与继承深度计算', () => {
    const { options, derived } = normalizeScaffoldOptions({
      role: 'basecard',
      pluginId: 'chips.basecard.demo',
      name: '演示',
      targetDir: './plugins/demo',
    });
    expect(options.targetDir).toBe('plugins/demo');
    expect(derived.tsconfigExtends).toBe('../../tsconfig.base.json');
  });
});

/** `cli.commands` 生成物自检（矩阵 G3；权威校验在 `packages/host/src/loader/manifest.ts`）。 */
describe('cli.commands 清单自检', () => {
  function appManifest(): Record<string, unknown> {
    return {
      id: 'chips.example.app',
      version: '0.1.0',
      type: 'app',
      name: '示例应用',
      runtime: { targets: ['host'] },
      ui: { surface: 'window' },
      cli: {
        commands: [
          {
            commandPath: ['app', 'open-card'],
            commandId: 'app:open-card',
            title: '打开卡片',
            target: {
              type: 'app',
              pluginId: 'chips.example.app',
              surface: { open: true, focus: true, reuse: 'preferred' },
            },
            arguments: [{ name: 'path', position: 0, type: 'path', required: true }],
            output: { mode: 'json', json: 'supported' },
          },
        ],
      },
    };
  }

  it('合规的 cli.commands 声明通过自检', () => {
    expect(validateManifest(appManifest())).toEqual([]);
  });

  it('basecard 角色声明 cli 即拒绝', () => {
    const manifest = appManifest();
    manifest.type = 'basecard';
    manifest.capabilities = {
      cardTypes: [{ id: 'base.demo', name: '演示卡片', configSchema: 'assets/schemas/x.json' }],
    };
    delete manifest.ui;
    const errors = validateManifest(manifest);
    expect(errors).toContain('cli 只允许 app / service 角色声明');
  });

  it('cli.commands 为空数组即拒绝', () => {
    const manifest = appManifest();
    manifest.cli = { commands: [] };
    expect(validateManifest(manifest)).toContain('cli.commands 必须为非空数组');
  });

  it('app 目标缺失 commandId 即拒绝', () => {
    const manifest = appManifest();
    const command = (manifest.cli as { commands: Record<string, unknown>[] }).commands[0] as Record<
      string,
      unknown
    >;
    delete command.commandId;
    expect(validateManifest(manifest)).toContain('cli.commands[0] app 目标必须声明 commandId');
  });

  it('commandId 文法非法即拒绝', () => {
    const manifest = appManifest();
    const command = (manifest.cli as { commands: Record<string, unknown>[] }).commands[0] as Record<
      string,
      unknown
    >;
    command.commandId = 'app.open-card';
    expect(
      validateManifest(manifest).some((message) => message.includes('commandId 文法非法'))
    ).toBe(true);
  });

  it('commandPath 命中固定命令根即拒绝', () => {
    const manifest = appManifest();
    const command = (manifest.cli as { commands: Record<string, unknown>[] }).commands[0] as Record<
      string,
      unknown
    >;
    command.commandPath = ['help', 'open-card'];
    expect(validateManifest(manifest).some((message) => message.includes('命中固定命令根'))).toBe(
      true
    );
  });

  it('target.type 与角色不一致或 pluginId 不匹配即拒绝', () => {
    const manifest = appManifest();
    const command = (manifest.cli as { commands: Record<string, unknown>[] }).commands[0] as Record<
      string,
      unknown
    >;
    command.target = { type: 'service', pluginId: 'other.id', capability: 'app:noop' };
    const errors = validateManifest(manifest);
    expect(errors.some((message) => message.includes('target.type 必须等于插件角色'))).toBe(true);
    expect(errors.some((message) => message.includes('target.pluginId 必须等于插件 ID'))).toBe(
      true
    );
  });

  it('surface.reuse 取值非法即拒绝', () => {
    const manifest = appManifest();
    const command = (manifest.cli as { commands: Record<string, unknown>[] }).commands[0] as Record<
      string,
      unknown
    >;
    (command.target as Record<string, unknown>).surface = { reuse: 'sometimes' };
    expect(validateManifest(manifest).some((message) => message.includes('surface.reuse'))).toBe(
      true
    );
  });

  it('service 目标不得声明 commandId 或 surface', () => {
    const manifest: Record<string, unknown> = {
      id: 'chips.service.demo',
      version: '0.1.0',
      type: 'service',
      name: '示例服务',
      runtime: { targets: ['host'] },
      healthCheck: { interval: '30s', timeout: '5s' },
      cli: {
        commands: [
          {
            commandPath: ['demo', 'run'],
            commandId: 'demo:run',
            title: '运行任务',
            target: { type: 'service', pluginId: 'chips.service.demo', surface: { open: true } },
          },
        ],
      },
    };
    const errors = validateManifest(manifest);
    expect(errors).toContain('cli.commands[0].commandId 不适用于 service 目标');
  });
});
