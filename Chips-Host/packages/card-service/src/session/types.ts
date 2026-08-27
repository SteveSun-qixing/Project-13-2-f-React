/**
 * 卡片编辑会话类型定义
 *
 * 会话语义来源：Chips-EditingEngine `src/core/card-service.ts`（task034 M2 上移）。
 * 对外契约以 `生态共用技术文档/协议与接口标准/06-Chips-Host对外接口基线.md` 为准。
 */

export interface CardSessionBasicCard {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  modifiedAt: string;
}

export interface CardSessionMetadata {
  name: string;
  description?: string;
  themeId?: string;
  coverRatio?: string;
  createdAt: string;
  modifiedAt: string;
  tags?: string[];
}

export interface CardSessionCover {
  html: string;
  ratio: string;
  resources: Array<{ path: string; data: Uint8Array }>;
}

export interface CardSessionLayout {
  padding?: number;
  gap?: number;
}

export interface CardSessionSnapshot {
  cardId: string;
  path: string;
  metadata: CardSessionMetadata;
  cover: CardSessionCover;
  structure: {
    layout: CardSessionLayout;
    basicCards: CardSessionBasicCard[];
  };
  isDirty: boolean;
  isPersisting: boolean;
  persistedRevision: number;
  pendingPersistRevision?: number;
  lastPersistedAt?: string;
}

export interface CardSessionResourceImport {
  path: string;
  data: Uint8Array;
  mimeType?: string;
  token: string;
}

export interface CardSessionResourceOperations {
  imports?: Array<{ path: string; data: Uint8Array; mimeType?: string }>;
  deletions?: string[];
}

export interface CardSessionState {
  snapshot: CardSessionSnapshot;
  pendingResourceImports: Map<string, CardSessionResourceImport>;
  pendingResourceDeletions: Set<string>;
}

export interface CardSessionOptions {
  /** 基础卡片配置归一/校验/资源引用收集入口（描述符能力，可异步） */
  basecard: {
    normalizeConfig(
      cardType: string,
      baseCardId: string,
      config: Record<string, unknown>,
    ): Record<string, unknown> | Promise<Record<string, unknown>>;
    collectResourcePaths(
      cardType: string,
      config: Record<string, unknown>,
    ): string[] | Promise<string[]>;
    createInitialConfig(
      cardType: string,
      baseCardId: string,
    ): Record<string, unknown> | Promise<Record<string, unknown>>;
    validateConfig?(
      cardType: string,
      config: Record<string, unknown>,
    ): { valid: boolean; errors: Record<string, string> } | Promise<{ valid: boolean; errors: Record<string, string> }>;
  };
  /** 封面 HTML 引用收集入口（与 chips.module.cover 或本地实现一致） */
  collectCoverReferences(html: string): Set<string>;
  /** 默认封面 HTML 生成入口 */
  createDefaultCoverHtml(name: string): string;
}
