import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors/AppError.js';
import type { Repositories } from '../repositories/types.js';
import type { BoxService } from '../services/box.service.js';
import type { UserService } from '../services/user.service.js';

/**
 * 箱子只读路由（契约 §4.2、§4.6）：详情（含条目装配）与只读箱子文档。
 * 条目匹配仅针对社区公开就绪卡片（snapshot.document_id ↔ cardFileId）；
 * 写操作与封面资源归内容写域臂、对象存储臂。
 */

export interface BoxesRouteDeps {
  repositories: Repositories;
  boxService: BoxService;
  userService: UserService;
}

export async function boxRoutes(fastify: FastifyInstance, deps: BoxesRouteDeps): Promise<void> {
  const { repositories, boxService, userService } = deps;

  fastify.get(
    '/api/v1/boxes/:boxId',
    { preHandler: [fastify.optionalAuthenticate], config: { etag: true } },
    async (request) => {
      const { boxId } = request.params as { boxId: string };
      const box = await requireBox(boxId);
      boxService.assertReadable(box, request.user ?? null);
      const detail = await assembleDetail(box);
      return { data: detail };
    }
  );

  fastify.get(
    '/api/v1/boxes/:boxId/view',
    { preHandler: [fastify.optionalAuthenticate], config: { noStore: true } },
    async (request, reply) => {
      const { boxId } = request.params as { boxId: string };
      const box = await requireBox(boxId);
      boxService.assertReadable(box, request.user ?? null);
      const detail = await assembleDetail(box);
      // 访问权限与 GET /boxes/:boxId 一致；返回 text/html; charset=utf-8（契约 §4.6）。
      return reply
        .status(200)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(boxService.buildDocumentHtml(box, detail));
    }
  );

  async function requireBox(boxId: string) {
    const box = await repositories.boxes.findById(boxId);
    if (box === null) {
      throw AppError.notFound('COMMUNITY_BOX_NOT_FOUND', '箱子不存在或不可见');
    }
    return box;
  }

  async function assembleDetail(box: Awaited<ReturnType<typeof requireBox>>) {
    const author = await userService.getById(box.userId);
    // 条目匹配：按快照 document_id（即卡片 cardFileId）批量取公开就绪卡片。
    const documentIds = [
      ...new Set(
        ((box.entries as Array<{ snapshot?: { document_id?: string } }> | null) ?? [])
          .map((entry) => entry.snapshot?.document_id)
          .filter((value): value is string => typeof value === 'string')
      ),
    ];
    const matched = await repositories.cards.findPublicReadyByCardFileIds(documentIds);
    const communityCardsByFileId = new Map(matched.map((card) => [card.cardFileId, card]));
    return boxService.toDetail(box, author, communityCardsByFileId);
  }
}
