import { describe, expect, it } from 'vitest';

import {
  buildCommandPayload,
  createInitialParamValues,
  describeCommandParams,
  shouldCollectCommandParams,
} from './params';
import type { CommandParamValue } from './params';

describe('shouldCollectCommandParams（契约 §5.2）', () => {
  it('声明必填字段时需要采集', () => {
    expect(
      shouldCollectCommandParams({
        type: 'object',
        additionalProperties: false,
        required: ['source'],
        properties: { source: { type: 'string' } },
      })
    ).toBe(true);
  });

  it('只有可选字段、无 schema 或 required 不在 properties 中时不需要采集', () => {
    expect(
      shouldCollectCommandParams({
        type: 'object',
        additionalProperties: false,
        properties: { overwrite: { type: 'boolean' } },
      })
    ).toBe(false);
    expect(shouldCollectCommandParams(undefined)).toBe(false);
    expect(shouldCollectCommandParams({})).toBe(false);
    expect(
      shouldCollectCommandParams({
        type: 'object',
        required: ['missing'],
        properties: { source: { type: 'string' } },
      })
    ).toBe(false);
    expect(shouldCollectCommandParams({ required: ['a'], properties: '不是对象' })).toBe(false);
  });
});

describe('describeCommandParams', () => {
  it('描述字段标题、必填、类型与约束', () => {
    const fields = describeCommandParams({
      type: 'object',
      additionalProperties: false,
      required: ['source', 'count'],
      properties: {
        source: {
          type: 'string',
          title: '来源路径',
          description: '卡片文件路径',
          minLength: 1,
          maxLength: 260,
        },
        count: { type: 'integer', title: '数量', minimum: 1, maximum: 99, default: 3 },
        overwrite: { type: 'boolean', title: '覆盖' },
        format: { type: 'string', title: '格式', enum: ['png', 'ico', 2, true] },
        tags: { type: 'array', title: '标签', items: { type: 'string', enum: ['a', 'b'] } },
        payload: { type: 'object', title: '载荷' },
      },
    });

    expect(fields.map((field) => field.name)).toEqual([
      'source',
      'count',
      'overwrite',
      'format',
      'tags',
      'payload',
    ]);
    const source = fields[0];
    expect(source?.title).toBe('来源路径');
    expect(source?.description).toBe('卡片文件路径');
    expect(source?.required).toBe(true);
    expect(source?.kind).toBe('text');
    expect(source?.minLength).toBe(1);
    expect(source?.maxLength).toBe(260);

    const count = fields[1];
    expect(count?.kind).toBe('number');
    expect(count?.integer).toBe(true);
    expect(count?.minimum).toBe(1);
    expect(count?.maximum).toBe(99);
    expect(count?.defaultValue).toBe(3);

    expect(fields[2]?.kind).toBe('boolean');
    expect(fields[2]?.required).toBe(false);
    expect(fields[2]?.title).toBe('覆盖');

    const format = fields[3];
    expect(format?.kind).toBe('enum');
    expect(format?.options?.map((option) => option.key)).toEqual(['png', 'ico', '2', 'true']);

    expect(fields[4]?.kind).toBe('multi-enum');
    expect(fields[4]?.options?.map((option) => option.key)).toEqual(['a', 'b']);
    expect(fields[5]?.kind).toBe('json');
  });

  it('解析本地 $defs 引用', () => {
    const fields = describeCommandParams({
      type: 'object',
      additionalProperties: false,
      required: ['target'],
      properties: { target: { $ref: '#/$defs/target' } },
      $defs: { target: { type: 'string', title: '目标' } },
    });
    expect(fields).toHaveLength(1);
    expect(fields[0]?.title).toBe('目标');
    expect(fields[0]?.kind).toBe('text');
  });

  it('引用缺失与非法属性被跳过', () => {
    const fields = describeCommandParams({
      type: 'object',
      properties: { broken: { $ref: '#/$defs/missing' }, invalid: 42, '': { type: 'string' } },
    });
    expect(fields.map((field) => field.name)).toEqual(['broken']);
    expect(fields[0]?.title).toBe('broken');
  });

  it('无 properties 时返回空列表', () => {
    expect(describeCommandParams(undefined)).toEqual([]);
    expect(describeCommandParams({ type: 'object' })).toEqual([]);
  });
});

