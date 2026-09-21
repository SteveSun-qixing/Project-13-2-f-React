/**
 * 承载链路服务端类型与在册服务路由集合（《17-CLI承载链路契约》波 1，宿主服务端实现面）。
 *
 * 权威：《17》§5.1（在册 `routeId` 集合逐字冻结）、§3.4（封套复用 Bridge 形状）、
 * §5.3（错误面：零新码族 + `details.reason` 词表）；负载字段形状权威在
 * 《07-CLI完整参考》§5.6/§5.8（本模块只做服务端结构视图，不重定义语义）。
 *
 * @remarks
 * - 协议字面量、封套别名、`reason` 词表与端点派生一律取自 `@chips/bridge` 协议分件
 *   （`deriveCarrierEndpoints` 等），本模块**禁止**出现第二份字面量（《17》§6.1-1 红线）。
 * - 本模块登记的 `CLI_*` 码值是《07-CLI完整参考》§2.5 码表在服务端实现面的**消费视图**
 *   （码值与简体中文文案逐字对齐 §2.5 表；文案为服务端封套缺省，CLI 侧映射不改写）。
 *   这些码不在 `@chips/bridge` 代码面（用户可见码表权威是文档 §2.5），宿主与 CLI 两侧
 *   各自对文档实现、由契约测试锁逐字一致，不属于 §6.1-1 的封套/派生复刻红线面。
 */

import type { ICarrierRequest, ICarrierResponse, CarrierHandshakeReason } from '@chips/bridge';
import { CARRIER_HANDSHAKE_REASONS } from '@chips/bridge';

/** 承载请求封套（别名再导出，唯一来源 `@chips/bridge`）。 */
export type CarrierRequest = ICarrierRequest;

/** 承载响应封套（别名再导出，唯一来源 `@chips/bridge`）。 */
export type CarrierResponse = ICarrierResponse;

/**
 * 承载链路在册服务路由集合（《17》§5.1 逐字冻结：§5.8 全集 + `command:invoke`，
 * 不得扩充、不得别名）。
 */
export const CARRIER_ROUTE_IDS = [
  'cli.command.list',
  'cli.command.get',
  'cli.command.resolve',
  'cli.task.create',
  'cli.task.bindInvocation',
  'cli.task.get',
  'cli.task.progress',
  'cli.task.complete',
  'cli.task.fail',
  'cli.task.cancel',
  'command:invoke',
] as const;

/** 在册 `routeId` 联合类型。 */
export type CarrierRouteId = (typeof CARRIER_ROUTE_IDS)[number];

/** 承载服务端消费的 §2.5 在册码表（零新码族：只允许登记值，禁止造码）。 */
export const CARRIER_SERVICE_ERROR_CODES = {
  /** 传输/握手/非在册路由统一收敛码（《17》§5.3）。 */
  targetUnavailable: 'CLI_TARGET_UNAVAILABLE',
  /** 发现查询参数非法（§5.8）。 */
  commandQueryInvalid: 'CLI_COMMAND_QUERY_INVALID',
  /** 未找到匹配命令（§2.5）。 */
  commandNotFound: 'CLI_COMMAND_NOT_FOUND',
  /** 命令路径多匹配冲突（§5.8）。 */
  commandConflict: 'CLI_COMMAND_CONFLICT',
  /** 任务不存在（§5.8）。 */
  taskNotFound: 'CLI_TASK_NOT_FOUND',
  /** 任务请求无效（终态跃迁非法、归属越权等，§5.6）。 */
  taskInvalid: 'CLI_TASK_INVALID',
  /** 失败上报缺省收口码（§5.6 `fail` 归一）。 */
  taskFailed: 'CLI_TASK_FAILED',
  /** 权限不足（承载面按既有域码透出，§4.4-3）。 */
  permissionDenied: 'CLI_PERMISSION_DENIED',
} as const;

/** §2.5 码表缺省简体中文文案（服务端封套缺省，与 §2.5 表逐字一致）。 */
export const CARRIER_SERVICE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  CLI_TARGET_UNAVAILABLE: '目标不可用：承载环境缺失或目标类型不受支持',
  CLI_COMMAND_QUERY_INVALID: '命令查询参数无效',
  CLI_COMMAND_NOT_FOUND: '未找到匹配的命令',
  CLI_COMMAND_CONFLICT: '命令路径存在冲突',
  CLI_TASK_NOT_FOUND: '任务不存在',
  CLI_TASK_INVALID: '任务请求无效',
  CLI_TASK_FAILED: '任务执行失败',
  CLI_PERMISSION_DENIED: '权限不足，命令被拒绝',
};

/**
 * 承载会话面运行时判定/装配错误使用的宿主内部在册码（`BRIDGE_INTERNAL`）。
 *
 * @remarks 复用宿主 `protocol/error-codes.ts` 单一来源，不在本模块复制码值字面量。
 */
export { BRIDGE_ERROR_CODES } from '../protocol/error-codes.js';

/**
 * 承载服务端可抛出错误对象：`Error` 子类 + `IWireChipsError` 结构（lint 纪律要求
 * 抛出值必须是错误对象；封套序列化字段与 `bridgeWireError` 输出逐字段一致）。
 *
 * @remarks `message` 默认不可枚举会导致帧 `JSON.stringify` 丢字段，这里显式恢复可枚举
 * （§3.5 序列化纪律：错误封套完整落帧）；`name` 与原生 `Error.prototype.name` 同型保持
 * 不可枚举（`bridgeWireError` 输出的封套字段只有 `code/message/retryable/details`，
 * 实例直接落帧时不得携带 `name`，由契约测试锁逐字段一致）。
 */
