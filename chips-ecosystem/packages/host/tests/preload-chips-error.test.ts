import { describe, expect, it } from 'vitest';

import { ChipsError, isChipsErrorShape, toChipsError } from '../src/preload/chips-error.js';

describe('ChipsError', () => {
  it('保留 code / message / details / retryable', () => {
    const error = new ChipsError({
      code: 'RESOURCE_NOT_FOUND',
      message: '资源不存在',
      details: { uri: 'chips-resource://x' },
      retryable: true,
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ChipsError');
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
    expect(error.message).toBe('资源不存在');
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ uri: 'chips-resource://x' });
    expect(error.toPlain()).toEqual({
      code: 'RESOURCE_NOT_FOUND',
      message: '资源不存在',
      retryable: true,
      details: { uri: 'chips-resource://x' },
    });
  });

  it('retryable 缺省为 false 且 toPlain 不携带空 details', () => {
    const error = new ChipsError({ code: 'BRIDGE_INTERNAL', message: '内部错误' });
    expect(error.retryable).toBe(false);
    expect(error.toPlain()).toEqual({ code: 'BRIDGE_INTERNAL', message: '内部错误', retryable: false });
  });
});

describe('isChipsErrorShape', () => {
  it('接受结构化错误并拒绝非法形状', () => {
    expect(isChipsErrorShape({ code: 'A', message: 'm' })).toBe(true);
    expect(isChipsErrorShape({ code: 'A', message: 'm', retryable: false })).toBe(true);
    expect(isChipsErrorShape({ code: '', message: 'm' })).toBe(false);
    expect(isChipsErrorShape({ code: 'A' })).toBe(false);
    expect(isChipsErrorShape(null)).toBe(false);
  });
});

describe('toChipsError', () => {
  it('原样返回 ChipsError', () => {
    const error = new ChipsError({ code: 'A', message: 'm' });
    expect(toChipsError(error)).toBe(error);
  });

  it('还原结构化错误对象', () => {
    const restored = toChipsError({ code: 'B', message: 'n', retryable: true });
    expect(restored).toBeInstanceOf(ChipsError);
    expect(restored.code).toBe('B');
    expect(restored.retryable).toBe(true);
  });

  it('识别带 code 的 Error 并保留消息', () => {
    const restored = toChipsError(Object.assign(new Error('文件读取失败'), { code: 'FILE_IO_FAILED' }));
    expect(restored.code).toBe('FILE_IO_FAILED');
    expect(restored.message).toBe('文件读取失败');
  });

  it('未识别异常归一为兜底码', () => {
    expect(toChipsError('boom').code).toBe('BRIDGE_INTERNAL');
    expect(toChipsError(new Error('')).message).toBe('宿主内部错误');
    expect(toChipsError(undefined, 'RESOURCE_INTERNAL', '资源读取失败').code).toBe('RESOURCE_INTERNAL');
  });
});
