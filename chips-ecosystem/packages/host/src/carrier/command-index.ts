/**
 * CLI 命令发现索引（《07-CLI完整参考》§5.1/§5.5/§5.6；《17》§5.1 路由面承诺）。
 *
 * 权威：§5.8「发现索引只读：安装、启用、禁用、卸载后由平台重建；CLI、补全与 TUI 每次
 * 读取最新索引，不缓存、不推断」；《17》§5.1 沿用该承诺不加码。
 *
 * @remarks
 * - 索引来源是各**已安装插件**落盘清单（`<pluginPath>/manifest.yaml`）的 `cli.commands[]`
 *   段：清单在打包与安装校验期已过《03-插件包格式》/《02-插件清单规范》全量文法校验，
 *   发现面只回传已入库声明（§5.6），本模块不重复校验、不修补越界声明。
 * - 条目 `entryId = <pluginId>.cli.<commandPath 点分>`（§5.1）；同键（路径段小写空格连接）
 *   跨 owner 形成冲突组（§5.5），`conflicts` 逐条登记优先级与命名空间。
 * - 启用判定：`enabled = 插件装载记录 state === 'active'`；禁用命令缺省不参与可执行匹配，
 *   `includeDisabled` 只服务治理视图（§5.5/§5.6）。
 * - 单插件清单读取/解析失败只跳过该插件并落诊断，不使整表失效（隔离口径同 §4.6 恢复）。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseManifestText } from '../loader/manifest.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import {
  CARRIER_SERVICE_ERROR_CODES,
  carrierServiceError,
  type ICliCommandConflict,
  type ICliCommandListResult,
  type ICliCommandQueryOptions,
  type ICliCommandResolveResult,
  type ICliCommandView,
} from './types.js';

/** 装载器记录在发现面的最小投影视图（由组合根映射，索引不 import 装载器实现）。 */
export interface ICarrierPluginView {
  readonly pluginId: string;
  readonly role: string;
  readonly state: string;
  /** 插件目录绝对路径（`manifest.yaml` 所在根）。 */
  readonly path: string;
  /** 装载记录 `state === 'active'` 的派生启用位。 */
  readonly enabled: boolean;
}

/** 索引构建输入端口（组合根注入：装载器记录快照）。 */
export interface ICarrierCommandIndex {
  /** 重建索引（四生命周期事件与启动初建触发；单飞：并发触发合并为一次尾部重建）。 */
  rebuild(): Promise<void>;
  /** 全量视图（诊断/测试面）。 */
  entries(): readonly ICliCommandView[];
  /** `cli.command.list`（§5.8）。 */
  list(options: ICliCommandQueryOptions | undefined): ICliCommandListResult;
  /** `cli.command.get`（§5.8：多匹配 `CLI_COMMAND_CONFLICT`，无匹配 `CLI_COMMAND_NOT_FOUND`）。 */
  get(options: ICliCommandQueryOptions): ICliCommandView;
  /** `cli.command.resolve`（§5.8：冲突组透出，不自动选择）。 */
  resolve(options: ICliCommandQueryOptions): ICliCommandResolveResult;
}

/** 清单 `cli.commands[]` 条目在发现面的透传形态。 */
interface IRawCommandEntry {
  readonly commandPath: readonly string[];
  readonly declaration: Readonly<Record<string, unknown>>;
}

function normalizeSegments(raw: unknown): readonly string[] | null {
  const segments =
    typeof raw === 'string' ? raw.split(/\s+/).filter((s) => s.length > 0) : Array.isArray(raw) ? raw : null;
  if (segments === null || segments.length === 0 || !segments.every((s) => typeof s === 'string' && s.length > 0)) {
    return null;
  }
  return segments.map((segment) => String(segment));
}

function pathKey(segments: readonly string[]): string {
  return segments.map((segment) => segment.toLowerCase()).join(' ');
}

