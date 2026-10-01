import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IConfigChange } from '@chips/sdk';
import {
  createConfigSettingsStore,
  type SettingsSnapshot,
} from '../src/domain/settings/preferenceStore';
import {
  SettingsConfigError,
  type PreferenceConfigGateway,
} from '../src/domain/settings/configGateway';

/**
 * 配置域偏好存储测试：以受控网关替身锁定「回执驱动 + 写后重读投影」链——
 * 写入/恢复默认只在 `config:*` 回执后经快照重读更新投影（不本地拼装第二事实源），
 * 失败臂不前移投影、错误码原样传播；`config:changed` 载荷按注册表过滤并归一生效值。
 */

/** 受控网关替身：记录调用并按脚本回放（快照表 + 写臂脚本）。 */
function createGatewayStub(overrides: {
  snapshotTable?: Record<string, unknown>;
  writeScript?: (key: string, value: unknown) => void;
  writeError?: SettingsConfigError;
  resetError?: SettingsConfigError;
} = {}): PreferenceConfigGateway & {
  written: readonly { key: string; value: unknown }[];
  resetCalls: readonly (readonly string[])[];
  snapshotCalls: number;
  disposes: readonly number[];
  emitChange: (payload: unknown) => void;
} {
  const table = new Map<string, unknown>(Object.entries(overrides.snapshotTable ?? {}));
  const written: { key: string; value: unknown }[] = [];
  const resetCalls: string[][] = [];
  const disposes: number[] = [];
  let snapshotCalls = 0;
  let changeHandler: ((payload: unknown) => void) | null = null;
  return {
    written,
    resetCalls,
    get snapshotCalls(): number {
      return snapshotCalls;
    },
    disposes,
    emitChange: (payload: unknown): void => {
      changeHandler?.(payload);
    },
    loadPlatformSnapshot(): Promise<Readonly<Record<string, unknown>>> {
      snapshotCalls += 1;
      return Promise.resolve({ ...Object.fromEntries(table) });
    },
    writePlatformValue(key: string, value: unknown): Promise<void> {
      if (overrides.writeError !== undefined) {
        throw overrides.writeError;
      }
      overrides.writeScript?.(key, value);
      // 宿主承载以完整配置键落表（config.user.json 键为完整键）。
      table.set(`platform.${key}`, value);
      written.push({ key, value });
      return Promise.resolve();
    },
    resetPlatformKeys(keys: readonly string[]): Promise<void> {
      if (overrides.resetError !== undefined) {
        throw overrides.resetError;
      }
      for (const key of keys) {
        table.delete(`platform.${key}`);
      }
      resetCalls.push([...keys]);
      return Promise.resolve();
    },
    subscribePlatformChanges(handler: (change: IConfigChange) => void): { dispose(): void } {
      changeHandler = handler as (payload: unknown) => void;
      return {
        dispose(): void {
          disposes.push(disposes.length + 1);
        },
      };
    },
  };
}

function valueOf(snapshot: SettingsSnapshot | undefined, key: string): unknown {
  return snapshot === undefined ? undefined : snapshot.values[key];
}

function layerOf(snapshot: SettingsSnapshot | undefined, key: string): unknown {
  return snapshot?.layers?.[key];
}

beforeEach(() => {
  delete (globalThis as { chips?: unknown }).chips;
});

afterEach(() => {
  delete (globalThis as { chips?: unknown }).chips;
});

