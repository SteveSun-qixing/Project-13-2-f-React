/**
 * 应用运行时：启动目标解析（每次启动只解析一次）、文档状态、打开/保存/
 * 打印动作与缩放控制。场景由文档状态推导：无文档停留起始页。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { Client, PlatformHostKind, PlatformLaunchContext } from "chips-sdk";
import { App as AntdApp } from "antd";
import type { Editor } from "@tiptap/core";
import { buildBlankDocx, type SectionInfo, type SectionSettings } from "@genoffice/docx-engine";
import { useChips } from "@chips/ui";
import { appConfig } from "../../config/app-config";
import { readLaunchContext } from "../runtime/launch-context";
import { formatMessage } from "../lib/messages";
import {
  DocumentOpenError,
  buildSaveBytes,
  deriveAutoFileName,
  parseDocxBytes,
  primeEditorForParsed,
  reparseForReanchor,
  resetEditorHistory,
  type WordDocState,
} from "../lib/document-io";
import {
  readDocumentBytes,
  resolveLaunchDocumentTarget,
  type LaunchDocumentTarget,
} from "../utils/launch-resource";

export type DocumentLoadErrorKind = "encrypted" | "parse" | "read";

export interface DocumentLoadError {
  kind: DocumentLoadErrorKind;
  reason?: string;
}

type LoadPhase = "idle" | "loading" | "ready";

export interface WordRuntimeValue {
  client: Client | null;
  ready: boolean;
  launchContext: PlatformLaunchContext | null;
  appId: string;
  activeSceneId: "start" | "document";
  docState: WordDocState | null;
  docCss: string;
  section: SectionSettings | null;
  sections: SectionInfo[];
  loadPhase: LoadPhase;
  loadError: DocumentLoadError | null;
  dirty: boolean;
  saving: boolean;
  hostKind: PlatformHostKind;
  zoom: number;
  editorRef: RefObject<Editor | null>;
  registerEditor(editor: Editor | null): void;
  openDocumentFromDialog(): Promise<void>;
  createDocument(): Promise<void>;
  openDroppedFile(file: File): Promise<void>;
  openTarget(target: LaunchDocumentTarget): Promise<void>;
  retryLastOpen(): Promise<void>;
  saveDocument(options: { saveAs: boolean }): Promise<void>;
  printDocument(): void;
  closeDocument(): void;
  markDirty(): void;
  setZoom(zoom: number): void;
  zoomIn(): void;
  zoomOut(): void;
  zoomReset(): void;
}

const ZOOM_MIN = 30;
const ZOOM_MAX = 300;
const ZOOM_STEP = 10;

const EMPTY_DOC_CONTENT = { type: "doc", content: [{ type: "docParagraph" }] };

const WordRuntimeContext = createContext<WordRuntimeValue | null>(null);

function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return fallback;
}

/** Web 宿主保存：把字节组装为 Blob 并触发浏览器下载（manifest save-file 回退链路）。 */
function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface AppRuntimeProviderProps {
  children: ReactNode;
}

