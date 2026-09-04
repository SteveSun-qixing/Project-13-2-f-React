import React from "react";
import { App as AntdApp } from "antd";
import { StartHome } from "@chips/ui";
import "./editor.css";
import appIconSvg from "../../assets/icons/app-icon.svg";
import { appConfig } from "../../config/app-config";
import { useDeck } from "../state/deck-store";
import { formatMessage } from "../lib/messages";

const PPTX_DROP_RE = /\.pptx$/i;

export function StartHomeStage(): React.ReactElement {
  const deck = useDeck();
  const { message } = AntdApp.useApp();
  const dragDepthRef = React.useRef(0);
  const [dragActive, setDragActive] = React.useState(false);

  const handleOpenFile = React.useCallback(() => {
    void deck.openFromDialog();
  }, [deck]);

  const handleDropFiles = React.useCallback(
    (files: File[]): void => {
      const firstFile = files.find(
        (file) => PPTX_DROP_RE.test(file.name) || file.type.includes("presentation"),
      );
      if (!firstFile) {
        message.warning(formatMessage("start.hints.dropPptxOnly"));
        return;
      }
      // openDroppedFile 内部解析本地路径（bridge → file.path），web 宿主回退直接读字节
      void deck.openDroppedFile(firstFile);
    },
    [deck, message],
  );

  const handleDragEnter = React.useCallback((event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  }, []);

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault();
  }, []);

  const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragActive(false);
    }
  }, []);

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>): void => {
      event.preventDefault();
      dragDepthRef.current = 0;
      setDragActive(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      handleDropFiles(files);
    },
    [handleDropFiles],
  );

  return (
    <main
      className="start-page-stage"
      data-chips-app={appConfig.appId}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <StartHome
        title={formatMessage("start.title")}
        description={formatMessage("start.description")}
        formatsText={formatMessage("start.formats")}
        openLabel={formatMessage("start.actions.open")}
        createLabel={formatMessage("start.actions.create")}
        shortcutText={formatMessage("start.hints.shortcut")}
        dragActiveText={formatMessage("start.hints.dropToOpen")}
        dragActive={dragActive}
        icon={<img src={appIconSvg} alt="" draggable={false} />}
        onOpen={handleOpenFile}
        onCreate={() => void deck.createNew()}
      />
    </main>
  );
}
