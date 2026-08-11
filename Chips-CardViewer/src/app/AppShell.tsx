import React from "react";
import { AppChrome } from "@chips/ui";
import {
  CARD_VIEWER_COMMAND_HANDLER_IDS,
  CARD_VIEWER_COMMAND_IDS,
} from "../commands/card-viewer-commands";
import { useCardViewerCommands } from "../commands/useCardViewerCommands";
import { CardViewerShell } from "../components/CardViewerShell";
import { ViewerChrome, type ViewerChromeState } from "../components/ViewerChrome";
import { DocumentFileScene } from "../scenes/DocumentFileScene";
import { EmptyScene } from "../scenes/EmptyScene";
import { HostedDocumentScene } from "../scenes/HostedDocumentScene";
import { useAppRuntime } from "./AppRuntimeProvider";

const CARD_VIEWER_TOGGLE_COVER_ACTION_ID = "toggle-cover";
const CARD_VIEWER_DOWNLOAD_ACTION_ID = "download-card";
const DOCUMENT_SURFACE_CHROME_SAFE_BLOCK_START = 96;

function getFileName(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? filePath;
}

export function AppShell(): React.ReactElement {
  const runtime = useAppRuntime();
  const commandsApi = useCardViewerCommands();
  const handledInvocationRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!commandsApi.lastInvoked) {
      return;
    }

    const invocationKey =
      commandsApi.lastInvoked.invocationId ??
      `${commandsApi.lastInvoked.commandId}:${commandsApi.lastInvoked.source}`;
    if (handledInvocationRef.current === invocationKey) {
      return;
    }
    handledInvocationRef.current = invocationKey;

    if (commandsApi.lastInvoked.handlerId === CARD_VIEWER_COMMAND_HANDLER_IDS.openFile) {
      void runtime.openFile();
    }
  }, [commandsApi.lastInvoked, runtime]);

  const returnHomeLabel = runtime.t("card-viewer.actions.returnHome");
  const coverActionLabel =
    runtime.viewerMode === "cover"
      ? runtime.t("card-viewer.actions.viewContent")
      : runtime.t("card-viewer.actions.viewCover");
  const usesExternalChrome = runtime.openedTarget?.kind === "document";
  const chromeMetaLines = React.useMemo(() => {
    const target = runtime.openedTarget;
    if (!target) {
      return [];
    }

    const lines: string[] = [];
    if (target.createdAt) {
      const createdDate = new Date(target.createdAt);
      if (!Number.isNaN(createdDate.getTime())) {
        lines.push(
          runtime.t("card-viewer.chrome.createdAt", { date: createdDate.toLocaleDateString("zh-CN") }),
        );
      }
    }
    if (target.kind === "file") {
      const fileName = getFileName(target.filePath);
      if (target.cover?.title && target.cover.title !== fileName) {
        lines.push(fileName);
      }
    }
    return lines;
  }, [runtime.openedTarget, runtime.t]);
  const chromeState = React.useMemo<ViewerChromeState>(
    () => ({
      title: runtime.openedTarget ? runtime.activeTitle ?? undefined : undefined,
      metaLines: chromeMetaLines,
      back: {
        label: returnHomeLabel,
        enabled: Boolean(runtime.openedTarget),
        handledByPlugin: true,
      },
      actions: [
        ...(runtime.openedTarget && runtime.canViewCover
          ? [
              {
                id: CARD_VIEWER_TOGGLE_COVER_ACTION_ID,
                label: coverActionLabel,
                icon: runtime.viewerMode === "cover" ? "document" : "cover",
              },
            ]
          : []),
        ...(runtime.canDownloadActiveCard
          ? [
              {
                id: CARD_VIEWER_DOWNLOAD_ACTION_ID,
                label: runtime.t("card-viewer.actions.downloadCard"),
                icon: "download",
              },
            ]
          : []),
      ],
      safeBlockStart: DOCUMENT_SURFACE_CHROME_SAFE_BLOCK_START,
    }),
    [
      chromeMetaLines,
      coverActionLabel,
      returnHomeLabel,
      runtime.activeTitle,
      runtime.canDownloadActiveCard,
      runtime.canViewCover,
      runtime.openedTarget,
      runtime.t,
      runtime.viewerMode,
    ],
  );
  const handleChromeAction = React.useCallback(
    (actionId: string) => {
      if (actionId === CARD_VIEWER_DOWNLOAD_ACTION_ID) {
        void runtime.downloadActiveCard();
        return;
      }
      if (actionId !== CARD_VIEWER_TOGGLE_COVER_ACTION_ID) {
        return;
      }
      if (runtime.viewerMode === "cover") {
        runtime.showContent();
        return;
      }
      runtime.showCover();
    },
    [runtime],
  );

  const content =
    runtime.openedTarget === null ? (
      <EmptyScene
        onOpenFile={() => void commandsApi.invokeCommand(CARD_VIEWER_COMMAND_IDS.openFile, "api")}
      />
    ) : runtime.openedTarget.kind === "document" ? (
      <HostedDocumentScene target={runtime.openedTarget} />
    ) : (
      <DocumentFileScene target={runtime.openedTarget} />
    );
  const shell = (
    <CardViewerShell
      surfaceMode={runtime.surfaceMode}
      content={content}
      action={null}
    />
  );

  if (runtime.openedTarget === null) {
    return (
      <AppChrome paletteShortcut="Mod+P">
        {shell}
      </AppChrome>
    );
  }

  return (
    <ViewerChrome.Provider
      client={runtime.client}
      state={chromeState}
      externalChrome={usesExternalChrome}
      onBack={runtime.returnHome}
      onAction={handleChromeAction}
    >
      {shell}
      <ViewerChrome.Layer />
    </ViewerChrome.Provider>
  );
}
