/**
 * 信任根注册表：两种正式形态的归一与查找（《06-更新与分发规范》§二、《03-插件包格式》§6.3）。
 *
 * @remarks
 * - 契约语义（06.02-06 §二）：撤销 = keyId 从信任根注册表移除；未登记与已撤销同判定
 *   （`CPK_SIGNATURE_INVALID`，由 `signature.ts` 消费方落码）。注册表本身只做形态归一、
 *   密钥材料合法性收紧与 `keyId → 公钥` 查找，不做任何签名判定。
 * - 两种正式形态在此归一为统一的 `ITrustRootKey[]`：
 *   1. 宿主编译期 `chips-trust-roots-v1`（`resources/trust-roots.json`，经 vite 构建内嵌）：
 *      `keys[]` 条目携带 Base64 编码的 Ed25519 **原始 32 字节公钥**（`publicKey`），
 *      归一为 SPKI PEM（`rawPublicKeyToSpkiPem`）供 `node:crypto` 验签；
 *      `keys: []` 即未注册密钥全集（当前正式内容缺位，工单 028），一律**失效关闭**。
 *   2. 夹具 / 库面注入形态（`CHIPS_TRUST_ROOTS_FILE` 与打包链在用形状，《CLI 完整参考》§2.7）：
 *      `{ version: 1, description?, trustRoots: { "<keyId>": "<SPKI PEM>" } }`。
 * - 编码统一裁决（Base64 原始公钥 vs SPKI PEM）悬而未决属工单 028 登记范围；本模块按
 *   「归一后等价」实现两形态逐条目校验，任一条目非法即整表拒绝（不静默跳过）。
 */

import { createPublicKey } from 'node:crypto';

import embeddedTrustRootsJson from '../../resources/trust-roots.json';
import { CPK_ERROR_CODES } from './codes.js';
import { LoaderError } from './errors.js';

/** 宿主编译期信任根文档格式标识（《06-更新与分发规范》§二）。 */
export const HOST_TRUST_ROOTS_FORMAT = 'chips-trust-roots-v1';

/** 归一后的信任根条目：验签消费口径为 `spkiPem`。 */
export interface ITrustRootKey {
  readonly keyId: string;
  readonly algorithm: 'ed25519';
  /** Ed25519 公钥（SPKI PEM，`node:crypto` `createPublicKey` 可直接消费）。 */
  readonly spkiPem: string;
  /** 来源形态：`builtin` = 编译期内嵌；`injected` = 夹具/库面注入文档。 */
  readonly source: 'builtin' | 'injected';
}

/** 信任根注册表（`signature.ts` 的注入端口）。 */
export interface ITrustRootRegistry {
  /** 查找 keyId；未登记/已撤销返回 undefined（签名判定侧落 `CPK_SIGNATURE_INVALID`）。 */
  find(keyId: string): ITrustRootKey | undefined;
  /** 全表快照（诊断与测试面）。 */
  list(): readonly ITrustRootKey[];
  /** 已登记密钥数。 */
  readonly size: number;
}

/** Ed25519 SPKI 前缀（DER：`SEQUENCE { SEQUENCE { OID 1.3.101.112 } BIT STRING 32B }`）。 */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/** 信任根文档非法（配置面拒绝；错误码取签名域登记码，不发明新码）。 */
function trustRootsError(message: string, details: Record<string, unknown>): never {
  throw new LoaderError(CPK_ERROR_CODES.signatureInvalid, {
    message,
    details: { stage: 'signature', ...details },
  });
}

/**
 * Base64 原始 Ed25519 公钥（32 字节）→ SPKI PEM。
 *
 * @remarks 入参必须是规范化 Base64（重编码往返一致）且解码恰为 32 字节，
 * 且合成公钥必须能被 `node:crypto` 解析为 ed25519 密钥；任一不满足整条目拒绝。
 */
export function rawPublicKeyToSpkiPem(base64PublicKey: string): string {
  const raw = Buffer.from(base64PublicKey, 'base64');
  if (raw.length !== 32 || raw.toString('base64') !== base64PublicKey) {
    trustRootsError('信任根公钥不是规范化的 Base64 Ed25519 原始公钥（32 字节）', {
      publicKeyEncoding: 'base64-raw',
    });
  }
  const der = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  return derToSpkiPem(der, 'base64-raw');
}

