import type { FastifyInstance } from 'fastify';
import { buildApp, type ServerDeps } from '../../src/app.js';
import { HealthRegistry } from '../../src/routes/health.js';
import type { AppConfig } from '../../src/config/env.js';
import {
  rooms,
  users,
  type Box,
  type Card,
  type CardRenderCache,
  type IdempotencyRecord,
  type NewIdempotencyRecord,
  type NewRefreshSession,
  type RefreshSession,
  type Room,
  type User,
} from '../../src/db/schema/index.js';
import type { PagedItems } from '../../src/lib/pagination.js';
import type {
  BoxRepository,
  CardRepository,
  IdempotencyRepository,
  RefreshSessionRepository,
  RenderCacheRepository,
  Repositories,
  RoomRepository,
  UserRepository,
} from '../../src/repositories/types.js';

/**
 * 内存 fake 仓库（PG 端口 fake）：真实 PostgreSQL 不进入测试。
 * 谓词与 Drizzle 适配器同口径（可见性 includeAll / public+ready、createdAt 倒序、
 * 检索名称与标签匹配），路由契约测试在该接缝上装配。
 */

export interface FakeState {
  users: User[];
  rooms: Room[];
  cards: Card[];
  boxes: Box[];
  renderCaches: CardRenderCache[];
  refreshSessions: RefreshSession[];
  idempotency: IdempotencyRecord[];
}

export function createFakeState(): FakeState {
  return { users: [], rooms: [], cards: [], boxes: [], renderCaches: [], refreshSessions: [], idempotency: [] };
}

function byCreatedAtDesc<T extends { createdAt: Date }>(left: T, right: T): number {
  return right.createdAt.getTime() - left.createdAt.getTime();
}

function contains(haystack: string | null | undefined, needle: string): boolean {
  return (haystack ?? '').toLowerCase().includes(needle.toLowerCase());
}

function tagsText(tags: unknown): string {
  return JSON.stringify(tags ?? []);
}

function paginate<T>(items: T[], page: { page: number; pageSize: number }): PagedItems<T> {
  const start = (page.page - 1) * page.pageSize;
  return { items: items.slice(start, start + page.pageSize), total: items.length };
}

class FakeUserRepository implements UserRepository {
  constructor(private readonly state: FakeState) {}

  async findById(id: string): Promise<User | null> {
    return this.state.users.find((user) => user.id === id) ?? null;
  }

  async findByUsernameLower(usernameLower: string): Promise<User | null> {
    return this.state.users.find((user) => user.usernameLower === usernameLower) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.state.users.find((user) => user.email === email) ?? null;
  }

  async findByLoginIdentifier(identifier: string): Promise<User | null> {
    const normalized = identifier.toLowerCase();
    return (
      this.state.users.find(
        (user) => user.usernameLower === normalized || user.email === normalized,
      ) ?? null
    );
  }

  async create(data: typeof users.$inferInsert): Promise<User> {
    const now = new Date();
    const user: User = {
      id: data.id ?? `user-${this.state.users.length + 1}-${Math.random().toString(36).slice(2, 10)}`,
      username: data.username,
      usernameLower: data.usernameLower,
      email: data.email,
      passwordHash: data.passwordHash,
      displayName: data.displayName ?? null,
      bio: data.bio ?? null,
      avatarUrl: data.avatarUrl ?? null,
      role: data.role ?? 'user',
      isActive: data.isActive ?? true,
      failedLoginCount: data.failedLoginCount ?? 0,
      lockedUntil: data.lockedUntil ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };
    this.state.users.push(user);
    return user;
  }

  async update(
    id: string,
    patch: Partial<
      Pick<User, 'displayName' | 'bio' | 'avatarUrl' | 'passwordHash' | 'failedLoginCount' | 'lockedUntil' | 'updatedAt'>
    >,
  ): Promise<User> {
    const user = await this.findById(id);
    if (user === null) {
      throw new Error('用户更新失败：记录不存在');
    }
    Object.assign(user, patch, { updatedAt: patch.updatedAt ?? new Date() });
    return user;
  }

  async searchActive(query: string, page: { page: number; pageSize: number }): Promise<PagedItems<User>> {
    const matched = this.state.users
      .filter((user) => user.isActive)
      .filter((user) => contains(user.username, query) || contains(user.displayName, query))
      .sort(byCreatedAtDesc);
    return paginate(matched, page);
  }
}

