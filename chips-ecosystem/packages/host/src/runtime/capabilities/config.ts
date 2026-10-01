/**
 * 平台内置能力域：`config:get` / `config:snapshot` / `config:set` / `config:reset`
 * （04-能力契约规范 §7.11、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.11（输入输出契约与 schema）、§6.2（`config:read` / `config:write`，
 * 限定值目标 `namespace`）、`10-配置系统设计` §4.4（`CONFIG_*` 错误码）、§11.3（层级语义），
 * `17-跨端Shell与平台抽象设计` §5.1/§5.2（分面闸）。
 *
 * @remarks
 * - 处理器直连 PAL `config` 端口（宿主侧用户层持久化承载；内核 `ConfigStore` 交付后按同契约
 *   切换承载，端口形状不变），能力模块不感知 Electron。
 * - 自身命名空间免权限、`platform` 命名空间需带命名空间限定值的授权（§7.11 约束）：限定值
   判定归核心权限链（`config:read:<namespace>` / `config:write:<namespace>`，Bridge 登记表
 *   目标字段 `namespace`），本层不复制第二套判定。
 * - `config:set` / `config:reset` 的 `callerId` 由本域从调用上下文注入（§11.1 `NativeConfigSetInput`：
 *   变更来源取调用方身份，不取自输入）。
 * - 默认值层（schema 声明默认值）属内核 `ConfigStore` 正式面：宿主承载未命中即
 *   `CONFIG_KEY_UNKNOWN`，`isDefault` 恒为 `false`（契约缺口随工单登记，见开发日志）。
 */

import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import {
  enumStringField,
  isFacetReady,
  jsonValueField,
  patternStringField,
  readInputRecord,
  systemServiceInputError,
  toPortCall,
} from './system-service-common.js';

/** 内置 `config:*` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const CONFIG_CAPABILITY_IDS = {
  get: 'config:get',
  snapshot: 'config:snapshot',
  set: 'config:set',
  reset: 'config:reset',
} as const;

/** 配置域权限 ID（R19 §6.2：`config:read` / `config:write`，授权记录物化 `<namespace>` 限定值）。 */
export const CONFIG_PERMISSION_IDS = {
  read: 'config:read',
  write: 'config:write',
} as const;

/** 输入 JSON Schema（逐字镜像 §7.11 `configInputSchemas`）。 */
export const CONFIG_INPUT_SCHEMAS: Readonly<
  Record<'config:get' | 'config:snapshot' | 'config:set' | 'config:reset', Readonly<Record<string, unknown>>>
> = {
  'config:get': {
    type: 'object',
    additionalProperties: false,
    required: ['namespace', 'key'],
    properties: {
      namespace: { type: 'string', pattern: '^(platform|plugins\\.[a-z0-9.-]+)$' },
      key: { type: 'string', pattern: '^[a-z0-9-]+(\\.[a-z0-9-]+)*$' },
    },
  },
  'config:snapshot': {
    type: 'object',
    additionalProperties: false,
    required: ['namespace', 'prefix'],
    properties: {
      namespace: { type: 'string', pattern: '^(platform|plugins\\.[a-z0-9.-]+)$' },
      prefix: { type: 'string', pattern: '^([a-z0-9-]+(\\.[a-z0-9-]+)*)?$', maxLength: 256 },
    },
  },
  'config:reset': {
    type: 'object',
    additionalProperties: false,
    required: ['namespace', 'keys', 'scope'],
    properties: {
      namespace: { type: 'string', pattern: '^(platform|plugins\\.[a-z0-9.-]+)$' },
      keys: {
        type: 'array',
        minItems: 1,
        maxItems: 256,
        items: { type: 'string', pattern: '^[a-z0-9-]+(\\.[a-z0-9-]+)*$' },
      },
      scope: { type: 'string', enum: ['user', 'workspace'] },
    },
  },
  'config:set': {
    type: 'object',
    additionalProperties: false,
    required: ['namespace', 'key', 'value', 'scope'],
    properties: {
      namespace: { type: 'string', pattern: '^(platform|plugins\\.[a-z0-9.-]+)$' },
      key: { type: 'string', pattern: '^[a-z0-9-]+(\\.[a-z0-9-]+)*$' },
      value: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
      scope: { type: 'string', enum: ['user', 'workspace'] },
    },
  },
};

/** 命名空间文法（§7.11 `namespace.pattern`）。 */
const NAMESPACE_PATTERN = /^(platform|plugins\.[a-z0-9.-]+)$/;

/** 配置键文法（§7.11 `key.pattern`）。 */
const KEY_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

/** 前缀文法（§7.11 `prefix.pattern`；允许空串）。 */
const PREFIX_PATTERN = /^([a-z0-9-]+(\.[a-z0-9-]+)*)?$/;

/** 写入层枚举（§7.11 `scope.enum`）。 */
const SCOPES = ['user', 'workspace'] as const;

/** 读取 `namespace` 输入（文法越界即 `BRIDGE_INVALID_INPUT`）。 */
function readNamespaceField(capabilityId: string, record: Record<string, unknown>): string {
  return patternStringField(
    capabilityId,
    record,
    'namespace',
    NAMESPACE_PATTERN,
    'namespace 必须是 platform 或 plugins.<反向域名>',
  );
}

