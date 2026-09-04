import React, { startTransition } from "react";
import { App as AntdApp } from "antd";
import { resolveHostSceneId, resolveLaunchParams, resolveSurfaceKind } from "@chips/ui";
import type { Client, PlatformLaunchContext, SurfaceContext } from "chips-sdk";
import { appConfig } from "../../config/app-config";
import { createLogger, createTraceId } from "../../config/logging";
import { formatMessage } from "../lib/messages";
import { chipsClient } from "../runtime/chips-client";
import { readLaunchContext } from "../runtime/launch-context";
import {
  downloadBytesAsFile,
  normalizeBinaryContent,
  unwrapBinaryPayload,
} from "../utils/binary";
import {
  isLikelyLocalPath,
  isProbablyRemoteSource,
  resolveLaunchSheetTarget,
  type LaunchSheetTarget,
} from "../utils/launch-resource";
import { openWorkbookBytes, exportSheetCsv, saveWorkbookBytes } from "../sheet/workbook-io";
import { createEmptyWorkbookModel, stripExtension, type WorkbookFormat, type WorkbookModel } from "../sheet/workbook-model";
import { collectSheetStates } from "../sheet/edit-journal";
import type { UniverRuntime } from "../sheet/univer-state";
import {
  getSceneDefinition,
  getSceneIdForWorkbookState,
  type AppSceneDefinition,
  type AppSceneId,
} from "./scene-registry";

export type SheetPhase = "start" | "loading" | "ready" | "error";

export type HostKind = "desktop" | "web" | "mobile" | "headless";

function isHostKind(value: unknown): value is HostKind {
  return value === "desktop" || value === "web" || value === "mobile" || value === "headless";
}

export interface WorkbookSession {
  fileName: string;
  /** 原始本地路径（仅本地文件存在；新建工作簿为空） */
  filePath?: string;
  /** 字节来源标识（本地路径 / 远程 URL / 资源 ID） */
  sourceId?: string;
  /** 原始格式（决定保存写出格式） */
  format: WorkbookFormat;
}

export interface SheetErrorState {
  title: string;
  detail: string;
}

export interface SheetRuntimeEnvironment {
  appId: string;
  pluginId: string;
  hostSceneId: string;
  activeSceneId: AppSceneId;
  surfaceId: string | null;
  sessionId: string | null;
  surfaceKind: string;
  launchParams: Record<string, unknown>;
}

export interface AppRuntimeValue {
  client: Client;
  traceId: string;
  launchContext: PlatformLaunchContext;
  surface: SurfaceContext | null;
  environment: SheetRuntimeEnvironment;
  activeSceneId: AppSceneId;
  activeScene: AppSceneDefinition;
  phase: SheetPhase;
  hostKind: HostKind;
  session: WorkbookSession | null;
  /** 待灌入引擎的工作簿模型（SheetStage 挂载引擎后消费） */
  pendingModel: WorkbookModel | null;
  /** 工作簿加载代次：打开新文件时递增，驱动引擎重新灌入 */
  workbookRevision: number;
  errorState: SheetErrorState | null;
  isDirty: boolean;
  isBusy: boolean;
  registerRuntime(runtime: UniverRuntime | null): void;
  markDirty(): void;
  openFile(): Promise<void>;
  openWorkbookTarget(target: LaunchSheetTarget): Promise<void>;
  dropFiles(files: File[]): Promise<void>;
  newWorkbook(): Promise<void>;
  saveWorkbook(): Promise<void>;
  saveWorkbookAs(): Promise<void>;
  exportActiveCsv(): Promise<void>;
  /** 错误态重试：重新打开最近一次目标 */
  retryLastTarget(): void;
  /** 退出错误态（有会话回编辑态，否则回起始页） */
  dismissError(): void;
}

const AppRuntimeContext = React.createContext<AppRuntimeValue | null>(null);

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return fallbackMessage;
}

function resolveLocalSheetPath(target: LaunchSheetTarget): string | undefined {
  const directFilePath = target.filePath?.trim();
  if (directFilePath?.startsWith("file://")) {
    try {
      return decodeURIComponent(new URL(directFilePath).pathname);
    } catch {
      return undefined;
    }
  }
  if (directFilePath) {
    return directFilePath;
  }
  const sourceId = target.sourceId.trim();
  if (!sourceId) {
    return undefined;
  }
  if (sourceId.startsWith("file://")) {
    try {
      return decodeURIComponent(new URL(sourceId).pathname);
    } catch {
      return undefined;
    }
  }
  return isLikelyLocalPath(sourceId) && !isProbablyRemoteSource(sourceId) ? sourceId : undefined;
}

