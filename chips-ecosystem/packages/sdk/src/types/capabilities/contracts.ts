/**
 * 能力契约类型总表（04-能力契约规范 §2.3）。
 *
 * 口径：
 * - 本表覆盖 §6.2 全部内置能力（与 `generated/capability-ids.ts` 的 `CapabilityId` 同源），
 *   是编译期能力发现的唯一来源；`CapabilityInput` / `CapabilityOutput` 以 `CapabilityId`
 *   为约束索引本表，任何生成 ID 在表中缺项都会在编译期直接报错（表与生成物强制一致）；
 * - 第三方 Bridge 能力的契约类型由提供方随插件发布，不进入本表（§九）；内容处理服务能力
 *   按 §八登记，同样不进入本表；
 * - 命令域契约类型以 13-命令系统契约 §2、§3.2 为唯一定义处，本表只登记引用（`types/commands.ts`）；
 * - 输出不做运行时 schema 校验，输出契约由本表与 §7 逐项契约维护（§2.1 不变量 2）。
 */

import type { CapabilityId } from '../../generated/capability-ids.js';
import type {
  ICommandGetInput,
  ICommandGetOutput,
  ICommandInvokeInput,
  ICommandInvokeOutput,
  ICommandListInput,
  ICommandListOutput,
  ICommandRegisterInput,
  ICommandRegisterOutput,
  ICommandUnregisterInput,
} from '../commands.js';
import type {
  IListHandlersOutput,
  IResourceOpenRequest,
  IResourceOpenResult,
} from '../resource-open.js';
import type { VoidInput } from './common.js';
import type {
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
} from './document.js';
import type {
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
} from './file.js';
import type {
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
} from './net.js';
import type {
  IPermissionAuditReadInput,
  IPermissionAuditReadOutput,
  IPermissionGrantInput,
  IPermissionGrantOutput,
} from './permission.js';
import type {
  IResourceReadInput,
  IResourceReadOutput,
  IResourceWriteInput,
  IResourceWriteOutput,
} from './resource.js';
import type {
  IClipboardReadOutput,
  IClipboardWriteInput,
  IDialogOpenInput,
  IDialogOpenOutput,
  IDialogSaveInput,
  IDialogSaveOutput,
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
  IWindowListOutput,
  IWindowMoveInput,
  IWindowResizeInput,
  IWindowSetStateInput,
  IWindowSetTitleInput,
} from './system.js';
import type {
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
} from './cli-task.js';

/**
 * 内置能力的输入 / 输出契约映射（04 §2.3 全表，64 项）。
 *
 * 键为能力 ID，值为 `{ input; output }`；`output: void` 表示无返回数据。
 */
