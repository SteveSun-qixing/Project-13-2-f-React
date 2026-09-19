/**
 * JSON Schema Draft 2020-12 平台子集的编译（02-Bridge三层设计 §6.1、04-能力契约规范 §5.1）。
 *
 * - schema 必须离线可编译：禁止远程 `$ref`、网络加载与自定义脚本关键字；`$ref` 只允许 `#/$defs/<name>`；
 * - 编译失败返回 `BRIDGE_INVALID_SCHEMA`，注册期拒绝；
 * - 编译缓存以内容 SHA-256 为键，默认上限 256 条，按 LRU 淘汰。
 */

import { BRIDGE_ERROR_CODES, ChipsError } from '../protocol/errors.js';
import type { IBinaryFieldDescriptor } from '../protocol/envelope.js';
import { canonicalizeJson, sha256Hex } from './digest.js';
import { ALLOWED_KEYWORDS, FORBIDDEN_KEYWORDS, FORMAT_WHITELIST, TYPE_NAMES } from './keywords.js';
import {
  escapePointerSegment,
  validateCompiled,
  type ICompiledSchemaNode,
  type IValidateOptions,
  type IValidationResult,
} from './validate.js';

export interface ICompiledSchema {
  /** schema 内容摘要（SHA-256，十六进制）。 */
  readonly digest: string;
  readonly root: ICompiledSchemaNode;
  /** `x-chips-binary` 字段描述符（按声明顺序；pointer 为输入侧 JSON Pointer）。 */
  readonly binaryFields: readonly IBinaryFieldDescriptor[];
  /** 校验输入；不修改输入、不填充默认值。 */
  validate(value: unknown, options?: IValidateOptions): IValidationResult;
}

export interface ISchemaCompiler {
  compile(schema: unknown): ICompiledSchema;
  /** 当前缓存条数。 */
  readonly size: number;
}

export interface ISchemaCompilerOptions {
  /** 编译缓存上限，默认 256（02-Bridge三层设计 §6.2）。 */
  readonly maxCacheEntries?: number;
}

const DEFAULT_MAX_CACHE_ENTRIES = 256;

type MutableNode = { -readonly [K in keyof ICompiledSchemaNode]: ICompiledSchemaNode[K] };

interface IBuildContext {
  readonly defs: ReadonlyMap<string, unknown>;
  readonly refStack: readonly string[];
  readonly binaryFields: IBinaryFieldDescriptor[];
}

