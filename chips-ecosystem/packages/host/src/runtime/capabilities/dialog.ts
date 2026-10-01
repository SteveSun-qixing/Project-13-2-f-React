/**
 * 平台内置能力域：`dialog:open` / `dialog:save`（04-能力契约规范 §7.7、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.7（输入输出契约：取消不是错误；用户选择不产生文件系统授权）、
 * §6.2（`dialogs:use`）、§11.4（`DIALOG_FAILED`），`17-跨端Shell与平台抽象设计` §5.1/§5.2
 * （分面闸：分面缺失整体不注册）、§4.3（能力语义、输入 schema、权限判定在能力层）。
 *
 * @remarks
 * - 这是组合根默认装配的内置单元（`createBuiltinCapabilities`）：处理器直连 PAL `dialog` 端口，
 *   能力模块不感知 Electron（平台差异收敛在端口注入面）。
 * - 输入校验：路由顶层 `required` 准入之外，本域按 §7.7 schema 逐字段深度校验，
 *   越界输入确定性拒绝（`BRIDGE_INVALID_INPUT`）；`filters` 扩展名带点号形式原样交端口
 *   （Electron 归一在端口）。
 * - 返回路径的绝对性纪律（契约输出即"选中的绝对路径"）由 PAL `dialog` 端口按文件域
 *   系统级校验链单点承载（与 `storage` 端口 `assertAbsolutePath` 同源）；用户取消原样返回
 *   （`canceled: true`），不是错误。
 */

import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import {
  optionalBooleanField,
  optionalStringField,
  readInputRecord,
  isFacetReady,
  systemServiceInputError,
  toPortCall,
} from './system-service-common.js';

/** 内置 `dialog:*` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const DIALOG_CAPABILITY_IDS = {
  open: 'dialog:open',
  save: 'dialog:save',
} as const;

/** 对话框域权限 ID（R19 §6.2：`dialogs:use`，仅 `app` 角色可持有）。 */
export const DIALOG_PERMISSION_IDS = {
  use: 'dialogs:use',
} as const;

/** 文件过滤器项（§7.7 同构）。 */
interface IDialogFilterInput {
  readonly name: string;
  readonly extensions: readonly string[];
}

/** §7.7 `filters` 的共用量 schema 片段（`dialog:open` / `dialog:save` 同形）。 */
const FILTERS_SCHEMA = {
  type: 'array',
  maxItems: 16,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'extensions'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 64 },
      extensions: {
        type: 'array',
        minItems: 1,
        maxItems: 32,
        items: { type: 'string', pattern: '^\\.[A-Za-z0-9]+$' },
      },
    },
  },
} as const;

/** 输入 JSON Schema（逐字镜像 §7.7 `dialogInputSchemas`）。 */
export const DIALOG_INPUT_SCHEMAS: Readonly<Record<'dialog:open' | 'dialog:save', Readonly<Record<string, unknown>>>> =
  {
    'dialog:open': {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', maxLength: 128 },
        multiple: { type: 'boolean', default: false },
        directory: { type: 'boolean', default: false },
        filters: FILTERS_SCHEMA,
      },
    },
    'dialog:save': {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', maxLength: 128 },
        defaultPath: { type: 'string', minLength: 1 },
        filters: FILTERS_SCHEMA,
      },
    },
  };

/**
 * 对话框调用超时（毫秒）。
 *
 * @remarks 对话框为用户交互模态：选取耗时由用户决定，30 秒注册默认值会拦下正常选取；
 * 显式放宽至 10 分钟，会话取消与截止仍由 `ctx` 即时收口（端口 `assertCallActive` 响应）。
 */
const DIALOG_TIMEOUT_MS = 600_000;

/** 扩展名文法（§7.7 `pattern: '^\\.[A-Za-z0-9]+$'`）。 */
const EXTENSION_PATTERN = /^\.[A-Za-z0-9]+$/;

