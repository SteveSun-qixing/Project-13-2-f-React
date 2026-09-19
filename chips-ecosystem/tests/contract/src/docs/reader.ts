/**
 * 文档读取抽象：文件系统实现与偏差注入实现共用同一接口。
 *
 * 偏差用例（`src/fixtures/deviations.ts`）以内存实现替换文件系统，
 * 在不修改真实文档的前提下驱动完整的「解析 → 比对」管线。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { DOCS_ROOT } from '../paths.js';

export interface DocReader {
  read(relativePath: string): string;
}

export interface DocRef {
  readonly file: string;
  readonly section: string;
}

export function docRefLabel(ref: DocRef): string {
  return `${ref.file}#${ref.section}`;
}

/** 以文档库根为基准的文件系统读取器；读取失败抛出可定位错误。 */
export function createFileReader(docsRoot: string = DOCS_ROOT): DocReader {
  return {
    read(relativePath: string): string {
      const absolutePath = path.join(docsRoot, relativePath);
      try {
        return readFileSync(absolutePath, 'utf8');
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`读取文档失败：${absolutePath}（${reason}）`);
      }
    },
  };
}

/** 基于内存映射的读取器（偏差注入与单元测试用）。 */
export function createMemoryReader(files: ReadonlyMap<string, string>): DocReader {
  return {
    read(relativePath: string): string {
      const content = files.get(relativePath);
      if (content === undefined) {
        throw new Error(`内存读取器缺少文档：${relativePath}`);
      }
      return content;
    },
  };
}
