/**
 * 文档状态中枢：会话（SlidesDocumentSession）+ 渲染树 + 选择/缩放等界面状态 +
 * 打开/保存/导出与编辑动作。React 组件经由本 store 直接调用本地会话（引擎已
 * 全部进入渲染进程，无需 IPC）。
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
} from "react";
import { App as AntdApp } from "antd";
import { useChips } from "@chips/ui";
import type { RenderSlide } from "@genoffice/pptx-render";
import type { Op } from "../slides/ops";
import type { EditParagraph } from "../slides/types";
import { createBlankPptx, type SlideElement } from "@genoffice/pptx-engine";
import { SlidesDocumentSession } from "../slides/session";
import { collectSlideImageUrls, createImageLoader } from "../slides/render/image-loader";
import { renderSlideToPngBase64 } from "../slides/render/export-render";
import {
  readLaunchFileBytes,
  resolveFileName,
  resolveLaunchFileTarget,
  type LaunchFileTarget,
} from "../utils/launch-resource";
import { formatMessage } from "../lib/messages";
import { resolveLaunchParams } from "../runtime/launch-context";

export type DeckStatus = "empty" | "loading" | "ready" | "error";

export interface DeckEditingState {
  sourceId: string;
  caret?: { x: number; y: number };
}

export interface DeckStore {
  status: DeckStatus;
  errorMessage: string | null;
  fileName: string | null;
  filePath: string | null;
  slides: RenderSlide[];
  currentIndex: number;
  currentSlide: RenderSlide | null;
  zoom: number;
  selectedId: string | null;
  editing: DeckEditingState | null;
  images: Map<string, HTMLImageElement>;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  isWebHost: boolean;
  launchTarget: LaunchFileTarget | null;

  openFromDialog(): Promise<void>;
  openFromLaunchTarget(target: LaunchFileTarget): Promise<void>;
  openDroppedFile(file: File): Promise<void>;
  createNew(): Promise<void>;
  save(): Promise<void>;
  saveAs(): Promise<void>;
  exportCurrentPng(): Promise<void>;

  setCurrentIndex(index: number): void;
  zoomIn(): void;
  zoomOut(): void;
  zoomReset(): void;

  select(sourceId: string | null): void;
  startEdit(sourceId: string, caret?: { x: number; y: number }): void;
  cancelEdit(): void;
  commitEdit(paragraphs: EditParagraph[]): void;

  apply(op: Op): boolean;
  undo(): void;
  redo(): void;
  /** 读取选中元素的引擎模型（工具栏属性回显用）。 */
  getElementModel(slideIndex: number, sourceId: string): SlideElement | null;
}

