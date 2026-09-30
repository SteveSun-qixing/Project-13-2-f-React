import type { CSSProperties, ReactElement } from 'react';
import React from 'react';
import { Empty, Tag, theme } from '@chips/ui';
import { SoundOutlined } from '@chips/ui';
import { chips } from '@chips/sdk';
import {
  buildMusicOpenRequest,
  CARD_TYPE_ID,
  deriveDisplayTitle,
  derivePrimaryArtist,
  readConfig,
} from './config';
import type { IMusicConfig } from './config';
import { DEFAULT_MUSIC_COVER_URL } from './shared/default-cover';

/**
 * 查看态视图（08-基础卡片插件接口 §2.4.1）。
 *
 * 「播放」臂按《01-卡片文件格式》§6.8：把 `audio_file` 对应资源经平台资源打开链路交给
 * 音乐播放器——《14-资源打开与默认处理器契约》§9.2 的音乐卡片载荷经 SDK `chips` 客户端
 * 真调用 `resource:open`（就近渲染容器内真实可用）。渲染帧（sandbox iframe）内平台不注入
 * `window.chips`（08 §5.4），帧内打开臂的正式通道是 `frame:action`，依赖渲染帧插件执行
 * 通道（工单025 剩余 / #85）交付后切换；调用失败以行内简体中文提示呈现，不伪造成功。
 */

/** 封面与表面的结构常量（结构尺寸，非视觉令牌；颜色、间距、圆角一律走主题 token）。 */
const COVER_SIZE = 88;
const SURFACE_MIN_HEIGHT = 108;
const SURFACE_BORDER_RADIUS = 16;

interface IOpenOutcome {
  readonly state: 'idle' | 'opening' | 'error';
  readonly message: string | null;
}

function CoverSurface({
  coverReference,
  title,
  borderRadius,
  background,
}: {
  coverReference: string;
  title: string;
  borderRadius: number;
  background: string;
}): ReactElement {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        flex: `0 0 ${COVER_SIZE}px`,
        width: COVER_SIZE,
        height: COVER_SIZE,
        minWidth: COVER_SIZE,
        borderRadius,
        overflow: 'hidden',
        background,
      }}
    >
      <img
        data-role="music-cover"
        src={coverReference}
        alt={title}
        draggable={false}
        loading="lazy"
        style={{
          display: 'block',
          margin: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </span>
  );
}

interface IMusicSurfaceProps {
  config: IMusicConfig;
  onOpen: () => void;
  outcome: IOpenOutcome;
}

function MusicSurface({ config, onOpen, outcome }: IMusicSurfaceProps): ReactElement {
  const { token } = theme.useToken();
  const displayTitle = deriveDisplayTitle(config) || '未命名歌曲';
  const artistLabel = derivePrimaryArtist(config) || '未填写歌手';
  const openRequest = buildMusicOpenRequest(config);
  const openable = openRequest !== null;
  const coverReference =
    config.album_cover.length > 0 ? config.album_cover : DEFAULT_MUSIC_COVER_URL;

  const metaItems = [
    config.album_name.length > 0 ? `专辑 · ${config.album_name}` : '',
    config.language.length > 0 ? `语种 · ${config.language}` : '',
    config.genre.length > 0 ? `流派 · ${config.genre}` : '',
    config.release_date.length > 0 ? `发行 · ${config.release_date}` : '',
  ].filter((item) => item.length > 0);

  const content = (
    <>
      <CoverSurface
        coverReference={coverReference}
        title={displayTitle}
        borderRadius={token.borderRadiusLG}
        background={token.colorBgContainer}
      />
      <span
        style={{
          display: 'grid',
          gap: token.marginXXS,
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        <span
          style={{
            margin: 0,
            color: token.colorText,
            fontSize: token.fontSizeLG,
            fontWeight: 600,
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            overflowWrap: 'anywhere',
          }}
        >
          {displayTitle}
        </span>
        <span
          style={{
            margin: 0,
            color: token.colorTextSecondary,
            fontSize: token.fontSizeSM,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {artistLabel}
        </span>
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
    </>
  );

  const surfaceStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: token.marginSM,
    width: '100%',
    minHeight: SURFACE_MIN_HEIGHT,
    padding: `${token.paddingSM}px ${token.padding}px`,
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
          data-role="music-open"
          aria-label={`打开《${displayTitle}》`}
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
          aria-label="音频引用缺失或非法，暂无法打开播放器"
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

export interface IMusicViewProps {
  /** 节点内容 `config` 字段的原始值；缺失或非法时回退默认配置（08 §7.1 规则 2）。 */
  config: unknown;
}

/**
 * 查看态 React 组件：由 `renderView` 挂载；播放动作经 SDK `chips` 客户端真调用
 * `resource:open`（14 §9.2 音乐卡片载荷），失败呈现行内错误提示。
 */
export function MusicView({ config }: IMusicViewProps): ReactElement {
  const { token } = theme.useToken();
  const resolved = readConfig(config);
  const [outcome, setOutcome] = React.useState<IOpenOutcome>({ state: 'idle', message: null });

  const open = (): void => {
    const request = buildMusicOpenRequest(resolved);
    if (!request) {
      return;
    }
    setOutcome({ state: 'opening', message: '正在打开音频…' });
    chips
      .request('resource:open', request)
      .then(() => {
        setOutcome({ state: 'idle', message: null });
      })
      .catch(() => {
        setOutcome({
          state: 'error',
          message: '音频暂时无法打开：当前渲染环境未提供播放通道，请稍后重试',
        });
      });
  };

  return (
    <div data-card-type={CARD_TYPE_ID}>
      {resolved.audio_file.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: SURFACE_MIN_HEIGHT,
            boxSizing: 'border-box',
            borderRadius: SURFACE_BORDER_RADIUS,
            border: `1px dashed ${token.colorBorderSecondary}`,
            background: token.colorFillQuaternary,
          }}
        >
          <Empty
            image={<SoundOutlined aria-hidden="true" />}
            description={
              <>
                <span style={{ display: 'block', fontWeight: 600 }}>未命名歌曲</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 13 }}>
                  上传音频文件后，这里会显示音乐基础卡片。
                </span>
              </>
            }
          />
        </div>
      ) : (
        <MusicSurface config={resolved} onOpen={open} outcome={outcome} />
      )}
    </div>
  );
}
