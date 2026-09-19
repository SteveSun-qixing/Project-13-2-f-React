/**
 * 资源句柄代理（01-Bridge-API规范 §2.4、§3.5、02-Bridge三层设计 §10.2）。
 *
 * - 懒打开：首次 `metadata()` / `read()` / `readRange()` 触发 `bridge:resource` 的 `open`；
 * - 状态机：`open → invalidated → released`；`released` 为终态且 `release()` 幂等；
 * - `read()` 超过 8 MiB 返回 `RESOURCE_TOO_LARGE`（改用 `readRange()` / `stream()`）；
 * - 字节不经 IPC 通道：由注入的 `IResourceByteSource` 按 `chips-resource://` 协议路径读取；
 * - 权威解析、作用域与权限判定在主进程；本代理只做快速失败与生命周期管理，不构成安全边界。
 */

import {
  BRIDGE_ERROR_CODES,
  ChipsError,
  createBridgeError,
  normalizeError,
} from '../protocol/errors.js';
import { IPC_CHANNELS, decodeResourceControlResponse } from '../protocol/ipc.js';
import type { ISubscription } from '../protocol/bridge.js';
import {
  RESOURCE_ERROR_CODES,
  RESOURCE_READ_MAX_BYTES,
  type IResourceHandle,
  type IResourceMetadata,
  type ResourceInvalidateReason,
  type ResourceState,
} from '../protocol/resource.js';
import { createRequestId } from './request-id.js';
import type { IIpcTransport, IResourceByteSource } from './transport.js';

export interface IResourceHandleProxyOptions {
  /** 创建句柄时的原始 URI（预检已通过；主进程做权威归一与判定）。 */
  readonly uri: string;
  readonly transport: IIpcTransport;
  readonly bytes: IResourceByteSource;
  /** 标识生成器；缺省使用 `createRequestId`（UUID v4）。 */
  readonly createRequestId?: () => string;
  readonly onDiagnostic?: (error: unknown) => void;
}

export interface IResourceHandleProxy extends IResourceHandle {
  /** 主进程失效通知入口（客户端在收到 `resource:invalidated` 后调用）。 */
  invalidate(reason: ResourceInvalidateReason): void;
  /** 是否已在主进程完成 `open`（诊断用）。 */
  readonly opened: boolean;
}

function resourceError(code: string, message: string, details?: unknown): ChipsError {
  return new ChipsError({
    code,
    message,
    ...(details !== undefined ? { details } : {}),
    retryable: false,
  });
}

const NOOP_SUBSCRIPTION: ISubscription = { dispose: () => undefined };

export function createResourceHandleProxy(
  options: IResourceHandleProxyOptions
): IResourceHandleProxy {
  const createId = options.createRequestId ?? createRequestId;
  let state: ResourceState = 'open';
  let metadataCache: IResourceMetadata | undefined;
  let openInFlight: Promise<IResourceMetadata> | undefined;
  let invalidateReason: ResourceInvalidateReason | undefined;
  const invalidateListeners = new Set<(reason: ResourceInvalidateReason) => void>();

  const throwIfUnusable = (): void => {
    if (state === 'released') {
      throw resourceError(RESOURCE_ERROR_CODES.handleReleased, '资源句柄已释放，请重新获取句柄', {
        uri: options.uri,
      });
    }
    if (state === 'invalidated') {
      throw resourceError(
        RESOURCE_ERROR_CODES.handleInvalidated,
        '资源句柄已失效，请重新获取句柄',
        { uri: options.uri, reason: invalidateReason }
      );
    }
  };

  const reportDiagnostic = (error: unknown): void => {
    options.onDiagnostic?.(normalizeError(error));
  };

  const open = async (): Promise<IResourceMetadata> => {
    throwIfUnusable();
    if (metadataCache !== undefined) {
      return metadataCache;
    }
    if (openInFlight !== undefined) {
      return openInFlight;
    }
    openInFlight = (async (): Promise<IResourceMetadata> => {
      const requestId = createId();
      const raw = await options.transport.invoke(IPC_CHANNELS.bridgeResource, {
        requestId,
        operation: 'open',
        uri: options.uri,
      });
      const response = decodeResourceControlResponse(raw);
      if (response.requestId !== requestId) {
        throw createBridgeError(BRIDGE_ERROR_CODES.internal, {
          message: '资源打开响应关联失败',
          retryable: false,
        });
      }
      if (!response.ok) {
        throw ChipsError.fromPlain(response.error);
      }
      if (response.metadata === null) {
        throw createBridgeError(BRIDGE_ERROR_CODES.internal, {
          message: '资源打开回执缺少元数据',
          retryable: false,
        });
      }
      if (state === 'released') {
        throw resourceError(RESOURCE_ERROR_CODES.handleReleased, '资源句柄已释放，请重新获取句柄');
      }
      metadataCache = response.metadata;
      return response.metadata;
    })();
    try {
      return await openInFlight;
    } finally {
      openInFlight = undefined;
    }
  };

  return {
    uri: options.uri,

    get state(): ResourceState {
      return state;
    },

    get opened(): boolean {
      return metadataCache !== undefined;
    },

    async metadata(): Promise<IResourceMetadata> {
      const metadata = await open();
      throwIfUnusable();
      return metadata;
    },

    async read(): Promise<Uint8Array> {
      const metadata = await open();
      throwIfUnusable();
      if (metadata.size > RESOURCE_READ_MAX_BYTES) {
        throw resourceError(
          RESOURCE_ERROR_CODES.tooLarge,
          '资源超过单次读取上限，请使用 readRange() 或 stream()',
          { uri: options.uri, size: metadata.size, maxBytes: RESOURCE_READ_MAX_BYTES }
        );
      }
      return options.bytes.read(options.uri);
    },

    async readRange(offset: number, length: number): Promise<Uint8Array> {
      await open();
      throwIfUnusable();
      return options.bytes.readRange(options.uri, offset, length);
    },

    stream(): ReadableStream<Uint8Array> {
      throwIfUnusable();
      return options.bytes.openStream(options.uri);
    },

    release(): void {
      if (state === 'released') {
        return;
      }
      state = 'released';
      invalidateListeners.clear();
      const requestId = createId();
      void options.transport
        .invoke(IPC_CHANNELS.bridgeResource, {
          requestId,
          operation: 'release',
          uri: options.uri,
        })
        .catch(reportDiagnostic);
    },

    onInvalidate(handler: (reason: ResourceInvalidateReason) => void): ISubscription {
      if (state === 'released') {
        return NOOP_SUBSCRIPTION;
      }
      if (state === 'invalidated') {
        let disposed = false;
        queueMicrotask(() => {
          if (!disposed) {
            try {
              handler(invalidateReason ?? 'source-changed');
            } catch (error) {
              reportDiagnostic(error);
            }
          }
        });
        return {
          dispose(): void {
            disposed = true;
          },
        };
      }
      invalidateListeners.add(handler);
      let disposed = false;
      return {
        dispose(): void {
          if (disposed) {
            return;
          }
          disposed = true;
          invalidateListeners.delete(handler);
        },
      };
    },

    invalidate(reason: ResourceInvalidateReason): void {
      if (state !== 'open') {
        return;
      }
      state = 'invalidated';
      invalidateReason = reason;
      const listeners = [...invalidateListeners];
      invalidateListeners.clear();
      for (const listener of listeners) {
        try {
          listener(reason);
        } catch (error) {
          reportDiagnostic(error);
        }
      }
    },
  };
}
