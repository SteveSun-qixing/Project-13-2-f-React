import { z } from 'zod';

const ClientInfoSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    version: z.string().min(1).max(100).optional(),
    platform: z.string().min(1).max(100).optional(),
  })
  .optional();

const ObjectRefSchema = z.object({
  bucket: z.string().min(1).max(200),
  objectKey: z.string().min(1).max(2000),
  publicUrl: z.string().url().optional().nullable(),
  sizeBytes: z.coerce.number().int().nonnegative(),
  mimeType: z.string().min(1).max(200).optional().nullable(),
});

export const CreateCardTransferUploadSessionSchema = z.object({
  contentType: z.enum(['card', 'box']).default('card'),
  fileName: z.string().min(1).max(500).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  /**
   * 客户端是否将随本会话上传渲染产物（查看 HTML 与封面 HTML）。
   * - true：个人服务器模式，服务器直接接收产物并标记作品 ready；
   * - false：仅上传源文件，作品保持 pending 状态等待产物。
   */
  includeRenderArtifacts: z.boolean().optional(),
  client: ClientInfoSchema,
});

export const PresignCardTransferObjectsSchema = z.object({
  objects: z
    .array(
      z.object({
        /**
         * 对象角色：
         * - network-card：网络资源卡片源文件；
         * - resource：卡片外置资源；
         * - box-file：箱子源文件；
         * - render-file：客户端渲染的查看产物文件（index.html 与资源）；
         * - cover-file：封面产物文件（卡片 cover.html 与 boxcover 资源，或箱子的 cover 目录）。
         */
        role: z.enum(['network-card', 'resource', 'box-file', 'render-file', 'cover-file']),
        relativePath: z.string().min(1).max(1000).optional(),
        sizeBytes: z.coerce.number().int().nonnegative(),
        mimeType: z.string().min(1).max(200),
      }),
    )
    .min(1)
    .max(1000),
});

export const CompleteBoxTransferUploadSessionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  boxFileId: z.string().min(1).max(100).optional().nullable(),
  layoutPlugin: z.string().min(1).max(200).optional().nullable(),
  coverRatio: z.string().min(1).max(50).optional().nullable(),
  coverObject: z
    .object({
      bucket: z.string().min(1).max(200),
      objectKey: z.string().min(1).max(2000),
    })
    .optional(),
  boxFile: ObjectRefSchema,
  metadata: z.unknown().optional(),
  structure: z.unknown().optional(),
  content: z.unknown().optional(),
});

export const RenderArtifactSetSchema = z.object({
  /** 渲染器版本标识（由客户端上报） */
  rendererVersion: z.string().min(1).max(200),
  /** 渲染所用主题 ID（由客户端上报） */
  themeId: z.string().min(1).max(200).optional(),
  /** 渲染所用语言（由客户端上报） */
  locale: z.string().min(1).max(50).optional(),
  /** 查看产物（HTML 目录），entry 为目录入口文件相对路径 */
  view: z.object({
    entryRelativePath: z.string().min(1).max(1000),
    fileCount: z.coerce.number().int().nonnegative(),
    sizeBytes: z.coerce.number().int().nonnegative(),
  }),
  /** 封面产物（HTML 目录），entry 为目录入口文件相对路径 */
  cover: z
    .object({
      entryRelativePath: z.string().min(1).max(1000),
      fileCount: z.coerce.number().int().nonnegative(),
      sizeBytes: z.coerce.number().int().nonnegative(),
    })
    .optional(),
});

export const CompleteCardTransferUploadSessionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  cardFileId: z.string().min(1).max(100).optional().nullable(),
  coverRatio: z.string().min(1).max(50).optional().nullable(),
  networkCard: ObjectRefSchema,
  resources: z
    .array(
      ObjectRefSchema.extend({
        originalRelativePath: z.string().min(1).max(1000),
        networkUrl: z.string().url(),
      }),
    )
    .max(1000),
  restoreManifest: z.unknown().optional(),
  cardMetadata: z.unknown().optional(),
  cardStructure: z.unknown().optional(),
  /** 客户端渲染产物摘要（会话开启 includeRenderArtifacts 时必填） */
  renderArtifacts: RenderArtifactSetSchema.optional(),
});

export const CreateCardTransferDownloadSessionSchema = z.object({
  cardId: z.string().uuid(),
  versionId: z.string().uuid().optional(),
  client: ClientInfoSchema,
});

export type CreateCardTransferUploadSessionInput = z.infer<typeof CreateCardTransferUploadSessionSchema>;
export type PresignCardTransferObjectsInput = z.infer<typeof PresignCardTransferObjectsSchema>;
export type CompleteCardTransferUploadSessionInput = z.infer<typeof CompleteCardTransferUploadSessionSchema>;
export type CompleteBoxTransferUploadSessionInput = z.infer<typeof CompleteBoxTransferUploadSessionSchema>;
export type CreateCardTransferDownloadSessionInput = z.infer<typeof CreateCardTransferDownloadSessionSchema>;
