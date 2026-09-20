/**
 * ZIP Store 读取器与 CRC-32（壳侧结构视图，《03-插件包格式》§2.1、§5.2 [1]）。
 *
 * @remarks
 * - 发布侧一律 Store（method 0）；`.cpk` 安装校验只接受 Store 成员，非 Store/加密/ZIP64/
 *   extra 字段/尺寸不符/重复与大小写重复路径一律 `CPK_ARCHIVE_INVALID`（裁决 §一 的 Deflate
 *   放行只适用于通用资源读取面，不适用于 `.cpk` 安装校验口径）。
 * - 与 `@chips/cli` `artifacts/zip.ts` 读取面语义逐项一致（壳不 import 被承载方，结构视图先例
 *   见 `src/protocol/error-codes.ts`）。
 */

import { CPK_ERROR_CODES } from './codes.js';
import { throwCpkError } from './errors.js';
import { CPK_LIMITS } from './limits.js';

/** 归档成员（相对路径为 POSIX 形态）。 */
export interface IZipMember {
  readonly path: string;
  readonly data: Uint8Array;
}

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

const textDecoder = new TextDecoder('utf-8', { fatal: false });

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

/** 计算 CRC-32（IEEE 802.3，ZIP 使用；查表实现，确定性、无依赖）。 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    const byte = data[index];
    if (byte === undefined) {
      continue;
    }
    crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const pathEncoder = new TextEncoder();

/** 成员路径字节序比较（与打包/摘要侧同一确定性口径）。 */
export function comparePathBytes(left: string, right: string): number {
  const leftBytes = pathEncoder.encode(left);
  const rightBytes = pathEncoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const leftByte = leftBytes[index] ?? 0;
    const rightByte = rightBytes[index] ?? 0;
    if (leftByte !== rightByte) {
      return leftByte - rightByte;
    }
  }
  return leftBytes.length - rightBytes.length;
}

/** 归档阶段失败（《03-插件包格式》§八：`details` 必须携带阶段与成员路径）。 */
function archiveError(detail: string, file?: string): never {
  throwCpkError(CPK_ERROR_CODES.archiveInvalid, detail, {
    stage: 'archive',
    ...(file === undefined ? {} : { file }),
  });
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimum = Math.max(0, bytes.length - 65557);
  for (let position = bytes.length - 22; position >= minimum; position -= 1) {
    if (
      bytes[position] === 0x50 &&
      bytes[position + 1] === 0x4b &&
      bytes[position + 2] === 0x05 &&
      bytes[position + 3] === 0x06
    ) {
      return position;
    }
  }
  archiveError('不是合法 ZIP 归档：未找到中央目录结束记录');
}

/** 读取 ZIP Store 字节；结构性缺陷统一抛 `CPK_ARCHIVE_INVALID`。 */
export function readZipStore(bytes: Uint8Array): readonly IZipMember[] {
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  if (entryCount === 0xffff || view.getUint16(eocdOffset + 8, true) === 0xffff) {
    archiveError('不支持 ZIP64 归档');
  }
  if (view.getUint16(eocdOffset + 4, true) !== 0 || view.getUint16(eocdOffset + 6, true) !== 0) {
    archiveError('不支持多卷 ZIP 归档');
  }
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  if (centralOffset + centralSize > bytes.length) {
    archiveError('中央目录越界');
  }

  const entries: IZipMember[] = [];
  const paths = new Set<string>();
  const lowered = new Set<string>();
  let position = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (position + 46 > bytes.length) {
      archiveError('中央目录不完整');
    }
    if (view.getUint32(position, true) !== CENTRAL_HEADER_SIGNATURE) {
      archiveError('中央目录签名非法');
    }
    const flags = view.getUint16(position + 8, true);
    const method = view.getUint16(position + 10, true);
    const checksum = view.getUint32(position + 16, true);
    const compressedSize = view.getUint32(position + 20, true);
    const uncompressedSize = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const localOffset = view.getUint32(position + 42, true);

    if ((flags & 0x0001) !== 0) {
      archiveError('归档成员被加密');
    }
    if (method !== 0) {
      archiveError(`成员未使用 Store 方法：${method}`);
    }
    if (compressedSize !== uncompressedSize) {
      archiveError('Store 成员压缩前后尺寸不一致');
    }
    if (extraLength > 0) {
      archiveError('归档成员包含非标准扩展字段');
    }
    if (entries.length + 1 > CPK_LIMITS.members) {
      throwCpkError(CPK_ERROR_CODES.limitExceeded, '文件成员数超过 512', { stage: 'archive' });
    }
    const nameBytes = bytes.subarray(position + 46, position + 46 + nameLength);
    const path = textDecoder.decode(nameBytes);
    if (paths.has(path) || lowered.has(path.toLowerCase())) {
      archiveError(`归档成员路径重复：${path}`, path);
    }
    paths.add(path);
    lowered.add(path.toLowerCase());

    if (localOffset + 30 > bytes.length) {
      archiveError(`成员本地头越界：${path}`, path);
    }
    if (view.getUint32(localOffset, true) !== LOCAL_HEADER_SIGNATURE) {
      archiveError(`成员本地头签名非法：${path}`, path);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + uncompressedSize;
    if (dataEnd > bytes.length) {
      archiveError(`成员数据越界：${path}`, path);
    }
    const data = bytes.slice(dataStart, dataEnd);
    if (crc32(data) !== checksum) {
      archiveError(`成员 CRC 校验失败：${path}`, path);
    }
    entries.push({ path, data });
    position += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
