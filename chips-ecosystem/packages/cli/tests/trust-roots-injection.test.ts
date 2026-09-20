/**
 * 信任根注入面（工单019/020 收口，[CLI 完整参考] §2.7、[插件包格式] §6.3）：
 * `loadTrustRootsFile` 严格 schema、命令面 `CHIPS_TRUST_ROOTS_FILE` 接线、
 * 真实夹具内容的命令端正/负/未注入三态，与目录态源码工程前置诊断（§2.7 包根形态口径）。
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createLocalArtifacts } from '../src/artifacts/index.js';
import { loadTrustRootsFile, TRUST_ROOTS_ENV } from '../src/artifacts/trust-roots.js';
import { createLocalClient } from '../src/runtime/local-client.js';
import { createDocumentedPermissionCatalog } from '../src/artifacts/permission-catalog.js';
import { exitCodeForError, ChipsError } from '../src/errors.js';
import type { IFileSystemPort } from '../src/args/filesystem.js';
import { FakeCliClient } from './support/fake-client.js';
import { MemoryFileSystem } from './support/memory-file-system.js';
import { runDev, runUser } from './support/harness.js';

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

/** 仓库夹具根（只读消费，禁改面）。 */
const fixtureUrl = (relative: string): URL =>
  new URL(`../../../tests/e2e/fixtures/cpk/${relative}`, import.meta.url);

function fixtureBytes(relative: string): Uint8Array {
  return new Uint8Array(readFileSync(fixtureUrl(relative)));
}

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

