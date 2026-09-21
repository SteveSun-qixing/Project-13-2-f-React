/**
 * host 错误面直连收敛锚定套件。
 *
 * 前身：`src/preload/chips-error.ts` 包裹层（host 域三参 `toChipsError` 与
 * `IChipsErrorShape` 别名）的直测套件。工单024 §八.3 渲染面收敛波将该包裹层归档
 * （`归档/preload-chips-error-工单024渲染面收敛/`），本套件按裁定等价改写到新的直连路径：
 * - 类 / 守卫 / 平台侧归一 = `@chips/bridge`（`ChipsError` / `isChipsError` / `normalizeError`）；
 * - 渲染域兜底归一 = `src/renderer/codes.ts` `toRenderFallbackError`
 *   （未识别异常 → 域码表码与文案、原始文本入 `details.cause`、`retryable` 取域码表口径）。
 * 用例数不低于原套件，原断言语义逐条保留或收紧（无放宽）。
 */

import { describe, expect, it, vi } from 'vitest';
import {
  BRIDGE_ERROR_CODES,
  ChipsError,
  isChipsError,
  normalizeError,
} from '@chips/bridge';

import {
  createRenderError,
  RENDER_ERROR_CODES,
  RENDER_ERROR_MESSAGES,
  toRenderFallbackError,
} from '../src/renderer/codes.js';

describe('同源收敛（工单024《RFC-ChipsError统一裁定》§3.2、§3.3 条 5）', () => {
  it('渲染域工厂产出的错误即 @chips/bridge 唯一类实例（同一原型，非同形复刻）', () => {
    const error = createRenderError({ code: RENDER_ERROR_CODES.documentInvalid });
    expect(Object.getPrototypeOf(error)).toBe(ChipsError.prototype);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ChipsError');
  });

  it('渲染域兜底口还原的跨界错误与唯一类同源（fromPlain 还原为同一类实例）', () => {
    const restored = toRenderFallbackError(
      { code: 'B', message: 'n', retryable: true },
      RENDER_ERROR_CODES.updateFailed,
    );
    expect(Object.getPrototypeOf(restored)).toBe(ChipsError.prototype);
  });
});

describe('ChipsError（bridge 唯一类，直连消费面）', () => {
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

describe('isChipsError（bridge 结构守卫，判据三条合取）', () => {
  it('接受结构化错误并拒绝非法形状', () => {
    expect(isChipsError({ code: 'A', message: 'm' })).toBe(true);
    expect(isChipsError({ code: 'A', message: 'm', retryable: false })).toBe(true);
    expect(isChipsError({ code: '', message: 'm' })).toBe(false);
    expect(isChipsError({ code: 'A' })).toBe(false);
    expect(isChipsError(null)).toBe(false);
  });
});

describe('normalizeError（平台侧兜底归一，原单参 toChipsError 消费面的直连等价）', () => {
  it('原样返回 ChipsError', () => {
    const error = new ChipsError({ code: 'A', message: 'm' });
    expect(normalizeError(error)).toBe(error);
  });

  it('还原结构化错误对象', () => {
    const restored = normalizeError({ code: 'B', message: 'n', retryable: true });
    expect(restored).toBeInstanceOf(ChipsError);
    expect(restored.code).toBe('B');
    expect(restored.retryable).toBe(true);
  });

  it('识别带 code 的 Error 并保留消息（结构守卫同构还原）', () => {
    const restored = normalizeError(Object.assign(new Error('文件读取失败'), { code: 'FILE_IO_FAILED' }));
    expect(restored.code).toBe('FILE_IO_FAILED');
    expect(restored.message).toBe('文件读取失败');
  });

  it('未识别异常归一为 BRIDGE_INTERNAL，兜底文案取 bridge 权威表（私有文案已废弃，§4.5 条 4）', () => {
    const fallback = normalizeError('boom');
    expect(fallback.code).toBe(BRIDGE_ERROR_CODES.internal);
    expect(fallback.message).toBe('平台内部错误');
    expect(fallback.retryable).toBe(false);
    expect(fallback.details).toBeUndefined();
  });
});

describe('toRenderFallbackError（渲染域兜底归一，原三参 toChipsError 消费面的直连等价）', () => {
  it('已识别错误透传与还原，不套域兜底码', () => {
    const instance = new ChipsError({ code: 'A', message: 'm' });
    expect(toRenderFallbackError(instance, RENDER_ERROR_CODES.updateFailed)).toBe(instance);
    const restored = toRenderFallbackError(
      { code: 'BRIDGE_TIMEOUT', message: '能力调用超时', retryable: true },
      RENDER_ERROR_CODES.frameTimeout,
    );
    expect(restored.code).toBe('BRIDGE_TIMEOUT');
    expect(restored.retryable).toBe(true);
  });

  it('未识别异常归一为调用点域兜底码：message 取域码表文案、原始文本入 details.cause（§4.5 条 3）', () => {
    const error = toRenderFallbackError(new Error('帧入口不可达'), RENDER_ERROR_CODES.frameTimeout);
    expect(error.code).toBe(RENDER_ERROR_CODES.frameTimeout);
    expect(error.message).toBe(RENDER_ERROR_MESSAGES.RENDER_FRAME_TIMEOUT);
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ name: 'Error', cause: '帧入口不可达' });
  });

  it('未识别异常按域码表口径产出 updateFailed（retryable 取值权威在域码表，§4.5 条 1）', () => {
    const error = toRenderFallbackError('unexpected value', RENDER_ERROR_CODES.updateFailed);
    expect(error.code).toBe(RENDER_ERROR_CODES.updateFailed);
    expect(error.message).toBe(RENDER_ERROR_MESSAGES.RENDER_UPDATE_FAILED);
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ cause: 'unexpected value' });
  });

  it('诊断回调仅在未识别异常路径触发，且不改变还原路径', () => {
    const onDiagnostic = vi.fn();
    toRenderFallbackError(new ChipsError({ code: 'A', message: 'm' }), RENDER_ERROR_CODES.updateFailed, onDiagnostic);
    toRenderFallbackError({ code: 'B', message: 'n' }, RENDER_ERROR_CODES.updateFailed, onDiagnostic);
    expect(onDiagnostic).not.toHaveBeenCalled();
    toRenderFallbackError(new Error('boom'), RENDER_ERROR_CODES.updateFailed, onDiagnostic);
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
  });
});
