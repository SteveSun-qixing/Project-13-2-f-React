/**
 * `manifest.yaml` 解析与校验（壳侧结构视图，《03-插件包格式》§5.2[3]、《02-插件清单规范》）。
 *
 * 权威：`04-文件格式规范/03-插件包格式` §五[3]（清单校验阶段）、
 * `03-插件开发/02-插件清单规范`（字段文法、角色约束、权限申请与限定值、各域字段）。
 *
 * @remarks
 * - 与 `@chips/cli` `artifacts/manifest.ts` 的校验面逐项一致（壳不 import 被承载方，
 *   结构视图先例见 `src/protocol/error-codes.ts`）；`yaml@2.8.2` 为 Host 首个运行时依赖。
 * - 权限词表复用 host `runtime/capability` 已知权限面：基础权限 ID 文法判定直接引用
 *   `src/runtime/capability/contracts.ts` 的 `isHostPermissionId`；本模块的权限规则表
 *   （限定值与角色约束）为《02-插件清单规范》§6.2 申请侧视图的壳侧等价实现，
 *   并以 `createHostPermissionCatalog()` 暴露给组合根（§六接线面）作 `knownPermissions` 注入。
 * - 错误码口径（裁决登记于开发日志）：契约面清单阶段唯一登记码为 `CPK_MANIFEST_INVALID`
 *   （`codes.ts` 结构视图不含 `PERMISSION_*` 码——那是 Bridge 会话/注册域的运行时码）；
 *   权限申请失败（未登记 / 文法 / 限定值 / 角色不允许）一律落 `CPK_MANIFEST_INVALID`
 *   （《03-插件包格式》§八：清单不符合格式要求），并把 Bridge 域同名判定语义以
 *   `details.permissionCode` 诊断字段保留；`engines.chips` 不满足落 `CPK_ENGINE_UNSUPPORTED`。
 * - `cli.commands` 段的固定命令根与路径段文法取自《13-命令系统契约》/《07-CLI完整参考》
 *   的公开口径（与 `@chips/cli` `plugin-cli/index.ts` 同名表逐项一致）。
 */

import { parse as parseYaml } from 'yaml';

import { isHostPermissionId } from '../runtime/capability/contracts.js';
import { CPK_ERROR_CODES } from './codes.js';
import { throwCpkError } from './errors.js';
import {
  isValidRange,
  parseRange,
  parseSemver,
  satisfiesRange,
} from './semver.js';
import type { IPluginDependency, PluginRole } from './types.js';

