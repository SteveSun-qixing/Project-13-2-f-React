/**
 * 内存文件系统端口（测试专用）：目录用显式标记表示，文件内容为 UTF-8 字节。
 */

import { dirname, normalize } from 'node:path';

import type { FileSystemKind, IFileSystemPort } from '../../src/args/filesystem.js';

export class MemoryFileSystem implements IFileSystemPort {
  private readonly directories = new Set<string>(['/']);

  private readonly files = new Map<string, Uint8Array>();

  public writeText(path: string, content: string): void {
    this.writeBinary(path, new TextEncoder().encode(content));
  }

  public writeBinary(path: string, content: Uint8Array): void {
    const normalized = normalize(path);
    this.ensureDirectory(dirname(normalized));
    this.files.set(normalized, new Uint8Array(content));
  }

  public writeDirectory(path: string): void {
    const normalized = normalize(path);
    this.directories.add(normalized);
    let parent = dirname(normalized);
    while (parent !== '/' && parent !== '.') {
      this.directories.add(parent);
      parent = dirname(parent);
    }
  }

  public exists(path: string): boolean {
    const normalized = normalize(path);
    return this.directories.has(normalized) || this.files.has(normalized);
  }

  public kind(path: string): FileSystemKind | null {
    const normalized = normalize(path);
    if (this.directories.has(normalized)) {
      return 'directory';
    }
    if (this.files.has(normalized)) {
      return 'file';
    }
    return null;
  }

  public ensureDirectory(path: string): void {
    this.writeDirectory(path);
  }

  public list(path: string): readonly string[] {
    const normalized = normalize(path);
    if (!this.directories.has(normalized)) {
      throw new Error(`目录不存在：${normalized}`);
    }
    const prefix = normalized === '/' ? '/' : `${normalized}/`;
    const names = new Set<string>();
    for (const directory of this.directories) {
      if (directory === normalized || !directory.startsWith(prefix)) {
        continue;
      }
      const remainder = directory.slice(prefix.length);
      const [name] = remainder.split('/');
      if (name !== undefined && name.length > 0) {
        names.add(name);
      }
    }
    for (const file of this.files.keys()) {
      if (!file.startsWith(prefix)) {
        continue;
      }
      const remainder = file.slice(prefix.length);
      const [name] = remainder.split('/');
      if (name !== undefined && name.length > 0) {
        names.add(name);
      }
    }
    return [...names];
  }

  public readText(path: string): string {
    return new TextDecoder('utf-8', { fatal: true }).decode(this.readBinary(path));
  }

  public readBinary(path: string): Uint8Array {
    const normalized = normalize(path);
    const value = this.files.get(normalized);
    if (value === undefined) {
      throw new Error(`文件不存在：${normalized}`);
    }
    return new Uint8Array(value);
  }

  public remove(path: string): void {
    const normalized = normalize(path);
    this.files.delete(normalized);
    this.directories.delete(normalized);
    const prefix = `${normalized}/`;
    for (const file of [...this.files.keys()]) {
      if (file.startsWith(prefix)) {
        this.files.delete(file);
      }
    }
    for (const directory of [...this.directories]) {
      if (directory.startsWith(prefix)) {
        this.directories.delete(directory);
      }
    }
  }

  public rename(from: string, to: string): void {
    const data = this.readBinary(from);
    this.remove(from);
    this.writeBinary(to, data);
  }

  public createTempDirectory(prefix: string): string {
    const path = `${prefix}${Math.random().toString(36).slice(2, 10)}`;
    this.ensureDirectory(path);
    return path;
  }
}
