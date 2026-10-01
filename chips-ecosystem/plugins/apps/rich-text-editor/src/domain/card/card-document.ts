/**
 * 固定复合卡片文档模型（「复合卡片容器 + 一张富文本基础卡片」，08-官方应用功能总览 §十二）。
 *
 * 承载 `.card` 四类正式文件的构建 / 解析 / 校验 / 序列化（《01-卡片文件格式》为唯一权威）：
 * - `.card/metadata.yaml`（§4）、`.card/structure.yaml`（§5）、`content/<baseCardId>.yaml`
 *   （§6.1、§6.6）、`.card/cover.html`（§7）；
 * - 只操作已分离的文件文本与类型化模型切片；包字节读取 / 写入归宿主文档服务与解析链
 *   正式链路，本模块不做任何 `.card` 字节打包（§17「链路唯一」）；
 * - 模型不生成任何文件级 ID：`card_id` 由文档服务生成、节点 ID 由编辑链路生成
 *   （《05-ID生成规范》§四），调用方按正式链路取得后传入。
 *
 * G-5 对照（旧仓 `src/lib/card-document.ts:502` 迁移适配，矩阵裁决「迁移」）：
 * - 构建面清除 `description` 字段（§4.1 metadata Schema 无此字段）；
 * - structure 节点只写 `id` / `type`（§5.1 items 与 SDK `IStructureEntry` 同面），
 *   旧节点级 `created_at` / `modified_at` 不再写入；
 * - 节点类型只认正式 `base.richtext`，旧 `RichTextCard` 读取归一面不迁移（零兼容）；
 * - 时间戳按 §4.1 `format: date-time` 从严为 ISO 8601 UTC（与宿主在册口径同字面），
 *   并按 §4.3 校验 `modified_at` 不得早于 `created_at`；
 * - 默认封面逐字对齐 §7.6 官方模板（渐变背景 + `.card-name` 居中名称）；
 * - 清单资源 size 按 §5.1 Schema 从严为非负整数。
 */

import yaml from 'yaml';
import {
  collectRichTextResourcePaths,
  createInitialBasecardConfig,
  normalizeBasecardConfig,
  RICHTEXT_CARD_TYPE,
  type RichTextBaseCardConfig,
} from './richtext-card';
import { hasCaseInsensitiveDuplicate, isValidChipId } from './id';
import { normalizeRelativeResourcePath } from './path';

/** 封面比例缺省值（§4.1 `cover_ratio` default）。 */
export const DEFAULT_COVER_RATIO = '3:4';

/** 薯片标准版本号：严格三段式（§4.1，禁止预发布标识与构建元数据）。 */
const STANDARDS_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/** 封面比例：`宽:高` 正数比值字符串（§4.1 pattern）。 */
const COVER_RATIO_PATTERN = /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/;

/** ISO 8601 UTC 时间戳（§4.1 `format: date-time`；与宿主文档能力在册口径同字面）。 */
const ISO_8601_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

/** 卡片名称长度上限（§4.1 `maxLength`）。 */
const NAME_MAX_LENGTH = 500;

/** structure.yaml 资源清单条目（§5.1 items；可选维度字段由写入链路计算）。 */
export interface CompositeCardResourceManifestEntry {
  path: string;
  size: number;
  type: string;
  duration?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  language?: string | undefined;
  checksum?: string | undefined;
}

/** 固定复合卡片的类型化文档模型。 */
export interface RichTextCompositeCardDocument {
  cardId: string;
  baseCardId: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
  coverRatio: string;
  config: RichTextBaseCardConfig;
}

/** 一条结构校验问题（path 为文件内定位，code 为模型诊断码）。 */
export interface CardStructureValidationIssue {
  path: string;
  code: string;
  message: string;
}

/** 结构校验结果。 */
export interface CardStructureValidationResult {
  valid: boolean;
  issues: CardStructureValidationIssue[];
}

