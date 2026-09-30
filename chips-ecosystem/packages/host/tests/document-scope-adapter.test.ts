/**
 * 正式 scope 适配器锁测（工单036 波 A2b-α，任务 #217 第 4 项）。
 *
 * 双面锁定：调用参数逐字（INV-1 真 `resourceOpenSession` 返回值形、`DOCUMENT_SCOPE_OWNER`
 * 注入位、目录态 writable=true / 归档态只读形）与调用次序（两拍 ① unregister → ② close，
 * INV-2/INV-6）；幂等臂窄形（M0 核证在册）与第 6 阶段判定式（NOT_FOUND 已达 /
 * PERMISSION_DENIED 不得静默、禁 close 掩盖）逐臂过测。原生面为记录型替身（仅测试使用），
 * 真机链路归波 A2b-β 与金链路收口。
 *
 * 波 A2b-β 随波：替身补忠实原生台账语义（在册 scope 重挂 ALREADY_EXISTS、注销归属闸
 * NOT_FOUND/PERMISSION_DENIED 二回形，逐字引自 #213 §2.1 第 6 阶段判定式），新增「会话先死
 * 而 scope 在册」JS 面死锁端到端锁测，把「两拍次序是唯一防线」钉成可执行反证。
 *
 * 点位五 D2 随波（任务 #249，RFC 裁定J §七/§八）：替身补 `resourceGrantSession` 忠实面
 * （会话在册闸 fail-closed + 幂等并入权限集，语义逐字引自 D1 核心形），既有挂载臂调用序
 * 随 grant 拍机械翻正；新增「grant 消费拍与生命周期不变量（T4 宿主半）」锁族——时序逐字
 * （open → grant → mount）、释放臂两拍与未 grant 基线形逐字等、scopes 集/detach 触达面
 * 零变化、注销入口唯一性存在性锁、失败回退（任何码回收会话如实抛出）、无条件 grant（T8
 * 宿主半）、权限字面量单源值锁与文档域零第二落点存在性锁。
 */

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import type { IDocumentCapabilityContext } from '../src/capabilities/document/contract.js';
import { DOCUMENT_PERMISSION_IDS } from '../src/capabilities/document/contract.js';
import { NATIVE_RESOURCE_SURFACE_EXPORTS } from '../src/capabilities/document/adapters/native-resource-module.js';
import { createDocumentScopeAdapter } from '../src/capabilities/document/adapters/scope-adapter.js';
import { DocumentScopeLedger } from '../src/capabilities/document/adapters/scope-ledger.js';
import type { INativeResourceModule } from '../src/capabilities/document/adapters/native-resource-module.js';
import { DOCUMENT_SCOPE_OWNER, deriveDocumentScope } from '../src/capabilities/document/scope-derivation.js';
import { DocumentCapabilityError } from '../src/capabilities/document/errors.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';

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
  /** grant 覆写臂（故障注入；`null` = 走忠实授权台账）。同步抛出形与 D1 绑定导出同相。 */
  grantSessionImpl: ((args: readonly unknown[]) => void) | null;
  /** 点位三正向换算覆写臂（故障注入；`null` = 走忠实台账）。 */
  localPathOfImpl: ((args: readonly unknown[]) => Promise<string>) | null;
  /** 点位三反向换算覆写臂（未命中 `null` 与漂移形注入；`null` = 走忠实台账）。 */
  managedUriOfPathImpl: ((args: readonly unknown[]) => Promise<string | null>) | null;
  /** 直连核心登记面：作用域 → Origin 路径（挂载即登记、注销即摘除）。 */
  readonly origins: Map<string, string>;
  /** 忠实授权台账：会话 → 已授权限集（幂等并入、去重排序；随 closeSession 整体消亡）。 */
  readonly grantedPermissions: Map<number, readonly string[]>;
}

