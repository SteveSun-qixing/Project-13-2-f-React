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
import type { Client } from "chips-sdk";
import { useChips } from "@chips/ui";
import { getDocument } from "pdfjs-dist";
// 副作用导入：顶层注册 globalThis.pdfjsWorker，供 pdfjs 在未设置 workerSrc 时的 fake worker 回退使用
import "pdfjs-dist/build/pdf.worker.mjs";
import type {
  Annotation,
  DocumentStatus,
  PageSize,
  PdfDocumentInfo,
  SearchResult,
  ZoomMode,
  ZoomState,
} from "../types";

const DOC_OPTIONS = {
  cMapUrl: new URL("pdfjs-dist/cmaps/", import.meta.url).toString(),
  cMapPacked: true,
  standardFontDataUrl: new URL("pdfjs-dist/standard_fonts/", import.meta.url).toString(),
  verbosity: 0,
} as const;

export interface LaunchPdfTarget {
  sourceId?: string;
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  resourceId?: string;
}

export interface PdfRuntimeValue {
  client: Client | null;
  status: DocumentStatus;
  errorMessage: string | null;
  doc: unknown;
  fileName: string;
  filePath: string | null;
  numPages: number;
  currentPage: number;
  pageSizes: PageSize[];
  zoom: ZoomState;
  rotation: number;
  outline: OutlineNode[] | null;
  documentInfo: PdfDocumentInfo | null;
  searchQuery: string;
  searchResults: SearchResult[];
  searchCurrentIndex: number;
  isSearching: boolean;
  annotations: Annotation[];
  showThumbnails: boolean;
  showSearch: boolean;
  isLoading: boolean;

  openTarget(target: LaunchPdfTarget): Promise<void>;
  openFromDialog(): Promise<void>;
  closeDocument(): void;
  goToPage(pageNumber: number): void;
  nextPage(): void;
  prevPage(): void;
  setZoom(mode: ZoomMode, scale?: number): void;
  rotatePage(pageIndex: number, degrees: number): void;
  rotateAll(): void;
  setSearchQuery(query: string): void;
  nextSearchResult(): void;
  prevSearchResult(): void;
  clearSearch(): void;
  addAnnotation(annotation: Omit<Annotation, "id" | "createdAt">): void;
  updateAnnotation(id: string, updates: Partial<Annotation>): void;
  removeAnnotation(id: string): void;
  toggleThumbnails(): void;
  toggleSearch(): void;
  print(): void;
}

interface OutlineNode {
  title: string;
  dest?: string;
  items?: OutlineNode[];
}

const PdfRuntimeContext = createContext<PdfRuntimeValue | null>(null);

function generateId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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

async function readPdfBytes(
  client: Client | null,
  target: LaunchPdfTarget,
): Promise<Uint8Array> {
  if (client && target.filePath) {
    const session = await client.file.session.open({
      filePath: target.filePath,
      format: "pdf",
    });
    const result = await client.file.session.read({ sessionId: session.sessionId });
    await client.file.session.close({ sessionId: session.sessionId });
    return result.bytes;
  }

  if (target.resourceId && client) {
    const buffer = await client.resource.readBinary(target.resourceId);
    return new Uint8Array(buffer);
  }

  throw new Error("无法读取 PDF 文件：缺少文件路径或资源 ID");
}

export interface PdfRuntimeProviderProps {
  children: ReactNode;
}