/** 结构校验失败异常：携带全部问题，首条问题进入 message。 */
export class CardStructureValidationError extends Error {
  readonly issues: CardStructureValidationIssue[];

  constructor(issues: CardStructureValidationIssue[]) {
    const firstIssue = issues[0];
    super(
      firstIssue
        ? `富文本卡片文件结构不合法：${firstIssue.path} ${firstIssue.message}`
        : '富文本卡片文件结构不合法。'
    );
    this.name = 'CardStructureValidationError';
    this.issues = issues;
  }
}

/** HTML 正文转义（默认封面名称注入用）。 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 收敛为普通对象（非对象或数组一律给空对象，由校验闸报告形态问题）。 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** 读取非空字符串（去首尾空白）。 */
function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/** 读取原始字符串（不去空白，供 name 等按原文校验的字段）。 */
function readRawString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** 是否为普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** ISO 8601 UTC 形态且可被解析为真实时刻（§4.1 `format: date-time`）。 */
function isValidDateTime(value: string | undefined): boolean {
  if (!value || !ISO_8601_UTC_PATTERN.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

/** 解析 YAML 文本为普通对象；解析失败或非对象记入问题并返回空对象。 */
function parseYamlRecord(
  source: string,
  path: string,
  issues: CardStructureValidationIssue[]
): Record<string, unknown> {
  try {
    const parsed: unknown = yaml.parse(source);
    if (!isRecord(parsed)) {
      issues.push({ path, code: 'CARD_YAML_NOT_OBJECT', message: '必须是 YAML 对象。' });
      return {};
    }
    return parsed;
  } catch (error) {
    issues.push({
      path,
      code: 'CARD_YAML_PARSE_FAILED',
      message: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

/** 记录一条校验问题。 */
function addIssue(
  issues: CardStructureValidationIssue[],
  path: string,
  code: string,
  message: string
): void {
  issues.push({ path, code, message });
}

/**
 * 卡片内部资源路径合法性：卡片根相对、已归一、不落入 `.card/` 与 `content/`
 * 保留命名空间（§8.2；保留空间承载元数据与内容配置）。
 */
function isValidInternalResourcePath(value: unknown): value is string {
  const raw = readString(value);
  const normalized = normalizeRelativeResourcePath(raw);
  return (
    !!normalized &&
    !!raw &&
    normalized === raw &&
    !normalized.startsWith('.card/') &&
    !normalized.startsWith('content/')
  );
}

/** 排序去重（清单对照用；字典序稳定排序）。 */
function toSortedUnique(paths: string[]): string[] {
  return Array.from(new Set(paths)).sort((left, right) => left.localeCompare(right));
}

/** metadata.yaml 校验（§4）。 */
function validateMetadata(
  metadata: Record<string, unknown>,
  issues: CardStructureValidationIssue[]
): void {
  const version = readString(metadata.chip_standards_version);
  const cardId = readString(metadata.card_id);
  const name = readRawString(metadata.name);
  const createdAt = readString(metadata.created_at);
  const modifiedAt = readString(metadata.modified_at);
  const coverRatio = readString(metadata.cover_ratio) ?? DEFAULT_COVER_RATIO;

  if (!version || !STANDARDS_VERSION_PATTERN.test(version)) {
    addIssue(
      issues,
      '.card/metadata.yaml#chip_standards_version',
      'CARD_METADATA_VERSION_INVALID',
      '必须是严格三段式语义化版本字符串。'
    );
  }
  if (!isValidChipId(cardId)) {
    addIssue(
      issues,
      '.card/metadata.yaml#card_id',
      'CARD_METADATA_ID_INVALID',
      '必须是 10 位 Base62 卡片标识。'
    );
  }
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > NAME_MAX_LENGTH) {
    addIssue(
      issues,
      '.card/metadata.yaml#name',
      'CARD_METADATA_NAME_INVALID',
      `必须是非空且不超过 ${NAME_MAX_LENGTH} 字符的字符串。`
    );
  }
  const createdAtValid = isValidDateTime(createdAt);
  const modifiedAtValid = isValidDateTime(modifiedAt);
  if (!createdAtValid) {
    addIssue(
      issues,
      '.card/metadata.yaml#created_at',
      'CARD_METADATA_CREATED_AT_INVALID',
      '必须是 ISO 8601 UTC 时间戳。'
    );
  }
  if (!modifiedAtValid) {
    addIssue(
      issues,
      '.card/metadata.yaml#modified_at',
      'CARD_METADATA_MODIFIED_AT_INVALID',
      '必须是 ISO 8601 UTC 时间戳。'
    );
  }
  if (
    createdAtValid &&
    modifiedAtValid &&
    createdAt !== undefined &&
    modifiedAt !== undefined &&
    Date.parse(modifiedAt) < Date.parse(createdAt)
  ) {
    addIssue(
      issues,
      '.card/metadata.yaml#modified_at',
      'CARD_METADATA_MODIFIED_BEFORE_CREATED',
      '不得早于 created_at。'
    );
  }
  if (!COVER_RATIO_PATTERN.test(coverRatio)) {
    addIssue(
      issues,
      '.card/metadata.yaml#cover_ratio',
      'CARD_METADATA_COVER_RATIO_INVALID',
      '必须为「宽:高」比值字符串。'
    );
  }
  if (metadata.tags !== undefined && !Array.isArray(metadata.tags)) {
    addIssue(
      issues,
      '.card/metadata.yaml#tags',
      'CARD_METADATA_TAGS_INVALID',
      '存在时必须为数组。'
    );
  }
}

/** 能力矩阵逐项点名顺序（§6.6 required）。 */
const MARKDOWN_CAPABILITY_VALIDATION_KEYS = [
  'commonmark',
  'gfm',
  'math',
  'highlight',
  'underline',
  'superscript',
  'subscript',
] as const;

/** content/*.yaml 富文本配置校验（§6.6），并返回实际引用的内部资源路径。 */
function validateRichTextConfig(
  content: Record<string, unknown>,
  issues: CardStructureValidationIssue[]
): { referencedResources: string[] } {
  const cardType = readString(content.card_type);
  const contentFormat = readString(content.content_format);
  const contentSource = readString(content.content_source);
  const contentText = readRawString(content.content_text);
  const contentFile = readString(content.content_file);
  const capabilities = asRecord(content.markdown_capabilities);

  if (cardType !== RICHTEXT_CARD_TYPE) {
    addIssue(
      issues,
      'content/<baseCardId>.yaml#card_type',
      'RICHTEXT_CARD_TYPE_INVALID',
      '必须是 base.richtext。'
    );
  }
  if (contentFormat !== 'markdown') {
    addIssue(
      issues,
      'content/<baseCardId>.yaml#content_format',
      'RICHTEXT_FORMAT_INVALID',
      '必须是 markdown。'
    );
  }
  if (contentSource !== 'inline' && contentSource !== 'file') {
    addIssue(
      issues,
      'content/<baseCardId>.yaml#content_source',
      'RICHTEXT_SOURCE_INVALID',
      '必须是 inline 或 file。'
    );
  }

  if (contentSource === 'inline') {
    if (typeof contentText !== 'string') {
      addIssue(
        issues,
        'content/<baseCardId>.yaml#content_text',
        'RICHTEXT_INLINE_TEXT_MISSING',
        'inline 模式必须携带 content_text。'
      );
    }
    if (contentFile) {
      addIssue(
        issues,
        'content/<baseCardId>.yaml#content_file',
        'RICHTEXT_INLINE_FILE_FORBIDDEN',
        'inline 模式禁止保存 content_file。'
      );
    }
  }

  if (contentSource === 'file') {
    if (!isValidInternalResourcePath(contentFile) || !contentFile.toLowerCase().endsWith('.md')) {
      addIssue(
        issues,
        'content/<baseCardId>.yaml#content_file',
        'RICHTEXT_FILE_PATH_INVALID',
        '必须是卡片根相对的 .md 资源路径。'
      );
    }
    if (typeof contentText === 'string' && contentText.trim().length > 0) {
      addIssue(
        issues,
        'content/<baseCardId>.yaml#content_text',
        'RICHTEXT_FILE_TEXT_FORBIDDEN',
        'file 模式禁止保存非空 content_text。'
      );
    }
  }

  for (const key of MARKDOWN_CAPABILITY_VALIDATION_KEYS) {
    if (typeof capabilities[key] !== 'boolean') {
      addIssue(
        issues,
        `content/<baseCardId>.yaml#markdown_capabilities.${key}`,
        'RICHTEXT_CAPABILITY_INVALID',
        '必须显式声明为布尔值。'
      );
    }
  }

  return {
    referencedResources: collectRichTextResourcePaths(normalizeBasecardConfig(content)),
  };
}

/** structure.yaml 结构与内容对应校验（§5.3、§6.1）。 */
function validateStructure(
  structure: Record<string, unknown>,
  content: Record<string, unknown>,
  issues: CardStructureValidationIssue[]
): void {
  const nodes = Array.isArray(structure.structure) ? structure.structure : [];
  if (nodes.length !== 1) {
    addIssue(
      issues,
      '.card/structure.yaml#structure',
      'CARD_STRUCTURE_NODE_COUNT_INVALID',
      '必须且只能包含一个基础卡片节点。'
    );
  }

  const firstNode = asRecord(nodes[0]);
  const baseCardId = readString(firstNode.id);
  const nodeType = readString(firstNode.type);
  if (!isValidChipId(baseCardId)) {
    addIssue(
      issues,
      '.card/structure.yaml#structure[0].id',
      'CARD_STRUCTURE_BASE_ID_INVALID',
      '必须是 10 位 Base62 节点标识。'
    );
  }
  if (nodeType !== RICHTEXT_CARD_TYPE) {
    addIssue(
      issues,
      '.card/structure.yaml#structure[0].type',
      'CARD_STRUCTURE_NODE_TYPE_INVALID',
      '必须是 base.richtext。'
    );
  }
  if (
    nodes.length > 1 &&
    hasCaseInsensitiveDuplicate(nodes.filter(isRecord).map((node) => readString(node.id) ?? ''))
  ) {
    addIssue(
      issues,
      '.card/structure.yaml#structure',
      'CARD_STRUCTURE_NODE_ID_DUPLICATED',
      '节点标识不得重复（含大小写等价形态）。'
    );
  }
  if (readString(content.card_type) && readString(content.card_type) !== nodeType) {
    addIssue(
      issues,
      'content/<baseCardId>.yaml#card_type',
      'CARD_CONTENT_TYPE_MISMATCH',
      '必须与 structure[0].type 一致。'
    );
  }
}

/** structure.yaml manifest 清单校验（§5.1、§5.3），并与配置实际引用对照。 */
function validateManifest(
  structure: Record<string, unknown>,
  referencedResources: string[],
  issues: CardStructureValidationIssue[]
): void {
  const manifest = asRecord(structure.manifest);
  const cardCount = manifest.card_count;
  const resourceCount = manifest.resource_count;
  const resources = Array.isArray(manifest.resources) ? manifest.resources : [];
  const manifestPaths: string[] = [];
  const seenPaths = new Set<string>();

  if (cardCount !== 1) {
    addIssue(
      issues,
      '.card/structure.yaml#manifest.card_count',
      'CARD_MANIFEST_CARD_COUNT_INVALID',
      '固定复合卡片必须为 1。'
    );
  }
  if (typeof resourceCount !== 'number' || !Number.isInteger(resourceCount) || resourceCount < 0) {
    addIssue(
      issues,
      '.card/structure.yaml#manifest.resource_count',
      'CARD_MANIFEST_RESOURCE_COUNT_INVALID',
      '必须是非负整数。'
    );
  }
  if (!Array.isArray(manifest.resources)) {
    addIssue(
      issues,
      '.card/structure.yaml#manifest.resources',
      'CARD_MANIFEST_RESOURCES_INVALID',
      '必须是数组。'
    );
  }

  resources.forEach((resource, index) => {
    const record = asRecord(resource);
    const resourcePath = readString(record.path);
    const resourceSize = record.size;
    const resourceType = readString(record.type);

    if (!isValidInternalResourcePath(resourcePath)) {
      addIssue(
        issues,
        `.card/structure.yaml#manifest.resources[${index}].path`,
        'CARD_MANIFEST_RESOURCE_PATH_INVALID',
        '必须是卡片根相对资源路径。'
      );
      return;
    }

    if (seenPaths.has(resourcePath)) {
      addIssue(
        issues,
        `.card/structure.yaml#manifest.resources[${index}].path`,
        'CARD_MANIFEST_RESOURCE_PATH_DUPLICATED',
        '必须唯一。'
      );
    }
    seenPaths.add(resourcePath);
    manifestPaths.push(resourcePath);

    if (typeof resourceSize !== 'number' || !Number.isInteger(resourceSize) || resourceSize < 0) {
      addIssue(
        issues,
        `.card/structure.yaml#manifest.resources[${index}].size`,
        'CARD_MANIFEST_RESOURCE_SIZE_INVALID',
        '必须是非负整数（字节）。'
      );
    }
    if (!resourceType) {
      addIssue(
        issues,
        `.card/structure.yaml#manifest.resources[${index}].type`,
        'CARD_MANIFEST_RESOURCE_TYPE_INVALID',
        '必须是非空 MIME 类型。'
      );
    }
  });

  if (typeof resourceCount === 'number' && resourceCount !== resources.length) {
    addIssue(
      issues,
      '.card/structure.yaml#manifest.resource_count',
      'CARD_MANIFEST_RESOURCE_COUNT_MISMATCH',
      '必须等于 manifest.resources.length。'
    );
  }

  const normalizedManifestPaths = toSortedUnique(manifestPaths);
  const normalizedReferencedResources = toSortedUnique(referencedResources);
  if (normalizedManifestPaths.join('\n') !== normalizedReferencedResources.join('\n')) {
    addIssue(
      issues,
      '.card/structure.yaml#manifest.resources',
      'CARD_MANIFEST_REFERENCES_MISMATCH',
      '必须与富文本基础卡片配置实际引用的资源一致。'
    );
  }
}

/** 生成默认封面（§7.6 官方模板逐字对齐；`{{CARD_NAME}}` 替换为转义后的卡片名称）。 */
export function createDefaultCoverHtml(title: string): string {
  const safeTitle = escapeHtml(title);
  return [
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
    `  <div class="card-name">${safeTitle}</div>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

/** 创建空文档模型：标识由调用方按正式链路传入，本模型不生成 ID。 */
export function createEmptyRichTextCardDocument(
  cardId: string,
  baseCardId: string,
  title: string
): RichTextCompositeCardDocument {
  const timestamp = new Date().toISOString();
  return {
    cardId,
    baseCardId,
    title,
    createdAt: timestamp,
    modifiedAt: timestamp,
    coverRatio: DEFAULT_COVER_RATIO,
    config: createInitialBasecardConfig(title),
  };
}

/** 从已分离的 YAML 文本解析固定复合卡片文档模型。 */
export function parseCompositeRichTextCard(input: {
  metadataYaml: string;
  structureYaml: string;
  contentYaml: string;
}): RichTextCompositeCardDocument {
  const metadata = asRecord(yaml.parse(input.metadataYaml));
  const structure = asRecord(yaml.parse(input.structureYaml));
  const nodes = Array.isArray(structure.structure) ? structure.structure : [];

  if (nodes.length !== 1) {
    throw new Error('只能编辑单富文本基础卡片的复合卡片。');
  }

  const firstNode = asRecord(nodes[0]);
  const type = readString(firstNode.type);
  if (type !== RICHTEXT_CARD_TYPE) {
    throw new Error('目标卡片不包含富文本基础卡片。');
  }

  const cardId = readString(metadata.card_id);
  const baseCardId = readString(firstNode.id);
  const title = readString(metadata.name);
  const createdAt = readString(metadata.created_at);
  const modifiedAt = readString(metadata.modified_at);

  if (!cardId || !baseCardId || !title || !createdAt || !modifiedAt) {
    throw new Error('复合卡片元数据不完整。');
  }

  return {
    cardId,
    baseCardId,
    title,
    createdAt,
    modifiedAt,
    coverRatio: readString(metadata.cover_ratio) ?? DEFAULT_COVER_RATIO,
    config: normalizeBasecardConfig(asRecord(yaml.parse(input.contentYaml))),
  };
}

/** 收集文档模型引用的卡片根相对资源路径。 */
export function collectCompositeRichTextResourcePaths(
  document: RichTextCompositeCardDocument
): string[] {
  return collectRichTextResourcePaths(document.config);
}

/** 校验固定复合卡片的四类正式文件文本（§4、§5、§6.6、§7）。 */
export function validateCompositeRichTextCardFiles(input: {
  metadataYaml: string;
  structureYaml: string;
  contentYaml: string;
  coverHtml: string;
}): CardStructureValidationResult {
  const issues: CardStructureValidationIssue[] = [];
  const metadata = parseYamlRecord(input.metadataYaml, '.card/metadata.yaml', issues);
  const structure = parseYamlRecord(input.structureYaml, '.card/structure.yaml', issues);
  const content = parseYamlRecord(input.contentYaml, 'content/<baseCardId>.yaml', issues);

  validateMetadata(metadata, issues);
  validateStructure(structure, content, issues);
  const { referencedResources } = validateRichTextConfig(content, issues);
  validateManifest(structure, referencedResources, issues);

  if (input.coverHtml.trim().length === 0) {
    addIssue(issues, '.card/cover.html', 'CARD_COVER_EMPTY', '封面不得为空。');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/** 校验并在不合法时抛出 {@link CardStructureValidationError}。 */
export function assertCompositeRichTextCardFiles(input: {
  metadataYaml: string;
  structureYaml: string;
  contentYaml: string;
  coverHtml: string;
}): void {
  const validation = validateCompositeRichTextCardFiles(input);
  if (!validation.valid) {
    throw new CardStructureValidationError(validation.issues);
  }
}

/** 由文档模型序列化四类正式文件文本（`resourceManifest` 缺省为空清单）。 */
export function buildCompositeRichTextCardFiles(
  document: RichTextCompositeCardDocument,
  resourceManifest: readonly CompositeCardResourceManifestEntry[] = []
): {
  metadataYaml: string;
  structureYaml: string;
  coverHtml: string;
  contentYaml: string;
} {
  const metadata = {
    chip_standards_version: '1.0.0',
    card_id: document.cardId,
    name: document.title,
    created_at: document.createdAt,
    modified_at: document.modifiedAt,
    theme: '',
    cover_ratio: document.coverRatio,
    tags: [] as string[],
  };

  const structure = {
    structure: [
      {
        id: document.baseCardId,
        type: RICHTEXT_CARD_TYPE,
      },
    ],
    manifest: {
      card_count: 1,
      resource_count: resourceManifest.length,
      resources: resourceManifest,
    },
  };

  return {
    metadataYaml: yaml.stringify(metadata),
    structureYaml: yaml.stringify(structure),
    coverHtml: createDefaultCoverHtml(document.title),
    contentYaml: yaml.stringify(document.config),
  };
}
