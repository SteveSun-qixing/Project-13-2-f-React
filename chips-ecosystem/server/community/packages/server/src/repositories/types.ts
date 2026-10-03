import type {
  Box,
  Card,
  CardRenderCache,
  IdempotencyRecord,
  NewIdempotencyRecord,
  NewRefreshSession,
  NewRoom,
  NewUser,
  RefreshSession,
  Room,
  User,
} from '../db/schema/index.js';
import type { PagedItems } from '../lib/pagination.js';

/**
 * 仓库端口（六边形接缝）：服务只依赖本文件接口；生产装配为 Drizzle 适配器
 * （src/repositories/drizzle），测试装配为内存 fake（tests/helpers）——真实
 * PostgreSQL 不进入测试（PG 端口 fake）。
 *
 * 可见性口径在端口层显式建模：`includeAll` 表示「所有者本人或管理员」的全量视角；
 * 匿名 / 普通请求者视角只含公开内容，列表另按契约 §4.1 只返回就绪内容。
 */

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByUsernameLower(usernameLower: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** 登录标识（契约 §3.2：接受邮箱或用户名）。 */
  findByLoginIdentifier(identifier: string): Promise<User | null>;
  create(data: NewUser): Promise<User>;
  update(
    id: string,
    patch: Partial<
      Pick<
        User,
        | 'displayName'
        | 'bio'
        | 'avatarUrl'
        | 'passwordHash'
        | 'failedLoginCount'
        | 'lockedUntil'
        | 'updatedAt'
      >
    >
  ): Promise<User>;
  /** 公开检索（契约 §4.7：按用户名匹配；只含启用账号）。 */
  searchActive(query: string, page: { page: number; pageSize: number }): Promise<PagedItems<User>>;
}

export interface RefreshSessionRepository {
  create(data: NewRefreshSession): Promise<void>;
  findByJti(jti: string): Promise<RefreshSession | null>;
  revoke(jti: string, revokedAt: Date): Promise<void>;
  /** 吊销某账号全部会话（可排除当前会话；改密场景）。 */
  revokeAllForUser(userId: string, exceptJti: string | null, revokedAt: Date): Promise<number>;
}

export interface RoomRepository {
  findById(id: string): Promise<Room | null>;
  create(data: NewRoom): Promise<Room>;
  /** 用户房间列表（includeAll=false 时仅公开房间）；createdAt 倒序。 */
  listByUser(
    userId: string,
    opts: { includeAll: boolean },
    pagination: { page: number; pageSize: number }
  ): Promise<PagedItems<Room>>;
  listAllByUser(userId: string, opts: { includeAll: boolean }): Promise<Room[]>;
}

export interface CardRepository {
  findById(id: string): Promise<Card | null>;
  /** 公开发现列表（public + ready，createdAt 倒序，契约 §4.7）。 */
  listPublicReady(pagination: { page: number; pageSize: number }): Promise<PagedItems<Card>>;
  /** 用户列表（includeAll=false 仅 public+ready；owner/admin 视角含私有与未就绪）。 */
  listByUser(
    userId: string,
    opts: { includeAll: boolean },
    pagination: { page: number; pageSize: number }
  ): Promise<PagedItems<Card>>;
  listRootByUser(
    userId: string,
    opts: { includeAll: boolean },
    pagination: { page: number; pageSize: number }
  ): Promise<PagedItems<Card>>;
  listByRoom(
    roomId: string,
    opts: { includeAll: boolean },
    pagination: { page: number; pageSize: number }
  ): Promise<PagedItems<Card>>;
  countByRoom(roomId: string, opts: { includeAll: boolean }): Promise<number>;
  /** 公开就绪检索（名称或标签匹配，契约 §4.7）。 */
  searchPublicReady(
    query: string,
    pagination: { page: number; pageSize: number }
  ): Promise<PagedItems<Card>>;
  /** 箱子条目匹配：按 cardFileId 集合取公开就绪卡片（服务层再做命中装配）。 */
  findPublicReadyByCardFileIds(cardFileIds: string[]): Promise<Card[]>;
}

export interface BoxRepository {
  findById(id: string): Promise<Box | null>;
  listPublicReady(pagination: { page: number; pageSize: number }): Promise<PagedItems<Box>>;
  listByUser(
    userId: string,
    opts: { includeAll: boolean },
    pagination: { page: number; pageSize: number }
  ): Promise<PagedItems<Box>>;
  listRootByUser(
    userId: string,
    opts: { includeAll: boolean },
    pagination: { page: number; pageSize: number }
  ): Promise<PagedItems<Box>>;
  listByRoom(
    roomId: string,
    opts: { includeAll: boolean },
    pagination: { page: number; pageSize: number }
  ): Promise<PagedItems<Box>>;
  countByRoom(roomId: string, opts: { includeAll: boolean }): Promise<number>;
  searchPublicReady(
    query: string,
    pagination: { page: number; pageSize: number }
  ): Promise<PagedItems<Box>>;
}

export interface RenderCacheRepository {
  /** 指定卡片的查看缓存记录（community-web 档）。 */
  findWebByCard(cardId: string): Promise<CardRenderCache | null>;
  /** 指定卡片的封面缓存记录（community-cover 档）。 */
  findCoverByCard(cardId: string): Promise<CardRenderCache | null>;
  /** 指定卡片的全部缓存记录（hasRenderArtifacts 判定）。 */
  listByCard(cardId: string): Promise<CardRenderCache[]>;
}

export interface IdempotencyRepository {
  find(
    accountId: string,
    endpoint: string,
    key: string,
    now: Date
  ): Promise<IdempotencyRecord | null>;
  /** 占用幂等键；键已存在返回 false（唯一约束兜底并发）。 */
  claim(data: NewIdempotencyRecord): Promise<boolean>;
  fulfill(
    accountId: string,
    endpoint: string,
    key: string,
    result: { statusCode: number; responseBody: unknown }
  ): Promise<void>;
  /** 处理失败释放占用（5xx 不缓存为重放结果）。 */
  release(accountId: string, endpoint: string, key: string): Promise<void>;
}

/** 本臂仓库集（生产装配见 src/repositories/drizzle；测试装配见 tests/helpers）。 */
export interface Repositories {
  users: UserRepository;
  refreshSessions: RefreshSessionRepository;
  rooms: RoomRepository;
  cards: CardRepository;
  boxes: BoxRepository;
  renderCaches: RenderCacheRepository;
  idempotency: IdempotencyRepository;
}
