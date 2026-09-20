/**
 * `@chips/host` 公开入口。
 *
 * 权威：`02-开发规范/01-代码组织规范` §3.1（包职责）、§4（依赖方向）、
 * `17-跨端Shell与平台抽象设计` §3.2（唯一交互面）、§4.1（PAL 类型属平台内部类型）。
 *
 * @remarks
 * - 本入口面向平台内部集成与测试：壳编排、窗口、IPC、协议、preload 桥与 PAL 契约。
 * - PAL 类型与壳类型不得由 `@chips/sdk` 导出，也不得出现在 `window.chips`（SL-5、SB-4）。
 * - 渲染进程入口（`src/renderer/**`）与 preload 入口（`src/preload/index.ts`）由构建产物直接装载，
 *   不经本入口聚合。
 */

export { createStderrDiagnostics } from './shared/diagnostics.js';
export type { DiagnosticsSink } from './shared/diagnostics.js';
export { HostStartupError, describeHostFailure, isHostStartupError } from './shared/errors.js';
export type { HostDiagnosticCode, HostStartupStage } from './shared/errors.js';

export {
  BRIDGE_REQUEST_CHANNEL,
  BRIDGE_RESOURCE_CHANNEL,
  EVENT_CHANNEL_PREFIX,
  EVENT_CONTROL_CHANNEL,
  RENDERER_TO_MAIN_CHANNELS,
  SESSION_PERMISSIONS_CHANNEL,
  eventChannel,
} from './protocol/channels.js';
export {
  isBridgeRequest,
  isBridgeResponse,
  isEventControlRequest,
  isEventControlResponse,
  isEventEnvelope,
  isResourceControlRequest,
  isResourceControlResponse,
  isSessionPermissionsUpdate,
  isWireChipsError,
  toWireError,
} from './protocol/wire.js';
export type {
  EventControlAction,
  IBridgeRequest,
  IBridgeResponse,
  IEventControlRequest,
  IEventControlResponse,
  IEventEnvelope,
  IResourceControlRequest,
  IResourceControlResponse,
  ISessionPermissionsUpdate,
  IWireChipsError,
  IWireResourceMetadata,
  ResourceControlOperation,
} from './protocol/wire.js';
export {
  isManagedResourceScope,
  isReservedResourceScope,
  isResourceUriFailure,
  normalizeResourceInput,
  parseResourceUri,
  toCanonicalResourceUri,
  RESOURCE_PATH_MAX_LENGTH,
  RESOURCE_PATH_SEGMENT_MAX_LENGTH,
  RESOURCE_URI_MAX_LENGTH,
} from './protocol/resource-uri.js';
export type {
  ResourceExternalOrigin,
  ResourcePathErrorReason,
  ResourceUriErrorReason,
  ResourceUriParseFailure,
  ResourceUriParseResult,
  ResourceUriParseSuccess,
} from './protocol/resource-uri.js';
export {
  isResourceErrorCode,
  needsCorsHeader,
  resourceErrorMessage,
  resourceErrorStatus,
  RESOURCE_ERROR_HTTP_STATUS,
  RESOURCE_ERROR_MESSAGES,
  RESOURCE_SECURITY_HEADERS,
} from './protocol/resource-error.js';
export type { ResourceErrorCode } from './protocol/resource-error.js';

export type {
  IEventSink,
  IPlatformHostChannel,
  IPlatformIpcEndpoint,
  IPlatformRuntime,
  IPlatformStartupInput,
  IResourceBackend,
  IResourceReadRequest,
  IResourceReadResult,
  ISessionSource,
} from './runtime/contracts.js';
export { asWireError } from './runtime/contracts.js';
export { createSelfCheckRuntime } from './runtime/self-check-runtime.js';
export type { SelfCheckRuntimeOptions } from './runtime/self-check-runtime.js';
export { createPlatformResourceBackend } from './runtime/platform-resource.js';

export {
  BRIDGE_ERROR_CODES,
  BRIDGE_ERROR_RETRYABLE,
  BRIDGE_ERROR_MESSAGES,
  PERMISSION_ERROR_CODES,
  bridgeWireError,
  permissionWireError,
} from './protocol/error-codes.js';
export type {
  BridgeErrorCode,
  BridgeErrorOptions,
  PermissionErrorCode,
  PermissionErrorOptions,
} from './protocol/error-codes.js';

