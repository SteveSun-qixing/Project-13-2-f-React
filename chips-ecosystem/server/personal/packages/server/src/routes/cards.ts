import type { FastifyInstance } from 'fastify';
import { parsePagination, buildPagination } from '../lib/pagination.js';
import type { CardService } from '../services/card.service.js';

/**
 * 卡片内容只读路由（契约 §4.2）：公开读（列表/详情/打开视图/状态/查看/封面）
 * 与管理读（cards/manage，需令牌）。读操作永不要求令牌，写操作无一例外要求
 * 令牌（《15》§5.1）——写域路由（PATCH/DELETE）与渲染产物受控代理
 * （render-cache/cover-cache）归后续臂（见包 README 臂序登记）。
 */

export interface CardsRouteDeps {
  cardService: CardService;
}

export function cardRoutes(fastify: FastifyInstance, deps: CardsRouteDeps): void {
  const { cardService } = deps;
  const requireApiToken = fastify.requireApiToken();

  // ─── GET /api/v1/cards（公开：仅 public，createdAt 倒序）────────────

  fastify.get('/api/v1/cards', async (request) => {
    const pagination = parsePagination(request.query);
    const { items, total } = await cardService.listPublic(pagination);
    return {
      data: items.map((card) => cardService.toSummary(card)),
      pagination: buildPagination(pagination, total),
    };
  });

  // ─── GET /api/v1/cards/manage（管理读：全部可见性与状态，需令牌）────

  fastify.get('/api/v1/cards/manage', { preHandler: [requireApiToken] }, async (request) => {
    const pagination = parsePagination(request.query);
    const { items, total } = await cardService.listAll(pagination);
    return {
      data: items.map((card) => cardService.toSummary(card)),
      pagination: buildPagination(pagination, total),
    };
  });

  // ─── GET /api/v1/cards/:cardId（公开详情）───────────────────────────

  fastify.get('/api/v1/cards/:cardId', async (request) => {
    const { cardId } = request.params as { cardId: string };
    const card = await cardService.getAccessible(cardId);
    return { data: cardService.toDetail(card) };
  });

  // ─── GET /api/v1/cards/:cardId/open-view（轻量打开数据）─────────────

  fastify.get('/api/v1/cards/:cardId/open-view', async (request) => {
    const { cardId } = request.params as { cardId: string };
    const card = await cardService.getAccessible(cardId);
    return { data: cardService.toOpenView(card) };
  });

  // ─── GET /api/v1/cards/:cardId/status（状态与产物可用性）────────────

  fastify.get('/api/v1/cards/:cardId/status', async (request) => {
    const { cardId } = request.params as { cardId: string };
    const card = await cardService.getAccessible(cardId);
    return { data: cardService.toStatus(card) };
  });

  // ─── GET /api/v1/cards/:cardId/view（302 → 查看产物入口）────────────

  fastify.get('/api/v1/cards/:cardId/view', async (request, reply) => {
    const { cardId } = request.params as { cardId: string };
    const card = await cardService.getAccessible(cardId);
    return reply.redirect(cardService.resolveViewLocation(card), 302);
  });

  // ─── GET /api/v1/cards/:cardId/cover（302 → 封面产物入口｜占位页）───

  fastify.get('/api/v1/cards/:cardId/cover', async (request, reply) => {
    const { cardId } = request.params as { cardId: string };
    const card = await cardService.getAccessible(cardId);
    const resolution = cardService.resolveCover(card);
    if (resolution.kind === 'redirect') {
      return reply.redirect(resolution.location, 302);
    }
    return reply.status(200).type('text/html; charset=utf-8').send(resolution.html);
  });
}
