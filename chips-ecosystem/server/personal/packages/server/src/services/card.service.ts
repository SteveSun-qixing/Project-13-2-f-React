import type { Card } from '../db/schema/index.js';
import { AppError } from '../errors/AppError.js';
import { escapeHtml } from '../lib/html.js';
import type { PagedItems, PaginationParams } from '../lib/pagination.js';
import { toRfc3339 } from '../lib/pagination.js';
import type { CardRepository } from '../repositories/types.js';
import { readRenderArtifacts, type CardRenderArtifacts } from '../types/render-artifacts.js';

/**
 * 卡片域服务（单用户内容模型，《15》§三）：私密即不存在（§3.3）、
 * 未就绪是状态冲突而非资源不存在（§3.2）、DTO 与契约 §4.2 逐字段对齐。
 * 纯逻辑迁移：数据面全部经 CardRepository 端口（PG 端口化，测试用内存 fake）。
 */

export type CardStatus = Card['status'];
export type CardVisibility = Card['visibility'];

/** 列表项摘要（契约 §4.2.1） */
export interface CardSummaryDto {
  id: string;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  htmlUrl: string | null;
  status: CardStatus;
  visibility: CardVisibility;
  createdAt: string;
}

/** 详情（契约 §4.2.2） */
export interface CardDetailDto {
  id: string;
  cardFileId: string | null;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  htmlUrl: string | null;
  sourceCardSha256: string | null;
  viewUrl: string;
  status: CardStatus;
  visibility: CardVisibility;
  fileSizeBytes: number | null;
  cardMetadata: unknown;
  cardStructure: unknown;
  createdAt: string;
  updatedAt: string;
}

/** 打开视图（契约 §4.2.3） */
export interface CardOpenViewDto {
  id: string;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  viewUrl: string;
  status: CardStatus;
  /** 有查看产物为 ready，否则为卡片 status */
  viewState: 'ready' | CardStatus;
  visibility: CardVisibility;
  createdAt: string;
  updatedAt: string;
}

/** 状态（契约 §4.2.4） */
export interface CardStatusDto {
  cardId: string;
  status: CardStatus;
  errorMessage: string | null;
  htmlUrl: string | null;
  viewUrl: string;
  hasRenderArtifacts: boolean;
  updatedAt: string;
}

/** 封面入口解析结果：有封面产物 302 重定向，无封面返回占位页 */
export type CoverResolution =
  { kind: 'redirect'; location: string } | { kind: 'placeholder'; html: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 封面比例回退：显式字段为空时取 metadata.cover_ratio（空白值忽略）。 */
function coverRatioOf(card: Card): string | null {
  if (typeof card.coverRatio === 'string' && card.coverRatio.trim().length > 0) {
    return card.coverRatio;
  }
  if (!isRecord(card.cardMetadata)) {
    return null;
  }
  const raw = card.cardMetadata['cover_ratio'];
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

function viewUrlOf(cardId: string): string {
  return `/api/v1/cards/${cardId}/view`;
}

/** 无封面产物时的默认占位页（服务器生成的极简页面）。 */
export function createDefaultCoverHtml(title: string): string {
  const safeTitle = escapeHtml(title);
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

export class CardService {
  constructor(private readonly deps: { cardRepository: CardRepository }) {}

  /**
   * 公开面取卡：不存在与私密不可区分，一律 CARD_NOT_FOUND（404），
   * 不泄露存在性（§3.1.4、契约 §3.5）。
   */
  async getAccessible(cardId: string): Promise<Card> {
    const card = await this.deps.cardRepository.findById(cardId);
    if (!card || card.visibility === 'private') {
      throw AppError.notFound('CARD_NOT_FOUND', '卡片不存在或不可见');
    }
    return card;
  }

  /** 公开卡片分页列表（契约 §4.2.1）。 */
  listPublic(pagination: PaginationParams): Promise<PagedItems<Card>> {
    return this.deps.cardRepository.listPublic(pagination);
  }

  /** 全量卡片分页列表（管理读：含私密与未渲染，需令牌）。 */
  listAll(pagination: PaginationParams): Promise<PagedItems<Card>> {
    return this.deps.cardRepository.listAll(pagination);
  }

  toSummary(card: Card): CardSummaryDto {
    return {
      id: card.id,
      title: card.title,
      coverUrl: card.coverUrl,
      coverRatio: coverRatioOf(card),
      htmlUrl: card.htmlUrl,
      status: card.status,
      visibility: card.visibility,
      createdAt: toRfc3339(card.createdAt),
    };
  }

  toDetail(card: Card): CardDetailDto {
    return {
      id: card.id,
      cardFileId: card.cardFileId,
      title: card.title,
      coverUrl: card.coverUrl,
      coverRatio: coverRatioOf(card),
      htmlUrl: card.htmlUrl,
      sourceCardSha256: card.sourceCardSha256,
      viewUrl: viewUrlOf(card.id),
      status: card.status,
      visibility: card.visibility,
      fileSizeBytes: card.fileSizeBytes,
      cardMetadata: card.cardMetadata,
      cardStructure: card.cardStructure,
      createdAt: toRfc3339(card.createdAt),
      updatedAt: toRfc3339(card.updatedAt),
    };
  }

  toOpenView(card: Card): CardOpenViewDto {
    const artifacts = card.status === 'ready' ? readRenderArtifacts(card.renderArtifacts) : null;
    const hasView = artifacts?.view !== undefined;
    const hasCover = artifacts?.cover !== undefined;
    return {
      id: card.id,
      title: card.title,
      coverUrl: hasCover ? `/api/v1/cards/${card.id}/cover` : null,
      coverRatio: coverRatioOf(card),
      viewUrl: viewUrlOf(card.id),
      status: card.status,
      viewState: hasView ? 'ready' : card.status,
      visibility: card.visibility,
      createdAt: toRfc3339(card.createdAt),
      updatedAt: toRfc3339(card.updatedAt),
    };
  }

  toStatus(card: Card): CardStatusDto {
    const artifacts = readRenderArtifacts(card.renderArtifacts);
    return {
      cardId: card.id,
      status: card.status,
      errorMessage: card.errorMessage,
      htmlUrl: card.htmlUrl,
      viewUrl: viewUrlOf(card.id),
      hasRenderArtifacts: artifacts !== null,
      updatedAt: toRfc3339(card.updatedAt),
    };
  }

  /**
   * 查看入口解析：有查看产物 → 302 到 entryUrl；
   * 无产物 → 409 CARD_RENDER_NOT_READY（状态冲突，客户端提示「尚未渲染」）。
   */
  resolveViewLocation(card: Card): string {
    const entryUrl = readRenderArtifacts(card.renderArtifacts)?.view.entryUrl;
    if (entryUrl === undefined) {
      throw AppError.conflict('CARD_RENDER_NOT_READY', '查看产物尚未上传，卡片尚未渲染');
    }
    return entryUrl;
  }

  /** 封面入口解析：有封面产物 → 302；无 → 200 占位页（契约 §4.2.5）。 */
  resolveCover(card: Card): CoverResolution {
    const entryUrl = readRenderArtifacts(card.renderArtifacts)?.cover?.entryUrl;
    if (entryUrl === undefined) {
      return { kind: 'placeholder', html: createDefaultCoverHtml(card.title) };
    }
    return { kind: 'redirect', location: entryUrl };
  }
}

/** 渲染产物清单读取（供测试夹具与后续臂复用同一守卫口径）。 */
export function parseRenderArtifacts(value: unknown): CardRenderArtifacts | null {
  return readRenderArtifacts(value);
}
