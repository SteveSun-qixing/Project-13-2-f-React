import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useCommandRegistry, type CommandItem } from '@chips/ui';
import { getCommandManager, type CommandManagerState } from '../core/command-manager';
import { useEditor } from '../context/EditorContext';
import { useUI } from '../context/UIContext';
import { useAppRuntime } from '../runtime/AppRuntimeProvider';
import { DEFAULT_BOX_LAYOUT_TYPE } from '../services/box-document-service';
import { workspaceService } from '../services/workspace-service';
import { formatMessage } from '../lib/messages';
import type { AnyWindowConfig } from '../types/window';
import {
    createEditingEngineCommands,
    EDITING_ENGINE_COMMAND_IDS,
    type EditingEngineCommandId,
} from './editing-engine-commands';

type EditingEngineCommandHandler = () => void | Promise<void>;
type EditingEngineCommandHandlerStack = Map<EditingEngineCommandId, EditingEngineCommandHandler[]>;

export interface EditingEngineCommandContextValue {
    commands: CommandItem[];
    registerHandler(commandId: EditingEngineCommandId, handler: EditingEngineCommandHandler): () => void;
}

const EditingEngineCommandContext = createContext<EditingEngineCommandContextValue | null>(null);

function useCommandManagerSnapshot(): CommandManagerState {
    const [state, setState] = React.useState<CommandManagerState>(() => getCommandManager().getState());

    useEffect(() => {
        const manager = getCommandManager();
        setState(manager.getState());
        return manager.subscribe((nextState) => setState(nextState));
    }, []);

    return state;
}

export function useEditingEngineCommands(): EditingEngineCommandContextValue {
    const context = useContext(EditingEngineCommandContext);
    if (!context) {
        throw new Error('useEditingEngineCommands must be used within EditingEngineCommandProvider');
    }

    return context;
}

export interface EditingEngineCommandProviderProps {
    children: ReactNode;
    openSettings: () => void;
}

export function EditingEngineCommandProvider({
    children,
    openSettings,
}: EditingEngineCommandProviderProps): React.ReactElement {
    const editor = useEditor();
    const {
        focusWindow,
        updateWindow,
        windows,
    } = useUI();
    const commandManagerState = useCommandManagerSnapshot();
    const { register } = useCommandRegistry();
    const handlersRef = useRef<EditingEngineCommandHandlerStack>(new Map());

    const registerHandler = useCallback((commandId: EditingEngineCommandId, handler: EditingEngineCommandHandler) => {
        const stack = handlersRef.current.get(commandId) ?? [];
        stack.push(handler);
        handlersRef.current.set(commandId, stack);

        return () => {
            const current = handlersRef.current.get(commandId);
            if (!current) {
                return;
            }

            const nextStack = current.filter((item) => item !== handler);
            if (nextStack.length === 0) {
                handlersRef.current.delete(commandId);
                return;
            }

            handlersRef.current.set(commandId, nextStack);
        };
    }, []);

    const defaultHandlers = useMemo<Partial<Record<EditingEngineCommandId, EditingEngineCommandHandler>>>(() => ({
        [EDITING_ENGINE_COMMAND_IDS.fileNewCard]: async () => {
            await workspaceService.createCard(formatMessage('file.untitled_card'));
        },
        [EDITING_ENGINE_COMMAND_IDS.fileNewBox]: async () => {
            await workspaceService.createBox(
                formatMessage('file.untitled_box'),
                DEFAULT_BOX_LAYOUT_TYPE,
            );
        },
        [EDITING_ENGINE_COMMAND_IDS.fileRefresh]: async () => {
            await workspaceService.refresh();
        },
        [EDITING_ENGINE_COMMAND_IDS.searchWorkspace]: () => {
            focusToolWindow('FileManager', { windows, updateWindow, focusWindow });
        },
        [EDITING_ENGINE_COMMAND_IDS.settingsOpen]: () => {
            openSettings();
        },
        [EDITING_ENGINE_COMMAND_IDS.editUndo]: async () => {
            await getCommandManager().undo();
        },
        [EDITING_ENGINE_COMMAND_IDS.editRedo]: async () => {
            await getCommandManager().redo();
        },
        [EDITING_ENGINE_COMMAND_IDS.viewToggleLayout]: () => {
            editor.setLayout(editor.currentLayout === 'infinite-canvas' ? 'workbench' : 'infinite-canvas');
        },
    }), [editor, focusWindow, openSettings, updateWindow, windows]);

    const dispatchHandler = useCallback((commandId: EditingEngineCommandId): void => {
        const stack = handlersRef.current.get(commandId);
        const handler = stack?.[stack.length - 1] ?? defaultHandlers[commandId];
        if (!handler) {
            return;
        }

        void Promise.resolve(handler()).catch((error: unknown) => {
            console.error(`[EditingEngineCommand] 命令执行失败：${commandId}`, error);
        });
    }, [defaultHandlers]);

    const handlers = useMemo(() => ({
        fileNewCard: () => dispatchHandler(EDITING_ENGINE_COMMAND_IDS.fileNewCard),
        fileNewBox: () => dispatchHandler(EDITING_ENGINE_COMMAND_IDS.fileNewBox),
        fileOpen: () => dispatchHandler(EDITING_ENGINE_COMMAND_IDS.fileOpen),
        fileRename: () => dispatchHandler(EDITING_ENGINE_COMMAND_IDS.fileRename),
        fileDelete: () => dispatchHandler(EDITING_ENGINE_COMMAND_IDS.fileDelete),
        fileRefresh: () => dispatchHandler(EDITING_ENGINE_COMMAND_IDS.fileRefresh),
        searchWorkspace: () => dispatchHandler(EDITING_ENGINE_COMMAND_IDS.searchWorkspace),
        editUndo: () => dispatchHandler(EDITING_ENGINE_COMMAND_IDS.editUndo),
        editRedo: () => dispatchHandler(EDITING_ENGINE_COMMAND_IDS.editRedo),
        viewToggleLayout: () => dispatchHandler(EDITING_ENGINE_COMMAND_IDS.viewToggleLayout),
        settingsOpen: () => dispatchHandler(EDITING_ENGINE_COMMAND_IDS.settingsOpen),
    }), [dispatchHandler]);

    const commands = useMemo(() => createEditingEngineCommands(handlers, {
        appReady: editor.state === 'ready',
        canUndo: commandManagerState.canUndo,
        canRedo: commandManagerState.canRedo,
        currentLayout: editor.currentLayout,
    }), [
        commandManagerState.canRedo,
        commandManagerState.canUndo,
        editor.currentLayout,
        editor.state,
        handlers,
    ]);

    useEffect(() => {
        register(commands);
    }, [commands, register]);

    const contextValue = useMemo<EditingEngineCommandContextValue>(() => ({
        commands,
        registerHandler,
    }), [commands, registerHandler]);

    return (
        <EditingEngineCommandContext.Provider value={contextValue}>
            {children}
        </EditingEngineCommandContext.Provider>
    );
}

function focusToolWindow(
    component: string,
    runtime: {
        windows: Array<{ id: string; type?: string; component?: string; state?: string }>;
        updateWindow(windowId: string, updates: Partial<AnyWindowConfig>): void;
        focusWindow(windowId: string): void;
    },
): void {
    const toolWindow = runtime.windows.find((window) => window.type === 'tool' && window.component === component);
    if (!toolWindow) {
        return;
    }

    if (toolWindow.state === 'minimized') {
        runtime.updateWindow(toolWindow.id, { state: 'normal' });
    }
    runtime.focusWindow(toolWindow.id);
}
