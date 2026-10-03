/**
 * 社区平台 API DTO——《社区平台 API 契约》§4.3~§4.6 接口类型的唯一服务端落点。
 * 字段与契约逐字段对齐，禁止增删改名；时间一律 RFC 3339 UTC。
 */

export type CommunityVisibility = 'public' | 'private';
export type CommunityCardStatus = 'pending' | 'ready' | 'error';
export type CommunityViewState = 'pending' | 'rendering' | 'ready' | 'error';

export interface ICommunityUserPublic {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ICommunityUserMe extends ICommunityUserPublic {
  email: string;
  role: 'user' | 'admin';
  updatedAt: string;
}

/** 注册 / 登录响应体内的会话用户（《11 契约》§3.2 示例口径：公开资料 + role，不含 email）。 */
export interface ICommunityUserSession extends ICommunityUserPublic {
  role: 'user' | 'admin';
}

export interface ICommunitySpace {
  user: ICommunityUserPublic;
  rooms: ICommunityRoom[];
  cards: ICommunityCardSummary[];
  boxes: ICommunityBoxSummary[];
}

export interface ICommunityRoom {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  visibility: CommunityVisibility;
  cardCount: number;
  boxCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ICommunityCardSummary {
  id: string;
  cardFileId: string;
  userId: string;
  name: string;
  coverUrl: string | null;
  coverRatio: string;
  status: CommunityCardStatus;
  visibility: CommunityVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface ICommunityCardDetail extends ICommunityCardSummary {
  roomId: string | null;
  chipStandardsVersion: string;
  tags: Array<string | string[]>;
  fileSizeBytes: number;
  sha256: string;
  viewUrl: string | null;
  renderStatusUrl: string;
  user: ICommunityUserPublic;
}

export interface ICommunityCardOpenView {
  id: string;
  cardFileId: string;
  name: string;
  coverUrl: string | null;
  coverRatio: string;
  viewUrl: string | null;
  renderStatusUrl: string;
  viewState: CommunityViewState;
  status: CommunityCardStatus;
  visibility: CommunityVisibility;
  chipStandardsVersion: string;
  user: ICommunityUserPublic;
  createdAt: string;
  updatedAt: string;
}

export interface ICommunityCardStatus {
  cardId: string;
  status: CommunityCardStatus;
  viewState: CommunityViewState;
  hasRenderArtifacts: boolean;
  updatedAt: string;
}

export interface ICommunityCardRenderStatus {
  cardId: string;
  viewState: CommunityViewState;
  attemptCount: number;
  updatedAt: string;
  viewUrl: string | null;
  error: { code: string; message: string } | null;
}

export interface ICommunityBoxSummary {
  id: string;
  boxFileId: string;
  userId: string;
  name: string;
  coverUrl: string | null;
  coverRatio: string;
  activeLayoutType: string;
  status: CommunityCardStatus;
  visibility: CommunityVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface ICommunityBoxEntryRef {
  entryId: string;
  url: string;
  title: string | null;
  contentType: 'chips/card' | 'chips/box' | null;
  embedded: boolean;
  communityCardId: string | null;
  communityViewUrl: string | null;
  communityRenderStatusUrl: string | null;
}

export interface ICommunityBoxDetail extends ICommunityBoxSummary {
  roomId: string | null;
  chipStandardsVersion: string;
  tags: Array<string | string[]>;
  fileSizeBytes: number;
  sha256: string;
  documentUrl: string;
  entries: ICommunityBoxEntryRef[];
  user: ICommunityUserPublic;
}

export interface ICommunityTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ICommunityAuthSession {
  user: ICommunityUserSession;
  accessToken: string;
  refreshToken: string;
}
