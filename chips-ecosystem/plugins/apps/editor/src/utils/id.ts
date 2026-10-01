/**
 * 62 进制 ID 工具（矩阵裁决件：迁移自旧仓 Chips-EditingEngine `src/utils/id.ts:1-56`，
 * 零 Host 零 UI 纯函数，编辑器主体重写时为窗口/面板等界面内部标识生成稳定随机 ID；
 * 不涉插件 ID 与能力 ID，插件身份以 manifest `id: chips.official.editor` 为唯一权威）。
 *
 * 迁移适配（逐字迁移 + 类型面适配，逻辑零语义差）：随机主路径取字符由
 * `ID_CHARS[...]` 索引访问改 `ID_CHARS.charAt(...)`——工作区 tsconfig 启用
 * `noUncheckedIndexedAccess`，索引访问判 `string | undefined`；`charAt` 返回类型
 * 恒为 `string` 且与同函数回退分支既有写法一致，取值语义不变。
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
      id += ID_CHARS.charAt(value % ID_CHARS.length);
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
