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
 */

import {
  DOCUMENT_CAPABILITY_IDS,
  DOCUMENT_CAPABILITY_PERMISSIONS,
  DOCUMENT_EVENT_IDS,
} from './contract.js';
import type {
  DocumentCapabilityId,
  DocumentKind,
  DocumentPart,
  DocumentValue,
  IDocumentDiagnostic,
  IDocumentOpenInput,
  IDocumentOpenOutput,
  IDocumentReadInput,
  IDocumentReadOutput,
  IDocumentSaveInput,
  IDocumentSaveOutput,
  IDocumentWriteInput,
  IDocumentWriteOutput,
} from './contract.js';
import type { IDocumentCapabilityContext } from './contract.js';
import {
  DOCUMENT_BUSINESS_ERROR_CODES,
  DOCUMENT_CHANNEL_ERROR_CODES,
  DOCUMENT_PARSER_ERROR_CODES,
  asDocumentCapabilityError,
  documentError,
} from './errors.js';
import {
  comparePackagePath,
  computeFileDigest,
  computePackageContentDigest,
  computeQuickFingerprintDigest,
  sourceFingerprintsEqual,
} from './digest.js';
import type { ISourceFingerprint } from './digest.js';
import type {
  IDocumentHandle,
  IDocumentParseOutcome,
  IDocumentSerializedMember,
  IDocumentServiceDependencies,
} from './ports.js';
import { createDocumentSessionStore } from './session-store.js';
import type { IDocumentRecord, IDocumentSession } from './session-store.js';
import {
  assertOpenInput,
  assertPartCombination,
  assertReadInput,
  assertSerializedMemberPaths,
  assertWriteInput,
  cardStructureNodeIds,
  readArrayField,
  requireDocumentId,
  validateEntriesSlice,
  validateMetadataSlice,
  validateStructureSlice,
} from './validation.js';

/** 文档服务对外执行面（组合根把执行器包装进能力注册项，见 `descriptors.ts`）。 */
export interface IDocumentService {
  executeOpen(input: IDocumentOpenInput, ctx: IDocumentCapabilityContext): Promise<IDocumentOpenOutput>;
  executeRead(input: IDocumentReadInput, ctx: IDocumentCapabilityContext): Promise<IDocumentReadOutput>;
  executeWrite(input: IDocumentWriteInput, ctx: IDocumentCapabilityContext): Promise<IDocumentWriteOutput>;
  executeSave(input: IDocumentSaveInput, ctx: IDocumentCapabilityContext): Promise<IDocumentSaveOutput>;
  /** Bridge 会话释放联动：移除该会话的全部文档会话与身份声明（§4.6 释放语义的宿主入口）。 */
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
  const store = createDocumentSessionStore(async (handle) => {
    await deps.parser.release(handle);
  });

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
  async function ensureStructure(record: IDocumentRecord, session: IDocumentSession, signal: AbortSignal): Promise<DocumentValue> {
    if (session.overlays.structure !== undefined) {
      return session.overlays.structure;
    }
    return ensureBaselineStructure(record, signal);
  }

