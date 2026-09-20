/**
 * 摘要与指纹口径（`11-文档服务设计` §5.5 摘要权威 + §7.1 指纹基线 + `06-文档解析器设计` §5.4）。
 *
 * @remarks
 * - 成员摘要：单个成员字节的 SHA-256；
 * - 包内容摘要：按包内路径 UTF-8 字节序升序拼接 `path + "\0" + size + "\0" + 成员摘要 + "\n"`
 *   后再取 SHA-256，输出 `sha256:<hex>`；
 * - 文件摘要：归档态最终归档文件字节的 SHA-256，输出 `sha256:<hex>`；
 * - 快速指纹摘要：打开时对源指纹（成员路径、尺寸、修改时间、归档 CRC）的规范序列化取
 *   SHA-256，不读取资源字节。
 * 全部计算为纯函数，保存后可按同口径复算验证（本单收口断言之一）。
 */

import { createHash } from 'node:crypto';

const TEXT_ENCODER = new TextEncoder();

/** 单个包内成员的指纹条目（目录态无 `crc32`；归档态携带）。 */
export interface IMemberFingerprint {
  /** 包内路径（`/` 分隔、NFC）。 */
  readonly path: string;
  /** 字节数。 */
  readonly size: number;
  /** 修改时间（Unix epoch 毫秒）。 */
  readonly modifiedAtMs: number;
  /** 归档条目 CRC32；目录态为 `null`。 */
  readonly crc32: number | null;
}

/** 数据源指纹（`06-文档解析器设计` §5.4 成员指纹集合）。 */
export interface ISourceFingerprint {
  readonly members: readonly IMemberFingerprint[];
}

/** 摘要计算的成员字节输入。 */
export interface IDigestMember {
  readonly packagePath: string;
  readonly bytes: Uint8Array;
}

/** SHA-256 十六进制摘要。 */
export function sha256Hex(data: Uint8Array | string): string {
  const buffer = typeof data === 'string' ? TEXT_ENCODER.encode(data) : data;
  return createHash('sha256').update(buffer).digest('hex');
}

/** 输出 `sha256:<hex>` 形态摘要。 */
export function toDigestUrl(hex: string): string {
  return `sha256:${hex}`;
}

/** 包内路径按 UTF-8 字节序升序比较（与摘要与提交顺序口径一致）。 */
export function comparePackagePath(a: string, b: string): number {
  return Buffer.compare(TEXT_ENCODER.encode(a), TEXT_ENCODER.encode(b));
}

/** 成员摘要：单个成员字节的 SHA-256（十六进制，不带前缀）。 */
export function memberDigest(bytes: Uint8Array): string {
  return sha256Hex(bytes);
}

/** 计算包内容摘要（成员需来自同一包根的完整枚举）。 */
export function computePackageContentDigest(members: readonly IDigestMember[]): string {
  const sorted = [...members].sort((a, b) => comparePackagePath(a.packagePath, b.packagePath));
  const parts: string[] = [];
  for (const member of sorted) {
    parts.push(`${member.packagePath}\u0000${member.bytes.byteLength}\u0000${memberDigest(member.bytes)}\n`);
  }
  return toDigestUrl(sha256Hex(parts.join('')));
}

/** 归档态文件摘要。 */
export function computeFileDigest(bytes: Uint8Array): string {
  return toDigestUrl(sha256Hex(bytes));
}

/** 源指纹的规范序列化：成员按路径升序，字段序固定，缺省 `crc32` 输出 `null`。 */
export function canonicalizeSourceFingerprint(fingerprint: ISourceFingerprint): string {
  const sorted = [...fingerprint.members].sort((a, b) => comparePackagePath(a.path, b.path));
  const normalized = sorted.map((member) => ({
    path: member.path,
    size: member.size,
    modifiedAtMs: member.modifiedAtMs,
    crc32: member.crc32 ?? null,
  }));
  return JSON.stringify(normalized);
}

/** 快速指纹摘要：打开时返回的指纹（不读取资源字节，`11-文档服务设计` §5.5）。 */
export function computeQuickFingerprintDigest(fingerprint: ISourceFingerprint): string {
  return toDigestUrl(sha256Hex(canonicalizeSourceFingerprint(fingerprint)));
}

/** 源指纹等值比较（保存前基线复查口径）。 */
export function sourceFingerprintsEqual(a: ISourceFingerprint, b: ISourceFingerprint): boolean {
  return canonicalizeSourceFingerprint(a) === canonicalizeSourceFingerprint(b);
}

/** 指纹集合的字节总量（目录态 `total_size` 口径的摘要输入侧统计）。 */
export function fingerprintTotalSize(fingerprint: ISourceFingerprint): number {
  let total = 0;
  for (const member of fingerprint.members) {
    total += member.size;
  }
  return total;
}

const PACKAGE_PATH_MAX_LENGTH = 4096;

/**
 * 包内路径安全校验（`11-文档服务设计` §9.2：`PackagePath` 规则）：
 * `/` 分隔、禁 `..` 与 `.` 段、禁绝对路径与反斜杠与控制字符、非空、NFC、限长。
 */
export function isSafePackagePath(packagePath: string): boolean {
  if (packagePath.length === 0 || packagePath.length > PACKAGE_PATH_MAX_LENGTH) {
    return false;
  }
  if (packagePath.startsWith('/') || packagePath.includes('\\') || packagePath.includes('\u0000')) {
    return false;
  }
  if (packagePath.normalize('NFC') !== packagePath) {
    return false;
  }
  for (const segment of packagePath.split('/')) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      return false;
    }
    for (const character of segment) {
      const codePoint = character.codePointAt(0) ?? 0;
      if (codePoint <= 0x1f || codePoint === 0x7f) {
        return false;
      }
    }
  }
  return true;
}
