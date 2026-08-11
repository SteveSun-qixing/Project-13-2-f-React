import { useEffect, useRef } from "react";
import { AppChrome, StateBoundary } from "@chips/ui";
import { APP_COMMAND_HANDLER_IDS } from "../commands/app-commands";
import { useAppCommands } from "../commands/useAppCommands";
import { formatMessage } from "../lib/messages";
import { IconMakerScene } from "../icon-workbench/IconMakerScene";
import { runIconMakerCliCommand } from "../icon-workbench/cli-runner";
import { useAppRuntime } from "./AppRuntimeProvider";

export function AppShell() {
  const runtime = useAppRuntime();
  const handledInvocationRef = useRef<string | null>(null);
  const commands = useAppCommands();

  useEffect(() => {
    if (!commands.lastInvoked) {
      return;
    }

    const invocationKey =
      commands.lastInvoked.invocationId ??
      `${commands.lastInvoked.commandId}:${commands.lastInvoked.source}`;
    if (handledInvocationRef.current === invocationKey) {
      return;
    }
    handledInvocationRef.current = invocationKey;

    if (commands.lastInvoked.handlerId === APP_COMMAND_HANDLER_IDS.focusImporter) {
      document.getElementById("icon-maker-file-input-trigger")?.focus();
    }
    if (commands.lastInvoked.handlerId === APP_COMMAND_HANDLER_IDS.generateIcons) {
      if (commands.lastInvoked.source === "cli") {
        void runIconMakerCliCommand({
          client: commands.client,
          payload: commands.lastInvoked.payload,
          context: commands.lastInvoked.context,
          launchParams: runtime.environment.launchParams,
        }).catch((error: unknown) => {
          runtime.pushDiagnostic({
            code: error && typeof error === "object" && "message" in error
              ? String((error as { message?: unknown }).message)
              : "ICONMAKER_CLI_FAILED",
            message: "图标工坊 CLI 命令执行失败。",
            source: "cli",
          });
        });
        return;
      }
      document.getElementById("icon-maker-generate-action")?.focus();
    }
  }, [commands.lastInvoked, runtime]);

  const isLoading = commands.phase === "registering" || !runtime.ready;

  return (
    <AppChrome paletteShortcut="Mod+P">
      <StateBoundary loading={isLoading} minHeight={320}>
        <main className="app-shell__workspace" aria-label="图标生成工作台">
          <IconMakerScene text={formatMessage} />
        </main>
      </StateBoundary>
    </AppChrome>
  );
}
