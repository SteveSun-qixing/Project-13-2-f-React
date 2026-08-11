import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { rooms } from './rooms';

export const boxVisibilityEnum = pgEnum('box_visibility', ['public', 'private']);

export const boxes = pgTable(
  'boxes',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /**
     * 箱子文件内置的 10 位 62 进制 ID（来自 .box/metadata.yaml 的 box_id 字段）
     */
    boxFileId: varchar('box_file_id', { length: 10 }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** 所属房间（null = 挂在用户根目录） */
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),

    /** 箱子名称 */
    title: text('title').notNull(),

    /** 封面入口 URL（相对路由 `/api/v1/boxes/{boxId}/cover`，与卡片封面同构） */
    coverUrl: text('cover_url'),

    /** 封面 HTML 对象存储位置（bucket） */
    coverBucket: text('cover_bucket'),

    /** 封面 HTML 对象存储位置（key） */
    coverKey: text('cover_key'),

    /** 封面展示比例，来自 metadata.yaml 的 cover_ratio */
    coverRatio: text('cover_ratio'),

    /** 箱子发布态文档入口 URL */
    documentUrl: text('document_url'),

    /** 完整 metadata.yaml 内容 */
    metadata: jsonb('metadata'),

    /** 完整 structure.yaml 内容（含条目引用列表） */
    structure: jsonb('structure'),

    /** 完整 content.yaml 内容（布局配置） */
    content: jsonb('content'),

    /** 当前布局插件标识（如 chips-official.grid-layout） */
    layoutPlugin: text('layout_plugin'),

    /** 发布态 .box 源文件对象存储位置（内部读） */
    sourceBoxBucket: text('source_box_bucket'),
    sourceBoxKey: text('source_box_key'),
    sourceBoxUrl: text('source_box_url'),
    sourceBoxSha256: text('source_box_sha256'),
    sourceBoxStoredAt: timestamp('source_box_stored_at', { withTimezone: true }),

    visibility: boxVisibilityEnum('visibility').default('public').notNull(),

    /** 原始 .box 文件大小（字节） */
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    userVisibilityCreatedAtIdx: index('boxes_user_visibility_created_at_idx')
      .on(table.userId, table.visibility, table.createdAt)
      .desc(),
    roomVisibilityCreatedAtIdx: index('boxes_room_visibility_created_at_idx')
      .on(table.roomId, table.visibility, table.createdAt)
      .desc(),
    visibilityCreatedAtIdx: index('boxes_visibility_created_at_idx')
      .on(table.visibility, table.createdAt)
      .desc(),
    sourceBoxObjectIdx: index('boxes_source_box_object_idx').on(
      table.sourceBoxBucket,
      table.sourceBoxKey,
    ),
    sourceBoxSha256Idx: index('boxes_source_box_sha256_idx').on(table.sourceBoxSha256),
  }),
);

export type Box = typeof boxes.$inferSelect;
export type NewBox = typeof boxes.$inferInsert;
