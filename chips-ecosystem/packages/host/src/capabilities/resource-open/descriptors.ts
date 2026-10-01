/**
 * `resource:open` / `resource:list-handlers` 的注册单元（接线契约适配器）。
 *
 * 权威：`02-Bridge三层设计` §4.1（注册项字段与默认值）、§5.2（调用阶段序）、
 * `04-能力契约规范` §4（注册校验）、§6.2（R19 权限映射与限定值目标）、
 * `14-资源打开与默认处理器契约` §2.2/§6.2（输入 Schema）。
 *
 * @remarks
 * - 本文件是资源打开能力面向组合根（`main/production-assembly.ts`）的**唯一接线出口**：
 *   产出两条 `IHostCapabilityDescriptor`（与 `capabilities/document/descriptors.ts` 同形制）。
 * - 契约要素全部来自 `contract.ts` 单一事实源常量；本文件不出现任何契约字面量。
 * - `owner` / `timeoutMs` / `sessionInFlightLimit` / `maxQueue` 省略取默认；
 *   `concurrency` 显式 `parallel`——打开为一次性投递（幂等性「否」，§2.2），不同打开互不阻塞。
 * - 上下文适配：壳侧 `IHostCapabilityContext` 与服务上下文逐字段如实传递，不增不改。
 */

import type {
  HostCapabilityConcurrency,
  IHostCapabilityDescriptor,
  IHostCapabilityContext,
} from '../../runtime/capability/contracts.js';
import {
  RESOURCE_OPEN_CAPABILITY_IDS,
  RESOURCE_OPEN_CAPABILITY_PERMISSIONS,
  RESOURCE_OPEN_CAPABILITY_TARGETS,
  RESOURCE_OPEN_INPUT_SCHEMAS,
} from './contract.js';
import type { ResourceOpenCapabilityId } from './contract.js';
import type { IResourceOpenCapabilityContext, IResourceOpenService } from './service.js';

/** 资源打开能力的并发策略（`parallel`：打开互不阻塞；投递内串行由处理器实例语义收口）。 */
const RESOURCE_OPEN_CAPABILITY_CONCURRENCY: HostCapabilityConcurrency = 'parallel';

/** 壳侧上下文 → 路由服务上下文（字段同名同义，不增不改）。 */
function toRouteContext(ctx: IHostCapabilityContext): IResourceOpenCapabilityContext {
  return {
    signal: ctx.signal,
    deadline: ctx.deadline,
    sessionId: ctx.sessionId,
    callerId: ctx.callerId,
  };
}

/** 以契约常量组装一条注册单元。 */
function describeResourceOpenCapability(
  id: ResourceOpenCapabilityId,
  handler: (input: unknown, ctx: IResourceOpenCapabilityContext) => Promise<unknown>,
): IHostCapabilityDescriptor {
  return {
    id,
    permissions: RESOURCE_OPEN_CAPABILITY_PERMISSIONS[id],
    schema: RESOURCE_OPEN_INPUT_SCHEMAS[id],
    targets: RESOURCE_OPEN_CAPABILITY_TARGETS[id],
    concurrency: RESOURCE_OPEN_CAPABILITY_CONCURRENCY,
    handler: async (input: unknown, ctx: IHostCapabilityContext): Promise<unknown> =>
      handler(input, toRouteContext(ctx)),
  };
}

/**
 * 构造两条资源打开能力的注册单元（顺序即 `open` → `list-handlers`）。
 *
 * @param service 已装配端口依赖的路由服务实例（组合根唯一持有；禁止按调用新建服务）。
 */
export function createResourceOpenCapabilityDescriptors(
  service: IResourceOpenService,
): readonly IHostCapabilityDescriptor[] {
  return [
    describeResourceOpenCapability(RESOURCE_OPEN_CAPABILITY_IDS.open, (input, ctx) => service.executeOpen(input, ctx)),
    describeResourceOpenCapability(RESOURCE_OPEN_CAPABILITY_IDS.listHandlers, (_input, ctx) =>
      service.executeListHandlers(ctx),
    ),
  ];
}
