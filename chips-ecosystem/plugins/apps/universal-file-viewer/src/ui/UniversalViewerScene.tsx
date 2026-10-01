import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Spin, theme } from '@chips/ui';
import type { PreviewToolbarRenderContext } from '../engine';
import {
  APP_COMMAND_IDS,
  isAppCommandId,
  type AppCommandStatus,
} from '../commands/appCommands';
import { useAppCommands } from '../commands/useAppCommands';
import { resolveFileExtension } from '../domain/file-kind';
import { EngineStage } from './EngineStage';
import { InfoPanel } from './InfoPanel';
import { UnsupportedCard } from './UnsupportedCard';
import { ViewerEmptyState } from './ViewerEmptyState';
import { ViewerToolbar } from './ViewerToolbar';
import { useViewerSession } from './useViewerSession';
import { ensureEngineStyles } from './engineStyles';

/**
 * 万能文件查看器主场景：壳层状态机、打开臂接线与命令执行器装配。
 *
 * 布局（《03-查看器设计》§3/§8）：壳层工具栏 → 反馈条 → 舞台（引擎挂载 / 空态 /
 * 兜底信息卡）→ 格式信息面板；命令族经 command:invoked 派发驱动同一套会话与引擎通道。
 */
export const UniversalViewerScene: React.FC = () => {
  const { token } = theme.useToken();
  const session = useViewerSession();
  const commands = useAppCommands();
  const toolbarContextRef = useRef<PreviewToolbarRenderContext | null>(null);
  const [toolbarContext, setToolbarContext] = useState<PreviewToolbarRenderContext | null>(null);

  useEffect(() => {
    ensureEngineStyles();
  }, []);

  const handleToolbarContext = useCallback((context: PreviewToolbarRenderContext | null): void => {
    toolbarContextRef.current = context;
    setToolbarContext(context);
  }, []);

  const executeCommand = useCallback(
    (status: AppCommandStatus): void => {
      if (!isAppCommandId(status.commandId)) {
        return;
      }
      const context = toolbarContextRef.current;
      switch (status.commandId) {
        case APP_COMMAND_IDS.openCard: {
          const path = readCommandPath(status.payload);
          if (path !== null) {
            void session.requestOpenResource(path);
          }
          return;
        }
        case APP_COMMAND_IDS.refreshView:
          session.reloadCurrent();
          return;
        case APP_COMMAND_IDS.previousFile:
          void context?.previous();
          return;
        case APP_COMMAND_IDS.nextFile:
          void context?.next();
          return;
        case APP_COMMAND_IDS.zoomIn:
          context?.command('zoom-in');
          return;
        case APP_COMMAND_IDS.zoomOut:
          context?.command('zoom-out');
          return;
        case APP_COMMAND_IDS.zoomReset:
          context?.command('zoom-reset');
          return;
        case APP_COMMAND_IDS.rotateLeft:
          context?.command('rotate-left');
          return;
        case APP_COMMAND_IDS.rotateRight:
          context?.command('rotate-right');
          return;
        case APP_COMMAND_IDS.toggleInfo:
          session.toggleInfoPanel();
          return;
        case APP_COMMAND_IDS.fullscreen:
          context?.fullscreen();
          return;
        case APP_COMMAND_IDS.print:
          context?.print();
          return;
        default:
          return;
      }
    },
    [session],
  );

  useEffect(() => {
    commands.setExecutor(executeCommand);
  }, [commands, executeCommand]);

  const hasFile = session.loadedFiles.length > 0;
  const currentLoaded = session.currentFile;
  const infoFormat = currentLoaded
    ? resolveFileExtension(currentLoaded.name).toUpperCase() || currentLoaded.mimeType || '未知'
    : null;
  const target = session.target;
  const infoSource =
    target !== null && target.items.length > 0
      ? (target.items[Math.min(session.initialIndex, target.items.length - 1)]?.uri ?? null)
      : null;
  const infoFileName =
    session.currentFile?.name ?? (target !== null ? (target.items[session.initialIndex]?.fileName ?? null) : null);
  const infoMimeType =
    session.currentFile?.mimeType ??
    (target !== null ? (target.items[session.initialIndex]?.mimeType ?? null) : null);
  const queueLength = toolbarContext?.length ?? 0;
  const infoPosition =
    queueLength > 1 ? `${(toolbarContext?.index ?? 0) + 1} / ${queueLength}` : null;

  const openFile = useCallback(() => {
    void session.openFile();
  }, [session]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        background: token.colorBgLayout,
      }}
    >
      {commands.phase === 'error' ? (
        <div
          data-role="command-status"
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: token.marginXS,
            padding: `${token.paddingXXS}px ${token.paddingSM}px`,
            background: token.colorWarningBg,
            color: token.colorWarningText,
            fontSize: token.fontSizeSM,
          }}
        >
          命令通道异常（{commands.errorCode ?? 'COMMAND_RUNTIME_ERROR'}）：命令注册未完成，界面功能不受影响
        </div>
      ) : null}

      <ViewerToolbar
        context={toolbarContext}
        fileName={session.currentFile?.name ?? session.target?.title ?? null}
        hasFile={hasFile}
        onOpenFile={openFile}
        onReload={session.reloadCurrent}
        onToggleInfo={session.toggleInfoPanel}
      />

      {session.feedback !== null ? (
        <div
          data-role="viewer-feedback"
          role={session.feedback.tone === 'error' ? 'alert' : 'status'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: token.marginXS,
            padding: `${token.paddingXXS}px ${token.paddingSM}px`,
            background:
              session.feedback.tone === 'error' ? token.colorErrorBg : token.colorInfoBg,
            color: session.feedback.tone === 'error' ? token.colorErrorText : token.colorInfoText,
            fontSize: token.fontSizeSM,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>{session.feedback.message}</span>
          {session.loadStatus.state === 'error' && session.unsupported === null ? (
            <Button size="small" data-role="feedback-retry" onClick={session.retryLoad}>
              重试
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {session.unsupported !== null ? (
          <UnsupportedCard
            format={session.unsupported.format}
            mimeType={session.unsupported.mimeType}
            fileName={session.unsupported.fileName}
            onRetry={session.retryLoad}
          />
        ) : hasFile ? (
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
              padding: token.marginXS,
            }}
          >
            <div
              style={{
                display: 'flex',
                flex: 1,
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden',
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadiusLG,
                background: token.colorBgContainer,
              }}
            >
              <EngineStage
                items={session.previewItems}
                initialIndex={session.initialIndex}
                onToolbarContext={handleToolbarContext}
                onFileLoad={session.handleEngineLoad}
              />
            </div>
          </div>
        ) : (
          <ViewerEmptyState onOpenFile={openFile} />
        )}

        {session.loadStatus.state === 'loading' ? (
          <div
            data-role="viewer-status"
            role="status"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: token.marginSM,
              background: token.colorBgMask,
              zIndex: 3,
            }}
          >
            <Spin />
            <span>正在读取文件…</span>
          </div>
        ) : null}
      </div>

      <InfoPanel
        open={session.infoPanelOpen && hasFile}
        fileName={infoFileName}
        format={infoFormat}
        mimeType={infoMimeType}
        byteSize={session.currentFile?.size ?? null}
        sourceLabel={infoSource}
        position={infoPosition}
        onClose={session.toggleInfoPanel}
      />
    </div>
  );
};

function readCommandPath(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const path = (payload as Record<string, unknown>)['path'];
  return typeof path === 'string' && path.trim().length > 0 ? path.trim() : null;
}
