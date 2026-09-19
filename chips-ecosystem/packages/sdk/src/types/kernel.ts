/**
 * 主进程插件上下文类型（核心接口规范 §4.4、§4.6）。
 *
 * `Context` 由内核在 `Starting` 阶段注入主进程插件入口；渲染进程代码不使用 `Context`。
 * 主进程插件为注入服务补充类型时，对 `Context` 使用模块声明合并（02-SDK-API规范 §2.4）。
 */

/** 事件监听器；载荷类型由事件契约定义。 */
export type EventListener<TPayload> = (payload: TPayload) => void;

/** 内核事件订阅句柄；`dispose()` 幂等，监听器随当前 Fork 自动退订。 */
export interface IEventSubscription {
  /** 退订；幂等。 */
  dispose(): void;
}

/** `ctx.task` 选项。 */
export interface ITaskOptions {
  /** 任务名；用于诊断、配额计量与审计。 */
  name?: string;
  /** 额外的取消信号；内核取消（Fork 撤销、配额停用）同时生效。 */
  signal?: AbortSignal;
}

/** `ctx.task` 句柄。 */
export interface ITaskHandle<T> {
  readonly name: string | undefined;
  /** 可等待结果；任务取消以 `ChipsError` reject。 */
  readonly result: Promise<T>;
  /** 请求取消；幂等。 */
  cancel(): void;
}

/**
 * 插件运行时上下文：服务注册、依赖注入与作用域解析的唯一入口。
 *
 * 成员语义与失败行为见 03-核心接口规范 §4.4 表格；`ctx.summary` 之类的注入属性
 * 由模块声明合并提供，声明合并只扩展编译期类型、不产生运行时行为。
 */
export interface Context {
  /** 注册服务；同名替换旧实现。 */
  provide<T>(name: string, value: T): void;
  /** 声明依赖并注入回调；撤销由内核按依赖与 Fork 生命周期执行。 */
  inject(dependencies: readonly string[], callback: (ctx: Context) => void): void;
  /** 按作用域链获取服务；未注册返回 `undefined`。 */
  get<T>(name: string): T | undefined;
  /** 订阅事件；监听器随当前 Fork 自动退订。 */
  on<TPayload>(event: string, listener: EventListener<TPayload>): IEventSubscription;
  /** 订阅一次；首次投递后自动退订。 */
  once<TPayload>(event: string, listener: EventListener<TPayload>): IEventSubscription;
  /** 同步广播事件；无监听器零分配。 */
  emit<TPayload>(event: string, payload: TPayload): void;
  /** 登记自定义清理逻辑；随当前 Fork 撤销。 */
  effect(cleanup: () => void): void;
  /** 登记长任务到当前 Fork；参与配额与取消，对应内核 Effect::Task。 */
  task<T>(fn: (signal: AbortSignal) => T | Promise<T>, options?: ITaskOptions): ITaskHandle<T>;
}

/**
 * 插件命名空间生效值视图；默认值已合并，键为相对键。
 *
 * 由内核在 `apply` 前注入；配置只在加载时读取一次，运行期变更经 `config:changed` 重新读取。
 */
export interface PluginConfig {
  /** 键为相对键（不含命名空间前缀）；值已合并 schema 默认值。 */
  readonly values: Readonly<Record<string, unknown>>;
}
