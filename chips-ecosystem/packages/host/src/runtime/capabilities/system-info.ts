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
 */

import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';

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
 * @param host 已通过壳自检的 PAL 宿主。
 * @returns 内置能力描述符数组；文档等外部能力由提供方经组合根注入点附加。
 */
export function createBuiltinCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  return [createSystemInfoCapability(host)];
}
