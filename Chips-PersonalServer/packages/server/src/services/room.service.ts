import { eq, and, count } from 'drizzle-orm';
import { db } from '../db/client';
import { rooms, type Room, type NewRoom } from '../db/schema/rooms';
import { cards } from '../db/schema/cards';
import { boxes } from '../db/schema/boxes';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import type { CreateRoomInput, UpdateRoomInput } from '../schemas/content.schemas';
import { createRoomSlugBase } from '../utils/room-slug';

/**
 * 确保 slug 在该用户下唯一（追加 -2, -3 …）
 */
async function ensureUniqueSlug(userId: string, base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  let counter = 1;

  for (;;) {
    const existing = await db.query.rooms.findFirst({
      where: and(eq(rooms.userId, userId), eq(rooms.slug, candidate)),
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    counter++;
    candidate = `${base}-${counter}`;
  }
}

export const RoomService = {
  async create(userId: string, input: CreateRoomInput): Promise<Room> {
    const slug = await ensureUniqueSlug(userId, createRoomSlugBase(input.name));

    const [room] = await db
      .insert(rooms)
      .values({
        userId,
        name: input.name,
        slug,
        description: input.description,
        visibility: input.visibility,
      } satisfies Partial<NewRoom> as NewRoom)
      .returning();

    return room;
  },

  async findById(roomId: string): Promise<Room | undefined> {
    return db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  },

  async findBySlug(userId: string, slug: string): Promise<Room | undefined> {
    return db.query.rooms.findFirst({
      where: and(eq(rooms.userId, userId), eq(rooms.slug, slug)),
    });
  },

  async assertOwnedByUser(roomId: string, userId: string): Promise<Room> {
    const room = await this.findById(roomId);
    if (!room) {
      throw AppError.notFound(ErrorCode.ROOM_NOT_FOUND, 'Room not found');
    }
    if (room.userId !== userId) {
      throw AppError.forbidden(ErrorCode.ROOM_FORBIDDEN, 'You do not own this room');
    }
    return room;
  },

  /**
   * 获取用户房间列表
   * @param requesterId 请求者 ID（null 表示访客）
   */
  async listByUser(ownerId: string, requesterId: string | null): Promise<Room[]> {
    const isOwner = requesterId === ownerId;

    const where = isOwner
      ? eq(rooms.userId, ownerId)
      : and(eq(rooms.userId, ownerId), eq(rooms.visibility, 'public'));

    return db.query.rooms.findMany({
      where,
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  },

  /** 校验房间访问权限，返回房间对象（私有房间对非所有者返回 404） */
  async getAccessible(roomId: string, requesterId: string | null): Promise<Room> {
    const room = await this.findById(roomId);
    if (!room) {
      throw AppError.notFound(ErrorCode.ROOM_NOT_FOUND, 'Room not found');
    }
    if (room.visibility === 'private' && room.userId !== requesterId) {
      // 故意返回 404 而非 403，不泄露私有房间的存在性
      throw AppError.notFound(ErrorCode.ROOM_NOT_FOUND, 'Room not found');
    }
    return room;
  },

  async update(roomId: string, userId: string, patch: UpdateRoomInput): Promise<Room> {
    const room = await this.assertOwnedByUser(roomId, userId);

    let slug = room.slug;
    if (patch.name && patch.name !== room.name) {
      slug = await ensureUniqueSlug(userId, createRoomSlugBase(patch.name), roomId);
    }

    const [updated] = await db
      .update(rooms)
      .set({ ...patch, slug, updatedAt: new Date() })
      .where(eq(rooms.id, roomId))
      .returning();

    return updated;
  },

  async delete(roomId: string, userId: string): Promise<void> {
    await this.assertOwnedByUser(roomId, userId);

    const [roomCards, roomBoxes] = await Promise.all([
      db.query.cards.findMany({ where: eq(cards.roomId, roomId) }),
      db.query.boxes.findMany({ where: eq(boxes.roomId, roomId) }),
    ]);

    const [{ CardService }, { BoxService }] = await Promise.all([
      import('./card.service.js'),
      import('./box.service.js'),
    ]);

    await Promise.all([
      ...roomCards.map((card) => CardService.delete(card.id, userId)),
      ...roomBoxes.map((box) => BoxService.delete(box.id, userId)),
    ]);

    await db.delete(rooms).where(eq(rooms.id, roomId));
  },

  /** 更新房间封面 */
  async setCover(roomId: string, userId: string, coverUrl: string): Promise<Room> {
    await this.assertOwnedByUser(roomId, userId);
    const [updated] = await db
      .update(rooms)
      .set({ coverUrl, updatedAt: new Date() })
      .where(eq(rooms.id, roomId))
      .returning();
    return updated;
  },

  /** 统计当前请求者在房间内可见的卡片数和箱子数 */
  async getContentCounts(
    roomId: string,
    requesterId: string | null,
    ownerUserId: string,
  ): Promise<{ cardCount: number; boxCount: number }> {
    const isOwner = requesterId === ownerUserId;

    const [cardResult] = await db
      .select({ count: count() })
      .from(cards)
      .where(
        and(
          eq(cards.roomId, roomId),
          isOwner ? undefined : eq(cards.visibility, 'public'),
          isOwner ? undefined : eq(cards.status, 'ready'),
        ),
      );

    const [boxResult] = await db
      .select({ count: count() })
      .from(boxes)
      .where(
        and(
          eq(boxes.roomId, roomId),
          isOwner ? undefined : eq(boxes.visibility, 'public'),
        ),
      );

    return {
      cardCount: Number(cardResult?.count ?? 0),
      boxCount: Number(boxResult?.count ?? 0),
    };
  },

  toDTO(room: Room & { cardCount?: number; boxCount?: number }) {
    return {
      id: room.id,
      userId: room.userId,
      name: room.name,
      slug: room.slug,
      description: room.description,
      coverUrl: room.coverUrl,
      visibility: room.visibility,
      cardCount: room.cardCount ?? 0,
      boxCount: room.boxCount ?? 0,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  },
};
