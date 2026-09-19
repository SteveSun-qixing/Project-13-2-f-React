import { createHash, randomUUID } from 'node:crypto';
import { link, open, rename, stat, unlink, type FileHandle } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import type {
  IPalTransferPort,
  TransferDownloadOptions,
  TransferEvents,
  TransferFailure,
  TransferId,
} from '../contracts/index.js';
import { assertCallActive, bindCallSignal } from '../call-guard.js';
import { PAL_ERROR_CODES, PalPortError, isPalPortError } from '../errors.js';
import type { ElectronNetLike } from '../electron/electron-api.js';
import { isHttpUrl } from './http-port.js';
import { sendNetRequest, type NetRequestParams, type NetworkLimits } from './net-request.js';

/** macOS 传输端口依赖。 */
export interface MacTransferPortDependencies {
  /** Electron `net` 模块切片。 */
  readonly net: ElectronNetLike;
  /** 网络限制覆盖（测试注入）；缺省使用资源管理设计 §8.2 基线。 */
  readonly limits?: Partial<NetworkLimits>;
  /** 进度回调最小间隔（毫秒）；默认 200（事件契约 §4.10）。 */
  readonly progressIntervalMs?: number;
}

/** 传输任务登记项。 */
interface TransferTask {
  readonly controller: AbortController;
  readonly task: Promise<void>;
}

/** 临时文件后缀。 */
const TEMP_SUFFIX = '.chips-transfer-tmp';

/**
 * 创建 macOS 传输端口。
 *
 * 权威：`04-能力契约规范` §7.15、`05-事件契约规范` §4.10。
 *
 * @param dependencies Electron `net` 模块与限制覆盖。
 * @returns `transfer:*` 端口实现。
 *
 * @remarks
 * - 响应体流式写入同目录临时文件（不整体驻留内存）；`overwrite:false` 时用 `link`
 *   原子防止覆盖，失败清理临时物。
 * - 期望摘要按 `sha256` 校验，不匹配返回 `TRANSFER_DIGEST_MISMATCH` 且目标路径不被修改。
 * - 取消经内部 `AbortController` 在响应头与响应体两个阶段中止底层请求；
 *   失败/取消后临时物必被清理、目标路径不被修改。
 * - 进度回调最小间隔默认 200ms；完成/失败回调不节流。
 * - `cancel` 幂等并等待临时物清理完成。
 */
export function createMacTransferPort(dependencies: MacTransferPortDependencies): IPalTransferPort {
  const { net } = dependencies;
  const limits = dependencies.limits;
  const progressIntervalMs = dependencies.progressIntervalMs ?? 200;
  const tasks = new Map<TransferId, TransferTask>();

  return {
    async download(
      options: TransferDownloadOptions,
      events: TransferEvents,
    ): Promise<{ readonly transferId: TransferId }> {
      assertCallActive(options);
      if (!isHttpUrl(options.url)) {
        throw new PalPortError(PAL_ERROR_CODES.HTTP_URL_INVALID);
      }
      if (!isAbsolute(options.target)) {
        throw new PalPortError(PAL_ERROR_CODES.TRANSFER_FAILED, undefined, {
          details: { reason: 'target-not-absolute' },
        });
      }
      if (options.overwrite !== true && (await pathExists(options.target))) {
        throw new PalPortError(PAL_ERROR_CODES.TRANSFER_TARGET_EXISTS);
      }

      const transferId = randomUUID();
      const controller = new AbortController();
      const unbindCallSignal = bindCallSignal(options, controller);
      const task = runDownload(net, limits, progressIntervalMs, options, events, controller.signal)
        .catch((error: unknown) => {
          events.onFailed(normalizeTransferFailure(error));
        })
        .finally(() => {
          unbindCallSignal();
          tasks.delete(transferId);
        });
      tasks.set(transferId, { controller, task });
      return { transferId };
    },

    async cancel(transferId: TransferId): Promise<void> {
      const task = tasks.get(transferId);
      if (task === undefined) {
        return;
      }
      task.controller.abort();
      await task.task.catch(() => undefined);
    },
  };
}

