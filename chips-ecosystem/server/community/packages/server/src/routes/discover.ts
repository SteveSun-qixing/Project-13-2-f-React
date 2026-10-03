import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors/AppError.js';
import { buildPagination, parsePagination } from '../lib/pagination.js';
import type { Repositories } from '../repositories/types.js';
import type { CardService } from '../services/card.service.js';
import type { BoxService } from '../services/box.service.js';
import type { UserService } from '../services/user.service.js';

/**
 * 发现与检索路由（契约 §4.7）：公开就绪卡片/箱子按 createdAt 倒序分页；
 * 检索按名称、标签与用户名匹配，结果只含公开可见内容，不返回私有或未就绪内容的存在性。
 */

export interface DiscoverRouteDeps {
  repositories: Repositories;
  cardService: CardService;
  boxService: BoxService;
  userService: UserService;
}

export const SEARCH_TYPE_VALUES = ['card', 'box', 'user'] as const;
export type SearchType = (typeof SEARCH_TYPE_VALUES)[number];

export function discoverRoutes(fastify: FastifyInstance, deps: DiscoverRouteDeps): void {
  const { repositories, cardService, boxService, userService } = deps;

  fastify.get('/api/v1/discover/cards', { config: { etag: true } }, async (request) => {
    const pagination = parsePagination(request.query);
    const result = await repositories.cards.listPublicReady(pagination);
    return {
      data: result.items.map((card) => cardService.toSummary(card)),
      pagination: buildPagination(pagination, result.total),
    };
  });

  fastify.get('/api/v1/discover/boxes', { config: { etag: true } }, async (request) => {
    const pagination = parsePagination(request.query);
    const result = await repositories.boxes.listPublicReady(pagination);
    return {
      data: result.items.map((box) => boxService.toSummary(box)),
      pagination: buildPagination(pagination, result.total),
    };
  });

  fastify.get('/api/v1/search', { config: { etag: true } }, async (request) => {
    const query = parseSearchQuery(request.query);
    const pagination = { page: query.page, pageSize: query.pageSize };
    switch (query.type) {
      case 'card': {
        const result = await repositories.cards.searchPublicReady(query.q, pagination);
        return {
          data: result.items.map((card) => cardService.toSummary(card)),
          pagination: buildPagination(pagination, result.total),
        };
      }
      case 'box': {
        const result = await repositories.boxes.searchPublicReady(query.q, pagination);
        return {
          data: result.items.map((box) => boxService.toSummary(box)),
          pagination: buildPagination(pagination, result.total),
        };
      }
      case 'user': {
        const result = await repositories.users.searchActive(query.q, pagination);
        return {
          data: result.items.map((user) => userService.toPublicProfile(user)),
          pagination: buildPagination(pagination, result.total),
        };
      }
    }
  });

  /** 检索参数（契约 §4.7）：q 必填（去首尾空白后长度不足 1 报错）；type 缺省 card。 */
  function parseSearchQuery(raw: unknown): {
    q: string;
    type: SearchType;
    page: number;
    pageSize: number;
  } {
    const input = (raw ?? {}) as Record<string, unknown>;
    const rawQ = typeof input['q'] === 'string' ? input['q'] : '';
    const q = rawQ.trim();
    if (q.length < 1) {
      throw AppError.badRequest('COMMUNITY_VALIDATION_ERROR', '检索词 q 必填', { field: 'q' });
    }
    if (q.length > 200) {
      throw AppError.badRequest('COMMUNITY_VALIDATION_ERROR', '检索词过长', { field: 'q' });
    }
    const rawType = typeof input['type'] === 'string' ? input['type'] : 'card';
    if (!(SEARCH_TYPE_VALUES as readonly string[]).includes(rawType)) {
      throw AppError.badRequest('COMMUNITY_VALIDATION_ERROR', 'type 只支持 card、box 或 user', {
        field: 'type',
      });
    }
    const pagination = parsePagination(input);
    return { q, type: rawType as SearchType, page: pagination.page, pageSize: pagination.pageSize };
  }
}
