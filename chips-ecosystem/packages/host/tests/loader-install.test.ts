/**
 * `.cpk` 安装全链单测（计划书测试面第 2 条的安装段；任务 #56 段二阶段四交付）。
 *
 * 覆盖：正夹具 `hello-0.1.0.cpk` 全链（解包 → 五阶段 → 原子落盘 → 注册表记录 → 事件
 * `plugin:installed`）；同 ID 更新/降级/同版本重复安装拒绝（03.04 §4.2[4]，经开发目录态
 * 构造版本变体）；安装期撤销两表对照（keyId 不在撤销核查表 → `CPK_SIGNATURE_INVALID`）；
 * 失败无残留断言（校验失败不留临时目录、不落盘、不产生注册表记录与事件）。
 *
 * @remarks
 * - 夹具资产（`tests/e2e/fixtures/cpk/`）只读引用；版本变体经开发目录态（`development`
 *   渠道跳过归档与签名两阶段）构造，不改夹具目录。
 * - 错误码一律取自 `codes.ts`（测试内以字面量断言码值，与生成表漂移锁互为印证）；
 *   注册表加载与持久化口径见 `registry.ts`（§3.4）。
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHostCapabilityRegistry } from '../src/runtime/capability/registry.js';
import { LoaderError } from '../src/loader/errors.js';
import { installCpkPackage } from '../src/loader/install.js';
import { createCpkPluginLoader, PLUGIN_LIFECYCLE_EVENTS, type ICpkPluginLoader } from '../src/loader/lifecycle.js';
import { openPluginRegistry } from '../src/loader/registry.js';
import { loadCpkArchive, loadCpkDirectory, type ICpkPackage } from '../src/loader/provider.js';
import {
  createTrustRootRegistry,
  createTrustRootRegistryFromDocument,
  type ITrustRootRegistry,
} from '../src/loader/trust-roots.js';

function fixtureAsset(relative: string): string {
  return fileURLToPath(new URL(`../../../tests/e2e/fixtures/cpk/${relative}`, import.meta.url));
}

const HOST_VERSION = '0.1.0';
const tempRoots: string[] = [];

afterAll(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
});

let trustRoots: ITrustRootRegistry;
let helloArchive: ICpkPackage;
let helloBytes: Buffer;

beforeAll(async () => {
  trustRoots = createTrustRootRegistryFromDocument(
    JSON.parse(readFileSync(fixtureAsset('keys/trust-roots.json'), 'utf8')) as unknown,
    'fixture',
  );
  helloBytes = await readFile(fixtureAsset('packages/hello-0.1.0.cpk'));
  helloArchive = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0.cpk'));
});

interface ILoaderHarness {
  readonly loader: ICpkPluginLoader;
  readonly pluginsRoot: string;
  readonly events: { id: string; payload: unknown }[];
}

async function createHarness(): Promise<ILoaderHarness> {
  const base = await mkdtemp(join(tmpdir(), 'cpk-install-'));
  tempRoots.push(base);
  const pluginsRoot = join(base, 'plugins');
  const registry = await openPluginRegistry({ filePath: join(base, 'registry.json') });
  const events: { id: string; payload: unknown }[] = [];
  const loader = createCpkPluginLoader({
    pluginsRoot,
    registry,
    hostCapabilityRegistry: createHostCapabilityRegistry(),
    emitEvent: (id, payload) => {
      events.push({ id, payload });
    },
    hostVersion: HOST_VERSION,
    trustRoots,
  });
  return { loader, pluginsRoot, events };
}

/** 开发目录态最小 service 插件（跳过归档与签名两阶段）。 */
async function writeServicePluginDirectory(root: string, id: string, version: string): Promise<string> {
  const pluginRoot = join(root, `${id}-${version}`);
  await mkdir(join(pluginRoot, 'dist'), { recursive: true });
  await writeFile(
    join(pluginRoot, 'manifest.yaml'),
    `id: ${id}\nversion: ${version}\ntype: service\nname: 示例服务\nruntime:\n  targets: [host]\n  background: true\n`,
    'utf8',
  );
  await writeFile(join(pluginRoot, 'dist', 'index.js'), 'export const ready = true;\n', 'utf8');
  return pluginRoot;
}

/** 断言插件根目录无任何插件目录与临时残留。 */
async function expectNoResidue(pluginsRoot: string): Promise<void> {
  const rootEntries = await readdir(pluginsRoot).catch(() => [] as string[]);
  expect(rootEntries.filter((name) => name !== '.cpk-install-tmp')).toEqual([]);
  const tempEntries = await readdir(join(pluginsRoot, '.cpk-install-tmp')).catch(() => [] as string[]);
  expect(tempEntries).toEqual([]);
}

