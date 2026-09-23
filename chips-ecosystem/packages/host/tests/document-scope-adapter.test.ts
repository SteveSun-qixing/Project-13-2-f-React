/**
 * 正式 scope 适配器锁测（工单036 波 A2b-α，任务 #217 第 4 项）。
 *
 * 双面锁定：调用参数逐字（INV-1 真 `resourceOpenSession` 返回值形、`DOCUMENT_SCOPE_OWNER`
 * 注入位、目录态 writable=true / 归档态只读形）与调用次序（两拍 ① unregister → ② close，
 * INV-2/INV-6）；幂等臂窄形（M0 核证在册）与第 6 阶段判定式（NOT_FOUND 已达 /
 * PERMISSION_DENIED 不得静默、禁 close 掩盖）逐臂过测。原生面为记录型替身（仅测试使用），
 * 真机链路归波 A2b-β 与金链路收口。
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterAll, describe, expect, it } from 'vitest';

import type { IDocumentCapabilityContext } from '../src/capabilities/document/contract.js';
import { createDocumentScopeAdapter } from '../src/capabilities/document/adapters/scope-adapter.js';
import type { INativeResourceModule } from '../src/capabilities/document/adapters/native-resource-module.js';
import { DOCUMENT_SCOPE_OWNER, deriveDocumentScope } from '../src/capabilities/document/scope-derivation.js';
import { DocumentCapabilityError } from '../src/capabilities/document/errors.js';

/** 一次原生调用记录（sequence 全局面保持跨方法次序）。 */
interface INativeCall {
  readonly sequence: number;
  readonly name: string;
  readonly args: readonly unknown[];
}

interface IFakeNative {
  readonly calls: INativeCall[];
  readonly module: INativeResourceModule;
  mountDirectoryImpl: ((args: readonly unknown[]) => Promise<string>) | null;
  unregisterImpl: (() => Promise<void>) | null;
}

function createFakeNative(): IFakeNative {
  const calls: INativeCall[] = [];
  let nextSequence = 0;
  let nextSessionId = 4100;
  const record = (name: string, args: readonly unknown[]): void => {
    calls.push({ sequence: nextSequence++, name, args });
  };
  const fake: IFakeNative = {
    calls,
    mountDirectoryImpl: null,
    unregisterImpl: null,
    module: {
      resourceOpenSession(kind: string, owner: string): number {
        record('resourceOpenSession', [kind, owner]);
        return nextSessionId++;
      },
      resourceCloseSession(sessionId: number): void {
        record('resourceCloseSession', [sessionId]);
      },
      resourceMountDirectory(
        sessionId: number,
        scope: string,
        path: string,
        owner: string,
        writable: boolean,
      ): Promise<string> {
        record('resourceMountDirectory', [sessionId, scope, path, owner, writable]);
        if (fake.mountDirectoryImpl !== null) {
          return fake.mountDirectoryImpl([sessionId, scope, path, owner, writable]);
        }
        return Promise.resolve(scope);
      },
      resourceMountArchive(sessionId: number, scope: string, path: string, owner: string): Promise<string> {
        record('resourceMountArchive', [sessionId, scope, path, owner]);
        return Promise.resolve(scope);
      },
      resourceUnregisterScope(scope: string, sessionId: number): Promise<void> {
        record('resourceUnregisterScope', [scope, sessionId]);
        if (fake.unregisterImpl !== null) {
          return fake.unregisterImpl();
        }
        return Promise.resolve();
      },
    } as unknown as INativeResourceModule,
  };
  return fake;
}

function nativeFailure(code: string): Error {
  return Object.assign(new Error(`native ${code}`), { code, retryable: false });
}

function makeContext(): IDocumentCapabilityContext {
  return { signal: new AbortController().signal, sessionId: 'w217-session', callerId: 'platform' };
}

/** 越界即抛的调用取位（`noUncheckedIndexedAccess` 下保持断言逐字可读）。 */
function callAt(fake: IFakeNative, index: number): INativeCall {
  const call = fake.calls[index];
  if (call === undefined) {
    throw new Error(`原生调用记录缺位 #${String(index)}：共 ${String(fake.calls.length)} 条`);
  }
  return call;
}

const tempRoot = mkdtempSync(join(realpathSync(tmpdir()), 'w217-adapter-'));

