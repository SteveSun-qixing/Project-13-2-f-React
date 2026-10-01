import { describe, expect, it } from 'vitest';
import {
  CardRewriteError,
  collectFileBackedRichTextResourcePaths,
  restoreCardConfigYaml,
  restoreCoverHtml,
  rewriteCardConfigYaml,
  rewriteCoverHtml,
} from '../src/domain/community/cardRewrite';
import {
  FIXTURE_CONTENT_FILE,
  FIXTURE_CONTENT_FILE_BODY,
  FIXTURE_IMAGE_CONFIG_PATH,
  FIXTURE_IMAGE_CONFIG_YAML,
  FIXTURE_RICHTEXT_CONFIG_PATH,
  FIXTURE_RICHTEXT_CONFIG_YAML,
  FIXTURE_COVER_HTML,
  createFixtureUrlMap,
} from './fixtures/card-archive';

const IMAGE_CONFIG_SOURCE = FIXTURE_IMAGE_CONFIG_PATH;
const RICHTEXT_CONFIG_SOURCE = FIXTURE_RICHTEXT_CONFIG_PATH;

describe('图片卡片 YAML 资源改写与还原（16-传输协议 §4.3/§4.5，真实卡片夹具）', () => {
  const urlMap = createFixtureUrlMap('https://file.example/chips-card-resources/demo');
  const pathMap = new Map<string, string>([...urlMap].map(([path, url]) => [url, path]));

  it('结构化资源字段：source file + file_path 命中映射改写为 source url + url，移除 file_path', () => {
    const rewritten = rewriteCardConfigYaml(FIXTURE_IMAGE_CONFIG_YAML, urlMap, IMAGE_CONFIG_SOURCE, new Map());
    expect(rewritten).toContain('source: url');
    expect(rewritten).toContain('https://file.example/chips-card-resources/demo/resources/images/tokyo-1.jpg');
    expect(rewritten).not.toContain('file_path:');
    // 网络来源图片保持原样（§4.2 外部引用不改写）。
    expect(rewritten).toContain('https://example.com/tokyo-night-2.jpg');
  });

  it('一般字符串值命中映射整体替换并保留后缀（§4.3 第 1 行）', () => {
    const yaml = [
      'card_type: "base.image"',
      'notes_ref: "images/tokyo-1.jpg?version=2#view"',
    ].join('\n');
    const rewritten = rewriteCardConfigYaml(yaml, urlMap, IMAGE_CONFIG_SOURCE, new Map());
    const url = urlMap.get('images/tokyo-1.jpg') ?? '';
    expect(rewritten).toContain(`${url}?version=2#view`);
    expect(rewritten).not.toContain('notes_ref: "images/tokyo-1.jpg');
  });

  it('未命中映射的引用保持不变（§4.3：未命中保持不变）', () => {
    const yaml = 'card_type: "base.image"\nkept: "images/other.jpg"\n';
    expect(rewriteCardConfigYaml(yaml, urlMap, IMAGE_CONFIG_SOURCE, new Map())).toContain('images/other.jpg');
  });

  it('上传改写 → 下载还原往返后恢复原字段语义与资源路径（§4.5 还原规则）', () => {
    const rewritten = rewriteCardConfigYaml(FIXTURE_IMAGE_CONFIG_YAML, urlMap, IMAGE_CONFIG_SOURCE, new Map());
    const restored = restoreCardConfigYaml(rewritten, pathMap, IMAGE_CONFIG_SOURCE, new Map());
    expect(restored).toContain('source: file');
    expect(restored).toContain('file_path: images/tokyo-1.jpg');
    expect(restored).not.toContain('https://file.example');
    // 字段语义不变：标题、布局与网络来源图原样保留。
    expect(restored).toContain('title: 东京塔夜景');
    expect(restored).toContain('https://example.com/tokyo-night-2.jpg');
    expect(restored).toContain('grid_mode: 2x2');
  });

  it('YAML 无法解析时上传侧整体失败（CARD_TRANSFER_UPLOAD_FAILED + reason）', () => {
    try {
      rewriteCardConfigYaml('card_type: [unbalanced', urlMap, IMAGE_CONFIG_SOURCE, new Map());
      throw new Error('应当抛出 CardRewriteError');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CardRewriteError);
      const rewriteError = error as CardRewriteError;
      expect(rewriteError.code).toBe('CARD_TRANSFER_UPLOAD_FAILED');
      expect(rewriteError.reason).toContain(IMAGE_CONFIG_SOURCE);
    }
  });

  it('YAML 无法解析时还原侧整体失败（CARD_TRANSFER_RESTORE_FAILED）', () => {
    try {
      restoreCardConfigYaml('a: b: c: [', pathMap, IMAGE_CONFIG_SOURCE, new Map());
      throw new Error('应当抛出 CardRewriteError');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CardRewriteError);
      expect((error as CardRewriteError).code).toBe('CARD_TRANSFER_RESTORE_FAILED');
    }
  });
});

