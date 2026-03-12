import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appConfig } from "../../../config/app-config";
import {
  DEFAULT_EDITOR_PANEL_STATE,
  sanitizeEditorPanelState,
} from "../../domains/editor-panel/editor-panel-state-service";
import type { EditorPanelState, EditorPanelWidthPreset } from "../../domains/editor-panel/types";
import { createEditorRouteService } from "../../shared/runtime/editor-route-service";
import { EditorPanelContext } from "./editor-panel-context";
import { useEditorRuntime } from "./editor-runtime-context";

interface EditorPanelProviderProps {
  children: React.ReactNode;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "编辑面板状态更新失败";
}

export function EditorPanelProvider({ children }: EditorPanelProviderProps) {
  const { snapshot, loading: runtimeLoading } = useEditorRuntime();
  const [state, setState] = useState<EditorPanelState>(DEFAULT_EDITOR_PANEL_STATE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const routeService = useMemo(
    () => (snapshot ? createEditorRouteService(snapshot.client) : null),
    [snapshot],
  );

  const persistState = useCallback(
    async (nextState: EditorPanelState) => {
      setState(nextState);
      stateRef.current = nextState;
      setError(null);

      if (!snapshot || snapshot.runtimeMode !== "host" || !routeService) {
        return;
      }

      setBusy(true);
      try {
        await routeService.setConfig(appConfig.configKeys.editorPanelState, nextState);
      } catch (runtimeError) {
        setError(getErrorMessage(runtimeError));
      } finally {
        setBusy(false);
      }
    },
    [routeService, snapshot],
  );

  const patchState = useCallback(
    async (patch: Partial<EditorPanelState>) => {
      await persistState({
        ...stateRef.current,
        ...patch,
      });
    },
    [persistState],
  );

  useEffect(() => {
    if (!snapshot || runtimeLoading) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        if (snapshot.runtimeMode !== "host" || !routeService) {
          if (!cancelled) {
            setState(DEFAULT_EDITOR_PANEL_STATE);
          }
          return;
        }

        const stored = await routeService.getConfig<EditorPanelState>(appConfig.configKeys.editorPanelState);
        if (!cancelled) {
          setState(sanitizeEditorPanelState(stored));
        }
      } catch (runtimeError) {
        if (!cancelled) {
          setState(DEFAULT_EDITOR_PANEL_STATE);
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
  }, [routeService, runtimeLoading, snapshot]);

  const value = useMemo(
    () => ({
      state,
      loading,
      busy,
      error,
      setCollapsed(collapsed: boolean) {
        return patchState({ collapsed });
      },
      toggleCollapsed() {
        return patchState({ collapsed: !stateRef.current.collapsed });
      },
      setWidthPreset(widthPreset: EditorPanelWidthPreset) {
        return patchState({ widthPreset, collapsed: false });
      },
      setAutoOpenOnSelection(enabled: boolean) {
        return patchState({ autoOpenOnSelection: enabled });
      },
      async openForSelection() {
        if (!stateRef.current.autoOpenOnSelection || !stateRef.current.collapsed) {
          return;
        }
        await patchState({ collapsed: false });
      },
    }),
    [busy, error, loading, patchState, state],
  );

  return <EditorPanelContext.Provider value={value}>{children}</EditorPanelContext.Provider>;
}
