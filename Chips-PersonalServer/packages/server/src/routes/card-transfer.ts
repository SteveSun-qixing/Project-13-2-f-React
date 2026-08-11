import * as path from 'path';
import { and, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client';
import { cards } from '../db/schema/cards';
import { uploadSessions } from '../db/schema/upload-sessions';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { RoomService } from '../services/room.service';
import { CardService } from '../services/card.service';
import { BoxService } from '../services/box.service';
import { CardRenderCacheService } from '../services/card-render-cache.service';
import { UploadSessionService } from '../services/upload-session.service';
import { Bucket } from '../storage/buckets';
import { buildObjectUrl, createPresignedGetUrl, createPresignedPutUrl, headObject } from '../storage/s3';
import { env } from '../config/env';
import {
  CompleteBoxTransferUploadSessionSchema,
  CompleteCardTransferUploadSessionSchema,
  CreateCardTransferDownloadSessionSchema,
  CreateCardTransferUploadSessionSchema,
  PresignCardTransferObjectsSchema,
} from '../schemas/card-transfer.schemas';

const TRANSFER_SCHEMA_VERSION = '1.0.0';
const NETWORK_CARD_MIME_TYPE = 'application/vnd.chips.card+zip';
const BOX_FILE_MIME_TYPE = 'application/vnd.chips.box+zip';
const DOWNLOAD_URL_TTL_SECONDS = 900;

interface TransferSessionMetadata {
  transferKind?: 'network-resource-card' | 'box-source';
  cardId?: string;
  versionId?: string;
  networkCardObjectKey?: string;
  resourcePrefix?: string;
  boxId?: string;
  boxFileObjectKey?: string;
}

interface CardTransferSessionMetadata {
  transferKind: 'network-resource-card';
  cardId: string;
  versionId: string;
  networkCardObjectKey: string;
  resourcePrefix: string;
}

interface BoxTransferSessionMetadata {
  transferKind: 'box-source';
  boxId: string;
  versionId: string;
  boxFileObjectKey: string;
  resourcePrefix: string;
}

interface NetworkCardManifestResource {
  originalRelativePath: string;
  networkUrl: string;
  bucket: string;
  objectKey: string;
  publicUrl?: string | null;
  sizeBytes: number;
  mimeType?: string | null;
}

interface NetworkCardResourceManifest {
  schemaVersion?: string;
  mode?: string;
  cardId?: string;
  cardVersionId?: string;
  networkCard?: {
    bucket?: string;
    objectKey?: string;
    publicUrl?: string | null;
    sizeBytes?: number;
    mimeType?: string | null;
  };
  resources?: NetworkCardManifestResource[];
  restoreManifest?: unknown;
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, `Invalid card resource path: ${relativePath}`);
  }
  return normalized;
}

function getTransferMetadata(value: unknown): TransferSessionMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as TransferSessionMetadata;
}

function assertTransferSessionMetadata(
  metadata: TransferSessionMetadata,
): CardTransferSessionMetadata | BoxTransferSessionMetadata {
  if (metadata.transferKind === 'box-source') {
    if (!metadata.boxId || !metadata.versionId || !metadata.boxFileObjectKey || !metadata.resourcePrefix) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Upload session is not a box-source transfer session',
      );
    }
    return metadata as BoxTransferSessionMetadata;
  }
  if (
    metadata.transferKind !== 'network-resource-card' ||
    !metadata.cardId ||
    !metadata.versionId ||
    !metadata.networkCardObjectKey ||
    !metadata.resourcePrefix
  ) {
    throw AppError.badRequest(
      ErrorCode.VALIDATION_ERROR,
      'Upload session is not a card-transfer network resource card session',
    );
  }
  return metadata as CardTransferSessionMetadata;
}

function toCardTitle(fileName?: string): string {
  if (!fileName) {
    return '处理中…';
  }
  return path.posix.basename(fileName.replace(/\\/g, '/'), '.card') || fileName;
}

function toBoxTitle(fileName?: string): string {
  if (!fileName) {
    return '处理中…';
  }
  return path.posix.basename(fileName.replace(/\\/g, '/'), '.box') || fileName;
}

