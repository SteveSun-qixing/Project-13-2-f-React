/**
 * 全作用域资源读面锁单测（工单036 残段 T5；06-资源协议规范 §四/§5.2/§5.3/§9.3、
 * 04.11 §11.3 chips-resource 句柄正式面、08-权限系统设计 §7 权限链）。
 *
 * @remarks
 * - chips-resource 句柄面以类型化替身注入（离线可测，端口注入纪律）：真核心判定语义由
 *   `document-native-resource-module.test.ts` 的三方一致性与 Rust 侧单测锁定，本套件锁定
 *   宿主读面的**编排语义**——platform 委托零漂移、权限链两级、句柄生命周期、范围读 416、
 *   分块整读、会话级联。
 * - 宿主运行时集成臂经 `HostRuntimeOptions.resourceAccess` 锁定 `bridge:resource` 通道的
 *   open / release 行为（消费方 `chips.resource(uri)` 句柄形状零改动）。
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createPlatformResourceBackend } from '../src/runtime/platform-resource.js';
import {
  createManagedResourceAccess,
  createManagedResourceBackend,
  hasSessionReadPermission,
} from '../src/runtime/managed-resource-access.js';
import type { IManagedResourceAccessPort, SessionPermissionsOf } from '../src/runtime/managed-resource-access.js';
import type {
  INativeResourceModule,
  INativeResourceOpenResult,
} from '../src/capabilities/document/adapters/native-resource-module.js';
import { createHostRuntime } from '../src/runtime/host-runtime.js';
import type { IHostSession } from '../src/runtime/capability/contracts.js';
import type { IPlatformHostChannel, IResourceReadRequest } from '../src/runtime/contracts.js';
import type { IPalHost } from '../src/platform/contracts/index.js';
import { createFakePalHost } from './helpers/fake-pal-host.js';

/** 类型化 chips-resource 句柄面替身（§11.3 编排面；记录全部调用）。 */
function createNativeFake(
  input: { readonly bytes?: Readonly<Record<string, Uint8Array>> } = {},
): INativeResourceModule & {
  readonly calls: { readonly op: string; readonly detail?: unknown }[];
  readonly handleBytes: Map<number, string>;
  readonly sessionGrants: Map<number, readonly string[]>;
} {
  const calls: { op: string; detail?: unknown }[] = [];
  const handleBytes = new Map<number, string>();
  const sessionGrants = new Map<number, readonly string[]>();
  let nextHandle = 100;
  let nextSession = 900;
  const bytesOf = (uri: string): Uint8Array => input.bytes?.[uri] ?? new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  return {
    calls,
    handleBytes,
    sessionGrants,
    resourceOpen(uri: string, sessionId: number): Promise<INativeResourceOpenResult> {
      calls.push({ op: 'open', detail: { uri, sessionId } });
      const handleId = nextHandle;
      nextHandle += 1;
      handleBytes.set(handleId, uri);
      return Promise.resolve({
        handleId,
        metadata: {
          uri,
          size: bytesOf(uri).byteLength,
          mimeType: 'application/x-test',
          version: '7',
          scope: uri.slice('chips-resource://'.length).split('/', 1)[0] ?? '',
        },
      });
    },
    resourceStat(
      handleId: number,
    ): Promise<{ uri: string; size: number; mimeType: string; version: string; scope: string }> {
      calls.push({ op: 'stat', detail: { handleId } });
      const uri = handleBytes.get(handleId) ?? '';
      return Promise.resolve({
        uri,
        size: bytesOf(uri).byteLength,
        mimeType: 'application/x-test',
        version: '7',
        scope: '',
      });
    },
    resourceRead(handleId: number, offset: number, length: number): Promise<Uint8Array> {
      calls.push({ op: 'read', detail: { handleId, offset, length } });
      return Promise.resolve(bytesOf(handleBytes.get(handleId) ?? '').subarray(offset, offset + length));
    },
    resourceReadChunk(handleId: number, maxBytes: number): Promise<Uint8Array | null> {
      calls.push({ op: 'chunk', detail: { handleId, maxBytes } });
      const uri = handleBytes.get(handleId) ?? '';
      const bytes = bytesOf(uri);
      const cursor = this.chunkCursors.get(handleId) ?? 0;
      if (cursor >= bytes.byteLength) {
        this.chunkCursors.delete(handleId);
        return Promise.resolve(null);
      }
      const end = Math.min(cursor + maxBytes, bytes.byteLength);
      this.chunkCursors.set(handleId, end);
      return Promise.resolve(bytes.subarray(cursor, end));
    },
    resourceRelease(handleId: number): void {
      calls.push({ op: 'release', detail: { handleId } });
      handleBytes.delete(handleId);
    },
    resourceCommitWrite(): Promise<never> {
      throw new Error('读面替身不承载写入臂');
    },
    resourceCommitWriteStream(): Promise<never> {
      throw new Error('读面替身不承载写入臂');
    },
    resourceListDirectory(): Promise<never> {
      throw new Error('读面替身不承载目录列举');
    },
    resourceDelete(): Promise<void> {
      throw new Error('读面替身不承载删除');
    },
    resourceRename(): Promise<void> {
      throw new Error('读面替身不承载重命名');
    },
    resourceCopy(): Promise<never> {
      throw new Error('读面替身不承载复制');
    },
    resourceCreateDirectory(): Promise<void> {
      throw new Error('读面替身不承载目录创建');
    },
    resourceOpenSession(kind: string, owner: string): number {
      calls.push({ op: 'openSession', detail: { kind, owner, sessionId: nextSession } });
      const sessionId = nextSession;
      nextSession += 1;
      return sessionId;
    },
    resourceCloseSession(sessionId: number): void {
      calls.push({ op: 'closeSession', detail: { sessionId } });
    },
    resourceRegisterTempScope(): string {
      throw new Error('读面替身不承载临时作用域');
    },
    resourceMountDirectory(): Promise<string> {
      throw new Error('读面替身不承载目录挂载');
    },
    resourceMountArchive(): Promise<string> {
      throw new Error('读面替身不承载归档挂载');
    },
    resourceUnregisterScope(): Promise<void> {
      throw new Error('读面替身不承载注销');
    },
    resourceLocalPathOf(): Promise<string> {
      throw new Error('读面替身不承载换算');
    },
    resourceManagedUriOfPath(): Promise<string | null> {
      throw new Error('读面替身不承载换算');
    },
    resourceGrantSession(sessionId: number, permissions: readonly string[]): void {
      calls.push({ op: 'grant', detail: { sessionId, permissions } });
      sessionGrants.set(sessionId, permissions);
    },
    resourceCommitChangeset(): Promise<never> {
      throw new Error('读面替身不承载提交链');
    },
    resourceRebuildArchive(): Promise<never> {
      throw new Error('读面替身不承载提交链');
    },
    chunkCursors: new Map<number, number>(),
  } as INativeResourceModule & {
    readonly calls: { op: string; detail?: unknown }[];
    readonly handleBytes: Map<number, string>;
    readonly sessionGrants: Map<number, readonly string[]>;
    chunkCursors: Map<number, number>;
  };
}

