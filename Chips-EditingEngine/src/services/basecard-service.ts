import type { BasecardSessionOpenOptions, BasecardValidationResult } from 'chips-sdk';
import { fileService } from './file-service';
import { getChipsClient } from './bridge-client';

export interface NormalizedBasecardSnapshot {
  pluginId: string;
  cardType: string;
  baseCardId: string;
  displayName: string;
  normalizedConfig: Record<string, unknown>;
  validation: BasecardValidationResult;
  referencedResources: string[];
  commitDebounceMs: number;
  supportsEditor: boolean;
}

export interface ImportedBasecardResource {
  path: string;
  url: string;
  name: string;
  size: number;
  mimeType?: string;
}

function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

function sanitizeFileName(fileName: string): string {
  const normalized = fileName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return normalized || 'resource';
}

function splitFileName(fileName: string): { stem: string; extension: string } {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return { stem: fileName, extension: '' };
  }

  return {
    stem: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  };
}

function inferMimeType(filePath: string): string | undefined {
  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lowerPath.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lowerPath.endsWith('.gif')) {
    return 'image/gif';
  }
  if (lowerPath.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  return undefined;
}

function buildDialogFilters(accept?: string[]): Array<{ name: string; extensions: string[] }> | undefined {
  if (!Array.isArray(accept) || accept.length === 0) {
    return undefined;
  }

  const normalized = accept.map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (normalized.includes('image/*')) {
    return [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],
      },
    ];
  }

  return undefined;
}

async function allocateResourcePath(cardRootDir: string, fileName: string): Promise<string> {
  const safeName = sanitizeFileName(fileName);
  const { stem, extension } = splitFileName(safeName);
  let counter = 1;

  while (true) {
    const candidateName = counter === 1 ? `${stem}${extension}` : `${stem}-${counter}${extension}`;
    const relativePath = joinPath('assets', candidateName);
    const absolutePath = joinPath(cardRootDir, relativePath);
    if (!(await fileService.exists(absolutePath))) {
      return relativePath;
    }
    counter += 1;
  }
}

async function selectResourceFile(accept?: string[]): Promise<string | null> {
  const result = await getChipsClient().invoke<{ options?: Record<string, unknown> }, { filePaths: string[] | null }>(
    'platform.dialogOpenFile',
    {
      options: {
        properties: ['openFile'],
        filters: buildDialogFilters(accept),
      },
    },
  );

  const filePath = Array.isArray(result.filePaths) ? result.filePaths[0] : null;
  return typeof filePath === 'string' && filePath.trim().length > 0 ? filePath : null;
}

export async function normalizeBasecardSnapshot(
  options: BasecardSessionOpenOptions,
): Promise<NormalizedBasecardSnapshot> {
  const session = await getChipsClient().card.basecard.openSession(options);
  try {
    return {
      pluginId: session.pluginId,
      cardType: session.cardType,
      baseCardId: session.baseCardId,
      displayName: session.displayName,
      normalizedConfig: session.normalizedConfig,
      validation: session.validation,
      referencedResources: session.referencedResources,
      commitDebounceMs: session.commitDebounceMs,
      supportsEditor: session.supportsEditor,
    };
  } finally {
    await getChipsClient().card.basecard.closeSession(session.sessionId).catch(() => ({ closed: false }));
  }
}

export async function importBasecardResourceToCardRoot(options: {
  cardRootDir: string;
  accept?: string[];
}): Promise<ImportedBasecardResource | null> {
  const sourcePath = await selectResourceFile(options.accept);
  if (!sourcePath) {
    return null;
  }

  const fileName = sourcePath.split('/').pop() ?? sourcePath.split('\\').pop() ?? 'resource';
  const relativePath = await allocateResourcePath(options.cardRootDir, fileName);
  const destinationPath = joinPath(options.cardRootDir, relativePath);
  const destinationDir = destinationPath.split('/').slice(0, -1).join('/');
  const binary = await fileService.readBinary(sourcePath);

  await fileService.ensureDir(destinationDir);
  await fileService.writeBinary(destinationPath, binary);

  return {
    path: relativePath,
    url: relativePath,
    name: fileName,
    size: binary.byteLength,
    mimeType: inferMimeType(fileName),
  };
}

export const basecardService = {
  normalizeSnapshot: normalizeBasecardSnapshot,
  importResourceToCardRoot: importBasecardResourceToCardRoot,
};
