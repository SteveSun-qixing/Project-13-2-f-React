import { describe, expect, it } from 'vitest';
import {
  createSessionSettingsStore,
  getWindowSettingsStore,
} from '../src/domain/settings/preferenceStore';

describe('会话内存偏好存储（诚实降级，工单066）', () => {
  it('未写入的键读取默认值，写入后读回归一值（即时生效）', () => {
    const store = createSessionSettingsStore();
    expect(store.read('platform.appearance.density')).toBe('comfortable');
    expect(store.write('platform.appearance.density', 'compact')).toBe('compact');
    expect(store.read('platform.appearance.density')).toBe('compact');
  });

  it('非法写入按归一规则回退/收敛，不污染既有偏好', () => {
    const store = createSessionSettingsStore();
    expect(store.write('platform.appearance.motion', 'huge')).toBe('system');
    expect(store.write('platform.window.defaultWidth', 100)).toBe(640);
    expect(store.write('platform.behavior.notifications', 'yes')).toBe(true);
    expect(store.read('platform.appearance.motion')).toBe('system');
  });

  it('单项恢复默认清退显式覆盖；分类级恢复默认覆盖该分类全部键', () => {
    const store = createSessionSettingsStore();
    store.write('platform.appearance.density', 'compact');
    store.write('platform.window.defaultWidth', 1920);
    store.write('platform.behavior.autoCheckUpdate', false);
    expect(store.reset('platform.appearance.density')).toBe('comfortable');
    expect(store.read('platform.window.defaultWidth')).toBe(1920);
    store.resetScene('appearance');
    expect(store.read('platform.window.defaultWidth')).toBe(1200);
    expect(store.read('platform.behavior.autoCheckUpdate')).toBe(false);
    store.resetScene('behavior');
    expect(store.read('platform.behavior.autoCheckUpdate')).toBe(true);
  });

  it('快照覆盖全部在册键并如实标记会话内存生效层', () => {
    const store = createSessionSettingsStore();
    store.write('platform.log.level', 'debug');
    const snapshot = store.snapshot();
    expect(snapshot.layer).toBe('session-memory');
    expect(Object.keys(snapshot.values)).toHaveLength(6);
    expect(snapshot.values['platform.log.level']).toBe('debug');
    expect(snapshot.values['platform.appearance.density']).toBe('comfortable');
  });

  it('实例隔离：不同 store 互不串写；未登记键读写直接失败', () => {
    const first = createSessionSettingsStore();
    const second = createSessionSettingsStore();
    first.write('platform.behavior.notifications', false);
    expect(second.read('platform.behavior.notifications')).toBe(true);
    expect(() => first.read('platform.unknown.key')).toThrow('未登记的配置键');
    expect(() => first.write('platform.unknown.key', 1)).toThrow('未登记的配置键');
  });

  it('窗口会话默认实例为稳定单例（组合根共享、跨会话不持久由宿主会话保证）', () => {
    expect(getWindowSettingsStore()).toBe(getWindowSettingsStore());
  });
});
