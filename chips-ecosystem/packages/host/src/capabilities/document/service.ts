/**
 * 文档服务能力服务本体：`document:open` / `document:read` / `document:write` / `document:save`
 * 的执行器（`11-文档服务设计` 全篇的 TS 侧实现口径）。
 *
 * @remarks
 * - 会话、修订、脏状态、写租约、结构校验、摘要复算、事件时序与错误归一在本模块完成；
 *   解析/序列化、受控写、作用域、权限判定与事件投递经端口注入（见 `ports.ts` 头注）。
 * - 事件口径：`document:opened` 于会话建立后发布；`document:changed` 于每次 `document:write`
 *   成功推进 `revision` 后发布（编辑回流消费，`04-能力契约规范` §7.3 约束），并在
 *   `document:save` 持久化完成后按磁盘复算摘要再发布一次，随后 `document:saved`
 *   （`11-文档服务设计` §7.3 时序：`changed` 先于 `saved`）。写事件的 `digest` / `size`
 *   取当前内存模型序列化后的包内容摘要口径；保存事件取 §5.5 两态口径。
 * - 同一文档的 `write` / `save` 经记录级串行队列执行；不同文档互不阻塞（§7.5）。
 */

import {
  DOCUMENT_CAPABILITY_IDS,
  DOCUMENT_CAPABILITY_PERMISSIONS,
  DOCUMENT_EVENT_IDS,
  DOCUMENT_PERMISSION_IDS,
} from './contract.js';
import type {
  DocumentKind,
  DocumentValue,
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
import { DOCUMENT_BUSINESS_ERROR_CODES, DOCUMENT_CHANNEL_ERROR_CODES, asDocumentCapabilityError, documentError } from './errors.js';
import {
  canonicalizeSourceFingerprint,
  comparePackagePath,
  computeFileDigest,
  computePackageContentDigest,
  computeQuickFingerprintDigest,
  fingerprintTotalSize,
  sourceFingerprintsEqual,
} from './digest.js';
import type { IDocumentParseOutcome, IDocumentSerializedMember, IDocumentSerializeRequest, IDocumentServiceDependencies } from './ports.js';
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

/** 文档服务对外执行面（组合根把执行器包装进 Bridge 注册项）。 */
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

/** 序列化全模型时的分片集合（写事件摘要口径）。 */
const ALL_PARTS_BY_KIND: Readonly<Record<DocumentKind, readonly IDocumentSerializeRequest['changedParts'][number][]>> = {
  card: ['metadata', 'structure', 'content'],
  box: ['metadata', 'structure', 'content', 'entries'],
};

/** 卡片内容成员的包内路径。 */
function contentMemberPath(nodeId: string): string {
  return `content/${nodeId}.yaml`;
}

/** 从受管引用推导文档类型（扩展名口径：`.card` / `.box`）。 */
function kindFromManagedUri(managedUri: string, source: string): DocumentKind {
  const lowered = managedUri.toLowerCase();
  if (lowered.endsWith('.card')) {
    return 'card';
  }
  if (lowered.endsWith('.box')) {
    return 'box';
  }
  throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, {
    details: { capabilityId: DOCUMENT_CAPABILITY_IDS.open, source, reason: '受管引用的扩展名无法确定文档格式（仅支持 .card / .box）' },
  });
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

  async function authorize(capabilityId: string, ctx: IDocumentCapabilityContext): Promise<void> {
    if (ctx.signal.aborted) {
      throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.cancelled, { details: { capabilityId } });
    }
    if (ctx.deadline !== undefined && ctx.deadline !== undefined && Date.now() > ctx.deadline) {
      throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.timeout, { details: { capabilityId } });
    }
    if (!(await deps.guard.isSessionActive(ctx.sessionId))) {
      throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.sessionUnknown, { details: { capabilityId } });
    }
    const permissions = DOCUMENT_CAPABILITY_PERMISSIONS[capabilityId as keyof typeof DOCUMENT_CAPABILITY_PERMISSIONS];
    for (const permission of permissions) {
      if (!(await deps.guard.hasPermission(ctx.sessionId, permission))) {
        throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.permissionDenied, {
          details: { capabilityId, permission },
        });
      }
    }
  }

  async function publish(eventId: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    try {
      await deps.events.publish(eventId, payload);
    } catch (error: unknown) {
      // 事件是通知不是状态（§7.3）：发布失败不回滚已完成的写入，落宿主日志。
      deps.diagnostics?.error('document', `事件发布失败：${eventId}`, { error: asDocumentCapabilityError(error).code });
    }
  }

  function parseOutcomeOfRecord(record: IDocumentRecord): IDocumentParseOutcome {
    return {
      handle: record.handle,
      documentId: record.documentId,
      kind: record.kind,
      title: record.title,
      metadata: record.baselineMetadata,
      fingerprint: record.baselineFingerprint,
      diagnostics: record.baselineDiagnostics,
    };
  }

  async function ensureStructure(record: IDocumentRecord, session: IDocumentSession, signal: AbortSignal): Promise<DocumentValue> {
    if (session.overlays.structure !== undefined) {
      return session.overlays.structure;
    }
    if (record.lazy.structure !== undefined) {
      return record.lazy.structure;
    }
    const outcome = await deps.parser.readPart(record.handle, { part: 'structure' }, signal);
    record.lazy.structure = outcome.value;
    record.lazy.structureDiagnostics = outcome.diagnostics;
    return outcome.value;
  }

  async function resolveMetadata(record: IDocumentRecord, session: IDocumentSession): Promise<DocumentValue> {
    return session.overlays.metadata ?? record.baselineMetadata;
  }

  async function ensureLayoutConfig(
    record: IDocumentRecord,
    session: IDocumentSession,
    signal: AbortSignal
  ): Promise<{ value: DocumentValue; diagnostics: readonly IDocumentDiagnosticRef[] }> {
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

  async function ensureContentNode(
    record: IDocumentRecord,
    session: IDocumentSession,
    nodeId: string,
    signal: AbortSignal
  ): Promise<{ value: DocumentValue; diagnostics: readonly IDocumentDiagnosticRef[] } | null> {
    const overlay = session.overlays.contentNodes.get(nodeId);
    if (overlay === null) {
      return null;
    }
    if (overlay !== undefined) {
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

  /** 收集卡片当前有效内容成员。 */
  async function collectCardContents(
    record: IDocumentRecord,
    session: IDocumentSession,
    structure: DocumentValue,
    signal: AbortSignal,
    strict: boolean
  ): Promise<{ nodes: { nodeId: string; value: DocumentValue }[]; removed: string[] }> {
    const ids = cardStructureNodeIds(structure);
    const idSet = new Set(ids);
    const nodes: { nodeId: string; value: DocumentValue }[] = [];
    const removed: string[] = [];
    for (const nodeId of ids) {
      const overlay = session.overlays.contentNodes.get(nodeId);
      if (overlay === null) {
        if (!strict) {
          removed.push(nodeId);
          continue;
        }
        // 严格核对（保存）：结构仍引用的节点被会话删除 = 结构已改、内容未跟上。
        throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, {
          details: { documentId: record.documentId, part: 'content', nodeId, reason: '结构仍引用被删除的内容成员' },
        });
      }
      if (overlay !== undefined) {
        nodes.push({ nodeId, value: overlay });
        continue;
      }
      const resolved = await ensureContentNode(record, session, nodeId, signal);
      if (resolved === null) {
        throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, {
          details: { documentId: record.documentId, part: 'content', nodeId, reason: '结构引用的内容成员不存在' },
        });
      }
      nodes.push({ nodeId, value: resolved.value });
    }
    if (strict) {
      for (const nodeId of session.overlays.contentNodes.keys()) {
        if (!idSet.has(nodeId) && session.overlays.contentNodes.get(nodeId) !== null) {
          throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, {
            details: { documentId: record.documentId, part: 'content', nodeId, reason: '内容成员已脱离结构（残留成员）' },
          });
        }
      }
      for (const nodeId of record.lazy.contents.keys()) {
        if (!idSet.has(nodeId)) {
          throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, {
            details: { documentId: record.documentId, part: 'content', nodeId, reason: '内容成员已脱离结构（残留成员）' },
          });
        }
      }
    }
    return { nodes, removed };
  }

  /** 以当前有效模型构造序列化请求（写事件摘要与保存变更集共用）。 */
  async function buildSerializeRequest(
    record: IDocumentRecord,
    session: IDocumentSession,
    changedParts: readonly IDocumentSerializeRequest['changedParts'],
    signal: AbortSignal,
    strict: boolean
  ): Promise<{ request: IDocumentSerializeRequest; contents: { nodeId: string; value: DocumentValue }[] }> {
    const metadata = await resolveMetadata(record, session);
    const structure = await ensureStructure(record, session, signal);
    if (record.kind === 'card') {
      const collected = await collectCardContents(record, session, structure, signal, strict);
      return {
        request: {
          kind: 'card',
          form: record.form,
          localPath: record.localPath,
          metadata,
          structure,
          contents: collected.nodes,
          layoutConfig: null,
          changedParts,
          removedNodeIds: strict ? collected.removed : [],
        },
        contents: collected.nodes,
      };
    }
    const layout = await ensureLayoutConfig(record, session, signal);
    return {
      request: {
        kind: 'box',
        form: record.form,
        localPath: record.localPath,
        metadata,
        structure,
        contents: [],
        layoutConfig: layout.value,
        changedParts,
        removedNodeIds: [],
      },
      contents: [],
    };
  }

  /** 从磁盘复算摘要与字节数（保存后与 no-op 保存的权威口径）。 */
  async function recomputeDigestFromDisk(
    record: IDocumentRecord
  ): Promise<{ digest: string; size: number }> {
    if (record.form === 'directory') {
      const members = await deps.storage.listMembers(record.localPath);
      const digest = computePackageContentDigest(
        members.map((member) => ({ packagePath: member.packagePath, bytes: member.bytes }))
      );
      let size = 0;
      for (const member of members) {
        size += member.bytes.byteLength;
      }
      return { digest, size };
    }
    const bytes = await deps.storage.readFileBytes(record.localPath);
    return { digest: computeFileDigest(bytes), size: bytes.byteLength };
  }

  async function executeOpen(input: IDocumentOpenInput, ctx: IDocumentCapabilityContext): Promise<IDocumentOpenOutput> {
    const checked = assertOpenInput(input);
    await authorize(DOCUMENT_CAPABILITY_IDS.open, ctx);
    const resolved = await deps.scope.normalizeSource(checked.source, ctx);
    const derivedKind = kindFromManagedUri(resolved.managedUri, checked.source);
    const claim = store.claimSessionIdentity(ctx.sessionId, '', resolved.managedUri);
    void claim;
    let record = store.findRecord(resolved.managedUri);
    let createdHandle: IDocumentParseOutcome | null = null;
    if (record === undefined) {
      const parsed = await deps.parser.open({
        localPath: resolved.localPath,
        kind: checked.kind ?? derivedKind,
        signal: ctx.signal,
      });
      try {
        await deps.scope.registerScope({ documentId: parsed.documentId, managedUri: resolved.managedUri, kind: parsed.kind });
      } catch (error: unknown) {
        await deps.parser.release(parsed.handle);
        throw asDocumentCapabilityError(error);
      }
      createdHandle = parsed;
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
    const outcome = createdHandle ?? parseOutcomeOfRecord(record);
    const identityClaim = store.claimSessionIdentity(ctx.sessionId, record.documentId, record.managedUri);
    if (identityClaim === 'conflict') {
      if (createdHandle !== null) {
        await deps.parser.release(createdHandle.handle);
      }
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.idConflict, {
        details: { documentId: record.documentId, source: record.managedUri },
      });
    }
    const isNewSession = !record.sessions.has(ctx.sessionId);
    const session = store.getOrCreateSession(record, ctx.sessionId);
    const digest = computeQuickFingerprintDigest(outcome.fingerprint);
    if (isNewSession) {
      await publish(DOCUMENT_EVENT_IDS.opened, { uri: record.managedUri, kind: record.kind, title: record.title });
    }
    void session;
    return {
      documentId: record.documentId,
      source: record.managedUri,
      kind: record.kind,
      title: record.title,
      digest,
    };
  }

  async function executeRead(input: IDocumentReadInput, ctx: IDocumentCapabilityContext): Promise<IDocumentReadOutput> {
    const checked = assertReadInput(input);
    await authorize(DOCUMENT_CAPABILITY_IDS.read, ctx);
    const session = store.findSession(ctx.sessionId, checked.documentId);
    if (session === undefined) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.notOpen, { details: { documentId: checked.documentId } });
    }
    const record = store.recordOf(session);
    if (record === undefined) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.notOpen, { details: { documentId: checked.documentId } });
    }
    assertPartCombination(record.kind, checked.part, checked.nodeId, checked.range, DOCUMENT_CAPABILITY_IDS.read);
    switch (checked.part) {
      case 'metadata': {
        const value = await resolveMetadata(record, session);
        return { part: 'metadata', value, diagnostics: session.overlays.metadata === undefined ? record.baselineDiagnostics : [] };
      }
      case 'structure': {
        const value = await ensureStructure(record, session, ctx.signal);
        const fromOverlay = session.overlays.structure !== undefined;
        return {
          part: 'structure',
          value,
          diagnostics: fromOverlay ? [] : (record.lazy.structureDiagnostics ?? []),
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
        const resolved = await ensureContentNode(record, session, nodeId, ctx.signal);
        if (resolved === null) {
          throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported, {
            details: { documentId: record.documentId, part: 'content', nodeId, reason: '内容成员已在会话内删除' },
          });
        }
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

  async function executeWrite(input: IDocumentWriteInput, ctx: IDocumentCapabilityContext): Promise<IDocumentWriteOutput> {
    const checked = assertWriteInput(input);
    await authorize(DOCUMENT_CAPABILITY_IDS.write, ctx);
    const session = store.findSession(ctx.sessionId, checked.documentId);
    if (session === undefined) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.notOpen, { details: { documentId: checked.documentId } });
    }
    const record = store.recordOf(session);
    if (record === undefined) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.notOpen, { details: { documentId: checked.documentId } });
    }
    return store.enqueueRecordTask(record, async () => {
      assertPartCombination(record.kind, checked.part, checked.nodeId, null, DOCUMENT_CAPABILITY_IDS.write);
      if (record.leaseHolderSessionId !== null && record.leaseHolderSessionId !== ctx.sessionId) {
        throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.writeConflict, {
          details: { documentId: record.documentId, source: record.managedUri },
        });
      }
      const currentFingerprint = await deps.parser.fingerprint(record.localPath);
      if (!sourceFingerprintsEqual(currentFingerprint, session.baselineFingerprint)) {
        throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.sourceChanged, {
          details: { documentId: record.documentId, source: record.managedUri },
        });
      }
      applyWrite(record, session, checked);
      // 结构与内容在同一次保存内保持一致的核对在 save 执行；此处完成分片形态校验。
      session.revision += 1;
      session.dirty = true;
      session.role = 'writer';
      record.leaseHolderSessionId = ctx.sessionId;
      const digest = await publishChangedAfterWrite(record, session, ctx.signal);
      return { revision: session.revision };
      void digest;
    });
  }

  function applyWrite(
    record: IDocumentRecord,
    session: IDocumentSession,
    checked: {
      part: IDocumentWriteInput['part'];
      nodeId: string | null;
      value: DocumentValue | null;
    }
  ): void {
    const { part, nodeId, value } = checked;
    switch (part) {
      case 'metadata': {
        if (value === null) {
          throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, { details: { part, reason: 'metadata 切片不接受 null' } });
        }
        validateMetadataSlice(record.kind, value);
        session.overlays.metadata = value;
        session.dirtyParts.add('metadata');
        return;
      }
      case 'structure': {
        if (value === null) {
          throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, { details: { part, reason: 'structure 切片不接受 null' } });
        }
        validateStructureSlice(record.kind, value);
        session.overlays.structure = value;
        session.dirtyParts.add('structure');
        return;
      }
      case 'entries': {
        if (value === null || !Array.isArray(value)) {
          throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, { details: { part, reason: 'entries 切片必须是数组' } });
        }
        validateEntriesSlice(value);
        // entries 与 structure 同源（`.box/structure.yaml`）：整体替换 entries 并并入结构覆盖层。
        const structure = session.overlays.structure ?? record.lazy.structure;
        const merged: Record<string, unknown> = { ...(structure ?? {}) as Record<string, unknown>, entries: value };
        validateStructureSlice('box', merged);
        session.overlays.structure = merged;
        session.dirtyParts.add('entries');
        return;
      }
      case 'content': {
        if (record.kind === 'box') {
          if (value === null) {
            throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, { details: { part, reason: '箱子布局配置不接受 null' } });
          }
          if (typeof value !== 'object' || Array.isArray(value)) {
            throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, { details: { part, reason: '箱子布局配置必须是对象' } });
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
          // 删除成员：目标必须为已知成员（结构引用或缓存/覆盖层存在）。
          const known =
            record.lazy.contents.has(nodeId) ||
            session.overlays.contentNodes.get(nodeId) !== undefined ||
            cardStructureNodeIds(session.overlays.structure ?? record.lazy.structure ?? {}).includes(nodeId);
          if (!known) {
            throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported, {
              details: { part: 'content', nodeId, reason: '删除目标不是已知内容成员' },
            });
          }
          session.overlays.contentNodes.set(nodeId, null);
          session.dirtyParts.add('content');
          return;
        }
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, { details: { part: 'content', reason: '内容切片必须是对象' } });
        }
        session.overlays.contentNodes.set(nodeId, value);
        session.dirtyParts.add('content');
        return;
      }
    }
  }

  /** 写成功后发布 `document:changed`（当前内存模型的序列化摘要口径）；返回摘要供诊断。 */
  async function publishChangedAfterWrite(
    record: IDocumentRecord,
    session: IDocumentSession,
    signal: AbortSignal
  ): Promise<string> {
    const built = await buildSerializeRequest(record, session, ALL_PARTS_BY_KIND[record.kind], signal, false);
    const members = await deps.parser.serialize(built.request, signal);
    assertSerializedMemberPaths(members.map((member) => member.packagePath));
    const digest = computePackageContentDigest(
      members.map((member) => ({ packagePath: member.packagePath, bytes: member.bytes }))
    );
    let size = 0;
    for (const member of members) {
      size += member.bytes.byteLength;
    }
    await publish(DOCUMENT_EVENT_IDS.changed, {
      uri: record.managedUri,
      documentId: record.documentId,
      kind: record.kind,
      digest,
      size,
    });
    return digest;
  }

  async function executeSave(input: IDocumentSaveInput, ctx: IDocumentCapabilityContext): Promise<IDocumentSaveOutput> {
    const documentId = requireDocumentId(DOCUMENT_CAPABILITY_IDS.save, input);
    await authorize(DOCUMENT_CAPABILITY_IDS.save, ctx);
    const session = store.findSession(ctx.sessionId, documentId);
    if (session === undefined) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.notOpen, { details: { documentId } });
    }
    const record = store.recordOf(session);
    if (record === undefined) {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.notOpen, { details: { documentId } });
    }
    return store.enqueueRecordTask(record, async () => {
      if (record.leaseHolderSessionId !== null && record.leaseHolderSessionId !== ctx.sessionId) {
        throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.writeConflict, {
          details: { documentId: record.documentId, source: record.managedUri },
        });
      }
      if (!session.dirty) {
        // 幂等 no-op：仍从磁盘复算摘要返回（§4.5 步骤 1）。
        const recomputed = await recomputeDigestFromDisk(record);
        record.lastSavedDigest = recomputed.digest;
        return { source: record.managedUri, digest: recomputed.digest };
      }
      const currentFingerprint = await deps.parser.fingerprint(record.localPath);
      if (!sourceFingerprintsEqual(currentFingerprint, session.baselineFingerprint)) {
        throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.sourceChanged, {
          details: { documentId: record.documentId, source: record.managedUri },
        });
      }
      const dirtyParts = [...session.dirtyParts];
      const built = await buildSerializeRequest(record, session, dirtyParts, ctx.signal, true);
      if (record.kind === 'card') {
        assertStructureContentConsistency(record, session, built.request);
      }
      let members: readonly IDocumentSerializedMember[];
      try {
        members = sortMembers(await deps.parser.serialize(built.request, ctx.signal));
      } catch (error: unknown) {
        throw saveFailed(error);
      }
      assertSerializedMemberPaths(members.map((member) => member.packagePath));
      const removals = built.request.removedNodeIds.map(contentMemberPath).sort(comparePackagePath);
      try {
        await deps.storage.commit({ localPath: record.localPath, form: record.form, members, removals, signal: ctx.signal });
      } catch (error: unknown) {
        throw saveFailed(error);
      }
      let reloaded: IDocumentParseOutcome;
      try {
        const newFingerprint = await deps.parser.fingerprint(record.localPath);
        await deps.parser.release(record.handle);
        reloaded = await deps.parser.open({ localPath: record.localPath, kind: record.kind, signal: ctx.signal });
        applySavedRecordState(record, session, reloaded, newFingerprint);
      } catch (error: unknown) {
        throw saveFailed(error);
      }
      const recomputed = await recomputeDigestFromDisk(record);
      record.lastSavedDigest = recomputed.digest;
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

  function saveFailed(error: unknown): Error {
    const normalized = asDocumentCapabilityError(error);
    if (normalized instanceof Object && 'code' in normalized) {
      // 底层失败统一以 `DOCUMENT_SAVE_FAILED` 返回，登记码写入 `details.cause`（§10.3）。
    }
    return documentError(DOCUMENT_BUSINESS_ERROR_CODES.saveFailed, {
      details: { documentId: '', source: '', cause: normalized.code },
    });
  }

  /** 保存前的结构-内容一致性核对（§4.4；序列化请求已按严格模式收集成员）。 */
  function assertStructureContentConsistency(
    record: IDocumentRecord,
    session: IDocumentSession,
    request: IDocumentSerializeRequest
  ): void {
    void record;
    void session;
    const structure = request.structure;
    const ids = new Set(cardStructureNodeIds(structure));
    for (const node of request.contents) {
      if (!ids.has(node.nodeId)) {
        throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, {
          details: { documentId: request.localPath, part: 'content', nodeId: node.nodeId, reason: '内容成员脱离结构引用' },
        });
      }
    }
  }

  /** 保存成功后的记录与会话收口（§4.5 步骤 5、§7.5）。 */
  function applySavedRecordState(
    record: IDocumentRecord,
    session: IDocumentSession,
    reloaded: IDocumentParseOutcome,
    newFingerprint: ISourceFingerprintRef
  ): void {
    record.handle = reloaded.handle;
    record.baselineMetadata = reloaded.metadata;
    record.baselineDiagnostics = reloaded.diagnostics;
    record.baselineFingerprint = newFingerprint;
    record.lazy.structure = undefined;
    record.lazy.structureDiagnostics = undefined;
    record.lazy.contents.clear();
    record.lazy.contentsDiagnostics.clear();
    record.lazy.layoutConfig = undefined;
    record.lazy.layoutDiagnostics = undefined;
    session.overlays.metadata = undefined;
    session.overlays.structure = undefined;
    session.overlays.layoutConfig = undefined;
    session.overlays.contentNodes.clear();
    session.dirtyParts.clear();
    session.dirty = false;
    session.savepointDigest = record.lastSavedDigest;
    session.baselineFingerprint = newFingerprint;
    session.role = 'reader';
    record.leaseHolderSessionId = null;
  }

  return {
    executeOpen: (input, ctx) => guardStage(executeOpen(input, ctx)),
    executeRead: (input, ctx) => guardStage(executeRead(input, ctx)),
    executeWrite: (input, ctx) => guardStage(executeWrite(input, ctx)),
    executeSave: (input, ctx) => guardStage(executeSave(input, ctx)),
    async releaseSessions(sessionId) {
      const released = await store.releaseSessionsOf(sessionId);
      if (released.length > 0) {
        deps.diagnostics?.warn('document', '会话释放：文档记录已移除', { count: released.length });
      }
    },
    activeRecordCount() {
      return store.recordCount();
    },
  };

  /** 顶层异常归一：端口与内部错误映射为 `ChipsError` 同构错误后交 Bridge 透传。 */
  async function guardStage<T>(run: Promise<T>): Promise<T> {
    try {
      return await run;
    } catch (error: unknown) {
      const normalized = asDocumentCapabilityError(error);
      if (normalized.code === DOCUMENT_CHANNEL_ERROR_CODES.internal) {
        deps.diagnostics?.error('document', '文档能力内部错误', { error: String(error instanceof Error ? error.message : error) });
      }
      throw normalized;
    }
  }
}

/** 诊断引用（避免跨文件重复导入解析诊断类型）。 */
type IDocumentDiagnosticRef = import('./contract.js').IDocumentDiagnostic;
/** 指纹引用（同上）。 */
type ISourceFingerprintRef = import('./digest.js').ISourceFingerprint;
