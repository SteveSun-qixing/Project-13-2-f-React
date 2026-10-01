/**
 * 壳侧能力提供者契约（02-Bridge三层设计 §3.2/§4.1、04-能力契约规范 §2/§4、08-权限系统设计 §7）。
 *
 * 权威：`02-Bridge三层设计` §3.2（能力模型）、§4.1（注册项与默认值）、§8（超时/取消/并发），
 * `04-能力契约规范` §2（能力 ID 文法）、§4（注册校验），`03-核心接口规范` §5.1（注册项）。
 *
 * @remarks
 * - 本模块是组合根（`main/production-assembly.ts`）与能力提供方（如 `capabilities/document/`）之间的
 *   **接线契约**：提供方产出一条 {@link IHostCapabilityDescriptor}，组合根注册进
 *   {@link IHostCapabilityRegistry}；运行时按 02 §5.2 阶段序处理调用。
 * - `@chips/host` 与被承载方无运行时依赖（架构边界），故此处为 `@chips/bridge` 能力模型的**结构视图**：
 *   字段语义、默认值与 `CAPABILITY_REGISTRATION_DEFAULTS` 逐字对齐，Bridge 内核（Rust）交付后由集成
 *   任务把 {@link IHostCapabilityHandler} 直连内核路由，本契约形状不变。
 * - 能力 ID 与权限 ID 属两个隔离命名空间（R3）；本契约不内置任何具体 ID，具体 ID 由提供方的
 *   单一事实源常量提供（`@chips/sdk` 生成常量），杜绝在框架内散落字面量。
 */

import type { ICarrierServiceReport } from '../../carrier/index.js';
import type { IPermissionAuditWriterReport } from '../../audit/types.js';

/** 并发策略：`parallel` 默认；`serial` 时同一能力 ID 全局 FIFO 串行（02-Bridge三层设计 §4.1、§8.3）。 */
export type HostCapabilityConcurrency = 'parallel' | 'serial';

/** 注册项默认值（02-Bridge三层设计 §4.1）；与 `@chips/bridge` `CAPABILITY_REGISTRATION_DEFAULTS` 对齐。 */
export const HOST_CAPABILITY_DEFAULTS = {
  timeoutMs: 30000,
  concurrency: 'parallel',
  maxQueue: 32,
  sessionInFlightLimit: 64,
} as const;

/** 平台内置能力的默认提供方标识（`03-核心接口规范` §5.3 示例的服务域 ID）。 */
export const HOST_CAPABILITY_OWNER = 'chips.official.host';

/**
 * 能力 ID 文法：`<domain>:<action>[:<target>]`。
 * `domain` 全小写；`action` 允许驼峰（内置含 `window:setTitle` 等）；与
 * `@chips/bridge` 注册表文法、`tools/contract-gen` 口径一致。
 */
export const HOST_CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][A-Za-z0-9-]*(:[a-z0-9][a-z0-9.-]*)?$/;

/** 判断字符串是否为合法能力 ID。 */
export function isHostCapabilityId(value: string): boolean {
  return HOST_CAPABILITY_ID_PATTERN.test(value);
}

/**
 * 权限 ID 文法：`<domain>:<scope>`（全小写短横线；08-权限系统设计 §3）。
 * 框架只校验文法；是否为已登记基础权限由提供方的权限词表判定（见注册选项 `knownPermissions`）。
 */
export const HOST_PERMISSION_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;

/** 判断字符串是否为合法权限 ID 文法。 */
export function isHostPermissionId(value: string): boolean {
  return HOST_PERMISSION_ID_PATTERN.test(value);
}

/**
 * 事件下行横切关联键（工单046 段一）：请求上下文内 `ctx.emit` 下行时透传该次调用的
 * `traceId` / `requestId`；非请求触发源缺省，禁另造关联键。
 */
export interface IHostEventCorrelation {
  readonly traceId?: string;
  readonly requestId?: string;
}

