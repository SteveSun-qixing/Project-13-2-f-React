import React from "react";
import { ChipsThemeProvider } from "@chips/component-library";
import { EditorRuntimeProvider, useThemeProviderState } from "./providers/EditorRuntimeProvider";
import { EditorPanelProvider } from "./providers/EditorPanelProvider";
import { useEditorRuntime } from "./providers/editor-runtime-context";
import { WorkspaceSessionProvider } from "./providers/WorkspaceSessionProvider";
import { WorkspaceExplorerProvider } from "./providers/WorkspaceExplorerProvider";
import { EditorShell } from "../features/shell/EditorShell";

function EditorShellWithTheme() {
  const { snapshot } = useEditorRuntime();
  const themeState = useThemeProviderState(snapshot);
  const themeEventSource = typeof window !== "undefined" ? (window as Window & { chips?: unknown }).chips : undefined;

  return (
    <ChipsThemeProvider
      themeId={themeState.themeId}
      version={themeState.version}
      eventSource={themeEventSource}
      eventName="theme.changed"
    >
      <EditorShell />
    </ChipsThemeProvider>
  );
}

export function EditorApp() {
  return (
    <EditorRuntimeProvider>
      <WorkspaceSessionProvider>
        <WorkspaceExplorerProvider>
          <EditorPanelProvider>
            <EditorShellWithTheme />
          </EditorPanelProvider>
        </WorkspaceExplorerProvider>
      </WorkspaceSessionProvider>
    </EditorRuntimeProvider>
  );
}
