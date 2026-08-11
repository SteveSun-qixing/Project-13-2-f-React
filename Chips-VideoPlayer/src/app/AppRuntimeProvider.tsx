import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Client, PlatformHostKind, PlatformLaunchContext, SurfaceContext } from "chips-sdk";
import { resolveHostSceneId, resolveSurfaceKind } from "@chips/ui";
import { appConfig } from "../../config/app-config";
import { createLogger } from "../../config/logging";
import { useVideoPlayerController, type VideoPlayerController } from "../hooks/useVideoPlayerController";
import { readVideoPlayerPreferences } from "../utils/preferences";
import { formatMessage } from "../lib/messages";
import { chipsClient, videoPlayerTraceId } from "../runtime/chips-client";
import { readLaunchContext } from "../runtime/launch-context";
import { resolveLaunchVideoTarget } from "../utils/launch-resource";
import {
  SUPPORTED_VIDEO_EXTENSION_LABEL,
  isDirectPlayableUri,
  isSupportedVideoResource,
  normalizeVideoPlaybackOpenHints,
  resolveFileName,
  resolveVideoTitle,
  type LaunchVideoTarget,
  type VideoSource,
  type ViewerFeedback,
} from "../utils/video-player";
import { getSceneDefinition, type VideoPlayerSceneDefinition, type VideoPlayerSceneId } from "./scene-registry";

export interface VideoPlayerRuntimeEnvironment {
  appId: string;
  pluginId: string;
  sceneId: VideoPlayerSceneId;
  hostSceneId: string;
  surfaceId: string | null;
  sessionId: string | null;
  surfaceKind: string;
  launchParams: Record<string, unknown>;
}

export interface VideoPlayerRuntimeValue {
  client: Client;
  traceId: string;
  launchContext: PlatformLaunchContext;
  surface: SurfaceContext | null;
  environment: VideoPlayerRuntimeEnvironment;
  activeSceneId: VideoPlayerSceneId;
  activeScene: VideoPlayerSceneDefinition;
  videoSource: VideoSource | null;
  feedback: ViewerFeedback | null;
  isResolving: boolean;
  isSaving: boolean;
  hostKind: PlatformHostKind;
  isMorePanelOpen: boolean;
  controller: VideoPlayerController;
  t: (key: string, params?: Record<string, string | number>) => string;
  openVideoTarget(target: LaunchVideoTarget): Promise<void>;
  openFile(): Promise<void>;
  saveVideo(): Promise<void>;
  dropFile(files: File[]): Promise<void>;
  setMorePanelOpen(open: boolean): void;
  queueCount: number;
  playNext(): Promise<void>;
}

const AppRuntimeContext = React.createContext<VideoPlayerRuntimeValue | null>(null);

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

function unwrapLaunchParams(
  launchContext: PlatformLaunchContext | null,
  surface: SurfaceContext | null,
): Record<string, unknown> {
  return {
    ...surface?.launchParams,
    ...launchContext?.launchParams,
  };
}



function resolveDroppedFilePath(client: Client, file: File): string {
  const bridgePath = client.platform.getPathForFile(file);
  if (bridgePath) {
    return bridgePath;
  }

  return (file as File & { path?: string }).path ?? "";
}

