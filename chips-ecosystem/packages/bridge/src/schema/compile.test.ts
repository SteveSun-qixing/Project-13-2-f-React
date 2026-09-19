import { describe, expect, it } from 'vitest';
import { createSchemaCompiler } from './compile.js';

function expectInvalidSchema(action: () => unknown): void {
  try {
    action();
    expect.unreachable('应当抛出 BRIDGE_INVALID_SCHEMA');
  } catch (error) {
    expect(error).toMatchObject({ code: 'BRIDGE_INVALID_SCHEMA' });
  }
}

const objectSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['path'],
  properties: {
    path: { type: 'string', minLength: 1 },
    mode: { type: 'string', enum: ['read', 'write'] },
  },
} as const;

describe('createSchemaCompiler 基础编译', () => {
  it('编译合法 schema 并给出稳定摘要', () => {
    const compiler = createSchemaCompiler();
    const first = compiler.compile(objectSchema);
    const second = compiler.compile({ ...objectSchema });
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.digest).toBe(second.digest);
    expect(first).toBe(second);
    expect(compiler.size).toBe(1);
  });

  it('缓存按 LRU 淘汰且可配置上限', () => {
    const compiler = createSchemaCompiler({ maxCacheEntries: 1 });
    compiler.compile(objectSchema);
    compiler.compile({
      type: 'object',
      additionalProperties: false,
      properties: { other: { type: 'string' } },
    });
    expect(compiler.size).toBe(1);
    expect(() => createSchemaCompiler({ maxCacheEntries: 0 })).toThrowError(
      'maxCacheEntries 必须为正整数'
    );
  });

  it('顶层必须是 object 且显式 additionalProperties: false', () => {
    expectInvalidSchema(() => createSchemaCompiler().compile({ type: 'string' }));
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({ type: 'object', additionalProperties: true })
    );
    expectInvalidSchema(() => createSchemaCompiler().compile([]));
    expectInvalidSchema(() => createSchemaCompiler().compile('x'));
  });
});

describe('关键字白名单与禁令', () => {
  it('拒绝禁止关键字', () => {
    for (const keyword of [
      '$schema',
      'if',
      'patternProperties',
      'unevaluatedProperties',
      'contains',
      'prefixItems',
    ]) {
      expectInvalidSchema(() =>
        createSchemaCompiler().compile({
          type: 'object',
          additionalProperties: false,
          [keyword]: keyword === '$schema' ? 'https://json-schema.org/draft/2020-12/schema' : {},
        })
      );
    }
  });

  it('拒绝未登记关键字', () => {
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        customScript: 'return true',
      })
    );
  });

  it('接受注解关键字', () => {
    expect(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        title: '能力输入',
        description: '说明',
        deprecated: false,
        properties: { path: { type: 'string', default: 'a' } },
      })
    ).not.toThrow();
  });
});

describe('$defs 与 $ref', () => {
  it('内联解析 $defs 引用', () => {
    const compiler = createSchemaCompiler();
    const compiled = compiler.compile({
      type: 'object',
      additionalProperties: false,
      $defs: { name: { type: 'string', minLength: 1 } },
      properties: { title: { $ref: '#/$defs/name' } },
    });
    expect(compiled.validate({ title: 'x' }).valid).toBe(true);
    expect(compiled.validate({ title: '' }).valid).toBe(false);
  });

  it('拒绝远程 $ref、与其它关键字并列、目标缺失与递归引用', () => {
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { a: { $ref: 'https://example.com/schema.json' } },
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        $defs: { a: { type: 'string' } },
        properties: { a: { $ref: '#/$defs/a', minLength: 1 } },
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { a: { $ref: '#/$defs/missing' } },
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        $defs: { node: { type: 'object', properties: { child: { $ref: '#/$defs/node' } } } },
        properties: { root: { $ref: '#/$defs/node' } },
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { a: { $ref: '#/$defs/a/b' } },
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        $defs: 'bad',
        properties: {},
      })
    );
  });

  it('$defs 中的非法定义在编译期被拒绝', () => {
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        $defs: { bad: { type: 'unknown' } },
        properties: {},
      })
    );
  });
});

