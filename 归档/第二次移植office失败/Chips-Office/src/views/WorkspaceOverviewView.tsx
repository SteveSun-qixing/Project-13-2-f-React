import { Card, Descriptions } from "antd";
import { PanelHeader } from "@chips/ui";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import { formatMessage } from "../lib/messages";

export function WorkspaceOverviewView() {
  const runtime = useAppRuntime();

  return (
    <Card className="app-shell__section" variant="borderless">
      <PanelHeader
        title={formatMessage("app.workspace.overviewTitle")}
        description={formatMessage("app.workspace.overviewDescription")}
      />
      <Descriptions
        column={{ xs: 1, sm: 2, md: 3 }}
        items={[
          {
            key: "scene",
            label: formatMessage("app.workspace.sceneLabel"),
            children: runtime.activeScene.title,
          },
          {
            key: "surface",
            label: formatMessage("app.workspace.surfaceLabel"),
            children:
              runtime.environment.surfaceId ??
              runtime.environment.surfaceKind ??
              formatMessage("app.workspace.unknown"),
          },
          {
            key: "session",
            label: formatMessage("app.workspace.sessionLabel"),
            children:
              runtime.environment.sessionId ?? formatMessage("app.workspace.unknown"),
          },
          {
            key: "diagnostics",
            label: formatMessage("app.workspace.diagnosticsLabel"),
            children: runtime.diagnostics.length,
          },
        ]}
      />
    </Card>
  );
}
