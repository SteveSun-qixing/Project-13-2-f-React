import { z } from 'zod';

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const UpdateCardSchema = z.object({
  visibility: z.enum(['public', 'private']).optional(),
});

export const UpdateBoxSchema = z.object({
  visibility: z.enum(['public', 'private']).optional(),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
export type UpdateBoxInput = z.infer<typeof UpdateBoxSchema>;
