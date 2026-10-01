import { join } from 'node:path';
import type {
  ConfigChange,
  ConfigGetPortInput,
  ConfigResetPortInput,
  ConfigSetPortInput,
  ConfigSnapshotPortInput,
  ConfigView,
  ConfigWatchSubscription,
  IPalConfigPort,
  IPalStoragePort,
  PortCallContext,
  StorageWatchEvent,
} from '../contracts/index.js';
import { assertCallActive } from '../call-guard.js';
import { PAL_ERROR_CODES, PalPortError, isPalPortError } from '../errors.js';

/**
 * macOS 配置端口：宿主侧配置持久化承载（`10-配置系统设计` §3 用户级目录布局的 PAL 缝隙实现）。
 *
 * 权威：`10-配置系统设计` §3（存储位置与格式）、§9.3/§9.5（原子替换与外部修改）、
 * §11.1（Neon 暴露的接口形状——本端口为同契约的宿主承载缝隙）、`04-能力契约规范` §7.11。
 *
 * @remarks
 * - 文件读写一律经 `IPalStoragePort`（文件域系统级校验链：绝对路径闸、临时文件 + `fsync` +
 *   原子替换），不触碰裸 `node:fs`（PAL-2）。
 * - 承载层：用户层平台键文件 `<userConfigDir>/config.user.json`（键为完整配置键）与
 *   用户层插件文件 `<userConfigDir>/plugins/<pluginId>.json`（键为相对键、携带 `pluginId`，
 *   §3.3 文件结构；序列化 UTF-8、两空格缩进、键按字典序，§3.4）。
 * - `workspace` 写入层在宿主承载缺位（无工作区绑定）时返回 `CONFIG_SCOPE_INVALID`（§4.4
 *   "该层不可写"）；工作区层文件随工作区实体绑定波接入本端口（`13-工作区设计`）。
 * - 文件不可解析、结构非法或 `schemaVersion` 越界时进入外部修改保护（§9.5）：读取按空内容
 *   降级、写入返回 `CONFIG_EXTERNAL_MODIFIED` / `CONFIG_VERSION_UNSUPPORTED`；
 *   同层 `reset` 丢弃外部内容并重建文件、解除保护。
 * - 变更投递：提交成功后对受影响文件逐键 diff 投递给 watch 订阅方（§9.2 步骤 6）；
 *   外部修改经 `storage.watch` 监视文件、内容摘要比对去抖后按外部变更投递（origin `external`）。
 * - 默认值层（插件 schema / 平台 schema 注册面）属内核 `ConfigStore` 正式面，本端口不承载：
 *   `get` 未命中承载层即返回 `CONFIG_KEY_UNKNOWN`，`isDefault` 恒为 `false`
 *   （契约缺口随工单登记，见开发日志）。
 */

/** 用户层配置文件结构（§3.3 平台键文件与插件文件同构）。 */
interface IUserConfigFile {
  readonly pluginId?: string;
  readonly schemaVersion: number;
  readonly values: Record<string, unknown>;
}

/** 当前承载支持的配置文件 schema 版本（§3.3：正整数，从 1 开始）。 */
const SUPPORTED_SCHEMA_VERSION = 1;

/** 完整键键文法（§2.1：段字符集小写字母、数字、连字符，点分隔，不允许空段）。 */
const CONFIG_KEY_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

/** 命名空间文法（`04-能力契约规范` §7.11 schema：`platform` 或 `plugins.<反向域名>`）。 */
const NAMESPACE_PATTERN = /^(platform|plugins\.[a-z0-9.-]+)$/;

/** 插件命名空间前缀。 */
const PLUGIN_NAMESPACE_PREFIX = 'plugins.';

/** 键空间载体：平台键空间或某插件的键空间。 */
type Keyspace = { readonly kind: 'platform' } | { readonly kind: 'plugin'; readonly pluginId: string };

/** 受保护文件状态（§9.5 外部修改保护）。 */
interface IProtectedState {
  readonly reason: 'unparsable' | 'version-unsupported';
  readonly schemaVersion: number | null;
}

