import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { App as AntdApp } from "antd";
import { AppChrome, StateBoundary, useCommandShortcuts } from "@chips/ui";
import { usePdfCommands } from "../commands/useAppCommands";
import { ViewerBridgeProvider, useViewerBridgeRef } from "../commands/viewer-bridge";
import { DocumentScene } from "../components/DocumentScene";
import { PasswordDialog } from "../components/PasswordDialog";
import { StartScene } from "../components/StartScene";
import { usePdfRuntime } from "./PdfRuntimeProvider";
import { formatMessage } from "../lib/messages";
import { useAppRuntime } from "./AppRuntimeProvider";
import { resolveLaunchPdfTarget } from "../utils/launch-resource";
import "./app-shell.css";

/**
 * 启动参数哨兵：只在首次运行时解析一次 launchParams 中的打开目标。
 * 优先级 resourceOpen.filePath ?? targetPath ?? resourceOpen.resourceId；
 * 无目标停留起始页。
 */
function useLaunchTargetEffect(): void {
  const runtime = useAppRuntime();
  const pdfRuntime = usePdfRuntime();
  const handledRef = useRef(false);
  const launchParams = runtime.environment.launchParams;
  useEffect(() => {
    if (!runtime.ready) return;
    if (handledRef.current) return;
    handledRef.current = true;
    const target = resolveLaunchPdfTarget({ launchParams });
    if (!target) return;
    void pdfRuntime.openTarget(target);
  }, [handledRef, launchParams, pdfRuntime, runtime.ready]);
}

function LoadingBoundary({ loading, children }: { loading: boolean; children: ReactNode }): ReactElement {
  if (loading) {
    return (
      <div className="app-shell-loading" aria-busy="true">
        <span>{formatMessage("app.shell.loading")}</span>
      </div>
    );
  }
  return <>{children}</>;
}

/** 应用外壳：起始页 / 文档两场景 + 全局命令 + 密码对话框 */
export function AppShell(): React.ReactElement {
  const runtime = useAppRuntime();
  const pdfRuntime = usePdfRuntime();
  const { message } = AntdApp.useApp();
  const bridgeRef = useViewerBridgeRef();
  const commands = usePdfCommands();

  useLaunchTargetEffect();

  const isLoading = commands.phase === "registering" || !runtime.ready;

  useCommandShortcuts(commands.commands);

  return (
    <ViewerBridgeProvider value={bridgeRef}>
      <AppChrome paletteShortcut="Mod+P">
        <StateBoundary loading={isLoading} minHeight={320}>
          <main className="app-shell__workspace" aria-label={formatMessage("app.shell.subtitle")}>
            {runtime.activeSceneId === "document" ? <DocumentScene /> : <StartScene />}
          </main>
        </StateBoundary>
      </AppChrome>
      <PasswordDialog
        open={pdfRuntime.status === "password"}
        wrong={pdfRuntime.passwordWrong}
        loading={pdfRuntime.status === "loading"}
        onSubmit={(password) => {
          void pdfRuntime.submitPassword(password);
        }}
        onCancel={() => {
          pdfRuntime.cancelPassword();
          message.info(formatMessage("pdf.dialog.password.cancel"));
        }}
      />
    </ViewerBridgeProvider>
  );
}
