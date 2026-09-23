/**
 * `@chips/scaffold` 唯一公开入口。
 *
 * `@chips/sdk/scaffold` 转发本包：纯函数生成器、四角色模板与公开类型；
 * 参数校验失败抛出的 `ScaffoldError` 在 SDK 导出边界转换为 `ChipsError`（保留 code 与 details）。
 *
 * 公开类型面含 `IPluginManifest` 及其全部嵌套成员类型：`cli?` 字段的 CLI 契约九型
 * （《02-插件清单规范》§7.6 与《07-CLI完整参考》§五 的字段文法对应的 TS 形状）与
 * manifest 条目类型同面导出，消费侧可逐名导入，不再存在悬空引用。
 */
export { ScaffoldError, isScaffoldError } from './errors.js';
export { createScaffoldPlan, listScaffoldTemplates, SCAFFOLD_TEMPLATE_ROLES } from './generator.js';
export type {
  IPluginCapabilities,
  IPluginCardType,
  IPluginCli,
  IPluginCliCommand,
  IPluginCliCommandConflict,
  IPluginCliCommandJob,
  IPluginCliCommandOutput,
  IPluginCliCommandSurface,
  IPluginCliCommandTarget,
  IPluginCliParameter,
  IPluginCliParameterPath,
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
