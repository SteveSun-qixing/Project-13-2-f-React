/**
 * `pickColors` 编排断言：解码端口消费、两级缓存、取消安全点、并发闸门与错误归一。
 *
 * 端口以测试内注入的确定性解码桩提供像素（生产装配走未绑定端口，见 plugin.test.ts）：
 * 桩只负责把固定 RGBA 样本交回，不模拟任何图像解码算法。
 */

import { ChipsError } from '@chips/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorDetails } from './support/error-shape.js';
import { analyzeColorSample } from '../src/color-analysis.js';
import { CONTENT_CAPABILITY_ID, MAX_IMAGE_BYTES } from '../src/descriptor.js';
import {
  BRIDGE_CANCELLED,
  DECODED_SAMPLE_INVALID,
  IMAGE_DECODE_FAILED,
  IMAGE_INPUT_UNSUPPORTED,
  INPUT_TOO_LARGE,
  PIXEL_SOURCE_UNBOUND,
  cancelled,
} from '../src/errors.js';
import { clearSampleCache, createUnboundDecodeEngine } from '../src/pixel-source.js';
import { clearResultCache, createPickColorsService } from '../src/service.js';
import type { IImageDecodeEngine, IImageDecodeResult } from '../src/types.js';

const WIDTH = 10;
const HEIGHT = 10;

const posterPixels = (): Uint8Array => {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      const red = x < 7 ? 24 : 242;
      const green = x < 7 ? 34 : 112;
      const blue = x < 7 ? 94 : 56;
      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
};

const decodedSample = (): IImageDecodeResult => ({
  width: WIDTH,
  height: HEIGHT,
  pixels: posterPixels(),
  info: { width: 640, height: 480, format: 'png', animated: false, pageCount: 1, hasAlpha: true },
});

const imageBytes = (seed: number): Uint8Array => {
  const bytes = new Uint8Array(16);
  bytes.fill(seed);
  return bytes;
};

/** 计数解码桩：记录调用次数与并发峰值。 */
function countingEngine(delayMs = 0): {
  engine: IImageDecodeEngine;
  calls: () => number;
  peak: () => number;
} {
  let calls = 0;
  let active = 0;
  let peak = 0;

  const engine: IImageDecodeEngine = {
    id: 'test.decode-stub',
    async decode() {
      calls += 1;
      active += 1;
      peak = Math.max(peak, active);
      try {
        if (delayMs > 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, delayMs);
          });
        }
        return decodedSample();
      } finally {
        active -= 1;
      }
    },
  };

  return { engine, calls: () => calls, peak: () => peak };
}

const expectCode = async (run: Promise<unknown>): Promise<ChipsError> => {
  const error = await run.then(
    () => undefined,
    (reason: unknown) => reason
  );
  expect(error).toBeInstanceOf(ChipsError);
  return error as ChipsError;
};

let sourceSequence = 0;
const nextSourceKey = (): string => {
  sourceSequence += 1;
  return `test://material/${String(sourceSequence)}`;
};

beforeEach(() => {
  clearSampleCache();
  clearResultCache();
});

