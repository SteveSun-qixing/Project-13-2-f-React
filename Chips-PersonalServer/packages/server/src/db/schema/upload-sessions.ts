import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { rooms } from './rooms';
import { cardVisibilityEnum } from './cards';

export const uploadSessionContentTypeEnum = pgEnum('upload_session_content_type', ['card', 'box']);

export const uploadSessionStatusEnum = pgEnum('upload_session_status', [
  'created',
  'uploading_resources',
  'submitting_document',
  'validating',
  'source_ready',
  'error',
  'cancelled',
  'expired',
]);

export const uploadSessionResourceStatusEnum = pgEnum('upload_session_resource_status', [
  'presigned',
  'uploaded',
  'verified',
  'error',
]);

export const uploadSessions = pgTable(
  'upload_sessions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    contentType: uploadSessionContentTypeEnum('content_type').notNull(),
    status: uploadSessionStatusEnum('status').default('created').notNull(),

    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    visibility: cardVisibilityEnum('visibility').default('public').notNull(),

    fileName: text('file_name'),
    resourcePrefix: text('resource_prefix').notNull(),

    sourceCardBucket: text('source_card_bucket'),
    sourceCardKey: text('source_card_key'),
    sourceCardSha256: text('source_card_sha256'),

    sourceBoxBucket: text('source_box_bucket'),
    sourceBoxKey: text('source_box_key'),
    sourceBoxSha256: text('source_box_sha256'),

    idempotencyKey: text('idempotency_key'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),

    clientName: text('client_name'),
    clientVersion: text('client_version'),
    clientPlatform: text('client_platform'),
    clientMetadata: jsonb('client_metadata'),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    userStatusCreatedAtIdx: index('upload_sessions_user_status_created_at_idx').on(
      table.userId,
      table.status,
      table.createdAt,
    ),
    expiresAtIdx: index('upload_sessions_expires_at_idx').on(table.expiresAt),
    resourcePrefixIdx: index('upload_sessions_resource_prefix_idx').on(table.resourcePrefix),
    userIdempotencyUniqueIdx: uniqueIndex('upload_sessions_user_idempotency_unique_idx').on(
      table.userId,
      table.idempotencyKey,
    ),
  }),
);

export const uploadSessionResources = pgTable(
  'upload_session_resources',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    uploadSessionId: uuid('upload_session_id')
      .notNull()
      .references(() => uploadSessions.id, { onDelete: 'cascade' }),

    relativePath: text('relative_path').notNull(),
    bucket: text('bucket').notNull(),
    objectKey: text('object_key').notNull(),
    publicUrl: text('public_url').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    mimeType: text('mime_type').notNull(),
    status: uploadSessionResourceStatusEnum('status').default('presigned').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    sessionRelativePathIdx: uniqueIndex('upload_session_resources_session_relative_path_idx').on(
      table.uploadSessionId,
      table.relativePath,
    ),
    objectIdx: index('upload_session_resources_object_idx').on(table.bucket, table.objectKey),
  }),
);

export type UploadSession = typeof uploadSessions.$inferSelect;
export type NewUploadSession = typeof uploadSessions.$inferInsert;
export type UploadSessionResource = typeof uploadSessionResources.$inferSelect;
export type NewUploadSessionResource = typeof uploadSessionResources.$inferInsert;
