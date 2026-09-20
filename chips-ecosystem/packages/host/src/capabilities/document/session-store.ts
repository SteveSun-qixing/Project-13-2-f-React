/**
 * 文档记录与会话存储（`11-文档服务设计` §三、§四）。
 *
 * @remarks
 * - 文档记录以受管 URI 为键；`documentId` 取自解析得到的稳定标识（`card_id` / `box_id`），
 *   同一文档跨会话共享同一标识。
 * - 会话以 Bridge 会话 ID 为键挂在文档记录下；同一会话同一来源复用同一会话对象与
 *   `documentId`；同一会话内不同来源解析出相同稳定标识由
 *   {@link IDocumentSessionStore.claimSessionIdentity} 判定 `DOCUMENT_ID_CONFLICT`（§3.1）。
 * - 单文档单写者：写租约在文档记录上（首次成功 `document:write` 时获得，保存成功时归还，
 *   §3.6）；同一文档的 `write` / `save` 经记录内串行队列执行（§7.5），不同文档互不阻塞。
 * - 会话释放（拥有者窗口关闭 / Fork 撤销）由组合根在 Bridge 会话清理链路调用
 *   {@link IDocumentSessionStore.releaseSessionsOf}；R19 不提供显式关闭能力（§4.6）。
 */

import type { DocumentForm, DocumentKind, DocumentPart, DocumentValue, IDocumentDiagnostic } from './contract.js';
import type { IDocumentHandle } from './ports.js';
import type { ISourceFingerprint } from './digest.js';

/** 会话对基线模型的覆盖层：未覆盖的分片读取时回落到文档记录（解析器惰性层级）。 */
export interface ISessionOverlays {
  metadata?: DocumentValue;
  structure?: DocumentValue;
  /** 卡片内容成员：值为 `null` 表示会话内删除标记。 */
  readonly contentNodes: Map<string, DocumentValue | null>;
  /** 箱子 `.box/content.yaml` 布局配置覆盖。 */
  layoutConfig?: DocumentValue;
}

/** 文档会话（§3.2 的 TS 结构视图；解析句柄在文档记录上跨会话共享）。 */
export interface IDocumentSession {
  readonly sessionId: string;
  readonly documentId: string;
  readonly managedUri: string;
  /** 角色：写者持有租约；Reader → Writer 转换由首次成功写入完成（§3.2）。 */
  role: 'reader' | 'writer';
  /** 内存模型修订号；从 0 开始（打开），每次成功 `document:write` 前进 1（§3.4）。 */
  revision: number;
  dirty: boolean;
  /** 待保存的分片集合；`dirty == false` 时保存为幂等 no-op（§3.4、§4.5）。 */
  readonly dirtyParts: Set<DocumentPart>;
  /** 会话基线源指纹（打开或上次保存时）。 */
  baselineFingerprint: ISourceFingerprint;
  /** 成功保存后的基线摘要；打开后尚未保存时为 `null`（§3.2）。 */
  savepointDigest: string | null;
  readonly overlays: ISessionOverlays;
}

/** 记录级惰性切片缓存（打开后的只读基线；会话覆盖层优先；含各层级解析诊断快照）。 */
export interface IRecordLazyParts {
  structure?: DocumentValue;
  structureDiagnostics?: readonly IDocumentDiagnostic[];
  readonly contents: Map<string, DocumentValue>;
  readonly contentsDiagnostics: Map<string, readonly IDocumentDiagnostic[]>;
  layoutConfig?: DocumentValue;
  layoutDiagnostics?: readonly IDocumentDiagnostic[];
}

