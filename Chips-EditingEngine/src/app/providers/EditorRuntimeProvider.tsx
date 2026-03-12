import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "chips-sdk";
import { appConfig, type EditorLayoutMode } from "../../../config/app-config";
import { createLogger, createSdkLogger, createTraceId } from "../../../config/logging";
import {
  applyEditorLocale,
  applyEditorTheme,
  createFallbackRuntimeSnapshot,
  hasBridgeRuntimeAccess,
  loadEditorRuntimeSnapshot,
  persistEditorLayoutMode,
} from "../../shared/runtime/editor-runtime-service";
import type { EditorRuntimeSnapshot } from "../../shared/types/runtime";
import { EditorRuntimeContext } from "./editor-runtime-context";

interface EditorRuntimeProviderProps {
  children: React.ReactNode;
}

function getRuntimeErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "运行时初始化失败";
}

export function EditorRuntimeProvider({ children }: EditorRuntimeProviderProps) {
  const traceId = useMemo(() => createTraceId("editing-engine"), []);
  const logger = useMemo(() => createLogger({ scope: "runtime", traceId }), [traceId]);
  const client = useMemo(
    () =>
      createClient({
        logger: createSdkLogger({ scope: "sdk", traceId }),
      }),
    [traceId],
  );
  const [snapshot, setSnapshot] = useState<EditorRuntimeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"theme" | "locale" | "layout" | "refresh" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusyAction("refresh");
    setError(null);
    try {
      const nextSnapshot = await loadEditorRuntimeSnapshot(client, logger);
      setSnapshot(nextSnapshot);
    } catch (runtimeError) {
      logger.error("刷新运行时快照失败", runtimeError);
      setError(getRuntimeErrorMessage(runtimeError));
    } finally {
      setBusyAction(null);
      setLoading(false);
    }
  }, [client, logger]);

  const updateSnapshot = useCallback(async () => {
    const nextSnapshot = await loadEditorRuntimeSnapshot(client, logger.child({ scope: "runtime-sync" }));
    setSnapshot(nextSnapshot);
  }, [client, logger]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      try {
        const initialSnapshot = hasBridgeRuntimeAccess()
          ? await loadEditorRuntimeSnapshot(client, logger.child({ scope: "bootstrap" }))
          : createFallbackRuntimeSnapshot(client);
        if (!cancelled) {
          setSnapshot(initialSnapshot);
          setError(null);
        }
      } catch (runtimeError) {
        if (!cancelled) {
          logger.error("初始化编辑引擎运行时失败", runtimeError);
          setError(getRuntimeErrorMessage(runtimeError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const offTheme = hasBridgeRuntimeAccess()
      ? client.events.on("theme.changed", () => {
          void updateSnapshot();
        })
      : () => undefined;
    const offLanguage = hasBridgeRuntimeAccess()
      ? client.events.on("language.changed", () => {
          void updateSnapshot();
        })
      : () => undefined;

    void bootstrap();

    return () => {
      cancelled = true;
      offTheme();
      offLanguage();
    };
  }, [client, logger, updateSnapshot]);

  const setTheme = useCallback(
    async (themeId: string) => {
      if (!hasBridgeRuntimeAccess()) {
        return;
      }
      setBusyAction("theme");
      setError(null);
      try {
        await applyEditorTheme(client, themeId);
        await updateSnapshot();
      } catch (runtimeError) {
        logger.error("切换主题失败", { themeId, runtimeError });
        setError(getRuntimeErrorMessage(runtimeError));
      } finally {
        setBusyAction(null);
      }
    },
    [client, logger, updateSnapshot],
  );

  const setLocale = useCallback(
    async (locale: string) => {
      if (!hasBridgeRuntimeAccess()) {
        return;
      }
      setBusyAction("locale");
      setError(null);
      try {
        await applyEditorLocale(client, locale);
        await updateSnapshot();
      } catch (runtimeError) {
        logger.error("切换语言失败", { locale, runtimeError });
        setError(getRuntimeErrorMessage(runtimeError));
      } finally {
        setBusyAction(null);
      }
    },
    [client, logger, updateSnapshot],
  );

  const setLayoutMode = useCallback(
    async (layoutMode: EditorLayoutMode) => {
      if (!hasBridgeRuntimeAccess()) {
        setSnapshot((currentSnapshot) =>
          currentSnapshot
            ? {
                ...currentSnapshot,
                preferredLayout: layoutMode,
              }
            : currentSnapshot,
        );
        return;
      }
      setBusyAction("layout");
      setError(null);
      try {
        await persistEditorLayoutMode(client, layoutMode);
        await updateSnapshot();
      } catch (runtimeError) {
        logger.error("保存默认布局失败", { layoutMode, runtimeError });
        setError(getRuntimeErrorMessage(runtimeError));
      } finally {
        setBusyAction(null);
      }
    },
    [client, logger, updateSnapshot],
  );

  const value = useMemo(
    () => ({
      snapshot,
      loading,
      busyAction,
      error,
      refresh,
      setTheme,
      setLocale,
      setLayoutMode,
    }),
    [snapshot, loading, busyAction, error, refresh, setTheme, setLocale, setLayoutMode],
  );

  return <EditorRuntimeContext.Provider value={value}>{children}</EditorRuntimeContext.Provider>;
}

export function useThemeProviderState(snapshot: EditorRuntimeSnapshot | null) {
  return snapshot?.theme ?? {
    themeId: "chips-official.default-theme",
    displayName: appConfig.appId,
    version: "1.0.0",
  };
}
