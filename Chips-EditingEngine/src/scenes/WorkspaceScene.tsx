import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Spin } from 'antd';
import { useEditor } from '../context/EditorContext';
import { InfiniteCanvas } from '../layouts/InfiniteCanvas';
import { Workbench } from '../layouts/Workbench';
import { Dock } from '../components/Dock/Dock';
import {
  resolveCompositeCardDropTarget,
  resolveBoxEntryImportDropTarget,
  type CanvasDropTarget,
} from '../layouts/InfiniteCanvas/canvas-drop-target';
import { useUI } from '../context/UIContext';
import { useCard } from '../context/CardContext';
import { useEditorSelection } from '../context/EditorSelectionContext';
import { workspaceService, type WorkspaceOpenOptions } from '../services/workspace-service';
import { boxDocumentService, DEFAULT_BOX_LAYOUT_TYPE } from '../services/box-document-service';
import type { BasicCardConfig } from '../types/workspace';
import type { DragData } from '../components/CardBoxLibrary/types';
import type { BoxWindowConfig } from '../types/window';
import { generateId62 } from '../utils/id';
import {
  createInitialBasecardConfig,
  normalizeBasecardType,
} from '../basecard-runtime/registry';
import { useAppRuntime } from '../runtime/AppRuntimeProvider';
import { formatMessage } from '../lib/messages';
import {
  bootEditingEngine,
  subscribeInstalledBasecardRefresh,
} from '../runtime/boot-actions';
import { EditingEngineCommandProvider } from '../commands/EditingEngineCommandProvider';

const EngineSettingsDialog = lazy(() => import('../components/EngineSettings/EngineSettingsDialog').then(m => ({ default: m.EngineSettingsDialog })));

function createInitialBasicCardPayload(typeId: string, baseCardId = ''): Record<string, unknown> {
  const config = createInitialBasecardConfig(typeId, baseCardId);
  if (baseCardId) {
    return config;
  }

  const { id: _ignoredId, ...rest } = config;
  return rest;
}

function createInitialBasicCard(typeId: string): BasicCardConfig {
  const baseCardId = generateId62();
  const normalizedType = normalizeBasecardType(typeId);

  return {
    id: baseCardId,
    type: normalizedType,
    config: createInitialBasicCardPayload(normalizedType, baseCardId),
  };
}

