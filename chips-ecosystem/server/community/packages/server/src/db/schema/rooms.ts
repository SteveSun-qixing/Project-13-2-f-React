import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * rooms——《社区平台设计》§2.4：用户的内容组织单元（保留能力，网页不暴露）。
 * 不变量：slug 在用户范围内唯一；房间公开不代表房间内内容公开。
 */

export const roomVisibilityEnum = pgEnum('room_visibility', ['public', 'private']);

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }),
    coverUrl: text('cover_url'),
    visibility: roomVisibilityEnum('visibility').default('public').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    userVisibilityCreatedAtIdx: index('rooms_user_visibility_created_at_idx').on(
      table.userId,
      table.visibility,
      table.createdAt.desc()
    ),
    userSlugUniqueIdx: uniqueIndex('rooms_user_slug_unique_idx').on(table.userId, table.slug),
  })
);

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
