import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createError, toStandardError } from '../../shared/errors';
import { schemaRegistry } from '../../shared/schema';
import { createId, deepClone } from '../../shared/utils';
import type { LogEntry, RouteDescriptor, RouteInvocationContext, ServiceRegistration, StandardError } from '../../shared/types';
import { loadElectronModule } from '../electron/electron-loader';
import { rewriteThemeCssAssetUrls } from '../theme-runtime/css-assets';
import { mergeThemeLayers, resolveThemeFromLayers } from '../theme-runtime/resolve-algorithm';
import { buildThemeContractsView, type ThemeContract, validateThemeContractWithTokens } from '../theme-runtime/contract-guard';
import { toRenderThemeSnapshot } from '../theme-runtime/render-bridge';
import { buildThemeDiagnosticSummary } from '../theme-runtime/diagnostics';
import type { ThemeChangedEvent, ThemeContractView, ThemeResolveResult } from '../theme-runtime/types';
import { StructuredLogger } from '../../shared/logger';
import type { PluginUiConfig } from '../../shared/window-chrome';
import { cloneWindowChromeOptions, resolveManifestWindowChrome } from '../../shared/window-chrome';
import { PluginRuntime } from '../../runtime';
import type { CliCommandManifestMeta, CliCommandTargetManifestMeta, PluginRecord } from '../../runtime';
import type { Kernel } from '../../../packages/kernel/src';
import type { HostKind, PALAdapter, SurfaceContext, SurfaceKind, SurfacePresentation, SurfaceState, WindowChromeOptions } from '../../../packages/pal/src';
import { CardService } from '../../../packages/card-service/src';
import { CardInfoService } from '../../../packages/card-info-service/src';
import { CardOpenService } from '../../../packages/card-open-service/src';
import { ResourceOpenService } from '../../../packages/resource-open-service/src';
import { ResourceImageService } from '../../../packages/resource-image-service/src';
import { BoxService } from '../../../packages/box-service/src';
import { StoreZipService } from '../../../packages/zip-service/src';
import {
  buildModuleProviderRecords,
  compareSemver,
  findManifestMethod,
  findManifestProvider,
  loadModuleDefinition,
  matchesVersionRange,
  resolveInstalledModuleEntry,
  validateContractSchema,
  type ModuleJobRecord,
  type ModuleLogger,
  type ModulePluginDefinition,
  type ModuleProviderRecord
} from './module-runtime';

interface HostServiceContext {
  kernel: Kernel;
  pal: PALAdapter;
  workspacePath: string;
  logger: StructuredLogger;
  getCardService: () => CardService;
  getCardInfoService: () => CardInfoService;
  getBoxService: () => BoxService;
  getZipService: () => StoreZipService;
  runtime: PluginRuntime;
}

interface ThemePluginView {
  themeId: string;
  displayName: string;
  publisher?: string;
  parentTheme?: string;
  isDefault: boolean;
}

interface LayoutPluginView {
  layoutType?: string;
  displayName: string;
}

interface PluginInfoView {
  id: string;
  name: string;
  version: string;
  type: 'app' | 'card' | 'layout' | 'module' | 'theme';
  description?: string;
  installPath: string;
  capabilities: string[];
  theme?: ThemePluginView;
  layout?: LayoutPluginView;
}

interface PluginRecordView extends PluginInfoView {
  id: string;
  manifestPath: string;
  installPath: string;
  enabled: boolean;
  type: 'app' | 'card' | 'layout' | 'module' | 'theme';
  capabilities: string[];
  entry?: string | Record<string, string>;
  ui?: PluginUiConfig;
  installedAt: number;
}

interface CliCommandOwnerView {
  pluginId: string;
  pluginType: PluginRecord['manifest']['type'];
  pluginName: string;
  pluginVersion: string;
  source?: PluginRecord['manifest']['source'];
}

interface CliCommandConflictView {
  commandPathKey: string;
  enabledCommandIds: string[];
  allCommandIds: string[];
}

interface CliCommandView {
  commandId: string;
  commandPath: string[];
  commandPathKey: string;
  owner: CliCommandOwnerView;
  enabled: boolean;
  declaration: CliCommandManifestMeta;
  conflicts: CliCommandConflictView[];
}

interface CliCommandIndexView {
  schemaVersion: 1;
  version: string;
  updatedAt: string;
  workspacePath: string;
  commands: CliCommandView[];
  conflicts: CliCommandConflictView[];
}

interface CliCommandQueryOptions {
  commandPath?: string | string[];
  commandId?: string;
  pluginId?: string;
  targetType?: CliCommandTargetManifestMeta['type'];
  includeDisabled?: boolean;
}

interface PluginShortcutView {
  pluginId: string;
  name: string;
  location: 'desktop' | 'launchpad';
  launcherPath: string;
  executablePath: string;
  args: string[];
  iconPath?: string;
  exists: boolean;
}

interface FileListEntryView {
  path: string;
  isFile: boolean;
  isDirectory: boolean;
}

interface ModuleRuntimeRecord {
  pluginId: string;
  sessionId: string;
  bridgeScopeToken?: string;
  definition: ModulePluginDefinition;
  status: 'running' | 'error';
  activatedAt: number;
}

interface ModuleProviderView extends ModuleProviderRecord {}

interface ModuleRuntimeView {
  pluginId: string;
  sessionId: string;
  bridgeScopeToken?: string;
  status: 'running' | 'error';
  activatedAt: number;
}

type ModuleInvokeRequest = {
  capability: string;
  method: string;
  input: Record<string, unknown>;
  pluginId?: string;
  timeoutMs?: number;
};

interface ModuleJobView {
  jobId: string;
  pluginId: string;
  capability: string;
  method: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  progress?: Record<string, unknown>;
  output?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
  };
}

type CliTaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';

interface CliTaskRecord {
  taskId: string;
  pluginId: string;
  commandId: string;
  commandPath?: string[];
  invocationId?: string;
  surfaceId?: string;
  sessionId?: string;
  status: CliTaskStatus;
  createdAt: number;
  updatedAt: number;
  progress?: Record<string, unknown>;
  output?: unknown;
  error?: StandardError;
}

interface CliTaskView {
  taskId: string;
  pluginId: string;
  commandId: string;
  commandPath?: string[];
  invocationId?: string;
  surfaceId?: string;
  sessionId?: string;
  status: CliTaskStatus;
  createdAt: number;
  updatedAt: number;
  progress?: Record<string, unknown>;
  output?: unknown;
  error?: StandardError;
}

type CommandScopeKind = 'global' | 'app' | 'scene' | 'surface' | 'document';
type CommandSource = 'menu' | 'toolbar' | 'shortcut' | 'palette' | 'context-menu' | 'api' | 'cli';
type CommandIconStyle = 'outlined' | 'rounded' | 'sharp';
type FileWriteContent =
  | string
  | Buffer
  | Uint8Array
  | ArrayBuffer
  | ArrayBufferView
  | number[]
  | { type: 'Buffer'; data: number[] };

interface CommandIconDescriptor {
  name: string;
  style?: CommandIconStyle;
  fill?: 0 | 1;
  wght?: number;
  grad?: number;
  opsz?: number;
  decorative?: boolean;
}

interface CommandScope {
  kind: CommandScopeKind;
  appId?: string;
  sceneId?: string;
  surfaceId?: string;
  documentId?: string;
}

interface CommandCondition {
  key: string;
  equals?: unknown;
  notEquals?: unknown;
  in?: unknown[];
  truthy?: boolean;
}

interface CommandShortcut {
  accelerator: string;
  platform?: HostKind | 'all';
  when?: boolean | CommandCondition;
  preventDefault?: boolean;
}

interface CommandMenuPlacement {
  menuId: string;
  groupId?: string;
  order?: number;
}

interface CommandToolbarPlacement {
  toolbarId: string;
  groupId?: string;
  order?: number;
}

interface CommandStatePatch {
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;
  disabledReasonKey?: string;
  hiddenReasonKey?: string;
}

interface CommandDefinitionInput {
  commandId: string;
  titleKey: string;
  descriptionKey?: string;
  ariaLabelKey?: string;
  icon?: CommandIconDescriptor;
  shortcut?: CommandShortcut | CommandShortcut[];
  scope?: CommandScope;
  permission?: string | string[];
  enabledWhen?: boolean | CommandCondition;
  visibleWhen?: boolean | CommandCondition;
  checkedWhen?: boolean | CommandCondition;
  handlerId: string;
  menuPlacement?: CommandMenuPlacement[];
  toolbarPlacement?: CommandToolbarPlacement[];
  paletteKeywords?: string[];
  state?: CommandStatePatch;
}

interface RegisteredCommand {
  commandId: string;
  titleKey: string;
  descriptionKey?: string;
  ariaLabelKey?: string;
  icon?: CommandIconDescriptor;
  shortcut: CommandShortcut[];
  scope: CommandScope;
  permission: string[];
  enabledWhen?: boolean | CommandCondition;
  visibleWhen?: boolean | CommandCondition;
  checkedWhen?: boolean | CommandCondition;
  handlerId: string;
  menuPlacement: CommandMenuPlacement[];
  toolbarPlacement: CommandToolbarPlacement[];
  paletteKeywords: string[];
  state: CommandStatePatch;
  ownerCallerId: string;
  ownerPluginId?: string;
  ownerSessionId?: string;
  registeredAt: number;
  updatedAt: number;
}

interface CommandInvocationContext {
  pluginId?: string;
  sceneId?: string;
  surfaceId?: string;
  documentId?: string;
  taskId?: string;
  data?: Record<string, unknown>;
}

interface CommandQueryOptions {
  commandId?: string;
  ownerPluginId?: string;
  scope?: Partial<CommandScope>;
  source?: CommandSource;
  context?: CommandInvocationContext;
  includeDisabled?: boolean;
  includeHidden?: boolean;
}

interface CommandDiagnostic {
  visible: boolean;
  enabled: boolean;
  checked: boolean;
  hiddenReasonKey?: string;
  disabledReasonKey?: string;
}

interface CommandView {
  commandId: string;
  titleKey: string;
  descriptionKey?: string;
  ariaLabelKey?: string;
  icon?: CommandIconDescriptor;
  shortcut: CommandShortcut[];
  scope: CommandScope;
  permission: string[];
  handlerId: string;
  menuPlacement: CommandMenuPlacement[];
  toolbarPlacement: CommandToolbarPlacement[];
  paletteKeywords: string[];
  state: CommandStatePatch;
  ownerPluginId?: string;
  ownerSessionId?: string;
  registeredAt: number;
  updatedAt: number;
  diagnostic: CommandDiagnostic;
}

interface CommandInvokeInput {
  commandId: string;
  source?: CommandSource;
  payload?: Record<string, unknown>;
  context?: CommandInvocationContext;
}

interface ThemeRecord {
  id: string;
  displayName: string;
  version: string;
  publisher?: string;
  parentTheme?: string;
  isDefault: boolean;
  css: string;
  tokens: Record<string, unknown>;
  contract?: ThemeContract;
}

interface RouteMetric {
  count: number;
  failures: number;
  latencies: number[];
}

interface RuntimeState {
  configDefaults: Map<string, unknown>;
  configSystem: Map<string, unknown>;
  configWorkspace: Map<string, unknown>;
  configUser: Map<string, unknown>;
  moduleProviders: Map<string, ModuleProviderRecord[]>;
  moduleRuntimes: Map<string, ModuleRuntimeRecord>;
  moduleJobs: Map<string, ModuleJobRecord>;
  moduleJobControllers: Map<string, AbortController>;
  cliTasks: Map<string, CliTaskRecord>;
  credentials: Map<string, { iv: string; tag: string; value: string }>;
  clipboard: unknown;
  themes: ThemeRecord[];
  currentThemeId: string;
  locale: string;
  locales: Record<string, Record<string, string>>;
  commands: Map<string, RegisteredCommand>;
  commandShortcuts: Map<string, CommandShortcut[]>;
  cliCommandIndexVersion: number;
  routeMetrics: Map<string, RouteMetric>;
  activatedServices: Set<string>;
}

interface ResolvedHtmlExportPaths {
  htmlDir: string;
  entryFile: string;
  entryPath: string;
  outputFile: string;
}

const toModuleRuntimeView = (record: ModuleRuntimeRecord): ModuleRuntimeView => {
  return {
    pluginId: record.pluginId,
    sessionId: record.sessionId,
    bridgeScopeToken: record.bridgeScopeToken,
    status: record.status,
    activatedAt: record.activatedAt
  };
};

const toModuleJobView = (record: ModuleJobRecord): ModuleJobView => {
  return {
    jobId: record.jobId,
    pluginId: record.pluginId,
    capability: record.capability,
    method: record.method,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    progress: record.progress ? deepClone(record.progress) : undefined,
    output: typeof record.output === 'undefined' ? undefined : deepClone(record.output),
    error: record.error ? { ...record.error } : undefined
  };
};

const toCliTaskView = (record: CliTaskRecord): CliTaskView => {
  return {
    taskId: record.taskId,
    pluginId: record.pluginId,
    commandId: record.commandId,
    commandPath: record.commandPath ? [...record.commandPath] : undefined,
    invocationId: record.invocationId,
    surfaceId: record.surfaceId,
    sessionId: record.sessionId,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    progress: record.progress ? deepClone(record.progress) : undefined,
    output: typeof record.output === 'undefined' ? undefined : deepClone(record.output),
    error: record.error ? { ...record.error } : undefined
  };
};

const requireCliTask = (state: RuntimeState, taskId: string): CliTaskRecord => {
  const task = state.cliTasks.get(taskId);
  if (!task) {
    throw createError('CLI_TASK_NOT_FOUND', `CLI task not found: ${taskId}`, { taskId });
  }
  return task;
};

const ensureCliTaskOwner = (
  task: CliTaskRecord,
  routeContext: RouteInvocationContext,
  action: `${string}.${string}`
): void => {
  if (routeContext.caller.pluginId === task.pluginId) {
    return;
  }
  ensureCallerPermission(routeContext, 'plugin.manage', action);
};

const normalizeCliTaskError = (value: unknown): StandardError => {
  const standard = toStandardError(value, 'CLI_TASK_FAILED');
  return {
    ...standard,
    code: standard.code || 'CLI_TASK_FAILED',
    message: standard.message || 'CLI task failed'
  };
};

const emitModuleJobCancelled = async (
  ctx: HostServiceContext,
  job: ModuleJobRecord,
  reason: string
): Promise<void> => {
  await ctx.kernel.events.emit('module.job.cancelled', 'module-service', {
    jobId: job.jobId,
    pluginId: job.pluginId,
    capability: job.capability,
    method: job.method,
    status: job.status,
    reason,
    error: job.error
  });
};

const unregisterModulePluginState = async (
  ctx: HostServiceContext,
  state: RuntimeState,
  pluginId: string,
  reason: 'plugin-disabled' | 'plugin-uninstalled'
): Promise<void> => {
  state.moduleProviders.delete(pluginId);

  for (const [jobId, job] of state.moduleJobs.entries()) {
    if (job.pluginId !== pluginId) {
      continue;
    }
    if (job.status === 'running') {
      state.moduleJobControllers.get(jobId)?.abort();
      state.moduleJobControllers.delete(jobId);
      job.status = 'cancelled';
      job.updatedAt = Date.now();
      job.error = {
        code: 'MODULE_JOB_CANCELLED',
        message: 'Module job cancelled because plugin stopped'
      };
      await emitModuleJobCancelled(ctx, job, reason);
    }
  }

  await ctx.kernel.events.emit('module.runtime.stopped', 'module-service', {
    pluginId,
    reason
  });
};

const cancelCliTasksForPlugin = async (
  ctx: HostServiceContext,
  state: RuntimeState,
  pluginId: string,
  reason: 'plugin-disabled' | 'plugin-uninstalled'
): Promise<void> => {
  for (const task of state.cliTasks.values()) {
    if (task.pluginId !== pluginId || task.status !== 'running') {
      continue;
    }
    task.status = 'cancelled';
    task.updatedAt = Date.now();
    task.error = {
      code: 'CLI_TASK_CANCELLED',
      message: `CLI task cancelled because plugin was ${reason === 'plugin-disabled' ? 'disabled' : 'uninstalled'}`
    };
    await ctx.kernel.events.emit('cli.task.cancelled', 'cli-task-service', toCliTaskView(task));
  }
};

type ConfigScope = 'user' | 'workspace' | 'system';

const ensureWorkspace = async (workspacePath: string): Promise<void> => {
  await fs.mkdir(workspacePath, { recursive: true });
};

const resolveBoxSessionOwnerKey = (ctx: RouteInvocationContext): string => {
  return `${ctx.caller.type}:${ctx.caller.pluginId ?? ctx.caller.windowId ?? ctx.caller.id}`;
};

const updateMetric = (state: RuntimeState, route: string, failed: boolean, durationMs: number): void => {
  const current = state.routeMetrics.get(route) ?? { count: 0, failures: 0, latencies: [] };
  current.count += 1;
  if (failed) {
    current.failures += 1;
  }
  current.latencies.push(durationMs);
  if (current.latencies.length > 200) {
    current.latencies.shift();
  }
  state.routeMetrics.set(route, current);
};

const withMetrics = <I, O>(
  state: RuntimeState,
  route: string,
  handler: (input: I, ctx: RouteInvocationContext) => Promise<O>
): ((input: I, ctx: RouteInvocationContext) => Promise<O>) => {
  return async (input, ctx) => {
    const started = Date.now();
    try {
      const result = await handler(input, ctx);
      updateMetric(state, route, false, Date.now() - started);
      return result;
    } catch (error) {
      updateMetric(state, route, true, Date.now() - started);
      throw error;
    }
  };
};

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
};

const descriptor = <I, O>(
  key: `${string}.${string}`,
  permission: string[],
  timeoutMs: number,
  idempotent: boolean,
  retries: 0 | 1 | 2 | 3,
  handler: (input: I, ctx: RouteInvocationContext) => Promise<O>
): RouteDescriptor<I, O> => ({
  key,
  schemaIn: `schemas/${key}.request.json`,
  schemaOut: `schemas/${key}.response.json`,
  permission,
  timeoutMs,
  idempotent,
  retries,
  handler
});

const INTERACTIVE_DIALOG_ROUTE_TIMEOUT_MS = 30 * 60_000;

const buildState = (): RuntimeState => ({
  configDefaults: new Map<string, unknown>([
    ['ui.language', 'zh-CN'],
    ['ui.theme', 'chips-official.default-theme'],
    ['window.defaultWidth', 1200],
    ['window.defaultHeight', 760]
  ]),
  configSystem: new Map<string, unknown>(),
  configWorkspace: new Map<string, unknown>(),
  configUser: new Map<string, unknown>(),
  moduleProviders: new Map<string, ModuleProviderRecord[]>(),
  moduleRuntimes: new Map<string, ModuleRuntimeRecord>(),
  moduleJobs: new Map<string, ModuleJobRecord>(),
  moduleJobControllers: new Map<string, AbortController>(),
  cliTasks: new Map<string, CliTaskRecord>(),
  credentials: new Map<string, { iv: string; tag: string; value: string }>(),
  clipboard: null,
  themes: [],
  currentThemeId: 'chips-official.default-theme',
  locale: 'zh-CN',
  locales: {
    'zh-CN': {
      'system.ready': '系统已就绪',
      'system.error': '系统异常'
    },
    'en-US': {
      'system.ready': 'System ready',
      'system.error': 'System error'
    }
  },
  commands: new Map<string, RegisteredCommand>(),
  commandShortcuts: new Map<string, CommandShortcut[]>(),
  cliCommandIndexVersion: 1,
  routeMetrics: new Map<string, RouteMetric>(),
  activatedServices: new Set<string>()
});

const CONFIG_SCOPE_FILES: Record<ConfigScope, string> = {
  user: 'config.json',
  workspace: 'config.workspace.json',
  system: 'config.system.json'
};

const CREDENTIAL_STORE_FILE = 'credentials.enc.json';

const mapFromRecord = (record: Record<string, unknown>): Map<string, unknown> => {
  return new Map<string, unknown>(Object.entries(record));
};

const persistConfigScope = async (workspacePath: string, scope: ConfigScope, configMap: Map<string, unknown>): Promise<void> => {
  const data = Object.fromEntries(configMap.entries());
  const fileName = CONFIG_SCOPE_FILES[scope];
  await fs.writeFile(path.join(workspacePath, fileName), JSON.stringify(data, null, 2), 'utf-8');
};

const loadConfigScope = async (workspacePath: string, scope: ConfigScope): Promise<Map<string, unknown>> => {
  const configPath = path.join(workspacePath, CONFIG_SCOPE_FILES[scope]);
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return mapFromRecord(parsed);
  } catch {
    return new Map<string, unknown>();
  }
};

const loadConfig = async (workspacePath: string, state: RuntimeState): Promise<void> => {
  state.configSystem = await loadConfigScope(workspacePath, 'system');
  state.configWorkspace = await loadConfigScope(workspacePath, 'workspace');
  state.configUser = await loadConfigScope(workspacePath, 'user');
  await persistConfigScope(workspacePath, 'user', state.configUser);
};

const parseConfigScope = (value: unknown): ConfigScope => {
  if (value === 'system' || value === 'workspace' || value === 'user') {
    return value;
  }
  if (typeof value === 'undefined') {
    return 'user';
  }
  throw createError('CONFIG_SCOPE_INVALID', `Invalid config scope: ${String(value)}`);
};

const getConfigMapByScope = (state: RuntimeState, scope: ConfigScope): Map<string, unknown> => {
  if (scope === 'system') {
    return state.configSystem;
  }
  if (scope === 'workspace') {
    return state.configWorkspace;
  }
  return state.configUser;
};

const resolveConfigValue = (state: RuntimeState, key: string): unknown => {
  if (state.configUser.has(key)) {
    return state.configUser.get(key);
  }
  if (state.configWorkspace.has(key)) {
    return state.configWorkspace.get(key);
  }
  if (state.configSystem.has(key)) {
    return state.configSystem.get(key);
  }
  return state.configDefaults.get(key) ?? null;
};

const resolveConfigSnapshot = (state: RuntimeState): Record<string, unknown> => {
  return Object.fromEntries([
    ...state.configDefaults.entries(),
    ...state.configSystem.entries(),
    ...state.configWorkspace.entries(),
    ...state.configUser.entries()
  ]);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const mergeRecords = (base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = result[key];
    if (isRecord(current) && isRecord(value)) {
      result[key] = mergeRecords(current, value);
      continue;
    }
    result[key] = deepClone(value);
  }
  return result;
};

const asString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const asStringArray = (value: unknown): string[] => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
};

const normalizeFileWriteContent = (value: FileWriteContent): string | Buffer => {
  if (typeof value === 'string' || Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
    return Buffer.from(value);
  }
  if (
    isRecord(value) &&
    value.type === 'Buffer' &&
    Array.isArray(value.data) &&
    value.data.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)
  ) {
    return Buffer.from(value.data);
  }
  throw createError('FILE_CONTENT_INVALID', 'file.write content must be string or binary bytes');
};

const asPositiveFiniteNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
};

const isPathInside = (parentPath: string, targetPath: string): boolean => {
  const relative = path.relative(parentPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const normalizeHtmlEntryFile = (entryFile?: string): string => {
  const normalized = (asString(entryFile) ?? 'index.html').replace(/\\/g, '/');
  const candidate = path.posix.normalize(normalized);
  if (candidate.startsWith('/') || candidate === '..' || candidate.startsWith('../')) {
    throw createError('INVALID_ARGUMENT', 'entryFile must stay inside htmlDir', { entryFile });
  }
  return candidate;
};

const resolveHtmlExportPaths = async (input: {
  htmlDir: string;
  entryFile?: string;
  outputFile: string;
}): Promise<ResolvedHtmlExportPaths> => {
  const htmlDir = path.resolve(input.htmlDir);
  const htmlDirStat = await fs.stat(htmlDir).catch(() => null);
  if (!htmlDirStat?.isDirectory()) {
    throw createError('FILE_NOT_FOUND', 'htmlDir does not exist or is not a directory', { htmlDir });
  }

  const entryFile = normalizeHtmlEntryFile(input.entryFile);
  const entryPath = path.resolve(htmlDir, entryFile);
  if (!isPathInside(htmlDir, entryPath)) {
    throw createError('INVALID_ARGUMENT', 'entryFile must stay inside htmlDir', { entryFile });
  }

  const entryStat = await fs.stat(entryPath).catch(() => null);
  if (!entryStat?.isFile()) {
    throw createError('FILE_NOT_FOUND', 'HTML entry file does not exist', { htmlDir, entryFile, entryPath });
  }

  const outputFile = path.resolve(input.outputFile);
  await fs.mkdir(path.dirname(outputFile), { recursive: true });

  return {
    htmlDir,
    entryFile,
    entryPath,
    outputFile
  };
};

const countPdfPages = (buffer: Buffer): number | undefined => {
  const matches = buffer.toString('latin1').match(/\/Type\s*\/Page\b/g);
  return matches && matches.length > 0 ? matches.length : undefined;
};

const resolveThemeBackgroundColor = (state: RuntimeState): string => {
  const context = resolveRenderThemeContext(state, []);
  return (
    asString(context.resolvedTheme.variables['chips.sys.color.canvas']) ??
    asString(context.resolvedTheme.variables['chips.sys.color.surface']) ??
    '#ffffff'
  );
};

const waitForExportDocumentReady = async (browserWindow: {
  webContents: { executeJavaScript?: <T = unknown>(code: string, userGesture?: boolean) => Promise<T> };
}): Promise<void> => {
  if (typeof browserWindow.webContents.executeJavaScript !== 'function') {
    return;
  }

  await browserWindow.webContents.executeJavaScript(
    [
      'new Promise((resolve) => {',
      '  let settled = false;',
      '  const finish = () => {',
      '    if (settled) {',
      '      return;',
      '    }',
      '    settled = true;',
      '    const raf = typeof window.requestAnimationFrame === "function"',
      '      ? window.requestAnimationFrame.bind(window)',
      '      : (callback) => window.setTimeout(callback, 0);',
      '    raf(() => raf(() => resolve(true)));',
      '  };',
      '  const waitImages = Promise.all(Array.from(document.images || []).map((image) => {',
      '    if (image.complete) {',
      '      return Promise.resolve();',
      '    }',
      '    return new Promise((done) => {',
      '      image.addEventListener("load", () => done(undefined), { once: true });',
      '      image.addEventListener("error", () => done(undefined), { once: true });',
      '    });',
      '  }));',
      '  const waitFonts = document.fonts && typeof document.fonts.ready?.then === "function"',
      '    ? document.fonts.ready',
      '    : Promise.resolve();',
      '  const waitWindowLoad = document.readyState === "complete"',
      '    ? Promise.resolve()',
      '    : new Promise((done) => window.addEventListener("load", () => done(undefined), { once: true }));',
      '  const frameList = Array.from(document.querySelectorAll(".chips-composite__frame"));',
      '  const compositeBodyDataset = document.body?.dataset;',
      '  for (const frame of frameList) {',
      '    try {',
      '      frame.loading = "eager";',
      '      frame.setAttribute("loading", "eager");',
      '    } catch {}',
      '  }',
      '  const waitFrames = Promise.all(frameList.map((frame) => new Promise((done) => {',
      '    const finishFrame = () => done(undefined);',
      '    if (frame.dataset.loaded === "true") {',
      '      finishFrame();',
      '      return;',
      '    }',
      '    frame.addEventListener("load", finishFrame, { once: true });',
      '    frame.addEventListener("error", finishFrame, { once: true });',
      '    window.setTimeout(finishFrame, 3000);',
      '  })));',
      '  const isCompositeSettled = () => {',
      '    if (frameList.length === 0) {',
      '      return true;',
      '    }',
      '    const ready = compositeBodyDataset?.chipsCompositeReady === "true";',
      '    const lastResizeAt = Number(compositeBodyDataset?.chipsCompositeLastResizeAt ?? "0");',
      '    const quietForMs = Number.isFinite(lastResizeAt) && lastResizeAt > 0 ? Date.now() - lastResizeAt : Number.POSITIVE_INFINITY;',
      '    const framesReady = frameList.every((frame) => frame.dataset.loaded === "true" && frame.dataset.renderReady === "true");',
      '    return ready && framesReady && quietForMs >= 180;',
      '  };',
      '  const waitCompositeSettled = frameList.length === 0',
      '    ? Promise.resolve()',
      '    : new Promise((done) => {',
      '        const startedAt = Date.now();',
      '        const scheduleCheck = () => {',
      '          if (isCompositeSettled()) {',
      '            window.setTimeout(() => done(undefined), 120);',
      '            return;',
      '          }',
      '          if (Date.now() - startedAt >= 8000) {',
      '            done(undefined);',
      '            return;',
      '          }',
      '          window.setTimeout(scheduleCheck, 60);',
      '        };',
      '        window.addEventListener("message", (event) => {',
      '          const type = event?.data?.type;',
      '          if (type === "chips.composite:ready" || type === "chips.composite:resize" || type === "chips.basecard:height" || type === "chips.basecard:error") {',
      '            window.setTimeout(scheduleCheck, 0);',
      '          }',
      '        });',
      '        scheduleCheck();',
      '      });',
      '  Promise.all([waitWindowLoad, waitImages, waitFonts, waitFrames, waitCompositeSettled])',
      '    .then(() => window.setTimeout(finish, 80))',
      '    .catch(() => window.setTimeout(finish, 80));',
      '  window.setTimeout(finish, 10000);',
      '})'
    ].join('\n'),
    true
  );
};

const measureExportDocumentBounds = async (browserWindow: {
  webContents: { executeJavaScript?: <T = unknown>(code: string, userGesture?: boolean) => Promise<T> };
}): Promise<{ width?: number; height?: number }> => {
  let measuredWidth: number | undefined;
  let measuredHeight: number | undefined;

  if (typeof browserWindow.webContents.executeJavaScript === 'function') {
    const measured = await browserWindow.webContents
      .executeJavaScript<{ width?: number; height?: number }>(
        [
          '(() => ({',
          '  width: Math.max(',
          '    document.documentElement?.scrollWidth ?? 0,',
          '    document.body?.scrollWidth ?? 0,',
          '    document.documentElement?.offsetWidth ?? 0,',
          '    document.body?.offsetWidth ?? 0,',
          '    window.innerWidth ?? 0',
          '  ),',
          '  height: Math.max(',
          '    document.documentElement?.scrollHeight ?? 0,',
          '    document.body?.scrollHeight ?? 0,',
          '    document.documentElement?.offsetHeight ?? 0,',
          '    document.body?.offsetHeight ?? 0,',
          '    Number(document.body?.dataset?.chipsCompositeLastHeight ?? "0") || 0,',
          '    window.innerHeight ?? 0',
          '  )',
          '}))()'
        ].join('\n'),
        true
      )
      .catch(() => ({ width: undefined, height: undefined }));
    measuredWidth = asPositiveFiniteNumber(measured.width);
    measuredHeight = asPositiveFiniteNumber(measured.height);
  }

  return { width: measuredWidth, height: measuredHeight };
};

const resolveExportViewport = (
  measuredBounds: { width?: number; height?: number },
  requestedWidth?: number,
  requestedHeight?: number,
  scaleFactor = 1
): { width: number; height: number } => {
  const effectiveScale = asPositiveFiniteNumber(scaleFactor) ?? 1;
  const width = Math.max(1, Math.ceil((requestedWidth ?? measuredBounds.width ?? 1200) * effectiveScale));
  const height = Math.max(1, Math.ceil((requestedHeight ?? measuredBounds.height ?? 900) * effectiveScale));
  return { width, height };
};

const normalizeThemeAssetPath = (value: string): string => {
  return path.normalize(value).replace(/^[.][\\/]/, '');
};

const readJsonRecord = async (filePath: string): Promise<Record<string, unknown>> => {
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw createError('THEME_LOAD_FAILED', `Theme asset must be an object: ${filePath}`, { filePath });
  }
  return parsed;
};

const readThemeContract = async (installPath: string, contractPath?: string): Promise<ThemeContract | undefined> => {
  if (!contractPath) {
    return undefined;
  }

  const resolvedPath = path.resolve(installPath, normalizeThemeAssetPath(contractPath));
  const raw = await fs.readFile(resolvedPath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.components) ||
    (typeof parsed.version !== 'string' && typeof parsed.contractVersion !== 'string')
  ) {
    throw createError('THEME_CONTRACT_INVALID', 'Theme contract file is invalid', {
      contractPath: resolvedPath
    });
  }
  return parsed as unknown as ThemeContract;
};

