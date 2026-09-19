import { describe, expect, it, vi } from 'vitest';
import {
  BRIDGE_ERROR_CODES,
  BRIDGE_ERROR_MESSAGES,
  BRIDGE_ERROR_RETRYABLE,
  ChipsError,
  createBridgeError,
  isPlainChipsError,
  KERNEL_INVALID_TRANSITION,
  normalizeError,
  PERMISSION_ERROR_CODES,
} from './errors.js';

describe('ChipsError', () => {
  it('构造时缺省 retryable 为 false 且 name 固定', () => {
    const error = new ChipsError({ code: 'DOCUMENT_NOT_FOUND', message: '文档不存在' });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ChipsError');
    expect(error.code).toBe('DOCUMENT_NOT_FOUND');
    expect(error.message).toBe('文档不存在');
    expect(error.retryable).toBe(false);
    expect(error.details).toBeUndefined();
  });

  it('toPlain() 仅在有 details 时携带该字段', () => {
    expect(new ChipsError({ code: 'A_B', message: '文案' }).toPlain()).toEqual({
      code: 'A_B',
      message: '文案',
      retryable: false,
    });
    expect(
      new ChipsError({
        code: 'A_B',
        message: '文案',
        details: { path: '/a' },
        retryable: true,
      }).toPlain()
    ).toEqual({ code: 'A_B', message: '文案', details: { path: '/a' }, retryable: true });
  });

  it('fromPlain() 还原同构错误且保持原型', () => {
    const restored = ChipsError.fromPlain({ code: 'FILE_NOT_FOUND', message: '文件不存在' });
    expect(restored).toBeInstanceOf(ChipsError);
    expect(restored.retryable).toBe(false);
    expect(ChipsError.isChipsError(restored)).toBe(true);
    expect(ChipsError.isChipsError(new Error('x'))).toBe(false);
  });
});

describe('isPlainChipsError', () => {
  it('识别普通对象形态，拒绝缺字段或类型非法', () => {
    expect(isPlainChipsError({ code: 'A_B', message: '文案' })).toBe(true);
    expect(isPlainChipsError({ code: 'A_B', message: '文案', retryable: true })).toBe(true);
    expect(isPlainChipsError(null)).toBe(false);
    expect(isPlainChipsError('A_B')).toBe(false);
    expect(isPlainChipsError({ code: '', message: '文案' })).toBe(false);
    expect(isPlainChipsError({ code: 'A_B', message: 1 })).toBe(false);
    expect(isPlainChipsError({ code: 'A_B', message: '文案', retryable: 'yes' })).toBe(false);
  });
});

describe('createBridgeError', () => {
  it('缺省使用错误码表的文案与 retryable 口径', () => {
    const error = createBridgeError(BRIDGE_ERROR_CODES.timeout);
    expect(error.message).toBe(BRIDGE_ERROR_MESSAGES.BRIDGE_TIMEOUT);
    expect(error.retryable).toBe(true);
  });

  it('允许覆盖文案、retryable 与 details', () => {
    const error = createBridgeError(BRIDGE_ERROR_CODES.capabilityNotFound, {
      message: '自定义文案',
      retryable: true,
      details: { capabilityId: 'file:read' },
    });
    expect(error.message).toBe('自定义文案');
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ capabilityId: 'file:read' });
  });

  it('错误码表覆盖全部 11 项 Bridge 通道错误码', () => {
    expect(Object.keys(BRIDGE_ERROR_RETRYABLE)).toHaveLength(11);
    expect(Object.keys(BRIDGE_ERROR_MESSAGES)).toHaveLength(11);
    expect(BRIDGE_ERROR_RETRYABLE.BRIDGE_CANCELLED).toBe(false);
    expect(BRIDGE_ERROR_RETRYABLE.BRIDGE_QUEUE_OVERFLOW).toBe(true);
  });
});

describe('normalizeError', () => {
  it('ChipsError 原样返回', () => {
    const error = createBridgeError(BRIDGE_ERROR_CODES.timeout);
    expect(normalizeError(error)).toBe(error);
  });

  it('普通对象形态错误同构还原并透传宿主业务码', () => {
    const normalized = normalizeError({
      code: 'FILE_NOT_FOUND',
      message: '文件不存在',
      retryable: false,
    });
    expect(normalized).toBeInstanceOf(ChipsError);
    expect(normalized.code).toBe('FILE_NOT_FOUND');
  });

  it('AbortError 归一为 BRIDGE_CANCELLED', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(normalizeError(abort).code).toBe(BRIDGE_ERROR_CODES.cancelled);
  });

  it('未识别异常归一为 BRIDGE_INTERNAL 并写诊断', () => {
    const onDiagnostic = vi.fn();
    const normalized = normalizeError(new TypeError('boom'), { onDiagnostic });
    expect(normalized.code).toBe(BRIDGE_ERROR_CODES.internal);
    expect(normalized.details).toBeUndefined();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
  });
});

describe('注册期错误码常量', () => {
  it('权限注册错误码与 owner 生命周期错误码与文档一致', () => {
    expect(PERMISSION_ERROR_CODES.notDeclared).toBe('PERMISSION_NOT_DECLARED');
    expect(PERMISSION_ERROR_CODES.unknown).toBe('PERMISSION_UNKNOWN');
    expect(KERNEL_INVALID_TRANSITION).toBe('KERNEL_INVALID_TRANSITION');
  });
});
