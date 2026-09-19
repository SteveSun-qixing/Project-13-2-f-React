/**
 * 文档模型：`.card` / `.box` 解析结果的类型化视图。
 *
 * 字段语义与校验规则以 [01-卡片文件格式] 与 [02-箱子文件格式] 为准；
 * 本模块只登记形状，不重复格式规则（02-SDK-API规范 §2.2「文档模型」行）。
 */

/** 一条解析诊断（06-文档解析器设计 §8、十二 §12.3）。 */
export interface Diagnostic {
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly pointer?: string;
  readonly line?: number;
  readonly column?: number;
  readonly hint?: string;
}

/** 标签：简单标签为字符串；结构化标签为字符串数组（首项为键，其余为值）。 */
export type Tag = string | readonly string[];

/** `metadata.file_info`：由写入链路生成（01-卡片文件格式 §4.1）。 */
interface IFileInfo {
  readonly total_size: number;
  readonly file_count: number;
  readonly checksum?: string;
  readonly generated_at?: string;
}

/**
 * `.card/metadata.yaml` 的解析结果。
 *
 * 可选扩展属性按 01-卡片文件格式 §4 取值；`file_info` 由系统自动生成。
 */
export interface CardMetadata {
  readonly chip_standards_version: string;
  readonly card_id: string;
  readonly name: string;
  readonly created_at: string;
  readonly modified_at: string;
  readonly theme?: string;
  readonly cover_ratio?: string;
  readonly tags: readonly Tag[];
  readonly visibility?: 'public' | 'private' | 'unlisted';
  readonly downloadable?: boolean;
  readonly remixable?: boolean;
  readonly commentable?: boolean;
  readonly license?: string;
  readonly age_rating?: 'all' | 'pg' | 'pg13' | 'r' | 'nc17';
  readonly content_warning?: readonly string[];
  readonly file_info?: IFileInfo;
}

/**
 * `.box/metadata.yaml` 的解析结果（02-箱子文件格式 §4）。
 */
export interface BoxMetadata {
  readonly chip_standards_version: string;
  readonly box_id: string;
  readonly name: string;
  readonly created_at: string;
  readonly modified_at: string;
  readonly active_layout_type: string;
  readonly description?: string;
  readonly tags?: readonly Tag[];
  readonly cover_ratio?: string;
  readonly cover_asset?: string;
  readonly owner?: string;
  readonly source?: Readonly<Record<string, unknown>>;
}

/**
 * `content/{node_id}.yaml` 的通用字段与插件专有字段（01-卡片文件格式 §6.1）。
 *
 * `card_type` 必填；插件专有字段为不透明值，调用方读取时必须做运行时收窄。
 */
export type CardContent = Readonly<Record<string, unknown>> & {
  readonly card_type: string;
  readonly theme?: string;
  readonly layout?: {
    readonly height_mode?: 'auto' | 'fixed';
    readonly fixed_height?: number;
    readonly aspect_ratio?: string;
  };
};

/**
 * 单个内容节点的解析结果（L2；06-文档解析器设计 §11.3）。
 */
export interface ContentNode {
  readonly node_id: string;
  readonly file: string;
  readonly card_type: string;
  readonly value: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly Diagnostic[];
}

/** `.card/structure.yaml` 的 `structure[]` 条目。 */
interface IStructureEntry {
  readonly id: string;
  readonly type: string;
}

/** `.card/structure.yaml` 的 `manifest.resources[]` 条目。 */
interface IStructureResource {
  readonly path: string;
  readonly size: number;
  readonly type: string;
  readonly duration?: number;
  readonly width?: number;
  readonly height?: number;
  readonly language?: string;
  readonly checksum?: string;
}

/** `.card/structure.yaml` 的 `manifest` 对象。 */
interface IStructureManifest {
  readonly card_count: number;
  readonly resource_count: number;
  readonly resources?: readonly IStructureResource[];
}

/** `.card/structure.yaml` 的解析结果（L1）。 */
export interface StructureModel {
  readonly structure: readonly IStructureEntry[];
  readonly manifest: IStructureManifest;
}

/**
 * `.box/structure.yaml` 的条目（02-箱子文件格式 §5.3）。
 */
export interface Entry {
  readonly entry_id: string;
  readonly url: string;
  readonly enabled: boolean;
  readonly snapshot?: Readonly<Record<string, unknown>>;
  readonly layout_hints?: Readonly<Record<string, unknown>>;
}
