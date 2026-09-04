import React, { useEffect, useMemo, useRef } from "react";
import { AppChrome, StateBoundary } from "@chips/ui";
import {
  APP_COMMAND_HANDLER_IDS,
  type AppCommandHandlers,
} from "../commands/app-commands";
import { useAppCommands } from "../commands/useAppCommands";
import { formatMessage } from "../lib/messages";
import { WordWorkspace } from "../components/WordWorkspace";
import { StartPageStage } from "../components/StartPageStage";
import { useWordRuntime } from "./AppRuntimeProvider";
import "./app-shell.css";

export function AppShell(): React.ReactElement {
  const runtime = useWordRuntime();
  const handledInvocationRef = useRef<string | null>(null);

  const handlers = useMemo<AppCommandHandlers>(
    () => ({
      fileNew: () => {
        void runtime.createDocument();
      },
      fileOpen: () => {
        void runtime.openDocumentFromDialog();
      },
      fileSave: () => {
        void runtime.saveDocument({ saveAs: false });
      },
      fileSaveAs: () => {
        void runtime.saveDocument({ saveAs: true });
      },
      filePrint: () => {
        runtime.printDocument();
      },
      viewZoomIn: () => {
        runtime.zoomIn();
      },
      viewZoomOut: () => {
        runtime.zoomOut();
      },
      viewZoomReset: () => {
        runtime.zoomReset();
      },
    }),
    [runtime],
  );

  const commands = useAppCommands({ client: runtime.client ?? undefined, handlers });

  // Host 命令分发（菜单/面板/CLI 触发的 command.invoke 事件）
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

    const handlerId = commands.lastInvoked.handlerId;
    if (handlerId === APP_COMMAND_HANDLER_IDS.fileNew) {
      void runtime.createDocument();
    } else if (handlerId === APP_COMMAND_HANDLER_IDS.fileOpen) {
      void runtime.openDocumentFromDialog();
    } else if (handlerId === APP_COMMAND_HANDLER_IDS.fileSave) {
      void runtime.saveDocument({ saveAs: false });
    } else if (handlerId === APP_COMMAND_HANDLER_IDS.fileSaveAs) {
      void runtime.saveDocument({ saveAs: true });
    } else if (handlerId === APP_COMMAND_HANDLER_IDS.filePrint) {
      runtime.printDocument();
    } else if (handlerId === APP_COMMAND_HANDLER_IDS.viewZoomIn) {
      runtime.zoomIn();
    } else if (handlerId === APP_COMMAND_HANDLER_IDS.viewZoomOut) {
      runtime.zoomOut();
    } else if (handlerId === APP_COMMAND_HANDLER_IDS.viewZoomReset) {
      runtime.zoomReset();
    }
  }, [commands.lastInvoked, runtime]);

  const showStart = runtime.activeSceneId === "start";

  return (
    <AppChrome paletteShortcut="Mod+P">
      <StateBoundary loading={!runtime.ready} minHeight={320}>
        <div className="app-shell">
          <div
            className={`app-shell__document${showStart ? " app-shell__document--hidden" : ""}`}
            aria-hidden={showStart}
          >
            <WordWorkspace />
          </div>
          {showStart ? (
            <div className="app-shell__start">
              <StartPageStage />
            </div>
          ) : null}
        </div>
      </StateBoundary>
    </AppChrome>
  );
}
