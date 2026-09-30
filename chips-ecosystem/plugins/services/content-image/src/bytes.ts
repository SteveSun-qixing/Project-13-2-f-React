/**
 * 取色能力（content-image.pick-colors）：输入字节归一与缓存键构造。
 *
 * 迁移自旧模块 `src/binary.ts`（105 行）。差异全部由契约决定：
 * - 旧 `readBinaryFile` 走 Host 动作 `file.read`（`encoding: 'binary'`）取字节：该通道已作废
 *   （04-能力契约规范 §8.4「不登记与已替代」表：旧 Host 动作与旧模块能力一律不复用），
 *   且 §8.3 约束 1 禁止原子操作读写路径 ⇒ 图像字节由消费方随调用传入，本包不再自取字节。
 * - 旧 `normalizeBinaryPayload` 的 base64 / 单字节字符串 / Node `Buffer` JSON 三条解码臂：
 *   §8.3 约束 5 明确「不得以内联 base64 兜底二进制」，输入必须是结构化克隆兼容的
 *   `Uint8Array` ⇒ 三臂按契约删除，非字节输入直接以 `IMAGE_INPUT_UNSUPPORTED` 收口。
 * - 旧缓存键 `${imagePath}::${sampleSize}::${size}::${mtimeMs}`（路径 + stat 身份）：
 *   本包不持有路径与 stat ⇒ 键改由消费方给出的来源标识 `sourceKey` 承载（缺标识即不缓存）。
 */

import { inputUnsupported } from './errors.js';
import type { IPickColorsInput } from './types.js';

/**
 * 把任意 ArrayBuffer 族视图收归为独立持有的 `Uint8Array`（避免与调用方共享缓冲）。
 *
 * @param value - ArrayBuffer 或任意 ArrayBufferView
 * @returns 新建的、独占持有的 `Uint8Array`
 */
export function toOwnedBytes(value: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }
  const copy = new Uint8Array(value.byteLength);
  copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  return copy;
}

/**
 * 归一图像字节输入：只接受 ArrayBuffer / ArrayBufferView，产出独占副本。
 *
 * @param value - 调用方传入的图像字节
 * @returns 独占持有的图像字节
 * @throws `IMAGE_INPUT_UNSUPPORTED` 非字节形状、零长度或字段缺失
 */
export function normalizeImageBytes(value: unknown): Uint8Array {
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = toOwnedBytes(value);
    if (bytes.byteLength === 0) {
      throw inputUnsupported('图像字节为空，无法取色。', { reason: 'EMPTY_INPUT' });
    }
    return bytes;
  }
  throw inputUnsupported('图像输入必须是 Uint8Array 或 ArrayBuffer（禁止内联 base64 兜底）。', {
    reason: 'NOT_BINARY',
  });
}

/**
 * 构造取色缓存键：只在消费方给出来源标识时成立。
 *
 * @param input - 取色输入
 * @param sampleSize - 归一后的采样边长
 * @returns 缓存键；无来源标识时返回 `undefined`（不参与缓存）
 */
export function buildCacheKey(input: IPickColorsInput, sampleSize: number): string | undefined {
  const sourceKey = typeof input.sourceKey === 'string' ? input.sourceKey.trim() : '';
  if (sourceKey.length === 0) {
    return undefined;
  }
  return `${sourceKey}::${sampleSize}::${input.image.byteLength}`;
}
