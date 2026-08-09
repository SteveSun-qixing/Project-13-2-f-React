import { Button, Card, Descriptions } from "antd";
import { PanelHeader, StateBoundary } from "@chips/ui";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import { formatMessage } from "../lib/messages";

export function EnvironmentStatusView() {
  const runtime = useAppRuntime();

  function refreshEnvironment() {
    void runtime.refreshEnvironment();
  }

  return (
    <Card className="app-shell__section" variant="borderless">
      <PanelHeader
        title={formatMessage("app.workspace.environmentTitle")}
        description={formatMessage("app.scenes.settings.description")}
        extra={
          <Button size="small" onClick={refreshEnvironment}>
            {formatMessage("app.workspace.emptyAction")}
          </Button>
        }
      />
      <Descriptions
        column={{ xs: 1, sm: 2, md: 3 }}
        items={[
          {
            key: "appId",
            label: "App ID",
            children: runtime.environment.appId,
          },
          {
            key: "pluginId",
            label: "Plugin ID",
            children: runtime.environment.pluginId,
          },
          {
            key: "hostScene",
            label: "Host Scene",
            children:
              runtime.environment.hostSceneId ?? formatMessage("app.workspace.unknown"),
          },
          {
            key: "surfaceKind",
            label: "Surface Kind",
            children:
              runtime.environment.surfaceKind ?? formatMessage("app.workspace.unknown"),
          },
          {
            key: "surfaceId",
            label: "Surface ID",
            children:
              runtime.environment.surfaceId ?? formatMessage("app.workspace.unknown"),
          },
          {
            key: "sessionId",
            label: "Session ID",
            children:
              runtime.environment.sessionId ?? formatMessage("app.workspace.unknown"),
          },
        ]}
      />
      <StateBoundary
        empty={runtime.diagnostics.length === 0}
        emptyText={formatMessage("app.workspace.emptyTitle")}
      >
        <span>
          {formatMessage("app.workspace.diagnosticsLabel")}: {runtime.diagnostics.length}
        </span>
      </StateBoundary>
    </Card>
  );
}
