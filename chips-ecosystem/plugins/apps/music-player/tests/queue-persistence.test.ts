import { describe, expect, it } from 'vitest';
import {
  createMusicQueueStore,
  getWindowMusicQueueStore,
  normalizeQueueSnapshot,
} from '../src/player/queuePersistence';
import { createAudioSourceFromUri, type TrackPresentation } from '../src/player/trackSession';

/**
 * 队列持久化判例（重写件，工单066 降级面）。
 * 窗口会话内存态语义：同会话读写一致、清空显式生效、结构不合法快照被防御性归一。
 */

function buildPresentation(uri: string): TrackPresentation {
  const source = createAudioSourceFromUri(uri);
  if (source === null) {
    throw new Error(`夹具地址不合法：${uri}`);
  }
  return { source, title: source.title, artist: '', album: '', artwork: { kind: 'default' }, lyrics: { mode: 'empty', source: 'none', lines: [], metadata: {}, rawText: '', offsetMs: 0 } };
}

describe('normalizeQueueSnapshot（快照守卫）', () => {
  it('拒绝非对象与缺字段输入', () => {
    expect(normalizeQueueSnapshot(null)).toBeNull();
    expect(normalizeQueueSnapshot('queue')).toBeNull();
    expect(normalizeQueueSnapshot({})).toBeNull();
    expect(normalizeQueueSnapshot({ items: 'x', currentIndex: 0 })).toBeNull();
  });

  it('过滤非法条目，索引越界钳制、-1（未选中）为合法态', () => {
    const valid = buildPresentation('https://example.com/a.mp3');
    const snapshot = normalizeQueueSnapshot({ items: [valid, { broken: true }, 42], currentIndex: 9 });
    expect(snapshot?.items).toHaveLength(1);
    expect(snapshot?.currentIndex).toBe(0);

    const unselected = normalizeQueueSnapshot({ items: [valid], currentIndex: -1 });
    expect(unselected?.currentIndex).toBe(-1);

    const blank = normalizeQueueSnapshot({ items: [], currentIndex: 3 });
    expect(blank).toEqual({ items: [], currentIndex: -1 });
  });
});

describe('createMusicQueueStore（窗口会话内存态）', () => {
  it('同会话读写一致，快照经守卫归一', () => {
    const store = createMusicQueueStore();
    expect(store.load()).toBeNull();

    const items = ['https://example.com/a.mp3', 'https://example.com/b.flac'].map(buildPresentation);
    store.save({ items, currentIndex: 1 });

    const loaded = store.load();
    expect(loaded?.items).toHaveLength(2);
    expect(loaded?.currentIndex).toBe(1);
    expect(loaded?.items[1]?.source.title).toBe('b.flac');
  });

  it('load 返回防御性副本：外部篡改不穿透存储', () => {
    const store = createMusicQueueStore();
    store.save({ items: [buildPresentation('https://example.com/a.mp3')], currentIndex: 0 });
    const loaded = store.load();
    // readonly 类型面外的越权写（模拟外部篡改）不得穿透存储快照。
    (loaded?.items as TrackPresentation[]).push(buildPresentation('https://example.com/c.opus'));

    expect(store.load()?.items).toHaveLength(1);
  });

  it('clear 清空会话快照', () => {
    const store = createMusicQueueStore();
    store.save({ items: [buildPresentation('https://example.com/a.mp3')], currentIndex: 0 });
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('窗口会话默认实例为单例共享', () => {
    expect(getWindowMusicQueueStore()).toBe(getWindowMusicQueueStore());
  });
});
