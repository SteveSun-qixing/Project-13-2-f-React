import React from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { Empty, Tag, theme } from '@chips/ui';
import { ReadOutlined } from '@chips/ui';
import { chips } from '@chips/sdk';
import {
  buildBookOpenRequest,
  CARD_TYPE_ID,
  deriveDisplayAuthor,
  deriveDisplayTitle,
  formatBookFormatLabel,
  readConfig,
} from './config';
import type { IBookConfig } from './config';
import { sortImageItems } from './shared/utils';

/**
 * 查看态视图（08-基础卡片插件接口 §2.4.1）。
 *
 * 「打开阅读」臂按《09-官方插件与应用目录》§4.2 book 行：整卡经平台资源打开链路交付
 * 书籍阅读器——《14-资源打开与默认处理器契约》§5.4 的书籍卡片载荷经 SDK `chips` 客户端
 * 真调用 `resource:open`（就近渲染容器内真实可用）。渲染帧（sandbox iframe）内平台不注入
 * `window.chips`（08 §5.4），帧内打开臂的正式通道是 `frame:action`，依赖渲染帧插件执行
 * 通道（工单025 剩余 / #85）交付后切换；调用失败以行内简体中文提示呈现，不伪造成功。
 * 阅读进度 / 目录 / 书签是阅读器应用内引擎状态（《10-官方内容处理与阅读服务设计》§2.1），
 * 不在卡片内实现。
 */

/** 封面与表面的结构常量（结构尺寸，非视觉令牌；颜色、间距、圆角一律走主题 token）。 */
const COVER_HEIGHT = 168;
const COVER_ASPECT_RATIO = '2 / 3';
const SURFACE_MIN_HEIGHT = 184;
const SURFACE_BORDER_RADIUS = 16;

/** 封面加载失败的兜底图形（自旧族迁移的内联 SVG 数据 URL，零外部依赖）。 */
const COVER_FALLBACK_IMAGE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="192" viewBox="0 0 128 192">',
      '<rect width="128" height="192" rx="8" fill="#f2f2f7"/>',
      '<g transform="translate(16 48) scale(0.1154)" fill="#6e6e73">',
      '<path d="M928 161H699.2c-49.1 0-97.1 14.1-138.4 40.7L512 233l-48.8-31.3A255.2 255.2 0 0 0 324.8 161H96c-17.7 0-32 14.3-32 32v568c0 17.7 14.3 32 32 32h228.8c49.1 0 97.1 14.1 138.4 40.7l44.4 28.6c1.3.8 2.8 1.3 4.3 1.3s3-.4 4.3-1.3l44.4-28.6C602 807.1 650.1 793 699.2 793H928c17.7 0 32-14.3 32-32V193c0-17.7-14.3-32-32-32zM324.8 721H136V233h188.8c35.4 0 69.8 10.1 99.5 29.2l48.8 31.3 6.9 4.5v462c-47.6-25.6-100.8-39-155.2-39zm563.2 0H699.2c-54.4 0-107.6 13.4-155.2 39V298l6.9-4.5 48.8-31.3c29.7-19.1 64.1-29.2 99.5-29.2H888v488zM396.9 361H211.1c-3.9 0-7.1 3.4-7.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c.1-4.1-3.1-7.5-7-7.5zm223.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c0-4.1-3.2-7.5-7.1-7.5H627.1c-3.9 0-7.1 3.4-7.1 7.5zM396.9 501H211.1c-3.9 0-7.1 3.4-7.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c.1-4.1-3.1-7.5-7-7.5zm416 0H627.1c-3.9 0-7.1 3.4-7.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c.1-4.1-3.1-7.5-7-7.5z"/>',
      '</g>',
      '</svg>',
    ].join('')
  );

interface IOpenOutcome {
  readonly state: 'idle' | 'opening' | 'error';
  readonly message: string | null;
}

interface ICoverProps {
  coverReference: string;
  title: string;
}

