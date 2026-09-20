/**
 * 插件激活端口与激活上下文：《01-薯片内核设计》§6.1 `PluginRunner` 的 TypeScript 契约视图。
 *
 * 权威：`01-架构设计/01-子系统设计/01.06-薯片内核设计-六、插件加载、停用与卸载` §6.1
 * （`PluginRunner.apply/stop` 契约与超时上限）、`10-配置系统设计` §2.5（`PluginConfig`
 * 命名空间只读快照）、`05-接口与契约/04.24-能力契约规范-九、第三方能力注册规则`
 * （仅 `service` 角色注册能力、owner 预绑定）、`05-事件契约规范`（事件发布）。
 *
 * @remarks
 * - 插件代码执行（`PluginRunner.apply/stop`）划归内核/Neon 通道（工单 025 开放）；装载器
 *   以本契约接口编程，宿主组合根经 `activationPortFor` 注入通道实现。通道未注入时
 *   `enable` 路径按 #27「资源管理器未装配」同类诚实回退报内部错误（`BRIDGE_INTERNAL`），
 *   不伪造空实现（裁决见开发日志）。
 * - 超时上限不在本层定义数值：`apply` 30s / `stop` 10s 由 `limits.ts`
 *   `LIFECYCLE_TIMEOUTS`（内核 §6.7 唯一定义处的壳侧结构视图）承接，强制撤销由
 *   `lifecycle.ts` 执行。
 * - 能力注册预绑定（04.24 §9.1）：激活上下文把 `owner` 强制绑定为激活插件 ID，调用方
 *   声明的 `owner` 不被采信；非 `service` 角色调用注册即激活失败（`KERNEL_APPLY_FAILED`）。
 * - 配置只读快照（10 §2.5）：进入 `Starting` 时取一次命名空间生效值快照并在 apply 期间
 *   不可变；命名空间未登记时生效值为空对象。
 */

import { LIFECYCLE_ERROR_CODES } from './codes.js';
import { throwCpkError } from './errors.js';
import type { PluginRole } from './types.js';
import type { IHostCapabilityDescriptor } from '../runtime/capability/contracts.js';
import type { IHostCapabilityRegistry } from '../runtime/capability/registry.js';

/**
 * 插件激活上下文（内核 §6.1 `Context` 在激活阶段暴露给装载器编排的契约视图）。
 */
export interface IPluginActivationContext {
  /** 激活插件 ID（反向域名）。 */
  readonly pluginId: string;
  /** 激活版本。 */
  readonly version: string;
  /** 插件角色。 */
  readonly role: PluginRole;
  /** 配置只读快照（10 §2.5；命名空间未登记生效值为空对象）。 */
  readonly config: Readonly<Record<string, unknown>>;
  /** 激活取消信号（停用取消 / 超时强制撤销时触发；协作式取消契约）。 */
  readonly signal: AbortSignal;
  /**
   * 注册一条 Bridge 能力（04.24 §9.1：仅 `service` 角色；owner 强制绑定为本插件 ID）。
   *
   * @throws {LoaderError} 非 `service` 角色调用（`KERNEL_APPLY_FAILED`）或注册表校验拒绝
   *   （注册表携带线协议码原样传播）。
   */
  registerCapability(descriptor: IHostCapabilityDescriptor): void;
  /**
   * 注销一条本插件注册的能力（幂等；不得注销其他提供方的条目）。
   *
   * @throws {LoaderError} 目标能力的 owner 不是本插件（`KERNEL_APPLY_FAILED`）。
   */
  unregisterCapability(capabilityId: string): void;
  /** 发布一条事件（05-事件契约规范；payload 必须结构化克隆兼容）。 */
  publishEvent(eventId: string, payload: unknown): void;
  /** 本激活会话已成功注册的能力 ID 快照（装载器回滚面消费）。 */
  registeredCapabilities(): readonly string[];
}

/**
 * 插件激活端口（内核 §6.1 `PluginRunner` 的 TS 契约视图；实现由内核/Neon 通道供给）。
 *
 * @remarks 超时上限：`apply` 30s、`stop` 10s（`limits.ts` `LIFECYCLE_TIMEOUTS`），
 * 由 `lifecycle.ts` 强制；实现必须响应 `ctx.signal` 协作式取消（内核 §6.7[5]）。
 */
export interface IPluginActivationPort {
  /** 执行插件 apply（Starting 阶段）；返回前副作用必须已登记（能力注册经上下文回调）。 */
  apply(context: IPluginActivationContext): Promise<void>;
  /** 插件停用回调（Stopping 阶段）；失败或超时不阻断撤销（内核 §6.4）。 */
  stop(context: IPluginActivationContext): Promise<void>;
}

/** 激活上下文构造选项。 */
export interface IPluginActivationContextOptions {
  readonly pluginId: string;
  readonly version: string;
  readonly role: PluginRole;
  /** 能力注册表（宿主正式注册面；04.24 校验在表内完成）。 */
  readonly hostCapabilityRegistry: IHostCapabilityRegistry;
  /** 事件发布出口（05-事件契约规范；由运行时组合根承接投递）。 */
  readonly publishEvent: (eventId: string, payload: unknown) => void;
  /** 配置命名空间生效值快照；缺省（未登记）为空对象。 */
  readonly config?: Readonly<Record<string, unknown>>;
  /** 取消信号；缺省用内置控制器（永不触发）。 */
  readonly signal?: AbortSignal;
}

/**
 * 构造插件激活上下文。
 *
 * @param options 插件身份、能力注册表、事件出口、配置快照与取消信号。
 * @returns 激活上下文（配置快照只读冻结；能力 owner 预绑定本插件）。
 */
export function createPluginActivationContext(
  options: IPluginActivationContextOptions,
): IPluginActivationContext {
  const registered: string[] = [];
  const config: Readonly<Record<string, unknown>> = Object.freeze(
    options.config === undefined ? {} : { ...options.config },
  );

  return {
    pluginId: options.pluginId,
    version: options.version,
    role: options.role,
    config,
    signal: options.signal ?? new AbortController().signal,

    registerCapability(descriptor: IHostCapabilityDescriptor): void {
      // 04.24 §9.1：只有 service 角色可以注册能力；其余角色仅消费。
      if (options.role !== 'service') {
        throwCpkError(
          LIFECYCLE_ERROR_CODES.applyFailed,
          `仅 service 角色插件可注册能力：${options.pluginId}（${options.role}）`,
          { pluginId: options.pluginId, role: options.role, capabilityId: descriptor.id },
        );
      }
      // owner 预绑定：激活上下文持有的身份是唯一事实源，调用方声明的 owner 不被采信。
      options.hostCapabilityRegistry.register({ ...descriptor, owner: options.pluginId });
      if (!registered.includes(descriptor.id)) {
        registered.push(descriptor.id);
      }
    },

    unregisterCapability(capabilityId: string): void {
      const entry = options.hostCapabilityRegistry.getRegistered(capabilityId);
      if (entry !== undefined && entry.owner !== options.pluginId) {
        throwCpkError(
          LIFECYCLE_ERROR_CODES.applyFailed,
          `不得注销其他提供方注册的能力：${capabilityId}`,
          { pluginId: options.pluginId, capabilityId, owner: entry.owner },
        );
      }
      options.hostCapabilityRegistry.unregister(capabilityId);
      const index = registered.indexOf(capabilityId);
      if (index >= 0) {
        registered.splice(index, 1);
      }
    },

    publishEvent(eventId: string, payload: unknown): void {
      options.publishEvent(eventId, payload);
    },

    registeredCapabilities: () => [...registered],
  };
}
