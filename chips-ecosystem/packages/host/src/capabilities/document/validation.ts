/**
 * 输入守卫与模型切片结构校验（服务职责部分）。
 *
 * 权威：`04-能力契约规范` §7.3（输入 Schema 与切片语义）、§5.2 规则 8/9、§5.4（校验错误详情）、
 * `02-Bridge三层设计` §6.2（校验流程）、§6.3（`additionalProperties: false`）、
 * `11-文档服务设计` §4.3（read 切片规则）、§4.4（write 提交单位与结构校验）、
 * `01-卡片文件格式` §4.1、§5.1、§5.3、`02-箱子文件格式` §4.2、§5.3、§十三。
 *
 * @remarks
 * - JSON Schema 校验主闸在 Bridge（§6.2 步骤 2～5：Bridge 校验通过后 `input` 原样交给 Host，
 *   Host 只做业务级校验）。能力入口拿到的 `input` 在类型上是 `unknown`，本文件的守卫承担两件事：
 *   ① **类型恢复**——把 `unknown` 收敛为契约声明的输入形状（Bridge 内核交付前，壳侧路由只做顶层
 *   `required` 存在性准入，见 `runtime/capability/router.ts`；越界值必须确定性拒绝，不得猜测）；
 *   ② **业务规则**——`kind`/`part`/`nodeId` 组合语义、切片结构与格式规范中的字段级规则
 *   （§5.2 规则 8：范围一致性与内容有效性属 `execute` 职责）。
 * - 结构校验只依据模型数据本身（字段形态、编号规则、唯一性、结构-内容对应关系），
 *   不调用插件代码、不解释专有字段、不做任何 `.card` / `.box` 字节解析（解析归 chips-parser）。
 */

import type { DocumentKind, DocumentPart, DocumentValue, IDocumentReadRange } from './contract.js';
import { DOCUMENT_CHANNEL_ERROR_CODES, DOCUMENT_BUSINESS_ERROR_CODES, documentError } from './errors.js';
import type { DocumentCapabilityError, IDocumentErrorDetails } from './errors.js';
import { isSafePackagePath } from './digest.js';

/** 卡片结构节点 ID / 箱子条目 ID / 稳定文档标识：10 位 Base62（`05-ID生成规范` §一、`01-卡片文件格式` §5.3、`02-箱子文件格式` §5.3）。 */
const MEMBER_ID_PATTERN = /^[0-9a-zA-Z]{10}$/;

/** 薯片标准版本号：严格三段式，禁止预发布标识与构建元数据（`01-卡片文件格式` §4.1、`02-箱子文件格式` §13.2）。 */
const STANDARDS_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/** ISO 8601 UTC 时间字符串（`01-卡片文件格式` §4.1 `created_at` / `modified_at`、`02-箱子文件格式` §13.2）。 */
const ISO_8601_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

/** 各能力输入的允许字段集合（与 `04-能力契约规范` §7.3 schema 的 `additionalProperties: false` 同口径）。 */
const ALLOWED_INPUT_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'document:open': ['source', 'kind'],
  'document:read': ['documentId', 'part', 'nodeId', 'range'],
  'document:write': ['documentId', 'part', 'nodeId', 'value'],
  'document:save': ['documentId'],
};

/** 模型切片的登记枚举（§7.3 `part` 取值）。 */
const DOCUMENT_PARTS: readonly DocumentPart[] = ['metadata', 'structure', 'content', 'entries'];

/** 判断值为非空普通对象。 */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 判断值可承载文档模型切片。 */
export function isDocumentValue(value: unknown): value is DocumentValue {
  return isPlainRecord(value) || Array.isArray(value);
}

/** 判断值为登记的模型切片名。 */
function isDocumentPart(value: unknown): value is DocumentPart {
  return DOCUMENT_PARTS.includes(value as DocumentPart);
}

/**
 * 构造 `BRIDGE_INVALID_INPUT`（不抛出：调用点以 `throw invalidInput(...)` 表达拒绝意图）。
 *
 * `details` 形状对齐 §5.4 的 `IInvalidInputDetails` 精简形态：`capabilityId` + `reason`，
 * 不含输入原文与内部路径。
 */
function invalidInput(capabilityId: string, reason: string, extra?: IDocumentErrorDetails): DocumentCapabilityError {
  return documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, {
    details: { capabilityId, reason, ...extra },
  });
}