function makeFixture(name: string, directory: boolean): string {
  const target = join(tempRoot, name);
  if (directory) {
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'manifest.yaml'), 'x: 1\n', 'utf8');
  } else {
    writeFileSync(target, 'archive-bytes\n', 'utf8');
  }
  return realpathSync(target);
}

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

async function expectRejection(run: () => Promise<unknown>): Promise<DocumentCapabilityError> {
  try {
    await run();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(DocumentCapabilityError);
    return error as DocumentCapabilityError;
  }
  throw new Error('expected rejection');
}

describe('scope-adapter · normalizeSource 归一面', () => {
  it('目录态绝对路径 → canonical 本地位 + card- 前缀受管引用（禁裸路径直读）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const target = makeFixture('alpha.card', true);
    const resolved = await adapter.normalizeSource(target, makeContext());
    const scope = deriveDocumentScope(target, 'card');
    expect(resolved).toEqual({
      managedUri: `chips-resource://${scope}/alpha.card`,
      localPath: target,
      form: 'directory',
    });
    expect(fake.calls).toHaveLength(0);
  });

  it('归档态 file:// URL → archive 形态与 box- 前缀', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const target = makeFixture('beta.box', false);
    const resolved = await adapter.normalizeSource(new URL(`file://${target}`).href, makeContext());
    expect(resolved.form).toBe('archive');
    expect(resolved.managedUri.startsWith('chips-resource://box-')).toBe(true);
    expect(resolved.localPath).toBe(target);
  });

  it('受管引用回查在册账：与本地来源归一结果同形；未在册受管引用 RESOURCE_NOT_FOUND', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const target = makeFixture('gamma.card', true);
    const first = await adapter.normalizeSource(target, makeContext());
    const second = await adapter.normalizeSource(first.managedUri, makeContext());
    expect(second).toEqual(first);
    const unknown = await expectRejection(() =>
      adapter.normalizeSource('chips-resource://card-0000000000000000000000000000000000000000/x.card', makeContext()),
    );
    expect(unknown.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('拒收臂逐项点名：相对路径 INVALID_URI / 远端 UNSUPPORTED_SCHEME / 非包名 NOT_SUPPORTED / 缺失 NOT_FOUND', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    expect((await expectRejection(() => adapter.normalizeSource('relative/x.card', makeContext()))).code).toBe(
      'RESOURCE_INVALID_URI',
    );
    expect(
      (await expectRejection(() => adapter.normalizeSource('https://eco.example/a.card', makeContext()))).code,
    ).toBe('RESOURCE_UNSUPPORTED_SCHEME');
    const plain = join(tempRoot, 'plain.txt');
    mkdirSync(plain, { recursive: true });
    expect((await expectRejection(() => adapter.normalizeSource(realpathSync(plain), makeContext()))).code).toBe(
      'RESOURCE_NOT_SUPPORTED',
    );
    expect(
      (await expectRejection(() => adapter.normalizeSource(join(tempRoot, 'gone.card'), makeContext()))).code,
    ).toBe('RESOURCE_NOT_FOUND');
    expect((await expectRejection(() => adapter.normalizeSource('', makeContext()))).code).toBe('RESOURCE_INVALID_URI');
  });
});

