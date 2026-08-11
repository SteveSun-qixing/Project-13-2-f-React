import React from "react";
import { resolveHostSceneId, resolveSurfaceKind, resolveLaunchParams } from "@chips/ui";
import type { Client, PlatformLaunchContext, SurfaceContext } from "chips-sdk";
import { appConfig } from "../../config/app-config";
import { createLogger, createTraceId } from "../../config/logging";
import {
  SUPPORTED_IMAGE_EXTENSION_LABEL,
  isSupportedImagePath,
  type ImageDimensions,
} from "../utils/image-viewer";
import {
  resolveLaunchImageTarget,
  type LaunchImageResource,
  type LaunchImageTarget,
} from "../utils/launch-resource";
import { formatMessage } from "../lib/messages";
import { chipsClient } from "../runtime/chips-client";
import { readLaunchContext } from "../runtime/launch-context";
import {
  getSceneDefinition,
  getSceneIdForImage,
  type PhotoViewerSceneDefinition,
  type PhotoViewerSceneId,
} from "./scene-registry";

export interface ImageSource {
  sourceId: string;
  filePath?: string;
  fileName: string;
  resourceUri: string;
  revision: number;
}

export interface ViewerFeedback {
  tone: "info" | "success" | "error";
  message: string;
}

export interface PhotoViewerCameraActions {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWindow: () => void;
  actualSize: () => void;
  rotateClockwise?: () => void;
  rotateCounterclockwise?: () => void;
}

export type PhotoViewerZoomActions = PhotoViewerCameraActions;

export type HostKind = "desktop" | "web" | "mobile" | "headless";

export interface PhotoViewerRuntimeEnvironment {
  appId: string;
  pluginId: string;
  hostSceneId: string;
  activeSceneId: PhotoViewerSceneId;
  surfaceId: string | null;
  sessionId: string | null;
  surfaceKind: string;
  launchParams: Record<string, unknown>;
}

export interface PhotoViewerRuntimeValue {
  client: Client;
  traceId: string;
  launchContext: PlatformLaunchContext;
  surface: SurfaceContext | null;
  environment: PhotoViewerRuntimeEnvironment;
  activeSceneId: PhotoViewerSceneId;
  activeScene: PhotoViewerSceneDefinition;
  locale: string;
  hostKind: HostKind;
  imageTarget: LaunchImageTarget | null;
  currentImageIndex: number;
  imageSource: ImageSource | null;
  imageDimensions: ImageDimensions | null;
  feedback: ViewerFeedback | null;
  isResolving: boolean;
  isSaving: boolean;
  isImageLoaded: boolean;
  infoOpen: boolean;
  thumbCacheRevision: number;
  t(key: string, params?: Record<string, string | number>): string;
  openImageFile(filePath: string): Promise<void>;
  openFile(): Promise<void>;
  saveImage(): Promise<void>;
  previousImage(): void;
  nextImage(): void;
  jumpTo(index: number): void;
  reloadCurrent(): void;
  getResolvedThumbUri(sourceId: string): string | null;
  dropFile(file: File | null): Promise<void>;
  handleImageLoad(dimensions: ImageDimensions): void;
  handleImageError(): void;
  setFeedback(feedback: ViewerFeedback | null): void;
  zoomActions: PhotoViewerZoomActions;
  setZoomActions(actions: PhotoViewerZoomActions | null): void;
  registerZoomActions(actions: PhotoViewerZoomActions | null): void;
  fullscreen?: () => void | Promise<void>;
  rotateClockwise?: () => void;
  rotateCounterclockwise?: () => void;
  showInfo?: () => void;
  hideInfo?: () => void;
  copyImage?: () => void | Promise<void>;
  firstImage?: () => void;
  lastImage?: () => void;
}

const AppRuntimeContext = React.createContext<PhotoViewerRuntimeValue | null>(null);

const RESOURCE_URI_CACHE_MAX_SIZE = 8;

class ResourceUriCache {
  private readonly entries = new Map<string, string>();

  get(sourceId: string): string | null {
    const uri = this.entries.get(sourceId);
    if (uri === undefined) {
      return null;
    }

    this.entries.delete(sourceId);
    this.entries.set(sourceId, uri);
    return uri;
  }

