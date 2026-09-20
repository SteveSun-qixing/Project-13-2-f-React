/**
 * 签名阶段：`signature.json` 判定与包内容摘要（《03-插件包格式》§6.1–§6.3）。
 *
 * @remarks
 * - 签名形状冻结为 `chips-signature-v1`：`{ format, keyId, algorithm: 'ed25519', contentHash,
 *   signature }`；签名值为对 `contentHash` 字符串 UTF-8 字节的 Ed25519 签名（Base64）。
 * - 包内容摘要（§6.2）：除 `signature.json` 外全部成员按路径字节序升序，拼接
 *   `path\n<sha256hex(file)>\n` 后取 SHA-256，前缀 `sha256:`。
 * - 渠道规则（§6.3）：`builtin` 必须签名（缺失 → `CPK_SIGNATURE_REQUIRED`）；`user` 签名缺失
 *   判为「未签名发布者」（存在无效签名一律拒绝）；`development` 不检查签名（§2.7 目录态）。
 * - `keyId` 不在信任根表（未登记或已撤销）与验签失败同为 `CPK_SIGNATURE_INVALID`
 *   （《06-更新与分发规范》二：撤销 = 从信任根注册表移除 keyId；契约面无独立过期码）。
 * - 摘要重算在信任根查找**之前**执行：篡改包内容先按「包内容摘要与签名声明不一致」拒绝。
 */

import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';

import { CPK_ERROR_CODES } from './codes.js';
import { throwCpkError } from './errors.js';
import type { PluginSource } from './types.js';
import type { IZipMember } from './zip.js';
import { comparePathBytes } from './zip.js';
import type { ITrustRootRegistry } from './trust-roots.js';

/** 签名文件名（不参与内容摘要）。 */
export const SIGNATURE_FILE = 'signature.json';

/** 签名阶段结果。 */
export interface ISignatureStageResult {
  readonly status: 'passed' | 'skipped';
  /** 判定说明（简体中文）。 */
  readonly detail: string;
  /** 验签通过的 keyId（`passed` 时有值）。 */
  readonly keyId?: string;
  /** `user` 渠道签名缺失：安装前需要用户确认「未签名发布者」。 */
  readonly unsignedPublisher?: boolean;
}

/** SHA-256 小写十六进制。 */
export function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** 包内容摘要（《03-插件包格式》§6.2）。 */
export function computeContentHash(members: Iterable<IZipMember>): string {
  const sorted = [...members].sort((left, right) => comparePathBytes(left.path, right.path));
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const entry of sorted) {
    chunks.push(encoder.encode(`${entry.path}\n${sha256Hex(entry.data)}\n`));
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    merged.set(chunk, position);
    position += chunk.length;
  }
  return `sha256:${sha256Hex(merged)}`;
}

interface ISignatureDocument {
  readonly keyId: string;
  readonly contentHash: string;
  readonly signature: string;
}

function parseSignatureFile(data: Uint8Array): ISignatureDocument {
  let document: unknown;
  try {
    document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)) as unknown;
  } catch {
    throwCpkError(CPK_ERROR_CODES.signatureInvalid, 'signature.json 不是合法 JSON', {
      stage: 'signature',
      file: SIGNATURE_FILE,
    });
  }
  if (typeof document !== 'object' || document === null) {
    throwCpkError(CPK_ERROR_CODES.signatureInvalid, 'signature.json 结构非法', {
      stage: 'signature',
      file: SIGNATURE_FILE,
    });
  }
  const record = document as Record<string, unknown>;
  const { format, keyId, algorithm, contentHash, signature } = record;
  if (
    format !== 'chips-signature-v1' ||
    typeof keyId !== 'string' ||
    keyId.length === 0 ||
    algorithm !== 'ed25519' ||
    typeof contentHash !== 'string' ||
    !/^sha256:[0-9a-f]{64}$/.test(contentHash) ||
    typeof signature !== 'string' ||
    signature.length === 0
  ) {
    throwCpkError(CPK_ERROR_CODES.signatureInvalid, 'signature.json 字段非法', {
      stage: 'signature',
      file: SIGNATURE_FILE,
    });
  }
  return { keyId, contentHash, signature };
}

/**
 * 签名阶段判定。
 *
 * @param input 成员表、来源渠道、信任根注册表。
 * @returns 阶段结果（`skipped` 仅出现在 development 渠道与 user 渠道签名缺失）。
 */
export function verifySignature(input: {
  readonly members: ReadonlyMap<string, Uint8Array>;
  readonly source: PluginSource;
  readonly trustRoots: ITrustRootRegistry;
}): ISignatureStageResult {
  const signatureData = input.members.get(SIGNATURE_FILE);
  if (signatureData === undefined) {
    if (input.source === 'builtin') {
      throwCpkError(CPK_ERROR_CODES.signatureRequired, 'builtin 来源必须签名', {
        stage: 'signature',
        file: SIGNATURE_FILE,
      });
    }
    if (input.source === 'development') {
      return { status: 'skipped', detail: 'development 来源不检查签名' };
    }
    return { status: 'skipped', detail: '未签名发布者', unsignedPublisher: true };
  }

  const document = parseSignatureFile(signatureData);
  const unsignedMembers: IZipMember[] = [];
  for (const [path, data] of input.members) {
    if (path !== SIGNATURE_FILE) {
      unsignedMembers.push({ path, data });
    }
  }
  const computed = computeContentHash(unsignedMembers);
  if (computed !== document.contentHash) {
    throwCpkError(CPK_ERROR_CODES.signatureInvalid, '包内容摘要与签名声明不一致', {
      stage: 'signature',
      file: SIGNATURE_FILE,
      expected: document.contentHash,
      actual: computed,
    });
  }
  if (input.source === 'development') {
    return { status: 'skipped', detail: 'development 来源不检查签名' };
  }

  const key = input.trustRoots.find(document.keyId);
  if (key === undefined) {
    throwCpkError(CPK_ERROR_CODES.signatureInvalid, `信任根未注册的 keyId：${document.keyId}`, {
      stage: 'signature',
      keyId: document.keyId,
    });
  }
  let verified = false;
  try {
    const publicKey = createPublicKey(key.spkiPem);
    verified = cryptoVerify(
      null,
      Buffer.from(document.contentHash, 'utf8'),
      publicKey,
      Buffer.from(document.signature, 'base64'),
    );
  } catch (error) {
    throwCpkError(
      CPK_ERROR_CODES.signatureInvalid,
      `签名校验失败：${error instanceof Error ? error.message : String(error)}`,
      { stage: 'signature', keyId: document.keyId },
    );
  }
  if (!verified) {
    throwCpkError(CPK_ERROR_CODES.signatureInvalid, 'Ed25519 签名校验失败', {
      stage: 'signature',
      keyId: document.keyId,
    });
  }
  return { status: 'passed', detail: `keyId: ${document.keyId}`, keyId: document.keyId };
}
