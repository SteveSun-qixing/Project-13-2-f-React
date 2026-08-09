import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { Button, Checkbox, ConfigProvider, Flex, Segmented, Select } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { FrameRegionEditor } from "./frame-region-editor";
import type { BoxEntrySnapshot, ResolvedRuntimeResource } from "../shared/types";
import {
  normalizeLayoutConfig,
  type DocumentTreeNodeConfig,
  type FrameRegionConfig,
  type LayoutConfig,
  type SidebarWidth,
  type SortMode,
} from "../schema/layout-config";
import { formatMessage } from "../lib/messages";

export interface LayoutEditorPanelProps {
  entries: BoxEntrySnapshot[];
  config: LayoutConfig;
  readBoxAsset?(assetPath: string): Promise<ResolvedRuntimeResource>;
  importBoxAsset?(input: { file: File; preferredPath?: string }): Promise<{ assetPath: string }>;
  deleteBoxAsset?(assetPath: string): Promise<void>;
  onChange(next: LayoutConfig): void;
}

export type LayoutEditorRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

type NodePath = number[];

interface FlatEditorNode {
  node: DocumentTreeNodeConfig;
  path: NodePath;
  depth: number;
}

const EDITOR_STYLE_TEXT = `
.chips-box-layout-editor {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  color: #1d1d1f;
  background-color: #ffffff;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}

.chips-box-layout-editor,
.chips-box-layout-editor * {
  box-sizing: border-box;
}

.chips-box-layout-editor__form {
  width: 100%;
  min-width: 0;
  padding: 16px;
}

.chips-box-layout-editor__section {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.chips-box-layout-editor__section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #1d1d1f;
}

.chips-box-layout-editor__section-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-box-layout-editor__field,
.chips-box-layout-editor__region {
  min-width: 0;
}

.chips-box-layout-editor [data-scope="form"][data-part="section"] {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.chips-box-layout-editor [data-scope="form"][data-part="field"] {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-box-layout-editor__field-label {
  color: #1d1d1f;
  font-size: 13px;
  font-weight: 600;
}

.chips-box-layout-editor__field-hint {
  color: #6e6e73;
  font-size: 12px;
  line-height: 1.6;
}

.chips-box-layout-editor__error {
  margin: 0;
  color: #ff3b30;
  font-size: 12px;
  line-height: 1.6;
}

.chips-box-layout-editor .ant-select {
  width: 100%;
  min-width: 0;
}

.chips-box-layout-editor .ant-segmented {
  min-width: 0;
  max-width: 100%;
}

.chips-box-layout-editor__tree {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-box-layout-editor__tree-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 4px;
  background: #ffffff;
}

.chips-box-layout-editor__tree-title {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}

.chips-box-layout-editor__title-input {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 4px;
  padding-inline: 8px;
  color: #1d1d1f;
  background: #ffffff;
  font: inherit;
}

.chips-box-layout-editor__node-actions,
.chips-box-layout-editor__unconfigured-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.chips-box-layout-editor__node-meta {
  min-width: 0;
  color: #6e6e73;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.chips-box-layout-editor__empty {
  color: #6e6e73;
}

.chips-box-layout-editor__region {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.chips-box-layout-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.chips-box-layout-editor [data-frame-region-asset-path] {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  color: #6e6e73;
  font-size: 12px;
}

.chips-box-layout-editor [data-frame-region-preview-shell] {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.chips-box-layout-editor [data-frame-region-preview] {
  width: 100%;
  min-height: 160px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background-color: #ffffff;
}

.chips-box-layout-editor [data-frame-region-preview] .chips-embedded-document-frame,
.chips-box-layout-editor [data-frame-region-preview] iframe {
  width: 100%;
  height: 100%;
}

.chips-box-layout-editor [data-frame-region-preview-image] {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-box-layout-editor [data-frame-region-preview-status] {
  min-height: 160px;
  display: grid;
  place-items: center;
  padding: 16px;
  color: #6e6e73;
  text-align: center;
}

.chips-box-layout-editor [data-frame-region-preview-label] {
  color: #6e6e73;
  font-size: 12px;
}

.chips-box-layout-editor__bridge-error .ant-result {
  padding: 0;
}

.chips-box-layout-editor__bridge-error .ant-result-icon {
  margin-block-end: 4px;
}

.chips-box-layout-editor__bridge-error .ant-result-title {
  font-size: 13px;
}

.chips-box-layout-editor__bridge-error .ant-result-subtitle {
  font-size: 12px;
}

.chips-box-layout-editor__bridge-error:focus-visible,
.chips-box-layout-editor__remove-button:focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}
`;

