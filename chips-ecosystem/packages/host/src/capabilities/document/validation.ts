/**
 * 输入守卫与模型切片结构校验（服务职责部分）。
 *
 * 权威：`04-能力契约规范` §7.3（输入 Schema 与切片语义）、`11-文档服务设计` §4.3（read 切片
 * 规则）、§4.4（write 提交单位与结构校验）、`01-卡片文件格式` §5.3、`02-箱子文件格式` §5.3。
 *
 * @remarks
 * - JSON Schema 校验主闸在 Bridge；这里的守卫是能力实现的确定性防线（消息形状、
 *   `kind`/`part`/`nodeId` 组合、切片必填字段与结构一致性），不做插件语义解释。
 * - 结构校验只依据模型数据本身（字段形态、编号规则、唯一性、结构-内容对应关系），
 *   不调用插件代码、不解释专有字段。
 */

import type { DocumentKind, DocumentPart, DocumentValue, IDocumentReadRange } from './contract.js';
import { DOCUMENT_CHANNEL_ERROR_CODES, DOCUMENT_BUSINESS_ERROR_CODES, documentError } from './errors.js';
import type { IDocumentErrorDetails } from './errors.js';
import { isSafePackagePath } from './digest.js';

/** 卡片结构节点 ID / 箱子条目 ID：10 位 Base62（`01-卡片文件格式` §5.3、`02-箱子文件格式` §5.3）。 */
const MEMBER_ID_PATTERN = /^[0-9a-zA-Z]{10}$/;

/** 判断值为非空普通对象。 */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 判断值可承载文档模型切片。 */
export function isDocumentValue(value: unknown): value is DocumentValue {
  return isPlainRecord(value) || Array.isArray(value);
}

function invalidInput(capabilityId: string, reason: string, extra?: IDocumentErrorDetails): never {
  return documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, {
    details: { capabilityId, reason, ...extra },
  });
}

/** 读取并校验 `documentId` 字段。 */
export function requireDocumentId(capabilityId: string, input: unknown): string {
  if (!isPlainRecord(input)) {
    throw invalidInput(capabilityId, 'input 必须是对象');
  }
  const documentId = input.documentId;
  if (typeof documentId !== 'string' || documentId.length === 0) {
    throw invalidInput(capabilityId, 'documentId 必须是非空字符串');
  }
  return documentId;
}

/** `document:open` 输入守卫。 */
export function assertOpenInput(input: unknown): { source: string; kind: DocumentKind | null } {
  if (!isPlainRecord(input)) {
    throw invalidInput('document:open', 'input 必须是对象');
  }
  const source = input.source;
  if (typeof source !== 'string' || source.length === 0) {
    throw invalidInput('document:open', 'source 必须是非空字符串');
  }
  const kind = input.kind;
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
  const documentId = requireDocumentId('document:read', input);
  const record = input as Record<string, unknown>;
  const part = record.part;
  if (part !== 'metadata' && part !== 'structure' && part !== 'content' && part !== 'entries') {
    throw invalidInput('document:read', 'part 不在登记枚举内');
  }
  const nodeId = record.nodeId;
  if (nodeId !== undefined && (typeof nodeId !== 'string' || nodeId.length === 0)) {
    throw invalidInput('document:read', 'nodeId 必须是非空字符串');
  }
  const rawRange = record.range;
  let range: IDocumentReadRange | null = null;
  if (rawRange !== undefined) {
    if (!isPlainRecord(rawRange)) {
      throw invalidInput('document:read', 'range 必须是对象');
    }
    const offset = rawRange.offset;
    const limit = rawRange.limit;
    if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
      throw invalidInput('document:read', 'range.offset 必须是非负整数');
    }
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw invalidInput('document:read', 'range.limit 必须在 1..1000');
    }
    range = { offset, limit };
  }
  return { documentId, part, nodeId: nodeId ?? null, range };
}

/** `document:write` 输入守卫。 */
export function assertWriteInput(input: unknown): {
  documentId: string;
  part: DocumentPart;
  nodeId: string | null;
  value: DocumentValue | null;
} {
  const documentId = requireDocumentId('document:write', input);
  const record = input as Record<string, unknown>;
  const part = record.part;
  if (part !== 'metadata' && part !== 'structure' && part !== 'content' && part !== 'entries') {
    throw invalidInput('document:write', 'part 不在登记枚举内');
  }
  if (!('value' in record)) {
    throw invalidInput('document:write', '缺少 value');
  }
  const value = record.value;
  if (value !== null && !isDocumentValue(value)) {
    throw invalidInput('document:write', 'value 只允许对象、数组或 null');
  }
  const nodeId = record.nodeId;
  if (nodeId !== undefined && (typeof nodeId !== 'string' || nodeId.length === 0)) {
    throw invalidInput('document:write', 'nodeId 必须是非空字符串');
  }
  if (part !== 'content' && (nodeId !== undefined || value === null)) {
    throw invalidInput('document:write', 'nodeId 与 null 值仅适用于 content 切片');
  }
  if (typeof nodeId === 'string' && !MEMBER_ID_PATTERN.test(nodeId)) {
    throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported, {
      details: { capabilityId: 'document:write', part, nodeId, reason: 'nodeId 不符合 10 位 Base62 成员编号' },
    });
  }
  return { documentId, part, nodeId: nodeId ?? null, value: value ?? null };
}

