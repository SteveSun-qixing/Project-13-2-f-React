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
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Client } from "chips-sdk";
import { useChips } from "@chips/ui";
import { getDocument, DOC_OPTIONS } from "../pdf/pdfjs";
import type { PageSize } from "../pdf/geometry";
import type { OutlineNode } from "../components/OutlinePanel";
import type { FormCatalog } from "../pdf/form-catalog";
import { buildFormCatalog } from "../pdf/form-catalog";
import type { SavePdfRequest } from "../pdf/save-pdf";
import { applySaveRequest } from "../pdf/save-pdf";
import type { LaunchPdfTarget } from "../utils/launch-resource";
import { createDialogPdfTarget } from "../utils/launch-resource";
import {
  openPdfDialog,
  readPdfBytes,
  resolveHostKind,
  savePdfDialog,
  writePdfBytes,
  type HostKind,
} from "../runtime/file-access";
import { formatMessage } from "../lib/messages";
import { useAppRuntime } from "./AppRuntimeProvider";

export type DocumentStatus = "idle" | "loading" | "password" | "error" | "ready";

export type PersistResult = "written" | "downloaded" | "cancelled";

export interface PdfRuntimeValue {
  client: Client | null;
  hostKind: HostKind;
  target: LaunchPdfTarget | null;
  filePath: string | null;
  fileName: string;
  status: DocumentStatus;
  errorMessage: string | null;
  passwordWrong: boolean;
  encrypted: boolean;
  doc: PDFDocumentProxy | null;
  sizes: PageSize[];
  baseRots: number[];
  outline: OutlineNode[] | null;
  formCatalog: FormCatalog | null;
  openFromDialog(): Promise<void>;
  openDroppedFile(file: File, resolvePath: (file: File) => string | null): Promise<void>;
  openTarget(target: LaunchPdfTarget): Promise<void>;
  closeDocument(): void;
  submitPassword(password: string): Promise<void>;
  cancelPassword(): void;
  persist(request: SavePdfRequest, mode: "save" | "save-as"): Promise<PersistResult>;
  reload(): Promise<void>;
}

const PdfRuntimeContext = createContext<PdfRuntimeValue | null>(null);

function isPasswordException(error: unknown): boolean {
  return Boolean(error) && (error as { name?: string }).name === "PasswordException";
}

function resolveErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return String(error ?? "未知错误");
}