const loadThemeRecordFromPlugin = async (plugin: ReturnType<PluginRuntime['query']>[number]): Promise<ThemeRecord> => {
  const themeMeta = plugin.manifest.theme;
  if (!themeMeta) {
    throw createError('THEME_LOAD_FAILED', 'Theme plugin metadata is missing from runtime record', {
      manifestPath: plugin.manifestPath,
      pluginId: plugin.manifest.id
    });
  }

  const resolvedTokensPath = path.resolve(plugin.installPath, normalizeThemeAssetPath(themeMeta.tokensPath));
  const resolvedThemeCssPath = path.resolve(plugin.installPath, normalizeThemeAssetPath(themeMeta.themeCssPath));
  const [tokens, css, contract] = await Promise.all([
    readJsonRecord(resolvedTokensPath),
    fs.readFile(resolvedThemeCssPath, 'utf-8'),
    readThemeContract(plugin.installPath, themeMeta.contractPath)
  ]);

  return {
    id: themeMeta.themeId,
    displayName: themeMeta.displayName,
    version: plugin.manifest.version,
    publisher: themeMeta.publisher,
    parentTheme: themeMeta.parentTheme,
    isDefault: themeMeta.isDefault,
    css: rewriteThemeCssAssetUrls(css, resolvedThemeCssPath),
    tokens,
    contract
  };
};

const loadInstalledThemes = async (runtime: PluginRuntime): Promise<ThemeRecord[]> => {
  const plugins = runtime.query({ type: 'theme' }).filter((plugin) => plugin.enabled);
  const loaded = await Promise.all(plugins.map((plugin) => loadThemeRecordFromPlugin(plugin)));
  return loaded.sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }
    return left.id.localeCompare(right.id);
  });
};

const findThemeRecord = (state: RuntimeState, themeId: string): ThemeRecord | undefined => {
  return state.themes.find((theme) => theme.id === themeId);
};

const toPluginInfoView = (record: ReturnType<PluginRuntime['query']>[number]): PluginInfoView => {
  return {
    id: record.manifest.id,
    name: record.manifest.name,
    version: record.manifest.version,
    type: record.manifest.type,
    description: record.manifest.description,
    installPath: record.installPath,
    capabilities: [...(record.manifest.capabilities ?? [])],
    theme: record.manifest.theme
      ? {
          themeId: record.manifest.theme.themeId,
          displayName: record.manifest.theme.displayName,
          publisher: record.manifest.theme.publisher,
          parentTheme: record.manifest.theme.parentTheme,
          isDefault: record.manifest.theme.isDefault
        }
      : undefined,
    layout: record.manifest.layout
      ? {
          layoutType: record.manifest.layout.layoutType,
          displayName: record.manifest.layout.displayName
        }
      : undefined
  };
};

const toPluginRecordView = (record: ReturnType<PluginRuntime['query']>[number]): PluginRecordView => {
  return {
    ...toPluginInfoView(record),
    manifestPath: record.manifestPath,
    enabled: record.enabled,
    entry: record.manifest.entry,
    ui: record.manifest.ui ? deepClone(record.manifest.ui) : undefined,
    installedAt: record.installedAt
  };
};

const normalizeCliCommandPathKey = (commandPath: string | string[]): string => {
  const segments = Array.isArray(commandPath)
    ? commandPath
    : commandPath.trim().split(/\s+/).filter((segment) => segment.length > 0);
  return segments.map((segment) => segment.trim().toLowerCase()).filter((segment) => segment.length > 0).join(' ');
};

const parseCliCommandQueryOptions = (input: unknown): CliCommandQueryOptions => {
  if (!isRecord(input)) {
    return {};
  }
  return {
    commandPath:
      typeof input.commandPath === 'string' || Array.isArray(input.commandPath)
        ? (input.commandPath as string | string[])
        : undefined,
    commandId: asString(input.commandId),
    pluginId: asString(input.pluginId),
    targetType: input.targetType === 'app' || input.targetType === 'module' ? input.targetType : undefined,
    includeDisabled: input.includeDisabled === true
  };
};

const toCliCommandOwnerView = (record: PluginRecord): CliCommandOwnerView => {
  return {
    pluginId: record.manifest.id,
    pluginType: record.manifest.type,
    pluginName: record.manifest.name,
    pluginVersion: record.manifest.version,
    source: record.manifest.source
  };
};

const buildCliCommandIndex = (ctx: HostServiceContext, state: RuntimeState): CliCommandIndexView => {
  const records = ctx.runtime
    .query()
    .filter((record) => record.manifest.type === 'app' || record.manifest.type === 'module')
    .sort((left, right) => left.manifest.id.localeCompare(right.manifest.id));
  const commands: CliCommandView[] = [];

  for (const record of records) {
    for (const declaration of record.manifest.cli?.commands ?? []) {
      const commandPathKey = normalizeCliCommandPathKey(declaration.commandPath);
      commands.push({
        commandId: declaration.commandId,
        commandPath: [...declaration.commandPath],
        commandPathKey,
        owner: toCliCommandOwnerView(record),
        enabled: record.enabled,
        declaration: deepClone(declaration),
        conflicts: []
      });
    }
  }

  const conflicts = [...commands.reduce((groups, command) => {
    const group = groups.get(command.commandPathKey) ?? [];
    group.push(command);
    groups.set(command.commandPathKey, group);
    return groups;
  }, new Map<string, CliCommandView[]>()).entries()]
    .map(([commandPathKey, groupedCommands]) => {
      const enabledCommandIds = groupedCommands
        .filter((command) => command.enabled)
        .map((command) => command.commandId)
        .sort((left, right) => left.localeCompare(right));
      if (enabledCommandIds.length <= 1) {
        return null;
      }
      return {
        commandPathKey,
        enabledCommandIds,
        allCommandIds: groupedCommands.map((command) => command.commandId).sort((left, right) => left.localeCompare(right))
      };
    })
    .filter((conflict): conflict is CliCommandConflictView => conflict !== null)
    .sort((left, right) => left.commandPathKey.localeCompare(right.commandPathKey));

  for (const command of commands) {
    command.conflicts = conflicts.filter((conflict) => conflict.allCommandIds.includes(command.commandId));
  }

  commands.sort((left, right) => {
    const byPath = left.commandPathKey.localeCompare(right.commandPathKey);
    if (byPath !== 0) {
      return byPath;
    }
    return left.commandId.localeCompare(right.commandId);
  });

  return {
    schemaVersion: 1,
    version: String(state.cliCommandIndexVersion),
    updatedAt: new Date(state.cliCommandIndexVersion).toISOString(),
    workspacePath: ctx.workspacePath,
    commands,
    conflicts
  };
};

const filterCliCommands = (index: CliCommandIndexView, options: CliCommandQueryOptions): CliCommandView[] => {
  const commandPathKey =
    typeof options.commandPath !== 'undefined'
      ? normalizeCliCommandPathKey(options.commandPath)
      : undefined;
  return index.commands.filter((command) => {
    if (!options.includeDisabled && !command.enabled) {
      return false;
    }
    if (options.commandId && command.commandId !== options.commandId) {
      return false;
    }
    if (commandPathKey && command.commandPathKey !== commandPathKey) {
      return false;
    }
    if (options.pluginId && command.owner.pluginId !== options.pluginId) {
      return false;
    }
    if (options.targetType && command.declaration.target.type !== options.targetType) {
      return false;
    }
    return true;
  });
};

const touchCliCommandIndex = (state: RuntimeState): void => {
  state.cliCommandIndexVersion = Date.now();
};

const shortcutRegistryPath = (workspacePath: string): string => path.join(workspacePath, 'plugin-shortcuts.json');

const readShortcutRegistry = async (workspacePath: string): Promise<Record<string, string>> => {
  try {
    const raw = await fs.readFile(shortcutRegistryPath(workspacePath), 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
    );
  } catch {
    return {};
  }
};

const writeShortcutRegistry = async (workspacePath: string, registry: Record<string, string>): Promise<void> => {
  await fs.mkdir(path.dirname(shortcutRegistryPath(workspacePath)), { recursive: true });
  await fs.writeFile(shortcutRegistryPath(workspacePath), JSON.stringify(registry, null, 2), 'utf-8');
};

const getPreferredLauncherIconExtensions = (platform: string): string[] => {
  if (platform === 'darwin') {
    return ['.icns', '.png', '.ico', '.svg'];
  }
  if (platform === 'win32') {
    return ['.ico', '.png', '.svg', '.icns'];
  }
  return ['.png', '.svg', '.ico', '.icns'];
};

const resolveExistingIconCandidate = async (candidates: string[]): Promise<string | undefined> => {
  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // continue probing candidates
    }
  }

  return undefined;
};

const resolvePluginIconPath = async (
  record: ReturnType<PluginRuntime['get']>,
  platform: string
): Promise<string | undefined> => {
  const declaredIconPath = record.manifest.ui?.launcher?.icon;
  if (typeof declaredIconPath === 'string' && declaredIconPath.trim().length > 0) {
    const resolvedDeclaredPath = path.resolve(record.installPath, declaredIconPath);
    const preferredDeclaredVariants = [
      ...getPreferredLauncherIconExtensions(platform).map((extension) => {
        return `${resolvedDeclaredPath.slice(0, resolvedDeclaredPath.length - path.extname(resolvedDeclaredPath).length)}${extension}`;
      }),
      resolvedDeclaredPath
    ];
    const resolvedDeclaredCandidate = await resolveExistingIconCandidate([...new Set(preferredDeclaredVariants)]);
    if (resolvedDeclaredCandidate) {
      return resolvedDeclaredCandidate;
    }
  }

  const candidates = [
    ...['app-icon', 'icon'].flatMap((name) => {
      return getPreferredLauncherIconExtensions(platform).map((extension) => `assets/icons/${name}${extension}`);
    })
  ].map((relativePath) => path.join(record.installPath, relativePath));

  return resolveExistingIconCandidate(candidates);
};

const resolveAppEntryPath = (): string => {
  const candidates = [
    path.resolve(__dirname, '../electron/app-entry.js'),
    path.resolve(__dirname, '../electron/app-entry.ts')
  ];

  for (const candidate of candidates) {
    try {
      const stats = require('node:fs').statSync(candidate) as { isFile(): boolean };
      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // continue probing
    }
  }

  throw createError('HOST_APP_ENTRY_NOT_FOUND', 'Host electron app entry is unavailable', { candidates });
};

export const shouldPassAppEntryArgument = (executablePath: string, defaultApp?: boolean): boolean => {
  if (defaultApp === true) {
    return true;
  }

  const executableName = path.basename(executablePath).toLowerCase();
  return executableName === 'node' || executableName === 'node.exe';
};

export const resolveLaunchExecutable = (): { executablePath: string; argsPrefix: string[] } => {
  const processRef = process as NodeJS.Process & { defaultApp?: boolean };
  const executablePath = processRef.execPath;

  return {
    executablePath,
    // Packaged Electron apps already resolve their main entry from Resources/app/package.json.
    // Passing app-entry.js again forces "default app" style launching and breaks macOS launcher apps.
    argsPrefix: shouldPassAppEntryArgument(executablePath, processRef.defaultApp)
      ? [resolveAppEntryPath()]
      : []
  };
};

const toSerializableErrorDetails = (error: unknown): unknown => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  if (error && typeof error === 'object') {
    return { ...(error as Record<string, unknown>) };
  }

  return {
    value: error
  };
};

const getErrnoCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as Record<string, unknown>;
  return typeof candidate.code === 'string' ? candidate.code : undefined;
};

const toPluginShortcutCreateError = (
  pluginId: string,
  shortcut: Pick<PluginShortcutView, 'launcherPath' | 'location'>,
  error: unknown
) => {
  const errnoCode = getErrnoCode(error);
  const details = {
    pluginId,
    launcherPath: shortcut.launcherPath,
    location: shortcut.location,
    cause: toSerializableErrorDetails(error)
  };

  if (errnoCode === 'EACCES' || errnoCode === 'EPERM') {
    if (shortcut.location === 'launchpad') {
      return createError(
        'PLUGIN_SHORTCUT_PERMISSION_DENIED',
        'Cannot create macOS launchpad shortcut because ~/Applications/Chips Apps is not writable by the current user. Re-run the macOS installer to repair the directory ownership.',
        details
      );
    }

    return createError(
      'PLUGIN_SHORTCUT_PERMISSION_DENIED',
      `Cannot create shortcut because target directory is not writable: ${shortcut.launcherPath}`,
      details
    );
  }

  return createError('PLUGIN_SHORTCUT_CREATE_FAILED', `Failed to create shortcut for ${pluginId}`, details);
};

const resolveListedPath = (dir: string, entry: string): string => {
  return path.isAbsolute(entry) ? path.normalize(entry) : path.join(dir, entry);
};

const toFileListEntries = async (pal: PALAdapter, dir: string, entries: string[]): Promise<FileListEntryView[]> => {
  const resolved = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolveListedPath(dir, entry);
      try {
        const stat = await pal.fs.stat(entryPath);
        return {
          path: entryPath,
          isFile: stat.isFile,
          isDirectory: stat.isDirectory
        };
      } catch {
        return null;
      }
    })
  );

  return resolved.filter((entry): entry is FileListEntryView => entry !== null);
};

const buildPluginShortcutArgs = (workspacePath: string, pluginId: string): string[] => {
  const target = resolveLaunchExecutable();
  return [...target.argsPrefix, `--workspace=${workspacePath}`, `--chips-launch-plugin=${pluginId}`];
};

const defaultPluginSurfaceKindByHostKind: Record<HostKind, SurfaceKind> = {
  desktop: 'window',
  web: 'route',
  mobile: 'fullscreen',
  headless: 'window'
};

const mergeWindowChromeOptions = (
  base: WindowChromeOptions | undefined,
  override: WindowChromeOptions | undefined
): WindowChromeOptions | undefined => {
  const merged = {
    ...(cloneWindowChromeOptions(base) ?? {}),
    ...(cloneWindowChromeOptions(override) ?? {})
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
};

const cloneSurfacePresentation = (presentation: SurfacePresentation): SurfacePresentation => {
  return {
    ...presentation,
    chrome: cloneWindowChromeOptions(presentation.chrome)
  };
};

const cloneSurfaceContext = (context: SurfaceContext): SurfaceContext => {
  return {
    ...context,
    presentation: cloneSurfacePresentation(context.presentation),
    launchParams: context.launchParams ? { ...context.launchParams } : undefined,
    documentContext: context.documentContext ? { ...context.documentContext } : undefined,
    commandContext: context.commandContext
      ? {
          ...context.commandContext,
          payload: context.commandContext.payload ? { ...context.commandContext.payload } : undefined
        }
      : undefined
  };
};

const withSurfaceContext = (surface: SurfaceState, context: SurfaceContext): SurfaceState => {
  const nextContext = cloneSurfaceContext({
    ...context,
    surfaceId: surface.id,
    kind: surface.kind
  });
  return {
    ...surface,
    context: nextContext,
    metadata: {
      ...(surface.metadata ?? {}),
      sceneId: nextContext.sceneId
    }
  };
};

const buildSurfaceLifecyclePayload = (surface: SurfaceState): Record<string, unknown> => {
  return {
    surfaceId: surface.id,
    sceneId: surface.context?.sceneId,
    pluginId: surface.pluginId ?? surface.context?.pluginId,
    sessionId: surface.sessionId ?? surface.context?.sessionId,
    kind: surface.kind,
    presentation: surface.context?.presentation,
    surface
  };
};

const emitSurfaceCreatedEvents = async (
  ctx: HostServiceContext,
  source: string,
  surface: SurfaceState
): Promise<void> => {
  const payload = buildSurfaceLifecyclePayload(surface);
  if (surface.context) {
    await ctx.kernel.events.emit('scene.created', source, payload);
    await ctx.kernel.events.emit('scene.active', source, payload);
  }
  await ctx.kernel.events.emit('surface.opened', source, surface);
  if (surface.kind === 'window') {
    await ctx.kernel.events.emit('window.opened', source, surface);
  }
};

const emitSurfaceActionEvent = async (
  ctx: HostServiceContext,
  eventName: string,
  source: string,
  surface: SurfaceState,
  extra?: Record<string, unknown>
): Promise<void> => {
  await ctx.kernel.events.emit(eventName, source, {
    ...buildSurfaceLifecyclePayload(surface),
    ...(extra ?? {})
  });
};

const buildGenericSurfaceContext = (
  request: Parameters<PALAdapter['surface']['open']>[0],
  presentation: SurfacePresentation
): SurfaceContext => {
  const launchParams = request.target.type === 'plugin' ? request.target.launchParams : undefined;
  return {
    sceneId: request.context?.sceneId ?? createId(),
    pluginId: request.target.type === 'plugin' ? request.target.pluginId : request.context?.pluginId,
    sessionId: request.target.type === 'plugin' ? request.target.sessionId : request.context?.sessionId,
    kind: request.kind ?? request.context?.kind ?? 'window',
    presentation: cloneSurfacePresentation(presentation),
    launchParams: launchParams ? { ...launchParams } : request.context?.launchParams,
    documentContext:
      request.target.type === 'document'
        ? {
            documentId: request.target.documentId,
            title: request.target.title,
            url: request.target.url
          }
        : request.context?.documentContext,
    commandContext: request.context?.commandContext
  };
};

const resolvePluginSurfaceKind = (
  plugin: PluginRecord,
  hostKind: HostKind,
  requestedKind: SurfaceKind | undefined
): SurfaceKind => {
  if (requestedKind) {
    return requestedKind;
  }

  return (
    plugin.manifest.ui?.surface?.preferredKinds?.[hostKind] ??
    plugin.manifest.ui?.surface?.defaultKind ??
    defaultPluginSurfaceKindByHostKind[hostKind]
  );
};

const ensureCallerPermission = (
  routeContext: RouteInvocationContext,
  permission: string,
  action: `${string}.${string}`
): void => {
  const grantedPermissions = routeContext.caller.permissions ?? [];
  if (grantedPermissions.includes(permission)) {
    return;
  }

  throw createError(
    'PERMISSION_DENIED',
    `Caller lacks permission: ${permission}`,
    {
      action,
      permission,
      required: [permission],
      granted: grantedPermissions,
      callerId: routeContext.caller.id,
      callerType: routeContext.caller.type,
      pluginId: routeContext.caller.pluginId
    },
    false,
    {
      messageKey: 'chips.error.permissionDenied',
      requestId: routeContext.requestId,
      permission: {
        action,
        required: [permission],
        granted: grantedPermissions,
        messageKey: 'chips.error.permissionDenied',
        callerId: routeContext.caller.id,
        callerType: routeContext.caller.type,
        pluginId: routeContext.caller.pluginId
      }
    }
  );
};

const COMMAND_SCOPE_KINDS = new Set<CommandScopeKind>(['global', 'app', 'scene', 'surface', 'document']);
const COMMAND_SOURCES = new Set<CommandSource>(['menu', 'toolbar', 'shortcut', 'palette', 'context-menu', 'api', 'cli']);
const COMMAND_ICON_STYLES = new Set<CommandIconStyle>(['outlined', 'rounded', 'sharp']);

const assertNoRawCommandText = (definition: Record<string, unknown>): void => {
  const rawTextFields = ['title', 'description', 'ariaLabel', 'label'].filter((field) => typeof definition[field] !== 'undefined');
  if (rawTextFields.length > 0) {
    throw createError('COMMAND_I18N_KEY_REQUIRED', 'Command text must use i18n keys instead of raw text fields', {
      fields: rawTextFields
    });
  }
};

const normalizeCommandIcon = (value: unknown): CommandIconDescriptor | undefined => {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (!isRecord(value)) {
    throw createError('COMMAND_SCHEMA_INVALID', 'command.icon must be an IconDescriptor object');
  }
  const name = asString(value.name);
  if (!name) {
    throw createError('COMMAND_SCHEMA_INVALID', 'command.icon.name must be a non-empty string');
  }
  const style = typeof value.style === 'string' && COMMAND_ICON_STYLES.has(value.style as CommandIconStyle)
    ? value.style as CommandIconStyle
    : undefined;
  if (typeof value.style !== 'undefined' && !style) {
    throw createError('COMMAND_SCHEMA_INVALID', 'command.icon.style is invalid');
  }
  const result: CommandIconDescriptor = { name };
  if (style) {
    result.style = style;
  }
  if (value.fill === 0 || value.fill === 1) {
    result.fill = value.fill;
  }
  for (const key of ['wght', 'grad', 'opsz'] as const) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) {
      result[key] = value[key];
    }
  }
  if (typeof value.decorative === 'boolean') {
    result.decorative = value.decorative;
  }
  return result;
};

const normalizeCommandScope = (value: unknown, routeContext: RouteInvocationContext): CommandScope => {
  if (typeof value === 'undefined') {
    return {
      kind: 'app',
      appId: routeContext.caller.pluginId
    };
  }
  if (!isRecord(value)) {
    throw createError('COMMAND_SCOPE_INVALID', 'command.scope must be an object');
  }
  const kind = typeof value.kind === 'string' && COMMAND_SCOPE_KINDS.has(value.kind as CommandScopeKind)
    ? value.kind as CommandScopeKind
    : undefined;
  if (!kind) {
    throw createError('COMMAND_SCOPE_INVALID', 'command.scope.kind is invalid');
  }
  const scope: CommandScope = {
    kind,
    appId: asString(value.appId),
    sceneId: asString(value.sceneId),
    surfaceId: asString(value.surfaceId),
    documentId: asString(value.documentId)
  };
  if (scope.kind === 'app') {
    scope.appId = scope.appId ?? routeContext.caller.pluginId;
    if (!scope.appId) {
      throw createError('COMMAND_SCOPE_INVALID', 'app command scope requires appId or plugin caller context');
    }
    if (routeContext.caller.type === 'plugin' && routeContext.caller.pluginId && scope.appId !== routeContext.caller.pluginId) {
      throw createError('COMMAND_SCOPE_INVALID', 'plugin callers can only register app commands for themselves', {
        appId: scope.appId,
        pluginId: routeContext.caller.pluginId
      });
    }
  }
  if (scope.kind === 'scene' && !scope.sceneId) {
    throw createError('COMMAND_SCOPE_INVALID', 'scene command scope requires sceneId');
  }
  if (scope.kind === 'surface' && !scope.surfaceId) {
    throw createError('COMMAND_SCOPE_INVALID', 'surface command scope requires surfaceId');
  }
  if (scope.kind === 'document' && !scope.documentId) {
    throw createError('COMMAND_SCOPE_INVALID', 'document command scope requires documentId');
  }
  if (scope.kind === 'global' && routeContext.caller.type === 'plugin') {
    ensureCallerPermission(routeContext, 'command.manage', 'command.register');
  }
  return scope;
};

const normalizeCommandCondition = (value: unknown, field: string): boolean | CommandCondition | undefined => {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (!isRecord(value)) {
    throw createError('COMMAND_SCHEMA_INVALID', `${field} must be a boolean or condition object`);
  }
  const key = asString(value.key);
  if (!key) {
    throw createError('COMMAND_SCHEMA_INVALID', `${field}.key must be a non-empty string`);
  }
  const condition: CommandCondition = { key };
  if (typeof value.equals !== 'undefined') {
    condition.equals = deepClone(value.equals);
  }
  if (typeof value.notEquals !== 'undefined') {
    condition.notEquals = deepClone(value.notEquals);
  }
  if (Array.isArray(value.in)) {
    condition.in = value.in.map((item) => deepClone(item));
  }
  if (typeof value.truthy === 'boolean') {
    condition.truthy = value.truthy;
  }
  return condition;
};

const normalizeCommandShortcut = (value: unknown): CommandShortcut[] => {
  if (typeof value === 'undefined') {
    return [];
  }
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => {
    if (!isRecord(item)) {
      throw createError('COMMAND_SCHEMA_INVALID', 'command.shortcut items must be objects');
    }
    const accelerator = asString(item.accelerator);
    if (!accelerator) {
      throw createError('COMMAND_SCHEMA_INVALID', 'command.shortcut.accelerator must be a non-empty string');
    }
    const platform = typeof item.platform === 'string' && (item.platform === 'all' || ['desktop', 'web', 'mobile', 'headless'].includes(item.platform))
      ? item.platform as HostKind | 'all'
      : undefined;
    if (typeof item.platform !== 'undefined' && !platform) {
      throw createError('COMMAND_SCHEMA_INVALID', 'command.shortcut.platform is invalid');
    }
    const shortcut: CommandShortcut = {
      accelerator,
      when: normalizeCommandCondition(item.when, 'command.shortcut.when'),
      preventDefault: typeof item.preventDefault === 'boolean' ? item.preventDefault : undefined
    };
    if (platform) {
      shortcut.platform = platform;
    }
    return shortcut;
  });
};

