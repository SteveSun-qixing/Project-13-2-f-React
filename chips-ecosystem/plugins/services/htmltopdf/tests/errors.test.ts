/**
 * 错误面断言：ChipsError 统一模型、已登记码逐字（CONVERTER_* 三码 +
 * BRIDGE_CANCELLED / BRIDGE_TIMEOUT 通道码）、retryable 语义、details 诊断面、
 * 打印承载错误归一与警告工厂。
 */

import { describe, expect, it } from 'vitest';

import { ChipsError } from '@chips/sdk';

import {
  BRIDGE_CANCELLED,
  BRIDGE_TIMEOUT,
  CONVERTER_INPUT_UNSUPPORTED,
  CONVERTER_OUTPUT_TOO_LARGE,
  CONVERTER_RENDER_FAILED,
  RENDER_CARRIER_UNBOUND,
  cancelled,
  inputUnsupported,
  isChipsErrorLike,
  normalizeEngineError,
  outputTooLarge,
  renderFailed,
  warning,
} from '../src/errors.js';

describe('错误码常量（逐字锁定，不新增码）', () => {
  it('CONVERTER_* 三码与 04-能力契约规范 §8.6 登记一致', () => {
    expect(CONVERTER_INPUT_UNSUPPORTED).toBe('CONVERTER_INPUT_UNSUPPORTED');
    expect(CONVERTER_RENDER_FAILED).toBe('CONVERTER_RENDER_FAILED');
    expect(CONVERTER_OUTPUT_TOO_LARGE).toBe('CONVERTER_OUTPUT_TOO_LARGE');
  });

  it('通道码与未绑定承载诊断值逐字', () => {
    expect(BRIDGE_CANCELLED).toBe('BRIDGE_CANCELLED');
    expect(BRIDGE_TIMEOUT).toBe('BRIDGE_TIMEOUT');
    expect(RENDER_CARRIER_UNBOUND).toBe('RENDER_CARRIER_UNBOUND');
  });
});

describe('错误工厂', () => {
  it('inputUnsupported 产出 CONVERTER_INPUT_UNSUPPORTED，retryable 恒为 false', () => {
    const error = inputUnsupported('输入形状非法。', { field: 'html' });
    expect(error).toBeInstanceOf(ChipsError);
    expect(error.code).toBe('CONVERTER_INPUT_UNSUPPORTED');
    expect(error.message).toBe('输入形状非法。');
    expect(error.retryable).toBe(false);
    expect(error.details).toEqual({ field: 'html' });
  });

  it('renderFailed 产出 CONVERTER_RENDER_FAILED', () => {
    const error = renderFailed('打印承载失败。', { engine: 'platform.render-carrier' });
    expect(error.code).toBe('CONVERTER_RENDER_FAILED');
    expect(error.retryable).toBe(false);
    expect(error.details).toEqual({ engine: 'platform.render-carrier' });
  });

  it('outputTooLarge 产出 CONVERTER_OUTPUT_TOO_LARGE', () => {
    const error = outputTooLarge('产物超限。', { bytes: 1, limit: 2 });
    expect(error.code).toBe('CONVERTER_OUTPUT_TOO_LARGE');
    expect(error.retryable).toBe(false);
    expect(error.details).toEqual({ bytes: 1, limit: 2 });
  });

  it('cancelled 产出通道码 BRIDGE_CANCELLED', () => {
    const error = cancelled('调用已被取消。', { capability: 'content-converter.html-to-pdf' });
    expect(error.code).toBe('BRIDGE_CANCELLED');
    expect(error.retryable).toBe(false);
    expect(error.details).toEqual({ capability: 'content-converter.html-to-pdf' });
  });

  it('details 缺省时诊断值为 undefined（不携带空诊断对象，各工厂一致）', () => {
    const withoutDetails = inputUnsupported('缺省诊断。');
    expect(withoutDetails.details).toBeUndefined();
    expect(renderFailed('缺省诊断。').details).toBeUndefined();
    expect(outputTooLarge('缺省诊断。').details).toBeUndefined();
    expect(cancelled('缺省诊断。').details).toBeUndefined();
  });
});

describe('isChipsErrorLike', () => {
  it('仅 ChipsError 实例为真', () => {
    expect(isChipsErrorLike(inputUnsupported('x'))).toBe(true);
    expect(isChipsErrorLike(new ChipsError({ code: 'X', message: 'x', retryable: false }))).toBe(true);
    expect(isChipsErrorLike(new Error('普通错误'))).toBe(false);
    expect(isChipsErrorLike({ code: 'CONVERTER_RENDER_FAILED' })).toBe(false);
    expect(isChipsErrorLike('CONVERTER_RENDER_FAILED')).toBe(false);
    expect(isChipsErrorLike(null)).toBe(false);
    expect(isChipsErrorLike(undefined)).toBe(false);
  });
});

describe('normalizeEngineError', () => {
  it('ChipsError 原样透传（同一实例，含 BRIDGE_CANCELLED）', () => {
    const original = cancelled('承载内取消。');
    expect(normalizeEngineError(original, 'engine-a')).toBe(original);
    const timeoutLike = new ChipsError({
      code: BRIDGE_TIMEOUT,
      message: '承载超时。',
      retryable: true,
    });
    expect(normalizeEngineError(timeoutLike, 'engine-a')).toBe(timeoutLike);
  });

  it('普通 Error 归一为 CONVERTER_RENDER_FAILED，details 携带 engine 与 cause', () => {
    const error = normalizeEngineError(new Error('boom'), 'engine-a');
    expect(error).toBeInstanceOf(ChipsError);
    expect(error.code).toBe('CONVERTER_RENDER_FAILED');
    expect(error.message).toBe('打印承载在执行过程中失败。');
    expect(error.retryable).toBe(false);
    expect(error.details).toEqual({ engine: 'engine-a', cause: 'boom' });
  });

  it('非 Error 抛出值按 String 归一，不吞错、不降级', () => {
    expect(normalizeEngineError(42, 'engine-a').details).toEqual({ engine: 'engine-a', cause: '42' });
    expect(normalizeEngineError(null, 'engine-a').details).toEqual({
      engine: 'engine-a',
      cause: 'null',
    });
  });

  it('cause 截断到 200 字符（不含堆栈与内部路径）', () => {
    const error = normalizeEngineError(new Error('x'.repeat(500)), 'engine-a');
    const details = error.details as { cause: string };
    expect(details.cause).toHaveLength(200);
  });
});

describe('warning 工厂', () => {
  it('构造警告对象：无 details 时不产出键，携带 details 时如实保留', () => {
    expect(warning('PAGE_OVERFLOW_KEEP_BLOCK', '说明')).toEqual({
      code: 'PAGE_OVERFLOW_KEEP_BLOCK',
      message: '说明',
    });
    expect(warning('PAGE_OVERFLOW_KEEP_BLOCK', '说明', { blockId: 'b1' })).toEqual({
      code: 'PAGE_OVERFLOW_KEEP_BLOCK',
      message: '说明',
      details: { blockId: 'b1' },
    });
  });
});
