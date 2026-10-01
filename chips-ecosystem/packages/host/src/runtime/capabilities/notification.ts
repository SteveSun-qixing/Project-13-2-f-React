/**
 * 平台内置能力域：`notification:send`（04-能力契约规范 §7.5、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.5（title 必填；`iconUri` 为 `chips-resource://` 受管引用；
 * 系统通知不可用返回 `NOTIFICATION_UNAVAILABLE`）、§6.2（`notifications:send`）、
 * §11.4（`NOTIFICATION_FAILED`），`17-跨端Shell与平台抽象设计` §5.1/§5.2（分面闸；
 * 分面在册而环境不可用时能力仍注册、返回域错误码）、§4.3（能力层职责）。
 *
 * @remarks
 * - 处理器直连 PAL `notification` 端口（端口收 `iconPath` 本地路径，不感知资源协议）。
 * - `iconUri` 语法闸复用协议域在册校验链（`protocol/resource-uri.ts`，与协议处理器、preload
 *   预检同一实现）；受管引用 → 本地图标路径的物化属资源域正式绑定面（作用域注册表与
 *   PathGuard 归核心，工单068 在册）：解析通道在册前，携带 `iconUri` 的调用按 SB-5
 *   fail-closed 以 `NOTIFICATION_FAILED` 拒绝，不伪造"无图标发送成功"。
 * - 通知内容不得包含凭证材料与未脱敏用户数据（§7.5 约束）：本域不落日志、不写审计原文。
 */

import { parseResourceUri } from '../../protocol/resource-uri.js';
import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import {
  isFacetReady,
  optionalBooleanField,
  optionalStringField,
  readInputRecord,
  requireStringField,
  systemServiceInputError,
  toPortCall,
} from './system-service-common.js';

/** 内置 `notification:send` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const NOTIFICATION_CAPABILITY_IDS = {
  send: 'notification:send',
} as const;

/** 通知域权限 ID（R19 §6.2：`notifications:send`）。 */
export const NOTIFICATION_PERMISSION_IDS = {
  send: 'notifications:send',
} as const;

/** 输入 JSON Schema（逐字镜像 §7.5 `notificationInputSchemas`）。 */
export const NOTIFICATION_INPUT_SCHEMAS: Readonly<Record<'notification:send', Readonly<Record<string, unknown>>>> = {
  'notification:send': {
    type: 'object',
    additionalProperties: false,
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 128 },
      body: { type: 'string', maxLength: 1024 },
      iconUri: { type: 'string', format: 'chips-resource-uri' },
      silent: { type: 'boolean', default: false },
    },
  },
};

/** `chips-resource-uri` 格式闸：必须是语法合法的 `chips-resource://` 规范引用。 */
function requireManagedResourceUri(capabilityId: string, uri: string): string {
  if (!parseResourceUri(uri).ok) {
    throw systemServiceInputError(capabilityId, 'iconUri 必须是 chips-resource:// 规范引用');
  }
  return uri;
}

/** 构造内置 `notification:send` 能力注册条目（分面缺位时返回空数组，整体不注册）。 */
export function createNotificationCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  if (!isFacetReady(host.matrix, host.ports, 'notification')) {
    return [];
  }
  const notification = host.ports.notification!;
  const send: IHostCapabilityDescriptor = {
    id: NOTIFICATION_CAPABILITY_IDS.send,
    permissions: [NOTIFICATION_PERMISSION_IDS.send],
    schema: NOTIFICATION_INPUT_SCHEMAS['notification:send'],
    targets: [],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(NOTIFICATION_CAPABILITY_IDS.send, input, ['title', 'body', 'iconUri', 'silent']);
      const title = requireStringField(NOTIFICATION_CAPABILITY_IDS.send, record, 'title', {
        minLength: 1,
        maxLength: 128,
      });
      const body = optionalStringField(NOTIFICATION_CAPABILITY_IDS.send, record, 'body', { maxLength: 1024 });
      const silent = optionalBooleanField(NOTIFICATION_CAPABILITY_IDS.send, record, 'silent');
      const rawIconUri = optionalStringField(NOTIFICATION_CAPABILITY_IDS.send, record, 'iconUri');
      const call = toPortCall(ctx);
      if (rawIconUri !== null) {
        // 受管图标引用的本地物化通道归资源域正式绑定面（工单068）：通道在册前 fail-closed，
        // 不降级为无图标发送（SB-5 禁伪造成功）。
        requireManagedResourceUri(NOTIFICATION_CAPABILITY_IDS.send, rawIconUri);
        throw Object.assign(new Error('通知图标资源解析通道未就绪'), {
          code: 'NOTIFICATION_FAILED',
          retryable: true,
          details: { capabilityId: NOTIFICATION_CAPABILITY_IDS.send, reason: 'iconUri 物化通道未接线（工单068）' },
        });
      }
      await notification.send({
        ...call,
        title,
        ...(body === null ? {} : { body }),
        ...(silent === null ? {} : { silent }),
      });
      return undefined;
    },
  };
  return [send];
}
