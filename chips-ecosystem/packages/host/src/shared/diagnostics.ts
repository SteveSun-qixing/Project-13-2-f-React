/**
 * 壳诊断输出。
 *
 * @remarks
 * - 壳内部诊断只写宿主日志口（默认 `process.stderr`），不向插件暴露路径与堆栈（SB-7、PAL-5）。
 * - 主进程日志文件接入平台日志子系统前，统一经本模块输出，便于后续单点替换。
 */

/** 诊断输出口。 */
export interface DiagnosticsSink {
  /** 输出一行诊断；`scope` 为子系统标识，如 `startup` / `protocol` / `ipc`。 */
  warn(scope: string, message: string, details?: Readonly<Record<string, unknown>>): void;
  /** 输出一行错误诊断。 */
  error(scope: string, message: string, details?: Readonly<Record<string, unknown>>): void;
}

const format = (level: string, scope: string, message: string, details?: Readonly<Record<string, unknown>>): string => {
  const suffix = details === undefined ? '' : ` ${JSON.stringify(details)}`;
  return `[chips-host:${level}] [${scope}] ${message}${suffix}\n`;
};

/** 基于 `process.stderr` 的默认诊断口。 */
export function createStderrDiagnostics(): DiagnosticsSink {
  return {
    warn(scope, message, details) {
      process.stderr.write(format('warn', scope, message, details));
    },
    error(scope, message, details) {
      process.stderr.write(format('error', scope, message, details));
    },
  };
}
