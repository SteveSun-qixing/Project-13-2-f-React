/**
 * 插件注册表持久化（`registry.json`）：《03-插件架构设计》§3.4 持久化边界。
 *
 * 权威：`01-架构设计/01-子系统设计/03.03-插件架构设计-三、生命周期状态机与注册表` §3.3/§3.4。
 *
 * @remarks
 * - 持久化内容（§3.4）：安装集合（`installed` 及以上）、启用偏好、授权集合。
 *   **运行态（`pending` / `starting` / `active` / `stopping` / `failed`）不持久化**，
 *   由启动恢复（§4.6）重建。
 * - 残留回滚（§3.4）：上次运行中断残留的 `starting` / `stopping` 痕迹在加载时清理并
 *   回滚为 `installed`；本表由装载器独占写入、只持久化无状态条目，但外部写入或异常
 *   中断可能在文档中留下 `state` 痕迹——加载时一律归一：`starting` / `stopping` /
 *   `pending` / `active` / `failed` → `installed`（`active` 的重新启用由启用偏好承接，
 *   `failed` 不自动重试），逐条产生诊断并回写文档。
 * - 每次变更即时持久化：临时文件同目录写入后 `rename` 原子替换；文档结构收紧
 *   （`version: 1` + 严格字段校验），非法文档整表拒绝（不静默跳过条目）。
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { IPluginDependency, IPersistedPluginEntry, PluginRole, PluginSource } from './types.js';

/** `registry.json` 文档版本。 */
export const REGISTRY_VERSION = 1;

/** `registry.json` 文档形态。 */
export interface IPersistedRegistryDocument {
  readonly version: number;
  readonly plugins: readonly IPersistedPluginEntry[];
}

const ROLES: readonly PluginRole[] = ['basecard', 'boxlayout', 'app', 'service'];
const SOURCES: readonly PluginSource[] = ['builtin', 'user', 'development'];
/** 运行态痕迹集合（§3.4 残留回滚口径；`installed` 为唯一合法持久化状态）。 */
const RUNTIME_STATE_RESIDUE: ReadonlySet<string> = new Set(['pending', 'starting', 'active', 'stopping', 'failed']);

/** 注册表持久化失败（基础设施错误；非 `CPK_*`/`KERNEL_*` 域，不伪造登记码）。 */
export class PluginRegistryPersistenceError extends Error {
  constructor(message: string, options: { readonly cause?: unknown } = {}) {
    super(message);
    this.name = 'PluginRegistryPersistenceError';
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

function failPersistence(message: string, cause?: unknown): never {
  throw new PluginRegistryPersistenceError(message, { cause });
}

function expectStringArray(value: unknown, pointer: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    failPersistence(`registry.json ${pointer} 必须是字符串数组`);
  }
  return value as readonly string[];
}

function expectDependencies(value: unknown, pointer: string): readonly IPluginDependency[] {
  if (!Array.isArray(value)) {
    failPersistence(`registry.json ${pointer} 必须是数组`);
  }
  return (value as unknown[]).map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      failPersistence(`registry.json ${pointer}[${index}] 必须是对象`);
    }
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || record.id.length === 0) {
      failPersistence(`registry.json ${pointer}[${index}].id 必须为非空字符串`);
    }
    if (typeof record.version !== 'string' || record.version.length === 0) {
      failPersistence(`registry.json ${pointer}[${index}].version 必须为非空字符串`);
    }
    return { id: record.id, version: record.version };
  });
}

/** 条目校验与残留归一；返回归一条目与逐条诊断。 */
function normalizeEntry(
  value: unknown,
  index: number,
): { readonly entry: IPersistedPluginEntry; readonly diagnostic: string | undefined } {
  const pointer = `plugins[${index}]`;
  if (typeof value !== 'object' || value === null) {
    failPersistence(`registry.json ${pointer} 必须是对象`);
  }
  const record = value as Record<string, unknown>;
  const allowed = [
    'id',
    'version',
    'role',
    'source',
    'path',
    'hash',
    'dependencies',
    'permissions',
    'grantedPermissions',
    'installedAt',
    'enabled',
    // `state` 非本表持久化字段；仅为承接外部写入/中断残留的回滚路径而接受。
    'state',
  ];
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      failPersistence(`registry.json ${pointer} 含未知字段：${key}`);
    }
  }
  for (const field of ['id', 'version', 'path', 'hash', 'installedAt'] as const) {
    if (typeof record[field] !== 'string' || record[field].length === 0) {
      failPersistence(`registry.json ${pointer}.${field} 必须为非空字符串`);
    }
  }
  if (typeof record.role !== 'string' || !ROLES.includes(record.role as PluginRole)) {
    failPersistence(`registry.json ${pointer}.role 非法：${String(record.role)}`);
  }
  if (typeof record.source !== 'string' || !SOURCES.includes(record.source as PluginSource)) {
    failPersistence(`registry.json ${pointer}.source 非法：${String(record.source)}`);
  }
  if (typeof record.enabled !== 'boolean') {
    failPersistence(`registry.json ${pointer}.enabled 必须为布尔值`);
  }
  let diagnostic: string | undefined;
  if (record.state !== undefined) {
    if (typeof record.state !== 'string') {
      failPersistence(`registry.json ${pointer}.state 必须为字符串`);
    }
    if (RUNTIME_STATE_RESIDUE.has(record.state)) {
      diagnostic =
        `插件 ${String(record.id)} 存在上次运行中断残留的 ${record.state} 痕迹，已回滚为 installed` +
        '（《03-插件架构设计》§3.4）';
    } else if (record.state !== 'installed') {
      failPersistence(`registry.json ${pointer}.state 非法：${String(record.state)}`);
    }
  }
  const entry: IPersistedPluginEntry = {
    id: record.id as string,
    version: record.version as string,
    role: record.role as PluginRole,
    source: record.source as PluginSource,
    path: record.path as string,
    hash: record.hash as string,
    dependencies: expectDependencies(record.dependencies ?? [], `${pointer}.dependencies`),
    permissions: expectStringArray(record.permissions ?? [], `${pointer}.permissions`),
    grantedPermissions: expectStringArray(record.grantedPermissions ?? [], `${pointer}.grantedPermissions`),
    installedAt: record.installedAt as string,
    enabled: record.enabled,
  };
  return { entry, diagnostic };
}

