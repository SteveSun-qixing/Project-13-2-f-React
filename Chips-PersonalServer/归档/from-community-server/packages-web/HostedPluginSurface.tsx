import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Result, Spin } from 'antd';
import {
  ArrowLeftOutlined,
  ContainerOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  PictureOutlined,
  StarOutlined,
} from '@ant-design/icons';
import {
  buildHostedPluginEntryUrl,
  buildHostedPluginRoute,
  closeWebPluginSession,
  createWebPluginSession,
  getWebPluginSession,
  resolveWebResourceOpenPlan,
  type HostResourceOpenRequest,
  type HostSurfaceOpenRequest,
  type WebPluginSessionView,
} from '../lib/host-runtime';
import './HostedPluginSurface.css';

interface HostedPluginSurfaceProps {
  sessionId: string;
  initialSession?: WebPluginSessionView | null;
  autoDispose?: boolean;
  surfaceMode?: 'immersive' | 'document';
}

interface HostBridgeRequestMessage {
  type: 'chips.web-shell:invoke';
  sessionId: string;
  requestId: string;
  action: string;
  payload: unknown;
}

interface HostBridgeEmitMessage {
  type: 'chips.web-shell:emit';
  sessionId: string;
  event: string;
  payload: unknown;
}

type WebSurfaceNavigationKind = NonNullable<HostSurfaceOpenRequest['kind']>;
type PendingTabHandle = Window | null;

type DocumentSurfaceResizeReason =
  | 'initial'
  | 'content-resize'
  | 'asset-load'
  | 'font-load'
  | 'viewport-resize';

interface DocumentSurfaceResizePayload {
  height: number;
  contentHeight: number;
  safeBlockEnd: number;
  viewportHeight: number;
  reason: DocumentSurfaceResizeReason;
  stable: boolean;
}

