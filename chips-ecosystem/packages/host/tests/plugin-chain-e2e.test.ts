/**
 * 插件链 E2E（装载 → 能力 → 事件）金链路套件（任务 #118；波 1–3 验收后的链路级合取）。
 *
 * 覆盖两臂：
 * - **臂 A（原生子进程，生产链路主臂）**：运行时构造 service 角色真实签名 `.cpk`
 *   （`chips-signature-v1` / Ed25519、夹具信任根内 keyId）→ 子进程内按生产接线口径
 *   （`createHostRuntime` + `pluginLoaderFactory=createCpkPluginLoader` + 波 2 正式激活通道）
 *   全链逐环：install（临时目录 → 五阶段校验 → 原子落盘 → registry.json 持久化 →
 *   `plugin:installed`）→ enable（T2 → Starting → ModuleLoader 受管求值 → 角色形状 →
 *   Active；`plugin:loaded`/`plugin:enabled`）→ 插件 start(ctx) 经激活上下文注册能力
 *   （owner 预绑定）→ Bridge 会话经 `ipc.handleRequest` 真实路由调用插件 handler
 *   （响应回传仅存活于子进程的 run token，证明执行的是被门禁装载的真插件代码）→
 *   事件总线（`handleEventControl` 订阅 → 插件 `publishEvent` / 生命周期事件 →
 *   `forwardEvents` sink 收到信封，逐条断言事件名与负载）→ disable（stop 回调真执行、
 *   能力撤销、停用后调用得 `BRIDGE_CAPABILITY_NOT_FOUND`）→ uninstall 善后
 *   （目录移除、注册表清账、`plugin:unloaded`/`plugin:uninstalled`）。
 * - **臂 B（vitest 管线现状锁定，诚实回退臂）**：波 1 在册事实——vitest（vite-node）代管
 *   `import()` 时 ModuleLoader 通道门禁 fail-closed（`tests/loader-module.test.ts` C 组）。
 *   本臂用真实签名 app 夹具 `hello-0.1.0.cpk` 把该现状锁定进链路：install → 持久化 →
 *   enable 走**生产激活通道**（O1 归档再锚定目录重放 + Ed25519 再验签真实执行）直至
 *   通道闸 → `KERNEL_APPLY_FAILED`（`details.stage='channel'`、`reason='not-live'`）→
 *   `plugin:failed` 经真实事件总线送达订阅会话 → failed 态卸载善后。附装后篡改臂：
 *   再锚定在通道闸前以 `stage='integrity'`、`causeCode=CPK_SIGNATURE_INVALID` 拒落。
 *
 * @remarks
 * - 载体定性：注册表 / 信任根 / 能力注册表 / 会话 / 订阅中心 / 路由 / 激活通道 /
 *   ModuleLoader 全部为生产实现；`IPlatformHostChannel` 与 `IEventSink` 为宿主运行时既有
 *   测试注入面（`tests/host-runtime.test.ts` 同源）。链中零内存替身、零假通路。
 * - 已登记缺口（现状锁定的边界，不造假闭环）：渲染世界 `window.chips.*` 的
 *   preload→IPC→host 边在 node 测试环境不可达，本套件最深点为 host 运行时
 *   `ipc` + `forwardEvents`（preload 消费位）；渲染侧分段由 preload 单测承接，真进程
 *   全链由旗标臂（CHIPS_HOST_SMOKE/e2e-host，主智能体串行终验）承接。插件身份会话
 *   权限快照注入归工单 025 剩余项③（cordis 内核接线波，RFC §六 S10）。
 * - 事件台账（并联于 `emitEvent` 的纯观测记录）与 `forwardEvents` 双留痕：
 *   前者锁「发布序」，后者锁「订阅会话视角投递序」，两者不互替。
 * - 错误码断言一律引用在册常量（`LIFECYCLE_ERROR_CODES` / `BRIDGE_ERROR_CODES` /
 *   `CPK_ERROR_CODES` 经 `causeCode`），零发明码值。
 * - 臂 A 子进程以 `process.execPath` 纯 node 启动（不占真进程单例锁）；全套无旗标可跑
 *   （CI 语义）。
 */

import { createPrivateKey, randomUUID, sign as cryptoSign } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterAll, describe, expect, it } from 'vitest';