class FakeRefreshSessionRepository implements RefreshSessionRepository {
  constructor(private readonly state: FakeState) {}

  async create(data: NewRefreshSession): Promise<void> {
    this.state.refreshSessions.push({
      jti: data.jti,
      userId: data.userId,
      expiresAt: data.expiresAt,
      revokedAt: data.revokedAt ?? null,
      createdAt: new Date(),
    });
  }

  async findByJti(jti: string): Promise<RefreshSession | null> {
    return this.state.refreshSessions.find((session) => session.jti === jti) ?? null;
  }

  async revoke(jti: string, revokedAt: Date): Promise<void> {
    const session = this.state.refreshSessions.find((item) => item.jti === jti);
    if (session !== undefined && session.revokedAt === null) {
      session.revokedAt = revokedAt;
    }
  }

  async revokeAllForUser(userId: string, exceptJti: string | null, revokedAt: Date): Promise<number> {
    let count = 0;
    for (const session of this.state.refreshSessions) {
      if (session.userId !== userId || session.revokedAt !== null || session.jti === exceptJti) {
        continue;
      }
      session.revokedAt = revokedAt;
      count += 1;
    }
    return count;
  }
}

class FakeRoomRepository implements RoomRepository {
  constructor(private readonly state: FakeState) {}

  async findById(id: string): Promise<Room | null> {
    return this.state.rooms.find((room) => room.id === id) ?? null;
  }

  async create(data: typeof rooms.$inferInsert): Promise<Room> {
    const now = new Date();
    const room: Room = {
      id: data.id ?? `room-${this.state.rooms.length + 1}-${Math.random().toString(36).slice(2, 10)}`,
      userId: data.userId,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      coverUrl: data.coverUrl ?? null,
      visibility: data.visibility ?? 'public',
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };
    this.state.rooms.push(room);
    return room;
  }

  async listByUser(
    userId: string,
    opts: { includeAll: boolean },
    page: { page: number; pageSize: number },
  ): Promise<PagedItems<Room>> {
    const matched = this.visibleRooms(userId, opts.includeAll);
    return paginate(matched, page);
  }

  async listAllByUser(userId: string, opts: { includeAll: boolean }): Promise<Room[]> {
    return this.visibleRooms(userId, opts.includeAll);
  }

  private visibleRooms(userId: string, includeAll: boolean): Room[] {
    return this.state.rooms
      .filter((room) => room.userId === userId)
      .filter((room) => includeAll || room.visibility === 'public')
      .sort(byCreatedAtDesc);
  }
}

function cardVisibleToUser(card: Card, userId: string, includeAll: boolean): boolean {
  if (card.userId !== userId) {
    return false;
  }
  return includeAll || (card.visibility === 'public' && card.status === 'ready');
}

function cardVisibleInRoom(card: Card, roomId: string, includeAll: boolean): boolean {
  if (card.roomId !== roomId) {
    return false;
  }
  return includeAll || (card.visibility === 'public' && card.status === 'ready');
}

function boxVisibleToUser(box: Box, userId: string, includeAll: boolean): boolean {
  if (box.userId !== userId) {
    return false;
  }
  return includeAll || (box.visibility === 'public' && box.status === 'ready');
}

function boxVisibleInRoom(box: Box, roomId: string, includeAll: boolean): boolean {
  if (box.roomId !== roomId) {
    return false;
  }
  return includeAll || (box.visibility === 'public' && box.status === 'ready');
}

class FakeCardRepository implements CardRepository {
  constructor(private readonly state: FakeState) {}

  async findById(id: string): Promise<Card | null> {
    return this.state.cards.find((card) => card.id === id) ?? null;
  }

  async listPublicReady(page: { page: number; pageSize: number }): Promise<PagedItems<Card>> {
    const matched = this.state.cards
      .filter((card) => card.visibility === 'public' && card.status === 'ready')
      .sort(byCreatedAtDesc);
    return paginate(matched, page);
  }

  async listByUser(
    userId: string,
    opts: { includeAll: boolean },
    page: { page: number; pageSize: number },
  ): Promise<PagedItems<Card>> {
    const matched = this.state.cards
      .filter((card) => cardVisibleToUser(card, userId, opts.includeAll))
      .sort(byCreatedAtDesc);
    return paginate(matched, page);
  }