/** 包根形态目录（[插件包格式] §2.7：与 .cpk 解包后的包根一致，无 package.json）。 */
function packageRootDirectory(): MemoryFileSystem {
  const fileSystem = new MemoryFileSystem();
  fileSystem.writeBinary('/staged/manifest.yaml', text(BASECARD_MANIFEST));
  fileSystem.writeBinary('/staged/dist/index.js', text('export default { activate() {} };\n'));
  fileSystem.writeBinary('/staged/render.js', text('export function render() { return null; }\n'));
  fileSystem.writeBinary(
    '/staged/assets/icons/hello.svg',
    text('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  );
  return fileSystem;
}

function expectError(action: () => unknown): ChipsError {
  try {
    action();
  } catch (error) {
    return error as ChipsError;
  }
  throw new Error('预期抛出错误');
}

describe('信任注册文件加载（loadTrustRootsFile，§2.7）', () => {
  function registryFile(json: string): IFileSystemPort {
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/k.json', json);
    return fileSystem;
  }

  it('环境变量名常量与文档登记一致', () => {
    expect(TRUST_ROOTS_ENV).toBe('CHIPS_TRUST_ROOTS_FILE');
  });

  it('合法注册文件解析为 keyId → SPKI PEM 表', () => {
    const trustRoots = loadTrustRootsFile(
      registryFile(
        JSON.stringify({
          version: 1,
          description: '测试注册表',
          trustRoots: { 'chips-test': '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----' },
        })
      ),
      '/k.json'
    );
    expect(Object.keys(trustRoots)).toEqual(['chips-test']);
  });

  it('description 可缺省、trustRoots 可为空表（全部 keyId 未注册）', () => {
    expect(
      loadTrustRootsFile(registryFile(JSON.stringify({ version: 1, trustRoots: {} })), '/k.json')
    ).toEqual({});
  });

  it('文件缺失 CLI_PATH_NOT_FOUND（退出码 5）、非文件 CLI_PATH_INVALID', () => {
    const missing = expectError(() => loadTrustRootsFile(new MemoryFileSystem(), '/k.json'));
    expect(missing.code).toBe('CLI_PATH_NOT_FOUND');
    expect(exitCodeForError(missing)).toBe(5);
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeDirectory('/keys');
    expect(expectError(() => loadTrustRootsFile(fileSystem, '/keys')).code).toBe(
      'CLI_PATH_INVALID'
    );
  });

  it('非法 JSON、version 非 1、未知顶层字段、trustRoots 结构非法均 CLI_ARGUMENT_INVALID（退出码 2）', () => {
    for (const json of [
      '{坏 JSON',
      '"不是对象"',
      JSON.stringify({ version: '1', trustRoots: {} }),
      JSON.stringify({ version: 2, trustRoots: {} }),
      JSON.stringify({ version: 1, trustRoots: {}, extra: true }),
      JSON.stringify({ version: 1, description: 7, trustRoots: {} }),
      JSON.stringify({ version: 1, trustRoots: [] }),
      JSON.stringify({ version: 1, trustRoots: { '': 'pem' } }),
      JSON.stringify({ version: 1, trustRoots: { k: 42 } }),
      JSON.stringify({ version: 1, trustRoots: { k: '' } }),
    ]) {
      const error = expectError(() => loadTrustRootsFile(registryFile(json), '/k.json'));
      expect(error.code, json).toBe('CLI_ARGUMENT_INVALID');
      expect(exitCodeForError(error), json).toBe(2);
    }
  });
});

describe('命令面注入接线（validateCommand → CHIPS_TRUST_ROOTS_FILE）', () => {
  it('环境变量非空时以 trustRootsFile 透传给产物引擎', async () => {
    const client = new FakeCliClient();
    const outcome = await runUser(['plugin', 'validate', 'dist/hello.cpk'], {
      client,
      env: { [TRUST_ROOTS_ENV]: '/keys/trust-roots.json' },
    });
    expect(outcome.exitCode).toBe(0);
    expect(client.calls).toContain(
      'artifacts.validate:/work/dist/hello.cpk:user:trust=/keys/trust-roots.json'
    );
  });

  it('未设置或空串按未注入处理（不产生 trustRootsFile 透传）', async () => {
    const unset = new FakeCliClient();
    await runUser(['plugin', 'validate', 'dist/hello.cpk'], { client: unset });
    expect(unset.calls).toContain('artifacts.validate:/work/dist/hello.cpk:user');

    const empty = new FakeCliClient();
    await runUser(['plugin', 'validate', 'dist/hello.cpk'], {
      client: empty,
      env: { [TRUST_ROOTS_ENV]: '' },
    });
    expect(empty.calls).toContain('artifacts.validate:/work/dist/hello.cpk:user');
  });

  it('开发入口同样透传注入通道', async () => {
    const client = new FakeCliClient();
    await runDev(['plugin', 'validate', 'dist/hello.cpk'], {
      client,
      env: { [TRUST_ROOTS_ENV]: '/keys/trust-roots.json' },
    });
    expect(
      client.calls.some(
        (call) =>
          call.startsWith('artifacts.validate:') &&
          call.endsWith(':development:trust=/keys/trust-roots.json')
      )
    ).toBe(true);
  });
});

describe('命令面真实夹具三态（正例注入 / 负例错误码 / 未注入）', () => {
  /** 把仓库夹具装载进内存文件系统（内容只读消费）。 */
  function fixtureFileSystem(): MemoryFileSystem {
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeBinary('/fixtures/trust-roots.json', fixtureBytes('keys/trust-roots.json'));
    fileSystem.writeBinary('/fixtures/hello-0.1.0.cpk', fixtureBytes('packages/hello-0.1.0.cpk'));
    fileSystem.writeBinary(
      '/fixtures/hello-0.1.0-wrong-signature.cpk',
      fixtureBytes('packages/hello-0.1.0-wrong-signature.cpk')
    );
    fileSystem.writeBinary(
      '/fixtures/hello-0.1.0-bad-manifest.cpk',
      fixtureBytes('packages/hello-0.1.0-bad-manifest.cpk')
    );
    fileSystem.writeBinary(
      '/fixtures/hello-0.1.0-crc-tampered.cpk',
      fixtureBytes('packages/hello-0.1.0-crc-tampered.cpk')
    );
    return fileSystem;
  }

  const injectedEnv = { [TRUST_ROOTS_ENV]: '/fixtures/trust-roots.json' };

  it('注入夹具信任根后正夹具 EXIT=0 且签名阶段通过（keyId 判定与库面同源）', async () => {
    const outcome = await runUser(['plugin', 'validate', '/fixtures/hello-0.1.0.cpk'], {
      client: createLocalClient(),
      fileSystem: fixtureFileSystem(),
      env: injectedEnv,
    });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('签名校验: 通过（keyId: chips-fixture-2026）');
    expect(outcome.stdout).toContain('摘要校验: 通过');
    expect(outcome.stdout).toContain('结果: valid');
  });

  it('负夹具逐件按期望错误码拒绝（EXIT=1）', async () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['/fixtures/hello-0.1.0-wrong-signature.cpk', 'CPK_SIGNATURE_INVALID'],
      ['/fixtures/hello-0.1.0-bad-manifest.cpk', 'CPK_MANIFEST_INVALID'],
      ['/fixtures/hello-0.1.0-crc-tampered.cpk', 'CPK_ARCHIVE_INVALID'],
    ];
    for (const [path, code] of cases) {
      const outcome = await runUser(['plugin', 'validate', path], {
        client: createLocalClient(),
        fileSystem: fixtureFileSystem(),
        env: injectedEnv,
      });
      expect(outcome.exitCode, path).toBe(1);
      expect((outcome.json() as { code: string }).code, path).toBe(code);
    }
  });

  it('未注入信任根时已签名包按"信任根未注册"拒绝（EXIT=1，签名无效语义）', async () => {
    const outcome = await runUser(['plugin', 'validate', '/fixtures/hello-0.1.0.cpk'], {
      client: createLocalClient(),
      fileSystem: fixtureFileSystem(),
    });
    expect(outcome.exitCode).toBe(1);
    const payload = outcome.json() as { code: string; error: string };
    expect(payload.code).toBe('CPK_SIGNATURE_INVALID');
    expect(payload.error).toContain('信任根未注册的 keyId');
  });

  it('注入文件缺失时 CLI_PATH_NOT_FOUND（EXIT=5），不静默放行', async () => {
    const outcome = await runUser(['plugin', 'validate', '/fixtures/hello-0.1.0.cpk'], {
      client: createLocalClient(),
      fileSystem: fixtureFileSystem(),
      env: { [TRUST_ROOTS_ENV]: '/fixtures/missing.json' },
    });
    expect(outcome.exitCode).toBe(5);
    expect((outcome.json() as { code: string }).code).toBe('CLI_PATH_NOT_FOUND');
  });

  it('trustRootsFile 输入覆盖构造期 trustRoots（单源判定，无第二套逻辑）', async () => {
    const fileSystem = fixtureFileSystem();
    const artifacts = createLocalArtifacts({
      catalog: createDocumentedPermissionCatalog(),
      trustRoots: { 'bogus-key': '-----BEGIN PUBLIC KEY-----\nnope\n-----END PUBLIC KEY-----' },
    });
    await expect(
      artifacts.validate({
        path: '/fixtures/hello-0.1.0.cpk',
        source: 'user',
        trustRootsFile: '/fixtures/trust-roots.json',
        fileSystem,
      })
    ).resolves.toMatchObject({ valid: true });
    await expect(
      artifacts.validate({
        path: '/fixtures/hello-0.1.0.cpk',
        source: 'user',
        fileSystem,
      })
    ).rejects.toMatchObject({ code: 'CPK_SIGNATURE_INVALID' });
  });
});

