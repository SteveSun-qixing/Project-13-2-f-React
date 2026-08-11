import type { FastifyPluginAsync } from 'fastify';
import { BoxService } from '../services/box.service';
import { UpdateBoxSchema, PaginationSchema } from '../schemas/content.schemas';
import type { BoxMetadata, BoxStructure, EnrichedBoxEntryRef } from '../types/box';
import type { Box } from '../db/schema/boxes';
import type { PublicBucketName } from '../storage/buckets';
import { UserService } from '../services/user.service';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { buildObjectUrl, createPresignedGetUrl } from '../storage/s3';

const BOX_DOWNLOAD_URL_TTL_SECONDS = 900;

function renderBoxCoverPreparingHtml(title: string): string {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
  html, body { margin: 0; width: 100%; height: 100%; background: #101014; color: #fff; }
  body { display: grid; place-items: center; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
  .wrap { text-align: center; }
  h1 { font-size: 22px; font-weight: 600; margin: 0 0 10px; }
  p { font-size: 14px; opacity: 0.72; margin: 0; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>${safeTitle}</h1>
    <p>封面生成中，请稍后刷新…</p>
  </div>
</body>
</html>`;
}

function sanitizeBoxFileName(value: string): string {
  const sanitized = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return (sanitized || 'box').endsWith('.box') ? sanitized : `${sanitized || 'box'}.box`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBoxDocumentHtml(box: Box, entries: EnrichedBoxEntryRef[]): string {
  const metadata = (box.metadata ?? {}) as BoxMetadata;
  const name = escapeHtml(box.title || metadata.name || '未命名箱子');
  const description = metadata.description ? escapeHtml(metadata.description) : '';

  const entryItems = entries
    .map((entry) => {
      const label = escapeHtml(entry.title || entry.document_id || entry.entry_id || '未命名条目');
      if (entry.communityCardId) {
        return `<li><a href="/cards/${encodeURIComponent(entry.communityCardId)}">${label}</a></li>`;
      }
      if (entry.embedded) {
        return `<li>${label}（内嵌：${escapeHtml(entry.url)}）</li>`;
      }
      return `<li>${label}（<a href="${escapeHtml(entry.url)}">${escapeHtml(entry.url)}</a>）</li>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
</head>
<body>
<h1>${name}</h1>
${description ? `<p>${description}</p>` : ''}
<h2>条目</h2>
${entryItems ? `<ul>\n${entryItems}\n</ul>` : '<p>暂无条目</p>'}
</body>
</html>`;
}

const boxRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── GET /api/v1/boxes/:boxId ─────────────────────────────────────

  fastify.get(
    '/api/v1/boxes/:boxId',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { boxId } = request.params as { boxId: string };
      const box = await BoxService.getAccessible(boxId, request.user?.userId ?? null);

      // 补充条目引用的社区匹配信息
      const enrichedCards = await BoxService.enrichCardRefs(
        (box.structure as BoxStructure) ?? { entries: [] },
      );
      const owner = await UserService.findById(box.userId);

      return {
        data: {
          ...BoxService.toDTO(box),
          cards: enrichedCards,
          user: owner ? UserService.toPublicProfile(owner) : null,
        },
      };
    },
  );

  // ─── GET /api/v1/boxes/:boxId/view ────────────────────────────────

  fastify.get(
    '/api/v1/boxes/:boxId/view',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const { boxId } = request.params as { boxId: string };
      const box = await BoxService.getAccessible(boxId, request.user?.userId ?? null);
      const structure = (box.structure ?? { entries: [] }) as BoxStructure;
      const entries = await BoxService.enrichCardRefs(structure);
      return reply.type('text/html; charset=utf-8').send(renderBoxDocumentHtml(box, entries));
    },
  );

  // ─── GET /api/v1/boxes/:boxId/cover ──────────────────────────────

  fastify.get(
    '/api/v1/boxes/:boxId/cover',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const { boxId } = request.params as { boxId: string };
      const box = await BoxService.getAccessible(boxId, request.user?.userId ?? null);

      if (box.coverBucket && box.coverKey) {
        return reply.redirect(buildObjectUrl(box.coverBucket as PublicBucketName, box.coverKey), 302);
      }

      const title = box.title || '箱子';
      return reply
        .status(202)
        .header('content-type', 'text/html; charset=utf-8')
        .header('retry-after', '3')
        .send(renderBoxCoverPreparingHtml(title));
    },
  );

  // ─── GET /api/v1/boxes/:boxId/download ─────────────────────────────

  fastify.get(
    '/api/v1/boxes/:boxId/download',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { boxId } = request.params as { boxId: string };
      const box = await BoxService.getAccessible(boxId, request.user?.userId ?? null);

      if (!box.sourceBoxBucket || !box.sourceBoxKey) {
        throw AppError.notFound(ErrorCode.BOX_NOT_FOUND, 'Box source file is not available');
      }

      const suggestedFileName = sanitizeBoxFileName(box.title || 'box');
      const signed = createPresignedGetUrl({
        bucket: box.sourceBoxBucket,
        key: box.sourceBoxKey,
        expiresInSeconds: BOX_DOWNLOAD_URL_TTL_SECONDS,
        responseContentDisposition: `attachment; filename="${encodeURIComponent(suggestedFileName)}"`,
      });

      return {
        data: {
          boxId: box.id,
          bucket: box.sourceBoxBucket,
          objectKey: box.sourceBoxKey,
          suggestedFileName,
          downloadUrl: signed.url,
          method: signed.method,
          headers: signed.headers,
          expiresInSeconds: BOX_DOWNLOAD_URL_TTL_SECONDS,
          sizeBytes: box.fileSizeBytes,
        },
      };
    },
  );

  // ─── PATCH /api/v1/boxes/:boxId ───────────────────────────────────

  fastify.patch(
    '/api/v1/boxes/:boxId',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { boxId } = request.params as { boxId: string };
      const body = UpdateBoxSchema.parse(request.body);
      const box = await BoxService.update(boxId, request.user!.userId, body);
      return { data: BoxService.toDTO(box) };
    },
  );

  // ─── DELETE /api/v1/boxes/:boxId ──────────────────────────────────

  fastify.delete(
    '/api/v1/boxes/:boxId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { boxId } = request.params as { boxId: string };
      await BoxService.delete(boxId, request.user!.userId);
      return reply.status(204).send();
    },
  );

  // ─── GET /api/v1/users/me/boxes ───────────────────────────────────

  fastify.get(
    '/api/v1/users/me/boxes',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const qs = PaginationSchema.parse(request.query);
      const result = await BoxService.listByUser(
        request.user!.userId,
        request.user!.userId,
        qs,
      );
      return { data: result.items.map(BoxService.toSummaryDTO), pagination: result.pagination };
    },
  );

  // ─── GET /api/v1/users/:username/boxes ───────────────────────────

  fastify.get(
    '/api/v1/users/:username/boxes',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { username } = request.params as { username: string };
      const qs = PaginationSchema.parse(request.query);

      const owner = await UserService.findByUsername(username);
      if (!owner || !owner.isActive) {
        throw AppError.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
      }

      const result = await BoxService.listByUser(owner.id, request.user?.userId ?? null, qs, {
        visibility: 'public',
      });
      return {
        data: result.items.map(BoxService.toSummaryDTO),
        pagination: result.pagination,
      };
    },
  );
};

export default boxRoutes;
