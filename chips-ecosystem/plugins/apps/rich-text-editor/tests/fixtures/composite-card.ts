/**
 * 固定复合卡片（复合卡片容器 + 一张富文本基础卡片）测试夹具。
 *
 * 唯一权威：《01-卡片文件格式》（薯片生态文档库/04-文件格式规范）——
 * metadata.yaml 按 §4、structure.yaml 按 §5、content/*.yaml 按 §6.1/§6.6、
 * cover.html 默认封面按 §7.6 逐字重建；标识一律取文档在册示例 ID
 * （`a1B2c3D4e5` / `f6G7h8I9j0` / `k1L2m3N4o5`，05-ID生成规范 §二 文法），
 * 不自造 ID、不携带旧仓 LEGACY 形态（`RichTextCard` 别名、`markdown` 字段别名均不入夹具）。
 */

/** 卡片文档标识（01 §4.2 在册示例）。 */
export const FIXTURE_CARD_ID = 'a1B2c3D4e5';

/** 基础卡片节点标识（01 §5.2 在册示例）。 */
export const FIXTURE_NODE_ID = 'f6G7h8I9j0';

/** 第二节点标识（01 §5.2 在册示例，仅用于多节点拒绝分支）。 */
export const FIXTURE_SECOND_NODE_ID = 'k1L2m3N4o5';

/** 富文本正文资源路径（01 §6.6 示例 2 形制：卡片根相对 `.md`）。 */
export const FIXTURE_CONTENT_FILE = 'richtext/f6G7h8I9j0.md';

/** 正文资源字节（01 §6.6 示例 2 正文）。 */
export const FIXTURE_CONTENT_FILE_BODY = [
  '# 东京旅行日记',
  '',
  '这次东京之旅非常精彩...',
  '',
  '- 参观了浅草寺',
  '- 登上了东京塔',
  '- 品尝了地道拉面',
  '',
].join('\n');

/** `.card/metadata.yaml`（01 §4.1 字段模型 + §4.3 取值规则；theme 保留字段写空串）。 */
export const VALID_METADATA_YAML = [
  'chip_standards_version: "1.0.0"',
  'card_id: "a1B2c3D4e5"',
  'name: "东京旅行日记"',
  'created_at: "2026-01-15T08:00:00.000Z"',
  'modified_at: "2026-01-30T10:30:00.000Z"',
  'theme: ""',
  'cover_ratio: "3:4"',
  'tags: []',
  '',
].join('\n');

/** `.card/structure.yaml`（01 §5.1/§5.3：单节点 + 清单与引用一致）。 */
export const VALID_STRUCTURE_YAML = [
  'structure:',
  '  - id: "f6G7h8I9j0"',
  '    type: "base.richtext"',
  'manifest:',
  '  card_count: 1',
  '  resource_count: 1',
  '  resources:',
  '    - path: "richtext/f6G7h8I9j0.md"',
  '      size: 168',
  '      type: "text/markdown"',
  '',
].join('\n');

/** `content/f6G7h8I9j0.yaml`（01 §6.6 示例 2 形制：长内容文件化保存）。 */
export const VALID_CONTENT_YAML = [
  'card_type: "base.richtext"',
  'content_format: "markdown"',
  'content_source: "file"',
  'content_file: "richtext/f6G7h8I9j0.md"',
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

/** 内联短内容形态（01 §6.6 示例 1 形制：≤200 字写 `content_text`）。 */
export const VALID_INLINE_CONTENT_YAML = [
  'card_type: "base.richtext"',
  'content_format: "markdown"',
  'content_source: "inline"',
  'content_text: |',
  '  # 旅行日记',
  '',
  '  这次东京之旅非常精彩。',
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

/** `.card/cover.html` 默认封面（01 §7.6 逐字模板，`{{CARD_NAME}}` 已替换并做 HTML 转义）。 */
export const VALID_COVER_HTML = [
  '<!DOCTYPE html>',
  '<html lang="zh-CN">',
  '<head>',
  '  <meta charset="UTF-8">',
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '  <title>Default Cover</title>',
  '  <style>',
  '    html, body { margin: 0; width: 100%; height: 100%; }',
  '    body {',
  '      display: grid;',
  '      place-items: center;',
  '      background: linear-gradient(135deg, #f5f7fb 0%, #eef3ff 100%);',
  '      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
  '      color: #111827;',
  '      text-align: center;',
  '      padding: 24px;',
  '      box-sizing: border-box;',
  '      overflow: hidden;',
  '    }',
  '    .card-name {',
  '      font-size: 24px;',
  '      font-weight: 600;',
  '      line-height: 1.4;',
  '      word-wrap: break-word;',
  '    }',
  '  </style>',
  '</head>',
  '<body>',
  '  <div class="card-name">东京旅行日记</div>',
  '</body>',
  '</html>',
  '',
].join('\n');

/** 完整合法夹具集合（文件模式）。 */
export const VALID_COMPOSITE_CARD_FILES = {
  metadataYaml: VALID_METADATA_YAML,
  structureYaml: VALID_STRUCTURE_YAML,
  contentYaml: VALID_CONTENT_YAML,
  coverHtml: VALID_COVER_HTML,
} as const;
