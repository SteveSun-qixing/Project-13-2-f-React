/**
 * 箱子文档服务（会话消费层）
 * @module services/box-document-service
 * @description
 * task034 M3 改造：本地箱子编辑会话已上移 Host（box.session.*），
 * 本模块负责会话调用、boxId ↔ sessionId 映射与视图快照缓存。
 * 自动保存由 Host 会话管理，本模块订阅事件同步快照。
 */

import type {
    BoxContent,
    BoxEntrySnapshot,
    BoxLayoutConfig,
    BoxMetadata,
    BoxSessionSnapshot,
    ResolvedRuntimeResource,
} from 'chips-sdk';
import { createFileUrl as createFileUrlPublic, guessMimeType as guessMimeTypePublic } from 'chips-sdk';
import { createEventEmitter, type EventEmitter } from '../core/event-emitter';
import { getChipsClient } from './bridge-client';
import { fileService } from './file-service';

export const DEFAULT_BOX_LAYOUT_TYPE = 'chips.layout.grid';

export interface BoxDocumentSessionSnapshot extends BoxSessionSnapshot {}

interface BoxSessionState {
    snapshot: BoxDocumentSessionSnapshot;
    sessionId: string;
}

function joinPath(...parts: string[]): string {
    return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

function stripExtension(name: string, ext: string): string {
    return name.toLowerCase().endsWith(ext) ? name.slice(0, -ext.length) : name;
}

function ensureWorkspaceRoot(workspaceRoot: string): string {
    const normalized = workspaceRoot.trim();
    if (!normalized) {
        throw new Error('当前工作区未绑定，无法处理箱子文件。');
    }
    return normalized;
}

function sanitizeFileStem(name: string): string {
    const trimmed = stripExtension(name.trim(), '.box')
        .replace(/[\u0000-\u001f]/g, '')
        .replace(/[<>:"/\\|?*]/g, '')
        .trim();
    return trimmed || '未命名箱子';
}

function sanitizeAssetRelativePath(pathLike: string): string {
    const normalized = pathLike.replace(/\\/g, '/').trim();
    const withoutLeading = normalized.replace(/^\.?\//, '');
    const segments = withoutLeading.split('/').filter((segment) => segment.length > 0 && segment !== '.');
    if (segments.length === 0 || segments.some((segment) => segment === '..')) {
        throw new Error(`资源路径无效: ${pathLike}`);
    }

    const safeSegments = segments.map((segment) =>
        segment
            .replace(/[\u0000-\u001f]/g, '')
            .replace(/[<>:"\\|?*]/g, '')
            .trim()
    ).filter(Boolean);

    if (safeSegments.length === 0) {
        throw new Error(`资源路径无效: ${pathLike}`);
    }

    const rooted = safeSegments[0] === 'assets' ? safeSegments : ['assets', 'layouts', ...safeSegments];
    return rooted.join('/');
}

function bytesToBase64(data: Uint8Array): string {
    const bufferCtor = (globalThis as typeof globalThis & {
        Buffer?: {
            from(data: Uint8Array): { toString(encoding: string): string };
        };
    }).Buffer;
    if (bufferCtor) {
        return bufferCtor.from(data).toString('base64');
    }
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < data.length; index += chunkSize) {
        binary += String.fromCharCode(...data.subarray(index, index + chunkSize));
    }
    return btoa(binary);
}

function deriveEntryTitle(url: string): string {
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
}

export class BoxDocumentService {
    private readonly eventEmitter: EventEmitter = createEventEmitter();
    private readonly sessions = new Map<string, BoxSessionState>();
    private readonly boxIdByFile = new Map<string, string>();
    private readonly openingByFile = new Map<string, Promise<BoxDocumentSessionSnapshot>>();
    private readonly clientUnsubscribers: Array<() => void> = [];

    private sessionEventsSubscribed = false;

    private ensureSessionEventSubscription(): void {
        // task034 M3 补漏：订阅 Host 会话事件，自动保存完成后同步本地快照
        // （缺失会导致编辑后预览不随保存刷新，例如顶部照片上传后不显示）。
        // 惰性订阅：构造时 transport 可能未就绪（测试/启动早期），
        // 首次打开会话成功后补齐，避免 EVENTS_UNAVAILABLE 崩溃。
        if (this.sessionEventsSubscribed) {
            return;
        }
        try {
            const client = getChipsClient();
            this.clientUnsubscribers.push(
                client.box.session.onPersisted(({ boxId, snapshot }) => {
                    const state = this.sessions.get(boxId);
                    if (state) {
                        state.snapshot = snapshot;
                        this.emitSnapshot(snapshot);
                    }
                }),
                client.box.session.onPersistError(({ boxId }) => {
                    const state = this.sessions.get(boxId);
                    if (state) {
                        state.snapshot = {
                            ...state.snapshot,
                            isDirty: true,
                            isSaving: false,
                        };
                        this.emitSnapshot(state.snapshot);
                    }
                }),
            );
            this.sessionEventsSubscribed = true;
        } catch {
            // transport 未就绪：等待下一次 openBox 再订阅
        }
    }

    on(event: string, handler: (payload: BoxDocumentSessionSnapshot) => void) {
        this.eventEmitter.on(event, handler);
    }

    off(event: string, handler: (payload: BoxDocumentSessionSnapshot) => void) {
        this.eventEmitter.off(event, handler as unknown as (...args: unknown[]) => void);
    }

    getSession(boxId: string): BoxDocumentSessionSnapshot | null {
        return this.sessions.get(boxId)?.snapshot ?? null;
    }

    async createBoxFile(name: string, layoutType: string | undefined, parentPath: string, workspaceRoot: string): Promise<{
        boxFile: string;
        metadata: BoxMetadata;
    }> {
        ensureWorkspaceRoot(workspaceRoot);
        return getChipsClient().box.session.create(
            name,
            layoutType?.trim() || DEFAULT_BOX_LAYOUT_TYPE,
            parentPath,
        );
    }

    async renameBoxFile(boxFile: string, newName: string, workspaceRoot: string): Promise<{
        boxFile: string;
        metadata: BoxMetadata;
    }> {
        ensureWorkspaceRoot(workspaceRoot);
        return getChipsClient().box.session.rename(boxFile, sanitizeFileStem(newName));
    }

    async openBox(boxFile: string, workspaceRoot: string, expectedBoxId?: string): Promise<BoxDocumentSessionSnapshot> {
        ensureWorkspaceRoot(workspaceRoot);

        if (expectedBoxId) {
            const existing = this.sessions.get(expectedBoxId);
            if (existing) {
                if (existing.snapshot.boxFile !== boxFile) {
                    existing.snapshot = {
                        ...existing.snapshot,
                        boxFile,
                    };
                    this.boxIdByFile.set(boxFile, expectedBoxId);
                    this.emitSnapshot(existing.snapshot);
                }
                return existing.snapshot;
            }
        }

        const indexedBoxId = this.boxIdByFile.get(boxFile);
        if (indexedBoxId) {
            const existing = this.sessions.get(indexedBoxId);
            if (existing) {
                return existing.snapshot;
            }
        }

        const pendingByFile = this.openingByFile.get(boxFile);
        if (pendingByFile) {
            return pendingByFile;
        }

        const openingPromise = this.openBoxInternal(boxFile);
        this.openingByFile.set(boxFile, openingPromise);
        try {
            return await openingPromise;
        } finally {
            if (this.openingByFile.get(boxFile) === openingPromise) {
                this.openingByFile.delete(boxFile);
            }
        }
    }

    reset(): void {
        for (const unsubscribe of this.clientUnsubscribers) {
            unsubscribe();
        }
        this.clientUnsubscribers.length = 0;
        this.sessions.clear();
        this.boxIdByFile.clear();
        this.openingByFile.clear();
    }

    async closeBox(boxId: string): Promise<void> {
        const state = this.sessions.get(boxId);
        if (!state) {
            return;
        }
        try {
            await getChipsClient().box.session.close(state.sessionId);
        } catch {
            // 会话可能已被 Host 清理
        }
        if (this.boxIdByFile.get(state.snapshot.boxFile) === boxId) {
            this.boxIdByFile.delete(state.snapshot.boxFile);
        }
        this.sessions.delete(boxId);
    }

    async saveBox(boxId: string): Promise<BoxDocumentSessionSnapshot> {
        const state = this.requireSession(boxId);
        const snapshot = await getChipsClient().box.session.persist(state.sessionId);
        state.snapshot = snapshot;
        this.emitSnapshot(snapshot);
        return snapshot;
    }

    async readBoxAsset(boxId: string, assetPath: string): Promise<ResolvedRuntimeResource> {
        const state = this.requireSession(boxId);
        const normalizedAssetPath = sanitizeAssetRelativePath(assetPath);
        const absolutePath = joinPath(state.snapshot.workspaceDir, normalizedAssetPath);
        const exists = await fileService.exists(absolutePath);
        if (!exists) {
            throw new Error(`箱子资源不存在: ${normalizedAssetPath}`);
        }

        // task034 修复：编辑态布局文档（chips-render:// 协议）中加载 file:// 图片不可靠，
        // 改为 data URL（CSP img-src 已允许 data:），与 Host 查看链路的受控 URL 语义对齐。
        const mimeType = guessMimeTypePublic(normalizedAssetPath);
        const data = await fileService.readBinary(absolutePath);
        const base64 = bytesToBase64(data);
        return {
            resourceUrl: `data:${mimeType};base64,${base64}`,
            mimeType,
            cacheKey: `editing-box-asset:${boxId}:${normalizedAssetPath}`,
        };
    }

    async importBoxAsset(boxId: string, input: { file: File; preferredPath?: string }): Promise<{ assetPath: string }> {
        const state = this.requireSession(boxId);
        const data = new Uint8Array(await input.file.arrayBuffer());
        const result = await getChipsClient().box.session.importAsset(state.sessionId, {
            data,
            preferredPath: input.preferredPath ?? input.file.name,
        });
        state.snapshot = await getChipsClient().box.session.get(state.sessionId);
        this.emitSnapshot(state.snapshot);
        return result;
    }

    async deleteBoxAsset(boxId: string, assetPath: string): Promise<void> {
        const state = this.requireSession(boxId);
        await getChipsClient().box.session.deleteAsset(state.sessionId, assetPath);
        state.snapshot = await getChipsClient().box.session.get(state.sessionId);
        this.emitSnapshot(state.snapshot);
    }

    async updateLayoutConfig(boxId: string, layoutType: string, config: Record<string, unknown>): Promise<BoxDocumentSessionSnapshot> {
        const state = this.requireSession(boxId);
        const snapshot = await getChipsClient().box.session.updateLayoutConfig(state.sessionId, layoutType, config);
        state.snapshot = snapshot;
        this.emitSnapshot(snapshot);
        return snapshot;
    }

    async updateMetadata(boxId: string, patch: Partial<BoxMetadata>): Promise<BoxDocumentSessionSnapshot> {
        const state = this.requireSession(boxId);
        const current = state.snapshot;
        const snapshot = await getChipsClient().box.session.updateMetadata(state.sessionId, {
            name: patch.name ?? current.metadata.name,
            description: patch.description !== undefined ? patch.description : current.metadata.description,
            coverRatio: patch.coverRatio ?? current.metadata.coverRatio,
            tags: patch.tags !== undefined ? patch.tags : current.metadata.tags,
            coverAsset: patch.coverAsset !== undefined ? patch.coverAsset : current.metadata.coverAsset,
        });
        state.snapshot = snapshot;
        this.emitSnapshot(snapshot);
        return snapshot;
    }

    async updateCover(
        boxId: string,
        input: {
            html: string;
            ratio?: string;
            resources?: Array<{ path: string; data: Uint8Array }>;
        },
    ): Promise<BoxDocumentSessionSnapshot> {
        const state = this.requireSession(boxId);
        const snapshot = await getChipsClient().box.session.updateCover(state.sessionId, {
            html: input.html,
            ratio: input.ratio,
            resources: input.resources,
        });
        state.snapshot = snapshot;
        this.emitSnapshot(snapshot);
        return snapshot;
    }

    async addEntry(boxId: string, url: string): Promise<BoxDocumentSessionSnapshot> {
        const state = this.requireSession(boxId);
        const snapshot = await getChipsClient().box.session.addEntry(state.sessionId, { url });
        state.snapshot = snapshot;
        this.emitSnapshot(snapshot);
        return snapshot;
    }

    async importDocumentFiles(boxId: string, filePaths: string[]): Promise<BoxDocumentSessionSnapshot> {
        const state = this.requireSession(boxId);
        let latest = state.snapshot;
        for (const filePath of filePaths) {
            latest = await getChipsClient().box.session.addEntry(state.sessionId, { filePath });
        }
        state.snapshot = latest;
        this.emitSnapshot(latest);
        return latest;
    }

    async addEmbeddedCard(
        boxId: string,
        cardFile: string,
        preferredName?: string,
    ): Promise<BoxDocumentSessionSnapshot> {
        const state = this.requireSession(boxId);
        const snapshot = await getChipsClient().box.session.addEmbeddedCard(state.sessionId, cardFile, preferredName);
        state.snapshot = snapshot;
        this.emitSnapshot(snapshot);
        return snapshot;
    }

    async updateEntry(boxId: string, entryId: string, patch: Partial<BoxEntrySnapshot>): Promise<BoxDocumentSessionSnapshot> {
        const state = this.requireSession(boxId);
        const snapshot = await getChipsClient().box.session.updateEntry(state.sessionId, entryId, patch);
        state.snapshot = snapshot;
        this.emitSnapshot(snapshot);
        return snapshot;
    }

    async moveEntry(boxId: string, entryId: string, direction: 'up' | 'down'): Promise<BoxDocumentSessionSnapshot> {
        const state = this.requireSession(boxId);
        const entries = state.snapshot.entries;
        const index = entries.findIndex((entry) => entry.entryId === entryId);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const boundedIndex = Math.max(0, Math.min(targetIndex, entries.length - 1));
        const snapshot = await getChipsClient().box.session.moveEntry(state.sessionId, entryId, boundedIndex);
        state.snapshot = snapshot;
        this.emitSnapshot(snapshot);
        return snapshot;
    }

    async moveEntryToIndex(boxId: string, entryId: string, targetIndex: number): Promise<BoxDocumentSessionSnapshot> {
        const state = this.requireSession(boxId);
        const snapshot = await getChipsClient().box.session.moveEntry(state.sessionId, entryId, targetIndex);
        state.snapshot = snapshot;
        this.emitSnapshot(snapshot);
        return snapshot;
    }

    async removeEntry(boxId: string, entryId: string): Promise<BoxDocumentSessionSnapshot> {
        const state = this.requireSession(boxId);
        const snapshot = await getChipsClient().box.session.removeEntry(state.sessionId, entryId);
        state.snapshot = snapshot;
        this.emitSnapshot(snapshot);
        return snapshot;
    }

    async undo(boxId: string): Promise<boolean> {
        const state = this.sessions.get(boxId);
        if (!state) return false;
        try {
            const snapshot = await getChipsClient().box.session.undo(state.sessionId);
            state.snapshot = snapshot;
            this.emitSnapshot(snapshot);
            return true;
        } catch {
            return false;
        }
    }

    async redo(boxId: string): Promise<boolean> {
        const state = this.sessions.get(boxId);
        if (!state) return false;
        try {
            const snapshot = await getChipsClient().box.session.redo(state.sessionId);
            state.snapshot = snapshot;
            this.emitSnapshot(snapshot);
            return true;
        } catch {
            return false;
        }
    }

    async getHistory(boxId: string) {
        const state = this.sessions.get(boxId);
        if (!state) {
            return { undoAvailable: false, redoAvailable: false, undoStack: [], redoStack: [] };
        }
        return getChipsClient().box.session.history(state.sessionId);
    }

    private async openBoxInternal(boxFile: string): Promise<BoxDocumentSessionSnapshot> {
        const result = await getChipsClient().box.session.open(boxFile);
        this.ensureSessionEventSubscription();
        const state: BoxSessionState = {
            snapshot: result.snapshot,
            sessionId: result.sessionId,
        };
        this.sessions.set(result.snapshot.boxId, state);
        this.boxIdByFile.set(boxFile, result.snapshot.boxId);
        this.emitSnapshot(result.snapshot);
        return result.snapshot;
    }

    private requireSession(boxId: string): BoxSessionState {
        const state = this.sessions.get(boxId);
        if (!state) {
            throw new Error(`箱子会话不存在: ${boxId}`);
        }
        return state;
    }

    private emitSnapshot(snapshot: BoxDocumentSessionSnapshot) {
        this.eventEmitter.emit(`session:${snapshot.boxId}`, snapshot);
        this.eventEmitter.emit('session:changed', snapshot);
    }
}

export const boxDocumentService = new BoxDocumentService();
