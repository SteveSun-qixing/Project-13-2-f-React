import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatMessage } from '../../lib/messages';
import { useCard } from '../../context/CardContext';
import { useEditorSelection } from '../../context/EditorSelectionContext';
import { useUI } from '../../context/UIContext';
import { boxDocumentService } from '../../services/box-document-service';
import { workspaceService } from '../../services/workspace-service';
import type { BoxWindowConfig } from '../../types/window';
import { PluginHost } from './PluginHost';
import { BoxEditorPanel } from './BoxEditorPanel';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './EditPanel.css';

interface EditPanelProps {
  position?: 'right' | 'left';
}

export default function EditPanel({
  position = 'right',
}: EditPanelProps) {
  const { activeCardId, selectedBaseCardId, getCard, saveCard, updateBasicCard } = useCard();
  const { target } = useEditorSelection();
  const { windows } = useUI();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pendingSaveOnBlurRef = useRef(false);
  const [isPanelFocused, setIsPanelFocused] = useState(false);

  const selectedCardId = target?.kind === 'card' ? target.cardId : activeCardId;
  const activeCard = selectedCardId ? getCard(selectedCardId) : null;
  const preferredBaseCardId = target?.kind === 'card'
    ? (target.baseCardId ?? selectedBaseCardId)
    : selectedBaseCardId;
  const selectedBaseCard = activeCard
    ? (
      (preferredBaseCardId
        ? activeCard.structure.basicCards.find((basicCard) => basicCard.id === preferredBaseCardId)
        : null)
      ?? activeCard.structure.basicCards[0]
      ?? null
    )
    : null;
  const selectedBoxWindow = target?.kind === 'box'
    ? windows.find((window): window is BoxWindowConfig => window.type === 'box' && window.boxId === target.boxId)
    : null;
  const persistedRevision = activeCard?.persistedRevision ?? 0;
  const pendingPersistRevision = activeCard?.pendingPersistRevision ?? persistedRevision;
  const hasPendingPersist = pendingPersistRevision > persistedRevision;

  const panelClass = [
    'edit-panel',
    'edit-panel--expanded',
    `edit-panel--${position}`,
  ].join(' ');

  const handlePanelFocusCapture = useCallback(() => {
    setIsPanelFocused(true);
    pendingSaveOnBlurRef.current = false;
  }, []);

  const handlePanelBlurCapture = useCallback(() => {
    window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      const activeElement = document.activeElement;
      const focusStillInside = Boolean(
        panel
        && activeElement instanceof Node
        && panel.contains(activeElement),
      );

      if (focusStillInside) {
        setIsPanelFocused(true);
        return;
      }

      setIsPanelFocused(false);
      pendingSaveOnBlurRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (isPanelFocused || !pendingSaveOnBlurRef.current) {
      return;
    }

    pendingSaveOnBlurRef.current = false;
    if (target?.kind === 'box') {
      const session = boxDocumentService.getSession(target.boxId);
      if (session?.isDirty) {
        void (async () => {
          await boxDocumentService.saveBox(target.boxId);
          await workspaceService.refresh();
        })();
      }
      return;
    }

    if (activeCard && hasPendingPersist) {
      void saveCard(activeCard.id);
    }
  }, [activeCard, hasPendingPersist, isPanelFocused, saveCard, target]);

  return (
    <div
      ref={panelRef}
      className={panelClass}
      role="complementary"
      aria-label={formatMessage('edit_panel.title')}
      onFocusCapture={handlePanelFocusCapture}
      onBlurCapture={handlePanelBlurCapture}
    >
      <div className="edit-panel__content">
        {selectedBoxWindow ? (
          <BoxEditorPanel
            boxId={selectedBoxWindow.boxId}
            boxPath={selectedBoxWindow.boxPath}
          />
        ) : activeCard && selectedBaseCard ? (
          <PluginHost
            cardId={activeCard.id}
            cardPath={activeCard.path}
            cardType={selectedBaseCard.type}
            baseCardId={selectedBaseCard.id}
            config={selectedBaseCard.data}
            pendingResourceImports={selectedBaseCard.pendingResourceImports}
            onConfigChange={(nextConfig, resourceOperations) => {
              if (activeCard) {
                updateBasicCard(
                  activeCard.id,
                  selectedBaseCard.id,
                  nextConfig,
                  resourceOperations,
                  { persist: false },
                );
              }
            }}
          />
        ) : (
          <div className="edit-panel__empty">
            <div className="edit-panel__empty-icon">
              <RuntimeIcon icon={ENGINE_ICONS.edit} />
            </div>
            <p className="edit-panel__empty-text">{formatMessage('edit_panel.empty_hint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
