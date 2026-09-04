import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getBasecardDescriptor,
  getBasecardRegistryVersion,
  subscribeBasecardRegistry,
} from '../basecard-runtime/registry';
import { globalEventEmitter } from '../core/event-emitter';
import { fileService } from '../services/file-service';
import { platformService } from '../services/platform-service';
import { getChipsClient } from '../services/bridge-client';
import { resourceService } from '../services/resource-service';
import { zipService } from '../services/zip-service';
import type { BasecardPendingResourceImport, BasecardResourceOperations } from '../basecard-runtime/contracts';
import type { EditorSessionSnapshot } from './contracts';
import { useEditorRuntime } from './context';
import { ENGINE_ICONS } from '../icons/descriptors';
import { RuntimeIcon } from '../icons/RuntimeIcon';

function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

async function resolveCardResourceUrl(cardRootDir: string, resourcePath: string): Promise<string> {
  return getChipsClient().card.resolveResourceUrl(cardRootDir, resourcePath);
}

function normalizeResourcePath(resourcePath: string): string | null {
  const normalized = resourcePath.replace(/\\/g, '/').trim();
  if (!normalized) {
    return null;
  }

  const segments = normalized
    .replace(/^\.?\//, '')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.');
  if (segments.length === 0 || segments.some((segment) => segment === '..')) {
    return null;
  }

  return segments.join('/');
}

function sanitizeImportedPathSegment(segment: string, fallback: string): string {
  const sanitized = segment
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .trim();

  return sanitized.length > 0 && sanitized !== '.' && sanitized !== '..' ? sanitized : fallback;
}

function sanitizeImportedResourcePath(fileName: string): string {
  const normalizedPath = normalizeResourcePath(fileName);
  if (!normalizedPath) {
    return sanitizeImportedPathSegment(fileName, 'resource');
  }

  const segments = normalizedPath.split('/');
  return segments
    .map((segment, index) => sanitizeImportedPathSegment(segment, index === segments.length - 1 ? 'resource' : 'assets'))
    .filter((segment) => segment.length > 0)
    .join('/') || 'resource';
}

function createObjectUrl(resource: BasecardPendingResourceImport): string {
  const type = resource.mimeType?.trim() || 'application/octet-stream';
  const buffer = new ArrayBuffer(resource.data.byteLength);
  new Uint8Array(buffer).set(resource.data);
  return URL.createObjectURL(new Blob([buffer], { type }));
}

function getPendingResourceCacheKey(resource: BasecardPendingResourceImport): string {
  if (resource.token) {
    return resource.token;
  }

  let hash = 2166136261;
  for (const byte of resource.data) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `${resource.mimeType ?? ''}:${resource.data.byteLength}:${hash >>> 0}`;
}

function createStagedConversionFilePath(cardPath: string, baseCardId: string, extension: string): string {
  const normalizedExtension = extension.replace(/^\./, '').toLowerCase() || 'bin';
  const normalizedBaseCardId = baseCardId.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-') || 'basecard';
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return joinPath(cardPath, '.card', `.__editor-${normalizedBaseCardId}-${token}.${normalizedExtension}`);
}

function resolveResourceExtension(resourcePath: string, fallback: string): string {
  const fileName = resourcePath.split('/').filter(Boolean).pop() ?? '';
  const dotIndex = fileName.lastIndexOf('.');
  const extension = dotIndex >= 0 ? fileName.slice(dotIndex + 1).trim().toLowerCase() : '';
  return extension || fallback;
}

function resolveVideoThumbnailOutputExtension(
  outputPath: string,
  format?: 'png' | 'jpeg',
): string {
  if (format === 'jpeg') {
    return 'jpg';
  }

  const extension = resolveResourceExtension(outputPath, 'png');
  return extension === 'jpg' || extension === 'jpeg' ? 'jpg' : 'png';
}

export interface EditorHostProps {
  cardId: string;
  cardPath: string;
  cardType: string;
  baseCardId: string;
  sourceConfig: Record<string, unknown>;
  pendingResourceImports?: Map<string, BasecardPendingResourceImport>;
  onConfigChange?: (
    config: Record<string, unknown>,
    resourceOperations?: BasecardResourceOperations,
  ) => Promise<void> | void;
  onPluginLoaded?: (pluginInfo: { cardType: string; baseCardId: string }) => void;
  onPluginError?: (error: Error) => void;
}

export function EditorHost({
  cardId,
  cardPath,
  cardType,
  baseCardId,
  sourceConfig,
  pendingResourceImports,
  onConfigChange,
  onPluginLoaded,
  onPluginError,
}: EditorHostProps) {
  const store = useEditorRuntime();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [registryVersion, setRegistryVersion] = useState(() => getBasecardRegistryVersion());
  const descriptor = useMemo(() => getBasecardDescriptor(cardType), [cardType, registryVersion]);
  const sourceSignature = useMemo(() => JSON.stringify(sourceConfig), [sourceConfig]);
  const sessionKey = useMemo(() => store.createKey(cardId, baseCardId), [baseCardId, cardId, store]);

  const [snapshot, setSnapshot] = useState<EditorSessionSnapshot | null>(() => {
    if (!descriptor) {
      return null;
    }

    return store.ensureSession({
      cardId,
      baseCardId,
      cardType: descriptor.cardType,
      sourceConfig,
      descriptor,
    });
  });
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderRevision, setRenderRevision] = useState(0);
  const mountRevision = snapshot?.mountRevision ?? 0;
  const latestDraftConfigRef = useRef<Record<string, unknown>>(sourceConfig);
  const pendingResourceImportsRef = useRef(pendingResourceImports);
  const resolvedResourceUrlsRef = useRef(new Map<string, {
    url: string;
    kind: 'pending' | 'file';
    cacheKey: string;
  }>());
  const pendingResourceResolvesRef = useRef(new Map<string, Promise<string>>());
  const commitSessionRef = useRef<() => Promise<void>>(async () => undefined);

  const syncSnapshot = useCallback(() => {
    setSnapshot(store.getSnapshot(sessionKey));
  }, [sessionKey, store]);

  const releaseResolvedResourceUrl = useCallback((resourcePath: string) => {
    const url = resolvedResourceUrlsRef.current.get(resourcePath);
    if (!url) {
      return;
    }

    if (url.url.startsWith('blob:')) {
      URL.revokeObjectURL(url.url);
    }
    resolvedResourceUrlsRef.current.delete(resourcePath);
  }, []);

  const releaseAllResolvedResourceUrls = useCallback(() => {
    resolvedResourceUrlsRef.current.forEach((url) => {
      if (url.url.startsWith('blob:')) {
        URL.revokeObjectURL(url.url);
      }
    });
    resolvedResourceUrlsRef.current.clear();
    pendingResourceResolvesRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      releaseAllResolvedResourceUrls();
    };
  }, [releaseAllResolvedResourceUrls, sessionKey, cardPath]);

  useEffect(() => {
    return subscribeBasecardRegistry(() => {
      setRegistryVersion(getBasecardRegistryVersion());
    });
  }, []);

  useEffect(() => {
    latestDraftConfigRef.current = snapshot?.draftConfig ?? sourceConfig;
  }, [snapshot?.draftConfig, sourceConfig]);

  useEffect(() => {
    pendingResourceImportsRef.current = pendingResourceImports;
  }, [pendingResourceImports]);

  useEffect(() => {
    if (!descriptor) {
      setSnapshot(null);
      return;
    }

    const nextSnapshot = store.ensureSession({
      cardId,
      baseCardId,
      cardType: descriptor.cardType,
      sourceConfig,
      descriptor,
    });
    setSnapshot(nextSnapshot);

    return store.subscribe(sessionKey, () => {
      syncSnapshot();
    });
  }, [baseCardId, cardId, cardType, descriptor, sessionKey, sourceConfig, sourceSignature, store, syncSnapshot]);

  const reportEditorActivity = useCallback(() => {
    globalEventEmitter.emit('card:editor-activity', {
      cardId,
      baseCardId,
      cardType,
      at: Date.now(),
    });
  }, [baseCardId, cardId, cardType]);

  const commitSession = useCallback(async () => {
    if (
      !descriptor
      || !onConfigChange
      || !snapshot?.dirty
      || !snapshot.validation.valid
    ) {
      return;
    }

    await store.commit(sessionKey, descriptor, async ({ config, resourceOperations }) => {
      reportEditorActivity();
      const hasResourceOperations =
        resourceOperations.imports.length > 0 || resourceOperations.deletions.length > 0;
      await onConfigChange(config, hasResourceOperations ? resourceOperations : undefined);
    });
  }, [
    descriptor,
    onConfigChange,
    reportEditorActivity,
    sessionKey,
    snapshot,
    snapshot?.dirty,
    snapshot?.hasPendingResourceChanges,
    snapshot?.sourceConfig,
    snapshot?.draftConfig,
    snapshot?.validation.valid,
    store,
  ]);

  const resolveResourceUrl = useCallback(async (resourcePath: string) => {
    const normalizedResourcePath = normalizeResourcePath(resourcePath);
    if (!normalizedResourcePath) {
      throw new Error(`资源路径无效: ${resourcePath}`);
    }

    const cached = resolvedResourceUrlsRef.current.get(normalizedResourcePath);
    const pendingImport =
      store.getPendingResourceImport(sessionKey, normalizedResourcePath)
      ?? pendingResourceImportsRef.current?.get(normalizedResourcePath)
      ?? null;
    const nextKind = pendingImport ? 'pending' : 'file';
    const nextCacheKey = pendingImport
      ? getPendingResourceCacheKey(pendingImport)
      : joinPath(cardPath, normalizedResourcePath);

    if (cached?.kind === nextKind && cached.cacheKey === nextCacheKey) {
      return cached.url;
    }

    const pendingResolve = pendingResourceResolvesRef.current.get(normalizedResourcePath);
    if (pendingResolve) {
      return pendingResolve;
    }

    const resolver = (async () => {
      const nextUrl = pendingImport
        ? createObjectUrl(pendingImport)
        : await resolveCardResourceUrl(cardPath, normalizedResourcePath);
      releaseResolvedResourceUrl(normalizedResourcePath);
      resolvedResourceUrlsRef.current.set(normalizedResourcePath, {
        url: nextUrl,
        kind: nextKind,
        cacheKey: nextCacheKey,
      });
      return nextUrl;
    })().finally(() => {
      pendingResourceResolvesRef.current.delete(normalizedResourcePath);
    });

    pendingResourceResolvesRef.current.set(normalizedResourcePath, resolver);
    return resolver;
  }, [cardPath, releaseResolvedResourceUrl, sessionKey, store]);

  const pickAvailableResourcePath = useCallback(async (fileName: string) => {
    const sanitizedName = sanitizeImportedResourcePath(fileName);
    const activeConfig = latestDraftConfigRef.current;
    const referencedPaths = new Set(
      descriptor?.collectResourcePaths?.(activeConfig) ?? [],
    );
    if (referencedPaths.has(sanitizedName)) {
      return sanitizedName;
    }

    const dotIndex = sanitizedName.lastIndexOf('.');
    const basename = dotIndex > 0 ? sanitizedName.slice(0, dotIndex) : sanitizedName;
    const extension = dotIndex > 0 ? sanitizedName.slice(dotIndex) : '';

    let counter = 1;
    let candidate = sanitizedName;

    while (true) {
      const pendingImport = store.getPendingResourceImport(sessionKey, candidate);
      const pendingDelete = store.hasPendingResourceDeletion(sessionKey, candidate);
      const existsOnDisk = pendingDelete ? false : await fileService.exists(joinPath(cardPath, candidate));
      if (!pendingImport && !existsOnDisk) {
        return candidate;
      }

      counter += 1;
      candidate = `${basename}-${counter}${extension}`;
    }
  }, [cardPath, descriptor, sessionKey, store]);

  const importResource = useCallback(async (input: { file: File; preferredPath?: string }) => {
    const nextPath = await pickAvailableResourcePath(input.preferredPath ?? input.file.name);
    const arrayBuffer = await input.file.arrayBuffer();
    releaseResolvedResourceUrl(nextPath);
    store.queueResourceImport(sessionKey, {
      path: nextPath,
      data: new Uint8Array(arrayBuffer),
      mimeType: input.file.type || undefined,
    });

    return {
      path: nextPath,
    };
  }, [pickAvailableResourcePath, releaseResolvedResourceUrl, sessionKey, store]);

  const deleteResource = useCallback(async (resourcePath: string) => {
    const normalizedResourcePath = normalizeResourcePath(resourcePath);
    if (!normalizedResourcePath) {
      throw new Error(`资源路径无效: ${resourcePath}`);
    }

    releaseResolvedResourceUrl(normalizedResourcePath);
    store.queueResourceDeletion(sessionKey, normalizedResourcePath);
  }, [releaseResolvedResourceUrl, sessionKey, store]);

  const convertTiffToPng = useCallback(async (input: {
    resourcePath: string;
    outputPath: string;
    overwrite?: boolean;
  }) => {
    const normalizedResourcePath = normalizeResourcePath(input.resourcePath);
    if (!normalizedResourcePath) {
      throw new Error(`资源路径无效: ${input.resourcePath}`);
    }

    const normalizedOutputPath = normalizeResourcePath(input.outputPath);
    if (!normalizedOutputPath) {
      throw new Error(`输出路径无效: ${input.outputPath}`);
    }

    const pendingSourceImport = store.getPendingResourceImport(sessionKey, normalizedResourcePath);
    const absoluteSourcePath = joinPath(cardPath, normalizedResourcePath);
    const stagedSourcePath = pendingSourceImport
      ? createStagedConversionFilePath(cardPath, baseCardId, 'tiff')
      : null;
    const stagedOutputPath = createStagedConversionFilePath(cardPath, baseCardId, 'png');
    let convertedOutputPath = stagedOutputPath;

    try {
      if (pendingSourceImport) {
        await fileService.writeBinary(stagedSourcePath!, pendingSourceImport.data);
      } else {
        const sourceExists = await fileService.exists(absoluteSourcePath);
        if (!sourceExists) {
          throw new Error(`TIFF 资源不存在: ${normalizedResourcePath}`);
        }
      }

      const converted = await resourceService.convertTiffToPng({
        resourceId: stagedSourcePath ?? absoluteSourcePath,
        outputFile: stagedOutputPath,
        ...(typeof input.overwrite === 'boolean' ? { overwrite: input.overwrite } : undefined),
      });

      convertedOutputPath = converted.outputFile || stagedOutputPath;
      const convertedBytes = await fileService.readBinary(convertedOutputPath);
      releaseResolvedResourceUrl(normalizedOutputPath);
      store.queueResourceImport(sessionKey, {
        path: normalizedOutputPath,
        data: convertedBytes,
        mimeType: converted.mimeType,
      });

      return {
        path: normalizedOutputPath,
        mimeType: converted.mimeType,
        sourceMimeType: converted.sourceMimeType,
        width: converted.width,
        height: converted.height,
      };
    } finally {
      if (stagedSourcePath) {
        await fileService.delete(stagedSourcePath).catch(() => undefined);
      }
      await fileService.delete(convertedOutputPath).catch(() => undefined);
    }
  }, [baseCardId, cardPath, releaseResolvedResourceUrl, sessionKey, store]);

  const extractVideoThumbnail = useCallback(async (input: {
    resourcePath: string;
    outputPath: string;
    overwrite?: boolean;
    options?: {
      timeSeconds?: number;
      format?: 'png' | 'jpeg';
      width?: number;
      height?: number;
      fit?: 'contain' | 'cover';
      quality?: number;
    };
  }) => {
    const normalizedResourcePath = normalizeResourcePath(input.resourcePath);
    if (!normalizedResourcePath) {
      throw new Error(`资源路径无效: ${input.resourcePath}`);
    }

    const normalizedOutputPath = normalizeResourcePath(input.outputPath);
    if (!normalizedOutputPath) {
      throw new Error(`输出路径无效: ${input.outputPath}`);
    }

    const pendingSourceImport = store.getPendingResourceImport(sessionKey, normalizedResourcePath);
    const absoluteSourcePath = joinPath(cardPath, normalizedResourcePath);
    const stagedSourcePath = pendingSourceImport
      ? createStagedConversionFilePath(cardPath, baseCardId, resolveResourceExtension(normalizedResourcePath, 'video'))
      : null;
    const stagedOutputPath = createStagedConversionFilePath(
      cardPath,
      baseCardId,
      resolveVideoThumbnailOutputExtension(normalizedOutputPath, input.options?.format),
    );
    let extractedOutputPath = stagedOutputPath;

    try {
      if (pendingSourceImport) {
        await fileService.writeBinary(stagedSourcePath!, pendingSourceImport.data);
      } else {
        const sourceExists = await fileService.exists(absoluteSourcePath);
        if (!sourceExists) {
          throw new Error(`视频资源不存在: ${normalizedResourcePath}`);
        }
      }

      const extracted = await resourceService.extractVideoFrame({
        resourceId: stagedSourcePath ?? absoluteSourcePath,
        outputFile: stagedOutputPath,
        ...(typeof input.overwrite === 'boolean' ? { overwrite: input.overwrite } : undefined),
        ...(input.options ? { options: input.options } : undefined),
      });

      extractedOutputPath = extracted.outputFile || stagedOutputPath;
      const extractedBytes = await fileService.readBinary(extractedOutputPath);
      releaseResolvedResourceUrl(normalizedOutputPath);
      store.queueResourceImport(sessionKey, {
        path: normalizedOutputPath,
        data: extractedBytes,
        mimeType: extracted.mimeType,
      });

      return {
        path: normalizedOutputPath,
        mimeType: extracted.mimeType,
        sourceMimeType: extracted.sourceMimeType,
        width: extracted.width,
        height: extracted.height,
        format: extracted.format,
        frameTimeSeconds: extracted.frameTimeSeconds,
        durationSeconds: extracted.durationSeconds,
      };
    } finally {
      if (stagedSourcePath) {
        await fileService.delete(stagedSourcePath).catch(() => undefined);
      }
      await fileService.delete(extractedOutputPath).catch(() => undefined);
    }
  }, [baseCardId, cardPath, releaseResolvedResourceUrl, sessionKey, store]);

  const importArchiveBundle = useCallback(async (input: {
    file: File;
    preferredRootDir?: string;
    entryFile?: string;
    include?: {
      mimeTypes?: string[];
      extensions?: string[];
    };
    stripSingleRootDir?: boolean;
    excludeSystemArtifacts?: boolean;
  }) => {
    // task034 M4：ZIP 目录导入由 Host resource.importArchive 统一执行
    // （根探测/过滤/魔数嗅探/系统垃圾清理/暂存回滚），编辑引擎不再本地实现。
    const zipPath = platformService.getPathForFile(input.file);
    if (!zipPath) {
      throw new Error('当前宿主无法读取所选压缩包文件。');
    }

    const result = await getChipsClient().resource.importArchive({
      zipFile: zipPath,
      targetRoot: cardPath,
      preferredRootDir: input.preferredRootDir,
      entryFile: input.entryFile,
      include: input.include,
      stripSingleRootDir: input.stripSingleRootDir,
      excludeSystemArtifacts: input.excludeSystemArtifacts,
    });

    result.resourcePaths.forEach((resourcePath) => {
      releaseResolvedResourceUrl(resourcePath);
    });
    return result;
  }, [cardPath, releaseResolvedResourceUrl]);

  useEffect(() => {
    commitSessionRef.current = commitSession;
  }, [commitSession]);

  useEffect(() => {
    if (
      !descriptor
      || !snapshot?.dirty
      || !snapshot.validation.valid
      || !store.canCommit(sessionKey, descriptor)
    ) {
      return;
    }

    const hasConfigDelta =
      JSON.stringify(snapshot.draftConfig) !== JSON.stringify(snapshot.sourceConfig);
    const commitDelayMs = snapshot.hasPendingResourceChanges && hasConfigDelta
      ? 0
      : snapshot.commitDebounceMs;
    const timerId = window.setTimeout(() => {
      void commitSession().catch((error) => {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        setLoadError(normalizedError);
        onPluginError?.(normalizedError);
      });
    }, commitDelayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    commitSession,
    descriptor,
    onPluginError,
    snapshot?.commitDebounceMs,
    snapshot?.draftConfig,
    snapshot?.dirty,
    snapshot?.hasPendingResourceChanges,
    snapshot?.revision,
    snapshot?.sourceConfig,
    snapshot?.validation.valid,
  ]);

  useEffect(() => {
    const flushPendingSession = () => {
      void commitSessionRef.current().catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSession();
      }
    };

    window.addEventListener('pagehide', flushPendingSession);
    window.addEventListener('beforeunload', flushPendingSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushPendingSession);
      window.removeEventListener('beforeunload', flushPendingSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      void commitSessionRef.current().catch(() => undefined);
    };
  }, [sessionKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      const error = new Error('Editor panel container is unavailable.');
      setLoadError(error);
      onPluginError?.(error);
      return;
    }

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (!descriptor) {
      const error = new Error(`未注册基础卡片编辑器: ${cardType}`);
      setLoadError(error);
      setIsLoading(false);
      onPluginError?.(error);
      return;
    }

    const activeSnapshot = store.getSnapshot(sessionKey);
    if (!descriptor.renderEditor || !activeSnapshot) {
      const error = new Error(`基础卡片未提供编辑器实现: ${descriptor.cardType}`);
      setLoadError(error);
      setIsLoading(false);
      onPluginError?.(error);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    let disposed = false;
    let cleanup: (() => void) | void;

    try {
      cleanup = descriptor.renderEditor({
        container,
        initialConfig: activeSnapshot.draftConfig,
        onChange(nextConfig) {
          if (disposed) {
            return;
          }

          reportEditorActivity();
          store.updateDraft(sessionKey, descriptor, nextConfig);
        },
        resolveResourceUrl,
        releaseResourceUrl(resourcePath) {
          const normalizedResourcePath = normalizeResourcePath(resourcePath);
          if (!normalizedResourcePath) {
            return;
          }

          releaseResolvedResourceUrl(normalizedResourcePath);
        },
        importResource,
        importArchiveBundle,
        deleteResource,
        convertTiffToPng,
        extractVideoThumbnail,
      });

      setIsLoading(false);
      onPluginLoaded?.({
        cardType: descriptor.cardType,
        baseCardId,
      });
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      setLoadError(normalizedError);
      setIsLoading(false);
      onPluginError?.(normalizedError);
    }

    return () => {
      disposed = true;
      if (typeof cleanup === 'function') {
        cleanup();
      }

      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [
    baseCardId,
    cardType,
    descriptor,
    onPluginError,
    onPluginLoaded,
    renderRevision,
    reportEditorActivity,
    resolveResourceUrl,
    importResource,
    importArchiveBundle,
    deleteResource,
    convertTiffToPng,
    extractVideoThumbnail,
    releaseResolvedResourceUrl,
    sessionKey,
    mountRevision,
    store,
  ]);

  const errorText = loadError?.message || snapshot?.errorMessage || '加载失败';

  return (
    <div className="plugin-host">
      <div ref={containerRef} className="plugin-host__container" />

      {isLoading && (
        <div className="plugin-host__loading">
          <div className="plugin-host__spinner"></div>
          <span className="plugin-host__loading-text">加载中...</span>
        </div>
      )}

      {!isLoading && (loadError || snapshot?.errorMessage) && (
        <div className="plugin-host__error">
          <div className="plugin-host__error-icon">
            <RuntimeIcon icon={ENGINE_ICONS.warning} />
          </div>
          <p className="plugin-host__error-text">{errorText}</p>
          <button
            type="button"
            className="plugin-host__retry-btn"
            onClick={() => setRenderRevision((current) => current + 1)}
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}