/** 创建发现索引（无 IO 缓存承诺：每次 `rebuild()` 直读落盘清单）。 */
export function createCliCommandIndex(deps: {
  readonly plugins: () => readonly ICarrierPluginView[];
  readonly diagnostics: DiagnosticsSink;
}): ICarrierCommandIndex {
  let entries: readonly ICliCommandView[] = [];
  let rebuilding: Promise<void> | null = null;
  let rerunRequested = false;

  const buildEntries = (): ICliCommandView[] => {
    const collected: { pluginId: string; enabled: boolean; entry: IRawCommandEntry }[] = [];
    for (const plugin of deps.plugins()) {
      const collectedForPlugin = readPluginCommands(plugin);
      for (const entry of collectedForPlugin) {
        collected.push({ pluginId: plugin.pluginId, enabled: plugin.enabled, entry });
      }
    }
    const byKey = new Map<string, { pluginId: string; enabled: boolean; entry: IRawCommandEntry }[]>();
    for (const item of collected) {
      const key = pathKey(item.entry.commandPath);
      const bucket = byKey.get(key);
      if (bucket === undefined) {
        byKey.set(key, [item]);
      } else {
        bucket.push(item);
      }
    }
    const views: ICliCommandView[] = [];
    for (const item of collected) {
      const key = pathKey(item.entry.commandPath);
      const bucket = byKey.get(key) ?? [];
      const conflicts: ICliCommandConflict[] = bucket
        .filter((other) => other.pluginId !== item.pluginId)
        .map((other) => conflictOf(other));
      views.push(toView(item, conflicts));
    }
    // 稳定顺序：键 + owner + entryId，保证同输入字节级同输出（§3.5 序列化纪律的索引侧平移）。
    return views.sort(
      (left, right) =>
        pathKey(left.commandPath).localeCompare(pathKey(right.commandPath)) ||
        left.owner.localeCompare(right.owner) ||
        left.entryId.localeCompare(right.entryId),
    );
  };

  const readPluginCommands = (plugin: ICarrierPluginView): IRawCommandEntry[] => {
    let text: string;
    try {
      text = readFileSync(join(plugin.path, 'manifest.yaml'), 'utf8');
    } catch {
      deps.diagnostics.warn('carrier-index', `插件清单不可读，发现索引跳过该插件`, {
        pluginId: plugin.pluginId,
      });
      return [];
    }
    let manifest: unknown;
    try {
      manifest = parseManifestText(text);
    } catch {
      deps.diagnostics.warn('carrier-index', `插件清单解析失败，发现索引跳过该插件`, {
        pluginId: plugin.pluginId,
      });
      return [];
    }
    const cli = (manifest as { cli?: unknown } | null)?.cli;
    if (typeof cli !== 'object' || cli === null) {
      return [];
    }
    const commands = (cli as { commands?: unknown }).commands;
    if (!Array.isArray(commands)) {
      return [];
    }
    const entriesForPlugin: IRawCommandEntry[] = [];
    for (const raw of commands) {
      if (typeof raw !== 'object' || raw === null) {
        continue;
      }
      const declaration = raw as Readonly<Record<string, unknown>>;
      const segments = normalizeSegments(declaration.commandPath);
      if (segments === null) {
        continue;
      }
      entriesForPlugin.push({ commandPath: segments, declaration });
    }
    return entriesForPlugin;
  };

  return {
    rebuild(): Promise<void> {
      if (rebuilding !== null) {
        rerunRequested = true;
        return rebuilding;
      }
      rebuilding = Promise.resolve()
        .then((): void => {
          do {
            rerunRequested = false;
            const next = buildEntries();
            entries = next;
          } while (rerunRequested);
        })
        .finally(() => {
          rebuilding = null;
        });
      return rebuilding;
    },

    entries(): readonly ICliCommandView[] {
      return entries;
    },

    list(options: ICliCommandQueryOptions | undefined): ICliCommandListResult {
      const query = normalizeQuery(options ?? {});
      const matched = entries.filter((view) => matches(view, query));
      const visible = query.includeDisabled ? matched : matched.filter((view) => view.enabled);
      const visibleIndex: Record<string, string[]> = {};
      for (const view of visible) {
        const key = pathKey(view.commandPath);
        const bucket = visibleIndex[key] ?? [];
        bucket.push(view.entryId);
        visibleIndex[key] = bucket;
      }
      return { index: visibleIndex, commands: visible };
    },

    get(options: ICliCommandQueryOptions): ICliCommandView {
      const query = normalizeQuery(options);
      const matched = entries.filter((view) => matches(view, query));
      const visible = query.includeDisabled ? matched : matched.filter((view) => view.enabled);
      if (visible.length === 0) {
        throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandNotFound, describeQuery(query));
      }
      if (visible.length > 1) {
        throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandConflict, {
          matches: visible.map((view) => view.entryId),
        });
      }
      const only = visible[0] as ICliCommandView;
      if (only.conflicts.length > 0 && query.pluginId === undefined && query.entryId === undefined) {
        throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandConflict, {
          matches: [only.entryId, ...only.conflicts.map((conflict) => conflict.entryId)],
        });
      }
      return only;
    },

    resolve(options: ICliCommandQueryOptions): ICliCommandResolveResult {
      const query = normalizeQuery(options);
      const matched = entries.filter((view) => matches(view, query));
      const visible = query.includeDisabled ? matched : matched.filter((view) => view.enabled);
      if (visible.length === 0) {
        return { conflicts: [] };
      }
      if (visible.length === 1) {
        const only = visible[0] as ICliCommandView;
        if (only.conflicts.length === 0 || query.pluginId !== undefined || query.entryId !== undefined) {
          return { command: only, conflicts: only.conflicts };
        }
        return { conflicts: [conflictOfView(only), ...only.conflicts] };
      }
      return { conflicts: visible.map(conflictOfView) };
    },
  };
}

