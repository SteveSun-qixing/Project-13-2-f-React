import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { Input, type InputRef } from 'antd';
import {
    DeleteOutlined,
    EditOutlined,
    FileAddOutlined,
    FolderOpenOutlined,
    InboxOutlined,
    ReloadOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import { Toolbar, type CommandItem } from '@chips/ui';
import { FileTree } from './FileTree';
import { ContextMenu } from './ContextMenu';
import { workspaceService } from '../../services/workspace-service';
import { DEFAULT_BOX_LAYOUT_TYPE } from '../../services/box-document-service';
import type { WorkspaceFile } from '../../types/workspace';
import { useEditor } from '../../context/EditorContext';
import { CHIPS_DRAG_DATA_TYPE, type WorkspaceFileDragData } from '../CardBoxLibrary/types';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './FileManager.css';

interface FileManagerProps {
    workingDirectory?: string;
}

const FILE_MANAGER_COMMAND_IDS = {
    newCard: 'editing-engine:file.new-card',
    newBox: 'editing-engine:file.new-box',
    open: 'editing-engine:file.open',
    rename: 'editing-engine:file.rename',
    delete: 'editing-engine:file.delete',
    refresh: 'editing-engine:file.refresh',
    search: 'editing-engine:search.workspace',
} as const;

export default function FileManager({ workingDirectory }: FileManagerProps) {
    const { state } = useEditor();
    const isReady = state === 'ready';

    // State
    const [files, setFiles] = useState<WorkspaceFile[]>([]);
    const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const searchInputRef = useRef<InputRef>(null);

    // Derived State
    const flattenedFiles = useMemo(() => {
        const result: WorkspaceFile[] = [];
        const flatten = (list: WorkspaceFile[]) => {
            for (const file of list) {
                result.push(file);
                if (file.children) flatten(file.children);
            }
        };
        flatten(files);
        return result;
    }, [files]);

    const selectedFiles = useMemo(() =>
        flattenedFiles.filter(f => selectedPaths.includes(f.path)),
        [flattenedFiles, selectedPaths]
    );

    const isSearching = searchQuery.trim().length > 0;

    const searchResults = useMemo(() => {
        if (!isSearching) return [];
        const query = searchQuery.toLowerCase();
        return flattenedFiles.filter(f => f.name.toLowerCase().includes(query));
    }, [flattenedFiles, searchQuery, isSearching]);

    const displayFiles = isSearching ? searchResults : files;
    const rootPath = workingDirectory || workspaceService.getState().rootPath;
    const selectedFilesRef = useRef<WorkspaceFile[]>([]);
    const workingDirectoryRef = useRef<string | undefined>(workingDirectory);

    useEffect(() => {
        selectedFilesRef.current = selectedFiles;
    }, [selectedFiles]);

    useEffect(() => {
        workingDirectoryRef.current = workingDirectory;
    }, [workingDirectory]);

    // Initialization & Event Listeners
    useEffect(() => {
        const loadFiles = async () => {
            setIsLoading(true);
            if (!workspaceService.isInitialized()) {
                await workspaceService.initialize();
            }
            setFiles([...workspaceService.getFiles()]);
            setIsLoading(false);
        };

        const handleRefresh = () => {
            setFiles([...workspaceService.getFiles()]);
        };

        loadFiles();
        workspaceService.on('workspace:refreshed', handleRefresh);
        workspaceService.on('workspace:initialized', handleRefresh);

        return () => {
            workspaceService.off('workspace:refreshed', handleRefresh);
            workspaceService.off('workspace:initialized', handleRefresh);
        };
    }, []);

    // Handlers
    const handleSelect = (paths: string[]) => {
        setSelectedPaths(paths);
    };

    const handleOpen = useCallback((file: WorkspaceFile) => {
        if (file.type !== 'folder') {
            workspaceService.openFile(file.id);
        }
    }, []);

    const handleContextMenu = (file: WorkspaceFile, event: React.MouseEvent) => {
        event.preventDefault();
        setSelectedPaths((current) => (current.includes(file.path) ? current : [file.path]));
    };

    const handleToggle = (file: WorkspaceFile) => {
        // Toggle expanded state locally in the tree
        const updatedFiles = [...files];
        const toggleNode = (list: WorkspaceFile[]) => {
            for (let i = 0; i < list.length; i++) {
                if (list[i].path === file.path) {
                    list[i] = { ...list[i], expanded: !list[i].expanded };
                    return true;
                }
                if (list[i].children && toggleNode(list[i].children!)) return true;
            }
            return false;
        };
        toggleNode(updatedFiles);
        setFiles(updatedFiles);
    };

    const handleRename = async (file: WorkspaceFile, newName: string) => {
        try {
            await workspaceService.renameFile(file.id, newName);
            setRenamingPath(null);
        } catch (e) {
            console.error('Rename failed:', e);
        }
    };

    const handleDragStart = (file: WorkspaceFile, event: React.DragEvent) => {
        if (!event.dataTransfer || file.type === 'folder') {
            return;
        }

        const dragData: WorkspaceFileDragData = {
            type: 'workspace-file',
            fileId: file.id,
            fileType: file.type,
            filePath: file.path,
            name: file.name,
        };

        event.dataTransfer.setData(CHIPS_DRAG_DATA_TYPE, JSON.stringify(dragData));
        event.dataTransfer.setData('text/plain', file.path);
        event.dataTransfer.effectAllowed = 'copy';
    };

    const toggleSearch = useCallback(() => {
        setIsSearchExpanded((wasExpanded) => {
            if (!wasExpanded) {
                setTimeout(() => searchInputRef.current?.focus(), 0);
                return true;
            }

            setSearchQuery('');
            return false;
        });
    }, []);

    // File command actions (local callbacks, equivalent to previous command handlers)
    const handleNewCard = useCallback(async () => {
        const targetFile = selectedFilesRef.current[0];
        const parentPath = targetFile?.type === 'folder' ? targetFile.path : workingDirectoryRef.current;
        await workspaceService.createCard(
            '未命名卡片',
            undefined,
            undefined,
            parentPath,
        );
    }, []);

    const handleNewBox = useCallback(async () => {
        const targetFile = selectedFilesRef.current[0];
        const parentPath = targetFile?.type === 'folder' ? targetFile.path : workingDirectoryRef.current;
        await workspaceService.createBox(
            '未命名箱子',
            DEFAULT_BOX_LAYOUT_TYPE,
            parentPath,
        );
    }, []);

    const handleOpenCommand = useCallback(() => {
        const targetFile = selectedFilesRef.current[0];
        if (targetFile) handleOpen(targetFile);
    }, [handleOpen]);

    const handleRenameCommand = useCallback(() => {
        const targetFile = selectedFilesRef.current[0];
        if (targetFile) setRenamingPath(targetFile.path);
    }, []);

    const handleDeleteCommand = useCallback(async () => {
        for (const f of selectedFilesRef.current) {
            await workspaceService.deleteFile(f.id);
        }
        setSelectedPaths([]);
    }, []);

    const handleRefreshCommand = useCallback(async () => {
        await workspaceService.refresh();
    }, []);

    const fileCommands = useMemo<CommandItem[]>(() => {
        const hasSelection = selectedFiles.length > 0;
        const isSingleFile = selectedFiles.length === 1;
        const hasOpenableSelection = isSingleFile && selectedFiles[0]?.type !== 'folder';

        return [
            {
                id: FILE_MANAGER_COMMAND_IDS.newCard,
                title: '新建卡片',
                shortcut: 'Mod+N',
                icon: <FileAddOutlined />,
                group: '新建',
                menuId: 'workspace-file',
                toolbarId: 'file-manager',
                keywords: ['card', 'new', '新建', '卡片'],
                enabled: isReady,
                run: () => void handleNewCard(),
            },
            {
                id: FILE_MANAGER_COMMAND_IDS.newBox,
                title: '新建箱子',
                shortcut: 'Mod+Shift+N',
                icon: <InboxOutlined />,
                group: '新建',
                menuId: 'workspace-file',
                toolbarId: 'file-manager',
                keywords: ['box', 'new', '新建', '箱子'],
                enabled: isReady,
                run: () => void handleNewBox(),
            },
            {
                id: FILE_MANAGER_COMMAND_IDS.open,
                title: '打开',
                icon: <FolderOpenOutlined />,
                group: '打开',
                menuId: 'workspace-file',
                keywords: ['open', '打开'],
                enabled: hasOpenableSelection,
                run: handleOpenCommand,
            },
            {
                id: FILE_MANAGER_COMMAND_IDS.rename,
                title: '重命名',
                shortcut: 'F2',
                icon: <EditOutlined />,
                group: '管理',
                menuId: 'workspace-file',
                keywords: ['rename', '重命名'],
                enabled: isSingleFile,
                run: handleRenameCommand,
            },
            {
                id: FILE_MANAGER_COMMAND_IDS.delete,
                title: '删除',
                shortcut: 'Delete',
                icon: <DeleteOutlined />,
                group: '管理',
                menuId: 'workspace-file',
                keywords: ['delete', '删除'],
                enabled: hasSelection,
                run: () => void handleDeleteCommand(),
            },
            {
                id: FILE_MANAGER_COMMAND_IDS.refresh,
                title: '刷新',
                icon: <ReloadOutlined />,
                group: '视图',
                menuId: 'workspace-file',
                toolbarId: 'file-manager',
                keywords: ['refresh', '刷新'],
                enabled: isReady,
                run: () => void handleRefreshCommand(),
            },
            {
                id: FILE_MANAGER_COMMAND_IDS.search,
                title: '搜索工作区',
                shortcut: 'Mod+F',
                icon: <SearchOutlined />,
                group: '视图',
                toolbarId: 'file-manager',
                keywords: ['search', '搜索'],
                enabled: isReady,
                run: toggleSearch,
            },
        ];
    }, [
        handleDeleteCommand,
        handleNewBox,
        handleNewCard,
        handleOpenCommand,
        handleRefreshCommand,
        handleRenameCommand,
        isReady,
        selectedFiles,
        toggleSearch,
    ]);

    const toolbarCommands = useMemo(
        () => fileCommands.filter((command) => command.toolbarId === 'file-manager'),
        [fileCommands],
    );

    const contextMenuCommands = useMemo(
        () => fileCommands.filter((command) => command.menuId === 'workspace-file'),
        [fileCommands],
    );

    const handleContextMenuCommand = useCallback((commandId: string) => {
        const command = fileCommands.find((item) => item.id === commandId);
        if (command && command.enabled !== false) {
            command.run();
        }
    }, [fileCommands]);

    return (
        <div className="file-manager">
            {/* Toolbar */}
            <div className="file-manager__toolbar">
                <Toolbar items={toolbarCommands} />
            </div>

            {/* Search Input Row */}
            {isSearchExpanded && (
                <div className="file-manager__search-row">
                    <Input
                        ref={searchInputRef}
                        value={searchQuery}
                        className="file-manager__search-input"
                        placeholder="搜索文件..."
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                        type="button"
                        className="file-manager__search-close"
                        onClick={toggleSearch}
                    >
                        <RuntimeIcon icon={ENGINE_ICONS.close} />
                    </button>
                </div>
            )}

            {/* Main Content */}
            <div className="file-manager__content">
                {isLoading ? (
                    <div className="file-manager__loading">
                        <span className="file-manager__loading-spinner">
                            <RuntimeIcon icon={ENGINE_ICONS.loading} />
                        </span>
                        <span>加载中...</span>
                    </div>
                ) : displayFiles.length === 0 ? (
                    <div className="file-manager__empty">
                        <span className="file-manager__empty-icon">
                            <RuntimeIcon icon={isSearching ? ENGINE_ICONS.search : ENGINE_ICONS.folderOpen} />
                        </span>
                        <span className="file-manager__empty-title">
                            {isSearching ? '未找到结果' : '暂无文件'}
                        </span>
                        {!isSearching && (
                             <span className="file-manager__empty-hint">
                                在空白处点击右键创建新文件<br/>
                                或从卡箱库拖入内容
                            </span>
                        )}
                        {isSearching && (
                            <button type="button" onClick={() => setSearchQuery('')}>
                                清除搜索
                            </button>
                        )}
                    </div>
                ) : (
                    <ContextMenu
                        commands={contextMenuCommands}
                        onCommand={handleContextMenuCommand}
                    >
                        <FileTree
                            files={displayFiles}
                            rootPath={rootPath}
                            selectedPaths={selectedPaths}
                            renamingPath={renamingPath}
                            searchQuery={searchQuery}
                            multiSelect={true}
                            onSelect={handleSelect}
                            onOpen={handleOpen}
                            onContextMenu={handleContextMenu}
                            onToggle={handleToggle}
                            onRename={handleRename}
                            onRenameCancel={() => setRenamingPath(null)}
                            onDragStart={handleDragStart}
                        />
                    </ContextMenu>
                )}
            </div>

            {/* Status Bar */}
            <div className="file-manager__statusbar">
                {isSearching ? (
                    <>
                        <span>搜索结果</span>
                        <span className="file-manager__statusbar-count">{searchResults.length}</span>
                    </>
                ) : (
                    <>
                        {selectedPaths.length > 0 ? (
                            <>
                                已选择 {selectedPaths.length} 项
                            </>
                        ) : (
                            <>
                                共 {flattenedFiles.length} 项
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
