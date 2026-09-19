/**
 * 统一错误模型：全生态只有 `ChipsError` 一个错误类（02-Bridge三层设计 §9、01-Bridge-API规范 §2.5）。
 *
 * - 跨 Bridge 传输的错误必须是普通对象（`toPlain()`），不得传输 `Error` 实例；
 * - `message` 一律简体中文、面向用户；`details` 只承载结构化诊断，不含输入原文、凭证与内部路径；
 * - 调用方必须按 `code` 分支处理错误，禁止匹配 `message` 文本。
 */

export interface IChipsError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}

export interface IChipsErrorOptions {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}

export class ChipsError extends Error implements IChipsError {
  readonly code: string;

  readonly details: unknown;

  readonly retryable: boolean;

  constructor(options: IChipsErrorOptions) {
    super(options.message);
    this.name = 'ChipsError';
    this.code = options.code;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
  }

  /** 归一为结构化克隆兼容的普通对象，用于跨 IPC / Neon 传输。 */
  toPlain(): IChipsError {
    const plain: IChipsError = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
    if (this.details !== undefined) {
      plain.details = this.details;
    }
    return plain;
  }

  static isChipsError(value: unknown): value is ChipsError {
    return value instanceof ChipsError;
  }

  static fromPlain(value: IChipsError): ChipsError {
    return new ChipsError({
      code: value.code,
      message: value.message,
      retryable: value.retryable ?? false,
      ...(value.details !== undefined ? { details: value.details } : {}),
    });
  }
}

/** 结构判定：接收方（preload / Host 适配层）无需依赖原型链即可识别普通对象形态的 `ChipsError`。 */
export function isPlainChipsError(value: unknown): value is IChipsError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.code === 'string' &&
    record.code.length > 0 &&
    typeof record.message === 'string' &&
    (record.retryable === undefined || typeof record.retryable === 'boolean')
  );
}

/** Bridge 通道级错误码（02-Bridge三层设计 §9.2）。 */
export const BRIDGE_ERROR_CODES = {
  capabilityNotFound: 'BRIDGE_CAPABILITY_NOT_FOUND',
  capabilityConflict: 'BRIDGE_CAPABILITY_CONFLICT',
  invalidSchema: 'BRIDGE_INVALID_SCHEMA',
  permissionDenied: 'BRIDGE_PERMISSION_DENIED',
  invalidInput: 'BRIDGE_INVALID_INPUT',
  timeout: 'BRIDGE_TIMEOUT',
  cancelled: 'BRIDGE_CANCELLED',
  sessionUnknown: 'BRIDGE_SESSION_UNKNOWN',
  sessionBusy: 'BRIDGE_SESSION_BUSY',
  queueOverflow: 'BRIDGE_QUEUE_OVERFLOW',
  internal: 'BRIDGE_INTERNAL',
} as const;

export type BridgeErrorCode = (typeof BRIDGE_ERROR_CODES)[keyof typeof BRIDGE_ERROR_CODES];

/** Bridge 通道级错误码的 `retryable` 口径（02-Bridge三层设计 §9.2）。 */
export const BRIDGE_ERROR_RETRYABLE: Readonly<Record<BridgeErrorCode, boolean>> = {
  BRIDGE_CAPABILITY_NOT_FOUND: false,
  BRIDGE_CAPABILITY_CONFLICT: false,
  BRIDGE_INVALID_SCHEMA: false,
  BRIDGE_PERMISSION_DENIED: false,
  BRIDGE_INVALID_INPUT: false,
  BRIDGE_TIMEOUT: true,
  BRIDGE_CANCELLED: false,
  BRIDGE_SESSION_UNKNOWN: false,
  BRIDGE_SESSION_BUSY: true,
  BRIDGE_QUEUE_OVERFLOW: true,
  BRIDGE_INTERNAL: false,
};

/** 面向用户的简体中文文案（不暴露堆栈与内部路径）。 */
export const BRIDGE_ERROR_MESSAGES: Readonly<Record<BridgeErrorCode, string>> = {
  BRIDGE_CAPABILITY_NOT_FOUND: '能力不存在或已注销',
  BRIDGE_CAPABILITY_CONFLICT: '能力注册冲突',
  BRIDGE_INVALID_SCHEMA: '能力输入类型定义不合法',
  BRIDGE_PERMISSION_DENIED: '插件缺少所需权限',
  BRIDGE_INVALID_INPUT: '能力输入不合法',
  BRIDGE_TIMEOUT: '能力调用超时',
  BRIDGE_CANCELLED: '能力调用已取消',
  BRIDGE_SESSION_UNKNOWN: '会话不存在或已关闭',
  BRIDGE_SESSION_BUSY: '会话在途调用过多，请稍后重试',
  BRIDGE_QUEUE_OVERFLOW: '能力调用排队已满，请稍后重试',
  BRIDGE_INTERNAL: '平台内部错误',
};

/** 能力注册期使用的权限错误码（04-能力契约规范 §4.2、第十一节）。 */
export const PERMISSION_ERROR_CODES = {
  notDeclared: 'PERMISSION_NOT_DECLARED',
  unknown: 'PERMISSION_UNKNOWN',
} as const;

/** 注册上下文 owner 未处于激活状态的内核生命周期错误码（04-能力契约规范 §4.2 校验 7）。 */
export const KERNEL_INVALID_TRANSITION = 'KERNEL_INVALID_TRANSITION';

export interface ICreateBridgeErrorOptions {
  message?: string;
  details?: unknown;
  retryable?: boolean;
}

/** 按错误码构造 `ChipsError`，缺省使用错误码表文案与 `retryable` 口径。 */
export function createBridgeError(
  code: BridgeErrorCode,
  options: ICreateBridgeErrorOptions = {}
): ChipsError {
  return new ChipsError({
    code,
    message: options.message ?? BRIDGE_ERROR_MESSAGES[code],
    retryable: options.retryable ?? BRIDGE_ERROR_RETRYABLE[code],
    ...(options.details !== undefined ? { details: options.details } : {}),
  });
}

export interface INormalizeErrorOptions {
  /** 诊断回调：未识别异常在此写入宿主日志（不进入跨 Bridge 返回）。 */
  onDiagnostic?: (error: unknown) => void;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * 错误归一（02-Bridge三层设计 §9.1）：
 * `ChipsError` 原样返回；普通对象形态错误同构还原（Host 业务错误码原样透传）；
 * 取消异常归一为 `BRIDGE_CANCELLED`；其余未识别异常归一为 `BRIDGE_INTERNAL`，details 不携带堆栈与内部路径。
 */
export function normalizeError(error: unknown, options: INormalizeErrorOptions = {}): ChipsError {
  if (error instanceof ChipsError) {
    return error;
  }
  if (isPlainChipsError(error)) {
    return ChipsError.fromPlain(error);
  }
  if (isAbortError(error)) {
    return createBridgeError(BRIDGE_ERROR_CODES.cancelled);
  }
  options.onDiagnostic?.(error);
  return createBridgeError(BRIDGE_ERROR_CODES.internal);
}