  set(sourceId: string, uri: string): void {
    this.entries.delete(sourceId);
    this.entries.set(sourceId, uri);

    if (this.entries.size > RESOURCE_URI_CACHE_MAX_SIZE) {
      const oldestSourceId = this.entries.keys().next().value;
      if (typeof oldestSourceId === "string") {
        this.entries.delete(oldestSourceId);
      }
    }
  }

  delete(sourceId: string): void {
    this.entries.delete(sourceId);
  }
}

const resourceUriCache = new ResourceUriCache();

function preloadImage(uri: string): void {
  const image = new Image();
  image.decoding = "async";
  image.src = uri;
}

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

function resolveFileName(filePath: string): string {
  const normalized = filePath.trim();
  if (!normalized) {
    return "";
  }

  const segments = normalized.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? normalized;
}

function resolveImageCandidateName(resource: LaunchImageResource): string {
  return (
    resource.fileName?.trim() ||
    (resource.relativePath ? resolveFileName(resource.relativePath) : "") ||
    (resource.filePath ? resolveFileName(resource.filePath) : "") ||
    resolveFileName(resource.sourceId) ||
    "image"
  );
}

function isSupportedImageResource(resource: LaunchImageResource): boolean {
  return [
    resource.fileName,
    resource.relativePath,
    resource.filePath,
    resource.sourceId,
  ].some((value) => typeof value === "string" && isSupportedImagePath(value));
}

function clampImageIndex(target: LaunchImageTarget, index: number): number {
  if (target.images.length === 0) {
    return 0;
  }

  if (!Number.isFinite(index)) {
    return 0;
  }

  return Math.max(0, Math.min(target.images.length - 1, Math.trunc(index)));
}