export function PdfRuntimeProvider({ children }: PdfRuntimeProviderProps): React.ReactElement {
  const { client, launchContext } = useChips();
  const { message } = AntdApp.useApp();

  const [status, setStatus] = useState<DocumentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [doc, setDoc] = useState<unknown>(null);
  const [fileName, setFileName] = useState("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [zoom, setZoomState] = useState<ZoomState>({ mode: "fit-width", scale: 1.0 });
  const [rotation, setRotation] = useState(0);
  const [outline, setOutline] = useState<OutlineNode[] | null>(null);
  const [documentInfo, setDocumentInfo] = useState<PdfDocumentInfo | null>(null);
  const [searchQuery, setSearchQueryState] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchCurrentIndex, setSearchCurrentIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadingTaskRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const loadTokenRef = useRef(0);
  const officeSessionIdRef = useRef<string | null>(null);
  const bytesRef = useRef<Uint8Array | null>(null);

  const openTarget = useCallback(
    async (target: LaunchPdfTarget): Promise<void> => {
      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;

      if (loadingTaskRef.current) {
        await loadingTaskRef.current.destroy().catch(() => {});
        loadingTaskRef.current = null;
      }

      setStatus("loading");
      setIsLoading(true);
      setErrorMessage(null);
      setDoc(null);
      setPageSizes([]);
      setOutline(null);
      setSearchResults([]);
      setSearchQueryState("");

      if (target.fileName) {
        setFileName(target.fileName);
      }
      if (target.filePath) {
        setFilePath(target.filePath);
      }

      try {
        let bytes: Uint8Array;
        if (client && target.filePath) {
          const session = await client.file.session.open({
            filePath: target.filePath,
            format: "pdf",
          });
          officeSessionIdRef.current = session.sessionId;
          const result = await client.file.session.read({ sessionId: session.sessionId });
          bytes = result.bytes;
        } else if (target.resourceId && client) {
          const buffer = await client.resource.readBinary(target.resourceId);
          bytes = new Uint8Array(buffer);
        } else {
          throw new Error("无法读取 PDF 文件：缺少文件路径或资源 ID");
        }

        if (loadTokenRef.current !== token) return;

        bytesRef.current = bytes;

        const loadingTask = getDocument({
          data: new Uint8Array(bytes),
          ...DOC_OPTIONS,
        });
        loadingTaskRef.current = loadingTask;

        const loaded = await loadingTask.promise;

        if (loadTokenRef.current !== token) {
          await loadingTask.destroy().catch(() => {});
          return;
        }

        const sizes: PageSize[] = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const page = await loaded.getPage(i);
          const viewport = page.getViewport({ scale: 1, rotation: 0 });
          sizes.push({ width: viewport.width, height: viewport.height });
        }

        let docOutline: OutlineNode[] | null = null;
        try {
          const rawOutline = await loaded.getOutline();
          if (rawOutline && rawOutline.length > 0) {
            docOutline = rawOutline as OutlineNode[];
          }
        } catch {
          docOutline = null;
        }

        let info: PdfDocumentInfo | null = null;
        try {
          const metadata = await loaded.getMetadata();
          info = metadata.info as PdfDocumentInfo;
        } catch {
          info = null;
        }

        setDoc(loaded);
        setNumPages(loaded.numPages);
        setPageSizes(sizes);
        setOutline(docOutline);
        setDocumentInfo(info);
        setCurrentPage(1);
        setRotation(0);
        setStatus("ready");
      } catch (error) {
        if (loadTokenRef.current !== token) return;

        if (isPasswordException(error)) {
          setStatus("password");
          return;
        }

        setErrorMessage(resolveErrorMessage(error));
        setStatus("error");
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  const openFromDialog = useCallback(async (): Promise<void> => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          const arrayBuffer = await file.arrayBuffer();
          await openTarget({
            fileName: file.name,
          });
        }
      };
      input.click();
    } catch (err) {
      message.warning("无法打开文件，请检查权限设置");
      console.error("打开文件失败:", err);
    }
  }, [message, openTarget]);

  const closeDocument = useCallback((): void => {
    loadTokenRef.current += 1;

    if (loadingTaskRef.current) {
      loadingTaskRef.current.destroy().catch(() => {});
      loadingTaskRef.current = null;
    }

    if (officeSessionIdRef.current && client) {
      client.file.session.close({ sessionId: officeSessionIdRef.current }).catch(() => {});
      officeSessionIdRef.current = null;
    }

    setDoc(null);
    setStatus("idle");
    setErrorMessage(null);
    setFileName("");
    setFilePath(null);
    setNumPages(0);
    setCurrentPage(1);
    setPageSizes([]);
    setOutline(null);
    setDocumentInfo(null);
    setSearchResults([]);
    setSearchQueryState("");
    setAnnotations([]);
    bytesRef.current = null;
  }, [client]);

  const goToPage = useCallback((pageNumber: number): void => {
    if (pageNumber >= 1) {
      setCurrentPage(pageNumber);
    }
  }, []);

  const nextPage = useCallback((): void => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  }, [numPages]);

  const prevPage = useCallback((): void => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const setZoom = useCallback((mode: ZoomMode, scale?: number): void => {
    if (mode === "custom" && scale !== undefined) {
      setZoomState({ mode, scale: Math.max(0.1, Math.min(scale, 10)) });
    } else {
      const defaultScale = mode === "fit-width" ? 1.0 : 1.0;
      setZoomState({ mode, scale: defaultScale });
    }
  }, []);

  const rotatePage = useCallback((pageIndex: number, degrees: number): void => {
    setRotation((prev) => (prev + degrees) % 360);
  }, []);

  const rotateAll = useCallback((): void => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const performSearch = useCallback(
    async (query: string): Promise<SearchResult[]> => {
      if (!query.trim() || !bytesRef.current) {
        return [];
      }

      try {
        const { pdfToText } = await import("../../../engine/file-parse/src/pdf");
        const text = await pdfToText(bytesRef.current);
        const results: SearchResult[] = [];
        const lines = text.split("\n");
        let pageIndex = 0;
        let charOffset = 0;

        for (const line of lines) {
          let searchStart = 0;
          let matchIndex: number;

          while ((matchIndex = line.toLowerCase().indexOf(query.toLowerCase(), searchStart)) !== -1) {
            if (results.length === 0 || results[results.length - 1].pageIndex !== pageIndex) {
              results.push({ pageIndex, matches: [] });
            }
            results[results.length - 1].matches.push({
              text: line.substring(matchIndex, matchIndex + query.length),
              startIndex: charOffset + matchIndex,
              endIndex: charOffset + matchIndex + query.length,
            });
            searchStart = matchIndex + 1;
          }

          charOffset += line.length + 1;
          if (charOffset > 50000) {
            pageIndex++;
            charOffset = 0;
          }
        }

        return results;
      } catch (error) {
        console.error("搜索失败:", error);
        return [];
      }
    },
    [],
  );

  const setSearchQuery = useCallback(
    async (query: string): Promise<void> => {
      setSearchQueryState(query);

      if (!query.trim()) {
        setSearchResults([]);
        setSearchCurrentIndex(0);
        return;
      }

      setIsSearching(true);
      try {
        const results = await performSearch(query);
        setSearchResults(results);
        setSearchCurrentIndex(0);

        if (results.length > 0 && results[0].pageIndex !== undefined) {
          setCurrentPage(results[0].pageIndex + 1);
        }
      } finally {
        setIsSearching(false);
      }
    },
    [performSearch],
  );

  const nextSearchResult = useCallback((): void => {
    if (searchResults.length === 0) return;
    const nextIndex = (searchCurrentIndex + 1) % searchResults.length;
    setSearchCurrentIndex(nextIndex);
    const result = searchResults[nextIndex];
    if (result && result.pageIndex !== undefined) {
      setCurrentPage(result.pageIndex + 1);
    }
  }, [searchCurrentIndex, searchResults]);

  const prevSearchResult = useCallback((): void => {
    if (searchResults.length === 0) return;
    const prevIndex = searchCurrentIndex === 0 ? searchResults.length - 1 : searchCurrentIndex - 1;
    setSearchCurrentIndex(prevIndex);
    const result = searchResults[prevIndex];
    if (result && result.pageIndex !== undefined) {
      setCurrentPage(result.pageIndex + 1);
    }
  }, [searchCurrentIndex, searchResults]);

  const clearSearch = useCallback((): void => {
    setSearchQueryState("");
    setSearchResults([]);
    setSearchCurrentIndex(0);
  }, []);

  const addAnnotation = useCallback(
    (annotation: Omit<Annotation, "id" | "createdAt">): void => {
      const newAnnotation: Annotation = {
        ...annotation,
        id: generateId(),
        createdAt: Date.now(),
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
    },
    [],
  );

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>): void => {
    setAnnotations((prev) =>
      prev.map((ann) => (ann.id === id ? { ...ann, ...updates } : ann)),
    );
  }, []);

  const removeAnnotation = useCallback((id: string): void => {
    setAnnotations((prev) => prev.filter((ann) => ann.id !== id));
  }, []);

  const toggleThumbnails = useCallback((): void => {
    setShowThumbnails((prev) => !prev);
  }, []);

  const toggleSearch = useCallback((): void => {
    setShowSearch((prev) => !prev);
  }, []);

  const print = useCallback((): void => {
    window.print();
  }, []);

  useEffect(() => {
    return () => {
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy().catch(() => {});
      }
      if (officeSessionIdRef.current && client) {
      client.file.session.close({ sessionId: officeSessionIdRef.current }).catch(() => {});
      }
    };
  }, [client]);

  const value = useMemo<PdfRuntimeValue>(
    () => ({
      client,
      status,
      errorMessage,
      doc,
      fileName,
      filePath,
      numPages,
      currentPage,
      pageSizes,
      zoom,
      rotation,
      outline,
      documentInfo,
      searchQuery,
      searchResults,
      searchCurrentIndex,
      isSearching,
      annotations,
      showThumbnails,
      showSearch,
      isLoading,
      openTarget,
      openFromDialog,
      closeDocument,
      goToPage,
      nextPage,
      prevPage,
      setZoom,
      rotatePage,
      rotateAll,
      setSearchQuery,
      nextSearchResult,
      prevSearchResult,
      clearSearch,
      addAnnotation,
      updateAnnotation,
      removeAnnotation,
      toggleThumbnails,
      toggleSearch,
      print,
    }),
    [
      client,
      status,
      errorMessage,
      doc,
      fileName,
      filePath,
      numPages,
      currentPage,
      pageSizes,
      zoom,
      rotation,
      outline,
      documentInfo,
      searchQuery,
      searchResults,
      searchCurrentIndex,
      isSearching,
      annotations,
      showThumbnails,
      showSearch,
      isLoading,
      openTarget,
      openFromDialog,
      closeDocument,
      goToPage,
      nextPage,
      prevPage,
      setZoom,
      rotatePage,
      rotateAll,
      setSearchQuery,
      nextSearchResult,
      prevSearchResult,
      clearSearch,
      addAnnotation,
      updateAnnotation,
      removeAnnotation,
      toggleThumbnails,
      toggleSearch,
      print,
    ],
  );

  return <PdfRuntimeContext.Provider value={value}>{children}</PdfRuntimeContext.Provider>;
}

export function usePdfRuntime(): PdfRuntimeValue {
  const context = useContext(PdfRuntimeContext);
  if (!context) {
    throw new Error("usePdfRuntime 必须在 PdfRuntimeProvider 内使用");
  }
  return context;
}

export function usePdf(): PdfRuntimeValue {
  return usePdfRuntime();
}
