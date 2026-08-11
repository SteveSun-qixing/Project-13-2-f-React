import type { FastifyPluginAsync } from 'fastify';
import { RoomService } from '../services/room.service';
import { CreateRoomSchema, UpdateRoomSchema, PaginationSchema } from '../schemas/content.schemas';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { uploadBuffer } from '../storage/s3';
import { Bucket } from '../storage/buckets';
import { CardService } from '../services/card.service';
import { BoxService } from '../services/box.service';
import { UserService } from '../services/user.service';

const roomRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── POST /api/v1/rooms ───────────────────────────────────────────

  fastify.post(
    '/api/v1/rooms',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = CreateRoomSchema.parse(request.body);
      const room = await RoomService.create(request.user!.userId, body);
      const counts = await RoomService.getContentCounts(room.id, request.user!.userId, room.userId);
      return reply.status(201).send({ data: RoomService.toDTO({ ...room, ...counts }) });
    },
  );

  // ─── GET /api/v1/users/:username/rooms ───────────────────────────

  fastify.get(
    '/api/v1/users/:username/rooms',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { username } = request.params as { username: string };
      const owner = await UserService.findByUsername(username);
      if (!owner || !owner.isActive) {
        throw AppError.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
      }

      const roomList = await RoomService.listByUser(owner.id, request.user?.userId ?? null);

      const roomsWithCounts = await Promise.all(
        roomList.map(async (r) => {
          const counts = await RoomService.getContentCounts(
            r.id,
            request.user?.userId ?? null,
            r.userId,
          );
          return RoomService.toDTO({ ...r, ...counts });
        }),
      );

      return { data: roomsWithCounts };
    },
  );

  // ─── GET /api/v1/rooms/:roomId ────────────────────────────────────

  fastify.get(
    '/api/v1/rooms/:roomId',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { roomId } = request.params as { roomId: string };
      const room = await RoomService.getAccessible(roomId, request.user?.userId ?? null);
      const counts = await RoomService.getContentCounts(
        room.id,
        request.user?.userId ?? null,
        room.userId,
      );
      return { data: RoomService.toDTO({ ...room, ...counts }) };
    },
  );

  // ─── PATCH /api/v1/rooms/:roomId ──────────────────────────────────

  fastify.patch(
    '/api/v1/rooms/:roomId',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { roomId } = request.params as { roomId: string };
      const body = UpdateRoomSchema.parse(request.body);
      const room = await RoomService.update(roomId, request.user!.userId, body);
      const counts = await RoomService.getContentCounts(room.id, request.user!.userId, room.userId);
      return { data: RoomService.toDTO({ ...room, ...counts }) };
    },
  );

  // ─── DELETE /api/v1/rooms/:roomId ─────────────────────────────────

  fastify.delete(
    '/api/v1/rooms/:roomId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { roomId } = request.params as { roomId: string };
      await RoomService.delete(roomId, request.user!.userId);
      return reply.status(204).send();
    },
  );

  // ─── POST /api/v1/rooms/:roomId/cover ─────────────────────────────

  fastify.post(
    '/api/v1/rooms/:roomId/cover',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { roomId } = request.params as { roomId: string };

      const data = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } });
      if (!data) {
        throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'No file provided');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        throw AppError.badRequest(
          ErrorCode.FILE_TYPE_INVALID,
          'Cover must be a JPEG, PNG, or WebP image',
        );
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);

      const ext = data.mimetype.split('/')[1] ?? 'jpg';
      const coverUrl = await uploadBuffer({
        bucket: Bucket.COVERS,
        key: `rooms/${roomId}/cover.${ext}`,
        body: buffer,
        contentType: data.mimetype,
      });

      const room = await RoomService.setCover(roomId, request.user!.userId, coverUrl);
      return { data: { coverUrl: room.coverUrl } };
    },
  );

  // ─── GET /api/v1/rooms/:roomId/contents ──────────────────────────

  fastify.get(
    '/api/v1/rooms/:roomId/contents',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { roomId } = request.params as { roomId: string };
      const qs = PaginationSchema.parse(request.query);

      const room = await RoomService.getAccessible(roomId, request.user?.userId ?? null);

      const [cardResult, boxResult] = await Promise.all([
        CardService.listByRoom(room.id, request.user?.userId ?? null, room.userId, qs),
        BoxService.listByRoom(room.id, request.user?.userId ?? null, room.userId, qs),
      ]);

      return {
        data: {
          cards: cardResult.items.map(CardService.toSummaryDTO),
          boxes: boxResult.items.map(BoxService.toSummaryDTO),
        },
        pagination: { cardsPagination: cardResult.pagination, boxesPagination: boxResult.pagination },
      };
    },
  );
};

export default roomRoutes;
