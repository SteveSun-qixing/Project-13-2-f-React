import React from 'react';
import {
  Alert,
  Button,
  ChipsProvider,
  CommandProvider,
  Modal,
  PlusOutlined,
  Typography,
  theme,
} from '@chips/ui';
import { COMMAND_PHASE_LABELS, useAppCommands } from '../commands/useAppCommands';
import {
  APP_COMMAND_IDS,
  type AppCommandActionMap,
  type AppCommandStatus,
} from '../commands/appCommands';
import { useMusicPlayerController } from '../player/useMusicPlayerController';
import { usePlayerQueue } from '../player/usePlayerQueue';
import { usePlayerKeyboard } from '../player/usePlayerKeyboard';
import { shouldUseMobilePagerLayout } from '../player/layout';
import type { TrackPresentation } from '../player/trackSession';
import type { ViewerFeedback } from '../player/musicPlayer';
import { mediaErrorFeedback } from './messages';
import { AssemblyForm } from './AssemblyForm';
import { EmptyState } from './EmptyState';
import { PlayerStage } from './PlayerStage';
import { TransportControls } from './TransportControls';
import { QueueList } from './QueueList';

const APP_ID = 'chips.official.music-player';
const FEEDBACK_DURATION_MS = 1600;
const SEEK_STEP_SECONDS = 5;

/**
 * 应用窗口界面根组件（重写件）：render.js 的默认导出，由平台窗口壳装载。
 *
 * 挂载窗口级 ChipsProvider 一次（appId 与 manifest 一致、surface 与 manifest ui.surface 一致），
 * CommandProvider 为窗口内命令运行时单例（《13-命令系统契约》§5.6）。
 * 会话装配：空态地址输入 → `TrackPresentation` 入队；`resource:open` audio 槽位投递随
 * 宿主资源路由落波后接入同一会话形状（工单060 关联面）。队列持久化为窗口会话内存态
 * （工单066 在册，`config:*` 域处理器落波后换接）。布局按视口以迁移件
 * `shouldUseMobilePagerLayout` 分档：窄竖长视口收拢为单列，宽幅为舞台+队列双列。
 */