/** 组合非法判定：`kind` / `part` / `nodeId` / `range` 的受支持组合（§4.3）。 */
export function assertPartCombination(
  kind: DocumentKind,
  part: DocumentPart,
  nodeId: string | null,
  range: IDocumentReadRange | null,
  capabilityId: string
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
  range: IDocumentReadRange | null
): string | null {
  if (kind === 'card' && part === 'entries') {
    return '卡片不支持 entries 切片';
  }
  if (kind === 'card' && part === 'content' && nodeId === null) {
    return '卡片 content 切片必须携带 nodeId';
  }
  if (kind === 'box' && part === 'content' && nodeId !== null) {
    return '箱子 content 切片是布局配置，不接受 nodeId';
  }
  if (kind === 'box' && (part === 'metadata' || part === 'structure' || part === 'content') && nodeId !== null) {
    return '箱子该切片不接受 nodeId';
  }
  if (range !== null && part !== 'entries') {
    return 'range 仅适用于 entries 切片';
  }
  if (kind === 'card' && part === 'metadata' && nodeId !== null) {
    return '卡片 metadata 切片不接受 nodeId';
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

function invalidBusiness(code: 'metadataInvalid' | 'structureInvalid', reason: string, pointer: string): never {
  const errorCodes =
    code === 'metadataInvalid' ? DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid : DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid;
  throw documentError(errorCodes, { details: { reason, pointer } });
}

/**
 * metadata 切片结构校验（§4.4：必填字段与版本字段存在；不解释扩展字段）。
 * 完整 schema 校验在解析器序列化/校验侧执行，这里拦截确定性形态缺陷。
 */
export function validateMetadataSlice(kind: DocumentKind, value: DocumentValue): void {
  if (!isPlainRecord(value)) {
    invalidBusiness('metadataInvalid', 'metadata 切片必须是对象', 'metadata');
  }
  if (typeof value.chip_standards_version !== 'string' || value.chip_standards_version.length === 0) {
    invalidBusiness('metadataInvalid', 'chip_standards_version 必填且为非空字符串', 'chip_standards_version');
  }
  const idKey = kind === 'card' ? 'card_id' : 'box_id';
  if (typeof value[idKey] !== 'string' || (value[idKey] as string).length === 0) {
    invalidBusiness('metadataInvalid', `${idKey} 必填且为非空字符串`, idKey);
  }
  if (typeof value.name !== 'string' || value.name.length === 0) {
    invalidBusiness('metadataInvalid', 'name 必填且为非空字符串', 'name');
  }
  if (typeof value.created_at !== 'string' || typeof value.modified_at !== 'string') {
    invalidBusiness('metadataInvalid', 'created_at 与 modified_at 必填且为字符串', 'created_at');
  }
  if (kind === 'box' && typeof value.active_layout_type !== 'string') {
    invalidBusiness('metadataInvalid', '箱子 active_layout_type 必填且为字符串', 'active_layout_type');
  }
}

/**
 * structure 切片结构校验：卡片 `structure[]`（10 位编号、唯一、type 非空）与
 * `manifest.card_count` 一致性；箱子 `entries[]`（编号唯一、`url` / `enabled` 必填）。
 */
export function validateStructureSlice(kind: DocumentKind, value: DocumentValue): void {
  if (!isPlainRecord(value)) {
    invalidBusiness('structureInvalid', 'structure 切片必须是对象', 'structure');
  }
  const nodes = readArrayField(value, kind === 'card' ? 'structure' : 'entries');
  if (nodes === null) {
    invalidBusiness('structureInvalid', kind === 'card' ? '缺少 structure 数组' : '缺少 entries 数组', 'structure');
  }
  const seen = new Set<string>();
  for (const node of nodes) {
    if (!isPlainRecord(node)) {
      invalidBusiness('structureInvalid', '结构成员必须是对象', 'structure');
    }
    const id = kind === 'card' ? node.id : node.entry_id;
    if (typeof id !== 'string' || !MEMBER_ID_PATTERN.test(id)) {
      invalidBusiness('structureInvalid', kind === 'card' ? 'structure[].id 必须为 10 位 Base62' : 'entry_id 必须为 10 位 Base62', 'structure');
    }
    if (seen.has(id)) {
      invalidBusiness('structureInvalid', `结构成员编号重复：${id}`, 'structure');
    }
    seen.add(id);
    if (kind === 'card' && typeof node.type !== 'string') {
      invalidBusiness('structureInvalid', 'structure[].type 必填且为字符串', 'structure');
    }
    if (kind === 'box') {
      if (typeof node.url !== 'string' || node.url.length === 0) {
        invalidBusiness('structureInvalid', 'entries[].url 必填且为非空字符串', 'entries');
      }
      if (typeof node.enabled !== 'boolean') {
        invalidBusiness('structureInvalid', 'entries[].enabled 必填且为布尔值', 'entries');
      }
    }
  }
  if (kind === 'box') {
    return;
  }
  const manifest = value.manifest;
  if (isPlainRecord(manifest) && manifest.card_count !== nodes.length) {
    invalidBusiness('structureInvalid', 'manifest.card_count 必须等于 structure 数组长度', 'manifest');
  }
}

/** entries 切片校验（箱子条目数组；唯一性与必需字段）。 */
export function validateEntriesSlice(value: DocumentValue): void {
  if (!Array.isArray(value)) {
    invalidBusiness('structureInvalid', 'entries 切片必须是数组', 'entries');
  }
  validateStructureSlice('box', { entries: value });
}

/** 序列化产物成员路径安全校验（`11-文档服务设计` §9.2）。 */
export function assertSerializedMemberPaths(members: readonly string[]): void {
  for (const packagePath of members) {
    if (!isSafePackagePath(packagePath)) {
      invalidBusiness('structureInvalid', `序列化产出的包内路径不安全：${packagePath}`, 'manifest');
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