import {
  CPK_ERROR_CODES,
  LIFECYCLE_ERROR_CODES,
  PLUGIN_LIFECYCLE_EVENTS,
  LoaderError,
  computeContentHash,
  createCpkPluginLoader,
  createTrustRootRegistryFromDocument,
  loadCpkArchive,
  membersToZipEntries,
  openPluginRegistry,
  type ICpkPluginLoader,
  type IPluginRecord,
  type IPluginRegistry,
} from '../src/loader/index.js';
import { crc32 } from '../src/loader/zip.js';
import { createHostPluginActivationChannel } from '../src/main/plugin-activation.js';
import { BRIDGE_ERROR_CODES } from '../src/protocol/error-codes.js';
import type { IEventEnvelope, ISessionPermissionsUpdate } from '../src/protocol/wire.js';
import { createHostCapabilityRegistry } from '../src/runtime/capability/registry.js';
import type { IEventSink, IPlatformHostChannel } from '../src/runtime/contracts.js';
import { createHostRuntime, type IHostRuntime } from '../src/runtime/host-runtime.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// 资产定位与常量（夹具只读引用 `chips-ecosystem/tests/e2e/fixtures/cpk/`）
// ---------------------------------------------------------------------------

function fixtureAsset(relative: string): string {
  return fileURLToPath(new URL(`../../../tests/e2e/fixtures/cpk/${relative}`, import.meta.url));
}

const HARNESS_PATH = fileURLToPath(
  new URL('./fixtures/plugin-chain-e2e/run-chain.mjs', import.meta.url),
);
const SOURCE_PATHS = {
  loaderIndex: fileURLToPath(new URL('../src/loader/index.ts', import.meta.url)),
  activation: fileURLToPath(new URL('../src/main/plugin-activation.ts', import.meta.url)),
  hostRuntime: fileURLToPath(new URL('../src/runtime/host-runtime.ts', import.meta.url)),
};

const HOST_VERSION = '0.1.0';
/** 夹具专用签名 keyId（`keys/trust-roots.json` 在册；发布链路信任根另归工单 028）。 */
const FIXTURE_KEY_ID = 'chips-fixture-2026';
/** 臂 A 链探针（service 角色，运行时构造并签名，不入夹具资产）。 */
const PROBE = {
  id: 'chips.example.chainprobe',
  version: '0.1.0',
  capabilityId: 'chainprobe:ping',
  readyEvent: 'chainprobe:ready',
  stoppedEvent: 'chainprobe:stopped',
} as const;
/** 臂 B 使用的真实签名正夹具（app 角色，任务 #34/#79 交付链）。 */
const HELLO = { id: 'chips.example.hello', version: '0.1.0' } as const;

/** 本套件创建的全部临时工作区（afterAll 统一清理）。 */
const workspaces: string[] = [];

async function makeWorkspace(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  workspaces.push(dir);
  return dir;
}

afterAll(async () => {
  for (const dir of workspaces) {
    await rm(dir, { recursive: true, force: true });
  }
});

/** 捕获 Promise 拒绝值（正路成功即断言失败）。 */
async function captureRejection(action: Promise<unknown>): Promise<unknown> {
  try {
    await action;
  } catch (error) {
    return error;
  }
  throw new Error('期望拒绝，但承诺已兑现');
}

// ---------------------------------------------------------------------------
// 内联 ZIP Store 打包（与 `tests/loader-package.test.ts` 既有重打包先例同口径：Store、
// 无 extra、成员按路径字节序；归档由生产读取面 `loadCpkArchive` 消化）
// ---------------------------------------------------------------------------

