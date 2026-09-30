/**
 * HTML 转 PDF 服务：输入归一。
 *
 * 目录态 HTML 中间产物的纯值编码：入口 HTML 文本 + 相对路径资源表
 * + 可选排版度量块。全部校验失败统一为 CONVERTER_INPUT_UNSUPPORTED
 * （details 携带 field / reason）。
 */

import { MAX_ASSET_PATH_LENGTH, MAX_HTML_BYTES, MAX_INLINE_INPUT_BYTES } from './descriptor.js';
import { inputUnsupported } from './errors.js';
import type { INormalizedHtmlToPdfInput, IPaginatedBlock } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isUint8Array = (value: unknown): value is Uint8Array => value instanceof Uint8Array;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** 判定资源路径是否合法：相对路径、正斜杠、无 .. 段、非空且长度受限。 */
export function isValidAssetPath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_ASSET_PATH_LENGTH) {
    return false;
  }
  if (path.startsWith('/') || path.includes('\\')) {
    return false;
  }
  const segments = path.split('/');
  return segments.every(
    (segment) => segment.length > 0 && segment !== '.' && segment !== '..'
  );
}

const encoder = new TextEncoder();

/** 计算 UTF-8 字节长度。 */
export function utf8ByteLength(text: string): number {
  return encoder.encode(text).length;
}

/** 归一排版度量块清单：形状与取值校验，块标识去重检查。 */
export function normalizeBlocks(raw: unknown): readonly IPaginatedBlock[] {
  if (typeof raw === 'undefined') {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw inputUnsupported('blocks 必须是数组。', { field: 'blocks' });
  }
  const seen = new Set<string>();
  const blocks: IPaginatedBlock[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      throw inputUnsupported('排版度量块必须是对象。', { field: 'blocks' });
    }
    const id = item['id'];
    const heightPx = item['heightPx'];
    if (typeof id !== 'string' || id.length === 0 || id.length > 256) {
      throw inputUnsupported('排版度量块 id 必须是长度 1~256 的字符串。', { field: 'blocks' });
    }
    if (!isFiniteNumber(heightPx) || heightPx <= 0) {
      throw inputUnsupported('排版度量块 heightPx 必须是正有限数。', {
        field: 'blocks',
        reason: 'BLOCK_HEIGHT_INVALID',
        blockId: id,
      });
    }
    if (seen.has(id)) {
      throw inputUnsupported('排版度量块 id 重复。', {
        field: 'blocks',
        reason: 'BLOCK_ID_DUPLICATED',
        blockId: id,
      });
    }
    seen.add(id);
    const keepTogether = item['keepTogether'];
    if (typeof keepTogether !== 'undefined' && typeof keepTogether !== 'boolean') {
      throw inputUnsupported('排版度量块 keepTogether 必须是布尔值。', {
        field: 'blocks',
        reason: 'BLOCK_KEEP_TOGETHER_INVALID',
        blockId: id,
      });
    }
    blocks.push({ id, heightPx, ...(keepTogether === true ? { keepTogether: true } : {}) });
  }
  return blocks;
}

/**
 * 归一输入：
 * - html 必须为非空字符串且 UTF-8 字节不超过 8 MiB；
 * - assets 必须为「合法相对路径 → Uint8Array」的记录；
 * - blocks 必须为合法排版度量块清单；
 * - html 与 assets 合计不超过描述符 maxInlineInputBytes（32 MiB）。
 */
export function normalizeHtmlToPdfInput(raw: unknown): INormalizedHtmlToPdfInput {
  if (!isRecord(raw)) {
    throw inputUnsupported('转换输入必须是对象。', { field: 'input' });
  }

  const html = raw['html'];
  if (typeof html !== 'string' || html.length === 0) {
    throw inputUnsupported('入口 HTML 文本必须是非空字符串。', { field: 'html' });
  }
  const htmlBytes = utf8ByteLength(html);
  if (htmlBytes > MAX_HTML_BYTES) {
    throw inputUnsupported('入口 HTML 文本超出 8 MiB 上限。', {
      field: 'html',
      reason: 'HTML_TOO_LARGE',
      bytes: htmlBytes,
      limit: MAX_HTML_BYTES,
    });
  }

  const rawAssets = raw['assets'];
  let assets: Readonly<Record<string, Uint8Array>> = {};
  let assetsBytes = 0;
  if (typeof rawAssets !== 'undefined') {
    if (!isRecord(rawAssets)) {
      throw inputUnsupported('资源表必须是对象。', { field: 'assets' });
    }
    const normalized: Record<string, Uint8Array> = {};
    for (const [path, bytes] of Object.entries(rawAssets)) {
      if (!isValidAssetPath(path)) {
        throw inputUnsupported(`资源路径非法：资源路径必须为长度不超过 ${MAX_ASSET_PATH_LENGTH} 的相对路径。`, {
          field: 'assets',
          reason: 'ASSET_PATH_INVALID',
          path,
        });
      }
      if (!isUint8Array(bytes)) {
        throw inputUnsupported('资源字节必须是 Uint8Array。', {
          field: 'assets',
          reason: 'ASSET_BYTES_INVALID',
          path,
        });
      }
      normalized[path] = bytes;
      assetsBytes += bytes.byteLength;
    }
    assets = normalized;
  }

  const totalBytes = htmlBytes + assetsBytes;
  if (totalBytes > MAX_INLINE_INPUT_BYTES) {
    throw inputUnsupported('输入合计字节超出一次性输入上限（32 MiB）。', {
      field: 'input',
      reason: 'INPUT_TOO_LARGE',
      bytes: totalBytes,
      limit: MAX_INLINE_INPUT_BYTES,
    });
  }

  const blocks = normalizeBlocks(raw['blocks']);

  return { html, assets, blocks };
}
