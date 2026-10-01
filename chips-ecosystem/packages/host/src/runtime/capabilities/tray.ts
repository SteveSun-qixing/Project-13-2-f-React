/**
 * 平台内置能力域：`tray:set`（04-能力契约规范 §7.9、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.9（未创建时按首次调用创建托盘图标；`iconUri` 为
 * `chips-resource://` 受管引用）、§6.2（`tray:manage`；仅 `app` 角色可持有，08 §6.3）、
 * §11.4（`TRAY_SET_FAILED` / `TRAY_ICON_INVALID`），`05-事件契约规范` §4.10（`tray:clicked`），
 * `17-跨端Shell与平台抽象设计` §5.1/§5.2（分面闸）、§4.2 规则 2（端口调用上下文）。
 *
 * @remarks
 * - 处理器直连 PAL `tray` 端口，能力模块不感知 Electron。
 * - `iconUri` 语法闸复用协议域在册校验链（`protocol/resource-uri.ts`）；受管引用 → 本地图标
 *   路径的物化属资源域正式绑定面（与 `notification:send` 的 `iconUri` 同一通道，工单068 在册）：
 *   解析通道在册前，携带 `iconUri` 的调用按 SB-5 fail-closed 以 `TRAY_ICON_INVALID` 拒绝，
 *   不伪造"无图标设置成功"。
 * - 托盘点击信号由本域订阅端口 `onClicked`（单订阅）并向设置托盘的会话所在窗口发布
 *   `tray:clicked`（载荷 `button`，§4.10）；跨会话/跨进程投递归内核事件总线正式面。
 */

import { parseResourceUri } from '../../protocol/resource-uri.js';
import type { IPalHost, TrayClickButton } from '../../platform/contracts/index.js';
import type { IHostCapabilityContext, IHostCapabilityDescriptor } from '../capability/contracts.js';
import {
  isFacetReady,
  optionalBooleanField,
  optionalStringField,
  readInputRecord,
  systemServiceInputError,
  toPortCall,
} from './system-service-common.js';

/** 内置 `tray:set` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const TRAY_CAPABILITY_IDS = {
  set: 'tray:set',
} as const;

/** 托盘域权限 ID（R19 §6.2：`tray:manage`）。 */
export const TRAY_PERMISSION_IDS = {
  manage: 'tray:manage',
} as const;

/** 输入 JSON Schema（逐字镜像 §7.9 `integrationInputSchemas` 的 tray 项）。 */
export const TRAY_INPUT_SCHEMAS: Readonly<Record<'tray:set', Readonly<Record<string, unknown>>>> = {
  'tray:set': {
    type: 'object',
    additionalProperties: false,
    properties: {
      iconUri: { type: 'string', format: 'chips-resource-uri' },
      tooltip: { type: 'string', maxLength: 128 },
      visible: { type: 'boolean', default: true },
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

/**
 * 构造内置 `tray:set` 能力注册条目（分面缺位时返回空数组，整体不注册）。
 *
 * @param host 已通过壳自检的 PAL 宿主。
 */
export function createTrayCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  if (!isFacetReady(host.matrix, host.ports, 'tray')) {
    return [];
  }
  const tray = host.ports.tray!;

  /** 最近一次成功设置托盘的会话上下文（点击事件向该会话所在窗口投递，§4.10 可见性）。 */
  let ownerContext: IHostCapabilityContext | undefined;
  /** 点击信号单订阅（端口生命周期内存续；首次成功设置时建立）。 */
  let clickSubscription: { dispose(): void } | null = null;

  const set: IHostCapabilityDescriptor = {
    id: TRAY_CAPABILITY_IDS.set,
    permissions: [TRAY_PERMISSION_IDS.manage],
    schema: TRAY_INPUT_SCHEMAS['tray:set'],
    targets: [],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(TRAY_CAPABILITY_IDS.set, input, ['iconUri', 'tooltip', 'visible']);
      const tooltip = optionalStringField(TRAY_CAPABILITY_IDS.set, record, 'tooltip', { maxLength: 128 });
      const visible = optionalBooleanField(TRAY_CAPABILITY_IDS.set, record, 'visible');
      const rawIconUri = optionalStringField(TRAY_CAPABILITY_IDS.set, record, 'iconUri');
      if (rawIconUri !== null) {
        // 受管图标引用的本地物化通道归资源域正式绑定面（工单068）：通道在册前 fail-closed，
        // 不降级为无图标设置（SB-5 禁伪造成功）。
        requireManagedResourceUri(TRAY_CAPABILITY_IDS.set, rawIconUri);
        throw Object.assign(new Error('托盘图标资源解析通道未就绪'), {
          code: 'TRAY_ICON_INVALID',
          retryable: false,
          details: { capabilityId: TRAY_CAPABILITY_IDS.set, reason: 'iconUri 物化通道未接线（工单068）' },
        });
      }
      await tray.set({
        ...toPortCall(ctx),
        ...(tooltip !== null ? { tooltip } : {}),
        ...(visible !== null ? { visible } : {}),
      });
      ownerContext = ctx;
      if (clickSubscription === null) {
        clickSubscription = tray.onClicked((button: TrayClickButton): void => {
          ownerContext?.emit('tray:clicked', { button });
        });
      }
      return undefined;
    },
  };
  return [set];
}