const normalizeCommandPlacement = (
  value: unknown,
  field: 'menuPlacement' | 'toolbarPlacement'
): CommandMenuPlacement[] | CommandToolbarPlacement[] => {
  if (typeof value === 'undefined') {
    return [];
  }
  if (!Array.isArray(value)) {
    throw createError('COMMAND_SCHEMA_INVALID', `command.${field} must be an array`);
  }
  if (field === 'menuPlacement') {
    return value.map((item) => {
      if (!isRecord(item)) {
        throw createError('COMMAND_SCHEMA_INVALID', 'command.menuPlacement items must be objects');
      }
      const menuId = asString(item.menuId);
      if (!menuId) {
        throw createError('COMMAND_SCHEMA_INVALID', 'command.menuPlacement.menuId must be a non-empty string');
      }
      return {
        menuId,
        groupId: asString(item.groupId),
        order: typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : undefined
      };
    });
  }
  return value.map((item) => {
    if (!isRecord(item)) {
      throw createError('COMMAND_SCHEMA_INVALID', 'command.toolbarPlacement items must be objects');
    }
    const toolbarId = asString(item.toolbarId);
    if (!toolbarId) {
      throw createError('COMMAND_SCHEMA_INVALID', 'command.toolbarPlacement.toolbarId must be a non-empty string');
    }
    return {
      toolbarId,
      groupId: asString(item.groupId),
      order: typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : undefined
    };
  });
};

const normalizeCommandStatePatch = (value: unknown): CommandStatePatch => {
  if (typeof value === 'undefined') {
    return {};
  }
  if (!isRecord(value)) {
    throw createError('COMMAND_SCHEMA_INVALID', 'command.state must be an object');
  }
  const statePatch: CommandStatePatch = {};
  if (typeof value.enabled === 'boolean') {
    statePatch.enabled = value.enabled;
  }
  if (typeof value.visible === 'boolean') {
    statePatch.visible = value.visible;
  }
  if (typeof value.checked === 'boolean') {
    statePatch.checked = value.checked;
  }
  const disabledReasonKey = asString(value.disabledReasonKey);
  if (disabledReasonKey) {
    statePatch.disabledReasonKey = disabledReasonKey;
  } else {
    const reasonKey = asString(value.reasonKey);
    if (reasonKey) {
      statePatch.disabledReasonKey = reasonKey;
    }
  }
  const hiddenReasonKey = asString(value.hiddenReasonKey);
  if (hiddenReasonKey) {
    statePatch.hiddenReasonKey = hiddenReasonKey;
  }
  return statePatch;
};

const normalizeCommandDefinition = (
  input: unknown,
  routeContext: RouteInvocationContext
): RegisteredCommand => {
  const definition = isRecord(input) && isRecord(input.command) ? input.command : input;
  if (!isRecord(definition)) {
    throw createError('COMMAND_SCHEMA_INVALID', 'command.register requires a command object');
  }
  assertNoRawCommandText(definition);
  const commandId = asString(definition.commandId);
  const titleKey = asString(definition.titleKey);
  const handlerId = asString(definition.handlerId);
  if (!commandId) {
    throw createError('COMMAND_SCHEMA_INVALID', 'commandId must be a non-empty string');
  }
  if (!titleKey) {
    throw createError('COMMAND_I18N_KEY_REQUIRED', 'titleKey must be a non-empty i18n key', { commandId });
  }
  if (!handlerId) {
    throw createError('COMMAND_SCHEMA_INVALID', 'handlerId must be a non-empty string', { commandId });
  }
  const registeredAt = Date.now();
  const permission = asStringArray(definition.permission);
  return {
    commandId,
    titleKey,
    descriptionKey: asString(definition.descriptionKey),
    ariaLabelKey: asString(definition.ariaLabelKey),
    icon: normalizeCommandIcon(definition.icon),
    shortcut: normalizeCommandShortcut(definition.shortcut),
    scope: normalizeCommandScope(definition.scope, routeContext),
    permission,
    enabledWhen: normalizeCommandCondition(definition.enabledWhen, 'command.enabledWhen'),
    visibleWhen: normalizeCommandCondition(definition.visibleWhen, 'command.visibleWhen'),
    checkedWhen: normalizeCommandCondition(definition.checkedWhen, 'command.checkedWhen'),
    handlerId,
    menuPlacement: normalizeCommandPlacement(definition.menuPlacement, 'menuPlacement') as CommandMenuPlacement[],
    toolbarPlacement: normalizeCommandPlacement(definition.toolbarPlacement, 'toolbarPlacement') as CommandToolbarPlacement[],
    paletteKeywords: asStringArray(definition.paletteKeywords),
    state: normalizeCommandStatePatch(definition.state),
    ownerCallerId: routeContext.caller.id,
    ownerPluginId: routeContext.caller.pluginId,
    ownerSessionId: routeContext.caller.sessionId,
    registeredAt,
    updatedAt: registeredAt
  };
};

const cloneCommandViewPart = <T>(value: T): T => deepClone(value) as T;

const evaluateCommandCondition = (
  condition: boolean | CommandCondition | undefined,
  context: CommandInvocationContext | undefined,
  defaultValue: boolean
): boolean => {
  if (typeof condition === 'undefined') {
    return defaultValue;
  }
  if (typeof condition === 'boolean') {
    return condition;
  }
  const source = context?.data ?? {};
  const actual = source[condition.key];
  if (typeof condition.equals !== 'undefined' && actual !== condition.equals) {
    return false;
  }
  if (typeof condition.notEquals !== 'undefined' && actual === condition.notEquals) {
    return false;
  }
  if (condition.in && !condition.in.some((item) => item === actual)) {
    return false;
  }
  if (typeof condition.truthy === 'boolean' && Boolean(actual) !== condition.truthy) {
    return false;
  }
  return true;
};

const callerHasPermissions = (routeContext: RouteInvocationContext, permissions: string[]): boolean => {
  const granted = routeContext.caller.permissions ?? [];
  return permissions.every((permission) => granted.includes(permission));
};

const buildCommandDiagnostic = (
  command: RegisteredCommand,
  routeContext: RouteInvocationContext,
  queryContext?: CommandInvocationContext
): CommandDiagnostic => {
  const visible = (command.state.visible ?? true) && evaluateCommandCondition(command.visibleWhen, queryContext, true);
  const enabled =
    visible &&
    (command.state.enabled ?? true) &&
    evaluateCommandCondition(command.enabledWhen, queryContext, true) &&
    callerHasPermissions(routeContext, command.permission);
  return {
    visible,
    enabled,
    checked: command.state.checked ?? evaluateCommandCondition(command.checkedWhen, queryContext, false),
    hiddenReasonKey: visible ? undefined : command.state.hiddenReasonKey ?? 'chips.command.hidden',
    disabledReasonKey: enabled
      ? undefined
      : command.state.disabledReasonKey ??
        (!callerHasPermissions(routeContext, command.permission) ? 'chips.command.permissionDenied' : 'chips.command.disabled')
  };
};

const toCommandView = (
  command: RegisteredCommand,
  routeContext: RouteInvocationContext,
  queryContext?: CommandInvocationContext
): CommandView => {
  return {
    commandId: command.commandId,
    titleKey: command.titleKey,
    descriptionKey: command.descriptionKey,
    ariaLabelKey: command.ariaLabelKey,
    icon: command.icon ? { ...command.icon } : undefined,
    shortcut: cloneCommandViewPart(command.shortcut),
    scope: { ...command.scope },
    permission: [...command.permission],
    handlerId: command.handlerId,
    menuPlacement: cloneCommandViewPart(command.menuPlacement),
    toolbarPlacement: cloneCommandViewPart(command.toolbarPlacement),
    paletteKeywords: [...command.paletteKeywords],
    state: { ...command.state },
    ownerPluginId: command.ownerPluginId,
    ownerSessionId: command.ownerSessionId,
    registeredAt: command.registeredAt,
    updatedAt: command.updatedAt,
    diagnostic: buildCommandDiagnostic(command, routeContext, queryContext)
  };
};

const getCommandOwnerKey = (command: RegisteredCommand): string => {
  if (command.ownerPluginId) {
    return `plugin:${command.ownerPluginId}`;
  }
  return `${command.ownerCallerId}`;
};

const getCommandRouteCallerOwnerKey = (routeContext: RouteInvocationContext): string => {
  if (routeContext.caller.pluginId) {
    return `plugin:${routeContext.caller.pluginId}`;
  }
  return `${routeContext.caller.id}`;
};

const ensureCommandOwnership = (
  command: RegisteredCommand,
  routeContext: RouteInvocationContext,
  action: `${string}.${string}`
): void => {
  if (getCommandOwnerKey(command) === getCommandRouteCallerOwnerKey(routeContext)) {
    return;
  }
  ensureCallerPermission(routeContext, 'command.manage', action);
};

const ensurePluginOwnsCommandPermissions = (
  ctx: HostServiceContext,
  command: RegisteredCommand
): void => {
  if (!command.ownerPluginId) {
    return;
  }
  const plugin = ctx.runtime.get(command.ownerPluginId);
  const granted = new Set(plugin.manifest.permissions);
  const missing = command.permission.filter((permission) => !granted.has(permission));
  if (missing.length > 0) {
    throw createError('COMMAND_PERMISSION_UNDECLARED', 'Command permission must be declared by owner plugin manifest', {
      commandId: command.commandId,
      pluginId: command.ownerPluginId,
      missing
    });
  }
};

const commandMatchesScope = (commandScope: CommandScope, requestedScope?: Partial<CommandScope>): boolean => {
  if (!requestedScope) {
    return true;
  }
  if (requestedScope.kind && commandScope.kind !== requestedScope.kind) {
    return false;
  }
  for (const key of ['appId', 'sceneId', 'surfaceId', 'documentId'] as const) {
    if (typeof requestedScope[key] !== 'undefined' && commandScope[key] !== requestedScope[key]) {
      return false;
    }
  }
  return true;
};

const parseCommandQueryOptions = (input: unknown): CommandQueryOptions => {
  if (!isRecord(input)) {
    return {};
  }
  const scope = isRecord(input.scope)
    ? {
        kind: typeof input.scope.kind === 'string' && COMMAND_SCOPE_KINDS.has(input.scope.kind as CommandScopeKind)
          ? input.scope.kind as CommandScopeKind
          : undefined,
        appId: asString(input.scope.appId),
        sceneId: asString(input.scope.sceneId),
        surfaceId: asString(input.scope.surfaceId),
        documentId: asString(input.scope.documentId)
      }
    : undefined;
  return {
    commandId: asString(input.commandId),
    ownerPluginId: asString(input.ownerPluginId),
    scope,
    source: typeof input.source === 'string' && COMMAND_SOURCES.has(input.source as CommandSource)
      ? input.source as CommandSource
      : undefined,
    context: isRecord(input.context) ? cloneCommandViewPart(input.context) as CommandInvocationContext : undefined,
    includeDisabled: input.includeDisabled === true,
    includeHidden: input.includeHidden === true
  };
};

const listCommandViews = (
  state: RuntimeState,
  routeContext: RouteInvocationContext,
  options: CommandQueryOptions = {}
): CommandView[] => {
  const views: CommandView[] = [];
  for (const command of state.commands.values()) {
    if (options.commandId && command.commandId !== options.commandId) {
      continue;
    }
    if (options.ownerPluginId && command.ownerPluginId !== options.ownerPluginId) {
      continue;
    }
    if (!commandMatchesScope(command.scope, options.scope)) {
      continue;
    }
    const view = toCommandView(command, routeContext, options.context);
    if (!options.includeHidden && !view.diagnostic.visible) {
      continue;
    }
    views.push(view);
  }
  return views.sort((left, right) => left.commandId.localeCompare(right.commandId));
};

const unregisterCommandShortcuts = async (
  state: RuntimeState,
  commandId: string
): Promise<void> => {
  state.commandShortcuts.delete(commandId);
};

const registerCommandShortcuts = async (
  ctx: HostServiceContext,
  state: RuntimeState,
  command: RegisteredCommand
): Promise<void> => {
  await unregisterCommandShortcuts(state, command.commandId);
  const registered: CommandShortcut[] = [];
  const platformInfo = await ctx.pal.environment.getInfo();
  for (const shortcut of command.shortcut) {
    if (shortcut.platform && shortcut.platform !== 'all' && shortcut.platform !== platformInfo.hostKind) {
      continue;
    }
    registered.push(cloneCommandViewPart(shortcut));
  }
  if (registered.length > 0) {
    state.commandShortcuts.set(command.commandId, registered);
  }
};

const unregisterCommand = async (
  ctx: HostServiceContext,
  state: RuntimeState,
  commandId: string,
  reason: string
): Promise<RegisteredCommand | undefined> => {
  const command = state.commands.get(commandId);
  if (!command) {
    return undefined;
  }
  await unregisterCommandShortcuts(state, commandId);
  state.commands.delete(commandId);
  await ctx.kernel.events.emit('command.unregistered', 'command-service', {
    commandId,
    ownerPluginId: command.ownerPluginId,
    ownerSessionId: command.ownerSessionId,
    reason
  });
  await ctx.kernel.events.emit('command.changed', 'command-service', {
    commandId,
    change: 'unregistered',
    ownerPluginId: command.ownerPluginId,
    ownerSessionId: command.ownerSessionId
  });
  return command;
};

const unregisterCommandsByOwner = async (
  ctx: HostServiceContext,
  state: RuntimeState,
  owner: { pluginId?: string; sessionId?: string },
  reason: string
): Promise<number> => {
  const targets = [...state.commands.values()].filter((command) => {
    if (owner.sessionId && command.ownerSessionId === owner.sessionId) {
      return true;
    }
    return Boolean(owner.pluginId && command.ownerPluginId === owner.pluginId);
  });
  for (const command of targets) {
    await unregisterCommand(ctx, state, command.commandId, reason);
  }
  return targets.length;
};

const emitCommandRegistryEvent = async (
  ctx: HostServiceContext,
  command: RegisteredCommand,
  change: 'registered' | 'changed',
  routeContext: RouteInvocationContext
): Promise<void> => {
  const commandView = toCommandView(command, routeContext);
  if (change === 'registered') {
    await ctx.kernel.events.emit('command.registered', 'command-service', {
      command: commandView
    });
  }
  await ctx.kernel.events.emit('command.changed', 'command-service', {
    command: commandView,
    change
  });
};

const openPluginSurface = async (
  ctx: HostServiceContext,
  state: RuntimeState,
  pluginId: string,
  options?: {
    kind?: SurfaceKind;
    presentation?: SurfacePresentation;
    launchParams?: Record<string, unknown>;
    url?: string;
    sceneId?: string;
    context?: SurfaceContext;
  }
): Promise<{
  surface: SurfaceState;
  session: { sessionId: string; sessionNonce: string; permissions: string[] };
}> => {
  const plugin = ctx.runtime.get(pluginId);
  if (plugin.manifest.type !== 'app') {
    throw createError('PLUGIN_TYPE_UNSUPPORTED', `Only app plugins can be launched: ${pluginId}`);
  }
  if (!plugin.enabled) {
    throw createError('PLUGIN_DISABLED', `Plugin disabled: ${pluginId}`);
  }

  const platformInfo = await ctx.pal.environment.getInfo();
  const runtimeTargets = plugin.manifest.runtime?.targets;
  const currentHostKind = platformInfo.hostKind;
  const supportedOnCurrentHost =
    runtimeTargets?.[currentHostKind]?.supported ??
    (currentHostKind === 'desktop');
  if (!supportedOnCurrentHost) {
    throw createError('PLUGIN_TARGET_UNSUPPORTED', `Plugin ${pluginId} does not support host kind ${currentHostKind}`, {
      pluginId,
      hostKind: currentHostKind
    });
  }

  const launchParams = {
    ...(options?.launchParams ?? {}),
    workspacePath: ctx.workspacePath
  };
  const session = ctx.runtime.pluginInit(pluginId, launchParams);
  await ctx.kernel.events.emit('plugin.init', 'plugin-service', { pluginId, sessionId: session.sessionId });
  ctx.runtime.completeHandshake(session.sessionId, session.sessionNonce);
  await ctx.kernel.events.emit('plugin.ready', 'plugin-service', { pluginId, sessionId: session.sessionId });

  const surfaceKind = resolvePluginSurfaceKind(plugin, currentHostKind, options?.kind);
  const chrome = resolveThemedWindowChrome(
    state,
    mergeWindowChromeOptions(resolveManifestWindowChrome(plugin.manifest.ui), options?.presentation?.chrome)
  );
  const defaultWidth = Number(state.configUser.get('window.defaultWidth') ?? state.configWorkspace.get('window.defaultWidth') ?? 1280);
  const defaultHeight = Number(state.configUser.get('window.defaultHeight') ?? state.configWorkspace.get('window.defaultHeight') ?? 800);
  const url =
    options?.url ??
    (plugin.installPath && typeof plugin.manifest.entry === 'string'
      ? path.resolve(plugin.installPath, plugin.manifest.entry)
      : undefined);
  const surfaceTitle = options?.presentation?.title ?? plugin.manifest.ui?.launcher?.displayName ?? plugin.manifest.name;
  const surfaceWidth = Number.isFinite(options?.presentation?.width)
    ? options?.presentation?.width
    : Number.isFinite(defaultWidth)
      ? defaultWidth
      : 1280;
  const surfaceHeight = Number.isFinite(options?.presentation?.height)
    ? options?.presentation?.height
    : Number.isFinite(defaultHeight)
      ? defaultHeight
      : 800;
  const presentation: SurfacePresentation = {
    title: surfaceTitle,
    width: surfaceWidth,
    height: surfaceHeight,
    resizable: options?.presentation?.resizable,
    alwaysOnTop: options?.presentation?.alwaysOnTop,
    visible: options?.presentation?.visible,
    chrome
  };
  const surfaceContext: SurfaceContext = {
    sceneId: options?.sceneId ?? options?.context?.sceneId ?? createId(),
    pluginId,
    sessionId: session.sessionId,
    kind: surfaceKind,
    presentation: cloneSurfacePresentation(presentation),
    launchParams: { ...session.launchParams },
    documentContext: options?.context?.documentContext,
    commandContext: options?.context?.commandContext
  };

  try {
    const openedSurface = await ctx.pal.surface.open({
      kind: surfaceKind,
      target: {
        type: 'plugin',
        pluginId,
        url,
        sessionId: session.sessionId,
        permissions: session.permissions,
        launchParams: session.launchParams
      },
      presentation,
      context: surfaceContext
    });
    const surface = withSurfaceContext(openedSurface, surfaceContext);

    await emitSurfaceCreatedEvents(ctx, 'plugin-service', surface);
    await ctx.kernel.events.emit('plugin.launched', 'plugin-service', {
      pluginId,
      sessionId: session.sessionId,
      sceneId: surface.context?.sceneId,
      surfaceId: surface.id,
      surfaceKind: surface.kind,
      windowId: surface.kind === 'window' ? surface.id : undefined
    });

    return {
      surface,
      session: {
        sessionId: session.sessionId,
        sessionNonce: session.sessionNonce,
        permissions: [...session.permissions]
      }
    };
  } catch (error) {
    ctx.runtime.stopSession(session.sessionId);
    throw error;
  }
};

const openPluginWindow = async (
  ctx: HostServiceContext,
  state: RuntimeState,
  pluginId: string,
  launchParams: Record<string, unknown> = {}
): Promise<{
  window: { id: string; chrome?: WindowChromeOptions };
  session: { sessionId: string; sessionNonce: string; permissions: string[] };
}> => {
  const opened = await openPluginSurface(ctx, state, pluginId, {
    kind: 'window',
    launchParams
  });

  return {
    window: {
      id: opened.surface.id,
      chrome: opened.surface.chrome
    },
    session: {
      sessionId: opened.session.sessionId,
      sessionNonce: opened.session.sessionNonce,
      permissions: [...opened.session.permissions]
    }
  };
};

const createCardOpenService = (ctx: HostServiceContext, state: RuntimeState): CardOpenService => {
  return new CardOpenService({
    ensureCardReady: async (cardFile) => {
      const status = await ctx.getCardInfoService().readInfo(cardFile, ['status']);
      if (status.info.status?.state !== 'ready') {
        throw createError('CARD_NOT_FOUND', `Card file is not ready to open: ${cardFile}`, {
          cardFile,
          status: status.info.status
        });
      }
    },
    queryHandlerPlugins: async (capability) => {
      return ctx.runtime.query({ type: 'app', capability }).map((record) => ({
        id: record.manifest.id,
        enabled: record.enabled,
        type: record.manifest.type
      }));
    },
    launchPlugin: async (pluginId, launchParams) => {
      const launched = await openPluginWindow(ctx, state, pluginId, launchParams);
      return {
        windowId: launched.window.id
      };
    },
    openWindow: async (config) => {
      const surface = await ctx.pal.surface.open({
        kind: 'window',
        target: {
          type: 'url',
          url: ''
        },
        presentation: {
          title: config.title,
          width: config.width,
          height: config.height
        }
      });
      return {
        windowId: surface.id
      };
    },
    defaultWindowSize: {
      width: 1200,
      height: 760
    }
  });
};

const openBoxDocument = async (
  ctx: HostServiceContext,
  state: RuntimeState,
  boxFile: string
): Promise<{ mode: 'document-window'; documentType: 'box'; windowId: string; pluginId?: string }> => {
  await ctx.getBoxService().inspect(boxFile);

  const plugin = ctx.runtime
    .query({ type: 'app', capability: 'file-handler:.box' })
    .find((record) => record.enabled && record.manifest.type === 'app');

  if (!plugin) {
    throw createError('FILE_ASSOCIATION_HANDLER_MISSING', 'No enabled viewer is registered for .box files.', {
      boxFile,
      expectedCapability: 'file-handler:.box'
    });
  }

  const launched = await openPluginWindow(ctx, state, plugin.manifest.id, {
    cardSource: {
      kind: 'local-file',
      documentKind: 'box',
      filePath: boxFile
    },
    trigger: 'box-open-service'
  });

  return {
    mode: 'document-window',
    documentType: 'box',
    windowId: launched.window.id,
    pluginId: plugin.manifest.id
  };
};

const createResourceOpenService = (ctx: HostServiceContext, state: RuntimeState): ResourceOpenService => {
  return new ResourceOpenService({
    queryHandlerPlugins: async () => {
      return ctx.runtime.query({ type: 'app' }).map((record) => ({
        id: record.manifest.id,
        enabled: record.enabled,
        type: record.manifest.type,
        capabilities: [...(record.manifest.capabilities ?? [])],
      }));
    },
    launchPlugin: async (pluginId, launchParams) => {
      const launched = await openPluginWindow(ctx, state, pluginId, launchParams);
      return {
        windowId: launched.window.id,
      };
    },
    resolveResourceFilePath: (resourceId) => resolveHostManagedResourceFilePath(ctx, resourceId),
    openPath: async (filePath) => {
      await ctx.pal.transfer.openPath(filePath);
    },
    openExternalUrl: async (url) => {
      await ctx.pal.transfer.openExternal(url);
    },
  });
};

const resolveHostManagedResourceFilePath = (ctx: HostServiceContext, resourceId: string): string | null => {
  const normalized = resourceId.trim();
  if (!normalized) {
    return null;
  }

  return (
    ctx.getCardService().resolveDocumentFilePath(normalized)
    ?? ctx.getBoxService().resolveManagedDocumentFilePath(normalized)
  );
};

const resolveReadableResourceFilePath = (ctx: HostServiceContext, resourceId: string): string | null => {
  const normalized = resourceId.trim();
  if (!normalized) {
    return null;
  }

  const managedPath = resolveHostManagedResourceFilePath(ctx, normalized);
  if (managedPath) {
    return managedPath;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'file:') {
      return fileURLToPath(parsed);
    }

    return null;
  } catch {
    return path.resolve(normalized);
  }
};

const resolveResourceUri = (ctx: HostServiceContext, resourceId: string): string => {
  const normalized = resourceId.trim();
  const readablePath = resolveReadableResourceFilePath(ctx, normalized);
  return readablePath ? pathToFileURL(readablePath).href : normalized;
};

const createResourceImageService = (ctx: HostServiceContext): ResourceImageService => {
  return new ResourceImageService({
    fs: ctx.pal.fs,
    image: ctx.pal.image,
    offscreenRender: ctx.pal.offscreenRender
  });
};

