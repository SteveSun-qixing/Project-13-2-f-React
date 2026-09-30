import { describe, expect, it } from 'vitest';
import type { IDirectoryEntryRef, IDocumentTreeNode } from '../src/config';
import {
  DEFAULT_CONFIG,
  MAX_TREE_DEPTH,
  buildDirectoryTree,
  collectConfiguredEntryIds,
  deriveAssetRefs,
  flattenVisibleTree,
  hasFrameRegionContent,
  indentNodeInTree,
  isSafeBoxAssetPath,
  moveNodeInTree,
  outdentNodeInTree,
  readConfig,
  removeNodeAtPath,
  toCoverAspectRatio,
  validateConfig,
} from '../src/config';

function createEntryRef(
  entryId: string,
  displayTitle: string,
  overrides: Partial<IDirectoryEntryRef> = {}
): IDirectoryEntryRef {
  return { entry_id: entryId, displayTitle, enabled: true, ...overrides };
}

function createNode(overrides: Partial<IDocumentTreeNode>): IDocumentTreeNode {
  return { id: 'node', collapsed: false, children: [], ...overrides };
}

/** 构造绕过类型面的原始节点（供校验拒绝用例使用）。 */
function rawNode(overrides: Record<string, unknown>): unknown {
  return { id: 'node', collapsed: false, children: [], ...overrides };
}

describe('validateConfig', () => {
  it('接受空配置、缺省字段与完整合法配置', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig(null)).toBe(true);
    expect(validateConfig({})).toBe(true);
    expect(
      validateConfig({
        sort_mode: 'name-asc',
        sidebar_width: 'wide',
        show_summary: false,
        tree_nodes: [
          {
            id: 'chapter-1',
            titleOverride: '第一章',
            collapsed: true,
            children: [
              { id: 'doc-1', entryId: 'e1', presentation: 'content', collapsed: false, children: [] },
            ],
          },
        ],
        background: { mode: 'image', assetPath: 'assets/layouts/bg.png' },
        top_region: { mode: 'html', html: '<section>顶部</section>' },
      })
    ).toBe(true);
  });

  it('拒绝非对象与非法标量字段', () => {
    expect(validateConfig('document-library')).toBe(false);
    expect(validateConfig({ sort_mode: 'random' })).toBe(false);
    expect(validateConfig({ sidebar_width: 'giant' })).toBe(false);
    expect(validateConfig({ show_summary: 'yes' })).toBe(false);
  });

  it('拒绝结构非法的目录树', () => {
    expect(validateConfig({ tree_nodes: 'root' })).toBe(false);
    expect(validateConfig({ tree_nodes: [{ collapsed: false, children: [] }] })).toBe(false);
    expect(validateConfig({ tree_nodes: [createNode({ id: '  ' })] })).toBe(false);
    expect(validateConfig({ tree_nodes: [createNode({ id: 'x'.repeat(121) })] })).toBe(false);
    expect(
      validateConfig({ tree_nodes: [createNode({ id: 'group', presentation: 'content' })] })
    ).toBe(false);
    expect(
      validateConfig({ tree_nodes: [rawNode({ id: 'doc', entryId: 'e1', presentation: 'flip' })] })
    ).toBe(false);
    expect(
      validateConfig({ tree_nodes: [createNode({ id: 'doc', entryId: ' ' })] })
    ).toBe(false);
    expect(
      validateConfig({
        tree_nodes: [createNode({ id: 'doc', entryId: 'e'.repeat(161) })],
      })
    ).toBe(false);
    expect(validateConfig({ tree_nodes: [rawNode({ id: 'doc', collapsed: 'no' })] })).toBe(false);
    expect(validateConfig({ tree_nodes: [rawNode({ id: 'doc', children: 'kids' })] })).toBe(false);
    expect(
      validateConfig({ tree_nodes: [rawNode({ id: 'doc', titleOverride: 3 })] })
    ).toBe(false);
  });

  it('拒绝重复节点标识与超限层级、节点数', () => {
    expect(
      validateConfig({
        tree_nodes: [createNode({ id: 'same' }), createNode({ id: 'same' })],
      })
    ).toBe(false);
    expect(
      validateConfig({
        tree_nodes: [
          createNode({
            id: 'root',
            children: [createNode({ id: 'leaf' })],
          }),
        ],
      })
    ).toBe(true);

    let deep: IDocumentTreeNode = createNode({ id: 'leaf' });
    for (let depth = 0; depth < MAX_TREE_DEPTH; depth += 1) {
      deep = createNode({ id: `level-${depth}`, children: [deep] });
    }
    expect(validateConfig({ tree_nodes: [deep] })).toBe(false);
  });

  it('拒绝超过节点数上限的目录树', () => {
    const nodes: IDocumentTreeNode[] = [];
    for (let index = 0; index <= 500; index += 1) {
      nodes.push(createNode({ id: `n-${index}` }));
    }
    expect(validateConfig({ tree_nodes: nodes })).toBe(false);
  });

  it('校验背景与顶部区域形状', () => {
    expect(validateConfig({ background: { mode: 'none' } })).toBe(true);
    expect(validateConfig({ background: { mode: 'image', assetPath: 'assets/bg.png' } })).toBe(true);
    expect(validateConfig({ background: { mode: 'image' } })).toBe(false);
    expect(validateConfig({ background: { mode: 'image', assetPath: '/etc/passwd' } })).toBe(false);
    expect(validateConfig({ background: { mode: 'image', assetPath: 'assets/../x.png' } })).toBe(
      false
    );
    expect(validateConfig({ top_region: { mode: 'html', html: '<p>顶部</p>' } })).toBe(true);
    expect(validateConfig({ top_region: { mode: 'html', html: '   ' } })).toBe(false);
    expect(validateConfig({ top_region: { mode: 'video' } })).toBe(false);
    expect(validateConfig({ top_region: 'text' })).toBe(false);
  });
});

