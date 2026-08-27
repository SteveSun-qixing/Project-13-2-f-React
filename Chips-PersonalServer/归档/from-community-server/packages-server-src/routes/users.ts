import type { FastifyPluginAsync } from 'fastify';
import { UserService } from '../services/user.service';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { ChangePasswordSchema, UpdateProfileSchema } from '../schemas/auth.schemas';
import { uploadBuffer } from '../storage/s3';
import { Bucket } from '../storage/buckets';

const userRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── GET /api/v1/users/me ─────────────────────────────────────────

  fastify.get(
    '/api/v1/users/me',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = await UserService.findById(request.user!.userId);
      if (!user) {
        throw AppError.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
      }
      return { data: UserService.toPrivateProfile(user) };
    },
  );

  // ─── PATCH /api/v1/users/me ───────────────────────────────────────

  fastify.patch(
    '/api/v1/users/me',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const body = UpdateProfileSchema.parse(request.body);
      const user = await UserService.update(request.user!.userId, body);
      return { data: UserService.toPrivateProfile(user) };
    },
  );

  // ─── PUT /api/v1/users/me/password ───────────────────────────────

  fastify.put(
    '/api/v1/users/me/password',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = ChangePasswordSchema.parse(request.body);
      await UserService.changePassword(request.user!.userId, body.oldPassword, body.newPassword);
      return reply.status(204).send();
    },
  );

  // ─── POST /api/v1/users/me/avatar ─────────────────────────────────

  fastify.post(
    '/api/v1/users/me/avatar',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const data = await request.file({
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      });

      if (!data) {
        throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'No file provided');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(data.mimetype)) {
        throw AppError.badRequest(
          ErrorCode.FILE_TYPE_INVALID,
          'Avatar must be a JPEG, PNG, WebP, or GIF image',
        );
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);

      const ext = data.mimetype.split('/')[1] ?? 'jpg';
      const key = `${request.user!.userId}/avatar.${ext}`;

      const avatarUrl = await uploadBuffer({
        bucket: Bucket.AVATARS,
        key,
        body: buffer,
        contentType: data.mimetype,
      });

      const user = await UserService.update(request.user!.userId, { avatarUrl });
      return { data: { avatarUrl: user.avatarUrl } };
    },
  );

  // ─── GET /api/v1/users/:username ─────────────────────────────────

  fastify.get('/api/v1/users/:username', async (request) => {
    const { username } = request.params as { username: string };
    const user = await UserService.findByUsername(username);
    if (!user || !user.isActive) {
      throw AppError.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
    }
    return { data: UserService.toPublicProfile(user) };
  });
};

export default userRoutes;