export {
  HOST_CAPABILITY_DEFAULTS,
  HOST_CAPABILITY_OWNER,
  HOST_CAPABILITY_ID_PATTERN,
  HOST_PERMISSION_ID_PATTERN,
  isHostCapabilityId,
  isHostPermissionId,
} from './runtime/capability/contracts.js';
export type {
  HostCapabilityConcurrency,
  IHostCapabilityContext,
  IHostCapabilityDescriptor,
  IHostCapabilityHandler,
  IHostPermissionTargetRule,
  IRegisteredHostCapability,
  IHostCapabilityDescriptorView,
  IHostCapabilityRegistryReport,
  IHostSession,
  IHostSessionCreateInput,
  IHostSessionView,
  IHostReservedCapabilityView,
  IHostRuntimeReport,
} from './runtime/capability/contracts.js';
export { createHostCapabilityRegistry, HostCapabilityRegistrationError } from './runtime/capability/registry.js';
export type { IHostCapabilityRegistry, IHostCapabilityRegistryOptions } from './runtime/capability/registry.js';
export { createHostSessionRegistry, evaluateHostPermissions } from './runtime/capability/session.js';
export type {
  IHostSessionProvisioner,
  IHostSessionGrant,
  IHostSessionRegistry,
  IHostPermissionEvaluation,
  IHostPermissionDecision,
  SessionClosedListener,
  PermissionsChangedListener,
} from './runtime/capability/session.js';
export { createEventSubscriptionCenter, createResourceHandleCenter } from './runtime/capability/subscription.js';
export type { IEventSubscriptionCenter, IResourceHandleCenter } from './runtime/capability/subscription.js';
export { createHostCallScheduler } from './runtime/capability/scheduler.js';
export type { IHostCallScheduler, IHostCallGate, IHostCallPermit } from './runtime/capability/scheduler.js';
export { createHostCapabilityRouter } from './runtime/capability/router.js';
export type { IHostCapabilityRouter, IHostCapabilityRouterDeps } from './runtime/capability/router.js';

export {
  SYSTEM_INFO_CAPABILITY_ID,
  createSystemInfoCapability,
  createBuiltinCapabilities,
} from './runtime/capabilities/system-info.js';
export { RESERVED_DOCUMENT_CAPABILITIES, RESERVED_CAPABILITIES } from './runtime/capabilities/reserved.js';
export type { IReservedCapabilityDeclaration } from './runtime/capabilities/reserved.js';

export { createHostRuntime, createPlatformSessionProvisioner } from './runtime/host-runtime.js';
export type { HostRuntimeOptions, IHostRuntime } from './runtime/host-runtime.js';

export {
  buildProductionManifest,
  createProductionRuntime,
  createProductionAssembly,
} from './main/production-assembly.js';
export type { ProductionRuntimeOptions, ProductionAssemblyOptions } from './main/production-assembly.js';

export {
  assemblePalHost,
  buildCapabilityMatrix,
  validateCapabilityMatrix,
  validatePalHost,
} from './platform/matrix.js';
export {
  PalBootstrapError,
  PalPortError,
  isPalBootstrapError,
  isPalErrorCode,
  isPalPortError,
  toPalPortError,
  PAL_ERROR_CODES,
  PAL_ERROR_MESSAGES,
  PAL_ERROR_RETRYABLE,
} from './platform/errors.js';
export type { PalErrorCode, PalErrorShape, PalPortErrorOptions } from './platform/errors.js';
export { createElectronApi } from './platform/electron/electron-api.js';
export type { IElectronApi } from './platform/electron/electron-api.js';
export { loadElectronModule } from './platform/electron/load-electron.js';
export { createMacPalHost } from './platform/mac/index.js';
export type { MacPalHost, MacPalHostOptions } from './platform/mac/index.js';
export { createDirectoryVariableResolver, DirectoryVariableError } from './platform/directory-variables.js';
export type { DirectoryVariableResolver } from './platform/directory-variables.js';
export type {
  IPalCapabilityMatrix,
  IPalHost,
  IPalPorts,
  IPalRenderHost,
  IShellInfo,
  PalFacet,
  PlatformId,
  ShellKind,
} from './platform/contracts/index.js';

