/**
 * `@chips/sdk` 主入口（02-SDK-API规范 §2.2）。
 *
 * 导出面口径：
 * - 值导出固定为 `chips`、`createClient`、`ChipsBridge`、`ChipsError`、`isChipsError`、
 *   `toChipsError` 六项；`testing` 与 `scaffold` 两组开发期工具不从本入口导出（§2.2 末段）。
 * - 类型导出按 §2.2 的分类组织：Bridge 协议与能力类型转发 `@chips/bridge`（§2.3、§11 约束 5），
 *   能力契约、命令、资源打开、内核上下文、插件角色、文档模型、渲染视图、manifest 与 CLI 扩展等类型
 *   由 SDK 定义或以既有单点定义再导出，本入口不复制其内容（§1.3）。manifest 类型经
 *   `./scaffold/index.js` 的既有转发以 `export type` 再导出：编译期可达、运行时完全擦除，
 *   插件运行时依赖图里不出现 `@chips/sdk/scaffold` 与 `@chips/scaffold`（§2.1 规则）。
 * - `cliCommand` / `cliTask` 不是模块级值导出，而是 `ChipsBridge` 实例上的只读扩展命名空间
 *   （§2.2 末段、§3.5）；本入口导出其类型供 `import type` 消费。
 * - 附带 `Window.chips` 全局声明（§4、§9.2），插件不得重复声明。
 * - 三个入口均无默认导出（§2.1）。
 */

import './global.js';

export { chips, ChipsBridge, createClient } from './client/index.js';
export { ChipsError, isChipsError, toChipsError } from './errors.js';

export type { ICreateClientOptions } from './client/index.js';
export type { IChipsError, IChipsErrorInit } from './errors.js';

/* Bridge 协议与能力类型：转发 @chips/bridge，形状权威见 01-Bridge-API规范。 */
export type {
  IAppBridge,
  ICapability,
  ICapabilityContext,
  IChipsBridge,
  IPermissionDeniedDetails,
  IResourceHandle,
  IResourceMetadata,
  ISubscription,
  IServiceBridge,
  JSONSchema,
  ResourceInvalidateReason,
  ResourceScope,
  ResourceState,
} from './types/bridge.js';

/* 能力契约类型：清单、schema 与权限映射的权威是 04-能力契约规范。 */
export type { CapabilityId } from './generated/capability-ids.js';
export type {
  CapabilityInput,
  CapabilityOutput,
  ICapabilityContracts,
} from './types/capabilities/contracts.js';
export type {
  DocumentKind,
  DocumentModel,
  DocumentPart,
  VoidInput,
} from './types/capabilities/common.js';
export type {
  DocumentExportForm,
  IDocumentCreateContent,
  IDocumentCreateInput,
  IDocumentCreateOutput,
  IDocumentExportInput,
  IDocumentExportOutput,
  IDocumentOpenInput,
  IDocumentOpenOutput,
  IDocumentReadInput,
  IDocumentReadOutput,
  IDocumentSaveInput,
  IDocumentSaveOutput,
  IDocumentWriteInput,
  IDocumentWriteOutput,
} from './types/capabilities/document.js';
export type {
  IFileCopyInput,
  IFileDeleteInput,
  IFileListInput,
  IFileListOutput,
  IFileMkdirInput,
  IFileMoveInput,
  IFileReadInput,
  IFileReadOutput,
  IFileWatchInput,
  IFileWatchOutput,
  IFileWriteInput,
} from './types/capabilities/file.js';
export type {
  HttpMethod,
  IConfigGetInput,
  IConfigGetOutput,
  IConfigResetInput,
  IConfigSetInput,
  IConfigSnapshotInput,
  IConfigSnapshotOutput,
  ICredentialDeleteInput,
  ICredentialGetInput,
  ICredentialGetOutput,
  ICredentialSetInput,
  IEventPublishInput,
  IHttpRequestInput,
  IHttpRequestOutput,
  ITransferCancelInput,
  ITransferDownloadInput,
  ITransferDownloadOutput,
} from './types/capabilities/net.js';
export type {
  IResourceReadInput,
  IResourceReadOutput,
  IResourceWriteInput,
  IResourceWriteOutput,
} from './types/capabilities/resource.js';
export type {
  IClipboardReadOutput,
  IClipboardWriteInput,
  IDialogFileFilter,
  IDialogOpenInput,
  IDialogOpenOutput,
  IDialogSaveInput,
  IDialogSaveOutput,
  IMenuItem,
  IMenuSetInput,
  INotificationSendInput,
  IPowerPreventSleepInput,
  IPowerQueryOutput,
  IShellOpenExternalInput,
  IShortcutRegisterInput,
  IShortcutUnregisterInput,
  ISystemInfoOutput,
  ITraySetInput,
  IWindowCloseInput,
  IWindowCreateInput,
  IWindowCreateOutput,
  IWindowFocusInput,
  IWindowInfo,
  IWindowListOutput,
  IWindowMoveInput,
  IWindowResizeInput,
  IWindowSetStateInput,
  IWindowSetTitleInput,
  MenuTarget,
  PlatformId,
  PowerIdleState,
  PowerThermalState,
  WindowDisplayState,
} from './types/capabilities/system.js';

/* CLI 任务类型：任务记录与状态权威见 07-CLI完整参考 §5.6，能力面见 04-能力契约规范 §7.17。 */
export type {
  CliTaskRecord,
  CliTaskStatus,
  ICliTaskActiveInput,
  ICliTaskActiveOutput,
  ICliTaskCompleteInput,
  ICliTaskCompleteOutput,
  ICliTaskFailInput,
  ICliTaskFailOutput,
  ICliTaskGetInput,
  ICliTaskGetOutput,
  ICliTaskProgressInput,
  ICliTaskProgressOutput,
} from './types/capabilities/cli-task.js';

