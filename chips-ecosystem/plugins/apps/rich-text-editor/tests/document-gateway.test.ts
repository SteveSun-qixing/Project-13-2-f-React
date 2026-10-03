import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIsolatedDocumentGateway,
  describeGatewayError,
  DocumentGatewayError,
} from '../src/domain/editor/documentGateway';

/**
 * 文档存储契约消费面测试：以受控 Bridge 替身锁定 `document:open` / `document:read` /
 * `document:write` / `document:save` / `document:create` / `document:export` 的调用形状
 * （能力 ID、输入组合、回执守卫）与错误传播。
 *
 * 组合语义与宿主 `validation.ts` 同源：卡片 content 必携 `nodeId`；写回执 `{ revision }`
 * 必须为正整数；保存回执必携 `source` / `digest`。
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
        documentId: 'a1B2c3D4e5',
        source: 'chips-resource://ws/demo/note.card',
        kind: 'card',
        title: '东京旅行日记',
        digest: 'quick-digest',
      })
    );
    installChips(request);
    const opened = await createIsolatedDocumentGateway().open('chips-resource://ws/demo/note.card');
    expect(request).toHaveBeenCalledWith('document:open', {
      source: 'chips-resource://ws/demo/note.card',
    });
    expect(opened).toEqual({
      documentId: 'a1B2c3D4e5',
      source: 'chips-resource://ws/demo/note.card',
      kind: 'card',
      title: '东京旅行日记',
      digest: 'quick-digest',
    });
  });

  it('打开失败归一为携带错误码的 DocumentGatewayError', async () => {
    installChips(() =>
      Promise.reject(Object.assign(new Error('格式未识别'), { code: 'DOCUMENT_FORMAT_UNKNOWN' }))
    );
    await expect(createIsolatedDocumentGateway().open('~/损坏.card')).rejects.toMatchObject({
      code: 'DOCUMENT_FORMAT_UNKNOWN',
    });
  });
});

describe('document:read 切片组合', () => {
  it('卡片元数据切片按 part 调用并校验回包一致性', async () => {
    const request = vi.fn<RequestSpy>(() =>
      Promise.resolve({
        part: 'metadata',
        value: { card_id: 'a1B2c3D4e5', name: '东京旅行日记' },
        diagnostics: [],
      })
    );
    installChips(request);
    const metadata = await createIsolatedDocumentGateway().readCardMetadata('a1B2c3D4e5');
    expect(request).toHaveBeenCalledWith('document:read', {
      documentId: 'a1B2c3D4e5',
      part: 'metadata',
    });
    expect(metadata).toMatchObject({ card_id: 'a1B2c3D4e5' });
  });

  it('元数据回包缺失 card_id 时以 DOCUMENT_METADATA_INVALID 如实拒绝', async () => {
    installChips(() => Promise.resolve({ part: 'metadata', value: {}, diagnostics: [] }));
    await expect(
      createIsolatedDocumentGateway().readCardMetadata('a1B2c3D4e5')
    ).rejects.toMatchObject({
      code: 'DOCUMENT_METADATA_INVALID',
    });
  });

  it('结构切片要求 structure 数组，缺失时以 DOCUMENT_STRUCTURE_INVALID 拒绝', async () => {
    installChips(() => Promise.resolve({ part: 'structure', value: {}, diagnostics: [] }));
    await expect(createIsolatedDocumentGateway().readStructure('a1B2c3D4e5')).rejects.toMatchObject(
      {
        code: 'DOCUMENT_STRUCTURE_INVALID',
      }
    );
  });

  it('内容节点切片必须携带 nodeId 并校验 node_id 包络', async () => {
    const request = vi.fn<RequestSpy>(() =>
      Promise.resolve({
        part: 'content',
        value: {
          node_id: 'f6G7h8I9j0',
          file: 'content/f6G7h8I9j0.yaml',
          card_type: 'base.richtext',
          value: {},
        },
        diagnostics: [],
      })
    );
    installChips(request);
    const node = await createIsolatedDocumentGateway().readCardContent('a1B2c3D4e5', 'f6G7h8I9j0');
    expect(request).toHaveBeenCalledWith('document:read', {
      documentId: 'a1B2c3D4e5',
      part: 'content',
      nodeId: 'f6G7h8I9j0',
    });
    expect(node).toMatchObject({ node_id: 'f6G7h8I9j0', card_type: 'base.richtext' });
  });

  it('读回包切片与请求不一致时以 DOCUMENT_PART_MISMATCH 拒绝', async () => {
    installChips(() => Promise.resolve({ part: 'entries', value: [], diagnostics: [] }));
    await expect(
      createIsolatedDocumentGateway().readCardContent('a1B2c3D4e5', 'f6G7h8I9j0')
    ).rejects.toMatchObject({ code: 'DOCUMENT_PART_MISMATCH' });
  });

  it('箱子元数据切片校验 box_id 包络，条目切片透传 range 分页', async () => {
    const request = vi.fn<RequestSpy>((_capabilityId: string, input?: unknown) => {
      const record = input as { part: string; range?: { offset: number; limit: number } };
      if (record.part === 'metadata') {
        return Promise.resolve({
          part: 'metadata',
          value: {
            box_id: 'b1A2b3C4d5',
            name: '工作笔记',
            active_layout_type: 'chips.layout.grid',
          },
          diagnostics: [],
        });
      }
      return Promise.resolve({
        part: 'entries',
        value: [{ entry_id: 'e1', url: 'a.card', enabled: true }],
        diagnostics: [],
      });
    });
    installChips(request);
    const gateway = createIsolatedDocumentGateway();
    expect(await gateway.readBoxMetadata('b1A2b3C4d5')).toMatchObject({ box_id: 'b1A2b3C4d5' });
    expect(await gateway.readEntries('b1A2b3C4d5', { offset: 100, limit: 50 })).toHaveLength(1);
    expect(request).toHaveBeenNthCalledWith(2, 'document:read', {
      documentId: 'b1A2b3C4d5',
      part: 'entries',
      range: { offset: 100, limit: 50 },
    });
  });

  it('箱子条目切片非数组时以 DOCUMENT_ENTRIES_INVALID 拒绝', async () => {
    installChips(() => Promise.resolve({ part: 'entries', value: {}, diagnostics: [] }));
    await expect(createIsolatedDocumentGateway().readEntries('b1A2b3C4d5')).rejects.toMatchObject({
      code: 'DOCUMENT_ENTRIES_INVALID',
    });
  });
});

describe('document:write 消费', () => {
  it('按 { documentId, part, nodeId, value } 形状调用并返回修订回执', async () => {
    const request = vi.fn<RequestSpy>(() => Promise.resolve({ revision: 3 }));
    installChips(request);
    const revision = await createIsolatedDocumentGateway().writeCardContent(
      'a1B2c3D4e5',
      'f6G7h8I9j0',
      {
        card_type: 'base.richtext',
      }
    );
    expect(request).toHaveBeenCalledWith('document:write', {
      documentId: 'a1B2c3D4e5',
      part: 'content',
      nodeId: 'f6G7h8I9j0',
      value: { card_type: 'base.richtext' },
    });
    expect(revision).toBe(3);
  });

  it('写回执修订号缺失或非正整数时以 DOCUMENT_REVISION_INVALID 拒绝', async () => {
    installChips(() => Promise.resolve({ revision: 0 }));
    await expect(
      createIsolatedDocumentGateway().writeCardContent('a1B2c3D4e5', 'f6G7h8I9j0', {})
    ).rejects.toMatchObject({ code: 'DOCUMENT_REVISION_INVALID' });
    installChips(() => Promise.resolve({}));
    await expect(
      createIsolatedDocumentGateway().writeCardContent('a1B2c3D4e5', 'f6G7h8I9j0', {})
    ).rejects.toMatchObject({ code: 'DOCUMENT_REVISION_INVALID' });
  });

  it('写入失败透传宿主归一错误码', async () => {
    installChips(() =>
      Promise.reject(Object.assign(new Error('写入冲突'), { code: 'DOCUMENT_WRITE_CONFLICT' }))
    );
    await expect(
      createIsolatedDocumentGateway().writeCardContent('a1B2c3D4e5', 'f6G7h8I9j0', {})
    ).rejects.toMatchObject({ code: 'DOCUMENT_WRITE_CONFLICT' });
  });
});

describe('document:save 消费', () => {
  it('按 { documentId } 调用并返回 { source, digest } 回执', async () => {
    const request = vi.fn<RequestSpy>(() =>
      Promise.resolve({ source: 'chips-resource://ws/demo/note.card', digest: 'sha256-deadbeef' })
    );
    installChips(request);
    const receipt = await createIsolatedDocumentGateway().saveDocument('a1B2c3D4e5');
    expect(request).toHaveBeenCalledWith('document:save', { documentId: 'a1B2c3D4e5' });
    expect(receipt).toEqual({
      source: 'chips-resource://ws/demo/note.card',
      digest: 'sha256-deadbeef',
    });
  });

  it('保存回执缺 source / digest 时以 DOCUMENT_SAVE_RECEIPT_INVALID 拒绝', async () => {
    installChips(() => Promise.resolve({ source: 'chips-resource://ws/demo/note.card' }));
    await expect(createIsolatedDocumentGateway().saveDocument('a1B2c3D4e5')).rejects.toMatchObject({
      code: 'DOCUMENT_SAVE_RECEIPT_INVALID',
    });
  });
});

describe('document:create / document:export 消费（宿主实现在途，调用面为正式契约）', () => {
  it('创建按 { kind, parent, name, initialContent } 形状调用并透传回包', async () => {
    const request = vi.fn<RequestSpy>(() =>
      Promise.resolve({ documentId: 'a1B2c3D4e5', source: 'chips-resource://ws/新建卡片.card' })
    );
    installChips(request);
    const output = await createIsolatedDocumentGateway().createDocument({
      kind: 'card',
      parent: 'chips-resource://ws',
      name: '新卡片',
      initialContent: { cardType: 'base.richtext' },
    });
    expect(request).toHaveBeenCalledWith('document:create', {
      kind: 'card',
      parent: 'chips-resource://ws',
      name: '新卡片',
      initialContent: { cardType: 'base.richtext' },
    });
    expect(output).toEqual({
      documentId: 'a1B2c3D4e5',
      source: 'chips-resource://ws/新建卡片.card',
    });
  });

  it('导出按 { documentId, target, form } 形状调用并透传回包', async () => {
    const request = vi.fn<RequestSpy>(() =>
      Promise.resolve({ target: '/导出/东京旅行日记.card', digest: 'sha256-cafebabe' })
    );
    installChips(request);
    const output = await createIsolatedDocumentGateway().exportDocument({
      documentId: 'a1B2c3D4e5',
      target: '/导出/东京旅行日记.card',
      form: 'archive',
    });
    expect(request).toHaveBeenCalledWith('document:export', {
      documentId: 'a1B2c3D4e5',
      target: '/导出/东京旅行日记.card',
      form: 'archive',
    });
    expect(output).toEqual({ target: '/导出/东京旅行日记.card', digest: 'sha256-cafebabe' });
  });

  it('能力未注册（宿主实现在途）时透传真实错误码，不假成功', async () => {
    installChips(() =>
      Promise.reject(
        Object.assign(new Error('能力未注册'), { code: 'BRIDGE_CAPABILITY_NOT_FOUND' })
      )
    );
    await expect(
      createIsolatedDocumentGateway().createDocument({
        kind: 'card',
        parent: 'chips-resource://ws',
      })
    ).rejects.toMatchObject({ code: 'BRIDGE_CAPABILITY_NOT_FOUND' });
  });
});

describe('错误归一面', () => {
  it('无错误码抛出值兜底为 DOCUMENT_GATEWAY_ERROR，并保留消息', async () => {
    installChips(() => Promise.reject(new Error('通道崩溃')));
    await expect(
      createIsolatedDocumentGateway().open('chips-resource://ws/a.card')
    ).rejects.toMatchObject({
      code: 'DOCUMENT_GATEWAY_ERROR',
      message: '通道崩溃',
    });
  });

  it('DocumentGatewayError 原样透传（不被二次包装）', async () => {
    installChips(() =>
      Promise.reject(new DocumentGatewayError('DOCUMENT_SOURCE_CHANGED', '来源已变化'))
    );
    const error = (await createIsolatedDocumentGateway()
      .saveDocument('a1B2c3D4e5')
      .catch(
        (caught: unknown): DocumentGatewayError => caught as DocumentGatewayError
      )) as DocumentGatewayError;
    expect(error).toBeInstanceOf(DocumentGatewayError);
    expect(error.code).toBe('DOCUMENT_SOURCE_CHANGED');
  });

  it('describeGatewayError 从任意抛出值提取错误码', () => {
    expect(describeGatewayError(Object.assign(new Error('x'), { code: 'A_B' }))).toEqual({
      code: 'A_B',
      message: 'x',
    });
    expect(describeGatewayError('原始字符串')).toEqual({
      code: 'DOCUMENT_GATEWAY_ERROR',
      message: '未知错误',
    });
  });
});