const PLUGIN_ID_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const CARD_TYPE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*(\.[a-z][a-z0-9-]*)*$/;
const LAYOUT_TYPE_ID_PATTERN = /^chips\.layout\.[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const COMMAND_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const MAPS_TO_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const PARAMETER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/i;
const COMMAND_PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;
const DURATION_PATTERN = /^(\d+)(ms|s|m)$/;

/** 固定命令根：插件命令路径第一段不得命中（《13-命令系统契约》，含历史保留名 `host`）。 */
export const FIXED_COMMAND_ROOTS: readonly string[] = [
  'help',
  'start',
  'stop',
  'status',
  'config',
  'logs',
  'plugin',
  'update',
  'doctor',
  'open',
  'completion',
  'dev',
  'host',
];

const RESERVED_DEEP_LINK_SCHEMES = new Set([
  'http',
  'https',
  'file',
  'mailto',
  'tel',
  'data',
  'javascript',
]);
const PARAMETER_TYPES = new Set([
  'string',
  'stringList',
  'number',
  'integer',
  'boolean',
  'enum',
  'path',
  'json',
  'jsonFile',
  'text',
  'textFile',
]);
const UI_CONTROLS = new Set([
  'select',
  'multiSelect',
  'toggle',
  'stepper',
  'slider',
  'pathInput',
  'pasteBox',
  'textarea',
]);
const PATH_OVERWRITE_POLICIES = new Set(['fail', 'overwrite', 'rename', 'skip']);
const SURFACE_REUSE_POLICIES = new Set(['always', 'never', 'preferred']);
const OUTPUT_JSON_POLICIES = new Set(['supported', 'required', 'unsupported']);

/** 四种插件角色（《03-插件架构设计》§二）。 */
export function allPluginRoles(): readonly PluginRole[] {
  return ALL_ROLES;
}

// ---------------------------------------------------------------------------
// 权限目录（《02-插件清单规范》§6.2 申请侧视图；§6.3 限定值规则）
// ---------------------------------------------------------------------------

/** 限定值要求。 */
export type PermissionQualifierRule = 'required' | 'optional' | 'forbidden';

/** 权限规则。 */
export interface IPermissionRule {
  readonly id: string;
  readonly qualifier: PermissionQualifierRule;
  /** `all` 表示四种角色均可申请。 */
  readonly roles: readonly PluginRole[] | 'all';
}

const ALL_ROLES: readonly PluginRole[] = ['app', 'basecard', 'boxlayout', 'service'];
const APP_ONLY: readonly PluginRole[] = ['app'];

/** 基础权限表（《02-插件清单规范》§6.2；与 `@chips/cli` `permission-catalog.ts` 逐项一致）。 */
const BASE_PERMISSION_RULES: readonly IPermissionRule[] = [
  { id: 'filesystem:read', qualifier: 'required', roles: 'all' },
  { id: 'filesystem:write', qualifier: 'required', roles: 'all' },
  { id: 'filesystem:delete', qualifier: 'required', roles: 'all' },
  { id: 'resources:read', qualifier: 'optional', roles: 'all' },
  { id: 'resources:write', qualifier: 'optional', roles: 'all' },
  { id: 'window:control', qualifier: 'optional', roles: APP_ONLY },
  { id: 'menu:manage', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'tray:manage', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'shortcut:manage', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'system:read', qualifier: 'forbidden', roles: 'all' },
  { id: 'power:read', qualifier: 'forbidden', roles: 'all' },
  { id: 'power:manage', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'transfer:manage', qualifier: 'forbidden', roles: 'all' },
  { id: 'notifications:send', qualifier: 'forbidden', roles: 'all' },
  { id: 'clipboard:access', qualifier: 'forbidden', roles: 'all' },
  { id: 'dialogs:use', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'shell:external', qualifier: 'required', roles: APP_ONLY },
  { id: 'network:http', qualifier: 'required', roles: 'all' },
  { id: 'config:read', qualifier: 'required', roles: 'all' },
  { id: 'config:write', qualifier: 'required', roles: 'all' },
  { id: 'credential:manage', qualifier: 'forbidden', roles: 'all' },
  { id: 'events:publish', qualifier: 'forbidden', roles: 'all' },
  { id: 'command:write', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'command:read', qualifier: 'forbidden', roles: 'all' },
  { id: 'command:execute', qualifier: 'forbidden', roles: 'all' },
];

/** 登记目录端口（卡片/布局/能力登记表缺省时只按文法校验）。 */
export interface IPermissionCatalog {
  readonly rules: readonly IPermissionRule[];
  /** 已登记卡片类型 ID（缺失时按文法校验）。 */
  readonly cardTypeIds?: readonly string[];
  /** 已登记布局类型 ID（缺失时按文法校验）。 */
  readonly layoutTypeIds?: readonly string[];
  /** 已登记 Bridge 能力 ID（缺失时 `cli.commands[].target.capability` 只校验文法）。 */
  readonly capabilityIds?: readonly string[];
  find(base: string): IPermissionRule | undefined;
}

/** 构造宿主内置登记目录（基础权限表 + 可选平台登记表注入）。 */
export function createHostPermissionCatalog(options?: {
  readonly cardTypeIds?: readonly string[];
  readonly layoutTypeIds?: readonly string[];
  readonly capabilityIds?: readonly string[];
}): IPermissionCatalog {
  const rules = [...BASE_PERMISSION_RULES];
  return {
    rules,
    ...(options?.cardTypeIds === undefined ? {} : { cardTypeIds: options.cardTypeIds }),
    ...(options?.layoutTypeIds === undefined ? {} : { layoutTypeIds: options.layoutTypeIds }),
    ...(options?.capabilityIds === undefined ? {} : { capabilityIds: options.capabilityIds }),
    find: (base: string): IPermissionRule | undefined => rules.find((rule) => rule.id === base),
  };
}

/** 基础权限 ID 全集（供组合根注入 `runtime/capability` 注册选项 `knownPermissions`）。 */
export function knownPermissionIds(): ReadonlySet<string> {
  return new Set(BASE_PERMISSION_RULES.map((rule) => rule.id));
}

/** 解析权限申请串为 `{ base, qualifier }`；段数或基础 ID 文法非法返回 undefined。 */
export function splitPermissionRequest(
  request: string,
): { readonly base: string; readonly qualifier?: string } | undefined {
  const first = request.indexOf(':');
  if (first === -1) {
    return undefined;
  }
  const second = request.indexOf(':', first + 1);
  const base = second === -1 ? request : request.slice(0, second);
  const qualifier = second === -1 ? undefined : request.slice(second + 1);
  if (base.split(':').length !== 2) {
    return undefined;
  }
  if (!isHostPermissionId(base)) {
    return undefined;
  }
  const [domain, scope] = base.split(':');
  if (domain === undefined || scope === undefined || domain === '*' || scope === '*') {
    return undefined;
  }
  const result: { base: string; qualifier?: string } = { base };
  if (qualifier !== undefined) {
    result.qualifier = qualifier;
  }
  return result;
}

const PATH_QUALIFIER_PATTERN = /^\$\{[a-zA-Z][a-zA-Z0-9]*\}(?:\/[^\s:]+)*$/;
const DOMAIN_QUALIFIER_PATTERN = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(:\d{1,5})?$/;
const URL_QUALIFIER_PATTERN = /^https?:\/\/[^\s]+$/;
const WINDOW_QUALIFIER_PATTERN = /^[A-Za-z0-9*][A-Za-z0-9*-]*$/;
const SCOPE_QUALIFIER_PATTERN = /^[a-z][a-z0-9-]*\*?$/;
const NAMESPACE_QUALIFIER_PATTERN = /^(platform|plugins\.[a-z0-9.-]+)$/;

function qualifierInvalid(domain: string, qualifier: string): boolean {
  switch (domain) {
    case 'filesystem':
      return !PATH_QUALIFIER_PATTERN.test(qualifier);
    case 'network':
      return !DOMAIN_QUALIFIER_PATTERN.test(qualifier);
    case 'shell':
      return !URL_QUALIFIER_PATTERN.test(qualifier);
    case 'window':
      return !WINDOW_QUALIFIER_PATTERN.test(qualifier);
    case 'resources':
      return !SCOPE_QUALIFIER_PATTERN.test(qualifier);
    case 'config':
      return !NAMESPACE_QUALIFIER_PATTERN.test(qualifier);
    default:
      return qualifier.length === 0;
  }
}

/** Bridge 权限域判定语义的诊断标识（落 `details.permissionCode`，不作对外错误码）。 */
const PERMISSION_DIAGNOSTICS = {
  unknown: 'PERMISSION_UNKNOWN',
  invalid: 'PERMISSION_INVALID',
  roleNotAllowed: 'PERMISSION_ROLE_NOT_ALLOWED',
} as const;

/** 权限申请失败（清单阶段统一落 `CPK_MANIFEST_INVALID`，保留权限域诊断语义）。 */
function permissionFail(message: string, pointer: string, permissionCode: string): never {
  throwCpkError(CPK_ERROR_CODES.manifestInvalid, message, {
    stage: 'manifest',
    pointer,
    permissionCode,
  });
}

/**
 * 校验单条权限申请（《02-插件清单规范》§6.3.3–§6.3.5）。
 *
 * @returns 归一后的权限申请串。
 */
export function validatePermissionRequest(input: {
  readonly request: string;
  readonly role: PluginRole;
  readonly catalog: IPermissionCatalog;
  readonly pointer: string;
}): string {
  const parsed = splitPermissionRequest(input.request);
  if (parsed === undefined) {
    permissionFail(
      `权限 ID 非法：${input.request}`,
      input.pointer,
      PERMISSION_DIAGNOSTICS.unknown,
    );
  }
  const rule = input.catalog.find(parsed.base);
  if (rule === undefined) {
    permissionFail(
      `未登记的权限 ID：${input.request}`,
      input.pointer,
      PERMISSION_DIAGNOSTICS.unknown,
    );
  }
  if (rule.roles !== 'all' && !rule.roles.includes(input.role)) {
    permissionFail(
      `${input.role} 角色不得申请权限：${rule.id}`,
      input.pointer,
      PERMISSION_DIAGNOSTICS.roleNotAllowed,
    );
  }
  const qualifier = parsed.qualifier;
  if (rule.qualifier === 'required' && (qualifier === undefined || qualifier.length === 0)) {
    permissionFail(
      `权限 ${rule.id} 必须携带限定值`,
      input.pointer,
      PERMISSION_DIAGNOSTICS.invalid,
    );
  }
  if (rule.qualifier === 'forbidden' && qualifier !== undefined) {
    permissionFail(
      `权限 ${rule.id} 禁止携带限定值`,
      input.pointer,
      PERMISSION_DIAGNOSTICS.invalid,
    );
  }
  if (qualifier !== undefined) {
    const domain = parsed.base.split(':')[0] ?? '';
    if (qualifierInvalid(domain, qualifier)) {
      permissionFail(
        `权限 ${rule.id} 的限定值非法：${qualifier}`,
        input.pointer,
        PERMISSION_DIAGNOSTICS.invalid,
      );
    }
  }
  return qualifier === undefined ? parsed.base : `${parsed.base}:${qualifier}`;
}

// ---------------------------------------------------------------------------
// 字段级校验工具（与 CLI 清单校验器同构；失败一律 CPK_MANIFEST_INVALID + pointer）
// ---------------------------------------------------------------------------

function fail(message: string, pointer: string): never {
  throwCpkError(CPK_ERROR_CODES.manifestInvalid, message, { stage: 'manifest', pointer });
}

function expectObject(value: unknown, pointer: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`应为对象：${pointer}`, pointer);
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, pointer: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    fail(`应为数组：${pointer}`, pointer);
  }
  return value;
}

