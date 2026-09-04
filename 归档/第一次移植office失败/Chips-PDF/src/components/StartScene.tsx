import { useCallback, useRef, useState } from "react";
import type { DragEvent, ReactElement } from "react";
import { App as AntdApp } from "antd";
import { StartHome } from "@chips/ui";
import { usePdfRuntime } from "../app/PdfRuntimeProvider";
import { openPdfDialog } from "../runtime/file-access";
import { formatMessage } from "../lib/messages";
import appIcon from "../../assets/icons/app-icon.svg";

const PDF_DRAG_TYPES = new Set(["application/pdf", "application/x-pdf"]);

function resolveDroppedPath(runtimeClient: StartSceneRuntime, file: File): string | null {
  const client = runtimeClient.client;
  if (!client) return null;
  const bridgePath = client.platform.getPathForFile(file);
  if (bridgePath) return bridgePath;
  return (file as File & { path?: string }).path ?? null;
}

interface StartSceneRuntime {
  client: ReturnType<typeof usePdfRuntime>["client"];
}

function hasPdfFile(files: FileList | undefined): boolean {
  if (!files || files.length === 0) return false;
  const first = files[0];
  if (!first) return false;
  return PDF_DRAG_TYPES.has(first.type) || /\.pdf$/i.test(first.name);
}

/** 起始页场景：整页拖放 + 打开对话框 */
export function StartScene(): ReactElement {
  const runtime = usePdfRuntime();
  const { message } = AntdApp.useApp();
  const dragDepthRef = useRef(0);
  const [dragActive, setDragActive] = useState(false);

  const handleOpenFile = useCallback(async (): Promise<void> => {
    try {
      const path = await openPdfDialog(runtime.client, formatMessage("pdf.dialog.openFile.title"));
      if (!path) return;
      await runtime.openTarget({
        sourceId: path,
        filePath: path,
        fileName: path.split(/[\\/]/).pop() ?? path,
      });
    } catch {
      message.warning(formatMessage("pdf.error.bridgeUnavailable"));
    }
  }, [message, runtime]);

  const handleDropFile = useCallback(
    (file: File): void => {
      const path = resolveDroppedPath(runtime, file);
      if (!path) {
        message.warning(formatMessage("pdf.error.bridgeUnavailable"));
        return;
      }
      void runtime.openDroppedFile(file, (f) => resolveDroppedPath(runtime, f));
    },
    [message, runtime],
  );

  const onDragEnter = useCallback((e: DragEvent<HTMLElement>): void => {
    e.preventDefault();
    dragDepthRef.current += 1;
    if (hasPdfFile(e.dataTransfer?.files)) setDragActive(true);
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLElement>): void => {
    e.preventDefault();
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLElement>): void => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLElement>): void => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setDragActive(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      handleDropFile(file);
    },
    [handleDropFile],
  );

  return (
    <main
      className="pdf-start-scene"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