interface PluginChromeAction {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

interface PluginChromeState {
  title?: string;
  metaLines: string[];
  back: {
    label: string;
    enabled: boolean;
    handledByPlugin?: boolean;
  };
  actions: PluginChromeAction[];
  safeBlockStart: number;
}

const DOCUMENT_SURFACE_INITIAL_HEIGHT = 960;
const DOCUMENT_SURFACE_MIN_HEIGHT = 320;
const PLUGIN_CHROME_SAFE_BLOCK_START = 96;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeResourceOpenRequest(payload: unknown): HostResourceOpenRequest | null {
  if (!isRecord(payload) || !isRecord(payload.resource)) {
    return null;
  }

  const resourceId = typeof payload.resource.resourceId === 'string' ? payload.resource.resourceId.trim() : '';
  if (!resourceId) {
    return null;
  }

  return {
    ...(typeof payload.intent === 'string' && payload.intent.trim() ? { intent: payload.intent.trim() } : undefined),
    resource: {
      resourceId,
      ...(typeof payload.resource.mimeType === 'string' && payload.resource.mimeType.trim()
        ? { mimeType: payload.resource.mimeType.trim() }
        : undefined),
      ...(typeof payload.resource.title === 'string' && payload.resource.title.trim()
        ? { title: payload.resource.title.trim() }
        : undefined),
      ...(typeof payload.resource.fileName === 'string' && payload.resource.fileName.trim()
        ? { fileName: payload.resource.fileName.trim() }
        : undefined),
      ...(isRecord(payload.resource.payload) ? { payload: payload.resource.payload } : undefined),
    },
  };
}

function normalizeSurfaceOpenRequest(payload: unknown): HostSurfaceOpenRequest | null {
  if (!isRecord(payload) || !isRecord(payload.request) || !isRecord(payload.request.target)) {
    return null;
  }

  const request = payload.request;
  const target = request.target as Record<string, unknown>;
  if (target.type === 'plugin' && typeof target.pluginId === 'string' && target.pluginId.trim()) {
    return {
      ...(typeof request.kind === 'string' ? { kind: request.kind as HostSurfaceOpenRequest['kind'] } : undefined),
      target: {
        type: 'plugin',
        pluginId: target.pluginId.trim(),
        ...(isRecord(target.launchParams) ? { launchParams: target.launchParams } : undefined),
      },
      ...(isRecord(request.presentation) ? { presentation: request.presentation } : undefined),
    };
  }

  if (target.type === 'url' && typeof target.url === 'string' && target.url.trim()) {
    return {
      ...(typeof request.kind === 'string' ? { kind: request.kind as HostSurfaceOpenRequest['kind'] } : undefined),
      target: {
        type: 'url',
        url: target.url.trim(),
      },
      ...(isRecord(request.presentation) ? { presentation: request.presentation } : undefined),
    };
  }

  return null;
}

function supportsNewTab(kind: WebSurfaceNavigationKind): boolean {
  return kind === 'route' || kind === 'tab' || kind === 'window';
}

function createPendingTab(kind: WebSurfaceNavigationKind): PendingTabHandle {
  if (!supportsNewTab(kind)) {
    return null;
  }

  const pending = window.open('about:blank', '_blank');
  if (!pending) {
    return null;
  }

  try {
    pending.document.title = 'Chips';
    pending.document.body.style.margin = '0';
    pending.document.body.style.background = '#ffffff';
  } catch {
    // 浏览器可能对预打开标签页的文档访问做限制，此时只保留窗口句柄即可。
  }

  return pending;
}

function focusOpenedTab(opened: PendingTabHandle): void {
  if (!opened || opened.closed) {
    return;
  }

  try {
    opened.focus();
  } catch {
    // 部分浏览器环境可能拒绝脚本聚焦新标签页；导航回退逻辑仍会继续兜底。
  }
}

function navigatePendingTab(pending: PendingTabHandle, url: string): boolean {
  if (!pending || pending.closed) {
    return false;
  }

  try {
    pending.location.replace(url);
    focusOpenedTab(pending);
    return true;
  } catch {
    return false;
  }
}

function closePendingTab(pending: PendingTabHandle): void {
  if (!pending || pending.closed) {
    return;
  }

  try {
    pending.close();
  } catch {
    // 某些浏览器环境可能拒绝脚本关闭预打开标签页，此时忽略即可。
  }
}

function openHostedRoute(
  url: string,
  kind: WebSurfaceNavigationKind = 'route',
  options?: {
    pendingTab?: PendingTabHandle;
    fallbackToCurrentPage?: boolean;
    preferCurrentPage?: boolean;
  },
): void {
  if (options?.preferCurrentPage) {
    window.location.assign(url);
    return;
  }

  if (navigatePendingTab(options?.pendingTab ?? null, url)) {
    return;
  }

  if (supportsNewTab(kind)) {
    const popup = window.open(url, '_blank');
    if (popup) {
      focusOpenedTab(popup);
      return;
    }
  }

  if (options?.fallbackToCurrentPage !== false) {
    window.location.assign(url);
  }
}

function openExternalUrl(
  url: string,
  _kind: WebSurfaceNavigationKind = 'tab',
  options?: {
    pendingTab?: PendingTabHandle;
    fallbackToCurrentPage?: boolean;
    preferCurrentPage?: boolean;
  },
): void {
  if (options?.preferCurrentPage) {
    window.location.assign(url);
    return;
  }

  if (navigatePendingTab(options?.pendingTab ?? null, url)) {
    return;
  }

  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (popup) {
    focusOpenedTab(popup);
    return;
  }

  if (options?.fallbackToCurrentPage !== false) {
    window.location.assign(url);
  }
}

function normalizeDocumentSurfaceReason(value: unknown): DocumentSurfaceResizeReason {
  if (
    value === 'initial'
    || value === 'content-resize'
    || value === 'asset-load'
    || value === 'font-load'
    || value === 'viewport-resize'
  ) {
    return value;
  }

  return 'content-resize';
}

function normalizeDocumentSurfaceResizePayload(payload: unknown): DocumentSurfaceResizePayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const height = Number(payload.height);
  if (!Number.isFinite(height)) {
    return null;
  }

  const normalizedHeight = Math.max(DOCUMENT_SURFACE_MIN_HEIGHT, Math.ceil(height));
  const contentHeight = Number(payload.contentHeight);
  const safeBlockEnd = Number(payload.safeBlockEnd);
  const viewportHeight = Number(payload.viewportHeight);
  const fallbackViewportHeight = Number.isFinite(window.innerHeight) ? Math.ceil(window.innerHeight) : 0;

  return {
    height: normalizedHeight,
    contentHeight: Number.isFinite(contentHeight)
      ? Math.max(DOCUMENT_SURFACE_MIN_HEIGHT, Math.ceil(contentHeight))
      : normalizedHeight,
    safeBlockEnd: Number.isFinite(safeBlockEnd) ? Math.max(0, Math.ceil(safeBlockEnd)) : 0,
    viewportHeight: Number.isFinite(viewportHeight) ? Math.max(0, Math.ceil(viewportHeight)) : fallbackViewportHeight,
    reason: normalizeDocumentSurfaceReason(payload.reason),
    stable: payload.stable === true,
  };
}