function createFakeNative(): IFakeNative {
  const calls: INativeCall[] = [];
  let nextSequence = 0;
  let nextSessionId = 4100;
  // 忠实原生台账（仅测试面建模，语义逐字引自 /tmp/w213_report.md §2.1 第 6 阶段判定式与
  // §2.1(d)：挂载对在册 scope 报 ALREADY_EXISTS；注销对不在册报 NOT_FOUND、对非活/非归属
  // 会话报 PERMISSION_DENIED——绑定层二回形，OQ-4 双向锁）。默认臂（无 impl 覆盖）按台账行事，
  // 覆盖臂保持纯委托不触台账，供各故障注入测试逐字锁参数与次序。
  const liveSessions = new Set<number>();
  const scopeOwners = new Map<string, number>();
  const origins = new Map<string, string>();
  const grantedPermissions = new Map<number, readonly string[]>();
  const record = (name: string, args: readonly unknown[]): void => {
    calls.push({ sequence: nextSequence++, name, args });
  };
  /** 挂载成功即登记 Origin（核心 `attach_root` 形）；覆写臂只在回显等于 scope 时落账。 */
  const settleMount = (scope: string, path: string, sessionId: number, returned: string): string => {
    if (returned === scope) {
      scopeOwners.set(scope, sessionId);
      origins.set(scope, path);
    }
    return returned;
  };
  /** 忠实正向换算：会话绑定闸 + Origin 单源（§11.3 行 19 口径，基址形 → Origin 根）。 */
  const localPathOf = (uri: string, sessionId: number): Promise<string> => {
    if (!uri.startsWith('chips-resource://')) {
      return Promise.reject(nativeFailure('RESOURCE_INVALID_URI'));
    }
    const rest = uri.slice('chips-resource://'.length);
    const boundary = rest.indexOf('/');
    const scope = boundary < 0 ? rest : rest.slice(0, boundary);
    if (boundary < 0 || rest.slice(boundary + 1).length > 0) {
      // 替身只承载作用域基址形（适配器口径），带产物段的记录键不在换算面内。
      return Promise.reject(nativeFailure('RESOURCE_INVALID_URI'));
    }
    if (!liveSessions.has(sessionId)) {
      return Promise.reject(nativeFailure('RESOURCE_PERMISSION_DENIED'));
    }
    if (!scopeOwners.has(scope)) {
      return Promise.reject(nativeFailure('RESOURCE_PERMISSION_DENIED'));
    }
    if (scopeOwners.get(scope) !== sessionId) {
      return Promise.reject(nativeFailure('RESOURCE_PERMISSION_DENIED'));
    }
    const origin = origins.get(scope);
    if (origin === undefined) {
      return Promise.reject(nativeFailure('RESOURCE_NOT_FOUND'));
    }
    return Promise.resolve(origin);
  };
  /** 忠实反向换算：绑定集内 Origin 等值 / 前缀命中 → 基址形；其余一律 `null`（零泄露）。 */
  const managedUriOfPath = (path: string, sessionId: number): Promise<string | null> => {
    if (!liveSessions.has(sessionId)) {
      return Promise.resolve(null);
    }
    let best: { scope: string; depth: number } | null = null;
    for (const [scope, owner] of scopeOwners) {
      if (owner !== sessionId) {
        continue;
      }
      const origin = origins.get(scope);
      if (origin === undefined || !path.startsWith(origin)) {
        continue;
      }
      const depth = origin.split('/').length;
      if (best === null || depth > best.depth || (depth === best.depth && scope < best.scope)) {
        best = { scope, depth };
      }
    }
    return Promise.resolve(best === null ? null : `chips-resource://${best.scope}/`);
  };
  const fake: IFakeNative = {
    calls,
    mountDirectoryImpl: null,
    unregisterImpl: null,
    grantSessionImpl: null,
    localPathOfImpl: null,
    managedUriOfPathImpl: null,
    origins,
    grantedPermissions,
    module: {
      resourceOpenSession(kind: string, owner: string): number {
        record('resourceOpenSession', [kind, owner]);
        const sessionId = nextSessionId++;
        liveSessions.add(sessionId);
        return sessionId;
      },
      resourceCloseSession(sessionId: number): void {
        record('resourceCloseSession', [sessionId]);
        liveSessions.delete(sessionId);
        // 级联回收（D1 核心形 `close_session` 权限集随会话记录消亡，零残留）。
        grantedPermissions.delete(sessionId);
      },
      resourceGrantSession(sessionId: number, permissions: readonly string[]): void {
        record('resourceGrantSession', [sessionId, permissions]);
        if (fake.grantSessionImpl !== null) {
          fake.grantSessionImpl([sessionId, permissions]);
          return;
        }
        if (!liveSessions.has(sessionId)) {
          // fail-closed：会话不在册即拒（D1 绑定面 `RESOURCE_NOT_FOUND` 臂形）。
          throw nativeFailure('RESOURCE_NOT_FOUND');
        }
        // 忠实授权台账：幂等并入（重复授予同串集不变、裁定J §三.1），排序去重呈账。
        const merged = [...new Set([...(grantedPermissions.get(sessionId) ?? []), ...permissions])].sort();
        grantedPermissions.set(sessionId, merged);
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
          return fake
            .mountDirectoryImpl([sessionId, scope, path, owner, writable])
            .then((returned) => settleMount(scope, path, sessionId, returned));
        }
        if (scopeOwners.has(scope)) {
          return Promise.reject(nativeFailure('RESOURCE_ALREADY_EXISTS'));
        }
        return Promise.resolve(settleMount(scope, path, sessionId, scope));
      },
      resourceMountArchive(sessionId: number, scope: string, path: string, owner: string): Promise<string> {
        record('resourceMountArchive', [sessionId, scope, path, owner]);
        if (scopeOwners.has(scope)) {
          return Promise.reject(nativeFailure('RESOURCE_ALREADY_EXISTS'));
        }
        return Promise.resolve(settleMount(scope, path, sessionId, scope));
      },
      resourceLocalPathOf(uri: string, sessionId: number): Promise<string> {
        record('resourceLocalPathOf', [uri, sessionId]);
        if (fake.localPathOfImpl !== null) {
          return fake.localPathOfImpl([uri, sessionId]);
        }
        return localPathOf(uri, sessionId);
      },
      resourceManagedUriOfPath(path: string, sessionId: number): Promise<string | null> {
        record('resourceManagedUriOfPath', [path, sessionId]);
        if (fake.managedUriOfPathImpl !== null) {
          return fake.managedUriOfPathImpl([path, sessionId]);
        }
        return managedUriOfPath(path, sessionId);
      },
      resourceUnregisterScope(scope: string, sessionId: number): Promise<void> {
        record('resourceUnregisterScope', [scope, sessionId]);
        if (fake.unregisterImpl !== null) {
          return fake.unregisterImpl();
        }
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
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
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
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('beta.box', false);
    const resolved = await adapter.normalizeSource(new URL(`file://${target}`).href, makeContext());
    expect(resolved.form).toBe('archive');
    expect(resolved.managedUri.startsWith('chips-resource://box-')).toBe(true);
    expect(resolved.localPath).toBe(target);
  });

  it('受管引用回查在册账：与本地来源归一结果同形；未在册受管引用 RESOURCE_NOT_FOUND', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
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
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
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
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('mount-dir.card', true);
    const scope = deriveDocumentScope(target, 'card');
    const managedUri = `chips-resource://${scope}/mount-dir.card`;
    await adapter.normalizeSource(target, makeContext());
    await adapter.registerScope({ documentId: 'doc-1', managedUri, kind: 'card' });
    // grant 拍（D2，RFC 裁定J §七）：open 成功紧邻同拍、先于挂载，权限字面量逐字。
    expect(fake.calls.map((call) => call.name)).toEqual([
      'resourceOpenSession',
      'resourceGrantSession',
      'resourceMountDirectory',
    ]);
    expect(callAt(fake, 0).args).toEqual(['document', DOCUMENT_SCOPE_OWNER]);
    expect(callAt(fake, 1).args).toEqual([4100, ['resources:write']]);
    expect(callAt(fake, 2).args).toEqual([4100, scope, target, DOCUMENT_SCOPE_OWNER, true]);
    expect(fake.grantedPermissions.get(4100)).toEqual(['resources:write']);
  });

  it('归档态：mountArchive 只读形（无 writable 参数位）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('mount-arch.box', false);
    const scope = deriveDocumentScope(target, 'box');
    await adapter.normalizeSource(target, makeContext());
    await adapter.registerScope({
      documentId: 'doc-2',
      managedUri: `chips-resource://${scope}/mount-arch.box`,
      kind: 'box',
    });
    expect(fake.calls.map((call) => call.name)).toEqual([
      'resourceOpenSession',
      'resourceGrantSession',
      'resourceMountArchive',
    ]);
    expect(callAt(fake, 1).args).toEqual([4100, ['resources:write']]);
    expect(callAt(fake, 2).args).toEqual([4100, scope, target, DOCUMENT_SCOPE_OWNER]);
  });

  it('无归一前置的注册拒绝 RESOURCE_INVALID_URI（禁跳册直挂）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
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
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('idem.card', true);
    const scope = deriveDocumentScope(target, 'card');
    const managedUri = `chips-resource://${scope}/idem.card`;
    await adapter.normalizeSource(target, makeContext());
    await adapter.registerScope({ documentId: 'doc-3', managedUri, kind: 'card' });
    await adapter.registerScope({ documentId: 'doc-3', managedUri, kind: 'card' });
    // 幂等复用零新调用：grant 拍随 open 同生同灭（复用臂不重开不重授，窄形在册）。
    expect(fake.calls.filter((call) => call.name === 'resourceOpenSession')).toHaveLength(1);
    expect(fake.calls.filter((call) => call.name === 'resourceGrantSession')).toHaveLength(1);
    const conflict = await expectRejection(() =>
      adapter.registerScope({ documentId: 'other', managedUri, kind: 'card' }),
    );
    expect(conflict.code).toBe('RESOURCE_ALREADY_EXISTS');
  });

  it('外部在册冲突（窄形 M0）：ALREADY_EXISTS → 关会话收口，绝不调用 unregister 抢占（INV-5）', async () => {
    const fake = createFakeNative();
    fake.mountDirectoryImpl = () => Promise.reject(nativeFailure('RESOURCE_ALREADY_EXISTS'));
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('stale.card', true);
    const scope = deriveDocumentScope(target, 'card');
    await adapter.normalizeSource(target, makeContext());
    const error = await expectRejection(() =>
      adapter.registerScope({ documentId: 'doc-4', managedUri: `chips-resource://${scope}/stale.card`, kind: 'card' }),
    );
    expect(error.code).toBe('RESOURCE_ALREADY_EXISTS');
    expect(fake.calls.map((call) => call.name)).toEqual([
      'resourceOpenSession',
      'resourceGrantSession',
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
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
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
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
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
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
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
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
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
      ledger: new DocumentScopeLedger(),
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
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    await adapter.unregisterScope({
      documentId: 'doc-none',
      managedUri: 'chips-resource://card-1111111111111111111111111111111111111111/y.card',
    });
    expect(fake.calls).toHaveLength(0);
  });
});

