/**
 * 参数解析引擎（[CLI 完整参考] §2.1、§5.2）。
 *
 * 一次解析覆盖：全局选项剥离后的 token、11 种参数类型、`position` / `short` / `mapsTo` /
 * `default` / `choices` / `multiple` / `validation` / `path` / `batch` 规则与输出冲突四策略。
 * 内建命令与插件命令共用本引擎，保证解析语义唯一。
 *
 * 解析总则（§5.2）：
 * 1. 全局选项已被剥离，不进入 payload；
 * 2. 未知选项、未知位置参数与多余 token 返回 `CLI_ARGUMENT_INVALID`，不静默忽略；
 * 3. `--` 之后的 token 一律按位置参数处理；
 * 4. 缺省值与 `mapsTo` 在解析后统一写入 payload，`mapsTo` 点分路径按需创建嵌套对象。
 */

import { dirname, extname, isAbsolute, resolve } from 'node:path';

import { cliError } from '../errors.js';
import type { IFileSystemPort } from './filesystem.js';
import type {
  IBatchRules,
  IParameterDeclaration,
  IParameterSet,
  IPathRules,
  OutputOverwritePolicy,
} from './types.js';

/** 解析请求。 */
export interface IParseRequest {
  readonly argv: readonly string[];
  readonly declarations: IParameterSet;
  readonly cwd: string;
  readonly fileSystem: IFileSystemPort;
  /**
   * 用户传入 `--overwrite` 且命令未声明同名选项时为 true：
   * 把输出路径声明的默认 `fail` 覆盖为 `overwrite`（[CLI 完整参考] §5.2）。
   */
  readonly overwriteOverride?: boolean;
}

/** 解析结果。 */
export interface IParseResult {
  readonly payload: Readonly<Record<string, unknown>>;
  readonly values: ReadonlyMap<string, unknown>;
  /** 输出冲突策略为 `skip` 且目标已存在：不调用目标，直接返回 skipped 结果。 */
  readonly skipped: boolean;
}

const PARAMETER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/i;
const MAPS_TO_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const RENAME_LIMIT = 1000;

interface IRawArguments {
  readonly positionals: readonly string[];
  readonly named: ReadonlyMap<string, readonly string[]>;
}

/** 解析参数并构造 payload。 */
export function parseParameters(request: IParseRequest): IParseResult {
  const argumentDeclarations = prepareArguments(request.declarations.arguments ?? []);
  const optionDeclarations = request.declarations.options ?? [];
  const byName = new Map<string, IParameterDeclaration>();
  const byShort = new Map<string, IParameterDeclaration>();
  for (const declaration of [...argumentDeclarations, ...optionDeclarations]) {
    validateDeclaration(declaration);
    if (byName.has(declaration.name)) {
      throw declarationError(`参数名重复：${declaration.name}`, declaration.name);
    }
    byName.set(declaration.name, declaration);
    if (declaration.short !== undefined) {
      if (byShort.has(declaration.short)) {
        throw declarationError(`短名重复：-${declaration.short}`, declaration.name);
      }
      byShort.set(declaration.short, declaration);
    }
  }

  const raw = tokenize(request.argv, byName, byShort);
  const payload: Record<string, unknown> = {};
  const values = new Map<string, unknown>();
  let skipped = false;

  const positionals = raw.positionals;
  let consumedPositionals = 0;
  for (let index = 0; index < argumentDeclarations.length; index += 1) {
    const declaration = argumentDeclarations[index];
    if (declaration === undefined) {
      continue;
    }
    const isLast = index === argumentDeclarations.length - 1;
    const acceptsRest = isLast && (declaration.multiple === true || declaration.type === 'stringList');
    const rawValues = acceptsRest
      ? positionals.slice(consumedPositionals)
      : positionals.slice(consumedPositionals, consumedPositionals + 1).filter((value) => value !== undefined);
    if (!acceptsRest) {
      consumedPositionals += rawValues.length;
    } else {
      consumedPositionals = positionals.length;
    }
    if (rawValues.length === 0) {
      const fallback = applyDefault(declaration);
      if (fallback.present) {
        values.set(declaration.name, fallback.value);
        writeMapped(payload, declaration, fallback.value);
      } else if (declaration.required === true) {
        throw cliError('CLI_ARGUMENT_INVALID', `缺少必填参数：${declaration.name}`, {
          param: declaration.name,
          kind: 'argument',
        });
      }
    } else {
      const outcome = convertValues(declaration, rawValues, request, `arguments.${declaration.name}`);
      if (outcome.skipped) {
        skipped = true;
      }
      values.set(declaration.name, outcome.value);
      writeMapped(payload, declaration, outcome.value);
    }
  }
  if (consumedPositionals < positionals.length) {
    throw cliError('CLI_ARGUMENT_INVALID', `存在多余的位置参数：${positionals[consumedPositionals] ?? ''}`, {
      token: positionals[consumedPositionals],
    });
  }

  for (const declaration of optionDeclarations) {
    const rawValues = raw.named.get(declaration.name) ?? [];
    if (rawValues.length === 0) {
      const fallback = applyDefault(declaration);
      if (fallback.present) {
        values.set(declaration.name, fallback.value);
        writeMapped(payload, declaration, fallback.value);
      } else if (declaration.required === true) {
        throw cliError('CLI_ARGUMENT_INVALID', `缺少必填选项：--${declaration.name}`, {
          param: declaration.name,
          kind: 'option',
        });
      }
      continue;
    }
    const outcome = convertValues(declaration, rawValues, request, `options.${declaration.name}`);
    if (outcome.skipped) {
      skipped = true;
    }
    values.set(declaration.name, outcome.value);
    writeMapped(payload, declaration, outcome.value);
  }

  return { payload, values, skipped };
}

