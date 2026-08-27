import { desc, eq, and, or, ilike, count } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client';
import { cards } from '../db/schema/cards';
import { boxes } from '../db/schema/boxes';
import { users } from '../db/schema/users';
import { PaginationSchema, SearchSchema } from '../schemas/content.schemas';
import { CardService } from '../services/card.service';
import { BoxService } from '../services/box.service';
import { UserService } from '../services/user.service';

function toTotal(rows: Array<{ count: number }>): number {
  return Number(rows[0]?.count ?? 0);
}

const discoverRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── GET /api/v1/discover/cards ───────────────────────────────────

  fastify.get('/api/v1/discover/cards', async (request) => {
    const qs = PaginationSchema.parse(request.query);
    const { page, pageSize } = qs;
    const offset = (page - 1) * pageSize;

    const where = and(eq(cards.visibility, 'public'), eq(cards.status, 'ready'));
    const [pagedCards, totalRows] = await Promise.all([
      db.query.cards.findMany({
        where,
        orderBy: [desc(cards.createdAt)],
        limit: pageSize,
        offset,
      }),
      db.select({ count: count() }).from(cards).where(where),
    ]);

    const total = toTotal(totalRows);
    const items = pagedCards.map(CardService.toSummaryDTO);

    return {
      data: items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  });

  // ─── GET /api/v1/discover/boxes ───────────────────────────────────

  fastify.get('/api/v1/discover/boxes', async (request) => {
    const qs = PaginationSchema.parse(request.query);
    const { page, pageSize } = qs;
    const offset = (page - 1) * pageSize;

    const where = eq(boxes.visibility, 'public');
    const [pagedBoxes, totalRows] = await Promise.all([
      db.query.boxes.findMany({
        where,
        columns: {
          id: true,
          title: true,
          coverUrl: true,
          coverRatio: true,
          documentUrl: true,
          layoutPlugin: true,
          visibility: true,
          createdAt: true,
        },
        orderBy: [desc(boxes.createdAt)],
        limit: pageSize,
        offset,
      }),
      db.select({ count: count() }).from(boxes).where(where),
    ]);

    const total = toTotal(totalRows);
    const items = pagedBoxes.map(BoxService.toSummaryDTO);

    return {
      data: items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  });

  // ─── GET /api/v1/search ───────────────────────────────────────────

  fastify.get('/api/v1/search', async (request) => {
    const qs = SearchSchema.parse(request.query);
    const { q, type, page, pageSize } = qs;
    const offset = (page - 1) * pageSize;
    const pattern = `%${q}%`;

    const result: {
      cards?: ReturnType<typeof CardService.toSummaryDTO>[];
      boxes?: ReturnType<typeof BoxService.toSummaryDTO>[];
      users?: ReturnType<typeof UserService.toPublicProfile>[];
    } = {};

    if (type.includes('card')) {
      const matched = await db.query.cards.findMany({
        where: and(
          eq(cards.visibility, 'public'),
          eq(cards.status, 'ready'),
          ilike(cards.title, pattern),
        ),
        orderBy: [desc(cards.createdAt)],
        limit: pageSize,
        offset,
      });
      result.cards = matched.map(CardService.toSummaryDTO);
    }

    if (type.includes('box')) {
      const matched = await db.query.boxes.findMany({
        where: and(eq(boxes.visibility, 'public'), ilike(boxes.title, pattern)),
        columns: {
          id: true,
          title: true,
          coverUrl: true,
          coverRatio: true,
          documentUrl: true,
          layoutPlugin: true,
          visibility: true,
          createdAt: true,
        },
        orderBy: [desc(boxes.createdAt)],
        limit: pageSize,
        offset,
      });
      result.boxes = matched.map(BoxService.toSummaryDTO);
    }

    if (type.includes('user')) {
      const matched = await db.query.users.findMany({
        where: and(
          eq(users.isActive, true),
          or(ilike(users.username, pattern), ilike(users.displayName, pattern)),
        ),
        orderBy: [desc(users.createdAt)],
        limit: pageSize,
        offset,
      });
      result.users = matched.map(UserService.toPublicProfile);
    }

    return { data: result, pagination: { page, pageSize } };
  });
};

export default discoverRoutes;
