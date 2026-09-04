import React from "react";
import { App as AntdApp } from "antd";
import { StartHome } from "@chips/ui";
import { useWordRuntime } from "../app/AppRuntimeProvider";
import { formatMessage } from "../lib/messages";
import "./start-page-stage.css";
import appIcon from "../../assets/icons/app-icon.svg";

export function StartPageStage(): React.ReactElement {
  const runtime = useWordRuntime();
  const { message } = AntdApp.useApp();
  const dragDepthRef = React.useRef(0);
  const [dragActive, setDragActive] = React.useState(false);

  const handleOpenFile = (): void => {
    void runtime.openDocumentFromDialog();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault();
  };

  const handleDragLeave = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    const file = Array.from(event.dataTransfer.files ?? [])[0];
    if (!file) {
      return;
    }
    if (!/\.docx$/i.test(file.name)) {
      message.warning(formatMessage("message.dropInvalid"));
      return;
    }
    void runtime.openDroppedFile(file);
  };

  return (
    <main
      className="start-page-stage"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <StartHome
        title={formatMessage("start-home.title")}
        description={formatMessage("start-home.description")}
        formatsText={formatMessage("start-home.formats")}
        openLabel={formatMessage("start-home.actions.open")}
        shortcutText={formatMessage("start-home.hints.shortcut")}
        dragActiveText={formatMessage("start-home.hints.dropToOpen")}
        dragActive={dragActive}
        icon={<img src={appIcon} alt="" draggable={false} />}
        onOpen={handleOpenFile}
        createLabel={formatMessage("start-home.actions.create")}
        onCreate={() => {
          void runtime.createDocument();
        }}
      />
    </main>
  );
}
