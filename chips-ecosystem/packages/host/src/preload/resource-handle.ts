/**
 * preload 资源句柄代理与失效通知。
 *
 * 权威：`01-Bridge-API规范` §2.4（`IResourceHandle` 与状态机）、
 * `02-Bridge三层设计` §2.5（资源访问流程）、`06-资源协议规范` §5.2（两条访问路径）。
 *
 * @remarks
 * - 句柄懒打开：首次 `metadata` / `read` / `readRange` / `stream` 触发 `bridge:resource` 的 `open`；
 *   字节统一经 `chips-resource://` 协议处理器读取，不经 IPC。
 * - 预检（URI 语法、平台 / external 作用域的 `resources:read` 快照）只做快速失败；
 *   权威判定（作用域归属、路径安全与权限）在主进程。
 * - `state` 为创建时快照 + 本地状态机推进（contextBridge 不支持动态 getter）。
 */

import { ChipsError, normalizeError } from '@chips/bridge';
import { BRIDGE_RESOURCE_CHANNEL } from '../protocol/channels.js';
import { resourceErrorMessage } from '../protocol/resource-error.js';
import { parseResourceUri } from '../protocol/resource-uri.js';
import { isResourceControlResponse } from '../protocol/wire.js';
import type { SessionPermissionCache } from './permission-cache.js';
import type { ISubscription } from './subscriptions.js';
import type { IPreloadTransport } from './transport.js';

/** 资源作用域。 */
export type ResourceScope = 'workspace' | 'document' | 'plugin' | 'platform' | 'external' | 'temporary' | 'memory';

/** 句柄状态。 */
export type ResourceState = 'open' | 'invalidated' | 'released';

/** 失效原因。 */
export type ResourceInvalidateReason = 'source-changed' | 'session-closed' | 'scope-revoked';

/** 资源元数据（与核心返回结构一致）。 */
export interface IResourceMetadata {
  /** 原始 URI。 */
  readonly uri: string;
  /** 字节数。 */
  readonly size: number;
  /** MIME 类型。 */
  readonly mimeType: string;
  /** 资源版本标识。 */
  readonly version: string;
  /** 作用域。 */
  readonly scope: ResourceScope;
}

/** 资源句柄。 */
export interface IResourceHandle {
  /** 创建句柄时的原始 URI。 */
  readonly uri: string;
  /** 句柄状态快照。 */
  readonly state: ResourceState;
  /** 读取元数据；首次调用触发主进程 `open`。 */
  metadata(): Promise<IResourceMetadata>;
  /** 读取完整字节；超过 8 MiB 返回 `RESOURCE_TOO_LARGE`。 */
  read(): Promise<Uint8Array>;
  /** 按偏移读取；流打开期间返回 `RESOURCE_BUSY`。 */
  readRange(offset: number, length: number): Promise<Uint8Array>;
  /** 流式读取；同一句柄仅允许一个活动流。 */
  stream(): Promise<ReadableStream<Uint8Array>>;
  /** 释放句柄；幂等。 */
  release(): void;
  /** 订阅失效通知。 */
  onInvalidate(handler: (reason: ResourceInvalidateReason) => void): ISubscription;
}

/** `read()` 内联读取上限（8 MiB，`01-Bridge-API规范` §2.4）。 */
export const RESOURCE_INLINE_MAX_BYTES = 8 * 1024 * 1024;

/** `resource:invalidated` 事件 ID（事件契约登记值）。 */
export const RESOURCE_INVALIDATED_EVENT_ID = 'resource:invalidated';

const INVALIDATE_REASONS: ReadonlySet<string> = new Set(['source-changed', 'session-closed', 'scope-revoked']);

/** 资源句柄依赖。 */
export interface ResourceHandleDeps {
  /** 传输口。 */
  readonly transport: IPreloadTransport;
  /** 会话权限快照。 */
  readonly permissions: SessionPermissionCache;
  /** 失效通知登记口。 */
  readonly invalidations: ResourceInvalidationRegistry;
  /** `requestId` 生成器。 */
  readonly generateRequestId: () => string;
  /** `fetch` 实现；默认全局 `fetch`。 */
  readonly fetchImpl?: typeof fetch;
  /** 诊断口。 */
  readonly onDiagnostic: (message: string, details?: Readonly<Record<string, unknown>>) => void;
}

