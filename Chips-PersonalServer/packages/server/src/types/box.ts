/**
 * 箱子文件格式的 TypeScript 类型定义
 * 与 生态设计原稿/06-箱子文件格式.md 对齐
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

/** 社区端匹配社区卡片后的条目引用 */
export interface EnrichedBoxEntryRef {
  entry_id: string;
  url: string;
  document_id?: string;
  title?: string;
  cover_url?: string;
  content_type?: string;
  /** url 是否为包内相对路径（内嵌引用） */
  embedded: boolean;
  communityCardId?: string;
  communityViewUrl?: string;
  communityRenderStatusUrl?: string;
}

/** 箱子解包结果 */
export interface BoxUnpackResult {
  tempDir: string;
  metadata: BoxMetadata;
  structure: BoxStructure;
  content: Record<string, unknown>;
}
