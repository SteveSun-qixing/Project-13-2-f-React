import { describe, expect, it } from 'vitest';
import { createSchemaCompiler, type ICompiledSchema } from './compile.js';
import { MAX_REPORTED_ISSUES } from './validate.js';

function compile(schema: Record<string, unknown>): ICompiledSchema {
  return createSchemaCompiler().compile(schema);
}

describe('validateCompiled 标量与类型', () => {
  it('type 不匹配时报告类型错误', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['value'],
      properties: { value: { type: ['string', 'null'] } },
    });
    const result = compiled.validate({ value: 1 });
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({ pointer: '/value', keyword: 'type' });
    expect(result.issues[0]?.message).toContain('字符串 / 空值');
  });

  it('integer 不接受浮点，number 拒绝 NaN / Infinity', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['count', 'ratio'],
      properties: { count: { type: 'integer' }, ratio: { type: 'number' } },
    });
    expect(compiled.validate({ count: 1, ratio: 1.5 }).valid).toBe(true);
    expect(compiled.validate({ count: 1.5, ratio: 1 }).issues[0]).toMatchObject({
      pointer: '/count',
      keyword: 'type',
    });
    expect(compiled.validate({ count: 1, ratio: Number.NaN }).issues[0]).toMatchObject({
      pointer: '/ratio',
      keyword: 'type',
    });
    expect(compiled.validate({ count: 1, ratio: Number.POSITIVE_INFINITY }).issues[0]).toMatchObject({
      pointer: '/ratio',
      keyword: 'type',
    });
  });

  it('字符串约束：minLength / maxLength 按码点、pattern 与 format', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['text', 'code', 'when'],
      properties: {
        text: { type: 'string', minLength: 1, maxLength: 3 },
        code: { type: 'string', pattern: '^[a-z]+$' },
        when: { type: 'string', format: 'date-time' },
      },
    });
    expect(compiled.validate({ text: '中', code: 'ab', when: '2026-09-19T00:00:00Z' }).valid).toBe(true);
    expect(compiled.validate({ text: '', code: 'ab', when: 'x' }).issues.map((issue) => issue.keyword)).toContain(
      'minLength',
    );
    expect(
      compiled.validate({ text: '中文中文', code: 'AB', when: 'x' }).issues.map((issue) => issue.keyword),
    ).toEqual(expect.arrayContaining(['maxLength', 'pattern', 'format']));
  });

  it('数值约束：minimum / maximum / exclusive / multipleOf', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['value'],
      properties: {
        value: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          exclusiveMinimum: 0,
          exclusiveMaximum: 10,
          multipleOf: 2,
        },
      },
    });
    expect(compiled.validate({ value: 4 }).valid).toBe(true);
    expect(compiled.validate({ value: 0 }).issues.map((issue) => issue.keyword)).toEqual([
      'exclusiveMinimum',
    ]);
    expect(compiled.validate({ value: 10 }).issues.map((issue) => issue.keyword)).toEqual([
      'exclusiveMaximum',
    ]);
    expect(compiled.validate({ value: 3 }).issues.map((issue) => issue.keyword)).toEqual(['multipleOf']);
  });

  it('enum 与 const 使用深比较', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['mode', 'fixed'],
      properties: {
        mode: { enum: [{ key: 'a' }, 'b'] },
        fixed: { const: { nested: [1, 2] } },
      },
    });
    expect(compiled.validate({ mode: { key: 'a' }, fixed: { nested: [1, 2] } }).valid).toBe(true);
    expect(compiled.validate({ mode: { key: 'b' }, fixed: { nested: [1, 2] } }).issues.map((i) => i.keyword)).toEqual([
      'enum',
    ]);
    expect(compiled.validate({ mode: 'b', fixed: { nested: [2, 1] } }).issues.map((i) => i.keyword)).toEqual([
      'const',
    ]);
  });
});