/** 能力执行上下文；由运行时组装并如实传递给提供方处理器（02-Bridge三层设计 §3.2、`03` §5.1）。 */
export interface IHostCapabilityContext {
  /** 取消信号；会话销毁、超时、能力注销或运行时停机时触发。 */
  readonly signal: AbortSignal;
  /**
   * 会话级取消信号；会话销毁或运行时停机时触发。
   *
   * @remarks 与 {@link signal}（本次调用的收口信号）不同：调用收口后本信号随会话存活，
   * 供「绑定调用方会话」的资源在会话结束后释放（`power:prevent-sleep` 抑制自动释放、
   * `transfer:download` 随会话取消，04-能力契约规范 §7.14/§7.15）。
   * 路由总装供给；测试替身缺省时消费方回退 {@link signal}（仅覆盖调用窗口内的取消）。
   */
  readonly sessionSignal?: AbortSignal;
  /** 调用截止时间（Unix epoch 毫秒）；与注册超时同源。 */
  readonly deadline: number;
  /** 触发调用的会话标识；仅用于诊断与审计。 */
  readonly sessionId: string;
  /** 调用方标识（插件 ID 或 `platform`）；仅用于诊断与审计，不参与授权。 */
  readonly callerId: string;
  /**
   * 横切链路追踪 ID（工单046 段一）：由 `bridge:request` 请求帧透传
   * （preload 生成，preload→`bridge:request`→router→事件下行四段贯通）；
   * 仅用于诊断与审计关联，不参与授权判定。
   */
  readonly traceId?: string;
  /** 本次调用的请求关联键（`requestId` 透传）；仅用于诊断与审计关联。 */
  readonly requestId?: string;
  /**
   * 向本会话所在窗口投递一条事件（09-事件系统设计 §下行）。
   *
   * @param eventId 事件 ID（单一事实源常量，如 `document:changed`）。
   * @param payload 事件负载；必须是结构化克隆兼容值。
   * @remarks 投递按窗口订阅计数生效；无订阅者时静默丢弃。能力据此驱动 `document:changed` /
   * `document:saved` 等下行事件，无需感知 IPC 通道。
   */
  emit(eventId: string, payload: unknown): void;
}

/** 能力处理器：`input` 已通过运行时输入准入；必须响应 `ctx.signal` 并在 `ctx.deadline` 前收口。 */
export type IHostCapabilityHandler = (input: unknown, ctx: IHostCapabilityContext) => Promise<unknown>;

/** 限定值目标规则（08-权限系统设计 §4.3、§7.2）：权限对应的输入字段路径；空数组表示无目标字段。 */
export interface IHostPermissionTargetRule {
  /** 基础权限 ID。 */
  readonly permission: string;
  /** 输入中的限定值目标字段路径（点分）；空数组表示无限定值目标。 */
  readonly targetFields: readonly string[];
}

/**
 * 能力注册条目（接线契约）；一条描述即一个可注册单元（02-Bridge三层设计 §4.1）。
 *
 * @remarks
 * - `owner` 省略时取 {@link HOST_CAPABILITY_OWNER}；`timeoutMs` / `concurrency` / `maxQueue` /
 *   `sessionInFlightLimit` 省略时取 {@link HOST_CAPABILITY_DEFAULTS}。
 * - `schema` 为输入 JSON Schema（平台子集）；运行时按声明的顶层 `required` 做输入准入，
 *   深度校验在 Bridge 内核交付后由内核承担（见开发日志集成缺口）。
 * - `targets` 供权限判定读取限定值目标；提供方按 04 §6.2 R19 表逐能力提供。
 */
export interface IHostCapabilityDescriptor {
  /** 能力 ID（单一事实源常量，禁止字面量散落）。 */
  readonly id: string;
  /** 执行该能力所需基础权限 ID 并集；空数组表示无额外权限要求。 */
  readonly permissions: readonly string[];
  /** 处理器。 */
  readonly handler: IHostCapabilityHandler;
  /** 输入 JSON Schema（平台子集）。 */
  readonly schema?: Readonly<Record<string, unknown>>;
  /** 提供方标识；省略取 {@link HOST_CAPABILITY_OWNER}。 */
  readonly owner?: string;
  /** 调用超时（毫秒）。 */
  readonly timeoutMs?: number;
  /** 并发策略。 */
  readonly concurrency?: HostCapabilityConcurrency;
  /** `serial` 时等待队列上限。 */
  readonly maxQueue?: number;
  /** 同一会话对该能力的在途调用上限。 */
  readonly sessionInFlightLimit?: number;
  /** 限定值目标规则。 */
  readonly targets?: readonly IHostPermissionTargetRule[];
}

/** 注册项（描述经校验并归一默认值后的稳定形态）。 */
export interface IRegisteredHostCapability {
  readonly descriptor: IHostCapabilityDescriptor;
  readonly id: string;
  readonly owner: string;
  readonly permissions: readonly string[];
  readonly targets: readonly IHostPermissionTargetRule[];
  readonly timeoutMs: number;
  readonly concurrency: HostCapabilityConcurrency;
  readonly maxQueue: number;
  readonly sessionInFlightLimit: number;
  readonly state: 'active' | 'draining';
}

/** 编目项（只读诊断视图；04-能力契约规范 §4.3）。 */
export interface IHostCapabilityDescriptorView {
  readonly id: string;
  readonly owner: string;
  readonly permissions: readonly string[];
  readonly state: 'active' | 'draining';
  readonly timeoutMs: number;
  readonly concurrency: HostCapabilityConcurrency;
  readonly maxQueue: number;
  readonly sessionInFlightLimit: number;
}

/** 注册表诊断快照（04 §4.3 编目 + 分面统计）。 */
export interface IHostCapabilityRegistryReport {
  readonly total: number;
  readonly active: number;
  readonly draining: number;
  readonly byOwner: Readonly<Record<string, number>>;
  readonly byDomain: Readonly<Record<string, number>>;
  readonly capabilities: readonly IHostCapabilityDescriptorView[];
}

