import React, { useEffect, useRef } from 'react';
import { formatMessage } from '../../lib/messages';
import './CoverHtmlPreview.css';

interface CoverHtmlPreviewProps {
  customHtml: string;
  aspectRatio?: string;
}

export function CoverHtmlPreview({ customHtml, aspectRatio = '3/4' }: CoverHtmlPreviewProps) {
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

  const previewHtml = customHtml.trim().length > 0 ? customHtml : getPlaceholderHtml();

  useEffect(() => {
    if (!iframeRef.current) {
      return;
    }

    const doc = iframeRef.current.contentDocument;
    if (!doc) {
      return;
    }

    doc.open();
    doc.write(previewHtml);
    doc.close();
  }, [previewHtml]);

  return (
    <div className="cover-html-preview">
      <div className="cover-html-preview__header">
        <span className="cover-html-preview__label">{formatMessage('cover_maker.preview_label')}</span>
      </div>

      <div
        className="cover-html-preview__container"
        style={{ aspectRatio }}
      >
        <iframe
          ref={iframeRef}
          className="cover-html-preview__iframe"
          sandbox="allow-same-origin"
          title={formatMessage('cover_maker.preview_label')}
        />
      </div>

      <div className="cover-html-preview__info">
        <span className="cover-html-preview__ratio">
          {formatMessage('cover_maker.preview_ratio', { ratio: aspectRatio.replace('/', ':') })}
        </span>
      </div>
    </div>
  );
}