function resolveEntryTitle(entry: BoxEntrySnapshot): string {
  return entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
}

function cloneNode(node: DocumentTreeNodeConfig): DocumentTreeNodeConfig {
  return {
    id: node.id,
    entryId: node.entryId,
    titleOverride: node.titleOverride,
    collapsed: node.collapsed,
    children: node.children.map(cloneNode),
  };
}

function cloneNodes(nodes: DocumentTreeNodeConfig[]): DocumentTreeNodeConfig[] {
  return nodes.map(cloneNode);
}

function getChildrenAtPath(nodes: DocumentTreeNodeConfig[], parentPath: NodePath): DocumentTreeNodeConfig[] {
  let children = nodes;
  for (const index of parentPath) {
    children = children[index]?.children ?? [];
  }
  return children;
}

function updateNodeAtPath(
  nodes: DocumentTreeNodeConfig[],
  path: NodePath,
  updater: (node: DocumentTreeNodeConfig) => DocumentTreeNodeConfig
): DocumentTreeNodeConfig[] {
  const next = cloneNodes(nodes);
  const parent = getChildrenAtPath(next, path.slice(0, -1));
  const index = path[path.length - 1];
  if (typeof index === "number" && parent[index]) {
    parent[index] = updater(parent[index]);
  }
  return next;
}

function removeNodeAtPath(nodes: DocumentTreeNodeConfig[], path: NodePath): {
  nodes: DocumentTreeNodeConfig[];
  removed?: DocumentTreeNodeConfig;
} {
  const next = cloneNodes(nodes);
  const parent = getChildrenAtPath(next, path.slice(0, -1));
  const index = path[path.length - 1];
  if (typeof index !== "number") {
    return { nodes: next };
  }
  const [removed] = parent.splice(index, 1);
  return { nodes: next, removed };
}

function insertNodeAtPath(
  nodes: DocumentTreeNodeConfig[],
  parentPath: NodePath,
  index: number,
  node: DocumentTreeNodeConfig
): DocumentTreeNodeConfig[] {
  const next = cloneNodes(nodes);
  const parent = getChildrenAtPath(next, parentPath);
  parent.splice(index, 0, cloneNode(node));
  return next;
}

function flattenNodes(nodes: DocumentTreeNodeConfig[], depth = 0, parentPath: NodePath = []): FlatEditorNode[] {
  return nodes.flatMap((node, index) => {
    const path = [...parentPath, index];
    return [
      { node, path, depth },
      ...flattenNodes(node.children, depth + 1, path),
    ];
  });
}

function collectEntryIds(nodes: DocumentTreeNodeConfig[], output = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.entryId) {
      output.add(node.entryId);
    }
    collectEntryIds(node.children, output);
  }
  return output;
}

function createEntryNode(entry: BoxEntrySnapshot): DocumentTreeNodeConfig {
  return {
    id: `entry-${entry.entryId}`,
    entryId: entry.entryId,
    collapsed: false,
    children: [],
  };
}

function createGroupNode(): DocumentTreeNodeConfig {
  return {
    id: `group-${Date.now()}`,
    titleOverride: "",
    collapsed: false,
    children: [],
  };
}

function updateProps(config: LayoutConfig, patch: Partial<LayoutConfig["props"]>): LayoutConfig {
  return normalizeLayoutConfig({
    ...config,
    props: {
      ...config.props,
      ...patch,
    },
  });
}

