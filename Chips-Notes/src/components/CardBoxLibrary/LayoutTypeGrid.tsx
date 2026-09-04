import React, { useMemo } from 'react';
import type { LayoutTypeDefinition, LayoutLibraryDragData } from './types';
import { useDrag } from './DragContext';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './CardTypeGrid.css'; // Reusing CardTypeGrid styles for unified appearance

interface LayoutTypeGridProps {
  types?: LayoutTypeDefinition[];
}

export function LayoutTypeGrid({ types }: LayoutTypeGridProps) {
  const { startDrag } = useDrag();

  const displayTypes = useMemo(() => types ?? [], [types]);

  const handleDragStart = (type: LayoutTypeDefinition, event: React.DragEvent) => {
    const data: LayoutLibraryDragData = {
      type: 'layout',
      typeId: type.id,
      name: type.name,
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
            title={type.description}
            onDragStart={(e) => handleDragStart(type, e)}
          >
            <span className="card-type-grid__item-icon">
              <RuntimeIcon icon={type.icon} />
            </span>
            <span className="card-type-grid__item-name">{type.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
