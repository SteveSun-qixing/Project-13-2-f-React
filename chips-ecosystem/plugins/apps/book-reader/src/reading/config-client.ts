/**
 * 阅读态持久化客户端（《07-应用插件接口》§7.3：应用配置命名空间固定 `plugins.<appId>`，
 * UI 经 `chips.request('config:get' | 'config:set' | 'config:reset')` 显式携带 namespace）。
 *
 * 宿主 `config:*` 域处理器未交付（工单登记在案）：正式客户端调用失败时由弹性客户端
 * 整体降级为会话内存态，并以 `mode` 如实上报当前持久化形态；不做任何伪造成功的兜底。
 */

import { chips } from '@chips/sdk';

/** 应用配置命名空间（自身命名空间，读写免权限；07 §7.3）。 */
export const READING_CONFIG_NAMESPACE = 'plugins.chips.official.book-reader';

/** 阅读偏好的相对键。 */
export const PREFERENCES_CONFIG_KEY = 'preferences';

/** 书签相对键前缀（书源十六进制编码隔离）。 */
export const BOOKMARKS_CONFIG_KEY_PREFIX = 'bookmarks';

/** 阅读位置相对键前缀（书源十六进制编码隔离）。 */
export const POSITION_CONFIG_KEY_PREFIX = 'positions';

/** 阅读态持久化客户端最小面（get / set / reset）。 */
export interface ReadingConfigClient {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  reset(key: string): Promise<void>;
}

/** 经 `chips.request` 的正式 config 域客户端；宿主处理器缺位时请求按原样失败。 */
export function createChipsReadingConfigClient(): ReadingConfigClient {
  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      const output = await chips.request<{ value?: unknown }>('config:get', {
        namespace: READING_CONFIG_NAMESPACE,
        key,
      });
      return (output.value === undefined ? undefined : output.value) as T | undefined;
    },
    async set<T = unknown>(key: string, value: T): Promise<void> {
      await chips.request('config:set', {
        namespace: READING_CONFIG_NAMESPACE,
        key,
        value,
        scope: 'user',
      });
    },
    async reset(key: string): Promise<void> {
      await chips.request('config:reset', {
        namespace: READING_CONFIG_NAMESPACE,
        keys: [key],
        scope: 'user',
      });
    },
  };
}

/** 会话内存客户端：弹性降级臂的承载面，只在当前窗口会话内有效。 */
export function createMemoryReadingConfigClient(): ReadingConfigClient {
  const values = new Map<string, unknown>();
  return {
    get<T = unknown>(key: string): Promise<T | undefined> {
      return Promise.resolve((values.has(key) ? values.get(key) : undefined) as T | undefined);
    },
    set<T = unknown>(key: string, value: T): Promise<void> {
      values.set(key, value);
      return Promise.resolve();
    },
    reset(key: string): Promise<void> {
      values.delete(key);
      return Promise.resolve();
    },
  };
}

/** 弹性客户端当前的持久化形态。 */
export type ReadingPersistenceMode = 'config' | 'memory';

/** 弹性阅读配置客户端：正式面优先，首次失败起整体降级内存态并上报形态。 */
export interface ResilientReadingConfigClient extends ReadingConfigClient {
  /** 当前持久化形态。 */
  readonly mode: ReadingPersistenceMode;
  /** 订阅形态切换；返回退订句柄。 */
  onModeChange(listener: (mode: ReadingPersistenceMode) => void): () => void;
}

/** 构造弹性客户端：任一正式面操作失败即永久切换内存态（会话内不再重试 config 域）。 */
export function createResilientReadingConfigClient(
  primary: ReadingConfigClient,
  fallback: ReadingConfigClient = createMemoryReadingConfigClient()
): ResilientReadingConfigClient {
  let mode: ReadingPersistenceMode = 'config';
  const listeners = new Set<(mode: ReadingPersistenceMode) => void>();

  const switchToMemory = (): void => {
    if (mode === 'memory') {
      return;
    }
    mode = 'memory';
    for (const listener of listeners) {
      listener(mode);
    }
  };

  const delegate = (): ReadingConfigClient => (mode === 'config' ? primary : fallback);

  return {
    get mode(): ReadingPersistenceMode {
      return mode;
    },
    onModeChange(listener: (mode: ReadingPersistenceMode) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async get<T = unknown>(key: string): Promise<T | undefined> {
      try {
        return await delegate().get<T>(key);
      } catch {
        switchToMemory();
        return await fallback.get<T>(key);
      }
    },
    async set<T = unknown>(key: string, value: T): Promise<void> {
      try {
        await delegate().set(key, value);
      } catch {
        switchToMemory();
        await fallback.set(key, value);
      }
    },
    async reset(key: string): Promise<void> {
      try {
        await delegate().reset(key);
      } catch {
        switchToMemory();
        await fallback.reset(key);
      }
    },
  };
}
