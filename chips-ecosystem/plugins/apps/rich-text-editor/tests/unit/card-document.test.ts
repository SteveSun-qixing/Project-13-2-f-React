import { describe, expect, it } from 'vitest';
import yaml from 'yaml';

import {
  CardStructureValidationError,
  assertCompositeRichTextCardFiles,
  buildCompositeRichTextCardFiles,
  collectCompositeRichTextResourcePaths,
  createDefaultCoverHtml,
  createEmptyRichTextCardDocument,
  parseCompositeRichTextCard,
  validateCompositeRichTextCardFiles,
} from '../../src/domain/card/card-document';
import type { RichTextCompositeCardDocument } from '../../src/domain/card/card-document';
import {
  FIXTURE_CARD_ID,
  FIXTURE_CONTENT_FILE,
  FIXTURE_NODE_ID,
  FIXTURE_SECOND_NODE_ID,
  VALID_COMPOSITE_CARD_FILES,
  VALID_COVER_HTML,
} from '../fixtures/composite-card';

/** 在合法夹具上做定点变异，构造各校验分支的输入。 */
function mutateFiles(patch: {
  metadataYaml?: string;
  structureYaml?: string;
  contentYaml?: string;
  coverHtml?: string;
}): { metadataYaml: string; structureYaml: string; contentYaml: string; coverHtml: string } {
  return { ...VALID_COMPOSITE_CARD_FILES, ...patch };
}

function validateCodes(patch: Parameters<typeof mutateFiles>[0]): string[] {
  return validateCompositeRichTextCardFiles(mutateFiles(patch)).issues.map((issue) => issue.code);
}

function buildDocument(): RichTextCompositeCardDocument {
  return createEmptyRichTextCardDocument(FIXTURE_CARD_ID, FIXTURE_NODE_ID, '东京旅行日记');
}

