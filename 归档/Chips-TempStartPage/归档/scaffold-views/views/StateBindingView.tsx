import { useState } from "react";
import { Button, Card, Flex, Input, Typography } from "antd";
import { PanelHeader } from "@chips/ui";
import {
  createRuntimeDiagnostic,
  useAppRuntime,
} from "../app/AppRuntimeProvider";
import { formatMessage } from "../lib/messages";

export function StateBindingView() {
  const runtime = useAppRuntime();
  const [title, setTitle] = useState(formatMessage("app.identity.displayName"));

  function handleSubmit() {
    runtime.pushDiagnostic(
      createRuntimeDiagnostic("APP_STATE_BINDING_UPDATED", formatMessage("app.workspace.formResult", { title }), "app", { title }),
    );
  }

  return (
    <Card className="app-shell__section" variant="borderless">
      <PanelHeader
        title={formatMessage("app.workspace.formTitle")}
        description={formatMessage("app.workspace.formDescription")}
      />
      <Flex vertical gap={12}>
        <Flex vertical gap={4}>
          <Typography.Text className="app-shell__status-item-label">
            {formatMessage("app.workspace.formLabel")}
          </Typography.Text>
          <Input
            value={title}
            aria-label={formatMessage("app.workspace.formLabel")}
            placeholder={formatMessage("app.workspace.formPlaceholder")}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Flex>
        <Button type="primary" onClick={handleSubmit}>
          {formatMessage("app.workspace.formAction")}
        </Button>
      </Flex>
    </Card>
  );
}
