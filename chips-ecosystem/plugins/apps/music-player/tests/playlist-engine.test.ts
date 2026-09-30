import { describe, expect, it } from 'vitest';
import { createPlaylistEngine, type PlaylistEngine } from '../src/player/playlistEngine';
import { createAudioSourceFromUri, type TrackPresentation } from '../src/player/trackSession';

/**
 * 播放队列判例（随迁自旧仓 tests/unit/playlist-engine.test.ts，逐条保真）。
 *
 * 「真实夹具」口径：队列元素为经 `createAudioSourceFromUri` 归一的真实曲目呈现
 * （真实地址 → AudioSource → TrackPresentation），不 mock 队列元素、不 mock 引擎。
 */

function buildPresentation(uri: string): TrackPresentation {
  const source = createAudioSourceFromUri(uri);
  if (source === null) {
    throw new Error(`夹具地址不合法：${uri}`);
  }
  return { source, title: source.title, artist: '', album: '', artwork: { kind: 'default' }, lyrics: { mode: 'empty', source: 'none', lines: [], metadata: {}, rawText: '', offsetMs: 0 } };
}

const QUEUE_FIXTURES = [
  'file:///音乐库/夜曲.flac',
  'https://example.com/audio/晴天.mp3',
  'file:///音乐库/渡口.wav',
  'https://example.com/audio/橄榄树.m4a',
];

function createQueueEngine(): PlaylistEngine<TrackPresentation> {
  return createPlaylistEngine<TrackPresentation>();
}

