/**
 * 播放队列持久化（重写件）。
 *
 * 权威口径：播放队列属应用数据，应写入插件自身配置命名空间（《10-配置系统设计》，
 * `config:*` 能力域）。诚实降级（工单066 在册）：`config:*` 域宿主侧处理器缺位
 * （`packages/host/src/capabilities/` 仅 document 域），渲染会话经 Bridge 写入必以
 * `BRIDGE_METHOD_NOT_FOUND` 类错误失败。本臂不假接线：队列收敛为**窗口会话内存态**——
 * 同一次窗口会话内读写一致、跨会话不持久；`config:*` 域处理器落波后，以同一
 * `MusicQueueStore` 接口换接 `IAppConfig` 读写实现，消费面零改动。
 *
 * 队列快照只承载可序列化的呈现数据（曲目来源与展示字段）；嵌入封面字节不落快照
 * （二进制大对象不入配置域，落波后按《10-配置系统设计》的资源引用语义换接）。
 */

import type { TrackPresentation } from './trackSession';

/** 队列快照：可 JSON 往返的纯数据。 */
export interface MusicQueueSnapshot {
  readonly items: readonly TrackPresentation[];
  readonly currentIndex: number;
}

/** 快照守卫：结构不合法时返回 null（换接持久化域后的防御性校验入口）。currentIndex = -1 表示未选中（合法态）。 */
export function normalizeQueueSnapshot(value: unknown): MusicQueueSnapshot | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as { items?: unknown; currentIndex?: unknown };
  if (!Array.isArray(candidate.items) || typeof candidate.currentIndex !== 'number') {
    return null;
  }
  const items = candidate.items.filter(
    (item): item is TrackPresentation =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as TrackPresentation).source?.resourceUri === 'string',
  );
  const rawIndex = candidate.currentIndex;
  const currentIndex =
    Number.isInteger(rawIndex) && rawIndex >= -1 && rawIndex < items.length
      ? rawIndex
      : items.length > 0
        ? 0
        : -1;
  return { items, currentIndex };
}

/** 队列存储接口：本臂内存实现，`config:*` 落波后换接 `IAppConfig` 实现面。 */
export interface MusicQueueStore {
  /** 读取队列快照；无快照时返回 null。 */
  load(): MusicQueueSnapshot | null;
  /** 写入队列快照（窗口会话内即时生效）。 */
  save(snapshot: MusicQueueSnapshot): void;
  /** 清空队列快照。 */
  clear(): void;
}

/** 创建窗口会话内存态队列存储（诚实降级实现，见文件头）。 */
export function createMusicQueueStore(): MusicQueueStore {
  let snapshot: MusicQueueSnapshot | null = null;

  return {
    load: (): MusicQueueSnapshot | null => (snapshot === null ? null : normalizeQueueSnapshot(snapshot)),
    save: (next: MusicQueueSnapshot): void => {
      snapshot = normalizeQueueSnapshot(next);
    },
    clear: (): void => {
      snapshot = null;
    },
  };
}

/**
 * 窗口会话默认队列存储：渲染上下文（窗口会话）内共享、跨会话不持久。
 *
 * 应用组合根（AppView/队列 hook）缺省消费本实例；测试用 `createMusicQueueStore()`
 * 建立隔离实例。`config:*` 域处理器落波后，本实例换接 `IAppConfig` 读写实现，接口不变。
 */
const windowSessionStore = createMusicQueueStore();

export function getWindowMusicQueueStore(): MusicQueueStore {
  return windowSessionStore;
}
