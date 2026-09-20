import { describe, expect, it, vi } from 'vitest';
import {
  BRIDGE_ERROR_CODES,
  BRIDGE_ERROR_MESSAGES,
  BRIDGE_ERROR_RETRYABLE,
  ChipsError,
  createBridgeError,
  isChipsError,
  KERNEL_INVALID_TRANSITION,
  normalizeError,
  PERMISSION_ERROR_CODES,
  type IChipsErrorInit,
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
    expect(isChipsError(restored)).toBe(true);
    expect(isChipsError(new Error('x'))).toBe(false);
  });

  it('fromPlain(toPlain()) 往返保真（跨边界还原语义，原 host 面测试点）', () => {
    const original = new ChipsError({
      code: 'A_B',
      message: '文案',
      details: { path: '/a' },
      retryable: true,
    });
    const restored = ChipsError.fromPlain(original.toPlain());
    expect(restored).toBeInstanceOf(ChipsError);
    expect(restored.name).toBe('ChipsError');
    expect(restored.code).toBe('A_B');
    expect(restored.message).toBe('文案');
    expect(restored.retryable).toBe(true);
    expect(restored.details).toEqual({ path: '/a' });
    expect(restored.toPlain()).toEqual(original.toPlain());
  });

  it('toPlain() 恒输出 code/message/retryable 三键，details 仅在非 undefined 时输出', () => {
    const bare = new ChipsError({ code: 'A_B', message: '文案' }).toPlain();
    expect(Object.keys(bare).sort()).toEqual(['code', 'message', 'retryable']);
    const withDetails = new ChipsError({
      code: 'A_B',
      message: '文案',
      details: { uri: 'chips-resource://x' },
    }).toPlain();
    expect(Object.keys(withDetails).sort()).toEqual(['code', 'details', 'message', 'retryable']);
  });

  it('构造只接受初始化对象，位置参数不填充错误字段（§6.2 禁位置参数）', () => {
    const init: IChipsErrorInit = { code: 'A_B', message: '文案' };
    expect(new ChipsError(init).code).toBe('A_B');
    // @ts-expect-error 位置参数形式不被类型系统接受（构造入参唯一为 IChipsErrorInit）。
    const misplaced = new ChipsError('A_B', '文案');
    expect(misplaced.code).toBeUndefined();
    expect(misplaced.message).toBe('');
    expect(misplaced.retryable).toBe(false);
  });
});

describe('isChipsError（唯一权威结构守卫）', () => {
  it('识别普通对象形态，拒绝缺字段或类型非法', () => {
    expect(isChipsError({ code: 'A_B', message: '文案' })).toBe(true);
    expect(isChipsError({ code: 'A_B', message: '文案', retryable: true })).toBe(true);
    expect(isChipsError(null)).toBe(false);
    expect(isChipsError('A_B')).toBe(false);
    expect(isChipsError({ code: '', message: '文案' })).toBe(false);
    expect(isChipsError({ code: 'A_B', message: 1 })).toBe(false);
    expect(isChipsError({ code: 'A_B', message: '文案', retryable: 'yes' })).toBe(false);
  });

  it('本类实例永远通过判定（入口宽、出口严）', () => {
    const error = new ChipsError({ code: 'A_B', message: '文案' });
    expect(isChipsError(error)).toBe(true);
    expect(isChipsError(error.toPlain())).toBe(true);
  });

  it('message 为空字符串仍通过判定（输入端不设内容门槛，§4.2 条 2）', () => {
    expect(isChipsError({ code: 'A_B', message: '' })).toBe(true);
  });

  it('跨 Realm：不挂原型链、经克隆/序列化同构还原的普通对象通过判定', () => {
    const foreignRealm = JSON.parse(
      JSON.stringify({ code: 'FILE_NOT_FOUND', message: '文件不存在', retryable: false })
    ) as unknown;
    expect(foreignRealm instanceof ChipsError).toBe(false);
    expect(isChipsError(foreignRealm)).toBe(true);
    const nullPrototype = Object.assign(Object.create(null), {
      code: 'FILE_NOT_FOUND',
      message: '文件不存在',
    }) as unknown;
    expect(isChipsError(nullPrototype)).toBe(true);
  });

  it('不读取原型链：getter 暴露合法字段的对象也通过判定', () => {
    const withGetters = {} as Record<string, unknown>;
    Object.defineProperty(withGetters, 'code', { get: () => 'A_B' });
    Object.defineProperty(withGetters, 'message', { get: () => '文案' });
    expect(isChipsError(withGetters)).toBe(true);
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

  it('权限拒绝码常量表覆盖 §9.1 PERMISSION_* 域全部四码（工单013 收口）', () => {
    expect(PERMISSION_ERROR_CODES.invalid).toBe('PERMISSION_INVALID');
    expect(PERMISSION_ERROR_CODES.roleNotAllowed).toBe('PERMISSION_ROLE_NOT_ALLOWED');
    expect([...Object.values(PERMISSION_ERROR_CODES)].sort()).toEqual([
      'PERMISSION_INVALID',
      'PERMISSION_NOT_DECLARED',
      'PERMISSION_ROLE_NOT_ALLOWED',
      'PERMISSION_UNKNOWN',
    ]);
  });
});
