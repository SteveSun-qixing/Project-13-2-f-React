import React, { useEffect, useMemo, useState } from "react";
import { ChipsButton, ChipsEmptyState, ChipsLoadingBoundary, ChipsTree, type TreeNode } from "@chips/component-library";
import type { WorkspaceRepositoryNode, WorkspaceRepositoryRoot } from "../../domains/workspace/types";
import { findWorkspaceRepositoryNode } from "../../domains/workspace/workspace-repository-service";

interface WorkspaceRepositoryTreeProps {
  roots: WorkspaceRepositoryRoot[];
  loading: boolean;
  error: string | null;
  activeDocumentPath: string | null;
  emptyTitle: string;
  emptyDescription: string;
  retryLabel: string;
  openFolderLabel: string;
  onOpenDocument(path: string): Promise<void>;
  onOpenDocumentFromDialog(): Promise<void>;
  onRefresh(): Promise<void>;
}

function createTreeNodeLabel(root: WorkspaceRepositoryRoot | WorkspaceRepositoryNode): React.ReactNode {
  return (
    <span className="editor-shell__tree-label">
      <strong>{root.name}</strong>
      <span>{root.path}</span>
    </span>
  );
}

function mapRepositoryNodesToTree(nodes: WorkspaceRepositoryNode[]): TreeNode[] {
  return nodes.map((node) => ({
    id: node.id,
    label: createTreeNodeLabel(node),
    children: mapRepositoryNodesToTree(node.children),
  }));
}

function mapRootsToTree(roots: WorkspaceRepositoryRoot[]): TreeNode[] {
  return roots.map((root) => ({
    id: root.id,
    label: createTreeNodeLabel(root),
    children: mapRepositoryNodesToTree(root.nodes),
  }));
}

export function WorkspaceRepositoryTree({
  roots,
  loading,
  error,
  activeDocumentPath,
  emptyTitle,
  emptyDescription,
  retryLabel,
  openFolderLabel,
  onOpenDocument,
  onOpenDocumentFromDialog,
  onRefresh,
}: WorkspaceRepositoryTreeProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>(() => roots.map((root) => root.id));

  useEffect(() => {
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const root of roots) {
        next.add(root.id);
      }
      return [...next];
    });
  }, [roots]);

  const treeNodes = useMemo(() => mapRootsToTree(roots), [roots]);
  const activeNodeId = activeDocumentPath ?? null;

  const handleSelectedIdChange = (selectedId: string | null) => {
    if (!selectedId) {
      return;
    }

    const selectedNode = findWorkspaceRepositoryNode(roots, selectedId);
    if (!selectedNode || selectedNode.kind === "directory") {
      return;
    }

    void onOpenDocument(selectedNode.path);
  };

  if (error) {
    return (
      <div className="editor-shell__tree-state">
        <ChipsEmptyState
          ariaLabel={emptyTitle}
          title={emptyTitle}
          description={error}
          actionLabel={retryLabel}
          onAction={() => {
            void onRefresh();
          }}
        />
      </div>
    );
  }

  if (roots.length === 0 && !loading) {
    return (
      <div className="editor-shell__tree-state">
        <ChipsEmptyState
          ariaLabel={emptyTitle}
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={openFolderLabel}
          onAction={() => {
            void onOpenDocumentFromDialog();
          }}
        />
      </div>
    );
  }

  return (
    <div className="editor-shell__tree-panel">
      <div className="editor-shell__tree-toolbar">
        <ChipsButton variant="secondary" onPress={() => void onRefresh()}>
          {retryLabel}
        </ChipsButton>
      </div>
      <ChipsLoadingBoundary ariaLabel={emptyTitle} loading={loading}>
        <ChipsTree
          ariaLabel={emptyTitle}
          nodes={treeNodes}
          expandedIds={expandedIds}
          selectedId={activeNodeId}
          onExpandedIdsChange={setExpandedIds}
          onSelectedIdChange={handleSelectedIdChange}
        />
      </ChipsLoadingBoundary>
    </div>
  );
}
