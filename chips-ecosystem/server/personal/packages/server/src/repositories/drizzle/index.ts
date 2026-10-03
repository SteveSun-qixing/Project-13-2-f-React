import { and, count, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { PersonalDb } from '../../db/client.js';
import { boxes, cards, type Box, type Card } from '../../db/schema/index.js';
import { offsetOf, type PagedItems, type PaginationParams } from '../../lib/pagination.js';
import type { BoxRepository, CardRepository, Repositories } from '../types.js';

/**
 * Drizzle 仓库适配器（PG 端口的生产装配；测试装配见 tests/helpers 内存 fake）。
 * 列表排序固定 createdAt 倒序（契约 §6.1）；私密可见性在服务层按「不存在」处理。
 */

class DrizzleCardRepository implements CardRepository {
  constructor(private readonly db: PersonalDb) {}

  async findById(id: string): Promise<Card | null> {
    const rows = await this.db.select().from(cards).where(eq(cards.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listPublic(pagination: PaginationParams): Promise<PagedItems<Card>> {
    return this.list(eq(cards.visibility, 'public'), pagination);
  }

  async listAll(pagination: PaginationParams): Promise<PagedItems<Card>> {
    return this.list(undefined, pagination);
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
          eq(cards.status, 'ready'),
          eq(cards.visibility, 'public')
        )
      );
  }

  private async list(
    where: SQL | undefined,
    pagination: PaginationParams
  ): Promise<PagedItems<Card>> {
    const offset = offsetOf(pagination);
    const [items, totalRows] = await Promise.all([
      this.db
        .select()
        .from(cards)
        .where(where)
        .orderBy(desc(cards.createdAt))
        .limit(pagination.pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(cards).where(where),
    ]);
    return { items, total: Number(totalRows[0]?.value ?? 0) };
  }
}

class DrizzleBoxRepository implements BoxRepository {
  constructor(private readonly db: PersonalDb) {}

  async findById(id: string): Promise<Box | null> {
    const rows = await this.db.select().from(boxes).where(eq(boxes.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listPublic(pagination: PaginationParams): Promise<PagedItems<Box>> {
    const offset = offsetOf(pagination);
    const where = eq(boxes.visibility, 'public');
    const [items, totalRows] = await Promise.all([
      this.db
        .select()
        .from(boxes)
        .where(where)
        .orderBy(desc(boxes.createdAt))
        .limit(pagination.pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(boxes).where(where),
    ]);
    return { items, total: Number(totalRows[0]?.value ?? 0) };
  }
}

export function createDrizzleRepositories(db: PersonalDb): Repositories {
  return {
    cards: new DrizzleCardRepository(db),
    boxes: new DrizzleBoxRepository(db),
  };
}
