import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createError } from '../../../src/shared/errors';
import { resolveHandlerFromRecords, sanitizeHandlerPreferences } from './handler-resolver';

type ResourceHandlerPluginType = 'app' | 'card' | 'layout' | 'module' | 'theme';

interface QueryPluginRecord {
  id: string;
  enabled: boolean;
  type: ResourceHandlerPluginType;
  capabilities?: string[];
}

export interface ResourceOpenRequest {
  intent?: string;
  resource: {
    resourceId: string;
    mimeType?: string;
    title?: string;
    fileName?: string;
    payload?: Record<string, unknown>;
  };
}

export interface ResourceOpenResolvedResource {
  resourceId: string;
  filePath?: string;
  mimeType?: string;
  extension?: string;
  fileName?: string;
}

export interface ResourceOpenResult {
  mode: 'plugin' | 'shell' | 'external';
  pluginId?: string;
  windowId?: string;
  matchedCapability?: string;
  resolved: ResourceOpenResolvedResource;
}

export interface ResourceOpenServiceOptions {
  queryHandlerPlugins(): Promise<QueryPluginRecord[]>;
  /**
   * 读取用户默认查看器偏好（`fileOpen.defaults` 配置键，user 作用域）。
   * 返回 undefined 表示未设置任何偏好。
   */
  readHandlerPreferences(): Promise<Record<string, string> | undefined>;
  launchPlugin(pluginId: string, launchParams: Record<string, unknown>): Promise<{ windowId: string }>;
  resolveResourceFilePath(resourceId: string): string | null;
  openPath(filePath: string): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.azw': 'application/vnd.amazon.ebook',
  '.azw3': 'application/vnd.amazon.ebook',
  '.djv': 'image/vnd.djvu',
  '.djvu': 'image/vnd.djvu',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.epub': 'application/epub+zip',
  '.epub3': 'application/epub+zip',
  '.fb2': 'application/x-fictionbook+xml',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.markdown': 'text/markdown',
  '.md': 'text/markdown',
  '.mobi': 'application/x-mobipocket-ebook',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.rtf': 'application/rtf',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
};

const normalizeIntent = (value: string | undefined): string => {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : 'view';
};

const normalizeMimeType = (value: string | undefined): string | undefined => {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const inferMimeType = (extension: string | undefined): string | undefined => {
  if (!extension) {
    return undefined;
  }
  return MIME_BY_EXTENSION[extension.toLowerCase()];
};

const resolveExtension = (filePath: string | undefined, resourceId: string): string | undefined => {
  const candidate = filePath ?? resourceId;
  const extension = path.extname(candidate).trim().toLowerCase();
  return extension.length > 0 ? extension : undefined;
};

export class ResourceOpenService {
  public constructor(private readonly options: ResourceOpenServiceOptions) {}

  public async openResource(request: ResourceOpenRequest): Promise<ResourceOpenResult> {
    const intent = normalizeIntent(request.intent);
    const resourceId = request.resource.resourceId.trim();
    if (!resourceId) {
      throw createError('INVALID_ARGUMENT', 'resource.resourceId is required.');
    }

    const filePath = this.resolveFilePath(resourceId);
    const extension = resolveExtension(filePath ?? undefined, resourceId);
    const mimeType = normalizeMimeType(request.resource.mimeType) ?? inferMimeType(extension);
    const fileName = request.resource.fileName?.trim() || (filePath ? path.basename(filePath) : undefined);
    const title = request.resource.title?.trim() || fileName;
    const payload =
      request.resource.payload && typeof request.resource.payload === 'object' && !Array.isArray(request.resource.payload)
        ? request.resource.payload
        : undefined;
    const matchedPlugin = await this.resolveHandlerPlugin(intent, mimeType, extension);

    const resolved: ResourceOpenResolvedResource = {
      resourceId,
      filePath: filePath ?? undefined,
      mimeType,
      extension,
      fileName,
    };

    if (matchedPlugin) {
      const launched = await this.options.launchPlugin(matchedPlugin.pluginId, {
        ...(filePath ? { targetPath: filePath } : undefined),
        trigger: 'resource-open-service',
        resourceOpen: {
          intent,
          resourceId,
          filePath: filePath ?? undefined,
          mimeType,
          extension,
          fileName,
          title,
          matchedCapability: matchedPlugin.capability,
          ...(payload ? { payload } : undefined),
        },
      });
      return {
        mode: 'plugin',
        pluginId: matchedPlugin.pluginId,
        windowId: launched.windowId,
        matchedCapability: matchedPlugin.capability,
        resolved,
      };
    }

    if (filePath) {
      await this.options.openPath(filePath);
      return {
        mode: 'shell',
        resolved,
      };
    }

    if (this.isExternalUrl(resourceId)) {
      await this.options.openExternalUrl(resourceId);
      return {
        mode: 'external',
        resolved,
      };
    }

    throw createError('RESOURCE_HANDLER_MISSING', 'No enabled app plugin can open the requested resource.', {
      intent,
      resourceId,
      mimeType,
      extension,
    });
  }

  private resolveFilePath(resourceId: string): string | null {
    try {
      const parsed = new URL(resourceId);
      if (parsed.protocol === 'file:') {
        return fileURLToPath(parsed);
      }
    } catch {
      return path.resolve(resourceId);
    }

    return this.options.resolveResourceFilePath(resourceId);
  }

  private isExternalUrl(resourceId: string): boolean {
    try {
      const parsed = new URL(resourceId);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private async resolveHandlerPlugin(
    intent: string,
    mimeType: string | undefined,
    extension: string | undefined,
  ): Promise<{ pluginId: string; capability: string } | null> {
    const plugins = (await this.options.queryHandlerPlugins())
      .filter((plugin) => plugin.enabled && plugin.type === 'app')
      .map((plugin) => ({
        pluginId: plugin.id,
        capabilities: [...new Set(plugin.capabilities ?? [])],
      }));

    const preferences = sanitizeHandlerPreferences(await this.options.readHandlerPreferences());
    const resolution = resolveHandlerFromRecords({
      plugins,
      intent,
      mimeType,
      extension,
      preferences,
    });

    return resolution ? { pluginId: resolution.pluginId, capability: resolution.capability } : null;
  }
}
