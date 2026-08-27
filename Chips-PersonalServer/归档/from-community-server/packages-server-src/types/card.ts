/**
 * 卡片文件格式的 TypeScript 类型定义
 * 与 生态设计原稿/05-卡片文件格式.md 对齐
 */

/** metadata.yaml 结构 */
export interface CardMetadata {
  chip_standards_version: string;
  /** 10 位 62 进制 ID */
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  theme?: string;
  /** 标签数组，每个元素是词数组（多词标签） */
  tags?: string[][];
  /** 封面比例（如 "3:4"） */
  cover_ratio?: string;
  visibility?: string;
  cover_enabled?: boolean;
}

/** structure.yaml 中单个基础卡片条目 */
export interface CardStructureEntry {
  id: string;
  type: string;
}

/** structure.yaml 结构 */
export interface CardStructure {
  structure: CardStructureEntry[];
  manifest?: {
    card_count?: number;
    files?: Array<{
      path: string;
      size: number;
      type: string;
      duration?: number;
      language?: string;
    }>;
  };
}

/** 资源文件描述 */
export interface ResourceFile {
  /** 相对于卡片根目录的路径（如 "photo.jpg"） */
  relativePath: string;
  /** 绝对路径（临时目录中） */
  absolutePath: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件名（不含路径） */
  filename: string;
}

/** 卡片解包结果 */
export interface CardUnpackResult {
  /** 临时解压目录（必须在 finally 中 rm -rf） */
  tempDir: string;
  metadata: CardMetadata;
  structure: CardStructure;
  /** 卡片内所有非结构配置文件资源（会进入上传与替换链路） */
  resourceFiles: ResourceFile[];
  /**
   * content/*.yaml 内容映射表
   * Key: 基础卡片 ID（文件名去掉 .yaml）
   * Value: 解析后的 YAML 对象
   */
  contentMap: Map<string, Record<string, unknown>>;
  /** cover.html 原始内容（若存在） */
  coverHtml?: string;
}
