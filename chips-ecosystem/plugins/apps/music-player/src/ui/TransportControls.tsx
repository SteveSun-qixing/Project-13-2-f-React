import React from 'react';
import {
  Button,
  CaretRightOutlined,
  PauseOutlined,
  RetweetOutlined,
  Slider,
  SoundFilled,
  SoundOutlined,
  StepBackwardFilled,
  StepForwardFilled,
  Tooltip,
  Typography,
  theme,
} from '@chips/ui';
import type { LoopMode } from '../player/audioEngine';

/**
 * 传输控制条（重写件）：上一首/播放暂停/下一首、音量、静音、单曲循环。
 * 进度条在播放舞台内（点选语义随舞台承载）。
 */

export interface TransportControlsProps {
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  loopMode: LoopMode;
  canGoNext: boolean;
  canGoPrevious: boolean;
  onTogglePlayback: () => void;
  onGoNext: () => void;
  onGoPrevious: () => void;
  onVolumeChange: (nextVolume: number) => void;
  onToggleMute: () => void;
  onToggleLoop: () => void;
}

export const TransportControls: React.FC<TransportControlsProps> = ({
  isPlaying,
  isBuffering,
  isMuted,
  volume,
  loopMode,
  canGoNext,
  canGoPrevious,
  onTogglePlayback,
  onGoNext,
  onGoPrevious,
  onVolumeChange,
  onToggleMute,
  onToggleLoop,
}) => {
  const { token } = theme.useToken();
  const isLoopOne = loopMode === 'one';

  return (
    <section
      aria-label="播放控制"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: token.marginSM,
        padding: `${token.paddingXXS}px ${token.paddingLG}px ${token.paddingSM}px`,
      }}
    >
      <Tooltip title={canGoPrevious ? '上一首（P）' : '已是队列开头'}>
        <Button
          type="text"
          aria-label="上一首"
          icon={<StepBackwardFilled />}
          disabled={!canGoPrevious}
          onClick={onGoPrevious}
        />
      </Tooltip>
      <Tooltip title={isPlaying ? '暂停（空格）' : '播放（空格）'}>
        <Button
          type="primary"
          shape="circle"
          size="large"
          aria-label={isPlaying ? '暂停' : '播放'}
          icon={isPlaying ? <PauseOutlined /> : <CaretRightOutlined />}
          loading={isBuffering}
          onClick={onTogglePlayback}
        />
      </Tooltip>
      <Tooltip title={canGoNext ? '下一首（N）' : '已是队列末尾'}>
        <Button
          type="text"
          aria-label="下一首"
          icon={<StepForwardFilled />}
          disabled={!canGoNext}
          onClick={onGoNext}
        />
      </Tooltip>
      <Tooltip title={isMuted ? '取消静音（M）' : '静音（M）'}>
        <Button
          type="text"
          aria-label={isMuted ? '取消静音' : '静音'}
          icon={isMuted || volume === 0 ? <SoundOutlined /> : <SoundFilled />}
          onClick={onToggleMute}
        />
      </Tooltip>
      <Slider
        ariaLabelForHandle="音量"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        tooltip={{ formatter: (value) => `${Math.round(Number(value ?? 0) * 100)}%` }}
        onChange={(value) => {
          onVolumeChange(Number(value));
        }}
        style={{ width: 120, marginInline: 0 }}
      />
      <Typography.Text
        type="secondary"
        style={{ fontVariantNumeric: 'tabular-nums', fontSize: token.fontSizeSM, minWidth: 36 }}
        aria-label="音量百分比"
      >
        {Math.round(volume * 100)}%
      </Typography.Text>
      <Tooltip title={isLoopOne ? '关闭单曲循环（L）' : '开启单曲循环（L）'}>
        <Button
          type="text"
          aria-label={isLoopOne ? '关闭单曲循环' : '开启单曲循环'}
          icon={<RetweetOutlined />}
          style={{ color: isLoopOne ? token.colorPrimary : undefined }}
          onClick={onToggleLoop}
        />
      </Tooltip>
    </section>
  );
};

export default TransportControls;