function expectString(
  value: unknown,
  pointer: string,
  options?: { readonly allowEmpty?: boolean },
): string {
  if (typeof value !== 'string') {
    fail(`应为字符串：${pointer}`, pointer);
  }
  if (options?.allowEmpty !== true && value.length === 0) {
    fail(`不得为空字符串：${pointer}`, pointer);
  }
  return value;
}

function expectBoolean(value: unknown, pointer: string): boolean {
  if (typeof value !== 'boolean') {
    fail(`应为布尔值：${pointer}`, pointer);
  }
  return value;
}

function expectNonNegativeInteger(value: unknown, pointer: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`应为非负整数：${pointer}`, pointer);
  }
  return value;
}

/**
 * 枚举字段：取值必须是字符串且落在候选集内。
 *
 * @remarks 不做 `String(value)` 隐式字符串化——清单里写成对象/数组的取值会被字符串化成
 * `[object Object]` 这类伪值，必须先按字符串收紧再比对候选。
 */
function expectEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  pointer: string,
  message: string,
): string {
  const text = expectString(value, pointer);
  if (!allowed.has(text)) {
    fail(message, pointer);
  }
  return text;
}

/** 数组判定：`Array.isArray` 会把取值收窄成 `any[]`，这里统一给出 `unknown` 视图以免污染下游。 */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function rejectUnknownKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
  pointer: string,
): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      fail(
        `出现未登记字段：${pointer === '' ? key : `${pointer}.${key}`}`,
        pointer === '' ? key : `${pointer}.${key}`,
      );
    }
  }
}

/** 解析 YAML 文本；语法错误或根节点非映射抛 `CPK_MANIFEST_INVALID`。 */
export function parseManifestText(text: string): unknown {
  try {
    const parsed: unknown = parseYaml(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      fail('manifest 根节点必须是映射', '');
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === 'ChipsError') {
      throw error;
    }
    fail(`YAML 解析失败：${error instanceof Error ? error.message : String(error)}`, '');
  }
}

function validateAssetRef(
  value: string,
  pointer: string,
  members: ReadonlySet<string>,
  options?: { readonly imageOnly?: boolean },
): void {
  if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.includes('\\')) {
    fail(`清单路径必须为包内相对 POSIX 路径：${value}`, pointer);
  }
  if (value.split('/').includes('..')) {
    fail(`清单路径不得越出包根：${value}`, pointer);
  }
  if (value.includes('://') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) {
    fail(`清单路径不得使用 URI scheme：${value}`, pointer);
  }
  if (!value.startsWith('assets/')) {
    fail(`清单路径必须位于 assets/ 内：${value}`, pointer);
  }
  if (!members.has(value)) {
    fail(`清单引用的文件不存在：${value}`, pointer);
  }
  if (options?.imageOnly === true && !/\.(svg|png|jpg|jpeg|webp|gif|ico|icns)$/i.test(value)) {
    fail(`图标必须为图片资源：${value}`, pointer);
  }
}

function validateJsonSchemaRef(
  value: string,
  pointer: string,
  members: ReadonlySet<string>,
  contents: ReadonlyMap<string, Uint8Array>,
): void {
  validateAssetRef(value, pointer, members);
  validateJsonSchemaDocument(value, pointer, contents);
}

function validateJsonSchemaDocument(
  path: string,
  pointer: string,
  contents: ReadonlyMap<string, Uint8Array>,
): void {
  const bytes = contents.get(path);
  if (bytes === undefined) {
    return;
  }
  let schema: unknown;
  try {
    schema = JSON.parse(new TextDecoder('utf-8', { fatal: false }).decode(bytes)) as unknown;
  } catch (error) {
    fail(
      `configSchema 不是合法 JSON：${path}（${error instanceof Error ? error.message : String(error)}）`,
      pointer,
    );
  }
  const object = expectObject(schema, pointer);
  if (object.type !== 'object') {
    fail(`configSchema 顶层必须为 object：${path}`, pointer);
  }
  const visited: unknown[] = [object];
  while (visited.length > 0) {
    const current = visited.pop();
    if (typeof current !== 'object' || current === null) {
      continue;
    }
    if (isUnknownArray(current)) {
      visited.push(...current);
      continue;
    }
    const record = current as Record<string, unknown>;
    const ref = record.$ref;
    if (typeof ref === 'string' && !ref.startsWith('#')) {
      fail(`configSchema 禁止远程 $ref：${ref}`, pointer);
    }
    visited.push(...Object.values(record));
  }
}

