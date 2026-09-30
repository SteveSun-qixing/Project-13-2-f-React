import React from 'react';
import {
  Button,
  Dropdown,
  Popover,
  Slider,
  Tooltip,
  Typography,
  theme,
  type MenuProps,
} from '@chips/ui';
import {
  BackwardOutlined,
  CaretRightOutlined,
  CheckOutlined,
  CustomerServiceOutlined,
  FontColorsOutlined,
  ForwardOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  MoreOutlined,
  PauseOutlined,
  QuestionCircleOutlined,
  RetweetOutlined,
  SoundFilled,
  SoundOutlined,
  SwitcherOutlined,
} from '@chips/ui';
import {
  PLAYBACK_RATES,
  clampPlaybackTime,
  formatDuration,
  formatPlaybackRate,
} from '../player/videoPlayer';
import type { VideoPlayerController } from '../player/useVideoPlayerController';
import { MorePanel } from './MorePanel';

/**
 * 播放控制条（重写件）。
 *
 * 旧实现 Timeline/Osd/TrackMenu/Stage 控制面（判重写，交互语义按《03-查看器设计》§十保留）：
 * antd Slider 承载进度拖动（拖动预览、松手提交），Button/Dropdown 承载播放、跳转、
 * 音量、倍速、循环、轨道、画中画、全屏与键位帮助；样式全部取主题 token。
 */

