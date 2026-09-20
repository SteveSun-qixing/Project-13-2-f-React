/**
 * CPK 装载器公共面（宿主插件管理层的对内导出口）。
 *
 * @remarks
 * - 导出面 = 装载器各模块的公共成员：错误码/限额/类型/错误模型、包读取、清单、签名、
 *   信任根、校验流水线、安装、注册表、激活端口与上下文、生命周期状态机与事件。
 * - `@chips/host` 对 `@chips/{bridge,sdk,cli}` 零运行时依赖：本目录全部为壳侧结构视图
 *   （漂移锁见 `tests/loader-contract.test.ts`）；消费方（组合根、运行时装配面）一律经
 *   本入口导入装载器能力，不得深入目录引内部模块。
 */

export {
  CPK_ERROR_CODES,
  CPK_ERROR_RETRYABLE,
  LIFECYCLE_ERROR_CODES,
  LIFECYCLE_ERROR_RETRYABLE,
  LOADER_ERROR_MESSAGES,
  LOADER_ERROR_RETRYABLE,
  loaderWireError,
  type CpkErrorCode,
  type CpkValidationStage,
  type LifecycleErrorCode,
  type LoaderErrorCode,
  type LoaderErrorOptions,
} from './codes.js';

export { CPK_LIMITS, LIFECYCLE_TIMEOUTS } from './limits.js';

export type {
  IPluginDependency,
  IPluginRecord,
  IPersistedPluginEntry,
  INormalizedManifest,
  PluginRole,
  PluginSource,
  PluginState,
} from './types.js';

export { LoaderError, asLoaderWireError, throwCpkError } from './errors.js';

export {
  loadCpkArchive,
  loadCpkDirectory,
  membersToZipEntries,
  assertDirectoryPackageRoot,
  type ICpkPackage,
} from './provider.js';

export {
  allPluginRoles,
  createHostPermissionCatalog,
  parseManifestText,
  validateManifest,
  type IHostManifestValidationResult,
  type IPermissionCatalog,
  type IPermissionRule,
  type PermissionQualifierRule,
} from './manifest.js';

export {
  SIGNATURE_FILE,
  computeContentHash,
  sha256Hex,
  verifySignature,
  type ISignatureStageResult,
} from './signature.js';

export {
  HOST_TRUST_ROOTS_FORMAT,
  createEmbeddedTrustRootRegistry,
  createTrustRootRegistry,
  createTrustRootRegistryFromDocument,
  embeddedTrustRootsDocument,
  normalizeTrustRootsDocument,
  rawPublicKeyToSpkiPem,
  type ITrustRootKey,
  type ITrustRootRegistry,
} from './trust-roots.js';

export {
  validateCpkPackage,
  validateLayout,
  type ICpkStageResult,
  type ICpkValidationInput,
  type ICpkValidationResult,
} from './validate.js';

export {
  installCpkPackage,
  removeInstalledPluginDirectory,
  type IInstallCpkOptions,
  type IInstallCpkResult,
} from './install.js';

export {
  REGISTRY_VERSION,
  openPluginRegistry,
  PluginRegistryPersistenceError,
  type IPersistedRegistryDocument,
  type IPluginRegistry,
} from './registry.js';

export {
  createPluginActivationContext,
  type IPluginActivationContext,
  type IPluginActivationContextOptions,
  type IPluginActivationPort,
} from './activation.js';

export {
  PLUGIN_LIFECYCLE_EVENTS,
  createCpkPluginLoader,
  type ICpkPluginLoader,
  type ICpkPluginLoaderDeps,
  type ILoaderInstallInput,
  type IPluginDisableResult,
  type IPluginFailedPayload,
  type IPluginInstalledPayload,
  type IPluginLoadedPayload,
  type IPluginStatePayload,
  type IPluginUninstalledPayload,
  type IRestoreReport,
  type PluginLifecycleEventId,
} from './lifecycle.js';
