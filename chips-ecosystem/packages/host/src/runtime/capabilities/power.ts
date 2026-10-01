/**
 * 平台内置能力域：`power:query` / `power:prevent-sleep`（04-能力契约规范 §7.14、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.14（`power:query` 输出电源快照、无电池 `batteryLevel` 为 `null`；
 * `power:prevent-sleep` 抑制句柄绑定调用方会话，插件停止、会话销毁或超时自动释放）、
 * §6.2（`power:read` / `power:manage`；`power:manage` 仅 `app` 角色可持有，08 §6.3）、
 * §11.4（`POWER_INFO_UNAVAILABLE` / `POWER_PREVENT_SLEEP_FAILED`），
 * `17-跨端Shell与平台抽象设计` §5.1/§5.2（分面闸）、§4.2 规则 2（端口调用上下文）。
 *
 * @remarks
 * - 处理器直连 PAL `power` 端口，能力模块不感知 Electron；端口只接受最终开关状态，
 *   按会话引用计数与自动释放由本域承担（端口契约备注）。
 * - 会话绑定：`enabled` 请求按 `ctx.sessionId` 记账，会话信号（`ctx.sessionSignal`；测试替身
 *   缺省回退 `ctx.signal`）中止时自动释放该会话的记账，全部会话退出后向端口下发最终关闭。
 * - 抑制期间的审计说明（§7.14 约束）随 `reason` 经端口选项如实传递、由权限审计链
 *   （工单046 波次）采集调用与放行记录；本域不落日志原文。
 */

import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import {
  isFacetReady,
  optionalStringField,
  readInputRecord,
  requireBooleanField,
  toPortCall,
} from './system-service-common.js';

/** 内置 `power:*` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const POWER_CAPABILITY_IDS = {
  query: 'power:query',
  preventSleep: 'power:prevent-sleep',
} as const;

/** 电源域权限 ID（R19 §6.2：`power:read` / `power:manage`）。 */
export const POWER_PERMISSION_IDS = {
  read: 'power:read',
  manage: 'power:manage',
} as const;

/** 输入 JSON Schema（逐字镜像 §7.14 `systemPowerInputSchemas` 的 power 项）。 */
export const POWER_INPUT_SCHEMAS: Readonly<
  Record<'power:query' | 'power:prevent-sleep', Readonly<Record<string, unknown>>>
> = {
  'power:query': {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
  'power:prevent-sleep': {
    type: 'object',
    additionalProperties: false,
    required: ['enabled'],
    properties: {
      enabled: { type: 'boolean' },
      reason: { type: 'string', maxLength: 256 },
    },
  },
};

/** 会话抑制记账：该会话当前持有的抑制请求数与会话结束释放句柄。 */
interface ISessionSuppression {
  count: number;
  /** 摘除记账并向端口下发最终关闭；会话中止路径由监听器吞错，显式路径由调用方等待。 */
  detach: () => Promise<void>;
}

/**
 * 构造内置 `power:query` / `power:prevent-sleep` 能力注册条目（分面缺位时返回空数组，整体不注册）。
 *
 * @param host 已通过壳自检的 PAL 宿主。
 */
export function createPowerCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  if (!isFacetReady(host.matrix, host.ports, 'power')) {
    return [];
  }
  const power = host.ports.power!;

  /** 会话抑制记账表（同一组合根内跨调用共享端口最终状态）。 */
  const suppressions = new Map<string, ISessionSuppression>();

  const query: IHostCapabilityDescriptor = {
    id: POWER_CAPABILITY_IDS.query,
    permissions: [POWER_PERMISSION_IDS.read],
    schema: POWER_INPUT_SCHEMAS['power:query'],
    targets: [],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      readInputRecord(POWER_CAPABILITY_IDS.query, input, []);
      return await power.query(toPortCall(ctx));
    },
  };

  const preventSleep: IHostCapabilityDescriptor = {
    id: POWER_CAPABILITY_IDS.preventSleep,
    permissions: [POWER_PERMISSION_IDS.manage],
    schema: POWER_INPUT_SCHEMAS['power:prevent-sleep'],
    targets: [],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(POWER_CAPABILITY_IDS.preventSleep, input, ['enabled', 'reason']);
      const enabled = requireBooleanField(POWER_CAPABILITY_IDS.preventSleep, record, 'enabled');
      const reason = optionalStringField(POWER_CAPABILITY_IDS.preventSleep, record, 'reason', { maxLength: 256 });
      const sessionSignal = ctx.sessionSignal ?? ctx.signal;
      if (enabled) {
        const existing = suppressions.get(ctx.sessionId);
        if (existing !== undefined) {
          // 同会话重复开启：抑制请求幂等记账（端口只接受最终开关状态）。
          existing.count += 1;
          return undefined;
        }
        const suppression: ISessionSuppression = {
          count: 1,
          detach: () => {
            sessionSignal.removeEventListener('abort', onAbort);
            suppressions.delete(ctx.sessionId);
            return power.setPreventSleep(false);
          },
        };
        // 监听器契约要求 void 返回：以适配器承接 async detach，拒绝面经 Promise 链如实上抛。
        const onAbort = (): void => {
          void suppression.detach();
        };
        sessionSignal.addEventListener('abort', onAbort, { once: true });
        suppressions.set(ctx.sessionId, suppression);
        // 关 → 开跃迁：以本次调用的上下文与审计说明下发端口。
        await power.setPreventSleep(true, {
          ...toPortCall(ctx),
          ...(reason !== null ? { reason } : {}),
        });
        return undefined;
      }
      const existing = suppressions.get(ctx.sessionId);
      if (existing === undefined) {
        // 未曾开启的关闭请求：端口最终状态本就为关，幂等放行。
        return undefined;
      }
      existing.count -= 1;
      if (existing.count > 0) {
        return undefined;
      }
      // 记账归零：摘除会话监听、下发最终关闭（§7.14 会话绑定语义）。
      await existing.detach();
      return undefined;
    },
  };
  return [query, preventSleep];
}
