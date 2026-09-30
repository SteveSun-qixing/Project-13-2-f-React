import type { ReactElement } from 'react';
import React from 'react';
import { Button, Tag, theme } from '@chips/ui';
import { chips } from '@chips/sdk';
import {
  analyzeHyperlinkUrl,
  readConfig,
  securityHintText,
} from './config';
import type { IHyperlinkConfig, IHyperlinkUrlAnalysis } from './config';

/**
 * 查看态视图（08-基础卡片插件接口 §2.4.1）。
 *
 * 外部 http(s) 链接的打开按 14-资源打开与默认处理器契约 §8.5.2 归一为
 * `shell:openExternal`；本视图经 SDK `chips` 客户端真调用该能力（就近渲染容器与
 * 编辑预览内真实可用）。渲染帧（sandbox iframe）内平台不注入 `window.chips`（08 §5.4），
 * 帧内打开臂的正式通道是 `frame:action`，依赖渲染帧插件执行通道（工单025 剩余 / #85）
 * 交付后切换；调用失败以行内简体中文提示呈现，不伪造成功。
 */

/** 密度对应的表面最小高度（结构常量，非视觉令牌）。 */
const DENSITY_MIN_HEIGHT: Readonly<Record<IHyperlinkConfig['display_density'], number>> = {
  compact: 36,
  comfortable: 48,
  spacious: 60,
};

interface IOpenOutcome {
  readonly state: 'idle' | 'opening' | 'error';
  readonly message: string | null;
}

function SecurityBadge({
  analysis,
}: {
  analysis: IHyperlinkUrlAnalysis;
}): ReactElement {
  const hint = securityHintText(analysis);
  if (analysis.openable) {
    return <Tag color={analysis.level === 'warning' ? 'warning' : 'success'}>{hint}</Tag>;
  }
  return <Tag color="error">{hint}</Tag>;
}

function LinkSurface({
  config,
  onOpen,
  outcome,
}: {
  config: IHyperlinkConfig;
  onOpen: () => void;
  outcome: IOpenOutcome;
}): ReactElement {
  const { token } = theme.useToken();
  const analysis = analyzeHyperlinkUrl(config.url);
  const iconAnalysis = analyzeHyperlinkUrl(config.icon_url);
  const [failedIconUrl, setFailedIconUrl] = React.useState<string | null>(null);
  const anchorText = config.anchor_text.length > 0 ? config.anchor_text : '未命名链接';
  const displayUrl = analysis.normalizedUrl.length > 0 ? analysis.normalizedUrl : config.url;
  const urlText = analysis.hostname.length > 0 ? analysis.hostname : displayUrl;
  const hint = securityHintText(analysis);
  const openable = analysis.openable;

  const iconFrame = (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        width: 32,
        height: 32,
        borderRadius: token.borderRadius,
        background: token.colorFillSecondary,
        color: token.colorPrimary,
        fontSize: token.fontSizeLG,
        fontWeight: 600,
        lineHeight: 1,
        overflow: 'hidden',
      }}
    >
      {iconAnalysis.openable && failedIconUrl !== iconAnalysis.normalizedUrl ? (
        <img
          src={iconAnalysis.normalizedUrl}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => {
            setFailedIconUrl(iconAnalysis.normalizedUrl);
          }}
        />
      ) : (
        <span>↗</span>
      )}
    </span>
  );

  const content = (
    <>
      {iconFrame}
      <span
        style={{
          display: 'grid',
          gap: token.marginXXS,
          minWidth: 0,
          flex: '1 1 auto',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: token.marginXXS,
            minWidth: 0,
          }}
        >
          <span
            style={{
              minWidth: 0,
              color: token.colorText,
              fontSize: token.fontSize,
              fontWeight: 600,
              overflowWrap: 'anywhere',
            }}
          >
            {anchorText}
          </span>
          {config.show_security_hint ? <SecurityBadge analysis={analysis} /> : null}
        </span>
        {config.description.trim().length > 0 ? (
          <span
            style={{
              margin: 0,
              color: token.colorTextSecondary,
              fontSize: token.fontSizeSM,
              overflowWrap: 'anywhere',
            }}
          >
            {config.description}
          </span>
        ) : null}
        {urlText.length > 0 ? (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: token.marginXXS,
              margin: 0,
              color: token.colorTextSecondary,
              fontSize: token.fontSizeSM,
              overflowWrap: 'anywhere',
            }}
          >
            <span>{urlText}</span>
          </span>
        ) : null}
      </span>
    </>
  );

  const surfaceStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: token.marginSM,
    width: '100%',
    minHeight: DENSITY_MIN_HEIGHT[config.display_density],
    padding: `${token.paddingSM}px ${token.padding}px`,
    boxSizing: 'border-box',
    borderRadius: token.borderRadius,
    border: `1px ${openable ? 'solid' : 'dashed'} ${token.colorBorderSecondary}`,
    background: 'transparent',
    textAlign: 'left',
  };

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      {openable ? (
        <Button
          type="text"
          block
          aria-label={`打开链接 ${anchorText}（${displayUrl}）`}
          onClick={onOpen}
          style={{
            height: 'auto',
            padding: 0,
            ...surfaceStyle,
          }}
        >
          {content}
        </Button>
      ) : (
        <div role="group" aria-label={`链接不可打开：${hint}`} style={surfaceStyle}>
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

export interface IHyperlinkViewProps {
  /** 节点内容 `config` 字段的原始值；缺失或非法时回退默认配置（08 §7.1 规则 2）。 */
  config: unknown;
}

/**
 * 查看态 React 组件：由 `renderView` 挂载；打开动作经 SDK `chips` 客户端
 * 真调用 `shell:openExternal`，失败呈现行内错误提示。
 */
export function HyperlinkView({ config }: IHyperlinkViewProps): ReactElement {
  const resolved = readConfig(config);
  const [outcome, setOutcome] = React.useState<IOpenOutcome>({ state: 'idle', message: null });

  const open = (): void => {
    const analysis = analyzeHyperlinkUrl(resolved.url);
    if (!analysis.openable) {
      return;
    }
    setOutcome({ state: 'opening', message: '正在打开链接…' });
    chips
      .request('shell:openExternal', { url: analysis.normalizedUrl })
      .then(() => {
        setOutcome({ state: 'idle', message: null });
      })
      .catch(() => {
        setOutcome({
          state: 'error',
          message: '链接暂时无法打开：当前渲染环境未提供打开通道，请稍后重试',
        });
      });
  };

  return (
    <div data-card-type="base.hyperlink" data-density={resolved.display_density}>
      <LinkSurface config={resolved} onOpen={open} outcome={outcome} />
    </div>
  );
}