describe('scope-adapter · grant 消费拍与生命周期不变量（工单053 点位五 D2，RFC 裁定J §七/§八 T4 宿主半）', () => {
  /** 归一 + 注册建立活绑定（替身首会话回执恒 4100），返回作用域与记录键。 */
  async function grantMounted(
    adapter: ReturnType<typeof createDocumentScopeAdapter>,
    target: string,
    kind: 'card' | 'box',
  ): Promise<{ readonly managedUri: string; readonly scope: string }> {
    const scope = deriveDocumentScope(target, kind);
    const managedUri = `chips-resource://${scope}/${basename(target)}`;
    await adapter.normalizeSource(target, makeContext());
    await adapter.registerScope({ documentId: 'doc-grant', managedUri, kind });
    return { managedUri, scope };
  }

  it('全链路时序逐字：open → grant（紧邻同拍、先于挂载分叉）→ mount → 拍① → 拍②', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('t4-sequence.card', true);
    const { managedUri, scope } = await grantMounted(adapter, target, 'card');
    fake.calls.length = 0;
    await adapter.unregisterScope({ documentId: 'doc-grant', managedUri });
    // 挂载段完整五拍序（grant 插在 open 与 mount 之间，其余两拍链零位移）：
    // 释放臂自拍①起 [resourceUnregisterScope, resourceCloseSession] 与上文「两拍次序」
    // 用例（未 grant 基线形在册锁，:436 族）逐字等——调用名序、逐位实参、调用计数
    // （unregister 恰 1 / closeSession 恰 1 / 两拍之间零插入）三重等值。
    expect(fake.calls.map((call) => call.name)).toEqual(['resourceUnregisterScope', 'resourceCloseSession']);
    expect(callAt(fake, 0).args).toEqual([scope, 4100]);
    expect(callAt(fake, 1).args).toEqual([4100]);
  });

  it('挂载段基线对照：grant 拍落位后 open/grant/mount 三拍逐字、释放臂零 grant 痕迹', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('t4-full.card', true);
    const scope = deriveDocumentScope(target, 'card');
    const managedUri = `chips-resource://${scope}/t4-full.card`;
    await adapter.normalizeSource(target, makeContext());
    await adapter.registerScope({ documentId: 'doc-grant', managedUri, kind: 'card' });
    expect(fake.calls.map((call) => call.name)).toEqual([
      'resourceOpenSession',
      'resourceGrantSession',
      'resourceMountDirectory',
    ]);
    expect(callAt(fake, 1).args).toEqual([4100, ['resources:write']]);
    await adapter.unregisterScope({ documentId: 'doc-grant', managedUri });
    const names = fake.calls.map((call) => call.name);
    expect(names).toEqual([
      'resourceOpenSession',
      'resourceGrantSession',
      'resourceMountDirectory',
      'resourceUnregisterScope',
      'resourceCloseSession',
    ]);
    // 释放臂（未 grant 基线形在册锁同判据）：零 grant 调用、计数各一。
    const release = names.slice(names.indexOf('resourceUnregisterScope'));
    expect(release).toEqual(['resourceUnregisterScope', 'resourceCloseSession']);
    expect(fake.calls.filter((call) => call.name === 'resourceGrantSession')).toHaveLength(1);
    expect(fake.calls.filter((call) => call.name === 'resourceUnregisterScope')).toHaveLength(1);
    expect(fake.calls.filter((call) => call.name === 'resourceCloseSession')).toHaveLength(1);
  });

  it('grant 零触 scope 登记面：作用域账（origins/scopeOwners）随 grant 重放逐字不变（detach 触达面零变化）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('t4-scopes.card', true);
    const { managedUri } = await grantMounted(adapter, target, 'card');
    const originsBefore = [...fake.origins.entries()];
    fake.calls.length = 0;
    // 直接触原生面重放 grant（幂等静默形，裁定J §三.1）＋二次授予他域不相关串零放行扩面。
    fake.module.resourceGrantSession(4100, ['resources:write']);
    fake.module.resourceGrantSession(4100, []); // 空数组 = 合法 no-op（§2.2 边界臂，宿主消费面核证）
    expect(fake.grantedPermissions.get(4100)).toEqual(['resources:write']);
    expect([...fake.origins.entries()]).toEqual(originsBefore);
    expect(fake.calls.map((call) => call.name)).toEqual(['resourceGrantSession', 'resourceGrantSession']);
    // grant 入参零 scope 位（授权面与挂载面职责分离，§五.3 禁语义混流的宿主侧证据）。
    for (const call of fake.calls) {
      expect(call.args[1]).not.toContain(managedUri.slice('chips-resource://'.length).split('/')[0]);
    }
    // detach/注销触达面在以上全程零变化：无 unregister 调用、作用域账不动。
    expect(fake.calls.filter((call) => call.name === 'resourceUnregisterScope')).toHaveLength(0);
  });

  it('注销入口唯一性存在性锁：镜像清单单一注销名 + 适配器出口面恰五成员且仅 unregisterScope 触注销', async () => {
    // 镜像清单：`Unregister` 形注销名恰一（禁第二注销形，INV-6 消费侧证据）。
    expect(NATIVE_RESOURCE_SURFACE_EXPORTS.filter((name) => name.includes('Unregister'))).toEqual([
      'resourceUnregisterScope',
    ]);
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    // 适配器出口面恰五成员（grant 消费拍不增出口：授权注入收敛于 registerScope 流程内部）。
    expect(Object.keys(adapter).sort()).toEqual([
      'localPathOf',
      'normalizeSource',
      'registerScope',
      'scopeRootOf',
      'unregisterScope',
    ]);
    const target = makeFixture('t4-single-entry.card', true);
    const { managedUri } = await grantMounted(adapter, target, 'card');
    await adapter.normalizeSource(managedUri, makeContext());
    await adapter.localPathOf(managedUri, 4100);
    expect(adapter.scopeRootOf(managedUri)).not.toBeNull();
    // 以上四路触达零注销调用；仅 unregisterScope 一路触注销（注销入口唯一行为证据）。
    expect(fake.calls.filter((call) => call.name === 'resourceUnregisterScope')).toHaveLength(0);
    await adapter.unregisterScope({ documentId: 'doc-grant', managedUri });
    expect(fake.calls.filter((call) => call.name === 'resourceUnregisterScope')).toHaveLength(1);
  });

  it('失败回退（grant 被拒任何码）：回收已开会话 + 如实抛出，零挂载、零吞码、消息零真实路径', async () => {
    for (const deniedCode of ['RESOURCE_PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'RESOURCE_INTERNAL'] as const) {
      const fake = createFakeNative();
      fake.grantSessionImpl = () => {
        throw nativeFailure(deniedCode);
      };
      const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
      const target = makeFixture(`fallback-${deniedCode}.card`, true);
      const scope = deriveDocumentScope(target, 'card');
      const managedUri = `chips-resource://${scope}/fallback-${deniedCode}.card`;
      await adapter.normalizeSource(target, makeContext());
      fake.calls.length = 0;
      const error = await expectRejection(() =>
        adapter.registerScope({ documentId: 'doc-fb', managedUri, kind: 'card' }),
      );
      // 登记码原样透传（禁吞禁降级静默继续，§七失败回退行）。
      expect(error.code).toBe(deniedCode);
      // 回收链逐字：open → grant（被拒）→ closeSession；零挂载、零注销掩盖形。
      expect(fake.calls.map((call) => call.name)).toEqual([
        'resourceOpenSession',
        'resourceGrantSession',
        'resourceCloseSession',
      ]);
      expect(fake.calls.filter((call) => call.name === 'resourceUnregisterScope')).toHaveLength(0);
      expect(fake.calls.filter((call) => call.name === 'resourceMountDirectory')).toHaveLength(0);
      // 跨层消息不回显真实文件系统路径（本文件既有口径）。
      expect(error.message).not.toContain(target);
      expect(JSON.stringify(error.details ?? {})).not.toContain(target);
      // 账目清除：会话随回收消亡（忠实台账级联清权）、再注册走完整挂载流程（可恢复）。
      expect(fake.grantedPermissions.has(4100)).toBe(false);
      fake.grantSessionImpl = null;
      await adapter.normalizeSource(target, makeContext());
      await adapter.registerScope({ documentId: 'doc-fb', managedUri, kind: 'card' });
      expect(fake.grantedPermissions.get(4101)).toEqual(['resources:write']);
    }
  });

  it('无条件 grant（T8 宿主半）：目录态与归档态注入拍逐字等，权限面与挂载 policy 面正交', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const dirTarget = makeFixture('t8-dir.card', true);
    const boxTarget = makeFixture('t8-arch.box', false);
    await grantMounted(adapter, dirTarget, 'card');
    await grantMounted(adapter, boxTarget, 'box');
    const grants = fake.calls.filter((call) => call.name === 'resourceGrantSession');
    expect(grants).toHaveLength(2);
    // 两态注入的权限集逐字等（不做按 writable/归档态的条件 grant 分叉）。
    expect(grants[0]?.args[1]).toEqual(['resources:write']);
    expect(grants[1]?.args[1]).toEqual(grants[0]?.args[1]);
    // 归档态挂载仍是只读 policy 形（无 writable 参数位）——归档只读由挂载面单点强制，
    // 权限注入不为其借道也不改其形（宿主消费侧正交证据）。
    const archive = fake.calls.find((call) => call.name === 'resourceMountArchive');
    expect(archive?.args).toHaveLength(4);
  });
});

