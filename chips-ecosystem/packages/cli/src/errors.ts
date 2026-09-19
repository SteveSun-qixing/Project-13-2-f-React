/**
 * CLI 错误模型与退出码映射。
 *
 * 单一事实源：
 * - 错误码表、退出码表、错误对象形状：[CLI 完整参考] §2.5、§2.6；
 * - 其他领域错误码（`CPK_*` / `CONFIG_*` / `UPDATE_*` / `PLUGIN_*` / `BRIDGE_*`）保留原样，
 *   CLI 只负责映射退出码。
 */

/** 进程退出码（[CLI 完整参考] §2.5）。 */
export type CliExitCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 130;

/** 合法退出码集合（跨进程传入的 `exitCode` 提示按此白名单采信）。 */
const EXIT_CODE_SET: ReadonlySet<number> = new Set<number>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 130]);

/** CLI 自有错误码（`cli-command` / `cli-task` 契约登记，[CLI 完整参考] §2.6）。 */
export type CliErrorCode =
  | 'CLI_ARGUMENT_INVALID'
  | 'CLI_COMMAND_QUERY_INVALID'
  | 'CLI_COMMAND_NOT_FOUND'
  | 'CLI_COMMAND_CONFLICT'
  | 'CLI_PERMISSION_DENIED'
  | 'CLI_PATH_NOT_FOUND'
  | 'CLI_PATH_INVALID'
  | 'CLI_OUTPUT_EXISTS'
  | 'CLI_OUTPUT_RENAME_EXHAUSTED'
  | 'CLI_BATCH_INVALID'
  | 'CLI_TARGET_UNAVAILABLE'
  | 'CLI_TASK_INVALID'
  | 'CLI_TASK_NOT_FOUND'
  | 'CLI_TASK_FAILED'
  | 'CLI_TASK_CANCELLED'
  | 'CLI_TIMEOUT'
  | 'CLI_COMMAND_FAILED';

/** CLI 自有错误码 → 退出码。 */
const CLI_EXIT_CODES: Readonly<Record<CliErrorCode, CliExitCode>> = {
  CLI_ARGUMENT_INVALID: 2,
  CLI_COMMAND_QUERY_INVALID: 2,
  CLI_COMMAND_NOT_FOUND: 3,
  CLI_COMMAND_CONFLICT: 3,
  CLI_PERMISSION_DENIED: 4,
  CLI_PATH_NOT_FOUND: 5,
  CLI_PATH_INVALID: 5,
  CLI_OUTPUT_EXISTS: 5,
  CLI_OUTPUT_RENAME_EXHAUSTED: 5,
  CLI_BATCH_INVALID: 5,
  CLI_TARGET_UNAVAILABLE: 6,
  CLI_TASK_INVALID: 1,
  CLI_TASK_NOT_FOUND: 1,
  CLI_TASK_FAILED: 7,
  CLI_TASK_CANCELLED: 8,
  CLI_TIMEOUT: 9,
  CLI_COMMAND_FAILED: 1,
};

/** 跨领域错误码 → 退出码（未列出者按 `1` 一般失败）。 */
const CROSS_DOMAIN_EXIT_CODES: Readonly<Record<string, CliExitCode>> = {
  PLUGIN_PERMISSION_DENIED: 4,
  BRIDGE_PERMISSION_DENIED: 4,
  FILE_ASSOCIATION_TARGET_INVALID: 5,
  PLUGIN_NOT_FOUND: 6,
  PLUGIN_DISABLED: 6,
  BRIDGE_CAPABILITY_NOT_FOUND: 6,
  BRIDGE_TIMEOUT: 9,
};

/** 错误码缺省简体中文文案；调用方可覆盖为更具体的消息。 */
export const CLI_ERROR_MESSAGES: Readonly<Record<CliErrorCode, string>> = {
  CLI_ARGUMENT_INVALID: '命令参数无效',
  CLI_COMMAND_QUERY_INVALID: '命令查询参数无效',
  CLI_COMMAND_NOT_FOUND: '未找到匹配的命令',
  CLI_COMMAND_CONFLICT: '命令路径存在冲突',
  CLI_PERMISSION_DENIED: '权限不足，命令被拒绝',
  CLI_PATH_NOT_FOUND: '路径不存在',
  CLI_PATH_INVALID: '路径不满足声明规则',
  CLI_OUTPUT_EXISTS: '输出路径已存在',
  CLI_OUTPUT_RENAME_EXHAUSTED: '无法为输出路径找到可用名称',
  CLI_BATCH_INVALID: '批量输入无效',
  CLI_TARGET_UNAVAILABLE: '目标不可用：承载环境缺失或目标类型不受支持',
  CLI_TASK_INVALID: '任务请求无效',
  CLI_TASK_NOT_FOUND: '任务不存在',
  CLI_TASK_FAILED: '任务执行失败',
  CLI_TASK_CANCELLED: '任务已取消',
  CLI_TIMEOUT: '等待任务或承载链路超时',
  CLI_COMMAND_FAILED: '命令执行失败',
};

/** 错误对象形状（[CLI 完整参考] §2.6）；跨进程消费的稳定接口。 */
export interface IChipsErrorShape {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly retryable?: boolean;
}

