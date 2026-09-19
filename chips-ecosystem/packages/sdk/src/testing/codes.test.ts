import { describe, expect, it } from 'vitest';
import { ChipsError, SDK_BRIDGE_UNAVAILABLE, SDK_UNKNOWN_ERROR } from '../errors.js';
import { ERROR_CODES } from '../generated/error-codes.js';
import { MOCK_ERROR_CODES, mockError } from './codes.js';

describe('mockError', () => {
  it('构造 ChipsError 实例，name 与 retryable 口径与错误模型一致', () => {
    const error = mockError(MOCK_ERROR_CODES.notFound, '资源不存在或未在 Mock 中登记');
    expect(error).toBeInstanceOf(ChipsError);
    expect(error.name).toBe('ChipsError');
    expect(error.code).toBe(MOCK_ERROR_CODES.notFound);
    expect(error.message).toBe('资源不存在或未在 Mock 中登记');
    expect(error.retryable).toBe(false);
    expect(error.details).toBeUndefined();
  });

  it('details 原样携带，未提供时保持缺省', () => {
    const details = { uri: 'chips-resource://workspace/a.card', reason: '含 fragment 段' };
    expect(mockError(MOCK_ERROR_CODES.invalidUri, '资源地址语法不合法', details).details).toBe(
      details
    );
    expect(mockError(MOCK_ERROR_CODES.invalidUri, '资源地址语法不合法', null).details).toBeNull();
  });

  it('每次调用返回新实例，跨用例不复用', () => {
    const first = mockError(MOCK_ERROR_CODES.invalidInput, '资源读取范围不合法');
    const second = mockError(MOCK_ERROR_CODES.invalidInput, '资源读取范围不合法');
    expect(first).not.toBe(second);
  });
});

describe('MOCK_ERROR_CODES（02-SDK-API规范 §7.2 与 §11 约束 5）', () => {
  const values = Object.values(MOCK_ERROR_CODES);

  it('全部取自平台权威错误码清单，不维护第二份清单', () => {
    for (const code of values) {
      expect(ERROR_CODES, code).toContain(code);
    }
  });

  it('六个错误码互不重复，覆盖能力与资源两条通道', () => {
    expect(new Set(values).size).toBe(values.length);
    expect(values).toEqual([
      'BRIDGE_CAPABILITY_NOT_FOUND',
      'BRIDGE_INVALID_INPUT',
      'RESOURCE_INVALID_URI',
      'RESOURCE_NOT_FOUND',
      'RESOURCE_HANDLE_RELEASED',
      'RESOURCE_HANDLE_INVALIDATED',
    ]);
  });

  it('不含 SDK 侧错误码：Mock 只模拟平台返回', () => {
    for (const code of [SDK_BRIDGE_UNAVAILABLE, SDK_UNKNOWN_ERROR] as const) {
      expect(values, code).not.toContain(code);
      expect(ERROR_CODES, code).not.toContain(code);
    }
  });
});
