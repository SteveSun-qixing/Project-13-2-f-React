import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { CommunityDb } from '../../db/client.js';
import {
  boxes,
  cardRenderCaches,
  cards,
  idempotencyRecords,
  refreshSessions,
  rooms,
  users,
  type Box,
  type Card,
  type CardRenderCache,
  type IdempotencyRecord,
  type NewIdempotencyRecord,
  type NewRefreshSession,
  type NewRoom,
  type NewUser,
  type RefreshSession,
  type Room,
  type User,
} from '../../db/schema/index.js';
import type { PagedItems } from '../../lib/pagination.js';
import type {
  BoxRepository,
  CardRepository,
  IdempotencyRepository,
  RefreshSessionRepository,
  RenderCacheRepository,
  Repositories,
  RoomRepository,
  UserRepository,
} from '../types.js';

/**
 * Drizzle 适配器（生产装配）。可见性谓词与契约 §4.1 对齐：
 * - 匿名 / 普通请求者列表只含 public + ready（箱子同口径）；
 * - includeAll（所有者本人或管理员）额外包含私有与未就绪内容。
 * 排序在各端点内固定（§6.1），不接受查询参数改变。
 */

interface ListPage {
  page: number;
  pageSize: number;
}

async function paged<T>(
  run: (limit: number, offset: number) => Promise<T[]>,
  total: () => Promise<number>,
  page: ListPage
): Promise<PagedItems<T>> {
  const [items, totalCount] = await Promise.all([
    run(page.pageSize, (page.page - 1) * page.pageSize),
    total(),
  ]);
  return { items, total: totalCount };
}

function totalOf(rows: Array<{ value: number }>): number {
  return Number(rows[0]?.value ?? 0);
}

class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: CommunityDb) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByUsernameLower(usernameLower: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.usernameLower, usernameLower))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return rows[0] ?? null;
  }

  async findByLoginIdentifier(identifier: string): Promise<User | null> {
    const normalized = identifier.toLowerCase();
    const rows = await this.db
      .select()
      .from(users)
      .where(or(eq(users.usernameLower, normalized), eq(users.email, normalized)))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: NewUser): Promise<User> {
    const rows = await this.db.insert(users).values(data).returning();
    const row = rows[0];
    if (row === undefined) {
      throw new Error('用户写入失败');
    }
    return row;
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        User,
        | 'displayName'
        | 'bio'
        | 'avatarUrl'
        | 'passwordHash'
        | 'failedLoginCount'
        | 'lockedUntil'
        | 'updatedAt'
      >
    >
  ): Promise<User> {
    const rows = await this.db
      .update(users)
      .set({ ...patch, updatedAt: patch.updatedAt ?? new Date() })
      .where(eq(users.id, id))
      .returning();
    const row = rows[0];
    if (row === undefined) {
      throw new Error('用户更新失败：记录不存在');
    }
    return row;
  }

  async searchActive(query: string, page: ListPage): Promise<PagedItems<User>> {
    const pattern = `%${escapeLike(query)}%`;
    const predicate = and(
      eq(users.isActive, true),
      or(ilike(users.username, pattern), ilike(users.displayName, pattern))
    );
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(users)
          .where(predicate)
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(users).where(predicate)),
      page
    );
  }
}

class DrizzleRefreshSessionRepository implements RefreshSessionRepository {
  constructor(private readonly db: CommunityDb) {}

  async create(data: NewRefreshSession): Promise<void> {
    await this.db.insert(refreshSessions).values(data);
  }

  async findByJti(jti: string): Promise<RefreshSession | null> {
    const rows = await this.db
      .select()
      .from(refreshSessions)
      .where(eq(refreshSessions.jti, jti))
      .limit(1);
    return rows[0] ?? null;
  }

  async revoke(jti: string, revokedAt: Date): Promise<void> {
    await this.db
      .update(refreshSessions)
      .set({ revokedAt })
      .where(and(eq(refreshSessions.jti, jti), isNull(refreshSessions.revokedAt)));
  }