const CSV_MIME_TYPE = "text/csv;charset=utf-8";
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function workbookMimeType(format: WorkbookFormat): string {
  if (format === "csv") {
    return CSV_MIME_TYPE;
  }
  return XLSX_MIME_TYPE;
}

export interface AppRuntimeProviderProps {
  children: React.ReactNode;
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps): React.ReactElement {
  const client = chipsClient;
  const traceId = React.useMemo(() => createTraceId("chips-sheet"), []);
  const logger = React.useMemo(
    () => createLogger({ scope: "app-runtime", traceId }),
    [traceId],
  );
  const { message } = AntdApp.useApp();
  const [launchContext, setLaunchContext] = React.useState<PlatformLaunchContext>(() =>
    readLaunchContext(client),
  );
  const [phase, setPhase] = React.useState<SheetPhase>("start");
  const [hostKind, setHostKind] = React.useState<HostKind>("desktop");
  const [session, setSession] = React.useState<WorkbookSession | null>(null);
  const [pendingModel, setPendingModel] = React.useState<WorkbookModel | null>(null);
  const [workbookRevision, setWorkbookRevision] = React.useState(0);
  const [errorState, setErrorState] = React.useState<SheetErrorState | null>(null);
  const [isDirty, setIsDirty] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const launchHandledRef = React.useRef(false);
  const runtimeRef = React.useRef<UniverRuntime | null>(null);
  const sessionRef = React.useRef<WorkbookSession | null>(null);
  const officeSessionIdRef = React.useRef<string | null>(null);
  const lastTargetRef = React.useRef<LaunchSheetTarget | null>(null);

  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const registerRuntime = React.useCallback((runtime: UniverRuntime | null): void => {
    runtimeRef.current = runtime;
  }, []);

  const markDirty = React.useCallback((): void => {
    setIsDirty(true);
  }, []);

  const readWorkbookBytes = React.useCallback(
    async (target: LaunchSheetTarget): Promise<Uint8Array> => {
      const localPath = resolveLocalSheetPath(target);
      if (localPath) {
        const fileContent = await client.file.read(localPath, { encoding: "binary" });
        return normalizeBinaryContent(unwrapBinaryPayload(fileContent));
      }
      if (isProbablyRemoteSource(target.sourceId)) {
        const response = await fetch(target.sourceId, {
          headers: {
            Accept:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel.sheet.macroenabled.12, text/csv, application/octet-stream;q=0.9, */*;q=0.8",
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        return new Uint8Array(await response.arrayBuffer());
      }
      const resourceBinary = await client.resource.readBinary(target.sourceId);
      return normalizeBinaryContent(unwrapBinaryPayload(resourceBinary));
    },
    [client],
  );

  const writeWorkbookBytes = React.useCallback(
    async (path: string, bytes: Uint8Array): Promise<void> => {
      await client.file.write(path, bytes, { encoding: "binary" });
    },
    [client],
  );

  const openWorkbookTarget = React.useCallback(
    async (target: LaunchSheetTarget): Promise<void> => {
      lastTargetRef.current = target;
      setPhase("loading");
      setErrorState(null);
      setIsBusy(true);
      let nextOfficeSessionId: string | null = null;
      try {
        const localPath = resolveLocalSheetPath(target);
        let bytes: Uint8Array;
        if (localPath && target.format !== "csv") {
          const officeDocument = await client.office.open({ filePath: localPath, format: "xlsx" });
          nextOfficeSessionId = officeDocument.sessionId;
          bytes = (await client.office.read(nextOfficeSessionId)).bytes;
        } else {
          bytes = await readWorkbookBytes(target);
        }
        const model = await openWorkbookBytes(bytes, target.fileName);
        const nextSession: WorkbookSession = {
          fileName: target.fileName,
          filePath: resolveLocalSheetPath(target),
          sourceId: target.sourceId,
          format: target.format,
        };
        if (officeSessionIdRef.current) {
          await client.office.close(officeSessionIdRef.current).catch(() => undefined);
        }
        officeSessionIdRef.current = nextOfficeSessionId;
        startTransition(() => {
          setSession(nextSession);
          setPendingModel(model);
          setWorkbookRevision((revision) => revision + 1);
          setIsDirty(false);
          setPhase("ready");
        });
        logger.info("表格文件已解析完成", {
          fileName: target.fileName,
          sheets: model.sheets.length,
          format: target.format,
        });
      } catch (error) {
        if (nextOfficeSessionId) {
          await client.office.close(nextOfficeSessionId).catch(() => undefined);
        }
        logger.error("打开表格文件失败", error);
        setPhase("error");
        setErrorState({
          title: formatMessage("stage.errorTitle"),
          detail: resolveErrorMessage(
            error,
            formatMessage("message.openFailed", { reason: "未知错误" }),
          ),
        });
      } finally {
        setIsBusy(false);
      }
    },
    [client, logger, readWorkbookBytes],
  );

  const openFile = React.useCallback(async (): Promise<void> => {
    try {
      const selected = await client.platform.openFile({
        title: formatMessage("dialog.openFileTitle"),
        mode: "file",
        allowMultiple: false,
        mustExist: true,
        filters: [{ name: "表格文件", extensions: ["xlsx", "xlsm", "csv"] }],
      });
      const filePath = Array.isArray(selected) ? selected[0] : undefined;
      if (!filePath) {
        return;
      }
      const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
      const format: WorkbookFormat =
        extension === "xlsm" ? "xlsm" : extension === "csv" ? "csv" : "xlsx";
      await openWorkbookTarget({
        sourceId: filePath,
        filePath,
        fileName: filePath.split(/[\\/]/).pop() ?? filePath,
        format,
      });
    } catch (error) {
      logger.error("调用系统文件选择器失败", error);
      message.error(
        resolveErrorMessage(error, formatMessage("message.openFailed", { reason: "文件选择器不可用" })),
      );
    }
  }, [client, logger, message, openWorkbookTarget]);

  const dropFiles = React.useCallback(
    async (files: File[]): Promise<void> => {
      const candidate = files.find((file) => /\.(xlsx|xlsm|csv)$/i.test(file.name));
      if (!candidate) {
        message.warning(formatMessage("message.unsupportedFile"));
        return;
      }
      const bridgePath = client.platform.getPathForFile(candidate);
      const filePath = bridgePath || (candidate as File & { path?: string }).path || "";
      if (!filePath) {
        message.warning(formatMessage("message.dropMissingPath"));
        return;
      }
      const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
      const format: WorkbookFormat =
        extension === "xlsm" ? "xlsm" : extension === "csv" ? "csv" : "xlsx";
      await openWorkbookTarget({
        sourceId: filePath,
        filePath,
        fileName: candidate.name || filePath.split(/[\\/]/).pop() || filePath,
        format,
      });
    },
    [client, message, openWorkbookTarget],
  );

  const newWorkbook = React.useCallback(async (): Promise<void> => {
    const model = createEmptyWorkbookModel("工作簿1.xlsx");
    setIsBusy(true);
    try {
      const initialBytes = await saveWorkbookBytes(model, "xlsx");
      const officeDocument = await client.office.create({
        format: "xlsx",
        fileName: "工作簿1.xlsx",
        initialBytes,
      });
      const previousOfficeSessionId = officeSessionIdRef.current;
      officeSessionIdRef.current = officeDocument.sessionId;
      if (previousOfficeSessionId) {
        await client.office.close(previousOfficeSessionId).catch(() => undefined);
      }
      lastTargetRef.current = null;
      startTransition(() => {
        setSession({
          fileName: officeDocument.fileName,
          filePath: officeDocument.filePath,
          sourceId: officeDocument.filePath,
          format: "xlsx",
        });
        setPendingModel(model);
        setWorkbookRevision((revision) => revision + 1);
        setIsDirty(false);
        setPhase("ready");
      });
      message.success(formatMessage("message.newCreated"));
    } catch (error) {
      logger.error("新建工作簿失败", error);
      setPhase("error");
      setErrorState({
        title: formatMessage("stage.errorTitle"),
        detail: resolveErrorMessage(error, formatMessage("message.saveFailed", { reason: "无法写入工作区" })),
      });
    } finally {
      setIsBusy(false);
    }
  }, [client, logger, message]);

  const buildSaveBytes = React.useCallback(
    async (currentSession: WorkbookSession): Promise<Uint8Array> => {
      const model = collectSheetStates(runtimeRef.current, {
        fallbackFileName: currentSession.fileName,
      });
      if (!model) {
        throw new Error(formatMessage("message.saveNoWorkbook"));
      }
      if (currentSession.format === "csv") {
        return exportSheetCsv(model, model.activeSheetIndex);
      }
      return saveWorkbookBytes(model, currentSession.format);
    },
    [],
  );

  const saveWorkbookAs = React.useCallback(async (): Promise<void> => {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      message.warning(formatMessage("message.saveNoWorkbook"));
      return;
    }
    try {
      const destinationPath = await client.platform.saveFile({
        title: formatMessage("dialog.saveFileTitle"),
        defaultPath: currentSession.fileName,
      });
      if (!destinationPath) {
        message.info(formatMessage("message.saveAsCanceled"));
        return;
      }
      const extension = destinationPath.split(".").pop()?.toLowerCase() ?? "";
      const format: WorkbookFormat =
        extension === "xlsm" ? "xlsm" : extension === "csv" ? "csv" : "xlsx";
      const targetSession: WorkbookSession = {
        ...currentSession,
        fileName: destinationPath.split(/[\\/]/).pop() ?? currentSession.fileName,
        format,
      };
      setIsBusy(true);
      const bytes = await buildSaveBytes(targetSession);
      if (hostKind === "web") {
        downloadBytesAsFile(bytes, targetSession.fileName, workbookMimeType(format));
        message.success(formatMessage("message.downloadStarted", { name: targetSession.fileName }));
      } else {
        if (officeSessionIdRef.current && format !== "csv") {
          await client.office.write(officeSessionIdRef.current, bytes);
          await client.office.persist(officeSessionIdRef.current, destinationPath);
        } else {
          await writeWorkbookBytes(destinationPath, bytes);
          if (format !== "csv") {
            const officeDocument = await client.office.open({
              filePath: destinationPath,
              format: "xlsx",
            });
            const previousOfficeSessionId = officeSessionIdRef.current;
            officeSessionIdRef.current = officeDocument.sessionId;
            if (previousOfficeSessionId) {
              await client.office.close(previousOfficeSessionId).catch(() => undefined);
            }
          }
        }
        if (format === "csv" && officeSessionIdRef.current) {
          await client.office.close(officeSessionIdRef.current).catch(() => undefined);
          officeSessionIdRef.current = null;
        }
        message.success(formatMessage("message.saveSuccess", { path: destinationPath }));
      }
      setSession({ ...targetSession, filePath: hostKind === "web" ? undefined : destinationPath });
      setIsDirty(false);
      logger.info("工作簿已另存", { destinationPath, format });
    } catch (error) {
      logger.error("另存工作簿失败", error);
      message.error(
        resolveErrorMessage(error, formatMessage("message.saveFailed", { reason: "未知错误" })),
      );
    } finally {
      setIsBusy(false);
    }
  }, [buildSaveBytes, client, hostKind, logger, message, writeWorkbookBytes]);

  const saveWorkbook = React.useCallback(async (): Promise<void> => {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      message.warning(formatMessage("message.saveNoWorkbook"));
      return;
    }
    // 无原路径的 xlsx 工作簿：自动转入另存为链路
    if (currentSession.format !== "csv" && !currentSession.filePath) {
      await saveWorkbookAs();
      return;
    }
    setIsBusy(true);
    try {
      const bytes = await buildSaveBytes(currentSession);
      if (hostKind === "web") {
        downloadBytesAsFile(bytes, currentSession.fileName, workbookMimeType(currentSession.format));
        message.success(
          formatMessage("message.downloadStarted", { name: currentSession.fileName }),
        );
      } else if (currentSession.filePath) {
        if (officeSessionIdRef.current && currentSession.format !== "csv") {
          await client.office.write(officeSessionIdRef.current, bytes);
          await client.office.persist(officeSessionIdRef.current, currentSession.filePath);
        } else {
          await writeWorkbookBytes(currentSession.filePath, bytes);
        }
        message.success(
          formatMessage("message.saveSuccess", { path: currentSession.filePath }),
        );
      }
      setIsDirty(false);
      logger.info("工作簿已保存", { fileName: currentSession.fileName });
    } catch (error) {
      logger.error("保存工作簿失败", error);
      message.error(
        resolveErrorMessage(error, formatMessage("message.saveFailed", { reason: "未知错误" })),
      );
    } finally {
      setIsBusy(false);
    }
  }, [buildSaveBytes, client, hostKind, logger, message, saveWorkbookAs, writeWorkbookBytes]);

  const exportActiveCsv = React.useCallback(async (): Promise<void> => {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      message.warning(formatMessage("message.saveNoWorkbook"));
      return;
    }
    try {
      const model = collectSheetStates(runtimeRef.current, {
        fallbackFileName: currentSession.fileName,
      });
      if (!model) {
        message.warning(formatMessage("message.saveNoWorkbook"));
        return;
      }
      const bytes = exportSheetCsv(model, model.activeSheetIndex);
      const baseName = stripExtension(currentSession.fileName) || "工作表";
      const fileName = `${baseName}.csv`;
      if (hostKind === "web") {
        downloadBytesAsFile(bytes, fileName, CSV_MIME_TYPE);
        message.success(formatMessage("message.downloadStarted", { name: fileName }));
        return;
      }
      const destinationPath = await client.platform.saveFile({
        title: formatMessage("dialog.exportCsvTitle"),
        defaultPath: fileName,
      });
      if (!destinationPath) {
        message.info(formatMessage("message.exportCanceled"));
        return;
      }
      await writeWorkbookBytes(destinationPath, bytes);
      message.success(formatMessage("message.exportSuccess", { path: destinationPath }));
      logger.info("活动工作表已导出 CSV", { destinationPath });
    } catch (error) {
      logger.error("导出 CSV 失败", error);
      message.error(
        resolveErrorMessage(error, formatMessage("message.exportFailed", { reason: "未知错误" })),
      );
    }
  }, [client, hostKind, logger, message, writeWorkbookBytes]);

  React.useEffect(() => {
    return () => {
      const officeSessionId = officeSessionIdRef.current;
      officeSessionIdRef.current = null;
      if (officeSessionId) {
        void client.office.close(officeSessionId).catch(() => undefined);
      }
    };
  }, [client]);

  const dismissError = React.useCallback((): void => {
    setErrorState(null);
    setPhase(sessionRef.current ? "ready" : "start");
  }, []);

  const retryLastTarget = React.useCallback((): void => {
    const target = lastTargetRef.current;
    if (target) {
      void openWorkbookTarget(target);
      return;
    }
    dismissError();
  }, [dismissError, openWorkbookTarget]);

  React.useEffect(() => {
    let cancelled = false;
    client.platform
      .getInfo()
      .then((platformInfo) => {
        if (!cancelled && isHostKind(platformInfo.hostKind)) {
          setHostKind(platformInfo.hostKind);
        }
      })
      .catch((error) => {
        logger.warn("读取平台信息失败，继续按桌面宿主处理", error);
      });
    return () => {
      cancelled = true;
    };
  }, [client, logger]);

  React.useEffect(() => {
    if (launchHandledRef.current) {
      return;
    }
    launchHandledRef.current = true;
    const nextLaunchContext = readLaunchContext(client);
    setLaunchContext(nextLaunchContext);
    const launchTarget = resolveLaunchSheetTarget(nextLaunchContext);
    if (!launchTarget) {
      return;
    }
    logger.info("检测到启动参数中的表格文件目标", {
      sourceId: launchTarget.sourceId,
      filePath: launchTarget.filePath,
    });
    void openWorkbookTarget(launchTarget);
  }, [client, logger, openWorkbookTarget]);

  const activeSceneId = getSceneIdForWorkbookState(phase === "ready" && !!session);
  const activeScene = getSceneDefinition(activeSceneId);
  const surface = launchContext.surfaceContext ?? null;

  const environment = React.useMemo<SheetRuntimeEnvironment>(
    () => ({
      appId: appConfig.appId,
      pluginId: launchContext.surfaceContext?.pluginId ?? launchContext.pluginId ?? appConfig.appId,
      hostSceneId: resolveHostSceneId(launchContext, appConfig.defaultSceneId),
      activeSceneId,
      surfaceId: launchContext.surfaceContext?.surfaceId ?? launchContext.surfaceId ?? null,
      sessionId: launchContext.surfaceContext?.sessionId ?? launchContext.sessionId ?? null,
      surfaceKind: resolveSurfaceKind(launchContext),
      launchParams: resolveLaunchParams(launchContext),
    }),
    [activeSceneId, launchContext],
  );

  const value = React.useMemo<AppRuntimeValue>(
    () => ({
      client,
      traceId,
      launchContext,
      surface,
      environment,
      activeSceneId,
      activeScene,
      phase,
      hostKind,
      session,
      pendingModel,
      workbookRevision,
      errorState,
      isDirty,
      isBusy,
      registerRuntime,
      markDirty,
      openFile,
      openWorkbookTarget,
      dropFiles,
      newWorkbook,
      saveWorkbook,
      saveWorkbookAs,
      exportActiveCsv,
      retryLastTarget,
      dismissError,
    }),
    [
      activeScene,
      activeSceneId,
      client,
      dismissError,
      environment,
      errorState,
      exportActiveCsv,
      hostKind,
      isBusy,
      isDirty,
      launchContext,
      markDirty,
      newWorkbook,
      openFile,
      openWorkbookTarget,
      pendingModel,
      phase,
      registerRuntime,
      retryLastTarget,
      dismissError,
      saveWorkbook,
      saveWorkbookAs,
      session,
      surface,
      traceId,
      workbookRevision,
      dropFiles,
    ],
  );

  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}

export function useAppRuntime(): AppRuntimeValue {
  const context = React.useContext(AppRuntimeContext);
  if (!context) {
    throw new Error("AppRuntimeContext is not available.");
  }
  return context;
}
