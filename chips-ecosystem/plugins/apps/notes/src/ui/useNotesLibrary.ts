import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createIsolatedDocumentGateway,
  DocumentGatewayError,
  loadNoteOutline,
  loadNotebookDetail,
  type NotesDocumentGateway,
} from '../domain/notes/documentGateway';
import {
  addDocument,
  contentNodeDisplay,
  countEntriesByEnabled,
  EMPTY_NOTES_LIBRARY,
  findDocument,
  normalizeDocumentSource,
  type NoteDocumentDetail,
  type NotesLibrary,
  type OpenedDocumentSummary,
} from '../domain/notes/model';

/** 笔记库加载状态：空闲 / 打开中 / 就绪 / 失败（失败必携错误码）。 */
export type NotesLibraryStatus = 'idle' | 'opening' | 'ready' | 'error';

/** 已装配内容节点的缓存条目（展示串已生成；解析失败以错误码占位文本呈现）。 */
export interface NodeContentEntry {
  readonly nodeId: string;
  readonly display: string;
  readonly errorCode: string | null;
}

/** `useNotesLibrary` 返回值（界面层唯一消费面）。 */
export interface UseNotesLibraryResult {
  readonly library: NotesLibrary;
  readonly status: NotesLibraryStatus;
  readonly errorCode: string | null;
  readonly feedback: string | null;
  readonly selectedId: string | null;
  readonly selected: OpenedDocumentSummary | null;
  readonly detail: NoteDocumentDetail | null;
  readonly nodeContents: ReadonlyMap<string, NodeContentEntry>;
  readonly entryCounts: { readonly enabled: number; readonly disabled: number } | null;
  readonly openSource: (input: string) => Promise<void>;
  readonly select: (documentId: string) => Promise<void>;
  readonly loadNodeContent: (nodeId: string) => Promise<void>;
  readonly refreshCurrent: () => Promise<void>;
}

/**
 * 笔记库控制器：打开投递 → 库收录 → 选中装配 → 内容节点懒加载。
 *
 * - 打开臂经 `document:open` 正式面（宿主真实现，工单036 波 C3）；失败以
 *   简体中文反馈 + 错误码如实呈现，不伪造成功；
 * - 装配面：箱子一次成卷（元数据 + 条目），卡片装配元数据 + 结构，内容节点
 *   按需经 `document:read` 逐节点读取（卡片 content 切片必须携带 `nodeId`）；
 * - 写臂（编辑/保存）属编辑链路臂（候 IEditSession 生产装载，工单036 波 C 终闸），
 *   本臂不接线，界面以只读消费呈现。
 */
export function useNotesLibrary(gateway: NotesDocumentGateway = createIsolatedDocumentGateway()): UseNotesLibraryResult {
  const [library, setLibrary] = useState<NotesLibrary>(EMPTY_NOTES_LIBRARY);
  const [status, setStatus] = useState<NotesLibraryStatus>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NoteDocumentDetail | null>(null);
  const [nodeContents, setNodeContents] = useState<ReadonlyMap<string, NodeContentEntry>>(new Map());
  const selectedIdRef = useRef<string | null>(null);
  const libraryRef = useRef<NotesLibrary>(EMPTY_NOTES_LIBRARY);

  libraryRef.current = library;
  selectedIdRef.current = selectedId;

  const describeError = useCallback((error: unknown): string => {
    return error instanceof DocumentGatewayError ? error.code : 'DOCUMENT_GATEWAY_ERROR';
  }, []);

  /** 装配选中文档的整卷视图（卡片 → 大纲；箱子 → 成卷）。 */
  const assemble = useCallback(
    async (summary: OpenedDocumentSummary): Promise<void> => {
      if (summary.kind === 'box') {
        const loaded = await loadNotebookDetail(gateway, summary.documentId);
        setDetail(loaded);
        setNodeContents(new Map());
        return;
      }
      const loaded = await loadNoteOutline(gateway, summary.documentId);
      setDetail(loaded);
      setNodeContents(new Map());
    },
    [gateway],
  );

  const openSource = useCallback(
    async (input: string): Promise<void> => {
      const source = normalizeDocumentSource(input);
      if (source === null) {
        setFeedback('请输入非空的文档来源引用');
        return;
      }
      setStatus('opening');
      setErrorCode(null);
      try {
        const summary = await gateway.open(source);
        setLibrary((current) => addDocument(current, summary));
        setSelectedId(summary.documentId);
        setStatus('ready');
        await assemble(summary);
        setFeedback(`已打开「${summary.title}」`);
      } catch (error: unknown) {
        setStatus('error');
        setErrorCode(describeError(error));
        setFeedback(`文档打开失败（${describeError(error)}）：请核对来源引用与文档可用性`);
      }
    },
    [assemble, describeError, gateway],
  );

  const select = useCallback(
    async (documentId: string): Promise<void> => {
      const summary = findDocument(libraryRef.current, documentId);
      if (summary === null) {
        return;
      }
      setSelectedId(documentId);
      setErrorCode(null);
      try {
        await assemble(summary);
      } catch (error: unknown) {
        setErrorCode(describeError(error));
        setFeedback(`文档读取失败（${describeError(error)}）`);
      }
    },
    [assemble, describeError],
  );

  const loadNodeContent = useCallback(
    async (nodeId: string): Promise<void> => {
      const documentId = selectedIdRef.current;
      if (documentId === null || detail === null || detail.kind !== 'card') {
        return;
      }
      if (nodeContents.has(nodeId)) {
        return;
      }
      try {
        const node = await gateway.readCardContent(documentId, nodeId);
        setNodeContents(
          new Map(nodeContents).set(nodeId, {
            nodeId,
            display: contentNodeDisplay(node),
            errorCode: null,
          }),
        );
      } catch (error: unknown) {
        setNodeContents(
          new Map(nodeContents).set(nodeId, {
            nodeId,
            display: '',
            errorCode: describeError(error),
          }),
        );
      }
    },
    [describeError, detail, gateway, nodeContents],
  );

  const refreshCurrent = useCallback(async (): Promise<void> => {
    const documentId = selectedIdRef.current;
    if (documentId === null) {
      setFeedback('当前没有选中的笔记文档');
      return;
    }
    const summary = findDocument(libraryRef.current, documentId);
    if (summary === null) {
      return;
    }
    setErrorCode(null);
    try {
      await assemble(summary);
      setFeedback('当前视图已刷新');
    } catch (error: unknown) {
      setErrorCode(describeError(error));
      setFeedback(`文档刷新失败（${describeError(error)}）`);
    }
  }, [assemble, describeError]);

  // 打开失败后的反馈条不自动消退（错误须显式处置）；成功提示由界面按时点清理。
  useEffect(() => {
    if (feedback === null || status === 'error') {
      return;
    }
    const timer = window.setTimeout((): void => {
      setFeedback(null);
    }, 2400);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [feedback, status]);

  const selected = useMemo(
    () => (selectedId === null ? null : findDocument(library, selectedId)),
    [library, selectedId],
  );

  const entryCounts = useMemo(
    () => (detail !== null && detail.kind === 'box' ? countEntriesByEnabled(detail.entries) : null),
    [detail],
  );

  return {
    library,
    status,
    errorCode,
    feedback,
    selectedId,
    selected,
    detail,
    nodeContents,
    entryCounts,
    openSource,
    select,
    loadNodeContent,
    refreshCurrent,
  };
}
