import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { CardService, type CardRenderArtifacts } from '../services/card.service';
import { UpdateCardSchema, PaginationSchema } from '../schemas/content.schemas';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { getObjectStream } from '../storage/s3';

type RenderCacheStreamObject = Awaited<ReturnType<typeof getObjectStream>>;

function escapeHtmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function createDefaultCoverHtml(title: string): string {
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
        background: linear-gradient(155deg, #f8fbff 0%, #dfeeff 44%, #b7d7ff 100%);
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

function normalizeRangeHeader(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.startsWith('bytes=') ? normalized : undefined;
}

function normalizeAssetPath(assetPath: string): string {
  const normalized = assetPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter((part) => part.length > 0 && part !== '.' && part !== '..');
  if (parts.length === 0) {
    throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Invalid asset path');
  }
  return parts.join('/');
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

/** 从卡片渲染产物记录中解析查看/封面产物 */
function resolveArtifactProfile(
  artifacts: CardRenderArtifacts | null | undefined,
  role: 'view' | 'cover',
): CardRenderArtifacts['view'] | CardRenderArtifacts['cover'] | null {
  if (!artifacts) {
    return null;
  }
  if (role === 'cover') {
    return artifacts.cover ?? null;
  }
  return artifacts.view;
}

const cardRoutes: FastifyPluginAsync = async (fastify) => {
  const requireApiToken = fastify.requireApiToken();

  // ─── GET /api/v1/cards/:cardId ────────────────────────────────────

  fastify.get(
    '/api/v1/cards/:cardId',
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const card = await CardService.getAccessible(cardId);
      return { data: CardService.toDTO(card) };
    },
  );

  // ─── GET /api/v1/cards/:cardId/open-view ─────────────────────────

  fastify.get(
    '/api/v1/cards/:cardId/open-view',
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const card = await CardService.getOpenViewWithArtifacts(cardId);
      const artifacts = card.status === 'ready' ? card.renderArtifacts : null;
      const hasView = Boolean(artifacts?.view);
      const hasCover = Boolean(artifacts?.cover);

      return {
        data: {
          ...CardService.toOpenViewDTO(card),
          coverUrl: hasCover ? `/api/v1/cards/${card.id}/cover` : null,
          viewState: hasView ? 'ready' : card.status,
        },
      };
    },
  );

  // ─── GET /api/v1/cards/:cardId/status ─────────────────────────────

  fastify.get(
    '/api/v1/cards/:cardId/status',
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const card = await CardService.getAccessible(cardId);
      const artifacts = card.renderArtifacts as CardRenderArtifacts | null;

      return {
        data: {
          cardId: card.id,
          status: card.status,
          errorMessage: card.errorMessage,
          htmlUrl: card.htmlUrl,
          viewUrl: `/api/v1/cards/${card.id}/view`,
          hasRenderArtifacts: Boolean(artifacts?.view),
          updatedAt: card.updatedAt,
        },
      };
    },
  );

  // ─── GET /api/v1/cards/:cardId/view ──────────────────────────────

  fastify.get(
    '/api/v1/cards/:cardId/view',
    async (request, reply) => {
      const { cardId } = request.params as { cardId: string };
      const card = await CardService.getAccessible(cardId);
      const artifacts = card.renderArtifacts as CardRenderArtifacts | null;
      const view = resolveArtifactProfile(artifacts, 'view');

      if (!view) {
        throw AppError.badRequest(
          ErrorCode.CARD_RENDER_NOT_READY,
          'Card render artifacts are not available yet',
        );
      }

      return reply.redirect(view.entryUrl, 302);
    },
  );

  // ─── GET /api/v1/cards/:cardId/cover ─────────────────────────────

  fastify.get(
    '/api/v1/cards/:cardId/cover',
    async (request, reply) => {
      const { cardId } = request.params as { cardId: string };
      const card = await CardService.getAccessible(cardId);
      const artifacts = card.renderArtifacts as CardRenderArtifacts | null;
      const cover = resolveArtifactProfile(artifacts, 'cover');

      if (!cover) {
        reply
          .status(200)
          .header('content-type', 'text/html; charset=utf-8');
        return reply.send(createDefaultCoverHtml(card.title));
      }

      return reply.redirect(cover.entryUrl, 302);
    },
  );

  // ─── GET /api/v1/cards/:cardId/render-cache/:cacheVersion/* ───────

  fastify.get(
    '/api/v1/cards/:cardId/render-cache/:cacheVersion/*',
    async (request, reply) => {
      const { cardId, cacheVersion, '*': assetPath } = request.params as {
        cardId: string;
        cacheVersion: string;
        '*': string;
      };
      const card = await CardService.getAccessible(cardId);
      const artifacts = card.renderArtifacts as CardRenderArtifacts | null;
      const view = resolveArtifactProfile(artifacts, 'view');

      if (!view || view.cacheVersion !== cacheVersion) {
        throw AppError.notFound(ErrorCode.NOT_FOUND, 'Render cache not found');
      }

      const normalizedAssetPath = normalizeAssetPath(assetPath);
      const range = normalizeRangeHeader(request.headers.range);
      const object = await getObjectStream({
        bucket: view.bucket,
        key: `${view.keyPrefix}/${normalizedAssetPath}`,
        range,
      });

      return sendRenderCacheObject(reply, object);
    },
  );

  // ─── GET /api/v1/cards/:cardId/cover-cache/:cacheVersion/* ───────

  fastify.get(
    '/api/v1/cards/:cardId/cover-cache/:cacheVersion/*',
    async (request, reply) => {
      const { cardId, cacheVersion, '*': assetPath } = request.params as {
        cardId: string;
        cacheVersion: string;
        '*': string;
      };
      const card = await CardService.getAccessible(cardId);
      const artifacts = card.renderArtifacts as CardRenderArtifacts | null;
      const cover = resolveArtifactProfile(artifacts, 'cover');

      if (!cover || cover.cacheVersion !== cacheVersion) {
        throw AppError.notFound(ErrorCode.NOT_FOUND, 'Cover cache not found');
      }

      const normalizedAssetPath = normalizeAssetPath(assetPath);
      const range = normalizeRangeHeader(request.headers.range);
      const object = await getObjectStream({
        bucket: cover.bucket,
        key: `${cover.keyPrefix}/${normalizedAssetPath}`,
        range,
      });

      return sendRenderCacheObject(reply, object);
    },
  );

  // ─── PATCH /api/v1/cards/:cardId ──────────────────────────────────

  fastify.patch(
    '/api/v1/cards/:cardId',
    { preHandler: [requireApiToken] },
    async (request) => {
      const { cardId } = request.params as { cardId: string };
      const body = UpdateCardSchema.parse(request.body);
      const card = await CardService.update(cardId, body);
      return { data: CardService.toDTO(card) };
    },
  );

  // ─── DELETE /api/v1/cards/:cardId ─────────────────────────────────

  fastify.delete(
    '/api/v1/cards/:cardId',
    { preHandler: [requireApiToken] },
    async (request, reply) => {
      const { cardId } = request.params as { cardId: string };
      await CardService.delete(cardId);
      return reply.status(204).send();
    },
  );

  // ─── GET /api/v1/cards ────────────────────────────────────────────

  fastify.get(
    '/api/v1/cards',
    async (request) => {
      const qs = PaginationSchema.parse(request.query);
      const result = await CardService.list(qs, { visibility: 'public' });
      return { data: result.items.map(CardService.toSummaryDTO), pagination: result.pagination };
    },
  );

  // ─── GET /api/v1/cards?status=all（管理：含未渲染作品，需令牌）──────

  fastify.get(
    '/api/v1/cards/manage',
    { preHandler: [requireApiToken] },
    async (request) => {
      const qs = PaginationSchema.parse(request.query);
      const result = await CardService.list(qs);
      return { data: result.items.map(CardService.toSummaryDTO), pagination: result.pagination };
    },
  );
};

export default cardRoutes;
