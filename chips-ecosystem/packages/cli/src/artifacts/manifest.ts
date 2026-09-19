/**
 * 插件清单（`manifest.yaml`）解析与校验（[插件清单规范] §二–§七、§九；[CLI 完整参考] §5.1、§5.2）。
 *
 * 本模块是 CLI 侧清单校验的唯一实现：五阶段校验的"清单校验"阶段与 `plugin pack` 的
 * 打包前校验共用；校验失败一律携带 `details.stage = 'manifest'` 与字段指针（`pointer`）。
 * 卡片类型 / 布局类型 / 能力登记表由目录端口提供（平台目录），未提供时只按文法校验。
 */

import { parse as parseYaml } from 'yaml';

import { cliError } from '../errors.js';
import type { CliPluginRole } from '../client/types.js';
import type { IFileSystemPort } from '../args/filesystem.js';
import { FIXED_COMMAND_ROOTS, COMMAND_PATH_SEGMENT_PATTERN } from '../plugin-cli/index.js';
import { isValidRange, parseSemver, satisfiesRange, parseRange } from './semver.js';
import {
  allPluginRoles,
  validatePermissionRequest,
  type IPermissionCatalog,
} from './permission-catalog.js';

const PLUGIN_ID_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const CARD_TYPE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*(\.[a-z][a-z0-9-]*)*$/;
const LAYOUT_TYPE_ID_PATTERN = /^chips\.layout\.[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const COMMAND_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const MAPS_TO_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const PARAMETER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/i;
const DURATION_PATTERN = /^(\d+)(ms|s|m)$/;
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

/** 校验输入。 */
export interface IManifestValidationInput {
  /** 已解析的 YAML 根节点。 */
  readonly manifest: unknown;
  /** 包内成员路径集合（`.cpk` 成员或目录态相对路径，POSIX 分隔）。 */
  readonly members: ReadonlySet<string>;
  readonly catalog: IPermissionCatalog;
  /** 当前平台版本；提供时校验 `engines.chips` 门禁。 */
  readonly platformVersion?: string;
  /** 源码 `package.json` 的版本；提供时要求与 `manifest.version` 一致。 */
  readonly packageVersion?: string;
}

/** 校验结果。 */
export interface IManifestValidationResult {
  readonly id: string;
  readonly version: string;
  readonly role: CliPluginRole;
  readonly name: string;
  readonly warnings: readonly string[];
}

function fail(message: string, pointer: string, code = 'CPK_MANIFEST_INVALID'): never {
  throw cliError(code, message, { stage: 'manifest', pointer });
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
  options?: { readonly allowEmpty?: boolean }
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
 * 不做 `String(value)` 隐式字符串化——清单里写成对象/数组的取值会被字符串化成
 * `[object Object]` 这类伪值，必须先按字符串收紧再比对候选。
 */
function expectEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  pointer: string,
  message: string
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
  pointer: string
): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      fail(
        `出现未登记字段：${pointer === '' ? key : `${pointer}.${key}`}`,
        pointer === '' ? key : `${pointer}.${key}`
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

/** 读取目录态清单的插件角色（`manifest.yaml` 缺失返回 undefined）。 */
export function readManifestRole(
  fileSystem: IFileSystemPort,
  dir: string
): CliPluginRole | undefined {
  const path = `${dir.replace(/\/+$/, '')}/manifest.yaml`;
  if (!fileSystem.exists(path)) {
    return undefined;
  }
  const root = expectObject(parseManifestText(fileSystem.readText(path)), '');
  const type = root.type;
  if (type === 'basecard' || type === 'boxlayout' || type === 'app' || type === 'service') {
    return type;
  }
  return undefined;
}

function validateAssetRef(
  value: string,
  pointer: string,
  members: ReadonlySet<string>,
  options?: { readonly imageOnly?: boolean }
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
  fileSystem: IFileSystemPort | undefined,
  value: string,
  pointer: string,
  members: ReadonlySet<string>,
  contents?: ReadonlyMap<string, Uint8Array>
): void {
  validateAssetRef(value, pointer, members);
  validateJsonSchemaDocument(fileSystem, value, pointer, contents);
}

function validateJsonSchemaDocument(
  fileSystem: IFileSystemPort | undefined,
  path: string,
  pointer: string,
  contents?: ReadonlyMap<string, Uint8Array>
): void {
  const bytes = contents?.get(path);
  const text =
    bytes !== undefined
      ? new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      : fileSystem !== undefined
        ? fileSystem.readText(path)
        : undefined;
  if (text === undefined) {
    return;
  }
  let schema: unknown;
  try {
    schema = JSON.parse(text) as unknown;
  } catch (error) {
    fail(
      `configSchema 不是合法 JSON：${path}（${error instanceof Error ? error.message : String(error)}）`,
      pointer
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
  seenPositions: Set<number>
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
    pointer
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
      `${pointer}.validation`
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
      `${pointer}.path`
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
        'path.overwrite 取值非法'
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
      `${pointer}.ui`
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
  role: CliPluginRole,
  pluginId: string,
  pointer: string,
  catalog: IPermissionCatalog
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
      commandPointer
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
      `${commandPointer}.target`
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
            'surface.reuse 取值非法'
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
        `${commandPointer}.target.capability`
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
          seenPositions
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
          new Set<number>()
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
          'output.json 取值非法'
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

function validateRuntime(value: unknown, role: CliPluginRole, pointer: string): void {
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
  fileSystem: IFileSystemPort | undefined,
  contents: ReadonlyMap<string, Uint8Array> | undefined
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
      cardPointer
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
        { imageOnly: true }
      );
    }
    if (card.configSchema !== undefined) {
      validateJsonSchemaRef(
        fileSystem,
        expectString(card.configSchema, `${cardPointer}.configSchema`),
        `${cardPointer}.configSchema`,
        members,
        contents
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
          `${cardPointer}.exportFormats[]`
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
  fileSystem: IFileSystemPort | undefined,
  contents: ReadonlyMap<string, Uint8Array> | undefined
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
      layoutPointer
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
        {
          imageOnly: true,
        }
      );
    }
    validateJsonSchemaRef(
      fileSystem,
      expectString(layout.configSchema ?? '', `${layoutPointer}.configSchema`),
      `${layoutPointer}.configSchema`,
      members,
      contents
    );
    const schemaVersions = expectString(
      layout.schemaVersions ?? '',
      `${layoutPointer}.schemaVersions`
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
      associationPointer
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
          `${associationPointer}.extensions[${extensionIndex}]`
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
        {
          imageOnly: true,
        }
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

/** 校验清单。 */
export function validateManifest(
  input: IManifestValidationInput,
  fileSystem?: IFileSystemPort
): IManifestValidationResult {
  const members = input.members;
  const contents: ReadonlyMap<string, Uint8Array> | undefined = undefined;
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
    ''
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
  if (!allPluginRoles().includes(type as CliPluginRole)) {
    fail(`type 必须为 basecard / boxlayout / app / service：${type}`, 'type');
  }
  const role = type as CliPluginRole;
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
      'version'
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
        fail(
          `engines.chips 不满足当前平台版本：需要 ${chips}，当前 ${input.platformVersion}`,
          'engines.chips',
          'CPK_ENGINE_UNSUPPORTED'
        );
      }
    }
  }

  const warnings: string[] = [];
  if (root.dependencies !== undefined) {
    const dependencies = expectArray(root.dependencies, 'dependencies');
    const seen = new Set<string>();
    dependencies.forEach((item, index) => {
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
    });
  }

  if (root.permissions !== undefined) {
    const permissions = expectArray(root.permissions, 'permissions');
    permissions.forEach((permission, index) => {
      validatePermissionRequest({
        request: expectString(permission, `permissions[${index}]`),
        role,
        catalog: input.catalog,
        pointer: `permissions[${index}]`,
      });
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
      validateCardTypes(capabilities, 'capabilities', members, input.catalog, fileSystem, contents);
    } else {
      if (capabilities.layouts === undefined) {
        fail('boxlayout 必须声明 capabilities.layouts', 'capabilities.layouts');
      }
      if (capabilities.cardTypes !== undefined) {
        fail('boxlayout 禁止声明 capabilities.cardTypes', 'capabilities.cardTypes');
      }
      validateLayouts(capabilities, 'capabilities', members, input.catalog, fileSystem, contents);
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

  return { id, version: versionText, role, name, warnings };
}
