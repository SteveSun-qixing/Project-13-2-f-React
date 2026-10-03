import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { rooms } from './rooms.js';
import { users } from './users.js';

/**
 * cards——《社区平台设计》§2.4：卡片作品。
 * 不变量：源对象永久保留；status 只取 pending/ready/error（契约 §4.5 三值收敛，
 * 不存在 processing 等流水线中间状态）；公开列表只含 public + ready。
 *
 * 资源清单（resource_manifest）与发布产物对象清单（artifact_objects）是契约 §4.9
 * 删除清理的唯一枚举依据（对象键必须落在 `cards/{cardId}/…` 前缀内）。
 */

export const cardStatusEnum = pgEnum('card_status', ['pending', 'ready', 'error']);
export const cardVisibilityEnum = pgEnum('card_visibility', ['public', 'private']);

export const cards = pgTable(
  'cards',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** 文件级 ID（← .card/metadata.yaml 的 card_id，10 位 Base62；complete 阶段落库）。 */
    cardFileId: varchar('card_file_id', { length: 10 }).notNull().default(''),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** 所属房间（null = 挂在用户根目录）。 */
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),

    /** ← metadata.yaml 的 name。 */
    name: text('name').notNull(),
    /** ← cover_ratio；缺省 "3:4"（契约 §4.5）。 */
    coverRatio: varchar('cover_ratio', { length: 20 }).notNull().default('3:4'),
    /** ← metadata.yaml 的 chip_standards_version。 */
    chipStandardsVersion: varchar('chip_standards_version', { length: 64 }).notNull().default(''),
    /** ← metadata.yaml 的 tags（Array<string | string[]>）。 */
    tags: jsonb('tags')
      .notNull()
      .default(sql`'[]'::jsonb`),

    status: cardStatusEnum('status').default('pending').notNull(),
    visibility: cardVisibilityEnum('visibility').default('public').notNull(),
    /** 校验 / 渲染失败信息（诊断用，不直接回显）。 */
    errorMessage: text('error_message'),

    /** 网络资源卡片对象大小（字节）。 */
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull().default(0),
    /** 网络资源卡片对象摘要（小写十六进制）。 */
    sha256: text('sha256').notNull().default(''),

    /** 永久保留的 .card 源对象位置（私有桶 chips-card-files）。 */
    sourceBucket: text('source_bucket'),
    sourceKey: text('source_key'),
    sourceCardSha256: text('source_card_sha256'),

    /** 上传发布时的资源清单（网络卡片对象 + resources[]；删除清理枚举依据）。 */
    resourceManifest: jsonb('resource_manifest')
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** 客户端渲染产物对象清单（render-file / cover-file；删除清理枚举依据）。 */
    artifactObjects: jsonb('artifact_objects')
      .notNull()
      .default(sql`'[]'::jsonb`),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    publicReadyListIdx: index('cards_visibility_status_created_at_idx').on(
      table.visibility,
      table.status,
      table.createdAt.desc()
    ),
    userCreatedIdx: index('cards_user_created_at_idx').on(table.userId, table.createdAt.desc()),
    roomCreatedIdx: index('cards_room_created_at_idx').on(table.roomId, table.createdAt.desc()),
    cardFileIdIdx: index('cards_card_file_id_idx').on(table.cardFileId),
  })
);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