/** 声明序：位置参数按 `position` 升序（缺省按声明顺序）。 */
function prepareArguments(declarations: readonly IParameterDeclaration[]): readonly IParameterDeclaration[] {
  return declarations
    .map((declaration, index) => ({ declaration, index }))
    .sort((left, right) => {
      const leftPosition = left.declaration.position ?? left.index;
      const rightPosition = right.declaration.position ?? right.index;
      return leftPosition - rightPosition;
    })
    .map((entry) => entry.declaration);
}

function validateDeclaration(declaration: IParameterDeclaration): void {
  if (!PARAMETER_NAME_PATTERN.test(declaration.name)) {
    throw declarationError(`参数名不符合文法：${declaration.name}`, declaration.name);
  }
  if (declaration.short !== undefined && !/^[A-Za-z0-9]$/.test(declaration.short)) {
    throw declarationError(`短名必须为单个字母或数字：${declaration.short}`, declaration.name);
  }
  if (declaration.mapsTo !== undefined && !MAPS_TO_PATTERN.test(declaration.mapsTo)) {
    throw declarationError(`mapsTo 不是合法点分路径：${declaration.mapsTo}`, declaration.name);
  }
  if (declaration.type === 'enum' && (declaration.choices === undefined || declaration.choices.length === 0)) {
    throw declarationError(`enum 参数必须声明 choices：${declaration.name}`, declaration.name);
  }
}

function declarationError(message: string, param: string): ReturnType<typeof cliError> {
  return cliError('CLI_COMMAND_FAILED', message, { param, stage: 'declaration' });
}

/** token 化：长/短选项、`=` 取值、布尔出现为真、`--` 终止。 */
function tokenize(
  argv: readonly string[],
  byName: ReadonlyMap<string, IParameterDeclaration>,
  byShort: ReadonlyMap<string, IParameterDeclaration>,
): IRawArguments {
  const positionals: string[] = [];
  const named = new Map<string, string[]>();
  let terminated = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }
    if (terminated) {
      positionals.push(token);
      continue;
    }
    if (token === '--') {
      terminated = true;
      continue;
    }

    let declaration: IParameterDeclaration | undefined;
    let inlineValue: string | undefined;
    if (token.startsWith('--')) {
      const body = token.slice(2);
      const equalsIndex = body.indexOf('=');
      const name = equalsIndex === -1 ? body : body.slice(0, equalsIndex);
      inlineValue = equalsIndex === -1 ? undefined : body.slice(equalsIndex + 1);
      declaration = byName.get(name);
      if (declaration === undefined) {
        throw cliError('CLI_ARGUMENT_INVALID', `未知选项：--${name}`, { option: name });
      }
    } else if (token.startsWith('-') && token.length > 1) {
      const body = token.slice(1);
      const equalsIndex = body.indexOf('=');
      const name = equalsIndex === -1 ? body : body.slice(0, equalsIndex);
      inlineValue = equalsIndex === -1 ? undefined : body.slice(equalsIndex + 1);
      declaration = byShort.get(name);
      if (declaration === undefined) {
        throw cliError('CLI_ARGUMENT_INVALID', `未知选项：-${name}`, { option: name });
      }
    } else {
      positionals.push(token);
      continue;
    }

    if (declaration.type === 'boolean') {
      const value = inlineValue ?? 'true';
      const existing = named.get(declaration.name) ?? [];
      existing.push(value);
      named.set(declaration.name, existing);
      continue;
    }

    let value = inlineValue;
    if (value === undefined) {
      const next = argv[index + 1];
      if (next === undefined) {
        throw cliError('CLI_ARGUMENT_INVALID', `选项 --${declaration.name} 缺少取值`, {
          option: declaration.name,
        });
      }
      value = next;
      index += 1;
    }
    const existing = named.get(declaration.name) ?? [];
    existing.push(value);
    named.set(declaration.name, existing);
  }

  return { positionals, named };
}

