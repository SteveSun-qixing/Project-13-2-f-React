/**
 * 像素来源面断言：采样边长归一、RGBA 形状校验、解码错误分类、未绑定端口 fail-closed。
 */

import { ChipsError } from '@chips/sdk';
import { describe, expect, it } from 'vitest';

import { errorDetails } from './support/error-shape.js';
import { MAX_IMAGE_BYTES } from '../src/descriptor.js';
import {
  BRIDGE_CANCELLED,
  DECODED_SAMPLE_INVALID,
  FORMAT_UNSUPPORTED,
  IMAGE_DECODE_FAILED,
  IMAGE_INPUT_UNSUPPORTED,
  INPUT_TOO_LARGE,
  PIXEL_SOURCE_UNBOUND,
  cancelled,
} from '../src/errors.js';
import {
  UNBOUND_DECODE_ENGINE_ID,
  assertImageBytes,
  assertRgbaSample,
  buildDecodeOptions,
  classifyDecodeError,
  clampSampleSize,
  createUnboundDecodeEngine,
} from '../src/pixel-source.js';
import type { IImageDecodeResult } from '../src/types.js';

const sample = (width: number, height: number, channels: number): IImageDecodeResult => ({
  width,
  height,
  pixels: new Uint8Array(width * height * channels),
  info: { width, height, animated: false, pageCount: 1, hasAlpha: channels === 4 },
});

const pickCode = (run: () => unknown): ChipsError => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ChipsError);
    return error as ChipsError;
  }
  throw new Error('预期抛出 ChipsError，实际未抛出。');
};

describe('clampSampleSize', () => {
  it('缺省与非有限值回落到 96', () => {
    expect(clampSampleSize(undefined)).toBe(96);
    expect(clampSampleSize(Number.NaN)).toBe(96);
    expect(clampSampleSize(Number.POSITIVE_INFINITY)).toBe(96);
  });

  it('四舍五入并夹到 48–160', () => {
    expect(clampSampleSize(10)).toBe(48);
    expect(clampSampleSize(96.6)).toBe(97);
    expect(clampSampleSize(999)).toBe(160);
  });
});

describe('assertRgbaSample', () => {
  it('合法 RGBA 样本原样通过', () => {
    const value = sample(6, 4, 4);
    expect(assertRgbaSample(value, 'test-engine')).toBe(value);
  });

  it('非四通道样本以 IMAGE_DECODE_FAILED + DECODED_SAMPLE_INVALID 收口', () => {
    const error = pickCode(() => assertRgbaSample(sample(6, 4, 3), 'test-engine'));
    expect(error.code).toBe(IMAGE_DECODE_FAILED);
    expect(errorDetails(error).reason).toBe(DECODED_SAMPLE_INVALID);
    expect(errorDetails(error).engine).toBe('test-engine');
  });

  it('零尺寸样本以 IMAGE_DECODE_FAILED 收口', () => {
    expect(pickCode(() => assertRgbaSample(sample(0, 8, 4), 'test-engine')).code).toBe(
      IMAGE_DECODE_FAILED
    );
  });
});

describe('assertImageBytes', () => {
  it('超限输入以 IMAGE_INPUT_UNSUPPORTED + INPUT_TOO_LARGE 收口', () => {
    const error = pickCode(() => assertImageBytes(new Uint8Array(MAX_IMAGE_BYTES + 1)));
    expect(error.code).toBe(IMAGE_INPUT_UNSUPPORTED);
    expect(errorDetails(error).reason).toBe(INPUT_TOO_LARGE);
  });

  it('上限内输入原样通过', () => {
    const bytes = new Uint8Array(1024);
    expect(assertImageBytes(bytes)).toBe(bytes);
  });
});

describe('buildDecodeOptions', () => {
  it('空白格式提示不下传', () => {
    expect(buildDecodeOptions(96, '  ')).toEqual({ targetSize: 96 });
    expect(buildDecodeOptions(96, ' jpeg ')).toEqual({ targetSize: 96, format: 'jpeg' });
  });
});

describe('classifyDecodeError', () => {
  it('ChipsError 原样透传（不吞取消语义）', () => {
    const original = cancelled('取色已被取消。');
    expect(classifyDecodeError(original, 'test-engine')).toBe(original);
    expect((classifyDecodeError(original, 'test-engine') as ChipsError).code).toBe(
      BRIDGE_CANCELLED
    );
  });

  it('格式类消息归一为 IMAGE_INPUT_UNSUPPORTED + FORMAT_UNSUPPORTED', () => {
    const error = pickCode(() => {
      throw classifyDecodeError(new Error('Input buffer contains unsupported image format'), 'e1');
    });
    expect(error.code).toBe(IMAGE_INPUT_UNSUPPORTED);
    expect(errorDetails(error).reason).toBe(FORMAT_UNSUPPORTED);
  });

  it('其余异常归一为 IMAGE_DECODE_FAILED 并保留诊断摘要', () => {
    const error = pickCode(() => {
      throw classifyDecodeError(new Error('decoder exploded'), 'e1');
    });
    expect(error.code).toBe(IMAGE_DECODE_FAILED);
    expect(errorDetails(error).engine).toBe('e1');
    expect(String(errorDetails(error).cause)).toContain('decoder exploded');
  });
});

describe('createUnboundDecodeEngine', () => {
  it('缺省端口标识为平台图像解码供给', () => {
    expect(createUnboundDecodeEngine().id).toBe(UNBOUND_DECODE_ENGINE_ID);
    expect(createUnboundDecodeEngine('custom.engine').id).toBe('custom.engine');
  });

  it('未绑定端口调用即按已登记码如实收口（不返回模拟像素）', async () => {
    const engine = createUnboundDecodeEngine();
    await expect(engine.decode(new Uint8Array([1, 2, 3]), { targetSize: 96 })).rejects.toThrow(
      ChipsError
    );

    const error = await engine
      .decode(new Uint8Array([1, 2, 3]), { targetSize: 96 })
      .then(() => undefined)
      .catch((reason: unknown) => reason as ChipsError);
    expect(error?.code).toBe(IMAGE_DECODE_FAILED);
    expect(errorDetails(error).reason).toBe(PIXEL_SOURCE_UNBOUND);
  });
});
