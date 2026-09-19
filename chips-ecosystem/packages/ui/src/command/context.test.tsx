import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChipsProvider } from '../theme';
import { CommandProvider, useCommandRuntime, useCommandViews } from './context';
import type { ICommandViewsState } from './context';
import { createMockBridge, makeCommandView } from '../../tests/helpers/harness';

const globalWithChips = globalThis as { chips?: unknown };

afterEach(() => {
  delete globalWithChips.chips;
});

const Probe: React.FC<{ readonly onState?: (state: ICommandViewsState) => void }> = ({
  onState,
}) => {
  const state = useCommandViews();
  onState?.(state);
  return <span data-testid="view-count">{state.views.length}</span>;
};

const DisabledProbe: React.FC = () => {
  const state = useCommandViews({ enabled: false });
  return <span data-testid="loading">{String(state.loading)}</span>;
};

const ErrorProbe: React.FC = () => {
  const state = useCommandViews();
  return <span data-testid="error-message">{state.error?.message ?? ''}</span>;
};

describe('useCommandRuntime / useCommandViews', () => {
  it('未挂载 CommandProvider 时抛出简体中文错误', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow('useCommandRuntime 必须在 CommandProvider 内使用。');
    spy.mockRestore();
  });

  it('加载完成后给出视图列表', async () => {
    const bridge = createMockBridge();
    const view = makeCommandView({ definition: { id: 'app:open', title: '打开卡片' } });
    bridge.handle('command:list', () => ({ views: [view] }));

    render(
      <ChipsProvider appId="chips.test.app" surface="window">
        <CommandProvider port={bridge.port}>
          <Probe />
        </CommandProvider>
      </ChipsProvider>
    );

    expect(screen.getByTestId('view-count').textContent).toBe('0');
    await waitFor(() => {
      expect(screen.getByTestId('view-count').textContent).toBe('1');
    });
  });

  it('enabled=false 时不发起查询', () => {
    const bridge = createMockBridge();
    render(
      <ChipsProvider appId="chips.test.app" surface="window">
        <CommandProvider port={bridge.port}>
          <DisabledProbe />
        </CommandProvider>
      </ChipsProvider>
    );
    expect(bridge.calls).toHaveLength(0);
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('查询失败给出结构兼容的失败信息，reload 可重试成功', async () => {
    const bridge = createMockBridge();
    let shouldFail = true;
    bridge.handle('command:list', () => {
      if (shouldFail) {
        throw Object.assign(new Error('读取命令列表失败'), { code: 'BRIDGE_TIMEOUT' });
      }
      return { views: [makeCommandView({ definition: { id: 'app:open', title: '打开' } })] };
    });
    const states: ICommandViewsState[] = [];

    render(
      <ChipsProvider appId="chips.test.app" surface="window">
        <CommandProvider port={bridge.port}>
          <Probe
            onState={(state) => {
              states.push(state);
            }}
          />
        </CommandProvider>
      </ChipsProvider>
    );

    await waitFor(() => {
      expect(states.at(-1)?.error).toEqual({
        code: 'BRIDGE_TIMEOUT',
        message: '读取命令列表失败',
      });
    });

    shouldFail = false;
    act(() => {
      states.at(-1)?.reload();
    });
    await waitFor(() => {
      expect(states.at(-1)?.views).toHaveLength(1);
    });
  });

  it('注册表变化与文档 / 窗口事件驱动重新查询', async () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({ views: [] }));

    render(
      <ChipsProvider appId="chips.test.app" surface="window">
        <CommandProvider port={bridge.port}>
          <Probe />
        </CommandProvider>
      </ChipsProvider>
    );

    await waitFor(() => {
      expect(bridge.calls).toHaveLength(1);
    });
    expect(bridge.subscribed).toEqual([
      'command:invoked',
      'command:registered',
      'command:unregistered',
      'command:changed',
      'document:opened',
      'document:closed',
      'window:focused',
    ]);

    act(() => {
      bridge.emit('command:registered', { commandId: 'app:open' });
      bridge.emit('document:opened', { uri: 'chips-resource://a.card', kind: 'card', title: 'A' });
      bridge.emit('window:focused', {});
    });
    await waitFor(() => {
      expect(bridge.calls.length).toBe(2);
    });
  });

  it('卸载后释放订阅，事件不再触发查询', async () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({ views: [] }));
    const { unmount } = render(
      <ChipsProvider appId="chips.test.app" surface="window">
        <CommandProvider port={bridge.port}>
          <Probe />
        </CommandProvider>
      </ChipsProvider>
    );
    await waitFor(() => {
      expect(bridge.calls).toHaveLength(1);
    });

    unmount();
    bridge.emit('command:registered', { commandId: 'app:open' });
    expect(bridge.calls).toHaveLength(1);
  });

  it('未注入 port 时从 window.chips 解析平台端口', async () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({
      views: [makeCommandView({ definition: { id: 'app:open', title: '打开' } })],
    }));
    globalWithChips.chips = bridge.port;

    render(
      <ChipsProvider appId="chips.test.app" surface="window">
        <CommandProvider>
          <Probe />
        </CommandProvider>
      </ChipsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('view-count').textContent).toBe('1');
    });
    expect(bridge.subscribed).toContain('command:invoked');
  });

  it('port 不可用时呈现简体中文失败信息', async () => {
    render(
      <ChipsProvider appId="chips.test.app" surface="window">
        <CommandProvider>
          <ErrorProbe />
        </CommandProvider>
      </ChipsProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('error-message').textContent).toBe(
        '命令运行时未连接到平台 Bridge：window.chips 不可用。'
      );
    });
  });
});

describe('useCommandRuntime', () => {
  it('返回窗口内单例运行时', () => {
    const bridge = createMockBridge();
    const runtimes: unknown[] = [];
    const Consumer: React.FC = () => {
      runtimes.push(useCommandRuntime());
      return null;
    };
    const { rerender } = render(
      <ChipsProvider appId="chips.test.app" surface="window">
        <CommandProvider port={bridge.port}>
          <Consumer />
        </CommandProvider>
      </ChipsProvider>
    );
    rerender(
      <ChipsProvider appId="chips.test.app" surface="window">
        <CommandProvider port={bridge.port}>
          <Consumer />
        </CommandProvider>
      </ChipsProvider>
    );
    expect(runtimes).toHaveLength(2);
    expect(runtimes[0]).toBe(runtimes[1]);
  });
});
