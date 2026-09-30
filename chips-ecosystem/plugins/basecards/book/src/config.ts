/**
 * 电子书基础卡片配置模型（《09-官方插件与应用目录》§4.2、《08-基础卡片插件接口》§7）。
 *
 * 配置位于节点内容 `config` 字段；本模块提供归一（readConfig）、校验（validateConfig，
 * 与 `assets/schemas/book-card-config.schema.json` 同一口径：出现即校验，不宽于 schema）、
 * 派生展示信息（deriveDisplayTitle / deriveDisplayAuthor / formatBookFormatLabel）、
 * 资源打开请求组装（buildBookOpenRequest，《14-资源打开与默认处理器契约》§5.4 权威载荷形状）。
 *
 * 字段级重构说明（相对旧族）：`theme` 随主题系统废弃（task030）裁撤；`resource_paths`
 * 由 collectResourcePaths 派生、不再持久化；`sort_key` 为旧仓只写不读的死字段，裁撤。
 */

import {
  inferBookMimeType,
  inferImageMimeTypeFromPath,
  isArchiveFormat,
  isNonEmptyString,
  isSupportedEbookFormat,
  normalizeBookFormat,
  normalizeRelativeCardResourcePath,
  resolveFileName,
  sortImageItems,
  stripFileExtension,
} from './shared/utils';
import type { ImageSortBasis } from './shared/utils';

/** 卡片类型正式 ID（与 manifest capabilities.cardTypes[0].id 一致；历史别名 BookCard 由平台归一）。 */
export const CARD_TYPE_ID = 'base.book';

/** 内容来源形态：电子书文件或解包图片序列（《14》§5.4 mode 二值）。 */
export type BookSourceType = 'ebook' | 'image-sequence';

/** 图片序列条目（`source_entry_path` / `entry_time` 由导入臂回填，用于排序与溯源）。 */
export interface IBookImageItem {
  id: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  source_entry_path: string;
  entry_time?: number | undefined;
}

/** 电子书卡片配置。 */
export interface IBookConfig {
  source_type: BookSourceType;
  book_file: string;
  book_format: string;
  book_name: string;
  book_author: string;
  cover_image: string;
  image_sequence: IBookImageItem[];
  image_sort_basis: ImageSortBasis;
}

export const DEFAULT_CONFIG: IBookConfig = {
  source_type: 'ebook',
  book_file: '',
  book_format: '',
  book_name: '',
  book_author: '',
  cover_image: '',
  image_sequence: [],
  image_sort_basis: 'filename',
};

// ---------- 归一 ----------

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeSourceType(value: unknown, imageCount: number): BookSourceType {
  if (value === 'image-sequence') {
    return 'image-sequence';
  }

  if (value === 'ebook') {
    return 'ebook';
  }

  return imageCount > 0 ? 'image-sequence' : 'ebook';
}

function normalizeSortBasis(value: unknown): ImageSortBasis {
  return value === 'entry-time' ? 'entry-time' : 'filename';
}

/**
 * 归一图片序列条目：路径非法且无显式形状（id / file_name / source_entry_path / entry_time）
 * 的条目剔除；`id` 缺失按位次补 `book-image-<n>`，文件名缺失从路径派生。
 * 保留带显式形状但路径为空的条目（编辑器「添加图片」的中间态），由校验拦住回流。
 */
function normalizeImageItem(input: unknown, index: number): IBookImageItem | null {
  const record = input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const filePath = normalizeRelativeCardResourcePath(record['file_path']) ?? '';
  const hasExplicitShape =
    typeof record['id'] === 'string' ||
    typeof record['file_name'] === 'string' ||
    typeof record['source_entry_path'] === 'string' ||
    typeof record['entry_time'] === 'number';

  if (!filePath && !hasExplicitShape) {
    return null;
  }

  return {
    id: asString(record['id']) || `book-image-${index + 1}`,
    file_path: filePath,
    file_name: asString(record['file_name']) || resolveFileName(filePath) || `image-${index + 1}`,
    mime_type: asString(record['mime_type']),
    source_entry_path: asString(record['source_entry_path']),
    entry_time: asOptionalNumber(record['entry_time']),
  };
}

