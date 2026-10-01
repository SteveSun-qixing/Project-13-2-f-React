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

/**
 * 写面舞台集成（假桥形制参照 photo-viewer）：以按已登记能力 ID 回放宿主语义的
 * 受控假桥（changeset 覆盖层 + revision 严格递增）驱动「编辑 → document:write →
 * 写后重读 → document:save」全链，断言 revision 回执驱动的 UI 状态与冲突/失败臂的
 * 行内简体中文提示（不吞错、不假成功）。
 */
interface WriteChainHarness {
  readonly requests: ReadonlyArray<{ id: string; input: unknown }>;
  writeError: { code: string } | null;
  saveError: { code: string } | null;
}

function installWriteChainChips(): WriteChainHarness {
  const requests: Array<{ id: string; input: unknown }> = [];
  const metadata: Record<string, unknown> = {
    chip_standards_version: '1.0.0',
    card_id: 'card-001',
    name: '示例笔记',
    created_at: '2026-10-01T08:00:00.000Z',
    modified_at: '2026-10-01T09:00:00.000Z',
    tags: ['随笔'],
  };
  const structure = {
    structure: [{ id: 'node000001', type: 'richtext' }],
    manifest: { card_count: 1, resource_count: 0 },
  };
  const contentOverlays = new Map<string, Record<string, unknown>>();
  let revision = 0;
  const harness: WriteChainHarness = {
    requests,
    writeError: null,
    saveError: null,
  };
  const bridge: ChipsBridgeStub = {
    request: vi.fn((capabilityId: string, input?: unknown): Promise<unknown> => {
      requests.push({ id: capabilityId, input });
      if (capabilityId === 'command:register' || capabilityId === 'command:unregister') {
        return Promise.resolve({});
      }
      if (capabilityId === 'document:open') {
        return Promise.resolve({
          documentId: 'card-001',
          source: 'chips-resource://ws/demo/note.card',
          kind: 'card',
          title: '示例笔记',
          digest: 'quick-digest',
        });
      }
      if (capabilityId === 'document:read') {
        const record = (input ?? {}) as { part?: string; nodeId?: string };
        if (record.part === 'metadata') {
          return Promise.resolve({ part: 'metadata', value: { ...metadata }, diagnostics: [] });
        }
        if (record.part === 'structure') {
          return Promise.resolve({ part: 'structure', value: structure, diagnostics: [] });
        }
        const overlay = contentOverlays.get(record.nodeId ?? '');
        return Promise.resolve({
          part: 'content',
          value:
            overlay ?? {
              node_id: record.nodeId,
              file: `content/${record.nodeId}.yaml`,
              card_type: 'base.richtext',
              value: { text: '初稿' },
              diagnostics: [],
            },
          diagnostics: [],
        });
      }
      if (capabilityId === 'document:write') {
        if (harness.writeError !== null) {
          return Promise.reject(Object.assign(new Error('写入被拒绝'), harness.writeError));
        }
        const record = (input ?? {}) as { part?: string; nodeId?: string; value?: Record<string, unknown> };
        if (record.part === 'metadata' && record.value !== undefined) {
          Object.assign(metadata, record.value);
        }
        if (record.part === 'content' && record.value !== undefined) {
          contentOverlays.set(record.nodeId ?? '', record.value);
        }
        revision += 1;
        return Promise.resolve({ revision });
      }
      if (capabilityId === 'document:save') {
        if (harness.saveError !== null) {
          return Promise.reject(Object.assign(new Error('保存未完成'), harness.saveError));
        }
        return Promise.resolve({ source: 'chips-resource://ws/demo/note.card', digest: 'saved-digest-001' });
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
  return harness;
}

async function openSampleNote(): Promise<void> {
  inputSource('chips-resource://ws/demo/note.card');
  await waitFor(() => {
    expect(screen.getByText('内容节点（1 个）')).toBeTruthy();
  });
}

/** 内容节点呈现面文本（data-role 定位；编辑框与呈现面并存时按呈现面断言）。 */
function nodeDisplayText(): string {
  return document.querySelector<HTMLElement>('[data-role="node-display"]')?.textContent ?? '';
}

describe('AppView 写面（编辑保存链 · 假桥舞台）', () => {
  beforeEach(() => {
    delete (globalThis as { chips?: unknown }).chips;
  });

  it('重命名链：document:write 携带完整元数据切片，写后重读投影，revision 回执驱动修订徽标与列表标题', async () => {
    const harness = installWriteChainChips();
    render(<AppView />);
    await openSampleNote();
    expect(screen.getByText('修订徽标：未写入')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('文档名称'), { target: { value: '会议记录' } });
    await waitFor(() => {
      expect(screen.getByText(/待提交修改：重命名/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '提交修改' }));

    await waitFor(() => {
      expect(screen.getByText('修订徽标：修订号 1')).toBeTruthy();
    });
    const write = harness.requests.find((call) => call.id === 'document:write');
    expect(write).toBeDefined();
    const writeInput = write?.input as {
      documentId: string;
      part: string;
      value: { card_id: string; chip_standards_version: string; name: string; modified_at: string };
    };
    expect(writeInput).toMatchObject({
      documentId: 'card-001',
      part: 'metadata',
      value: {
        card_id: 'card-001',
        chip_standards_version: '1.0.0',
        name: '会议记录',
      },
    });
    // modified_at 由编辑链路写入时点前移（ISO 8601 UTC）。
    expect(writeInput.value.modified_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // 写后重读：写入成功后经 document:read 重读元数据投影，不本地拼装第二事实源。
    const metadataReads = harness.requests.filter(
      (call) => call.id === 'document:read' && (call.input as { part?: string }).part === 'metadata',
    );
    expect(metadataReads.length).toBeGreaterThanOrEqual(2);
    // 列表项与编辑区标题随重读投影翻正。
    expect(screen.getAllByText('会议记录').length).toBeGreaterThanOrEqual(2);
  });

  it('revision 回执严格递增驱动 UI 状态：连续两次提交后修订徽标为 2，第二次写携带新值', async () => {
    const harness = installWriteChainChips();
    render(<AppView />);
    await openSampleNote();

    fireEvent.change(screen.getByLabelText('文档名称'), { target: { value: '第一次改名' } });
    fireEvent.click(screen.getByRole('button', { name: '提交修改' }));
    await waitFor(() => {
      expect(screen.getByText('修订徽标：修订号 1')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('文档名称'), { target: { value: '第二次改名' } });
    fireEvent.click(screen.getByRole('button', { name: '提交修改' }));
    await waitFor(() => {
      expect(screen.getByText('修订徽标：修订号 2')).toBeTruthy();
    });
    const writes = harness.requests.filter((call) => call.id === 'document:write');
    expect(writes).toHaveLength(2);
    expect((writes[1]?.input as { value: { name: string } }).value.name).toBe('第二次改名');
  });

  it('修订冲突臂：document:write 拒绝 DOCUMENT_WRITE_CONFLICT 时行内简体中文提示，不吞错不假成功', async () => {
    const harness = installWriteChainChips();
    harness.writeError = { code: 'DOCUMENT_WRITE_CONFLICT' };
    render(<AppView />);
    await openSampleNote();

    fireEvent.change(screen.getByLabelText('文档名称'), { target: { value: '冲突改名' } });
    fireEvent.click(screen.getByRole('button', { name: '提交修改' }));

    // antd message 通知亦带 role="alert"，写链错误面按 data-role 精确定位。
    const alert = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[data-role="write-error"]');
      expect(element).not.toBeNull();
      expect(element?.textContent).toContain('DOCUMENT_WRITE_CONFLICT');
      expect(element?.textContent).toContain('文档正被其他会话写入');
      expect(element?.textContent).toContain('稍后重试');
      return element;
    });
    expect(alert?.getAttribute('role')).toBe('alert');
    // 修订徽标不前移（写未成功），待提交修改保留可重试。
    expect(screen.getByText('修订徽标：未写入')).toBeTruthy();
    expect(screen.getByText(/待提交修改：重命名/)).toBeTruthy();
  });

  it('内容节点编辑链：整体替换切片（保留 node_id/file/card_type）并写后重读更新呈现', async () => {
    const harness = installWriteChainChips();
    render(<AppView />);
    await openSampleNote();

    fireEvent.click(screen.getByRole('button', { name: '读取内容' }));
    await waitFor(() => {
      expect(nodeDisplayText()).toContain('"初稿"');
    });
    fireEvent.click(screen.getByRole('button', { name: '编辑内容' }));
    fireEvent.change(screen.getByLabelText('内容编辑 node000001'), {
      target: { value: '{"text":"定稿"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交修改' }));

    await waitFor(() => {
      expect(screen.getByText('修订徽标：修订号 1')).toBeTruthy();
    });
    const write = harness.requests.find((call) => call.id === 'document:write');
    expect(write?.input).toMatchObject({
      documentId: 'card-001',
      part: 'content',
      nodeId: 'node000001',
      value: {
        node_id: 'node000001',
        file: 'content/node000001.yaml',
        card_type: 'base.richtext',
        value: { text: '定稿' },
      },
    });
    // 写后重读：内容节点呈现更新为重读投影（编辑框仍持原文，呈现面以重读为准）。
    await waitFor(() => {
      expect(nodeDisplayText()).toContain('"定稿"');
    });
  });

  it('保存到磁盘：document:save 持久化并呈现回执摘要', async () => {
    const harness = installWriteChainChips();
    render(<AppView />);
    await openSampleNote();

    fireEvent.click(screen.getByRole('button', { name: '保存到磁盘' }));

    await waitFor(() => {
      expect(screen.getByText(/已保存摘要：saved-digest-001/)).toBeTruthy();
    });
    const save = harness.requests.find((call) => call.id === 'document:save');
    expect(save?.input).toEqual({ documentId: 'card-001' });
  });

  it('保存失败臂：document:save 拒绝 DOCUMENT_SAVE_FAILED 时行内呈现错误码，不伪造成功', async () => {
    const harness = installWriteChainChips();
    harness.saveError = { code: 'DOCUMENT_SAVE_FAILED' };
    render(<AppView />);
    await openSampleNote();

    fireEvent.click(screen.getByRole('button', { name: '保存到磁盘' }));

    // antd message 通知亦带 role="alert"，写链错误面按 data-role 精确定位。
    const alert = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[data-role="write-error"]');
      expect(element).not.toBeNull();
      expect(element?.textContent).toContain('DOCUMENT_SAVE_FAILED');
      expect(element?.textContent).toContain('保存未完成');
      return element;
    });
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(screen.queryByText(/已保存摘要/)).toBeNull();
  });
});