describe('固定复合卡片文档模型（01-卡片文件格式）', () => {
  it('新建模型不含 ID 生成：标识由调用方按正式链路传入', () => {
    const document = buildDocument();
    expect(document.cardId).toBe(FIXTURE_CARD_ID);
    expect(document.baseCardId).toBe(FIXTURE_NODE_ID);
    expect(document.title).toBe('东京旅行日记');
    expect(document.coverRatio).toBe('3:4');
    expect(document.createdAt).toBe(document.modifiedAt);
    expect(document.config.content_source).toBe('inline');
    expect(document.config.content_text).toBe('# 东京旅行日记\n\n');
  });

  it('构建并回读单富文本基础卡片复合卡片（旧 card-document.test 随迁）', () => {
    const document = buildDocument();
    const files = buildCompositeRichTextCardFiles(document, []);

    const parsed = parseCompositeRichTextCard({
      metadataYaml: files.metadataYaml,
      structureYaml: files.structureYaml,
      contentYaml: files.contentYaml,
    });

    expect(parsed.cardId).toBe(FIXTURE_CARD_ID);
    expect(parsed.baseCardId).toBe(FIXTURE_NODE_ID);
    expect(parsed.title).toBe('东京旅行日记');
    expect(parsed.config.card_type).toBe('base.richtext');
    expect(parsed.config.content_source).toBe('inline');
    expect(parsed.config.markdown_capabilities).toMatchObject({
      commonmark: true,
      gfm: true,
      math: true,
      highlight: true,
      underline: true,
      superscript: true,
      subscript: true,
    });
    expect(validateCompositeRichTextCardFiles(files).valid).toBe(true);
  });

  it('G-5 对照：构建产物只含文档库在册字段（无 description、节点仅 id/type）', () => {
    const files = buildCompositeRichTextCardFiles(buildDocument(), []);
    const metadata = yaml.parse(files.metadataYaml) as Record<string, unknown>;
    const structure = yaml.parse(files.structureYaml) as {
      structure?: Array<Record<string, unknown>>;
      manifest?: Record<string, unknown>;
    };

    expect('description' in metadata).toBe(false);
    expect(metadata.theme).toBe('');
    expect(metadata.tags).toEqual([]);
    expect(metadata.cover_ratio).toBe('3:4');
    expect(Object.keys(structure.structure?.[0] ?? {}).sort()).toEqual(['id', 'type']);
    expect(structure.manifest).toMatchObject({ card_count: 1, resource_count: 0 });
    expect(structure.manifest?.resources).toEqual([]);
  });

  it('默认封面逐字对齐《01-卡片文件格式》§7.6，并对名称做 HTML 转义', () => {
    expect(createDefaultCoverHtml('东京旅行日记')).toBe(VALID_COVER_HTML);
    expect(createDefaultCoverHtml('<img> & "引用"')).toContain(
      '&lt;img&gt; &amp; &quot;引用&quot;'
    );
    expect(createDefaultCoverHtml("<script>'x'</script>")).not.toContain('<script>');
  });

  it('在 structure manifest 中写入真实资源清单（旧 card-document.test 随迁）', () => {
    const document = buildDocument();
    document.config = {
      card_type: 'base.richtext',
      theme: '',
      locale: 'zh-CN',
      content_format: 'markdown',
      content_source: 'file',
      content_file: 'richtext-demo.md',
      markdown_capabilities: {
        commonmark: true,
        gfm: true,
        math: true,
        highlight: true,
        underline: true,
        superscript: true,
        subscript: true,
      },
    };

    const files = buildCompositeRichTextCardFiles(document, [
      { path: 'richtext-demo.md', size: 128, type: 'text/markdown' },
    ]);
    const structure = yaml.parse(files.structureYaml) as {
      manifest?: {
        card_count?: number;
        resource_count?: number;
        resources?: Array<{ path?: string; type?: string; size?: number }>;
      };
    };

    expect(structure.manifest?.card_count).toBe(1);
    expect(structure.manifest?.resource_count).toBe(1);
    expect(structure.manifest?.resources?.[0]).toMatchObject({
      path: 'richtext-demo.md',
      type: 'text/markdown',
      size: 128,
    });
    expect(validateCompositeRichTextCardFiles(files).valid).toBe(true);
  });

  it('文档资源引用收集委托配置模型', () => {
    const document = buildDocument();
    expect(collectCompositeRichTextResourcePaths(document)).toEqual([]);
    document.config = {
      ...document.config,
      content_source: 'file',
      content_text: undefined,
      content_file: FIXTURE_CONTENT_FILE,
    };
    expect(collectCompositeRichTextResourcePaths(document)).toEqual([FIXTURE_CONTENT_FILE]);
  });

  describe('解析面', () => {
    it('解析文档库权威夹具（文件模式）', () => {
      const parsed = parseCompositeRichTextCard({
        metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml,
        structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml,
        contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml,
      });
      expect(parsed.cardId).toBe(FIXTURE_CARD_ID);
      expect(parsed.baseCardId).toBe(FIXTURE_NODE_ID);
      expect(parsed.coverRatio).toBe('3:4');
      expect(parsed.config.content_source).toBe('file');
      expect(parsed.config.content_file).toBe(FIXTURE_CONTENT_FILE);
    });

    it('metadata 缺 cover_ratio 时按文档默认 3:4 读取', () => {
      const metadata = VALID_COMPOSITE_CARD_FILES.metadataYaml.replace('cover_ratio: "3:4"\n', '');
      const parsed = parseCompositeRichTextCard({
        metadataYaml: metadata,
        structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml,
        contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml,
      });
      expect(parsed.coverRatio).toBe('3:4');
    });

    it('拒绝多节点复合卡片', () => {
      const structureYaml = [
        'structure:',
        `  - id: "${FIXTURE_NODE_ID}"`,
        '    type: "base.richtext"',
        `  - id: "${FIXTURE_SECOND_NODE_ID}"`,
        '    type: "base.richtext"',
        'manifest:',
        '  card_count: 2',
        '  resource_count: 0',
        '',
      ].join('\n');
      expect(() =>
        parseCompositeRichTextCard({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml,
          structureYaml,
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml,
        })
      ).toThrow('只能编辑单富文本基础卡片的复合卡片');
    });

    it('拒绝非富文本节点类型', () => {
      const structureYaml = VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
        'type: "base.richtext"',
        'type: "base.video"'
      );
      expect(() =>
        parseCompositeRichTextCard({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml,
          structureYaml,
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml,
        })
      ).toThrow('目标卡片不包含富文本基础卡片');
    });

    it('拒绝 LEGACY 节点类型 RichTextCard（零兼容，不读取归一）', () => {
      const structureYaml = VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
        'type: "base.richtext"',
        'type: "RichTextCard"'
      );
      expect(() =>
        parseCompositeRichTextCard({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml,
          structureYaml,
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml,
        })
      ).toThrow('目标卡片不包含富文本基础卡片');
    });

    it('拒绝 metadata 必填字段缺失', () => {
      const metadataYaml = VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
        'card_id: "a1B2c3D4e5"\n',
        ''
      );
      expect(() =>
        parseCompositeRichTextCard({
          metadataYaml,
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml,
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml,
        })
      ).toThrow('复合卡片元数据不完整');
    });
  });

  describe('校验闸：YAML 形态分支', () => {
    it('非对象 YAML 报 CARD_YAML_NOT_OBJECT', () => {
      expect(validateCodes({ metadataYaml: '- a\n- b\n' })).toContain('CARD_YAML_NOT_OBJECT');
      expect(validateCodes({ structureYaml: 'just a string\n' })).toContain('CARD_YAML_NOT_OBJECT');
      expect(validateCodes({ contentYaml: '42\n' })).toContain('CARD_YAML_NOT_OBJECT');
    });

    it('YAML 语法错误报 CARD_YAML_PARSE_FAILED', () => {
      expect(validateCodes({ metadataYaml: 'a: [unclosed\n' })).toContain('CARD_YAML_PARSE_FAILED');
    });
  });

  describe('校验闸：metadata 分支（01 §4）', () => {
    it('版本号必须严格三段式', () => {
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            'chip_standards_version: "1.0.0"',
            'chip_standards_version: "1.0"'
          ),
        })
      ).toContain('CARD_METADATA_VERSION_INVALID');
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            'chip_standards_version: "1.0.0"\n',
            ''
          ),
        })
      ).toContain('CARD_METADATA_VERSION_INVALID');
    });

    it('card_id 必须十位 Base62', () => {
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(FIXTURE_CARD_ID, 'short'),
        })
      ).toContain('CARD_METADATA_ID_INVALID');
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            FIXTURE_CARD_ID,
            'a1B2c3D4e!'
          ),
        })
      ).toContain('CARD_METADATA_ID_INVALID');
    });

    it('name 必须非空且不超过 500 字符', () => {
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            'name: "东京旅行日记"',
            'name: ""'
          ),
        })
      ).toContain('CARD_METADATA_NAME_INVALID');
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            'name: "东京旅行日记"',
            'name: 42'
          ),
        })
      ).toContain('CARD_METADATA_NAME_INVALID');
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            'name: "东京旅行日记"',
            `name: "${'长'.repeat(501)}"`
          ),
        })
      ).toContain('CARD_METADATA_NAME_INVALID');
    });

    it('created_at / modified_at 必须为 ISO 8601 UTC 时间戳', () => {
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            'created_at: "2026-01-15T08:00:00.000Z"',
            'created_at: "2026-01-15 08:00:00"'
          ),
        })
      ).toContain('CARD_METADATA_CREATED_AT_INVALID');
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            'created_at: "2026-01-15T08:00:00.000Z"',
            'created_at: "2026-01-15T08:00:00+08:00"'
          ),
        })
      ).toContain('CARD_METADATA_CREATED_AT_INVALID');
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            'modified_at: "2026-01-30T10:30:00.000Z"',
            'modified_at: ""'
          ),
        })
      ).toContain('CARD_METADATA_MODIFIED_AT_INVALID');
    });

    it('cover_ratio 必须为宽:高正数比值字符串', () => {
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            'cover_ratio: "3:4"',
            'cover_ratio: "3/4"'
          ),
        })
      ).toContain('CARD_METADATA_COVER_RATIO_INVALID');
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            'cover_ratio: "3:4"',
            'cover_ratio: "3:"'
          ),
        })
      ).toContain('CARD_METADATA_COVER_RATIO_INVALID');
    });

    it('tags 存在时必须为数组', () => {
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace('tags: []', 'tags: "旅行"'),
        })
      ).toContain('CARD_METADATA_TAGS_INVALID');
    });

    it('modified_at 不得早于 created_at（01 §4.3）', () => {
      expect(
        validateCodes({
          metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
            'modified_at: "2026-01-30T10:30:00.000Z"',
            'modified_at: "2026-01-01T00:00:00.000Z"'
          ),
        })
      ).toContain('CARD_METADATA_MODIFIED_BEFORE_CREATED');
      expect(
        validateCompositeRichTextCardFiles(
          mutateFiles({
            metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml.replace(
              'modified_at: "2026-01-30T10:30:00.000Z"',
              'modified_at: "2026-01-15T08:00:00.000Z"'
            ),
          })
        ).issues
      ).not.toContainEqual(
        expect.objectContaining({ code: 'CARD_METADATA_MODIFIED_BEFORE_CREATED' })
      );
    });
  });

  describe('校验闸：structure 分支（01 §5）', () => {
    it('必须恰有一个基础卡片节点', () => {
      const emptyStructure = [
        'structure: []',
        'manifest:',
        '  card_count: 0',
        '  resource_count: 1',
        `  resources:`,
        `    - path: "${FIXTURE_CONTENT_FILE}"`,
        '      size: 168',
        '      type: "text/markdown"',
        '',
      ].join('\n');
      const codes = validateCodes({ structureYaml: emptyStructure });
      expect(codes).toContain('CARD_STRUCTURE_NODE_COUNT_INVALID');
      expect(codes).toContain('CARD_MANIFEST_CARD_COUNT_INVALID');
    });

    it('节点 id 必须十位 Base62', () => {
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
            FIXTURE_NODE_ID,
            '节点编号'
          ),
        })
      ).toContain('CARD_STRUCTURE_BASE_ID_INVALID');
    });

    it('节点标识不得重复（含大小写等价形态，05-ID生成规范 §二.6）', () => {
      const structureYaml = [
        'structure:',
        `  - id: "${FIXTURE_NODE_ID}"`,
        '    type: "base.richtext"',
        `  - id: "${FIXTURE_SECOND_NODE_ID}"`,
        '    type: "base.richtext"',
        `  - id: "${FIXTURE_SECOND_NODE_ID.toUpperCase()}"`,
        '    type: "base.richtext"',
        'manifest:',
        '  card_count: 3',
        '  resource_count: 0',
        '',
      ].join('\n');
      expect(validateCodes({ structureYaml })).toContain('CARD_STRUCTURE_NODE_ID_DUPLICATED');
    });

    it('节点类型必须为正式 base.richtext', () => {
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
            'type: "base.richtext"',
            'type: "base.video"'
          ),
        })
      ).toContain('CARD_STRUCTURE_NODE_TYPE_INVALID');
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
            'type: "base.richtext"',
            'type: "RichTextCard"'
          ),
        })
      ).toContain('CARD_STRUCTURE_NODE_TYPE_INVALID');
    });

    it('content 的 card_type 必须与节点类型一致', () => {
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace(
            'card_type: "base.richtext"',
            'card_type: "base.video"'
          ),
        })
      ).toContain('CARD_CONTENT_TYPE_MISMATCH');
    });
  });

  describe('校验闸：content 分支（01 §6.6）', () => {
    it('card_type 必须为正式 base.richtext，LEGACY 别名不作为合法值', () => {
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace(
            'card_type: "base.richtext"',
            'card_type: "RichTextCard"'
          ),
        })
      ).toContain('RICHTEXT_CARD_TYPE_INVALID');
    });

    it('content_format 必须为 markdown', () => {
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace(
            'content_format: "markdown"',
            'content_format: "html"'
          ),
        })
      ).toContain('RICHTEXT_FORMAT_INVALID');
    });

    it('content_source 必须为 inline 或 file', () => {
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace(
            'content_source: "file"',
            'content_source: "both"'
          ),
        })
      ).toContain('RICHTEXT_SOURCE_INVALID');
    });

    it('inline 模式必须携带 content_text 且禁止 content_file', () => {
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml
            .replace('content_source: "file"', 'content_source: "inline"')
            .replace('content_file: "richtext/f6G7h8I9j0.md"\n', ''),
        })
      ).toContain('RICHTEXT_INLINE_TEXT_MISSING');
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace(
            'content_source: "file"',
            'content_source: "inline"'
          ),
        })
      ).toContain('RICHTEXT_INLINE_FILE_FORBIDDEN');
    });

    it('file 模式 content_file 必须为卡片根相对 .md 路径', () => {
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace(
            FIXTURE_CONTENT_FILE,
            '/Users/demo/body.md'
          ),
        })
      ).toContain('RICHTEXT_FILE_PATH_INVALID');
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace(
            FIXTURE_CONTENT_FILE,
            'richtext/body.txt'
          ),
        })
      ).toContain('RICHTEXT_FILE_PATH_INVALID');
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace(
            FIXTURE_CONTENT_FILE,
            '.card/body.md'
          ),
        })
      ).toContain('RICHTEXT_FILE_PATH_INVALID');
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace(
            FIXTURE_CONTENT_FILE,
            'content/body.md'
          ),
        })
      ).toContain('RICHTEXT_FILE_PATH_INVALID');
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace(
            FIXTURE_CONTENT_FILE,
            '../escape.md'
          ),
        })
      ).toContain('RICHTEXT_FILE_PATH_INVALID');
    });

    it('file 模式禁止同时保存非空 content_text', () => {
      expect(
        validateCodes({
          contentYaml: `${VALID_COMPOSITE_CARD_FILES.contentYaml}content_text: |-\n  不应共存\n`,
        })
      ).toContain('RICHTEXT_FILE_TEXT_FORBIDDEN');
    });

    it('markdown_capabilities 七项必须逐项显式布尔', () => {
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace('  math: true\n', ''),
        })
      ).toContain('RICHTEXT_CAPABILITY_INVALID');
      expect(
        validateCodes({
          contentYaml: VALID_COMPOSITE_CARD_FILES.contentYaml.replace(
            '  gfm: true',
            '  gfm: "true"'
          ),
        })
      ).toContain('RICHTEXT_CAPABILITY_INVALID');
    });

    it('旧字段别名 markdown 不参与合法性与清单对照（零兼容：既不消费也不报错）', () => {
      const contentYaml = `${VALID_COMPOSITE_CARD_FILES.contentYaml}markdown: "# 旧别名"\n`;
      expect(validateCodes({ contentYaml })).toEqual([]);
      const parsed = parseCompositeRichTextCard({
        metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml,
        structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml,
        contentYaml,
      });
      expect(parsed.config.content_text).toBeUndefined();
      expect(parsed.config.content_file).toBe(FIXTURE_CONTENT_FILE);
    });
  });

  describe('校验闸：manifest 分支（01 §5.3）', () => {
    it('card_count 必须为 1（固定复合卡片）', () => {
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
            'card_count: 1',
            'card_count: 2'
          ),
        })
      ).toContain('CARD_MANIFEST_CARD_COUNT_INVALID');
    });

    it('resource_count 必须为非负整数且与清单条数一致', () => {
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
            'resource_count: 1',
            'resource_count: -1'
          ),
        })
      ).toContain('CARD_MANIFEST_RESOURCE_COUNT_INVALID');
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
            'resource_count: 1',
            'resource_count: 1.5'
          ),
        })
      ).toContain('CARD_MANIFEST_RESOURCE_COUNT_INVALID');
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
            'resource_count: 1',
            'resource_count: 2'
          ),
        })
      ).toContain('CARD_MANIFEST_RESOURCE_COUNT_MISMATCH');
    });

    it('resources 必须为数组，条目 path/size/type 逐项合法', () => {
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
            /\n {2}resources:\n[\s\S]*$/,
            '\n  resources: "无"\n'
          ),
        })
      ).toContain('CARD_MANIFEST_RESOURCES_INVALID');
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
            `path: "${FIXTURE_CONTENT_FILE}"`,
            'path: "/abs/body.md"'
          ),
        })
      ).toContain('CARD_MANIFEST_RESOURCE_PATH_INVALID');
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace('size: 168', 'size: -5'),
        })
      ).toContain('CARD_MANIFEST_RESOURCE_SIZE_INVALID');
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace('size: 168', 'size: 1.5'),
        })
      ).toContain('CARD_MANIFEST_RESOURCE_SIZE_INVALID');
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml.replace(
            'type: "text/markdown"',
            'type: ""'
          ),
        })
      ).toContain('CARD_MANIFEST_RESOURCE_TYPE_INVALID');
    });

    it('清单路径必须唯一', () => {
      const structureYaml = [
        'structure:',
        `  - id: "${FIXTURE_NODE_ID}"`,
        '    type: "base.richtext"',
        'manifest:',
        '  card_count: 1',
        '  resource_count: 2',
        '  resources:',
        `    - path: "${FIXTURE_CONTENT_FILE}"`,
        '      size: 168',
        '      type: "text/markdown"',
        `    - path: "${FIXTURE_CONTENT_FILE}"`,
        '      size: 168',
        '      type: "text/markdown"',
        '',
      ].join('\n');
      expect(validateCodes({ structureYaml })).toContain('CARD_MANIFEST_RESOURCE_PATH_DUPLICATED');
    });

    it('清单必须与富文本配置实际引用一致', () => {
      expect(
        validateCodes({
          structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml
            .replace(/\n {2}resources:\n[\s\S]*$/, '\n  resources: []\n')
            .replace('resource_count: 1', 'resource_count: 0'),
        })
      ).toContain('CARD_MANIFEST_REFERENCES_MISMATCH');
      const inlineWithImage = [
        'card_type: "base.richtext"',
        'content_format: "markdown"',
        'content_source: "inline"',
        'content_text: "![配图](photo.jpg)"',
        'locale: "zh-CN"',
        'theme: ""',
        'markdown_capabilities:',
        '  commonmark: true',
        '  gfm: true',
        '  math: true',
        '  highlight: true',
        '  underline: true',
        '  superscript: true',
        '  subscript: true',
        '',
      ].join('\n');
      expect(
        validateCodes({
          contentYaml: inlineWithImage,
        })
      ).toContain('CARD_MANIFEST_REFERENCES_MISMATCH');
      const inlineWithManifest = mutateFiles({ contentYaml: inlineWithImage });
      const withMatchingManifest = [
        'structure:',
        `  - id: "${FIXTURE_NODE_ID}"`,
        '    type: "base.richtext"',
        'manifest:',
        '  card_count: 1',
        '  resource_count: 1',
        '  resources:',
        '    - path: "photo.jpg"',
        '      size: 2048',
        '      type: "image/jpeg"',
        '',
      ].join('\n');
      expect(
        validateCompositeRichTextCardFiles({
          ...inlineWithManifest,
          structureYaml: withMatchingManifest,
        }).valid
      ).toBe(true);
    });
  });

  describe('校验闸：封面与整体判定', () => {
    it('封面不得为空', () => {
      expect(validateCodes({ coverHtml: '' })).toContain('CARD_COVER_EMPTY');
      expect(validateCodes({ coverHtml: '   \n  ' })).toContain('CARD_COVER_EMPTY');
    });

    it('文档库权威夹具整体合法', () => {
      const result = validateCompositeRichTextCardFiles(VALID_COMPOSITE_CARD_FILES);
      expect(result.issues).toEqual([]);
      expect(result.valid).toBe(true);
    });

    it('旧仓坏结构判例随迁：多节点、绝对路径、file+text 共存、计数与保留前缀路径一并报告', () => {
      const document = buildDocument();
      document.config = {
        card_type: 'base.richtext',
        theme: '',
        locale: 'zh-CN',
        content_format: 'markdown',
        content_source: 'file',
        content_text: '不应和 file 模式共存',
        content_file: '/Users/demo/body.md',
        markdown_capabilities: {
          commonmark: true,
          gfm: true,
          math: true,
          highlight: true,
          underline: true,
          superscript: true,
          subscript: true,
        },
      };
      const files = buildCompositeRichTextCardFiles(document, [
        { path: 'content/body.md', size: 12, type: 'text/markdown' },
      ]);
      const validation = validateCompositeRichTextCardFiles({
        ...files,
        structureYaml: yaml.stringify({
          structure: [
            { id: FIXTURE_NODE_ID, type: 'base.richtext' },
            { id: FIXTURE_SECOND_NODE_ID, type: 'base.richtext' },
          ],
          manifest: {
            card_count: 2,
            resource_count: 1,
            resources: [{ path: 'content/body.md', size: 12, type: 'text/markdown' }],
          },
        }),
      });

      expect(validation.valid).toBe(false);
      expect(validation.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          'CARD_STRUCTURE_NODE_COUNT_INVALID',
          'RICHTEXT_FILE_PATH_INVALID',
          'RICHTEXT_FILE_TEXT_FORBIDDEN',
          'CARD_MANIFEST_CARD_COUNT_INVALID',
          'CARD_MANIFEST_RESOURCE_PATH_INVALID',
        ])
      );
    });
  });

  describe('断言面', () => {
    it('合法夹具不抛出', () => {
      expect(() => assertCompositeRichTextCardFiles(VALID_COMPOSITE_CARD_FILES)).not.toThrow();
    });

    it('非法输入抛 CardStructureValidationError 并携带全部问题', () => {
      try {
        assertCompositeRichTextCardFiles(mutateFiles({ coverHtml: '' }));
        throw new Error('应当抛出 CardStructureValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(CardStructureValidationError);
        const structureError = error as CardStructureValidationError;
        expect(structureError.name).toBe('CardStructureValidationError');
        expect(structureError.issues).toHaveLength(1);
        expect(structureError.issues[0]?.code).toBe('CARD_COVER_EMPTY');
        expect(structureError.message).toContain('.card/cover.html');
      }
    });
  });
});