/** Bridge 会话替身。 */
function sessionOf(input: {
  readonly sessionId?: string;
  readonly pluginId?: string;
  readonly grantedPermissions?: readonly string[];
}): IHostSession {
  return {
    sessionId: input.sessionId ?? 'session:7:main',
    pluginId: input.pluginId ?? 'chips.official.photo-viewer',
    windowId: 7,
    frameId: null,
    grantedPermissions: new Set<string>(input.grantedPermissions ?? ['resources:read']),
    openedDocuments: new Set<string>(),
    state: 'active',
    permissionVersion: 1,
  };
}

const CARD_URI = 'chips-resource://card-abc/media/audio.mp3';
const CARD_BYTES = new Uint8Array(600).map((_, index) => index % 251);

/** 读面构造捷径（platform 后端指向临时目录）。 */
async function startAccess(
  input: {
    readonly granted?: ReadonlySet<string> | null;
  } = {},
): Promise<{
  access: IManagedResourceAccessPort;
  native: ReturnType<typeof createNativeFake>;
  platformRoot: string;
  cleanup: () => Promise<void>;
}> {
  const platformRoot = await mkdtemp(join(tmpdir(), 'chips-managed-resource-'));
  await writeFile(join(platformRoot, 'shell.html'), '<html></html>', 'utf8');
  const native = createNativeFake({ bytes: { [CARD_URI]: CARD_BYTES } });
  const sessionPermissionsOf: SessionPermissionsOf =
    input.granted === undefined
      ? () => new Set(['*'])
      : (): ReadonlySet<string> | null => input.granted as ReadonlySet<string> | null;
  const access = createManagedResourceAccess({
    native,
    platform: createPlatformResourceBackend(platformRoot),
    sessionPermissionsOf,
    bridgeSessionIdOf: (source) =>
      `session:${String(source.windowId)}:${source.frameId === null ? 'main' : String(source.frameId)}`,
  });
  return {
    access,
    native,
    platformRoot,
    cleanup: async () => {
      await rm(platformRoot, { recursive: true, force: true });
    },
  };
}

