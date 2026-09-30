/**
 * 二进制内容归一（迁移件）。
 *
 * 迁移来源：旧仓 `Chips-MusicPlayer/src/utils/binary.ts`（覆盖矩阵「封面解码与呈现支撑」
 * 行，判迁移：宿主载荷 base64/字节串归一纯函数，测试随迁）。
 */

function decodeBase64ToBytes(input: string): Uint8Array {
  const bufferCtor = (
    globalThis as typeof globalThis & {
      Buffer?: {
        from(data: string, encoding: string): Uint8Array;
      };
    }
  ).Buffer;

  if (bufferCtor) {
    const buffer = bufferCtor.from(input, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  const normalized = input.replace(/\s+/g, '');
  const decoded = atob(normalized);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function decodeByteString(input: string): Uint8Array {
  const bytes = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    bytes[index] = input.charCodeAt(index) & 0xff;
  }
  return bytes;
}

export function normalizeBinaryContent(value: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  try {
    return decodeBase64ToBytes(value);
  } catch {
    return decodeByteString(value);
  }
}
