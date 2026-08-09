import React, { useRef, useEffect, useState } from 'react';
import { Input, type InputRef } from 'antd';
import type { WorkspaceFile } from '../../types/workspace';
import { ENGINE_ICONS, getWorkspaceFileIcon } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './FileItem.css';

interface FileItemProps {
    file: WorkspaceFile;
    level?: number;
    selected?: boolean;
    active?: boolean;
    renaming?: boolean;
    searchQuery?: string;
    tabIndex?: number;
    treeItemId?: string;
    ariaLevel?: number;
    ariaSetSize?: number;
    ariaPosInSet?: number;
    onClick: (file: WorkspaceFile, event: React.MouseEvent) => void;
    onDoubleClick: (file: WorkspaceFile) => void;
    onContextMenu: (file: WorkspaceFile, event: React.MouseEvent) => void;
    onToggle: (file: WorkspaceFile, event: React.MouseEvent) => void;
    onFocus?: (file: WorkspaceFile) => void;
    onRename: (file: WorkspaceFile, newName: string) => void;
    onRenameCancel: () => void;
    onDragStart: (file: WorkspaceFile, event: React.DragEvent) => void;
}

export const FileItem = React.forwardRef<HTMLDivElement, FileItemProps>(function FileItem({
    file,
    level = 0,
    selected = false,
    active = false,
    renaming = false,
    searchQuery = '',
    tabIndex = -1,
    treeItemId,
    ariaLevel,
    ariaSetSize,
    ariaPosInSet,
    onClick,
    onDoubleClick,
    onContextMenu,
    onToggle,
    onFocus,
    onRename,
    onRenameCancel,
    onDragStart,
}, ref) {
    const [renameValue, setRenameValue] = useState('');
    const inputRef = useRef<InputRef>(null);
    const isDirectory = file.type === 'folder';

    const fileIcon = getWorkspaceFileIcon(file);

    const indentStyle = {
        paddingLeft: `${level * 16 + 8}px`,
    };

    useEffect(() => {
        if (renaming) {
            const name = file.name;
            const dotIndex = name.lastIndexOf('.');
            setRenameValue(dotIndex > 0 ? name.substring(0, dotIndex) : name);
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 0);
        }
    }, [renaming, file.name]);

    const highlightedName = () => {
        if (!searchQuery) return file.name;

        const query = searchQuery.toLowerCase();
        const name = file.name;
        const lowerName = name.toLowerCase();
        const index = lowerName.indexOf(query);

        if (index === -1) return name;

        const before = name.substring(0, index);
        const match = name.substring(index, index + query.length);
        const after = name.substring(index + query.length);

        return (
            <>
                {before}
                <mark className="file-item__highlight">{match}</mark>
                {after}
            </>
        );
    };

    const handleConfirmRename = () => {
        const newName = renameValue.trim();
        if (newName && newName !== file.name) {
            onRename(file, newName);
        } else {
            onRenameCancel();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirmRename();
        } else if (e.key === 'Escape') {
            onRenameCancel();
        }
    };

    return (
        <div
            ref={ref}
            id={treeItemId}
            className={`file-item ${selected ? 'file-item--selected' : ''} ${active ? 'file-item--active' : ''} ${isDirectory ? 'file-item--directory' : ''} ${renaming ? 'file-item--renaming' : ''}`}
            style={indentStyle}
            role="treeitem"
            tabIndex={tabIndex}
            aria-selected={selected}
            aria-expanded={isDirectory ? Boolean(file.expanded) : undefined}
            aria-level={ariaLevel}
            aria-setsize={ariaSetSize}
            aria-posinset={ariaPosInSet}
            data-active={active}
            draggable={!renaming && !isDirectory && (file.type === 'card' || file.type === 'box')}
            onClick={(e) => onClick(file, e)}
            onDoubleClick={() => !renaming && onDoubleClick(file)}
            onContextMenu={(e) => onContextMenu(file, e)}
            onFocus={() => onFocus?.(file)}
            onDragStart={(e) => onDragStart(file, e)}
        >
            {isDirectory ? (
                <button
                    type="button"
                    className="file-item__toggle"
                    tabIndex={-1}
                    aria-label={file.expanded
                        ? `收起文件夹 ${file.name}`
                        : `展开文件夹 ${file.name}`}
                    onClick={(e: React.MouseEvent) => onToggle(file, e)}
                >
                    <span className={`file-item__arrow ${file.expanded ? 'file-item__arrow--expanded' : ''}`}>
                        <RuntimeIcon icon={ENGINE_ICONS.chevronRight} />
                    </span>
                </button>
            ) : (
                <span className="file-item__toggle-placeholder"></span>
            )}

            <span className="file-item__icon">
                <RuntimeIcon icon={fileIcon} />
            </span>

            {renaming ? (
                <Input
                    ref={inputRef}
                    value={renameValue}
                    className="file-item__rename-input"
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleConfirmRename}
                    onKeyDown={handleKeyDown}
                />
            ) : (
                <span className="file-item__name">{highlightedName()}</span>
            )}

            {isDirectory && file.children && file.children.length > 0 && (
                <span className="file-item__badge">{file.children.length}</span>
            )}
        </div>
    );
});
