/**
 * 命令运行时公开面：Provider、hooks、运行时工厂、端口解析与契约类型。
 *
 * 契约导出：《13-命令系统契约》§5.6 指定的 `ICommandRuntime` / `ICommandLocalRegistration` /
 * `CommandLocalHandler` 由本包导出；命令定义 / 视图与输入输出类型与 `@chips/sdk` 结构等价。
 */

export { CommandProvider, useCommandRuntime } from './context';
export type { CommandProviderProps } from './context';
export { formatAccelerator } from './accelerator';
export { resolveCommandBridgePort } from './platform-port';
export type {
  CommandLocalHandler,
  CommandScopeKind,
  CommandSource,
  CommandTarget,
  ICommandBridgePort,
  ICommandCondition,
  ICommandContext,
  ICommandDefinition,
  ICommandDiagnostic,
  ICommandGetInput,
  ICommandGetOutput,
  ICommandInvokedPayload,
  ICommandInvokeInput,
  ICommandInvokeOutput,
  ICommandListInput,
  ICommandListOutput,
  ICommandLocalRegistration,
  ICommandMenuPlacement,
  ICommandOwner,
  ICommandRuntime,
  ICommandScope,
  ICommandState,
  ICommandSubscription,
  ICommandToolbarPlacement,
  ICommandView,
  ICommandWhen,
} from './contract';