/** 文档记录：一个受管来源在一次挂载期内的解析基线与共享状态。 */
export interface IDocumentRecord {
  readonly managedUri: string;
  readonly localPath: string;
  readonly form: DocumentForm;
  readonly kind: DocumentKind;
  readonly documentId: string;
  readonly title: string;
  /** 当前只读解析句柄（保存成功后按新指纹重建，§3.5）。 */
  handle: IDocumentHandle;
  /** L0 元数据基线（保存成功后按重建句柄刷新）。 */
  baselineMetadata: DocumentValue;
  /** 打开 / 上次保存时的解析诊断快照（L0）。 */
  baselineDiagnostics: readonly IDocumentDiagnostic[];
  baselineFingerprint: ISourceFingerprint;
  readonly lazy: IRecordLazyParts;
  readonly sessions: Map<string, IDocumentSession>;
  /** 写租约持有会话；`null` 表示空闲。 */
  leaseHolderSessionId: string | null;
  /** 最近一次成功保存的摘要（no-op 保存与保存后事件口径）。 */
  lastSavedDigest: string | null;
}

/** 打开文档记录的输入。 */
export interface IOpenRecordInput {
  readonly managedUri: string;
  readonly localPath: string;
  readonly form: DocumentForm;
  readonly kind: DocumentKind;
  readonly documentId: string;
  readonly title: string;
  readonly handle: IDocumentHandle;
  readonly baselineMetadata: DocumentValue;
  readonly baselineDiagnostics: readonly IDocumentDiagnostic[];
  readonly baselineFingerprint: ISourceFingerprint;
}

/** 会话身份声明结果：`ok` 首次声明、`reuse` 同会话同来源复用、`conflict` §3.1 冲突。 */
export type SessionIdentityClaim = 'ok' | 'reuse' | 'conflict';

/** 文档会话存储接口。 */
export interface IDocumentSessionStore {
  /** 按受管 URI 取文档记录。 */
  findRecord(managedUri: string): IDocumentRecord | undefined;
  /** 建立文档记录（同 URI 幂等返回既有记录）。 */
  openRecord(input: IOpenRecordInput): IDocumentRecord;
  /** 取或创建会话（新建即 `reader`、`revision = 0`、非脏）。 */
  getOrCreateSession(record: IDocumentRecord, sessionId: string): IDocumentSession;
  /** 调用方会话视角：按调用方会话 ID 与文档标识取会话。 */
  findSession(callerSessionId: string, documentId: string): IDocumentSession | undefined;
  /** 按文档会话取所属文档记录。 */
  recordOf(session: IDocumentSession): IDocumentRecord | undefined;
  /**
   * 声明“会话 ↔ 文档标识 ↔ 来源”三元关系：
   * 同会话同来源复用；同会话不同来源声明同一标识时冲突。
   */
  claimSessionIdentity(sessionId: string, documentId: string, managedUri: string): SessionIdentityClaim;
  /** 同一文档的 `write` / `save` 串行执行入口；失败不阻断后续任务。 */
  enqueueRecordTask<T>(record: IDocumentRecord, task: () => Promise<T>): Promise<T>;
  /**
   * 拥有者会话释放：拒绝后续请求前等待该文档在途任务收口，随后移除其全部会话与身份声明；
   * 记录无会话且无租约时释放解析句柄并移除记录。返回被移除的记录（供上层做作用域清理）。
   */
  releaseSessionsOf(sessionId: string): Promise<readonly IDocumentRecord[]>;
  /** 观察面：当前文档记录数（诊断与测试）。 */
  recordCount(): number;
}

function createLazyParts(): IRecordLazyParts {
  return {
    contents: new Map<string, DocumentValue>(),
    contentsDiagnostics: new Map<string, readonly IDocumentDiagnostic[]>(),
  };
}

/**
 * 惰性构建会话存储（纯内存状态；装配由组合根按平台核心实例唯一持有）。
 *
 * @param releaseHandle 解析句柄释放入口（chips-parser 端口的 `release`）。
 */
