/**
 * 本地运行时组装与本地产物引擎（[CLI 完整参考] §2.5、§3.5；[插件包格式] §7.1；
 * [SDK API 规范] §8.1、§8.3）：离线可用的 `plugin create|pack|validate`，
 * 平台链路缺失时的 `CLI_TARGET_UNAVAILABLE`。
 */

import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { IFileSystemPort } from '../src/args/filesystem.js';
import { createLocalArtifacts } from '../src/artifacts/index.js';
import { createDocumentedPermissionCatalog } from '../src/artifacts/permission-catalog.js';
import {
  resolveScaffoldProvider,
  writeScaffoldPlan,
  type IScaffoldProvider,
} from '../src/artifacts/scaffold.js';
import { createLocalClient } from '../src/runtime/local-client.js';
import type { IScaffoldPlan } from '../src/client/types.js';
import { MemoryFileSystem } from './support/memory-file-system.js';

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

const BASECARD_MANIFEST = [
  'id: chips.basecard.hello',
  'version: 1.0.0',
  'type: basecard',
  'name: 你好卡片',
  'description: 演示基础卡片插件',
  'runtime:',
  '  targets: [host]',
  'capabilities:',
  '  cardTypes:',
  '    - id: base.richtext',
  '      name: 富文本卡片',
  '      icon: assets/icons/hello.svg',
  '',
].join('\n');