/** 拒绝未声明字段（§6.3：内置能力 schema 一律 `additionalProperties: false`）。 */
function assertNoUndeclaredField(capabilityId: string, record: Record<string, unknown>): void {
  const allowed = ALLOWED_INPUT_FIELDS[capabilityId] ?? [];
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw invalidInput(capabilityId, `不支持的输入字段：${key}`);
    }
  }
}

/** 读取输入对象（非对象一律拒绝）。 */
function asInputRecord(capabilityId: string, input: unknown): Record<string, unknown> {
  if (!isPlainRecord(input)) {
    throw invalidInput(capabilityId, 'input 必须是对象');
  }
  assertNoUndeclaredField(capabilityId, input);
  return input;
}

/** 读取并校验 `documentId` 字段（对象形态与未声明字段已由 {@link asInputRecord} 把关）。 */
function readDocumentIdField(capabilityId: string, record: Record<string, unknown>): string {
  const documentId = record.documentId;
  if (typeof documentId !== 'string' || documentId.length === 0) {
    throw invalidInput(capabilityId, 'documentId 必须是非空字符串');
  }
  return documentId;
}

/** 读取并校验 `documentId` 输入（`document:save` 的唯一必填字段；服务侧复用同一守卫）。 */
export function requireDocumentId(capabilityId: string, input: unknown): string {
  return readDocumentIdField(capabilityId, asInputRecord(capabilityId, input));
}

/** 读取可选 `nodeId` 字段（存在即须为非空字符串）。 */
function readOptionalNodeId(capabilityId: string, record: Record<string, unknown>): string | null {
  const nodeId = record.nodeId;
  if (nodeId === undefined) {
    return null;
  }
  if (typeof nodeId !== 'string' || nodeId.length === 0) {
    throw invalidInput(capabilityId, 'nodeId 必须是非空字符串');
  }
  return nodeId;
}

/** 读取 `part` 字段（必须是登记枚举成员）。 */
function readPart(capabilityId: string, record: Record<string, unknown>): DocumentPart {
  const part = record.part;
  if (!isDocumentPart(part)) {
    throw invalidInput(capabilityId, 'part 不在登记枚举内');
  }
  return part;
}

/** `document:open` 输入守卫。 */
export function assertOpenInput(input: unknown): { source: string; kind: DocumentKind | null } {
  const record = asInputRecord('document:open', input);
  const source = record.source;
  if (typeof source !== 'string' || source.length === 0) {
    throw invalidInput('document:open', 'source 必须是非空字符串');
  }
  const kind = record.kind;
  if (kind !== undefined && kind !== 'card' && kind !== 'box') {
    throw invalidInput('document:open', 'kind 只允许 card / box');
  }
  return { source, kind: kind ?? null };
}

/** `document:read` 输入守卫。 */
export function assertReadInput(input: unknown): {
  documentId: string;
  part: DocumentPart;
  nodeId: string | null;
  range: IDocumentReadRange | null;
} {
  const capabilityId = 'document:read';
  const documentId = requireDocumentId(capabilityId, input);
  const record = input as Record<string, unknown>;
  const part = readPart(capabilityId, record);
  const nodeId = readOptionalNodeId(capabilityId, record);
  const rawRange = record.range;
  let range: IDocumentReadRange | null = null;
  if (rawRange !== undefined) {
    if (!isPlainRecord(rawRange)) {
      throw invalidInput(capabilityId, 'range 必须是对象');
    }
    const offset = rawRange.offset;
    const limit = rawRange.limit;
    if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
      throw invalidInput(capabilityId, 'range.offset 必须是非负整数');
    }
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw invalidInput(capabilityId, 'range.limit 必须在 1..1000');
    }
    range = { offset, limit };
  }
  return { documentId, part, nodeId, range };
}