function invalidSchema(message: string, details: Record<string, unknown>): ChipsError {
  return new ChipsError({
    code: BRIDGE_ERROR_CODES.invalidSchema,
    message,
    details,
    retryable: false,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildStringArray(value: unknown, keyword: string, schemaPath: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw invalidSchema(`关键字 ${keyword} 必须为字符串数组`, { schemaPath, keyword });
  }
  return [...(value as string[])];
}

function buildSchemaArray(
  value: unknown,
  keyword: string,
  inputPointer: string,
  schemaPath: string,
  ctx: IBuildContext
): readonly ICompiledSchemaNode[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalidSchema(`关键字 ${keyword} 必须为非空 schema 数组`, { schemaPath, keyword });
  }
  return value.map((item, index) =>
    buildNode(item, inputPointer, `${schemaPath}/${keyword}/${String(index)}`, false, ctx)
  );
}

function buildProperties(
  value: unknown,
  inputPointer: string,
  schemaPath: string,
  ctx: IBuildContext
): ReadonlyMap<string, ICompiledSchemaNode> {
  if (!isRecord(value)) {
    throw invalidSchema('关键字 properties 必须为对象', { schemaPath, keyword: 'properties' });
  }
  const result = new Map<string, ICompiledSchemaNode>();
  for (const [key, child] of Object.entries(value)) {
    result.set(
      key,
      buildNode(
        child,
        `${inputPointer}/${escapePointerSegment(key)}`,
        `${schemaPath}/properties/${key}`,
        true,
        ctx
      )
    );
  }
  return result;
}

function buildNode(
  raw: unknown,
  inputPointer: string,
  schemaPath: string,
  inProperty: boolean,
  ctx: IBuildContext
): ICompiledSchemaNode {
  if (!isRecord(raw)) {
    throw invalidSchema('schema 必须为对象', { schemaPath });
  }
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_KEYWORDS.has(key)) {
      throw invalidSchema(`不支持的关键字：${key}`, { schemaPath, keyword: key });
    }
    if (!ALLOWED_KEYWORDS.has(key)) {
      throw invalidSchema(`未知关键字：${key}`, { schemaPath, keyword: key });
    }
  }
  if (raw.$ref !== undefined) {
    const ref = raw.$ref;
    if (typeof ref !== 'string' || !ref.startsWith('#/$defs/')) {
      throw invalidSchema('$ref 只允许 #/$defs/<name> 形式', { schemaPath, keyword: '$ref' });
    }
    if (Object.keys(raw).some((key) => key !== '$ref')) {
      throw invalidSchema('$ref 不允许与其他关键字并列', { schemaPath, keyword: '$ref' });
    }
    const name = ref.slice('#/$defs/'.length);
    if (name.length === 0 || name.includes('/')) {
      throw invalidSchema('$ref 目标名不合法', { schemaPath, keyword: '$ref' });
    }
    if (ctx.refStack.includes(name)) {
      throw invalidSchema('$ref 不允许递归引用', { schemaPath, keyword: '$ref' });
    }
    const target = ctx.defs.get(name);
    if (target === undefined) {
      throw invalidSchema('$ref 目标不可解析', { schemaPath, keyword: '$ref' });
    }
    return buildNode(target, inputPointer, `${schemaPath}/$ref:${name}`, inProperty, {
      ...ctx,
      refStack: [...ctx.refStack, name],
    });
  }

  const types: string[] = [];
  if (raw.type !== undefined) {
    const rawTypes = Array.isArray(raw.type) ? raw.type : [raw.type];
    if (rawTypes.length === 0) {
      throw invalidSchema('type 不允许为空数组', { schemaPath, keyword: 'type' });
    }
    for (const type of rawTypes) {
      if (typeof type !== 'string' || !TYPE_NAMES.has(type)) {
        throw invalidSchema('type 取值不合法', { schemaPath, keyword: 'type' });
      }
      if (types.includes(type)) {
        throw invalidSchema('type 不允许重复', { schemaPath, keyword: 'type' });
      }
      types.push(type);
    }
  }

  const required =
    raw.required === undefined ? [] : buildStringArray(raw.required, 'required', schemaPath);
  if (new Set(required).size !== required.length) {
    throw invalidSchema('required 不允许重复', { schemaPath, keyword: 'required' });
  }

  const lengthKeywords: readonly [string, unknown][] = [
    ['minItems', raw.minItems],
    ['maxItems', raw.maxItems],
    ['minProperties', raw.minProperties],
    ['maxProperties', raw.maxProperties],
    ['minLength', raw.minLength],
    ['maxLength', raw.maxLength],
  ];
  for (const [keyword, value] of lengthKeywords) {
    if (
      value !== undefined &&
      (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    ) {
      throw invalidSchema(`关键字 ${keyword} 必须为非负整数`, { schemaPath, keyword });
    }
  }
  if (
    typeof raw.minItems === 'number' &&
    typeof raw.maxItems === 'number' &&
    raw.minItems > raw.maxItems
  ) {
    throw invalidSchema('minItems 不得大于 maxItems', { schemaPath, keyword: 'minItems' });
  }
  if (
    typeof raw.minProperties === 'number' &&
    typeof raw.maxProperties === 'number' &&
    raw.minProperties > raw.maxProperties
  ) {
    throw invalidSchema('minProperties 不得大于 maxProperties', {
      schemaPath,
      keyword: 'minProperties',
    });
  }
  if (
    typeof raw.minLength === 'number' &&
    typeof raw.maxLength === 'number' &&
    raw.minLength > raw.maxLength
  ) {
    throw invalidSchema('minLength 不得大于 maxLength', { schemaPath, keyword: 'minLength' });
  }
  if (raw.uniqueItems !== undefined && typeof raw.uniqueItems !== 'boolean') {
    throw invalidSchema('uniqueItems 必须为布尔值', { schemaPath, keyword: 'uniqueItems' });
  }

  for (const keyword of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'] as const) {
    const value = raw[keyword];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw invalidSchema(`关键字 ${keyword} 必须为有限数值`, { schemaPath, keyword });
    }
  }
  if (raw.multipleOf !== undefined) {
    if (
      typeof raw.multipleOf !== 'number' ||
      !Number.isFinite(raw.multipleOf) ||
      raw.multipleOf <= 0
    ) {
      throw invalidSchema('multipleOf 必须为正数', { schemaPath, keyword: 'multipleOf' });
    }
  }

  let pattern: RegExp | undefined;
  if (raw.pattern !== undefined) {
    if (typeof raw.pattern !== 'string') {
      throw invalidSchema('pattern 必须为字符串', { schemaPath, keyword: 'pattern' });
    }
    try {
      pattern = new RegExp(raw.pattern);
    } catch {
      throw invalidSchema('pattern 不是合法正则表达式', { schemaPath, keyword: 'pattern' });
    }
  }

  if (raw.format !== undefined) {
    if (typeof raw.format !== 'string' || !FORMAT_WHITELIST.has(raw.format)) {
      throw invalidSchema('format 不在白名单内', { schemaPath, keyword: 'format' });
    }
  }

  let enumValues: readonly unknown[] | undefined;
  if (raw.enum !== undefined) {
    if (!Array.isArray(raw.enum) || raw.enum.length === 0) {
      throw invalidSchema('enum 必须为非空数组', { schemaPath, keyword: 'enum' });
    }
    enumValues = [...(raw.enum as unknown[])];
  }
  const hasConst = raw.const !== undefined;

  let binary: { readonly maxBytes?: number } | undefined;
  if (raw['x-chips-binary'] !== undefined) {
    if (!inProperty) {
      throw invalidSchema('x-chips-binary 只允许声明在属性 schema 上', {
        schemaPath,
        keyword: 'x-chips-binary',
      });
    }
    if (raw.type !== undefined) {
      throw invalidSchema('带 x-chips-binary 的属性不得再声明 type', {
        schemaPath,
        keyword: 'x-chips-binary',
      });
    }
    const maxBytes = raw['x-chips-binary'];
    const validMaxBytes =
      maxBytes === true ||
      (typeof maxBytes === 'number' && Number.isFinite(maxBytes) && maxBytes >= 0);
    if (!validMaxBytes) {
      throw invalidSchema('x-chips-binary 必须为布尔 true 或非负数值', {
        schemaPath,
        keyword: 'x-chips-binary',
      });
    }
    binary = typeof maxBytes === 'number' ? { maxBytes } : {};
    ctx.binaryFields.push(
      typeof maxBytes === 'number' ? { pointer: inputPointer, maxBytes } : { pointer: inputPointer }
    );
  }

  const node: MutableNode = { required };
  if (types.length > 0) node.types = types;
  if (raw.properties !== undefined) {
    node.properties = buildProperties(raw.properties, inputPointer, schemaPath, ctx);
  }
  if (raw.additionalProperties === false) {
    node.additionalProperties = false;
  } else if (raw.additionalProperties !== undefined && raw.additionalProperties !== true) {
    node.additionalProperties = buildNode(
      raw.additionalProperties,
      inputPointer,
      `${schemaPath}/additionalProperties`,
      false,
      ctx
    );
  }
  if (raw.items !== undefined) {
    node.items = buildNode(raw.items, `${inputPointer}/*`, `${schemaPath}/items`, false, ctx);
  }
  if (raw.propertyNames !== undefined) {
    node.propertyNames = buildNode(
      raw.propertyNames,
      inputPointer,
      `${schemaPath}/propertyNames`,
      false,
      ctx
    );
  }
  if (typeof raw.minItems === 'number') node.minItems = raw.minItems;
  if (typeof raw.maxItems === 'number') node.maxItems = raw.maxItems;
  if (typeof raw.uniqueItems === 'boolean') node.uniqueItems = raw.uniqueItems;
  if (typeof raw.minProperties === 'number') node.minProperties = raw.minProperties;
  if (typeof raw.maxProperties === 'number') node.maxProperties = raw.maxProperties;
  if (typeof raw.minLength === 'number') node.minLength = raw.minLength;
  if (typeof raw.maxLength === 'number') node.maxLength = raw.maxLength;
  if (pattern !== undefined) node.pattern = pattern;
  if (typeof raw.minimum === 'number') node.minimum = raw.minimum;
  if (typeof raw.maximum === 'number') node.maximum = raw.maximum;
  if (typeof raw.exclusiveMinimum === 'number') node.exclusiveMinimum = raw.exclusiveMinimum;
  if (typeof raw.exclusiveMaximum === 'number') node.exclusiveMaximum = raw.exclusiveMaximum;
  if (typeof raw.multipleOf === 'number') node.multipleOf = raw.multipleOf;
  if (enumValues !== undefined) node.enumValues = enumValues;
  if (hasConst) {
    node.hasConst = true;
    node.constValue = raw.const;
  }
  if (raw.allOf !== undefined) {
    node.allOf = buildSchemaArray(raw.allOf, 'allOf', inputPointer, schemaPath, ctx);
  }
  if (raw.anyOf !== undefined) {
    node.anyOf = buildSchemaArray(raw.anyOf, 'anyOf', inputPointer, schemaPath, ctx);
  }
  if (raw.oneOf !== undefined) {
    node.oneOf = buildSchemaArray(raw.oneOf, 'oneOf', inputPointer, schemaPath, ctx);
  }
  if (typeof raw.format === 'string') node.format = raw.format;
  if (binary !== undefined) node.binary = binary;
  return node;
}

