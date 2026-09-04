function decodeBase64ToBytes(input: string): Uint8Array {
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

/**
 * 将宿主返回的二进制载荷归一化为 Uint8Array。
 * 兼容三种宿主载荷形态：{ data }、{ content } 与裸值（字符串按 base64 优先解码）。
 */
export function unwrapBinaryPayload(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("data" in record) {
      return unwrapBinaryPayload(record.data);
    }
    if ("content" in record) {
      return unwrapBinaryPayload(record.content);
    }
  }
  if (typeof value === "string") {
    try {
      return decodeBase64ToBytes(value);
    } catch {
      return decodeByteString(value);
    }
  }
  throw new Error("无法识别的二进制载荷。");
}

/** Uint8Array → base64 字符串（分块处理，避免超长参数栈溢出） */
export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    let segment = "";
    for (let index = 0; index < chunk.length; index += 1) {
      segment += String.fromCharCode(chunk[index] ?? 0);
    }
    binary += segment;
  }
  return btoa(binary);
}

/** Uint8Array → data URI（用于 <img>、<a download> 等场景） */
export function bytesToDataUri(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}
