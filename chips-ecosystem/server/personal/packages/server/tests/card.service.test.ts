import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CardService, createDefaultCoverHtml } from '../src/services/card.service.js';
import {
  buildTestApp,
  createFakeState,
  fixtureDates,
  makeCard,
  makeReadyRenderArtifacts,
  type TestHarness,
} from './helpers/harness.js';

/**
 * 卡片域服务纯逻辑测试（真实形态夹具）：封面比例回退、状态语义、
 * 分页数学与查看/封面入口解析。数据面一律经内存 fake 仓库。
 */

describe('CardService：封面比例回退（metadata.cover_ratio）', () => {
  let harness: TestHarness;
  let service: CardService;

  beforeAll(async () => {
    harness = await buildTestApp();
    service = new CardService({ cardRepository: harness.repositories.cards });
  });

  afterAll(async () => {
    await harness.app.close();
  });

  it('显式 coverRatio 优先；为空时回退 metadata.cover_ratio；空白值忽略', () => {
    const explicit = service.toSummary(
      makeCard({ id: 'c1', coverRatio: '3:4', cardMetadata: { cover_ratio: '16:9' } })
    );
    expect(explicit.coverRatio).toBe('3:4');

    const fallback = service.toSummary(
      makeCard({ id: 'c2', coverRatio: null, cardMetadata: { cover_ratio: '16:9' } })
    );
    expect(fallback.coverRatio).toBe('16:9');

    const blank = service.toSummary(
      makeCard({ id: 'c3', coverRatio: '  ', cardMetadata: { cover_ratio: '   ' } })
    );
    expect(blank.coverRatio).toBeNull();
  });
});

describe('CardService：状态与产物可用性语义（§3.2）', () => {
  let harness: TestHarness;
  let service: CardService;

  beforeAll(async () => {
    harness = await buildTestApp();
    service = new CardService({ cardRepository: harness.repositories.cards });
  });

  afterAll(async () => {
    await harness.app.close();
  });

  it('hasRenderArtifacts 只看查看产物存在性（有产物即 true）', () => {
    const ready = service.toStatus(
      makeCard({ id: 'c1', status: 'ready', renderArtifacts: makeReadyRenderArtifacts('c1') })
    );
    expect(ready.hasRenderArtifacts).toBe(true);

    const pending = service.toStatus(makeCard({ id: 'c2', status: 'pending' }));
    expect(pending.hasRenderArtifacts).toBe(false);
  });

  it('error 状态保留 errorMessage（公开面可见，§3.2 状态表）', () => {
    const failed = service.toStatus(
      makeCard({ id: 'c3', status: 'error', errorMessage: '恢复清单校验失败' })
    );
    expect(failed.status).toBe('error');
    expect(failed.errorMessage).toBe('恢复清单校验失败');
  });

  it('resolveViewLocation：无产物抛 409 CARD_RENDER_NOT_READY（状态冲突，非 404）', () => {
    const pending = makeCard({ id: 'c1', status: 'pending' });
    try {
      service.resolveViewLocation(pending);
      expect.unreachable('应抛出 CARD_RENDER_NOT_READY');
    } catch (error) {
      expect((error as { code: string; statusCode: number }).code).toBe('CARD_RENDER_NOT_READY');
      expect((error as { statusCode: number }).statusCode).toBe(409);
    }
  });

  it('resolveCover：无封面产物回落默认占位页（标题转义）', () => {
    const resolution = service.resolveCover(makeCard({ id: 'c1', title: '<b>标题</b>' }));
    expect(resolution.kind).toBe('placeholder');
    if (resolution.kind === 'placeholder') {
      expect(resolution.html).toContain('&lt;b&gt;标题&lt;/b&gt;');
    }
    expect(createDefaultCoverHtml('a&b')).toContain('a&amp;b');
  });
});

describe('CardService：分页数学（契约 §6.1）', () => {
  let harness: TestHarness;
  let service: CardService;

  beforeAll(async () => {
    const state = createFakeState();
    for (let index = 0; index < 25; index += 1) {
      state.cards.push(
        makeCard({
          id: `card-${index}`,
          createdAt: new Date(fixtureDates.a.getTime() + index * 1000),
        })
      );
    }
    harness = await buildTestApp({ state });
    service = new CardService({ cardRepository: harness.repositories.cards });
  });

  afterAll(async () => {
    await harness.app.close();
  });

  it('totalPages 向上取整；第二页返回剩余条目', async () => {
    const first = await service.listPublic({ page: 1, pageSize: 20 });
    expect(first.total).toBe(25);
    expect(first.items).toHaveLength(20);

    const second = await service.listPublic({ page: 2, pageSize: 20 });
    expect(second.items).toHaveLength(5);
  });

  it('createdAt 倒序（新作品在前）', async () => {
    const page = await service.listPublic({ page: 1, pageSize: 3 });
    expect(page.items.map((card) => card.id)).toEqual(['card-24', 'card-23', 'card-22']);
  });
});
