import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorRuntime } from "./editor-runtime-context";
import { useWorkspaceSession } from "./workspace-session-context";
import { WorkspaceExplorerContext } from "./workspace-explorer-context";
import {
  buildWorkspaceExplorerRoots,
  buildWorkspaceExplorerTree,
  createWorkspaceExplorerEntry,
  isWorkspaceExplorerDocumentPath,
  mergeExpandedDirectoryIds,
  sortWorkspaceExplorerEntries,
} from "../../domains/workspace-explorer/workspace-explorer-service";
import type { WorkspaceExplorerEntry } from "../../domains/workspace-explorer/types";
import { createEditorRouteService } from "../../shared/runtime/editor-route-service";
import { getLaunchTargetPath } from "../../shared/runtime/editor-runtime-service";

interface WorkspaceExplorerProviderProps {
  children: React.ReactNode;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "工作区资源树加载失败";
}

export function WorkspaceExplorerProvider({ children }: WorkspaceExplorerProviderProps) {
  const { snapshot } = useEditorRuntime();
  const { documents, recentTargets, activeDocument, openDocument } = useWorkspaceSession();
  const routeService = useMemo(
    () => (snapshot?.runtimeMode === "host" ? createEditorRouteService(snapshot.client) : null),
    [snapshot],
  );
  const [roots, setRoots] = useState<string[]>([]);
  const [expandedIds, setExpandedIdsState] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directoryEntries, setDirectoryEntries] = useState<Record<string, WorkspaceExplorerEntry[]>>({});
  const directoryEntriesRef = useRef<Record<string, WorkspaceExplorerEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyPaths, setBusyPaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    directoryEntriesRef.current = directoryEntries;
  }, [directoryEntries]);

  const ensureDirectoryLoaded = useCallback(
    async (directoryPath: string, force = false) => {
      if (!routeService) {
        return;
      }
      if (!force && directoryEntriesRef.current[directoryPath]) {
        return;
      }

      setBusyPaths((current) => (current.includes(directoryPath) ? current : [...current, directoryPath]));
      try {
        const entries = await routeService.listFiles(directoryPath);
        const stats = await Promise.all(entries.map(async (entryPath) => ({ path: entryPath, stat: await routeService.statFile(entryPath) })));
        const explorerEntries = sortWorkspaceExplorerEntries(
          stats
            .map(({ path, stat }) => createWorkspaceExplorerEntry(path, stat))
            .filter((entry): entry is WorkspaceExplorerEntry => entry !== null),
        );
        setDirectoryEntries((current) => ({
          ...current,
          [directoryPath]: explorerEntries,
        }));
      } catch (runtimeError) {
        setError(getErrorMessage(runtimeError));
      } finally {
        setBusyPaths((current) => current.filter((item) => item !== directoryPath));
      }
    },
    [routeService],
  );

  useEffect(() => {
    const launchTargetPath = snapshot ? getLaunchTargetPath(snapshot) : null;
    const nextRoots = buildWorkspaceExplorerRoots({
      documents,
      recentTargets,
      launchTargetPath,
    });

    setRoots(nextRoots);
    setExpandedIdsState((current) => mergeExpandedDirectoryIds(current, nextRoots));

    if (!routeService || nextRoots.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all(nextRoots.map((root) => ensureDirectoryLoaded(root)));
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
  }, [documents, ensureDirectoryLoaded, recentTargets, routeService, snapshot]);

  useEffect(() => {
    if (!activeDocument) {
      return;
    }
    setSelectedId(activeDocument.path);
  }, [activeDocument]);

  const setExpandedIds = useCallback(
    async (nextExpandedIds: string[]) => {
      const mergedExpandedIds = mergeExpandedDirectoryIds(nextExpandedIds, roots);
      setExpandedIdsState(mergedExpandedIds);
      if (!routeService) {
        return;
      }
      const directoriesToLoad = mergedExpandedIds.filter((directoryPath) => !directoryEntriesRef.current[directoryPath]);
      if (directoriesToLoad.length === 0) {
        return;
      }
      setError(null);
      await Promise.all(directoriesToLoad.map((directoryPath) => ensureDirectoryLoaded(directoryPath)));
    },
    [ensureDirectoryLoaded, roots, routeService],
  );

  const selectNode = useCallback(
    async (nodeId: string | null) => {
      setSelectedId(nodeId);
      if (!nodeId) {
        return;
      }
      if (isWorkspaceExplorerDocumentPath(nodeId)) {
        await openDocument(nodeId);
      }
    },
    [openDocument],
  );

  const refresh = useCallback(async () => {
    if (!routeService || roots.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const directoriesToRefresh = Array.from(new Set([...roots, ...expandedIds]));
      await Promise.all(directoriesToRefresh.map((directoryPath) => ensureDirectoryLoaded(directoryPath, true)));
    } catch (runtimeError) {
      setError(getErrorMessage(runtimeError));
    } finally {
      setLoading(false);
    }
  }, [ensureDirectoryLoaded, expandedIds, roots, routeService]);

  const tree = useMemo(
    () =>
      buildWorkspaceExplorerTree({
        roots,
        directoryEntries,
        expandedIds,
      }),
    [directoryEntries, expandedIds, roots],
  );

  const value = useMemo(
    () => ({
      tree,
      roots,
      expandedIds,
      selectedId,
      loading,
      busy: busyPaths.length > 0,
      error,
      setExpandedIds,
      selectNode,
      refresh,
    }),
    [tree, roots, expandedIds, selectedId, loading, busyPaths.length, error, setExpandedIds, selectNode, refresh],
  );

  return <WorkspaceExplorerContext.Provider value={value}>{children}</WorkspaceExplorerContext.Provider>;
}