export interface ControlsBarProps {
  controller: VideoPlayerController;
  onOpenKeyHelp: () => void;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({ controller, onOpenKeyHelp }) => {
  const { token } = theme.useToken();
  const hasSession = controller.sessionKey !== null;
  const canSeek = hasSession && controller.duration > 0;
  const progressValue = clampPlaybackTime(controller.currentTime, controller.duration);
  const iconButtonStyle: React.CSSProperties = { color: token.colorTextLightSolid };

  const rateMenu: MenuProps = {
    items: PLAYBACK_RATES.map((rate) => ({
      key: String(rate),
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 14 }}>{controller.playbackRate === rate ? <CheckOutlined /> : null}</span>
          {formatPlaybackRate(rate)}
        </span>
      ),
    })),
    onClick: ({ key }) => {
      controller.setPlaybackRate(Number(key));
    },
    selectable: false,
  };

  const subtitleItems: MenuProps['items'] = [
    {
      key: 'off',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 14 }}>
            {controller.subtitleTracks.every((track) => !track.selected) ? <CheckOutlined /> : null}
          </span>
          关闭字幕
        </span>
      ),
    },
  ].concat(
    controller.subtitleTracks.map((track) => ({
      key: String(track.index),
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 14 }}>{track.selected ? <CheckOutlined /> : null}</span>
          {track.label || `字幕轨 ${track.index + 1}`}
          {track.language ? `（${track.language}）` : ''}
        </span>
      ),
    })),
  );

  const subtitleMenu: MenuProps = {
    items: subtitleItems,
    onClick: ({ key }) => {
      controller.selectSubtitleTrack(key === 'off' ? null : Number(key));
    },
    selectable: false,
  };

  const audioItems: MenuProps['items'] = controller.audioTracks.map((track) => ({
    key: String(track.index),
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 14 }}>{track.selected ? <CheckOutlined /> : null}</span>
        {track.label || `音轨 ${track.index + 1}`}
        {track.language ? `（${track.language}）` : ''}
      </span>
    ),
  }));

  const audioMenu: MenuProps = {
    items: audioItems.length > 0 ? audioItems : [{ key: 'empty', label: '当前视频没有可切换的音频轨道', disabled: true }],
    onClick: ({ key }) => {
      controller.selectAudioTrack(Number(key));
    },
    selectable: false,
  };

  return (
    <section
      aria-label="视频播放控制"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXXS,
        padding: `${token.paddingXXS}px ${token.paddingSM}px ${token.paddingXS}px`,
        background: token.colorBgLayout,
      }}
    >
      <Slider
        ariaLabelForHandle="播放进度"
        min={0}
        max={controller.duration > 0 ? controller.duration : 1}
        step={0.1}
        disabled={!canSeek}
        value={progressValue}
        tooltip={{ formatter: (value) => formatDuration(Number(value ?? 0)) }}
        onChange={(value) => {
          controller.seekPreviewTo(Number(value));
        }}
        onChangeComplete={(value) => {
          controller.commitSeek(Number(value));
        }}
        styles={{ track: { padding: 0 } }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXXS, flexWrap: 'wrap' }}>
        <Tooltip title={controller.isPlaying ? '暂停' : '播放'}>
          <Button
            type="text"
            aria-label={controller.isPlaying ? '暂停' : '播放'}
            style={iconButtonStyle}
            icon={controller.isPlaying ? <PauseOutlined /> : <CaretRightOutlined />}
            disabled={!hasSession}
            onClick={() => void controller.togglePlayback()}
          />
        </Tooltip>
        <Tooltip title="后退 5 秒">
          <Button
            type="text"
            aria-label="后退 5 秒"
            style={iconButtonStyle}
            icon={<BackwardOutlined />}
            disabled={!hasSession}
            onClick={() => controller.seekBy(-5)}
          />
        </Tooltip>
        <Tooltip title="前进 5 秒">
          <Button
            type="text"
            aria-label="前进 5 秒"
            style={iconButtonStyle}
            icon={<ForwardOutlined />}
            disabled={!hasSession}
            onClick={() => controller.seekBy(5)}
          />
        </Tooltip>
        <Typography.Text style={{ color: token.colorTextLightSolid, fontSize: token.fontSizeSM, fontVariantNumeric: 'tabular-nums' }}>
          {formatDuration(controller.currentTime)} / {formatDuration(controller.duration)}
        </Typography.Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 150 }}>
          <Tooltip title={controller.isMuted ? '取消静音' : '静音'}>
            <Button
              type="text"
              aria-label={controller.isMuted ? '取消静音' : '静音'}
              style={iconButtonStyle}
              icon={controller.isMuted || controller.volume === 0 ? <SoundOutlined /> : <SoundFilled />}
              disabled={!hasSession}
              onClick={controller.toggleMute}
            />
          </Tooltip>
          <Slider
            ariaLabelForHandle="音量"
            min={0}
            max={1}
            step={0.05}
            disabled={!hasSession}
            value={controller.volume}
            tooltip={{ formatter: (value) => `${Math.round(Number(value ?? 0) * 100)}%` }}
            onChange={(value) => {
              controller.setVolumeLevel(Number(value));
            }}
            style={{ flex: 1, marginInline: 4 }}
          />
        </div>
        <Dropdown menu={rateMenu} trigger={['click']} placement="topRight">
          <Button type="text" aria-label="倍速" style={iconButtonStyle}>
            {formatPlaybackRate(controller.playbackRate)}
          </Button>
        </Dropdown>
        <Tooltip title={controller.loop ? '关闭循环' : '循环播放'}>
          <Button
            type="text"
            aria-label={controller.loop ? '关闭循环' : '循环播放'}
            style={{ ...iconButtonStyle, color: controller.loop ? token.colorPrimary : token.colorTextLightSolid }}
            icon={<RetweetOutlined />}
            disabled={!hasSession}
            onClick={controller.toggleLoop}
          />
        </Tooltip>
        <Dropdown menu={subtitleMenu} trigger={['click']} placement="topRight" disabled={!hasSession}>
          <Button type="text" aria-label="字幕" style={iconButtonStyle} icon={<FontColorsOutlined />} />
        </Dropdown>
        <Dropdown menu={audioMenu} trigger={['click']} placement="topRight" disabled={!hasSession}>
          <Button type="text" aria-label="音轨" style={iconButtonStyle} icon={<CustomerServiceOutlined />} />
        </Dropdown>
        <Popover content={<MorePanel controller={controller} />} trigger="click" placement="topRight">
          <Button
            type="text"
            aria-label="更多"
            style={iconButtonStyle}
            icon={<MoreOutlined />}
            disabled={!hasSession}
            onClick={(event) => {
              event.stopPropagation();
            }}
          />
        </Popover>
        <div style={{ flex: 1 }} />
        <Tooltip title={controller.isPictureInPicture ? '退出画中画' : '画中画'}>
          <Button
            type="text"
            aria-label={controller.isPictureInPicture ? '退出画中画' : '画中画'}
            style={iconButtonStyle}
            icon={<SwitcherOutlined />}
            disabled={!hasSession || !controller.canUsePictureInPicture}
            onClick={() => void controller.togglePictureInPicture()}
          />
        </Tooltip>
        <Tooltip title={controller.isFullscreen ? '退出全屏' : '全屏'}>
          <Button
            type="text"
            aria-label={controller.isFullscreen ? '退出全屏' : '全屏'}
            style={iconButtonStyle}
            icon={controller.isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={() => void controller.toggleFullscreen()}
          />
        </Tooltip>
        <Tooltip title="快捷键帮助">
          <Button
            type="text"
            aria-label="快捷键帮助"
            style={iconButtonStyle}
            icon={<QuestionCircleOutlined />}
            onClick={onOpenKeyHelp}
          />
        </Tooltip>
      </div>
    </section>
  );
};

export default ControlsBar;
