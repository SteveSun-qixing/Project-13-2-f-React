import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * refresh_sessions——刷新令牌会话（服务端可吊销、可轮换，契约 §3.1）。
 * 登录 / 注册 / 刷新各建一会话；登出吊销当前会话；改密吊销除当前会话外全部会话。
 * 以 PostgreSQL 承载吊销面：本臂不引入 Redis（行 6 对象存储与桶层臂统一接入，
 * 届时吊销面如需迁 Redis 属实现内替换，不留兼容层）。
 */

export const refreshSessions = pgTable(
  'refresh_sessions',
  {
    /** refresh token 的 jti。 */
    jti: varchar('jti', { length: 64 }).primaryKey(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    userIdx: index('refresh_sessions_user_idx').on(table.userId),
  })
);

export type RefreshSession = typeof refreshSessions.$inferSelect;
export type NewRefreshSession = typeof refreshSessions.$inferInsert;
