import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyHint, EmbeddedDocumentFrame, LayoutSkeleton, SkeletonBlock, SkeletonLine } from "@chips/ui";
import {
  hasFrameRegionContent,
  type DocumentTreeNodeConfig,
  type FrameRegionConfig,
  type LayoutConfig,
} from "../schema/layout-config";
import type {
  BoxEntryCoverView,
  BoxEntryPage,
  BoxEntrySnapshot,
  BoxLayoutRuntime,
  ResolvedRuntimeResource,
} from "../shared/types";
import { formatMessage } from "../lib/messages";

const PAGE_LIMIT = 240;

export interface LayoutViewProps {
  initialView: BoxEntryPage;
  config: LayoutConfig;
  runtime: BoxLayoutRuntime;
}

interface CoverState {
  status: "idle" | "loading" | "ready" | "error";
  view?: BoxEntryCoverView;
}

interface FrameRegionState {
  status: "idle" | "loading" | "ready" | "error";
  resource?: ResolvedRuntimeResource;
}

interface TreeDisplayNode {
  id: string;
  entryId?: string;
  title: string;
  depth: number;
  collapsed: boolean;
  configured: boolean;
  missing: boolean;
  entry?: BoxEntrySnapshot;
  children: TreeDisplayNode[];
}

const DOCUMENT_LIBRARY_STYLE = `
[data-scope="chips-document-library-layout"] {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  box-sizing: border-box;
  color: #1d1d1f;
  background-color: #ffffff;
}

[data-scope="chips-document-library-layout"] * {
  box-sizing: border-box;
}

[data-scope="chips-document-library-layout"] [data-layout-background] {
  position: sticky;
  top: 0;
  width: 100%;
  block-size: 100vh;
  margin-block-end: -100vh;
  pointer-events: none;
}

[data-scope="chips-document-library-layout"] [data-layout-shell] {
  position: relative;
  display: grid;
  gap: 16px;
  padding: 16px;
  min-width: 0;
  min-height: 100%;
}

[data-scope="chips-document-library-layout"] [data-layout-top-region] {
  min-width: 0;
  min-block-size: clamp(132px, 24vw, 288px);
  border-radius: 12px;
  overflow: hidden;
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

[data-scope="chips-document-library-layout"] [data-frame-region],
[data-scope="chips-document-library-layout"] [data-frame-region] .chips-embedded-document-frame,
[data-scope="chips-document-library-layout"] [data-frame-region] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-document-library-layout"] [data-frame-region-image] {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

[data-scope="chips-document-library-layout"] [data-document-library-main] {
  display: grid;
  grid-template-columns: minmax(0, var(--document-library-sidebar-width, 280px)) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  min-width: 0;
}

[data-scope="chips-document-library-layout"] [data-document-library-main][data-sidebar-width="compact"] {
  --document-library-sidebar-width: 220px;
}

[data-scope="chips-document-library-layout"] [data-document-library-main][data-sidebar-width="regular"] {
  --document-library-sidebar-width: 280px;
}

[data-scope="chips-document-library-layout"] [data-document-library-main][data-sidebar-width="wide"] {
  --document-library-sidebar-width: 360px;
}

[data-scope="chips-document-library-layout"] [data-document-tree],
[data-scope="chips-document-library-layout"] [data-document-preview],
[data-scope="chips-document-library-layout"] [data-frame-region-status],
[data-scope="chips-document-library-layout"] [data-layout-page-error] {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background-color: #ffffff;
}

[data-scope="chips-document-library-layout"] [data-document-tree] {
  position: sticky;
  top: 16px;
  display: grid;
  gap: 8px;
  min-width: 0;
  max-height: calc(100vh - 64px);
  overflow: auto;
  padding: 12px;
}

[data-scope="chips-document-library-layout"] [data-document-tree-list] {
  display: grid;
  gap: 4px;
  min-width: 0;
}

[data-scope="chips-document-library-layout"] [data-document-tree-row] {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  min-width: 0;
  border-radius: 8px;
}

[data-scope="chips-document-library-layout"] [data-document-tree-row][data-active="true"] {
  background-color: #f2f2f7;
}

[data-scope="chips-document-library-layout"] [data-document-tree-toggle],
[data-scope="chips-document-library-layout"] [data-document-tree-title],
[data-scope="chips-document-library-layout"] [data-document-cover-button],
[data-scope="chips-document-library-layout"] [data-document-open-button],
[data-scope="chips-document-library-layout"] [data-layout-load-more],
[data-scope="chips-document-library-layout"] [data-layout-retry] {
  border: none;
  margin: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

[data-scope="chips-document-library-layout"] [data-document-tree-toggle] {
  inline-size: 28px;
  block-size: 28px;
  display: grid;
  place-items: center;
  color: #6e6e73;
}

[data-scope="chips-document-library-layout"] [data-document-tree-title] {
  display: block;
  min-width: 0;
  padding: 4px 8px;
  text-align: start;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-scope="chips-document-library-layout"] [data-document-tree-row][data-missing="true"] [data-document-tree-title] {
  color: #6e6e73;
  font-style: italic;
}

[data-scope="chips-document-library-layout"] [data-document-preview] {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 16px;
}

[data-scope="chips-document-library-layout"] [data-document-cover-shell] {
  width: min(100%, 520px);
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background-color: #ffffff;
  cursor: pointer;
}

[data-scope="chips-document-library-layout"] [data-document-cover-shell] .chips-embedded-document-frame {
  display: block;
  width: 100%;
  height: 100%;
}

[data-scope="chips-document-library-layout"] [data-document-cover-shell] iframe {
  width: 100%;
  height: 100%;
  border: none;
  pointer-events: none;
}

[data-scope="chips-document-library-layout"] [data-document-cover-placeholder] {
  width: 100%;
  min-height: 220px;
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 16px;
  color: #6e6e73;
  text-align: center;
}

[data-scope="chips-document-library-layout"] [data-document-title] {
  margin: 0;
  color: #1d1d1f;
  font-size: 24px;
  line-height: 1.25;
  font-weight: 700;
}

[data-scope="chips-document-library-layout"] [data-document-summary],
[data-scope="chips-document-library-layout"] [data-document-meta] {
  margin: 0;
  color: #6e6e73;
  line-height: 1.5;
}

[data-scope="chips-document-library-layout"] [data-document-tags] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

[data-scope="chips-document-library-layout"] [data-document-tag] {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: #f2f2f7;
  color: #6e6e73;
  font-size: 12px;
}

[data-scope="chips-document-library-layout"] [data-document-open-button],
[data-scope="chips-document-library-layout"] [data-layout-load-more],
[data-scope="chips-document-library-layout"] [data-layout-retry] {
  justify-self: start;
  min-block-size: 40px;
  padding-inline: 16px;
  padding-block: 8px;
  border-radius: 12px;
  background-color: #ffffff;
  color: #1d1d1f;
}

[data-scope="chips-document-library-layout"] [data-layout-footer] {
  display: flex;
  justify-content: center;
  min-width: 0;
}

[data-scope="chips-document-library-layout"] [data-layout-page-error],
[data-scope="chips-document-library-layout"] [data-frame-region-status] {
  display: grid;
  place-items: center;
  gap: 4px;
  min-height: 160px;
  padding: 16px;
  color: #6e6e73;
  text-align: center;
}

[data-scope="chips-document-library-layout"] [data-document-tree-toggle]:focus-visible,
[data-scope="chips-document-library-layout"] [data-document-tree-title]:focus-visible,
[data-scope="chips-document-library-layout"] [data-document-cover-button]:focus-visible,
[data-scope="chips-document-library-layout"] [data-document-open-button]:focus-visible,
[data-scope="chips-document-library-layout"] [data-layout-load-more]:focus-visible,
[data-scope="chips-document-library-layout"] [data-layout-retry]:focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}

@media (max-width: 720px) {
  [data-scope="chips-document-library-layout"] [data-document-library-main] {
    grid-template-columns: minmax(0, 1fr);
  }

  [data-scope="chips-document-library-layout"] [data-document-tree] {
    position: relative;
    top: auto;
    max-height: none;
  }
}
`;

