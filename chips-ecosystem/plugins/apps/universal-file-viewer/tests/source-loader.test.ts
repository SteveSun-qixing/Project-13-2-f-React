import { afterEach, describe, expect, it } from 'vitest';
import type { IChipsBridge, IResourceHandle, ISubscription } from '@chips/sdk';
import { loadViewerFile, toPreviewItems } from '../src/domain/source-loader';
import type { ViewerQueueItem } from '../src/domain/viewer-target';

const TEXT_BYTES = new Uint8Array([104, 101, 108, 108, 111]);
const LARGE_BYTES = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

interface FakeBridge {
  readonly bridge: IChipsBridge;
  readonly reads: string[];
}

function createFakeBridge(byUri: Record<string, Uint8Array>): FakeBridge {
  const reads: string[] = [];
  const bridge: IChipsBridge = {
    request: <TOutput,>(_capabilityId: string, _input?: unknown): Promise<TOutput> =>
      Promise.reject(Object.assign(new Error('能力未登记'), { code: 'CAPABILITY_UNAVAILABLE' })),
    subscribe: (_eventId: string, _handler: (payload: unknown) => void): ISubscription => ({
      dispose: (): void => undefined,
    }),
    resource: (uri: string): IResourceHandle => ({
      uri,
      state: 'open',
      metadata: () => Promise.reject(Object.assign(new Error('未实现'), { code: 'CAPABILITY_UNAVAILABLE' })),
      read: () => {
        reads.push(uri);
        const bytes = byUri[uri];
        if (bytes === undefined) {
          return Promise.reject(Object.assign(new Error('资源不存在'), { code: 'RESOURCE_NOT_FOUND' }));
        }
        if (uri.includes('/large/')) {
          // >8MiB 口径：一次性 read 以 RESOURCE_TOO_LARGE 拒绝，逼出 stream() 降级路径。
          return Promise.reject(Object.assign(new Error('超出一次性读取上限'), { code: 'RESOURCE_TOO_LARGE' }));
        }
        return Promise.resolve(bytes);
      },
      readRange: () => Promise.reject(Object.assign(new Error('未实现'), { code: 'CAPABILITY_UNAVAILABLE' })),
      stream: () => {
        const bytes = byUri[uri] ?? new Uint8Array(0);
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });
      },
      release: (): void => undefined,
      onInvalidate: (): ISubscription => ({ dispose: (): void => undefined }),
    }),
  };
  return { bridge, reads };
}

afterEach(() => {
  delete (window as { chips?: unknown }).chips;
});

describe('loadViewerFile（资源读取投递）', () => {
  it('受管资源读取字节并构造带 MIME 的 File 引擎源', async () => {
    const fake = createFakeBridge({ 'chips-resource://ws/demo/notes.txt': TEXT_BYTES });
    (window as { chips?: unknown }).chips = fake.bridge;
    const item: ViewerQueueItem = {
      uri: 'chips-resource://ws/demo/notes.txt',
      fileName: 'notes.txt',
      mimeType: 'text/plain',
    };
    const loaded = await loadViewerFile(item);
    expect(loaded.origin).toBe('managed');
    expect(loaded.fileName).toBe('notes.txt');
    expect(loaded.mimeType).toBe('text/plain');
    expect(loaded.size).toBe(TEXT_BYTES.byteLength);
    expect(loaded.source).toBeInstanceOf(File);
    const file = loaded.source as File;
    expect(file.type).toBe('text/plain');
    expect(await file.text()).toBe('hello');
  });

  it('>8MiB 资源按 15-契约 §五降级 stream() 合并读取，不在界面层设 8MiB 上限', async () => {
    const fake = createFakeBridge({ 'chips-resource://ws/large/blob.bin': LARGE_BYTES });
    (window as { chips?: unknown }).chips = fake.bridge;
    const loaded = await loadViewerFile({
      uri: 'chips-resource://ws/large/blob.bin',
      fileName: 'blob.bin',
    });
    expect(fake.reads).toEqual(['chips-resource://ws/large/blob.bin']);
    expect(loaded.size).toBe(LARGE_BYTES.byteLength);
    const file = loaded.source as File;
    const bytes = new Uint8Array(await file.arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('远程 http(s) 引用不读取字节，直接交引擎按 URL 加载', async () => {
    const fake = createFakeBridge({});
    (window as { chips?: unknown }).chips = fake.bridge;
    const loaded = await loadViewerFile({
      uri: 'https://example.com/media/clip.mp4',
      fileName: 'clip.mp4',
      mimeType: 'video/mp4',
    });
    expect(loaded.origin).toBe('remote');
    expect(loaded.source).toBe('https://example.com/media/clip.mp4');
    expect(fake.reads).toEqual([]);
  });

  it('读取失败时原样抛出，不伪造空内容', async () => {
    const fake = createFakeBridge({});
    (window as { chips?: unknown }).chips = fake.bridge;
    await expect(
      loadViewerFile({ uri: 'chips-resource://ws/missing.txt', fileName: 'missing.txt' })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
});

describe('toPreviewItems', () => {
  it('装载结果映射为引擎队列项并携带文件名与 MIME', () => {
    const loaded = [
      {
        source: 'https://example.com/a.png',
        fileName: 'a.png',
        mimeType: 'image/png',
        origin: 'remote' as const,
      },
    ];
    expect(toPreviewItems(loaded)).toEqual([
      { file: 'https://example.com/a.png', fileName: 'a.png', mimeType: 'image/png' },
    ]);
  });
});
