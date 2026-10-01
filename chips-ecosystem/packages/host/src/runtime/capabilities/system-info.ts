/**
 * 平台内置能力：`system:info`（04-能力契约规范 §7.14、02-Bridge三层设计 §4.1）。
 *
 * 权威：`04-能力契约规范` §7.14（`system:info` 输出 `SystemInfo`、失败 `SYSTEM_INFO_UNAVAILABLE`），
 * `17-跨端Shell与平台抽象设计` §3.4（系统信息经 PAL `system` 端口读取）。
 *
 * @remarks
 * - 这是组合根默认装配的内置能力：证明运行时**已按清单注册并可返回真实响应**，替代旧的空壳统一
 *   `BRIDGE_CAPABILITY_NOT_FOUND`（P0-1 交付点 1）。
 * - 平台内置能力对平台自身免权限（08 §4.4），故 `permissions` 为空；处理器直连 PAL `system` 端口。
 * - PAL `system` 端口缺位或读取失败时抛 `SYSTEM_INFO_UNAVAILABLE`（不返回残缺快照），由路由归一为结构化错误。
 * - 本文件同时承载组合根内置能力清单组装（`createBuiltinCapabilities`）：G6 系统服务族各域
 *   （dialog / clipboard / notification / shell / http / power / transfer / menu / tray /
 *   shortcut / config / event）按分面闸拼接进清单，域实现各自成模块。
 */

import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import { createClipboardCapabilities } from './clipboard.js';
import { createConfigCapabilities } from './config.js';
import { createDialogCapabilities } from './dialog.js';
import { createEventCapabilities } from './event.js';
import { createHttpCapabilities } from './http.js';
import { createMenuCapabilities } from './menu.js';
import { createNotificationCapabilities } from './notification.js';
import { createPowerCapabilities } from './power.js';
import { createShellCapabilities } from './shell.js';
import { createShortcutCapabilities } from './shortcut.js';
import { createTransferCapabilities } from './transfer.js';
import { createTrayCapabilities } from './tray.js';

/** 内置 `system:info` 能力 ID（单一事实源常量）。 */
export const SYSTEM_INFO_CAPABILITY_ID = 'system:info';

/** 系统信息不可用错误码（04 §7.14）。 */
const SYSTEM_INFO_UNAVAILABLE = 'SYSTEM_INFO_UNAVAILABLE';

/** 构造内置 `system:info` 能力注册条目。 */
export function createSystemInfoCapability(host: IPalHost): IHostCapabilityDescriptor {
  return {
    id: SYSTEM_INFO_CAPABILITY_ID,
    permissions: [],
    timeoutMs: 2000,
    concurrency: 'parallel',
    async handler(_input: unknown, ctx): Promise<unknown> {
      const system = host.ports.system;
      if (system === undefined) {
        throw Object.assign(new Error('系统信息端口不可用'), {
          code: SYSTEM_INFO_UNAVAILABLE,
          retryable: true,
        });
      }
      return system.getInfo({ signal: ctx.signal, deadline: ctx.deadline });
    },
  };
}

/**
 * 组合根内置能力清单（宿主 PAL 就绪后可注册的内置单元）。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §5.1/§5.2——分面由矩阵声明，分面为 `false` 的能力域
 * 整体不注册（调用得到真实注册表未命中语义），分面在册而环境不可用时仍注册、由端口返回
 * 正式域错误码。事件域无端口分面，恒在册。
 *
 * @param host 已通过壳自检的 PAL 宿主。
 * @returns 内置能力描述符数组；文档等外部能力由提供方经组合根注入点附加。
 */
export function createBuiltinCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  return [
    createSystemInfoCapability(host),
    ...createDialogCapabilities(host),
    ...createClipboardCapabilities(host),
    ...createNotificationCapabilities(host),
    ...createShellCapabilities(host),
    // G6 第二批（W4 勘查派单表序）：http → power → transfer → desktop-shell（menu/tray/shortcut）
    // → config → event。
    ...createHttpCapabilities(host),
    ...createPowerCapabilities(host),
    ...createTransferCapabilities(host),
    ...createMenuCapabilities(host),
    ...createTrayCapabilities(host),
    ...createShortcutCapabilities(host),
    ...createConfigCapabilities(host),
    ...createEventCapabilities(),
  ];
}
