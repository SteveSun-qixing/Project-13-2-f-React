import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  fixtureDates,
  makeBox,
  makeCard,
  type FakeState,
  type TestHarness,
} from './helpers/harness.js';
import type { BoxDetailDto, BoxSummaryDto } from '../src/services/box.service.js';

/**
 * 箱子内容只读域契约测试（《12 契约》§4.3 逐字段断言 + §4.3.2 条目引用匹配）。
 * 服务器不解包 .box（PS-4）：查看文档与条目匹配一律使用客户端提交的 structure。
 */

const SUMMARY_KEYS = [
  'coverRatio',
  'coverUrl',
  'createdAt',
  'documentUrl',
  'id',
  'layoutPlugin',
  'title',
  'visibility',
].sort();

describe('GET /api/v1/boxes（公开列表，契约 §4.3.1）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    const state: FakeState = {
      cards: [],
      boxes: [
        makeBox({ id: 'box-1', title: '早的箱子', createdAt: fixtureDates.a }),
        makeBox({
          id: 'box-2',
          title: '新的箱子',
          createdAt: fixtureDates.c,
          coverUrl: '/api/v1/boxes/box-2/cover',
          documentUrl: '/api/v1/boxes/box-2/view',
          coverRatio: '3:4',
          layoutPlugin: 'chips-official.grid-layout',
        }),
        makeBox({
          id: 'box-3',
          title: '私密箱子',
          visibility: 'private',
          createdAt: fixtureDates.b,
        }),
      ],
    };
    harness = await buildTestApp({ state });
    app = harness.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('列表 DTO 逐字段对齐契约 §4.3.1，仅公开、createdAt 倒序、pagination 四字段', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/boxes' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      data: BoxSummaryDto[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>();
    expect(Object.keys(body)).toEqual(['data', 'pagination']);
    expect(Object.keys(body.data[0] as BoxSummaryDto).sort()).toEqual(SUMMARY_KEYS);
    expect(body.data.map((item) => item.id)).toEqual(['box-2', 'box-1']);
    expect(body.data[0]).toMatchObject({
      id: 'box-2',
      title: '新的箱子',
      coverUrl: '/api/v1/boxes/box-2/cover',
      documentUrl: '/api/v1/boxes/box-2/view',
      coverRatio: '3:4',
      layoutPlugin: 'chips-official.grid-layout',
      visibility: 'public',
      createdAt: '2026-09-03T00:00:00.000Z',
    });
    expect(body.pagination).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
  });

  it('私密箱子与不存在一律 404 BOX_NOT_FOUND，不可区分（§3.1.4）', async () => {
    const priv = await app.inject({ method: 'GET', url: '/api/v1/boxes/box-3' });
    const missing = await app.inject({ method: 'GET', url: '/api/v1/boxes/box-absent' });
    expect(priv.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    expect(priv.json<{ error: { code: string } }>().error.code).toBe('BOX_NOT_FOUND');
    expect(missing.json<{ error: { code: string } }>().error.code).toBe('BOX_NOT_FOUND');
  });
});

