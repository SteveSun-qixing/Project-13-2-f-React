/**
 * RFC 4648 base64 纯 TS 编解码。
 *
 * 来由：同族 html-to-pdf / html-to-image 为纯内存原子操作（Uint8Array 进出、
 * 不读写路径），而宿主 `file:read` / `file:write` 的二进制形态是 base64 字符串；
 * 路径世界 ↔ 字节世界的桥接归本编排层，且服务插件不得直接访问 Node.js /
 * Electron / 系统 API（04-能力契约规范 §8.3 约束 5），故按 cardtohtml 自实现
 * 路径算法的同一口径实现标准编解码（TextEncoder / TextDecoder 为 JS 标准全局）。
 */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DECODE_TABLE = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let index = 0; index < BASE64_ALPHABET.length; index += 1) {
    table[BASE64_ALPHABET.charCodeAt(index)] = index;
  }
  table['='.charCodeAt(0)] = -2;
  return table;
})();

/** 字节 → base64 文本（标准字母表，带 padding）。 */
export function encodeBase64(bytes: Uint8Array): string {
  let output = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const remaining = bytes.length - offset;
    const b0 = bytes[offset] ?? 0;
    const b1 = remaining > 1 ? (bytes[offset + 1] ?? 0) : 0;
    const b2 = remaining > 2 ? (bytes[offset + 2] ?? 0) : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;

    output += BASE64_ALPHABET[(triple >> 18) & 0x3f];
    output += BASE64_ALPHABET[(triple >> 12) & 0x3f];
    output += remaining > 1 ? BASE64_ALPHABET[(triple >> 6) & 0x3f] : '=';
    output += remaining > 2 ? BASE64_ALPHABET[triple & 0x3f] : '=';
  }
  return output;
}

/** base64 文本 → 字节；非法字符与非法长度以 TypeError 收口（不变量：宿主编码恒合法）。 */
export function decodeBase64(text: string): Uint8Array {
  if (text.length % 4 !== 0) {
    throw new TypeError('base64 输入长度必须为 4 的倍数。');
  }

  const pending = text.length - (text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0);
  const output = new Uint8Array(Math.floor((pending * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let written = 0;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code > 0x7f) {
      throw new TypeError(`base64 输入包含非 ASCII 字符：偏移 ${index}。`);
    }
    const value = DECODE_TABLE[code] ?? -1;
    if (value === -1) {
      throw new TypeError(`base64 输入包含非法字符：偏移 ${index}。`);
    }
    if (value === -2) {
      if (index < pending) {
        throw new TypeError('base64 填充符出现在有效数据之前。');
      }
      continue;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[written] = (buffer >> bits) & 0xff;
      written += 1;
    }
  }

  if (written !== output.length) {
    throw new TypeError('base64 输入长度与有效数据量不一致。');
  }
  return output;
}
