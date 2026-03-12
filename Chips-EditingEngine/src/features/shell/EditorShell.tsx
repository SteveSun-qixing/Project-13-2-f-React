import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChipsButton, ChipsEmptyState } from "@chips/component-library";
import type { Client } from "chips-sdk";
import { useEditorPanel } from "../../app/providers/editor-panel-context";
import { useEditorRuntime } from "../../app/providers/editor-runtime-context";
import { useWorkspaceSession } from "../../app/providers/workspace-session-context";
import { createCardPackageService, type AvailableBaseCardType } from "../../domains/card-package/card-package-service";
import {
  closeWindow,
  createInitialLegacyWindowShellState,
  ensureToolWindows,
  focusWindow,
  getActiveDocumentWindow,
  getDockWindows,
  getDocumentStructureLength,
  getDocumentWindow,
  getDocumentWindows,
  getToolWindow,
  getVisibleCanvasWindows,
  moveWindow,
  panCanvas,
  resetCanvas,
  resizeWindow,
  setDocumentEditing,
  setLayoutMode as setLegacyLayoutMode,
  setWindowState,
  syncDocumentWindows,
  zoomCanvas,
  type EditingEngineWindowConfig,
  type LegacyToolComponent,
  type LegacyToolWindowTitles,
  type LegacyViewport,
} from "../../domains/legacy-shell/legacy-window-state";
import type { BaseCardEditorSessionSnapshot } from "../../domains/editor/types";
import type { WorkspaceDocument } from "../../domains/workspace/types";
import { detectWorkspaceDocumentKind } from "../../domains/workspace/workspace-service";
import { getEditorPanelWidthPx } from "../../domains/editor-panel/editor-panel-state-service";
import { BaseCardWorkbench } from "../editor/BaseCardWorkbench";
import { EditorSettingsDialog } from "../settings/EditorSettingsDialog";
import { WorkspaceRepositoryTree } from "./WorkspaceRepositoryTree";
import { createTranslator } from "../../shared/runtime/editor-i18n";
import { getLaunchTargetPath, getVisibleThemes } from "../../shared/runtime/editor-runtime-service";
import "./editor-shell.css";
import "./legacy-shell.css";

const CARD_LIBRARY_MIME = "application/x-chips-base-card";

interface FloatingWindowProps {
  windowConfig: EditingEngineWindowConfig;
  active: boolean;
  children: ReactNode;
  badge?: string;
  onFocus(): void;
  onMove(position: { x: number; y: number }): void;
  onResize(size: { width: number; height: number }): void;
  onMinimize?(): void;
  onClose?(): void;
}

function FloatingWindow(props: FloatingWindowProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; originX: number; originY: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (
        width !== props.windowConfig.size.width ||
        height !== props.windowConfig.size.height
      ) {
        props.onResize({ width, height });
      }
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [props, props.windowConfig.size.height, props.windowConfig.size.width]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      props.onMove({
        x: Math.round(dragState.startX + event.clientX - dragState.originX),
        y: Math.round(dragState.startY + event.clientY - dragState.originY),
      });
    },
    [props],
  );

  const stopDragging = useCallback(() => {
    if (!dragStateRef.current) {
      return;
    }
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
    dragStateRef.current = null;
  }, [handlePointerMove]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!(props.windowConfig.draggable ?? false)) {
        return;
      }
      if ((event.target as HTMLElement).closest("button")) {
        return;
      }
      props.onFocus();
      dragStateRef.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        startX: props.windowConfig.position.x,
        startY: props.windowConfig.position.y,
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopDragging);
    },
    [handlePointerMove, props, stopDragging],
  );

  useEffect(() => stopDragging, [stopDragging]);

  const style = useMemo(
    () =>
      ({
        left: props.windowConfig.position.x,
        top: props.windowConfig.position.y,
        width: props.windowConfig.size.width,
        height: props.windowConfig.state === "minimized" ? 52 : props.windowConfig.size.height,
        zIndex: props.windowConfig.zIndex,
      }) satisfies CSSProperties,
    [props.windowConfig],
  );

  return (
    <section
      ref={elementRef}
      className={`legacy-shell__floating-window ${props.active ? "legacy-shell__floating-window--active" : ""}`}
      style={style}
      onMouseDown={props.onFocus}
    >
      <header className="legacy-shell__floating-header" onPointerDown={handlePointerDown}>
        <div className="legacy-shell__floating-title">
          <strong>{props.windowConfig.title}</strong>
          {props.badge ? <span>{props.badge}</span> : null}
        </div>
        <div className="legacy-shell__floating-actions">
          {props.windowConfig.minimizable !== false && props.onMinimize ? (
            <button type="button" aria-label="minimize" onClick={props.onMinimize}>
              -
            </button>
          ) : null}
          {props.windowConfig.closable !== false && props.onClose ? (
            <button type="button" aria-label="close" onClick={props.onClose}>
              x
            </button>
          ) : null}
        </div>
      </header>
      {props.windowConfig.state === "minimized" ? null : <div className="legacy-shell__floating-content">{props.children}</div>}
    </section>
  );
}

