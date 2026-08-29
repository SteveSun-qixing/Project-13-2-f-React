import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Client, PlatformLaunchContext, SurfaceContext } from "chips-sdk";
import { useChips } from "@chips/ui";
import { appConfig } from "../../config/app-config";
import { formatMessage } from "../lib/messages";
import { chipsClient } from "../runtime/chips-client";
import { readLaunchContext } from "../runtime/launch-context";
import {
  getSceneDefinition,
  getSceneIdForFile,
  type UniversalViewerSceneDefinition,
  type UniversalViewerSceneId,
} from "./scene-registry";
import {
  resolveLaunchViewerTarget,
  type LaunchViewerTarget,
} from "../utils/launch-resource";
import { loadViewerFile, type LoadedViewerFile } from "../utils/source-loader";
import { isPreviewableTarget } from "../utils/open-targets";
import type { PreviewToolbarRenderContext } from "../viewer-engine";

export interface ViewerFeedback {
  tone: "info" | "success" | "error";
  message: string;
}

export interface UniversalViewerRuntimeEnvironment {
  appId: string;
  pluginId: string;
  hostSceneId: string;
  surfaceId: string | null;
  sessionId: string | null;
  surfaceKind: string;
  launchParams: Record<string, unknown>;
}

export interface UniversalViewerRuntimeValue {
  client: Client | null;
  ready: boolean;
  launchContext: PlatformLaunchContext;
  surface: SurfaceContext | null;
  environment: UniversalViewerRuntimeEnvironment;
  sceneId: UniversalViewerSceneId;
  scene: UniversalViewerSceneDefinition;
  loadedFiles: LoadedViewerFile[];
  initialIndex: number;
  isLoading: boolean;
  feedback: ViewerFeedback | null;
  toolbarContext: PreviewToolbarRenderContext | null;
  t(key: string, params?: Record<string, string | number>): string;
  setToolbarContext(context: PreviewToolbarRenderContext | null): void;
  clearFeedback(): void;
  openFile(): Promise<void>;
  dropFile(file: File | null): Promise<void>;
  reloadCurrent(): Promise<void>;
  saveCopy(): Promise<void>;
}

const UniversalViewerRuntimeContext = createContext<UniversalViewerRuntimeValue | null>(null);

interface ViewerSessionState {
  loadedFiles: LoadedViewerFile[];
  initialIndex: number;
}

function resolveHostSceneId(launchContext: PlatformLaunchContext | null): string {
  return launchContext?.surfaceContext?.sceneId ?? launchContext?.sceneId ?? appConfig.defaultSceneId;
}

