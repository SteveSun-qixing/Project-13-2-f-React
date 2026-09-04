import React from 'react';
import './DropHighlight.css';

interface DropHighlightProps {
    visible?: boolean;
    type?: 'valid' | 'invalid' | 'insert';
}

export function DropHighlight({
    visible = false,
    type = 'valid',
}: DropHighlightProps) {
    if (!visible) return null;

    return (
        <div className={`drop-highlight drop-highlight--${type}`}>
            <div className="drop-highlight__border" />
        </div>
    );
}