/** 归一任意输入为完整配置：缺失或非法字段回退默认值（08 §7.1 规则 2）。 */
export function readConfig(input: unknown): IBookConfig {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const imageSequence = Array.isArray(record['image_sequence'])
    ? record['image_sequence']
        .map((item, index) => normalizeImageItem(item, index))
        .filter((item): item is IBookImageItem => item !== null)
    : [];

  return {
    source_type: normalizeSourceType(record['source_type'], imageSequence.length),
    book_file: normalizeRelativeCardResourcePath(record['book_file']) ?? '',
    book_format: normalizeBookFormat(record['book_format']),
    book_name: asString(record['book_name']),
    book_author: asString(record['book_author']),
    cover_image: normalizeRelativeCardResourcePath(record['cover_image']) ?? '',
    image_sequence: imageSequence,
    image_sort_basis: normalizeSortBasis(record['image_sort_basis']),
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
 * 必须返回 `true`。业务补充校验（§7.3 允许）：非空 `book_format` 必须是受支持格式；
 * ebook 且书籍文件已填时必须记录格式；image-sequence 不能同时保留普通电子书文件；
 * 图片条目必须携带合法非空路径。
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (typeof config !== 'object' || Array.isArray(config)) {
    return false;
  }
  const record = config as Record<string, unknown>;

  const sourceType = record['source_type'];
  if (sourceType !== undefined && sourceType !== 'ebook' && sourceType !== 'image-sequence') {
    return false;
  }

  const sortBasis = record['image_sort_basis'];
  if (sortBasis !== undefined && sortBasis !== 'filename' && sortBasis !== 'entry-time') {
    return false;
  }

  for (const key of ['book_file', 'cover_image'] as const) {
    if (!isValidResourcePathField(record[key])) {
      return false;
    }
  }

  for (const key of ['book_format', 'book_name', 'book_author'] as const) {
    if (record[key] !== undefined && typeof record[key] !== 'string') {
      return false;
    }
  }

  const bookFormat = record['book_format'];
  if (typeof bookFormat === 'string' && bookFormat.trim().length > 0) {
    const normalized = normalizeBookFormat(bookFormat);
    if (!isSupportedEbookFormat(normalized) && !isArchiveFormat(normalized)) {
      return false;
    }
  }

  const bookFile = record['book_file'];
  const hasBookFile = typeof bookFile === 'string' && bookFile.trim().length > 0;
  if (sourceType === 'ebook' && hasBookFile && !(typeof bookFormat === 'string' && bookFormat.trim().length > 0)) {
    return false;
  }

  const imageSequence = record['image_sequence'];
  let imageCount = 0;
  if (imageSequence !== undefined) {
    if (!Array.isArray(imageSequence)) {
      return false;
    }
    for (const item of imageSequence) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return false;
      }
      const itemRecord = item as Record<string, unknown>;
      for (const key of ['id', 'file_name', 'mime_type', 'source_entry_path'] as const) {
        if (itemRecord[key] !== undefined && typeof itemRecord[key] !== 'string') {
          return false;
        }
      }
      const entryTime = itemRecord['entry_time'];
      if (entryTime !== undefined && (typeof entryTime !== 'number' || !Number.isFinite(entryTime))) {
        return false;
      }
      const itemPath = itemRecord['file_path'];
      if (
        itemPath === undefined ||
        typeof itemPath !== 'string' ||
        normalizeRelativeCardResourcePath(itemPath) === undefined
      ) {
        return false;
      }
      imageCount += 1;
    }
  }

  if (sourceType === 'image-sequence' && imageCount === 0 && hasBookFile) {
    return false;
  }

  return true;
}

// ---------- 内容组装 ----------

/** 由配置组装节点内容（与 `createInitialContent` / 编辑器 replace 变更共用）。 */
export function buildContent(config: IBookConfig): Record<string, unknown> {
  return {
    card_type: CARD_TYPE_ID,
    config: { ...config },
  };
}

// ---------- 展示派生 ----------

/** 展示标题：书名优先，其次书籍文件名去扩展名。 */
export function deriveDisplayTitle(config: IBookConfig): string {
  if (isNonEmptyString(config.book_name)) {
    return config.book_name.trim();
  }

  const bookFileName = resolveFileName(config.book_file);
  if (bookFileName) {
    return stripFileExtension(bookFileName);
  }

  return '';
}

/** 展示作者：留空回退空串（查看态再落「未知作者」文案）。 */
export function deriveDisplayAuthor(config: IBookConfig): string {
  return isNonEmptyString(config.book_author) ? config.book_author.trim() : '';
}

