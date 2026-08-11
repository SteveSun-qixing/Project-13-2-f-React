import React, { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import { HostedPluginSurface } from '../components/HostedPluginSurface';
import { closeWebPluginSession, createWebPluginSession, type WebPluginSessionView } from '../lib/host-runtime';
import { getErrorMessage } from '../lib/ui';
import './DocumentPluginRoutePage.css';

const CARD_VIEWER_PLUGIN_ID = 'com.chips.card-viewer';

type DocumentRouteCoverFields = {
  coverUrl?: string;
  coverFragmentUrl?: string;
  coverRenderMode?: 'fragment-shadow' | 'iframe';
  coverRatio?: string;
};

export type DocumentRouteSource =
  | ({
      kind: 'community-card';
      cardId: string;
      title: string;
      createdAt?: string;
      documentUrl: string;
      viewUrl?: string;
      canonicalUrl?: string;
    } & DocumentRouteCoverFields)
  | ({
      kind: 'community-box';
      boxId: string;
      title: string;
      createdAt?: string;
      documentUrl: string;
      canonicalUrl?: string;
    } & DocumentRouteCoverFields);

interface DocumentPluginRoutePageProps {
  source: DocumentRouteSource | null;
  loading: boolean;
  pending?: boolean;
  error: string;
  pendingLabel: string;
  trigger: string;
}

function normalizeDocumentUrl(value: string): string {
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
}

function resolveSourceDocumentUrl(source: DocumentRouteSource): string {
  return ('viewUrl' in source ? source.viewUrl : undefined) || source.documentUrl;
}

function resolveSourceId(source: DocumentRouteSource | null): string | null {
  if (!source) {
    return null;
  }
  return source.kind === 'community-card' ? source.cardId : source.boxId;
}

export function DocumentPluginRoutePage({
  source,
  loading,
  pending = false,
  error,
  pendingLabel,
  trigger,
}: DocumentPluginRoutePageProps) {
  const [session, setSession] = useState<WebPluginSessionView | null>(null);
  const [sessionError, setSessionError] = useState('');
  const launchSequenceRef = useRef(0);

  useEffect(() => {
    setSession(null);
    setSessionError('');
  }, [source?.kind, resolveSourceId(source)]);

  useEffect(() => {
    if (!source || !resolveSourceDocumentUrl(source) || session) {
      return;
    }

    let disposed = false;
    launchSequenceRef.current += 1;
    const launchSequence = launchSequenceRef.current;

    void createWebPluginSession({
      pluginId: CARD_VIEWER_PLUGIN_ID,
      launchParams: {
        trigger,
        cardSource: {
          ...source,
          documentUrl: normalizeDocumentUrl(resolveSourceDocumentUrl(source)),
        },
      },
    })
      .then((nextSession) => {
        if (disposed || launchSequenceRef.current !== launchSequence) {
          void closeWebPluginSession(nextSession.sessionId).catch(() => undefined);
          return;
        }

        setSession(nextSession);
      })
      .catch((nextError) => {
        if (!disposed && launchSequenceRef.current === launchSequence) {
          setSessionError(getErrorMessage(nextError, '出现了一点问题'));
        }
      });

    return () => {
      disposed = true;
    };
  }, [session, source, trigger]);

  if (loading) {
    return (
      <section className="document-plugin-route document-plugin-route--state" aria-live="polite">
        <div className="document-plugin-route__state-panel">
          <Spin size="large" />
          <h1>加载中…</h1>
        </div>
      </section>
    );
  }

  if (error || sessionError) {
    return (
      <section className="document-plugin-route document-plugin-route--state" aria-live="polite">
        <div className="document-plugin-route__state-panel">
          <h1>{error || sessionError}</h1>
        </div>
      </section>
    );
  }

  if (pending) {
    return (
      <section className="document-plugin-route document-plugin-route--state" aria-live="polite">
        <div className="document-plugin-route__state-panel">
          <Spin size="large" />
          <h1>{pendingLabel}</h1>
        </div>
      </section>
    );
  }

  if (!source) {
    return (
      <section className="document-plugin-route document-plugin-route--state" aria-live="polite">
        <div className="document-plugin-route__state-panel">
          <h1>没有找到目标内容。</h1>
        </div>
      </section>
    );
  }

  if (!resolveSourceDocumentUrl(source) || !session) {
    return (
      <section className="document-plugin-route document-plugin-route--state" aria-live="polite">
        <div className="document-plugin-route__state-panel">
          <Spin size="large" />
          <h1>{pendingLabel}</h1>
        </div>
      </section>
    );
  }

  return (
    <section className="document-plugin-route">
      {source.kind === 'community-card' && (
        <div className="document-plugin-route__download-hint" role="note">
          需要保存完整 .card？请在薯片客户端中打开并下载。
        </div>
      )}
      <HostedPluginSurface sessionId={session.sessionId} initialSession={session} surfaceMode="document" />
    </section>
  );
}
