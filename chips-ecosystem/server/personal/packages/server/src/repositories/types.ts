import type { Box, Card } from '../db/schema/index.js';
import type { PagedItems, PaginationParams } from '../lib/pagination.js';

/**
 * 仓库端口（六边形接缝）：服务只依赖本文件接口；生产装配为 Drizzle 适配器
 * （src/repositories/drizzle），测试装配为内存 fake（tests/helpers）——真实
 * PostgreSQL 不进入测试（PG 端口 fake）。
 *
 * 可见性口径在端口层显式建模（《15》§3.1.4/§3.3）：listPublic 只含 public；
 * listAll 为管理读全量视角（含私密与未渲染，契约 §4.2.1 manage）。
 * 列表一律 createdAt 倒序（契约 §6.1，排序不通过查询参数改变）。
 */

export interface CardRepository {
  findById(id: string): Promise<Card | null>;
  /** 公开卡片分页列表（仅 visibility=public，createdAt 倒序，契约 §4.2.1）。 */
  listPublic(pagination: PaginationParams): Promise<PagedItems<Card>>;
  /** 全量卡片分页列表（管理读：全部可见性与状态，需令牌，契约 §4.2.1）。 */
  listAll(pagination: PaginationParams): Promise<PagedItems<Card>>;
  /** 箱子条目匹配：按 cardFileId 集合取公开就绪卡片（契约 §4.3.2 cards[]）。 */
  findPublicReadyByCardFileIds(cardFileIds: string[]): Promise<Card[]>;
}

export interface BoxRepository {
  findById(id: string): Promise<Box | null>;
  /** 公开箱子分页列表（仅 visibility=public，createdAt 倒序，契约 §4.3.1）。 */
  listPublic(pagination: PaginationParams): Promise<PagedItems<Box>>;
}

/** 本臂仓库集（生产装配见 src/repositories/drizzle；测试装配见 tests/helpers）。 */
export interface Repositories {
  cards: CardRepository;
  boxes: BoxRepository;
}
