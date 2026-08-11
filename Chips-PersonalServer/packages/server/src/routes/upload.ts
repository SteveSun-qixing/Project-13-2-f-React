import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import type { FastifyPluginAsync } from 'fastify';
import { BoxService } from '../services/box.service';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { UploadBoxSchema } from '../schemas/content.schemas';
import { env } from '../config/env';
import { RoomService } from '../services/room.service';
import { Bucket } from '../storage/buckets';
import { sha256File, uploadFile } from '../storage/s3';

const MAX_BOX_SIZE = env.MAX_BOX_SIZE_MB * 1024 * 1024;
const BOX_FILE_MIME_TYPE = 'application/vnd.chips.box+zip';

function createBoxUploadTempFilePath(): string {
  return path.join(os.tmpdir(), `ccps-upload-${uuidv4()}.box`);
}

async function drainUploadStream(stream: AsyncIterable<unknown>): Promise<void> {
  for await (const chunk of stream) {
    void chunk;
  }
}

async function writeUploadStreamToTempFile(params: {
  stream: NodeJS.ReadableStream;
  tempFilePath: string;
  maxSizeBytes: number;
  tooLargeMessage: string;
}): Promise<number> {
  let fileSizeBytes = 0;

  const sizeLimitStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      fileSizeBytes += chunk.length;
      if (fileSizeBytes > params.maxSizeBytes) {
        callback(AppError.tooLarge(ErrorCode.FILE_TOO_LARGE, params.tooLargeMessage));
        return;
      }

      callback(null, chunk);
    },
  });

  try {
    await pipeline(params.stream, sizeLimitStream, fs.createWriteStream(params.tempFilePath));
    return fileSizeBytes;
  } catch (err) {
    try {
      fs.rmSync(params.tempFilePath, { force: true });
    } catch {
      // ignore cleanup failure; original upload error is more useful
    }
    throw err;
  }
}

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/upload/box',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parts = request.parts();

      let tempFilePath: string | null = null;
      let fileSizeBytes = 0;
      let roomId: string | undefined;
      let visibility: 'public' | 'private' = 'public';

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          if (!part.filename?.endsWith('.box')) {
            await drainUploadStream(part.file);
            throw AppError.badRequest(
              ErrorCode.FILE_TYPE_INVALID,
              'Only .box files are allowed',
            );
          }

          tempFilePath = createBoxUploadTempFilePath();
          fileSizeBytes = await writeUploadStreamToTempFile({
            stream: part.file,
            tempFilePath,
            maxSizeBytes: MAX_BOX_SIZE,
            tooLargeMessage: `Box file must be smaller than ${env.MAX_BOX_SIZE_MB}MB`,
          });
        } else if (part.type === 'field') {
          if (part.fieldname === 'roomId') roomId = part.value as string;
          else if (part.fieldname === 'visibility') {
            visibility = (part.value as string) === 'private' ? 'private' : 'public';
          }
        }
      }

      if (!tempFilePath || fileSizeBytes === 0) {
        throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'No file provided');
      }

      try {
        const opts = UploadBoxSchema.parse({ roomId, visibility });
        if (opts.roomId) {
          await RoomService.assertOwnedByUser(opts.roomId, request.user!.userId);
        }

        const unpackResult = await BoxService.unpack(tempFilePath);
        try {
          const sourceBoxSha256 = await sha256File(tempFilePath);
          const sourceBoxKey = `boxes/${request.user!.userId}/uploads/${uuidv4()}/box.box`;
          await uploadFile({
            bucket: Bucket.BOX_FILES,
            key: sourceBoxKey,
            filePath: tempFilePath,
            contentType: BOX_FILE_MIME_TYPE,
          });

          const box = await BoxService.create({
            userId: request.user!.userId,
            roomId: opts.roomId,
            visibility: opts.visibility,
            fileSizeBytes,
            sourceBoxBucket: Bucket.BOX_FILES,
            sourceBoxKey,
            sourceBoxSha256,
            metadata: unpackResult.metadata,
            structure: unpackResult.structure,
            content: unpackResult.content,
          });
          fs.rmSync(tempFilePath, { force: true });
          tempFilePath = null;

          return reply.status(201).send({
            data: {
              boxId: box.id,
              title: box.title,
            },
          });
        } finally {
          fs.rmSync(unpackResult.tempDir, { recursive: true, force: true });
        }
      } catch (err) {
        if (tempFilePath) {
          try {
            fs.rmSync(tempFilePath, { force: true });
          } catch {
            // ignore cleanup failure; request error will be reported
          }
        }
        throw err;
      }
    },
  );
};

export default uploadRoutes;
