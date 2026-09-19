/**
 * 壳内部启动错误与诊断码。
 *
 * @remarks
 * - 启动期错误属壳内部错误：不经 Bridge、不进入插件可见错误面；只写主进程诊断输出。
 * - 通道级错误归一为 `BRIDGE_INTERNAL`（02-Bridge三层设计 §9.1、17-跨端Shell §3.3 SB-7）。
 */

/** 壳启动阶段。 */
export type HostStartupStage =
  'single-instance' | 'pal-host' | 'core-start' | 'plugin-restore' | 'protocol' | 'ipc' | 'window';

/** 壳启动失败诊断码（壳内部，不作为插件可见错误码）。 */
export type HostDiagnosticCode = 'HOST_STARTUP_FAILED' | 'HOST_SHUTDOWN_FAILED';

/**
 * 壳启动/退出失败。
 *
 * @remarks
 * `stage` 用于定位失败阶段；`cause` 仅用于本地诊断，不序列化。
 */
export class HostStartupError extends Error {
  /** 壳内部诊断码。 */
  readonly code: HostDiagnosticCode;
  /** 失败阶段。 */
  readonly stage: HostStartupStage;

  constructor(code: HostDiagnosticCode, stage: HostStartupStage, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'HostStartupError';
    this.code = code;
    this.stage = stage;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/** 判断值是否为 {@link HostStartupError}。 */
export function isHostStartupError(value: unknown): value is HostStartupError {
  return value instanceof HostStartupError;
}

/** 从任意异常提取诊断码与消息；未识别异常按启动失败归一。 */
export function describeHostFailure(error: unknown): { readonly code: HostDiagnosticCode; readonly message: string } {
  if (isHostStartupError(error)) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error && error.message.length > 0) {
    return { code: 'HOST_STARTUP_FAILED', message: error.message };
  }
  return { code: 'HOST_STARTUP_FAILED', message: '壳启动失败：未识别异常' };
}
