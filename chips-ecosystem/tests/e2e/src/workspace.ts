import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveE2eRoot, resolveFixturesRoot } from './environment';
import type { FixtureManifest } from './types';

/** 用例工作区中需要装配的夹具文档。 */
export interface FixtureSelection {
  /** 目录态卡片（编辑工作形态）。 */
  readonly cardDirectory?: boolean;
  /** 归档态卡片（ZIP Store 交付形态）。 */
  readonly cardArchive?: boolean;
  /** 归档态箱子（内嵌一张卡片）。 */
  readonly boxArchive?: boolean;
}

/** 每个用例独立的工作区；只承载用户文档，`.chips/` 保留区由平台初始化。 */
export interface TestWorkspace {
  /** 工作区根目录绝对路径；作为 `--workspace=<path>` 传入宿主。 */
  readonly root: string;
  /** 目录态卡片绝对路径（未装配时为 null）。 */
  readonly cardDirectoryPath: string | null;
  /** 归档态卡片绝对路径（未装配时为 null）。 */
  readonly cardArchivePath: string | null;
  /** 归档态箱子绝对路径（未装配时为 null）。 */
  readonly boxArchivePath: string | null;
  /** 夹具清单快照。 */
  readonly manifest: FixtureManifest;
  /** 解析工作区内的相对路径。 */
  path(relativePath: string): string;
  /** 读取工作区内文本文件。 */
  readText(relativePath: string): Promise<string>;
  /** 写入工作区内文本文件（用于外部修改场景）。 */
  writeText(relativePath: string, content: string): Promise<void>;
  /** 删除整个工作区。 */
  dispose(): Promise<void>;
}

export interface CreateTestWorkspaceOptions {
  /** 工作区目录名标签（用于失败产物定位）；默认 `workspace`。 */
  readonly label?: string;
  /** 夹具装配选择；默认装配全部三份文档。 */
  readonly fixtures?: FixtureSelection;
}

/** 读取夹具清单（`fixtures/manifest.json`），由生成脚本产出。 */
export async function loadFixtureManifest(): Promise<FixtureManifest> {
  const manifestPath = path.join(resolveFixturesRoot(), 'manifest.json');
  return JSON.parse(await readFile(manifestPath, 'utf8')) as FixtureManifest;
}

/**
 * 创建隔离的用例工作区并装配产品级夹具。
 *
 * 工作区根位于 `tests/e2e/test-results/workspaces/`（随 Playwright 产物清理），
 * 只复制夹具文档，不创建 `.chips/` 等平台保留区。
 */
export async function createTestWorkspace(
  options: CreateTestWorkspaceOptions = {}
): Promise<TestWorkspace> {
  const manifest = await loadFixtureManifest();
  const selection: FixtureSelection = options.fixtures ?? {
    cardDirectory: true,
    cardArchive: true,
    boxArchive: true,
  };
  const label = sanitizeLabel(options.label ?? 'workspace');
  const root = path.join(
    resolveE2eRoot(),
    'test-results',
    'workspaces',
    `${label}-${randomUUID().slice(0, 8)}`
  );
  await mkdir(root, { recursive: true });

  const fixturesRoot = resolveFixturesRoot();
  let cardDirectoryPath: string | null = null;
  let cardArchivePath: string | null = null;
  let boxArchivePath: string | null = null;

  if (selection.cardDirectory === true) {
    cardDirectoryPath = path.join(root, `${manifest.card.name}.card`);
    await cp(path.join(fixturesRoot, manifest.card.directoryPath), cardDirectoryPath, {
      recursive: true,
    });
  }
  if (selection.cardArchive === true) {
    cardArchivePath = path.join(root, '归档', `${manifest.card.name}.card`);
    await mkdir(path.dirname(cardArchivePath), { recursive: true });
    await cp(path.join(fixturesRoot, manifest.card.archivePath), cardArchivePath);
  }
  if (selection.boxArchive === true) {
    boxArchivePath = path.join(root, `${manifest.box.name}.box`);
    await cp(path.join(fixturesRoot, manifest.box.archivePath), boxArchivePath);
  }

  return {
    root,
    cardDirectoryPath,
    cardArchivePath,
    boxArchivePath,
    manifest,
    path(relativePath: string): string {
      return path.join(root, relativePath);
    },
    async readText(relativePath: string): Promise<string> {
      return readFile(path.join(root, relativePath), 'utf8');
    },
    async writeText(relativePath: string, content: string): Promise<void> {
      const target = path.join(root, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, 'utf8');
    },
    async dispose(): Promise<void> {
      await rm(root, { recursive: true, force: true });
    },
  };
}

/** 夹具卡片内容节点的 YAML 相对路径（`content/<nodeId>.yaml`）。 */
export function cardContentRelativePath(manifest: FixtureManifest): string {
  return path.join('content', `${manifest.card.nodeId}.yaml`);
}

function sanitizeLabel(label: string): string {
  const normalized = label.replace(/[^0-9A-Za-z_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'workspace';
}
