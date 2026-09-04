import type { SdkLogRecord, SdkLogger } from "chips-sdk";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerContext {
  scope?: string;
  traceId?: string;
}

interface AppLogRecord {
  level: LogLevel;
  time: string;
  scope: string;
  message: string;
  traceId?: string;
  action?: string;
  requestId?: string;
  details?: unknown;
}

function serializeDetails(details: unknown): string {
  if (details === undefined) {
    return "";
  }

  try {
    return ` ${JSON.stringify(details)}`;
  } catch {
    return " [unserializable-details]";
  }
}

function writeConsole(record: AppLogRecord): void {
  const scope = `[chips-sheet:${record.scope}]`;
  const trace = record.traceId ? ` trace=${record.traceId}` : "";
  const action = record.action ? ` action=${record.action}` : "";
  const request = record.requestId ? ` request=${record.requestId}` : "";
  const line =
    `${record.time} ${scope} ${record.level.toUpperCase()}: ${record.message}${trace}${action}${request}` +
    serializeDetails(record.details);

  if (record.level === "error") {
    console.error(line);
    return;
  }

  if (record.level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function createTraceId(prefix = "chips-sheet"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createLogger(context: LoggerContext = {}) {
  const scope = context.scope ?? "app";
  const traceId = context.traceId;

  function emit(level: LogLevel, message: string, details?: unknown): void {
    writeConsole({
      level,
      time: new Date().toISOString(),
      scope,
      message,
      traceId,
      details,
    });
  }

  return {
    debug(message: string, details?: unknown) {
      emit("debug", message, details);
    },
    info(message: string, details?: unknown) {
      emit("info", message, details);
    },
    warn(message: string, details?: unknown) {
      emit("warn", message, details);
    },
    error(message: string, details?: unknown) {
      emit("error", message, details);
    },
  };
}

export function createSdkLogger(context: LoggerContext = {}): SdkLogger {
  const forward = (level: LogLevel, record: SdkLogRecord): void => {
    writeConsole({
      level,
      time: record.time,
      scope: context.scope ?? "sdk",
      message: record.message ?? "SDK log",
      traceId: context.traceId,
      action: record.action,
      requestId: record.requestId,
      details: record.details,
    });
  };

  return {
    debug(record: SdkLogRecord) {
      forward("debug", record);
    },
    info(record: SdkLogRecord) {
      forward("info", record);
    },
    warn(record: SdkLogRecord) {
      forward("warn", record);
    },
    error(record: SdkLogRecord) {
      forward("error", record);
    },
  };
}
