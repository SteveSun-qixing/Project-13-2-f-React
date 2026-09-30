import { describe, expect, it } from 'vitest';
import type { BaseCardView } from '@chips/sdk';
import {
  CARD_TYPE_ID,
  DEFAULT_CONFIG,
  buildContent,
  buildFileOpenRequest,
  deriveDisplayFileName,
  readConfig,
  validateConfig,
} from '../src/config';
import { collectResourcePaths, createInitialContent } from '../src/main';
import {
  deriveFileStem,
  formatExtensionBadge,
  normalizeRelativeCardResourcePath,
  resolveFileExtension,
  resolveFileName,
  sanitizeImportedFileName,
  stripFileExtension,
} from '../src/shared/utils';

describe('shared/utils 路径归一（06 §2.4 + 01 §6.9 口径）', () => {
  it.each([
    ['docs/季度报告.pdf', 'docs/季度报告.pdf'],
    ['./docs/a.pdf', 'docs/a.pdf'],
    ['a/b/c', 'a/b/c'],
  ])('合法相对路径归一保形：%j → %j', (input, expected) => {
    expect(normalizeRelativeCardResourcePath(input)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    [undefined],
    [null],
    [42],
    ['docs\\a.pdf'],
    ['/abs.png'],
    ['http://example.com/a.pdf'],
    ['https://example.com/a.pdf'],
    ['file:///tmp/a.pdf'],
    ['chips-resource://scope/a.pdf'],
    ['a/../b.pdf'],
    ['../escape.pdf'],
    ['./'],
    ['a/./b.pdf'],
    ['docs/a.pdf?v=1'],
    ['docs/a.pdf#page=2'],
  ])('非法引用一律拒绝：%j → undefined', (input) => {
    expect(normalizeRelativeCardResourcePath(input)).toBeUndefined();
  });

  it('文件名与词干派生', () => {
    expect(resolveFileName('docs/季度报告.pdf')).toBe('季度报告.pdf');
    expect(deriveFileStem('docs/季度报告.pdf')).toBe('季度报告');
    expect(resolveFileExtension('docs/季度报告.PDF')).toBe('pdf');
    expect(stripFileExtension('archive.tar.gz')).toBe('archive.tar');
    expect(resolveFileName(undefined)).toBe('');
    expect(deriveFileStem('docs/.pdf')).toBe('');
  });

  it('后缀徽标格式化：大写化并截断到 4 字符', () => {
    expect(formatExtensionBadge('pdf')).toBe('PDF');
    expect(formatExtensionBadge('.docx')).toBe('DOCX');
    expect(formatExtensionBadge('spreadsheet')).toBe('SPRE');
    expect(formatExtensionBadge('')).toBe('');
    expect(formatExtensionBadge('  ')).toBe('');
  });

  it('导入文件名清洗：去路径、去非法字符、空白折叠为连字符，空结果回退', () => {
    expect(sanitizeImportedFileName('a//b.pdf', 'file')).toBe('b.pdf');
    expect(sanitizeImportedFileName('季度 报告?.pdf', 'file')).toBe('季度-报告.pdf');
    expect(sanitizeImportedFileName('???', 'fallback')).toBe('fallback');
    expect(sanitizeImportedFileName('  ', 'fallback')).toBe('fallback');
  });
});

describe('readConfig 归一（08 §7.1 规则 2）', () => {
  it('空输入回退默认配置', () => {
    expect(readConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(readConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(readConfig('str')).toEqual(DEFAULT_CONFIG);
    expect(DEFAULT_CONFIG).toEqual({
      file_file: '',
      file_name: '',
      file_extension: '',
      cover_image: '',
    });
  });

  it('file_name / file_extension 缺失时从 file_file 派生（01 §6.9）', () => {
    expect(readConfig({ file_file: 'docs/季度报告.pdf' })).toEqual({
      file_file: 'docs/季度报告.pdf',
      file_name: '季度报告',
      file_extension: 'pdf',
      cover_image: '',
    });
  });

  it('显式 file_name 保留；显式 file_extension 归一（去点、小写）', () => {
    const config = readConfig({
      file_file: 'docs/季度报告.pdf',
      file_name: '自定义名',
      file_extension: '.PDF',
    });
    expect(config.file_name).toBe('自定义名');
    expect(config.file_extension).toBe('pdf');
  });

  it('非法路径字段回退空串', () => {
    const config = readConfig({
      file_file: '../escape.pdf',
      cover_image: 'http://example.com/x.png',
    });
    expect(config.file_file).toBe('');
    expect(config.cover_image).toBe('');
    expect(config.file_name).toBe('');
    expect(config.file_extension).toBe('');
  });
});

describe('validateConfig（08 §7.3：出现即校验，不宽于 schema）', () => {
  it.each([
    [undefined, true],
    [null, true],
    [{}, true],
    [{ file_file: 'docs/季度报告.pdf' }, true],
    [{ file_file: 'docs/季度报告.pdf', file_name: '季度报告', file_extension: 'pdf', cover_image: 'covers/x.png' }, true],
    [{ cover_image: '' }, true],
    ['str', false],
    [42, false],
    [['a'], false],
    [{ file_file: '/abs.pdf' }, false],
    [{ file_file: '../escape.pdf' }, false],
    [{ file_file: 'docs\\a.pdf' }, false],
    [{ file_file: 'docs/a.pdf?v=1' }, false],
    [{ file_file: 'docs/a.pdf#p2' }, false],
    [{ file_file: 'file:///tmp/a.pdf' }, false],
    [{ cover_image: '/abs.png' }, false],
    [{ file_file: 42 }, false],
    [{ file_name: 42 }, false],
    [{ file_extension: 'PDF' }, false],
    [{ file_extension: '.pdf' }, false],
    [{ file_extension: 42 }, false],
    [{ cover_image: 42 }, false],
  ])('validateConfig(%j) → %j', (input, expected) => {
    expect(validateConfig(input)).toBe(expected);
  });
});

describe('内容组装与展示派生', () => {
  it('buildContent 产出 card_type + config', () => {
    const config = readConfig({ file_file: 'docs/季度报告.pdf' });
    expect(buildContent(config)).toEqual({
      card_type: 'base.file',
      config: { ...config },
    });
  });

  it('createInitialContent 为可通过校验的空配置（08 §2.4.4）', () => {
    const content = createInitialContent();
    expect(content['card_type']).toBe(CARD_TYPE_ID);
    expect(validateConfig(content['config'])).toBe(true);
    expect(readConfig(content['config'])).toEqual(DEFAULT_CONFIG);
  });

  it('deriveDisplayFileName：显式名优先，其次词干，均缺为空串', () => {
    expect(deriveDisplayFileName(readConfig({ file_file: 'docs/a.pdf', file_name: '自定义' }))).toBe('自定义');
    expect(deriveDisplayFileName(readConfig({ file_file: 'docs/a.pdf' }))).toBe('a');
    expect(deriveDisplayFileName(DEFAULT_CONFIG)).toBe('');
  });
});

describe('collectResourcePaths（01 §6.9：file_file 与 cover_image 有效路径去重）', () => {
  function createBasecard(config: Record<string, unknown>): BaseCardView {
    return {
      kind: 'basecard',
      node_id: 'a1B2c3D4e5',
      card_type: 'base.file',
      content: buildContent(readConfig(config)),
      revision: 1,
      card: {
        card_id: 'z9Y8x7W6v5',
        name: '示例卡片',
        chip_standards_version: '1.0.0',
        cover_ratio: '3:2',
        tags: [],
      },
    };
  }

  it('收集文件与封面、去重并稳定排序', () => {
    expect(collectResourcePaths(createBasecard({
      file_file: 'docs/b.pdf',
      cover_image: 'covers/a.png',
    }))).toEqual(['covers/a.png', 'docs/b.pdf']);
  });

  it('同路径去重；空引用与非法引用不进入清单', () => {
    expect(collectResourcePaths(createBasecard({
      file_file: 'docs/a.pdf',
      cover_image: 'docs/a.pdf',
    }))).toEqual(['docs/a.pdf']);
    expect(collectResourcePaths(createBasecard({}))).toEqual([]);
    expect(collectResourcePaths(createBasecard({
      file_file: 'https://example.com/a.pdf',
    }))).toEqual([]);
  });
});

describe('buildFileOpenRequest（14 §2.2 形状；01 §6.9：不传业务载荷）', () => {
  it('引用为空时返回 null', () => {
    expect(buildFileOpenRequest(DEFAULT_CONFIG)).toBeNull();
    expect(buildFileOpenRequest(readConfig({ file_file: '../x' }))).toBeNull();
  });

  it('组装 view 意图打开请求：uri 透传、MIME 按后缀推断、携带文件名与标题、无 payload', () => {
    const request = buildFileOpenRequest(readConfig({
      file_file: 'docs/季度报告.pdf',
      file_name: '季度报告',
      file_extension: 'pdf',
    }));
    expect(request).toEqual({
      intent: 'view',
      resource: {
        uri: 'docs/季度报告.pdf',
        mimeType: 'application/pdf',
        fileName: '季度报告.pdf',
        title: '季度报告',
      },
    });
    expect(request && 'payload' in request.resource).toBe(false);
  });

  it('未登记 MIME 的后缀省略 mimeType 字段', () => {
    const request = buildFileOpenRequest(readConfig({ file_file: 'docs/x.unknownext' }));
    expect(request).not.toBeNull();
    expect(request && 'mimeType' in request.resource).toBe(false);
    expect(request?.resource.fileName).toBe('x.unknownext');
    expect(request?.resource.title).toBe('x');
  });

  it('词干缺失时标题回退未命名文件', () => {
    const request = buildFileOpenRequest(readConfig({ file_file: 'docs/.pdf' }));
    expect(request?.resource.title).toBe('未命名文件');
  });
});
