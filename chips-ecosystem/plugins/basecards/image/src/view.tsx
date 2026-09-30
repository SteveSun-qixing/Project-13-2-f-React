import type { CSSProperties, ReactElement, WheelEvent as ReactWheelEvent } from 'react';
import React, { useRef, useState } from 'react';
import { Empty, theme } from '@chips/ui';
import { PictureOutlined } from '@chips/ui';
import { chips } from '@chips/sdk';
import {
  buildImageOpenRequest,
  CARD_TYPE_ID,
  deriveEffectiveLayoutType,
  getGridColumns,
  getGridDisplayLimit,
  getSpacingMetrics,
  readConfig,
} from './config';
import type {
  IImageConfig,
  IImageItem,
  ImageSingleAlignment,
} from './config';

/**
 * 查看态视图（08-基础卡片插件接口 §2.4.1）。
 *
 * 包内相对引用经渲染帧注入的 `<base href>` 协议路径直接生效（《04-基础卡片插件开发指南》§8.1）；
 * 「查看大图」臂按《14-资源打开与默认处理器契约》§2.2 经 SDK `chips` 客户端真调用
 * `resource:open`（就近渲染容器内真实可用；图片类型未登记业务载荷，不构造 payload）。
 * 渲染帧（sandbox iframe）内平台不注入 `window.chips`（08 §5.4），帧内打开臂的正式通道是
 * `frame:action`，依赖渲染帧插件执行通道（工单025 剩余 / #85）交付后切换；调用失败以行内
 * 简体中文提示如实呈现，不伪造成功（工单063）。
 */

interface IOpenOutcome {
  readonly state: 'idle' | 'opening' | 'error';
  readonly message: string | null;
}

const PLACEHOLDER_TEXT = '图片暂时不可用';
const HORIZONTAL_ITEM_WIDTH = 'min(76vw, 560px)';

function alignmentToJustify(alignment: ImageSingleAlignment): string {
  if (alignment === 'left') {
    return 'flex-start';
  }
  if (alignment === 'right') {
    return 'flex-end';
  }
  return 'center';
}

function ImageFrame(props: {
  item: IImageItem;
  src: string;
  radius: number;
  fillHeight?: boolean;
  aspectRatio?: string;
  dimmed?: boolean;
  onOpen: () => void;
  onResourceError: () => void;
}): ReactElement {
  const { item, src, radius, fillHeight = false, aspectRatio, dimmed = false, onOpen, onResourceError } = props;
  const { token } = theme.useToken();
  const [loadFailed, setLoadFailed] = useState(false);

  React.useEffect(() => {
    setLoadFailed(false);
  }, [src]);

  const openable = src.trim().length > 0 && buildImageOpenRequest(item) !== null;

  const frameStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: `${radius}px`,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorFillQuaternary,
    boxShadow: token.boxShadowTertiary,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(fillHeight ? { height: '100%' } : {}),
  };

  return (
    <div
      data-role="image-frame"
      data-image-id={item.id}
      style={{
        cursor: openable ? 'pointer' : 'default',
        ...frameStyle,
      }}
      {...(openable
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': `查看图片 ${deriveFrameLabel(item)}`,
            onClick: onOpen,
            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen();
              }
            },
          }
        : {})}
    >
      {src.trim().length > 0 && !loadFailed ? (
        <img
          src={src}
          alt={item.alt}
          title={item.title.length > 0 ? item.title : undefined}
          style={{
            display: 'block',
            width: '100%',
            height: fillHeight ? '100%' : 'auto',
            objectFit: 'cover',
            userSelect: 'none',
            ...(dimmed ? { filter: 'brightness(0.48)' } : {}),
          }}
          onError={() => {
            setLoadFailed(true);
            onResourceError();
          }}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div
          data-role="image-placeholder"
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: 180,
            padding: token.padding,
            color: token.colorTextSecondary,
            fontSize: token.fontSizeSM,
            textAlign: 'center',
            height: fillHeight ? '100%' : undefined,
            boxSizing: 'border-box',
          }}
        >
          {PLACEHOLDER_TEXT}
        </div>
      )}
    </div>
  );
}

function deriveFrameLabel(item: IImageItem): string {
  return [item.title, item.alt, item.source === 'url' ? item.url : item.file_path].find(
    (value) => value.trim().length > 0
  )?.trim() ?? '未命名图片';
}

function displaySource(item: IImageItem): string {
  return item.source === 'url' ? item.url : item.file_path;
}

