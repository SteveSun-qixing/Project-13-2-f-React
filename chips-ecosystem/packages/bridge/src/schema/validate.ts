/**
 * 编译后 Schema 的校验执行（02-Bridge三层设计 §6、04-能力契约规范 §5.4）。
 *
 * 错误聚合规则：按 JSON Pointer 字典序升序；最多返回 16 条；超出时截断并置 `truncated: true`。
 * `details` 不包含用户输入原文、凭证材料与内部路径；`message` 一律简体中文。
 */

import { canonicalizeJson } from './digest.js';
import { checkFormat } from './formats.js';

export interface IValidationIssue {
  /** JSON Pointer，指向输入中的失败位置。 */
  pointer: string;
  keyword: string;
  message: string;
}

export interface IValidationResult {
  valid: boolean;
  issues: readonly IValidationIssue[];
  truncated: boolean;
}

/** 编译后的 Schema 节点（`$ref` 在编译期展开；无运行时编译）。 */
export interface ICompiledSchemaNode {
  readonly types?: readonly string[];
  readonly properties?: ReadonlyMap<string, ICompiledSchemaNode>;
  readonly required: readonly string[];
  readonly additionalProperties?: ICompiledSchemaNode | false;
  readonly items?: ICompiledSchemaNode;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly minProperties?: number;
  readonly maxProperties?: number;
  readonly propertyNames?: ICompiledSchemaNode;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: RegExp;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly multipleOf?: number;
  readonly enumValues?: readonly unknown[];
  readonly hasConst?: boolean;
  readonly constValue?: unknown;
  readonly allOf?: readonly ICompiledSchemaNode[];
  readonly anyOf?: readonly ICompiledSchemaNode[];
  readonly oneOf?: readonly ICompiledSchemaNode[];
  readonly format?: string;
  readonly binary?: { readonly maxBytes?: number };
}

/** 最多返回的问题条数（04-能力契约规范 §5.4）。 */
export const MAX_REPORTED_ISSUES = 16;

const MAX_COLLECTED_ISSUES = 64;

interface IValidationContext {
  issues: IValidationIssue[];
  truncated: boolean;
  bin?: ReadonlyMap<string, Uint8Array>;
  referencedBinKeys: Set<string>;
}

export interface IValidateOptions {
  /** 二进制表；提供时对 `x-chips-binary` 字段执行键存在与字节上限校验。 */
  bin?: ReadonlyMap<string, Uint8Array>;
}

export function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function push(ctx: IValidationContext, pointer: string, keyword: string, message: string): void {
  if (ctx.issues.length >= MAX_COLLECTED_ISSUES) {
    ctx.truncated = true;
    return;
  }
  ctx.issues.push({ pointer, keyword, message });
}

function isPlainObjectValue(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Uint8Array) &&
    !(value instanceof ArrayBuffer)
  );
}

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case 'object':
      return isPlainObjectValue(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return false;
  }
}

function typeLabel(types: readonly string[]): string {
  const labels: Readonly<Record<string, string>> = {
    object: '对象',
    array: '数组',
    string: '字符串',
    number: '数值',
    integer: '整数',
    boolean: '布尔值',
    null: '空值',
  };
  return types.map((type) => labels[type] ?? type).join(' / ');
}

function deepEqual(left: unknown, right: unknown): boolean {
  return canonicalizeJson(left) === canonicalizeJson(right);
}

function validateCombinators(
  node: ICompiledSchemaNode,
  value: unknown,
  pointer: string,
  ctx: IValidationContext
): void {
  if (node.allOf !== undefined) {
    for (const branch of node.allOf) {
      validateNode(branch, value, pointer, ctx);
    }
  }
  if (node.anyOf !== undefined) {
    const matched = node.anyOf.some((branch) => countIssues(branch, value, pointer, ctx) === 0);
    if (!matched) {
      push(ctx, pointer, 'anyOf', '不满足组合约束 anyOf');
    }
  }
  if (node.oneOf !== undefined) {
    let matched = 0;
    for (const branch of node.oneOf) {
      if (countIssues(branch, value, pointer, ctx) === 0) {
        matched += 1;
      }
    }
    if (matched !== 1) {
      push(ctx, pointer, 'oneOf', '必须恰好满足一个 oneOf 子 schema');
    }
  }
}