/** 读取 `scope` 输入（§7.11 enum）。 */
function readScopeField(capabilityId: string, record: Record<string, unknown>): 'user' | 'workspace' {
  return enumStringField(capabilityId, record, 'scope', SCOPES);
}

/** 读取 `keys` 输入（1..256 项，逐项键文法）。 */
function readKeysField(capabilityId: string, record: Record<string, unknown>): readonly string[] {
  const raw = record.keys;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 256) {
    throw systemServiceInputError(capabilityId, 'keys 必须是 1..256 项的数组');
  }
  const keys: string[] = [];
  for (const key of raw) {
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
      throw systemServiceInputError(capabilityId, 'keys 项必须匹配 ^[a-z0-9-]+(\\.[a-z0-9-]+)*$');
    }
    keys.push(key);
  }
  return keys;
}

/**
 * 构造内置 `config:*` 能力注册条目（分面缺位时返回空数组，整体不注册）。
 *
 * @param host 已通过壳自检的 PAL 宿主。
 */
export function createConfigCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  if (!isFacetReady(host.matrix, host.ports, 'config')) {
    return [];
  }
  const config = host.ports.config!;
  const get: IHostCapabilityDescriptor = {
    id: CONFIG_CAPABILITY_IDS.get,
    permissions: [CONFIG_PERMISSION_IDS.read],
    schema: CONFIG_INPUT_SCHEMAS['config:get'],
    targets: [{ permission: CONFIG_PERMISSION_IDS.read, targetFields: ['namespace'] }],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(CONFIG_CAPABILITY_IDS.get, input, ['namespace', 'key']);
      const namespace = readNamespaceField(CONFIG_CAPABILITY_IDS.get, record);
      const key = patternStringField(
        CONFIG_CAPABILITY_IDS.get,
        record,
        'key',
        KEY_PATTERN,
        'key 必须匹配 ^[a-z0-9-]+(\\.[a-z0-9-]+)*$',
      );
      return await config.get({ namespace, key }, toPortCall(ctx));
    },
  };
  const snapshot: IHostCapabilityDescriptor = {
    id: CONFIG_CAPABILITY_IDS.snapshot,
    permissions: [CONFIG_PERMISSION_IDS.read],
    schema: CONFIG_INPUT_SCHEMAS['config:snapshot'],
    targets: [{ permission: CONFIG_PERMISSION_IDS.read, targetFields: ['namespace'] }],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(CONFIG_CAPABILITY_IDS.snapshot, input, ['namespace', 'prefix']);
      const namespace = readNamespaceField(CONFIG_CAPABILITY_IDS.snapshot, record);
      const prefix = patternStringField(
        CONFIG_CAPABILITY_IDS.snapshot,
        record,
        'prefix',
        PREFIX_PATTERN,
        'prefix 必须匹配 ^([a-z0-9-]+(\\.[a-z0-9-]+)*)?$',
        { maxLength: 256 },
      );
      return { values: await config.snapshot({ namespace, prefix }, toPortCall(ctx)) };
    },
  };
  const set: IHostCapabilityDescriptor = {
    id: CONFIG_CAPABILITY_IDS.set,
    permissions: [CONFIG_PERMISSION_IDS.write],
    schema: CONFIG_INPUT_SCHEMAS['config:set'],
    targets: [{ permission: CONFIG_PERMISSION_IDS.write, targetFields: ['namespace'] }],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(CONFIG_CAPABILITY_IDS.set, input, ['namespace', 'key', 'value', 'scope']);
      const namespace = readNamespaceField(CONFIG_CAPABILITY_IDS.set, record);
      const key = patternStringField(
        CONFIG_CAPABILITY_IDS.set,
        record,
        'key',
        KEY_PATTERN,
        'key 必须匹配 ^[a-z0-9-]+(\\.[a-z0-9-]+)*$',
      );
      const value = jsonValueField(CONFIG_CAPABILITY_IDS.set, record, 'value');
      const scope = readScopeField(CONFIG_CAPABILITY_IDS.set, record);
      await config.set({ callerId: ctx.callerId, namespace, key, value, scope }, toPortCall(ctx));
      return undefined;
    },
  };
  const reset: IHostCapabilityDescriptor = {
    id: CONFIG_CAPABILITY_IDS.reset,
    permissions: [CONFIG_PERMISSION_IDS.write],
    schema: CONFIG_INPUT_SCHEMAS['config:reset'],
    targets: [{ permission: CONFIG_PERMISSION_IDS.write, targetFields: ['namespace'] }],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(CONFIG_CAPABILITY_IDS.reset, input, ['namespace', 'keys', 'scope']);
      const namespace = readNamespaceField(CONFIG_CAPABILITY_IDS.reset, record);
      const keys = readKeysField(CONFIG_CAPABILITY_IDS.reset, record);
      const scope = readScopeField(CONFIG_CAPABILITY_IDS.reset, record);
      await config.reset({ callerId: ctx.callerId, namespace, keys, scope }, toPortCall(ctx));
      return undefined;
    },
  };
  return [get, snapshot, set, reset];
}
