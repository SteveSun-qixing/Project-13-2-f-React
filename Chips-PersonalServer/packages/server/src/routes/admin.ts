import { eq, desc, ilike, or, count, sql, gte, inArray } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client';
import { users } from '../db/schema/users';
import { cards } from '../db/schema/cards';
import { boxes } from '../db/schema/boxes';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { CardService } from '../services/card.service';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── 所有 admin 路由需要 admin 角色 ──────────────────────────────

  fastify.addHook('preHandler', fastify.requireAdmin);

  // ─── GET /admin/api/v1/stats ──────────────────────────────────────

  fastify.get('/api/v1/stats', async () => {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [cardCount] = await db.select({ count: count() }).from(cards);
    const [boxCount] = await db.select({ count: count() }).from(boxes);
    const [cardStorage] = await db
      .select({ total: sql<number>`COALESCE(SUM(${cards.fileSizeBytes}), 0)` })
      .from(cards);
    const [boxStorage] = await db
      .select({ total: sql<number>`COALESCE(SUM(${boxes.fileSizeBytes}), 0)` })
      .from(boxes);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayUsers] = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, todayStart));
    const [todayCards] = await db
      .select({ count: count() })
      .from(cards)
      .where(gte(cards.createdAt, todayStart));
    const [todayBoxes] = await db
      .select({ count: count() })
      .from(boxes)
      .where(gte(boxes.createdAt, todayStart));

    return {
      data: {
        userCount: Number(userCount?.count ?? 0),
        cardCount: Number(cardCount?.count ?? 0),
        boxCount: Number(boxCount?.count ?? 0),
        totalStorageBytes:
          Number(cardStorage?.total ?? 0) + Number(boxStorage?.total ?? 0),
        today: {
          userCount: Number(todayUsers?.count ?? 0),
          cardCount: Number(todayCards?.count ?? 0),
          boxCount: Number(todayBoxes?.count ?? 0),
        },
      },
    };
  });

  // ─── GET /admin/api/v1/users ──────────────────────────────────────

  fastify.get('/api/v1/users', async (request) => {
    const qs = request.query as { page?: string; pageSize?: string; q?: string };
    const page = Math.max(1, parseInt(qs.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(qs.pageSize ?? '20', 10)));
    const q = qs.q ?? '';

    const offset = (page - 1) * pageSize;
    const where = q
      ? or(ilike(users.username, `%${q}%`), ilike(users.displayName, `%${q}%`))
      : undefined;
    const [pagedUsers, totalRows] = await Promise.all([
      db.query.users.findMany({
        where,
        orderBy: [desc(users.createdAt)],
        limit: pageSize,
        offset,
      }),
      where
        ? db.select({ count: count() }).from(users).where(where)
        : db.select({ count: count() }).from(users),
    ]);
    const total = Number(totalRows[0]?.count ?? 0);
    const userIds = pagedUsers.map((user) => user.id);

    const cardStorageRows = userIds.length
      ? await db
          .select({
            userId: cards.userId,
            total: sql<number>`COALESCE(SUM(${cards.fileSizeBytes}), 0)`,
          })
          .from(cards)
          .where(inArray(cards.userId, userIds))
          .groupBy(cards.userId)
      : [];

    const boxStorageRows = userIds.length
      ? await db
          .select({
            userId: boxes.userId,
            total: sql<number>`COALESCE(SUM(${boxes.fileSizeBytes}), 0)`,
          })
          .from(boxes)
          .where(inArray(boxes.userId, userIds))
          .groupBy(boxes.userId)
      : [];

    const storageByUserId = new Map<string, number>();

    for (const row of cardStorageRows) {
      storageByUserId.set(row.userId, Number(row.total ?? 0));
    }

    for (const row of boxStorageRows) {
      storageByUserId.set(
        row.userId,
        (storageByUserId.get(row.userId) ?? 0) + Number(row.total ?? 0),
      );
    }

    const items = pagedUsers.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      isActive: u.isActive,
      storageBytes: storageByUserId.get(u.id) ?? 0,
      createdAt: u.createdAt,
    }));

    return {
      data: items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  });

  // ─── PATCH /admin/api/v1/users/:userId ───────────────────────────

  fastify.patch('/api/v1/users/:userId', async (request) => {
    const { userId } = request.params as { userId: string };
    const body = request.body as { isActive?: boolean };

    if (typeof body.isActive !== 'boolean') {
      throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'isActive (boolean) is required');
    }

    const [updated] = await db
      .update(users)
      .set({ isActive: body.isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw AppError.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    return { data: { id: updated.id, isActive: updated.isActive } };
  });

  // ─── GET /admin/api/v1/content ────────────────────────────────────

  fastify.get('/api/v1/content', async (request) => {
    const qs = request.query as { page?: string; pageSize?: string; type?: string; q?: string };
    const page = Math.max(1, parseInt(qs.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(qs.pageSize ?? '20', 10)));
    const type = qs.type && ['card', 'box'].includes(qs.type) ? qs.type : 'card';
    const q = qs.q ?? '';
    const offset = (page - 1) * pageSize;

    if (type === 'card') {
      const where = q ? ilike(cards.title, `%${q}%`) : undefined;
      const [pagedCards, totalRows] = await Promise.all([
        db.query.cards.findMany({
          where,
          columns: {
            id: true,
            userId: true,
            roomId: true,
            title: true,
            visibility: true,
            fileSizeBytes: true,
            createdAt: true,
            updatedAt: true,
            status: true,
          },
          orderBy: [desc(cards.createdAt)],
          limit: pageSize,
          offset,
        }),
        where
          ? db.select({ count: count() }).from(cards).where(where)
          : db.select({ count: count() }).from(cards),
      ]);
      const total = Number(totalRows[0]?.count ?? 0);
      return {
        data: pagedCards,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      };
    }

    const where = q ? ilike(boxes.title, `%${q}%`) : undefined;
    const [pagedBoxes, totalRows] = await Promise.all([
      db.query.boxes.findMany({
        where,
        columns: {
          id: true,
          userId: true,
          roomId: true,
          title: true,
          visibility: true,
          fileSizeBytes: true,
          createdAt: true,
          updatedAt: true,
          layoutPlugin: true,
        },
        orderBy: [desc(boxes.createdAt)],
        limit: pageSize,
        offset,
      }),
      where
        ? db.select({ count: count() }).from(boxes).where(where)
        : db.select({ count: count() }).from(boxes),
    ]);
    const total = Number(totalRows[0]?.count ?? 0);
    return {
      data: pagedBoxes,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  });

  // ─── DELETE /admin/api/v1/content/:type/:id ──────────────────────

  fastify.delete('/api/v1/content/:type/:id', async (request, reply) => {
    const { type, id } = request.params as { type: string; id: string };

    if (type === 'card') {
      const card = await db.query.cards.findFirst({ where: eq(cards.id, id) });
      if (!card) {
        throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
      }
      await CardService.delete(id, card.userId);
    } else if (type === 'box') {
      const box = await db.query.boxes.findFirst({ where: eq(boxes.id, id) });
      if (!box) {
        throw AppError.notFound(ErrorCode.BOX_NOT_FOUND, 'Box not found');
      }
      await db.delete(boxes).where(eq(boxes.id, id));
    } else {
      throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'type must be card or box');
    }

    return reply.status(204).send();
  });
};

export default adminRoutes;
