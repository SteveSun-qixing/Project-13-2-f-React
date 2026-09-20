/**
 * chips-native（Neon 绑定）ABI 类型声明。
 *
 * 事实源：`abi/export-surface.json` 与《核心接口规范》§8.6 导出总表；
 * 本文件只声明 JS 侧可见形状，不承载实现。声明面与运行时导出面必须一致：
 * 未在本文件声明的函数不注册，未注册的函数不在本文件声明。
 *
 * 能力执行导出（`bridgeRegister` / `bridgeUnregister` / `bridgeRequest` /
 * `bridgeCancelSession`）、激活与会话扩展导出（`bridgeActivateProvider` /
 * `bridgeDeactivateProvider` / `bridgeGrantCapabilityId` / `bridgeOpenSession` /
 * `bridgeCloseSession` / `bridgeShutdown`，《核心接口规范》§5.5–§5.7）与元信息、
 * Context、取消令牌导出共用本入口；导出表只增不改，签名变化递增 `coreAbiVersion`。
 *
 * 约束：
 * - 句柄（ContextHandle / CancelTokenHandle）不透明、无字段、不可序列化；
 * - 时间与 ID 用 number（ID 低于 2^53）；
 * - 二进制一律 `Uint8Array`（主进程 Buffer 为其子类），禁止 base64。
 */

declare const contextHandleBrand: unique symbol;
declare const cancelTokenHandleBrand: unique symbol;

/** 不透明 Context 句柄；由内核插件管理层创建并经 `context*` 系列使用。 */
export interface ContextHandle {
  readonly [contextHandleBrand]: 'chips-native.context';
}

/** 不透明取消令牌句柄；`createCancelToken` 创建，`cancelTokenCancel` 触发。 */
export interface CancelTokenHandle {
  readonly [cancelTokenHandleBrand]: 'chips-native.cancel-token';
}

/** 能力执行上下文；与 `ICapabilityContext` 一致（《核心接口规范》§5.3）。 */
export interface INativeCapabilityContext {
  /** 取消信号；会话销毁、超时、能力注销或 Bridge 关闭时触发。 */
  readonly signal: AbortSignal;
  /** 调用截止时间（Unix epoch 毫秒）；内核准入时即确定。 */
  readonly deadline: number;
}

/** TS 能力注册形状；`handler` 在 JS 线程调用，返回值被等待。 */
export interface INativeCapabilityRegistration {
  descriptor: {
    id: string;
    schema: Record<string, unknown>;
    permissions: string[];
  };
  owner: string;
  timeoutMs: number;
  concurrency: 'parallel' | 'serial';
  maxQueue: number;
  handler: (input: unknown, ctx: INativeCapabilityContext) => Promise<unknown>;
}

/** 能力调用请求；`bin` 为 `x-chips-binary` 字段的字节表（键为 JSON Pointer）。 */
export interface INativeBridgeRequest {
  requestId: string;
  capabilityId: string;
  sessionId: number;
  input: unknown;
  bin?: Record<string, Uint8Array>;
}

/**
 * 提供方登记（《核心接口规范》§5.5 `ProviderRegistration` 的 JS 侧形状）；
 * `permissions` 为 manifest 声明的申请权限集合。
 */
export interface INativeProviderRegistration {
  /** 提供方标识（反向域名式插件 ID 或平台服务域 ID）。 */
  id: string;
  /** 提供方类别；与内核 `ProviderKind` 逐值对应。 */
  kind: 'platformService' | 'servicePlugin';
  /** manifest 声明的权限 ID 集合（安装时提交的申请集合）。 */
  permissions: string[];
}

/**
 * 会话登记快照（《核心接口规范》§5.6 `open_session` 入参的 JS 侧形状）；
 * 授权变更后重新登记即按新快照覆盖。
 */
export interface INativeSessionRegistration {
  /** 会话键（低于 2^53 的非负整数）。 */
  sessionId: number;
  /** 承载会话的插件 ID。 */
  pluginId: string;
  /** 会话授权权限快照。 */
  grantedPermissions: string[];
}

/** 平台版本；与全部平台包同一版本号。 */
export function coreVersion(): string;