function validateParameter(
  value: unknown,
  pointer: string,
  kind: 'argument' | 'option',
  seenNames: Set<string>,
  seenShorts: Set<string>,
  seenPositions: Set<number>,
): void {
  const parameter = expectObject(value, pointer);
  rejectUnknownKeys(
    parameter,
    [
      'name',
      'short',
      'position',
      'type',
      'required',
      'default',
      'mapsTo',
      'choices',
      'multiple',
      'validation',
      'path',
      'batch',
      'ui',
    ],
    pointer,
  );
  const name = expectString(parameter.name, `${pointer}.name`);
  if (!PARAMETER_NAME_PATTERN.test(name)) {
    fail(`参数名不符合文法：${name}`, `${pointer}.name`);
  }
  if (seenNames.has(name)) {
    fail(`参数名重复：${name}`, `${pointer}.name`);
  }
  seenNames.add(name);
  if (parameter.short !== undefined) {
    const short = expectString(parameter.short, `${pointer}.short`);
    if (!/^[A-Za-z0-9]$/.test(short)) {
      fail(`短名必须为单个字母或数字：${short}`, `${pointer}.short`);
    }
    if (seenShorts.has(short)) {
      fail(`短名重复：-${short}`, `${pointer}.short`);
    }
    seenShorts.add(short);
  }
  const type = expectString(parameter.type, `${pointer}.type`);
  if (!PARAMETER_TYPES.has(type)) {
    fail(`不支持的参数类型：${type}`, `${pointer}.type`);
  }
  if (kind === 'argument') {
    const position = expectNonNegativeInteger(parameter.position ?? 0, `${pointer}.position`);
    if (seenPositions.has(position)) {
      fail(`position 重复：${position}`, `${pointer}.position`);
    }
    seenPositions.add(position);
  } else if (parameter.position !== undefined) {
    fail('命名选项不得声明 position', `${pointer}.position`);
  }
  if (parameter.mapsTo !== undefined) {
    const mapsTo = expectString(parameter.mapsTo, `${pointer}.mapsTo`);
    if (!MAPS_TO_PATTERN.test(mapsTo)) {
      fail(`mapsTo 必须为点分标识符路径：${mapsTo}`, `${pointer}.mapsTo`);
    }
  }
  if (type === 'enum') {
    const choices = expectArray(parameter.choices ?? [], `${pointer}.choices`);
    if (choices.length === 0) {
      fail('enum 必须声明非空 choices', `${pointer}.choices`);
    }
  }
  if (parameter.validation !== undefined) {
    const validation = expectObject(parameter.validation, `${pointer}.validation`);
    rejectUnknownKeys(
      validation,
      ['min', 'max', 'minLength', 'maxLength', 'pattern'],
      `${pointer}.validation`,
    );
    if (validation.pattern !== undefined) {
      const pattern = expectString(validation.pattern, `${pointer}.validation.pattern`);
      try {
        new RegExp(pattern);
      } catch {
        fail(`validation.pattern 不是合法正则：${pattern}`, `${pointer}.validation.pattern`);
      }
    }
  }
  if (parameter.path !== undefined) {
    const path = expectObject(parameter.path, `${pointer}.path`);
    rejectUnknownKeys(
      path,
      ['kind', 'role', 'exists', 'create', 'extensions', 'overwrite'],
      `${pointer}.path`,
    );
    if (path.role !== undefined && path.role !== 'input' && path.role !== 'output') {
      fail('path.role 只能为 input 或 output', `${pointer}.path.role`);
    }
    if (path.overwrite !== undefined) {
      if (path.role !== 'output') {
        fail('path.overwrite 只允许 path.role: output', `${pointer}.path.overwrite`);
      }
      expectEnum(
        path.overwrite,
        PATH_OVERWRITE_POLICIES,
        `${pointer}.path.overwrite`,
        'path.overwrite 取值非法',
      );
    }
    if (path.role === 'output' && type !== 'path') {
      fail('path.role: output 只允许 type: path', `${pointer}.path.role`);
    }
  }
  if (parameter.batch !== undefined) {
    if (type !== 'textFile' && type !== 'jsonFile') {
      fail('batch 只允许 textFile / jsonFile', `${pointer}.batch`);
    }
    const batch = expectObject(parameter.batch, `${pointer}.batch`);
    rejectUnknownKeys(batch, ['format', 'itemType', 'itemPath'], `${pointer}.batch`);
    if (batch.format !== undefined) {
      if (batch.format === 'lines' && type !== 'textFile') {
        fail('batch.format: lines 只允许 textFile', `${pointer}.batch.format`);
      }
      if (batch.format === 'json-array' && type !== 'jsonFile') {
        fail('batch.format: json-array 只允许 jsonFile', `${pointer}.batch.format`);
      }
    }
    if (batch.itemPath !== undefined && batch.itemType !== 'path') {
      fail('batch.itemPath 需要 batch.itemType: path', `${pointer}.batch.itemPath`);
    }
  }
  if (parameter.ui !== undefined) {
    const ui = expectObject(parameter.ui, `${pointer}.ui`);
    rejectUnknownKeys(
      ui,
      ['control', 'choices', 'min', 'max', 'step', 'placeholder'],
      `${pointer}.ui`,
    );
    if (ui.control !== undefined) {
      const control = expectString(ui.control, `${pointer}.ui.control`);
      if (!UI_CONTROLS.has(control)) {
        fail(`不支持的 TUI 控件：${control}`, `${pointer}.ui.control`);
      }
    }
  }
}