export interface AppRuntimeProviderProps {
  children: React.ReactNode;
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps): React.ReactElement {
  const client = chipsClient;
  const traceId = videoPlayerTraceId;
  const logger = useMemo(
    () =>
      createLogger({
        scope: "app-runtime",
        traceId,
      }),
    [traceId],
  );
  const [launchContext, setLaunchContext] = useState<PlatformLaunchContext>(() => readLaunchContext(client));
  const surface = launchContext.surfaceContext ?? null;
  const hostSceneId = resolveHostSceneId(launchContext, appConfig.defaultSceneId);
  const activeScene = getSceneDefinition(hostSceneId);
  const activeSceneId = activeScene.id;
  const [videoSource, setVideoSource] = useState<VideoSource | null>(null);
  const [feedback, setFeedback] = useState<ViewerFeedback | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hostKind, setHostKind] = useState<PlatformHostKind>("desktop");
  const [isMorePanelOpen, setMorePanelOpen] = useState(false);
  const launchHandledRef = React.useRef(false);
  const initialPreferencesRef = React.useRef(readVideoPlayerPreferences());
  const [queue, setQueue] = useState<LaunchVideoTarget[]>([]);
  const controller = useVideoPlayerController({
    sessionKey: videoSource ? `${videoSource.sourceId}:${videoSource.revision}` : null,
    playbackHints: videoSource?.playbackHints,
    preferences: initialPreferencesRef.current,
  });

  const environment = useMemo<VideoPlayerRuntimeEnvironment>(() => ({
    appId: appConfig.appId,
    pluginId: surface?.pluginId ?? launchContext.pluginId ?? appConfig.appId,
    sceneId: activeSceneId,
    hostSceneId,
    surfaceId: surface?.surfaceId ?? launchContext.surfaceId ?? null,
    sessionId: surface?.sessionId ?? launchContext.sessionId ?? null,
    surfaceKind: resolveSurfaceKind(launchContext),
    launchParams: unwrapLaunchParams(launchContext, surface),
  }), [activeSceneId, hostSceneId, launchContext, surface]);

  const text = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      return formatMessage(key, params);
    },
    [],
  );

  const resolvePlayableUri = useCallback(async (target: LaunchVideoTarget): Promise<string> => {
    const preferredSourceId = target.filePath ?? target.sourceId;
    if (isDirectPlayableUri(preferredSourceId)) {
      return preferredSourceId;
    }

    const resolved = await client.resource.resolve(preferredSourceId);
    return resolved.uri;
  }, [client]);

  const openVideoTarget = useCallback(async (target: LaunchVideoTarget): Promise<void> => {
    if (!target.sourceId.trim()) {
      setFeedback({
        tone: "error",
        message: text("video-player.errors.missingPath"),
      });
      return;
    }

    if (!isSupportedVideoResource(target)) {
      setFeedback({
        tone: "error",
        message: text("video-player.errors.unsupportedFile", {
          extensions: SUPPORTED_VIDEO_EXTENSION_LABEL,
        }),
      });
      logger.warn("用户尝试打开不受支持的视频格式", target);
      return;
    }

    setIsResolving(true);
    setFeedback(null);

    try {
      const resourceUri = await resolvePlayableUri(target);
      const resolvedTitle = resolveVideoTitle(target);
      const resolvedFilePath = target.filePath?.trim() || undefined;
      const resolvedSourceId = target.sourceId.trim();

      setVideoSource({
        sourceId: resolvedSourceId,
        filePath: resolvedFilePath,
        fileName: target.fileName?.trim() || resolveFileName(resolvedFilePath ?? resolvedSourceId),
        title: resolvedTitle,
        resourceUri,
        mimeType: target.mimeType?.trim() || undefined,
        extension: undefined,
        revision: Date.now(),
        isRemote: !resolvedFilePath,
        ...(target.videoCard ? { playbackHints: normalizeVideoPlaybackOpenHints(target.videoCard.playback) } : undefined),
      });
      logger.info("视频资源已准备完成", {
        sourceId: resolvedSourceId,
        filePath: resolvedFilePath,
        resourceUri,
      });
    } catch (error) {
      logger.error("打开视频失败", error);
      setFeedback({
        tone: "error",
        message: resolveErrorMessage(error, text("video-player.errors.openFailed")),
      });
    } finally {
      setIsResolving(false);
    }
  }, [logger, resolvePlayableUri, text]);

  const openFile = useCallback(async (): Promise<void> => {
    try {
      const selected = await client.platform.openFile({
        title: text("video-player.dialogs.openFileTitle"),
        mode: "file",
        allowMultiple: false,
        mustExist: true,
      });
      const filePath = Array.isArray(selected) ? selected[0] : undefined;
      if (filePath) {
        await openVideoTarget({
          sourceId: filePath,
          filePath,
          fileName: resolveFileName(filePath),
        });
      }
    } catch (error) {
      logger.error("调用系统文件选择器失败", error);
      setFeedback({
        tone: "error",
        message: resolveErrorMessage(error, text("video-player.errors.openFailed")),
      });
    }
  }, [client, logger, openVideoTarget, text]);

  const saveVideo = useCallback(async (): Promise<void> => {
    if (!videoSource) {
      setFeedback({
        tone: "error",
        message: text("video-player.errors.missingPath"),
      });
      return;
    }

    const shouldDownloadDirectly = hostKind === "web" || !videoSource.filePath;

    if (shouldDownloadDirectly) {
      const link = document.createElement("a");
      link.href = videoSource.resourceUri;
      link.download = videoSource.fileName || "video";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setFeedback({
        tone: "info",
        message: text("video-player.status.downloadFallback"),
      });
      return;
    }

    try {
      const destinationPath = await client.platform.saveFile({
        title: text("video-player.dialogs.saveFileTitle"),
        defaultPath: videoSource.filePath,
      });

      if (!destinationPath) {
        return;
      }

      if (destinationPath === videoSource.filePath) {
        setFeedback({
          tone: "info",
          message: text("video-player.status.samePath"),
        });
        return;
      }

      const sourceFilePath = videoSource.filePath;
      if (!sourceFilePath) {
        return;
      }

      setIsSaving(true);
      await client.file.copy(sourceFilePath, destinationPath);
      logger.info("视频副本已保存", {
        sourcePath: sourceFilePath,
        destinationPath,
      });
      setFeedback({
        tone: "success",
        message: text("video-player.status.saveSuccess", {
          path: destinationPath,
        }),
      });
    } catch (error) {
      logger.error("保存视频失败", error);
      setFeedback({
        tone: "error",
        message: resolveErrorMessage(error, text("video-player.errors.saveFailed")),
      });
    } finally {
      setIsSaving(false);
    }
  }, [client, hostKind, logger, text, videoSource]);

  const playNext = useCallback(async (): Promise<void> => {
    setQueue((current) => {
      if (current.length === 0) {
        return current;
      }
      const [next, ...rest] = current;
      if (next) {
        void openVideoTarget(next);
      }
      return rest;
    });
  }, [openVideoTarget]);

  const enqueueTargets = useCallback((targets: LaunchVideoTarget[]): void => {
    if (targets.length === 0) {
      return;
    }
    setQueue((current) => [...current, ...targets]);
  }, []);

  const dropFile = useCallback(async (files: File[]): Promise<void> => {
    const validFiles = (files ?? []).filter((file) => file);
    if (validFiles.length === 0) {
      return;
    }

    const targets: LaunchVideoTarget[] = [];
    for (const file of validFiles) {
      const filePath = resolveDroppedFilePath(client, file);
      if (!filePath) {
        setFeedback({
          tone: "error",
          message: text("video-player.errors.openFailed"),
        });
        continue;
      }
      targets.push({
        sourceId: filePath,
        filePath,
        fileName: resolveFileName(filePath),
      });
    }

    if (targets.length === 0) {
      return;
    }

    const [first, ...rest] = targets;
    if (first) {
      enqueueTargets(rest);
      await openVideoTarget(first);
    }
  }, [client, openVideoTarget, text]);

  useEffect(() => {
    if (appConfig.featureFlags.enableDiagnosticsLogging) {
      logger.info("视频播放器应用已初始化", {
        appId: appConfig.appId,
        sceneId: environment.sceneId,
      });
    }
  }, [environment.sceneId, logger]);

  useEffect(() => {
    let cancelled = false;

    client.platform.getInfo()
      .then((platformInfo) => {
        if (!cancelled) {
          setHostKind(platformInfo.hostKind);
        }
      })
      .catch((error) => {
        logger.warn("读取宿主平台信息失败，继续按 desktop 处理", error);
      });

    return () => {
      cancelled = true;
    };
  }, [client, logger]);

  useEffect(() => {
    if (launchHandledRef.current) {
      return;
    }

    const launchTarget = resolveLaunchVideoTarget({
      ...launchContext,
      launchParams: environment.launchParams,
    });

    if (!launchTarget) {
      return;
    }

    launchHandledRef.current = true;
    logger.info("检测到启动参数里的视频资源", {
      launchTarget,
      trigger: environment.launchParams.trigger,
    });
    void openVideoTarget(launchTarget);
  }, [environment.launchParams, launchContext, logger, openVideoTarget]);

  useEffect(() => {
    if (!controller.isEnded) {
      return;
    }
    void playNext();
  }, [controller.isEnded, playNext]);

  useEffect(() => {
    if (!feedback || feedback.tone === "error") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback((current) => (current === feedback ? null : current));
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [feedback]);

  const value = useMemo<VideoPlayerRuntimeValue>(() => ({
    client,
    traceId,
    launchContext,
    surface,
    environment,
    activeSceneId,
    activeScene,
    videoSource,
    feedback,
    isResolving,
    isSaving,
    hostKind,
    isMorePanelOpen,
    controller,
    t: text,
    openVideoTarget,
    openFile,
    saveVideo,
    dropFile,
    setMorePanelOpen,
    queueCount: queue.length,
    playNext,
  }), [
    activeScene,
    activeSceneId,
    client,
    controller,
    dropFile,
    environment,
    feedback,
    hostKind,
    isMorePanelOpen,
    isResolving,
    isSaving,
    launchContext,
    openFile,
    openVideoTarget,
    playNext,
    enqueueTargets,
    saveVideo,
    surface,
    text,
    traceId,
    videoSource,
  ]);

  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}

export function useAppRuntime(): VideoPlayerRuntimeValue {
  const context = React.useContext(AppRuntimeContext);
  if (!context) {
    throw new Error("useAppRuntime must be used inside AppRuntimeProvider.");
  }

  return context;
}
