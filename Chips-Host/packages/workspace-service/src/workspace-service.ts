/**
 * 工作区服务：文件树扫描与卡片/箱子识别
 *
 * 逻辑来源：Chips-EditingEngine `src/services/workspace-service.ts buildTree`（task034 M6 上移）。
 * 识别规则（公共契约，冻结）：
 * - 卡片目录：目录内存在 `.card/metadata.yaml`；
 * - 卡片文件：`.card` 后缀；
 * - 箱子文件：`.box` 后缀；
 * - 其余目录为文件夹；
 * - 工作区根下排除 Host 运行时目录清单。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { createError } from '../../../src/shared/errors';

/** Host 运行时根目录条目（工作区根下排除，公共契约）。 */
export const HOST_RUNTIME_ROOT_ENTRIES = new Set([
  'plugins',
  'plugins.json',
  'plugin-runtime.json',
  'plugin-shortcuts.json',
  'route-manifest.json',
  'route-descriptor-manifest.json',
  'credentials.enc.json',
  'config.json',
  'config.workspace.json',
  'config.system.json',
  'host-state.json',
  'electron-user-data',
]);

export interface WorkspaceFileView {
  id: string;
  name: string;
  path: string;
  type: 'card' | 'box' | 'folder';
  createdAt: string;
  modifiedAt: string;
  children?: WorkspaceFileView[];
}

export interface WorkspaceScanOptions {
  rootPath: string;
}

export interface WorkspaceServiceOptions {
  /** 读取 .box 压缩包内部 metadata（由 Host box-service 提供，注入解耦） */
  readBoxMetadata?: (boxFile: string) => Promise<{
    boxId: string;
    name: string;
    createdAt: string;
    modifiedAt: string;
  } | null>;
}

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const asString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const stripExtension = (name: string, ext: string): string => {
  return name.toLowerCase().endsWith(ext) ? name.slice(0, -ext.length) : name;
};

const pathsEqual = (left: string, right: string): boolean => {
  const normalize = (value: string): string =>
    value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  return normalize(left) === normalize(right);
};

const readMetadataRecord = async (metadataPath: string): Promise<Record<string, unknown>> => {
  try {
    const raw = await fs.readFile(metadataPath, 'utf-8');
    return asRecord(yaml.parse(raw));
  } catch {
    return {};
  }
};

const toIso = (mtimeMs: number): string => new Date(mtimeMs).toISOString();

const readDirEntries = async (dir: string): Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>> => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch {
    return [];
  }
};

const statOf = async (targetPath: string): Promise<{ mtimeMs: number } | null> => {
  try {
    const stat = await fs.stat(targetPath);
    return { mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
};

export class WorkspaceService {
  public constructor(private readonly options: WorkspaceServiceOptions = {}) {}

  public async scan(options: WorkspaceScanOptions): Promise<WorkspaceFileView[]> {
    const { rootPath } = options;
    const rootStat = await statOf(rootPath);
    if (!rootStat) {
      throw createError('WORKSPACE_PATH_NOT_FOUND', `Workspace path not found: ${rootPath}`, { rootPath });
    }

    return this.buildTree(rootPath, rootPath);
  }

  private async buildTree(basePath: string, workspaceRoot: string): Promise<WorkspaceFileView[]> {
    const result: WorkspaceFileView[] = [];
    const entries = await readDirEntries(basePath);
    const isWorkspaceRoot = pathsEqual(basePath, workspaceRoot);

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      if (isWorkspaceRoot && HOST_RUNTIME_ROOT_ENTRIES.has(entry.name)) {
        continue;
      }

      const entryPath = path.join(basePath, entry.name);
      const stat = await statOf(entryPath);
      if (!stat) {
        continue;
      }

      if (entry.isDirectory) {
        const cardMetaPath = path.join(entryPath, '.card', 'metadata.yaml');
        if (await fs.stat(cardMetaPath).then(() => true).catch(() => false)) {
          result.push(await this.createWorkspaceCardFile(entryPath, stat.mtimeMs));
          continue;
        }

        const children = await this.buildTree(entryPath, workspaceRoot);
        result.push({
          id: entryPath,
          name: entry.name,
          path: entryPath,
          type: 'folder',
          createdAt: toIso(stat.mtimeMs),
          modifiedAt: toIso(stat.mtimeMs),
          children,
        });
        continue;
      }

      if (!entry.isFile) {
        continue;
      }

      const lowerName = entry.name.toLowerCase();
      if (lowerName.endsWith('.card')) {
        result.push({
          id: entryPath,
          name: entry.name,
          path: entryPath,
          type: 'card',
          createdAt: toIso(stat.mtimeMs),
          modifiedAt: toIso(stat.mtimeMs),
        });
      } else if (lowerName.endsWith('.box')) {
        result.push(await this.createWorkspaceBoxFile(entryPath, stat.mtimeMs));
      }
    }

    return result;
  }

  private async createWorkspaceCardFile(cardPath: string, fallbackMtimeMs: number): Promise<WorkspaceFileView> {
    const fileName = path.basename(cardPath);
    const metadata = await readMetadataRecord(path.join(cardPath, '.card', 'metadata.yaml'));
    const cardId = asString(metadata.card_id) ?? stripExtension(fileName, '.card');
    const cardName = asString(metadata.name) ?? fileName;
    const createdAt = asString(metadata.created_at) ?? toIso(fallbackMtimeMs);
    const modifiedAt = asString(metadata.modified_at) ?? toIso(fallbackMtimeMs);

    return {
      id: cardId,
      name: `${stripExtension(cardName, '.card')}.card`,
      path: cardPath,
      type: 'card',
      createdAt,
      modifiedAt,
    };
  }

  private async createWorkspaceBoxFile(boxPath: string, fallbackMtimeMs: number): Promise<WorkspaceFileView> {
    const fileName = path.basename(boxPath);

    if (this.options.readBoxMetadata) {
      try {
        const metadata = await this.options.readBoxMetadata(boxPath);
        if (metadata) {
          return {
            id: metadata.boxId,
            name: `${stripExtension(metadata.name, '.box')}.box`,
            path: boxPath,
            type: 'box',
            createdAt: metadata.createdAt,
            modifiedAt: metadata.modifiedAt,
          };
        }
      } catch {
        // 读取失败回退文件元数据
      }
    }

    return {
      id: boxPath,
      name: fileName,
      path: boxPath,
      type: 'box',
      createdAt: toIso(fallbackMtimeMs),
      modifiedAt: toIso(fallbackMtimeMs),
    };
  }
}
