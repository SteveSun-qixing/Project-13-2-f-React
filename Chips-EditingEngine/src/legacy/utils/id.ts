/**
 * 旧编辑器 ID 生成工具。
 * 从归档项目迁移，用于保持窗口和节点标识生成语义一致。
 */

const ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function getRandomBytes(length: number): Uint8Array | null {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }
  return null;
}

function buildIdFromRandom(length: number): string {
  const bytes = getRandomBytes(length);
  if (bytes) {
    let id = "";
    for (let index = 0; index < length; index += 1) {
      const value = bytes[index] ?? 0;
      id += ID_CHARS[value % ID_CHARS.length];
    }
    return id;
  }

  let fallbackId = "";
  for (let index = 0; index < length; index += 1) {
    fallbackId += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
  }
  return fallbackId;
}

export function generateId62(length = 10): string {
  if (length <= 0) {
    throw new Error("ID length must be greater than 0");
  }

  const zeroId = "0".repeat(length);
  let id = buildIdFromRandom(length);
  while (id === zeroId) {
    id = buildIdFromRandom(length);
  }
  return id;
}

export function generateScopedId(prefix: string, length = 10): string {
  return `${prefix}_${generateId62(length)}`;
}
