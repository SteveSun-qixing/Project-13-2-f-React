/**
 * `IDocumentStoragePort` 正式资源管理器适配器锁测（工单036 波 C3）。
 *
 * 权威：`ports.ts` `IDocumentStoragePort`（形状冻结：三成员 `localPath` 形参语义不变，
 * 适配器内部以点位三反向换算把路径收敛为受管引用后走受管面）、`04-资源管理设计` §4.8
 * （受控提交路径五要素：临时物 + fsync + 提交日志 + 原子替换 + 失败回滚）、
 * `04.11` §11.3（波 C3 补登两名 `resourceCommitChangeset` / `resourceRebuildArchive`
 * 的参数位次与返回形状）、《06.02》§2.4（`RESOURCE_*` 九词封闭错误面）。
 *
 * @remarks
 * - 原生面为**记录型忠实替身**（仅测试使用；工单036 §六「测试注入替身仅限 tests/ 面」）：
 *   目录域以**真实临时目录树**承载（chips-resource 夹具形制——scratch 根 + 成员真落盘），
 *   崩溃残迹按 `journal.rs` 夹具形制预置（`.chips-tmp-<pid>-<seq>` 临时物 + 同目录
 *   `.j` sidecar 意图记录，配对关系由文件名单源承载），挂载恢复扫描按处置三态
 *   忠实建模（journal+临时物同在 → 双删；仅 journal → 撤账；仅临时物 → 保留不删）；
 *   归档域以内存成员集承载（ZIP 字节语义权威在 chips-parser/归档域，真机链路归
 *   `CHIPS_HOST_SMOKE` 产物闸）。
 * - 双适配器共享同一 {@link DocumentScopeLedger} 在册账（生产装配同构：scope 写账、
 *   storage 读账），挂载/提交同键串行由账本队列承载。
 * - 锁定面：错误面逐字（`RESOURCE_*` 契约码原样透传，fail-closed 三段解析）、
 *   两臂路由逐字（目录态 changeset / 归档态整包换代，参数位次与成员映射）、
 *   崩溃恢复路径（挂载即扫三态、幂等收敛）、受管读面（递归列举 / 整包读取 / 句柄释放）。
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
import { createDocumentScopeAdapter } from '../src/capabilities/document/adapters/scope-adapter.js';
import { createDocumentStorageAdapter } from '../src/capabilities/document/adapters/storage-adapter.js';
import { DocumentScopeLedger } from '../src/capabilities/document/adapters/scope-ledger.js';
import type { INativeResourceModule } from '../src/capabilities/document/adapters/native-resource-module.js';
import { deriveDocumentScope } from '../src/capabilities/document/scope-derivation.js';
import { DocumentCapabilityError } from '../src/capabilities/document/errors.js';
import type { IDocumentStoragePort } from '../src/capabilities/document/ports.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';

/* ------------------------------------------------------------------ *
 * 忠实原生替身：目录域真盘 + 归档域内存成员集（语义逐字引自 chips-resource 实读）
 * ------------------------------------------------------------------ */

interface INativeCall {
  readonly name: string;
  readonly args: readonly unknown[];
}

interface IFakeArchivePackage {
  /** 归档「字节」（作用域基址形读取臂的交付面；ZIP 语义权威在解析器/归档域）。 */
  bytes: Uint8Array;
  /** 整包换代后的成员集（`resourceRebuildArchive` 的落位面）。 */
  members: Map<string, Uint8Array>;
}

interface IFakeNativeStorage {
  readonly calls: INativeCall[];
  readonly module: INativeResourceModule;
  /** 故障注入臂（`null` = 走忠实台账）。 */
  managedUriOfPathImpl: ((args: readonly unknown[]) => Promise<string | null>) | null;
  /** changeset / 换代的失败注入码（下一笔提交以此码拒绝；`null` = 忠实台账）。 */
  failNextChangeset: string | null;
  /** 挂载恢复扫描报告（三态处置计数，`JournalRecoveryReport` 同构观察面）。 */
  lastRecovery: { disposed: number; journalsOnly: number; unbackedTemps: number } | null;
  /** 归档成员集台账（用例预置旧成员供删除臂锁测）。 */
  readonly archive: IFakeArchivePackage;
}

function nativeFailure(code: string): Error {
  return Object.assign(new Error(`native ${code}`), { code, retryable: false });
}

/** 非递归条目列举（恢复扫描与列举替身共用）。 */
function readdirOf(path: string): string[] {
  try {
    return readdirSync(path).map((name) => String(name));
  } catch {
    return [];
  }
}

