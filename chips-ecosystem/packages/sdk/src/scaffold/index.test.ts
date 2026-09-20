/**
 * `@chips/sdk/scaffold` 导出面与边界归一测试（02-SDK-API规范 §2.1、§8.2~§8.4）。
 *
 * 分工：模板内容与校验规则的语义面由 `@chips/scaffold`（`tools/scaffold`）自身的
 * `tests/templates.test.ts` 与 `tests/validate.test.ts` 逐项断言；本文件只钉住 SDK 转发面：
 * 值导出形状（§8.3）、`listScaffoldTemplates` 的同一引用转发、`createScaffoldPlan` 的
 * 计划一致性、`ScaffoldError` → `ChipsError` 的边界归一（§8.4 参数校验矩阵五行），
 * 以及入口类型面可被 `import type` 消费（随 `typecheck` 承担）。
 */

import { describe, expect, it } from 'vitest';
import {
  createScaffoldPlan as upstreamCreateScaffoldPlan,
  isScaffoldError,
  listScaffoldTemplates as upstreamListScaffoldTemplates,
} from '@chips/scaffold';
import type { PluginRole } from '@chips/scaffold';
import * as scaffoldEntry from './index.js';
import type { IScaffoldOptions, IScaffoldPlan, IScaffoldTemplate } from './index.js';
import { ChipsError, isChipsError, SDK_INVALID_SCAFFOLD_OPTIONS } from '../errors.js';

/** §8.6 完整示例的 basecard 选项。 */
const BASECARD_OPTIONS: IScaffoldOptions = {
  role: 'basecard',
  pluginId: 'chips.basecard.markdown',
  name: 'Markdown 卡片',
  targetDir: 'plugins/markdown-card',
};

/** 取同步抛出的错误值；未抛出即断言失败。 */
function thrown(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('预期抛出错误，但调用未抛出');
}

describe('导出面形状（§2.1、§8.3）', () => {
  it('值导出恰好为文档列出的两项，且无默认导出', () => {
    expect(Object.keys(scaffoldEntry).sort()).toEqual([
      'createScaffoldPlan',
      'listScaffoldTemplates',
    ]);
    expect('default' in scaffoldEntry).toBe(false);
    expect(typeof scaffoldEntry.createScaffoldPlan).toBe('function');
    expect(typeof scaffoldEntry.listScaffoldTemplates).toBe('function');
  });

  it('listScaffoldTemplates 即上游实现本身，未经二次包装', () => {
    expect(scaffoldEntry.listScaffoldTemplates).toBe(upstreamListScaffoldTemplates);
  });

  it('createScaffoldPlan 不是上游引用（边界归一包装），但仍是合法函数', () => {
    expect(scaffoldEntry.createScaffoldPlan).not.toBe(upstreamCreateScaffoldPlan);
    expect(typeof scaffoldEntry.createScaffoldPlan).toBe('function');
  });
});

describe('转发一致性（§8.2、§8.6）', () => {
  it('listScaffoldTemplates 返回四条记录，角色顺序与模板清单非空', () => {
    const templates: readonly IScaffoldTemplate[] = scaffoldEntry.listScaffoldTemplates();
    expect(templates.map((template) => template.role)).toEqual<readonly PluginRole[]>([
      'basecard',
      'boxlayout',
      'app',
      'service',
    ]);
    for (const template of templates) {
      expect(template.description.length).toBeGreaterThan(0);
      expect(template.files).toContain('manifest.yaml');
      expect(template.files).toContain('package.json');
    }
  });

  it('createScaffoldPlan 的计划与上游生成器逐项一致（纯数据透传）', () => {
    const plan: IScaffoldPlan = scaffoldEntry.createScaffoldPlan(BASECARD_OPTIONS);
    expect(plan).toEqual(upstreamCreateScaffoldPlan(BASECARD_OPTIONS));
    expect(plan.targetDir).toBe('plugins/markdown-card');
    expect(plan.template.role).toBe('basecard');
    expect(plan.manifest.type).toBe('basecard');
    expect(plan.manifest.id).toBe('chips.basecard.markdown');
    expect(plan.files.map((file) => file.path).sort()).toEqual([...plan.template.files].sort());
  });

  it('license 省略时按计划落为 MIT（§8.4 第五行）', () => {
    const plan = scaffoldEntry.createScaffoldPlan(BASECARD_OPTIONS);
    expect(plan.manifest.license).toBe('MIT');
  });
});

