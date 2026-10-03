/**
 * 箱子文件格式的 TypeScript 类型定义，与《箱子文件格式》对齐。
 *
 * 边界（PS-4）：服务器不解包 `.box`——箱子查看文档与条目匹配一律使用客户端在
 * 发布事务提交的 structure 条目模型；解包与格式校验归 card-transfer 控制面臂。
 */

/** .box/metadata.yaml 结构 */
export interface BoxMetadata {
  chip_standards_version: string;
  /** 10 位 62 进制 ID */
  box_id: string;
  name: string;
  created_at: string;
  modified_at: string;
  /** 当前布局插件标识（如 "chips-official.grid-layout"） */
  active_layout_type: string;
  cover_ratio?: string;
  description?: string;
  tags?: Array<string | string[]>;
  /** 包内封面资源路径（相对 .box 包根） */
  cover_asset?: string;
}

/** structure.yaml 中单条条目的摘要快照 */
export interface BoxEntrySnapshot {
  document_id?: string;
  title?: string;
  summary?: string;
  tags?: Array<string | string[]>;
  cover?: {
    mode: 'asset' | 'runtime' | 'none';
    asset_path?: string;
    mime_type?: string;
    width?: number;
    height?: number;
  };
  last_known_modified_at?: string;
  content_type?: string;
}

/** structure.yaml 中单条文档引用 */
export interface BoxEntryRef {
  /** 条目 ID（包内唯一） */
  entry_id: string;
  /** 绝对 URL 或包内相对路径（内嵌引用） */
  url: string;
  enabled: boolean;
  snapshot?: BoxEntrySnapshot;
  layout_hints?: Record<string, unknown>;
}

/** .box/structure.yaml 结构 */
export interface BoxStructure {
  entries: BoxEntryRef[];
}

/** 服务器端完成条目引用匹配后的条目视图（契约 §4.3.2 cards[] 条目字段） */
export interface EnrichedBoxEntryRef {
  entry_id: string;
  url: string;
  document_id?: string;
  title?: string;
  cover_url?: string;
  content_type?: string;
  /** url 是否为包内相对引用（内嵌引用） */
  embedded: boolean;
  /** 匹配到服务器公开就绪卡片时携带 */
  communityCardId?: string;
  communityViewUrl?: string;
}

/** 从 jsonb 宽松读取 structure（写入方＝发布事务；读侧仅判别 entries 形态）。 */
export function readBoxStructure(value: unknown): BoxStructure {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Array.isArray((value as { entries?: unknown })['entries'])
  ) {
    return value as BoxStructure;
  }
  return { entries: [] };
}
