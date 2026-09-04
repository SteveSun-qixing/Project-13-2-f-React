import React, { useState, useEffect, type ReactNode } from 'react';
import './DragGhost.css';

interface DragGhostProps {
    visible?: boolean;
    content?: ReactNode;
    offsetX?: number;
    offsetY?: number;
}

export function DragGhost({
    visible = false,
    content,
    offsetX = 0,
    offsetY = 0,
}: DragGhostProps) {
    const [position, setPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!visible) return;

        const handleMouseMove = (e: MouseEvent) => {
            setPosition({
                x: e.clientX + offsetX,
                y: e.clientY + offsetY,
            });
        };

        document.addEventListener('mousemove', handleMouseMove);
        return () => document.removeEventListener('mousemove', handleMouseMove);
    }, [visible, offsetX, offsetY]);

    if (!visible) return null;

    return (
        <div
            className="drag-ghost"
            style={{
                left: position.x,
                top: position.y,
            }}
        >
            {content}
        </div>
    );
}
