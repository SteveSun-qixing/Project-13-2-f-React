import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BoxService } from '../src/services/box.service.js';
import {
  buildTestApp,
  makeBox,
  makeCard,
  type FakeState,
  type TestHarness,
} from './helpers/harness.js';
import type { BoxStructure } from '../src/types/box.js';

/**
 * 箱子域服务纯逻辑测试（真实形态夹具）：条目引用匹配、内嵌判定、
 * 只读文档渲染。数据面一律经内存 fake 仓库。
 */

describe('BoxService：条目引用匹配（契约 §4.3.2）', () => {
  let harness: TestHarness;
  let service: BoxService;

  beforeAll(async () => {
    const state: FakeState = {
      cards: [
        makeCard({ id: 'card-hit', cardFileId: 'Ab3Cd4Ef5g', status: 'ready' }),
        makeCard({ id: 'card-pending', cardFileId: 'Zz9Yy8Xx7w', status: 'pending' }),
        makeCard({
          id: 'card-private',
          cardFileId: 'Pp1Qq2Rr3s',
          status: 'ready',
          visibility: 'private',
        }),
      ],
      boxes: [],
    };
    harness = await buildTestApp({ state });
    service = new BoxService({
      boxRepository: harness.repositories.boxes,
      cardRepository: harness.repositories.cards,
    });
  });

  afterAll(async () => {
    await harness.app.close();
  });

  it('只匹配公开就绪卡片；同 document_id 多条目均命中', async () => {
    const structure: BoxStructure = {
      entries: [
        {
          entry_id: 'e1',
          url: 'assets/a.html',
          enabled: true,
          snapshot: { document_id: 'Ab3Cd4Ef5g' },
        },
        {
          entry_id: 'e2',
          url: 'assets/b.html',
          enabled: true,
          snapshot: { document_id: 'Ab3Cd4Ef5g' },
        },
        {
          entry_id: 'e3',
          url: 'https://x.example',
          enabled: true,
          snapshot: { document_id: 'Zz9Yy8Xx7w' },
        },
        {
          entry_id: 'e4',
          url: 'chips-resource://r',
          enabled: true,
          snapshot: { document_id: 'Pp1Qq2Rr3s' },
        },
      ],
    };
    const entries = await service.enrichCardRefs(structure);
    expect(entries.filter((entry) => entry.communityCardId === 'card-hit')).toHaveLength(2);
    expect(entries.find((entry) => entry.entry_id === 'e3')?.communityCardId).toBeUndefined();
    expect(entries.find((entry) => entry.entry_id === 'e4')?.communityCardId).toBeUndefined();
  });

  it('embedded 判定：scheme:// 形式为外部引用，包内相对路径为内嵌', async () => {
    const structure: BoxStructure = {
      entries: [
        { entry_id: 'rel', url: 'assets/img/a.png', enabled: true },
        { entry_id: 'abs', url: 'https://example.com/page', enabled: true },
        { entry_id: 'res', url: 'chips-resource://res-1', enabled: true },
      ],
    };
    const entries = await service.enrichCardRefs(structure);
    expect(entries.find((entry) => entry.entry_id === 'rel')?.embedded).toBe(true);
    expect(entries.find((entry) => entry.entry_id === 'abs')?.embedded).toBe(false);
    expect(entries.find((entry) => entry.entry_id === 'res')?.embedded).toBe(false);
  });

  it('空条目与无 snapshot 条目返回必填字段视图', async () => {
    const empty = await service.enrichCardRefs({ entries: [] });
    expect(empty).toEqual([]);

    const bare = await service.enrichCardRefs({
      entries: [{ entry_id: 'only', url: 'x.html', enabled: false }],
    });
    expect(bare).toEqual([{ entry_id: 'only', url: 'x.html', embedded: true }]);
  });
});

describe('BoxService：只读文档渲染（契约 §4.3.3）', () => {
  let harness: TestHarness;
  let service: BoxService;

  beforeAll(async () => {
    harness = await buildTestApp();
    service = new BoxService({
      boxRepository: harness.repositories.boxes,
      cardRepository: harness.repositories.cards,
    });
  });

  afterAll(async () => {
    await harness.app.close();
  });

  it('标题/描述/URL 全量转义，命中条目渲染站内链接', async () => {
    harness.state.boxes.push(
      makeBox({
        id: 'box-doc',
        title: '"引号"箱子',
        metadata: { name: '"引号"箱子', description: "单'引<号>" },
        structure: {
          entries: [
            {
              entry_id: 'e1',
              url: 'https://example.com/?a=1&b=2',
              enabled: true,
              snapshot: { document_id: 'Ab3Cd4Ef5g', title: '外部<b>条目' },
            },
            { entry_id: 'e2', url: 'assets/c.html', enabled: true },
          ],
        },
      })
    );
    const box = harness.state.boxes[0] as ReturnType<typeof makeBox>;
    const html = await service.renderDocumentHtml(box);
    expect(html).toContain('<h1>&quot;引号&quot;箱子</h1>');
    expect(html).toContain('单&#39;引&lt;号&gt;');
    expect(html).toContain('外部&lt;b&gt;条目');
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');
    expect(html).toContain('内嵌：assets/c.html');
  });

  it('标题缺省回落 metadata.name 与「未命名箱子」', async () => {
    harness.state.boxes.push(
      makeBox({ id: 'box-blank', title: '', metadata: { name: '来自元数据' } })
    );
    harness.state.boxes.push(makeBox({ id: 'box-none', title: '' }));
    const fromMetadata = await service.renderDocumentHtml(
      harness.state.boxes[1] as ReturnType<typeof makeBox>
    );
    expect(fromMetadata).toContain('<h1>来自元数据</h1>');
    const unnamed = await service.renderDocumentHtml(
      harness.state.boxes[2] as ReturnType<typeof makeBox>
    );
    expect(unnamed).toContain('<h1>未命名箱子</h1>');
  });
});