describe('配置归一与派生', () => {
  it('归一非法字段回退默认值', () => {
    expect(readConfig({ sort_mode: 'random' })).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ sidebar_width: 'giant' }).sidebar_width).toBe('regular');
    expect(readConfig({ show_summary: 'yes' }).show_summary).toBe(true);
    expect(
      readConfig({ background: { mode: 'image', assetPath: 'https://evil/x.png' } }).background
    ).toEqual({ mode: 'image' });
    expect(readConfig({ top_region: { mode: 'html', html: '<p>顶部</p>' } }).top_region).toEqual({
      mode: 'html',
      html: '<p>顶部</p>',
    });
  });

  it('归一目录树：回退标识、去重兜底、截断与展示方式补齐', () => {
    const config = readConfig({
      tree_nodes: [
        {
          id: '  chapter-1  ',
          entryId: '  e1  ',
          titleOverride: '  第一章  ',
          presentation: 'cover',
          collapsed: true,
          children: [{ entryId: 'e1', collapsed: false, children: [] }, { id: 'chapter-1', collapsed: false }],
        },
        { titleOverride: '目录', collapsed: 'no' },
      ],
    });
    expect(config.tree_nodes).toEqual([
      {
        id: 'chapter-1',
        entryId: 'e1',
        titleOverride: '第一章',
        presentation: 'cover',
        collapsed: true,
        children: [
          {
            id: 'chapter-1-1',
            entryId: 'e1',
            presentation: 'content',
            collapsed: false,
            children: [],
          },
          { id: 'chapter-1-2', collapsed: false, children: [] },
        ],
      },
      { id: 'node-2', titleOverride: '目录', collapsed: false, children: [] },
    ]);
  });

  it('目录节点不携带展示方式、层级与节点数按上限截断', () => {
    const config = readConfig({
      tree_nodes: [{ id: 'group', presentation: 'cover', collapsed: false, children: [] }],
    });
    expect(config.tree_nodes[0]).not.toHaveProperty('presentation');

    const wide: Record<string, unknown> = { id: 'root', collapsed: false, children: [] };
    let cursor: Record<string, unknown> = wide;
    for (let depth = 0; depth < 12; depth += 1) {
      const child: Record<string, unknown> = { id: `level-${depth}`, collapsed: false, children: [] };
      (cursor.children as unknown[]).push(child);
      cursor = child;
    }
    const deepConfig = readConfig({ tree_nodes: [wide] });
    let measured = 0;
    let node: IDocumentTreeNode | undefined = deepConfig.tree_nodes[0];
    while (node !== undefined) {
      measured += 1;
      node = node.children[0];
    }
    expect(measured).toBeLessThanOrEqual(MAX_TREE_DEPTH);

    const many: IDocumentTreeNode[] = [];
    for (let index = 0; index < 520; index += 1) {
      many.push(createNode({ id: `n-${index}` }));
    }
    expect(readConfig({ tree_nodes: many }).tree_nodes).toHaveLength(500);
  });

  it('派生去重的资源引用列表', () => {
    const config = readConfig({
      background: { mode: 'image', assetPath: 'assets/layouts/bg.png' },
      top_region: { mode: 'image', assetPath: 'assets/layouts/bg.png' },
    });
    expect(deriveAssetRefs(config)).toEqual(['assets/layouts/bg.png']);
    expect(deriveAssetRefs(DEFAULT_CONFIG)).toEqual([]);
  });

  it('安全路径与区域内容判定', () => {
    expect(isSafeBoxAssetPath('assets/layouts/bg.png')).toBe(true);
    expect(isSafeBoxAssetPath('/etc/passwd')).toBe(false);
    expect(isSafeBoxAssetPath('assets//bg.png')).toBe(false);
    expect(isSafeBoxAssetPath('assets/bg.png?a=1')).toBe(false);
    expect(hasFrameRegionContent({ mode: 'none' })).toBe(false);
    expect(hasFrameRegionContent({ mode: 'image', assetPath: 'assets/a.png' })).toBe(true);
    expect(hasFrameRegionContent({ mode: 'html', html: '  ' })).toBe(false);
  });

  it('封面态纵横比读取：layout_hints 优先、冒号转 CSS、非法回退 3/4', () => {
    expect(toCoverAspectRatio({ aspectRatio: 0.75 })).toBe('0.75');
    expect(toCoverAspectRatio({ aspectRatio: '3:4' })).toBe('3 / 4');
    expect(toCoverAspectRatio({ aspectRatio: '16 / 10' })).toBe('16 / 10');
    expect(toCoverAspectRatio({ aspectRatio: '   ' })).toBe('3 / 4');
    expect(toCoverAspectRatio(undefined)).toBe('3 / 4');
  });
});

