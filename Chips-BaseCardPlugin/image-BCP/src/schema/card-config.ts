import {
  isNonEmptyString,
  normalizeRelativeCardResourcePath,
  validateImageUrl,
} from "../shared/utils";
import { formatMessage } from "../lib/messages";

export type ImageSourceType = "file" | "url";
export type LayoutType = "single" | "grid" | "long-scroll" | "horizontal-scroll";
export type GridMode = "2x2" | "3x3" | "3-column-infinite";
export type SingleAlignment = "left" | "center" | "right";
export type SpacingMode = "none" | "comfortable";

export interface ImageItem {
  id: string;
  source: ImageSourceType;
  file_path?: string;
  url?: string;
  alt?: string;
  title?: string;
}

export interface LayoutOptions {
  grid_mode?: GridMode;
  single_width_percent?: number;
  single_alignment?: SingleAlignment;
  spacing_mode?: SpacingMode;
}

export interface BasecardConfig {
  card_type: "ImageCard";
  theme?: string;
  images: ImageItem[];
  layout_type: LayoutType;
  layout_options?: LayoutOptions;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const defaultLayoutOptions: Required<LayoutOptions> = {
  grid_mode: "2x2",
  single_width_percent: 100,
  single_alignment: "center",
  spacing_mode: "comfortable",
};

export const defaultBasecardConfig: BasecardConfig = {
  card_type: "ImageCard",
  theme: "",
  images: [],
  layout_type: "single",
  layout_options: { ...defaultLayoutOptions },
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function asNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeImageItem(input: unknown, index: number): ImageItem {
  const record = typeof input === "object" && input ? (input as Record<string, unknown>) : {};
  const source: ImageSourceType = record.source === "url" ? "url" : "file";
  const filePath = normalizeRelativeCardResourcePath(record.file_path);
  const url = asString(record.url);

  return {
    id: asString(record.id) ?? `image-${index + 1}`,
    source,
    file_path: source === "file" ? filePath : undefined,
    url: source === "url" ? url : undefined,
    alt: asString(record.alt) ?? "",
    title: asString(record.title) ?? "",
  };
}

export function normalizeBasecardConfig(input: Record<string, unknown> | null | undefined): BasecardConfig {
  const record = input ?? {};
  const layoutOptionsInput = typeof record.layout_options === "object" && record.layout_options
    ? (record.layout_options as Record<string, unknown>)
    : {};

  const normalizedImages = Array.isArray(record.images)
    ? record.images.map((item, index) => normalizeImageItem(item, index))
    : [];

  const rawLayoutType: LayoutType =
    record.layout_type === "grid" ||
    record.layout_type === "long-scroll" ||
    record.layout_type === "horizontal-scroll" ||
    record.layout_type === "single"
      ? record.layout_type
      : defaultBasecardConfig.layout_type;
  const layoutType: LayoutType =
    normalizedImages.length > 1 && rawLayoutType === "single" ? "grid" : rawLayoutType;

  const gridMode: GridMode =
    layoutOptionsInput.grid_mode === "2x2" ||
    layoutOptionsInput.grid_mode === "3x3" ||
    layoutOptionsInput.grid_mode === "3-column-infinite"
      ? layoutOptionsInput.grid_mode
      : defaultLayoutOptions.grid_mode;

  const singleAlignment: SingleAlignment =
    layoutOptionsInput.single_alignment === "left" ||
    layoutOptionsInput.single_alignment === "center" ||
    layoutOptionsInput.single_alignment === "right"
      ? layoutOptionsInput.single_alignment
      : defaultLayoutOptions.single_alignment;
  const spacingMode: SpacingMode =
    layoutOptionsInput.spacing_mode === "none" ||
    layoutOptionsInput.spacing_mode === "comfortable"
      ? layoutOptionsInput.spacing_mode
      : layoutOptionsInput.gap === 0
        ? "none"
        : defaultLayoutOptions.spacing_mode;

  return {
    card_type: "ImageCard",
    theme: asString(record.theme) ?? defaultBasecardConfig.theme,
    images: normalizedImages,
    layout_type: layoutType,
    layout_options: {
      grid_mode: gridMode,
      single_width_percent:
        asPositiveNumber(layoutOptionsInput.single_width_percent) ?? defaultLayoutOptions.single_width_percent,
      single_alignment: singleAlignment,
      spacing_mode: spacingMode,
    },
  };
}

export function validateBasecardConfig(config: BasecardConfig): ConfigValidationResult {
  const errors: Record<string, string> = {};

  if (config.card_type !== "ImageCard") {
    errors.card_type = formatMessage("image.validation.cardType");
  }

  config.images.forEach((image, index) => {
    if (!isNonEmptyString(image.id)) {
      errors[`images.${index}.id`] = formatMessage("image.validation.imageIdRequired");
    }

    if (image.source === "file") {
      if (!isNonEmptyString(image.file_path)) {
        errors[`images.${index}.file_path`] = formatMessage("image.validation.filePathRequired");
      }
    } else if (image.source === "url") {
      if (!isNonEmptyString(image.url)) {
        errors[`images.${index}.url`] = formatMessage("image.validation.urlRequired");
      } else if (!validateImageUrl(image.url)) {
        errors[`images.${index}.url`] = formatMessage("image.validation.urlInvalid");
      }
    } else {
      errors[`images.${index}.source`] = formatMessage("image.validation.source");
    }
  });

  const layoutOptions = config.layout_options ?? defaultLayoutOptions;
  if (layoutOptions.single_width_percent && (layoutOptions.single_width_percent < 10 || layoutOptions.single_width_percent > 100)) {
    errors.layout_options_single_width_percent = formatMessage("image.validation.singleWidthPercent");
  }

  if (
    layoutOptions.spacing_mode &&
    layoutOptions.spacing_mode !== "none" &&
    layoutOptions.spacing_mode !== "comfortable"
  ) {
    errors.layout_options_spacing_mode = formatMessage("image.validation.spacingMode");
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