function normalizePluginChromeState(payload: unknown): PluginChromeState | null {
  if (!isRecord(payload)) {
    return null;
  }

  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : undefined;
  const metaLines = Array.isArray(payload.metaLines)
    ? payload.metaLines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
    : [];
  const backRecord = isRecord(payload.back) ? payload.back : {};
  const actions = Array.isArray(payload.actions)
    ? payload.actions
        .filter((action): action is Record<string, unknown> => isRecord(action))
        .map((action) => ({
          id: typeof action.id === 'string' ? action.id.trim() : '',
          label: typeof action.label === 'string' ? action.label.trim() : '',
          icon: typeof action.icon === 'string' ? action.icon.trim() : undefined,
          disabled: action.disabled === true,
        }))
        .filter((action) => action.id && action.label)
    : [];
  const safeBlockStart = Number(payload.safeBlockStart);

  return {
    title,
    metaLines,
    back: {
      label:
        typeof backRecord.label === 'string' && backRecord.label.trim()
          ? backRecord.label.trim()
          : 'Back',
      enabled: backRecord.enabled !== false,
      handledByPlugin: backRecord.handledByPlugin === true,
    },
    actions,
    safeBlockStart: Number.isFinite(safeBlockStart) ? Math.max(0, Math.ceil(safeBlockStart)) : PLUGIN_CHROME_SAFE_BLOCK_START,
  };
}

function ChromeActionIcon({ icon }: { icon?: string }) {
  switch (icon) {
    case 'cover':
      return <PictureOutlined style={{ fontSize: 20 }} />;
    case 'document':
      return <FileTextOutlined style={{ fontSize: 20 }} />;
    case 'card':
      return <CreditCardOutlined style={{ fontSize: 20 }} />;
    case 'box':
      return <ContainerOutlined style={{ fontSize: 20 }} />;
    case 'sparkles':
      return <StarOutlined style={{ fontSize: 20 }} />;
    default:
      return <span aria-hidden="true" className="hosted-plugin-surface__chrome-action-dot" />;
  }
}

