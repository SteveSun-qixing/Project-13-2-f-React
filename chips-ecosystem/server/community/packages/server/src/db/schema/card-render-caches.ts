import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { cards } from './cards.js';

/**
 * card_render_caches——《社区平台设计》§2.4：渲染缓存记录。
 * 缓存键不变量：cardId + sourceCardSha256 + rendererVersion + renderProfile 唯一；
 * 过期只删缓存不删源文件。公开卡片入口为公开桶/CDN 地址，私有卡片经受控代理路径。
 * 状态 viewState 取值与语义以契约 §4.5 为唯一权威（pending/rendering/ready/error）。
 */

export const viewStateEnum = pgEnum('view_state', ['pending', 'rendering', 'ready', 'error']);
export const renderProfileEnum = pgEnum('render_profile', ['community-web', 'community-cover']);

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
    renderProfile: renderProfileEnum('render_profile').notNull(),

    state: viewStateEnum('state').default('pending').notNull(),
    /** 渲染尝试次数（render-status DTO attemptCount 数据源）。 */
    attemptCount: integer('attempt_count').default(0).notNull(),

    /** 缓存版本（服务端生成时确定；客户端不得自行构造缓存路径）。 */
    cacheVersion: text('cache_version').notNull().default(''),
    /** 缓存桶与前缀。 */
    cacheBucket: text('cache_bucket'),
    cachePrefix: text('cache_prefix'),

    /** 公开内容入口（对象存储/CDN 绝对地址）。 */
    viewEntryUrl: text('view_entry_url'),
    coverEntryUrl: text('cover_entry_url'),
    /** 私有内容受控代理路径（API 内相对路径）。 */
    viewProxyPath: text('view_proxy_path'),
    coverProxyPath: text('cover_proxy_path'),

    errorCode: text('error_code'),
    errorMessage: text('error_message'),

    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    /** TTL（最后一次访问后续期，默认 30 天；过期由 Worker 清理）。 */
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    cacheKeyUniqueIdx: uniqueIndex('card_render_caches_key_unique_idx').on(
      table.cardId,
      table.sourceCardSha256,
      table.rendererVersion,
      table.renderProfile
    ),
    cardIdx: index('card_render_caches_card_idx').on(table.cardId),
  })
);

export type CardRenderCache = typeof cardRenderCaches.$inferSelect;
export type NewCardRenderCache = typeof cardRenderCaches.$inferInsert;
