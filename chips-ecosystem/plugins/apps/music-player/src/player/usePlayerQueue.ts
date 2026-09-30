/**
 * 播放队列 hook（重写件：会话装配层）。
 *
 * 以迁移件 `PlaylistEngine` 为唯一队列事实源，镜像为 React 状态供界面消费；
 * 快照经 `MusicQueueStore` 收口（工单066：`config:*` 域处理器缺位期间为窗口会话
 * 内存态，落波后换接实现、本层零改动）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPlaylistEngine, type PlaylistEngine } from './playlistEngine';
import {
  getWindowMusicQueueStore,
  normalizeQueueSnapshot,
  type MusicQueueSnapshot,
  type MusicQueueStore,
} from './queuePersistence';
import type { TrackPresentation } from './trackSession';

export interface UsePlayerQueueOptions {
  /** 队列存储；缺省取窗口会话默认实例（测试可注入隔离实例）。 */
  store?: MusicQueueStore;
}

export interface UsePlayerQueueResult {
  readonly presentations: readonly TrackPresentation[];
  readonly currentIndex: number;
  readonly current: TrackPresentation | null;
  readonly canGoNext: boolean;
  readonly canGoPrevious: boolean;
  /** 追加曲目；队列原为空时自动选中首曲。 */
  append: (presentation: TrackPresentation) => void;
  /** 移除指定曲目；越界为安全空操作。 */
  removeAt: (index: number) => void;
  /** 选中并播放指定曲目；越界为安全空操作。 */
  playAt: (index: number) => void;
  goNext: () => void;
  goPrevious: () => void;
  /** 清空队列并清除会话快照。 */
  clear: () => void;
}

function readEngineSnapshot(engine: PlaylistEngine<TrackPresentation>): MusicQueueSnapshot {
  return { items: [...engine.items()], currentIndex: engine.currentIndex() };
}

export function usePlayerQueue(options: UsePlayerQueueOptions = {}): UsePlayerQueueResult {
  const store = options.store ?? getWindowMusicQueueStore();
  const engineRef = useRef<PlaylistEngine<TrackPresentation> | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createPlaylistEngine<TrackPresentation>();
  }
  const engine = engineRef.current;

  const [snapshot, setSnapshot] = useState<MusicQueueSnapshot>(() => ({
    items: [],
    currentIndex: -1,
  }));

  const sync = useCallback((): void => {
    const next = readEngineSnapshot(engine);
    setSnapshot(next);
    store.save(next);
  }, [engine, store]);

  // 会话回读：窗口会话内存态下重建同会话队列；config:* 落波后跨会话生效。
  useEffect(() => {
    const restored = store.load();
    if (restored !== null && restored.items.length > 0 && engine.items().length === 0) {
      engine.setQueue([...restored.items], restored.currentIndex);
      setSnapshot(readEngineSnapshot(engine));
    }
  }, [engine, store]);

  const append = useCallback(
    (presentation: TrackPresentation): void => {
      engine.append([presentation]);
      sync();
    },
    [engine, sync],
  );

  const removeAt = useCallback(
    (index: number): void => {
      engine.removeAt(index);
      sync();
    },
    [engine, sync],
  );

  const playAt = useCallback(
    (index: number): void => {
      engine.setQueue([...engine.items()], index);
      sync();
    },
    [engine, sync],
  );

  const goNext = useCallback((): void => {
    engine.goNext();
    sync();
  }, [engine, sync]);

  const goPrevious = useCallback((): void => {
    engine.goPrevious();
    sync();
  }, [engine, sync]);

  const clear = useCallback((): void => {
    engine.clear();
    store.clear();
    setSnapshot(readEngineSnapshot(engine));
  }, [engine, store]);

  return {
    presentations: snapshot.items,
    currentIndex: snapshot.currentIndex,
    current: snapshot.currentIndex >= 0 ? (snapshot.items[snapshot.currentIndex] ?? null) : null,
    canGoNext: engine.canGoNext(),
    canGoPrevious: engine.canGoPrevious(),
    append,
    removeAt,
    playAt,
    goNext,
    goPrevious,
    clear,
  };
}

/** 队列快照守卫再导出：持久化换接口的防御性校验入口（见 queuePersistence）。 */
export { normalizeQueueSnapshot };
