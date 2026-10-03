import { AppError } from '../errors/AppError.js';
import { toRfc3339 } from '../lib/pagination.js';
import type { Box, BoxEntry, Card, User } from '../db/schema/index.js';
import type {
  ICommunityBoxDetail,
  ICommunityBoxEntryRef,
  ICommunityBoxSummary,
} from '../dto/community.js';
import type { UserService } from './user.service.js';

/**
 * 箱子内容只读域服务（契约 §4.6）。
 * 条目匹配仅针对社区中公开且就绪的卡片，匹配依据是条目 snapshot.document_id 与卡片
 * cardFileId；`contentType = 'chips/box'` 时浏览态显示被引用箱子的封面，不展开其布局。
 */

export interface BoxServiceDeps {
  userService: UserService;
}

export class BoxService {
  private readonly userService: UserService;

  constructor(deps: BoxServiceDeps) {
    this.userService = deps.userService;
  }

  assertReadable(box: Box, requester: { userId: string; role: string } | null): void {
    if (box.visibility === 'private') {
      const privileged =
        requester !== null && (requester.userId === box.userId || requester.role === 'admin');
      if (!privileged) {
        throw AppError.notFound('COMMUNITY_BOX_NOT_FOUND', '箱子不存在或不可见');
      }
    }
  }

  toSummary(box: Box): ICommunityBoxSummary {
    return {
      id: box.id,
      boxFileId: box.boxFileId,
      userId: box.userId,
      name: box.name,
      coverUrl: box.coverUrl ?? null,
      coverRatio: box.coverRatio.length > 0 ? box.coverRatio : '3:4',
      activeLayoutType: box.activeLayoutType,
      status: box.status,
      visibility: box.visibility,
      createdAt: toRfc3339(box.createdAt),
      updatedAt: toRfc3339(box.updatedAt),
    };
  }

  toDetail(box: Box, author: User, communityCardsByFileId: Map<string, Card>): ICommunityBoxDetail {
    return {
      ...this.toSummary(box),
      roomId: box.roomId ?? null,
      chipStandardsVersion: box.chipStandardsVersion,
      tags: (box.tags as Array<string | string[]> | null) ?? [],
      fileSizeBytes: box.fileSizeBytes,
      sha256: box.sha256,
      documentUrl: `/api/v1/boxes/${box.id}/view`,
      entries: this.toEntryRefs(box, communityCardsByFileId),
      user: this.userService.toPublicProfile(author),
    };
  }

  /** 按 structure.yaml 声明顺序装配条目引用（命中社区公开就绪卡片时给出社区链接）。 */
  toEntryRefs(box: Box, communityCardsByFileId: Map<string, Card>): ICommunityBoxEntryRef[] {
    const entries = (box.entries as BoxEntry[] | null) ?? [];
    return entries.map((entry) => {
      const documentId = entry.snapshot?.document_id;
      const communityCard =
        typeof documentId === 'string' ? (communityCardsByFileId.get(documentId) ?? null) : null;
      const embedded = !isAbsoluteHttpUrl(entry.url);
      return {
        entryId: entry.entry_id,
        url: entry.url,
        title: entry.snapshot?.title ?? null,
        contentType: normalizeContentType(entry.snapshot?.content_type),
        embedded,
        communityCardId: communityCard?.id ?? null,
        communityViewUrl: communityCard !== null ? `/api/v1/cards/${communityCard.id}/view` : null,
        communityRenderStatusUrl:
          communityCard !== null ? `/api/v1/cards/${communityCard.id}/render-status` : null,
      };
    });
  }

  /**
   * 只读箱子文档（契约 §4.6）：text/html；名称、描述、条目列表；社区卡片条目输出
   * `/cards/:communityCardId` 链接；内嵌条目展示包内路径，外部条目展示 url；
   * 全部用户内容经 HTML 转义。
   */
  buildDocumentHtml(box: Box, detail: ICommunityBoxDetail): string {
    const escape = escapeHtml;
    const descriptionHtml =
      box.description !== null && box.description.length > 0
        ? `\n    <p>${escape(box.description)}</p>`
        : '';
    const entryLines = detail.entries
      .map((entry) => {
        const title = escape(entry.title ?? entry.entryId);
        if (entry.communityCardId !== null) {
          return `      <li><a href="/cards/${escape(entry.communityCardId)}">${title}</a></li>`;
        }
        return `      <li>${escape(entry.url)}</li>`;
      })
      .join('\n');
    return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escape(detail.name)}</title>
  </head>
  <body>
    <h1>${escape(detail.name)}</h1>${descriptionHtml}
    <ul>
${entryLines}
    </ul>
  </body>
</html>
`;
  }
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizeContentType(value: unknown): 'chips/card' | 'chips/box' | null {
  if (value === 'chips/card' || value === 'chips/box') {
    return value;
  }
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
