import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AppView from '../src/ui/AppView';

/**
 * 应用壳挂载测试：jsdom 真实挂载 AppView（ChipsProvider + CommandProvider + antd App）。
 *
 * 宿主缺位契约：`window.chips` 缺失或能力未注册时，界面收敛为行内简体中文提示
 * （命令通道异常 / 资源打开路由不可用），不伪造成功。
 */

type ChipsBridgeStub = {
  request: (capabilityId: string, input?: unknown) => Promise<unknown>;
  subscribe: (eventId: string, handler: (payload: unknown) => void) => { dispose(): void };
  resource: (uri: string) => unknown;
};

function installChips(overrides: Partial<ChipsBridgeStub> = {}): void {
  (globalThis as { chips?: unknown }).chips = {
    request: vi.fn((capabilityId: string): Promise<unknown> => {
      if (capabilityId === 'command:register' || capabilityId === 'command:unregister') {
        return Promise.resolve({});
      }
      return Promise.reject(
        Object.assign(new Error(`能力未注册：${capabilityId}`), {
          code: 'BRIDGE_CAPABILITY_NOT_FOUND',
        })
      );
    }),
    subscribe: vi.fn(() => ({ dispose: (): void => undefined })),
    resource: vi.fn(() => {
      throw Object.assign(new Error('资源通道不可用'), { code: 'SDK_BRIDGE_UNAVAILABLE' });
    }),
    ...overrides,
  };
}

beforeEach(() => {
  delete (globalThis as { chips?: unknown }).chips;
});

afterEach(() => {
  cleanup();
  delete (globalThis as { chips?: unknown }).chips;
});

describe('AppView（书籍阅读器壳）', () => {
  it('宿主缺位时呈现空态与行内简体中文引导，不伪造成功', async () => {
    render(<AppView />);

    expect(screen.getByText('尚未打开书籍')).toBeTruthy();
    expect(screen.getByRole('button', { name: '打开书籍' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
    });
    const status = screen
      .getAllByRole('status')
      .map((node) => node.textContent ?? '')
      .join('\n');
    expect(status).toContain('命令通道异常');
  });

  it('发起臂：粘贴资源引用后经 resource:open 正式面请求；宿主路由未就绪时行内报错', async () => {
    const requestSpy = vi.fn((capabilityId: string, _input?: unknown): Promise<unknown> => {
      if (capabilityId === 'command:register' || capabilityId === 'command:unregister') {
        return Promise.resolve({});
      }
      return Promise.reject(
        Object.assign(new Error('处理器缺位'), { code: 'BRIDGE_CAPABILITY_NOT_FOUND' })
      );
    });
    installChips({ request: requestSpy });

    render(<AppView />);

    const input = screen.getByLabelText('书籍资源受管引用');
    fireEvent.change(input, { target: { value: 'chips-resource://temp-1/sea.epub' } });
    fireEvent.click(screen.getByRole('button', { name: '通过资源路由打开' }));

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('alert')
          .some((node) => (node.textContent ?? '').includes('资源打开路由不可用'))
      ).toBe(true);
    });
    const openCalls = requestSpy.mock.calls.filter(
      ([capabilityId]) => capabilityId === 'resource:open'
    );
    expect(openCalls).toHaveLength(1);
    expect(openCalls[0]?.[1]).toEqual({
      intent: 'view',
      resource: { uri: 'chips-resource://temp-1/sea.epub', title: 'sea.epub' },
    });
  });

  it('命令就绪时窗口呈现阅读器壳且命令注册走正式面', async () => {
    const requestSpy = vi.fn((capabilityId: string): Promise<unknown> => {
      if (capabilityId === 'command:register' || capabilityId === 'command:unregister') {
        return Promise.resolve({});
      }
      return Promise.reject(
        Object.assign(new Error('能力未注册'), { code: 'BRIDGE_CAPABILITY_NOT_FOUND' })
      );
    });
    installChips({ request: requestSpy });

    render(<AppView />);

    await waitFor(() => {
      expect(
        requestSpy.mock.calls.filter(([capabilityId]) => capabilityId === 'command:register').length
      ).toBeGreaterThan(0);
    });
    expect(screen.getByText('尚未打开书籍')).toBeTruthy();
  });
});
