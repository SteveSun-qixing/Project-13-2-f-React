import React from "react";
import { Button, Result, Space, Spin } from "antd";
import { AppChrome } from "@chips/ui";
import { APP_COMMAND_HANDLER_IDS, type AppCommandHandlerId } from "../commands/app-commands";
import { useAppCommands, type AppCommandRunHandlers } from "../commands/useAppCommands";
import { StartStage } from "../components/StartStage";
import { SheetStage } from "../components/SheetStage";
import { formatMessage } from "../lib/messages";
import { useAppRuntime } from "./AppRuntimeProvider";
import "./app-shell.css";

export function AppShell(): React.ReactElement {
  const runtime = useAppRuntime();
  const handledInvocationRef = React.useRef<string | null>(null);

  /** 本地命令执行（菜单 / 工具栏 / 命令面板 / 快捷键共用） */
  const runHandlers = React.useMemo<AppCommandRunHandlers>(
    () => ({
      fileOpen: () => {
        void runtime.openFile();
      },
      fileSave: () => {
        void runtime.saveWorkbook();
      },
      fileSaveAs: () => {
        void runtime.saveWorkbookAs();
      },
      fileNew: () => {
        runtime.newWorkbook();
      },
      fileExportCsv: () => {
        void runtime.exportActiveCsv();
      },
    }),
    [runtime],
  );

  const commands = useAppCommands({ handlers: runHandlers });

  /** 宿主命令分发：宿主菜单 / 外部调用经 onInvoked 事件回流到同一批运行时动作 */
  React.useEffect(() => {
    const last = commands.lastInvoked;
    if (!last) {
      return;
    }
    const invocationKey = last.invocationId ?? `${last.commandId}:${last.source}`;
    if (handledInvocationRef.current === invocationKey) {
      return;
    }
    handledInvocationRef.current = invocationKey;
    const dispatch: Partial<Record<AppCommandHandlerId, () => void>> = {
      [APP_COMMAND_HANDLER_IDS.fileOpen]: runHandlers.fileOpen,
      [APP_COMMAND_HANDLER_IDS.fileSave]: runHandlers.fileSave,
      [APP_COMMAND_HANDLER_IDS.fileSaveAs]: runHandlers.fileSaveAs,
      [APP_COMMAND_HANDLER_IDS.fileNew]: runHandlers.fileNew,
      [APP_COMMAND_HANDLER_IDS.fileExportCsv]: runHandlers.fileExportCsv,
    };
    dispatch[last.handlerId]?.();
  }, [commands.lastInvoked, runHandlers]);

  let content: React.ReactNode;
  if (runtime.phase === "ready") {
    content = <SheetStage />;
  } else if (runtime.phase === "loading") {
    content = (
      <main className="app-shell__state" aria-label={formatMessage("app.shell.loading")}>
        <Spin size="large" />
        <p className="app-shell__state-text">{formatMessage("stage.status.loading")}</p>
      </main>
    );
  } else if (runtime.phase === "error" && runtime.errorState) {
    content = (
      <main className="app-shell__state" aria-label={runtime.errorState.title}>
        <Result
          status="error"
          title={runtime.errorState.title}
          subTitle={runtime.errorState.detail}
          extra={
            <Space size="small">
              <Button type="primary" onClick={runtime.retryLastTarget}>
                {formatMessage("stage.errorRetry")}
              </Button>
              <Button onClick={runtime.dismissError}>
                {formatMessage("stage.errorBack")}
              </Button>
            </Space>
          }
        />
      </main>
    );
  } else {
    content = <StartStage />;
  }

  return (
    <AppChrome immersive immersiveContentClass="app-shell__fullbleed">
      {content}
    </AppChrome>
  );
}
