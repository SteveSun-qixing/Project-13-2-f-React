import React from 'react';
import { Button, Spin, Typography, theme } from '@chips/ui';
import { ReloadOutlined } from '@chips/ui';
import { formatDuration, type ViewerFeedback } from '../player/videoPlayer';
import type { VideoPlayerController } from '../player/useVideoPlayerController';
import { ControlsBar } from './ControlsBar';
import { mediaErrorFeedback } from '../messages';

/**
 * 播放舞台（重写件）：`<video>` 装配、OSD 反馈、缓冲/结束/错误遮罩与控制层显隐。
 *
 * 旧实现 VideoPlayerStage 1003 行（判重写，语义保留）：舞台点击播放/暂停、双击全屏、
 * 指针移动唤起控制层并按时自动隐藏；错误态按 `VIDEO_PLAYER_*` 域码语义如实呈现。
 */

export interface PlayerStageProps {
  controller: VideoPlayerController;
  /** 界面反馈（OSD）：音量/倍速/跳转等动作的即时回显。 */
  feedback: ViewerFeedback | null;
  onOpenKeyHelp: () => void;
}

export const PlayerStage: React.FC<PlayerStageProps> = ({ controller, feedback, onOpenKeyHelp }) => {
  const { token } = theme.useToken();
  const source = controller.source;
  const errorFeedback = mediaErrorFeedback(controller.errorKey);

  const overlayBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: token.marginSM,
    background: 'rgba(0, 0, 0, 0.45)',
    pointerEvents: 'auto',
  };

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      onKeyDown={(event) => {
        controller.handleKeyDown(event);
      }}
      tabIndex={0}
      role="region"
      aria-label="视频播放区域"
    >
      <div
        ref={controller.surfaceRef}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: token.colorBgLayout,
          overflow: 'hidden',
        }}
        onPointerMove={() => {
          controller.revealChrome();
        }}
        onPointerLeave={() => {
          controller.scheduleChromeHide();
        }}
        onClick={() => {
          controller.revealChrome();
          void controller.togglePlayback();
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          void controller.toggleFullscreen();
        }}
      >
        {source === null ? null : (
          <video
            key={controller.sessionKey ?? undefined}
            ref={controller.videoRef}
            src={source.resourceUri}
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000000' }}
            onLoadedMetadata={controller.handleLoadedMetadata}
            onCanPlay={controller.handleCanPlay}
            onPlaying={controller.handlePlaying}
            onPause={controller.handlePause}
            onWaiting={controller.handleWaiting}
            onEnded={controller.handleEnded}
            onTimeUpdate={controller.handleTimeUpdate}
            onDurationChange={controller.handleDurationChange}
            onProgress={controller.handleProgress}
            onVolumeChange={controller.handleVolumeChange}
            onError={controller.handleError}
          />
        )}

        {controller.isBuffering ? (
          <div style={overlayBadgeStyle} role="status">
            <Spin />
            <Typography.Text style={{ color: token.colorTextLightSolid }}>正在缓冲…</Typography.Text>
          </div>
        ) : null}

        {controller.isEnded ? (
          <div style={overlayBadgeStyle}>
            <Typography.Text style={{ color: token.colorTextLightSolid, fontSize: token.fontSizeLG }}>
              播放结束
            </Typography.Text>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                controller.commitSeek(0);
                void controller.togglePlayback();
              }}
            >
              重新播放
            </Button>
          </div>
        ) : null}

        {controller.isBuffering || controller.isEnded ? null : errorFeedback !== null ? (
          <div style={overlayBadgeStyle}>
            <Typography.Text role="alert" style={{ color: token.colorErrorText, fontSize: token.fontSizeLG }}>
              {errorFeedback.message}
            </Typography.Text>
          </div>
        ) : null}

        {feedback === null ? null : (
          <div
            role="status"
            style={{
              position: 'absolute',
              top: token.marginSM,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: `${token.paddingXXS}px ${token.paddingSM}px`,
              borderRadius: token.borderRadiusLG,
              background: 'rgba(0, 0, 0, 0.6)',
              color: feedback.tone === 'error' ? token.colorErrorText : token.colorTextLightSolid,
              fontSize: token.fontSizeLG,
              pointerEvents: 'none',
            }}
          >
            {feedback.message}
            {feedback.tone === 'info' && controller.duration > 0 ? ` · ${formatDuration(controller.currentTime)}` : ''}
          </div>
        )}
      </div>
      <div
        style={{
          opacity: controller.chromeVisible ? 1 : 0,
          pointerEvents: controller.chromeVisible ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
      >
        <ControlsBar controller={controller} onOpenKeyHelp={onOpenKeyHelp} />
      </div>
    </div>
  );
};

export default PlayerStage;
