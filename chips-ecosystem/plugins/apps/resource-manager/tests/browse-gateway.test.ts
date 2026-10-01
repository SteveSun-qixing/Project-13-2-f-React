import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIsolatedBrowseGateway, BrowseGatewayError } from '../src/domain/browse/browseGateway';

/**
 * 只读消费面测试：以受控 Bridge 替身锁定 `document:open` / `document:read`
 * 的调用形状（能力 ID、输入组合、切片一致性）与错误传播。
 *
 * 组合语义判例与宿主 `validation.ts` 同源：`entries` 仅箱子可用、metadata/structure
 * 不携 nodeId；range 分页透传。
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
  it('按 { source } 形状调用并把回包投影为浏览摘要', async () => {
    const request = vi.fn<RequestSpy>(() =>
      Promise.resolve({
        documentId: 'box-77',
        source: 'chips-resource://ws/demo/素材.box',
        kind: 'box',
        title: '素材箱',
        digest: 'quick-digest',
      }),
    );
    installChips(request);
    const opened = await createIsolatedBrowseGateway().open('chips-resource://ws/demo/素材.box');
    expect(request).toHaveBeenCalledWith('document:open', { source: 'chips-resource://ws/demo/素材.box' });
    expect(opened).toEqual({
      documentId: 'box-77',
      source: 'chips-resource://ws/demo/素材.box',
      kind: 'box',
      title: '素材箱',
      digest: 'quick-digest',
    });
  });

  it('打开失败归一为携带错误码的 BrowseGatewayError', async () => {
    installChips(() =>
      Promise.reject(Object.assign(new Error('来源不可达'), { code: 'RESOURCE_NOT_FOUND' })),
    );
    await expect(createIsolatedBrowseGateway().open('~/缺失.box')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });
});

describe('document:read 切片组合', () => {
  it('卡片摘要视图并行读取 metadata + structure 并复核回包一致性', async () => {
    const request = vi.fn<RequestSpy>((_capabilityId: string, input?: unknown) => {
      const record = input as { documentId: string; part: string };
      if (record.part === 'metadata') {
        return Promise.resolve({
          part: 'metadata',
          value: { card_id: record.documentId, name: '素材卡' },
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
    const detail = await createIsolatedBrowseGateway().readCardDetail('card-01');
    expect(detail.kind).toBe('card');
    expect(detail.metadata).toMatchObject({ card_id: 'card-01' });
    expect(detail.structure.structure).toHaveLength(1);
    expect(request).toHaveBeenCalledWith('document:read', { documentId: 'card-01', part: 'metadata' });
    expect(request).toHaveBeenCalledWith('document:read', { documentId: 'card-01', part: 'structure' });
  });

  it('箱子摘要视图读取条目切片并透传 range 分页', async () => {
    const request = vi.fn<RequestSpy>((_capabilityId: string, input?: unknown) => {
      const record = input as { documentId: string; part: string; range?: unknown };
      if (record.part === 'metadata') {
        return Promise.resolve({
          part: 'metadata',
          value: { box_id: record.documentId, name: '素材箱' },
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
    const gateway = createIsolatedBrowseGateway();
    const paged = await gateway.readBoxDetail('box-77', { offset: 200, limit: 100 });
    expect(paged.kind).toBe('box');
    expect(paged.entries).toHaveLength(1);
    expect(request).toHaveBeenCalledWith('document:read', {
      documentId: 'box-77',
      part: 'entries',
      range: { offset: 200, limit: 100 },
    });
    const whole = await gateway.readBoxDetail('box-77');
    expect(request).toHaveBeenCalledWith('document:read', { documentId: 'box-77', part: 'entries' });
    expect(whole.entries).toHaveLength(1);
  });

  it('回包切片与请求不一致时拒绝（不白信通道）', async () => {
    installChips(() => Promise.resolve({ part: 'entries', value: [], diagnostics: [] }));
    await expect(createIsolatedBrowseGateway().readCardDetail('card-01')).rejects.toBeInstanceOf(
      BrowseGatewayError,
    );
  });
});