export interface ICapabilityContracts {
  'file:read': { input: IFileReadInput; output: IFileReadOutput };
  'file:list': { input: IFileListInput; output: IFileListOutput };
  'file:watch': { input: IFileWatchInput; output: IFileWatchOutput };
  'file:write': { input: IFileWriteInput; output: void };
  'file:delete': { input: IFileDeleteInput; output: void };
  'file:move': { input: IFileMoveInput; output: void };
  'file:copy': { input: IFileCopyInput; output: void };
  'file:mkdir': { input: IFileMkdirInput; output: void };
  'resource:read': { input: IResourceReadInput; output: IResourceReadOutput };
  'resource:write': { input: IResourceWriteInput; output: IResourceWriteOutput };
  'resource:open': { input: IResourceOpenRequest; output: IResourceOpenResult };
  'resource:list-handlers': { input: VoidInput; output: IListHandlersOutput };
  'document:create': { input: IDocumentCreateInput; output: IDocumentCreateOutput };
  'document:open': { input: IDocumentOpenInput; output: IDocumentOpenOutput };
  'document:read': { input: IDocumentReadInput; output: IDocumentReadOutput };
  'document:write': { input: IDocumentWriteInput; output: IDocumentWriteOutput };
  'document:save': { input: IDocumentSaveInput; output: IDocumentSaveOutput };
  'document:export': { input: IDocumentExportInput; output: IDocumentExportOutput };
  'window:create': { input: IWindowCreateInput; output: IWindowCreateOutput };
  'window:list': { input: VoidInput; output: IWindowListOutput };
  'window:focus': { input: IWindowFocusInput; output: void };
  'window:close': { input: IWindowCloseInput; output: void };
  'window:resize': { input: IWindowResizeInput; output: void };
  'window:move': { input: IWindowMoveInput; output: void };
  'window:setTitle': { input: IWindowSetTitleInput; output: void };
  'window:setState': { input: IWindowSetStateInput; output: void };
  'menu:set': { input: IMenuSetInput; output: void };
  'tray:set': { input: ITraySetInput; output: void };
  'shortcut:register': { input: IShortcutRegisterInput; output: void };
  'shortcut:unregister': { input: IShortcutUnregisterInput; output: void };
  'system:info': { input: VoidInput; output: ISystemInfoOutput };
  'power:query': { input: VoidInput; output: IPowerQueryOutput };
  'power:prevent-sleep': { input: IPowerPreventSleepInput; output: void };
  'transfer:download': { input: ITransferDownloadInput; output: ITransferDownloadOutput };
  'transfer:cancel': { input: ITransferCancelInput; output: void };
  'notification:send': { input: INotificationSendInput; output: void };
  'clipboard:read': { input: VoidInput; output: IClipboardReadOutput };
  'clipboard:write': { input: IClipboardWriteInput; output: void };
  'dialog:open': { input: IDialogOpenInput; output: IDialogOpenOutput };
  'dialog:save': { input: IDialogSaveInput; output: IDialogSaveOutput };
  'shell:openExternal': { input: IShellOpenExternalInput; output: void };
  'http:request': { input: IHttpRequestInput; output: IHttpRequestOutput };
  'config:get': { input: IConfigGetInput; output: IConfigGetOutput };
  'config:snapshot': { input: IConfigSnapshotInput; output: IConfigSnapshotOutput };
  'config:set': { input: IConfigSetInput; output: void };
  'config:reset': { input: IConfigResetInput; output: void };
  'credential:get': { input: ICredentialGetInput; output: ICredentialGetOutput };
  'credential:set': { input: ICredentialSetInput; output: void };
  'credential:delete': { input: ICredentialDeleteInput; output: void };
  'event:publish': { input: IEventPublishInput; output: void };
  'command:register': { input: ICommandRegisterInput; output: ICommandRegisterOutput };
  'command:unregister': { input: ICommandUnregisterInput; output: void };
  'command:list': { input: ICommandListInput; output: ICommandListOutput };
  'command:get': { input: ICommandGetInput; output: ICommandGetOutput };
  'command:invoke': { input: ICommandInvokeInput; output: ICommandInvokeOutput };
  'cli:task-active': { input: ICliTaskActiveInput; output: ICliTaskActiveOutput };
  'cli:task-get': { input: ICliTaskGetInput; output: ICliTaskGetOutput };
  'cli:task-progress': { input: ICliTaskProgressInput; output: ICliTaskProgressOutput };
  'cli:task-complete': { input: ICliTaskCompleteInput; output: ICliTaskCompleteOutput };
  'cli:task-fail': { input: ICliTaskFailInput; output: ICliTaskFailOutput };
  'permission:grant': { input: IPermissionGrantInput; output: IPermissionGrantOutput };
  'permission:revoke': { input: IPermissionGrantInput; output: IPermissionGrantOutput };
  'permission:restore': { input: IPermissionGrantInput; output: IPermissionGrantOutput };
  'permission:audit-read': {
    input: IPermissionAuditReadInput;
    output: IPermissionAuditReadOutput;
  };
}

/**
 * 能力 `TId` 的输入契约类型（04 §2.3；02-SDK-API规范 §3.2 客户端类型化封装消费）。
 *
 * 约束 `TId extends CapabilityId` 使索引在编译期要求本表覆盖全部生成能力 ID。
 */
export type CapabilityInput<TId extends CapabilityId> = ICapabilityContracts[TId]['input'];

/** 能力 `TId` 的输出契约类型（04 §2.3；输出不做运行时 schema 校验，§2.1 不变量 2）。 */
export type CapabilityOutput<TId extends CapabilityId> = ICapabilityContracts[TId]['output'];