/** 合法的基础卡片源码目录（[插件包格式] §2.2、§三）。 */
function stageSource(root = '/src/hello', manifest: string = BASECARD_MANIFEST): IFileSystemPort {
  const fileSystem = new MemoryFileSystem();
  fileSystem.writeBinary(`${root}/manifest.yaml`, text(manifest));
  fileSystem.writeBinary(`${root}/dist/index.js`, text('export default { activate() {} };\n'));
  fileSystem.writeBinary(`${root}/render.js`, text('export function render() { return null; }\n'));
  fileSystem.writeBinary(`${root}/assets/icons/hello.svg`, text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
  return fileSystem;
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const PLAN: IScaffoldPlan = {
  targetDir: '/out/demo',
  files: [
    { path: 'manifest.yaml', content: BASECARD_MANIFEST },
    { path: 'src/index.tsx', content: 'export default {};\n' },
  ],
  manifest: { id: 'chips.demo.app', version: '0.1.0', type: 'app', name: '示例' },
};

function providerOf(plan: IScaffoldPlan): IScaffoldProvider & { inputs: unknown[] } {
  const inputs: unknown[] = [];
  return {
    inputs,
    createPlan: (options) => {
      inputs.push(options);
      return plan;
    },
  };
}

describe('脚手架落盘（§3.5.1）', () => {
  it('目标目录为空时按计划写盘并返回相对路径清单', () => {
    const fileSystem = new MemoryFileSystem();
    const written = writeScaffoldPlan(fileSystem, PLAN);
    expect(written).toEqual({ targetDir: '/out/demo', files: ['manifest.yaml', 'src/index.tsx'] });
    expect(fileSystem.readText('/out/demo/manifest.yaml')).toBe(BASECARD_MANIFEST);
    expect(fileSystem.readText('/out/demo/src/index.tsx')).toBe('export default {};\n');
  });

  it('目标目录非空、目标不是目录与目标文件已存在均返回 CLI_PATH_INVALID', () => {
    function expectPathInvalid(fileSystem: IFileSystemPort, plan: IScaffoldPlan, message: RegExp): void {
      try {
        writeScaffoldPlan(fileSystem, plan);
        throw new Error('预期拒绝落盘');
      } catch (error) {
        expect((error as { code?: string }).code).toBe('CLI_PATH_INVALID');
        expect((error as Error).message).toMatch(message);
      }
    }

    const occupied = new MemoryFileSystem();
    occupied.writeText('/out/demo/其它.txt', 'x');
    expectPathInvalid(occupied, PLAN, /目标目录非空/);

    const notDirectory = new MemoryFileSystem();
    notDirectory.writeText('/out/demo', '我是一个文件');
    expectPathInvalid(notDirectory, PLAN, /目标路径不是目录/);

    const escaping = new MemoryFileSystem();
    escaping.writeText('/out/other.yaml', '已存在的同名文件');
    expectPathInvalid(
      escaping,
      { ...PLAN, files: [{ path: '../other.yaml', content: 'x' }] },
      /目标文件已存在：\/out\/other\.yaml/,
    );
  });
});

describe('本地产物引擎（§3.5 离线可用）', () => {
  it('create 以注入的脚手架生成器落盘并回传插件身份', async () => {
    const provider = providerOf(PLAN);
    const fileSystem = new MemoryFileSystem();
    const artifacts = createLocalArtifacts({ scaffoldProvider: provider });
    const result = await artifacts.create({ role: 'app', pluginId: 'chips.demo.app', name: '示例', dir: '/out/demo', fileSystem });
    expect(result).toEqual({ pluginId: 'chips.demo.app', role: 'app', targetDir: '/out/demo', files: ['manifest.yaml', 'src/index.tsx'] });
    expect(provider.inputs).toEqual([{ role: 'app', pluginId: 'chips.demo.app', name: '示例', targetDir: '/out/demo' }]);
    expect(fileSystem.kind('/out/demo/src')).toBe('directory');
  });

  it('SDK 脚手架子路径未导出时 create 返回 CLI_TARGET_UNAVAILABLE', async () => {
    // 对应开发日志遗留项：`@chips/sdk` 的 exports 目前只有 `.` 与 `./testing`，
    // 未落地 `./scaffold`；解析失败必须显式失败而不是静默降级。
    expect(await resolveScaffoldProvider()).toBeUndefined();
    const artifacts = createLocalArtifacts();
    await expect(
      artifacts.create({ role: 'app', pluginId: 'chips.demo.app', name: '示例', dir: '/out/demo', fileSystem: new MemoryFileSystem() }),
    ).rejects.toMatchObject({ code: 'CLI_TARGET_UNAVAILABLE' });
  });

  it('pack 产物可被同一引擎 validate 通过（未签名跳过签名阶段）', async () => {
    const fileSystem = stageSource();
    const artifacts = createLocalArtifacts({ catalog: createDocumentedPermissionCatalog() });
    const packed = await artifacts.pack({ dir: '/src/hello', sign: false, fileSystem });
    expect(packed.role).toBe('basecard');
    expect(packed.memberCount).toBe(4);
    expect(packed.signed).toBe(false);
    expect(packed.archivePath).toBe('/src/hello/dist/hello-1.0.0.cpk');
    const validated = await artifacts.validate({ path: packed.archivePath, source: 'user', fileSystem });
    expect(validated.valid).toBe(true);
    expect(validated.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['archive', 'passed'],
      ['layout', 'passed'],
      ['manifest', 'passed'],
      ['signature', 'skipped'],
      ['hash', 'passed'],
    ]);
  });

  it('pack 指定输出目录与缺失源码目录时按引擎语义返回', async () => {
    const fileSystem = stageSource();
    const artifacts = createLocalArtifacts();
    const packed = await artifacts.pack({ dir: '/src/hello', out: '/release', sign: false, fileSystem });
    expect(packed.archivePath).toBe('/release/hello-1.0.0.cpk');
    expect(fileSystem.kind('/release')).toBe('directory');
    expect(fileSystem.exists('/release/hello-1.0.0.cpk')).toBe(true);
    const missing = new MemoryFileSystem();
    await expect(artifacts.pack({ dir: '/src/nothing', sign: false, fileSystem: missing })).rejects.toMatchObject({
      code: 'CLI_PATH_INVALID',
    });
  });

  it('引擎透传信任根：签名产物在 builtin 来源下五阶段全部通过', async () => {
    const fileSystem = stageSource();
    fileSystem.writeText('/keys/chips-test.pem', PRIVATE_PEM);
    const artifacts = createLocalArtifacts({ trustRoots: { 'chips-test': PUBLIC_PEM } });
    const packed = await artifacts.pack({
      dir: '/src/hello',
      sign: true,
      keyId: 'chips-test',
      signingKeyFile: '/keys/chips-test.pem',
      fileSystem,
    });
    expect(packed.signed).toBe(true);
    expect(packed.memberCount).toBe(5);
    const validated = await artifacts.validate({ path: packed.archivePath, source: 'builtin', fileSystem });
    expect(validated.stages.map((stage) => `${stage.stage}:${stage.status}`)).toEqual([
      'archive:passed',
      'layout:passed',
      'manifest:passed',
      'signature:passed',
      'hash:passed',
    ]);
  });

  it('validate 透传 platformVersion 使 engines.chips 门禁生效', async () => {
    const gated = '>=2.0.0';
    const fileSystem = stageSource('/src/gated', BASECARD_MANIFEST.replace('runtime:', `engines:\n  chips: "${gated}"\nruntime:`));
    const artifacts = createLocalArtifacts();
    const packed = await artifacts.pack({ dir: '/src/gated', sign: false, fileSystem });
    await expect(
      artifacts.validate({ path: packed.archivePath, source: 'user', platformVersion: '1.0.0', fileSystem }),
    ).rejects.toMatchObject({ code: 'CPK_ENGINE_UNSUPPORTED', details: { pointer: 'engines.chips' } });
    await expect(
      artifacts.validate({ path: packed.archivePath, source: 'user', platformVersion: '2.1.0', fileSystem }),
    ).resolves.toMatchObject({ valid: true });
  });
});

describe('本地客户端组装（§2.5 无承载环境）', () => {
  it('缺省 invoker 时平台路由显式失败并带上路由 ID', async () => {
    const client = createLocalClient();
    await expect(client.cliCommand.list()).rejects.toMatchObject({
      code: 'CLI_TARGET_UNAVAILABLE',
      details: { route: 'cli.command.list' },
    });
    await expect(client.commands.invoke({ commandId: 'demo.open' })).rejects.toMatchObject({
      code: 'CLI_TARGET_UNAVAILABLE',
    });
    await expect(client.platform.version()).rejects.toMatchObject({ code: 'CLI_TARGET_UNAVAILABLE' });
    await expect(client.apps.ensureRunning({ pluginId: 'chips.demo.app' })).rejects.toMatchObject({
      code: 'CLI_TARGET_UNAVAILABLE',
    });
  });

  it('缺省组装下本地产物引擎仍离线可用', async () => {
    const fileSystem = stageSource();
    const client = createLocalClient();
    const packed = await client.artifacts.pack({ dir: '/src/hello', sign: false, fileSystem });
    expect(packed.digest).toMatch(/^sha256:/);
    await expect(client.artifacts.validate({ path: packed.archivePath, source: 'user', fileSystem })).resolves.toMatchObject({
      valid: true,
    });
  });

  it('注入承载适配器后路由、应用启动与开发宿主全部委托适配器', async () => {
    const seen: string[] = [];
    const client = createLocalClient({
      invoker: {
        request: async <T>(id: string): Promise<T> => {
          seen.push(id);
          return { index: {}, commands: [] } as unknown as T;
        },
      },
      apps: {
        ensureRunning: async (input) => {
          seen.push(`apps.ensureRunning:${input.pluginId}`);
        },
      },
      devHost: {
        runPlugin: async (input) => {
          seen.push(`devHost.runPlugin:${input.dir}`);
          return { started: true };
        },
      },
      scaffoldProvider: providerOf(PLAN),
    });
    await expect(client.cliCommand.list()).resolves.toEqual({ index: {}, commands: [] });
    await client.apps.ensureRunning({ pluginId: 'chips.demo.app' });
    await expect(client.devHost.runPlugin({ dir: '/p', workspace: '/ws' })).resolves.toEqual({ started: true });
    expect(seen).toEqual([
      'cli.command.list',
      'apps.ensureRunning:chips.demo.app',
      'devHost.runPlugin:/p',
    ]);
    // 未注入平台适配器时不因其它适配器存在而放宽：仍显式失败（§2.5）。
    await expect(client.platform.version()).rejects.toMatchObject({
      code: 'CLI_TARGET_UNAVAILABLE',
      details: { method: 'platform.version' },
    });
    await expect(
      client.artifacts.create({ role: 'app', pluginId: 'chips.demo.app', name: '示例', dir: '/out/demo', fileSystem: new MemoryFileSystem() }),
    ).resolves.toMatchObject({ targetDir: '/out/demo' });
  });
});
