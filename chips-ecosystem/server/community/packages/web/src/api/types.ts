/**
 * 社区平台 API DTO——《社区平台 API 契约》§3/§4.3 的 Web 前台客户端落点。
 * 字段与契约逐字段对齐，禁止增删改名；时间一律 RFC 3339 UTC。
 */

export type CommunityUserRole = 'user' | 'admin';

/** 公开资料（契约 §4.3 `ICommunityUserPublic`）：不含 email 与 role。 */
export interface ICommunityUserPublic {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

/** 当前用户（契约 §4.3 `ICommunityUserMe`）：GET /users/me 返回。 */
export interface ICommunityUserMe extends ICommunityUserPublic {
  email: string;
  role: CommunityUserRole;
  updatedAt: string;
}

/** 会话用户（契约 §3.2 注册 / 登录响应体 user 字段）：公开资料 + role。 */
export interface ICommunityUserSession extends ICommunityUserPublic {
  role: CommunityUserRole;
}

/** 注册 / 登录成功响应体（契约 §3.2）。 */
export interface ICommunityAuthSession {
  user: ICommunityUserSession;
  accessToken: string;
  refreshToken: string;
}

/** 刷新成功响应体（契约 §3.3）：`refreshToken` 仅在轮换时出现。 */
export interface ICommunityTokenPair {
  accessToken: string;
  refreshToken?: string;
}

/** 分页对象（契约 §2.3/§6.1）。 */
export interface CommunityPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type CommunityWorkType = 'card' | 'box';

/** 统一作品视图模型（《14 设计》§4.4）：个人主页卡片与箱子混排的最小展示单位。 */
export interface CommunityWorkItem {
  id: string;
  type: CommunityWorkType;
  title: string;
  coverUrl: string | null;
  /** 封面宽高比（如 `3:4`），来自内容元数据 `coverRatio`；仅用于磁贴排版。 */
  coverRatio: string | null;
  href: string;
  createdAt: string;
}

/** 作品管理勾选键：类型 + 实体 ID。 */
export function getCommunityWorkSelectionKey(item: Pick<CommunityWorkItem, 'type' | 'id'>): string {
  return `${item.type}:${item.id}`;
}