function createEmptyLaunchContext(): PlatformLaunchContext {
  return {
    pluginId: appConfig.appId,
    sceneId: appConfig.defaultSceneId,
    kind: "window",
    presentation: { ...appConfig.defaultPresentation },
    surfaceContext: {
      surfaceId: undefined,
      sceneId: appConfig.defaultSceneId,
      pluginId: appConfig.appId,
      sessionId: undefined,
      kind: "window",
      presentation: { ...appConfig.defaultPresentation },
      launchParams: {},
    },
    launchParams: {},
  };
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps): React.ReactElement {
  const chips = useChips();
  const client = chips.client;
  const ready = chips.ready;
  const launchContext = useMemo<PlatformLaunchContext>(() => {
    if (chips.launchContext) {
      return readLaunchContext(chips.client ?? chipsClient);
    }
    return createEmptyLaunchContext();
  }, [chips.client, chips.launchContext]);

  const [session, setSession] = useState<ViewerSessionState>({ loadedFiles: [], initialIndex: 0 });
  const [isLoading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<ViewerFeedback | null>(null);
  const [toolbarContext, setToolbarContext] = useState<PreviewToolbarRenderContext | null>(null);
  const launchTargetRef = useRef<LaunchViewerTarget | null>(null);
  const launchHandledRef = useRef(false);
  const sessionTokenRef = useRef(0);

  const notifyFeedback = useCallback((next: ViewerFeedback | null): void => {
    setFeedback(next);
  }, []);

  const loadTarget = useCallback(async (target: LaunchViewerTarget | null): Promise<void> => {
    if (!client) {
      launchTargetRef.current = target;
      setSession({ loadedFiles: [], initialIndex: 0 });
      return;
    }
    const token = sessionTokenRef.current + 1;
    sessionTokenRef.current = token;

    if (!target || target.files.length === 0) {
      launchTargetRef.current = target;
      setSession({ loadedFiles: [], initialIndex: 0 });
      return;
    }

    setLoading(true);
    launchTargetRef.current = target;
    try {
      const loaded: LoadedViewerFile[] = [];
      for (const resource of target.files) {
        loaded.push(await loadViewerFile(client, resource));
      }
      if (sessionTokenRef.current !== token) {
        return;
      }
      setSession({ loadedFiles: loaded, initialIndex: target.initialIndex });
      setToolbarContext(null);
    } catch {
      if (sessionTokenRef.current !== token) {
        return;
      }
      setSession({ loadedFiles: [], initialIndex: 0 });
      notifyFeedback({
        tone: "error",
        message: formatMessage("universal-viewer.errors.loadFailed"),
      });
    } finally {
      if (sessionTokenRef.current === token) {
        setLoading(false);
      }
    }
  }, [client, notifyFeedback]);

  useEffect(() => {
    if (!ready || launchHandledRef.current || !client) {
      return;
    }
    launchHandledRef.current = true;
    const target = resolveLaunchViewerTarget(launchContext);
    void loadTarget(target);
  }, [ready, client, launchContext, loadTarget]);

  const openFilePaths = useCallback(async (paths: string[]): Promise<void> => {
    if (paths.length === 0) {
      return;
    }
    const previewablePaths: string[] = [];
    for (const filePath of paths) {
      const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
      if (await isPreviewableTarget(filePath, { fileName })) {
        previewablePaths.push(filePath);
      }
    }
    if (previewablePaths.length === 0) {
      notifyFeedback({
        tone: "error",
        message: formatMessage("universal-viewer.errors.unsupportedFile"),
      });
      return;
    }
    const target: LaunchViewerTarget = {
      files: previewablePaths.map((filePath) => ({
        sourceId: filePath,
        filePath,
        fileName: filePath.split(/[\\/]/).pop() ?? filePath,
      })),
      initialIndex: 0,
    };
    await loadTarget(target);
  }, [loadTarget, notifyFeedback]);

  const openFile = useCallback(async (): Promise<void> => {
    if (!client) {
      return;
    }
    try {
      const paths = await client.platform.openFile({
        title: formatMessage("universal-viewer.commands.openFile.title"),
        mode: "file",
        allowMultiple: true,
        mustExist: true,
      });
      await openFilePaths(paths ?? []);
    } catch {
      notifyFeedback({
        tone: "error",
        message: formatMessage("universal-viewer.errors.openFailed"),
      });
    }
  }, [client, notifyFeedback, openFilePaths]);

  const dropFile = useCallback(async (file: File | null): Promise<void> => {
    if (!file || !client) {
      return;
    }
    let filePath: string | null = null;
    try {
      filePath = client.platform.getPathForFile(file);
    } catch {
      const fallbackPath = (file as File & { path?: unknown }).path;
      filePath = typeof fallbackPath === "string" && fallbackPath.length > 0 ? fallbackPath : null;
    }
    if (!filePath) {
      notifyFeedback({
        tone: "error",
        message: formatMessage("universal-viewer.errors.dropFailed"),
      });
      return;
    }
    if (!(await isPreviewableTarget(filePath, { fileName: file.name, mimeType: file.type || undefined }))) {
      notifyFeedback({
        tone: "error",
        message: formatMessage("universal-viewer.errors.unsupportedFileForTarget", { fileName: file.name }),
      });
      return;
    }
    await openFilePaths([filePath]);
  }, [client, notifyFeedback, openFilePaths]);

  const reloadCurrent = useCallback(async (): Promise<void> => {
    await loadTarget(launchTargetRef.current);
  }, [loadTarget]);

  const saveCopy = useCallback(async (): Promise<void> => {
    if (!client) {
      return;
    }
    const current = session.loadedFiles[session.initialIndex] ?? session.loadedFiles[0];
    if (!current) {
      return;
    }
    try {
      const targetPath = await client.platform.saveFile({
        title: formatMessage("universal-viewer.commands.saveCopy.title"),
        defaultPath: current.fileName,
      });
      if (!targetPath) {
        return;
      }
      if (current.filePath && current.filePath === targetPath) {
        notifyFeedback({
          tone: "error",
          message: formatMessage("universal-viewer.errors.saveSamePath"),
        });
        return;
      }
      if (current.filePath) {
        await client.file.copy(current.filePath, targetPath);
      } else if (current.source instanceof Blob) {
        const bytes = new Uint8Array(await current.source.arrayBuffer());
        await client.file.write(targetPath, bytes, { encoding: "binary" });
      } else {
        notifyFeedback({
          tone: "error",
          message: formatMessage("universal-viewer.errors.saveFailed"),
        });
        return;
      }
      notifyFeedback({
        tone: "success",
        message: formatMessage("universal-viewer.feedback.saved"),
      });
    } catch {
      notifyFeedback({
        tone: "error",
        message: formatMessage("universal-viewer.errors.saveFailed"),
      });
    }
  }, [notifyFeedback, session]);

  const surface = launchContext.surfaceContext ?? null;

  const environment = useMemo<UniversalViewerRuntimeEnvironment>(() => ({
    appId: appConfig.appId,
    pluginId: launchContext.pluginId ?? surface?.pluginId ?? appConfig.appId,
    hostSceneId: resolveHostSceneId(launchContext),
    surfaceId: launchContext.surfaceId ?? surface?.surfaceId ?? null,
    sessionId: launchContext.sessionId ?? surface?.sessionId ?? null,
    surfaceKind: launchContext.kind ?? surface?.kind ?? "window",
    launchParams: launchContext.launchParams,
  }), [launchContext, surface]);

  const sceneId = getSceneIdForFile(session.loadedFiles.length > 0);
  const scene = getSceneDefinition(sceneId);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    return formatMessage(key, params);
  }, []);

  const value = useMemo<UniversalViewerRuntimeValue>(() => ({
    client,
    ready,
    launchContext,
    surface,
    environment,
    sceneId,
    scene,
    loadedFiles: session.loadedFiles,
    initialIndex: session.initialIndex,
    isLoading,
    feedback,
    toolbarContext,
    t,
    setToolbarContext,
    clearFeedback: () => notifyFeedback(null),
    openFile,
    dropFile,
    reloadCurrent,
    saveCopy,
  }), [
    client,
    environment,
    feedback,
    isLoading,
    launchContext,
    notifyFeedback,
    openFile,
    dropFile,
    ready,
    reloadCurrent,
    saveCopy,
    scene,
    sceneId,
    session,
    surface,
    t,
    toolbarContext,
  ]);

  return (
    <UniversalViewerRuntimeContext.Provider value={value}>
      {children}
    </UniversalViewerRuntimeContext.Provider>
  );
}

interface AppRuntimeProviderProps {
  children: ReactNode;
}

export function useAppRuntime(): UniversalViewerRuntimeValue {
  const context = useContext(UniversalViewerRuntimeContext);
  if (!context) {
    throw new Error("useAppRuntime must be used inside AppRuntimeProvider.");
  }
  return context;
}
