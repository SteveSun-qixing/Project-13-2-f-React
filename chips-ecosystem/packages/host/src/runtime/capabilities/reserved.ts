/**
 * 预留能力清单（P0-1 交付点 2：为 `document:*` 预留槽位但不实现业务）。
 *
 * 权威：`04-能力契约规范` §6.2（R19 权限映射：`document:open|read` 需 `resources:read`，
 * `document:write|save` 需 `resources:write`）。
 *
 * @remarks
 * - 本模块**只声明**四项文档能力的 ID 与所需权限，供组合根诊断面呈现"已预留、待接线"；
 *   不注册进能力注册表，因此调用未接线的文档能力得到真实的注册表未命中错误
 *   （`BRIDGE_CAPABILITY_NOT_FOUND`），而非空壳统一占位。
 * - 文档能力业务逻辑属 `capabilities/document/`（独立交付）。接线方按
 *   {@link IHostCapabilityDescriptor} 产出描述符并经组合根注入点注册；一旦注册，预留槽位被真实实现覆盖，
 *   诊断面 `reserved` 归零。
 * - 本清单为壳侧独立镜像，不 import `capabilities/document/`（避免与并行交付的耦合）；与 SDK/契约的逐项一致
 *   由文档能力侧的契约测试锁定。
 */

/** 一条预留能力的声明（ID + 所需权限）。 */
export interface IReservedCapabilityDeclaration {
  readonly id: string;
  readonly permissions: readonly string[];
  /** 预期接线方（诊断展示）。 */
  readonly provider: string;
}

/** 文档能力权限 ID（与 `capabilities/document/contract.ts` 同值镜像）。 */
const RESOURCES_READ = 'resources:read';
const RESOURCES_WRITE = 'resources:write';

/** `document:*` 四项预留能力（不在本单实现业务逻辑）。 */
export const RESERVED_DOCUMENT_CAPABILITIES: readonly IReservedCapabilityDeclaration[] = [
  { id: 'document:open', permissions: [RESOURCES_READ], provider: 'document' },
  { id: 'document:read', permissions: [RESOURCES_READ], provider: 'document' },
  { id: 'document:write', permissions: [RESOURCES_WRITE], provider: 'document' },
  { id: 'document:save', permissions: [RESOURCES_WRITE], provider: 'document' },
];

/** 组合根默认预留清单。 */
export const RESERVED_CAPABILITIES: readonly IReservedCapabilityDeclaration[] = RESERVED_DOCUMENT_CAPABILITIES;