describe('validateCompiled 对象与数组', () => {
  it('required、additionalProperties: false 与子 schema 递归', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: {
        path: { type: 'string', minLength: 1 },
        nested: {
          type: 'object',
          additionalProperties: false,
          properties: { depth: { type: 'integer' } },
        },
      },
    });
    const result = compiled.validate({ extra: true, nested: { depth: 'x' } });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => `${issue.pointer}:${issue.keyword}`)).toEqual(
      expect.arrayContaining([
        '/path:required',
        '/extra:additionalProperties',
        '/nested/depth:type',
      ]),
    );
  });

  it('minProperties / maxProperties / propertyNames', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['map'],
      properties: {
        map: {
          propertyNames: { pattern: '^[a-z]+$' },
          minProperties: 1,
          maxProperties: 2,
          additionalProperties: { type: 'number' },
        },
      },
    });
    expect(compiled.validate({ map: { a: 1 } }).valid).toBe(true);
    expect(compiled.validate({ map: {} }).issues.map((issue) => issue.keyword)).toEqual(['minProperties']);
    expect(compiled.validate({ map: { a: 1, b: 2, c: 3 } }).issues.map((issue) => issue.keyword)).toEqual([
      'maxProperties',
    ]);
    expect(compiled.validate({ map: { BAD: 1 } }).issues.map((issue) => issue.keyword)).toEqual([
      'propertyNames',
    ]);
  });

  it('数组：minItems / maxItems / uniqueItems / items', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['list'],
      properties: {
        list: {
          type: 'array',
          minItems: 1,
          maxItems: 2,
          uniqueItems: true,
          items: { type: 'integer' },
        },
      },
    });
    expect(compiled.validate({ list: [1, 2] }).valid).toBe(true);
    expect(compiled.validate({ list: [] }).issues.map((issue) => issue.keyword)).toEqual(['minItems']);
    expect(compiled.validate({ list: [1, 2, 3] }).issues.map((issue) => issue.keyword)).toEqual(['maxItems']);
    expect(compiled.validate({ list: [1, 1] }).issues.map((issue) => issue.keyword)).toEqual(['uniqueItems']);
    expect(compiled.validate({ list: [1, 'x'] }).issues.map((issue) => issue.keyword)).toEqual(['type']);
  });

  it('Uint8Array 不被当作普通对象校验', () => {
    const compiled = compile({ type: 'object', additionalProperties: false, properties: {} });
    expect(compiled.validate(new Uint8Array([1])).valid).toBe(false);
  });
});

describe('validateCompiled 组合关键字与二进制', () => {
  it('allOf 合并全部问题，anyOf / oneOf 恰好匹配', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['value'],
      properties: {
        value: {
          allOf: [{ type: 'string' }, { minLength: 2 }],
          anyOf: [{ type: 'string' }, { type: 'integer' }],
          oneOf: [{ const: 'ab' }, { const: 'cd' }],
        },
      },
    });
    expect(compiled.validate({ value: 'ab' }).valid).toBe(true);
    expect(compiled.validate({ value: 'a' }).issues.map((issue) => issue.keyword)).toEqual([
      'minLength',
      'oneOf',
    ]);
    expect(compiled.validate({ value: true }).issues.map((issue) => issue.keyword)).toEqual([
      'type',
      'anyOf',
      'oneOf',
    ]);
    expect(compiled.validate({ value: 'abc' }).issues.map((issue) => issue.keyword)).toEqual(['oneOf']);
  });

  it('anyOf 分支失败不污染父级问题列表', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      properties: { value: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
    });
    expect(compiled.validate({ value: 'x' }).issues).toEqual([]);
  });

  it('二进制字段：键缺失、类型错误、超限与未使用条目', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['data'],
      properties: { data: { 'x-chips-binary': 4 } },
    });
    expect(compiled.validate({ data: 'a' }, { bin: new Map([['a', new Uint8Array(4)]]) }).valid).toBe(true);
    expect(
      compiled.validate({ data: 'a' }, { bin: new Map([['a', new Uint8Array(5)]]) }).issues.map(
        (issue) => issue.keyword,
      ),
    ).toEqual(['x-chips-binary']);
    expect(
      compiled.validate({ data: 'missing' }, { bin: new Map() }).issues.map(
        (issue) => issue.keyword,
      ),
    ).toEqual(['x-chips-binary']);
    expect(compiled.validate({ data: 1 }, { bin: new Map() }).issues.map((issue) => issue.keyword)).toEqual([
      'x-chips-binary',
    ]);
    expect(
      compiled.validate({ data: 'a' }, { bin: new Map([['a', new Uint8Array(1)], ['b', new Uint8Array(1)]]) }).issues,
    ).toEqual([{ pointer: '', keyword: 'x-chips-binary', message: '包含未使用的二进制条目' }]);
  });

  it('不提供 bin 时只校验键为字符串', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['data'],
      properties: { data: { 'x-chips-binary': true } },
    });
    expect(compiled.validate({ data: 'a' }).valid).toBe(true);
    expect(compiled.validate({ data: 1 }).valid).toBe(false);
  });
});

describe('validateCompiled 问题聚合', () => {
  it('按 JSON Pointer 字典序排序并截断到 16 条', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      required: ['b', 'a'],
      properties: {},
    });
    const extra: Record<string, number> = {};
    for (let index = 0; index < 30; index += 1) {
      extra[`k${String(index).padStart(2, '0')}`] = index;
    }
    const result = compiled.validate(extra);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(MAX_REPORTED_ISSUES);
    expect(result.truncated).toBe(true);
    const pointers = result.issues.map((issue) => issue.pointer);
    expect([...pointers].sort()).toEqual(pointers);
    expect(pointers[0]).toBe('/a');
  });

  it('校验不修改输入，也不填充默认值', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      properties: { mode: { type: 'string', default: 'read' } },
    });
    const input: Record<string, unknown> = {};
    expect(compiled.validate(input).valid).toBe(true);
    expect(input).toEqual({});
  });
});
