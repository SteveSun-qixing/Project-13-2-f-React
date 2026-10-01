import type { CSSProperties, ReactElement } from 'react';
import React from 'react';
import { CaretRightFilled, Empty, Tag, VideoCameraOutlined, theme } from '@chips/ui';
import { chips } from '@chips/sdk';
import {
  buildVideoOpenRequest,
  CARD_TYPE_ID,
  deriveDisplayTitle,
  deriveMetaLine,
  readConfig,
} from './config';
import type { IVideoConfig } from './config';

/**
 * 查看态视图（08-基础卡片插件接口 §2.4.1）。
 *
 * 「播放」臂按《01-卡片文件格式》§6.2：把 `video_file` 对应资源经平台资源打开链路交给
 * 视频播放器——《14-资源打开与默认处理器契约》§5.4 的视频卡片载荷经 SDK `chips` 客户端
 * 真调用 `resource:open`（就近渲染容器内真实可用；处理器缺位时失败行内如实提示，
 * 不伪造成功，工单071）。渲染帧（sandbox iframe）内平台不注入 `window.chips`（08 §5.4），
 * 帧内打开臂的正式通道是 `frame:action`，依赖渲染帧插件执行通道（工单025 剩余 / #85）
 * 交付后切换。
 *
 * 封面未配置时以视频首帧回退呈现（旧族语义）：`<video>` 只承载 `preload="metadata"`
 * 的首帧解码，无控件、不自动播放、对辅助技术隐藏，不是自建播放面。
 */

/** 海报宽比与表面结构常量（结构尺寸，非视觉令牌；颜色、间距、圆角一律走主题 token）。 */
const SURFACE_BORDER_RADIUS = 16;
const POSTER_SEEK_SECONDS = 0.08;

interface IOpenOutcome {
  readonly state: 'idle' | 'opening' | 'error';
  readonly message: string | null;
}

/** 首帧回退面：加载元数据后定帧到约 0.08s，仅作海报呈现。 */
function PosterFallbackVideo({ src }: { src: string }): ReactElement {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const handleLoadedMetadata = (): void => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    const duration = Number.isFinite(element.duration) ? element.duration : 0;
    const targetTime = duration > POSTER_SEEK_SECONDS ? Math.min(POSTER_SEEK_SECONDS, duration / 2) : 0;
    if (targetTime <= 0) {
      element.pause();
      return;
    }
    try {
      element.currentTime = targetTime;
    } catch {
      element.pause();
    }
  };

  return (
    <video
      ref={videoRef}
      data-role="video-fallback"
      src={src}
      preload="metadata"
      muted
      onLoadedMetadata={handleLoadedMetadata}
      aria-hidden="true"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
}

interface IVideoSurfaceProps {
  config: IVideoConfig;
  onOpen: () => void;
  outcome: IOpenOutcome;
}

