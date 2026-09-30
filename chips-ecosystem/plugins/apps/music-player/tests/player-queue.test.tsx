import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePlayerQueue } from '../src/player/usePlayerQueue';
import { createMusicQueueStore } from '../src/player/queuePersistence';
import { createAudioSourceFromUri, type TrackPresentation } from '../src/player/trackSession';

/**
 * 播放队列 hook 判例（重写件）：以真实曲目夹具驱动迁移件 PlaylistEngine 与
 * 队列存储（真实解析装配，不 mock 引擎与存储）。
 */

function buildPresentation(uri: string): TrackPresentation {
  const source = createAudioSourceFromUri(uri);
  if (source === null) {
    throw new Error(`夹具地址不合法：${uri}`);
  }
  return { source, title: source.title, artist: '', album: '', artwork: { kind: 'default' }, lyrics: { mode: 'empty', source: 'none', lines: [], metadata: {}, rawText: '', offsetMs: 0 } };
}

describe('usePlayerQueue', () => {
  it('追加曲目自动选中首曲并推进导航', () => {
    const { result } = renderHook(() => usePlayerQueue({ store: createMusicQueueStore() }));

    act(() => {
      result.current.append(buildPresentation('https://example.com/a.mp3'));
    });
    act(() => {
      result.current.append(buildPresentation('https://example.com/b.flac'));
    });

    expect(result.current.presentations).toHaveLength(2);
    expect(result.current.current?.source.title).toBe('a.mp3');
    expect(result.current.canGoNext).toBe(true);
    expect(result.current.canGoPrevious).toBe(false);

    act(() => {
      result.current.goNext();
    });
    expect(result.current.current?.source.title).toBe('b.flac');
    expect(result.current.canGoNext).toBe(false);
  });

  it('playAt 选中指定曲目，removeAt 与 clear 维持引擎不变量', () => {
    const { result } = renderHook(() => usePlayerQueue({ store: createMusicQueueStore() }));
    act(() => {
      result.current.append(buildPresentation('https://example.com/a.mp3'));
      result.current.append(buildPresentation('https://example.com/b.flac'));
      result.current.append(buildPresentation('https://example.com/c.wav'));
    });

    act(() => {
      result.current.playAt(2);
    });
    expect(result.current.current?.source.title).toBe('c.wav');

    act(() => {
      result.current.removeAt(0);
    });
    expect(result.current.presentations.map((item) => item.source.title)).toEqual(['b.flac', 'c.wav']);
    expect(result.current.current?.source.title).toBe('c.wav');

    act(() => {
      result.current.clear();
    });
    expect(result.current.presentations).toHaveLength(0);
    expect(result.current.current).toBeNull();
  });

  it('快照入存储、新会话实例回读（窗口会话内存态语义）', async () => {
    const store = createMusicQueueStore();
    const first = renderHook(() => usePlayerQueue({ store }));
    act(() => {
      first.result.current.append(buildPresentation('https://example.com/a.mp3'));
      first.result.current.append(buildPresentation('https://example.com/b.flac'));
    });
    act(() => {
      first.result.current.playAt(1);
    });

    const second = renderHook(() => usePlayerQueue({ store }));
    await waitFor(() => {
      expect(second.result.current.presentations).toHaveLength(2);
    });
    expect(second.result.current.current?.source.title).toBe('b.flac');
  });
});