/** `document:write` 输入守卫。 */
export function assertWriteInput(input: unknown): {
  documentId: string;
  part: DocumentPart;
  nodeId: string | null;
  value: DocumentValue | null;
} {
  const capabilityId = 'document:write';
  const documentId = requireDocumentId(capabilityId, input);
  const record = input as Record<string, unknown>;
  const part = readPart(capabilityId, record);
  if (!('value' in record)) {
    throw invalidInput(capabilityId, '缺少 value');
  }
  const value = record.value;
  if (value !== null && !isDocumentValue(value)) {
    throw invalidInput(capabilityId, 'value 只允许对象、数组或 null');
  }
  const nodeId = readOptionalNodeId(capabilityId, record);
  if (part !== 'content' && (nodeId !== null || value === null)) {
    throw invalidInput(capabilityId, 'nodeId 与 null 值仅适用于 content 切片');
  }
  if (nodeId !== null && !MEMBER_ID_PATTERN.test(nodeId)) {
    throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported, {
      details: { capabilityId, part, nodeId, reason: 'nodeId 不符合 10 位 Base62 成员编号' },
    });
  }
  return { documentId, part, nodeId, value };
}

/** 组合非法判定：`kind` / `part` / `nodeId` / `range` 的受支持组合（§4.3）。 */
export function assertPartCombination(
  kind: DocumentKind,
  part: DocumentPart,
  nodeId: string | null,
  range: IDocumentReadRange | null,
  capabilityId: string,
): void {
  const reason = combinationReason(kind, part, nodeId, range);
  if (reason !== null) {
    throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported, {
      details: { capabilityId, kind, part, ...(nodeId === null ? {} : { nodeId }), reason },
    });
  }
}

function combinationReason(
  kind: DocumentKind,
  part: DocumentPart,
  nodeId: string | null,
  range: IDocumentReadRange | null,
): string | null {
  if (kind === 'card' && part === 'entries') {
    return '卡片不支持 entries 切片';
  }
  if (part !== 'content' && nodeId !== null) {
    return 'nodeId 仅适用于 content 切片';
  }
  if (kind === 'card' && part === 'content' && nodeId === null) {
    return '卡片 content 切片必须携带 nodeId';
  }
  if (kind === 'box' && part === 'content' && nodeId !== null) {
    return '箱子 content 切片是布局配置，不接受 nodeId';
  }
  if (range !== null && part !== 'entries') {
    return 'range 仅适用于 entries 切片';
  }
  return null;
}

/** 读取 `DocumentValue` 中数组字段（缺失或非数组返回 `null`）。 */
export function readArrayField(value: DocumentValue, key: string): readonly unknown[] | null {
  if (Array.isArray(value)) {
    return null;
  }
  const field = (value as Record<string, unknown>)[key];
  return Array.isArray(field) ? field : null;
}

/** 读取 `DocumentValue` 中对象字段（缺失或非对象返回 `null`）。 */
function readRecordField(value: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const field = value[key];
  return isPlainRecord(field) ? field : null;
}

function invalidBusiness(
  code: typeof DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid | typeof DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid,
  reason: string,
  pointer: string,
): never {
  throw documentError(code, { details: { reason, pointer } });
}

/** 校验 10 位 Base62 标识字段（`card_id` / `box_id` / `structure[].id` / `entry_id`）。 */
function isMemberId(value: unknown): value is string {
  return typeof value === 'string' && MEMBER_ID_PATTERN.test(value);
}

/**
 * metadata 切片结构校验（§4.4：必填字段与版本字段存在；不解释扩展字段）。
 * 字段级规则取 `01-卡片文件格式` §4.1 的 schema 与 `02-箱子文件格式` §4.2、§13.2；
 * 完整 schema 校验在解析器序列化/校验侧执行，这里拦截确定性形态缺陷。
 */
export function validateMetadataSlice(kind: DocumentKind, value: DocumentValue): void {
  if (!isPlainRecord(value)) {
    invalidBusiness(DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid, 'metadata 切片必须是对象', 'metadata');
  }
  const version = value.chip_standards_version;
  if (typeof version !== 'string' || !STANDARDS_VERSION_PATTERN.test(version)) {
    invalidBusiness(
      DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid,
      'chip_standards_version 必须是严格三段式语义化版本',
      'chip_standards_version',
    );
  }
  const idKey = kind === 'card' ? 'card_id' : 'box_id';
  if (!isMemberId(value[idKey])) {
    invalidBusiness(DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid, `${idKey} 必须是 10 位 Base62 编号`, idKey);
  }
  if (typeof value.name !== 'string' || value.name.length === 0) {
    invalidBusiness(DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid, 'name 必填且为非空字符串', 'name');
  }
  for (const field of ['created_at', 'modified_at'] as const) {
    const timestamp = value[field];
    if (typeof timestamp !== 'string' || !ISO_8601_UTC_PATTERN.test(timestamp)) {
      invalidBusiness(DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid, `${field} 必须是 ISO 8601 UTC 时间字符串`, field);
    }
  }
  if (kind === 'box' && typeof value.active_layout_type !== 'string') {
    invalidBusiness(
      DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid,
      '箱子 active_layout_type 必填且为字符串',
      'active_layout_type',
    );
  }
}

