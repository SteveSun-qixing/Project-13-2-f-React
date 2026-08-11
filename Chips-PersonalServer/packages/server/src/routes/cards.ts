import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { CardService } from '../services/card.service';
import { UpdateCardSchema, PaginationSchema } from '../schemas/content.schemas';
import { UserService } from '../services/user.service';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { CardRenderCacheService } from '../services/card-render-cache.service';

type RenderCacheStreamObject = Awaited<ReturnType<typeof CardRenderCacheService.streamPrivateCache>>;

function escapeHtmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function createCoverPreparingHtml(title: string): string {
  const safeTitle = escapeHtmlText(title);
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; min-height: 100%; }
      body {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #f8fbff;
        color: #101828;
        font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
      }
      h1 { margin: 0; font-size: clamp(24px, 6vw, 44px); line-height: 1.08; text-align: center; }
    </style>
  </head>
  <body>
    <h1>${safeTitle}</h1>
  </body>
</html>`;
}

function shouldEnqueueOpenViewRenderJob(latestJob: { status: string } | null): boolean {
  return !latestJob || latestJob.status === 'succeeded' || latestJob.status === 'cancelled';
}

function normalizeRangeHeader(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.startsWith('bytes=') ? normalized : undefined;
}

function sendRenderCacheObject(
  reply: FastifyReply,
  object: RenderCacheStreamObject,
) {
  if (object.statusCode === 206 || object.contentRange) {
    reply.status(206);
  }
  reply.header('accept-ranges', object.acceptRanges ?? 'bytes');
  if (object.contentRange) {
    reply.header('content-range', object.contentRange);
  }
  if (object.contentType) {
    reply.header('content-type', object.contentType);
  }
  if (object.contentLength !== undefined) {
    reply.header('content-length', String(object.contentLength));
  }
  if (object.etag) {
    reply.header('etag', object.etag);
  }
  return reply.send(object.body);
}

const cardRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── GET /api/v1/cards/:cardId ────────────────────────────────────

  fastify.get(
    '/api/v1/cards/:cardId',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const card = await CardService.getAccessible(cardId, request.user?.userId ?? null);
      const owner = await UserService.findById(card.userId);
      return {
        data: {
          ...CardService.toDTO(card),
          user: owner ? UserService.toPublicProfile(owner) : null,
        },
      };
    },
  );

  // ─── GET /api/v1/cards/:cardId/open-view ─────────────────────────

  fastify.get(
    '/api/v1/cards/:cardId/open-view',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const card = await CardService.getOpenViewAccessible(cardId, request.user?.userId ?? null);
      const owner = await UserService.findById(card.userId);
      const renderCache = await CardRenderCacheService.findReadyCache(card.id, {
        renderProfile: CardRenderCacheService.viewRenderProfile,
      });
      const coverCache = await CardRenderCacheService.findReadyCache(card.id, {
        renderProfile: CardRenderCacheService.coverRenderProfile,
      });
      let latestJob = renderCache ? null : await CardRenderCacheService.getLatestJob(card.id, {
        renderProfile: CardRenderCacheService.viewRenderProfile,
      });
      if (!renderCache && card.status === 'ready' && shouldEnqueueOpenViewRenderJob(latestJob)) {
        latestJob = await CardRenderCacheService.enqueueForCard({
          cardId: card.id,
          createdBy: 'view_miss',
          renderProfile: CardRenderCacheService.viewRenderProfile,
          priority: 10,
        }) ?? latestJob;
      }
      const viewState = renderCache
        ? 'cache_ready'
        : latestJob?.status === 'failed'
            ? 'render_error'
            : card.status === 'ready'
              ? 'rendering'
              : card.status;

      return {
        data: {
          ...CardService.toOpenViewDTO(card),
          coverUrl: card.status === 'ready' || coverCache || card.coverUrl ? `/api/v1/cards/${card.id}/cover` : null,
          viewState,
          renderCache: renderCache
            ? {
                status: renderCache.status,
                generatedAt: renderCache.generatedAt,
                lastAccessedAt: renderCache.lastAccessedAt,
                expiresAt: renderCache.expiresAt,
              }
            : {
                status: latestJob?.status === 'failed'
                  ? 'error'
                  : latestJob?.status ?? 'queued',
                generatedAt: null,
                lastAccessedAt: null,
                expiresAt: null,
                errorMessage: latestJob?.lastError ?? null,
              },
          user: owner ? UserService.toPublicProfile(owner) : null,
        },
      };
    },
  );

  // ─── GET /api/v1/cards/:cardId/status ─────────────────────────────

  fastify.get(
    '/api/v1/cards/:cardId/status',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const card = await CardService.getAccessible(cardId, request.user?.userId ?? null);

      return {
        data: {
          cardId: card.id,
          status: card.status,
          errorMessage: card.errorMessage,
          htmlUrl: card.htmlUrl,
          viewUrl: `/api/v1/cards/${card.id}/view`,
          renderStatusUrl: `/api/v1/cards/${card.id}/render-status`,
          updatedAt: card.updatedAt,
        },
      };
    },
  );

  // ─── GET /api/v1/cards/:cardId/render-status ─────────────────────

  fastify.get(
    '/api/v1/cards/:cardId/render-status',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const card = await CardService.getAccessible(cardId, request.user?.userId ?? null);
      const renderCache = await CardRenderCacheService.findReadyCache(card.id, {
        renderProfile: CardRenderCacheService.viewRenderProfile,
      });
      const latestJob = renderCache ? null : await CardRenderCacheService.getLatestJob(card.id, {
        renderProfile: CardRenderCacheService.viewRenderProfile,
      });

      return {
        data: {
          cardId: card.id,
          status: renderCache?.status ?? latestJob?.status ?? card.status,
          viewState: renderCache
            ? 'cache_ready'
            : latestJob?.status === 'failed' || card.status === 'error'
              ? 'render_error'
              : 'rendering',
          attemptCount: latestJob?.attemptCount ?? 0,
          updatedAt: renderCache?.updatedAt ?? latestJob?.updatedAt ?? card.updatedAt,
          viewUrl: `/api/v1/cards/${card.id}/view`,
          error: latestJob?.lastError || card.errorMessage
            ? {
                code: ErrorCode.CARD_RENDER_ERROR,
                message: latestJob?.lastError ?? card.errorMessage,
              }
            : null,
        },
      };
    },
  );

  // ─── GET /api/v1/cards/:cardId/view ──────────────────────────────

  fastify.get(
    '/api/v1/cards/:cardId/view',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const { cardId } = request.params as { cardId: string };
      const card = await CardService.getAccessible(cardId, request.user?.userId ?? null);
      const renderCache = await CardRenderCacheService.findReadyCache(card.id, {
        renderProfile: CardRenderCacheService.viewRenderProfile,
      });

      if (renderCache) {
        const touched = await CardRenderCacheService.touchCache(renderCache.id);
        return reply.redirect(touched.entryUrl, 302);
      }

      await CardRenderCacheService.enqueueForCard({
        cardId: card.id,
        createdBy: 'view_miss',
        renderProfile: CardRenderCacheService.viewRenderProfile,
        priority: 10,
      });

      return reply.status(202).send({
        data: {
          cardId: card.id,
          viewState: card.status === 'error' ? 'render_error' : 'rendering',
          renderStatusUrl: `/api/v1/cards/${card.id}/render-status`,
          retryAfterSeconds: 3,
        },
      });
    },
  );

  // ─── GET /api/v1/cards/:cardId/cover ─────────────────────────────

  fastify.get(
    '/api/v1/cards/:cardId/cover',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const { cardId } = request.params as { cardId: string };
      const card = await CardService.getAccessible(cardId, request.user?.userId ?? null);
      const coverCache = await CardRenderCacheService.findReadyCache(card.id, {
        renderProfile: CardRenderCacheService.coverRenderProfile,
      });

      if (coverCache) {
        const touched = await CardRenderCacheService.touchCache(coverCache.id);
        return reply.redirect(touched.entryUrl, 302);
      }

      await CardRenderCacheService.enqueueForCard({
        cardId: card.id,
        createdBy: 'cover_miss',
        renderProfile: CardRenderCacheService.coverRenderProfile,
        priority: 20,
      });

      reply
        .status(202)
        .header('content-type', 'text/html; charset=utf-8')
        .header('retry-after', '3');
      return reply.send(createCoverPreparingHtml(card.title));
    },
  );

  // ─── GET /api/v1/cards/:cardId/render-cache/:cacheVersion/* ───────

  fastify.get(
    '/api/v1/cards/:cardId/render-cache/:cacheVersion/*',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const { cardId, cacheVersion, '*': assetPath } = request.params as {
        cardId: string;
        cacheVersion: string;
        '*': string;
      };
      await CardService.getAccessible(cardId, request.user?.userId ?? null);
      const range = normalizeRangeHeader(request.headers.range);
      const object = await CardRenderCacheService.streamPrivateCache({
        cardId,
        cacheVersion,
        assetPath,
        range,
        renderProfile: CardRenderCacheService.viewRenderProfile,
      });

      return sendRenderCacheObject(reply, object);
    },
  );

  // ─── GET /api/v1/cards/:cardId/cover-cache/:cacheVersion/* ───────

  fastify.get(
    '/api/v1/cards/:cardId/cover-cache/:cacheVersion/*',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const { cardId, cacheVersion, '*': assetPath } = request.params as {
        cardId: string;
        cacheVersion: string;
        '*': string;
      };
      await CardService.getAccessible(cardId, request.user?.userId ?? null);
      const range = normalizeRangeHeader(request.headers.range);
      const object = await CardRenderCacheService.streamPrivateCache({
        cardId,
        cacheVersion,
        assetPath,
        range,
        renderProfile: CardRenderCacheService.coverRenderProfile,
      });

      return sendRenderCacheObject(reply, object);
    },
  );

  // ─── PATCH /api/v1/cards/:cardId ──────────────────────────────────

  fastify.patch(
    '/api/v1/cards/:cardId',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const body = UpdateCardSchema.parse(request.body);
      const card = await CardService.update(cardId, request.user!.userId, body);
      return { data: CardService.toDTO(card) };
    },
  );

  // ─── DELETE /api/v1/cards/:cardId ─────────────────────────────────

  fastify.delete(
    '/api/v1/cards/:cardId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { cardId } = request.params as { cardId: string };
      await CardService.delete(cardId, request.user!.userId);
      return reply.status(204).send();
    },
  );

  // ─── GET /api/v1/users/me/cards ───────────────────────────────────

  fastify.get(
    '/api/v1/users/me/cards',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const qs = PaginationSchema.parse(request.query);
      const result = await CardService.listByUser(
        request.user!.userId,
        request.user!.userId,
        qs,
      );
      return { data: result.items.map(CardService.toSummaryDTO), pagination: result.pagination };
    },
  );

  // ─── GET /api/v1/users/:username/cards ───────────────────────────

  fastify.get(
    '/api/v1/users/:username/cards',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { username } = request.params as { username: string };
      const qs = PaginationSchema.parse(request.query);

      const owner = await UserService.findByUsername(username);
      if (!owner || !owner.isActive) {
        throw AppError.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
      }

      const result = await CardService.listByUser(
        owner.id,
        request.user?.userId ?? null,
        qs,
        { visibility: 'public', status: 'ready' },
      );

      return {
        data: result.items.map(CardService.toSummaryDTO),
        pagination: result.pagination,
      };
    },
  );
};

export default cardRoutes;
