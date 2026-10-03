import { AppError } from '../errors/AppError.js';
import { toRfc3339 } from '../lib/pagination.js';
import type { AppConfig } from '../config/env.js';
import type { Card, CardRenderCache, User } from '../db/schema/index.js';
import type {
  CommunityViewState,
  ICommunityCardDetail,
  ICommunityCardOpenView,
  ICommunityCardRenderStatus,
  ICommunityCardStatus,
  ICommunityCardSummary,
} from '../dto/community.js';
import type { UserService } from './user.service.js';

/**
 * 卡片内容只读域服务：DTO 装配与查看状态派生（契约 §4.5、§6.4）。
 * 可见性：私有内容只有所有者本人（或管理员）可读，无权访问一律 404 不暴露存在性；
 * `viewUrl` / `coverUrl` 为稳定入口路径，重定向行为见卡片段服务（view/cover 入口）。
 */

export interface CardServiceDeps {
  userService: UserService;
  config: AppConfig;
}

export type ViewResolution =
  | { kind: 'redirect'; location: string }
  | { kind: 'processing'; retryAfterSeconds: number }
  | { kind: 'renderError' };

/** 封面入口决议（契约 §6.4：失败回退默认封面，不产生 renderError 分支）。 */
export type CoverResolution = Exclude<ViewResolution, { kind: 'renderError' }>;

export class CardService {
  private readonly userService: UserService;
  private readonly config: AppConfig;

  constructor(deps: CardServiceDeps) {
    this.userService = deps.userService;
    this.config = deps.config;
  }

  /** 无权访问的私有资源按 404 处理（契约 §4.1）。 */
  assertReadable(card: Card, requester: { userId: string; role: string } | null): void {
    if (card.visibility === 'private') {
      const privileged =
        requester !== null && (requester.userId === card.userId || requester.role === 'admin');
      if (!privileged) {
        throw AppError.notFound('COMMUNITY_CARD_NOT_FOUND', '卡片不存在或不可见');
      }
    }
  }

  /** 查看状态派生：有查看缓存记录以记录为准；无记录时 error 卡片为 error，其余为 pending。 */
  deriveViewState(card: Card, webCache: CardRenderCache | null): CommunityViewState {
    if (webCache !== null) {
      return webCache.state;
    }
    return card.status === 'error' ? 'error' : 'pending';
  }

  toSummary(card: Card): ICommunityCardSummary {
    return {
      id: card.id,
      cardFileId: card.cardFileId,
      userId: card.userId,
      name: card.name,
      coverUrl: card.status === 'ready' ? this.coverEntryPath(card.id) : null,
      coverRatio: card.coverRatio.length > 0 ? card.coverRatio : '3:4',
      status: card.status,
      visibility: card.visibility,
      createdAt: toRfc3339(card.createdAt),
      updatedAt: toRfc3339(card.updatedAt),
    };
  }

  toDetail(card: Card, author: User, webCache: CardRenderCache | null): ICommunityCardDetail {
    const viewState = this.deriveViewState(card, webCache);
    return {
      ...this.toSummary(card),
      roomId: card.roomId ?? null,
      chipStandardsVersion: card.chipStandardsVersion,
      tags: (card.tags as Array<string | string[]> | null) ?? [],
      fileSizeBytes: card.fileSizeBytes,
      sha256: card.sha256,
      viewUrl: viewState === 'ready' ? this.viewEntryPath(card.id) : null,
      renderStatusUrl: this.renderStatusPath(card.id),
      user: this.userService.toPublicProfile(author),
    };
  }

  toOpenView(card: Card, author: User, webCache: CardRenderCache | null): ICommunityCardOpenView {
    const viewState = this.deriveViewState(card, webCache);
    return {
      id: card.id,
      cardFileId: card.cardFileId,
      name: card.name,
      coverUrl: card.status === 'ready' ? this.coverEntryPath(card.id) : null,
      coverRatio: card.coverRatio.length > 0 ? card.coverRatio : '3:4',
      viewUrl: viewState === 'ready' ? this.viewEntryPath(card.id) : null,
      renderStatusUrl: this.renderStatusPath(card.id),
      viewState,
      status: card.status,
      visibility: card.visibility,
      chipStandardsVersion: card.chipStandardsVersion,
      user: this.userService.toPublicProfile(author),
      createdAt: toRfc3339(card.createdAt),
      updatedAt: toRfc3339(card.updatedAt),
    };
  }

