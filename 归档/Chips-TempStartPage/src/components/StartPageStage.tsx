import React from "react";
import { App as AntdApp } from "antd";
import type { Client } from "chips-sdk";
import { StartHome } from "./StartHome";
import "./start-page-stage.css";
import appIcon from "../../assets/icons/app-icon.svg";
import { appConfig } from "../../config/app-config";
import { createLogger } from "../../config/logging";
import { formatMessage } from "../lib/messages";

const logger = createLogger("start-page-stage");

export interface StartPageStageProps {
  client: Client | null;
}

function resolveDroppedFilePath(client: Client | null, file: File): string | null {
  const bridgePath = client?.platform.getPathForFile(file);
  if (bridgePath) {
    return bridgePath;
  }
  const fallbackPath = (file as File & { path?: string }).path;
  return fallbackPath ?? null;
}

export function StartPageStage(props: StartPageStageProps): React.ReactElement {
  const { client } = props;
  const { message } = AntdApp.useApp();
  const dragDepthRef = React.useRef(0);
  const [dragActive, setDragActive] = React.useState(false);

  const handleOpenFile = React.useCallback(async (): Promise<void> => {
    if (!client) {
      return;
    }
    try {
      const selected = await client.platform.openFile({
        title: formatMessage("start-home.dialogs.openFileTitle"),
        mode: "file",
        allowMultiple: false,
        mustExist: true,
      });
      const firstPath = Array.isArray(selected) ? selected[0] : undefined;
      if (firstPath) {
        logger.info("已选择文件", firstPath);
      }
    } catch (error) {
      logger.warn("打开文件失败", error);
      message.warning(formatMessage("start-home.hints.bridgeUnavailable"));
    }
  }, [client, message]);

  const handleDropFiles = React.useCallback(
    (files: File[]): void => {
      const firstFile = files[0];
      if (!firstFile) {
        return;
      }
      const droppedPath = resolveDroppedFilePath(client, firstFile);
      if (droppedPath) {
        logger.info("已拖入文件", droppedPath);
      } else {
        logger.warn("拖入文件缺少本地路径");
      }
    },
    [client],
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
        title={formatMessage("start-home.title")}
        description={formatMessage("start-home.description")}
        formatsText={formatMessage("start-home.formats")}
        openLabel={formatMessage("start-home.actions.open")}
        shortcutText={formatMessage("start-home.hints.shortcut")}
        dragActiveText={formatMessage("start-home.hints.dropToOpen")}
        dragActive={dragActive}
        icon={<img src={appIcon} alt="" draggable={false} />}
        onOpen={() => {
          void handleOpenFile();
        }}
      />
    </main>
  );
}
