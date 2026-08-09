import React, { useState, useMemo } from 'react';
import { CardTypeGrid } from './CardTypeGrid';
import { LayoutTypeGrid } from './LayoutTypeGrid';
import { useCardTypeDefinitions, useLayoutTypeDefinitions } from './data';
import { formatMessage } from '../../lib/messages';
import { DragProvider } from './DragContext';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './CardBoxLibrary.css';

type TabType = 'cards' | 'boxes';

export default function CardBoxLibrary() {
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const allCardTypes = useCardTypeDefinitions();
  const allLayoutTypes = useLayoutTypeDefinitions();

  const currentCardCount = allCardTypes.length;
  const currentLayoutCount = allLayoutTypes.length;

  const hasContent = useMemo(() => {
    return activeTab === 'cards' ? currentCardCount > 0 : currentLayoutCount > 0;
  }, [activeTab, currentCardCount, currentLayoutCount]);

  return (
    <DragProvider>
      <div className="card-box-library">
        {/* Tabs */}
        <div className="card-box-library__tabs">
          <button
            type="button"
            className={`card-box-library__tab ${activeTab === 'cards' ? 'card-box-library__tab--active' : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            <span className="card-box-library__tab-icon">
              <RuntimeIcon icon={ENGINE_ICONS.card} />
            </span>
            <span className="card-box-library__tab-label">{formatMessage('card_box.tab_cards')}</span>
            <span className="card-box-library__tab-count">{currentCardCount}</span>
          </button>
          <button
            type="button"
            className={`card-box-library__tab ${activeTab === 'boxes' ? 'card-box-library__tab--active' : ''}`}
            onClick={() => setActiveTab('boxes')}
          >
            <span className="card-box-library__tab-icon">
              <RuntimeIcon icon={ENGINE_ICONS.box} />
            </span>
            <span className="card-box-library__tab-label">{formatMessage('card_box.tab_boxes')}</span>
            <span className="card-box-library__tab-count">{currentLayoutCount}</span>
          </button>
        </div>

        {/* Content */}
        <div className="card-box-library__content">
          {activeTab === 'cards' ? (
            hasContent ? (
              <CardTypeGrid types={allCardTypes} />
            ) : (
              <div className="card-box-library__empty">
                <span className="card-box-library__empty-icon">
                  <RuntimeIcon icon={ENGINE_ICONS.empty} />
                </span>
                <span className="card-box-library__empty-text">{formatMessage('card_box.empty_cards')}</span>
                <span className="card-box-library__empty-hint">{formatMessage('card_box.empty_hint')}</span>
              </div>
            )
          ) : (
            hasContent ? (
              <LayoutTypeGrid types={allLayoutTypes} />
            ) : (
              <div className="card-box-library__empty">
                <span className="card-box-library__empty-icon">
                  <RuntimeIcon icon={ENGINE_ICONS.empty} />
                </span>
                <span className="card-box-library__empty-text">{formatMessage('card_box.empty_boxes')}</span>
                <span className="card-box-library__empty-hint">{formatMessage('card_box.empty_hint')}</span>
              </div>
            )
          )}
        </div>
      </div>
    </DragProvider>
  );
}
