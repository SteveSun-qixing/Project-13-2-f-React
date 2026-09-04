/**
 * 二进制载荷兼容层：Host 的 file.read / resource.readBinary 返回值可能是
 * Uint8Array、ArrayBuffer、base64 字符串或 {data}/{content} 包装对象，
 * 统一在此解包为 Uint8Array。
 */

function decodeBase64ToBytes(input: string): Uint8Array {
  const bufferCtor = (
    globalThis as typeof globalThis & {
      Buffer?: { from(data: string, encoding: string): Uint8Array };
    }
  ).Buffer;

  if (bufferCtor) {
    const buffer = bufferCtor.from(input, "base64");
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  const normalized = input.replace(/\s+/g, "");
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

export function unwrapBinaryPayload(value: unknown): string | Uint8Array | ArrayBuffer {
  if (value && typeof value === "object") {
    if ("data" in value) {
      const data = (value as { data?: unknown }).data;
      if (data instanceof Uint8Array || data instanceof ArrayBuffer || typeof data === "string") {
        return data;
      }
    }

    if ("content" in value) {
      const content = (value as { content?: unknown }).content;
      if (
        content instanceof Uint8Array ||
        content instanceof ArrayBuffer ||
        typeof content === "string"
      ) {
        return content;
      }
    }
  }

  if (value instanceof Uint8Array || value instanceof ArrayBuffer || typeof value === "string") {
    return value;
  }

  throw new Error("无法识别的二进制结果。");
}
