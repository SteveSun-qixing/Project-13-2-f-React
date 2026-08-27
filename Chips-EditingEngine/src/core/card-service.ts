/**
 * 卡片服务（会话消费层）
 * @module core/card-service
 * @description 管理解压态 `.card` 目录的打开、编辑与自动保存。
 *
 * task034 M2 改造：本地文档实现已上移 Host（card.session.*），
 * 本模块只负责会话调用、视图映射与编辑态本地状态（选中态/编辑模式）。
 * 自动保存由 Host 会话管理，本模块订阅事件同步视图。
 */

import type { CardSessionSnapshot } from 'chips-sdk';
import { getChipsClient } from '../services/bridge-client';
import { workspaceService } from '../services/workspace-service';
import { generateId62 } from '../utils/id';
import { globalEventEmitter } from './event-emitter';
import { normalizeBasecardType } from '../basecard-runtime/registry';
import type { BasecardResourceOperations } from '../basecard-runtime/contracts';

interface PendingBasicCardResourceImport {
    path: string;
    data: Uint8Array;
    mimeType?: string;
    token: string;
}

export interface BasicCardData {
    id: string;
    type: string;
    data: Record<string, unknown>;
    createdAt: string;
    modifiedAt: string;
    pendingResourceImports?: Map<string, PendingBasicCardResourceImport>;
}

export interface CardMetadata {
    name: string;
    description?: string;
    themeId?: string;
    coverPath?: string;
    coverRatio?: string;
    createdAt: string;
    modifiedAt: string;
    tags?: string[];
}

export interface CardStructure {
    basicCards: BasicCardData[];
    layout?: {
        padding?: number;
        gap?: number;
    };
}

export interface CardCoverResource {
    path: string;
    data: Uint8Array;
}

export interface CompositeCard {
    id: string;
    path: string;
    metadata: CardMetadata;
    cover?: {
        html: string;
        ratio: string;
        resources: CardCoverResource[];
    };
    structure: CardStructure;
    isDirty: boolean;
    isEditing: boolean;
    isPersisting?: boolean;
    persistedRevision?: number;
    pendingPersistRevision?: number;
    lastPersistedAt?: string;
    pendingResourceDeletions: Set<string>;
}

export interface CardServiceState {
    openedCards: Map<string, CompositeCard>;
    selectedCardId: string | null;
    selectedBasicCardId: string | null;
}

export interface UpdateBasicCardOptions {
    persist?: boolean;
}

export type CardServiceListener = (state: CardServiceState) => void;

/** 会话视图映射：sessionId -> cardId（按路径兜底） */
const sessionIdByCardId = new Map<string, string>();

let cardServiceInstance: CardService | null = null;

