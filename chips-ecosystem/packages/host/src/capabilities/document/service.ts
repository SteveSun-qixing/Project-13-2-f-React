/**
 * 文档服务能力服务本体：`document:open` / `document:read` / `document:write` / `document:save`
 * 的执行器（`11-文档服务设计` 全篇的 TS 侧实现口径）。
 *
 * 权威：`11-文档服务设计` §三（会话模型）、§四（生命周期与各阶段失败语义）、§五（写入与原子性、
 * 摘要口径）、§七（外部修改与并发、事件发布职责）、§十（错误码）、`04-能力契约规范` §7.3（输入输出）、
 * `05-事件契约规范` §4.2（payload）、`02-Bridge三层设计` §9（错误归一）。
 *
 * @remarks
 * - 会话、修订、脏状态、写租约、结构校验、摘要复算、事件时序与错误归一在本模块完成；
 *   解析/序列化、受控写、作用域、权限判定与事件投递经端口注入（见 `ports.ts` 头注）。
 *   本模块不做任何 `.card` / `.box` 字节解析（解析算法权威在 chips-parser，工单015）。
 * - 事件口径（§4.2、§7.3）：`document:opened` 于会话建立、解析结果可用时发布；
 *   `document:write` **不落盘、不发布事件**；`document:changed` 只在 `document:save` 持久化完成后
 *   按磁盘复算摘要发布，随后 `document:saved`（`changed` 先于 `saved`）；会话释放且记录移除后
 *   发布 `document:closed`。payload 字段以 `05-事件契约规范` §4.2 为准。
 * - 同一文档的 `write` / `save` 经记录级串行队列执行；不同文档互不阻塞（§7.5）。
 * - 事件是通知不是状态：发布失败不回滚已完成的写入，落宿主诊断日志（§7.3）。
 * - 资源侧生命周期（工单036 裁决I-①/④，波 A2b-β 接线）：文档记录的原生会话来自作用域端口
 *   `registerScope` 回执（INV-1，真实 `resourceOpenSession` 句柄）；记录驱逐（会话释放、
 *   打开失败回收）一律「① `unregisterScope` → ② 关句柄」两拍次序（INV-2，经 `session-store.ts`
 *   `releaseScope` 依赖位与 `rollbackFreshRecord` 单点承载），`document:closed` 事件**不承担**
 *   资源注销（裁决I-④ 形态①，禁双注销挂点 INV-6）。
 * - 路径与基址的单源口径（工单036 波 B2，点位三消费臂接线）：文档记录**不持有** `localPath`，
 *   挂载建立后每一次磁盘触达（指纹复查、序列化输入、受控提交、摘要复算、句柄重建）都经作用域
 *   端口的 `localPathOf`（原生 `resourceLocalPathOf`，§11.3 行 19）以 `record.managedUri` +
 *   `record.nativeSession` 现取（RFC §6.1 消费面「消除 TS 私有路径缓存」）；
 *   打开链挂载前的那一次路径由 `normalizeSource` 交付（此刻尚无会话，换算口不可达）。
 *   装载投递的资源基址同理经 `scopeRootOf` 查正式注册表，本模块不做
 *   字符串切片派生——宿主侧自此只有资源管理器一份路径事实源与一份作用域登记事实源。
 */

import { DOCUMENT_CAPABILITY_IDS, DOCUMENT_CAPABILITY_PERMISSIONS, DOCUMENT_EVENT_IDS } from './contract.js';
import type {
  DocumentCapabilityId,
  DocumentKind,
  DocumentPart,
  DocumentValue,
  IDocumentCapabilityContext,
  IDocumentDiagnostic,
  IDocumentOpenOutput,
  IDocumentReadOutput,
  IDocumentSaveOutput,
  IDocumentWriteOutput,
} from './contract.js';
import {
  DOCUMENT_BUSINESS_ERROR_CODES,
  DOCUMENT_CHANNEL_ERROR_CODES,
  DOCUMENT_PARSER_ERROR_CODES,
  asDocumentCapabilityError,
  documentError,
} from './errors.js';
import type { DocumentCapabilityError } from './errors.js';
import {
  comparePackagePath,
  computeFileDigest,
  computePackageContentDigest,
  computeQuickFingerprintDigest,
  sourceFingerprintsEqual,
} from './digest.js';
import type { ISourceFingerprint } from './digest.js';
import type {
  DocumentCapabilityExecutor,
  IDocumentHandle,
  IDocumentParseOutcome,
  IDocumentScopeRegistration,
  IDocumentSerializeRequest,
  IDocumentSerializedMember,
  IDocumentServiceDependencies,
  IResolvedDocumentSource,
} from './ports.js';
import { createDocumentSessionStore } from './session-store.js';
import type { IDocumentRecord, IDocumentSession } from './session-store.js';
import { getHostTrace } from '../../shared/host-trace.js';

/**
 * `document:open` 阶段边界的在册规范标记点名。
 *
 * 权威：《渲染引擎设计》§10.1 阶段预算边界（请求接受 → 解析）与 `@chips/perf`
 * 工具在册命名（`tests/perf/src/scenarios.ts` `MARKERS`：「Host / RenderEngine /
 * 解析器经 `CHIPS_TRACE` 导出时的统一命名」）逐字同源；本模块不自造第二套命名。
 */
export const DOCUMENT_OPEN_TRACE_PHASES = {
  requestAccepted: 'render:request-accepted',
  documentParsed: 'document:parsed',
} as const;
import {
  assertOpenInput,
  assertPartCombination,
  assertReadInput,
  assertSerializedMemberPaths,
  assertWriteInput,
  cardStructureNodeIds,
  isPlainRecord,
  readArrayField,
  requireDocumentId,
  validateEntriesSlice,
  validateMetadataSlice,
  validateStructureSlice,
} from './validation.js';

/**
 * 视图通道会话定位请求（工单043 §五 G2 修复形态）：`{source, documentId}` 二元组之外
 * 携带**发起窗口身份**（`windowId`，主进程侧经 `event.sender.id` 取证注入，渲染侧无自报
 * 入口——母型比照 `main/card-window-init-channel.ts`，02 §7.4）。
 */
export interface IDocumentViewSessionLookup {
  readonly source: string;
  readonly documentId: string;
  /** 发起取视图请求的窗口 ID（`webContents.id`；归属比对的请求侧输入）。 */
  readonly windowId: number;
}

