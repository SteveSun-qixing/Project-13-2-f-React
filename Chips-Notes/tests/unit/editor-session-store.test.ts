import { describe, expect, it, vi } from 'vitest';
import type { BasecardDescriptor } from '../../src/basecard-runtime/contracts';
import { EditorSessionStore } from '../../src/editor-runtime/session-store';

const descriptor: BasecardDescriptor = {
  pluginId: 'mock.basecard',
  cardType: 'base.mock',
  displayName: 'Mock Basecard',
  createInitialConfig: (baseCardId: string) => ({ id: baseCardId, images: [] }),
  normalizeConfig: (input: Record<string, unknown>, baseCardId: string) => ({
    ...input,
    id: baseCardId,
  }),
  validateConfig: () => ({
    valid: true,
    errors: {},
  }),
  collectResourcePaths: (config: Record<string, unknown>) => {
    const resourcePaths: string[] = [];
    for (const image of Array.isArray(config.images) ? config.images : []) {
      if (
        image
        && typeof image === 'object'
        && (image as { source?: unknown }).source === 'file'
        && typeof (image as { file_path?: unknown }).file_path === 'string'
      ) {
        resourcePaths.push((image as { file_path: string }).file_path);
      }
    }
    return resourcePaths;
  },
  renderView: () => () => undefined,
};

describe('EditorSessionStore', () => {
  it('keeps imported resources pending until the draft config references them', async () => {
    const store = new EditorSessionStore();
    const key = store.createKey('card-1', 'base-1');
    store.ensureSession({
      cardId: 'card-1',
      baseCardId: 'base-1',
      cardType: 'base.mock',
      sourceConfig: { id: 'base-1', images: [] },
      descriptor,
    });

    store.queueResourceImport(key, {
      path: 'photo.png',
      data: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
    });

    const commitAction = vi.fn();
    expect(store.canCommit(key, descriptor)).toBe(false);
    await store.commit(key, descriptor, commitAction);
    expect(commitAction).not.toHaveBeenCalled();

    store.updateDraft(key, descriptor, {
      id: 'base-1',
      images: [
        {
          id: 'image-1',
          source: 'file',
          file_path: 'photo.png',
        },
      ],
    });

    expect(store.canCommit(key, descriptor)).toBe(true);
    await store.commit(key, descriptor, commitAction);
    expect(commitAction).toHaveBeenCalledTimes(1);
    expect(commitAction).toHaveBeenCalledWith({
      config: {
        id: 'base-1',
        images: [
          {
            id: 'image-1',
            source: 'file',
            file_path: 'photo.png',
          },
        ],
      },
      resourceOperations: {
        imports: [
          {
            path: 'photo.png',
            data: new Uint8Array([1, 2, 3]),
            mimeType: 'image/png',
            token: expect.any(String),
          },
        ],
        deletions: [],
      },
    });
  });

  it('keeps deletion intents pending until the draft stops referencing the resource', async () => {
    const store = new EditorSessionStore();
    const key = store.createKey('card-1', 'base-1');
    store.ensureSession({
      cardId: 'card-1',
      baseCardId: 'base-1',
      cardType: 'base.mock',
      sourceConfig: {
        id: 'base-1',
        images: [
          {
            id: 'image-1',
            source: 'file',
            file_path: 'photo.png',
          },
        ],
      },
      descriptor,
    });

    store.queueResourceDeletion(key, 'photo.png');

    const commitAction = vi.fn();
    expect(store.canCommit(key, descriptor)).toBe(false);
    await store.commit(key, descriptor, commitAction);
    expect(commitAction).not.toHaveBeenCalled();

    store.updateDraft(key, descriptor, {
      id: 'base-1',
      images: [],
    });

    expect(store.canCommit(key, descriptor)).toBe(true);
    await store.commit(key, descriptor, commitAction);
    expect(commitAction).toHaveBeenCalledTimes(1);
    expect(commitAction).toHaveBeenCalledWith({
      config: {
        id: 'base-1',
        images: [],
      },
      resourceOperations: {
        imports: [],
        deletions: ['photo.png'],
      },
    });
  });
});
