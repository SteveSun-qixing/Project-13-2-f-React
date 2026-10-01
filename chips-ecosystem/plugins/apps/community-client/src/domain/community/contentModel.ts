/**
 * 社区内容模型（《11-社区平台API契约》§4.5 卡片 DTO、§4.6 箱子 DTO 的客户端领域投影）。
 *
 * 类型面逐字段对齐契约：卡片状态固定三值 `pending` / `ready` / `error`（不存在
 * `processing` 等中间状态，渲染进行中由 `viewState` 表达，§4.5）；可见性仅
 * `public` / `private`（§四 开篇）；`cardFileId` / `boxFileId` 为 10 位 Base62 文件级 ID
 * （§2.2），服务端实体 `id` 为 UUID v4；封面比例 `coverRatio` 缺省 `"3:4"`（§4.5）。
 *
 * 纯函数投影面（16-CC §4.2/§4.3 展示口径）：
 * - 作品网格键与封面比例（旧仓 `lib/ui.ts` 纯 helper 作重写素材随件迁移）；
 * - 远程封面归一为受管 URI：`https://…` → `chips-resource://external/https/<host><path>`
 *   （06-资源协议规范 §2.6 语法表；客户端不使用裸 URL 直读，16-CC §4.3）；
 * - 卡片状态门控：`ready` 才可本地查看与完整下载（16-CC §4.2 处理中置灰、error 提示不可用）；
 * - 箱子条目快照缺失标题时的占位文案（16-CC §4.2：展示占位、不猜测内容）。
 *
 * 标识一律取服务器回包（不自造 ID）；本模块不做任何网络请求。
 */

/** 卡片状态（《11-社区平台API契约》§4.5，枚举唯一权威在本契约）。 */
export type CommunityCardStatus = 'pending' | 'ready' | 'error';

/** 查看产物状态（§4.5 `CommunityViewState`）。 */
export type CommunityViewState = 'pending' | 'rendering' | 'ready' | 'error';

/** 内容可见性（§四 开篇：仅 `public` / `private`）。 */
export type CommunityVisibility = 'public' | 'private';

/** 作者公开资料（§4.5 `ICommunityUserPublic` 的客户端消费面）。 */
export interface CommunityUserPublic {
  readonly id: string;
  readonly username: string;
  readonly nickname: string | null;
  readonly avatarUrl: string | null;
}

