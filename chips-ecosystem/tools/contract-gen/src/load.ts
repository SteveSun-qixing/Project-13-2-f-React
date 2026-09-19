import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { DocReader } from './types.js';

/** 以文档库根目录为基准的文件系统读取器。 */
export function createFileReader(docsRoot: string): DocReader {
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