describe('scope-adapter · 权限字面量单源与跨语言等值锁（工单053 点位五 D2，RFC 裁定J §七「权限字面量单源」行）', () => {
  /** 文档域 src 递归收集 ts 源文件（相对 `src/capabilities/document` 的 POSIX 风格路径）。 */
  function collectDocumentSources(directory: string, prefix: string): string[] {
    const found: string[] = [];
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, item.name);
      const relative = prefix.length === 0 ? item.name : `${prefix}/${item.name}`;
      if (item.isDirectory()) {
        found.push(...collectDocumentSources(absolute, relative));
      } else if (item.isFile() && item.name.endsWith('.ts')) {
        found.push(relative);
      }
    }
    return found;
  }

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const documentSourceRoot = join(packageRoot, 'src', 'capabilities', 'document');

  it('值锁：文档域自持常量恰为 "resources:write"（消费拍注入字面量逐字）', () => {
    expect(DOCUMENT_PERMISSION_IDS.resourcesWrite).toBe('resources:write');
    expect(Object.values(DOCUMENT_PERMISSION_IDS)).toContain('resources:write');
  });

  it('单源锁：`resources:write` 字面量在文档域 src 内唯一落点 = contract.ts 常量定义位', () => {
    const carriers: string[] = [];
    for (const relative of collectDocumentSources(documentSourceRoot, '')) {
      const text = readFileSync(join(documentSourceRoot, relative), 'utf8');
      // 只数携带字面量者（grant 消费拍经常量引用取字面量，本身零字面量落点）。
      if (text.includes("'resources:write'")) {
        carriers.push(relative);
      }
    }
    expect(carriers).toEqual(['contract.ts']);
  });

  it('跨语言等值锁：注入字面量与核心写权限常量逐字等（permission.rs 只读核对，禁改 crate）', () => {
    const permissionRs = readFileSync(
      join(packageRoot, '..', 'core-rust', 'crates', 'chips-resource', 'src', 'permission.rs'),
      'utf8',
    );
    const matched = /pub const PERMISSION_RESOURCES_WRITE: &str = "([^"]+)";/.exec(permissionRs);
    expect(matched?.[1]).toBe('resources:write');
    expect(DOCUMENT_PERMISSION_IDS.resourcesWrite).toBe(matched?.[1]);
  });
});

