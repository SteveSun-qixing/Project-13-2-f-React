/**
 * 信任根注册表单测（计划书测试面第 4 条：两形态归一、Base64 原始公钥 JWK 验签闭环、
 * SPKI PEM 验签闭环、空表失效关闭；权威《06-更新与分发规范》§二、《03-插件包格式》§6.3）。
 *
 * @remarks
 * - 夹具资产（`tests/e2e/fixtures/cpk/keys/`、`packages/`）只读引用，不写入、不再生成
 *   （再生成链归计划书阶段五的夹具合缝）。
 * - 编译期形态公钥用测试内生成的 Ed25519 密钥对（JWK 导出即原始 32 字节公钥），
 *   闭环覆盖「Base64 原始公钥 → SPKI PEM 归一 → node:crypto 验签」全链。
 */

import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LoaderError } from '../src/loader/errors.js';
import {
  HOST_TRUST_ROOTS_FORMAT,
  createEmbeddedTrustRootRegistry,
  createTrustRootRegistry,
  createTrustRootRegistryFromDocument,
  embeddedTrustRootsDocument,
  normalizeTrustRootsDocument,
  rawPublicKeyToSpkiPem,
} from '../src/loader/trust-roots.js';
import { computeContentHash, sha256Hex, verifySignature } from '../src/loader/signature.js';
import { loadCpkArchive } from '../src/loader/provider.js';
import type { ITrustRootKey } from '../src/loader/trust-roots.js';

function fixtureAsset(relative: string): string {
  return fileURLToPath(new URL(`../../../tests/e2e/fixtures/cpk/${relative}`, import.meta.url));
}

/** 测试内生成的 Ed25519 密钥对（确定性不依赖随机种子文件；单次生成即闭环验证）。 */
function generateFixtureKeyPair(): {
  readonly rawPublicKeyBase64: string;
  readonly spkiPublicPem: string;
  readonly sign: (data: Buffer) => Buffer;
} {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' });
  if (typeof jwk.x !== 'string') {
    throw new Error('JWK 导出缺少 x 分量（Ed25519 原始公钥）');
  }
  const raw = Buffer.from(jwk.x, 'base64url');
  if (raw.length !== 32) {
    throw new Error('Ed25519 原始公钥应为 32 字节');
  }
  return {
    rawPublicKeyBase64: raw.toString('base64'),
    spkiPublicPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    sign: (data: Buffer) => sign(null, data, privateKey),
  };
}

/** 构造走完整签名阶段的最小包成员集（manifest + 入口 + signature.json）。 */
function buildSignedPackageMembers(keyId: string, signer: (data: Buffer) => Buffer): Map<string, Uint8Array> {
  const members = new Map<string, Uint8Array>();
  const encoder = new TextEncoder();
  members.set('manifest.yaml', encoder.encode('id: chips.demo.signed\n'));
  members.set('dist/index.js', encoder.encode('export const apply = () => undefined;\n'));
  const hash = computeContentHash(
    [...members.entries()].map(([path, data]) => ({ path, data })),
  );
  const signature = signer(Buffer.from(hash, 'utf8')).toString('base64');
  members.set(
    'signature.json',
    encoder.encode(
      JSON.stringify({
        format: 'chips-signature-v1',
        keyId,
        algorithm: 'ed25519',
        contentHash: hash,
        signature,
      }),
    ),
  );
  return members;
}

describe('两形态归一', () => {
  it('编译期形态 chips-trust-roots-v1（Base64 原始公钥）归一为 SPKI PEM', () => {
    const pair = generateFixtureKeyPair();
    const keys = normalizeTrustRootsDocument({
      format: HOST_TRUST_ROOTS_FORMAT,
      description: '编译期形态样例',
      keys: [
        {
          keyId: 'demo-builtin-2026',
          algorithm: 'ed25519',
          publicKey: pair.rawPublicKeyBase64,
          source: 'builtin',
        },
      ],
    });
    expect(keys).toHaveLength(1);
    const entry = keys[0];
    expect(entry?.source).toBe('builtin');
    expect(entry?.algorithm).toBe('ed25519');
    expect(entry?.spkiPem.startsWith('-----BEGIN PUBLIC KEY-----')).toBe(true);
    // 归一后的 PEM 与直接导出的 SPKI PEM 语义等价（原始 32 字节相同）。
    expect(rawPublicKeyToSpkiPem(pair.rawPublicKeyBase64)).toBe(entry?.spkiPem);
  });

  it('注入形态 { version, trustRoots: { keyId: SPKI PEM } } 归一', () => {
    const document = JSON.parse(readFileSync(fixtureAsset('keys/trust-roots.json'), 'utf8')) as unknown;
    const keys = normalizeTrustRootsDocument(document, 'fixture');
    expect(keys).toHaveLength(1);
    const entry = keys[0];
    expect(entry?.keyId).toBe('chips-fixture-2026');
    expect(entry?.source).toBe('injected');
    expect(entry?.spkiPem).toContain('-----BEGIN PUBLIC KEY-----');
  });

  it('注册表查找与快照（keyId 命中/未命中/size）', () => {
    const registry = createTrustRootRegistryFromDocument(
      JSON.parse(readFileSync(fixtureAsset('keys/trust-roots.json'), 'utf8')) as unknown,
      'fixture',
    );
    expect(registry.size).toBe(1);
    expect(registry.find('chips-fixture-2026')?.keyId).toBe('chips-fixture-2026');
    expect(registry.find('missing-key')).toBeUndefined();
    expect(registry.list()).toHaveLength(1);
  });
});

