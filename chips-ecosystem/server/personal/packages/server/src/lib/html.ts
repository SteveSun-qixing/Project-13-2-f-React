/**
 * 服务端生成 HTML 的最小转义（卡片默认封面页、箱子只读文档共用）。
 * 文案与页面均为简体中文直写（ADR-006：主题与多语言系统已废止）。
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
