/**
 * 卡片编辑会话聚合服务
 *
 * 动作面：card.init / card.session.*（见 constants.ts）。
 * 会话与自动保存由本服务（Host 主进程）管理，应用只订阅事件。
 */

import path from 'node:path';
import { createError } from '../../../../src/shared/errors';
import { guessMimeType } from '../../../../src/shared/mime';
import { AutosaveScheduler } from './autosave';
import { CARD_SESSION_ERROR_CODES } from './constants';
import { reconcileCoverResources, writeCoverResources } from './cover-reconcile';
import {
  buildCardResourceManifest,
  normalizeCoverRatio,
  parseCardDocument,
  writeCardDocument,
  type ParsedCardDocument,
} from './document-codec';
import { CardSessionHistory } from './history';
import {
  applyResourceOperations,
  clearPersistedImports,
  finalizePendingDeletions,
  flushPendingImports,
  normalizeResourcePath,
} from './resource-lifecycle';
import type {
  CardSessionBasicCard,
  CardSessionCover,
  CardSessionMetadata,
  CardSessionOptions,
  CardSessionResourceOperations,
  CardSessionSnapshot,
  CardSessionState,
} from './types';

export interface CardSessionEventSink {
  emit(event: string, payload: unknown): void;
}

export interface CardInitResult {
  cardDir: string;
  cardId: string;
  sessionId: string;
  snapshot: CardSessionSnapshot;
}

export interface CardSessionOpenResult {
  sessionId: string;
  snapshot: CardSessionSnapshot;
}

export interface CardSessionPublicResult {
  snapshot: CardSessionSnapshot;
  history: CardSessionHistory['view'] extends () => infer R ? R : never;
}

export class CardSessionService {
  private readonly sessions = new Map<string, CardSessionState>();
  private readonly sessionIdByCardId = new Map<string, string>();
  private readonly historyByCardId = new Map<string, CardSessionHistory>();
  private readonly options: CardSessionOptions;
  private readonly eventSink: CardSessionEventSink;
  private readonly autosave: AutosaveScheduler;

  public constructor(options: CardSessionOptions, eventSink: CardSessionEventSink) {
    this.options = options;
    this.eventSink = eventSink;
    this.autosave = new AutosaveScheduler({
      persist: async (state) => this.persistState(state),
      onPersisted: (state) => {
        state.snapshot.isDirty = false;
        state.snapshot.isPersisting = false;
        this.emit('card.session.persisted', {
          sessionId: this.sessionIdByCardId.get(state.snapshot.cardId),
          cardId: state.snapshot.cardId,
          snapshot: this.toPublic(state.snapshot),
        });
      },
      onPersistError: (state, error) => {
        state.snapshot.isPersisting = false;
        state.snapshot.isDirty = true;
        this.emit('card.session.persist-error', {
          sessionId: this.sessionIdByCardId.get(state.snapshot.cardId),
          cardId: state.snapshot.cardId,
          error,
        });
      },
    });
  }

  public async initCard(
    parentPath: string,
    name: string,
    initialBasicCard?: { type: string; data?: Record<string, unknown> },
    cardId?: string,
  ): Promise<CardInitResult> {
    const resolvedCardId = cardId?.trim() || createDocumentId();
    const finalCardId = /^[A-Za-z0-9_-]+$/.test(resolvedCardId) ? resolvedCardId : createDocumentId();
    const timestamp = new Date().toISOString();
    const cardDir = path.join(parentPath, `${finalCardId}.card`);
    const initialId = createDocumentId();
    const basicCards: CardSessionBasicCard[] = initialBasicCard
      ? [
          {
            id: initialId,
            type: initialBasicCard.type,
            data: await this.options.basecard.normalizeConfig(
              initialBasicCard.type,
              initialId,
              initialBasicCard.data ?? (await this.options.basecard.createInitialConfig(initialBasicCard.type, initialId)),
            ),
            createdAt: timestamp,
            modifiedAt: timestamp,
          },
        ]
      : [];

    const snapshot: CardSessionSnapshot = {
      cardId: finalCardId,
      path: cardDir,
      metadata: {
        name,
        coverRatio: '3:4',
        createdAt: timestamp,
        modifiedAt: timestamp,
      },
      cover: {
        html: this.options.createDefaultCoverHtml(name),
        ratio: '3:4',
        resources: [],
      },
      structure: {
        layout: { padding: 16, gap: 12 },
        basicCards,
      },
      isDirty: true,
      isPersisting: false,
      persistedRevision: 0,
    };

    await writeCardDocument(cardDir, snapshot, { createDefaultCoverHtml: this.options.createDefaultCoverHtml });

    const sessionId = createSessionId();
    const state: CardSessionState = {
      snapshot: { ...snapshot, isDirty: false, isPersisting: false, persistedRevision: 0 },
      pendingResourceImports: new Map(),
      pendingResourceDeletions: new Set(),
    };
    this.sessions.set(sessionId, state);
    this.sessionIdByCardId.set(finalCardId, sessionId);
    this.historyByCardId.set(sessionId, new CardSessionHistory());
    this.emit('card.session.opened', { sessionId, cardId: finalCardId, snapshot: this.toPublic(state.snapshot) });
    return { cardDir, cardId: finalCardId, sessionId, snapshot: this.toPublic(state.snapshot) };
  }

