/**
 * 宿主端口装配：`ctx.bridge` 正式链路 → 编排侧 `IFilePort` 收窄投影，
 * 与「路径世界 → 字节世界」的 HTML 包装配读取。
 *
 * 存在性/形态判定口径（如实登记的 `file:stat` 缺位适配，见 W4 迁移日志缺位登记 3）：
 * - `file:list` 成功 ⇒ 目录存在；
 * - `FILE_NOT_FOUND` ⇒ 路径不存在；
 * - 其余错误（如文件路径被列举）⇒ 按文件形态处理，由后续读入口如实失败。
 * 递归列举中的目录条目以「读失败 → 反向 list 探测成功」收口为目录并跳过
 * （其文件已含于递归列举），避免对目录条目误读。
 */

import type { IServiceBridge } from '@chips/sdk';

import { decodeBase64, encodeBase64 } from './base64.js';
import { hasChipsErrorCode, FILE_NOT_FOUND_CODE, inputUnsupported, INPUT_UNSUPPORTED_REASONS } from './errors.js';
import { basename, dirname, joinPath } from './paths.js';
import { HTML_ENTRY_FILE } from './descriptor.js';
import type { IFilePort, INormalizedHtmlSource } from './types.js';

/** 由宿主 Bridge 装配文件端口（每次请求走 Bridge 三层正式链路与本插件会话权限）。 */
export function createBridgeFilePort(bridge: IServiceBridge): IFilePort {
  return {
    async listDirectory(directory, recursive) {
      const result = await bridge.request<{ entries: readonly string[] }>('file:list', {
        directory,
        ...(recursive !== undefined ? { recursive } : {}),
      });
      return result.entries;
    },
    async readText(path) {
      const result = await bridge.request<{ content: string }>('file:read', { path, encoding: 'utf-8' });
      return result.content;
    },
    async readBytes(path) {
      const result = await bridge.request<{ content: string }>('file:read', { path, encoding: 'base64' });
      return decodeBase64(result.content);
    },
    async writeText(path, data) {
      await bridge.request('file:write', { path, data, encoding: 'utf-8' });
    },
    async writeBytes(path, data) {
      await bridge.request('file:write', { path, data: encodeBase64(data), encoding: 'base64' });
    },
    async makeDirectory(path) {
      await bridge.request('file:mkdir', { path, recursive: true });
    },
    async movePath(source, target, overwrite) {
      await bridge.request('file:move', {
        source,
        target,
        ...(overwrite !== undefined ? { overwrite } : {}),
      });
    },
    async deletePath(path, recursive) {
      await bridge.request('file:delete', {
        path,
        ...(recursive !== undefined ? { recursive } : {}),
      });
    },
  };
}

/** 来源存在性预检（旧 ensureSourceExists 语义）：FILE_NOT_FOUND 归一为在册码收口。 */
export async function assertSourceExists(file: IFilePort, sourcePath: string): Promise<void> {
  try {
    await file.listDirectory(sourcePath);
  } catch (error) {
    if (hasChipsErrorCode(error, FILE_NOT_FOUND_CODE)) {
      throw inputUnsupported(`来源路径不存在：${sourcePath}`, INPUT_UNSUPPORTED_REASONS.sourceNotFound, {
        sourcePath,
      });
    }
    // 其余错误（文件路径、权限等）按存在处理，后续读入口如实失败。
  }
}

/**
 * HTML 来源形态解析（旧 resolveSourceShape 语义的 file:stat 缺位适配）：
 * list 成功 ⇒ 目录；FILE_NOT_FOUND ⇒ 来源不存在；其余错误 ⇒ 文件形态。
 */
export async function resolveHtmlSourceShape(
  file: IFilePort,
  sourcePath: string
): Promise<INormalizedHtmlSource> {
  try {
    await file.listDirectory(sourcePath);
    return { htmlDir: sourcePath };
  } catch (error) {
    if (hasChipsErrorCode(error, FILE_NOT_FOUND_CODE)) {
      throw inputUnsupported(`HTML 来源路径不存在：${sourcePath}`, INPUT_UNSUPPORTED_REASONS.sourceNotFound, {
        sourcePath,
      });
    }
    return { htmlDir: dirname(sourcePath), entryFile: basename(sourcePath) };
  }
}

/** 递归条目是否为目录：读失败后以反向 list 探测收口。 */
async function isDirectoryEntry(file: IFilePort, htmlDir: string, entry: string, readError: unknown): Promise<boolean> {
  try {
    await file.listDirectory(joinPath(htmlDir, entry));
    return true;
  } catch {
    throw readError;
  }
}

/** 纯内存 HTML 包（content-converter.html-to-pdf / html-to-image 输入形状）。 */
export interface IHtmlPackage {
  readonly html: string;
  readonly assets: Readonly<Record<string, Uint8Array>>;
}

/**
 * 读取目录态 HTML 包：入口文本 + 资产字节表。
 * 入口缺省 index.html（目录态产物契约入口名）；入口缺失由读入口按平台在册码如实失败。
 */
export async function readHtmlPackage(file: IFilePort, htmlPackage: INormalizedHtmlSource): Promise<IHtmlPackage> {
  const entryFile = htmlPackage.entryFile ?? HTML_ENTRY_FILE;
  const entries = await file.listDirectory(htmlPackage.htmlDir, true);
  const assets: Record<string, Uint8Array> = {};

  for (const entry of entries) {
    if (entry === entryFile) {
      continue;
    }
    const entryPath = joinPath(htmlPackage.htmlDir, entry);
    try {
      assets[entry] = await file.readBytes(entryPath);
    } catch (error) {
      if (await isDirectoryEntry(file, htmlPackage.htmlDir, entry, error)) {
        continue;
      }
      throw error;
    }
  }

  const html = await file.readText(joinPath(htmlPackage.htmlDir, entryFile));
  return { html, assets };
}
