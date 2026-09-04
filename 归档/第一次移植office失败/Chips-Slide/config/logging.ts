export type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerOptions {
  scope?: string;
}

export function createLogger(scope?: string) {
  const prefix = scope ? `[${scope}]` : "[app]";

  function log(level: LogLevel, message: string, extra?: unknown) {
    const payload = extra === undefined ? "" : ` ${JSON.stringify(extra)}`;
    // eslint-disable-next-line no-console
    console.log(`${prefix} ${level.toUpperCase()}: ${message}${payload}`);
  }

  return {
    debug: (message: string, extra?: unknown) => log("debug", message, extra),
    info: (message: string, extra?: unknown) => log("info", message, extra),
    warn: (message: string, extra?: unknown) => log("warn", message, extra),
    error: (message: string, extra?: unknown) => log("error", message, extra),
  };
}

export function createScopedLogger(options: LoggerOptions) {
  return createLogger(options.scope);
}
