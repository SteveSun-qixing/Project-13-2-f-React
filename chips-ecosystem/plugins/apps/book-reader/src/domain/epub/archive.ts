/**
 * EPUB 归档门面：架在 `@chips/plugin-book` 已交付的 ZIP 纯解析（中央目录解析 /
 * 条目字节提取，store 与 deflate-raw、ZIP64、CP437、安全路径过滤）之上的阅读侧适配层。
 *
 * 本包不再持有第二份 ZIP 解析实现（W5 迁移复用红线）；本模块只承载阅读器需要的
 * 门面语义：条目清单、路径归一后的存在性判定、二进制与文本的双缓存读取。
 * 解析失败一律以简体中文消息抛出，由调用方决定呈现口径。
 */

import { extractZipEntry, parseZipEntries, type ZipEntry } from '@chips/plugin-book';
import { normalizeEpubPath } from './path';
import type { ReadableBookArchive, ReadableBookArchiveEntry } from './types';

function entryToArchiveEntry(entry: ZipEntry): ReadableBookArchiveEntry {
  return {
    path: entry.path,
    size: entry.uncompressedSize,
    compressedSize: entry.compressedSize,
    crc32: entry.crc32,
    offset: entry.localHeaderOffset,
    isDirectory: entry.isDirectory,
  };
}

function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export class EpubArchive implements ReadableBookArchive {
  private readonly bytes: ArrayBuffer;
  private readonly entries: Map<string, ZipEntry>;
  private readonly binaryCache = new Map<string, Uint8Array>();
  private readonly textCache = new Map<string, string>();

  public constructor(bytes: Uint8Array, entries: ZipEntry[]) {
    this.bytes = copyBytesToArrayBuffer(bytes);
    this.entries = new Map(entries.map((entry) => [normalizeEpubPath(entry.path), entry]));
  }

  public listEntries(): ReadableBookArchiveEntry[] {
    return Array.from(this.entries.values()).map(entryToArchiveEntry);
  }

  public hasEntry(path: string): boolean {
    return this.entries.has(normalizeEpubPath(path));
  }

  public async readBinary(entryPath: string): Promise<Uint8Array> {
    const normalized = normalizeEpubPath(entryPath);
    const cached = this.binaryCache.get(normalized);
    if (cached) {
      return cached;
    }

    const entry = this.entries.get(normalized);
    if (!entry || entry.isDirectory) {
      throw new Error(`EPUB 资源不存在：${entryPath}`);
    }

    const result = await extractZipEntry(this.bytes, entry);
    this.binaryCache.set(normalized, result);
    return result;
  }

  public async readText(entryPath: string): Promise<string> {
    const normalized = normalizeEpubPath(entryPath);
    const cached = this.textCache.get(normalized);
    if (cached) {
      return cached;
    }

    const decoded = new TextDecoder('utf-8').decode(await this.readBinary(normalized));
    this.textCache.set(normalized, decoded);
    return decoded;
  }
}

/** 打开 EPUB 归档：解析中央目录并建立路径归一后的条目表（不安全路径已被共享解析过滤）。 */
export function openEpubArchive(bytes: Uint8Array): Promise<EpubArchive> {
  const entries = parseZipEntries(copyBytesToArrayBuffer(bytes));
  return Promise.resolve(new EpubArchive(bytes, entries));
}