export interface AppRuntimeProviderProps {
  children: React.ReactNode;
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps): React.ReactElement {
  const client = chipsClient;
  const traceId = React.useMemo(() => createTraceId("photo-viewer"), []);
  const logger = React.useMemo(
    () =>
      createLogger({
        scope: "app-runtime",
        traceId,
      }),
    [traceId],
  );
  const [launchContext, setLaunchContext] = React.useState<PlatformLaunchContext>(() => readLaunchContext(client));
  const locale = "zh-CN";
  const [hostKind, setHostKind] = React.useState<HostKind>("desktop");
  const [imageTarget, setImageTarget] = React.useState<LaunchImageTarget | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const [imageSource, setImageSource] = React.useState<ImageSource | null>(null);
  const [imageDimensions, setImageDimensions] = React.useState<ImageDimensions | null>(null);
  const [feedback, setFeedback] = React.useState<ViewerFeedback | null>(null);
  const [isResolving, setIsResolving] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isImageLoaded, setIsImageLoaded] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [thumbCacheRevision, setThumbCacheRevision] = React.useState(0);
  const hasResolvedLaunchContextRef = React.useRef(false);
  const cameraActionsRef = React.useRef<PhotoViewerCameraActions | null>(null);

  const registerZoomActions = React.useCallback((actions: PhotoViewerZoomActions | null): void => {
    cameraActionsRef.current = actions;
  }, []);

  const zoomActionsHandle = React.useMemo<PhotoViewerZoomActions>(
    () => ({
      zoomIn: () => cameraActionsRef.current?.zoomIn(),
      zoomOut: () => cameraActionsRef.current?.zoomOut(),
      fitToWindow: () => cameraActionsRef.current?.fitToWindow(),
      actualSize: () => cameraActionsRef.current?.actualSize(),
      rotateClockwise: () => cameraActionsRef.current?.rotateClockwise?.(),
      rotateCounterclockwise: () => cameraActionsRef.current?.rotateCounterclockwise?.(),
    }),
    [],
  );

  const text = React.useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      return formatMessage(key, params);
    },
    [],
  );

  const openImageTarget = React.useCallback(
    (target: LaunchImageTarget): void => {
      if (target.images.length === 0) {
        setFeedback({
          tone: "error",
          message: text("photo-viewer.errors.missingPath"),
        });
        return;
      }

      const unsupported = target.images.find((image) => !isSupportedImageResource(image));
      if (unsupported) {
        setFeedback({
          tone: "error",
          message: text("photo-viewer.errors.unsupportedFile", {
            extensions: SUPPORTED_IMAGE_EXTENSION_LABEL,
          }),
        });
        logger.warn("用户尝试打开不受支持的图片格式", {
          sourceId: unsupported.sourceId,
          fileName: unsupported.fileName,
          relativePath: unsupported.relativePath,
        });
        return;
      }

      setImageTarget(target);
      setCurrentImageIndex(clampImageIndex(target, target.initialIndex));
    },
    [logger, text],
  );

  const openImageFile = React.useCallback(
    async (filePath: string): Promise<void> => {
      const normalizedPath = filePath.trim();
      if (!normalizedPath) {
        setFeedback({
          tone: "error",
          message: text("photo-viewer.errors.missingPath"),
        });
        return;
      }

      if (!isSupportedImagePath(normalizedPath)) {
        setFeedback({
          tone: "error",
          message: text("photo-viewer.errors.unsupportedFile", {
            extensions: SUPPORTED_IMAGE_EXTENSION_LABEL,
          }),
        });
        logger.warn("用户尝试打开不受支持的图片格式", {
          filePath: normalizedPath,
        });
        return;
      }

      openImageTarget({
        images: [
          {
            sourceId: normalizedPath,
            filePath: normalizedPath,
            fileName: resolveFileName(normalizedPath),
          },
        ],
        initialIndex: 0,
      });
    },
    [logger, openImageTarget, text],
  );

  const openFile = React.useCallback(async (): Promise<void> => {
    try {
      const selected = await client.platform.openFile({
        title: text("photo-viewer.dialogs.openFileTitle"),
        mode: "file",
        allowMultiple: true,
        mustExist: true,
      });
      if (!selected || selected.length === 0) {
        return;
      }

      if (selected.length === 1) {
        await openImageFile(selected[0]);
        return;
      }

      const images: LaunchImageResource[] = selected.map((filePath) => ({
        sourceId: filePath,
        filePath,
        fileName: resolveFileName(filePath),
      }));

      const unsupported = images.find((image) => !isSupportedImageResource(image));
      if (unsupported) {
        setFeedback({
          tone: "error",
          message: text("photo-viewer.errors.unsupportedFile", {
            extensions: SUPPORTED_IMAGE_EXTENSION_LABEL,
          }),
        });
        logger.warn("多选图片中包含不受支持的格式", {
          sourceId: unsupported.sourceId,
          fileName: unsupported.fileName,
          total: images.length,
        });
        return;
      }

      openImageTarget({ images, initialIndex: 0 });
    } catch (error) {
      logger.error("调用系统文件选择器失败", error);
      setFeedback({
        tone: "error",
        message: resolveErrorMessage(error, text("photo-viewer.errors.openFailed")),
      });
    }
  }, [client, logger, openImageFile, openImageTarget, text]);

  const saveImage = React.useCallback(async (): Promise<void> => {
    if (!imageSource) {
      setFeedback({
        tone: "error",
        message: text("photo-viewer.errors.missingPath"),
      });
      return;
    }

    if (hostKind === "web") {
      const link = document.createElement("a");
      link.href = imageSource.resourceUri;
      link.download = imageSource.fileName || "image";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setFeedback({
        tone: "success",
        message: text("photo-viewer.status.saveSuccess", {
          path: imageSource.fileName,
        }),
      });
      return;
    }

    try {
      const destinationPath = await client.platform.saveFile({
        title: text("photo-viewer.dialogs.saveFileTitle"),
        defaultPath: imageSource.filePath ?? imageSource.fileName,
      });

      if (!destinationPath) {
        return;
      }

      if (imageSource.filePath && destinationPath === imageSource.filePath) {
        setFeedback({
          tone: "info",
          message: text("photo-viewer.status.samePath"),
        });
        return;
      }

      setIsSaving(true);
      if (imageSource.filePath) {
        await client.file.copy(imageSource.filePath, destinationPath);
      } else {
        const bytes = new Uint8Array(await client.resource.readBinary(imageSource.sourceId));
        await client.file.write(destinationPath, bytes, { encoding: "binary" });
      }
      logger.info("图片副本已保存", {
        sourcePath: imageSource.filePath ?? imageSource.sourceId,
        destinationPath,
      });
      setFeedback({
        tone: "success",
        message: text("photo-viewer.status.saveSuccess", {
          path: destinationPath,
        }),
      });
    } catch (error) {
      logger.error("保存图片失败", error);
      setFeedback({
        tone: "error",
        message: resolveErrorMessage(error, text("photo-viewer.errors.saveFailed")),
      });
    } finally {
      setIsSaving(false);
    }
  }, [client, hostKind, imageSource, logger, text]);

  const previousImage = React.useCallback((): void => {
    if (!imageTarget || imageTarget.images.length <= 1) {
      return;
    }

    setCurrentImageIndex((current) => Math.max(0, current - 1));
  }, [imageTarget]);

  const nextImage = React.useCallback((): void => {
    if (!imageTarget || imageTarget.images.length <= 1) {
      return;
    }

    setCurrentImageIndex((current) => Math.min(imageTarget.images.length - 1, current + 1));
  }, [imageTarget]);

  const firstImage = React.useCallback((): void => {
    if (!imageTarget || imageTarget.images.length <= 1) {
      return;
    }

    setCurrentImageIndex(0);
  }, [imageTarget]);

  const lastImage = React.useCallback((): void => {
    if (!imageTarget || imageTarget.images.length <= 1) {
      return;
    }

    setCurrentImageIndex(imageTarget.images.length - 1);
  }, [imageTarget]);

  const jumpTo = React.useCallback((index: number): void => {
    if (!imageTarget) {
      return;
    }

    setCurrentImageIndex(clampImageIndex(imageTarget, index));
  }, [imageTarget]);

  const reloadCurrent = React.useCallback((): void => {
    if (!imageTarget) {
      return;
    }

    const resource = imageTarget.images[currentImageIndex];
    if (!resource) {
      return;
    }

    resourceUriCache.delete(resource.sourceId.trim());
    setImageTarget({ ...imageTarget });
  }, [currentImageIndex, imageTarget]);

  const getResolvedThumbUri = React.useCallback((sourceId: string): string | null => {
    return resourceUriCache.get(sourceId);
  }, []);

  const fullscreen = React.useCallback((): void => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }

    void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  const rotateClockwise = React.useCallback((): void => {
    cameraActionsRef.current?.rotateClockwise?.();
  }, []);

  const rotateCounterclockwise = React.useCallback((): void => {
    cameraActionsRef.current?.rotateCounterclockwise?.();
  }, []);

  const showInfo = React.useCallback((): void => {
    setInfoOpen(true);
  }, []);

  const hideInfo = React.useCallback((): void => {
    setInfoOpen(false);
  }, []);

  const copyImage = React.useCallback(async (): Promise<void> => {
    if (!imageSource) {
      setFeedback({
        tone: "error",
        message: text("photo-viewer.status.copyFailed"),
      });
      return;
    }

    try {
      const response = await fetch(imageSource.resourceUri);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const mimeType = blob.type || "image/png";
      const file = new File([blob], imageSource.fileName || "image", { type: mimeType });
      await navigator.clipboard.write([new ClipboardItem({ [mimeType]: file })]);
      setFeedback({
        tone: "success",
        message: text("photo-viewer.status.copied"),
      });
      logger.info("图片已复制到剪贴板", {
        sourceId: imageSource.sourceId,
        mimeType,
      });
    } catch (error) {
      logger.error("复制图片失败", error);
      setFeedback({
        tone: "error",
        message: text("photo-viewer.status.copyFailed"),
      });
    }
  }, [imageSource, logger, text]);

  const resolveDroppedFilePath = React.useCallback(
    (file: File): string => {
      const bridgePath = client.platform.getPathForFile(file);
      if (bridgePath) {
        return bridgePath;
      }

      return (file as File & { path?: string }).path ?? "";
    },
    [client],
  );

  const dropFile = React.useCallback(
    async (file: File | null): Promise<void> => {
      if (!file) {
        return;
      }

      const filePath = resolveDroppedFilePath(file);
      if (!filePath) {
        setFeedback({
          tone: "error",
          message: text("photo-viewer.errors.openFailed"),
        });
        return;
      }

      await openImageFile(filePath);
    },
    [openImageFile, resolveDroppedFilePath, text],
  );

  const handleImageLoad = React.useCallback((dimensions: ImageDimensions): void => {
    setImageDimensions(dimensions);
    setIsImageLoaded(true);
    setIsResolving(false);
  }, []);

  const handleImageError = React.useCallback((): void => {
    setIsImageLoaded(false);
    setIsResolving(false);
    setFeedback({
      tone: "error",
      message: text("photo-viewer.errors.loadFailed"),
    });
  }, [text]);

  React.useEffect(() => {
    if (!imageTarget) {
      setImageSource(null);
      setImageDimensions(null);
      setIsImageLoaded(false);
      setIsResolving(false);
      return;
    }

    const boundedIndex = clampImageIndex(imageTarget, currentImageIndex);
    if (boundedIndex !== currentImageIndex) {
      setCurrentImageIndex(boundedIndex);
      return;
    }

    const resource = imageTarget.images[boundedIndex];
    if (!resource) {
      return;
    }

    let cancelled = false;
    const sourceId = resource.sourceId.trim();
    setIsResolving(true);
    setIsImageLoaded(false);
    setImageDimensions(null);
    setFeedback(null);

    const applyResolvedUri = (resolvedUri: string): void => {
      setImageSource({
        sourceId,
        filePath: resource.filePath,
        fileName: resolveImageCandidateName(resource),
        resourceUri: resolvedUri,
        revision: Date.now(),
      });
      logger.info("图片资源已准备完成", {
        sourceId,
        filePath: resource.filePath,
        resourceUri: resolvedUri,
        index: boundedIndex,
        total: imageTarget.images.length,
      });
    };

    const cachedUri = resourceUriCache.get(sourceId);
    if (cachedUri !== null) {
      applyResolvedUri(cachedUri);
      return;
    }

    void client.resource.resolve(sourceId)
      .then((resolved) => {
        if (cancelled) {
          return;
        }

        resourceUriCache.set(sourceId, resolved.uri);
        setThumbCacheRevision((revision) => revision + 1);
        applyResolvedUri(resolved.uri);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        logger.error("打开图片失败", error);
        setImageSource(null);
        setIsResolving(false);
        setFeedback({
          tone: "error",
          message: resolveErrorMessage(error, text("photo-viewer.errors.openFailed")),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [client, currentImageIndex, imageTarget, logger, text]);

  React.useEffect(() => {
    if (!imageTarget || imageTarget.images.length <= 1) {
      return;
    }

    const currentResource = imageTarget.images[currentImageIndex];
    if (!currentResource) {
      return;
    }

    let cancelled = false;
    const neighborIndexes = [
      currentImageIndex - 1,
      currentImageIndex + 1,
    ].filter((index) => index >= 0 && index < imageTarget.images.length);

    for (const index of neighborIndexes) {
      const neighbor = imageTarget.images[index];
      const neighborSourceId = neighbor?.sourceId.trim();
      if (!neighborSourceId) {
        continue;
      }

      const cachedUri = resourceUriCache.get(neighborSourceId);
      if (cachedUri !== null) {
        preloadImage(cachedUri);
        continue;
      }

      void client.resource.resolve(neighborSourceId)
        .then((resolved) => {
          if (cancelled) {
            return;
          }

          resourceUriCache.set(neighborSourceId, resolved.uri);
          setThumbCacheRevision((revision) => revision + 1);
          preloadImage(resolved.uri);
        })
        .catch((error) => {
          logger.warn("预加载相邻图片失败", {
            sourceId: neighborSourceId,
            error,
          });
        });
    }

    return () => {
      cancelled = true;
    };
  }, [client, currentImageIndex, imageTarget, logger]);

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (hasResolvedLaunchContextRef.current) {
      return;
    }

    hasResolvedLaunchContextRef.current = true;
    const nextLaunchContext = readLaunchContext(client);
    setLaunchContext(nextLaunchContext);
    const target = resolveLaunchImageTarget(nextLaunchContext);

    if (!target) {
      return;
    }

    logger.info("检测到启动参数里的图片路径", {
      targetCount: target.images.length,
      initialIndex: target.initialIndex,
      trigger: nextLaunchContext.launchParams.trigger,
    });
    openImageTarget(target);
  }, [client, logger, openImageTarget]);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.isComposing) {
        return;
      }

      if (event.defaultPrevented) {
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey;

      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          event.preventDefault();
          void document.exitFullscreen().catch(() => undefined);
          return;
        }

        if (infoOpen) {
          event.preventDefault();
          setInfoOpen(false);
        }
        return;
      }

      if (hasModifier && !event.altKey && event.key.toLowerCase() === "l") {
        if (!imageSource) {
          return;
        }

        event.preventDefault();
        const actions = cameraActionsRef.current;
        actions?.zoomIn();
        actions?.zoomIn();
        return;
      }

      if (!imageTarget || imageTarget.images.length <= 1) {
        return;
      }

      if (event.key === "ArrowLeft") {
        if (hasModifier && !event.altKey) {
          event.preventDefault();
          firstImage();
        } else if (!hasModifier && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          previousImage();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        if (hasModifier && !event.altKey) {
          event.preventDefault();
          lastImage();
        } else if (!hasModifier && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          nextImage();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [firstImage, imageSource, imageTarget, infoOpen, lastImage, nextImage, previousImage]);

  React.useEffect(() => {
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

  const activeSceneId = getSceneIdForImage(Boolean(imageTarget));
  const activeScene = getSceneDefinition(activeSceneId);
  const environment = React.useMemo<PhotoViewerRuntimeEnvironment>(() => ({
    appId: appConfig.appId,
    pluginId: launchContext.surfaceContext?.pluginId ?? launchContext.pluginId ?? appConfig.appId,
    hostSceneId: resolveHostSceneId(launchContext, appConfig.defaultSceneId),
    activeSceneId,
    surfaceId: launchContext.surfaceContext?.surfaceId ?? launchContext.surfaceId ?? null,
    sessionId: launchContext.surfaceContext?.sessionId ?? launchContext.sessionId ?? null,
    surfaceKind: resolveSurfaceKind(launchContext),
    launchParams: resolveLaunchParams(launchContext),
  }), [activeSceneId, launchContext]);

  const value = React.useMemo<PhotoViewerRuntimeValue>(() => ({
    client,
    traceId,
    launchContext,
    surface: launchContext.surfaceContext ?? null,
    environment,
    activeSceneId,
    activeScene,
    locale,
    hostKind,
    imageTarget,
    currentImageIndex,
    imageSource,
    imageDimensions,
    feedback,
    isResolving,
    isSaving,
    isImageLoaded,
    infoOpen,
    thumbCacheRevision,
    t: text,
    openImageFile,
    openFile,
    saveImage,
    previousImage,
    nextImage,
    jumpTo,
    reloadCurrent,
    getResolvedThumbUri,
    dropFile,
    handleImageLoad,
    handleImageError,
    setFeedback,
    zoomActions: zoomActionsHandle,
    setZoomActions: registerZoomActions,
    registerZoomActions,
    fullscreen,
    rotateClockwise,
    rotateCounterclockwise,
    showInfo,
    hideInfo,
    copyImage,
    firstImage,
    lastImage,
  }), [
    activeScene,
    activeSceneId,
    client,
    copyImage,
    currentImageIndex,
    dropFile,
    environment,
    feedback,
    firstImage,
    fullscreen,
    getResolvedThumbUri,
    handleImageError,
    handleImageLoad,
    hideInfo,
    hostKind,
    imageDimensions,
    imageSource,
    imageTarget,
    infoOpen,
    isImageLoaded,
    isResolving,
    isSaving,
    jumpTo,
    lastImage,
    launchContext,
    locale,
    nextImage,
    openFile,
    openImageFile,
    previousImage,
    registerZoomActions,
    reloadCurrent,
    rotateClockwise,
    rotateCounterclockwise,
    saveImage,
    showInfo,
    text,
    thumbCacheRevision,
    traceId,
    zoomActionsHandle,
  ]);

  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}

export function useAppRuntime(): PhotoViewerRuntimeValue {
  const context = React.useContext(AppRuntimeContext);
  if (!context) {
    throw new Error("AppRuntimeContext is not available.");
  }

  return context;
}
