import React, { useState, useRef, useEffect } from 'react';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './WindowMenu.css';

export interface WindowMenuProps {
    title: string;
    isEditing?: boolean;
    isCoverView?: boolean;
    showLock?: boolean;
    showSettings?: boolean;
    showCover?: boolean;
    onToggleEdit?: () => void;
    onSwitchToCover?: () => void;
    onSettings?: () => void;
    onUpdateTitle?: (title: string) => void;
}

export function WindowMenu({
    title,
    isEditing = false,
    isCoverView = false,
    showLock = false,
    showSettings = true,
    showCover = true,
    onToggleEdit,
    onSwitchToCover,
    onSettings,
    onUpdateTitle,
}: WindowMenuProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingTitle, setEditingTitle] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const isTitleEditable = typeof onUpdateTitle === 'function';

    const startEditTitle = (currentTitle: string) => {
        if (!isTitleEditable) {
            return;
        }
        setEditingTitle(currentTitle);
        setIsEditingTitle(true);
    };

    useEffect(() => {
        if (isEditingTitle && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditingTitle]);

    const saveTitle = () => {
        if (!isEditingTitle) return;
        const trimmedTitle = editingTitle.trim();
        if (trimmedTitle && trimmedTitle !== '') {
            onUpdateTitle?.(trimmedTitle);
        }
        setIsEditingTitle(false);
    };

    const cancelEditTitle = () => {
        setIsEditingTitle(false);
    };

    const handleKeydown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveTitle();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditTitle();
        }
    };

    const handleClickOutside = (e: MouseEvent) => {
        if (isEditingTitle && inputRef.current && !inputRef.current.contains(e.target as Node)) {
            saveTitle();
        }
    };

    useEffect(() => {
        if (isEditingTitle) {
            document.addEventListener('mousedown', handleClickOutside, true);
        } else {
            document.removeEventListener('mousedown', handleClickOutside, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [isEditingTitle, editingTitle]);

    return (
        <div className="window-menu">
            <div className="window-menu__left">
                {!isEditingTitle ? (
                    <div
                        className="window-menu__title"
                        onDoubleClick={() => startEditTitle(title)}
                    >
                        {title}
                    </div>
                ) : (
                    <input
                        ref={inputRef}
                        className="window-menu__title-input"
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={handleKeydown}
                    />
                )}
            </div>

            <div className="window-menu__right">
                {showLock && (
                    <button
                        type="button"
                        className={`window-menu__button ${isEditing ? 'window-menu__button--active' : ''}`}
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleEdit?.(); }}
                    >
                        <span className="window-menu__button-icon">
                            <RuntimeIcon icon={isEditing ? ENGINE_ICONS.lockOpen : ENGINE_ICONS.lock} />
                        </span>
                    </button>
                )}

                {showCover && (
                    <button
                        type="button"
                        className={`window-menu__button ${isCoverView ? 'window-menu__button--active' : ''}`}
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSwitchToCover?.(); }}
                    >
                        <span className="window-menu__button-icon">
                            <RuntimeIcon icon={ENGINE_ICONS.image} />
                        </span>
                    </button>
                )}

                {showSettings && (
                    <button
                        type="button"
                        className="window-menu__button"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSettings?.(); }}
                    >
                        <span className="window-menu__button-icon">
                            <RuntimeIcon icon={ENGINE_ICONS.settings} />
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
