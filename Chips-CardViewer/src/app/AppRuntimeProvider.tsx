import React from "react";
import { resolveHostSceneId, resolveSurfaceKind, resolveLaunchParams } from "@chips/ui";
import type { Client, PlatformLaunchContext, SurfaceContext } from "chips-sdk";
import { appConfig } from "../../config/app-config";
import { createLogger, createTraceId } from "../../config/logging";
import { resolveMessage, type MessageParams } from "../lib/messages";
import { chipsClient } from "../runtime/chips-client";
import { readLaunchContext } from "../runtime/launch-context";
import {
  inferDocumentKindFromPath,
  resolveCardViewerSource,
  resolveViewerSource,
  type CardViewerSource,
  type ViewerCoverSource,
} from "../types/viewer-source";
import {
  getSceneDefinition,
  getSceneIdForTarget,
  type CardViewerSceneDefinition,
  type CardViewerSceneId,
} from "./scene-registry";

export type OpenedTarget =
  | {
      kind: "file";
      filePath: string;
      documentKind: "card" | "box";
      source: Extract<CardViewerSource, { kind: "local-file" }>;
      title?: string;
      createdAt?: string;
      cover?: ViewerCoverSource;
      metadataLoaded?: boolean;
    }
  | {
      kind: "document";
      documentUrl: string;
      source?: Extract<CardViewerSource, { kind: "community-card" | "community-box" }>;
      title?: string;
      createdAt?: string;
      cover?: ViewerCoverSource;
    };

export interface CardViewerRuntimeEnvironment {
  appId: string;
  pluginId: string;
  hostSceneId: string;
  activeSceneId: CardViewerSceneId;
  surfaceId: string | null;
  sessionId: string | null;
  surfaceKind: string;
  launchParams: Record<string, unknown>;
}

export type CardViewerTextResolver = (
  key: string,
  params?: MessageParams,
  fallback?: string,
) => string;

export interface CardViewerRuntimeValue {
  client: Client;
  traceId: string;
  launchContext: PlatformLaunchContext;
  surface: SurfaceContext | null;
  environment: CardViewerRuntimeEnvironment;
  activeSceneId: CardViewerSceneId;
  activeScene: CardViewerSceneDefinition;
  openedTarget: OpenedTarget | null;
  error: string | null;
  viewerMode: "content" | "cover";
  activeCover: ViewerCoverSource | null;
  activeTitle: string | null;
  canViewCover: boolean;
  locale: string;
  surfaceMode: "immersive" | "document";
  t: CardViewerTextResolver;
  showContent(): void;
  showCover(): void;
  returnHome(): void;
  openFile(): Promise<void>;
  openFilePath(filePath: string): void;
  downloadActiveCard(): Promise<void>;
  canDownloadActiveCard: boolean;
}

const AppRuntimeContext = React.createContext<CardViewerRuntimeValue | null>(null);

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

const NON_RETRYABLE_ERROR_MESSAGES: ReadonlySet<string> = new Set([
  resolveMessage("card-viewer.errors.unsupportedFile"),
  resolveMessage("card-viewer.errors.unsupportedSource"),
]);

