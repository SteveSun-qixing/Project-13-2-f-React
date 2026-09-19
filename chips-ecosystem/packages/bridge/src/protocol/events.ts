/**
 * 事件契约（05-事件契约规范 §2、§3、§4、§8）。
 *
 * 事件 ID：`<domain>:<action>`，只允许一个冒号；事件表示"某事已经发生"的不可变通知。
 * 只有本文登记的标准事件允许跨进程转发；`internal:*` 与插件自有域事件不进入本登记表。
 */

import type { IChipsError } from './errors.js';

/** 事件 ID 校验正则（05-事件契约规范 §2.1）。 */
export const EVENT_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;

export function isValidEventId(value: string): boolean {
  return EVENT_ID_PATTERN.test(value);
}

/**
 * 事件可见性规则：
 * - `public`：对活跃插件开放；
 * - `platform`：仅平台与官方审计界面，插件不可订阅；
 * - `plugin-field`：目标插件标识位于 payload 指定字段（`null` 表示平台侧，不对插件投递）；
 * - `config-namespace`：按 `payload.key` 命名空间判定（`platform` 需 `config:read:platform`，`plugins.<id>` 仅该插件）；
 * - `owner-lookup`：归属查询类定向事件，由宿主注入的解析器按服务所有权判定（fail-closed）。
 */
export type EventVisibility =
  | { readonly kind: 'public' }
  | { readonly kind: 'platform' }
  | { readonly kind: 'plugin-field'; readonly field: string }
  | { readonly kind: 'config-namespace' }
  | { readonly kind: 'owner-lookup'; readonly scope: 'command' | 'tray' | 'shortcut' | 'transfer' };

export interface IStandardEventDefinition {
  readonly id: string;
  readonly visibility: EventVisibility;
}

const PUBLIC: EventVisibility = { kind: 'public' };

/** 标准事件登记表（05-事件契约规范 §4 全表，39 项）。 */
export const STANDARD_EVENTS: readonly IStandardEventDefinition[] = [
  { id: 'plugin:installed', visibility: PUBLIC },
  { id: 'plugin:loaded', visibility: PUBLIC },
  { id: 'plugin:enabled', visibility: PUBLIC },
  { id: 'plugin:disabled', visibility: PUBLIC },
  { id: 'plugin:failed', visibility: PUBLIC },
  { id: 'plugin:unloaded', visibility: PUBLIC },
  { id: 'plugin:uninstalled', visibility: PUBLIC },
  { id: 'document:opened', visibility: PUBLIC },
  { id: 'document:changed', visibility: PUBLIC },
  { id: 'document:saved', visibility: PUBLIC },
  { id: 'document:closed', visibility: PUBLIC },
  { id: 'file:changed', visibility: PUBLIC },
  { id: 'resource:invalidated', visibility: PUBLIC },
  { id: 'resource:opened', visibility: { kind: 'plugin-field', field: 'pluginId' } },
  { id: 'config:changed', visibility: { kind: 'config-namespace' } },
  { id: 'security:audit', visibility: { kind: 'platform' } },
  { id: 'permission:granted', visibility: { kind: 'plugin-field', field: 'pluginId' } },
  { id: 'permission:denied', visibility: { kind: 'plugin-field', field: 'pluginId' } },
  { id: 'window:created', visibility: PUBLIC },
  { id: 'window:closed', visibility: PUBLIC },
  { id: 'window:focused', visibility: PUBLIC },
  { id: 'app:launched', visibility: PUBLIC },
  { id: 'app:exited', visibility: PUBLIC },
  { id: 'app:opened-with-url', visibility: PUBLIC },
  { id: 'sync:progress', visibility: PUBLIC },
  { id: 'sync:state-changed', visibility: PUBLIC },
  { id: 'sync:conflict-detected', visibility: PUBLIC },
  { id: 'sync:conflict-resolved', visibility: PUBLIC },
  { id: 'sync:queue-changed', visibility: PUBLIC },
  { id: 'sync:blocked', visibility: PUBLIC },
  { id: 'command:registered', visibility: PUBLIC },
  { id: 'command:unregistered', visibility: PUBLIC },
  { id: 'command:changed', visibility: PUBLIC },
  { id: 'command:invoked', visibility: { kind: 'owner-lookup', scope: 'command' } },
  { id: 'tray:clicked', visibility: { kind: 'owner-lookup', scope: 'tray' } },
  { id: 'shortcut:triggered', visibility: { kind: 'owner-lookup', scope: 'shortcut' } },
  { id: 'transfer:progress', visibility: { kind: 'owner-lookup', scope: 'transfer' } },
  { id: 'transfer:completed', visibility: { kind: 'owner-lookup', scope: 'transfer' } },
  { id: 'transfer:failed', visibility: { kind: 'owner-lookup', scope: 'transfer' } },
];

const EVENT_BY_ID: ReadonlyMap<string, IStandardEventDefinition> = new Map(
  STANDARD_EVENTS.map((definition) => [definition.id, definition]),
);

export function findStandardEvent(eventId: string): IStandardEventDefinition | undefined {
  return EVENT_BY_ID.get(eventId);
}

export function isStandardEvent(eventId: string): boolean {
  return EVENT_BY_ID.has(eventId);
}

/** 事件载荷序列化后上限：256 KiB（05-事件契约规范 §3.4）。 */
export const EVENT_PAYLOAD_MAX_BYTES = 256 * 1024;

/** 事件域错误码（05-事件契约规范 §8）。 */
export const EVENT_ERROR_CODES = {
  idInvalid: 'EVENT_ID_INVALID',
  notRegistered: 'EVENT_NOT_REGISTERED',
  subscribeDenied: 'EVENT_SUBSCRIBE_DENIED',
  publishDenied: 'EVENT_PUBLISH_DENIED',
  payloadUnsupported: 'EVENT_PAYLOAD_UNSUPPORTED',
  payloadTooLarge: 'EVENT_PAYLOAD_TOO_LARGE',
  depthExceeded: 'KERNEL_EVENT_DEPTH_EXCEEDED',
} as const;

/** 跨进程事件封套（02-Bridge三层设计 §7.2、05-事件契约规范 §3.3）。 */
export interface IEventEnvelope {
  eventId: string;
  payload: unknown;
  /** 事件产生时间，Unix epoch 毫秒。 */
  emittedAt: number;
}

export type EventControlAction = 'subscribe' | 'unsubscribe';

export interface IEventControlRequest {
  controlId: string;
  action: EventControlAction;
  eventId: string;
}

export type IEventControlResponse =
  | { controlId: string; ok: true }
  | { controlId: string; ok: false; error: IChipsError };
