/**
 * `@chips/sdk/scaffold` 入口（02-SDK-API规范 §2.1、§8）。
 *
 * §8.2 规则 9：模板与生成器实现位于 `tools/scaffold/src/templates/`（包 `@chips/scaffold`），
 * 本入口只转发公开面，不复制模板文本、不承载第二份模板事实源。
 * 唯一的边界行为是错误归一：上游参数校验失败抛出的 `ScaffoldError` 在本入口转换为
 * `ChipsError`（code 固定 `SDK_INVALID_SCAFFOLD_OPTIONS`，`message` 与 `details` 原样保留，
 * `retryable` 为 `false`），调用方只面对统一错误模型（§6.1、§8.3、§8.4）。
 *
 * 值导出恰为 `createScaffoldPlan` 与 `listScaffoldTemplates` 两项（§8.3）；无默认导出（§2.1）。
 * 类型导出与上游公开面逐名一致，形状权威即上游公开类型，本入口不重新定义；
 * `cli?` 字段的 CLI 契约九型与参数类型标量联合 `PluginCliParameterType` 随 `IPluginManifest`
 * 同面转发（单源在 `tools/scaffold/src/types.ts`，
 * 字段文法权威见《02-插件清单规范》§7.6 与《07-CLI完整参考》§五）。
 */

import {
  createScaffoldPlan as createScaffoldPlanUpstream,
  isScaffoldError,
  listScaffoldTemplates as listScaffoldTemplatesUpstream,
} from '@chips/scaffold';
import type { IScaffoldOptions, IScaffoldPlan } from '@chips/scaffold';

import { ChipsError, SDK_INVALID_SCAFFOLD_OPTIONS, toChipsError } from '../errors.js';

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
  PluginCliParameterType,
  PluginRole,
  PluginSurface,
  PluginTarget,
} from '@chips/scaffold';

/**
 * 列出全部角色的脚手架模板（§8.2、§8.3）。
 *
 * 与上游实现同一引用，未经二次包装；返回四条记录，顺序固定为
 * basecard、boxlayout、app、service。
 */
export const listScaffoldTemplates = listScaffoldTemplatesUpstream;

/**
 * 边界错误归一：`ScaffoldError` 转为同码同因的 `ChipsError`，其余抛出值按 §5.2 归一。
 *
 * @param error - 上游抛出的任意值
 * @returns 归一后的 `ChipsError`
 */
function toBoundaryError(error: unknown): ChipsError {
  if (isScaffoldError(error)) {
    return new ChipsError({
      code: SDK_INVALID_SCAFFOLD_OPTIONS,
      message: error.message,
      retryable: false,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
  }
  return toChipsError(error);
}

/**
 * 生成指定角色的脚手架计划（§8.3）。
 *
 * 纯函数：只产出文件计划（路径 + 内容）与结构化 manifest，不写磁盘、不联网、不安装依赖；
 * 落盘、依赖安装与 `.cpk` 打包由 `@chips/cli` 执行（§8.1）。
 *
 * @param options - 角色、插件 ID、名称、目标目录与可选元数据
 * @returns 文件计划与结构化 manifest
 * @throws {ChipsError} 参数不合法时抛出 `SDK_INVALID_SCAFFOLD_OPTIONS`，不产生部分计划（§8.4）
 */
export function createScaffoldPlan(options: IScaffoldOptions): IScaffoldPlan {
  try {
    return createScaffoldPlanUpstream(options);
  } catch (error) {
    throw toBoundaryError(error);
  }
}