  /** 读取（并缓存）箱子 `.box/content.yaml` 布局配置切片。 */
  async function ensureLayoutConfig(
    record: IDocumentRecord,
    session: IDocumentSession,
    signal: AbortSignal
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
    signal: AbortSignal
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
    signal: AbortSignal
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

  /** 以当前有效模型构造序列化请求（保存变更集）。 */
  async function buildSerializeRequest(
    record: IDocumentRecord,
    session: IDocumentSession,
    changedParts: ChangedParts,
    signal: AbortSignal
  ): Promise<IDocumentSerializeRequest> {
    const metadata = metadataOf(record, session);
    const structure = await ensureStructure(record, session, signal);
    if (record.kind === 'card') {
      const baselineStructure = await ensureBaselineStructure(record, signal);
      const baselineIds = new Set(cardStructureNodeIds(baselineStructure));
      const collected = await collectCardContents(record, session, structure, baselineIds, signal);
      return {
        kind: 'card',
        form: record.form,
        localPath: record.localPath,
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
      localPath: record.localPath,
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
    if (record.form === 'directory') {
      const members = await deps.storage.listMembers(record.localPath);
      return {
        digest: computePackageContentDigest(members),
        size: totalByteLength(members),
      };
    }
    const bytes = await deps.storage.readFileBytes(record.localPath);
    return { digest: computeFileDigest(bytes), size: bytes.byteLength };
  }

  async function executeOpen(input: IDocumentOpenInput, ctx: IDocumentCapabilityContext): Promise<IDocumentOpenOutput> {
    const checked = assertOpenInput(input);
    await authorize(DOCUMENT_CAPABILITY_IDS.open, ctx);
    const resolved = await deps.scope.normalizeSource(checked.source, ctx);
    let record = store.findRecord(resolved.managedUri);
    let created: IDocumentParseOutcome | null = null;
    if (record === undefined) {
      const parsed = await deps.parser.open({
        localPath: resolved.localPath,
        kind: checked.kind ?? kindHintFromManagedUri(resolved.managedUri),
        signal: ctx.signal,
      });
      const claim = store.claimSessionIdentity(ctx.sessionId, parsed.documentId, resolved.managedUri);
      if (claim === 'conflict') {
        await deps.parser.release(parsed.handle);
        throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.idConflict, {
          details: { documentId: parsed.documentId, source: resolved.managedUri },
        });
      }
      try {
        await deps.scope.registerScope({
          documentId: parsed.documentId,
          managedUri: resolved.managedUri,
          kind: parsed.kind,
        });
      } catch (error: unknown) {
        store.withdrawSessionIdentity(ctx.sessionId, parsed.documentId, resolved.managedUri);
        await deps.parser.release(parsed.handle);
        throw asDocumentCapabilityError(error);
      }
      created = parsed;
      record = store.openRecord({
        managedUri: resolved.managedUri,
        localPath: resolved.localPath,
        form: resolved.form,
        kind: parsed.kind,
        documentId: parsed.documentId,
        title: parsed.title,
        handle: parsed.handle,
        baselineMetadata: parsed.metadata,
        baselineDiagnostics: parsed.diagnostics,
        baselineFingerprint: parsed.fingerprint,
      });
    }
    assertKindMatchesRequest(DOCUMENT_CAPABILITY_IDS.open, checked.kind, record);
    const fingerprint = created !== null ? created.fingerprint : record.baselineFingerprint;
    const identityClaim = store.claimSessionIdentity(ctx.sessionId, record.documentId, record.managedUri);
    if (identityClaim === 'conflict') {
      if (created !== null) {
        store.discardRecord(record);
        await deps.parser.release(created.handle);
      }
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.idConflict, {
        details: { documentId: record.documentId, source: record.managedUri },
      });
    }
    const isNewSession = !record.sessions.has(ctx.sessionId);
    store.getOrCreateSession(record, ctx.sessionId);
    if (isNewSession) {
      await publish(DOCUMENT_EVENT_IDS.opened, { uri: record.managedUri, kind: record.kind, title: record.title });
    }
    return {
      documentId: record.documentId,
      source: record.managedUri,
      kind: record.kind,
      title: record.title,
      digest: computeQuickFingerprintDigest(fingerprint),
    };
  }

  /** 显式 `kind` 与既有记录的解析结果矛盾时按解析器同码确定性拒绝（§3.1 步骤 2）。 */
  function assertKindMatchesRequest(capabilityId: DocumentCapabilityId, requested: DocumentKind | null, record: IDocumentRecord): void {
    if (requested === null || requested === record.kind) {
      return;
    }
    throw documentError(DOCUMENT_PARSER_ERROR_CODES.formatUnknown, {
      details: { capabilityId, documentId: record.documentId, source: record.managedUri, kind: requested },
    });
  }

  async function executeRead(input: IDocumentReadInput, ctx: IDocumentCapabilityContext): Promise<IDocumentReadOutput> {
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
          diagnostics: overwritten ? (record.lazy.structureDiagnostics ?? []) : (record.lazy.structureDiagnostics ?? []),
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
            details: { capabilityId: DOCUMENT_CAPABILITY_IDS.read, part: 'content', reason: '卡片 content 切片必须携带 nodeId' },
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
    ctx: IDocumentCapabilityContext
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
    signal: AbortSignal
  ): Promise<void> {
    if (record.leaseHolderSessionId !== null && record.leaseHolderSessionId !== session.sessionId) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.writeConflict, {
        details: { capabilityId, documentId: record.documentId, source: record.managedUri },
      });
    }
    const currentFingerprint = await deps.parser.fingerprint(record.localPath, signal);
    if (!sourceFingerprintsEqual(currentFingerprint, session.baselineFingerprint)) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.sourceChanged, {
        details: { capabilityId, documentId: record.documentId, source: record.managedUri },
      });
    }
  }

  async function executeWrite(input: IDocumentWriteInput, ctx: IDocumentCapabilityContext): Promise<IDocumentWriteOutput> {
    const checked = assertWriteInput(input);
    await authorize(DOCUMENT_CAPABILITY_IDS.write, ctx);
    const { record, session } = locateSession(DOCUMENT_CAPABILITY_IDS.write, checked.documentId, ctx);
    return store.enqueueRecordTask(record, async () => {
      assertPartCombination(record.kind, checked.part, checked.nodeId, null, DOCUMENT_CAPABILITY_IDS.write);
      await assertWritable(record, session, DOCUMENT_CAPABILITY_IDS.write, ctx.signal);
      applyWrite(record, session, checked);
      // 写入只改内存模型：不落盘、不发布事件（§4.2）；`revision` 每次成功写入前进 1（§3.4）。
      session.revision += 1;
      session.dirty = true;
      session.role = 'writer';
      record.leaseHolderSessionId = ctx.sessionId;
      return { revision: session.revision };
    });
  }

  /** 把已校验的切片写入会话覆盖层（整体替换语义，§4.4）。 */
  function applyWrite(
    record: IDocumentRecord,
    session: IDocumentSession,
    checked: { part: DocumentPart; nodeId: string | null; value: DocumentValue | null }
  ): void {
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
        // entries 与 structure 同源（`.box/structure.yaml`）：整体替换 entries 并并入结构覆盖层。
        const structure = session.overlays.structure ?? record.lazy.structure;
        const merged: Record<string, unknown> = { ...(structure ?? {}), entries: value };
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
            details: { part: 'content', reason: '卡片 content 切片必须携带 nodeId' },
          });
        }
        if (value === null) {
          assertDeletableContentMember(record, session, nodeId);
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

  /** 切片值形态非法（契约 §7.3 的 `value` 取值约束）。 */
  function invalidSliceValue(part: DocumentPart, reason: string): never {
    throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, {
      details: { capabilityId: DOCUMENT_CAPABILITY_IDS.write, part, reason },
    });
  }

  /** 删除成员的已知性核对（结构引用、基线缓存或覆盖层任一存在即可）。 */
  function assertDeletableContentMember(record: IDocumentRecord, session: IDocumentSession, nodeId: string): void {
    const structure = session.overlays.structure ?? record.lazy.structure;
    const known =
      record.lazy.contents.has(nodeId) ||
      session.overlays.contentNodes.get(nodeId) !== undefined ||
      (structure !== undefined && cardStructureNodeIds(structure).includes(nodeId));
    if (!known) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported, {
        details: { documentId: record.documentId, part: 'content', nodeId, reason: '删除目标不是已知内容成员' },
      });
    }
  }

  async function executeSave(input: IDocumentSaveInput, ctx: IDocumentCapabilityContext): Promise<IDocumentSaveOutput> {
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
      await assertWritable(record, session, DOCUMENT_CAPABILITY_IDS.save, ctx.signal);
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
          localPath: record.localPath,
          form: record.form,
          members,
          removals,
          signal: ctx.signal,
        });
      } catch (error: unknown) {
        throw saveFailed(record, error);
      }
      const committedFingerprint = await rebuildAfterCommit(record, session, ctx.signal);
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
  async function rebuildAfterCommit(
    record: IDocumentRecord,
    session: IDocumentSession,
    signal: AbortSignal
  ): Promise<ISourceFingerprint> {
    const newFingerprint = await deps.parser.fingerprint(record.localPath, signal);
    let reloaded: IDocumentParseOutcome;
    try {
      reloaded = await deps.parser.open({ localPath: record.localPath, kind: record.kind, signal });
    } catch (error: unknown) {
      throw saveFailed(record, error);
    }
    try {
      await deps.parser.release(record.handle);
    } catch (error: unknown) {
      // 旧句柄释放失败不影响已完成的保存：新句柄已建立，失败落宿主诊断日志。
      deps.diagnostics?.warn('document', '旧解析句柄释放失败', { documentId: record.documentId, cause: asDocumentCapabilityError(error).code });
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
    digest: string
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
  function saveFailed(record: IDocumentRecord, error: unknown): Error {
    const normalized = asDocumentCapabilityError(error);
    return documentError(DOCUMENT_BUSINESS_ERROR_CODES.saveFailed, {
      details: { documentId: record.documentId, source: record.managedUri, cause: normalized.code },
    });
  }

  async function releaseSessions(sessionId: string): Promise<void> {
    const released = await store.releaseSessionsOf(sessionId);
    for (const record of released) {
      await publish(DOCUMENT_EVENT_IDS.closed, { uri: record.managedUri, kind: record.kind });
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
