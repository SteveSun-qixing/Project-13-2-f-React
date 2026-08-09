import {
  ChipsBadge,
  ChipsDialog,
  ChipsErrorState,
  ChipsIcon,
  ChipsSection,
  ChipsStack,
  ChipsText,
} from "@chips/component-library";
import {
  createRuntimeDiagnostic,
  useAppRuntime,
} from "../app/AppRuntimeProvider";
import { useAppText } from "../i18n/useAppText";

export interface RuntimeDiagnosticsViewProps {
  commandErrorCode?: string | null;
  commandPhase?: string;
}

export function RuntimeDiagnosticsView({
  commandErrorCode,
  commandPhase,
}: RuntimeDiagnosticsViewProps) {
  const runtime = useAppRuntime();
  const { text } = useAppText();
  const hasError = runtime.status.phase === "error" || Boolean(commandErrorCode);
  const diagnostic = commandErrorCode
    ? createRuntimeDiagnostic(
        commandErrorCode,
        text("app.runtime.commandErrorDescription", { code: commandErrorCode }),
        "command",
      )
    : runtime.diagnostics[0] ?? null;
  const error = hasError
    ? diagnostic ?? createRuntimeDiagnostic(
        "APP_RUNTIME_PHASE_ERROR",
        text("app.runtime.errorDescription"),
      )
    : null;

  return (
    <ChipsSection
      title={text("app.runtime.sectionTitle")}
      description={text("app.runtime.sectionDescription")}
    >
      <ChipsStack gap="md">
        <div className="app-runtime-status">
          <span className="app-icon-line">
            <ChipsIcon
              descriptor={{
                name: hasError ? "error" : "check_circle",
                style: "rounded",
                tone: hasError ? "danger" : "accent",
                decorative: true,
              }}
              aria-label={text("app.runtime.iconLabel")}
            />
            <ChipsText>
              {hasError ? text("app.runtime.status.error") : text("app.runtime.status.ready")}
            </ChipsText>
          </span>
          <ChipsBadge
            tone={hasError ? "error" : "success"}
            label={commandPhase ?? runtime.status.phase}
          />
        </div>

        {error ? (
          <ChipsErrorState
            error={error}
            title={text("app.runtime.errorTitle")}
            description={text("app.runtime.errorDescription")}
            actionLabel={text("app.runtime.refreshAction")}
            retryable
            showDetails
            ariaLabel={text("app.runtime.errorTitle")}
            onAction={() => {
              void runtime.refreshEnvironment();
            }}
          />
        ) : null}

        <ChipsDialog.Root>
          <ChipsDialog.Trigger>
            {text("app.runtime.dialog.open")}
          </ChipsDialog.Trigger>
          <ChipsDialog.Content>
            <ChipsDialog.Header>
              <ChipsText>{text("app.runtime.dialog.title")}</ChipsText>
            </ChipsDialog.Header>
            <ChipsDialog.Body>
              <ChipsStack gap="sm">
                <ChipsText>
                  {text("app.runtime.dialog.sceneId", {
                    value: runtime.environment.hostSceneId,
                  })}
                </ChipsText>
                <ChipsText>
                  {text("app.runtime.dialog.surfaceId", {
                    value: runtime.environment.surfaceId ?? text("app.workspace.unknown"),
                  })}
                </ChipsText>
                <ChipsText>
                  {text("app.runtime.dialog.sessionId", {
                    value: runtime.environment.sessionId ?? text("app.workspace.unknown"),
                  })}
                </ChipsText>
                <ChipsText>
                  {text("app.runtime.dialog.diagnostics", {
                    count: runtime.diagnostics.length,
                  })}
                </ChipsText>
              </ChipsStack>
            </ChipsDialog.Body>
            <ChipsDialog.Footer>
              <ChipsDialog.Actions>
                <ChipsDialog.Close>
                  {text("app.runtime.dialog.close")}
                </ChipsDialog.Close>
              </ChipsDialog.Actions>
            </ChipsDialog.Footer>
          </ChipsDialog.Content>
        </ChipsDialog.Root>
      </ChipsStack>
    </ChipsSection>
  );
}
