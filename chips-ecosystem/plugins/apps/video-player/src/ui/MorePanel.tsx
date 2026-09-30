import React from 'react';
import { Descriptions, Empty, Tabs, Typography, theme } from '@chips/ui';
import { CheckOutlined } from '@chips/ui';
import {
  formatDuration,
  formatPlaybackRate,
  formatResolution,
  resolveVideoFormatLabel,
  type VideoTrackOption,
} from '../player/videoPlayer';
import type { VideoPlayerController } from '../player/useVideoPlayerController';

/**
 * 更多面板（重写件）：视频信息 / 字幕 / 音轨三页签。
 * 旧实现 TrackMenu + Stage 内嵌 more panel（判重写）：antd Tabs + Descriptions + 列表按钮，
 * 语义保留（轨道切换、格式/分辨率/缓冲信息）。
 */

export interface MorePanelProps {
  controller: VideoPlayerController;
}

interface TrackListProps {
  tracks: VideoTrackOption[];
  offLabel: string;
  fallbackPrefix: string;
  selectedKey: string;
  onSelect: (key: string) => void;
}

function trackLabel(track: VideoTrackOption, prefix: string): string {
  const base = track.label || `${prefix} ${track.index + 1}`;
  return track.language ? `${base}（${track.language}）` : base;
}

const TrackList: React.FC<TrackListProps> = ({ tracks, offLabel, fallbackPrefix, selectedKey, onSelect }) => {
  const { token } = theme.useToken();
  const options = [{ key: 'off', label: offLabel, selected: selectedKey === 'off' }].concat(
    tracks.map((track) => ({
      key: String(track.index),
      label: trackLabel(track, fallbackPrefix),
      selected: selectedKey === String(track.index),
    })),
  );

  return (
    <div role="listbox" aria-label={fallbackPrefix}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="option"
          aria-selected={option.selected}
          onClick={() => onSelect(option.key)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: token.marginXS,
            width: '100%',
            padding: `${token.paddingXXS}px ${token.paddingXS}px`,
            border: 'none',
            borderRadius: token.borderRadius,
            background: option.selected ? token.colorPrimaryBg : 'transparent',
            color: token.colorText,
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: token.fontSize,
          }}
        >
          <span style={{ width: 16 }}>{option.selected ? <CheckOutlined aria-hidden="true" /> : null}</span>
          {option.label}
        </button>
      ))}
    </div>
  );
};

export const MorePanel: React.FC<MorePanelProps> = ({ controller }) => {
  const { token } = theme.useToken();
  const source = controller.source;
  const bufferedPercent =
    controller.duration > 0 ? `${Math.round((controller.bufferedUntil / controller.duration) * 100)}%` : '0%';
  const selectedSubtitleKey =
    controller.subtitleTracks.find((track) => track.selected) !== undefined
      ? String(controller.subtitleTracks.find((track) => track.selected)?.index)
      : 'off';
  const selectedAudioKey =
    controller.audioTracks.find((track) => track.selected) !== undefined
      ? String(controller.audioTracks.find((track) => track.selected)?.index)
      : 'off';

  const infoContent = source ? (
    <Descriptions
      size="small"
      column={1}
      items={[
        { key: 'title', label: '标题', children: source.title },
        {
          key: 'format',
          label: '格式',
          children: resolveVideoFormatLabel(source.resourceUri, source.mimeType) || '未知',
        },
        {
          key: 'resolution',
          label: '分辨率',
          children: formatResolution(controller.videoSize) || '分辨率未知',
        },
        {
          key: 'duration',
          label: '总时长',
          children: controller.duration > 0 ? formatDuration(controller.duration) : '时长未知',
        },
        { key: 'position', label: '当前位置', children: formatDuration(controller.currentTime) },
        { key: 'rate', label: '播放速度', children: formatPlaybackRate(controller.playbackRate) },
        { key: 'volume', label: '音量', children: `${Math.round(controller.volume * 100)}%` },
        { key: 'buffered', label: '已缓冲', children: bufferedPercent },
        { key: 'loop', label: '循环播放', children: controller.loop ? '开' : '关' },
        { key: 'uri', label: '来源地址', children: source.resourceUri },
      ]}
    />
  ) : (
    <Empty description="尚未打开视频" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  );

  const subtitleContent =
    controller.subtitleTracks.length === 0 ? (
      <Typography.Text type="secondary">当前视频没有可切换的字幕轨道。</Typography.Text>
    ) : (
      <TrackList
        tracks={controller.subtitleTracks}
        offLabel="关闭字幕"
        fallbackPrefix="字幕轨"
        selectedKey={selectedSubtitleKey}
        onSelect={(key) => controller.selectSubtitleTrack(key === 'off' ? null : Number(key))}
      />
    );

  const audioContent =
    controller.audioTracks.length === 0 ? (
      <Typography.Text type="secondary">当前视频没有可切换的音频轨道。</Typography.Text>
    ) : (
      <TrackList
        tracks={controller.audioTracks}
        offLabel="默认音轨"
        fallbackPrefix="音轨"
        selectedKey={selectedAudioKey}
        onSelect={(key) => controller.selectAudioTrack(key === 'off' ? null : Number(key))}
      />
    );

  return (
    <div style={{ minWidth: 280, padding: token.paddingXS }}>
      <Tabs
        size="small"
        items={[
          { key: 'info', label: '视频信息', children: infoContent },
          { key: 'subtitles', label: '字幕', children: subtitleContent },
          { key: 'audio', label: '音频', children: audioContent },
        ]}
      />
    </div>
  );
};

export default MorePanel;
