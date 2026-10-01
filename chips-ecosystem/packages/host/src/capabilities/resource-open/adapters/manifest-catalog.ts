/**
 * `IHandlerCatalogPort` 生产适配器：插件记录 → manifest `fileAssociations` 槽位声明。
 *
 * 权威：`14-资源打开与默认处理器契约` §3.1（声明模型）、§3.4（候选只来自 `active` 插件）、
 * `03-插件清单规范` §7.4（`fileAssociations` 安装校验入口——本适配器只读取已过安装校验的
 * 清单，不复制第二套校验）。
 *
 * @remarks
 * - 槽位声明的单一事实源是插件 manifest：适配器按装载器记录的插件目录读 `manifest.yaml`
 *   并提取 `fileAssociations`（安装时装载器已按 §3.3 全项校验；此处只做确定性提取与
 *   `tier` 缺省归一）。清单不可读或不含声明时该插件不产生候选（诊断留痕，不猜测）。
 * - 记录清单由注入的视图源提供（组合根把宿主运行时持有的装载器 `list()` 接入本位，
 *   禁第二注册表）；`active` 过滤在此收口（§3.4：`pending` / `starting` / `stopping` /
 *   `installed` / `failed` 不产生候选）。
 * - 缓存按「插件目录 + 包摘要」键控：同目录同摘要的清单提取结果直接复用；摘要变化
 *   （更新/重装）即重新提取，无时间性失效（确定性）。
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import type { DiagnosticsSink } from '../../../shared/diagnostics.js';
import type { IPluginRecord } from '../../../loader/types.js';
import { RESOURCE_OPEN_HANDLER_TIERS } from '../contract.js';
import type { ResourceOpenHandlerTier } from '../contract.js';
import type { IHandlerDeclaration } from '../resolve-handler.js';
import type { IHandlerCatalogPort } from '../ports.js';

/** 目录端口依赖。 */
export interface IManifestHandlerCatalogDeps {
  /** 插件记录视图源（组合根接入宿主运行时装载器 `list()` 的同一实例，禁第二注册表）。 */
  readonly listPlugins: () => readonly IPluginRecord[];
  /** 宿主诊断口（清单提取失败的诚实留痕）。 */
  readonly diagnostics?: DiagnosticsSink;
}

/** 判断是否候选记录（§3.4：只 `active` 的 app / service 产生候选）。 */
function isCandidateRecord(record: IPluginRecord): record is IPluginRecord & { readonly role: 'app' | 'service' } {
  return record.state === 'active' && (record.role === 'app' || record.role === 'service');
}

/** 收敛字符串数组成员（非字符串项忽略；声明面在安装校验已保证形态）。 */
function stringArrayOf(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

/** 从 manifest 解析结果提取槽位声明（确定性；缺 ID / 名称 / 声明返回空）。 */
export function extractHandlerDeclarations(parsed: unknown, record: IPluginRecord): readonly IHandlerDeclaration[] {
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    (record.role !== 'app' && record.role !== 'service')
  ) {
    return [];
  }
  const root = parsed as Record<string, unknown>;
  if (root.id !== record.id || typeof root.name !== 'string' || root.name.length === 0) {
    return [];
  }
  const associations = root.fileAssociations;
  if (!Array.isArray(associations)) {
    return [];
  }
  const declarations: IHandlerDeclaration[] = [];
  for (const item of associations) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      continue;
    }
    const association = item as Record<string, unknown>;
    const extensions = stringArrayOf(association.extensions);
    const mimeTypes = stringArrayOf(association.mimeTypes);
    if (extensions.length === 0 && mimeTypes.length === 0) {
      continue;
    }
    const rawTier = association.tier;
    const tier: ResourceOpenHandlerTier =
      typeof rawTier === 'string' && (RESOURCE_OPEN_HANDLER_TIERS as readonly string[]).includes(rawTier)
        ? (rawTier as ResourceOpenHandlerTier)
        : 'primary';
    declarations.push({
      pluginId: record.id,
      name: root.name,
      role: record.role,
      tier,
      extensions,
      mimeTypes,
      installedAt: record.installedAt,
    });
  }
  return declarations;
}

/** 缓存条目：摘要 + 提取结果。 */
interface ICachedDeclarations {
  readonly hash: string;
  readonly declarations: readonly IHandlerDeclaration[];
}

/**
 * 构造 manifest 槽位声明目录的生产适配器。
 *
 * @param deps 目录依赖（记录视图源 + 诊断口）。
 */
export function createManifestHandlerCatalog(deps: IManifestHandlerCatalogDeps): IHandlerCatalogPort {
  const cache = new Map<string, ICachedDeclarations>();
  return {
    async snapshot(): Promise<readonly IHandlerDeclaration[]> {
      const candidates: IHandlerDeclaration[] = [];
      for (const record of deps.listPlugins()) {
        if (!isCandidateRecord(record)) {
          continue;
        }
        const cached = cache.get(record.path);
        if (cached !== undefined && cached.hash === record.hash) {
          candidates.push(...cached.declarations);
          continue;
        }
        let declarations: readonly IHandlerDeclaration[] = [];
        try {
          const text = await readFile(join(record.path, 'manifest.yaml'), 'utf8');
          declarations = extractHandlerDeclarations(parseYaml(text), record);
        } catch (error) {
          deps.diagnostics?.warn('resource-open', '处理器声明提取失败，该插件不产生路由候选', {
            pluginId: record.id,
            reason: error instanceof Error ? error.message : typeof error,
          });
        }
        cache.set(record.path, { hash: record.hash, declarations });
        candidates.push(...declarations);
      }
      return candidates;
    },
  };
}