function resolveEntryTitle(entry: BoxEntrySnapshot): string {
  return entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
}

function resolveEntryKindMessage(entry: BoxEntrySnapshot): string {
  if (entry.snapshot.contentType === "chips/box") {
    return formatMessage("layout.entry_type_box");
  }
  return formatMessage("layout.entry_type_card");
}

function resolveTags(entry: BoxEntrySnapshot): string[] {
  return (entry.snapshot.tags ?? [])
    .map((tag) => Array.isArray(tag) ? tag.join(" / ") : tag)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function toCssAspectRatio(value: string | number | undefined, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${value}`;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.includes(":") ? value.trim().replace(":", " / ") : value.trim();
  }
  return fallback.includes(":") ? fallback.replace(":", " / ") : fallback;
}

function toRatioToken(value: string | number | undefined, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${value}`;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

function compareTitles(left: string, right: string): number {
  return left.localeCompare(right, "zh-CN");
}

function sortTreeNodes(
  nodes: TreeDisplayNode[],
  sortMode: LayoutConfig["props"]["sortMode"],
): TreeDisplayNode[] {
  const next = nodes.map((node) => ({
    ...node,
    children: sortTreeNodes(node.children, sortMode),
  }));
  if (sortMode === "manual") {
    return next;
  }
  const direction = sortMode === "name-desc" ? -1 : 1;
  return next.sort((left, right) => {
    const compared = compareTitles(left.title, right.title);
    return compared === 0 ? left.id.localeCompare(right.id) : compared * direction;
  });
}

function appendUniqueEntries(current: BoxEntrySnapshot[], incoming: BoxEntrySnapshot[]): BoxEntrySnapshot[] {
  const seen = new Set(current.map((entry) => entry.entryId));
  const next = [...current];
  for (const entry of incoming) {
    if (!seen.has(entry.entryId)) {
      seen.add(entry.entryId);
      next.push(entry);
    }
  }
  return next;
}

function collectConfiguredEntryIds(nodes: DocumentTreeNodeConfig[], output = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.entryId) {
      output.add(node.entryId);
    }
    collectConfiguredEntryIds(node.children, output);
  }
  return output;
}

