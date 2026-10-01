import { describe, expect, it } from 'vitest';
import {
  findScene,
  findSetting,
  isDefaultValue,
  normalizeSettingValue,
  scenesInOrder,
  SETTING_DESCRIPTORS,
  settingsForScene,
  SETTINGS_SCENES,
} from '../src/domain/settings/catalog';

describe('九类分类注册表（§2.1）', () => {
  it('注册表恰好九类，顺序即展示顺序且 order 连续', () => {
    expect(SETTINGS_SCENES).toHaveLength(9);
    const ordered = scenesInOrder();
    expect(ordered.map((scene) => scene.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(ordered.map((scene) => scene.title)).toEqual([
      '外观',
      '行为',
      '工作区',
      '插件治理',
      '权限',
      '快捷键',
      '文件打开方式',
      '存储缓存',
      '关于更新',
    ]);
  });

  it('分类标识与跳转命令 ID 一一对应且符合 13-契约命令文法', () => {
    expect(new Set(SETTINGS_SCENES.map((scene) => scene.id)).size).toBe(9);
    for (const scene of SETTINGS_SCENES) {
      expect(scene.commandId).toBe(`settings:open-${scene.id}`);
      expect(scene.commandId).toMatch(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/);
    }
  });

  it('偏好承载分类无宿主域依赖，治理分类如实声明依赖域', () => {
    expect(findScene('appearance')?.requiredDomains).toEqual([]);
    expect(findScene('behavior')?.requiredDomains).toEqual([]);
    expect(findScene('workspace')?.requiredDomains).toContain('config:get');
    expect(findScene('about')?.requiredDomains).toContain('system:info');
    expect(findScene('nonexistent')).toBeNull();
  });
});

describe('偏好项注册表（§3.1 / §3.2）', () => {
  it('键位与默认值逐字对应设计文档', () => {
    const keys = new Map(SETTING_DESCRIPTORS.map((item) => [item.key, item.defaultValue]));
    expect(keys.get('platform.appearance.density')).toBe('comfortable');
    expect(keys.get('platform.appearance.motion')).toBe('system');
    expect(keys.get('platform.window.defaultWidth')).toBe(1200);
    expect(keys.get('platform.behavior.notifications')).toBe(true);
    expect(keys.get('platform.behavior.autoCheckUpdate')).toBe(true);
    expect(keys.get('platform.log.level')).toBe('info');
  });

  it('分类归属与分组：外观三项、行为三项；日志级别为高级项', () => {
    expect(settingsForScene('appearance').map((item) => item.key)).toEqual([
      'platform.appearance.density',
      'platform.appearance.motion',
      'platform.window.defaultWidth',
    ]);
    expect(settingsForScene('behavior').map((item) => item.key)).toEqual([
      'platform.behavior.notifications',
      'platform.behavior.autoCheckUpdate',
      'platform.log.level',
    ]);
    expect(settingsForScene('workspace')).toEqual([]);
    expect(findSetting('platform.log.level')?.advanced).toBe(true);
  });

  it('枚举取值集合与约束登记完整', () => {
    const density = findSetting('platform.appearance.density');
    expect(density?.options?.map((option) => option.value)).toEqual(['comfortable', 'compact']);
    const width = findSetting('platform.window.defaultWidth');
    expect(width?.minValue).toBe(640);
    expect(width?.maxValue).toBeUndefined();
  });
});

describe('取值归一（normalizeSettingValue）', () => {
  it('类型不符回退默认值，不做静默糅合', () => {
    const density = findSetting('platform.appearance.density') as NonNullable<
      ReturnType<typeof findSetting>
    >;
    expect(normalizeSettingValue(density, 'compact')).toBe('compact');
    expect(normalizeSettingValue(density, 'huge')).toBe('comfortable');
    expect(normalizeSettingValue(density, 42)).toBe('comfortable');
  });

  it('整数按界收敛：低于下界取下界，非整数拒绝回退', () => {
    const width = findSetting('platform.window.defaultWidth') as NonNullable<
      ReturnType<typeof findSetting>
    >;
    expect(normalizeSettingValue(width, 800)).toBe(800);
    expect(normalizeSettingValue(width, 320)).toBe(640);
    expect(normalizeSettingValue(width, 1200.5)).toBe(1200);
    expect(normalizeSettingValue(width, '1200')).toBe(1200);
  });

  it('布尔项只接受布尔', () => {
    const notifications = findSetting('platform.behavior.notifications') as NonNullable<
      ReturnType<typeof findSetting>
    >;
    expect(normalizeSettingValue(notifications, false)).toBe(false);
    expect(normalizeSettingValue(notifications, 'false')).toBe(true);
  });

  it('默认值判定支撑「恢复默认」呈现', () => {
    const motion = findSetting('platform.appearance.motion') as NonNullable<
      ReturnType<typeof findSetting>
    >;
    expect(isDefaultValue(motion, 'system')).toBe(true);
    expect(isDefaultValue(motion, 'reduced')).toBe(false);
  });
});
