import * as path from 'path';

export interface WebResourceOpenRequest {
  intent?: string;
  resource: {
    resourceId: string;
    mimeType?: string;
    title?: string;
    fileName?: string;
    payload?: Record<string, unknown>;
  };
}

export interface WebResourceOpenPlan {
  mode: 'plugin' | 'external';
  pluginId?: string;
  matchedCapability?: string;
  resolved: {
    resourceId: string;
    mimeType?: string;
    extension?: string;
    fileName?: string;
  };
}

export interface WebResourceHandlerPlugin {
  manifest: {
    id: string;
    capabilities?: string[];
  };
}

const WEB_RESOURCE_MIME_BY_EXTENSION: Record<string, string> = {
  '.aac': 'audio/aac',
  '.avif': 'image/avif',
  '.azw': 'application/vnd.amazon.ebook',
  '.azw3': 'application/vnd.amazon.ebook',
  '.bmp': 'image/bmp',
  '.djv': 'image/vnd.djvu',
  '.djvu': 'image/vnd.djvu',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.epub': 'application/epub+zip',
  '.epub3': 'application/epub+zip',
  '.fb2': 'application/x-fictionbook+xml',
  '.flac': 'audio/flac',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4a': 'audio/mp4',
  '.m4v': 'video/x-m4v',
  '.markdown': 'text/markdown',
  '.md': 'text/markdown',
  '.mobi': 'application/x-mobipocket-ebook',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.oga': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.ogv': 'video/ogg',
  '.opus': 'audio/opus',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.rtf': 'application/rtf',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
};

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeResourceIntent(value: string | undefined): string {
  return normalizeOptionalString(value)?.toLowerCase() ?? 'view';
}

function inferResourceExtension(resourceId: string, fileName?: string): string | undefined {
  const candidate = normalizeOptionalString(fileName) ?? resourceId;
  if (!candidate) {
    return undefined;
  }

  try {
    const parsed = new URL(candidate);
    const extension = path.extname(parsed.pathname).trim().toLowerCase();
    return extension.length > 0 ? extension : undefined;
  } catch {
    const extension = path.extname(candidate).trim().toLowerCase();
    return extension.length > 0 ? extension : undefined;
  }
}

function inferResourceMimeType(mimeType: string | undefined, extension: string | undefined): string | undefined {
  const normalizedMimeType = normalizeOptionalString(mimeType)?.toLowerCase();
  if (normalizedMimeType) {
    return normalizedMimeType;
  }

  if (!extension) {
    return undefined;
  }

  return WEB_RESOURCE_MIME_BY_EXTENSION[extension];
}

function buildResourceHandlerCapabilities(intent: string, mimeType: string | undefined, extension: string | undefined): string[] {
  const capabilities: string[] = [];

  if (mimeType) {
    capabilities.push(`resource-handler:${intent}:${mimeType}`);
    const slashIndex = mimeType.indexOf('/');
    if (slashIndex > 0) {
      capabilities.push(`resource-handler:${intent}:${mimeType.slice(0, slashIndex)}/*`);
    }
  }

  if (extension) {
    capabilities.push(`file-handler:${extension}`);
  }

  return capabilities;
}

function isExternalUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'data:' || parsed.protocol === 'blob:';
  } catch {
    return false;
  }
}

export function resolveWebResourceOpenPlanFromPlugins(
  request: WebResourceOpenRequest,
  plugins: WebResourceHandlerPlugin[],
): WebResourceOpenPlan {
  const resourceId = normalizeOptionalString(request.resource.resourceId);
  if (!resourceId) {
    throw new Error('resource.resourceId is required');
  }

  const extension = inferResourceExtension(resourceId, request.resource.fileName);
  const mimeType = inferResourceMimeType(request.resource.mimeType, extension);
  const intent = normalizeResourceIntent(request.intent);
  const candidates = buildResourceHandlerCapabilities(intent, mimeType, extension);

  for (const capability of candidates) {
    const matched = plugins.find((record) => (record.manifest.capabilities ?? []).includes(capability));
    if (matched) {
      return {
        mode: 'plugin',
        pluginId: matched.manifest.id,
        matchedCapability: capability,
        resolved: {
          resourceId,
          mimeType,
          extension,
          fileName: normalizeOptionalString(request.resource.fileName),
        },
      };
    }
  }

  if (isExternalUrl(resourceId)) {
    return {
      mode: 'external',
      resolved: {
        resourceId,
        mimeType,
        extension,
        fileName: normalizeOptionalString(request.resource.fileName),
      },
    };
  }

  throw new Error(`No web-capable plugin can open resource: ${resourceId}`);
}
