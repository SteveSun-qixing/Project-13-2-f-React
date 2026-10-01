/**
 * 真实卡片夹具（解包 `.card` 目录的正式文本文件，16-传输协议 §四 改写与还原的测试输入）。
 *
 * 唯一权威：《01-卡片文件格式》（薯片生态文档库/04-文件格式规范）——
 * metadata.yaml 按 §4、structure.yaml 按 §5、content/*.yaml 按 §6.3（base.image）与
 * §6.6（base.richtext 文件化正文）、cover.html 按 §7（相对引用相对 `.card/` 目录解析）。
 * 标识一律取文档在册示例 ID（`a1B2c3D4e5` / `f6G7h8I9j0` / `k1L2m3N4o5`，
 * 05-ID生成规范 §二文法），不自造 ID；不携带旧形态（`RichTextCard` 别名不入夹具）。
 */

/** 卡片文档标识（01 §4.2 在册示例）。 */
export const FIXTURE_CARD_ID = 'a1B2c3D4e5';

/** 富文本正文资源路径（01 §6.6 示例 2 形制：卡片根相对 `.md`）。 */
export const FIXTURE_CONTENT_FILE = 'richtext/f6G7h8I9j0.md';

/** 图片卡片内容配置路径（01 §6.3 示例形制）。 */
export const FIXTURE_IMAGE_CONFIG_PATH = 'content/k1L2m3N4o5.yaml';

/** 富文本内容配置路径（01 §6.6 示例 2 形制）。 */
export const FIXTURE_RICHTEXT_CONFIG_PATH = 'content/f6G7h8I9j0.yaml';

