import { useEffect, useMemo, useRef } from "react";
import { Result, Spin } from "antd";
import { AppChrome } from "@chips/ui";
import { useAppCommands } from "../commands/useAppCommands";
import { formatMessage } from "../lib/messages";
import { useDeck } from "../state/deck-store";
import { StartHomeStage } from "../components/StartHomeStage";
import { EditorScene } from "../components/EditorScene";

export function AppShell() {
  const deck = useDeck();
  const launchHandledRef = useRef(false);

  const handlers = useMemo(
    () => ({
      fileOpen: () => void deck.openFromDialog(),
      fileNew: () => void deck.createNew(),
      fileSave: () => void deck.save(),
      fileSaveAs: () => void deck.saveAs(),
      fileExportPng: () => void deck.exportCurrentPng(),
      editUndo: deck.undo,
      editRedo: deck.redo,
      viewZoomIn: deck.zoomIn,
      viewZoomOut: deck.zoomOut,
      viewZoomReset: deck.zoomReset,
      slideAdd: () =>
        deck.apply({
          op: "addBlankSlide",
          target: { slide: deck.currentIndex },
        }),
      slideDuplicate: () =>
        deck.apply({
          op: "duplicateSlide",
          target: { slide: deck.currentIndex },
        }),
      slideDelete: () =>
        deck.apply({ op: "deleteSlide", target: { slide: deck.currentIndex } }),
    }),
    [deck],
  );

  useAppCommands({ handlers });

  // 启动目标只处理一次（ref 哨兵）：宿主带 resourceOpen/targetPath 启动时直接
  // 进入文档；无目标停留起始页。
  useEffect(() => {
    if (launchHandledRef.current) return;
    if (!deck.launchTarget) return;
    launchHandledRef.current = true;
    void deck.openFromLaunchTarget(deck.launchTarget);
  }, [deck]);

  return (
    <AppChrome paletteShortcut="Mod+P">
      <div className="app-shell">
        {deck.status === "empty" ? <StartHomeStage /> : null}
        {deck.status === "loading" ? (
          <div className="app-shell__loading" role="status">
            <Spin size="large" />
            <span className="app-shell__loading-text">{formatMessage("deck.state.loading")}</span>
          </div>
        ) : null}
        {deck.status === "error" ? (
          <div className="app-shell__error">
            <Result
              status="error"
              title={formatMessage("deck.state.errorTitle")}
              subTitle={deck.errorMessage ?? undefined}
            />
          </div>
        ) : null}
        {deck.status === "ready" ? <EditorScene /> : null}
      </div>
    </AppChrome>
  );
}
