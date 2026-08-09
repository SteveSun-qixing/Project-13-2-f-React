import type { ReactNode } from 'react';
import {
    AppstoreOutlined,
    DashboardOutlined,
    DeleteOutlined,
    EditOutlined,
    FolderOpenOutlined,
    InboxOutlined,
    PlusSquareOutlined,
    RedoOutlined,
    ReloadOutlined,
    SearchOutlined,
    SettingOutlined,
    UndoOutlined,
} from '@ant-design/icons';
import type { CommandItem } from '@chips/ui';
import { appConfig } from '../../config/app-config';
import type { LayoutType } from '../types/editor';

export const EDITING_ENGINE_COMMAND_IDS = {
    fileNewCard: `${appConfig.appId}.file.new-card`,
    fileNewBox: `${appConfig.appId}.file.new-box`,
    fileOpen: `${appConfig.appId}.file.open`,
    fileRename: `${appConfig.appId}.file.rename`,
    fileDelete: `${appConfig.appId}.file.delete`,
    fileRefresh: `${appConfig.appId}.file.refresh`,
    searchWorkspace: `${appConfig.appId}.search.workspace`,
    editUndo: `${appConfig.appId}.edit.undo`,
    editRedo: `${appConfig.appId}.edit.redo`,
    viewToggleLayout: `${appConfig.appId}.view.toggle-layout`,
    settingsOpen: `${appConfig.appId}.settings.open`,
} as const;

export type EditingEngineCommandId =
    (typeof EDITING_ENGINE_COMMAND_IDS)[keyof typeof EDITING_ENGINE_COMMAND_IDS];

const COMMAND_ID_SET = new Set<string>(Object.values(EDITING_ENGINE_COMMAND_IDS));

export interface EditingEngineCommandState {
    appReady: boolean;
    canUndo: boolean;
    canRedo: boolean;
    currentLayout: LayoutType;
}

export interface EditingEngineCommandHandlers {
    fileNewCard: () => void | Promise<void>;
    fileNewBox: () => void | Promise<void>;
    fileOpen: () => void | Promise<void>;
    fileRename: () => void | Promise<void>;
    fileDelete: () => void | Promise<void>;
    fileRefresh: () => void | Promise<void>;
    searchWorkspace: () => void | Promise<void>;
    editUndo: () => void | Promise<void>;
    editRedo: () => void | Promise<void>;
    viewToggleLayout: () => void;
    settingsOpen: () => void;
}

function layoutIcon(currentLayout: LayoutType): ReactNode {
    return currentLayout === 'infinite-canvas' ? <DashboardOutlined /> : <AppstoreOutlined />;
}

export function createEditingEngineCommands(
    handlers: EditingEngineCommandHandlers,
    state: EditingEngineCommandState,
): CommandItem[] {
    const { appReady, canUndo, canRedo, currentLayout } = state;

    return [
        {
            id: EDITING_ENGINE_COMMAND_IDS.fileNewCard,
            title: '新建卡片',
            shortcut: 'Mod+N',
            icon: <PlusSquareOutlined />,
            group: '文件',
            menuId: 'file',
            toolbarId: 'workspace',
            keywords: ['card', 'new', '新建卡片'],
            enabled: appReady,
            run: () => void handlers.fileNewCard(),
        },
        {
            id: EDITING_ENGINE_COMMAND_IDS.fileNewBox,
            title: '新建箱子',
            shortcut: 'Mod+Shift+N',
            icon: <InboxOutlined />,
            group: '文件',
            menuId: 'file',
            toolbarId: 'workspace',
            keywords: ['box', 'new', '新建箱子'],
            enabled: appReady,
            run: () => void handlers.fileNewBox(),
        },
        {
            id: EDITING_ENGINE_COMMAND_IDS.fileOpen,
            title: '打开',
            icon: <FolderOpenOutlined />,
            group: '文件',
            menuId: 'workspace-file',
            keywords: ['open', '打开'],
            enabled: appReady,
            run: () => void handlers.fileOpen(),
        },
        {
            id: EDITING_ENGINE_COMMAND_IDS.fileRename,
            title: '重命名',
            icon: <EditOutlined />,
            group: '文件',
            menuId: 'workspace-file',
            keywords: ['rename', '重命名'],
            enabled: appReady,
            run: () => void handlers.fileRename(),
        },
        {
            id: EDITING_ENGINE_COMMAND_IDS.fileDelete,
            title: '删除',
            icon: <DeleteOutlined />,
            group: '文件',
            menuId: 'workspace-file',
            keywords: ['delete', '删除'],
            enabled: appReady,
            run: () => void handlers.fileDelete(),
        },
        {
            id: EDITING_ENGINE_COMMAND_IDS.fileRefresh,
            title: '刷新',
            icon: <ReloadOutlined />,
            group: '文件',
            menuId: 'file',
            toolbarId: 'file-manager',
            keywords: ['refresh', '刷新'],
            enabled: appReady,
            run: () => void handlers.fileRefresh(),
        },
        {
            id: EDITING_ENGINE_COMMAND_IDS.searchWorkspace,
            title: '搜索工作区',
            shortcut: 'Mod+F',
            icon: <SearchOutlined />,
            group: '编辑',
            menuId: 'edit',
            toolbarId: 'file-manager',
            keywords: ['search', '搜索工作区'],
            enabled: appReady,
            run: () => void handlers.searchWorkspace(),
        },
        {
            id: EDITING_ENGINE_COMMAND_IDS.editUndo,
            title: '撤销',
            shortcut: 'Mod+Z',
            icon: <UndoOutlined />,
            group: '编辑',
            menuId: 'edit',
            toolbarId: 'workspace',
            keywords: ['undo', '撤销'],
            enabled: appReady && canUndo,
            run: () => void handlers.editUndo(),
        },
        {
            id: EDITING_ENGINE_COMMAND_IDS.editRedo,
            title: '重做',
            shortcut: 'Mod+Shift+Z',
            icon: <RedoOutlined />,
            group: '编辑',
            menuId: 'edit',
            toolbarId: 'workspace',
            keywords: ['redo', '重做'],
            enabled: appReady && canRedo,
            run: () => void handlers.editRedo(),
        },
        {
            id: EDITING_ENGINE_COMMAND_IDS.viewToggleLayout,
            title: '切换布局',
            icon: layoutIcon(currentLayout),
            group: '视图',
            menuId: 'view',
            toolbarId: 'workspace',
            keywords: ['layout', '切换布局'],
            enabled: appReady,
            run: handlers.viewToggleLayout,
        },
        {
            id: EDITING_ENGINE_COMMAND_IDS.settingsOpen,
            title: '打开设置',
            shortcut: 'Mod+,',
            icon: <SettingOutlined />,
            group: '应用',
            menuId: 'app',
            toolbarId: 'workspace',
            keywords: ['settings', '打开设置'],
            run: handlers.settingsOpen,
        },
    ];
}

export function isEditingEngineCommandId(commandId: string): commandId is EditingEngineCommandId {
    return COMMAND_ID_SET.has(commandId);
}

export function isApplicationChromeCommand(command: CommandItem): boolean {
    return command.id !== EDITING_ENGINE_COMMAND_IDS.fileOpen &&
        command.id !== EDITING_ENGINE_COMMAND_IDS.fileRename &&
        command.id !== EDITING_ENGINE_COMMAND_IDS.fileDelete;
}