/** 卡片摘要（§4.5 `ICommunityCardSummary`）。 */
export interface CommunityCardSummary {
  readonly id: string;
  readonly cardFileId: string;
  readonly userId: string;
  readonly name: string;
  readonly coverUrl: string | null;
  readonly coverRatio: string;
  readonly status: CommunityCardStatus;
  readonly visibility: CommunityVisibility;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 卡片详情（§4.5 `ICommunityCardDetail`）。 */
export interface CommunityCardDetail extends CommunityCardSummary {
  readonly roomId: string | null;
  readonly chipStandardsVersion: string;
  readonly tags: readonly (string | readonly string[])[];
  readonly fileSizeBytes: number;
  readonly sha256: string;
  readonly viewUrl: string | null;
  readonly renderStatusUrl: string;
  readonly user: CommunityUserPublic;
}

/** 箱子摘要（§4.6 `ICommunityBoxSummary`）。 */
export interface CommunityBoxSummary {
  readonly id: string;
  readonly boxFileId: string;
  readonly userId: string;
  readonly name: string;
  readonly coverUrl: string | null;
  readonly coverRatio: string;
  readonly activeLayoutType: string;
  readonly status: CommunityCardStatus;
  readonly visibility: CommunityVisibility;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 箱子条目引用快照（§4.6 `ICommunityBoxEntryRef`）。 */
export interface CommunityBoxEntryRef {
  readonly entryId: string;
  readonly url: string;
  readonly title: string | null;
  readonly contentType: 'chips/card' | 'chips/box' | null;
  readonly embedded: boolean;
  readonly communityCardId: string | null;
  readonly communityViewUrl: string | null;
  readonly communityRenderStatusUrl: string | null;
}

/** 统一分页信封（§2.3 列表信封 `pagination`）。 */
export interface CommunityPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

/** 作品网格条目类型（旧仓 `CommunityWorkType` 领域划分保留：卡片 / 箱子）。 */
export type CommunityWorkType = 'card' | 'box';

/** 作品网格条目投影（旧仓 `CommunityWorkItem` 重写面：标识取服务器回包，不自造）。 */
export interface CommunityWorkItem {
  readonly type: CommunityWorkType;
  readonly id: string;
  readonly title: string;
  readonly coverUri: string | null;
  readonly coverRatio: string;
  readonly status: CommunityCardStatus;
  readonly visibility: CommunityVisibility;
  readonly createdAt: string;
}

/** 卡片状态简体中文展示标签。 */
export const COMMUNITY_CARD_STATUS_LABELS: Readonly<Record<CommunityCardStatus, string>> = {
  pending: '处理中',
  ready: '已就绪',
  error: '处理失败',
};

/** 查看产物状态简体中文展示标签。 */
export const COMMUNITY_VIEW_STATE_LABELS: Readonly<Record<CommunityViewState, string>> = {
  pending: '等待生成',
  rendering: '生成中',
  ready: '可查看',
  error: '生成失败',
};

/** 可见性简体中文展示标签。 */
export const COMMUNITY_VISIBILITY_LABELS: Readonly<Record<CommunityVisibility, string>> = {
  public: '公开',
  private: '私密',
};

/** 作品网格选取键（旧仓 `getCommunityWorkSelectionKey` 领域划分保留：`<type>:<id>`）。 */
export function getCommunityWorkSelectionKey(item: Pick<CommunityWorkItem, 'type' | 'id'>): string {
  return `${item.type}:${item.id}`;
}

/** 卡片摘要 → 作品网格条目投影（封面归一为受管 URI，§4.3）。 */
export function cardSummaryToWorkItem(summary: CommunityCardSummary): CommunityWorkItem {
  return {
    type: 'card',
    id: summary.id,
    title: summary.name,
    coverUri: normalizeExternalImageUri(summary.coverUrl),
    coverRatio: summary.coverRatio,
    status: summary.status,
    visibility: summary.visibility,
    createdAt: summary.createdAt,
  };
}

/** 箱子摘要 → 作品网格条目投影。 */
export function boxSummaryToWorkItem(summary: CommunityBoxSummary): CommunityWorkItem {
  return {
    type: 'box',
    id: summary.id,
    title: summary.name,
    coverUri: normalizeExternalImageUri(summary.coverUrl),
    coverRatio: summary.coverRatio,
    status: summary.status,
    visibility: summary.visibility,
    createdAt: summary.createdAt,
  };
}

/** 卡片是否处于可传输状态（`ready` 才可本地查看与完整下载，16-CC §4.2 状态门控）。 */
export function isCardTransferReady(status: CommunityCardStatus): boolean {
  return status === 'ready';
}

/** 箱子条目展示标题（快照缺失时占位，不猜测内容；16-CC §4.2）。 */
export function readBoxEntryTitle(entry: CommunityBoxEntryRef): string {
  return entry.title !== null && entry.title.trim().length > 0 ? entry.title : '未命名条目';
}

/** 封面比例缺省值（§4.5 `coverRatio` 缺省 `"3:4"`；旧仓 `parseCoverRatio` 重写素材）。 */
export const DEFAULT_COVER_RATIO = '3:4';

/** 解析封面比例字符串（`"宽:高"` / `"宽/高"` / 单一正数）为宽高数值；缺省回退 `3:4`。 */
export function parseCoverRatioValue(value?: string | null): number {
  const fallback = 3 / 4;
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) {
    return fallback;
  }
  const separator = trimmed.includes(':') ? ':' : trimmed.includes('/') ? '/' : null;
  if (separator === null) {
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  }
  const [rawWidth, rawHeight] = trimmed.split(separator, 2);
  const width = Number(rawWidth);
  const height = Number(rawHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return fallback;
  }
  return width / height;
}

/**
 * 远程图片引用归一为受管 URI（06-资源协议规范 §2.6 语法表；16-CC §4.3）：
 * `https://cdn.example.com/banner.png` → `chips-resource://external/https/cdn.example.com/banner.png`；
 * scheme/host 小写、默认端口去除、path 大小写保持、query 原样保留；IDN 按 URL 规范转 punycode；
 * 非 `http(s)` 绝对引用或无法解析的值返回 `null`（展示占位，不猜测）。
 */
export function normalizeExternalImageUri(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }
  const scheme = parsed.protocol.slice(0, -1);
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) {
    host = `%5B${host.slice(1, -1)}%5D`;
  }
  const defaultPort = scheme === 'https' ? '443' : '80';
  const portSegment = parsed.port === '' || parsed.port === defaultPort ? '' : `:${parsed.port}`;
  return `chips-resource://external/${scheme}/${host}${portSegment}${parsed.pathname}${parsed.search}`;
}
