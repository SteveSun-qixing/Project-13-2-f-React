import {
  isNonEmptyString,
  deriveFileStem,
  resolveFileExtension,
} from "../shared/utils";
import { normalizeExtension } from "../shared/file-types";

export interface BasecardConfig {
  card_type: "base.file";
  theme?: string;
  file_file: string;
  file_name: string;
  file_extension: string;
  cover_image: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const defaultBasecardConfig: BasecardConfig = {
  card_type: "base.file",
  theme: "",
  file_file: "",
  file_name: "",
  file_extension: "",
  cover_image: "",
};

export function isCardRootResourcePath(value: string): boolean {
  const normalized = value.trim().replace(/\\/g, "/");
  if (!normalized) {
    return false;
  }

  if (
    normalized.startsWith("/") ||
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("~") ||
    /^[a-zA-Z]:\//.test(normalized) ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized) ||
    /[?#]/.test(normalized) ||
    /[\u0000-\u001f]/.test(normalized)
  ) {
    return false;
  }

  const segments = normalized.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function normalizeResourcePath(value: unknown): string {
  if (!isNonEmptyString(value)) {
    return "";
  }

  return value.replace(/\\/g, "/").trim();
}

export function normalizeBasecardConfig(
  input: Partial<BasecardConfig> | Record<string, unknown> | null | undefined,
): BasecardConfig {
  const record = (input ?? {}) as Record<string, unknown>;
  const fileFile = normalizeResourcePath(record.file_file);
  const fileExtension = normalizeExtension(record.file_extension);

  return {
    card_type: "base.file",
    theme: typeof record.theme === "string" ? record.theme.trim() : "",
    file_file: fileFile,
    file_name: isNonEmptyString(record.file_name)
      ? record.file_name.trim()
      : deriveFileStem(fileFile),
    file_extension: fileExtension || resolveFileExtension(fileFile),
    cover_image: normalizeResourcePath(record.cover_image),
  };
}

export function collectBasecardResourcePaths(
  input: Partial<BasecardConfig> | Record<string, unknown> | null | undefined,
): string[] {
  const normalized = normalizeBasecardConfig(input);
  const paths = new Set<string>();

  [normalized.file_file, normalized.cover_image].forEach((resourcePath) => {
    if (resourcePath && isCardRootResourcePath(resourcePath)) {
      paths.add(resourcePath);
    }
  });

  return Array.from(paths);
}

export function validateBasecardConfig(config: BasecardConfig): ConfigValidationResult {
  const errors: Record<string, string> = {};

  if (config.card_type !== "base.file") {
    errors.card_type = "file.validation.card_type";
  }

  if (!isNonEmptyString(config.file_file)) {
    errors.file_file = "file.validation.file_required";
  } else if (!isCardRootResourcePath(config.file_file)) {
    errors.file_file = "file.validation.file_path_invalid";
  }

  if (config.cover_image && !isCardRootResourcePath(config.cover_image)) {
    errors.cover_image = "file.validation.cover_path_invalid";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
