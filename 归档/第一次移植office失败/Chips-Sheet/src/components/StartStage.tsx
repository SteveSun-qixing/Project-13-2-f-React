import React from "react";
import { StartHome } from "@chips/ui";
import { appConfig } from "../../config/app-config";
import appIcon from "../../assets/icons/app-icon.svg";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import { formatMessage } from "../lib/messages";
import "./start-stage.css";

/** 拖入文件按扩展名过滤：非表格文件不进入打开链路 */
const DROPPED_FILE_PATTERN = /\.(xlsx|xlsm|csv)$/i;

export function StartStage(): React.ReactElement {
  const runtime = useAppRuntime();
  const dragDepthRef = React.useRef(0);
  const [dragActive, setDragActive] = React.useState(false);

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
      const files = Array.from(event.dataTransfer.files ?? []).filter((file) =>
        DROPPED_FILE_PATTERN.test(file.name),
      );
      if (files.length === 0) {
        return;
      }
      void runtime.dropFiles(files);
    },
    [runtime],
  );

  React.useEffect(() => {
    return () => {
      dragDepthRef.current = 0;
    };
  }, []);

  return (
    <main
      className="start-stage"
      data-chips-app={appConfig.appId}
      aria-label={formatMessage("start.ariaLabel")}
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
        icon={<img src={appIcon} alt="" draggable={false} />}
        onOpen={() => {
          void runtime.openFile();
        }}
        onCreate={() => {
          void runtime.newWorkbook();
        }}
      />
    </main>
  );
}