function VideoSurface({ config, onOpen, outcome }: IVideoSurfaceProps): ReactElement {
  const { token } = theme.useToken();
  const displayTitle = deriveDisplayTitle(config);
  const metaLine = deriveMetaLine(config);
  const openRequest = buildVideoOpenRequest(config);
  const openable = openRequest !== null;
  const validSubtitleCount = config.subtitles.filter((track) => track.file_path.length > 0).length;

  const metaItems = [
    validSubtitleCount > 0 ? `${validSubtitleCount} 条字幕` : '',
    config.playback.loop ? '循环' : '',
    config.playback.autoplay ? '自动播放' : '',
    config.playback.playback_rate !== 1 ? `倍速 ${config.playback.playback_rate}x` : '',
    config.playback.start_time > 0 ? `起始 ${config.playback.start_time} 秒` : '',
  ].filter((item) => item.length > 0);

  const posterStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    borderRadius: token.borderRadiusLG,
    overflow: 'hidden',
    background: token.colorFillQuaternary,
  };

  const content = (
    <>
      <span style={posterStyle}>
        {config.cover_image.length > 0 ? (
          <img
            data-role="video-cover"
            src={config.cover_image}
            alt={displayTitle}
            draggable={false}
            loading="lazy"
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <PosterFallbackVideo src={config.video_file} />
        )}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: token.colorBgMask,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: token.colorBgSpotlight,
            }}
          >
            <CaretRightFilled
              aria-hidden="true"
              style={{ marginLeft: 4, fontSize: 30, color: token.colorTextLightSolid }}
            />
          </span>
        </span>
      </span>

      {metaItems.length > 0 || metaLine ? (
        <span
          style={{
            display: 'grid',
            gap: token.marginXXS,
            paddingTop: token.paddingXS,
          }}
        >
          {config.video_title.trim() ? (
            <span
              style={{
                margin: 0,
                color: token.colorText,
                fontSize: token.fontSizeLG,
                fontWeight: 600,
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
              }}
            >
              {config.video_title.trim()}
            </span>
          ) : null}
          {metaLine ? (
            <span
              style={{
                margin: 0,
                color: token.colorTextSecondary,
                fontSize: token.fontSizeSM,
              }}
            >
              {metaLine}
            </span>
          ) : null}
          {metaItems.length > 0 ? (
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginXXS }}>
              {metaItems.map((item) => (
                <Tag key={item} style={{ marginInlineEnd: 0 }}>
                  {item}
                </Tag>
              ))}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );

  const surfaceStyle: CSSProperties = {
    display: 'grid',
    gap: 0,
    width: '100%',
    padding: token.paddingSM,
    boxSizing: 'border-box',
    borderRadius: SURFACE_BORDER_RADIUS,
    border: `1px ${openable ? 'solid' : 'dashed'} ${token.colorBorderSecondary}`,
    background: token.colorFillQuaternary,
    textAlign: 'left',
  };

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      {openable ? (
        <button
          type="button"
          data-role="video-open"
          aria-label={displayTitle ? `打开视频：${displayTitle}` : '打开视频'}
          onClick={onOpen}
          style={{
            cursor: 'pointer',
            font: 'inherit',
            color: 'inherit',
            appearance: 'none',
            ...surfaceStyle,
          }}
        >
          {content}
        </button>
      ) : (
        <div
          role="group"
          aria-label="视频引用缺失或非法，暂无法打开播放器"
          style={surfaceStyle}
        >
          {content}
        </div>
      )}
      {outcome.state !== 'idle' ? (
        <p
          role="status"
          style={{
            margin: 0,
            marginTop: token.marginXXS,
            color:
              outcome.state === 'error' ? token.colorError : token.colorTextSecondary,
            fontSize: token.fontSizeSM,
          }}
        >
          {outcome.message}
        </p>
      ) : null}
    </div>
  );
}

export interface IVideoViewProps {
  /** 节点内容 `config` 字段的原始值；缺失或非法时回退默认配置（08 §7.1 规则 2）。 */
  config: unknown;
}

/**
 * 查看态 React 组件：由 `renderView` 挂载；打开动作经 SDK `chips` 客户端真调用
 * `resource:open`（14 §5.4 视频卡片载荷），失败呈现行内错误提示。
 */
export function VideoView({ config }: IVideoViewProps): ReactElement {
  const { token } = theme.useToken();
  const resolved = readConfig(config);
  const [outcome, setOutcome] = React.useState<IOpenOutcome>({ state: 'idle', message: null });

  const open = (): void => {
    const request = buildVideoOpenRequest(resolved);
    if (!request) {
      return;
    }
    setOutcome({ state: 'opening', message: '正在打开视频…' });
    chips
      .request('resource:open', request)
      .then(() => {
        setOutcome({ state: 'idle', message: null });
      })
      .catch(() => {
        setOutcome({
          state: 'error',
          message: '视频暂时无法打开：当前渲染环境未提供播放通道，请稍后重试',
        });
      });
  };

  return (
    <div data-card-type={CARD_TYPE_ID}>
      {resolved.video_file.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 108,
            boxSizing: 'border-box',
            borderRadius: SURFACE_BORDER_RADIUS,
            border: `1px dashed ${token.colorBorderSecondary}`,
            background: token.colorFillQuaternary,
          }}
        >
          <Empty
            image={<VideoCameraOutlined aria-hidden="true" />}
            description={
              <>
                <span style={{ display: 'block', fontWeight: 600 }}>还没有视频内容</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 13 }}>
                  填写视频文件后，这里会显示视频基础卡片。
                </span>
              </>
            }
          />
        </div>
      ) : (
        <VideoSurface config={resolved} onOpen={open} outcome={outcome} />
      )}
    </div>
  );
}
