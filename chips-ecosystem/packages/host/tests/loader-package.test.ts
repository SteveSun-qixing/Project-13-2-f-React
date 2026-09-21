/**
 * `.cpk` 包校验流水线单测（计划书测试面第 2 条的校验段负矩阵子集，任务 #56 段一交付）。
 *
 * 覆盖：正夹具 `hello-0.1.0.cpk` 五阶段全通过（阶段列表、清单归一、签名 keyId、
 * 安装哈希 `sha256:`+整包字节 SHA-256）；三渠道行为（user 缺签=未签名发布者、
 * development 跳过、builtin 必签）；负矩阵逐码——坏 manifest/未知权限→
 * `CPK_MANIFEST_INVALID`、缺 manifest→`CPK_MANIFEST_MISSING`、engines 不满足→
 * `CPK_ENGINE_UNSUPPORTED`、布局错位→`CPK_LAYOUT_INVALID`、缺入口→`CPK_ENTRY_MISSING`、
 * 原生载荷→`CPK_NATIVE_PAYLOAD`、路径穿越→`CPK_PATH_UNSAFE`、超限→`CPK_LIMIT_EXCEEDED`、
 * CRC 破坏→`CPK_ARCHIVE_INVALID`、篡改签名/错误 contentHash/未注册 keyId→
 * `CPK_SIGNATURE_INVALID`（stage=signature）、builtin 缺签→`CPK_SIGNATURE_REQUIRED`。
 *
 * @remarks
 * - 夹具资产（`tests/e2e/fixtures/cpk/`）只读引用，负例的其余变体经内联 ZIP Store
 *   重打包构造（不写盘、不改夹具目录；夹具再生成链归段三）。
 * - 正夹具全链测试（解包 → 原子落盘 → 注册表 → 事件）依赖 `install.ts`/`registry.ts`
 *   （阶段四），归段二交付，本套件不含。
 * - 信任根取夹具注入形态文档（`keys/trust-roots.json`），同时锁定注入面在
 *   校验流水线中的真实消费路径。
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { LoaderError } from '../src/loader/errors.js';
import { loadCpkArchive } from '../src/loader/provider.js';
import { crc32 } from '../src/loader/zip.js';
import { createTrustRootRegistryFromDocument, type ITrustRootRegistry } from '../src/loader/trust-roots.js';
import { validateCpkPackage } from '../src/loader/validate.js';
import type { ICpkPackage } from '../src/loader/provider.js';

function fixtureAsset(relative: string): string {
  return fileURLToPath(new URL(`../../../tests/e2e/fixtures/cpk/${relative}`, import.meta.url));
}

const HOST_VERSION = '0.1.0';

/** 内联 ZIP Store 打包器（与读取面同口径：Store、无 extra、成员按路径字节序）。 */
function buildZipStore(entries: readonly { readonly path: string; readonly data: Uint8Array }[]): Uint8Array {
  const sorted = [...entries].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
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

/** 由（可能被改动的）成员表重建归档态包（归档字节与成员一致）。 */
function pkgFromMembers(members: ReadonlyMap<string, Uint8Array>): ICpkPackage {
  const entries = [...members.entries()].map(([path, data]) => ({ path, data }));
  return { members, mode: 'archive', archiveBytes: buildZipStore(entries) };
}

let trustRoots: ITrustRootRegistry;
let positiveMembers: Map<string, Uint8Array>;

beforeAll(async () => {
  trustRoots = createTrustRootRegistryFromDocument(
    JSON.parse(readFileSync(fixtureAsset('keys/trust-roots.json'), 'utf8')) as unknown,
    'fixture',
  );
  const pkg = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0.cpk'));
  positiveMembers = new Map(pkg.members);
});

/** 以正夹具成员为基础的校验执行（渠道/清单/成员改动均从副本出发）。 */
function validatePositiveVariant(
  overrides: {
    readonly source?: 'builtin' | 'user' | 'development';
    readonly mutate?: (members: Map<string, Uint8Array>) => void;
    readonly hostVersion?: string;
  } = {},
): ReturnType<typeof validateCpkPackage> {
  const members = new Map(positiveMembers);
  overrides.mutate?.(members);
  return validateCpkPackage({
    pkg: pkgFromMembers(members),
    source: overrides.source ?? 'user',
    trustRoots,
    hostVersion: overrides.hostVersion ?? HOST_VERSION,
  });
}

/** 改写 manifest.yaml 文本（成员副本上就地替换）。 */
function withManifest(members: Map<string, Uint8Array>, edit: (text: string) => string): void {
  const manifest = members.get('manifest.yaml');
  if (manifest === undefined) {
    throw new Error('夹具缺少 manifest.yaml');
  }
  members.set('manifest.yaml', new TextEncoder().encode(edit(new TextDecoder('utf-8').decode(manifest))));
}

/** 改写 signature.json 文档字段。 */
function withSignature(members: Map<string, Uint8Array>, edit: (document: Record<string, unknown>) => void): void {
  const signature = members.get('signature.json');
  if (signature === undefined) {
    throw new Error('夹具缺少 signature.json');
  }
  const document = JSON.parse(new TextDecoder('utf-8').decode(signature)) as Record<string, unknown>;
  edit(document);
  members.set('signature.json', new TextEncoder().encode(JSON.stringify(document)));
}

/** 断言流水线按登记码与阶段拒绝，并返回 `details` 供逐例深查。 */
function expectLoaderFailure(action: () => unknown, code: string, stage: string): Record<string, unknown> {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught, `期望抛出 ${code}`).toBeInstanceOf(LoaderError);
  const failure = caught as LoaderError;
  expect(failure.code).toBe(code);
  const details = failure.details as Record<string, unknown>;
  expect(details.stage, `失败阶段归属应包含 ${stage} 或失败前阶段`).toBeTypeOf('string');
  expect(Array.isArray(details.stages), '失败应携带已收集阶段列表').toBe(true);
  return details;
}

