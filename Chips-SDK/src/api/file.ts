import type { CoreClient } from "../types/client";
import { createError } from "../types/errors";

export interface FileReadOptions {
  encoding?: "utf-8" | "binary";
}

export type FileContent = string | Uint8Array;

export interface FileStat {
  path: string;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtimeMs: number;
}

export interface FileEntry {
  path: string;
  isFile: boolean;
  isDirectory: boolean;
}

export interface FileApi {
  read(path: string, options?: FileReadOptions): Promise<FileContent>;
  write(path: string, content: FileContent, options?: { encoding?: "utf-8" | "binary" }): Promise<void>;
  stat(path: string): Promise<FileStat>;
  list(dir: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  delete(path: string, options?: { recursive?: boolean }): Promise<void>;
  copy(source: string, destination: string, options?: { overwrite?: boolean }): Promise<void>;
  move(source: string, destination: string, options?: { overwrite?: boolean }): Promise<void>;
}

export function createFileApi(client: CoreClient): FileApi {
  return {
    async read(path, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.read: path is required.");
      }
      const result = await client.invoke<{ path: string; encoding?: "utf-8" | "binary" }, { content: FileContent }>(
        "file.read",
        { path, ...options },
      );
      return result.content;
    },
    async write(path, content, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.write: path is required.");
      }
      await client.invoke("file.write", { path, content, ...options });
    },
    async stat(path) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.stat: path is required.");
      }
      const result = await client.invoke<{ path: string }, { meta: FileStat }>("file.stat", { path });
      return result.meta;
    },
    async list(dir) {
      if (!dir) {
        throw createError("INVALID_ARGUMENT", "file.list: dir is required.");
      }
      const result = await client.invoke<{ dir: string }, { entries: string[] }>("file.list", { dir });
      return result.entries;
    },
    async exists(path) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.exists: path is required.");
      }
      const result = await client.invoke<{ path: string }, { exists: boolean }>("file.exists", { path });
      return result.exists;
    },
    async mkdir(path, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.mkdir: path is required.");
      }
      await client.invoke("file.mkdir", { path, options });
    },
    async delete(path, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.delete: path is required.");
      }
      await client.invoke("file.delete", { path, options });
    },
    async copy(source, destination, options) {
      if (!source || !destination) {
        throw createError("INVALID_ARGUMENT", "file.copy: source and destination are required.");
      }
      await client.invoke("file.copy", { source, destination, options });
    },
    async move(source, destination, options) {
      if (!source || !destination) {
        throw createError("INVALID_ARGUMENT", "file.move: source and destination are required.");
      }
      await client.invoke("file.move", { source, destination, options });
    },
  };
}
