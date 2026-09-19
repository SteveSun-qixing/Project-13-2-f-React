import { describe, expect, it } from 'vitest';

import { toChipsUiFailure } from './failure';

describe('toChipsUiFailure', () => {
  it('结构化错误透传 code 与 message', () => {
    const failure = toChipsUiFailure(
      { code: 'COMMAND_NOT_FOUND', message: '命令不存在' },
      '兜底说明'
    );
    expect(failure).toEqual({ code: 'COMMAND_NOT_FOUND', message: '命令不存在' });
  });

  it('只有 message 时取错误名作为 code', () => {
    expect(toChipsUiFailure(new TypeError('参数类型错误'), '兜底')).toEqual({
      code: 'TypeError',
      message: '参数类型错误',
    });
  });

  it('只有 code 时使用兜底说明', () => {
    expect(toChipsUiFailure({ code: 'BRIDGE_TIMEOUT' }, '请求超时，请重试')).toEqual({
      code: 'BRIDGE_TIMEOUT',
      message: '请求超时，请重试',
    });
  });

  it('普通对象使用兜底说明与构造名', () => {
    expect(toChipsUiFailure({}, '操作失败')).toEqual({ code: 'Object', message: '操作失败' });
  });

  it('空字符串 code 视为缺失', () => {
    const failure = toChipsUiFailure({ code: '', message: '失败了' }, '兜底');
    expect(failure.code).toBe('Object');
    expect(failure.message).toBe('失败了');
  });

  it('非对象抛出物使用兜底说明', () => {
    expect(toChipsUiFailure('崩溃了', '操作失败')).toEqual({ code: 'Error', message: '操作失败' });
    expect(toChipsUiFailure(null, '操作失败')).toEqual({ code: 'Error', message: '操作失败' });
    expect(toChipsUiFailure(undefined, '操作失败')).toEqual({ code: 'Error', message: '操作失败' });
    expect(toChipsUiFailure(42, '操作失败')).toEqual({ code: 'Error', message: '操作失败' });
  });

  it('无 name 的 Error 子类回落到 Error', () => {
    const error = new Error('消息');
    Object.defineProperty(error, 'name', { value: '' });
    expect(toChipsUiFailure(error, '兜底')).toEqual({ code: 'Error', message: '消息' });
  });
});
