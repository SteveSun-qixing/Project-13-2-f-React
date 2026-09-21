import { describe, expect, it } from 'vitest';
import { ChipsError as BridgeChipsError, isChipsError as bridgeIsChipsError } from '@chips/bridge';

import { ChipsError, isChipsError, toChipsError } from '../src/preload/chips-error.js';

describe('同源收敛（工单024《RFC-ChipsError统一裁定》§3.3 条 5、§5.4）', () => {
  it('preload 导出的类与结构守卫即 @chips/bridge 唯一实现本身（同一函数对象）', () => {
    expect(ChipsError).toBe(BridgeChipsError);
    expect(isChipsError).toBe(bridgeIsChipsError);
  });
});

describe('ChipsError（bridge 唯一类的薄再导出面）', () => {
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

  it('fromPlain 还原普通对象为唯一类实例并保真字段（§4.3 传输/还原口径）', () => {
    const restored = ChipsError.fromPlain({
      code: 'BRIDGE_PERMISSION_DENIED',
      message: '插件缺少所需权限',
      retryable: false,
      details: { capability: 'file:read' },
    });
    expect(restored).toBeInstanceOf(ChipsError);
    expect(restored.code).toBe('BRIDGE_PERMISSION_DENIED');
    expect(restored.retryable).toBe(false);
    expect(restored.details).toEqual({ capability: 'file:read' });
  });
});

describe('isChipsError（bridge 结构守卫的薄再导出面，判据三条合取）', () => {
  it('接受结构化错误并拒绝非法形状', () => {
    expect(isChipsError({ code: 'A', message: 'm' })).toBe(true);
    expect(isChipsError({ code: 'A', message: 'm', retryable: false })).toBe(true);
    expect(isChipsError({ code: '', message: 'm' })).toBe(false);
    expect(isChipsError({ code: 'A' })).toBe(false);
    expect(isChipsError(null)).toBe(false);
  });
});

describe('toChipsError（host 域便捷归一口，基座为 bridge 唯一类）', () => {
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

  it('未识别异常归一为兜底码，缺省兜底文案取 bridge 权威表（私有文案「宿主内部错误」已废弃，§4.5 条 4）', () => {
    expect(toChipsError('boom').code).toBe('BRIDGE_INTERNAL');
    expect(toChipsError(new Error('')).message).toBe('平台内部错误');
    expect(toChipsError(undefined, 'RESOURCE_INTERNAL', '资源读取失败').code).toBe('RESOURCE_INTERNAL');
  });
});