function validateCliCommands(
  value: unknown,
  role: PluginRole,
  pluginId: string,
  pointer: string,
  catalog: IPermissionCatalog,
): void {
  const cli = expectObject(value, pointer);
  rejectUnknownKeys(cli, ['commands'], pointer);
  const commands = expectArray(cli.commands, `${pointer}.commands`);
  if (commands.length === 0) {
    fail('cli.commands 至少一项', `${pointer}.commands`);
  }
  const pathKeys = new Set<string>();
  commands.forEach((item, index) => {
    const commandPointer = `${pointer}.commands[${index}]`;
    const command = expectObject(item, commandPointer);
    rejectUnknownKeys(
      command,
      [
        'commandPath',
        'commandId',
        'title',
        'description',
        'examples',
        'permissions',
        'target',
        'arguments',
        'options',
        'output',
        'job',
        'conflict',
      ],
      commandPointer,
    );
    const rawPath = command.commandPath;
    if (typeof rawPath !== 'string' && !Array.isArray(rawPath)) {
      fail('commandPath 必须为字符串或字符串数组', `${commandPointer}.commandPath`);
    }
    const segments = typeof rawPath === 'string' ? [rawPath] : rawPath;
    if (segments.length === 0) {
      fail('commandPath 至少一段', `${commandPointer}.commandPath`);
    }
    const normalized: string[] = [];
    for (const segment of segments) {
      if (typeof segment !== 'string' || !COMMAND_PATH_SEGMENT_PATTERN.test(segment)) {
        fail(`命令路径段不符合文法：${String(segment)}`, `${commandPointer}.commandPath`);
      }
      normalized.push(segment);
    }
    const firstSegment = (normalized[0] ?? '').toLowerCase();
    if (FIXED_COMMAND_ROOTS.includes(firstSegment)) {
      fail(`命令路径命中固定命令根：${firstSegment}`, `${commandPointer}.commandPath`);
    }
    const key = normalized.map((segment) => segment.toLowerCase()).join(' ');
    if (pathKeys.has(key)) {
      fail(`命令路径在插件内重复：${key}`, `${commandPointer}.commandPath`);
    }
    pathKeys.add(key);

    expectString(command.title, `${commandPointer}.title`);
    if (command.description !== undefined) {
      expectString(command.description, `${commandPointer}.description`);
    }
    if (command.examples !== undefined) {
      for (const example of expectArray(command.examples, `${commandPointer}.examples`)) {
        expectString(example, `${commandPointer}.examples`);
      }
    }
    if (command.permissions !== undefined) {
      const permissions = expectArray(command.permissions, `${commandPointer}.permissions`);
      permissions.forEach((permission, permissionIndex) => {
        validatePermissionRequest({
          request: expectString(permission, `${commandPointer}.permissions[${permissionIndex}]`),
          role,
          catalog,
          pointer: `${commandPointer}.permissions[${permissionIndex}]`,
        });
      });
    }

    const target = expectObject(command.target, `${commandPointer}.target`);
    rejectUnknownKeys(
      target,
      ['type', 'pluginId', 'capability', 'surface'],
      `${commandPointer}.target`,
    );
    const targetType = expectString(target.type, `${commandPointer}.target.type`);
    if (targetType !== role) {
      fail(`target.type 必须等于插件角色：${role}`, `${commandPointer}.target.type`);
    }
    const targetPluginId = expectString(target.pluginId, `${commandPointer}.target.pluginId`);
    if (targetPluginId !== pluginId) {
      fail('target.pluginId 必须等于插件 ID', `${commandPointer}.target.pluginId`);
    }
    if (role === 'app') {
      if (command.commandId === undefined) {
        fail('app 目标必须声明 commandId', `${commandPointer}.commandId`);
      }
      const commandId = expectString(command.commandId, `${commandPointer}.commandId`);
      if (!COMMAND_ID_PATTERN.test(commandId)) {
        fail(`commandId 文法非法：${commandId}`, `${commandPointer}.commandId`);
      }
      if (target.capability !== undefined) {
        fail('app 目标不得声明 capability', `${commandPointer}.target.capability`);
      }
      if (target.surface !== undefined) {
        const surface = expectObject(target.surface, `${commandPointer}.target.surface`);
        rejectUnknownKeys(surface, ['open', 'focus', 'reuse'], `${commandPointer}.target.surface`);
        if (surface.open !== undefined) {
          expectBoolean(surface.open, `${commandPointer}.target.surface.open`);
        }
        if (surface.focus !== undefined) {
          expectBoolean(surface.focus, `${commandPointer}.target.surface.focus`);
        }
        if (surface.reuse !== undefined) {
          expectEnum(
            surface.reuse,
            SURFACE_REUSE_POLICIES,
            `${commandPointer}.target.surface.reuse`,
            'surface.reuse 取值非法',
          );
        }
      }
    } else {
      if (command.commandId !== undefined) {
        fail('service 目标禁止声明 commandId', `${commandPointer}.commandId`);
      }
      if (target.surface !== undefined) {
        fail('service 目标禁止声明 surface', `${commandPointer}.target.surface`);
      }
      if (command.job !== undefined) {
        fail('service 目标禁止声明 job', `${commandPointer}.job`);
      }
      const capability = expectString(
        target.capability ?? '',
        `${commandPointer}.target.capability`,
      );
      if (!CAPABILITY_ID_PATTERN.test(capability)) {
        fail(`capability 文法非法：${capability}`, `${commandPointer}.target.capability`);
      }
      if (catalog.capabilityIds !== undefined && !catalog.capabilityIds.includes(capability)) {
        fail(`未登记的能力 ID：${capability}`, `${commandPointer}.target.capability`);
      }
    }

    const seenNames = new Set<string>();
    const seenShorts = new Set<string>();
    if (command.arguments !== undefined) {
      const argumentsList = expectArray(command.arguments, `${commandPointer}.arguments`);
      const seenPositions = new Set<number>();
      argumentsList.forEach((argument, argumentIndex) => {
        validateParameter(
          argument,
          `${commandPointer}.arguments[${argumentIndex}]`,
          'argument',
          seenNames,
          seenShorts,
          seenPositions,
        );
      });
    }
    if (command.options !== undefined) {
      const options = expectArray(command.options, `${commandPointer}.options`);
      options.forEach((option, optionIndex) => {
        validateParameter(
          option,
          `${commandPointer}.options[${optionIndex}]`,
          'option',
          seenNames,
          seenShorts,
          new Set<number>(),
        );
      });
    }

    if (command.output !== undefined) {
      const output = expectObject(command.output, `${commandPointer}.output`);
      rejectUnknownKeys(output, ['mode', 'json', 'artifacts'], `${commandPointer}.output`);
      if (output.mode !== undefined && output.mode !== 'human' && output.mode !== 'json') {
        fail('output.mode 取值非法', `${commandPointer}.output.mode`);
      }
      if (output.json !== undefined) {
        expectEnum(
          output.json,
          OUTPUT_JSON_POLICIES,
          `${commandPointer}.output.json`,
          'output.json 取值非法',
        );
      }
      if (output.artifacts !== undefined) {
        expectArray(output.artifacts, `${commandPointer}.output.artifacts`);
      }
    }
    if (command.job !== undefined) {
      const job = expectObject(command.job, `${commandPointer}.job`);
      rejectUnknownKeys(job, ['wait', 'cancelOnInterrupt'], `${commandPointer}.job`);
      if (job.wait !== undefined) {
        expectBoolean(job.wait, `${commandPointer}.job.wait`);
      }
      if (job.cancelOnInterrupt !== undefined) {
        expectBoolean(job.cancelOnInterrupt, `${commandPointer}.job.cancelOnInterrupt`);
      }
    }
    if (command.conflict !== undefined) {
      const conflict = expectObject(command.conflict, `${commandPointer}.conflict`);
      rejectUnknownKeys(conflict, ['priority', 'namespace'], `${commandPointer}.conflict`);
      if (conflict.priority !== undefined && typeof conflict.priority !== 'number') {
        fail('conflict.priority 必须为数值', `${commandPointer}.conflict.priority`);
      }
      if (conflict.namespace !== undefined) {
        expectString(conflict.namespace, `${commandPointer}.conflict.namespace`);
      }
    }
  });
}

function validateRuntime(value: unknown, role: PluginRole, pointer: string): void {
  const runtime = expectObject(value, pointer);
  rejectUnknownKeys(runtime, ['targets', 'background'], pointer);
  const targets = expectArray(runtime.targets, `${pointer}.targets`);
  if (targets.length === 0) {
    fail('runtime.targets 不得为空', `${pointer}.targets`);
  }
  const seen = new Set<string>();
  targets.forEach((target, index) => {
    if (target !== 'host') {
      fail(`runtime.targets 只允许 host：${String(target)}`, `${pointer}.targets[${index}]`);
    }
    if (seen.has('host')) {
      fail('runtime.targets 不得重复', `${pointer}.targets[${index}]`);
    }
    seen.add('host');
  });
  if (runtime.background !== undefined) {
    const background = expectBoolean(runtime.background, `${pointer}.background`);
    if (background && role !== 'service') {
      fail('background: true 只允许 service 角色', `${pointer}.background`);
    }
  }
}

