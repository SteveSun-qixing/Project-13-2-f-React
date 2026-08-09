import { useState } from "react";
import { Button, Card, Modal, Tag, Typography } from "antd";
import { PanelHeader, StateBoundary } from "@chips/ui";
import {
  createRuntimeDiagnostic,
  useAppRuntime,
} from "../app/AppRuntimeProvider";
import { formatMessage } from "../lib/messages";

export interface RuntimeDiagnosticsViewProps {
  commandErrorCode?: string | null;
  commandPhase?: string;
}

export function RuntimeDiagnosticsView({
  commandErrorCode,
  commandPhase,
}: RuntimeDiagnosticsViewProps) {
  const runtime = useAppRuntime();
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasError = commandErrorCode !== undefined && commandErrorCode !== null;
  const diagnostic = commandErrorCode
    ? createRuntimeDiagnostic(
        commandErrorCode,
        formatMessage("app.runtime.commandErrorDescription", { code: commandErrorCode }),
        "command",
      )
    : runtime.diagnostics[0] ?? null;

  return (
    <Card className="app-shell__section" variant="borderless">
      <PanelHeader
        title={formatMessage("app.runtime.sectionTitle")}
        description={formatMessage("app.runtime.sectionDescription")}
      />
      <div className="app-shell__runtime-status">
        <div className="app-shell__icon-line">
          <Tag color={hasError ? "error" : "success"}>
            {hasError
              ? formatMessage("app.runtime.statusError")
              : formatMessage("app.runtime.statusReady")}
          </Tag>
          {commandPhase ? <Tag>{commandPhase}</Tag> : null}
        </div>
        <Button size="small" onClick={() => setDialogOpen(true)}>
          {formatMessage("app.runtime.dialog.open")}
        </Button>
      </div>
      <StateBoundary
        empty={!diagnostic}
        emptyText={formatMessage("app.workspace.emptyTitle")}
        error={diagnostic ? diagnostic.message : null}
        onRetry={() => {
          void runtime.refreshEnvironment();
        }}
      >
        <Typography.Paragraph>
          {diagnostic
            ? `${diagnostic.code}：${diagnostic.message}`
            : formatMessage("app.workspace.emptyDescription")}
        </Typography.Paragraph>
      </StateBoundary>
      <Modal
        open={dialogOpen}
        title={formatMessage("app.runtime.dialog.title")}
        onCancel={() => setDialogOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDialogOpen(false)}>
            {formatMessage("app.runtime.dialog.close")}
          </Button>,
        ]}
      >
        <Typography.Paragraph>
          {formatMessage("app.runtime.dialog.sceneId", {
            value: runtime.environment.hostSceneId,
          })}
        </Typography.Paragraph>
        <Typography.Paragraph>
          {formatMessage("app.runtime.dialog.surfaceId", {
            value: runtime.environment.surfaceId ?? formatMessage("app.workspace.unknown"),
          })}
        </Typography.Paragraph>
        <Typography.Paragraph>
          {formatMessage("app.runtime.dialog.sessionId", {
            value: runtime.environment.sessionId ?? formatMessage("app.workspace.unknown"),
          })}
        </Typography.Paragraph>
        <Typography.Paragraph>
          {formatMessage("app.runtime.dialog.diagnostics", {
            count: runtime.diagnostics.length,
          })}
        </Typography.Paragraph>
      </Modal>
    </Card>
  );
}
