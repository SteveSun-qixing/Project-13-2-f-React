/**
 * 生态设置面板：偏好存储（config:* 真实现主路径 + 会话内存降级件，工单066 翻正第一批）。
 *
 * 权威口径：《05-生态设置面板设计》§2.4——即时生效、提交失败回滚、单项恢复默认、
 * 生效层标记；§8.1/§8.6——偏好读写经 `config:snapshot` / `config:set` / `config:reset`
 * （platform 命名空间、user 写入层），生效值以 `config:changed` 的 `effectiveValue`
 * 刷新；§8.2——持久化不可用时如实呈现，不伪造持久化成功。
 *
 * 两条实现路径：
 * - `ConfigSettingsStore`（主路径，真实现）：回执驱动 + 写后重读投影——写臂/恢复默认臂
 *   只在 `config:*` 回执后经快照重读更新投影（不本地拼装第二事实源）；变更订阅按
 *   注册表过滤并归一生效值（多窗口一致性）；
 * - `createSessionSettingsStore`（降级件）：通道不可用（能力未注册 / 桥未注入等）时
 *   收敛为窗口会话内存态，界面以降级横幅与生效层标记如实呈现。
 */

import type { IConfigChange } from '@chips/sdk';
import {
  isPlatformFullKey,
  toRelativeKey,
  type PreferenceConfigGateway,
} from './configGateway';
import {
  findSetting,
  normalizeSettingValue,
  SETTING_DESCRIPTORS,
  type SettingDescriptor,
  type SettingEffectLayer,
  type SettingValue,
} from './catalog';

/** 偏好快照：当前生效值与生效层（`layers` 仅配置域路径逐键携带）。 */
export interface SettingsSnapshot {
  readonly values: Readonly<Record<string, SettingValue>>;
  /** 聚合生效层：配置域路径为 `user`（存在任一覆盖）或 `default`（全部默认）。 */
  readonly layer: SettingEffectLayer;
  /** 逐键生效层（`user` 显式覆盖 / `default` 未覆盖）；降级路径缺省。 */
  readonly layers?: Readonly<Record<string, SettingEffectLayer>>;
}

/** 偏好存储接口（降级件）：窗口会话内存实现，读写同步即时生效。 */
export interface SettingsPreferenceStore {
  /** 读取当前生效值（未写入过的键返回默认值）。 */
  read(key: string): SettingValue;
  /** 归一并写入；返回入库后的生效值（界面回显以返回值为准，失败面不存在）。 */
  write(key: string, value: unknown): SettingValue;
  /** 恢复单项默认并返回默认值。 */
  reset(key: string): SettingValue;
  /** 恢复一组键的默认（清退显式覆盖；降级件内存即时生效）。 */
  resetKeys(keys: readonly string[]): void;
  /** 分类级恢复默认：按注册表清退该分类全部显式覆盖。 */
  resetScene(sceneId: SettingDescriptor['sceneId']): void;
  /** 当前快照（全部在册键的生效值 + 生效层）。 */
  snapshot(): SettingsSnapshot;
}

/** 创建窗口会话内存态偏好存储（持久化通道不可用时的降级实现，见文件头）。 */
export function createSessionSettingsStore(): SettingsPreferenceStore {
  const overrides = new Map<string, SettingValue>();

  const effectiveValue = (descriptor: SettingDescriptor): SettingValue => {
    const explicit = overrides.get(descriptor.key);
    return explicit === undefined ? descriptor.defaultValue : explicit;
  };

  const requireDescriptor = (key: string): SettingDescriptor => {
    const descriptor = findSetting(key);
    if (descriptor === null) {
      throw new Error(`未登记的配置键：${key}`);
    }
    return descriptor;
  };

  return {
    read: (key: string): SettingValue => {
      return effectiveValue(requireDescriptor(key));
    },

    write: (key: string, value: unknown): SettingValue => {
      const descriptor = requireDescriptor(key);
      const normalized = normalizeSettingValue(descriptor, value);
      overrides.set(descriptor.key, normalized);
      return normalized;
    },

    reset: (key: string): SettingValue => {
      const descriptor = requireDescriptor(key);
      overrides.delete(descriptor.key);
      return descriptor.defaultValue;
    },

    resetKeys: (keys: readonly string[]): void => {
      for (const key of keys) {
        const descriptor = requireDescriptor(key);
        overrides.delete(descriptor.key);
      }
    },

    resetScene: (sceneId: SettingDescriptor['sceneId']): void => {
      for (const descriptor of SETTING_DESCRIPTORS) {
        if (descriptor.sceneId === sceneId) {
          overrides.delete(descriptor.key);
        }
      }
    },

    snapshot: (): SettingsSnapshot => {
      const values: Record<string, SettingValue> = {};
      for (const descriptor of SETTING_DESCRIPTORS) {
        values[descriptor.key] = effectiveValue(descriptor);
      }
      return { values, layer: 'session-memory' };
    },
  };
}

