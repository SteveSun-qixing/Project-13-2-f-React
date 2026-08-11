import {
  integer,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { cards } from './cards';
import { users } from './users';

export const cardPipelineJobStatusEnum = pgEnum('card_pipeline_job_status', [
  'queued',
  'processing',
  'succeeded',
  'failed',
]);

export const cardPipelineJobs = pgTable(
  'card_pipeline_jobs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    sourceBucket: text('source_bucket').notNull(),
    sourceKey: text('source_key').notNull(),

    status: cardPipelineJobStatusEnum('status').default('queued').notNull(),
    retryCount: integer('retry_count').default(0).notNull(),
    maxRetries: integer('max_retries').default(2).notNull(),
    lastError: text('last_error'),
    lockedBy: text('locked_by'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    statusCreatedAtIdx: index('card_pipeline_jobs_status_created_at_idx').on(
      table.status,
      table.createdAt,
    ),
    cardIdUniqueIdx: uniqueIndex('card_pipeline_jobs_card_id_unique_idx').on(table.cardId),
  }),
);

export type CardPipelineJob = typeof cardPipelineJobs.$inferSelect;
export type NewCardPipelineJob = typeof cardPipelineJobs.$inferInsert;
