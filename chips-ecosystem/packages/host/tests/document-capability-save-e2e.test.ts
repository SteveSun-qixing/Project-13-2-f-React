/**
 * `document:*` 能力族端到端（工单036 波 C3 终闸）：正式 scope / storage 适配器 +
 * 真实目录态包根，`document:open → write → save` 全链经真实服务路由。
 *
 * 权威：`04-能力契约规范` §7.3（`document:write` 回执 `{ revision }`「从 1 开始、每次
 * 成功写入前进 1」；`document:save` 回执 `{ source, digest }`）、`11-文档服务设计`
 * §4.5（保存流程：序列化 → 受控提交 → 摘要复算 → 事件时序）、`05-事件契约规范` §4.2。
 *
 * @remarks
 * - 端口装配：scope / storage 两臂为**生产适配器真件**（共享 {@link DocumentScopeLedger}，
 *   与组合根装载段同构），原生面为忠实替身（真盘目录态承载，同
 *   `document-storage-adapter.test.ts` 夹具形制）；解析/事件/守卫为服务测试替身
 *   （解析算法权威在 chips-parser，字节级语义归真机链路）。
 * - 终闸判据：写路径唯一经「文档服务 → 序列化 → storage.commit（changeset 链）」；
 *   `document:write` 回执 revision 严格递增；保存回执 digest 与真盘成员摘要复算一致；
 *   `document:changed`/`document:saved` 按 §4.2 时序发布。
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterAll, describe, expect, it } from 'vitest';

import type { IDocumentCapabilityContext } from '../src/capabilities/document/contract.js';
import { DOCUMENT_EVENT_IDS } from '../src/capabilities/document/contract.js';
import { createDocumentScopeAdapter } from '../src/capabilities/document/adapters/scope-adapter.js';
import { createDocumentStorageAdapter } from '../src/capabilities/document/adapters/storage-adapter.js';
import { DocumentScopeLedger } from '../src/capabilities/document/adapters/scope-ledger.js';
import type { INativeResourceModule } from '../src/capabilities/document/adapters/native-resource-module.js';
import { createDocumentService } from '../src/capabilities/document/service.js';
import type { IDocumentServiceDependencies } from '../src/capabilities/document/ports.js';
import { computePackageContentDigest } from '../src/capabilities/document/digest.js';
import type { ISourceFingerprint } from '../src/capabilities/document/digest.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';

/* ------------------------------------------------------------------ *
 * 忠实原生替身（真盘目录态承载；与 storage-adapter 锁测同源夹具，最小面）
 * ------------------------------------------------------------------ */