describe('目录树模型（分组 / 排序 / 层级）', () => {
  it('收集已归档条目标识', () => {
    const nodes = [
      createNode({ id: 'g1', children: [createNode({ id: 'd1', entryId: 'e1' })] }),
      createNode({ id: 'd2', entryId: 'e2' }),
    ];
    expect(collectConfiguredEntryIds(nodes)).toEqual(new Set(['e1', 'e2']));
  });

  it('配置节点映射：标题覆盖优先、深度递增、缺失条目标记', () => {
    const tree = buildDirectoryTree({
      configNodes: [
        createNode({
          id: 'g1',
          titleOverride: '第一章',
          children: [createNode({ id: 'd1', entryId: 'e1' }), createNode({ id: 'missing', entryId: 'ghost', titleOverride: '幽灵文档' })],
        }),
      ],
      entries: [createEntryRef('e1', '旅行日记')],
      sortMode: 'manual',
    });
    expect(tree).toHaveLength(1);
    expect(tree[0]?.title).toBe('第一章');
    expect(tree[0]?.depth).toBe(0);
    expect(tree[0]?.missing).toBe(false);
    expect(tree[0]?.children).toHaveLength(2);
    expect(tree[0]?.children[0]?.title).toBe('旅行日记');
    expect(tree[0]?.children[0]?.depth).toBe(1);
    expect(tree[0]?.children[0]?.missing).toBe(false);
    expect(tree[0]?.children[1]?.title).toBe('幽灵文档');
    expect(tree[0]?.children[1]?.missing).toBe(true);
  });

  it('未归档条目追加在根层，禁用条目不呈现', () => {
    const tree = buildDirectoryTree({
      configNodes: [createNode({ id: 'd1', entryId: 'e1' })],
      entries: [
        createEntryRef('e1', '已归档'),
        createEntryRef('e2', '未归档'),
        createEntryRef('e3', '停用', { enabled: false }),
      ],
      sortMode: 'manual',
    });
    expect(tree.map((node) => node.title)).toEqual(['已归档', '未归档']);
    expect(tree[1]?.id).toBe('unconfigured-e2');
    expect(tree[1]?.configured).toBe(false);
    expect(tree[1]?.depth).toBe(0);
  });

  it('箱子条目固定封面呈现，卡片条目缺省内容呈现、可覆盖为封面', () => {
    const tree = buildDirectoryTree({
      configNodes: [
        createNode({ id: 'd1', entryId: 'e1' }),
        createNode({ id: 'd2', entryId: 'e2', presentation: 'cover' }),
        createNode({ id: 'd3', entryId: 'e3' }),
      ],
      entries: [
        createEntryRef('e1', '卡片一'),
        createEntryRef('e2', '卡片二'),
        createEntryRef('e3', '子箱子', { snapshot: { contentType: 'chips/box' } }),
      ],
      sortMode: 'manual',
    });
    expect(tree[0]?.presentation).toBe('content');
    expect(tree[1]?.presentation).toBe('cover');
    expect(tree[2]?.presentation).toBe('cover');
  });

  it('名称排序递归作用于各层级并按标识稳定兜底（简体中文习惯）', () => {
    const tree = buildDirectoryTree({
      configNodes: [
        createNode({
          id: 'g-b',
          titleOverride: '香蕉',
          children: [
            createNode({ id: 'c-2', titleOverride: '芒果' }),
            createNode({ id: 'c-1', titleOverride: '苹果' }),
          ],
        }),
        createNode({ id: 'g-a', titleOverride: '苹果' }),
      ],
      entries: [],
      sortMode: 'name-asc',
    });
    expect(tree.map((node) => node.title)).toEqual(['苹果', '香蕉']);
    expect(tree[1]?.children.map((node) => node.title)).toEqual(['芒果', '苹果']);
  });

  it('名称降序时同名层级仍按标识稳定升序兜底', () => {
    const tree = buildDirectoryTree({
      configNodes: [
        createNode({ id: 'b', titleOverride: '同名' }),
        createNode({ id: 'a', titleOverride: '同名' }),
      ],
      entries: [],
      sortMode: 'name-desc',
    });
    expect(tree.map((node) => node.id)).toEqual(['a', 'b']);
  });

  it('手动顺序保持配置顺序', () => {
    const configNodes = [
      createNode({ id: 'z', titleOverride: '甲' }),
      createNode({ id: 'a', titleOverride: '乙' }),
    ];
    expect(
      buildDirectoryTree({ configNodes, entries: [], sortMode: 'manual' }).map((node) => node.id)
    ).toEqual(['z', 'a']);
  });
});