export type {
  ShellAppEvent,
  ShellCustomScheme,
  ShellElectronApp,
  ShellElectronProtocol,
  ShellIpcInvokeEvent,
  ShellIpcMain,
  ShellPathName,
  ShellSecondInstanceEvent,
  ShellSession,
  ShellSessionProtocol,
  ShellWebContents,
  ShellWindow,
  ShellWindowFactory,
} from './main/shell-api.js';
export { createElectronRuntime } from './main/electron-adapter.js';
export type { ShellElectronRuntime } from './main/electron-adapter.js';
export { registerIpcChannels } from './main/ipc-channels.js';
export type { IpcChannelDeps } from './main/ipc-channels.js';
export { resolveIpcSession, pushSessionPermissions, BRIDGE_SESSION_UNKNOWN_ERROR } from './main/session-resolver.js';
export { WindowBindings } from './main/window-bindings.js';
export type { IWindowBindings } from './main/window-bindings.js';
export { WindowRegistry } from './main/window-registry.js';
export type { WindowRecord, WindowRegistryOptions } from './main/window-registry.js';
export { WebContentsBinder } from './main/web-contents-binder.js';
export type { WebContentsBinderDeps } from './main/web-contents-binder.js';
export { ShellWindowManager } from './main/window-manager.js';
export type { ShellWindowCreateOptions, ShellWindowManagerDeps } from './main/window-manager.js';
export {
  attachResourceProtocol,
  handleResourceRequest,
  parseRangeHeader,
  registerResourceSchemePrivileges,
  CHIPS_RESOURCE_SCHEME,
  CHIPS_RESOURCE_SCHEME_PRIVILEGES,
} from './main/resource-protocol.js';
export type { RangeParseResult, ResourceProtocolDeps } from './main/resource-protocol.js';
export {
  assertSecureWebPreferences,
  buildWindowWebPreferences,
  isAllowedWindowLoadUrl,
  MAIN_WINDOW_CSP,
  SHELL_WINDOW_CSP,
  WINDOW_SECURITY_BASELINE,
} from './main/window-security.js';
export type { WindowPreferencesInput } from './main/window-security.js';
export { parseStartupInputs, StartupInputQueue, WORKSPACE_SWITCH_PREFIX } from './main/startup-inputs.js';
export type { StartupInput } from './main/startup-inputs.js';
export { DEFAULT_BOOTSTRAP_URL, HostApplication } from './main/application.js';
export type { BootstrapWindowOptions, HostApplicationOptions, HostApplicationState } from './main/application.js';
export { startHostMain } from './main/main.js';
export type { HostMainHandle, HostMainOptions } from './main/main.js';
export { createHostAssembly } from './main/runtime-provider.js';
export type { HostAssembly, HostRuntimeContext, PalHostContext } from './main/runtime-provider.js';

export { ChipsError, isChipsErrorShape, toChipsError } from './preload/chips-error.js';
export type { IChipsErrorShape } from './preload/chips-error.js';
export { createElectronPreloadTransport } from './preload/transport.js';
export type { ElectronIpcRendererLike, IPreloadTransport } from './preload/transport.js';
export { SubscriptionRegistry, MAX_PENDING_EVENTS } from './preload/subscriptions.js';
export type { ISubscription, SubscriptionRegistryDeps } from './preload/subscriptions.js';
export { SessionPermissionCache } from './preload/permission-cache.js';
export {
  createResourceHandle,
  RESOURCE_INLINE_MAX_BYTES,
  RESOURCE_INVALIDATED_EVENT_ID,
  ResourceInvalidationHub,
} from './preload/resource-handle.js';
export type {
  IResourceHandle,
  IResourceMetadata,
  ResourceHandleDeps,
  ResourceInvalidateReason,
  ResourceInvalidationRegistry,
  ResourceScope,
  ResourceState,
} from './preload/resource-handle.js';
export { createPreloadBridge } from './preload/bridge.js';
export type { IPreloadBridge, PreloadBridgeDeps } from './preload/bridge.js';
