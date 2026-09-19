/**
 * `@chips/scaffold` 唯一公开入口。
 *
 * `@chips/sdk/scaffold` 转发本包：纯函数生成器、四角色模板与公开类型；
 * 参数校验失败抛出的 `ScaffoldError` 在 SDK 导出边界转换为 `ChipsError`（保留 code 与 details）。
 */
export { ScaffoldError, isScaffoldError } from './errors.js';
export { createScaffoldPlan, listScaffoldTemplates, SCAFFOLD_TEMPLATE_ROLES } from './generator.js';
export type {
  IPluginCapabilities,
  IPluginCardType,
  IPluginDeepLink,
  IPluginDependency,
  IPluginEngines,
  IPluginExportFormat,
  IPluginFileAssociation,
  IPluginHealthCheck,
  IPluginLayoutType,
  IPluginManifest,
  IPluginRuntime,
  IPluginUi,
  IScaffoldFile,
  IScaffoldOptions,
  IScaffoldPlan,
  IScaffoldTemplate,
  PluginRole,
  PluginSurface,
  PluginTarget,
} from './types.js';
