import { randomUUID } from 'node:crypto';
import { watch as watchFs, type FSWatcher } from 'node:fs';
import { cp, mkdir as mkdirFs, open, readFile, readdir, rename, rm, rmdir, stat, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { TextDecoder } from 'node:util';
import type {
  IPalStoragePort,
  StorageCopyOptions,
  StorageDeleteOptions,
  StorageListOptions,
  StorageMkdirOptions,
  StorageMoveOptions,
  StorageReadOptions,
  StorageReadResult,
  StorageWatchEvent,
  StorageWatchOptions,
  StorageWatchSubscription,
  StorageWriteOptions,
} from '../contracts/index.js';
import { assertCallActive } from '../call-guard.js';
import { PAL_ERROR_CODES, PalPortError, toPalPortError } from '../errors.js';

/** Node 错误码到已登记错误码的映射。 */
const NODE_ERROR_CODE_MAP: Readonly<Record<string, string>> = {
  ENOENT: PAL_ERROR_CODES.FILE_NOT_FOUND,
  EEXIST: PAL_ERROR_CODES.FILE_ALREADY_EXISTS,
  ERR_FS_CP_EEXIST: PAL_ERROR_CODES.FILE_ALREADY_EXISTS,
  ENOTEMPTY: PAL_ERROR_CODES.FILE_NOT_EMPTY,
  ERR_FS_EISDIR: PAL_ERROR_CODES.FILE_NOT_EMPTY,
  ENOTDIR: PAL_ERROR_CODES.FILE_NOT_DIRECTORY,
  EISDIR: PAL_ERROR_CODES.FILE_NOT_DIRECTORY,
  ABORT_ERR: PAL_ERROR_CODES.BRIDGE_CANCELLED,
};

/**
 * 创建文件存储端口。
 *
 * 权威：`04-能力契约规范` §7.1、`17-跨端Shell与平台抽象设计` §4.3。
 *
 * @returns `file:*` 端口实现。
 *
 * @remarks
 * - 只接受绝对路径（目录变量由壳在能力层展开）；相对路径返回 `FILE_IO_FAILED`。
 * - `write` 使用同目录临时文件 + `fsync` + `rename` 原子替换，不自动创建父目录。
 * - `list` 返回相对目录、`/` 分隔、全局字典序升序的路径，不跟随符号链接。
 * - 端口不做 PathGuard 权限判定；只做系统级约束与错误归一。
 */
export function createMacStoragePort(): IPalStoragePort {
  return {
    async read(path: string, options?: StorageReadOptions): Promise<StorageReadResult> {
      assertCallActive(options);
      assertAbsolutePath(path);
      const encoding = options?.encoding ?? 'utf-8';

      let buffer: Buffer;
      try {
        buffer = await readFile(path);
      } catch (error) {
        throw mapFsError(error);
      }

      if (encoding === 'base64') {
        return { content: buffer.toString('base64'), encoding };
      }

      try {
        return { content: new TextDecoder('utf-8', { fatal: true }).decode(buffer), encoding };
      } catch (error) {
        throw new PalPortError(PAL_ERROR_CODES.FILE_DECODE_FAILED, undefined, { cause: error });
      }
    },

    async write(path: string, data: string, options?: StorageWriteOptions): Promise<void> {
      assertCallActive(options);
      assertAbsolutePath(path);
      const encoding = options?.encoding ?? 'utf-8';
      const payload = encoding === 'base64' ? Buffer.from(data, 'base64') : Buffer.from(data, 'utf8');
      const tempPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.chips-tmp`);

      try {
        const handle = await open(tempPath, 'wx');
        try {
          await handle.writeFile(payload);
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(tempPath, path);
      } catch (error) {
        await unlink(tempPath).catch(() => undefined);
        throw mapFsError(error);
      }
    },

    async list(directory: string, options?: StorageListOptions): Promise<readonly string[]> {
      assertCallActive(options);
      assertAbsolutePath(directory);
      try {
        const entries = await collectEntries(directory, options?.recursive ?? false);
        entries.sort(compareCodeUnits);
        return entries;
      } catch (error) {
        throw mapFsError(error);
      }
    },

    async mkdir(path: string, options?: StorageMkdirOptions): Promise<void> {
      assertCallActive(options);
      assertAbsolutePath(path);
      try {
        await mkdirFs(path, { recursive: options?.recursive ?? false });
      } catch (error) {
        throw mapFsError(error);
      }
    },

    async delete(path: string, options?: StorageDeleteOptions): Promise<void> {
      assertCallActive(options);
      assertAbsolutePath(path);
      const recursive = options?.recursive ?? false;
      try {
        const stats = await stat(path);
        if (stats.isDirectory()) {
          if (recursive) {
            await rm(path, { recursive: true, force: false });
          } else {
            await rmdir(path);
          }
          return;
        }
        await unlink(path);
      } catch (error) {
        throw mapFsError(error);
      }
    },

    async move(source: string, target: string, options?: StorageMoveOptions): Promise<void> {
      assertCallActive(options);
      assertAbsolutePath(source);
      assertAbsolutePath(target);
      const overwrite = options?.overwrite ?? false;

      try {
        await stat(source);
      } catch (error) {
        throw mapFsError(error);
      }

      try {
        if (overwrite) {
          await removeIfExists(target);
        } else if (await pathExists(target)) {
          throw new PalPortError(PAL_ERROR_CODES.FILE_ALREADY_EXISTS, undefined, {
            details: { target: basename(target) },
          });
        }

        try {
          await rename(source, target);
        } catch (error) {
          if (!isCrossDeviceError(error)) {
            throw error;
          }
          await copyEntry(source, target, overwrite);
          await rm(source, { recursive: true, force: true });
        }
      } catch (error) {
        throw mapFsError(error);
      }
    },

    async copy(source: string, target: string, options?: StorageCopyOptions): Promise<void> {
      assertCallActive(options);
      assertAbsolutePath(source);
      assertAbsolutePath(target);
      const overwrite = options?.overwrite ?? false;

      try {
        await stat(source);
      } catch (error) {
        throw mapFsError(error);
      }

      try {
        await copyEntry(source, target, overwrite);
      } catch (error) {
        throw mapFsError(error);
      }
    },

    async watch(
      path: string,
      onEvent: (event: StorageWatchEvent) => void,
      options?: StorageWatchOptions,
    ): Promise<StorageWatchSubscription> {
      assertCallActive(options);
      assertAbsolutePath(path);

      let watcher: FSWatcher;
      try {
        watcher = watchFs(
          path,
          {
            recursive: options?.recursive ?? false,
            persistent: false,
            ...(options?.signal !== undefined ? { signal: options.signal } : {}),
          },
          (eventType, filename) => {
            const changedPath = typeof filename === 'string' && filename.length > 0 ? join(path, filename) : path;
            onEvent({
              type: eventType === 'rename' ? 'rename' : 'change',
              path: changedPath,
              timestamp: Date.now(),
            });
          },
        );
      } catch (error) {
        throw mapFsError(error);
      }

      watcher.on('error', () => {
        watcher.close();
      });

      let closed = false;
      return Promise.resolve({
        dispose(): void {
          if (closed) {
            return;
          }
          closed = true;
          watcher.close();
        },
      });
    },
  };
}

/** 断言路径为绝对路径（系统级约束，PAL-2）。 */
function assertAbsolutePath(path: string): void {
  if (typeof path !== 'string' || path.length === 0 || !isAbsolute(path)) {
    throw new PalPortError(PAL_ERROR_CODES.FILE_IO_FAILED, '路径必须是绝对路径', {
      details: { reason: 'path-not-absolute' },
    });
  }
}

/** 递归收集相对路径；不跟随符号链接，目录条目自身也计入。 */
async function collectEntries(root: string, recursive: boolean): Promise<string[]> {
  const collected: string[] = [];

  const walk = async (current: string, prefix: string): Promise<void> => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      collected.push(relative);
      if (recursive && entry.isDirectory()) {
        await walk(join(current, entry.name), relative);
      }
    }
  };

  await walk(root, '');
  return collected;
}

/** 复制文件或目录（目录递归、符号链接不跟随）。 */
async function copyEntry(source: string, target: string, overwrite: boolean): Promise<void> {
  await cp(source, target, {
    recursive: true,
    force: overwrite,
    errorOnExist: !overwrite,
    dereference: false,
  });
}

/** 目标存在时删除（递归），不存在时忽略。 */
async function removeIfExists(target: string): Promise<void> {
  try {
    await rm(target, { recursive: true, force: true });
  } catch (error) {
    throw mapFsError(error);
  }
}

/** 路径是否存在。 */
async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (readNodeErrorCode(error) === 'ENOENT') {
      return false;
    }
    throw mapFsError(error);
  }
}

/** 读取 Node 错误码。 */
function readNodeErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** 是否为跨设备重命名错误。 */
function isCrossDeviceError(error: unknown): boolean {
  return readNodeErrorCode(error) === 'EXDEV';
}

/** 归一文件系统错误。 */
function mapFsError(error: unknown): PalPortError {
  if (error instanceof PalPortError) {
    return error;
  }
  const nodeCode = readNodeErrorCode(error);
  if (nodeCode !== null) {
    const mapped = NODE_ERROR_CODE_MAP[nodeCode];
    if (mapped !== undefined) {
      return new PalPortError(mapped as PalPortError['code'], undefined, { cause: error });
    }
  }
  return toPalPortError(error, PAL_ERROR_CODES.FILE_IO_FAILED);
}

/** 代码单元序比较（与区域设置无关的字典序）。 */
function compareCodeUnits(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