/** 失效通知登记口。 */
export interface ResourceInvalidationRegistry {
  /** 登记 URI 失效通知。 */
  register(uri: string, handler: (reason: ResourceInvalidateReason) => void): ISubscription;
}

/** 失效通知聚合：按需建立 `resource:invalidated` 订阅，无句柄时释放。 */
export class ResourceInvalidationHub implements ResourceInvalidationRegistry {
  private readonly subscribeSource: (eventId: string, handler: (payload: unknown) => void) => ISubscription;
  private readonly handlers = new Map<string, Set<(reason: ResourceInvalidateReason) => void>>();
  private subscription: ISubscription | null = null;
  private readonly onDiagnostic: ResourceHandleDeps['onDiagnostic'];

  constructor(
    subscribeSource: (eventId: string, handler: (payload: unknown) => void) => ISubscription,
    onDiagnostic: ResourceHandleDeps['onDiagnostic'],
  ) {
    this.subscribeSource = subscribeSource;
    this.onDiagnostic = onDiagnostic;
  }

  register(uri: string, handler: (reason: ResourceInvalidateReason) => void): ISubscription {
    let handlers = this.handlers.get(uri);
    if (handlers === undefined) {
      handlers = new Set();
      this.handlers.set(uri, handlers);
    }
    handlers.add(handler);
    this.ensureSubscription();
    let disposed = false;
    return {
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        const entries = this.handlers.get(uri);
        if (entries === undefined) {
          return;
        }
        entries.delete(handler);
        if (entries.size === 0) {
          this.handlers.delete(uri);
        }
        if (this.handlers.size === 0) {
          this.subscription?.dispose();
          this.subscription = null;
        }
      },
    };
  }

  /** 释放全部登记。 */
  dispose(): void {
    this.handlers.clear();
    this.subscription?.dispose();
    this.subscription = null;
  }

  /** 建立唯一 `resource:invalidated` 订阅。 */
  private ensureSubscription(): void {
    if (this.subscription !== null) {
      return;
    }
    this.subscription = this.subscribeSource(RESOURCE_INVALIDATED_EVENT_ID, (payload) => {
      this.dispatch(payload);
    });
  }

  /** 分发失效事件。 */
  private dispatch(payload: unknown): void {
    if (typeof payload !== 'object' || payload === null) {
      this.onDiagnostic('丢弃非法资源失效事件');
      return;
    }
    const record = payload as { uri?: unknown; reason?: unknown };
    if (typeof record.uri !== 'string' || record.uri.length === 0) {
      this.onDiagnostic('丢弃非法资源失效事件');
      return;
    }
    if (typeof record.reason !== 'string' || !INVALIDATE_REASONS.has(record.reason)) {
      this.onDiagnostic('丢弃原因非法的资源失效事件', { uri: record.uri });
      return;
    }
    const reason = record.reason as ResourceInvalidateReason;
    const handlers = this.handlers.get(record.uri);
    if (handlers === undefined) {
      return;
    }
    for (const handler of [...handlers]) {
      try {
        handler(reason);
      } catch (error) {
        this.onDiagnostic('资源失效处理器抛出异常', {
          uri: record.uri,
          reason: error instanceof Error ? error.message : typeof error,
        });
      }
    }
  }
}

