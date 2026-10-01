import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIG_NAMESPACE,
  createIsolatedConfigGateway,
  SettingsConfigError,
  toRelativeKey,
} from '../src/domain/settings/configGateway';

/**
 * 配置域消费面契约测试：以受控 Bridge 替身锁定 `config:snapshot` / `config:set` /
 * `config:reset` 的调用形状（能力 ID、`platform` 命名空间、相对键映射、user 写入层）
 * 与 `config:changed` 订阅面，及错误码原样归一传播（不吞错、不匹配错误文本）。
 *
 * 契约权威：《04-能力契约规范》§7.11；订阅载荷《05-事件契约规范》§4.5；
 * 消费映射《05-生态设置面板设计》§8.1/§8.2/§8.6。
 */

type RequestSpy = (capabilityId: string, input?: unknown) => Promise<unknown>;

type SubscribeSpy = (eventId: string, handler: (payload: unknown) => void) => { dispose(): void };

function installChips(overrides: { request?: RequestSpy; subscribe?: SubscribeSpy } = {}): void {
  (globalThis as { chips?: unknown }).chips = {
    request: overrides.request ?? vi.fn((): Promise<unknown> => Promise.resolve({ values: {} })),
    subscribe: overrides.subscribe ?? vi.fn((): { dispose(): void } => ({ dispose: (): void => undefined })),
    resource: vi.fn((): unknown => {
      throw Object.assign(new Error('资源通道不可用'), { code: 'SDK_BRIDGE_UNAVAILABLE' });
    }),
  };
}

function removeChips(): void {
  delete (globalThis as { chips?: unknown }).chips;
}

beforeEach(() => {
  removeChips();
});

afterEach(() => {
  removeChips();
});

describe('platform 命名空间与键位映射', () => {
  it('命名空间常量为 platform（§7.11/§8.6：偏好写入平台命名空间）', () => {
    expect(CONFIG_NAMESPACE).toBe('platform');
  });

  it('完整配置键剥出命名空间前缀得相对键；跨命名空间键如实拒绝', () => {
    expect(toRelativeKey('platform.appearance.density')).toBe('appearance.density');
    expect(toRelativeKey('platform.log.level')).toBe('log.level');
    expect(() => toRelativeKey('plugins.chips.official.settings.bootstrapped')).toThrow(SettingsConfigError);
    try {
      toRelativeKey('plugins.chips.official.settings.bootstrapped');
    } catch (error: unknown) {
      expect((error as SettingsConfigError).code).toBe('SETTINGS_KEY_OUT_OF_NAMESPACE');
    }
  });
});

describe('config:snapshot 消费（读初值）', () => {
  it('按 { namespace: platform, prefix: 空 } 形状调用并回传生效视图', async () => {
    const request = vi.fn<RequestSpy>(() =>
      Promise.resolve({ values: { 'platform.appearance.density': 'compact' } }),
    );
    installChips({ request });
    const values = await createIsolatedConfigGateway().loadPlatformSnapshot();
    expect(request).toHaveBeenCalledWith('config:snapshot', { namespace: 'platform', prefix: '' });
    expect(values).toEqual({ 'platform.appearance.density': 'compact' });
  });

  it('回包缺 values 记录时拒绝（SETTINGS_SNAPSHOT_RECEIPT_INVALID，不白信通道）', async () => {
    installChips({ request: () => Promise.resolve({}) });
    await expect(createIsolatedConfigGateway().loadPlatformSnapshot()).rejects.toMatchObject({
      code: 'SETTINGS_SNAPSHOT_RECEIPT_INVALID',
    });
    installChips({ request: () => Promise.resolve({ values: '不是记录' }) });
    await expect(createIsolatedConfigGateway().loadPlatformSnapshot()).rejects.toMatchObject({
      code: 'SETTINGS_SNAPSHOT_RECEIPT_INVALID',
    });
  });
});

