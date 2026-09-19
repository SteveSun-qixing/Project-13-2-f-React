/**
 * ZIP Store 读写（[插件包格式] §2.1）。
 *
 * 写入：确定性（成员按路径字节序升序、时间戳固定 1980-01-01、无扩展字段、Store 方法），
 * 同一输入必须产生相同字节；读取：中央目录完整性与 CRC 校验，拒绝加密、ZIP64 与重复路径。
 */

import { cliError } from '../errors.js';
import { crc32 } from './crc32.js';

/** 归档成员。 */
export interface IZipEntry {
  readonly path: string;
  readonly data: Uint8Array;
}

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const UTF8_FLAG = 0x0800;
const FIXED_DOS_TIME = 0;
const FIXED_DOS_DATE = 0x0021;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: false });

/** 写入 ZIP Store 字节。 */
export function writeZipStore(entries: readonly IZipEntry[]): Uint8Array {
  const sorted = [...entries].sort((left, right) => compareZipPathBytes(left.path, right.path));
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of sorted) {
    const nameBytes = textEncoder.encode(entry.path);
    const checksum = crc32(entry.data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, LOCAL_HEADER_SIGNATURE, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, UTF8_FLAG, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, FIXED_DOS_TIME, true);
    localView.setUint16(12, FIXED_DOS_DATE, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    const centralEntry = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralEntry.buffer);
    centralView.setUint32(0, CENTRAL_HEADER_SIGNATURE, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, UTF8_FLAG, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, FIXED_DOS_TIME, true);
    centralView.setUint16(14, FIXED_DOS_DATE, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralEntry.set(nameBytes, 46);

    chunks.push(local, entry.data);
    central.push(centralEntry);
    offset += local.length + entry.data.length;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, EOCD_SIGNATURE, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, sorted.length, true);
  eocdView.setUint16(10, sorted.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true);

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + centralSize + eocd.length;
  const output = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.length;
  }
  for (const chunk of central) {
    output.set(chunk, position);
    position += chunk.length;
  }
  output.set(eocd, position);
  return output;
}

/** 成员路径字节序比较（打包与摘要共用，保证确定性）。 */
export function compareZipPathBytes(left: string, right: string): number {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
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

/** 读取 ZIP Store 字节；结构性缺陷统一抛 `CPK_ARCHIVE_INVALID`。 */
export function readZipStore(bytes: Uint8Array): readonly IZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  if (entryCount === 0xffff || view.getUint16(eocdOffset + 8, true) === 0xffff) {
    throw cliError('CPK_ARCHIVE_INVALID', '不支持 ZIP64 归档');
  }
  if (view.getUint16(eocdOffset + 4, true) !== 0 || view.getUint16(eocdOffset + 6, true) !== 0) {
    throw cliError('CPK_ARCHIVE_INVALID', '不支持多卷 ZIP 归档');
  }
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  if (centralOffset + centralSize > bytes.length) {
    throw cliError('CPK_ARCHIVE_INVALID', '中央目录越界');
  }

  const entries: IZipEntry[] = [];
  const paths = new Set<string>();
  const lowered = new Set<string>();
  let position = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (position + 46 > bytes.length) {
      throw cliError('CPK_ARCHIVE_INVALID', '中央目录不完整');
    }
    if (view.getUint32(position, true) !== CENTRAL_HEADER_SIGNATURE) {
      throw cliError('CPK_ARCHIVE_INVALID', '中央目录签名非法');
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
      throw cliError('CPK_ARCHIVE_INVALID', '归档成员被加密');
    }
    if (method !== 0) {
      throw cliError('CPK_ARCHIVE_INVALID', `成员未使用 Store 方法：${method}`);
    }
    if (compressedSize !== uncompressedSize) {
      throw cliError('CPK_ARCHIVE_INVALID', 'Store 成员压缩前后尺寸不一致');
    }
    if (extraLength > 0) {
      throw cliError('CPK_ARCHIVE_INVALID', '归档成员包含非标准扩展字段');
    }
    const nameBytes = bytes.subarray(position + 46, position + 46 + nameLength);
    const path = textDecoder.decode(nameBytes);
    if (paths.has(path) || lowered.has(path.toLowerCase())) {
      throw cliError('CPK_ARCHIVE_INVALID', `归档成员路径重复：${path}`);
    }
    paths.add(path);
    lowered.add(path.toLowerCase());

    if (localOffset + 30 > bytes.length) {
      throw cliError('CPK_ARCHIVE_INVALID', `成员本地头越界：${path}`);
    }
    if (view.getUint32(localOffset, true) !== LOCAL_HEADER_SIGNATURE) {
      throw cliError('CPK_ARCHIVE_INVALID', `成员本地头签名非法：${path}`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + uncompressedSize;
    if (dataEnd > bytes.length) {
      throw cliError('CPK_ARCHIVE_INVALID', `成员数据越界：${path}`);
    }
    const data = bytes.slice(dataStart, dataEnd);
    if (crc32(data) !== checksum) {
      throw cliError('CPK_ARCHIVE_INVALID', `成员 CRC 校验失败：${path}`);
    }
    entries.push({ path, data });
    position += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
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
  throw cliError('CPK_ARCHIVE_INVALID', '不是合法 ZIP 归档：未找到中央目录结束记录');
}