const AppContent: React.FC = () => {
  const { token } = theme.useToken();
  const queue = usePlayerQueue();
  const [feedback, setFeedback] = React.useState<ViewerFeedback | null>(null);
  const [seekPreview, setSeekPreview] = React.useState<number | null>(null);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isCompactLayout, setIsCompactLayout] = React.useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      shouldUseMobilePagerLayout(window.innerWidth, window.innerHeight),
  );
  const feedbackTimerRef = React.useRef<number | null>(null);

  const current = queue.current;
  const sessionKey = current ? `${current.source.sourceId}#${current.source.revision}` : null;

  const controller = useMusicPlayerController({
    sessionKey,
    onEnded: () => {
      // 单曲播完（非单曲循环）：队列可进则自动切下一首，否则自然停止。
      if (queue.canGoNext) {
        queue.goNext();
      }
    },
  });

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

  // 视口分档（消费迁移件布局判定）：窄竖长视口收拢为单列。
  React.useEffect(() => {
    const handleResize = (): void => {
      setIsCompactLayout(shouldUseMobilePagerLayout(window.innerWidth, window.innerHeight));
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 媒体错误键 → 界面反馈（简体中文文案映射）。
  React.useEffect(() => {
    const next = mediaErrorFeedback(controller.errorKey);
    if (next !== null) {
      showFeedback(next);
    }
  }, [controller.errorKey, showFeedback]);

  const actions = React.useMemo<AppCommandActionMap>(
    () => ({
      togglePlayback: () => {
        void controller.togglePlayback();
      },
      seekForward: () => {
        controller.seekBy(SEEK_STEP_SECONDS);
        showFeedback({ tone: 'info', message: '前进 5 秒' });
      },
      seekBackward: () => {
        controller.seekBy(-SEEK_STEP_SECONDS);
        showFeedback({ tone: 'info', message: '后退 5 秒' });
      },
      volumeUp: () => {
        const next = Math.min(1, controller.volume + 0.1);
        controller.setVolumeLevel(next);
        showFeedback({ tone: 'info', message: `音量 ${Math.round(next * 100)}%` });
      },
      volumeDown: () => {
        const next = Math.max(0, controller.volume - 0.1);
        controller.setVolumeLevel(next);
        showFeedback({ tone: 'info', message: `音量 ${Math.round(next * 100)}%` });
      },
      toggleMute: () => {
        controller.toggleMute();
        showFeedback({ tone: 'info', message: controller.isMuted ? '已取消静音' : '已静音' });
      },
      toggleLoop: () => {
        controller.toggleLoopMode();
        showFeedback({
          tone: 'info',
          message: controller.loopMode === 'one' ? '已关闭单曲循环' : '已开启单曲循环',
        });
      },
      nextTrack: () => {
        if (queue.canGoNext) {
          queue.goNext();
          showFeedback({ tone: 'info', message: '已切换到下一首' });
        } else {
          showFeedback({ tone: 'info', message: '已经是队列末尾' });
        }
      },
      previousTrack: () => {
        if (queue.canGoPrevious) {
          queue.goPrevious();
          showFeedback({ tone: 'info', message: '已返回上一首' });
        } else {
          showFeedback({ tone: 'info', message: '已经是队列开头' });
        }
      },
      openCard: (payload) => {
        const path =
          typeof (payload as { path?: unknown })?.path === 'string'
            ? (payload as { path: string }).path
            : '';
        showFeedback({
          tone: 'error',
          message: `资源打开通道尚未就绪，暂不能打开：${path || '未提供路径'}`,
        });
      },
      refreshView: () => {
        showFeedback({ tone: 'info', message: '已刷新当前会话' });
      },
    }),
    [controller, queue, showFeedback],
  );

  const commands = useAppCommands(actions);
  const handleKeyDown = usePlayerKeyboard({
    togglePlayback: () => {
      void controller.togglePlayback();
    },
    seekBy: controller.seekBy,
    volumeStep: (direction) => {
      controller.setVolumeLevel(
        Math.min(1, Math.max(0, Number((controller.volume + direction * 0.1).toFixed(2)))),
      );
    },
    toggleMute: controller.toggleMute,
    toggleLoopMode: controller.toggleLoopMode,
    goNext: queue.goNext,
    goPrevious: queue.goPrevious,
  });

  // command:invoked 派发执行记录 → 状态回显（保持唯一事实：业务效应已由 actions 完成）。
  React.useEffect(() => {
    const invoked: AppCommandStatus | null = commands.lastInvoked;
    if (invoked !== null && invoked.commandId === APP_COMMAND_IDS.refreshView) {
      showFeedback({ tone: 'info', message: '已刷新当前会话' });
    }
  }, [commands.lastInvoked, showFeedback]);

  const appendPresentation = React.useCallback(
    (presentation: TrackPresentation): void => {
      queue.append(presentation);
      setIsAddOpen(false);
      showFeedback({ tone: 'success', message: `已加入队列：${presentation.title}` });
    },
    [queue, showFeedback],
  );

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
      onKeyDown={handleKeyDown}
    >
      {current === null ? (
        <EmptyState onAppend={appendPresentation} />
      ) : (
        <>
          {/*
          音频元素：播放引擎（迁移件状态机）经 controller.attach 绑定本元素；
          src 随当前曲目会话切换，媒体事件由舞台装配。
          */}
          <audio
            ref={controller.audioRef}
            src={current.source.resourceUri}
            onLoadedMetadata={controller.handleLoadedMetadata}
            onCanPlay={controller.handleCanPlay}
            onPlaying={controller.handlePlaying}
            onPause={controller.handlePause}
            onWaiting={controller.handleWaiting}
            onEnded={controller.handleEnded}
            onTimeUpdate={controller.handleTimeUpdate}
            onProgress={controller.handleProgress}
            onVolumeChange={controller.handleVolumeChange}
            onError={controller.handleError}
            style={{ display: 'none' }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: isCompactLayout ? 'column' : 'row',
              flex: 1,
              minHeight: 0,
              gap: isCompactLayout ? 0 : token.marginXS,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: isCompactLayout ? undefined : 3,
                minWidth: 0,
              }}
            >
              <PlayerStage
                presentation={current}
                currentTime={controller.currentTime}
                duration={controller.duration}
                bufferedUntil={controller.bufferedUntil}
                seekPreview={seekPreview}
                onSeekPreview={setSeekPreview}
                onSeekCommit={(nextTime) => {
                  setSeekPreview(null);
                  controller.seekTo(nextTime);
                }}
              />
              <TransportControls
                isPlaying={controller.isPlaying}
                isBuffering={controller.isBuffering}
                isMuted={controller.isMuted}
                volume={controller.volume}
                loopMode={controller.loopMode}
                canGoNext={queue.canGoNext}
                canGoPrevious={queue.canGoPrevious}
                onTogglePlayback={() => {
                  void controller.togglePlayback();
                }}
                onGoNext={queue.goNext}
                onGoPrevious={queue.goPrevious}
                onVolumeChange={controller.setVolumeLevel}
                onToggleMute={controller.toggleMute}
                onToggleLoop={controller.toggleLoopMode}
              />
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: isCompactLayout ? undefined : 2,
                minWidth: 0,
                borderInlineStart: isCompactLayout ? undefined : `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <div style={{ padding: `${token.paddingXXS}px ${token.paddingLG}px 0` }}>
                <Button
                  type="dashed"
                  block
                  aria-label="添加曲目"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setIsAddOpen(true);
                  }}
                >
                  添加曲目
                </Button>
              </div>
              <QueueList
                presentations={queue.presentations}
                currentIndex={queue.currentIndex}
                onPlayAt={queue.playAt}
                onRemoveAt={queue.removeAt}
                onClear={queue.clear}
              />
            </div>
          </div>
        </>
      )}
      <div aria-live="polite" style={{ paddingInline: token.paddingLG, minHeight: 24 }}>
        {feedback === null ? (
          <Typography.Text
            type="secondary"
            style={{ fontSize: token.fontSizeSM }}
          >
            {`命令注册状态：${COMMAND_PHASE_LABELS[commands.phase]}${commands.errorCode === null ? '' : `（${commands.errorCode}）`}`}
          </Typography.Text>
        ) : (
          <Alert
            type={feedback.tone === 'error' ? 'error' : feedback.tone === 'success' ? 'success' : 'info'}
            title={feedback.message}
            showIcon
            style={{ paddingBlock: 0 }}
          />
        )}
      </div>
      <Modal
        title="添加曲目"
        open={isAddOpen}
        footer={null}
        onCancel={() => {
          setIsAddOpen(false);
        }}
        destroyOnHidden
      >
        <AssemblyForm onAppend={appendPresentation} submitLabel="加入队列" />
      </Modal>
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
