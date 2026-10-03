import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestHarness,
  fixtureBox,
  fixtureCard,
  fixtureRoom,
  fixtureUser,
  registerAccount,
  type TestHarness,
} from './helpers/harness.js';

/**
 * 账号域契约（契约 §4.3）：/users/me（GET/PATCH/password）、公开资料、用户内容列表、
 * 空间聚合。可见性口径（§4.1）：本人列表含私有与未就绪；访客只看公开就绪；
 * 私有资源按 404 不暴露存在性。
 */

describe('账号域契约', () => {
  let harness: TestHarness;
  let app: FastifyInstance;
  let alice: Awaited<ReturnType<typeof registerAccount>>;

  beforeAll(async () => {
    harness = await buildTestHarness();
    app = harness.app;
    alice = await registerAccount(app, { username: 'alice', email: 'alice@example.test' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/users/me', () => {
    it('返回 ICommunityUserMe 逐字段（含 email/role/updatedAt）', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: authHeader(alice.accessToken),
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { data: Record<string, unknown> };
      expect(Object.keys(body.data).sort()).toEqual([
        'avatarUrl',
        'bio',
        'createdAt',
        'displayName',
        'email',
        'id',
        'role',
        'updatedAt',
        'username',
      ]);
      expect(body.data['email']).toBe('alice@example.test');
      expect(body.data['role']).toBe('user');
    });

    it('未认证 → 401', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/users/me' });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('只修改 displayName/bio 并返回 ICommunityUserMe', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        headers: authHeader(alice.accessToken),
        payload: { displayName: '爱丽丝', bio: '卡片作者' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { data: { displayName: string; bio: string } };
      expect(body.data.displayName).toBe('爱丽丝');
      expect(body.data.bio).toBe('卡片作者');
    });

    it('bio 可置空（null）', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        headers: authHeader(alice.accessToken),
        payload: { bio: null },
      });
      expect(response.statusCode).toBe(200);
      expect((response.json() as { data: { bio: string | null } }).data.bio).toBeNull();
    });

    it('空请求体 → 400（至少一个字段）', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        headers: authHeader(alice.accessToken),
        payload: {},
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/users/:username', () => {
    it('公开资料不含 email 与 role（契约 §10.2）', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/users/alice' });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { data: Record<string, unknown> };
      expect(Object.keys(body.data).sort()).toEqual([
        'avatarUrl',
        'bio',
        'createdAt',
        'displayName',
        'id',
        'username',
      ]);
      expect(body.data['email']).toBeUndefined();
      expect(body.data['role']).toBeUndefined();
    });

    it('不存在 → 404 COMMUNITY_USER_NOT_FOUND', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/users/ghost' });
      expect(response.statusCode).toBe(404);
      expect((response.json() as { error: { code: string } }).error.code).toBe('COMMUNITY_USER_NOT_FOUND');
    });
  });

  describe('用户内容列表与可见性', () => {
    let owner: Awaited<ReturnType<typeof registerAccount>>;

    beforeAll(async () => {
      owner = await registerAccount(app, { username: 'owner-a' });
      const ownerUser = harness.state.users.find((user) => user.id === owner.userId);
      expect(ownerUser).toBeDefined();
      harness.state.cards.push(
        fixtureCard({
          id: 'card-public-ready',
          userId: owner.userId,
          name: '公开就绪卡片',
          cardFileId: 'pubReady01',
          status: 'ready',
          visibility: 'public',
          createdAt: new Date(Date.parse('2026-09-10T00:00:00.000Z')),
        }),
        fixtureCard({
          id: 'card-public-pending',
          userId: owner.userId,
          name: '公开未就绪卡片',
          cardFileId: 'pubPend001',
          status: 'pending',
          visibility: 'public',
          createdAt: new Date(Date.parse('2026-09-11T00:00:00.000Z')),
        }),
        fixtureCard({
          id: 'card-private-ready',
          userId: owner.userId,
          name: '私有就绪卡片',
          cardFileId: 'privReady1',
          status: 'ready',
          visibility: 'private',
          createdAt: new Date(Date.parse('2026-09-12T00:00:00.000Z')),
        }),
      );
      harness.state.boxes.push(
        fixtureBox({
          id: 'box-public-ready',
          userId: owner.userId,
          name: '公开就绪箱子',
          status: 'ready',
          visibility: 'public',
          createdAt: new Date(Date.parse('2026-09-13T00:00:00.000Z')),
        }),
        fixtureBox({
          id: 'box-private-ready',
          userId: owner.userId,
          name: '私有箱子',
          status: 'ready',
          visibility: 'private',
          createdAt: new Date(Date.parse('2026-09-14T00:00:00.000Z')),
        }),
      );
    });

    it('/users/me/cards（必须）：本人视角含私有与未就绪', async () => {
      const mine = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/cards',
        headers: authHeader(owner.accessToken),
      });
      expect(mine.statusCode).toBe(200);
      const body = mine.json() as { data: Array<{ id: string }>; pagination: unknown };
      expect(body.data.map((item) => item.id)).toEqual([
        'card-private-ready',
        'card-public-pending',
        'card-public-ready',
      ]);
      const anon = await app.inject({ method: 'GET', url: '/api/v1/users/me/cards' });
      expect(anon.statusCode).toBe(401);
    });

    it('/users/:username/cards：访客只看公开就绪；owner 看全量；admin 看全量', async () => {
      const anon = await app.inject({ method: 'GET', url: '/api/v1/users/owner-a/cards' });
      expect(anon.statusCode).toBe(200);
      expect((anon.json() as { data: Array<{ id: string }> }).data.map((item) => item.id)).toEqual([
        'card-public-ready',
      ]);

      const self = await app.inject({
        method: 'GET',
        url: '/api/v1/users/owner-a/cards',
        headers: authHeader(owner.accessToken),
      });
      expect((self.json() as { data: Array<{ id: string }> }).data).toHaveLength(3);

      const adminUser = await registerAccount(app, { username: 'admin-a' });
      const row = harness.state.users.find((user) => user.id === adminUser.userId);
      row!.role = 'admin';
      const adminView = await app.inject({
        method: 'GET',
        url: '/api/v1/users/owner-a/cards',
        headers: authHeader(adminUser.accessToken),
      });
      expect((adminView.json() as { data: Array<{ id: string }> }).data).toHaveLength(3);
    });

    it('/users/:username/boxes 同口径', async () => {
      const anon = await app.inject({ method: 'GET', url: '/api/v1/users/owner-a/boxes' });
      expect((anon.json() as { data: Array<{ id: string }> }).data.map((item) => item.id)).toEqual([
        'box-public-ready',
      ]);
      const self = await app.inject({
        method: 'GET',
        url: '/api/v1/users/owner-a/boxes',
        headers: authHeader(owner.accessToken),
      });
      expect((self.json() as { data: Array<{ id: string }> }).data).toHaveLength(2);
    });
  });

  describe('空间聚合 GET /api/v1/users/:username/space', () => {
    it('返回 user + 可见房间 + 根目录公开就绪卡片/箱子（ICommunitySpace）', async () => {
      const owner = harness.state.users.find((user) => user.username === 'owner-a');
      harness.state.rooms.push(
        fixtureRoom({ id: 'room-public', userId: owner!.id, name: '公开房间', slug: 'public-room' }),
        fixtureRoom({
          id: 'room-private',
          userId: owner!.id,
          name: '私密房间',
          slug: 'private-room',
          visibility: 'private',
        }),
      );
      const anon = await app.inject({ method: 'GET', url: '/api/v1/users/owner-a/space' });
      expect(anon.statusCode).toBe(200);
      const body = anon.json() as {
        data: {
          user: { username: string };
          rooms: Array<{ id: string; cardCount: number; boxCount: number }>;
          cards: Array<{ id: string }>;
          boxes: Array<{ id: string }>;
        };
      };
      expect(Object.keys(body.data).sort()).toEqual(['boxes', 'cards', 'rooms', 'user']);
      expect(body.data.user.username).toBe('owner-a');
      // 访客视角：仅公开房间；计数只含公开就绪内容
      expect(body.data.rooms.map((room) => room.id)).toEqual(['room-public']);
      expect(body.data.rooms[0]?.cardCount).toBe(1);
      expect(body.data.rooms[0]?.boxCount).toBe(0);
      expect(body.data.cards.map((card) => card.id)).toEqual(['card-public-ready']);
      expect(body.data.boxes.map((box) => box.id)).toEqual(['box-public-ready']);
    });
  });
});