describe('验签闭环', () => {
  it('Base64 原始公钥（编译期形态）全链验签通过', () => {
    const pair = generateFixtureKeyPair();
    const registry = createTrustRootRegistryFromDocument({
      format: HOST_TRUST_ROOTS_FORMAT,
      keys: [
        {
          keyId: 'demo-builtin-jwk',
          algorithm: 'ed25519',
          publicKey: pair.rawPublicKeyBase64,
          source: 'builtin',
        },
      ],
    });
    const members = buildSignedPackageMembers('demo-builtin-jwk', pair.sign);
    const result = verifySignature({ members, source: 'user', trustRoots: registry });
    expect(result.status).toBe('passed');
    expect(result.keyId).toBe('demo-builtin-jwk');
  });

  it('SPKI PEM（注入形态）全链验签通过', () => {
    const pair = generateFixtureKeyPair();
    const registry = createTrustRootRegistryFromDocument({
      version: 1,
      trustRoots: { 'demo-injected-pem': pair.spkiPublicPem },
    });
    const members = buildSignedPackageMembers('demo-injected-pem', pair.sign);
    const result = verifySignature({ members, source: 'builtin', trustRoots: registry });
    expect(result.status).toBe('passed');
    expect(result.keyId).toBe('demo-injected-pem');
  });

  it('真实签名正夹具 + 夹具信任根（SPKI PEM 注入形态）验签闭环', async () => {
    const pkg = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0.cpk'));
    const registry = createTrustRootRegistryFromDocument(
      JSON.parse(readFileSync(fixtureAsset('keys/trust-roots.json'), 'utf8')) as unknown,
      'fixture',
    );
    const result = verifySignature({ members: pkg.members, source: 'user', trustRoots: registry });
    expect(result).toEqual({ status: 'passed', detail: 'keyId: chips-fixture-2026', keyId: 'chips-fixture-2026' });
  });

  it('错误签名（伪造私钥冒用 keyId）被拒', async () => {
    const pkg = await loadCpkArchive(
      fixtureAsset('packages/hello-0.1.0-wrong-signature.cpk'),
    );
    const registry = createTrustRootRegistryFromDocument(
      JSON.parse(readFileSync(fixtureAsset('keys/trust-roots.json'), 'utf8')) as unknown,
      'fixture',
    );
    expect(() =>
      verifySignature({ members: pkg.members, source: 'user', trustRoots: registry }),
    ).toThrowError(LoaderError);
    try {
      verifySignature({ members: pkg.members, source: 'user', trustRoots: registry });
    } catch (error) {
      expect(error).toBeInstanceOf(LoaderError);
      expect((error as LoaderError).code).toBe('CPK_SIGNATURE_INVALID');
      expect((error as LoaderError).details).toMatchObject({
        stage: 'signature',
        keyId: 'chips-fixture-2026',
      });
    }
  });
});

describe('空表失效关闭（内嵌注册表面）', () => {
  it('内嵌文档为编译期形态且 keys 为空集', () => {
    const document = embeddedTrustRootsDocument as { format: string; keys: unknown[] };
    expect(document.format).toBe('chips-trust-roots-v1');
    expect(document.keys).toEqual([]);
    const registry = createEmbeddedTrustRootRegistry();
    expect(registry.size).toBe(0);
    expect(registry.find('chips-fixture-2026')).toBeUndefined();
    expect(registry.list()).toEqual([]);
  });

  it('签名正夹具对内嵌空表按未注册 keyId 拒绝（失效关闭）', async () => {
    const pkg = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0.cpk'));
    const registry = createEmbeddedTrustRootRegistry();
    expect(() =>
      verifySignature({ members: pkg.members, source: 'builtin', trustRoots: registry }),
    ).toThrowError(/CPK_SIGNATURE_INVALID|信任根未注册/);
    try {
      verifySignature({ members: pkg.members, source: 'builtin', trustRoots: registry });
    } catch (error) {
      expect(error).toBeInstanceOf(LoaderError);
      expect((error as LoaderError).code).toBe('CPK_SIGNATURE_INVALID');
      expect((error as LoaderError).details).toMatchObject({
        stage: 'signature',
        keyId: 'chips-fixture-2026',
      });
    }
  });

  it('注入形态空 trustRoots 表合法且判定为未注册', () => {
    const registry = createTrustRootRegistryFromDocument({ version: 1, trustRoots: {} });
    expect(registry.size).toBe(0);
    const pair = generateFixtureKeyPair();
    const members = buildSignedPackageMembers('any-key', pair.sign);
    expect(() =>
      verifySignature({ members, source: 'user', trustRoots: registry }),
    ).toThrowError(LoaderError);
  });
});

