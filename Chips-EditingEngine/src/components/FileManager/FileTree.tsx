import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    createKeyboardMap,
    createRovingTabIndex,
    getKeyboardAction,
    getRovingTabIndexProps,
} from '../../utils/a11y';
import { FileItem } from './FileItem';
import type { WorkspaceFile } from '../../types/workspace';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './FileTree.css';

const FILE_TREE_KEYBOARD_MAP = createKeyboardMap({
    activate: ['Enter', ' '],
    expand: 'ArrowRight',
    collapse: 'ArrowLeft',
});

interface FlattenedFileNode {
    file: WorkspaceFile;
    level: number;
    posInSet: number;
    setSize: number;
}

function getTreeItemId(path: string): string {
    const encoded = Array.from(path)
        .map((char) => {
            if (/^[a-zA-Z0-9_-]$/.test(char)) {
                return char;
            }
            return `-${char.codePointAt(0)?.toString(16) ?? '0'}-`;
        })
        .join('');

    return `file-tree-item-${encoded}`;
}

interface FileTreeProps {
    files: WorkspaceFile[];
    rootPath?: string;
    selectedPaths: string[];
    renamingPath: string | null;
    searchQuery: string;
    multiSelect?: boolean;
    onSelect: (paths: string[], files: WorkspaceFile[]) => void;
    onOpen: (file: WorkspaceFile) => void;
    onContextMenu: (file: WorkspaceFile, event: React.MouseEvent) => void;
    onToggle: (file: WorkspaceFile) => void;
    onRename: (file: WorkspaceFile, newName: string) => void;
    onRenameCancel: () => void;
    onDragStart: (file: WorkspaceFile, event: React.DragEvent) => void;
}