/** 解析命名空间为键空间载体；文法非法返回 `null`。 */
function resolveKeyspace(namespace: string): Keyspace | null {
  if (!NAMESPACE_PATTERN.test(namespace)) {
    return null;
  }
  if (namespace === 'platform') {
    return { kind: 'platform' };
  }
  const pluginId = namespace.slice(PLUGIN_NAMESPACE_PREFIX.length);
  return pluginId.length > 0 ? { kind: 'plugin', pluginId } : null;
}

/** 键空间载体文件落点（§3.1 目录布局）。 */
function keyspaceFilePath(userConfigDir: string, keyspace: Keyspace): string {
  return keyspace.kind === 'platform'
    ? join(userConfigDir, 'config.user.json')
    : join(userConfigDir, 'plugins', `${keyspace.pluginId}.json`);
}

/** 键空间的插件 ID；平台键空间为 `null`。 */
function keyspacePluginId(keyspace: Keyspace): string | null {
  return keyspace.kind === 'plugin' ? keyspace.pluginId : null;
}

/** 命名空间下相对键 → 完整配置键。 */
function toFullKey(namespace: string, key: string): string {
  return `${namespace}.${key}`;
}

/** 判断值可安全 JSON 序列化（`undefined`、函数、符号与循环引用一律拒绝）。 */
function isJsonSerializable(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

/** 序列化配置文件内容（UTF-8、两空格缩进、键按字典序，§3.4）。 */
function serializeFile(file: IUserConfigFile): string {
  const base: Record<string, unknown> = {
    schemaVersion: file.schemaVersion,
    values: Object.fromEntries(
      Object.keys(file.values)
        .sort()
        .map((key) => [key, file.values[key]]),
    ),
  };
  const payload = file.pluginId === undefined ? base : { pluginId: file.pluginId, ...base };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/**
 * 解析配置文件原文。
 *
 * @returns 解析结果；文件不存在返回 `null`（空内容语义）；非法内容返回保护状态（§9.5）。
 */
function parseFile(pluginId: string | null, raw: string | null): IUserConfigFile | IProtectedState | null {
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { reason: 'unparsable', schemaVersion: null };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { reason: 'unparsable', schemaVersion: null };
  }
  const record = parsed as Record<string, unknown>;
  const schemaVersion = record.schemaVersion;
  const values = record.values;
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion < 1 ||
    typeof values !== 'object' ||
    values === null ||
    Array.isArray(values)
  ) {
    return { reason: 'unparsable', schemaVersion: null };
  }
  if (schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    return { reason: 'version-unsupported', schemaVersion };
  }
  if (pluginId !== null && record.pluginId !== pluginId) {
    return { reason: 'unparsable', schemaVersion: null };
  }
  return { schemaVersion, values: values as Record<string, unknown> };
}

/** 是否为保护状态。 */
function isProtected(file: IUserConfigFile | IProtectedState | null): file is IProtectedState {
  return file !== null && (file as IProtectedState).reason !== undefined;
}

/** 保护状态 → 写入路径错误（§9.5）。 */
function protectionError(state: IProtectedState): PalPortError {
  if (state.reason === 'version-unsupported') {
    return new PalPortError(PAL_ERROR_CODES.CONFIG_VERSION_UNSUPPORTED, undefined, {
      details: { schemaVersion: state.schemaVersion },
    });
  }
  return new PalPortError(PAL_ERROR_CODES.CONFIG_EXTERNAL_MODIFIED);
}

/** 配置端口依赖。 */
export interface MacConfigPortDependencies {
  /** 用户级配置目录（§3.2 平台路径映射的用户级目录；目录不存在时首次写入惰性创建）。 */
  readonly userConfigDir: string;
  /** 文件存储端口（文件域校验链单点）。 */
  readonly storage: IPalStoragePort;
}