function getNetworkCardManifest(value: unknown): NetworkCardResourceManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Card has no network resource restore manifest');
  }
  const manifest = value as NetworkCardResourceManifest;
  if (manifest.mode !== 'network-resource-card' || !manifest.networkCard || !Array.isArray(manifest.resources)) {
    throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Card is not a network resource card');
  }
  return manifest;
}

function assertRestoreManifestStructure(restoreManifest: unknown): void {
  if (restoreManifest === undefined || restoreManifest === null) {
    return;
  }
  if (typeof restoreManifest !== 'object' || Array.isArray(restoreManifest)) {
    throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'restoreManifest must be an object');
  }
  const manifest = restoreManifest as Record<string, unknown>;
  if (typeof manifest.schemaVersion !== 'string' || manifest.schemaVersion.trim().length === 0) {
    throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'restoreManifest.schemaVersion is required');
  }
  if (manifest.zipEntries !== undefined && !Array.isArray(manifest.zipEntries)) {
    throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'restoreManifest.zipEntries must be an array');
  }
  if (manifest.resources !== undefined && !Array.isArray(manifest.resources)) {
    throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'restoreManifest.resources must be an array');
  }
}

async function assertUploadedObject(params: {
  bucket: string;
  objectKey: string;
  expectedSizeBytes: number;
  label: string;
}): Promise<void> {
  const meta = await headObject({
    bucket: params.bucket,
    key: params.objectKey,
  });
  if (typeof meta.contentLength === 'number' && Number(meta.contentLength) !== Number(params.expectedSizeBytes)) {
    throw AppError.badRequest(
      ErrorCode.VALIDATION_ERROR,
      `Uploaded object size mismatch: ${params.label}`,
      {
        objectKey: params.objectKey,
        expectedSizeBytes: params.expectedSizeBytes,
        actualSizeBytes: meta.contentLength,
      },
    );
  }
}

function buildDownloadObject(bucket: string, objectKey: string, publicUrl?: string | null, fileName?: string) {
  const directUrl =
    publicUrl && publicUrl.trim().length > 0
      ? publicUrl
      : bucket === Bucket.CARD_RESOURCES
        ? buildObjectUrl(Bucket.CARD_RESOURCES, objectKey)
        : null;
  const signed = createPresignedGetUrl({
    bucket,
    key: objectKey,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    responseContentDisposition: fileName ? `attachment; filename="${encodeURIComponent(fileName)}"` : undefined,
  });
  return {
    bucket,
    objectKey,
    downloadUrl: directUrl ?? signed.url,
    presignedUrl: signed.url,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    method: signed.method,
    headers: signed.headers,
  };
}