function validateCardTypes(
  capabilities: Record<string, unknown>,
  pointer: string,
  members: ReadonlySet<string>,
  catalog: IPermissionCatalog,
  contents: ReadonlyMap<string, Uint8Array>,
): void {
  const cardTypes = expectArray(capabilities.cardTypes ?? [], `${pointer}.cardTypes`);
  if (cardTypes.length === 0) {
    fail('basecard 必须声明至少一项 cardTypes', `${pointer}.cardTypes`);
  }
  const seen = new Set<string>();
  cardTypes.forEach((item, index) => {
    const cardPointer = `${pointer}.cardTypes[${index}]`;
    const card = expectObject(item, cardPointer);
    rejectUnknownKeys(
      card,
      [
        'id',
        'name',
        'description',
        'icon',
        'extensions',
        'configSchema',
        'aliases',
        'exportFormats',
      ],
      cardPointer,
    );
    const id = expectString(card.id, `${cardPointer}.id`);
    if (!CARD_TYPE_ID_PATTERN.test(id)) {
      fail(`卡片类型 ID 文法非法：${id}`, `${cardPointer}.id`);
    }
    if (seen.has(id)) {
      fail(`卡片类型 ID 重复：${id}`, `${cardPointer}.id`);
    }
    seen.add(id);
    if (catalog.cardTypeIds !== undefined && !catalog.cardTypeIds.includes(id)) {
      fail(`未登记的卡片类型 ID：${id}`, `${cardPointer}.id`);
    }
    expectString(card.name, `${cardPointer}.name`);
    if (card.description !== undefined) {
      expectString(card.description, `${cardPointer}.description`);
    }
    if (card.icon !== undefined) {
      validateAssetRef(
        expectString(card.icon, `${cardPointer}.icon`),
        `${cardPointer}.icon`,
        members,
        { imageOnly: true },
      );
    }
    if (card.configSchema !== undefined) {
      validateJsonSchemaRef(
        expectString(card.configSchema, `${cardPointer}.configSchema`),
        `${cardPointer}.configSchema`,
        members,
        contents,
      );
    }
    if (card.extensions !== undefined) {
      for (const extension of expectArray(card.extensions, `${cardPointer}.extensions`)) {
        const text = expectString(extension, `${cardPointer}.extensions`);
        if (!/^\.[a-z0-9]+$/.test(text)) {
          fail(`扩展名必须含点且小写：${text}`, `${cardPointer}.extensions`);
        }
      }
    }
    if (card.aliases !== undefined) {
      for (const alias of expectArray(card.aliases, `${cardPointer}.aliases`)) {
        const text = expectString(alias, `${cardPointer}.aliases`);
        if (!CARD_TYPE_ID_PATTERN.test(text)) {
          fail(`别名文法非法：${text}`, `${cardPointer}.aliases`);
        }
      }
    }
    if (card.exportFormats !== undefined) {
      for (const format of expectArray(card.exportFormats, `${cardPointer}.exportFormats`)) {
        const formatObject = expectObject(format, `${cardPointer}.exportFormats[]`);
        rejectUnknownKeys(
          formatObject,
          ['id', 'name', 'extension', 'mimeType'],
          `${cardPointer}.exportFormats[]`,
        );
        expectString(formatObject.id, `${cardPointer}.exportFormats[].id`);
        expectString(formatObject.name, `${cardPointer}.exportFormats[].name`);
        expectString(formatObject.extension, `${cardPointer}.exportFormats[].extension`);
        expectString(formatObject.mimeType, `${cardPointer}.exportFormats[].mimeType`);
      }
    }
  });
}

function validateLayouts(
  capabilities: Record<string, unknown>,
  pointer: string,
  members: ReadonlySet<string>,
  catalog: IPermissionCatalog,
  contents: ReadonlyMap<string, Uint8Array>,
): void {
  const layouts = expectArray(capabilities.layouts ?? [], `${pointer}.layouts`);
  if (layouts.length === 0) {
    fail('boxlayout 必须声明至少一项 layouts', `${pointer}.layouts`);
  }
  const seen = new Set<string>();
  layouts.forEach((item, index) => {
    const layoutPointer = `${pointer}.layouts[${index}]`;
    const layout = expectObject(item, layoutPointer);
    rejectUnknownKeys(
      layout,
      ['id', 'name', 'icon', 'description', 'configSchema', 'schemaVersions'],
      layoutPointer,
    );
    const id = expectString(layout.id, `${layoutPointer}.id`);
    if (!LAYOUT_TYPE_ID_PATTERN.test(id)) {
      fail(`布局类型 ID 必须为 chips.layout.<name>：${id}`, `${layoutPointer}.id`);
    }
    if (seen.has(id)) {
      fail(`布局类型 ID 重复：${id}`, `${layoutPointer}.id`);
    }
    seen.add(id);
    if (catalog.layoutTypeIds !== undefined && !catalog.layoutTypeIds.includes(id)) {
      fail(`未登记的布局类型 ID：${id}`, `${layoutPointer}.id`);
    }
    expectString(layout.name, `${layoutPointer}.name`);
    if (layout.icon !== undefined) {
      validateAssetRef(
        expectString(layout.icon, `${layoutPointer}.icon`),
        `${layoutPointer}.icon`,
        members,
        { imageOnly: true },
      );
    }
    validateJsonSchemaRef(
      expectString(layout.configSchema ?? '', `${layoutPointer}.configSchema`),
      `${layoutPointer}.configSchema`,
      members,
      contents,
    );
    const schemaVersions = expectString(
      layout.schemaVersions ?? '',
      `${layoutPointer}.schemaVersions`,
    );
    if (!isValidRange(schemaVersions)) {
      fail(`schemaVersions 版本范围非法：${schemaVersions}`, `${layoutPointer}.schemaVersions`);
    }
  });
}