function collectDefs(raw: Record<string, unknown>): ReadonlyMap<string, unknown> {
  if (raw.$defs === undefined) {
    return new Map<string, unknown>();
  }
  if (!isRecord(raw.$defs)) {
    throw invalidSchema('$defs 必须为对象', { keyword: '$defs' });
  }
  return new Map<string, unknown>(Object.entries(raw.$defs));
}

function assertTopLevelObject(raw: Record<string, unknown>): void {
  if (raw.type !== 'object') {
    throw invalidSchema('能力输入 schema 顶层必须为 type: object', { keyword: 'type' });
  }
  if (raw.additionalProperties !== false) {
    throw invalidSchema('能力输入 schema 顶层必须显式声明 additionalProperties: false', {
      keyword: 'additionalProperties',
    });
  }
}

function compileUncached(schema: unknown, digest: string): ICompiledSchema {
  if (!isRecord(schema)) {
    throw invalidSchema('schema 必须为对象', {});
  }
  assertTopLevelObject(schema);
  const defs = collectDefs(schema);
  const binaryFields: IBinaryFieldDescriptor[] = [];
  const ctx: IBuildContext = { defs, refStack: [], binaryFields };
  for (const [name, definition] of defs) {
    const scratchFields: IBinaryFieldDescriptor[] = [];
    buildNode(definition, '', `$defs/${name}`, false, {
      defs,
      refStack: [name],
      binaryFields: scratchFields,
    });
  }
  const root = buildNode(schema, '', '', false, ctx);
  return {
    digest,
    root,
    binaryFields,
    validate(value: unknown, validateOptions: IValidateOptions = {}): IValidationResult {
      return validateCompiled(root, value, validateOptions);
    },
  };
}

/** 创建带 LRU 编译缓存的 Schema 编译器。 */
export function createSchemaCompiler(options: ISchemaCompilerOptions = {}): ISchemaCompiler {
  const maxEntries = options.maxCacheEntries ?? DEFAULT_MAX_CACHE_ENTRIES;
  if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
    throw new Error('maxCacheEntries 必须为正整数');
  }
  const cache = new Map<string, ICompiledSchema>();
  return {
    compile(schema: unknown): ICompiledSchema {
      const digest = sha256Hex(canonicalizeJson(schema));
      const cached = cache.get(digest);
      if (cached !== undefined) {
        cache.delete(digest);
        cache.set(digest, cached);
        return cached;
      }
      const compiled = compileUncached(schema, digest);
      cache.set(digest, compiled);
      if (cache.size > maxEntries) {
        const oldest = cache.keys().next();
        if (oldest.done !== true) {
          cache.delete(oldest.value);
        }
      }
      return compiled;
    },
    get size(): number {
      return cache.size;
    },
  };
}
