/**
 * 取色能力（content-image.pick-colors）：`pickColors` 原子操作编排。
 *
 * 迁移自旧模块 `src/picker.ts`（109 行），功能面逐行对照：
 * - 并发闸门 `MAX_ACTIVE_PICK_TASKS = 2` 与 FIFO 等待队列、释放幂等：逐行保留
 *   （10-服务插件接口 §3.3「服务内部并发与缓存自行负责」）。
 * - 结果 LRU（`RESULT_CACHE_LIMIT = 48`、命中即刷新为最新使用）：逐行保留；
 *   键从「路径 + stat」换为消费方给出的来源标识（见 `bytes.buildCacheKey`），无标识即不缓存。
 * - 取消检查（旧 `ctx.job.isCancelled() || ctx.job.signal.aborted`）：换为调用上下文
 *   `AbortSignal`（§8.3 约束 2），安全点覆盖入队后、解码前、分析前。
 * - 进度上报（旧 `ctx.job.reportProgress({stage,percent,message})`）：**缺位登记**——
 *   `IServiceContext` 成员总表（10-服务插件接口 §3.2）不提供作业进度通道，本包以
 *   `ctx.logger` 诊断面替代（不伪造进度、不自建旁路通道）。
 * - 诊断日志（旧 `ctx.logger.debug/info`）：保留，消息简体中文，字段只放标量。
 */

import { buildCacheKey, normalizeImageBytes } from './bytes.js';
import { analyzeColorSample } from './color-analysis.js';
import { CONTENT_CAPABILITY_ID, MAX_ACTIVE_PICK_TASKS, RESULT_CACHE_LIMIT } from './descriptor.js';
import { analysisFailed, cancelled } from './errors.js';
import {
  assertImageBytes,
  assertRgbaSample,
  buildDecodeOptions,
  clampSampleSize,
  classifyDecodeError,
  recallSample,
  rememberSample,
} from './pixel-source.js';
import type { IServiceLogger } from '@chips/sdk';

import type {
  IImageDecodeEngine,
  IImageDecodeResult,
  IPickColorsCallContext,
  IPickColorsInput,
  IPickColorsResult,
  IPickColorsService,
  IPickColorsServiceDependencies,
} from './types.js';

/** 诊断日志端口：缺省为静默（无上下文时可独立使用本服务）。 */
type LogSink = Pick<IServiceLogger, 'debug' | 'info'>;

/** 结果缓存（LRU，键为来源标识派生键）。 */
const resultCache = new Map<string, IPickColorsResult>();

/** 并发闸门计数与等待队列。 */
let activePickTasks = 0;
const pickQueue: Array<() => void> = [];

/**
 * 申请一个取色槽位：超过并发上限时进入 FIFO 队列等待。
 *
 * @returns 幂等释放函数
 */
async function acquirePickSlot(): Promise<() => void> {
  if (activePickTasks >= MAX_ACTIVE_PICK_TASKS) {
    await new Promise<void>((resolve) => {
      pickQueue.push(resolve);
    });
  }

  activePickTasks += 1;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    activePickTasks = Math.max(0, activePickTasks - 1);
    pickQueue.shift()?.();
  };
}

/**
 * 写入结果缓存并按 LRU 逐出最旧项。
 *
 * @param cacheKey - 缓存键；`undefined` 时不参与缓存
 * @param result - 取色结果
 */
export function rememberResult(cacheKey: string | undefined, result: IPickColorsResult): void {
  if (cacheKey === undefined) {
    return;
  }
  resultCache.delete(cacheKey);
  resultCache.set(cacheKey, result);

  if (resultCache.size <= RESULT_CACHE_LIMIT) {
    return;
  }
  const oldestKey = resultCache.keys().next().value;
  if (typeof oldestKey === 'string') {
    resultCache.delete(oldestKey);
  }
}

/**
 * 读取结果缓存（命中时刷新为最新使用）。
 *
 * @param cacheKey - 缓存键
 * @returns 命中结果，否则 `undefined`
 */