describe('playlist engine（迁移判例，真实曲目夹具）', () => {
  it('starts empty with nothing playing', () => {
    const engine = createQueueEngine();

    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);
  });

  it('setQueue replaces the queue and selects the first item by default', () => {
    const engine = createQueueEngine();

    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation));

    expect(engine.current()?.source.fileName).toBe('夜曲.flac');
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(true);
  });

  it('setQueue honors an explicit start index', () => {
    const engine = createQueueEngine();

    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation), 1);

    expect(engine.current()?.source.title).toBe('晴天.mp3');
    expect(engine.canGoPrevious()).toBe(true);
    expect(engine.canGoNext()).toBe(true);

    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation), 3);

    expect(engine.current()?.source.title).toBe('橄榄树.m4a');
    expect(engine.canGoNext()).toBe(false);
  });

  it('setQueue with -1 leaves nothing playing', () => {
    const engine = createQueueEngine();

    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation), -1);

    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);
  });

  it('setQueue clamps out-of-range start indexes', () => {
    const engine = createQueueEngine();
    const pair = QUEUE_FIXTURES.slice(0, 2).map(buildPresentation);

    engine.setQueue(pair, 99);
    expect(engine.current()?.source.title).toBe('晴天.mp3');

    engine.setQueue(pair, -5);
    expect(engine.current()).toBeNull();
  });

  it('setQueue with an empty list leaves nothing playing', () => {
    const engine = createQueueEngine();

    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation));
    engine.setQueue([]);

    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);
  });

  it('goNext advances through the queue and stops at the end', () => {
    const engine = createQueueEngine();
    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation));

    engine.goNext();
    expect(engine.current()?.source.title).toBe('晴天.mp3');

    engine.goNext();
    expect(engine.current()?.source.title).toBe('渡口.wav');

    engine.goNext();
    expect(engine.current()?.source.title).toBe('橄榄树.m4a');
    expect(engine.canGoNext()).toBe(false);

    engine.goNext();
    expect(engine.current()?.source.title).toBe('橄榄树.m4a');
  });

  it('goPrevious goes back and stops at the start', () => {
    const engine = createQueueEngine();
    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation), 3);

    engine.goPrevious();
    expect(engine.current()?.source.title).toBe('渡口.wav');

    engine.goPrevious();
    expect(engine.current()?.source.title).toBe('晴天.mp3');

    engine.goPrevious();
    expect(engine.current()?.source.title).toBe('夜曲.flac');
    expect(engine.canGoPrevious()).toBe(false);

    engine.goPrevious();
    expect(engine.current()?.source.title).toBe('夜曲.flac');
  });

  it('navigation is inert while nothing is playing', () => {
    const engine = createQueueEngine();

    engine.goNext();
    engine.goPrevious();
    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);

    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation), -1);
    engine.goNext();
    engine.goPrevious();
    expect(engine.current()).toBeNull();
  });

  it('append extends the queue without changing the current track', () => {
    const engine = createQueueEngine();
    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation), 1);

    engine.append([buildPresentation('https://example.com/audio/安河桥.opus')]);

    expect(engine.current()?.source.title).toBe('晴天.mp3');
    expect(engine.canGoNext()).toBe(true);

    engine.goNext();
    expect(engine.current()?.source.title).toBe('渡口.wav');
    engine.goNext();
    expect(engine.current()?.source.title).toBe('橄榄树.m4a');
    engine.goNext();
    expect(engine.current()?.source.title).toBe('安河桥.opus');
    expect(engine.canGoNext()).toBe(false);
  });

  it('append to an empty queue starts at the first appended item', () => {
    const engine = createQueueEngine();

    engine.append([buildPresentation('file:///音乐库/夜曲.flac')]);

    expect(engine.current()?.source.title).toBe('夜曲.flac');
    expect(engine.canGoNext()).toBe(false);
  });

  it('append with no items is a no-op', () => {
    const engine = createQueueEngine();
    engine.setQueue([buildPresentation('file:///音乐库/夜曲.flac')]);

    engine.append([]);

    expect(engine.current()?.source.title).toBe('夜曲.flac');
    engine.goNext();
    expect(engine.current()?.source.title).toBe('夜曲.flac');
  });

  it('removeAt before the current track keeps the current track selected', () => {
    const engine = createQueueEngine();
    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation), 2);

    engine.removeAt(0);

    expect(engine.current()?.source.title).toBe('渡口.wav');
    expect(engine.canGoPrevious()).toBe(true);
    expect(engine.canGoNext()).toBe(true);
  });

  it('removeAt of the current track selects the following track', () => {
    const engine = createQueueEngine();
    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation), 1);

    engine.removeAt(1);

    expect(engine.current()?.source.title).toBe('渡口.wav');

    engine.removeAt(1);

    expect(engine.current()?.source.title).toBe('橄榄树.m4a');
  });

  it('removeAt of the last remaining track leaves nothing playing', () => {
    const engine = createQueueEngine();
    engine.setQueue([buildPresentation('file:///音乐库/夜曲.flac')]);

    engine.removeAt(0);

    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);
  });

  it('removeAt guards out-of-range indexes', () => {
    const engine = createQueueEngine();
    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation));

    engine.removeAt(99);
    engine.removeAt(-1);
    engine.removeAt(4);

    expect(engine.current()?.source.title).toBe('夜曲.flac');
    expect(engine.canGoNext()).toBe(true);
  });

  it('removeAt on an empty engine is a no-op', () => {
    const engine = createQueueEngine();

    expect(() => engine.removeAt(0)).not.toThrow();
    expect(engine.current()).toBeNull();
  });

  it('move reorders the queue', () => {
    const engine = createQueueEngine();
    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation), 1);

    engine.move(0, 3);

    expect(engine.current()?.source.title).toBe('晴天.mp3');
    engine.goNext();
    expect(engine.current()?.source.title).toBe('渡口.wav');
    engine.goNext();
    expect(engine.current()?.source.title).toBe('橄榄树.m4a');
    engine.goNext();
    expect(engine.current()?.source.title).toBe('夜曲.flac');
    expect(engine.canGoNext()).toBe(false);
  });

  it('moving the current track keeps it selected', () => {
    const engine = createQueueEngine();
    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation), 1);

    engine.move(1, 3);

    expect(engine.current()?.source.title).toBe('晴天.mp3');
    expect(engine.canGoNext()).toBe(false);
    expect(engine.canGoPrevious()).toBe(true);

    engine.goPrevious();
    expect(engine.current()?.source.title).toBe('橄榄树.m4a');
  });

  it('move guards out-of-range indexes', () => {
    const engine = createQueueEngine();
    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation));

    engine.move(99, 0);
    engine.move(0, 99);
    engine.move(-1, 2);
    engine.move(2, -1);
    engine.move(1, 1);

    expect(engine.current()?.source.title).toBe('夜曲.flac');
    engine.goNext();
    expect(engine.current()?.source.title).toBe('晴天.mp3');
    engine.goNext();
    expect(engine.current()?.source.title).toBe('渡口.wav');
    engine.goNext();
    expect(engine.current()?.source.title).toBe('橄榄树.m4a');
    expect(engine.canGoNext()).toBe(false);
  });

  it('clear resets the queue and selection', () => {
    const engine = createQueueEngine();
    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation), 1);

    engine.clear();

    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);

    engine.append([buildPresentation('https://example.com/audio/安河桥.opus')]);
    expect(engine.current()?.source.title).toBe('安河桥.opus');
  });

  it('clear on an empty engine is safe', () => {
    const engine = createQueueEngine();

    expect(() => engine.clear()).not.toThrow();
    expect(engine.current()).toBeNull();
  });

  it('items expose the live queue in order for the UI panel', () => {
    const engine = createQueueEngine();
    engine.setQueue(QUEUE_FIXTURES.map(buildPresentation));

    expect(engine.items().map((item) => item.source.resourceUri)).toEqual(QUEUE_FIXTURES);
  });
});
