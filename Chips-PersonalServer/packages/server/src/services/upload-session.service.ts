import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
  uploadSessions,
  type NewUploadSession,
  type UploadSession,
} from '../db/schema/upload-sessions';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export interface CreateUploadSessionInput {
  contentType: 'card' | 'box';
  fileName?: string;
  visibility: 'public' | 'private';
  idempotencyKey?: string;
  includeRenderArtifacts?: boolean;
  client?: {
    name?: string;
    version?: string;
    platform?: string;
  };
}

export const UploadSessionService = {
  async create(input: CreateUploadSessionInput): Promise<UploadSession> {
    if (input.idempotencyKey) {
      const existing = await db.query.uploadSessions.findFirst({
        where: eq(uploadSessions.idempotencyKey, input.idempotencyKey),
      });
      if (existing) {
        return existing;
      }
    }

    const [session] = await db
      .insert(uploadSessions)
      .values({
        contentType: input.contentType,
        visibility: input.visibility,
        includeRenderArtifacts: input.includeRenderArtifacts ?? false,
        fileName: input.fileName ?? null,
        resourcePrefix: `uploads/session-pending/resources`,
        idempotencyKey: input.idempotencyKey ?? null,
        clientName: input.client?.name ?? null,
        clientVersion: input.client?.version ?? null,
        clientPlatform: input.client?.platform ?? null,
        expiresAt: addMinutes(new Date(), env.UPLOAD_SESSION_TTL_MINUTES),
      } satisfies Partial<NewUploadSession> as NewUploadSession)
      .returning();

    const resourcePrefix = `uploads/${session.id}/resources`;
    const [updated] = await db
      .update(uploadSessions)
      .set({ resourcePrefix, updatedAt: new Date() })
      .where(eq(uploadSessions.id, session.id))
      .returning();

    return updated;
  },

  async getById(uploadId: string): Promise<UploadSession> {
    const session = await db.query.uploadSessions.findFirst({
      where: eq(uploadSessions.id, uploadId),
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
};