  async listRootByUser(
    userId: string,
    opts: { includeAll: boolean },
    page: { page: number; pageSize: number },
  ): Promise<PagedItems<Card>> {
    const matched = this.state.cards
      .filter((card) => cardVisibleToUser(card, userId, opts.includeAll) && card.roomId === null)
      .sort(byCreatedAtDesc);
    return paginate(matched, page);
  }

  async listByRoom(
    roomId: string,
    opts: { includeAll: boolean },
    page: { page: number; pageSize: number },
  ): Promise<PagedItems<Card>> {
    const matched = this.state.cards
      .filter((card) => cardVisibleInRoom(card, roomId, opts.includeAll))
      .sort(byCreatedAtDesc);
    return paginate(matched, page);
  }

  async countByRoom(roomId: string, opts: { includeAll: boolean }): Promise<number> {
    return this.state.cards.filter((card) => cardVisibleInRoom(card, roomId, opts.includeAll)).length;
  }

  async searchPublicReady(query: string, page: { page: number; pageSize: number }): Promise<PagedItems<Card>> {
    const matched = this.state.cards
      .filter((card) => card.visibility === 'public' && card.status === 'ready')
      .filter((card) => contains(card.name, query) || contains(tagsText(card.tags), query))
      .sort(byCreatedAtDesc);
    return paginate(matched, page);
  }

  async findPublicReadyByCardFileIds(cardFileIds: string[]): Promise<Card[]> {
    if (cardFileIds.length === 0) {
      return [];
    }
    return this.state.cards.filter(
      (card) =>
        cardFileIds.includes(card.cardFileId) &&
        card.visibility === 'public' &&
        card.status === 'ready',
    );
  }
}

class FakeBoxRepository implements BoxRepository {
  constructor(private readonly state: FakeState) {}

  async findById(id: string): Promise<Box | null> {
    return this.state.boxes.find((box) => box.id === id) ?? null;
  }

  async listPublicReady(page: { page: number; pageSize: number }): Promise<PagedItems<Box>> {
    const matched = this.state.boxes
      .filter((box) => box.visibility === 'public' && box.status === 'ready')
      .sort(byCreatedAtDesc);
    return paginate(matched, page);
  }

  async listByUser(
    userId: string,
    opts: { includeAll: boolean },
    page: { page: number; pageSize: number },
  ): Promise<PagedItems<Box>> {
    const matched = this.state.boxes
      .filter((box) => boxVisibleToUser(box, userId, opts.includeAll))
      .sort(byCreatedAtDesc);
    return paginate(matched, page);
  }

  async listRootByUser(
    userId: string,
    opts: { includeAll: boolean },
    page: { page: number; pageSize: number },
  ): Promise<PagedItems<Box>> {
    const matched = this.state.boxes
      .filter((box) => boxVisibleToUser(box, userId, opts.includeAll) && box.roomId === null)
      .sort(byCreatedAtDesc);
    return paginate(matched, page);
  }

  async listByRoom(
    roomId: string,
    opts: { includeAll: boolean },
    page: { page: number; pageSize: number },
  ): Promise<PagedItems<Box>> {
    const matched = this.state.boxes
      .filter((box) => boxVisibleInRoom(box, roomId, opts.includeAll))
      .sort(byCreatedAtDesc);
    return paginate(matched, page);
  }

  async countByRoom(roomId: string, opts: { includeAll: boolean }): Promise<number> {
    return this.state.boxes.filter((box) => boxVisibleInRoom(box, roomId, opts.includeAll)).length;
  }

  async searchPublicReady(query: string, page: { page: number; pageSize: number }): Promise<PagedItems<Box>> {
    const matched = this.state.boxes
      .filter((box) => box.visibility === 'public' && box.status === 'ready')
      .filter((box) => contains(box.name, query) || contains(tagsText(box.tags), query))
      .sort(byCreatedAtDesc);
    return paginate(matched, page);
  }
}

class FakeRenderCacheRepository implements RenderCacheRepository {
  constructor(private readonly state: FakeState) {}

  async findWebByCard(cardId: string): Promise<CardRenderCache | null> {
    const matched = this.state.renderCaches
      .filter((cache) => cache.cardId === cardId && cache.renderProfile === 'community-web')
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    return matched[0] ?? null;
  }

  async findCoverByCard(cardId: string): Promise<CardRenderCache | null> {
    const matched = this.state.renderCaches
      .filter((cache) => cache.cardId === cardId && cache.renderProfile === 'community-cover')
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    return matched[0] ?? null;
  }

  async listByCard(cardId: string): Promise<CardRenderCache[]> {
    return this.state.renderCaches.filter((cache) => cache.cardId === cardId);
  }
}

class FakeIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly state: FakeState) {}

  async find(
    accountId: string,
    endpoint: string,
    key: string,
    now: Date,
  ): Promise<IdempotencyRecord | null> {
    const row = this.state.idempotency.find(
      (record) =>
        record.accountId === accountId &&
        record.endpoint === endpoint &&
        record.idempotencyKey === key,
    );
    if (row === undefined) {
      return null;
    }
    if (row.expiresAt.getTime() <= now.getTime()) {
      this.state.idempotency = this.state.idempotency.filter((record) => record !== row);
      return null;
    }
    return row;
  }

  async claim(data: NewIdempotencyRecord): Promise<boolean> {
    const exists = this.state.idempotency.some(
      (record) =>
        record.accountId === data.accountId &&
        record.endpoint === data.endpoint &&
        record.idempotencyKey === data.idempotencyKey,
    );
    if (exists) {
      return false;
    }
    this.state.idempotency.push({
      id: `idem-${this.state.idempotency.length + 1}`,
      accountId: data.accountId,
      endpoint: data.endpoint,
      idempotencyKey: data.idempotencyKey,
      requestHash: data.requestHash,
      statusCode: data.statusCode ?? null,
      responseBody: data.responseBody ?? null,
      createdAt: new Date(),
      expiresAt: data.expiresAt,
    });
    return true;
  }

  async fulfill(
    accountId: string,
    endpoint: string,
    key: string,
    result: { statusCode: number; responseBody: unknown },
  ): Promise<void> {
    const row = this.state.idempotency.find(
      (record) =>
        record.accountId === accountId &&
        record.endpoint === endpoint &&
        record.idempotencyKey === key,
    );
    if (row !== undefined) {
      row.statusCode = result.statusCode;
      row.responseBody = result.responseBody;
    }
  }

  async release(accountId: string, endpoint: string, key: string): Promise<void> {
    this.state.idempotency = this.state.idempotency.filter(
      (record) =>
        !(
          record.accountId === accountId &&
          record.endpoint === endpoint &&
          record.idempotencyKey === key
        ),
    );
  }
}

export function createFakeRepositories(state: FakeState): Repositories {
  return {
    users: new FakeUserRepository(state),
    refreshSessions: new FakeRefreshSessionRepository(state),
    rooms: new FakeRoomRepository(state),
    cards: new FakeCardRepository(state),
    boxes: new FakeBoxRepository(state),
    renderCaches: new FakeRenderCacheRepository(state),
    idempotency: new FakeIdempotencyRepository(state),
  };
}

// ─── 夹具构造器 ──────────────────────────────────────────────

const BASE_TIME = Date.parse('2026-09-01T00:00:00.000Z');

export function fixtureUser(overrides: Partial<User> & Pick<User, 'username' | 'email'>): User {
  const now = new Date(BASE_TIME);
  const defaults = {
    id: `user-${overrides.username}`,
    usernameLower: overrides.username.toLowerCase(),
    passwordHash: 'scrypt$16384$8$1$abc$def',
    displayName: overrides.username,
    bio: null,
    avatarUrl: null,
    role: 'user' as const,
    isActive: true,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
  };
  return { ...defaults, ...overrides };
}

export function fixtureCard(
  overrides: Partial<Card> & Pick<Card, 'id' | 'userId' | 'name'>,
): Card {
  const now = new Date(BASE_TIME);
  const defaults = {
    cardFileId: 'cardFile01',
    roomId: null,
    coverRatio: '3:4',
    chipStandardsVersion: '1.0.0',
    tags: [],
    status: 'ready' as const,
    visibility: 'public' as const,
    errorMessage: null,
    fileSizeBytes: 1024,
    sha256: 'aa'.repeat(32),
    sourceBucket: null,
    sourceKey: null,
    sourceCardSha256: null,
    resourceManifest: [],
    artifactObjects: [],
    createdAt: now,
    updatedAt: now,
  };
  return { ...defaults, ...overrides };
}

