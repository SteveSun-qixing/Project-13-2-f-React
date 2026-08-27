import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { cards } from './cards';

export const cardRenderCacheStatusEnum = pgEnum('card_render_cache_status', [
  'queued',
  'rendering',
  'ready',
  'error',
  'deleting',
  'deleted',
]);

export const cardRenderJobStatusEnum = pgEnum('card_render_job_status', [
  'queued',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
]);

export const cardRenderJobCreatedByEnum = pgEnum('card_render_job_created_by', [
  'upload',
  'view_miss',
  'cover_miss',
  'manual',
  'system_rebuild',
]);

export const cardRenderCaches = pgTable(
  'card_render_caches',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),

    sourceCardSha256: text('source_card_sha256').notNull(),
    rendererVersion: text('renderer_version').notNull(),
    renderProfile: text('render_profile').default('community-web').notNull(),
    themeId: text('theme_id'),
    themeVersion: text('theme_version'),
    locale: text('locale').default('zh-CN').notNull(),
    pluginVersionManifest: jsonb('plugin_version_manifest'),

    status: cardRenderCacheStatusEnum('status').default('queued').notNull(),

    cacheBucket: text('cache_bucket').notNull(),
    cacheKeyPrefix: text('cache_key_prefix').notNull(),
    entryObjectKey: text('entry_object_key').notNull(),
    entryUrl: text('entry_url').notNull(),
    coverObjectKey: text('cover_object_key'),
    coverUrl: text('cover_url'),
    renderManifest: jsonb('render_manifest'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),

    generatedAt: timestamp('generated_at', { withTimezone: true }),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    errorCode: text('error_code'),
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    cardStatusExpiresAtIdx: index('card_render_caches_card_status_expires_at_idx').on(
      table.cardId,
      table.status,
      table.expiresAt,
    ),
    versionIdx: index('card_render_caches_version_idx').on(
      table.cardId,
      table.sourceCardSha256,
      table.rendererVersion,
      table.renderProfile,
      table.locale,
    ),
    expiresAtIdx: index('card_render_caches_expires_at_idx').on(table.expiresAt),
    statusUpdatedAtIdx: index('card_render_caches_status_updated_at_idx').on(
      table.status,
      table.updatedAt,
    ),
    cachePrefixUniqueIdx: uniqueIndex('card_render_caches_cache_prefix_unique_idx').on(
      table.cacheBucket,
      table.cacheKeyPrefix,
    ),
  }),
);

export const cardRenderJobs = pgTable(
  'card_render_jobs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),

    renderCacheId: uuid('render_cache_id').references(() => cardRenderCaches.id, { onDelete: 'set null' }),
    sourceCardSha256: text('source_card_sha256').notNull(),
    rendererVersion: text('renderer_version').notNull(),
    renderProfile: text('render_profile').default('community-web').notNull(),
    locale: text('locale').default('zh-CN').notNull(),

    status: cardRenderJobStatusEnum('status').default('queued').notNull(),
    priority: integer('priority').default(100).notNull(),
    attemptCount: integer('attempt_count').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(2).notNull(),

    lockedBy: text('locked_by'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    runAfter: timestamp('run_after', { withTimezone: true }).default(sql`NOW()`).notNull(),
    lastError: text('last_error'),
    createdBy: cardRenderJobCreatedByEnum('created_by').default('upload').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),

    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => ({
    statusPriorityRunAfterIdx: index('card_render_jobs_status_priority_run_after_idx').on(
      table.status,
      table.priority,
      table.runAfter,
    ),
    versionIdx: index('card_render_jobs_version_idx').on(
      table.cardId,
      table.sourceCardSha256,
      table.rendererVersion,
      table.renderProfile,
      table.locale,
    ),
    lockedAtIdx: index('card_render_jobs_locked_at_idx').on(table.lockedAt),
  }),
);

export type CardRenderCache = typeof cardRenderCaches.$inferSelect;
export type NewCardRenderCache = typeof cardRenderCaches.$inferInsert;
export type CardRenderJob = typeof cardRenderJobs.$inferSelect;
export type NewCardRenderJob = typeof cardRenderJobs.$inferInsert;
