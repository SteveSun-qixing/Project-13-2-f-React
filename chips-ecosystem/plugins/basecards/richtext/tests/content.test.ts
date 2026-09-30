import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RICHTEXT_MARKDOWN,
  MARKDOWN_CONTENT_FORMAT,
  MAX_INLINE_RICHTEXT_LENGTH,
  collectInlineResourcePaths,
  countPlainTextLengthFromMarkdown,
  extractPlainTextFromMarkdown,
  hasMeaningfulMarkdownContent,
  normalizeContentFilePath,
  normalizeMarkdown,
  shouldUseFileStorage,
} from '../src/markdown/content';
import { RICHTEXT_CARD_TYPE } from '../src/markdown/resource-links';

/** 旧 shared/utils.ts 纯逻辑迁移面：常量、归一、提取、存储闸与资源收集。 */
describe('markdown/content 常量', () => {
  it('长度闸为 200、内容格式为 markdown、卡片类型为 base.richtext', () => {
    expect(MAX_INLINE_RICHTEXT_LENGTH).toBe(200);
    expect(MARKDOWN_CONTENT_FORMAT).toBe('markdown');
    expect(RICHTEXT_CARD_TYPE).toBe('base.richtext');
  });

  it('不携带 legacy 兼容面（零兼容裁决：无 RichTextCard 别名导出）', async () => {
    const contentModule = await import('../src/markdown/content');
    const linksModule = await import('../src/markdown/resource-links');
    for (const exported of Object.keys(contentModule).concat(Object.keys(linksModule))) {
      expect(exported.toUpperCase()).not.toContain('LEGACY');
    }
    expect(DEFAULT_RICHTEXT_MARKDOWN.length).toBeGreaterThan(0);
  });
});

describe('normalizeMarkdown', () => {
  it('收敛换行符、行尾空白与多余空行', () => {
    expect(normalizeMarkdown('第一行\r\n第二行  \n\n\n\n# 标题')).toBe('第一行\n第二行\n\n# 标题');
  });

  it('把不间断空格归一为普通空格', () => {
    expect(normalizeMarkdown('薯片\u00a0生态')).toBe('薯片 生态');
  });
});

describe('extractPlainTextFromMarkdown 与存储闸', () => {
  it('剥除标题、强调、链接、代码与扩展语法标记', () => {
    const markdown = '# 标题\n\n**粗体**与[链接](https://example.com)与`代码`。\n\n==高亮== ++下划线++ ^上标^ ~下标~';
    expect(extractPlainTextFromMarkdown(markdown)).toBe(
      '标题 粗体与链接与代码。 高亮 下划线 上标 下标'
    );
  });

  it('剥除数学定界符并保留公式原文', () => {
    expect(extractPlainTextFromMarkdown('质能方程 $E=mc^2$ 与块级：\n\n$$a+b$$')).toContain('E=mc^2');
    expect(extractPlainTextFromMarkdown('$$a+b$$')).toContain('a+b');
  });

  it('200 字存储闸：恰好 200 字不文件化、201 字文件化', () => {
    const text200 = '字'.repeat(200);
    const text201 = '字'.repeat(201);
    expect(shouldUseFileStorage(countPlainTextLengthFromMarkdown(text200))).toBe(false);
    expect(shouldUseFileStorage(countPlainTextLengthFromMarkdown(text201))).toBe(true);
  });

  it('按 Unicode 码点计数（surrogate 对计 1）', () => {
    expect(countPlainTextLengthFromMarkdown('薯片𝄞')).toBe(3);
  });
});

describe('hasMeaningfulMarkdownContent', () => {
  it('空与纯空白为无语义', () => {
    expect(hasMeaningfulMarkdownContent('')).toBe(false);
    expect(hasMeaningfulMarkdownContent('   \n\n  ')).toBe(false);
  });

  it('只含水平分隔线也算有语义', () => {
    expect(hasMeaningfulMarkdownContent('---')).toBe(true);
  });
});

describe('collectInlineResourcePaths', () => {
  it('收集链接与图片相对引用，去重并稳定排序，拒绝协议与绝对路径', () => {
    const markdown = [
      '![封面](assets/b.png)',
      '[说明](assets/a.md "标题")',
      '[外部](https://example.com/x.png)',
      '[绝对](/etc/passwd)',
      '<img src="assets/c.png">',
    ].join('\n');
    expect(collectInlineResourcePaths(markdown)).toEqual(['assets/a.md', 'assets/b.png', 'assets/c.png']);
  });

  it('拒绝含 ..、查询串与锚点的引用', () => {
    expect(collectInlineResourcePaths('[逃逸](../x.png)')).toEqual([]);
    expect(collectInlineResourcePaths('[查询](assets/a.png?size=1)')).toEqual([]);
  });
});

describe('normalizeContentFilePath', () => {
  it('接受卡片根目录相对 .md 路径并归一', () => {
    expect(normalizeContentFilePath('richtext/a1B2c3D4e5.md')).toBe('richtext/a1B2c3D4e5.md');
  });

  it('拒绝绝对路径、非 .md 与越界引用', () => {
    expect(normalizeContentFilePath('/etc/note.md')).toBe('');
    expect(normalizeContentFilePath('https://example.com/note.md')).toBe('');
    expect(normalizeContentFilePath('richtext/note.txt')).toBe('');
    expect(normalizeContentFilePath('../note.md')).toBe('');
  });
});
