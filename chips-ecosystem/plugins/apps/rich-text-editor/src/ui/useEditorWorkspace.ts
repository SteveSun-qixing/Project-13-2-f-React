import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoxMetadata, Entry, IBaseCardEditor } from '@chips/sdk';
import {
  createIsolatedDocumentGateway,
  describeGatewayError,
  type DocumentGatewayError,
  type OpenedDocumentSummary,
  type RichTextDocumentGateway,
} from '../domain/editor/documentGateway';
import { RichTextEditSession, type RichTextCommitOutcome } from '../domain/editor/editSession';
import { assembleBaseCardView } from '../domain/editor/sessionView';

/**
 * 富文本编辑器工作区控制器（编辑臂）：打开投递 → 库收录 → 选中装配 → 插件编辑器附着 →
 * 编辑回流唯一时序 → 保存回执驱动界面。
 *
 * - 打开/读取臂经 `document:open` / `document:read` 正式面（宿主真实现，工单036 波 C3）；
 * - 写臂：编辑会话按回流唯一时序落——`getChange()` → 校验 → `document:write`（`{ revision }`
 *   回执驱动修订水位）→ 写后重读投影 → `markCommitted`；落盘唯一入口 `document:save`
 *   （回执摘要驱动保存态）；应用不落盘、不本地拼装第二事实源；
 * - 自动保存：编辑器 change 驱动的脏状态进入 500ms 防抖（12 §6.3 规则 1~2）；保存失败
 *   如实回码并停止自动重试（等待用户处置，不吞错、不假成功）；
 * - 冲突/失败臂：`DOCUMENT_WRITE_CONFLICT` / `DOCUMENT_SAVE_FAILED` 等真实错误码行内
 *   简体中文呈现；投影发散（外部并发修改）时以宿主真相重挂基线（`diverged` 臂）。
 */

/** 工作区加载状态：空闲 / 打开中 / 就绪 / 失败（失败必携错误码）。 */
export type WorkspaceStatus = 'idle' | 'opening' | 'ready' | 'error';

/** 行内错误面（真实错误码 + 通道消息；界面叠加处置指引，不吞错）。 */
export interface WorkspaceError {
  readonly code: string;
  readonly message: string;
}

/** 卡片编辑视图草稿：编辑器挂载的最小闭包。 */
export interface CardEditorDraft {
  readonly nodeId: string;
  readonly view: ReturnType<typeof assembleBaseCardView>;
}

/** 箱子只读摘要（卡箱浏览面最小可用）。 */
export interface BoxSummary {
  readonly metadata: BoxMetadata;
  readonly entries: readonly Entry[];
}

/** 程序化编辑驱动面（插件句柄的宿主驱动/测试入口，与键入同一事务路径）。 */
export interface EditorDriver {
  readonly insertText: (text: string) => void;
  readonly replaceDocument: (markdown: string) => void;
}

/** 库分面（卡库 / 卡箱两页，01.04 口径的两标签形态）。 */
export interface DocumentLibrary {
  readonly cards: readonly OpenedDocumentSummary[];
  readonly boxes: readonly OpenedDocumentSummary[];
}

/** 自动保存防抖毫秒（12 §6.3 规则 2 缺省值）。 */
const AUTOSAVE_DELAY_MS = 500;

function splitLibrary(documents: readonly OpenedDocumentSummary[]): DocumentLibrary {
  return {
    cards: documents.filter((item) => item.kind === 'card'),
    boxes: documents.filter((item) => item.kind === 'box'),
  };
}

