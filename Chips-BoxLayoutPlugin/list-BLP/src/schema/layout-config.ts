export type SortMode = "manual" | "name-asc" | "name-desc";
export type RowDensity = "compact" | "comfortable" | "spacious";
export type CoverSize = "compact" | "regular" | "large";
export type VisibleFieldKey = "createdAt" | "summary" | "tags" | "type";
export type GroupMode = "none" | "type" | "tag";

export interface FrameRegionConfig {
  mode: "none" | "image" | "html";
  assetPath?: string;
  html?: string;
}

export interface LayoutConfig {
  schemaVersion: string;
  props: {
    sortMode: SortMode;
    rowDensity: RowDensity;
    coverSize: CoverSize;
    visibleFields: VisibleFieldKey[];
    groupMode: GroupMode;
    pageSize: number;
    background: FrameRegionConfig;
    topRegion: FrameRegionConfig;
  };
  assetRefs: string[];
}

export const defaultLayoutConfig: LayoutConfig = {
  schemaVersion: "1.0.0",
  props: {
    sortMode: "manual",
    rowDensity: "comfortable",
    coverSize: "regular",
    visibleFields: ["createdAt"],
    groupMode: "none",
    pageSize: 120,
    background: {
      mode: "none",
    },
    topRegion: {
      mode: "none",
    },
  },
  assetRefs: [],
};

export const visibleFieldKeys: VisibleFieldKey[] = ["createdAt", "summary", "tags", "type"];

function normalizeSortMode(value: unknown): SortMode {
  if (value === "name-asc" || value === "name-desc") {
    return value;
  }
  return "manual";
}

function normalizeRowDensity(value: unknown): RowDensity {
  if (value === "compact" || value === "spacious") {
    return value;
  }
  return "comfortable";
}

function normalizeCoverSize(value: unknown): CoverSize {
  if (value === "compact" || value === "large") {
    return value;
  }
  return "regular";
}

function normalizeGroupMode(value: unknown): GroupMode {
  if (value === "type" || value === "tag") {
    return value;
  }
  return "none";
}

function normalizePageSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultLayoutConfig.props.pageSize;
  }

  return Math.min(240, Math.max(20, Math.round(value)));
}

function normalizeVisibleFields(value: unknown): VisibleFieldKey[] {
  if (!Array.isArray(value)) {
    return [...defaultLayoutConfig.props.visibleFields];
  }

  const fields = value.filter((item): item is VisibleFieldKey => (
    item === "createdAt" || item === "summary" || item === "tags" || item === "type"
  ));

  return fields.length > 0 ? [...new Set(fields)] : [...defaultLayoutConfig.props.visibleFields];
}

export function isSafeBoxAssetPath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed !== value || !trimmed.startsWith("assets/")) {
    return false;
  }
  if (
    trimmed.startsWith("/")
    || trimmed.includes("\\")
    || trimmed.includes("?")
    || trimmed.includes("#")
    || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
  ) {
    return false;
  }

  return trimmed.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function normalizeFrameRegion(value: unknown): FrameRegionConfig {
  const raw = typeof value === "object" && value ? value as Record<string, unknown> : {};
  const mode = raw.mode === "image" || raw.mode === "html" ? raw.mode : "none";
  const rawAssetPath = typeof raw.assetPath === "string" ? raw.assetPath.trim() : "";
  const assetPath = rawAssetPath.length > 0 && isSafeBoxAssetPath(rawAssetPath) ? rawAssetPath : undefined;
  const html = typeof raw.html === "string" && raw.html.trim().length > 0
    ? raw.html
    : undefined;

  if (mode === "image" && assetPath) {
    return {
      mode: "image",
      assetPath,
    };
  }

  if (mode === "image") {
    return {
      mode: "image",
    };
  }

  if (mode === "html" && html) {
    return {
      mode: "html",
      html,
    };
  }

  if (mode === "html") {
    return {
      mode: "html",
      html: typeof raw.html === "string" ? raw.html : "",
    };
  }

  return {
    mode: "none",
  };
}

