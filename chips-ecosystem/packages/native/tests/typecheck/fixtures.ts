/**
 * chips-native ABI 类型检查夹具。
 *
 * 覆盖：
 * - 全部已实现导出（值与类型）各至少一次正例调用（含 Bridge 能力执行四导出、
 *   文档解析域十三导出、资源管理域十五导出，《核心接口规范》§6.4、§7.3
 *   与工单034 正式化两项）；
 * - 注册/请求与解析选项/结果类型形状
 *   （`INativeCapabilityRegistration` / `INativeBridgeRequest` /
 *   `INativeParseOptions` / `DocumentView` 等）与资源投影 DTO 形状
 *   （`IResourceMetadata` / `IResourceOpenResult` / `IDirectoryEntry` /
 *   `IWriteStreamHandle`）；
 * - `@ts-expect-error` 负例：参数类型、返回类型与必填字段必须被拒绝。
 *
 * 本文件只做类型检查（`tsc --noEmit`），不产生运行时代码。
 */

import type {
  CancelTokenHandle,
  ContextHandle,
  DocumentHandle,
  DocumentView,
  IDirectoryEntry,
  IDocumentContentResult,
  IDocumentEntriesRange,
  IDocumentEntriesResult,
  IDocumentLayoutConfigResult,
  IDocumentMetadataResult,
  IDocumentResourceRange,
  IDocumentRevisionMember,
  IDocumentRevisionResult,
  IDocumentStructureResult,
  IDocumentValidationReport,
  INativeBridgeRequest,
  INativeCapabilityContext,
  INativeCapabilityRegistration,
  INativeDiagnostic,
  INativeParseOptions,
  INativeProviderRegistration,
  INativeSessionRegistration,
  IResourceMetadata,
  IResourceOpenResult,
  IResourceScopeKind,
  IWriteStreamHandle,
} from 'chips-native';
import {
  bridgeActivateProvider,
  bridgeCancelSession,
  bridgeCloseSession,
  bridgeDeactivateProvider,
  bridgeGrantCapabilityId,
  bridgeOpenSession,
  bridgeRegister,
  bridgeRequest,
  bridgeShutdown,
  bridgeUnregister,
  buildDocumentView,
  cancelTokenCancel,
  contextEffect,
  contextEmit,
  contextGet,
  contextInject,
  contextOn,
  contextProvide,
  contextUnsubscribe,
  coreAbiVersion,
  coreVersion,
  createCancelToken,
  documentClose,
  documentContent,
  documentEntries,
  documentLayoutConfig,
  documentMetadata,
  documentReadResource,
  documentRevision,
  documentStructure,
  documentValidate,
  openBox,
  openCard,
  openDocument,
  resourceCloseSession,
  resourceCommitWrite,
  resourceCommitWriteStream,
  resourceCopy,
  resourceCreateDirectory,
  resourceDelete,
  resourceListDirectory,
  resourceOpen,
  resourceOpenSession,
  resourceRead,
  resourceReadChunk,
  resourceRegisterTempScope,
  resourceRelease,
  resourceRename,
  resourceStat,
} from 'chips-native';

declare const handle: ContextHandle;
declare const token: CancelTokenHandle;
declare const documentHandle: DocumentHandle;
declare const request: INativeBridgeRequest;
declare const capabilityContext: INativeCapabilityContext;
declare const registration: INativeCapabilityRegistration;

export const version: string = coreVersion();
export const abiVersion: number = coreAbiVersion();

contextProvide(handle, 'index', { enqueue: () => undefined });
contextInject(handle, ['index'] as const, (ctx: ContextHandle) => {
  contextEffect(ctx, () => undefined);
});

export const service: unknown = contextGet(handle, 'index');

const listener: (payload: unknown) => void = () => undefined;
export const subscription: number = contextOn(handle, 'document:changed', listener, false);
contextUnsubscribe(handle, subscription);
contextEmit(handle, 'document:changed', { uri: 'chips-resource://card-001' });

export const cancelToken: CancelTokenHandle = createCancelToken();
cancelTokenCancel(token);

export const requestFields: [string, string, number, unknown] = [
  request.requestId,
  request.capabilityId,
  request.sessionId,
  request.input,
];
export const requestBin: Record<string, Uint8Array> | undefined = request.bin;
export const capabilitySignal: AbortSignal = capabilityContext.signal;
export const capabilityDeadline: number = capabilityContext.deadline;
export const registrationFields: [string, string, number, string, number] = [
  registration.descriptor.id,
  registration.owner,
  registration.timeoutMs,
  registration.concurrency,
  registration.maxQueue,
];