/** 解析成功、等待编辑器装载的文档载荷。 */
interface ParsedLoad {
  outcome: Awaited<ReturnType<typeof parseDocxBytes>>;
  filePath: string | null;
  fileName: string;
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps) {
  const { client, launchContext, ready } = useChips();
  const { message } = AntdApp.useApp();

  const [activeSceneId, setActiveSceneId] = useState<"start" | "document">("start");
  const [docState, setDocState] = useState<WordDocState | null>(null);
  const [docCss, setDocCss] = useState("");
  const [section, setSection] = useState<SectionSettings | null>(null);
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>("idle");
  const [loadError, setLoadError] = useState<DocumentLoadError | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hostKind, setHostKind] = useState<PlatformHostKind>("desktop");
  const [zoom, setZoomState] = useState(100);

  const editorRef = useRef<Editor | null>(null);
  const pendingLoadRef = useRef<ParsedLoad | null>(null);
  const hasResolvedLaunchContextRef = useRef(false);
  const docStateRef = useRef<WordDocState | null>(null);
  const lastTargetRef = useRef<LaunchDocumentTarget | null>(null);
  const officeSessionIdRef = useRef<string | null>(null);
  const openSequenceRef = useRef(0);

  useEffect(() => {
    docStateRef.current = docState;
  }, [docState]);

  const applyParsedLoad = useCallback((pending: ParsedLoad): void => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const { outcome, filePath, fileName } = pending;
    primeEditorForParsed(editor, outcome.parsed);
    editor.commands.setContent(outcome.pmDoc as never);
    resetEditorHistory(editor);
    const nextState: WordDocState = {
      parsed: outcome.parsed,
      filePath,
      fileName,
      hash: "",
    };
    docStateRef.current = nextState;
    setDocState(nextState);
    setDocCss(outcome.css);
    setSection(outcome.section);
    setSections(outcome.sections);
    setLoadPhase("ready");
    setLoadError(null);
    setDirty(false);
  }, []);

  /** 编辑器已挂载则立即装载；否则挂载到 pending 队列，由 registerEditor 消费。 */
  const loadParsedOutcome = useCallback(
    (pending: ParsedLoad): void => {
      if (editorRef.current) {
        applyParsedLoad(pending);
        return;
      }
      pendingLoadRef.current = pending;
    },
    [applyParsedLoad],
  );

  const registerEditor = useCallback(
    (editor: Editor | null): void => {
      editorRef.current = editor;
      if (editor && pendingLoadRef.current) {
        const pending = pendingLoadRef.current;
        pendingLoadRef.current = null;
        applyParsedLoad(pending);
      }
    },
    [applyParsedLoad],
  );

  const openParsedBytes = useCallback(
    async (
      bytes: Uint8Array,
      target: { filePath: string | null; fileName: string },
      sequence: number,
    ): Promise<boolean> => {
      setLoadPhase("loading");
      setLoadError(null);
      try {
        const outcome = await parseDocxBytes(bytes);
        if (sequence !== openSequenceRef.current) {
          return false;
        }
        setActiveSceneId("document");
        loadParsedOutcome({ outcome, filePath: target.filePath, fileName: target.fileName });
        return true;
      } catch (error) {
        if (sequence !== openSequenceRef.current) {
          return false;
        }
        setLoadPhase("idle");
        if (error instanceof DocumentOpenError && error.kind === "encrypted") {
          setLoadError({ kind: "encrypted" });
        } else {
          setLoadError({ kind: "parse", reason: resolveErrorMessage(error, "") });
        }
        return false;
      }
    },
    [loadParsedOutcome],
  );

  const openTarget = useCallback(
    async (target: LaunchDocumentTarget): Promise<void> => {
      if (!client) {
        return;
      }
      const sequence = ++openSequenceRef.current;
      lastTargetRef.current = target;
      setLoadPhase("loading");
      setLoadError(null);
      let bytes: Uint8Array;
      let nextOfficeSessionId: string | null = null;
      let nextOfficeFilePath = target.filePath;
      try {
        const localPath = target.filePath;
        if (localPath && (/^file:\/\//i.test(localPath) || /^([A-Za-z]:[\\/]|\/|\\\\)/.test(localPath))) {
          const document = await client.office.open({ filePath: localPath, format: "docx" });
          nextOfficeSessionId = document.sessionId;
          nextOfficeFilePath = document.filePath;
          bytes = (await client.office.read(document.sessionId)).bytes;
        } else {
          bytes = await readDocumentBytes(client, target);
        }
      } catch (error) {
        if (sequence !== openSequenceRef.current) {
          return;
        }
        setLoadPhase("idle");
        setLoadError({ kind: "read", reason: resolveErrorMessage(error, "") });
        return;
      }
      if (sequence !== openSequenceRef.current) {
        if (nextOfficeSessionId) {
          await client.office.close(nextOfficeSessionId).catch(() => undefined);
        }
        return;
      }
      const opened = await openParsedBytes(
        bytes,
        {
          filePath: nextOfficeFilePath,
          fileName: target.fileName,
        },
        sequence,
      );
      if (!opened) {
        if (nextOfficeSessionId) {
          await client.office.close(nextOfficeSessionId).catch(() => undefined);
        }
        return;
      }
      const previousOfficeSessionId = officeSessionIdRef.current;
      officeSessionIdRef.current = nextOfficeSessionId;
      if (previousOfficeSessionId && previousOfficeSessionId !== nextOfficeSessionId) {
        await client.office.close(previousOfficeSessionId).catch(() => undefined);
      }
    },
    [client, openParsedBytes],
  );

  const createDocument = useCallback(async (): Promise<void> => {
    if (!client) {
      message.warning(formatMessage("start-home.hints.bridgeUnavailable"));
      return;
    }
    const sequence = ++openSequenceRef.current;
    setLoadPhase("loading");
    setLoadError(null);
    try {
      const bytes = await buildBlankDocx();
      const document = await client.office.create({
        format: "docx",
        fileName: "未命名文档.docx",
        initialBytes: bytes,
      });
      if (sequence !== openSequenceRef.current) {
        await client.office.close(document.sessionId).catch(() => undefined);
        return;
      }
      const previousOfficeSessionId = officeSessionIdRef.current;
      officeSessionIdRef.current = document.sessionId;
      if (previousOfficeSessionId) {
        await client.office.close(previousOfficeSessionId).catch(() => undefined);
      }
      lastTargetRef.current = null;
      const opened = await openParsedBytes(bytes, {
        filePath: document.filePath,
        fileName: document.fileName,
      }, sequence);
      if (!opened) {
        officeSessionIdRef.current = null;
        await client.office.close(document.sessionId).catch(() => undefined);
      }
    } catch (error) {
      if (sequence !== openSequenceRef.current) return;
      setLoadPhase("idle");
      setLoadError({ kind: "read", reason: resolveErrorMessage(error, "无法创建文档") });
    }
  }, [client, message, openParsedBytes]);

  const openDroppedFile = useCallback(
    async (file: File): Promise<void> => {
      if (!client) {
        message.warning(formatMessage("start-home.hints.bridgeUnavailable"));
        return;
      }
      const bridgePath = client.platform.getPathForFile(file);
      const fallbackPath = (file as File & { path?: string }).path;
      const filePath = bridgePath ?? fallbackPath ?? null;
      if (!filePath) {
        message.warning(formatMessage("message.dropInvalid"));
        return;
      }
      if (!/\.docx$/i.test(filePath) && !/\.docx$/i.test(file.name)) {
        message.warning(formatMessage("message.dropInvalid"));
        return;
      }
      await openTarget({
        sourceId: filePath,
        filePath,
        fileName: file.name || filePath.split(/[\\/]/).pop() || filePath,
        mimeType: file.type || null,
        title: null,
      });
    },
    [client, message, openTarget],
  );

  const openDocumentFromDialog = useCallback(async (): Promise<void> => {
    if (!client) {
      message.warning(formatMessage("start-home.hints.bridgeUnavailable"));
      return;
    }
    try {
      const selected = await client.platform.openFile({
        title: formatMessage("start-home.dialogs.openFileTitle"),
        mode: "file",
        allowMultiple: false,
        mustExist: true,
        filters: [{ name: formatMessage("start-home.formats"), extensions: ["docx"] }],
      });
      const firstPath = Array.isArray(selected) ? selected[0] : undefined;
      if (!firstPath) {
        return;
      }
      await openTarget({
        sourceId: firstPath,
        filePath: firstPath,
        fileName: firstPath.split(/[\\/]/).pop() ?? firstPath,
        mimeType: null,
        title: null,
      });
    } catch (error) {
      message.error(formatMessage("message.openFailed", { reason: resolveErrorMessage(error, "") }));
    }
  }, [client, message, openTarget]);

  const retryLastOpen = useCallback(async (): Promise<void> => {
    const last = lastTargetRef.current;
    if (last) {
      await openTarget(last);
      return;
    }
    await openDocumentFromDialog();
  }, [openDocumentFromDialog, openTarget]);

  const saveDocument = useCallback(
    async (options: { saveAs: boolean }): Promise<void> => {
      const editor = editorRef.current;
      const current = docStateRef.current;
      if (!client || !editor || !current || saving) {
        return;
      }
      setSaving(true);
      try {
        const bytes = await buildSaveBytes(current, editor);
        let savedPath = current.filePath;
        if (hostKind === "web") {
          // Web 宿主没有本地文件系统写入通道：以浏览器下载方式落盘
          downloadBytes(bytes, current.fileName);
          savedPath = null;
        } else {
          if (options.saveAs || !savedPath) {
            const autoName = deriveAutoFileName(editor);
            const dialogPath = await client.platform.saveFile({
              title: formatMessage("dialog.saveAs.title"),
              defaultPath: autoName ?? current.fileName,
            });
            if (!dialogPath) {
              message.info(formatMessage("message.saveAsCanceled"));
              return;
            }
            savedPath = dialogPath;
          }
          const officeSessionId = officeSessionIdRef.current;
          if (officeSessionId) {
            await client.office.write(officeSessionId, bytes);
            await client.office.persist(officeSessionId, savedPath);
          } else {
            await client.file.write(savedPath, bytes, { encoding: "binary" });
          }
        }
        // 重新 parseDocx 重锚定 docxIndex；内容一致时跳过重写以保留撤销栈
        const reparsed = await reparseForReanchor(bytes, editor);
        if (!reparsed.unchanged) {
          editor.commands.setContent(reparsed.pmDoc as never);
          resetEditorHistory(editor);
        }
        const nextState: WordDocState = {
          parsed: reparsed.parsed,
          filePath: savedPath,
          fileName: savedPath
            ? savedPath.split(/[\\/]/).pop() ?? current.fileName
            : current.fileName,
          hash: "",
        };
        docStateRef.current = nextState;
        setDocState(nextState);
        setDocCss(reparsed.css);
        setSection(reparsed.section);
        setSections(reparsed.sections);
        setDirty(false);
        message.success(formatMessage("message.saved"));
      } catch (error) {
        message.error(formatMessage("message.saveFailed", { reason: resolveErrorMessage(error, "") }));
      } finally {
        setSaving(false);
      }
    },
    [client, hostKind, message, saving],
  );

  const printDocument = useCallback((): void => {
    if (!docStateRef.current) {
      return;
    }
    window.print();
  }, []);

  const closeDocument = useCallback((): void => {
    ++openSequenceRef.current;
    const officeSessionId = officeSessionIdRef.current;
    officeSessionIdRef.current = null;
    if (officeSessionId && client) {
      void client.office.close(officeSessionId).catch(() => undefined);
    }
    const editor = editorRef.current;
    if (editor) {
      editor.commands.setContent(EMPTY_DOC_CONTENT as never);
      resetEditorHistory(editor);
    }
    docStateRef.current = null;
    setDocState(null);
    setDocCss("");
    setSection(null);
    setSections([]);
    setDirty(false);
    setLoadError(null);
    setLoadPhase("idle");
    setActiveSceneId("start");
  }, [client]);

  const markDirty = useCallback((): void => {
    setDirty(true);
  }, []);

  const setZoom = useCallback((next: number): void => {
    setZoomState(clampZoom(next));
  }, []);

  const zoomIn = useCallback((): void => {
    setZoomState((current) => clampZoom(current + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback((): void => {
    setZoomState((current) => clampZoom(current - ZOOM_STEP));
  }, []);

  const zoomReset = useCallback((): void => {
    setZoomState(100);
  }, []);

  // 启动目标只解析一次：无目标停留起始页
  useEffect(() => {
    if (!ready || !client || hasResolvedLaunchContextRef.current) {
      return;
    }
    hasResolvedLaunchContextRef.current = true;
    try {
      const context = readLaunchContext(client);
      const target = resolveLaunchDocumentTarget(context);
      if (target) {
        void openTarget(target);
      }
    } catch {
      // 读取启动上下文失败：停留起始页
    }
  }, [client, openTarget, ready]);

  // 宿主形态决定保存通道（desktop 走文件写入，web 走浏览器下载）
  useEffect(() => {
    if (!client) {
      return;
    }
    let cancelled = false;
    client.platform
      .getInfo()
      .then((info) => {
        if (!cancelled) {
          setHostKind(info.hostKind);
        }
      })
      .catch(() => {
        // 平台信息不可用时保持默认桌面链路
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  // 场景由文档状态与加载错误推导（错误态也进入 document 场景展示结果页）
  const effectiveScene = docState || loadError ? ("document" as const) : ("start" as const);
  useEffect(() => {
    setActiveSceneId((current) => (current === effectiveScene ? current : effectiveScene));
  }, [effectiveScene]);

  const value = useMemo<WordRuntimeValue>(
    () => ({
      client,
      ready,
      launchContext: launchContext ?? null,
      appId: appConfig.appId,
      activeSceneId,
      docState,
      docCss,
      section,
      sections,
      loadPhase,
      loadError,
      dirty,
      saving,
      hostKind,
      zoom,
      editorRef,
      registerEditor,
      openDocumentFromDialog,
      createDocument,
      openDroppedFile,
      openTarget,
      retryLastOpen,
      saveDocument,
      printDocument,
      closeDocument,
      markDirty,
      setZoom,
      zoomIn,
      zoomOut,
      zoomReset,
    }),
    [
      activeSceneId,
      client,
      closeDocument,
      dirty,
      docCss,
      docState,
      hostKind,
      launchContext,
      loadError,
      loadPhase,
      markDirty,
      openDocumentFromDialog,
      createDocument,
      openDroppedFile,
      openTarget,
      retryLastOpen,
      printDocument,
      ready,
      registerEditor,
      saveDocument,
      saving,
      section,
      sections,
      setZoom,
      zoom,
      zoomIn,
      zoomOut,
      zoomReset,
    ],
  );

  return <WordRuntimeContext.Provider value={value}>{children}</WordRuntimeContext.Provider>;
}

export function useWordRuntime(): WordRuntimeValue {
  const context = useContext(WordRuntimeContext);
  if (!context) {
    throw new Error("useWordRuntime must be used inside AppRuntimeProvider.");
  }
  return context;
}