const GRANTED_SESSION = sessionOf({});

afterEach(async () => {
  // 各用例自清理（mkdtemp 句柄随用例内 cleanup 释放）。
});

describe('全作用域读面：platform 委托零漂移', () => {
  it('chips-resource://platform/* 经平台后端返回（壳页装载路径行为不变）', async () => {
    const env = await startAccess();
    try {
      const result = await env.access.read({
        uri: 'chips-resource://platform/shell.html',
        session: { windowId: 7, frameId: null },
        method: 'GET',
        range: null,
        headers: {},
      });
      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toContain('text/html');
      expect(env.native.calls).toEqual([]);
    } finally {
      await env.cleanup();
    }
  });
});

describe('全作用域读面：句柄面（bridge:resource open / release）', () => {
  it('open 经 resourceOpen 取元数据；原生会话按 Bridge 会话懒建一次并注入 resources:read', async () => {
    const env = await startAccess();
    try {
      const metadata = await env.access.open(GRANTED_SESSION, CARD_URI);
      expect(metadata).toEqual({
        uri: CARD_URI,
        size: CARD_BYTES.byteLength,
        mimeType: 'application/x-test',
        version: '7',
        scope: 'card-abc',
      });
      // 同会话二次打开复用同一原生会话（06 §4.1 会话内读取免重复校验）。
      await env.access.open(GRANTED_SESSION, 'chips-resource://card-abc/media/cover.png');
      const openCalls = env.native.calls.filter((call) => call.op === 'open');
      expect(openCalls).toHaveLength(2);
      expect(env.native.calls.filter((call) => call.op === 'openSession')).toEqual([
        { op: 'openSession', detail: { kind: 'window', owner: 'chips.official.photo-viewer', sessionId: 900 } },
      ]);
      const sessionId = (env.native.calls.find((call) => call.op === 'openSession')?.detail as { sessionId?: number })
        ?.sessionId;
      expect(env.native.sessionGrants.get(sessionId ?? -1)).toEqual(['resources:read']);
      expect(env.access.handleCount).toBe(2);
    } finally {
      await env.cleanup();
    }
  });

  it('权限链第①级：无 resources:read 快照的会话拒绝（R19；核心权威判定在其后）', async () => {
    const env = await startAccess();
    try {
      await expect(env.access.open(sessionOf({ grantedPermissions: [] }), CARD_URI)).rejects.toMatchObject({
        code: 'RESOURCE_PERMISSION_DENIED',
      });
      expect(env.native.calls.filter((call) => call.op === 'open')).toEqual([]);
      expect(hasSessionReadPermission(new Set(['*']))).toBe(true);
      expect(hasSessionReadPermission(new Set(['resources:read']))).toBe(true);
      expect(hasSessionReadPermission(new Set<string>(['document:read']))).toBe(false);
      expect(hasSessionReadPermission(null)).toBe(false);
    } finally {
      await env.cleanup();
    }
  });

  it('release 幂等释放句柄；会话关闭级联 closeSession（核心级联释放句柄）', async () => {
    const env = await startAccess();
    try {
      await env.access.open(GRANTED_SESSION, CARD_URI);
      env.access.release(GRANTED_SESSION.sessionId, CARD_URI);
      env.access.release(GRANTED_SESSION.sessionId, CARD_URI);
      expect(env.access.handleCount).toBe(0);
      expect(env.native.calls.filter((call) => call.op === 'release')).toHaveLength(1);
      env.access.closeBridgeSession(GRANTED_SESSION.sessionId);
      env.access.closeBridgeSession(GRANTED_SESSION.sessionId);
      expect(env.native.calls.filter((call) => call.op === 'closeSession')).toHaveLength(1);
    } finally {
      await env.cleanup();
    }
  });
});