describe('正夹具全链校验（五阶段通过）', () => {
  it('user 渠道：archive/layout/manifest/signature/hash 全通过，安装哈希为整包字节摘要', async () => {
    const pkg = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0.cpk'));
    const result = validateCpkPackage({
      pkg,
      source: 'user',
      trustRoots,
      hostVersion: HOST_VERSION,
    });
    expect(result.stages.map((entry) => [entry.stage, entry.status])).toEqual([
      ['archive', 'passed'],
      ['layout', 'passed'],
      ['manifest', 'passed'],
      ['signature', 'passed'],
      ['hash', 'passed'],
    ]);
    expect(result.signature).toEqual({
      status: 'passed',
      detail: 'keyId: chips-fixture-2026',
      keyId: 'chips-fixture-2026',
    });
    expect(result.manifest).toMatchObject({
      id: 'chips.example.hello',
      version: '0.1.0',
      role: 'app',
      name: '你好世界',
      permissions: ['command:write', 'notifications:send', 'clipboard:access'],
      dependencies: [],
    });
    const fileBytes = readFileSync(fixtureAsset('packages/hello-0.1.0.cpk'));
    expect(result.installHash).toBe(`sha256:${createHash('sha256').update(fileBytes).digest('hex')}`);
    expect(result.warnings).toEqual([]);
  });

  it('builtin 渠道：夹具信任根内 keyId 验签通过', () => {
    const result = validatePositiveVariant({ source: 'builtin' });
    expect(result.signature.status).toBe('passed');
  });

  it('development 渠道：签名阶段跳过（不检查签名）', () => {
    const result = validatePositiveVariant({ source: 'development' });
    expect(result.signature.status).toBe('skipped');
    expect(result.stages.find((entry) => entry.stage === 'signature')?.status).toBe('skipped');
  });

  it('user 渠道缺签：判定未签名发布者并给出安装前确认告警', () => {
    const result = validatePositiveVariant({
      mutate: (members) => {
        members.delete('signature.json');
      },
    });
    expect(result.signature).toMatchObject({ status: 'skipped', unsignedPublisher: true });
    expect(result.warnings).toContain('未签名发布者：安装需要用户确认');
  });
});

