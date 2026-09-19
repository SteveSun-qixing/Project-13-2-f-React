/**
 * `@chips/cli` 公开出口。
 *
 * 命令层（用户侧 / 开发侧）、参数模型、输出与错误模型、`cli-command` / `cli-task` 对接层、
 * 本地产物引擎与本地客户端组装全部经本模块导出；`chips` 可执行入口见 `src/bin.ts`。
 */

export {
  ChipsError,
  CLI_ERROR_MESSAGES,
  cliError,
  CliInterruptedError,
  exitCodeForCode,
  exitCodeForError,
  hasErrorCode,
  normalizeError,
  toErrorObject,
  type CliErrorCode,
  type CliExitCode,
  type IChipsErrorOptions,
  type IChipsErrorShape,
} from './errors.js';

export {
  parseGlobalOptions,
  type CliEntryKind,
  type IGlobalOptions,
  type IGlobalParseResult,
} from './args/global-options.js';

export { parseParameters, type IParseRequest, type IParseResult } from './args/parse.js';

export {
  createNodeFileSystem,
  type FileSystemKind,
  type IFileSystemPort,
} from './args/filesystem.js';

export type {
  CliParameterType,
  IBatchRules,
  IParameterDeclaration,
  IParameterSet,
  IPathRules,
  IUiControl,
  IValidationRules,
  OutputOverwritePolicy,
} from './args/types.js';

export { createNodeOutputSink, type IOutputSink } from './output/io.js';
export { renderError, renderResult, serializeJson, type ICommandResult } from './output/result.js';
export {
  createProgressWriter,
  formatProgress,
  type IProgressReport,
  type IProgressWriter,
} from './output/progress.js';

export {
  createServiceRouterClient,
  type IServiceRouterClientOptions,
} from './client/service-router.js';
export type {
  ICliCommandIndex,
  CliConfigLayer,
  CliLogLevel,
  ICliPluginDetail,
  ICliPluginRecord,
  CliPluginRole,
  CliPluginSource,
  CliPluginState,
  CliTaskStatus,
  CliUpdateChannel,
  CliWorkspaceKind,
  ICliWorkspaceStatus,
  ICliAppLaunchOperations,
  ICliArtifactCreateResult,
  ICliArtifactPackResult,
  ICliArtifactStageResult,
  ICliArtifactsApi,
  ICliArtifactValidateResult,
  ICliCapabilityInvokeResult,
  ICliCapabilityOperations,
  ICliClient,
  ICliCommandConflict,
  ICliCommandDeclaration,
  ICliCommandInvokeResult,
  ICliCommandListResult,
  ICliCommandOperations,
  ICliCommandQuery,
  ICliCommandResolveResult,
  ICliCommandTarget,
  ICliCommandView,
  ICliDevHostOperations,
  ICliDevRunInput,
  ICliDevServiceInvokeInput,
  ICliDoctorCheck,
  ICliDoctorReport,
  ICliInvoker,
  ICliLogEntry,
  ICliOpenResult,
  ICliOperationRecord,
  ICliPlatformOperations,
  ICliPluginInstallInput,
  ICliTaskApi,
  ICliTaskRecord,
  ICliUpdateCheckResult,
  ICliUpdateInstallResult,
  ICliWorkspaceState,
  IScaffoldPlan,
} from './client/types.js';

export {
  createOperationLogger,
  redactArgv,
  type IOperationLogger,
  type ICliOperationInput,
  type CliOperationSource,
} from './logging/operations.js';

export {
  commandPathKey,
  deriveEntryId,
  matchCommand,
  normalizeCommandPath,
  COMMAND_PATH_SEGMENT_PATTERN,
  FIXED_COMMAND_ROOTS,
  type ICommandMatch,
  type IMatchCommandOptions,
} from './plugin-cli/index.js';
export {
  executePluginCommand,
  extractOverwrite,
  readDottedPath,
  renderHuman,
  type IPluginCommandExecutionInput,
  type IResultEnvelope,
} from './plugin-cli/execute.js';

export {
  listCommands,
  listDevCommands,
  listUserCommands,
  matchBuiltinCommand,
} from './commands/registry.js';
export { FIXED_COMMAND_PATHS } from './commands/fixed-paths.js';
export type {
  ICliCommandDefinition,
  ICommandContext,
  IWorkspaceAccessor,
} from './commands/types.js';

export { createLocalArtifacts, type ILocalArtifactsOptions } from './artifacts/index.js';
export {
  createDocumentedPermissionCatalog,
  validatePermissionRequest,
  type IPermissionCatalog,
  type IPermissionRule,
} from './artifacts/permission-catalog.js';
export {
  computeContentHash,
  sha256Hex,
  validateCpk,
  CPK_LIMITS,
} from './artifacts/cpk-validate.js';
export { packCpk, type ICpkPackOptions } from './artifacts/cpk-pack.js';
export {
  parseManifestText,
  readManifestRole,
  validateManifest,
  type IManifestValidationInput,
  type IManifestValidationResult,
} from './artifacts/manifest.js';
export {
  compareSemver,
  isValidRange,
  parseRange,
  parseSemver,
  satisfies,
  satisfiesRange,
} from './artifacts/semver.js';
export { crc32 } from './artifacts/crc32.js';
export { readZipStore, writeZipStore, type IZipEntry } from './artifacts/zip.js';
export {
  resolveScaffoldProvider,
  writeScaffoldPlan,
  type IScaffoldProvider,
} from './artifacts/scaffold.js';

export { createLocalClient, type ILocalClientOptions } from './runtime/local-client.js';
export { main, detectEntry, type ICliMainOptions } from './main.js';
export {
  runCli,
  runDevCli,
  runEntry,
  resolveWorkspaceAccessor,
  type ICliRunDependencies,
} from './run.js';
export { CLI_VERSION } from './version.js';
