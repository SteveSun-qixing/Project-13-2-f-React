/**
 * CRC-32 校验（旧 Chip-iconMaker/src/icon-workbench/crc32.ts 逐字迁移）。
 *
 * IEEE 802.3 多项式（0xEDB88320 反射）查表实现，供 ZIP Store 条目校验和使用。
 */

const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

export function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;

  for (const byte of bytes) {
    // 查表索引恒为 `(value ^ byte) & 0xff`，落在表长 256 内（表在模块顶层填满 256 项）。
    value = CRC_TABLE[(value ^ byte) & 0xff]! ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
}