function now(): string {
    return new Date().toISOString();
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
    return new Uint8Array(bytes);
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function cloneValue<T>(value: T): T {
    if (typeof globalThis.structuredClone === 'function') {
        return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
}

/** 会话快照 -> 本地 CompositeCard 视图 */
function toCompositeCard(snapshot: CardSessionSnapshot): CompositeCard {
    return {
        id: snapshot.cardId,
        path: snapshot.path,
        metadata: {
            name: snapshot.metadata.name,
            description: snapshot.metadata.description,
            themeId: snapshot.metadata.themeId,
            coverRatio: snapshot.metadata.coverRatio,
            createdAt: snapshot.metadata.createdAt,
            modifiedAt: snapshot.metadata.modifiedAt,
            tags: snapshot.metadata.tags ? [...snapshot.metadata.tags] : undefined,
        },
        cover: {
            html: snapshot.cover.html,
            ratio: snapshot.cover.ratio,
            resources: snapshot.cover.resources.map((resource) => ({
                path: resource.path,
                data: cloneBytes(resource.data),
            })),
        },
        structure: {
            basicCards: snapshot.structure.basicCards.map((basicCard) => ({
                id: basicCard.id,
                type: basicCard.type,
                data: cloneValue(basicCard.data),
                createdAt: basicCard.createdAt,
                modifiedAt: basicCard.modifiedAt,
            })),
            layout: { ...snapshot.structure.layout },
        },
        isDirty: snapshot.isDirty,
        isEditing: true,
        isPersisting: snapshot.isPersisting,
        persistedRevision: snapshot.persistedRevision,
        pendingPersistRevision: snapshot.pendingPersistRevision,
        lastPersistedAt: snapshot.lastPersistedAt,
        pendingResourceDeletions: new Set<string>(),
    };
}

/** 会话快照映射到本地视图（保留本地 pendingResourceImports 与编辑态字段） */
function applySnapshotToCard(card: CompositeCard, snapshot: CardSessionSnapshot): void {
    card.metadata = {
        name: snapshot.metadata.name,
        description: snapshot.metadata.description,
        themeId: snapshot.metadata.themeId,
        coverRatio: snapshot.metadata.coverRatio,
        createdAt: snapshot.metadata.createdAt,
        modifiedAt: snapshot.metadata.modifiedAt,
        tags: snapshot.metadata.tags ? [...snapshot.metadata.tags] : undefined,
    };
    card.path = snapshot.path;
    card.cover = {
        html: snapshot.cover.html,
        ratio: snapshot.cover.ratio,
        resources: snapshot.cover.resources.map((resource) => ({
            path: resource.path,
            data: cloneBytes(resource.data),
        })),
    };
    card.structure.layout = { ...snapshot.structure.layout };
    card.structure.basicCards = snapshot.structure.basicCards.map((basicCard) => {
        const existing = card.structure.basicCards.find((candidate) => candidate.id === basicCard.id);
        return {
            id: basicCard.id,
            type: basicCard.type,
            data: cloneValue(basicCard.data),
            createdAt: basicCard.createdAt,
            modifiedAt: basicCard.modifiedAt,
            pendingResourceImports: existing?.pendingResourceImports,
        };
    });
    card.isDirty = snapshot.isDirty;
    card.isPersisting = snapshot.isPersisting;
    card.persistedRevision = snapshot.persistedRevision;
    card.pendingPersistRevision = snapshot.pendingPersistRevision;
    card.lastPersistedAt = snapshot.lastPersistedAt;
}

export class CardService {
    private listeners: Set<CardServiceListener> = new Set();
    private state: CardServiceState = {
        openedCards: new Map(),
        selectedCardId: null,
        selectedBasicCardId: null,
    };
    private clientUnsubscribers: Array<() => void> = [];

    constructor() {
        this.subscribeSessionEvents();
    }

    private subscribeSessionEvents(): void {
        const client = getChipsClient();
        this.clientUnsubscribers.push(
            client.card.session.onPersisted(({ cardId, snapshot }) => {
                const card = this.state.openedCards.get(cardId);
                if (card) {
                    applySnapshotToCard(card, snapshot);
                    for (const basicCard of card.structure.basicCards) {
                        basicCard.pendingResourceImports?.clear();
                    }
                    this.notify();
                }
                globalEventEmitter.emit('card:persisted', { cardId, card });
            }),
            client.card.session.onPersistError(({ cardId }) => {
                const card = this.state.openedCards.get(cardId);
                if (card) {
                    card.isPersisting = false;
                    card.isDirty = true;
                    this.notify();
                }
                globalEventEmitter.emit('card:persist-error', { cardId });
            }),
        );
    }

    subscribe(listener: CardServiceListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        const snapshot = this.getState();
        this.listeners.forEach(listener => listener(snapshot));
        globalEventEmitter.emit('card:state-changed', snapshot);
    }

    getState(): CardServiceState {
        return {
            openedCards: new Map(this.state.openedCards),
            selectedCardId: this.state.selectedCardId,
            selectedBasicCardId: this.state.selectedBasicCardId,
        };
    }

    getOpenedCards(): CompositeCard[] {
        return Array.from(this.state.openedCards.values());
    }

    getSelectedCardId(): string | null {
        return this.state.selectedCardId;
    }

    getSelectedBasicCardId(): string | null {
        return this.state.selectedBasicCardId;
    }

    getCard(id: string): CompositeCard | undefined {
        return this.state.openedCards.get(id);
    }

    private registerSession(cardId: string, sessionId: string): void {
        sessionIdByCardId.set(cardId, sessionId);
    }

    getSessionId(cardId: string): string | undefined {
        return sessionIdByCardId.get(cardId);
    }

    private async requireWorkspaceRoot(): Promise<string> {
        const root = workspaceService.getState().rootPath;
        if (!root) {
            throw new Error('当前工作区未绑定，无法创建卡片。');
        }
        return root;
    }

    async createCard(
        name: string,
        initialBasicCard?: { type: string; data?: Record<string, unknown> }
    ): Promise<CompositeCard> {
        const parentPath = await this.requireWorkspaceRoot();
        const result = await getChipsClient().card.session.init(
            parentPath,
            name,
            initialBasicCard ? {
                type: normalizeBasecardType(initialBasicCard.type),
                data: initialBasicCard.data,
            } : undefined,
        );

        const card = toCompositeCard(result.snapshot);
        this.registerSession(card.id, result.sessionId);
        this.state.openedCards.set(card.id, card);
        this.state.selectedCardId = card.id;
        this.state.selectedBasicCardId = card.structure.basicCards[0]?.id ?? null;

        this.notify();
        globalEventEmitter.emit('card:created', { card });

        return card;
    }

    async openCard(id: string, cardPath: string): Promise<CompositeCard> {
        const existing = this.state.openedCards.get(id);
        if (existing) {
            this.state.selectedCardId = id;
            this.state.selectedBasicCardId = existing.structure.basicCards[0]?.id ?? null;
            this.notify();
            return existing;
        }

        const result = await getChipsClient().card.session.open(cardPath);
        const card = toCompositeCard(result.snapshot);
        this.registerSession(card.id, result.sessionId);
        this.state.openedCards.set(card.id, card);
        this.state.selectedCardId = card.id;
        this.state.selectedBasicCardId = card.structure.basicCards[0]?.id ?? null;

        this.notify();
        globalEventEmitter.emit('card:opened', { card });

        return card;
    }

    closeCard(id: string): void {
        const card = this.state.openedCards.get(id);
        if (!card) return;

        const sessionId = sessionIdByCardId.get(id);
        if (sessionId) {
            void getChipsClient().card.session.close(sessionId).catch(() => undefined);
            sessionIdByCardId.delete(id);
        }

        this.state.openedCards.delete(id);

        if (this.state.selectedCardId === id) {
            this.state.selectedCardId = null;
            this.state.selectedBasicCardId = null;
        }

        this.notify();
        globalEventEmitter.emit('card:closed', { card });
    }

    async saveCard(id: string): Promise<void> {
        const card = this.state.openedCards.get(id);
        if (!card) return;

        const sessionId = sessionIdByCardId.get(id);
        if (!sessionId) return;

        const snapshot = await getChipsClient().card.session.persist(sessionId);
        applySnapshotToCard(card, snapshot);
        this.notify();
        globalEventEmitter.emit('card:saved', { card });
    }

    /** 撤销（Host 会话历史闭环） */
    async undo(): Promise<boolean> {
        const sessionId = this.activeSessionId();
        if (!sessionId) return false;
        try {
            await getChipsClient().card.session.undo(sessionId);
            return true;
        } catch {
            return false;
        }
    }

    /** 重做（Host 会话历史闭环） */
    async redo(): Promise<boolean> {
        const sessionId = this.activeSessionId();
        if (!sessionId) return false;
        try {
            await getChipsClient().card.session.redo(sessionId);
            return true;
        } catch {
            return false;
        }
    }

    /** 会话历史视图（供历史面板消费） */
    async getHistory() {
        const sessionId = this.activeSessionId();
        if (!sessionId) {
            return { undoAvailable: false, redoAvailable: false, undoStack: [], redoStack: [] };
        }
        return getChipsClient().card.session.history(sessionId);
    }

    private activeSessionId(): string | undefined {
        const selectedId = this.state.selectedCardId;
        if (selectedId) {
            const sessionId = sessionIdByCardId.get(selectedId);
            if (sessionId) return sessionId;
        }
        for (const card of this.state.openedCards.values()) {
            const sessionId = sessionIdByCardId.get(card.id);
            if (sessionId) return sessionId;
        }
        return undefined;
    }

    async addBasicCard(
        cardId: string,
        type: string,
        data?: Record<string, unknown>,
        position?: number
    ): Promise<BasicCardData | null> {
        const sessionId = sessionIdByCardId.get(cardId);
        if (!sessionId) return null;

        const snapshot = await getChipsClient().card.session.addBasicCard(
            sessionId,
            normalizeBasecardType(type),
            data,
            position,
        );

        const card = this.state.openedCards.get(cardId);
        if (card) {
            applySnapshotToCard(card, snapshot);
            this.state.selectedBasicCardId = card.structure.basicCards[position ?? card.structure.basicCards.length - 1]?.id ?? null;
        }

        this.notify();
        globalEventEmitter.emit('card:basic-card-added', { cardId });
        return card?.structure.basicCards[position ?? card.structure.basicCards.length - 1] ?? null;
    }

    async removeBasicCard(cardId: string, basicCardId: string): Promise<void> {
        const sessionId = sessionIdByCardId.get(cardId);
        if (!sessionId) return;

        const snapshot = await getChipsClient().card.session.removeBasicCard(sessionId, basicCardId);

        const card = this.state.openedCards.get(cardId);
        if (card) {
            applySnapshotToCard(card, snapshot);
            if (this.state.selectedBasicCardId === basicCardId) {
                this.state.selectedBasicCardId = card.structure.basicCards[0]?.id ?? null;
            }
        }

        this.notify();
        globalEventEmitter.emit('card:basic-card-removed', { cardId, basicCardId });
    }

    async moveBasicCard(cardId: string, basicCardId: string, newPosition: number): Promise<void> {
        const sessionId = sessionIdByCardId.get(cardId);
        if (!sessionId) return;

        const snapshot = await getChipsClient().card.session.moveBasicCard(sessionId, basicCardId, newPosition);

        const card = this.state.openedCards.get(cardId);
        if (card) {
            applySnapshotToCard(card, snapshot);
        }

        this.notify();
        globalEventEmitter.emit('card:basic-card-moved', { cardId, basicCardId, newPosition });
    }

    async updateBasicCard(
        cardId: string,
        basicCardId: string,
        data: Record<string, unknown>,
        resourceOperations?: BasecardResourceOperations,
        options?: UpdateBasicCardOptions,
    ): Promise<void> {
        const sessionId = sessionIdByCardId.get(cardId);
        if (!sessionId) return;

        const snapshot = await getChipsClient().card.session.updateBasicCard(
            sessionId,
            basicCardId,
            data,
            resourceOperations ? {
                imports: resourceOperations.imports.map((resource) => ({
                    path: resource.path,
                    data: cloneBytes(resource.data),
                    mimeType: resource.mimeType,
                })),
                deletions: resourceOperations.deletions,
            } : undefined,
        );

        const card = this.state.openedCards.get(cardId);
        if (card) {
            applySnapshotToCard(card, snapshot);
            const basicCard = card.structure.basicCards.find((candidate) => candidate.id === basicCardId);
            if (basicCard && resourceOperations?.imports.length) {
                basicCard.pendingResourceImports = new Map(
                    resourceOperations.imports.map((resource) => [
                        resource.path,
                        {
                            path: resource.path,
                            data: cloneBytes(resource.data),
                            mimeType: resource.mimeType,
                            token: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                        },
                    ]),
                );
            }
        }

        this.notify();
        globalEventEmitter.emit('card:basic-card-updated', { cardId, basicCardId, data });
    }

    selectCard(id: string | null): void {
        this.state.selectedCardId = id;
        if (id === null) {
            this.state.selectedBasicCardId = null;
        } else {
            const selectedCard = this.state.openedCards.get(id);
            this.state.selectedBasicCardId = selectedCard?.structure.basicCards[0]?.id ?? null;
        }
        this.notify();
        globalEventEmitter.emit('card:selected', { cardId: id });
    }

    selectBasicCard(basicCardId: string | null): void {
        this.state.selectedBasicCardId = basicCardId;
        this.notify();
        globalEventEmitter.emit('card:basic-card-selected', { basicCardId });
    }

    async updateCardMetadata(id: string, metadata: Partial<CardMetadata>): Promise<void> {
        const sessionId = sessionIdByCardId.get(id);
        if (!sessionId) return;

        const snapshot = await getChipsClient().card.session.updateMetadata(sessionId, {
            name: metadata.name,
            description: metadata.description,
            themeId: metadata.themeId,
            coverRatio: metadata.coverRatio,
            tags: metadata.tags,
        });

        const card = this.state.openedCards.get(id);
        if (card) {
            applySnapshotToCard(card, snapshot);
        }

        this.notify();
        globalEventEmitter.emit('card:metadata-updated', { cardId: id, metadata });
    }

    async updateCardCover(id: string, input: {
        html: string;
        ratio?: string;
        resources?: CardCoverResource[];
    }): Promise<void> {
        const sessionId = sessionIdByCardId.get(id);
        if (!sessionId) return;

        const snapshot = await getChipsClient().card.session.updateCover(sessionId, {
            html: input.html,
            ratio: input.ratio,
            resources: (input.resources ?? []).map((resource) => ({
                path: resource.path,
                data: cloneBytes(resource.data),
            })),
        });

        const card = this.state.openedCards.get(id);
        if (card) {
            applySnapshotToCard(card, snapshot);
        }

        this.notify();
        globalEventEmitter.emit('card:cover-updated', { cardId: id, ratio: snapshot.metadata.coverRatio });
    }

    syncCardWorkspaceSnapshot(id: string, input: {
        name?: string;
        path?: string;
        modifiedAt?: string;
    }): void {
        const card = this.state.openedCards.get(id);
        if (!card) {
            return;
        }

        let hasChanges = false;
        if (asString(input.name) && input.name !== card.metadata.name) {
            card.metadata.name = asString(input.name) as string;
            hasChanges = true;
        }
        if (asString(input.path) && input.path !== card.path) {
            card.path = asString(input.path) as string;
            hasChanges = true;
        }
        if (asString(input.modifiedAt) && input.modifiedAt !== card.metadata.modifiedAt) {
            card.metadata.modifiedAt = asString(input.modifiedAt) as string;
            hasChanges = true;
        }

        if (!hasChanges) {
            return;
        }

        this.notify();
        globalEventEmitter.emit('card:workspace-synced', { cardId: id });
    }

    toggleEditMode(id: string): void {
        const card = this.state.openedCards.get(id);
        if (!card) return;

        card.isEditing = !card.isEditing;
        this.notify();
        globalEventEmitter.emit('card:edit-mode-changed', { cardId: id, isEditing: card.isEditing });
    }

    reset(): void {
        for (const unsubscribe of this.clientUnsubscribers) {
            unsubscribe();
        }
        this.clientUnsubscribers = [];
        sessionIdByCardId.clear();
        this.state = {
            openedCards: new Map(),
            selectedCardId: null,
            selectedBasicCardId: null,
        };
        this.notify();
        globalEventEmitter.emit('card:reset', {});
    }
}

export function createCardService(): CardService {
    return new CardService();
}

export function useCardService(): CardService {
    if (!cardServiceInstance) {
        cardServiceInstance = createCardService();
    }
    return cardServiceInstance;
}

export function getCardService(): CardService {
    return useCardService();
}

export function resetCardService(): void {
    if (cardServiceInstance) {
        cardServiceInstance.reset();
    }
    cardServiceInstance = null;
}

export function createDefaultBasicCardData(type: string, id: string): Record<string, unknown> {
    return { id };
}

export { generateId62 as createDocumentId };
