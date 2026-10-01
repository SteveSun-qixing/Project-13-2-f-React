import { describe, expect, it } from 'vitest';
import type { Entry, StructureModel } from '@chips/sdk';
import {
  addBrowsedDocument,
  entryDisplayName,
  findBrowsedDocument,
  flattenTag,
  flattenTags,
  normalizeBrowseSource,
  presentEntries,
  sliceEntriesPage,
  structureResourceCounts,
  EMPTY_BROWSED_DOCUMENTS,
  type BrowsedDocumentSummary,
} from '../src/domain/browse/entryModel';

function summary(overrides: Partial<BrowsedDocumentSummary> & { documentId: string; kind: 'card' | 'box' }): BrowsedDocumentSummary {
  return {
    source: `chips-resource://ws/素材/${overrides.documentId}`,
    title: `资源${overrides.documentId}`,
    digest: `digest-${overrides.documentId}`,
    ...overrides,
  };
}

describe('浏览记录收录（§2.3 位置清单）', () => {
  it('按 documentId 幂等收录：重复打开整体替换并移至末位（最近打开在后）', () => {
    let records = EMPTY_BROWSED_DOCUMENTS;
    records = addBrowsedDocument(records, summary({ documentId: 'a', kind: 'card' }));
    records = addBrowsedDocument(records, summary({ documentId: 'b', kind: 'box' }));
    expect(records.items.map((item) => item.documentId)).toEqual(['a', 'b']);
    records = addBrowsedDocument(records, summary({ documentId: 'a', kind: 'card', title: '资源a·重开' }));
    expect(records.items.map((item) => item.documentId)).toEqual(['b', 'a']);
    expect(findBrowsedDocument(records, 'a')?.title).toBe('资源a·重开');
    expect(findBrowsedDocument(records, 'missing')).toBeNull();
  });

  it('来源引用守卫：空白拒绝进入打开链', () => {
    expect(normalizeBrowseSource('  ')).toBeNull();
    expect(normalizeBrowseSource(' ~/文档/素材.box ')).toBe('~/文档/素材.box');
  });
});

describe('条目呈现投影（§四 条目视图）', () => {
  const entries = [
    { entry_id: 'e3', url: '.box/content/第三.card', enabled: true },
    { entry_id: 'e1', url: '.box/content/第一.card', enabled: false },
    { entry_id: 'e2', url: '.box/content/第二.card', enabled: true },
  ] as readonly Entry[];

  it('启用条目前置、名称按 zh 词序升序，名称取 url 末段', () => {
    expect(presentEntries(entries).map((entry) => entry.entryId)).toEqual(['e2', 'e3', 'e1']);
    expect(entryDisplayName(entries[0] as Entry)).toBe('第三.card');
  });

  it('分页切片与 document:read range 语义镜像：越界截断、非法入参返回空表', () => {
    expect(sliceEntriesPage(entries, 0, 2)).toHaveLength(2);
    expect(sliceEntriesPage(entries, 2, 10)).toHaveLength(1);
    expect(sliceEntriesPage(entries, 9, 2)).toEqual([]);
    expect(sliceEntriesPage(entries, -1, 2)).toEqual([]);
    expect(sliceEntriesPage(entries, 0, 0)).toEqual([]);
  });
});

describe('属性呈现（§4.6 详情面）', () => {
  it('结构化标签拍平为「键：值」展示串；未声明标签呈现为空集', () => {
    expect(flattenTag(['作者', '薯片'])).toBe('作者：薯片');
    expect(flattenTags(undefined)).toEqual([]);
  });

  it('卡片结构计数取自 manifest 字段（不自造计数）', () => {
    const structure = {
      structure: [{ id: 'node000001', type: 'richtext' }],
      manifest: { card_count: 1, resource_count: 4 },
    } as unknown as StructureModel;
    expect(structureResourceCounts(structure)).toEqual({ cardCount: 1, resourceCount: 4 });
  });
});
