import { describe, expect, it } from 'vitest';
import { isScaffoldError } from '../src/errors.js';
import {
  SCAFFOLD_TEMPLATE_ROLES,
  createScaffoldPlan,
  listScaffoldTemplates,
} from '../src/generator.js';
import { canonicalPlan } from './support/fixtures.js';

describe('listScaffoldTemplates', () => {
  it('返回四个角色的模板，顺序固定', () => {
    const templates = listScaffoldTemplates();
    expect(templates.map((template) => template.role)).toEqual([
      'basecard',
      'boxlayout',
      'app',
      'service',
    ]);
    expect(templates).toHaveLength(4);
  });

  it('每条模板都包含公共文件与角色文件', () => {
    for (const template of listScaffoldTemplates()) {
      expect(template.description.length).toBeGreaterThan(0);
      for (const common of ['manifest.yaml', 'package.json', 'tsconfig.json', 'README.md']) {
        expect(template.files).toContain(common);
      }
    }
  });

  it('模板文件清单与规范计划一致', () => {
    for (const template of listScaffoldTemplates()) {
      const plan = canonicalPlan(template.role);
      expect([...template.files].sort()).toEqual(plan.files.map((file) => file.path).sort());
      expect(plan.template.role).toBe(template.role);
      expect(plan.template.description).toBe(template.description);
    }
  });

  it('角色枚举常量与模板一致', () => {
    expect([...SCAFFOLD_TEMPLATE_ROLES]).toEqual(['basecard', 'boxlayout', 'app', 'service']);
  });
});

describe('createScaffoldPlan 的错误语义', () => {
  it('校验失败抛出 ScaffoldError 且不产生部分计划', () => {
    let thrown: unknown;
    try {
      createScaffoldPlan({
        role: 'theme' as never,
        pluginId: 'chips.example.theme',
        name: '旧主题',
        targetDir: 'plugins/theme',
      });
    } catch (error) {
      thrown = error;
    }
    expect(isScaffoldError(thrown)).toBe(true);
    expect((thrown as { code: string }).code).toBe('SDK_INVALID_SCAFFOLD_OPTIONS');
  });

  it('targetDir 归一化去掉尾斜杠', () => {
    const plan = createScaffoldPlan({
      role: 'service',
      pluginId: 'chips.service.example',
      name: '示例服务',
      targetDir: 'plugins/service-example///',
    });
    expect(plan.targetDir).toBe('plugins/service-example');
  });

  it('省略可选字段时不生成可选字段', () => {
    const plan = createScaffoldPlan({
      role: 'app',
      pluginId: 'chips.example.app',
      name: '示例应用',
      targetDir: 'plugins/app-example',
    });
    expect('description' in plan.manifest).toBe(false);
    expect('author' in plan.manifest).toBe(false);
    expect(plan.manifest.license).toBe('MIT');
  });
});