describe('配置域偏好存储：读初值投影', () => {
  it('快照命中项投影为用户层覆盖，未命中项回落注册表默认值', async () => {
    const gateway = createGatewayStub({ snapshotTable: { 'platform.appearance.density': 'compact' } });
    const snapshot = await createConfigSettingsStore(gateway).load();
    expect(valueOf(snapshot, 'platform.appearance.density')).toBe('compact');
    expect(snapshot.layers?.['platform.appearance.density']).toBe('user');
    expect(valueOf(snapshot, 'platform.window.defaultWidth')).toBe(1200);
    expect(snapshot.layers?.['platform.window.defaultWidth']).toBe('default');
    expect(snapshot.layer).toBe('user');
  });

  it('快照值按注册表归一后投影（越界收敛、非法回退默认），不白信通道取值', async () => {
    const gateway = createGatewayStub({
      snapshotTable: { 'platform.window.defaultWidth': 100, 'platform.appearance.motion': { 不合法: true } },
    });
    const snapshot = await createConfigSettingsStore(gateway).load();
    expect(valueOf(snapshot, 'platform.window.defaultWidth')).toBe(640);
    expect(valueOf(snapshot, 'platform.appearance.motion')).toBe('system');
  });

  it('全部键无覆盖时聚合生效层如实标记为默认值层', async () => {
    const gateway = createGatewayStub({});
    const snapshot = await createConfigSettingsStore(gateway).load();
    expect(snapshot.layer).toBe('default');
  });
});

describe('配置域偏好存储：写臂回执链', () => {
  it('写入按归一值调用网关，回执后经快照重读更新投影（回执驱动，不本地拼装）', async () => {
    const gateway = createGatewayStub({});
    const store = createConfigSettingsStore(gateway);
    await store.load();
    const snapshot = await store.write('platform.appearance.density', 'compact');
    expect(gateway.written).toEqual([{ key: 'appearance.density', value: 'compact' }]);
    expect(gateway.snapshotCalls).toBe(2);
    expect(valueOf(snapshot, 'platform.appearance.density')).toBe('compact');
    expect(snapshot.layers?.['platform.appearance.density']).toBe('user');
  });

  it('写入前归一：整数越界收敛为下界后才出网关', async () => {
    const gateway = createGatewayStub({});
    const store = createConfigSettingsStore(gateway);
    await store.write('platform.window.defaultWidth', 100);
    expect(gateway.written).toEqual([{ key: 'window.defaultWidth', value: 640 }]);
  });

  it('未登记键直接拒绝，不出网关（注册表守卫）', async () => {
    const gateway = createGatewayStub({});
    const store = createConfigSettingsStore(gateway);
    await expect(store.write('plugins.other.key', 'x')).rejects.toThrow('未登记的配置键');
    expect(gateway.written).toHaveLength(0);
    expect(gateway.snapshotCalls).toBe(0);
  });

  it('写臂失败时错误码原样传播，投影不前移（不再重读快照）', async () => {
    const gateway = createGatewayStub({
      writeError: new SettingsConfigError('CONFIG_WRITE_FAILED', '落盘失败'),
    });
    const store = createConfigSettingsStore(gateway);
    await store.load();
    await expect(store.write('platform.behavior.notifications', false)).rejects.toMatchObject({
      code: 'CONFIG_WRITE_FAILED',
    });
    expect(gateway.snapshotCalls).toBe(1);
  });
});

describe('配置域偏好存储：恢复默认臂', () => {
  it('单项恢复默认经 config:reset 回执后重读投影为默认值层', async () => {
    const gateway = createGatewayStub({ snapshotTable: { 'platform.appearance.density': 'compact' } });
    const store = createConfigSettingsStore(gateway);
    await store.load();
    const snapshot = await store.reset('platform.appearance.density');
    expect(gateway.resetCalls).toEqual([['appearance.density']]);
    expect(valueOf(snapshot, 'platform.appearance.density')).toBe('comfortable');
    expect(snapshot.layers?.['platform.appearance.density']).toBe('default');
  });

  it('分组恢复默认一次调用提交全部键（§7.11 keys 数组，注册表顺序）', async () => {
    const gateway = createGatewayStub({
      snapshotTable: { 'platform.appearance.density': 'compact', 'platform.window.defaultWidth': 1920 },
    });
    const store = createConfigSettingsStore(gateway);
    await store.load();
    const snapshot = await store.resetKeys([
      'platform.appearance.density',
      'platform.window.defaultWidth',
    ]);
    expect(gateway.resetCalls).toEqual([['appearance.density', 'window.defaultWidth']]);
    expect(valueOf(snapshot, 'platform.appearance.density')).toBe('comfortable');
    expect(valueOf(snapshot, 'platform.window.defaultWidth')).toBe(1200);
    expect(snapshot.layer).toBe('default');
  });

  it('恢复默认失败时错误码原样传播，投影不前移', async () => {
    const gateway = createGatewayStub({
      snapshotTable: { 'platform.log.level': 'debug' },
      resetError: new SettingsConfigError('CONFIG_POLICY_LOCKED', '策略键不可覆盖'),
    });
    const store = createConfigSettingsStore(gateway);
    await store.load();
    await expect(store.reset('platform.log.level')).rejects.toMatchObject({
      code: 'CONFIG_POLICY_LOCKED',
    });
    expect(valueOf(await store.load(), 'platform.log.level')).toBe('debug');
  });
});

