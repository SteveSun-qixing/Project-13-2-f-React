import {
  ChipsBadge,
  ChipsGrid,
  ChipsSection,
  ChipsStack,
  ChipsText,
  ChipsView,
} from "@chips/component-library";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import { useAppText } from "../i18n/useAppText";
import { resolveThemeLabel } from "../theme/theme-runtime";

export function WorkspaceOverviewView() {
  const { text } = useAppText();
  const runtime = useAppRuntime();
  const hasCommandPermission = runtime.permissions.canInvokeCommand;

  return (
    <ChipsSection
      title={text("app.workspace.overviewTitle")}
      description={text("app.workspace.overviewDescription")}
    >
      <ChipsGrid className="app-status-grid" minItemSize="12rem" gap="md">
        <ChipsView className="app-status-item">
          <ChipsText>{text("app.workspace.themeLabel")}</ChipsText>
          <ChipsText className="app-status-item__value">
            {resolveThemeLabel(runtime.theme)}
          </ChipsText>
        </ChipsView>
        <ChipsView className="app-status-item">
          <ChipsText>{text("app.workspace.localeLabel")}</ChipsText>
          <ChipsText className="app-status-item__value">{runtime.locale}</ChipsText>
        </ChipsView>
        <ChipsView className="app-status-item">
          <ChipsText>{text("app.workspace.surfaceLabel")}</ChipsText>
          <ChipsText className="app-status-item__value">
            {runtime.environment.surfaceKind ?? text("app.workspace.unknown")}
          </ChipsText>
        </ChipsView>
        <ChipsView className="app-status-item">
          <ChipsText>{text("app.workspace.permissionLabel")}</ChipsText>
          <ChipsStack gap="sm">
            <ChipsBadge
              tone={hasCommandPermission ? "success" : "warning"}
              label={hasCommandPermission
                ? text("app.workspace.permissionReady")
                : text("app.workspace.permissionMissing")}
            />
            <ChipsText className="app-status-item__value">
              {text("app.workspace.diagnosticsLabel")}: {runtime.diagnostics.length}
            </ChipsText>
          </ChipsStack>
        </ChipsView>
      </ChipsGrid>
    </ChipsSection>
  );
}
