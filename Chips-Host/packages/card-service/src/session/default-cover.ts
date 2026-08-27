/**
 * 默认封面 HTML 生成器（Host 侧临时实现，task034 M5 将收敛到 chips.module.cover）
 *
 * 语义来源：Chips-EditingEngine `src/utils/card-cover.ts`（task034 M2 上移）。
 * 白底 + 居中卡片名称；与编辑引擎实际输出保持一致。
 */

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const createDefaultCoverHtml = (cardName: string): string => {
  const safeCardName = escapeHtml(cardName);
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <style>',
    '    html, body { margin: 0; width: 100%; height: 100%; }',
    '    body {',
    '      display: grid;',
    '      place-items: center;',
    '      background: #ffffff;',
    '      color: #1d1d1f;',
    '      font: 600 24px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    '      text-align: center;',
    '      padding: 24px;',
    '      box-sizing: border-box;',
    '      overflow: hidden;',
    '    }',
    '    @media (orientation: landscape) {',
    '      body { font-size: 20px; }',
    '    }',
    '  </style>',
    '</head>',
    `  <body>${safeCardName}</body>`,
    '</html>',
  ].join('\n');
};