function normalizeSource(input: string): string | null {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** `useEditorWorkspace` 返回值（界面层唯一消费面）。 */
export interface UseEditorWorkspaceResult {
  readonly status: WorkspaceStatus;
  readonly errorCode: string | null;
  readonly feedback: string | null;
  readonly library: DocumentLibrary;
  readonly selectedId: string | null;
  readonly selected: OpenedDocumentSummary | null;
  readonly cardDraft: CardEditorDraft | null;
  readonly boxDetail: BoxSummary | null;
  /** 选中文档的修订水位（`document:write` 回执驱动；0 = 本会话尚未写入）。 */
  readonly revision: number;
  readonly dirty: boolean;
  /** 最近一次 `document:save` 回执摘要（保存会话作用域；保存回执驱动保存态）。 */
  readonly savedDigest: string | null;
  readonly writeError: WorkspaceError | null;
  readonly saveError: WorkspaceError | null;
  readonly createError: WorkspaceError | null;
  readonly exportError: WorkspaceError | null;
  readonly commitBusy: boolean;
  readonly saveBusy: boolean;
  readonly editorDriver: EditorDriver | null;
  readonly openSource: (input: string) => Promise<void>;
  readonly select: (documentId: string) => Promise<void>;
  readonly refreshCurrent: () => Promise<void>;
  readonly commitPending: () => Promise<void>;
  readonly saveNow: () => Promise<void>;
  readonly discardEdits: () => void;
  readonly attachEditor: (editor: IBaseCardEditor) => void;
  readonly detachEditor: () => void;
  readonly createDocument: (kind: 'card' | 'box', name: string, parent: string) => Promise<void>;
  readonly exportDocument: (form: 'archive' | 'directory', target: string) => Promise<void>;
}

export function useEditorWorkspace(
  gateway: RichTextDocumentGateway = createIsolatedDocumentGateway()
): UseEditorWorkspaceResult {
  const [status, setStatus] = useState<WorkspaceStatus>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [documents, setDocuments] = useState<readonly OpenedDocumentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardDraft, setCardDraft] = useState<CardEditorDraft | null>(null);
  const [boxDetail, setBoxDetail] = useState<BoxSummary | null>(null);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [savedDigest, setSavedDigest] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<WorkspaceError | null>(null);
  const [saveError, setSaveError] = useState<WorkspaceError | null>(null);
  const [createError, setCreateError] = useState<WorkspaceError | null>(null);
  const [exportError, setExportError] = useState<WorkspaceError | null>(null);
  const [commitBusy, setCommitBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [editorDriver, setEditorDriver] = useState<EditorDriver | null>(null);

  const gatewayRef = useRef(gateway);
  gatewayRef.current = gateway;
  const documentsRef = useRef<readonly OpenedDocumentSummary[]>(documents);
  documentsRef.current = documents;
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const dirtyRef = useRef(false);
  const sessionsRef = useRef<Map<string, RichTextEditSession>>(new Map());
  const autosaveTimerRef = useRef<number | null>(null);
  const saveBusyRef = useRef(false);
  saveBusyRef.current = saveBusy;

  const clearAutosave = useCallback((): void => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearAutosave, [clearAutosave]);

  const describeError = useCallback((error: unknown): string => {
    return typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : 'DOCUMENT_GATEWAY_ERROR';
  }, []);

  /** 取（或建）文档的编辑会话：修订水位随文档持续，切换选区不丢回执历史。 */
  const ensureSession = useCallback((documentId: string, nodeId: string): RichTextEditSession => {
    const existing = sessionsRef.current.get(documentId);
    if (existing !== undefined) {
      return existing;
    }
    const created = new RichTextEditSession(documentId, nodeId);
    sessionsRef.current.set(documentId, created);
    return created;
  }, []);

  /** 以会话基线重建编辑视图（重挂载/divergence 采纳的唯一入口）。 */
  const rebuildDraft = useCallback((documentId: string, summary: OpenedDocumentSummary): void => {
    const session = sessionsRef.current.get(documentId);
    if (session === undefined) {
      setCardDraft(null);
      return;
    }
    setCardDraft({
      nodeId: session.nodeId,
      view: session.assembleCurrentView({ cardId: session.documentId, cardName: summary.title }),
    });
  }, []);

  /** 装配选中文档：卡片 → 编辑视图；箱子 → 只读摘要（卡箱浏览面最小可用）。 */
  const assemble = useCallback(
    async (summary: OpenedDocumentSummary): Promise<void> => {
      if (summary.kind === 'box') {
        const [metadata, entries] = await Promise.all([
          gatewayRef.current.readBoxMetadata(summary.documentId),
          gatewayRef.current.readEntries(summary.documentId),
        ]);
        setBoxDetail({ metadata, entries });
        setCardDraft(null);
        return;
      }
      // 元数据读取承担存在性校验（宿主回包缺失 card_id 即网关层拒绝），装配不消费其字段。
      await gatewayRef.current.readCardMetadata(summary.documentId);
      const structure = await gatewayRef.current.readStructure(summary.documentId);
      const node = structure.structure[0];
      if (node === undefined) {
        throw Object.assign(new Error('目标卡片不包含基础卡片节点'), {
          code: 'DOCUMENT_STRUCTURE_INVALID',
        });
      }
      if (node.type !== 'base.richtext') {
        throw Object.assign(new Error('目标卡片不包含富文本基础卡片'), {
          code: 'DOCUMENT_STRUCTURE_INVALID',
        });
      }
      const contentNode = await gatewayRef.current.readCardContent(summary.documentId, node.id);
      const session = ensureSession(summary.documentId, node.id);
      session.setBaseline({ ...contentNode.value }, 0);
      setBoxDetail(null);
      setRevision(session.revision);
      rebuildDraft(summary.documentId, summary);
    },
    [ensureSession, rebuildDraft]
  );

  const openSource = useCallback(
    async (input: string): Promise<void> => {
      const source = normalizeSource(input);
      if (source === null) {
        setFeedback('请输入非空的文档来源引用');
        return;
      }
      setStatus('opening');
      setErrorCode(null);
      setWriteError(null);
      setSaveError(null);
      setSavedDigest(null);
      try {
        const summary = await gatewayRef.current.open(source);
        setDocuments((current) => {
          const rest = current.filter((item) => item.documentId !== summary.documentId);
          return [...rest, summary];
        });
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
    [assemble, describeError]
  );

  const select = useCallback(
    async (documentId: string): Promise<void> => {
      const summary = documentsRef.current.find((item) => item.documentId === documentId);
      if (summary === undefined) {
        return;
      }
      setSelectedId(documentId);
      setErrorCode(null);
      setWriteError(null);
      setSaveError(null);
      setSavedDigest(null);
      clearAutosave();
      const session = sessionsRef.current.get(documentId);
      setRevision(session?.revision ?? 0);
      setDirty(session?.isDirty() ?? false);
      try {
        await assemble(summary);
      } catch (error: unknown) {
        setErrorCode(describeError(error));
        setFeedback(`文档读取失败（${describeError(error)}）`);
      }
    },
    [assemble, clearAutosave, describeError]
  );

  const refreshCurrent = useCallback(async (): Promise<void> => {
    const documentId = selectedIdRef.current;
    const summary = documentsRef.current.find((item) => item.documentId === documentId);
    if (documentId === null || summary === undefined) {
      setFeedback('当前没有选中的文档');
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

  // ---------- 写臂：提交链（回流唯一时序的应用前端侧落点） ----------

  const commitPending = useCallback(async (): Promise<void> => {
    const documentId = selectedIdRef.current;
    const session = documentId === null ? undefined : sessionsRef.current.get(documentId);
    const summary = documentsRef.current.find((item) => item.documentId === documentId);
    if (session === undefined || summary === undefined || !session.isDirty() || commitBusy) {
      return;
    }
    setWriteError(null);
    setCommitBusy(true);
    try {
      const outcome: RichTextCommitOutcome = await session.commit({
        writeNode: (value) =>
          gatewayRef.current.writeCardContent(session.documentId, session.nodeId, value),
        readNode: async () => {
          const node = await gatewayRef.current.readCardContent(session.documentId, session.nodeId);
          return { ...node.value };
        },
      });
      if (outcome.status === 'committed') {
        setRevision(session.revision);
        setDirty(session.isDirty());
        setFeedback(`修改已写入（修订号 ${String(outcome.revision)}），保存到磁盘后落盘`);
        return;
      }
      if (outcome.status === 'diverged') {
        setRevision(session.revision);
        setDirty(session.isDirty());
        rebuildDraft(session.documentId, summary);
        setFeedback('检测到外部修改，已采纳文档最新内容');
        return;
      }
      if (outcome.status === 'revision-stale') {
        setWriteError({
          code: 'DOCUMENT_REVISION_INVALID',
          message: `修订回执未严格递增（收到 ${String(outcome.received)}，当前 ${String(outcome.watermark)}）`,
        });
        return;
      }
      if (outcome.status !== 'no-change') {
        setWriteError({ code: outcome.errorCode, message: outcome.message });
      }
    } finally {
      setCommitBusy(false);
    }
  }, [commitBusy, rebuildDraft]);

  // ---------- 写臂：落盘（document:save 唯一入口）与自动保存 ----------

  const saveNow = useCallback(async (): Promise<void> => {
    const documentId = selectedIdRef.current;
    const session = documentId === null ? undefined : sessionsRef.current.get(documentId);
    if (session === undefined) {
      setFeedback('当前没有选中的文档');
      return;
    }
    if (saveBusyRef.current) {
      return;
    }
    clearAutosave();
    setSaveError(null);
    setSaveBusy(true);
    try {
      const outcome = await session.flushAndSave({
        writeNode: (value) =>
          gatewayRef.current.writeCardContent(session.documentId, session.nodeId, value),
        readNode: async () => {
          const node = await gatewayRef.current.readCardContent(session.documentId, session.nodeId);
          return { ...node.value };
        },
        save: () => gatewayRef.current.saveDocument(session.documentId),
      });
      if (outcome.status === 'saved') {
        setRevision(session.revision);
        setDirty(session.isDirty());
        setSavedDigest(outcome.receipt.digest);
        setFeedback(`已保存到磁盘（摘要 ${outcome.receipt.digest}）`);
        return;
      }
      if (outcome.status === 'commit-blocked') {
        const blocked = outcome.outcome;
        if (blocked.status === 'revision-stale') {
          setWriteError({
            code: 'DOCUMENT_REVISION_INVALID',
            message: `修订回执未严格递增（收到 ${String(blocked.received)}，当前 ${String(blocked.watermark)}）`,
          });
          return;
        }
        setWriteError({ code: blocked.errorCode, message: blocked.message });
        return;
      }
      setSaveError({ code: outcome.errorCode, message: outcome.message });
    } finally {
      setSaveBusy(false);
    }
  }, [clearAutosave]);

  /** 自动保存：脏状态进入 500ms 防抖；保存失败后不再自动重试（等待用户处置）。 */
  useEffect(() => {
    dirtyRef.current = dirty;
    if (!dirty || writeError !== null || saveError !== null) {
      clearAutosave();
      return;
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void saveNow();
    }, AUTOSAVE_DELAY_MS);
    return clearAutosave;
  }, [clearAutosave, dirty, saveError, saveNow, writeError]);

  // ---------- 编辑器附着（插件正式编辑器句柄） ----------

  const attachEditor = useCallback((editor: IBaseCardEditor): void => {
    const documentId = selectedIdRef.current;
    const session = documentId === null ? undefined : sessionsRef.current.get(documentId);
    if (session === undefined) {
      return;
    }
    session.attachEditor(editor);
    const driver = editor as IBaseCardEditor & {
      insertText?: (text: string) => void;
      replaceDocument?: (markdown: string) => void;
    };
    setEditorDriver(
      typeof driver.insertText === 'function' && typeof driver.replaceDocument === 'function'
        ? {
            insertText: driver.insertText.bind(editor),
            replaceDocument: driver.replaceDocument.bind(editor),
          }
        : null
    );
    editor.subscribe('dirty', (payload: { isDirty: boolean }): void => {
      setDirty(payload.isDirty);
    });
  }, []);

  const detachEditor = useCallback((): void => {
    const documentId = selectedIdRef.current;
    const session = documentId === null ? undefined : sessionsRef.current.get(documentId);
    session?.detachEditor();
    setEditorDriver(null);
    setDirty(false);
  }, []);

  const discardEdits = useCallback((): void => {
    const documentId = selectedIdRef.current;
    if (documentId === null) {
      return;
    }
    const session = sessionsRef.current.get(documentId);
    const summary = documentsRef.current.find((item) => item.documentId === documentId);
    if (session === undefined || summary === undefined) {
      return;
    }
    session.discard();
    setWriteError(null);
    setDirty(false);
    rebuildDraft(documentId, summary);
    setFeedback('已放弃未保存的修改');
  }, [rebuildDraft]);

  // ---------- 新建入口（document:create 宿主实现在途，缺位已登记）与导出入口 ----------

  const createDocument = useCallback(
    async (kind: 'card' | 'box', name: string, parent: string): Promise<void> => {
      setCreateError(null);
      const trimmedName = name.trim();
      const normalizedParent = normalizeSource(parent);
      if (normalizedParent === null) {
        setCreateError({
          code: 'BRIDGE_INVALID_INPUT',
          message: '请填写新建落点（父目录受管引用）',
        });
        return;
      }
      try {
        const output = await gatewayRef.current.createDocument({
          kind,
          parent: normalizedParent,
          ...(trimmedName.length > 0 ? { name: trimmedName } : {}),
          ...(kind === 'card' ? { initialContent: { cardType: 'base.richtext' } } : {}),
        });
        setFeedback('已创建新文档，正在打开');
        await openSource(output.source);
      } catch (error: unknown) {
        const described = describeGatewayError(error);
        setCreateError(described);
      }
    },
    [openSource]
  );

  const exportDocument = useCallback(
    async (form: 'archive' | 'directory', target: string): Promise<void> => {
      const documentId = selectedIdRef.current;
      const normalizedTarget = normalizeSource(target);
      if (documentId === null) {
        setExportError({ code: 'DOCUMENT_GATEWAY_ERROR', message: '当前没有选中的文档' });
        return;
      }
      if (normalizedTarget === null) {
        setExportError({ code: 'BRIDGE_INVALID_INPUT', message: '请填写导出目标路径' });
        return;
      }
      setExportError(null);
      try {
        const output = await gatewayRef.current.exportDocument({
          documentId,
          target: normalizedTarget,
          form,
        });
        setFeedback(`已导出到 ${output.target}`);
      } catch (error: unknown) {
        setExportError(describeGatewayError(error));
      }
    },
    []
  );

  // 成功类反馈走定时清理；错误态反馈保留（须显式处置）。
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

  const library = useMemo(() => splitLibrary(documents), [documents]);
  const selected = useMemo(
    () =>
      selectedId === null
        ? null
        : (documents.find((item) => item.documentId === selectedId) ?? null),
    [documents, selectedId]
  );

  return {
    status,
    errorCode,
    feedback,
    library,
    selectedId,
    selected,
    cardDraft,
    boxDetail,
    revision,
    dirty,
    savedDigest,
    writeError,
    saveError,
    createError,
    exportError,
    commitBusy,
    saveBusy,
    editorDriver,
    openSource,
    select,
    refreshCurrent,
    commitPending,
    saveNow,
    discardEdits,
    attachEditor,
    detachEditor,
    createDocument,
    exportDocument,
  };
}

/** 网关错误类型再导出（界面层捕获判定用，避免深路径导入）。 */
export type { DocumentGatewayError };