describe('GET /api/v1/boxes/:boxId（详情 + 条目引用匹配，契约 §4.3.2）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    const state: FakeState = {
      cards: [
        // 匹配目标：公开就绪 + cardFileId 对应
        makeCard({
          id: 'card-match-1',
          cardFileId: 'Ab3Cd4Ef5g',
          status: 'ready',
          title: '命中卡片一',
        }),
        // 未渲染卡片即使公开也不匹配（匹配只取 ready）
        makeCard({ id: 'card-pending', cardFileId: 'Zz9Yy8Xx7w', status: 'pending' }),
        // 私密卡片不匹配（§3.1.4）
        makeCard({
          id: 'card-private',
          cardFileId: 'Pp1Qq2Rr3s',
          status: 'ready',
          visibility: 'private',
        }),
      ],
      boxes: [
        makeBox({
          id: 'box-full',
          boxFileId: 'Bo9Xx8Yy7z',
          title: '<脚本>箱子',
          documentUrl: '/api/v1/boxes/box-full/view',
          coverRatio: null,
          fileSizeBytes: 8192,
          metadata: {
            box_id: 'Bo9Xx8Yy7z',
            name: '<脚本>箱子',
            description: '描述 <b>加粗</b>',
            cover_ratio: '1:1',
            active_layout_type: 'chips-official.grid-layout',
          },
          structure: {
            entries: [
              {
                entry_id: 'entry-1',
                url: 'assets/docs/a.html',
                enabled: true,
                snapshot: {
                  document_id: 'Ab3Cd4Ef5g',
                  title: '包内条目',
                  content_type: 'richtext',
                },
              },
              {
                entry_id: 'entry-2',
                url: 'https://example.com/page',
                enabled: true,
                snapshot: { document_id: 'Zz9Yy8Xx7w' },
              },
              {
                entry_id: 'entry-3',
                url: 'chips-resource://res-1',
                enabled: false,
                snapshot: { document_id: 'Pp1Qq2Rr3s', title: '私密目标' },
              },
              { entry_id: 'entry-4', url: 'assets/imgs/b.png', enabled: true },
            ],
          },
        }),
      ],
    };
    harness = await buildTestApp({ state });
    app = harness.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('详情 DTO 逐字段对齐契约 §4.3.2（列表字段 + boxFileId/fileSizeBytes/metadata/updatedAt/cards）', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/boxes/box-full' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: BoxDetailDto }>();
    expect(Object.keys(body.data).sort()).toEqual(
      [...SUMMARY_KEYS, 'boxFileId', 'fileSizeBytes', 'metadata', 'updatedAt', 'cards'].sort()
    );
    expect(body.data.boxFileId).toBe('Bo9Xx8Yy7z');
    expect(body.data.fileSizeBytes).toBe(8192);
    expect(body.data.metadata).toMatchObject({ box_id: 'Bo9Xx8Yy7z', name: '<脚本>箱子' });
    // coverRatio 空时回退 metadata.cover_ratio（§4.3.1 字段语义）
    expect(body.data.coverRatio).toBe('1:1');
  });

  it('cards[] 条目逐字段断言：匹配公开就绪卡片携带 communityCardId/communityViewUrl', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/boxes/box-full' });
    const body = response.json<{ data: BoxDetailDto }>();
    const entries = body.data.cards;
    expect(entries).toHaveLength(4);

    const matched = entries.find((entry) => entry.entry_id === 'entry-1') as unknown as Record<
      string,
      unknown
    >;
    expect(matched).toMatchObject({
      entry_id: 'entry-1',
      url: 'assets/docs/a.html',
      document_id: 'Ab3Cd4Ef5g',
      title: '包内条目',
      content_type: 'richtext',
      embedded: true,
      communityCardId: 'card-match-1',
      communityViewUrl: '/api/v1/cards/card-match-1/view',
    });
    // 就绪公开匹配之外不得泄露其它字段
    expect(Object.keys(matched).sort()).toEqual(
      [
        'communityCardId',
        'communityViewUrl',
        'content_type',
        'document_id',
        'embedded',
        'entry_id',
        'title',
        'url',
      ].sort()
    );
  });

  it('未渲染与私密卡片不匹配；外部绝对 URL embedded=false；无 snapshot 条目仅回填必填字段', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/boxes/box-full' });
    const body = response.json<{ data: BoxDetailDto }>();
    const entries = body.data.cards;

    const pendingTarget = entries.find(
      (entry) => entry.entry_id === 'entry-2'
    ) as unknown as Record<string, unknown>;
    expect(pendingTarget.embedded).toBe(false);
    expect(pendingTarget).not.toHaveProperty('communityCardId');
    expect(pendingTarget).not.toHaveProperty('title');
    expect(pendingTarget).not.toHaveProperty('content_type');

    const privateTarget = entries.find(
      (entry) => entry.entry_id === 'entry-3'
    ) as unknown as Record<string, unknown>;
    expect(privateTarget.embedded).toBe(false);
    expect(privateTarget).not.toHaveProperty('communityCardId');
    expect(privateTarget.title).toBe('私密目标');

    const bare = entries.find((entry) => entry.entry_id === 'entry-4') as unknown as Record<
      string,
      unknown
    >;
    expect(bare.embedded).toBe(true);
    expect(bare).not.toHaveProperty('document_id');
  });

  it('只读文档返回 200 text/html，条目链接与标题转义（XSS 安全）', async () => {
    const view = await app.inject({ method: 'GET', url: '/api/v1/boxes/box-full/view' });
    expect(view.statusCode).toBe(200);
    expect(view.headers['content-type']).toContain('text/html');
    expect(view.body).toContain('<h1>&lt;脚本&gt;箱子</h1>');
    expect(view.body).toContain('描述 &lt;b&gt;加粗&lt;/b&gt;');
    expect(view.body).toContain('href="/cards/card-match-1"');
    expect(view.body).not.toContain('<script>');
  });
});

describe('箱子缺省结构兜底（读侧对空 structure 的鲁棒性）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    const state: FakeState = {
      cards: [],
      boxes: [
        makeBox({
          id: 'box-bare',
          title: '空箱子',
          documentUrl: '/api/v1/boxes/box-bare/view',
          structure: { entries: [] },
        }),
      ],
    };
    harness = await buildTestApp({ state });
    app = harness.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('structure.entries 为空时详情 cards=[]，文档含「暂无条目」', async () => {
    const detail = await app.inject({ method: 'GET', url: '/api/v1/boxes/box-bare' });
    const detailBody = detail.json<{ data: BoxDetailDto }>();
    expect(detailBody.data.cards).toEqual([]);

    const view = await app.inject({ method: 'GET', url: '/api/v1/boxes/box-bare/view' });
    expect(view.body).toContain('暂无条目');
  });

  it('structure 为 null（发布事务未提交）时按空条目处理，不抛错', async () => {
    const state: FakeState = {
      cards: [],
      boxes: [makeBox({ id: 'box-null', title: '空结构箱子' })],
    };
    const local = await buildTestApp({ state });
    const view = await local.app.inject({ method: 'GET', url: '/api/v1/boxes/box-null/view' });
    expect(view.statusCode).toBe(200);
    expect(view.body).toContain('暂无条目');
    await local.app.close();
  });
});
