export type SortMode = "manual" | "name-asc" | "name-desc";
export type SidebarWidth = "compact" | "regular" | "wide";
export type DocumentPresentation = "content" | "cover";

export interface FrameRegionConfig {
  mode: "none" | "image" | "html";
  assetPath?: string;
  html?: string;
}

export interface DocumentTreeNodeConfig {
  id: string;
  entryId?: string;
  titleOverride?: string;
  presentation?: DocumentPresentation;
  collapsed: boolean;
  children: DocumentTreeNodeConfig[];
}

export interface LayoutConfig {
  schemaVersion: string;
  props: {
    sortMode: SortMode;
    treeNodes: DocumentTreeNodeConfig[];
    sidebarWidth: SidebarWidth;
    showSummary: boolean;
    background: FrameRegionConfig;
    topRegion: FrameRegionConfig;
  };
  assetRefs: string[];
}

export const defaultLayoutConfig: LayoutConfig = {
  schemaVersion: "1.0.0",
  props: {
    sortMode: "manual",
    treeNodes: [],
    sidebarWidth: "regular",
    showSummary: true,
    background: {
      mode: "none",
    },
    topRegion: {
      mode: "none",
    },
  },
  assetRefs: [],
};

function normalizeSortMode(value: unknown): SortMode {
  if (value === "name-asc" || value === "name-desc") {
    return value;
  }
  return "manual";
}

function normalizeSidebarWidth(value: unknown): SidebarWidth {
  if (value === "compact" || value === "wide") {
    return value;
  }
  return "regular";
}

const BOX_ASSET_PATH_PATTERN = /^assets\/[^\\:?#/]+(?:\/[^\\:?#/]+)*$/;
const MAX_TREE_DEPTH = 8;
const MAX_TREE_NODES = 500;

export function isSafeBoxAssetPath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed !== value || !BOX_ASSET_PATH_PATTERN.test(trimmed)) {
    return false;
  }
  if (trimmed.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return false;
  }

  return trimmed.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function collectFrameRegionAssetRefs(config: LayoutConfig): string[] {
  const nextAssetRefs = [
    config.props.background.mode === "image" ? config.props.background.assetPath : undefined,
    config.props.topRegion.mode === "image" ? config.props.topRegion.assetPath : undefined,
  ].filter((value): value is string =>
    typeof value === "string" && value.length > 0 && isSafeBoxAssetPath(value)
  );

  return [...new Set(nextAssetRefs)];
}

function normalizeFrameRegion(value: unknown): FrameRegionConfig {
  const raw = typeof value === "object" && value ? value as Record<string, unknown> : {};
  const mode = raw.mode === "image" || raw.mode === "html" ? raw.mode : "none";
  const rawAssetPath = typeof raw.assetPath === "string" ? raw.assetPath : "";
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
  return {
    ...config,
    assetRefs: collectFrameRegionAssetRefs(config),
  };
}

function normalizeNodeId(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().slice(0, 120);
  }
  return fallback;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 160) : undefined;
}

function normalizeTreeNodes(
  value: unknown,
  depth = 0,
  path = "node",
  counter: { count: number } = { count: 0 }
): DocumentTreeNodeConfig[] {
  if (!Array.isArray(value) || depth >= MAX_TREE_DEPTH || counter.count >= MAX_TREE_NODES) {
    return [];
  }

  const nodes: DocumentTreeNodeConfig[] = [];
  const seenIds = new Set<string>();

  value.forEach((item, index) => {
    if (counter.count >= MAX_TREE_NODES) {
      return;
    }

    const raw = typeof item === "object" && item ? item as Record<string, unknown> : {};
    const fallbackId = `${path}-${index + 1}`;
    let id = normalizeNodeId(raw.id, fallbackId);
    if (seenIds.has(id)) {
      id = `${id}-${index + 1}`;
    }
    seenIds.add(id);
    counter.count += 1;

    const entryId = normalizeOptionalText(raw.entryId);
    nodes.push({
      id,
      entryId,
      titleOverride: normalizeOptionalText(raw.titleOverride),
      presentation: entryId && raw.presentation === "cover" ? "cover" : entryId ? "content" : undefined,
      collapsed: raw.collapsed === true,
      children: normalizeTreeNodes(raw.children, depth + 1, id, counter),
    });
  });

  return nodes;
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
      treeNodes: [],
      sidebarWidth: defaultLayoutConfig.props.sidebarWidth,
      showSummary: defaultLayoutConfig.props.showSummary,
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
      treeNodes: normalizeTreeNodes(props.treeNodes),
      sidebarWidth: normalizeSidebarWidth(props.sidebarWidth),
      showSummary: typeof props.showSummary === "boolean"
        ? props.showSummary
        : defaultLayoutConfig.props.showSummary,
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
  if (!["compact", "regular", "wide"].includes(config.props.sidebarWidth)) {
    errors["props.sidebarWidth"] = "sidebarWidth is invalid.";
  }
  if (typeof config.props.showSummary !== "boolean") {
    errors["props.showSummary"] = "showSummary must be boolean.";
  }
  const nodeIds = new Set<string>();
  const visitNode = (node: DocumentTreeNodeConfig, path: string): void => {
    if (typeof node.id !== "string" || node.id.trim().length === 0) {
      errors[`${path}.id`] = "tree node id is required.";
    } else if (nodeIds.has(node.id)) {
      errors[`${path}.id`] = "tree node id must be unique.";
    } else {
      nodeIds.add(node.id);
    }
    if (node.entryId !== undefined && node.entryId.trim().length === 0) {
      errors[`${path}.entryId`] = "tree node entryId cannot be empty.";
    }
    if (node.entryId && node.presentation !== "content" && node.presentation !== "cover") {
      errors[`${path}.presentation`] = "entry tree node presentation must be content or cover.";
    }
    if (!node.entryId && node.presentation !== undefined) {
      errors[`${path}.presentation`] = "group tree node cannot define presentation.";
    }
    if (typeof node.collapsed !== "boolean") {
      errors[`${path}.collapsed`] = "tree node collapsed must be boolean.";
    }
    node.children.forEach((child, index) => {
      visitNode(child, `${path}.children[${index}]`);
    });
  };
  config.props.treeNodes.forEach((node, index) => {
    visitNode(node, `props.treeNodes[${index}]`);
  });

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

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
