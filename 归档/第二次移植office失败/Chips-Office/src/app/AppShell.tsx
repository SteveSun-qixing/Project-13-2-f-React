import { useEffect, useRef } from "react";
import { Segmented } from "antd";
import { AppChrome, StateBoundary, type MenuBarGroup } from "@chips/ui";
import { APP_COMMAND_HANDLER_IDS } from "../commands/app-commands";
import { useAppCommands } from "../commands/useAppCommands";
import { formatMessage } from "../lib/messages";
import { MainScene } from "../scenes/MainScene";
import { DocumentScene } from "../scenes/DocumentScene";
import { SettingsScene } from "../scenes/SettingsScene";
import { WordEditorScene } from "../scenes/WordEditorScene";
import { SlideScene } from "./SlideScene";
import { SheetScene } from "../apps/sheet/SheetScene";
import { useAppRuntime } from "./AppRuntimeProvider";

export type OfficeAppSceneId = "main" | "settings" | "word-editor" | "document" | "slide" | "sheet";

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
    if (commands.lastInvoked.handlerId === APP_COMMAND_HANDLER_IDS.openDocument) {
      runtime.setActiveSceneId("document");
    }
  }, [commands.lastInvoked, runtime]);

  const menus: MenuBarGroup[] = [
    { menuId: "file", label: formatMessage("app.commands.menu.file"), commands: commands.commands },
  ];

  const toolbarItems = commands.commands.filter((command) => command.toolbarId === "main");
  const isLoading = commands.phase === "registering" || !runtime.ready;

  const sceneOptions = [
    { label: formatMessage("app.scenes.main.title"), value: "main" },
    { label: formatMessage("app.scenes.wordEditor.title"), value: "word-editor" },
    { label: formatMessage("app.scenes.document.title"), value: "document" },
    { label: formatMessage("app.scenes.slide.title"), value: "slide" },
    { label: formatMessage("app.scenes.sheet.title"), value: "sheet" },
    { label: formatMessage("app.scenes.settings.title"), value: "settings" },
  ];

  const renderScene = () => {
    switch (runtime.activeSceneId) {
      case "word-editor":
        return <WordEditorScene />;
      case "document":
        return <DocumentScene />;
      case "slide":
        return <SlideScene />;
      case "sheet":
        return <SheetScene />;
      case "settings":
        return <SettingsScene />;
      default:
        return <MainScene />;
    }
  };

  return (
    <AppChrome
      paletteShortcut="Mod+P"
    >
      <StateBoundary loading={isLoading} minHeight={320}>
        <main className="app-shell__workspace" aria-label={formatMessage("app.shell.subtitle")}>
          <div className="app-shell__scene-switch">
            <Segmented
              value={runtime.activeSceneId}
              onChange={(value) => runtime.setActiveSceneId(value as OfficeAppSceneId)}
              options={sceneOptions}
            />
          </div>
          {renderScene()}
        </main>
      </StateBoundary>
    </AppChrome>
  );
}
