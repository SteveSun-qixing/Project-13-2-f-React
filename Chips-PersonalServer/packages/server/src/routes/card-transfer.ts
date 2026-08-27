import * as path from 'path';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client';
import { cards } from '../db/schema/cards';
import { uploadSessions } from '../db/schema/upload-sessions';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { CardService, type CardRenderArtifacts } from '../services/card.service';
import { BoxService } from '../services/box.service';
import { UploadSessionService } from '../services/upload-session.service';
import { Bucket, type PublicBucketName } from '../storage/buckets';
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
const DEFAULT_LOCALE = 'zh-CN';
const DEFAULT_THEME_ID = 'chips-official.default-theme';

interface TransferSessionMetadata {
  transferKind?: 'network-resource-card' | 'box-source';
  cardId?: string;
  versionId?: string;
  networkCardObjectKey?: string;
  resourcePrefix?: string;
  boxId?: string;
  boxFileObjectKey?: string;
  /** 渲染产物 cacheVersion（= 会话 ID），产物对象 key 前缀 `{cardId}/{cacheVersion}` */
  renderCacheVersion?: string;
  /** 已预签名的渲染产物对象（render-file / cover-file），complete 时校验上传 */
  renderObjects?: Array<{
    role: 'render-file' | 'cover-file';
    relativePath: string;
    bucket: string;
    objectKey: string;
    sizeBytes: number;
    mimeType: string;
  }>;
}

interface CardTransferSessionMetadata {
  transferKind: 'network-resource-card';
  cardId: string;
  versionId: string;
  networkCardObjectKey: string;
  resourcePrefix: string;
  renderCacheVersion: string;
  renderObjects: NonNullable<TransferSessionMetadata['renderObjects']>;
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

/** 根据卡片可见性选择渲染产物 bucket */
function resolveRenderBucket(visibility: string, role: 'render-file' | 'cover-file'): string {
  const isPrivate = visibility === 'private';
  if (role === 'cover-file') {
    return isPrivate ? Bucket.CARD_COVER_CACHE_PRIVATE : Bucket.CARD_COVER_CACHE;
  }
  return isPrivate ? Bucket.CARD_RENDER_CACHE_PRIVATE : Bucket.CARD_RENDER_CACHE;
}

function isPublicRenderBucket(bucket: string): boolean {
  return bucket === Bucket.CARD_RENDER_CACHE || bucket === Bucket.CARD_COVER_CACHE;
}

/** 构造渲染产物入口 URL（公开走对象存储，私有走受控代理路由） */
function buildRenderEntryUrl(params: {
  cardId: string;
  cacheVersion: string;
  bucket: string;
  entryObjectKey: string;
  entryRelativePath: string;
  role: 'render-file' | 'cover-file';
}): string {
  if (isPublicRenderBucket(params.bucket)) {
    return buildObjectUrl(params.bucket as PublicBucketName, params.entryObjectKey);
  }
  const route = params.role === 'cover-file' ? 'cover-cache' : 'render-cache';
  return `/api/v1/cards/${params.cardId}/${route}/${params.cacheVersion}/${params.entryRelativePath}`;
}

const cardTransferRoutes: FastifyPluginAsync = async (fastify) => {
  const requireApiToken = fastify.requireApiToken();
  const requireJsonBody = async (request: { headers: { 'content-type'?: string } }) => {
    const contentType = request.headers['content-type'];
    if (!contentType || !contentType.toLowerCase().startsWith('application/json')) {
      throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'card-transfer endpoints only accept JSON control-plane payloads');
    }
  };