describe('非法信任根文档整表拒绝', () => {
  const cases: readonly { readonly name: string; readonly document: unknown }[] = [
    {
      name: 'format 与 version 同时出现（形态判别歧义）',
      document: { format: HOST_TRUST_ROOTS_FORMAT, version: 1, keys: [], trustRoots: {} },
    },
    {
      name: '形态未登记',
      document: { roots: {} },
    },
    {
      name: '顶层非对象',
      document: [],
    },
    {
      name: '编译期形态含未知字段',
      document: { format: HOST_TRUST_ROOTS_FORMAT, keys: [], extra: true },
    },
    {
      name: '编译期形态 keys 非数组',
      document: { format: HOST_TRUST_ROOTS_FORMAT, keys: {} },
    },
    {
      name: '编译期形态 keyId 重复',
      document: {
        format: HOST_TRUST_ROOTS_FORMAT,
        keys: [
          {
            keyId: 'dup',
            algorithm: 'ed25519',
            publicKey: Buffer.alloc(32, 1).toString('base64'),
            source: 'builtin',
          },
          {
            keyId: 'dup',
            algorithm: 'ed25519',
            publicKey: Buffer.alloc(32, 2).toString('base64'),
            source: 'builtin',
          },
        ],
      },
    },
    {
      name: '编译期形态 publicKey 非规范 Base64',
      document: {
        format: HOST_TRUST_ROOTS_FORMAT,
        keys: [
          { keyId: 'bad-b64', algorithm: 'ed25519', publicKey: '###', source: 'builtin' },
        ],
      },
    },
    {
      name: '编译期形态 publicKey 长度非 32 字节',
      document: {
        format: HOST_TRUST_ROOTS_FORMAT,
        keys: [
          {
            keyId: 'short-key',
            algorithm: 'ed25519',
            publicKey: Buffer.alloc(31).toString('base64'),
            source: 'builtin',
          },
        ],
      },
    },
    {
      name: '编译期形态 algorithm 非 ed25519',
      document: {
        format: HOST_TRUST_ROOTS_FORMAT,
        keys: [
          {
            keyId: 'bad-alg',
            algorithm: 'rsa',
            publicKey: Buffer.alloc(32).toString('base64'),
            source: 'builtin',
          },
        ],
      },
    },
    {
      name: '注入形态 version 非 1',
      document: { version: 2, trustRoots: {} },
    },
    {
      name: '注入形态含不可解析公钥',
      document: { version: 1, trustRoots: { broken: 'not-a-pem' } },
    },
    {
      name: '注入形态含非 ed25519 公钥',
      document: (() => {
        const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        return {
          version: 1,
          trustRoots: {
            'rsa-key': publicKey.export({ format: 'pem', type: 'spki' }).toString(),
          },
        };
      })(),
    },
  ];

  for (const testCase of cases) {
    it(`拒绝：${testCase.name}`, () => {
      expect(() => normalizeTrustRootsDocument(testCase.document, 'unit')).toThrowError(
        LoaderError,
      );
      try {
        normalizeTrustRootsDocument(testCase.document, 'unit');
      } catch (error) {
        expect(error).toBeInstanceOf(LoaderError);
        expect((error as LoaderError).code).toBe('CPK_SIGNATURE_INVALID');
      }
    });
  }

  it('createTrustRootRegistry 拒绝跨来源 keyId 重复', () => {
    const pair = generateFixtureKeyPair();
    const keyEntry: ITrustRootKey = {
      keyId: 'dup-key',
      algorithm: 'ed25519',
      spkiPem: pair.spkiPublicPem,
      source: 'injected',
    };
    expect(() => createTrustRootRegistry([keyEntry, keyEntry])).toThrowError(LoaderError);
    const registry = createTrustRootRegistry([keyEntry]);
    expect(registry.find('dup-key')?.keyId).toBe('dup-key');
  });
});

describe('摘要口径（与验签链共用）', () => {
  it('computeContentHash 按路径字节序拼接并带 sha256: 前缀', () => {
    const encoder = new TextEncoder();
    const hash = computeContentHash([
      { path: 'b.txt', data: encoder.encode('B') },
      { path: 'a.txt', data: encoder.encode('A') },
    ]);
    expect(hash.startsWith('sha256:')).toBe(true);
    const expectedDigest = sha256Hex(
      Buffer.concat([
        encoder.encode(`a.txt\n${sha256Hex(encoder.encode('A'))}\n`),
        encoder.encode(`b.txt\n${sha256Hex(encoder.encode('B'))}\n`),
      ]),
    );
    expect(hash).toBe(`sha256:${expectedDigest}`);
  });
});