/** 卡片窗口装载投递的文档绑定解析结果（主进程内部消费面；工单035 §九待裁随账收口）。 */
export interface ICardWindowDocumentBinding {
  /** 稳定文档标识——与 `document:open` 回包的 `documentId` 同源（同一会话存储记录字段）。 */
  readonly documentId: string;
  /** 资源基址：受管引用的作用域根 URI（`chips-resource://<scope>/`，资源管理器作用域身份）。 */
  readonly resourceBase: string;
}

/**
 * 视图通道会话解析结果（主进程内部消费面；工单035 裁定 / RFC O3）。
 *
 * @remarks `found` 臂交付的 `nativeSession` 为 backing 数值会话（作用域端口 `registerScope`
 * 回执交付的原生 `resourceOpenSession` 句柄，随记录一次落档，INV-1）：只供主进程视图通道适配器
 * 逐调用交原生 `buildDocumentView` 消费，**不得出现在任何跨进程回包**。`not-found` / `conflict`
 * 由适配器映射为
 * `DOCUMENT_NOT_OPEN` / `DOCUMENT_ID_CONFLICT`（在册面内，见通道契约错误码表）；
 * `unowned`（工单043-A4 G2）为记录在册且标识相符、但**无一会话归属发起窗口**，由适配器
 * 映射为在册码 `BRIDGE_SESSION_UNKNOWN`（跨窗口取视图如实拒绝，不泄露视图）。
 */
export type DocumentViewSessionResolution =
  | {
      readonly status: 'found';
      readonly handle: IDocumentHandle;
      readonly nativeSession: number;
      readonly managedUri: string;
    }
  | { readonly status: 'not-found' }
  | { readonly status: 'unowned' }
  | { readonly status: 'conflict'; readonly candidateCount: number };

/** 文档服务对外执行面（组合根把执行器包装进能力注册项，见 `descriptors.ts`）。 */
export interface IDocumentService {
  executeOpen: DocumentCapabilityExecutor<unknown, IDocumentOpenOutput>;
  executeRead: DocumentCapabilityExecutor<unknown, IDocumentReadOutput>;
  executeWrite: DocumentCapabilityExecutor<unknown, IDocumentWriteOutput>;
  executeSave: DocumentCapabilityExecutor<unknown, IDocumentSaveOutput>;
  /**
   * 宿主内部取视图通道的会话解析（`05-渲染引擎设计` §2.6 / 工单035 / 工单043 §五 G2）：按
   * `{source, documentId}` 对在会话存储唯一定位记录，并做**窗口↔会话归属比对**（记录会话
   * 经 `sessionWindowOf` 解析归属窗口，与发起窗口不符即 `unowned`），交付记录级句柄、
   * 数值会话与受管 URI。string↔u64 归一单点在通道适配器（`adapters/view-channel.ts`）消费本方法完成。
   */
  resolveViewSession(lookup: IDocumentViewSessionLookup): DocumentViewSessionResolution;
  /**
   * 卡片窗口装载投递的文档绑定解析（`05-渲染引擎设计` §2.3 装载投递承载 / 工单035 §九待裁随账）：
   * 按来源引用定位存活会话记录，交付 `document:open` 回包同源的稳定标识与资源作用域根。
   *
   * @remarks 定位口径与 {@link IDocumentService.resolveViewSession} 逐字一致（同一
   * `findRecord(source)` 会话键口径）；无存活记录、或受管引用在正式作用域注册表查不到登记
   * 事实（`scopeRootOf` 返回 `null`）时返回 `null`，由投递臂按在册码 `DOCUMENT_NOT_OPEN`
   * 如实拒收（不伪造装载、不在本模块词法切片自算基址）。
   */
  resolveWindowDocument(source: string): ICardWindowDocumentBinding | null;
  /**
   * Bridge 会话释放联动（§4.6 释放语义的宿主入口）：移除该会话的全部文档会话与身份声明，
   * 并对被移除记录执行两拍收口（① 端口 `unregisterScope` → ② 释放解析句柄，INV-2）；
   * 本方法是主进程退出清理的同一入口（`host-runtime.ts` `shutdown` 逐会话关闭 → 本联动，
   * 停机链在途释放在 `shutdown` 返回前收口）。
   */
  releaseSessions(sessionId: string): Promise<void>;
  /** 观察面：当前活动文档记录数（诊断与测试）。 */
  activeRecordCount(): number;
}

/** 序列化请求的变更分片集合类型（`IDocumentSerializeRequest['changedParts']` 的可书写形态）。 */
type ChangedParts = readonly DocumentPart[];

/** 卡片内容成员的包内路径（`01-卡片文件格式` §三、§5.3）。 */
function contentMemberPath(nodeId: string): string {
  return `content/${nodeId}.yaml`;
}

/** 包内成员的字节数累加（`document:changed` 的 `size` 口径）。 */
function totalByteLength(members: readonly { readonly bytes: Uint8Array }[]): number {
  let size = 0;
  for (const member of members) {
    size += member.bytes.byteLength;
  }
  return size;
}

/**
 * 从受管引用推导文档类型提示（扩展名口径：`.card` / `.box`）。
 *
 * @remarks `04-能力契约规范` §7.3：`kind` 缺省时按内容识别。扩展名可判定时作为解析器的
 * 声明格式提示；不可判定时交由解析器按内容自动识别（`06-文档解析器设计` §3），服务不猜格式。
 * 波 B2 核证保留：本派生只是**解析提示**，不构成路径或作用域的第二事实源（点位三消费臂
 * 只收敛 `localPath` 与作用域根两项，#234 勘查 §B.2 与裁决I-⑤ 同口径），故随本波保留。
 */
function kindHintFromManagedUri(managedUri: string): DocumentKind | null {
  const lowered = managedUri.toLowerCase();
  if (lowered.endsWith('.card')) {
    return 'card';
  }
  if (lowered.endsWith('.box')) {
    return 'box';
  }
  return null;
}

/** 把序列化成员按包内路径升序排列（变更集处理顺序，§5.2）。 */
function sortMembers(members: readonly IDocumentSerializedMember[]): readonly IDocumentSerializedMember[] {
  return [...members].sort((a, b) => comparePackagePath(a.packagePath, b.packagePath));
}

