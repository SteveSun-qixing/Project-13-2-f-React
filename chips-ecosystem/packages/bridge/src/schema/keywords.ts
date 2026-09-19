/**
 * JSON Schema Draft 2020-12 平台子集：允许/禁止关键字与 format 白名单（04-能力契约规范 §5）。
 */

/** 允许的关键字（04-能力契约规范 §5.1）。 */
export const ALLOWED_KEYWORDS: ReadonlySet<string> = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
  'propertyNames',
  '$defs',
  '$ref',
  'allOf',
  'anyOf',
  'oneOf',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'enum',
  'const',
  'title',
  'description',
  'default',
  'deprecated',
  'format',
  'x-chips-binary',
]);

/** 禁止的关键字：出现即编译失败（`BRIDGE_INVALID_SCHEMA`）。 */
export const FORBIDDEN_KEYWORDS: ReadonlySet<string> = new Set([
  '$id',
  '$schema',
  'if',
  'then',
  'else',
  'dependentSchemas',
  'dependencies',
  'patternProperties',
  'unevaluatedProperties',
  'unevaluatedItems',
  'contains',
  'minContains',
  'maxContains',
  'prefixItems',
]);

/** 强制语义 format 白名单；未列入白名单的标准 format 仅作注解、不做强制校验。 */
export const FORMAT_WHITELIST: ReadonlySet<string> = new Set([
  'date-time',
  'uri',
  'chips-resource-uri',
  'chips-credential',
]);

/** JSON Schema 基础类型名（`integer` 不接受浮点值；`number` 不接受 NaN / Infinity）。 */
export const TYPE_NAMES: ReadonlySet<string> = new Set([
  'object',
  'array',
  'string',
  'number',
  'integer',
  'boolean',
  'null',
]);

/** 结构位置：定义哪些关键字的取值是子 schema / 子 schema 集合，供编译器递归。 */
export const SCHEMA_VALUE_KEYWORDS: ReadonlySet<string> = new Set([
  'additionalProperties',
  'items',
  'propertyNames',
  'allOf',
  'anyOf',
  'oneOf',
  'properties',
  '$defs',
]);