/**
 * 创建 macOS 配置端口。
 *
 * 权威：`04-能力契约规范` §7.11、`10-配置系统设计` §3/§9/§11.1。
 *
 * @param dependencies 用户级配置目录与文件存储端口。
 * @returns `config:*` 端口实现（用户层持久化承载；语义见文件头注）。
 */
export function createMacConfigPort(dependencies: MacConfigPortDependencies): IPalConfigPort {
  const { userConfigDir, storage } = dependencies;

  /** 平台键文件落点。 */
  const platformFilePath = join(userConfigDir, 'config.user.json');
  /** 插件文件目录落点。 */
  const pluginsDir = join(userConfigDir, 'plugins');

  /** 受保护文件表：文件路径 → 保护状态（§9.5；`reset` 重建文件后解除）。 */
  const protectedFiles = new Map<string, IProtectedState>();
  /** 变更订阅方：完整键前缀 → 回调集合。 */
  const watchers = new Map<string, Set<(change: ConfigChange) => void>>();
  /** 各配置文件最近已知内容（外部修改去抖：内容未变不投递）。 */
  const lastKnownContent = new Map<string, string>();
  /** 目录监视订阅句柄（惰性建立；端口生命周期内存续）。 */
  let dirWatchStarted = false;

  /** 读取文件原文；文件不存在返回 `null`（空内容语义）。 */
  const readRaw = async (path: string): Promise<string | null> => {
    try {
      const result = await storage.read(path, { encoding: 'utf-8' });
      return result.content;
    } catch (error) {
      if (isPalPortError(error) && error.code === PAL_ERROR_CODES.FILE_NOT_FOUND) {
        return null;
      }
      throw error;
    }
  };

  /** 文件路径 → 插件 ID（`null` 为平台键文件；非配置文件成员返回 `undefined`）。 */
  const pluginIdOfPath = (path: string): string | null | undefined => {
    if (path === platformFilePath) {
      return null;
    }
    if (!path.startsWith(`${pluginsDir}/`) || !path.endsWith('.json')) {
      return undefined;
    }
    return path.slice(pluginsDir.length + 1, -'.json'.length);
  };

  /** 外部修改处理：内容摘要比对去抖，合法修改采纳为新基线并按外部变更逐键投递（§9.5）。 */
  const handleExternalChange = async (path: string, pluginId: string | null): Promise<void> => {
    const raw = await readRaw(path);
    const content = raw ?? '';
    if (lastKnownContent.get(path) === content) {
      return; // 自身写入的落盘回声或无效事件：内容未变不投递（§9.5 去抖）。
    }
    const previousParsed = parseFile(pluginId, lastKnownContent.get(path) ?? null);
    const before = previousParsed !== null && !isProtected(previousParsed) ? previousParsed.values : {};
    lastKnownContent.set(path, content);
    const state = parseFile(pluginId, raw);
    if (isProtected(state)) {
      protectedFiles.set(path, state);
      return;
    }
    protectedFiles.delete(path);
    const after = state?.values ?? {};
    const keyspace = pluginId === null ? 'platform' : `${PLUGIN_NAMESPACE_PREFIX}${pluginId}`;
    const touched = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const relativeKey of touched) {
      const previous = before[relativeKey];
      const current = after[relativeKey];
      if (JSON.stringify(previous) === JSON.stringify(current)) {
        continue;
      }
      fanChange({
        key: toFullKey(keyspace, relativeKey),
        layer: 'user',
        value: current === undefined ? null : current,
        effectiveValue: current === undefined ? null : current,
        isDefault: false,
        origin: 'external',
      });
    }
  };

  /** 监视用户级配置目录（递归）；事件按文件分流为外部变更。惰性建立，失败不阻断读写。 */
  const ensureDirWatch = (): void => {
    if (dirWatchStarted) {
      return;
    }
    dirWatchStarted = true;
    void (async (): Promise<void> => {
      const dispatch = (event: StorageWatchEvent): void => {
        const pluginId = pluginIdOfPath(event.path);
        if (pluginId === undefined) {
          return; // 非配置文件成员（临时件、无关文件）不投递。
        }
        void handleExternalChange(event.path, pluginId).catch(() => {
          // 外部修改采纳失败保持既有基线与保护状态（§9.5），不中断监视。
        });
      };
      try {
        await storage.watch(userConfigDir, dispatch, { recursive: true });
      } catch {
        dirWatchStarted = false; // 目录尚不存在：随下次写入重试建立。
      }
    })();
  };

  /** 读取键空间文件的当前值集；文件缺失或受保护时返回空值集与保护状态。 */
  const readValues = async (
    path: string,
    pluginId: string | null,
  ): Promise<{
    readonly values: Record<string, unknown>;
    readonly state: IUserConfigFile | IProtectedState | null;
  }> => {
    const protection = protectedFiles.get(path);
    if (protection !== undefined) {
      return { values: {}, state: protection };
    }
    const raw = await readRaw(path);
    lastKnownContent.set(path, raw ?? '');
    const state = parseFile(pluginId, raw);
    if (isProtected(state)) {
      protectedFiles.set(path, state);
      return { values: {}, state };
    }
    return { values: state?.values ?? {}, state };
  };

  /** 写入键空间文件（原子替换；父目录惰性创建）并解除保护态。 */
  const writeValues = async (path: string, file: IUserConfigFile): Promise<void> => {
    ensureDirWatch();
    const content = serializeFile(file);
    await storage.mkdir(join(path, '..'), { recursive: true });
    await storage.write(path, content, { encoding: 'utf-8' });
    lastKnownContent.set(path, content);
    protectedFiles.delete(path);
  };

  /** 向前缀匹配的订阅方投递一条变更。 */
  const fanChange = (change: ConfigChange): void => {
    for (const [prefix, listeners] of watchers) {
      if (change.key.startsWith(prefix)) {
        for (const listener of [...listeners]) {
          listener(change);
        }
      }
    }
  };

  /** 变更来源（§4.5 ConfigOrigin：`plugin:<pluginId>` / `platform`）。 */
  const originOf = (callerId: string): string => (callerId === 'platform' ? 'platform' : `plugin:${callerId}`);

  /** 按提交前后值集 diff，对受影响键逐键投递变更（§9.2 步骤 6）。 */
  const fanCommitted = (
    namespace: string,
    origin: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    touchedKeys: readonly string[],
  ): void => {
    for (const relativeKey of touchedKeys) {
      const previous = before[relativeKey];
      const current = after[relativeKey];
      if (JSON.stringify(previous) === JSON.stringify(current)) {
        continue; // 同值提交视为空操作（§2.3：不产生磁盘变更与事件）。
      }
      fanChange({
        key: toFullKey(namespace, relativeKey),
        layer: 'user',
        value: current === undefined ? null : current,
        effectiveValue: current === undefined ? null : current,
        isDefault: false,
        origin,
      });
    }
  };

  return {
    async get(input: ConfigGetPortInput, call?: PortCallContext): Promise<ConfigView> {
      assertCallActive(call);
      const keyspace = resolveKeyspace(input.namespace);
      if (keyspace === null || !CONFIG_KEY_PATTERN.test(input.key)) {
        throw new PalPortError(PAL_ERROR_CODES.CONFIG_KEY_INVALID);
      }
      const path = keyspaceFilePath(userConfigDir, keyspace);
      const { values } = await readValues(path, keyspacePluginId(keyspace));
      const value = values[input.key];
      if (value === undefined) {
        throw new PalPortError(PAL_ERROR_CODES.CONFIG_KEY_UNKNOWN, undefined, {
          details: { key: toFullKey(input.namespace, input.key) },
        });
      }
      return { key: toFullKey(input.namespace, input.key), value, layer: 'user', isDefault: false };
    },

    async set(input: ConfigSetPortInput, call?: PortCallContext): Promise<void> {
      assertCallActive(call);
      const keyspace = resolveKeyspace(input.namespace);
      if (keyspace === null || !CONFIG_KEY_PATTERN.test(input.key)) {
        throw new PalPortError(PAL_ERROR_CODES.CONFIG_KEY_INVALID);
      }
      if (input.scope === 'workspace') {
        // 工作区层文件随工作区实体绑定波接入；宿主承载缺位即该层不可写（§4.4）。
        throw new PalPortError(PAL_ERROR_CODES.CONFIG_SCOPE_INVALID, undefined, { details: { scope: input.scope } });
      }
      if (!isJsonSerializable(input.value)) {
        throw new PalPortError(PAL_ERROR_CODES.CONFIG_VALUE_INVALID);
      }
      const path = keyspaceFilePath(userConfigDir, keyspace);
      const { values, state } = await readValues(path, keyspacePluginId(keyspace));
      if (isProtected(state)) {
        throw protectionError(state);
      }
      const after = { ...values, [input.key]: input.value };
      await writeValues(path, {
        ...(keyspace.kind === 'plugin' ? { pluginId: keyspace.pluginId } : {}),
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
        values: after,
      });
      fanCommitted(input.namespace, originOf(input.callerId), values, after, [input.key]);
    },

    async reset(input: ConfigResetPortInput, call?: PortCallContext): Promise<void> {
      assertCallActive(call);
      const keyspace = resolveKeyspace(input.namespace);
      if (keyspace === null) {
        throw new PalPortError(PAL_ERROR_CODES.CONFIG_KEY_INVALID);
      }
      for (const key of input.keys) {
        if (!CONFIG_KEY_PATTERN.test(key)) {
          throw new PalPortError(PAL_ERROR_CODES.CONFIG_KEY_INVALID);
        }
      }
      if (input.scope === 'workspace') {
        throw new PalPortError(PAL_ERROR_CODES.CONFIG_SCOPE_INVALID, undefined, { details: { scope: input.scope } });
      }
      const path = keyspaceFilePath(userConfigDir, keyspace);
      const { values } = await readValues(path, keyspacePluginId(keyspace));
      const after = { ...values };
      for (const key of input.keys) {
        // 同层 reset 兼具外部修改保护的重建语义（§9.5）：受保护文件丢弃外部内容重建、解除保护。
        delete after[key];
      }
      await writeValues(path, {
        ...(keyspace.kind === 'plugin' ? { pluginId: keyspace.pluginId } : {}),
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
        values: after,
      });
      fanCommitted(input.namespace, originOf(input.callerId), values, after, input.keys);
    },

    async snapshot(input: ConfigSnapshotPortInput, call?: PortCallContext): Promise<Record<string, unknown>> {
      assertCallActive(call);
      const keyspace = resolveKeyspace(input.namespace);
      if (keyspace === null || !/^[a-z0-9-]*(\.[a-z0-9-]+)*$/.test(input.prefix)) {
        throw new PalPortError(PAL_ERROR_CODES.CONFIG_KEY_INVALID);
      }
      const path = keyspaceFilePath(userConfigDir, keyspace);
      const { values } = await readValues(path, keyspacePluginId(keyspace));
      const result: Record<string, unknown> = {};
      const fullPrefix = toFullKey(input.namespace, input.prefix);
      for (const relativeKey of Object.keys(values)) {
        const fullKey = toFullKey(input.namespace, relativeKey);
        if (fullKey.startsWith(fullPrefix)) {
          result[fullKey] = values[relativeKey];
        }
      }
      return result;
    },

    watch(prefix: string, onChange: (change: ConfigChange) => void): ConfigWatchSubscription {
      ensureDirWatch();
      let listeners = watchers.get(prefix);
      if (listeners === undefined) {
        listeners = new Set();
        watchers.set(prefix, listeners);
      }
      listeners.add(onChange);
      let disposed = false;
      return {
        dispose(): void {
          if (disposed) {
            return;
          }
          disposed = true;
          const current = watchers.get(prefix);
          current?.delete(onChange);
          if (current !== undefined && current.size === 0) {
            watchers.delete(prefix);
          }
        },
      };
    },
  };
}