function buildZipStore(
  entries: readonly { readonly path: string; readonly data: Uint8Array }[],
): Uint8Array {
  const sorted = [...entries].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of sorted) {
    const name = Buffer.from(entry.path, 'utf8');
    const data = Buffer.from(entry.data);
    const checksum = crc32(new Uint8Array(data));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const centralBytes = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(sorted.length, 8);
  eocd.writeUInt16LE(sorted.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return new Uint8Array(Buffer.concat([...localParts, centralBytes, eocd]));
}

// ---------------------------------------------------------------------------
// 臂 A 链探针包（service 角色；签名口径与生产 `signature.ts` / `@chips/cli` pack 同源）
// ---------------------------------------------------------------------------

const PROBE_MANIFEST = `id: ${PROBE.id}
version: ${PROBE.version}
type: service
name: 链路探针
description: 插件链 E2E 金链路夹具：能力注册、事件发布与生命周期回调
author: 薯片
license: MIT
runtime:
  targets: [host]
  background: true
permissions:
  - resources:read
`;

/**
 * 探针入口（在 ModuleLoader 双钩门禁下受管求值的真插件代码）：
 * - `start(ctx)`：经激活上下文注册能力（owner 预绑定）+ 发布就绪事件；
 * - handler：回传 run token（仅存活于子进程 `globalThis`，证真执行）与调用方会话投影；
 * - `stop()`：停用计数 + 经存续的 ctx 发布善后事件。
 */
function probeEntrySource(): string {
  return `// chips 链探针（臂 A 夹具入口；生产门禁下受管求值）
let contextRef = null;
export default {
  async start(context) {
    contextRef = context;
    globalThis.__CHAIN_E2E_STARTS__ = (globalThis.__CHAIN_E2E_STARTS__ ?? 0) + 1;
    context.registerCapability({
      id: '${PROBE.capabilityId}',
      permissions: ['resources:read'],
      handler: async (input, capabilityContext) => ({
        pong: input && typeof input === 'object' ? input.token ?? null : null,
        callerId: capabilityContext.callerId,
        sessionId: capabilityContext.sessionId,
        runToken: globalThis.__CHAIN_E2E_TOKEN__ ?? null,
        starts: globalThis.__CHAIN_E2E_STARTS__ ?? null,
      }),
    });
    context.publishEvent('${PROBE.readyEvent}', {
      pluginId: context.pluginId,
      version: context.version,
      role: context.role,
    });
  },
  async stop() {
    globalThis.__CHAIN_E2E_STOPS__ = (globalThis.__CHAIN_E2E_STOPS__ ?? 0) + 1;
    contextRef?.publishEvent('${PROBE.stoppedEvent}', {
      pluginId: contextRef.pluginId,
      stops: globalThis.__CHAIN_E2E_STOPS__,
    });
  },
};
`;
}

/** 以生产 `computeContentHash` 口径构造 `chips-signature-v1` 文档并用夹具私钥签名。 */
function signProbeMembers(members: Map<string, Uint8Array>): void {
  const unsigned: { path: string; data: Uint8Array }[] = [];
  for (const [path, data] of members) {
    if (path !== 'signature.json') {
      unsigned.push({ path, data });
    }
  }
  const contentHash = computeContentHash(unsigned);
  const privateKey = createPrivateKey(readFileSync(fixtureAsset('keys/fixture-signing-private.pem')));
  const signature = cryptoSign(null, Buffer.from(contentHash, 'utf8'), privateKey).toString('base64');
  members.set(
    'signature.json',
    new TextEncoder().encode(
      `${JSON.stringify(
        { format: 'chips-signature-v1', keyId: FIXTURE_KEY_ID, algorithm: 'ed25519', contentHash, signature },
        null,
        2,
      )}\n`,
    ),
  );
}

/** 生成签名后的探针 `.cpk`（归档态）与装后目录合并摘要（O1 两口径对照锚）。 */
async function buildSignedProbeCpk(
  workspace: string,
): Promise<{ cpkFile: string; mergedHash: string }> {
  const members = new Map<string, Uint8Array>([
    ['manifest.yaml', new TextEncoder().encode(PROBE_MANIFEST)],
    ['dist/index.js', new TextEncoder().encode(probeEntrySource())],
  ]);
  signProbeMembers(members);
  const archive = buildZipStore([...members.entries()].map(([path, data]) => ({ path, data })));
  const cpkFile = join(workspace, `${PROBE.id}-${PROBE.version}.cpk`);
  await writeFile(cpkFile, archive);
  // 装后目录合并摘要 = 全成员（含 signature.json）口径（`plugin-activation.ts` O1 再锚定期望值）。
  const mergedHash = computeContentHash(membersToZipEntries(members));
  return { cpkFile, mergedHash };
}

// ---------------------------------------------------------------------------
// 臂 A：原生子进程全链（生产链路主臂）
// ---------------------------------------------------------------------------

interface ChainStep<T> {
  ok: boolean;
  value?: T;
  error?: { code: string | null; message: string; details: Record<string, unknown> | null };
}

interface ChainResults {
  fatal: unknown;
  events: { eventId: string; payload: unknown }[];
  delivered: { windowId: number; envelope: IEventEnvelope }[];
  checkpoints: {
    registryAfterInstall: { version: number; plugins: Record<string, unknown>[] };
    diskAfterInstall: boolean;
    stateAfterInstall: string;
    registryAfterEnable: { plugins: { enabled: boolean }[] };
    stateAfterEnable: string;
    reportAfterEnable: { capabilities: { byOwner: Record<string, number> } };
    registryAfterDisable: { plugins: { enabled: boolean }[] };
    stateAfterDisable: string;
    reportAfterDisable: { capabilities: { byOwner: Record<string, number> } };
    registryAfterUninstall: { plugins: unknown[] };
    diskAfterUninstall: boolean;
    listAfterUninstall: unknown[];
    globals: { starts: number | null; stops: number | null };
    [key: string]: unknown;
  };
  install?: ChainStep<IPluginRecord>;
  enable?: ChainStep<IPluginRecord>;
  invoke?: ChainStep<{ requestId: string; ok: boolean; result?: unknown; error?: { code: string } }>;
  disable?: ChainStep<{ record: IPluginRecord; stopError?: unknown }>;
  invokeAfterDisable?: ChainStep<{ requestId: string; ok: boolean; result?: unknown; error?: { code: string } }>;
  uninstall?: ChainStep<void>;
  activatedEntry?: {
    pluginId: string;
    version: string;
    role: string;
    nonce: string;
    entryUrl: string;
    entryKeys: string[];
  } | null;
  activatedEntryAfterDisable?: unknown;
  packageHashAfterInstall?: string;
}

describe('臂 A：真实签名 .cpk 插件链全环（原生子进程 × 生产接线）', () => {
  it(
    'A1 install→registry→enable（真求值）→能力调用→事件总线→disable→uninstall 全链逐环',
    async () => {
      const workspace = await makeWorkspace('chips-chain-e2e-');
      const pluginsRoot = join(workspace, 'plugins');
      await mkdir(pluginsRoot, { recursive: true });
      const { cpkFile, mergedHash } = await buildSignedProbeCpk(workspace);
      const runToken = randomUUID();
      const invokeToken = `invoke-${randomUUID()}`;

      const argsPath = join(workspace, 'chain-args.json');
      const outFile = join(workspace, 'chain-out.json');
      await writeFile(
        argsPath,
        JSON.stringify({
          sources: SOURCE_PATHS,
          outFile,
          pluginsRoot,
          registryFile: join(pluginsRoot, 'registry.json'),
          sessionRoot: join(workspace, 'sessions'),
          platformRoot: workspace,
          trustRootsFile: fixtureAsset('keys/trust-roots.json'),
          hostVersion: HOST_VERSION,
          cpkFile,
          pluginId: PROBE.id,
          capabilityId: PROBE.capabilityId,
          invokeInput: { token: invokeToken },
          subscribe: [
            PLUGIN_LIFECYCLE_EVENTS.installed,
            PLUGIN_LIFECYCLE_EVENTS.loaded,
            PLUGIN_LIFECYCLE_EVENTS.enabled,
            PLUGIN_LIFECYCLE_EVENTS.disabled,
            PLUGIN_LIFECYCLE_EVENTS.unloaded,
            PLUGIN_LIFECYCLE_EVENTS.uninstalled,
            PLUGIN_LIFECYCLE_EVENTS.failed,
            PROBE.readyEvent,
            PROBE.stoppedEvent,
          ],
          runToken,
        }),
      );
      try {
        await execFileAsync(process.execPath, [HARNESS_PATH, argsPath], {
          env: {},
          timeout: 150_000,
          maxBuffer: 8 * 1024 * 1024,
        });
      } catch (error) {
        if (!existsSync(outFile)) {
          const detail =
            error instanceof Error
              ? `${error.message}\nstderr: ${(error as { stderr?: string }).stderr ?? ''}`
              : String(error);
          throw new Error(`插件链 E2E 子进程未产出结果文件：${detail}`);
        }
      }
      const doc = JSON.parse(readFileSync(outFile, 'utf8')) as {
        fatal: unknown;
        results: Omit<ChainResults, 'fatal'>;
      };
      expect(doc.fatal, `子进程链路级致命错误：${JSON.stringify(doc.fatal)}`).toBeNull();
      const results: ChainResults = { ...doc.results, fatal: doc.fatal };

      // ---- 环 1：install（T1；原子落盘 + 注册表持久化 + plugin:installed） ----
      expect(results.install?.ok).toBe(true);
      const installRecord = results.install!.value!;
      expect(installRecord).toMatchObject({
        id: PROBE.id,
        version: PROBE.version,
        role: 'service',
        state: 'installed',
        source: 'user',
        permissions: ['resources:read'],
        grantedPermissions: [],
      });
      expect(installRecord.path).toBe(join(pluginsRoot, PROBE.id, PROBE.version));
      expect(results.checkpoints.diskAfterInstall).toBe(true);
      expect(results.checkpoints.stateAfterInstall).toBe('installed');
      const persistedAfterInstall = results.checkpoints.registryAfterInstall;
      expect(persistedAfterInstall.version).toBe(1);
      expect(persistedAfterInstall.plugins).toHaveLength(1);
      expect(persistedAfterInstall.plugins[0]).toMatchObject({
        id: PROBE.id,
        version: PROBE.version,
        role: 'service',
        source: 'user',
        enabled: false,
        grantedPermissions: [],
        permissions: ['resources:read'],
      });
      expect(String(persistedAfterInstall.plugins[0]?.hash)).toMatch(/^sha256:[0-9a-f]{64}$/);
      // O1 两口径关系锁定：注册表 `record.hash` 为整包归档摘要，激活期望为装后目录合并
      // 摘要，逐字节不同源（口径区分本身即在册契约，见 `plugin-activation.ts` 头注）；
      // 激活期再锚定期望值 = 装后目录全成员合并摘要复算值。
      expect(String(persistedAfterInstall.plugins[0]?.hash)).not.toBe(mergedHash);
      expect(results.packageHashAfterInstall).toBe(mergedHash);

      // ---- 环 2：enable（T2→Starting→Active；真通道受管求值 + 角色形状） ----
      expect(results.enable?.ok).toBe(true);
      expect(results.enable!.value!.state).toBe('active');
      expect(results.checkpoints.stateAfterEnable).toBe('active');
      expect(results.checkpoints.registryAfterEnable.plugins[0]?.enabled).toBe(true);
      expect(results.activatedEntry).toMatchObject({
        pluginId: PROBE.id,
        version: PROBE.version,
        role: 'service',
      });
      expect(results.activatedEntry!.nonce).toMatch(/^[0-9a-f-]{36}$/);
      expect(results.activatedEntry!.entryUrl).toContain('?chips-nonce=');
      expect(results.activatedEntry!.entryKeys).toEqual(['start', 'stop']);
      expect(results.checkpoints.reportAfterEnable.capabilities.byOwner[PROBE.id]).toBe(1);
      // 插件体真实求值恰好一次（ModuleLoader 门禁内执行）。
      expect(results.checkpoints.globals.starts).toBe(1);
      // service 激活不自动授权：授权快照维持注册表空集（§4.3[3]）。
      expect(results.enable!.value!.grantedPermissions).toEqual([]);

      // ---- 环 3：能力调用（Bridge 会话 → 真实路由 → 插件 handler 真执行） ----
      expect(results.invoke?.ok).toBe(true);
      expect(results.invoke!.value!.ok).toBe(true);
      expect(results.invoke!.value!.result).toEqual({
        pong: invokeToken,
        callerId: 'platform',
        sessionId: 'session:77:main',
        runToken,
        starts: 1,
      });

      // ---- 环 4：事件总线（发布台账序 + 订阅会话投递序双留痕） ----
      expect(results.events.map((entry) => entry.eventId)).toEqual([
        PLUGIN_LIFECYCLE_EVENTS.installed,
        PROBE.readyEvent,
        PLUGIN_LIFECYCLE_EVENTS.loaded,
        PLUGIN_LIFECYCLE_EVENTS.enabled,
        PROBE.stoppedEvent,
        PLUGIN_LIFECYCLE_EVENTS.disabled,
        PLUGIN_LIFECYCLE_EVENTS.unloaded,
        PLUGIN_LIFECYCLE_EVENTS.unloaded,
        PLUGIN_LIFECYCLE_EVENTS.uninstalled,
      ]);
      const ready = results.events.find((entry) => entry.eventId === PROBE.readyEvent);
      expect(ready!.payload).toEqual({ pluginId: PROBE.id, version: PROBE.version, role: 'service' });
      const deliveredByEvent = new Map<string, { windowId: number; envelope: IEventEnvelope }[]>();
      for (const item of results.delivered) {
        const list = deliveredByEvent.get(item.envelope.eventId) ?? [];
        list.push(item);
        deliveredByEvent.set(item.envelope.eventId, list);
      }
      // 订阅会话（window 77）逐事件真收到：生命周期 6 事件 + 插件自定义 2 事件。
      for (const eventId of [
        PLUGIN_LIFECYCLE_EVENTS.installed,
        PLUGIN_LIFECYCLE_EVENTS.loaded,
        PLUGIN_LIFECYCLE_EVENTS.enabled,
        PLUGIN_LIFECYCLE_EVENTS.disabled,
        PLUGIN_LIFECYCLE_EVENTS.unloaded,
        PLUGIN_LIFECYCLE_EVENTS.uninstalled,
        PROBE.readyEvent,
        PROBE.stoppedEvent,
      ]) {
        const items = deliveredByEvent.get(eventId);
        expect(items, `事件 ${eventId} 应经总线投递给订阅会话`).toBeTruthy();
        expect(items!.every((item) => item.windowId === 77)).toBe(true);
        expect(items!.every((item) => typeof item.envelope.emittedAt === 'number')).toBe(true);
      }
      const loadedEnvelope = deliveredByEvent.get(PLUGIN_LIFECYCLE_EVENTS.loaded)!;
      expect(loadedEnvelope[0]?.envelope.payload).toEqual({
        pluginId: PROBE.id,
        version: PROBE.version,
        role: 'service',
      });
      const stoppedEnvelope = deliveredByEvent.get(PROBE.stoppedEvent)!;
      expect(stoppedEnvelope[0]?.envelope.payload).toEqual({ pluginId: PROBE.id, stops: 1 });
      // 链路无失败事件发生：failed 虽已订阅但不得出现。
      expect(deliveredByEvent.get(PLUGIN_LIFECYCLE_EVENTS.failed)).toBeUndefined();

      // ---- 环 5：disable（stop 真执行 + 能力撤销 + T9 落 installed） ----
      expect(results.disable?.ok).toBe(true);
      expect(results.disable!.value!.record.state).toBe('installed');
      expect(results.disable!.value!.stopError).toBeUndefined();
      expect(results.checkpoints.stateAfterDisable).toBe('installed');
      expect(results.checkpoints.registryAfterDisable.plugins[0]?.enabled).toBe(false);
      expect(results.checkpoints.reportAfterDisable.capabilities.byOwner[PROBE.id]).toBeUndefined();
      expect(results.activatedEntryAfterDisable).toBeNull();
      expect(results.checkpoints.globals.stops).toBe(1);
      // 停用后能力已摘除：真实注册表未命中语义（非空壳占位）。
      expect(results.invokeAfterDisable?.ok).toBe(true);
      expect(results.invokeAfterDisable!.value!.ok).toBe(false);
      expect(results.invokeAfterDisable!.value!.error!.code).toBe(BRIDGE_ERROR_CODES.capabilityNotFound);

      // ---- 环 6：uninstall（T12 善后：目录移除 + 注册表清账 + 事件） ----
      expect(results.uninstall?.ok).toBe(true);
      expect(results.checkpoints.diskAfterUninstall).toBe(false);
      expect(results.checkpoints.registryAfterUninstall.plugins).toEqual([]);
      expect(results.checkpoints.listAfterUninstall).toEqual([]);
    },
    200_000,
  );
});

// ---------------------------------------------------------------------------
// 臂 B：vitest 管线现状锁定（通道门禁 fail-closed + 真实事件总线投递 + 卸载善后）
// ---------------------------------------------------------------------------

interface InProcessHarness {
  readonly loader: ICpkPluginLoader;
  readonly registry: IPluginRegistry;
  readonly events: { eventId: string; payload: unknown }[];
  readonly delivered: { windowId: number; envelope: IEventEnvelope }[];
  readonly cleanup: () => Promise<void>;
}

/** 与生产组合根同构的进程内接线（`production-assembly.ts` 缺省臂形态 + 运行时总线）。 */
async function createBusHarness(
  workspace: string,
  subscribe: readonly string[],
): Promise<InProcessHarness> {
  const pluginsRoot = join(workspace, 'plugins');
  await mkdir(pluginsRoot, { recursive: true });
  const registry = await openPluginRegistry({ filePath: join(pluginsRoot, 'registry.json') });
  const trustRoots = createTrustRootRegistryFromDocument(
    JSON.parse(readFileSync(fixtureAsset('keys/trust-roots.json'), 'utf8')) as unknown,
    'chain-e2e',
  );
  const channel = createHostPluginActivationChannel({
    pluginRegistry: registry,
    trustRoots,
    sessionRoot: join(workspace, 'sessions'),
  });
  const events: InProcessHarness['events'] = [];
  const delivered: InProcessHarness['delivered'] = [];
  let loaderRef: ICpkPluginLoader | null = null;
  const runtime: IHostRuntime = createHostRuntime({
    capabilities: [],
    platformRoot: workspace,
    pluginLoaderFactory: (deps) => {
      loaderRef = createCpkPluginLoader({
        pluginsRoot,
        registry,
        hostCapabilityRegistry: deps.hostCapabilityRegistry,
        hostVersion: HOST_VERSION,
        trustRoots,
        activationPortFor: (plugin) => channel.activationPortFor(plugin),
        emitEvent: (eventId, payload) => {
          events.push({ eventId, payload });
          deps.emitEvent(eventId, payload);
        },
      });
      return loaderRef;
    },
  });
  const hostChannel: IPlatformHostChannel = {
    pushSessionPermissions(_windowId: number, _update: ISessionPermissionsUpdate): void {
      // 注入面留痕口：本套件不消费权限快照推送（快照链路已由 host-runtime/preload 套件锁定）。
    },
  };
  // `start` 的 PAL 宿主参数在运行时内不消费（`_host`），仅通道与状态位参与本链路。
  await runtime.start({ info: { appVersion: HOST_VERSION } } as never, hostChannel);
  const sink: IEventSink = {
    deliver: (windowId, envelope) => {
      delivered.push({ windowId, envelope });
    },
  };
  const releaseSink = runtime.forwardEvents(sink);
  const source = { windowId: 77, frameId: null } as const;
  let seq = 0;
  for (const eventId of subscribe) {
    const control = await runtime.ipc.handleEventControl(source, {
      controlId: `b-sub-${(seq += 1)}`,
      action: 'subscribe',
      eventId,
    });
    expect(control.ok).toBe(true);
  }
  if (loaderRef === null) {
    throw new Error('装载器工厂未被调用（组合根接线异常）');
  }
  return {
    loader: loaderRef,
    registry,
    events,
    delivered,
    cleanup: async () => {
      releaseSink();
      await runtime.shutdown();
      channel.dispose();
    },
  };
}

/** 订阅落定（懒建会话）后，注册表未命中语义与生命周期码表在本臂的投影缓存。 */
const APPLY_FAILED = LIFECYCLE_ERROR_CODES.applyFailed;

describe('臂 B：vitest 管线现状锁定（生产通道 × ModuleLoader 通道门禁 fail-closed）', () => {
  it('B1 真签名 app 夹具全链：install→持久化→enable 通道闸拒绝→plugin:failed 经总线送达→failed 卸载善后', async () => {
    const workspace = await makeWorkspace('chips-chain-e2e-b1-');
    const harness = await createBusHarness(workspace, [
      PLUGIN_LIFECYCLE_EVENTS.installed,
      PLUGIN_LIFECYCLE_EVENTS.failed,
      PLUGIN_LIFECYCLE_EVENTS.unloaded,
      PLUGIN_LIFECYCLE_EVENTS.uninstalled,
    ]);
    try {
      // 环 1：install（真实签名 app 夹具、真实信任根文档、真实落盘与持久化）。
      const pkg = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0.cpk'));
      const record = await harness.loader.install({ pkg, source: 'user' });
      expect(record).toMatchObject({
        id: HELLO.id,
        version: HELLO.version,
        role: 'app',
        state: 'installed',
        source: 'user',
      });
      expect(existsSync(record.path)).toBe(true);
      const persisted = harness.registry.get(HELLO.id);
      expect(persisted).toMatchObject({ enabled: false, grantedPermissions: [] });
      expect(harness.events.map((entry) => entry.eventId)).toEqual([PLUGIN_LIFECYCLE_EVENTS.installed]);
      expect(
        harness.delivered.filter((item) => item.envelope.eventId === PLUGIN_LIFECYCLE_EVENTS.installed),
      ).toHaveLength(1);

      // 环 2：enable 走生产激活通道——O1 归档再锚定（目录重放 + Ed25519 再验签）真实通过后，
      // 抵达 ModuleLoader 通道活性门禁；vitest（vite-node）代管 import 时确定性拒装。
      const failure = await captureRejection(harness.loader.enable(HELLO.id));
      expect(failure).toBeInstanceOf(LoaderError);
      const loaderFailure = failure as LoaderError;
      expect(loaderFailure.code).toBe(APPLY_FAILED);
      // details 口径按生产 `assertChannelLive` 现状锁定：通道闸不携带 pluginId
      // （见 `src/loader/module-loader.ts`），插件身份由安装记录 / 注册态 / failed 事件 payload 三处分别断言。
      expect(loaderFailure.details).toEqual({
        stage: 'channel',
        reason: 'not-live',
      });
      expect(harness.loader.get(HELLO.id)).toMatchObject({ state: 'failed' });

      // 环 3：plugin:failed 生命周期事件经真实总线投递给订阅会话（05.05 §4.1 payload）。
      expect(harness.events.map((entry) => entry.eventId)).toEqual([
        PLUGIN_LIFECYCLE_EVENTS.installed,
        PLUGIN_LIFECYCLE_EVENTS.failed,
      ]);
      const failedEvent = harness.events[1]!;
      expect(failedEvent.payload).toMatchObject({
        pluginId: HELLO.id,
        error: {
          code: APPLY_FAILED,
          details: { stage: 'channel', reason: 'not-live' },
        },
      });
      const failedDeliveries = harness.delivered.filter(
        (item) => item.envelope.eventId === PLUGIN_LIFECYCLE_EVENTS.failed,
      );
      expect(failedDeliveries).toHaveLength(1);
      expect(failedDeliveries[0]!.windowId).toBe(77);
      expect(failedDeliveries[0]!.envelope.payload).toEqual(failedEvent.payload);

      // 环 4：failed 态卸载善后（T12）；注册表清账、运行态不持久化维持。
      await harness.loader.uninstall(HELLO.id);
      expect(existsSync(record.path)).toBe(false);
      expect(harness.registry.get(HELLO.id)).toBeUndefined();
      expect(harness.events.map((entry) => entry.eventId)).toEqual([
        PLUGIN_LIFECYCLE_EVENTS.installed,
        PLUGIN_LIFECYCLE_EVENTS.failed,
        PLUGIN_LIFECYCLE_EVENTS.unloaded,
        PLUGIN_LIFECYCLE_EVENTS.uninstalled,
      ]);
    } finally {
      await harness.cleanup();
    }
  });

  it('B2 装后篡改：激活通道再锚定在通道闸前以签名复核拒落（integrity × CPK_SIGNATURE_INVALID）', async () => {
    const workspace = await makeWorkspace('chips-chain-e2e-b2-');
    const pluginsRoot = join(workspace, 'plugins');
    await mkdir(pluginsRoot, { recursive: true });
    const registry = await openPluginRegistry({ filePath: join(pluginsRoot, 'registry.json') });
    const trustRoots = createTrustRootRegistryFromDocument(
      JSON.parse(readFileSync(fixtureAsset('keys/trust-roots.json'), 'utf8')) as unknown,
      'chain-e2e',
    );
    const channel = createHostPluginActivationChannel({
      pluginRegistry: registry,
      trustRoots,
      sessionRoot: join(workspace, 'sessions'),
    });
    const events: { eventId: string; payload: unknown }[] = [];
    const loader = createCpkPluginLoader({
      pluginsRoot,
      registry,
      hostCapabilityRegistry: createHostCapabilityRegistry(),
      hostVersion: HOST_VERSION,
      trustRoots,
      activationPortFor: (plugin) => channel.activationPortFor(plugin),
      emitEvent: (eventId, payload) => {
        events.push({ eventId, payload });
      },
    });
    try {
      const pkg = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0.cpk'));
      const record = await loader.install({ pkg, source: 'user' });
      // 安装后篡改入口文件（真落盘、真篡改）。
      await writeFile(join(record.path, 'dist', 'index.js'), 'export default { tampered: true };\n');
      const failure = await captureRejection(loader.enable(HELLO.id));
      expect(failure).toBeInstanceOf(LoaderError);
      const details = (failure as LoaderError).details as Record<string, unknown>;
      expect((failure as LoaderError).code).toBe(APPLY_FAILED);
      expect(details).toMatchObject({
        pluginId: HELLO.id,
        stage: 'integrity',
        reason: 'signature-reanchor',
        causeCode: CPK_ERROR_CODES.signatureInvalid,
      });
      expect(loader.get(HELLO.id)).toMatchObject({ state: 'failed' });
      expect(events.map((entry) => entry.eventId)).toEqual([
        PLUGIN_LIFECYCLE_EVENTS.installed,
        PLUGIN_LIFECYCLE_EVENTS.failed,
      ]);
      await loader.uninstall(HELLO.id);
      expect(existsSync(record.path)).toBe(false);
    } finally {
      channel.dispose();
    }
  });
});
