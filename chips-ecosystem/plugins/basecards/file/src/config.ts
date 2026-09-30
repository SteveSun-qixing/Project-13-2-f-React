/**
 * 文件基础卡片配置模型（《01-卡片文件格式》§6.9、《08-基础卡片插件接口》§7）。
 *
 * 配置位于节点内容 `config` 字段；本模块提供归一（readConfig）、展示派生
 * （deriveDisplayFileName）、资源打开请求组装（buildFileOpenRequest，
 * 《14-资源打开与默认处理器契约》§2.2 形状、§6.9 无业务载荷），与
 * `assets/schemas/file-card-config.schema.json` 保持同一口径（08 §7.3：
 * validateConfig 不得比 schema 宽松）。
 *
 * 旧族配置中的 `theme` 字段随主题系统废弃（task030），且不在《01》§6.9 权威
 * Schema 内，不迁。
 */

import { inferFileMimeType, normalizeExtension } from './shared/file-types';
import {
  deriveFileStem,
  isNonEmptyString,
  normalizeRelativeCardResourcePath,
  resolveFileExtension,
  resolveFileName,
} from './shared/utils';

/** 卡片类型正式 ID（与 manifest capabilities.cardTypes[0].id 一致；历史别名 FileCard 由平台归一）。 */
export const CARD_TYPE_ID = 'base.file';

/** 文件卡片配置（《01》§6.9）。 */
export interface IFileConfig {
  /** 文件资源在卡片根目录中的相对路径（必填）。 */
  file_file: string;
  /** 展示用文件名（不含后缀）；为空时从 file_file 派生。 */
  file_name: string;
  /** 展示用文件后缀（小写、不含点）；为空时从 file_file 派生。 */
  file_extension: string;
  /** 可选的自定义封面资源相对路径；未配置时按类别使用内置默认封面。 */
  cover_image: string;
}

export const DEFAULT_CONFIG: IFileConfig = {
  file_file: '',
  file_name: '',
  file_extension: '',
  cover_image: '',
};

// ---------- 归一 ----------

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeResourcePath(value: unknown): string {
  return normalizeRelativeCardResourcePath(value) ?? '';
}

/**
 * 归一任意输入为完整配置：缺失或非法字段回退默认值（08 §7.1 规则 2）；
 * `file_name` / `file_extension` 缺失时从 `file_file` 派生（01 §6.9 补充说明第 3 条）。
 */
export function readConfig(input: unknown): IFileConfig {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const fileFile = normalizeResourcePath(record['file_file']);
  const fileExtension = normalizeExtension(record['file_extension']);

  return {
    file_file: fileFile,
    file_name:
      isNonEmptyString(record['file_name']) ? asString(record['file_name']) : deriveFileStem(fileFile),
    file_extension: fileExtension || resolveFileExtension(fileFile),
    cover_image: normalizeResourcePath(record['cover_image']),
  };
}

// ---------- 校验（与 schema 同口径：出现即校验，缺席不阻断） ----------

function isValidResourcePathField(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  if (value.trim().length === 0) {
    return true;
  }
  return normalizeRelativeCardResourcePath(value) !== undefined;
}

/**
 * 校验节点内容中的 config（08 §2.4.3）：纯函数；`undefined` / `null` 视为未提供配置，
 * 必须返回 `true`。非空资源路径字段必须是合法包内相对路径（01 §6.9：不得为绝对路径、
 * 带 scheme、查询串、片段标识或 `..` 逃逸）；非空 `file_extension` 必须是小写不含点的
 * 后缀形态，属于 §7.3 允许的业务补充校验。
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (typeof config !== 'object' || Array.isArray(config)) {
    return false;
  }
  const record = config as Record<string, unknown>;
  for (const key of ['file_file', 'cover_image'] as const) {
    if (!isValidResourcePathField(record[key])) {
      return false;
    }
  }
  for (const key of ['file_name', 'file_extension'] as const) {
    if (record[key] !== undefined && typeof record[key] !== 'string') {
      return false;
    }
  }
  const fileExtension = record['file_extension'];
  if (typeof fileExtension === 'string' && fileExtension.length > 0 && !/^[a-z0-9]+$/u.test(fileExtension)) {
    // 非空 file_extension 必须是小写、不含点的后缀形态（01 §6.9）；未登记类别与 MIME
    // 的后缀仍允许存在（类别封面回退为徽标占位）。
    return false;
  }
  return true;
}

// ---------- 内容组装 ----------

/** 由配置组装节点内容（与 `createInitialContent` / 编辑器 replace 变更共用）。 */
export function buildContent(config: IFileConfig): Record<string, unknown> {
  return {
    card_type: CARD_TYPE_ID,
    config: { ...config },
  };
}

// ---------- 展示派生 ----------

/** 展示文件名：显式文件名优先，其次文件资源路径词干；均缺为空串。 */
export function deriveDisplayFileName(config: IFileConfig): string {
  if (isNonEmptyString(config.file_name)) {
    return config.file_name.trim();
  }

  return deriveFileStem(config.file_file);
}

// ---------- 资源打开请求（《14》§2.2；《01》§6.9 不传业务载荷） ----------

/** 文件卡片打开请求（《14-资源打开与默认处理器契约》§2.2 `IResourceOpenRequest` 形状）。 */
export interface IFileOpenRequest {
  readonly intent: 'view';
  readonly resource: {
    /** 资源受管引用；取内容中的引用原样透传，插件不构造作用域（06-资源协议规范 §2.3）。 */
    readonly uri: string;
    readonly mimeType?: string;
    readonly fileName: string;
    readonly title: string;
  };
}

/**
 * 组装文件卡片打开请求：资源 ID 为 `file_file` 卡片根目录相对路径，MIME 由插件按后缀
 * 内置映射表推断，不传业务载荷（01 §6.9）；平台按处理器能力与扩展名推断路由。
 *
 * `uri` 一律取内容中的引用原样透传（解析器在进入渲染前已把包内相对引用归一为受管
 * 作用域 URI，渲染层只消费归一结果，不重复归一、不构造作用域——06 §2.6、§2.3）。
 */
export function buildFileOpenRequest(config: IFileConfig): IFileOpenRequest | null {
  const uri = normalizeRelativeCardResourcePath(config.file_file);
  if (!uri) {
    return null;
  }

  const extension = config.file_extension || resolveFileExtension(config.file_file);
  const mimeType = inferFileMimeType(extension);

  return {
    intent: 'view',
    resource: {
      uri,
      ...(mimeType === undefined ? {} : { mimeType }),
      fileName: resolveFileName(config.file_file),
      title: deriveDisplayFileName(config) || '未命名文件',
    },
  };
}
