/**
 * ID 生成工具
 *
 * 遵循《生态共用技术文档/文件格式规范/04-ID生成规范.md》：
 * 卡片、箱子等文档 ID 为 10 位 Base62 随机标识。
 */

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * 生成 10 位 Base62 随机 ID（用于卡片 / 箱子 / 基础卡片 ID）
 */
export function generateDocumentId(): string {
  const bytes = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let id = '';
  for (let i = 0; i < bytes.length; i += 1) {
    id += BASE62_CHARS.charAt(bytes[i] % BASE62_CHARS.length);
  }
  return id;
}