/**
 * 壳侧会话（02-Bridge三层设计 §7.4、01-Bridge-API规范 §4.2、08-权限系统设计 §7.6）。
 *
 * @remarks 会话把渲染来源（`windowId` + `frameId`）绑定到一次插件运行实例，是路由与限权的身份单位；
 * 身份只由来源解析，负载自报不参与授权。`grantedPermissions` 为权限快照（不可变集合），授权变更整体替换并递增
 * `permissionVersion`。来源以 `frameId === null` 表示主框架（壳 `resolveIpcSession` 的归一口径）。
 */
export interface IHostSession {
  readonly sessionId: string;
  /** 反向域名插件 ID；平台会话为 `platform`。 */
  readonly pluginId: string;
  /**
   * 会话来源窗口；承载（carrier）会话无窗口，恒为 `null`。
   *
   * 《17》波 1 裁定（主智能体，2026-09-21，工单039）：`ISessionSource` 判别分片采纳**内部注册表
   * 最小扩展**形态——carrier 判别只落本壳侧 `IHostSession`（`kind`/`carrierId`），壳侧 IPC 的
   * `ISessionSource` 公共形状与 bridge 发布面不动，故 RFC §4.1 公开面流程未触发；
   * `kind` 缺省视同 `window` 是该形态的构造约定，非兼容包袱。
   */
  readonly windowId: number | null;
  readonly frameId: number | null;
  /** 会话来源类别；缺省视同 `window`（内部注册表最小扩展形态，见上裁定）。 */
  readonly kind?: 'window' | 'carrier';
  /** 承载会话实例键（`<instanceId>#<连接序号>`；窗口会话不设）。 */
  readonly carrierId?: string;
  readonly grantedPermissions: ReadonlySet<string>;
  readonly openedDocuments: ReadonlySet<string>;
  readonly state: 'active' | 'closed';
  readonly permissionVersion: number;
}

/** 会话创建输入（组合根打开会话时使用）。 */
export interface IHostSessionCreateInput {
  readonly sessionId: string;
  readonly pluginId: string;
  readonly windowId: number | null;
  readonly frameId: number | null;
  readonly grantedPermissions?: readonly string[];
  readonly openedDocuments?: readonly string[];
  /** 承载会话判别（见 {@link IHostSession.kind} 的【待主智能体裁定】标记）。 */
  readonly kind?: 'window' | 'carrier';
  readonly carrierId?: string;
}

/** 会话诊断视图（不暴露授权原文之外的内部状态）。 */
export interface IHostSessionView {
  readonly sessionId: string;
  readonly pluginId: string;
  readonly windowId: number | null;
  readonly frameId: number | null;
  readonly permissionVersion: number;
  readonly grantedCount: number;
  readonly openedDocumentCount: number;
  readonly state: 'active' | 'closed';
  /** 承载会话才出现的扩展键（窗口会话视图零变化，兼容既有诊断断言）。 */
  readonly kind?: 'window' | 'carrier';
  readonly carrierId?: string;
}

/**
 * 预留槽位诊断视图（组合根"已预留、待接线"面）。
 *
 * @remarks
 * - 来源是 `runtime/capabilities/reserved.ts` 的声明清单，与注册表实态逐条比对后得出 `wired`。
 * - `wired === false` 表示该能力 ID 尚未有真实提供方注册：调用得到注册表未命中的
 *   `BRIDGE_CAPABILITY_NOT_FOUND`（04 §4.2 查询语义），而不是空壳统一占位。
 * - 本视图只出现在壳侧诊断快照（`IHostRuntimeReport`），不经 `window.chips` 暴露（02 §4.3）。
 */
export interface IHostReservedCapabilityView {
  /** 预留能力 ID。 */
  readonly id: string;
  /** 声明所需基础权限。 */
  readonly permissions: readonly string[];
  /** 预期接线方。 */
  readonly provider: string;
  /** 真实实现是否已注册（含 `draining` 代际）。 */
  readonly wired: boolean;
}

/** 运行时组合诊断快照。 */
export interface IHostRuntimeReport {
  readonly state: 'idle' | 'running' | 'stopped';
  readonly capabilities: IHostCapabilityRegistryReport;
  readonly sessions: readonly IHostSessionView[];
  readonly activeSessions: number;
  readonly inFlight: number;
  readonly eventSubscriptions: number;
  readonly resourceHandles: number;
  /** 预留槽位面（"已预留、待接线"）。 */
  readonly reserved: readonly IHostReservedCapabilityView[];
  /** 承载链路服务端面（未装配承载选项时键缺位）。 */
  readonly carrier?: ICarrierServiceReport;
  /** 权限审计写入器面（工单046 段二；未装配审计选项时键缺位）。 */
  readonly audit?: IPermissionAuditWriterReport;
}
