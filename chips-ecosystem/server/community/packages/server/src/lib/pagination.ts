import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../errors/AppError.js';

/**
 * 分页（契约 §6.1）：列表接口统一 `page` / `pageSize`；page 从 1 起、缺省 1；
 * pageSize 缺省 20、最大 100；非法参数返回 COMMUNITY_VALIDATION_ERROR；
 * 超过 totalPages 的页返回空数组与正确分页对象。
 */

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationMeta extends PaginationParams {
  total: number;
  totalPages: number;
}

/** 解析并校验分页查询参数；非法（非整数、超范围）按契约返回 400 业务错误。 */
export function parsePagination(query: unknown): PaginationParams {
  const result = PaginationQuerySchema.safeParse(query ?? {});
  if (!result.success) {
    throw AppError.badRequest('COMMUNITY_VALIDATION_ERROR', '分页参数不合法', {
      field: 'page/pageSize',
    });
  }
  return { page: result.data.page, pageSize: result.data.pageSize };
}

export function offsetOf(pagination: PaginationParams): number {
  return (pagination.page - 1) * pagination.pageSize;
}

/** 构造契约固定四字段的 pagination 对象（total 为当前可见范围总条数）。 */
export function buildPagination(pagination: PaginationParams, total: number): PaginationMeta {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.ceil(total / pagination.pageSize),
  };
}

/** 列表查询结果（仓库端口统一返回形态）。 */
export interface PagedItems<T> {
  items: T[];
  total: number;
}

/** RFC 3339 UTC 时间（契约 §2.2）——Drizzle timestamp 落库为 Date，序列化统一走 ISO。 */
export function toRfc3339(value: Date): string {
  return value.toISOString();
}

/** 请求体/查询串哈希（幂等请求体一致性判定；sha256 十六进制）。 */
export function hashPayload(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value ?? null))
    .digest('hex');
}
