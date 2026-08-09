import { ChipsStack } from "@chips/component-library";
import { EnvironmentStatusView } from "../views/EnvironmentStatusView";

export function SettingsScene() {
  return (
    <ChipsStack gap="lg">
      <EnvironmentStatusView />
    </ChipsStack>
  );
}
