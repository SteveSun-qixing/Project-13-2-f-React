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
  roomId: z.string().uuid().optional().nullable(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  client: ClientInfoSchema,
});

export const PresignCardTransferObjectsSchema = z.object({
  objects: z
    .array(
      z.object({
        role: z.enum(['network-card', 'resource', 'box-file', 'cover-file']),
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