describe('config:set / config:reset 消费（写臂）', () => {
  it('写入按 { namespace, key, value, scope: user } 形状调用（相对键 + 用户层）', async () => {
    const request = vi.fn<RequestSpy>(() => Promise.resolve(undefined));
    installChips({ request });
    await createIsolatedConfigGateway().writePlatformValue('appearance.density', 'compact');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('config:set', {
      namespace: 'platform',
      key: 'appearance.density',
      value: 'compact',
      scope: 'user',
    });
  });

  it('恢复默认按 { namespace, keys, scope: user } 形状一次调用（§7.11 keys 数组）', async () => {
    const request = vi.fn<RequestSpy>(() => Promise.resolve(undefined));
    installChips({ request });
    await createIsolatedConfigGateway().resetPlatformKeys(['appearance.density', 'window.defaultWidth']);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('config:reset', {
      namespace: 'platform',
      keys: ['appearance.density', 'window.defaultWidth'],
      scope: 'user',
    });
  });

  it('配置域错误码原样归一传播，不吞错、不改写', async () => {
    installChips({
      request: () =>
        Promise.reject(Object.assign(new Error('落盘失败'), { code: 'CONFIG_WRITE_FAILED' })),
    });
    await expect(createIsolatedConfigGateway().writePlatformValue('appearance.density', 'compact')).rejects.toMatchObject(
      { code: 'CONFIG_WRITE_FAILED' },
    );
    installChips({
      request: () =>
        Promise.reject(Object.assign(new Error('策略键不可覆盖'), { code: 'CONFIG_POLICY_LOCKED' })),
    });
    await expect(createIsolatedConfigGateway().resetPlatformKeys(['log.level'])).rejects.toMatchObject({
      code: 'CONFIG_POLICY_LOCKED',
    });
  });

  it('无错误码抛出值兜底归一为 SETTINGS_GATEWAY_ERROR；SettingsConfigError 原样透传', async () => {
    installChips({ request: () => Promise.reject(new Error('通道中断')) });
    await expect(createIsolatedConfigGateway().writePlatformValue('log.level', 'debug')).rejects.toMatchObject({
      code: 'SETTINGS_GATEWAY_ERROR',
    });
    installChips({
      request: () => Promise.reject(new SettingsConfigError('CONFIG_VALUE_INVALID', '取值不符合约束')),
    });
    await expect(createIsolatedConfigGateway().writePlatformValue('log.level', 'debug')).rejects.toMatchObject({
      code: 'CONFIG_VALUE_INVALID',
    });
  });
});

describe('config:changed 订阅面（§8.2/§8.4，多窗口一致性）', () => {
  it('经 chips.subscribe 订阅 config:changed 并转发载荷；dispose 透传', () => {
    const dispose = vi.fn();
    let captured: ((payload: unknown) => void) | null = null;
    installChips({
      subscribe: vi.fn((eventId: string, handler: (payload: unknown) => void): { dispose(): void } => {
        expect(eventId).toBe('config:changed');
        captured = handler;
        return { dispose };
      }),
    });
    const gateway = createIsolatedConfigGateway();
    const handler = vi.fn();
    const subscription = gateway.subscribePlatformChanges(handler);
    expect(captured).not.toBeNull();
    const payload = {
      key: 'platform.appearance.density',
      layer: 'user',
      value: 'compact',
      effectiveValue: 'compact',
      isDefault: false,
      origin: 'plugin:chips.official.other',
    };
    captured!(payload);
    expect(handler).toHaveBeenCalledWith(payload);
    subscription.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('重复 dispose 幂等（不重复调用底层退订）', () => {
    const dispose = vi.fn();
    installChips({
      subscribe: vi.fn((): { dispose(): void } => ({ dispose })),
    });
    const subscription = createIsolatedConfigGateway().subscribePlatformChanges(vi.fn());
    subscription.dispose();
    subscription.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
