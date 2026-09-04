import React from 'react';
import './InsertIndicator.css';

interface InsertIndicatorProps {
    visible?: boolean;
    position?: 'before' | 'after' | 'inside';
}

export function InsertIndicator({
    visible = false,
    position = 'before',
}: InsertIndicatorProps) {
    if (!visible) return null;

    return (
        <div className={`insert-indicator insert-indicator--${position}`}>
            <div className="insert-indicator__line" />
        </div>
    );
}