function isDirectoryPath(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 构造忠实原生替身。
 *
 * 目录域语义（逐字引自 `chips-resource` 实读）：
 * - `resourceMountDirectory`：注册 Origin + 挂载即恢复扫描——对包根做单层分拣，
 *   处置三态与 `journal.rs` `recover_root` 判据同源（journal+临时物同在 → 双删；
 *   仅 journal → 撤账；仅临时物 → 保留计数）；
 * - `resourceListDirectory`：真实 FS 列举，`.` 前缀条目在册过滤（平台保留临时物
 *   不进列举面，journal.rs:84 在册口径）；
 * - `resourceOpen`/`resourceReadChunk`/`resourceRelease`：真实文件字节分块读取；
 * - `resourceCommitChangeset`：请求歧义闸（同路径二次出现 `RESOURCE_ALREADY_EXISTS`，
 *   取锁前拒绝）→ 删除目标存在性闸（缺失 `RESOURCE_NOT_FOUND`）→ 校验全过后一次性
 *   落盘（真实写入 + 删除）。
 */
function createFakeNativeStorage(): IFakeNativeStorage {
  const calls: INativeCall[] = [];
  let nextSessionId = 7100;
  const liveSessions = new Set<number>();
  const scopeOwners = new Map<string, number>();
  const origins = new Map<string, string>();
  const archive: IFakeArchivePackage = { bytes: new Uint8Array(), members: new Map() };
  const openHandles = new Map<number, { bytes: Uint8Array; cursor: number }>();
  let openCounter = 0;
  const state: IFakeNativeStorage = {
    calls,
    managedUriOfPathImpl: null,
    failNextChangeset: null,
    lastRecovery: null,
    archive,
    module: {
      resourceOpenSession(kind: string, owner: string): number {
        calls.push({ name: 'resourceOpenSession', args: [kind, owner] });
        const sessionId = nextSessionId++;
        liveSessions.add(sessionId);
        return sessionId;
      },
      resourceCloseSession(sessionId: number): void {
        calls.push({ name: 'resourceCloseSession', args: [sessionId] });
        liveSessions.delete(sessionId);
      },
      resourceGrantSession(sessionId: number, permissions: readonly string[]): void {
        calls.push({ name: 'resourceGrantSession', args: [sessionId, permissions] });
        if (!liveSessions.has(sessionId)) {
          throw nativeFailure('RESOURCE_NOT_FOUND');
        }
      },
      resourceMountDirectory(
        sessionId: number,
        scope: string,
        path: string,
        owner: string,
        writable: boolean,
      ): Promise<string> {
        calls.push({ name: 'resourceMountDirectory', args: [sessionId, scope, path, owner, writable] });
        scopeOwners.set(scope, sessionId);
        origins.set(scope, path);
        // 挂载即恢复扫描（journal 夹具形制的三态处置，单层分拣）。
        const report = { disposed: 0, journalsOnly: 0, unbackedTemps: 0 };
        for (const name of readdirOf(path)) {
          if (!name.startsWith('.chips-tmp-') || !name.endsWith('.j')) {
            continue;
          }
          const token = name.slice('.chips-tmp-'.length, -'.j'.length);
          const journalPath = join(path, name);
          const tempPath = join(path, `.chips-tmp-${token}`);
          rmSync(journalPath);
          if (existsSync(tempPath)) {
            rmSync(tempPath);
            report.disposed += 1;
          } else {
            report.journalsOnly += 1;
          }
        }
        for (const name of readdirOf(path)) {
          if (name.startsWith('.chips-tmp-')) {
            report.unbackedTemps += 1;
          }
        }
        state.lastRecovery = report;
        return Promise.resolve(scope);
      },
      resourceMountArchive(sessionId: number, scope: string, path: string, owner: string): Promise<string> {
        calls.push({ name: 'resourceMountArchive', args: [sessionId, scope, path, owner] });
        scopeOwners.set(scope, sessionId);
        origins.set(scope, path);
        // 归档「整包字节」自真实夹具文件预载（作用域基址形读取臂的交付面）。
        archive.bytes = new Uint8Array(readFileSync(path));
        return Promise.resolve(scope);
      },
      async resourceUnregisterScope(scope: string, sessionId: number): Promise<void> {
        calls.push({ name: 'resourceUnregisterScope', args: [scope, sessionId] });
        if (!scopeOwners.has(scope)) {
          return Promise.reject(nativeFailure('RESOURCE_NOT_FOUND'));
        }
        if (!liveSessions.has(sessionId) || scopeOwners.get(scope) !== sessionId) {
          return Promise.reject(nativeFailure('RESOURCE_PERMISSION_DENIED'));
        }
        scopeOwners.delete(scope);
        origins.delete(scope);
        return Promise.resolve();
      },
      async resourceLocalPathOf(uri: string, sessionId: number): Promise<string> {
        calls.push({ name: 'resourceLocalPathOf', args: [uri, sessionId] });
        const scope = uri.slice('chips-resource://'.length).replace(/\/.*$/, '');
        if (!uri.startsWith('chips-resource://') || !uri.endsWith('/')) {
          return Promise.reject(nativeFailure('RESOURCE_INVALID_URI'));
        }
        if (!liveSessions.has(sessionId) || scopeOwners.get(scope) !== sessionId) {
          return Promise.reject(nativeFailure('RESOURCE_PERMISSION_DENIED'));
        }
        const origin = origins.get(scope);
        if (origin === undefined) {
          return Promise.reject(nativeFailure('RESOURCE_NOT_FOUND'));
        }
        return origin;
      },
      async resourceManagedUriOfPath(path: string, sessionId: number): Promise<string | null> {
        calls.push({ name: 'resourceManagedUriOfPath', args: [path, sessionId] });
        if (state.managedUriOfPathImpl !== null) {
          return state.managedUriOfPathImpl([path, sessionId]);
        }
        if (!liveSessions.has(sessionId)) {
          return null;
        }
        let best: { scope: string; depth: number } | null = null;
        for (const [scope, owner] of scopeOwners) {
          if (owner !== sessionId) {
            continue;
          }
          const origin = origins.get(scope);
          if (origin === undefined || path !== origin) {
            continue;
          }
          const depth = origin.split('/').length;
          if (best === null || depth > best.depth || (depth === best.depth && scope < best.scope)) {
            best = { scope, depth };
          }
        }
        return best === null ? null : `chips-resource://${best.scope}/`;
      },
      async resourceListDirectory(
        uri: string,
        sessionId: number,
      ): Promise<{ name: string; isDirectory: boolean; size: number; modifiedUnixSeconds: number }[]> {
        calls.push({ name: 'resourceListDirectory', args: [uri, sessionId] });
        const withoutScheme = uri.slice('chips-resource://'.length);
        const boundary = withoutScheme.indexOf('/');
        const scope = boundary < 0 ? withoutScheme : withoutScheme.slice(0, boundary);
        const relative = boundary < 0 ? '' : withoutScheme.slice(boundary + 1);
        if (!liveSessions.has(sessionId) || scopeOwners.get(scope) !== sessionId) {
          return Promise.reject(nativeFailure('RESOURCE_PERMISSION_DENIED'));
        }
        const origin = origins.get(scope);
        if (origin === undefined) {
          return Promise.reject(nativeFailure('RESOURCE_NOT_FOUND'));
        }
        const target = relative.length === 0 ? origin : join(origin, relative);
        if (!existsSync(target) || !isDirectoryPath(target)) {
          return Promise.reject(nativeFailure('RESOURCE_NOT_FOUND'));
        }
        // `.` 前缀条目在册过滤（平台保留临时物不进列举面）。
        return readdirOf(target)
          .filter((name) => !name.startsWith('.'))
          .map((name) => {
            const entryPath = join(target, name);
            const directory = isDirectoryPath(entryPath);
            return {
              name,
              isDirectory: directory,
              size: directory ? 0 : readFileSync(entryPath).byteLength,
              modifiedUnixSeconds: 0,
            };
          });
      },
      resourceOpen(uri: string, sessionId: number) {
        calls.push({ name: 'resourceOpen', args: [uri, sessionId] });
        const withoutScheme = uri.slice('chips-resource://'.length);
        const boundary = withoutScheme.indexOf('/');
        const scope = boundary < 0 ? withoutScheme : withoutScheme.slice(0, boundary);
        const relative = boundary < 0 ? '' : withoutScheme.slice(boundary + 1);
        if (!liveSessions.has(sessionId) || scopeOwners.get(scope) !== sessionId) {
          return Promise.reject(nativeFailure('RESOURCE_PERMISSION_DENIED'));
        }
        const origin = origins.get(scope);
        let bytes: Uint8Array;
        if (relative.length === 0) {
          // 作用域基址形：归档态 = 整包字节；目录态基址无整包形（NOT_SUPPORTED）。
          const isArchiveOrigin = origin?.endsWith('.card') === true || origin?.endsWith('.box') === true;
          if (!isArchiveOrigin || origin === undefined) {
            return Promise.reject(nativeFailure('RESOURCE_NOT_SUPPORTED'));
          }
          bytes = archive.bytes;
        } else {
          const target = origin === undefined ? '' : join(origin, relative);
          if (target.length === 0 || !existsSync(target) || isDirectoryPath(target)) {
            return Promise.reject(nativeFailure('RESOURCE_NOT_FOUND'));
          }
          bytes = new Uint8Array(readFileSync(target));
        }
        const handleId = 1000 + (openCounter += 1);
        openHandles.set(handleId, { bytes, cursor: 0 });
        return Promise.resolve({
          handleId,
          metadata: {
            uri,
            size: bytes.byteLength,
            mimeType: 'application/octet-stream',
            version: 'fixture:1',
            scope: 'document',
          },
        });
      },
      resourceReadChunk(handleId: number, maxBytes: number): Promise<Uint8Array | null> {
        calls.push({ name: 'resourceReadChunk', args: [handleId, maxBytes] });
        const opened = openHandles.get(handleId);
        if (opened === undefined) {
          return Promise.reject(nativeFailure('RESOURCE_NOT_FOUND'));
        }
        const chunk = opened.bytes.subarray(opened.cursor, opened.cursor + maxBytes);
        opened.cursor += chunk.byteLength;
        return Promise.resolve(chunk.byteLength === 0 ? null : chunk);
      },
      resourceRelease(handleId: number): void {
        calls.push({ name: 'resourceRelease', args: [handleId] });
        openHandles.delete(handleId);
      },
      resourceCommitChangeset(
        sessionId: number,
        scope: string,
        members: readonly { readonly path: string; readonly bytes: Uint8Array }[],
        removals: readonly string[],
      ): Promise<unknown> {
        calls.push({ name: 'resourceCommitChangeset', args: [sessionId, scope, members, removals] });
        if (state.failNextChangeset !== null) {
          const code = state.failNextChangeset;
          state.failNextChangeset = null;
          return Promise.reject(nativeFailure(code));
        }
        // 请求歧义闸（取锁前拒绝）：同一路径第二次出现即请求歧义。
        const seen = new Set<string>();
        for (const path of [...members.map((member) => member.path), ...removals]) {
          if (seen.has(path)) {
            return Promise.reject(nativeFailure('RESOURCE_ALREADY_EXISTS'));
          }
          seen.add(path);
        }
        const origin = origins.get(scope);
        if (origin === undefined) {
          return Promise.reject(nativeFailure('RESOURCE_NOT_FOUND'));
        }
        // prepare 相：删除目标存在性闸（任一缺失整体弃置、全域旧态）。
        for (const path of removals) {
          if (!existsSync(join(origin, path))) {
            return Promise.reject(nativeFailure('RESOURCE_NOT_FOUND'));
          }
        }
        // publish 相：一次性落盘（成员覆写/新建 + 删除）。
        for (const path of removals) {
          rmSync(join(origin, path));
        }
        for (const member of members) {
          const target = join(origin, member.path);
          mkdirSync(join(target, '..'), { recursive: true });
          writeFileSync(target, member.bytes);
        }
        return Promise.resolve(
          members.map((member) => ({
            uri: `chips-resource://${scope}/${member.path}`,
            size: member.bytes.byteLength,
            mimeType: 'application/octet-stream',
            version: 'fixture:2',
            scope: 'document',
          })),
        );
      },
      resourceRebuildArchive(
        sessionId: number,
        scope: string,
        members: readonly { readonly path: string; readonly bytes: Uint8Array }[],
        removals: readonly string[],
        savedAtUnixMs: number,
      ): Promise<unknown> {
        calls.push({ name: 'resourceRebuildArchive', args: [sessionId, scope, members, removals, savedAtUnixMs] });
        if (state.failNextChangeset !== null) {
          const code = state.failNextChangeset;
          state.failNextChangeset = null;
          return Promise.reject(nativeFailure(code));
        }
        const seen = new Set<string>();
        for (const path of [...members.map((member) => member.path), ...removals]) {
          if (seen.has(path)) {
            return Promise.reject(nativeFailure('RESOURCE_ALREADY_EXISTS'));
          }
          seen.add(path);
        }
        for (const path of removals) {
          if (!archive.members.has(path)) {
            return Promise.reject(nativeFailure('RESOURCE_NOT_FOUND'));
          }
        }
        const next = new Map(archive.members);
        for (const path of removals) {
          next.delete(path);
        }
        for (const member of members) {
          next.set(member.path, member.bytes);
        }
        // 整包换代：成员集翻新 + 总字节按换代产物重算（回执 = 解析器写侧实然读数）。
        archive.members = next;
        let totalBytes = 0;
        for (const bytes of next.values()) {
          totalBytes += bytes.byteLength;
        }
        archive.bytes = new Uint8Array(totalBytes);
        return Promise.resolve({
          totalBytes,
          writtenMembers: members.length,
          reusedMembers: next.size - members.length,
          removedMembers: removals.length,
        });
      },
    } as unknown as INativeResourceModule,
  };
  return state;
}

/* ------------------------------------------------------------------ *
 * 公共装配：真盘目录态包根 + 双适配器共享账本
 * ------------------------------------------------------------------ */

const tempRoot = realpathSync(mkdtempSync(join(realpathSync(tmpdir()), 'w268-storage-')));

function makeDirectoryPackage(name: string): string {
  const target = join(tempRoot, name);
  mkdirSync(join(target, 'content'), { recursive: true });
  writeFileSync(join(target, 'meta.yaml'), 'name: 存储夹具\n', 'utf8');
  writeFileSync(join(target, 'structure.yaml'), 'structure: []\n', 'utf8');
  writeFileSync(join(target, 'content/Cd1eFg2Hi3.yaml'), 'card_type: base.text\n', 'utf8');
  return realpathSync(target);
}

function makeArchivePackage(name: string, bytes: string): string {
  const target = join(tempRoot, name);
  writeFileSync(target, bytes, 'utf8');
  return realpathSync(target);
}

interface IHarness {
  readonly fake: IFakeNativeStorage;
  readonly storage: IDocumentStoragePort;
  readonly scope: ReturnType<typeof createDocumentScopeAdapter>;
  readonly diagnostics: { entries: { level: string; message: string; details?: unknown }[] };
  /** 建立挂载（normalizeSource + registerScope），返回解析结果与登记会话。 */
  mount(
    localPath: string,
    form: 'directory' | 'archive',
    kind: 'card' | 'box',
  ): Promise<{
    managedUri: string;
    nativeSession: number;
  }>;
}

function createHarness(): IHarness {
  const fake = createFakeNativeStorage();
  const ledger = new DocumentScopeLedger();
  const diagnostics = { entries: [] as { level: string; message: string; details?: unknown }[] };
  const sink: DiagnosticsSink = {
    warn(_scope, message, details) {
      diagnostics.entries.push({ level: 'warn', message, details });
    },
    error(_scope, message, details) {
      diagnostics.entries.push({ level: 'error', message, details });
    },
  };
  const scope = createDocumentScopeAdapter({ native: fake.module, ledger, diagnostics: sink });
  const storage = createDocumentStorageAdapter({ native: fake.module, ledger, diagnostics: sink });
  return {
    fake,
    storage,
    scope,
    diagnostics,
    mount(localPath, form, kind) {
      return (async (): Promise<{ managedUri: string; nativeSession: number }> => {
        const resolved = await scope.normalizeSource(localPath, makeContext());
        expect(resolved.form).toBe(form);
        const registration = await scope.registerScope({
          documentId: 'DocId000001',
          managedUri: resolved.managedUri,
          kind,
        });
        return { managedUri: resolved.managedUri, nativeSession: registration.nativeSession };
      })();
    },
  };
}

function makeContext(): IDocumentCapabilityContext {
  return { signal: new AbortController().signal, sessionId: 'w268-session', callerId: 'platform' };
}

async function expectCode(run: Promise<unknown>, code: string): Promise<DocumentCapabilityError> {
  try {
    await run;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(DocumentCapabilityError);
    const documentError = error as DocumentCapabilityError;
    expect(documentError.code).toBe(code);
    return documentError;
  }
  throw new Error(`预期以 ${code} 拒绝，实际正常完成`);
}

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

const MEMBER_A = { packagePath: 'meta.yaml', bytes: new TextEncoder().encode('name: 新名\n') };
const MEMBER_B = {
  packagePath: 'content/Jk4lMn5Op6.yaml',
  bytes: new TextEncoder().encode('card_type: base.text\n'),
};

describe('storage-adapter · 目标解析（fail-closed 三段，错误面逐字）', () => {
  it('路径未经适配器挂载：RESOURCE_NOT_FOUND，零原生调用（禁猜测会话/作用域）', async () => {
    const harness = createHarness();
    const foreign = makeDirectoryPackage('foreign.card');
    await expectCode(
      harness.storage.commit({
        localPath: foreign,
        form: 'directory',
        members: [MEMBER_A],
        removals: [],
        signal: new AbortController().signal,
      }),
      'RESOURCE_NOT_FOUND',
    );
    expect(harness.fake.calls).toEqual([]);
  });

  it('仅归一在册、活绑定未建立：RESOURCE_NOT_FOUND（无会话可提交）', async () => {
    const harness = createHarness();
    const localPath = makeDirectoryPackage('unmounted.card');
    const resolved = await harness.scope.normalizeSource(localPath, makeContext());
    expect(resolved.form).toBe('directory');
    // 未 registerScope：账本条目 mounted === null。
    await expectCode(
      harness.storage.commit({
        localPath,
        form: 'directory',
        members: [MEMBER_A],
        removals: [],
        signal: new AbortController().signal,
      }),
      'RESOURCE_NOT_FOUND',
    );
    expect(harness.fake.calls.some((call) => call.name === 'resourceCommitChangeset')).toBe(false);
  });

  it('挂载漂移（反向换算未命中 null）：fail-closed RESOURCE_NOT_FOUND + 宿主诊断留痕，不回退账本供路径', async () => {
    const harness = createHarness();
    const localPath = makeDirectoryPackage('drift.card');
    await harness.mount(localPath, 'directory', 'card');
    harness.fake.managedUriOfPathImpl = () => Promise.resolve(null);
    const error = await expectCode(
      harness.storage.commit({
        localPath,
        form: 'directory',
        members: [MEMBER_A],
        removals: [],
        signal: new AbortController().signal,
      }),
      'RESOURCE_NOT_FOUND',
    );
    expect(error.message).toContain('作用域漂移');
    const driftLogs = harness.diagnostics.entries.filter((entry) => entry.level === 'error');
    expect(driftLogs).toHaveLength(1);
    expect(JSON.stringify(driftLogs[0]?.details)).toContain('换算未命中');
    // 错误消息面零真实文件系统路径。
    expect(error.message).not.toContain(localPath);
  });

  it('挂载漂移（换算命中他作用域基址）：同判漂移，留痕 fail-closed', async () => {
    const harness = createHarness();
    const localPath = makeDirectoryPackage('drift-other.card');
    await harness.mount(localPath, 'directory', 'card');
    harness.fake.managedUriOfPathImpl = () => Promise.resolve('chips-resource://card-other0000000000000000000000/');
    await expectCode(
      harness.storage.commit({
        localPath,
        form: 'directory',
        members: [MEMBER_A],
        removals: [],
        signal: new AbortController().signal,
      }),
      'RESOURCE_NOT_FOUND',
    );
    expect(JSON.stringify(harness.diagnostics.entries[0]?.details)).toContain('换算指向他作用域');
  });
});

describe('storage-adapter · 目录态 changeset 臂（参数位次与成员映射逐字）', () => {
  it('commit → resourceCommitChangeset：sessionId/scope 取自在册账，members/removals 逐字透传，落盘可回读', async () => {
    const harness = createHarness();
    const localPath = makeDirectoryPackage('commit.card');
    const { nativeSession } = await harness.mount(localPath, 'directory', 'card');
    harness.fake.calls.length = 0;
    const scope = deriveDocumentScope(localPath, 'card');
    await harness.storage.commit({
      localPath,
      form: 'directory',
      members: [MEMBER_A, MEMBER_B],
      removals: ['content/Cd1eFg2Hi3.yaml'],
      signal: new AbortController().signal,
    });
    const commitCall = harness.fake.calls.find((call) => call.name === 'resourceCommitChangeset');
    expect(commitCall).toBeDefined();
    const [sessionId, commitScope, members, removals] = commitCall?.args as [
      number,
      string,
      readonly { path: string; bytes: Uint8Array }[],
      readonly string[],
    ];
    expect(sessionId).toBe(nativeSession);
    expect(commitScope).toBe(scope);
    expect(members.map((member) => member.path)).toEqual(['meta.yaml', 'content/Jk4lMn5Op6.yaml']);
    expect([...(members[0]?.bytes ?? new Uint8Array())]).toEqual([...MEMBER_A.bytes]);
    expect(removals).toEqual(['content/Cd1eFg2Hi3.yaml']);
    // 真实落盘（受控提交链 publish 相产物可经磁盘回读）。
    expect(readFileSync(join(localPath, 'meta.yaml'), 'utf8')).toBe('name: 新名\n');
    expect(existsSync(join(localPath, 'content/Cd1eFg2Hi3.yaml'))).toBe(false);
  });

  it('backing 契约码原样透传（四码注入循环，零改写零吞并）', async () => {
    for (const code of [
      'RESOURCE_WRITE_FAILED',
      'RESOURCE_TOO_LARGE',
      'RESOURCE_ALREADY_EXISTS',
      'RESOURCE_READ_ONLY',
    ]) {
      const harness = createHarness();
      const localPath = makeDirectoryPackage(`passthrough-${code}.card`);
      await harness.mount(localPath, 'directory', 'card');
      harness.fake.failNextChangeset = code;
      await expectCode(
        harness.storage.commit({
          localPath,
          form: 'directory',
          members: [MEMBER_A],
          removals: [],
          signal: new AbortController().signal,
        }),
        code,
      );
    }
  });

  it('取消预检：signal 已中止即 DOCUMENT_PARSE_CANCELLED（登记码，可重试），零原生调用', async () => {
    const harness = createHarness();
    const localPath = makeDirectoryPackage('cancelled.card');
    await harness.mount(localPath, 'directory', 'card');
    const controller = new AbortController();
    controller.abort();
    const error = await expectCode(
      harness.storage.commit({
        localPath,
        form: 'directory',
        members: [MEMBER_A],
        removals: [],
        signal: controller.signal,
      }),
      'DOCUMENT_PARSE_CANCELLED',
    );
    expect(error.retryable).toBe(true);
    expect(harness.fake.calls.some((call) => call.name === 'resourceCommitChangeset')).toBe(false);
  });
});

describe('storage-adapter · 归档态整包换代臂', () => {
  it('commit(form=archive) → resourceRebuildArchive：savedAtUnixMs 为整数毫秒，成员/删除集逐字透传', async () => {
    const harness = createHarness();
    const localPath = makeArchivePackage('rebuild.card', 'PKG-BYTES-V1');
    const { nativeSession } = await harness.mount(localPath, 'archive', 'card');
    harness.fake.calls.length = 0;
    const scope = deriveDocumentScope(localPath, 'card');
    // 旧成员预置（整包换代的「不再承接」臂输入）。
    harness.fake.archive.members.set('notes/old.txt', new TextEncoder().encode('old'));
    const before = Date.now();
    await harness.storage.commit({
      localPath,
      form: 'archive',
      members: [MEMBER_A],
      removals: ['notes/old.txt'],
      signal: new AbortController().signal,
    });
    const after = Date.now();
    const rebuildCall = harness.fake.calls.find((call) => call.name === 'resourceRebuildArchive');
    expect(rebuildCall).toBeDefined();
    const [sessionId, rebuildScope, members, removals, savedAtUnixMs] = rebuildCall?.args as [
      number,
      string,
      readonly { path: string; bytes: Uint8Array }[],
      readonly string[],
      number,
    ];
    expect(sessionId).toBe(nativeSession);
    expect(rebuildScope).toBe(scope);
    expect(members.map((member) => member.path)).toEqual(['meta.yaml']);
    expect(removals).toEqual(['notes/old.txt']);
    expect(Number.isInteger(savedAtUnixMs)).toBe(true);
    expect(savedAtUnixMs).toBeGreaterThanOrEqual(before);
    expect(savedAtUnixMs).toBeLessThanOrEqual(after);
    // 目录态臂未被触达（一形态一臂，禁双路写）。
    expect(harness.fake.calls.some((call) => call.name === 'resourceCommitChangeset')).toBe(false);
  });

  it('整包换代失败（WRITE_FAILED 注入）：登记码原样透传', async () => {
    const harness = createHarness();
    const localPath = makeArchivePackage('rebuild-fail.card', 'PKG-BYTES-V1');
    await harness.mount(localPath, 'archive', 'card');
    harness.fake.failNextChangeset = 'RESOURCE_WRITE_FAILED';
    await expectCode(
      harness.storage.commit({
        localPath,
        form: 'archive',
        members: [MEMBER_A],
        removals: [],
        signal: new AbortController().signal,
      }),
      'RESOURCE_WRITE_FAILED',
    );
  });
});

describe('storage-adapter · 受管读面（真盘递归列举与整包读取）', () => {
  it('listMembers 递归列举目录态包根：嵌套成员路径为包根相对形，`.` 前缀临时物不在成员集', async () => {
    const harness = createHarness();
    const localPath = makeDirectoryPackage('list.card');
    // 崩溃残迹预置（chips-resource 夹具形制）：临时物 + 同目录 sidecar 意图记录。
    writeFileSync(join(localPath, '.chips-tmp-424242-1'), 'partial', 'utf8');
    writeFileSync(join(localPath, '.chips-tmp-424242-1.j'), '{"temp":"x","target":"y"}', 'utf8');
    // 无账临时物（三态判据 3：保留不删）。
    writeFileSync(join(localPath, '.chips-tmp-999999-9'), 'orphan', 'utf8');
    await harness.mount(localPath, 'directory', 'card');
    harness.fake.calls.length = 0;
    const members = await harness.storage.listMembers(localPath);
    const paths = members.map((member) => member.packagePath).sort();
    expect(paths).toEqual(['content/Cd1eFg2Hi3.yaml', 'meta.yaml', 'structure.yaml']);
    const meta = members.find((member) => member.packagePath === 'meta.yaml');
    expect(new TextDecoder().decode(meta?.bytes)).toBe('name: 存储夹具\n');
    // 挂载即扫三态处置：配对残迹双删（判据 1）、无账临时物保留（判据 3）。
    expect(existsSync(join(localPath, '.chips-tmp-424242-1'))).toBe(false);
    expect(existsSync(join(localPath, '.chips-tmp-424242-1.j'))).toBe(false);
    expect(existsSync(join(localPath, '.chips-tmp-999999-9'))).toBe(true);
    expect(harness.fake.lastRecovery).toEqual({ disposed: 1, journalsOnly: 0, unbackedTemps: 1 });
    // 列举经受管面（resourceListDirectory + resourceOpen/ReadChunk/Release），零裸路径读。
    expect(harness.fake.calls.some((call) => call.name === 'resourceListDirectory')).toBe(true);
    expect(harness.fake.calls.some((call) => call.name === 'resourceReadChunk')).toBe(true);
    expect(harness.fake.calls.filter((call) => call.name === 'resourceRelease')).toHaveLength(
      harness.fake.calls.filter((call) => call.name === 'resourceOpen').length,
    );
  });

  it('readFileBytes 读取归档态整包字节；形态不符两臂 RESOURCE_NOT_SUPPORTED', async () => {
    const harness = createHarness();
    const payload = 'PKG-BYTES-整包';
    const localPath = makeArchivePackage('whole.card', payload);
    await harness.mount(localPath, 'archive', 'card');
    const bytes = await harness.storage.readFileBytes(localPath);
    expect(new TextDecoder().decode(bytes)).toBe(payload);

    // 形态不符：目录态包根不承载整包读取、归档态不承载成员列举。
    const directory = makeDirectoryPackage('form-mismatch.card');
    await harness.mount(directory, 'directory', 'card');
    await expectCode(harness.storage.readFileBytes(directory), 'RESOURCE_NOT_SUPPORTED');
    await expectCode(harness.storage.listMembers(localPath), 'RESOURCE_NOT_SUPPORTED');
  });
});

describe('storage-adapter · 同键串行（提交不得越过在途注销）', () => {
  it('注销达成后的提交按漂移臂 fail-closed 拒绝（账目已销，不猜会话）', async () => {
    const harness = createHarness();
    const localPath = makeDirectoryPackage('serial.card');
    const { managedUri } = await harness.mount(localPath, 'directory', 'card');
    // 两拍注销经 scope 端口达成（① unregister → ② close，账目销账）。
    await harness.scope.unregisterScope({ documentId: 'DocId000001', managedUri });
    await expectCode(
      harness.storage.commit({
        localPath,
        form: 'directory',
        members: [MEMBER_A],
        removals: [],
        signal: new AbortController().signal,
      }),
      'RESOURCE_NOT_FOUND',
    );
  });
});

describe('storage-adapter · 崩溃恢复路径（chips-resource journal 夹具形制）', () => {
  it('挂载即扫按三态处置崩溃残迹；恢复后提交照常落盘（恢复不阻断写路径）', async () => {
    const harness = createHarness();
    const localPath = makeDirectoryPackage('crash.card');
    // 判据 1：journal 在 + 临时物在（prepare 窗口崩溃）→ 同名临时物删除、journal 撤销。
    writeFileSync(join(localPath, '.chips-tmp-4242-1'), 'partial-a', 'utf8');
    writeFileSync(join(localPath, '.chips-tmp-4242-1.j'), '{"temp":"a","target":"meta.yaml"}', 'utf8');
    // 判据 2：journal 在 + 临时物不在（rename 后终结未及）→ 只撤账、目标保持现态。
    writeFileSync(join(localPath, '.chips-tmp-4242-2.j'), '{"temp":"b","target":"meta.yaml"}', 'utf8');
    await harness.mount(localPath, 'directory', 'card');
    expect(harness.fake.lastRecovery).toEqual({ disposed: 1, journalsOnly: 1, unbackedTemps: 0 });
    expect(existsSync(join(localPath, '.chips-tmp-4242-1'))).toBe(false);
    expect(existsSync(join(localPath, '.chips-tmp-4242-1.j'))).toBe(false);
    expect(existsSync(join(localPath, '.chips-tmp-4242-2.j'))).toBe(false);
    // 恢复收敛后写路径照常：提交成员真实落盘。
    await harness.storage.commit({
      localPath,
      form: 'directory',
      members: [{ packagePath: 'meta.yaml', bytes: new TextEncoder().encode('name: 恢复后新名\n') }],
      removals: [],
      signal: new AbortController().signal,
    });
    expect(readFileSync(join(localPath, 'meta.yaml'), 'utf8')).toBe('name: 恢复后新名\n');
  });

  it('重挂载幂等收敛：首次挂载清残迹后，二次挂载零处置（恢复扫描可重复执行）', async () => {
    const first = createHarness();
    const localPath = makeDirectoryPackage('idempotent.card');
    writeFileSync(join(localPath, '.chips-tmp-4243-1'), 'partial', 'utf8');
    writeFileSync(join(localPath, '.chips-tmp-4243-1.j'), '{}', 'utf8');
    await first.mount(localPath, 'directory', 'card');
    expect(first.fake.lastRecovery).toEqual({ disposed: 1, journalsOnly: 0, unbackedTemps: 0 });
    // 第二套适配器（独立账本）重挂同一根：残迹已清，零处置、零误删。
    const second = createHarness();
    await second.mount(localPath, 'directory', 'card');
    expect(second.fake.lastRecovery).toEqual({ disposed: 0, journalsOnly: 0, unbackedTemps: 0 });
    expect(existsSync(join(localPath, 'meta.yaml'))).toBe(true);
  });
});
