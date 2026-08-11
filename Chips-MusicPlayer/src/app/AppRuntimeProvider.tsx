import React, { startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Client, MusicCardOpenPayload, PlatformLaunchContext, StandardError, SurfaceContext } from "chips-sdk";
import { appConfig } from "../../config/app-config";
import { createLogger } from "../../config/logging";
import { createPlaylistEngine, type PlaylistEngine } from "../engine/playlist-engine";
import { parseEmbeddedAudioMetadata } from "../utils/audio-metadata";
import { resolveEmbeddedArtworkUrl } from "../utils/artwork-runtime";
import { persistEmbeddedArtworkPngToWorkspace } from "../utils/embedded-artwork-cache";
import { normalizeBinaryContent } from "../utils/binary";
import { createEmptyLyricsDocument, decodeTextWithFallback, parseLyricsText, type LyricsDocument } from "../utils/lyrics";
import { formatMessage } from "../lib/messages";
import { resolveLaunchAudioTarget, resolveLaunchWorkspacePath } from "../utils/launch-resource";
import {
  inferAudioMimeType,
  isDirectPlayableUri,
  isLikelyLocalPath,
  isSupportedAudioResource,
  resolveAudioFormatLabel,
  resolveDirectoryPath,
  resolveFileName,
  resolveFileSelection,
  resolveStem,
  resolveTrackTitle,
  SUPPORTED_AUDIO_EXTENSION_LABEL,
  type AudioSource,
  type FileSelectionBundle,
  type LaunchAudioTarget,
  type TrackPresentation,
  type ViewerFeedback,
} from "../utils/music-player";
import { chipsClient, musicPlayerTraceId } from "../runtime/chips-client";
import { readLaunchContext } from "../runtime/launch-context";
import { resolveHostSceneId, resolveLaunchParams, resolveSurfaceKind } from "@chips/ui";
import { defaultMusicPlayerScene, getMusicPlayerScene, type MusicPlayerSceneDefinition } from "./scene-registry";

type HostKind = "desktop" | "web" | "mobile" | "headless";

const DEFAULT_ARTWORK_URI = new URL("../../assets/artwork/default-cover.svg", import.meta.url).href;
const VOLUME_COMMAND_STEP = 0.05;

function isStandardErrorLike(error: unknown): error is StandardError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string",
  );
}

function resolveErrorMessage(
  error: unknown,
  fallbackMessage: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!isStandardErrorLike(error)) {
    return fallbackMessage;
  }

  if (typeof error.messageKey === "string" && error.messageKey.startsWith("music-player.")) {
    return t(error.messageKey);
  }

  switch (error.code) {
    case "PERMISSION_DENIED":
    case "SERVICE_PERMISSION_DENIED":
      return t("music-player.errors.permissionDenied");
    case "RESOURCE_NOT_FOUND":
    case "FILE_NOT_FOUND":
    case "RESOURCE_TIFF_SOURCE_NOT_FOUND":
      return t("music-player.errors.resourceNotFound");
    default:
      return fallbackMessage;
  }
}

function isRevocableArtworkUrl(value: string | undefined): boolean {
  return typeof value === "string" && value.startsWith("blob:");
}

function unwrapFileReadContent(value: unknown): string | Uint8Array | ArrayBuffer {
  if (value && typeof value === "object" && "content" in value) {
    const content = (value as { content?: unknown }).content;
    if (content instanceof Uint8Array || content instanceof ArrayBuffer || typeof content === "string") {
      return content;
    }
  }

  if (value instanceof Uint8Array || value instanceof ArrayBuffer || typeof value === "string") {
    return value;
  }

  throw new Error("文件读取结果不是可解析的二进制内容。");
}

