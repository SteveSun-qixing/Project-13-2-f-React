import { detectEnvironment } from "./environment";
import { createPluginBridgeAdapter, createTransportAdapter, type BridgeAdapter } from "./bridge-adapter";
import { createError, isStandardError } from "../types/errors";
import type {
  Client,
  ClientConfig,
  CoreClient,
  InvocationContext,
  SdkEnvironment,
} from "../types/client";
import type { StandardError } from "../types/errors";
import { createFileApi } from "../api/file";
import { createZipApi } from "../api/zip";
import { createCardApi } from "../api/card";
import { createThemeApi } from "../api/theme";
import { createConfigApi } from "../api/config";
import { createI18nApi } from "../api/i18n";
import { createPluginApi } from "../api/plugin";
import { createModuleApi } from "../api/module";
import { createWindowApi } from "../api/window";
import { createPlatformApi } from "../api/platform";
import { createBoxApi } from "../api/box";
import { createResourceApi } from "../api/resource";

export function createCoreClient(config: ClientConfig = {}): CoreClient {
  const environment: SdkEnvironment =
    config.environment && config.environment !== "auto"
      ? config.environment
      : detectEnvironment();

  let adapter: BridgeAdapter | undefined;

  if (config.transport) {
    adapter = createTransportAdapter(config.transport);
  } else if (environment === "plugin") {
    adapter = createPluginBridgeAdapter();
  }

  const coreConfig: ClientConfig = {
    environment,
    timeoutMs: config.timeoutMs ?? 0,
    retries: config.retries ?? 0,
    logger: config.logger,
    transport: config.transport,
  };

  async function invoke<I, O>(action: string, payload: I): Promise<O> {
    if (!adapter) {
      throw createError(
        "BRIDGE_UNAVAILABLE",
        "No available transport or Bridge adapter in current environment.",
      );
    }

    const ctx: InvocationContext = { action, payload, attempt: 0 };
    const maxRetries = coreConfig.retries ?? 0;

    while (true) {
      try {
        const start = Date.now();
        const result = await adapter.invoke<I, O>(action, payload, coreConfig);
        const duration = Date.now() - start;

        coreConfig.logger?.debug?.({
          level: "debug",
          time: new Date().toISOString(),
          action,
          message: "SDK invoke success",
          details: { durationMs: duration, attempt: ctx.attempt },
        });

        return result;
      } catch (err) {
        const stdErr: StandardError = normalizeError(err);
        ctx.attempt += 1;
        ctx.error = stdErr;

        coreConfig.logger?.error?.({
          level: "error",
          time: new Date().toISOString(),
          action,
          message: stdErr.message,
          details: { code: stdErr.code, attempt: ctx.attempt, retryable: stdErr.retryable },
        });

        if (!stdErr.retryable || ctx.attempt > maxRetries) {
          throw stdErr;
        }

        const delayMs = computeBackoffDelay(ctx.attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const events = adapter ?? {
    on<T>(_event: string, _handler: (payload: T) => void): () => void {
      throw createError("EVENTS_UNAVAILABLE", "Events API is not available without a transport.");
    },
    once<T>(_event: string, _handler: (payload: T) => void): void {
      throw createError("EVENTS_UNAVAILABLE", "Events API is not available without a transport.");
    },
    emit<T>(_event: string, _payload: T): Promise<void> {
      return Promise.reject(
        createError("EVENTS_UNAVAILABLE", "Events API is not available without a transport."),
      );
    },
  };

  return {
    clientConfig: coreConfig,
    invoke,
    events,
  };
}

function normalizeError(err: unknown): StandardError {
  if (isStandardError(err)) return err;
  const e = err as any;
  if (typeof e?.code === "string" && typeof e?.message === "string") {
    return {
      code: e.code,
      message: e.message,
      details: e.details,
      retryable: !!e.retryable,
      requestId: e.requestId,
      traceId: e.traceId,
    };
  }
  return createError(
    "INTERNAL_ERROR",
    e?.message ?? "Unknown error during SDK invocation.",
    e,
    false,
  );
}

function computeBackoffDelay(attempt: number): number {
  const base = 200;
  const factor = Math.min(attempt, 5);
  return base * Math.pow(2, factor - 1);
}

export function createClient(config: ClientConfig = {}): Client {
  const core = createCoreClient(config);

  return {
    ...core,
    file: createFileApi(core),
    zip: createZipApi(core),
    card: createCardApi(core),
    theme: createThemeApi(core),
    config: createConfigApi(core),
    i18n: createI18nApi(core),
    plugin: createPluginApi(core),
    module: createModuleApi(core),
    window: createWindowApi(core),
    platform: createPlatformApi(core),
    box: createBoxApi(core),
    resource: createResourceApi(core),
  };
}
