import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ResourceFile } from '../types/card.js';
import { inlineFileBackedRichTextContent } from './richtext-inline.js';

const tempDirs: string[] = [];

function createTempMarkdownFile(relativePath: string, content: string): ResourceFile {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccps-richtext-inline-'));
  tempDirs.push(root);
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf-8');

  return {
    relativePath,
    absolutePath,
    size: Buffer.byteLength(content, 'utf-8'),
    filename: path.basename(relativePath),
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('inlineFileBackedRichTextContent', () => {
  it('将 file 模式富文本 markdown 资源内联到 content YAML，并从上传资源列表中移除', () => {
    const markdownFile = createTempMarkdownFile('docs/richtext-demo.md', '# 标题\n\n正文内容');
    const imageFile = createTempMarkdownFile('images/photo.jpg', 'binary-placeholder');
    const contentMap = new Map<string, Record<string, unknown>>([
      [
        'intro',
        {
          card_type: 'base.richtext',
          content_format: 'markdown',
          content_source: 'file',
          content_file: '../docs/richtext-demo.md',
        },
      ],
      [
        'gallery',
        {
          card_type: 'ImageCard',
          images: [{ source: 'file', file_path: 'images/photo.jpg' }],
        },
      ],
    ]);

    const result = inlineFileBackedRichTextContent(contentMap, [markdownFile, imageFile]);

    expect(result.contentMap.get('intro')).toEqual({
      card_type: 'base.richtext',
      content_format: 'markdown',
      content_source: 'inline',
      content_text: '# 标题\n\n正文内容',
    });
    expect(result.uploadResourceFiles).toEqual([imageFile]);
  });

  it('在缺失 markdown 资源时抛出明确错误', () => {
    const contentMap = new Map<string, Record<string, unknown>>([
      [
        'intro',
        {
          card_type: 'RichTextCard',
          content_format: 'markdown',
          content_source: 'file',
          content_file: 'missing.md',
        },
      ],
    ]);

    expect(() => inlineFileBackedRichTextContent(contentMap, [])).toThrow(
      'RichText markdown resource not found: missing.md',
    );
  });
});