/** 执行下载任务；失败抛出归一错误，由调用方转为 `onFailed`。 */
async function runDownload(
  net: ElectronNetLike,
  limits: Partial<NetworkLimits> | undefined,
  progressIntervalMs: number,
  options: TransferDownloadOptions,
  events: TransferEvents,
  signal: AbortSignal,
): Promise<void> {
  const tempPath = join(dirname(options.target), `.${basename(options.target)}.${randomUUID()}${TEMP_SUFFIX}`);
  const digest = createHash('sha256');
  let handle: FileHandle | undefined;
  let writeChain: Promise<void> = Promise.resolve();
  let lastProgressAt = 0;
  let receivedBytes = 0;
  let totalBytes: number | null = null;

  try {
    handle = await open(tempPath, 'wx');
    const file = handle;
    const requestParams: NetRequestParams = {
      url: options.url,
      method: 'GET',
      headers: {},
      signal,
      bufferResponse: false,
      ...(options.authorizeRedirect !== undefined ? { authorizeRedirect: options.authorizeRedirect } : {}),
      ...(limits !== undefined ? { limits } : {}),
      onResponseHead: (head) => {
        totalBytes = readContentLength(head.headers);
      },
      onData: (chunk, transferred, total) => {
        digest.update(chunk);
        receivedBytes = transferred;
        totalBytes = total;
        writeChain = writeChain.then(() => file.write(chunk)).then(() => undefined);
        const now = Date.now();
        if (now - lastProgressAt >= progressIntervalMs) {
          lastProgressAt = now;
          events.onProgress({ transferredBytes: receivedBytes, totalBytes });
        }
      },
    };

    await sendNetRequest(net, requestParams);
    await writeChain;

    const actualDigest = `sha256:${digest.digest('hex')}`;
    if (options.expectedDigest !== undefined && options.expectedDigest !== actualDigest) {
      throw new PalPortError(PAL_ERROR_CODES.TRANSFER_DIGEST_MISMATCH, undefined, {
        details: { expectedDigest: options.expectedDigest, actualDigest },
      });
    }

    await handle.sync();
    await handle.close();
    handle = undefined;

    await commitTempFile(tempPath, options.target, options.overwrite === true);
    events.onCompleted({ target: options.target, digest: actualDigest });
  } catch (error) {
    throw toTransferError(error);
  } finally {
    await writeChain.catch(() => undefined);
    if (handle !== undefined) {
      await handle.close().catch(() => undefined);
    }
    await unlink(tempPath).catch(() => undefined);
  }
}

/** 把临时文件提交到目标路径；`overwrite:false` 使用 `link` 原子防覆盖。 */
async function commitTempFile(tempPath: string, target: string, overwrite: boolean): Promise<void> {
  if (overwrite) {
    await rename(tempPath, target);
    return;
  }
  try {
    await link(tempPath, target);
    await unlink(tempPath);
  } catch (error) {
    if (readNodeErrorCode(error) === 'EEXIST') {
      throw new PalPortError(PAL_ERROR_CODES.TRANSFER_TARGET_EXISTS);
    }
    if (isLinkUnsupportedError(error)) {
      if (await pathExists(target)) {
        throw new PalPortError(PAL_ERROR_CODES.TRANSFER_TARGET_EXISTS);
      }
      await rename(tempPath, target);
      return;
    }
    throw error;
  }
}

/** 归一传输失败信息；`retryable` 与失败码的登记语义一致。 */
function normalizeTransferFailure(error: unknown): TransferFailure {
  const portError = isPalPortError(error) ? error : undefined;
  const cancelled = portError?.code === PAL_ERROR_CODES.BRIDGE_CANCELLED;
  const failure: TransferFailure = {
    code: cancelled ? PAL_ERROR_CODES.BRIDGE_CANCELLED : (portError?.code ?? PAL_ERROR_CODES.TRANSFER_FAILED),
    message: portError?.message ?? '传输失败',
    retryable: portError?.retryable ?? false,
    cancelled,
  };
  if (portError?.details !== undefined) {
    return { ...failure, details: portError.details };
  }
  return failure;
}

/** 把网络/系统错误映射为传输域错误码。 */
function toTransferError(error: unknown): PalPortError {
  if (isPalPortError(error)) {
    if (error.code === PAL_ERROR_CODES.HTTP_REQUEST_FAILED || error.code === PAL_ERROR_CODES.BRIDGE_TIMEOUT) {
      return new PalPortError(PAL_ERROR_CODES.TRANSFER_FAILED, undefined, {
        details: { causeCode: error.code },
        cause: error,
      });
    }
    return error;
  }
  return new PalPortError(PAL_ERROR_CODES.TRANSFER_FAILED, undefined, { cause: error });
}

/** 路径是否存在。 */
async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (readNodeErrorCode(error) === 'ENOENT') {
      return false;
    }
    throw new PalPortError(PAL_ERROR_CODES.TRANSFER_FAILED, undefined, { cause: error });
  }
}

/** 硬链接不支持错误。 */
function isLinkUnsupportedError(error: unknown): boolean {
  const code = readNodeErrorCode(error);
  return code === 'EPERM' || code === 'ENOSYS' || code === 'ENOTSUP' || code === 'EOPNOTSUPP' || code === 'EACCES';
}

/** 读取 Node 错误码。 */
function readNodeErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** 读取 `Content-Length` 响应头。 */
function readContentLength(headers: Readonly<Record<string, string>>): number | null {
  const raw = headers['content-length'];
  if (raw === undefined) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
