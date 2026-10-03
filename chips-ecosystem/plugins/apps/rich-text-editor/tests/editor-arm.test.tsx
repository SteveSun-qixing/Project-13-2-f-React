// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import React from 'react';
import type { IBaseCardEditor } from '@chips/sdk';
import { useEditorWorkspace } from '../src/ui/useEditorWorkspace';
import { EditorMount } from '../src/ui/EditorMount';

/**
 * 编辑臂集成面（装载 / 回流 / 保存链 fake 桥契约测试 + Milkdown 真编辑器挂载）：
 *
 * - 装载链：打开来源 → `document:open` → `document:read`（metadata / structure / content）
 *   三拍调用形状 journal 锁定 → 插件正式编辑器（`@chips/plugin-richtext` renderEditor，
 *   Milkdown 装配唯一口径）挂载 ProseMirror 编辑面；
 * - 回流链：编辑事务 → change 事件 → 会话唯一时序（getChange → 校验 → `document:write` →
 *   投影重读 → `markCommitted`）→ 修订号驱动界面状态；
 * - 保存链：`document:save` 回执 `{ source, digest }` 驱动保存态呈现，失败如实回码不假成功；
 * - 卡箱浏览面：箱子打开为只读摘要（最小可用），新建/导出入口按正式契约调用并在宿主实现
 *   在途时如实呈现真实错误码。
 */

type RequestSpy = (capabilityId: string, input?: unknown) => Promise<unknown>;

/** fake 文档桥：以受控内存模型承载 document:open/read/write/save 四能力回包。 */
function createDocumentBridge(options: {
  content: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  failWriteWith?: string;
  failSaveWith?: string;
}): { request: RequestSpy; calls: Array<{ capabilityId: string; input: unknown }> } {
  const calls: Array<{ capabilityId: string; input: unknown }> = [];
  let revision = 0;
  let currentValue = options.content;
  const metadata = options.metadata ?? {
    chip_standards_version: '1.0.0',
    card_id: 'a1B2c3D4e5',
    name: '东京旅行日记',
    created_at: '2026-01-15T08:00:00.000Z',
    modified_at: '2026-01-30T10:30:00.000Z',
    theme: '',
    cover_ratio: '3:4',
    tags: [],
  };
  const request: RequestSpy = (capabilityId, input) => {
    calls.push({ capabilityId, input });
    const record = (input ?? {}) as Record<string, unknown>;
    switch (capabilityId) {
      case 'document:open':
        return Promise.resolve({
          documentId: 'a1B2c3D4e5',
          source: 'chips-resource://ws/东京旅行日记.card',
          kind: 'card',
          title: '东京旅行日记',
          digest: 'digest-open-1',
        });
      case 'document:read':
        if (record.part === 'metadata') {
          return Promise.resolve({ part: 'metadata', value: metadata, diagnostics: [] });
        }
        if (record.part === 'structure') {
          return Promise.resolve({
            part: 'structure',
            value: {
              structure: [{ id: 'f6G7h8I9j0', type: 'base.richtext' }],
              manifest: { card_count: 1, resource_count: 0, resources: [] },
            },
            diagnostics: [],
          });
        }
        return Promise.resolve({
          part: 'content',
          value: {
            node_id: 'f6G7h8I9j0',
            file: 'content/f6G7h8I9j0.yaml',
            card_type: 'base.richtext',
            value: currentValue,
          },
          diagnostics: [],
        });
      case 'document:write': {
        if (options.failWriteWith !== undefined) {
          return Promise.reject(
            Object.assign(new Error('写入冲突'), { code: options.failWriteWith })
          );
        }
        currentValue = record.value as Record<string, unknown>;
        revision += 1;
        return Promise.resolve({ revision });
      }
      case 'document:save':
        if (options.failSaveWith !== undefined) {
          return Promise.reject(
            Object.assign(new Error('落盘失败'), { code: options.failSaveWith })
          );
        }
        return Promise.resolve({
          source: 'chips-resource://ws/东京旅行日记.card',
          digest: `digest-save-${String(revision)}`,
        });
      default:
        return Promise.reject(
          Object.assign(new Error('能力未注册'), { code: 'BRIDGE_CAPABILITY_NOT_FOUND' })
        );
    }
  };
  return { request, calls };
}