function GridSurface(props: {
  config: IImageConfig;
  onOpen: (item: IImageItem) => void;
  onResourceError: (item: IImageItem) => void;
}): ReactElement {
  const { config, onOpen, onResourceError } = props;
  const { token } = theme.useToken();
  const gridMode = config.layout_options.grid_mode;
  const spacing = getSpacingMetrics(config.layout_options.spacing_mode);
  const displayLimit = getGridDisplayLimit(gridMode);
  const hasOverflow = Number.isFinite(displayLimit) && config.images.length > displayLimit;
  const displayImages = hasOverflow ? config.images.slice(0, displayLimit) : config.images;
  const overflowCount = hasOverflow ? config.images.length - displayLimit + 1 : 0;

  return (
    <div
      data-role="grid-surface"
      style={{
        display: 'grid',
        width: '100%',
        gap: `${spacing.gap}px`,
        gridTemplateColumns: `repeat(${getGridColumns(gridMode)}, minmax(0, 1fr))`,
      }}
    >
      {displayImages.map((item, index) => {
        const isOverflowCell = hasOverflow && index === displayImages.length - 1;
        return (
          <div key={item.id} data-role="grid-cell" style={{ position: 'relative', minWidth: 0 }}>
            <ImageFrame
              item={item}
              src={displaySource(item)}
              radius={spacing.radius}
              aspectRatio="1 / 1"
              fillHeight
              dimmed={isOverflowCell}
              onOpen={() => {
                onOpen(item);
              }}
              onResourceError={() => {
                onResourceError(item);
              }}
            />
            {isOverflowCell ? (
              <div
                data-role="grid-overflow-badge"
                aria-label={`还有 ${overflowCount} 张图片未展示`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 28,
                  fontWeight: 700,
                  color: token.colorWhite,
                  background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.62))',
                  pointerEvents: 'none',
                }}
              >
                +{overflowCount}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export interface IImageViewProps {
  /** 节点内容 `config` 字段的原始值；缺失或非法时回退默认配置（08 §7.1 规则 2）。 */
  config: unknown;
}

/**
 * 查看态 React 组件：由 `renderView` 挂载；打开动作经 SDK `chips` 客户端真调用
 * `resource:open`（《14》§2.2），失败呈现行内错误提示。
 */
export function ImageView({ config }: IImageViewProps): ReactElement {
  const { token } = theme.useToken();
  const resolved = readConfig(config);
  const horizontalRef = useRef<HTMLDivElement | null>(null);
  const [outcome, setOutcome] = useState<IOpenOutcome>({ state: 'idle', message: null });

  const openImage = (item: IImageItem): void => {
    const request = buildImageOpenRequest(item);
    if (!request) {
      return;
    }
    setOutcome({ state: 'opening', message: '正在打开图片…' });
    chips
      .request('resource:open', request)
      .then(() => {
        setOutcome({ state: 'idle', message: null });
      })
      .catch(() => {
        setOutcome({
          state: 'error',
          message: '图片暂时无法打开：当前渲染环境未提供查看通道，请稍后重试',
        });
      });
  };

  const handleHorizontalWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    if (horizontalRef.current) {
      horizontalRef.current.scrollLeft += event.deltaY;
    }
  };

  if (resolved.images.length === 0) {
    return (
      <div data-card-type={CARD_TYPE_ID}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 220,
            boxSizing: 'border-box',
            borderRadius: token.borderRadiusLG,
            border: `1px dashed ${token.colorBorderSecondary}`,
            background: token.colorFillQuaternary,
          }}
        >
          <Empty
            image={<PictureOutlined aria-hidden="true" />}
            description={
              <>
                <span style={{ display: 'block', fontWeight: 600 }}>暂无图片内容</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 13 }}>
                  添加图片后，这里会按所选排版展示。
                </span>
              </>
            }
          />
        </div>
      </div>
    );
  }

  const effectiveLayout = deriveEffectiveLayoutType(resolved);
  const spacing = getSpacingMetrics(resolved.layout_options.spacing_mode);
  const statusLine =
    outcome.state === 'idle' ? null : (
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
    );

  let surface: ReactElement;
  if (effectiveLayout === 'single') {
    const singleImage = resolved.images[0];
    if (!singleImage) {
      return (
        <div data-card-type={CARD_TYPE_ID}>
          <GridSurface
            config={resolved}
            onOpen={openImage}
            onResourceError={() => undefined}
          />
        </div>
      );
    }
    surface = (
      <div
        data-role="single-surface"
        style={{
          display: 'flex',
          width: '100%',
          justifyContent: alignmentToJustify(resolved.layout_options.single_alignment),
        }}
      >
        <div style={{ width: `${resolved.layout_options.single_width_percent}%`, maxWidth: '100%' }}>
          <ImageFrame
            item={singleImage}
            src={displaySource(singleImage)}
            radius={spacing.radius}
            onOpen={() => {
              openImage(singleImage);
            }}
            onResourceError={() => undefined}
          />
        </div>
      </div>
    );
  } else if (effectiveLayout === 'grid') {
    surface = (
      <GridSurface config={resolved} onOpen={openImage} onResourceError={() => undefined} />
    );
  } else if (effectiveLayout === 'long-scroll') {
    surface = (
      <div
        data-role="long-scroll-stack"
        style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: `${spacing.gap}px` }}
      >
        {resolved.images.map((item) => (
          <ImageFrame
            key={item.id}
            item={item}
            src={displaySource(item)}
            radius={spacing.radius}
            onOpen={() => {
              openImage(item);
            }}
            onResourceError={() => undefined}
          />
        ))}
      </div>
    );
  } else {
    surface = (
      <div
        ref={horizontalRef}
        data-role="horizontal-scroller"
        onWheel={handleHorizontalWheel}
        style={{
          width: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          overscrollBehaviorX: 'contain',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            width: 'max-content',
            minWidth: '100%',
            gap: `${spacing.gap}px`,
          }}
        >
          {resolved.images.map((item) => (
            <div key={item.id} style={{ flex: '0 0 auto', width: HORIZONTAL_ITEM_WIDTH }}>
              <ImageFrame
                item={item}
                src={displaySource(item)}
                radius={spacing.radius}
                fillHeight
                onOpen={() => {
                  openImage(item);
                }}
                onResourceError={() => undefined}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-card-type={CARD_TYPE_ID} data-layout={effectiveLayout}>
      {surface}
      {statusLine}
    </div>
  );
}