export const FileTree = React.forwardRef<HTMLDivElement, FileTreeProps>(function FileTree({
    files,
    rootPath,
    selectedPaths,
    renamingPath,
    searchQuery,
    multiSelect = false,
    onSelect,
    onOpen,
    onContextMenu,
    onToggle,
    onRename,
    onRenameCancel,
    onDragStart,
}, ref) {
    const [focusPath, setFocusPath] = useState<string | null>(selectedPaths[0] ?? null);
    const itemRefs = useRef(new Map<string, HTMLDivElement>());
    const rootDepth = useMemo(
        () => (rootPath ?? '').split('/').filter(Boolean).length,
        [rootPath],
    );

    const flattenedNodes = useMemo(() => {
        const result: FlattenedFileNode[] = [];
        const getFileLevel = (file: WorkspaceFile): number => {
            const parts = file.path.split('/').filter(Boolean);
            if (!rootDepth) {
                return 0;
            }
            return Math.max(0, parts.length - rootDepth - 1);
        };

        const flatten = (list: WorkspaceFile[]) => {
            const setSize = list.length;
            list.forEach((file, index) => {
                result.push({
                    file,
                    level: getFileLevel(file),
                    posInSet: index + 1,
                    setSize,
                });
                if (file.type === 'folder' && file.expanded && file.children) {
                    flatten(file.children);
                }
            });
        };
        flatten(files);
        return result;
    }, [files, rootDepth]);

    const flattenedFiles = useMemo(
        () => flattenedNodes.map((node) => node.file),
        [flattenedNodes],
    );

    const activePath = focusPath ?? selectedPaths[0] ?? flattenedFiles[0]?.path ?? null;
    const activeIndex = flattenedFiles.findIndex((file) => file.path === activePath);
    const rovingModel = useMemo(
        () => createRovingTabIndex(
            flattenedFiles.map((file) => ({ id: file.path })),
            {
                activeIndex: activeIndex >= 0 ? activeIndex : 0,
                orientation: 'vertical',
                loop: false,
            },
        ),
        [activeIndex, flattenedFiles],
    );

    useEffect(() => {
        if (!activePath || flattenedFiles.some((file) => file.path === activePath)) {
            return;
        }
        setFocusPath(flattenedFiles[0]?.path ?? null);
    }, [activePath, flattenedFiles]);

    const setItemRef = useCallback((path: string) => (node: HTMLDivElement | null) => {
        if (node) {
            itemRefs.current.set(path, node);
        } else {
            itemRefs.current.delete(path);
        }
    }, []);

    const handleFileClick = (file: WorkspaceFile, event: React.MouseEvent) => {
        let newPaths: string[] = [];
        let newFiles: WorkspaceFile[] = [];

        if (multiSelect && (event.ctrlKey || event.metaKey)) {
            const currentPaths = [...selectedPaths];
            const index = currentPaths.indexOf(file.path);
            if (index > -1) {
                currentPaths.splice(index, 1);
            } else {
                currentPaths.push(file.path);
            }

            newPaths = currentPaths;
            newFiles = flattenedFiles.filter(f => newPaths.includes(f.path));
        } else if (multiSelect && event.shiftKey && selectedPaths.length > 0) {
            const lastSelected = selectedPaths[selectedPaths.length - 1];
            const lastIndex = flattenedFiles.findIndex((f) => f.path === lastSelected);
            const currentIndex = flattenedFiles.findIndex((f) => f.path === file.path);

            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);

                for (let i = start; i <= end; i++) {
                    const f = flattenedFiles[i];
                    newPaths.push(f.path);
                    newFiles.push(f);
                }
            }
        } else {
            newPaths = [file.path];
            newFiles = [file];
        }

        setFocusPath(file.path);
        onSelect(newPaths, newFiles);
    };

    const selectFocusedFile = (index: number) => {
        const file = flattenedFiles[index];
        if (file) {
            setFocusPath(file.path);
            onSelect([file.path], [file]);
            itemRefs.current.get(file.path)?.focus();
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (renamingPath) return;

        const len = flattenedFiles.length;
        if (len === 0) return;

        const nextIndex = rovingModel.getIndexByKey(event, { orientation: 'vertical', loop: false });
        if (nextIndex >= 0) {
            event.preventDefault();
            selectFocusedFile(nextIndex);
            return;
        }

        const currentIndex = activeIndex >= 0 ? activeIndex : 0;
        const currentFile = flattenedFiles[currentIndex];
        const action = getKeyboardAction(event, FILE_TREE_KEYBOARD_MAP);
        if (!action || !currentFile) {
            return;
        }

        if (action === 'activate') {
            event.preventDefault();
            if (currentFile.type === 'folder') {
                onToggle(currentFile);
            } else {
                onOpen(currentFile);
            }
            return;
        }

        if (action === 'expand') {
            event.preventDefault();
            if (currentFile.type === 'folder' && !currentFile.expanded) {
                onToggle(currentFile);
                return;
            }
            if (currentFile.type === 'folder' && currentFile.expanded && currentFile.children?.length) {
                selectFocusedFile(Math.min(currentIndex + 1, len - 1));
            }
            return;
        }

        if (action === 'collapse') {
            event.preventDefault();
            if (currentFile.type === 'folder' && currentFile.expanded) {
                onToggle(currentFile);
            }
        }
    };

    return (
        <div
            ref={ref}
            className="file-tree"
            tabIndex={flattenedFiles.length > 0 ? undefined : 0}
            role="tree"
            aria-label="文件树"
            aria-multiselectable={multiSelect ? true : undefined}
            onKeyDown={handleKeyDown}
        >
            {files.length > 0 ? (
                flattenedNodes.map((node, index) => {
                    const file = node.file;
                    const rovingItem = rovingModel.items[index];
                    const rovingProps = getRovingTabIndexProps(rovingItem, { includeAriaDisabled: false });
                    const treeItemId = getTreeItemId(file.path);

                    return (
                    <FileItem
                        key={file.path}
                        ref={setItemRef(file.path)}
                        file={file}
                        level={node.level}
                        selected={selectedPaths.includes(file.path)}
                        active={rovingItem?.active ?? false}
                        renaming={renamingPath === file.path}
                        searchQuery={searchQuery}
                        tabIndex={rovingProps.tabIndex}
                        treeItemId={treeItemId}
                        ariaLevel={node.level + 1}
                        ariaSetSize={node.setSize}
                        ariaPosInSet={node.posInSet}
                        onClick={handleFileClick}
                        onDoubleClick={(f) => f.type === 'folder' ? onToggle(f) : onOpen(f)}
                        onContextMenu={onContextMenu}
                        onToggle={(f) => onToggle(f)}
                        onFocus={(f) => setFocusPath(f.path)}
                        onRename={onRename}
                        onRenameCancel={onRenameCancel}
                        onDragStart={onDragStart}
                    />
                    );
                })
            ) : (
                <div className="file-tree__empty" role="status">
                    <span className="file-tree__empty-icon">
                        <RuntimeIcon icon={ENGINE_ICONS.folderClosed} />
                    </span>
                    <span className="file-tree__empty-text">空文件夹</span>
                </div>
            )}
        </div>
    );
});
