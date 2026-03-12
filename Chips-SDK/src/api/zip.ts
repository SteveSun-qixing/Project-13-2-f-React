import type { CoreClient } from "../types/client";
import { createError } from "../types/errors";

export interface ZipEntry {
  path: string;
  size: number;
  compressedSize?: number;
  isDirectory: boolean;
}

export interface ZipApi {
  compress(inputDir: string, outputZip: string): Promise<void>;
  extract(zipPath: string, outputDir: string): Promise<void>;
  list(zipPath: string): Promise<ZipEntry[]>;
}

export function createZipApi(client: CoreClient): ZipApi {
  return {
    async compress(inputDir, outputZip) {
      if (!inputDir || !outputZip) {
        throw createError("INVALID_ARGUMENT", "zip.compress: inputDir and outputZip are required.");
      }
      await client.invoke("zip.compress", { inputDir, outputZip });
    },
    async extract(zipPath, outputDir) {
      if (!zipPath || !outputDir) {
        throw createError("INVALID_ARGUMENT", "zip.extract: zipPath and outputDir are required.");
      }
      await client.invoke("zip.extract", { zipPath, outputDir });
    },
    async list(zipPath) {
      if (!zipPath) {
        throw createError("INVALID_ARGUMENT", "zip.list: zipPath is required.");
      }
      const result = await client.invoke<{ zipPath: string }, { entries: ZipEntry[] }>("zip.list", { zipPath });
      return result.entries;
    },
  };
}