function validateFileAssociations(value: unknown, pointer: string): void {
  const associations = expectArray(value, pointer);
  associations.forEach((item, index) => {
    const associationPointer = `${pointer}[${index}]`;
    const association = expectObject(item, associationPointer);
    rejectUnknownKeys(
      association,
      ['extensions', 'mimeTypes', 'tier', 'action'],
      associationPointer,
    );
    const extensions = expectArray(association.extensions, `${associationPointer}.extensions`);
    const seen = new Set<string>();
    let hasExtension = false;
    extensions.forEach((extension, extensionIndex) => {
      const text = expectString(extension, `${associationPointer}.extensions[${extensionIndex}]`, {
        allowEmpty: true,
      });
      if (text.length === 0) {
        return;
      }
      hasExtension = true;
      if (!/^\.[a-z0-9]+$/.test(text)) {
        fail(
          `扩展名必须含点且小写：${text}`,
          `${associationPointer}.extensions[${extensionIndex}]`,
        );
      }
      if (seen.has(text)) {
        fail(`扩展名重复：${text}`, `${associationPointer}.extensions[${extensionIndex}]`);
      }
      seen.add(text);
    });
    const mimeTypes =
      association.mimeTypes === undefined
        ? []
        : expectArray(association.mimeTypes, `${associationPointer}.mimeTypes`);
    let hasMime = false;
    mimeTypes.forEach((mime, mimeIndex) => {
      const text = expectString(mime, `${associationPointer}.mimeTypes[${mimeIndex}]`);
      hasMime = true;
      if (
        text === '*/*' ||
        (!/^[a-z0-9.+-]+\/[a-z0-9.+*-]+$/.test(text) && !/^[a-z0-9.+-]+\/\*$/.test(text))
      ) {
        fail(`MIME 声明非法：${text}`, `${associationPointer}.mimeTypes[${mimeIndex}]`);
      }
    });
    if (!hasExtension && !hasMime) {
      fail('extensions 与 mimeTypes 至少一项非空', associationPointer);
    }
    if (
      association.tier !== undefined &&
      association.tier !== 'primary' &&
      association.tier !== 'fallback'
    ) {
      fail('tier 只能为 primary 或 fallback', `${associationPointer}.tier`);
    }
    if (association.action !== 'open') {
      fail('action 当前只允许 open', `${associationPointer}.action`);
    }
  });
}

function validateDeepLinks(value: unknown, pointer: string): void {
  const deepLinks = expectArray(value, pointer);
  const schemes = new Set<string>();
  const hosts = new Set<string>();
  deepLinks.forEach((item, index) => {
    const linkPointer = `${pointer}[${index}]`;
    const link = expectObject(item, linkPointer);
    rejectUnknownKeys(link, ['scheme', 'host', 'pathPattern'], linkPointer);
    const scheme = expectString(link.scheme, `${linkPointer}.scheme`);
    if (RESERVED_DEEP_LINK_SCHEMES.has(scheme)) {
      fail(`不得占用系统保留 scheme：${scheme}`, `${linkPointer}.scheme`);
    }
    const host = expectString(link.host, `${linkPointer}.host`);
    if (schemes.has(scheme) && hosts.has(host)) {
      fail(`深链接重复：${scheme}://${host}`, linkPointer);
    }
    schemes.add(scheme);
    hosts.add(host);
    if (link.pathPattern !== undefined) {
      expectString(link.pathPattern, `${linkPointer}.pathPattern`);
    }
  });
}

function parseDuration(text: string): number | undefined {
  const match = DURATION_PATTERN.exec(text);
  if (match === null) {
    return undefined;
  }
  const amount = Number(match[1] ?? '0');
  const unit = match[2] ?? 'ms';
  if (unit === 'ms') {
    return amount;
  }
  if (unit === 's') {
    return amount * 1000;
  }
  return amount * 60_000;
}

function validateHealthCheck(value: unknown, pointer: string): void {
  const healthCheck = expectObject(value, pointer);
  rejectUnknownKeys(healthCheck, ['interval', 'timeout'], pointer);
  const intervalText =
    healthCheck.interval === undefined
      ? '30s'
      : expectString(healthCheck.interval, `${pointer}.interval`);
  const timeoutText =
    healthCheck.timeout === undefined
      ? '5s'
      : expectString(healthCheck.timeout, `${pointer}.timeout`);
  const interval = parseDuration(intervalText);
  const timeout = parseDuration(timeoutText);
  if (interval === undefined) {
    fail(`interval 时长格式非法：${intervalText}`, `${pointer}.interval`);
  }
  if (timeout === undefined) {
    fail(`timeout 时长格式非法：${timeoutText}`, `${pointer}.timeout`);
  }
  if (interval < 1000) {
    fail('interval 不得小于 1s', `${pointer}.interval`);
  }
  if (timeout >= interval) {
    fail('timeout 必须小于 interval', `${pointer}.timeout`);
  }
}

function validateUi(value: unknown, pointer: string, members: ReadonlySet<string>): void {
  const ui = expectObject(value, pointer);
  rejectUnknownKeys(ui, ['surface', 'launcher'], pointer);
  const surface = expectString(ui.surface ?? '', `${pointer}.surface`);
  if (!['window', 'desktop', 'tray'].includes(surface)) {
    fail(`ui.surface 取值非法：${surface}`, `${pointer}.surface`);
  }
  if (ui.launcher !== undefined) {
    const launcher = expectObject(ui.launcher, `${pointer}.launcher`);
    rejectUnknownKeys(launcher, ['icon', 'name', 'description'], `${pointer}.launcher`);
    if (launcher.icon !== undefined) {
      validateAssetRef(
        expectString(launcher.icon, `${pointer}.launcher.icon`),
        `${pointer}.launcher.icon`,
        members,
        { imageOnly: true },
      );
    }
    if (launcher.name !== undefined) {
      expectString(launcher.name, `${pointer}.launcher.name`);
    }
    if (launcher.description !== undefined) {
      expectString(launcher.description, `${pointer}.launcher.description`);
    }
  }
}

/** 清单校验输入。 */
export interface IManifestValidationInput {
  /** 已解析的 YAML 根节点。 */
  readonly manifest: unknown;
  /** 包内成员路径集合（`.cpk` 成员或目录态相对路径，POSIX 分隔）。 */
  readonly members: ReadonlySet<string>;
  /** 包内成员内容（路径 → 字节；`configSchema` 等 JSON 文档校验收内容）。 */
  readonly contents: ReadonlyMap<string, Uint8Array>;
  readonly catalog: IPermissionCatalog;
  /** 当前平台版本；提供时校验 `engines.chips` 门禁。 */
  readonly platformVersion?: string;
  /** 源码 `package.json` 的版本；提供时要求与 `manifest.version` 一致。 */
  readonly packageVersion?: string;
}

/** 清单校验与归一结果（安装与注册表所需字段的完整投影）。 */
export interface IHostManifestValidationResult {
  readonly id: string;
  readonly version: string;
  readonly role: PluginRole;
  readonly name: string;
  readonly dependencies: readonly IPluginDependency[];
  readonly permissions: readonly string[];
  readonly warnings: readonly string[];
}

