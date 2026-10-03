import type { Box } from '../db/schema/index.js';
import { AppError } from '../errors/AppError.js';
import { escapeHtml } from '../lib/html.js';
import type { PagedItems, PaginationParams } from '../lib/pagination.js';
import { toRfc3339 } from '../lib/pagination.js';
import type { BoxRepository, CardRepository } from '../repositories/types.js';
import { readBoxStructure, type BoxStructure, type EnrichedBoxEntryRef } from '../types/box.js';

/**
 * 箱子域服务（单用户内容模型，《15》§三）：私密即不存在（§3.3）、
 * 只读文档使用客户端提交的 structure 条目模型（PS-4 不解包 .box）、
 * DTO 与契约 §4.3 逐字段对齐。
 * 纯逻辑迁移：数据面全部经仓库端口（PG 端口化，测试用内存 fake）。
 */

export type BoxVisibility = Box['visibility'];

/** 列表项摘要（契约 §4.3.1） */
export interface BoxSummaryDto {
  id: string;
  title: string;
  coverUrl: string | null;
  documentUrl: string | null;
  coverRatio: string | null;
  layoutPlugin: string | null;
  visibility: BoxVisibility;
  createdAt: string;
}

/** 详情（契约 §4.3.2：列表字段基础上追加） */
export interface BoxDetailDto extends BoxSummaryDto {
  boxFileId: string | null;
  fileSizeBytes: number | null;
  metadata: unknown;
  updatedAt: string;
  /** 条目引用匹配结果 */
  cards: EnrichedBoxEntryRef[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 封面比例回退：显式字段为空时取 metadata.cover_ratio（空白值忽略）。 */
function coverRatioOf(box: Box): string | null {
  if (typeof box.coverRatio === 'string' && box.coverRatio.trim().length > 0) {
    return box.coverRatio;
  }
  if (!isRecord(box.metadata)) {
    return null;
  }
  const raw = box.metadata['cover_ratio'];
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

/** 判断 url 是否为外部绝对 URL（scheme:// 形式）；否则视为包内相对引用。 */
const SCHEME_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

function boxTitleOf(box: Box): string {
  const metadata = box.metadata;
  const metadataName =
    isRecord(metadata) && typeof metadata['name'] === 'string' ? metadata['name'] : '';
  return box.title || metadataName || '未命名箱子';
}

export class BoxService {
  constructor(
    private readonly deps: { boxRepository: BoxRepository; cardRepository: CardRepository }
  ) {}

  /**
   * 公开面取箱：不存在与私密不可区分，一律 BOX_NOT_FOUND（404），
   * 不泄露存在性（§3.1.4、契约 §3.5）。
   */
  async getAccessible(boxId: string): Promise<Box> {
    const box = await this.deps.boxRepository.findById(boxId);
    if (!box || box.visibility === 'private') {
      throw AppError.notFound('BOX_NOT_FOUND', '箱子不存在或不可见');
    }
    return box;
  }

  /** 公开箱子分页列表（契约 §4.3.1）。 */
  listPublic(pagination: PaginationParams): Promise<PagedItems<Box>> {
    return this.deps.boxRepository.listPublic(pagination);
  }

  toSummary(box: Box): BoxSummaryDto {
    return {
      id: box.id,
      title: box.title,
      coverUrl: box.coverUrl,
      documentUrl: box.documentUrl,
      coverRatio: coverRatioOf(box),
      layoutPlugin: box.layoutPlugin,
      visibility: box.visibility,
      createdAt: toRfc3339(box.createdAt),
    };
  }

  async toDetail(box: Box): Promise<BoxDetailDto> {
    const entries = await this.enrichCardRefs(readBoxStructure(box.structure));
    return {
      id: box.id,
      boxFileId: box.boxFileId,
      title: box.title,
      coverUrl: box.coverUrl,
      documentUrl: box.documentUrl,
      coverRatio: coverRatioOf(box),
      layoutPlugin: box.layoutPlugin,
      visibility: box.visibility,
      fileSizeBytes: box.fileSizeBytes,
      metadata: box.metadata,
      createdAt: toRfc3339(box.createdAt),
      updatedAt: toRfc3339(box.updatedAt),
      cards: entries,
    };
  }

  /**
   * 将 structure.entries 中的引用与服务器内公开就绪卡片匹配
   * （按 .card 内置 10 位 Base62 ID = cardFileId 关联，契约 §4.3.2）。
   */
  async enrichCardRefs(structure: BoxStructure): Promise<EnrichedBoxEntryRef[]> {
    const entries = structure.entries;
    const documentIds = [
      ...new Set(
        entries
          .map((entry) => entry.snapshot?.document_id)
          .filter((id): id is string => id !== undefined && id.length > 0)
      ),
    ];
    const serverCards = await this.deps.cardRepository.findPublicReadyByCardFileIds(documentIds);
    const cardsByFileId = new Map(
      serverCards
        .filter((card) => card.cardFileId !== null)
        .map((card) => [card.cardFileId as string, card])
    );

    return entries.map((entry) => {
      const documentId = entry.snapshot?.document_id;
      const serverCard = documentId !== undefined ? cardsByFileId.get(documentId) : undefined;
      const title = entry.snapshot?.title;
      const contentType = entry.snapshot?.content_type;
      return {
        entry_id: entry.entry_id,
        url: entry.url,
        embedded: !SCHEME_URL_PATTERN.test(entry.url),
        ...(documentId !== undefined ? { document_id: documentId } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(contentType !== undefined ? { content_type: contentType } : {}),
        ...(serverCard !== undefined
          ? {
              communityCardId: serverCard.id,
              communityViewUrl: `/api/v1/cards/${serverCard.id}/view`,
            }
          : {}),
      };
    });
  }

  /** 箱子只读文档 HTML（服务器生成的极简条目链接列表；契约 §4.3.3）。 */
  async renderDocumentHtml(box: Box): Promise<string> {
    const structure = readBoxStructure(box.structure);
    const entries = await this.enrichCardRefs(structure);
    return renderBoxDocumentHtml(box, entries);
  }
}

function renderBoxDocumentHtml(box: Box, entries: EnrichedBoxEntryRef[]): string {
  const metadata = isRecord(box.metadata) ? box.metadata : undefined;
  const name = escapeHtml(boxTitleOf(box));
  const description =
    metadata !== undefined && typeof metadata['description'] === 'string'
      ? escapeHtml(metadata['description'])
      : '';

  const entryItems = entries
    .map((entry) => {
      const label = escapeHtml(entry.title ?? entry.document_id ?? entry.entry_id ?? '未命名条目');
      if (entry.communityCardId !== undefined) {
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
${description !== '' ? `<p>${description}</p>` : ''}
<h2>条目</h2>
${entryItems !== '' ? `<ul>\n${entryItems}\n</ul>` : '<p>暂无条目</p>'}
</body>
</html>`;
}
