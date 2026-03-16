/**
 * 卡片服务
 * @module core/card-service
 * @description 管理解压态 `.card` 目录的读取、编辑与自动保存
 */

import yaml from 'yaml';
import { fileService } from '../services/file-service';
import { generateId62 } from '../utils/id';
import {
    createDefaultCoverHtml,
    DEFAULT_COVER_RATIO,
    ensureCoverHtmlUsesCardRootBase,
    normalizeCoverRatio,
    type CardCoverResource,
} from '../utils/card-cover';
import { basecardService } from '../services/basecard-service';
import { globalEventEmitter } from './event-emitter';

export interface BasicCardData {
    id: string;
    type: string;
    data: Record<string, unknown>;
    referencedResources: string[];
    pendingResourceImports: BasicCardResourceImport[];
    pendingResourceDeletions: string[];
    createdAt: string;
    modifiedAt: string;
}

export interface BasicCardResourceImport {
    path: string;
    data: Uint8Array;
    mimeType?: string;
}

export interface BasicCardResourceOperations {
    referencedResources?: string[];
    imports?: BasicCardResourceImport[];
    deletions?: string[];
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
}

export interface CardServiceState {
    openedCards: Map<string, CompositeCard>;
    selectedCardId: string | null;
    selectedBasicCardId: string | null;
}

export type CardServiceListener = (state: CardServiceState) => void;

let cardServiceInstance: CardService | null = null;

function now(): string {
    return new Date().toISOString();
}

function joinPath(...parts: string[]): string {
    return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
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

function createPersistSnapshot(card: CompositeCard): CompositeCard {
    return {
        ...card,
        metadata: cloneValue(card.metadata),
        cover: card.cover ? {
            html: card.cover.html,
            ratio: card.cover.ratio,
            resources: card.cover.resources.map((resource) => ({
                path: resource.path,
                data: new Uint8Array(resource.data),
            })),
        } : undefined,
        structure: {
            layout: card.structure.layout ? cloneValue(card.structure.layout) : undefined,
            basicCards: card.structure.basicCards.map((basicCard) => ({
                ...basicCard,
                data: cloneValue(basicCard.data),
                referencedResources: [...basicCard.referencedResources],
                pendingResourceImports: basicCard.pendingResourceImports.map((resource) => ({
                    path: resource.path,
                    data: new Uint8Array(resource.data),
                    mimeType: resource.mimeType,
                })),
                pendingResourceDeletions: [...basicCard.pendingResourceDeletions],
            })),
        },
    };
}

function normalizeResourcePath(resourcePath: string): string | null {
    const normalized = resourcePath.trim().replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '');
    if (!normalized || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
        return null;
    }
    return normalized;
}

function normalizeResourceImports(imports: BasicCardResourceImport[] | undefined): BasicCardResourceImport[] {
    if (!Array.isArray(imports)) {
        return [];
    }

    return imports.flatMap((resource) => {
        const normalizedPath = normalizeResourcePath(resource.path);
        if (!normalizedPath) {
            return [];
        }

        return [{
            path: normalizedPath,
            data: new Uint8Array(resource.data),
            mimeType: resource.mimeType,
        }];
    });
}

function normalizeResourceDeletions(deletions: string[] | undefined): string[] {
    if (!Array.isArray(deletions)) {
        return [];
    }

    return deletions
        .map((item) => normalizeResourcePath(item))
        .filter((item): item is string => Boolean(item));
}

function inferResourceType(resourcePath: string, explicitMimeType?: string): string {
    if (explicitMimeType && explicitMimeType.trim()) {
        return explicitMimeType.trim();
    }

    const lowerPath = resourcePath.toLowerCase();
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

    return resourcePath.split('.').pop() ?? 'file';
}

export class CardService {
    private listeners: Set<CardServiceListener> = new Set();
    private persistTasks: Map<string, Promise<void>> = new Map();
    private state: CardServiceState = {
        openedCards: new Map(),
        selectedCardId: null,
        selectedBasicCardId: null,
    };

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