function countIssues(
  node: ICompiledSchemaNode,
  value: unknown,
  pointer: string,
  parent: IValidationContext
): number {
  const sub: IValidationContext = {
    issues: [],
    truncated: false,
    referencedBinKeys: parent.referencedBinKeys,
    ...(parent.bin !== undefined ? { bin: parent.bin } : {}),
  };
  validateNode(node, value, pointer, sub);
  if (sub.issues.length > 0) {
    parent.truncated = parent.truncated || sub.truncated;
  }
  return sub.issues.length;
}

function validateStringValue(
  node: ICompiledSchemaNode,
  value: string,
  pointer: string,
  ctx: IValidationContext
): void {
  const length = [...value].length;
  if (node.minLength !== undefined && length < node.minLength) {
    push(ctx, pointer, 'minLength', `长度不得小于 ${String(node.minLength)}`);
  }
  if (node.maxLength !== undefined && length > node.maxLength) {
    push(ctx, pointer, 'maxLength', `长度不得大于 ${String(node.maxLength)}`);
  }
  if (node.pattern !== undefined && !node.pattern.test(value)) {
    push(ctx, pointer, 'pattern', '字符串格式不符合要求');
  }
  if (node.format !== undefined && !checkFormat(node.format, value)) {
    push(ctx, pointer, 'format', '字符串格式不合法');
  }
}

function validateNumberValue(
  node: ICompiledSchemaNode,
  value: number,
  pointer: string,
  ctx: IValidationContext
): void {
  if (node.minimum !== undefined && value < node.minimum) {
    push(ctx, pointer, 'minimum', `数值不得小于 ${String(node.minimum)}`);
  }
  if (node.maximum !== undefined && value > node.maximum) {
    push(ctx, pointer, 'maximum', `数值不得大于 ${String(node.maximum)}`);
  }
  if (node.exclusiveMinimum !== undefined && value <= node.exclusiveMinimum) {
    push(ctx, pointer, 'exclusiveMinimum', `数值必须大于 ${String(node.exclusiveMinimum)}`);
  }
  if (node.exclusiveMaximum !== undefined && value >= node.exclusiveMaximum) {
    push(ctx, pointer, 'exclusiveMaximum', `数值必须小于 ${String(node.exclusiveMaximum)}`);
  }
  if (node.multipleOf !== undefined && node.multipleOf > 0) {
    const quotient = value / node.multipleOf;
    if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
      push(ctx, pointer, 'multipleOf', `数值必须为 ${String(node.multipleOf)} 的整数倍`);
    }
  }
}

