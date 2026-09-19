/**
 * 脚手架公开类型：与《02-SDK-API规范》§8.3 的 `@chips/sdk/scaffold` 形状一致。
 *
 * 生成器只产出纯数据（路径 + 文本内容 + 结构化 manifest），不写磁盘、不联网、不安装依赖；
 * 落盘、依赖安装与 `.cpk` 打包由 `@chips/cli` 执行。
 */

/** 插件角色：基础卡片 / 箱子布局 / 应用 / 服务。 */
export type PluginRole = 'basecard' | 'boxlayout' | 'app' | 'service';

/** 插件运行目标：平台不提供 web 浏览器页面运行形态，只有 host。 */
export type PluginTarget = 'host';

/** 应用表面形态。 */
export type PluginSurface = 'window' | 'desktop' | 'tray';

/** 深链接声明条目。 */
export interface IPluginDeepLink {
  readonly scheme: string;
  readonly host: string;
  readonly pathPattern?: string;
}

/** 运行时声明。 */
export interface IPluginRuntime {
  readonly targets: readonly PluginTarget[];
  readonly background?: boolean;
}

/** 平台版本范围门禁。 */
export interface IPluginEngines {
  readonly chips: string;
}

/** 直接依赖条目。 */
export interface IPluginDependency {
  readonly id: string;
  readonly version: string;
}

/** 卡片导出格式条目。 */
export interface IPluginExportFormat {
  readonly id: string;
  readonly name: string;
  readonly extension: string;
  readonly mimeType: string;
}

/** manifest 中声明的卡片类型条目。 */
export interface IPluginCardType {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly extensions?: readonly string[];
  readonly aliases?: readonly string[];
  readonly configSchema?: string;
  readonly exportFormats?: readonly IPluginExportFormat[];
}

/** manifest 中声明的布局类型条目。 */
export interface IPluginLayoutType {
  readonly id: string;
  readonly name: string;
  readonly icon?: string;
  readonly description?: string;
  readonly configSchema: string;
  readonly schemaVersions: string;
}

/** 角色能力声明（`basecard` / `boxlayout`）。 */
export interface IPluginCapabilities {
  readonly cardTypes?: readonly IPluginCardType[];
  readonly layouts?: readonly IPluginLayoutType[];
}

/** 文件关联条目。 */
export interface IPluginFileAssociation {
  readonly extensions: readonly string[];
  readonly action: 'open';
  readonly mimeTypes?: readonly string[];
  readonly tier?: 'primary' | 'fallback';
}

/** 应用界面声明。 */
export interface IPluginUi {
  readonly surface: PluginSurface;
  readonly launcher?: Readonly<Record<string, unknown>>;
}

/** 服务健康检查声明。 */
export interface IPluginHealthCheck {
  readonly interval: string;
  readonly timeout: string;
}

/** 插件清单（TS 形状）；字段语义与校验以《02-插件清单规范》为准。 */
export interface IPluginManifest {
  readonly id: string;
  readonly version: string;
  readonly type: PluginRole;
  readonly name: string;
  readonly description?: string;
  readonly author?: string;
  readonly license?: string;
  readonly runtime: IPluginRuntime;
  readonly engines?: IPluginEngines;
  readonly dependencies?: readonly IPluginDependency[];
  readonly permissions?: readonly string[];
  readonly capabilities?: IPluginCapabilities;
  readonly ui?: IPluginUi;
  readonly fileAssociations?: readonly IPluginFileAssociation[];
  readonly deepLinks?: readonly IPluginDeepLink[];
  readonly healthCheck?: IPluginHealthCheck;
}

/** 一个角色的脚手架模板描述。 */
export interface IScaffoldTemplate {
  readonly role: PluginRole;
  readonly description: string;
  readonly files: readonly string[];
}

/** 脚手架生成选项。 */
export interface IScaffoldOptions {
  readonly role: PluginRole;
  readonly pluginId: string;
  readonly name: string;
  readonly description?: string;
  readonly author?: string;
  readonly license?: string;
  readonly targetDir: string;
}

/** 生成的文件：`path` 为相对 `targetDir` 的 POSIX 路径。 */
export interface IScaffoldFile {
  readonly path: string;
  readonly content: string;
}

/** 脚手架计划：纯数据，由调用方落盘。 */
export interface IScaffoldPlan {
  readonly targetDir: string;
  readonly template: IScaffoldTemplate;
  readonly manifest: IPluginManifest;
  readonly files: readonly IScaffoldFile[];
}

/** 已归一选项：license 已补默认值，可选文本保持缺省即不出现。 */
export type NormalizedScaffoldOptions = Required<Omit<IScaffoldOptions, 'description' | 'author'>> &
  Pick<IScaffoldOptions, 'description' | 'author'>;

/** 由选项派生的命名信息。 */
export interface IScaffoldDerived {
  /** 由插件 ID 末段派生的资源命名基（kebab-case）。 */
  readonly assetSlug: string;
  /** 由目标目录名派生的 npm 包名末段（kebab-case）。 */
  readonly packageSlug: string;
  /** 生成包名：`@chips/plugin-<packageSlug>`。 */
  readonly packageName: string;
  /** 相对目标目录的 `tsconfig.base.json` 继承路径。 */
  readonly tsconfigExtends: string;
  /** `basecard` / `boxlayout` 的卡片类型或布局类型标识。 */
  readonly capabilityId: string;
}

/** 模板基础上下文：已归一选项 + 派生命名（尚未生成 manifest）。 */
export interface IScaffoldBase extends IScaffoldDerived {
  readonly options: NormalizedScaffoldOptions;
}

/** 模板生成上下文：基础上下文 + 结构化 manifest。 */
export interface IScaffoldContext extends IScaffoldBase {
  readonly manifest: IPluginManifest;
}