function updateFrameRegion(
  config: LayoutConfig,
  key: "background" | "topRegion",
  region: FrameRegionConfig
): LayoutConfig {
  return updateProps(config, {
    [key]: region,
  });
}

export function LayoutEditorPanel({
  entries,
  config: initialConfig,
  readBoxAsset,
  importBoxAsset,
  deleteBoxAsset,
  onChange,
}: LayoutEditorPanelProps) {
  const [config, setConfig] = React.useState(() => normalizeLayoutConfig(initialConfig));
  const configRef = React.useRef(config);
  const entryMap = React.useMemo(() => new Map(entries.map((entry) => [entry.entryId, entry])), [entries]);

  React.useEffect(() => {
    const normalized = normalizeLayoutConfig(initialConfig);
    configRef.current = normalized;
    setConfig(normalized);
  }, [initialConfig]);

  function commit(next: LayoutConfig): void {
    const normalized = normalizeLayoutConfig(next);
    configRef.current = normalized;
    setConfig(normalized);
    onChange(normalized);
  }

  function commitTreeNodes(treeNodes: DocumentTreeNodeConfig[]): void {
    commit(updateProps(configRef.current, { treeNodes }));
  }

  const flatNodes = React.useMemo(() => flattenNodes(config.props.treeNodes), [config.props.treeNodes]);
  const configuredEntryIds = React.useMemo(() => collectEntryIds(config.props.treeNodes), [config.props.treeNodes]);
  const unconfiguredEntries = entries.filter((entry) => !configuredEntryIds.has(entry.entryId));

  function moveNode(path: NodePath, direction: -1 | 1): void {
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    if (typeof index !== "number") {
      return;
    }
    const siblings = getChildrenAtPath(configRef.current.props.treeNodes, parentPath);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= siblings.length) {
      return;
    }
    const next = cloneNodes(configRef.current.props.treeNodes);
    const parent = getChildrenAtPath(next, parentPath);
    const [node] = parent.splice(index, 1);
    if (!node) {
      return;
    }
    parent.splice(nextIndex, 0, node);
    commitTreeNodes(next);
  }

  function indentNode(path: NodePath): void {
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    if (typeof index !== "number" || index <= 0) {
      return;
    }
    const removal = removeNodeAtPath(configRef.current.props.treeNodes, path);
    if (!removal.removed) {
      return;
    }
    const newParentPath = [...parentPath, index - 1];
    const nextParent = getChildrenAtPath(removal.nodes, newParentPath);
    nextParent.push(removal.removed);
    commitTreeNodes(removal.nodes);
  }

  function outdentNode(path: NodePath): void {
    if (path.length <= 1) {
      return;
    }
    const parentPath = path.slice(0, -1);
    const grandParentPath = path.slice(0, -2);
    const parentIndex = parentPath[parentPath.length - 1];
    if (typeof parentIndex !== "number") {
      return;
    }
    const removal = removeNodeAtPath(configRef.current.props.treeNodes, path);
    if (!removal.removed) {
      return;
    }
    commitTreeNodes(insertNodeAtPath(removal.nodes, grandParentPath, parentIndex + 1, removal.removed));
  }

  function addEntry(entry: BoxEntrySnapshot): void {
    commitTreeNodes([...configRef.current.props.treeNodes, createEntryNode(entry)]);
  }

  function addGroup(): void {
    commitTreeNodes([...configRef.current.props.treeNodes, createGroupNode()]);
  }

  return (
    <section
      className="chips-box-layout-editor"
      data-scope="chips-box-layout-editor"
      aria-label={formatMessage("editor.aria_label")}
    >
      <style>{EDITOR_STYLE_TEXT}</style>
      <form
        className="chips-box-layout-editor__form"
        aria-label={formatMessage("editor.aria_label")}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Flex vertical gap={16}>
          <section data-scope="form" data-part="section" className="chips-box-layout-editor__section">
            <h2 className="chips-box-layout-editor__section-title">
              {formatMessage("editor.section.display")}
            </h2>
            <p className="chips-box-layout-editor__section-desc">
              {formatMessage("editor.section.display_desc")}
            </p>
            <div data-scope="form" data-part="field" className="chips-box-layout-editor__field">
              <span className="chips-box-layout-editor__field-label">
                {formatMessage("editor.sort_mode")}
              </span>
              <Select
                value={config.props.sortMode}
                placeholder={formatMessage("editor.sort_mode")}
                aria-label={formatMessage("editor.sort_mode")}
                options={[
                  { value: "manual", label: formatMessage("editor.sort_manual") },
                  { value: "name-asc", label: formatMessage("editor.sort_name_asc") },
                  { value: "name-desc", label: formatMessage("editor.sort_name_desc") },
                ]}
                onChange={(value: SortMode) => {
                  commit(updateProps(config, { sortMode: value }));
                }}
              />
              <span className="chips-box-layout-editor__field-hint">
                {config.props.sortMode === "manual"
                  ? formatMessage("editor.sort_manual_hint")
                  : formatMessage("editor.sort_runtime_hint")}
              </span>
            </div>

            <div data-scope="form" data-part="field" className="chips-box-layout-editor__field">
              <span className="chips-box-layout-editor__field-label">
                {formatMessage("editor.sidebar_width")}
              </span>
              <Segmented
                value={config.props.sidebarWidth}
                aria-label={formatMessage("editor.sidebar_width")}
                options={[
                  { value: "compact", label: formatMessage("editor.sidebar_compact") },
                  { value: "regular", label: formatMessage("editor.sidebar_regular") },
                  { value: "wide", label: formatMessage("editor.sidebar_wide") },
                ]}
                onChange={(value) => {
                  commit(updateProps(config, { sidebarWidth: value as SidebarWidth }));
                }}
              />
            </div>

            <div data-scope="form" data-part="field" className="chips-box-layout-editor__field">
              <Checkbox
                checked={config.props.showSummary}
                onChange={(event) => {
                  commit(updateProps(config, { showSummary: event.target.checked }));
                }}
              >
                {formatMessage("editor.show_summary")}
              </Checkbox>
            </div>

            <p className="chips-box-layout-editor__field-hint">
              {formatMessage("editor.entry_count", { count: entries.length })}
            </p>
          </section>

          <section data-scope="form" data-part="section" className="chips-box-layout-editor__section">
            <h2 className="chips-box-layout-editor__section-title">
              {formatMessage("editor.section.tree")}
            </h2>
            <p className="chips-box-layout-editor__section-desc">
              {formatMessage("editor.section.tree_desc")}
            </p>
            <div className="chips-box-layout-editor__node-actions">
              <Button onClick={addGroup}>
                {formatMessage("editor.add_group")}
              </Button>
            </div>

            <div className="chips-box-layout-editor__tree">
              {flatNodes.length > 0 ? flatNodes.map(({ node, path, depth }) => {
                const entry = node.entryId ? entryMap.get(node.entryId) : undefined;
                const inheritedTitle = entry ? resolveEntryTitle(entry) : formatMessage("editor.group_title_fallback");
                return (
                  <div
                    key={node.id}
                    className="chips-box-layout-editor__tree-row"
                    style={{ marginInlineStart: `calc(${depth} * 16px)` }}
                    data-tree-node-id={node.id}
                  >
                    <div className="chips-box-layout-editor__tree-title">
                      <input
                        className="chips-box-layout-editor__title-input"
                        value={node.titleOverride ?? ""}
                        aria-label={formatMessage("editor.title_override_for", { title: inheritedTitle })}
                        placeholder={inheritedTitle}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          commitTreeNodes(updateNodeAtPath(configRef.current.props.treeNodes, path, (current) => ({
                            ...current,
                            titleOverride: value,
                          })));
                        }}
                      />
                    </div>
                    <div className="chips-box-layout-editor__node-meta">
                      {node.entryId
                        ? formatMessage(entry ? "editor.node_entry" : "editor.node_missing_entry", { entryId: node.entryId })
                        : formatMessage("editor.node_group")}
                    </div>
                    <Checkbox
                      checked={node.collapsed}
                      onChange={(event) => {
                        commitTreeNodes(updateNodeAtPath(configRef.current.props.treeNodes, path, (current) => ({
                          ...current,
                          collapsed: event.target.checked,
                        })));
                      }}
                    >
                      {formatMessage("editor.collapsed_by_default")}
                    </Checkbox>
                    <div className="chips-box-layout-editor__node-actions">
                      <Button size="small" onClick={() => { moveNode(path, -1); }}>
                        {formatMessage("editor.move_up")}
                      </Button>
                      <Button size="small" onClick={() => { moveNode(path, 1); }}>
                        {formatMessage("editor.move_down")}
                      </Button>
                      <Button size="small" onClick={() => { indentNode(path); }}>
                        {formatMessage("editor.indent")}
                      </Button>
                      <Button size="small" onClick={() => { outdentNode(path); }}>
                        {formatMessage("editor.outdent")}
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() => {
                          commitTreeNodes(removeNodeAtPath(configRef.current.props.treeNodes, path).nodes);
                        }}
                      >
                        {formatMessage("editor.remove_node")}
                      </Button>
                    </div>
                  </div>
                );
              }) : (
                <span className="chips-box-layout-editor__empty">
                  {formatMessage("editor.tree_empty")}
                </span>
              )}
            </div>

            <div data-scope="form" data-part="field" className="chips-box-layout-editor__field">
              <span className="chips-box-layout-editor__field-label">
                {formatMessage("editor.unconfigured_entries")}
              </span>
              <div className="chips-box-layout-editor__unconfigured-list">
                {unconfiguredEntries.length > 0 ? unconfiguredEntries.map((entry) => (
                  <Button
                    key={entry.entryId}
                    onClick={() => {
                      addEntry(entry);
                    }}
                  >
                    {formatMessage("editor.add_entry", { title: resolveEntryTitle(entry) })}
                  </Button>
                )) : (
                  <span className="chips-box-layout-editor__empty">
                    {formatMessage("editor.no_unconfigured_entries")}
                  </span>
                )}
              </div>
            </div>
          </section>

          <FrameRegionEditor
            id="background"
            region={config.props.background}
            title={formatMessage("editor.background_title")}
            description={formatMessage("editor.background_desc")}
            previewRatio="16:9"
            preferredAssetPrefix="assets/layouts/chips.layout.documentlibrary.blp/background"
            readBoxAsset={readBoxAsset}
            importBoxAsset={importBoxAsset}
            deleteBoxAsset={deleteBoxAsset}
            onChange={(nextRegion) => {
              commit(updateFrameRegion(configRef.current, "background", nextRegion));
            }}
          />

          <FrameRegionEditor
            id="topRegion"
            region={config.props.topRegion}
            title={formatMessage("editor.top_region_title")}
            description={formatMessage("editor.top_region_desc")}
            previewRatio="16:5"
            preferredAssetPrefix="assets/layouts/chips.layout.documentlibrary.blp/top-region"
            readBoxAsset={readBoxAsset}
            importBoxAsset={importBoxAsset}
            deleteBoxAsset={deleteBoxAsset}
            onChange={(nextRegion) => {
              commit(updateFrameRegion(configRef.current, "topRegion", nextRegion));
            }}
          />
        </Flex>
      </form>
    </section>
  );
}

export function createLayoutEditorRoot(props: LayoutEditorPanelProps): LayoutEditorRoot {
  const rootElement = document.createElement("div") as LayoutEditorRoot;
  rootElement.setAttribute("data-chips-documentlibrary-layout-editor-root", "true");
  rootElement.style.width = "100%";
  rootElement.style.height = "100%";
  rootElement.style.minHeight = "0";

  const reactRoot: Root = createRoot(rootElement);

  flushSync(() => {
    reactRoot.render(
      <ConfigProvider locale={zhCN} theme={appleTheme}>
        <LayoutEditorPanel {...props} />
      </ConfigProvider>,
    );
  });

  rootElement.__chipsDispose = () => {
    reactRoot.unmount();
  };

  return rootElement;
}
