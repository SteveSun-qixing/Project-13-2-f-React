import React from "react";
import { App as AntdApp, Button, Space, Tooltip } from "antd";
import {
  DownloadOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  SaveFilled,
} from "@ant-design/icons";
import { appConfig } from "../../config/app-config";
import { createLogger } from "../../config/logging";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import { formatMessage } from "../lib/messages";
import { applyWorkbookModelToUniver } from "../sheet/univer-sync";
import { bootSheetRuntime, installSheetRuntimePatches, type SheetRuntimePatches, type UniverRuntime } from "../sheet/univer-state";
import { createContentChangeListener } from "../sheet/content-change";
import "./sheet-stage.css";

const logger = createLogger({ scope: "sheet-stage" });

/** 多次挂载时保证容器 id 唯一（React StrictMode 卸载重挂也不会复用脏容器） */
let containerSequence = 0;

function nextContainerId(): string {
  containerSequence += 1;
  return `chips-sheet-univer-${containerSequence}`;
}

export function SheetStage(): React.ReactElement {
  const runtime = useAppRuntime();
  const { message } = AntdApp.useApp();
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const engineRef = React.useRef<UniverRuntime | null>(null);
  const patchesRef = React.useRef<SheetRuntimePatches | null>(null);
  // 首帧渲染就把 id 写入 DOM，保证引擎引导时容器已存在
  const [containerId] = React.useState<string>(nextContainerId);

  /** 引擎引导：容器挂载后执行一次；打开新文件时通过 workbookRevision 驱动重灌 */
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const id = containerId;
    let boot: UniverRuntime | null = null;
    try {
      boot = bootSheetRuntime({ containerId: id });
      patchesRef.current = installSheetRuntimePatches(boot);
      engineRef.current = boot;
      runtime.registerRuntime(boot);
      const offDirty = boot.univerAPI.onCommandExecuted(
        createContentChangeListener(runtime.markDirty),
      );
      logger.info("表格引擎已启动", { containerId: id });
      return () => {
        offDirty.dispose();
        patchesRef.current?.sheetRenameFix.dispose();
        patchesRef.current?.formulaLexerFix.dispose();
        patchesRef.current = null;
        runtime.registerRuntime(null);
        engineRef.current = null;
        boot?.univer.dispose();
        host.replaceChildren();
        logger.info("表格引擎已销毁", { containerId: id });
      };
    } catch (error) {
      logger.error("表格引擎启动失败", error);
      message.error(
        formatMessage("message.engineBootFailed", {
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
      return;
    }
  }, []);

  /** 全量快照灌入：pendingModel / workbookRevision 变化即重灌（打开新文件/新建） */
  React.useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !containerId) {
      return;
    }
    const model = runtime.pendingModel;
    if (!model) {
      return;
    }
    try {
      applyWorkbookModelToUniver(engine, model);
      logger.info("工作簿快照已灌入引擎", {
        sheets: model.sheets.length,
        revision: runtime.workbookRevision,
      });
    } catch (error) {
      logger.error("工作簿快照灌入失败", error);
      message.error(
        formatMessage("message.applySnapshotFailed", {
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }, [runtime.pendingModel, runtime.workbookRevision, containerId]);

  const busy = runtime.isBusy;
  const dirtyLabel = runtime.isDirty
    ? formatMessage("stage.status.unsaved")
    : formatMessage("stage.status.saved");

  return (
    <section className="sheet-stage" aria-label={formatMessage("stage.ariaLabel")}>
      <header className="sheet-stage__bar" data-chips-app={appConfig.appId}>
        <div className="sheet-stage__file">
          <span className="sheet-stage__file-name" title={runtime.session?.fileName ?? ""}>
            {runtime.session?.fileName ?? formatMessage("stage.untitled")}
          </span>
          <span
            className={`sheet-stage__dirty${runtime.isDirty ? " sheet-stage__dirty--unsaved" : ""}`}
          >
            {dirtyLabel}
          </span>
        </div>
        <Space size="small" wrap={false} className="sheet-stage__actions">
          <Tooltip title={formatMessage("command.file.open.description")}>
            <Button
              icon={<FolderOpenOutlined />}
              onClick={() => void runtime.openFile()}
              disabled={busy}
            >
              {formatMessage("start.actions.open")}
            </Button>
          </Tooltip>
          <Tooltip title={formatMessage("command.file.save.description")}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => void runtime.saveWorkbook()}
              disabled={busy}
            >
              {formatMessage("stage.actions.save")}
            </Button>
          </Tooltip>
          <Tooltip title={formatMessage("command.file.saveAs.description")}>
            <Button
              icon={<SaveFilled />}
              onClick={() => void runtime.saveWorkbookAs()}
              disabled={busy}
            >
              {formatMessage("stage.actions.saveAs")}
            </Button>
          </Tooltip>
          <Tooltip title={formatMessage("command.file.new.description")}>
            <Button icon={<FileAddOutlined />} onClick={runtime.newWorkbook} disabled={busy}>
              {formatMessage("stage.actions.new")}
            </Button>
          </Tooltip>
          <Tooltip title={formatMessage("command.file.exportCsv.description")}>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => void runtime.exportActiveCsv()}
              disabled={busy}
            >
              {formatMessage("stage.actions.exportCsv")}
            </Button>
          </Tooltip>
        </Space>
      </header>
      <div className="sheet-stage__surface">
        <div id={containerId} className="sheet-stage__engine" ref={hostRef} />
      </div>
    </section>
  );
}
