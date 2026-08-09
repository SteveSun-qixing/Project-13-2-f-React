import React, { useRef, useMemo, useEffect } from 'react';
import type { TemplateStyle, TemplateConfig } from './types';
import { generateCoverHtml, getTemplateById } from './templates/index';
import { formatMessage } from '../../lib/messages';
import './TemplatePreview.css';

interface TemplatePreviewProps {
  templateId: TemplateStyle | null;
  config: TemplateConfig;
  aspectRatio?: string;
  customHtml?: string;
  onHtmlGenerated?: (html: string) => void;
}

export function TemplatePreview({
  templateId,
  config,
  aspectRatio = '3/4',
  customHtml,
  onHtmlGenerated,
}: TemplatePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const getPlaceholderHtml = () => {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      width: 100%;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      color: #999;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <span>${formatMessage('cover_maker.preview_empty')}</span>
</body>
</html>`;
  };

  const generatedHtml = useMemo(() => {
    if (customHtml) {
      return customHtml;
    }

    if (!templateId || !config.title) {
      return getPlaceholderHtml();
    }

    try {
      return generateCoverHtml(templateId, config);
    } catch {
      return getPlaceholderHtml();
    }
  }, [templateId, config, customHtml]);

  const currentTemplate = useMemo(() => {
    if (!templateId) return null;
    return getTemplateById(templateId);
  }, [templateId]);

  useEffect(() => {
    if (!iframeRef.current) {
      return;
    }

    const doc = iframeRef.current.contentDocument;
    if (!doc) {
      return;
    }

    doc.open();
    doc.write(generatedHtml);
    doc.close();

    if (templateId && config.title && onHtmlGenerated) {
      onHtmlGenerated(generatedHtml);
    }
  }, [config.title, generatedHtml, onHtmlGenerated, templateId]);

  return (
    <div className="template-preview">
      <div className="template-preview__header">
        <span className="template-preview__label">{formatMessage('cover_maker.preview_label')}</span>
        {currentTemplate && (
          <span className="template-preview__template-name">
            {currentTemplate.name}
          </span>
        )}
      </div>

      <div
        className="template-preview__container"
        style={{ aspectRatio }}
      >
        <iframe
          ref={iframeRef}
          className="template-preview__iframe"
          sandbox="allow-same-origin"
          title={formatMessage('cover_maker.preview_label')}
        />
      </div>

      <div className="template-preview__info">
        <span className="template-preview__ratio">
          {formatMessage('cover_maker.preview_ratio', { ratio: aspectRatio.replace('/', ':') })}
        </span>
      </div>
    </div>
  );
}
