import type { CSSProperties, ReactElement } from 'react';
import React from 'react';
import { Empty, theme } from '@chips/ui';
import { FileOutlined } from '@chips/ui';
import { chips } from '@chips/sdk';
import {
  buildFileOpenRequest,
  CARD_TYPE_ID,
  deriveDisplayFileName,
  readConfig,
} from './config';
import type { IFileConfig } from './config';
import { formatExtensionBadge } from './shared/utils';
import { resolveCategoryCoverUrl } from './shared/default-covers';
import { resolveFileCategory } from './shared/file-types';

/**
 * 查看态视图（08-基础卡片插件接口 §2.4.1）。
 *
 * 「打开」臂按《01-卡片文件格式》§6.9：整卡点击表达「打开该文件」意图——资源 ID 为
 * `file_file` 卡片根目录相对路径，MIME 由插件按后缀内置映射表推断，不传业务载荷，
 * 经 SDK `chips` 客户端真调用 `resource:open`（就近渲染容器内真实可用）。渲染帧
 * （sandbox iframe）内平台不注入 `window.chips`（08 §5.4），帧内打开臂的正式通道是
 * `frame:action`，依赖渲染帧插件执行通道（工单025 剩余 / #85）交付后切换；
 * 调用失败以行内简体中文提示呈现，不伪造成功。
 */

/** 封面与表面的结构常量（结构尺寸，非视觉令牌；颜色、间距、圆角一律走主题 token）。 */
const COVER_SIZE = 88;
const SURFACE_MIN_HEIGHT = 108;
const SURFACE_BORDER_RADIUS = 16;

interface IOpenOutcome {
  readonly state: 'idle' | 'opening' | 'error';
  readonly message: string | null;
}

/** 后缀文字徽标占位（《01》§6.9：未登记任何类别的后缀回退为带后缀文字的文件图标占位）。 */
function ExtensionBadgeCover({ badge }: { badge: string }): ReactElement {
  const { token } = theme.useToken();
  const fontSize = badge.length > 3 ? 13 : 17;

  return (
    <svg
      data-role="file-cover-fallback"
      viewBox="0 0 96 96"
      role="img"
      aria-label={badge}
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <path
        d="M28 12h26l14 14v54a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Z"
        fill={token.colorBgContainer}
        stroke={token.colorBorder}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M54 12v14h14"
        fill="none"
        stroke={token.colorBorder}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {badge ? (
        <text
          x="48"
          y="56"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fontWeight="700"
          fill={token.colorTextSecondary}
        >
          {badge}
        </text>
      ) : null}
    </svg>
  );
}

function CoverSurface({
  coverReference,
  fallbackBadge,
  title,
  borderRadius,
  background,
}: {
  coverReference: string;
  fallbackBadge: string;
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
      {coverReference.length > 0 ? (
        <img
          data-role="file-cover"
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
      ) : (
        <ExtensionBadgeCover badge={fallbackBadge} />
      )}
    </span>
  );
}

interface IFileSurfaceProps {
  config: IFileConfig;
  onOpen: () => void;
  outcome: IOpenOutcome;
}

function FileSurface({ config, onOpen, outcome }: IFileSurfaceProps): ReactElement {
  const { token } = theme.useToken();
  const displayFileName = deriveDisplayFileName(config) || '未命名文件';
  const extensionBadge = formatExtensionBadge(config.file_extension);
  const openRequest = buildFileOpenRequest(config);
  const openable = openRequest !== null;
  const categoryCoverUrl = resolveCategoryCoverUrl(resolveFileCategory(config.file_extension));
  const coverReference = config.cover_image.length > 0 ? config.cover_image : categoryCoverUrl;

  const content = (
    <>
      <CoverSurface
        coverReference={coverReference}
        fallbackBadge={extensionBadge}
        title={displayFileName}
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
          {displayFileName}
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
          {extensionBadge || '未识别后缀'}
        </span>
      </span>
    </>
  );

  const surfaceStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
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
          data-role="file-open"
          aria-label={`打开《${displayFileName}》`}
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
          aria-label="文件引用缺失或非法，暂无法打开"
          style={surfaceStyle}
        >
          {content}
          <span
            style={{
              flexBasis: '100%',
              color: token.colorTextSecondary,
              fontSize: token.fontSizeSM,
            }}
          >
            文件引用缺失或非法，暂无法打开
          </span>
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

export interface IFileViewProps {
  /** 节点内容 `config` 字段的原始值；缺失或非法时回退默认配置（08 §7.1 规则 2）。 */
  config: unknown;
}

/**
 * 查看态 React 组件：由 `renderView` 挂载；整卡点击经 SDK `chips` 客户端真调用
 * `resource:open`（14 §2.2、01 §6.9 无业务载荷），失败呈现行内错误提示。
 */
export function FileView({ config }: IFileViewProps): ReactElement {
  const { token } = theme.useToken();
  const resolved = readConfig(config);
  const [outcome, setOutcome] = React.useState<IOpenOutcome>({ state: 'idle', message: null });

  const open = (): void => {
    const request = buildFileOpenRequest(resolved);
    if (!request) {
      return;
    }
    setOutcome({ state: 'opening', message: '正在打开文件…' });
    chips
      .request('resource:open', request)
      .then(() => {
        setOutcome({ state: 'idle', message: null });
      })
      .catch(() => {
        setOutcome({
          state: 'error',
          message: '文件暂时无法打开：当前渲染环境未提供打开通道，请稍后重试',
        });
      });
  };

  return (
    <div data-card-type={CARD_TYPE_ID}>
      {resolved.file_file.length === 0 ? (
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
            image={<FileOutlined aria-hidden="true" />}
            description={
              <>
                <span style={{ display: 'block', fontWeight: 600 }}>未命名文件</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 13 }}>
                  上传文件后，这里会显示文件基础卡片。
                </span>
              </>
            }
          />
        </div>
      ) : (
        <FileSurface config={resolved} onOpen={open} outcome={outcome} />
      )}
    </div>
  );
}
