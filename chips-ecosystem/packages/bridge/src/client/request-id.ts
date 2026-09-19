/**
 * `requestId` / `controlId` 生成（02-Bridge三层设计 §7.2：UUID v4，同一会话内唯一）。
 *
 * 纯 TypeScript 实现，无第三方依赖；随机源为 Web Crypto `crypto.getRandomValues`。
 */

const HEX_DIGITS = '0123456789abcdef';

function hex(value: number): string {
  return HEX_DIGITS[value] ?? '0';
}

/** 生成 RFC 4122 版本 4 的 UUID。 */
export function createRequestId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  let output = '';
  for (let index = 0; index < bytes.length; index += 1) {
    if (index === 4 || index === 6 || index === 8 || index === 10) {
      output += '-';
    }
    const byte = bytes[index] ?? 0;
    output += hex(byte >> 4);
    output += hex(byte & 0x0f);
  }
  return output;
}
