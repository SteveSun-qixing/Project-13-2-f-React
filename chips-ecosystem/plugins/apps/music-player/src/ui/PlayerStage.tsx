import React from 'react';
import { CustomerServiceOutlined, Image, Slider, Tag, Typography, theme } from '@chips/ui';
import type { TrackPresentation } from '../player/trackSession';
import { resolveTrackFormatLabel } from '../player/trackSession';
import { resolveEmbeddedArtworkUrl } from '../player/artworkRuntime';
import { formatDuration, formatRemainingDuration } from '../player/musicPlayer';
import { LyricsPane } from './LyricsPane';

/**
 * 播放舞台（重写件）：封面、曲目信息、进度与歌词。
 *
 * 封面解析：companion 地址直挂；embedded 字节经迁移件 `resolveEmbeddedArtworkUrl`
 * 编排（ImageDecoder/canvas 转码与 blob URL，含解码缓存）；default 呈现占位图形。
 */

export interface PlayerStageProps {
  presentation: TrackPresentation;
  currentTime: number;
  duration: number;
  bufferedUntil: number;
  onSeekPreview: (nextTime: number) => void;
  onSeekCommit: (nextTime: number) => void;
  /** 预览中的进度值；null 表示未在拖动。 */
  seekPreview: number | null;
}

/** 嵌入封面解码缓存：按曲目会话键缓存已解析的 blob URL。 */
const embeddedArtworkUrlCache = new Map<string, string>();

function EmbeddedArtworkImage({ presentation }: { presentation: TrackPresentation }): React.ReactElement {
  const { artwork } = presentation;
  const cacheKey = artwork.kind === 'embedded' ? artwork.cacheKey : '';
  const [url, setUrl] = React.useState<string | null>(
    cacheKey ? (embeddedArtworkUrlCache.get(cacheKey) ?? null) : null,
  );

  React.useEffect(() => {
    if (artwork.kind !== 'embedded') {
      return;
    }
    const cached = embeddedArtworkUrlCache.get(artwork.cacheKey);
    if (cached !== undefined) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    void resolveEmbeddedArtworkUrl(artwork.artwork).then((resolved) => {
      if (cancelled) {
        return;
      }
      embeddedArtworkUrlCache.set(artwork.cacheKey, resolved);
      setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [artwork]);

  if (url === null) {
    return <CustomerServiceOutlined style={{ fontSize: 96, color: 'rgba(0,0,0,0.25)' }} aria-label="嵌入封面解析中" />;
  }
  return <Image src={url} alt="嵌入封面" width={192} height={192} style={{ objectFit: 'cover', borderRadius: 8 }} />;
}

export const PlayerStage: React.FC<PlayerStageProps> = ({
  presentation,
  currentTime,
  duration,
  bufferedUntil,
  onSeekPreview,
  onSeekCommit,
  seekPreview,
}) => {
  const { token } = theme.useToken();
  const formatLabel = resolveTrackFormatLabel(presentation);
  const canSeek = duration > 0;
  const progressValue = seekPreview ?? currentTime;

  return (
    <section
      aria-label="播放舞台"
      style={{
        display: 'flex',
        gap: token.marginLG,
        padding: `${token.paddingMD}px ${token.paddingLG}px 0`,
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: token.marginSM,
          flex: '0 0 auto',
        }}
      >
        <div
          style={{
            width: 192,
            height: 192,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: token.colorBgLayout,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {presentation.artwork.kind === 'companion' ? (
            <Image
              src={presentation.artwork.uri}
              alt="伴生封面"
              width={192}
              height={192}
              style={{ objectFit: 'cover' }}
            />
          ) : presentation.artwork.kind === 'embedded' ? (
            <EmbeddedArtworkImage presentation={presentation} />
          ) : (
            <CustomerServiceOutlined style={{ fontSize: 96, color: token.colorTextQuaternary }} aria-label="默认封面" />
          )}
        </div>
        <div style={{ textAlign: 'center', maxWidth: 220 }}>
          <Typography.Title level={5} style={{ margin: 0 }} ellipsis>
            {presentation.title}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ display: 'block' }} ellipsis>
            {presentation.artist || '未知歌手'}
            {presentation.album ? ` · ${presentation.album}` : ''}
          </Typography.Text>
          {formatLabel ? (
            <Tag style={{ marginTop: token.marginXXS }} aria-label="音频格式">
              {formatLabel}
            </Tag>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <LyricsPane lyrics={presentation.lyrics} currentTimeMs={currentTime * 1000} />
        <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM, paddingBlock: token.paddingXXS }}>
          <Typography.Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: token.fontSizeSM }}>
            {formatDuration(currentTime)}
          </Typography.Text>
          <Slider
            ariaLabelForHandle="播放进度"
            min={0}
            max={duration > 0 ? duration : 1}
            step={0.1}
            disabled={!canSeek}
            value={progressValue}
            tooltip={{ formatter: (value) => formatDuration(Number(value ?? 0)) }}
            onChange={(value) => {
              onSeekPreview(Number(value));
            }}
            onChangeComplete={(value) => {
              onSeekCommit(Number(value));
            }}
            style={{ flex: 1, marginInline: 0 }}
          />
          <Typography.Text
            style={{ fontVariantNumeric: 'tabular-nums', fontSize: token.fontSizeSM }}
            aria-label="剩余时长"
          >
            {bufferedUntil > 0 && bufferedUntil < duration
              ? `已缓冲 ${formatDuration(bufferedUntil)} · `
              : ''}
            {formatRemainingDuration(duration, currentTime)}
          </Typography.Text>
        </div>
      </div>
    </section>
  );
};

export default PlayerStage;