describe('配置域偏好存储：config:changed 订阅投影（§8.2/§8.4）', () => {
  it('注册表内平台键变更按归一生效值更新投影并标记用户层', async () => {
    const gateway = createGatewayStub({});
    const store = createConfigSettingsStore(gateway);
    await store.load();
    const seen: SettingsSnapshot[] = [];
    store.subscribe((snapshot) => seen.push(snapshot));
    gateway.emitChange({
      key: 'platform.appearance.density',
      layer: 'user',
      value: 'compact',
      effectiveValue: 'compact',
      isDefault: false,
      origin: 'plugin:chips.official.other',
    });
    expect(seen).toHaveLength(1);
    expect(valueOf(seen[0], 'platform.appearance.density')).toBe('compact');
    expect(layerOf(seen[0], 'platform.appearance.density')).toBe('user');
  });

  it('默认值回填与覆盖移除事件投影为默认值层', async () => {
    const gateway = createGatewayStub({ snapshotTable: { 'platform.log.level': 'debug' } });
    const store = createConfigSettingsStore(gateway);
    await store.load();
    const seen: SettingsSnapshot[] = [];
    store.subscribe((snapshot) => seen.push(snapshot));
    gateway.emitChange({
      key: 'platform.log.level',
      layer: 'user',
      value: null,
      effectiveValue: 'info',
      isDefault: false,
      origin: 'external',
    });
    gateway.emitChange({
      key: 'platform.behavior.notifications',
      layer: 'platform',
      value: false,
      effectiveValue: false,
      isDefault: true,
      origin: 'platform',
    });
    expect(seen).toHaveLength(2);
    expect(valueOf(seen[0], 'platform.log.level')).toBe('info');
    expect(layerOf(seen[0], 'platform.log.level')).toBe('default');
    expect(valueOf(seen[1], 'platform.behavior.notifications')).toBe(false);
    expect(layerOf(seen[1], 'platform.behavior.notifications')).toBe('default');
  });

  it('注册表外与非 platform 键的变更不进入投影', async () => {
    const gateway = createGatewayStub({});
    const store = createConfigSettingsStore(gateway);
    await store.load();
    const seen: SettingsSnapshot[] = [];
    store.subscribe((snapshot) => seen.push(snapshot));
    gateway.emitChange({
      key: 'platform.unknown.key',
      layer: 'user',
      value: 1,
      effectiveValue: 1,
      isDefault: false,
      origin: 'platform',
    });
    gateway.emitChange({
      key: 'plugins.chips.official.notes.bootstrapped',
      layer: 'plugin',
      value: true,
      effectiveValue: true,
      isDefault: false,
      origin: 'plugin:chips.official.notes',
    });
    expect(seen).toHaveLength(0);
  });

  it('订阅句柄 dispose 透传网关（挂载/卸载对称）', () => {
    const gateway = createGatewayStub({});
    const store = createConfigSettingsStore(gateway);
    const subscription = store.subscribe(vi.fn());
    subscription.dispose();
    expect(gateway.disposes).toHaveLength(1);
  });
});