// Bridge 能力执行四导出：正例调用。
const registrationFixture: INativeCapabilityRegistration = {
  descriptor: { id: 'file:read', schema: { type: 'object' }, permissions: [] },
  owner: 'chips.official.host',
  timeoutMs: 30000,
  concurrency: 'parallel',
  maxQueue: 32,
  handler: (input: unknown, ctx: INativeCapabilityContext): Promise<unknown> =>
    Promise.resolve(ctx.deadline > 0 ? input : undefined),
};
bridgeRegister(registrationFixture);
bridgeUnregister(registrationFixture.descriptor.id);
export const bridgeResponse: Promise<unknown> = bridgeRequest(request);
bridgeCancelSession(request.sessionId);

// 激活与会话扩展六导出：正例调用。
const providerFixture: INativeProviderRegistration = {
  id: 'chips.official.host',
  kind: 'platformService',
  permissions: ['filesystem:read'],
};
bridgeActivateProvider(providerFixture);
bridgeDeactivateProvider(providerFixture.id);
bridgeGrantCapabilityId('file:read', providerFixture.id);
const sessionFixture: INativeSessionRegistration = {
  sessionId: 1,
  pluginId: 'chips.official.editor',
  grantedPermissions: ['filesystem:read'],
};
bridgeOpenSession(sessionFixture);
bridgeCloseSession(sessionFixture.sessionId);
bridgeShutdown();

// 文档解析域十二导出：正例调用（§6.4 backing 句柄方法表序）。
export const openedDocument: Promise<DocumentHandle> = openDocument('/tmp/chips/card-01.card');
const parseOptionsFixture: INativeParseOptions = {
  strict: true,
  verifyHashes: true,
  parallelism: 2,
  limits: { maxYamlBytes: 4096, maxDepth: 8 },
};
export const openedCard: Promise<DocumentHandle> = openCard(
  '/tmp/chips/card-01.card',
  parseOptionsFixture
);
export const openedBox: Promise<DocumentHandle> = openBox('/tmp/chips/box-01.box');
export const metadataResult: Promise<IDocumentMetadataResult> = documentMetadata(documentHandle);
export const structureResult: Promise<IDocumentStructureResult> = documentStructure(documentHandle);
export const contentResult: Promise<IDocumentContentResult> = documentContent(
  documentHandle,
  'a1B2c3D4e5'
);
const entriesRangeFixture: IDocumentEntriesRange = { offset: 0, limit: 20 };
export const entriesAll: Promise<IDocumentEntriesResult> = documentEntries(documentHandle);
export const entriesPage: Promise<IDocumentEntriesResult> = documentEntries(
  documentHandle,
  entriesRangeFixture
);
export const layoutConfigResult: Promise<IDocumentLayoutConfigResult> =
  documentLayoutConfig(documentHandle);
export const revisionResult: Promise<IDocumentRevisionResult> = documentRevision(documentHandle);
const resourceRangeFixture: IDocumentResourceRange = { offset: 4, length: 8 };
export const resourceBytes: Promise<Uint8Array> = documentReadResource(
  documentHandle,
  '.card/metadata.yaml'
);
export const resourceWindow: Promise<Uint8Array> = documentReadResource(
  documentHandle,
  '.card/cover.html',
  resourceRangeFixture
);
export const validationReport: Promise<IDocumentValidationReport> =
  documentValidate(documentHandle);
export const documentView: Promise<DocumentView> = buildDocumentView(documentHandle, 1);
export const closedDocument: Promise<void> = documentClose(documentHandle);

// 结果形状探针：判别字段与只读快照字段必须按声明面可用。
export const metadataDiagnostics: Promise<INativeDiagnostic[]> = metadataResult.then(
  (result) => result.diagnostics
);
export const validationStatus: Promise<'valid' | 'validwithwarnings' | 'invalid'> =
  validationReport.then((report) => report.status);
export const revisionMembers: Promise<IDocumentRevisionMember[]> = revisionResult.then(
  (result) => result.source.members
);
export function viewIdentifier(value: DocumentView): Promise<string> {
  return Promise.resolve(value.kind === 'card' ? value.card_id : value.box_id);
}

