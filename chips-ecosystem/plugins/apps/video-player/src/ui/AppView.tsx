import React from 'react';
import { Typography, theme } from '@chips/ui';
import { ChipsProvider, CommandProvider } from '@chips/ui';
import { COMMAND_PHASE_LABELS, useAppCommands } from '../commands/useAppCommands';
import {
  APP_COMMAND_IDS,
  type AppCommandActionMap,
  type AppCommandStatus,
} from '../commands/appCommands';
import { useVideoPlayerController } from '../player/useVideoPlayerController';
import type { VideoSource, ViewerFeedback } from '../player/videoPlayer';
import { EmptyState } from './EmptyState';
import { PlayerStage } from './PlayerStage';
import { KeyHelpDialog } from './KeyHelpDialog';

const APP_ID = 'chips.official.video-player';
const FEEDBACK_DURATION_MS = 1600;

/**
 * 应用窗口界面根组件（重写件）：render.js 的默认导出，由平台窗口壳装载。
 *
 * 挂载窗口级 ChipsProvider 一次（appId 与 manifest 一致、surface 与 manifest ui.surface 一致），
 * CommandProvider 为窗口内命令运行时单例（《13-命令系统契约》§5.6）。
 * 会话装配：空态地址输入 → `VideoSource`；`resource:open` video 槽位投递随宿主资源
 * 路由落波后接入同一会话形状（工单065 关联面）。
 */

const AppContent: React.FC = () => {
  const { token } = theme.useToken();
  const [source, setSource] = React.useState<VideoSource | null>(null);
  const [feedback, setFeedback] = React.useState<ViewerFeedback | null>(null);
  const [isKeyHelpOpen, setIsKeyHelpOpen] = React.useState(false);
  const feedbackTimerRef = React.useRef<number | null>(null);

  const controller = useVideoPlayerController({ source, onOpenKeyHelp: () => setIsKeyHelpOpen(true) });

  const showFeedback = React.useCallback((next: ViewerFeedback): void => {
    setFeedback(next);
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      feedbackTimerRef.current = null;
      setFeedback(null);
    }, FEEDBACK_DURATION_MS);
  }, []);

  React.useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const actions = React.useMemo<AppCommandActionMap>(
    () => ({
      togglePlayback: () => {
        void controller.togglePlayback();
      },
      seekForward: () => {
        controller.seekBy(5);
        showFeedback({ tone: 'info', message: '前进 5 秒' });
      },
      seekBackward: () => {
        controller.seekBy(-5);
        showFeedback({ tone: 'info', message: '后退 5 秒' });
      },
      toggleMute: () => {
        controller.toggleMute();
        showFeedback({ tone: 'info', message: controller.isMuted ? '已取消静音' : '已静音' });
      },
      cyclePlaybackRate: () => {
        controller.cyclePlaybackRate();
        showFeedback({ tone: 'info', message: `播放速度 ${controller.playbackRate}x` });
      },
      toggleLoop: () => {
        controller.toggleLoop();
        showFeedback({ tone: 'info', message: controller.loop ? '已关闭循环播放' : '已开启循环播放' });
      },
      toggleFullscreen: () => {
        void controller.toggleFullscreen();
      },
      togglePictureInPicture: () => {
        void controller.togglePictureInPicture();
      },
      openCard: (payload) => {
        const path = typeof (payload as { path?: unknown })?.path === 'string' ? (payload as { path: string }).path : '';
        showFeedback({
          tone: 'error',
          message: `资源打开通道尚未就绪，暂不能打开：${path || '未提供路径'}`,
        });
      },
      refreshView: () => {
        setSource((current) => (current === null ? null : { ...current, revision: current.revision + 1 }));
      },
    }),
    [controller, showFeedback],
  );

  const commands = useAppCommands(actions);

  // command:invoked 派发执行记录 → OSD 回显（保持唯一事实：业务效应已由 actions 完成）。
  React.useEffect(() => {
    const invoked: AppCommandStatus | null = commands.lastInvoked;
    if (invoked === null) {
      return;
    }
    if (invoked.commandId === APP_COMMAND_IDS.openCard) {
      return;
    }
    if (invoked.commandId === APP_COMMAND_IDS.refreshView) {
      showFeedback({ tone: 'info', message: '已刷新当前会话' });
    }
  }, [commands.lastInvoked, showFeedback]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 320,
        background: token.colorBgBase,
        color: token.colorText,
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isKeyHelpOpen) {
          setIsKeyHelpOpen(false);
        }
      }}
    >
      {source === null ? (
        <EmptyState
          onOpen={(next) => {
            setSource(next);
            showFeedback({ tone: 'info', message: '已打开视频会话' });
          }}
        />
      ) : (
        <PlayerStage controller={controller} feedback={feedback} onOpenKeyHelp={() => setIsKeyHelpOpen(true)} />
      )}
      <Typography.Text
        type="secondary"
        style={{ padding: `0 ${token.paddingSM}px ${token.paddingXXS}px`, fontSize: token.fontSizeSM }}
      >
        命令注册状态：{COMMAND_PHASE_LABELS[commands.phase]}
        {commands.errorCode === null ? '' : `（${commands.errorCode}）`}
      </Typography.Text>
      <KeyHelpDialog open={isKeyHelpOpen} onClose={() => setIsKeyHelpOpen(false)} />
    </div>
  );
};

/**
 * 界面根：挂载 ChipsProvider + CommandProvider 后装载内容
 * （《@chips/ui 共享层使用指南》§3.1：不重复挂载、不自建主题根）。
 */
export const AppView: React.FC = () => (
  <ChipsProvider appId={APP_ID} surface="window">
    <CommandProvider>
      <AppContent />
    </CommandProvider>
  </ChipsProvider>
);

export default AppView;
