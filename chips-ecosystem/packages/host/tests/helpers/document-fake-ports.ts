/**
 * 文档服务测试夹具：`document:*` 端口的内存替身（仅测试使用，不进入产物）。
 *
 * 权威：`11-文档服务设计` §二（端口边界）、§五（提交与摘要口径）、§7.1（指纹基线）、
 * `packages/host/src/capabilities/document/ports.ts`（端口签名）。
 *
 * @remarks
 * - 替身把"磁盘"建成 `成员路径 → 文本` 的集合：`commit` 写入成员并前进指纹代数、`fingerprint` 按成员
 *   元数据重算、`readPart` / `serialize` / `listMembers` 走同一套成员，因此保存后的摘要复算、句柄重建
 *   与"重开读到落盘结果"都是可观察的真实副作用，而不是对返回值的自证。
 * - 失败注入集中在 `failures` / `timing` 两个可变面板上，用于逐项验证错误码归口与并发时序。
 * - 替身不实现任何 `.card` / `.box` 字节解析语义（解析算法权威在 chips-parser，工单015）：成员内容是
 *   JSON 文本，只用于让壳侧的会话、租约、结构校验与摘要逻辑可被确定性断言。
 */

import { expect } from 'vitest';

import { comparePackagePath } from '../../src/capabilities/document/digest.js';
import { DocumentCapabilityError } from '../../src/capabilities/document/errors.js';
import type { IDocumentService } from '../../src/capabilities/document/service.js';
import type { DocumentForm, DocumentKind, IDocumentCapabilityContext, IDocumentDiagnostic } from '../../src/capabilities/document/contract.js';
import type {
  IDocumentCommitRequest,
  IDocumentHandle,
  IDocumentParseOutcome,
  IDocumentPartRequest,
  IDocumentPartOutcome,
  IDocumentScopePort,
  IDocumentSerializeRequest,
  IDocumentSerializedMember,
  IDocumentServiceDependencies,
  IDocumentStoragePort,
  IPackageMemberBytes,
  IResolvedDocumentSource,
} from '../../src/capabilities/document/ports.js';
import type { ISourceFingerprint } from '../../src/capabilities/document/digest.js';
import type { DiagnosticsSink } from '../../src/shared/diagnostics.js';

/** 10 位 Base62 编号夹具（`05-ID生成规范` §一）。 */
export const CARD_ID = 'Ab3dEf6Gh8';
export const BOX_ID = 'Zz9Yy8Xx7W';
export const NODE_ID_ONE = 'Cd1eFg2Hi3';
export const NODE_ID_TWO = 'Jk4lMn5Op6';
export const ENTRY_ID_ONE = 'Qr7sTu8Vw9';
export const ENTRY_ID_TWO = 'Xy0zAb1Cd2';

/** 默认会话标识。 */
export const SESSION_A = 'session-a';
export const SESSION_B = 'session-b';

/** 全量文档权限。 */
export const ALL_DOCUMENT_PERMISSIONS: readonly string[] = ['resources:read', 'resources:write'];

/** 磁盘成员路径（目录态包根内的相对路径）。 */
const META_MEMBER = 'meta.yaml';
const STRUCTURE_MEMBER = 'structure.yaml';
const LAYOUT_MEMBER = 'layout.yaml';

/** 内容成员路径（与服务的删除路径口径一致）。 */
export function contentMemberOf(nodeId: string): string {
  return `content/${nodeId}.yaml`;
}

/** 抛出携带登记码的端口错误（模拟资源管理器 / 解析器真实失败）。 */
export function portFailure(code: string, message = '端口调用失败'): Error {
  return Object.assign(new Error(message), { code });
}

/** 构造能力调用上下文。 */
export function ctxFor(
  sessionId: string,
  options: { readonly signal?: AbortSignal; readonly deadline?: number; readonly callerId?: string } = {}
): IDocumentCapabilityContext {
  return {
    signal: options.signal ?? new AbortController().signal,
    sessionId,
    callerId: options.callerId ?? 'test.plugin',
    ...(options.deadline === undefined ? {} : { deadline: options.deadline }),
  };
}

