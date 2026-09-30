/**
 * XSS 安全臂：恶意输入逐条断言转义与协议白名单行为（工单057 安全红线）。
 * 服务不存在任何「放行裸 HTML」的选项面；以下用例全部在缺省与开启选项两种形态下验证。
 */

import { describe, expect, it } from 'vitest';
import { createMarkdownService } from '../src/service.js';

const service = createMarkdownService();

async function assertSanitizedEverywhere(markdown: string): Promise<string> {
  const viaHtml = (await service.renderHtml({ markdown })).html;
  const viaLinkify = (await service.renderHtml({ markdown, options: { linkify: true } })).html;
  for (const html of [viaHtml, viaLinkify]) {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror\s*=/i);
    expect(html).not.toMatch(/onclick\s*=/i);
    expect(html).not.toMatch(/<iframe/i);
    expect(html).not.toMatch(/<object/i);
    expect(html).not.toMatch(/javascript:/i);
  }
  return viaHtml;
}

describe('renderHtml：原始 HTML 注入面（转义收口）', () => {
  it('script 标签按文本转义，不进入输出 DOM 语义', async () => {
    const html = await assertSanitizedEverywhere('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('script 标签藏在段落中同样转义', async () => {
    const html = await assertSanitizedEverywhere('正文<script>alert(1)</script>结尾');
    expect(html).toContain('&lt;script&gt;');
  });

  it('img onerror 属性注入被转义', async () => {
    const html = await assertSanitizedEverywhere('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img');
    expect(html).not.toMatch(/<img/);
  });

  it('iframe / object / embed / video 注入面被转义', async () => {
    await assertSanitizedEverywhere('<iframe src="https://evil.example.com"></iframe>');
    await assertSanitizedEverywhere('<object data="data:text/html,<script>alert(1)</script>"></object>');
    await assertSanitizedEverywhere('<embed src="https://evil.example.com/x.swf">');
    await assertSanitizedEverywhere('<video><source onerror="alert(1)"></video>');
  });

  it('HTML 注释与处理指令被转义', async () => {
    const html = await assertSanitizedEverywhere('<!-- 注释 <script>alert(1)</script> -->');
    expect(html).toContain('&lt;!--');
  });

  it('代码块内的 HTML 同样按文本出料', async () => {
    const html = await assertSanitizedEverywhere('```\n<script>alert(1)</script>\n```');
    expect(html).toContain('&lt;script&gt;');
  });

  it('块级 HTML 行（html_block 面）按转义段落出料', async () => {
    const html = await assertSanitizedEverywhere('<div onclick="alert(1)">块级注入</div>');
    expect(html).toContain('&lt;div');
  });
});

describe('renderHtml：链接与图片协议白名单', () => {
  it('javascript: 链接目标被拒收，href 清空', async () => {
    const { html } = await service.renderHtml({ markdown: '[点我](javascript:alert(1))' });
    expect(html).toContain('<a href="">点我</a>');
    expect(html).not.toContain('javascript:');
  });

  it('大小写与实体编码变体同样被拒收', async () => {
    const { html } = await service.renderHtml({ markdown: '[a](JaVaScRiPt:alert(1))' });
    expect(html).not.toContain('alert(1)"');
    expect(html).not.toMatch(/href="javascript/i);
    const encoded = await service.renderHtml({
      markdown: '[a](&#106;avascript:alert(1))',
    });
    expect(encoded.html).not.toMatch(/javascript:/i);
  });

  it('vbscript: 与 file: 目标被拒收', async () => {
    const { html } = await service.renderHtml({ markdown: '[v](vbscript:msgbox)' });
    expect(html).not.toContain('vbscript:');
    const fileLink = await service.renderHtml({ markdown: '[f](file:///etc/passwd)' });
    expect(fileLink.html).not.toContain('file://');
  });

  it('非图片 data: 目标被拒收；图片 data:image 允许', async () => {
    const bad = await service.renderHtml({ markdown: '[d](data:text/html;base64,PHNjcmlwdD4=)' });
    expect(bad.html).not.toContain('data:text/html');
    const good = await service.renderHtml({
      markdown: '![p](data:image/png;base64,iVBORw0KGgo=)',
    });
    expect(good.html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
  });

  it('autolink 记号同样经白名单：尖括号 javascript 伪协议不出料', async () => {
    const { html } = await service.renderHtml({ markdown: '<javascript:alert(1)>' });
    expect(html).not.toMatch(/<a href="javascript:/i);
  });

  it('图片标题注入不产生属性逃逸', async () => {
    const { html } = await service.renderHtml({
      markdown: '![x](https://chips.example.com/a.png "onerror=alert(1)")',
    });
    expect(html).not.toMatch(/onerror=/);
    expect(html).toContain('alt="x"');
  });
});

describe('renderHtml：linkify 开启下的安全形态', () => {
  it('linkify 不会把伪协议文本变成可执行链接', async () => {
    const html = (
      await service.renderHtml({ markdown: 'javascript:alert(1)', options: { linkify: true } })
    ).html;
    expect(html).not.toMatch(/<a href="javascript:/i);
  });
});
