import { useCallback, useEffect, useState } from "react";
import { Button, message, Space, Typography } from "antd";
import { FilePdfOutlined, FileTextOutlined, ProjectOutlined, TableOutlined } from "@ant-design/icons";
import { StartHome } from "@chips/ui";
import { createPdfDocument, createSlideDocument, createWordDocument, pickOfficeDocument } from "../bridge/new-document";
import { formatMessage } from "../lib/messages";
import { OFFICE_SCENE_IDS } from "../app/scene-registry";
import { useAppRuntime } from "../app/AppRuntimeProvider";

export function StartScene(): React.ReactElement {
  const runtime = useAppRuntime();
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const openFirstPath = useCallback(
    async (paths: string[] | null): Promise<void> => {
      if (!paths || paths.length === 0) {
        return;
      }
      await runtime.openDocumentPath(paths[0]);
    },
    [runtime],
  );

  const handleOpen = useCallback(async (): Promise<void> => {
    if (!runtime.client) {
      return;
    }
    try {
      const paths = await pickOfficeDocument(runtime.client);
      await openFirstPath(paths);
    } catch (error) {
      message.error(error instanceof Error ? error.message : formatMessage("office.start.error"));
    }
  }, [openFirstPath, runtime.client]);

  const handleCreate = useCallback(
    async (
      create: (client: NonNullable<typeof runtime.client>) => Promise<{ sceneId: string; opened: { path: string } }>,
    ): Promise<void> => {
      if (!runtime.client || busy) {
        return;
      }
      setBusy(true);
      try {
        const created = await create(runtime.client);
        await runtime.openDocumentPath(created.opened.path);
      } catch (error) {
        message.error(error instanceof Error ? error.message : formatMessage("office.start.error"));
      } finally {
        setBusy(false);
      }
    },
    [busy, runtime.client],
  );

  useEffect(() => {
    const onDragOver = (event: DragEvent): void => {
      event.preventDefault();
      setDragActive(true);
    };
    const onDragLeave = (event: DragEvent): void => {
      if (event.relatedTarget === null) {
        setDragActive(false);
      }
    };
    const onDrop = (event: DragEvent): void => {
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer?.files?.[0];
      if (!file || !runtime.client) {
        return;
      }
      const path = runtime.client.platform.getPathForFile(file);
      void runtime.openDocumentPath(path);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [runtime.client]);

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        overflow: "auto",
      }}
    >
      <StartHome
        title={formatMessage("office.start.title")}
        description={formatMessage("office.start.description")}
        formatsText={formatMessage("office.start.formats")}
        openLabel={formatMessage("office.start.open")}
        shortcutText={formatMessage("office.start.openShortcut")}
        dragActiveText={formatMessage("office.start.dragActive")}
        dragActive={dragActive}
        icon={<FileTextOutlined style={{ fontSize: 44 }} />}
        onOpen={() => void handleOpen()}
      />
      <Space size="small" wrap>
        <Button
          icon={<FileTextOutlined />}
          disabled={busy}
          onClick={() => void handleCreate((client) => createWordDocument(client))}
        >
          {formatMessage("office.start.createWord")}
        </Button>
        <Button
          icon={<TableOutlined />}
          disabled={busy}
          onClick={() => void runtime.setActiveSceneId(OFFICE_SCENE_IDS.sheet)}
        >
          {formatMessage("office.start.createSheet")}
        </Button>
        <Button
          icon={<ProjectOutlined />}
          disabled={busy}
          onClick={() => void handleCreate((client) => createSlideDocument(client))}
        >
          {formatMessage("office.start.createSlide")}
        </Button>
        <Button
          icon={<FilePdfOutlined />}
          disabled={busy}
          onClick={() => void handleCreate((client) => createPdfDocument(client))}
        >
          {formatMessage("office.start.createPdf")}
        </Button>
      </Space>
      {runtime.diagnostics.length > 0 && (
        <Typography.Text type="secondary" style={{ display: "block" }}>
          {runtime.diagnostics[runtime.diagnostics.length - 1].message}
        </Typography.Text>
      )}
    </div>
  );
}
