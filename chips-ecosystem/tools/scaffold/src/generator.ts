import { buildManifest } from './manifest.js';
import { buildScaffoldFiles, roleDescription, scaffoldFilePaths } from './templates/index.js';
import type { IScaffoldOptions, IScaffoldPlan, IScaffoldTemplate, PluginRole } from './types.js';
import { normalizeScaffoldOptions } from './validate.js';

/** 模板枚举顺序（与《02-SDK-API规范》§8.2 的四角色一致）。 */
export const SCAFFOLD_TEMPLATE_ROLES: readonly PluginRole[] = [
  'basecard',
  'boxlayout',
  'app',
  'service',
];

/** 模板文件清单展示使用的规范资源命名基。 */
const CANONICAL_ASSET_SLUG: Readonly<Record<PluginRole, string>> = {
  basecard: 'markdown',
  boxlayout: 'grid',
  app: 'app',
  service: 'service',
};

/**
 * 列出全部角色的脚手架模板。
 *
 * `files` 为该角色的规范文件清单；`createScaffoldPlan` 按插件 ID 派生的资源命名基
 * 替换 `assets/` 下的文件路径（如 `chips.basecard.markdown` → `markdown.svg`）。
 *
 * @returns 四条模板记录，顺序固定为 basecard、boxlayout、app、service
 */
export function listScaffoldTemplates(): readonly IScaffoldTemplate[] {
  return SCAFFOLD_TEMPLATE_ROLES.map((role) => ({
    role,
    description: roleDescription(role),
    files: scaffoldFilePaths(role, CANONICAL_ASSET_SLUG[role]),
  }));
}

/**
 * 生成指定角色的脚手架计划。
 *
 * 纯函数：只产出文件计划（路径 + 内容）与结构化 manifest，不写磁盘、不联网、不安装依赖；
 * 参数不合法时抛出 `ScaffoldError`（code 为 `SDK_INVALID_SCAFFOLD_OPTIONS`），不产生部分计划。
 *
 * @param options - 角色、插件 ID、名称、目标目录与可选元数据
 * @returns 文件计划与结构化 manifest
 */
export function createScaffoldPlan(options: IScaffoldOptions): IScaffoldPlan {
  const { options: normalized, derived } = normalizeScaffoldOptions(options);
  const base = { options: normalized, ...derived };
  const manifest = buildManifest(base);
  const context = { ...base, manifest };
  return {
    targetDir: normalized.targetDir,
    template: {
      role: normalized.role,
      description: roleDescription(normalized.role),
      files: scaffoldFilePaths(normalized.role, derived.assetSlug),
    },
    manifest,
    files: buildScaffoldFiles(context),
  };
}
