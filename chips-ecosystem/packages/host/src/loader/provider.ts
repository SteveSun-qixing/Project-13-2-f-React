/**
 * `.cpk` 包读取 Provider：归档态与目录态（开发态）差异在边界内吸收（《03-插件包格式》§2.7、§5.2）。
 *
 * @remarks
 * - 归档态：读取整包字节 → ZIP Store 解包（归档阶段校验由 `validate.ts` 触发）→ 成员表；
 *   安装哈希为整包字节 SHA-256（`sha256:` 前缀）。
 * - 目录态（`development` 来源，启动参数/开发工作区指定）：成员 = 目录文件树（POSIX 相对路径）；
 *   跳过归档与签名两个阶段由校验流水线裁决；目录根必须呈包根形态（根级 `package.json` 判为
 *   源码工程而非包根，《03-插件包格式》§2.7）；安装哈希取成员内容清单摘要。
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { CPK_ERROR_CODES } from './codes.js';
import { throwCpkError } from './errors.js';
import { CPK_LIMITS } from './limits.js';
import { readZipStore, type IZipMember } from './zip.js';
import { sha256Hex } from './signature.js';

/** 包内容（解包后的成员表与安装哈希来源）。 */
export interface ICpkPackage {
  /** 成员路径（POSIX 相对路径）→ 字节。 */
  readonly members: ReadonlyMap<string, Uint8Array>;
  /** 包形态。 */
  readonly mode: 'archive' | 'directory';
  /** 整包字节（归档态）；目录态为 null。 */
  readonly archiveBytes: Uint8Array | null;
}

/** `.cpk` 归档文件 Provider（读盘并解包；归档结构失败抛 `CPK_ARCHIVE_INVALID`）。 */
export async function loadCpkArchive(file: string): Promise<ICpkPackage> {
  const buffer = await readFile(file);
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (bytes.length > CPK_LIMITS.archiveBytes) {
    throwCpkError(CPK_ERROR_CODES.limitExceeded, '归档大小超过 50 MiB', { stage: 'archive' });
  }
  const entries = readZipStore(bytes);
  const members = new Map<string, Uint8Array>();
  for (const entry of entries) {
    members.set(entry.path, entry.data);
  }
  return { members, mode: 'archive', archiveBytes: bytes };
}

/** 归档成员列表（校验流水线共用视图）。 */
export function membersToZipEntries(members: ReadonlyMap<string, Uint8Array>): readonly IZipMember[] {
  const entries: IZipMember[] = [];
  for (const [path, data] of members) {
    entries.push({ path, data });
  }
  return entries;
}

/** 目录态 Provider：收集目录文件树为成员表（深度上限防失控递归）。 */
export async function loadCpkDirectory(root: string): Promise<ICpkPackage> {
  const members = new Map<string, Uint8Array>();
  const visit = async (dir: string, prefix: string, depth: number): Promise<void> => {
    if (depth > CPK_LIMITS.depth + 2) {
      throwCpkError(CPK_ERROR_CODES.limitExceeded, `目录深度超过上限：${prefix}`, {
        stage: 'archive',
        file: prefix,
      });
    }
    const dirents = await readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      const absolute = join(dir, dirent.name);
      const relative = prefix.length === 0 ? dirent.name : `${prefix}/${dirent.name}`;
      if (dirent.isSymbolicLink()) {
        throwCpkError(CPK_ERROR_CODES.pathUnsafe, `目录态禁止符号链接：${relative}`, {
          stage: 'archive',
          file: relative,
        });
      }
      if (dirent.isDirectory()) {
        await visit(absolute, relative, depth + 1);
        continue;
      }
      if (dirent.isFile()) {
        const buffer = await readFile(absolute);
        members.set(relative, new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
      }
    }
  };
  await visit(root.replace(/[/\\]+$/, ''), '', 1);
  return { members, mode: 'directory', archiveBytes: null };
}

/** 目录态源码工程判别（根级 `package.json` 存在即为工程目录而非包根，《03-插件包格式》§2.7）。 */
export function assertDirectoryPackageRoot(members: ReadonlyMap<string, Uint8Array>, root: string): void {
  if (members.has('package.json')) {
    throwCpkError(
      CPK_ERROR_CODES.layoutInvalid,
      '目录态校验要求包根形态：检测到 package.json，该目录是源码工程而非解包后的包根' +
        '（《03-插件包格式》§2.7）；请先打包生成 .cpk，或改用与包根布局一致的目录',
      { stage: 'layout', file: 'package.json', path: root },
    );
  }
}