describe('createInitialParamValues', () => {
  it('按控件形态给出初值', () => {
    const fields = describeCommandParams({
      type: 'object',
      properties: {
        source: { type: 'string', default: 'a.card' },
        count: { type: 'number', default: 2 },
        flag: { type: 'boolean', default: true },
        format: { type: 'string', enum: ['png'] },
        tags: { type: 'array', items: { enum: ['x', 'y'] }, default: ['x'] },
      },
    });
    const values = createInitialParamValues(fields);
    expect(values.source).toBe('a.card');
    expect(values.count).toBe('2');
    expect(values.flag).toBe(true);
    expect(values.format).toBe('');
    expect(values.tags).toEqual(['x']);
  });

  it('布尔缺省为 false，多选缺省为空数组', () => {
    const fields = describeCommandParams({
      type: 'object',
      properties: { flag: { type: 'boolean' }, tags: { type: 'array', items: { enum: ['x'] } } },
    });
    const values = createInitialParamValues(fields);
    expect(values.flag).toBe(false);
    expect(values.tags).toEqual([]);
  });
});

describe('buildCommandPayload', () => {
  const fields = describeCommandParams({
    type: 'object',
    additionalProperties: false,
    required: ['source', 'count'],
    properties: {
      source: { type: 'string', title: '来源' },
      count: { type: 'integer', title: '数量', minimum: 1, maximum: 10 },
      ratio: { type: 'number', title: '比例' },
      overwrite: { type: 'boolean', title: '覆盖' },
      format: { type: 'string', title: '格式', enum: ['png', 'ico'] },
      tags: { type: 'array', title: '标签', items: { enum: ['a', 'b'] } },
      extra: { type: 'object', title: '扩展' },
    },
  });

  it('组装必填与可选参数并按类型转换', () => {
    const values: Record<string, CommandParamValue> = {
      source: 'a.card',
      count: '3',
      ratio: '1.5',
      overwrite: true,
      format: 'ico',
      tags: ['a', 'b'],
      extra: '{"k":1}',
    };
    const result = buildCommandPayload(fields, values);
    expect(result).toEqual({
      payload: {
        source: 'a.card',
        count: 3,
        ratio: 1.5,
        overwrite: true,
        format: 'ico',
        tags: ['a', 'b'],
        extra: { k: 1 },
      },
    });
  });

  it('可选参数留空不写入 payload，布尔始终写入', () => {
    const result = buildCommandPayload(fields, { source: 'a.card', count: '3', overwrite: false });
    expect(result).toEqual({ payload: { source: 'a.card', count: 3, overwrite: false } });
  });

  it('必填缺失与类型不符返回逐字段简体中文错误', () => {
    const result = buildCommandPayload(fields, { count: 'abc' });
    expect('errors' in result).toBe(true);
    if (!('errors' in result)) {
      return;
    }
    expect(result.errors.source).toBe('来源为必填项');
    expect(result.errors.count).toBe('数量必须是整数');
  });

  it('数值范围、文本长度与 JSON 合法性校验', () => {
    const numeric = buildCommandPayload(fields, { source: 'a', count: '20' });
    expect('errors' in numeric && numeric.errors.count).toBe('数量不得大于 10');
    const negative = buildCommandPayload(fields, { source: 'a', count: '0' });
    expect('errors' in negative && negative.errors.count).toBe('数量不得小于 1');
    const badJson = buildCommandPayload(fields, { source: 'a', count: '1', extra: '{' });
    expect('errors' in badJson && badJson.errors.extra).toBe('扩展不是合法的 JSON');

    const textFields = describeCommandParams({
      type: 'object',
      properties: { name: { type: 'string', title: '名称', minLength: 2, maxLength: 4 } },
    });
    const tooShort = buildCommandPayload(textFields, { name: 'x' });
    expect('errors' in tooShort && tooShort.errors.name).toBe('名称长度不得少于 2 个字符');
    const tooLong = buildCommandPayload(textFields, { name: 'abcdef' });
    expect('errors' in tooLong && tooLong.errors.name).toBe('名称长度不得超过 4 个字符');
  });

  it('枚举取值必须来自选项集合', () => {
    const bad = buildCommandPayload(fields, { source: 'a', count: '1', format: 'jpg' });
    expect('errors' in bad && bad.errors.format).toBe('格式的取值不在可选范围内');
    const badTags = buildCommandPayload(fields, { source: 'a', count: '1', tags: ['c'] });
    expect('errors' in badTags && badTags.errors.tags).toBe('标签的取值不在可选范围内');
  });

  it('浮点与 NaN 不被整数参数接受，数字参数拒绝非数字', () => {
    const decimals = buildCommandPayload(fields, { source: 'a', count: '1.5' });
    expect('errors' in decimals && decimals.errors.count).toBe('数量必须是整数');
    const notNumber = buildCommandPayload(fields, { source: 'a', count: '1', ratio: 'abc' });
    expect('errors' in notNumber && notNumber.errors.ratio).toBe('比例必须是数字');
  });
});