const DeckContext = createContext<DeckStore | null>(null);

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4];

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function DeckProvider({ children }: { children: ReactNode }) {
  const { client, ready, launchContext } = useChips();
  const { message } = AntdApp.useApp();
  const [status, setStatus] = useState<DeckStatus>("empty");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<SlidesDocumentSession | null>(null);
  const [slides, setSlides] = useState<RenderSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<DeckEditingState | null>(null);
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(() => new Map());
  const [historyVersion, setHistoryVersion] = useState(0);
  const [isWebHost, setIsWebHost] = useState(false);
  const officeSessionIdRef = useRef<string | null>(null);
  const imageLoaderRef = useRef<ReturnType<typeof createImageLoader> | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.platform
      .getInfo()
      .then((info) => {
        if (!cancelled) setIsWebHost(info.hostKind === "web");
      })
      .catch(() => {
        if (!cancelled) setIsWebHost(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    imageLoaderRef.current = createImageLoader((entries) => {
      setImages((prev) => {
        const next = new Map(prev);
        for (const [url, img] of entries) next.set(url, img);
        return next;
      });
    });
    return () => {
      imageLoaderRef.current?.dispose();
      imageLoaderRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (slides.length === 0) return;
    imageLoaderRef.current?.load(collectSlideImageUrls(slides));
  }, [slides]);

  const currentSlide = slides[currentIndex] ?? null;
  const canUndo = session?.canUndo ?? false;
  const canRedo = session?.canRedo ?? false;
  const dirty = session?.isDirty ?? false;

  const adoptSession = useCallback((next: SlidesDocumentSession) => {
    next.setFitWidth(960);
    setSession(next);
    setSlides(next.rebuildAll());
    setCurrentIndex(0);
    setSelectedId(null);
    setEditing(null);
    setZoom(1);
    setStatus("ready");
    setErrorMessage(null);
    setHistoryVersion((v) => v + 1);
  }, []);

  const openBytes = useCallback(
    async (bytes: Uint8Array, path: string | null): Promise<boolean> => {
      setStatus("loading");
      setErrorMessage(null);
      try {
        const next = await SlidesDocumentSession.open(bytes, path);
        adoptSession(next);
        if (path) {
          message.success(
            formatMessage("deck.messages.opened", { name: resolveFileName(path) }),
          );
        }
        return true;
      } catch (error) {
        setStatus("error");
        setErrorMessage(errorText(error));
        return false;
      }
    },
    [adoptSession, message],
  );

  const readBytesForTarget = useCallback(
    async (target: LaunchFileTarget): Promise<Uint8Array> => {
      if (client) {
        return readLaunchFileBytes(client, target);
      }
      const response = await fetch(target.sourceId);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    },
    [client],
  );

  const openFromLaunchTarget = useCallback(
    async (target: LaunchFileTarget) => {
      setStatus("loading");
      let nextOfficeSessionId: string | null = null;
      try {
        const localPath = target.filePath;
        let bytes: Uint8Array;
        if (client && localPath && !isWebHost && !/^https?:\/\//i.test(localPath)) {
          const officeDocument = await client.office.open({ filePath: localPath, format: "pptx" });
          nextOfficeSessionId = officeDocument.sessionId;
          bytes = (await client.office.read(nextOfficeSessionId)).bytes;
        } else {
          bytes = await readBytesForTarget(target);
        }
        const opened = await openBytes(bytes, target.filePath);
        if (!opened) {
          if (nextOfficeSessionId) {
            await client?.office.close(nextOfficeSessionId).catch(() => undefined);
          }
          return;
        }
        const previousOfficeSessionId = officeSessionIdRef.current;
        officeSessionIdRef.current = nextOfficeSessionId;
        if (previousOfficeSessionId) {
          await client?.office.close(previousOfficeSessionId).catch(() => undefined);
        }
      } catch (error) {
        if (nextOfficeSessionId) {
          await client?.office.close(nextOfficeSessionId).catch(() => undefined);
        }
        setStatus("error");
        setErrorMessage(errorText(error));
      }
    },
    [client, isWebHost, openBytes, readBytesForTarget],
  );

  const createNew = useCallback(async (): Promise<void> => {
    if (!client) {
      message.warning(formatMessage("start.errors.bridgeUnavailable"));
      return;
    }
    setStatus("loading");
    setErrorMessage(null);
    let createdOfficeSessionId: string | null = null;
    try {
      const bytes = await createBlankPptx();
      const document = await client.office.create({
        format: "pptx",
        fileName: "未命名演示文稿.pptx",
        initialBytes: bytes,
      });
      createdOfficeSessionId = document.sessionId;
      const next = await SlidesDocumentSession.open(bytes, document.filePath);
      next.setMeta(document.filePath, document.fileName);
      const previousOfficeSessionId = officeSessionIdRef.current;
      officeSessionIdRef.current = document.sessionId;
      if (previousOfficeSessionId) {
        await client.office.close(previousOfficeSessionId).catch(() => undefined);
      }
      adoptSession(next);
      message.success(formatMessage("deck.messages.created", { name: document.fileName }));
    } catch (error) {
      if (createdOfficeSessionId) {
        await client.office.close(createdOfficeSessionId).catch(() => undefined);
      }
      setStatus("error");
      setErrorMessage(errorText(error));
    }
  }, [adoptSession, client, message]);

  const openPaths = useCallback(
    async (paths: string[] | null) => {
      const path = paths?.[0];
      if (!path) return;
      await openFromLaunchTarget({
        sourceId: path,
        filePath: path,
        fileName: resolveFileName(path),
        mimeType: null,
        title: null,
      });
    },
    [openFromLaunchTarget],
  );

  const openFromDialog = useCallback(async () => {
    if (!client) {
      message.warning(formatMessage("start.errors.bridgeUnavailable"));
      return;
    }
    try {
      const selected = await client.platform.openFile({
        title: formatMessage("deck.dialogs.openFileTitle"),
        mode: "file",
        allowMultiple: false,
        mustExist: true,
        filters: [{ name: formatMessage("deck.fileFilter"), extensions: ["pptx"] }],
      });
      await openPaths(selected);
    } catch {
      message.warning(formatMessage("start.errors.bridgeUnavailable"));
    }
  }, [client, message, openPaths]);

  const openDroppedFile = useCallback(
    async (file: File) => {
      const bridgePath = client?.platform.getPathForFile(file);
      const fallbackPath = (file as File & { path?: string }).path;
      const droppedPath = bridgePath || fallbackPath || null;
      if (droppedPath) {
        await openPaths([droppedPath]);
        return;
      }
      // 无本地路径（web 宿主）：直接读取 File 字节
      const bytes = new Uint8Array(await file.arrayBuffer());
      const opened = await openBytes(bytes, null);
      if (opened && officeSessionIdRef.current) {
        await client?.office.close(officeSessionIdRef.current).catch(() => undefined);
        officeSessionIdRef.current = null;
      }
    },
    [client, openBytes, openPaths],
  );

  const writeBytes = useCallback(
    async (bytes: Uint8Array, filePath: string | null, fileName: string) => {
      if (client && filePath && !isWebHost) {
        if (officeSessionIdRef.current) {
          await client.office.write(officeSessionIdRef.current, bytes);
          await client.office.persist(officeSessionIdRef.current, filePath);
        } else {
          await client.file.write(filePath, bytes, { encoding: "binary" });
          const officeDocument = await client.office.open({ filePath, format: "pptx" });
          officeSessionIdRef.current = officeDocument.sessionId;
        }
        message.success(formatMessage("deck.messages.savedTo", { path: filePath }));
        return;
      }
      const blob = new Blob([bytes as unknown as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      message.success(formatMessage("deck.messages.saved", { name: fileName }));
    },
    [client, isWebHost, message],
  );

  const save = useCallback(async () => {
    if (!session) return;
    try {
      const bytes = await session.save();
      const fileName = PPTX_NAMED.test(session.metaInfo.fileName ?? "")
        ? session.metaInfo.fileName!
        : `${session.metaInfo.fileName ?? formatMessage("deck.messages.untitled")}.pptx`;
      await writeBytes(bytes, session.metaInfo.path, fileName);
    } catch (error) {
      message.error(formatMessage("deck.messages.saveFailed", { reason: errorText(error) }));
    }
  }, [message, session, writeBytes]);

  const saveAs = useCallback(async () => {
    if (!session) return;
    if (!client || isWebHost) {
      // web 宿主无保存对话框：直接按当前文件名走下载通道
      await save();
      return;
    }
    try {
      const bytes = await session.save();
      const defaultName = PPTX_NAMED.test(session.metaInfo.fileName ?? "")
        ? session.metaInfo.fileName!
        : `${session.metaInfo.fileName ?? formatMessage("deck.messages.untitled")}.pptx`;
      const target = await client.platform.saveFile({
        title: formatMessage("deck.dialogs.saveAsTitle"),
        defaultPath: defaultName,
      });
      if (!target) return;
      const targetFileName = resolveFileName(target);
      await writeBytes(bytes, target, targetFileName);
      session.setMeta(target, targetFileName);
    } catch (error) {
      message.error(formatMessage("deck.messages.saveFailed", { reason: errorText(error) }));
    }
  }, [client, isWebHost, message, save, session, writeBytes]);

  useEffect(() => {
    return () => {
      const officeSessionId = officeSessionIdRef.current;
      officeSessionIdRef.current = null;
      if (officeSessionId) {
        void client?.office.close(officeSessionId).catch(() => undefined);
      }
    };
  }, [client]);

  const exportCurrentPng = useCallback(async () => {
    const slide = slides[currentIndex];
    if (!slide) return;
    try {
      const base64 = await renderSlideToPngBase64(slide, images, 2);
      const blob = new Blob([base64ToBytes(base64) as unknown as BlobPart], {
        type: "image/png",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(session?.metaInfo.fileName ?? "slide").replace(/\.pptx$/i, "")}-${currentIndex + 1}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      message.success(formatMessage("deck.messages.exported"));
    } catch (error) {
      message.error(formatMessage("deck.messages.exportFailed", { reason: errorText(error) }));
    }
  }, [currentIndex, images, message, session, slides]);

  const setCurrentIndexSafe = useCallback(
    (index: number) => {
      setCurrentIndex((prev) => {
        if (index < 0 || index >= slides.length) return prev;
        return index;
      });
      setEditing(null);
      setSelectedId(null);
    },
    [slides.length],
  );

  const zoomIn = useCallback(() => {
    setZoom((prev) => ZOOM_STEPS.find((step) => step > prev + 0.01) ?? prev);
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => {
      const candidates = ZOOM_STEPS.filter((step) => step < prev - 0.01);
      return candidates.length ? candidates[candidates.length - 1]! : prev;
    });
  }, []);

  const zoomReset = useCallback(() => setZoom(1), []);

  const startEdit = useCallback((sourceId: string, caret?: { x: number; y: number }) => {
    setSelectedId(sourceId);
    setEditing({ sourceId, caret });
  }, []);

  const cancelEdit = useCallback(() => setEditing(null), []);

  const commitEdit = useCallback(
    (paragraphs: EditParagraph[]) => {
      const current = editing;
      setEditing(null);
      if (!session || !current) return;
      const result = session.applyOp({
        op: "setText",
        target: { slide: currentIndex, el: current.sourceId },
        paragraphs,
      });
      if (!result.applied) {
        if (result.failures?.length) {
          message.error(
            formatMessage("deck.messages.opFailed", { reason: result.failures[0]!.error }),
          );
        }
        return;
      }
      setSlides((prev) =>
        prev.map((slide, i) =>
          i === currentIndex ? session.rebuild(currentIndex) ?? slide : slide,
        ),
      );
      setSelectedId(current.sourceId);
      setHistoryVersion((v) => v + 1);
    },
    [currentIndex, editing, message, session],
  );

  const apply = useCallback(
    (op: Op) => {
      if (!session) return false;
      const result = session.applyOp(op);
      if (!result.applied) {
        if (result.failures?.length) {
          message.error(
            formatMessage("deck.messages.opFailed", { reason: result.failures[0]!.error }),
          );
        }
        return false;
      }
      setSlides((prev) =>
        prev.map((slide, i) =>
          i === currentIndex ? session.rebuild(currentIndex) ?? slide : slide,
        ),
      );
      setHistoryVersion((v) => v + 1);
      return true;
    },
    [currentIndex, message, session],
  );

  const undo = useCallback(() => {
    if (!session?.undo()) return;
    setSlides(session.rebuildAll());
    setSelectedId(null);
    setEditing(null);
    setHistoryVersion((v) => v + 1);
  }, [session]);

  const redo = useCallback(() => {
    if (!session?.redo()) return;
    setSlides(session.rebuildAll());
    setSelectedId(null);
    setEditing(null);
    setHistoryVersion((v) => v + 1);
  }, [session]);

  const select = useCallback((sourceId: string | null) => setSelectedId(sourceId), []);

  const getElementModel = useCallback(
    (slideIndex: number, sourceId: string): SlideElement | null =>
      session?.getElement(slideIndex, sourceId) ?? null,
    [session],
  );

  const launchTarget = useMemo(() => {
    if (!ready) return null;
    return resolveLaunchFileTarget({
      launchParams: resolveLaunchParams(launchContext),
    });
  }, [launchContext, ready]);

  const store = useMemo<DeckStore>(
    () => ({
      status,
      errorMessage,
      fileName: session?.metaInfo.fileName ?? null,
      filePath: session?.metaInfo.path ?? null,
      slides,
      currentIndex,
      currentSlide,
      zoom,
      selectedId,
      editing,
      images,
      canUndo,
      canRedo,
      dirty,
      isWebHost,
      launchTarget,
      openFromDialog,
      openFromLaunchTarget,
      openDroppedFile,
      createNew,
      save,
      saveAs,
      exportCurrentPng,
      setCurrentIndex: setCurrentIndexSafe,
      zoomIn,
      zoomOut,
      zoomReset,
      select,
      startEdit,
      cancelEdit,
      commitEdit,
      apply,
      undo,
      redo,
      getElementModel,
    }),
    [
      apply,
      canRedo,
      canUndo,
      currentIndex,
      currentSlide,
      dirty,
      editing,
      errorMessage,
      exportCurrentPng,
      historyVersion,
      images,
      isWebHost,
      launchTarget,
      openDroppedFile,
      openFromDialog,
      openFromLaunchTarget,
      redo,
      save,
      saveAs,
      select,
      selectedId,
      session,
      setCurrentIndexSafe,
      slides,
      startEdit,
      cancelEdit,
      status,
      undo,
      zoom,
      zoomIn,
      zoomOut,
      zoomReset,
      commitEdit,
      createNew,
      getElementModel,
    ],
  );

  return <DeckContext.Provider value={store}>{children}</DeckContext.Provider>;
}

const PPTX_NAMED = /\.pptx$/i;

export function useDeck(): DeckStore {
  const context = useContext(DeckContext);
  if (!context) {
    throw new Error("useDeck 必须在 DeckProvider 内部使用。");
  }
  return context;
}