describe('scope-adapter · JS 面死锁端到端锁测（工单036 波 A2b-β，钉死 INV-2 次序的不可恢复反例）', () => {
  it('会话先死而 scope 在册：重挂 ALREADY_EXISTS 真冲突收口，且无任何 JS 面恢复手段 ⇒ 两拍次序是唯一防线', async () => {
    const fake = createFakeNative();
    const adapterA = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('deadlock.card', true);
    const scope = deriveDocumentScope(target, 'card');
    const managedUri = `chips-resource://${scope}/deadlock.card`;
    await adapterA.normalizeSource(target, makeContext());
    await adapterA.registerScope({ documentId: 'doc-dl', managedUri, kind: 'card' });
    // 步 2（反例注入）：绕过第 6 阶段——宿主异常/崩溃形态下会话 X 先行死亡而 scope 仍在册。
    // 正常链路不可复现此态（正是 INV-2 两拍次序的保证），故由测试侧直触原生面模拟。
    // 会话值 4100 为替身首个 `resourceOpenSession` 回执（与既有用例逐字取位口径一致）。
    fake.module.resourceCloseSession(4100);
    // 步 3：新账本重挂（模拟进程重启后适配器在册账丢失）→ 忠实台账报 ALREADY_EXISTS，
    // 适配器按 INV-5 真冲突收口：只关自己新开的事务会话，绝不 unregister 抢占他人在册 scope。
    const adapterB = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    await adapterB.normalizeSource(target, makeContext());
    fake.calls.length = 0;
    const conflict = await expectRejection(() =>
      adapterB.registerScope({ documentId: 'doc-dl', managedUri, kind: 'card' }),
    );
    expect(conflict.code).toBe('RESOURCE_ALREADY_EXISTS');
    const conflictNames = fake.calls.map((call) => call.name);
    expect(conflictNames).toEqual([
      'resourceOpenSession',
      'resourceGrantSession',
      'resourceMountDirectory',
      'resourceCloseSession',
    ]);
    expect(fake.calls.filter((call) => call.name === 'resourceUnregisterScope')).toHaveLength(0);
    // 步 4：以新会话强行注销他人在册 scope —— 归属闸恒 PERMISSION_DENIED（绑定层二回形，
    // OQ-4）；孤儿 scope 常驻，JS 面无任何恢复手段，只能重启清（§2.1(d) 步 3-5 钉死）。
    await expect(
      (
        fake.module as unknown as {
          resourceUnregisterScope(scope: string, sessionId: number): Promise<void>;
        }
      ).resourceUnregisterScope(scope, 4101),
    ).rejects.toMatchObject({ code: 'RESOURCE_PERMISSION_DENIED' });
    // 步 5：再重挂仍死锁（永久在册）——反证「先注销作用域、后关闭资源会话」是唯一防线。
    fake.calls.length = 0;
    await adapterB.normalizeSource(target, makeContext());
    await expectRejection(() => adapterB.registerScope({ documentId: 'doc-dl', managedUri, kind: 'card' }));
    expect(fake.calls.filter((call) => call.name === 'resourceUnregisterScope')).toHaveLength(0);
  });
});

