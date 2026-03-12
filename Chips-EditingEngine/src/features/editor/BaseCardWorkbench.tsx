import React, { useMemo, type CSSProperties } from "react";
import type { Client } from "chips-sdk";
import { ChipsButton, ChipsEmptyState } from "@chips/component-library";
import { useEditorPanel } from "../../app/providers/editor-panel-context";
import { getEditorPanelWidthPx } from "../../domains/editor-panel/editor-panel-state-service";
import type { BaseCardEditorSessionSnapshot } from "../../domains/editor/types";
import type { CardWorkspaceDocument } from "../../domains/workspace/types";
import { useBaseCardEditingSession } from "./useBaseCardEditingSession";

interface BaseCardWorkbenchProps {
  client: Client;
  document: CardWorkspaceDocument;
  translate(key: string): string;
  onRefresh(): Promise<void>;
  onClose(): void;
  onSessionStateChange?(snapshot: BaseCardEditorSessionSnapshot): void;
}

export function BaseCardWorkbench(props: BaseCardWorkbenchProps) {
  const editorPanel = useEditorPanel();
  const editingSession = useBaseCardEditingSession({
    client: props.client,
    document: props.document,
    onRefresh: props.onRefresh,
    onClose: props.onClose,
    onSessionStateChange: props.onSessionStateChange,
  });

  const selectedNodeLabel = useMemo(() => {
    if (!editingSession.selectedNode) {
      return null;
    }
    return editingSession.selectedNode.title && editingSession.selectedNode.title.trim().length > 0
      ? editingSession.selectedNode.title
      : editingSession.selectedNode.nodeId;
  }, [editingSession.selectedNode]);

  const statusLabel = useMemo(() => {
    const saveState = editingSession.session?.saveState ?? "idle";
    if (saveState === "saving") {
      return props.translate("editingEngine.editor.saving");
    }
    if (saveState === "pending") {
      return props.translate("editingEngine.editor.pendingSave");
    }
    if (saveState === "saved") {
      return props.translate("editingEngine.editor.saveSucceeded");
    }
    if (saveState === "error") {
      return props.translate("editingEngine.editor.saveFailed");
    }
    return props.translate("editingEngine.editor.idle");
  }, [editingSession.session?.saveState, props.translate]);

  const historySummary = useMemo(() => {
    if (!editingSession.session) {
      return props.translate("editingEngine.editor.historyEmpty");
    }
    return `${props.translate("editingEngine.editor.undoCountPrefix")}${editingSession.session.history.past.length} / ${props.translate("editingEngine.editor.redoCountPrefix")}${editingSession.session.history.future.length}`;
  }, [editingSession.session, props.translate]);

  const modeLabel =
    editingSession.documentMode === "view"
      ? props.translate("editingEngine.editor.viewMode")
      : props.translate("editingEngine.editor.editMode");

  const panelLayoutStyle = useMemo(
    () =>
      ({
        "--editor-panel-width": `${getEditorPanelWidthPx(editorPanel.state.widthPreset)}px`,
      }) as CSSProperties,
    [editorPanel.state.widthPreset],
  );

  return (
    <div className="editor-shell__document-stage editor-shell__document-stage--editing">
      <div className="editor-shell__preview-actions">
        <ChipsButton
          variant={editingSession.documentMode === "view" ? "primary" : "secondary"}
          disabled={editingSession.structureBusy}
          onPress={() => {
            void editingSession.toggleDocumentMode();
          }}
        >
          {editingSession.documentMode === "view"
            ? props.translate("editingEngine.actions.switchToEditMode")
            : props.translate("editingEngine.actions.switchToViewMode")}
        </ChipsButton>
        {editingSession.availableCardTypes.map((item) => (
          <ChipsButton
            key={`${item.pluginId}:${item.cardType}`}
            variant="secondary"
            disabled={editingSession.documentMode === "view" || editingSession.structureBusy}
            onPress={() => {
              void editingSession.addBaseCard(item.cardType);
            }}
          >
            {props
              .translate("editingEngine.actions.addBaseCardPrefix")
              .replace("{name}", item.pluginName)}
          </ChipsButton>
        ))}
        <ChipsButton
          variant="secondary"
          disabled={!editingSession.canMoveSelectionUp || editingSession.structureBusy}
          onPress={() => {
            void editingSession.moveSelectedBaseCard("up");
          }}
        >
          {props.translate("editingEngine.actions.moveBaseCardUp")}
        </ChipsButton>
        <ChipsButton
          variant="secondary"
          disabled={!editingSession.canMoveSelectionDown || editingSession.structureBusy}
          onPress={() => {
            void editingSession.moveSelectedBaseCard("down");
          }}
        >
          {props.translate("editingEngine.actions.moveBaseCardDown")}
        </ChipsButton>
        <ChipsButton
          variant="secondary"
          disabled={!editingSession.selectedNode || editingSession.documentMode === "view" || editingSession.structureBusy}
          onPress={() => {
            void editingSession.removeSelectedBaseCard();
          }}
        >
          {props.translate("editingEngine.actions.removeBaseCard")}
        </ChipsButton>
        <ChipsButton variant="secondary" onPress={editingSession.undo} disabled={!editingSession.canUndo}>
          {props.translate("editingEngine.actions.undo")}
        </ChipsButton>
        <ChipsButton variant="secondary" onPress={editingSession.redo} disabled={!editingSession.canRedo}>
          {props.translate("editingEngine.actions.redo")}
        </ChipsButton>
        <ChipsButton variant="secondary" onPress={() => void props.onRefresh()}>
          {props.translate("editingEngine.actions.refreshDocument")}
        </ChipsButton>
        <ChipsButton variant="secondary" onPress={() => void editingSession.close()}>
          {props.translate("editingEngine.actions.closeDocument")}
        </ChipsButton>
      </div>

      {editingSession.structureError ? (
        <div className="editor-shell__error-banner">{editingSession.structureError}</div>
      ) : null}

      {!props.document.validation.valid && props.document.validation.errors.length > 0 ? (
        <div className="editor-shell__error-banner">
          <strong>{props.translate("editingEngine.documents.invalid")}</strong>
          <ul className="editor-shell__error-list">
            {props.document.validation.errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className={`editor-shell__editor-layout ${editorPanel.state.collapsed ? "editor-shell__editor-layout--panel-collapsed" : ""}`}
        style={panelLayoutStyle}
      >
        <div className="editor-shell__editor-column">
          <div className="editor-shell__subpane-header">
            <h3>{props.translate("editingEngine.sections.preview")}</h3>
            <p>{props.translate("editingEngine.editor.previewHint")}</p>
          </div>
          <iframe
            ref={editingSession.previewFrameRef}
            className="editor-shell__preview-frame"
            title={props.document.preview.title}
            sandbox="allow-same-origin allow-scripts allow-forms"
            srcDoc={props.document.preview.body}
          />
        </div>

        <div
          className={`editor-shell__editor-column editor-shell__editor-column--panel ${editorPanel.state.collapsed ? "editor-shell__editor-column--panel-collapsed" : ""}`}
        >
          <div className="editor-shell__subpane-header editor-shell__subpane-header--panel">
            <div>
              <h3>{props.translate("editingEngine.editor.panelTitle")}</h3>
              <p>
                {selectedNodeLabel
                  ? `${props.translate("editingEngine.editor.selectedPrefix")}${selectedNodeLabel}`
                  : props.translate("editingEngine.editor.emptyDescription")}
              </p>
            </div>
            <div className="editor-shell__panel-toolbar">
              {!editorPanel.state.collapsed ? (
                <div className="editor-shell__panel-width-actions">
                  <ChipsButton
                    variant={editorPanel.state.widthPreset === "compact" ? "primary" : "secondary"}
                    disabled={editorPanel.busy || editorPanel.loading}
                    onPress={() => {
                      void editorPanel.setWidthPreset("compact");
                    }}
                  >
                    {props.translate("editingEngine.actions.panelWidthCompact")}
                  </ChipsButton>
                  <ChipsButton
                    variant={editorPanel.state.widthPreset === "standard" ? "primary" : "secondary"}
                    disabled={editorPanel.busy || editorPanel.loading}
                    onPress={() => {
                      void editorPanel.setWidthPreset("standard");
                    }}
                  >
                    {props.translate("editingEngine.actions.panelWidthStandard")}
                  </ChipsButton>
                  <ChipsButton
                    variant={editorPanel.state.widthPreset === "expanded" ? "primary" : "secondary"}
                    disabled={editorPanel.busy || editorPanel.loading}
                    onPress={() => {
                      void editorPanel.setWidthPreset("expanded");
                    }}
                  >
                    {props.translate("editingEngine.actions.panelWidthExpanded")}
                  </ChipsButton>
                </div>
              ) : null}
              <ChipsButton
                variant="secondary"
                disabled={editorPanel.busy || editorPanel.loading}
                onPress={() => {
                  void editorPanel.toggleCollapsed();
                }}
              >
                {editorPanel.state.collapsed
                  ? props.translate("editingEngine.actions.expandEditorPanel")
                  : props.translate("editingEngine.actions.collapseEditorPanel")}
              </ChipsButton>
            </div>
          </div>

          {editorPanel.error ? <div className="editor-shell__error-banner">{editorPanel.error}</div> : null}

          <div className={`editor-shell__editor-status ${editorPanel.state.collapsed ? "editor-shell__editor-status--compact" : ""}`}>
            <span>{editingSession.session?.baseCard.title ?? props.translate("editingEngine.values.notAvailable")}</span>
            <strong>{statusLabel}</strong>
          </div>
          <div
            className={`editor-shell__editor-status editor-shell__editor-status--secondary ${editorPanel.state.collapsed ? "editor-shell__editor-status--compact" : ""}`}
          >
            <span>{`${historySummary} · ${modeLabel}`}</span>
            <strong>
              {editingSession.session?.dirty
                ? props.translate("editingEngine.editor.dirty")
                : props.translate("editingEngine.editor.clean")}
            </strong>
          </div>

          {editingSession.editorError || editingSession.session?.error ? (
            <div className="editor-shell__error-banner">{editingSession.editorError ?? editingSession.session?.error}</div>
          ) : null}

          {editorPanel.state.collapsed ? (
            <div className="editor-shell__editor-collapsed-summary">
              <strong>{selectedNodeLabel ?? props.translate("editingEngine.editor.emptyTitle")}</strong>
              <span>{statusLabel}</span>
            </div>
          ) : null}

          {!editingSession.selectedNode ? (
            <div className="editor-shell__pane-state">
              <ChipsEmptyState
                ariaLabel={props.translate("editingEngine.editor.emptyTitle")}
                title={props.translate("editingEngine.editor.emptyTitle")}
                description={props.translate("editingEngine.editor.emptyDescription")}
              />
            </div>
          ) : editingSession.documentMode === "view" ? (
            <div className="editor-shell__pane-state">
              <ChipsEmptyState
                ariaLabel={props.translate("editingEngine.editor.viewModeTitle")}
                title={props.translate("editingEngine.editor.viewModeTitle")}
                description={props.translate("editingEngine.editor.viewModeDescription")}
              />
            </div>
          ) : (
            <div className={`editor-shell__editor-panel ${editorPanel.state.collapsed ? "editor-shell__editor-panel--collapsed" : ""}`}>
              {editingSession.editorLoading ? (
                <div className="editor-shell__pane-state">
                  <ChipsEmptyState
                    ariaLabel={props.translate("editingEngine.editor.loadingTitle")}
                    title={props.translate("editingEngine.editor.loadingTitle")}
                    description={props.translate("editingEngine.editor.loadingDescription")}
                  />
                </div>
              ) : null}
              <div ref={editingSession.editorHostRef} className="editor-shell__editor-host" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
