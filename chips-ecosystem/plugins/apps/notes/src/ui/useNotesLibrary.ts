import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createIsolatedDocumentGateway,
  describeGatewayError,
  DocumentGatewayError,
  loadNoteOutline,
  loadNotebookDetail,
  type NotesDocumentGateway,
} from '../domain/notes/documentGateway';
import {
  buildContentWriteSlice,
  buildMetadataWriteSlice,
  NoteEditSession,
  type NoteEditChange,
} from '../domain/notes/editSession';
import {
  addDocument,
  applyDocumentTitle,
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

/** 写链错误面（真实错误码 + 通道消息；界面叠加处置指引，不吞错）。 */
export interface NotesWriteError {
  readonly code: string;
  readonly message: string;
}

/** 内容节点暂存结果（JSON 文本装配守卫回执）。 */
export type ContentStagingResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errorCode: string; readonly message: string };

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
  /** 选中文档的修订水位（`document:write` 回执驱动；0 = 本会话尚未写入）。 */
  readonly revision: number;
  /** 最近一次 `document:save` 回执摘要（保存会话作用域）。 */
  readonly savedDigest: string | null;
  /** 写链行内错误（冲突/失败臂；真实错误码，不吞错）。 */
  readonly writeError: NotesWriteError | null;
  /** 编辑会话待提交变更投影。 */
  readonly pendingChange: NoteEditChange | null;
  readonly commitBusy: boolean;
  readonly saveBusy: boolean;
  readonly openSource: (input: string) => Promise<void>;
  readonly select: (documentId: string) => Promise<void>;
  readonly loadNodeContent: (nodeId: string) => Promise<void>;
  readonly refreshCurrent: () => Promise<void>;
  readonly stageRename: (nextName: string) => void;
  readonly stageDescription: (nextDescription: string) => void;
  readonly stageNodeContent: (nodeId: string, jsonText: string) => ContentStagingResult;
  readonly discardEdits: () => void;
  readonly commitPending: () => Promise<void>;
  readonly saveToDisk: () => Promise<void>;
}

/**
 * 笔记库控制器：打开投递 → 库收录 → 选中装配 → 内容节点懒加载 → 编辑写链。
 *
 * - 打开/读取臂经 `document:open` / `document:read` 正式面（宿主真实现，工单036 波 C3）；
 * - 写臂（本臂翻正）：编辑会话按《本轮架构收口裁决》B3 唯一时序落——`getChange()` → 校验 →
 *   `document:write`（`{ revision }` 回执驱动修订水位）→ 写后重读投影更新 → `markCommitted`；
 *   落盘唯一入口 `document:save`（回执摘要呈现）；应用不落盘、不本地拼装第二事实源；
 * - 冲突/失败臂：`DOCUMENT_WRITE_CONFLICT` / `DOCUMENT_SAVE_FAILED` 等真实错误码行内
 *   简体中文呈现，不吞错、不假成功；失败不丢待提交变更（可重试）。
 */
