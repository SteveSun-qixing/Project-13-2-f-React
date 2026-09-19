/**
 * 文件系统端口的 Node 实现（[CLI 完整参考] §2.6 路径校验基座）：
 * 真实临时目录上的存在性、类型、递归创建、读写、删除、改名与临时目录语义。
 *
 * 端口语义在命令级测试里由 `MemoryFileSystem` 承担，本文件唯一职责是验证
 * `node:fs` 绑定没有将端口契约写错（父目录自动创建、`other` 类型、force 删除）。
 */

import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterAll, describe, expect, it } from 'vitest';

import { createNodeFileSystem, type IFileSystemPort } from '../src/args/filesystem.js';

const fileSystem: IFileSystemPort = createNodeFileSystem();
const root = mkdtempSync(join(tmpdir(), 'chips-cli-fs-'));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('createNodeFileSystem：存在性与类型（§2.6）', () => {
  it('文件、目录、缺失路径与特殊文件各自的判定', () => {
    const dir = join(root, 'kinds');
    fileSystem.ensureDirectory(dir);
    const file = join(dir, 'note.txt');
    fileSystem.writeText(file, '内容');

    expect(fileSystem.exists(file)).toBe(true);
    expect(fileSystem.kind(file)).toBe('file');
    expect(fileSystem.exists(dir)).toBe(true);
    expect(fileSystem.kind(dir)).toBe('directory');
    expect(fileSystem.exists(join(dir, '缺失.txt'))).toBe(false);
    expect(fileSystem.kind(join(dir, '缺失.txt'))).toBeNull();
  });

  it.skipIf(process.platform === 'win32')('既非普通文件也非目录的条目类型为 other', () => {
    // `/dev/null` 是字符设备：`statSync` 成功但 `isFile`/`isDirectory` 皆为 false。
    expect(fileSystem.exists('/dev/null')).toBe(true);
    expect(fileSystem.kind('/dev/null')).toBe('other');
  });
});

describe('createNodeFileSystem：目录与列举', () => {
  it('ensureDirectory 递归创建且对已存在目录幂等', () => {
    const deep = join(root, 'a', 'b', 'c');
    fileSystem.ensureDirectory(deep);
    expect(fileSystem.kind(deep)).toBe('directory');
    expect(() => fileSystem.ensureDirectory(deep)).not.toThrow();
    expect(fileSystem.kind(join(root, 'a', 'b'))).toBe('directory');
  });

  it('list 返回直接子项名称，不递归', () => {
    const dir = join(root, 'listing');
    fileSystem.writeText(join(dir, 'first.txt'), '1');
    fileSystem.writeText(join(dir, 'nested', 'second.txt'), '2');
    expect([...fileSystem.list(dir)].sort()).toEqual(['first.txt', 'nested']);
  });

  it('list 目录不存在时抛出底层错误', () => {
    expect(() => fileSystem.list(join(root, '没有这个目录'))).toThrow(/ENOENT/);
  });
});

describe('createNodeFileSystem：读写', () => {
  it('writeText 与 readText 保持 UTF-8 多字节内容', () => {
    const file = join(root, 'text', '中文 卡片.txt');
    fileSystem.writeText(file, '薯片生态\n第二行\n');
    expect(fileSystem.readText(file)).toBe('薯片生态\n第二行\n');
    expect(readFileSync(file, 'utf8')).toBe('薯片生态\n第二行\n');
  });

  it('writeBinary 与 readBinary 保持字节级一致', () => {
    const file = join(root, 'binary', 'payload.bin');
    const bytes = Uint8Array.from(Array.from({ length: 256 }, (_value, index): number => index));
    fileSystem.writeBinary(file, bytes);
    const read = fileSystem.readBinary(file);
    expect(read.length).toBe(256);
    expect([...read]).toEqual([...bytes]);
    expect(Buffer.from(read).equals(Buffer.from(bytes))).toBe(true);
  });

  it('写文本与二进制都自动创建缺失的父目录', () => {
    const textFile = join(root, 'auto', 'one', 'two', 'a.txt');
    const binaryFile = join(root, 'auto-bin', 'x', 'y', 'b.bin');
    fileSystem.writeText(textFile, 'x');
    fileSystem.writeBinary(binaryFile, new Uint8Array([1]));
    expect(fileSystem.kind(textFile)).toBe('file');
    expect(fileSystem.kind(binaryFile)).toBe('file');
    expect(fileSystem.kind(join(root, 'auto', 'one', 'two'))).toBe('directory');
  });

  it('读取不存在的文件抛出 ENOENT', () => {
    expect(() => fileSystem.readText(join(root, 'none.txt'))).toThrow(/ENOENT/);
    expect(() => fileSystem.readBinary(join(root, 'none.bin'))).toThrow(/ENOENT/);
  });
});

describe('createNodeFileSystem：删除、改名与临时目录', () => {
  it('remove 递归删除目录，对缺失路径静默', () => {
    const dir = join(root, 'doomed');
    fileSystem.writeText(join(dir, 'inner', 'file.txt'), 'x');
    expect(fileSystem.kind(dir)).toBe('directory');
    fileSystem.remove(dir);
    expect(fileSystem.exists(dir)).toBe(false);
    expect(() => fileSystem.remove(join(root, '已经不存在的目录'))).not.toThrow();
  });

  it('rename 移动文件后可在新路径读取', () => {
    const from = join(root, 'move', 'before.txt');
    const to = join(root, 'moved', 'after.txt');
    fileSystem.writeText(from, '可移动');
    fileSystem.ensureDirectory(join(root, 'moved'));
    fileSystem.rename(from, to);
    expect(fileSystem.exists(from)).toBe(false);
    expect(fileSystem.readText(to)).toBe('可移动');
  });

  it('createTempDirectory 以给定前缀创建互不相同的可写目录', () => {
    const prefix = join(root, 'tmp-');
    const left = fileSystem.createTempDirectory(prefix);
    const right = fileSystem.createTempDirectory(prefix);
    expect(left.startsWith(prefix)).toBe(true);
    expect(left).not.toBe(right);
    expect(statSync(left).isDirectory()).toBe(true);
    fileSystem.writeText(join(left, 'inside.txt'), 'ok');
    expect(fileSystem.readText(join(left, 'inside.txt'))).toBe('ok');
    rmSync(left, { recursive: true, force: true });
    rmSync(right, { recursive: true, force: true });
  });
});