function BookCover({ coverReference, title }: ICoverProps): ReactElement {
  const [failed, setFailed] = React.useState(false);
  const { token } = theme.useToken();

  if (!coverReference) {
    return (
      <span
        data-role="book-cover-placeholder"
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          width: '100%',
          height: '100%',
          color: token.colorTextSecondary,
          background: token.colorFillQuaternary,
        }}
      >
        <ReadOutlined style={{ fontSize: 42 }} aria-hidden="true" />
      </span>
    );
  }

  if (failed) {
    // 引用解析或加载失败：呈现旧族迁移的兜底封面图形，不以破图示人。
    return (
      <img
        data-role="book-cover-fallback"
        src={COVER_FALLBACK_IMAGE}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          display: 'block',
          margin: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    );
  }

  return (
    <img
      data-role="book-cover"
      src={coverReference}
      alt={title}
      draggable={false}
      loading="lazy"
      onError={() => {
        setFailed(true);
      }}
      style={{
        display: 'block',
        margin: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
}

function hasPrimaryResource(config: IBookConfig): boolean {
  if (config.source_type === 'image-sequence') {
    return sortImageItems(config.image_sequence, config.image_sort_basis).some(
      (image) => image.file_path.length > 0
    );
  }

  return config.book_file.length > 0;
}

interface IBookSurfaceProps {
  config: IBookConfig;
  onOpen: () => void;
  outcome: IOpenOutcome;
}

function BookSurface({ config, onOpen, outcome }: IBookSurfaceProps): ReactElement {
  const { token } = theme.useToken();
  const displayTitle = deriveDisplayTitle(config) || '未命名书籍';
  const authorLabel = deriveDisplayAuthor(config) || '未知作者';
  const openRequest = buildBookOpenRequest(config);
  const openable = openRequest !== null;
  const coverReference =
    config.cover_image.length > 0
      ? config.cover_image
      : (sortImageItems(config.image_sequence, config.image_sort_basis).find(
          (image) => image.file_path.length > 0
        )?.file_path ?? '');
  const formatLabel = formatBookFormatLabel(config);
  const imageCount =
    config.source_type === 'image-sequence'
      ? sortImageItems(config.image_sequence, config.image_sort_basis).filter(
          (image) => image.file_path.length > 0
        ).length
      : 0;

  const content = (
    <>
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          flex: `0 0 ${COVER_HEIGHT * (2 / 3)}px`,
          width: COVER_HEIGHT * (2 / 3),
          height: COVER_HEIGHT,
          minWidth: 96,
          aspectRatio: COVER_ASPECT_RATIO,
          borderRadius: token.borderRadius,
          overflow: 'hidden',
          alignSelf: 'center',
          background: token.colorBgContainer,
          boxShadow: token.boxShadowTertiary,
        }}
      >
        <BookCover coverReference={coverReference} title={displayTitle} />
      </span>
      <span
        style={{
          display: 'grid',
          gap: token.marginXS,
          alignContent: 'center',
          flex: '1 1 auto',
          minWidth: 0,
          padding: `${token.paddingXXS}px 0`,
        }}
      >
        <span
          style={{
            margin: 0,
            color: token.colorText,
            fontSize: 20,
            fontWeight: 700,
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
            fontSize: token.fontSize,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {authorLabel}
        </span>
        {formatLabel || imageCount > 0 ? (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginXXS, marginTop: token.marginXXS }}>
            {formatLabel ? (
              <Tag style={{ marginInlineEnd: 0 }}>{formatLabel}</Tag>
            ) : null}
            {imageCount > 0 ? <Tag style={{ marginInlineEnd: 0 }}>{imageCount} 张图片</Tag> : null}
          </span>
        ) : null}
      </span>
    </>
  );

  const surfaceStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: token.marginLG,
    width: '100%',
    minHeight: SURFACE_MIN_HEIGHT,
    padding: token.paddingLG,
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
          data-role="book-open"
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
        <div role="group" aria-label="书籍资源缺失或非法，暂无法打开阅读器" style={surfaceStyle}>
          {content}
        </div>
      )}
      {outcome.state !== 'idle' ? (
        <p
          role="status"
          style={{
            margin: 0,
            marginTop: token.marginXXS,
            color: outcome.state === 'error' ? token.colorError : token.colorTextSecondary,
            fontSize: token.fontSizeSM,
          }}
        >
          {outcome.message}
        </p>
      ) : null}
    </div>
  );
}

export interface IBookViewProps {
  /** 节点内容 `config` 字段的原始值；缺失或非法时回退默认配置（08 §7.1 规则 2）。 */
  config: unknown;
}

/**
 * 查看态 React 组件：由 `renderView` 挂载；打开动作经 SDK `chips` 客户端真调用
 * `resource:open`（14 §5.4 书籍卡片载荷），失败呈现行内错误提示。
 */
export function BookView({ config }: IBookViewProps): ReactElement {
  const { token } = theme.useToken();
  const resolved = readConfig(config);
  const [outcome, setOutcome] = React.useState<IOpenOutcome>({ state: 'idle', message: null });

  const open = (): void => {
    const request = buildBookOpenRequest(resolved);
    if (!request) {
      return;
    }
    setOutcome({ state: 'opening', message: '正在打开书籍…' });
    chips
      .request('resource:open', request)
      .then(() => {
        setOutcome({ state: 'idle', message: null });
      })
      .catch(() => {
        setOutcome({
          state: 'error',
          message: '书籍暂时无法打开：当前渲染环境未提供阅读通道，请稍后重试',
        });
      });
  };

  return (
    <div data-card-type={CARD_TYPE_ID}>
      {!hasPrimaryResource(resolved) ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 116,
            boxSizing: 'border-box',
            borderRadius: SURFACE_BORDER_RADIUS,
            border: `1px dashed ${token.colorBorderSecondary}`,
            background: token.colorFillQuaternary,
          }}
        >
          <Empty
            image={<ReadOutlined aria-hidden="true" />}
            description={
              <>
                <span style={{ display: 'block', fontWeight: 700 }}>未选择电子书</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                  资源尚不可用。
                </span>
              </>
            }
          />
        </div>
      ) : (
        <BookSurface config={resolved} onOpen={open} outcome={outcome} />
      )}
    </div>
  );
}