describe('全作用域读面：协议路径（06 §5.3 范围读取与 §9.3 分块）', () => {
  it('整读经 256 KiB 分块循环拼装；读毕即释句柄', async () => {
    const env = await startAccess();
    try {
      const result = await env.access.read({
        uri: CARD_URI,
        session: { windowId: 7, frameId: null },
        method: 'GET',
        range: null,
        headers: {},
      });
      expect(result.status).toBe(200);
      expect(result.headers['Content-Length']).toBe(String(CARD_BYTES.byteLength));
      const body = result.body as Uint8Array;
      expect(body.byteLength).toBe(CARD_BYTES.byteLength);
      expect(body[10]).toBe(CARD_BYTES[10]);
      const chunkCalls = env.native.calls.filter((call) => call.op === 'chunk');
      expect(chunkCalls.length).toBeGreaterThanOrEqual(2);
      expect(chunkCalls[0]?.detail).toMatchObject({ maxBytes: 256 * 1024 });
      expect(env.native.calls.at(-1)?.op).toBe('release');
    } finally {
      await env.cleanup();
    }
  });

  it('范围读 206 与 Content-Range；越界起点 416（bytes */size）；HEAD 无体', async () => {
    const env = await startAccess();
    try {
      const range: IResourceReadRequest = {
        uri: CARD_URI,
        session: { windowId: 7, frameId: null },
        method: 'GET',
        range: { start: 2, end: 7 },
        headers: { Range: 'bytes=2-7' },
      };
      const partial = await env.access.read(range);
      expect(partial.status).toBe(206);
      expect(partial.headers['Content-Range']).toBe(`bytes 2-7/${String(CARD_BYTES.byteLength)}`);
      expect((partial.body as Uint8Array).byteLength).toBe(6);

      const unsatisfiable = await env.access.read({
        ...range,
        range: { start: CARD_BYTES.byteLength, end: null },
      });
      expect(unsatisfiable.status).toBe(416);
      expect(unsatisfiable.headers['Content-Range']).toBe(`bytes */${String(CARD_BYTES.byteLength)}`);

      const head = await env.access.read({ ...range, method: 'HEAD', range: null });
      expect(head.status).toBe(200);
      expect(head.body).toBeNull();
      expect(head.headers['Content-Length']).toBe(String(CARD_BYTES.byteLength));
    } finally {
      await env.cleanup();
    }
  });

  it('协议路径权限链：会话无法解析即拒绝；platform 不经会话判定', async () => {
    const granted: ReadonlySet<string> | null = null;
    const env = await startAccess({ granted });
    try {
      await expect(
        env.access.read({
          uri: CARD_URI,
          session: null,
          method: 'GET',
          range: null,
          headers: {},
        }),
      ).rejects.toMatchObject({ code: 'RESOURCE_PERMISSION_DENIED' });
      const platform = await env.access.read({
        uri: 'chips-resource://platform/shell.html',
        session: null,
        method: 'GET',
        range: null,
        headers: {},
      });
      expect(platform.status).toBe(200);
    } finally {
      await env.cleanup();
    }
  });
});