  public async open(cardDir: string): Promise<CardSessionOpenResult> {
    const parsed = await parseCardDocument(cardDir, {
      normalizeBasecardConfig: (cardType, baseCardId, config) =>
        this.options.basecard.normalizeConfig(cardType, baseCardId, config),
      createDefaultCoverHtml: this.options.createDefaultCoverHtml,
    });

    const sessionId = createSessionId();
    const snapshot: CardSessionSnapshot = {
      cardId: parsed.cardId,
      path: cardDir,
      metadata: parsed.metadata,
      cover: {
        html: parsed.coverHtml,
        ratio: parsed.coverRatio,
        resources: [],
      },
      structure: {
        layout: parsed.layout,
        basicCards: parsed.basicCards,
      },
      isDirty: false,
      isPersisting: false,
      persistedRevision: 0,
    };

    const state: CardSessionState = {
      snapshot,
      pendingResourceImports: new Map(),
      pendingResourceDeletions: new Set(),
    };
    this.sessions.set(sessionId, state);
    this.sessionIdByCardId.set(snapshot.cardId, sessionId);
    this.historyByCardId.set(sessionId, new CardSessionHistory());
    this.emit('card.session.opened', { sessionId, cardId: snapshot.cardId, snapshot: this.toPublic(snapshot) });
    return { sessionId, snapshot: this.toPublic(snapshot) };
  }

  public get(sessionId: string): CardSessionSnapshot {
    const state = this.requireSession(sessionId);
    return this.toPublic(state.snapshot);
  }

  public async updateBasicCard(
    sessionId: string,
    basicCardId: string,
    data: Record<string, unknown>,
    resourceOperations?: CardSessionResourceOperations,
  ): Promise<CardSessionSnapshot> {
    const state = this.requireSession(sessionId);
    const basicCard = state.snapshot.structure.basicCards.find((card) => card.id === basicCardId);
    if (!basicCard) {
      throw createError(CARD_SESSION_ERROR_CODES.BASIC_CARD_NOT_FOUND, `Basic card not found: ${basicCardId}`);
    }

    this.recordHistory(state, '更新基础卡片', basicCardId);

    basicCard.data = await this.options.basecard.normalizeConfig(basicCardId, basicCard.type, data);
    await applyResourceOperations(state, basicCardId, resourceOperations, this.options.basecard.collectResourcePaths);
    basicCard.modifiedAt = new Date().toISOString();
    state.snapshot.metadata.modifiedAt = basicCard.modifiedAt;

    this.markDirtyAndSchedule(state);
    return this.toPublic(state.snapshot);
  }

  public async addBasicCard(sessionId: string, type: string, data?: Record<string, unknown>, position?: number): Promise<CardSessionSnapshot> {
    const state = this.requireSession(sessionId);
    const timestamp = new Date().toISOString();
    const basicCard: CardSessionBasicCard = {
      id: createDocumentId(),
      type,
      data: await this.options.basecard.normalizeConfig(
        type,
        createDocumentId(),
        data ?? (await this.options.basecard.createInitialConfig(type, createDocumentId())),
      ),
      createdAt: timestamp,
      modifiedAt: timestamp,
    };

    this.recordHistory(state, '添加基础卡片');

    if (position !== undefined && position >= 0 && position <= state.snapshot.structure.basicCards.length) {
      state.snapshot.structure.basicCards.splice(position, 0, basicCard);
    } else {
      state.snapshot.structure.basicCards.push(basicCard);
    }
    state.snapshot.metadata.modifiedAt = timestamp;

    this.markDirtyAndSchedule(state);
    return this.toPublic(state.snapshot);
  }

