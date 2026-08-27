import { eq, and, desc, count, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import { cards, type Card, type NewCard } from '../db/schema/cards';
import { deleteObject, deleteObjectsByPrefix, parseObjectUrl } from '../storage/s3';
import { Bucket } from '../storage/buckets';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import type { PaginationInput, UpdateCardInput } from '../schemas/content.schemas';

export interface PagedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CardOpenViewRecord {
  id: string;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  status: Card['status'];
  visibility: Card['visibility'];
  createdAt: Date;
  updatedAt: Date;
}

/** 打开视图记录 + 渲染产物字段（open-view 读取用） */
export interface CardOpenViewWithArtifacts extends CardOpenViewRecord {
  renderArtifacts: CardRenderArtifacts | null;
}

export interface CardSummaryRecord {
  id: string;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  htmlUrl: string | null;
  status: Card['status'];
  visibility: Card['visibility'];
  createdAt: Date;
}

/** 客户端渲染产物（查看/封面）的单份记录 */
export interface RenderArtifactRecord {
  /** 产物目录版本标识（服务器生成，用于对象存储路径与私有代理路由） */
  cacheVersion: string;
  bucket: string;
  keyPrefix: string;
  entryObjectKey: string;
  /** 公开产物为对象存储 URL，私有产物为受控代理路由 */
  entryUrl: string;
  fileCount: number;
  sizeBytes: number;
}

/** 一张卡片完整的客户端渲染产物清单（写入 cards.render_artifacts） */
export interface CardRenderArtifacts {
  rendererVersion: string;
  themeId?: string;
  locale?: string;
  view: RenderArtifactRecord;
  cover?: RenderArtifactRecord;
}

function getCoverRatioFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const rawRatio = (metadata as { cover_ratio?: unknown }).cover_ratio;
  return typeof rawRatio === 'string' && rawRatio.trim() ? rawRatio.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractPublishedResourceUrls(resourceManifest: unknown): string[] {
  if (!isRecord(resourceManifest)) {
    return [];
  }

  const verifiedResources = resourceManifest.verifiedResources;
  if (!Array.isArray(verifiedResources)) {
    return [];
  }

  return verifiedResources
    .map((resource) => (isRecord(resource) && typeof resource.publicUrl === 'string' ? resource.publicUrl : null))
    .filter((url): url is string => Boolean(url));
}

async function deletePublishedResources(resourceManifest: unknown): Promise<void> {
  const urls = extractPublishedResourceUrls(resourceManifest);
  const uniqueObjects = new Map<string, { bucket: string; key: string }>();

  for (const url of urls) {
    const parsed = parseObjectUrl(url);
    if (!parsed || parsed.bucket !== Bucket.CARD_RESOURCES) {
      continue;
    }
    uniqueObjects.set(`${parsed.bucket}/${parsed.key}`, parsed);
  }

  await Promise.all(
    [...uniqueObjects.values()].map((object) => deleteObject(object.bucket, object.key)),
  );
}

async function paginateCardSummaries(
  where: SQL | undefined,
  pagination: PaginationInput,
): Promise<PagedResult<CardSummaryRecord>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  const [items, totalRows] = await Promise.all([
    db.query.cards.findMany({
      where,
      columns: {
        id: true,
        title: true,
        coverUrl: true,
        coverRatio: true,
        htmlUrl: true,
        status: true,
        visibility: true,
        createdAt: true,
      },
      orderBy: [desc(cards.createdAt)],
      limit: pageSize,
      offset,
    }),
    where
      ? db.select({ count: count() }).from(cards).where(where)
      : db.select({ count: count() }).from(cards),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export const CardService = {
  async create(params: {
    visibility: 'public' | 'private';
    fileSizeBytes: number;
    title?: string;
    cardFileId?: string;
    coverRatio?: string | null;
    sourceCardBucket?: string;
    sourceCardKey?: string;
    sourceCardUrl?: string;
    sourceCardSha256?: string;
    cardMetadata?: unknown;
    cardStructure?: unknown;
    resourceManifest?: unknown;
    publishedByClient?: string | null;
    publishedClientVersion?: string | null;
  }): Promise<Card> {
    const [card] = await db
      .insert(cards)
      .values({
        cardFileId: params.cardFileId ?? null,
        title: params.title ?? '处理中…',
        coverRatio: params.coverRatio ?? null,
        visibility: params.visibility,
        fileSizeBytes: params.fileSizeBytes,
        sourceCardBucket: params.sourceCardBucket ?? null,
        sourceCardKey: params.sourceCardKey ?? null,
        sourceCardUrl: params.sourceCardUrl ?? null,
        sourceCardSha256: params.sourceCardSha256 ?? null,
        sourceCardStoredAt: params.sourceCardBucket ? new Date() : null,
        cardMetadata: params.cardMetadata ?? null,
        cardStructure: params.cardStructure ?? null,
        resourceManifest: params.resourceManifest ?? null,
        publishedByClient: params.publishedByClient ?? null,
        publishedClientVersion: params.publishedClientVersion ?? null,
        publishedAt: params.sourceCardBucket ? new Date() : null,
        status: params.sourceCardBucket ? 'ready' : 'pending',
      } as NewCard)
      .returning();
    return card;
  },

  async findById(cardId: string): Promise<Card | undefined> {
    return db.query.cards.findFirst({ where: eq(cards.id, cardId) });
  },

  async getAccessible(cardId: string): Promise<Card> {
    const card = await this.findById(cardId);
    if (!card) {
      throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
    }
    if (card.visibility === 'private') {
      throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
    }
    return card;
  },

  async getOpenViewAccessible(cardId: string): Promise<CardOpenViewRecord> {
    const card = await db.query.cards.findFirst({
      where: eq(cards.id, cardId),
      columns: {
        id: true,
        title: true,
        coverUrl: true,
        coverRatio: true,
        status: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!card) {
      throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
    }
    if (card.visibility === 'private') {
      throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
    }

    return {
      id: card.id,
      title: card.title,
      coverUrl: card.coverUrl,
      coverRatio: card.coverRatio,
      status: card.status,
      visibility: card.visibility,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  },

  /**
   * open-view 读取专用：附带渲染产物信息。
   * 返回 null 表示不可公开访问。
   */
  async getOpenViewWithArtifacts(cardId: string): Promise<CardOpenViewWithArtifacts> {
    const card = await db.query.cards.findFirst({
      where: eq(cards.id, cardId),
      columns: {
        id: true,
        title: true,
        coverUrl: true,
        coverRatio: true,
        status: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        renderArtifacts: true,
      },
    });
    if (!card) {
      throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
    }
    if (card.visibility === 'private') {
      throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
    }

    return {
      id: card.id,
      title: card.title,
      coverUrl: card.coverUrl,
      coverRatio: card.coverRatio,
      status: card.status,
      visibility: card.visibility,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      renderArtifacts: card.renderArtifacts as CardRenderArtifacts | null,
    };
  },

  async update(cardId: string, patch: UpdateCardInput): Promise<Card> {
    const card = await this.findById(cardId);
    if (!card) {
      throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
    }

    const [updated] = await db
      .update(cards)
      .set({
        ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
        ...(patch.visibility !== undefined && patch.visibility !== card.visibility
          ? { htmlUrl: null, coverUrl: null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(cards.id, cardId))
      .returning();

    if (patch.visibility !== undefined && patch.visibility !== card.visibility) {
      await this.deleteRenderArtifacts(cardId);
    }

    return updated;
  },

  async delete(cardId: string): Promise<void> {
    const card = await this.findById(cardId);
    if (!card) {
      throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
    }
    // 删除对象存储资源
    await deletePublishedResources(card.resourceManifest);
    await this.deleteRenderArtifacts(cardId);
    // 删除数据库记录
    await db.delete(cards).where(eq(cards.id, cardId));
  },

  /**
   * 记录客户端渲染上传的产物（查看/封面），并更新卡片的查看与封面入口。
   * 仅当产物对象都已上传（presign 时写入 upload_session_resources）后调用。
   */
  async recordRenderArtifacts(cardId: string, artifacts: CardRenderArtifacts): Promise<Card> {
    const now = new Date();
    const [updated] = await db
      .update(cards)
      .set({
        htmlUrl: artifacts.view.entryUrl,
        coverUrl: artifacts.cover ? artifacts.cover.entryUrl : null,
        renderArtifacts: artifacts,
        renderedAt: now,
        status: 'ready',
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(cards.id, cardId))
      .returning();

    if (!updated) {
      throw AppError.notFound(ErrorCode.CARD_NOT_FOUND, 'Card not found');
    }
    return updated;
  },

  async list(
    pagination: PaginationInput,
    filters?: { visibility?: string; status?: string },
  ): Promise<PagedResult<CardSummaryRecord>> {
    return paginateCardSummaries(
      and(
        filters?.visibility ? eq(cards.visibility, filters.visibility as Card['visibility']) : eq(cards.visibility, 'public'),
        filters?.status ? eq(cards.status, filters.status as Card['status']) : undefined,
      ),
      pagination,
    );
  },

  toDTO(card: Card) {
    return {
      id: card.id,
      cardFileId: card.cardFileId,
      title: card.title,
      coverUrl: card.coverUrl,
      coverRatio: card.coverRatio ?? getCoverRatioFromMetadata(card.cardMetadata),
      htmlUrl: card.htmlUrl,
      sourceCardSha256: card.sourceCardSha256,
      viewUrl: `/api/v1/cards/${card.id}/view`,
      status: card.status,
      visibility: card.visibility,
      fileSizeBytes: card.fileSizeBytes,
      cardMetadata: card.cardMetadata,
      cardStructure: card.cardStructure,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  },

  toSummaryDTO(card: CardSummaryRecord) {
    return {
      id: card.id,
      title: card.title,
      coverUrl: card.coverUrl,
      coverRatio: card.coverRatio,
      htmlUrl: card.htmlUrl,
      status: card.status,
      visibility: card.visibility,
      createdAt: card.createdAt,
    };
  },

  toOpenViewDTO(card: CardOpenViewRecord) {
    return {
      id: card.id,
      title: card.title,
      coverUrl: card.coverUrl,
      coverRatio: card.coverRatio,
      viewUrl: `/api/v1/cards/${card.id}/view`,
      status: card.status,
      visibility: card.visibility,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  },

  /** 删除卡片渲染产物（对象存储 + 数据库字段） */
  async deleteRenderArtifacts(cardId: string): Promise<void> {
    const card = await this.findById(cardId);
    if (!card) {
      return;
    }

    const artifact = card.renderArtifacts as CardRenderArtifacts | null;
    if (artifact?.view) {
      await deleteObjectsByPrefix(artifact.view.bucket, `${artifact.view.keyPrefix}/`);
    }
    if (artifact?.cover) {
      await deleteObjectsByPrefix(artifact.cover.bucket, `${artifact.cover.keyPrefix}/`);
    }

    await db
      .update(cards)
      .set({
        htmlUrl: null,
        coverUrl: null,
        renderArtifacts: null,
        renderedAt: null,
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(cards.id, cardId));
  },
};