  async revokeAllForUser(
    userId: string,
    exceptJti: string | null,
    revokedAt: Date
  ): Promise<number> {
    const predicate =
      exceptJti === null
        ? and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt))
        : and(
            eq(refreshSessions.userId, userId),
            isNull(refreshSessions.revokedAt),
            ne(refreshSessions.jti, exceptJti)
          );
    const rows = await this.db
      .update(refreshSessions)
      .set({ revokedAt })
      .where(predicate)
      .returning({ jti: refreshSessions.jti });
    return rows.length;
  }
}

class DrizzleRoomRepository implements RoomRepository {
  constructor(private readonly db: CommunityDb) {}

  async findById(id: string): Promise<Room | null> {
    const rows = await this.db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async create(data: NewRoom): Promise<Room> {
    const rows = await this.db.insert(rooms).values(data).returning();
    const row = rows[0];
    if (row === undefined) {
      throw new Error('房间写入失败');
    }
    return row;
  }

  async listByUser(
    userId: string,
    opts: { includeAll: boolean },
    page: ListPage
  ): Promise<PagedItems<Room>> {
    const predicate = this.visiblePredicate(userId, opts.includeAll);
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(rooms)
          .where(predicate)
          .orderBy(desc(rooms.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(rooms).where(predicate)),
      page
    );
  }

  async listAllByUser(userId: string, opts: { includeAll: boolean }): Promise<Room[]> {
    return this.db
      .select()
      .from(rooms)
      .where(this.visiblePredicate(userId, opts.includeAll))
      .orderBy(desc(rooms.createdAt));
  }

  private visiblePredicate(userId: string, includeAll: boolean): SQL<unknown> | undefined {
    return includeAll
      ? eq(rooms.userId, userId)
      : and(eq(rooms.userId, userId), eq(rooms.visibility, 'public'));
  }
}

function cardVisibleByUser(userId: string, includeAll: boolean): SQL<unknown> | undefined {
  return includeAll
    ? eq(cards.userId, userId)
    : and(eq(cards.userId, userId), eq(cards.visibility, 'public'), eq(cards.status, 'ready'));
}

function cardVisibleByRoom(roomId: string, includeAll: boolean): SQL<unknown> | undefined {
  return includeAll
    ? eq(cards.roomId, roomId)
    : and(eq(cards.roomId, roomId), eq(cards.visibility, 'public'), eq(cards.status, 'ready'));
}

function boxVisibleByUser(userId: string, includeAll: boolean): SQL<unknown> | undefined {
  return includeAll
    ? eq(boxes.userId, userId)
    : and(eq(boxes.userId, userId), eq(boxes.visibility, 'public'), eq(boxes.status, 'ready'));
}

function boxVisibleByRoom(roomId: string, includeAll: boolean): SQL<unknown> | undefined {
  return includeAll
    ? eq(boxes.roomId, roomId)
    : and(eq(boxes.roomId, roomId), eq(boxes.visibility, 'public'), eq(boxes.status, 'ready'));
}

class DrizzleCardRepository implements CardRepository {
  constructor(private readonly db: CommunityDb) {}