function resolveLocalAudioPath(target: LaunchAudioTarget): string | undefined {
  const directFilePath = target.filePath?.trim();
  if (directFilePath) {
    return directFilePath;
  }

  const sourceId = target.sourceId.trim();
  if (!sourceId) {
    return undefined;
  }

  if (sourceId.startsWith("file://")) {
    try {
      return decodeURIComponent(new URL(sourceId).pathname);
    } catch {
      return undefined;
    }
  }

  return isLikelyLocalPath(sourceId) && !isDirectPlayableUri(sourceId) ? sourceId : undefined;
}

function resolveMetadataReadTarget(target: LaunchAudioTarget, localAudioPath: string | undefined): string | undefined {
  if (localAudioPath) {
    return localAudioPath;
  }

  const sourceId = target.sourceId.trim();
  if (!sourceId || isDirectPlayableUri(sourceId)) {
    return undefined;
  }

  return sourceId;
}

function resolveMusicCardTitle(payload: MusicCardOpenPayload | undefined): string {
  return payload?.display.title?.trim() || payload?.config.music_name?.trim() || "";
}

function resolveMusicCardArtist(payload: MusicCardOpenPayload | undefined): string {
  return payload?.display.artist?.trim() || "";
}

function resolveMusicCardAlbum(payload: MusicCardOpenPayload | undefined): string {
  return payload?.config.album_name?.trim() || "";
}

export interface MusicPlayerQueueItem {
  id: string;
  target: LaunchAudioTarget;
  selection: FileSelectionBundle;
}

export interface MusicPlayerControllerActions {
  getVolume: () => number;
  togglePlayback: () => void | Promise<void>;
  seekBy: (offsetSeconds: number) => void;
  setVolumeLevel: (nextVolume: number) => void;
  toggleMute: () => void;
  toggleLoopMode: () => void;
}

export interface MusicPlayerRuntimeEnvironment {
  appId: string;
  pluginId: string;
  hostSceneId: string;
  activeSceneId: string;
  surfaceId: string | null;
  sessionId: string | null;
  surfaceKind: string;
  launchParams: Record<string, unknown>;
}

export interface MusicPlayerRuntimeValue {
  client: Client;
  traceId: string;
  launchContext: PlatformLaunchContext;
  surface: SurfaceContext | null;
  environment: MusicPlayerRuntimeEnvironment;
  activeScene: MusicPlayerSceneDefinition;
  track: TrackPresentation | null;
  queue: MusicPlayerQueueItem[];
  queueIndex: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  feedback: ViewerFeedback | null;
  isResolving: boolean;
  isSaving: boolean;
  hostKind: HostKind;
  locale: string;
  t(key: string, params?: Record<string, string | number>): string;
  openFiles(): Promise<void>;
  saveAudio(): Promise<void>;
  dropFiles(files: File[]): Promise<void>;
  openSelection(paths: string[]): Promise<void>;
  openAudioTarget(target: LaunchAudioTarget, explicitSelection?: FileSelectionBundle): Promise<void>;
  goPreviousTrack(): Promise<void>;
  goNextTrack(): Promise<void>;
  setFeedback(feedback: ViewerFeedback | null): void;
  setPlaybackVolume(volume: number): void;
  playerActions: MusicPlayerControllerActions | null;
  setPlayerActions(actions: MusicPlayerControllerActions | null): void;
}

const MusicPlayerRuntimeContext = React.createContext<MusicPlayerRuntimeValue | null>(null);

export interface AppRuntimeProviderProps {
  children: React.ReactNode;
}

