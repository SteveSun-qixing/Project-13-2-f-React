/**
 * HTML 转义：文本与属性共用单一实现（`&` `<` `>` `"` `'` 全量转义），
 * 保证任意卡片模型值进入产物都不会产生可执行标记（转义安全臂的单一事实源）。
 */

/** HTML 文本与属性安全转义（先转 `&`，避免二次转义）。 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * HTML 文本节点体转义（只转 `&` `<` `>`）：引号与撇号在文本节点内不承载任何
 * 标记语义，保留字面形以维持 JSON 收口等纯文本片段的可读性；属性值一律走
 * 全量 `escapeHtml`，不得使用本函数。
 */
export function escapeHtmlTextBody(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
