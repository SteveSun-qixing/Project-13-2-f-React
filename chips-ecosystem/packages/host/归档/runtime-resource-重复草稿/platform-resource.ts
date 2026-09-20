/**
 * `platform` 作用域资源读取后端。
 *
 * 权威：`06-资源协议规范` §5.3（作用域映射与范围读取）、§5.4（越界与非法路径），
 * `17-跨端Shell与平台抽象设计` §3.2（壳页与脚本经 `chips-resource://platform/*` 装载）。
 *
 * @remarks
 * - 平台作用域映射到壳构建产物目录（`platformRoot`）：这是平台自有资源的最小读路径，
 *   仅解析 `platform` 作用域；其余作用域一律 `RESOURCE_NOT_FOUND`（真实核心装配后由资源管理器接管）。
 * - 供壳自检运行时与生产运行时共用，行为逐字一致（MIME、范围、416、越界拒绝）。
 */

import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

import { parseResourceUri } from '../../protocol/resource-uri.js';
import type { IResourceBackend, IResourceReadRequest, IResourceReadResult } from '../contracts.js';

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

/**
 * 构造与 `IWireChipsError` 同构的可抛出错误（`only-throw-error` 要求抛真 `Error`）。
 *
 * @remarks 抛出值由 `asWireError` / `toWireError` 按 `code`/`message`/`retryable` 结构消费，
 * 与本类实例携带的同名可枚举属性逐字段一致。
 */
function resourceError(code: string, message: string): Error & { code: string; retryable: boolean } {
  return Object.assign(new Error(message), { code, retryable: false });
}

/**
 * 创建 `platform` 作用域资源后端。
 *
 * @param platformRoot 平台构建产物根目录（`chips-resource://platform/<path>` 的映射根）。
 */
export function createPlatformResourceBackend(platformRoot: string): IResourceBackend {
  const root = resolve(platformRoot);
  return {
    async read(request: IResourceReadRequest): Promise<IResourceReadResult> {
      const parsed = parseResourceUri(request.uri);
      if (!parsed.ok) {
        throw resourceError(parsed.code, '资源地址无效');
      }
      if (parsed.scope !== 'platform' || parsed.path.length === 0) {
        throw resourceError('RESOURCE_NOT_FOUND', '资源不存在');
      }
      const target = resolve(root, parsed.path);
      if (target !== root && !target.startsWith(`${root}${sep}`)) {
        throw resourceError('RESOURCE_PATH_INVALID', '资源路径无效');
      }
      let size: number;
      try {
        const info = await stat(target);
        if (!info.isFile()) {
          throw new Error('not a file');
        }
        size = info.size;
      } catch {
        throw resourceError('RESOURCE_NOT_FOUND', '资源不存在');
      }
      const contentType = MIME_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream';
      const baseHeaders: Record<string, string> = {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      };
      if (request.range !== null) {
        // 越界起点不做裁剪：起点不小于尺寸即不可满足范围，返回 416（06-资源协议规范 §5.3、RFC 9110 §14.1.7）。
        const start = request.range.start;
        const end = request.range.end === null ? size - 1 : Math.min(request.range.end, size - 1);
        if (size === 0 || start < 0 || start >= size || start > end) {
          return { status: 416, headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` }, body: null };
        }
        const body = await readFile(target).then((buffer) => buffer.subarray(start, end + 1));
        return {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(body.byteLength),
          },
          body: request.method === 'HEAD' ? null : body,
        };
      }
      const buffer = await readFile(target);
      return {
        status: 200,
        headers: { ...baseHeaders, 'Content-Length': String(size) },
        body: request.method === 'HEAD' ? null : buffer,
      };
    },
  };
}