/** 原生绑定 ABI 版本；导出面不兼容变化时递增。 */
export function coreAbiVersion(): number;

/** 在当前 Context 注册服务；同名服务被替换并触发级联重建。 */
export function contextProvide(handle: ContextHandle, name: string, value: unknown): void;

/** 声明依赖并注入回调；依赖就绪时回调在 JS 线程调用，参数为 Context 句柄。 */
export function contextInject(
  handle: ContextHandle,
  dependencies: readonly string[],
  callback: (ctx: ContextHandle) => void
): number;

/** 按作用域链获取服务；未注册返回 undefined，非 JS 服务返回类型不匹配错误。 */
export function contextGet(handle: ContextHandle, name: string): unknown;

/** 订阅事件；`once` 为真时首次投递后自动退订；返回监听令牌。 */
export function contextOn(
  handle: ContextHandle,
  event: string,
  listener: (payload: unknown) => void,
  once: boolean
): number;

/** 退订；幂等。 */
export function contextUnsubscribe(handle: ContextHandle, token: number): void;

/** 同步广播事件；无监听器零分配。 */
export function contextEmit(handle: ContextHandle, event: string, payload: unknown): void;

/** 登记自定义清理逻辑；随当前 Fork 撤销。 */
export function contextEffect(handle: ContextHandle, cleanup: () => void): void;

/** 创建取消令牌。 */
export function createCancelToken(): CancelTokenHandle;

/** 触发取消；幂等；可从任意线程调用。 */
export function cancelTokenCancel(token: CancelTokenHandle): void;

/** 注册 TS 能力并持有其 handler；注册期校验失败抛出 `ChipsError` 同构错误。 */
export function bridgeRegister(registration: INativeCapabilityRegistration): void;

/** 注销能力；在途调用由内核按取消收口。 */
export function bridgeUnregister(capabilityId: string): void;

/**
 * 发起一次能力调用；输入按 `{ json, bin }` 信封解码，输出中 `x-chips-binary`
 * 位置以 `Uint8Array` 嵌回；失败以 `ChipsError` 同构 `Error` 拒绝。
 */
export function bridgeRequest(request: INativeBridgeRequest): Promise<unknown>;

/** 取消会话全部在途调用；幂等；会话保持可用。 */
export function bridgeCancelSession(sessionId: number): void;

/**
 * 登记并激活提供方（§5.5）；激活后其能力方可注册，`permissions` 为 manifest
 * 申请的权限集合。失败以 `ChipsError` 同构 `Error` 抛出（权限 ID 未注册 →
 * `PERMISSION_UNKNOWN`；内核已关闭 → `BRIDGE_CANCELLED`）；重复激活同 ID 覆盖。
 */
export function bridgeActivateProvider(registration: INativeProviderRegistration): void;

/** 停用提供方（§5.5）；注销其全部能力并在途调用按取消收口；幂等，无错误返回。 */
export function bridgeDeactivateProvider(owner: string): void;

/**
 * 登记第三方能力 ID 并绑定提供方（§5.5 / 契约 §9.1）；绑定不可转让、不可改绑。
 * 失败以 `ChipsError` 同构 `Error` 抛出（文法非法 / 内置保留 / 改绑 →
 * `BRIDGE_CAPABILITY_CONFLICT`；提供方未激活 → `KERNEL_INVALID_TRANSITION`）。
 */
export function bridgeGrantCapabilityId(capabilityId: string, owner: string): void;

/**
 * 登记会话快照（§5.6）；`request` 前的会话登记前置，授权变更重新登记即覆盖。
 * 失败以 `ChipsError` 同构 `Error` 抛出（内核已关闭 → `BRIDGE_CANCELLED`）。
 */
export function bridgeOpenSession(session: INativeSessionRegistration): void;

/** 关闭会话（§5.6）；拒绝新调用并取消该会话全部在途调用；幂等，无错误返回。 */
export function bridgeCloseSession(sessionId: number): void;

/**
 * 关闭进程级 Bridge 内核（§5.7）；取消全部在途调用并拒绝新请求；幂等。
 * 仅关闭内核状态，不停止 Neon 绑定自身的运行时。
 */
export function bridgeShutdown(): void;