/**
 * structure 切片结构校验（`01-卡片文件格式` §5.1、§5.3、`02-箱子文件格式` §5.3、§13.2）：
 * 卡片 `structure[]`（10 位编号、唯一、type 非空）与 `manifest`（`card_count` 等于结构长度、
 * `resource_count` 等于 `resources` 长度）；箱子 `entries[]`（编号唯一、`url` / `enabled` 必填）。
 */
export function validateStructureSlice(kind: DocumentKind, value: DocumentValue): void {
  if (!isPlainRecord(value)) {
    invalidBusiness(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, 'structure 切片必须是对象', 'structure');
  }
  const nodes = readArrayField(value, kind === 'card' ? 'structure' : 'entries');
  if (nodes === null) {
    invalidBusiness(
      DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid,
      kind === 'card' ? '缺少 structure 数组' : '缺少 entries 数组',
      'structure',
    );
  }
  const seen = new Set<string>();
  for (const node of nodes) {
    if (!isPlainRecord(node)) {
      invalidBusiness(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, '结构成员必须是对象', 'structure');
    }
    const id = node[kind === 'card' ? 'id' : 'entry_id'];
    if (!isMemberId(id)) {
      invalidBusiness(
        DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid,
        kind === 'card' ? 'structure[].id 必须为 10 位 Base62' : 'entry_id 必须为 10 位 Base62',
        'structure',
      );
    }
    if (seen.has(id)) {
      invalidBusiness(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, `结构成员编号重复：${id}`, 'structure');
    }
    seen.add(id);
    if (kind === 'card') {
      if (typeof node.type !== 'string' || node.type.length === 0) {
        invalidBusiness(
          DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid,
          'structure[].type 必填且为非空字符串',
          'structure',
        );
      }
      continue;
    }
    if (typeof node.url !== 'string' || node.url.length === 0) {
      invalidBusiness(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, 'entries[].url 必填且为非空字符串', 'entries');
    }
    if (typeof node.enabled !== 'boolean') {
      invalidBusiness(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, 'entries[].enabled 必填且为布尔值', 'entries');
    }
  }
  if (kind === 'box') {
    return;
  }
  const manifest = readRecordField(value, 'manifest');
  if (manifest === null) {
    invalidBusiness(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, '缺少 manifest 对象', 'manifest');
  }
  if (manifest.card_count !== nodes.length) {
    invalidBusiness(
      DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid,
      'manifest.card_count 必须等于 structure 数组长度',
      'manifest',
    );
  }
  const resources = readArrayField(manifest, 'resources');
  if (resources !== null && manifest.resource_count !== resources.length) {
    invalidBusiness(
      DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid,
      'manifest.resource_count 必须等于 manifest.resources 条目数',
      'manifest',
    );
  }
}

/** entries 切片校验（箱子条目数组；唯一性与必需字段）。 */
export function validateEntriesSlice(value: DocumentValue): void {
  if (!Array.isArray(value)) {
    invalidBusiness(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid, 'entries 切片必须是数组', 'entries');
  }
  validateStructureSlice('box', { entries: value });
}

/** 序列化产物成员路径安全校验（`11-文档服务设计` §9.2）。 */
export function assertSerializedMemberPaths(members: readonly string[]): void {
  for (const packagePath of members) {
    if (!isSafePackagePath(packagePath)) {
      invalidBusiness(
        DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid,
        `序列化产出的包内路径不安全：${packagePath}`,
        'manifest',
      );
    }
  }
}

/** 卡片结构节点 ID 集合（供结构-内容一致性核对）。 */
export function cardStructureNodeIds(structure: DocumentValue): readonly string[] {
  if (!isPlainRecord(structure)) {
    return [];
  }
  const nodes = readArrayField(structure, 'structure');
  if (nodes === null) {
    return [];
  }
  const ids: string[] = [];
  for (const node of nodes) {
    if (isPlainRecord(node) && typeof node.id === 'string') {
      ids.push(node.id);
    }
  }
  return ids;
}
