import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * users——《社区平台设计》§2.4：账号、公开资料、角色与启用状态。
 * 不变量：username 与 username_lower 全站唯一；role ∈ {user, admin}；isActive 由管理员控制。
 * 锁定字段（failed_login_count / locked_until）承载契约 §3.2 的连续失败锁定策略。
 */

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  /** 登录名（展示保留原文；输入面契约 §3.2 限定全小写）。 */
  username: varchar('username', { length: 32 }).notNull().unique(),
  /** 小写化登录名（大小写不敏感唯一判定）。 */
  usernameLower: varchar('username_lower', { length: 32 }).notNull().unique(),

  /** 邮箱（唯一，注册时统一小写归一）。 */
  email: varchar('email', { length: 254 }).notNull().unique(),

  /** 口令哈希（scrypt；只以哈希保存）。 */
  passwordHash: text('password_hash').notNull(),

  displayName: varchar('display_name', { length: 100 }),
  bio: varchar('bio', { length: 200 }),
  avatarUrl: text('avatar_url'),

  role: userRoleEnum('role').default('user').notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  /** 连续登录失败计数（成功登录清零）。 */
  failedLoginCount: integer('failed_login_count').default(0).notNull(),
  /** 账号锁定截止时刻；null 表示未锁定。 */
  lockedUntil: timestamp('locked_until', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