describe('目录态包根口径（工单020 缺陷②，[插件包格式] §2.7）', () => {
  it('源码工程目录（根级 package.json）先拒并给出打包指引', async () => {
    const fileSystem = packageRootDirectory();
    fileSystem.writeBinary('/staged/package.json', text('{"version":"1.0.0"}'));
    const outcome = await runUser(['plugin', 'validate', '/staged'], {
      client: createLocalClient(),
      fileSystem,
    });
    expect(outcome.exitCode).toBe(1);
    const payload = outcome.json() as { code: string; error: string };
    expect(payload.code).toBe('CPK_LAYOUT_INVALID');
    expect(payload.error).toContain('源码工程');
    expect(payload.error).toContain('chips plugin pack');
  });

  it('包根形态目录（无 package.json）目录态通过：归档/签名/摘要阶段按目录语义跳过', async () => {
    const outcome = await runUser(['plugin', 'validate', '/staged'], {
      client: createLocalClient(),
      fileSystem: packageRootDirectory(),
    });
    expect(outcome.exitCode, `${outcome.stdout}\n${outcome.stderr}`).toBe(0);
    expect(outcome.stdout).toContain('归档校验: 已跳过');
    expect(outcome.stdout).toContain('结构校验: 通过');
    expect(outcome.stdout).toContain('摘要校验: 已跳过');
  });

  it('尾斜杠目录同样按包根口径处理', async () => {
    const fileSystem = packageRootDirectory();
    fileSystem.writeBinary('/staged/package.json', text('{"version":"1.0.0"}'));
    const outcome = await runUser(['plugin', 'validate', '/staged/'], {
      client: createLocalClient(),
      fileSystem,
    });
    expect(outcome.exitCode, `${outcome.stdout}\n${outcome.stderr}`).toBe(1);
    expect((outcome.json() as { code: string }).code).toBe('CPK_LAYOUT_INVALID');
  });
});