/** 创建资源句柄。 */
export function createResourceHandle(uri: string, deps: ResourceHandleDeps): IResourceHandle {
  const parsed = parseResourceUri(uri);
  if (!parsed.ok) {
    throw new ChipsError({
      code: parsed.code,
      message: resourceErrorMessage(parsed.code),
      retryable: false,
    });
  }
  if (
    (parsed.scope === 'platform' || parsed.scope === 'external') &&
    deps.permissions.ready &&
    !deps.permissions.has('resources:read')
  ) {
    throw new ChipsError({
      code: 'RESOURCE_PERMISSION_DENIED',
      message: resourceErrorMessage('RESOURCE_PERMISSION_DENIED'),
      retryable: false,
    });
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const invalidateHandlers = new Set<(reason: ResourceInvalidateReason) => void>();
  let metadata: IResourceMetadata | null = null;
  let openPromise: Promise<IResourceMetadata> | null = null;
  let released = false;
  let invalidated = false;
  let streamOpen = false;

  const currentState = (): ResourceState => {
    if (released) {
      return 'released';
    }
    return invalidated ? 'invalidated' : 'open';
  };

  const assertReadable = (): void => {
    if (released) {
      throw new ChipsError({
        code: 'RESOURCE_HANDLE_RELEASED',
        message: resourceErrorMessage('RESOURCE_HANDLE_RELEASED'),
        retryable: false,
      });
    }
    if (invalidated) {
      throw new ChipsError({
        code: 'RESOURCE_HANDLE_INVALIDATED',
        message: resourceErrorMessage('RESOURCE_HANDLE_INVALIDATED'),
        retryable: false,
      });
    }
  };

  const ensureOpen = async (): Promise<IResourceMetadata> => {
    assertReadable();
    if (metadata !== null) {
      return metadata;
    }
    if (openPromise === null) {
      const requestId = deps.generateRequestId();
      openPromise = (async (): Promise<IResourceMetadata> => {
        const response = await deps.transport.invoke(BRIDGE_RESOURCE_CHANNEL, {
          requestId,
          operation: 'open',
          uri,
        });
        if (!isResourceControlResponse(response)) {
          throw new ChipsError({
            code: 'BRIDGE_INTERNAL',
            message: '资源打开响应格式非法',
            retryable: false,
          });
        }
        if (!response.ok) {
          throw ChipsError.fromPlain(response.error);
        }
        if (response.metadata === null) {
          throw new ChipsError({
            code: 'RESOURCE_NOT_FOUND',
            message: resourceErrorMessage('RESOURCE_NOT_FOUND'),
            retryable: false,
          });
        }
        return response.metadata as IResourceMetadata;
      })();
      try {
        metadata = await openPromise;
      } catch (error) {
        openPromise = null;
        throw normalizeError(error, {
          onDiagnostic: (cause) => {
            deps.onDiagnostic('资源打开失败', {
              uri,
              reason: cause instanceof Error ? cause.message : typeof cause,
            });
          },
        });
      }
    }
    return openPromise;
  };

  const mapFetchFailure = (status: number): ChipsError => {
    if (status === 403) {
      return new ChipsError({
        code: 'RESOURCE_PERMISSION_DENIED',
        message: resourceErrorMessage('RESOURCE_PERMISSION_DENIED'),
        retryable: false,
      });
    }
    if (status === 404) {
      return new ChipsError({
        code: 'RESOURCE_NOT_FOUND',
        message: resourceErrorMessage('RESOURCE_NOT_FOUND'),
        retryable: false,
      });
    }
    if (status === 413) {
      return new ChipsError({
        code: 'RESOURCE_TOO_LARGE',
        message: resourceErrorMessage('RESOURCE_TOO_LARGE'),
        retryable: false,
      });
    }
    if (status === 416) {
      return new ChipsError({
        code: 'RESOURCE_INVALID_URI',
        message: resourceErrorMessage('RESOURCE_INVALID_URI'),
        retryable: false,
      });
    }
    return new ChipsError({
      code: 'RESOURCE_NETWORK_FAILED',
      message: resourceErrorMessage('RESOURCE_NETWORK_FAILED'),
      retryable: true,
    });
  };

  const fetchBytes = async (headers?: Readonly<Record<string, string>>): Promise<Uint8Array> => {
    let response: Response;
    try {
      response = await fetchImpl(uri, headers === undefined ? {} : { headers });
    } catch (error) {
      throw new ChipsError({
        code: 'RESOURCE_NETWORK_FAILED',
        message: error instanceof Error ? error.message : resourceErrorMessage('RESOURCE_NETWORK_FAILED'),
        retryable: true,
      });
    }
    if (!response.ok) {
      throw mapFetchFailure(response.status);
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  };

  const handle: IResourceHandle = {
    uri,
    get state(): ResourceState {
      return currentState();
    },
    async metadata(): Promise<IResourceMetadata> {
      return ensureOpen();
    },
    async read(): Promise<Uint8Array> {
      const info = await ensureOpen();
      if (info.size > RESOURCE_INLINE_MAX_BYTES) {
        throw new ChipsError({
          code: 'RESOURCE_TOO_LARGE',
          message: resourceErrorMessage('RESOURCE_TOO_LARGE'),
          details: { size: info.size, maxBytes: RESOURCE_INLINE_MAX_BYTES },
          retryable: false,
        });
      }
      return fetchBytes();
    },
    async readRange(offset: number, length: number): Promise<Uint8Array> {
      assertReadable();
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length <= 0) {
        throw new ChipsError({ code: 'BRIDGE_INVALID_INPUT', message: '读取范围非法', retryable: false });
      }
      if (streamOpen) {
        throw new ChipsError({
          code: 'RESOURCE_BUSY',
          message: resourceErrorMessage('RESOURCE_BUSY'),
          retryable: true,
        });
      }
      await ensureOpen();
      let response: Response;
      const end = offset + length - 1;
      try {
        response = await fetchImpl(uri, { headers: { Range: `bytes=${offset}-${end}` } });
      } catch (error) {
        throw new ChipsError({
          code: 'RESOURCE_NETWORK_FAILED',
          message: error instanceof Error ? error.message : resourceErrorMessage('RESOURCE_NETWORK_FAILED'),
          retryable: true,
        });
      }
      if (!response.ok && response.status !== 206) {
        throw mapFetchFailure(response.status);
      }
      const buffer = new Uint8Array(await response.arrayBuffer());
      if (response.status === 206) {
        return buffer;
      }
      return buffer.subarray(offset, Math.min(offset + length, buffer.byteLength));
    },
    async stream(): Promise<ReadableStream<Uint8Array>> {
      assertReadable();
      if (streamOpen) {
        throw new ChipsError({
          code: 'RESOURCE_BUSY',
          message: resourceErrorMessage('RESOURCE_BUSY'),
          retryable: true,
        });
      }
      await ensureOpen();
      let response: Response;
      try {
        response = await fetchImpl(uri);
      } catch (error) {
        throw new ChipsError({
          code: 'RESOURCE_NETWORK_FAILED',
          message: error instanceof Error ? error.message : resourceErrorMessage('RESOURCE_NETWORK_FAILED'),
          retryable: true,
        });
      }
      if (!response.ok) {
        throw mapFetchFailure(response.status);
      }
      const body = response.body;
      if (body === null) {
        throw new ChipsError({
          code: 'RESOURCE_NOT_SUPPORTED',
          message: resourceErrorMessage('RESOURCE_NOT_SUPPORTED'),
          retryable: false,
        });
      }
      streamOpen = true;
      const reader = body.getReader();
      return new ReadableStream<Uint8Array>({
        async pull(controller): Promise<void> {
          try {
            const { done, value } = await reader.read();
            if (done) {
              streamOpen = false;
              controller.close();
              return;
            }
            controller.enqueue(value);
          } catch (error) {
            streamOpen = false;
            controller.error(error);
          }
        },
        async cancel(reason): Promise<void> {
          streamOpen = false;
          await reader.cancel(reason);
        },
      });
    },
    release(): void {
      if (released) {
        return;
      }
      released = true;
      invalidateHandlers.clear();
      if (metadata === null && openPromise === null) {
        return;
      }
      const requestId = deps.generateRequestId();
      void deps.transport
        .invoke(BRIDGE_RESOURCE_CHANNEL, { requestId, operation: 'release', uri })
        .catch((error: unknown) => {
          deps.onDiagnostic('资源句柄释放请求失败', {
            uri,
            reason: error instanceof Error ? error.message : typeof error,
          });
        });
    },
    onInvalidate(handler: (reason: ResourceInvalidateReason) => void): ISubscription {
      if (released || typeof handler !== 'function') {
        return {
          dispose(): void {
            return;
          },
        };
      }
      invalidateHandlers.add(handler);
      const registration = deps.invalidations.register(uri, (reason) => {
        if (released || invalidated) {
          return;
        }
        invalidated = true;
        for (const callback of [...invalidateHandlers]) {
          try {
            callback(reason);
          } catch (error) {
            deps.onDiagnostic('资源失效处理器抛出异常', {
              uri,
              reason: error instanceof Error ? error.message : typeof error,
            });
          }
        }
      });
      let disposed = false;
      return {
        dispose: () => {
          if (disposed) {
            return;
          }
          disposed = true;
          invalidateHandlers.delete(handler);
          registration.dispose();
        },
      };
    },
  };

  return handle;
}