function applyDefault(declaration: IParameterDeclaration): { readonly present: boolean; readonly value?: unknown } {
  if (declaration.default === undefined) {
    return { present: false };
  }
  return { present: true, value: declaration.default };
}

interface IConversionOutcome {
  readonly value: unknown;
  readonly skipped: boolean;
}

function convertValues(
  declaration: IParameterDeclaration,
  rawValues: readonly string[],
  request: IParseRequest,
  pointer: string,
): IConversionOutcome {
  if (declaration.type === 'stringList') {
    const value = rawValues
      .flatMap((raw) => raw.split(','))
      .filter((item) => item.length > 0);
    validateValue(declaration, value, pointer);
    return { value, skipped: false };
  }
  if (declaration.multiple === true) {
    const value = rawValues.map((raw) => convertOne(declaration, raw, request, pointer));
    validateValue(declaration, value, pointer);
    return { value, skipped: false };
  }
  if (rawValues.length > 1) {
    throw cliError('CLI_ARGUMENT_INVALID', `选项 --${declaration.name} 是单值参数，不能重复传入`, {
      param: declaration.name,
    });
  }
  const raw = rawValues[0];
  if (raw === undefined) {
    throw cliError('CLI_ARGUMENT_INVALID', `选项 --${declaration.name} 缺少取值`, {
      param: declaration.name,
    });
  }
  const converted = convertOne(declaration, raw, request, pointer);
  if (declaration.type === 'path') {
    const resolved = applyPathRules(declaration, converted as string, raw, request, pointer);
    validateValue(declaration, resolved.value, pointer);
    return { value: resolved.value, skipped: resolved.skipped };
  }
  validateValue(declaration, converted, pointer);
  return { value: converted, skipped: false };
}

function convertOne(
  declaration: IParameterDeclaration,
  raw: string,
  request: IParseRequest,
  pointer: string,
): unknown {
  switch (declaration.type) {
    case 'string':
    case 'text':
      return raw;
    case 'number': {
      const value = Number(raw);
      if (raw.trim().length === 0 || !Number.isFinite(value)) {
        throw cliError('CLI_ARGUMENT_INVALID', `选项 --${declaration.name} 需要有限数值`, {
          param: declaration.name,
          value: raw,
        });
      }
      return value;
    }
    case 'integer': {
      const value = Number(raw);
      if (raw.trim().length === 0 || !Number.isInteger(value)) {
        throw cliError('CLI_ARGUMENT_INVALID', `选项 --${declaration.name} 需要整数`, {
          param: declaration.name,
          value: raw,
        });
      }
      return value;
    }
    case 'boolean': {
      if (raw === 'true') {
        return true;
      }
      if (raw === 'false') {
        return false;
      }
      throw cliError('CLI_ARGUMENT_INVALID', `布尔选项 --${declaration.name} 的取值必须为 true 或 false`, {
        param: declaration.name,
        value: raw,
      });
    }
    case 'enum': {
      return convertEnum(declaration, raw);
    }
    case 'json': {
      try {
        return JSON.parse(raw) as unknown;
      } catch (error) {
        throw cliError('CLI_ARGUMENT_INVALID', `选项 --${declaration.name} 不是合法 JSON`, {
          param: declaration.name,
          cause: error instanceof Error ? error.message : String(error),
        });
      }
    }
    case 'jsonFile': {
      const text = readParameterFile(declaration, raw, request, pointer);
      if (declaration.batch !== undefined) {
        return applyBatch(declaration, declaration.batch, text, request, pointer);
      }
      try {
        return JSON.parse(text) as unknown;
      } catch (error) {
        throw cliError('CLI_ARGUMENT_INVALID', `选项 --${declaration.name} 的文件内容不是合法 JSON`, {
          param: declaration.name,
          cause: error instanceof Error ? error.message : String(error),
        });
      }
    }
    case 'textFile': {
      const text = readParameterFile(declaration, raw, request, pointer);
      if (declaration.batch !== undefined) {
        return applyBatch(declaration, declaration.batch, text, request, pointer);
      }
      return text;
    }
    case 'path':
      return resolvePathValue(raw, request.cwd);
    default:
      throw declarationError(`不支持的参数类型：${String(declaration.type)}`, declaration.name);
  }
}