describe('scope-adapter · 点位三消费臂（工单036 波 B2：正向取回 / 反向直读核验 / 注册表基址）', () => {
  /** 归一 + 挂载建立活绑定（替身首个 `resourceOpenSession` 回执恒为 4100）。 */
  async function liveMount(
    adapter: ReturnType<typeof createDocumentScopeAdapter>,
    target: string,
    kind: 'card' | 'box',
  ): Promise<{ readonly managedUri: string; readonly scope: string }> {
    const scope = deriveDocumentScope(target, kind);
    const managedUri = `chips-resource://${scope}/${basename(target)}`;
    await adapter.normalizeSource(target, makeContext());
    await adapter.registerScope({ documentId: 'doc-p3', managedUri, kind });
    return { managedUri, scope };
  }

  function createDiagnosticCapture(): {
    readonly logs: {
      level: string;
      scope: string;
      message: string;
      details?: Readonly<Record<string, unknown>> | undefined;
    }[];
    readonly diagnostics: DiagnosticsSink;
  } {
    const logs: {
      level: string;
      scope: string;
      message: string;
      details?: Readonly<Record<string, unknown>> | undefined;
    }[] = [];
    return {
      logs,
      diagnostics: {
        warn(scope: string, message: string, details?: Readonly<Record<string, unknown>>): void {
          logs.push({ level: 'warn', scope, message, details });
        },
        error(scope: string, message: string, details?: Readonly<Record<string, unknown>>): void {
          logs.push({ level: 'error', scope, message, details });
        },
      },
    };
  }

  it('正向取回：恰一次触原生换算口，入参为作用域基址形 + 活会话，返回值以原生 Origin 为准（账本路径不外泄）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('p3-forward.card', true);
    const { managedUri, scope } = await liveMount(adapter, target, 'card');
    fake.localPathOfImpl = () => Promise.resolve('/native/single-source/relocated.card');
    fake.calls.length = 0;
    await expect(adapter.localPathOf(managedUri, 4100)).resolves.toBe('/native/single-source/relocated.card');
    expect(fake.calls.map((call) => call.name)).toEqual(['resourceLocalPathOf']);
    expect(callAt(fake, 0).args).toEqual([`chips-resource://${scope}/`, 4100]);
  });

  it('正向取回零缓存：同键两次现取两次触原生（记录面与适配器面都不留长期路径）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('p3-twice.card', true);
    const { managedUri } = await liveMount(adapter, target, 'card');
    fake.calls.length = 0;
    await adapter.localPathOf(managedUri, 4100);
    await adapter.localPathOf(managedUri, 4100);
    expect(fake.calls.filter((call) => call.name === 'resourceLocalPathOf')).toHaveLength(2);
  });

  it('正向取回未在册受管引用 ⇒ RESOURCE_NOT_FOUND，零原生调用（不猜路径）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    fake.calls.length = 0;
    const error = await expectRejection(() =>
      adapter.localPathOf('chips-resource://card-2222222222222222222222222222222222222222/ghost.card', 4100),
    );
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
    expect(fake.calls).toHaveLength(0);
  });

  it('正向取回会话未绑定 ⇒ 原生 RESOURCE_PERMISSION_DENIED 原样透传（不吞、不降级为账本值）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('p3-unbound.card', true);
    const { managedUri } = await liveMount(adapter, target, 'card');
    const error = await expectRejection(() => adapter.localPathOf(managedUri, 9999));
    expect(error.code).toBe('RESOURCE_PERMISSION_DENIED');
  });

  it('注册表基址：scopeRootOf 以在册账的 scope 合形；未在册 ⇒ null（调用方零切片派生）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('p3-root.box', false);
    const { managedUri, scope } = await liveMount(adapter, target, 'box');
    expect(adapter.scopeRootOf(managedUri)).toBe(`chips-resource://${scope}/`);
    expect(adapter.scopeRootOf('chips-resource://card-3333333333333333333333333333333333333333/none.card')).toBeNull();
    expect(adapter.scopeRootOf('plain-relative.card')).toBeNull();
  });

  it('命中已有挂载的再归一：走反向直读核验（活会话 + canonical 路径入参），归一结果与首归一同形', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('p3-reverse.card', true);
    const { managedUri, scope } = await liveMount(adapter, target, 'card');
    const first = await adapter.normalizeSource(target, makeContext());
    fake.calls.length = 0;
    const again = await adapter.normalizeSource(managedUri, makeContext());
    expect(fake.calls.map((call) => call.name)).toEqual(['resourceManagedUriOfPath']);
    expect(callAt(fake, 0).args).toEqual([target, 4100]);
    expect(again).toEqual({ managedUri, localPath: first.localPath, form: 'directory' });
    expect(again.managedUri.startsWith(`chips-resource://${scope}/`)).toBe(true);
  });

  it('反向未命中（null）⇒ fail-closed RESOURCE_NOT_FOUND + 审计留痕，跨层错误不回显真实路径（不泄露存在性）', async () => {
    const fake = createFakeNative();
    const capture = createDiagnosticCapture();
    const adapter = createDocumentScopeAdapter({
      native: fake.module,
      ledger: new DocumentScopeLedger(),
      diagnostics: capture.diagnostics,
    });
    const target = makeFixture('p3-miss.card', true);
    const { managedUri } = await liveMount(adapter, target, 'card');
    fake.managedUriOfPathImpl = () => Promise.resolve(null);
    const error = await expectRejection(() => adapter.normalizeSource(managedUri, makeContext()));
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
    expect(error.message).not.toContain(target);
    expect(JSON.stringify(error.details ?? {})).not.toContain(target);
    expect(capture.logs.some((log) => log.level === 'error' && log.message.includes('不一致'))).toBe(true);
    expect(capture.logs.some((log) => JSON.stringify(log.details ?? {}).includes('换算未命中'))).toBe(true);
  });

  it('反向命中他作用域 ⇒ 同判账本漂移 fail-closed，审计点名「他作用域」（禁抢占、禁回退账本供路径）', async () => {
    const fake = createFakeNative();
    const capture = createDiagnosticCapture();
    const adapter = createDocumentScopeAdapter({
      native: fake.module,
      ledger: new DocumentScopeLedger(),
      diagnostics: capture.diagnostics,
    });
    const target = makeFixture('p3-other.card', true);
    const { managedUri } = await liveMount(adapter, target, 'card');
    fake.managedUriOfPathImpl = () =>
      Promise.resolve('chips-resource://card-4444444444444444444444444444444444444444/');
    const error = await expectRejection(() => adapter.normalizeSource(managedUri, makeContext()));
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
    expect(capture.logs.some((log) => JSON.stringify(log.details ?? {}).includes('他作用域'))).toBe(true);
    expect(fake.calls.filter((call) => call.name === 'resourceUnregisterScope')).toHaveLength(0);
  });

  it('未挂载账目的再归一零反查（挂载前核心侧无登记面，反查必未命中 ⇒ 不触原生）', async () => {
    const fake = createFakeNative();
    const adapter = createDocumentScopeAdapter({ native: fake.module, ledger: new DocumentScopeLedger() });
    const target = makeFixture('p3-premount.card', true);
    const first = await adapter.normalizeSource(target, makeContext());
    fake.calls.length = 0;
    const again = await adapter.normalizeSource(first.managedUri, makeContext());
    expect(again).toEqual(first);
    expect(fake.calls).toHaveLength(0);
  });
});
