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
 * boxes——《社区平台设计》§2.4：箱子作品。
 * 不变量：源 .box 保存到私有桶 chips-box-files；箱子不进入渲染队列、不接受渲染产物；
 * 查看态由服务端生成只读箱子文档（§4.3）。status 与卡片同为三值（契约 §4.6）。
 */

export const boxStatusEnum = pgEnum('box_status', ['pending', 'ready', 'error']);
export const boxVisibilityEnum = pgEnum('box_visibility', ['public', 'private']);

export const boxes = pgTable(
  'boxes',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** 文件级 ID（← .box/metadata.yaml 的 box_id，10 位 Base62）。 */
    boxFileId: varchar('box_file_id', { length: 10 }).notNull().default(''),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),

    /** ← metadata.yaml 的 name。 */
    name: text('name').notNull(),
    /** 箱子简介（← metadata.yaml 的 description；只读文档展示用）。 */
    description: text('description'),
    coverRatio: varchar('cover_ratio', { length: 20 }).notNull().default('3:4'),
    /** ← active_layout_type，如 "chips.layout.grid"（契约 §4.6）。 */
    activeLayoutType: varchar('active_layout_type', { length: 120 }).notNull().default(''),
    chipStandardsVersion: varchar('chip_standards_version', { length: 64 }).notNull().default(''),
    tags: jsonb('tags')
      .notNull()
      .default(sql`'[]'::jsonb`),

    status: boxStatusEnum('status').default('pending').notNull(),
    visibility: boxVisibilityEnum('visibility').default('public').notNull(),
    errorMessage: text('error_message'),

    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull().default(0),
    sha256: text('sha256').notNull().default(''),

    /** 箱子封面资源入口（← metadata.yaml 的 cover_asset 存在时由 complete 阶段落 URL；否则 null）。 */
    coverUrl: text('cover_url'),
    coverBucket: text('cover_bucket'),
    coverKey: text('cover_key'),

    /** 完整 metadata.yaml（结构化）。 */
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** structure.yaml 条目列表（结构化；详情/只读文档按声明顺序消费）。 */
    entries: jsonb('entries')
      .notNull()
      .default(sql`'[]'::jsonb`),

    /** 永久保留的 .box 源对象位置（私有桶 chips-box-files）。 */
    sourceBucket: text('source_bucket'),
    sourceKey: text('source_key'),
    sourceBoxSha256: text('source_box_sha256'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    publicListIdx: index('boxes_visibility_status_created_at_idx').on(
      table.visibility,
      table.status,
      table.createdAt.desc()
    ),
    userCreatedIdx: index('boxes_user_created_at_idx').on(table.userId, table.createdAt.desc()),
    roomCreatedIdx: index('boxes_room_created_at_idx').on(table.roomId, table.createdAt.desc()),
  })
);

export type Box = typeof boxes.$inferSelect;
export type NewBox = typeof boxes.$inferInsert;

/** structure.yaml 条目快照（解析自 .box 包，complete 阶段落库；契约 §4.6 条目装配依据）。 */
export interface BoxEntrySnapshot {
  document_id?: string;
  title?: string;
  summary?: string;
  tags?: Array<string | string[]>;
  content_type?: string;
  last_known_modified_at?: string;
}

/** structure.yaml 条目引用（结构化存储于 boxes.entries）。 */
export interface BoxEntry {
  entry_id: string;
  url: string;
  enabled?: boolean;
  snapshot?: BoxEntrySnapshot;
  layout_hints?: Record<string, unknown>;
}
