/**
 * 能力模型（02-Bridge三层设计 §3.2、04-能力契约规范 §2）。
 *
 * 能力 ID 与权限 ID 是两个互相隔离的命名空间（R3）；能力 ID 不携带版本号。
 */

import type { JSONSchema } from './bridge.js';

/** 能力执行上下文；由 Bridge 适配层组装并如实传递给 Host 实现。 */
export interface ICapabilityContext {
  /** 取消信号；会话销毁、超时、能力注销或 Bridge 关闭时触发。 */
  readonly signal: AbortSignal;
  /** 调用截止时间（Unix epoch 毫秒）；无截止时为 undefined。 */
  readonly deadline?: number;
  /** 触发调用的会话标识；仅用于诊断与审计。 */
  readonly sessionId: string;
  /** 调用方标识：插件 ID 或 `platform`；仅用于诊断与审计，不参与授权。 */
  readonly callerId: string;
}

export interface ICapability<TInput = unknown, TOutput = unknown> {
  /** 能力 ID：`<domain>:<action>[:<target>]`，全局唯一。 */
  id: string;
  /** 能力实现；收到的 `input` 已通过 Schema 校验。必须响应 `ctx.signal` 并在 `ctx.deadline` 前收口。 */
  execute(input: TInput, ctx: ICapabilityContext): Promise<TOutput>;
  /** **输入**的 JSON Schema；允许关键字见 04-能力契约规范 §5。 */
  schema: JSONSchema;
  /** 执行该能力所需基础权限 ID 并集；空数组表示无额外权限要求（仍受会话有效性约束）。 */
  permissions: string[];
}

/** 并发策略：`parallel` 默认；`serial` 时同一能力 ID 全局 FIFO 串行。 */
export type CapabilityConcurrency = 'parallel' | 'serial';

/** 注册项结构（02-Bridge三层设计 §4.1）；带默认值的四项可省略，注册时归一。 */
export interface ICapabilityRegistration {
  capability: ICapability;
  /** 提供方标识：平台服务域 ID 或服务插件 ID（反向域名）。 */
  owner: string;
  /** 调用超时（毫秒），省略时取 30000。 */
  timeoutMs?: number;
  /** 并发策略，省略时取 `parallel`。 */
  concurrency?: CapabilityConcurrency;
  /** `serial` 时的等待队列上限，省略时取 32。 */
  maxQueue?: number;
  /** 同一会话对该能力的在途调用上限，省略时取 64。 */
  sessionInFlightLimit?: number;
}

/** 注册项默认值（02-Bridge三层设计 §4.1）。 */
export const CAPABILITY_REGISTRATION_DEFAULTS = {
  timeoutMs: 30000,
  concurrency: 'parallel',
  maxQueue: 32,
  sessionInFlightLimit: 64,
} as const satisfies Pick<
  ICapabilityRegistration,
  'timeoutMs' | 'concurrency' | 'maxQueue' | 'sessionInFlightLimit'
>;

/** 注册表只读编目项（04-能力契约规范 §4.3）。 */
export interface ICapabilityDescriptor {
  id: string;
  owner: string;
  permissions: readonly string[];
  schema: JSONSchema;
  builtin: boolean;
  state: 'active' | 'draining';
}

export interface ICapabilityCatalogFilter {
  owner?: string;
  domain?: string;
  builtin?: boolean;
}

/** 平台内部只读能力编目；不通过 `window.chips` 暴露。 */
export interface ICapabilityCatalog {
  get(capabilityId: string): ICapabilityDescriptor | undefined;
  list(filter?: ICapabilityCatalogFilter): readonly ICapabilityDescriptor[];
}

/** 注册表接口（权威实例位于 Bridge 核心；本包同时提供 TS 侧实现与 Rust 替换接缝）。 */
export interface ICapabilityRegistry {
  register(registration: ICapabilityRegistration): void;
  unregister(capabilityId: string): void;
  get(capabilityId: string): ICapabilityRegistration | undefined;
}
