/**
 * 文件系统端口。
 *
 * CLI 的路径校验、脚手架落盘、`.cpk` 打包/校验与日志写入一律经该端口，以便命令级
 * 测试注入内存实现；生产由 {@link createNodeFileSystem} 绑定 `node:fs`。
 */

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** 文件系统条目类型。 */
export type FileSystemKind = 'file' | 'directory' | 'other';

/** CLI 需要的同步文件系统能力。 */
export interface IFileSystemPort {
  exists(path: string): boolean;
  /** 不存在返回 null。 */
  kind(path: string): FileSystemKind | null;
  /** 递归创建目录。 */
  ensureDirectory(path: string): void;
  /** 列出直接子项名称；目录不存在抛错。 */
  list(path: string): readonly string[];
  readText(path: string): string;
  readBinary(path: string): Uint8Array;
  writeText(path: string, content: string): void;
  writeBinary(path: string, content: Uint8Array): void;
  remove(path: string): void;
  rename(from: string, to: string): void;
  /** 创建临时目录并返回绝对路径。 */
  createTempDirectory(prefix: string): string;
}

/** Node 实现。 */
export function createNodeFileSystem(): IFileSystemPort {
  return {
    exists(path: string): boolean {
      try {
        statSync(path);
        return true;
      } catch {
        return false;
      }
    },
    kind(path: string): FileSystemKind | null {
      try {
        const stats = statSync(path);
        if (stats.isFile()) {
          return 'file';
        }
        if (stats.isDirectory()) {
          return 'directory';
        }
        return 'other';
      } catch {
        return null;
      }
    },
    ensureDirectory(path: string): void {
      mkdirSync(path, { recursive: true });
    },
    list(path: string): readonly string[] {
      return readdirSync(path);
    },
    readText(path: string): string {
      return readFileSync(path, 'utf8');
    },
    readBinary(path: string): Uint8Array {
      return new Uint8Array(readFileSync(path));
    },
    writeText(path: string, content: string): void {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, 'utf8');
    },
    writeBinary(path: string, content: Uint8Array): void {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    },
    remove(path: string): void {
      rmSync(path, { recursive: true, force: true });
    },
    rename(from: string, to: string): void {
      renameSync(from, to);
    },
    createTempDirectory(prefix: string): string {
      return mkdtempSync(prefix);
    },
  };
}