/** 校验并收敛 `filters` 输入（越界即 `BRIDGE_INVALID_INPUT`）。 */
function readFiltersField(capabilityId: string, record: Record<string, unknown>): readonly IDialogFilterInput[] | null {
  const raw = record.filters;
  if (raw === undefined) {
    return null;
  }
  if (!Array.isArray(raw) || raw.length > 16) {
    throw systemServiceInputError(capabilityId, 'filters 必须是不超过 16 项的数组');
  }
  return raw.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw systemServiceInputError(capabilityId, 'filters 项必须是对象');
    }
    const entry = item as Record<string, unknown>;
    for (const key of Object.keys(entry)) {
      if (key !== 'name' && key !== 'extensions') {
        throw systemServiceInputError(capabilityId, `不支持的过滤器字段：${key}`);
      }
    }
    const name = entry.name;
    if (typeof name !== 'string' || name.length < 1 || name.length > 64) {
      throw systemServiceInputError(capabilityId, 'filters.name 必须是 1..64 字符的字符串');
    }
    const extensions = entry.extensions;
    if (!Array.isArray(extensions) || extensions.length < 1 || extensions.length > 32) {
      throw systemServiceInputError(capabilityId, 'filters.extensions 必须是 1..32 项的数组');
    }
    const normalizedExtensions: string[] = [];
    for (const extension of extensions) {
      if (typeof extension !== 'string' || !EXTENSION_PATTERN.test(extension)) {
        throw systemServiceInputError(capabilityId, 'filters.extensions 项必须匹配 ^\\.[A-Za-z0-9]+$');
      }
      normalizedExtensions.push(extension);
    }
    return { name, extensions: normalizedExtensions };
  });
}

/** 校验 `dialog:open` 输入并收敛为端口选项载荷。 */
function readOpenInput(input: unknown): {
  title: string | null;
  multiple: boolean | null;
  directory: boolean | null;
  filters: readonly IDialogFilterInput[] | null;
} {
  const record = readInputRecord(DIALOG_CAPABILITY_IDS.open, input, ['title', 'multiple', 'directory', 'filters']);
  return {
    title: optionalStringField(DIALOG_CAPABILITY_IDS.open, record, 'title', { maxLength: 128 }),
    multiple: optionalBooleanField(DIALOG_CAPABILITY_IDS.open, record, 'multiple'),
    directory: optionalBooleanField(DIALOG_CAPABILITY_IDS.open, record, 'directory'),
    filters: readFiltersField(DIALOG_CAPABILITY_IDS.open, record),
  };
}

/** 校验 `dialog:save` 输入并收敛为端口选项载荷。 */
function readSaveInput(input: unknown): {
  title: string | null;
  defaultPath: string | null;
  filters: readonly IDialogFilterInput[] | null;
} {
  const record = readInputRecord(DIALOG_CAPABILITY_IDS.save, input, ['title', 'defaultPath', 'filters']);
  return {
    title: optionalStringField(DIALOG_CAPABILITY_IDS.save, record, 'title', { maxLength: 128 }),
    defaultPath: optionalStringField(DIALOG_CAPABILITY_IDS.save, record, 'defaultPath', { minLength: 1 }),
    filters: readFiltersField(DIALOG_CAPABILITY_IDS.save, record),
  };
}

/**
 * 构造内置 `dialog:open` / `dialog:save` 能力注册条目（分面缺位时返回空数组，整体不注册）。
 */
export function createDialogCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  if (!isFacetReady(host.matrix, host.ports, 'dialog')) {
    return [];
  }
  const dialog = host.ports.dialog!;
  const open: IHostCapabilityDescriptor = {
    id: DIALOG_CAPABILITY_IDS.open,
    permissions: [DIALOG_PERMISSION_IDS.use],
    schema: DIALOG_INPUT_SCHEMAS['dialog:open'],
    targets: [],
    timeoutMs: DIALOG_TIMEOUT_MS,
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const payload = readOpenInput(input);
      const result = await dialog.open({
        ...toPortCall(ctx),
        ...(payload.title === null ? {} : { title: payload.title }),
        ...(payload.multiple === null ? {} : { multiple: payload.multiple }),
        ...(payload.directory === null ? {} : { directory: payload.directory }),
        ...(payload.filters === null ? {} : { filters: payload.filters }),
      });
      return { canceled: result.canceled, paths: [...result.paths] };
    },
  };
  const save: IHostCapabilityDescriptor = {
    id: DIALOG_CAPABILITY_IDS.save,
    permissions: [DIALOG_PERMISSION_IDS.use],
    schema: DIALOG_INPUT_SCHEMAS['dialog:save'],
    targets: [],
    timeoutMs: DIALOG_TIMEOUT_MS,
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const payload = readSaveInput(input);
      const result = await dialog.save({
        ...toPortCall(ctx),
        ...(payload.title === null ? {} : { title: payload.title }),
        ...(payload.defaultPath === null ? {} : { defaultPath: payload.defaultPath }),
        ...(payload.filters === null ? {} : { filters: payload.filters }),
      });
      return { canceled: result.canceled, path: result.path };
    },
  };
  return [open, save];
}
