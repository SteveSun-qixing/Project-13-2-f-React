import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * idempotency_records——幂等键记录（契约 §6.2）。
 * 语义：同一账号在同一端点上相同幂等键重复请求，请求体一致返回首次结果（状态码与
 * 响应体，会话 ID 相同），请求体不一致返回 409 COMMUNITY_IDEMPOTENCY_CONFLICT。
 * 保留时间由配置控制（默认 24 小时，不低于上传会话有效期 60 分钟）。
 */

export const idempotencyRecords = pgTable(
  'idempotency_records',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    accountId: uuid('account_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** 端点标识（路由 method+url 模板，如 `POST /api/v1/rooms`）。 */
    endpoint: text('endpoint').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),

    /** 请求体一致性指纹（sha256）。 */
    requestHash: text('request_hash').notNull(),

    /** 首次结果的响应；null 表示处理中（claim 已占用、响应未落）。 */
    statusCode: integer('status_code'),
    responseBody: jsonb('response_body'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    accountEndpointKeyUniqueIdx: index('idempotency_records_unique_idx').on(
      table.accountId,
      table.endpoint,
      table.idempotencyKey
    ),
    expiresIdx: index('idempotency_records_expires_idx').on(table.expiresAt),
  })
);

export type IdempotencyRecord = typeof idempotencyRecords.$inferSelect;
export type NewIdempotencyRecord = typeof idempotencyRecords.$inferInsert;
