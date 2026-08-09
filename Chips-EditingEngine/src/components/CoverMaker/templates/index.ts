/**
 * 封面模板定义
 * @module components/cover-maker/templates
 */

import type { CoverTemplate, TemplateConfig, TemplateStyle } from '../types';

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  // Use a simple replace for environments without DOM (since we generate strings)
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 格式化日期
 */
function formatDate(date?: string): string {
  if (!date) return '';
  return date;
}

const minimalWhiteTemplate: CoverTemplate = {
  id: 'minimal-white',
  name: '极简白',
  description: '白色背景的极简排版',
  previewStyle: 'background: #ffffff; color: #1a1a1a;',
  generateHtml: (config: TemplateConfig) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { height: 100%; }
    body {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: ${config.backgroundColor || '#ffffff'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
      text-align: center;
    }
    .title {
      font-size: 2em;
      font-weight: 600;
      color: ${config.primaryColor || '#1a1a1a'};
      line-height: 1.3;
      margin-bottom: 12px;
    }
    .subtitle {
      font-size: 1em;
      color: #666666;
      margin-bottom: 16px;
    }
    .meta {
      font-size: 0.85em;
      color: #999999;
    }
  </style>
</head>
<body>
  <h1 class="title">${escapeHtml(config.title)}</h1>
  ${config.subtitle ? `<p class="subtitle">${escapeHtml(config.subtitle)}</p>` : ''}
  ${config.author || config.date ? `<p class="meta">${config.author ? escapeHtml(config.author) : ''}${config.author && config.date ? ' · ' : ''}${formatDate(config.date)}</p>` : ''}
</body>
</html>`,
};

const gradientBlueTemplate: CoverTemplate = {
  id: 'gradient-blue',
  name: '渐变蓝',
  description: '蓝紫渐变背景',
  previewStyle: 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff;',
  generateHtml: (config: TemplateConfig) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { height: 100%; }
    body {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, ${config.primaryColor || '#667eea'} 0%, ${config.backgroundColor || '#764ba2'} 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
      text-align: center;
    }
    .title {
      font-size: 2em;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.3;
      margin-bottom: 12px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .subtitle {
      font-size: 1em;
      color: rgba(255,255,255,0.9);
      margin-bottom: 16px;
    }
    .meta {
      font-size: 0.85em;
      color: rgba(255,255,255,0.7);
    }
  </style>
</head>
<body>
  <h1 class="title">${escapeHtml(config.title)}</h1>
  ${config.subtitle ? `<p class="subtitle">${escapeHtml(config.subtitle)}</p>` : ''}
  ${config.author || config.date ? `<p class="meta">${config.author ? escapeHtml(config.author) : ''}${config.author && config.date ? ' · ' : ''}${formatDate(config.date)}</p>` : ''}
</body>
</html>`,
};

const darkThemeTemplate: CoverTemplate = {
  id: 'dark-theme',
  name: '暗色',
  description: '深色背景的暗色排版',
  previewStyle: 'background: #1a1a2e; color: #eaeaea;',
  generateHtml: (config: TemplateConfig) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { height: 100%; }
    body {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: ${config.backgroundColor || '#1a1a2e'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
      text-align: center;
    }
    .title {
      font-size: 2em;
      font-weight: 600;
      color: ${config.primaryColor || '#eaeaea'};
      line-height: 1.3;
      margin-bottom: 12px;
    }
    .subtitle {
      font-size: 1em;
      color: #a0a0a0;
      margin-bottom: 16px;
    }
    .meta {
      font-size: 0.85em;
      color: #707070;
    }
  </style>
</head>
<body>
  <h1 class="title">${escapeHtml(config.title)}</h1>
  ${config.subtitle ? `<p class="subtitle">${escapeHtml(config.subtitle)}</p>` : ''}
  ${config.author || config.date ? `<p class="meta">${config.author ? escapeHtml(config.author) : ''}${config.author && config.date ? ' · ' : ''}${formatDate(config.date)}</p>` : ''}
</body>
</html>`,
};

const geometricTemplate: CoverTemplate = {
  id: 'geometric',
  name: '几何图形',
  description: '几何色块装饰背景',
  previewStyle: 'background: #f8f9fa; color: #2d3436;',
  generateHtml: (config: TemplateConfig) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { height: 100%; }
    body {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: ${config.backgroundColor || '#f8f9fa'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .geometric-bg {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      opacity: 0.1;
      pointer-events: none;
    }
    .geometric-bg::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 80%;
      height: 150%;
      background: ${config.primaryColor || '#6c5ce7'};
      transform: rotate(15deg);
    }
    .geometric-bg::after {
      content: '';
      position: absolute;
      bottom: -30%;
      left: -10%;
      width: 60%;
      height: 80%;
      background: ${config.primaryColor || '#6c5ce7'};
      transform: rotate(-10deg);
      opacity: 0.5;
    }
    .content {
      position: relative;
      z-index: 1;
    }
    .title {
      font-size: 2em;
      font-weight: 700;
      color: ${config.primaryColor || '#2d3436'};
      line-height: 1.3;
      margin-bottom: 12px;
    }
    .subtitle {
      font-size: 1em;
      color: #636e72;
      margin-bottom: 16px;
    }
    .meta {
      font-size: 0.85em;
      color: #b2bec3;
    }
  </style>
</head>
<body>
  <div class="geometric-bg"></div>
  <div class="content">
    <h1 class="title">${escapeHtml(config.title)}</h1>
    ${config.subtitle ? `<p class="subtitle">${escapeHtml(config.subtitle)}</p>` : ''}
    ${config.author || config.date ? `<p class="meta">${config.author ? escapeHtml(config.author) : ''}${config.author && config.date ? ' · ' : ''}${formatDate(config.date)}</p>` : ''}
  </div>
</body>
</html>`,
};

const borderedTemplate: CoverTemplate = {
  id: 'bordered',
  name: '描边卡片',
  description: '白色卡片加蓝色描边',
  previewStyle: 'background: #ffffff; color: #2c3e50; border: 3px solid #3498db;',
  generateHtml: (config: TemplateConfig) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { height: 100%; }
    body {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${config.backgroundColor || '#ffffff'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
    }
    .frame {
      border: 4px solid ${config.primaryColor || '#3498db'};
      padding: 32px 24px;
      text-align: center;
      max-width: 90%;
    }
    .title {
      font-size: 1.8em;
      font-weight: 600;
      color: #2c3e50;
      line-height: 1.3;
      margin-bottom: 12px;
    }
    .subtitle {
      font-size: 1em;
      color: #7f8c8d;
      margin-bottom: 16px;
    }
    .meta {
      font-size: 0.85em;
      color: #bdc3c7;
    }
    .divider {
      width: 60px;
      height: 3px;
      background: ${config.primaryColor || '#3498db'};
      margin: 16px auto;
    }
  </style>
</head>
<body>
  <div class="frame">
    <h1 class="title">${escapeHtml(config.title)}</h1>
    <div class="divider"></div>
    ${config.subtitle ? `<p class="subtitle">${escapeHtml(config.subtitle)}</p>` : ''}
    ${config.author || config.date ? `<p class="meta">${config.author ? escapeHtml(config.author) : ''}${config.author && config.date ? ' · ' : ''}${formatDate(config.date)}</p>` : ''}
  </div>
</body>
</html>`,
};

const magazineTemplate: CoverTemplate = {
  id: 'magazine',
  name: '杂志',
  description: '杂志风格排版',
  previewStyle: 'background: #fafafa; color: #222222;',
  generateHtml: (config: TemplateConfig) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { height: 100%; }
    body {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      background: ${config.backgroundColor || '#fafafa'};
      font-family: Georgia, 'Times New Roman', serif;
      padding: 32px;
    }
    .accent {
      width: 48px;
      height: 4px;
      background: ${config.primaryColor || '#e74c3c'};
      margin-bottom: 16px;
    }
    .title {
      font-size: 2.2em;
      font-weight: 700;
      color: #222222;
      line-height: 1.2;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 1.1em;
      color: #555555;
      margin-bottom: 20px;
      font-style: italic;
    }
    .meta {
      font-size: 0.85em;
      color: #888888;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
  </style>
</head>
<body>
  <div class="accent"></div>
  <h1 class="title">${escapeHtml(config.title)}</h1>
  ${config.subtitle ? `<p class="subtitle">${escapeHtml(config.subtitle)}</p>` : ''}
  ${config.author || config.date ? `<p class="meta">${config.author ? escapeHtml(config.author) : ''}${config.author && config.date ? ' · ' : ''}${formatDate(config.date)}</p>` : ''}
</body>
</html>`,
};

const newsBannerTemplate: CoverTemplate = {
  id: 'news-banner',
  name: '新闻横幅',
  description: '新闻标题横幅排版',
  previewStyle: 'background: linear-gradient(to bottom, #e0e0e0 70%, #c0392b 70%); color: #ffffff;',
  generateHtml: (config: TemplateConfig) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { height: 100%; }
    body {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: ${config.backgroundColor || '#f0f0f0'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      position: relative;
    }
    .content-area {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .subtitle-text {
      font-size: 1.1em;
      color: #666666;
      text-align: center;
    }
    .banner {
      background: ${config.primaryColor || '#c0392b'};
      padding: 20px 24px;
    }
    .title {
      font-size: 1.5em;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.3;
      margin-bottom: 4px;
    }
    .meta {
      font-size: 0.8em;
      color: rgba(255,255,255,0.8);
    }
  </style>
</head>
<body>
  <div class="content-area">
    ${config.subtitle ? `<p class="subtitle-text">${escapeHtml(config.subtitle)}</p>` : ''}
  </div>
  <div class="banner">
    <h1 class="title">${escapeHtml(config.title)}</h1>
    ${config.author || config.date ? `<p class="meta">${config.author ? escapeHtml(config.author) : ''}${config.author && config.date ? ' · ' : ''}${formatDate(config.date)}</p>` : ''}
  </div>
</body>
</html>`,
};

const circleSoftTemplate: CoverTemplate = {
  id: 'circle-soft',
  name: '柔和圆',
  description: '柔和圆形装饰背景',
  previewStyle: 'background: #fff5f5; color: #c44569;',
  generateHtml: (config: TemplateConfig) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { height: 100%; }
    body {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: ${config.backgroundColor || '#fff5f5'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .circle-bg {
      position: absolute;
      border-radius: 50%;
      opacity: 0.15;
    }
    .circle-1 {
      width: 200%;
      height: 200%;
      background: ${config.primaryColor || '#c44569'};
      top: -80%;
      left: -50%;
    }
    .circle-2 {
      width: 100%;
      height: 100%;
      background: ${config.primaryColor || '#c44569'};
      bottom: -60%;
      right: -30%;
      opacity: 0.1;
    }
    .content {
      position: relative;
      z-index: 1;
    }
    .title {
      font-size: 2em;
      font-weight: 600;
      color: ${config.primaryColor || '#c44569'};
      line-height: 1.3;
      margin-bottom: 12px;
    }
    .subtitle {
      font-size: 1em;
      color: #886666;
      margin-bottom: 16px;
    }
    .meta {
      font-size: 0.85em;
      color: #aa8888;
    }
  </style>
</head>
<body>
  <div class="circle-bg circle-1"></div>
  <div class="circle-bg circle-2"></div>
  <div class="content">
    <h1 class="title">${escapeHtml(config.title)}</h1>
    ${config.subtitle ? `<p class="subtitle">${escapeHtml(config.subtitle)}</p>` : ''}
    ${config.author || config.date ? `<p class="meta">${config.author ? escapeHtml(config.author) : ''}${config.author && config.date ? ' · ' : ''}${formatDate(config.date)}</p>` : ''}
  </div>
</body>
</html>`,
};

export const templates: CoverTemplate[] = [
  minimalWhiteTemplate,
  gradientBlueTemplate,
  darkThemeTemplate,
  geometricTemplate,
  borderedTemplate,
  magazineTemplate,
  newsBannerTemplate,
  circleSoftTemplate,
];

export function getTemplateById(id: TemplateStyle): CoverTemplate | undefined {
  return templates.find((item) => item.id === id);
}

export function generateCoverHtml(templateId: TemplateStyle, config: TemplateConfig): string {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  return template.generateHtml(config);
}

export function generateImageCoverHtml(imagePath: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { height: 100%; }
    body {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
    }
    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <img src="${imagePath}" alt="Cover" />
</body>
</html>`;
}

export function generateDefaultCoverHtml(title: string): string {
  return generateCoverHtml('minimal-white', { title });
}
