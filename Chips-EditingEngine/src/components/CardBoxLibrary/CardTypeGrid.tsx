import React, { useMemo } from 'react';
import type { CardTypeDefinition, CardLibraryDragData } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { useDrag } from './DragContext';
import './CardTypeGrid.css';

interface CardTypeGridProps {
  types?: CardTypeDefinition[];
}

export function CardTypeGrid({ types }: CardTypeGridProps) {
  const { t } = useTranslation();
  const { startDrag } = useDrag();

  const displayTypes = useMemo(() => types ?? [], [types]);

  const handleDragStart = (type: CardTypeDefinition, event: React.DragEvent) => {
    const data: CardLibraryDragData = {
      type: 'card',
      typeId: type.id,
      name: t(type.name) || type.name,
    };
    startDrag(data, event);
  };

  return (
    <div className="card-type-grid">
      <div className="card-type-grid__items">
        {displayTypes.map((type) => (
          <div
            key={type.id}
            className="card-type-grid__item"
            draggable
            title={t(type.description) || type.description}
            onDragStart={(e) => handleDragStart(type, e)}
          >
            <span className="card-type-grid__item-icon">{type.icon}</span>
            <span className="card-type-grid__item-name">{t(type.name) || type.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