  public async removeBasicCard(sessionId: string, basicCardId: string): Promise<CardSessionSnapshot> {
    const state = this.requireSession(sessionId);
    const index = state.snapshot.structure.basicCards.findIndex((card) => card.id === basicCardId);
    if (index === -1) {
      return this.toPublic(state.snapshot);
    }

    const basicCard = state.snapshot.structure.basicCards[index];
    if (basicCard) {
      for (const resourcePath of await this.options.basecard.collectResourcePaths(basicCard.type, basicCard.data)) {
        const normalizedPath = normalizeResourcePath(resourcePath);
        if (normalizedPath) {
          if (!state.pendingResourceImports.delete(normalizedPath)) {
            state.pendingResourceDeletions.add(normalizedPath);
          }
        }
      }
    }

    this.recordHistory(state, '删除基础卡片');

    state.snapshot.structure.basicCards.splice(index, 1);
    state.snapshot.metadata.modifiedAt = new Date().toISOString();

    this.markDirtyAndSchedule(state);
    return this.toPublic(state.snapshot);
  }

  public moveBasicCard(sessionId: string, basicCardId: string, newPosition: number): CardSessionSnapshot {
    const state = this.requireSession(sessionId);
    const currentIndex = state.snapshot.structure.basicCards.findIndex((card) => card.id === basicCardId);
    if (currentIndex === -1) {
      return this.toPublic(state.snapshot);
    }

    const [basicCard] = state.snapshot.structure.basicCards.splice(currentIndex, 1);
    if (!basicCard) {
      return this.toPublic(state.snapshot);
    }
    this.recordHistory(state, '移动基础卡片');

    const boundedPosition = Math.max(0, Math.min(newPosition, state.snapshot.structure.basicCards.length));
    state.snapshot.structure.basicCards.splice(boundedPosition, 0, basicCard);
    state.snapshot.metadata.modifiedAt = new Date().toISOString();

    this.markDirtyAndSchedule(state);
    return this.toPublic(state.snapshot);
  }

  public updateMetadata(sessionId: string, patch: Partial<CardSessionMetadata>): CardSessionSnapshot {
    const state = this.requireSession(sessionId);
    this.recordHistory(state, '更新卡片信息');

    state.snapshot.metadata = {
      ...state.snapshot.metadata,
      ...patch,
      modifiedAt: new Date().toISOString(),
    };

    this.markDirtyAndSchedule(state);
    return this.toPublic(state.snapshot);
  }

  public updateCover(sessionId: string, input: { html: string; ratio?: string; resources?: Array<{ path: string; data: Uint8Array }> }): CardSessionSnapshot {
    const state = this.requireSession(sessionId);
    const nextRatio = normalizeCoverRatio(input.ratio ?? state.snapshot.metadata.coverRatio);
    this.recordHistory(state, '更新封面');

    state.snapshot.cover = {
      html: input.html,
      ratio: nextRatio,
      resources: (input.resources ?? []).map((resource) => ({
        path: resource.path,
        data: new Uint8Array(resource.data),
      })),
    };
    state.snapshot.metadata.coverRatio = nextRatio;
    state.snapshot.metadata.modifiedAt = new Date().toISOString();

    this.markDirtyAndSchedule(state);
    return this.toPublic(state.snapshot);
  }

  public async persist(sessionId: string): Promise<CardSessionSnapshot> {
    const state = this.requireSession(sessionId);
    await this.autosave.flush(state);

    const deletedCount = await finalizePendingDeletions(
      state.snapshot.path,
      state,
      (cardType, config) => this.options.basecard.collectResourcePaths(cardType, config),
    );
    if (deletedCount > 0) {
      await this.persistState(state);
      state.snapshot.isDirty = false;
      state.snapshot.isPersisting = false;
      state.snapshot.lastPersistedAt = new Date().toISOString();
      this.emit('card.session.persisted', { sessionId, cardId: state.snapshot.cardId, snapshot: this.toPublic(state.snapshot) });
    }
    return this.toPublic(state.snapshot);
  }

  public undo(sessionId: string): CardSessionSnapshot {
    const state = this.requireSession(sessionId);
    const history = this.historyByCardId.get(sessionId);
    const result = history?.undo(state.snapshot);
    if (!result) {
      return this.toPublic(state.snapshot);
    }
    state.snapshot = result.snapshot;
    this.emit('card.session.undo', { sessionId, cardId: state.snapshot.cardId, snapshot: this.toPublic(state.snapshot) });
    return this.toPublic(state.snapshot);
  }

  public redo(sessionId: string): CardSessionSnapshot {
    const state = this.requireSession(sessionId);
    const history = this.historyByCardId.get(sessionId);
    const result = history?.redo(state.snapshot);
    if (!result) {
      return this.toPublic(state.snapshot);
    }
    state.snapshot = result.snapshot;
    this.emit('card.session.redo', { sessionId, cardId: state.snapshot.cardId, snapshot: this.toPublic(state.snapshot) });
    return this.toPublic(state.snapshot);
  }

