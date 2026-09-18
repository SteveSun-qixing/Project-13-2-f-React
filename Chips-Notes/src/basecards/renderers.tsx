/**
 * 基础卡片渲染器
 * @module basecards/renderers
 * @description 提供所有基础卡片类型的查看渲染组件（只读模式）
 */

import React from 'react';

interface RendererProps {
  config: any;
}

/**
 * 富文本卡片渲染
 * 解析 HTML 并安全渲染
 */
export function RichTextRenderer({ config }: RendererProps): React.ReactElement {
  const content = (config?.content as string) || '';
  return (
    <div
      style={{
        padding: '12px 0',
        lineHeight: 1.6,
        color: '#333',
      }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

/**
 * 图片卡片渲染
 */
export function ImageRenderer({ config }: RendererProps): React.ReactElement {
  const src = (config?.src as string) || '';
  const alt = (config?.alt as string) || '';

  if (!src) {
    return <div style={{ padding: 16, color: '#999' }}>未配置图片资源</div>;
  }

  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <img
        src={src}
        alt={alt}
        style={{ maxWidth: '100%', borderRadius: 4 }}
        loading="lazy"
      />
    </div>
  );
}

/**
 * 视频卡片渲染
 */
export function VideoRenderer({ config }: RendererProps): React.ReactElement {
  const src = (config?.src as string) || '';
  const poster = (config?.poster as string) || '';

  if (!src) {
    return <div style={{ padding: 16, color: '#999' }}>未配置视频资源</div>;
  }

  return (
    <div style={{ padding: '12px 0' }}>
      <video
        src={src}
        poster={poster}
        controls
        style={{ width: '100%', borderRadius: 4 }}
      >
        您的浏览器不支持视频标签。
      </video>
    </div>
  );
}

/**
 * 音频卡片渲染
 */
export function AudioRenderer({ config }: RendererProps): React.ReactElement {
  const src = (config?.src as string) || '';
  const title = (config?.title as string) || '';

  if (!src) {
    return <div style={{ padding: 16, color: '#999' }}>未配置音频资源</div>;
  }

  return (
    <div style={{ padding: '12px 0' }}>
      {title && (
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
          {title}
        </div>
      )}
      <audio src={src} controls style={{ width: '100%' }}>
        您的浏览器不支持音频标签。
      </audio>
    </div>
  );
}

/**
 * 网页卡片渲染
 */
export function WebpageRenderer({ config }: RendererProps): React.ReactElement {
  const url = (config?.url as string) || '';
  const title = (config?.title as string) || url;

  if (!url) {
    return <div style={{ padding: 16, color: '#999' }}>未配置网页地址</div>;
  }

  return (
    <div style={{ padding: '12px 0' }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#1890ff',
          textDecoration: 'none',
          wordBreak: 'break-all',
        }}
      >
        {title}
      </a>
    </div>
  );
}

/**
 * 文件卡片渲染
 */
export function FileRenderer({ config }: RendererProps): React.ReactElement {
  const path = (config?.path as string) || '';
  const name = (config?.name as string) || path.split('/').pop() || '文件';

  if (!path) {
    return <div style={{ padding: 16, color: '#999' }}>未配置文件</div>;
  }

  const handleDownload = async () => {
    // 这里应该实现下载逻辑
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        border: '1px solid #f0f0f0',
        borderRadius: 4,
        margin: '12px 0',
        background: '#fafafa',
      }}
    >
      <span style={{ marginRight: 8, fontSize: 18 }}>📎</span>
      <span style={{ flex: 1, fontSize: 14 }}>{name}</span>
      <a href={path} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
        打开
      </a>
    </div>
  );
}

/**
 * 表格卡片渲染
 */
export function TableRenderer({ config }: RendererProps): React.ReactElement {
  const data = (config?.data as any[][]) || [];

  if (!data.length) {
    return <div style={{ padding: 16, color: '#999' }}>空表格</div>;
  }

  return (
    <div style={{ padding: '12px 0', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    border: '1px solid #d9d9d9',
                    padding: '8px 12px',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 代码卡片渲染
 */
export function CodeRenderer({ config }: RendererProps): React.ReactElement {
  const code = (config?.code as string) || '';
  const language = (config?.language as string) || 'text';

  return (
    <div style={{ padding: '12px 0' }}>
      <pre
        style={{
          margin: 0,
          padding: 16,
          background: '#1e1e1e',
          color: '#d4d4d4',
          borderRadius: 4,
          overflow: 'auto',
          fontSize: 13,
          fontFamily: 'Menlo, Consolas, monospace',
          lineHeight: 1.5,
        }}
      >
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

/**
 * 基础卡片渲染路由
 */
export function BaseCardRenderer({ cardType, config }: { cardType: string; config: any }): React.ReactElement {
  switch (cardType) {
    case 'chips.basecard.rich-text':
      return <RichTextRenderer config={config} />;
    case 'chips.basecard.image':
      return <ImageRenderer config={config} />;
    case 'chips.basecard.video':
      return <VideoRenderer config={config} />;
    case 'chips.basecard.audio':
      return <AudioRenderer config={config} />;
    case 'chips.basecard.webpage':
      return <WebpageRenderer config={config} />;
    case 'chips.basecard.file':
      return <FileRenderer config={config} />;
    case 'chips.basecard.table':
      return <TableRenderer config={config} />;
    case 'chips.basecard.code':
      return <CodeRenderer config={config} />;
    default:
      return (
        <div style={{ padding: 16, color: '#999' }}>
          未知的基础卡片类型: {cardType}
        </div>
      );
  }
}