export function recallResult(cacheKey: string | undefined): IPickColorsResult | undefined {
  if (cacheKey === undefined) {
    return undefined;
  }
  const cached = resultCache.get(cacheKey);
  if (cached === undefined) {
    return undefined;
  }
  resultCache.delete(cacheKey);
  resultCache.set(cacheKey, cached);
  return cached;
}

/** 清空结果缓存：供服务 `stop` 与测试隔离使用。 */
export function clearResultCache(): void {
  resultCache.clear();
}

/** 安全点取消检查。 */
function throwIfCancelled(signal: AbortSignal | undefined, stage: string): void {
  if (signal?.aborted) {
    throw cancelled('图像取色已被取消。', { capability: CONTENT_CAPABILITY_ID, stage });
  }
}

/** 取色流水线：图像字节 → RGBA 样本 → 分析结果（含样本缓存与解码错误归一）。 */
async function resolveSample(
  engine: IImageDecodeEngine,
  bytes: Uint8Array,
  sampleSize: number,
  format: string | undefined,
  cacheKey: string | undefined,
  log: LogSink | undefined
): Promise<IImageDecodeResult> {
  const cached = recallSample(cacheKey);
  if (cached !== undefined) {
    log?.debug('复用缓存的图像采样结果。', { sampleSize });
    return cached;
  }

  log?.info('解码图像字节以取得 RGBA 采样。', { sampleSize, engine: engine.id });
  try {
    const decoded = await engine.decode(bytes, buildDecodeOptions(sampleSize, format));
    const sample = assertRgbaSample(decoded, engine.id);
    rememberSample(sample, cacheKey);
    return sample;
  } catch (error) {
    throw classifyDecodeError(error, engine.id);
  }
}

/**
 * 执行取色：并发闸门 + 取消安全点 + 两级缓存（解码样本 / 取色结果）+ 分析。
 *
 * @param input - 取色输入
 * @param call - 调用上下文（取消信号）
 * @returns 取色结果
 */
export function createPickColorsService(
  dependencies: IPickColorsServiceDependencies & { log?: LogSink }
): IPickColorsService {
  const engine = dependencies.engine;
  if (typeof engine !== 'object' || engine === null || typeof engine.decode !== 'function') {
    throw new TypeError('图像解码端口缺失：必须提供 IImageDecodeEngine 实现。');
  }
  const log = dependencies.log;

  return {
    capabilityId: CONTENT_CAPABILITY_ID,

    async pickColors(
      input: IPickColorsInput,
      call?: IPickColorsCallContext
    ): Promise<IPickColorsResult> {
      const signal = call?.signal;
      const releaseSlot = await acquirePickSlot();
      try {
        throwIfCancelled(signal, 'queued');

        const bytes = assertImageBytes(normalizeImageBytes(input.image));
        const sampleSize = clampSampleSize(input.sampleSize);
        const cacheKey = buildCacheKey(input, sampleSize);
        throwIfCancelled(signal, 'prepare');

        const cachedResult = recallResult(cacheKey);
        if (cachedResult !== undefined) {
          log?.debug('返回缓存的取色结果。', { sampleSize });
          return cachedResult;
        }

        const sample = await resolveSample(engine, bytes, sampleSize, input.format, cacheKey, log);
        throwIfCancelled(signal, 'analyze');

        try {
          const result = analyzeColorSample(sample, {
            sampleSize,
            info: sample.info,
          });
          rememberResult(cacheKey, result);
          log?.info('图像取色完成。', {
            sampleSize,
            backgroundColor: result.backgroundColor,
            accentColor: result.accentColor,
            clusterCount: result.metadata.sample.clusterCount,
          });
          return result;
        } catch (error) {
          if (error instanceof Error && typeof (error as { code?: unknown }).code === 'string') {
            throw error;
          }
          const message = error instanceof Error ? error.message : String(error);
          throw analysisFailed('图像取色分析失败。', {
            capability: CONTENT_CAPABILITY_ID,
            stage: 'analyze',
            cause: message.slice(0, 200),
          });
        }
      } finally {
        releaseSlot();
      }
    },
  };
}