const cardTransferRoutes: FastifyPluginAsync = async (fastify) => {
  const requireJsonBody = async (request: { headers: { 'content-type'?: string } }) => {
    const contentType = request.headers['content-type'];
    if (!contentType || !contentType.toLowerCase().startsWith('application/json')) {
      throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'card-transfer endpoints only accept JSON control-plane payloads');
    }
  };

  fastify.post(
    '/api/v1/card-transfer/upload-sessions',
    { preHandler: [requireJsonBody, fastify.authenticate] },
    async (request, reply) => {
      const body = CreateCardTransferUploadSessionSchema.parse(request.body);
      if (body.roomId) {
        await RoomService.assertOwnedByUser(body.roomId, request.user!.userId);
      }

      if (body.contentType === 'box') {
        const session = await UploadSessionService.create(request.user!.userId, {
          contentType: 'box',
          fileName: body.fileName,
          roomId: body.roomId ?? null,
          visibility: 'public',
          idempotencyKey: body.idempotencyKey,
          client: body.client,
        });
        const box = await BoxService.createPlaceholder({
          userId: request.user!.userId,
          title: toBoxTitle(body.fileName),
          roomId: body.roomId ?? undefined,
          visibility: 'public',
          publishedByClient: body.client?.name ?? 'chips-box-transfer',
        });

        const resourcePrefix = `boxes/${box.id}/versions/${session.id}`;
        const boxFileObjectKey = `${resourcePrefix}/box.box`;

        await db
          .update(uploadSessions)
          .set({
            resourcePrefix,
            clientMetadata: {
              ...(session.clientMetadata && typeof session.clientMetadata === 'object'
                ? session.clientMetadata
                : {}),
              transferKind: 'box-source',
              boxId: box.id,
              versionId: session.id,
              resourcePrefix,
              boxFileObjectKey,
            },
            updatedAt: new Date(),
          })
          .where(eq(uploadSessions.id, session.id));

        return reply.status(201).send({
          data: {
            uploadId: session.id,
            boxId: box.id,
            versionId: session.id,
            expiresAt: session.expiresAt,
            resourcePrefix,
            boxFile: {
              bucket: Bucket.BOX_FILES,
              objectKey: boxFileObjectKey,
              publicUrl: '',
            },
          },
        });
      }

      const session = await UploadSessionService.create(request.user!.userId, {
        contentType: 'card',
        fileName: body.fileName,
        roomId: body.roomId ?? null,
        visibility: 'public',
        idempotencyKey: body.idempotencyKey,
        client: body.client,
      });
      const card = await CardService.create({
        userId: request.user!.userId,
        roomId: body.roomId ?? undefined,
        visibility: 'public',
        fileSizeBytes: 0,
        title: toCardTitle(body.fileName),
        publishedByClient: body.client?.name ?? 'chips-card-transfer',
        publishedClientVersion: body.client?.version ?? null,
      });

      const resourcePrefix = `cards/${card.id}/versions/${session.id}/resources`;
      const networkCardObjectKey = `cards/${card.id}/versions/${session.id}/network-card/card.card`;

      await db
        .update(uploadSessions)
        .set({
          resourcePrefix,
          clientMetadata: {
            ...(session.clientMetadata && typeof session.clientMetadata === 'object'
              ? session.clientMetadata
              : {}),
            transferKind: 'network-resource-card',
            cardId: card.id,
            versionId: session.id,
            resourcePrefix,
            networkCardObjectKey,
          },
          updatedAt: new Date(),
        })
        .where(eq(uploadSessions.id, session.id));

      return reply.status(201).send({
        data: {
          uploadId: session.id,
          cardId: card.id,
          versionId: session.id,
          expiresAt: session.expiresAt,
          resourcePrefix,
          networkCard: {
            bucket: Bucket.CARD_RESOURCES,
            objectKey: networkCardObjectKey,
            publicUrl: buildObjectUrl(Bucket.CARD_RESOURCES, networkCardObjectKey),
          },
        },
      });
    },
  );

  fastify.post(
    '/api/v1/card-transfer/upload-sessions/:uploadId/objects:presign',
    { preHandler: [requireJsonBody, fastify.authenticate] },
    async (request) => {
      const { uploadId } = request.params as { uploadId: string };
      const body = PresignCardTransferObjectsSchema.parse(request.body);
      const session = await UploadSessionService.getOwned(uploadId, request.user!.userId);
      const metadata = assertTransferSessionMetadata(getTransferMetadata(session.clientMetadata));
      const expiresInSeconds = Math.min(env.UPLOAD_SESSION_TTL_MINUTES * 60, 3600);

      if (metadata.transferKind === 'box-source') {
        if (body.objects.length === 1 && body.objects[0]?.role === 'box-file') {
          const presigned = createPresignedPutUrl({
            bucket: Bucket.BOX_FILES,
            key: metadata.boxFileObjectKey,
            contentType: BOX_FILE_MIME_TYPE,
            expiresInSeconds,
            headers: {
              'x-amz-meta-chips-box-id': metadata.boxId,
              'x-amz-meta-chips-box-version-id': metadata.versionId,
              'x-amz-meta-chips-transfer-role': 'box-file',
            },
          });

          await db
            .update(uploadSessions)
            .set({ status: 'uploading_resources', updatedAt: new Date() })
            .where(eq(uploadSessions.id, session.id));

          return {
            data: {
              objects: [
                {
                  role: 'box-file',
                  relativePath: null,
                  bucket: Bucket.BOX_FILES,
                  objectKey: metadata.boxFileObjectKey,
                  publicUrl: '',
                  uploadUrl: presigned.url,
                  method: presigned.method,
                  headers: presigned.headers,
                },
              ],
            },
          };
        }

        if (body.objects.length >= 1 && body.objects.every((object) => object.role === 'cover-file')) {
          const objects = body.objects.map((object) => {
            const relativePath = normalizeRelativePath(object.relativePath ?? '');
            const objectKey = `boxes/${metadata.boxId}/cover/${relativePath}`;
            const presigned = createPresignedPutUrl({
              bucket: Bucket.COVERS,
              key: objectKey,
              contentType: object.mimeType,
              expiresInSeconds,
              headers: {
                'x-amz-meta-chips-box-id': metadata.boxId,
                'x-amz-meta-chips-box-version-id': metadata.versionId,
                'x-amz-meta-chips-transfer-role': 'cover-file',
              },
            });

            return {
              role: 'cover-file',
              relativePath,
              bucket: Bucket.COVERS,
              objectKey,
              publicUrl: buildObjectUrl(Bucket.COVERS, objectKey),
              uploadUrl: presigned.url,
              method: presigned.method,
              headers: presigned.headers,
            };
          });

          await db
            .update(uploadSessions)
            .set({ status: 'uploading_resources', updatedAt: new Date() })
            .where(eq(uploadSessions.id, session.id));

          return { data: { objects } };
        }

        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          'Box upload sessions only support box-file or cover-file role objects',
        );
      }

      const objects = body.objects.map((object) => {
        const objectKey =
          object.role === 'network-card'
            ? metadata.networkCardObjectKey
            : `${metadata.resourcePrefix}/${normalizeRelativePath(object.relativePath ?? '')}`;
        const contentType = object.role === 'network-card' ? NETWORK_CARD_MIME_TYPE : object.mimeType;
        const presigned = createPresignedPutUrl({
          bucket: Bucket.CARD_RESOURCES,
          key: objectKey,
          contentType,
          expiresInSeconds,
          headers: {
            'x-amz-meta-chips-card-id': metadata.cardId,
            'x-amz-meta-chips-card-version-id': metadata.versionId,
            'x-amz-meta-chips-transfer-role': object.role,
          },
        });

        return {
          role: object.role,
          relativePath: object.role === 'resource' ? normalizeRelativePath(object.relativePath ?? '') : null,
          bucket: Bucket.CARD_RESOURCES,
          objectKey,
          publicUrl: buildObjectUrl(Bucket.CARD_RESOURCES, objectKey),
          uploadUrl: presigned.url,
          method: presigned.method,
          headers: presigned.headers,
        };
      });

      await db
        .update(uploadSessions)
        .set({ status: 'uploading_resources', updatedAt: new Date() })
        .where(eq(uploadSessions.id, session.id));

      return { data: { objects } };
    },
  );

  fastify.post(
    '/api/v1/card-transfer/upload-sessions/:uploadId/complete',
    { preHandler: [requireJsonBody, fastify.authenticate] },
    async (request, reply) => {
      const { uploadId } = request.params as { uploadId: string };
      const session = await UploadSessionService.getOwned(uploadId, request.user!.userId);
      const metadata = assertTransferSessionMetadata(getTransferMetadata(session.clientMetadata));

      if (metadata.transferKind === 'box-source') {
        const body = CompleteBoxTransferUploadSessionSchema.parse(request.body);

        if (body.boxFile.bucket !== Bucket.BOX_FILES || body.boxFile.objectKey !== metadata.boxFileObjectKey) {
          throw AppError.badRequest(
            ErrorCode.VALIDATION_ERROR,
            'Box file object does not belong to this session',
          );
        }
        await assertUploadedObject({
          bucket: body.boxFile.bucket,
          objectKey: body.boxFile.objectKey,
          expectedSizeBytes: body.boxFile.sizeBytes,
          label: 'box-file',
        });

        const box = await BoxService.create({
          userId: request.user!.userId,
          roomId: session.roomId ?? undefined,
          visibility: session.visibility,
          fileSizeBytes: body.boxFile.sizeBytes,
          sourceBoxBucket: body.boxFile.bucket,
          sourceBoxKey: body.boxFile.objectKey,
          sourceBoxUrl: body.boxFile.publicUrl ?? null,
          sourceBoxSha256: null,
          metadata: body.metadata ?? null,
          structure: body.structure ?? null,
          content: body.content ?? null,
          title: body.title,
          boxFileId: body.boxFileId ?? undefined,
          layoutPlugin: body.layoutPlugin ?? null,
          coverRatio: body.coverRatio ?? null,
          coverBucket: body.coverObject?.bucket ?? null,
          coverKey: body.coverObject?.objectKey ?? null,
          boxId: metadata.boxId,
        });

        await db
          .update(uploadSessions)
          .set({
            status: 'source_ready',
            sourceBoxBucket: body.boxFile.bucket,
            sourceBoxKey: body.boxFile.objectKey,
            sourceBoxSha256: null,
            updatedAt: new Date(),
          })
          .where(eq(uploadSessions.id, session.id));

        return reply.status(200).send({
          data: {
            boxId: box.id,
            versionId: metadata.versionId,
            status: 'ready',
            communityUrl: `${env.BASE_URL}/boxes/${box.id}`,
            boxViewUrl: `/api/v1/boxes/${box.id}/view`,
          },
        });
      }

      const body = CompleteCardTransferUploadSessionSchema.parse(request.body);

      assertRestoreManifestStructure(body.restoreManifest);
      if (body.networkCard.bucket !== Bucket.CARD_RESOURCES || body.networkCard.objectKey !== metadata.networkCardObjectKey) {
        throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Network resource card object does not belong to this session');
      }

      const resources = body.resources.map((resource) => {
        const originalRelativePath = normalizeRelativePath(resource.originalRelativePath);
        if (resource.bucket !== Bucket.CARD_RESOURCES || !resource.objectKey.startsWith(`${metadata.resourcePrefix}/`)) {
          throw AppError.badRequest(
            ErrorCode.VALIDATION_ERROR,
            `Resource object does not belong to this session: ${originalRelativePath}`,
          );
        }
        return {
          originalRelativePath,
          networkUrl: resource.networkUrl,
          bucket: resource.bucket,
          objectKey: resource.objectKey,
          publicUrl: resource.publicUrl ?? buildObjectUrl(Bucket.CARD_RESOURCES, resource.objectKey),
          sizeBytes: resource.sizeBytes,
          mimeType: resource.mimeType ?? 'application/octet-stream',
        };
      });

      const resourceManifest = {
        schemaVersion: TRANSFER_SCHEMA_VERSION,
        mode: 'network-resource-card',
        cardId: metadata.cardId,
        cardVersionId: metadata.versionId,
        networkCard: {
          bucket: body.networkCard.bucket,
          objectKey: body.networkCard.objectKey,
          publicUrl: body.networkCard.publicUrl ?? buildObjectUrl(Bucket.CARD_RESOURCES, body.networkCard.objectKey),
          sizeBytes: body.networkCard.sizeBytes,
          mimeType: body.networkCard.mimeType ?? NETWORK_CARD_MIME_TYPE,
        },
        resources,
        restoreManifest: body.restoreManifest ?? null,
      };

      await assertUploadedObject({
        bucket: body.networkCard.bucket,
        objectKey: body.networkCard.objectKey,
        expectedSizeBytes: body.networkCard.sizeBytes,
        label: 'network-card',
      });
      await Promise.all(
        resources.map((resource) =>
          assertUploadedObject({
            bucket: resource.bucket,
            objectKey: resource.objectKey,
            expectedSizeBytes: resource.sizeBytes,
            label: resource.originalRelativePath,
          }),
        ),
      );

      const [updated] = await db
        .update(cards)
        .set({
          title: body.title ?? toCardTitle(session.fileName ?? undefined),
          cardFileId: body.cardFileId ?? null,
          coverRatio: body.coverRatio ?? null,
          fileSizeBytes: body.networkCard.sizeBytes,
          sourceCardBucket: body.networkCard.bucket,
          sourceCardKey: body.networkCard.objectKey,
          sourceCardUrl: body.networkCard.publicUrl ?? buildObjectUrl(Bucket.CARD_RESOURCES, body.networkCard.objectKey),
          sourceCardSha256: null,
          sourceCardStoredAt: new Date(),
          cardMetadata: body.cardMetadata ?? null,
          cardStructure: body.cardStructure ?? null,
          resourceManifest,
          publishedByClient: session.clientName ?? 'chips-card-transfer',
          publishedClientVersion: session.clientVersion,
          publishedAt: new Date(),
          status: 'ready',
          updatedAt: new Date(),
        })
        .where(and(eq(cards.id, metadata.cardId), eq(cards.userId, request.user!.userId)))
        .returning();

      if (!updated) {
        throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
      }

      await db
        .update(uploadSessions)
        .set({
          status: 'source_ready',
          sourceCardBucket: body.networkCard.bucket,
          sourceCardKey: body.networkCard.objectKey,
          sourceCardSha256: null,
          updatedAt: new Date(),
        })
        .where(eq(uploadSessions.id, session.id));

      await CardRenderCacheService.enqueueForCard({
        cardId: updated.id,
        createdBy: 'upload',
        renderProfile: CardRenderCacheService.viewRenderProfile,
        priority: 50,
      });
      await CardRenderCacheService.enqueueForCard({
        cardId: updated.id,
        createdBy: 'upload',
        renderProfile: CardRenderCacheService.coverRenderProfile,
        priority: 40,
      });

      return reply.status(202).send({
        data: {
          cardId: updated.id,
          versionId: metadata.versionId,
          status: updated.status,
          renderStatus: 'queued',
          renderStatusUrl: `/api/v1/cards/${updated.id}/render-status`,
          communityUrl: `${env.BASE_URL}/cards/${updated.id}`,
        },
      });
    },
  );

  fastify.post(
    '/api/v1/card-transfer/upload-sessions/:uploadId/abort',
    { preHandler: [requireJsonBody, fastify.authenticate] },
    async (request) => {
      const { uploadId } = request.params as { uploadId: string };
      const session = await UploadSessionService.getOwned(uploadId, request.user!.userId);
      await db
        .update(uploadSessions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(uploadSessions.id, session.id));
      return { data: { uploadId: session.id, status: 'cancelled' } };
    },
  );

  fastify.post(
    '/api/v1/card-transfer/download-sessions',
    { preHandler: [requireJsonBody, fastify.authenticate] },
    async (request, reply) => {
      const body = CreateCardTransferDownloadSessionSchema.parse(request.body);
      const card = await CardService.getAccessible(body.cardId, request.user!.userId);
      return reply.status(201).send({
        data: {
          downloadId: card.id,
          cardId: card.id,
          versionId: body.versionId ?? null,
          planUrl: `/api/v1/card-transfer/download-sessions/${card.id}/plan`,
        },
      });
    },
  );

  fastify.get(
    '/api/v1/card-transfer/download-sessions/:downloadId/plan',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { downloadId } = request.params as { downloadId: string };
      const card = await CardService.getAccessible(downloadId, request.user!.userId);
      const manifest = getNetworkCardManifest(card.resourceManifest);
      const suggestedFileName = `${card.title || card.id}.card`;
      const networkCard = manifest.networkCard!;
      const resources = manifest.resources ?? [];
      return {
        data: {
          schemaVersion: TRANSFER_SCHEMA_VERSION,
          cardId: card.id,
          versionId: manifest.cardVersionId ?? null,
          suggestedFileName,
          networkCard: {
            ...networkCard,
            ...buildDownloadObject(
              String(networkCard.bucket),
              String(networkCard.objectKey),
              networkCard.publicUrl,
              suggestedFileName,
            ),
          },
          resources: resources.map((resource) => ({
            ...resource,
            ...buildDownloadObject(resource.bucket, resource.objectKey, resource.publicUrl, resource.originalRelativePath),
          })),
          restoreManifest: manifest.restoreManifest ?? null,
          manifest,
        },
      };
    },
  );
};

export default cardTransferRoutes;