function BoxDocumentStage(props: { document: WorkspaceDocument; translate(key: string): string; onRefresh(): Promise<void>; onClose(): void }) {
  return (
    <div className="editor-shell__document-stage">
      <div className="editor-shell__preview-actions">
        <ChipsButton variant="secondary" onPress={() => void props.onRefresh()}>
          {props.translate("editingEngine.actions.refreshDocument")}
        </ChipsButton>
        <ChipsButton variant="secondary" onPress={props.onClose}>
          {props.translate("editingEngine.actions.closeDocument")}
        </ChipsButton>
      </div>
      <div className="legacy-shell__box-panel">
        <strong>{props.translate("editingEngine.documents.box")}</strong>
        <span>{props.document.path}</span>
      </div>
    </div>
  );
}

function QuickCardLibrary(props: {
  activeDocument: WorkspaceDocument | null;
  cardTypes: AvailableBaseCardType[];
  structureBusy: boolean;
  translate(key: string): string;
  onAdd(cardType: string, targetDocument?: WorkspaceDocument | null): Promise<void>;
}) {
  return (
    <div className="legacy-shell__panel-stack">
      <div className="legacy-shell__panel-header legacy-shell__panel-header--tight">
        <div>
          <h3>{props.translate("editingEngine.legacy.cardLibraryTitle")}</h3>
          <p>{props.translate("editingEngine.legacy.cardLibraryDescription")}</p>
        </div>
      </div>
      {props.cardTypes.length === 0 ? (
        <div className="legacy-shell__muted-card">{props.translate("editingEngine.legacy.cardLibraryEmpty")}</div>
      ) : (
        <div className="legacy-shell__library-grid">
          {props.cardTypes.map((item) => (
            <button
              key={`${item.pluginId}:${item.cardType}`}
              type="button"
              className="legacy-shell__library-item"
              draggable={Boolean(props.activeDocument && props.activeDocument.kind === "card")}
              onDragStart={(event) => {
                event.dataTransfer.setData(CARD_LIBRARY_MIME, item.cardType);
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => {
                void props.onAdd(item.cardType, props.activeDocument);
              }}
              disabled={props.structureBusy || props.activeDocument?.kind !== "card"}
            >
              <strong>{item.pluginName}</strong>
              <span>{item.cardType}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InspectorPanel(props: {
  snapshot: ReturnType<typeof useEditorRuntime>["snapshot"];
  activeDocument: WorkspaceDocument | null;
  editorSessionSnapshot: BaseCardEditorSessionSnapshot | null;
  translate(key: string): string;
  onOpenSettings(): void;
  onRefreshDocument(): Promise<void>;
}) {
  const editorPanel = useEditorPanel();
  const panelWidth = getEditorPanelWidthPx(editorPanel.state.widthPreset);
  return (
    <div className="legacy-shell__panel-stack">
      <div className="legacy-shell__panel-header legacy-shell__panel-header--tight">
        <div>
          <h3>{props.translate("editingEngine.legacy.editPanelTitle")}</h3>
          <p>{props.translate("editingEngine.legacy.editPanelDescription")}</p>
        </div>
        <div className="legacy-shell__inline-actions">
          <ChipsButton variant="secondary" onPress={() => void props.onRefreshDocument()}>
            {props.translate("editingEngine.actions.refreshDocument")}
          </ChipsButton>
          <ChipsButton variant="secondary" onPress={props.onOpenSettings}>
            {props.translate("editingEngine.actions.openSettings")}
          </ChipsButton>
        </div>
      </div>
      <dl className="editor-shell__detail-list editor-shell__detail-list--compact">
        <div>
          <span>{props.translate("editingEngine.fields.documentName")}</span>
          <strong>{props.activeDocument?.title ?? props.translate("editingEngine.values.notAvailable")}</strong>
        </div>
        <div>
          <span>{props.translate("editingEngine.fields.documentPath")}</span>
          <strong>{props.activeDocument?.path ?? props.translate("editingEngine.values.notAvailable")}</strong>
        </div>
        <div>
          <span>{props.translate("editingEngine.fields.selectedBaseCard")}</span>
          <strong>
            {props.editorSessionSnapshot?.selectedNode?.title ??
              props.editorSessionSnapshot?.selectedNode?.nodeId ??
              props.translate("editingEngine.values.notAvailable")}
          </strong>
        </div>
        <div>
          <span>{props.translate("editingEngine.fields.editorSaveState")}</span>
          <strong>{props.translate(`editingEngine.editorState.${props.editorSessionSnapshot?.saveState ?? "idle"}`)}</strong>
        </div>
        <div>
          <span>{props.translate("editingEngine.fields.editorDirtyState")}</span>
          <strong>
            {props.editorSessionSnapshot?.dirty
              ? props.translate("editingEngine.editor.dirty")
              : props.translate("editingEngine.editor.clean")}
          </strong>
        </div>
        <div>
          <span>{props.translate("editingEngine.legacy.editorPanelWidth")}</span>
          <strong>{`${panelWidth}px`}</strong>
        </div>
        <div>
          <span>{props.translate("editingEngine.fields.locale")}</span>
          <strong>{props.snapshot?.locale ?? props.translate("editingEngine.values.notAvailable")}</strong>
        </div>
      </dl>
    </div>
  );
}

function DocumentSurface(props: {
  client: Client;
  document: WorkspaceDocument;
  translate(key: string): string;
  onRefresh(): Promise<void>;
  onClose(): void;
  onSessionStateChange(snapshot: BaseCardEditorSessionSnapshot): void;
  onDropBaseCard(cardType: string, target: WorkspaceDocument): Promise<void>;
}) {
  const droppable = props.document.kind === "card";
  return (
    <div
      className={`legacy-shell__document-surface ${droppable ? "legacy-shell__document-surface--droppable" : ""}`}
      onDragOver={(event) => {
        if (!droppable) {
          return;
        }
        if (event.dataTransfer.types.includes(CARD_LIBRARY_MIME)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        if (!droppable) {
          return;
        }
        const cardType = event.dataTransfer.getData(CARD_LIBRARY_MIME);
        if (!cardType) {
          return;
        }
        event.preventDefault();
        void props.onDropBaseCard(cardType, props.document);
      }}
    >
      {props.document.kind === "card" ? (
        <BaseCardWorkbench
          client={props.client}
          document={props.document}
          translate={props.translate}
          onRefresh={props.onRefresh}
          onClose={props.onClose}
          onSessionStateChange={props.onSessionStateChange}
        />
      ) : (
        <BoxDocumentStage
          document={props.document}
          translate={props.translate}
          onRefresh={props.onRefresh}
          onClose={props.onClose}
        />
      )}
    </div>
  );
}

export function EditorShell() {
  const editorPanel = useEditorPanel();
  const { snapshot, loading, busyAction, error, refresh, setTheme, setLocale, setLayoutMode } = useEditorRuntime();
  const {
    activeDocument,
    activeDocumentId,
    documents,
    recentTargets,
    repositoryRoots,
    busy: workspaceBusy,
    error: workspaceError,
    repositoryLoading,
    repositoryError,
    openDocument,
    openDocumentFromDialog,
    activateDocument,
    closeDocument,
    refreshActiveDocument,
    refreshRepository,
    clearRecentTargets,
  } = useWorkspaceSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorSessionSnapshot, setEditorSessionSnapshot] = useState<BaseCardEditorSessionSnapshot | null>(null);
  const [cardTypes, setCardTypes] = useState<AvailableBaseCardType[]>([]);
  const [structureBusy, setStructureBusy] = useState(false);
  const [viewport, setViewport] = useState<LegacyViewport>(() => ({
    width: typeof window === "undefined" ? 1440 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  }));
  const translate = useMemo(() => createTranslator(snapshot?.locale ?? "zh-CN"), [snapshot?.locale]);
  const [windowState, setWindowStateValue] = useState(() => createInitialLegacyWindowShellState("workbench"));
  const canvasPanRef = useRef<{ originX: number; originY: number; panX: number; panY: number } | null>(null);

  const toolTitles = useMemo<LegacyToolWindowTitles>(
    () => ({
      fileManager: translate("editingEngine.legacy.fileManagerTitle"),
      editPanel: translate("editingEngine.legacy.editPanelTitle"),
      cardLibrary: translate("editingEngine.legacy.cardLibraryTitle"),
    }),
    [translate],
  );

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setWindowStateValue((current) => {
      let next = setLegacyLayoutMode(current, snapshot.preferredLayout);
      next = ensureToolWindows(next, viewport, toolTitles);
      next = syncDocumentWindows(next, documents);
      if (activeDocumentId) {
        const windowConfig = getDocumentWindow(next.windowList, activeDocumentId);
        if (windowConfig) {
          next = focusWindow(next, windowConfig.id);
        }
      }
      return next;
    });
  }, [activeDocumentId, documents, snapshot, toolTitles, viewport]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const service = createCardPackageService(snapshot.client);
    let cancelled = false;
    const load = async () => {
      const nextCardTypes = await service.listAvailableBaseCardTypes();
      if (!cancelled) {
        setCardTypes(nextCardTypes);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  const visibleThemes = useMemo(() => getVisibleThemes(snapshot?.availableThemes ?? []), [snapshot?.availableThemes]);
  const launchTargetPath = useMemo(() => (snapshot ? getLaunchTargetPath(snapshot) : null), [snapshot]);
  const documentMap = useMemo(() => new Map(documents.map((document) => [document.id, document])), [documents]);
  const documentWindows = useMemo(() => getDocumentWindows(windowState.windowList), [windowState.windowList]);
  const activeWindow = useMemo(
    () => getActiveDocumentWindow(windowState.windowList, windowState.focusedWindowId, activeDocumentId),
    [activeDocumentId, windowState.focusedWindowId, windowState.windowList],
  );
  const activeWindowDocument = activeWindow ? documentMap.get(activeWindow.documentId) ?? null : activeDocument;
  const fileManagerWindow = useMemo(() => getToolWindow(windowState.windowList, "FileManager"), [windowState.windowList]);
  const editPanelWindow = useMemo(() => getToolWindow(windowState.windowList, "EditPanel"), [windowState.windowList]);
  const cardLibraryWindow = useMemo(() => getToolWindow(windowState.windowList, "CardBoxLibrary"), [windowState.windowList]);
  const dockWindows = useMemo(() => getDockWindows(windowState.windowList), [windowState.windowList]);
  const visibleCanvasWindows = useMemo(() => getVisibleCanvasWindows(windowState.windowList), [windowState.windowList]);

  const focusDocument = useCallback(
    (documentId: string) => {
      const windowConfig = getDocumentWindow(windowState.windowList, documentId);
      activateDocument(documentId);
      if (windowConfig) {
        setWindowStateValue((current) => focusWindow(current, windowConfig.id));
      }
    },
    [activateDocument, windowState.windowList],
  );

  const handleSetLayoutMode = useCallback(
    async (layoutMode: "infinite-canvas" | "workbench") => {
      await setLayoutMode(layoutMode);
      setWindowStateValue((current) => setLegacyLayoutMode(current, layoutMode));
    },
    [setLayoutMode],
  );

  const handleAddBaseCard = useCallback(
    async (cardType: string, targetDocument = activeWindowDocument) => {
      if (!snapshot || !targetDocument || targetDocument.kind !== "card") {
        return;
      }
      setStructureBusy(true);
      try {
        const service = createCardPackageService(snapshot.client);
        await service.addBaseCard({
          cardFile: targetDocument.path,
          cardType,
          insertIndex: getDocumentStructureLength(targetDocument),
        });
        await openDocument(targetDocument.path);
      } finally {
        setStructureBusy(false);
      }
    },
    [activeWindowDocument, openDocument, snapshot],
  );

  const handleWindowFocus = useCallback(
    (windowId: string) => {
      const windowConfig = windowState.windowList.find((item) => item.id === windowId);
      if (!windowConfig) {
        return;
      }
      setWindowStateValue((current) => focusWindow(current, windowId));
      if (windowConfig.type === "card") {
        activateDocument(windowConfig.documentId);
      }
    },
    [activateDocument, windowState.windowList],
  );

  const handleDocumentRefresh = useCallback(
    async (document: WorkspaceDocument) => {
      await openDocument(document.path);
    },
    [openDocument],
  );

  const handleCloseWindow = useCallback(
    async (windowConfig: EditingEngineWindowConfig) => {
      if (windowConfig.type === "card") {
        closeDocument(windowConfig.documentId);
      }
      setWindowStateValue((current) => closeWindow(current, windowConfig.id));
    },
    [closeDocument],
  );

  const handleToggleWindowMinimized = useCallback((windowConfig: EditingEngineWindowConfig) => {
    setWindowStateValue((current) =>
      setWindowState(current, windowConfig.id, windowConfig.state === "minimized" ? "normal" : "minimized"),
    );
  }, []);

  const handleCanvasWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (windowState.layoutMode !== "infinite-canvas") {
      return;
    }
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      setWindowStateValue((current) => zoomCanvas(current, event.deltaY > 0 ? -0.08 : 0.08));
      return;
    }
    setWindowStateValue((current) => panCanvas(current, -event.deltaX, -event.deltaY));
  }, [windowState.layoutMode]);

  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    canvasPanRef.current = {
      originX: event.clientX,
      originY: event.clientY,
      panX: windowState.canvas.panX,
      panY: windowState.canvas.panY,
    };
  }, [windowState.canvas.panX, windowState.canvas.panY]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const panState = canvasPanRef.current;
      if (!panState) {
        return;
      }
      setWindowStateValue((current) => ({
        ...current,
        canvas: {
          ...current.canvas,
          panX: Math.round(panState.panX + event.clientX - panState.originX),
          panY: Math.round(panState.panY + event.clientY - panState.originY),
        },
      }));
    };
    const stop = () => {
      canvasPanRef.current = null;
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stop);
    };
  }, []);

  const renderToolWindowContent = useCallback(
    (component: LegacyToolComponent) => {
      if (component === "FileManager") {
        return (
          <div className="legacy-shell__tool-body">
            <WorkspaceRepositoryTree
              roots={repositoryRoots}
              loading={repositoryLoading}
              error={repositoryError}
              activeDocumentPath={activeWindowDocument?.path ?? null}
              emptyTitle={translate("editingEngine.workspace.emptyTitle")}
              emptyDescription={translate("editingEngine.workspace.emptyDescription")}
              retryLabel={translate("editingEngine.actions.refreshWorkspace")}
              openFolderLabel={translate("editingEngine.actions.openDocument")}
              onOpenDocument={openDocument}
              onOpenDocumentFromDialog={openDocumentFromDialog}
              onRefresh={refreshRepository}
            />
            {recentTargets.length > 0 ? (
              <div className="legacy-shell__recent-card">
                <div className="legacy-shell__panel-header legacy-shell__panel-header--tight">
                  <div>
                    <h3>{translate("editingEngine.workspace.recent")}</h3>
                    <p>{translate("editingEngine.legacy.recentDescription")}</p>
                  </div>
                  <ChipsButton variant="secondary" onPress={() => void clearRecentTargets()}>
                    {translate("editingEngine.actions.clearRecentTargets")}
                  </ChipsButton>
                </div>
                <div className="editor-shell__recent-list">
                  {recentTargets.map((item) => (
                    <button
                      key={`${item.path}:${item.openedAt}`}
                      type="button"
                      className="editor-shell__recent-item"
                      onClick={() => {
                        void openDocument(item.path);
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.path}</span>
                      <em>{item.kind}</em>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      }
      if (component === "CardBoxLibrary") {
        return (
          <QuickCardLibrary
            activeDocument={activeWindowDocument}
            cardTypes={cardTypes}
            structureBusy={structureBusy}
            translate={translate}
            onAdd={handleAddBaseCard}
          />
        );
      }
      return (
        <InspectorPanel
          snapshot={snapshot}
          activeDocument={activeWindowDocument}
          editorSessionSnapshot={editorSessionSnapshot}
          translate={translate}
          onOpenSettings={() => setSettingsOpen(true)}
          onRefreshDocument={refreshActiveDocument}
        />
      );
    },
    [
      activeWindowDocument,
      cardTypes,
      clearRecentTargets,
      editorSessionSnapshot,
      handleAddBaseCard,
      openDocument,
      openDocumentFromDialog,
      recentTargets,
      refreshActiveDocument,
      refreshRepository,
      repositoryError,
      repositoryLoading,
      repositoryRoots,
      snapshot,
      structureBusy,
      translate,
    ],
  );

  if (loading || !snapshot) {
    return (
      <div className="editor-shell editor-shell--centered">
        <div className="editor-shell__loading-card">
          <h1>{translate("editingEngine.shell.loadingTitle")}</h1>
          <p>{translate("editingEngine.shell.loadingDescription")}</p>
        </div>
      </div>
    );
  }

  const canvasStyle = {
    transform: `translate(${windowState.canvas.panX}px, ${windowState.canvas.panY}px) scale(${windowState.canvas.zoom})`,
  } satisfies CSSProperties;

  return (
    <div className="legacy-shell">
      <EditorSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        translate={translate}
        snapshot={snapshot}
        visibleThemes={visibleThemes}
        busyAction={busyAction}
        activeDocument={activeWindowDocument}
        recentTargetsCount={recentTargets.length}
        panelState={editorPanel.state}
        panelBusy={editorPanel.busy}
        onSetTheme={setTheme}
        onSetLocale={setLocale}
        onSetLayoutMode={handleSetLayoutMode}
        onClearRecentTargets={clearRecentTargets}
        onSetPanelCollapsed={editorPanel.setCollapsed}
        onSetPanelWidthPreset={editorPanel.setWidthPreset}
        onSetPanelAutoOpen={editorPanel.setAutoOpenOnSelection}
      />

      <header className="legacy-shell__topbar">
        <div className="legacy-shell__brand">
          <span className="legacy-shell__eyebrow">{translate("editingEngine.shell.eyebrow")}</span>
          <div>
            <h1>{snapshot.plugin.name}</h1>
            <p>{translate("editingEngine.legacy.subtitle")}</p>
          </div>
        </div>
        <div className="legacy-shell__actions">
          <ChipsButton variant="primary" disabled={workspaceBusy} onPress={() => void openDocumentFromDialog()}>
            {translate("editingEngine.actions.openDocument")}
          </ChipsButton>
          <ChipsButton
            variant={windowState.layoutMode === "workbench" ? "primary" : "secondary"}
            onPress={() => {
              void handleSetLayoutMode("workbench");
            }}
          >
            {translate("editingEngine.layout.workbench")}
          </ChipsButton>
          <ChipsButton
            variant={windowState.layoutMode === "infinite-canvas" ? "primary" : "secondary"}
            onPress={() => {
              void handleSetLayoutMode("infinite-canvas");
            }}
          >
            {translate("editingEngine.layout.infiniteCanvas")}
          </ChipsButton>
          <ChipsButton variant="secondary" disabled={busyAction === "refresh"} onPress={() => void refresh()}>
            {translate("editingEngine.actions.refresh")}
          </ChipsButton>
          <ChipsButton variant="secondary" onPress={() => setSettingsOpen(true)}>
            {translate("editingEngine.actions.openSettings")}
          </ChipsButton>
        </div>
      </header>

      {error ? <p className="editor-shell__error-banner">{error}</p> : null}
      {workspaceError ? <p className="editor-shell__error-banner">{workspaceError}</p> : null}
      {launchTargetPath ? <p className="legacy-shell__launch-banner">{launchTargetPath}</p> : null}

      {windowState.layoutMode === "workbench" ? (
        <main className="legacy-shell__workbench">
          <aside className="legacy-shell__workbench-side legacy-shell__workbench-side--left">
            {fileManagerWindow ? renderToolWindowContent(fileManagerWindow.component) : null}
            {cardLibraryWindow ? renderToolWindowContent(cardLibraryWindow.component) : null}
          </aside>
          <section className="legacy-shell__workbench-main">
            <div className="legacy-shell__tabs">
              {documentWindows.length === 0 ? (
                <div className="legacy-shell__empty-tab">{translate("editingEngine.workspace.emptyTitle")}</div>
              ) : (
                documentWindows.map((windowConfig) => {
                  const document = documentMap.get(windowConfig.documentId);
                  if (!document) {
                    return null;
                  }
                  return (
                    <div
                      key={windowConfig.id}
                      className={`legacy-shell__tab ${activeWindow?.id === windowConfig.id ? "legacy-shell__tab--active" : ""}`}
                    >
                      <button
                        type="button"
                        className="legacy-shell__tab-main"
                        onClick={() => focusDocument(windowConfig.documentId)}
                      >
                        <strong>{windowConfig.title}</strong>
                        <span>{detectWorkspaceDocumentKind(document.path) ?? document.kind}</span>
                      </button>
                      <button
                        type="button"
                        className="legacy-shell__tab-close"
                        onClick={() => {
                          void handleCloseWindow(windowConfig);
                        }}
                      >
                        x
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="legacy-shell__workbench-stage">
              {activeWindowDocument ? (
                <DocumentSurface
                  client={snapshot.client}
                  document={activeWindowDocument}
                  translate={translate}
                  onRefresh={() => handleDocumentRefresh(activeWindowDocument)}
                  onClose={() => {
                    const windowConfig = getDocumentWindow(windowState.windowList, activeWindowDocument.id);
                    if (windowConfig) {
                      void handleCloseWindow(windowConfig);
                    }
                  }}
                  onSessionStateChange={(sessionSnapshot) => {
                    setEditorSessionSnapshot(sessionSnapshot);
                    setWindowStateValue((current) =>
                      setDocumentEditing(current, activeWindowDocument.id, activeWindowDocument.kind === "card"),
                    );
                  }}
                  onDropBaseCard={handleAddBaseCard}
                />
              ) : (
                <div className="legacy-shell__empty-stage">
                  <ChipsEmptyState
                    ariaLabel={translate("editingEngine.workspace.emptyTitle")}
                    title={translate("editingEngine.workspace.emptyTitle")}
                    description={translate("editingEngine.workspace.emptyDescription")}
                    actionLabel={translate("editingEngine.actions.openDocument")}
                    onAction={() => {
                      void openDocumentFromDialog();
                    }}
                  />
                </div>
              )}
            </div>
          </section>
          <aside className="legacy-shell__workbench-side legacy-shell__workbench-side--right">
            {editPanelWindow ? renderToolWindowContent(editPanelWindow.component) : null}
          </aside>
        </main>
      ) : (
        <main className="legacy-shell__canvas-shell">
          <div
            className="legacy-shell__canvas-board"
            onWheel={handleCanvasWheel}
            onPointerDown={handleCanvasPointerDown}
          >
            <div className="legacy-shell__canvas-grid" />
            <div className="legacy-shell__canvas-stage" style={canvasStyle}>
              {visibleCanvasWindows.map((windowConfig) => {
                const badge = windowConfig.type === "tool" ? translate(`editingEngine.legacy.toolBadge.${windowConfig.component}`) : undefined;
                const content =
                  windowConfig.type === "tool" ? (
                    renderToolWindowContent(windowConfig.component)
                  ) : (
                    documentMap.get(windowConfig.documentId) ? (
                      <DocumentSurface
                        client={snapshot.client}
                        document={documentMap.get(windowConfig.documentId)!}
                        translate={translate}
                        onRefresh={() => handleDocumentRefresh(documentMap.get(windowConfig.documentId)!)}
                        onClose={() => {
                          void handleCloseWindow(windowConfig);
                        }}
                        onSessionStateChange={(sessionSnapshot) => {
                          setEditorSessionSnapshot(sessionSnapshot);
                          activateDocument(windowConfig.documentId);
                        }}
                        onDropBaseCard={handleAddBaseCard}
                      />
                    ) : null
                  );
                return (
                  <FloatingWindow
                    key={windowConfig.id}
                    windowConfig={windowConfig}
                    active={windowState.focusedWindowId === windowConfig.id}
                    badge={badge}
                    onFocus={() => handleWindowFocus(windowConfig.id)}
                    onMove={(position) => {
                      setWindowStateValue((current) => moveWindow(current, windowConfig.id, position));
                    }}
                    onResize={(size) => {
                      setWindowStateValue((current) => resizeWindow(current, windowConfig.id, size));
                    }}
                    onMinimize={() => handleToggleWindowMinimized(windowConfig)}
                    onClose={windowConfig.type === "card" ? () => void handleCloseWindow(windowConfig) : undefined}
                  >
                    {content}
                  </FloatingWindow>
                );
              })}
            </div>
            <div className="legacy-shell__canvas-controls">
              <ChipsButton variant="secondary" onPress={() => setWindowStateValue((current) => zoomCanvas(current, 0.1))}>
                +
              </ChipsButton>
              <span>{Math.round(windowState.canvas.zoom * 100)}%</span>
              <ChipsButton variant="secondary" onPress={() => setWindowStateValue((current) => zoomCanvas(current, -0.1))}>
                -
              </ChipsButton>
              <ChipsButton variant="secondary" onPress={() => setWindowStateValue((current) => resetCanvas(current))}>
                {translate("editingEngine.legacy.resetCanvas")}
              </ChipsButton>
            </div>
            {dockWindows.length > 0 ? (
              <div className="legacy-shell__dock">
                {dockWindows.map((windowConfig) => (
                  <button
                    key={windowConfig.id}
                    type="button"
                    className="legacy-shell__dock-item"
                    onClick={() => {
                      handleToggleWindowMinimized(windowConfig);
                      handleWindowFocus(windowConfig.id);
                    }}
                  >
                    <strong>{windowConfig.title}</strong>
                    <span>{windowConfig.type === "tool" ? windowConfig.component : translate("editingEngine.documents.card")}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </main>
      )}
    </div>
  );
}
