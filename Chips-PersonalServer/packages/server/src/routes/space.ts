import type { FastifyPluginAsync } from 'fastify';
import { UserService } from '../services/user.service';
import { RoomService } from '../services/room.service';
import { CardService } from '../services/card.service';
import { BoxService } from '../services/box.service';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';

const spaceRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/users/:username/space
   * 返回用户空间概览：用户信息 + 房间列表 + 根目录卡片 + 根目录箱子
   */
  fastify.get(
    '/api/v1/users/:username/space',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { username } = request.params as { username: string };
      const requesterId = request.user?.userId ?? null;

      const owner = await UserService.findByUsername(username);
      if (!owner || !owner.isActive) {
        throw AppError.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
      }

      const isOwner = requesterId === owner.id;

      const [roomList, rootCards, rootBoxes] = await Promise.all([
        RoomService.listByUser(owner.id, requesterId),
        CardService.listRootByUser(owner.id, requesterId, { page: 1, pageSize: 30 }),
        BoxService.listRootByUser(owner.id, requesterId, { page: 1, pageSize: 30 }),
      ]);

      const roomsWithCounts = await Promise.all(
        roomList.map(async (r) => {
          const counts = await RoomService.getContentCounts(
            r.id,
            requesterId,
            r.userId,
          );
          return RoomService.toDTO({ ...r, ...counts });
        }),
      );

      return {
        data: {
          user: UserService.toPublicProfile(owner),
          isOwner,
          rooms: roomsWithCounts,
          rootCards: rootCards.items.map(CardService.toSummaryDTO),
          rootBoxes: rootBoxes.items.map(BoxService.toSummaryDTO),
        },
      };
    },
  );
};

export default spaceRoutes;