/** 卡片 metadata 基线（`01-卡片文件格式` §4.1 字段级规则）。 */
export function cardMetadata(name = '测试卡片'): Record<string, unknown> {
  return {
    chip_standards_version: '1.0.0',
    card_id: CARD_ID,
    name,
    created_at: '2026-01-02T03:04:05Z',
    modified_at: '2026-01-02T03:04:05Z',
  };
}

/** 卡片 structure 基线（含 manifest 计数，`01-卡片文件格式` §5.1）。 */
export function cardStructure(): Record<string, unknown> {
  return {
    structure: [
      { id: NODE_ID_ONE, type: 'text', title: '第一块' },
      { id: NODE_ID_TWO, type: 'image', title: '第二块' },
    ],
    manifest: { card_count: 2, resource_count: 0 },
  };
}

/** 箱子 metadata 基线（`02-箱子文件格式` §4.2）。 */
export function boxMetadata(name = '测试箱子'): Record<string, unknown> {
  return {
    chip_standards_version: '1.0.0',
    box_id: BOX_ID,
    name,
    created_at: '2026-01-02T03:04:05Z',
    modified_at: '2026-01-02T03:04:05Z',
    active_layout_type: 'grid',
  };
}

/** 箱子 structure 基线（两条条目，`02-箱子文件格式` §5.3）。 */
export function boxStructure(): Record<string, unknown> {
  return {
    entries: [
      { entry_id: ENTRY_ID_ONE, url: 'chips-resource://default/card/Ab3dEf6Gh8.card', enabled: true },
      { entry_id: ENTRY_ID_TWO, url: 'chips-resource://default/card/Zz9Yy8Xx7W.card', enabled: false },
    ],
  };
}

/** 一条已发布事件。 */
export interface IPublishedEvent {
  readonly eventId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** 一条宿主诊断日志。 */
export interface IHarnessLog {
  readonly level: 'warn' | 'error';
  readonly scope: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** 失败注入面板（置位后端口的对应方法抛出）。 */
export interface IFailurePanel {
  normalizeSource?: Error;
  registerScope?: Error;
  open?: Error;
  fingerprint?: Error;
  serialize?: Error;
  commit?: Error;
  release?: Error;
  publish?: boolean;
}

/** 时序注入面板（毫秒延时，用于并发与释放竞态断言）。 */
export interface ITimingPanel {
  serializeDelayMs: number;
  commitDelayMs: number;
  openDelayMs: number;
}

/** 磁盘视图的一个来源。 */
interface IFakeSource {
  readonly resolved: IResolvedDocumentSource;
  readonly title: string;
  readonly documentId: string;
  readonly kind: DocumentKind;
  readonly diagnostics: readonly IDocumentDiagnostic[];
  readonly disk: Map<string, string>;
  /** 指纹代数：磁盘任何变化都要前进，令基线复查可判定。 */
  version: number;
  readonly partDiagnostics: Map<string, readonly IDocumentDiagnostic[]>;
}

/** 解析器替身产出的句柄。 */
interface IFakeHandle extends IDocumentHandle {
  readonly managedUri: string;
  readonly generation: number;
}

/** 文档服务测试夹具。 */
export interface IDocumentTestHarness {
  readonly dependencies: IDocumentServiceDependencies;
  /** 默认卡片与箱子的受管引用与本地路径。 */
  readonly cardUri: string;
  readonly boxUri: string;
  readonly cardPath: string;
  readonly boxPath: string;
  /** 失败与时序注入。 */
  readonly failures: IFailurePanel;
  readonly timing: ITimingPanel;
  /** 解析器是否按声明格式严格拒绝（真解析器行为）；置 false 检验服务自身的同码兜底守卫。 */
  parserHonoursKindDeclaration: boolean;

  readonly published: readonly IPublishedEvent[];
  readonly logs: readonly IHarnessLog[];
  readonly scopeRegistrations: readonly { documentId: string; managedUri: string; kind: DocumentKind }[];
  readonly openRequests: readonly { localPath: string; kind: DocumentKind | null }[];
  readonly releasedGenerations: readonly number[];
  readonly serializeRequests: readonly IDocumentSerializeRequest[];
  readonly commits: readonly IDocumentCommitRequest[];
  readonly permissionQueries: readonly { sessionId: string; permission: string }[];
  readonly activeQueries: readonly string[];
  readonly readPartCalls: readonly { managedUri: string; part: string; nodeId?: string }[];

