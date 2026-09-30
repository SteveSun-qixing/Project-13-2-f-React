import { ChipsProvider, CommandProvider, theme } from '@chips/ui';
import React, { useCallback } from 'react';
import { APP_COMMAND_HANDLER_IDS, APP_PLUGIN_ID } from '../commands/appCommands';
import { useAppCommands } from '../commands/useAppCommands';
import type { AppCommandStatus } from '../commands/appCommands';
import { InfoPanel } from './InfoPanel';
import { PhotoStage } from './PhotoStage';
import type { FilmstripItem } from './Filmstrip';
import { ViewerDock } from './ViewerDock';
import { usePhotoSession } from './usePhotoSession';

/**
 * 应用窗口界面根组件：render.js 的默认导出，由平台窗口壳装载。
 *
 * 挂载窗口级 ChipsProvider 一次（appId 与 manifest 一致、surface 与 manifest ui.surface 一致），
 * 包裹整个应用界面树；不得重复挂载或自建主题根（《@chips-ui 共享层使用指南》§3.1）。
 * CommandProvider 为窗口内命令运行时单例（《13-命令系统契约》§5.6），包裹全部命令消费组件。
 */

const APP_ID = APP_PLUGIN_ID;

function readCommandPath(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const path = (payload as Record<string, unknown>)['path'];
  return typeof path === 'string' && path.trim().length > 0 ? path.trim() : null;
}

const AppContent: React.FC = () => {
  const { token } = theme.useToken();
  const session = usePhotoSession();

  const routeInvokedCommand = useCallback(
    (status: AppCommandStatus): void => {
      if (status.handlerId === APP_COMMAND_HANDLER_IDS.refreshView) {
        session.reloadCurrent();
        return;
      }
      if (status.handlerId === APP_COMMAND_HANDLER_IDS.openCard) {
        const path = readCommandPath(status.payload);
        if (path !== null) {
          void session.requestOpenResource(path);
        }
      }
    },
    [session],
  );
  const commands = useAppCommands(routeInvokedCommand);

  const filmstripItems: readonly FilmstripItem[] = (session.queue?.images ?? []).map((image) => ({
    uri: image.uri,
    fileName: image.fileName,
    thumbSrc: session.getThumbUrl(image.uri),
  }));

  const queueLength = session.queue?.images.length ?? 0;
  const position = queueLength > 0 ? `${session.currentIndex + 1} / ${queueLength}` : null;
  const hasPrevious = session.currentIndex > 0;
  const hasNext = session.currentIndex >= 0 && session.currentIndex < queueLength - 1;
  const stageOpen = useCallback(() => {
    void session.openImageFile();
  }, [session]);
  const stageSave = useCallback(() => {
    void session.saveCopy();
  }, [session]);
  const stageNavigate = useCallback(
    (direction: 'prev' | 'next'): void => {
      if (direction === 'prev') {
        session.previous();
      } else {
        session.next();
      }
    },
    [session],
  );

  return (
    <div
      style={{
        position: 'relative',
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

      <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <PhotoStage
            currentImage={session.currentImage}
            currentSrc={session.currentSrc}
            loadStatus={session.loadStatus}
            dimensions={session.dimensions}
            isImageLoaded={session.isImageLoaded}
            bridgeReady={session.bridgeReady}
            queueLength={queueLength}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            filmstripItems={filmstripItems}
            filmstripIndex={session.currentIndex}
            filmstripVisible={session.filmstripVisible}
            chromeVisible={session.chromeVisible}
            feedback={session.feedback}
            registerCameraActions={session.registerCameraActions}
            onNavigate={stageNavigate}
            onFilmstripSelect={session.goTo}
            onRetry={session.loadStatus.state === 'error' ? session.reloadCurrent : null}
            onOpenRequest={stageOpen}
            onSaveCopy={stageSave}
            onImageLoad={session.handleImageLoad}
            onImageError={session.handleImageError}
            onPointerActivity={session.notifyPointerActivity}
          />
          {session.chromeVisible ? (
            <ViewerDock
              fileName={session.queueTitle ?? session.currentImage?.fileName ?? null}
              position={position}
              hasCurrent={session.currentImage !== null}
              isImageLoaded={session.isImageLoaded}
              canPrevious={hasPrevious}
              canNext={hasNext}
              hasQueue={queueLength > 0}
              filmstripVisible={session.filmstripVisible}
              infoPanelOpen={session.infoPanelOpen}
              immersive={session.immersive}
              cameraActionsRef={session.cameraActionsRef}
              onPrevious={session.previous}
              onNext={session.next}
              onOpenRequest={stageOpen}
              onSaveCopy={stageSave}
              onToggleFilmstrip={session.toggleFilmstrip}
              onToggleInfoPanel={session.toggleInfoPanel}
              onToggleImmersive={session.toggleImmersive}
            />
          ) : null}
        </div>
        <InfoPanel
          open={session.infoPanelOpen && session.currentImage !== null}
          title={session.currentImage?.title ?? null}
          fileName={session.currentImage?.fileName ?? null}
          mimeType={session.currentImage?.mimeType ?? null}
          byteSize={session.byteSize}
          dimensions={session.dimensions}
          position={position}
          onClose={session.toggleInfoPanel}
        />
      </div>
    </div>
  );
};

export const AppView: React.FC = () => (
  <ChipsProvider appId={APP_ID} surface="window">
    <CommandProvider>
      <AppContent />
    </CommandProvider>
  </ChipsProvider>
);

export default AppView;
