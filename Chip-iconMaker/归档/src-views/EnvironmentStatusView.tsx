import {
  ChipsButton,
  ChipsEmptyState,
  ChipsGrid,
  ChipsSection,
  ChipsStack,
  ChipsText,
  ChipsView,
} from "@chips/component-library";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import { useAppText } from "../i18n/useAppText";
import { resolveThemeLabel } from "../theme/theme-runtime";

export function EnvironmentStatusView() {
  const { text } = useAppText();
  const runtime = useAppRuntime();

  function refreshEnvironment() {
    void runtime.refreshEnvironment();
  }

  return (
    <ChipsSection
      title={text("app.workspace.environmentTitle")}
      description={text("app.scenes.settings.description")}
    >
      <ChipsStack gap="md">
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
              {runtime.environment.surfaceId ?? runtime.environment.surfaceKind ?? text("app.workspace.unknown")}
            </ChipsText>
          </ChipsView>
          <ChipsView className="app-status-item">
            <ChipsText>{text("app.workspace.permissionLabel")}</ChipsText>
            <ChipsText className="app-status-item__value">
              {runtime.permissions.canInvokeCommand
                ? text("app.workspace.permissionReady")
                : text("app.workspace.permissionMissing")}
            </ChipsText>
          </ChipsView>
        </ChipsGrid>
        {runtime.diagnostics.length === 0 ? (
          <ChipsEmptyState
            title={text("app.workspace.emptyTitle")}
            description={text("app.workspace.emptyDescription")}
            actionLabel={text("app.workspace.emptyAction")}
            ariaLabel={text("app.workspace.emptyTitle")}
            onAction={refreshEnvironment}
          />
        ) : (
          <ChipsButton type="button" onPress={runtime.clearDiagnostics}>
            {text("app.workspace.emptyAction")}
          </ChipsButton>
        )}
      </ChipsStack>
    </ChipsSection>
  );
}