/** 归一查询（§5.6 形态）；非法形状 `CLI_COMMAND_QUERY_INVALID`。 */
function normalizeQuery(options: ICliCommandQueryOptions | Record<string, unknown>): NormalizedQuery {
  const source = options as Record<string, unknown>;
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid, {
      field: 'options',
    });
  }
  const { entryId, commandPath, pluginId, targetType, includeDisabled } = source;
  if (entryId !== undefined && typeof entryId !== 'string') {
    throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid, {
      field: 'entryId',
    });
  }
  if (commandPath !== undefined && typeof commandPath !== 'string' && !Array.isArray(commandPath)) {
    throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid, {
      field: 'commandPath',
    });
  }
  const segments = commandPath === undefined ? null : normalizeSegments(commandPath);
  if (commandPath !== undefined && segments === null) {
    throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid, {
      field: 'commandPath',
    });
  }
  if (pluginId !== undefined && typeof pluginId !== 'string') {
    throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid, {
      field: 'pluginId',
    });
  }
  if (targetType !== undefined && targetType !== 'app' && targetType !== 'service') {
    throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid, {
      field: 'targetType',
    });
  }
  if (includeDisabled !== undefined && typeof includeDisabled !== 'boolean') {
    throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid, {
      field: 'includeDisabled',
    });
  }
  if (entryId === undefined && segments === null && pluginId === undefined && targetType === undefined) {
    // 全量读取仅对 `list` 合法；`get`/`resolve` 的可定位性在调用方路由处另行校验。
    return {
      entryId: undefined,
      segments: null,
      pluginId: undefined,
      targetType: undefined,
      includeDisabled: includeDisabled === true,
      loose: true,
    };
  }
  return {
    entryId,
    segments,
    pluginId,
    targetType,
    includeDisabled: includeDisabled === true,
    loose: false,
  };
}

interface NormalizedQuery {
  readonly entryId: string | undefined;
  readonly segments: readonly string[] | null;
  readonly pluginId: string | undefined;
  readonly targetType: 'app' | 'service' | undefined;
  readonly includeDisabled: boolean;
  readonly loose: boolean;
}

function describeQuery(query: NormalizedQuery): Record<string, unknown> {
  return {
    ...(query.entryId === undefined ? {} : { entryId: query.entryId }),
    ...(query.segments === null ? {} : { commandPath: query.segments }),
    ...(query.pluginId === undefined ? {} : { pluginId: query.pluginId }),
  };
}

function matches(view: ICliCommandView, query: NormalizedQuery): boolean {
  if (query.entryId !== undefined && view.entryId !== query.entryId) {
    return false;
  }
  if (query.segments !== null && pathKey(query.segments) !== pathKey(view.commandPath)) {
    return false;
  }
  if (query.pluginId !== undefined && view.owner !== query.pluginId) {
    return false;
  }
  if (query.targetType !== undefined && view.declaration.target !== undefined) {
    const target = view.declaration.target as { type?: unknown };
    if (target.type !== query.targetType) {
      return false;
    }
  }
  return true;
}

function conflictOf(item: { pluginId: string; entry: IRawCommandEntry }): ICliCommandConflict {
  const conflict = (item.entry.declaration.conflict ?? {}) as {
    priority?: unknown;
    namespace?: unknown;
  };
  return {
    entryId: entryIdOf(item.pluginId, item.entry.commandPath),
    commandPath: item.entry.commandPath,
    owner: item.pluginId,
    priority: typeof conflict.priority === 'number' ? conflict.priority : 0,
    ...(typeof conflict.namespace === 'string' ? { namespace: conflict.namespace } : {}),
  };
}

function conflictOfView(view: ICliCommandView): ICliCommandConflict {
  const conflict = (view.declaration.conflict ?? {}) as { priority?: unknown; namespace?: unknown };
  return {
    entryId: view.entryId,
    commandPath: view.commandPath,
    owner: view.owner,
    priority: typeof conflict.priority === 'number' ? conflict.priority : 0,
    ...(typeof conflict.namespace === 'string' ? { namespace: conflict.namespace } : {}),
  };
}

function entryIdOf(pluginId: string, segments: readonly string[]): string {
  return `${pluginId}.cli.${segments.join('.')}`;
}

function toView(
  item: { pluginId: string; enabled: boolean; entry: IRawCommandEntry },
  conflicts: readonly ICliCommandConflict[],
): ICliCommandView {
  const { commandId } = item.entry.declaration;
  return {
    entryId: entryIdOf(item.pluginId, item.entry.commandPath),
    commandPath: item.entry.commandPath,
    ...(typeof commandId === 'string' ? { commandId } : {}),
    owner: item.pluginId,
    enabled: item.enabled,
    declaration: item.entry.declaration,
    conflicts,
  };
}
