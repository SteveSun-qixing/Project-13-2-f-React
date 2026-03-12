import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appConfig } from "../../../config/app-config";
import { useEditorRuntime } from "./editor-runtime-context";
import {
  createBoxWorkspaceDocument,
  createCardWorkspaceDocument,
  detectWorkspaceDocumentKind,
  sanitizeRecentWorkspaceTargets,
} from "../../domains/workspace/workspace-service";
import type { WorkspaceDocument, WorkspaceSessionState } from "../../domains/workspace/types";
import {
  collectWorkspaceRootPaths,
  loadWorkspaceRepositoryRoots,
} from "../../domains/workspace/workspace-repository-service";
import {
  buildRecentWorkspaceTargets,
  upsertWorkspaceDocument,
} from "../../domains/workspace/workspace-service";
import { getLaunchTargetPath } from "../../shared/runtime/editor-runtime-service";
import { createEditorRouteService } from "../../shared/runtime/editor-route-service";
import { WorkspaceSessionContext } from "./workspace-session-context";

interface WorkspaceSessionProviderProps {
  children: React.ReactNode;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "工作区操作失败";
}

export function WorkspaceSessionProvider({ children }: WorkspaceSessionProviderProps) {
  const { snapshot, loading: runtimeLoading } = useEditorRuntime();
  const [state, setState] = useState<WorkspaceSessionState>({
    documents: [],
    activeDocumentId: null,
    recentTargets: [],
    repositoryRoots: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [repositoryError, setRepositoryError] = useState<string | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const routeService = useMemo(
    () => (snapshot ? createEditorRouteService(snapshot.client) : null),
    [snapshot],
  );

  const persistRecentTargets = useCallback(
    async (documents: WorkspaceDocument[], recentTargets = stateRef.current.recentTargets) => {
      if (!snapshot || !routeService || snapshot.runtimeMode !== "host") {
        return;
      }
      const targetDocument = documents[0];
      if (!targetDocument) {
        await routeService.setConfig(appConfig.configKeys.recentTargets, recentTargets);
        return;
      }
      const nextTargets = buildRecentWorkspaceTargets(recentTargets, targetDocument);
      await routeService.setConfig(appConfig.configKeys.recentTargets, nextTargets);
      setState((current) => ({
        ...current,
        recentTargets: nextTargets,
      }));
    },
    [routeService, snapshot],
  );

  const materializeDocument = useCallback(
    async (path: string): Promise<WorkspaceDocument> => {
      if (!routeService) {
        throw new Error("路由服务尚未初始化");
      }

      const kind = detectWorkspaceDocumentKind(path);
      if (!kind) {
        throw new Error("当前仅支持打开 .card 或 .box 文件");
      }

      if (kind === "card") {
        const [ast, validation, preview] = await Promise.all([
          routeService.parseCard(path),
          routeService.validateCard(path),
          routeService.renderCardPreview(path),
        ]);
        return createCardWorkspaceDocument({
          path,
          ast,
          validation,
          preview,
        });
      }

      const inspection = await routeService.inspectBox(path);
      return createBoxWorkspaceDocument({
        path,
        inspection,
      });
    },
    [routeService],
  );

  const refreshRepository = useCallback(async () => {
    const documents = stateRef.current.documents;
    const rootPaths = collectWorkspaceRootPaths(documents);

    if (rootPaths.length === 0) {
      setState((current) => ({
        ...current,
        repositoryRoots: [],
      }));
      setRepositoryError(null);
      setRepositoryLoading(false);
      return;
    }

    if (!routeService || !snapshot || snapshot.runtimeMode !== "host") {
      setState((current) => ({
        ...current,
        repositoryRoots: [],
      }));
      setRepositoryError("当前运行模式不支持工作区目录浏览。");
      setRepositoryLoading(false);
      return;
    }

    setRepositoryLoading(true);
    try {
      const repositoryRoots = await loadWorkspaceRepositoryRoots(routeService, rootPaths);
      setState((current) => ({
        ...current,
        repositoryRoots,
      }));
      setRepositoryError(null);
    } catch (runtimeError) {
      setRepositoryError(getErrorMessage(runtimeError));
    } finally {
      setRepositoryLoading(false);
    }
  }, [routeService, snapshot]);

  const openDocument = useCallback(
    async (path: string) => {
      if (!path || !snapshot) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const document = await materializeDocument(path);
        const currentState = stateRef.current;
        const documents = upsertWorkspaceDocument(currentState.documents, document);
        const recentTargets = buildRecentWorkspaceTargets(currentState.recentTargets, document);
        setState((current) => {
          return {
            documents,
            activeDocumentId: document.id,
            recentTargets,
          };
        });
        await persistRecentTargets(documents, recentTargets);
      } catch (runtimeError) {
        setError(getErrorMessage(runtimeError));
      } finally {
        setBusy(false);
      }
    },
    [materializeDocument, persistRecentTargets, snapshot],
  );

  const openDocumentFromDialog = useCallback(async () => {
    if (!routeService || !snapshot || snapshot.runtimeMode !== "host") {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const selectedPath = await routeService.openFileDialog({
        title: "打开卡片或箱子文件",
        allowMultiple: false,
        mustExist: true,
      });
      if (selectedPath) {
        const document = await materializeDocument(selectedPath);
        const currentState = stateRef.current;
        const documents = upsertWorkspaceDocument(currentState.documents, document);
        const recentTargets = buildRecentWorkspaceTargets(currentState.recentTargets, document);
        setState((current) => {
          return {
            documents,
            activeDocumentId: document.id,
            recentTargets,
          };
        });
        await persistRecentTargets(documents, recentTargets);
      }
    } catch (runtimeError) {
      setError(getErrorMessage(runtimeError));
    } finally {
      setBusy(false);
    }
  }, [materializeDocument, persistRecentTargets, routeService, snapshot]);

  const activateDocument = useCallback((documentId: string) => {
    setState((current) => ({
      ...current,
      activeDocumentId: documentId,
    }));
  }, []);

  const closeDocument = useCallback((documentId: string) => {
    setState((current) => {
      const documents = current.documents.filter((item) => item.id !== documentId);
      const activeDocumentId = current.activeDocumentId === documentId ? documents[0]?.id ?? null : current.activeDocumentId;
      return {
        ...current,
        documents,
        activeDocumentId,
      };
    });
  }, []);

  const clearRecentTargets = useCallback(async () => {
    if (snapshot?.runtimeMode === "host" && routeService) {
      await routeService.setConfig(appConfig.configKeys.recentTargets, []);
    }

    setState((current) => ({
      ...current,
      recentTargets: [],
    }));
  }, [routeService, snapshot?.runtimeMode]);

  const refreshActiveDocument = useCallback(async () => {
    const activeDocument = state.documents.find((item) => item.id === state.activeDocumentId);
    if (!activeDocument) {
      return;
    }
    await openDocument(activeDocument.path);
  }, [openDocument, state.activeDocumentId, state.documents]);

  useEffect(() => {
    if (!snapshot || runtimeLoading) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      try {
        if (snapshot.runtimeMode === "host" && routeService) {
          const storedTargets = sanitizeRecentWorkspaceTargets(
            await routeService.getConfig<unknown>(appConfig.configKeys.recentTargets),
          );
          if (!cancelled) {
            setState((current) => ({
              ...current,
              recentTargets: storedTargets,
            }));
          }
        }

        const launchTargetPath = appConfig.featureFlags.enableLaunchContextRecovery
          ? getLaunchTargetPath(snapshot)
          : null;
        if (launchTargetPath && !cancelled) {
          await openDocument(launchTargetPath);
        }
      } catch (runtimeError) {
        if (!cancelled) {
          setError(getErrorMessage(runtimeError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [openDocument, routeService, runtimeLoading, snapshot]);

  useEffect(() => {
    void refreshRepository();
  }, [refreshRepository, state.documents]);

  const activeDocument = state.documents.find((item) => item.id === state.activeDocumentId) ?? null;

  const value = useMemo(
    () => ({
      ...state,
      loading,
      busy,
      error,
      repositoryLoading,
      repositoryError,
      activeDocument,
      openDocument,
      openDocumentFromDialog,
      activateDocument,
      closeDocument,
      refreshActiveDocument,
      refreshRepository,
      clearRecentTargets,
    }),
    [
      state,
      loading,
      busy,
      error,
      repositoryLoading,
      repositoryError,
      activeDocument,
      openDocument,
      openDocumentFromDialog,
      activateDocument,
      closeDocument,
      refreshActiveDocument,
      refreshRepository,
      clearRecentTargets,
    ],
  );

  return <WorkspaceSessionContext.Provider value={value}>{children}</WorkspaceSessionContext.Provider>;
}
