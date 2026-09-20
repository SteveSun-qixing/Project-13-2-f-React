/**
 * CLI 错误模型与退出码映射。
 *
 * 单一事实源：
 * - 错误类与结构守卫：全生态唯一实现定义在 `@chips/bridge`（《RFC-ChipsError统一裁定》§3.2），
 *   本包只消费该定义并以薄再导出保持 `@chips/cli` 公开面（《CLI完整参考》§2.6）；
 * - 错误码表、退出码表、错误对象形状：[CLI 完整参考] §2.5、§2.6；
 * - 其他领域错误码（`CPK_*` / `CONFIG_*` / `UPDATE_*` / `PLUGIN_*` / `BRIDGE_*`）保留原样，
 *   CLI 只负责映射退出码。
 */

import { ChipsError, isChipsError } from '@chips/bridge';

/**
 * 全生态唯一错误类与结构守卫（`@chips/bridge` 定义的薄再导出）：CLI 不再有本地类定义，
 * `import { ChipsError } from '@chips/cli'` 与 `import { ChipsError } from '@chips/bridge'`
 * 取到同一个构造函数。
 */
export { ChipsError, isChipsError };
export type { IChipsError, IChipsErrorInit } from '@chips/bridge';

/** 进程退出码（[CLI 完整参考] §2.5）。 */
export type CliExitCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 130;

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

/**
 * 退出码提示旁表（《RFC-ChipsError统一裁定》§4.6）：`exitCode` **不是**错误对象成员，
 * 而是 CLI 进程内的输出事实。错误码来自其他领域、退出码由**失败类别**决定（而非码值映射）时，
 * 构造点用 {@link registerExitCodeHint} 登记提示；`exitCodeForError` 读旁表。
 *
 * 旁表以 `WeakMap` 承载：错误对象在本进程 catch 链上身份不变（{@link toCliError} 对本类实例
 * 原样返回），因此无提示丢失路径；提示永不跨进程、永不进入输出。
 */
const EXIT_CODE_HINTS = new WeakMap<ChipsError, CliExitCode>();

/**
 * 登记退出码提示（[CLI 完整参考] §2.5 的「失败类别优先于码值」例外，如任务失败终态固定 7）。
 * 仅限本进程内使用；不修改错误对象，也不进入任何输出形状。
 */
export function registerExitCodeHint(error: ChipsError, code: CliExitCode): void {
  EXIT_CODE_HINTS.set(error, code);
}

/**
 * 用户中断（`Ctrl+C`）内部控制流：退出码 130 没有错误码（[CLI 完整参考] §2.5），
 * 因此不进入 `ChipsError` 输出链路，由入口编排直接以 130 结束（《RFC-ChipsError统一裁定》§4.6）。
 */
export class CliInterruptedError extends Error {
  public constructor() {
    super('用户中断');
    this.name = 'CliInterruptedError';
  }
}

/**
 * 把平台边界或未知异常归一为 `ChipsError`（《RFC-ChipsError统一裁定》§4.5 条 3/4）：
 *
 * - 本类实例原样返回（保持抛出值身份，退出码旁表不丢失）；
 * - 通过统一结构守卫 {@link isChipsError} 的同构普通对象（宿主上报、跨边界还原）按四字段还原，
 *   错误码原样保留；守卫之外的附带字段（如历史 `exitCode`）一律不采信；
 * - 其余未识别异常归一为 `CLI_COMMAND_FAILED`：`message` 取该码的通用中文文案，
 *   **原始异常文本不进入 `message`**，只作结构化诊断落 `details`（`{ name?, cause }`，不含堆栈）。
 */
export function toCliError(value: unknown): ChipsError {
  if (value instanceof ChipsError) {
    return value;
  }
  if (isChipsError(value)) {
    return ChipsError.fromPlain(value);
  }
  if (value instanceof Error) {
    return new ChipsError({
      code: 'CLI_COMMAND_FAILED',
      message: CLI_ERROR_MESSAGES.CLI_COMMAND_FAILED,
      details: { name: value.name, cause: value.message },
    });
  }
  return new ChipsError({
    code: 'CLI_COMMAND_FAILED',
    message: CLI_ERROR_MESSAGES.CLI_COMMAND_FAILED,
    details: { cause: String(value) },
  });
}

/**
 * 构造带缺省文案的 CLI 错误。
 *
 * `message` 一律简体中文、面向用户；原始异常文本经 {@link toCliError} 落 `details.cause`，
 * 不拼进 `message`（[CLI 完整参考] §2.6、《RFC-ChipsError统一裁定》§4.5）。
 */
export function cliError(
  code: string,
  message?: string,
  details?: unknown,
  retryable?: boolean
): ChipsError {
  return new ChipsError({
    code,
    message: message ?? CLI_ERROR_MESSAGES[code as CliErrorCode] ?? code,
    ...(details === undefined ? {} : { details }),
    ...(retryable === undefined ? {} : { retryable }),
  });
}

/**
 * 构造带显式退出码提示的 CLI 错误：错误码保留原样（可能是插件自定义码），退出码由失败类别决定
 * （[CLI 完整参考] §2.5，如任务失败终态固定为 7）。提示写入进程内旁表（{@link registerExitCodeHint}），
 * 不进入错误对象与输出形状。
 */
export function cliErrorWithExitCode(
  code: string,
  exitCode: CliExitCode,
  message?: string,
  details?: unknown,
  retryable?: boolean
): ChipsError {
  const error = cliError(code, message, details, retryable);
  registerExitCodeHint(error, exitCode);
  return error;
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

/**
 * 错误 → 退出码：旁表提示（失败类别）优先，其次 §2.5 码值映射，最后一般失败 1
 * （《RFC-ChipsError统一裁定》§4.6）。
 */
export function exitCodeForError(error: ChipsError): CliExitCode {
  return EXIT_CODE_HINTS.get(error) ?? exitCodeForCode(error.code);
}