function syncAssetRefs(config: LayoutConfig): LayoutConfig {
  const nextAssetRefs = [
    config.props.background.mode === "image" ? config.props.background.assetPath : undefined,
    config.props.topRegion.mode === "image" ? config.props.topRegion.assetPath : undefined,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  return {
    ...config,
    assetRefs: [...new Set(nextAssetRefs)],
  };
}

export function hasFrameRegionContent(region: FrameRegionConfig): boolean {
  if (region.mode === "image") {
    return typeof region.assetPath === "string" && region.assetPath.trim().length > 0;
  }

  if (region.mode === "html") {
    return typeof region.html === "string" && region.html.trim().length > 0;
  }

  return false;
}

export function createDefaultLayoutConfig(): LayoutConfig {
  return {
    schemaVersion: defaultLayoutConfig.schemaVersion,
    props: {
      sortMode: defaultLayoutConfig.props.sortMode,
      rowDensity: defaultLayoutConfig.props.rowDensity,
      coverSize: defaultLayoutConfig.props.coverSize,
      visibleFields: [...defaultLayoutConfig.props.visibleFields],
      groupMode: defaultLayoutConfig.props.groupMode,
      pageSize: defaultLayoutConfig.props.pageSize,
      background: { ...defaultLayoutConfig.props.background },
      topRegion: { ...defaultLayoutConfig.props.topRegion },
    },
    assetRefs: [],
  };
}

export function normalizeLayoutConfig(input: LayoutConfig | Record<string, unknown> | undefined): LayoutConfig {
  const props = typeof input?.props === "object" && input?.props ? input.props as Record<string, unknown> : {};

  return syncAssetRefs({
    schemaVersion:
      typeof input?.schemaVersion === "string" && input.schemaVersion.trim().length > 0
        ? input.schemaVersion
        : defaultLayoutConfig.schemaVersion,
    props: {
      sortMode: normalizeSortMode(props.sortMode),
      rowDensity: normalizeRowDensity(props.rowDensity),
      coverSize: normalizeCoverSize(props.coverSize),
      visibleFields: normalizeVisibleFields(props.visibleFields),
      groupMode: normalizeGroupMode(props.groupMode),
      pageSize: normalizePageSize(props.pageSize),
      background: normalizeFrameRegion(props.background),
      topRegion: normalizeFrameRegion(props.topRegion),
    },
    assetRefs: Array.isArray(input?.assetRefs)
      ? input.assetRefs.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
  });
}

export function validateLayoutConfig(config: LayoutConfig): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!["manual", "name-asc", "name-desc"].includes(config.props.sortMode)) {
    errors["props.sortMode"] = "sortMode is invalid.";
  }
  if (!["compact", "comfortable", "spacious"].includes(config.props.rowDensity)) {
    errors["props.rowDensity"] = "rowDensity is invalid.";
  }
  if (!["compact", "regular", "large"].includes(config.props.coverSize)) {
    errors["props.coverSize"] = "coverSize is invalid.";
  }
  if (!["none", "type", "tag"].includes(config.props.groupMode)) {
    errors["props.groupMode"] = "groupMode is invalid.";
  }
  if (!Number.isInteger(config.props.pageSize) || config.props.pageSize < 20 || config.props.pageSize > 240) {
    errors["props.pageSize"] = "pageSize must be an integer between 20 and 240.";
  }
  if (
    config.props.visibleFields.length === 0
    || config.props.visibleFields.some((field) => !visibleFieldKeys.includes(field))
  ) {
    errors["props.visibleFields"] = "visibleFields must contain supported field keys.";
  }

  const backgroundAssetPath = config.props.background.assetPath;
  if (config.props.background.mode === "image") {
    if (!backgroundAssetPath) {
      errors["props.background.assetPath"] = "background assetPath is required when mode is image.";
    } else if (!isSafeBoxAssetPath(backgroundAssetPath)) {
      errors["props.background.assetPath"] = "background assetPath must be a box assets/ relative path.";
    }
  }
  if (config.props.background.mode === "html" && !config.props.background.html) {
    errors["props.background.html"] = "background html is required when mode is html.";
  }
  const topRegionAssetPath = config.props.topRegion.assetPath;
  if (config.props.topRegion.mode === "image") {
    if (!topRegionAssetPath) {
      errors["props.topRegion.assetPath"] = "topRegion assetPath is required when mode is image.";
    } else if (!isSafeBoxAssetPath(topRegionAssetPath)) {
      errors["props.topRegion.assetPath"] = "topRegion assetPath must be a box assets/ relative path.";
    }
  }
  if (config.props.topRegion.mode === "html" && !config.props.topRegion.html) {
    errors["props.topRegion.html"] = "topRegion html is required when mode is html.";
  }

  config.assetRefs.forEach((assetPath, index) => {
    if (!isSafeBoxAssetPath(assetPath)) {
      errors[`assetRefs[${index}]`] = "assetRefs item must be a box assets/ relative path.";
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateLayoutConfigInput(input: LayoutConfig | Record<string, unknown> | undefined): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const normalized = normalizeLayoutConfig(input);
  const result = validateLayoutConfig(normalized);
  const errors = { ...result.errors };

  if (Array.isArray(input?.assetRefs)) {
    input.assetRefs.forEach((assetRef, index) => {
      if (typeof assetRef !== "string" || !isSafeBoxAssetPath(assetRef)) {
        errors[`assetRefs[${index}]`] = "assetRefs item must be a box assets/ relative path.";
      }
    });
  }

  const rawProps = typeof input?.props === "object" && input.props
    ? input.props as Record<string, unknown>
    : {};
  for (const key of ["background", "topRegion"] as const) {
    const rawRegion = typeof rawProps[key] === "object" && rawProps[key]
      ? rawProps[key] as Record<string, unknown>
      : {};
    const rawAssetPath = rawRegion.assetPath;
    if (typeof rawAssetPath === "string" && rawAssetPath.length > 0 && !isSafeBoxAssetPath(rawAssetPath)) {
      errors[`props.${key}.assetPath`] = `${key} assetPath must be a box assets/ relative path.`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