/** 创建文档服务能力服务。 */
export function createDocumentService(deps: IDocumentServiceDependencies): IDocumentService {
  const store = createDocumentSessionStore(
    async (handle) => {
      await deps.parser.release(handle);
    },
    // 两拍接线单点（INV-2/INV-6）：记录驱逐期经端口注销常驻作用域（正式适配器内部
    // `resourceUnregisterScope` → `resourceCloseSession`），次序与失败口径见 `session-store.ts`
    // `releaseSessionsOf`；`document:closed` 事件不承担资源注销（裁决I-④ 形态①）。
    async (scopeRef) => {
      await deps.scope.unregisterScope(scopeRef);
    },
  );

  /** 调用前置判定：取消 → 截止 → 会话活跃 → 权限快照（§5.2 阶段序；判定本体在 Bridge，每调用查询、不缓存）。 */
  async function authorize(capabilityId: DocumentCapabilityId, ctx: IDocumentCapabilityContext): Promise<void> {
    if (ctx.signal.aborted) {
      throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.cancelled, { details: { capabilityId } });
    }
    if (ctx.deadline !== undefined && Date.now() > ctx.deadline) {
      throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.timeout, { details: { capabilityId } });
    }
    if (!(await deps.guard.isSessionActive(ctx.sessionId))) {
      throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.sessionUnknown, { details: { capabilityId } });
    }
    for (const permission of DOCUMENT_CAPABILITY_PERMISSIONS[capabilityId]) {
      if (!(await deps.guard.hasPermission(ctx.sessionId, permission))) {
        throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.permissionDenied, {
          details: { capabilityId, permission },
        });
      }
    }
  }

  /** 事件发布（失败只落诊断日志，不改变已完成的调用结果，§7.3）。 */
  async function publish(eventId: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    try {
      await deps.events.publish(eventId, payload);
    } catch (error: unknown) {
      deps.diagnostics?.error('document', `事件发布失败：${eventId}`, { error: asDocumentCapabilityError(error).code });
    }
  }

  /** 读取会话有效 metadata 覆盖层（无覆盖时回落解析基线）。 */
  function metadataOf(record: IDocumentRecord, session: IDocumentSession): DocumentValue {
    return session.overlays.metadata ?? record.baselineMetadata;
  }

  /** 读取（并缓存）磁盘基线 structure 切片：变更集与一致性核对的对照基准。 */
  async function ensureBaselineStructure(record: IDocumentRecord, signal: AbortSignal): Promise<DocumentValue> {
    if (record.lazy.structure !== undefined) {
      return record.lazy.structure;
    }
    const outcome = await deps.parser.readPart(record.handle, { part: 'structure' }, signal);
    record.lazy.structure = outcome.value;
    record.lazy.structureDiagnostics = outcome.diagnostics;
    return outcome.value;
  }

  /** 读取会话有效 structure 切片（覆盖层优先，未覆盖时按需触发解析器惰性层级，§4.3）。 */
  async function ensureStructure(
    record: IDocumentRecord,
    session: IDocumentSession,
    signal: AbortSignal,
  ): Promise<DocumentValue> {
    if (session.overlays.structure !== undefined) {
      return session.overlays.structure;
    }
    return ensureBaselineStructure(record, signal);
  }

  /** 读取（并缓存）箱子 `.box/content.yaml` 布局配置切片。 */
  async function ensureLayoutConfig(
    record: IDocumentRecord,
    session: IDocumentSession,
    signal: AbortSignal,
  ): Promise<{ value: DocumentValue; diagnostics: readonly IDocumentDiagnostic[] }> {
    if (session.overlays.layoutConfig !== undefined) {
      return { value: session.overlays.layoutConfig, diagnostics: [] };
    }
    if (record.lazy.layoutConfig !== undefined) {
      return { value: record.lazy.layoutConfig, diagnostics: record.lazy.layoutDiagnostics ?? [] };
    }
    const outcome = await deps.parser.readPart(record.handle, { part: 'content' }, signal);
    record.lazy.layoutConfig = outcome.value;
    record.lazy.layoutDiagnostics = outcome.diagnostics;
    return { value: outcome.value, diagnostics: outcome.diagnostics };
  }

  /** 读取卡片单个内容成员（会话覆盖层优先，其次记录级缓存，最后解析器惰性层级，§4.3）。 */
  async function ensureContentNode(
    record: IDocumentRecord,
    session: IDocumentSession,
    nodeId: string,
    signal: AbortSignal,
  ): Promise<{ value: DocumentValue; diagnostics: readonly IDocumentDiagnostic[] }> {
    const overlay = session.overlays.contentNodes.get(nodeId);
    if (overlay !== undefined && overlay !== null) {
      return { value: overlay, diagnostics: [] };
    }
    const cached = record.lazy.contents.get(nodeId);
    if (cached !== undefined) {
      return { value: cached, diagnostics: record.lazy.contentsDiagnostics.get(nodeId) ?? [] };
    }
    const outcome = await deps.parser.readPart(record.handle, { part: 'content', nodeId }, signal);
    record.lazy.contents.set(nodeId, outcome.value);
    record.lazy.contentsDiagnostics.set(nodeId, outcome.diagnostics);
    return { value: outcome.value, diagnostics: outcome.diagnostics };
  }

  /** 内容节点缺失（结构引用但模型与磁盘都没有）：`DOCUMENT_STRUCTURE_INVALID`（§4.4）。 */
  function contentNodeMissing(record: IDocumentRecord, nodeId: string, reason: string): never {
    throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, {
      details: { documentId: record.documentId, part: 'content', nodeId, reason },
    });
  }

  /**
   * 收集卡片当前有效内容成员与删除集合（严格一致性核对，§4.4）。
   *
   * @param baselineIds - 磁盘基线的结构成员编号集合（变更集删除推导的对照基准）。
   */
  async function collectCardContents(
    record: IDocumentRecord,
    session: IDocumentSession,
    structure: DocumentValue,
    baselineIds: Set<string>,
    signal: AbortSignal,
  ): Promise<{ nodes: { nodeId: string; value: DocumentValue }[]; removed: string[] }> {
    const ids = cardStructureNodeIds(structure);
    const idSet = new Set(ids);
    const nodes: { nodeId: string; value: DocumentValue }[] = [];
    const removed: string[] = [];
    for (const nodeId of ids) {
      const overlay = session.overlays.contentNodes.get(nodeId);
      if (overlay === null) {
        contentNodeMissing(record, nodeId, '结构仍引用被会话删除的内容成员');
      }
      if (overlay !== undefined) {
        nodes.push({ nodeId, value: overlay });
        continue;
      }
      if (!baselineIds.has(nodeId) && !record.lazy.contents.has(nodeId)) {
        contentNodeMissing(record, nodeId, '结构新增的节点缺少内容成员（须由编辑链路写入初始值）');
      }
      const resolved = await ensureContentNode(record, session, nodeId, signal);
      nodes.push({ nodeId, value: resolved.value });
    }
    for (const [nodeId, overlay] of session.overlays.contentNodes) {
      if (!idSet.has(nodeId) && overlay !== null) {
        contentNodeMissing(record, nodeId, '内容成员已脱离结构（结构未同步移除）');
      }
    }
    for (const nodeId of baselineIds) {
      if (idSet.has(nodeId)) {
        continue;
      }
      if (session.overlays.contentNodes.get(nodeId) !== null) {
        contentNodeMissing(record, nodeId, '结构移除的节点仍残留内容成员（须以 value: null 删除成员）');
      }
      removed.push(nodeId);
    }
    return { nodes, removed: removed.sort(comparePackagePath) };
  }

  /**
   * 记录存续期的本地可读路径现取（点位三正向消费臂，`04.11` §11.3 行 19）。
   *
   * @remarks 本方法是挂载建立后本服务取得磁盘路径的**唯一**入口：入参一律是记录级的
   * `managedUri` + `nativeSession`（INV-1 回执交付值），换算权威在资源管理器
   * （`resourceLocalPathOf` → 核心 `ScopeRegistry` 的 `Origin`），服务与记录面均不缓存路径
   * ——「宿主自存 `localPath`」的双份事实源随工单036 波 B2 消除（RFC §6.1 消费面）。
   * 失败以已登记 `RESOURCE_*` 码原样透传（作用域漂移 `RESOURCE_NOT_FOUND` / 会话未绑定
   * `RESOURCE_PERMISSION_DENIED` / Origin 无本地形 `RESOURCE_NOT_SUPPORTED`，端口头注口径），
   * 保存链路上的失败按既有 `DOCUMENT_SAVE_FAILED` 归口承载 `details.cause`。
   */
  async function localPathOfRecord(record: IDocumentRecord): Promise<string> {
    return await deps.scope.localPathOf(record.managedUri, record.nativeSession);
  }

  /** 以当前有效模型构造序列化请求（保存变更集）。 */
  async function buildSerializeRequest(
    record: IDocumentRecord,
    session: IDocumentSession,
    changedParts: ChangedParts,
    signal: AbortSignal,
  ): Promise<IDocumentSerializeRequest> {
    const metadata = metadataOf(record, session);
    const structure = await ensureStructure(record, session, signal);
    // 未修订成员的字节复用输入：路径经点位三现取（记录面不自存）。
    const localPath = await localPathOfRecord(record);
    if (record.kind === 'card') {
      const baselineStructure = await ensureBaselineStructure(record, signal);
      const baselineIds = new Set(cardStructureNodeIds(baselineStructure));
      const collected = await collectCardContents(record, session, structure, baselineIds, signal);
      return {
        kind: 'card',
        form: record.form,
        localPath,
        metadata,
        structure,
        contents: collected.nodes,
        layoutConfig: null,
        changedParts,
        removedNodeIds: collected.removed,
      };
    }
    const layout = await ensureLayoutConfig(record, session, signal);
    return {
      kind: 'box',
      form: record.form,
      localPath,
      metadata,
      structure,
      contents: [],
      layoutConfig: layout.value,
      changedParts,
      removedNodeIds: [],
    };
  }

  /** 从磁盘复算摘要与字节数（保存后与 no-op 保存的权威口径，§5.5）。 */
  async function recomputeDigestFromDisk(record: IDocumentRecord): Promise<{ digest: string; size: number }> {
    // 磁盘复算的输入路径经点位三现取（RFC §6.1 消费面对本函数的明载口径）。
    const localPath = await localPathOfRecord(record);
    if (record.form === 'directory') {
      const members = await deps.storage.listMembers(localPath);
      return {
        digest: computePackageContentDigest(members),
        size: totalByteLength(members),
      };
    }
    const bytes = await deps.storage.readFileBytes(localPath);
    return { digest: computeFileDigest(bytes), size: bytes.byteLength };
  }

  /** 声明会话身份：同会话内不同来源解析出同一稳定标识即冲突（§3.1 步骤 3）。 */
  function claimSessionIdentityOrThrow(ctx: IDocumentCapabilityContext, documentId: string, managedUri: string): void {
    if (store.claimSessionIdentity(ctx.sessionId, documentId, managedUri) === 'conflict') {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.idConflict, {
        details: { documentId, source: managedUri, capabilityId: DOCUMENT_CAPABILITY_IDS.open },
      });
    }
  }

  /**
   * 建立文档记录（§3.1 步骤 2～5）：解析到 L0 → 声明身份 → 注册资源作用域 → 建立记录。
   *
   * @remarks 任一步失败都不得留下半开状态：身份声明后作用域注册失败即撤回声明并释放句柄；
   * 显式 `kind` 与解析结果矛盾在建立记录前按解析器同码拒绝（§10.3 同场景单码）。
   * 建立的记录**不含 `localPath`**（工单036 波 B2）：路径只在挂载前的第一跳作为入参出现，
   * 记录存续期一律经 {@link localPathOfRecord} 现取。
   */
  async function establishRecord(
    resolved: IResolvedDocumentSource,
    requestedKind: DocumentKind | null,
    ctx: IDocumentCapabilityContext,
  ): Promise<IDocumentRecord> {
    const parsed = await deps.parser.open({
      // 挂载前的第一跳输入：此刻记录尚无原生会话，点位三换算口不可达（会话绑定闸），
      // 路径由 `normalizeSource` 的归一产物一次性交付——**不落记录面**（记录存续期改现取）。
      localPath: resolved.localPath,
      kind: requestedKind ?? kindHintFromManagedUri(resolved.managedUri),
      signal: ctx.signal,
    });
    if (requestedKind !== null && requestedKind !== parsed.kind) {
      await deps.parser.release(parsed.handle);
      throw documentError(DOCUMENT_PARSER_ERROR_CODES.formatUnknown, {
        details: { capabilityId: DOCUMENT_CAPABILITY_IDS.open, source: resolved.managedUri, kind: requestedKind },
      });
    }
    claimSessionIdentityOrThrow(ctx, parsed.documentId, resolved.managedUri);
    let registration: IDocumentScopeRegistration;
    try {
      registration = await deps.scope.registerScope({
        documentId: parsed.documentId,
        managedUri: resolved.managedUri,
        kind: parsed.kind,
      });
    } catch (error: unknown) {
      store.withdrawSessionIdentity(ctx.sessionId, parsed.documentId, resolved.managedUri);
      await deps.parser.release(parsed.handle);
      throw asDocumentCapabilityError(error);
    }
    const record = store.openRecord({
      managedUri: resolved.managedUri,
      form: resolved.form,
      kind: parsed.kind,
      documentId: parsed.documentId,
      title: parsed.title,
      handle: parsed.handle,
      // INV-1：记录面数值会话只承接端口回执里的原生句柄，本服务不生成、不自增、不猜测。
      nativeSession: registration.nativeSession,
      baselineMetadata: parsed.metadata,
      baselineDiagnostics: parsed.diagnostics,
      baselineFingerprint: parsed.fingerprint,
    });
    if (record.handle !== parsed.handle) {
      // 并发打开同一来源：记录已由先到的调用建立，本调用的冗余句柄即刻回收（§3.5 单记录单句柄）。
      await deps.parser.release(parsed.handle);
    }
    if (record.nativeSession !== registration.nativeSession) {
      // 不变量探测（#213 A2b-4(ii) 形，禁第三注销入口）：同一受管引用的两次登记在适配器
      // 同键串行化下必回同一在册会话；回执分叉即构造性漂移，如实留痕、不据此另开收口路径。
      deps.diagnostics?.error('document', '作用域登记回执与在册记录的数值会话不一致（构造性漂移）', {
        documentId: record.documentId,
        managedUri: record.managedUri,
      });
    }
    return record;
  }

  /**
   * 记录建立后步骤失败时的回收：撤回身份声明、移除无会话记录并注销作用域与释放句柄（§4.2 不留半开状态）。
   *
   * @remarks 两拍次序（INV-2）：先经端口注销本次已挂载的常驻作用域（适配器内部
   * `resourceUnregisterScope` → `resourceCloseSession`），后释放解析句柄。本臂是**清理路径**，
   * 不得掩盖调用方的主失败：注销未达（如归属闸 `PERMISSION_DENIED`）时以 error 级诊断如实留痕
   * （适配器自身已按「疑似孤儿」审计），随后仍收口句柄、不外抛——静默即孤儿常驻。
   */
  async function rollbackFreshRecord(record: IDocumentRecord, ctx: IDocumentCapabilityContext): Promise<void> {
    store.withdrawSessionIdentity(ctx.sessionId, record.documentId, record.managedUri);
    if (!store.discardRecord(record)) {
      return;
    }
    try {
      await deps.scope.unregisterScope({ documentId: record.documentId, managedUri: record.managedUri });
    } catch (error: unknown) {
      const normalized = asDocumentCapabilityError(error);
      deps.diagnostics?.error('document', '打开失败回收：作用域注销未达（适配器保留在册账与原生会话待处置）', {
        documentId: record.documentId,
        managedUri: record.managedUri,
        cause: normalized.code,
      });
    }
    await deps.parser.release(record.handle);
  }

  /**
   * `document:open` 执行臂（含工单041 修复波的 `render` 类别阶段导出）。
   *
   * @remarks 边界记录沿用 `@chips/perf` 在册规范标记点名（`src/scenarios.ts` `MARKERS`，
   * 《渲染引擎设计》§10.1 阶段预算边界同源）：`render:request-accepted`（请求接受：
   * 入参闸 + 授权 + 来源归一通过点）→ `document:parsed`（记录建立：解析到 L0 +
   * 身份声明 + 作用域注册完成点）。每条边界记录的 `durationMs` 按 §2.3「该阶段耗时」
   * 口径承载其前置分段耗时（接受记录 = 装载/路由段，parsed 记录 = 解析段），
   * 一次打开一个操作级 `traceId`（§2.5）。
   */
  async function executeOpen(input: unknown, ctx: IDocumentCapabilityContext): Promise<IDocumentOpenOutput> {
    const trace = getHostTrace();
    const traceEnabled = trace.enabled('render');
    const openTraceId = traceEnabled ? trace.newTraceId() : '';
    const enteredAtMs = performance.now();
    const checked = assertOpenInput(input);
    await authorize(DOCUMENT_CAPABILITY_IDS.open, ctx);
    const resolved = await deps.scope.normalizeSource(checked.source, ctx);
    const acceptedAtMs = performance.now();
    if (traceEnabled) {
      trace.record({
        category: 'render',
        phase: DOCUMENT_OPEN_TRACE_PHASES.requestAccepted,
        traceId: openTraceId,
        sessionId: ctx.sessionId,
        outcome: 'ok',
        durationMs: Math.max(0, acceptedAtMs - enteredAtMs),
        details: { capabilityId: DOCUMENT_CAPABILITY_IDS.open, source: resolved.managedUri },
      });
    }
    const existing = store.findRecord(resolved.managedUri);
    const record = existing ?? (await establishRecord(resolved, checked.kind, ctx));
    if (existing !== undefined) {
      // 既有记录：显式 `kind` 与解析结果矛盾按解析器同码拒绝；随后声明本会话身份（§3.1）。
      assertKindMatchesRequest(checked.kind, record);
      claimSessionIdentityOrThrow(ctx, record.documentId, record.managedUri);
    }
    const parsedAtMs = performance.now();
    if (traceEnabled) {
      trace.record({
        category: 'render',
        phase: DOCUMENT_OPEN_TRACE_PHASES.documentParsed,
        traceId: openTraceId,
        sessionId: ctx.sessionId,
        outcome: 'ok',
        durationMs: Math.max(0, parsedAtMs - acceptedAtMs),
        details: {
          capabilityId: DOCUMENT_CAPABILITY_IDS.open,
          documentId: record.documentId,
          reusedRecord: existing !== undefined,
        },
      });
    }
    const isNewSession = !record.sessions.has(ctx.sessionId);
    try {
      store.getOrCreateSession(record, ctx.sessionId);
    } catch (error: unknown) {
      // §4.6 `closing` 竞态：本次新建的记录不得留下半开状态。
      if (existing === undefined) {
        await rollbackFreshRecord(record, ctx);
      }
      throw asDocumentCapabilityError(error);
    }
    if (isNewSession) {
      await publish(DOCUMENT_EVENT_IDS.opened, { uri: record.managedUri, kind: record.kind, title: record.title });
    }
    return {
      documentId: record.documentId,
      source: record.managedUri,
      kind: record.kind,
      title: record.title,
      digest: computeQuickFingerprintDigest(record.baselineFingerprint),
    };
  }

  /** 显式 `kind` 与既有记录的解析结果矛盾时按解析器同码确定性拒绝（§3.1 步骤 2）。 */
  function assertKindMatchesRequest(requested: DocumentKind | null, record: IDocumentRecord): void {
    if (requested === null || requested === record.kind) {
      return;
    }
    throw documentError(DOCUMENT_PARSER_ERROR_CODES.formatUnknown, {
      details: {
        capabilityId: DOCUMENT_CAPABILITY_IDS.open,
        documentId: record.documentId,
        source: record.managedUri,
        kind: requested,
      },
    });
  }

  async function executeRead(input: unknown, ctx: IDocumentCapabilityContext): Promise<IDocumentReadOutput> {
    const checked = assertReadInput(input);
    await authorize(DOCUMENT_CAPABILITY_IDS.read, ctx);
    const { record, session } = locateSession(DOCUMENT_CAPABILITY_IDS.read, checked.documentId, ctx);
    assertPartCombination(record.kind, checked.part, checked.nodeId, checked.range, DOCUMENT_CAPABILITY_IDS.read);
    switch (checked.part) {
      case 'metadata': {
        const overwritten = session.overlays.metadata !== undefined;
        return {
          part: 'metadata',
          value: metadataOf(record, session),
          diagnostics: overwritten ? [] : record.baselineDiagnostics,
        };
      }
      case 'structure': {
        const overwritten = session.overlays.structure !== undefined;
        const value = await ensureStructure(record, session, ctx.signal);
        return {
          part: 'structure',
          value,
          // 会话覆盖层是模型自有的完整切片，不再附带解析器基线诊断（§4.3）。
          diagnostics: overwritten ? [] : (record.lazy.structureDiagnostics ?? []),
        };
      }
      case 'content': {
        if (record.kind === 'box') {
          const layout = await ensureLayoutConfig(record, session, ctx.signal);
          return { part: 'content', value: layout.value, diagnostics: layout.diagnostics };
        }
        const nodeId = checked.nodeId;
        if (nodeId === null) {
          throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported, {
            details: {
              capabilityId: DOCUMENT_CAPABILITY_IDS.read,
              part: 'content',
              reason: '卡片 content 切片必须携带 nodeId',
            },
          });
        }
        const structure = await ensureStructure(record, session, ctx.signal);
        if (!cardStructureNodeIds(structure).includes(nodeId)) {
          throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported, {
            details: { documentId: record.documentId, part: 'content', nodeId, reason: '内容节点不存在于当前结构' },
          });
        }
        if (session.overlays.contentNodes.get(nodeId) === null) {
          throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported, {
            details: { documentId: record.documentId, part: 'content', nodeId, reason: '内容成员已在会话内删除' },
          });
        }
        const resolved = await ensureContentNode(record, session, nodeId, ctx.signal);
        return { part: 'content', value: resolved.value, diagnostics: resolved.diagnostics };
      }
      case 'entries': {
        const structure = await ensureStructure(record, session, ctx.signal);
        const allEntries = readArrayField(structure, 'entries') ?? [];
        const range = checked.range;
        const value = range === null ? allEntries : allEntries.slice(range.offset, range.offset + range.limit);
        return { part: 'entries', value, diagnostics: record.lazy.structureDiagnostics ?? [] };
      }
    }
  }

  /** 会话定位：`documentId` 无活跃会话即 `DOCUMENT_NOT_OPEN`（§4.2）。 */
  function locateSession(
    capabilityId: DocumentCapabilityId,
    documentId: string,
    ctx: IDocumentCapabilityContext,
  ): { record: IDocumentRecord; session: IDocumentSession } {
    const session = store.findSession(ctx.sessionId, documentId);
    if (session === undefined) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.notOpen, { details: { documentId, capabilityId } });
    }
    const record = store.recordOf(session);
    if (record === undefined) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.notOpen, { details: { documentId, capabilityId } });
    }
    return { record, session };
  }

  /** 写租约与外部修改复查（§3.6、§7.2）：租约冲突优先于指纹判定。 */
  async function assertWritable(
    record: IDocumentRecord,
    session: IDocumentSession,
    capabilityId: DocumentCapabilityId,
  ): Promise<void> {
    if (record.leaseHolderSessionId !== null && record.leaseHolderSessionId !== session.sessionId) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.writeConflict, {
        details: { capabilityId, documentId: record.documentId, source: record.managedUri },
      });
    }
    // 指纹复查的本地路径经点位三现取（记录面不自存路径；口径见 `localPathOfRecord`）。
    const currentFingerprint = await deps.parser.fingerprint(await localPathOfRecord(record));
    if (!sourceFingerprintsEqual(currentFingerprint, session.baselineFingerprint)) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.sourceChanged, {
        details: { capabilityId, documentId: record.documentId, source: record.managedUri },
      });
    }
  }

  async function executeWrite(input: unknown, ctx: IDocumentCapabilityContext): Promise<IDocumentWriteOutput> {
    const checked = assertWriteInput(input);
    await authorize(DOCUMENT_CAPABILITY_IDS.write, ctx);
    const { record, session } = locateSession(DOCUMENT_CAPABILITY_IDS.write, checked.documentId, ctx);
    return store.enqueueRecordTask(record, async () => {
      assertPartCombination(record.kind, checked.part, checked.nodeId, null, DOCUMENT_CAPABILITY_IDS.write);
      await assertWritable(record, session, DOCUMENT_CAPABILITY_IDS.write);
      await applyWrite(record, session, checked, ctx.signal);
      // 写入只改内存模型：不落盘、不发布事件（§4.2）；`revision` 每次成功写入前进 1（§3.4）。
      session.revision += 1;
      session.dirty = true;
      session.role = 'writer';
      record.leaseHolderSessionId = ctx.sessionId;
      return { revision: session.revision };
    });
  }

  /** 把已校验的切片写入会话覆盖层（整体替换语义，§4.4）。 */
  async function applyWrite(
    record: IDocumentRecord,
    session: IDocumentSession,
    checked: { part: DocumentPart; nodeId: string | null; value: DocumentValue | null },
    signal: AbortSignal,
  ): Promise<void> {
    const { part, nodeId, value } = checked;
    switch (part) {
      case 'metadata': {
        if (value === null) {
          throw invalidSliceValue(part, 'metadata 切片不接受 null');
        }
        validateMetadataSlice(record.kind, value);
        session.overlays.metadata = value;
        session.dirtyParts.add('metadata');
        return;
      }
      case 'structure': {
        if (value === null) {
          throw invalidSliceValue(part, 'structure 切片不接受 null');
        }
        validateStructureSlice(record.kind, value);
        session.overlays.structure = value;
        session.dirtyParts.add('structure');
        return;
      }
      case 'entries': {
        if (value === null || !Array.isArray(value)) {
          throw invalidSliceValue(part, 'entries 切片必须是数组');
        }
        validateEntriesSlice(value);
        // entries 与 structure 同源（`.box/structure.yaml`）：整体替换 entries 并并入**当前有效**结构切片。
        const structure = await ensureStructure(record, session, signal);
        if (!isPlainRecord(structure)) {
          throw invalidSliceValue('structure', '箱子结构切片必须是对象');
        }
        const merged: Record<string, unknown> = { ...structure, entries: value };
        validateStructureSlice('box', merged);
        session.overlays.structure = merged;
        session.dirtyParts.add('entries');
        return;
      }
      case 'content': {
        if (record.kind === 'box') {
          if (value === null) {
            throw invalidSliceValue(part, '箱子布局配置不接受 null');
          }
          if (Array.isArray(value)) {
            throw invalidSliceValue(part, '箱子布局配置必须是对象');
          }
          session.overlays.layoutConfig = value;
          session.dirtyParts.add('content');
          return;
        }
        if (nodeId === null) {
          throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported, {
            details: {
              capabilityId: DOCUMENT_CAPABILITY_IDS.write,
              part: 'content',
              reason: '卡片 content 切片必须携带 nodeId',
            },
          });
        }
        if (value === null) {
          await assertDeletableContentMember(record, session, nodeId, signal);
          session.overlays.contentNodes.set(nodeId, null);
          session.dirtyParts.add('content');
          return;
        }
        if (Array.isArray(value)) {
          throw invalidSliceValue(part, '内容切片必须是对象');
        }
        session.overlays.contentNodes.set(nodeId, value);
        session.dirtyParts.add('content');
        return;
      }
    }
  }

  /** 切片值形态非法（契约 §7.3 的 `value` 取值约束；调用点以 `throw invalidSliceValue(...)` 表达拒绝）。 */
  function invalidSliceValue(part: DocumentPart, reason: string): DocumentCapabilityError {
    return documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, {
      details: { capabilityId: DOCUMENT_CAPABILITY_IDS.write, part, reason },
    });
  }

  /** 删除成员的已知性核对（当前有效结构引用、记录级缓存或覆盖层任一存在即可）。 */
  async function assertDeletableContentMember(
    record: IDocumentRecord,
    session: IDocumentSession,
    nodeId: string,
    signal: AbortSignal,
  ): Promise<void> {
    const structure = await ensureStructure(record, session, signal);
    const known =
      record.lazy.contents.has(nodeId) ||
      session.overlays.contentNodes.get(nodeId) !== undefined ||
      cardStructureNodeIds(structure).includes(nodeId);
    if (!known) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported, {
        details: { documentId: record.documentId, part: 'content', nodeId, reason: '删除目标不是已知内容成员' },
      });
    }
  }

  async function executeSave(input: unknown, ctx: IDocumentCapabilityContext): Promise<IDocumentSaveOutput> {
    const documentId = requireDocumentId(DOCUMENT_CAPABILITY_IDS.save, input);
    await authorize(DOCUMENT_CAPABILITY_IDS.save, ctx);
    const { record, session } = locateSession(DOCUMENT_CAPABILITY_IDS.save, documentId, ctx);
    return store.enqueueRecordTask(record, async () => {
      if (!session.dirty) {
        // 幂等 no-op：不要求写租约、不落盘、不发布事件，仍返回磁盘当前摘要（§4.5 步骤 1）。
        const recomputed = await recomputeDigestFromDisk(record);
        record.lastSavedDigest = recomputed.digest;
        return { source: record.managedUri, digest: recomputed.digest };
      }
      await assertWritable(record, session, DOCUMENT_CAPABILITY_IDS.save);
      const built = await buildSerializeRequest(record, session, [...session.dirtyParts], ctx.signal);
      let members: readonly IDocumentSerializedMember[];
      try {
        members = sortMembers(await deps.parser.serialize(built, ctx.signal));
      } catch (error: unknown) {
        throw saveFailed(record, error);
      }
      assertSerializedMemberPaths(members.map((member) => member.packagePath));
      const removals = built.removedNodeIds.map(contentMemberPath).sort(comparePackagePath);
      try {
        await deps.storage.commit({
          // 受控提交输入路径经点位三现取（正式 storage 适配器内部再按反向换算走受管面，波 C）。
          localPath: await localPathOfRecord(record),
          form: record.form,
          members,
          removals,
          signal: ctx.signal,
        });
      } catch (error: unknown) {
        throw saveFailed(record, error);
      }
      const committedFingerprint = await rebuildAfterCommit(record, ctx.signal);
      const recomputed = await recomputeDigestFromDisk(record);
      record.lastSavedDigest = recomputed.digest;
      finalizeSavedSession(record, session, committedFingerprint, recomputed.digest);
      await publish(DOCUMENT_EVENT_IDS.changed, {
        uri: record.managedUri,
        documentId: record.documentId,
        kind: record.kind,
        digest: recomputed.digest,
        size: recomputed.size,
      });
      await publish(DOCUMENT_EVENT_IDS.saved, { uri: record.managedUri, kind: record.kind });
      return { source: record.managedUri, digest: recomputed.digest };
    });
  }

  /**
   * 提交成功后的只读句柄重建（§4.5 步骤 5、§3.5）。
   *
   * @remarks 先按新指纹打开新句柄，成功后再释放旧句柄：重建失败时旧句柄仍可用，
   * 本次保存按 `DOCUMENT_SAVE_FAILED` 返回、`dirty` 保持（§4.2 失败语义），
   * 磁盘与基线指纹不一致由下一次写入/保存以 `DOCUMENT_SOURCE_CHANGED` 暴露（§7.2 恢复路径是重新打开）。
   */
  async function rebuildAfterCommit(record: IDocumentRecord, signal: AbortSignal): Promise<ISourceFingerprint> {
    // 提交后重建的输入路径同样经点位三现取（磁盘已换代际，缓存路径在此最易失真）。
    const localPath = await localPathOfRecord(record);
    const newFingerprint = await deps.parser.fingerprint(localPath);
    let reloaded: IDocumentParseOutcome;
    try {
      reloaded = await deps.parser.open({ localPath, kind: record.kind, signal });
    } catch (error: unknown) {
      throw saveFailed(record, error);
    }
    try {
      await deps.parser.release(record.handle);
    } catch (error: unknown) {
      // 旧句柄释放失败不影响已完成的保存：新句柄已建立，失败落宿主诊断日志。
      deps.diagnostics?.warn('document', '旧解析句柄释放失败', {
        documentId: record.documentId,
        cause: asDocumentCapabilityError(error).code,
      });
    }
    record.handle = reloaded.handle;
    record.baselineMetadata = reloaded.metadata;
    record.baselineDiagnostics = reloaded.diagnostics;
    return newFingerprint;
  }

  /** 保存成功后的会话收口：清空覆盖层与变更集、前移 savepoint、归还租约（§4.5 步骤 5、§7.5）。 */
  function finalizeSavedSession(
    record: IDocumentRecord,
    session: IDocumentSession,
    newFingerprint: ISourceFingerprint,
    digest: string,
  ): void {
    clearLazyParts(record);
    session.overlays.contentNodes.clear();
    delete session.overlays.metadata;
    delete session.overlays.structure;
    delete session.overlays.layoutConfig;
    session.dirtyParts.clear();
    session.dirty = false;
    session.savepointDigest = digest;
    session.baselineFingerprint = newFingerprint;
    record.baselineFingerprint = newFingerprint;
    session.role = 'reader';
    record.leaseHolderSessionId = null;
  }

  /** 清空记录级惰性缓存（磁盘基线已随保存前进，下一次读取按新句柄重建）。 */
  function clearLazyParts(record: IDocumentRecord): void {
    delete record.lazy.structure;
    delete record.lazy.structureDiagnostics;
    delete record.lazy.layoutConfig;
    delete record.lazy.layoutDiagnostics;
    record.lazy.contents.clear();
    record.lazy.contentsDiagnostics.clear();
  }

  /** 落盘链路失败统一归口 `DOCUMENT_SAVE_FAILED`，底层登记码写入 `details.cause`（§10.3）。 */
  function saveFailed(record: IDocumentRecord, error: unknown): DocumentCapabilityError {
    const normalized = asDocumentCapabilityError(error);
    return documentError(DOCUMENT_BUSINESS_ERROR_CODES.saveFailed, {
      details: { documentId: record.documentId, source: record.managedUri, cause: normalized.code },
    });
  }

  function resolveViewSession(lookup: IDocumentViewSessionLookup): DocumentViewSessionResolution {
    const record = store.findRecord(lookup.source);
    if (record === undefined) {
      // 来源无存活记录：该 `{source, documentId}` 对无对应会话，如实 not-found（映射 DOCUMENT_NOT_OPEN）。
      return { status: 'not-found' };
    }
    if (record.documentId === lookup.documentId) {
      // 工单043-A4 G2 归属比对：记录会话全部经 `sessionWindowOf` 解析归属窗口，
      // 无一命中发起窗口即 `unowned`（映射 BRIDGE_SESSION_UNKNOWN）——他窗身份
      // 换不来本窗文档的视图，跨窗口取视图在本单点闸口如实拒绝、不泄露句柄。
      for (const sessionId of record.sessions.keys()) {
        if (deps.sessionWindowOf(sessionId) === lookup.windowId) {
          return {
            status: 'found',
            handle: record.handle,
            nativeSession: record.nativeSession,
            managedUri: record.managedUri,
          };
        }
      }
      return { status: 'unowned' };
    }
    // 来源记录在册但稳定标识不符：二元组与会话存储声明冲突（§3.1 口径），
    // `candidateCount` 如实枚举该标识的存活记录数供诊断。
    return { status: 'conflict', candidateCount: store.findRecordsByDocumentId(lookup.documentId).length };
  }

  function resolveWindowDocument(source: string): ICardWindowDocumentBinding | null {
    const record = store.findRecord(source);
    if (record === undefined) {
      // 来源无存活记录（文档链路未打开或记录已随会话释放移除）：如实 `null`，投递臂拒收。
      return null;
    }
    // 基址口径单源：正式作用域注册表查询（挂载回执核验过的 scope 合形），本模块不切片派生。
    const resourceBase = deps.scope.scopeRootOf(record.managedUri);
    if (resourceBase === null) {
      // 记录在册而注册表查无登记事实：构造性漂移，不猜测资源基址。
      deps.diagnostics?.warn('document', '装载投递绑定解析的受管引用未在作用域注册表投影为资源作用域根', {
        managedUri: record.managedUri,
      });
      return null;
    }
    return { documentId: record.documentId, resourceBase };
  }

  async function releaseSessions(sessionId: string): Promise<void> {
    const { released, scopeFailures } = await store.releaseSessionsOf(sessionId);
    for (const record of released) {
      await publish(DOCUMENT_EVENT_IDS.closed, { uri: record.managedUri, kind: record.kind });
    }
    // 两拍第①拍未达（疑似孤儿在册 scope）：error 级审计留痕，不改写事件口径、不二次注销
    // （`document:closed` 不承担资源注销，裁决I-④ 形态①；注销入口唯一，INV-6）。
    for (const failure of scopeFailures) {
      deps.diagnostics?.error('document', '会话释放：文档作用域注销未达（疑似孤儿在册，待处置）', {
        documentId: failure.documentId,
        managedUri: failure.managedUri,
        cause: failure.cause,
      });
    }
    if (released.length > 0) {
      deps.diagnostics?.warn('document', '会话释放：文档记录已移除', { count: released.length });
    }
  }

  return {
    executeOpen: (input, ctx) => guardStage(executeOpen(input, ctx)),
    executeRead: (input, ctx) => guardStage(executeRead(input, ctx)),
    executeWrite: (input, ctx) => guardStage(executeWrite(input, ctx)),
    executeSave: (input, ctx) => guardStage(executeSave(input, ctx)),
    resolveViewSession,
    resolveWindowDocument,
    releaseSessions,
    activeRecordCount() {
      return store.recordCount();
    },
  };

  /** 顶层异常归一：端口与内部错误映射为 `ChipsError` 同构错误后交 Bridge 透传（§9.1）。 */
  async function guardStage<T>(run: Promise<T>): Promise<T> {
    try {
      return await run;
    } catch (error: unknown) {
      const normalized = asDocumentCapabilityError(error);
      if (normalized.code === DOCUMENT_CHANNEL_ERROR_CODES.internal) {
        deps.diagnostics?.error('document', '文档能力内部错误', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw normalized;
    }
  }
}
