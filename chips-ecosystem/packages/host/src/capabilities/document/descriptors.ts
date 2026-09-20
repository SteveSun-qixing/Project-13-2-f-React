/**
 * `document:*` 四能力的注册单元（接线契约适配器）。
 *
 * 权威：`02-Bridge三层设计` §4.1（注册项字段与默认值）、§5.2（调用阶段序）、`04-能力契约规范`
 * §4（注册校验）、§6.2（R19 权限映射与限定值目标）、§7.3（输入 Schema）、
 * `11-文档服务设计` §二（宿主能力层职责边界）。
 *
 * @remarks
 * - 本文件是文档能力面向组合根（`main/production-assembly.ts`）的**唯一接线出口**：产出四条
 *   `IHostCapabilityDescriptor`（`runtime/capability/contracts.ts` 的接线形状，提供方只读消费），
 *   组合根经 `registry.registerAll` 注册即覆盖 `runtime/capabilities/reserved.ts` 预留的四个槽位
 *   （ID 与所需权限逐项一致，由 `tests/document-capability-contract.test.ts` 锁定）。
 * - 契约要素全部来自 `contract.ts` 的单一事实源常量：能力 ID、权限集合、输入 Schema、限定值目标；
 *   本文件不出现任何契约字面量。
 * - `owner` 省略：内置能力的提供方标识由组合根的 `defaultOwner` 单点决定，提供方不自报。
 * - `timeoutMs` / `sessionInFlightLimit` / `maxQueue` 省略：取 `HOST_CAPABILITY_DEFAULTS`；
 *   `concurrency` 显式为 `parallel`——同一文档的 `write` / `save` 已由服务内的**记录级**串行队列
 *   收口（`11-文档服务设计` §7.5），能力级 `serial` 会让不同文档互相阻塞，违反该口径。
 * - 上下文适配：壳侧 `IHostCapabilityContext` 与契约的 `IDocumentCapabilityContext` 逐字段如实传递，
 *   不作任何增补；事件发布走服务注入的 `IDocumentEventsPort`（生产适配器由组合根接内核事件总线），
 *   不使用 `ctx.emit` 的按会话投递通道，避免同一事件双路发布。
 */

import type {
  HostCapabilityConcurrency,
  IHostCapabilityDescriptor,
  IHostCapabilityContext,
} from '../../runtime/capability/contracts.js';
import {
  DOCUMENT_CAPABILITY_IDS,
  DOCUMENT_CAPABILITY_PERMISSIONS,
  DOCUMENT_CAPABILITY_TARGETS,
  DOCUMENT_INPUT_SCHEMAS,
} from './contract.js';
import type { DocumentCapabilityId } from './contract.js';
import type { IDocumentCapabilityContext } from './contract.js';
import type { DocumentCapabilityExecutor } from './ports.js';
import type { IDocumentService } from './service.js';

/**
 * 文档能力的并发策略（`parallel`：文档级串行在服务内按记录队列完成，§7.5）。
 *
 * @remarks 显式声明而非省略默认值，使注册面自解释：接线评审与契约测试都能读到同一结论。
 */
const DOCUMENT_CAPABILITY_CONCURRENCY: HostCapabilityConcurrency = 'parallel';

/** 壳侧上下文 → 文档能力上下文（字段同名同义，不增不改，`04` §5.1）。 */
function toDocumentContext(ctx: IHostCapabilityContext): IDocumentCapabilityContext {
  return {
    signal: ctx.signal,
    deadline: ctx.deadline,
    sessionId: ctx.sessionId,
    callerId: ctx.callerId,
  };
}

/** 以契约常量组装一条注册单元。 */
function describeDocumentCapability(
  id: DocumentCapabilityId,
  execute: DocumentCapabilityExecutor<unknown, unknown>
): IHostCapabilityDescriptor {
  return {
    id,
    permissions: DOCUMENT_CAPABILITY_PERMISSIONS[id],
    schema: DOCUMENT_INPUT_SCHEMAS[id],
    targets: DOCUMENT_CAPABILITY_TARGETS[id],
    concurrency: DOCUMENT_CAPABILITY_CONCURRENCY,
    handler: async (input: unknown, ctx: IHostCapabilityContext): Promise<unknown> =>
      execute(input, toDocumentContext(ctx)),
  };
}

/**
 * 构造四条文档能力的注册单元（顺序即 `open` → `read` → `write` → `save`）。
 *
 * @param service 已装配端口依赖的文档服务实例（组合根唯一持有；禁止按调用新建服务）。
 */
export function createDocumentCapabilityDescriptors(service: IDocumentService): readonly IHostCapabilityDescriptor[] {
  return [
    describeDocumentCapability(DOCUMENT_CAPABILITY_IDS.open, (input, ctx) => service.executeOpen(input, ctx)),
    describeDocumentCapability(DOCUMENT_CAPABILITY_IDS.read, (input, ctx) => service.executeRead(input, ctx)),
    describeDocumentCapability(DOCUMENT_CAPABILITY_IDS.write, (input, ctx) => service.executeWrite(input, ctx)),
    describeDocumentCapability(DOCUMENT_CAPABILITY_IDS.save, (input, ctx) => service.executeSave(input, ctx)),
  ];
}