export function WorkspaceScene(): React.ReactElement {
  const { client } = useAppRuntime();
  const { currentLayout, setState, state } = useEditor();
  const { createToolWindow, createCardWindow, createBoxWindow, updateWindow, focusWindow, windows } = useUI();
  const {
    addBasicCard,
    openCard,
    openCards,
    setActiveCard,
    setSelectedBaseCard,
  } = useCard();
  const { selectCard, selectBox } = useEditorSelection();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const hasInitializedRef = useRef(false);

  const openSettings = useCallback(() => {
    setSettingsVisible(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsVisible(false);
  }, []);

  const handleEmptyWorkbenchCreateCard = useCallback(() => {
    void (async () => {
      if (!workspaceService.getState().rootPath) {
        await workspaceService.initialize();
      }
      await workspaceService.createCard(formatMessage('file.untitled_card'));
    })().catch((error) => {
      console.error('[WorkspaceScene] Failed to create card from the workbench empty state.', error);
    });
  }, []);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;
    let active = true;

    void bootEditingEngine({
      client,
      windows,
      createToolWindow,
      t: formatMessage,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      setState: (nextState) => {
        if (active) {
          setState(nextState);
        }
      },
    }).catch((error) => {
      console.error('[WorkspaceScene] Unexpected init error:', error);
      if (active) {
        setState('ready');
      }
    });

    const unsubscribeInstalledBasecards = subscribeInstalledBasecardRefresh(client);

    return () => {
      active = false;
      unsubscribeInstalledBasecards();
    };
  }, [client, createToolWindow, setState, windows]);

  useEffect(() => {
    const localizedToolTitles: Record<string, string> = {
      FileManager: '文件管理器',
      EditPanel: '编辑面板',
      CardBoxLibrary: '卡箱库',
    };

    windows.forEach((window) => {
      if (window.type !== 'tool') {
        return;
      }
      const nextTitle = localizedToolTitles[window.component];
      if (!nextTitle || window.title === nextTitle) {
        return;
      }
      updateWindow(window.id, { title: nextTitle });
    });
  }, [updateWindow, windows]);

  useEffect(() => {
    windows.forEach((window) => {
      if (window.type !== 'card') {
        return;
      }

      const nextTitle = openCards.get(window.cardId)?.metadata.name?.trim() || '无标题卡片';
      if (window.title === nextTitle) {
        return;
      }

      updateWindow(window.id, { title: nextTitle });
    });
  }, [openCards, updateWindow, windows]);

  useEffect(() => {
    const handleOpenWorkspaceFile = async (payload: {
      file?: { id?: string; path?: string; type?: string; name?: string };
      openOptions?: WorkspaceOpenOptions;
    }) => {
      const file = payload.file;
      if (!file || typeof file.id !== 'string' || typeof file.path !== 'string') {
        return;
      }

      if (file.type === 'card') {
        await openCard(file.id, file.path);
        selectCard(file.id, null);
        const existingWindow = windows.find((window) => window.type === 'card' && window.cardId === file.id);
        if (existingWindow) {
          const updates: Record<string, unknown> = {};

          if (payload.openOptions?.windowPosition) {
            updates.position = payload.openOptions.windowPosition;
          }

          if (typeof payload.openOptions?.isEditing === 'boolean') {
            updates.isEditing = payload.openOptions.isEditing;
          }

          if (existingWindow.state !== 'normal') {
            updates.state = 'normal';
          }

          if (Object.keys(updates).length > 0) {
            updateWindow(existingWindow.id, updates);
          }

          focusWindow(existingWindow.id);
          return;
        }

        createCardWindow(file.id, {
          title: file.name ?? file.path.split('/').pop() ?? file.id,
          isEditing: payload.openOptions?.isEditing ?? true,
          position: payload.openOptions?.windowPosition,
        });
        return;
      }

      if (file.type === 'box') {
        selectBox(file.id);
        const existingWindow = windows.find((window) => window.type === 'box' && window.boxId === file.id);
        if (existingWindow) {
          const updates: Record<string, unknown> = {
            boxPath: file.path,
            title: file.name ?? existingWindow.title,
          };
          if (payload.openOptions?.windowPosition) {
            updates.position = payload.openOptions.windowPosition;
          }
          if (existingWindow.state !== 'normal') {
            updates.state = 'normal';
          }
          updateWindow(existingWindow.id, updates);
          focusWindow(existingWindow.id);
          return;
        }

        createBoxWindow(file.id, file.path, {
          title: file.name ?? file.path.split('/').pop() ?? file.id,
          position: payload.openOptions?.windowPosition,
        });
      }
    };

    const handleOpenWorkspaceFileSafe = (payload: {
      file?: { id?: string; path?: string; type?: string; name?: string };
      openOptions?: WorkspaceOpenOptions;
    }) => {
      void handleOpenWorkspaceFile(payload).catch((error) => {
        console.error('[WorkspaceScene] Failed to open created/opened workspace card.', {
          file: payload.file,
          error,
        });
      });
    };

    workspaceService.on('workspace:file-opened', handleOpenWorkspaceFileSafe);
    workspaceService.on('workspace:file-created', handleOpenWorkspaceFileSafe);

    return () => {
      workspaceService.off('workspace:file-opened', handleOpenWorkspaceFileSafe);
      workspaceService.off('workspace:file-created', handleOpenWorkspaceFileSafe);
    };
  }, [createBoxWindow, createCardWindow, focusWindow, openCard, selectBox, selectCard, updateWindow, windows]);

  useEffect(() => {
    const handleWorkspaceFileRenamed = (payload: {
      file?: { id?: string; type?: string; name?: string; path?: string };
    }) => {
      const file = payload.file;
      if (!file || file.type !== 'box' || typeof file.id !== 'string') {
        return;
      }

      const window = windows.find((item): item is BoxWindowConfig => item.type === 'box' && item.boxId === file.id);
      if (!window) {
        return;
      }

      updateWindow(window.id, {
        title: file.name ?? window.title,
        boxPath: file.path ?? window.boxPath,
      });
    };

    workspaceService.on('workspace:file-renamed', handleWorkspaceFileRenamed);
    return () => {
      workspaceService.off('workspace:file-renamed', handleWorkspaceFileRenamed);
    };
  }, [updateWindow, windows]);

  const handleResolveCanvasDropTarget = useCallback((options: {
    dragData: DragData | null;
    eventTarget: EventTarget | null;
    screenPosition: { x: number; y: number };
    worldPosition: { x: number; y: number };
  }) => {
    void options.worldPosition;

    return resolveBoxEntryImportDropTarget({
      dragData: options.dragData,
      eventTarget: options.eventTarget,
      screenPosition: options.screenPosition,
    }) ?? resolveCompositeCardDropTarget({
      dragData: options.dragData,
      eventTarget: options.eventTarget,
      screenPosition: options.screenPosition,
      openCards,
    });
  }, [openCards]);

  const handleCanvasDropCreate = useCallback(async (
    data: DragData,
    worldPosition: { x: number; y: number },
    target?: CanvasDropTarget | null,
  ) => {
    if (data.type === 'card' && target?.type === 'composite-card-insert') {
      const targetWindow = windows.find((window) => window.type === 'card' && window.cardId === target.cardId);
      if (targetWindow) {
        focusWindow(targetWindow.id);
      }

      setActiveCard(target.cardId);
      const nextBasicCard = await addBasicCard(
        target.cardId,
        data.typeId,
        createInitialBasicCardPayload(data.typeId),
        target.insertionIndex,
      );
      if (nextBasicCard) {
        setSelectedBaseCard(nextBasicCard.id);
        selectCard(target.cardId, nextBasicCard.id);
      }
      return;
    }

    if (data.type === 'workspace-file' && target?.type === 'box-entry-import') {
      const targetWindow = windows.find((window): window is BoxWindowConfig => window.type === 'box' && window.boxId === target.boxId);
      if (!targetWindow) {
        return;
      }

      focusWindow(targetWindow.id);
      selectBox(target.boxId);
      await boxDocumentService.openBox(
        targetWindow.boxPath,
        workspaceService.getState().rootPath,
        target.boxId,
      );
      await boxDocumentService.importDocumentFiles(target.boxId, [data.filePath]);
      return;
    }

    if (!workspaceService.getState().rootPath) {
      await workspaceService.initialize();
      if (!workspaceService.getState().rootPath) {
        console.warn('[WorkspaceScene] Cannot create card from library drag because Host has not bound a workspace path.');
        return;
      }
    }

    if (data.type === 'card') {
      const cardName = data.name.trim() || '未命名卡片';
      await workspaceService.createCard(
        cardName,
        createInitialBasicCard(data.typeId),
        undefined,
        undefined,
        {
          windowPosition: worldPosition,
          isEditing: true,
        },
      );
      return;
    }

    if (data.type === 'workspace-file') {
      workspaceService.openFile(data.fileId, {
        windowPosition: worldPosition,
        isEditing: true,
      });
      return;
    }

    if (data.type === 'layout') {
      await workspaceService.createBox(
        data.name.trim() || '未命名盒子',
        data.typeId || DEFAULT_BOX_LAYOUT_TYPE,
        undefined,
        {
          windowPosition: worldPosition,
          isEditing: true,
        },
      );
    }
  }, [
    addBasicCard,
    focusWindow,
    setActiveCard,
    setSelectedBaseCard,
    selectBox,
    selectCard,
    windows,
  ]);

  return (
    <EditingEngineCommandProvider openSettings={openSettings}>
      {state === 'ready' ? (
        <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
          <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
            {currentLayout === 'infinite-canvas' ? (
              <InfiniteCanvas
                onDropCreate={handleCanvasDropCreate}
                resolveDropTarget={handleResolveCanvasDropTarget}
              />
            ) : (
              <Workbench
                emptyActionsSlot={
                  <Button type="primary" size="small" onClick={handleEmptyWorkbenchCreateCard}>
                    新建卡片
                  </Button>
                }
              />
            )}
            <Dock onOpenSettings={openSettings} />
          </div>

          {settingsVisible && (
            <Suspense fallback={null}>
              <EngineSettingsDialog
                visible={settingsVisible}
                onClose={closeSettings}
              />
            </Suspense>
          )}
        </div>
      ) : (
        <div
          role="status"
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <Spin size="large" />
          <span style={{ color: '#86868b', fontSize: 14 }}>正在加载工作区…</span>
        </div>
      )}
    </EditingEngineCommandProvider>
  );
}