describe('边界错误归一（§8.4 校验矩阵 + §6.3）', () => {
  /** 逐行取校验矩阵样本：角色未知、ID 非法、名称为空、目录为空。 */
  const invalidCases: readonly { readonly label: string; readonly options: unknown }[] = [
    {
      label: 'role 不是四角色之一',
      options: { ...BASECARD_OPTIONS, role: 'theme' },
    },
    {
      label: 'pluginId 不符合反向域名文法',
      options: { ...BASECARD_OPTIONS, pluginId: 'chips_official.markdown' },
    },
    {
      label: 'pluginId 命名空间与角色不一致',
      options: { ...BASECARD_OPTIONS, role: 'app', pluginId: 'chips.basecard.markdown' },
    },
    {
      label: 'pluginId 使用作废旧式前缀',
      options: { ...BASECARD_OPTIONS, role: 'app', pluginId: 'com.chips.editor' },
    },
    {
      label: 'name 为空显示名',
      options: { ...BASECARD_OPTIONS, name: '   ' },
    },
    {
      label: 'targetDir 为空',
      options: { ...BASECARD_OPTIONS, targetDir: '' },
    },
  ];

  it.each(invalidCases)('$label：抛 ChipsError（SDK_INVALID_SCAFFOLD_OPTIONS）', ({ options }) => {
    const caught = thrown(() => scaffoldEntry.createScaffoldPlan(options as IScaffoldOptions));
    expect(caught).toBeInstanceOf(ChipsError);
    expect(isScaffoldError(caught)).toBe(false);
    expect(isChipsError(caught)).toBe(true);
    const error = caught as ChipsError;
    expect(error.code).toBe(SDK_INVALID_SCAFFOLD_OPTIONS);
    expect(error.retryable).toBe(false);
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.details).toBeTypeOf('object');
  });

  it('转换保留上游错误的 message 与 details，不产生部分计划', () => {
    const options = { ...BASECARD_OPTIONS, role: 'module' };
    const upstreamCaught = thrown(() => upstreamCreateScaffoldPlan(options as IScaffoldOptions));
    expect(isScaffoldError(upstreamCaught)).toBe(true);
    const boundaryCaught = thrown(() =>
      scaffoldEntry.createScaffoldPlan(options as IScaffoldOptions)
    );
    expect(boundaryCaught).toBeInstanceOf(ChipsError);
    expect((boundaryCaught as ChipsError).message).toBe((upstreamCaught as Error).message);
    expect((boundaryCaught as ChipsError).details).toEqual(
      (upstreamCaught as { details?: unknown }).details
    );
  });

  it('非 ChipsError 语义的抛出值仍按 §5.2 归一为 ChipsError 家族', () => {
    const caught = thrown(() =>
      scaffoldEntry.createScaffoldPlan(null as unknown as IScaffoldOptions)
    );
    expect(caught).toBeInstanceOf(ChipsError);
    expect((caught as ChipsError).code).toBe(SDK_INVALID_SCAFFOLD_OPTIONS);
  });

  it('上游抛出非 ScaffoldError 的异常时归一为 SDK_UNKNOWN_ERROR，不泄漏原始错误类', () => {
    const hostile = {
      get role(): never {
        throw new Error('访问器异常');
      },
    } as unknown as IScaffoldOptions;
    const caught = thrown(() => scaffoldEntry.createScaffoldPlan(hostile));
    expect(caught).toBeInstanceOf(ChipsError);
    expect((caught as ChipsError).code).toBe('SDK_UNKNOWN_ERROR');
  });
});
