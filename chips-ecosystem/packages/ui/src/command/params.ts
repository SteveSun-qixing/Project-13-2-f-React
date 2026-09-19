/**
 * 命令参数采集：按 `paramsSchema`（平台 JSON Schema 子集）描述字段、校验并组装 `payload`。
 *
 * 权威：《薯片生态文档库/05-接口与契约/04-能力契约规范》§5（关键字子集与编写规则）、
 * 《13-命令系统契约》§5.2（参数型命令在面板内先收集参数再调用；可选参数缺省不写入 payload）。
 * 平台仍是参数的最终校验者（`COMMAND_ARGS_INVALID`）；本模块只做面板内的采集与最小自检。
 */

/** 参数控件形态。 */
export type CommandParamKind = 'text' | 'number' | 'boolean' | 'enum' | 'multi-enum' | 'json';

/** 枚举选项：`key` 供控件取值，`value` 为写回 payload 的原始值。 */
export interface ICommandEnumOption {
  readonly key: string;
  readonly label: string;
  readonly value: unknown;
}

/** 参数字段描述。 */
export interface ICommandParamField {
  readonly name: string;
  /** 字段标题（schema `title`，缺省为字段名）。 */
  readonly title: string;
  readonly description?: string;
  readonly required: boolean;
  readonly kind: CommandParamKind;
  readonly options?: readonly ICommandEnumOption[];
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly integer?: boolean;
  /** schema `default` 注解；只作为面板初值，不代表平台默认值。 */
  readonly defaultValue?: unknown;
}

/** 面板内的参数取值。 */
export type CommandParamValue = string | boolean | readonly string[];

