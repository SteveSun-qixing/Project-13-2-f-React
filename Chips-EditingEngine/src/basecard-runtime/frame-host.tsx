import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CompositeInteractionPayload } from 'chips-sdk';
import type { BasecardOpenResourceInput, BasecardPendingResourceImport } from './contracts';
import {
  getBasecardDescriptor,
  getBasecardRegistryVersion,
  normalizeBasecardConfig,
  subscribeBasecardRegistry,
} from './registry';
import { createBasecardFrameThemeCss } from './theme-css';

export interface BasecardFrameStatus {
  state: 'loading' | 'ready' | 'error';
  height: number;
  errorMessage: string | null;
}

export interface BasecardFrameHostProps {
  baseCardId: string;
  cardType: string;
  config: Record<string, unknown>;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  pendingResourceImports?: Map<string, BasecardPendingResourceImport>;
  selectable?: boolean;
  themeCacheKey?: string;
  interactionPolicy: 'delegate' | 'native';
  onSelect?: () => void;
  onStatusChange?: (status: BasecardFrameStatus) => void;
  onInteraction?: (payload: CompositeInteractionPayload, frame: HTMLIFrameElement) => void;
  onResourceOpen?: (input: BasecardOpenResourceInput) => void;
}

const DEFAULT_STATUS: BasecardFrameStatus = {
  state: 'loading',
  height: 96,
  errorMessage: null,
};

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

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function normalizeOpenResourceInput(input: BasecardOpenResourceInput): BasecardOpenResourceInput | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const rawResourceId = normalizeOptionalString(input.resourceId);
  if (!rawResourceId) {
    return null;
  }

  const payload = normalizeOptionalRecord(input.payload);
  return {
    resourceId: rawResourceId,
    ...(normalizeOptionalString(input.mimeType) ? { mimeType: normalizeOptionalString(input.mimeType) } : undefined),
    ...(normalizeOptionalString(input.title) ? { title: normalizeOptionalString(input.title) } : undefined),
    ...(normalizeOptionalString(input.fileName) ? { fileName: normalizeOptionalString(input.fileName) } : undefined),
    ...(payload ? { payload } : undefined),
  };
}

function createFrameDocumentHtml(): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<style>',
    'html, body {',
    '  margin: 0;',
    '  padding: 0;',
    '  width: 100%;',
    '  min-height: 100%;',
    '  background: transparent !important;',
    '}',
    'body {',
    '  overflow: hidden;',
    '}',
    '</style>',
    '</head>',
    '<body></body>',
    '</html>',
  ].join('');
}

function measureFrameHeight(frame: HTMLIFrameElement): number {
  const doc = frame.contentDocument;
  if (!doc) {
    return DEFAULT_STATUS.height;
  }

  const contentRoot = doc.querySelector('[data-chips-basecard-frame-root="true"]') as HTMLElement | null;
  if (contentRoot) {
    return Math.max(
      1,
      Math.ceil(
        Math.max(
          contentRoot.scrollHeight ?? 0,
          contentRoot.offsetHeight ?? 0,
          contentRoot.getBoundingClientRect?.().height ?? 0,
        ),
      ),
    );
  }

  const body = doc.body;
  const root = doc.documentElement;
  return Math.max(
    1,
    Math.ceil(
      Math.max(
        body?.scrollHeight ?? 0,
        root?.scrollHeight ?? 0,
      ),
    ),
  );
}

