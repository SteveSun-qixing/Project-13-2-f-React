import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Tabs } from 'antd';
import { type BoxEntrySnapshot, type BoxLayoutDescriptor, type FrameRenderResult } from 'chips-sdk';
import { useBoxDocumentSession } from '../../hooks/useBoxDocumentSession';
import { useBoxLayoutDefinition } from '../../hooks/useBoxLayoutDefinition';
import { usePointerSortableList } from '../DragDrop/usePointerSortableList';
import { boxDocumentService } from '../../services/box-document-service';
import { getChipsClient } from '../../services/bridge-client';
import './BoxEditorPanel.css';

interface BoxLayoutEditorSlotProps {
  boxId: string;
  entries: BoxEntrySnapshot[];
  layoutDefinition: BoxLayoutDescriptor | null;
  activeLayoutType: string;
  activeLayoutConfig: Record<string, unknown> | null;
  locale?: string;
}

function BoxLayoutEditorSlot({
  boxId,
  entries,
  layoutDefinition,
  activeLayoutType,
  activeLayoutConfig,
  locale,
}: BoxLayoutEditorSlotProps) {
  const client = useMemo(() => getChipsClient(), []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameResultRef = useRef<FrameRenderResult | null>(null);
  const runtimeStateRef = useRef({
    boxId,
    activeLayoutType,
  });
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const entrySignature = useMemo(
    () => entries.map((entry) => `${entry.entryId}:${entry.enabled ? '1' : '0'}`).join('|'),
    [entries],
  );
  const layoutDefinitionType = layoutDefinition?.layoutType ?? null;

  useEffect(() => {
    runtimeStateRef.current = {
      boxId,
      activeLayoutType,
    };
  }, [activeLayoutType, boxId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.replaceChildren();
    setRuntimeError(null);

    if (!layoutDefinition || !activeLayoutConfig) {
      return;
    }

    let disposed = false;
    const cleanupTasks: Array<() => void> = [];

    void client.box.editorPanel.render({
      layoutType: activeLayoutType,
      entries,
      initialConfig: activeLayoutConfig,
      locale,
      resources: {
        readBoxAsset(assetPath) {
          return boxDocumentService.readBoxAsset(boxId, assetPath);
        },
        importBoxAsset(input) {
          return boxDocumentService.importBoxAsset(boxId, input);
        },
        deleteBoxAsset(assetPath) {
          return boxDocumentService.deleteBoxAsset(boxId, assetPath);
        },
      },
    }).then((result) => {
      if (disposed) {
        void result.dispose().catch(() => undefined);
        return;
      }

      frameResultRef.current = result;
      result.frame.style.width = '100%';
      result.frame.style.height = '100%';
      result.frame.style.border = 'none';
      result.frame.style.display = 'block';
      container.appendChild(result.frame);

      cleanupTasks.push(
        client.box.editorPanel.onChange(result.frame, (payload) => {
          const current = runtimeStateRef.current;
          void client.box.normalizeLayoutConfig(current.activeLayoutType, payload.config)
            .then((normalized) => {
              boxDocumentService.updateLayoutConfig(current.boxId, current.activeLayoutType, normalized);
            })
            .catch((error) => {
              setRuntimeError(error instanceof Error ? error.message : String(error));
            });
        }),
      );
      cleanupTasks.push(
        client.box.editorPanel.onError(result.frame, (payload) => {
          setRuntimeError(payload.message);
        }),
      );
    }).catch((error) => {
      if (!disposed) {
        setRuntimeError(error instanceof Error ? error.message : String(error));
      }
    });

    return () => {
      disposed = true;
      cleanupTasks.forEach((task) => task());
      const frameResult = frameResultRef.current;
      frameResultRef.current = null;
      void frameResult?.dispose().catch(() => undefined);
      container.replaceChildren();
    };
  }, [activeLayoutType, boxId, client, entrySignature, layoutDefinitionType, locale]);

  return (
    <div className="box-editor-panel__layout-slot">
      <div ref={containerRef} className="box-editor-panel__layout-editor" />
      {runtimeError ? (
        <div className="box-editor-panel__state box-editor-panel__state--error">{runtimeError}</div>
      ) : null}
    </div>
  );
}

export interface BoxEditorPanelProps {
  boxId: string;
  boxPath: string;
}

export function BoxEditorPanel({
  boxId,
  boxPath,
}: BoxEditorPanelProps) {
  const client = useMemo(() => getChipsClient(), []);
  const { session, isLoading, error } = useBoxDocumentSession(boxId, boxPath);
  const activeLayoutType = session?.content.activeLayoutType ?? session?.metadata.activeLayoutType ?? null;
  const { layoutDefinition, error: layoutError } = useBoxLayoutDefinition(activeLayoutType);
  const [activeTab, setActiveTab] = useState('config');

  useEffect(() => {
    setActiveTab('config');
  }, [boxId]);

  const activeLayoutConfig = useMemo(() => {
    if (!session || !activeLayoutType) {
      return null;
    }
    return session.content.layoutConfigs[activeLayoutType] ?? layoutDefinition?.defaultConfig ?? null;
  }, [activeLayoutType, layoutDefinition, session]);

  const sortableEntries = useMemo(() => (
    session?.entries.map((entry) => ({
      id: entry.entryId,
      label: entry.snapshot.title || entry.snapshot.documentId || entry.entryId,
    })) ?? []
  ), [session?.entries]);

  const {
    draggingItemId,
    overlay,
    previewIndex,
    setItemRef,
    startDrag,
  } = usePointerSortableList({
    items: sortableEntries,
    onSort(entryId, targetIndex) {
      if (!session) {
        return;
      }
      boxDocumentService.moveEntryToIndex(session.boxId, entryId, targetIndex);
    },
  });

  const handleImportDocuments = async () => {
    if (!session) {
      return;
    }

    const filePaths = await client.platform.openFile({
      allowMultiple: true,
      title: '选择要导入的卡片或箱子',
    });

    if (!filePaths || filePaths.length === 0) {
      return;
    }

    await boxDocumentService.importDocumentFiles(session.boxId, filePaths);
  };

  if (isLoading) {
    return <div className="box-editor-panel__state">正在加载箱子...</div>;
  }

  if (error) {
    return <div className="box-editor-panel__state box-editor-panel__state--error">{error}</div>;
  }

  if (!session) {
    return <div className="box-editor-panel__state">箱子会话不可用</div>;
  }

  return (
    <div className="box-editor-panel">
      <Tabs
        activeKey={activeTab}
        onChange={(value: string) => setActiveTab(value)}
        items={[
          {
            key: 'config',
            label: '配置',
            children: (
              <div className="box-editor-panel__tab-content box-editor-panel__tab-content--layout">
                <div className="box-editor-panel__section-header">
                  <h3 className="box-editor-panel__section-title">布局配置</h3>
                  <span className="box-editor-panel__layout-type">
                    {layoutDefinition?.displayName ?? activeLayoutType ?? ''}
                  </span>
                </div>
                {layoutError ? (
                  <div className="box-editor-panel__state box-editor-panel__state--error">{layoutError}</div>
                ) : (
                  <BoxLayoutEditorSlot
                    boxId={session.boxId}
                    entries={session.entries}
                    layoutDefinition={layoutDefinition}
                    activeLayoutType={activeLayoutType ?? ''}
                    activeLayoutConfig={activeLayoutConfig}
                    locale="zh-CN"
                  />
                )}
              </div>
            ),
          },
          {
            key: 'content',
            label: '内容列表',
            children: (
              <div className="box-editor-panel__tab-content box-editor-panel__tab-content--content">
                <div className="box-editor-panel__section-header">
                  <h3 className="box-editor-panel__section-title">作品列表</h3>
                  <Button
                    type="default"
                    className="box-editor-panel__action-button"
                    onClick={() => { void handleImportDocuments(); }}
                  >
                    导入作品
                  </Button>
                </div>

                {session.entries.length === 0 ? (
                  <div className="box-editor-panel__empty">
                    把卡片或箱子拖到桌面上的箱子窗口，或者在这里导入作品。
                  </div>
                ) : (
                  <div className="box-editor-panel__entry-list">
                    {previewIndex === 0 && draggingItemId ? (
                      <div className="box-editor-panel__insert-indicator" aria-hidden="true" />
                    ) : null}
                    {session.entries.map((entry, index) => {
                      const title = entry.snapshot.title || entry.snapshot.documentId || entry.entryId;

                      return (
                        <React.Fragment key={entry.entryId}>
                          <div
                            ref={(node) => setItemRef(entry.entryId, node)}
                            className={[
                              'box-editor-panel__entry',
                              draggingItemId === entry.entryId ? 'box-editor-panel__entry--dragging' : '',
                            ].join(' ')}
                          >
                            <div className="box-editor-panel__entry-body">
                              <strong className="box-editor-panel__entry-title">
                                {title}
                              </strong>
                            </div>

                            <div className="box-editor-panel__entry-actions">
                              <Button
                                type="default"
                                danger
                                className="box-editor-panel__delete-button"
                                onClick={() => {
                                  boxDocumentService.removeEntry(session.boxId, entry.entryId);
                                }}
                              >
                                删除
                              </Button>
                              <Button
                                type="default"
                                className="box-editor-panel__drag-handle"
                                onPointerDown={(event) => startDrag(entry.entryId, event)}
                              >
                                调整
                              </Button>
                            </div>
                          </div>
                          {previewIndex === index + 1 && draggingItemId ? (
                            <div className="box-editor-panel__insert-indicator" aria-hidden="true" />
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
      {overlay && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="box-editor-panel__drag-overlay"
            style={{
              width: `${overlay.width}px`,
              height: `${overlay.height}px`,
              transform: `translate3d(${overlay.x}px, ${overlay.y}px, 0)`,
            }}
          >
            <div className="box-editor-panel__drag-overlay-surface">{overlay.label}</div>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