/** 采集结果：`payload` 或逐字段简体中文错误。 */
export type BuildCommandPayloadResult =
  | { readonly payload: Readonly<Record<string, unknown>> }
  | { readonly errors: Readonly<Record<string, string>> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** 解析本地 `$defs` 引用（`#/$defs/<name>`）；非本地引用原样返回。 */
function resolveSchemaRef(
  schema: Record<string, unknown>,
  root: Record<string, unknown>
): Record<string, unknown> {
  const ref = readString(schema.$ref);
  if (ref === undefined || !ref.startsWith('#/$defs/')) {
    return schema;
  }
  const defs = isRecord(root.$defs) ? root.$defs : undefined;
  const target = defs?.[ref.slice('#/$defs/'.length)];
  return isRecord(target) ? target : schema;
}

/** 枚举值 → 选项（`key` 用字符串化值，`label` 用值的展示文本）。 */
function describeEnumOptions(values: readonly unknown[]): readonly ICommandEnumOption[] {
  return values.map((value) => {
    const key = String(value);
    return { key, label: key, value };
  });
}

/** 单个属性 → 字段描述；缺字段名或不可描述时返回 `null`。 */
function describeField(
  name: string,
  property: unknown,
  requiredNames: readonly string[],
  root: Record<string, unknown>
): ICommandParamField | null {
  if (name.length === 0 || !isRecord(property)) {
    return null;
  }
  const schema = resolveSchemaRef(property, root);
  const title = readString(schema.title) ?? name;
  const description = readString(schema.description);
  const required = requiredNames.includes(name);
  const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined;
  const type = readString(schema.type);

  const kind: CommandParamKind =
    enumValues !== undefined
      ? 'enum'
      : type === 'boolean'
        ? 'boolean'
        : type === 'integer' || type === 'number'
          ? 'number'
          : type === 'array' || type === 'object'
            ? 'json'
            : 'text';

  const items =
    kind === 'json' && type === 'array' && isRecord(schema.items) ? schema.items : undefined;
  const itemEnum = items !== undefined && Array.isArray(items.enum) ? items.enum : undefined;

  const options =
    kind === 'enum' && enumValues !== undefined
      ? describeEnumOptions(enumValues)
      : itemEnum !== undefined
        ? describeEnumOptions(itemEnum)
        : undefined;

  const resolvedKind: CommandParamKind =
    options !== undefined && kind === 'json' ? 'multi-enum' : kind;

  const minLength = readNumber(schema.minLength);
  const maxLength = readNumber(schema.maxLength);
  const minimum = readNumber(schema.minimum);
  const maximum = readNumber(schema.maximum);

  return {
    name,
    title,
    required,
    kind: resolvedKind,
    ...(description === undefined ? {} : { description }),
    ...(options === undefined ? {} : { options }),
    ...(minLength === undefined ? {} : { minLength }),
    ...(maxLength === undefined ? {} : { maxLength }),
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
    ...(type === 'integer' ? { integer: true } : {}),
    ...(schema.default === undefined ? {} : { defaultValue: schema.default }),
  };
}

/**
 * 判断命令是否需要在面板内采集参数：声明了 `paramsSchema` 且至少一个必填字段。
 *
 * @param schema `ICommandDefinition.paramsSchema`
 * @returns 是否需要参数采集
 */
export function shouldCollectCommandParams(
  schema: Readonly<Record<string, unknown>> | undefined
): boolean {
  if (schema === undefined) {
    return false;
  }
  const properties = isRecord(schema.properties) ? schema.properties : undefined;
  if (properties === undefined) {
    return false;
  }
  const required = Array.isArray(schema.required) ? schema.required : [];
  return required.some((name) => typeof name === 'string' && name.length > 0 && name in properties);
}

/**
 * 按 `paramsSchema` 描述参数字段。
 *
 * @param schema `ICommandDefinition.paramsSchema`
 * @returns 字段描述列表；schema 不可描述时为空数组
 */
export function describeCommandParams(
  schema: Readonly<Record<string, unknown>> | undefined
): readonly ICommandParamField[] {
  if (schema === undefined || !isRecord(schema.properties)) {
    return [];
  }
  const requiredNames = Array.isArray(schema.required)
    ? schema.required.filter((name): name is string => typeof name === 'string')
    : [];
  const fields: ICommandParamField[] = [];
  for (const [name, property] of Object.entries(schema.properties)) {
    const field = describeField(name, property, requiredNames, schema);
    if (field !== null) {
      fields.push(field);
    }
  }
  return fields;
}

/**
 * 生成面板内参数初值。
 *
 * @param fields 字段描述
 * @returns 逐字段初值（布尔为 `false`，多选为 `[]`，其余为空字符串）
 */
export function createInitialParamValues(
  fields: readonly ICommandParamField[]
): Readonly<Record<string, CommandParamValue>> {
  const values: Record<string, CommandParamValue> = {};
  for (const field of fields) {
    if (field.kind === 'boolean') {
      values[field.name] = field.defaultValue === true;
    } else if (field.kind === 'multi-enum') {
      const preset = Array.isArray(field.defaultValue) ? field.defaultValue.map(String) : [];
      values[field.name] = preset;
    } else {
      values[field.name] = toInitialText(field.defaultValue);
    }
  }
  return values;
}

/**
 * schema `default`（不可信输入）→ 文本 / 数字 / 枚举控件初值。
 *
 * 只接受可直写为输入框文本的标量；对象、数组等形态退为空串，避免出现
 * `[object Object]` 之类的默认文本。
 */
function toInitialText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function isEmptyValue(value: CommandParamValue | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

/** 校验单个字段；通过时返回写回 payload 的值，失败时返回简体中文错误。 */
function convertField(
  field: ICommandParamField,
  value: CommandParamValue | undefined
):
  | { readonly ok: true; readonly value?: unknown }
  | { readonly ok: false; readonly message: string }
  | null {
  if (isEmptyValue(value)) {
    if (field.required) {
      return { ok: false, message: `${field.title}为必填项` };
    }
    return null;
  }

  switch (field.kind) {
    case 'text': {
      const text = String(value);
      if (field.minLength !== undefined && text.length < field.minLength) {
        return { ok: false, message: `${field.title}长度不得少于 ${field.minLength} 个字符` };
      }
      if (field.maxLength !== undefined && text.length > field.maxLength) {
        return { ok: false, message: `${field.title}长度不得超过 ${field.maxLength} 个字符` };
      }
      return { ok: true, value: text };
    }
    case 'number': {
      const text = String(value).trim();
      const numeric = Number(text);
      if (!Number.isFinite(numeric) || (field.integer === true && !Number.isInteger(numeric))) {
        return {
          ok: false,
          message: `${field.title}必须是${field.integer === true ? '整数' : '数字'}`,
        };
      }
      if (field.minimum !== undefined && numeric < field.minimum) {
        return { ok: false, message: `${field.title}不得小于 ${field.minimum}` };
      }
      if (field.maximum !== undefined && numeric > field.maximum) {
        return { ok: false, message: `${field.title}不得大于 ${field.maximum}` };
      }
      return { ok: true, value: numeric };
    }
    case 'boolean':
      return { ok: true, value: value === true };
    case 'enum': {
      const key = String(value);
      const option = field.options?.find((candidate) => candidate.key === key);
      if (option === undefined) {
        return { ok: false, message: `${field.title}的取值不在可选范围内` };
      }
      return { ok: true, value: option.value };
    }
    case 'multi-enum': {
      const keys = Array.isArray(value) ? value : [String(value)];
      const options = field.options ?? [];
      const selected: unknown[] = [];
      for (const key of keys) {
        const option = options.find((candidate) => candidate.key === key);
        if (option === undefined) {
          return { ok: false, message: `${field.title}的取值不在可选范围内` };
        }
        selected.push(option.value);
      }
      return { ok: true, value: selected };
    }
    case 'json': {
      try {
        return { ok: true, value: JSON.parse(String(value)) as unknown };
      } catch {
        return { ok: false, message: `${field.title}不是合法的 JSON` };
      }
    }
    default:
      return { ok: false, message: `${field.title}的参数类型不受支持` };
  }
}

/**
 * 组装命令调用 `payload`。
 *
 * 规则：必填字段缺失、类型与约束不符时返回逐字段错误；可选字段留空不写入 `payload`；
 * 布尔字段总是写入（开关的取值始终明确）。
 *
 * @param fields 字段描述
 * @param values 面板取值
 * @returns `payload` 或逐字段错误
 */
export function buildCommandPayload(
  fields: readonly ICommandParamField[],
  values: Readonly<Record<string, CommandParamValue>>
): BuildCommandPayloadResult {
  const payload: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const converted = convertField(field, values[field.name]);
    if (converted === null) {
      continue;
    }
    if (!converted.ok) {
      errors[field.name] = converted.message;
      continue;
    }
    payload[field.name] = converted.value;
  }
  if (Object.keys(errors).length > 0) {
    return { errors };
  }
  return { payload };
}