describe('校验段负矩阵（逐码）', () => {
  it('CRC 破坏 → CPK_ARCHIVE_INVALID（stage=archive）', async () => {
    let caught: unknown;
    try {
      await loadCpkArchive(fixtureAsset('packages/hello-0.1.0-crc-tampered.cpk'));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoaderError);
    expect((caught as LoaderError).code).toBe('CPK_ARCHIVE_INVALID');
    expect((caught as LoaderError).details).toMatchObject({ stage: 'archive' });
  });

  it('坏 manifest（反向域名违例夹具）→ CPK_MANIFEST_INVALID（stage=manifest）', async () => {
    const pkg = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0-bad-manifest.cpk'));
    const details = expectLoaderFailure(
      () => validateCpkPackage({ pkg, source: 'user', trustRoots, hostVersion: HOST_VERSION }),
      'CPK_MANIFEST_INVALID',
      'manifest',
    );
    expect(details.stage).toBe('manifest');
  });

  it('未知权限 → CPK_MANIFEST_INVALID（pointer=permissions[3]）', () => {
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          mutate: (members) => {
            withManifest(members, (text) =>
              text.replace('  - clipboard:access\n', '  - clipboard:access\n  - totally:unknown\n'),
            );
          },
        }),
      'CPK_MANIFEST_INVALID',
      'manifest',
    );
    expect(details.stage).toBe('manifest');
    expect(details.pointer).toBe('permissions[3]');
  });

  it('缺 manifest → CPK_MANIFEST_MISSING（stage=manifest）', () => {
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          mutate: (members) => {
            members.delete('manifest.yaml');
          },
        }),
      'CPK_MANIFEST_MISSING',
      'manifest',
    );
    expect(details.stage).toBe('manifest');
  });

  it('engines.chips 不满足 → CPK_ENGINE_UNSUPPORTED（stage=manifest）', () => {
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          hostVersion: '0.1.0',
          mutate: (members) => {
            withManifest(members, (text) =>
              text.replace('permissions:', 'engines:\n  chips: ">=99.0.0"\npermissions:'),
            );
          },
        }),
      'CPK_ENGINE_UNSUPPORTED',
      'manifest',
    );
    expect(details.stage).toBe('manifest');
    expect(details.pointer).toBe('engines.chips');
  });

  it('布局错位（包根白名单外条目）→ CPK_LAYOUT_INVALID（stage=layout）', () => {
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          mutate: (members) => {
            members.set('README.md', new TextEncoder().encode('# 包根白名单外条目\n'));
          },
        }),
      'CPK_LAYOUT_INVALID',
      'layout',
    );
    expect(details.stage).toBe('layout');
    expect(details.file).toBe('README.md');
  });

  it('缺入口 → CPK_ENTRY_MISSING（stage=layout）', () => {
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          mutate: (members) => {
            members.delete('dist/index.js');
          },
        }),
      'CPK_ENTRY_MISSING',
      'layout',
    );
    expect(details.stage).toBe('layout');
    expect(details.file).toBe('dist/index.js');
  });

  it('原生载荷（.node 扩展名成员）→ CPK_NATIVE_PAYLOAD（stage=layout）', () => {
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          mutate: (members) => {
            members.set('dist/native.node', new TextEncoder().encode('伪装成文本的原生载荷\n'));
          },
        }),
      'CPK_NATIVE_PAYLOAD',
      'layout',
    );
    expect(details.stage).toBe('layout');
    expect(details.file).toBe('dist/native.node');
  });

  it('原生载荷（PE 魔数内容、非扩展名命中）→ CPK_NATIVE_PAYLOAD（stage=layout）', () => {
    const peBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          mutate: (members) => {
            members.set('dist/blob.bin', peBytes);
          },
        }),
      'CPK_NATIVE_PAYLOAD',
      'layout',
    );
    expect(details.stage).toBe('layout');
    expect(details.file).toBe('dist/blob.bin');
  });

  it('路径穿越 → CPK_PATH_UNSAFE（stage=archive）', () => {
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          mutate: (members) => {
            members.set('../evil.txt', new TextEncoder().encode('穿越\n'));
          },
        }),
      'CPK_PATH_UNSAFE',
      'archive',
    );
    expect(details.stage).toBe('archive');
    expect(details.file).toBe('../evil.txt');
  });

  it('超限（成员路径超 180 字符）→ CPK_LIMIT_EXCEEDED（stage=archive）', () => {
    const longName = `${'seg-'}${'x'.repeat(200)}.txt`;
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          mutate: (members) => {
            members.set(longName, new TextEncoder().encode('超限\n'));
          },
        }),
      'CPK_LIMIT_EXCEEDED',
      'archive',
    );
    expect(details.stage).toBe('archive');
    expect(details.file).toBe(longName);
  });

  it('篡改签名（伪造私钥冒用 keyId 夹具）→ CPK_SIGNATURE_INVALID（stage=signature）', async () => {
    const pkg = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0-wrong-signature.cpk'));
    const details = expectLoaderFailure(
      () => validateCpkPackage({ pkg, source: 'user', trustRoots, hostVersion: HOST_VERSION }),
      'CPK_SIGNATURE_INVALID',
      'signature',
    );
    expect(details.stage).toBe('signature');
    expect(details.keyId).toBe('chips-fixture-2026');
    // 失败前阶段（archive/layout/manifest）应已按通过记录。
    const collected = details.stages as { stage: string; status: string }[];
    expect(collected.map((entry) => entry.stage)).toEqual(['archive', 'layout', 'manifest']);
  });

  it('错误 contentHash → CPK_SIGNATURE_INVALID（摘要重算不一致）', () => {
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          mutate: (members) => {
            withSignature(members, (document) => {
              document.contentHash = `sha256:${'0'.repeat(64)}`;
            });
          },
        }),
      'CPK_SIGNATURE_INVALID',
      'signature',
    );
    expect(details.stage).toBe('signature');
    expect(details.expected).toBe(`sha256:${'0'.repeat(64)}`);
    expect(details.actual).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('未注册 keyId → CPK_SIGNATURE_INVALID（信任根查找失败）', () => {
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          mutate: (members) => {
            withSignature(members, (document) => {
              document.keyId = 'chips-revoked-2027';
            });
          },
        }),
      'CPK_SIGNATURE_INVALID',
      'signature',
    );
    expect(details.stage).toBe('signature');
    expect(details.keyId).toBe('chips-revoked-2027');
  });

  it('builtin 缺签 → CPK_SIGNATURE_REQUIRED（stage=signature）', () => {
    const details = expectLoaderFailure(
      () =>
        validatePositiveVariant({
          source: 'builtin',
          mutate: (members) => {
            members.delete('signature.json');
          },
        }),
      'CPK_SIGNATURE_REQUIRED',
      'signature',
    );
    expect(details.stage).toBe('signature');
  });
});
