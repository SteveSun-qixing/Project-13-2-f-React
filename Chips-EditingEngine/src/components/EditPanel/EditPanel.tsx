import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { useCard } from '../../context/CardContext';
import { PluginHost } from './PluginHost';
import './EditPanel.css';

interface EditPanelProps {
  position?: 'right' | 'left';
  width?: number;
  defaultExpanded?: boolean;
}

export default function EditPanel({
  position = 'right',
  width = 320,
  defaultExpanded: _defaultExpanded = true,
}: EditPanelProps) {
  const { t } = useTranslation();
  const { activeCardId, selectedBaseCardId, getCard, updateBasicCard } = useCard();

  const activeCard = activeCardId ? getCard(activeCardId) : null;
  const selectedBaseCard = activeCard && selectedBaseCardId
    ? activeCard.structure.basicCards.find(bc => bc.id === selectedBaseCardId)
    : null;

  const panelStyle = {
    '--panel-width': `${width}px`,
    width: `${width}px`,
  } as React.CSSProperties;

  const panelClass = [
    'edit-panel',
    'edit-panel--expanded',
    `edit-panel--${position}`,
  ].join(' ');

  return (
    <div className={panelClass} style={panelStyle} role="complementary" aria-label={t('edit_panel.title') || '编辑面板'}>
      <div className="edit-panel__content">
        {activeCard && selectedBaseCard ? (
          <PluginHost
            cardId={activeCard.id}
            cardPath={activeCard.path}
            cardType={selectedBaseCard.type}
            baseCardId={selectedBaseCard.id}
            config={selectedBaseCard.data}
            onConfigChange={(nextConfig, resourceOperations) => {
              if (activeCard) {
                updateBasicCard(activeCard.id, selectedBaseCard.id, nextConfig, resourceOperations);
              }
            }}
          />
        ) : (
          <div className="edit-panel__empty">
            <div className="edit-panel__empty-icon">📝</div>
            <p className="edit-panel__empty-text">{t('edit_panel.empty_hint') || '请在左侧选择要编辑的内容'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
