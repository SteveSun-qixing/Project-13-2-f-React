/**
 * renderHtml 常规渲染断言：标题 / 列表 / 代码块 / 表格 / 链接 / 内联样式 / 引用 / 分隔线。
 * 全部断言落在真实解析输出上，不 mock 解析内核。
 */

import { describe, expect, it } from 'vitest';
import { createMarkdownService } from '../src/service.js';
import { DEFAULT_ENGINE_OPTIONS } from '../src/engine.js';

const service = createMarkdownService();

describe('renderHtml：块级结构', () => {
  it('渲染各层级标题', async () => {
    const { html } = await service.renderHtml({
      markdown: '# 一级\n## 二级\n### 三级\n#### 四级\n##### 五级\n###### 六级',
    });
    expect(html).toContain('<h1>一级</h1>');
    expect(html).toContain('<h2>二级</h2>');
    expect(html).toContain('<h3>三级</h3>');
    expect(html).toContain('<h4>四级</h4>');
    expect(html).toContain('<h5>五级</h5>');
    expect(html).toContain('<h6>六级</h6>');
  });

  it('渲染无序与有序列表', async () => {
    const { html } = await service.renderHtml({ markdown: '- 甲\n- 乙\n\n1. 一\n2. 二' });
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>甲</li>');
    expect(html).toContain('<li>乙</li>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>一</li>');
    expect(html).toContain('<li>二</li>');
  });

  it('有序列表起始编号写入 start 属性', async () => {
    const { html } = await service.renderHtml({ markdown: '3. 三\n4. 四' });
    expect(html).toContain('<ol start="3">');
  });

  it('渲染围栏代码块并带语言类名，代码内容按原文转义', async () => {
    const { html } = await service.renderHtml({
      markdown: '```ts\nconst a: number = 1;\n<div>"未执行"</div>\n```',
    });
    expect(html).toContain('<pre><code class="language-ts">');
    expect(html).toContain('const a: number = 1;');
    expect(html).toContain('&lt;div&gt;');
  });

  it('渲染缩进代码块（无语言）', async () => {
    const { html } = await service.renderHtml({ markdown: '    indented code' });
    expect(html).toContain('<pre><code>indented code');
  });

  it('渲染引用块', async () => {
    const { html } = await service.renderHtml({ markdown: '> 引用一行\n> 继续一行' });
    expect(html).toContain('<blockquote>');
    expect(html).toContain('引用一行');
  });

  it('渲染水平分隔线', async () => {
    const { html } = await service.renderHtml({ markdown: '上方\n\n---\n\n下方' });
    expect(html).toContain('<hr>');
  });

  it('渲染 GFM 表格并对齐列', async () => {
    const { html } = await service.renderHtml({
      markdown: '| 左 | 中 | 右 |\n|:---|:---:|---:|\n| a | b | c |',
    });
    expect(html).toContain('<table>');
    expect(html).toContain('<th style="text-align:left">左</th>');
    expect(html).toContain('<th style="text-align:center">中</th>');
    expect(html).toContain('<th style="text-align:right">右</th>');
    expect(html).toContain('<td>a</td>');
    expect(html).toContain('<td>c</td>');
  });
});

describe('renderHtml：内联样式与链接', () => {
  it('渲染加粗、斜体、行内代码、删除线', async () => {
    const { html } = await service.renderHtml({ markdown: '**粗** *斜* `码` ~~删~~' });
    expect(html).toContain('<strong>粗</strong>');
    expect(html).toContain('<em>斜</em>');
    expect(html).toContain('<code>码</code>');
    expect(html).toContain('<s>删</s>');
  });

  it('渲染链接与图片（http 协议白名单内）', async () => {
    const { html } = await service.renderHtml({
      markdown: '[薯片](https://chips.example.com) ![图](https://chips.example.com/a.png)',
    });
    expect(html).toContain('<a href="https://chips.example.com">薯片</a>');
    expect(html).toContain('<img src="https://chips.example.com/a.png" alt="图">');
  });

  it('硬换行：缺省不把单换行渲染为 <br>', async () => {
    const { html } = await service.renderHtml({ markdown: '第一行\n第二行' });
    expect(html).toContain('<p>第一行\n第二行</p>');
    expect(html).not.toContain('<br');
  });

  it('breaks 选项开启时单换行渲染为 <br>', async () => {
    const { html } = await service.renderHtml({
      markdown: '第一行\n第二行',
      options: { breaks: true },
    });
    expect(html).toContain('第一行<br>\n第二行');
  });

  it('linkify 选项开启时自动识别链接文本', async () => {
    const { html } = await service.renderHtml({
      markdown: '访问 https://example.com/docs 了解更多',
      options: { linkify: true },
    });
    expect(html).toContain('<a href="https://example.com/docs">');
  });

  it('链接缺省不开 linkify：类链接文本保持纯文本', async () => {
    const { html } = await service.renderHtml({ markdown: '访问 https://example.com/docs 了解更多' });
    expect(html).not.toContain('<a ');
  });

  it('HTML 实体与字符引用按 CommonMark 规则出料', async () => {
    const { html } = await service.renderHtml({ markdown: 'a &amp; b &lt; c & 3 &lt;= 4' });
    expect(html).toContain('<p>a &amp; b &lt; c &amp; 3 &lt;= 4</p>');
  });
});

describe('renderHtml：选项面', () => {
  it('缺省选项为全关（DEFAULT_ENGINE_OPTIONS 与服务缺省行为一致）', async () => {
    const baseline = await service.renderHtml({ markdown: 'a\nb' });
    const explicit = await service.renderHtml({ markdown: 'a\nb', options: { ...DEFAULT_ENGINE_OPTIONS } });
    expect(baseline.html).toBe(explicit.html);
  });

  it('同一输入同选项重复渲染结果确定', async () => {
    const markdown = '# 稳定\n\n- a\n- b\n\n```js\nx()\n```';
    const first = await service.renderHtml({ markdown });
    const second = await service.renderHtml({ markdown });
    expect(first.html).toBe(second.html);
  });
});