function buildTreeNodes({
  configNodes,
  entries,
  sortMode,
}: {
  configNodes: DocumentTreeNodeConfig[];
  entries: BoxEntrySnapshot[];
  sortMode: LayoutConfig["props"]["sortMode"];
}): TreeDisplayNode[] {
  const entryMap = new Map(entries.map((entry) => [entry.entryId, entry]));
  const configuredEntryIds = collectConfiguredEntryIds(configNodes);

  const mapConfigNode = (node: DocumentTreeNodeConfig, depth: number): TreeDisplayNode => {
    const entry = node.entryId ? entryMap.get(node.entryId) : undefined;
    const fallbackTitle = entry ? resolveEntryTitle(entry) : formatMessage("layout.missing_entry");
    return {
      id: node.id,
      entryId: node.entryId,
      title: node.titleOverride ?? fallbackTitle,
      depth,
      collapsed: node.collapsed,
      configured: true,
      missing: Boolean(node.entryId && !entry),
      entry,
      children: node.children.map((child) => mapConfigNode(child, depth + 1)),
    };
  };

  const configuredNodes = configNodes.map((node) => mapConfigNode(node, 0));
  const unconfiguredNodes = entries
    .filter((entry) => entry.enabled && !configuredEntryIds.has(entry.entryId))
    .map((entry): TreeDisplayNode => ({
      id: `unconfigured-${entry.entryId}`,
      entryId: entry.entryId,
      title: resolveEntryTitle(entry),
      depth: 0,
      collapsed: false,
      configured: false,
      missing: false,
      entry,
      children: [],
    }));

  return sortTreeNodes([...configuredNodes, ...unconfiguredNodes], sortMode);
}

function flattenVisibleTree(nodes: TreeDisplayNode[]): TreeDisplayNode[] {
  const flattened: TreeDisplayNode[] = [];
  const visit = (node: TreeDisplayNode): void => {
    flattened.push(node);
    if (!node.collapsed) {
      node.children.forEach(visit);
    }
  };
  nodes.forEach(visit);
  return flattened;
}

