import { describe, expect, it } from 'vitest';
import {
  bridgeUnavailableError,
  ChipsError,
  isChipsError,
  SDK_BRIDGE_UNAVAILABLE,
  SDK_UNKNOWN_ERROR,
  toChipsError,
} from './errors.js';

/** 简体中文文案判据：至少含一个汉字（02-SDK-API规范 §6.2 规则、§11 约束 6）。 */
const CHINESE_TEXT = /[\u4e00-\u9fff]/;

describe('ChipsError 构造', () => {
  it('字段与初始化结构一致，缺省 retryable 为 false 且 name 固定', () => {
    const error = new ChipsError({ code: 'DOCUMENT_NOT_OPEN', message: '文档会话不存在或已关闭' });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ChipsError);
    expect(error.name).toBe('ChipsError');
    expect(error.code).toBe('DOCUMENT_NOT_OPEN');
    expect(error.message).toBe('文档会话不存在或已关闭');
    expect(error.retryable).toBe(false);
    expect(error.details).toBeUndefined();
  });

  it('details 与 retryable 按初始化值保留', () => {
    const error = new ChipsError({
      code: 'BRIDGE_TIMEOUT',
      message: '操作超时',
      details: { documentId: 'a1B2c3D4e5' },
      retryable: true,
    });
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ documentId: 'a1B2c3D4e5' });
  });

  it('显式传入 undefined 的 details 时字段值为 undefined 且不抛异常', () => {
    const error = new ChipsError({ code: 'A_B', message: '文案', details: undefined });
    expect('details' in error).toBe(true);
    expect(error.details).toBeUndefined();
  });

  it('实例在结构上等同普通错误对象，可被逐字段读取', () => {
    const error = new ChipsError({ code: 'A_B', message: '文案', retryable: true });
    const { code, message, retryable } = error;
    expect({ code, message, retryable }).toEqual({ code: 'A_B', message: '文案', retryable: true });
  });

  it('SDK 自有错误码为约定字面量', () => {
    expect(SDK_BRIDGE_UNAVAILABLE).toBe('SDK_BRIDGE_UNAVAILABLE');
    expect(SDK_UNKNOWN_ERROR).toBe('SDK_UNKNOWN_ERROR');
  });
});

describe('isChipsError', () => {
  it('类实例与同构普通对象都通过', () => {
    expect(isChipsError(new ChipsError({ code: 'A_B', message: '文案' }))).toBe(true);
    expect(isChipsError({ code: 'A_B', message: '文案' })).toBe(true);
    expect(isChipsError({ code: 'A_B', message: '文案', retryable: true, details: null })).toBe(
      true
    );
  });

  it('不读取原型链：继承自 ChipsError 但字段缺失的对象不通过', () => {
    const detached = Object.create(ChipsError.prototype) as unknown as Record<string, unknown>;
    expect(isChipsError(detached)).toBe(false);
  });

  it('字段类型不符或缺失时拒绝', () => {
    expect(isChipsError({ code: 'A_B', message: 1 })).toBe(false);
    expect(isChipsError({ code: 2, message: '文案' })).toBe(false);
    expect(isChipsError({ message: '文案' })).toBe(false);
    expect(isChipsError({ code: 'A_B' })).toBe(false);
    expect(isChipsError({})).toBe(false);
  });

  it('非对象值一律拒绝', () => {
    for (const value of [null, undefined, 'A_B', 42, NaN, true, Symbol('S'), () => undefined]) {
      expect(isChipsError(value)).toBe(false);
    }
    expect(isChipsError(new Error('普通异常'))).toBe(false);
  });
});

describe('toChipsError 归一', () => {
  it('ChipsError 实例原样返回，不复制也不改写', () => {
    const original = new ChipsError({
      code: 'BRIDGE_PERMISSION_DENIED',
      message: '缺少所需权限',
      details: { permission: 'filesystem:read' },
    });
    const normalized = toChipsError(original);
    expect(normalized).toBe(original);
    expect(normalized.code).toBe('BRIDGE_PERMISSION_DENIED');
  });

  it('同构普通对象构造同字段实例，details 原样保留引用与 retryable', () => {
    const plain = {
      code: 'RESOURCE_HANDLE_INVALIDATED',
      message: '资源句柄已失效',
      details: { uri: 'chips-resource://workspace/a.card', reason: 'session-closed' },
      retryable: true,
    };
    const normalized = toChipsError(plain);
    expect(normalized).toBeInstanceOf(ChipsError);
    expect(normalized).not.toBe(plain);
    expect(normalized.code).toBe('RESOURCE_HANDLE_INVALIDATED');
    expect(normalized.message).toBe('资源句柄已失效');
    expect(normalized.retryable).toBe(true);
    expect(normalized.details).toEqual(plain.details);
    expect(normalized.details).toBe(plain.details);
  });

  it('同构普通对象缺省 retryable 归一为 false，且缺字段时不写入 details', () => {
    const minimal = toChipsError({ code: 'A_B', message: '文案' });
    expect(minimal.retryable).toBe(false);
    expect(minimal.details).toBeUndefined();
    const nullish = toChipsError({ code: 'A_B', message: '文案', retryable: undefined });
    expect(nullish.retryable).toBe(false);
  });

  it('其他 Error 实例归一为 SDK_UNKNOWN_ERROR 并保留 name 与消息为诊断', () => {
    const normalized = toChipsError(new TypeError('读取失败'));
    expect(normalized).toBeInstanceOf(ChipsError);
    expect(normalized.code).toBe(SDK_UNKNOWN_ERROR);
    expect(normalized.retryable).toBe(false);
    expect(normalized.details).toEqual({ name: 'TypeError', cause: '读取失败' });
    expect(normalized.message).toMatch(CHINESE_TEXT);
  });

  it('非 Error 值归一为 SDK_UNKNOWN_ERROR 并把字面值放入 details', () => {
    expect(toChipsError('字符串异常').details).toEqual({ value: '字符串异常' });
    expect(toChipsError(404).details).toEqual({ value: '404' });
    expect(toChipsError(undefined).details).toEqual({ value: 'undefined' });
    expect(toChipsError(null).details).toEqual({ value: 'null' });
    expect(toChipsError({ odd: true }).code).toBe(SDK_UNKNOWN_ERROR);
    expect(toChipsError(Symbol('符号异常')).code).toBe(SDK_UNKNOWN_ERROR);
  });

  it('归一结果只保证 code / message / details / retryable 四个字段可读', () => {
    const normalized = toChipsError(new Error('任意异常'));
    expect(normalized.code).toBe(SDK_UNKNOWN_ERROR);
    expect(typeof normalized.message).toBe('string');
    expect(typeof normalized.retryable).toBe('boolean');
    expect(normalized.details).toEqual({ name: 'Error', cause: '任意异常' });
  });
});

describe('bridgeUnavailableError', () => {
  it('产出 SDK_BRIDGE_UNAVAILABLE 且不可重试', () => {
    const error = bridgeUnavailableError();
    expect(error.code).toBe(SDK_BRIDGE_UNAVAILABLE);
    expect(error.retryable).toBe(false);
    expect(error.message).toMatch(CHINESE_TEXT);
  });

  it('每次调用产出新实例，字段一致', () => {
    const first = bridgeUnavailableError();
    const second = bridgeUnavailableError();
    expect(first).not.toBe(second);
    expect(first.code).toBe(second.code);
    expect(first.message).toBe(second.message);
  });
});
