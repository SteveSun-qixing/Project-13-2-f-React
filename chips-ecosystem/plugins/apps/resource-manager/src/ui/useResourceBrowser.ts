import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addBrowsedDocument,
  findBrowsedDocument,
  normalizeBrowseSource,
  EMPTY_BROWSED_DOCUMENTS,
  type BrowsedDocuments,
  type BrowsedDocumentSummary,
  type DocumentBrowseDetail,
} from '../domain/browse/entryModel';
import {
  BrowseGatewayError,
  type ResourceBrowseGateway,
} from '../domain/browse/browseGateway';

/** 浏览状态：空闲 / 打开中 / 就绪 / 失败（失败必携错误码）。 */
export type BrowseStatus = 'idle' | 'opening' | 'ready' | 'error';

/** `useResourceBrowser` 返回值（界面层唯一消费面）。 */
export interface UseResourceBrowserResult {
  readonly records: BrowsedDocuments;
  readonly status: BrowseStatus;
  readonly errorCode: string | null;
  readonly feedback: string | null;
  readonly selectedId: string | null;
  readonly selected: BrowsedDocumentSummary | null;
  readonly detail: DocumentBrowseDetail | null;
  readonly openSource: (input: string) => Promise<void>;
  readonly select: (documentId: string) => Promise<void>;
  readonly refreshCurrent: () => Promise<void>;
}

/**
 * 资源浏览器控制器（只读起步臂）：按来源打开 → 记录收录 → 装配条目呈现。
 *
 * - 打开臂经 `document:open` 正式面（resources:read 真实现消费，工单036 波 C3）；
 *   失败以简体中文反馈 + 错误码如实呈现，不伪造成功；
 * - 工作区目录树数据源（`filesystem:read:${workspace}` 域）与资源打开路由（`resource:open`）
 *   宿主侧缺位（工单036 后续段），目录树呈现降级为「按来源打开」显式入口，不伪造列表；
 * - 写臂（重命名/移动/删除/批量标签，`resource:write`）候工单036 后续段注册，本臂不接线。
 */
export function useResourceBrowser(
  gateway: ResourceBrowseGateway,
): UseResourceBrowserResult {
  const [records, setRecords] = useState<BrowsedDocuments>(EMPTY_BROWSED_DOCUMENTS);
  const [status, setStatus] = useState<BrowseStatus>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentBrowseDetail | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const recordsRef = useRef<BrowsedDocuments>(EMPTY_BROWSED_DOCUMENTS);

  recordsRef.current = records;
  selectedIdRef.current = selectedId;

  const describeError = useCallback((error: unknown): string => {
    return error instanceof BrowseGatewayError ? error.code : 'BROWSE_GATEWAY_ERROR';
  }, []);

  const assemble = useCallback(
    async (summary: BrowsedDocumentSummary): Promise<void> => {
      if (summary.kind === 'box') {
        setDetail(await gateway.readBoxDetail(summary.documentId));
        return;
      }
      setDetail(await gateway.readCardDetail(summary.documentId));
    },
    [gateway],
  );

  const openSource = useCallback(
    async (input: string): Promise<void> => {
      const source = normalizeBrowseSource(input);
      if (source === null) {
        setFeedback('请输入非空的文档来源引用');
        return;
      }
      setStatus('opening');
      setErrorCode(null);
      try {
        const summary = await gateway.open(source);
        setRecords((current) => addBrowsedDocument(current, summary));
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
      const summary = findBrowsedDocument(recordsRef.current, documentId);
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

  const refreshCurrent = useCallback(async (): Promise<void> => {
    const documentId = selectedIdRef.current;
    if (documentId === null) {
      setFeedback('当前没有浏览中的文档');
      return;
    }
    const summary = findBrowsedDocument(recordsRef.current, documentId);
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

  // 成功类反馈自动消退；失败类保留在行内（须显式处置）。
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
    () => (selectedId === null ? null : findBrowsedDocument(records, selectedId)),
    [records, selectedId],
  );

  return {
    records,
    status,
    errorCode,
    feedback,
    selectedId,
    selected,
    detail,
    openSource,
    select,
    refreshCurrent,
  };
}
