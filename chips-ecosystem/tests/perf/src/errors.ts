/**
 * 性能工具统一错误模型。
 *
 * 错误码前缀 `PERF_` 与薯片生态错误码分层规范一致（《架构原则》R20：错误码按域分层），
 * 本工具为测试与运维工具，不进入 Bridge 能力错误码表，仅在进程内与报告中传播。
 */
export type PerfErrorCode =
  | 'PERF_CONFIG_INVALID'
  | 'PERF_THRESHOLD_OVERRIDE_DENIED'
  | 'PERF_INPUT_INVALID'
  | 'PERF_STATS_EMPTY'
  | 'PERF_MARKER_MISSING'
  | 'PERF_MARKER_DUPLICATE'
  | 'PERF_REPORT_INVALID'
  | 'PERF_ADAPTER_INVALID'
  | 'PERF_FIXTURE_INVALID'
  | 'PERF_CLI_USAGE';

/** 携带稳定错误码的运行时错误；报告与 CLI 依据 `code` 分流处理。 */
export class PerfError extends Error {
  readonly code: PerfErrorCode;

  constructor(code: PerfErrorCode, message: string) {
    super(message);
    this.name = 'PerfError';
    this.code = code;
  }
}

/** 判断任意异常是否为 `PerfError`，供 CLI 与调用方做窄化处理。 */
export function isPerfError(value: unknown): value is PerfError {
  return value instanceof PerfError;
}
