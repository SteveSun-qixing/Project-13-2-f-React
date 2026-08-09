import { Flex } from "antd";
import { EnvironmentStatusView } from "../views/EnvironmentStatusView";
import { RuntimeDiagnosticsView } from "../views/RuntimeDiagnosticsView";

export function SettingsScene() {
  return (
    <Flex vertical gap={16}>
      <EnvironmentStatusView />
      <RuntimeDiagnosticsView />
    </Flex>
  );
}
