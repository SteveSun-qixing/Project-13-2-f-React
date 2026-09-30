/**
 * 取色能力（content-image.pick-colors）：像素来源（图像解码端口）与样本缓存。
 *
 * 迁移自旧模块 `src/image-sampler.ts`（247 行），逐面处置如下：
 * - `normalizeImagePath`（`file://` 解析、绝对路径校验、远程 scheme 拒绝）与
 *   `ensureSourceFile`（Host 动作 `file.stat`）：作废并登记缺位——§8.3 约束 1 禁止原子操作
 *   获取资源句柄、读写路径，图像字节由消费方随调用传入，来源存在性由消费方在
 *   `resource:` / `file:` 域收口（旧 `COLOR_PICKER_INPUT_NOT_FOUND` 随之下线）。
 * - `sharp` 解码 + `ensureAlpha` + `resize(contain, linear, withoutEnlargement, fastShrinkOnLoad)`
 *   + `raw()` 产出 RGBA：整体上移为 `IImageDecodeEngine` 端口（像素解码属宿主图像供给，
 *   `content-image.normalize` / `transcode` 提供方在册缺位；sharp 属未裁新依赖且携带原生载荷，
 *   违 R11 与 §8.3 约束 5）。本包只保留端口形状、形状校验、样本缓存与未绑定实现。
 * - 采样边长归一（48–160、缺省 96）、RGBA 形状校验、解码错误分类、样本 LRU（上限 24）：逐行保留。
 */

import {
  MAX_IMAGE_BYTES,
  MAX_SOURCE_KEY_LENGTH,
  MIN_SAMPLE_SIZE,
  DEFAULT_SAMPLE_SIZE,
  MAX_SAMPLE_SIZE,
  SAMPLE_CACHE_LIMIT,
} from './descriptor.js';
import {
  DECODED_SAMPLE_INVALID,
  FORMAT_UNSUPPORTED,
  INPUT_TOO_LARGE,
  PIXEL_SOURCE_UNBOUND,
  decodeFailed,
  inputUnsupported,
  normalizeDecodeError,
} from './errors.js';
import type { IImageDecodeEngine, IImageDecodeOptions, IImageDecodeResult } from './types.js';

/** 未绑定解码端口的缺省标识（宿主图像供给接入后由该波次替换）。 */
export const UNBOUND_DECODE_ENGINE_ID = 'platform.image-decode';

/**
 * 归一采样边长：非法或非有限值回缺省，其余四舍五入并夹到 48–160。
 *
 * @param value - 调用方给出的采样边长
 * @returns 合法采样边长
 */
export function clampSampleSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_SAMPLE_SIZE;
  }
  return Math.min(MAX_SAMPLE_SIZE, Math.max(MIN_SAMPLE_SIZE, Math.round(value)));
}

/**
 * 校验图像字节输入：长度上限。
 *
 * @param bytes - 已归一的图像字节
 * @returns 同一字节引用，便于链式使用
 * @throws `IMAGE_INPUT_UNSUPPORTED` + `details.reason=INPUT_TOO_LARGE` 超过 `MAX_IMAGE_BYTES`
 */
export function assertImageBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw inputUnsupported(`图像字节超出输入上限 ${MAX_IMAGE_BYTES} 字节。`, {
      reason: INPUT_TOO_LARGE,
      bytes: bytes.byteLength,
    });
  }
  return bytes;
}

/**
 * 校验解码端口产出：尺寸非空、逐像素 RGBA 四通道、字节数与尺寸一致。
 *
 * @param result - 解码产出
 * @param engineId - 端口标识（诊断用）
 * @returns 同一产出对象
 * @throws `IMAGE_DECODE_FAILED` + `details.reason=DECODED_SAMPLE_INVALID`
 */
export function assertRgbaSample(result: IImageDecodeResult, engineId: string): IImageDecodeResult {
  const expected = result.width * result.height * 4;
  const channels =
    result.height * result.width > 0
      ? result.pixels.byteLength / (result.width * result.height)
      : 0;

  if (
    result.width <= 0 ||
    result.height <= 0 ||
    channels !== 4 ||
    result.pixels.byteLength !== expected
  ) {
    throw decodeFailed('解码端口产出的像素样本形状非法。', {
      engine: engineId,
      reason: DECODED_SAMPLE_INVALID,
      width: result.width,
      height: result.height,
      channels: Math.round(channels * 1000) / 1000,
      bytes: result.pixels.byteLength,
    });
  }

  return result;
}