/** 格式标签：图片包区分 ZIP/CBZ，电子书格式大写展示。 */
export function formatBookFormatLabel(config: IBookConfig): string {
  if (config.source_type === 'image-sequence') {
    return config.book_format === 'cbz' ? 'CBZ' : 'ZIP';
  }

  return config.book_format ? config.book_format.toUpperCase() : '';
}

// ---------- 资源打开请求（《14》§5.4） ----------

/** 书籍卡片打开载荷的资源条目。 */
export interface IBookOpenPayloadResource {
  /** 资源受管引用；取内容中的引用原样透传，插件不构造作用域（06-资源协议规范 §2.3）。 */
  readonly uri: string;
  /** 发起方视角相对路径；只用于日志与展示，不用于读取（14 §5）。 */
  readonly relativePath: string;
  readonly fileName?: string;
  readonly mimeType?: string;
}

/** 书籍卡片打开载荷（《14-资源打开与默认处理器契约》§5.4 权威形状）。 */
export interface IBookOpenPayload {
  readonly kind: 'chips.book-card';
  readonly version: '1.0.0';
  readonly cardType: 'base.book';
  readonly mode: BookSourceType;
  readonly resources: {
    readonly book?: IBookOpenPayloadResource;
    readonly images?: readonly IBookOpenPayloadResource[];
  };
  readonly display: {
    readonly title: string;
    readonly author?: string;
  };
}

/** `resource:open` 能力输入（《14》§2.2）。 */
export interface IBookOpenRequest {
  readonly intent: 'view';
  readonly resource: {
    readonly uri: string;
    readonly mimeType?: string;
    readonly fileName?: string;
    readonly title: string;
    readonly payload: IBookOpenPayload;
  };
}

function buildPayloadResource(
  resourcePath: string,
  mimeType?: string
): IBookOpenPayloadResource | null {
  const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);
  if (!normalizedPath) {
    return null;
  }

  const fileName = resolveFileName(normalizedPath);
  const resolvedMimeType = mimeType || undefined;
  return {
    uri: normalizedPath,
    relativePath: normalizedPath,
    fileName,
    ...(resolvedMimeType === undefined ? {} : { mimeType: resolvedMimeType }),
  };
}

/**
 * 组装书籍卡片打开请求：ebook 臂主资源为 `book_file`；image-sequence 臂主资源为排序后
 * 序列首项（14 §5.4：主资源必须是序列首项），全组图片按序随载荷投递；无主资源返回 `null`。
 *
 * `uri` 一律取内容中的引用原样透传（解析器在进入渲染前已把包内相对引用归一为受管
 * 作用域 URI，渲染层只消费归一结果，不重复归一、不构造作用域——06 §2.6、§2.3）。
 */
export function buildBookOpenRequest(config: IBookConfig): IBookOpenRequest | null {
  const title = deriveDisplayTitle(config);
  const author = deriveDisplayAuthor(config);

  if (config.source_type === 'image-sequence') {
    const images = sortImageItems(config.image_sequence, config.image_sort_basis)
      .map((image) =>
        buildPayloadResource(image.file_path, image.mime_type || inferImageMimeTypeFromPath(image.file_path))
      )
      .filter((item): item is IBookOpenPayloadResource => item !== null);
    const primary = images[0];
    if (!primary) {
      return null;
    }

    const payload: IBookOpenPayload = {
      kind: 'chips.book-card',
      version: '1.0.0',
      cardType: CARD_TYPE_ID,
      mode: 'image-sequence',
      resources: { images },
      display: {
        title,
        ...(author.length === 0 ? {} : { author }),
      },
    };

    return {
      intent: 'view',
      resource: {
        uri: primary.uri,
        ...(primary.mimeType === undefined ? {} : { mimeType: primary.mimeType }),
        ...(primary.fileName === undefined ? {} : { fileName: primary.fileName }),
        title,
        payload,
      },
    };
  }

  const book = buildPayloadResource(
    config.book_file,
    inferBookMimeType(config.book_format || config.book_file)
  );
  if (!book) {
    return null;
  }

  const payload: IBookOpenPayload = {
    kind: 'chips.book-card',
    version: '1.0.0',
    cardType: CARD_TYPE_ID,
    mode: 'ebook',
    resources: { book },
    display: {
      title,
      ...(author.length === 0 ? {} : { author }),
    },
  };

  return {
    intent: 'view',
    resource: {
      uri: book.uri,
      ...(book.mimeType === undefined ? {} : { mimeType: book.mimeType }),
      ...(book.fileName === undefined ? {} : { fileName: book.fileName }),
      title,
      payload,
    },
  };
}