/** 构造选项。 */
export interface IChipsErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly retryable?: boolean;
  /**
   * 显式退出码：错误码来自其他领域（`CPK_*` / `PLUGIN_*` / 插件自定义码）时，退出码由
   * **失败类别**决定而非码值，例如任务失败终态固定为 7（[CLI 完整参考] §2.5）。
   * 缺省按 §2.5、§2.6 的码值映射。
   */
  readonly exitCode?: CliExitCode;
}

/**
 * CLI 进程侧错误类：与全生态 `ChipsError` 同形状、同语义（`code` / `message` / `details` / `retryable`）。
 *
 * 平台边界传入的错误对象经 {@link normalizeError} 归一为本类；跨进程输出只使用
 * {@link toErrorObject} 的四字段形状（[CLI 完整参考] §2.6）。`exitCode` 是 CLI 内部的退出码
 * 提示（失败类别优先于码值映射），不进入输出形状。
 */
export class ChipsError extends Error {
  public readonly code: string;

  public readonly details: unknown;

  public readonly retryable: boolean | undefined;

  public readonly exitCode: CliExitCode | undefined;

  public constructor(options: IChipsErrorOptions) {
    super(options.message);
    this.name = 'ChipsError';
    this.code = options.code;
    if (options.details !== undefined) {
      this.details = options.details;
    }
    if (options.retryable !== undefined) {
      this.retryable = options.retryable;
    }
    if (options.exitCode !== undefined) {
      this.exitCode = options.exitCode;
    }
  }
}

/**
 * 用户中断（`Ctrl+C`）内部控制流：退出码 130 没有错误码（[CLI 完整参考] §2.5），
 * 因此不进入 `ChipsError` 输出链路，由入口编排直接以 130 结束。
 */
export class CliInterruptedError extends Error {
  public constructor() {
    super('用户中断');
    this.name = 'CliInterruptedError';
  }
}

/** 判断任意值是否携带字符串 `code`（错误对象形状预检）。 */
export function hasErrorCode(value: unknown): value is { code: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code?: unknown }).code === 'string'
  );
}

/** 把平台边界或未知异常归一为 `ChipsError`。 */
export function normalizeError(value: unknown): ChipsError {
  if (value instanceof ChipsError) {
    return value;
  }
  if (hasErrorCode(value)) {
    const record = value as {
      code: string;
      message?: unknown;
      details?: unknown;
      retryable?: unknown;
      exitCode?: unknown;
    };
    const options: IChipsErrorOptions = {
      code: record.code,
      message:
        typeof record.message === 'string' ? record.message : CLI_ERROR_MESSAGES.CLI_COMMAND_FAILED,
    };
    if (record.details !== undefined) {
      (options as { details?: unknown }).details = record.details;
    }
    if (typeof record.retryable === 'boolean') {
      (options as { retryable?: boolean }).retryable = record.retryable;
    }
    const carried = record.exitCode;
    if (typeof carried === 'number' && EXIT_CODE_SET.has(carried)) {
      (options as { exitCode?: CliExitCode }).exitCode = carried as CliExitCode;
    }
    return new ChipsError(options);
  }
  const message = value instanceof Error ? value.message : String(value);
  return new ChipsError({ code: 'CLI_COMMAND_FAILED', message });
}

/** 构造带缺省文案的 CLI 错误。 */
export function cliError(
  code: string,
  message?: string,
  details?: unknown,
  retryable?: boolean
): ChipsError {
  return cliErrorWithExitCode(code, undefined, message, details, retryable);
}

/**
 * 构造携带显式退出码的 CLI 错误：错误码保留原样（可能是插件自定义码），退出码由失败类别决定
 * （[CLI 完整参考] §2.5，如任务失败终态固定为 7）。
 */
export function cliErrorWithExitCode(
  code: string,
  exitCode: CliExitCode | undefined,
  message?: string,
  details?: unknown,
  retryable?: boolean
): ChipsError {
  const options: IChipsErrorOptions = {
    code,
    message: message ?? CLI_ERROR_MESSAGES[code as CliErrorCode] ?? code,
  };
  if (details !== undefined) {
    (options as { details?: unknown }).details = details;
  }
  if (retryable !== undefined) {
    (options as { retryable?: boolean }).retryable = retryable;
  }
  if (exitCode !== undefined) {
    (options as { exitCode?: CliExitCode }).exitCode = exitCode;
  }
  return new ChipsError(options);
}

/** 错误对象（stdout 单一对象，[CLI 完整参考] §2.6）。 */
export function toErrorObject(error: ChipsError): IChipsErrorShape {
  const object: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
  } = {
    code: error.code,
    message: error.message,
  };
  if (error.details !== undefined) {
    object.details = error.details;
  }
  if (error.retryable !== undefined) {
    object.retryable = error.retryable;
  }
  return object;
}

/** 错误码 → 退出码（[CLI 完整参考] §2.5）。 */
export function exitCodeForCode(code: string): CliExitCode {
  const cliCode = CLI_EXIT_CODES[code as CliErrorCode];
  if (cliCode !== undefined) {
    return cliCode;
  }
  const crossDomain = CROSS_DOMAIN_EXIT_CODES[code];
  if (crossDomain !== undefined) {
    return crossDomain;
  }
  return 1;
}

/** 错误 → 退出码：显式提示优先，其次码值映射（[CLI 完整参考] §2.5）。 */
export function exitCodeForError(error: ChipsError): CliExitCode {
  return error.exitCode ?? exitCodeForCode(error.code);
}