  toStatus(card: Card, webCache: CardRenderCache | null, cacheCount: number): ICommunityCardStatus {
    return {
      cardId: card.id,
      status: card.status,
      viewState: this.deriveViewState(card, webCache),
      hasRenderArtifacts: cacheCount > 0,
      updatedAt: toRfc3339(card.updatedAt),
    };
  }

  toRenderStatus(card: Card, webCache: CardRenderCache | null): ICommunityCardRenderStatus {
    const viewState = this.deriveViewState(card, webCache);
    return {
      cardId: card.id,
      viewState,
      attemptCount: webCache?.attemptCount ?? 0,
      updatedAt: toRfc3339(webCache?.updatedAt ?? card.updatedAt),
      viewUrl: viewState === 'ready' ? this.viewEntryPath(card.id) : null,
      error:
        webCache !== null && webCache.state === 'error'
          ? {
              code: webCache.errorCode ?? 'COMMUNITY_CARD_RENDER_ERROR',
              message: webCache.errorMessage ?? '查看缓存生成失败',
            }
          : null,
    };
  }

  /**
   * 查看入口行为（契约 §6.4）：ready 时 302（公开内容到公开缓存地址，私有内容到受控
   * 代理路径）；处理中 202 + Retry-After；失败 409。
   */
  resolveView(card: Card, webCache: CardRenderCache | null): ViewResolution {
    const viewState = this.deriveViewState(card, webCache);
    if (viewState === 'ready' && webCache !== null) {
      const location = this.cacheEntryTarget(
        card,
        webCache,
        webCache.viewEntryUrl,
        webCache.viewProxyPath
      );
      if (location !== null) {
        return { kind: 'redirect', location };
      }
      return { kind: 'renderError' };
    }
    if (viewState === 'error') {
      return { kind: 'renderError' };
    }
    return { kind: 'processing', retryAfterSeconds: this.config.renderRetryAfterSeconds };
  }

  /**
   * 封面入口行为（契约 §6.4）：ready 时 302；处理中 202 临时占位；失败回退默认封面。
   */
  resolveCover(card: Card, coverCache: CardRenderCache | null): CoverResolution {
    const viewState = this.deriveViewState(card, coverCache);
    if (viewState === 'ready' && coverCache !== null) {
      const location = this.cacheEntryTarget(
        card,
        coverCache,
        coverCache.coverEntryUrl,
        coverCache.coverProxyPath
      );
      if (location !== null) {
        return { kind: 'redirect', location };
      }
      return { kind: 'redirect', location: this.config.defaultCoverUrl };
    }
    if (viewState === 'error') {
      return { kind: 'redirect', location: this.config.defaultCoverUrl };
    }
    return { kind: 'processing', retryAfterSeconds: this.config.renderRetryAfterSeconds };
  }

  private cacheEntryTarget(
    card: Card,
    cache: CardRenderCache,
    publicUrl: string | null,
    proxyPath: string | null
  ): string | null {
    if (card.visibility === 'public') {
      return publicUrl !== null && publicUrl.length > 0 ? publicUrl : null;
    }
    const proxy =
      proxyPath !== null && proxyPath.length > 0
        ? proxyPath
        : `/api/v1/cards/${card.id}/render-cache/${cache.cacheVersion}/index.html`;
    return proxy;
  }

  coverEntryPath(cardId: string): string {
    return `/api/v1/cards/${cardId}/cover`;
  }

  viewEntryPath(cardId: string): string {
    return `/api/v1/cards/${cardId}/view`;
  }

  renderStatusPath(cardId: string): string {
    return `/api/v1/cards/${cardId}/render-status`;
  }
}