  public history(sessionId: string): CardSessionHistory['view'] extends () => infer R ? R : never {
    const history = this.historyByCardId.get(sessionId);
    return history ? history.view() : { undoAvailable: false, redoAvailable: false, undoStack: [], redoStack: [] };
  }

  public close(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) {
      return;
    }
    this.autosave.clear(sessionId);
    this.sessions.delete(sessionId);
    if (this.sessionIdByCardId.get(state.snapshot.cardId) === sessionId) {
      this.sessionIdByCardId.delete(state.snapshot.cardId);
    }
    this.historyByCardId.delete(sessionId);
    this.emit('card.session.closed', { sessionId, cardId: state.snapshot.cardId });
  }

  public reset(): void {
    this.autosave.clearAll();
    this.sessions.clear();
    this.sessionIdByCardId.clear();
    this.historyByCardId.clear();
  }

  private async persistState(state: CardSessionState): Promise<void> {
    const snapshot = cloneForPersist(state.snapshot);
    await flushPendingImports(snapshot.path, state);
    await writeCoverResources(snapshot.path, snapshot.cover.resources);

    const manifest = await buildCardResourceManifest(snapshot.path, { guessMimeType });
    await writeCardDocument(snapshot.path, snapshot, {
      createDefaultCoverHtml: this.options.createDefaultCoverHtml,
      resourceManifest: {
        card_count: snapshot.structure.basicCards.length,
        resource_count: manifest.resource_count,
        resources: manifest.resources,
      },
    });
    await reconcileCoverResources(snapshot.path, snapshot.cover.html);

    clearPersistedImports(state, state);
    state.snapshot.persistedRevision += 1;
    state.snapshot.pendingPersistRevision = state.snapshot.persistedRevision;
    state.snapshot.isDirty = false;
    state.snapshot.isPersisting = false;
    state.snapshot.lastPersistedAt = new Date().toISOString();
  }

  private markDirtyAndSchedule(state: CardSessionState): void {
    state.snapshot.isDirty = true;
    state.snapshot.isPersisting = true;
    this.emit('card.session.dirty', { cardId: state.snapshot.cardId, sessionId: this.findSessionId(state) });
    this.autosave.schedule(state);
  }

  private recordHistory(state: CardSessionState, label: string, basicCardId?: string): void {
    const history = this.historyByCardId.get(this.findSessionId(state));
    history?.record(state.snapshot, label, basicCardId);
  }

  private findSessionId(state: CardSessionState): string {
    for (const [sessionId, candidate] of this.sessions) {
      if (candidate === state) {
        return sessionId;
      }
    }
    return '';
  }

  private requireSession(sessionId: string): CardSessionState {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw createError(CARD_SESSION_ERROR_CODES.SESSION_NOT_FOUND, `Card session not found: ${sessionId}`);
    }
    return state;
  }

  private toPublic(snapshot: CardSessionSnapshot): CardSessionSnapshot {
    return {
      ...snapshot,
      cover: {
        html: snapshot.cover.html,
        ratio: snapshot.cover.ratio,
        resources: snapshot.cover.resources.map((resource) => ({
          path: resource.path,
          data: new Uint8Array(resource.data),
        })),
      },
      metadata: {
        ...snapshot.metadata,
        tags: snapshot.metadata.tags ? [...snapshot.metadata.tags] : undefined,
      },
      structure: {
        layout: { ...snapshot.structure.layout },
        basicCards: snapshot.structure.basicCards.map((card) => ({
          ...card,
          data: JSON.parse(JSON.stringify(card.data)) as Record<string, unknown>,
        })),
      },
    };
  }

  private emit(event: string, payload: unknown): void {
    this.eventSink.emit(event, payload);
  }
}

const cloneForPersist = (snapshot: CardSessionSnapshot): CardSessionSnapshot => {
  return {
    ...snapshot,
    cover: {
      html: snapshot.cover.html,
      ratio: snapshot.cover.ratio,
      resources: snapshot.cover.resources.map((resource) => ({
        path: resource.path,
        data: new Uint8Array(resource.data),
      })),
    },
    metadata: { ...snapshot.metadata },
    structure: {
      layout: { ...snapshot.structure.layout },
      basicCards: snapshot.structure.basicCards.map((card) => ({
        ...card,
        data: JSON.parse(JSON.stringify(card.data)) as Record<string, unknown>,
      })),
    },
  };
};

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
};

const createDocumentId = (): string => {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let id = '';
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  for (const byte of bytes) {
    id += alphabet[byte % alphabet.length];
  }
  return id;
};

const createSessionId = (): string => {
  return `card-session-${Date.now()}-${createDocumentId()}`;
};
