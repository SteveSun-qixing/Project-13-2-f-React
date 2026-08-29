export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  prefix?: string;
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const prefix = options.prefix ? `[${options.prefix}]` : "[basecard]";

  function log(level: LogLevel, ...args: unknown[]) {
    const values = [prefix, ...args];
    switch (level) {
      case "debug":
        console.debug(...values);
        break;
      case "info":
        console.info(...values);
        break;
      case "warn":
        console.warn(...values);
        break;
      case "error":
        console.error(...values);
        break;
    }
  }

  return {
    debug: (...args: unknown[]) => log("debug", ...args),
    info: (...args: unknown[]) => log("info", ...args),
    warn: (...args: unknown[]) => log("warn", ...args),
    error: (...args: unknown[]) => log("error", ...args),
  };
}

