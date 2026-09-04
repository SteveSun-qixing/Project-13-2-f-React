/**
 * 62 进制 ID 工具
 */

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function getRandomBytes(length: number): Uint8Array | null {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }
  return null;
}

function buildIdFromRandom(length: number): string {
  const bytes = getRandomBytes(length);
  if (bytes) {
    let id = '';
    for (let i = 0; i < length; i += 1) {
      const value = bytes[i] ?? 0;
      id += ID_CHARS[value % ID_CHARS.length];
    }
    return id;
  }

  let fallbackId = '';
  for (let i = 0; i < length; i += 1) {
    fallbackId += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
  }
  return fallbackId;
}

/**
 * 生成 62 进制 ID
 */
export function generateId62(length = 10): string {
  if (length <= 0) {
    throw new Error('ID length must be greater than 0');
  }

  const zeroId = '0'.repeat(length);
  let id = buildIdFromRandom(length);
  while (id === zeroId) {
    id = buildIdFromRandom(length);
  }
  return id;
}

/**
 * 生成带前缀的 ID
 */
export function generateScopedId(prefix: string, length = 10): string {
  return `${prefix}_${generateId62(length)}`;
}
