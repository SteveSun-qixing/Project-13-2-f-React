import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AppView from '../src/ui/AppView';

/**
 * 应用壳挂载测试：jsdom 真实挂载 AppView（ChipsProvider + CommandProvider + App）。
 *
 * 宿主缺位契约：`window.chips` 缺失或能力未注册时，界面收敛为行内简体中文提示，
 * 不伪造成功；`document:*` 宿主真实现（工单036 波 C3）以受控替身锁定
 * 「按来源打开 → 入列 → 条目呈现」只读消费链。
 */

type ChipsBridgeStub = {
  request: (capabilityId: string, input?: unknown) => Promise<unknown>;
  subscribe: (eventId: string, handler: (payload: unknown) => void) => { dispose(): void };
  resource: (uri: string) => unknown;
};

function boxReadResponder(_capabilityId: string, input?: unknown): Promise<unknown> {
  const record = (input ?? {}) as { documentId?: string; part?: string };
  if (record.part === 'metadata') {
    return Promise.resolve({
      part: 'metadata',
      value: {
        box_id: record.documentId,
        name: '素材箱',
        created_at: '2026-10-01T08:00:00Z',
        modified_at: '2026-10-01T09:00:00Z',
        active_layout_type: 'chips.layout.grid',
        tags: [['作者', '薯片']],
      },
      diagnostics: [],
    });
  }
  return Promise.resolve({
    part: 'entries',
    value: [
      { entry_id: 'entry000002', url: '.box/content/第二.card', enabled: true },
      { entry_id: 'entry000001', url: '.box/content/第一.card', enabled: false },
    ],
    diagnostics: [],
  });
}

function installChips(overrides: { openError?: { code: string } } = {}): void {
  const bridge: ChipsBridgeStub = {
    request: vi.fn((capabilityId: string, input?: unknown): Promise<unknown> => {
      if (capabilityId === 'command:register' || capabilityId === 'command:unregister') {
        return Promise.resolve({});
      }
      if (capabilityId === 'document:open') {
        if (overrides.openError !== undefined) {
          return Promise.reject(Object.assign(new Error('来源不可达'), overrides.openError));
        }
        return Promise.resolve({
          documentId: 'box-77',
          source: 'chips-resource://ws/demo/素材.box',
          kind: 'box',
          title: '素材箱',
          digest: 'quick-digest',
        });
      }
      if (capabilityId === 'document:read') {
        return boxReadResponder(capabilityId, input);
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

function inputSource(value: string): void {
  fireEvent.change(screen.getByPlaceholderText(/粘贴卡片或箱子来源引用/), {
    target: { value },
  });
  // antd 会在两字按钮文案间插入空格（「打 开」），名称匹配按空白容错。
  fireEvent.click(screen.getByRole('button', { name: /打\s*开/ }));
}

describe('AppView（资源管理器壳）', () => {
  it('宿主缺位时呈现未就绪与空态，不伪造目录树与条目', async () => {
    render(<AppView />);
    expect(screen.getByText('快速访问')).toBeTruthy();
    expect(screen.getByText('工作区根')).toBeTruthy();
    expect(screen.getByText('未就绪')).toBeTruthy();
    expect(screen.getByText(/filesystem:read:/)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('尚未打开文档')).toBeTruthy();
    });
    expect(screen.getByText('按来源引用打开卡片或箱子后在此呈现条目')).toBeTruthy();
  });

  it('打开臂：输入来源引用经 document:open 入列并呈现箱子条目（启用的条目前置）', async () => {
    installChips();
    render(<AppView />);

    inputSource('chips-resource://ws/demo/素材.box');

    await waitFor(() => {
      expect(screen.getByText('素材箱')).toBeTruthy();
    });
    expect(screen.getByText('第二.card')).toBeTruthy();
    expect(screen.getByText('作者：薯片')).toBeTruthy();
    expect(screen.getByText('启用')).toBeTruthy();
    expect(screen.getByText('停用')).toBeTruthy();
  });

  it('打开失败时行内简体中文反馈携带错误码，不伪造成功', async () => {
    installChips({ openError: { code: 'RESOURCE_NOT_FOUND' } });
    render(<AppView />);

    inputSource('~/缺失.box');

    await waitFor(() => {
      expect(screen.getByText(/文档打开失败（RESOURCE_NOT_FOUND）/)).toBeTruthy();
    });
  });
});