function createFakeNative(): { readonly calls: string[]; readonly module: INativeResourceModule } {
  const calls: string[] = [];
  let nextSessionId = 8800;
  let nextHandleId = 100;
  const liveSessions = new Set<number>();
  const scopeOwners = new Map<string, number>();
  const origins = new Map<string, string>();
  const handleBytes = new Map<number, Uint8Array>();
  const handleCursors = new Map<number, number>();

  function fail(code: string): Error {
    return Object.assign(new Error(`native ${code}`), { code, retryable: false });
  }

  function resolveUri(uri: string, sessionId: number): { scope: string; origin: string } {
    const withoutScheme = uri.slice('chips-resource://'.length);
    const boundary = withoutScheme.indexOf('/');
    const scope = boundary < 0 ? withoutScheme : withoutScheme.slice(0, boundary);
    if (!liveSessions.has(sessionId) || scopeOwners.get(scope) !== sessionId) {
      throw fail('RESOURCE_PERMISSION_DENIED');
    }
    const origin = origins.get(scope);
    if (origin === undefined) {
      throw fail('RESOURCE_NOT_FOUND');
    }
    return { scope, origin };
  }

  const module = {
    resourceOpenSession(kind: string, owner: string): number {
      void kind;
      void owner;
      const sessionId = nextSessionId++;
      liveSessions.add(sessionId);
      return sessionId;
    },
    resourceCloseSession(sessionId: number): void {
      liveSessions.delete(sessionId);
    },
    resourceGrantSession(): void {},
    resourceMountDirectory(sessionId: number, scope: string, path: string): Promise<string> {
      calls.push(`resourceMountDirectory:${scope}`);
      scopeOwners.set(scope, sessionId);
      origins.set(scope, path);
      return Promise.resolve(scope);
    },
    resourceMountArchive(): Promise<string> {
      return Promise.reject(fail('RESOURCE_NOT_SUPPORTED'));
    },
    resourceUnregisterScope(scope: string, sessionId: number): Promise<void> {
      calls.push(`resourceUnregisterScope:${scope}`);
      void sessionId;
      scopeOwners.delete(scope);
      origins.delete(scope);
      return Promise.resolve();
    },
    resourceLocalPathOf(uri: string, sessionId: number): Promise<string> {
      const { origin } = resolveUri(uri, sessionId);
      return Promise.resolve(origin);
    },
    resourceManagedUriOfPath(path: string, sessionId: number): Promise<string | null> {
      if (!liveSessions.has(sessionId)) {
        return Promise.resolve(null);
      }
      for (const [scope, owner] of scopeOwners) {
        if (owner === sessionId && origins.get(scope) === path) {
          return Promise.resolve(`chips-resource://${scope}/`);
        }
      }
      return Promise.resolve(null);
    },
    resourceListDirectory(
      uri: string,
      sessionId: number,
    ): Promise<{ name: string; isDirectory: boolean; size: number; modifiedUnixSeconds: number }[]> {
      const { origin } = resolveUri(uri, sessionId);
      const relative = uri.slice('chips-resource://'.length).replace(/^[^/]+\//, '');
      const target = relative.length === 0 ? origin : join(origin, relative);
      return Promise.resolve(
        readdirSync(target)
          .filter((name) => !name.startsWith('.'))
          .map((name) => {
            const entryPath = join(target, String(name));
            const directory = statSync(entryPath).isDirectory();
            return {
              name: String(name),
              isDirectory: directory,
              size: directory ? 0 : readFileSync(entryPath).byteLength,
              modifiedUnixSeconds: 0,
            };
          }),
      );
    },
    resourceOpen(uri: string, sessionId: number): Promise<{ handleId: number; metadata: Record<string, unknown> }> {
      const { origin } = resolveUri(uri, sessionId);
      const relative = uri.slice('chips-resource://'.length).replace(/^[^/]+\//, '');
      const target = relative.length === 0 ? origin : join(origin, relative);
      const bytes = new Uint8Array(readFileSync(target));
      const handleId = nextHandleId++;
      handleBytes.set(handleId, bytes);
      handleCursors.set(handleId, 0);
      return Promise.resolve({
        handleId,
        metadata: {
          uri,
          size: bytes.byteLength,
          mimeType: 'application/octet-stream',
          version: 'e2e:1',
          scope: 'document',
        },
      });
    },
    resourceReadChunk(handleId: number, maxBytes: number): Promise<Uint8Array | null> {
      const bytes = handleBytes.get(handleId);
      const cursor = handleCursors.get(handleId);
      if (bytes === undefined || cursor === undefined) {
        return Promise.reject(fail('RESOURCE_NOT_FOUND'));
      }
      const chunk = bytes.subarray(cursor, cursor + maxBytes);
      handleCursors.set(handleId, cursor + chunk.byteLength);
      return Promise.resolve(chunk.byteLength === 0 ? null : chunk);
    },
    resourceRelease(handleId: number): void {
      handleBytes.delete(handleId);
    },
    resourceCommitChangeset(
      sessionId: number,
      scope: string,
      members: readonly { readonly path: string; readonly bytes: Uint8Array }[],
      removals: readonly string[],
    ): Promise<unknown> {
      const { origin } = resolveUri(`chips-resource://${scope}/`, sessionId);
      calls.push(`resourceCommitChangeset:${scope}:${members.length}+${removals.length}`);
      const seen = new Set<string>();
      for (const path of [...members.map((member) => member.path), ...removals]) {
        if (seen.has(path)) {
          return Promise.reject(fail('RESOURCE_ALREADY_EXISTS'));
        }
        seen.add(path);
      }
      for (const path of removals) {
        if (!existsSync(join(origin, path))) {
          return Promise.reject(fail('RESOURCE_NOT_FOUND'));
        }
      }
      for (const path of removals) {
        rmSync(join(origin, path));
      }
      for (const member of members) {
        const target = join(origin, member.path);
        mkdirSync(join(target, '..'), { recursive: true });
        writeFileSync(target, member.bytes);
      }
      return Promise.resolve(members);
    },
    resourceRebuildArchive(): Promise<unknown> {
      return Promise.reject(fail('RESOURCE_NOT_SUPPORTED'));
    },
  } as unknown as INativeResourceModule;
  return { calls, module };
}

/* ------------------------------------------------------------------ *
 * 解析/事件/守卫替身（确定性 JSON 成员面）
 * ------------------------------------------------------------------ */

const ENCODER = new TextEncoder();

const CARD_ID = 'Ab3dEf6Gh8';
const NODE_ONE = 'Cd1eFg2Hi3';
const NODE_TWO = 'Jk4lMn5Op6';

interface IE2EDocument {
  metadata: Record<string, unknown>;
  structure: Record<string, unknown>;
  contents: Map<string, Record<string, unknown>>;
}

function cardDocument(): IE2EDocument {
  return {
    metadata: {
      chip_standards_version: '1.0.0',
      card_id: CARD_ID,
      name: '终闸端到端卡片',
      created_at: '2026-01-02T03:04:05Z',
      modified_at: '2026-01-02T03:04:05Z',
    },
    structure: {
      structure: [
        { id: NODE_ONE, type: 'text', title: '第一块' },
        { id: NODE_TWO, type: 'image', title: '第二块' },
      ],
      manifest: { card_count: 2, resource_count: 0 },
    },
    contents: new Map([
      [NODE_ONE, { text: '第一块内容' }],
      [NODE_TWO, { text: '第二块内容' }],
    ]),
  };
}

function memberFingerprint(doc: IE2EDocument): ISourceFingerprint {
  const entries: [string, unknown][] = [
    ['meta.yaml', doc.metadata],
    ['structure.yaml', doc.structure],
    ...[...doc.contents.entries()].map(([nodeId, value]) => [`content/${nodeId}.yaml`, value] as [string, unknown]),
  ];
  return {
    members: entries.map(([path, value]) => ({
      path,
      size: ENCODER.encode(JSON.stringify(value)).byteLength,
      modifiedAtMs: 1700000000000,
      crc32: null,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * 公共装配：真盘包根 + 生产 scope/storage 适配器 + 替身解析/事件/守卫
 * ------------------------------------------------------------------ */

const tempRoot = realpathSync(mkdtempSync(join(realpathSync(tmpdir()), 'w268-e2e-')));

function makePackage(name: string): string {
  const target = join(tempRoot, name);
  mkdirSync(join(target, 'content'), { recursive: true });
  const doc = cardDocument();
  writeFileSync(join(target, 'meta.yaml'), JSON.stringify(doc.metadata), 'utf8');
  writeFileSync(join(target, 'structure.yaml'), JSON.stringify(doc.structure), 'utf8');
  for (const [nodeId, value] of doc.contents) {
    writeFileSync(join(target, `content/${nodeId}.yaml`), JSON.stringify(value), 'utf8');
  }
  return realpathSync(target);
}

interface IE2EHarness {
  readonly nativeCalls: readonly string[];
  readonly events: { eventId: string; payload: Record<string, unknown> }[];
  readonly service: ReturnType<typeof createDocumentService>;
  readonly localPath: string;
  readonly managedUri: string;
  /** 真盘成员摘要复算（保存回执 digest 的独立对照面）。 */
  diskDigest(): string;
}

async function createE2E(): Promise<IE2EHarness> {
  const fake = createFakeNative();
  const ledger = new DocumentScopeLedger();
  const diagnostics: DiagnosticsSink = {
    warn: () => undefined,
    error: () => undefined,
  };
  const scope = createDocumentScopeAdapter({ native: fake.module, ledger, diagnostics });
  const storage = createDocumentStorageAdapter({ native: fake.module, ledger, diagnostics });

  const localPath = makePackage('e2e.card');
  const resolved = await scope.normalizeSource(localPath, makeContext());
  const managedUri = resolved.managedUri;

  const doc = cardDocument();
  const parser = {
    open(input: { localPath: string; kind: string | null }) {
      expect(input.localPath).toBe(localPath);
      expect(input.kind === null || input.kind === 'card').toBe(true);
      return Promise.resolve({
        handle: { documentHandleBrand: 'chips-parser' as const },
        documentId: CARD_ID,
        kind: 'card' as const,
        title: '终闸端到端卡片',
        metadata: JSON.parse(JSON.stringify(doc.metadata)) as Record<string, unknown>,
        fingerprint: memberFingerprint(doc),
        diagnostics: [] as never[],
      });
    },
    readPart(_handle: unknown, request: { part: string; nodeId?: string }) {
      if (request.part === 'structure') {
        return Promise.resolve({
          value: JSON.parse(JSON.stringify(doc.structure)) as Record<string, unknown>,
          diagnostics: [] as never[],
        });
      }
      const value = request.nodeId === undefined ? undefined : doc.contents.get(request.nodeId);
      if (value === undefined) {
        return Promise.reject(
          Object.assign(new Error('native DOCUMENT_STRUCTURE_INVALID'), {
            code: 'DOCUMENT_STRUCTURE_INVALID',
            retryable: false,
          }),
        );
      }
      return Promise.resolve({
        value: JSON.parse(JSON.stringify(value)) as Record<string, unknown>,
        diagnostics: [] as never[],
      });
    },
    fingerprint(): Promise<ISourceFingerprint> {
      return Promise.resolve(memberFingerprint(doc));
    },
    serialize(request: {
      metadata: unknown;
      structure: unknown;
      contents: readonly { nodeId: string; value: unknown }[];
    }) {
      const members = [
        { packagePath: 'meta.yaml', bytes: ENCODER.encode(JSON.stringify(request.metadata)) },
        { packagePath: 'structure.yaml', bytes: ENCODER.encode(JSON.stringify(request.structure)) },
      ];
      for (const item of request.contents) {
        members.push({
          packagePath: `content/${item.nodeId}.yaml`,
          bytes: ENCODER.encode(JSON.stringify(item.value)),
        });
      }
      return Promise.resolve(members.sort((left, right) => left.packagePath.localeCompare(right.packagePath)));
    },
    release(): Promise<void> {
      return Promise.resolve();
    },
  };

  const events: { eventId: string; payload: Record<string, unknown> }[] = [];
  const eventsPort = {
    publish(eventId: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
      events.push({ eventId, payload: { ...payload } });
      return Promise.resolve();
    },
  };
  const guard = {
    isSessionActive(): Promise<boolean> {
      return Promise.resolve(true);
    },
    hasPermission(_sessionId: string, permission: string): Promise<boolean> {
      return Promise.resolve(permission === 'resources:read' || permission === 'resources:write');
    },
  };

  const dependencies: IDocumentServiceDependencies = {
    scope,
    storage,
    parser: parser,
    events: eventsPort,
    guard,
    sessionWindowOf: () => 7,
    diagnostics,
  };
  const service = createDocumentService(dependencies);
  return {
    nativeCalls: fake.calls,
    events,
    service,
    localPath,
    managedUri,
    diskDigest(): string {
      const members: { packagePath: string; bytes: Uint8Array }[] = [];
      const walk = (prefix: string): void => {
        for (const name of readdirSync(join(localPath, prefix))) {
          if (name.startsWith('.')) {
            continue;
          }
          const entryPath = join(localPath, prefix, String(name));
          if (statSync(entryPath).isDirectory()) {
            walk(`${prefix}${String(name)}/`);
          } else {
            members.push({ packagePath: `${prefix}${String(name)}`, bytes: new Uint8Array(readFileSync(entryPath)) });
          }
        }
      };
      walk('');
      return computePackageContentDigest(members.sort((a, b) => a.packagePath.localeCompare(b.packagePath)));
    },
  };
}

function makeContext(): IDocumentCapabilityContext {
  return { signal: new AbortController().signal, sessionId: 'w268-e2e-session', callerId: 'platform' };
}

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe('document:* 能力族端到端（工单036 波 C3 终闸：写路径唯一经 changeset 链）', () => {
  it('open → write(revision 严格递增) → save 真实落盘；回执与真盘摘要复算一致；事件按 §4.2 时序', async () => {
    const harness = await createE2E();
    const ctx = makeContext();

    // ① open：解析 + 作用域注册（挂载即恢复扫描）。
    const opened = await harness.service.executeOpen({ source: harness.localPath }, ctx);
    expect(opened.documentId).toBe(CARD_ID);
    expect(opened.source).toBe(harness.managedUri);
    expect(harness.nativeCalls.some((call) => call.startsWith('resourceMountDirectory:'))).toBe(true);

    // ② write：回执 { revision } 从 1 开始、每次成功写入前进 1（契约 §7.3 递增锁）。
    const first = await harness.service.executeWrite(
      { documentId: CARD_ID, part: 'content', nodeId: NODE_ONE, value: { text: '终闸第一次改写' } },
      ctx,
    );
    const second = await harness.service.executeWrite(
      { documentId: CARD_ID, part: 'metadata', value: { ...cardDocument().metadata, name: '终闸改名' } },
      ctx,
    );
    expect(first.revision).toBe(1);
    expect(second.revision).toBe(2);
    expect(second.revision).toBeGreaterThan(first.revision);
    // 写入只改内存模型：不落盘、不发事件（open 事件之后零新增）。
    expect(harness.events.map((event) => event.eventId)).toEqual([DOCUMENT_EVENT_IDS.opened]);
    expect(readFileSync(join(harness.localPath, 'content/Cd1eFg2Hi3.yaml'), 'utf8')).toBe(
      JSON.stringify({ text: '第一块内容' }),
    );

    // ③ save：序列化 → changeset 提交（真盘落盘）→ 摘要复算 → 事件。
    const saved = await harness.service.executeSave({ documentId: CARD_ID }, ctx);
    expect(saved.source).toBe(harness.managedUri);
    expect(saved.digest).toMatch(/^sha256:/);
    // 回执 digest 与真盘成员摘要复算一致（保存后磁盘是唯一事实源）。
    expect(saved.digest).toBe(harness.diskDigest());
    // 真实落盘：修订成员 + 改名元数据全部可经磁盘回读（非替身盘自证）。
    expect(readFileSync(join(harness.localPath, 'content/Cd1eFg2Hi3.yaml'), 'utf8')).toBe(
      JSON.stringify({ text: '终闸第一次改写' }),
    );
    expect(JSON.parse(readFileSync(join(harness.localPath, 'meta.yaml'), 'utf8'))).toMatchObject({
      name: '终闸改名',
    });
    // 提交唯一落盘通道：changeset 臂一次交锁（成员集 = 依赖成员 + 内容成员）。
    const commitCalls = harness.nativeCalls.filter((call) => call.startsWith('resourceCommitChangeset:'));
    expect(commitCalls).toHaveLength(1);
    // 事件按序：opened → changed（摘要复算面）→ saved（§4.2 时序，保存期零 opened 后插入）。
    expect(harness.events.map((event) => event.eventId)).toEqual([
      DOCUMENT_EVENT_IDS.opened,
      DOCUMENT_EVENT_IDS.changed,
      DOCUMENT_EVENT_IDS.saved,
    ]);
    expect(harness.events[1]?.payload).toMatchObject({
      uri: harness.managedUri,
      documentId: CARD_ID,
      kind: 'card',
      digest: saved.digest,
    });
    expect(Object.keys(harness.events[1]?.payload ?? {}).sort()).toEqual([
      'digest',
      'documentId',
      'kind',
      'size',
      'uri',
    ]);
    expect(harness.events[2]?.payload).toEqual({ uri: harness.managedUri, kind: 'card' });

    // ④ 幂等 no-op save：不提交、不发布事件，仍返回磁盘当前摘要。
    const eventsBefore = harness.events.length;
    const noOp = await harness.service.executeSave({ documentId: CARD_ID }, ctx);
    expect(noOp.digest).toBe(saved.digest);
    expect(harness.events.length).toBe(eventsBefore);
    expect(harness.nativeCalls.filter((call) => call.startsWith('resourceCommitChangeset:'))).toHaveLength(1);
  });

  it('write 无写租约（并发第二会话）→ DOCUMENT_WRITE_CONFLICT；保存只在租约内放行', async () => {
    const harness = await createE2E();
    const first = makeContext();
    const second: IDocumentCapabilityContext = {
      signal: new AbortController().signal,
      sessionId: 'w268-e2e-second',
      callerId: 'platform',
    };
    await harness.service.executeOpen({ source: harness.localPath }, first);
    await harness.service.executeOpen({ source: harness.localPath }, second);
    await harness.service.executeWrite(
      { documentId: CARD_ID, part: 'content', nodeId: NODE_ONE, value: { text: '租约内改写' } },
      first,
    );
    const conflict = await harness.service
      .executeWrite({ documentId: CARD_ID, part: 'content', nodeId: NODE_TWO, value: { text: '越租写入' } }, second)
      .catch((error: unknown) => error);
    expect((conflict as { code?: string }).code).toBe('DOCUMENT_WRITE_CONFLICT');
    await harness.service.executeSave({ documentId: CARD_ID }, first);
    expect(readFileSync(join(harness.localPath, 'content/Cd1eFg2Hi3.yaml'), 'utf8')).toBe(
      JSON.stringify({ text: '租约内改写' }),
    );
  });
});
