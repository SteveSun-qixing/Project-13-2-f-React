/**
 * 粘贴清理：Word/Web 剪贴板 HTML 的规范化（去 mso 条件注释与 <o:p>、
 * 解开 <li><p>x</p></li> 的块级包裹），以及单单元格表格的文本化还原。
 */

export function cleanPastedHtml(html: string): string {
  return unwrapSingleCellTable(
    html
      .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, '')
      .replace(/<o:p>[\s\S]*?<\/o:p>/g, '')
      .replace(/<li([^>]*)>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/li>/g, '<li$1>$2</li>'),
  )
}

/**
 * Word 对齐：粘贴单个电子表格单元格时按文本插入，而不是生成 1×1 表格。
 * 仅当整段内容是唯一一个只含一个单元格的表格时才解开；其余保持原样。
 */
function unwrapSingleCellTable(html: string): string {
  if (!/<table/i.test(html)) return html
  try {
    const doc = new window.DOMParser().parseFromString(html, 'text/html')
    const body = doc.body
    const tables = body.querySelectorAll('table')
    if (tables.length !== 1) return html
    const table = tables[0]
    if (!table) return html
    // 表格必须是粘贴内容的全部实体内容；表格外任何位置的正文文本都会阻止解开
    if ((body.textContent ?? '').trim() !== (table.textContent ?? '').trim()) return html
    // 表格外的无文本内容（图片、分隔线等）同样保留表格
    if ([...body.querySelectorAll('img,svg,video,hr')].some((element) => !table.contains(element))) {
      return html
    }
    const cells = table.querySelectorAll('td,th')
    if (cells.length !== 1) return html
    if (cells[0]?.querySelector('table')) return html
    return cells[0]?.innerHTML ?? html
  } catch {
    return html
  }
}
