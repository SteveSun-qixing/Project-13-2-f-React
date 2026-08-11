import {
  dedupeResourcePaths,
  isArchiveFormat,
  isNonEmptyString,
  isSupportedEbookFormat,
  normalizeBookFormat,
  normalizeRelativeCardResourcePath,
} from "../shared/utils";

export type BookSourceType = "ebook" | "image-sequence";
export type ImageSortBasis = "filename" | "entry-time";

export interface BookImageItem {
  id: string;
  file_path: string;
  file_name: string;
  mime_type?: string;
  sort_key?: string;
  source_entry_path?: string;
  entry_time?: number;
}

export interface BasecardConfig {
  card_type: "base.book";
  theme?: string;
  source_type: BookSourceType;
  book_file: string;
  book_format: string;
  book_name: string;
  book_author: string;
  cover_image: string;
  image_sequence: BookImageItem[];
  image_sort_basis: ImageSortBasis;
  resource_paths: string[];
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const defaultBasecardConfig: BasecardConfig = {
  card_type: "base.book",
  theme: "",
  source_type: "ebook",
  book_file: "",
  book_format: "",
  book_name: "",
  book_author: "",
  cover_image: "",
  image_sequence: [],
  image_sort_basis: "filename",
  resource_paths: [],
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeSourceType(value: unknown, images: BookImageItem[]): BookSourceType {
  if (value === "image-sequence") {
    return "image-sequence";
  }

  if (value === "ebook") {
    return "ebook";
  }

  return images.length > 0 ? "image-sequence" : "ebook";
}

function normalizeSortBasis(value: unknown): ImageSortBasis {
  return value === "entry-time" ? "entry-time" : "filename";
}

function normalizeImageItem(input: unknown, index: number): BookImageItem | null {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const filePath = normalizeRelativeCardResourcePath(record.file_path);
  if (!filePath) {
    return null;
  }

  const fileName = asString(record.file_name) || filePath.split("/").pop() || `image-${index + 1}`;

  return {
    id: asString(record.id) || `book-image-${index + 1}`,
    file_path: filePath,
    file_name: fileName,
    mime_type: asString(record.mime_type),
    sort_key: asString(record.sort_key),
    source_entry_path: asString(record.source_entry_path),
    entry_time: asOptionalNumber(record.entry_time),
  };
}

export function normalizeBasecardConfig(
  input: Partial<BasecardConfig> | Record<string, unknown> | null | undefined,
): BasecardConfig {
  const record = (input ?? {}) as Record<string, unknown>;
  const imageSequence = Array.isArray(record.image_sequence)
    ? record.image_sequence
      .map((item, index) => normalizeImageItem(item, index))
      .filter((item): item is BookImageItem => item !== null)
    : [];

  const bookFile = normalizeRelativeCardResourcePath(record.book_file) ?? "";
  const coverImage = normalizeRelativeCardResourcePath(record.cover_image) ?? "";
  const explicitResourcePaths = Array.isArray(record.resource_paths)
    ? dedupeResourcePaths(record.resource_paths)
    : [];

  const resourcePaths = dedupeResourcePaths([
    bookFile,
    coverImage,
    ...imageSequence.map((item) => item.file_path),
    ...explicitResourcePaths,
  ]);

  return {
    card_type: "base.book",
    theme: asString(record.theme),
    source_type: normalizeSourceType(record.source_type, imageSequence),
    book_file: bookFile,
    book_format: normalizeBookFormat(record.book_format),
    book_name: asString(record.book_name),
    book_author: asString(record.book_author),
    cover_image: coverImage,
    image_sequence: imageSequence,
    image_sort_basis: normalizeSortBasis(record.image_sort_basis),
    resource_paths: resourcePaths,
  };
}

export function validateBasecardConfig(config: BasecardConfig): ConfigValidationResult {
  const errors: Record<string, string> = {};

  if (config.card_type !== "base.book") {
    errors.card_type = "card_type 必须为 base.book。";
  }

  if (config.source_type !== "ebook" && config.source_type !== "image-sequence") {
    errors.source_type = "source_type 必须为 ebook 或 image-sequence。";
  }

  if (config.image_sort_basis !== "filename" && config.image_sort_basis !== "entry-time") {
    errors.image_sort_basis = "图片排序依据必须为 filename 或 entry-time。";
  }

  if (isNonEmptyString(config.book_format) && !isSupportedEbookFormat(config.book_format) && !isArchiveFormat(config.book_format)) {
    errors.book_format = "book_format 必须为受支持的电子书或图片包格式。";
  }

  if (config.source_type === "ebook" && config.book_file && !isNonEmptyString(config.book_format)) {
    errors.book_format = "电子书资源必须记录 book_format。";
  }

  if (config.source_type === "image-sequence" && config.image_sequence.length === 0 && config.book_file) {
    errors.image_sequence = "图片包卡片不能同时保留普通电子书文件。";
  }

  config.image_sequence.forEach((image, index) => {
    if (!isNonEmptyString(image.id)) {
      errors[`image_sequence.${index}.id`] = "图片 ID 不能为空。";
    }

    if (!isNonEmptyString(image.file_path)) {
      errors[`image_sequence.${index}.file_path`] = "图片资源路径不能为空。";
    }

    if (!isNonEmptyString(image.file_name)) {
      errors[`image_sequence.${index}.file_name`] = "图片文件名不能为空。";
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
