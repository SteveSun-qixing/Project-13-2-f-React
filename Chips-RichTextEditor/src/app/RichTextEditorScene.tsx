import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CardEditorErrorPayload, CardEditorResourceBridge } from "chips-sdk";
import { appConfig } from "../../config/app-config";
import { createLogger } from "../../config/logging";
import { useRichTextEditorCommands } from "../commands/useRichTextEditorCommands";
import type {
  RichTextEditorCommandHandlers,
  RichTextEditorCommandState,
} from "../commands/rich-text-editor-commands";
import { EditorFrame } from "../components/EditorFrame";
import { InfoDialog, type InfoDialogSection } from "../components/InfoDialog";
import { createEmptyRichTextCardDocument, type RichTextCompositeCardDocument } from "../lib/card-document";
import {
  cleanupRuntimeSession,
  openRichTextCompositeCard,
  saveRichTextCompositeCard,
  type PendingResourceImport,
} from "../lib/card-persistence";
import { pathExists } from "../lib/file-client";
import { generateId62 } from "../lib/id";
import { resolveLaunchCardPath } from "../lib/launch-target";
import { formatMessage } from "../lib/messages";
import {
  basename,
  ensureCardExtension,
  joinPath,
  sanitizeFileStem,
  stripCardExtension,
  toFileUrl,
  type SessionRuntimePaths,
} from "../lib/path";
import { collectRichTextResourcePaths, type RichTextBaseCardConfig } from "../lib/richtext-card";
import { useAppRuntime } from "./AppRuntimeProvider";

const DOCUMENT_LOCALE = "zh-CN";
const INITIAL_DRAFT_TITLE = "开始书写";
const DOCUMENT_UNTITLED = "未命名文稿";
const STATUS_OPENING = "正在打开…";
const STATUS_SAVING = "正在保存…";
const STATUS_SAVED = "已保存";
const STATUS_UNSAVED = "未保存";
const STATUS_ERROR = "保存失败";
const EDITOR_LOADING = "正在装载富文本基础卡片编辑器…";
const EDITOR_READY = "编辑器已就绪";
const EDITOR_ERROR = "富文本基础卡片编辑器装载失败";
const FILE_PATH_EMPTY = "尚未保存到文件";
const RESOURCE_UNAVAILABLE = "当前资源尚未写入正式工作目录，保存后会自动收口。";
const EDITOR_COMMAND_OWNED = "该编辑命令由富文本基础卡片编辑器接管。";

interface NoticeState {
  tone: "info" | "success" | "error";
  message: string;
}

interface EditorDocumentSession {
  sessionId: string;
  editorKey: string;
  filePath: string | null;
  runtimePaths: SessionRuntimePaths | null;
  document: RichTextCompositeCardDocument;
  editorInitialConfig: RichTextBaseCardConfig;
  pendingImports: Record<string, PendingResourceImport>;
  pendingDeletions: string[];
  dirty: boolean;
  revision: number;
  lastSavedAt: string | null;
}

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

function isCardFilePath(filePath: string): boolean {
  return filePath.trim().toLowerCase().endsWith(".card");
}

function resolveDocumentTitle(title: string, fallbackTitle: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : fallbackTitle;
}

function resolveDocumentTitleForSave(
  snapshot: EditorDocumentSession,
  targetFilePath: string,
  defaultDraftTitle: string,
  fallbackTitle: string,
): string {
  const currentTitle = snapshot.document.title.trim();
  const fileDerivedTitle = stripCardExtension(basename(targetFilePath)).trim();

  if (
    currentTitle.length === 0
    || currentTitle === fallbackTitle
    || (!snapshot.filePath && currentTitle === defaultDraftTitle)
  ) {
    return resolveDocumentTitle(fileDerivedTitle, fallbackTitle);
  }

  return currentTitle;
}

function formatTimestamp(value: string | null | undefined, locale: string, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return value;
  }
}

