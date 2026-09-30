import React from 'react';
import { CustomerServiceOutlined, Typography, theme } from '@chips/ui';
import { findActiveLyricIndex, resolveActiveLyricProgress, type LyricsDocument } from '../player/lyrics';
import { resolveLyricsViewportOffset } from '../player/lyricsLayout';

/**
 * 歌词面板（重写件）。
 *
 * 交互语义（矩阵「播控/歌词/舞台 UI」行：歌词跟随随 03-查看器设计重建）：
 * timed 模式按当前播放时刻二分定位活动行并滚动跟随（视口偏移按容器高度的三分之一档，
 * 消费迁移件 `resolveLyricsViewportOffset`）；活动行按行内进度做逐字强调（消费迁移件
 * `resolveActiveLyricProgress`）；plain 模式整段平铺；empty 模式如实提示无歌词。
 */

export interface LyricsPaneProps {
  lyrics: LyricsDocument;
  /** 当前播放时刻（毫秒）。 */
  currentTimeMs: number;
  /** 面板高度（像素；用于计算跟随偏移）。 */
  viewportHeight?: number;
}

export const LyricsPane: React.FC<LyricsPaneProps> = ({ lyrics, currentTimeMs, viewportHeight = 320 }) => {
  const { token } = theme.useToken();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const activeLineRef = React.useRef<HTMLElement | null>(null);

  const activeIndex =
    lyrics.mode === 'timed' ? findActiveLyricIndex(lyrics.lines, currentTimeMs) : -1;
  const activeProgress =
    activeIndex >= 0 ? resolveActiveLyricProgress(lyrics.lines, currentTimeMs, activeIndex) : 0;

  // 歌词跟随：活动行滚动到视口偏移位（消费迁移件布局纯函数）；无滚动面的环境跳过。
  React.useEffect(() => {
    const container = containerRef.current;
    const activeLine = activeLineRef.current;
    if (!container || !activeLine || activeIndex < 0 || typeof container.scrollTo !== 'function') {
      return;
    }
    const offset = resolveLyricsViewportOffset(viewportHeight);
    container.scrollTo({ top: Math.max(0, activeLine.offsetTop - offset), behavior: 'smooth' });
  }, [activeIndex, viewportHeight]);

  if (lyrics.mode === 'empty') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 160,
        }}
      >
        <Typography.Text type="secondary">暂无歌词</Typography.Text>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      aria-label={lyrics.mode === 'timed' ? '同步歌词' : '文本歌词'}
      style={{
        flex: 1,
        overflowY: 'auto',
        scrollBehavior: 'smooth',
        padding: `${token.paddingSM}px ${token.paddingMD}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginSM,
      }}
    >
      {lyrics.mode === 'timed'
        ? lyrics.lines.map((line, index) => {
            const isActive = index === activeIndex;
            const played = index < activeIndex;
            return (
              <Typography.Paragraph
                key={line.id}
                ref={isActive ? activeLineRef : undefined}
                style={{
                  margin: 0,
                  fontSize: isActive ? token.fontSizeLG : token.fontSize,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? token.colorText
                    : played
                      ? token.colorTextSecondary
                      : token.colorTextTertiary,
                  transition: `color 200ms ease ${isActive ? 0 : 70}ms, font-size 200ms ease`,
                  textAlign: 'center',
                }}
              >
                {line.text}
              </Typography.Paragraph>
            );
          })
        : lyrics.lines.map((line) => (
            <Typography.Paragraph
              key={line.id}
              style={{ margin: 0, color: token.colorTextSecondary, textAlign: 'center' }}
            >
              {line.text}
            </Typography.Paragraph>
          ))}
      {lyrics.mode === 'timed' && activeIndex >= 0 ? (
        <Typography.Text
          type="secondary"
          style={{ fontSize: token.fontSizeSM, textAlign: 'center' }}
          aria-label="当前行进度"
        >
          {`歌词行进度 ${Math.round(activeProgress * 100)}%`}
        </Typography.Text>
      ) : null}
      {lyrics.lines.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: token.paddingMD }}>
          <CustomerServiceOutlined style={{ color: token.colorTextTertiary }} />
        </div>
      ) : null}
    </div>
  );
};

export default LyricsPane;
