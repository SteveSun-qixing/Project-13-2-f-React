import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AppView from '../src/ui/AppView';

/**
 * 应用壳挂载测试：jsdom 真实挂载 AppView（ChipsProvider + CommandProvider + App）。
 *
 * 宿主缺位契约：`window.chips` 缺失或能力未注册时，界面收敛为行内简体中文提示
 * （命令通道异常），不伪造成功；偏好读写按诚实降级口径在会话内存内真实生效。
 */

type ChipsBridgeStub = {
  request: (capabilityId: string, input?: unknown) => Promise<unknown>;
  subscribe: (eventId: string, handler: (payload: unknown) => void) => { dispose(): void };
  resource: (uri: string) => unknown;
};

function installChips(): void {
  const bridge: ChipsBridgeStub = {
    request: vi.fn((capabilityId: string): Promise<unknown> => {
      if (capabilityId === 'command:register' || capabilityId === 'command:unregister') {
        return Promise.resolve({});
      }
      return Promise.reject(
        Object.assign(new Error(`能力未注册：${capabilityId}`), { code: 'BRIDGE_CAPABILITY_NOT_FOUND' }),
      );
    }),
    subscribe: vi.fn(() => ({ dispose: (): void => undefined })),
    resource: vi.fn(() => {
      throw Object.assign(new Error('资源通道不可用'), { code: 'SDK_BRIDGE_UNAVAILABLE' });
    }),
  };
  (globalThis as { chips?: unknown }).chips = bridge;
}

beforeEach(() => {
  delete (globalThis as { chips?: unknown }).chips;
});

afterEach(() => {
  cleanup();
  delete (globalThis as { chips?: unknown }).chips;
});

describe('AppView（生态设置面板壳）', () => {
  it('九类导航按注册表顺序呈现，缺省落在「外观」页', () => {
    render(<AppView />);
    // 活动分类标题会同时出现在导航行与页头，按「至少一处」断言。
    const navTexts = [
      '外观',
      '行为',
      '工作区',
      '插件治理',
      '权限',
      '快捷键',
      '文件打开方式',
      '存储缓存',
      '关于更新',
    ];
    for (const text of navTexts) {
      expect(screen.getAllByText(text).length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getByText('界面密度')).toBeTruthy();
    expect(screen.getAllByText(/生效层：会话内存（未持久化，工单066）/).length).toBeGreaterThanOrEqual(1);
  });

  it('偏好项即时生效：切换系统通知开关写回存储并给出浮层反馈', async () => {
    render(<AppView />);
    fireEvent.click(screen.getByText('行为'));
    const toggle = screen.getByRole('switch', { name: '系统通知' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.getByText(/「系统通知」已更新/)).toBeTruthy();
    });
    expect(screen.getByRole('switch', { name: '系统通知' }).getAttribute('aria-checked')).toBe('false');
  });

  it('域依赖分类页呈现依赖域与工单066 去向，不铺设替代控件', async () => {
    render(<AppView />);
    fireEvent.click(screen.getByText('工作区'));
    await waitFor(() => {
      expect(screen.getByText('依赖域缺位说明')).toBeTruthy();
    });
    expect(screen.getByText(/config:get 域缺位已在册工单066/)).toBeTruthy();
    expect(screen.getByText('暂无可呈现数据')).toBeTruthy();
  });

  it('宿主命令通道缺位时收敛为命令通道异常状态行，界面照常工作', async () => {
    render(<AppView />);
    await waitFor(() => {
      expect(screen.getByText(/命令通道异常/)).toBeTruthy();
    });
    expect(screen.getByText('界面密度')).toBeTruthy();
  });

  it('命令通道就绪时状态行翻正为「命令已就绪」，偏好照常读写', async () => {
    installChips();
    render(<AppView />);
    await waitFor(() => {
      expect(screen.getByText('命令注册状态：命令已就绪')).toBeTruthy();
    });
    expect(screen.getByText('界面密度')).toBeTruthy();
  });
});