/** 样本缓存（LRU，键为消费方给出的来源标识派生键）。 */
const sampleCache = new Map<string, IImageDecodeResult>();

/**
 * 写入样本缓存并按 LRU 逐出最旧项。
 *
 * @param sample - 解码产出
 * @param cacheKey - 缓存键；`undefined` 时不参与缓存
 */
export function rememberSample(sample: IImageDecodeResult, cacheKey: string | undefined): void {
  if (cacheKey === undefined) {
    return;
  }
  sampleCache.delete(cacheKey);
  sampleCache.set(cacheKey, sample);

  if (sampleCache.size <= SAMPLE_CACHE_LIMIT) {
    return;
  }
  const oldestKey = sampleCache.keys().next().value;
  if (typeof oldestKey === 'string') {
    sampleCache.delete(oldestKey);
  }
}

/**
 * 读取样本缓存（命中时刷新为最新使用）。
 *
 * @param cacheKey - 缓存键
 * @returns 命中样本，否则 `undefined`
 */
export function recallSample(cacheKey: string | undefined): IImageDecodeResult | undefined {
  if (cacheKey === undefined) {
    return undefined;
  }
  const cached = sampleCache.get(cacheKey);
  if (cached === undefined) {
    return undefined;
  }
  sampleCache.delete(cacheKey);
  sampleCache.set(cacheKey, cached);
  return cached;
}

/** 清空样本与结果缓存：供服务 `stop` 与测试隔离使用。 */
export function clearSampleCache(): void {
  sampleCache.clear();
}

/** 构造解码端口选项。 */
export function buildDecodeOptions(
  sampleSize: number,
  format: string | undefined
): IImageDecodeOptions {
  return {
    targetSize: sampleSize,
    ...(format === undefined || format.trim().length === 0 ? {} : { format: format.trim() }),
  };
}

/** 校验来源标识长度上界，超限即视为无标识。 */
export function isSourceKeyUsable(value: string | undefined): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_SOURCE_KEY_LENGTH
  );
}

/**
 * 解码错误分类（迁移自旧实现的错误映射臂）：
 * `ChipsError` 原样透传；其余异常按消息特征归一为
 * `IMAGE_INPUT_UNSUPPORTED`（格式不支持）或 `IMAGE_DECODE_FAILED`。
 * 旧的 `FILE_NOT_FOUND` 分类臂随路径面一并作废（本包不再读路径）。
 *
 * @param error - 端口抛出的异常
 * @param engineId - 端口标识
 */
export function classifyDecodeError(error: unknown, engineId: string): Error {
  if (error instanceof Error && typeof (error as { code?: unknown }).code === 'string') {
    return normalizeDecodeError(error, engineId);
  }
  const message = error instanceof Error ? error.message : String(error);
  const unsupported = /unsupported|unknown image format|not a valid|corrupt|truncated|vips/i.test(
    message
  );
  if (unsupported) {
    throw inputUnsupported('来源图像格式不在解码端口的支持矩阵内。', {
      engine: engineId,
      reason: FORMAT_UNSUPPORTED,
      cause: message.slice(0, 200),
    });
  }
  return normalizeDecodeError(error, engineId);
}

/**
 * 创建「未绑定」解码端口：调用即以已登记码 `IMAGE_DECODE_FAILED` +
 * `details.reason=PIXEL_SOURCE_UNBOUND` 如实收口。它表达的是平台事实
 * （图像字节 → RGBA 像素的解码供给未在内核注册），不是降级、不是占位成功路径。
 *
 * @param engineId - 端口标识
 * @returns 未绑定端口
 */
export function createUnboundDecodeEngine(
  engineId: string = UNBOUND_DECODE_ENGINE_ID
): IImageDecodeEngine {
  return {
    id: engineId,
    decode(): Promise<IImageDecodeResult> {
      return Promise.reject(
        decodeFailed('平台图像解码供给尚未接入，无法从图像字节得到 RGBA 像素样本。', {
          engine: engineId,
          reason: PIXEL_SOURCE_UNBOUND,
        })
      );
    },
  };
}
