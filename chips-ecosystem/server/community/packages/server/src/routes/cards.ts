import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors/AppError.js';
import type { Repositories } from '../repositories/types.js';
import type { CardService } from '../services/card.service.js';
import type { UserService } from '../services/user.service.js';

/**
 * 卡片只读路由（契约 §4.2、§4.5、§6.4）：详情、打开视图、状态、渲染状态、查看/封面入口。
 * 「认证：可选」：携带非法令牌按 401 处理，不静默降级为匿名（§4.2）。
 * 写操作（PATCH/DELETE）与渲染产物缓存代理归内容写域臂、对象存储臂。
 */

export interface CardsRouteDeps {
  repositories: Repositories;
  cardService: CardService;
  userService: UserService;
}

export async function cardRoutes(fastify: FastifyInstance, deps: CardsRouteDeps): Promise<void> {
  const { repositories, cardService, userService } = deps;

  fastify.get(
    '/api/v1/cards/:cardId',
    { preHandler: [fastify.optionalAuthenticate], config: { etag: true } },
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const card = await requireCard(cardId);
      cardService.assertReadable(card, request.user ?? null);
      const [author, webCache] = await Promise.all([
        userService.getById(card.userId),
        repositories.renderCaches.findWebByCard(card.id),
      ]);
      return { data: cardService.toDetail(card, author, webCache) };
    }
  );

  fastify.get(
    '/api/v1/cards/:cardId/open-view',
    { preHandler: [fastify.optionalAuthenticate], config: { etag: true } },
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const card = await requireCard(cardId);
      cardService.assertReadable(card, request.user ?? null);
      const [author, webCache] = await Promise.all([
        userService.getById(card.userId),
        repositories.renderCaches.findWebByCard(card.id),
      ]);
      return { data: cardService.toOpenView(card, author, webCache) };
    }
  );

  fastify.get(
    '/api/v1/cards/:cardId/status',
    { preHandler: [fastify.optionalAuthenticate], config: { etag: true } },
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const card = await requireCard(cardId);
      cardService.assertReadable(card, request.user ?? null);
      const [webCache, caches] = await Promise.all([
        repositories.renderCaches.findWebByCard(card.id),
        repositories.renderCaches.listByCard(card.id),
      ]);
      return { data: cardService.toStatus(card, webCache, caches.length) };
    }
  );

  fastify.get(
    '/api/v1/cards/:cardId/render-status',
    { preHandler: [fastify.optionalAuthenticate], config: { noStore: true } },
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const card = await requireCard(cardId);
      cardService.assertReadable(card, request.user ?? null);
      const webCache = await repositories.renderCaches.findWebByCard(card.id);
      return { data: cardService.toRenderStatus(card, webCache) };
    }
  );

  fastify.get(
    '/api/v1/cards/:cardId/view',
    { preHandler: [fastify.optionalAuthenticate], config: { noStore: true } },
    async (request, reply) => {
      const { cardId } = request.params as { cardId: string };
      const card = await requireCard(cardId);
      cardService.assertReadable(card, request.user ?? null);
      const webCache = await repositories.renderCaches.findWebByCard(card.id);
      const resolution = cardService.resolveView(card, webCache);
      if (resolution.kind === 'redirect') {
        return reply.redirect(302, resolution.location);
      }
      if (resolution.kind === 'renderError') {
        throw AppError.conflict('COMMUNITY_CARD_RENDER_ERROR', '查看缓存生成失败');
      }
      return reply
        .status(202)
        .header('Retry-After', String(resolution.retryAfterSeconds))
        .send({
          data: {
            cardId: card.id,
            viewState: cardService.deriveViewState(card, webCache),
          },
        });
    }
  );

  fastify.get(
    '/api/v1/cards/:cardId/cover',
    { preHandler: [fastify.optionalAuthenticate], config: { noStore: true } },
    async (request, reply) => {
      const { cardId } = request.params as { cardId: string };
      const card = await requireCard(cardId);
      cardService.assertReadable(card, request.user ?? null);
      const coverCache = await repositories.renderCaches.findCoverByCard(card.id);
      const resolution = cardService.resolveCover(card, coverCache);
      if (resolution.kind === 'redirect') {
        return reply.redirect(302, resolution.location);
      }
      // 处理中返回带 Retry-After 的临时占位页（契约 §6.4；失败已回退默认封面）。
      return reply
        .status(202)
        .header('Retry-After', String(resolution.retryAfterSeconds))
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(
          `<!DOCTYPE html>\n<html lang="zh-CN">\n  <head><meta charset="utf-8" /><meta http-equiv="refresh" content="${resolution.retryAfterSeconds}" /><title>封面生成中</title></head>\n  <body><p>封面正在生成，请稍后刷新。</p></body>\n</html>\n`
        );
    }
  );

  async function requireCard(cardId: string) {
    const card = await repositories.cards.findById(cardId);
    if (card === null) {
      throw AppError.notFound('COMMUNITY_CARD_NOT_FOUND', '卡片不存在或不可见');
    }
    return card;
  }
}
