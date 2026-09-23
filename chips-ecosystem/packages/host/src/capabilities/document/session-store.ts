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
 * - 记录级原生数值会话（`nativeSession`）：**唯一来源是作用域端口 `registerScope` 的回执**
 *   （原生 `resourceOpenSession` 返回值，见 `ports.ts` `IDocumentScopeRegistration`），由服务随
 *   {@link IOpenRecordInput} 落档，本存储不再生成任何会话标识（工单036 裁决I-① INV-1：历史上
 *   本处是 TS 单调计数器，假 id 触达原生会话表恒 `None`、归属闸恒 `PERMISSION_DENIED`，
 *   两拍注销形同虚设，#213 附带发现，波 A2b-β 翻正）；宿主 wire 会话 `string` 为对外唯一身份，
 *   数值会话不出主进程（RFC O3 / 工单035 裁定二，消费面见 `adapters/view-channel.ts`）。
 * - 会话释放（拥有者窗口关闭 / Fork 撤销）由组合根在 Bridge 会话清理链路调用
 *   {@link IDocumentSessionStore.releaseSessionsOf}；R19 不提供显式关闭能力（§4.6），
 *   释放即 `close`，被移除的记录由能力层发布 `document:closed`（§7.3）。
 *   **两拍次序（INV-2）**：记录移除后先经 `releaseScope` 依赖位注销资源作用域（端口内部执行
 *   `resourceUnregisterScope` → `resourceCloseSession`），其后才释放解析句柄；`document:closed`
 *   事件不承担资源注销（裁决I-④ 形态①，禁双注销挂点）。
 */

import type { DocumentForm, DocumentKind, DocumentPart, DocumentValue, IDocumentDiagnostic } from './contract.js';
import { DOCUMENT_CHANNEL_ERROR_CODES, asDocumentCapabilityError, documentError } from './errors.js';
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

/**
 * 文档记录：一个受管来源在一次挂载期内的解析基线与共享状态。
 *
 * @remarks 记录**不持有本地路径**（工单036 波 B2 / 点位三消费臂）：路径事实源唯一在资源管理器，
 * 消费侧经作用域端口 `localPathOf(managedUri, nativeSession)` 现取；记录侧只保留身份与
 * 基线（`managedUri` + `nativeSession` 即换算输入的全部所需）。
 */