describe('type 与结构关键字', () => {
  it('type 校验：取值、空数组、重复与联合类型', () => {
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { a: { type: 'any' } },
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { a: { type: [] } },
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { a: { type: ['string', 'string'] } },
      })
    );
    expect(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { a: { type: ['string', 'null'] } },
      })
    ).not.toThrow();
  });

  it('required 必须为不重复字符串数组', () => {
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        required: 'path',
        properties: {},
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        required: ['a', 'a'],
        properties: {},
      })
    );
  });

  it('长度关键字必须为非负整数且 min ≤ max', () => {
    for (const keyword of [
      'minItems',
      'maxItems',
      'minProperties',
      'maxProperties',
      'minLength',
      'maxLength',
    ]) {
      expectInvalidSchema(() =>
        createSchemaCompiler().compile({
          type: 'object',
          additionalProperties: false,
          [keyword]: -1,
          properties: {},
        })
      );
      expectInvalidSchema(() =>
        createSchemaCompiler().compile({
          type: 'object',
          additionalProperties: false,
          [keyword]: 1.5,
          properties: {},
        })
      );
    }
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        minItems: 2,
        maxItems: 1,
        properties: {},
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        minProperties: 2,
        maxProperties: 1,
        properties: {},
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        minLength: 2,
        maxLength: 1,
        properties: {},
      })
    );
  });

  it('uniqueItems 必须为布尔值', () => {
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { list: { type: 'array', uniqueItems: 'yes' } },
      })
    );
  });

  it('数值关键字必须为有限数值，multipleOf 必须为正', () => {
    for (const keyword of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum']) {
      expectInvalidSchema(() =>
        createSchemaCompiler().compile({
          type: 'object',
          additionalProperties: false,
          properties: { value: { type: 'number', [keyword]: Number.NaN } },
        })
      );
    }
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { value: { type: 'number', multipleOf: 0 } },
      })
    );
  });

  it('pattern 必须为合法正则；format 必须在白名单', () => {
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { value: { type: 'string', pattern: '(' } },
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { value: { type: 'string', format: 'email' } },
      })
    );
    expect(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { value: { type: 'string', format: 'date-time' } },
      })
    ).not.toThrow();
  });

  it('enum 必须为非空数组；const 任意类型均可', () => {
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { value: { enum: [] } },
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { value: { enum: 'a' } },
      })
    );
    expect(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { value: { const: null } },
      })
    ).not.toThrow();
  });

  it('additionalProperties 支持 true 与子 schema，items / propertyNames 递归编译', () => {
    expect(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: {
          list: { type: 'array', items: { type: 'string' } },
          map: {
            type: 'object',
            propertyNames: { pattern: '^[a-z]+$' },
            additionalProperties: { type: 'number' },
          },
          loose: { type: 'object', additionalProperties: true },
        },
      })
    ).not.toThrow();
  });

  it('组合关键字必须为非空 schema 数组', () => {
    for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
      expectInvalidSchema(() =>
        createSchemaCompiler().compile({
          type: 'object',
          additionalProperties: false,
          [keyword]: [],
        })
      );
      expectInvalidSchema(() =>
        createSchemaCompiler().compile({
          type: 'object',
          additionalProperties: false,
          [keyword]: {},
        })
      );
      expect(() =>
        createSchemaCompiler().compile({
          type: 'object',
          additionalProperties: false,
          [keyword]: [{ type: 'object' }],
        })
      ).not.toThrow();
    }
  });
});

describe('x-chips-binary', () => {
  it('只允许声明在 properties 上且不得与 type 并列', () => {
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        'x-chips-binary': 1024,
        properties: {},
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { data: { type: 'string', 'x-chips-binary': 1024 } },
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { data: { 'x-chips-binary': -1 } },
      })
    );
    expectInvalidSchema(() =>
      createSchemaCompiler().compile({
        type: 'object',
        additionalProperties: false,
        properties: { list: { type: 'array', items: { 'x-chips-binary': 16 } } },
      })
    );
  });

  it('收集二进制字段描述符（含嵌套路径与转义）', () => {
    const compiler = createSchemaCompiler();
    const compiled = compiler.compile({
      type: 'object',
      additionalProperties: false,
      properties: {
        data: { 'x-chips-binary': 1024 },
        nested: {
          type: 'object',
          properties: { payload: { 'x-chips-binary': true } },
        },
        'a/b~c': { 'x-chips-binary': true },
      },
    });
    expect(compiled.binaryFields).toEqual([
      { pointer: '/data', maxBytes: 1024 },
      { pointer: '/nested/payload' },
      { pointer: '/a~1b~0c' },
    ]);
  });

  it('x-chips-binary 取值为布尔 true 时视为不限额', () => {
    const compiled = createSchemaCompiler().compile({
      type: 'object',
      additionalProperties: false,
      properties: { data: { 'x-chips-binary': true } },
    });
    expect(compiled.binaryFields).toEqual([{ pointer: '/data' }]);
  });
});
