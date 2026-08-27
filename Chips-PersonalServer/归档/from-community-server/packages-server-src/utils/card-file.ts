import * as fs from 'fs';
import * as path from 'path';
import { unpackCard } from '../pipeline/card-unpack';
import { sha256File } from '../storage/s3';
import type { ResourceFile } from '../types/card';

export interface CardSourceResourceEntry {
  relativePath: string;
  size: number;
  filename: string;
}

export interface CardSourceInspection {
  sha256: string;
  sizeBytes: number;
  metadata: Record<string, unknown>;
  structure: Record<string, unknown>;
  contentMap: Map<string, Record<string, unknown>>;
  resourceFiles: CardSourceResourceEntry[];
  title: string;
  cardFileId: string;
  coverRatio: string | null;
  coverHtml: string | null;
}

function toResourceEntry(resourceFile: ResourceFile): CardSourceResourceEntry {
  return {
    relativePath: resourceFile.relativePath,
    size: resourceFile.size,
    filename: resourceFile.filename,
  };
}

export async function inspectCardSourceFile(filePath: string): Promise<CardSourceInspection> {
  const [sha256, unpacked] = await Promise.all([
    sha256File(filePath),
    unpackCard(filePath),
  ]);

  try {
    const metadata = unpacked.metadata as unknown as Record<string, unknown>;
    const structure = unpacked.structure as unknown as Record<string, unknown>;
    const title = String(metadata.name ?? metadata.title ?? '未命名卡片');
    const cardFileId = String(metadata.id ?? metadata.card_id);
    const coverRatio = typeof metadata.cover_ratio === 'string' && metadata.cover_ratio.trim()
      ? metadata.cover_ratio.trim()
      : null;
    const stat = fs.statSync(filePath);

    return {
      sha256,
      sizeBytes: stat.size,
      metadata,
      structure,
      contentMap: new Map(unpacked.contentMap),
      resourceFiles: unpacked.resourceFiles.map(toResourceEntry),
      title,
      cardFileId,
      coverRatio,
      coverHtml: unpacked.coverHtml ?? null,
    };
  } finally {
    fs.rmSync(unpacked.tempDir, { recursive: true, force: true });
  }
}

export function createDefaultCoverHtml(title: string): string {
  const safeTitle = title
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; min-height: 100%; }
      body {
        min-height: 100vh;
        display: grid;
        place-items: end stretch;
        padding: clamp(18px, 5vw, 32px);
        background: linear-gradient(155deg, #f8fbff 0%, #dfeeff 44%, #b7d7ff 100%);
        color: #101828;
        font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
      }
      h1 { margin: 0; font-size: clamp(28px, 7vw, 54px); line-height: 1; }
    </style>
  </head>
  <body>
    <h1>${safeTitle}</h1>
  </body>
</html>`;
}

export function isEmptyCoverHtml(coverHtml: string | null): boolean {
  return !coverHtml || coverHtml.replace(/\s+/g, ' ').trim().length === 0;
}

export function normalizeStorageRelativePath(relativePath: string): string {
  return path.posix.normalize(relativePath.replace(/\\/g, '/')).replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
}
