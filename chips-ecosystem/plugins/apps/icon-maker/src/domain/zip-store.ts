/**
 * ZIP Store 归档编码（旧 Chip-iconMaker/src/icon-workbench/zip-store.ts 逐字迁移）。
 *
 * 仅 STORE（不压缩）方法：多图标资源包已是 PNG 等已压缩载荷，重压缩无收益；
 * 条目带 UTF-8 文件名标志（0x0800）与 CRC-32 校验。
 */

import { concatBytes, utf8Bytes, writeUint16LE, writeUint32LE } from './binary';
import { crc32 } from './crc32';

export interface ZipStoreEntry {
  path: string;
  bytes: Uint8Array;
}

interface CentralDirectoryRecord {
  header: Uint8Array;
  offset: number;
}

function createLocalHeader(entry: ZipStoreEntry, checksum: number): Uint8Array {
  const name = utf8Bytes(entry.path);
  const header = new Uint8Array(30 + name.byteLength);
  const view = new DataView(header.buffer);

  writeUint32LE(view, 0, 0x04034b50);
  writeUint16LE(view, 4, 20);
  writeUint16LE(view, 6, 0x0800);
  writeUint16LE(view, 8, 0);
  writeUint16LE(view, 10, 0);
  writeUint16LE(view, 12, 0);
  writeUint32LE(view, 14, checksum);
  writeUint32LE(view, 18, entry.bytes.byteLength);
  writeUint32LE(view, 22, entry.bytes.byteLength);
  writeUint16LE(view, 26, name.byteLength);
  writeUint16LE(view, 28, 0);
  header.set(name, 30);

  return header;
}

function createCentralHeader(entry: ZipStoreEntry, checksum: number, localOffset: number): Uint8Array {
  const name = utf8Bytes(entry.path);
  const header = new Uint8Array(46 + name.byteLength);
  const view = new DataView(header.buffer);

  writeUint32LE(view, 0, 0x02014b50);
  writeUint16LE(view, 4, 20);
  writeUint16LE(view, 6, 20);
  writeUint16LE(view, 8, 0x0800);
  writeUint16LE(view, 10, 0);
  writeUint16LE(view, 12, 0);
  writeUint16LE(view, 14, 0);
  writeUint32LE(view, 16, checksum);
  writeUint32LE(view, 20, entry.bytes.byteLength);
  writeUint32LE(view, 24, entry.bytes.byteLength);
  writeUint16LE(view, 28, name.byteLength);
  writeUint16LE(view, 30, 0);
  writeUint16LE(view, 32, 0);
  writeUint16LE(view, 34, 0);
  writeUint16LE(view, 36, 0);
  writeUint32LE(view, 38, 0);
  writeUint32LE(view, 42, localOffset);
  header.set(name, 46);

  return header;
}

function createEndRecord(entryCount: number, centralSize: number, centralOffset: number): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);

  writeUint32LE(view, 0, 0x06054b50);
  writeUint16LE(view, 4, 0);
  writeUint16LE(view, 6, 0);
  writeUint16LE(view, 8, entryCount);
  writeUint16LE(view, 10, entryCount);
  writeUint32LE(view, 12, centralSize);
  writeUint32LE(view, 16, centralOffset);
  writeUint16LE(view, 20, 0);

  return header;
}

export function createZipStore(entries: ZipStoreEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralRecords: CentralDirectoryRecord[] = [];
  let offset = 0;

  for (const entry of entries) {
    const checksum = crc32(entry.bytes);
    const localHeader = createLocalHeader(entry, checksum);
    const localOffset = offset;

    localParts.push(localHeader, entry.bytes);
    offset += localHeader.byteLength + entry.bytes.byteLength;

    centralRecords.push({
      header: createCentralHeader(entry, checksum, localOffset),
      offset: localOffset,
    });
  }

  const centralParts = centralRecords.map((record) => record.header);
  const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);
  const endRecord = createEndRecord(entries.length, centralSize, offset);

  return concatBytes([...localParts, ...centralParts, endRecord]);
}