/** 校验清单（《02-插件清单规范》全部域字段；失败抛 `CPK_MANIFEST_INVALID` / `CPK_ENGINE_UNSUPPORTED`）。 */
export function validateManifest(
  input: IManifestValidationInput,
): IHostManifestValidationResult {
  const members = input.members;
  const contents = input.contents;
  const root = expectObject(input.manifest, '');
  rejectUnknownKeys(
    root,
    [
      'id',
      'version',
      'type',
      'name',
      'description',
      'author',
      'license',
      'runtime',
      'engines',
      'dependencies',
      'permissions',
      'capabilities',
      'ui',
      'fileAssociations',
      'deepLinks',
      'healthCheck',
      'cli',
    ],
    '',
  );

  const id = expectString(root.id, 'id');
  if (!PLUGIN_ID_PATTERN.test(id)) {
    fail(`插件 ID 必须为反向域名：${id}`, 'id');
  }
  const versionText = expectString(root.version, 'version');
  const version = parseSemver(versionText);
  if (version === undefined) {
    fail(`version 必须为语义化版本：${versionText}`, 'version');
  }
  const type = expectString(root.type, 'type');
  if (!allPluginRoles().includes(type as PluginRole)) {
    fail(`type 必须为 basecard / boxlayout / app / service：${type}`, 'type');
  }
  const role = type as PluginRole;
  const name = expectString(root.name, 'name');
  if (root.description !== undefined) {
    expectString(root.description, 'description');
  }
  if (root.author !== undefined) {
    expectString(root.author, 'author');
  }
  if (root.license !== undefined) {
    expectString(root.license, 'license');
  }
  if (input.packageVersion !== undefined && input.packageVersion !== versionText) {
    fail(
      `manifest.version 与 package.json 的 version 不一致：${versionText} / ${input.packageVersion}`,
      'version',
    );
  }

  validateRuntime(root.runtime, role, 'runtime');

  if (root.engines !== undefined) {
    const engines = expectObject(root.engines, 'engines');
    rejectUnknownKeys(engines, ['chips'], 'engines');
    const chips = expectString(engines.chips ?? '', 'engines.chips');
    const groups = parseRange(chips);
    if (groups === undefined) {
      fail(`engines.chips 版本范围非法：${chips}`, 'engines.chips');
    }
    if (input.platformVersion !== undefined) {
      const platform = parseSemver(input.platformVersion);
      if (platform !== undefined && !satisfiesRange(platform, groups)) {
        throwCpkError(
          CPK_ERROR_CODES.engineUnsupported,
          `engines.chips 不满足当前平台版本：需要 ${chips}，当前 ${input.platformVersion}`,
          { stage: 'manifest', pointer: 'engines.chips' },
        );
      }
    }
  }

  const warnings: string[] = [];
  const dependencies: IPluginDependency[] = [];
  if (root.dependencies !== undefined) {
    const dependencyList = expectArray(root.dependencies, 'dependencies');
    const seen = new Set<string>();
    dependencyList.forEach((item, index) => {
      const dependencyPointer = `dependencies[${index}]`;
      const dependency = expectObject(item, dependencyPointer);
      rejectUnknownKeys(dependency, ['id', 'version'], dependencyPointer);
      const dependencyId = expectString(dependency.id, `${dependencyPointer}.id`);
      if (!PLUGIN_ID_PATTERN.test(dependencyId)) {
        fail(`依赖 ID 必须为反向域名：${dependencyId}`, `${dependencyPointer}.id`);
      }
      if (dependencyId === id) {
        fail('依赖不得指向自身', `${dependencyPointer}.id`);
      }
      if (seen.has(dependencyId)) {
        warnings.push(`依赖重复声明：${dependencyId}`);
      }
      seen.add(dependencyId);
      const range = expectString(dependency.version, `${dependencyPointer}.version`);
      if (!isValidRange(range)) {
        fail(`依赖版本范围非法：${range}`, `${dependencyPointer}.version`);
      }
      dependencies.push({ id: dependencyId, version: range });
    });
  }

  const permissions: string[] = [];
  if (root.permissions !== undefined) {
    const permissionList = expectArray(root.permissions, 'permissions');
    permissionList.forEach((permission, index) => {
      const normalized = validatePermissionRequest({
        request: expectString(permission, `permissions[${index}]`),
        role,
        catalog: input.catalog,
        pointer: `permissions[${index}]`,
      });
      permissions.push(normalized);
    });
  }

  if (root.capabilities !== undefined) {
    if (role !== 'basecard' && role !== 'boxlayout') {
      fail('capabilities 只允许 basecard / boxlayout 声明', 'capabilities');
    }
    const capabilities = expectObject(root.capabilities, 'capabilities');
    rejectUnknownKeys(capabilities, ['cardTypes', 'layouts'], 'capabilities');
    if (capabilities.cardTypes !== undefined && capabilities.layouts !== undefined) {
      fail('cardTypes 与 layouts 互斥', 'capabilities');
    }
    if (role === 'basecard') {
      if (capabilities.cardTypes === undefined) {
        fail('basecard 必须声明 capabilities.cardTypes', 'capabilities.cardTypes');
      }
      if (capabilities.layouts !== undefined) {
        fail('basecard 禁止声明 capabilities.layouts', 'capabilities.layouts');
      }
      validateCardTypes(capabilities, 'capabilities', members, input.catalog, contents);
    } else {
      if (capabilities.layouts === undefined) {
        fail('boxlayout 必须声明 capabilities.layouts', 'capabilities.layouts');
      }
      if (capabilities.cardTypes !== undefined) {
        fail('boxlayout 禁止声明 capabilities.cardTypes', 'capabilities.cardTypes');
      }
      validateLayouts(capabilities, 'capabilities', members, input.catalog, contents);
    }
  } else if (role === 'basecard' || role === 'boxlayout') {
    fail(`${role} 必须声明 capabilities`, 'capabilities');
  }

  if (root.ui !== undefined) {
    if (role !== 'app') {
      fail('ui 只允许 app 角色声明', 'ui');
    }
    validateUi(root.ui, 'ui', members);
  } else if (role === 'app') {
    fail('app 必须声明 ui 与 ui.surface', 'ui');
  }

  if (root.fileAssociations !== undefined) {
    if (role !== 'app' && role !== 'service') {
      fail('fileAssociations 只允许 app / service 声明', 'fileAssociations');
    }
    validateFileAssociations(root.fileAssociations, 'fileAssociations');
  }

  if (root.deepLinks !== undefined) {
    if (role !== 'app') {
      fail('deepLinks 只允许 app 声明', 'deepLinks');
    }
    validateDeepLinks(root.deepLinks, 'deepLinks');
  }

  if (root.healthCheck !== undefined) {
    if (role !== 'service') {
      fail('healthCheck 只允许 service 声明', 'healthCheck');
    }
    validateHealthCheck(root.healthCheck, 'healthCheck');
  }

  if (root.cli !== undefined) {
    if (role !== 'app' && role !== 'service') {
      fail('cli 只允许 app / service 声明', 'cli');
    }
    validateCliCommands(root.cli, role, id, 'cli', input.catalog);
  }

  return {
    id,
    version: versionText,
    role,
    name,
    dependencies,
    permissions,
    warnings,
  };
}