/* 权限治理类型：能力契约面见 04-能力契约规范 §7.18（工单046 登记），审计条目形状权威见
   08-权限系统设计 §8.2。治理身份校验与审计写入链路归工单046 后续实现波次，此处只导出编译期契约形状。 */
export type {
  IPermissionAuditEntry,
  IPermissionAuditReadInput,
  IPermissionAuditReadOutput,
  IPermissionGrantInput,
  IPermissionGrantOutput,
  PermissionAuditAction,
  PermissionAuditSource,
  PermissionDenyReason,
  PermissionGovernanceState,
} from './types/capabilities/permission.js';

/* CLI 扩展类型：`ChipsBridge.cliCommand` / `cliTask` 两个只读命名空间的形状与结果类型，
   方法与语义权威见 07-CLI完整参考 §5.6、§5.8，命名空间本身见 02-SDK-API规范 §3.5。
   `CliTaskStatus` 与 `CliTaskRecord` 由上方「CLI 任务」段导出，此处不重复导出。 */
export type {
  CliCommandApi,
  CliCommandConflict,
  CliCommandIndex,
  CliCommandListResult,
  CliCommandQueryOptions,
  CliCommandResolveResult,
  CliCommandTargetType,
  CliCommandView,
} from './types/cli/command.js';
export type { CliTaskApi } from './types/cli/task.js';

/* 命令类型：权威见 13-命令系统契约 §2、§3.2。 */
export type {
  CommandScopeKind,
  CommandSource,
  CommandTarget,
  ICommandCondition,
  ICommandContext,
  ICommandDefinition,
  ICommandGetInput,
  ICommandGetOutput,
  ICommandInvokeInput,
  ICommandInvokeOutput,
  ICommandListInput,
  ICommandListOutput,
  ICommandMenuPlacement,
  ICommandOwner,
  ICommandRegisterInput,
  ICommandRegisterOutput,
  ICommandScope,
  ICommandState,
  ICommandToolbarPlacement,
  ICommandUnregisterInput,
  ICommandView,
  ICommandWhen,
} from './types/commands.js';

/* 配置层类型：权威见 10-配置系统设计 §4。 */
export type { ConfigLayer, ConfigWriteScope } from './types/config.js';

/* 资源打开与处理器治理：权威见 14-资源打开与默认处理器契约。 */
export type {
  HandlerTier,
  IHandlerCandidate,
  IHandlerSlot,
  IListHandlersOutput,
  IResourceOpenContext,
  IResourceOpenLaunchArgs,
  IResourceOpenRequest,
  IResourceOpenResource,
  IResourceOpenResult,
  OpenIntent,
  OpenOrigin,
  ResourceOpenMode,
} from './types/resource-open.js';

/* 内核上下文类型：由 Cordis 注入主进程插件，成员见 03-核心接口规范。 */
export type {
  Context,
  EventListener,
  IEventSubscription,
  ITaskHandle,
  ITaskOptions,
  PluginConfig,
} from './types/kernel.js';

/* 插件角色类型：四类角色的入口与上下文，名称与形状以 07/08/09/10-插件接口文档为准。 */
export type {
  AppExitReason,
  AppLaunchSource,
  AppLogFields,
  AppSurface,
  IAppConfig,
  IAppConfigChange,
  IAppConfigView,
  IAppContext,
  IAppLauncherInfo,
  IAppLaunchArgs,
  IAppLifecycle,
  IAppLogger,
  IAppPlugin,
  IAppWindow,
} from './types/roles/app.js';
export type { Dispose, EditorState } from './types/roles/common.js';
export type {
  BaseCardChange,
  IBaseCardEditor,
  IBaseCardEditorEventMap,
  IBaseCardPlugin,
  ICardPatchOperation,
} from './types/roles/basecard.js';
export type {
  EntryRequest,
  EntryTicket,
  FrameNotification,
  IBoxLayoutFrameRuntime,
  IBoxLayoutPlugin,
  IBoxLayoutRuntimeAware,
  ILayoutEditor,
  ILayoutEditorEventMap,
  ILayoutPatchOperation,
  LayoutChange,
} from './types/roles/boxlayout.js';
export type {
  ICapabilityRegisterOptions,
  IConfigChange,
  IConfigView,
  IServiceConfig,
  IServiceContext,
  IServiceLogger,
  IServicePlugin,
  ServiceLogFields,
} from './types/roles/service.js';

/* 文档模型类型：字段权威见 04-文件格式规范。 */
export type {
  BoxMetadata,
  CardContent,
  CardMetadata,
  ContentNode,
  Diagnostic,
  Entry,
  StructureModel,
  Tag,
} from './types/document.js';

/* 渲染视图类型：权威表见 03-核心接口规范 §6.6。 */
export type {
  BaseCardContext,
  BaseCardView,
  BoxCoverView,
  BoxRenderView,
  CardNodeView,
  CardRenderView,
  CoverView,
  DocumentView,
  EntryView,
  TagView,
} from './types/views.js';

/* manifest 类型：字段语义见 03-插件开发/02-插件清单规范，§2.2 把它们登记为主入口类型导出。
   单点定义在 `@chips/scaffold`，经 `./scaffold/index.js` 的既有转发以 `export type` 再导出：
   本入口不复制形状（§11 约束 5），运行时也不引入 scaffold 依赖（§2.1 规则）。
   脚手架开发期类型（`IScaffoldOptions` / `IScaffoldPlan` / `IScaffoldTemplate` / `IScaffoldFile`）
   不在 §2.2 主入口清单内，仍只从 `@chips/sdk/scaffold` 导出（§8.3）。 */
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
  PluginRole,
  PluginSurface,
  PluginTarget,
} from './scaffold/index.js';