function installChips(request: RequestSpy): void {
  (globalThis as { chips?: unknown }).chips = { request, subscribe: vi.fn(), resource: vi.fn() };
}

function removeChips(): void {
  delete (globalThis as { chips?: unknown }).chips;
}

const INLINE_CONTENT: Record<string, unknown> = {
  card_type: 'base.richtext',
  theme: '',
  locale: 'zh-CN',
  content_format: 'markdown',
  content_source: 'inline',
  content_text: '# 标题\n\n正文内容',
  markdown_capabilities: {
    commonmark: true,
    gfm: true,
    math: true,
    highlight: true,
    underline: true,
    superscript: true,
    subscript: true,
  },
};

/** 测试台架：与 AppView 同构的最小编排（钩子 + 编辑器挂载 + 状态读数）。 */
function createHarness(): {
  probe: () => ReturnType<typeof useEditorWorkspace>;
  TestingHarness: React.FC;
} {
  let latest: ReturnType<typeof useEditorWorkspace> | null = null;
  const TestingHarness: React.FC = () => {
    const workspace = useEditorWorkspace();
    latest = workspace;
    const draft = workspace.cardDraft;
    return (
      <div>
        <div data-testid="status">{workspace.status}</div>
        <div data-testid="revision">{String(workspace.revision)}</div>
        <div data-testid="dirty">{workspace.dirty ? '有未保存变更' : '已保存'}</div>
        <div data-testid="saved">{workspace.savedDigest ?? '未保存'}</div>
        <div data-testid="error">{workspace.writeError?.code ?? workspace.errorCode ?? '无'}</div>
        <div data-testid="cards">{String(workspace.library.cards.length)}</div>
        <div data-testid="boxes">{String(workspace.library.boxes.length)}</div>
        {workspace.boxDetail !== null ? (
          <div data-testid="box-detail">
            {workspace.boxDetail.metadata.name}/{String(workspace.boxDetail.entries.length)}
          </div>
        ) : null}
        {draft !== null ? (
          <EditorMount
            view={draft.view}
            onAttach={(editor: IBaseCardEditor): void => workspace.attachEditor(editor)}
            onDetach={(): void => workspace.detachEditor()}
          />
        ) : null}
      </div>
    );
  };
  return {
    probe: (): ReturnType<typeof useEditorWorkspace> =>
      latest as ReturnType<typeof useEditorWorkspace>,
    TestingHarness,
  };
}

/** 程序化编辑驱动面（插件句柄的宿主驱动/测试入口，与键入同一事务路径）。 */
interface IEditorDriver {
  insertText(text: string): void;
}

beforeEach(() => {
  removeChips();
});

afterEach(() => {
  cleanup();
  removeChips();
});

describe('装载链（document:open → read 三拍 → 插件编辑器挂载）', () => {
  it('打开来源按正式面三拍读取并装配编辑视图，Milkdown 编辑面挂载', async () => {
    const bridge = createDocumentBridge({ content: INLINE_CONTENT });
    installChips(bridge.request);
    const { probe, TestingHarness } = createHarness();
    render(<TestingHarness />);

    await act(async () => {
      await probe().openSource('chips-resource://ws/东京旅行日记.card');
    });

    expect(bridge.calls.map((call) => call.capabilityId)).toEqual([
      'document:open',
      'document:read',
      'document:read',
      'document:read',
    ]);
    expect(probe().status).toBe('ready');
    expect(probe().cardDraft?.nodeId).toBe('f6G7h8I9j0');
    expect(probe().cardDraft?.view.content).toEqual(INLINE_CONTENT);
    expect(probe().library.cards).toHaveLength(1);

    await waitFor(() => {
      expect(document.querySelector('.ProseMirror')).not.toBeNull();
    });
  });

  it('打开失败（宿主归一错误码）进入 error 态并如实呈现，不产生半开视图', async () => {
    const request: RequestSpy = () =>
      Promise.reject(Object.assign(new Error('格式未识别'), { code: 'DOCUMENT_FORMAT_UNKNOWN' }));
    installChips(request);
    const { probe, TestingHarness } = createHarness();
    render(<TestingHarness />);

    await act(async () => {
      await probe().openSource('~/损坏.card');
    });

    expect(probe().status).toBe('error');
    expect(probe().errorCode).toBe('DOCUMENT_FORMAT_UNKNOWN');
    expect(probe().cardDraft).toBeNull();
  });
});

