import React, { useMemo } from "react";
import { ChipsButton, ChipsEmptyState, ChipsLoadingBoundary, ChipsTree, type TreeNode } from "@chips/component-library";
import { useWorkspaceExplorer } from "../../app/providers/workspace-explorer-context";
import { useEditorRuntime } from "../../app/providers/editor-runtime-context";
import { useEditorTranslation } from "../../shared/runtime/use-editor-translation";
import type { WorkspaceExplorerNode } from "../../domains/workspace-explorer/types";
import "./workspace-explorer.css";

function getExplorerIcon(kind: WorkspaceExplorerNode["kind"]): string {
  if (kind === "directory") {
    return "F";
  }
  if (kind === "box") {
    return "B";
  }
  return "C";
}

function createTreeNode(node: WorkspaceExplorerNode): TreeNode {
  return {
    id: node.id,
    label: (
      <div className="workspace-explorer__tree-label">
        <span className="workspace-explorer__tree-title">
          <strong>{getExplorerIcon(node.kind)}</strong>
          <span>{node.name}</span>
        </span>
        <span className="workspace-explorer__tree-path">{node.path}</span>
      </div>
    ),
    children: node.children.map(createTreeNode),
  };
}

export function WorkspaceExplorerPanel() {
  const { snapshot } = useEditorRuntime();
  const { tree, expandedIds, selectedId, loading, busy, error, setExpandedIds, selectNode, refresh } = useWorkspaceExplorer();
  const translate = useEditorTranslation(snapshot?.locale);

  const nodes = useMemo(() => tree.map(createTreeNode), [tree]);

  return (
    <div>
      <div className="editor-shell__section-header">
        <h2>{translate("editingEngine.sections.workspaceExplorer")}</h2>
        <div className="editor-shell__button-row">
          <ChipsButton variant="secondary" disabled={busy} onPress={() => void refresh()}>
            {translate("editingEngine.actions.refreshExplorer")}
          </ChipsButton>
        </div>
      </div>
      {error ? <p className="editor-shell__error-banner">{error}</p> : null}
      {nodes.length === 0 ? (
        <ChipsEmptyState
          ariaLabel={translate("editingEngine.sections.workspaceExplorer")}
          title={translate("editingEngine.workspaceExplorer.emptyTitle")}
          description={translate("editingEngine.workspaceExplorer.emptyDescription")}
        />
      ) : (
        <ChipsLoadingBoundary loading={loading} delayMs={0} loadingText={translate("editingEngine.workspaceExplorer.loading")}>
          <ChipsTree
            ariaLabel={translate("editingEngine.sections.workspaceExplorer")}
            nodes={nodes}
            expandedIds={expandedIds}
            selectedId={selectedId}
            onExpandedIdsChange={(nextExpandedIds) => {
              void setExpandedIds(nextExpandedIds);
            }}
            onSelectedIdChange={(nodeId) => {
              void selectNode(nodeId);
            }}
          />
        </ChipsLoadingBoundary>
      )}
    </div>
  );
}