function createQueueItem(target: LaunchAudioTarget, selection: FileSelectionBundle = {}): MusicPlayerQueueItem {
  const identity = [target.sourceId, target.filePath, target.fileName, target.mimeType].filter(Boolean).join(":");
  return {
    id: `${identity || "audio"}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    target,
    selection,
  };
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps): React.ReactElement {
  const client = chipsClient;
  const traceId = musicPlayerTraceId;
  const [logger] = useState(() => createLogger({ scope: "app-runtime", traceId }));
  const [launchContext, setLaunchContext] = useState<PlatformLaunchContext>(() => readLaunchContext(client));
  const effectiveLaunchContext = useMemo<PlatformLaunchContext>(
    () => ({
      ...launchContext,
      launchParams: resolveLaunchParams(launchContext),
    }),
    [launchContext],
  );
  const [track, setTrack] = useState<TrackPresentation | null>(null);
  const [queue, setQueue] = useState<MusicPlayerQueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const playlistEngineRef = useRef<PlaylistEngine<MusicPlayerQueueItem> | null>(null);
  if (!playlistEngineRef.current) {
    playlistEngineRef.current = createPlaylistEngine<MusicPlayerQueueItem>();
  }
  const [feedback, setFeedback] = useState<ViewerFeedback | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hostKind, setHostKind] = useState<HostKind>("desktop");
  const [playerActions, setPlayerActionsState] = useState<MusicPlayerControllerActions | null>(null);
  const activeScene = defaultMusicPlayerScene;
  const surface = launchContext.surfaceContext ?? null;
  const revocableArtworkUrlRef = useRef<string | null>(null);
  const latestQueueRef = useRef<MusicPlayerQueueItem[]>([]);
  const latestQueueIndexRef = useRef(-1);

  const environment = useMemo<MusicPlayerRuntimeEnvironment>(
    () => ({
      appId: appConfig.appId,
      pluginId: effectiveLaunchContext.pluginId ?? appConfig.appId,
      hostSceneId: resolveHostSceneId(effectiveLaunchContext, activeScene.id),
      activeSceneId: getMusicPlayerScene(activeScene.id).id,
      surfaceId: effectiveLaunchContext.surfaceContext?.surfaceId ?? effectiveLaunchContext.surfaceId ?? null,
      sessionId: effectiveLaunchContext.surfaceContext?.sessionId ?? effectiveLaunchContext.sessionId ?? null,
      surfaceKind: resolveSurfaceKind(effectiveLaunchContext),
      launchParams: effectiveLaunchContext.launchParams,
    }),
    [activeScene.id, effectiveLaunchContext],
  );

  const canGoPrevious = queueIndex > 0;
  const canGoNext = queueIndex >= 0 && queueIndex < queue.length - 1;
  const locale = "zh-CN";

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    return formatMessage(key, params);
  }, []);

  const swapRevocableArtwork = useCallback((nextUrl?: string): void => {
    if (revocableArtworkUrlRef.current && revocableArtworkUrlRef.current !== nextUrl && isRevocableArtworkUrl(revocableArtworkUrlRef.current)) {
      URL.revokeObjectURL(revocableArtworkUrlRef.current);
    }

    const normalizedNextUrl = typeof nextUrl === "string" && nextUrl.startsWith("blob:") ? nextUrl : null;
    revocableArtworkUrlRef.current = normalizedNextUrl;
  }, []);

  const resolvePlayableUri = useCallback(async (target: LaunchAudioTarget): Promise<string> => {
    const preferredSourceId = target.filePath ?? target.sourceId;
    if (isDirectPlayableUri(preferredSourceId)) {
      return preferredSourceId;
    }

    const resolved = await client.resource.resolve(preferredSourceId);
    return resolved.uri;
  }, [client]);

  const discoverCompanionFiles = useCallback(async (audioPath: string, selection: FileSelectionBundle): Promise<FileSelectionBundle> => {
    if (selection.coverPath && selection.lyricsPath) {
      return selection;
    }

    const directory = resolveDirectoryPath(audioPath);
    if (!directory) {
      return selection;
    }

    const entries = await client.file.list(directory);
    const fileMap = new Map(
      entries
        .filter((entry) => entry.isFile)
        .map((entry) => [resolveFileName(entry.path).toLowerCase(), entry.path]),
    );

    const stem = resolveStem(audioPath).toLowerCase();
    const coverCandidates = [
      `${stem}.jpg`,
      `${stem}.jpeg`,
      `${stem}.png`,
      `${stem}.webp`,
      `${stem}.avif`,
      "cover.jpg",
      "cover.jpeg",
      "cover.png",
      "cover.webp",
      "cover.avif",
      "folder.jpg",
      "folder.jpeg",
      "folder.png",
      "front.jpg",
      "front.jpeg",
      "front.png",
    ];
    const lyricsCandidates = [`${stem}.lrc`, "lyrics.lrc", `${stem}.txt`];

    return {
      ...selection,
      coverPath: selection.coverPath ?? coverCandidates.map((candidate) => fileMap.get(candidate)).find(Boolean),
      lyricsPath: selection.lyricsPath ?? lyricsCandidates.map((candidate) => fileMap.get(candidate)).find(Boolean),
    };
  }, [client]);

  const loadLyricsDocument = useCallback(async (
    lyricsPath: string | undefined,
    embeddedMetadata: ReturnType<typeof parseEmbeddedAudioMetadata>,
  ): Promise<LyricsDocument> => {
    if (lyricsPath) {
      const fileContent = await client.file.read(lyricsPath, {
        encoding: "binary",
      });
      return parseLyricsText(decodeTextWithFallback(normalizeBinaryContent(unwrapFileReadContent(fileContent))), "companion");
    }

    if (embeddedMetadata.timedLyricsText) {
      return parseLyricsText(embeddedMetadata.timedLyricsText, "embedded");
    }

    if (embeddedMetadata.lyricsText) {
      return parseLyricsText(embeddedMetadata.lyricsText, "embedded");
    }

    return createEmptyLyricsDocument();
  }, [client]);

  const loadLyricsDocumentFromResourceId = useCallback(async (resourceId: string | undefined): Promise<LyricsDocument> => {
    const normalizedResourceId = resourceId?.trim();
    if (!normalizedResourceId) {
      return createEmptyLyricsDocument();
    }

    const bytes = await client.resource.readBinary(normalizedResourceId);
    return parseLyricsText(decodeTextWithFallback(normalizeBinaryContent(bytes)), "companion");
  }, [client]);

  const resolveArtworkUriFromResource = useCallback(async (
    resourceId: string | undefined,
  ): Promise<{ uri: string; kind: TrackPresentation["artworkKind"] }> => {
    const normalizedResourceId = resourceId?.trim();
    if (!normalizedResourceId) {
      return {
        uri: DEFAULT_ARTWORK_URI,
        kind: "default",
      };
    }

    const resolved = await client.resource.resolve(normalizedResourceId);
    return {
      uri: resolved.uri,
      kind: "companion",
    };
  }, [client]);

  const openAudioTarget = useCallback(async (target: LaunchAudioTarget, explicitSelection: FileSelectionBundle = {}): Promise<void> => {
    if (!target.sourceId.trim()) {
      setFeedback({
        tone: "error",
        message: t("music-player.errors.missingPath"),
      });
      return;
    }

    if (!isSupportedAudioResource(target)) {
      setFeedback({
        tone: "error",
        message: t("music-player.errors.unsupportedFile", {
          extensions: SUPPORTED_AUDIO_EXTENSION_LABEL,
        }),
      });
      logger.warn("用户尝试打开不受支持的音频格式", target);
      return;
    }

    setIsResolving(true);
    setFeedback(null);

    try {
      const currentLaunchContext = readLaunchContext(client);
      setLaunchContext(currentLaunchContext);
      const workspacePath = resolveLaunchWorkspacePath({
        ...currentLaunchContext,
        launchParams: resolveLaunchParams(currentLaunchContext),
      });
      const resourceUri = await resolvePlayableUri(target);
      const localAudioPath = resolveLocalAudioPath(target);
      const metadataReadTarget = resolveMetadataReadTarget(target, localAudioPath);
      const normalizedFileName = target.fileName?.trim() || resolveFileName(localAudioPath ?? target.sourceId);
      const musicCard = target.musicCard;
      const musicCardTitle = resolveMusicCardTitle(musicCard);
      const musicCardArtist = resolveMusicCardArtist(musicCard);
      const musicCardAlbum = resolveMusicCardAlbum(musicCard);
      let resolvedTitle = target.title?.trim() || musicCardTitle || resolveTrackTitle(target);
      let artist = musicCardArtist;
      let album = musicCardAlbum;
      let lyrics = createEmptyLyricsDocument();
      let artworkUri = DEFAULT_ARTWORK_URI;
      let artworkKind: TrackPresentation["artworkKind"] = "default";
      let nextRevocableArtworkUrl: string | undefined;
      let embeddedMetadata: ReturnType<typeof parseEmbeddedAudioMetadata> = {};
      let companionSelection = explicitSelection;

      if (metadataReadTarget) {
        const [binaryResult, companionResult] = await Promise.allSettled([
          client.resource.readBinary(metadataReadTarget),
          !musicCard && localAudioPath ? discoverCompanionFiles(localAudioPath, explicitSelection) : Promise.resolve(explicitSelection),
        ]);

        embeddedMetadata =
          binaryResult.status === "fulfilled"
            ? parseEmbeddedAudioMetadata({
                bytes: binaryResult.value,
                fileName: normalizedFileName,
                mimeType: target.mimeType ?? inferAudioMimeType(normalizedFileName),
              })
            : {};

        if (binaryResult.status === "rejected") {
          logger.warn("读取嵌入音频元数据失败，继续使用外部伴生资源与文件名回退", {
            metadataReadTarget,
            error: binaryResult.reason,
          });
        }

        companionSelection = companionResult.status === "fulfilled" ? companionResult.value : explicitSelection;

        resolvedTitle = target.title?.trim() || musicCardTitle || embeddedMetadata.title?.trim() || resolvedTitle;
        artist = musicCardArtist || embeddedMetadata.artist?.trim() || artist;
        album = musicCardAlbum || embeddedMetadata.album?.trim() || album;
      }

      try {
        lyrics = musicCard?.resources.lyrics
          ? await loadLyricsDocumentFromResourceId(musicCard.resources.lyrics.resourceId)
          : await loadLyricsDocument(companionSelection.lyricsPath, embeddedMetadata);
      } catch (error) {
        logger.warn("读取歌词失败，继续回退到嵌入歌词与空歌词视图", {
          localAudioPath,
          resourceId: musicCard?.resources.lyrics?.resourceId,
          error,
        });
        lyrics = await loadLyricsDocument(companionSelection.lyricsPath, embeddedMetadata).catch(() => createEmptyLyricsDocument());
      }

      resolvedTitle =
        target.title?.trim() || musicCardTitle || embeddedMetadata.title?.trim() || lyrics.metadata.title?.trim() || resolvedTitle;
      artist = musicCardArtist || embeddedMetadata.artist?.trim() || lyrics.metadata.artist?.trim() || artist;
      album = musicCardAlbum || embeddedMetadata.album?.trim() || lyrics.metadata.album?.trim() || album;

      let hasPreferredArtwork = false;
      try {
        const companionArtwork = musicCard?.resources.cover
          ? await resolveArtworkUriFromResource(musicCard.resources.cover.resourceId)
          : await resolveArtworkUriFromResource(companionSelection.coverPath);
        artworkUri = companionArtwork.uri;
        artworkKind = companionArtwork.kind;
        hasPreferredArtwork = companionArtwork.kind === "companion";
      } catch (error) {
        logger.warn("读取卡片封面或伴生封面失败，继续回退默认封面与嵌入封面", {
          localAudioPath,
          resourceId: musicCard?.resources.cover?.resourceId ?? companionSelection.coverPath,
          error,
        });
      }

      if (!hasPreferredArtwork && embeddedMetadata.artwork) {
        const persistedArtwork = await persistEmbeddedArtworkPngToWorkspace({
          client,
          workspacePath,
          sourceId: target.sourceId.trim(),
          fileName: normalizedFileName,
          artwork: embeddedMetadata.artwork,
          logger,
        });

        if (persistedArtwork) {
          artworkUri = persistedArtwork.uri;
          logger.info("嵌入封面已写入 Host 工作区临时 PNG", {
            sourceId: target.sourceId.trim(),
            filePath: persistedArtwork.filePath,
          });
        } else {
          nextRevocableArtworkUrl = await resolveEmbeddedArtworkUrl(embeddedMetadata.artwork);
          artworkUri = nextRevocableArtworkUrl;
          logger.warn("嵌入封面未能落盘到 Host 工作区，回退为运行时对象 URL", {
            sourceId: target.sourceId.trim(),
            mimeType: embeddedMetadata.artwork.mimeType,
          });
        }
        artworkKind = "embedded";
      }

      const source: AudioSource = {
        sourceId: target.sourceId.trim(),
        filePath: localAudioPath,
        fileName: normalizedFileName,
        title: resolvedTitle,
        resourceUri,
        mimeType: target.mimeType?.trim() || inferAudioMimeType(normalizedFileName),
        extension: resolveAudioFormatLabel(normalizedFileName, target.mimeType).toLowerCase() || undefined,
        revision: Date.now(),
        isRemote: !localAudioPath,
      };

      const nextTrack: TrackPresentation = {
        source,
        artist,
        album,
        artworkUri,
        artworkKind,
        lyrics,
      };

      swapRevocableArtwork(nextRevocableArtworkUrl);

      startTransition(() => {
        setTrack(nextTrack);
      });

      logger.info("音频资源已准备完成", {
        sourceId: source.sourceId,
        filePath: source.filePath,
        mimeType: source.mimeType,
        format: source.extension,
        lyricsMode: lyrics.mode,
      });
    } catch (error) {
      logger.error("打开音频失败", error);
      setFeedback({
        tone: "error",
        message: resolveErrorMessage(error, t("music-player.errors.openFailed"), t),
      });
    } finally {
      setIsResolving(false);
    }
  }, [
    client,
    discoverCompanionFiles,
    loadLyricsDocument,
    loadLyricsDocumentFromResourceId,
    logger,
    resolveArtworkUriFromResource,
    resolvePlayableUri,
    swapRevocableArtwork,
    t,
  ]);

  const openQueueItem = useCallback(async (nextQueue: MusicPlayerQueueItem[], nextQueueIndex: number): Promise<void> => {
    const engine = playlistEngineRef.current;
    if (!engine) {
      return;
    }

    engine.setQueue(nextQueue, nextQueueIndex);
    const nextItem = engine.current();
    if (!nextItem) {
      return;
    }

    setQueue([...engine.items()]);
    setQueueIndex(engine.currentIndex());
    await openAudioTarget(nextItem.target, nextItem.selection);
  }, [openAudioTarget]);

  const openSelection = useCallback(async (paths: string[]): Promise<void> => {
    const selection = resolveFileSelection(paths);
    const audioPaths = selection.audioPaths && selection.audioPaths.length > 0
      ? selection.audioPaths
      : selection.audioPath
        ? [selection.audioPath]
        : [];

    if (audioPaths.length === 0) {
      setFeedback({
        tone: "error",
        message: t("music-player.errors.missingAudioInSelection"),
      });
      return;
    }

    const hasSingleAudio = audioPaths.length === 1;
    const nextQueue = audioPaths.map((audioPath) =>
      createQueueItem(
        {
          sourceId: audioPath,
          filePath: audioPath,
          fileName: resolveFileName(audioPath),
          mimeType: inferAudioMimeType(audioPath),
        },
        hasSingleAudio ? selection : {},
      ),
    );

    await openQueueItem(nextQueue, 0);
  }, [openQueueItem, t]);

  const handleOpenFiles = useCallback(async (): Promise<void> => {
    try {
      const selected = await client.platform.openFile({
        title: t("music-player.dialogs.openFileTitle"),
        mode: "file",
        allowMultiple: true,
        mustExist: true,
      });
      const paths = Array.isArray(selected) ? selected.filter(Boolean) : [];
      if (paths.length > 0) {
        await openSelection(paths);
      }
    } catch (error) {
      logger.error("调用系统文件选择器失败", error);
      setFeedback({
        tone: "error",
        message: resolveErrorMessage(error, t("music-player.errors.openFailed"), t),
      });
    }
  }, [client, openSelection, logger, t]);

  const handleSaveAudio = useCallback(async (): Promise<void> => {
    if (!track) {
      setFeedback({
        tone: "error",
        message: t("music-player.errors.missingPath"),
      });
      return;
    }

    const shouldDownloadDirectly = hostKind === "web" || !track.source.filePath;

    if (shouldDownloadDirectly) {
      const link = document.createElement("a");
      link.href = track.source.resourceUri;
      link.download = track.source.fileName || "audio";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setFeedback({
        tone: "info",
        message: t("music-player.status.downloadFallback"),
      });
      return;
    }

    try {
      const sourceFilePath = track.source.filePath;
      if (!sourceFilePath) {
        setFeedback({
          tone: "error",
          message: t("music-player.errors.saveFailed"),
        });
        return;
      }

      const destinationPath = await client.platform.saveFile({
        title: t("music-player.dialogs.saveFileTitle"),
        defaultPath: sourceFilePath,
      });

      if (!destinationPath) {
        return;
      }

      if (destinationPath === sourceFilePath) {
        setFeedback({
          tone: "info",
          message: t("music-player.status.samePath"),
        });
        return;
      }

      setIsSaving(true);
      await client.file.copy(sourceFilePath, destinationPath);
      logger.info("音频副本已保存", {
        sourcePath: sourceFilePath,
        destinationPath,
      });
      setFeedback({
        tone: "success",
        message: t("music-player.status.saveSuccess", {
          path: destinationPath,
        }),
      });
    } catch (error) {
      logger.error("保存音频失败", error);
      setFeedback({
        tone: "error",
        message: resolveErrorMessage(error, t("music-player.errors.saveFailed"), t),
      });
    } finally {
      setIsSaving(false);
    }
  }, [client, hostKind, logger, t, track]);

  const resolveDroppedFilePath = useCallback((file: File): string => {
    const bridgePath = client.platform.getPathForFile(file);
    if (bridgePath) {
      return bridgePath;
    }

    return (file as File & { path?: string }).path ?? "";
  }, [client]);

  const handleDropFiles = useCallback(async (files: File[]): Promise<void> => {
    const paths = files.map(resolveDroppedFilePath).filter((path) => path.trim().length > 0);
    if (paths.length === 0) {
      setFeedback({
        tone: "error",
        message: t("music-player.errors.openFailed"),
      });
      return;
    }

    await openSelection(paths);
  }, [openSelection, resolveDroppedFilePath, t]);

  const goPreviousTrack = useCallback(async (): Promise<void> => {
    const currentQueue = latestQueueRef.current;
    const currentIndex = latestQueueIndexRef.current;
    if (currentIndex <= 0) {
      return;
    }
    await openQueueItem(currentQueue, currentIndex - 1);
  }, [openQueueItem]);

  const goNextTrack = useCallback(async (): Promise<void> => {
    const currentQueue = latestQueueRef.current;
    const currentIndex = latestQueueIndexRef.current;
    if (currentIndex < 0 || currentIndex >= currentQueue.length - 1) {
      return;
    }
    await openQueueItem(currentQueue, currentIndex + 1);
  }, [openQueueItem]);

  const setPlaybackVolume = useCallback((volume: number): void => {
    setFeedback({
      tone: "info",
      message: t("music-player.status.volumeChanged", {
        volume: Math.round(Math.max(0, Math.min(1, volume)) * 100),
      }),
    });
  }, [t]);

  const setPlayerActions = useCallback((actions: MusicPlayerControllerActions | null): void => {
    setPlayerActionsState(actions);
  }, []);

  useEffect(() => {
    let cancelled = false;

    client.platform.getInfo()
      .then((platformInfo) => {
        if (cancelled) {
          return;
        }

        setHostKind(platformInfo.hostKind as HostKind);
      })
      .catch((error) => {
        logger.warn("初始化平台信息失败，继续使用桌面模式", error);
      });

    return () => {
      cancelled = true;
    };
  }, [client, logger]);

  useEffect(() => {
    const nextLaunchContext = readLaunchContext(client);
    setLaunchContext(nextLaunchContext);
    const normalizedLaunchContext = {
      ...nextLaunchContext,
      launchParams: resolveLaunchParams(nextLaunchContext),
    };
    const launchTarget = resolveLaunchAudioTarget(normalizedLaunchContext);
    if (!launchTarget) {
      return;
    }

    logger.info("检测到启动参数里的音频目标", {
      sourceId: launchTarget.sourceId,
      trigger: normalizedLaunchContext.launchParams.trigger,
    });
    const launchQueue = [createQueueItem(launchTarget)];
    const engine = playlistEngineRef.current;
    engine?.setQueue(launchQueue, 0);
    setQueue([...(engine?.items() ?? launchQueue)]);
    setQueueIndex(engine?.currentIndex() ?? 0);
    void openAudioTarget(launchTarget);
  }, [client, logger, openAudioTarget]);

  useEffect(() => {
    latestQueueRef.current = queue;
    latestQueueIndexRef.current = queueIndex;
  }, [queue, queueIndex]);

  useEffect(() => {
    if (!feedback || feedback.tone === "error") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback((current) => (current === feedback ? null : current));
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [feedback]);

  useEffect(() => {
    return () => {
      swapRevocableArtwork();
    };
  }, [swapRevocableArtwork]);

  const runtimeValue = useMemo<MusicPlayerRuntimeValue>(
    () => ({
      client,
      traceId,
      launchContext: effectiveLaunchContext,
      surface,
      environment,
      activeScene,
      track,
      queue,
      queueIndex,
      canGoPrevious,
      canGoNext,
      feedback,
      isResolving,
      isSaving,
      hostKind,
      locale,
      t,
      openFiles: handleOpenFiles,
      saveAudio: handleSaveAudio,
      dropFiles: handleDropFiles,
      openSelection,
      openAudioTarget,
      goPreviousTrack,
      goNextTrack,
      setFeedback,
      setPlaybackVolume,
      playerActions,
      setPlayerActions,
    }),
    [
      activeScene,
      canGoNext,
      canGoPrevious,
      client,
      effectiveLaunchContext,
      environment,
      feedback,
      goNextTrack,
      goPreviousTrack,
      handleDropFiles,
      handleOpenFiles,
      handleSaveAudio,
      hostKind,
      isResolving,
      isSaving,
      locale,
      openAudioTarget,
      openSelection,
      playerActions,
      queue,
      queueIndex,
      setPlaybackVolume,
      setPlayerActions,
      surface,
      t,
      traceId,
      track,
    ],
  );

  return (
    <MusicPlayerRuntimeContext.Provider value={runtimeValue}>
      {children}
    </MusicPlayerRuntimeContext.Provider>
  );
}

export function useMusicPlayerRuntime(): MusicPlayerRuntimeValue {
  const runtime = useContext(MusicPlayerRuntimeContext);
  if (!runtime) {
    throw new Error("useMusicPlayerRuntime must be used inside AppRuntimeProvider.");
  }
  return runtime;
}
