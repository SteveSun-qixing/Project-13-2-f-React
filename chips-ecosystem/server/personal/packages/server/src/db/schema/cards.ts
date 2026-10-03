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

/**
 * cards——《个人服务器设计》§3.5 单用户内容模型：卡片作品。
 * 不存在 users / rooms / card_render_caches / card_render_jobs 表（§3.1.2）：
 * 作品直接属于服务器本身，可见性取 public / private（§3.3）。
 * 渲染产物记录（render_artifacts）由 card-transfer 控制面臂的 complete 发布事务写入。
 */

export const cardStatusEnum = pgEnum('card_status', ['pending', 'ready', 'error']);

export const cardVisibilityEnum = pgEnum('card_visibility', ['public', 'private']);

export const cards = pgTable(
  'cards',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /**
     * 卡片文件内置的 10 位 62 进制 ID（来自 .card/metadata.yaml 的 id 字段）。
     * 可能为 null（发布事务完成前）。
     */
    cardFileId: varchar('card_file_id', { length: 10 }),

    /** 卡片标题（来自 metadata.yaml 的 name 字段）。 */
    title: text('title').notNull(),

    /** 卡片封面入口 URL（客户端渲染上传的封面产物入口）。 */
    coverUrl: text('cover_url'),

    /** 封面展示比例，来自 metadata.yaml 的 cover_ratio。 */
    coverRatio: text('cover_ratio'),

    /** 查看入口 URL（客户端渲染上传的查看产物入口）。 */
    htmlUrl: text('html_url'),

    /** 客户端渲染产物清单（渲染器版本、查看/封面产物对象位置与统计；§4.5）。 */
    renderArtifacts: jsonb('render_artifacts'),

    /** 客户端渲染产物接收完成时间。 */
    renderedAt: timestamp('rendered_at', { withTimezone: true }),

    /** 永久 .card 源文件所在 bucket。 */
    sourceCardBucket: text('source_card_bucket'),

    /** 永久 .card 源文件对象 key。 */
    sourceCardKey: text('source_card_key'),

    /** 永久 .card 源文件公开或内部 URL。 */
    sourceCardUrl: text('source_card_url'),

    /** 永久 .card 源文件 SHA-256。 */
    sourceCardSha256: text('source_card_sha256'),

    /** 永久 .card 源文件保存时间。 */
    sourceCardStoredAt: timestamp('source_card_stored_at', { withTimezone: true }),

    /** 发布时的外置资源清单（删除级联清理的枚举依据，契约 §4.2.7）。 */
    resourceManifest: jsonb('resource_manifest'),

    /** 发布客户端名称。 */
    publishedByClient: text('published_by_client'),

    /** 发布客户端版本。 */
    publishedClientVersion: text('published_client_version'),

    /** 发布完成时间。 */
    publishedAt: timestamp('published_at', { withTimezone: true }),

    /** 完整 metadata.yaml 内容（结构化 JSON）。 */
    cardMetadata: jsonb('card_metadata'),

    /** 完整 structure.yaml 内容（结构化 JSON）。 */
    cardStructure: jsonb('card_structure'),

    /**
     * 作品状态（§3.2 状态机，无 processing）：
     * - pending：源文件已就绪，查看产物尚未上传（公开面提示「尚未渲染」）；
     * - ready：查看产物已发布；
     * - error：发布或校验失败，保留 errorMessage，可经重新发布恢复。
     */
    status: cardStatusEnum('status').default('pending').notNull(),

    /** 处理错误信息。 */
    errorMessage: text('error_message'),

    visibility: cardVisibilityEnum('visibility').default('public').notNull(),

    /** 原始 .card 文件大小（字节）。 */
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (table) => ({
    visibilityStatusCreatedAtIdx: index('cards_visibility_status_created_at_idx').on(
      table.visibility,
      table.status,
      table.createdAt.desc()
    ),
    cardFileIdIdx: index('cards_card_file_id_idx').on(table.cardFileId),
    sourceCardSha256Idx: index('cards_source_card_sha256_idx').on(table.sourceCardSha256),
    sourceCardObjectIdx: index('cards_source_card_object_idx').on(
      table.sourceCardBucket,
      table.sourceCardKey
    ),
  })
);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