export function fixtureBox(overrides: Partial<Box> & Pick<Box, 'id' | 'userId' | 'name'>): Box {
  const now = new Date(BASE_TIME);
  const defaults = {
    boxFileId: 'boxFile001',
    roomId: null,
    description: null,
    coverRatio: '3:4',
    activeLayoutType: 'chips.layout.grid',
    chipStandardsVersion: '1.0.0',
    tags: [],
    status: 'ready' as const,
    visibility: 'public' as const,
    errorMessage: null,
    fileSizeBytes: 2048,
    sha256: 'bb'.repeat(32),
    coverUrl: null,
    coverBucket: null,
    coverKey: null,
    metadata: {},
    entries: [],
    sourceBucket: null,
    sourceKey: null,
    sourceBoxSha256: null,
    createdAt: now,
    updatedAt: now,
  };
  return { ...defaults, ...overrides };
}

export function fixtureRoom(
  overrides: Partial<Room> & Pick<Room, 'id' | 'userId' | 'name' | 'slug'>,
): Room {
  const now = new Date(BASE_TIME);
  const defaults = {
    description: null,
    coverUrl: null,
    visibility: 'public' as const,
    createdAt: now,
    updatedAt: now,
  };
  return { ...defaults, ...overrides };
}

export function fixtureRenderCache(
  overrides: Partial<CardRenderCache> & Pick<CardRenderCache, 'id' | 'cardId' | 'renderProfile'>,
): CardRenderCache {
  const now = new Date(BASE_TIME);
  const defaults = {
    sourceCardSha256: 'aa'.repeat(32),
    rendererVersion: 'community-card-renderer-1',
    state: 'ready' as const,
    attemptCount: 1,
    cacheVersion: 'v1',
    cacheBucket: null,
    cachePrefix: null,
    viewEntryUrl: null,
    coverEntryUrl: null,
    viewProxyPath: null,
    coverProxyPath: null,
    errorCode: null,
    errorMessage: null,
    lastAccessedAt: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return { ...defaults, ...overrides };
}

export interface TestHarnessOptions {
  config?: Partial<AppConfig>;
}

/** 测试基座配置（限流默认放宽；限流用例自行覆盖）。 */
export function testAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    host: '127.0.0.1',
    baseUrl: 'https://community.example.test',
    databaseUrl: 'postgres://invalid:invalid@127.0.0.1:1/unused',
    jwtSecret: 'test-jwt-secret-0123456789abcdef0123456789abcdef',
    accessExpiresIn: '15m',
    refreshExpiresIn: '30d',
    corsAllowedOrigins: [],
    enableSwagger: false,
    lockThreshold: 3,
    lockDurationSeconds: 900,
    passwordMinLength: 8,
    rateLimitWindowSeconds: 60,
    rateLimitBrowseMax: 100_000,
    rateLimitAuthMax: 100_000,
    rateLimitTransferMax: 100_000,
    idempotencyRecordTtlMinutes: 1440,
    renderRetryAfterSeconds: 3,
    defaultCoverUrl: 'https://cdn.example.test/default-cover.svg',
    adminBootstrap: null,
    ...overrides,
  };
}

export interface TestHarness {
  app: FastifyInstance;
  state: FakeState;
  serverDeps: ServerDeps;
}

export async function buildTestHarness(options: TestHarnessOptions = {}): Promise<TestHarness> {
  const state = createFakeState();
  const config = testAppConfig(options.config);
  const serverDeps: ServerDeps = {
    config,
    repositories: createFakeRepositories(state),
    healthRegistry: new HealthRegistry(),
    version: '0.1.0',
  };
  const app = await buildApp(serverDeps);
  return { app, state, serverDeps };
}

export interface RegisteredAccount {
  userId: string;
  username: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  cookie: string | undefined;
}

/** 经真实 API 注册账号（口令哈希走 scrypt 真链路）。 */
export async function registerAccount(
  app: FastifyInstance,
  input?: Partial<{ username: string; email: string; password: string; displayName: string }>,
): Promise<RegisteredAccount> {
  const username = input?.username ?? `alice-${Math.random().toString(36).slice(2, 8)}`;
  const email = input?.email ?? `${username}@example.test`;
  const password = input?.password ?? 'correct-horse-battery';
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      username,
      email,
      password,
      ...(input?.displayName === undefined ? {} : { displayName: input.displayName }),
    },
  });
  if (response.statusCode !== 201) {
    throw new Error(`注册夹具失败：${response.statusCode} ${response.body}`);
  }
  const body = response.json() as {
    data: { user: { id: string; username: string }; accessToken: string; refreshToken: string };
  };
  return {
    userId: body.data.user.id,
    username: body.data.user.username,
    email,
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    cookie: response.cookies.find((cookie) => cookie.name === 'chips_refresh_token')?.value,
  };
}

export function authHeader(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}