describe('富文本文件化正文内联与还原（16-传输协议 §4.3 富文本行，真实卡片夹具）', () => {
  const textResourceMap = new Map<string, string>([[FIXTURE_CONTENT_FILE, FIXTURE_CONTENT_FILE_BODY]]);

  it('收集文件化正文候选路径（§4.3：原 .md 仍作为资源对象并登记恢复清单；根相对候选在前）', () => {
    const candidates = collectFileBackedRichTextResourcePaths(FIXTURE_RICHTEXT_CONFIG_YAML, RICHTEXT_CONFIG_SOURCE);
    expect([...candidates]).toEqual(['richtext/f6G7h8I9j0.md', 'content/richtext/f6G7h8I9j0.md']);
    expect(candidates[0]).toBe(FIXTURE_CONTENT_FILE);
  });

  it('非文件化正文或非富文本配置不收集（旧 RichTextCard 别名不再识别，ADR-010 零兼容）', () => {
    expect(
      collectFileBackedRichTextResourcePaths(
        'card_type: "base.richtext"\ncontent_source: "inline"\ncontent_text: "hello"\n',
        RICHTEXT_CONFIG_SOURCE,
      ),
    ).toEqual([]);
    expect(
      collectFileBackedRichTextResourcePaths(
        'card_type: "RichTextCard"\ncontent_source: "file"\ncontent_file: "richtext/a.md"\n',
        RICHTEXT_CONFIG_SOURCE,
      ),
    ).toEqual([]);
    expect(
      collectFileBackedRichTextResourcePaths(
        'card_type: "base.image"\nsource: "file"\nfile_path: "images/tokyo-1.jpg"\n',
        IMAGE_CONFIG_SOURCE,
      ),
    ).toEqual([]);
  });

  it('上传改写：content_source file → inline，content_text 内联原文，移除 content_file', () => {
    const rewritten = rewriteCardConfigYaml(FIXTURE_RICHTEXT_CONFIG_YAML, new Map(), RICHTEXT_CONFIG_SOURCE, textResourceMap);
    expect(rewritten).toContain('content_source: inline');
    expect(rewritten).toContain('content_text:');
    expect(rewritten).toContain('东京旅行日记');
    expect(rewritten).toContain('浅草寺');
    expect(rewritten).not.toContain('content_file:');
  });

  it('下载还原：恢复清单映射命中时 inline → file 并写回 content_file', () => {
    const inlinedYaml = [
      'card_type: "base.richtext"',
      'content_format: "markdown"',
      'content_source: "inline"',
      'content_text: |',
      '  # 东京旅行日记',
      '',
      '  这次东京之旅非常精彩。',
      'locale: "zh-CN"',
      '',
    ].join('\n');
    const contentFileMap = new Map<string, string>([[RICHTEXT_CONFIG_SOURCE, FIXTURE_CONTENT_FILE]]);
    const restored = restoreCardConfigYaml(inlinedYaml, new Map(), RICHTEXT_CONFIG_SOURCE, contentFileMap);
    expect(restored).toContain('content_source: file');
    expect(restored).toContain(`content_file: ${FIXTURE_CONTENT_FILE}`);
    expect(restored).not.toContain('content_text:');
  });

  it('无恢复清单映射的内联正文保持原样（§4.5：未命中不得猜测）', () => {
    const inlinedYaml = 'card_type: "base.richtext"\ncontent_source: "inline"\ncontent_text: "hello"\n';
    const restored = restoreCardConfigYaml(inlinedYaml, new Map(), RICHTEXT_CONFIG_SOURCE, new Map());
    expect(restored).toContain('content_source: inline');
    expect(restored).toContain('content_text: hello');
  });
});

describe('cover.html 资源改写与还原（16-传输协议 §4.3 cover.html 行，真实卡片夹具）', () => {
  const urlMap = createFixtureUrlMap('https://file.example/chips-card-resources/demo');
  const pathMap = new Map<string, string>([...urlMap].map(([path, url]) => [url, path]));
  const coverUrl = urlMap.get('.card/cardcover/cover-image.png') ?? '';

  it('属性值与 CSS url 内的包内引用替换为对象 URL，保留引号与外部引用', () => {
    const rewritten = rewriteCoverHtml(FIXTURE_COVER_HTML, urlMap);
    expect(rewritten).toContain(`src="${coverUrl}"`);
    expect(rewritten).toContain(`url("${coverUrl}")`);
    // 外部引用不改写；其余 HTML 字节不改。
    expect(rewritten).toContain('https://cdn.example.com/remote-banner.png');
    expect(rewritten).toContain('<h1>东京旅行日记</h1>');
    expect(rewritten).not.toContain('./cardcover/cover-image.png');
  });

  it('改写 → 还原往返后恢复为恢复清单登记的规范化原始路径（§4.5 第 6 步）', () => {
    const rewritten = rewriteCoverHtml(FIXTURE_COVER_HTML, urlMap);
    const restored = restoreCoverHtml(rewritten, pathMap);
    // 还原目标取恢复清单 resources[].originalRelativePath（规范化形态，无 `./` 前缀）。
    expect(restored).toContain('src=".card/cardcover/cover-image.png"');
    expect(restored).toContain('url(".card/cardcover/cover-image.png")');
    expect(restored).not.toContain('https://file.example');
    expect(restored).toContain('https://cdn.example.com/remote-banner.png');
  });

  it('未命中映射的引用原样保留（§4.5：还原只接受映射，不得猜测）', () => {
    const html = '<img src="./cardcover/other.png" alt="" />';
    expect(restoreCoverHtml(html, pathMap)).toBe(html);
  });
});
