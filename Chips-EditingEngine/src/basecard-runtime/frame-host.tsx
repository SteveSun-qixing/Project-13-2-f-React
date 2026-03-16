import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { BasecardErrorPayload, BasecardHeightPayload, BasecardSelectPayload, CompositeInteractionPayload } from 'chips-sdk';
import { getChipsClient } from '../services/bridge-client';

export interface BasecardFrameStatus {
  state: 'loading' | 'ready' | 'error';
  height: number;
  errorMessage: string | null;
}

export interface BasecardFrameHostProps {
  cardId: string;
  cardPath: string;
  baseCardId: string;
  cardType: string;
  config: Record<string, unknown>;
  selectable?: boolean;
  themeCacheKey?: string;
  interactionPolicy: 'delegate' | 'native';
  onSelect?: () => void;
  onStatusChange?: (status: BasecardFrameStatus) => void;
  onInteraction?: (payload: CompositeInteractionPayload, frame: HTMLIFrameElement) => void;
}

const DEFAULT_STATUS: BasecardFrameStatus = {
  state: 'loading',
  height: 96,
  errorMessage: null,
};

function normalizeFrameHeight(payload: BasecardHeightPayload): number {
  const height = Number(payload.height);
  if (!Number.isFinite(height)) {
    return DEFAULT_STATUS.height;
  }
  return Math.max(DEFAULT_STATUS.height, Math.ceil(height));
}

export function BasecardFrameHost({
  cardId,
  cardPath,
  baseCardId,
  cardType,
  config,
  selectable = false,
  themeCacheKey,
  interactionPolicy,
  onSelect,
  onStatusChange,
  onInteraction,
}: BasecardFrameHostProps) {
  const frameContainerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const selectableRef = useRef(selectable);
  const onSelectRef = useRef(onSelect);
  const onInteractionRef = useRef(onInteraction);
  const statusRef = useRef<BasecardFrameStatus>(DEFAULT_STATUS);
  const [status, setStatus] = useState<BasecardFrameStatus>(DEFAULT_STATUS);
  const deferredConfig = useDeferredValue(config);
  const effectiveConfig = selectable ? deferredConfig : config;
  const configSignature = useMemo(() => JSON.stringify(effectiveConfig), [effectiveConfig]);

  useEffect(() => {
    statusRef.current = status;
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
    void themeCacheKey;

    const frameContainer = frameContainerRef.current;
    if (!frameContainer) {
      return;
    }

    const client = getChipsClient();
    let disposed = false;
    let activeFrame: HTMLIFrameElement | null = null;
    let activeSessionId = '';
    const cleanupTasks: Array<() => void> = [];
    const previousStatus = statusRef.current;
    const preservedHeight = Math.max(DEFAULT_STATUS.height, previousStatus.height);
    const keepStablePreviewVisible = previousStatus.state === 'ready' && frameRef.current !== null;

    setStatus({
      state: keepStablePreviewVisible ? 'ready' : 'loading',
      height: preservedHeight,
      errorMessage: null,
    });

    const mount = async (): Promise<void> => {
      const session = await client.card.basecard.openSession({
        cardType,
        baseCardId,
        sourceConfig: effectiveConfig,
        cardRootDir: cardPath,
      });
      activeSessionId = session.sessionId;

      if (disposed) {
        await client.card.basecard.closeSession(session.sessionId).catch(() => ({ closed: false }));
        return;
      }

      const rendered = await client.card.basecard.renderView({
        sessionId: session.sessionId,
        interactionPolicy,
      });

      if (disposed) {
        await client.card.basecard.closeSession(session.sessionId).catch(() => ({ closed: false }));
        return;
      }

      activeFrame = rendered.frame;
      activeFrame.className = 'basecard-frame-host__frame';
      activeFrame.title = `basecard-${baseCardId}`;
      activeFrame.scrolling = 'no';
      activeFrame.style.height = `${preservedHeight}px`;

      cleanupTasks.push(
        client.card.basecard.onReady(activeFrame, () => {
          setStatus((current) => ({
            state: 'ready',
            height: current.height,
            errorMessage: null,
          }));
        }),
      );
      cleanupTasks.push(
        client.card.basecard.onHeight(activeFrame, (payload) => {
          const nextHeight = normalizeFrameHeight(payload);
          activeFrame!.style.height = `${nextHeight}px`;
          setStatus({
            state: 'ready',
            height: nextHeight,
            errorMessage: null,
          });
        }),
      );
      cleanupTasks.push(
        client.card.basecard.onSelect(activeFrame, (_payload: BasecardSelectPayload) => {
          if (!selectableRef.current) {
            return;
          }
          onSelectRef.current?.();
        }),
      );
      cleanupTasks.push(
        client.card.basecard.onInteraction(activeFrame, (payload) => {
          if (!onInteractionRef.current || !activeFrame) {
            return;
          }

          onInteractionRef.current(
            {
              ...payload,
              cardId,
              source: 'basecard-frame',
            },
            activeFrame,
          );
        }),
      );
      cleanupTasks.push(
        client.card.basecard.onError(activeFrame, (payload: BasecardErrorPayload) => {
          setStatus((current) => ({
            state: 'error',
            height: current.height,
            errorMessage: payload.message,
          }));
        }),
      );

      frameContainer.replaceChildren(activeFrame);
      frameRef.current = activeFrame;
    };

    void mount().catch((error) => {
      if (disposed) {
        return;
      }

      const normalizedError = error instanceof Error ? error : new Error(String(error));
      setStatus((current) => ({
        state: 'error',
        height: current.height,
        errorMessage: normalizedError.message,
      }));
    });

    return () => {
      disposed = true;
      cleanupTasks.forEach((cleanup) => cleanup());
      if (activeSessionId) {
        void client.card.basecard.closeSession(activeSessionId).catch(() => ({ closed: false }));
      }
    };
  }, [baseCardId, cardId, cardPath, cardType, configSignature, interactionPolicy, themeCacheKey]);

  return (
    <div className="basecard-frame-host">
      <div ref={frameContainerRef} className="basecard-frame-host__mount" />
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
