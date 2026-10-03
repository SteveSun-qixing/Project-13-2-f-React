import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import type { AppConfig } from '../../src/config/env.js';
import type { Box, Card } from '../../src/db/schema/index.js';
import type { PagedItems, PaginationParams } from '../../src/lib/pagination.js';
import type { BoxRepository, CardRepository, Repositories } from '../../src/repositories/types.js';
import type { CardRenderArtifacts } from '../../src/types/render-artifacts.js';

/**
 * 内存 fake 仓库与测试装配（PG 端口 fake）：真实 PostgreSQL 不进入测试。
 * 谓词与 Drizzle 适配器同口径（listPublic 仅 public、listAll 全量、
 * createdAt 倒序、条目匹配只取公开就绪卡片），路由契约测试在该接缝上装配。
 *
 * 凭据红线：本文件令牌为测试专用假值（TEST_API_TOKEN），真实凭据零入库零入测。
 */

export const TEST_API_TOKEN = 'personal-server-test-token-0001';

export interface FakeState {
  cards: Card[];
  boxes: Box[];
}

export function createFakeState(): FakeState {
  return { cards: [], boxes: [] };
}

function byCreatedAtDesc<T extends { createdAt: Date }>(left: T, right: T): number {
  return right.createdAt.getTime() - left.createdAt.getTime();
}

function paginate<T>(items: T[], pagination: PaginationParams): PagedItems<T> {
  const start = (pagination.page - 1) * pagination.pageSize;
  return {
    items: items.slice(start, start + pagination.pageSize),
    total: items.length,
  };
}

class FakeCardRepository implements CardRepository {
  constructor(private readonly state: FakeState) {}

  findById(id: string): Promise<Card | null> {
    const found = this.state.cards.find((card) => card.id === id);
    return Promise.resolve(found ?? null);
  }

  listPublic(pagination: PaginationParams): Promise<PagedItems<Card>> {
    const items = this.state.cards
      .filter((card) => card.visibility === 'public')
      .sort(byCreatedAtDesc);
    return Promise.resolve(paginate(items, pagination));
  }

  listAll(pagination: PaginationParams): Promise<PagedItems<Card>> {
    const items = [...this.state.cards].sort(byCreatedAtDesc);
    return Promise.resolve(paginate(items, pagination));
  }

  findPublicReadyByCardFileIds(cardFileIds: string[]): Promise<Card[]> {
    if (cardFileIds.length === 0) {
      return Promise.resolve([]);
    }
    const wanted = new Set(cardFileIds);
    return Promise.resolve(
      this.state.cards.filter(
        (card) =>
          card.cardFileId !== null &&
          wanted.has(card.cardFileId) &&
          card.status === 'ready' &&
          card.visibility === 'public'
      )
    );
  }
}

class FakeBoxRepository implements BoxRepository {
  constructor(private readonly state: FakeState) {}

  findById(id: string): Promise<Box | null> {
    const found = this.state.boxes.find((box) => box.id === id);
    return Promise.resolve(found ?? null);
  }

  listPublic(pagination: PaginationParams): Promise<PagedItems<Box>> {
    const items = this.state.boxes
      .filter((box) => box.visibility === 'public')
      .sort(byCreatedAtDesc);
    return Promise.resolve(paginate(items, pagination));
  }
}

export function createFakeRepositories(state: FakeState): Repositories {
  return {
    cards: new FakeCardRepository(state),
    boxes: new FakeBoxRepository(state),
  };
}

export function buildTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    host: '127.0.0.1',
    baseUrl: 'https://personal.example.test',
    databaseUrl: 'postgres://personal:test@localhost:5432/personal_test',
    apiToken: TEST_API_TOKEN,
    enableSwagger: false,
    corsExtraOrigins: [],
    ...overrides,
  };
}

export interface TestHarness {
  app: FastifyInstance;
  state: FakeState;
  repositories: Repositories;
  config: AppConfig;
}

export async function buildTestApp(options?: {
  config?: Partial<AppConfig>;
  state?: FakeState;
}): Promise<TestHarness> {
  const state = options?.state ?? createFakeState();
  const config = buildTestConfig(options?.config);
  const repositories = createFakeRepositories(state);
  const app = await buildApp({ config, repositories, version: '0.1.0' });
  return { app, state, repositories, config };
}

// ─── 夹具（真实形态卡片/箱子行）────────────────────────────────────

const FIXTURE_DATE_A = new Date('2026-09-01T00:00:00.000Z');
const FIXTURE_DATE_B = new Date('2026-09-02T00:00:00.000Z');
const FIXTURE_DATE_C = new Date('2026-09-03T00:00:00.000Z');

export const fixtureDates = { a: FIXTURE_DATE_A, b: FIXTURE_DATE_B, c: FIXTURE_DATE_C };

export function makeCard(overrides: Partial<Card> & { id: string }): Card {
  const base: Card = {
    id: overrides.id,
    cardFileId: null,
    title: '未命名卡片',
    coverUrl: null,
    coverRatio: null,
    htmlUrl: null,
    renderArtifacts: null,
    renderedAt: null,
    sourceCardBucket: null,
    sourceCardKey: null,
    sourceCardUrl: null,
    sourceCardSha256: null,
    sourceCardStoredAt: null,
    resourceManifest: null,
    publishedByClient: null,
    publishedClientVersion: null,
    publishedAt: null,
    cardMetadata: null,
    cardStructure: null,
    status: 'pending',
    errorMessage: null,
    visibility: 'public',
    fileSizeBytes: null,
    createdAt: FIXTURE_DATE_A,
    updatedAt: FIXTURE_DATE_A,
  };
  return { ...base, ...overrides };
}

export function makeBox(overrides: Partial<Box> & { id: string }): Box {
  const base: Box = {
    id: overrides.id,
    boxFileId: null,
    title: '未命名箱子',
    coverUrl: null,
    coverBucket: null,
    coverKey: null,
    coverRatio: null,
    documentUrl: null,
    metadata: null,
    structure: null,
    content: null,
    layoutPlugin: null,
    sourceBoxBucket: null,
    sourceBoxKey: null,
    sourceBoxUrl: null,
    sourceBoxSha256: null,
    sourceBoxStoredAt: null,
    visibility: 'public',
    fileSizeBytes: null,
    createdAt: FIXTURE_DATE_A,
    updatedAt: FIXTURE_DATE_A,
  };
  return { ...base, ...overrides };
}

/** 就绪卡片夹具：查看/封面产物入口指向受控代理路由（私密产物形态）。 */
export function makeReadyRenderArtifacts(cardId: string): CardRenderArtifacts {
  return {
    rendererVersion: 'host-transfer-fixture',
    view: {
      cacheVersion: `session-${cardId}`,
      bucket: 'chips-card-render-cache-private',
      keyPrefix: `${cardId}/session-${cardId}`,
      entryObjectKey: `${cardId}/session-${cardId}/index.html`,
      entryUrl: `/api/v1/cards/${cardId}/render-cache/session-${cardId}/index.html`,
      fileCount: 3,
      sizeBytes: 4096,
    },
    cover: {
      cacheVersion: `session-${cardId}`,
      bucket: 'chips-card-cover-cache-private',
      keyPrefix: `${cardId}/session-${cardId}`,
      entryObjectKey: `${cardId}/session-${cardId}/cover.html`,
      entryUrl: `/api/v1/cards/${cardId}/cover-cache/session-${cardId}/cover.html`,
      fileCount: 1,
      sizeBytes: 1024,
    },
  };
}