describe('正夹具全链安装（解包 → 五阶段 → 原子落盘 → 注册表 → 事件）', () => {
  it('user 渠道安装成功：目录落盘、记录投影与 plugin:installed 事件', async () => {
    const harness = await createHarness();
    const record = await harness.loader.install({ pkg: helloArchive, source: 'user' });
    const expectedTarget = join(harness.pluginsRoot, 'chips.example.hello', '0.1.0');

    expect(record).toMatchObject({
      id: 'chips.example.hello',
      version: '0.1.0',
      role: 'app',
      state: 'installed',
      source: 'user',
      path: expectedTarget,
      hash: `sha256:${createHash('sha256').update(helloBytes).digest('hex')}`,
      dependencies: [],
      permissions: ['command:write', 'notifications:send', 'clipboard:access'],
      grantedPermissions: [],
    });
    expect(record.installedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // 原子落盘：目标目录呈完整包根形态。
    const written = (await readdir(expectedTarget, { recursive: true })).sort();
    expect(written).toContain('manifest.yaml');
    expect(written).toContain('dist/index.js');
    expect(written).toContain('render.js');
    expect(written).toContain('signature.json');
    expect(written).toContain(join('assets', 'icons', 'app.svg'));

    // 注册表记录：安装集合与启用偏好（安装不自动启用，§4.2 规则）。
    expect(harness.loader.get('chips.example.hello')).toMatchObject({
      id: 'chips.example.hello',
      state: 'installed',
    });

    // 事件：plugin:installed（05.05 §4.1 payload）。
    const installedEvents = harness.events.filter((event) => event.id === PLUGIN_LIFECYCLE_EVENTS.installed);
    expect(installedEvents).toHaveLength(1);
    expect(installedEvents[0]?.payload).toEqual({
      pluginId: 'chips.example.hello',
      version: '0.1.0',
    });
  });

  it('同 ID 重复安装（同版本）拒绝：KERNEL_INVALID_TRANSITION（03.04 §4.2[4]）', async () => {
    const harness = await createHarness();
    await harness.loader.install({ pkg: helloArchive, source: 'user' });
    let caught: unknown;
    try {
      await harness.loader.install({ pkg: helloArchive, source: 'user' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoaderError);
    const failure = caught as LoaderError;
    expect(failure.code).toBe('KERNEL_INVALID_TRANSITION');
    expect(failure.details).toMatchObject({
      pluginId: 'chips.example.hello',
      existingVersion: '0.1.0',
      incomingVersion: '0.1.0',
      rule: '03.04 §4.2[4]',
    });
  });

  it('同 ID 降级安装拒绝：开发目录态版本变体（0.1.0 → 0.0.9）', async () => {
    const harness = await createHarness();
    const base = await mkdtemp(join(tmpdir(), 'cpk-variants-'));
    tempRoots.push(base);
    const newer = await loadCpkDirectory(await writeServicePluginDirectory(base, 'chips.example.svc', '0.1.0'));
    const older = await loadCpkDirectory(await writeServicePluginDirectory(base, 'chips.example.svc', '0.0.9'));
    await harness.loader.install({ pkg: newer, source: 'development' });
    let caught: unknown;
    try {
      await harness.loader.install({ pkg: older, source: 'development' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoaderError);
    expect((caught as LoaderError).code).toBe('KERNEL_INVALID_TRANSITION');
    expect((caught as LoaderError).details).toMatchObject({
      pluginId: 'chips.example.svc',
      existingVersion: '0.1.0',
      incomingVersion: '0.0.9',
    });
    // 拒绝后注册表仍只有首个版本，无事件产生。
    expect(harness.loader.list()).toHaveLength(1);
    expect(harness.loader.get('chips.example.svc')?.version).toBe('0.1.0');
    expect(harness.events.filter((event) => event.id === PLUGIN_LIFECYCLE_EVENTS.installed)).toHaveLength(1);
  });
});

describe('安装期撤销与失败无残留', () => {
  it('撤销核查：签名 keyId 不在第二张信任根表 → CPK_SIGNATURE_INVALID（stage=signature）', async () => {
    const base = await mkdtemp(join(tmpdir(), 'cpk-revocation-'));
    tempRoots.push(base);
    const pluginsRoot = join(base, 'plugins');
    const revocationRoots = createTrustRootRegistry([]);
    let caught: unknown;
    try {
      await installCpkPackage(helloArchive, {
        pluginsRoot,
        source: 'user',
        trustRoots,
        revocationRoots,
        hostVersion: HOST_VERSION,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoaderError);
    const failure = caught as LoaderError;
    expect(failure.code).toBe('CPK_SIGNATURE_INVALID');
    expect(failure.details).toMatchObject({
      stage: 'signature',
      keyId: 'chips-fixture-2026',
      table: 'revocationRoots',
    });
    await expectNoResidue(pluginsRoot);
  });

  it('校验失败（篡改签名）无残留：不落盘、不产生注册表记录与事件', async () => {
    const harness = await createHarness();
    const tampered = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0-wrong-signature.cpk'));
    let caught: unknown;
    try {
      await harness.loader.install({ pkg: tampered, source: 'user' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoaderError);
    expect((caught as LoaderError).code).toBe('CPK_SIGNATURE_INVALID');
    expect(harness.loader.list()).toEqual([]);
    await expectNoResidue(harness.pluginsRoot);
    expect(harness.events).toEqual([]);
  });

  it('校验失败（CRC 破坏）无残留：归档阶段即拒绝', async () => {
    const harness = await createHarness();
    let caught: unknown;
    try {
      const crcTampered = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0-crc-tampered.cpk'));
      await harness.loader.install({ pkg: crcTampered, source: 'user' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoaderError);
    expect((caught as LoaderError).code).toBe('CPK_ARCHIVE_INVALID');
    expect(harness.loader.list()).toEqual([]);
    await expectNoResidue(harness.pluginsRoot);
    expect(harness.events).toEqual([]);
  });
});

describe('夹具信任根注入形态（两表对照的对照面）', () => {
  it('信任根注册表含夹具 keyId；未登记 keyId 查找失败', () => {
    expect(trustRoots.find('chips-fixture-2026')).toBeDefined();
    expect(trustRoots.find('chips-revoked-2027')).toBeUndefined();
  });
});