function convertEnum(declaration: IParameterDeclaration, raw: string): unknown {
  const choices = declaration.choices ?? [];
  const numeric = choices.every((choice) => typeof choice === 'number');
  const candidate: unknown = numeric ? Number(raw) : raw;
  const matched = choices.some((choice) => choice === candidate);
  if (!matched) {
    throw cliError('CLI_ARGUMENT_INVALID', `选项 --${declaration.name} 的取值不在允许集合内`, {
      param: declaration.name,
      value: raw,
      choices,
    });
  }
  return candidate;
}

function readParameterFile(
  declaration: IParameterDeclaration,
  raw: string,
  request: IParseRequest,
  pointer: string,
): string {
  const absolute = resolvePathValue(raw, request.cwd);
  if (!request.fileSystem.exists(absolute)) {
    throw cliError('CLI_PATH_NOT_FOUND', `文件不存在：${absolute}`, {
      param: declaration.name,
      pointer,
      path: absolute,
    });
  }
  if (request.fileSystem.kind(absolute) !== 'file') {
    throw cliError('CLI_PATH_INVALID', `不是文件：${absolute}`, {
      param: declaration.name,
      pointer,
      path: absolute,
    });
  }
  return request.fileSystem.readText(absolute);
}

function applyBatch(
  declaration: IParameterDeclaration,
  batch: IBatchRules,
  text: string,
  request: IParseRequest,
  pointer: string,
): readonly unknown[] {
  const format = batch.format ?? 'lines';
  let items: unknown[];
  if (format === 'lines') {
    items = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch (error) {
      throw cliError('CLI_BATCH_INVALID', `批量文件不是合法 JSON 数组：${declarationName(declaration)}`, {
        param: declaration.name,
        pointer,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    if (!Array.isArray(parsed)) {
      throw cliError('CLI_BATCH_INVALID', `批量文件顶层必须是 JSON 数组：${declarationName(declaration)}`, {
        param: declaration.name,
        pointer,
      });
    }
    items = parsed;
  }

  if (batch.itemType !== 'path') {
    return items;
  }
  const itemPath = batch.itemPath ?? {};
  return items.map((item, index) => {
    if (typeof item !== 'string') {
      throw cliError('CLI_BATCH_INVALID', `第 ${index} 项不是路径字符串`, {
        param: declaration.name,
        pointer,
        index,
      });
    }
    const resolved = applyInputPathRules(
      { name: declaration.name, type: 'path', path: itemPath },
      resolvePathValue(item, request.cwd),
      item,
      request,
      `${pointer}[${index}]`,
      index,
    );
    return resolved;
  });
}

function declarationName(declaration: IParameterDeclaration): string {
  return `--${declaration.name}`;
}

function resolvePathValue(raw: string, cwd: string): string {
  return isAbsolute(raw) ? raw : resolve(cwd, raw);
}

function applyPathRules(
  declaration: IParameterDeclaration,
  absolute: string,
  raw: string,
  request: IParseRequest,
  pointer: string,
): { readonly value: string; readonly skipped: boolean } {
  const rules = declaration.path ?? {};
  if ((rules.role ?? 'input') === 'input') {
    return { value: applyInputPathRules(declaration, absolute, raw, request, pointer), skipped: false };
  }
  const policy = effectivePolicy(rules, request.overwriteOverride === true);
  if (rules.create === true) {
    if ((rules.kind ?? 'any') === 'directory') {
      request.fileSystem.ensureDirectory(absolute);
      return { value: absolute, skipped: false };
    }
    request.fileSystem.ensureDirectory(dirname(absolute));
  }
  if (request.fileSystem.exists(absolute)) {
    if (policy === 'overwrite') {
      return { value: absolute, skipped: false };
    }
    if (policy === 'skip') {
      return { value: absolute, skipped: true };
    }
    if (policy === 'rename') {
      return { value: findAvailableName(absolute, request.fileSystem), skipped: false };
    }
    throw cliError('CLI_OUTPUT_EXISTS', `输出路径已存在：${absolute}`, {
      param: declaration.name,
      pointer,
      path: absolute,
      policy: 'fail',
    });
  }
  return { value: absolute, skipped: false };
}

function effectivePolicy(rules: IPathRules, overwriteOverride: boolean): OutputOverwritePolicy {
  const declared = rules.overwrite ?? 'fail';
  if (overwriteOverride && declared === 'fail') {
    return 'overwrite';
  }
  return declared;
}

function findAvailableName(absolute: string, fileSystem: IFileSystemPort): string {
  const extension = extname(absolute);
  const base = extension.length > 0 ? absolute.slice(0, -extension.length) : absolute;
  for (let index = 1; index <= RENAME_LIMIT; index += 1) {
    const candidate = `${base}-${index}${extension}`;
    if (!fileSystem.exists(candidate)) {
      return candidate;
    }
  }
  throw cliError('CLI_OUTPUT_RENAME_EXHAUSTED', `无法为输出路径找到可用名称：${absolute}`, {
    path: absolute,
  });
}

function applyInputPathRules(
  declaration: IParameterDeclaration,
  absolute: string,
  raw: string,
  request: IParseRequest,
  pointer: string,
  index?: number,
): string {
  const rules = declaration.path ?? {};
  const detail: { param: string; pointer: string; path: string; index?: number } = {
    param: declaration.name,
    pointer,
    path: absolute,
  };
  if (index !== undefined) {
    detail.index = index;
  }
  const fail = (code: 'CLI_PATH_INVALID' | 'CLI_PATH_NOT_FOUND', message: string): never => {
    throw cliError(code, message, detail);
  };
  const exists = request.fileSystem.exists(absolute);
  const extensions = rules.extensions;
  if (extensions !== undefined && extensions.length > 0) {
    const extension = extname(absolute).slice(1).toLowerCase();
    const allowed = extensions.map((item) => item.replace(/^\./, '').toLowerCase());
    if (!allowed.includes(extension)) {
      fail('CLI_PATH_INVALID', `路径扩展名不在允许集合内：${raw}`, );
    }
  }
  if (!exists) {
    if (rules.exists === true) {
      fail('CLI_PATH_NOT_FOUND', `路径不存在：${absolute}`);
    }
    return absolute;
  }
  const kind = request.fileSystem.kind(absolute);
  const expected = rules.kind ?? 'any';
  if (expected !== 'any' && kind !== expected) {
    fail('CLI_PATH_INVALID', expected === 'file' ? `不是文件：${absolute}` : `不是目录：${absolute}`);
  }
  return absolute;
}

function validateValue(declaration: IParameterDeclaration, value: unknown, pointer: string): void {
  const rules = declaration.validation;
  if (rules === undefined) {
    return;
  }
  const name = declaration.name;
  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      throw cliError('CLI_ARGUMENT_INVALID', `选项 --${name} 小于最小值 ${rules.min}`, {
        param: name,
        pointer,
      });
    }
    if (rules.max !== undefined && value > rules.max) {
      throw cliError('CLI_ARGUMENT_INVALID', `选项 --${name} 大于最大值 ${rules.max}`, {
        param: name,
        pointer,
      });
    }
    return;
  }
  if (typeof value === 'string') {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      throw cliError('CLI_ARGUMENT_INVALID', `选项 --${name} 长度小于 ${rules.minLength}`, {
        param: name,
        pointer,
      });
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      throw cliError('CLI_ARGUMENT_INVALID', `选项 --${name} 长度大于 ${rules.maxLength}`, {
        param: name,
        pointer,
      });
    }
    if (rules.pattern !== undefined) {
      let pattern: RegExp;
      try {
        pattern = new RegExp(rules.pattern);
      } catch (error) {
        throw declarationError(
          `pattern 不是合法正则：${rules.pattern}（${error instanceof Error ? error.message : String(error)}）`,
          name,
        );
      }
      if (!pattern.test(value)) {
        throw cliError('CLI_ARGUMENT_INVALID', `选项 --${name} 不匹配要求的格式`, {
          param: name,
          pointer,
          pattern: rules.pattern,
        });
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      throw cliError('CLI_ARGUMENT_INVALID', `选项 --${name} 的项数小于 ${rules.minLength}`, {
        param: name,
        pointer,
      });
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      throw cliError('CLI_ARGUMENT_INVALID', `选项 --${name} 的项数大于 ${rules.maxLength}`, {
        param: name,
        pointer,
      });
    }
  }
}

function writeMapped(payload: Record<string, unknown>, declaration: IParameterDeclaration, value: unknown): void {
  const path = declaration.mapsTo ?? declaration.name;
  const segments = path.split('.');
  let current = payload;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (segment === undefined) {
      continue;
    }
    const existing = current[segment];
    if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
      current = existing as Record<string, unknown>;
      continue;
    }
    const created: Record<string, unknown> = {};
    current[segment] = created;
    current = created;
  }
  const leaf = segments[segments.length - 1];
  if (leaf !== undefined) {
    current[leaf] = value;
  }
}