/**
 * 配置域偏好存储（主路径）：`config:*` 真实现消费，回执驱动 + 写后重读投影。
 *
 * - 读初值：`config:snapshot`（platform 命名空间）生效视图按注册表归一投影；
 *   未命中键回落注册表默认值（层标记 `default`），命中键标记 `user`；
 * - 写臂：归一后 `config:set`（user 层）→ 回执 → 快照重读 → 新投影（回执驱动，
 *   失败不前移投影、错误码原样传播）；
 * - 恢复默认：`config:reset`（一次调用提交全部键）→ 回执 → 快照重读；
 * - 变更订阅：`config:changed` 载荷按注册表过滤、以 `effectiveValue` 归一刷新
 *   （§8.2/§8.4，多窗口一致性）。
 */
export interface ConfigSettingsStore {
  /** 读取快照并建立投影（组合根挂载时调用）。 */
  load(): Promise<SettingsSnapshot>;
  /** 归一写入（user 层）→ 回执 → 快照重读 → 新投影。 */
  write(key: string, value: unknown): Promise<SettingsSnapshot>;
  /** 恢复单项默认 → 回执 → 快照重读 → 新投影。 */
  reset(key: string): Promise<SettingsSnapshot>;
  /** 一次调用恢复一组键的默认 → 回执 → 快照重读 → 新投影。 */
  resetKeys(keys: readonly string[]): Promise<SettingsSnapshot>;
  /** 订阅变更投影（句柄 `dispose` 幂等；挂载/卸载对称）。 */
  subscribe(handler: (snapshot: SettingsSnapshot) => void): { dispose(): void };
}

/** 快照生效视图按注册表投影：命中键归一后标记 `user`，未命中键回落默认标记 `default`。 */
export function projectConfigSnapshot(rawValues: Readonly<Record<string, unknown>>): SettingsSnapshot {
  const values: Record<string, SettingValue> = {};
  const layers: Record<string, SettingEffectLayer> = {};
  for (const descriptor of SETTING_DESCRIPTORS) {
    const raw = rawValues[descriptor.key];
    if (raw === undefined) {
      values[descriptor.key] = descriptor.defaultValue;
      layers[descriptor.key] = 'default';
      continue;
    }
    values[descriptor.key] = normalizeSettingValue(descriptor, raw);
    layers[descriptor.key] = 'user';
  }
  const layer: SettingEffectLayer = Object.values(layers).includes('user') ? 'user' : 'default';
  return { values, layer, layers };
}

/** 创建配置域偏好存储（主路径；网关经 `getPreferenceConfigGateway` / 测试隔离实例注入）。 */
export function createConfigSettingsStore(gateway: PreferenceConfigGateway): ConfigSettingsStore {
  const requireDescriptor = (key: string): SettingDescriptor => {
    const descriptor = findSetting(key);
    if (descriptor === null) {
      throw new Error(`未登记的配置键：${key}`);
    }
    return descriptor;
  };

  // 投影缓存：读臂/写臂/恢复默认臂每拍整体刷新；变更订阅按注册表单键合并。
  let cache: SettingsSnapshot | null = null;

  const reload = async (): Promise<SettingsSnapshot> => {
    cache = projectConfigSnapshot(await gateway.loadPlatformSnapshot());
    return cache;
  };

  return {
    load: reload,

    async write(key: string, value: unknown): Promise<SettingsSnapshot> {
      const descriptor = requireDescriptor(key);
      const normalized = normalizeSettingValue(descriptor, value);
      await gateway.writePlatformValue(toRelativeKey(descriptor.key), normalized);
      return reload();
    },

    async reset(key: string): Promise<SettingsSnapshot> {
      const descriptor = requireDescriptor(key);
      await gateway.resetPlatformKeys([toRelativeKey(descriptor.key)]);
      return reload();
    },

    async resetKeys(keys: readonly string[]): Promise<SettingsSnapshot> {
      if (keys.length === 0) {
        return reload();
      }
      const relativeKeys = keys.map((key) => toRelativeKey(requireDescriptor(key).key));
      await gateway.resetPlatformKeys(relativeKeys);
      return reload();
    },

    subscribe(handler: (snapshot: SettingsSnapshot) => void): { dispose(): void } {
      const applyChange = (change: IConfigChange): void => {
        if (!isPlatformFullKey(change.key)) {
          return;
        }
        const descriptor = findSetting(change.key);
        if (descriptor === null || cache === null) {
          return;
        }
        const values: Record<string, SettingValue> = { ...cache.values };
        const layers: Record<string, SettingEffectLayer> = { ...(cache.layers ?? {}) };
        values[descriptor.key] = normalizeSettingValue(descriptor, change.effectiveValue);
        layers[descriptor.key] = change.isDefault || change.value === null ? 'default' : 'user';
        cache = {
          values,
          layers,
          layer: Object.values(layers).includes('user') ? 'user' : 'default',
        };
        handler(cache);
      };
      return gateway.subscribePlatformChanges(applyChange);
    },
  };
}

/**
 * 窗口会话默认偏好存储：持久化通道不可用时的降级单例（组合根消费）；
 * 测试用 `createSessionSettingsStore()` 建立隔离实例。
 */
const windowSessionStore = createSessionSettingsStore();

export function getWindowSettingsStore(): SettingsPreferenceStore {
  return windowSessionStore;
}
