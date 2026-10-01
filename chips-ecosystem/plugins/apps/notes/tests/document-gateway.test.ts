import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIsolatedDocumentGateway, DocumentGatewayError } from '../src/domain/notes/documentGateway';

/**
 * 存储契约消费面测试：以受控 Bridge 替身锁定 `document:open` / `document:read`
 * 的调用形状（能力 ID、输入组合、切片一致性）与错误传播。
 *
 * 组合语义判例与宿主 `validation.ts` 同源：卡片 content 必携 `nodeId`、箱子 content
 * 不携 `nodeId`、`entries` 仅箱子可用。
 */

type RequestSpy = (capabilityId: string, input?: unknown) => Promise<unknown>;

function installChips(request: RequestSpy): void {
  (globalThis as { chips?: unknown }).chips = { request, subscribe: vi.fn(), resource: vi.fn() };
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

describe('document:open 消费', () => {
  it('按 { source } 形状调用并把回包投影为库摘要', async () => {
    const request = vi.fn<RequestSpy>(() =>
      Promise.resolve({
        documentId: 'card-001',
        source: 'chips-resource://ws/demo/note.card',
        kind: 'card',
        title: '示例笔记',
        digest: 'quick-digest',
      }),
    );
    installChips(request);
    const opened = await createIsolatedDocumentGateway().open('chips-resource://ws/demo/note.card');
    expect(request).toHaveBeenCalledWith('document:open', { source: 'chips-resource://ws/demo/note.card' });
    expect(opened).toEqual({
      documentId: 'card-001',
      source: 'chips-resource://ws/demo/note.card',
      kind: 'card',
      title: '示例笔记',
      digest: 'quick-digest',
    });
  });

  it('打开失败归一为携带错误码的 DocumentGatewayError', async () => {
    installChips(() =>
      Promise.reject(Object.assign(new Error('格式未识别'), { code: 'DOCUMENT_FORMAT_UNKNOWN' })),
    );
    await expect(createIsolatedDocumentGateway().open('~/损坏.card')).rejects.toMatchObject({
      code: 'DOCUMENT_FORMAT_UNKNOWN',
    });
  });
});

describe('document:read 切片组合', () => {
  it('卡片元数据/结构切片按 part 调用并校验回包一致性', async () => {
    const request = vi.fn<RequestSpy>((capabilityId: string, input?: unknown) => {
      expect(capabilityId).toBe('document:read');
      const record = input as { documentId: string; part: string };
      if (record.part === 'metadata') {
        return Promise.resolve({
          part: 'metadata',
          value: { card_id: 'card-001', name: '示例' },
          diagnostics: [],
        });
      }
      return Promise.resolve({
        part: 'structure',
        value: { structure: [{ id: 'node000001', type: 'richtext' }], manifest: { card_count: 1, resource_count: 0 } },
        diagnostics: [],
      });
    });
    installChips(request);
    const gateway = createIsolatedDocumentGateway();
    expect(await gateway.readCardMetadata('card-001')).toMatchObject({ card_id: 'card-001' });
    expect(await gateway.readStructure('card-001')).toMatchObject({ structure: [{ id: 'node000001' }] });
    expect(request).toHaveBeenNthCalledWith(1, 'document:read', { documentId: 'card-001', part: 'metadata' });
    expect(request).toHaveBeenNthCalledWith(2, 'document:read', { documentId: 'card-001', part: 'structure' });
  });

  it('卡片内容节点必须携带 nodeId，箱子内容切片不携带', async () => {
    const request = vi.fn<RequestSpy>(() =>
      Promise.resolve({
        part: 'content',
        value: { node_id: 'node000001', file: 'content/node000001.yaml', card_type: 'base.richtext', value: {}, diagnostics: [] },
        diagnostics: [],
      }),
    );
    installChips(request);
    const gateway = createIsolatedDocumentGateway();
    await gateway.readCardContent('card-001', 'node000001');
    await gateway.readBoxContent('box-001');
    expect(request).toHaveBeenNthCalledWith(1, 'document:read', {
      documentId: 'card-001',
      part: 'content',
      nodeId: 'node000001',
    });
    expect(request).toHaveBeenNthCalledWith(2, 'document:read', { documentId: 'box-001', part: 'content' });
  });

  it('条目切片透传 range 分页并要求回包为数组', async () => {
    const request = vi.fn<RequestSpy>(() =>
      Promise.resolve({ part: 'entries', value: [{ entry_id: 'e1', url: 'a.card', enabled: true }], diagnostics: [] }),
    );
    installChips(request);
    const gateway = createIsolatedDocumentGateway();
    expect(await gateway.readEntries('box-001', { offset: 100, limit: 50 })).toHaveLength(1);
    expect(request).toHaveBeenCalledWith('document:read', {
      documentId: 'box-001',
      part: 'entries',
      range: { offset: 100, limit: 50 },
    });
    installChips(() => Promise.resolve({ part: 'entries', value: null, diagnostics: [] }));
    await expect(gateway.readEntries('box-001')).rejects.toBeInstanceOf(DocumentGatewayError);
  });

  it('回包切片与请求不一致时拒绝（不白信通道）', async () => {
    installChips(() => Promise.resolve({ part: 'entries', value: [], diagnostics: [] }));
    await expect(createIsolatedDocumentGateway().readStructure('card-001')).rejects.toMatchObject({
      code: 'DOCUMENT_PART_MISMATCH',
    });
  });
});

describe('document:write 消费（写臂真实现）', () => {
  it('metadata 写按 { documentId, part, value } 形状调用并回读正整数修订号', async () => {
    const request = vi.fn<RequestSpy>(() => Promise.resolve({ revision: 1 }));
    installChips(request);
    const revision = await createIsolatedDocumentGateway().writeSlice({
      documentId: 'card-001',
      part: 'metadata',
      value: { card_id: 'card-001', name: '会议记录' },
    });
    expect(request).toHaveBeenCalledWith('document:write', {
      documentId: 'card-001',
      part: 'metadata',
      value: { card_id: 'card-001', name: '会议记录' },
    });
    expect(revision).toBe(1);
  });

  it('卡片内容写携带 nodeId（组合语义与读臂同源）', async () => {
    const request = vi.fn<RequestSpy>(() => Promise.resolve({ revision: 2 }));
    installChips(request);
    const revision = await createIsolatedDocumentGateway().writeSlice({
      documentId: 'card-001',
      part: 'content',
      nodeId: 'node000001',
      value: { node_id: 'node000001', card_type: 'base.richtext', value: {} },
    });
    expect(request).toHaveBeenCalledWith('document:write', {
      documentId: 'card-001',
      part: 'content',
      nodeId: 'node000001',
      value: { node_id: 'node000001', card_type: 'base.richtext', value: {} },
    });
    expect(revision).toBe(2);
  });

  it('回执修订号非正整数时拒绝（DOCUMENT_REVISION_INVALID，不白信通道）', async () => {
    installChips(() => Promise.resolve({ revision: 0 }));
    await expect(
      createIsolatedDocumentGateway().writeSlice({ documentId: 'card-001', part: 'metadata', value: {} }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_REVISION_INVALID' });
    installChips(() => Promise.resolve({ revision: 1.5 }));
    await expect(
      createIsolatedDocumentGateway().writeSlice({ documentId: 'card-001', part: 'metadata', value: {} }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_REVISION_INVALID' });
    installChips(() => Promise.resolve({ revision: '2' }));
    await expect(
      createIsolatedDocumentGateway().writeSlice({ documentId: 'card-001', part: 'metadata', value: {} }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_REVISION_INVALID' });
  });

  it('写冲突与写失败错误码原样归一传播，不吞错', async () => {
    installChips(() =>
      Promise.reject(Object.assign(new Error('文档正被其他会话写入'), { code: 'DOCUMENT_WRITE_CONFLICT' })),
    );
    await expect(
      createIsolatedDocumentGateway().writeSlice({ documentId: 'card-001', part: 'metadata', value: {} }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_WRITE_CONFLICT' });
    installChips(() =>
      Promise.reject(Object.assign(new Error('结构校验未通过'), { code: 'DOCUMENT_STRUCTURE_INVALID' })),
    );
    await expect(
      createIsolatedDocumentGateway().writeSlice({ documentId: 'card-001', part: 'content', nodeId: 'n1', value: {} }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_STRUCTURE_INVALID' });
  });
});

describe('document:save 消费（落盘臂真实现）', () => {
  it('按 { documentId } 形状调用并回读 { source, digest }', async () => {
    const request = vi.fn<RequestSpy>(() =>
      Promise.resolve({ source: 'chips-resource://ws/demo/note.card', digest: 'saved-digest' }),
    );
    installChips(request);
    const saved = await createIsolatedDocumentGateway().saveDocument('card-001');
    expect(request).toHaveBeenCalledWith('document:save', { documentId: 'card-001' });
    expect(saved).toEqual({ source: 'chips-resource://ws/demo/note.card', digest: 'saved-digest' });
  });

  it('保存回包缺 source 或 digest 时拒绝（DOCUMENT_SAVE_RECEIPT_INVALID）', async () => {
    installChips(() => Promise.resolve({ source: 'chips-resource://ws/demo/note.card' }));
    await expect(createIsolatedDocumentGateway().saveDocument('card-001')).rejects.toMatchObject({
      code: 'DOCUMENT_SAVE_RECEIPT_INVALID',
    });
    installChips(() => Promise.resolve({ digest: 'saved-digest' }));
    await expect(createIsolatedDocumentGateway().saveDocument('card-001')).rejects.toMatchObject({
      code: 'DOCUMENT_SAVE_RECEIPT_INVALID',
    });
  });

  it('保存失败错误码原样归一传播（DOCUMENT_SAVE_FAILED 及底层 cause）', async () => {
    installChips(() => Promise.reject(Object.assign(new Error('文档保存失败'), { code: 'DOCUMENT_SAVE_FAILED' })));
    await expect(createIsolatedDocumentGateway().saveDocument('card-001')).rejects.toMatchObject({
      code: 'DOCUMENT_SAVE_FAILED',
    });
  });
});