export class CarrierWireError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(init: {
    readonly code: string;
    readonly message: string;
    readonly retryable?: boolean;
    readonly details?: unknown;
  }) {
    super(init.message);
    Object.defineProperty(this, 'name', {
      value: 'CarrierWireError',
      enumerable: false,
      writable: true,
      configurable: true,
    });
    this.code = init.code;
    this.retryable = init.retryable ?? false;
    if (init.details !== undefined) {
      this.details = init.details;
    }
    Object.defineProperty(this, 'message', {
      value: init.message,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
}

/** 构造承载封套/握手错误对象（§3.5-4：只携带已登记码、简体中文消息与非敏感 `details`）。 */
export function carrierServiceError(code: string, details?: unknown, message?: string): CarrierWireError {
  return new CarrierWireError({
    code,
    message: message ?? CARRIER_SERVICE_ERROR_MESSAGES[code] ?? '命令执行失败',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

/** 构造 `CLI_TARGET_UNAVAILABLE` + `details.reason` 词表错误（《17》§5.3 传输/握手层定性）。 */
export function carrierReasonError(reason: CarrierHandshakeReason, extraDetails?: unknown): CarrierWireError {
  const details = extraDetails === undefined ? { reason } : { reason, ...(extraDetails as Record<string, unknown>) };
  return carrierServiceError(CARRIER_SERVICE_ERROR_CODES.targetUnavailable, details);
}

/** 握手失败帧判定：`reason` 必须落在封闭词表内（契约测试锁共用）。 */
export function isCarrierHandshakeReason(value: unknown): value is CarrierHandshakeReason {
  return typeof value === 'string' && (Object.values(CARRIER_HANDSHAKE_REASONS) as readonly string[]).includes(value);
}

/** 任务状态（§5.6：终态不可逆）。 */
export type CliTaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/** CLI 任务记录（§5.6 `CliTaskRecord` 的服务端结构视图，字段逐字一致）。 */
export interface ICliTaskRecord {
  readonly taskId: string;
  readonly pluginId: string;
  readonly commandId: string;
  readonly commandPath?: readonly string[];
  readonly status: CliTaskStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly progress?: Readonly<Record<string, unknown>>;
  readonly output?: unknown;
  readonly error?: { code: string; message: string; details?: unknown; retryable?: boolean };
}

/** 命令目标类型（§5.6）。 */
export type CliCommandTargetType = 'app' | 'service';

/** 发现查询参数（§5.6 `CliCommandQueryOptions` 的服务端结构视图）。 */
export interface ICliCommandQueryOptions {
  readonly entryId?: string;
  readonly commandPath?: string | readonly string[];
  readonly pluginId?: string;
  readonly targetType?: CliCommandTargetType;
  readonly includeDisabled?: boolean;
}

/** 冲突条目（§5.5/§5.6）。 */
export interface ICliCommandConflict {
  readonly entryId: string;
  readonly commandPath: readonly string[];
  readonly owner: string;
  readonly priority: number;
  readonly namespace?: string;
}

/** 命令视图（§5.6 `CliCommandView` 的服务端结构视图；`declaration` 为 manifest 条目原样视图）。 */
export interface ICliCommandView {
  readonly entryId: string;
  readonly commandPath: readonly string[];
  readonly commandId?: string;
  readonly owner: string;
  readonly enabled: boolean;
  readonly declaration: Readonly<Record<string, unknown>>;
  readonly conflicts: readonly ICliCommandConflict[];
}

/** 发现索引：命令路径键 → `entryId` 列表（§5.6/§5.8）。 */
export type CliCommandIndex = Readonly<Record<string, readonly string[]>>;

/** `cli.command.list` 结果（§5.8）。 */
export interface ICliCommandListResult {
  readonly index: CliCommandIndex;
  readonly commands: readonly ICliCommandView[];
}

/** `cli.command.resolve` 结果（§5.8：不自动选择冲突入口）。 */
export interface ICliCommandResolveResult {
  readonly command?: ICliCommandView;
  readonly conflicts: readonly ICliCommandConflict[];
}

/** 命令索引重建触发集（《17》§5.8 原文承诺 + 波 1 派单条款：安装、启用、禁用、卸载四事件）。 */
export const CLI_INDEX_REBUILD_EVENTS: readonly string[] = [
  'plugin:installed',
  'plugin:enabled',
  'plugin:disabled',
  'plugin:uninstalled',
];

/** `command:invoke` 输入（《13-命令系统契约》§3.2 `ICommandInvokeInput` 结构视图）。 */
export interface ICommandInvokeInput {
  readonly commandId: string;
  readonly payload?: unknown;
  readonly source: string;
  readonly context?: unknown;
}

/** `command:invoke` 输出（《13》§3.2 结构视图）。 */
export interface ICommandInvokeOutput {
  readonly invocationId: string;
  readonly commandId: string;
  readonly target: string;
  readonly status: 'completed' | 'dispatched';
}

/** 承载服务路由的调用上下文（握手后连接级信息；授权判定不得信任自报字段）。 */
export interface ICarrierCallContext {
  /** 统一会话注册表中的承载会话 ID（`carrier:<carrierId>`）。 */
  readonly sessionId: string;
  /** 握手帧自报的 CLI 进程实例标识（仅诊断关联）。 */
  readonly clientId: string;
  /** 会话取消信号（连接关闭 / 停机时触发，《17》§4.3）。 */
  readonly signal: AbortSignal;
}