function guessMimeType(resourcePath: string, fallbackMimeType?: string): string {
  if (fallbackMimeType && fallbackMimeType.trim().length > 0) {
    return fallbackMimeType;
  }

  if (resourcePath.toLowerCase().endsWith(".md")) {
    return "text/markdown";
  }

  return "application/octet-stream";
}

function createObjectUrl(resource: PendingResourceImport): string {
  const bytes = new Uint8Array(resource.data);
  return URL.createObjectURL(
    new Blob([bytes], {
      type: guessMimeType(resource.path, resource.mimeType),
    }),
  );
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function samePendingImport(left: PendingResourceImport | undefined, right: PendingResourceImport | undefined): boolean {
  if (!left || !right) {
    return false;
  }

  return left.path === right.path
    && left.mimeType === right.mimeType
    && sameBytes(left.data, right.data);
}

function sanitizeResourceFileName(input: string): string {
  const fileName = basename(input).trim();
  const dotIndex = fileName.lastIndexOf(".");
  const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  const extension = dotIndex > 0 ? fileName.slice(dotIndex) : ".md";
  const safeStem = sanitizeFileStem(stem).replace(/\s+/g, "-");
  return `${safeStem || `richtext-${generateId62(6)}`}${extension}`;
}

function createDraftSession(initialTitle: string, locale: string): EditorDocumentSession {
  const sessionId = generateId62(12);
  const document = createEmptyRichTextCardDocument(generateId62(), generateId62(), initialTitle);
  document.config.locale = locale;

  return {
    sessionId,
    editorKey: `${sessionId}:${document.baseCardId}`,
    filePath: null,
    runtimePaths: null,
    document,
    editorInitialConfig: document.config,
    pendingImports: {},
    pendingDeletions: [],
    dirty: false,
    revision: 0,
    lastSavedAt: null,
  };
}

function createOpenedSession(
  sessionId: string,
  targetFilePath: string,
  runtimePaths: SessionRuntimePaths,
  document: RichTextCompositeCardDocument,
): EditorDocumentSession {
  return {
    sessionId,
    editorKey: `${sessionId}:${document.baseCardId}`,
    filePath: targetFilePath,
    runtimePaths,
    document,
    editorInitialConfig: document.config,
    pendingImports: {},
    pendingDeletions: [],
    dirty: false,
    revision: 0,
    lastSavedAt: document.modifiedAt,
  };
}

export function RichTextEditorScene(): React.ReactElement {
  const runtime = useAppRuntime();
  const { client, traceId } = runtime;
  const [logger] = useState(() =>
    createLogger({
      scope: "rich-text-editor-scene",
      traceId,
    }),
  );
  const [session, setSession] = useState<EditorDocumentSession>(() =>
    createDraftSession(
      INITIAL_DRAFT_TITLE,
      DOCUMENT_LOCALE,
    ),
  );
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [editorState, setEditorState] = useState<"loading" | "ready" | "error">("loading");
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const sessionRef = useRef(session);
  const saveStateRef = useRef(saveState);
  const saveTaskRef = useRef<Promise<string | null> | null>(null);
  const lastFailedAutosaveRevisionRef = useRef<number | null>(null);
  const launchHandledRef = useRef(false);
  const resolvedBlobUrlsRef = useRef(new Map<string, string>());

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  function releaseResourceUrl(resourcePath: string): void {
    const url = resolvedBlobUrlsRef.current.get(resourcePath);
    if (!url) {
      return;
    }

    URL.revokeObjectURL(url);
    resolvedBlobUrlsRef.current.delete(resourcePath);
  }

  function releaseAllResourceUrls(): void {
    resolvedBlobUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    resolvedBlobUrlsRef.current.clear();
  }

  async function pickAvailableResourcePath(preferredPath?: string): Promise<string> {
    const current = sessionRef.current;
    const initialCandidate = sanitizeResourceFileName(preferredPath ?? `richtext-${generateId62(8)}.md`);
    const referencedPaths = new Set(collectRichTextResourcePaths(current.document.config));

    if (referencedPaths.has(initialCandidate)) {
      return initialCandidate;
    }

    const dotIndex = initialCandidate.lastIndexOf(".");
    const stem = dotIndex > 0 ? initialCandidate.slice(0, dotIndex) : initialCandidate;
    const extension = dotIndex > 0 ? initialCandidate.slice(dotIndex) : ".md";

    let candidate = initialCandidate;
    let counter = 1;

    while (true) {
      const hasPendingImport = candidate in current.pendingImports;
      const isPendingDeletion = current.pendingDeletions.includes(candidate);
      const existsOnDisk = current.runtimePaths && !isPendingDeletion
        ? await pathExists(client, joinPath(current.runtimePaths.workDir, candidate))
        : false;

      if (!hasPendingImport && !existsOnDisk) {
        return candidate;
      }

      counter += 1;
      candidate = `${stem}-${counter}${extension}`;
    }
  }

  const [resourceBridge] = useState<CardEditorResourceBridge>(() => ({
    async resolveResourceUrl(resourcePath) {
      const normalizedPath = resourcePath.replace(/\\/g, "/").trim();
      if (!normalizedPath) {
        throw new Error(RESOURCE_UNAVAILABLE);
      }

      const current = sessionRef.current;
      if (normalizedPath in current.pendingImports) {
        const existingUrl = resolvedBlobUrlsRef.current.get(normalizedPath);
        if (existingUrl) {
          return existingUrl;
        }

        const url = createObjectUrl(current.pendingImports[normalizedPath]);
        resolvedBlobUrlsRef.current.set(normalizedPath, url);
        return url;
      }

      if (current.pendingDeletions.includes(normalizedPath)) {
        throw new Error(RESOURCE_UNAVAILABLE);
      }

      if (current.runtimePaths) {
        const diskPath = joinPath(current.runtimePaths.workDir, normalizedPath);
        if (await pathExists(client, diskPath)) {
          return toFileUrl(diskPath);
        }
      }

      throw new Error(RESOURCE_UNAVAILABLE);
    },
    releaseResourceUrl(resourcePath) {
      releaseResourceUrl(resourcePath.replace(/\\/g, "/").trim());
    },
    async importResource(input) {
      const nextPath = await pickAvailableResourcePath(input.preferredPath ?? input.file.name);
      const data = new Uint8Array(await input.file.arrayBuffer());

      releaseResourceUrl(nextPath);
      if (saveStateRef.current === "error") {
        setSaveState("idle");
      }
      setNotice(null);
      setSession((current) => ({
        ...current,
        document: {
          ...current.document,
          modifiedAt: new Date().toISOString(),
        },
        pendingImports: {
          ...current.pendingImports,
          [nextPath]: {
            path: nextPath,
            data,
            mimeType: input.file.type || undefined,
          },
        },
        pendingDeletions: current.pendingDeletions.filter((path) => path !== nextPath),
        dirty: true,
        revision: current.revision + 1,
      }));

      return {
        path: nextPath,
      };
    },
    async deleteResource(resourcePath) {
      const normalizedPath = resourcePath.replace(/\\/g, "/").trim();
      if (!normalizedPath) {
        return;
      }

      releaseResourceUrl(normalizedPath);
      const current = sessionRef.current;
      const existsOnDisk = current.runtimePaths
        ? await pathExists(client, joinPath(current.runtimePaths.workDir, normalizedPath))
        : false;

      if (saveStateRef.current === "error") {
        setSaveState("idle");
      }
      setNotice(null);
      setSession((live) => {
        const { [normalizedPath]: removedImport, ...remainingImports } = live.pendingImports;
        const shouldTrackDeletion = !removedImport && existsOnDisk && !live.pendingDeletions.includes(normalizedPath);

        if (!removedImport && !shouldTrackDeletion) {
          return live;
        }

        return {
          ...live,
          document: {
            ...live.document,
            modifiedAt: new Date().toISOString(),
          },
          pendingImports: remainingImports,
          pendingDeletions: shouldTrackDeletion
            ? [...live.pendingDeletions, normalizedPath]
            : live.pendingDeletions.filter((path) => path !== normalizedPath),
          dirty: true,
          revision: live.revision + 1,
        };
      });
    },
  }));

  function switchSession(nextSession: EditorDocumentSession, nextNotice: NoticeState | null): void {
    releaseAllResourceUrls();
    lastFailedAutosaveRevisionRef.current = null;
    setSaveState("idle");
    setEditorState("loading");
    setIsInfoOpen(false);
    setNotice(nextNotice);
    setSession(nextSession);
  }

  async function confirmDiscardIfNeeded(): Promise<boolean> {
    const current = sessionRef.current;
    if (!current.dirty) {
      return true;
    }

    try {
      return await client.platform.showConfirm({
        title: "放弃当前修改？",
        message: "当前文稿还有未保存内容，继续操作会丢失这些更改。",
      });
    } catch (error) {
      logger.error("请求放弃修改确认框失败", error);
      return false;
    }
  }

  async function openDocumentByPath(
    targetFilePath: string,
    options?: { recoveredFromLaunch?: boolean; skipDiscardCheck?: boolean },
  ): Promise<void> {
    const normalizedPath = targetFilePath.trim();
    if (!isCardFilePath(normalizedPath)) {
      setNotice({
        tone: "error",
        message: "请选择一个 .card 文件。",
      });
      return;
    }

    if (!options?.skipDiscardCheck) {
      const confirmed = await confirmDiscardIfNeeded();
      if (!confirmed) {
        return;
      }
    }

    const previousRuntimePaths = sessionRef.current.runtimePaths;
    const nextSessionId = generateId62(12);

    setIsLoadingDocument(true);
    try {
      const opened = await openRichTextCompositeCard(client, normalizedPath, nextSessionId);
      const nextSession = createOpenedSession(nextSessionId, normalizedPath, opened.runtimePaths, opened.document);

      switchSession(
        nextSession,
        options?.recoveredFromLaunch
          ? {
              tone: "info",
              message: "已根据启动上下文恢复目标卡片",
            }
          : null,
      );

      logger.info("已打开富文本复合卡片", {
        filePath: normalizedPath,
        cardId: opened.document.cardId,
        baseCardId: opened.document.baseCardId,
      });

      if (previousRuntimePaths && previousRuntimePaths.runtimeDir !== opened.runtimePaths.runtimeDir) {
        void cleanupRuntimeSession(client, previousRuntimePaths).catch(() => undefined);
      }
    } catch (error) {
      logger.error("打开富文本复合卡片失败", error);
      setNotice({
        tone: "error",
        message: resolveErrorMessage(error, "打开卡片文件失败"),
      });
    } finally {
      setIsLoadingDocument(false);
    }
  }

  async function handleOpenFile(): Promise<void> {
    const confirmed = await confirmDiscardIfNeeded();
    if (!confirmed) {
      return;
    }

    try {
      const selected = await client.platform.openFile({
        title: "打开复合卡片文件",
        mode: "file",
        allowMultiple: false,
        mustExist: true,
      });

      const filePath = Array.isArray(selected) ? selected[0] : null;
      if (!filePath) {
        return;
      }

      await openDocumentByPath(filePath, {
        skipDiscardCheck: true,
      });
    } catch (error) {
      logger.error("调用文件选择器失败", error);
      setNotice({
        tone: "error",
        message: resolveErrorMessage(error, "打开卡片文件失败"),
      });
    }
  }

  async function handleNewDocument(): Promise<void> {
    const confirmed = await confirmDiscardIfNeeded();
    if (!confirmed) {
      return;
    }

    const previousRuntimePaths = sessionRef.current.runtimePaths;
    switchSession(
      createDraftSession(INITIAL_DRAFT_TITLE, DOCUMENT_LOCALE),
      {
        tone: "info",
        message: "已创建新的富文本卡片草稿",
      },
    );

    if (previousRuntimePaths) {
      void cleanupRuntimeSession(client, previousRuntimePaths).catch(() => undefined);
    }
  }

  function resolveDefaultSavePath(current: EditorDocumentSession): string {
    if (current.filePath) {
      return current.filePath;
    }

    const title = resolveDocumentTitle(current.document.title, DOCUMENT_UNTITLED);
    return ensureCardExtension(sanitizeFileStem(title));
  }

  async function saveCurrentSession(mode: "save" | "save-as" | "autosave"): Promise<string | null> {
    if (saveTaskRef.current) {
      return saveTaskRef.current;
    }

    const task = (async () => {
      const snapshot = sessionRef.current;

      try {
        let targetFilePath = snapshot.filePath;

        if (mode === "save-as" || !targetFilePath) {
          const selectedPath = await client.platform.saveFile({
            title: "保存复合卡片文件",
            defaultPath: resolveDefaultSavePath(snapshot),
          });

          if (!selectedPath) {
            if (mode !== "autosave") {
              setNotice({
                tone: "info",
                message: "已取消保存",
              });
            }
            return null;
          }

          targetFilePath = selectedPath;
        }

        if (!targetFilePath) {
          return null;
        }

        targetFilePath = ensureCardExtension(targetFilePath);
        const resolvedTitle = resolveDocumentTitleForSave(
          snapshot,
          targetFilePath,
          INITIAL_DRAFT_TITLE,
          DOCUMENT_UNTITLED,
        );

        setSaveState("saving");
        if (mode !== "autosave") {
          setNotice(null);
        }

        const saved = await saveRichTextCompositeCard(client, {
          targetFilePath,
          sessionId: snapshot.sessionId,
          document: {
            ...snapshot.document,
            title: resolvedTitle,
          },
          pendingImports: snapshot.pendingImports,
          sourceRuntimePaths: snapshot.runtimePaths,
        });

        releaseAllResourceUrls();
        lastFailedAutosaveRevisionRef.current = null;
        setSaveState("idle");
        setSession((current) => {
          if (current.sessionId !== snapshot.sessionId) {
            return current;
          }

          const changedDuringSave = current.revision !== snapshot.revision;
          const nextPendingImports = changedDuringSave
            ? Object.fromEntries(
                Object.entries(current.pendingImports).filter(([resourcePath, resource]) => {
                  const savedResource = snapshot.pendingImports[resourcePath];
                  return !samePendingImport(resource, savedResource);
                }),
              )
            : {};
          const nextPendingDeletions = changedDuringSave
            ? current.pendingDeletions.filter((resourcePath) => !snapshot.pendingDeletions.includes(resourcePath))
            : [];

          return {
            ...current,
            filePath: targetFilePath,
            runtimePaths: saved.runtimePaths,
            document: changedDuringSave
              ? {
                  ...current.document,
                  title: resolvedTitle,
                }
              : {
                  ...saved.document,
                  title: resolvedTitle,
                },
            pendingImports: nextPendingImports,
            pendingDeletions: nextPendingDeletions,
            dirty: changedDuringSave,
            lastSavedAt: saved.document.modifiedAt,
          };
        });

        if (snapshot.runtimePaths && snapshot.runtimePaths.runtimeDir !== saved.runtimePaths.runtimeDir) {
          void cleanupRuntimeSession(client, snapshot.runtimePaths).catch(() => undefined);
        }

        if (mode !== "autosave") {
          setNotice({
            tone: "success",
            message: formatMessage("app.saveSuccess", {
              path: targetFilePath,
            }),
          });
        }

        logger.info("富文本复合卡片已保存", {
          targetFilePath,
          cardId: snapshot.document.cardId,
          revision: snapshot.revision,
        });
        return targetFilePath;
      } catch (error) {
        const message = error instanceof Error && error.name === "CardStructureValidationError"
          ? "当前内容不符合卡片文件结构，已阻止保存。"
          : resolveErrorMessage(error, "保存卡片文件失败");
        logger.error("保存富文本复合卡片失败", error);
        setSaveState("error");
        if (mode === "autosave") {
          lastFailedAutosaveRevisionRef.current = snapshot.revision;
        }
        setNotice({
          tone: "error",
          message,
        });
        return null;
      }
    })();

    saveTaskRef.current = task;
    try {
      return await task;
    } finally {
      if (saveTaskRef.current === task) {
        saveTaskRef.current = null;
      }
    }
  }

  function handleEditorChange(nextConfig: RichTextBaseCardConfig): void {
    if (saveState === "error") {
      setSaveState("idle");
    }
    setNotice(null);
    setSession((current) => {
      if (JSON.stringify(current.document.config) === JSON.stringify(nextConfig)) {
        return current;
      }

      return {
        ...current,
        document: {
          ...current.document,
          config: nextConfig,
          modifiedAt: new Date().toISOString(),
        },
        dirty: true,
        revision: current.revision + 1,
      };
    });
  }

  function handleEditorError(payload: CardEditorErrorPayload): void {
    setEditorState("error");
    setNotice({
      tone: "error",
      message: payload.message || EDITOR_ERROR,
    });
  }

  function handleEditorOwnedCommand(): void {
    setNotice({
      tone: "info",
      message: EDITOR_COMMAND_OWNED,
    });
  }

  function handlePreview(): void {
    void (async () => {
      const currentPath = sessionRef.current.filePath ?? (await saveCurrentSession("save"));
      if (currentPath) {
        await client.platform.shellOpenPath(currentPath);
      }
    })();
  }

  const commandHandlers: RichTextEditorCommandHandlers = {
    newDocument: handleNewDocument,
    openFile: handleOpenFile,
    save: () => void saveCurrentSession("save"),
    saveAs: () => void saveCurrentSession("save-as"),
    exportCard: () => void saveCurrentSession("save-as"),
    preview: handlePreview,
    info: () => setIsInfoOpen(true),
    undo: handleEditorOwnedCommand,
    redo: handleEditorOwnedCommand,
    find: handleEditorOwnedCommand,
    format: handleEditorOwnedCommand,
  };

  const commandRuntimeState = useMemo<RichTextEditorCommandState>(
    () => ({
      isBusy: isLoadingDocument || saveState === "saving",
      hasFilePath: !!session.filePath,
      canPreview: !!session.filePath && !session.dirty && saveState !== "saving" && !isLoadingDocument,
    }),
    [isLoadingDocument, saveState, session.dirty, session.filePath],
  );

  useRichTextEditorCommands(commandHandlers, commandRuntimeState);

  useEffect(() => {
    if (launchHandledRef.current) {
      return;
    }
    launchHandledRef.current = true;

    const launchTargetPath = resolveLaunchCardPath(runtime.launchContext);
    if (!launchTargetPath) {
      return;
    }

    void openDocumentByPath(launchTargetPath, {
      recoveredFromLaunch: true,
      skipDiscardCheck: true,
    });
  }, [runtime.launchContext]);

  useEffect(() => {
    if (!appConfig.featureFlags.enableAutosave) {
      return;
    }

    if (!session.filePath || !session.dirty || saveState === "saving" || isLoadingDocument) {
      return;
    }

    if (lastFailedAutosaveRevisionRef.current === session.revision) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void saveCurrentSession("autosave");
    }, 1200);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isLoadingDocument, saveState, session.dirty, session.filePath, session.revision]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!sessionRef.current.dirty && saveState !== "saving") {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [saveState]);

  useEffect(() => {
    if (!notice || notice.tone === "error") {
      return;
    }

    const timerId = window.setTimeout(() => {
      setNotice((current) => (current === notice ? null : current));
    }, 2200);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [notice]);

  useEffect(() => {
    return () => {
      releaseAllResourceUrls();
      void cleanupRuntimeSession(client, sessionRef.current.runtimePaths).catch(() => undefined);
    };
  }, [client]);

  const displayedFilePath = session.filePath ?? FILE_PATH_EMPTY;
  const isSaving = saveState === "saving";
  const saveStatusLabel = isLoadingDocument
    ? STATUS_OPENING
    : saveState === "saving"
      ? STATUS_SAVING
      : saveState === "error"
        ? STATUS_ERROR
        : !session.filePath || session.dirty
          ? STATUS_UNSAVED
          : STATUS_SAVED;
  const editorStatusLabel = editorState === "ready"
    ? EDITOR_READY
    : editorState === "error"
      ? EDITOR_ERROR
      : EDITOR_LOADING;
  const autosaveStatusLabel = appConfig.featureFlags.enableAutosave && session.filePath
    ? session.dirty
      ? "存在待落盘改动"
      : "自动保存已接管"
    : "尚未绑定保存路径";
  const storageLabel = session.document.config.content_source === "file" ? "Markdown 文件" : "正文内联";
  const runtimeNotice = notice ?? (
    isLoadingDocument
      ? { tone: "info" as const, message: STATUS_OPENING }
      : isSaving
        ? { tone: "info" as const, message: STATUS_SAVING }
        : null
  );

  const infoSections: InfoDialogSection[] = [
    {
      id: "card",
      title: "当前卡片",
      fields: [
        { label: "标题", value: session.document.title || "未知" },
        { label: "文件路径", value: <span className="rte-info-dialog__mono">{displayedFilePath}</span> },
        { label: "卡片 ID", value: <span className="rte-info-dialog__mono">{session.document.cardId}</span> },
        { label: "基础卡片 ID", value: <span className="rte-info-dialog__mono">{session.document.baseCardId}</span> },
        {
          label: "创建时间",
          value: formatTimestamp(session.document.createdAt, DOCUMENT_LOCALE, "未知"),
        },
        {
          label: "最近修改",
          value: formatTimestamp(session.document.modifiedAt, DOCUMENT_LOCALE, "未知"),
        },
      ],
    },
    {
      id: "richtext",
      title: "富文本",
      fields: [
        { label: "正文格式", value: session.document.config.content_format },
        { label: "存储方式", value: storageLabel },
        {
          label: "正文资源",
          value: session.document.config.content_file
            ? <span className="rte-info-dialog__mono">{session.document.config.content_file}</span>
            : "无",
        },
        { label: "正文语言", value: session.document.config.locale ?? "未知" },
        {
          label: "正文主题",
          value: session.document.config.theme?.trim() ? session.document.config.theme : "跟随宿主主题",
        },
        {
          label: "资源计数",
          value: String(collectRichTextResourcePaths(session.document.config).length + Object.keys(session.pendingImports).length),
        },
      ],
    },
    {
      id: "runtime",
      title: "运行时",
      fields: [
        { label: "保存状态", value: saveStatusLabel },
        { label: "编辑器状态", value: editorStatusLabel },
        { label: "自动保存", value: autosaveStatusLabel },
        {
          label: "上次保存",
          value: formatTimestamp(session.lastSavedAt, DOCUMENT_LOCALE, "尚未保存"),
        },
      ],
    },
  ];

  return (
    <div className="rte-app">
      <main className="rte-app__workspace">
        <section className="rte-app__editor-stage" aria-label="富文本编辑器">
          <EditorFrame
            key={session.editorKey}
            client={client}
            sessionKey={session.document.baseCardId}
            initialConfig={session.editorInitialConfig}
            resources={resourceBridge}
            loadingLabel={EDITOR_LOADING}
            errorLabel={EDITOR_ERROR}
            onReady={() => {
              setEditorState("ready");
            }}
            onChange={(nextConfig) => {
              handleEditorChange(nextConfig);
            }}
            onError={handleEditorError}
          />
        </section>
      </main>

      <InfoDialog
        open={isInfoOpen}
        title="当前文稿信息"
        description="显示当前复合卡片、富文本正文与运行时状态。"
        closeLabel="关闭"
        sections={infoSections}
        onClose={() => {
          setIsInfoOpen(false);
        }}
      />

      {runtimeNotice ? (
        <div className={`rte-toast rte-toast--${runtimeNotice.tone}`}>
          {runtimeNotice.message}
        </div>
      ) : null}
    </div>
  );
}