/** SPKI DER → PEM（64 字符折行）并做 `node:crypto` 解析收紧（ed25519 限定）。 */
function derToSpkiPem(der: Buffer, origin: string): string {
  const body = der.toString('base64');
  const lines: string[] = [];
  for (let index = 0; index < body.length; index += 64) {
    lines.push(body.slice(index, index + 64));
  }
  const pem = `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----\n`;
  assertEd25519Spki(pem, origin);
  return pem;
}

/** 公钥 PEM 必须可解析且为 ed25519；否则整条目拒绝。 */
function assertEd25519Spki(spkiPem: string, origin: string): void {
  try {
    const key = createPublicKey(spkiPem);
    if (key.asymmetricKeyType !== 'ed25519') {
      trustRootsError(`信任根公钥算法不是 ed25519：${key.asymmetricKeyType ?? 'unknown'}`, {
        publicKeyOrigin: origin,
      });
    }
  } catch (error) {
    trustRootsError(`信任根公钥不是可解析的 SPKI PEM：${error instanceof Error ? error.message : String(error)}`, {
      publicKeyOrigin: origin,
    });
  }
}

function expectObjectDocument(value: unknown, origin: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    trustRootsError('信任根文档顶层必须是对象', { origin });
  }
  return value as Record<string, unknown>;
}

function assertKnownKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  origin: string,
  pointer: string,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      trustRootsError(`信任根文档含未知字段：${pointer === '' ? key : `${pointer}.${key}`}`, {
        origin,
        field: pointer === '' ? key : `${pointer}.${key}`,
      });
    }
  }
}

function dedupeKeyIds(keys: readonly ITrustRootKey[], origin: string): ITrustRootKey[] {
  const seen = new Set<string>();
  for (const entry of keys) {
    if (seen.has(entry.keyId)) {
      trustRootsError(`信任根文档 keyId 重复：${entry.keyId}`, { origin, keyId: entry.keyId });
    }
    seen.add(entry.keyId);
  }
  return [...keys];
}

/** 解析宿主编译期形态 `chips-trust-roots-v1`（Base64 原始公钥 → SPKI PEM 归一）。 */
function parseBuiltinTrustRoots(record: Record<string, unknown>, origin: string): ITrustRootKey[] {
  assertKnownKeys(record, ['format', 'description', 'keys'], origin, '');
  if (record.format !== HOST_TRUST_ROOTS_FORMAT) {
    trustRootsError(`信任根文档 format 非法：期望 ${HOST_TRUST_ROOTS_FORMAT}`, { origin });
  }
  if (record.description !== undefined && typeof record.description !== 'string') {
    trustRootsError('信任根文档 description 必须是字符串', { origin, field: 'description' });
  }
  const keys = record.keys;
  if (!Array.isArray(keys)) {
    trustRootsError('信任根文档 keys 必须是数组', { origin, field: 'keys' });
  }
  const entries: ITrustRootKey[] = [];
  keys.forEach((item, index) => {
    const pointer = `keys[${index}]`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      trustRootsError(`信任根文档 ${pointer} 必须是对象`, { origin, field: pointer });
    }
    const entry = item as Record<string, unknown>;
    assertKnownKeys(entry, ['keyId', 'algorithm', 'publicKey', 'source'], origin, pointer);
    const keyId = entry.keyId;
    if (typeof keyId !== 'string' || keyId.length === 0) {
      trustRootsError(`信任根文档 ${pointer}.keyId 必须为非空字符串`, { origin, field: `${pointer}.keyId` });
    }
    if (entry.algorithm !== 'ed25519') {
      trustRootsError(`信任根文档 ${pointer}.algorithm 只允许 ed25519`, {
        origin,
        field: `${pointer}.algorithm`,
      });
    }
    if (entry.source !== 'builtin') {
      trustRootsError(`信任根文档 ${pointer}.source 只允许 builtin`, {
        origin,
        field: `${pointer}.source`,
      });
    }
    const publicKey = entry.publicKey;
    if (typeof publicKey !== 'string' || publicKey.length === 0) {
      trustRootsError(`信任根文档 ${pointer}.publicKey 必须为非空 Base64 原始公钥`, {
        origin,
        field: `${pointer}.publicKey`,
      });
    }
    entries.push({
      keyId,
      algorithm: 'ed25519',
      spkiPem: rawPublicKeyToSpkiPem(publicKey),
      source: 'builtin',
    });
  });
  return dedupeKeyIds(entries, origin);
}