describe('scope-adapter · registerScope 挂载臂（INV-1/参数逐字）', () => {
  it('目录态：真 openSession 返回值为会话源，mountDirectory 携 OWNER 与 writable=true', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const target = makeFixture('mount-dir.card', true);
    const scope = deriveDocumentScope(target, 'card');
    const managedUri = `chips-resource://${scope}/mount-dir.card`;
    await adapter.normalizeSource(target, makeContext());
    await adapter.registerScope({ documentId: 'doc-1', managedUri, kind: 'card' });
    expect(fake.calls.map((call) => call.name)).toEqual(['resourceOpenSession', 'resourceMountDirectory']);
    expect(callAt(fake, 0).args).toEqual(['document', DOCUMENT_SCOPE_OWNER]);
    expect(callAt(fake, 1).args).toEqual([4100, scope, target, DOCUMENT_SCOPE_OWNER, true]);
  });

  it('归档态：mountArchive 只读形（无 writable 参数位）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const target = makeFixture('mount-arch.box', false);
    const scope = deriveDocumentScope(target, 'box');
    await adapter.normalizeSource(target, makeContext());
    await adapter.registerScope({
      documentId: 'doc-2',
      managedUri: `chips-resource://${scope}/mount-arch.box`,
      kind: 'box',
    });
    expect(fake.calls.map((call) => call.name)).toEqual(['resourceOpenSession', 'resourceMountArchive']);
    expect(callAt(fake, 1).args).toEqual([4100, scope, target, DOCUMENT_SCOPE_OWNER]);
  });

  it('无归一前置的注册拒绝 RESOURCE_INVALID_URI（禁跳册直挂）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const error = await expectRejection(() =>
      adapter.registerScope({
        documentId: 'doc-x',
        managedUri: 'chips-resource://card-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/x.card',
        kind: 'card',
      }),
    );
    expect(error.code).toBe('RESOURCE_INVALID_URI');
    expect(fake.calls).toHaveLength(0);
  });

  it('幂等复用（窄形）：同 managedUri 重复注册零新调用；documentId/kind 不符转真冲突', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const target = makeFixture('idem.card', true);
    const scope = deriveDocumentScope(target, 'card');
    const managedUri = `chips-resource://${scope}/idem.card`;
    await adapter.normalizeSource(target, makeContext());
    await adapter.registerScope({ documentId: 'doc-3', managedUri, kind: 'card' });
    await adapter.registerScope({ documentId: 'doc-3', managedUri, kind: 'card' });
    expect(fake.calls.filter((call) => call.name === 'resourceOpenSession')).toHaveLength(1);
    const conflict = await expectRejection(() =>
      adapter.registerScope({ documentId: 'other', managedUri, kind: 'card' }),
    );
    expect(conflict.code).toBe('RESOURCE_ALREADY_EXISTS');
  });

  it('外部在册冲突（窄形 M0）：ALREADY_EXISTS → 关会话收口，绝不调用 unregister 抢占（INV-5）', async () => {
    const fake = createFakeNative();
    fake.mountDirectoryImpl = () => Promise.reject(nativeFailure('RESOURCE_ALREADY_EXISTS'));
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const target = makeFixture('stale.card', true);
    const scope = deriveDocumentScope(target, 'card');
    await adapter.normalizeSource(target, makeContext());
    const error = await expectRejection(() =>
      adapter.registerScope({ documentId: 'doc-4', managedUri: `chips-resource://${scope}/stale.card`, kind: 'card' }),
    );
    expect(error.code).toBe('RESOURCE_ALREADY_EXISTS');
    expect(fake.calls.map((call) => call.name)).toEqual([
      'resourceOpenSession',
      'resourceMountDirectory',
      'resourceCloseSession',
    ]);
    expect(fake.calls.filter((call) => call.name === 'resourceUnregisterScope')).toHaveLength(0);
    // 失败收口后账目清除：再注册走完整挂载流程（可恢复）。
    fake.mountDirectoryImpl = null;
    await adapter.normalizeSource(target, makeContext());
    await adapter.registerScope({
      documentId: 'doc-4',
      managedUri: `chips-resource://${scope}/stale.card`,
      kind: 'card',
    });
    expect(fake.calls.filter((call) => call.name === 'resourceMountDirectory')).toHaveLength(2);
  });

  it('挂载回显 scope 与派生值不符 = 构造性漂移：fail-closed RESOURCE_INTERNAL 并关会话', async () => {
    const fake = createFakeNative();
    fake.mountDirectoryImpl = () => Promise.resolve('card-ffffffffffffffffffffffffffffffffffffffff');
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const target = makeFixture('drift.card', true);
    const scope = deriveDocumentScope(target, 'card');
    await adapter.normalizeSource(target, makeContext());
    const error = await expectRejection(() =>
      adapter.registerScope({ documentId: 'doc-5', managedUri: `chips-resource://${scope}/drift.card`, kind: 'card' }),
    );
    expect(error.code).toBe('RESOURCE_INTERNAL');
    expect(callAt(fake, fake.calls.length - 1).name).toBe('resourceCloseSession');
  });

  it('并发双注册串行化：同键两次 register 仅一次挂载，两次均放行', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const target = makeFixture('race.card', true);
    const scope = deriveDocumentScope(target, 'card');
    const managedUri = `chips-resource://${scope}/race.card`;
    await adapter.normalizeSource(target, makeContext());
    await Promise.all([
      adapter.registerScope({ documentId: 'doc-6', managedUri, kind: 'card' }),
      adapter.registerScope({ documentId: 'doc-6', managedUri, kind: 'card' }),
    ]);
    expect(fake.calls.filter((call) => call.name === 'resourceOpenSession')).toHaveLength(1);
    expect(fake.calls.filter((call) => call.name === 'resourceMountDirectory')).toHaveLength(1);
  });
});

