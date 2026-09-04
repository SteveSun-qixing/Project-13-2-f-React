import type {
  BasecardDescriptor,
  BasecardPendingResourceImport,
} from '../basecard-runtime/contracts';
import type { EditorSessionCommitPayload, EditorSessionSnapshot } from './contracts';

interface InternalEditorSession extends EditorSessionSnapshot {
  sourceSignature: string;
  draftSignature: string;
  resourceImports: Map<string, BasecardPendingResourceImport>;
  resourceDeletions: Set<string>;
}

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(config);
  }

  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

function toSignature(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function cloneResourceImport(resource: BasecardPendingResourceImport): BasecardPendingResourceImport {
  return {
    path: resource.path,
    data: cloneBytes(resource.data),
    mimeType: resource.mimeType,
    token: resource.token,
  };
}

function createPendingResourceToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function hasPendingResourceMutations(session: InternalEditorSession): boolean {
  return session.resourceImports.size > 0 || session.resourceDeletions.size > 0;
}

function syncDirtyFlag(session: InternalEditorSession): void {
  session.hasPendingResourceChanges = hasPendingResourceMutations(session);
  session.dirty = session.draftSignature !== session.sourceSignature || session.hasPendingResourceChanges;
}

function canCommitResourceOnlyMutations(
  session: InternalEditorSession,
  descriptor: BasecardDescriptor,
  committedConfig: Record<string, unknown>,
): boolean {
  if (!hasPendingResourceMutations(session)) {
    return false;
  }

  const referencedPaths = new Set(descriptor.collectResourcePaths?.(committedConfig) ?? []);
  const importPaths = Array.from(session.resourceImports.keys());
  const deletionPaths = Array.from(session.resourceDeletions);

  if (importPaths.some((resourcePath) => !referencedPaths.has(resourcePath))) {
    return false;
  }

  if (deletionPaths.some((resourcePath) => referencedPaths.has(resourcePath))) {
    return false;
  }

  return importPaths.length > 0 || deletionPaths.length > 0;
}

export class EditorSessionStore {
  private listeners = new Map<string, Set<() => void>>();
  private sessions = new Map<string, InternalEditorSession>();

  createKey(cardId: string, baseCardId: string): string {
    return `${cardId}::${baseCardId}`;
  }

  subscribe(key: string, listener: () => void): () => void {
    const listeners = this.listeners.get(key) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(key, listeners);

    return () => {
      const currentListeners = this.listeners.get(key);
      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);
      if (currentListeners.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  getSnapshot(key: string): EditorSessionSnapshot | null {
    const session = this.sessions.get(key);
    if (!session) {
      return null;
    }

    return {
      key: session.key,
      cardId: session.cardId,
      baseCardId: session.baseCardId,
      cardType: session.cardType,
      sourceConfig: cloneConfig(session.sourceConfig),
      draftConfig: cloneConfig(session.draftConfig),
      validation: {
        valid: session.validation.valid,
        errors: { ...session.validation.errors },
      },
      dirty: session.dirty,
      commitDebounceMs: session.commitDebounceMs,
      mountRevision: session.mountRevision,
      revision: session.revision,
      isCommitting: session.isCommitting,
      hasPendingResourceChanges: hasPendingResourceMutations(session),
      errorMessage: session.errorMessage,
    };
  }

  ensureSession(input: {
    cardId: string;
    baseCardId: string;
    cardType: string;
    sourceConfig: Record<string, unknown>;
    descriptor: BasecardDescriptor;
  }): EditorSessionSnapshot {
    const { cardId, baseCardId, cardType, sourceConfig, descriptor } = input;
    const key = this.createKey(cardId, baseCardId);
    const normalizedSource = descriptor.normalizeConfig(sourceConfig, baseCardId);
    const sourceSignature = toSignature(normalizedSource);
    const validation = descriptor.validateConfig(normalizedSource);
    const existing = this.sessions.get(key);

    if (!existing) {
      const session: InternalEditorSession = {
        key,
        cardId,
        baseCardId,
        cardType,
        sourceConfig: cloneConfig(normalizedSource),
        draftConfig: cloneConfig(normalizedSource),
        validation,
        dirty: false,
        commitDebounceMs: descriptor.commitDebounceMs ?? 260,
        mountRevision: 0,
        revision: 0,
        isCommitting: false,
        hasPendingResourceChanges: false,
        errorMessage: null,
        sourceSignature,
        draftSignature: sourceSignature,
        resourceImports: new Map(),
        resourceDeletions: new Set(),
      };

      this.sessions.set(key, session);
      this.emit(key);
      return this.getSnapshot(key)!;
    }

    let changed = false;

    if (existing.cardType !== cardType) {
      existing.cardType = cardType;
      changed = true;
    }

    const nextCommitDebounceMs = descriptor.commitDebounceMs ?? 260;
    if (existing.commitDebounceMs !== nextCommitDebounceMs) {
      existing.commitDebounceMs = nextCommitDebounceMs;
      changed = true;
    }

    if (existing.sourceSignature !== sourceSignature) {
      existing.sourceConfig = cloneConfig(normalizedSource);
      existing.sourceSignature = sourceSignature;
      changed = true;

      if (!existing.dirty) {
        existing.draftConfig = cloneConfig(normalizedSource);
        existing.draftSignature = sourceSignature;
        existing.validation = validation;
        existing.mountRevision += 1;
        existing.resourceImports.clear();
        existing.resourceDeletions.clear();
      }
    }

    if (changed) {
      this.emit(key);
    }

    return this.getSnapshot(key)!;
  }

  updateDraft(key: string, descriptor: BasecardDescriptor, nextDraftInput: Record<string, unknown>): EditorSessionSnapshot {
    const session = this.sessions.get(key);
    if (!session) {
      throw new Error(`未找到编辑会话: ${key}`);
    }

    const normalizedDraft = descriptor.normalizeConfig(nextDraftInput, session.baseCardId);
    const draftSignature = toSignature(normalizedDraft);
    if (draftSignature === session.draftSignature) {
      return this.getSnapshot(key)!;
    }

    session.draftConfig = cloneConfig(normalizedDraft);
    session.draftSignature = draftSignature;
    session.validation = descriptor.validateConfig(normalizedDraft);
    syncDirtyFlag(session);
    session.revision += 1;
    session.errorMessage = null;

    this.emit(key);
    return this.getSnapshot(key)!;
  }

  getPendingResourceImport(key: string, resourcePath: string): BasecardPendingResourceImport | null {
    const session = this.sessions.get(key);
    if (!session) {
      return null;
    }

    const resource = session.resourceImports.get(resourcePath);
    return resource ? cloneResourceImport(resource) : null;
  }

  hasPendingResourceDeletion(key: string, resourcePath: string): boolean {
    const session = this.sessions.get(key);
    if (!session) {
      return false;
    }

    return session.resourceDeletions.has(resourcePath);
  }

  queueResourceImport(
    key: string,
    resource: BasecardPendingResourceImport,
  ): EditorSessionSnapshot {
    const session = this.sessions.get(key);
    if (!session) {
      throw new Error(`未找到编辑会话: ${key}`);
    }

    session.resourceImports.set(resource.path, {
      ...cloneResourceImport(resource),
      token: resource.token ?? createPendingResourceToken(),
    });
    session.resourceDeletions.delete(resource.path);
    syncDirtyFlag(session);
    session.revision += 1;
    session.errorMessage = null;

    this.emit(key);
    return this.getSnapshot(key)!;
  }

  queueResourceDeletion(key: string, resourcePath: string): EditorSessionSnapshot {
    const session = this.sessions.get(key);
    if (!session) {
      throw new Error(`未找到编辑会话: ${key}`);
    }

    const removedPendingImport = session.resourceImports.delete(resourcePath);
    if (!removedPendingImport) {
      session.resourceDeletions.add(resourcePath);
    }

    syncDirtyFlag(session);
    session.revision += 1;
    session.errorMessage = null;

    this.emit(key);
    return this.getSnapshot(key)!;
  }

  canCommit(key: string, descriptor: BasecardDescriptor): boolean {
    const session = this.sessions.get(key);
    if (!session || !session.dirty || !session.validation.valid) {
      return false;
    }

    const committedConfig = descriptor.normalizeConfig(session.draftConfig, session.baseCardId);
    const committedSignature = toSignature(committedConfig);
    if (committedSignature !== session.sourceSignature) {
      return true;
    }

    return canCommitResourceOnlyMutations(session, descriptor, committedConfig);
  }

  async commit(
    key: string,
    descriptor: BasecardDescriptor,
    commitAction: (payload: EditorSessionCommitPayload) => Promise<void> | void,
  ): Promise<EditorSessionSnapshot> {
    const session = this.sessions.get(key);
    if (!session) {
      throw new Error(`未找到编辑会话: ${key}`);
    }

    if (!session.dirty || !session.validation.valid) {
      return this.getSnapshot(key)!;
    }

    const committedConfig = descriptor.normalizeConfig(session.draftConfig, session.baseCardId);
    const committedSignature = toSignature(committedConfig);
    const canCommitWithoutConfigDelta =
      committedSignature === session.sourceSignature
      && canCommitResourceOnlyMutations(session, descriptor, committedConfig);

    if (committedSignature === session.sourceSignature && !canCommitWithoutConfigDelta) {
      return this.getSnapshot(key)!;
    }

    const resourceOperations = {
      imports: Array.from(session.resourceImports.values()).map(cloneResourceImport),
      deletions: Array.from(session.resourceDeletions),
    };

    session.isCommitting = true;
    this.emit(key);

    try {
      await commitAction({
        config: cloneConfig(committedConfig),
        resourceOperations,
      });

      session.sourceConfig = cloneConfig(committedConfig);
      session.sourceSignature = committedSignature;
      session.draftConfig = cloneConfig(committedConfig);
      session.draftSignature = committedSignature;
      session.validation = descriptor.validateConfig(committedConfig);
      session.resourceImports.clear();
      session.resourceDeletions.clear();
      syncDirtyFlag(session);
      session.isCommitting = false;
      session.errorMessage = null;
      session.revision += 1;

      this.emit(key);
      return this.getSnapshot(key)!;
    } catch (error) {
      session.isCommitting = false;
      session.errorMessage = error instanceof Error ? error.message : String(error);
      session.revision += 1;
      this.emit(key);
      throw error;
    }
  }

  clearCard(cardId: string): void {
    const sessionKeys = Array.from(this.sessions.keys()).filter((key) => key.startsWith(`${cardId}::`));
    for (const key of sessionKeys) {
      this.sessions.delete(key);
      this.emit(key);
    }
  }

  clear(): void {
    const sessionKeys = Array.from(this.sessions.keys());
    this.sessions.clear();
    for (const key of sessionKeys) {
      this.emit(key);
    }
  }

  private emit(key: string): void {
    const listeners = this.listeners.get(key);
    if (!listeners) {
      return;
    }

    listeners.forEach((listener) => {
      listener();
    });
  }
}
