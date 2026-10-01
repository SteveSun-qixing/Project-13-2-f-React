import { describe, expect, it } from 'vitest';
import {
  boxSummaryToWorkItem,
  cardSummaryToWorkItem,
  COMMUNITY_CARD_STATUS_LABELS,
  COMMUNITY_VISIBILITY_LABELS,
  COMMUNITY_VIEW_STATE_LABELS,
  getCommunityWorkSelectionKey,
  isCardTransferReady,
  normalizeExternalImageUri,
  parseCoverRatioValue,
  readBoxEntryTitle,
  type CommunityBoxEntryRef,
  type CommunityBoxSummary,
  type CommunityCardSummary,
} from '../src/domain/community/contentModel';

/** 服务器回包形态的卡片摘要（11-契约 §4.5 字段面；ID 为 §4.4 在册示例 UUID）。 */
const CARD_SUMMARY: CommunityCardSummary = {
  id: '1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d',
  cardFileId: 'a1B2c3D4e5',
  userId: '2b7f5e1c-9d34-4a5b-8c6d-1e2f3a4b5c6d',
  name: '东京旅行日记',
  coverUrl: 'https://file.chipscard.space/cards/1a2b3c4d/cover.png',
  coverRatio: '3:4',
  status: 'ready',
  visibility: 'public',
  createdAt: '2026-01-15T08:00:00.000Z',
  updatedAt: '2026-01-30T10:30:00.000Z',
};

/** 服务器回包形态的箱子摘要（11-契约 §4.6 字段面）。 */
const BOX_SUMMARY: CommunityBoxSummary = {
  id: '3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f',
  boxFileId: 'k1L2m3N4o5',
  userId: '2b7f5e1c-9d34-4a5b-8c6d-1e2f3a4b5c6d',
  name: '东京行程箱',
  coverUrl: null,
  coverRatio: '16:9',
  activeLayoutType: 'chips.layout.grid',
  status: 'pending',
  visibility: 'private',
  createdAt: '2026-02-01T09:00:00.000Z',
  updatedAt: '2026-02-01T09:00:00.000Z',
};

describe('社区内容模型投影（11-契约 §4.5/§4.6 + 16-CC §4.2/§4.3）', () => {
  it('作品网格选取键保持 <type>:<id> 领域划分', () => {
    expect(getCommunityWorkSelectionKey({ type: 'card', id: CARD_SUMMARY.id })).toBe(
      `card:${CARD_SUMMARY.id}`,
    );
    expect(getCommunityWorkSelectionKey({ type: 'box', id: BOX_SUMMARY.id })).toBe(
      `box:${BOX_SUMMARY.id}`,
    );
  });

  it('卡片/箱子摘要投影为作品网格条目，封面归一为受管 URI、标识取服务器回包', () => {
    const cardItem = cardSummaryToWorkItem(CARD_SUMMARY);
    expect(cardItem).toEqual({
      type: 'card',
      id: '1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d',
      title: '东京旅行日记',
      coverUri: 'chips-resource://external/https/file.chipscard.space/cards/1a2b3c4d/cover.png',
      coverRatio: '3:4',
      status: 'ready',
      visibility: 'public',
      createdAt: '2026-01-15T08:00:00.000Z',
    });

    const boxItem = boxSummaryToWorkItem(BOX_SUMMARY);
    expect(boxItem.type).toBe('box');
    expect(boxItem.coverUri).toBeNull();
    expect(boxItem.status).toBe('pending');
  });

  it('状态门控：ready 才可本地查看与完整下载（16-CC §4.2）', () => {
    expect(isCardTransferReady('ready')).toBe(true);
    expect(isCardTransferReady('pending')).toBe(false);
    expect(isCardTransferReady('error')).toBe(false);
  });

  it('箱子条目快照缺失标题时展示占位（16-CC §4.2：展示占位、不猜测内容）', () => {
    const entry: CommunityBoxEntryRef = {
      entryId: 'entry-1',
      url: 'cards/a1B2c3D4e5.card',
      title: null,
      contentType: 'chips/card',
      embedded: true,
      communityCardId: null,
      communityViewUrl: null,
      communityRenderStatusUrl: null,
    };
    expect(readBoxEntryTitle(entry)).toBe('未命名条目');
    expect(readBoxEntryTitle({ ...entry, title: '  ' })).toBe('未命名条目');
    expect(readBoxEntryTitle({ ...entry, title: '东京塔' })).toBe('东京塔');
  });

  it('简体中文展示标签与契约枚举一一对应', () => {
    expect(COMMUNITY_CARD_STATUS_LABELS).toEqual({ pending: '处理中', ready: '已就绪', error: '处理失败' });
    expect(COMMUNITY_VIEW_STATE_LABELS).toEqual({
      pending: '等待生成',
      rendering: '生成中',
      ready: '可查看',
      error: '生成失败',
    });
    expect(COMMUNITY_VISIBILITY_LABELS).toEqual({ public: '公开', private: '私密' });
  });
});

describe('封面比例解析（11-契约 §4.5 缺省 3:4；旧仓 parseCoverRatio 重写素材）', () => {
  it('支持 宽:高、宽/高 与单一正数，缺省回退 3:4', () => {
    expect(parseCoverRatioValue('3:4')).toBeCloseTo(0.75);
    expect(parseCoverRatioValue('16/9')).toBeCloseTo(16 / 9);
    expect(parseCoverRatioValue('2')).toBe(2);
    expect(parseCoverRatioValue(null)).toBeCloseTo(0.75);
    expect(parseCoverRatioValue('')).toBeCloseTo(0.75);
    expect(parseCoverRatioValue('abc')).toBeCloseTo(0.75);
    expect(parseCoverRatioValue('0:-3')).toBeCloseTo(0.75);
    expect(parseCoverRatioValue('16')).not.toBeCloseTo(0.75);
  });
});

describe('远程封面受管 URI 归一（06-资源协议 §2.6 语法表；16-CC §4.3）', () => {
  it('https 引用归一为 external 受管 URI：scheme/host 小写、path 大小写保持', () => {
    expect(normalizeExternalImageUri('https://cdn.example.com/banner.png')).toBe(
      'chips-resource://external/https/cdn.example.com/banner.png',
    );
    expect(normalizeExternalImageUri('HTTPS://CDN.Example.COM/Banner.PNG')).toBe(
      'chips-resource://external/https/cdn.example.com/Banner.PNG',
    );
  });

  it('默认端口去除、非默认端口保留、query 原样保留', () => {
    expect(normalizeExternalImageUri('https://example.com:443/a.png')).toBe(
      'chips-resource://external/https/example.com/a.png',
    );
    expect(normalizeExternalImageUri('http://api.example.com:8080/v1/items?page=2')).toBe(
      'chips-resource://external/http/api.example.com:8080/v1/items?page=2',
    );
  });

  it('非 http(s) 引用、相对路径与空值返回 null（展示占位、不猜测）', () => {
    expect(normalizeExternalImageUri('ftp://files.example/a.png')).toBeNull();
    expect(normalizeExternalImageUri('/cards/cover.png')).toBeNull();
    expect(normalizeExternalImageUri('not a url')).toBeNull();
    expect(normalizeExternalImageUri(null)).toBeNull();
    expect(normalizeExternalImageUri('')).toBeNull();
  });
});
