/**
 * 生态设置面板：偏好存储（诚实降级件，工单066 在册）。
 *
 * 权威口径：《05-生态设置面板设计》§2.4——即时生效、提交失败回滚、单项恢复默认、
 * 生效层标记；《10-配置系统设计》——偏好写入插件自身配置命名空间经 `config:*`。
 *
 * 宿主 `config:*` 域处理器缺位（`packages/host/src/capabilities/` 仅 document 域，
 * 渲染会话写入必以 `BRIDGE_METHOD_NOT_FOUND` 类错误失败）：本臂不假接线，偏好收敛为
 * **窗口会话内存态**——同一次窗口会话内读写一致、跨会话不持久；`config:*` 域处理器
 * 落波后，以同一 `SettingsPreferenceStore` 接口换接 `IAppConfig` / `chips.request('config:*')`
 * 读写实现，消费面零改动。生效层如实标记为「会话内存（未持久化）」，不伪造持久化成功。
 */

import {
  findSetting,
  normalizeSettingValue,
  SETTING_DESCRIPTORS,
  type SettingDescriptor,
  type SettingEffectLayer,
  type SettingValue,
} from './catalog';

/** 偏好快照：当前生效值与生效层（降级期为会话内存层）。 */
export interface SettingsSnapshot {
  readonly values: Readonly<Record<string, SettingValue>>;
  readonly layer: SettingEffectLayer;
}

/** 偏好存储接口：本臂会话内存实现，`config:*` 落波后换接配置域实现面。 */
export interface SettingsPreferenceStore {
  /** 读取当前生效值（未写入过的键返回默认值）。 */
  read(key: string): SettingValue;
  /** 归一并写入；返回入库后的生效值（界面回显以返回值为准，失败面不存在）。 */
  write(key: string, value: unknown): SettingValue;
  /** 恢复单项默认并返回默认值。 */
  reset(key: string): SettingValue;
  /** 分类级恢复默认：按注册表清退该分类全部显式覆盖。 */
  resetScene(sceneId: SettingDescriptor['sceneId']): void;
  /** 当前快照（全部在册键的生效值 + 生效层）。 */
  snapshot(): SettingsSnapshot;
}

/** 创建窗口会话内存态偏好存储（诚实降级实现，见文件头）。 */
export function createSessionSettingsStore(): SettingsPreferenceStore {
  const overrides = new Map<string, SettingValue>();

  const effectiveValue = (descriptor: SettingDescriptor): SettingValue => {
    const explicit = overrides.get(descriptor.key);
    return explicit === undefined ? descriptor.defaultValue : explicit;
  };

  return {
    read: (key: string): SettingValue => {
      const descriptor = findSetting(key);
      if (descriptor === null) {
        throw new Error(`未登记的配置键：${key}`);
      }
      return effectiveValue(descriptor);
    },

    write: (key: string, value: unknown): SettingValue => {
      const descriptor = findSetting(key);
      if (descriptor === null) {
        throw new Error(`未登记的配置键：${key}`);
      }
      const normalized = normalizeSettingValue(descriptor, value);
      overrides.set(descriptor.key, normalized);
      return normalized;
    },

    reset: (key: string): SettingValue => {
      const descriptor = findSetting(key);
      if (descriptor === null) {
        throw new Error(`未登记的配置键：${key}`);
      }
      overrides.delete(descriptor.key);
      return descriptor.defaultValue;
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
 * 窗口会话默认偏好存储：渲染上下文（窗口会话）内共享、跨会话不持久。
 *
 * 应用组合根（AppView）缺省消费本实例；测试用 `createSessionSettingsStore()`
 * 建立隔离实例。`config:*` 域处理器落波后，本实例换接配置域读写实现，接口不变。
 */
const windowSessionStore = createSessionSettingsStore();

export function getWindowSettingsStore(): SettingsPreferenceStore {
  return windowSessionStore;
}
