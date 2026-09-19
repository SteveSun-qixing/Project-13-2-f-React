import { describe, expect, it } from 'vitest';
import { ChipsError, isChipsError } from '../errors.js';
import { assertChipsError } from './assert-chips-error.js';
import { MOCK_ERROR_CODES, mockError } from './codes.js';

/** 执行断言并取抛出的 Error 消息；未抛错时返回 `undefined`。 */
function failureMessage(run: () => void): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return error instanceof Error ? `${error.name}:${error.message}` : undefined;
  }
}

describe('assertChipsError', () => {
  it('ChipsError 与期望错误码一致时通过', () => {
    const error = mockError(MOCK_ERROR_CODES.capabilityNotFound, '该能力未登记 Mock 桩');
    expect(() => assertChipsError(error, MOCK_ERROR_CODES.capabilityNotFound)).not.toThrow();
  });

  it('省略期望错误码时只断言结构', () => {
    const error = mockError(MOCK_ERROR_CODES.notFound, '资源不存在或未在 Mock 中登记');
    expect(() => assertChipsError(error)).not.toThrow();
    // 结构等价的普通对象同样通过：跨 Bridge 传输的是普通对象
    expect(() =>
      assertChipsError({ code: 'DOCUMENT_NOT_OPEN', message: '文档会话不存在或已关闭' }),
    ).not.toThrow();
  });

  it('错误码不匹配时抛 Error，消息含期望与实际错误码', () => {
    const error = mockError(MOCK_ERROR_CODES.handleReleased, '资源句柄已释放');
    const message = failureMessage(() => assertChipsError(error, MOCK_ERROR_CODES.notFound));
    expect(message).toContain('Error:');
    expect(message).toContain(`期望错误码 ${MOCK_ERROR_CODES.notFound}`);
    expect(message).toContain(`实际错误码 ${MOCK_ERROR_CODES.handleReleased}`);
    expect(failureMessage(() => assertChipsError(error))).toBeUndefined();
  });

  it('非 ChipsError 值抛 Error，消息描述实际形状', () => {
    expect(failureMessage(() => assertChipsError(new Error('普通异常')))).toContain(
      '期望 ChipsError',
    );
    expect(failureMessage(() => assertChipsError('BRIDGE_TIMEOUT'))).toContain('string（');
    expect(failureMessage(() => assertChipsError(null))).toContain('null');
    expect(failureMessage(() => assertChipsError(undefined))).toContain('undefined（undefined）');
    // 结构判定只看 code 与 message 是否都是字符串（§5.1）：缺任一字段即非 ChipsError 形状
    expect(failureMessage(() => assertChipsError({ code: 'X' }))).toContain(
      '结构不完整的对象（code=X，message=缺失）',
    );
    expect(failureMessage(() => assertChipsError({ message: '缺错误码' }))).toContain(
      '结构不完整的对象（code=缺失，message=缺错误码）',
    );
    expect(failureMessage(() => assertChipsError({}))).toContain(
      '结构不完整的对象（code=缺失，message=缺失）',
    );
  });

  it('同构普通对象按 ChipsError 通过，不因缺少原型而失败', () => {
    // §5.1：isChipsError 不读取原型链；跨 Bridge 传输的是普通对象，故结构等价即通过
    expect(() => assertChipsError({ code: 'BRIDGE_TIMEOUT', message: '调用超时' })).not.toThrow();
    expect(failureMessage(() => assertChipsError({ code: 1, message: '调用超时' }))).toContain(
      '期望 ChipsError',
    );
  });

  it('断言收窄后字段可按类型读取', () => {
    const caught: unknown = mockError(MOCK_ERROR_CODES.invalidUri, '资源地址语法不合法', {
      uri: 'chips-resource://workspace/a.card?x=1',
      reason: '受管作用域禁止查询串',
    });
    assertChipsError(caught, MOCK_ERROR_CODES.invalidUri);
    expect(caught.code).toBe(MOCK_ERROR_CODES.invalidUri);
    expect(caught.retryable).toBe(false);
    expect(caught.details).toEqual({
      uri: 'chips-resource://workspace/a.card?x=1',
      reason: '受管作用域禁止查询串',
    });
    expect(isChipsError(caught)).toBe(true);
    expect(caught).toBeInstanceOf(ChipsError);
  });

  it('期望错误码为不匹配字符串时不会静默通过', () => {
    const caught: unknown = new ChipsError({ code: 'BRIDGE_TIMEOUT', message: '调用超时' });
    expect(failureMessage(() => assertChipsError(caught, 'BRIDGE_INTERNAL'))).toContain(
      '期望错误码 BRIDGE_INTERNAL，实际错误码 BRIDGE_TIMEOUT',
    );
  });
});
