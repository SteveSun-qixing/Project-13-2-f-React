import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const visibilityEnum = pgEnum('visibility', ['public', 'private']);

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** 房间名称（显示用） */
    name: varchar('name', { length: 100 }).notNull(),

    /** URL 友好 slug（同用户下唯一） */
    slug: varchar('slug', { length: 100 }).notNull(),

    description: varchar('description', { length: 500 }),

    coverUrl: text('cover_url'),

    visibility: visibilityEnum('visibility').default('public').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    userVisibilityCreatedAtIdx: index('rooms_user_visibility_created_at_idx')
      .on(table.userId, table.visibility, table.createdAt)
      .desc(),
    userSlugUniqueIdx: uniqueIndex('rooms_user_slug_unique_idx').on(table.userId, table.slug),
  }),
);

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
