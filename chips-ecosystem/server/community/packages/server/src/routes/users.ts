import type { FastifyInstance } from 'fastify';
import { buildPagination, parsePagination } from '../lib/pagination.js';
import type { AuthSchemas } from '../schemas/auth.schemas.js';
import { UserService } from '../services/user.service.js';
import type { CardService } from '../services/card.service.js';
import type { BoxService } from '../services/box.service.js';
import type { RoomService } from '../services/room.service.js';
import type { Repositories } from '../repositories/types.js';

/**
 * 账号域路由（契约 §4.2/§4.3）：当前用户资料与改密、公开资料、用户内容列表与空间聚合。
 * 头像上传（POST /users/me/avatar，multipart 字节入口）依赖对象存储层，归对象存储臂交付
 * （见开发日志「臂边界」节），本臂不落占位。
 *
 * 可见性：本人列表（/users/me/*）额外包含私有与未就绪内容（§4.1）；
 * /users/:username/* 对所有者本人与管理员等效本人视角。
 */

export interface UsersRouteDeps {
  schemas: AuthSchemas;
  userService: UserService;
  cardService: CardService;
  boxService: BoxService;
  roomService: RoomService;
  repositories: Repositories;
}

export async function userRoutes(fastify: FastifyInstance, deps: UsersRouteDeps): Promise<void> {
  const { schemas, userService, cardService, boxService, roomService, repositories } = deps;

  fastify.get(
    '/api/v1/users/me',
    { preHandler: [fastify.authenticate], config: { noStore: true } },
    async (request) => {
      const user = await userService.getById(request.user?.userId ?? '');
      return { data: userService.toMeProfile(user) };
    }
  );

  fastify.patch(
    '/api/v1/users/me',
    { preHandler: [fastify.authenticate], config: { noStore: true } },
    async (request) => {
      const body = schemas.updateProfile.parse(request.body);
      const patch: { displayName?: string; bio?: string | null } = {};
      if (body.displayName !== undefined) {
        patch.displayName = body.displayName;
      }
      if (body.bio !== undefined) {
        patch.bio = body.bio;
      }
      const user = await userService.updateProfile(request.user?.userId ?? '', patch);
      return { data: userService.toMeProfile(user) };
    }
  );

  fastify.put(
    '/api/v1/users/me/password',
    { preHandler: [fastify.authenticate], config: { noStore: true } },
    async (request, reply) => {
      const body = schemas.changePassword.parse(request.body);
      const user = await userService.getById(request.user?.userId ?? '');
      await userService.changePassword(user, body.currentPassword, body.newPassword);
      // 除当前会话外的全部 refresh 会话被吊销（契约 §4.3）。
      await fastify.authService.revokeOtherSessions(user.id, request.user?.jti ?? null);
      return reply.status(204).send();
    }
  );

  fastify.get('/api/v1/users/:username', { config: { etag: true } }, async (request) => {
    const { username } = request.params as { username: string };
    const user = await userService.getByUsername(username);
    return { data: userService.toPublicProfile(user) };
  });

  fastify.get(
    '/api/v1/users/:username/cards',
    { preHandler: [fastify.optionalAuthenticate], config: { etag: true } },
    async (request) => {
      const { username } = request.params as { username: string };
      const owner = await userService.getByUsername(username);
      const includeAll = UserService.canViewAll(owner, request.user ?? null);
      const pagination = parsePagination(request.query);
      const result = await repositories.cards.listByUser(owner.id, { includeAll }, pagination);
      return {
        data: result.items.map((card) => cardService.toSummary(card)),
        pagination: buildPagination(pagination, result.total),
      };
    }
  );

  fastify.get(
    '/api/v1/users/:username/boxes',
    { preHandler: [fastify.optionalAuthenticate], config: { etag: true } },
    async (request) => {
      const { username } = request.params as { username: string };
      const owner = await userService.getByUsername(username);
      const includeAll = UserService.canViewAll(owner, request.user ?? null);
      const pagination = parsePagination(request.query);
      const result = await repositories.boxes.listByUser(owner.id, { includeAll }, pagination);
      return {
        data: result.items.map((box) => boxService.toSummary(box)),
        pagination: buildPagination(pagination, result.total),
      };
    }
  );

  fastify.get(
    '/api/v1/users/:username/rooms',
    { preHandler: [fastify.optionalAuthenticate], config: { etag: true } },
    async (request) => {
      const { username } = request.params as { username: string };
      const owner = await userService.getByUsername(username);
      const includeAll = UserService.canViewAll(owner, request.user ?? null);
      const pagination = parsePagination(request.query);
      const result = await repositories.rooms.listByUser(owner.id, { includeAll }, pagination);
      const rooms = await roomService.toRoomDtos(result.items, request.user ?? null);
      return { data: rooms, pagination: buildPagination(pagination, result.total) };
    }
  );

  fastify.get(
    '/api/v1/users/:username/space',
    { preHandler: [fastify.optionalAuthenticate], config: { etag: true } },
    async (request) => {
      const { username } = request.params as { username: string };
      const owner = await userService.getByUsername(username);
      const includeAll = UserService.canViewAll(owner, request.user ?? null);
      // 空间为单对象响应（契约 §4.3 ICommunitySpace）；根目录卡片/箱子子列表按
      // page/pageSize 限页，页元信息不适用单对象信封（裁定见开发日志）。
      const pagination = parsePagination(request.query);
      const [roomList, rootCards, rootBoxes] = await Promise.all([
        repositories.rooms.listAllByUser(owner.id, { includeAll }),
        repositories.cards.listRootByUser(owner.id, { includeAll }, pagination),
        repositories.boxes.listRootByUser(owner.id, { includeAll }, pagination),
      ]);
      const rooms = await roomService.toRoomDtos(roomList, request.user ?? null);
      return {
        data: {
          user: userService.toPublicProfile(owner),
          rooms,
          cards: rootCards.items.map((card) => cardService.toSummary(card)),
          boxes: rootBoxes.items.map((box) => boxService.toSummary(box)),
        },
      };
    }
  );
}
