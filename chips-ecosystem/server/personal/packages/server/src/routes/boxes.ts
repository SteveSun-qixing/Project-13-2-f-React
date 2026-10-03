import type { FastifyInstance } from 'fastify';
import { parsePagination, buildPagination } from '../lib/pagination.js';
import type { BoxService } from '../services/box.service.js';

/**
 * 箱子内容只读路由（契约 §4.3）：公开读（列表/详情含条目引用匹配/只读文档）。
 * 封面 302（需公开对象 URL 拼装）与源文件预签名下载归对象存储臂；
 * 写域路由（PATCH/DELETE）归内容写域臂（见包 README 臂序登记）。
 */

export interface BoxesRouteDeps {
  boxService: BoxService;
}

export function boxRoutes(fastify: FastifyInstance, deps: BoxesRouteDeps): void {
  const { boxService } = deps;

  // ─── GET /api/v1/boxes（公开：仅 public，createdAt 倒序）────────────

  fastify.get('/api/v1/boxes', async (request) => {
    const pagination = parsePagination(request.query);
    const { items, total } = await boxService.listPublic(pagination);
    return {
      data: items.map((box) => boxService.toSummary(box)),
      pagination: buildPagination(pagination, total),
    };
  });

  // ─── GET /api/v1/boxes/:boxId（公开详情，含条目引用匹配）────────────

  fastify.get('/api/v1/boxes/:boxId', async (request) => {
    const { boxId } = request.params as { boxId: string };
    const box = await boxService.getAccessible(boxId);
    return { data: await boxService.toDetail(box) };
  });

  // ─── GET /api/v1/boxes/:boxId/view（只读文档 HTML）──────────────────

  fastify.get('/api/v1/boxes/:boxId/view', async (request, reply) => {
    const { boxId } = request.params as { boxId: string };
    const box = await boxService.getAccessible(boxId);
    return reply.type('text/html; charset=utf-8').send(await boxService.renderDocumentHtml(box));
  });
}
