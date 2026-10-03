import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors/AppError.js';
import { buildPagination, parsePagination } from '../lib/pagination.js';
import type { Repositories } from '../repositories/types.js';
import type { RoomService } from '../services/room.service.js';
import type { CardService } from '../services/card.service.js';
import type { BoxService } from '../services/box.service.js';

/**
 * 房间只读路由（契约 §4.2、§4.4）：房间详情与房间内容列表。
 * 房间公开不代表房间内内容公开：房间内卡片/箱子仍按各自 visibility 判定；
 * cardCount / boxCount 表示当前请求者可见数量。
 * 写操作（创建/修改/删除/封面上传）归内容写域臂、对象存储臂。
 */

export interface RoomsRouteDeps {
  repositories: Repositories;
  roomService: RoomService;
  cardService: CardService;
  boxService: BoxService;
}

export async function roomRoutes(fastify: FastifyInstance, deps: RoomsRouteDeps): Promise<void> {
  const { repositories, roomService, cardService, boxService } = deps;

  fastify.get(
    '/api/v1/rooms/:roomId',
    { preHandler: [fastify.optionalAuthenticate], config: { etag: true } },
    async (request) => {
      const { roomId } = request.params as { roomId: string };
      const room = await repositories.rooms.findById(roomId);
      if (room === null || !roomReadable(room, request.user ?? null)) {
        throw AppError.notFound('COMMUNITY_ROOM_NOT_FOUND', '房间不存在或不可见');
      }
      return { data: await roomService.toRoomDto(room, request.user ?? null) };
    }
  );

  fastify.get(
    '/api/v1/rooms/:roomId/contents',
    { preHandler: [fastify.optionalAuthenticate], config: { etag: true } },
    async (request) => {
      const { roomId } = request.params as { roomId: string };
      const room = await repositories.rooms.findById(roomId);
      if (room === null || !roomReadable(room, request.user ?? null)) {
        throw AppError.notFound('COMMUNITY_ROOM_NOT_FOUND', '房间不存在或不可见');
      }
      const includeAll =
        request.user !== null &&
        (request.user.userId === room.userId || request.user.role === 'admin');
      const pagination = parsePagination(request.query);
      // 房间内容视图：卡片与箱子按发布时间（createdAt）倒序合并分页，列表项以 type
      // 区分（契约 §4.4：视图模型仅在本接口出现）。
      const [cardPage, boxPage] = await Promise.all([
        repositories.cards.listByRoom(roomId, { includeAll }, pagination),
        repositories.boxes.listByRoom(roomId, { includeAll }, pagination),
      ]);
      const merged = [
        ...cardPage.items.map((card) => ({
          type: 'card' as const,
          at: card.createdAt,
          item: { type: 'card' as const, ...cardService.toSummary(card) },
        })),
        ...boxPage.items.map((box) => ({
          type: 'box' as const,
          at: box.createdAt,
          item: { type: 'box' as const, ...boxService.toSummary(box) },
        })),
      ]
        .sort((left, right) => right.at.getTime() - left.at.getTime())
        .slice(0, pagination.pageSize)
        .map((entry) => entry.item);
      const total = cardPage.total + boxPage.total;
      return {
        data: merged,
        pagination: buildPagination(pagination, total),
      };
    }
  );

  function roomReadable(
    room: { visibility: 'public' | 'private'; userId: string },
    requester: { userId: string; role: string } | null
  ): boolean {
    if (room.visibility === 'public') {
      return true;
    }
    return requester !== null && (requester.userId === room.userId || requester.role === 'admin');
  }
}