function validateObjectValue(
  node: ICompiledSchemaNode,
  value: Record<string, unknown>,
  pointer: string,
  ctx: IValidationContext
): void {
  const keys = Object.keys(value);
  if (node.minProperties !== undefined && keys.length < node.minProperties) {
    push(ctx, pointer, 'minProperties', `字段数量不得少于 ${String(node.minProperties)}`);
  }
  if (node.maxProperties !== undefined && keys.length > node.maxProperties) {
    push(ctx, pointer, 'maxProperties', `字段数量不得多于 ${String(node.maxProperties)}`);
  }
  for (const requiredKey of node.required) {
    if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) {
      push(
        ctx,
        `${pointer}/${escapePointerSegment(requiredKey)}`,
        'required',
        `缺少必填字段：${requiredKey}`
      );
    }
  }
  if (node.propertyNames !== undefined) {
    for (const key of keys) {
      const sub: IValidationContext = {
        issues: [],
        truncated: false,
        referencedBinKeys: ctx.referencedBinKeys,
        ...(ctx.bin !== undefined ? { bin: ctx.bin } : {}),
      };
      validateNode(node.propertyNames, key, `${pointer}/${escapePointerSegment(key)}`, sub);
      for (const issue of sub.issues) {
        push(ctx, issue.pointer, 'propertyNames', '字段名不合法');
      }
    }
  }
  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}/${escapePointerSegment(key)}`;
    const propertyNode = node.properties?.get(key);
    if (propertyNode !== undefined) {
      validateNode(propertyNode, child, childPointer, ctx);
      continue;
    }
    if (node.additionalProperties === false) {
      push(ctx, childPointer, 'additionalProperties', '不允许未声明字段');
      continue;
    }
    if (node.additionalProperties !== undefined) {
      validateNode(node.additionalProperties, child, childPointer, ctx);
    }
  }
}

function validateArrayValue(
  node: ICompiledSchemaNode,
  value: readonly unknown[],
  pointer: string,
  ctx: IValidationContext
): void {
  if (node.minItems !== undefined && value.length < node.minItems) {
    push(ctx, pointer, 'minItems', `元素数量不得少于 ${String(node.minItems)}`);
  }
  if (node.maxItems !== undefined && value.length > node.maxItems) {
    push(ctx, pointer, 'maxItems', `元素数量不得多于 ${String(node.maxItems)}`);
  }
  if (node.uniqueItems === true) {
    const seen = new Set<string>();
    value.forEach((item, index) => {
      const key = canonicalizeJson(item);
      if (seen.has(key)) {
        push(ctx, `${pointer}/${String(index)}`, 'uniqueItems', '数组元素不得重复');
      }
      seen.add(key);
    });
  }
  if (node.items !== undefined) {
    value.forEach((item, index) => {
      validateNode(node.items as ICompiledSchemaNode, item, `${pointer}/${String(index)}`, ctx);
    });
  }
}

function validateBinaryValue(
  node: ICompiledSchemaNode,
  value: unknown,
  pointer: string,
  ctx: IValidationContext
): void {
  const binary = node.binary;
  if (binary === undefined) {
    return;
  }
  if (typeof value !== 'string') {
    push(ctx, pointer, 'x-chips-binary', '二进制字段必须为二进制表键');
    return;
  }
  if (ctx.bin === undefined) {
    return;
  }
  const bytes = ctx.bin.get(value);
  if (bytes === undefined) {
    push(ctx, pointer, 'x-chips-binary', '缺少对应的二进制数据');
    return;
  }
  ctx.referencedBinKeys.add(value);
  if (binary.maxBytes !== undefined && bytes.byteLength > binary.maxBytes) {
    push(ctx, pointer, 'x-chips-binary', `二进制数据不得超过 ${String(binary.maxBytes)} 字节`);
  }
}

/** 校验编译后的 Schema 节点；输入值不被修改（不做默认值填充与类型转换）。 */
export function validateNode(
  node: ICompiledSchemaNode,
  value: unknown,
  pointer: string,
  ctx: IValidationContext
): void {
  if (node.types !== undefined && !node.types.some((type) => matchesType(value, type))) {
    push(ctx, pointer, 'type', `类型必须为${typeLabel(node.types)}`);
    return;
  }
  if (node.binary !== undefined) {
    validateBinaryValue(node, value, pointer, ctx);
    return;
  }
  if (node.hasConst === true && !deepEqual(value, node.constValue)) {
    push(ctx, pointer, 'const', '值必须为指定常量');
  }
  if (node.enumValues !== undefined && !node.enumValues.some((item) => deepEqual(item, value))) {
    push(ctx, pointer, 'enum', '枚举值不合法');
  }
  if (typeof value === 'string') {
    validateStringValue(node, value, pointer, ctx);
  } else if (typeof value === 'number') {
    validateNumberValue(node, value, pointer, ctx);
  } else if (isPlainObjectValue(value)) {
    validateObjectValue(node, value, pointer, ctx);
  } else if (Array.isArray(value)) {
    validateArrayValue(node, value, pointer, ctx);
  }
  validateCombinators(node, value, pointer, ctx);
}

/** 执行完整校验并聚合错误（排序、截断）。 */
export function validateCompiled(
  root: ICompiledSchemaNode,
  value: unknown,
  options: IValidateOptions = {}
): IValidationResult {
  const ctx: IValidationContext = {
    issues: [],
    truncated: false,
    referencedBinKeys: new Set<string>(),
    ...(options.bin !== undefined ? { bin: options.bin } : {}),
  };
  validateNode(root, value, '', ctx);
  if (options.bin !== undefined) {
    for (const key of options.bin.keys()) {
      if (!ctx.referencedBinKeys.has(key)) {
        push(ctx, '', 'x-chips-binary', '包含未使用的二进制条目');
      }
    }
  }
  const sorted = [...ctx.issues].sort((left, right) =>
    left.pointer < right.pointer ? -1 : left.pointer > right.pointer ? 1 : 0
  );
  const truncated = ctx.truncated || sorted.length > MAX_REPORTED_ISSUES;
  return {
    valid: ctx.issues.length === 0,
    issues: sorted.slice(0, MAX_REPORTED_ISSUES),
    truncated,
  };
}
