import { useEffect, useRef } from "react";
import { Segmented } from "antd";
import { AppChrome, StateBoundary, type MenuBarGroup } from "@chips/ui";
import { APP_COMMAND_HANDLER_IDS } from "../commands/app-commands";
import { useAppCommands } from "../commands/useAppCommands";
import { formatMessage } from "../lib/messages";
import { MainScene } from "../scenes/MainScene";
import { SettingsScene } from "../scenes/SettingsScene";
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

    if (commands.lastInvoked.handlerId === APP_COMMAND_HANDLER_IDS.openWorkspace) {
      runtime.setActiveSceneId("main");
    }
    if (commands.lastInvoked.handlerId === APP_COMMAND_HANDLER_IDS.openSettings) {
      runtime.setActiveSceneId("settings");
    }
  }, [commands.lastInvoked, runtime]);

  const menus: MenuBarGroup[] = [
    { menuId: "file", label: formatMessage("app.commands.menu.file"), commands: commands.commands },
  ];

  const toolbarItems = commands.commands.filter((command) => command.toolbarId === "main");
  const isLoading = commands.phase === "registering" || !runtime.ready;

  return (
    <AppChrome
      appName={formatMessage("app.identity.displayName")}
      menus={menus}
      toolbarItems={toolbarItems}
      paletteShortcut="Mod+P"
    >
      <StateBoundary loading={isLoading} minHeight={320}>
        <main className="app-shell__workspace" aria-label={formatMessage("app.shell.subtitle")}>
          <div className="app-shell__scene-switch">
            <Segmented
              value={runtime.activeSceneId}
              onChange={(value) => runtime.setActiveSceneId(value as "main" | "settings")}
              options={[
                { label: formatMessage("app.scenes.main.title"), value: "main" },
                { label: formatMessage("app.scenes.settings.title"), value: "settings" },
              ]}
            />
          </div>
          {runtime.activeSceneId === "main" ? <MainScene /> : <SettingsScene />}
        </main>
      </StateBoundary>
    </AppChrome>
  );
}
