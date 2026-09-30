import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChipsError, chips } from '@chips/sdk';
import type { IResourceOpenContext } from '@chips/sdk';
import {
  buildResourceOpenRequest,
  createSourceFromOpenContext,
  readBookFromUri,
  RESOURCE_READ_MAX_BYTES,
} from '../../src/reading/book-opener';

const OPEN_CONTEXT: IResourceOpenContext = {
  intent: 'view',
  origin: 'frame',
  uri: 'chips-resource://card-7f3a/books/sea.epub',
  mimeType: 'application/epub+zip',
  extension: '.epub',
  fileName: 'sea.epub',
  title: 'Sea of Pages',
  slot: 'mime:application/epub+zip',
  payload: {
    display: { title: 'Sea of Pages', author: 'Alice Chen' },
  },
};

function installChipsResourceMock(handle: Record<string, unknown>): void {
  (globalThis as { chips?: unknown }).chips = {
    resource: (uri: string): Record<string, unknown> => ({ uri, ...handle }),
  };
}

afterEach(() => {
  delete (globalThis as { chips?: unknown }).chips;
  vi.restoreAllMocks();
});

describe('createSourceFromOpenContext', () => {
  it('从打开上下文组装书源描述符（载荷 display 优先）', () => {
    const source = createSourceFromOpenContext(OPEN_CONTEXT);
    expect(source.sourceId).toBe(OPEN_CONTEXT.uri);
    expect(source.title).toBe('Sea of Pages');
    expect(source.author).toBe('Alice Chen');
    expect(source.fileName).toBe('sea.epub');
    expect(source.mimeType).toBe('application/epub+zip');
  });

  it('上下文缺 display 时按文件名与 title 兜底，不因缺失拒绝', () => {
    const source = createSourceFromOpenContext({
      intent: 'view',
      origin: 'frame',
      uri: OPEN_CONTEXT.uri,
      mimeType: OPEN_CONTEXT.mimeType,
      ...(OPEN_CONTEXT.fileName === undefined ? {} : { fileName: OPEN_CONTEXT.fileName }),
      slot: OPEN_CONTEXT.slot,
    });
    expect(source.title).toBe('sea.epub');
    expect(source.author).toBeUndefined();
  });
});

describe('buildResourceOpenRequest', () => {
  it('组装 resource:open 正式面请求（view 意图、uri 透传）', () => {
    expect(buildResourceOpenRequest({ uri: 'chips-resource://x/a.epub' })).toEqual({
      intent: 'view',
      resource: { uri: 'chips-resource://x/a.epub' },
    });
    expect(
      buildResourceOpenRequest({ uri: 'chips-resource://x/a.epub', fileName: 'a.epub', title: 'A' })
    ).toEqual({
      intent: 'view',
      resource: { uri: 'chips-resource://x/a.epub', fileName: 'a.epub', title: 'A' },
    });
  });
});

describe('readBookFromUri', () => {
  it('资源句柄在册时读取字节并回填书源 resourceUri', async () => {
    installChipsResourceMock({
      metadata: (): Promise<{ size: number; mimeType: string }> =>
        Promise.resolve({ size: 10, mimeType: 'application/epub+zip' }),
      read: (): Promise<Uint8Array> => Promise.resolve(new Uint8Array([1, 2, 3])),
    });

    const outcome = await readBookFromUri(
      OPEN_CONTEXT.uri,
      createSourceFromOpenContext(OPEN_CONTEXT)
    );
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') {
      expect(Array.from(outcome.bytes)).toEqual([1, 2, 3]);
      expect(outcome.source.resourceUri).toBe(OPEN_CONTEXT.uri);
      expect(outcome.mimeType).toBe('application/epub+zip');
    }
  });

  it('超过 8 MiB 上限时如实报错，不降级不伪造', async () => {
    installChipsResourceMock({
      metadata: (): Promise<{ size: number; mimeType: string }> =>
        Promise.resolve({ size: RESOURCE_READ_MAX_BYTES + 1, mimeType: 'application/epub+zip' }),
      read: (): Promise<Uint8Array> => Promise.reject(new Error('不应触发单次读取')),
    });

    const outcome = await readBookFromUri(
      OPEN_CONTEXT.uri,
      createSourceFromOpenContext(OPEN_CONTEXT)
    );
    expect(outcome.kind).toBe('failure');
    if (outcome.kind === 'failure') {
      expect(outcome.failure.kind).toBe('too-large');
      expect(outcome.failure.message).toContain('流式读取链路尚未就绪');
    }
  });

  it('资源通道不可用时以简体中文失败形态返回', async () => {
    (globalThis as { chips?: unknown }).chips = {
      resource: (): never => {
        throw new ChipsError({
          code: 'SDK_BRIDGE_UNAVAILABLE',
          message: '资源通道不可用',
        });
      },
    };

    const outcome = await readBookFromUri(
      OPEN_CONTEXT.uri,
      createSourceFromOpenContext(OPEN_CONTEXT)
    );
    expect(outcome.kind).toBe('failure');
    if (outcome.kind === 'failure') {
      expect(outcome.failure.kind).toBe('resource-unavailable');
      expect(outcome.failure.message).toContain('资源通道不可用');
    }
  });

  it('元数据读取失败时按 resource-unavailable 报错', async () => {
    installChipsResourceMock({
      metadata: (): Promise<{ size: number; mimeType: string }> =>
        Promise.reject(new Error('RESOURCE_NOT_FOUND')),
    });

    const outcome = await readBookFromUri(
      OPEN_CONTEXT.uri,
      createSourceFromOpenContext(OPEN_CONTEXT)
    );
    expect(outcome.kind).toBe('failure');
    if (outcome.kind === 'failure') {
      expect(outcome.failure.message).toContain('RESOURCE_NOT_FOUND');
    }
  });
});

describe('chips 资源面调用约定', () => {
  it('打开臂只消费 chips.resource 正式面句柄', async () => {
    const resourceSpy = vi.fn((uri: string): Record<string, unknown> => ({
      uri,
      metadata: (): Promise<{ size: number; mimeType: string }> =>
        Promise.resolve({ size: 1, mimeType: 'text/plain' }),
      read: (): Promise<Uint8Array> => Promise.resolve(new Uint8Array([9])),
    }));
    (globalThis as { chips?: unknown }).chips = { resource: resourceSpy };

    await readBookFromUri('chips-resource://scope/book.txt', {
      ...createSourceFromOpenContext(OPEN_CONTEXT),
      sourceId: 'chips-resource://scope/book.txt',
    });
    expect(resourceSpy).toHaveBeenCalledWith('chips-resource://scope/book.txt');
    expect(chips).toBeDefined();
  });
});