// 负例：以下写法必须被类型系统拒绝。
// @ts-expect-error coreAbiVersion 返回 number，不能赋给 string
export const wrongVersion: string = coreAbiVersion();
// @ts-expect-error name 必须是 string
contextProvide(handle, 1, {});
// @ts-expect-error get 必须提供 name
contextGet(handle);
// @ts-expect-error token 必须是 number
contextUnsubscribe(handle, 'token');
// @ts-expect-error once 必须是 boolean
contextOn(handle, 'document:changed', listener, 'yes');
// @ts-expect-error 清理函数不能是数字
contextEffect(handle, 1);
// @ts-expect-error INativeBridgeRequest 缺少必填字段
export const incompleteRequest: INativeBridgeRequest = { requestId: 'r1' };
// @ts-expect-error bridgeRequest 必须提供请求对象
void bridgeRequest();
// @ts-expect-error bridgeUnregister 的参数必须是字符串
bridgeUnregister(1);
// @ts-expect-error bridgeCancelSession 的参数必须是数值会话 ID
bridgeCancelSession('session-1');
// @ts-expect-error handler 缺失的注册对象不可注册
bridgeRegister({ ...registrationFixture, handler: undefined });
// @ts-expect-error provider kind 只能是 'platformService' 或 'servicePlugin'
bridgeActivateProvider({ ...providerFixture, kind: 'unknownKind' });
// @ts-expect-error 提供方登记缺少必填 permissions
bridgeActivateProvider({ id: 'x', kind: 'platformService' });
// @ts-expect-error bridgeDeactivateProvider 的参数必须是字符串
bridgeDeactivateProvider(1);
// @ts-expect-error bridgeGrantCapabilityId 需要 capabilityId 与 owner 两个参数
bridgeGrantCapabilityId('file:read');
// @ts-expect-error bridgeGrantCapabilityId 的 owner 必须是字符串
bridgeGrantCapabilityId('file:read', 2);
// @ts-expect-error 会话登记缺少必填 pluginId
bridgeOpenSession({ sessionId: 1, grantedPermissions: [] });
// @ts-expect-error bridgeCloseSession 的参数必须是数值会话 ID
bridgeCloseSession('session-1');
// @ts-expect-error bridgeShutdown 不接受参数
bridgeShutdown(1);

// 文档解析域负例。
// @ts-expect-error path 必须是字符串
void openCard(1);
// @ts-expect-error 选项字段为 camelCase，snake_case 必须被拒绝
void openDocument('/tmp/chips/card-01.card', { verify_hashes: true });
// @ts-expect-error limits 字段必须是数值
void openBox('/tmp/chips/box-01.box', { limits: { maxDepth: '8' } });
// @ts-expect-error documentMetadata 必须提供句柄
void documentMetadata();
// @ts-expect-error Context 句柄与文档句柄不可混用
void documentMetadata(handle);
// @ts-expect-error documentContent 必须提供 nodeId
void documentContent(documentHandle);
// @ts-expect-error nodeId 必须是字符串
void documentContent(documentHandle, 2);
// @ts-expect-error 分页窗口缺少必填 limit
void documentEntries(documentHandle, { offset: 0 });
// @ts-expect-error documentLayoutConfig 只接受句柄一个参数
void documentLayoutConfig(documentHandle, 1);
// @ts-expect-error documentLayoutConfig 必须提供文档句柄
void documentLayoutConfig();
// @ts-expect-error documentRevision 只接受句柄一个参数
void documentRevision(documentHandle, 1);
// @ts-expect-error documentRevision 必须提供文档句柄
void documentRevision();
// @ts-expect-error 字节窗口字段为 length，不接受 count
void documentReadResource(documentHandle, '.card/metadata.yaml', { offset: 0, count: 4 });
// @ts-expect-error buildDocumentView 的 session 必须是数值
void buildDocumentView(documentHandle, 'session-1');
// @ts-expect-error documentClose 不接受第二个参数
void documentClose(documentHandle, 1);
// 视图联合按 kind 判别：分支字段不可交叉访问。
export const wrongViewField: Promise<string> = documentView.then((value) => {
  if (value.kind === 'card') {
    // @ts-expect-error 卡片分支没有 box_id 字段
    return value.box_id as string;
  }
  // @ts-expect-error 箱子分支没有 card_id 字段
  return value.card_id as string;
});

