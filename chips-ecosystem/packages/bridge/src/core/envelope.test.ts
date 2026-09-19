import { describe, expect, it } from 'vitest';
import { createSchemaCompiler, type ICompiledSchema } from '../schema/compile.js';
import { mergeEnvelope, splitEnvelope } from './envelope.js';
import { thrownErrorCode } from '../../tests/fixtures/expect-chips-error.js';

function compile(schema: Record<string, unknown>): ICompiledSchema {
  return createSchemaCompiler().compile(schema);
}

const BINARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['data'],
  properties: {
    name: { type: 'string' },
    data: { 'x-chips-binary': 8 },
    nested: {
      type: 'object',
      properties: { payload: { 'x-chips-binary': true } },
    },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: { content: { 'x-chips-binary': 16 }, label: { type: 'string' } },
      },
    },
  },
} as const;

describe('splitEnvelope', () => {
  it('无二进制字段时 json 原样、bin 为空', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      properties: { name: { type: 'string' } },
    });
    const envelope = splitEnvelope({ name: 'x' }, compiled);
    expect(envelope.json).toEqual({ name: 'x' });
    expect(envelope.bin).toEqual({});
  });

  it('按描述符拆分顶层、嵌套与数组元素中的二进制字段', () => {
    const compiled = compile(BINARY_SCHEMA);
    const envelope = splitEnvelope(
      {
        name: 'x',
        data: new Uint8Array([1, 2]),
        nested: { payload: new Uint8Array([3]) },
        files: [{ content: new Uint8Array([4]), label: 'a' }, { content: new Uint8Array([5]) }],
      },
      compiled
    );
    expect(envelope.json).toEqual({
      name: 'x',
      data: '/data',
      nested: { payload: '/nested/payload' },
      files: [{ content: '/files/0/content', label: 'a' }, { content: '/files/1/content' }],
    });
    expect(Object.keys(envelope.bin).sort()).toEqual([
      '/data',
      '/files/0/content',
      '/files/1/content',
      '/nested/payload',
    ]);
    expect(envelope.bin['/data']).toEqual(new Uint8Array([1, 2]));
  });

  it('接受 ArrayBuffer 作为字节来源', () => {
    const compiled = compile(BINARY_SCHEMA);
    const envelope = splitEnvelope({ data: new ArrayBuffer(4) }, compiled);
    expect(envelope.bin['/data']).toBeInstanceOf(Uint8Array);
    expect(envelope.bin['/data']?.byteLength).toBe(4);
  });

  it('二进制字段类型非法或超限时返回 BRIDGE_INVALID_INPUT', () => {
    const compiled = compile(BINARY_SCHEMA);
    expect(thrownErrorCode(() => splitEnvelope({ data: 'not-bytes' }, compiled))).toBe(
      'BRIDGE_INVALID_INPUT'
    );
    expect(thrownErrorCode(() => splitEnvelope({ data: new Uint8Array(9) }, compiled))).toBe(
      'BRIDGE_INVALID_INPUT'
    );
    expect(
      thrownErrorCode(() =>
        splitEnvelope({ data: new Uint8Array(1), nested: { payload: 1 } }, compiled)
      )
    ).toBe('BRIDGE_INVALID_INPUT');
  });

  it('不修改输入对象', () => {
    const compiled = compile(BINARY_SCHEMA);
    const bytes = new Uint8Array([1]);
    const input = { data: bytes };
    splitEnvelope(input, compiled);
    expect(input.data).toBe(bytes);
  });
});

describe('mergeEnvelope', () => {
  it('按键合并回 Uint8Array 且支持数组元素', () => {
    const compiled = compile(BINARY_SCHEMA);
    const merged = mergeEnvelope(
      {
        json: { data: '/data', files: [{ content: '/files/0/content' }] },
        bin: {
          '/data': new Uint8Array([1]),
          '/files/0/content': new Uint8Array([2]),
        },
      },
      compiled
    );
    expect(merged).toEqual({
      data: new Uint8Array([1]),
      files: [{ content: new Uint8Array([2]) }],
    });
  });

  it('缺键、键类型非法与未使用条目均返回 BRIDGE_INVALID_INPUT', () => {
    const compiled = compile(BINARY_SCHEMA);
    expect(
      thrownErrorCode(() => mergeEnvelope({ json: { data: '/missing' }, bin: {} }, compiled))
    ).toBe('BRIDGE_INVALID_INPUT');
    expect(thrownErrorCode(() => mergeEnvelope({ json: { data: 1 }, bin: {} }, compiled))).toBe(
      'BRIDGE_INVALID_INPUT'
    );
    expect(
      thrownErrorCode(() =>
        mergeEnvelope(
          {
            json: { data: '/data' },
            bin: { '/data': new Uint8Array(), '/extra': new Uint8Array() },
          },
          compiled
        )
      )
    ).toBe('BRIDGE_INVALID_INPUT');
  });

  it('拆分与合并可往返（含转义键名）', () => {
    const compiled = compile({
      type: 'object',
      additionalProperties: false,
      properties: { 'a/b~c': { 'x-chips-binary': true } },
    });
    const input = { 'a/b~c': new Uint8Array([7, 8]) };
    const envelope = splitEnvelope(input, compiled);
    expect(envelope.json).toEqual({ 'a/b~c': '/a~1b~0c' });
    expect(mergeEnvelope(envelope, compiled)).toEqual(input);
  });
});