export function isRetryableError(error: string | null): boolean {
  if (!error) {
    return false;
  }

  return !NON_RETRYABLE_ERROR_MESSAGES.has(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeCoverRatio(value: unknown): string | undefined {
  const normalized = normalizeString(value);
  if (!normalized || !/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function getFileName(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? filePath;
}

function readCardMetadataTitle(rawMetadata: unknown): string | undefined {
  if (!isRecord(rawMetadata)) {
    return undefined;
  }
  return normalizeString(rawMetadata.name) ?? normalizeString(rawMetadata.title);
}

function resolveOpenedTarget(filePath: string): OpenedTarget | null {
  const normalized = filePath.trim();
  if (!normalized) {
    return null;
  }
  const documentKind = inferDocumentKindFromPath(normalized);
  if (!documentKind) {
    return null;
  }

  return {
    kind: "file",
    filePath: normalized,
    documentKind,
    source: {
      kind: "local-file",
      documentKind,
      filePath: normalized,
    },
  };
}

function resolveOpenedTargetFromCardSource(source: CardViewerSource): OpenedTarget | null {
  const resolved = resolveViewerSource(source);
  if (resolved.renderKind === "local-file") {
    return {
      kind: "file",
      filePath: resolved.source.filePath,
      documentKind: resolved.source.documentKind,
      source: resolved.source,
      title: resolved.title,
      createdAt: resolved.createdAt,
      cover: resolved.cover,
    };
  }
  if (resolved.renderKind === "hosted-document") {
    return {
      kind: "document",
      documentUrl: resolved.documentUrl,
      source: resolved.source,
      title: resolved.title,
      createdAt: resolved.createdAt,
      cover: resolved.cover,
    };
  }
  return null;
}

function resolveWebDocumentUrl(launchParams: Record<string, unknown>): string | null {
  const documentUrl = typeof launchParams.webDocumentUrl === "string" ? launchParams.webDocumentUrl.trim() : "";
  return documentUrl.length > 0 ? documentUrl : null;
}

interface CommunityTransferServerConfig {
  baseUrl: string;
  accessToken: string;
}

function resolveCommunityTransferServer(launchParams: Record<string, unknown>): CommunityTransferServerConfig | null {
  const rawServer = launchParams.communityServer;
  if (!isRecord(rawServer)) {
    return null;
  }
  const baseUrl = normalizeString(rawServer.baseUrl);
  if (!baseUrl) {
    return null;
  }
  const accessToken = normalizeString(rawServer.accessToken);
  if (!accessToken) {
    return null;
  }
  return { baseUrl, accessToken };
}




export interface AppRuntimeProviderProps {
  children: React.ReactNode;
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps): React.ReactElement {
  const client = chipsClient;
  const traceId = React.useMemo(() => createTraceId("card-viewer"), []);
  const logger = React.useMemo(
    () =>
      createLogger({
        scope: "app-runtime",
        traceId,
      }),
    [traceId],
  );
  const [launchContext, setLaunchContext] = React.useState<PlatformLaunchContext>(() => readLaunchContext(client));
  const [openedTarget, setOpenedTarget] = React.useState<OpenedTarget | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [viewerMode, setViewerMode] = React.useState<"content" | "cover">("content");
  const locale = "zh-CN";
  const text = React.useCallback<CardViewerTextResolver>((key, params, fallback) => {
    return resolveMessage(key, params, fallback);
  }, []);
  const hasResolvedLaunchContextRef = React.useRef(false);

  React.useEffect(() => {
    setViewerMode("content");
  }, [openedTarget?.kind, openedTarget?.kind === "file" ? openedTarget.filePath : openedTarget?.documentUrl]);

  React.useEffect(() => {
    if (appConfig.featureFlags.enableDiagnosticsLogging) {
      logger.info("卡片查看器运行时已初始化", {
        appId: appConfig.appId,
        diagnosticsLogging: appConfig.featureFlags.enableDiagnosticsLogging,
      });
    }

    return () => {
      logger.info("卡片查看器运行时已卸载");
    };
  }, [logger]);

  React.useEffect(() => {
    logger.debug("当前查看目标状态已更新", {
      hasOpenedTarget: openedTarget !== null,
      targetKind: openedTarget?.kind ?? null,
      filePath: openedTarget?.kind === "file" ? openedTarget.filePath : null,
      documentUrl: openedTarget?.kind === "document" ? openedTarget.documentUrl : null,
    });
  }, [logger, openedTarget]);

  React.useEffect(() => {
    if (!error) {
      return;
    }

    logger.warn("界面当前存在错误提示", {
      error,
    });
  }, [error, logger]);

  React.useEffect(() => {
    if (hasResolvedLaunchContextRef.current) {
      return;
    }

    hasResolvedLaunchContextRef.current = true;
    const nextLaunchContext = readLaunchContext(client);
    setLaunchContext(nextLaunchContext);

    const launchParams = resolveLaunchParams(nextLaunchContext);
    const cardSource = resolveCardViewerSource(launchParams);
    if (cardSource) {
      const nextTarget = resolveOpenedTargetFromCardSource(cardSource);
      if (!nextTarget) {
        setError(text("card-viewer.errors.unsupportedSource"));
        return;
      }

      logger.info("从结构化 cardSource 启动上下文恢复查看态", {
        sourceKind: cardSource.kind,
        trigger: launchParams.trigger,
      });
      setOpenedTarget(nextTarget);
      setError(null);
      return;
    }

    const webDocumentUrl = resolveWebDocumentUrl(launchParams);
    if (webDocumentUrl) {
      logger.info("从 Web 启动上下文恢复托管文档查看态", {
        documentUrl: webDocumentUrl,
        trigger: launchParams.trigger,
      });
      setOpenedTarget({
        kind: "document",
        documentUrl: webDocumentUrl,
      });
      setError(null);
      return;
    }

    const targetPath = typeof launchParams.targetPath === "string" ? launchParams.targetPath : "";
    if (!targetPath) {
      return;
    }

    const nextTarget = resolveOpenedTarget(targetPath);

    if (!nextTarget || nextTarget.kind !== "file" || client.document.detectType(nextTarget.filePath) === null) {
      setError(text("card-viewer.errors.unsupportedFile"));
      return;
    }

    logger.info("从启动上下文恢复目标文件", {
      targetPath,
      trigger: launchParams.trigger,
    });
    setOpenedTarget(nextTarget);
    setError(null);
  }, [client, logger, text]);

  // Every opened document uses document flow so the outer host owns scrolling.
  // The empty landing surface remains immersive and viewport-bound.
  const surfaceMode = openedTarget ? "document" : "immersive";

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.setAttribute("data-chips-surface-mode", surfaceMode);
    document.body.setAttribute("data-chips-surface-mode", surfaceMode);

    return () => {
      document.documentElement.removeAttribute("data-chips-surface-mode");
      document.body.removeAttribute("data-chips-surface-mode");
    };
  }, [surfaceMode]);

  const openFilePath = React.useCallback((filePath: string) => {
    const nextTarget = resolveOpenedTarget(filePath);
    if (!nextTarget || nextTarget.kind !== "file" || client.document.detectType(nextTarget.filePath) === null) {
      logger.warn("选择的文件类型当前不受支持", {
        filePath,
      });
      setError(text("card-viewer.errors.unsupportedFile"));
      return;
    }

    logger.info("用户已选定查看目标", {
      filePath,
    });
    setError(null);
    setOpenedTarget(nextTarget);
  }, [client, logger, text]);

  React.useEffect(() => {
    if (!openedTarget || openedTarget.kind !== "file" || openedTarget.cover || openedTarget.metadataLoaded) {
      return;
    }

    let cancelled = false;
    const loadCover = async () => {
      try {
        if (openedTarget.documentKind === "card") {
          const info = await client.card.readInfo(openedTarget.filePath, ["metadata", "cover"]);
          if (cancelled) {
            return;
          }
          const metadata = info.info.metadata;
          const title =
            normalizeString(metadata?.name)
            ?? readCardMetadataTitle(metadata?.raw)
            ?? getFileName(openedTarget.filePath);
          const cover = info.info.cover?.resourceUrl
            ? {
                title: normalizeString(info.info.cover.title) ?? title,
                coverUrl: info.info.cover.resourceUrl,
                ...(normalizeCoverRatio(info.info.cover.ratio)
                  ? { ratio: normalizeCoverRatio(info.info.cover.ratio) }
                  : undefined),
              }
            : undefined;
          setOpenedTarget((current) => {
            if (!current || current.kind !== "file" || current.filePath !== openedTarget.filePath) {
              return current;
            }
            return {
              ...current,
              title,
              createdAt: normalizeString(metadata?.createdAt) ?? normalizeString(metadata?.raw?.created_at),
              metadataLoaded: true,
              ...(cover ? { cover } : undefined),
            };
          });
          return;
        }

        const [metadata, coverView] = await Promise.all([
          client.box.readMetadata(openedTarget.filePath).catch(() => null),
          client.box.renderCover(openedTarget.filePath).catch(() => null),
        ]);
        if (cancelled) {
          return;
        }
        const title = normalizeString(metadata?.name) ?? getFileName(openedTarget.filePath);
        const cover = coverView?.coverUrl
          ? {
              title: normalizeString(coverView.title) ?? title,
              coverUrl: coverView.coverUrl,
              ...(normalizeCoverRatio(coverView.ratio) ? { ratio: normalizeCoverRatio(coverView.ratio) } : undefined),
            }
          : undefined;
        setOpenedTarget((current) => {
          if (!current || current.kind !== "file" || current.filePath !== openedTarget.filePath) {
            return current;
          }
          return {
            ...current,
            title,
            createdAt: normalizeString(metadata?.createdAt),
            metadataLoaded: true,
            ...(cover ? { cover } : undefined),
          };
        });
      } catch (runtimeError) {
        logger.warn("读取查看来源封面信息失败，已降级为正文查看", {
          filePath: openedTarget.filePath,
          error: resolveErrorMessage(runtimeError, text("card-viewer.viewer.metadataLoadError")),
        });
        setOpenedTarget((current) => {
          if (!current || current.kind !== "file" || current.filePath !== openedTarget.filePath) {
            return current;
          }
          return {
            ...current,
            metadataLoaded: true,
          };
        });
      }
    };

    void loadCover();

    return () => {
      cancelled = true;
    };
  }, [client, logger, openedTarget, text]);

  const openFile = React.useCallback(async () => {
    try {
      setError(null);
      logger.info("用户点击“打开文件”按钮，准备调用文件选择对话框");
      const selected = await client.platform.openFile({
        title: text("card-viewer.dialogs.openFileTitle"),
        mode: "file",
        allowMultiple: false,
        mustExist: true,
      });

      const filePath = Array.isArray(selected) ? selected[0] : undefined;
      logger.info("文件选择对话框已返回", {
        fileCount: Array.isArray(selected) ? selected.length : 0,
        selected: filePath,
      });
      if (filePath) {
        openFilePath(filePath);
      }
    } catch (runtimeError) {
      logger.error("通过按钮选择查看目标失败", runtimeError);
      setError(resolveErrorMessage(runtimeError, text("card-viewer.errors.hostActionFailed")));
    }
  }, [client, logger, openFilePath, text]);

  const activeSceneId = getSceneIdForTarget(openedTarget);
  const activeScene = getSceneDefinition(activeSceneId);
  const activeCover = openedTarget?.cover ?? null;
  const activeTitle =
    openedTarget?.title
    ?? openedTarget?.cover?.title
    ?? (openedTarget?.kind === "file" ? getFileName(openedTarget.filePath) : null);
  const canViewCover = activeCover !== null;
  const showContent = React.useCallback(() => {
    setViewerMode("content");
  }, []);
  const showCover = React.useCallback(() => {
    setViewerMode("cover");
  }, []);
  const environment = React.useMemo<CardViewerRuntimeEnvironment>(() => ({
    appId: appConfig.appId,
    pluginId: launchContext.surfaceContext?.pluginId ?? launchContext.pluginId ?? appConfig.appId,
    hostSceneId: resolveHostSceneId(launchContext, appConfig.defaultSceneId),
    activeSceneId,
    surfaceId: launchContext.surfaceContext?.surfaceId ?? launchContext.surfaceId ?? null,
    sessionId: launchContext.surfaceContext?.sessionId ?? launchContext.sessionId ?? null,
    surfaceKind: resolveSurfaceKind(launchContext),
    launchParams: resolveLaunchParams(launchContext),
  }), [activeSceneId, launchContext]);
  const canDownloadActiveCard =
    openedTarget?.kind === "document"
    && openedTarget.source?.kind === "community-card"
    && resolveCommunityTransferServer(environment.launchParams) !== null
    && surfaceMode !== "document";
  const downloadActiveCard = React.useCallback(async () => {
    if (openedTarget?.kind !== "document" || openedTarget.source?.kind !== "community-card") {
      setError(text("card-viewer.actions.downloadUnavailable"));
      return;
    }

    const server = resolveCommunityTransferServer(environment.launchParams);
    if (!server) {
      setError(text("card-viewer.actions.downloadUnavailable"));
      return;
    }

    try {
      const outputPath = await client.platform.saveFile({
        title: text("card-viewer.actions.downloadCard"),
        defaultPath: `${openedTarget.title ?? openedTarget.source.cardId}.card`,
      });
      if (!outputPath) {
        return;
      }

      await client.communityCardTransfer.download({
        cardId: openedTarget.source.cardId,
        outputPath,
        server: {
          baseUrl: server.baseUrl,
          accessToken: server.accessToken,
        },
      });
      await client.platform.showMessage({
        title: text("card-viewer.actions.downloadComplete"),
        message: outputPath,
      });
    } catch (runtimeError) {
      logger.error("社区卡片下载失败", runtimeError);
      await client.platform.showMessage({
        title: text("card-viewer.actions.downloadFailed"),
        message: resolveErrorMessage(runtimeError, text("card-viewer.actions.downloadUnavailable")),
      });
    }
  }, [client, environment.launchParams, logger, openedTarget, text]);
  const returnHome = React.useCallback(() => {
    logger.info("用户返回卡片查看器首页", {
      targetKind: openedTarget?.kind ?? null,
      filePath: openedTarget?.kind === "file" ? openedTarget.filePath : null,
      documentUrl: openedTarget?.kind === "document" ? openedTarget.documentUrl : null,
    });
    setError(null);
    setViewerMode("content");
    setOpenedTarget(null);
  }, [logger, openedTarget]);

  const value = React.useMemo<CardViewerRuntimeValue>(() => ({
    client,
    traceId,
    launchContext,
    surface: launchContext.surfaceContext ?? null,
    environment,
    activeSceneId,
    activeScene,
    openedTarget,
    error,
    viewerMode,
    activeCover,
    activeTitle,
    canViewCover,
    locale,
    surfaceMode,
    t: text,
    showContent,
    showCover,
    returnHome,
    openFile,
    openFilePath,
    downloadActiveCard,
    canDownloadActiveCard,
  }), [
    activeScene,
    activeSceneId,
    client,
    environment,
    error,
    launchContext,
    activeCover,
    activeTitle,
    canViewCover,
    locale,
    openFile,
    openFilePath,
    openedTarget,
    returnHome,
    showContent,
    showCover,
    surfaceMode,
    text,
    traceId,
    viewerMode,
    downloadActiveCard,
    canDownloadActiveCard,
  ]);

  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}

export function useAppRuntime(): CardViewerRuntimeValue {
  const context = React.useContext(AppRuntimeContext);
  if (!context) {
    throw new Error("AppRuntimeContext is not available.");
  }

  return context;
}
