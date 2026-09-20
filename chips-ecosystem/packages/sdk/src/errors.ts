/**
 * 统一错误模型（02-SDK-API规范 §6）。
 *
 * 全生态只有一个错误类 `ChipsError`；`IChipsError` 仅作结构别名。
 * SDK 自身只产生 `SDK_BRIDGE_UNAVAILABLE`、`SDK_INVALID_SCAFFOLD_OPTIONS` 与
 * `SDK_UNKNOWN_ERROR` 三个错误码（§6.3、§8.4），
 * 平台错误码由 Bridge、资源、权限、事件等权威文档维护，本模块不复制清单。
 */

/** 构造 `ChipsError` 的初始化结构。 */
export interface IChipsErrorInit {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly retryable?: boolean;
}

/** `ChipsError` 的结构别名；跨 Bridge 传输的始终是普通对象。 */
export interface IChipsError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}

/** SDK 自身错误码：客户端未绑定任何 Bridge。 */
export const SDK_BRIDGE_UNAVAILABLE = 'SDK_BRIDGE_UNAVAILABLE';

/** SDK 自身错误码：脚手架参数不合法（02-SDK-API规范 §6.3、§8.4）。 */
export const SDK_INVALID_SCAFFOLD_OPTIONS = 'SDK_INVALID_SCAFFOLD_OPTIONS';

/** SDK 自身错误码：`toChipsError` 的兜底错误码。 */
export const SDK_UNKNOWN_ERROR = 'SDK_UNKNOWN_ERROR';

const UNKNOWN_ERROR_MESSAGE = '发生未知错误';

/** 统一错误类：`instanceof` 判定与类型收窄的唯一入口。 */
export class ChipsError extends Error implements IChipsError {
  readonly code: string;

  readonly details?: unknown;

  readonly retryable: boolean;

  constructor(init: IChipsErrorInit) {
    super(init.message);
    this.name = 'ChipsError';
    this.code = init.code;
    this.details = init.details;
    this.retryable = init.retryable ?? false;
  }
}

/**
 * 错误结构守卫：`code` 与 `message` 均为字符串即通过。
 *
 * 同时接受类实例与跨 Bridge 传输后的同构普通对象；不读取原型链。
 *
 * @param value - 待判定的值
 * @returns 是否为 `ChipsError` 结构
 */
export function isChipsError(value: unknown): value is ChipsError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record['code'] === 'string' && typeof record['message'] === 'string';
}

function isErrorInstance(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * 错误归一：把任意抛出值转换为 `ChipsError`（02-SDK-API规范 §5.2）。
 *
 * - `ChipsError` 实例原样返回；
 * - 同构普通对象构造同字段的 `ChipsError`，保留 `details` 与 `retryable`；
 * - 其他 `Error` 实例归一为 `SDK_UNKNOWN_ERROR`，`details` 为 `{ name, cause }`；
 * - 非 `Error` 值归一为 `SDK_UNKNOWN_ERROR`，`details` 为 `{ value: String(error) }`。
 *
 * @param error - 任意抛出值
 * @returns 归一后的 `ChipsError`
 */
export function toChipsError(error: unknown): ChipsError {
  if (error instanceof ChipsError) {
    return error;
  }
  if (isChipsError(error)) {
    const plain = error as IChipsError;
    const init: IChipsErrorInit = {
      code: plain.code,
      message: plain.message,
      retryable: plain.retryable ?? false,
      ...(plain.details !== undefined ? { details: plain.details } : {}),
    };
    return new ChipsError(init);
  }
  if (isErrorInstance(error)) {
    return new ChipsError({
      code: SDK_UNKNOWN_ERROR,
      message: UNKNOWN_ERROR_MESSAGE,
      details: { name: error.name, cause: error.message },
      retryable: false,
    });
  }
  return new ChipsError({
    code: SDK_UNKNOWN_ERROR,
    message: UNKNOWN_ERROR_MESSAGE,
    details: { value: String(error) },
    retryable: false,
  });
}

/**
 * 构造 `SDK_BRIDGE_UNAVAILABLE`：客户端未绑定任何 Bridge。
 *
 * @returns 未绑定 Bridge 的错误
 */
export function bridgeUnavailableError(): ChipsError {
  return new ChipsError({
    code: SDK_BRIDGE_UNAVAILABLE,
    message: '未找到可用的 Bridge：window.chips 尚未注入',
    retryable: false,
  });
}
