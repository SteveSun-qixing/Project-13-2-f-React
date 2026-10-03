import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestHarness,
  fixtureBox,
  fixtureCard,
  fixtureRoom,
  registerAccount,
  type TestHarness,
} from './helpers/harness.js';

/**
 * 箱子 / 房间 / 发现与检索契约（契约 §4.4、§4.6、§4.7、§6.1）。
 */

describe('箱子内容只读域契约', () => {
  let harness: TestHarness;
  let app: FastifyInstance;
  let author: Awaited<ReturnType<typeof registerAccount>>;

  beforeAll(async () => {
    harness = await buildTestHarness();
    app = harness.app;
    author = await registerAccount(app, { username: 'boxer' });
    harness.state.cards.push(
      fixtureCard({
        id: 'card-comm-0001',
        userId: author.userId,
        name: '被箱子引用的卡片',
        cardFileId: 'commCard01',
        status: 'ready',
        visibility: 'public',
      }),
      fixtureCard({
        id: 'card-comm-0002',
        userId: author.userId,
        name: '私有未命中卡片',
        cardFileId: 'commCard02',
        status: 'ready',
        visibility: 'private',
      })
    );
    harness.state.boxes.push(
      fixtureBox({
        id: 'box-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId: author.userId,
        name: '旅行合集 <第一卷>',
        description: '包含 "&" 特殊字符的简介',
        entries: [
          {
            entry_id: 'entry-1',
            url: 'https://external.example.test/some-card',
            snapshot: { title: '外部条目', document_id: 'extNoHit01', content_type: 'chips/card' },
          },
          {
            entry_id: 'entry-2',
            url: 'cards/inner.card',
            snapshot: { title: '内嵌条目', document_id: 'commCard01', content_type: 'chips/card' },
          },
          {
            entry_id: 'entry-3',
            url: 'boxes/inner.box',
            snapshot: { title: '未命中条目', document_id: 'commCard02', content_type: 'chips/box' },
          },
        ],
      })
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /boxes/:boxId：ICommunityBoxDetail 逐字段 + 条目装配（命中公开就绪卡片）', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/boxes/box-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: Record<string, unknown> }>();
    expect(Object.keys(body.data).sort()).toEqual([
      'activeLayoutType',
      'boxFileId',
      'chipStandardsVersion',
      'coverRatio',
      'coverUrl',
      'createdAt',
      'documentUrl',
      'entries',
      'fileSizeBytes',
      'id',
      'name',
      'roomId',
      'sha256',
      'status',
      'tags',
      'updatedAt',
      'user',
      'userId',
      'visibility',
    ]);
    expect(body.data['activeLayoutType']).toBe('chips.layout.grid');
    expect(body.data['documentUrl']).toBe(
      '/api/v1/boxes/box-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/view'
    );

    const entries = body.data['entries'] as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(3);
    // 外部条目：embedded=false，无命中
    expect(entries[0]).toMatchObject({
      entryId: 'entry-1',
      url: 'https://external.example.test/some-card',
      title: '外部条目',
      contentType: 'chips/card',
      embedded: false,
      communityCardId: null,
      communityViewUrl: null,
      communityRenderStatusUrl: null,
    });
    // 内嵌条目命中社区公开就绪卡片（document_id ↔ cardFileId）
    expect(entries[1]).toMatchObject({
      entryId: 'entry-2',
      embedded: true,
      communityCardId: 'card-comm-0001',
      communityViewUrl: '/api/v1/cards/card-comm-0001/view',
      communityRenderStatusUrl: '/api/v1/cards/card-comm-0001/render-status',
    });
    // 私有卡片不参与匹配（§4.6：仅公开且就绪）
    expect(entries[2]).toMatchObject({
      contentType: 'chips/box',
      communityCardId: null,
    });
  });

  it('GET /boxes/:boxId/view：text/html 只读文档，用户内容全部转义，社区卡片输出 /cards/:id 链接', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/boxes/box-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/view',
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    const html = response.body;
    expect(html).toContain('<title>旅行合集 &lt;第一卷&gt;</title>');
    expect(html).toContain('包含 &quot;&amp;&quot; 特殊字符的简介');
    expect(html).toContain('<a href="/cards/card-comm-0001">内嵌条目</a>');
    expect(html).toContain('https://external.example.test/some-card');
    expect(html).not.toContain('<script>');
  });

  it('私有箱子：匿名 404（不暴露存在性），作者可读', async () => {
    harness.state.boxes.push(
      fixtureBox({
        id: 'box-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        userId: author.userId,
        name: '私密箱子',
        visibility: 'private',
      })
    );
    const anon = await app.inject({
      method: 'GET',
      url: '/api/v1/boxes/box-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(anon.statusCode).toBe(404);
    expect(anon.json<{ error: { code: string } }>().error.code).toBe('COMMUNITY_BOX_NOT_FOUND');
    const self = await app.inject({
      method: 'GET',
      url: '/api/v1/boxes/box-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      headers: authHeader(author.accessToken),
    });
    expect(self.statusCode).toBe(200);
  });
});

describe('房间只读契约', () => {
  let harness: TestHarness;
  let app: FastifyInstance;
  let owner: Awaited<ReturnType<typeof registerAccount>>;

  beforeAll(async () => {
    harness = await buildTestHarness();
    app = harness.app;
    owner = await registerAccount(app, { username: 'roomer' });
    harness.state.rooms.push(
      fixtureRoom({
        id: 'room-cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        userId: owner.userId,
        name: '旅行房间',
        slug: 'travel',
        description: '公开房间',
      })
    );
    harness.state.cards.push(
      fixtureCard({
        id: 'card-room-1',
        userId: owner.userId,
        name: '房内公开就绪',
        cardFileId: 'roomCard01',
        roomId: 'room-cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'ready',
        visibility: 'public',
        createdAt: new Date(Date.parse('2026-09-20T00:00:00.000Z')),
      }),
      fixtureCard({
        id: 'card-room-2',
        userId: owner.userId,
        name: '房内未就绪',
        cardFileId: 'roomCard02',
        roomId: 'room-cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'pending',
        visibility: 'public',
        createdAt: new Date(Date.parse('2026-09-21T00:00:00.000Z')),
      })
    );
    harness.state.boxes.push(
      fixtureBox({
        id: 'box-room-1',
        userId: owner.userId,
        name: '房内箱子',
        roomId: 'room-cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'ready',
        visibility: 'public',
        createdAt: new Date(Date.parse('2026-09-22T00:00:00.000Z')),
      })
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /rooms/:roomId：ICommunityRoom 逐字段，计数为请求者可见数量', async () => {
    const anon = await app.inject({
      method: 'GET',
      url: '/api/v1/rooms/room-cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    expect(anon.statusCode).toBe(200);
    const body = anon.json<{ data: Record<string, unknown> }>();
    // ICommunityRoom 字段集（契约 §4.4）；断言按字母序排列。
    expect(Object.keys(body.data).sort()).toEqual([
      'boxCount',
      'cardCount',
      'coverUrl',
      'createdAt',
      'description',
      'id',
      'name',
      'slug',
      'updatedAt',
      'userId',
      'visibility',
    ]);
    // 访客视角：未就绪不计入可见数量
    expect(body.data['cardCount']).toBe(1);
    expect(body.data['boxCount']).toBe(1);

    const self = await app.inject({
      method: 'GET',
      url: '/api/v1/rooms/room-cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      headers: authHeader(owner.accessToken),
    });
    const selfBody = self.json<{ data: { cardCount: number; boxCount: number } }>();
    // 本人视角：全量计数（含未就绪）
    expect(selfBody.data.cardCount).toBe(2);
  });

  it('GET /rooms/:roomId/contents：type 区分的混排分页视图，createdAt 倒序', async () => {
    // owner 视角：total=3（含未就绪卡片，§4.1 本人列表口径）
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/rooms/room-cccccccc-cccc-4ccc-8ccc-cccccccccccc/contents?page=1&pageSize=2',
      headers: authHeader(owner.accessToken),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      data: Array<{ type: string; id?: string }>;
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>();
    expect(body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(body.data).toHaveLength(2);
    // 倒序：箱子（09-22）→ 未就绪卡片（09-21，owner 视角才可见；访客视角 total=2）
    const anon = await app.inject({
      method: 'GET',
      url: '/api/v1/rooms/room-cccccccc-cccc-4ccc-8ccc-cccccccccccc/contents?page=1&pageSize=2',
    });
    const anonBody = anon.json<{
      data: Array<{ type: string; id: string }>;
      pagination: { total: number };
    }>();
    expect(anonBody.pagination.total).toBe(2);
    expect(anonBody.data[0]).toMatchObject({ type: 'box', id: 'box-room-1' });
    expect(anonBody.data[1]).toMatchObject({ type: 'card', id: 'card-room-1' });
  });

  it('私有房间：匿名 404，所有者可读', async () => {
    harness.state.rooms.push(
      fixtureRoom({
        id: 'room-dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        userId: owner.userId,
        name: '私密房间',
        slug: 'secret',
        visibility: 'private',
      })
    );
    const anon = await app.inject({
      method: 'GET',
      url: '/api/v1/rooms/room-dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    });
    expect(anon.statusCode).toBe(404);
    expect(anon.json<{ error: { code: string } }>().error.code).toBe('COMMUNITY_ROOM_NOT_FOUND');
    const self = await app.inject({
      method: 'GET',
      url: '/api/v1/rooms/room-dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      headers: authHeader(owner.accessToken),
    });
    expect(self.statusCode).toBe(200);
  });
});

describe('发现与检索契约（§4.7、§6.1）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    harness = await buildTestHarness();
    app = harness.app;
    const author = await registerAccount(app, { username: 'finder' });
    harness.state.cards.push(
      fixtureCard({
        id: 'card-disc-1',
        userId: author.userId,
        name: '东京旅记',
        cardFileId: 'discCard01',
        tags: ['旅行'],
        status: 'ready',
        visibility: 'public',
        createdAt: new Date(Date.parse('2026-09-01T00:00:00.000Z')),
      }),
      fixtureCard({
        id: 'card-disc-2',
        userId: author.userId,
        name: '家庭相册',
        cardFileId: 'discCard02',
        status: 'ready',
        visibility: 'public',
        createdAt: new Date(Date.parse('2026-09-02T00:00:00.000Z')),
      }),
      fixtureCard({
        id: 'card-disc-3',
        userId: author.userId,
        name: '私密东京',
        cardFileId: 'discCard03',
        tags: ['旅行'],
        status: 'ready',
        visibility: 'private',
        createdAt: new Date(Date.parse('2026-09-03T00:00:00.000Z')),
      })
    );
    harness.state.boxes.push(
      fixtureBox({
        id: 'box-disc-1',
        userId: author.userId,
        name: '东京箱子',
        tags: ['旅行'],
        status: 'ready',
        visibility: 'public',
        createdAt: new Date(Date.parse('2026-09-04T00:00:00.000Z')),
      })
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /discover/cards：公开就绪、createdAt 倒序、pagination 四字段', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/discover/cards' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      data: Array<{ id: string; name: string }>;
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>();
    expect(body.data.map((card) => card.id)).toEqual(['card-disc-2', 'card-disc-1']);
    expect(body.pagination).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
  });

  it('GET /discover/boxes 同口径', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/discover/boxes' });
    const body = response.json<{ data: Array<{ id: string }>; pagination: { total: number } }>();
    expect(body.data.map((box) => box.id)).toEqual(['box-disc-1']);
    expect(body.pagination.total).toBe(1);
  });

  it('非法分页参数 → 400 COMMUNITY_VALIDATION_ERROR；超出总页数 → 空数组与正确分页对象', async () => {
    const bad = await app.inject({ method: 'GET', url: '/api/v1/discover/cards?page=0' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json<{ error: { code: string } }>().error.code).toBe('COMMUNITY_VALIDATION_ERROR');

    const badSize = await app.inject({ method: 'GET', url: '/api/v1/discover/cards?pageSize=101' });
    expect(badSize.statusCode).toBe(400);

    const beyond = await app.inject({
      method: 'GET',
      url: '/api/v1/discover/cards?page=99&pageSize=20',
    });
    expect(beyond.statusCode).toBe(200);
    const body = beyond.json<{
      data: unknown[];
      pagination: { page: number; total: number; totalPages: number };
    }>();
    expect(body.data).toEqual([]);
    expect(body.pagination).toMatchObject({ page: 99, total: 2, totalPages: 1 });
  });

  it('GET /search：type 缺省 card；按名称与标签匹配；只含公开内容', async () => {
    const defaultType = await app.inject({ method: 'GET', url: '/api/v1/search?q=东京' });
    expect(defaultType.statusCode).toBe(200);
    const defaultBody = defaultType.json<{ data: Array<{ id: string }> }>();
    expect(defaultBody.data.map((card) => card.id)).toEqual(['card-disc-1']);

    const byTag = await app.inject({ method: 'GET', url: '/api/v1/search?q=旅行&type=card' });
    const byTagBody = byTag.json<{ data: Array<{ id: string }> }>();
    expect(byTagBody.data.map((card) => card.id)).toEqual(['card-disc-1']);

    const boxSearch = await app.inject({ method: 'GET', url: '/api/v1/search?q=东京&type=box' });
    const boxBody = boxSearch.json<{ data: Array<{ id: string }> }>();
    expect(boxBody.data.map((box) => box.id)).toEqual(['box-disc-1']);

    const userSearch = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=finder&type=user',
    });
    const userBody = userSearch.json<{ data: Array<{ username: string; email?: string }> }>();
    expect(userBody.data).toHaveLength(1);
    expect(userBody.data[0]?.username).toBe('finder');
    expect(userBody.data[0]?.email).toBeUndefined();

    const invalidType = await app.inject({ method: 'GET', url: '/api/v1/search?q=x&type=album' });
    expect(invalidType.statusCode).toBe(400);
  });

  it('GET /search：q 去首尾空白后长度不足 1 → COMMUNITY_VALIDATION_ERROR', async () => {
    const missing = await app.inject({ method: 'GET', url: '/api/v1/search' });
    expect(missing.statusCode).toBe(400);
    expect(missing.json<{ error: { code: string } }>().error.code).toBe(
      'COMMUNITY_VALIDATION_ERROR'
    );
    const blank = await app.inject({ method: 'GET', url: '/api/v1/search?q=%20%20' });
    expect(blank.statusCode).toBe(400);
  });
});
