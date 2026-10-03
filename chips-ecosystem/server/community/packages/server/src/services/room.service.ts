import { toRfc3339 } from '../lib/pagination.js';
import type { Room } from '../db/schema/index.js';
import type { ICommunityRoom } from '../dto/community.js';

/**
 * 房间服务（只读面）：房间 DTO 装配。cardCount / boxCount 表示当前请求者可见数量
 * （契约 §4.4）——owner/admin 视角为全量计数，访客视角仅公开就绪内容。
 */

export interface RoomServiceDeps {
  repositories: {
    cards: { countByRoom(roomId: string, opts: { includeAll: boolean }): Promise<number> };
    boxes: { countByRoom(roomId: string, opts: { includeAll: boolean }): Promise<number> };
  };
}

export class RoomService {
  private readonly repositories: RoomServiceDeps['repositories'];

  constructor(deps: RoomServiceDeps) {
    this.repositories = deps.repositories;
  }

  async toRoomDto(
    room: Room,
    requester: { userId: string; role: string } | null
  ): Promise<ICommunityRoom> {
    const includeAll =
      requester !== null && (requester.userId === room.userId || requester.role === 'admin');
    const [cardCount, boxCount] = await Promise.all([
      this.repositories.cards.countByRoom(room.id, { includeAll }),
      this.repositories.boxes.countByRoom(room.id, { includeAll }),
    ]);
    return {
      id: room.id,
      userId: room.userId,
      name: room.name,
      slug: room.slug,
      description: room.description ?? null,
      coverUrl: room.coverUrl ?? null,
      visibility: room.visibility,
      cardCount,
      boxCount,
      createdAt: toRfc3339(room.createdAt),
      updatedAt: toRfc3339(room.updatedAt),
    };
  }

  async toRoomDtos(
    roomList: Room[],
    requester: { userId: string; role: string } | null
  ): Promise<ICommunityRoom[]> {
    return Promise.all(roomList.map((room) => this.toRoomDto(room, requester)));
  }
}
