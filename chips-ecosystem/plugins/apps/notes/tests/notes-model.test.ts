import { describe, expect, it } from 'vitest';
import type { Entry, StructureModel } from '@chips/sdk';
import {
  addDocument,
  contentNodeDisplay,
  countEntriesByEnabled,
  EMPTY_NOTES_LIBRARY,
  entryDisplayName,
  findDocument,
  flattenTag,
  flattenTags,
  normalizeDocumentSource,
  structureNodeIds,
  type OpenedDocumentSummary,
} from '../src/domain/notes/model';

function summary(overrides: Partial<OpenedDocumentSummary> & { documentId: string; kind: 'card' | 'box' }): OpenedDocumentSummary {
  return {
    source: `chips-resource://ws/演示/${overrides.documentId}`,
    title: `文档${overrides.documentId}`,
    digest: `digest-${overrides.documentId}`,
    ...overrides,
  };
}

describe('笔记库分区与幂等收录', () => {
  it('按 kind 分区收录：box 进笔记本、card 进笔记，区内按标题排序', () => {
    let library = EMPTY_NOTES_LIBRARY;
    library = addDocument(library, summary({ documentId: 'b2', kind: 'box', title: '工作笔记' }));
    library = addDocument(library, summary({ documentId: 'b1', kind: 'box', title: '读书笔记' }));
    library = addDocument(library, summary({ documentId: 'n1', kind: 'card', title: '第一页' }));
    expect(library.notebooks.map((item) => item.documentId)).toEqual(['b1', 'b2']);
    expect(library.notes.map((item) => item.documentId)).toEqual(['n1']);
  });

  it('重复打开同一 documentId 幂等替换、不重复计数', () => {
    let library = EMPTY_NOTES_LIBRARY;
    library = addDocument(library, summary({ documentId: 'b1', kind: 'box', title: '旧名' }));
    library = addDocument(library, summary({ documentId: 'b1', kind: 'box', title: '新名' }));
    expect(library.notebooks).toHaveLength(1);
    expect(library.notebooks[0]?.title).toBe('新名');
  });

  it('按 documentId 查找覆盖两个分区，未收录返回 null', () => {
    let library = EMPTY_NOTES_LIBRARY;
    library = addDocument(library, summary({ documentId: 'n1', kind: 'card' }));
    expect(findDocument(library, 'n1')?.kind).toBe('card');
    expect(findDocument(library, 'missing')).toBeNull();
  });
});

describe('标签与条目呈现', () => {
  it('结构化标签拍平为「键：值」展示串', () => {
    expect(flattenTag('随笔')).toBe('随笔');
    expect(flattenTag(['作者', '薯片'])).toBe('作者：薯片');
    expect(flattenTags(['随笔', ['主题', '读书']])).toEqual(['随笔', '主题：读书']);
    expect(flattenTags(undefined)).toEqual([]);
  });

  it('条目展示名取 url 末段，空段过滤', () => {
    const entry = { entry_id: 'e1', url: '.box/content/first.yaml', enabled: true } as Entry;
    expect(entryDisplayName(entry)).toBe('first.yaml');
    expect(entryDisplayName({ entry_id: 'e2', url: 'root.card', enabled: true })).toBe('root.card');
  });

  it('条目按启用状态分组计数', () => {
    const entries = [
      { entry_id: 'a', url: 'a.card', enabled: true },
      { entry_id: 'b', url: 'b.card', enabled: false },
      { entry_id: 'c', url: 'c.card', enabled: true },
    ] as readonly Entry[];
    expect(countEntriesByEnabled(entries)).toEqual({ enabled: 2, disabled: 1 });
    expect(countEntriesByEnabled([])).toEqual({ enabled: 0, disabled: 0 });
  });
});

describe('结构与内容呈现', () => {
  it('结构清单映射内容节点编号（读取序与清单序一致）', () => {
    const structure = {
      structure: [
        { id: 'node000001', type: 'richtext' },
        { id: 'node000002', type: 'image' },
      ],
      manifest: { card_count: 2, resource_count: 0 },
    } as unknown as StructureModel;
    expect(structureNodeIds(structure)).toEqual(['node000001', 'node000002']);
  });

  it('内容节点载荷以结构化 JSON 文本呈现（不猜解插件专有字段）', () => {
    expect(
      contentNodeDisplay({
        node_id: 'node000001',
        file: 'content/node000001.yaml',
        card_type: 'base.richtext',
        value: { ops: [{ insert: '第一段' }] },
        diagnostics: [],
      }),
    ).toBe(JSON.stringify({ ops: [{ insert: '第一段' }] }, null, 2));
  });
});

describe('来源引用守卫', () => {
  it('空白输入拒绝进入打开链，非空白输入去首尾空白', () => {
    expect(normalizeDocumentSource('   ')).toBeNull();
    expect(normalizeDocumentSource('')).toBeNull();
    expect(normalizeDocumentSource(' ~/文档/示例.card ')).toBe('~/文档/示例.card');
  });
});
