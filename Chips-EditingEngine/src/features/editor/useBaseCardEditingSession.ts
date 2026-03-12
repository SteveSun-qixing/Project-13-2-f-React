import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { Client, CompositeNodeSelection } from "chips-sdk";
import {
  createCardPackageService,
  readDocumentMode,
  readDocumentStructureNodes,
  type AvailableBaseCardType,
  type CardDocumentMode,
} from "../../domains/card-package/card-package-service";
import {
  applyConfigChange,
  canRedo,
  canUndo,
  createBaseCardEditSession,
  markSaveFailed,
  markSaveInFlight,
  markSavePending,
  markSaveSucceeded,
  redoConfigChange,
  undoConfigChange,
} from "../../domains/editor/editor-command-service";
import { createEditorSaveScheduler, type EditorSaveScheduler } from "../../domains/editor/editor-save-scheduler";
import type { BaseCardEditSession, BaseCardEditorSessionSnapshot } from "../../domains/editor/types";
import type { CardWorkspaceDocument } from "../../domains/workspace/types";
import {
  createBaseCardEditorRuntimeService,
  type BaseCardEditorRuntimeService,
} from "../../shared/runtime/base-card-editor-runtime-service";
import { useEditorPanel } from "../../app/providers/editor-panel-context";

interface UseBaseCardEditingSessionOptions {
  client: Client;
  document: CardWorkspaceDocument;
  onRefresh(): Promise<void>;
  onClose(): void;
  onSessionStateChange?(snapshot: BaseCardEditorSessionSnapshot): void;
}

interface UseBaseCardEditingSessionResult {
  previewFrameRef: MutableRefObject<HTMLIFrameElement | null>;
  editorHostRef: MutableRefObject<HTMLDivElement | null>;
  session: BaseCardEditSession | null;
  selectedNode: CompositeNodeSelection | null;
  editorLoading: boolean;
  editorError: string | null;
  documentMode: CardDocumentMode;
  availableCardTypes: AvailableBaseCardType[];
  structureBusy: boolean;
  structureError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  canMoveSelectionUp: boolean;
  canMoveSelectionDown: boolean;
  undo(): void;
  redo(): void;
  addBaseCard(cardType: string): Promise<void>;
  removeSelectedBaseCard(): Promise<void>;
  moveSelectedBaseCard(direction: "up" | "down"): Promise<void>;
  toggleDocumentMode(): Promise<void>;
  close(): Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "编辑操作失败";
}

function isUndoShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z";
}

function isRedoShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  if (!(event.metaKey || event.ctrlKey)) {
    return false;
  }
  return (event.shiftKey && key === "z") || key === "y";
}

function createSnapshot(
  session: BaseCardEditSession | null,
  selectedNode: CompositeNodeSelection | null,
  editorLoading: boolean,
  editorError: string | null,
): BaseCardEditorSessionSnapshot {
  return {
    selectedNode,
    baseCardTitle: session?.baseCard.title ?? null,
    saveState: session?.saveState ?? "idle",
    dirty: session?.dirty ?? false,
    undoDepth: session?.history.past.length ?? 0,
    redoDepth: session?.history.future.length ?? 0,
    editorLoading,
    editorError: editorError ?? session?.error ?? null,
    lastCommandKind: session?.lastCommand.kind ?? null,
    lastCommandAt: session?.lastCommand.timestamp ?? null,
  };
}