function FrameRegionSurface({
  region,
  runtime,
  title,
  ratio,
  decorative = false,
}: {
  region: FrameRegionConfig;
  runtime: BoxLayoutRuntime;
  title: string;
  ratio: string;
  decorative?: boolean;
}) {
  const [state, setState] = useState<FrameRegionState>({ status: "idle" });

  useEffect(() => {
    if (region.mode !== "image" || !region.assetPath) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    void runtime.readBoxAsset(region.assetPath).then((resource) => {
      if (!cancelled) {
        setState({ status: "ready", resource });
      }
    }).catch(() => {
      if (!cancelled) {
        setState({ status: "error" });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [region.assetPath, region.mode, runtime]);

  if (region.mode === "html") {
    return (
      <div data-frame-region>
        <EmbeddedDocumentFrame
          title={title}
          srcDoc={region.html ?? ""}
          ratio={ratio}
          sandbox="allow-scripts"
        />
      </div>
    );
  }

  if (region.mode !== "image") {
    return null;
  }

  if (state.status === "ready" && state.resource?.resourceUrl) {
    return (
      <div data-frame-region>
        <img data-frame-region-image src={state.resource.resourceUrl} alt={decorative ? "" : title} />
      </div>
    );
  }

  const message = state.status === "loading"
    ? formatMessage("layout.asset_loading")
    : formatMessage("layout.asset_error");

  return (
    <div data-frame-region-status role={decorative ? undefined : "status"}>
      {message}
    </div>
  );
}

function CoverPreview({
  entry,
  runtime,
}: {
  entry: BoxEntrySnapshot;
  runtime: BoxLayoutRuntime;
}) {
  const [coverState, setCoverState] = useState<CoverState>(() => ({
    status: entry.snapshot.cover?.mode === "none" ? "idle" : "loading",
  }));

  useEffect(() => {
    if (entry.snapshot.cover?.mode === "none") {
      setCoverState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setCoverState({ status: "loading" });
    void runtime.renderEntryCover(entry.entryId).then((view) => {
      if (!cancelled) {
        setCoverState({ status: "ready", view });
      }
    }).catch(() => {
      if (!cancelled) {
        setCoverState({ status: "error" });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [entry.entryId, entry.snapshot.cover?.mode, runtime]);

  const openEntry = () => {
    void runtime.openEntry(entry.entryId);
  };
  const fallbackRatio = "3:4";
  const aspectRatio = toCssAspectRatio(coverState.view?.ratio ?? entry.layoutHints?.aspectRatio, fallbackRatio);
  const ratioToken = toRatioToken(coverState.view?.ratio ?? entry.layoutHints?.aspectRatio, fallbackRatio);
  const title = resolveEntryTitle(entry);
  const openEntryLabel = `${formatMessage("layout.open_entry")}：${title}`;

  if (coverState.status === "ready" && coverState.view?.coverUrl) {
    return (
      <div
        data-document-cover-shell
        role="button"
        tabIndex={0}
        aria-label={openEntryLabel}
        style={{ aspectRatio }}
        onClick={openEntry}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openEntry();
          }
        }}
      >
        <EmbeddedDocumentFrame
          title={coverState.view.title || title}
          src={coverState.view.coverUrl}
          ratio={ratioToken}
          sandbox="allow-scripts"
          onActivate={openEntry}
        />
      </div>
    );
  }

  const message = coverState.status === "loading"
    ? formatMessage("layout.loading")
    : coverState.status === "error"
      ? formatMessage("layout.cover_error")
      : formatMessage("layout.cover_missing");

  return (
    <button
      type="button"
      data-document-cover-shell
      data-document-cover-button
      data-document-cover-placeholder
      data-state={coverState.status}
      style={{ aspectRatio }}
      onClick={openEntry}
    >
      <strong>{title}</strong>
      <span>{message}</span>
      <span>{resolveEntryKindMessage(entry)}</span>
    </button>
  );
}

const DOCUMENT_SKELETON_INDENTS = [0, 0, 24, 24, 48, 48];

function DocumentLibrarySkeleton(): React.ReactElement {
  return (
    <LayoutSkeleton
      minHeight={300}
      hint={
        <EmptyHint
          title={formatMessage("layout.empty")}
          description={formatMessage("layout.empty_hint")}
        />
      }
    >
      {DOCUMENT_SKELETON_INDENTS.map((indent, index) => (
        <div
          key={`document-skeleton-row-${index}`}
          data-document-library-skeleton-row
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "9px 0",
            paddingInlineStart: indent,
            borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
          }}
        >
          <SkeletonBlock width={28} height={28} radius={8} />
          <SkeletonLine style={{ flex: 1, maxWidth: 260 }} />
          <SkeletonLine width={64} height={8} />
        </div>
      ))}
    </LayoutSkeleton>
  );
}

function DocumentPreview({
  node,
  runtime,
  showSummary,
}: {
  node: TreeDisplayNode | undefined;
  runtime: BoxLayoutRuntime;
  showSummary: boolean;
}) {
  if (!node) {
    return (
      <div data-document-preview>
        <DocumentLibrarySkeleton />
      </div>
    );
  }

  if (!node.entry) {
    return (
      <div data-document-preview data-missing="true">
        <h1 data-document-title>{node.title}</h1>
        <p data-document-meta>{formatMessage("layout.missing_entry_hint")}</p>
      </div>
    );
  }

  const tags = resolveTags(node.entry);
  const summary = node.entry.snapshot.summary?.trim();

  return (
    <article data-document-preview data-entry-id={node.entry.entryId}>
      <CoverPreview entry={node.entry} runtime={runtime} />
      <h1 data-document-title>{node.title}</h1>
      <p data-document-meta>{resolveEntryKindMessage(node.entry)}</p>
      {showSummary && summary ? (
        <p data-document-summary>{summary}</p>
      ) : null}
      {tags.length > 0 ? (
        <div data-document-tags aria-label={formatMessage("layout.tags")}>
          {tags.map((tag) => (
            <span key={tag} data-document-tag>{tag}</span>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        data-document-open-button
        onClick={() => {
          void runtime.openEntry(node.entry?.entryId ?? "");
        }}
      >
        {formatMessage("layout.open_entry")}
      </button>
    </article>
  );
}

export function LayoutViewPage({ initialView, config, runtime }: LayoutViewProps) {
  const isMountedRef = useRef(true);
  const [items, setItems] = useState<BoxEntrySnapshot[]>(initialView.items);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialView.nextCursor);
  const [total, setTotal] = useState(initialView.total);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setItems(initialView.items);
    setNextCursor(initialView.nextCursor);
    setTotal(initialView.total);
    setIsLoadingNext(false);
    setPageError(false);
    setSelectedNodeId(undefined);
  }, [initialView]);

  const enabledEntries = useMemo(() => items.filter((entry) => entry.enabled), [items]);
  const treeNodes = useMemo(() => buildTreeNodes({
    configNodes: config.props.treeNodes,
    entries: enabledEntries,
    sortMode: config.props.sortMode,
  }), [config.props.sortMode, config.props.treeNodes, enabledEntries]);

  const effectiveTreeNodes = useMemo(() => {
    const applyExpansion = (nodes: TreeDisplayNode[]): TreeDisplayNode[] => nodes.map((node) => ({
      ...node,
      collapsed: collapsedOverrides[node.id] ?? node.collapsed,
      children: applyExpansion(node.children),
    }));
    return flattenVisibleTree(applyExpansion(treeNodes));
  }, [collapsedOverrides, treeNodes]);

  const selectedNode = useMemo(() => {
    return effectiveTreeNodes.find((node) => node.id === selectedNodeId)
      ?? effectiveTreeNodes.find((node) => node.entry)
      ?? effectiveTreeNodes[0];
  }, [selectedNodeId, effectiveTreeNodes]);

  const hasTopRegion = hasFrameRegionContent(config.props.topRegion);
  const hasBackground = hasFrameRegionContent(config.props.background);

  useEffect(() => {
    const prefetchEntries = enabledEntries.slice(0, PAGE_LIMIT);
    if (prefetchEntries.length === 0) {
      return;
    }
    void runtime.prefetchEntries({
      entryIds: prefetchEntries.map((entry) => entry.entryId),
      targets: ["cover"],
    }).catch(() => undefined);
  }, [enabledEntries, runtime]);

  const loadNextPage = useCallback(async () => {
    if (!nextCursor || isLoadingNext) {
      return;
    }
    setIsLoadingNext(true);
    setPageError(false);
    try {
      const page = await runtime.listEntries({ cursor: nextCursor, limit: PAGE_LIMIT });
      if (!page || !Array.isArray(page.items)) {
        throw new Error("Invalid box entry page.");
      }
      if (!isMountedRef.current) {
        return;
      }
      setItems((current) => appendUniqueEntries(current, page.items));
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch {
      if (isMountedRef.current) {
        setPageError(true);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingNext(false);
      }
    }
  }, [isLoadingNext, nextCursor, runtime]);

  const toggleNode = (nodeId: string): void => {
    const node = effectiveTreeNodes.find((candidate) => candidate.id === nodeId);
    setCollapsedOverrides((current) => ({
      ...current,
      [nodeId]: !(node?.collapsed ?? false),
    }));
  };

  const openNode = (node: TreeDisplayNode): void => {
    setSelectedNodeId(node.id);
    if (node.entryId && node.entry) {
      void runtime.openEntry(node.entryId);
    }
  };

  const handleTreeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (effectiveTreeNodes.length === 0) {
      return;
    }
    const currentIndex = Math.max(0, effectiveTreeNodes.findIndex((node) => node.id === selectedNode?.id));
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedNodeId(effectiveTreeNodes[Math.min(effectiveTreeNodes.length - 1, currentIndex + 1)]?.id);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedNodeId(effectiveTreeNodes[Math.max(0, currentIndex - 1)]?.id);
    } else if (event.key === "ArrowRight" && selectedNode && selectedNode.children.length > 0) {
      event.preventDefault();
      setCollapsedOverrides((current) => ({ ...current, [selectedNode.id]: false }));
    } else if (event.key === "ArrowLeft" && selectedNode && selectedNode.children.length > 0) {
      event.preventDefault();
      setCollapsedOverrides((current) => ({ ...current, [selectedNode.id]: true }));
    } else if ((event.key === "Enter" || event.key === " ") && selectedNode) {
      event.preventDefault();
      openNode(selectedNode);
    }
  };

  return (
    <section data-scope="chips-document-library-layout">
      <style>{DOCUMENT_LIBRARY_STYLE}</style>

      {hasBackground ? (
        <div data-layout-background aria-hidden="true">
          <FrameRegionSurface
            region={config.props.background}
            runtime={runtime}
            title={formatMessage("layout.background_title")}
            ratio="16:9"
            decorative
          />
        </div>
      ) : null}

      <div data-layout-shell>
        {hasTopRegion ? (
          <div data-layout-top-region>
            <FrameRegionSurface
              region={config.props.topRegion}
              runtime={runtime}
              title={formatMessage("layout.top_region_title")}
              ratio="16:5"
            />
          </div>
        ) : null}

        <div data-document-library-main data-sidebar-width={config.props.sidebarWidth}>
          <nav
            data-document-tree
            aria-label={formatMessage("layout.tree_label")}
            onKeyDown={handleTreeKeyDown}
          >
            <div data-document-tree-list role="tree">
              {effectiveTreeNodes.map((node) => (
                <div
                  key={node.id}
                  data-document-tree-row
                  data-active={selectedNode?.id === node.id ? "true" : "false"}
                  data-missing={node.missing ? "true" : undefined}
                  data-unconfigured={!node.configured ? "true" : undefined}
                  role="treeitem"
                  aria-selected={selectedNode?.id === node.id ? "true" : "false"}
                  aria-expanded={node.children.length > 0 ? !node.collapsed : undefined}
                  style={{ paddingInlineStart: `calc(${node.depth} * 16px)` }}
                >
                  <button
                    type="button"
                    data-document-tree-toggle
                    disabled={node.children.length === 0}
                    aria-label={formatMessage(node.collapsed ? "layout.expand_node" : "layout.collapse_node")}
                    onClick={() => {
                      toggleNode(node.id);
                    }}
                  >
                    {node.children.length > 0 ? (node.collapsed ? "+" : "-") : ""}
                  </button>
                  <button
                    type="button"
                    data-document-tree-title
                    title={node.title}
                    onClick={() => {
                      openNode(node);
                    }}
                  >
                    {node.title}
                  </button>
                </div>
              ))}
            </div>
          </nav>

          <DocumentPreview
            node={selectedNode}
            runtime={runtime}
            showSummary={config.props.showSummary}
          />
        </div>

        {nextCursor || pageError ? (
          <div data-layout-footer data-total={total}>
            {pageError ? (
              <div data-layout-page-error role="status">
                <span>{formatMessage("layout.page_error")}</span>
                <button type="button" data-layout-retry onClick={loadNextPage}>
                  {formatMessage("layout.retry")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-layout-load-more
                onClick={loadNextPage}
                disabled={isLoadingNext}
              >
                {isLoadingNext
                  ? formatMessage("layout.loading_more")
                  : formatMessage("layout.load_more")}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
