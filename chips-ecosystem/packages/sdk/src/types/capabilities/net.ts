/**
 * 网络、传输、配置、凭证与事件能力契约类型（04-能力契约规范 §7.10–§7.13、§7.15）。
 */

import type { ConfigLayer, ConfigWriteScope } from '../config.js';

// === 网络 http:request（§7.10） ===

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export interface IHttpRequestInput {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  /** 请求体字节，上限 8 MiB。 */
  body?: Uint8Array;
}

export interface IHttpRequestOutput {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
}

// === 传输 transfer:*（§7.15） ===

export interface ITransferDownloadInput {
  url: string;
  target: string;
  /** 期望摘要，`sha256:<hex>`。 */
  expectedDigest?: string;
  overwrite?: boolean;
}

export interface ITransferDownloadOutput {
  transferId: string;
}

export interface ITransferCancelInput {
  transferId: string;
}

// === 配置 config:*（§7.11） ===

export interface IConfigGetInput {
  namespace: string;
  key: string;
}

export interface IConfigGetOutput {
  key: string;
  value: unknown;
  layer: ConfigLayer;
  isDefault: boolean;
}

export interface IConfigSnapshotInput {
  namespace: string;
  prefix: string;
}

export interface IConfigSnapshotOutput {
  values: Record<string, unknown>;
}

export interface IConfigSetInput {
  namespace: string;
  key: string;
  value: unknown;
  scope: ConfigWriteScope;
}

export interface IConfigResetInput {
  namespace: string;
  keys: string[];
  scope: ConfigWriteScope;
}

// === 凭证 credential:*（§7.12） ===

export interface ICredentialGetInput {
  name: string;
}

export interface ICredentialGetOutput {
  name: string;
  value: string;
}

export interface ICredentialSetInput {
  name: string;
  value: string;
}

export interface ICredentialDeleteInput {
  name: string;
}

// === 事件 event:publish（§7.13） ===

export interface IEventPublishInput {
  eventId: string;
  payload: unknown;
}
