/**
 * 基础卡片渲染帧样式生成
 *
 * 主题系统移除后（task030-07 规范），不再读取 Host 注入的主题 CSS 与 --chips-* 变量，
 * 统一输出固定的苹果风格色值（背景 #f5f5f7、表面 #ffffff、文本 #1d1d1f、主色 #0a84ff、边框 rgba(0,0,0,0.08)）。
 * 函数签名保持不变，供 basecard-runtime/frame-host.tsx 调用。
 */

export function createBasecardFrameThemeCss(_referenceElement: HTMLElement): string {
  return [
    'html, body {',
    '  margin: 0;',
    '  padding: 0;',
    '  width: 100%;',
    '  min-height: 100%;',
    '  background: transparent;',
    '}',
    'body {',
    '  font: 15px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    '  color: #1d1d1f;',
    '  overflow: hidden;',
    '}',
    '[data-chips-basecard-frame-root] {',
    '  width: 100%;',
    '  min-height: 0;',
    '}',
    '.chips-basecard {',
    '  box-sizing: border-box;',
    '  width: 100%;',
    '  background: #ffffff;',
    '  padding: 22px 24px;',
    '}',
    '.chips-basecard__body { color: #1d1d1f; }',
    '.chips-basecard__body > :first-child { margin-top: 0; }',
    '.chips-basecard__body > :last-child { margin-bottom: 0; }',
    '.chips-basecard__body a { color: #0a84ff; }',
    '.chips-basecard__body img { max-width: 100%; height: auto; border-radius: 10px; }',
    '.chips-basecard__body blockquote {',
    '  margin: 16px 0;',
    '  padding: 0 0 0 16px;',
    '  border-left: 3px solid rgba(0, 0, 0, 0.08);',
    '}',
    '.chips-basecard__body hr {',
    '  border: none;',
    '  border-top: 1px solid rgba(0, 0, 0, 0.08);',
    '  margin: 18px 0;',
    '}',
    '.chips-basecard__body code {',
    '  padding: 1px 6px;',
    '  border-radius: 6px;',
    '  background: rgba(0, 0, 0, 0.05);',
    '}',
    '.chips-basecard__body pre {',
    '  overflow: auto;',
    '  padding: 14px;',
    '  border-radius: 10px;',
    '  background: rgba(0, 0, 0, 0.05);',
    '}',
  ].join('\n');
}
