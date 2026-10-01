import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AppView from '../src/ui/AppView';

/**
 * 应用壳挂载测试：jsdom 真实挂载 AppView（ChipsProvider + CommandProvider + App）。
 *
 * 宿主缺位契约：`window.chips` 缺失或能力未注册时，界面收敛为行内简体中文提示
 * （命令通道异常 / 打开失败反馈），不伪造成功；`document:*` 宿主真实现（工单036 波 C3）
 * 以受控替身锁定「打开 → 入库 → 装配」消费链。
 */

type ChipsBridgeStub = {
  request: (capabilityId: string, input?: unknown) => Promise<unknown>;
  subscribe: (eventId: string, handler: (payload: unknown) => void) => { dispose(): void };
  resource: (uri: string) => unknown;
};

function documentReadResponder(_capabilityId: string, input?: unknown): Promise<unknown> {
  const record = (input ?? {}) as { documentId?: string; part?: string };
  if (record.part === 'metadata') {
    return Promise.resolve({
      part: 'metadata',
      value: {
        card_id: record.documentId,
        name: '示例笔记',
        created_at: '2026-10-01T08:00:00Z',
        modified_at: '2026-10-01T09:00:00Z',
        tags: ['随笔'],
      },
      diagnostics: [],
    });
  }
  return Promise.resolve({
    part: 'structure',
    value: {
      structure: [{ id: 'node000001', type: 'richtext' }],
      manifest: { card_count: 1, resource_count: 0 },
    },
    diagnostics: [],
  });
}

function installChips(overrides: {
  openOutput?: unknown;
  openError?: { code: string };
  readResponder?: (capabilityId: string, input?: unknown) => Promise<unknown>;
}): void {
  const bridge: ChipsBridgeStub = {
    request: vi.fn((capabilityId: string, input?: unknown): Promise<unknown> => {
      if (capabilityId === 'command:register' || capabilityId === 'command:unregister') {
        return Promise.resolve({});
      }
      if (capabilityId === 'document:open') {
        if (overrides.openError !== undefined) {
          return Promise.reject(Object.assign(new Error('文档不可用'), overrides.openError));
        }
        return Promise.resolve(
          overrides.openOutput ?? {
            documentId: 'card-001',
            source: 'chips-resource://ws/demo/note.card',
            kind: 'card',
            title: '示例笔记',
            digest: 'quick-digest',
          },
        );
      }
      if (capabilityId === 'document:read') {
        return (overrides.readResponder ?? documentReadResponder)(capabilityId, input);
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

describe('AppView（笔记壳）', () => {
  it('宿主命令通道缺位时呈现空态与命令通道异常提示，不伪造成功', async () => {
    render(<AppView />);
    expect(screen.getByText('笔记库')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText(/命令通道异常/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText('笔记库为空：粘贴文档来源引用打开笔记本或笔记')).toBeTruthy();
    expect(screen.getByText('尚未选中笔记文档：从左侧列表选择，或粘贴来源引用打开')).toBeTruthy();
  });

  it('打开臂：输入来源引用经 document:open 入库并装配卡片大纲', async () => {
    installChips({});
    render(<AppView />);

    inputSource('chips-resource://ws/demo/note.card');

    await waitFor(() => {
      expect(screen.getByText('笔记（卡片文档）')).toBeTruthy();
    });
    // 列表项与编辑区标题各呈现一次文档名。
    expect(screen.getAllByText('示例笔记').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('内容节点（1 个）')).toBeTruthy();
    expect(screen.getByText('随笔')).toBeTruthy();
  });

  it('打开失败时行内简体中文反馈携带错误码，不伪造成功', async () => {
    installChips({ openError: { code: 'DOCUMENT_FORMAT_UNKNOWN' } });
    render(<AppView />);

    inputSource('~/损坏.card');

    await waitFor(() => {
      expect(screen.getByText(/文档打开失败（DOCUMENT_FORMAT_UNKNOWN）/)).toBeTruthy();
    });
  });
});