export function PdfRuntimeProvider({ children }: { children: ReactNode }): React.ReactElement {
  const { client, setActiveSceneId } = useAppRuntime();
  const { message } = AntdApp.useApp();
  const [hostKind, setHostKind] = useState<HostKind>("desktop");
  const [target, setTarget] = useState<LaunchPdfTarget | null>(null);
  const [status, setStatus] = useState<DocumentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [passwordWrong, setPasswordWrong] = useState(false);
  const [encrypted, setEncrypted] = useState(false);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [baseRots, setBaseRots] = useState<number[]>([]);
  const [outline, setOutline] = useState<OutlineNode[] | null>(null);
  const [formCatalog, setFormCatalog] = useState<FormCatalog | null>(null);

  const bytesRef = useRef<Uint8Array | null>(null);
  const passwordRef = useRef<string | undefined>(undefined);
  const loadingTaskRef = useRef<ReturnType<typeof getDocument> | null>(null);
  const targetRef = useRef<LaunchPdfTarget | null>(null);
  const loadTokenRef = useRef(0);
  const officeSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveHostKind(client).then((kind) => {
      if (!cancelled) setHostKind(kind);
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const destroyCurrent = useCallback((): void => {
    const task = loadingTaskRef.current;
    loadingTaskRef.current = null;
    if (task) {
      void task.destroy().catch(() => {});
    }
  }, []);

  const openTarget = useCallback(
    async (nextTarget: LaunchPdfTarget): Promise<void> => {
      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;
      destroyCurrent();
      targetRef.current = nextTarget;
      setTarget(nextTarget);
      setStatus("loading");
      setErrorMessage(null);
      setPasswordWrong(false);
      setDoc(null);
      setSizes([]);
      setBaseRots([]);
      setOutline(null);
      setFormCatalog(null);
      setActiveSceneId("document");

      let nextOfficeSessionId: string | null = null;
      try {
        let bytes: Uint8Array;
        if (client && hostKind !== "web" && nextTarget.filePath) {
          const officeDocument = await client.office.open({
            filePath: nextTarget.filePath,
            format: "pdf",
          });
          nextOfficeSessionId = officeDocument.sessionId;
          bytes = (await client.office.read(nextOfficeSessionId)).bytes;
        } else {
          bytes = await readPdfBytes(client, nextTarget);
        }
        if (loadTokenRef.current !== token) {
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
        bytesRef.current = bytes;
        passwordRef.current = undefined;
        const loaded = await getDocument({ data: bytes.slice(), ...DOC_OPTIONS }).promise;
        if (loadTokenRef.current !== token) {
          void loaded.loadingTask.destroy().catch(() => {});
          if (nextOfficeSessionId) {
            if (officeSessionIdRef.current === nextOfficeSessionId) {
              officeSessionIdRef.current = null;
            }
            await client?.office.close(nextOfficeSessionId).catch(() => undefined);
          }
          return;
        }
        loadingTaskRef.current = loaded.loadingTask;
        const all: PageSize[] = [];
        const rots: number[] = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const page = await loaded.getPage(i);
          const vp = page.getViewport({ scale: 1, rotation: 0 });
          all.push({ width: vp.width, height: vp.height });
          rots.push(page.rotate ?? 0);
        }
        if (loadTokenRef.current !== token) {
          if (nextOfficeSessionId) {
            if (officeSessionIdRef.current === nextOfficeSessionId) {
              officeSessionIdRef.current = null;
            }
            await client?.office.close(nextOfficeSessionId).catch(() => undefined);
          }
          return;
        }
        let catalog: FormCatalog | null = null;
        try {
          catalog = await buildFormCatalog(loaded);
        } catch {
          catalog = { widgets: [], fields: new Map(), byPage: new Map() };
        }
        let nextOutline: OutlineNode[] | null = null;
        try {
          const raw = await loaded.getOutline();
          nextOutline = raw && raw.length > 0 ? (raw as OutlineNode[]) : null;
        } catch {
          nextOutline = null;
        }
        if (loadTokenRef.current !== token) {
          if (nextOfficeSessionId) {
            if (officeSessionIdRef.current === nextOfficeSessionId) {
              officeSessionIdRef.current = null;
            }
            await client?.office.close(nextOfficeSessionId).catch(() => undefined);
          }
          return;
        }
        setEncrypted(false);
        setFormCatalog(catalog);
        setSizes(all);
        setBaseRots(rots);
        setOutline(nextOutline);
        setDoc(loaded);
        setStatus("ready");
      } catch (error) {
        if (loadTokenRef.current !== token) return;
        if (nextOfficeSessionId) {
          if (officeSessionIdRef.current === nextOfficeSessionId) {
            officeSessionIdRef.current = null;
          }
          await client?.office.close(nextOfficeSessionId).catch(() => undefined);
        }
        if (isPasswordException(error)) {
          setPasswordWrong(passwordRef.current !== undefined);
          passwordRef.current = undefined;
          setStatus("password");
          return;
        }
        setErrorMessage(resolveErrorMessage(error));
        setStatus("error");
      }
    },
    [client, destroyCurrent, hostKind, setActiveSceneId],
  );

  const submitPassword = useCallback(
    async (password: string): Promise<void> => {
      const currentTarget = targetRef.current;
      if (!currentTarget) return;
      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;
      destroyCurrent();
      setStatus("loading");
      setErrorMessage(null);
      try {
        const bytes = bytesRef.current;
        if (!bytes) throw new Error("文档字节缺失，请重新打开。");
        passwordRef.current = password;
        const loaded = await getDocument({
          data: bytes.slice(),
          password,
          ...DOC_OPTIONS,
        }).promise;
        if (loadTokenRef.current !== token) {
          void loaded.loadingTask.destroy().catch(() => {});
          return;
        }
        loadingTaskRef.current = loaded.loadingTask;
        const all: PageSize[] = [];
        const rots: number[] = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const page = await loaded.getPage(i);
          const vp = page.getViewport({ scale: 1, rotation: 0 });
          all.push({ width: vp.width, height: vp.height });
          rots.push(page.rotate ?? 0);
        }
        if (loadTokenRef.current !== token) return;
        let catalog: FormCatalog | null = null;
        try {
          catalog = await buildFormCatalog(loaded);
        } catch {
          catalog = { widgets: [], fields: new Map(), byPage: new Map() };
        }
        let nextOutline: OutlineNode[] | null = null;
        try {
          const raw = await loaded.getOutline();
          nextOutline = raw && raw.length > 0 ? (raw as OutlineNode[]) : null;
        } catch {
          nextOutline = null;
        }
        setEncrypted(true);
        setPasswordWrong(false);
        setFormCatalog(catalog);
        setSizes(all);
        setBaseRots(rots);
        setOutline(nextOutline);
        setDoc(loaded);
        setStatus("ready");
      } catch (error) {
        if (loadTokenRef.current !== token) return;
        if (isPasswordException(error)) {
          setPasswordWrong(true);
          setStatus("password");
          return;
        }
        setErrorMessage(resolveErrorMessage(error));
        setStatus("error");
      }
    },
    [destroyCurrent],
  );

  const cancelPassword = useCallback((): void => {
    passwordRef.current = undefined;
    targetRef.current = null;
    setTarget(null);
    setDoc(null);
    const officeSessionId = officeSessionIdRef.current;
    officeSessionIdRef.current = null;
    if (officeSessionId) {
      void client?.office.close(officeSessionId).catch(() => undefined);
    }
    setStatus("idle");
    setActiveSceneId("start");
  }, [client, setActiveSceneId]);

  const openFromDialog = useCallback(async (): Promise<void> => {
    try {
      const path = await openPdfDialog(client, formatMessage("pdf.dialog.openFile.title"));
      if (!path) return;
      await openTarget(createDialogPdfTarget(path));
    } catch (error) {
      message.warning(formatMessage("pdf.error.bridgeUnavailable"));
      void error;
    }
  }, [client, message, openTarget]);

  const openDroppedFile = useCallback(
    async (file: File, resolvePath: (file: File) => string | null): Promise<void> => {
      const bridgePath = resolvePath(file);
      const droppedPath = bridgePath ?? (file as File & { path?: string }).path ?? null;
      const droppedTarget: LaunchPdfTarget | null = droppedPath
        ? {
            sourceId: droppedPath,
            filePath: droppedPath,
            fileName: file.name,
            mimeType: file.type || undefined,
          }
        : null;
      if (!droppedTarget) {
        message.warning(formatMessage("pdf.error.bridgeUnavailable"));
        return;
      }
      await openTarget(droppedTarget);
    },
    [message, openTarget],
  );

  const closeDocument = useCallback((): void => {
    loadTokenRef.current += 1;
    destroyCurrent();
    targetRef.current = null;
    setTarget(null);
    setDoc(null);
    bytesRef.current = null;
    const officeSessionId = officeSessionIdRef.current;
    officeSessionIdRef.current = null;
    if (officeSessionId) {
      void client?.office.close(officeSessionId).catch(() => undefined);
    }
    setStatus("idle");
    setErrorMessage(null);
    setActiveSceneId("start");
  }, [client, destroyCurrent, setActiveSceneId]);

  const reload = useCallback(async (): Promise<void> => {
    const currentTarget = targetRef.current;
    if (!currentTarget) return;
    passwordRef.current = undefined;
    await openTarget({ ...currentTarget });
  }, [openTarget]);

  const persist = useCallback(
    async (request: SavePdfRequest, mode: "save" | "save-as"): Promise<PersistResult> => {
      const currentTarget = targetRef.current;
      const bytes = bytesRef.current;
      if (!currentTarget || !bytes) {
        message.warning(formatMessage("pdf.message.nothingToSave"));
        return "cancelled";
      }
      if (passwordRef.current !== undefined || encrypted) {
        message.warning(formatMessage("pdf.message.readOnly"));
        return "cancelled";
      }

      let destinationPath: string | null = currentTarget.filePath ?? null;
      if (hostKind !== "web" && (mode === "save-as" || !destinationPath)) {
        const picked = await savePdfDialog(
          client,
          formatMessage("pdf.dialog.saveFile.title"),
          currentTarget.fileName,
        );
        if (!picked) return "cancelled";
        destinationPath = picked;
      }

      try {
        const output = await applySaveRequest(bytes, request);
        let written: string;
        if (client && hostKind !== "web" && destinationPath && officeSessionIdRef.current) {
          await client.office.write(officeSessionIdRef.current, output);
          const document = await client.office.persist(officeSessionIdRef.current, destinationPath);
          written = document.filePath;
        } else {
          written = await writePdfBytes(
            client,
            hostKind,
            destinationPath,
            currentTarget.fileName,
            output,
          );
        }
        message.success(formatMessage("pdf.message.saveSuccess", { path: written }));
        if (destinationPath && destinationPath !== currentTarget.filePath) {
          // 另存为到新路径后，后续保存指向新文件
          const nextTarget: LaunchPdfTarget = {
            ...currentTarget,
            sourceId: destinationPath,
            filePath: destinationPath,
            fileName: destinationPath.split(/[\\/]/).pop() ?? currentTarget.fileName,
          };
          targetRef.current = nextTarget;
          setTarget(nextTarget);
        }
        bytesRef.current = output;
        return hostKind === "web" || !destinationPath ? "downloaded" : "written";
      } catch (error) {
        message.error(
          formatMessage("pdf.message.saveFailed", { reason: resolveErrorMessage(error) }),
        );
        return "cancelled";
      }
    },
    [client, encrypted, hostKind, message],
  );

  useEffect(() => {
    return () => {
      const officeSessionId = officeSessionIdRef.current;
      officeSessionIdRef.current = null;
      if (officeSessionId) {
        void client?.office.close(officeSessionId).catch(() => undefined);
      }
    };
  }, [client]);

  const value = useMemo<PdfRuntimeValue>(
    () => ({
      client,
      hostKind,
      target,
      filePath: target?.filePath ?? null,
      fileName: target?.fileName ?? "",
      status,
      errorMessage,
      passwordWrong,
      encrypted,
      doc,
      sizes,
      baseRots,
      outline,
      formCatalog,
      openFromDialog,
      openDroppedFile,
      openTarget,
      closeDocument,
      submitPassword,
      cancelPassword,
      persist,
      reload,
    }),
    [
      cancelPassword,
      client,
      closeDocument,
      doc,
      encrypted,
      errorMessage,
      formCatalog,
      hostKind,
      openDroppedFile,
      openFromDialog,
      openTarget,
      outline,
      baseRots,
      passwordWrong,
      persist,
      reload,
      sizes,
      status,
      submitPassword,
      target,
    ],
  );

  return <PdfRuntimeContext.Provider value={value}>{children}</PdfRuntimeContext.Provider>;
}

export function usePdfRuntime(): PdfRuntimeValue {
  const context = useContext(PdfRuntimeContext);
  if (!context) {
    throw new Error("usePdfRuntime 必须在 PdfRuntimeProvider 内使用。");
  }
  return context;
}
