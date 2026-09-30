import type { ReactElement } from 'react';
import React from 'react';
import { theme } from '@chips/ui';
import { readContent, readDisplayConfig } from './config';
import { renderMarkdown, MarkdownRenderingUnavailableError } from './markdown-gateway';
import {
  ANCHOR_RESOURCE_PATH_ATTRIBUTE,
  ANCHOR_SAFE_ATTRIBUTES,
  classifyMarkdownAnchor,
} from './markdown/resource-links';
import { capabilityNoticeText, unsupportedDeclaredCapabilities } from './markdown/capabilities';

/**
 * 查看态视图（08-基础卡片插件接口 §2.4.1）。
 *
 * 渲染链：内联 Markdown 源文 → `chips.service.markdown` 契约 `renderHtml` → 安全 HTML
 * 挂载（`html:false` 转义与协议白名单由服务安全不变量保证，本视图不二次清洗）。
 *
 * 在册缺位（fail-closed 呈现，不伪造成功）：
 * - 渲染源未注入（平台插件执行通道，工单025 剩余 / #85）→「渲染通道未接入」；
 * - file 来源正文读取（帧内禁 `fetch` / `window.chips`，资源域接线归 W4 §七 条件四）
 *   →「文件内容读取通道未接入」；
 * - `markdown_capabilities` 声明而服务契约暂无承载的扩展语法 → 能力降级提示行。
 */

/** 挂载安全 HTML 的容器类名（结构钩子，非视觉样式）。 */
const SURFACE_CLASS = 'chips-richtext-card__surface';

interface IViewStatus {
  readonly kind: 'loading' | 'error';
  readonly message: string;
}

interface IRichTextViewProps {
  /** 节点内容根的原始值；缺失或非法字段回退默认值（08 §7.1 规则 2）。 */
  content: unknown;
}

/** 挂载安全 HTML 后的锚点加固：外链补安全属性，相对资源引用补资源路径数据属性。 */
function hardenAnchors(surface: HTMLElement): void {
  for (const anchor of Array.from(surface.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const kind = classifyMarkdownAnchor(anchor.getAttribute('href') ?? undefined);
    if (kind === 'external') {
      anchor.setAttribute('target', ANCHOR_SAFE_ATTRIBUTES.target);
      anchor.setAttribute('rel', ANCHOR_SAFE_ATTRIBUTES.rel);
      continue;
    }
    if (kind === 'resource') {
      // 包内相对引用经帧 `<base href>` 直接生效（04-基础卡片插件开发指南 §8.1）；
      // 资源路径以数据属性声明，供平台资源打开通道（工单025 剩余 / #85）接线后消费。
      anchor.setAttribute('rel', ANCHOR_SAFE_ATTRIBUTES.rel);
      anchor.setAttribute(ANCHOR_RESOURCE_PATH_ATTRIBUTE, anchor.getAttribute('href') ?? '');
    }
  }
}

/**
 * 查看态 React 组件：Markdown → 安全 HTML 的契约消费与挂载。
 */
export function RichTextView({ content }: IRichTextViewProps): ReactElement {
  const { token } = theme.useToken();
  const resolved = readContent(content);
  const displayConfig = readDisplayConfig(content);
  const notice = capabilityNoticeText(unsupportedDeclaredCapabilities(resolved.markdown_capabilities));
  const [html, setHtml] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<IViewStatus>({ kind: 'loading', message: '正在渲染富文本内容…' });

  React.useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setStatus({ kind: 'loading', message: '正在渲染富文本内容…' });

    if (resolved.content_source === 'file') {
      // 在册缺位：帧内禁 fetch / window.chips（04 §8.4），file 来源正文读取通道未接线。
      setStatus({ kind: 'error', message: '文件内容读取通道未接入：文件来源正文暂无法在此呈现' });
      return undefined;
    }

    const markdown = resolved.content_text ?? '';
    if (markdown.length === 0) {
      setStatus({ kind: 'error', message: '此卡片还没有正文内容' });
      return undefined;
    }

    renderMarkdown(markdown)
      .then((rendered) => {
        if (!cancelled) {
          setHtml(rendered);
          setStatus({ kind: 'loading', message: '' });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof MarkdownRenderingUnavailableError
            ? '渲染通道未接入：富文本渲染服务尚未与本环境接线'
            : '内容暂时无法渲染，请稍后重试';
        setStatus({ kind: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [resolved.content_source, resolved.content_text]);

  const surfaceRef = React.useCallback(
    (surface: HTMLElement | null) => {
      if (surface !== null && html !== null) {
        hardenAnchors(surface);
      }
    },
    [html]
  );

  return (
    <div data-card-type="base.richtext" data-content-source={resolved.content_source}>
      {html !== null ? (
        <div
          ref={surfaceRef}
          className={SURFACE_CLASS}
          lang={resolved.locale}
          style={{
            color: token.colorText,
            fontSize: displayConfig.fontSize,
            lineHeight: String(displayConfig.lineHeight),
            overflowWrap: 'anywhere',
          }}
          // 安全 HTML 片段直接进入受控渲染面是 markdown 服务契约的既定消费形态
          // （render-html.output.schema.json）；转义与协议白名单由服务安全不变量保证。
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
      {status.message.length > 0 ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: `${token.paddingXS}px 0`,
            color: status.kind === 'error' ? token.colorError : token.colorTextSecondary,
            fontSize: token.fontSizeSM,
          }}
        >
          {status.message}
        </p>
      ) : null}
      {html !== null && notice.length > 0 ? (
        <p
          style={{
            margin: 0,
            padding: `${token.paddingXS}px 0 0`,
            color: token.colorTextSecondary,
            fontSize: token.fontSizeSM,
          }}
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}
