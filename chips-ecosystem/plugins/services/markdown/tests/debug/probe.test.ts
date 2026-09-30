import MarkdownIt, { type Token } from 'markdown-it';
import { describe, expect, it } from 'vitest';

/** 把 token 流压缩为 `type(tag,nesting,hidden[,start=N])` 行（原开发期探针的输出格式）。 */
function dumpTokens(tokens: readonly Token[], withStart = false): string {
  return tokens
    .map((t) =>
      withStart
        ? `${t.type}(${t.tag},${t.nesting},${t.hidden ? 'h' : '-'},start=${String(t.attrGet('start'))})`
        : `${t.type}(${t.tag},${t.nesting},${t.hidden ? 'h' : '-'})`
    )
    .join('\n');
}

/**
 * markdown-it 引擎行为特征化断言（原 console 探针收口：打印改断言，期望值取自真实输出）。
 *
 * 固化四项引擎特征，防止 markdown-it 升级时行为漂移：
 * 1. 紧列表：嵌套 `ul` 在外层 `li` 关闭前开启，段落 token 全部隐藏（h）；
 * 2. 有序列表：起始序号 `start` 保留在 `ordered_list_open` 上，其余 token 无 start；
 * 3. 表格：三列对齐（左/中/右）渲染为 thead/tbody 结构；
 * 4. 安全特征：`javascript:` 协议链接不生成 `<a>`，退化为纯文本段落。
 */
describe('markdown-it 引擎行为特征（探针固化）', () => {
  const md = new MarkdownIt({ html: false });

  it('紧列表：外层 li 关闭前先开启嵌套 ul，段落 token 全部隐藏', () => {
    expect(dumpTokens(md.parse('- 甲\n  - 甲一', {}))).toBe(
      [
        'bullet_list_open(ul,1,-)',
        'list_item_open(li,1,-)',
        'paragraph_open(p,1,h)',
        'inline(,0,-)',
        'paragraph_close(p,-1,h)',
        'bullet_list_open(ul,1,-)',
        'list_item_open(li,1,-)',
        'paragraph_open(p,1,h)',
        'inline(,0,-)',
        'paragraph_close(p,-1,h)',
        'list_item_close(li,-1,-)',
        'bullet_list_close(ul,-1,-)',
        'list_item_close(li,-1,-)',
        'bullet_list_close(ul,-1,-)',
      ].join('\n')
    );
  });

  it('有序列表：起始序号 start 只保留在 ordered_list_open 上', () => {
    expect(dumpTokens(md.parse('5. 五\n6. 六', {}), true)).toBe(
      [
        'ordered_list_open(ol,1,-,start=5)',
        'list_item_open(li,1,-,start=null)',
        'paragraph_open(p,1,h,start=null)',
        'inline(,0,-,start=null)',
        'paragraph_close(p,-1,h,start=null)',
        'list_item_close(li,-1,-,start=null)',
        'list_item_open(li,1,-,start=null)',
        'paragraph_open(p,1,h,start=null)',
        'inline(,0,-,start=null)',
        'paragraph_close(p,-1,h,start=null)',
        'list_item_close(li,-1,-,start=null)',
        'ordered_list_close(ol,-1,-,start=null)',
      ].join('\n')
    );
  });

  it('表格：三列对齐（左/中/右）渲染为 thead/tbody 结构', () => {
    expect(md.render('| 左 | 中 | 右 |\n|:---|:---:|---:|\n| a | b | c |')).toBe(
      [
        '<table>',
        '<thead>',
        '<tr>',
        '<th style="text-align:left">左</th>',
        '<th style="text-align:center">中</th>',
        '<th style="text-align:right">右</th>',
        '</tr>',
        '</thead>',
        '<tbody>',
        '<tr>',
        '<td style="text-align:left">a</td>',
        '<td style="text-align:center">b</td>',
        '<td style="text-align:right">c</td>',
        '</tr>',
        '</tbody>',
        '</table>',
        '',
      ].join('\n')
    );
  });

  it('安全特征：javascript: 协议链接不生成 <a>，退化为纯文本段落', () => {
    expect(md.render('[点我](javascript:alert(1))')).toBe('<p>[点我](javascript:alert(1))</p>\n');
  });
});
