/**
 * 资源句柄模型（01-Bridge-API规范 §2.4、02-Bridge三层设计 §10）。
 */

import type { ISubscription } from './bridge.js';
import type { IChipsError } from './errors.js';

export type ResourceScope =
  'workspace' | 'document' | 'plugin' | 'platform' | 'external' | 'temporary' | 'memory';

export type ResourceState = 'open' | 'invalidated' | 'released';

export type ResourceInvalidateReason = 'source-changed' | 'session-closed' | 'scope-revoked';

export interface IResourceMetadata {
  uri: string;
  size: number;
  mimeType: string;
  version: string;
  scope: ResourceScope;
}

/** `read()` 单次上限：8 MiB（超出返回 `RESOURCE_TOO_LARGE`，改用 `readRange()` / `stream()`）。 */
export const RESOURCE_READ_MAX_BYTES = 8 * 1024 * 1024;

export interface IResourceHandle {
  /** 创建句柄时的原始 URI。 */
  readonly uri: string;
  readonly state: ResourceState;
  /** 读取元数据；首次调用触发主进程 `open`。 */
  metadata(): Promise<IResourceMetadata>;
  /** 读取完整字节；超过 8 MiB 返回 `RESOURCE_TOO_LARGE`。 */
  read(): Promise<Uint8Array>;
  /** 按偏移读取；与 `stream()` 互斥。 */
  readRange(offset: number, length: number): Promise<Uint8Array>;
  /** 流式读取大资源。 */
  stream(): ReadableStream<Uint8Array>;
  /** 释放句柄；幂等；`released` 后除 `uri` / `state` / `release()` 外的方法返回 `RESOURCE_HANDLE_RELEASED`。 */
  release(): void;
  /** 订阅失效通知；返回可退订句柄。 */
  onInvalidate(handler: (reason: ResourceInvalidateReason) => void): ISubscription;
}

/** 资源域错误码（01-Bridge-API规范 §2.4、06-资源协议规范 §7）。 */
export const RESOURCE_ERROR_CODES = {
  invalidUri: 'RESOURCE_INVALID_URI',
  unsupportedScheme: 'RESOURCE_UNSUPPORTED_SCHEME',
  notFound: 'RESOURCE_NOT_FOUND',
  pathInvalid: 'RESOURCE_PATH_INVALID',
  permissionDenied: 'RESOURCE_PERMISSION_DENIED',
  tooLarge: 'RESOURCE_TOO_LARGE',
  busy: 'RESOURCE_BUSY',
  handleReleased: 'RESOURCE_HANDLE_RELEASED',
  handleInvalidated: 'RESOURCE_HANDLE_INVALIDATED',
  poolExhausted: 'RESOURCE_POOL_EXHAUSTED',
} as const;

/** 资源控制 IPC 操作（02-Bridge三层设计 §7.2）。 */
export type ResourceControlOperation = 'open' | 'release';

export interface IResourceControlRequest {
  requestId: string;
  operation: ResourceControlOperation;
  uri: string;
}

export type IResourceControlResponse =
  | { requestId: string; ok: true; metadata: IResourceMetadata | null }
  | { requestId: string; ok: false; error: IChipsError };