export interface IDocumentRecord {
  readonly managedUri: string;
  readonly form: DocumentForm;
  readonly kind: DocumentKind;
  readonly documentId: string;
  readonly title: string;
  /** 当前只读解析句柄（保存成功后按新指纹重建，§3.5）。 */
  handle: IDocumentHandle;
  /**
   * 记录级原生数值会话（backing `SessionId`，u64 的 JS 安全整数子集形态）。
   *
   * @remarks RFC O3 / 工单035 裁定二：宿主 wire 会话标识 `string` 为对外唯一身份，
   * backing 数值会话为主进程内部细节、不出主进程；本字段**只承接**作用域端口
   * `registerScope` 回执里的原生 `resourceOpenSession` 真实句柄（INV-1，唯一来源在适配器，
   * 本存储不生成、不猜测、不自增），string↔u64 归一单点在视图通道会话解析器
   * （`adapters/view-channel.ts`）消费本字段完成。
   */
  readonly nativeSession: number;
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

/**
 * 打开文档记录的输入。
 *
 * @remarks 无 `localPath` 形（工单036 波 B2）：见 {@link IDocumentRecord} 头注的单一事实源口径。
 */
export interface IOpenRecordInput {
  readonly managedUri: string;
  readonly form: DocumentForm;
  readonly kind: DocumentKind;
  readonly documentId: string;
  readonly title: string;
  readonly handle: IDocumentHandle;
  /**
   * 作用域登记回执交付的原生会话句柄（`resourceOpenSession` 返回值，INV-1 唯一来源）；
   * 随记录一次落档，记录存续期不变。
   */
  readonly nativeSession: number;
  readonly baselineMetadata: DocumentValue;
  readonly baselineDiagnostics: readonly IDocumentDiagnostic[];
  readonly baselineFingerprint: ISourceFingerprint;
}

/** 会话身份声明结果：`ok` 首次声明、`reuse` 同会话同来源复用、`conflict` §3.1 冲突。 */
export type SessionIdentityClaim = 'ok' | 'reuse' | 'conflict';

/**
 * 会话释放结果（§4.6 的释放臂交付形）。
 *
 * @remarks `scopeFailures` 承载两拍第①拍未达的记录（`releaseScope` 抛出，含归属闸
 * `RESOURCE_PERMISSION_DENIED` 形态）——注销未达即「疑似孤儿在册」，本存储不吞、不掩盖，
 * 交能力层落审计；释放链不因单条注销失败中断（后续记录的句柄收口与 `document:closed`
 * 发布照常，见 `service.ts` `releaseSessions`）。
 */
export interface ISessionReleaseOutcome {
  /** 已随会话移除的文档记录（能力层按其发布 `document:closed`，§7.3）。 */
  readonly released: readonly IDocumentRecord[];
  /** 作用域注销未达项（`cause` 为适配器抛出的登记码）。 */
  readonly scopeFailures: readonly {
    readonly documentId: string;
    readonly managedUri: string;
    readonly cause: string;
  }[];
}

/** 文档会话存储接口。 */
export interface IDocumentSessionStore {
  /** 按受管 URI 取文档记录。 */
  findRecord(managedUri: string): IDocumentRecord | undefined;
  /**
   * 按稳定文档标识取声明了该标识的全部存活记录（打开流程 §3.1 之外的只读查询面）。
   *
   * @remarks 视图通道会话解析器（`adapters/view-channel.ts`，主进程内部消费）用于
   * `{source, documentId}` → 记录定位与多记录冲突判定（§3.1 同一标识跨来源的唯一性
   * 由打开链路的身份声明冲突闸保障，本查询面只做如实枚举，不做二次裁决）。
   */
  findRecordsByDocumentId(documentId: string): readonly IDocumentRecord[];
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
  /** 撤回一次身份声明（打开流程后续步骤失败时的回收，保证不留下半开状态，§4.2）。 */
  withdrawSessionIdentity(sessionId: string, documentId: string, managedUri: string): void;
  /**
   * 移除刚建立、尚无任何会话的文档记录（打开流程在记录建立后失败时的回收）。
   * 存在会话时不做移除（其他会话仍在使用同一记录）。
   */
  discardRecord(record: IDocumentRecord): boolean;
  /** 同一文档的 `write` / `save` 串行执行入口；失败不阻断后续任务。 */
  enqueueRecordTask<T>(record: IDocumentRecord, task: () => Promise<T>): Promise<T>;
  /**
   * 拥有者会话释放（§4.6）：标记 `closing`（期间拒绝新请求与查找）→ 等待该文档在途任务收口
   * → 丢弃未保存模型与写租约 → 移除会话与身份声明 → 记录无会话时移除记录，随后按两拍次序
   * 逐记录注销资源作用域（① `releaseScope`）并释放解析句柄（② `releaseHandle`，INV-2）。
   * 返回被移除的记录与注销未达项，由能力层按其发布 `document:closed`（§7.3）并落审计。
   */
  releaseSessionsOf(sessionId: string): Promise<ISessionReleaseOutcome>;
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
 * 惰性构建会话存储（纯内存状态 + 记录移除期的资源作用域收口；装配由组合根按平台核心实例唯一持有）。
 *
 * @param releaseHandle 解析句柄释放入口（chips-parser 端口的 `release`）。
 * @param releaseScope 记录驱逐期的作用域注销入口（组合根接 `IDocumentScopePort.unregisterScope`）：
 *  {@link IDocumentSessionStore.releaseSessionsOf} 在排空在途任务、移除记录之后、释放解析句柄**之前**
 *  逐记录触达本入口——两拍次序（INV-2：`unregisterScope` 内部 `resourceUnregisterScope` →
 *  `resourceCloseSession`）由端口适配器承载，本存储只保证「先注销、后关句柄」的单点调用序
 *  （INV-6：注销入口全仓唯一，此处不构成第二注销形）。注销失败不吞：登记为释放结果的
 *  `scopeFailures`（{@link ISessionReleaseOutcome}）交能力层落审计，该记录的句柄仍照常释放。
 */
export function createDocumentSessionStore(
  releaseHandle: (handle: IDocumentHandle) => Promise<void>,
  releaseScope: (record: { readonly documentId: string; readonly managedUri: string }) => Promise<void>,
): IDocumentSessionStore {
  const recordsByUri = new Map<string, IDocumentRecord>();
  /** 会话 → 文档标识 → 受管 URI（§3.1 冲突判定索引）。 */
  const sessionIdentity = new Map<string, Map<string, string>>();
  /** 正在释放的拥有者会话：§4.6 的 `closing` 标记，期间一律拒绝新的文档会话查找。 */
  const releasingSessions = new Set<string>();
  /** 文档记录 → 串行队列尾。 */
  const queues = new WeakMap<IDocumentRecord, Promise<unknown>>();

  return {
    findRecord(managedUri) {
      return recordsByUri.get(managedUri);
    },
    findRecordsByDocumentId(documentId) {
      const matches: IDocumentRecord[] = [];
      for (const record of recordsByUri.values()) {
        if (record.documentId === documentId) {
          matches.push(record);
        }
      }
      return matches;
    },
    openRecord(input) {
      const existing = recordsByUri.get(input.managedUri);
      if (existing !== undefined) {
        return existing;
      }
      const record: IDocumentRecord = {
        managedUri: input.managedUri,
        form: input.form,
        kind: input.kind,
        documentId: input.documentId,
        title: input.title,
        handle: input.handle,
        nativeSession: input.nativeSession,
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
      if (releasingSessions.has(sessionId)) {
        // §4.6：`closing` 期间拒绝新请求；会话已不可用按 `BRIDGE_SESSION_UNKNOWN` 返回。
        throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.sessionUnknown, {
          details: { documentId: record.documentId },
        });
      }
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
      if (releasingSessions.has(callerSessionId)) {
        return undefined;
      }
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
    withdrawSessionIdentity(sessionId, documentId, managedUri) {
      const identities = sessionIdentity.get(sessionId);
      if (identities?.get(documentId) === managedUri) {
        identities.delete(documentId);
        if (identities.size === 0) {
          sessionIdentity.delete(sessionId);
        }
      }
    },
    discardRecord(record) {
      if (record.sessions.size > 0) {
        return false;
      }
      if (recordsByUri.get(record.managedUri) !== record) {
        return false;
      }
      recordsByUri.delete(record.managedUri);
      return true;
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
          () => undefined,
        ),
      );
      return next;
    },
    async releaseSessionsOf(sessionId) {
      const affected: IDocumentRecord[] = [];
      for (const record of recordsByUri.values()) {
        if (record.sessions.has(sessionId)) {
          affected.push(record);
        }
      }
      // §4.6 释放顺序：标记 closing（拒绝新请求）→ 排空在途任务 → 丢弃未保存模型与租约
      // → 移除记录与会话 → 释放解析句柄。
      releasingSessions.add(sessionId);
      try {
        for (const record of affected) {
          const pending = queues.get(record);
          if (pending !== undefined) {
            await pending.catch(() => undefined);
          }
        }
        const released: IDocumentRecord[] = [];
        for (const record of affected) {
          record.sessions.delete(sessionId);
          if (record.leaseHolderSessionId === sessionId) {
            record.leaseHolderSessionId = null;
          }
          if (record.sessions.size === 0 && recordsByUri.get(record.managedUri) === record) {
            recordsByUri.delete(record.managedUri);
            queues.delete(record);
            released.push(record);
          }
        }
        sessionIdentity.delete(sessionId);
        // 两拍次序（INV-2）：逐记录先经 `releaseScope` 注销资源作用域（端口适配器内部执行
        // `resourceUnregisterScope` → `resourceCloseSession`），后释放解析句柄。注销失败不吞、
        // 不以后续动作掩盖：登记为 `scopeFailures` 交能力层落审计，该记录的句柄仍照常释放
        // （适配器按 PERMISSION_DENIED 口径自留在册账与原生会话，句柄泄漏比留痕缺失更易处置）。
        const scopeFailures: {
          readonly documentId: string;
          readonly managedUri: string;
          readonly cause: string;
        }[] = [];
        for (const record of released) {
          try {
            await releaseScope({ documentId: record.documentId, managedUri: record.managedUri });
          } catch (error: unknown) {
            scopeFailures.push({
              documentId: record.documentId,
              managedUri: record.managedUri,
              cause: asDocumentCapabilityError(error).code,
            });
          }
          await releaseHandle(record.handle);
        }
        return { released, scopeFailures };
      } finally {
        releasingSessions.delete(sessionId);
      }
    },
    recordCount() {
      return recordsByUri.size;
    },
  };
}