describe('scope-adapter · unregisterScope 两拍与第 6 阶段判定式（INV-2/INV-6）', () => {
  async function mounted(
    adapter: ReturnType<typeof createDocumentScopeAdapter>,
    target: string,
    kind: 'card' | 'box',
  ): Promise<string> {
    const scope = deriveDocumentScope(target, kind);
    const managedUri = `chips-resource://${scope}/${basename(target)}`;
    await adapter.normalizeSource(target, makeContext());
    await adapter.registerScope({ documentId: 'doc-live', managedUri, kind });
    return managedUri;
  }

  it('两拍次序：① unregister(scope, session) → ② closeSession(session)，随后销账', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const target = makeFixture('two-beat.card', true);
    const managedUri = await mounted(adapter, target, 'card');
    const scope = managedUri.slice('chips-resource://'.length).split('/')[0];
    fake.calls.length = 0;
    await adapter.unregisterScope({ documentId: 'doc-live', managedUri });
    expect(fake.calls.map((call) => call.name)).toEqual(['resourceUnregisterScope', 'resourceCloseSession']);
    expect(callAt(fake, 0).args).toEqual([scope, 4100]);
    expect(callAt(fake, 1).args).toEqual([4100]);
    // 销账后重复注销 = 未在册已达形：零原生调用（禁第二注销通道）。
    fake.calls.length = 0;
    await adapter.unregisterScope({ documentId: 'doc-live', managedUri });
    expect(fake.calls).toHaveLength(0);
  });

  it('NOT_FOUND 已达臂：作用域已被别处注销仍走拍②收口会话，整体放行', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    const target = makeFixture('notfound.card', true);
    const managedUri = await mounted(adapter, target, 'card');
    fake.unregisterImpl = () => Promise.reject(nativeFailure('RESOURCE_NOT_FOUND'));
    fake.calls.length = 0;
    await adapter.unregisterScope({ documentId: 'doc-live', managedUri });
    expect(fake.calls.map((call) => call.name)).toEqual(['resourceUnregisterScope', 'resourceCloseSession']);
  });

  it('PERMISSION_DENIED 不得静默：审计「疑似孤儿」、禁 closeSession 掩盖、如实抛出且账目保留', async () => {
    const fake = createFakeNative();
    const logs: { level: string; message: string; details?: Readonly<Record<string, unknown>> }[] = [];
    const adapter = createDocumentScopeAdapter({
      native: fake.module,
      diagnostics: {
        warn: () => undefined,
        error: (_scope, message, details) => {
          logs.push({ level: 'error', message, ...(details === undefined ? {} : { details }) });
        },
      },
    });
    const target = makeFixture('orphan.card', true);
    const managedUri = await mounted(adapter, target, 'card');
    fake.unregisterImpl = () => Promise.reject(nativeFailure('RESOURCE_PERMISSION_DENIED'));
    fake.calls.length = 0;
    const error = await expectRejection(() => adapter.unregisterScope({ documentId: 'doc-live', managedUri }));
    expect(error.code).toBe('RESOURCE_PERMISSION_DENIED');
    expect(fake.calls.map((call) => call.name)).toEqual(['resourceUnregisterScope']);
    expect(logs.some((log) => log.message.includes('疑似孤儿'))).toBe(true);
    // 账目保留：再次注销仍走原生（禁静默遗忘），会话仍未关闭。
    fake.calls.length = 0;
    await expectRejection(() => adapter.unregisterScope({ documentId: 'doc-live', managedUri }));
    expect(fake.calls.map((call) => call.name)).toEqual(['resourceUnregisterScope']);
  });

  it('未在册注销 = 已达口径静默收口（零原生调用）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module });
    await adapter.unregisterScope({
      documentId: 'doc-none',
      managedUri: 'chips-resource://card-1111111111111111111111111111111111111111/y.card',
    });
    expect(fake.calls).toHaveLength(0);
  });
});