describe('宿主运行时集成：resourceAccess 接线后的 bridge:resource 通道（消费方形状零改动）', () => {
  it('open 返回元数据、release 清账、窗口关闭级联原生会话收口', async () => {
    const platformRoot = await mkdtemp(join(tmpdir(), 'chips-managed-runtime-'));
    const native = createNativeFake({ bytes: { [CARD_URI]: CARD_BYTES } });
    try {
      const grant = { pluginId: 'chips.official.photo-viewer', grantedPermissions: ['resources:read'] };
      const runtime = createHostRuntime({
        platformRoot,
        resourceAccess: { native },
        sessionProvisioner: { provision: () => grant },
      });
      const host: IPalHost = createFakePalHost();
      const channel: IPlatformHostChannel = { pushSessionPermissions: () => undefined };
      await runtime.start(host, channel);
      const source = { windowId: 11, frameId: null };
      const opened = await runtime.ipc.handleResourceControl(source, {
        requestId: 'res-open-1',
        operation: 'open',
        uri: CARD_URI,
      });
      expect(opened.ok).toBe(true);
      expect((opened as { metadata: unknown }).metadata).toMatchObject({
        uri: CARD_URI,
        scope: 'card-abc',
        mimeType: 'application/x-test',
      });
      // 协议路径（chips.resource(uri).read() 的 fetch 臂）同面放行。
      const backend = runtime.resources;
      const bytes = await backend.read({
        uri: CARD_URI,
        session: source,
        method: 'GET',
        range: null,
        headers: {},
      });
      expect(bytes.status).toBe(200);
      expect((bytes.body as Uint8Array).byteLength).toBe(CARD_BYTES.byteLength);

      const released = await runtime.ipc.handleResourceControl(source, {
        requestId: 'res-release-1',
        operation: 'release',
        uri: CARD_URI,
      });
      expect(released.ok).toBe(true);
      runtime.ipc.handleWindowClosed(11);
      expect(native.calls.filter((call) => call.op === 'closeSession')).toHaveLength(1);
      await runtime.shutdown();
    } finally {
      await rm(platformRoot, { recursive: true, force: true });
    }
  });

  it('无权限快照的会话经 bridge:resource open 仍拒绝（通道级权限链保持）', async () => {
    const platformRoot = await mkdtemp(join(tmpdir(), 'chips-managed-runtime-'));
    const native = createNativeFake();
    try {
      const runtime = createHostRuntime({
        platformRoot,
        resourceAccess: { native },
        sessionProvisioner: { provision: () => ({ pluginId: 'p', grantedPermissions: [] }) },
      });
      const host: IPalHost = createFakePalHost();
      await runtime.start(host, { pushSessionPermissions: () => undefined });
      const denied = await runtime.ipc.handleResourceControl(
        { windowId: 5, frameId: null },
        {
          requestId: 'res-open-2',
          operation: 'open',
          uri: CARD_URI,
        },
      );
      expect(denied.ok).toBe(false);
      if (!denied.ok) {
        expect(denied.error.code).toBe('BRIDGE_PERMISSION_DENIED');
      }
      await runtime.shutdown();
    } finally {
      await rm(platformRoot, { recursive: true, force: true });
    }
  });

  it('未注入 resourceAccess：platform-only 旧链路零变化（自检/测试运行时）', async () => {
    const platformRoot = await mkdtemp(join(tmpdir(), 'chips-managed-runtime-'));
    await writeFile(join(platformRoot, 'shell.html'), '<html></html>', 'utf8');
    try {
      const runtime = createHostRuntime({ platformRoot });
      const host: IPalHost = createFakePalHost();
      await runtime.start(host, { pushSessionPermissions: () => undefined });
      const opened = await runtime.ipc.handleResourceControl(
        { windowId: 2, frameId: null },
        {
          requestId: 'res-open-3',
          operation: 'open',
          uri: 'chips-resource://platform/shell.html',
        },
      );
      expect(opened.ok).toBe(true);
      expect((opened as { metadata: unknown }).metadata).toMatchObject({ scope: 'platform' });
      await runtime.shutdown();
    } finally {
      await rm(platformRoot, { recursive: true, force: true });
    }
  });
});

describe('受管后端组合视图', () => {
  it('createManagedResourceBackend 以访问面承载 IResourceBackend', async () => {
    const env = await startAccess();
    try {
      const backend = createManagedResourceBackend({
        platform: createPlatformResourceBackend(env.platformRoot),
        access: env.access,
      });
      const result = await backend.read({
        uri: CARD_URI,
        session: { windowId: 7, frameId: null },
        method: 'GET',
        range: null,
        headers: {},
      });
      expect(result.status).toBe(200);
    } finally {
      await env.cleanup();
    }
  });
});