export function useNotesLibrary(gateway: NotesDocumentGateway = createIsolatedDocumentGateway()): UseNotesLibraryResult {
  const [library, setLibrary] = useState<NotesLibrary>(EMPTY_NOTES_LIBRARY);
  const [status, setStatus] = useState<NotesLibraryStatus>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NoteDocumentDetail | null>(null);
  const [nodeContents, setNodeContents] = useState<ReadonlyMap<string, NodeContentEntry>>(new Map());
  const [revision, setRevision] = useState(0);
  const [savedDigest, setSavedDigest] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<NotesWriteError | null>(null);
  const [pendingChange, setPendingChange] = useState<NoteEditChange | null>(null);
  const [commitBusy, setCommitBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const selectedIdRef = useRef<string | null>(null);
  const libraryRef = useRef<NotesLibrary>(EMPTY_NOTES_LIBRARY);
  const detailRef = useRef<NoteDocumentDetail | null>(null);
  const nodeContentsRef = useRef<ReadonlyMap<string, NodeContentEntry>>(new Map());
  const sessionsRef = useRef<Map<string, NoteEditSession>>(new Map());

  libraryRef.current = library;
  selectedIdRef.current = selectedId;
  detailRef.current = detail;
  nodeContentsRef.current = nodeContents;

  const describeError = useCallback((error: unknown): string => {
    return error instanceof DocumentGatewayError ? error.code : 'DOCUMENT_GATEWAY_ERROR';
  }, []);

  /** 取（或建）选中文档的编辑会话：修订水位随文档持续，切换选区不丢回执历史。 */
  const ensureSession = useCallback((documentId: string): NoteEditSession => {
    const existing = sessionsRef.current.get(documentId);
    if (existing !== undefined) {
      return existing;
    }
    const created = new NoteEditSession(documentId);
    sessionsRef.current.set(documentId, created);
    return created;
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
        setWriteError(null);
        setSavedDigest(null);
        const session = ensureSession(summary.documentId);
        setRevision(session.revision);
        setPendingChange(session.getChange());
        await assemble(summary);
        setFeedback(`已打开「${summary.title}」`);
      } catch (error: unknown) {
        setStatus('error');
        setErrorCode(describeError(error));
        setFeedback(`文档打开失败（${describeError(error)}）：请核对来源引用与文档可用性`);
      }
    },
    [assemble, describeError, ensureSession, gateway],
  );

  const select = useCallback(
    async (documentId: string): Promise<void> => {
      const summary = findDocument(libraryRef.current, documentId);
      if (summary === null) {
        return;
      }
      setSelectedId(documentId);
      setErrorCode(null);
      setWriteError(null);
      setSavedDigest(null);
      const session = ensureSession(documentId);
      setRevision(session.revision);
      setPendingChange(session.getChange());
      try {
        await assemble(summary);
      } catch (error: unknown) {
        setErrorCode(describeError(error));
        setFeedback(`文档读取失败（${describeError(error)}）`);
      }
    },
    [assemble, describeError, ensureSession],
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

  // ---------- 写臂：暂存（getChange 的待提交来源） ----------

  const stageRename = useCallback(
    (nextName: string): void => {
      const documentId = selectedIdRef.current;
      const current = detailRef.current;
      if (documentId === null || current === null) {
        return;
      }
      const session = ensureSession(documentId);
      session.stageRename(current.metadata.name, nextName);
      setPendingChange(session.getChange());
    },
    [ensureSession],
  );

  const stageDescription = useCallback(
    (nextDescription: string): void => {
      const documentId = selectedIdRef.current;
      const current = detailRef.current;
      if (documentId === null || current === null || current.kind !== 'box') {
        return;
      }
      const session = ensureSession(documentId);
      session.stageDescription(current.metadata.description, nextDescription);
      setPendingChange(session.getChange());
    },
    [ensureSession],
  );

  const stageNodeContent = useCallback(
    (nodeId: string, jsonText: string): ContentStagingResult => {
      const documentId = selectedIdRef.current;
      if (documentId === null) {
        return { ok: false, errorCode: 'DOCUMENT_GATEWAY_ERROR', message: '当前没有选中的笔记文档' };
      }
      const cached = nodeContentsRef.current.get(nodeId);
      const currentText = cached !== undefined && cached.errorCode === null ? cached.display : '';
      const session = ensureSession(documentId);
      const result = session.stageContent(nodeId, currentText, jsonText);
      setPendingChange(session.getChange());
      return result;
    },
    [ensureSession],
  );

  const discardEdits = useCallback((): void => {
    const documentId = selectedIdRef.current;
    if (documentId === null) {
      return;
    }
    sessionsRef.current.get(documentId)?.discard();
    setPendingChange(null);
  }, []);

  // ---------- 写臂：提交链（裁决唯一时序的应用前端侧落点） ----------

  /** 提交链第③拍执行器：按变更族装配 `document:write` 切片（整体替换语义）。 */
  const runWrite = useCallback(
    async (change: NoteEditChange): Promise<number> => {
      const documentId = selectedIdRef.current;
      if (documentId === null) {
        throw new DocumentGatewayError('DOCUMENT_GATEWAY_ERROR', '当前没有选中的笔记文档');
      }
      const current = detailRef.current;
      if (change.facet === 'rename' || change.facet === 'description') {
        if (current === null) {
          throw new DocumentGatewayError('DOCUMENT_GATEWAY_ERROR', '当前文档尚未装配，无法写入元数据');
        }
        const patch = change.facet === 'rename' ? { name: change.nextName } : { description: change.nextDescription };
        const slice = buildMetadataWriteSlice(current.metadata, patch, new Date().toISOString());
        return gateway.writeSlice({ documentId, part: 'metadata', value: slice });
      }
      // 内容写：按节点读改写——重读节点后整体替换 `value`，保留 node_id/file/card_type 包络。
      const node = await gateway.readCardContent(documentId, change.nodeId);
      return gateway.writeSlice({
        documentId,
        part: 'content',
        nodeId: change.nodeId,
        value: buildContentWriteSlice(node, change.nextValue),
      });
    },
    [gateway],
  );

  /** 提交链第④拍投影更新：写后经 `document:read` 重读宿主模型，不本地拼装。 */
  const applyWriteProjection = useCallback(
    async (change: NoteEditChange): Promise<void> => {
      const documentId = selectedIdRef.current;
      if (documentId === null) {
        throw new DocumentGatewayError('DOCUMENT_GATEWAY_ERROR', '当前没有选中的笔记文档');
      }
      if (change.facet === 'content') {
        const node = await gateway.readCardContent(documentId, change.nodeId);
        setNodeContents(
          new Map(nodeContentsRef.current).set(change.nodeId, {
            nodeId: change.nodeId,
            display: contentNodeDisplay(node),
            errorCode: null,
          }),
        );
        return;
      }
      const current = detailRef.current;
      if (current === null) {
        throw new DocumentGatewayError('DOCUMENT_GATEWAY_ERROR', '当前文档尚未装配，无法重读投影');
      }
      if (current.kind === 'card') {
        const metadata = await gateway.readCardMetadata(documentId);
        setDetail((prev) => (prev !== null && prev.kind === 'card' ? { ...prev, metadata } : prev));
        if (change.facet === 'rename') {
          setLibrary((prev) => applyDocumentTitle(prev, documentId, metadata.name));
        }
        return;
      }
      const metadata = await gateway.readBoxMetadata(documentId);
      setDetail((prev) => (prev !== null && prev.kind === 'box' ? { ...prev, metadata } : prev));
    },
    [gateway],
  );

  const commitPending = useCallback(async (): Promise<void> => {
    const documentId = selectedIdRef.current;
    if (documentId === null) {
      return;
    }
    const session = sessionsRef.current.get(documentId);
    if (session === undefined || !session.isDirty() || commitBusy) {
      return;
    }
    setWriteError(null);
    setCommitBusy(true);
    try {
      const outcome = await session.commit(runWrite, applyWriteProjection);
      if (outcome.status === 'committed') {
        setRevision(session.revision);
        setPendingChange(session.getChange());
        setFeedback(`修改已写入（修订号 ${outcome.revision}），保存到磁盘后落盘`);
        return;
      }
      if (outcome.status === 'revision-stale') {
        setWriteError({
          code: 'DOCUMENT_REVISION_INVALID',
          message: `修订回执未严格递增（收到 ${outcome.received}，当前 ${outcome.watermark}）`,
        });
        return;
      }
      if (outcome.status !== 'no-change') {
        setWriteError({ code: outcome.errorCode, message: outcome.message });
      }
    } finally {
      setCommitBusy(false);
    }
  }, [applyWriteProjection, commitBusy, runWrite]);

  // ---------- 写臂：落盘（document:save 唯一入口） ----------

  const saveToDisk = useCallback(async (): Promise<void> => {
    const documentId = selectedIdRef.current;
    if (documentId === null) {
      setFeedback('当前没有选中的笔记文档');
      return;
    }
    if (saveBusy) {
      return;
    }
    setWriteError(null);
    setSaveBusy(true);
    try {
      const receipt = await gateway.saveDocument(documentId);
      setSavedDigest(receipt.digest);
      // 保存后重读投影：宿主已按新磁盘基线收口（覆盖层清空），重读当前装配面。
      const summary = findDocument(libraryRef.current, documentId);
      if (summary !== null) {
        await assemble(summary);
      }
      setFeedback(`已保存到磁盘（摘要 ${receipt.digest}）`);
    } catch (error: unknown) {
      setWriteError(describeGatewayError(error));
    } finally {
      setSaveBusy(false);
    }
  }, [assemble, gateway, saveBusy]);

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
    revision,
    savedDigest,
    writeError,
    pendingChange,
    commitBusy,
    saveBusy,
    openSource,
    select,
    loadNodeContent,
    refreshCurrent,
    stageRename,
    stageDescription,
    stageNodeContent,
    discardEdits,
    commitPending,
    saveToDisk,
  };
}