describe('可见树扁平化与折叠覆盖', () => {
  const tree = buildDirectoryTree({
    configNodes: [
      createNode({
        id: 'g1',
        titleOverride: '组',
        collapsed: false,
        children: [
          createNode({ id: 'g1-a', entryId: 'e1' }),
          createNode({ id: 'g1-b', entryId: 'e2' }),
        ],
      }),
      createNode({ id: 'solo', titleOverride: '独立' }),
    ],
    entries: [createEntryRef('e1', '子一'), createEntryRef('e2', '子二')],
    sortMode: 'manual',
  });

  it('全展开时按深度扁平化', () => {
    const flat = flattenVisibleTree(tree, {});
    expect(flat.map((node) => node.id)).toEqual(['g1', 'g1-a', 'g1-b', 'solo']);
    expect(flat.map((node) => node.depth)).toEqual([0, 1, 1, 0]);
  });

  it('折叠节点隐藏全部后代', () => {
    const collapsed = tree.map((node) => (node.id === 'g1' ? { ...node, collapsed: true } : node));
    expect(flattenVisibleTree(collapsed, {}).map((node) => node.id)).toEqual(['g1', 'solo']);
  });

  it('会话折叠覆盖优先于配置默认值', () => {
    expect(flattenVisibleTree(tree, { g1: true }).map((node) => node.id)).toEqual(['g1', 'solo']);
    const collapsed = tree.map((node) => (node.id === 'g1' ? { ...node, collapsed: true } : node));
    expect(flattenVisibleTree(collapsed, { g1: false }).map((node) => node.id)).toEqual([
      'g1',
      'g1-a',
      'g1-b',
      'solo',
    ]);
  });
});

describe('目录树编辑纯操作', () => {
  const tree = [
    createNode({ id: 'a', titleOverride: '甲', children: [createNode({ id: 'a-1', titleOverride: '甲一' })] }),
    createNode({ id: 'b', titleOverride: '乙' }),
  ];

  it('路径更新与移除', () => {
    const updated = readConfig({
      tree_nodes: [{ id: 'a', collapsed: false, children: [] }],
    }).tree_nodes;
    expect(removeNodeAtPath(updated, [0]).removed?.id).toBe('a');
    expect(removeNodeAtPath(updated, [0]).nodes).toHaveLength(0);
  });

  it('上移与下移交换同级顺序并拒绝越界', () => {
    expect(moveNodeInTree(tree, [1], -1).map((node) => node.id)).toEqual(['b', 'a']);
    expect(moveNodeInTree(tree, [0], -1).map((node) => node.id)).toEqual(['a', 'b']);
    expect(moveNodeInTree(tree, [1], 1).map((node) => node.id)).toEqual(['a', 'b']);
  });

  it('缩进把节点挂到前一个同级之下，取消缩进归还父层', () => {
    const indented = indentNodeInTree(tree, [1]);
    expect(indented).toHaveLength(1);
    expect(indented[0]?.id).toBe('a');
    expect(indented[0]?.children.map((node) => node.id)).toEqual(['a-1', 'b']);
    expect(indentNodeInTree(tree, [0]).map((node) => node.id)).toEqual(['a', 'b']);

    const outdented = outdentNodeInTree(indented, [0, 1]);
    expect(outdented.map((node) => node.id)).toEqual(['a', 'b']);
    expect(outdented[0]?.children.map((node) => node.id)).toEqual(['a-1']);
    expect(outdentNodeInTree(tree, [0]).map((node) => node.id)).toEqual(['a', 'b']);
  });
});
