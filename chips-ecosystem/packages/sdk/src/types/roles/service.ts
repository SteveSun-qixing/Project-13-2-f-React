/**
 * 服务插件角色类型（10-服务插件接口 §2 IServicePlugin、§3 IServiceContext）。
 *
 * 权威归属：
 * - 入口方法签名与失败处理以 10 §2.1、§2.2 为准；上下文成员与语义以 10 §3.1–§3.8 为准
 *   （02-SDK-API规范 §2.2「插件角色」行以角色接口文档标注的 SDK 导出名为准）；
 * - `ConfigLayer` / `ConfigWriteScope` 的权威是 10-配置系统设计 §4，本模块只引用不重定义；
 * - `IServiceBridge` 是主进程调用面收窄投影（01-Bridge-API规范 §2.6、10 §3.7），
 *   定义在 `types/bridge.ts`；
 * - `Context`（03-核心接口规范 §4.4）与 `IServiceContext` 是不同层次：前者是 Cordis 内核
 *   上下文，后者是平台对服务插件暴露的受控视图。
 */

import type { ICapability, IServiceBridge } from '../bridge.js';
import type { ConfigLayer, ConfigWriteScope } from '../config.js';
import type { IEventSubscription } from '../kernel.js';

/** 配置读取结果（10 §3.1）；`key` 为完整键 `plugins.<pluginId>.<相对键>`。 */
export interface IConfigView {
  key: string;
  /** 生效值；未定义且无默认值时由实现决定（10-配置系统设计）。 */
  value: unknown;
  /** 生效值所在层。 */
  layer: ConfigLayer;
  /** 是否来自默认值。 */
  isDefault: boolean;
}

/** 配置变更载荷（`config:changed`，10 §3.1）。 */
export interface IConfigChange {
  key: string;
  layer: ConfigLayer;
  /** 该层当前值。 */
  value: unknown;
  /** 变化后的生效值。 */
  effectiveValue: unknown;
  isDefault: boolean;
  /** 变更来源；插件写入为 `plugin:<pluginId>`。 */
  origin: string;
}

/**
 * 服务自身命名空间的配置访问（10 §3.5）。
 *
 * 作用域固定为 `plugins.<pluginId>`；`key` 为相对键；读写 `platform` 命名空间不使用
 * `ctx.config`，必须经 `ctx.bridge.request('config:get' | 'config:set', ...)`。
 */
export interface IServiceConfig {
  /** 读取自身命名空间下相对键的生效值；键未注册返回 `CONFIG_KEY_UNKNOWN`。 */
  get(key: string): Promise<IConfigView>;
  /** 返回前缀下合并默认值后的完整生效视图。 */
  snapshot(prefix?: string): Promise<Readonly<Record<string, unknown>>>;
  /** 在 `user` 或 `workspace` 层写入覆盖；值必须通过配置 schema 校验。 */
  set(key: string, value: unknown, scope: ConfigWriteScope): Promise<void>;
  /** 移除指定层上的覆盖；缺失覆盖为 no-op。 */
  reset(keys: readonly string[], scope: ConfigWriteScope): Promise<void>;
  /** 订阅前缀匹配的变更，返回可退订句柄；插件卸载时随 Fork 撤销。 */
  watch(prefix: string, handler: (change: IConfigChange) => void): IEventSubscription;
}

/** 日志结构化字段；只允许字符串、数字、布尔与 `null` 标量（10 §3.6）。 */
export type ServiceLogFields = Readonly<Record<string, string | number | boolean | null>>;

/**
 * 平台日志流（10 §3.6）。
 *
 * 免权限（R19）：按插件命名空间自动归属，写入失败不抛出、不中断服务；
 * `message` 使用简体中文，错误对象经 `error` 参数传入。
 */
export interface IServiceLogger {
  debug(message: string, fields?: ServiceLogFields): void;
  info(message: string, fields?: ServiceLogFields): void;
  warn(message: string, fields?: ServiceLogFields): void;
  error(message: string, error?: unknown, fields?: ServiceLogFields): void;
}

/** 能力注册选项（10 §3.1）。 */
export interface ICapabilityRegisterOptions {
  /** 调用超时，默认 30000。 */
  timeoutMs?: number;
  /** 并发策略，默认 `parallel`。 */
  concurrency?: 'parallel' | 'serial';
  /** 串行队列上限，默认 32。 */
  maxQueue?: number;
}

/**
 * 服务上下文：`start` 收到的全部可用面（10 §3.1、§3.2）。
 *
 * 规则：
 * - 不存在的成员即不可用；插件不得访问全局对象或平台内部结构扩展访问面；
 * - Context 进入 `Disposing` 后拒绝新的 `provide` / `inject` / `on` /
 *   `registerCapability` / `effect`；销毁后一切操作返回 `KERNEL_CONTEXT_DISPOSED`；
 * - `bridge` 只含 `request` 与 `resource`：事件订阅使用 `on` / `once`（内核事件总线）。
 */
export interface IServiceContext {
  /** 当前插件 ID（反向域名），只读。 */
  readonly pluginId: string;
  /** 主进程出站能力与资源访问（10 §3.7）。 */
  readonly bridge: IServiceBridge;
  /** 自身命名空间配置访问（10 §3.5）。 */
  readonly config: IServiceConfig;
  /** 平台日志流（10 §3.6）。 */
  readonly logger: IServiceLogger;

  /** 注册 Cordis 服务（10 §3.3）；服务名规范与同名替换语义见 10 §3.3。 */
  provide<T extends object>(name: string, service: T): void;
  /** 声明服务依赖并在就绪后注入回调（10 §3.3）；回调为同步函数。 */
  inject(dependencies: readonly string[], callback: (ctx: IServiceContext) => void): void;

  /** 订阅内核事件；监听器随当前 Fork 自动撤销（10 §3.4）。 */
  on<TPayload>(event: string, listener: (payload: TPayload) => void): IEventSubscription;
  /** 订阅一次；首次投递后自动退订（10 §3.4）。 */
  once<TPayload>(event: string, listener: (payload: TPayload) => void): IEventSubscription;
  /** 同步广播自有域事件；`internal:*` 插件不得发布（10 §3.4）。 */
  emit<TPayload>(event: string, payload: TPayload): void;

  /** 注册 Bridge 能力（10 §六）；能力所需权限须已在 manifest 声明。 */
  registerCapability<TInput = unknown, TOutput = unknown>(
    capability: ICapability<TInput, TOutput>,
    options?: ICapabilityRegisterOptions
  ): void;

  /** 登记可逆副作用清理（10 §3.8）；`cleanup` 必须幂等、不得抛出。 */
  effect(cleanup: () => void): void;
}

/**
 * 服务插件入口接口（10 §2.1、§2.2）。
 *
 * 入口模块默认导出实现本接口的对象；模块顶层只允许声明，不允许产生副作用。
 * 全部方法都必须在导出对象上可直接调用，平台以对象方法形式调用；`stop` 必须幂等。
 */
export interface IServicePlugin {
  /** 启动服务；由平台在 starting 阶段调用，返回后本插件进入 active。 */
  start(ctx: IServiceContext): Promise<void>;

  /** 停止服务；由平台在 stopping 阶段调用，必须先于 Fork 撤销完成。 */
  stop(): Promise<void>;

  /** 健康检查；声明 `healthCheck` 时由平台按周期调用；必须无副作用、幂等、只读。 */
  health?(): Promise<boolean>;

  /** 接收文件关联投递；manifest 声明 `fileAssociations` 时必须实现。 */
  handleFile?(uri: string): Promise<void>;
}
