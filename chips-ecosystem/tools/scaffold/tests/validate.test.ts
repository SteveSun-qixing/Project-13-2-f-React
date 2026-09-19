import { describe, expect, it } from 'vitest';
import { ScaffoldError, isScaffoldError } from '../src/errors.js';
import {
  deriveAssetSlug,
  deriveCapabilityId,
  derivePackageSlug,
  deriveTsconfigExtends,
  normalizeScaffoldOptions,
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

  it('tsconfig 继承路径按目标目录深度计算', () => {
    expect(deriveTsconfigExtends('plugins/app')).toBe('../../tsconfig.base.json');
    expect(deriveTsconfigExtends('examples/plugins/app')).toBe('../../../tsconfig.base.json');
    expect(deriveTsconfigExtends('/abs/path/app')).toBe('../../tsconfig.base.json');
  });
});
