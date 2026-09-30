/**
 * ICNS 容器编码（旧 Chip-iconMaker/src/icon-workbench/icns.ts 逐字迁移）。
 *
 * Apple `icns` 族容器：`icns` 魔数 + 大端总长 + 逐条目（类型四字节 + 大端条目长 + PNG 载荷）。
 */

import { concatBytes, numberToUint32BE, utf8Bytes } from './binary';

export interface IcnsImageEntry {
  type: string;
  pngBytes: Uint8Array;
}

export const ICNS_ENTRIES = [
  { type: 'ic04', size: 16 },
  { type: 'ic11', size: 32 },
  { type: 'ic05', size: 32 },
  { type: 'ic12', size: 64 },
  { type: 'ic07', size: 128 },
  { type: 'ic13', size: 256 },
  { type: 'ic08', size: 256 },
  { type: 'ic14', size: 512 },
  { type: 'ic09', size: 512 },
  { type: 'ic10', size: 1024 },
] as const;

export function createIcnsFile(entries: IcnsImageEntry[]): Uint8Array {
  const parts = entries.map((entry) => {
    const length = 8 + entry.pngBytes.byteLength;
    return concatBytes([utf8Bytes(entry.type), numberToUint32BE(length), entry.pngBytes]);
  });
  const totalLength = 8 + parts.reduce((sum, part) => sum + part.byteLength, 0);

  return concatBytes([utf8Bytes('icns'), numberToUint32BE(totalLength), ...parts]);
}
