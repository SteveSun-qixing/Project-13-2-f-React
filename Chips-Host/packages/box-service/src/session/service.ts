/**
 * 箱子编辑会话聚合服务
 *
 * 动作面：box.create / box.rename / box.session.*（见 constants.ts）。
 * 会话工作目录由 Host 分配回收；自动保存由本服务管理，应用只订阅事件。
 * 内嵌卡片（addEmbeddedCard）接口开放，官方编辑引擎默认链接不调用。
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createError } from '../../../../src/shared/errors';
import { guessMimeType } from '../../../../src/shared/mime';
import { normalizeRelativeResourcePath } from '../../../../src/shared/resource-path';
import type { BoxEntrySnapshot, BoxLayoutConfig, BoxMetadata } from '../box-service';
import { BoxAutosaveScheduler } from './autosave';
import { BOX_SESSION_ERROR_CODES } from './constants';
import { writeBoxDocumentFiles, normalizeEntrySortOrder } from './document-codec';
import { BoxSessionHistory } from './history';
import type { BoxSessionOptions, BoxSessionSnapshot, BoxSessionState } from './types';

export interface BoxSessionEventSink {
  emit(event: string, payload: unknown): void;
}

export interface BoxCreateResult {
  boxFile: string;
  metadata: BoxMetadata;
}

export interface BoxSessionOpenResult {
  sessionId: string;
  snapshot: BoxSessionSnapshot;
}

const joinPath = (...parts: string[]): string => {
  return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
};

const stripExtension = (name: string, ext: string): string => {
  return name.toLowerCase().endsWith(ext) ? name.slice(0, -ext.length) : name;
};

const sanitizeFileStem = (name: string): string => {
  const trimmed = stripExtension(name.trim(), '.box')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .trim();
  return trimmed || '未命名箱子';
};

const sanitizeAssetRelativePath = (pathLike: string): string => {
  const normalized = pathLike.replace(/\\/g, '/').trim();
  const withoutLeading = normalized.replace(/^\.?\//, '');
  const segments = withoutLeading.split('/').filter((segment) => segment.length > 0 && segment !== '.');
  if (segments.length === 0 || segments.some((segment) => segment === '..')) {
    throw createError(BOX_SESSION_ERROR_CODES.INVALID_RESOURCE_PATH, `资源路径无效: ${pathLike}`);
  }

  const safeSegments = segments
    .map((segment) =>
      segment
        .replace(/[\u0000-\u001f]/g, '')
        .replace(/[<>:"\\|?*]/g, '')
        .trim()
    )
    .filter(Boolean);

  if (safeSegments.length === 0) {
    throw createError(BOX_SESSION_ERROR_CODES.INVALID_RESOURCE_PATH, `资源路径无效: ${pathLike}`);
  }

  const rooted = safeSegments[0] === 'assets' ? safeSegments : ['assets', 'layouts', ...safeSegments];
  return rooted.join('/');
};

const sanitizePackageRelativePath = (pathLike: string, rootSegment: string): string => {
  const normalized = pathLike.replace(/\\/g, '/').trim();
  const withoutLeading = normalized.replace(/^\.?\//, '');
  const segments = withoutLeading.split('/').filter((segment) => segment.length > 0 && segment !== '.');
  if (segments.length === 0 || segments.some((segment) => segment === '..')) {
    throw createError(BOX_SESSION_ERROR_CODES.INVALID_RESOURCE_PATH, `资源路径无效: ${pathLike}`);
  }

  const safeSegments = segments
    .map((segment) =>
      segment
        .replace(/[\u0000-\u001f]/g, '')
        .replace(/[<>:"\\|?*]/g, '')
        .trim()
    )
    .filter(Boolean);

  if (safeSegments.length === 0) {
    throw createError(BOX_SESSION_ERROR_CODES.INVALID_RESOURCE_PATH, `资源路径无效: ${pathLike}`);
  }

  const rooted = safeSegments[0] === rootSegment ? safeSegments : [rootSegment, ...safeSegments];
  return rooted.join('/');
};

const sanitizeEmbeddedCardStem = (name: string): string => {
  const sanitized = name
    .trim()
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .trim();
  const stem = stripExtension(sanitized || '未命名卡片', '.card');
  return stem || '未命名卡片';
};

const createFileUrl = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }
  const absolutePath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return encodeURI(`file://${absolutePath}`);
};

const deriveEntryTitle = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') {
      const segments = parsed.pathname.split('/').filter(Boolean);
      const last = decodeURIComponent(segments[segments.length - 1] ?? '');
      const fileName = stripExtension(stripExtension(last, '.card'), '.box');
      return fileName || url;
    }
    if (parsed.hostname) {
      const last = parsed.pathname.split('/').filter(Boolean).pop();
      return last ? decodeURIComponent(last) : parsed.hostname;
    }
  } catch {
    return url;
  }
  return url;
};

const detectDocumentFileType = (pathLike: string): 'card' | 'box' | null => {
  const lower = pathLike.toLowerCase();
  if (lower.endsWith('.card')) {
    return 'card';
  }
  if (lower.endsWith('.box')) {
    return 'box';
  }
  return null;
};

const createEmptySnapshot = (url: string): BoxEntrySnapshot['snapshot'] => {
  const fileType = detectDocumentFileType(url);
  return {
    title: deriveEntryTitle(url),
    summary: url,
    cover: {
      mode: fileType ? 'runtime' : 'none',
    },
    contentType: fileType === 'box' ? 'chips/box' : fileType === 'card' ? 'chips/card' : undefined,
  };
};

const createInitialDocument = (
  name: string,
  layoutType: string,
  config: Record<string, unknown>,
): { metadata: BoxMetadata; coverHtml: string; content: { activeLayoutType: string; layoutConfigs: Record<string, BoxLayoutConfig> }; entries: BoxEntrySnapshot[]; assets: string[] } => {
  const timestamp = new Date().toISOString();
  const boxId = createDocumentId();
  const displayName = name.trim() || '未命名箱子';
  return {
    metadata: {
      chipStandardsVersion: '1.0.0',
      boxId,
      name: displayName,
      createdAt: timestamp,
      modifiedAt: timestamp,
      activeLayoutType: layoutType,
      coverRatio: '3:4',
    },
    coverHtml: '',
    content: {
      activeLayoutType: layoutType,
      layoutConfigs: {
        [layoutType]: config as BoxLayoutConfig,
      },
    },
    entries: [],
    assets: [],
  };
};

const ensureDirectory = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

export class BoxSessionService {
  private readonly sessions = new Map<string, BoxSessionState>();
  private readonly sessionIdByBoxId = new Map<string, string>();
  private readonly fileIndex = new Map<string, string>();
  private readonly historyBySessionId = new Map<string, BoxSessionHistory>();
  private readonly options: BoxSessionOptions;
  private readonly eventSink: BoxSessionEventSink;
  private readonly autosave: BoxAutosaveScheduler;

  public constructor(options: BoxSessionOptions, eventSink: BoxSessionEventSink) {
    this.options = options;
    this.eventSink = eventSink;
    this.autosave = new BoxAutosaveScheduler({
      persist: async (state) => this.persistState(state),
      onPersisted: (snapshot) => {
        const sessionId = this.sessionIdByBoxId.get(snapshot.boxId);
        this.emit('box.session.persisted', { sessionId, boxId: snapshot.boxId, snapshot: this.toPublic(snapshot) });
      },
      onPersistError: (snapshot, error) => {
        const sessionId = this.sessionIdByBoxId.get(snapshot.boxId);
        this.emit('box.session.persist-error', { sessionId, boxId: snapshot.boxId, error });
      },
    });
  }

  public async createBoxFile(
    name: string,
    layoutType: string,
    parentPath: string,
  ): Promise<BoxCreateResult> {
    const targetLayoutType = layoutType?.trim() || 'chips.layout.grid';
    const descriptor = await this.options.layout.readDescriptor(targetLayoutType);
    const defaultConfig = await this.options.layout.normalizeConfig(
      targetLayoutType,
      descriptor.defaultConfig ?? {},
    );
    const initial = createInitialDocument(name, targetLayoutType, defaultConfig);
    initial.coverHtml = this.options.createDefaultCoverHtml(initial.metadata.name);

    const workDir = await this.createSessionWorkspace('create');
    try {
      await writeBoxDocumentFiles(workDir, initial);
      const outputPath = await this.ensureAvailableFilePath(parentPath, name);
      await this.packBox(workDir, outputPath);
      return {
        boxFile: outputPath,
        metadata: initial.metadata,
      };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  public async renameBoxFile(boxFile: string, newName: string): Promise<BoxCreateResult> {
    const inspection = await this.inspectBox(boxFile);
    const workDir = await this.createSessionWorkspace('rename');
    try {
      await this.unpackBox(boxFile, workDir);
      const metadata: BoxMetadata = {
        ...inspection.metadata,
        name: stripExtension(newName.trim(), '.box') || inspection.metadata.name,
        modifiedAt: new Date().toISOString(),
      };
      const coverHtml = await this.readCoverHtml(workDir, metadata.name);
      await writeBoxDocumentFiles(workDir, {
        metadata,
        coverHtml,
        content: inspection.content,
        entries: inspection.entries,
      });
      const parentPath = boxFile.split('/').slice(0, -1).join('/');
      const nextFile = path.join(parentPath, `${sanitizeFileStem(newName)}.box`);
      await this.packBox(workDir, nextFile);
      if (nextFile !== boxFile) {
        await fs.rm(boxFile, { force: true });
      }
      return {
        boxFile: nextFile,
        metadata,
      };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  public async openBox(boxFile: string): Promise<BoxSessionOpenResult> {
    const indexedBoxId = this.fileIndex.get(boxFile);
    if (indexedBoxId) {
      const sessionId = this.sessionIdByBoxId.get(indexedBoxId);
      if (sessionId) {
        const existing = this.sessions.get(sessionId);
        if (existing) {
          return { sessionId, snapshot: this.toPublic(existing.snapshot) };
        }
      }
    }

    const inspection = await this.inspectBox(boxFile);
    const workDir = await this.createSessionWorkspace('session');
    await this.unpackBox(boxFile, workDir);
    const coverHtml = await this.readCoverHtml(workDir, inspection.metadata.name);

    const snapshot: BoxSessionSnapshot = {
      boxId: inspection.metadata.boxId,
      boxFile,
      workspaceDir: workDir,
      metadata: inspection.metadata,
      coverHtml,
      content: inspection.content,
      entries: inspection.entries,
      assets: inspection.assets,
      isDirty: false,
      isSaving: false,
      lastSavedAt: inspection.metadata.modifiedAt,
    };

    const sessionId = this.createSessionId();
    const state: BoxSessionState = { snapshot };
    this.sessions.set(sessionId, state);
    this.sessionIdByBoxId.set(snapshot.boxId, sessionId);
    this.fileIndex.set(boxFile, snapshot.boxId);
    this.historyBySessionId.set(sessionId, new BoxSessionHistory());
    this.emit('box.session.opened', { sessionId, boxId: snapshot.boxId, snapshot: this.toPublic(snapshot) });
    return { sessionId, snapshot: this.toPublic(snapshot) };
  }

  public get(sessionId: string): BoxSessionSnapshot {
    return this.toPublic(this.requireSession(sessionId).snapshot);
  }

  public close(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) {
      return;
    }
    this.autosave.clear(sessionId);
    this.sessions.delete(sessionId);
    if (this.sessionIdByBoxId.get(state.snapshot.boxId) === sessionId) {
      this.sessionIdByBoxId.delete(state.snapshot.boxId);
    }
    if (this.fileIndex.get(state.snapshot.boxFile) === state.snapshot.boxId) {
      this.fileIndex.delete(state.snapshot.boxFile);
    }
    this.historyBySessionId.delete(sessionId);
    void fs.rm(state.snapshot.workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    this.emit('box.session.closed', { sessionId, boxId: state.snapshot.boxId });
  }

  public async persist(sessionId: string): Promise<BoxSessionSnapshot> {
    const state = this.requireSession(sessionId);
    this.autosave.clear(sessionId);
    await this.persistState(state);
    return this.toPublic(state.snapshot);
  }

  public async addEntry(sessionId: string, input: { url?: string; filePath?: string }): Promise<BoxSessionSnapshot> {
    const state = this.requireSession(sessionId);
    const snapshot = state.snapshot;

    this.recordHistory(state, '添加条目');

    if (input.filePath) {
      const entry = await this.createEntryFromFilePath(input.filePath);
      if (entry) {
        snapshot.entries = normalizeEntrySortOrder([
          ...snapshot.entries,
          {
            ...entry,
            layoutHints: {
              ...entry.layoutHints,
              sortKey: snapshot.entries.length,
            },
          },
        ]);
      }
    } else if (input.url) {
      const trimmed = input.url.trim();
      if (trimmed) {
        snapshot.entries = normalizeEntrySortOrder([
          ...snapshot.entries,
          {
            entryId: createDocumentId(),
            url: trimmed,
            enabled: true,
            snapshot: createEmptySnapshot(trimmed),
            layoutHints: {
              sortKey: snapshot.entries.length,
            },
          },
        ]);
      }
    }

    this.markDirtyAndSchedule(state);
    return this.toPublic(snapshot);
  }

  public async addEmbeddedCard(sessionId: string, cardFile: string, preferredName?: string): Promise<BoxSessionSnapshot> {
    const state = this.requireSession(sessionId);
    const snapshot = state.snapshot;

    const fileType = detectDocumentFileType(cardFile);
    if (fileType !== 'card') {
      throw createError(BOX_SESSION_ERROR_CODES.DOCUMENT_NOT_SUPPORTED, `仅支持内嵌 .card 卡片文件: ${cardFile}`);
    }
    const exists = await fs.stat(cardFile).then(() => true).catch(() => false);
    if (!exists) {
      throw createError(BOX_SESSION_ERROR_CODES.DOCUMENT_NOT_SUPPORTED, `卡片文件不存在: ${cardFile}`);
    }

    const info = await this.options.documentInfo.readCardInfo(cardFile);
    if (!info.ready) {
      throw createError(BOX_SESSION_ERROR_CODES.DOCUMENT_NOT_SUPPORTED, `卡片文件无效: ${cardFile}`);
    }

    const fallbackName = `${stripExtension(cardFile.split('/').pop() ?? '卡片', '.card')}.card`;
    const displayName = preferredName?.trim() || info.name || fallbackName;
    const relativePath = await this.pickEmbeddedCardPath(snapshot.workspaceDir, displayName);
    await fs.copyFile(cardFile, path.join(snapshot.workspaceDir, relativePath));

    const fallbackTitle = deriveEntryTitle(relativePath);
    const entry: BoxEntrySnapshot = {
      entryId: createDocumentId(),
      url: relativePath,
      enabled: true,
      snapshot: {
        documentId: info.cardId,
        title: info.name ?? fallbackTitle,
        summary: info.name ?? fallbackTitle,
        tags: info.tags,
        cover: {
          mode: 'runtime',
        },
        contentType: 'chips/card',
      },
      layoutHints: {},
    };

    this.recordHistory(state, '内嵌卡片');
    snapshot.entries = normalizeEntrySortOrder([...snapshot.entries, entry]);
    this.markDirtyAndSchedule(state);
    return this.toPublic(snapshot);
  }

  public updateEntry(sessionId: string, entryId: string, patch: Partial<BoxEntrySnapshot>): BoxSessionSnapshot {
    const state = this.requireSession(sessionId);
    const snapshot = state.snapshot;

    this.recordHistory(state, '更新条目');
    snapshot.entries = snapshot.entries.map((entry) => {
      if (entry.entryId !== entryId) {
        return entry;
      }
      const nextUrl = patch.url ?? entry.url;
      const nextFileType = patch.url ? detectDocumentFileType(nextUrl) : null;
      return {
        ...entry,
        ...patch,
        url: nextUrl,
        snapshot: {
          ...entry.snapshot,
          ...(patch.snapshot ?? {}),
          ...(patch.url
            ? {
                title: patch.snapshot?.title ?? entry.snapshot.title ?? deriveEntryTitle(nextUrl),
                summary: patch.snapshot?.summary ?? entry.snapshot.summary ?? nextUrl,
                contentType: nextFileType === 'box'
                  ? 'chips/box'
                  : nextFileType === 'card'
                    ? 'chips/card'
                    : (patch.snapshot?.contentType ?? entry.snapshot.contentType),
              }
            : {}),
        },
        layoutHints: {
          ...entry.layoutHints,
          ...(patch.layoutHints ?? {}),
        },
      };
    });

    this.markDirtyAndSchedule(state);
    return this.toPublic(snapshot);
  }

  public moveEntry(sessionId: string, entryId: string, targetIndex: number): BoxSessionSnapshot {
    const state = this.requireSession(sessionId);
    const snapshot = state.snapshot;
    const entries = [...snapshot.entries];
    const currentIndex = entries.findIndex((entry) => entry.entryId === entryId);
    if (currentIndex === -1) {
      return this.toPublic(snapshot);
    }

    const nextIndex = Math.max(0, Math.min(targetIndex, entries.length - 1));
    if (currentIndex === nextIndex) {
      return this.toPublic(snapshot);
    }

    const [current] = entries.splice(currentIndex, 1);
    if (!current) {
      return this.toPublic(snapshot);
    }
    this.recordHistory(state, '移动条目');
    entries.splice(nextIndex, 0, current);
    snapshot.entries = normalizeEntrySortOrder(entries);

    this.markDirtyAndSchedule(state);
    return this.toPublic(snapshot);
  }

  public removeEntry(sessionId: string, entryId: string): BoxSessionSnapshot {
    const state = this.requireSession(sessionId);
    const snapshot = state.snapshot;
    this.recordHistory(state, '删除条目');
    snapshot.entries = normalizeEntrySortOrder(
      snapshot.entries.filter((entry) => entry.entryId !== entryId),
    );

    this.markDirtyAndSchedule(state);
    return this.toPublic(snapshot);
  }

  public updateLayoutConfig(sessionId: string, layoutType: string, config: Record<string, unknown>): BoxSessionSnapshot {
    const state = this.requireSession(sessionId);
    const snapshot = state.snapshot;
    this.recordHistory(state, '更新布局配置');
    snapshot.metadata = {
      ...snapshot.metadata,
      activeLayoutType: layoutType,
      modifiedAt: new Date().toISOString(),
    };
    snapshot.content = {
      activeLayoutType: layoutType,
      layoutConfigs: {
        ...snapshot.content.layoutConfigs,
        [layoutType]: config as BoxLayoutConfig,
      },
    };

    this.markDirtyAndSchedule(state);
    return this.toPublic(snapshot);
  }

  public updateMetadata(sessionId: string, patch: Partial<BoxMetadata>): BoxSessionSnapshot {
    const state = this.requireSession(sessionId);
    const snapshot = state.snapshot;
    this.recordHistory(state, '更新箱子信息');
    snapshot.metadata = {
      ...snapshot.metadata,
      ...patch,
      modifiedAt: new Date().toISOString(),
    };

    this.markDirtyAndSchedule(state);
    return this.toPublic(snapshot);
  }

  public async importBoxAsset(
    sessionId: string,
    input: { data: Uint8Array; preferredPath?: string },
  ): Promise<{ assetPath: string }> {
    const state = this.requireSession(sessionId);
    const snapshot = state.snapshot;
    const preferred = input.preferredPath?.trim() || 'asset';
    const normalized = await this.pickAvailableAssetPath(snapshot.workspaceDir, sanitizeAssetRelativePath(preferred));

    await ensureDirectory(path.join(snapshot.workspaceDir, normalized.split('/').slice(0, -1).join('/')));
    await fs.writeFile(path.join(snapshot.workspaceDir, normalized), input.data);

    snapshot.assets = [...new Set([...snapshot.assets, normalized])].sort();
    this.markDirtyAndSchedule(state);
    return { assetPath: normalized };
  }

  public async deleteBoxAsset(sessionId: string, assetPath: string): Promise<void> {
    const state = this.requireSession(sessionId);
    const snapshot = state.snapshot;
    const normalizedAssetPath = sanitizeAssetRelativePath(assetPath);
    await fs.rm(path.join(snapshot.workspaceDir, normalizedAssetPath), { force: true }).catch(() => undefined);

    const nextLayoutConfigs = Object.fromEntries(
      Object.entries(snapshot.content.layoutConfigs).map(([layoutType, config]) => [
        layoutType,
        {
          ...config,
          assetRefs: (config.assetRefs ?? []).filter((item) => item !== normalizedAssetPath),
        },
      ]),
    );
    snapshot.content = {
      ...snapshot.content,
      layoutConfigs: nextLayoutConfigs,
    };
    snapshot.entries = snapshot.entries.map((entry) =>
      entry.snapshot.cover?.assetPath === normalizedAssetPath
        ? {
            ...entry,
            snapshot: {
              ...entry.snapshot,
              cover: {
                mode: 'none' as const,
              },
            },
          }
        : entry,
    );
    if (snapshot.metadata.coverAsset === normalizedAssetPath) {
      snapshot.metadata = {
        ...snapshot.metadata,
        coverAsset: undefined,
      };
    }
    this.recordHistory(state, '删除箱子资源');
    snapshot.assets = snapshot.assets.filter((item) => item !== normalizedAssetPath);

    this.markDirtyAndSchedule(state);
  }

  public async updateCover(sessionId: string, input: { html: string; ratio?: string; resources?: Array<{ path: string; data: Uint8Array }> }): Promise<BoxSessionSnapshot> {
    const state = this.requireSession(sessionId);
    const snapshot = state.snapshot;

    const coverRoot = path.join(snapshot.workspaceDir, '.box', 'boxcover');
    await fs.rm(coverRoot, { recursive: true, force: true }).catch(() => undefined);
    for (const resource of input.resources ?? []) {
      const normalizedPath = sanitizePackageRelativePath(resource.path, 'boxcover');
      const absolutePath = path.join(snapshot.workspaceDir, '.box', normalizedPath);
      await ensureDirectory(path.dirname(absolutePath));
      await fs.writeFile(absolutePath, resource.data);
    }

    this.recordHistory(state, '更新箱子封面');
    snapshot.coverHtml = input.html;
    snapshot.metadata = {
      ...snapshot.metadata,
      coverRatio: input.ratio ?? snapshot.metadata.coverRatio,
      modifiedAt: new Date().toISOString(),
    };

    this.markDirtyAndSchedule(state);
    return this.toPublic(snapshot);
  }

  public undo(sessionId: string): BoxSessionSnapshot {
    const state = this.requireSession(sessionId);
    const history = this.historyBySessionId.get(sessionId);
    const result = history?.undo(state.snapshot);
    if (!result) {
      return this.toPublic(state.snapshot);
    }
    state.snapshot = result.snapshot;
    this.emit('box.session.undo', { sessionId, boxId: state.snapshot.boxId, snapshot: this.toPublic(state.snapshot) });
    return this.toPublic(state.snapshot);
  }

  public redo(sessionId: string): BoxSessionSnapshot {
    const state = this.requireSession(sessionId);
    const history = this.historyBySessionId.get(sessionId);
    const result = history?.redo(state.snapshot);
    if (!result) {
      return this.toPublic(state.snapshot);
    }
    state.snapshot = result.snapshot;
    this.emit('box.session.redo', { sessionId, boxId: state.snapshot.boxId, snapshot: this.toPublic(state.snapshot) });
    return this.toPublic(state.snapshot);
  }

  public history(sessionId: string): ReturnType<BoxSessionHistory['view']> {
    const history = this.historyBySessionId.get(sessionId);
    return history
      ? history.view()
      : { undoAvailable: false, redoAvailable: false, undoStack: [], redoStack: [] };
  }

  public reset(): void {
    this.autosave.clearAll();
    this.sessions.clear();
    this.sessionIdByBoxId.clear();
    this.fileIndex.clear();
    this.historyBySessionId.clear();
  }

  private async persistState(state: BoxSessionState): Promise<void> {
    const snapshot = state.snapshot;
    snapshot.isSaving = true;
    try {
      const nextMetadata: BoxMetadata = {
        ...snapshot.metadata,
        modifiedAt: new Date().toISOString(),
      };
      await writeBoxDocumentFiles(snapshot.workspaceDir, {
        metadata: nextMetadata,
        coverHtml: snapshot.coverHtml,
        content: snapshot.content,
        entries: snapshot.entries,
      });
      await this.packBox(snapshot.workspaceDir, snapshot.boxFile);
      const inspection = await this.inspectBox(snapshot.boxFile);
      snapshot.metadata = inspection.metadata;
      snapshot.coverHtml = await this.readCoverHtml(snapshot.workspaceDir, inspection.metadata.name);
      snapshot.content = inspection.content;
      snapshot.entries = inspection.entries;
      snapshot.assets = inspection.assets;
      snapshot.isDirty = false;
      snapshot.isSaving = false;
      snapshot.lastSavedAt = nextMetadata.modifiedAt;
    } catch (error) {
      snapshot.isSaving = false;
      throw error;
    }
  }

  private async createEntryFromFilePath(filePath: string): Promise<BoxEntrySnapshot | null> {
    const fileType = detectDocumentFileType(filePath);
    if (!fileType) {
      return null;
    }

    const url = createFileUrl(filePath);
    if (fileType === 'box') {
      const metadata = await this.options.documentInfo.readBoxMetadata(filePath);
      return {
        entryId: createDocumentId(),
        url,
        enabled: true,
        snapshot: {
          documentId: metadata.boxId,
          title: metadata.name,
          summary: metadata.name,
          tags: metadata.tags,
          cover: {
            mode: 'runtime',
          },
          contentType: 'chips/box',
        },
        layoutHints: {},
      };
    }

    const info = await this.options.documentInfo.readCardInfo(filePath);
    return {
      entryId: createDocumentId(),
      url,
      enabled: true,
      snapshot: {
        documentId: info.cardId,
        title: info.name ?? deriveEntryTitle(url),
        summary: info.name ?? deriveEntryTitle(url),
        tags: info.tags,
        cover: {
          mode: 'runtime',
        },
        contentType: 'chips/card',
      },
      layoutHints: {},
    };
  }

  private async readCoverHtml(workspaceDir: string, displayName: string): Promise<string> {
    const coverPath = path.join(workspaceDir, '.box', 'cover.html');
    try {
      return await fs.readFile(coverPath, 'utf-8');
    } catch {
      return this.options.createDefaultCoverHtml(displayName);
    }
  }

  private async ensureAvailableFilePath(parentPath: string, displayName: string): Promise<string> {
    const stem = sanitizeFileStem(displayName);
    let index = 1;
    let candidate = path.join(parentPath, `${stem}.box`);
    while (await fs.stat(candidate).then(() => true).catch(() => false)) {
      index += 1;
      candidate = path.join(parentPath, `${stem}-${index}.box`);
    }
    return candidate;
  }

  private async pickAvailableAssetPath(workspaceDir: string, preferredPath: string): Promise<string> {
    const segments = preferredPath.split('/');
    const fileName = segments.pop() ?? 'asset';
    const dir = segments.join('/');
    const dotIndex = fileName.lastIndexOf('.');
    const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    const ext = dotIndex > 0 ? fileName.slice(dotIndex) : '';
    let candidate = path.join(dir, `${stem}${ext}`);
    let counter = 1;
    while (await fs.stat(path.join(workspaceDir, candidate)).then(() => true).catch(() => false)) {
      counter += 1;
      candidate = path.join(dir, `${stem}-${counter}${ext}`);
    }
    return candidate;
  }

  private async pickEmbeddedCardPath(workspaceDir: string, displayName: string): Promise<string> {
    const baseName = displayName.split('/').pop() ?? '未命名卡片';
    const stem = sanitizeEmbeddedCardStem(baseName);
    let candidate = `${stem}.card`;
    let counter = 1;
    while (await fs.stat(path.join(workspaceDir, candidate)).then(() => true).catch(() => false)) {
      counter += 1;
      candidate = `${stem}-${counter}.card`;
    }
    return candidate;
  }

  private async createSessionWorkspace(prefix: string): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), `chips-box-${prefix}-`));
  }

  private async packBox(boxDir: string, outputPath: string): Promise<void> {
    await this.options.pack(boxDir, outputPath);
  }

  private async unpackBox(boxFile: string, outputDir: string): Promise<void> {
    await this.options.unpack(boxFile, outputDir);
  }

  private async inspectBox(boxFile: string): Promise<{ metadata: BoxMetadata; content: BoxSessionSnapshot['content']; entries: BoxEntrySnapshot[]; assets: string[] }> {
    return this.options.inspect(boxFile);
  }

  private recordHistory(state: BoxSessionState, label: string, mergeKey?: string): void {
    const history = this.historyBySessionId.get(this.findSessionId(state));
    history?.record(state.snapshot, label, mergeKey);
  }

  private findSessionId(state: BoxSessionState): string {
    for (const [sessionId, candidate] of this.sessions) {
      if (candidate === state) {
        return sessionId;
      }
    }
    return '';
  }

  private markDirtyAndSchedule(state: BoxSessionState): void {
    state.snapshot.isDirty = true;
    state.snapshot.isSaving = true;
    const sessionId = this.findSessionId(state);
    this.emit('box.session.dirty', { sessionId, boxId: state.snapshot.boxId });
    this.autosave.schedule(state.snapshot);
  }

  private requireSession(sessionId: string): BoxSessionState {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw createError(BOX_SESSION_ERROR_CODES.SESSION_NOT_FOUND, `Box session not found: ${sessionId}`);
    }
    return state;
  }

  private toPublic(snapshot: BoxSessionSnapshot): BoxSessionSnapshot {
    return {
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        tags: snapshot.metadata.tags ? [...snapshot.metadata.tags] : undefined,
      },
      content: {
        activeLayoutType: snapshot.content.activeLayoutType,
        layoutConfigs: Object.fromEntries(
          Object.entries(snapshot.content.layoutConfigs).map(([layoutType, config]) => [
            layoutType,
            JSON.parse(JSON.stringify(config)) as BoxLayoutConfig,
          ]),
        ),
      },
      entries: snapshot.entries.map((entry) => JSON.parse(JSON.stringify(entry)) as typeof entry),
      assets: [...snapshot.assets],
    };
  }

  private emit(event: string, payload: unknown): void {
    this.eventSink.emit(event, payload);
  }

  private createSessionId(): string {
    return `box-session-${Date.now()}-${createDocumentId()}`;
  }
}

const createDocumentId = (): string => {
  // box_id / entry_id 必须为 10 字符 Base62（Host box-service 格式契约）
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = new Uint8Array(10);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  let id = '';
  for (const byte of bytes) {
    id += alphabet[byte % alphabet.length];
  }
  return id;
};
