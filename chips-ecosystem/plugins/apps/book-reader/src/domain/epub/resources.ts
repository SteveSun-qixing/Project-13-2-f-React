import { bytesToDataUri } from '../../core/binary';
import type { EpubArchive } from './archive';
import { resolveExtension } from '../../core/book-model';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.htm': 'text/html',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.ncx': 'application/x-dtbncx+xml',
  '.opf': 'application/oebps-package+xml',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xhtml': 'application/xhtml+xml',
  '.xml': 'application/xml',
};

export function resolveEpubMimeType(path: string, explicitMimeType?: string): string {
  const explicit = explicitMimeType?.trim().toLowerCase();
  if (explicit) {
    return explicit;
  }

  const extension = resolveExtension(path);
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

export async function readArchiveDataUri(
  archive: EpubArchive,
  path: string,
  explicitMimeType?: string
): Promise<string> {
  return bytesToDataUri(
    await archive.readBinary(path),
    resolveEpubMimeType(path, explicitMimeType)
  );
}