// 资源管理域十五导出：正例调用（《核心接口规范》§7.3，《04.11》§11.3 表序）。
export const resourceOpened: Promise<IResourceOpenResult> = resourceOpen(
  'chips-resource://workspace/notes/a.txt',
  1
);
export const resourceStatResult: Promise<IResourceMetadata> = resourceStat(1);
export const resourceRangeRead: Promise<Uint8Array> = resourceRead(1, 0, 4096);
export const resourceChunk: Promise<Uint8Array | null> = resourceReadChunk(1, 65536);
resourceRelease(1);
export const resourceCommitted: Promise<IResourceMetadata> = resourceCommitWrite(
  'temp-0',
  'notes/a.txt',
  new Uint8Array([1, 2, 3]),
  1
);
export const resourceStream: Promise<IWriteStreamHandle> = resourceCommitWriteStream(
  'temp-0',
  'notes/b.txt',
  1
);
export const resourceListed: Promise<IDirectoryEntry[]> = resourceListDirectory(
  'chips-resource://workspace/notes',
  1
);
export const resourceDeleted: Promise<void> = resourceDelete(
  'chips-resource://workspace/notes/a.txt',
  false,
  1
);
export const resourceRenamed: Promise<void> = resourceRename(
  'chips-resource://workspace/a.txt',
  'chips-resource://workspace/b.txt',
  1
);
export const resourceCopied: Promise<IResourceMetadata> = resourceCopy(
  'chips-resource://workspace/a.txt',
  'chips-resource://workspace/copy.txt',
  1
);
export const resourceDirectoryCreated: Promise<void> = resourceCreateDirectory(
  'chips-resource://workspace/notes/sub',
  1
);
export const resourceSession: number = resourceOpenSession('plugin', 'chips.official.host');
resourceCloseSession(resourceSession);
export const tempScopeId: string = resourceRegisterTempScope('/tmp/chips-temp-scope', true);

// 资源投影形状探针：DTO 字段与写流方法面必须按声明面可用。
export const resourceMetadataFields: Promise<[string, number, string, string, IResourceScopeKind]> =
  resourceStatResult.then((metadata) => [
    metadata.uri,
    metadata.size,
    metadata.mimeType,
    metadata.version,
    metadata.scope,
  ]);
export const resourceOpenFields: Promise<[number, string]> = resourceOpened.then((opened) => [
  opened.handleId,
  opened.metadata.uri,
]);
export const resourceEntryFields: Promise<[string, boolean, number, number]> = resourceListed.then(
  (entries) => {
    const first: IDirectoryEntry | undefined = entries[0];
    return first === undefined
      ? ['', false, 0, 0]
      : [first.name, first.isDirectory, first.size, first.modifiedUnixSeconds];
  }
);
export const resourceStreamAppend: Promise<void> = resourceStream.then((stream) =>
  stream.append(new Uint8Array([4, 5]))
);
export const resourceStreamCommit: Promise<IResourceMetadata> = resourceStream.then((stream) =>
  stream.commit()
);
export const resourceStreamAbort: Promise<void> = resourceStream.then((stream) => stream.abort());
export const resourceStreamIdentity: Promise<[number, string]> = resourceStream.then((stream) => [
  stream.id,
  stream.uri,
]);

// 资源管理域负例。
// @ts-expect-error handleId 必须是数值
void resourceStat('1');
// @ts-expect-error resourceOpen 必须提供会话 ID
void resourceOpen('chips-resource://workspace/a.txt');
// @ts-expect-error resourceRelease 不接受第二个参数
void resourceRelease(1, 2);
// @ts-expect-error offset 必须是数值
void resourceRead(1, '0', 4096);
// @ts-expect-error bytes 必须是 Uint8Array，不接受字符串
void resourceCommitWrite('temp-0', 'notes/a.txt', 'text', 1);
// @ts-expect-error recursive 必须是布尔值
void resourceDelete('chips-resource://workspace/a.txt', 1, 1);
// @ts-expect-error resourceRename 缺少目标 URI
void resourceRename('chips-resource://workspace/a.txt', 1);
// @ts-expect-error resourceRegisterTempScope 的 writable 必须是布尔值
void resourceRegisterTempScope('/tmp/chips-temp-scope', 'yes');
// @ts-expect-error resourceOpenSession 必须提供 owner
void resourceOpenSession('plugin');
// @ts-expect-error 写流 append 必须提供字节实参
void resourceStream.then((stream) => stream.append());
// @ts-expect-error 写流 commit 不接受参数
void resourceStream.then((stream) => stream.commit(1));
// @ts-expect-error 目录条目字段为 camelCase，snake_case 必须被拒绝
void resourceListed.then((entries) => entries[0]?.is_directory);
// @ts-expect-error 资源元数据没有 mime_type 字段
void resourceStatResult.then((metadata) => metadata.mime_type);