  fastify.post(
    '/api/v1/card-transfer/upload-sessions',
    { preHandler: [requireJsonBody, requireApiToken] },
    async (request, reply) => {
      const body = CreateCardTransferUploadSessionSchema.parse(request.body);

      if (body.contentType === 'box') {
        const session = await UploadSessionService.create({
          contentType: 'box',
          fileName: body.fileName,
          visibility: 'public',
          idempotencyKey: body.idempotencyKey,
          client: body.client,
        });
        const box = await BoxService.createPlaceholder({
          title: toBoxTitle(body.fileName),
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
            includeRenderArtifacts: session.includeRenderArtifacts,
            boxFile: {
              bucket: Bucket.BOX_FILES,
              objectKey: boxFileObjectKey,
              publicUrl: '',
            },
          },
        });
      }

      const session = await UploadSessionService.create({
        contentType: 'card',
        fileName: body.fileName,
        visibility: 'public',
        idempotencyKey: body.idempotencyKey,
        includeRenderArtifacts: body.includeRenderArtifacts,
        client: body.client,
      });
      const card = await CardService.create({
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
            renderCacheVersion: session.id,
            renderObjects: [],
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
          includeRenderArtifacts: session.includeRenderArtifacts,
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
    { preHandler: [requireJsonBody, requireApiToken] },
    async (request) => {
      const { uploadId } = request.params as { uploadId: string };
      const body = PresignCardTransferObjectsSchema.parse(request.body);
      const session = await UploadSessionService.getById(uploadId);
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

      const renderObjects: NonNullable<TransferSessionMetadata['renderObjects']> = [];
      const objects = body.objects.map((object) => {
        if (object.role === 'network-card') {
          const presigned = createPresignedPutUrl({
            bucket: Bucket.CARD_RESOURCES,
            key: metadata.networkCardObjectKey,
            contentType: NETWORK_CARD_MIME_TYPE,
            expiresInSeconds,
            headers: {
              'x-amz-meta-chips-card-id': metadata.cardId,
              'x-amz-meta-chips-card-version-id': metadata.versionId,
              'x-amz-meta-chips-transfer-role': object.role,
            },
          });
          return {
            role: 'network-card' as const,
            relativePath: null,
            bucket: Bucket.CARD_RESOURCES,
            objectKey: metadata.networkCardObjectKey,
            publicUrl: buildObjectUrl(Bucket.CARD_RESOURCES, metadata.networkCardObjectKey),
            uploadUrl: presigned.url,
            method: presigned.method,
            headers: presigned.headers,
          };
        }

        if (object.role === 'resource') {
          const relativePath = normalizeRelativePath(object.relativePath ?? '');
          const objectKey = `${metadata.resourcePrefix}/${relativePath}`;
          const presigned = createPresignedPutUrl({
            bucket: Bucket.CARD_RESOURCES,
            key: objectKey,
            contentType: object.mimeType,
            expiresInSeconds,
            headers: {
              'x-amz-meta-chips-card-id': metadata.cardId,
              'x-amz-meta-chips-card-version-id': metadata.versionId,
              'x-amz-meta-chips-transfer-role': object.role,
            },
          });
          return {
            role: 'resource' as const,
            relativePath,
            bucket: Bucket.CARD_RESOURCES,
            objectKey,
            publicUrl: buildObjectUrl(Bucket.CARD_RESOURCES, objectKey),
            uploadUrl: presigned.url,
            method: presigned.method,
            headers: presigned.headers,
          };
        }

        if (object.role === 'render-file' || object.role === 'cover-file') {
          const relativePath = normalizeRelativePath(object.relativePath ?? '');
          const bucket = resolveRenderBucket(session.visibility, object.role);
          const objectKey = `${metadata.cardId}/${metadata.renderCacheVersion}/${relativePath}`;
          const presigned = createPresignedPutUrl({
            bucket,
            key: objectKey,
            contentType: object.mimeType,
            expiresInSeconds,
            headers: {
              'x-amz-meta-chips-card-id': metadata.cardId,
              'x-amz-meta-chips-card-version-id': metadata.versionId,
              'x-amz-meta-chips-transfer-role': object.role,
            },
          });
          renderObjects.push({
            role: object.role,
            relativePath,
            bucket,
            objectKey,
            sizeBytes: object.sizeBytes,
            mimeType: object.mimeType,
          });
          return {
            role: object.role,
            relativePath,
            bucket,
            objectKey,
            publicUrl: isPublicRenderBucket(bucket)
              ? buildObjectUrl(bucket as PublicBucketName, objectKey)
              : '',
            uploadUrl: presigned.url,
            method: presigned.method,
            headers: presigned.headers,
          };
        }

        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          `Unsupported object role: ${String(object.role)}`,
        );
      });

      await db
        .update(uploadSessions)
        .set({
          status: 'uploading_resources',
          clientMetadata: {
            ...metadata,
            renderObjects: [...metadata.renderObjects, ...renderObjects],
          },
          updatedAt: new Date(),
        })
        .where(eq(uploadSessions.id, session.id));

      return { data: { objects } };
    },
  );

  fastify.post(
    '/api/v1/card-transfer/upload-sessions/:uploadId/complete',
    { preHandler: [requireJsonBody, requireApiToken] },
    async (request, reply) => {
      const { uploadId } = request.params as { uploadId: string };
      const session = await UploadSessionService.getById(uploadId);
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

      // 校验并接收客户端渲染产物
      let renderArtifacts: CardRenderArtifacts | null = null;
      if (body.renderArtifacts) {
        const renderObjects = metadata.renderObjects;
        const viewFiles = renderObjects.filter((object) => object.role === 'render-file');
        const coverFiles = renderObjects.filter((object) => object.role === 'cover-file');

        if (viewFiles.length === 0) {
          throw AppError.badRequest(
            ErrorCode.VALIDATION_ERROR,
            'renderArtifacts submitted but no render-file objects were presigned for this session',
          );
        }

        await Promise.all(
          renderObjects.map((object) =>
            assertUploadedObject({
              bucket: object.bucket,
              objectKey: object.objectKey,
              expectedSizeBytes: object.sizeBytes,
              label: `${object.role}:${object.relativePath}`,
            }),
          ),
        );

        const viewEntryRelativePath = normalizeRelativePath(body.renderArtifacts.view.entryRelativePath);
        const viewEntryKey = `${metadata.cardId}/${metadata.renderCacheVersion}/${viewEntryRelativePath}`;
        const viewBucket = resolveRenderBucket(session.visibility, 'render-file');
        if (!viewFiles.some((object) => object.objectKey === viewEntryKey && object.bucket === viewBucket)) {
          throw AppError.badRequest(
            ErrorCode.VALIDATION_ERROR,
            `View entry object was not presigned: ${viewEntryRelativePath}`,
          );
        }

        let coverArtifact: CardRenderArtifacts['cover'] | undefined;
        if (body.renderArtifacts.cover) {
          const coverEntryRelativePath = normalizeRelativePath(body.renderArtifacts.cover.entryRelativePath);
          const coverEntryKey = `${metadata.cardId}/${metadata.renderCacheVersion}/${coverEntryRelativePath}`;
          const coverBucket = resolveRenderBucket(session.visibility, 'cover-file');
          if (!coverFiles.some((object) => object.objectKey === coverEntryKey && object.bucket === coverBucket)) {
            throw AppError.badRequest(
              ErrorCode.VALIDATION_ERROR,
              `Cover entry object was not presigned: ${coverEntryRelativePath}`,
            );
          }
          coverArtifact = {
            cacheVersion: metadata.renderCacheVersion,
            bucket: coverBucket,
            keyPrefix: `${metadata.cardId}/${metadata.renderCacheVersion}`,
            entryObjectKey: coverEntryKey,
            entryUrl: buildRenderEntryUrl({
              cardId: metadata.cardId,
              cacheVersion: metadata.renderCacheVersion,
              bucket: coverBucket,
              entryObjectKey: coverEntryKey,
              entryRelativePath: coverEntryRelativePath,
              role: 'cover-file',
            }),
            fileCount: body.renderArtifacts.cover.fileCount,
            sizeBytes: body.renderArtifacts.cover.sizeBytes,
          };
        }

        renderArtifacts = {
          rendererVersion: body.renderArtifacts.rendererVersion,
          themeId: body.renderArtifacts.themeId ?? DEFAULT_THEME_ID,
          locale: body.renderArtifacts.locale ?? DEFAULT_LOCALE,
          view: {
            cacheVersion: metadata.renderCacheVersion,
            bucket: viewBucket,
            keyPrefix: `${metadata.cardId}/${metadata.renderCacheVersion}`,
            entryObjectKey: viewEntryKey,
            entryUrl: buildRenderEntryUrl({
              cardId: metadata.cardId,
              cacheVersion: metadata.renderCacheVersion,
              bucket: viewBucket,
              entryObjectKey: viewEntryKey,
              entryRelativePath: viewEntryRelativePath,
              role: 'render-file',
            }),
            fileCount: body.renderArtifacts.view.fileCount,
            sizeBytes: body.renderArtifacts.view.sizeBytes,
          },
          ...(coverArtifact ? { cover: coverArtifact } : {}),
        };
      }

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
          status: renderArtifacts ? 'ready' : 'pending',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, metadata.cardId))
        .returning();

      if (!updated) {
        throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
      }

      if (renderArtifacts) {
        await CardService.recordRenderArtifacts(updated.id, renderArtifacts);
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

      return reply.status(200).send({
        data: {
          cardId: updated.id,
          versionId: metadata.versionId,
          status: renderArtifacts ? 'ready' : 'pending',
          communityUrl: `${env.BASE_URL}/cards/${updated.id}`,
        },
      });
    },
  );

  fastify.post(
    '/api/v1/card-transfer/upload-sessions/:uploadId/abort',
    { preHandler: [requireJsonBody, requireApiToken] },
    async (request) => {
      const { uploadId } = request.params as { uploadId: string };
      const session = await UploadSessionService.getById(uploadId);
      await db
        .update(uploadSessions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(uploadSessions.id, session.id));
      return { data: { uploadId: session.id, status: 'cancelled' } };
    },
  );

  fastify.post(
    '/api/v1/card-transfer/download-sessions',
    { preHandler: [requireJsonBody, requireApiToken] },
    async (request, reply) => {
      const body = CreateCardTransferDownloadSessionSchema.parse(request.body);
      const card = await CardService.getAccessible(body.cardId);
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
    { preHandler: [requireApiToken] },
    async (request) => {
      const { downloadId } = request.params as { downloadId: string };
      const card = await CardService.getAccessible(downloadId);
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