/** 插件注册表（§3.4 持久化面）。 */
export interface IPluginRegistry {
  /** 全部安装条目（安装集合；`installed` 及以上）。 */
  list(): readonly IPersistedPluginEntry[];
  /** 按 ID 查找。 */
  get(id: string): IPersistedPluginEntry | undefined;
  /** 写入或替换条目（同 ID 幂等替换）并持久化。 */
  upsert(entry: IPersistedPluginEntry): Promise<void>;
  /** 移除条目并持久化（幂等）。 */
  remove(id: string): Promise<void>;
  /** 写启用偏好并持久化。 */
  setEnabled(id: string, enabled: boolean): Promise<void>;
  /** 写授权集合并持久化（授权记录由权限系统独占写入的投影面）。 */
  setGrantedPermissions(id: string, permissions: readonly string[]): Promise<void>;
  /** 立即持久化当前内存态。 */
  persist(): Promise<void>;
  /** 加载期诊断（残留回滚等；简体中文）。 */
  readonly loadDiagnostics: readonly string[];
}

/**
 * 打开插件注册表（加载 `registry.json`；文件不存在视为空表）。
 *
 * @param options.filePath `registry.json` 绝对路径。
 * @returns 注册表实例；加载期残留回滚诊断见 {@link IPluginRegistry.loadDiagnostics}。
 * @throws {PluginRegistryPersistenceError} 文档存在但结构非法（整表拒绝，不静默降级）。
 */
export async function openPluginRegistry(options: { readonly filePath: string }): Promise<IPluginRegistry> {
  const { filePath } = options;
  const diagnostics: string[] = [];
  const entries = new Map<string, IPersistedPluginEntry>();

  let document: unknown;
  try {
    const text = await readFile(filePath, 'utf8');
    document = JSON.parse(text) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      document = undefined;
    } else {
      failPersistence('registry.json 读取或解析失败', error);
    }
  }

  if (document !== undefined) {
    if (typeof document !== 'object' || document === null) {
      failPersistence('registry.json 顶层必须是对象');
    }
    const record = document as Record<string, unknown>;
    if (record.version !== REGISTRY_VERSION) {
      failPersistence(`registry.json version 必须为 ${REGISTRY_VERSION}`);
    }
    if (!Array.isArray(record.plugins)) {
      failPersistence('registry.json plugins 必须是数组');
    }
    const seen = new Set<string>();
    (record.plugins as unknown[]).forEach((item, index) => {
      const { entry, diagnostic } = normalizeEntry(item, index);
      if (seen.has(entry.id)) {
        failPersistence(`registry.json 插件 ID 重复：${entry.id}`);
      }
      seen.add(entry.id);
      entries.set(entry.id, entry);
      if (diagnostic !== undefined) {
        diagnostics.push(diagnostic);
      }
    });
  }

  const persist = async (): Promise<void> => {
    const payload: IPersistedRegistryDocument = {
      version: REGISTRY_VERSION,
      plugins: [...entries.values()],
    };
    try {
      await mkdir(dirname(filePath), { recursive: true });
      const temporary = `${filePath}.tmp`;
      await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      await rename(temporary, filePath);
    } catch (error) {
      failPersistence('registry.json 写入失败', error);
    }
  };

  const requireEntry = (id: string): IPersistedPluginEntry => {
    const entry = entries.get(id);
    if (entry === undefined) {
      failPersistence(`注册表中不存在插件：${id}`);
    }
    return entry;
  };

  if (diagnostics.length > 0) {
    await persist();
  }

  return {
    list: () => [...entries.values()],
    get: (id: string) => entries.get(id),
    upsert: async (entry: IPersistedPluginEntry) => {
      const { entry: normalized, diagnostic } = normalizeEntry(entry, 0);
      if (diagnostic !== undefined) {
        diagnostics.push(diagnostic);
      }
      entries.set(normalized.id, normalized);
      await persist();
    },
    remove: async (id: string) => {
      entries.delete(id);
      await persist();
    },
    setEnabled: async (id: string, enabled: boolean) => {
      entries.set(id, { ...requireEntry(id), enabled });
      await persist();
    },
    setGrantedPermissions: async (id: string, permissions: readonly string[]) => {
      entries.set(id, { ...requireEntry(id), grantedPermissions: [...permissions] });
      await persist();
    },
    persist,
    loadDiagnostics: Object.freeze([...diagnostics]),
  };
}
