import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  /** 登录名（唯一，原始大小写保留，查询时使用 username_lower） */
  username: varchar('username', { length: 32 }).notNull().unique(),

  /** 小写化登录名（用于大小写不敏感唯一索引），由应用层写入 */
  usernameLower: varchar('username_lower', { length: 32 }).notNull().unique(),

  /** 可自定义的显示名称 */
  displayName: varchar('display_name', { length: 100 }),

  /** bcrypt 哈希密码 */
  passwordHash: text('password_hash').notNull(),

  /** 简介 */
  bio: varchar('bio', { length: 200 }),

  /** 头像 CDN URL */
  avatarUrl: text('avatar_url'),

  /** 角色 */
  role: userRoleEnum('role').default('user').notNull(),

  /** 账号是否启用（管理员可禁用） */
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),

  updatedAt: timestamp('updated_at', { withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
