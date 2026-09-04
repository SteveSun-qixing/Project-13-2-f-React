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

/** 兼容 {data}/{content}/裸值 三种二进制负载形态 */
export function unwrapBinaryPayload(value: unknown): string | Uint8Array | ArrayBuffer {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of ["data", "content"] as const) {
      if (key in value) {
        const candidate = (value as Record<string, unknown>)[key];
        if (
          candidate instanceof Uint8Array ||
          candidate instanceof ArrayBuffer ||
          typeof candidate === "string"
        ) {
          return candidate;
        }
      }
    }
  }

  if (
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    typeof value === "string"
  ) {
    return value;
  }

  throw new Error("无法识别的二进制负载结果。");
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

export function bytesToDataUri(bytes: Uint8Array, mimeType: string): string {
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

  return `data:${mimeType};base64,${btoa(binary)}`;
}

/** web 宿主下载兜底：宿主不支持 saveFile 时以 <a download> 落地 */
export function downloadBytesAsFile(bytes: Uint8Array, fileName: string, mimeType: string): void {
  const link = document.createElement("a");
  link.href = bytesToDataUri(bytes, mimeType);
  link.download = fileName;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
