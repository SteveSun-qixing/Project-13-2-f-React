/**
 * 卡片会话资源生命周期：待导入/待删除队列、封面资源 reconcile、物理回收
 *
 * 逻辑来源：Chips-EditingEngine `src/core/card-service.ts`（task034 M2 上移）。
 * 路径安全（防 .. 逃逸）统一由本模块收口。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createError } from '../../../../src/shared/errors';
import { normalizeRelativeResourcePath } from '../../../../src/shared/resource-path';
import type { CardSessionResourceImport, CardSessionResourceOperations, CardSessionState } from './types';

/** 归一化资源路径；非法返回 null。 */
export const normalizeResourcePath = (resourcePath: string): string | null => {
  return normalizeRelativeResourcePath(resourcePath);
};

const safeJoin = (cardDir: string, resourcePath: string): string => {
  const normalized = normalizeRelativeResourcePath(resourcePath);
  if (!normalized) {
    throw createError('CARD_SESSION_INVALID_RESOURCE_PATH', `Invalid resource path: ${resourcePath}`);
  }
  return path.join(cardDir, normalized);
};

/**
 * 应用资源操作到会话：登记待导入资源、登记待删除资源、
 * 基于配置引用关系取消被引用资源的删除意图。
 */
export async function applyResourceOperations(
  state: CardSessionState,
  basicCardId: string,
  resourceOperations: CardSessionResourceOperations | undefined,
  collectResourcePaths: (cardType: string, config: Record<string, unknown>) => string[] | Promise<string[]>,
): Promise<void> {
  const basicCard = state.snapshot.structure.basicCards.find((card) => card.id === basicCardId);
  if (!basicCard) {
    return;
  }

  for (const resource of resourceOperations?.imports ?? []) {
    const normalizedPath = normalizeResourcePath(resource.path);
    if (!normalizedPath) {
      continue;
    }
    state.pendingResourceImports.set(normalizedPath, {
      path: normalizedPath,
      data: new Uint8Array(resource.data),
      mimeType: resource.mimeType,
      token: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    });
    state.pendingResourceDeletions.delete(normalizedPath);
  }

  for (const resourcePath of resourceOperations?.deletions ?? []) {
    const normalizedPath = normalizeResourcePath(resourcePath);
    if (!normalizedPath) {
      continue;
    }
    if (!state.pendingResourceImports.delete(normalizedPath)) {
      state.pendingResourceDeletions.add(normalizedPath);
    }
  }

  for (const referencedPath of await collectResourcePaths(basicCard.type, basicCard.data)) {
    state.pendingResourceDeletions.delete(referencedPath);
  }
}

/** 采集基础卡片配置引用的资源路径（经描述符 collectResourcePaths）。 */
export async function collectBasicCardResourcePaths(
  cardType: string,
  config: Record<string, unknown>,
  collectResourcePaths: (cardType: string, config: Record<string, unknown>) => string[] | Promise<string[]>,
): Promise<string[]> {
  const paths = await collectResourcePaths(cardType, config);
  const unique = new Set<string>();
  for (const rawPath of paths) {
    const normalizedPath = normalizeResourcePath(rawPath);
    if (normalizedPath) {
      unique.add(normalizedPath);
    }
  }
  return [...unique];
}

/** 将待导入资源物理写入卡片根目录。 */
export async function flushPendingImports(cardDir: string, state: CardSessionState): Promise<void> {
  for (const resource of state.pendingResourceImports.values()) {
    const absolutePath = safeJoin(cardDir, resource.path);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, resource.data);
  }
}

/** 基于最终引用关系执行待删除资源的物理回收，返回删除数量。 */
export async function finalizePendingDeletions(
  cardDir: string,
  state: CardSessionState,
  collectResourcePaths: (cardType: string, config: Record<string, unknown>) => string[] | Promise<string[]>,
): Promise<number> {
  const referencedPaths = new Set<string>();
  for (const basicCard of state.snapshot.structure.basicCards) {
    for (const resourcePath of await collectBasicCardResourcePaths(basicCard.type, basicCard.data, collectResourcePaths)) {
      referencedPaths.add(resourcePath);
    }
  }

  let deletedCount = 0;
  for (const resourcePath of Array.from(state.pendingResourceDeletions)) {
    if (referencedPaths.has(resourcePath)) {
      state.pendingResourceDeletions.delete(resourcePath);
      continue;
    }

    const absolutePath = safeJoin(cardDir, resourcePath);
    try {
      await fs.rm(absolutePath, { force: true });
      await pruneEmptyDirectories(cardDir, path.dirname(absolutePath));
      deletedCount += 1;
    } catch {
      // 删除失败不阻断会话，交由 persist-error 上报
    }
    state.pendingResourceDeletions.delete(resourcePath);
  }

  return deletedCount;
}

async function pruneEmptyDirectories(cardDir: string, dirPath: string): Promise<void> {
  let current = dirPath;
  while (current.startsWith(cardDir) && current !== cardDir) {
    let entries;
    try {
      entries = await fs.readdir(current);
    } catch {
      return;
    }
    if (entries.length > 0) {
      return;
    }
    await fs.rmdir(current).catch(() => undefined);
    current = path.dirname(current);
  }
}

/** 清除已持久化的待导入资源登记（按 token 匹配，避免并发覆盖丢失）。 */
export function clearPersistedImports(liveState: CardSessionState, snapshotState: CardSessionState): void {
  for (const [resourcePath, liveResource] of liveState.pendingResourceImports) {
    const snapshotResource = snapshotState.pendingResourceImports.get(resourcePath);
    if (snapshotResource && snapshotResource.token === liveResource.token) {
      liveState.pendingResourceImports.delete(resourcePath);
    }
  }
}