export function BasecardFrameHost({
  baseCardId,
  cardType,
  config,
  resolveResourceUrl: resolvePersistedResourceUrl,
  pendingResourceImports,
  selectable = false,
  themeCacheKey,
  interactionPolicy,
  onSelect,
  onStatusChange,
  onInteraction,
  onResourceOpen,
}: BasecardFrameHostProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const selectableRef = useRef(selectable);
  const onSelectRef = useRef(onSelect);
  const onInteractionRef = useRef(onInteraction);
  const onResourceOpenRef = useRef(onResourceOpen);
  const interactionPolicyRef = useRef(interactionPolicy);
  const pendingResourceImportsRef = useRef(pendingResourceImports);
  const resolvedResourceUrlsRef = useRef(new Map<string, {
    url: string;
    cacheKey: string;
    kind: 'pending' | 'persisted';
  }>());
  const [status, setStatus] = useState<BasecardFrameStatus>(DEFAULT_STATUS);
  const [registryVersion, setRegistryVersion] = useState(() => getBasecardRegistryVersion());

  const descriptor = useMemo(() => getBasecardDescriptor(cardType), [cardType, registryVersion]);
  const normalizedConfig = useMemo(
    () => normalizeBasecardConfig(cardType, baseCardId, config),
    [baseCardId, cardType, config, registryVersion],
  );
  const selectionShieldEnabled = selectable && descriptor?.previewPointerEvents === 'shielded';
  const configSignature = useMemo(() => JSON.stringify(normalizedConfig), [normalizedConfig]);
  const readyMinHeightStyle = useMemo(
    () => ({ minHeight: status.state === 'ready' ? '0px' : `${DEFAULT_STATUS.height}px` }),
    [status.state],
  );

  useEffect(() => {
    return subscribeBasecardRegistry(() => {
      setRegistryVersion(getBasecardRegistryVersion());
    });
  }, []);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    selectableRef.current = selectable;
  }, [selectable]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onInteractionRef.current = onInteraction;
  }, [onInteraction]);

  useEffect(() => {
    onResourceOpenRef.current = onResourceOpen;
  }, [onResourceOpen]);

  useEffect(() => {
    interactionPolicyRef.current = interactionPolicy;
  }, [interactionPolicy]);

  useEffect(() => {
    pendingResourceImportsRef.current = pendingResourceImports;
  }, [pendingResourceImports]);

  useEffect(() => {
    return () => {
      resolvedResourceUrlsRef.current.forEach((resource) => {
        if (resource.kind === 'pending') {
          URL.revokeObjectURL(resource.url);
        }
      });
      resolvedResourceUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const frame = iframeRef.current;
    const wrapper = wrapperRef.current;
    if (!frame || !wrapper) {
      return;
    }

    frame.style.background = 'transparent';
    frame.style.backgroundColor = 'transparent';
    frame.setAttribute('allowtransparency', 'true');

    if (!descriptor) {
      setStatus({
        state: 'error',
        height: DEFAULT_STATUS.height,
        errorMessage: `未注册基础卡片类型: ${cardType}`,
      });
      return;
    }

    let disposed = false;
    let frameMounted = false;
    let renderCleanup: (() => void) | void;
    const cleanupTasks: Array<() => void> = [];
    const resolveResourceUrl = async (resourcePath: string): Promise<string> => {
      const normalizedResourcePath = normalizeResourcePath(resourcePath);
      if (!normalizedResourcePath) {
        throw new Error(`资源路径无效: ${resourcePath}`);
      }

      const pendingImport = pendingResourceImportsRef.current?.get(normalizedResourcePath);
      if (pendingImport) {
        const cacheKey = getPendingResourceCacheKey(pendingImport);
        const cachedUrl = resolvedResourceUrlsRef.current.get(normalizedResourcePath);
        if (cachedUrl?.kind === 'pending' && cachedUrl.cacheKey === cacheKey) {
          return cachedUrl.url;
        }

        if (cachedUrl?.kind === 'pending') {
          URL.revokeObjectURL(cachedUrl.url);
        }

        const nextUrl = createObjectUrl(pendingImport);
        resolvedResourceUrlsRef.current.set(normalizedResourcePath, {
          url: nextUrl,
          cacheKey,
          kind: 'pending',
        });
        return nextUrl;
      }

      const cachedUrl = resolvedResourceUrlsRef.current.get(normalizedResourcePath);
      if (cachedUrl?.kind === 'persisted') {
        return cachedUrl.url;
      }

      if (!resolvePersistedResourceUrl) {
        throw new Error(`基础卡片资源解析器未配置: ${normalizedResourcePath}`);
      }

      if (cachedUrl?.kind === 'pending') {
        URL.revokeObjectURL(cachedUrl.url);
      }

      const nextUrl = await resolvePersistedResourceUrl(normalizedResourcePath);
      resolvedResourceUrlsRef.current.set(normalizedResourcePath, {
        url: nextUrl,
        cacheKey: normalizedResourcePath,
        kind: 'persisted',
      });
      return nextUrl;
    };
    const releaseResourceUrl = (resourcePath: string): void => {
      const normalizedResourcePath = normalizeResourcePath(resourcePath);
      if (!normalizedResourcePath) {
        return;
      }

      const currentUrl = resolvedResourceUrlsRef.current.get(normalizedResourcePath);
      if (!currentUrl) {
        return;
      }

      if (currentUrl.kind === 'pending') {
        URL.revokeObjectURL(currentUrl.url);
      }
      resolvedResourceUrlsRef.current.delete(normalizedResourcePath);
    };
    const openResource = (input: BasecardOpenResourceInput): void => {
      const normalizedInput = normalizeOpenResourceInput(input);
      if (!normalizedInput) {
        return;
      }

      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(normalizedInput.resourceId)) {
        onResourceOpenRef.current?.(normalizedInput);
        return;
      }

      void resolveResourceUrl(normalizedInput.resourceId)
        .then((resourceId) => {
          onResourceOpenRef.current?.({
            ...normalizedInput,
            resourceId,
          });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[BasecardFrameHost] Failed to resolve resource open intent.', {
            baseCardId,
            cardType,
            resourceId: normalizedInput.resourceId,
            error,
          });
          setStatus((current) => ({
            state: 'error',
            height: current.height > 0 ? current.height : DEFAULT_STATUS.height,
            errorMessage: `资源解析失败: ${message}`,
          }));
        });
    };
    setStatus((current) => {
      if (current.state === 'ready') {
        return {
          state: 'ready',
          height: current.height,
          errorMessage: null,
        };
      }

      return {
        state: 'loading',
        height: current.height > 0 ? current.height : DEFAULT_STATUS.height,
        errorMessage: null,
      };
    });

    const mountFrame = () => {
      const doc = frame.contentDocument;
      const frameWindow = frame.contentWindow;
      if (!doc || !frameWindow) {
        throw new Error('基础卡片渲染窗口未就绪。');
      }

      const container = doc.createElement('div');
      container.setAttribute('data-chips-basecard-frame-root', 'true');

      while (doc.body.firstChild) {
        doc.body.removeChild(doc.body.firstChild);
      }

      doc.body.appendChild(container);
      renderCleanup = descriptor.renderView({
        container,
        config: normalizedConfig,
        themeCssText: createBasecardFrameThemeCss(wrapper),
        resolveResourceUrl,
        releaseResourceUrl,
        openResource,
      });

      const applyMeasuredHeight = () => {
        if (disposed) {
          return;
        }

        const nextHeight = measureFrameHeight(frame);
        frame.style.height = `${nextHeight}px`;
        setStatus((current) => {
          if (
            current.state === 'ready' &&
            current.height === nextHeight &&
            current.errorMessage === null
          ) {
            return current;
          }

          return {
            state: 'ready',
            height: nextHeight,
            errorMessage: null,
          };
        });
      };

      const ResizeObserverCtor = (
        frameWindow as Window & { ResizeObserver?: typeof ResizeObserver }
      ).ResizeObserver ?? window.ResizeObserver;
      if (ResizeObserverCtor) {
        const resizeObserver = new ResizeObserverCtor(() => {
          applyMeasuredHeight();
        });
        resizeObserver.observe(doc.body);
        resizeObserver.observe(doc.documentElement);
        cleanupTasks.push(() => {
          resizeObserver.disconnect();
        });
      }

      const selectBasecard = () => {
        if (!selectableRef.current) {
          return;
        }
        onSelectRef.current?.();
      };

      doc.addEventListener('pointerdown', selectBasecard);
      cleanupTasks.push(() => {
        doc.removeEventListener('pointerdown', selectBasecard);
      });

      const handleWheel = (event: WheelEvent) => {
        if (interactionPolicyRef.current !== 'delegate' || !onInteractionRef.current) {
          return;
        }

        event.preventDefault();
        onInteractionRef.current(
          {
            cardId: baseCardId,
            source: 'basecard-frame',
            device: 'wheel',
            intent: event.ctrlKey || event.metaKey ? 'zoom' : 'scroll',
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            zoomDelta: event.ctrlKey || event.metaKey ? Number(event.deltaY) * -0.0025 : 0,
            clientX: event.clientX,
            clientY: event.clientY,
            pointerCount: event.ctrlKey || event.metaKey ? 2 : 1,
          },
          frame,
        );
      };

      doc.addEventListener('wheel', handleWheel, { passive: false });
      cleanupTasks.push(() => {
        doc.removeEventListener('wheel', handleWheel);
      });

      applyMeasuredHeight();
      if (typeof frameWindow.requestAnimationFrame === 'function') {
        frameWindow.requestAnimationFrame(() => {
          applyMeasuredHeight();
        });
      }
    };

    const handleFrameLoad = () => {
      if (disposed || frameMounted) {
        return;
      }

      try {
        frameMounted = true;
        mountFrame();
      } catch (error) {
        frameMounted = false;
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        setStatus({
          state: 'error',
          height: DEFAULT_STATUS.height,
          errorMessage: normalizedError.message,
        });
      }
    };

    frame.addEventListener('load', handleFrameLoad);
    cleanupTasks.push(() => {
      frame.removeEventListener('load', handleFrameLoad);
    });

    frame.srcdoc = createFrameDocumentHtml();

    return () => {
      disposed = true;
      cleanupTasks.forEach((cleanup) => cleanup());
      resolvedResourceUrlsRef.current.forEach((resource) => {
        if (resource.kind === 'pending') {
          URL.revokeObjectURL(resource.url);
        }
      });
      resolvedResourceUrlsRef.current.clear();
      if (typeof renderCleanup === 'function') {
        renderCleanup();
      }
    };
  }, [
    baseCardId,
    cardType,
    configSignature,
    descriptor,
    normalizedConfig,
    resolvePersistedResourceUrl,
    themeCacheKey,
  ]);

  return (
    <div
      ref={wrapperRef}
      className="basecard-frame-host"
      style={readyMinHeightStyle}
    >
      <iframe
        ref={iframeRef}
        className="basecard-frame-host__frame"
        title={`basecard-${baseCardId}`}
        scrolling="no"
        style={readyMinHeightStyle}
      />

      {selectionShieldEnabled && (
        <div
          className="basecard-frame-host__selection-shield"
          aria-hidden="true"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelectRef.current?.();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        />
      )}

      {status.state === 'loading' && (
        <div className="basecard-frame-host__overlay" data-state="loading">
          <span className="basecard-frame-host__overlay-text">加载基础卡片中…</span>
        </div>
      )}

      {status.state === 'error' && status.errorMessage && (
        <div className="basecard-frame-host__overlay" data-state="error">
          <span className="basecard-frame-host__overlay-text">{status.errorMessage}</span>
        </div>
      )}
    </div>
  );
}