const openAssociatedPathInternal = async (
  ctx: HostServiceContext,
  state: RuntimeState,
  targetPath: string
): Promise<{
  targetPath: string;
  extension: string;
  mode: 'card' | 'box' | 'plugin' | 'shell';
  windowId?: string;
  pluginId?: string;
}> => {
  const resolvedPath = path.resolve(targetPath);
  const stats = await fs.stat(resolvedPath).catch(() => null);
  if (!stats?.isFile()) {
    throw createError('FILE_ASSOCIATION_TARGET_INVALID', `Target file does not exist: ${resolvedPath}`, {
      targetPath: resolvedPath
    });
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  if (!extension) {
    throw createError('FILE_ASSOCIATION_TARGET_INVALID', 'Associated file must carry a file extension', {
      targetPath: resolvedPath
    });
  }

  if (extension === '.card') {
    const opened = await createCardOpenService(ctx, state).openCard(resolvedPath);
    return {
      targetPath: resolvedPath,
      extension,
      mode: 'card',
      windowId: opened.windowId,
      pluginId: opened.pluginId
    };
  }

  const capability = `file-handler:${extension}`;
  const plugin = ctx.runtime
    .query({ type: 'app', capability })
    .find((record) => record.enabled && record.manifest.type === 'app');

  if (plugin) {
    const launchParams: Record<string, unknown> = {
      targetPath: resolvedPath,
      trigger: 'association-open'
    };
    if (extension === '.box') {
      delete launchParams.targetPath;
      launchParams.cardSource = {
        kind: 'local-file',
        documentKind: 'box',
        filePath: resolvedPath
      };
    }
    const launched = await openPluginWindow(ctx, state, plugin.manifest.id, launchParams);
    return {
      targetPath: resolvedPath,
      extension,
      mode: extension === '.box' ? 'box' : 'plugin',
      windowId: launched.window.id,
      pluginId: plugin.manifest.id
    };
  }

  await ctx.pal.transfer.openPath(resolvedPath);
  return {
    targetPath: resolvedPath,
    extension,
    mode: 'shell'
  };
};

const readPluginShortcut = async (
  ctx: HostServiceContext,
  pluginId: string
): Promise<PluginShortcutView> => {
  const plugin = ctx.runtime.get(pluginId);
  if (plugin.manifest.type !== 'app') {
    throw createError('PLUGIN_TYPE_UNSUPPORTED', `Only app plugins can own shortcuts: ${pluginId}`);
  }

  const shortcutName = plugin.manifest.ui?.launcher?.displayName ?? plugin.manifest.name;
  const registry = await readShortcutRegistry(ctx.workspacePath);
  const storedPath = registry[pluginId];
  const target = storedPath
    ? await ctx.pal.launcher.getRecord({
        pluginId,
        name: shortcutName,
        launcherPath: storedPath
      })
    : await ctx.pal.launcher.getRecord({
        pluginId,
        name: shortcutName
      });
  const iconPath = await resolvePluginIconPath(plugin, (await ctx.pal.environment.getInfo()).platform);
  const existing = await fs
    .stat(target.launcherPath)
    .then((stats) => stats.isFile() || stats.isDirectory())
    .catch(() => false);

  return {
    pluginId,
    name: plugin.manifest.ui?.launcher?.displayName ?? plugin.manifest.name,
    location: target.location,
    launcherPath: target.launcherPath,
    executablePath: resolveLaunchExecutable().executablePath,
    args: buildPluginShortcutArgs(ctx.workspacePath, pluginId),
    iconPath,
    exists: existing
  };
};

const createPluginShortcut = async (
  ctx: HostServiceContext,
  pluginId: string,
  replace = false
): Promise<PluginShortcutView> => {
  const plugin = ctx.runtime.get(pluginId);
  if (plugin.manifest.type !== 'app') {
    throw createError('PLUGIN_TYPE_UNSUPPORTED', `Only app plugins can own shortcuts: ${pluginId}`);
  }

  const shortcutName = plugin.manifest.ui?.launcher?.displayName ?? plugin.manifest.name;
  const registry = await readShortcutRegistry(ctx.workspacePath);
  const existingPath = registry[pluginId];
  const current = await readPluginShortcut(ctx, pluginId);
  if (current.exists && existingPath && !replace) {
    return current;
  }

  const launchTarget = resolveLaunchExecutable();
  const iconPath = await resolvePluginIconPath(plugin, (await ctx.pal.environment.getInfo()).platform);
  const created = await ctx.pal.launcher
    .create({
      pluginId,
      name: shortcutName,
      launcherPath: existingPath,
      executablePath: launchTarget.executablePath,
      args: buildPluginShortcutArgs(ctx.workspacePath, pluginId),
      iconPath
    })
    .catch((error: unknown) => {
      throw toPluginShortcutCreateError(pluginId, current, error);
    });

  registry[pluginId] = created.launcherPath;
  await writeShortcutRegistry(ctx.workspacePath, registry);
  await ctx.kernel.events.emit('plugin.shortcut.changed', 'plugin-service', {
    pluginId,
    launcherPath: created.launcherPath,
    exists: true
  });

  return {
    ...created,
    executablePath: launchTarget.executablePath,
    args: buildPluginShortcutArgs(ctx.workspacePath, pluginId),
    iconPath,
    exists: true
  };
};

const removePluginShortcut = async (
  ctx: HostServiceContext,
  pluginId: string
): Promise<{ removed: boolean; launcherPath: string; location: 'desktop' | 'launchpad' }> => {
  const plugin = ctx.runtime.get(pluginId);
  if (plugin.manifest.type !== 'app') {
    throw createError('PLUGIN_TYPE_UNSUPPORTED', `Only app plugins can own shortcuts: ${pluginId}`);
  }

  const shortcutName = plugin.manifest.ui?.launcher?.displayName ?? plugin.manifest.name;
  const registry = await readShortcutRegistry(ctx.workspacePath);
  const removed = await ctx.pal.launcher.remove({
    pluginId,
    name: shortcutName,
    launcherPath: registry[pluginId]
  });
  delete registry[pluginId];
  await writeShortcutRegistry(ctx.workspacePath, registry);
  await ctx.kernel.events.emit('plugin.shortcut.changed', 'plugin-service', {
    pluginId,
    launcherPath: removed.launcherPath,
    exists: false
  });
  return removed;
};

const getModulePlugins = (ctx: HostServiceContext): PluginRecord[] => {
  return ctx.runtime.query({ type: 'module' }).filter((plugin): plugin is PluginRecord => Boolean(plugin.manifest.module));
};

const updateModuleProviderStatus = (
  state: RuntimeState,
  pluginId: string,
  status: 'enabled' | 'disabled' | 'running' | 'error'
): void => {
  const providers = state.moduleProviders.get(pluginId) ?? [];
  state.moduleProviders.set(
    pluginId,
    providers.map((provider) => ({
      ...provider,
      status
    }))
  );
};

const syncModuleProviders = async (ctx: HostServiceContext, state: RuntimeState): Promise<void> => {
  const next = new Map<string, ModuleProviderRecord[]>();

  for (const plugin of getModulePlugins(ctx)) {
    const status = plugin.enabled
      ? state.moduleRuntimes.get(plugin.manifest.id)?.status === 'error'
        ? 'error'
        : state.moduleRuntimes.has(plugin.manifest.id)
          ? 'running'
          : 'enabled'
      : 'disabled';
    next.set(plugin.manifest.id, buildModuleProviderRecords(plugin, status));
  }

  state.moduleProviders = next;
  await ctx.kernel.events.emit('module.provider.changed', 'module-service', {
    pluginIds: [...next.keys()]
  });
};

const flattenModuleProviders = (state: RuntimeState): ModuleProviderRecord[] => {
  return [...state.moduleProviders.values()].flatMap((providers) => providers).sort((left, right) => {
    const capabilityCompare = left.capability.localeCompare(right.capability);
    if (capabilityCompare !== 0) {
      return capabilityCompare;
    }
    if (left.version !== right.version) {
      const versionCompare = compareSemver(right.version, left.version);
      if (versionCompare !== 0) {
        return versionCompare;
      }
      return right.version.localeCompare(left.version);
    }
    return left.pluginId.localeCompare(right.pluginId);
  });
};

const createModuleCallerContext = (
  pluginId: string,
  permissions: string[],
  routeContext?: RouteInvocationContext
): RouteInvocationContext => {
  return {
    requestId: createId(),
    caller: {
      id: routeContext?.caller.id ?? `module:${pluginId}`,
      type: 'plugin',
      pluginId,
      permissions: [...permissions]
    },
    timestamp: Date.now(),
    deadline: routeContext?.deadline
  };
};

const createModuleLogger = (
  ctx: HostServiceContext,
  pluginId: string,
  requestId: string
): ModuleLogger => {
  const write = (level: LogEntry['level'], message: string, metadata?: Record<string, unknown>) => {
    ctx.logger.write({
      level,
      requestId,
      pluginId,
      namespace: 'module-runtime',
      message,
      metadata
    });
  };

  return {
    debug(message, metadata) {
      write('debug', message, metadata);
    },
    info(message, metadata) {
      write('info', message, metadata);
    },
    warn(message, metadata) {
      write('warn', message, metadata);
    },
    error(message, metadata) {
      write('error', message, metadata);
    }
  };
};

const normalizeModuleTimeoutMs = (timeoutMs: number | undefined): number | undefined => {
  return typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined;
};

const createModuleTimeoutError = (
  provider: ModuleProviderRecord,
  method: string,
  timeoutMs: number
) => createError(
  'MODULE_TIMEOUT',
  'Module method timed out',
  {
    pluginId: provider.pluginId,
    capability: provider.capability,
    method,
    timeoutMs
  },
  false
);

const withModuleTimeout = async <T>(
  taskFactory: () => Promise<T>,
  timeoutMs: number | undefined,
  timeoutError: StandardError
): Promise<T> => {
  if (!timeoutMs) {
    return taskFactory();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    timer = setTimeout(() => {
      settled = true;
      reject(timeoutError);
    }, timeoutMs);

    let task: Promise<T>;
    try {
      task = taskFactory();
    } catch (error) {
      if (timer) {
        clearTimeout(timer);
      }
      settled = true;
      reject(error);
      return;
    }

    task
      .then((result) => {
        if (timer) {
          clearTimeout(timer);
        }
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      })
      .catch((error) => {
        if (timer) {
          clearTimeout(timer);
        }
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      });
  });
};

const invokeKernelForModule = async <TInput, TOutput>(
  ctx: HostServiceContext,
  pluginId: string,
  permissions: string[],
  action: string,
  payload: TInput,
  routeContext?: RouteInvocationContext
): Promise<TOutput> => {
  return ctx.kernel.invoke<TInput, TOutput>(action, payload, createModuleCallerContext(pluginId, permissions, routeContext));
};

const resolveModuleInvokeForDeclaredConsume = (
  state: RuntimeState,
  callerPlugin: PluginRecord,
  request: ModuleInvokeRequest
): ModuleInvokeRequest => {
  if (request.pluginId) {
    const provider = resolveProviderSelection(state, {
      capability: request.capability,
      pluginId: request.pluginId
    });
    if (provider.pluginId === callerPlugin.manifest.id) {
      return request;
    }

    const matchingConsumes = (callerPlugin.manifest.module?.consumes ?? []).filter((consume) => {
      return consume.capability === provider.capability;
    });
    const declared = matchingConsumes.some((consume) => {
      return consume.capability === provider.capability && matchesVersionRange(provider.version, consume.versionRange);
    });
    if (declared) {
      return request;
    }

    if (matchingConsumes.length > 0) {
      throw createError(
        'MODULE_PROVIDER_NOT_FOUND',
        'No matching module provider was found for declared module.consumes range',
        {
          callerPluginId: callerPlugin.manifest.id,
          capability: provider.capability,
          pluginId: provider.pluginId,
          version: provider.version,
          consumes: matchingConsumes
        }
      );
    }

    throw createError(
      'MODULE_CONSUME_UNDECLARED',
      'Module capability dependency must be declared in manifest module.consumes',
      {
        callerPluginId: callerPlugin.manifest.id,
        providerPluginId: provider.pluginId,
        capability: provider.capability,
        version: provider.version
      }
    );
  }

  const matchingConsumes = (callerPlugin.manifest.module?.consumes ?? []).filter((consume) => {
    return consume.capability === request.capability;
  });

  const ownProvider = state.moduleProviders.get(callerPlugin.manifest.id)?.find((provider) => {
    return provider.capability === request.capability && (provider.status === 'enabled' || provider.status === 'running');
  });
  if (ownProvider) {
    return {
      ...request,
      pluginId: ownProvider.pluginId
    };
  }

  for (const consume of matchingConsumes) {
    const provider = findProviderSelection(state, {
      capability: request.capability,
      versionRange: consume.versionRange
    });
    if (!provider) {
      continue;
    }
    return {
      ...request,
      pluginId: provider.pluginId
    };
  }

  if (matchingConsumes.length > 0) {
    throw createError(
      'MODULE_PROVIDER_NOT_FOUND',
      'No matching module provider was found for declared module.consumes range',
      {
        callerPluginId: callerPlugin.manifest.id,
        capability: request.capability,
        consumes: matchingConsumes
      }
    );
  }

  const provider = resolveProviderSelection(state, {
    capability: request.capability
  });
  if (provider.pluginId === callerPlugin.manifest.id) {
    return {
      ...request,
      pluginId: provider.pluginId
    };
  }

  throw createError(
    'MODULE_CONSUME_UNDECLARED',
    'Module capability dependency must be declared in manifest module.consumes',
    {
      callerPluginId: callerPlugin.manifest.id,
      providerPluginId: provider.pluginId,
      capability: provider.capability,
      version: provider.version
    }
  );
};

const buildModuleBaseContext = (
  ctx: HostServiceContext,
  state: RuntimeState,
  plugin: PluginRecord,
  requestId: string,
  routeContext: RouteInvocationContext | undefined,
  invokeModule: (
    pluginId: string,
    request: ModuleInvokeRequest,
    routeContext: RouteInvocationContext | undefined
  ) => Promise<{ mode: 'sync'; output: unknown } | { mode: 'job'; jobId: string }>
) => {
  const pluginId = plugin.manifest.id;
  const permissions = plugin.manifest.permissions;

  return {
    logger: createModuleLogger(ctx, pluginId, requestId),
    host: {
      invoke: async <TOutput = unknown>(action: string, payload?: Record<string, unknown>) => {
        if (typeof action !== 'string' || action.trim().length === 0) {
          throw createError('MODULE_HOST_ACTION_INVALID', 'Module host proxy requires a non-empty action');
        }
        if (action.startsWith('module.')) {
          throw createError(
            'MODULE_HOST_ACTION_FORBIDDEN',
            'Module host proxy does not allow module.* actions; use ctx.module.invoke(...) or ctx.module.job.* instead',
            { action }
          );
        }

        return invokeKernelForModule<Record<string, unknown>, TOutput>(
          ctx,
          pluginId,
          permissions,
          action,
          payload ?? {},
          routeContext
        );
      }
    },
    module: {
      invoke: (request: ModuleInvokeRequest) => {
        const resolvedRequest = resolveModuleInvokeForDeclaredConsume(state, plugin, request);
        return invokeModule(pluginId, resolvedRequest, routeContext);
      },
      job: {
        get: (jobId: string) =>
          invokeKernelForModule<{ jobId: string }, unknown>(ctx, pluginId, permissions, 'module.job.get', { jobId }, routeContext).then(
            (result) => (result as { job: unknown }).job
          ),
        cancel: async (jobId: string) => {
          await invokeKernelForModule(ctx, pluginId, permissions, 'module.job.cancel', { jobId }, routeContext);
        }
      }
    },
  };
};

const resolveProviderSelection = (
  state: RuntimeState,
  request: { capability: string; pluginId?: string; versionRange?: string }
): ModuleProviderRecord => {
  const providers = flattenModuleProviders(state).filter((provider) => {
    if (provider.capability !== request.capability) {
      return false;
    }
    if (request.pluginId && provider.pluginId !== request.pluginId) {
      return false;
    }
    if (!matchesVersionRange(provider.version, request.versionRange)) {
      return false;
    }
    return provider.status === 'enabled' || provider.status === 'running';
  });

  if (providers.length === 0) {
    throw createError('MODULE_PROVIDER_NOT_FOUND', 'No matching module provider was found', request);
  }

  return providers[0]!;
};

const findProviderSelection = (
  state: RuntimeState,
  request: { capability: string; pluginId?: string; versionRange?: string }
): ModuleProviderRecord | undefined => {
  try {
    return resolveProviderSelection(state, request);
  } catch (error) {
    if ((error as { code?: string }).code === 'MODULE_PROVIDER_NOT_FOUND') {
      return undefined;
    }
    throw error;
  }
};

const ensureModuleRuntime = async (
  ctx: HostServiceContext,
  state: RuntimeState,
  pluginId: string,
  invokeModule: (
    pluginId: string,
    request: ModuleInvokeRequest,
    routeContext: RouteInvocationContext | undefined
  ) => Promise<{ mode: 'sync'; output: unknown } | { mode: 'job'; jobId: string }>
): Promise<ModuleRuntimeRecord> => {
  const existing = state.moduleRuntimes.get(pluginId);
  if (existing) {
    return existing;
  }

  const plugin = ctx.runtime.get(pluginId);
  if (!plugin.enabled || plugin.manifest.type !== 'module' || !plugin.manifest.module) {
    throw createError('MODULE_DISABLED', `Module plugin is unavailable: ${pluginId}`, { pluginId });
  }

  const session = ctx.runtime.pluginInit(pluginId, {
    workspacePath: ctx.workspacePath,
    runtimeKind: 'module'
  });
  ctx.runtime.completeHandshake(session.sessionId, session.sessionNonce);
  const bridgeScopeToken = ctx.runtime.createBridgeScope(session.sessionId);

  try {
    const entryPath = resolveInstalledModuleEntry(plugin);
    const definition = await loadModuleDefinition(entryPath);
    const runtimeRecord: ModuleRuntimeRecord = {
      pluginId,
      sessionId: session.sessionId,
      bridgeScopeToken,
      definition,
      status: 'running',
      activatedAt: Date.now()
    };
    state.moduleRuntimes.set(pluginId, runtimeRecord);
    updateModuleProviderStatus(state, pluginId, 'running');

    if (definition.activate) {
      await definition.activate(
        buildModuleBaseContext(ctx, state, plugin, session.sessionId, undefined, invokeModule)
      );
    }

    await ctx.kernel.events.emit('module.runtime.started', 'module-service', {
      pluginId,
      sessionId: session.sessionId
    });
    return runtimeRecord;
  } catch (error) {
    ctx.runtime.stopSession(session.sessionId);
    updateModuleProviderStatus(state, pluginId, 'error');
    throw error;
  }
};

const stopModuleRuntime = async (
  ctx: HostServiceContext,
  state: RuntimeState,
  pluginId: string,
  invokeModule: (
    pluginId: string,
    request: ModuleInvokeRequest,
    routeContext: RouteInvocationContext | undefined
  ) => Promise<{ mode: 'sync'; output: unknown } | { mode: 'job'; jobId: string }>
): Promise<void> => {
  const runtimeRecord = state.moduleRuntimes.get(pluginId);
  if (!runtimeRecord) {
    return;
  }

  const plugin = ctx.runtime.get(pluginId);
  if (runtimeRecord.definition.deactivate) {
    await runtimeRecord.definition.deactivate(
      buildModuleBaseContext(ctx, state, plugin, runtimeRecord.sessionId, undefined, invokeModule)
    );
  }

  ctx.runtime.stopSession(runtimeRecord.sessionId);
  state.moduleRuntimes.delete(pluginId);
  updateModuleProviderStatus(state, pluginId, plugin.enabled ? 'enabled' : 'disabled');
};

const buildCardTypeCandidates = (cardType: string): string[] => {
  const trimmed = cardType.trim();
  const compact = trimmed.replace(/\s+/g, '');
  const stripped = compact.replace(/Card$/i, '');
  const normalized = stripped.replace(/[^A-Za-z0-9]+/g, '');
  const lower = normalized.toLowerCase();

  const candidates = new Set<string>();
  if (trimmed) {
    candidates.add(trimmed);
    candidates.add(trimmed.toLowerCase());
  }
  if (compact) {
    candidates.add(compact);
    candidates.add(compact.toLowerCase());
  }
  if (stripped) {
    candidates.add(stripped);
    candidates.add(stripped.toLowerCase());
  }
  if (lower) {
    candidates.add(`base.${lower}`);
  }

  return [...candidates];
};

const resolveThemeChain = (state: RuntimeState, inputIds: string[]): ThemeRecord[] => {
  const chain = inputIds.length > 0 ? inputIds : [state.currentThemeId];
  if (chain.length > 6) {
    throw createError('THEME_CHAIN_TOO_DEEP', 'Theme resolve chain exceeds 6 levels');
  }
  const records: ThemeRecord[] = [];
  const appended = new Set<string>();
  const visiting = new Set<string>();

  const visit = (themeId: string): void => {
    const record = findThemeRecord(state, themeId);
    if (!record) {
      throw createError('THEME_NOT_FOUND', `Theme not found in resolve chain: ${themeId}`, { themeId });
    }
    if (visiting.has(themeId)) {
      throw createError('THEME_DEPENDENCY_ERROR', `Theme parent chain contains a cycle: ${themeId}`, { themeId });
    }
    if (appended.has(themeId)) {
      return;
    }

    visiting.add(themeId);
    if (record.parentTheme) {
      visit(record.parentTheme);
    }
    visiting.delete(themeId);

    appended.add(themeId);
    records.push(record);
  };

  chain.forEach(visit);

  if (records.length > 6) {
    throw createError('THEME_CHAIN_TOO_DEEP', 'Theme resolve chain exceeds 6 levels');
  }

  return records;
};

const resolveThemeContext = (state: RuntimeState, inputIds: string[]) => {
  const records = resolveThemeChain(state, inputIds);
  const mergedLayers = mergeThemeLayers(records.map((theme) => ({ id: theme.id, tokens: theme.tokens })));
  const resolvedTheme = resolveThemeFromLayers(mergedLayers);
  const activeTheme = records[records.length - 1];
  if (!activeTheme) {
    throw createError('THEME_NOT_FOUND', 'No active theme found');
  }

  return {
    records,
    activeTheme,
    resolvedTheme,
    renderTheme: toRenderThemeSnapshot(activeTheme.id, resolvedTheme),
    css: records
      .map((theme) => theme.css.trim())
      .filter((cssText) => cssText.length > 0)
      .join('\n\n')
  };
};

/**
 * 渲染链路的主题解析降级入口。
 *
 * 主题系统已随 task030 卸担计划废弃（ThemePack 归档，插件不再消费 themeCssText / renderTheme）。
 * 卡片/布局渲染不应因默认主题缺失而失败：主题解析失败时返回空主题上下文，
 * 由插件侧按自身固定视觉渲染。显式主题管理服务（theme.* 路由）仍保持严格校验。
 */
const resolveRenderThemeContext = (state: RuntimeState, inputIds: string[]) => {
  try {
    return resolveThemeContext(state, inputIds);
  } catch (error) {
    if (error && typeof error === 'object' && (error as { code?: string }).code === 'THEME_NOT_FOUND') {
      const resolvedTheme = resolveThemeFromLayers(mergeThemeLayers([]));
      return {
        records: [],
        activeTheme: {
          id: state.currentThemeId,
          displayName: state.currentThemeId,
          version: '0.0.0',
          isDefault: false,
          css: '',
          tokens: {}
        },
        resolvedTheme,
        renderTheme: toRenderThemeSnapshot(state.currentThemeId, resolvedTheme),
        css: ''
      };
    }
    throw error;
  }
};

const buildThemeContractViewForContext = (
  context: ReturnType<typeof resolveThemeContext>,
  component?: string
): ThemeContractView => {
  return buildThemeContractsView(
    {
      themeId: context.activeTheme.id,
      themeVersion: context.activeTheme.version,
      sourceThemeId: context.activeTheme.id
    },
    context.activeTheme.contract,
    context.resolvedTheme.variables,
    component
  );
};

const buildThemeResolveResult = (context: ReturnType<typeof resolveThemeContext>): ThemeResolveResult => {
  const contractView = buildThemeContractViewForContext(context);
  const diagnostics = [...context.resolvedTheme.diagnostics, ...contractView.components.flatMap((component) => component.diagnostics)];
  const summary = buildThemeDiagnosticSummary(diagnostics, contractView.summary.coverage);

  return {
    resolved: context.records.map((theme, index) => ({
      id: theme.id,
      displayName: theme.displayName,
      version: theme.version,
      order: index
    })),
    tokens: context.resolvedTheme.variables,
    diagnostics,
    summary
  };
};

const buildThemeChangedPayload = (
  context: ReturnType<typeof resolveThemeContext>,
  previousThemeId: string
): ThemeChangedEvent => {
  const resolveResult = buildThemeResolveResult(context);

  return {
    previousThemeId,
    themeId: context.activeTheme.id,
    themeVersion: context.activeTheme.version,
    timestamp: Date.now(),
    diagnosticsSummary: resolveResult.summary
  };
};

const syncCurrentThemeState = (state: RuntimeState): void => {
  const configuredThemeId = asString(resolveConfigValue(state, 'ui.theme'));
  const defaultTheme = state.themes.find((theme) => theme.isDefault);
  const fallbackTheme = defaultTheme ?? state.themes[0];

  if (configuredThemeId && findThemeRecord(state, configuredThemeId)) {
    state.currentThemeId = configuredThemeId;
    return;
  }

  if (fallbackTheme) {
    state.currentThemeId = fallbackTheme.id;
  }
};

const resolveThemedWindowChrome = (
  state: RuntimeState,
  chrome: WindowChromeOptions | undefined
): WindowChromeOptions | undefined => {
  const nextChrome = chrome ? deepClone(chrome) : undefined;
  if (nextChrome?.transparent === true || typeof nextChrome?.backgroundColor === 'string') {
    return nextChrome;
  }

  try {
    const backgroundColor = resolveThemeBackgroundColor(state);

    if (!backgroundColor) {
      return nextChrome;
    }

    return {
      ...(nextChrome ?? {}),
      backgroundColor
    };
  } catch {
    return nextChrome;
  }
};

const renderHtmlToPdfFile = async (
  state: RuntimeState,
  input: {
    htmlDir: string;
    entryFile?: string;
    outputFile: string;
    options?: {
      pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
      landscape?: boolean;
      printBackground?: boolean;
      marginMm?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
      };
    };
  }
): Promise<{ outputFile: string; pageCount?: number }> => {
  const electron = loadElectronModule();
  if (!electron?.BrowserWindow) {
    throw createError('PLATFORM_UNSUPPORTED', 'HTML to PDF export requires Electron BrowserWindow support');
  }

  const resolved = await resolveHtmlExportPaths(input);
  const browserWindow = new electron.BrowserWindow({
    show: false,
    width: 1280,
    height: 960,
    backgroundColor: '#ffffff',
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  });

  try {
    await Promise.resolve(browserWindow.loadURL(pathToFileURL(resolved.entryPath).href));
    await waitForExportDocumentReady(browserWindow);

    if (typeof browserWindow.webContents.printToPDF !== 'function') {
      throw createError('PLATFORM_UNSUPPORTED', 'Current Electron runtime does not expose printToPDF');
    }

    const marginMm = input.options?.marginMm;
    const pdfBuffer = await browserWindow.webContents.printToPDF({
      pageSize: input.options?.pageSize ?? 'A4',
      landscape: input.options?.landscape === true,
      printBackground: input.options?.printBackground !== false,
      margins: marginMm
        ? {
            top: (marginMm.top ?? 0) / 25.4,
            right: (marginMm.right ?? 0) / 25.4,
            bottom: (marginMm.bottom ?? 0) / 25.4,
            left: (marginMm.left ?? 0) / 25.4
          }
        : undefined
    });

    await fs.writeFile(resolved.outputFile, pdfBuffer);
    return {
      outputFile: resolved.outputFile,
      pageCount: countPdfPages(pdfBuffer)
    };
  } finally {
    if (!browserWindow.isDestroyed()) {
      browserWindow.close();
    }
  }
};

const renderHtmlToImageFile = async (
  state: RuntimeState,
  input: {
    htmlDir: string;
    entryFile?: string;
    outputFile: string;
    options?: {
      format?: 'png' | 'jpeg' | 'webp';
      width?: number;
      height?: number;
      scaleFactor?: number;
      background?: 'transparent' | 'white' | 'theme';
    };
  }
): Promise<{ outputFile: string; width?: number; height?: number; format: 'png' | 'jpeg' | 'webp' }> => {
  const electron = loadElectronModule();
  if (!electron?.BrowserWindow) {
    throw createError('PLATFORM_UNSUPPORTED', 'HTML to image export requires Electron BrowserWindow support');
  }

  const resolved = await resolveHtmlExportPaths(input);
  const format = input.options?.format ?? 'png';
  const background = input.options?.background ?? (format === 'jpeg' ? 'white' : 'transparent');
  const backgroundColor =
    background === 'theme' ? resolveThemeBackgroundColor(state) : background === 'white' ? '#ffffff' : '#00000000';
  const browserWindow = new electron.BrowserWindow({
    show: false,
    width: 1280,
    height: 960,
    transparent: background === 'transparent' && format !== 'jpeg',
    backgroundColor,
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  });

  try {
    await Promise.resolve(browserWindow.loadURL(pathToFileURL(resolved.entryPath).href));
    await waitForExportDocumentReady(browserWindow);

    if (typeof browserWindow.webContents.capturePage !== 'function') {
      throw createError('PLATFORM_UNSUPPORTED', 'Current Electron runtime does not expose capturePage');
    }

    const initialBounds = await measureExportDocumentBounds(browserWindow);
    let viewport = resolveExportViewport(
      initialBounds,
      asPositiveFiniteNumber(input.options?.width),
      asPositiveFiniteNumber(input.options?.height),
      asPositiveFiniteNumber(input.options?.scaleFactor) ?? 1
    );
    browserWindow.setSize(viewport.width, viewport.height);

    await waitForExportDocumentReady(browserWindow);

    const settledBounds = await measureExportDocumentBounds(browserWindow);
    const settledViewport = resolveExportViewport(
      {
        width: Math.max(initialBounds.width ?? 0, settledBounds.width ?? 0) || undefined,
        height: Math.max(initialBounds.height ?? 0, settledBounds.height ?? 0) || undefined,
      },
      asPositiveFiniteNumber(input.options?.width),
      asPositiveFiniteNumber(input.options?.height),
      asPositiveFiniteNumber(input.options?.scaleFactor) ?? 1
    );

    if (settledViewport.width !== viewport.width || settledViewport.height !== viewport.height) {
      viewport = settledViewport;
      browserWindow.setSize(viewport.width, viewport.height);
      await waitForExportDocumentReady(browserWindow);
    }

    const image = await browserWindow.webContents.capturePage({
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height
    });

    let imageBuffer: Buffer;
    if (format === 'png') {
      imageBuffer = image.toPNG();
    } else if (format === 'jpeg') {
      if (typeof image.toJPEG !== 'function') {
        throw createError('PLATFORM_UNSUPPORTED', 'Current Electron runtime does not expose JPEG image export');
      }
      imageBuffer = image.toJPEG(92);
    } else {
      throw createError('PLATFORM_UNSUPPORTED', 'Current Electron runtime does not expose WEBP image export');
    }

    await fs.writeFile(resolved.outputFile, imageBuffer);
    const imageSize = typeof image.getSize === 'function' ? image.getSize() : undefined;
    return {
      outputFile: resolved.outputFile,
      width: imageSize?.width ?? viewport.width,
      height: imageSize?.height ?? viewport.height,
      format
    };
  } finally {
    if (!browserWindow.isDestroyed()) {
      browserWindow.close();
    }
  }
};

const syncInstalledThemes = async (ctx: HostServiceContext, state: RuntimeState): Promise<void> => {
  const previousThemeId = state.currentThemeId;
  state.themes = await loadInstalledThemes(ctx.runtime);
  syncCurrentThemeState(state);

  if (state.currentThemeId !== previousThemeId && state.themes.length > 0) {
    const context = resolveThemeContext(state, []);
    await ctx.kernel.events.emit('theme.changed', 'theme-service', buildThemeChangedPayload(context, previousThemeId));
  }
};

const credentialCipherKey = (workspacePath: string): Buffer => {
  const secret = process.env.CHIPS_CREDENTIAL_KEY ?? `${workspacePath}:chips-host-credential`;
  return crypto.createHash('sha256').update(secret).digest();
};

const encryptCredential = (
  key: Buffer,
  plainText: string
): { iv: string; tag: string; value: string } => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    value: encrypted.toString('base64')
  };
};

const decryptCredential = (
  key: Buffer,
  payload: { iv: string; tag: string; value: string }
): string => {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.value, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf-8');
};