describe('回流与保存链（唯一时序 + 保存回执驱动 UI）', () => {
  it('编辑事务经唯一时序回流：write 携带 nodeId 与修订后正文，markCommitted 推进修订号', async () => {
    const bridge = createDocumentBridge({ content: INLINE_CONTENT });
    installChips(bridge.request);
    const { probe, TestingHarness } = createHarness();
    render(<TestingHarness />);

    await act(async () => {
      await probe().openSource('chips-resource://ws/东京旅行日记.card');
    });
    await waitFor(() => {
      expect(document.querySelector('.ProseMirror')).not.toBeNull();
    });

    // 引擎装载完成后的程序化编辑入口：与键入同一事务路径（transaction → listener 序列化回流）。
    await waitFor(() => {
      expect(probe().editorDriver).not.toBeNull();
    });
    act(() => {
      (probe().editorDriver as IEditorDriver).insertText('增补');
    });
    await waitFor(() => {
      expect(probe().dirty).toBe(true);
    });

    const writeCallsBefore = bridge.calls.filter(
      (call) => call.capabilityId === 'document:write'
    ).length;
    await act(async () => {
      await probe().commitPending();
    });
    expect(probe().revision).toBe(1);
    expect(probe().dirty).toBe(false);

    const writes = bridge.calls.filter((call) => call.capabilityId === 'document:write');
    expect(writes).toHaveLength(writeCallsBefore + 1);
    const writeInput = writes[writes.length - 1]?.input as Record<string, unknown>;
    expect(writeInput['documentId']).toBe('a1B2c3D4e5');
    expect(writeInput['part']).toBe('content');
    expect(writeInput['nodeId']).toBe('f6G7h8I9j0');
    expect((writeInput['value'] as Record<string, unknown>)['content_text']).toContain('增补');
  });

  it('保存链：flush 回流后 document:save，回执 { source, digest } 驱动保存态呈现', async () => {
    const bridge = createDocumentBridge({ content: INLINE_CONTENT });
    installChips(bridge.request);
    const { probe, TestingHarness } = createHarness();
    render(<TestingHarness />);

    await act(async () => {
      await probe().openSource('chips-resource://ws/东京旅行日记.card');
    });
    await waitFor(() => {
      expect(probe().editorDriver).not.toBeNull();
    });
    act(() => {
      (probe().editorDriver as IEditorDriver).insertText('定稿');
    });
    await waitFor(() => {
      expect(probe().dirty).toBe(true);
    });

    await act(async () => {
      await probe().saveNow();
    });

    expect(probe().dirty).toBe(false);
    expect(probe().savedDigest).toBe('digest-save-1');
    expect(bridge.calls.at(-1)?.capabilityId).toBe('document:save');
  });

  it('写入失败：真实错误码行内呈现，编辑器保持待提交变更，不触达 document:save', async () => {
    const bridge = createDocumentBridge({
      content: INLINE_CONTENT,
      failWriteWith: 'DOCUMENT_WRITE_CONFLICT',
    });
    installChips(bridge.request);
    const { probe, TestingHarness } = createHarness();
    render(<TestingHarness />);

    await act(async () => {
      await probe().openSource('chips-resource://ws/东京旅行日记.card');
    });
    await waitFor(() => {
      expect(probe().editorDriver).not.toBeNull();
    });
    act(() => {
      (probe().editorDriver as IEditorDriver).insertText('冲突稿');
    });
    await waitFor(() => {
      expect(probe().dirty).toBe(true);
    });

    await act(async () => {
      await probe().commitPending();
    });

    expect(probe().dirty).toBe(true);
    expect(probe().writeError?.code).toBe('DOCUMENT_WRITE_CONFLICT');
    expect(bridge.calls.some((call) => call.capabilityId === 'document:save')).toBe(false);
  });

  it('保存失败：save-failed 如实回码（不吞错、不假成功）', async () => {
    const bridge = createDocumentBridge({
      content: INLINE_CONTENT,
      failSaveWith: 'DOCUMENT_SAVE_FAILED',
    });
    installChips(bridge.request);
    const { probe, TestingHarness } = createHarness();
    render(<TestingHarness />);

    await act(async () => {
      await probe().openSource('chips-resource://ws/东京旅行日记.card');
    });
    await waitFor(() => {
      expect(probe().editorDriver).not.toBeNull();
    });

    await act(async () => {
      await probe().saveNow();
    });

    expect(probe().savedDigest).toBeNull();
    expect(probe().saveError?.code).toBe('DOCUMENT_SAVE_FAILED');
  });
});