  /** 登记一个卡片来源。 */
  addCard(managedUri?: string, form?: DocumentForm): string;
  /** 登记一个箱子来源。 */
  addBox(managedUri?: string, form?: DocumentForm): string;
  /** 为受管引用登记输入别名（同一资源的多种输入形态）。 */
  aliasSource(alias: string, managedUri: string): void;
  /** 指定分片读取的诊断输出（验证诊断透传）。 */
  setPartDiagnostics(managedUri: string, key: string, diagnostics: readonly IDocumentDiagnostic[]): void;
  /** 建立会话并授予权限。 */
  openSession(sessionId: string, permissions?: readonly string[]): void;
  /** 撤销会话（Bridge 会话注销）。 */
  closeSession(sessionId: string): void;
  grant(sessionId: string, permission: string): void;
  revoke(sessionId: string, permission: string): void;
  /** 模拟外部修改：直接改磁盘成员并前进指纹代数。 */
  mutateExternally(managedUri: string, packagePath: string, text: string): void;
  /** 读取磁盘成员文本（落盘结果断言）。 */
  readMember(managedUri: string, packagePath: string): string | undefined;
  /** 磁盘成员清单（升序）。 */
  memberPaths(managedUri: string): readonly string[];
  /** 当前源指纹（摘要与复查断言）。 */
  fingerprintOf(managedUri: string): ISourceFingerprint;
  /** 已发布事件 ID 序列。 */
  eventIds(): readonly string[];
  /** 清空诊断日志。 */
  clearLogs(): void;
}

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/** 受管引用 → 本地可读路径。 */
function localPathOf(managedUri: string): string {
  return `/fake/${managedUri.slice(managedUri.lastIndexOf('/') + 1)}`;
}

/** 卡片磁盘成员基线。 */
function cardDisk(): Map<string, string> {
  return new Map<string, string>([
    [META_MEMBER, JSON.stringify(cardMetadata())],
    [STRUCTURE_MEMBER, JSON.stringify(cardStructure())],
    [contentMemberOf(NODE_ID_ONE), JSON.stringify({ text: '第一块内容' })],
    [contentMemberOf(NODE_ID_TWO), JSON.stringify({ text: '第二块内容' })],
  ]);
}

/** 箱子磁盘成员基线。 */
function boxDisk(): Map<string, string> {
  return new Map<string, string>([
    [META_MEMBER, JSON.stringify(boxMetadata())],
    [STRUCTURE_MEMBER, JSON.stringify(boxStructure())],
    [LAYOUT_MEMBER, JSON.stringify({ active_layout_type: 'grid', columns: 3 })],
  ]);
}

/** 文档服务端口替身夹具。 */
export function createHarness(): IDocumentTestHarness {
  const sources = new Map<string, IFakeSource>();
  const aliases = new Map<string, string>();
  const handles = new Map<string, IFakeHandle>();
  let handleGeneration = 0;

  const published: IPublishedEvent[] = [];
  const logs: IHarnessLog[] = [];
  const scopeRegistrations: { documentId: string; managedUri: string; kind: DocumentKind }[] = [];
  const openRequests: { localPath: string; kind: DocumentKind | null }[] = [];
  const releasedGenerations: number[] = [];
  const serializeRequests: IDocumentSerializeRequest[] = [];
  const commits: IDocumentCommitRequest[] = [];
  const permissionQueries: { sessionId: string; permission: string }[] = [];
  const activeQueries: string[] = [];
  const readPartCalls: { managedUri: string; part: string; nodeId?: string }[] = [];
  const sessions = new Map<string, { active: boolean; permissions: Set<string> }>();

  const failures: IFailurePanel = {};
  const timing: ITimingPanel = { serializeDelayMs: 0, commitDelayMs: 0, openDelayMs: 0 };

  function registerSource(
    managedUri: string,
    kind: DocumentKind,
    documentId: string,
    title: string,
    form: DocumentForm,
    disk: Map<string, string>
  ): string {
    sources.set(managedUri, {
      resolved: { managedUri, localPath: localPathOf(managedUri), form },
      title,
      documentId,
      kind,
      diagnostics: [{ severity: 'warning', code: 'PARSE_WARNING', message: '基线解析告警' }],
      disk,
      version: 1,
      partDiagnostics: new Map<string, readonly IDocumentDiagnostic[]>(),
    });
    return managedUri;
  }

  function requireSourceByPath(localPath: string): IFakeSource {
    for (const source of sources.values()) {
      if (source.resolved.localPath === localPath) {
        return source;
      }
    }
    throw portFailure('DOCUMENT_NOT_FOUND', '来源不存在');
  }

  function parseMember(source: IFakeSource, packagePath: string): Record<string, unknown> {
    const text = source.disk.get(packagePath);
    if (text === undefined) {
      throw portFailure('DOCUMENT_STRUCTURE_INVALID', `缺少成员 ${packagePath}`);
    }
    return JSON.parse(text) as Record<string, unknown>;
  }

  function fingerprintOfSource(source: IFakeSource): ISourceFingerprint {
    return {
      members: [...source.disk.entries()].map(([path, text]) => ({
        path,
        size: ENCODER.encode(text).byteLength,
        modifiedAtMs: source.version,
        crc32: source.resolved.form === 'archive' ? source.version : null,
      })),
    };
  }

  function delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /** 解析/序列化端口替身。 */
  const parser = {
    async open(input: { localPath: string; kind: DocumentKind | null }): Promise<IDocumentParseOutcome> {
      if (failures.open !== undefined) {
        throw failures.open;
      }
      const source = requireSourceByPath(input.localPath);
      openRequests.push({ localPath: input.localPath, kind: input.kind });
      if (harness.parserHonoursKindDeclaration && input.kind !== null && input.kind !== source.kind) {
        throw portFailure('DOCUMENT_FORMAT_UNKNOWN', '声明格式与内容不符');
      }
      if (timing.openDelayMs > 0) {
        await delay(timing.openDelayMs);
      }
      handleGeneration += 1;
      const handle: IFakeHandle = {
        documentHandleBrand: 'chips-parser',
        managedUri: source.resolved.managedUri,
        generation: handleGeneration,
      };
      handles.set(`${handle.managedUri}#${handle.generation}`, handle);
      return {
        handle,
        documentId: source.documentId,
        kind: source.kind,
        title: source.title,
        metadata: parseMember(source, META_MEMBER),
        fingerprint: fingerprintOfSource(source),
        diagnostics: source.diagnostics,
      };
    },

    async readPart(handle: IDocumentHandle, request: IDocumentPartRequest): Promise<IDocumentPartOutcome> {
      const fake = handle as IFakeHandle;
      const source = sources.get(fake.managedUri);
      if (source === undefined) {
        throw portFailure('DOCUMENT_NOT_FOUND', '句柄已失效');
      }
      readPartCalls.push({
        managedUri: fake.managedUri,
        part: request.part,
        ...(request.nodeId === undefined ? {} : { nodeId: request.nodeId }),
      });
      const diagnosticsFor = (key: string): readonly IDocumentDiagnostic[] => source.partDiagnostics.get(key) ?? [];
      switch (request.part) {
        case 'structure':
          return { value: parseMember(source, STRUCTURE_MEMBER), diagnostics: diagnosticsFor('structure') };
        case 'entries': {
          const structure = parseMember(source, STRUCTURE_MEMBER);
          const entries = Array.isArray(structure.entries) ? structure.entries : [];
          return { value: entries, diagnostics: diagnosticsFor('entries') };
        }
        case 'content': {
          const nodeId = request.nodeId;
          if (nodeId === undefined) {
            return { value: parseMember(source, LAYOUT_MEMBER), diagnostics: diagnosticsFor('layout') };
          }
          const text = source.disk.get(contentMemberOf(nodeId));
          if (text === undefined) {
            throw portFailure('DOCUMENT_STRUCTURE_INVALID', '内容成员不存在');
          }
          return {
            value: JSON.parse(text) as Record<string, unknown>,
            diagnostics: diagnosticsFor(contentMemberOf(nodeId)),
          };
        }
        case 'metadata':
          return { value: parseMember(source, META_MEMBER), diagnostics: diagnosticsFor('metadata') };
      }
    },

    async fingerprint(localPath: string): Promise<ISourceFingerprint> {
      if (failures.fingerprint !== undefined) {
        throw failures.fingerprint;
      }
      return fingerprintOfSource(requireSourceByPath(localPath));
    },

    async serialize(request: IDocumentSerializeRequest): Promise<readonly IDocumentSerializedMember[]> {
      if (failures.serialize !== undefined) {
        throw failures.serialize;
      }
      if (timing.serializeDelayMs > 0) {
        await delay(timing.serializeDelayMs);
      }
      serializeRequests.push(request);
      const members: IDocumentSerializedMember[] = [];
      if (request.changedParts.includes('metadata')) {
        members.push({ packagePath: META_MEMBER, bytes: ENCODER.encode(JSON.stringify(request.metadata)) });
      }
      if (request.changedParts.includes('structure') || request.changedParts.includes('entries')) {
        members.push({ packagePath: STRUCTURE_MEMBER, bytes: ENCODER.encode(JSON.stringify(request.structure)) });
      }
      if (request.kind === 'card') {
        for (const node of request.contents) {
          members.push({
            packagePath: contentMemberOf(node.nodeId),
            bytes: ENCODER.encode(JSON.stringify(node.value)),
          });
        }
      } else if (request.changedParts.includes('content') && request.layoutConfig !== null) {
        members.push({ packagePath: LAYOUT_MEMBER, bytes: ENCODER.encode(JSON.stringify(request.layoutConfig)) });
      }
      return members;
    },

    async release(handle: IDocumentHandle): Promise<void> {
      if (failures.release !== undefined) {
        throw failures.release;
      }
      const fake = handle as IFakeHandle;
      releasedGenerations.push(fake.generation);
      handles.delete(`${fake.managedUri}#${fake.generation}`);
    },
  };

  /** 受控写端口替身：成员落进磁盘视图并前进指纹代数。 */
  const storage: IDocumentStoragePort = {
    async commit(request: IDocumentCommitRequest): Promise<void> {
      if (timing.commitDelayMs > 0) {
        await delay(timing.commitDelayMs);
      }
      if (failures.commit !== undefined) {
        throw failures.commit;
      }
      const source = requireSourceByPath(request.localPath);
      for (const removal of request.removals) {
        source.disk.delete(removal);
      }
      for (const member of request.members) {
        source.disk.set(member.packagePath, DECODER.decode(member.bytes));
      }
      source.version += 1;
      commits.push(request);
    },

    async listMembers(localPath: string): Promise<readonly IPackageMemberBytes[]> {
      const source = requireSourceByPath(localPath);
      return [...source.disk.entries()].map(([packagePath, text]) => ({ packagePath, bytes: ENCODER.encode(text) }));
    },

    async readFileBytes(localPath: string): Promise<Uint8Array> {
      const source = requireSourceByPath(localPath);
      const flattened = [...source.disk.entries()].sort((a, b) => comparePackagePath(a[0], b[0]));
      return ENCODER.encode(flattened.map(([path, text]) => `${path}\u0000${text}`).join('\n'));
    },
  };

  /** 资源作用域端口替身。 */
  const scope: IDocumentScopePort = {
    async normalizeSource(source: string): Promise<IResolvedDocumentSource> {
      if (failures.normalizeSource !== undefined) {
        throw failures.normalizeSource;
      }
      const managedUri = aliases.get(source) ?? source;
      const resolved = sources.get(managedUri)?.resolved;
      if (resolved === undefined) {
        throw portFailure('RESOURCE_NOT_FOUND', '资源不存在');
      }
      return resolved;
    },

    async registerScope(input: { documentId: string; managedUri: string; kind: DocumentKind }): Promise<void> {
      if (failures.registerScope !== undefined) {
        throw failures.registerScope;
      }
      scopeRegistrations.push(input);
    },
  };

  const events = {
    async publish(eventId: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
      if (failures.publish === true) {
        throw new Error('事件总线不可用');
      }
      published.push({ eventId, payload });
    },
  };

  const guard = {
    async isSessionActive(sessionId: string): Promise<boolean> {
      activeQueries.push(sessionId);
      return sessions.get(sessionId)?.active === true;
    },
    async hasPermission(sessionId: string, permission: string): Promise<boolean> {
      permissionQueries.push({ sessionId, permission });
      return sessions.get(sessionId)?.permissions.has(permission) === true;
    },
  };

  const diagnostics: DiagnosticsSink = {
    warn(scopeName, message, details) {
      logs.push({ level: 'warn', scope: scopeName, message, ...(details === undefined ? {} : { details }) });
    },
    error(scopeName, message, details) {
      logs.push({ level: 'error', scope: scopeName, message, ...(details === undefined ? {} : { details }) });
    },
  };

  const cardUri = registerSource(`chips-resource://default/card/${CARD_ID}.card`, 'card', CARD_ID, '测试卡片', 'directory', cardDisk());
  const boxUri = registerSource(`chips-resource://default/box/${BOX_ID}.box`, 'box', BOX_ID, '测试箱子', 'directory', boxDisk());

  const harness: IDocumentTestHarness = {
    dependencies: { scope, parser, storage, events, guard, diagnostics },
    cardUri,
    boxUri,
    cardPath: localPathOf(cardUri),
    boxPath: localPathOf(boxUri),
    failures,
    timing,
    parserHonoursKindDeclaration: true,
    published,
    logs,
    scopeRegistrations,
    openRequests,
    releasedGenerations,
    serializeRequests,
    commits,
    permissionQueries,
    activeQueries,
    readPartCalls,

    addCard(managedUri, form) {
      return registerSource(managedUri ?? `chips-resource://default/card/${CARD_ID}.card`, 'card', CARD_ID, '测试卡片', form ?? 'directory', cardDisk());
    },
    addBox(managedUri, form) {
      return registerSource(managedUri ?? `chips-resource://default/box/${BOX_ID}.box`, 'box', BOX_ID, '测试箱子', form ?? 'directory', boxDisk());
    },
    aliasSource(alias, managedUri) {
      aliases.set(alias, managedUri);
    },
    setPartDiagnostics(managedUri, key, partDiagnostics) {
      sources.get(managedUri)?.partDiagnostics.set(key, partDiagnostics);
    },
    openSession(sessionId, permissions = ALL_DOCUMENT_PERMISSIONS) {
      sessions.set(sessionId, { active: true, permissions: new Set(permissions) });
    },
    closeSession(sessionId) {
      const session = sessions.get(sessionId);
      if (session !== undefined) {
        session.active = false;
      }
    },
    grant(sessionId, permission) {
      sessions.get(sessionId)?.permissions.add(permission);
    },
    revoke(sessionId, permission) {
      sessions.get(sessionId)?.permissions.delete(permission);
    },
    mutateExternally(managedUri, packagePath, text) {
      const source = sources.get(managedUri);
      if (source !== undefined) {
        source.disk.set(packagePath, text);
        source.version += 1;
      }
    },
    readMember(managedUri, packagePath) {
      return sources.get(managedUri)?.disk.get(packagePath);
    },
    memberPaths(managedUri) {
      const source = sources.get(managedUri);
      return source === undefined ? [] : [...source.disk.keys()].sort(comparePackagePath);
    },
    fingerprintOf(managedUri) {
      const source = sources.get(managedUri);
      return source === undefined ? { members: [] } : fingerprintOfSource(source);
    },
    eventIds() {
      return published.map((entry) => entry.eventId);
    },
    clearLogs() {
      logs.length = 0;
    },
  };

  harness.openSession(SESSION_A);
  harness.openSession(SESSION_B);
  return harness;
}

/** 执行并捕获文档能力错误（未抛错即失败）。 */
export async function captureFailure(run: Promise<unknown>): Promise<DocumentCapabilityError> {
  try {
    await run;
  } catch (error) {
    if (!(error instanceof DocumentCapabilityError)) {
      throw new Error(`预期抛出 DocumentCapabilityError，实际为：${String(error)}`);
    }
    return error;
  }
  throw new Error('预期以登记码拒绝，实际正常完成');
}

/** 断言以指定登记码拒绝，返回该错误供追加断言。 */
export async function expectCode(run: Promise<unknown>, code: string): Promise<DocumentCapabilityError> {
  const error = await captureFailure(run);
  expect(error.code).toBe(code);
  return error;
}

/** 服务实例的构造别名（测试内可读性）。 */
export type ServiceFactory = (harness: IDocumentTestHarness, service: IDocumentService) => IDocumentService;
