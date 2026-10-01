/**
 * 平台内置能力域：`event:publish`（04-能力契约规范 §7.13、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.13（eventId 文法；payload 结构化克隆兼容、序列化后 ≤ 256 KiB；
 * 发布者身份由 Bridge 在调用点绑定插件 ID，不取自参数；平台保留域拒绝发布）、
 * §6.2（`events:publish`）、`09-事件系统设计` §3.4（`EVENT_*` 错误码）、
 * `05-事件契约规范` §2.1/§2.2/§2.3/§6（事件 ID 结构、保留域清单、插件自有域默认与
 * 插件 ID 末段一致、发布规则）。
 *
 * @remarks
 * - 本域无 PAL 端口：发布经调用上下文 `ctx.emit` 投递到调用方会话所在窗口（按订阅计数生效）。
 *   跨会话/跨进程投递与命名空间登记表归内核事件总线正式面（09 §3.3 白名单转发），
 *   本域按契约默认规则执行命名空间归属判定，内核总线交付后由其收口权威判定。
 * - 命名空间归属（05 §2.3）：非保留域的 `<domain>` 必须与调用方插件 ID 末段一致（默认规则）；
 *   保留域（§2.2 清单）仅平台会话（callerId `platform`）可发布，其余一律 `EVENT_PUBLISH_DENIED`。
 * - payload 深度校验：含函数 / 符号或循环引用即 `EVENT_PAYLOAD_UNSUPPORTED`；
 *   JSON 序列化后超过 256 KiB 即 `EVENT_PAYLOAD_TOO_LARGE`（§3.4 载荷约束）。
 * - 事件只作通知、不承担请求-响应语义（§6.4）；请求成功表示已发布到总线，不表示已被投递。
 */

import { Buffer } from 'node:buffer';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import { jsonValueField, readInputRecord, requireStringField } from './system-service-common.js';

/** 内置 `event:publish` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const EVENT_CAPABILITY_IDS = {
  publish: 'event:publish',
} as const;

/** 事件域权限 ID（R19 §6.2：`events:publish`）。 */
export const EVENT_PERMISSION_IDS = {
  publish: 'events:publish',
} as const;

/** 输入 JSON Schema（逐字镜像 §7.13 `eventInputSchemas`）。 */
export const EVENT_INPUT_SCHEMAS: Readonly<Record<'event:publish', Readonly<Record<string, unknown>>>> = {
  'event:publish': {
    type: 'object',
    additionalProperties: false,
    required: ['eventId', 'payload'],
    properties: {
      eventId: { type: 'string', pattern: '^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$' },
      payload: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
    },
  },
};

/** 事件 ID 文法（05-事件契约规范 §2.1，区分大小写逐字对齐）。 */
const EVENT_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;

/** 平台保留域（05-事件契约规范 §2.2 清单；`internal` 为内核内部域，一并拒绝插件发布）。 */
const RESERVED_DOMAINS: ReadonlySet<string> = new Set([
  'plugin',
  'document',
  'file',
  'resource',
  'config',
  'security',
  'permission',
  'window',
  'app',
  'sync',
  'command',
  'tray',
  'shortcut',
  'transfer',
  'internal',
]);

/** payload 序列化上限（§7.13：256 KiB）。 */
const PAYLOAD_MAX_BYTES = 256 * 1024;

/** 平台会话调用方标识（路由会话归属口径；`IHostSession.pluginId` 平台会话取值）。 */
const PLATFORM_CALLER_ID = 'platform';

/** 构造事件域结构化错误（09-事件系统设计 §3.4 已登记码；`details` 不含载荷原文）。 */
function eventDomainError(code: string, capabilityId: string, reason: string): Error & { retryable: false } {
  return Object.assign(new Error('事件发布被拒绝'), {
    code,
    retryable: false as const,
    details: { capabilityId, reason },
  });
}

/** 判断值可结构化克隆（函数与符号成员不可克隆；循环引用不可序列化，一并拒绝）。 */
function isStructuredCloneCompatible(value: unknown, seen: Set<object>): boolean {
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return false;
  }
  if (typeof value !== 'object' || value === null) {
    return true;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.every((item) => isStructuredCloneCompatible(item, seen));
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer || value instanceof Date) {
    seen.delete(value);
    return true;
  }
  const compatible = Object.values(value).every((item) => isStructuredCloneCompatible(item, seen));
  seen.delete(value);
  return compatible;
}

/**
 * 构造内置 `event:publish` 能力注册条目。
 *
 * @remarks 事件域无 PAL 端口、无独立分面（发布经调用上下文 `ctx.emit` 投递），平台内置域恒在册；
 * 装配形制与其余域一致，由组合根清单拼接。
 */
export function createEventCapabilities(): readonly IHostCapabilityDescriptor[] {
  const publish: IHostCapabilityDescriptor = {
    id: EVENT_CAPABILITY_IDS.publish,
    permissions: [EVENT_PERMISSION_IDS.publish],
    schema: EVENT_INPUT_SCHEMAS['event:publish'],
    targets: [],
    concurrency: 'parallel',
    handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(EVENT_CAPABILITY_IDS.publish, input, ['eventId', 'payload']);
      const eventId = requireStringField(EVENT_CAPABILITY_IDS.publish, record, 'eventId');
      if (!EVENT_ID_PATTERN.test(eventId)) {
        throw eventDomainError(
          'EVENT_ID_INVALID',
          EVENT_CAPABILITY_IDS.publish,
          'eventId 必须匹配 ^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$',
        );
      }
      const payload = jsonValueField(EVENT_CAPABILITY_IDS.publish, record, 'payload');
      if (!isStructuredCloneCompatible(payload, new Set())) {
        throw eventDomainError(
          'EVENT_PAYLOAD_UNSUPPORTED',
          EVENT_CAPABILITY_IDS.publish,
          'payload 含不可结构化克隆的成员',
        );
      }
      let serialized: string;
      try {
        serialized = JSON.stringify(payload) ?? 'null';
      } catch {
        throw eventDomainError(
          'EVENT_PAYLOAD_UNSUPPORTED',
          EVENT_CAPABILITY_IDS.publish,
          'payload 不可序列化（循环引用）',
        );
      }
      if (Buffer.byteLength(serialized, 'utf-8') > PAYLOAD_MAX_BYTES) {
        throw eventDomainError(
          'EVENT_PAYLOAD_TOO_LARGE',
          EVENT_CAPABILITY_IDS.publish,
          'payload 序列化后不得超过 262144 字节',
        );
      }
      const domain = eventId.slice(0, eventId.indexOf(':'));
      if (RESERVED_DOMAINS.has(domain)) {
        // 保留域只允许平台发布（05 §2.2）；发布者身份取调用点绑定，不取自输入。
        if (ctx.callerId !== PLATFORM_CALLER_ID) {
          throw eventDomainError(
            'EVENT_PUBLISH_DENIED',
            EVENT_CAPABILITY_IDS.publish,
            `保留域 ${domain} 不允许插件发布`,
          );
        }
      } else {
        // 插件自有域默认与插件 ID 末段一致（05 §2.3）；命名空间登记表归内核事件总线正式面。
        const ownDomain = ctx.callerId.slice(ctx.callerId.lastIndexOf('.') + 1);
        if (ctx.callerId !== PLATFORM_CALLER_ID && domain !== ownDomain) {
          throw eventDomainError('EVENT_PUBLISH_DENIED', EVENT_CAPABILITY_IDS.publish, '事件域越出自有命名空间');
        }
      }
      ctx.emit(eventId, payload);
      return Promise.resolve(undefined);
    },
  };
  return [publish];
}