/** `.card/metadata.yaml`（01 §4.1 字段模型 + §4.3 取值规则；theme 保留字段写空串）。 */
export const FIXTURE_METADATA_YAML = [
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
export const FIXTURE_STRUCTURE_YAML = [
  'structure:',
  '  - id: "f6G7h8I9j0"',
  '    type: "base.richtext"',
  'manifest:',
  '  card_count: 1',
  '  resource_count: 3',
  '  resources:',
  '    - path: "richtext/f6G7h8I9j0.md"',
  '      size: 168',
  '      type: "text/markdown"',
  '    - path: "images/tokyo-1.jpg"',
  '      size: 204800',
  '      type: "image/jpeg"',
  '    - path: ".card/cardcover/cover-image.png"',
  '      size: 40960',
  '      type: "image/png"',
  '',
].join('\n');

/** 图片卡片 `content/*.yaml`（01 §6.3 示例形制：file 与 url 两种来源并存）。 */
export const FIXTURE_IMAGE_CONFIG_YAML = [
  'card_type: "base.image"',
  'theme: ""',
  'images:',
  '  - id: "cover-1"',
  '    source: "file"',
  '    file_path: "images/tokyo-1.jpg"',
  '    title: "东京塔夜景"',
  '    alt: "东京塔夜景照片"',
  '  - id: "cover-2"',
  '    source: "url"',
  '    url: "https://example.com/tokyo-night-2.jpg"',
  '    title: "备用网络图"',
  '    alt: "东京夜景补充图片"',
  'layout_type: "grid"',
  'layout_options:',
  '  grid_mode: "2x2"',
  '  spacing_mode: "comfortable"',
  '  single_width_percent: 100',
  '  single_alignment: "center"',
  '',
].join('\n');

/** 富文本正文资源字节（01 §6.6 示例 2 正文）。 */
export const FIXTURE_CONTENT_FILE_BODY = [
  '# 东京旅行日记',
  '',
  '这次东京之旅非常精彩。',
  '',
  '- 参观了浅草寺',
  '- 登上了东京塔',
  '- 品尝了地道拉面',
  '',
].join('\n');

/** 富文本卡片 `content/*.yaml`（01 §6.6 示例 2 形制：长内容文件化保存）。 */
export const FIXTURE_RICHTEXT_CONFIG_YAML = [
  'card_type: "base.richtext"',
  'content_format: "markdown"',
  'content_source: "file"',
  'content_file: "richtext/f6G7h8I9j0.md"',
  'locale: "zh-CN"',
  'theme: ""',
  '',
].join('\n');

/** `.card/cover.html`（01 §7：相对引用相对 `.card/` 目录解析，属性与 CSS url 两种形态并存）。 */
export const FIXTURE_COVER_HTML = [
  '<!DOCTYPE html>',
  '<html lang="zh-CN">',
  '<head>',
  '  <meta charset="UTF-8">',
  '  <title>东京旅行日记</title>',
  '  <style>',
  '    body {',
  '      margin: 0;',
  '      background-image: url("./cardcover/cover-image.png");',
  '      background-size: cover;',
  '    }',
  '  </style>',
  '</head>',
  '<body>',
  '  <img src="./cardcover/cover-image.png" alt="东京塔夜景" />',
  '  <img src="https://cdn.example.com/remote-banner.png" alt="远程横幅" />',
  '  <h1>东京旅行日记</h1>',
  '</body>',
  '</html>',
  '',
].join('\n');

/** 解包卡片目录的全量条目（目录列举形态；含系统生成物与目录条目，供资源枚举测试）。 */
export const FIXTURE_CARD_ENTRIES: ReadonlyArray<{ path: string; isDirectory: boolean }> = [
  { path: '.card', isDirectory: true },
  { path: '.card/metadata.yaml', isDirectory: false },
  { path: '.card/structure.yaml', isDirectory: false },
  { path: '.card/cover.html', isDirectory: false },
  { path: '.card/cardcover', isDirectory: true },
  { path: '.card/cardcover/cover-image.png', isDirectory: false },
  { path: 'content', isDirectory: true },
  { path: FIXTURE_IMAGE_CONFIG_PATH, isDirectory: false },
  { path: FIXTURE_RICHTEXT_CONFIG_PATH, isDirectory: false },
  { path: 'images', isDirectory: true },
  { path: 'images/tokyo-1.jpg', isDirectory: false },
  { path: FIXTURE_CONTENT_FILE, isDirectory: false },
  { path: 'attachments/行程表.pdf', isDirectory: false },
  { path: '__MACOSX', isDirectory: true },
  { path: '__MACOSX/._metadata.yaml', isDirectory: false },
  { path: '.DS_Store', isDirectory: false },
  { path: 'Thumbs.db', isDirectory: false },
  { path: 'desktop.ini', isDirectory: false },
];

/** 上传改写期对象存储 URL 映射（`resources[].originalRelativePath → networkUrl` 形态）。 */
export function createFixtureUrlMap(networkBase: string): Map<string, string> {
  return new Map<string, string>([
    ['images/tokyo-1.jpg', `${networkBase}/resources/images/tokyo-1.jpg`],
    [FIXTURE_CONTENT_FILE, `${networkBase}/resources/richtext/f6G7h8I9j0.md`],
    ['.card/cardcover/cover-image.png', `${networkBase}/resources/cardcover/cover-image.png`],
    ['attachments/行程表.pdf', `${networkBase}/resources/attachments/行程表.pdf`],
  ]);
}

/** 可逆恢复清单（16-传输协议 §4.4 示例形态；cardId 取该节在册示例 UUID）。 */
export const FIXTURE_RESTORE_MANIFEST = {
  schemaVersion: '1.0.0',
  originalFileName: 'tokyo-travel.card',
  cardId: '1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d',
  versionId: '6f7c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f',
  resources: [
    {
      originalRelativePath: '.card/cardcover/cover-image.png',
      networkUrl: 'https://file.example/chips-card-resources/cards/1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d/versions/6f7c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f/resources/cardcover/cover-image.png',
      bucket: 'chips-card-resources',
      objectKey: 'cards/1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d/versions/6f7c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f/resources/cardcover/cover-image.png',
      sizeBytes: 40960,
      mimeType: 'image/png',
    },
    {
      originalRelativePath: FIXTURE_CONTENT_FILE,
      networkUrl: 'https://file.example/chips-card-resources/cards/1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d/versions/6f7c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f/resources/richtext/f6G7h8I9j0.md',
      bucket: 'chips-card-resources',
      objectKey: 'cards/1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d/versions/6f7c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f/resources/richtext/f6G7h8I9j0.md',
      sizeBytes: 168,
      mimeType: 'text/markdown',
    },
    {
      originalRelativePath: 'images/tokyo-1.jpg',
      networkUrl: 'https://file.example/chips-card-resources/cards/1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d/versions/6f7c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f/resources/images/tokyo-1.jpg',
      bucket: 'chips-card-resources',
      objectKey: 'cards/1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d/versions/6f7c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f/resources/images/tokyo-1.jpg',
      sizeBytes: 204800,
      mimeType: 'image/jpeg',
    },
  ],
  zipEntries: [
    { order: 0, path: '.card/metadata.yaml', size: 512, compressedSize: 512, crc32: 123456789, isDirectory: false, compressionMethod: 0, modifiedTime: 1758268800000 },
    { order: 1, path: '.card/structure.yaml', size: 768, compressedSize: 768, crc32: 223456789, isDirectory: false, compressionMethod: 0, modifiedTime: 1758268800000 },
    { order: 2, path: '.card/cover.html', size: 1024, compressedSize: 1024, crc32: 323456789, isDirectory: false, compressionMethod: 0, modifiedTime: 1758268800000 },
    { order: 3, path: FIXTURE_IMAGE_CONFIG_PATH, size: 640, compressedSize: 640, crc32: 423456789, isDirectory: false, compressionMethod: 0, modifiedTime: 1758268800000 },
  ],
  richTextContentFiles: [{ configPath: FIXTURE_RICHTEXT_CONFIG_PATH, contentFile: FIXTURE_CONTENT_FILE }],
} as const;
