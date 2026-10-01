/**
 * 平台内置能力域：`menu:set`（04-能力契约规范 §7.9、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.9（整表替换、空数组清空；`command` 经应用命令通道投递）、
 * §6.2（`menu:manage`；仅 `app` 角色可持有，08 §6.3）、§11.4（`MENU_SET_FAILED`），
 * `17-跨端Shell与平台抽象设计` §5.1/§5.2（分面闸）。
 *
 * @remarks
 * - 处理器直连 PAL `menu` 端口，能力模块不感知 Electron；菜单构建即返、不阻塞
 *   （端口契约无调用上下文参数，17 §4.2 规则 2 的阻塞口径不适用）。
 * - 菜单项激活 → 应用命令通道的转发（13-命令系统契约 §5.3）由壳在命令系统波次接线
 *   （`MenuSetOptions.onActivate`），本域只承担契约声明的整表替换。
 * - `items` 深度校验按 §7.9 schema 逐字执行：顶层项允许一层 `submenu`，子菜单项不允许再嵌套。
 */

import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import type { MenuItem } from '../../platform/contracts/index.js';
import {
  enumStringField,
  isFacetReady,
  optionalBooleanField,
  readInputRecord,
  requireStringField,
  systemServiceInputError,
} from './system-service-common.js';

/** 内置 `menu:set` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const MENU_CAPABILITY_IDS = {
  set: 'menu:set',
} as const;

/** 菜单域权限 ID（R19 §6.2：`menu:manage`）。 */
export const MENU_PERMISSION_IDS = {
  manage: 'menu:manage',
} as const;

/** 输入 JSON Schema（逐字镜像 §7.9 `integrationInputSchemas` 的 menu 项）。 */
export const MENU_INPUT_SCHEMAS: Readonly<Record<'menu:set', Readonly<Record<string, unknown>>>> = {
  'menu:set': {
    type: 'object',
    additionalProperties: false,
    required: ['target', 'items'],
    properties: {
      target: { type: 'string', enum: ['app', 'tray'] },
      items: {
        type: 'array',
        maxItems: 64,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'label'],
          properties: {
            id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$', maxLength: 64 },
            label: { type: 'string', minLength: 1, maxLength: 128 },
            command: { type: 'string', pattern: '^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$' },
            enabled: { type: 'boolean', default: true },
            submenu: {
              type: 'array',
              maxItems: 64,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'label'],
                properties: {
                  id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$', maxLength: 64 },
                  label: { type: 'string', minLength: 1, maxLength: 128 },
                  command: { type: 'string', pattern: '^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$' },
                  enabled: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
      },
    },
  },
};

/** 菜单目标枚举（§7.9 `target.enum`）。 */
const MENU_TARGETS = ['app', 'tray'] as const;

/** 菜单项 ID 文法（§7.9 `id.pattern`）。 */
const ITEM_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** 命令 ID 文法（§7.9 `command.pattern`）。 */
const COMMAND_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;

/** 校验单个菜单项共有字段（顶层项与子菜单项同形）；返回端口 `MenuItem`。 */
function readMenuItem(capabilityId: string, raw: unknown, allowSubmenu: boolean): MenuItem {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw systemServiceInputError(capabilityId, 'items 项必须是对象');
  }
  const record = raw as Record<string, unknown>;
  const allowedFields = allowSubmenu
    ? ['id', 'label', 'command', 'enabled', 'submenu']
    : ['id', 'label', 'command', 'enabled'];
  for (const key of Object.keys(record)) {
    if (!allowedFields.includes(key)) {
      throw systemServiceInputError(capabilityId, `不支持的菜单项字段：${key}`);
    }
  }
  const id = requireStringField(capabilityId, record, 'id');
  if (!ITEM_ID_PATTERN.test(id) || id.length > 64) {
    throw systemServiceInputError(capabilityId, 'items.id 必须匹配 ^[a-z0-9][a-z0-9-]*$ 且不超过 64 字符');
  }
  const label = requireStringField(capabilityId, record, 'label', { minLength: 1, maxLength: 128 });
  const command = record.command;
  if (command !== undefined && (typeof command !== 'string' || !COMMAND_PATTERN.test(command))) {
    throw systemServiceInputError(capabilityId, 'items.command 必须匹配 ^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$');
  }
  const enabled = optionalBooleanField(capabilityId, record, 'enabled');
  let submenu: readonly MenuItem[] | undefined;
  const rawSubmenu = record.submenu;
  if (rawSubmenu !== undefined) {
    if (!allowSubmenu) {
      throw systemServiceInputError(capabilityId, '子菜单项不允许再嵌套 submenu');
    }
    if (!Array.isArray(rawSubmenu) || rawSubmenu.length > 64) {
      throw systemServiceInputError(capabilityId, 'items.submenu 必须是不超过 64 项的数组');
    }
    submenu = rawSubmenu.map((item) => readMenuItem(capabilityId, item, false));
  }
  return {
    id,
    label,
    ...(command !== undefined ? { command } : {}),
    ...(enabled !== null ? { enabled } : {}),
    ...(submenu !== undefined ? { submenu } : {}),
  };
}

/**
 * 构造内置 `menu:set` 能力注册条目（分面缺位时返回空数组，整体不注册）。
 *
 * @param host 已通过壳自检的 PAL 宿主。
 */
export function createMenuCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  if (!isFacetReady(host.matrix, host.ports, 'menu')) {
    return [];
  }
  const menu = host.ports.menu!;
  const set: IHostCapabilityDescriptor = {
    id: MENU_CAPABILITY_IDS.set,
    permissions: [MENU_PERMISSION_IDS.manage],
    schema: MENU_INPUT_SCHEMAS['menu:set'],
    targets: [],
    concurrency: 'parallel',
    async handler(input): Promise<unknown> {
      const record = readInputRecord(MENU_CAPABILITY_IDS.set, input, ['target', 'items']);
      const target = enumStringField(MENU_CAPABILITY_IDS.set, record, 'target', MENU_TARGETS);
      const rawItems = record.items;
      if (!Array.isArray(rawItems) || rawItems.length > 64) {
        throw systemServiceInputError(MENU_CAPABILITY_IDS.set, 'items 必须是不超过 64 项的数组');
      }
      const items = rawItems.map((item) => readMenuItem(MENU_CAPABILITY_IDS.set, item, true));
      await menu.set(target, items);
      return undefined;
    },
  };
  return [set];
}