function bindEditorShortcuts(
  frame: HTMLIFrameElement,
  handlers: { undo(): void; redo(): void; canUndo(): boolean; canRedo(): boolean },
): () => void {
  const handleShortcut = (event: KeyboardEvent) => {
    if (isUndoShortcut(event) && handlers.canUndo()) {
      event.preventDefault();
      handlers.undo();
      return;
    }
    if (isRedoShortcut(event) && handlers.canRedo()) {
      event.preventDefault();
      handlers.redo();
    }
  };

  window.addEventListener("keydown", handleShortcut);

  const bindFrameDocument = () => {
    const frameWindow = frame.contentWindow;
    if (!frameWindow) {
      return;
    }
    const frameDocument = frameWindow.document;
    frameDocument.addEventListener("keydown", handleShortcut);
    return () => {
      frameDocument.removeEventListener("keydown", handleShortcut);
    };
  };

  let unbindFrameDocument = bindFrameDocument();
  const handleLoad = () => {
    unbindFrameDocument?.();
    unbindFrameDocument = bindFrameDocument();
  };

  frame.addEventListener("load", handleLoad);

  return () => {
    frame.removeEventListener("load", handleLoad);
    window.removeEventListener("keydown", handleShortcut);
    unbindFrameDocument?.();
  };
}

