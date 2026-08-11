import * as path from 'path';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
  uploadSessionResources,
  uploadSessions,
  type NewUploadSession,
  type NewUploadSessionResource,
  type UploadSession,
} from '../db/schema/upload-sessions';
import { Bucket } from '../storage/buckets';
import { buildObjectUrl, createPresignedPutUrl, headObject } from '../storage/s3';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import type { CreateUploadSessionInput, PresignUploadResourcesInput } from '../schemas/content.schemas';
import type { CardSourceInspection } from '../utils/card-file';

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, `Invalid resource path: ${relativePath}`);
  }
  return normalized;
}

export interface UploadSessionVerifiedResource {
  relativePath: string;
  publicUrl: string;
  sizeBytes: number;
  sha256: string;
  mimeType: string;
}

export const UploadSessionService = {
  async create(userId: string, input: CreateUploadSessionInput): Promise<UploadSession> {
    if (input.idempotencyKey) {
      const existing = await db.query.uploadSessions.findFirst({
        where: and(
          eq(uploadSessions.userId, userId),
          eq(uploadSessions.idempotencyKey, input.idempotencyKey),
        ),
      });
      if (existing) {
        return existing;
      }
    }

    const [session] = await db
      .insert(uploadSessions)
      .values({
        userId,
        contentType: input.contentType,
        roomId: input.roomId ?? null,
        visibility: input.visibility,
        fileName: input.fileName ?? null,
        resourcePrefix: `users/${userId}/uploads/session-pending/resources`,
        idempotencyKey: input.idempotencyKey ?? null,
        clientName: input.client?.name ?? null,
        clientVersion: input.client?.version ?? null,
        clientPlatform: input.client?.platform ?? null,
        expiresAt: addMinutes(new Date(), env.UPLOAD_SESSION_TTL_MINUTES),
      } satisfies Partial<NewUploadSession> as NewUploadSession)
      .returning();

    const resourcePrefix = `users/${userId}/uploads/${session.id}/resources`;
    const [updated] = await db
      .update(uploadSessions)
      .set({ resourcePrefix, updatedAt: new Date() })
      .where(eq(uploadSessions.id, session.id))
      .returning();

    return updated;
  },

  async getOwned(uploadId: string, userId: string): Promise<UploadSession> {
    const session = await db.query.uploadSessions.findFirst({
      where: and(eq(uploadSessions.id, uploadId), eq(uploadSessions.userId, userId)),
    });

    if (!session) {
      throw AppError.notFound(ErrorCode.UPLOAD_SESSION_NOT_FOUND, 'Upload session not found');
    }

    if (session.expiresAt <= new Date()) {
      await db
        .update(uploadSessions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(uploadSessions.id, session.id));
      throw AppError.badRequest(ErrorCode.UPLOAD_SESSION_EXPIRED, 'Upload session expired');
    }

    return session;
  },

  async presignResources(
    uploadId: string,
    userId: string,
    input: PresignUploadResourcesInput,
  ): Promise<{
    resources: Array<{
      relativePath: string;
      publicUrl: string;
      uploadUrl: string;
      method: 'PUT';
      headers: Record<string, string>;
      expiresAt: Date;
    }>;
  }> {
    const session = await this.getOwned(uploadId, userId);
    const expiresInSeconds = Math.min(env.UPLOAD_SESSION_TTL_MINUTES * 60, 3600);
    const expiresAt = addMinutes(new Date(), Math.ceil(expiresInSeconds / 60));
    const result: Array<{
      relativePath: string;
      publicUrl: string;
      uploadUrl: string;
      method: 'PUT';
      headers: Record<string, string>;
      expiresAt: Date;
    }> = [];

    for (const resource of input.resources) {
      const relativePath = normalizeRelativePath(resource.relativePath);
      const objectKey = `${session.resourcePrefix}/${relativePath}`;
      const presigned = createPresignedPutUrl({
        bucket: Bucket.CARD_RESOURCES,
        key: objectKey,
        contentType: resource.mimeType,
        expiresInSeconds,
        headers: {
          'x-amz-meta-chips-sha256': resource.sha256,
          'x-amz-meta-chips-upload-session': session.id,
        },
      });
      const publicUrl = buildObjectUrl(Bucket.CARD_RESOURCES, objectKey);

      await db
        .insert(uploadSessionResources)
        .values({
          uploadSessionId: session.id,
          relativePath,
          bucket: Bucket.CARD_RESOURCES,
          objectKey,
          publicUrl,
          sizeBytes: resource.sizeBytes,
          sha256: resource.sha256,
          mimeType: resource.mimeType,
          status: 'presigned',
        } satisfies Partial<NewUploadSessionResource> as NewUploadSessionResource)
        .onConflictDoUpdate({
          target: [uploadSessionResources.uploadSessionId, uploadSessionResources.relativePath],
          set: {
            bucket: Bucket.CARD_RESOURCES,
            objectKey,
            publicUrl,
            sizeBytes: resource.sizeBytes,
            sha256: resource.sha256,
            mimeType: resource.mimeType,
            status: 'presigned',
            updatedAt: new Date(),
          },
        });

      result.push({
        relativePath,
        publicUrl,
        uploadUrl: presigned.url,
        method: presigned.method,
        headers: presigned.headers,
        expiresAt,
      });
    }

    await db
      .update(uploadSessions)
      .set({ status: 'uploading_resources', updatedAt: new Date() })
      .where(eq(uploadSessions.id, session.id));

    return { resources: result };
  },

  async verifyResources(session: UploadSession): Promise<UploadSessionVerifiedResource[]> {
    const resources = await db.query.uploadSessionResources.findMany({
      where: eq(uploadSessionResources.uploadSessionId, session.id),
    });

    for (const resource of resources) {
      const meta = await headObject({
        bucket: resource.bucket,
        key: resource.objectKey,
      });

      if (typeof meta.contentLength === 'number' && Number(resource.sizeBytes) !== Number(meta.contentLength)) {
        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          `Uploaded resource size mismatch: ${resource.relativePath}`,
        );
      }

      const metadataSha256 = meta.metadata?.['chips-sha256'];
      if (metadataSha256 && metadataSha256 !== resource.sha256) {
        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          `Uploaded resource checksum mismatch: ${resource.relativePath}`,
        );
      }

      await db
        .update(uploadSessionResources)
        .set({ status: 'verified', updatedAt: new Date() })
        .where(eq(uploadSessionResources.id, resource.id));
    }

    return resources.map((resource) => ({
      relativePath: resource.relativePath,
      publicUrl: resource.publicUrl,
      sizeBytes: resource.sizeBytes,
      sha256: resource.sha256,
      mimeType: resource.mimeType,
    }));
  },

  assertResourcesMatchCard(
    inspection: CardSourceInspection,
    verifiedResources: UploadSessionVerifiedResource[],
  ): void {
    const internalResourcePaths = new Set(inspection.resourceFiles.map((resource) => resource.relativePath));
    const verifiedByPath = new Map(verifiedResources.map((resource) => [resource.relativePath, resource]));

    const staleInternalResources = verifiedResources
      .filter((resource) => internalResourcePaths.has(resource.relativePath))
      .map((resource) => resource.relativePath);
    if (staleInternalResources.length > 0) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Submitted card still contains resources that were uploaded through this session',
        { resources: staleInternalResources.slice(0, 20) },
      );
    }

    const content = JSON.stringify({
      metadata: inspection.metadata,
      structure: inspection.structure,
      content: Object.fromEntries(inspection.contentMap),
      coverHtml: inspection.coverHtml,
    });
    const missingReferences = [...verifiedByPath.values()]
      .filter((resource) => !content.includes(resource.publicUrl))
      .map((resource) => resource.relativePath);
    if (missingReferences.length > 0) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Submitted card does not reference every resource uploaded through this session',
        { resources: missingReferences.slice(0, 20) },
      );
    }
  },

  async markSourceReady(sessionId: string, params: {
    sourceCardBucket: string;
    sourceCardKey: string;
    sourceCardSha256: string;
  }): Promise<void> {
    await db
      .update(uploadSessions)
      .set({
        status: 'source_ready',
        sourceCardBucket: params.sourceCardBucket,
        sourceCardKey: params.sourceCardKey,
        sourceCardSha256: params.sourceCardSha256,
        updatedAt: new Date(),
      })
      .where(eq(uploadSessions.id, sessionId));
  },
};
