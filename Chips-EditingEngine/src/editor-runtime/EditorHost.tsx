import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BasecardChangePayload,
  BasecardErrorPayload,
  BasecardValidationResult,
} from 'chips-sdk';
import { getChipsClient } from '../services/bridge-client';
import { globalEventEmitter } from '../core/event-emitter';
import { useTranslation } from '../hooks/useTranslation';
import { fileService } from '../services/file-service';
import type { BasecardPendingResourceImport, BasecardResourceOperations } from '../basecard-runtime/contracts';

function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
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

function sanitizeImportedFileName(fileName: string): string {
  const normalizedPath = normalizeResourcePath(fileName);
  const candidate = normalizedPath?.split('/').pop() ?? fileName.trim();
  const sanitized = candidate
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .trim();

  return sanitized.length > 0 ? sanitized : 'resource';
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function cloneResourceImport(resource: BasecardPendingResourceImport): BasecardPendingResourceImport {
  return {
    path: resource.path,
    data: cloneBytes(resource.data),
    mimeType: resource.mimeType,
  };
}

function createObjectUrl(resource: BasecardPendingResourceImport): string {
  const type = resource.mimeType?.trim() || 'application/octet-stream';
  const buffer = new ArrayBuffer(resource.data.byteLength);
  new Uint8Array(buffer).set(resource.data);
  return URL.createObjectURL(new Blob([buffer], { type }));
}

interface PendingCommitState {
  config: Record<string, unknown>;
  referencedResources: string[];
  validation: BasecardValidationResult;
}

interface MountedSessionState {
  sessionId: string;
  pluginId: string;
  cardType: string;
  baseCardId: string;
  commitDebounceMs: number;
  lastSeenPropSignature: string;
  authoritativeSignature: string;
  cleanupTasks: Array<() => void>;
}

export interface EditorHostProps {
  cardId: string;
  cardPath: string;
  cardType: string;
  baseCardId: string;
  sourceConfig: Record<string, unknown>;
  onConfigChange?: (
    config: Record<string, unknown>,
    resourceOperations?: BasecardResourceOperations,
  ) => Promise<void> | void;
  onPluginLoaded?: (pluginInfo: { cardType: string; baseCardId: string; pluginId: string }) => void;
  onPluginError?: (error: Error) => void;
}

export function EditorHost({
  cardId,
  cardPath,
  cardType,
  baseCardId,
  sourceConfig,
  onConfigChange,
  onPluginLoaded,
  onPluginError,
}: EditorHostProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const onConfigChangeRef = useRef(onConfigChange);
  const onPluginLoadedRef = useRef(onPluginLoaded);
  const onPluginErrorRef = useRef(onPluginError);
  const mountedSessionRef = useRef<MountedSessionState | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const latestCommitStateRef = useRef<PendingCommitState | null>(null);
  const pendingImportsRef = useRef(new Map<string, BasecardPendingResourceImport>());
  const pendingDeletionsRef = useRef(new Set<string>());
  const resolvedResourceUrlsRef = useRef(new Map<string, string>());
  const pendingResourceResolvesRef = useRef(new Map<string, Promise<string>>());
  const sourceSignature = useMemo(() => JSON.stringify(sourceConfig), [sourceConfig]);
  const sessionIdentity = useMemo(() => `${cardId}::${baseCardId}::${cardType}::${cardPath}`, [baseCardId, cardId, cardPath, cardType]);
  const mountEditorSessionRef = useRef<(() => Promise<void>) | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [renderRevision, setRenderRevision] = useState(0);

  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  useEffect(() => {
    onPluginLoadedRef.current = onPluginLoaded;
  }, [onPluginLoaded]);

  useEffect(() => {
    onPluginErrorRef.current = onPluginError;
  }, [onPluginError]);

  const clearCommitTimer = useCallback(() => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  const releaseResolvedResourceUrl = useCallback((resourcePath: string) => {
    const url = resolvedResourceUrlsRef.current.get(resourcePath);
    if (!url) {
      return;
    }

    URL.revokeObjectURL(url);
    resolvedResourceUrlsRef.current.delete(resourcePath);
  }, []);

  const releaseAllResolvedResourceUrls = useCallback(() => {
    resolvedResourceUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    resolvedResourceUrlsRef.current.clear();
    pendingResourceResolvesRef.current.clear();
  }, []);

  const reportEditorActivity = useCallback(() => {
    globalEventEmitter.emit('card:editor-activity', {
      cardId,
      baseCardId,
      cardType,
      at: Date.now(),
    });
  }, [baseCardId, cardId, cardType]);

  const resolveResourceUrl = useCallback(async (resourcePath: string) => {
    const normalizedResourcePath = normalizeResourcePath(resourcePath);
    if (!normalizedResourcePath) {
      throw new Error(`资源路径无效: ${resourcePath}`);
    }

    const cached = resolvedResourceUrlsRef.current.get(normalizedResourcePath);
    if (cached) {
      return cached;
    }

    const pendingResolve = pendingResourceResolvesRef.current.get(normalizedResourcePath);
    if (pendingResolve) {
      return pendingResolve;
    }

    const resolver = (async () => {
      const pendingImport = pendingImportsRef.current.get(normalizedResourcePath);
      const nextUrl = pendingImport
        ? createObjectUrl(pendingImport)
        : createObjectUrl({
            path: normalizedResourcePath,
            data: await fileService.readBinary(joinPath(cardPath, normalizedResourcePath)),
          });

      releaseResolvedResourceUrl(normalizedResourcePath);
      resolvedResourceUrlsRef.current.set(normalizedResourcePath, nextUrl);
      return nextUrl;
    })().finally(() => {
      pendingResourceResolvesRef.current.delete(normalizedResourcePath);
    });

    pendingResourceResolvesRef.current.set(normalizedResourcePath, resolver);
    return resolver;
  }, [cardPath, releaseResolvedResourceUrl]);

  const pickAvailableResourcePath = useCallback(async (fileName: string) => {
    const sanitizedName = sanitizeImportedFileName(fileName);
    const dotIndex = sanitizedName.lastIndexOf('.');
    const basename = dotIndex > 0 ? sanitizedName.slice(0, dotIndex) : sanitizedName;
    const extension = dotIndex > 0 ? sanitizedName.slice(dotIndex) : '';

    let counter = 1;
    let candidate = sanitizedName;

    while (true) {
      const pendingImport = pendingImportsRef.current.has(candidate);
      const pendingDelete = pendingDeletionsRef.current.has(candidate);
      const existsOnDisk = pendingDelete ? false : await fileService.exists(joinPath(cardPath, candidate));
      if (!pendingImport && !existsOnDisk) {
        return candidate;
      }

      counter += 1;
      candidate = `${basename}-${counter}${extension}`;
    }
  }, [cardPath]);

  const importResource = useCallback(async (input: { file: File; preferredPath?: string }) => {
    const nextPath = await pickAvailableResourcePath(input.preferredPath ?? input.file.name);
    const arrayBuffer = await input.file.arrayBuffer();
    const pendingImport = {
      path: nextPath,
      data: new Uint8Array(arrayBuffer),
      mimeType: input.file.type || undefined,
    } satisfies BasecardPendingResourceImport;

    releaseResolvedResourceUrl(nextPath);
    pendingImportsRef.current.set(nextPath, pendingImport);
    pendingDeletionsRef.current.delete(nextPath);

    return {
      path: nextPath,
    };
  }, [pickAvailableResourcePath, releaseResolvedResourceUrl]);

  const deleteResource = useCallback(async (resourcePath: string) => {
    const normalizedResourcePath = normalizeResourcePath(resourcePath);
    if (!normalizedResourcePath) {
      throw new Error(`资源路径无效: ${resourcePath}`);
    }

    releaseResolvedResourceUrl(normalizedResourcePath);
    if (!pendingImportsRef.current.delete(normalizedResourcePath)) {
      pendingDeletionsRef.current.add(normalizedResourcePath);
    }
  }, [releaseResolvedResourceUrl]);

  const buildResourceOperations = useCallback((referencedResources: string[]): BasecardResourceOperations | undefined => {
    const referencedSet = new Set(
      referencedResources
        .map((resourcePath) => normalizeResourcePath(resourcePath))
        .filter((resourcePath): resourcePath is string => Boolean(resourcePath)),
    );

    const imports = [...pendingImportsRef.current.values()]
      .filter((resource) => referencedSet.has(resource.path))
      .map(cloneResourceImport);
    const deletions = [...pendingDeletionsRef.current.values()]
      .filter((resourcePath) => !referencedSet.has(resourcePath));

    if (imports.length === 0 && deletions.length === 0) {
      return undefined;
    }

    return {
      imports,
      deletions,
    };
  }, []);

  const clearCommittedResourceOperations = useCallback((resourceOperations?: BasecardResourceOperations) => {
    if (!resourceOperations) {
      return;
    }

    return Promise.all([
      ...resourceOperations.imports.map(async (resource) => {
        const resourcePath = normalizeResourcePath(resource.path);
        if (!resourcePath) {
          pendingImportsRef.current.delete(resource.path);
          return;
        }

        const persisted = await fileService.exists(joinPath(cardPath, resourcePath)).catch(() => false);
        if (persisted) {
          pendingImportsRef.current.delete(resourcePath);
        }
      }),
      ...resourceOperations.deletions.map(async (resourcePath) => {
        const normalizedResourcePath = normalizeResourcePath(resourcePath);
        if (!normalizedResourcePath) {
          pendingDeletionsRef.current.delete(resourcePath);
          return;
        }

        const stillExists = await fileService.exists(joinPath(cardPath, normalizedResourcePath)).catch(() => false);
        if (!stillExists) {
          pendingDeletionsRef.current.delete(normalizedResourcePath);
        }
      }),
    ]).then(() => undefined);
  }, [cardPath]);

  const commitPendingChange = useCallback(async () => {
    clearCommitTimer();

    const currentSession = mountedSessionRef.current;
    const pendingCommitState = latestCommitStateRef.current;
    const handleConfigChange = onConfigChangeRef.current;
    if (!currentSession || !pendingCommitState || !handleConfigChange || !pendingCommitState.validation.valid) {
      return;
    }

    const resourceOperations = buildResourceOperations(pendingCommitState.referencedResources);
    await Promise.resolve(
      handleConfigChange(
        pendingCommitState.config,
        resourceOperations,
      ),
    );

    currentSession.authoritativeSignature = JSON.stringify(pendingCommitState.config);
    currentSession.lastSeenPropSignature = currentSession.authoritativeSignature;
    await clearCommittedResourceOperations(resourceOperations);
  }, [buildResourceOperations, clearCommitTimer, clearCommittedResourceOperations]);

  const scheduleCommit = useCallback(() => {
    const currentSession = mountedSessionRef.current;
    const pendingCommitState = latestCommitStateRef.current;
    if (!currentSession || !pendingCommitState || !pendingCommitState.validation.valid) {
      return;
    }

    clearCommitTimer();
    const hasPendingResourceMutations = pendingImportsRef.current.size > 0 || pendingDeletionsRef.current.size > 0;
    const commitDelayMs = hasPendingResourceMutations ? 0 : currentSession.commitDebounceMs;
    commitTimerRef.current = window.setTimeout(() => {
      void commitPendingChange().catch((error) => {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        setLoadError(normalizedError);
        onPluginErrorRef.current?.(normalizedError);
      });
    }, commitDelayMs);
  }, [clearCommitTimer, commitPendingChange]);

  const closeMountedSession = useCallback(async () => {
    clearCommitTimer();
    const currentSession = mountedSessionRef.current;
    mountedSessionRef.current = null;

    if (!currentSession) {
      return;
    }

    currentSession.cleanupTasks.forEach((cleanup) => cleanup());
    await getChipsClient().card.basecard.closeSession(currentSession.sessionId).catch(() => ({ closed: false }));
  }, [clearCommitTimer]);

  const mountEditorSession = useCallback(async () => {
    const container = containerRef.current;
    if (!container) {
      const error = new Error('Editor panel container is unavailable.');
      setLoadError(error);
      onPluginErrorRef.current?.(error);
      return;
    }

    await closeMountedSession();

    setIsLoading(true);
    setLoadError(null);

    const session = await getChipsClient().card.basecard.openSession({
      cardType,
      baseCardId,
      sourceConfig,
      cardRootDir: cardPath,
    });

    const frameResult = await getChipsClient().card.basecard.renderEditor({
      sessionId: session.sessionId,
      resources: {
        resolveResourceUrl,
        releaseResourceUrl(resourcePath) {
          const normalizedResourcePath = normalizeResourcePath(resourcePath);
          if (!normalizedResourcePath) {
            return;
          }
          releaseResolvedResourceUrl(normalizedResourcePath);
        },
        importResource,
        deleteResource,
      },
    });

    const frame = frameResult.frame;
    frame.className = 'plugin-host__frame';
    frame.scrolling = 'no';
    frame.style.border = '0';

    const cleanupTasks: Array<() => void> = [];

    cleanupTasks.push(
      getChipsClient().card.basecard.onReady(frame, () => {
        setIsLoading(false);
        setLoadError(null);
        onPluginLoadedRef.current?.({
          cardType: session.cardType,
          baseCardId: session.baseCardId,
          pluginId: session.pluginId,
        });
      }),
    );
    cleanupTasks.push(
      getChipsClient().card.basecard.onHeight(frame, () => {
        frame.style.height = '100%';
      }),
    );
    cleanupTasks.push(
      getChipsClient().card.basecard.onChange(frame, (payload: BasecardChangePayload) => {
        latestCommitStateRef.current = {
          config: payload.normalizedConfig,
          referencedResources: payload.referencedResources,
          validation: payload.validation,
        };
        reportEditorActivity();
        scheduleCommit();
      }),
    );
    cleanupTasks.push(
      getChipsClient().card.basecard.onError(frame, (payload: BasecardErrorPayload) => {
        const normalizedError = new Error(payload.message);
        setLoadError(normalizedError);
        setIsLoading(false);
        onPluginErrorRef.current?.(normalizedError);
      }),
    );

    container.replaceChildren(frame);
    frameRef.current = frame;
    latestCommitStateRef.current = {
      config: session.normalizedConfig,
      referencedResources: session.referencedResources,
      validation: session.validation,
    };
    mountedSessionRef.current = {
      sessionId: session.sessionId,
      pluginId: session.pluginId,
      cardType: session.cardType,
      baseCardId: session.baseCardId,
      commitDebounceMs: session.commitDebounceMs,
      lastSeenPropSignature: sourceSignature,
      authoritativeSignature: JSON.stringify(session.normalizedConfig),
      cleanupTasks,
    };
  }, [
    baseCardId,
    cardPath,
    cardType,
    closeMountedSession,
    deleteResource,
    importResource,
    releaseResolvedResourceUrl,
    reportEditorActivity,
    resolveResourceUrl,
    scheduleCommit,
    sourceConfig,
    sourceSignature,
  ]);

  mountEditorSessionRef.current = mountEditorSession;

  useEffect(() => {
    let disposed = false;
    const openEditorSession = mountEditorSessionRef.current;

    if (!openEditorSession) {
      return;
    }

    void openEditorSession().catch((error) => {
      if (disposed) {
        return;
      }

      const normalizedError = error instanceof Error ? error : new Error(String(error));
      setLoadError(normalizedError);
      setIsLoading(false);
      onPluginErrorRef.current?.(normalizedError);
    });

    return () => {
      disposed = true;
      void commitPendingChange().catch(() => undefined);
      void closeMountedSession().catch(() => undefined);
      releaseAllResolvedResourceUrls();
      latestCommitStateRef.current = null;
      pendingImportsRef.current.clear();
      pendingDeletionsRef.current.clear();
      const container = containerRef.current;
      if (container) {
        container.replaceChildren();
      }
      frameRef.current = null;
    };
  }, [closeMountedSession, commitPendingChange, releaseAllResolvedResourceUrls, renderRevision, sessionIdentity]);

  useEffect(() => {
    const mountedSession = mountedSessionRef.current;
    if (!mountedSession) {
      return;
    }

    if (
      sourceSignature === mountedSession.lastSeenPropSignature ||
      sourceSignature === mountedSession.authoritativeSignature
    ) {
      return;
    }

    void mountEditorSession().catch((error) => {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      setLoadError(normalizedError);
      setIsLoading(false);
      onPluginErrorRef.current?.(normalizedError);
    });
  }, [mountEditorSession, sourceSignature]);

  useEffect(() => {
    const flushPendingChange = () => {
      void commitPendingChange().catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingChange();
      }
    };

    window.addEventListener('pagehide', flushPendingChange);
    window.addEventListener('beforeunload', flushPendingChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushPendingChange);
      window.removeEventListener('beforeunload', flushPendingChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [commitPendingChange]);

  const errorText = loadError?.message || t('plugin_host.error') || '加载失败';

  return (
    <div className="plugin-host">
      <div ref={containerRef} className="plugin-host__container" />

      {isLoading && (
        <div className="plugin-host__loading">
          <div className="plugin-host__spinner"></div>
          <span className="plugin-host__loading-text">{t('plugin_host.loading') || '加载中...'}</span>
        </div>
      )}

      {!isLoading && loadError && (
        <div className="plugin-host__error">
          <div className="plugin-host__error-icon">⚠️</div>
          <p className="plugin-host__error-text">{errorText}</p>
          <button
            type="button"
            className="plugin-host__retry-btn"
            onClick={() => setRenderRevision((current) => current + 1)}
          >
            {t('plugin_host.retry') || '重试'}
          </button>
        </div>
      )}
    </div>
  );
}