describe('createPickColorsService', () => {
  it('装配校验：缺失码解码端口直接 TypeError', () => {
    expect(() =>
      createPickColorsService({ engine: undefined as unknown as IImageDecodeEngine })
    ).toThrow(TypeError);
  });

  it('服务面：能力 ID 为登记的 canonical 值', () => {
    const service = createPickColorsService({ engine: countingEngine().engine });
    expect(service.capabilityId).toBe(CONTENT_CAPABILITY_ID);
  });

  it('取色结果与纯逻辑层对同一样本的分析全等，并回填端口元信息', async () => {
    const service = createPickColorsService({ engine: countingEngine().engine });
    const result = await service.pickColors({
      image: imageBytes(7),
      sourceKey: nextSourceKey(),
      sampleSize: 96,
    });

    expect(result).toEqual(
      analyzeColorSample(
        { width: WIDTH, height: HEIGHT, pixels: posterPixels() },
        { sampleSize: 96, info: decodedSample().info }
      )
    );
    expect(result.metadata.image).toMatchObject({ width: 640, height: 480, format: 'png' });
    expect(result.metadata.sample.sampleSize).toBe(96);
    expect(result.palette[0]).toMatchObject({ role: 'background' });
  });

  it('结果缓存：同一来源标识二次调用不再解码', async () => {
    const stub = countingEngine();
    const service = createPickColorsService({ engine: stub.engine });
    const sourceKey = nextSourceKey();

    const first = await service.pickColors({ image: imageBytes(3), sourceKey });
    const second = await service.pickColors({ image: imageBytes(3), sourceKey });

    expect(second).toBe(first);
    expect(stub.calls()).toBe(1);
  });

  it('无来源标识时不参与缓存：两次调用解码两次', async () => {
    const stub = countingEngine();
    const service = createPickColorsService({ engine: stub.engine });

    await service.pickColors({ image: imageBytes(3) });
    await service.pickColors({ image: imageBytes(3) });

    expect(stub.calls()).toBe(2);
  });

  it('取消：入队前已 abort 以 BRIDGE_CANCELLED 收口', async () => {
    const controller = new AbortController();
    controller.abort();
    const service = createPickColorsService({ engine: createUnboundDecodeEngine() });

    const error = await expectCode(
      service.pickColors(
        { image: imageBytes(1), sourceKey: nextSourceKey() },
        { signal: controller.signal }
      )
    );
    expect(error.code).toBe(BRIDGE_CANCELLED);
    expect(errorDetails(error).stage).toBe('queued');
  });

  it('取消：解码端口抛出的取消错误原样透传', async () => {
    const engine: IImageDecodeEngine = {
      id: 'test.cancelling',
      decode(): Promise<IImageDecodeResult> {
        return Promise.reject(cancelled('解码已被取消。'));
      },
    };
    const service = createPickColorsService({ engine });

    const error = await expectCode(
      service.pickColors({ image: imageBytes(1), sourceKey: nextSourceKey() })
    );
    expect(error.code).toBe(BRIDGE_CANCELLED);
  });

  it('生产装配缺位面：未绑定解码端口按已登记码如实收口', async () => {
    const service = createPickColorsService({ engine: createUnboundDecodeEngine() });

    const error = await expectCode(
      service.pickColors({ image: imageBytes(1), sourceKey: nextSourceKey() })
    );
    expect(error.code).toBe(IMAGE_DECODE_FAILED);
    expect(errorDetails(error).reason).toBe(PIXEL_SOURCE_UNBOUND);
  });

  it('端口产出形状非法：IMAGE_DECODE_FAILED + DECODED_SAMPLE_INVALID', async () => {
    const engine: IImageDecodeEngine = {
      id: 'test.rgb-stub',
      decode(): Promise<IImageDecodeResult> {
        return Promise.resolve({
          width: WIDTH,
          height: HEIGHT,
          pixels: new Uint8Array(WIDTH * HEIGHT * 3),
          info: { width: WIDTH, height: HEIGHT, animated: false, pageCount: 1, hasAlpha: false },
        });
      },
    };
    const service = createPickColorsService({ engine });

    const error = await expectCode(
      service.pickColors({ image: imageBytes(1), sourceKey: nextSourceKey() })
    );
    expect(error.code).toBe(IMAGE_DECODE_FAILED);
    expect(errorDetails(error).reason).toBe(DECODED_SAMPLE_INVALID);
  });

  it('输入校验：非二进制与超限输入均不出端口', async () => {
    const stub = countingEngine();
    const service = createPickColorsService({ engine: stub.engine });

    const notBinary = await expectCode(
      service.pickColors({
        image: 'iVBORw0KGgo=' as unknown as Uint8Array,
        sourceKey: nextSourceKey(),
      })
    );
    expect(notBinary.code).toBe(IMAGE_INPUT_UNSUPPORTED);

    const oversized = await expectCode(
      service.pickColors({
        image: new Uint8Array(MAX_IMAGE_BYTES + 1),
        sourceKey: nextSourceKey(),
      })
    );
    expect(oversized.code).toBe(IMAGE_INPUT_UNSUPPORTED);
    expect(errorDetails(oversized).reason).toBe(INPUT_TOO_LARGE);
    expect(stub.calls()).toBe(0);
  });

  it('并发闸门：同时在途的取色不超过 2', async () => {
    const stub = countingEngine(8);
    const service = createPickColorsService({ engine: stub.engine });

    const keys = [nextSourceKey(), nextSourceKey(), nextSourceKey(), nextSourceKey()];
    const results = await Promise.all(
      keys.map((key) => service.pickColors({ image: imageBytes(2), sourceKey: key }))
    );

    expect(results).toHaveLength(4);
    expect(stub.calls()).toBe(4);
    expect(stub.peak()).toBeLessThanOrEqual(2);
  });

  it('日志诊断：以服务端 logger 取代旧作业进度通道', async () => {
    const info = vi.fn();
    const debug = vi.fn();
    const service = createPickColorsService({
      engine: countingEngine().engine,
      log: { info, debug },
    });

    const sourceKey = nextSourceKey();
    await service.pickColors({ image: imageBytes(5), sourceKey });
    await service.pickColors({ image: imageBytes(5), sourceKey });

    expect(info).toHaveBeenCalledTimes(2);
    expect(debug).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0]?.[0])).toContain('解码');
    expect(String(debug.mock.calls[0]?.[0])).toContain('缓存');
  });
});
