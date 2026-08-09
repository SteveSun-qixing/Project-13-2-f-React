import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FrameRenderResult } from 'chips-sdk';
import { type BoxDocumentSessionSnapshot } from '../../services/box-document-service';
import { getChipsClient } from '../../services/bridge-client';

export interface BoxPreviewSurfaceProps {
  session: BoxDocumentSessionSnapshot;
  className?: string;
  locale?: string;
}

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }
  return fallbackMessage;
}

export function BoxPreviewSurface({
  session,
  className,
  locale,
}: BoxPreviewSurfaceProps) {
  const previewLoadingText = '正在渲染箱子预览...';
  const previewFailedText = '箱子预览渲染失败';
  const client = useMemo(() => getChipsClient(), []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameResultRef = useRef<FrameRenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    const cleanupTasks: Array<() => void> = [];
    container.replaceChildren();
    setIsLoading(true);
    setError(null);

    client.document.window.render({
      filePath: session.boxFile,
      documentType: 'box',
      locale,
    }).then((result) => {
      if (cancelled) {
        void result.dispose().catch(() => undefined);
        return;
      }

      frameResultRef.current = result;
      result.frame.style.width = '100%';
      result.frame.style.height = '100%';
      result.frame.style.border = 'none';
      result.frame.style.display = 'block';
      container.appendChild(result.frame);

      cleanupTasks.push(
        client.document.window.onReady(result.frame, () => {
          if (!cancelled) {
            setIsLoading(false);
          }
        }),
      );
      cleanupTasks.push(
        client.document.window.onError(result.frame, (payload) => {
          if (!cancelled) {
            setIsLoading(false);
            setError(payload.message);
          }
        }),
      );
    }).catch((reason) => {
      if (!cancelled) {
        setIsLoading(false);
        setError(resolveErrorMessage(reason, previewFailedText));
      }
    });

    return () => {
      cancelled = true;
      cleanupTasks.forEach((task) => task());
      const frameResult = frameResultRef.current;
      frameResultRef.current = null;
      void frameResult?.dispose().catch(() => undefined);
      container.replaceChildren();
    };
  }, [client, locale, previewFailedText, session.boxFile, session.lastSavedAt]);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        alignSelf: 'stretch',
        position: 'relative',
        minHeight: '100%',
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
      }}
      data-chips-drop-surface="box-preview"
      data-chips-box-id={session.boxId}
      data-chips-drop-accept="true"
    >
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flex: '1 1 auto',
          minWidth: 0,
          minHeight: 0,
          width: '100%',
        }}
      />
      {isLoading ? (
        <div className="box-window__state" aria-live="polite">{previewLoadingText}</div>
      ) : null}
      {error ? (
        <div className="box-window__state box-window__state--error" role="alert">{error}</div>
      ) : null}
    </div>
  );
}