    private async normalizeBasicCardSnapshot(
        cardPath: string,
        baseCardId: string,
        cardType: string,
        rawData?: Record<string, unknown>,
    ): Promise<{
        type: string;
        data: Record<string, unknown>;
        referencedResources: string[];
    }> {
        const snapshot = await basecardService.normalizeSnapshot({
            cardType,
            baseCardId,
            sourceConfig: rawData ?? {},
            cardRootDir: cardPath,
        });

        return {
            type: snapshot.cardType,
            data: snapshot.normalizedConfig,
            referencedResources: snapshot.referencedResources,
        };
    }

    private collectManifestResourcePaths(card: CompositeCard): string[] {
        const resourcePaths = new Set<string>();

        for (const basicCard of card.structure.basicCards) {
            for (const resourcePath of basicCard.referencedResources) {
                const normalizedPath = resourcePath.trim().replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '');
                if (normalizedPath) {
                    resourcePaths.add(normalizedPath);
                }
            }
        }

        for (const resource of card.cover?.resources ?? []) {
            const normalizedPath = resource.path.trim().replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '');
            if (normalizedPath) {
                resourcePaths.add(normalizedPath);
            }
        }

        return [...resourcePaths].sort((left, right) => left.localeCompare(right));
    }

    private markCardDirty(card: CompositeCard): void {
        const persistedRevision = card.persistedRevision ?? 0;
        const pendingPersistRevision = card.pendingPersistRevision ?? persistedRevision;
        card.isDirty = true;
        card.isPersisting = true;
        card.pendingPersistRevision = pendingPersistRevision + 1;
    }

    private queuePersist(cardId: string): Promise<void> {
        const existingTask = this.persistTasks.get(cardId);
        if (existingTask) {
            return existingTask;
        }

        const task = this.runPersistLoop(cardId)
            .catch((error) => {
                const card = this.state.openedCards.get(cardId);
                if (card) {
                    card.isPersisting = false;
                    card.isDirty = true;
                    this.notify();
                }
                console.error('[CardService] Failed to persist card.', { cardId, error });
                globalEventEmitter.emit('card:persist-error', { cardId, error });
            })
            .finally(() => {
                if (this.persistTasks.get(cardId) === task) {
                    this.persistTasks.delete(cardId);
                }
            });

        this.persistTasks.set(cardId, task);
        return task;
    }

    private async runPersistLoop(cardId: string): Promise<void> {
        while (true) {
            const currentCard = this.state.openedCards.get(cardId);
            if (!currentCard) {
                return;
            }

            const targetRevision = currentCard.pendingPersistRevision ?? currentCard.persistedRevision ?? 0;
            const snapshot = createPersistSnapshot(currentCard);
            await this.persistCard(snapshot);

            const liveCard = this.state.openedCards.get(cardId);
            if (!liveCard) {
                return;
            }

            liveCard.persistedRevision = targetRevision;
            liveCard.lastPersistedAt = now();

            const latestPendingRevision = liveCard.pendingPersistRevision ?? targetRevision;
            const stillDirty = latestPendingRevision > targetRevision;
            liveCard.isDirty = stillDirty;
            liveCard.isPersisting = stillDirty;

            this.notify();
            globalEventEmitter.emit('card:persisted', {
                cardId,
                revision: targetRevision,
                card: liveCard,
            });

            if (!stillDirty) {
                return;
            }
        }
    }

    async createCard(
        name: string,
        initialBasicCard?: { type: string; data?: Record<string, unknown> }
    ): Promise<CompositeCard> {
        const id = generateId62();
        const timestamp = now();
        const initialId = generateId62();
        const cardPath = `/${id}.card`;
        const basicCards: BasicCardData[] = [];

        if (initialBasicCard) {
            const normalized = await this.normalizeBasicCardSnapshot(
                cardPath,
                initialId,
                initialBasicCard.type,
                initialBasicCard.data,
            );
            basicCards.push({
                id: initialId,
                type: normalized.type,
                data: normalized.data,
                referencedResources: normalized.referencedResources,
                pendingResourceImports: [],
                pendingResourceDeletions: [],
                createdAt: timestamp,
                modifiedAt: timestamp,
            });
        }

        const newCard: CompositeCard = {
            id,
            path: cardPath,
            metadata: {
                name,
                coverRatio: DEFAULT_COVER_RATIO,
                createdAt: timestamp,
                modifiedAt: timestamp,
            },
            cover: {
                html: createDefaultCoverHtml(name),
                ratio: DEFAULT_COVER_RATIO,
                resources: [],
            },
            structure: {
                basicCards,
                layout: {
                    padding: 16,
                    gap: 12,
                },
            },
            isDirty: true,
            isEditing: true,
            isPersisting: false,
            persistedRevision: 0,
            pendingPersistRevision: 0,
        };

        this.state.openedCards.set(id, newCard);
        this.state.selectedCardId = id;
        this.state.selectedBasicCardId = basicCards[0]?.id ?? null;

        this.notify();
        globalEventEmitter.emit('card:created', { card: newCard });

        return newCard;
    }

    async openCard(id: string, cardPath: string): Promise<CompositeCard> {
        const existing = this.state.openedCards.get(id);
        if (existing) {
            this.state.selectedCardId = id;
            this.state.selectedBasicCardId = existing.structure.basicCards[0]?.id ?? null;
            this.notify();
            return existing;
        }

        const metadataPath = joinPath(cardPath, '.card/metadata.yaml');
        const structurePath = joinPath(cardPath, '.card/structure.yaml');
        const coverPath = joinPath(cardPath, '.card/cover.html');

        const metadataRaw = yaml.parse(await fileService.readText(metadataPath)) as Record<string, unknown>;
        const structureRaw = yaml.parse(await fileService.readText(structurePath)) as Record<string, unknown>;
        const coverHtml = await fileService.exists(coverPath)
            ? ensureCoverHtmlUsesCardRootBase(await fileService.readText(coverPath))
            : createDefaultCoverHtml(asString(metadataRaw.name) ?? id);
        const structureEntries = Array.isArray(structureRaw.structure) ? structureRaw.structure : [];

        const basicCards: BasicCardData[] = [];

        for (const entry of structureEntries) {
            const record = asRecord(entry);
            const basicCardId = asString(record.id);
            const typeValue = asString(record.type);
            const type = typeValue;
            if (!basicCardId || !type) {
                continue;
            }

            const contentPath = joinPath(cardPath, 'content', `${basicCardId}.yaml`);
            let parsedContent: Record<string, unknown> = {};
            if (await fileService.exists(contentPath)) {
                parsedContent = asRecord(yaml.parse(await fileService.readText(contentPath)));
            }

            const normalized = await this.normalizeBasicCardSnapshot(cardPath, basicCardId, type, parsedContent);
            basicCards.push({
                id: basicCardId,
                type: normalized.type,
                data: normalized.data,
                referencedResources: normalized.referencedResources,
                pendingResourceImports: [],
                pendingResourceDeletions: [],
                createdAt: asString(record.created_at) ?? asString(metadataRaw.created_at) ?? now(),
                modifiedAt: asString(record.modified_at) ?? asString(metadataRaw.modified_at) ?? now(),
            });
        }

        const card: CompositeCard = {
            id,
            path: cardPath,
            metadata: {
                name: asString(metadataRaw.name) ?? id,
                description: asString(metadataRaw.description),
                themeId: asString(metadataRaw.theme),
                coverRatio: normalizeCoverRatio(asString(metadataRaw.cover_ratio) ?? asString(metadataRaw.coverRatio)),
                createdAt: asString(metadataRaw.created_at) ?? now(),
                modifiedAt: asString(metadataRaw.modified_at) ?? now(),
                tags: Array.isArray(metadataRaw.tags) ? metadataRaw.tags.map((tag) => String(tag)) : undefined,
            },
            cover: {
                html: coverHtml,
                ratio: normalizeCoverRatio(asString(metadataRaw.cover_ratio) ?? asString(metadataRaw.coverRatio)),
                resources: [],
            },
            structure: {
                basicCards,
                layout: { padding: 16, gap: 12 },
            },
            isDirty: false,
            isEditing: true,
            isPersisting: false,
            persistedRevision: 0,
            pendingPersistRevision: 0,
        };

        this.state.openedCards.set(id, card);
        this.state.selectedCardId = id;
        this.state.selectedBasicCardId = basicCards[0]?.id ?? null;

        this.notify();
        globalEventEmitter.emit('card:opened', { card });

        return card;
    }

    closeCard(id: string): void {
        const card = this.state.openedCards.get(id);
        if (!card) return;

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

        if (card.isDirty) {
            if ((card.pendingPersistRevision ?? 0) <= (card.persistedRevision ?? 0)) {
                this.markCardDirty(card);
                this.notify();
            }
            await this.queuePersist(id);
        } else if (card.isPersisting) {
            await (this.persistTasks.get(id) ?? Promise.resolve());
        }

        const latestCard = this.state.openedCards.get(id);
        if (latestCard) {
            globalEventEmitter.emit('card:saved', { card: latestCard });
        }
    }

    async addBasicCard(
        cardId: string,
        type: string,
        data?: Record<string, unknown>,
        position?: number
    ): Promise<BasicCardData | null> {
        const card = this.state.openedCards.get(cardId);
        if (!card) return null;

        const timestamp = now();
        const basicCardId = generateId62();
        const normalized = await this.normalizeBasicCardSnapshot(card.path, basicCardId, type, data);
        const basicCard: BasicCardData = {
            id: basicCardId,
            type: normalized.type,
            data: normalized.data,
            referencedResources: normalized.referencedResources,
            pendingResourceImports: [],
            pendingResourceDeletions: [],
            createdAt: timestamp,
            modifiedAt: timestamp,
        };

        if (position !== undefined && position >= 0 && position <= card.structure.basicCards.length) {
            card.structure.basicCards.splice(position, 0, basicCard);
        } else {
            card.structure.basicCards.push(basicCard);
        }

        this.markCardDirty(card);
        card.metadata.modifiedAt = timestamp;
        this.state.selectedBasicCardId = basicCard.id;

        this.notify();
        void this.queuePersist(cardId);
        globalEventEmitter.emit('card:basic-card-added', { cardId, basicCard, position });

        return basicCard;
    }

    removeBasicCard(cardId: string, basicCardId: string): void {
        const card = this.state.openedCards.get(cardId);
        if (!card) return;

        const index = card.structure.basicCards.findIndex(bc => bc.id === basicCardId);
        if (index === -1) {
            return;
        }

        card.structure.basicCards.splice(index, 1);
        this.markCardDirty(card);
        card.metadata.modifiedAt = now();

        if (this.state.selectedBasicCardId === basicCardId) {
            this.state.selectedBasicCardId = card.structure.basicCards[0]?.id ?? null;
        }

        this.notify();
        void this.queuePersist(cardId);
        globalEventEmitter.emit('card:basic-card-removed', { cardId, basicCardId });
    }

    moveBasicCard(cardId: string, basicCardId: string, newPosition: number): void {
        const card = this.state.openedCards.get(cardId);
        if (!card) return;

        const currentIndex = card.structure.basicCards.findIndex(bc => bc.id === basicCardId);
        if (currentIndex === -1) return;

        const [basicCard] = card.structure.basicCards.splice(currentIndex, 1);
        if (!basicCard) {
            return;
        }

        const boundedPosition = Math.max(0, Math.min(newPosition, card.structure.basicCards.length));
        card.structure.basicCards.splice(boundedPosition, 0, basicCard);
        this.markCardDirty(card);
        card.metadata.modifiedAt = now();

        this.notify();
        void this.queuePersist(cardId);
        globalEventEmitter.emit('card:basic-card-moved', { cardId, basicCardId, newPosition: boundedPosition });
    }

    updateBasicCard(
        cardId: string,
        basicCardId: string,
        data: Record<string, unknown>,
        referencedResourcesOrOptions?: string[] | BasicCardResourceOperations,
    ): void {
        const card = this.state.openedCards.get(cardId);
        if (!card) return;

        const basicCard = card.structure.basicCards.find(bc => bc.id === basicCardId);
        if (!basicCard) {
            return;
        }

        const explicitReferencedResources = Array.isArray(referencedResourcesOrOptions)
            ? referencedResourcesOrOptions
            : referencedResourcesOrOptions?.referencedResources;
        const pendingResourceImports = Array.isArray(referencedResourcesOrOptions)
            ? basicCard.pendingResourceImports
            : normalizeResourceImports(referencedResourcesOrOptions?.imports);
        const pendingResourceDeletions = Array.isArray(referencedResourcesOrOptions)
            ? basicCard.pendingResourceDeletions
            : normalizeResourceDeletions(referencedResourcesOrOptions?.deletions);
        const nextReferencedResources = Array.isArray(explicitReferencedResources)
            ? explicitReferencedResources
                .map((item) => normalizeResourcePath(item))
                .filter((item): item is string => Boolean(item))
            : (() => {
                const nextResourcePaths = new Set(basicCard.referencedResources);
                pendingResourceImports.forEach((resource) => {
                    nextResourcePaths.add(resource.path);
                });
                pendingResourceDeletions.forEach((resourcePath) => {
                    nextResourcePaths.delete(resourcePath);
                });
                return [...nextResourcePaths].sort((left, right) => left.localeCompare(right));
            })();

        basicCard.data = cloneValue(data);
        basicCard.referencedResources = nextReferencedResources;
        basicCard.pendingResourceImports = pendingResourceImports;
        basicCard.pendingResourceDeletions = pendingResourceDeletions;
        basicCard.modifiedAt = now();
        this.markCardDirty(card);
        card.metadata.modifiedAt = now();

        this.notify();
        void this.queuePersist(cardId);
        globalEventEmitter.emit('card:basic-card-updated', { cardId, basicCardId, data: basicCard.data });
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

    updateCardMetadata(id: string, metadata: Partial<CardMetadata>): void {
        const card = this.state.openedCards.get(id);
        if (!card) return;

        card.metadata = { ...card.metadata, ...metadata, modifiedAt: now() };
        this.markCardDirty(card);

        this.notify();
        void this.queuePersist(id);
        globalEventEmitter.emit('card:metadata-updated', { cardId: id, metadata });
    }

    updateCardCover(id: string, input: {
        html: string;
        ratio?: string;
        resources?: CardCoverResource[];
    }): void {
        const card = this.state.openedCards.get(id);
        if (!card) return;

        const nextRatio = normalizeCoverRatio(input.ratio ?? card.metadata.coverRatio ?? card.cover?.ratio);
        card.cover = {
            html: ensureCoverHtmlUsesCardRootBase(input.html),
            ratio: nextRatio,
            resources: (input.resources ?? []).map((resource) => ({
                path: resource.path,
                data: new Uint8Array(resource.data),
            })),
        };
        card.metadata.coverRatio = nextRatio;
        card.metadata.modifiedAt = now();
        this.markCardDirty(card);

        this.notify();
        void this.queuePersist(id);
        globalEventEmitter.emit('card:cover-updated', {
            cardId: id,
            ratio: nextRatio,
        });
    }

    toggleEditMode(id: string): void {
        const card = this.state.openedCards.get(id);
        if (!card) return;

        card.isEditing = !card.isEditing;
        this.notify();
        globalEventEmitter.emit('card:edit-mode-changed', { cardId: id, isEditing: card.isEditing });
    }

    reset(): void {
        this.persistTasks.clear();
        this.state = {
            openedCards: new Map(),
            selectedCardId: null,
            selectedBasicCardId: null,
        };
        this.notify();
        globalEventEmitter.emit('card:reset', {});
    }

    private async persistCard(card: CompositeCard): Promise<void> {
        const metadataPath = joinPath(card.path, '.card', 'metadata.yaml');
        const structurePath = joinPath(card.path, '.card', 'structure.yaml');
        const coverPath = joinPath(card.path, '.card', 'cover.html');
        const contentDir = joinPath(card.path, 'content');

        await fileService.ensureDir(joinPath(card.path, '.card'));
        await fileService.ensureDir(contentDir);

        const manifestResourceMetadata = new Map<string, { size: number; type: string }>();
        for (const basicCard of card.structure.basicCards) {
            for (const resourcePath of basicCard.pendingResourceDeletions) {
                await fileService.delete(joinPath(card.path, resourcePath)).catch(() => undefined);
            }

            for (const resource of basicCard.pendingResourceImports) {
                const absolutePath = joinPath(card.path, resource.path);
                const resourceDir = absolutePath.split('/').slice(0, -1).join('/');
                await fileService.ensureDir(resourceDir);
                await fileService.writeBinary(absolutePath, resource.data);
                manifestResourceMetadata.set(resource.path, {
                    size: resource.data.byteLength,
                    type: inferResourceType(resource.path, resource.mimeType),
                });
            }
        }

        const metadata = {
            chip_standards_version: '1.0.0',
            card_id: card.id,
            name: card.metadata.name,
            created_at: card.metadata.createdAt,
            modified_at: card.metadata.modifiedAt,
            theme: card.metadata.themeId ?? '',
            cover_ratio: normalizeCoverRatio(card.metadata.coverRatio ?? card.cover?.ratio),
            description: card.metadata.description ?? '',
            tags: card.metadata.tags ?? [],
        };

        const structure = {
            structure: card.structure.basicCards.map((basicCard) => ({
                id: basicCard.id,
                type: basicCard.type,
                created_at: basicCard.createdAt,
                modified_at: basicCard.modifiedAt,
            })),
            manifest: {
                card_count: card.structure.basicCards.length,
                resource_count: 0,
                resources: [],
            },
        };

        for (const resource of card.cover?.resources ?? []) {
            manifestResourceMetadata.set(resource.path, {
                size: resource.data.byteLength,
                type: inferResourceType(resource.path),
            });
        }

        const manifestResourcePaths = this.collectManifestResourcePaths(card);
        const manifestResources: Array<{ path: string; size: number; type: string }> = [];
        for (const resourcePath of manifestResourcePaths) {
            const absolutePath = joinPath(card.path, resourcePath);
            const stat = await fileService.stat(absolutePath).catch(() => null);
            const metadata = manifestResourceMetadata.get(resourcePath);
            manifestResources.push({
                path: resourcePath,
                type: metadata?.type ?? inferResourceType(resourcePath),
                size: metadata?.size ?? stat?.size ?? 0,
            });
        }
        structure.manifest.resource_count = manifestResources.length;
        structure.manifest.resources = manifestResources;

        await fileService.writeText(metadataPath, yaml.stringify(metadata));
        await fileService.writeText(structurePath, yaml.stringify(structure));
        await fileService.writeText(
            coverPath,
            ensureCoverHtmlUsesCardRootBase(card.cover?.html ?? createDefaultCoverHtml(card.metadata.name)),
        );

        const expectedContentFiles = new Set<string>();
        for (const basicCard of card.structure.basicCards) {
            const contentPath = joinPath(contentDir, `${basicCard.id}.yaml`);
            expectedContentFiles.add(contentPath);
            await fileService.writeText(contentPath, yaml.stringify(basicCard.data));
            basicCard.pendingResourceImports = [];
            basicCard.pendingResourceDeletions = [];
        }

        for (const resource of card.cover?.resources ?? []) {
            const resourcePath = joinPath(card.path, resource.path);
            const resourceDir = resourcePath.split('/').slice(0, -1).join('/');
            await fileService.ensureDir(resourceDir);
            await fileService.writeBinary(resourcePath, resource.data);
            manifestResourceMetadata.set(resource.path, {
                size: resource.data.byteLength,
                type: inferResourceType(resource.path),
            });
        }

        for (const entry of await fileService.list(contentDir)) {
            if (!entry.isDirectory && entry.path.endsWith('.yaml') && !expectedContentFiles.has(entry.path)) {
                await fileService.delete(entry.path);
            }
        }
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
