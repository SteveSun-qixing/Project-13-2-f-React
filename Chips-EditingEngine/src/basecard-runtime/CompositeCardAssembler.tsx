import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CompositeInteractionPayload } from 'chips-sdk';
import type { BasicCardData, CardStructure } from '../core/card-service';
import { BasecardFrameHost, type BasecardFrameStatus } from './frame-host';
import './basecard-runtime.css';

export interface CompositeCardAssemblerProps {
  cardId: string;
  cardPath: string;
  baseCards: BasicCardData[];
  resourceBaseUrl?: string;
  layout?: CardStructure['layout'];
  mode: 'view' | 'preview';
  interactionPolicy: 'delegate' | 'native';
  selectedBaseCardId?: string | null;
  themeCacheKey?: string;
  onHeightChange?: (height: number) => void;
  onLoadingChange?: (loading: boolean) => void;
  onErrorChange?: (message: string | null) => void;
  onInteraction?: (payload: CompositeInteractionPayload, frame: HTMLIFrameElement) => void;
  onBaseCardSelect?: (baseCardId: string) => void;
}

function measureCompositeLayoutHeight(container: HTMLDivElement): number {
  return Math.max(
    1,
    Math.ceil(
      Math.max(
        container.scrollHeight,
        container.offsetHeight,
        container.clientHeight,
      ),
    ),
  );
}

export function CompositeCardAssembler({
  cardId,
  cardPath,
  baseCards,
  resourceBaseUrl,
  layout,
  mode,
  interactionPolicy,
  selectedBaseCardId,
  themeCacheKey,
  onHeightChange,
  onLoadingChange,
  onErrorChange,
  onInteraction,
  onBaseCardSelect,
}: CompositeCardAssemblerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [frameStates, setFrameStates] = useState<Record<string, BasecardFrameStatus>>({});

  const gap = typeof layout?.gap === 'number' ? layout.gap : 12;
  const padding = typeof layout?.padding === 'number' ? layout.padding : 16;
  const baseCardIds = useMemo(() => baseCards.map((baseCard) => baseCard.id), [baseCards]);
  const baseCardIdsSignature = useMemo(() => baseCardIds.join('|'), [baseCardIds]);

  useEffect(() => {
    setFrameStates((current) => {
      const next: Record<string, BasecardFrameStatus> = {};
      for (const baseCardId of baseCardIds) {
        if (current[baseCardId]) {
          next[baseCardId] = current[baseCardId];
        }
      }
      return next;
    });
  }, [baseCardIds, baseCardIdsSignature]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const emitHeight = () => {
      const nextHeight = measureCompositeLayoutHeight(container);
      onHeightChange?.(nextHeight);
    };

    emitHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      emitHeight();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [baseCardIdsSignature, gap, onHeightChange, padding]);

  useEffect(() => {
    const states = baseCards.map((baseCard) => frameStates[baseCard.id]).filter(Boolean);
    const hasPendingFrame = baseCards.length > 0 && states.some((state) => state.state === 'loading');
    const firstError = states.find((state) => state.state === 'error')?.errorMessage ?? null;

    onLoadingChange?.(hasPendingFrame);
    onErrorChange?.(firstError);
  }, [baseCards, frameStates, onErrorChange, onLoadingChange]);

  const handleFrameStatusChange = useCallback((baseCardId: string, status: BasecardFrameStatus) => {
    setFrameStates((current) => {
      const existing = current[baseCardId];
      if (
        existing &&
        existing.state === status.state &&
        existing.height === status.height &&
        existing.errorMessage === status.errorMessage
      ) {
        return current;
      }

      return {
        ...current,
        [baseCardId]: status,
      };
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className={`composite-card-assembler composite-card-assembler--${mode}`}
      data-chips-composite-card={cardId}
      style={{
        gap: `${gap}px`,
        padding: `${padding}px`,
      }}
    >
      {baseCards.map((baseCard) => (
        <div
          key={baseCard.id}
          className="composite-card-assembler__node"
          data-selectable={mode === 'preview' ? 'true' : 'false'}
          data-selected={selectedBaseCardId === baseCard.id ? 'true' : 'false'}
          data-card-type={baseCard.type}
          data-base-card-id={baseCard.id}
        >
          <BasecardFrameHost
            cardId={cardId}
            cardPath={cardPath}
            baseCardId={baseCard.id}
            cardType={baseCard.type}
            config={baseCard.data}
            resourceBaseUrl={resourceBaseUrl}
            pendingResourceImports={baseCard.pendingResourceImports}
            selectable={mode === 'preview'}
            themeCacheKey={themeCacheKey}
            interactionPolicy={interactionPolicy}
            onSelect={() => {
              if (mode !== 'preview') {
                return;
              }
              onBaseCardSelect?.(baseCard.id);
            }}
            onInteraction={onInteraction}
            onStatusChange={(status) => {
              handleFrameStatusChange(baseCard.id, status);
            }}
          />
        </div>
      ))}
    </div>
  );
}
