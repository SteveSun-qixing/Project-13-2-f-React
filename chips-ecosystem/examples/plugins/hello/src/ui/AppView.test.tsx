import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CapabilityInput, CapabilityOutput } from '@chips/sdk';
import { ChipsError } from '@chips/sdk';
import { installMockBridge, uninstallMockBridge } from '@chips/sdk/testing';
import { AppView } from './AppView';

/** 插件 ID 与配置键，与 manifest.yaml、assets/schemas/config.schema.json 一致。 */
const NAMESPACE = 'plugins.chips.example.hello';
const GREETING_KEY = 'greeting';
const GREETING_FULL_KEY = `${NAMESPACE}.${GREETING_KEY}`;
const DEFAULT_GREETING = '你好，世界！';

const bridge = installMockBridge();

afterEach(() => {
  bridge.reset();
});

afterAll(() => {
  uninstallMockBridge();
});

/** 注册 `config:get` 桩；断言请求携带自身命名空间与相对键。 */
const stubGreeting = (value: unknown): void => {
  bridge.handle<CapabilityInput<'config:get'>, CapabilityOutput<'config:get'>>(
    'config:get',
    (input) => {
      expect(input).toEqual({ namespace: NAMESPACE, key: GREETING_KEY });
      return { key: GREETING_FULL_KEY, value, layer: 'plugin', isDefault: false };
    }
  );
};

/** 注册 `clipboard:write` 成功桩。 */
const stubClipboardWrite = (): void => {
  bridge.handle<CapabilityInput<'clipboard:write'>, CapabilityOutput<'clipboard:write'>>(
    'clipboard:write',
    () => undefined
  );
};

describe('AppView', () => {
  it('读取自身配置并渲染问候语', async () => {
    stubGreeting('早上好！');

    render(<AppView />);

    expect(await screen.findByText('早上好！')).toBeInTheDocument();
    expect(bridge.calls[0]?.capabilityId).toBe('config:get');
  });

  it('配置无有效值时显示默认问候语', async () => {
    stubGreeting(undefined);

    render(<AppView />);

    expect(await screen.findByText(DEFAULT_GREETING)).toBeInTheDocument();
  });

  it('配置读取失败时显示空态', async () => {
    bridge.handle('config:get', () => {
      throw new ChipsError({
        code: 'BRIDGE_PERMISSION_DENIED',
        message: '缺少配置读取权限',
        retryable: false,
      });
    });

    render(<AppView />);

    expect(await screen.findByText('读取应用配置失败')).toBeInTheDocument();
  });

  it('点击计数按钮累加次数', async () => {
    stubGreeting(DEFAULT_GREETING);

    render(<AppView />);

    const button = await screen.findByRole('button', { name: '点击次数：0' });
    fireEvent.click(button);

    expect(screen.getByRole('button', { name: '点击次数：1' })).toBeInTheDocument();
  });

  it('复制问候语经剪贴板能力写出并提示成功', async () => {
    stubGreeting('复制我');
    stubClipboardWrite();

    render(<AppView />);

    fireEvent.click(await screen.findByRole('button', { name: '复制问候语' }));

    expect(await screen.findByText('问候语已复制到剪贴板')).toBeInTheDocument();
    expect(bridge.calls).toContainEqual({
      capabilityId: 'clipboard:write',
      input: { text: '复制我' },
    });
  });

  it('剪贴板能力被拒绝时提示失败原因', async () => {
    stubGreeting(DEFAULT_GREETING);
    bridge.handle('clipboard:write', () => {
      throw new ChipsError({
        code: 'BRIDGE_PERMISSION_DENIED',
        message: '缺少剪贴板权限',
        retryable: false,
      });
    });

    render(<AppView />);

    fireEvent.click(await screen.findByRole('button', { name: '复制问候语' }));

    expect(await screen.findByText('复制失败，请检查剪贴板权限')).toBeInTheDocument();
  });

  it('收到 config:changed 事件后刷新问候语', async () => {
    stubGreeting(DEFAULT_GREETING);

    render(<AppView />);
    await screen.findByText(DEFAULT_GREETING);

    bridge.emit('config:changed', {
      key: GREETING_FULL_KEY,
      layer: 'user',
      value: '新问候',
      effectiveValue: '新问候',
      isDefault: false,
      origin: 'plugin:test',
    });

    expect(await screen.findByText('新问候')).toBeInTheDocument();
  });

  it('卸载时退订 config:changed', async () => {
    stubGreeting(DEFAULT_GREETING);
    const { unmount } = render(<AppView />);
    await screen.findByText(DEFAULT_GREETING);
    expect(bridge.subscriptionCount('config:changed')).toBe(1);

    unmount();

    expect(bridge.subscriptionCount('config:changed')).toBe(0);
  });
});