/** 解析夹具 / 库面注入形态 `{ version: 1, trustRoots: { keyId: SPKI PEM } }`。 */
function parseInjectedTrustRoots(record: Record<string, unknown>, origin: string): ITrustRootKey[] {
  assertKnownKeys(record, ['version', 'description', 'trustRoots'], origin, '');
  if (record.version !== 1) {
    trustRootsError('信任根文档 version 必须为数值 1', { origin, field: 'version' });
  }
  if (record.description !== undefined && typeof record.description !== 'string') {
    trustRootsError('信任根文档 description 必须是字符串', { origin, field: 'description' });
  }
  const roots = record.trustRoots;
  if (typeof roots !== 'object' || roots === null || Array.isArray(roots)) {
    trustRootsError('信任根文档 trustRoots 必须是 keyId → SPKI PEM 的对象', {
      origin,
      field: 'trustRoots',
    });
  }
  const entries: ITrustRootKey[] = [];
  for (const [keyId, publicKey] of Object.entries(roots as Record<string, unknown>)) {
    if (keyId.length === 0) {
      trustRootsError('信任根文档 trustRoots 含空 keyId', { origin });
    }
    if (typeof publicKey !== 'string' || publicKey.length === 0) {
      trustRootsError(`信任根文档 trustRoots.${keyId} 必须为非空 SPKI PEM`, {
        origin,
        keyId,
      });
    }
    assertEd25519Spki(publicKey, `injected:${keyId}`);
    entries.push({ keyId, algorithm: 'ed25519', spkiPem: publicKey, source: 'injected' });
  }
  return dedupeKeyIds(entries, origin);
}

/**
 * 两形态归一：按文档判别（`format` → 编译期内嵌形态；`version` → 注入形态）。
 *
 * @param document 已 `JSON.parse` 的信任根文档。
 * @param origin 诊断标注（文件路径 / 内嵌来源），入 `details`。
 */
export function normalizeTrustRootsDocument(document: unknown, origin = 'inline'): ITrustRootKey[] {
  const record = expectObjectDocument(document, origin);
  const hasFormat = 'format' in record;
  const hasVersion = 'version' in record;
  if (hasFormat && hasVersion) {
    trustRootsError('信任根文档不得同时携带 format 与 version（形态判别歧义）', { origin });
  }
  if (hasFormat) {
    return parseBuiltinTrustRoots(record, origin);
  }
  if (hasVersion) {
    return parseInjectedTrustRoots(record, origin);
  }
  trustRootsError('信任根文档形态未登记：既无 chips-trust-roots-v1 format 也无 version 1 形状', {
    origin,
  });
}

/** 由归一条目构造注册表（keyId 重复拒绝）。 */
export function createTrustRootRegistry(keys: Iterable<ITrustRootKey>): ITrustRootRegistry {
  const table = new Map<string, ITrustRootKey>();
  for (const entry of keys) {
    if (table.has(entry.keyId)) {
      trustRootsError(`信任根注册表 keyId 重复：${entry.keyId}`, { keyId: entry.keyId });
    }
    table.set(entry.keyId, entry);
  }
  const snapshot = Object.freeze([...table.values()]);
  return {
    find: (keyId: string) => table.get(keyId),
    list: () => snapshot,
    size: table.size,
  };
}

/** 由未归一文档构造注册表（两形态自动判别；非法文档整表拒绝）。 */
export function createTrustRootRegistryFromDocument(document: unknown, origin = 'inline'): ITrustRootRegistry {
  return createTrustRootRegistry(normalizeTrustRootsDocument(document, origin));
}

/** 宿主编译期内嵌信任根文档（构建期内嵌事实源；当前 `keys: []` = 失效关闭，工单 028）。 */
export const embeddedTrustRootsDocument: unknown = embeddedTrustRootsJson;

/** 构造内嵌编译期信任根注册表（宿主默认信任面）。 */
export function createEmbeddedTrustRootRegistry(): ITrustRootRegistry {
  return createTrustRootRegistryFromDocument(embeddedTrustRootsDocument, 'embedded');
}