const loadCredentials = async (workspacePath: string, state: RuntimeState): Promise<void> => {
  const storePath = path.join(workspacePath, CREDENTIAL_STORE_FILE);
  try {
    const raw = await fs.readFile(storePath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, { iv: string; tag: string; value: string }>;
    for (const [ref, encrypted] of Object.entries(parsed)) {
      if (
        encrypted &&
        typeof encrypted.iv === 'string' &&
        typeof encrypted.tag === 'string' &&
        typeof encrypted.value === 'string'
      ) {
        state.credentials.set(ref, encrypted);
      }
    }
  } catch {
    await fs.writeFile(storePath, JSON.stringify({}, null, 2), 'utf-8');
  }
};

const persistCredentials = async (workspacePath: string, encryptedStore: Map<string, { iv: string; tag: string; value: string }>): Promise<void> => {
  const payload = Object.fromEntries(encryptedStore.entries());
  await fs.writeFile(path.join(workspacePath, CREDENTIAL_STORE_FILE), JSON.stringify(payload, null, 2), 'utf-8');
};

const toPlainLogEntries = (entries: LogEntry[]): LogEntry[] => entries.map((entry) => deepClone(entry));

const ensureServiceActivation = async (ctx: HostServiceContext, state: RuntimeState, serviceName: string): Promise<void> => {
  if (state.activatedServices.has(serviceName)) {
    return;
  }

  if (serviceName === 'card') {
    ctx.getCardService();
  } else if (serviceName === 'box') {
    ctx.getBoxService();
  } else if (serviceName === 'zip') {
    ctx.getZipService();
  }

  state.activatedServices.add(serviceName);
  await ctx.kernel.events.emit('service.activated', 'host-service', { service: serviceName });
};

const bindLazyActivation = (ctx: HostServiceContext, state: RuntimeState, service: ServiceRegistration): ServiceRegistration => {
  const wrappedActions: ServiceRegistration['actions'] = {};
  for (const [actionName, actionDefinition] of Object.entries(service.actions)) {
    const descriptor = actionDefinition.descriptor;
    const originalHandler = descriptor.handler;
    wrappedActions[actionName] = {
      descriptor: {
        ...descriptor,
        handler: async (input, routeContext) => {
          await ensureServiceActivation(ctx, state, service.name);
          return originalHandler(input, routeContext);
        }
      }
    };
  }

  return {
    ...service,
    actions: wrappedActions
  };
};

const createServices = (ctx: HostServiceContext, state: RuntimeState): ServiceRegistration[] => {
  const credentialKey = credentialCipherKey(ctx.workspacePath);

  const invokeModuleInternal = async (
    callerPluginId: string,
    request: ModuleInvokeRequest,
    routeContext?: RouteInvocationContext
  ): Promise<{ mode: 'sync'; output: unknown } | { mode: 'job'; jobId: string }> => {
    const provider = resolveProviderSelection(state, {
      capability: request.capability,
      pluginId: request.pluginId
    });
    const plugin = ctx.runtime.get(provider.pluginId);
    const moduleMeta = plugin.manifest.module;
    if (!moduleMeta) {
      throw createError('MODULE_PROVIDER_NOT_FOUND', 'Module metadata is missing for provider', {
        pluginId: provider.pluginId,
        capability: provider.capability
      });
    }

    const manifestProvider = findManifestProvider(moduleMeta, provider.capability);
    if (!manifestProvider) {
      throw createError('MODULE_PROVIDER_NOT_FOUND', 'Manifest provider metadata is missing', {
        pluginId: provider.pluginId,
        capability: provider.capability
      });
    }
    const manifestMethod = findManifestMethod(manifestProvider, request.method);
    if (!manifestMethod) {
      throw createError('MODULE_METHOD_NOT_FOUND', 'Module method not found', {
        pluginId: provider.pluginId,
        capability: provider.capability,
        method: request.method
      });
    }

    const runtimeRecord = await ensureModuleRuntime(ctx, state, provider.pluginId, invokeModuleInternal);
    const implementationProvider = runtimeRecord.definition.providers.find(
      (candidate) => candidate.capability === provider.capability
    );
    const implementationMethod = implementationProvider?.methods[request.method];
    if (!implementationProvider || typeof implementationMethod !== 'function') {
      throw createError('MODULE_METHOD_NOT_FOUND', 'Runtime method implementation is missing', {
        pluginId: provider.pluginId,
        capability: provider.capability,
        method: request.method
      });
    }

    const inputSchemaPath = path.resolve(plugin.installPath, manifestMethod.inputSchema ?? '');
    const outputSchemaPath = path.resolve(plugin.installPath, manifestMethod.outputSchema ?? '');
    const invocationRequestId = routeContext?.requestId ?? createId();

    const baseContext = buildModuleBaseContext(
      ctx,
      state,
      plugin,
      invocationRequestId,
      routeContext,
      invokeModuleInternal
    );

    await ctx.logger.write({
      level: 'info',
      requestId: invocationRequestId,
      pluginId: provider.pluginId,
      action: 'module.invoke',
      message: 'Invoke module method',
      metadata: {
        callerPluginId,
        capability: provider.capability,
        method: request.method
      }
    });

    await validateContractSchema(inputSchemaPath, request.input, 'MODULE_SCHEMA_INVALID');
    const timeoutMs = normalizeModuleTimeoutMs(request.timeoutMs);
    const timeoutError = timeoutMs ? createModuleTimeoutError(provider, request.method, timeoutMs) : undefined;

    if (manifestMethod.mode === 'sync') {
      const output = await withModuleTimeout(
        () => Promise.resolve(implementationMethod(baseContext, request.input)),
        timeoutMs,
        timeoutError ?? createError('MODULE_TIMEOUT', 'Module method timed out')
      );
      await withModuleTimeout(
        () => validateContractSchema(outputSchemaPath, output, 'MODULE_SCHEMA_INVALID'),
        timeoutMs,
        timeoutError ?? createError('MODULE_TIMEOUT', 'Module method timed out')
      );
      return { mode: 'sync', output };
    }

    const jobId = createId();
    const controller = new AbortController();
    const jobRecord: ModuleJobRecord = {
      jobId,
      pluginId: provider.pluginId,
      capability: provider.capability,
      method: request.method,
      status: 'running',
      caller: routeContext?.caller ?? {
        id: `module:${callerPluginId}`,
        type: 'plugin',
        pluginId: callerPluginId,
        permissions: [...plugin.manifest.permissions]
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    state.moduleJobs.set(jobId, jobRecord);
    state.moduleJobControllers.set(jobId, controller);

    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs && timeoutError) {
      timeoutTimer = setTimeout(() => {
        const current = state.moduleJobs.get(jobId);
        if (!current || current.status !== 'running') {
          return;
        }
        controller.abort();
        state.moduleJobControllers.delete(jobId);
        current.status = 'failed';
        current.updatedAt = Date.now();
        current.error = timeoutError;
        void ctx.kernel.events
          .emit('module.job.failed', 'module-service', {
            jobId,
            pluginId: current.pluginId,
            capability: current.capability,
            method: current.method,
            error: current.error
          })
          .catch(() => undefined);
      }, timeoutMs);
      timeoutTimer.unref?.();
    }

    const jobContext = {
      ...baseContext,
      job: {
        id: jobId,
        signal: controller.signal,
        reportProgress: async (payload: Record<string, unknown>) => {
          const current = state.moduleJobs.get(jobId);
          if (!current) {
            return;
          }
          if (current.status !== 'running') {
            return;
          }
          current.progress = deepClone(payload);
          current.updatedAt = Date.now();
          await ctx.kernel.events.emit('module.job.progress', 'module-service', {
            jobId,
            pluginId: current.pluginId,
            capability: current.capability,
            method: current.method,
            progress: current.progress
          });
        },
        isCancelled: () => controller.signal.aborted
      }
    };

    void (async () => {
      try {
        const output = await implementationMethod(jobContext, request.input);
        const current = state.moduleJobs.get(jobId);
        if (!current || current.status !== 'running') {
          return;
        }
        await validateContractSchema(outputSchemaPath, output, 'MODULE_SCHEMA_INVALID');
        if (current.status !== 'running') {
          return;
        }
        current.status = controller.signal.aborted ? 'cancelled' : 'completed';
        current.updatedAt = Date.now();
        if (!controller.signal.aborted) {
          current.output = deepClone(output);
          await ctx.kernel.events.emit('module.job.completed', 'module-service', {
            jobId,
            pluginId: current.pluginId,
            capability: current.capability,
            method: current.method,
            output: current.output
          });
        } else {
          current.error = {
            code: 'MODULE_JOB_CANCELLED',
            message: 'Module job was cancelled'
          };
          await emitModuleJobCancelled(ctx, current, 'abort');
        }
      } catch (error) {
        const current = state.moduleJobs.get(jobId);
        if (!current || current.status !== 'running') {
          return;
        }
        current.status = controller.signal.aborted ? 'cancelled' : 'failed';
        current.updatedAt = Date.now();
        current.error = createError(
          (error as { code?: string }).code ?? 'MODULE_INVOCATION_FAILED',
          (error as { message?: string }).message ?? 'Module job failed',
          error
        );
        if (current.status === 'cancelled') {
          await emitModuleJobCancelled(ctx, current, 'abort');
        } else {
          await ctx.kernel.events.emit('module.job.failed', 'module-service', {
            jobId,
            pluginId: current.pluginId,
            capability: current.capability,
            method: current.method,
            error: current.error
          });
        }
      } finally {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }
        state.moduleJobControllers.delete(jobId);
      }
    })();

    return { mode: 'job', jobId };
  };

  const fileService: ServiceRegistration = {
    name: 'file',
    actions: {
      read: {
        descriptor: descriptor<{ path: string; options?: { encoding?: BufferEncoding } }, { content: string | Buffer }>(
          'file.read',
          ['file.read'],
          5_000,
          true,
          0,
          withMetrics(state, 'file.read', async (input) => {
            const content = await ctx.pal.fs.readFile(input.path, input.options);
            return { content };
          })
        )
      },
      write: {
        descriptor: descriptor<{ path: string; content: FileWriteContent }, { ack: true }>(
          'file.write',
          ['file.write'],
          5_000,
          false,
          0,
          withMetrics(state, 'file.write', async (input) => {
            await ctx.pal.fs.writeFile(input.path, normalizeFileWriteContent(input.content));
            return { ack: true };
          })
        )
      },
      stat: {
        descriptor: descriptor<{ path: string }, { meta: unknown }>(
          'file.stat',
          ['file.read'],
          5_000,
          true,
          0,
          withMetrics(state, 'file.stat', async (input) => {
            const meta = await ctx.pal.fs.stat(input.path);
            return { meta };
          })
        )
      },
      list: {
        descriptor: descriptor<{ dir: string; options?: { recursive?: boolean } }, { entries: FileListEntryView[] }>(
          'file.list',
          ['file.read'],
          5_000,
          true,
          0,
          withMetrics(state, 'file.list', async (input) => {
            const listed = await ctx.pal.fs.list(input.dir, input.options);
            const entries = await toFileListEntries(ctx.pal, input.dir, listed);
            return { entries };
          })
        )
      },
      watch: {
        descriptor: descriptor<{ path: string; timeoutMs?: number }, { event: unknown | null }>(
          'file.watch',
          ['file.read'],
          30_000,
          true,
          0,
          withMetrics(state, 'file.watch', async (input) => {
            const timeoutMs = typeof input.timeoutMs === 'number' && input.timeoutMs > 0 ? input.timeoutMs : 5_000;
            const event = await new Promise<unknown | null>(async (resolve, reject) => {
              let closed = false;
              let subscription: Awaited<ReturnType<typeof ctx.pal.fs.watch>> | undefined;
              const closeWatch = async () => {
                if (closed) {
                  return;
                }
                closed = true;
                await subscription?.close();
              };

              const timer = setTimeout(async () => {
                await closeWatch();
                resolve(null);
              }, timeoutMs);

              try {
                subscription = await ctx.pal.fs.watch(input.path, async (watchEvent) => {
                  clearTimeout(timer);
                  await closeWatch();
                  resolve(watchEvent);
                });
              } catch (error) {
                clearTimeout(timer);
                await closeWatch();
                reject(error);
              }
            });

            return { event };
          })
        )
      },
      mkdir: {
        descriptor: descriptor<{ path: string; options?: { recursive?: boolean } }, { ack: true }>(
          'file.mkdir',
          ['file.write'],
          5_000,
          false,
          0,
          withMetrics(state, 'file.mkdir', async (input) => {
            await ctx.pal.fs.mkdir(input.path, input.options);
            return { ack: true };
          })
        )
      },
      delete: {
        descriptor: descriptor<{ path: string; options?: { recursive?: boolean } }, { ack: true }>(
          'file.delete',
          ['file.write'],
          5_000,
          false,
          0,
          withMetrics(state, 'file.delete', async (input) => {
            await ctx.pal.fs.delete(input.path, input.options);
            return { ack: true };
          })
        )
      },
      move: {
        descriptor: descriptor<{ sourcePath: string; destPath: string }, { ack: true }>(
          'file.move',
          ['file.write'],
          5_000,
          false,
          0,
          withMetrics(state, 'file.move', async (input) => {
            await ctx.pal.fs.move(input.sourcePath, input.destPath);
            return { ack: true };
          })
        )
      },
      copy: {
        descriptor: descriptor<{ sourcePath: string; destPath: string }, { ack: true }>(
          'file.copy',
          ['file.write'],
          5_000,
          false,
          0,
          withMetrics(state, 'file.copy', async (input) => {
            await ctx.pal.fs.copy(input.sourcePath, input.destPath);
            return { ack: true };
          })
        )
      }
    }
  };

  const resourceService: ServiceRegistration = {
    name: 'resource',
    actions: {
      resolve: {
        descriptor: descriptor<{ resourceId: string }, { uri: string }>(
          'resource.resolve',
          ['resource.read'],
          5_000,
          true,
          0,
          withMetrics(state, 'resource.resolve', async (input) => {
            const uri = resolveResourceUri(ctx, input.resourceId);
            return { uri };
          })
        )
      },
      open: {
        descriptor: descriptor<
          {
            intent?: string;
            resource: {
              resourceId: string;
              mimeType?: string;
              title?: string;
              fileName?: string;
            };
          },
          { result: unknown }
        >(
          'resource.open',
          ['resource.read'],
          10_000,
          false,
          0,
          withMetrics(state, 'resource.open', async (input) => {
            const result = await createResourceOpenService(ctx, state).openResource(input);
            return { result };
          })
        )
      },
      readMetadata: {
        descriptor: descriptor<{ resourceId: string }, { metadata: unknown }>(
          'resource.readMetadata',
          ['resource.read'],
          5_000,
          true,
          0,
          withMetrics(state, 'resource.readMetadata', async (input) => {
            const normalized = resolveReadableResourceFilePath(ctx, input.resourceId) ?? input.resourceId.replace(/^file:\/\//, '');
            const meta = await ctx.pal.fs.stat(normalized);
            return { metadata: meta };
          })
        )
      },
      readBinary: {
        descriptor: descriptor<{ resourceId: string }, { data: Buffer }>(
          'resource.readBinary',
          ['resource.read'],
          5_000,
          true,
          0,
          withMetrics(state, 'resource.readBinary', async (input) => {
            const normalized = resolveReadableResourceFilePath(ctx, input.resourceId) ?? input.resourceId.replace(/^file:\/\//, '');
            const data = await ctx.pal.fs.readFile(normalized);
            if (!Buffer.isBuffer(data)) {
              return { data: Buffer.from(data, 'utf-8') };
            }
            return { data };
          })
        )
      },
      convertTiffToPng: {
        descriptor: descriptor<
          {
            resourceId: string;
            outputFile: string;
            overwrite?: boolean;
          },
          {
            outputFile: string;
            mimeType: 'image/png';
            sourceMimeType: 'image/tiff';
            width?: number;
            height?: number;
          }
        >(
          'resource.convertTiffToPng',
          ['resource.read', 'file.read', 'file.write'],
          15_000,
          false,
          0,
          withMetrics(state, 'resource.convertTiffToPng', async (input) => {
            return createResourceImageService(ctx).convertTiffToPng(input);
          })
        )
      },
      extractVideoFrame: {
        descriptor: descriptor<
          {
            resourceId: string;
            outputFile: string;
            overwrite?: boolean;
            options?: {
              timeSeconds?: number;
              format?: 'png' | 'jpeg';
              width?: number;
              height?: number;
              fit?: 'contain' | 'cover';
              quality?: number;
            };
          },
          {
            outputFile: string;
            mimeType: 'image/png' | 'image/jpeg';
            sourceMimeType: string;
            width: number;
            height: number;
            format: 'png' | 'jpeg';
            frameTimeSeconds: number;
            durationSeconds?: number;
          }
        >(
          'resource.extractVideoFrame',
          ['resource.read', 'file.read', 'file.write'],
          30_000,
          false,
          0,
          withMetrics(state, 'resource.extractVideoFrame', async (input) => {
            return createResourceImageService(ctx).extractVideoFrame(input);
          })
        )
      }
    }
  };

  const configService: ServiceRegistration = {
    name: 'config',
    actions: {
      get: {
        descriptor: descriptor<{ key: string }, { value: unknown }>(
          'config.get',
          ['config.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'config.get', async (input) => {
            return { value: resolveConfigValue(state, input.key) };
          })
        )
      },
      set: {
        descriptor: descriptor<{ key: string; value: unknown; scope?: ConfigScope }, { ack: true }>(
          'config.set',
          ['config.write'],
          2_000,
          false,
          0,
          withMetrics(state, 'config.set', async (input) => {
            const scope = parseConfigScope(input.scope);
            const target = getConfigMapByScope(state, scope);
            target.set(input.key, input.value);
            await persistConfigScope(ctx.workspacePath, scope, target);
            if (input.key === 'ui.theme') {
              syncCurrentThemeState(state);
            }
            return { ack: true };
          })
        )
      },
      batchSet: {
        descriptor: descriptor<{ entries: Record<string, unknown>; scope?: ConfigScope }, { ack: true }>(
          'config.batchSet',
          ['config.write'],
          5_000,
          false,
          0,
          withMetrics(state, 'config.batchSet', async (input) => {
            const scope = parseConfigScope(input.scope);
            const target = getConfigMapByScope(state, scope);
            for (const [key, value] of Object.entries(input.entries)) {
              target.set(key, value);
            }
            await persistConfigScope(ctx.workspacePath, scope, target);
            if (Object.prototype.hasOwnProperty.call(input.entries, 'ui.theme')) {
              syncCurrentThemeState(state);
            }
            return { ack: true };
          })
        )
      },
      reset: {
        descriptor: descriptor<{ key?: string; scope?: ConfigScope }, { ack: true }>(
          'config.reset',
          ['config.write'],
          2_000,
          false,
          0,
          withMetrics(state, 'config.reset', async (input) => {
            const scope = parseConfigScope(input.scope);
            const target = getConfigMapByScope(state, scope);
            if (input.key) {
              target.delete(input.key);
            } else {
              target.clear();
            }
            await persistConfigScope(ctx.workspacePath, scope, target);
            if (!input.key || input.key === 'ui.theme') {
              syncCurrentThemeState(state);
            }
            return { ack: true };
          })
        )
      }
    }
  };

  const themeService: ServiceRegistration = {
    name: 'theme',
    actions: {
      list: {
        descriptor: descriptor<
          { publisher?: string },
          {
            themes: Array<{
              id: string;
              displayName: string;
              version: string;
              isDefault: boolean;
              publisher?: string;
              parentTheme?: string;
            }>;
          }
        >(
          'theme.list',
          ['theme.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'theme.list', async (input) => {
            const themes = input.publisher
              ? state.themes.filter((theme) => theme.publisher === input.publisher)
              : state.themes;
            return {
              themes: themes.map((theme) => ({
                id: theme.id,
                displayName: theme.displayName,
                version: theme.version,
                isDefault: theme.isDefault,
                publisher: theme.publisher,
                parentTheme: theme.parentTheme
              }))
            };
          })
        )
      },
      apply: {
        descriptor: descriptor<{ id: string }, { success: true; themeId: string }>(
          'theme.apply',
          ['theme.write'],
          2_000,
          false,
          0,
          withMetrics(state, 'theme.apply', async (input) => {
            if (!findThemeRecord(state, input.id)) {
              throw createError('THEME_NOT_FOUND', `Theme not found: ${input.id}`);
            }

            const context = resolveThemeContext(state, [input.id]);
            validateThemeContractWithTokens(context.activeTheme.id, context.activeTheme.contract, context.resolvedTheme.variables);

            const previousThemeId = state.currentThemeId;
            state.currentThemeId = context.activeTheme.id;
            state.configUser.set('ui.theme', context.activeTheme.id);
            await persistConfigScope(ctx.workspacePath, 'user', state.configUser);

            await ctx.kernel.events.emit('theme.changed', 'theme-service', buildThemeChangedPayload(context, previousThemeId));

            return { success: true, themeId: context.activeTheme.id };
          })
        )
      },
      getCurrent: {
        descriptor: descriptor<
          { appId?: string; pluginId?: string },
          {
            themeId: string;
            displayName: string;
            version: string;
            parentTheme?: string;
          }
        >(
          'theme.getCurrent',
          ['theme.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'theme.getCurrent', async () => {
            const theme = findThemeRecord(state, state.currentThemeId);
            if (!theme) {
              throw createError('THEME_NOT_FOUND', 'Current theme not found');
            }
            return {
              themeId: theme.id,
              displayName: theme.displayName,
              version: theme.version,
              parentTheme: theme.parentTheme
            };
          })
        )
      },
      getAllCss: {
        descriptor: descriptor<Record<string, unknown>, { css: string; themeId: string }>(
          'theme.getAllCss',
          ['theme.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'theme.getAllCss', async () => {
            const context = resolveThemeContext(state, []);
            return { css: context.css, themeId: context.activeTheme.id };
          })
        )
      },
      resolve: {
        descriptor: descriptor<
          { chain: string[] },
          ThemeResolveResult
        >(
          'theme.resolve',
          ['theme.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'theme.resolve', async (input) => {
            const context = resolveThemeContext(state, input.chain);
            return buildThemeResolveResult(context);
          })
        )
      },
      contractGet: {
        descriptor: descriptor<{ component?: string }, ThemeContractView>(
          'theme.contract.get',
          ['theme.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'theme.contract.get', async (input) => {
            const context = resolveThemeContext(state, []);
            return buildThemeContractViewForContext(context, input.component);
          })
        )
      }
    }
  };

  const i18nService: ServiceRegistration = {
    name: 'i18n',
    actions: {
      getCurrent: {
        descriptor: descriptor<Record<string, unknown>, { locale: string }>(
          'i18n.getCurrent',
          ['i18n.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'i18n.getCurrent', async () => ({ locale: state.locale }))
        )
      },
      setCurrent: {
        descriptor: descriptor<{ locale: string }, { ack: true }>(
          'i18n.setCurrent',
          ['i18n.write'],
          2_000,
          false,
          0,
          withMetrics(state, 'i18n.setCurrent', async (input) => {
            if (!state.locales[input.locale]) {
              throw createError('I18N_LOCALE_NOT_FOUND', `Locale not found: ${input.locale}`);
            }
            state.locale = input.locale;
            await ctx.kernel.events.emit('language.changed', 'i18n-service', { locale: input.locale });
            return { ack: true };
          })
        )
      },
      translate: {
        descriptor: descriptor<{ key: string; params?: Record<string, unknown> }, { text: string }>(
          'i18n.translate',
          ['i18n.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'i18n.translate', async (input) => {
            const table = state.locales[state.locale] ?? {};
            const template = table[input.key];
            if (!template) {
              throw createError('I18N_KEY_MISSING', `Translation key missing: ${input.key}`);
            }

            const text = Object.entries(input.params ?? {}).reduce((result, [key, value]) => {
              return result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
            }, template);

            return { text };
          })
        )
      },
      listLocales: {
        descriptor: descriptor<Record<string, unknown>, { locales: string[] }>(
          'i18n.listLocales',
          ['i18n.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'i18n.listLocales', async () => ({ locales: Object.keys(state.locales) }))
        )
      }
    }
  };

  const commandService: ServiceRegistration = {
    name: 'command',
    actions: {
      register: {
        descriptor: descriptor<Record<string, unknown>, { command: CommandView }>(
          'command.register',
          ['command.write'],
          3_000,
          false,
          0,
          withMetrics(state, 'command.register', async (input, routeContext) => {
            const command = normalizeCommandDefinition(input, routeContext);
            const existing = state.commands.get(command.commandId);
            if (existing && getCommandOwnerKey(existing) !== getCommandRouteCallerOwnerKey(routeContext)) {
              throw createError('COMMAND_ALREADY_REGISTERED', `Command already registered: ${command.commandId}`, {
                commandId: command.commandId,
                ownerPluginId: existing.ownerPluginId
              });
            }
            if (existing) {
              command.registeredAt = existing.registeredAt;
              command.updatedAt = Date.now();
            }
            ensurePluginOwnsCommandPermissions(ctx, command);
            await registerCommandShortcuts(ctx, state, command);
            state.commands.set(command.commandId, command);
            await emitCommandRegistryEvent(ctx, command, existing ? 'changed' : 'registered', routeContext);
            return { command: toCommandView(command, routeContext) };
          })
        )
      },
      unregister: {
        descriptor: descriptor<{ commandId: string }, { ack: true }>(
          'command.unregister',
          ['command.write'],
          3_000,
          false,
          0,
          withMetrics(state, 'command.unregister', async (input, routeContext) => {
            const commandId = asString(input.commandId);
            if (!commandId) {
              throw createError('COMMAND_SCHEMA_INVALID', 'commandId must be a non-empty string');
            }
            const command = state.commands.get(commandId);
            if (!command) {
              throw createError('COMMAND_NOT_FOUND', `Command not found: ${commandId}`, { commandId });
            }
            ensureCommandOwnership(command, routeContext, 'command.unregister');
            await unregisterCommand(ctx, state, commandId, 'owner-unregister');
            return { ack: true };
          })
        )
      },
      get: {
        descriptor: descriptor<{ commandId: string; context?: CommandInvocationContext; includeHidden?: boolean }, { command?: CommandView }>(
          'command.get',
          ['command.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'command.get', async (input, routeContext) => {
            const commandId = asString(input.commandId);
            if (!commandId) {
              throw createError('COMMAND_SCHEMA_INVALID', 'commandId must be a non-empty string');
            }
            const command = state.commands.get(commandId);
            if (!command) {
              return { command: undefined };
            }
            const view = toCommandView(command, routeContext, input.context);
            if (!input.includeHidden && !view.diagnostic.visible) {
              return { command: undefined };
            }
            return { command: view };
          })
        )
      },
      list: {
        descriptor: descriptor<CommandQueryOptions, { commands: CommandView[] }>(
          'command.list',
          ['command.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'command.list', async (input, routeContext) => {
            return {
              commands: listCommandViews(state, routeContext, parseCommandQueryOptions(input))
            };
          })
        )
      },
      setState: {
        descriptor: descriptor<{ commandId: string; state: CommandStatePatch }, { command: CommandView }>(
          'command.setState',
          ['command.write'],
          3_000,
          false,
          0,
          withMetrics(state, 'command.setState', async (input, routeContext) => {
            const commandId = asString(input.commandId);
            if (!commandId) {
              throw createError('COMMAND_SCHEMA_INVALID', 'commandId must be a non-empty string');
            }
            const command = state.commands.get(commandId);
            if (!command) {
              throw createError('COMMAND_NOT_FOUND', `Command not found: ${commandId}`, { commandId });
            }
            ensureCommandOwnership(command, routeContext, 'command.setState');
            command.state = {
              ...command.state,
              ...normalizeCommandStatePatch(input.state)
            };
            command.updatedAt = Date.now();
            await emitCommandRegistryEvent(ctx, command, 'changed', routeContext);
            return { command: toCommandView(command, routeContext) };
          })
        )
      },
      invoke: {
        descriptor: descriptor<CommandInvokeInput, { commandId: string; invocationId: string; dispatched: boolean; command: CommandView }>(
          'command.invoke',
          ['command.invoke'],
          3_000,
          false,
          0,
          withMetrics(state, 'command.invoke', async (input, routeContext) => {
            const commandId = asString(input.commandId);
            if (!commandId) {
              throw createError('COMMAND_SCHEMA_INVALID', 'commandId must be a non-empty string');
            }
            const command = state.commands.get(commandId);
            if (!command) {
              throw createError('COMMAND_NOT_FOUND', `Command not found: ${commandId}`, { commandId });
            }
            const source = typeof input.source === 'string' && COMMAND_SOURCES.has(input.source)
              ? input.source
              : 'api';
            if (typeof input.source !== 'undefined' && source === 'api' && input.source !== 'api') {
              throw createError('COMMAND_SCHEMA_INVALID', `Invalid command source: ${String(input.source)}`);
            }
            const payload = typeof input.payload === 'undefined'
              ? undefined
              : isRecord(input.payload)
                ? deepClone(input.payload)
                : undefined;
            if (typeof input.payload !== 'undefined' && !payload) {
              throw createError('COMMAND_SCHEMA_INVALID', 'command.invoke payload must be an object when provided');
            }
            const invocationContext = input.context ? cloneCommandViewPart(input.context) : undefined;
            const effectivePluginId = invocationContext?.pluginId ?? routeContext.caller.pluginId;
            if (command.scope.kind === 'app' && effectivePluginId && command.scope.appId !== effectivePluginId) {
              throw createError('COMMAND_SCOPE_MISMATCH', 'Command cannot be invoked outside its app scope', {
                commandId,
                appId: command.scope.appId,
                pluginId: effectivePluginId
              });
            }
            if (command.scope.kind === 'scene' && invocationContext?.sceneId !== command.scope.sceneId) {
              throw createError('COMMAND_SCOPE_MISMATCH', 'Command cannot be invoked outside its scene scope', {
                commandId,
                sceneId: command.scope.sceneId
              });
            }
            if (command.scope.kind === 'surface' && invocationContext?.surfaceId !== command.scope.surfaceId) {
              throw createError('COMMAND_SCOPE_MISMATCH', 'Command cannot be invoked outside its surface scope', {
                commandId,
                surfaceId: command.scope.surfaceId
              });
            }
            if (command.scope.kind === 'document' && invocationContext?.documentId !== command.scope.documentId) {
              throw createError('COMMAND_SCOPE_MISMATCH', 'Command cannot be invoked outside its document scope', {
                commandId,
                documentId: command.scope.documentId
              });
            }
            for (const permission of command.permission) {
              ensureCallerPermission(routeContext, permission, 'command.invoke');
            }
            const view = toCommandView(command, routeContext, invocationContext);
            if (!view.diagnostic.visible) {
              throw createError('COMMAND_HIDDEN', `Command is hidden: ${commandId}`, {
                commandId,
                reasonKey: view.diagnostic.hiddenReasonKey
              });
            }
            if (!view.diagnostic.enabled) {
              throw createError('COMMAND_DISABLED', `Command is disabled: ${commandId}`, {
                commandId,
                reasonKey: view.diagnostic.disabledReasonKey
              });
            }
            const invocationId = createId();
            await ctx.kernel.events.emit('command.invoked', 'command-service', {
              invocationId,
              commandId,
              command: view,
              handlerId: command.handlerId,
              ownerPluginId: command.ownerPluginId,
              ownerSessionId: command.ownerSessionId,
              source,
              sceneId: invocationContext?.sceneId ?? command.scope.sceneId,
              surfaceId: invocationContext?.surfaceId ?? command.scope.surfaceId,
              documentId: invocationContext?.documentId ?? command.scope.documentId,
              context: invocationContext,
              payload
            });
            return {
              commandId,
              invocationId,
              dispatched: true,
              command: view
            };
          })
        )
      }
    }
  };

  const surfaceService: ServiceRegistration = {
    name: 'surface',
    actions: {
      open: {
        descriptor: descriptor<{ request: Parameters<PALAdapter['surface']['open']>[0] }, { surface: unknown }>(
          'surface.open',
          ['window.control'],
          3_000,
          false,
          0,
          withMetrics(state, 'surface.open', async (input, routeContext) => {
            const request = input.request;
            if (request.target.type === 'plugin') {
              ensureCallerPermission(routeContext, 'plugin.manage', 'surface.open');
              const opened = await openPluginSurface(ctx, state, request.target.pluginId, {
                kind: request.kind,
                presentation: request.presentation,
                launchParams: request.target.launchParams,
                url: request.target.url,
                context: request.context
              });
              return { surface: opened.surface };
            }

            const presentation = request.presentation
              ? {
                  ...request.presentation,
                  chrome: resolveThemedWindowChrome(state, request.presentation.chrome)
                }
              : {
                  title:
                    request.target.type === 'document'
                      ? request.target.title ?? request.target.documentId
                      : request.target.type === 'url'
                        ? request.target.url
                        : undefined
                };
            const surfaceContext = request.context ?? buildGenericSurfaceContext(request, presentation);
            const openedSurface = await ctx.pal.surface.open({
              ...request,
              presentation,
              context: surfaceContext
            });
            const surface = withSurfaceContext(openedSurface, surfaceContext);
            await emitSurfaceCreatedEvents(ctx, 'surface-service', surface);
            return { surface };
          })
        )
      },
      focus: {
        descriptor: descriptor<{ surfaceId: string }, { ack: true }>(
          'surface.focus',
          ['window.control'],
          2_000,
          true,
          0,
          withMetrics(state, 'surface.focus', async (input) => {
            await ctx.pal.surface.focus(input.surfaceId);
            const surface = await ctx.pal.surface.getState(input.surfaceId);
            await emitSurfaceActionEvent(ctx, 'surface.focused', 'surface-service', surface);
            if (surface.context) {
              await emitSurfaceActionEvent(ctx, 'scene.active', 'surface-service', surface);
            }
            return { ack: true };
          })
        )
      },
      resize: {
        descriptor: descriptor<{ surfaceId: string; width: number; height: number }, { ack: true }>(
          'surface.resize',
          ['window.control'],
          2_000,
          false,
          0,
          withMetrics(state, 'surface.resize', async (input) => {
            await ctx.pal.surface.resize(input.surfaceId, input.width, input.height);
            const surface = await ctx.pal.surface.getState(input.surfaceId);
            await emitSurfaceActionEvent(ctx, 'surface.resized', 'surface-service', surface, {
              width: input.width,
              height: input.height
            });
            return { ack: true };
          })
        )
      },
      setState: {
        descriptor: descriptor<{ surfaceId: string; state: 'normal' | 'minimized' | 'maximized' | 'fullscreen' | 'hidden' }, { ack: true }>(
          'surface.setState',
          ['window.control'],
          2_000,
          false,
          0,
          withMetrics(state, 'surface.setState', async (input) => {
            await ctx.pal.surface.setState(input.surfaceId, input.state);
            const surface = await ctx.pal.surface.getState(input.surfaceId);
            await emitSurfaceActionEvent(ctx, 'surface.stateChanged', 'surface-service', surface, {
              state: input.state
            });
            return { ack: true };
          })
        )
      },
      getState: {
        descriptor: descriptor<{ surfaceId: string }, { state: unknown }>(
          'surface.getState',
          ['window.control'],
          2_000,
          true,
          0,
          withMetrics(state, 'surface.getState', async (input) => {
            const currentState = await ctx.pal.surface.getState(input.surfaceId);
            return { state: currentState };
          })
        )
      },
      close: {
        descriptor: descriptor<{ surfaceId: string }, { ack: true }>(
          'surface.close',
          ['window.control'],
          2_000,
          false,
          0,
          withMetrics(state, 'surface.close', async (input) => {
            const surface = await ctx.pal.surface.getState(input.surfaceId);
            await ctx.pal.surface.close(input.surfaceId);
            if (surface.sessionId) {
              await unregisterCommandsByOwner(ctx, state, { sessionId: surface.sessionId }, 'session-closed');
              ctx.runtime.stopSession(surface.sessionId);
            }
            await emitSurfaceActionEvent(ctx, 'surface.closed', 'surface-service', surface);
            if (surface.context) {
              await emitSurfaceActionEvent(ctx, 'scene.inactive', 'surface-service', surface);
              await emitSurfaceActionEvent(ctx, 'scene.closed', 'surface-service', surface);
            }
            return { ack: true };
          })
        )
      },
      list: {
        descriptor: descriptor<Record<string, unknown>, { surfaces: unknown[] }>(
          'surface.list',
          ['window.control'],
          2_000,
          true,
          0,
          withMetrics(state, 'surface.list', async () => {
            const surfaces = await ctx.pal.surface.list();
            return { surfaces };
          })
        )
      }
    }
  };

  const transferService: ServiceRegistration = {
    name: 'transfer',
    actions: {
      openPath: {
        descriptor: descriptor<{ path: string }, { ack: true }>(
          'transfer.openPath',
          ['platform.external'],
          5_000,
          false,
          0,
          withMetrics(state, 'transfer.openPath', async (input) => {
            await ctx.pal.transfer.openPath(input.path);
            return { ack: true };
          })
        )
      },
      openExternal: {
        descriptor: descriptor<{ url: string }, { ack: true }>(
          'transfer.openExternal',
          ['platform.external'],
          8_000,
          false,
          0,
          withMetrics(state, 'transfer.openExternal', async (input) => {
            await ctx.pal.transfer.openExternal(input.url);
            return { ack: true };
          })
        )
      },
      revealInShell: {
        descriptor: descriptor<{ path: string }, { ack: true }>(
          'transfer.revealInShell',
          ['platform.external'],
          5_000,
          true,
          0,
          withMetrics(state, 'transfer.revealInShell', async (input) => {
            await ctx.pal.transfer.revealInShell(input.path);
            return { ack: true };
          })
        )
      },
      share: {
        descriptor: descriptor<
          { input: { title?: string; text?: string; url?: string; files?: string[] } },
          { shared: boolean }
        >(
          'transfer.share',
          ['platform.external'],
          8_000,
          false,
          0,
          withMetrics(state, 'transfer.share', async (input) => {
            if (typeof ctx.pal.transfer.share !== 'function') {
              throw createError('PLATFORM_UNSUPPORTED', 'Current PAL adapter does not support transfer.share');
            }
            return ctx.pal.transfer.share(input.input ?? {});
          })
        )
      }
    }
  };

  const associationService: ServiceRegistration = {
    name: 'association',
    actions: {
      getCapabilities: {
        descriptor: descriptor<Record<string, unknown>, { capabilities: unknown }>(
          'association.getCapabilities',
          ['platform.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'association.getCapabilities', async () => {
            const capabilities = await ctx.pal.association.getCapabilities();
            return { capabilities };
          })
        )
      },
      openPath: {
        descriptor: descriptor<{ path: string }, { result: unknown }>(
          'association.openPath',
          ['platform.external'],
          12_000,
          false,
          0,
          withMetrics(state, 'association.openPath', async (input) => {
            const result = await openAssociatedPathInternal(ctx, state, input.path);
            return { result };
          })
        )
      },
      openUrl: {
        descriptor: descriptor<{ url: string }, { result: { url: string; mode: 'external' } }>(
          'association.openUrl',
          ['platform.external'],
          8_000,
          false,
          0,
          withMetrics(state, 'association.openUrl', async (input) => {
            await ctx.pal.transfer.openExternal(input.url);
            return {
              result: {
                url: input.url,
                mode: 'external'
              }
            };
          })
        )
      }
    }
  };

  const windowService: ServiceRegistration = {
    name: 'window',
    actions: {
      open: {
        descriptor: descriptor<
          {
            config: {
              title: string;
              width: number;
              height: number;
              url?: string;
              pluginId?: string;
              sessionId?: string;
              permissions?: string[];
              launchParams?: Record<string, unknown>;
              chrome?: WindowChromeOptions;
            };
          },
          { window: unknown }
        >(
          'window.open',
          ['window.control'],
          3_000,
          false,
          0,
          withMetrics(state, 'window.open', async (input) => {
            const presentation: SurfacePresentation = {
              title: input.config.title,
              width: input.config.width,
              height: input.config.height,
              chrome: resolveThemedWindowChrome(state, input.config.chrome)
            };
            const request: Parameters<PALAdapter['surface']['open']>[0] = {
              kind: 'window',
              target: input.config.pluginId
                ? {
                    type: 'plugin',
                    pluginId: input.config.pluginId,
                    url: input.config.url,
                    sessionId: input.config.sessionId,
                    permissions: input.config.permissions,
                    launchParams: input.config.launchParams
                  }
                : {
                    type: 'url',
                    url: input.config.url ?? ''
                  },
              presentation
            };
            const surfaceContext = buildGenericSurfaceContext(request, presentation);
            const openedSurface = await ctx.pal.surface.open({
              ...request,
              context: surfaceContext
            });
            const surface = withSurfaceContext(openedSurface, surfaceContext);
            await emitSurfaceCreatedEvents(ctx, 'window-service', surface);
            return { window: surface };
          })
        )
      },
      focus: {
        descriptor: descriptor<{ windowId: string }, { ack: true }>(
          'window.focus',
          ['window.control'],
          2_000,
          true,
          0,
          withMetrics(state, 'window.focus', async (input) => {
            await ctx.pal.surface.focus(input.windowId);
            const surface = await ctx.pal.surface.getState(input.windowId);
            await emitSurfaceActionEvent(ctx, 'surface.focused', 'window-service', surface);
            if (surface.context) {
              await emitSurfaceActionEvent(ctx, 'scene.active', 'window-service', surface);
            }
            return { ack: true };
          })
        )
      },
      resize: {
        descriptor: descriptor<{ windowId: string; width: number; height: number }, { ack: true }>(
          'window.resize',
          ['window.control'],
          2_000,
          false,
          0,
          withMetrics(state, 'window.resize', async (input) => {
            await ctx.pal.surface.resize(input.windowId, input.width, input.height);
            const surface = await ctx.pal.surface.getState(input.windowId);
            await emitSurfaceActionEvent(ctx, 'surface.resized', 'window-service', surface, {
              width: input.width,
              height: input.height
            });
            return { ack: true };
          })
        )
      },
      setState: {
        descriptor: descriptor<{ windowId: string; state: 'normal' | 'minimized' | 'maximized' | 'fullscreen' }, { ack: true }>(
          'window.setState',
          ['window.control'],
          2_000,
          false,
          0,
          withMetrics(state, 'window.setState', async (input) => {
            await ctx.pal.surface.setState(input.windowId, input.state);
            const surface = await ctx.pal.surface.getState(input.windowId);
            await emitSurfaceActionEvent(ctx, 'surface.stateChanged', 'window-service', surface, {
              state: input.state
            });
            return { ack: true };
          })
        )
      },
      getState: {
        descriptor: descriptor<{ windowId: string }, { state: unknown }>(
          'window.getState',
          ['window.control'],
          2_000,
          true,
          0,
          withMetrics(state, 'window.getState', async (input) => {
            const currentState = await ctx.pal.surface.getState(input.windowId);
            return { state: currentState };
          })
        )
      },
      close: {
        descriptor: descriptor<{ windowId: string }, { ack: true }>(
          'window.close',
          ['window.control'],
          2_000,
          false,
          0,
          withMetrics(state, 'window.close', async (input) => {
            const surface = await ctx.pal.surface.getState(input.windowId);
            await ctx.pal.surface.close(input.windowId);
            if (surface.sessionId) {
              await unregisterCommandsByOwner(ctx, state, { sessionId: surface.sessionId }, 'session-closed');
              ctx.runtime.stopSession(surface.sessionId);
            }
            await emitSurfaceActionEvent(ctx, 'surface.closed', 'window-service', surface);
            if (surface.context) {
              await emitSurfaceActionEvent(ctx, 'scene.inactive', 'window-service', surface);
              await emitSurfaceActionEvent(ctx, 'scene.closed', 'window-service', surface);
            }
            return { ack: true };
          })
        )
      }
    }
  };

  const pluginService: ServiceRegistration = {
    name: 'plugin',
    actions: {
      list: {
        descriptor: descriptor<{ type?: string; capability?: string }, { plugins: PluginInfoView[] }>(
          'plugin.list',
          ['plugin.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'plugin.list', async (input) => {
            const records = ctx.runtime.query({
              type: input.type as PluginInfoView['type'] | undefined,
              capability: input.capability
            });
            return {
              plugins: records.map((record) => toPluginInfoView(record))
            };
          })
        )
      },
      get: {
        descriptor: descriptor<{ pluginId: string }, { plugin?: PluginInfoView }>(
          'plugin.get',
          ['plugin.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'plugin.get', async (input) => {
            const record = ctx.runtime.query().find((item) => item.manifest.id === input.pluginId);
            return { plugin: record ? toPluginInfoView(record) : undefined };
          })
        )
      },
      getSelf: {
        descriptor: descriptor<Record<string, unknown>, { plugin: PluginInfoView }>(
          'plugin.getSelf',
          ['plugin.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'plugin.getSelf', async (_input, routeContext) => {
            const pluginId = routeContext.caller.pluginId;
            if (!pluginId) {
              throw createError('PLUGIN_CONTEXT_MISSING', 'plugin.getSelf requires a plugin caller context');
            }
            const record = ctx.runtime.get(pluginId);
            return { plugin: toPluginInfoView(record) };
          })
        )
      },
      getCardPlugin: {
        descriptor: descriptor<{ cardType: string }, { plugin?: PluginInfoView }>(
          'plugin.getCardPlugin',
          ['plugin.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'plugin.getCardPlugin', async (input) => {
            const candidates = buildCardTypeCandidates(input.cardType);
            const plugin = ctx.runtime
              .query({ type: 'card' })
              .filter((record) => record.enabled && typeof record.manifest.entry === 'string' && record.manifest.entry.length > 0)
              .find((record) => {
                const capabilities = new Set(record.manifest.capabilities ?? []);
                return candidates.some((candidate) => capabilities.has(candidate));
              });
            return { plugin: plugin ? toPluginInfoView(plugin) : undefined };
          })
        )
      },
      getLayoutPlugin: {
        descriptor: descriptor<{ layoutType: string }, { plugin?: PluginInfoView }>(
          'plugin.getLayoutPlugin',
          ['plugin.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'plugin.getLayoutPlugin', async (input) => {
            const normalizedLayoutType = input.layoutType.trim().toLowerCase();
            const plugin = ctx.runtime
              .query({ type: 'layout' })
              .filter((record) => record.enabled)
              .find((record) => (record.manifest.layout?.layoutType ?? '').trim().toLowerCase() === normalizedLayoutType);
            return { plugin: plugin ? toPluginInfoView(plugin) : undefined };
          })
        )
      },
      install: {
        descriptor: descriptor<{ manifestPath: string }, { pluginId: string }>(
          'plugin.install',
          ['plugin.manage'],
          8_000,
          false,
          0,
          withMetrics(state, 'plugin.install', async (input) => {
            const record = await ctx.runtime.install(input.manifestPath);
            touchCliCommandIndex(state);
            if (record.manifest.type === 'module') {
              await syncModuleProviders(ctx, state);
            }
            if (record.manifest.type === 'theme') {
              await syncInstalledThemes(ctx, state);
            }
            await ctx.kernel.events.emit('plugin.installed', 'plugin-service', { pluginId: record.manifest.id });
            return { pluginId: record.manifest.id };
          })
        )
      },
      enable: {
        descriptor: descriptor<{ pluginId: string }, { ack: true }>(
          'plugin.enable',
          ['plugin.manage'],
          3_000,
          false,
          0,
          withMetrics(state, 'plugin.enable', async (input) => {
            const plugin = ctx.runtime.get(input.pluginId);
            await ctx.runtime.enable(input.pluginId);
            touchCliCommandIndex(state);
            if (plugin.manifest.type === 'module') {
              await syncModuleProviders(ctx, state);
            }
            if (plugin.manifest.type === 'theme') {
              await syncInstalledThemes(ctx, state);
            }
            await ctx.kernel.events.emit('plugin.enabled', 'plugin-service', { pluginId: input.pluginId });
            return { ack: true };
          })
        )
      },
      disable: {
        descriptor: descriptor<{ pluginId: string }, { ack: true }>(
          'plugin.disable',
          ['plugin.manage'],
          3_000,
          false,
          0,
          withMetrics(state, 'plugin.disable', async (input) => {
            const plugin = ctx.runtime.get(input.pluginId);
            await ctx.runtime.disable(input.pluginId);
            touchCliCommandIndex(state);
            if (plugin.manifest.type === 'module') {
              await stopModuleRuntime(ctx, state, input.pluginId, invokeModuleInternal);
              await unregisterModulePluginState(ctx, state, input.pluginId, 'plugin-disabled');
              await syncModuleProviders(ctx, state);
            }
            if (plugin.manifest.type === 'app') {
              await unregisterCommandsByOwner(ctx, state, { pluginId: input.pluginId }, 'plugin-disabled');
            }
            await cancelCliTasksForPlugin(ctx, state, input.pluginId, 'plugin-disabled');
            if (plugin.manifest.type === 'theme') {
              await syncInstalledThemes(ctx, state);
            }
            await ctx.kernel.events.emit('plugin.disabled', 'plugin-service', { pluginId: input.pluginId });
            return { ack: true };
          })
        )
      },
      uninstall: {
        descriptor: descriptor<{ pluginId: string }, { ack: true }>(
          'plugin.uninstall',
          ['plugin.manage'],
          5_000,
          false,
          0,
          withMetrics(state, 'plugin.uninstall', async (input) => {
            const plugin = ctx.runtime.get(input.pluginId);
            if (plugin.manifest.type === 'app') {
              await unregisterCommandsByOwner(ctx, state, { pluginId: input.pluginId }, 'plugin-uninstalled');
              await removePluginShortcut(ctx, input.pluginId).catch(() => undefined);
            }
            if (plugin.manifest.type === 'module') {
              await stopModuleRuntime(ctx, state, input.pluginId, invokeModuleInternal);
              await unregisterModulePluginState(ctx, state, input.pluginId, 'plugin-uninstalled');
            }
            await cancelCliTasksForPlugin(ctx, state, input.pluginId, 'plugin-uninstalled');
            await ctx.runtime.uninstall(input.pluginId);
            touchCliCommandIndex(state);
            if (plugin.manifest.type === 'module') {
              await syncModuleProviders(ctx, state);
            }
            if (plugin.manifest.type === 'theme') {
              await syncInstalledThemes(ctx, state);
            }
            await ctx.kernel.events.emit('plugin.uninstalled', 'plugin-service', { pluginId: input.pluginId });
            return { ack: true };
          })
        )
      },
      launch: {
        descriptor: descriptor<
          { pluginId: string; launchParams?: Record<string, unknown> },
          {
            window: { id: string; chrome?: WindowChromeOptions };
            session: { sessionId: string; sessionNonce: string; permissions: string[] };
          }
        >(
          'plugin.launch',
          ['plugin.manage'],
          6_000,
          false,
          0,
          withMetrics(state, 'plugin.launch', async (input) => {
            return openPluginWindow(ctx, state, input.pluginId, input.launchParams ?? {});
          })
        )
      },
      getShortcut: {
        descriptor: descriptor<{ pluginId: string }, { shortcut: PluginShortcutView }>(
          'plugin.getShortcut',
          ['plugin.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'plugin.getShortcut', async (input) => {
            const shortcut = await readPluginShortcut(ctx, input.pluginId);
            return { shortcut };
          })
        )
      },
      createShortcut: {
        descriptor: descriptor<{ pluginId: string; replace?: boolean }, { shortcut: PluginShortcutView }>(
          'plugin.createShortcut',
          ['plugin.manage'],
          8_000,
          false,
          0,
          withMetrics(state, 'plugin.createShortcut', async (input) => {
            const shortcut = await createPluginShortcut(ctx, input.pluginId, input.replace === true);
            return { shortcut };
          })
        )
      },
      removeShortcut: {
        descriptor: descriptor<{ pluginId: string }, { removed: boolean; launcherPath: string; location: 'desktop' | 'launchpad' }>(
          'plugin.removeShortcut',
          ['plugin.manage'],
          5_000,
          false,
          0,
          withMetrics(state, 'plugin.removeShortcut', async (input) => {
            return removePluginShortcut(ctx, input.pluginId);
          })
        )
      },
      query: {
        descriptor: descriptor<{ type?: string; capability?: string }, { plugins: PluginRecordView[] }>(
          'plugin.query',
          ['plugin.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'plugin.query', async (input) => {
            const records = ctx.runtime.query({
              type: input.type as PluginRecordView['type'] | undefined,
              capability: input.capability
            });
            return {
              plugins: records.map((record) => toPluginRecordView(record))
            };
          })
        )
      },
      init: {
        descriptor: descriptor<{ pluginId: string; launchParams?: Record<string, unknown> }, { session: unknown }>(
          'plugin.init',
          ['plugin.manage'],
          3_000,
          false,
          0,
          withMetrics(state, 'plugin.init', async (input) => {
            const session = ctx.runtime.pluginInit(input.pluginId, input.launchParams ?? {});
            await ctx.kernel.events.emit('plugin.init', 'plugin-service', { pluginId: input.pluginId, sessionId: session.sessionId });
            return { session };
          })
        )
      },
      handshakeComplete: {
        descriptor: descriptor<{ sessionId: string; nonce: string }, { session: unknown }>(
          'plugin.handshake.complete',
          ['plugin.manage'],
          3_000,
          false,
          0,
          withMetrics(state, 'plugin.handshake.complete', async (input) => {
            const session = ctx.runtime.completeHandshake(input.sessionId, input.nonce);
            await ctx.kernel.events.emit('plugin.ready', 'plugin-service', { pluginId: session.pluginId, sessionId: session.sessionId });
            return { session };
          })
        )
      }
    }
  };

  const cliCommandService: ServiceRegistration = {
    name: 'cli-command',
    actions: {
      list: {
        descriptor: descriptor<CliCommandQueryOptions, { index: CliCommandIndexView; commands: CliCommandView[] }>(
          'cli.command.list',
          ['plugin.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'cli.command.list', async (input) => {
            const options = parseCliCommandQueryOptions(input);
            const index = buildCliCommandIndex(ctx, state);
            return {
              index,
              commands: filterCliCommands(index, options)
            };
          })
        )
      },
      get: {
        descriptor: descriptor<CliCommandQueryOptions, { command?: CliCommandView }>(
          'cli.command.get',
          ['plugin.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'cli.command.get', async (input) => {
            const options = parseCliCommandQueryOptions(input);
            if (!options.commandId && !options.commandPath) {
              throw createError('CLI_COMMAND_QUERY_INVALID', 'cli.command.get requires commandId or commandPath');
            }
            const index = buildCliCommandIndex(ctx, state);
            const matches = filterCliCommands(index, {
              ...options,
              includeDisabled: options.includeDisabled
            });
            if (matches.length > 1) {
              throw createError('CLI_COMMAND_CONFLICT', 'Multiple CLI commands match the requested identifier', {
                commandPath: options.commandPath,
                commandId: options.commandId,
                matches: matches.map((command) => ({
                  commandId: command.commandId,
                  ownerPluginId: command.owner.pluginId,
                  commandPath: command.commandPath
                }))
              });
            }
            return { command: matches[0] };
          })
        )
      },
      resolve: {
        descriptor: descriptor<CliCommandQueryOptions, { command?: CliCommandView; conflicts: CliCommandConflictView[] }>(
          'cli.command.resolve',
          ['plugin.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'cli.command.resolve', async (input) => {
            const options = parseCliCommandQueryOptions(input);
            if (!options.commandId && !options.commandPath) {
              throw createError('CLI_COMMAND_QUERY_INVALID', 'cli.command.resolve requires commandId or commandPath');
            }
            const index = buildCliCommandIndex(ctx, state);
            const matches = filterCliCommands(index, options);
            const conflicts = [...new Map(
              matches.flatMap((command) => command.conflicts).map((conflict) => [conflict.commandPathKey, conflict])
            ).values()];
            if (conflicts.length > 0 && !options.pluginId && !options.commandId) {
              return {
                command: undefined,
                conflicts
              };
            }
            return {
              command: matches[0],
              conflicts
            };
          })
        )
      }
    }
  };

  const cliTaskService: ServiceRegistration = {
    name: 'cli-task',
    actions: {
      create: {
        descriptor: descriptor<
          {
            pluginId: string;
            commandId: string;
            commandPath?: string[];
            surfaceId?: string;
            sessionId?: string;
          },
          { task: CliTaskView }
        >(
          'cli.task.create',
          ['plugin.manage'],
          3_000,
          false,
          0,
          withMetrics(state, 'cli.task.create', async (input) => {
            const pluginId = asString(input.pluginId);
            const commandId = asString(input.commandId);
            if (!pluginId || !commandId) {
              throw createError('CLI_TASK_INVALID', 'cli.task.create requires pluginId and commandId');
            }
            const plugin = ctx.runtime.get(pluginId);
            if (!plugin.enabled) {
              throw createError('PLUGIN_DISABLED', `Plugin disabled: ${pluginId}`, { pluginId });
            }
            if (plugin.manifest.type !== 'app' && plugin.manifest.type !== 'module') {
              throw createError('PLUGIN_TYPE_UNSUPPORTED', 'CLI tasks are only supported for app and module plugins', {
                pluginId,
                pluginType: plugin.manifest.type
              });
            }

            const nowMs = Date.now();
            const task: CliTaskRecord = {
              taskId: createId(),
              pluginId,
              commandId,
              commandPath: Array.isArray(input.commandPath) ? asStringArray(input.commandPath) : undefined,
              surfaceId: asString(input.surfaceId),
              sessionId: asString(input.sessionId),
              status: 'running',
              createdAt: nowMs,
              updatedAt: nowMs
            };
            state.cliTasks.set(task.taskId, task);
            await ctx.kernel.events.emit('cli.task.created', 'cli-task-service', toCliTaskView(task));
            return { task: toCliTaskView(task) };
          })
        )
      },
      bindInvocation: {
        descriptor: descriptor<
          { taskId: string; invocationId?: string; surfaceId?: string; sessionId?: string },
          { task: CliTaskView }
        >(
          'cli.task.bindInvocation',
          ['plugin.manage'],
          3_000,
          false,
          0,
          withMetrics(state, 'cli.task.bindInvocation', async (input) => {
            const task = requireCliTask(state, input.taskId);
            task.invocationId = asString(input.invocationId) ?? task.invocationId;
            task.surfaceId = asString(input.surfaceId) ?? task.surfaceId;
            task.sessionId = asString(input.sessionId) ?? task.sessionId;
            task.updatedAt = Date.now();
            await ctx.kernel.events.emit('cli.task.changed', 'cli-task-service', toCliTaskView(task));
            return { task: toCliTaskView(task) };
          })
        )
      },
      get: {
        descriptor: descriptor<{ taskId: string }, { task: CliTaskView }>(
          'cli.task.get',
          ['cli.task'],
          3_000,
          true,
          0,
          withMetrics(state, 'cli.task.get', async (input, routeContext) => {
            const task = requireCliTask(state, input.taskId);
            ensureCliTaskOwner(task, routeContext, 'cli.task.get');
            return { task: toCliTaskView(task) };
          })
        )
      },
      progress: {
        descriptor: descriptor<{ taskId: string; progress: Record<string, unknown> }, { task: CliTaskView }>(
          'cli.task.progress',
          ['cli.task'],
          3_000,
          false,
          0,
          withMetrics(state, 'cli.task.progress', async (input, routeContext) => {
            const task = requireCliTask(state, input.taskId);
            ensureCliTaskOwner(task, routeContext, 'cli.task.progress');
            if (!isRecord(input.progress)) {
              throw createError('CLI_TASK_INVALID', 'cli.task.progress requires progress object');
            }
            if (task.status !== 'running') {
              return { task: toCliTaskView(task) };
            }
            task.progress = deepClone(input.progress);
            task.updatedAt = Date.now();
            await ctx.kernel.events.emit('cli.task.progress', 'cli-task-service', toCliTaskView(task));
            return { task: toCliTaskView(task) };
          })
        )
      },
      complete: {
        descriptor: descriptor<{ taskId: string; output?: unknown }, { task: CliTaskView }>(
          'cli.task.complete',
          ['cli.task'],
          3_000,
          false,
          0,
          withMetrics(state, 'cli.task.complete', async (input, routeContext) => {
            const task = requireCliTask(state, input.taskId);
            ensureCliTaskOwner(task, routeContext, 'cli.task.complete');
            if (task.status !== 'running') {
              return { task: toCliTaskView(task) };
            }
            task.status = 'completed';
            task.updatedAt = Date.now();
            task.output = typeof input.output === 'undefined' ? undefined : deepClone(input.output);
            await ctx.kernel.events.emit('cli.task.completed', 'cli-task-service', toCliTaskView(task));
            return { task: toCliTaskView(task) };
          })
        )
      },
      fail: {
        descriptor: descriptor<{ taskId: string; error: unknown }, { task: CliTaskView }>(
          'cli.task.fail',
          ['cli.task'],
          3_000,
          false,
          0,
          withMetrics(state, 'cli.task.fail', async (input, routeContext) => {
            const task = requireCliTask(state, input.taskId);
            ensureCliTaskOwner(task, routeContext, 'cli.task.fail');
            if (task.status !== 'running') {
              return { task: toCliTaskView(task) };
            }
            task.status = 'failed';
            task.updatedAt = Date.now();
            task.error = normalizeCliTaskError(input.error);
            await ctx.kernel.events.emit('cli.task.failed', 'cli-task-service', toCliTaskView(task));
            return { task: toCliTaskView(task) };
          })
        )
      },
      cancel: {
        descriptor: descriptor<{ taskId: string }, { task: CliTaskView }>(
          'cli.task.cancel',
          ['cli.task'],
          3_000,
          false,
          0,
          withMetrics(state, 'cli.task.cancel', async (input, routeContext) => {
            const task = requireCliTask(state, input.taskId);
            ensureCliTaskOwner(task, routeContext, 'cli.task.cancel');
            if (task.status === 'running') {
              task.status = 'cancelled';
              task.updatedAt = Date.now();
              task.error = {
                code: 'CLI_TASK_CANCELLED',
                message: 'CLI task was cancelled'
              };
              await ctx.kernel.events.emit('cli.task.cancelled', 'cli-task-service', toCliTaskView(task));
            }
            return { task: toCliTaskView(task) };
          })
        )
      }
    }
  };

  const moduleService: ServiceRegistration = {
    name: 'module',
    actions: {
      listProviders: {
        descriptor: descriptor<
          { capability?: string; pluginId?: string; status?: 'enabled' | 'running' | 'disabled' | 'error'; versionRange?: string },
          { providers: ModuleProviderView[] }
        >(
          'module.listProviders',
          ['module.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'module.listProviders', async (input) => {
            const providers = flattenModuleProviders(state).filter((provider) => {
              if (input.capability && provider.capability !== input.capability) {
                return false;
              }
              if (input.pluginId && provider.pluginId !== input.pluginId) {
                return false;
              }
              if (input.status && provider.status !== input.status) {
                return false;
              }
              if (input.versionRange && !matchesVersionRange(provider.version, input.versionRange)) {
                return false;
              }
              return true;
            });
            return { providers };
          })
        )
      },
      resolve: {
        descriptor: descriptor<{ capability: string; versionRange?: string }, { provider: ModuleProviderView }>(
          'module.resolve',
          ['module.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'module.resolve', async (input) => {
            const provider = resolveProviderSelection(state, input);
            return { provider };
          })
        )
      },
      invoke: {
        descriptor: descriptor<
          {
            capability: string;
            method: string;
            input: Record<string, unknown>;
            pluginId?: string;
            timeoutMs?: number;
          },
          { mode: 'sync'; output: unknown } | { mode: 'job'; jobId: string }
        >(
          'module.invoke',
          ['module.invoke'],
          30_000,
          false,
          0,
          withMetrics(state, 'module.invoke', async (input, routeContext) => {
            const callerPluginId = routeContext.caller.pluginId ?? 'host';
            return invokeModuleInternal(callerPluginId, input, routeContext);
          })
        )
      },
      jobGet: {
        descriptor: descriptor<{ jobId: string }, { job: ModuleJobView }>(
          'module.job.get',
          ['module.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'module.job.get', async (input) => {
            const job = state.moduleJobs.get(input.jobId);
            if (!job) {
              throw createError('MODULE_JOB_NOT_FOUND', `Module job not found: ${input.jobId}`, {
                jobId: input.jobId
              });
            }
            return { job: toModuleJobView(job) };
          })
        )
      },
      jobCancel: {
        descriptor: descriptor<{ jobId: string }, { ack: true }>(
          'module.job.cancel',
          ['module.invoke'],
          3_000,
          false,
          0,
          withMetrics(state, 'module.job.cancel', async (input) => {
            const job = state.moduleJobs.get(input.jobId);
            if (!job) {
              throw createError('MODULE_JOB_NOT_FOUND', `Module job not found: ${input.jobId}`, {
                jobId: input.jobId
              });
            }

            const controller = state.moduleJobControllers.get(input.jobId);
            controller?.abort();
            state.moduleJobControllers.delete(input.jobId);
            if (job.status === 'running') {
              job.status = 'cancelled';
              job.updatedAt = Date.now();
              job.error = {
                code: 'MODULE_JOB_CANCELLED',
                message: 'Module job was cancelled'
              };
              await emitModuleJobCancelled(ctx, job, 'requested');
            }
            return { ack: true };
          })
        )
      }
    }
  };

  const platformService: ServiceRegistration = {
    name: 'platform',
    actions: {
      getInfo: {
        descriptor: descriptor<Record<string, unknown>, { info: unknown }>(
          'platform.getInfo',
          ['platform.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'platform.getInfo', async () => {
            const info = await ctx.pal.environment.getInfo();
            return { info };
          })
        )
      },
      getCapabilities: {
        descriptor: descriptor<Record<string, unknown>, { capabilities: unknown }>(
          'platform.getCapabilities',
          ['platform.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'platform.getCapabilities', async () => {
            const capabilities = await ctx.pal.environment.getCapabilities();
            return { capabilities };
          })
        )
      },
      getScreenInfo: {
        descriptor: descriptor<Record<string, unknown>, { screen: unknown }>(
          'platform.getScreenInfo',
          ['platform.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'platform.getScreenInfo', async () => {
            const screen = await ctx.pal.device.getPrimaryScreen();
            return { screen };
          })
        )
      },
      listScreens: {
        descriptor: descriptor<Record<string, unknown>, { screens: unknown[] }>(
          'platform.listScreens',
          ['platform.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'platform.listScreens', async () => {
            const screens = await ctx.pal.device.getAllScreens();
            return { screens };
          })
        )
      },
      renderHtmlToPdf: {
        descriptor: descriptor<
          {
            htmlDir: string;
            entryFile?: string;
            outputFile: string;
            options?: {
              pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
              landscape?: boolean;
              printBackground?: boolean;
              preferCSSPageSize?: boolean;
              marginMm?: {
                top?: number;
                right?: number;
                bottom?: number;
                left?: number;
              };
              headerFooter?: {
                enabled?: boolean;
                headerTemplate?: string;
                footerTemplate?: string;
              };
              wait?: {
                timeoutMs?: number;
                quietMs?: number;
                resourceTimeoutMs?: number;
                compositeTimeoutMs?: number;
                waitForFonts?: boolean;
                waitForImages?: boolean;
                waitForFrames?: boolean;
                waitForCompositeReady?: boolean;
              };
            };
          },
          {
            outputFile: string;
            pageCount?: number;
            byteLength?: number;
            diagnostics?: unknown[];
            warnings?: Array<{ code: string; message: string; details?: unknown }>;
          }
        >(
          'platform.renderHtmlToPdf',
          ['platform.read', 'file.read', 'file.write'],
          60_000,
          false,
          0,
          withMetrics(state, 'platform.renderHtmlToPdf', async (input) => {
            return ctx.pal.offscreenRender.renderHtmlToPdf(input);
          })
        )
      },
      renderHtmlToImage: {
        descriptor: descriptor<
          {
            htmlDir: string;
            entryFile?: string;
            outputFile: string;
            options?: {
              format?: 'png' | 'jpeg' | 'webp';
              width?: number;
              height?: number;
              scaleFactor?: number;
              background?: 'transparent' | 'white' | 'theme';
            };
          },
          { outputFile: string; width?: number; height?: number; format: 'png' | 'jpeg' | 'webp' }
        >(
          'platform.renderHtmlToImage',
          ['platform.read', 'file.read', 'file.write'],
          60_000,
          false,
          0,
          withMetrics(state, 'platform.renderHtmlToImage', async (input) => {
            return ctx.pal.offscreenRender.renderHtmlToImage({
              ...input,
              options:
                input.options?.background === 'theme'
                  ? {
                      ...input.options,
                      themeBackgroundColor: resolveThemeBackgroundColor(state)
                    }
                  : input.options
            } as never);
          })
        )
      },
      openExternal: {
        descriptor: descriptor<{ url: string }, { ack: true }>(
          'platform.openExternal',
          ['platform.external'],
          8_000,
          false,
          0,
          withMetrics(state, 'platform.openExternal', async (input) => {
            await ctx.pal.transfer.openExternal(input.url);
            return { ack: true };
          })
        )
      },
      dialogOpenFile: {
        descriptor: descriptor<{ options?: Record<string, unknown> }, { filePaths: string[] | null }>(
          'platform.dialogOpenFile',
          ['platform.read'],
          INTERACTIVE_DIALOG_ROUTE_TIMEOUT_MS,
          true,
          0,
          withMetrics(state, 'platform.dialogOpenFile', async (input) => {
            const filePaths = await ctx.pal.selection.openFile(input.options);
            return { filePaths };
          })
        )
      },
      dialogSaveFile: {
        descriptor: descriptor<{ options?: Record<string, unknown> }, { filePath: string | null }>(
          'platform.dialogSaveFile',
          ['platform.read'],
          INTERACTIVE_DIALOG_ROUTE_TIMEOUT_MS,
          true,
          0,
          withMetrics(state, 'platform.dialogSaveFile', async (input) => {
            const filePath = await ctx.pal.selection.saveFile(input.options);
            return { filePath };
          })
        )
      },
      dialogShowMessage: {
        descriptor: descriptor<{ options: Record<string, unknown> }, { response: number }>(
          'platform.dialogShowMessage',
          ['platform.read'],
          INTERACTIVE_DIALOG_ROUTE_TIMEOUT_MS,
          true,
          0,
          withMetrics(state, 'platform.dialogShowMessage', async (input) => {
            if (typeof input.options.message !== 'string') {
              throw createError('DIALOG_INVALID_OPTIONS', 'platform.dialogShowMessage requires options.message');
            }
            const response = await ctx.pal.selection.showMessage({
              title: typeof input.options.title === 'string' ? input.options.title : undefined,
              message: input.options.message,
              detail: typeof input.options.detail === 'string' ? input.options.detail : undefined
            });
            return { response };
          })
        )
      },
      dialogShowConfirm: {
        descriptor: descriptor<{ options: Record<string, unknown> }, { confirmed: boolean }>(
          'platform.dialogShowConfirm',
          ['platform.read'],
          INTERACTIVE_DIALOG_ROUTE_TIMEOUT_MS,
          true,
          0,
          withMetrics(state, 'platform.dialogShowConfirm', async (input) => {
            if (typeof input.options.message !== 'string') {
              throw createError('DIALOG_INVALID_OPTIONS', 'platform.dialogShowConfirm requires options.message');
            }
            const confirmed = await ctx.pal.selection.showConfirm({
              title: typeof input.options.title === 'string' ? input.options.title : undefined,
              message: input.options.message,
              detail: typeof input.options.detail === 'string' ? input.options.detail : undefined
            });
            return { confirmed };
          })
        )
      },
      clipboardRead: {
        descriptor: descriptor<{ format?: string }, { data: unknown }>(
          'platform.clipboardRead',
          ['platform.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'platform.clipboardRead', async (input) => {
            const format = input.format ?? 'text';
            if (format !== 'text' && format !== 'image' && format !== 'files') {
              throw createError('CLIPBOARD_INVALID_FORMAT', `Unsupported clipboard format: ${input.format}`);
            }
            const data = await ctx.pal.systemUi.clipboard.read(format);
            state.clipboard = data;
            return { data };
          })
        )
      },
      clipboardWrite: {
        descriptor: descriptor<{ data: unknown; format?: string }, { ack: true }>(
          'platform.clipboardWrite',
          ['platform.read'],
          2_000,
          false,
          0,
          withMetrics(state, 'platform.clipboardWrite', async (input) => {
            const format = input.format ?? 'text';
            if (format === 'text' && typeof input.data !== 'string') {
              throw createError('CLIPBOARD_INVALID_PAYLOAD', 'platform.clipboardWrite requires string data when format=text');
            }
            if (format === 'image') {
              if (
                !input.data ||
                typeof input.data !== 'object' ||
                typeof (input.data as { base64?: unknown }).base64 !== 'string'
              ) {
                throw createError('CLIPBOARD_INVALID_PAYLOAD', 'platform.clipboardWrite requires { base64 } when format=image');
              }
            }
            if (format === 'files') {
              if (!Array.isArray(input.data) || input.data.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
                throw createError('CLIPBOARD_INVALID_PAYLOAD', 'platform.clipboardWrite requires string[] when format=files');
              }
            }
            if (format !== 'text' && format !== 'image' && format !== 'files') {
              throw createError('CLIPBOARD_INVALID_FORMAT', `Unsupported clipboard format: ${input.format}`);
            }
            await ctx.pal.systemUi.clipboard.write(input.data as never, format);
            state.clipboard = input.data;
            return { ack: true };
          })
        )
      },
      shellOpenPath: {
        descriptor: descriptor<{ path: string }, { ack: true }>(
          'platform.shellOpenPath',
          ['platform.external'],
          5_000,
          false,
          0,
          withMetrics(state, 'platform.shellOpenPath', async (input) => {
            await ctx.pal.transfer.openPath(input.path);
            return { ack: true };
          })
        )
      },
      shellOpenExternal: {
        descriptor: descriptor<{ url: string }, { ack: true }>(
          'platform.shellOpenExternal',
          ['platform.external'],
          8_000,
          false,
          0,
          withMetrics(state, 'platform.shellOpenExternal', async (input) => {
            await ctx.pal.transfer.openExternal(input.url);
            return { ack: true };
          })
        )
      },
      shellShowItemInFolder: {
        descriptor: descriptor<{ path: string }, { ack: true }>(
          'platform.shellShowItemInFolder',
          ['platform.external'],
          5_000,
          true,
          0,
          withMetrics(state, 'platform.shellShowItemInFolder', async (input) => {
            await ctx.pal.transfer.revealInShell(input.path);
            return { ack: true };
          })
        )
      },
      notificationShow: {
        descriptor: descriptor<{ options: { title: string; body: string; icon?: string; silent?: boolean } }, { ack: true }>(
          'platform.notificationShow',
          ['platform.read'],
          2_000,
          false,
          0,
          withMetrics(state, 'platform.notificationShow', async (input) => {
            if (typeof input.options.title !== 'string' || typeof input.options.body !== 'string') {
              throw createError('PLATFORM_NOTIFICATION_INVALID', 'platform.notificationShow requires title/body');
            }
            await ctx.pal.systemUi.notification.show(input.options);
            return { ack: true };
          })
        )
      },
      traySet: {
        descriptor: descriptor<{ options: { icon?: string; tooltip?: string; menu?: Array<{ id: string; label: string }> } }, { tray: unknown }>(
          'platform.traySet',
          ['platform.external'],
          3_000,
          false,
          0,
          withMetrics(state, 'platform.traySet', async (input) => {
            const tray = await ctx.pal.systemUi.tray.set(input.options ?? {});
            await ctx.kernel.events.emit('platform.tray.changed', 'platform-service', { tray });
            return { tray };
          })
        )
      },
      trayClear: {
        descriptor: descriptor<Record<string, unknown>, { ack: true }>(
          'platform.trayClear',
          ['platform.external'],
          3_000,
          false,
          0,
          withMetrics(state, 'platform.trayClear', async () => {
            await ctx.pal.systemUi.tray.clear();
            await ctx.kernel.events.emit('platform.tray.changed', 'platform-service', { tray: { active: false } });
            return { ack: true };
          })
        )
      },
      trayGetState: {
        descriptor: descriptor<Record<string, unknown>, { tray: unknown }>(
          'platform.trayGetState',
          ['platform.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'platform.trayGetState', async () => {
            const tray = await ctx.pal.systemUi.tray.getState();
            return { tray };
          })
        )
      },
      shortcutRegister: {
        descriptor: descriptor<{ accelerator: string; eventName?: string }, { registered: boolean }>(
          'platform.shortcutRegister',
          ['platform.external'],
          3_000,
          false,
          0,
          withMetrics(state, 'platform.shortcutRegister', async (input) => {
            if (typeof input.accelerator !== 'string' || input.accelerator.length === 0) {
              throw createError('PLATFORM_SHORTCUT_INVALID', 'platform.shortcutRegister requires accelerator');
            }
            const eventName = typeof input.eventName === 'string' && input.eventName.length > 0
              ? input.eventName
              : 'platform.shortcut.triggered';
            const registered = await ctx.pal.systemUi.shortcut.register(input.accelerator, () => {
              void ctx.kernel.events.emit(eventName, 'platform-shortcut', { accelerator: input.accelerator });
            });
            if (!registered) {
              throw createError('PLATFORM_SHORTCUT_REGISTER_FAILED', `Cannot register shortcut: ${input.accelerator}`);
            }
            return { registered: true };
          })
        )
      },
      shortcutUnregister: {
        descriptor: descriptor<{ accelerator: string }, { ack: true }>(
          'platform.shortcutUnregister',
          ['platform.external'],
          3_000,
          false,
          0,
          withMetrics(state, 'platform.shortcutUnregister', async (input) => {
            await ctx.pal.systemUi.shortcut.unregister(input.accelerator);
            return { ack: true };
          })
        )
      },
      shortcutIsRegistered: {
        descriptor: descriptor<{ accelerator: string }, { registered: boolean }>(
          'platform.shortcutIsRegistered',
          ['platform.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'platform.shortcutIsRegistered', async (input) => {
            const registered = await ctx.pal.systemUi.shortcut.isRegistered(input.accelerator);
            return { registered };
          })
        )
      },
      shortcutList: {
        descriptor: descriptor<Record<string, unknown>, { accelerators: string[] }>(
          'platform.shortcutList',
          ['platform.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'platform.shortcutList', async () => {
            const accelerators = await ctx.pal.systemUi.shortcut.list();
            return { accelerators };
          })
        )
      },
      shortcutClear: {
        descriptor: descriptor<Record<string, unknown>, { ack: true }>(
          'platform.shortcutClear',
          ['platform.external'],
          3_000,
          false,
          0,
          withMetrics(state, 'platform.shortcutClear', async () => {
            await ctx.pal.systemUi.shortcut.clear();
            return { ack: true };
          })
        )
      },
      powerGetState: {
        descriptor: descriptor<Record<string, unknown>, { state: unknown }>(
          'platform.powerGetState',
          ['platform.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'platform.powerGetState', async () => {
            const powerState = await ctx.pal.background.getState();
            return { state: powerState };
          })
        )
      },
      powerSetPreventSleep: {
        descriptor: descriptor<{ prevent: boolean }, { preventSleep: boolean }>(
          'platform.powerSetPreventSleep',
          ['platform.external'],
          2_000,
          false,
          0,
          withMetrics(state, 'platform.powerSetPreventSleep', async (input) => {
            const preventSleep = await ctx.pal.background.setPreventSleep(Boolean(input.prevent));
            return { preventSleep };
          })
        )
      },
      ipcCreateChannel: {
        descriptor: descriptor<{ name: string; transport: 'named-pipe' | 'unix-socket' | 'shared-memory'; maxBufferBytes?: number }, { channel: unknown }>(
          'platform.ipcCreateChannel',
          ['platform.external'],
          4_000,
          false,
          0,
          withMetrics(state, 'platform.ipcCreateChannel', async (input, routeContext) => {
            if (typeof input.name !== 'string' || input.name.trim().length === 0) {
              throw createError('PLATFORM_IPC_INVALID_CHANNEL', 'platform.ipcCreateChannel requires channel name');
            }
            if (input.transport !== 'named-pipe' && input.transport !== 'unix-socket' && input.transport !== 'shared-memory') {
              throw createError('PLATFORM_IPC_INVALID_TRANSPORT', `Unsupported IPC transport: ${String(input.transport)}`);
            }
            const channel = await ctx.pal.ipc.createChannel({
              name: input.name,
              transport: input.transport,
              maxBufferBytes: input.maxBufferBytes
            });
            ctx.logger.write({
              level: 'info',
              message: 'Platform IPC channel created',
              requestId: routeContext.requestId,
              pluginId: routeContext.caller.pluginId,
              namespace: 'platform',
              action: 'ipcCreateChannel',
              result: 'success',
              metadata: { channelId: channel.channelId, transport: channel.transport }
            });
            return { channel };
          })
        )
      },
      ipcSend: {
        descriptor: descriptor<{ channelId: string; payload: string; encoding?: 'utf8' | 'base64' }, { ack: true }>(
          'platform.ipcSend',
          ['platform.external'],
          4_000,
          false,
          0,
          withMetrics(state, 'platform.ipcSend', async (input, routeContext) => {
            if (typeof input.channelId !== 'string' || input.channelId.length === 0) {
              throw createError('PLATFORM_IPC_INVALID_CHANNEL', 'platform.ipcSend requires channelId');
            }
            if (typeof input.payload !== 'string') {
              throw createError('PLATFORM_IPC_INVALID_PAYLOAD', 'platform.ipcSend requires string payload');
            }
            const encoding = input.encoding === 'base64' ? 'base64' : 'utf8';
            const payload = encoding === 'base64' ? Buffer.from(input.payload, 'base64') : input.payload;
            await ctx.pal.ipc.send(input.channelId, payload);
            ctx.logger.write({
              level: 'info',
              message: 'Platform IPC payload sent',
              requestId: routeContext.requestId,
              pluginId: routeContext.caller.pluginId,
              namespace: 'platform',
              action: 'ipcSend',
              result: 'success',
              metadata: { channelId: input.channelId, bytes: Buffer.isBuffer(payload) ? payload.length : Buffer.byteLength(payload) }
            });
            return { ack: true };
          })
        )
      },
      ipcReceive: {
        descriptor: descriptor<{ channelId: string; timeoutMs?: number }, { message: unknown }>(
          'platform.ipcReceive',
          ['platform.read'],
          35_000,
          true,
          0,
          withMetrics(state, 'platform.ipcReceive', async (input) => {
            if (typeof input.channelId !== 'string' || input.channelId.length === 0) {
              throw createError('PLATFORM_IPC_INVALID_CHANNEL', 'platform.ipcReceive requires channelId');
            }
            const response = await ctx.pal.ipc.receive(input.channelId, {
              timeoutMs: input.timeoutMs
            });
            return {
              message: {
                channelId: response.channelId,
                transport: response.transport,
                payload: response.payload.toString('base64'),
                encoding: 'base64',
                receivedAt: response.receivedAt
              }
            };
          })
        )
      },
      ipcCloseChannel: {
        descriptor: descriptor<{ channelId: string }, { ack: true }>(
          'platform.ipcCloseChannel',
          ['platform.external'],
          4_000,
          false,
          0,
          withMetrics(state, 'platform.ipcCloseChannel', async (input, routeContext) => {
            if (typeof input.channelId !== 'string' || input.channelId.length === 0) {
              throw createError('PLATFORM_IPC_INVALID_CHANNEL', 'platform.ipcCloseChannel requires channelId');
            }
            await ctx.pal.ipc.closeChannel(input.channelId);
            ctx.logger.write({
              level: 'info',
              message: 'Platform IPC channel closed',
              requestId: routeContext.requestId,
              pluginId: routeContext.caller.pluginId,
              namespace: 'platform',
              action: 'ipcCloseChannel',
              result: 'success',
              metadata: { channelId: input.channelId }
            });
            return { ack: true };
          })
        )
      },
      ipcListChannels: {
        descriptor: descriptor<Record<string, unknown>, { channels: unknown[] }>(
          'platform.ipcListChannels',
          ['platform.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'platform.ipcListChannels', async () => {
            const channels = await ctx.pal.ipc.listChannels();
            return { channels };
          })
        )
      }
    }
  };

  const logService: ServiceRegistration = {
    name: 'log',
    actions: {
      write: {
        descriptor: descriptor<{ level: 'debug' | 'info' | 'warn' | 'error'; message: string; metadata?: Record<string, unknown> }, { entry: LogEntry }>(
          'log.write',
          ['log.write'],
          2_000,
          false,
          0,
          withMetrics(state, 'log.write', async (input, routeContext) => {
            const entry = ctx.logger.write({
              level: input.level,
              message: input.message,
              metadata: input.metadata,
              requestId: routeContext.requestId,
              pluginId: routeContext.caller.pluginId,
              namespace: 'log',
              action: 'write',
              result: 'success'
            });
            return { entry };
          })
        )
      },
      query: {
        descriptor: descriptor<{ level?: 'debug' | 'info' | 'warn' | 'error'; requestId?: string }, { entries: LogEntry[] }>(
          'log.query',
          ['log.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'log.query', async (input) => {
            const entries = ctx.logger.query({
              level: input.level,
              requestId: input.requestId
            });
            return { entries: toPlainLogEntries(entries) };
          })
        )
      },
      export: {
        descriptor: descriptor<Record<string, unknown>, { payload: string }>(
          'log.export',
          ['log.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'log.export', async () => {
            return { payload: ctx.logger.export() };
          })
        )
      }
    }
  };

  const credentialService: ServiceRegistration = {
    name: 'credential',
    actions: {
      get: {
        descriptor: descriptor<{ ref: string }, { value: string | null }>(
          'credential.get',
          ['credential.manage'],
          2_000,
          true,
          0,
          withMetrics(state, 'credential.get', async (input, routeContext) => {
            ctx.logger.write({
              level: 'info',
              message: 'Credential accessed',
              requestId: routeContext.requestId,
              pluginId: routeContext.caller.pluginId,
              namespace: 'credential',
              action: 'get',
              result: 'success'
            });
            const encrypted = state.credentials.get(input.ref);
            if (!encrypted) {
              return { value: null };
            }
            try {
              return { value: decryptCredential(credentialKey, encrypted) };
            } catch (error) {
              throw createError('CREDENTIAL_DECRYPT_FAILED', 'Credential decrypt failed', {
                ref: input.ref,
                reason: String(error)
              });
            }
          })
        )
      },
      set: {
        descriptor: descriptor<{ ref: string; value: string }, { ack: true }>(
          'credential.set',
          ['credential.manage'],
          2_000,
          false,
          0,
          withMetrics(state, 'credential.set', async (input, routeContext) => {
            state.credentials.set(input.ref, encryptCredential(credentialKey, input.value));
            await persistCredentials(ctx.workspacePath, state.credentials);
            ctx.logger.write({
              level: 'warn',
              message: 'Credential updated',
              requestId: routeContext.requestId,
              pluginId: routeContext.caller.pluginId,
              namespace: 'credential',
              action: 'set',
              result: 'success'
            });
            return { ack: true };
          })
        )
      },
      delete: {
        descriptor: descriptor<{ ref: string }, { ack: true }>(
          'credential.delete',
          ['credential.manage'],
          2_000,
          false,
          0,
          withMetrics(state, 'credential.delete', async (input, routeContext) => {
            state.credentials.delete(input.ref);
            await persistCredentials(ctx.workspacePath, state.credentials);
            ctx.logger.write({
              level: 'warn',
              message: 'Credential deleted',
              requestId: routeContext.requestId,
              pluginId: routeContext.caller.pluginId,
              namespace: 'credential',
              action: 'delete',
              result: 'success'
            });
            return { ack: true };
          })
        )
      },
      rotate: {
        descriptor: descriptor<{ ref: string }, { value: string }>(
          'credential.rotate',
          ['credential.manage'],
          2_000,
          false,
          0,
          withMetrics(state, 'credential.rotate', async (input, routeContext) => {
            const next = createId();
            state.credentials.set(input.ref, encryptCredential(credentialKey, next));
            await persistCredentials(ctx.workspacePath, state.credentials);
            ctx.logger.write({
              level: 'warn',
              message: 'Credential rotated',
              requestId: routeContext.requestId,
              pluginId: routeContext.caller.pluginId,
              namespace: 'credential',
              action: 'rotate',
              result: 'success'
            });
            return { value: next };
          })
        )
      }
    }
  };

  const cardService: ServiceRegistration = {
    name: 'card',
    actions: {
      pack: {
        descriptor: descriptor<{ cardDir: string; outputPath: string; entryPlan?: Array<{ path: string; modifiedTime?: number }> }, { cardFile: string }>(
          'card.pack',
          ['card.write'],
          12_000,
          false,
          0,
          withMetrics(state, 'card.pack', async (input) => {
            const cardFile = await ctx.getCardService().pack(input.cardDir, input.outputPath, {
              entryPlan: input.entryPlan
            });
            return { cardFile };
          })
        )
      },
      unpack: {
        descriptor: descriptor<{ cardFile: string; outputDir: string }, { outputDir: string }>(
          'card.unpack',
          ['card.read'],
          12_000,
          false,
          0,
          withMetrics(state, 'card.unpack', async (input) => {
            const outputDir = await ctx.getCardService().unpack(input.cardFile, input.outputDir);
            return { outputDir };
          })
        )
      },
      readMetadata: {
        descriptor: descriptor<{ cardFile: string }, { metadata: unknown }>(
          'card.readMetadata',
          ['card.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'card.readMetadata', async (input) => {
            const metadata = await ctx.getCardService().readMetadata(input.cardFile);
            return { metadata };
          })
        )
      },
      readInfo: {
        descriptor: descriptor<
          { cardFile: string; fields?: Array<'status' | 'metadata' | 'cover'> },
          { info: unknown }
        >(
          'card.readInfo',
          ['card.read'],
          10_000,
          true,
          0,
          withMetrics(state, 'card.readInfo', async (input) => {
            const info = await ctx.getCardInfoService().readInfo(input.cardFile, input.fields);
            return { info };
          })
        )
      },
      parse: {
        descriptor: descriptor<{ cardFile: string }, { ast: unknown }>(
          'card.parse',
          ['card.read'],
          10_000,
          true,
          0,
          withMetrics(state, 'card.parse', async (input) => {
            const ast = await ctx.getCardService().parse(input.cardFile);
            return { ast };
          })
        )
      },
      render: {
        descriptor: descriptor<
          {
            cardFile: string;
            options?: {
              target?: 'app-root' | 'card-iframe' | 'module-slot' | 'offscreen-render';
              mode?: 'view' | 'preview';
              interactionPolicy?: 'native' | 'delegate';
              viewport?: { width?: number; height?: number; scrollTop?: number; scrollLeft?: number };
              verifyConsistency?: boolean;
              themeId?: string;
              locale?: string;
            };
          },
          { view: unknown }
        >(
          'card.render',
          ['card.read'],
          10_000,
          false,
          0,
          withMetrics(state, 'card.render', async (input) => {
            const themeContext = resolveRenderThemeContext(state, input.options?.themeId ? [input.options.themeId] : []);
            const locale = input.options?.locale ?? state.locale;
            if (!state.locales[locale]) {
              throw createError('I18N_LOCALE_NOT_FOUND', `Locale not found: ${locale}`, { locale });
            }
            const view = await ctx.getCardService().render(input.cardFile, {
              ...input.options,
              locale,
              theme: themeContext.renderTheme,
              themeCssText: themeContext.css
            });
            return { view };
          })
        )
      },
      renderCover: {
        descriptor: descriptor<
          { cardFile: string },
          { view: unknown }
        >(
          'card.renderCover',
          ['card.read'],
          10_000,
          false,
          0,
          withMetrics(state, 'card.renderCover', async (input) => {
            const view = await ctx.getCardService().renderCover(input.cardFile);
            return { view };
          })
        )
      },
      renderEditor: {
        descriptor: descriptor<
          {
            cardType: string;
            initialConfig?: Record<string, unknown>;
            baseCardId?: string;
          },
          { view: unknown }
        >(
          'card.renderEditor',
          ['card.write'],
          10_000,
          false,
          0,
          withMetrics(state, 'card.renderEditor', async (input) => {
            const themeContext = resolveRenderThemeContext(state, []);
            const view = await ctx.getCardService().renderEditor({
              cardType: input.cardType,
              initialConfig: input.initialConfig,
              baseCardId: input.baseCardId,
              theme: themeContext.renderTheme,
              themeCssText: themeContext.css
            });
            return { view };
          })
        )
      },
      releaseRenderSession: {
        descriptor: descriptor<
          { sessionId: string },
          { ack: true }
        >(
          'card.releaseRenderSession',
          ['card.read'],
          10_000,
          false,
          0,
          withMetrics(state, 'card.releaseRenderSession', async (input) => {
            await ctx.getCardService().releaseRenderSession(input.sessionId);
            return { ack: true };
          })
        )
      },
      resolveDocumentPath: {
        descriptor: descriptor<
          { documentUrl: string },
          { path: string }
        >(
          'card.resolveDocumentPath',
          ['card.read'],
          10_000,
          false,
          0,
          withMetrics(state, 'card.resolveDocumentPath', async (input) => {
            const resolvedPath = ctx.getCardService().resolveDocumentFilePath(input.documentUrl);
            if (!resolvedPath) {
              throw createError('CARD_RENDER_DOCUMENT_NOT_FOUND', `Unable to resolve rendered document url: ${input.documentUrl}`, {
                documentUrl: input.documentUrl,
              });
            }
            return { path: resolvedPath };
          })
        )
      },
      resolveResourceUrl: {
        descriptor: descriptor<
          { cardRootDir: string; resourcePath: string },
          { uri: string }
        >(
          'card.resolveResourceUrl',
          ['card.read'],
          5_000,
          true,
          0,
          withMetrics(state, 'card.resolveResourceUrl', async (input) => {
            const normalizedRootDir = path.resolve(input.cardRootDir);
            const uri = ctx.getCardService().resolveCardRootResourceUrl(normalizedRootDir, input.resourcePath);
            return { uri };
          })
        )
      },
      validate: {
        descriptor: descriptor<{ cardFile: string }, { valid: boolean; errors: string[] }>(
          'card.validate',
          ['card.read'],
          10_000,
          true,
          0,
          withMetrics(state, 'card.validate', async (input) => {
            const result = await ctx.getCardService().validate(input.cardFile);
            return result;
          })
        )
      },
      open: {
        descriptor: descriptor<{ cardFile: string }, { result: unknown }>(
          'card.open',
          ['card.read'],
          10_000,
          false,
          0,
          withMetrics(state, 'card.open', async (input) => {
            const result = await createCardOpenService(ctx, state).openCard(input.cardFile);
            return { result };
          })
        )
      }
    }
  };

  const boxService: ServiceRegistration = {
    name: 'box',
    actions: {
      pack: {
        descriptor: descriptor<{ boxDir: string; outputPath: string }, { boxFile: string }>(
          'box.pack',
          ['box.write'],
          12_000,
          false,
          0,
          withMetrics(state, 'box.pack', async (input) => {
            const boxFile = await ctx.getBoxService().pack(input.boxDir, input.outputPath);
            return { boxFile };
          })
        )
      },
      unpack: {
        descriptor: descriptor<{ boxFile: string; outputDir: string }, { outputDir: string }>(
          'box.unpack',
          ['box.write'],
          12_000,
          false,
          0,
          withMetrics(state, 'box.unpack', async (input) => {
            const outputDir = await ctx.getBoxService().unpack(input.boxFile, input.outputDir);
            return { outputDir };
          })
        )
      },
      inspect: {
        descriptor: descriptor<{ boxFile: string }, { inspection: unknown }>(
          'box.inspect',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.inspect', async (input) => {
            const inspection = await ctx.getBoxService().inspect(input.boxFile);
            return { inspection };
          })
        )
      },
      validate: {
        descriptor: descriptor<{ boxFile: string }, { validationResult: unknown }>(
          'box.validate',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.validate', async (input) => {
            const validationResult = await ctx.getBoxService().validate(input.boxFile);
            return { validationResult };
          })
        )
      },
      readMetadata: {
        descriptor: descriptor<{ boxFile: string }, { metadata: unknown }>(
          'box.readMetadata',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.readMetadata', async (input) => {
            const metadata = await ctx.getBoxService().readMetadata(input.boxFile);
            return { metadata };
          })
        )
      },
      listLayoutDescriptors: {
        descriptor: descriptor<undefined, { descriptors: unknown }>(
          'box.listLayoutDescriptors',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.listLayoutDescriptors', async () => {
            const descriptors = await ctx.getBoxService().listLayoutDescriptors();
            return { descriptors };
          })
        )
      },
      readLayoutDescriptor: {
        descriptor: descriptor<{ layoutType: string }, { descriptor: unknown }>(
          'box.readLayoutDescriptor',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.readLayoutDescriptor', async (input) => {
            const descriptor = await ctx.getBoxService().readLayoutDescriptor(input.layoutType);
            return { descriptor };
          })
        )
      },
      normalizeLayoutConfig: {
        descriptor: descriptor<{ layoutType: string; config: Record<string, unknown> }, { config: unknown }>(
          'box.normalizeLayoutConfig',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.normalizeLayoutConfig', async (input) => {
            const config = await ctx.getBoxService().normalizeLayoutConfig(input.layoutType, input.config ?? {});
            return { config };
          })
        )
      },
      validateLayoutConfig: {
        descriptor: descriptor<{ layoutType: string; config: Record<string, unknown> }, { validation: unknown }>(
          'box.validateLayoutConfig',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.validateLayoutConfig', async (input) => {
            const validation = await ctx.getBoxService().validateLayoutConfig(input.layoutType, input.config ?? {});
            return { validation };
          })
        )
      },
      getLayoutInitialQuery: {
        descriptor: descriptor<{ layoutType: string; config: Record<string, unknown> }, { query?: unknown }>(
          'box.getLayoutInitialQuery',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.getLayoutInitialQuery', async (input) => {
            const query = await ctx.getBoxService().getLayoutInitialQuery(input.layoutType, input.config ?? {});
            return { query };
          })
        )
      },
      renderLayoutFrame: {
        descriptor: descriptor<
          {
            layoutType: string;
            sessionId: string;
            box: unknown;
            initialView: unknown;
            config: Record<string, unknown>;
            locale?: string;
            themeId?: string;
          },
          { view: unknown }
        >(
          'box.renderLayoutFrame',
          ['box.read'],
          10_000,
          false,
          0,
          withMetrics(state, 'box.renderLayoutFrame', async (input) => {
            const themeContext = resolveRenderThemeContext(state, input.themeId ? [input.themeId] : []);
            const locale = input.locale ?? state.locale;
            if (!state.locales[locale]) {
              throw createError('I18N_LOCALE_NOT_FOUND', `Locale not found: ${locale}`, { locale });
            }
            const view = await ctx.getBoxService().renderLayoutFrame({
              layoutType: input.layoutType,
              sessionId: input.sessionId,
              box: input.box as never,
              initialView: input.initialView as never,
              config: input.config ?? {},
              locale,
              theme: themeContext.renderTheme,
              themeCssText: themeContext.css,
            });
            return { view };
          })
        )
      },
      renderLayoutEditor: {
        descriptor: descriptor<
          {
            layoutType: string;
            entries: unknown[];
            initialConfig: Record<string, unknown>;
            locale?: string;
            themeId?: string;
          },
          { view: unknown }
        >(
          'box.renderLayoutEditor',
          ['box.write'],
          10_000,
          false,
          0,
          withMetrics(state, 'box.renderLayoutEditor', async (input) => {
            const themeContext = resolveRenderThemeContext(state, input.themeId ? [input.themeId] : []);
            const locale = input.locale ?? state.locale;
            if (!state.locales[locale]) {
              throw createError('I18N_LOCALE_NOT_FOUND', `Locale not found: ${locale}`, { locale });
            }
            const view = await ctx.getBoxService().renderLayoutEditor({
              layoutType: input.layoutType,
              entries: input.entries as never,
              initialConfig: input.initialConfig ?? {},
              locale,
              theme: themeContext.renderTheme,
              themeCssText: themeContext.css,
            });
            return { view };
          })
        )
      },
      releaseRenderSession: {
        descriptor: descriptor<{ sessionId: string }, { ack: true }>(
          'box.releaseRenderSession',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.releaseRenderSession', async (input) => {
            await ctx.getBoxService().releaseRenderSession(input.sessionId);
            return { ack: true };
          })
        )
      },
      openView: {
        descriptor: descriptor<
          { boxFile: string; layoutType?: string; initialQuery?: Record<string, unknown> },
          { sessionId: string; box: unknown; initialView: unknown }
        >(
          'box.openView',
          ['box.read'],
          12_000,
          false,
          0,
          withMetrics(state, 'box.openView', async (input, routeContext) => {
            const opened = await ctx.getBoxService().openView(input.boxFile, {
              ownerKey: resolveBoxSessionOwnerKey(routeContext),
              layoutType: typeof input.layoutType === 'string' ? input.layoutType : undefined,
              initialQuery: input.initialQuery as never
            });
            await ctx.kernel.events.emit('box.session.updated', 'box-service', {
              sessionId: opened.sessionId,
              boxId: opened.box.boxId,
              boxFile: opened.box.boxFile,
              activeLayoutType: opened.box.activeLayoutType,
              state: 'opened'
            });
            return opened;
          })
        )
      },
      listEntries: {
        descriptor: descriptor<{ sessionId: string; query?: Record<string, unknown> }, { page: unknown }>(
          'box.listEntries',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.listEntries', async (input, routeContext) => {
            const page = await ctx.getBoxService().listEntries(
              input.sessionId,
              resolveBoxSessionOwnerKey(routeContext),
              input.query as never
            );
            return { page };
          })
        )
      },
      readEntryDetail: {
        descriptor: descriptor<
          { sessionId: string; entryIds: string[]; fields: Array<'documentInfo' | 'coverDescriptor' | 'previewDescriptor' | 'runtimeProps' | 'status'> },
          { items: unknown }
        >(
          'box.readEntryDetail',
          ['box.read'],
          10_000,
          true,
          0,
          withMetrics(state, 'box.readEntryDetail', async (input, routeContext) => {
            const result = await ctx.getBoxService().readEntryDetail(input.sessionId, input.entryIds, input.fields, {
              ownerKey: resolveBoxSessionOwnerKey(routeContext),
              readCardInfo: (cardFile, fields) => ctx.getCardInfoService().readInfo(cardFile, fields)
            });
            return result;
          })
        )
      },
      renderEntryCover: {
        descriptor: descriptor<{ sessionId: string; entryId: string }, { view: unknown }>(
          'box.renderEntryCover',
          ['box.read'],
          10_000,
          true,
          0,
          withMetrics(state, 'box.renderEntryCover', async (input, routeContext) => {
            const view = await ctx.getBoxService().renderEntryCover(input.sessionId, input.entryId, {
              ownerKey: resolveBoxSessionOwnerKey(routeContext),
              readCardInfo: (cardFile, fields) => ctx.getCardInfoService().readInfo(cardFile, fields)
            });
            return { view };
          })
        )
      },
      renderEntryDocument: {
        descriptor: descriptor<
          {
            sessionId: string;
            entryId: string;
            options?: {
              mode?: 'view' | 'preview';
              interactionPolicy?: 'native' | 'delegate';
              locale?: string;
              themeId?: string;
            };
          },
          { view: unknown }
        >(
          'box.renderEntryDocument',
          ['box.read'],
          12_000,
          false,
          0,
          withMetrics(state, 'box.renderEntryDocument', async (input, routeContext) => {
            const themeContext = resolveRenderThemeContext(
              state,
              input.options?.themeId ? [input.options.themeId] : []
            );
            const locale = input.options?.locale ?? state.locale;
            if (!state.locales[locale]) {
              throw createError('I18N_LOCALE_NOT_FOUND', `Locale not found: ${locale}`, { locale });
            }
            const view = await ctx.getBoxService().renderEntryDocument(input.sessionId, input.entryId, {
              ownerKey: resolveBoxSessionOwnerKey(routeContext),
              mode: input.options?.mode,
              interactionPolicy: input.options?.interactionPolicy,
              renderCardFile: (cardFile, renderOptions) => ctx.getCardService().render(cardFile, {
                target: 'card-iframe',
                mode: renderOptions.mode,
                interactionPolicy: renderOptions.interactionPolicy,
                locale,
                theme: themeContext.renderTheme,
                themeCssText: themeContext.css
              })
            });
            return { view };
          })
        )
      },
      releaseEntryDocument: {
        descriptor: descriptor<{ sessionId: string; renderSessionId: string }, { ack: true }>(
          'box.releaseEntryDocument',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.releaseEntryDocument', async (input, routeContext) => {
            return ctx.getBoxService().releaseEntryDocument(input.sessionId, input.renderSessionId, {
              ownerKey: resolveBoxSessionOwnerKey(routeContext),
              releaseCardRenderSession: (renderSessionId) => ctx.getCardService().releaseRenderSession(renderSessionId)
            });
          })
        )
      },
      renderCover: {
        descriptor: descriptor<{ boxFile: string }, { view: unknown }>(
          'box.renderCover',
          ['box.read'],
          10_000,
          true,
          0,
          withMetrics(state, 'box.renderCover', async (input) => {
            const view = await ctx.getBoxService().renderCover(input.boxFile);
            return { view };
          })
        )
      },
      resolveEntryResource: {
        descriptor: descriptor<
          {
            sessionId: string;
            entryId: string;
            resource: {
              kind: 'cover' | 'preview' | 'documentFile' | 'custom';
              key?: string;
              sizeHint?: {
                width?: number;
                height?: number;
              };
            };
          },
          { resource: unknown }
        >(
          'box.resolveEntryResource',
          ['box.read'],
          12_000,
          true,
          0,
          withMetrics(state, 'box.resolveEntryResource', async (input, routeContext) => {
            const resource = await ctx.getBoxService().resolveEntryResource(input.sessionId, input.entryId, input.resource, {
              ownerKey: resolveBoxSessionOwnerKey(routeContext),
              readCardInfo: (cardFile, fields) => ctx.getCardInfoService().readInfo(cardFile, fields)
            });
            return { resource };
          })
        )
      },
      openEntry: {
        descriptor: descriptor<{ sessionId: string; entryId: string }, { result: unknown }>(
          'box.openEntry',
          ['box.read'],
          10_000,
          false,
          0,
          withMetrics(state, 'box.openEntry', async (input, routeContext) => {
            const result = await ctx.getBoxService().openEntry(input.sessionId, input.entryId, {
              ownerKey: resolveBoxSessionOwnerKey(routeContext),
              openCardFile: async (cardFile) => {
                const result = await createCardOpenService(ctx, state).openCard(cardFile);
                return {
                  mode: 'document-window',
                  documentType: 'card' as const,
                  windowId: result.windowId,
                  pluginId: result.pluginId,
                };
              },
              openBoxFile: (boxFile) => openBoxDocument(ctx, state, boxFile),
              openExternalUrl: (url) => ctx.pal.transfer.openExternal(url)
            });
            return { result };
          })
        )
      },
      readBoxAsset: {
        descriptor: descriptor<{ sessionId: string; assetPath: string }, { resource: unknown }>(
          'box.readBoxAsset',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.readBoxAsset', async (input, routeContext) => {
            const resource = await ctx.getBoxService().readBoxAsset(
              input.sessionId,
              input.assetPath,
              resolveBoxSessionOwnerKey(routeContext)
            );
            return { resource };
          })
        )
      },
      prefetchEntries: {
        descriptor: descriptor<
          { sessionId: string; entryIds: string[]; targets: Array<'cover' | 'preview' | 'documentInfo'> },
          { ack: true }
        >(
          'box.prefetchEntries',
          ['box.read'],
          12_000,
          false,
          0,
          withMetrics(state, 'box.prefetchEntries', async (input, routeContext) => {
            return ctx.getBoxService().prefetchEntries(input.sessionId, input.entryIds, input.targets, {
              ownerKey: resolveBoxSessionOwnerKey(routeContext),
              readCardInfo: (cardFile, fields) => ctx.getCardInfoService().readInfo(cardFile, fields)
            });
          })
        )
      },
      closeView: {
        descriptor: descriptor<{ sessionId: string }, { ack: true }>(
          'box.closeView',
          ['box.read'],
          8_000,
          true,
          0,
          withMetrics(state, 'box.closeView', async (input, routeContext) => {
            const result = await ctx.getBoxService().closeView(
              input.sessionId,
              resolveBoxSessionOwnerKey(routeContext),
              {
                releaseCardRenderSession: (renderSessionId) => ctx.getCardService().releaseRenderSession(renderSessionId)
              }
            );
            await ctx.kernel.events.emit('box.session.closed', 'box-service', {
              sessionId: input.sessionId
            });
            return result;
          })
        )
      }
    }
  };

  const zipService: ServiceRegistration = {
    name: 'zip',
    actions: {
      compress: {
        descriptor: descriptor<{ inputDir: string; outputZip: string; entryPlan?: Array<{ path: string; modifiedTime?: number }> }, { outputZip: string }>(
          'zip.compress',
          ['zip.manage'],
          12_000,
          false,
          0,
          withMetrics(state, 'zip.compress', async (input) => {
            await ctx.getZipService().compress(input.inputDir, input.outputZip, {
              entryPlan: input.entryPlan
            });
            return { outputZip: input.outputZip };
          })
        )
      },
      extract: {
        descriptor: descriptor<{ zipPath: string; outputDir: string }, { outputDir: string }>(
          'zip.extract',
          ['zip.manage'],
          12_000,
          false,
          0,
          withMetrics(state, 'zip.extract', async (input) => {
            await ctx.getZipService().extract(input.zipPath, input.outputDir);
            return { outputDir: input.outputDir };
          })
        )
      },
      list: {
        descriptor: descriptor<{ zipPath: string }, { entries: unknown }>(
          'zip.list',
          ['zip.manage'],
          5_000,
          true,
          0,
          withMetrics(state, 'zip.list', async (input) => {
            const entries = await ctx.getZipService().list(input.zipPath);
            return { entries };
          })
        )
      }
    }
  };

  const serializerService: ServiceRegistration = {
    name: 'serializer',
    actions: {
      encode: {
        descriptor: descriptor<{ payload: unknown }, { payload: string }>(
          'serializer.encode',
          ['serializer.use'],
          2_000,
          true,
          0,
          withMetrics(state, 'serializer.encode', async (input) => {
            return { payload: Buffer.from(JSON.stringify(input.payload)).toString('base64') };
          })
        )
      },
      decode: {
        descriptor: descriptor<{ payload: string }, { payload: unknown }>(
          'serializer.decode',
          ['serializer.use'],
          2_000,
          true,
          0,
          withMetrics(state, 'serializer.decode', async (input) => {
            const raw = Buffer.from(input.payload, 'base64').toString('utf-8');
            return { payload: JSON.parse(raw) };
          })
        )
      },
      validate: {
        descriptor: descriptor<{ payload: unknown; schema: string }, { valid: boolean }>(
          'serializer.validate',
          ['serializer.use'],
          2_000,
          true,
          0,
          withMetrics(state, 'serializer.validate', async (input) => {
            if (typeof input.schema !== 'string' || input.schema.trim().length === 0) {
              return { valid: false };
            }

            const schemaId = input.schema.trim();

            if (!schemaRegistry.has(schemaId)) {
              return { valid: false };
            }

            try {
              schemaRegistry.validate(schemaId, input.payload);
              return { valid: true };
            } catch {
              return { valid: false };
            }
          })
        )
      }
    }
  };

  const controlPlaneService: ServiceRegistration = {
    name: 'control-plane',
    actions: {
      health: {
        descriptor: descriptor<Record<string, unknown>, { status: 'ok'; report: unknown }>(
          'control-plane.health',
          ['control.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'control-plane.health', async () => {
            return {
              status: 'ok',
              report: ctx.kernel.getHealthReport()
            };
          })
        )
      },
      check: {
        descriptor: descriptor<Record<string, unknown>, { services: unknown }>(
          'control-plane.check',
          ['control.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'control-plane.check', async () => {
            return { services: ctx.kernel.registry.list() };
          })
        )
      },
      metrics: {
        descriptor: descriptor<Record<string, unknown>, { metrics: Record<string, { count: number; failures: number; p50: number; p95: number }> }>(
          'control-plane.metrics',
          ['control.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'control-plane.metrics', async () => {
            return {
              metrics: Object.fromEntries(
                [...state.routeMetrics.entries()].map(([route, metric]) => [
                  route,
                  {
                    count: metric.count,
                    failures: metric.failures,
                    p50: percentile(metric.latencies, 50),
                    p95: percentile(metric.latencies, 95)
                  }
                ])
              )
            };
          })
        )
      },
      diagnose: {
        descriptor: descriptor<Record<string, unknown>, { diagnose: unknown }>(
          'control-plane.diagnose',
          ['control.write'],
          3_000,
          true,
          0,
          withMetrics(state, 'control-plane.diagnose', async () => {
            return {
              diagnose: {
                routeCount: ctx.kernel.getRouteManifest().length,
                serviceCount: ctx.kernel.registry.list().length,
                config: resolveConfigSnapshot(state),
                runtimeSnapshot: ctx.runtime.snapshot(),
                topFailureRoutes: [...state.routeMetrics.entries()]
                  .sort((a, b) => b[1].failures - a[1].failures)
                  .slice(0, 5)
              }
            };
          })
        )
      }
    }
  };

  const rawServices = [
    fileService,
    resourceService,
    configService,
    themeService,
    i18nService,
    commandService,
    surfaceService,
    transferService,
    associationService,
    windowService,
    pluginService,
    cliCommandService,
    cliTaskService,
    moduleService,
    platformService,
    logService,
    credentialService,
    cardService,
    boxService,
    zipService,
    serializerService,
    controlPlaneService
  ];

  return rawServices.map((service) => bindLazyActivation(ctx, state, service));
};

export const registerHostServices = async (ctx: HostServiceContext): Promise<void> => {
  await ensureWorkspace(ctx.workspacePath);

  const runtimeState = buildState();
  await loadConfig(ctx.workspacePath, runtimeState);
  await loadCredentials(ctx.workspacePath, runtimeState);
  runtimeState.themes = await loadInstalledThemes(ctx.runtime);
  syncCurrentThemeState(runtimeState);
  await syncModuleProviders(ctx, runtimeState);

  const services = createServices(ctx, runtimeState);
  for (const service of services) {
    ctx.kernel.registerService(service);
  }
};
