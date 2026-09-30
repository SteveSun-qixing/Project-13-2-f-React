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

export function bytesToDataUri(bytes: Uint8Array, mimeType: string): string {
  const bufferCtor = (
    globalThis as typeof globalThis & {
      Buffer?: {
        from(data: Uint8Array): { toString(encoding: string): string };
      };
    }
  ).Buffer;

  const base64 = bufferCtor
    ? bufferCtor.from(bytes).toString('base64')
    : (() => {
        const chunkSize = 0x8000;
        let binary = '';

        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          const chunk = bytes.subarray(offset, offset + chunkSize);
          let segment = '';
          for (let index = 0; index < chunk.length; index += 1) {
            segment += String.fromCharCode(chunk[index] ?? 0);
          }
          binary += segment;
        }

        return btoa(binary);
      })();

  return `data:${mimeType};base64,${base64}`;
}