export function useBaseCardEditingSession(
  options: UseBaseCardEditingSessionOptions,
): UseBaseCardEditingSessionResult {
  const { openForSelection } = useEditorPanel();
  const runtimeService = useMemo(() => createBaseCardEditorRuntimeService(options.client), [options.client]);
  const cardPackageService = useMemo(() => createCardPackageService(options.client), [options.client]);
  const documentMode = useMemo(() => readDocumentMode(options.document.ast), [options.document.ast]);
  const structureNodes = useMemo(() => readDocumentStructureNodes(options.document.ast), [options.document.ast]);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorFrameRef = useRef<HTMLIFrameElement | null>(null);
  const shortcutCleanupRef = useRef<(() => void) | null>(null);
  const sessionRef = useRef<BaseCardEditSession | null>(null);
  const saveSchedulerRef = useRef<EditorSaveScheduler<unknown> | null>(null);
  const disposedRef = useRef(false);
  const selectionSequenceRef = useRef(0);
  const [selectedNode, setSelectedNode] = useState<CompositeNodeSelection | null>(null);
  const [session, setSession] = useState<BaseCardEditSession | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [structureBusy, setStructureBusy] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [availableCardTypes, setAvailableCardTypes] = useState<AvailableBaseCardType[]>([]);

  const selectedIndex = useMemo(
    () => (selectedNode ? structureNodes.findIndex((node) => node.id === selectedNode.nodeId) : -1),
    [selectedNode, structureNodes],
  );

  const commitSession = useCallback((nextSession: BaseCardEditSession | null) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  const flushPendingSave = useCallback(async () => {
    await saveSchedulerRef.current?.flush();
  }, []);

  const resetEditorState = useCallback(() => {
    selectionSequenceRef.current += 1;
    commitSession(null);
    setSelectedNode(null);
    setEditorLoading(false);
    setEditorError(null);
  }, [commitSession]);

  const loadSelection = useCallback(
    async (service: BaseCardEditorRuntimeService, payload: CompositeNodeSelection) => {
      if (documentMode !== "edit") {
        return;
      }

      const currentSession = sessionRef.current;
      if (currentSession && currentSession.selectedNode.nodeId === payload.nodeId) {
        setSelectedNode((current) => (current ? { ...current, ...payload } : payload));
        return;
      }

      const currentSequence = ++selectionSequenceRef.current;
      await flushPendingSave();
      if (disposedRef.current || currentSequence !== selectionSequenceRef.current) {
        return;
      }

      await openForSelection();
      setSelectedNode(payload);
      setEditorLoading(true);
      setEditorError(null);

      try {
        const baseCard = await service.getBaseCard(options.document.path, payload.nodeId);
        if (disposedRef.current || currentSequence !== selectionSequenceRef.current) {
          return;
        }
        const nextSelection = {
          ...payload,
          title: baseCard.title,
          cardType: baseCard.cardType,
          pluginId: baseCard.pluginId,
        };
        setSelectedNode(nextSelection);
        commitSession(createBaseCardEditSession(nextSelection, baseCard));
      } catch (error) {
        if (disposedRef.current || currentSequence !== selectionSequenceRef.current) {
          return;
        }
        commitSession(null);
        setEditorLoading(false);
        setEditorError(getErrorMessage(error));
      }
    },
    [commitSession, documentMode, flushPendingSave, openForSelection, options.document.path],
  );

  useEffect(() => {
    disposedRef.current = false;

    const scheduler = createEditorSaveScheduler({
      delayMs: 420,
      save: (request) => runtimeService.updateBaseCard(options.document.path, request.nodeId, request.config),
      onScheduled: () => {
        const currentSession = sessionRef.current;
        if (currentSession) {
          commitSession(markSavePending(currentSession));
        }
      },
      onBeforeSave: () => {
        const currentSession = sessionRef.current;
        if (currentSession) {
          commitSession(markSaveInFlight(currentSession));
        }
      },
      onSaved: async (request, baseCard) => {
        if (disposedRef.current) {
          return;
        }
        const latestSession = sessionRef.current;
        if (!latestSession || latestSession.selectedNode.nodeId !== request.nodeId) {
          return;
        }
        const frame = editorFrameRef.current;
        if (frame) {
          runtimeService.syncEditorConfig(frame, baseCard.config);
        }
        commitSession(markSaveSucceeded(latestSession, baseCard));
        setEditorError(null);
        setSelectedNode((current) =>
          current && current.nodeId === request.nodeId
            ? {
                ...current,
                title: baseCard.title,
                cardType: baseCard.cardType,
                pluginId: baseCard.pluginId,
              }
            : current,
        );
        await options.onRefresh();
      },
      onSaveFailed: async (request, error) => {
        if (disposedRef.current) {
          return;
        }
        const latestSession = sessionRef.current;
        const message = getErrorMessage(error);
        if (latestSession && latestSession.selectedNode.nodeId === request.nodeId) {
          commitSession(markSaveFailed(latestSession, message));
        }
        setEditorError(message);
      },
    });

    saveSchedulerRef.current = scheduler;

    return () => {
      disposedRef.current = true;
      void scheduler.dispose();
      if (saveSchedulerRef.current === scheduler) {
        saveSchedulerRef.current = null;
      }
    };
  }, [commitSession, options.document.path, options.onRefresh, runtimeService]);

  useEffect(() => {
    let cancelled = false;
    void cardPackageService
      .listAvailableBaseCardTypes()
      .then((types) => {
        if (!cancelled) {
          setAvailableCardTypes(types);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableCardTypes([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cardPackageService]);

  const syncEditorFromHistory = useCallback(
    (nextSession: BaseCardEditSession) => {
      const frame = editorFrameRef.current;
      const config = nextSession.history.present;
      if (!frame || !config) {
        return;
      }
      runtimeService.syncEditorConfig(frame, config);
      saveSchedulerRef.current?.schedule({
        nodeId: nextSession.selectedNode.nodeId,
        config,
      });
    },
    [runtimeService],
  );

  const undo = useCallback(() => {
    const currentSession = sessionRef.current;
    if (!currentSession || documentMode !== "edit") {
      return;
    }
    const nextSession = undoConfigChange(currentSession);
    if (nextSession === currentSession) {
      return;
    }
    commitSession(nextSession);
    syncEditorFromHistory(nextSession);
  }, [commitSession, documentMode, syncEditorFromHistory]);

  const redo = useCallback(() => {
    const currentSession = sessionRef.current;
    if (!currentSession || documentMode !== "edit") {
      return;
    }
    const nextSession = redoConfigChange(currentSession);
    if (nextSession === currentSession) {
      return;
    }
    commitSession(nextSession);
    syncEditorFromHistory(nextSession);
  }, [commitSession, documentMode, syncEditorFromHistory]);

  const close = useCallback(async () => {
    await flushPendingSave();
    options.onClose();
  }, [flushPendingSave, options.onClose]);

  const runStructureMutation = useCallback(
    async (action: () => Promise<void>) => {
      setStructureBusy(true);
      setStructureError(null);
      try {
        await action();
      } catch (error) {
        setStructureError(getErrorMessage(error));
      } finally {
        if (!disposedRef.current) {
          setStructureBusy(false);
        }
      }
    },
    [],
  );

  const addBaseCard = useCallback(
    async (cardType: string) => {
      if (documentMode !== "edit") {
        return;
      }
      await runStructureMutation(async () => {
        await flushPendingSave();
        const insertIndex = selectedIndex >= 0 ? selectedIndex + 1 : structureNodes.length;
        const created = await cardPackageService.addBaseCard({
          cardFile: options.document.path,
          cardType,
          insertIndex,
        });
        resetEditorState();
        await options.onRefresh();
        await loadSelection(runtimeService, {
          nodeId: created.nodeId,
          cardType: created.cardType,
          pluginId: created.pluginId,
          title: created.title,
        });
      });
    },
    [
      cardPackageService,
      documentMode,
      flushPendingSave,
      loadSelection,
      options.document.path,
      options.onRefresh,
      resetEditorState,
      runtimeService,
      selectedIndex,
      structureNodes.length,
      runStructureMutation,
    ],
  );

  const removeSelectedBaseCard = useCallback(async () => {
    if (!selectedNode || documentMode !== "edit") {
      return;
    }
    await runStructureMutation(async () => {
      await flushPendingSave();
      await cardPackageService.removeBaseCard({
        cardFile: options.document.path,
        nodeId: selectedNode.nodeId,
      });
      resetEditorState();
      await options.onRefresh();
    });
  }, [cardPackageService, documentMode, flushPendingSave, options.document.path, options.onRefresh, resetEditorState, runStructureMutation, selectedNode]);

  const moveSelectedBaseCard = useCallback(
    async (direction: "up" | "down") => {
      if (!selectedNode || selectedIndex < 0 || documentMode !== "edit") {
        return;
      }
      const targetIndex = direction === "up" ? selectedIndex - 1 : selectedIndex + 1;
      if (targetIndex < 0 || targetIndex >= structureNodes.length) {
        return;
      }
      await runStructureMutation(async () => {
        await flushPendingSave();
        await cardPackageService.reorderBaseCard({
          cardFile: options.document.path,
          nodeId: selectedNode.nodeId,
          targetIndex,
        });
        await options.onRefresh();
      });
    },
    [
      cardPackageService,
      documentMode,
      flushPendingSave,
      options.document.path,
      options.onRefresh,
      runStructureMutation,
      selectedIndex,
      selectedNode,
      structureNodes.length,
    ],
  );

  const toggleDocumentMode = useCallback(async () => {
    const nextMode: CardDocumentMode = documentMode === "edit" ? "view" : "edit";
    await runStructureMutation(async () => {
      await flushPendingSave();
      await cardPackageService.setDocumentMode({
        cardFile: options.document.path,
        mode: nextMode,
      });
      resetEditorState();
      await options.onRefresh();
    });
  }, [cardPackageService, documentMode, flushPendingSave, options.document.path, options.onRefresh, resetEditorState, runStructureMutation]);

  useEffect(() => {
    const frame = previewFrameRef.current;
    if (!frame || documentMode !== "edit") {
      return;
    }
    return runtimeService.onCompositeNodeSelect(frame, (payload) => {
      void loadSelection(runtimeService, payload);
    });
  }, [documentMode, loadSelection, runtimeService]);

  useEffect(() => {
    if (documentMode === "edit") {
      return;
    }
    resetEditorState();
  }, [documentMode, resetEditorState]);

  useEffect(() => {
    let cancelled = false;

    const mountEditor = async () => {
      const host = editorHostRef.current;
      if (!host) {
        return;
      }

      host.replaceChildren();
      editorFrameRef.current = null;
      shortcutCleanupRef.current?.();
      shortcutCleanupRef.current = null;

      const currentSelection = selectedNode;
      const currentSession = sessionRef.current;
      if (
        documentMode !== "edit" ||
        !currentSelection ||
        !currentSession ||
        currentSession.selectedNode.nodeId !== currentSelection.nodeId
      ) {
        return;
      }

      setEditorLoading(true);

      try {
        const rendered = await runtimeService.renderEditor({
          cardFile: options.document.path,
          nodeId: currentSelection.nodeId,
        });
        if (cancelled || disposedRef.current) {
          return;
        }

        rendered.frame.className = "editor-shell__editor-frame";
        host.appendChild(rendered.frame);
        editorFrameRef.current = rendered.frame;

        const disposeReady = runtimeService.onEditorReady(rendered.frame, () => {
          if (!cancelled && !disposedRef.current) {
            setEditorLoading(false);
          }
        });
        const disposeFatal = runtimeService.onEditorFatalError(rendered.frame, (error) => {
          if (cancelled || disposedRef.current) {
            return;
          }
          const latestSession = sessionRef.current;
          if (latestSession) {
            commitSession(markSaveFailed(latestSession, error.message));
          }
          setEditorLoading(false);
          setEditorError(error.message);
        });
        const disposeSynced = runtimeService.onEditorConfigSynced(rendered.frame, () => {
          if (!cancelled && !disposedRef.current) {
            setEditorLoading(false);
          }
        });
        const disposeChange = runtimeService.onEditorConfigChange(rendered.frame, (payload) => {
          const latestSession = sessionRef.current;
          if (!latestSession || latestSession.selectedNode.nodeId !== payload.nodeId || documentMode !== "edit") {
            return;
          }
          const nextSession = applyConfigChange(latestSession, payload.config);
          commitSession(nextSession);
          saveSchedulerRef.current?.schedule({
            nodeId: payload.nodeId,
            config: payload.config,
          });
        });

        shortcutCleanupRef.current = bindEditorShortcuts(rendered.frame, {
          undo,
          redo,
          canUndo: () => canUndo(sessionRef.current),
          canRedo: () => canRedo(sessionRef.current),
        });

        return () => {
          disposeReady();
          disposeFatal();
          disposeSynced();
          disposeChange();
        };
      } catch (error) {
        if (!cancelled && !disposedRef.current) {
          setEditorLoading(false);
          setEditorError(getErrorMessage(error));
        }
      }
      return undefined;
    };

    let disposeEditorListeners: (() => void) | undefined;
    void mountEditor().then((dispose) => {
      disposeEditorListeners = dispose;
    });

    return () => {
      cancelled = true;
      disposeEditorListeners?.();
      shortcutCleanupRef.current?.();
      shortcutCleanupRef.current = null;
      const host = editorHostRef.current;
      if (host) {
        host.replaceChildren();
      }
      editorFrameRef.current = null;
    };
  }, [commitSession, documentMode, options.document.path, redo, runtimeService, selectedNode, undo]);

  useEffect(() => {
    resetEditorState();
  }, [options.document.id, resetEditorState]);

  useEffect(() => {
    options.onSessionStateChange?.(createSnapshot(session, selectedNode, editorLoading, editorError));
  }, [editorError, editorLoading, options.onSessionStateChange, selectedNode, session]);

  return {
    previewFrameRef,
    editorHostRef,
    session,
    selectedNode,
    editorLoading,
    editorError,
    documentMode,
    availableCardTypes,
    structureBusy,
    structureError,
    canUndo: documentMode === "edit" && canUndo(session),
    canRedo: documentMode === "edit" && canRedo(session),
    canMoveSelectionUp: documentMode === "edit" && selectedIndex > 0,
    canMoveSelectionDown: documentMode === "edit" && selectedIndex >= 0 && selectedIndex < structureNodes.length - 1,
    undo,
    redo,
    addBaseCard,
    removeSelectedBaseCard,
    moveSelectedBaseCard,
    toggleDocumentMode,
    close,
  };
}
