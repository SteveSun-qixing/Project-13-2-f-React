import { detectEnvironment } from "./environment";
import { createPluginBridgeAdapter, createTransportAdapter, type BridgeAdapter } from "./bridge-adapter";
import { createError, isPermissionDeniedError, normalizeStandardError } from "../types/errors";
import type {
  Client,
  ClientConfig,
  CoreClient,
  InvocationContext,
  SdkEnvironment,
} from "../types/client";
import type { StandardError } from "../types/errors";
import { createFileApi } from "../api/file";
import { createCardApi } from "../api/card";
import { createDocumentApi } from "../api/document";
import { createOfficeDocumentApi } from "../api/office-document";
import { createThemeApi } from "../api/theme";
import { createConfigApi } from "../api/config";
import { createI18nApi } from "../api/i18n";
import { createCommandApi } from "../api/command";
import { createCliCommandApi } from "../api/cli-command";
import { createCliTaskApi } from "../api/cli-task";
import { createPluginApi } from "../api/plugin";
import { createModuleApi } from "../api/module";
import { createCommunityCardTransferApi } from "../api/community-card-transfer";
import { createWindowApi } from "../api/window";
import { createSurfaceApi } from "../api/surface";
import { createTransferApi } from "../api/transfer";
import { createAssociationApi } from "../api/association";
import { createPlatformApi } from "../api/platform";
import { createBoxApi } from "../api/box";
import { createWorkspaceApi } from "../api/workspace";
import { createResourceApi } from "../api/resource";
import { createZipApi } from "../api/zip";
import { createLogApi } from "../api/log";
import { createCredentialApi } from "../api/credential";
import { createSerializerApi } from "../api/serializer";
import { createControlPlaneApi } from "../api/control-plane";

export function createCoreClient(config: ClientConfig = {}): CoreClient {
  const environment: SdkEnvironment =
    config.environment && config.environment !== "auto"
      ? config.environment
      : detectEnvironment();

  let adapter: BridgeAdapter | undefined;

  if (config.transport) {
    adapter = createTransportAdapter(config.transport);
  } else if (environment === "plugin") {
    adapter = createPluginBridgeAdapter(config.bridgeScope);
  }

  const coreConfig: ClientConfig = {
    environment,
    timeoutMs: config.timeoutMs ?? 0,
    retries: config.retries ?? 0,
    logger: config.logger,
    transport: config.transport,
  };

  async function invoke<I, O>(action: string, payload: I): Promise<O> {
    const requestId = createRequestId();

    if (!adapter) {
      throw createError(
        "BRIDGE_UNAVAILABLE",
        "No available transport or Bridge adapter in current environment.",
        {
          action,
          environment,
          hasWindow: typeof window !== "undefined",
          hasChips:
            typeof window !== "undefined" &&
            typeof (window as unknown as { chips?: unknown }).chips !== "undefined",
        },
        false,
        {
          messageKey: "chips.error.bridgeUnavailable",
          requestId,
        },
      );
    }

    const ctx: InvocationContext = { action, payload, attempt: 0 };
    const maxRetries = coreConfig.retries ?? 0;

    while (true) {
      const attempt = ctx.attempt + 1;
      const start = Date.now();

      try {
        const result = await withTimeout(
          adapter.invoke<I, O>(action, payload, coreConfig),
          coreConfig.timeoutMs ?? 0,
          action,
          requestId,
        );
        const duration = Date.now() - start;

        coreConfig.logger?.debug?.({
          level: "debug",
          time: new Date().toISOString(),
          action,
          requestId,
          message: "SDK invoke success",
          details: { durationMs: duration, attempt },
        });

        return result;
      } catch (err) {
        const duration = Date.now() - start;
        const stdErr: StandardError = normalizeStandardError(
          err,
          "Unknown error during SDK invocation.",
          "INTERNAL_ERROR",
          { requestId, action },
        );
        ctx.attempt += 1;
        ctx.error = stdErr;

        coreConfig.logger?.error?.({
          level: "error",
          time: new Date().toISOString(),
          action,
          requestId: stdErr.requestId,
          message: stdErr.message,
          details: {
            code: stdErr.code,
            attempt,
            durationMs: duration,
            retryable: stdErr.retryable,
            traceId: stdErr.traceId,
            permission: stdErr.permission,
          },
        });

        if (!shouldRetry(stdErr, ctx.attempt, maxRetries)) {
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
    once<T>(_event: string, _handler: (payload: T) => void): () => void {
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

function computeBackoffDelay(attempt: number): number {
  const base = 200;
  const factor = Math.min(attempt, 5);
  return base * Math.pow(2, factor - 1);
}

function shouldRetry(error: StandardError, attempt: number, maxRetries: number): boolean {
  return error.retryable === true && !isPermissionDeniedError(error) && attempt <= maxRetries;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  action: string,
  requestId: string,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(
        createError(
          "BRIDGE_TIMEOUT",
          `Bridge call timeout for action: ${action}`,
          { action, timeoutMs },
          true,
          {
            messageKey: "chips.error.bridgeTimeout",
            requestId,
          },
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function createRequestId(): string {
  const cryptoSource = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof cryptoSource?.randomUUID === "function") {
    return cryptoSource.randomUUID();
  }
  return `sdk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createClient(config: ClientConfig = {}): Client {
  const core = createCoreClient(config);

  return {
    ...core,
    office: createOfficeDocumentApi(core),
    document: createDocumentApi(core),
    file: createFileApi(core),
    card: createCardApi(core),
    theme: createThemeApi(core),
    config: createConfigApi(core),
    i18n: createI18nApi(core),
    command: createCommandApi(core),
    cliCommand: createCliCommandApi(core),
    cliTask: createCliTaskApi(core),
    plugin: createPluginApi(core),
    module: createModuleApi(core),
    communityCardTransfer: createCommunityCardTransferApi(core),
    window: createWindowApi(core),
    surface: createSurfaceApi(core),
    transfer: createTransferApi(core),
    association: createAssociationApi(core),
    platform: createPlatformApi(core),
    box: createBoxApi(core),
    workspace: createWorkspaceApi(core),
    resource: createResourceApi(core),
    zip: createZipApi(core),
    log: createLogApi(core),
    credential: createCredentialApi(core),
    serializer: createSerializerApi(core),
    controlPlane: createControlPlaneApi(core),
  };
}