  async findById(id: string): Promise<Card | null> {
    const rows = await this.db.select().from(cards).where(eq(cards.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listPublicReady(page: ListPage): Promise<PagedItems<Card>> {
    const predicate = and(eq(cards.visibility, 'public'), eq(cards.status, 'ready'));
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(cards)
          .where(predicate)
          .orderBy(desc(cards.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(cards).where(predicate)),
      page
    );
  }

  async listByUser(
    userId: string,
    opts: { includeAll: boolean },
    page: ListPage
  ): Promise<PagedItems<Card>> {
    const predicate = cardVisibleByUser(userId, opts.includeAll);
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(cards)
          .where(predicate)
          .orderBy(desc(cards.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(cards).where(predicate)),
      page
    );
  }

  async listRootByUser(
    userId: string,
    opts: { includeAll: boolean },
    page: ListPage
  ): Promise<PagedItems<Card>> {
    const predicate = and(cardVisibleByUser(userId, opts.includeAll), isNull(cards.roomId));
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(cards)
          .where(predicate)
          .orderBy(desc(cards.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(cards).where(predicate)),
      page
    );
  }

  async listByRoom(
    roomId: string,
    opts: { includeAll: boolean },
    page: ListPage
  ): Promise<PagedItems<Card>> {
    const predicate = cardVisibleByRoom(roomId, opts.includeAll);
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(cards)
          .where(predicate)
          .orderBy(desc(cards.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(cards).where(predicate)),
      page
    );
  }

  async countByRoom(roomId: string, opts: { includeAll: boolean }): Promise<number> {
    const predicate = cardVisibleByRoom(roomId, opts.includeAll);
    const rows = await this.db.select({ value: count() }).from(cards).where(predicate);
    return totalOf(rows);
  }

  async searchPublicReady(query: string, page: ListPage): Promise<PagedItems<Card>> {
    const pattern = `%${escapeLike(query)}%`;
    const predicate = and(
      eq(cards.visibility, 'public'),
      eq(cards.status, 'ready'),
      or(ilike(cards.name, pattern), ilike(sql`${cards.tags}::text`, pattern))
    );
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(cards)
          .where(predicate)
          .orderBy(desc(cards.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(cards).where(predicate)),
      page
    );
  }

  async findPublicReadyByCardFileIds(cardFileIds: string[]): Promise<Card[]> {
    if (cardFileIds.length === 0) {
      return [];
    }
    return this.db
      .select()
      .from(cards)
      .where(
        and(
          inArray(cards.cardFileId, cardFileIds),
          eq(cards.visibility, 'public'),
          eq(cards.status, 'ready')
        )
      );
  }
}

class DrizzleBoxRepository implements BoxRepository {
  constructor(private readonly db: CommunityDb) {}

  async findById(id: string): Promise<Box | null> {
    const rows = await this.db.select().from(boxes).where(eq(boxes.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listPublicReady(page: ListPage): Promise<PagedItems<Box>> {
    const predicate = and(eq(boxes.visibility, 'public'), eq(boxes.status, 'ready'));
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(boxes)
          .where(predicate)
          .orderBy(desc(boxes.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(boxes).where(predicate)),
      page
    );
  }

  async listByUser(
    userId: string,
    opts: { includeAll: boolean },
    page: ListPage
  ): Promise<PagedItems<Box>> {
    const predicate = boxVisibleByUser(userId, opts.includeAll);
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(boxes)
          .where(predicate)
          .orderBy(desc(boxes.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(boxes).where(predicate)),
      page
    );
  }

  async listRootByUser(
    userId: string,
    opts: { includeAll: boolean },
    page: ListPage
  ): Promise<PagedItems<Box>> {
    const predicate = and(boxVisibleByUser(userId, opts.includeAll), isNull(boxes.roomId));
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(boxes)
          .where(predicate)
          .orderBy(desc(boxes.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(boxes).where(predicate)),
      page
    );
  }

  async listByRoom(
    roomId: string,
    opts: { includeAll: boolean },
    page: ListPage
  ): Promise<PagedItems<Box>> {
    const predicate = boxVisibleByRoom(roomId, opts.includeAll);
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(boxes)
          .where(predicate)
          .orderBy(desc(boxes.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(boxes).where(predicate)),
      page
    );
  }

  async countByRoom(roomId: string, opts: { includeAll: boolean }): Promise<number> {
    const predicate = boxVisibleByRoom(roomId, opts.includeAll);
    const rows = await this.db.select({ value: count() }).from(boxes).where(predicate);
    return totalOf(rows);
  }

  async searchPublicReady(query: string, page: ListPage): Promise<PagedItems<Box>> {
    const pattern = `%${escapeLike(query)}%`;
    const predicate = and(
      eq(boxes.visibility, 'public'),
      eq(boxes.status, 'ready'),
      or(ilike(boxes.name, pattern), ilike(sql`${boxes.tags}::text`, pattern))
    );
    return paged(
      (limit, offset) =>
        this.db
          .select()
          .from(boxes)
          .where(predicate)
          .orderBy(desc(boxes.createdAt))
          .limit(limit)
          .offset(offset),
      async () => totalOf(await this.db.select({ value: count() }).from(boxes).where(predicate)),
      page
    );
  }
}

class DrizzleRenderCacheRepository implements RenderCacheRepository {
  constructor(private readonly db: CommunityDb) {}

  async findWebByCard(cardId: string): Promise<CardRenderCache | null> {
    const rows = await this.db
      .select()
      .from(cardRenderCaches)
      .where(
        and(
          eq(cardRenderCaches.cardId, cardId),
          eq(cardRenderCaches.renderProfile, 'community-web')
        )
      )
      .orderBy(desc(cardRenderCaches.updatedAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async findCoverByCard(cardId: string): Promise<CardRenderCache | null> {
    const rows = await this.db
      .select()
      .from(cardRenderCaches)
      .where(
        and(
          eq(cardRenderCaches.cardId, cardId),
          eq(cardRenderCaches.renderProfile, 'community-cover')
        )
      )
      .orderBy(desc(cardRenderCaches.updatedAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByCard(cardId: string): Promise<CardRenderCache[]> {
    return this.db.select().from(cardRenderCaches).where(eq(cardRenderCaches.cardId, cardId));
  }
}

class DrizzleIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly db: CommunityDb) {}

  async find(
    accountId: string,
    endpoint: string,
    key: string,
    now: Date
  ): Promise<IdempotencyRecord | null> {
    // 懒清理：同端点访问先剔除过期记录（保留时间由配置控制，契约 §6.2）。
    await this.db
      .delete(idempotencyRecords)
      .where(and(lt(idempotencyRecords.expiresAt, now), eq(idempotencyRecords.endpoint, endpoint)));
    const rows = await this.db
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.accountId, accountId),
          eq(idempotencyRecords.endpoint, endpoint),
          eq(idempotencyRecords.idempotencyKey, key)
        )
      )
      .limit(1);
    const row = rows[0];
    if (row === undefined || row.expiresAt.getTime() <= now.getTime()) {
      return null;
    }
    return row;
  }

  async claim(data: NewIdempotencyRecord): Promise<boolean> {
    const inserted = await this.db
      .insert(idempotencyRecords)
      .values(data)
      .onConflictDoNothing()
      .returning({ id: idempotencyRecords.id });
    return inserted.length > 0;
  }

  async fulfill(
    accountId: string,
    endpoint: string,
    key: string,
    result: { statusCode: number; responseBody: unknown }
  ): Promise<void> {
    await this.db
      .update(idempotencyRecords)
      .set({ statusCode: result.statusCode, responseBody: result.responseBody })
      .where(
        and(
          eq(idempotencyRecords.accountId, accountId),
          eq(idempotencyRecords.endpoint, endpoint),
          eq(idempotencyRecords.idempotencyKey, key)
        )
      );
  }

  async release(accountId: string, endpoint: string, key: string): Promise<void> {
    await this.db
      .delete(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.accountId, accountId),
          eq(idempotencyRecords.endpoint, endpoint),
          eq(idempotencyRecords.idempotencyKey, key)
        )
      );
  }
}

/** LIKE 通配符转义（检索输入不注入 % 与 _）。 */
function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

export function createDrizzleRepositories(db: CommunityDb): Repositories {
  return {
    users: new DrizzleUserRepository(db),
    refreshSessions: new DrizzleRefreshSessionRepository(db),
    rooms: new DrizzleRoomRepository(db),
    cards: new DrizzleCardRepository(db),
    boxes: new DrizzleBoxRepository(db),
    renderCaches: new DrizzleRenderCacheRepository(db),
    idempotency: new DrizzleIdempotencyRepository(db),
  };
}