describe('卡箱浏览面与新建/导出入口（正式契约调用，宿主在途如实回码）', () => {
  it('箱子打开进入只读摘要（最小可用浏览面），卡片/箱子分计数呈现', async () => {
    const bridge = createDocumentBridge({ content: INLINE_CONTENT });
    const request: RequestSpy = (capabilityId, input) => {
      if (capabilityId === 'document:open') {
        return Promise.resolve({
          documentId: 'b1A2b3C4d5',
          source: 'chips-resource://ws/工作笔记.box',
          kind: 'box',
          title: '工作笔记',
          digest: 'digest-box-1',
        });
      }
      if (
        capabilityId === 'document:read' &&
        (input as Record<string, unknown>).part === 'metadata'
      ) {
        return Promise.resolve({
          part: 'metadata',
          value: {
            chip_standards_version: '1.0.0',
            box_id: 'b1A2b3C4d5',
            name: '工作笔记',
            created_at: '2026-01-15T08:00:00.000Z',
            modified_at: '2026-01-30T10:30:00.000Z',
            active_layout_type: 'chips.layout.grid',
          },
          diagnostics: [],
        });
      }
      if (
        capabilityId === 'document:read' &&
        (input as Record<string, unknown>).part === 'entries'
      ) {
        return Promise.resolve({
          part: 'entries',
          value: [
            { entry_id: 'e1', url: 'a.card', enabled: true },
            { entry_id: 'e2', url: 'b.card', enabled: false },
          ],
          diagnostics: [],
        });
      }
      return bridge.request(capabilityId, input);
    };
    installChips(request);
    const { probe, TestingHarness } = createHarness();
    render(<TestingHarness />);

    await act(async () => {
      await probe().openSource('chips-resource://ws/工作笔记.box');
    });

    expect(probe().status).toBe('ready');
    expect(probe().cardDraft).toBeNull();
    expect(probe().boxDetail?.metadata.name).toBe('工作笔记');
    expect(probe().library.boxes).toHaveLength(1);
  });

  it('新建入口按 document:create 正式契约调用，宿主实现在途时透传真实错误码', async () => {
    const bridge = createDocumentBridge({ content: INLINE_CONTENT });
    installChips(bridge.request);
    const { probe, TestingHarness } = createHarness();
    render(<TestingHarness />);

    await act(async () => {
      await probe().createDocument('card', '新卡片', 'chips-resource://ws');
    });

    const createCall = bridge.calls.find((call) => call.capabilityId === 'document:create');
    expect(createCall?.input).toEqual({
      kind: 'card',
      parent: 'chips-resource://ws',
      name: '新卡片',
      initialContent: { cardType: 'base.richtext' },
    });
    expect(probe().createError?.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
  });

  it('导出入口按 document:export 正式契约调用，宿主实现在途时透传真实错误码', async () => {
    const bridge = createDocumentBridge({ content: INLINE_CONTENT });
    installChips(bridge.request);
    const { probe, TestingHarness } = createHarness();
    render(<TestingHarness />);

    await act(async () => {
      await probe().openSource('chips-resource://ws/东京旅行日记.card');
    });
    await act(async () => {
      await probe().exportDocument('archive', '/导出/东京旅行日记.card');
    });

    const exportCall = bridge.calls.find((call) => call.capabilityId === 'document:export');
    expect(exportCall?.input).toEqual({
      documentId: 'a1B2c3D4e5',
      target: '/导出/东京旅行日记.card',
      form: 'archive',
    });
    expect(probe().exportError?.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
  });
});