export function HostedPluginSurface({
  sessionId,
  initialSession = null,
  autoDispose = true,
  surfaceMode = 'immersive',
}: HostedPluginSurfaceProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const embeddedHeightRef = useRef<number | null>(surfaceMode === 'document' ? DOCUMENT_SURFACE_INITIAL_HEIGHT : null);
  const [session, setSession] = useState<WebPluginSessionView | null>(initialSession);
  const [loading, setLoading] = useState(initialSession === null);
  const [error, setError] = useState('');
  const [chromeState, setChromeState] = useState<PluginChromeState | null>(null);
  const [embeddedHeight, setEmbeddedHeight] = useState<number | null>(
    surfaceMode === 'document' ? DOCUMENT_SURFACE_INITIAL_HEIGHT : null,
  );

  const frameUrl = useMemo(() => buildHostedPluginEntryUrl(sessionId), [sessionId]);

  useEffect(() => {
    const nextHeight = surfaceMode === 'document' ? DOCUMENT_SURFACE_INITIAL_HEIGHT : null;
    embeddedHeightRef.current = nextHeight;
    setEmbeddedHeight(nextHeight);
    setChromeState(null);
  }, [sessionId, surfaceMode]);

  useEffect(() => {
    let cancelled = false;

    if (initialSession && initialSession.sessionId === sessionId) {
      setSession(initialSession);
      setLoading(false);
      setError('');
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError('');
    void getWebPluginSession(sessionId)
      .then((nextSession) => {
        if (!cancelled) {
          setSession(nextSession);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : '出现了一点问题');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialSession, sessionId]);

  useEffect(() => {
    if (!autoDispose || import.meta.env.DEV) {
      return;
    }

    return () => {
      void closeWebPluginSession(sessionId).catch(() => undefined);
    };
  }, [autoDispose, sessionId]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow || event.origin !== window.location.origin) {
        return;
      }

      const data = event.data;
      if (!isRecord(data) || data.sessionId !== sessionId || typeof data.type !== 'string') {
        return;
      }

      const respond = (response: { requestId?: string; result?: unknown; error?: { message: string; code?: string } }) => {
        frameWindow.postMessage(
          {
            type: 'chips.web-shell:result',
            sessionId,
            ...response,
          },
          window.location.origin,
        );
      };

      if (data.type === 'chips.web-shell:emit') {
        const emitMessage = data as unknown as HostBridgeEmitMessage;
        if (emitMessage.event === 'plugin.chrome.update') {
          const nextChromeState = normalizePluginChromeState(emitMessage.payload);
          if (nextChromeState) {
            setChromeState(nextChromeState);
          }
          return;
        }

        if (surfaceMode === 'document' && emitMessage.event === 'plugin.surface.resize') {
          const resizePayload = normalizeDocumentSurfaceResizePayload(emitMessage.payload);
          if (resizePayload) {
            embeddedHeightRef.current = resizePayload.height;
            setEmbeddedHeight(resizePayload.height);
          }
        }
        return;
      }

      if (data.type !== 'chips.web-shell:invoke' || typeof data.requestId !== 'string' || typeof data.action !== 'string') {
        return;
      }

      const request = data as unknown as HostBridgeRequestMessage;
      let pendingTab: PendingTabHandle = null;

      try {
        if (request.action === 'resource.open') {
          const normalizedRequest = normalizeResourceOpenRequest(request.payload);
          if (!normalizedRequest) {
            throw new Error('Invalid resource.open payload');
          }

          pendingTab = createPendingTab('tab');
          const plan = await resolveWebResourceOpenPlan(normalizedRequest);
          if (plan.mode === 'plugin' && plan.pluginId) {
            const nextSession = await createWebPluginSession({
              pluginId: plan.pluginId,
              launchParams: {
                trigger: 'resource-open-service',
                resourceOpen: {
                  intent: normalizedRequest.intent ?? 'view',
                  resourceId: plan.resolved.resourceId,
                  mimeType: plan.resolved.mimeType,
                  extension: plan.resolved.extension,
                  fileName: plan.resolved.fileName,
                  title: normalizedRequest.resource.title,
                  matchedCapability: plan.matchedCapability,
                  ...(normalizedRequest.resource.payload ? { payload: normalizedRequest.resource.payload } : undefined),
                },
              },
            });
            const route = buildHostedPluginRoute(nextSession.sessionId);
            openHostedRoute(route, 'tab', {
              pendingTab,
            });
            respond({
              requestId: request.requestId,
              result: {
                result: {
                  mode: 'plugin',
                  pluginId: plan.pluginId,
                  windowId: nextSession.sessionId,
                  matchedCapability: plan.matchedCapability,
                  resolved: plan.resolved,
                },
              },
            });
            return;
          }

          openExternalUrl(plan.resolved.resourceId, 'tab', {
            pendingTab,
          });
          respond({
            requestId: request.requestId,
            result: {
              result: {
                mode: 'external',
                resolved: plan.resolved,
              },
            },
          });
          return;
        }

        if (request.action === 'surface.open') {
          const normalizedRequest = normalizeSurfaceOpenRequest(request.payload);
          if (!normalizedRequest) {
            throw new Error('Invalid surface.open payload');
          }

          const requestedKind = normalizedRequest.kind ?? 'route';
          pendingTab = createPendingTab(requestedKind);

          if (normalizedRequest.target.type === 'url') {
            openExternalUrl(normalizedRequest.target.url, requestedKind, {
              pendingTab,
            });
            respond({
              requestId: request.requestId,
              result: {
                surface: {
                  id: `web-url:${Date.now()}`,
                  kind: requestedKind,
                  title: normalizedRequest.presentation?.title,
                  focused: false,
                  state: 'normal',
                  url: normalizedRequest.target.url,
                  metadata: {
                    requestedKind: requestedKind,
                  },
                },
              },
            });
            return;
          }

          const nextSession = await createWebPluginSession({
            pluginId: normalizedRequest.target.pluginId,
            launchParams: normalizedRequest.target.launchParams,
          });
          const route = buildHostedPluginRoute(nextSession.sessionId);
          openHostedRoute(route, requestedKind, {
            pendingTab,
          });
          respond({
            requestId: request.requestId,
            result: {
              surface: {
                id: nextSession.sessionId,
                kind: requestedKind,
                title: normalizedRequest.presentation?.title ?? nextSession.title,
                focused: false,
                state: 'normal',
                url: route,
                pluginId: nextSession.pluginId,
                sessionId: nextSession.sessionId,
                metadata: {
                  requestedKind: requestedKind,
                },
              },
            },
          });
          return;
        }

        if (request.action === 'plugin.launch') {
          const payload = isRecord(request.payload) ? request.payload : {};
          const pluginId = typeof payload.pluginId === 'string' ? payload.pluginId.trim() : '';
          if (!pluginId) {
            throw new Error('pluginId is required');
          }

          pendingTab = createPendingTab('tab');
          const nextSession = await createWebPluginSession({
            pluginId,
            launchParams: isRecord(payload.launchParams) ? payload.launchParams : {},
          });
          const route = buildHostedPluginRoute(nextSession.sessionId);
          openHostedRoute(route, 'tab', {
            pendingTab,
          });
          respond({
            requestId: request.requestId,
            result: {
              window: {
                id: nextSession.sessionId,
              },
              session: {
                sessionId: nextSession.sessionId,
                sessionNonce: 'web-shell',
                permissions: nextSession.permissions,
              },
            },
          });
          return;
        }

        if (
          request.action === 'transfer.openExternal'
          || request.action === 'platform.openExternal'
          || request.action === 'platform.shellOpenExternal'
        ) {
          const payload = isRecord(request.payload) ? request.payload : {};
          const url = typeof payload.url === 'string' ? payload.url.trim() : '';
          if (!url) {
            throw new Error('url is required');
          }

          pendingTab = createPendingTab('tab');
          openExternalUrl(url, 'tab', {
            pendingTab,
          });
          respond({
            requestId: request.requestId,
            result: {
              ack: true,
            },
          });
          return;
        }

        throw new Error(`Unsupported web-shell action: ${request.action}`);
      } catch (dispatchError) {
        closePendingTab(pendingTab);
        respond({
          requestId: request.requestId,
          error: {
            message: dispatchError instanceof Error ? dispatchError.message : '出现了一点问题',
          },
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [sessionId, surfaceMode]);

  const dispatchChromeAction = (actionId: string) => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) {
      return;
    }

    if (surfaceMode === 'document') {
      const viewportHeight = Number.isFinite(window.innerHeight) ? Math.ceil(window.innerHeight) : DOCUMENT_SURFACE_INITIAL_HEIGHT;
      const resetHeight = Math.max(DOCUMENT_SURFACE_MIN_HEIGHT, viewportHeight);
      embeddedHeightRef.current = resetHeight;
      setEmbeddedHeight(resetHeight);
    }

    iframeRef.current?.scrollIntoView({
      block: 'start',
      inline: 'nearest',
      behavior: 'auto',
    });

    frameWindow.postMessage(
      {
        type: 'chips.web-shell:event',
        sessionId,
        event: 'plugin.chrome.action',
        payload: {
          actionId,
        },
      },
      window.location.origin,
    );
  };

  const handleBack = () => {
    if (chromeState?.back.handledByPlugin) {
      dispatchChromeAction('back');
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    dispatchChromeAction('back');
  };

  if (loading) {
    return (
      <div className="hosted-plugin-surface hosted-plugin-surface--state">
        <div className="hosted-plugin-surface__state">
          <Spin size="large" />
          <span>加载中…</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="hosted-plugin-surface hosted-plugin-surface--state">
        <Result status="error" title={error || '没有找到目标内容。'} />
      </div>
    );
  }

  return (
    <div
      className={`hosted-plugin-surface${surfaceMode === 'document' ? ' hosted-plugin-surface--document' : ''}`}
      data-plugin-id={session.pluginId}
    >
      {chromeState ? (
        <div className="hosted-plugin-surface__chrome" style={{ ['--hosted-plugin-chrome-safe-block-start' as string]: `${chromeState.safeBlockStart}px` }}>
          <div className="hosted-plugin-surface__chrome-layer">
            {chromeState.back.enabled ? (
              <button
                type="button"
                className="hosted-plugin-surface__chrome-button hosted-plugin-surface__chrome-back"
                onClick={handleBack}
                aria-label={chromeState.back.label}
                title={chromeState.back.label}
              >
                <ArrowLeftOutlined style={{ fontSize: 20 }} />
              </button>
            ) : null}

            {chromeState.title ? (
              <aside className="hosted-plugin-surface__chrome-pill" aria-label={chromeState.title}>
                <h1>{chromeState.title}</h1>
                {chromeState.metaLines.length > 0 ? (
                  <div className="hosted-plugin-surface__chrome-meta">
                    {chromeState.metaLines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                ) : null}
              </aside>
            ) : null}

            {chromeState.actions.length > 0 ? (
              <div className="hosted-plugin-surface__chrome-actions">
                {chromeState.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="hosted-plugin-surface__chrome-button"
                    disabled={action.disabled}
                    onClick={() => dispatchChromeAction(action.id)}
                    aria-label={action.label}
                    title={action.label}
                  >
                    <ChromeActionIcon icon={action.icon} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <iframe
        ref={iframeRef}
        className={`hosted-plugin-surface__frame${surfaceMode === 'document' ? ' hosted-plugin-surface__frame--document' : ''}`}
        src={frameUrl}
        title={session.title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups"
        scrolling={surfaceMode === 'document' ? 'no' : undefined}
        style={
          surfaceMode === 'document'
            ? {
                height: `${embeddedHeight ?? 960}px`,
              }
            : undefined
        }
      />
    </div>
  );
}