export function createDocumentSessionStore(
  releaseHandle: (handle: IDocumentHandle) => Promise<void>
): IDocumentSessionStore {
  const recordsByUri = new Map<string, IDocumentRecord>();
  /** 会话 → 文档标识 → 受管 URI（§3.1 冲突判定索引）。 */
  const sessionIdentity = new Map<string, Map<string, string>>();
  /** 文档记录 → 串行队列尾。 */
  const queues = new WeakMap<IDocumentRecord, Promise<unknown>>();

  return {
    findRecord(managedUri) {
      return recordsByUri.get(managedUri);
    },
    openRecord(input) {
      const existing = recordsByUri.get(input.managedUri);
      if (existing !== undefined) {
        return existing;
      }
      const record: IDocumentRecord = {
        managedUri: input.managedUri,
        localPath: input.localPath,
        form: input.form,
        kind: input.kind,
        documentId: input.documentId,
        title: input.title,
        handle: input.handle,
        baselineMetadata: input.baselineMetadata,
        baselineDiagnostics: input.baselineDiagnostics,
        baselineFingerprint: input.baselineFingerprint,
        lazy: createLazyParts(),
        sessions: new Map<string, IDocumentSession>(),
        leaseHolderSessionId: null,
        lastSavedDigest: null,
      };
      recordsByUri.set(record.managedUri, record);
      return record;
    },
    getOrCreateSession(record, sessionId) {
      const existing = record.sessions.get(sessionId);
      if (existing !== undefined) {
        return existing;
      }
      const session: IDocumentSession = {
        sessionId,
        documentId: record.documentId,
        managedUri: record.managedUri,
        role: 'reader',
        revision: 0,
        dirty: false,
        dirtyParts: new Set<DocumentPart>(),
        baselineFingerprint: record.baselineFingerprint,
        savepointDigest: null,
        overlays: { contentNodes: new Map<string, DocumentValue | null>() },
      };
      record.sessions.set(sessionId, session);
      return session;
    },
    findSession(callerSessionId, documentId) {
      for (const record of recordsByUri.values()) {
        const session = record.sessions.get(callerSessionId);
        if (session !== undefined && session.documentId === documentId) {
          return session;
        }
      }
      return undefined;
    },
    recordOf(session) {
      return recordsByUri.get(session.managedUri);
    },
    claimSessionIdentity(sessionId, documentId, managedUri) {
      const identities = sessionIdentity.get(sessionId);
      const existingUri = identities?.get(documentId);
      if (existingUri !== undefined) {
        return existingUri === managedUri ? 'reuse' : 'conflict';
      }
      const next = identities ?? new Map<string, string>();
      next.set(documentId, managedUri);
      sessionIdentity.set(sessionId, next);
      return 'ok';
    },
    enqueueRecordTask<T>(record: IDocumentRecord, task: () => Promise<T>): Promise<T> {
      const previous = queues.get(record) ?? Promise.resolve();
      const run = (): Promise<T> => task();
      const next = previous.then(run, run);
      // 队列尾吞掉失败：单任务拒绝不阻断同一文档的后续串行任务。
      queues.set(
        record,
        next.then(
          () => undefined,
          () => undefined
        )
      );
      return next;
    },
    async releaseSessionsOf(sessionId) {
      const released: IDocumentRecord[] = [];
      const drained: Promise<unknown>[] = [];
      for (const record of [...recordsByUri.values()]) {
        if (!record.sessions.has(sessionId)) {
          continue;
        }
        record.sessions.delete(sessionId);
        if (record.leaseHolderSessionId === sessionId) {
          record.leaseHolderSessionId = null;
        }
        const pending = queues.get(record);
        if (pending !== undefined) {
          drained.push(pending.catch(() => undefined));
        }
        if (record.sessions.size === 0) {
          recordsByUri.delete(record.managedUri);
          released.push(record);
        }
      }
      sessionIdentity.delete(sessionId);
      await Promise.all(drained);
      for (const record of released) {
        await releaseHandle(record.handle);
      }
      return released;
    },
    recordCount() {
      return recordsByUri.size;
    },
  };
}
