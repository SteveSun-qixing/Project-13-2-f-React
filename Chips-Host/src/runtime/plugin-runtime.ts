import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StoreZipService } from '../../packages/zip-service/src';
import { parseHandlerCapability } from '../../packages/resource-open-service/src';
import { createError } from '../shared/errors';
import type { PluginRuntimeTargetId, PluginUiConfig } from '../shared/window-chrome';
import { parsePluginUiConfig } from '../shared/window-chrome';
import { parseYamlLite } from '../shared/yaml-lite';
import { createId, deepClone, now } from '../shared/utils';

export type PluginType = 'app' | 'card' | 'layout' | 'module' | 'theme';

export type PluginEntry = string | Record<string, string>;

export interface ThemePluginManifestMeta {
  themeId: string;
  displayName: string;
  publisher?: string;
  parentTheme?: string;
  isDefault: boolean;
  tokensPath: string;
  themeCssPath: string;
  contractPath?: string;
}

export interface LayoutPluginManifestMeta {
  layoutType?: string;
  displayName: string;
}

export type ModuleMethodMode = 'sync' | 'job';

export interface ModuleMethodManifestMeta {
  name: string;
  mode: ModuleMethodMode;
  inputSchema?: string;
  outputSchema?: string;
  description?: string;
}

export interface ModuleProviderManifestMeta {
  capability: string;
  version: string;
  description?: string;
  methods: ModuleMethodManifestMeta[];
}

export interface ModuleConsumeManifestMeta {
  capability: string;
  versionRange?: string;
}

export interface ModulePluginManifestMeta {
  apiVersion: number;
  runtime: 'worker';
  activation: 'onDemand' | 'eager';
  provides: ModuleProviderManifestMeta[];
  consumes: ModuleConsumeManifestMeta[];
}

export type CliCommandTargetType = 'app' | 'module';
export type CliCommandParameterType =
  | 'string'
  | 'stringList'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'path'
  | 'json'
  | 'jsonFile'
  | 'text'
  | 'textFile';

export type CliCommandUiControl =
  | 'select'
  | 'multiSelect'
  | 'toggle'
  | 'stepper'
  | 'slider'
  | 'pathInput'
  | 'pasteBox'
  | 'textarea';

export type CliCommandPathKind = 'file' | 'directory' | 'any';
export type CliCommandPathRole = 'input' | 'output';
export type CliCommandOverwritePolicy = 'fail' | 'overwrite' | 'rename' | 'skip';
export type CliCommandBatchFormat = 'lines' | 'json-array';
export type CliCommandBatchItemType = 'value' | 'path';
export type CliCommandBatchExecutionMode = 'aggregate' | 'itemized';
export type CliCommandOutputMode = 'human' | 'json';
export type CliCommandJsonOutputPolicy = 'supported' | 'required' | 'unsupported';
export type CliCommandSurfaceReusePolicy = 'always' | 'never' | 'preferred';

export interface CliCommandPathRuleManifestMeta {
  kind?: CliCommandPathKind;
  role?: CliCommandPathRole;
  exists?: boolean;
  create?: boolean;
  extensions?: string[];
  overwrite?: CliCommandOverwritePolicy;
}

export interface CliCommandBatchItemPathRuleManifestMeta {
  kind?: CliCommandPathKind;
  exists?: boolean;
  create?: boolean;
  extensions?: string[];
}

export interface CliCommandBatchManifestMeta {
  format: CliCommandBatchFormat;
  itemType?: CliCommandBatchItemType;
  itemPath?: CliCommandBatchItemPathRuleManifestMeta;
  execution?: CliCommandBatchExecutionMode;
}

export interface CliCommandUiManifestMeta {
  control?: CliCommandUiControl;
  choices?: unknown[];
  min?: number;
  max?: number;
  step?: number;
  placeholderKey?: string;
}

export interface CliCommandValidationManifestMeta {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface CliCommandParameterManifestMeta {
  name: string;
  short?: string;
  position?: number;
  type: CliCommandParameterType;
  required?: boolean;
  default?: unknown;
  mapsTo?: string;
  choices?: unknown[];
  multiple?: boolean;
  validation?: CliCommandValidationManifestMeta;
  path?: CliCommandPathRuleManifestMeta;
  batch?: CliCommandBatchManifestMeta;
  ui?: CliCommandUiManifestMeta;
}

export interface CliCommandModuleTargetManifestMeta {
  type: 'module';
  capability: string;
  method: string;
  pluginId?: string;
  timeoutMs?: number;
}

export interface CliCommandAppTargetManifestMeta {
  type: 'app';
  pluginId: string;
  commandId?: string;
  launchParams?: Record<string, unknown>;
  surface?: {
    open?: boolean;
    focus?: boolean;
    reuse?: CliCommandSurfaceReusePolicy;
  };
}

export type CliCommandTargetManifestMeta =
  | CliCommandModuleTargetManifestMeta
  | CliCommandAppTargetManifestMeta;

export interface CliCommandOutputManifestMeta {
  mode?: CliCommandOutputMode;
  json?: CliCommandJsonOutputPolicy;
  artifacts?: string[];
}

export interface CliCommandJobManifestMeta {
  wait?: boolean;
  cancelOnInterrupt?: boolean;
}

export interface CliCommandConflictManifestMeta {
  priority?: number;
  namespace?: string;
}

export interface CliCommandManifestMeta {
  commandId: string;
  commandPath: string[];
  target: CliCommandTargetManifestMeta;
  titleKey: string;
  descriptionKey?: string;
  examples: string[];
  permissions: string[];
  arguments: CliCommandParameterManifestMeta[];
  options: CliCommandParameterManifestMeta[];
  output?: CliCommandOutputManifestMeta;
  job?: CliCommandJobManifestMeta;
  conflict?: CliCommandConflictManifestMeta;
}

export interface CliManifestMeta {
  commands: CliCommandManifestMeta[];
}

export interface PluginRuntimeTargetManifestMeta {
  supported: boolean;
}

export interface PluginRuntimeManifestMeta {
  targets: Record<PluginRuntimeTargetId, PluginRuntimeTargetManifestMeta>;
}

export type PluginCapabilityFallbackBehavior = 'reject' | 'download' | 'share' | 'openExternal';

export interface PluginCapabilityFallbackManifestMeta {
  whenUnsupported: PluginCapabilityFallbackBehavior;
}

export interface PluginManifest {
  id: string;
  version: string;
  type: PluginType;
  name: string;
  description?: string;
  permissions: string[];
  capabilities?: string[];
  entry?: PluginEntry;
  assets?: string[];
  source?: 'official' | 'third-party' | 'local';
  signature?: string;
  ui?: PluginUiConfig;
  runtime?: PluginRuntimeManifestMeta;
  capabilityFallbacks?: Record<string, PluginCapabilityFallbackManifestMeta>;
  theme?: ThemePluginManifestMeta;
  layout?: LayoutPluginManifestMeta;
  module?: ModulePluginManifestMeta;
  cli?: CliManifestMeta;
}

export interface PluginRecord {
  manifest: PluginManifest;
  manifestPath: string;
  installPath: string;
  enabled: boolean;
  installedAt: number;
}

export interface PluginSession {
  sessionId: string;
  pluginId: string;
  pluginType: PluginType;
  permissions: string[];
  locale: string;
  themeId: string;
  launchParams: Record<string, unknown>;
  sessionNonce: string;
  startedAt: number;
  status: 'handshaking' | 'running' | 'stopped';
}

export interface ResolvedBridgeScope {
  callerId: string;
  pluginId: string;
  sessionId: string;
  permissions: string[];
}

export interface RuntimeQuota {
  cpuBudget: number;
  memoryBudgetMb: number;
  messageRateBudget: number;
}

export interface RuntimeSnapshot {
  plugins: PluginRecord[];
  sessions: PluginSession[];
  audits: RuntimeAuditEntry[];
}

export interface RuntimeAuditEntry {
  id: string;
  timestamp: number;
  stage: string;
  result: 'success' | 'error';
  pluginId?: string;
  sessionId?: string;
  details?: Record<string, unknown>;
}

const defaultQuota: RuntimeQuota = {
  cpuBudget: 100,
  memoryBudgetMb: 512,
  messageRateBudget: 1000
};

const pluginTypes: PluginType[] = ['app', 'card', 'layout', 'module', 'theme'];
const pluginSources = ['official', 'third-party', 'local'] as const;
const runtimeTargetIds: PluginRuntimeTargetId[] = ['desktop', 'web', 'mobile', 'headless'];
const capabilityFallbackBehaviors: PluginCapabilityFallbackBehavior[] = ['reject', 'download', 'share', 'openExternal'];
const cliCommandTargetTypes: CliCommandTargetType[] = ['app', 'module'];
const cliCommandParameterTypes: CliCommandParameterType[] = [
  'string',
  'stringList',
  'number',
  'integer',
  'boolean',
  'enum',
  'path',
  'json',
  'jsonFile',
  'text',
  'textFile'
];
const cliCommandUiControls: CliCommandUiControl[] = [
  'select',
  'multiSelect',
  'toggle',
  'stepper',
  'slider',
  'pathInput',
  'pasteBox',
  'textarea'
];
const cliCommandPathKinds: CliCommandPathKind[] = ['file', 'directory', 'any'];
const cliCommandPathRoles: CliCommandPathRole[] = ['input', 'output'];
const cliCommandOverwritePolicies: CliCommandOverwritePolicy[] = ['fail', 'overwrite', 'rename', 'skip'];
const cliCommandBatchFormats: CliCommandBatchFormat[] = ['lines', 'json-array'];
const cliCommandBatchItemTypes: CliCommandBatchItemType[] = ['value', 'path'];
const cliCommandBatchExecutionModes: CliCommandBatchExecutionMode[] = ['aggregate', 'itemized'];
const cliCommandOutputModes: CliCommandOutputMode[] = ['human', 'json'];
const cliCommandJsonOutputPolicies: CliCommandJsonOutputPolicy[] = ['supported', 'required', 'unsupported'];
const cliCommandSurfaceReusePolicies: CliCommandSurfaceReusePolicy[] = ['always', 'never', 'preferred'];
const hostFixedCliCommandRoots = new Set([
  'help',
  'host',
  'start',
  'stop',
  'status',
  'config',
  'logs',
  'theme',
  'plugin',
  'update',
  'doctor',
  'open',
  'completion'
]);
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const CLI_COMMAND_PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;
const CLI_COMMAND_PARAM_NAME_PATTERN = /^[a-z][a-z0-9-]*$/i;
const CLI_COMMAND_MAPS_TO_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;

const typeExclusiveManifestFields: Array<{ field: string; ownerType: PluginType }> = [
  { field: 'module', ownerType: 'module' },
  { field: 'layout', ownerType: 'layout' },
  { field: 'theme', ownerType: 'theme' },
  { field: 'themeId', ownerType: 'theme' },
  { field: 'displayName', ownerType: 'theme' },
  { field: 'isDefault', ownerType: 'theme' },
  { field: 'parentTheme', ownerType: 'theme' }
];

const hasPluginType = (value: string): value is PluginType => pluginTypes.includes(value as PluginType);
const hasPluginSource = (value: string): value is (typeof pluginSources)[number] =>
  pluginSources.includes(value as (typeof pluginSources)[number]);
const hasCapabilityFallbackBehavior = (value: string): value is PluginCapabilityFallbackBehavior =>
  capabilityFallbackBehaviors.includes(value as PluginCapabilityFallbackBehavior);
const hasCliCommandTargetType = (value: string): value is CliCommandTargetType =>
  cliCommandTargetTypes.includes(value as CliCommandTargetType);
const hasCliCommandParameterType = (value: string): value is CliCommandParameterType =>
  cliCommandParameterTypes.includes(value as CliCommandParameterType);
const hasCliCommandUiControl = (value: string): value is CliCommandUiControl =>
  cliCommandUiControls.includes(value as CliCommandUiControl);
const hasCliCommandPathKind = (value: string): value is CliCommandPathKind =>
  cliCommandPathKinds.includes(value as CliCommandPathKind);
const hasCliCommandPathRole = (value: string): value is CliCommandPathRole =>
  cliCommandPathRoles.includes(value as CliCommandPathRole);
const hasCliCommandOverwritePolicy = (value: string): value is CliCommandOverwritePolicy =>
  cliCommandOverwritePolicies.includes(value as CliCommandOverwritePolicy);
const hasCliCommandBatchFormat = (value: string): value is CliCommandBatchFormat =>
  cliCommandBatchFormats.includes(value as CliCommandBatchFormat);
const hasCliCommandBatchItemType = (value: string): value is CliCommandBatchItemType =>
  cliCommandBatchItemTypes.includes(value as CliCommandBatchItemType);
const hasCliCommandBatchExecutionMode = (value: string): value is CliCommandBatchExecutionMode =>
  cliCommandBatchExecutionModes.includes(value as CliCommandBatchExecutionMode);
const hasCliCommandOutputMode = (value: string): value is CliCommandOutputMode =>
  cliCommandOutputModes.includes(value as CliCommandOutputMode);
const hasCliCommandJsonOutputPolicy = (value: string): value is CliCommandJsonOutputPolicy =>
  cliCommandJsonOutputPolicies.includes(value as CliCommandJsonOutputPolicy);
const hasCliCommandSurfaceReusePolicy = (value: string): value is CliCommandSurfaceReusePolicy =>
  cliCommandSurfaceReusePolicies.includes(value as CliCommandSurfaceReusePolicy);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const asStringArray = (value: unknown, field: string, sourcePath: string, allowEmpty = true): string[] => {
  if (!Array.isArray(value)) {
    throw createError('PLUGIN_INVALID', `${field} must be an array`, { sourcePath, field });
  }
  const entries = value.map((item) => (typeof item === 'string' ? item.trim() : ''));
  if (entries.some((item) => item.length === 0)) {
    throw createError('PLUGIN_INVALID', `${field} contains non-string entries`, { sourcePath, field });
  }
  if (!allowEmpty && entries.length === 0) {
    throw createError('PLUGIN_INVALID', `${field} cannot be empty`, { sourcePath, field });
  }
  return entries;
};

const normalizeAssetPath = (value: string): string => {
  return path.normalize(value.trim()).replace(/^[.][\\/]/, '');
};

const asOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const collectManifestAssetPaths = (record: Record<string, unknown>, manifestPath: string): { entry?: PluginEntry; assets: string[] } => {
  const assets: string[] = [];
  const rawEntry = record.entry;
  let entry: PluginEntry | undefined;

  if (typeof rawEntry === 'string') {
    const trimmed = rawEntry.trim();
    if (trimmed.length === 0) {
      throw createError('PLUGIN_INVALID', 'Manifest entry must not be empty', { manifestPath });
    }
    entry = trimmed;
    assets.push(trimmed);
  } else if (typeof rawEntry !== 'undefined') {
    if (!isRecord(rawEntry)) {
      throw createError('PLUGIN_INVALID', 'Manifest entry must be a string or object', { manifestPath });
    }

    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawEntry)) {
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw createError('PLUGIN_INVALID', `Manifest entry.${key} must be a non-empty string`, {
          manifestPath,
          field: `entry.${key}`
        });
      }
      mapped[key] = value.trim();
      assets.push(mapped[key]!);
    }

    if (Object.keys(mapped).length > 0) {
      entry = mapped;
    }
  }

  const ui = isRecord(record.ui) ? record.ui : undefined;
  const layout = ui && isRecord(ui.layout) ? ui.layout : undefined;
  const launcher = ui && isRecord(ui.launcher) ? ui.launcher : undefined;
  for (const field of ['contract', 'minFunctionalSet']) {
    const value = layout?.[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      assets.push(value.trim());
    }
  }
  if (typeof launcher?.icon === 'string' && launcher.icon.trim().length > 0) {
    assets.push(launcher.icon.trim());
  }

  const preview = record.preview;
  if (typeof preview === 'string' && preview.trim().length > 0) {
    assets.push(preview.trim());
  }

  const moduleConfig = isRecord(record.module) ? record.module : undefined;
  const provides = moduleConfig && Array.isArray(moduleConfig.provides) ? moduleConfig.provides : [];
  for (const provider of provides) {
    if (!isRecord(provider) || !Array.isArray(provider.methods)) {
      continue;
    }

    for (const method of provider.methods) {
      if (!isRecord(method)) {
        continue;
      }

      if (typeof method.inputSchema === 'string' && method.inputSchema.trim().length > 0) {
        assets.push(method.inputSchema.trim());
      }
      if (typeof method.outputSchema === 'string' && method.outputSchema.trim().length > 0) {
        assets.push(method.outputSchema.trim());
      }
    }
  }

  return {
    entry,
    assets: [...new Set(assets.map(normalizeAssetPath).filter((item) => item.length > 0))]
  };
};

interface InstallSource {
  manifest: PluginManifest;
  manifestPath: string;
  pluginRoot: string;
  cleanup?: () => Promise<void>;
}

export class PluginRuntime {
  private readonly plugins = new Map<string, PluginRecord>();
  private readonly sessions = new Map<string, PluginSession>();
  private readonly quotaByPlugin = new Map<string, RuntimeQuota>();
  private readonly bridgeScopeToSession = new Map<string, string>();
  private readonly audits: RuntimeAuditEntry[] = [];
  private readonly zip = new StoreZipService();

  public constructor(
    private readonly workspacePath: string,
    private readonly defaults: { locale: string; themeId: string }
  ) {}

  public async load(): Promise<void> {
    const filePath = this.recordsPath();
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as PluginRecord[];
      let shouldPersist = false;
      for (const record of parsed) {
        const manifestNeedsRefresh =
          (record.manifest.type === 'theme' && typeof record.manifest.theme === 'undefined') ||
          (record.manifest.type === 'layout' && typeof record.manifest.layout === 'undefined') ||
          (record.manifest.type === 'module' && typeof record.manifest.module === 'undefined');
        const manifest = manifestNeedsRefresh ? await this.readManifest(record.manifestPath) : record.manifest;
        const normalized: PluginRecord = {
          ...record,
          manifest,
          installPath:
            typeof record.installPath === 'string' && record.installPath.length > 0
              ? record.installPath
              : path.dirname(record.manifestPath)
        };
        this.plugins.set(normalized.manifest.id, normalized);
        this.quotaByPlugin.set(normalized.manifest.id, defaultQuota);
        shouldPersist ||= manifestNeedsRefresh;
      }
      if (shouldPersist) {
        await this.persist();
      }
    } catch {
      await this.persist();
    }
  }

  public async install(sourcePath: string): Promise<PluginRecord> {
    this.recordAudit('install.resolve-source', 'success', { sourcePath: path.resolve(sourcePath) });
    const source = await this.resolveInstallSource(sourcePath);
    try {
      this.validateManifest(source.manifest, source.manifestPath);
      const installPath = this.installPath(source.manifest.id);
      const existingRecord = this.plugins.get(source.manifest.id);
      const existingPath = await this.statSafe(installPath);
      const replaced = Boolean(existingRecord || existingPath);
      const preservedQuota = this.quotaByPlugin.get(source.manifest.id) ?? defaultQuota;
      const wasEnabled = existingRecord?.enabled ?? false;

      if (existingRecord) {
        this.plugins.delete(source.manifest.id);
        this.closeSessions(source.manifest.id);
      }
      if (existingPath) {
        await fs.rm(installPath, { recursive: true, force: true });
      }

      await fs.mkdir(path.dirname(installPath), { recursive: true });
      await fs.cp(source.pluginRoot, installPath, { recursive: true });
      const relativeManifestPath = path.relative(source.pluginRoot, source.manifestPath);
      const installedManifestPath = path.join(installPath, relativeManifestPath);

      const record: PluginRecord = {
        manifest: source.manifest,
        manifestPath: installedManifestPath,
        installPath,
        enabled: wasEnabled,
        installedAt: now()
      };

      this.plugins.set(source.manifest.id, record);
      this.quotaByPlugin.set(source.manifest.id, preservedQuota);
      await this.persist();
      this.recordAudit('install.complete', 'success', {
        pluginId: source.manifest.id,
        replaced
      });
      return record;
    } catch (error) {
      this.recordAudit('install.complete', 'error', {
        pluginId: source.manifest.id,
        reason: String(error)
      });
      throw error;
    } finally {
      if (source.cleanup) {
        await source.cleanup();
      }
    }
  }

  public async uninstall(pluginId: string): Promise<void> {
    const record = this.plugins.get(pluginId);
    if (!record) {
      throw createError('PLUGIN_NOT_FOUND', `Plugin not found: ${pluginId}`);
    }

    this.plugins.delete(pluginId);
    this.quotaByPlugin.delete(pluginId);
    this.closeSessions(pluginId);
    await fs.rm(record.installPath, { recursive: true, force: true });
    await this.persist();
    this.recordAudit('plugin.uninstall', 'success', { pluginId });
  }

  public async enable(pluginId: string): Promise<void> {
    const record = this.plugins.get(pluginId);
    if (!record) {
      throw createError('PLUGIN_NOT_FOUND', `Plugin not found: ${pluginId}`);
    }
    record.enabled = true;
    await this.persist();
    this.recordAudit('plugin.enable', 'success', { pluginId });
  }

  public async disable(pluginId: string): Promise<void> {
    const record = this.plugins.get(pluginId);
    if (!record) {
      throw createError('PLUGIN_NOT_FOUND', `Plugin not found: ${pluginId}`);
    }
    record.enabled = false;
    this.closeSessions(pluginId);
    await this.persist();
    this.recordAudit('plugin.disable', 'success', { pluginId });
  }

  public query(filter?: { type?: PluginType; capability?: string }): PluginRecord[] {
    let list = [...this.plugins.values()];
    if (filter?.type) {
      list = list.filter((record) => record.manifest.type === filter.type);
    }
    if (filter?.capability) {
      const parsedFilter = parseHandlerCapability(filter.capability);
      const normalizedFilter = parsedFilter?.capability ?? filter.capability;
      list = list.filter((record) =>
        (record.manifest.capabilities ?? []).some((capability) => {
          const parsed = parseHandlerCapability(capability);
          return (parsed?.capability ?? capability) === normalizedFilter;
        })
      );
    }
    return list;
  }

  public get(pluginId: string): PluginRecord {
    const record = this.plugins.get(pluginId);
    if (!record) {
      throw createError('PLUGIN_NOT_FOUND', `Plugin not found: ${pluginId}`);
    }
    return record;
  }

  public pluginInit(pluginId: string, launchParams: Record<string, unknown> = {}): PluginSession {
    const plugin = this.get(pluginId);
    if (!plugin.enabled) {
      throw createError('PLUGIN_DISABLED', `Plugin disabled: ${pluginId}`);
    }

    const session: PluginSession = {
      sessionId: createId(),
      pluginId,
      pluginType: plugin.manifest.type,
      permissions: [...plugin.manifest.permissions],
      locale: this.defaults.locale,
      themeId: this.defaults.themeId,
      launchParams,
      sessionNonce: createId(),
      startedAt: now(),
      status: 'handshaking'
    };

    this.sessions.set(session.sessionId, session);
    this.recordAudit('session.init', 'success', {
      pluginId,
      sessionId: session.sessionId,
      permissionCount: session.permissions.length
    });
    return session;
  }

  public completeHandshake(sessionId: string, nonce: string): PluginSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw createError('PLUGIN_SESSION_NOT_FOUND', `Session not found: ${sessionId}`);
    }

    if (session.sessionNonce !== nonce) {
      throw createError('PLUGIN_HANDSHAKE_FAILED', 'Invalid session nonce');
    }
    if (session.status !== 'handshaking') {
      throw createError('PLUGIN_HANDSHAKE_FAILED', 'Session is not in handshaking state', {
        sessionId,
        status: session.status
      });
    }

    session.status = 'running';
    this.recordAudit('session.handshake', 'success', {
      pluginId: session.pluginId,
      sessionId: session.sessionId
    });
    return session;
  }

  public stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.status = 'stopped';
    this.revokeBridgeScopesForSession(sessionId);
    this.sessions.delete(sessionId);
    this.recordAudit('session.stop', 'success', {
      pluginId: session.pluginId,
      sessionId
    });
  }

  public createBridgeScope(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw createError('PLUGIN_SESSION_NOT_FOUND', `Session not found: ${sessionId}`);
    }
    if (session.status !== 'running') {
      throw createError('PLUGIN_SESSION_NOT_READY', `Session is not running: ${sessionId}`, {
        sessionId,
        status: session.status
      });
    }

    const token = createId();
    this.bridgeScopeToSession.set(token, sessionId);
    this.recordAudit('session.scope.issued', 'success', {
      pluginId: session.pluginId,
      sessionId
    });
    return token;
  }

  public resolveBridgeScope(token: string): ResolvedBridgeScope | null {
    const sessionId = this.bridgeScopeToSession.get(token);
    if (!sessionId) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      this.bridgeScopeToSession.delete(token);
      return null;
    }

    return {
      callerId: `plugin-session:${session.sessionId}`,
      pluginId: session.pluginId,
      sessionId: session.sessionId,
      permissions: [...session.permissions]
    };
  }

  public ensurePermission(pluginId: string, permission: string): void {
    const plugin = this.get(pluginId);
    if (!plugin.manifest.permissions.includes(permission)) {
      throw createError(
        'PERMISSION_DENIED',
        `Plugin lacks permission: ${permission}`,
        {
          pluginId,
          permission,
          required: [permission],
          granted: plugin.manifest.permissions
        },
        false,
        {
          messageKey: 'chips.error.permissionDenied',
          permission: {
            required: [permission],
            granted: plugin.manifest.permissions,
            messageKey: 'chips.error.permissionDenied',
            pluginId
          }
        }
      );
    }
  }

  public getQuota(pluginId: string): RuntimeQuota {
    return this.quotaByPlugin.get(pluginId) ?? defaultQuota;
  }

  public setQuota(pluginId: string, quota: Partial<RuntimeQuota>): RuntimeQuota {
    const existing = this.getQuota(pluginId);
    const next: RuntimeQuota = {
      cpuBudget: quota.cpuBudget ?? existing.cpuBudget,
      memoryBudgetMb: quota.memoryBudgetMb ?? existing.memoryBudgetMb,
      messageRateBudget: quota.messageRateBudget ?? existing.messageRateBudget
    };
    this.quotaByPlugin.set(pluginId, next);
    return next;
  }

  public snapshot(): RuntimeSnapshot {
    return {
      plugins: this.query(),
      sessions: [...this.sessions.values()],
      audits: [...this.audits]
    };
  }

  private closeSessions(pluginId: string): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.pluginId === pluginId) {
        this.revokeBridgeScopesForSession(sessionId);
        this.sessions.delete(sessionId);
        this.recordAudit('session.stop', 'success', {
          pluginId: session.pluginId,
          sessionId
        });
      }
    }
  }

  private revokeBridgeScopesForSession(sessionId: string): void {
    for (const [token, targetSessionId] of this.bridgeScopeToSession.entries()) {
      if (targetSessionId === sessionId) {
        this.bridgeScopeToSession.delete(token);
      }
    }
  }

  private validateManifest(manifest: PluginManifest, manifestPath: string): void {
    if (!/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/i.test(manifest.id)) {
      throw createError('PLUGIN_INVALID', `Plugin id must use reverse-domain format: ${manifest.id}`, {
        manifestPath
      });
    }
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version)) {
      throw createError('PLUGIN_INVALID', `Plugin version must use semantic version: ${manifest.version}`, {
        manifestPath
      });
    }
    for (const permission of manifest.permissions) {
      // Permission naming convention (see 插件开发规范):
      // - segments separated by "."
      // - each segment uses lower-case letters, digits and hyphens, e.g.:
      //   "file.read", "i18n.read", "global-shortcut.write"
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(permission)) {
        throw createError('PLUGIN_INVALID', `Invalid permission name: ${permission}`, {
          manifestPath
        });
      }
    }
    for (const assetPath of manifest.assets ?? []) {
      if (path.isAbsolute(assetPath) || assetPath.includes('..')) {
        throw createError('PLUGIN_INVALID', 'Plugin entry must be a safe relative path', {
          manifestPath,
          entry: assetPath
        });
      }
    }
    if (manifest.source && manifest.source !== 'local') {
      if (!manifest.signature || manifest.signature.trim().length === 0) {
        throw createError('PLUGIN_SIGNATURE_INVALID', 'Plugin signature is required for non-local source', {
          manifestPath,
          source: manifest.source
        });
      }
    }
    if (manifest.type === 'module' && !manifest.module) {
      throw createError('PLUGIN_INVALID', 'Module plugin must declare module metadata', {
        manifestPath,
        field: 'module'
      });
    }
    for (const command of manifest.cli?.commands ?? []) {
      const missingPermissions = command.permissions.filter((permission) => !manifest.permissions.includes(permission));
      if (missingPermissions.length > 0) {
        throw createError('PLUGIN_INVALID', 'cli.commands permissions must be declared by plugin permissions', {
          manifestPath,
          pluginId: manifest.id,
          commandId: command.commandId,
          missingPermissions
        });
      }
    }
  }

  private recordAudit(
    stage: string,
    result: 'success' | 'error',
    payload: {
      pluginId?: string;
      sessionId?: string;
      reason?: string;
      sourcePath?: string;
      permissionCount?: number;
    } & Record<string, unknown>
  ): void {
    const { pluginId, sessionId, ...details } = payload;
    this.audits.push({
      id: createId(),
      timestamp: now(),
      stage,
      result,
      pluginId,
      sessionId,
      details
    });
    if (this.audits.length > 500) {
      this.audits.shift();
    }
  }

  private recordsPath(): string {
    return path.join(this.workspacePath, 'plugin-runtime.json');
  }

  private installPath(pluginId: string): string {
    return path.join(this.workspacePath, 'plugins', pluginId);
  }

  private async resolveInstallSource(sourcePath: string): Promise<InstallSource> {
    const absolutePath = path.resolve(sourcePath);
    const sourceStats = await this.statSafe(absolutePath);
    if (!sourceStats) {
      throw createError('PLUGIN_SOURCE_NOT_FOUND', `Plugin source not found: ${absolutePath}`);
    }

    if (sourceStats.isDirectory()) {
      const manifestPath = await this.findManifestPath(absolutePath);
      const manifest = await this.readManifest(manifestPath);
      await this.ensureManifestAssetsExist(manifest, manifestPath);
      return {
        manifest,
        manifestPath,
        pluginRoot: absolutePath
      };
    }

    if (path.extname(absolutePath).toLowerCase() === '.cpk') {
      const extracted = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-plugin-cpk-'));
      try {
        await this.zip.extract(absolutePath, extracted);
      } catch (error) {
        await fs.rm(extracted, { recursive: true, force: true });
        throw createError('PLUGIN_PACKAGE_INVALID', 'Failed to extract .cpk package', {
          sourcePath: absolutePath,
          reason: String(error)
        });
      }

      const manifestPath = await this.findManifestPath(extracted);
      const manifest = await this.readManifest(manifestPath);
      await this.ensureManifestAssetsExist(manifest, manifestPath);
      return {
        manifest,
        manifestPath,
        pluginRoot: extracted,
        cleanup: async () => {
          await fs.rm(extracted, { recursive: true, force: true });
        }
      };
    }

    const manifest = await this.readManifest(absolutePath);
    const staged = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-plugin-manifest-'));
    const stagedManifestPath = path.join(staged, path.basename(absolutePath));
    await fs.copyFile(absolutePath, stagedManifestPath);

    if ((manifest.assets ?? []).length > 0) {
      const sourceRoot = path.dirname(absolutePath);
      const assetRoots = this.resolveManifestAssetRoots(manifest.assets ?? []);

      for (const assetRoot of assetRoots) {
        const sourceAssetRootPath = path.resolve(sourceRoot, assetRoot);
        const assetRootStats = await this.statSafe(sourceAssetRootPath);
        if (!assetRootStats) {
          await fs.rm(staged, { recursive: true, force: true });
          throw createError('PLUGIN_ENTRY_NOT_FOUND', `Plugin entry not found: ${assetRoot}`, {
            sourcePath: absolutePath,
            entry: assetRoot
          });
        }

        const stagedAssetRootPath = path.join(staged, assetRoot);
        await fs.mkdir(path.dirname(stagedAssetRootPath), { recursive: true });
        await fs.cp(sourceAssetRootPath, stagedAssetRootPath, { recursive: true });
      }
    }

    return {
      manifest,
      manifestPath: stagedManifestPath,
      pluginRoot: staged,
      cleanup: async () => {
        await fs.rm(staged, { recursive: true, force: true });
      }
    };
  }

  private resolveManifestAssetRoots(entries: string[]): string[] {
    const roots = new Set<string>();
    for (const entry of entries) {
      const normalized = normalizeAssetPath(entry);
      const segments = normalized.split(path.sep).filter((segment) => segment.length > 0);
      if (segments.length === 0) {
        continue;
      }
      if (segments.length === 1) {
        roots.add(normalized);
        continue;
      }
      roots.add(segments[0]!);
    }
    return [...roots];
  }

  private async findManifestPath(rootPath: string): Promise<string> {
    const canonicalNames = ['manifest.yaml', 'manifest.yml', 'manifest.json'];
    for (const name of canonicalNames) {
      const candidate = path.join(rootPath, name);
      const exists = await this.statSafe(candidate);
      if (exists?.isFile()) {
        return candidate;
      }
    }

    const stack = [rootPath];
    const candidates: string[] = [];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (entry.isFile() && this.isManifestFileName(entry.name)) {
          candidates.push(fullPath);
        }
      }
    }

    if (candidates.length === 0) {
      throw createError('PLUGIN_MANIFEST_NOT_FOUND', 'Cannot locate plugin manifest file', {
        rootPath
      });
    }

    candidates.sort((left, right) => {
      const leftRank = this.manifestRank(path.basename(left));
      const rightRank = this.manifestRank(path.basename(right));
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.localeCompare(right);
    });

    return candidates[0]!;
  }

  private async readManifest(manifestPath: string): Promise<PluginManifest> {
    const ext = path.extname(manifestPath).toLowerCase();
    const raw = await fs.readFile(manifestPath, 'utf-8');
    let parsed: unknown;

    if (ext === '.json') {
      parsed = JSON.parse(raw);
    } else if (ext === '.yaml' || ext === '.yml') {
      parsed = parseYamlLite(raw);
    } else {
      throw createError('PLUGIN_MANIFEST_UNSUPPORTED', `Unsupported manifest format: ${manifestPath}`, {
        manifestPath
      });
    }

    if (!parsed || typeof parsed !== 'object') {
      throw createError('PLUGIN_INVALID', 'Manifest content must be an object', { manifestPath });
    }

    const record = parsed as Record<string, unknown>;
    if (
      typeof record.id !== 'string' ||
      typeof record.version !== 'string' ||
      typeof record.type !== 'string' ||
      typeof record.name !== 'string'
    ) {
      throw createError('PLUGIN_INVALID', 'Manifest missing required fields', { manifestPath });
    }

    if (!hasPluginType(record.type)) {
      throw createError('PLUGIN_INVALID', `Invalid plugin type: ${record.type}`, { manifestPath });
    }

    // Normalise permissions:
    // - parseYamlLite 会把 `permissions: []` 解析成字符串 `"[]"`，
    //   这里专门把它视为「空数组」以兼容现有清单写法。
    const rawPermissions = (record as Record<string, unknown>).permissions;
    const permissionsValue =
      typeof rawPermissions === 'string' && rawPermissions.trim() === '[]' ? [] : rawPermissions;
    const permissions = asStringArray(permissionsValue, 'permissions', manifestPath, true);

    // Normalise capabilities:
    // 支持两种结构：
    // 1) 直接数组：capabilities: ["base.richtext"]
    // 2) 对象形式：capabilities: { cardTypes: ["base.richtext"] }
    let capabilities: string[] | undefined;
    const rawCapabilities = (record as Record<string, unknown>).capabilities;

    if (typeof rawCapabilities === 'undefined') {
      capabilities = undefined;
    } else if (Array.isArray(rawCapabilities)) {
      capabilities = asStringArray(rawCapabilities, 'capabilities', manifestPath, true);
    } else if (rawCapabilities && typeof rawCapabilities === 'object') {
      const capsObject = rawCapabilities as Record<string, unknown>;
      const cardTypesValue = capsObject.cardTypes;
      if (typeof cardTypesValue === 'string' && cardTypesValue.trim() === '[]') {
        capabilities = [];
      } else if (Array.isArray(cardTypesValue)) {
        capabilities = asStringArray(cardTypesValue, 'capabilities.cardTypes', manifestPath, true);
      } else {
        throw createError('PLUGIN_INVALID', 'capabilities.cardTypes must be an array', { manifestPath });
      }
    } else if (typeof rawCapabilities === 'string' && rawCapabilities.trim() === '[]') {
      capabilities = [];
    } else {
      throw createError('PLUGIN_INVALID', 'capabilities must be an array or object', { manifestPath });
    }

    const source =
      typeof record.source === 'string' && hasPluginSource(record.source)
        ? record.source
        : undefined;
    if (typeof record.source === 'string' && !source) {
      throw createError('PLUGIN_INVALID', `Invalid plugin source: ${record.source}`, { manifestPath });
    }
    const signature = typeof record.signature === 'string' ? record.signature : undefined;

    const { entry, assets } = collectManifestAssetPaths(record, manifestPath);

    for (const { field, ownerType } of typeExclusiveManifestFields) {
      if (typeof record[field] !== 'undefined' && record.type !== ownerType) {
        throw createError('PLUGIN_INVALID', `manifest.${field} is only supported for ${ownerType} plugins`, {
          manifestPath,
          field,
          ownerType,
          type: record.type
        });
      }
    }
    if ((record.type === 'app' || record.type === 'module') && typeof record.plugin !== 'undefined') {
      throw createError('PLUGIN_INVALID', 'manifest.plugin is reserved for Host plugin governance', {
        manifestPath,
        field: 'plugin',
        type: record.type
      });
    }

    const ui = parsePluginUiConfig(record.ui, manifestPath);
    if (record.type !== 'app' && ui?.launcher) {
      throw createError('PLUGIN_INVALID', 'ui.launcher is only supported for app plugins', {
        manifestPath,
        field: 'ui.launcher',
        type: record.type
      });
    }
    if (record.type !== 'app' && ui?.surface) {
      throw createError('PLUGIN_INVALID', 'ui.surface is only supported for app plugins', {
        manifestPath,
        field: 'ui.surface',
        type: record.type
      });
    }

    const runtime = this.parseRuntimeManifestMeta(record, manifestPath);
    if (record.type === 'app' && !runtime) {
      throw createError('PLUGIN_INVALID', 'app plugins must declare runtime.targets', {
        manifestPath,
        field: 'runtime.targets',
        type: record.type
      });
    }
    if (record.type === 'app' && !ui?.surface?.defaultKind) {
      throw createError('PLUGIN_INVALID', 'app plugins must declare ui.surface.defaultKind', {
        manifestPath,
        field: 'ui.surface.defaultKind',
        type: record.type
      });
    }
    if (record.type === 'app') {
      const preferredKinds = ui?.surface?.preferredKinds;
      for (const targetId of runtimeTargetIds) {
        if (!preferredKinds?.[targetId]) {
          throw createError('PLUGIN_INVALID', `app plugins must declare ui.surface.preferredKinds.${targetId}`, {
            manifestPath,
            field: `ui.surface.preferredKinds.${targetId}`,
            type: record.type
          });
        }
      }
    }
    const capabilityFallbacks = this.parseCapabilityFallbacks(record, manifestPath);
    const cli = this.parseCliManifestMeta(record, manifestPath);

    const theme = record.type === 'theme' ? this.parseThemeManifestMeta(record, manifestPath) : undefined;
    const layout = record.type === 'layout' ? this.parseLayoutManifestMeta(record) : undefined;
    const module = record.type === 'module' ? this.parseModuleManifestMeta(record, manifestPath) : undefined;

    const normalizedCapabilities =
      record.type === 'module'
        ? [...new Set(module?.provides.map((provider) => provider.capability) ?? [])]
        : capabilities;

    return {
      id: record.id,
      version: record.version,
      type: record.type,
      name: record.name,
      description: typeof record.description === 'string' ? record.description : undefined,
      permissions,
      capabilities: normalizedCapabilities,
      entry,
      assets,
      source,
      signature,
      ui,
      runtime,
      capabilityFallbacks,
      theme,
      layout,
      module,
      cli
    };
  }

  private parseCliManifestMeta(record: Record<string, unknown>, manifestPath: string): CliManifestMeta | undefined {
    const cli = record.cli;
    if (typeof cli === 'undefined') {
      return undefined;
    }
    if (!isRecord(cli)) {
      throw createError('PLUGIN_INVALID', 'cli must be an object', {
        manifestPath,
        field: 'cli'
      });
    }
    if (record.type !== 'app' && record.type !== 'module') {
      throw createError('PLUGIN_INVALID', 'cli.commands is only supported for app and module plugins', {
        manifestPath,
        field: 'cli.commands',
        type: record.type
      });
    }
    if (!Array.isArray(cli.commands)) {
      throw createError('PLUGIN_INVALID', 'cli.commands must be an array', {
        manifestPath,
        field: 'cli.commands'
      });
    }

    const commands = cli.commands.map((command, commandIndex) => {
      return this.parseCliCommandManifestMeta(record, command, commandIndex, manifestPath);
    });
    const commandIds = new Set<string>();
    for (const command of commands) {
      if (commandIds.has(command.commandId)) {
        throw createError('PLUGIN_INVALID', 'cli.commands commandId must be unique within the plugin manifest', {
          manifestPath,
          field: 'cli.commands.commandId',
          commandId: command.commandId
        });
      }
      commandIds.add(command.commandId);
    }

    return {
      commands
    };
  }

  private parseCliCommandManifestMeta(
    manifestRecord: Record<string, unknown>,
    value: unknown,
    commandIndex: number,
    manifestPath: string
  ): CliCommandManifestMeta {
    if (!isRecord(value)) {
      throw createError('PLUGIN_INVALID', 'cli.commands entries must be objects', {
        manifestPath,
        field: `cli.commands[${commandIndex}]`
      });
    }

    const commandPath = this.parseCliCommandPath(value.commandPath, `cli.commands[${commandIndex}].commandPath`, manifestPath);
    if (hostFixedCliCommandRoots.has(commandPath[0]!.toLowerCase())) {
      throw createError('PLUGIN_INVALID', 'cli.commands commandPath must not shadow Host fixed commands', {
        manifestPath,
        field: `cli.commands[${commandIndex}].commandPath`,
        commandPath,
        reservedRoot: commandPath[0]
      });
    }
    const titleKey = asOptionalString(value.titleKey);
    if (!titleKey) {
      throw createError('PLUGIN_INVALID', 'cli.commands[].titleKey is required', {
        manifestPath,
        field: `cli.commands[${commandIndex}].titleKey`
      });
    }

    const commandId =
      asOptionalString(value.commandId) ?? `${String(manifestRecord.id)}.cli.${commandPath.join('.')}`;
    const target = this.parseCliCommandTargetManifestMeta(
      manifestRecord,
      value.target,
      `cli.commands[${commandIndex}].target`,
      manifestPath
    );
    const argumentItems = this.parseCliCommandParameterList(
      value.arguments,
      `cli.commands[${commandIndex}].arguments`,
      manifestPath,
      true
    );
    const optionItems = this.parseCliCommandParameterList(
      value.options,
      `cli.commands[${commandIndex}].options`,
      manifestPath,
      false
    );

    this.assertUniqueCliCommandParameterNames(
      [...argumentItems, ...optionItems],
      `cli.commands[${commandIndex}]`,
      manifestPath
    );

    return {
      commandId,
      commandPath,
      target,
      titleKey,
      descriptionKey: asOptionalString(value.descriptionKey),
      examples: this.parseCliCommandExamples(value.examples, `cli.commands[${commandIndex}].examples`, manifestPath),
      permissions: this.parseCliCommandPermissions(value.permissions, `cli.commands[${commandIndex}].permissions`, manifestPath),
      arguments: argumentItems,
      options: optionItems,
      output: this.parseCliCommandOutput(value.output, `cli.commands[${commandIndex}].output`, manifestPath),
      job: this.parseCliCommandJob(value.job, `cli.commands[${commandIndex}].job`, manifestPath),
      conflict: this.parseCliCommandConflict(value.conflict, `cli.commands[${commandIndex}].conflict`, manifestPath)
    };
  }

  private parseCliCommandPath(value: unknown, field: string, manifestPath: string): string[] {
    const segments =
      typeof value === 'string'
        ? value.trim().split(/\s+/).filter((segment) => segment.length > 0)
        : Array.isArray(value)
          ? value.map((segment) => (typeof segment === 'string' ? segment.trim() : ''))
          : [];
    if (segments.length === 0 || segments.some((segment) => !CLI_COMMAND_PATH_SEGMENT_PATTERN.test(segment))) {
      throw createError('PLUGIN_INVALID', 'cli commandPath must be a non-empty command segment string or string[]', {
        manifestPath,
        field,
        value
      });
    }
    return segments;
  }

  private parseCliCommandTargetManifestMeta(
    manifestRecord: Record<string, unknown>,
    value: unknown,
    field: string,
    manifestPath: string
  ): CliCommandTargetManifestMeta {
    if (!isRecord(value)) {
      throw createError('PLUGIN_INVALID', 'cli command target must be an object', {
        manifestPath,
        field
      });
    }
    const targetType = asOptionalString(value.type);
    if (!targetType || !hasCliCommandTargetType(targetType)) {
      throw createError('PLUGIN_INVALID', 'cli command target.type must be "app" or "module"', {
        manifestPath,
        field: `${field}.type`,
        targetType
      });
    }
    if (targetType !== manifestRecord.type) {
      throw createError('PLUGIN_INVALID', 'cli command target.type must match the declaring plugin type', {
        manifestPath,
        field: `${field}.type`,
        pluginType: manifestRecord.type,
        targetType
      });
    }

    if (targetType === 'module') {
      const capability = asOptionalString(value.capability);
      const method = asOptionalString(value.method);
      if (!capability || !method) {
        throw createError('PLUGIN_INVALID', 'module cli target requires capability and method', {
          manifestPath,
          field
        });
      }
      const pluginId = asOptionalString(value.pluginId);
      if (pluginId && pluginId !== manifestRecord.id) {
        throw createError('PLUGIN_INVALID', 'module cli target pluginId must match the declaring plugin id', {
          manifestPath,
          field: `${field}.pluginId`,
          pluginId,
          ownerPluginId: manifestRecord.id
        });
      }
      const target: CliCommandModuleTargetManifestMeta = {
        type: 'module',
        capability,
        method
      };
      if (pluginId) {
        target.pluginId = pluginId;
      }
      if (typeof value.timeoutMs !== 'undefined') {
        if (typeof value.timeoutMs !== 'number' || !Number.isFinite(value.timeoutMs) || value.timeoutMs <= 0) {
          throw createError('PLUGIN_INVALID', 'module cli target timeoutMs must be a positive finite number', {
            manifestPath,
            field: `${field}.timeoutMs`
          });
        }
        target.timeoutMs = value.timeoutMs;
      }
      return target;
    }

    const pluginId = asOptionalString(value.pluginId) ?? String(manifestRecord.id);
    if (pluginId !== manifestRecord.id) {
      throw createError('PLUGIN_INVALID', 'app cli target pluginId must match the declaring plugin id', {
        manifestPath,
        field: `${field}.pluginId`,
        pluginId,
        ownerPluginId: manifestRecord.id
      });
    }
    const target: CliCommandAppTargetManifestMeta = {
      type: 'app',
      pluginId
    };
    const commandId = asOptionalString(value.commandId);
    if (commandId) {
      target.commandId = commandId;
    }
    if (typeof value.launchParams !== 'undefined') {
      if (!isRecord(value.launchParams)) {
        throw createError('PLUGIN_INVALID', 'app cli target launchParams must be an object', {
          manifestPath,
          field: `${field}.launchParams`
        });
      }
      target.launchParams = deepClone(value.launchParams);
    }
    if (typeof value.surface !== 'undefined') {
      if (!isRecord(value.surface)) {
        throw createError('PLUGIN_INVALID', 'app cli target surface must be an object', {
          manifestPath,
          field: `${field}.surface`
        });
      }
      const surface: NonNullable<CliCommandAppTargetManifestMeta['surface']> = {};
      if (typeof value.surface.open !== 'undefined') {
        if (typeof value.surface.open !== 'boolean') {
          throw createError('PLUGIN_INVALID', 'app cli target surface.open must be a boolean', {
            manifestPath,
            field: `${field}.surface.open`
          });
        }
        surface.open = value.surface.open;
      }
      if (typeof value.surface.focus !== 'undefined') {
        if (typeof value.surface.focus !== 'boolean') {
          throw createError('PLUGIN_INVALID', 'app cli target surface.focus must be a boolean', {
            manifestPath,
            field: `${field}.surface.focus`
          });
        }
        surface.focus = value.surface.focus;
      }
      const reuse = asOptionalString(value.surface.reuse);
      if (reuse) {
        if (!hasCliCommandSurfaceReusePolicy(reuse)) {
          throw createError('PLUGIN_INVALID', 'app cli target surface.reuse is invalid', {
            manifestPath,
            field: `${field}.surface.reuse`,
            reuse
          });
        }
        surface.reuse = reuse;
      }
      target.surface = surface;
    }
    return target;
  }

  private parseCliCommandParameterList(
    value: unknown,
    field: string,
    manifestPath: string,
    positional: boolean
  ): CliCommandParameterManifestMeta[] {
    if (typeof value === 'undefined') {
      return [];
    }
    if (!Array.isArray(value)) {
      throw createError('PLUGIN_INVALID', `${field} must be an array`, {
        manifestPath,
        field
      });
    }
    const parameters = value.map((parameter, parameterIndex) => {
      return this.parseCliCommandParameter(
        parameter,
        `${field}[${parameterIndex}]`,
        manifestPath,
        positional
      );
    });
    if (positional) {
      const positions = new Set<number>();
      for (const parameter of parameters) {
        const position = parameter.position ?? 0;
        if (positions.has(position)) {
          throw createError('PLUGIN_INVALID', 'cli positional argument positions must be unique', {
            manifestPath,
            field,
            position
          });
        }
        positions.add(position);
      }
      return parameters.sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    }
    return parameters;
  }

  private parseCliCommandParameter(
    value: unknown,
    field: string,
    manifestPath: string,
    positional: boolean
  ): CliCommandParameterManifestMeta {
    if (!isRecord(value)) {
      throw createError('PLUGIN_INVALID', 'cli command parameter entries must be objects', {
        manifestPath,
        field
      });
    }
    const name = asOptionalString(value.name);
    const type = asOptionalString(value.type);
    if (!name || !CLI_COMMAND_PARAM_NAME_PATTERN.test(name)) {
      throw createError('PLUGIN_INVALID', 'cli command parameter name is invalid', {
        manifestPath,
        field: `${field}.name`,
        name
      });
    }
    if (!type || !hasCliCommandParameterType(type)) {
      throw createError('PLUGIN_INVALID', 'cli command parameter type is invalid', {
        manifestPath,
        field: `${field}.type`,
        type
      });
    }
    const parameter: CliCommandParameterManifestMeta = {
      name,
      type
    };
    const short = asOptionalString(value.short);
    if (short) {
      if (!/^[A-Za-z0-9]$/.test(short)) {
        throw createError('PLUGIN_INVALID', 'cli command option short must be one character', {
          manifestPath,
          field: `${field}.short`,
          short
        });
      }
      parameter.short = short;
    }
    if (positional) {
      const position = value.position;
      if (typeof position !== 'undefined') {
        if (typeof position !== 'number' || !Number.isInteger(position) || position < 0) {
          throw createError('PLUGIN_INVALID', 'cli command argument position must be a non-negative integer', {
            manifestPath,
            field: `${field}.position`
          });
        }
        parameter.position = position;
      }
    } else if (typeof value.position !== 'undefined') {
      throw createError('PLUGIN_INVALID', 'cli command options must not declare position', {
        manifestPath,
        field: `${field}.position`
      });
    }
    if (typeof value.required !== 'undefined') {
      if (typeof value.required !== 'boolean') {
        throw createError('PLUGIN_INVALID', 'cli command parameter required must be a boolean', {
          manifestPath,
          field: `${field}.required`
        });
      }
      parameter.required = value.required;
    }
    if (typeof value.default !== 'undefined') {
      parameter.default = deepClone(value.default);
    }
    const mapsTo = asOptionalString(value.mapsTo);
    if (mapsTo) {
      if (!CLI_COMMAND_MAPS_TO_PATTERN.test(mapsTo)) {
        throw createError('PLUGIN_INVALID', 'cli command parameter mapsTo must be a dotted payload path', {
          manifestPath,
          field: `${field}.mapsTo`,
          mapsTo
        });
      }
      parameter.mapsTo = mapsTo;
    }
    if (typeof value.choices !== 'undefined') {
      if (!Array.isArray(value.choices)) {
        throw createError('PLUGIN_INVALID', 'cli command parameter choices must be an array', {
          manifestPath,
          field: `${field}.choices`
        });
      }
      parameter.choices = value.choices.map((item) => deepClone(item));
    }
    if (typeof value.multiple !== 'undefined') {
      if (typeof value.multiple !== 'boolean') {
        throw createError('PLUGIN_INVALID', 'cli command parameter multiple must be a boolean', {
          manifestPath,
          field: `${field}.multiple`
        });
      }
      parameter.multiple = value.multiple;
    }
    parameter.validation = this.parseCliCommandParameterValidation(value.validation, `${field}.validation`, manifestPath);
    parameter.path = this.parseCliCommandPathRule(value.path, `${field}.path`, manifestPath);
    if (parameter.path?.role === 'output' && type !== 'path') {
      throw createError('PLUGIN_INVALID', 'cli command output path role is only supported by path parameters', {
        manifestPath,
        field: `${field}.path.role`,
        type
      });
    }
    if (parameter.path?.overwrite && parameter.path.role !== 'output') {
      throw createError('PLUGIN_INVALID', 'cli command path.overwrite requires path.role: output', {
        manifestPath,
        field: `${field}.path.overwrite`
      });
    }
    parameter.batch = this.parseCliCommandBatchRule(value.batch, `${field}.batch`, manifestPath);
    parameter.ui = this.parseCliCommandParameterUi(value.ui, `${field}.ui`, manifestPath);
    if (parameter.batch && type !== 'textFile' && type !== 'jsonFile') {
      throw createError('PLUGIN_INVALID', 'cli command batch is only supported by textFile or jsonFile parameters', {
        manifestPath,
        field: `${field}.batch`,
        type
      });
    }
    if (parameter.batch?.format === 'lines' && type !== 'textFile') {
      throw createError('PLUGIN_INVALID', 'cli command batch.format lines requires a textFile parameter', {
        manifestPath,
        field: `${field}.batch.format`,
        type
      });
    }
    if (parameter.batch?.format === 'json-array' && type !== 'jsonFile') {
      throw createError('PLUGIN_INVALID', 'cli command batch.format json-array requires a jsonFile parameter', {
        manifestPath,
        field: `${field}.batch.format`,
        type
      });
    }
    return parameter;
  }

  private assertUniqueCliCommandParameterNames(
    parameters: CliCommandParameterManifestMeta[],
    field: string,
    manifestPath: string
  ): void {
    const names = new Set<string>();
    const shorts = new Set<string>();
    for (const parameter of parameters) {
      if (names.has(parameter.name)) {
        throw createError('PLUGIN_INVALID', 'cli command parameter names must be unique', {
          manifestPath,
          field,
          name: parameter.name
        });
      }
      names.add(parameter.name);
      if (parameter.short) {
        if (shorts.has(parameter.short)) {
          throw createError('PLUGIN_INVALID', 'cli command option short aliases must be unique', {
            manifestPath,
            field,
            short: parameter.short
          });
        }
        shorts.add(parameter.short);
      }
    }
  }

  private parseCliCommandParameterValidation(
    value: unknown,
    field: string,
    manifestPath: string
  ): CliCommandValidationManifestMeta | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (!isRecord(value)) {
      throw createError('PLUGIN_INVALID', 'cli command parameter validation must be an object', {
        manifestPath,
        field
      });
    }
    const validation: CliCommandValidationManifestMeta = {};
    for (const key of ['min', 'max', 'minLength', 'maxLength'] as const) {
      if (typeof value[key] === 'undefined') {
        continue;
      }
      if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
        throw createError('PLUGIN_INVALID', `cli command parameter validation.${key} must be a finite number`, {
          manifestPath,
          field: `${field}.${key}`
        });
      }
      validation[key] = value[key];
    }
    const pattern = asOptionalString(value.pattern);
    if (pattern) {
      validation.pattern = pattern;
    }
    return Object.keys(validation).length > 0 ? validation : undefined;
  }

  private parseCliCommandPathRule(
    value: unknown,
    field: string,
    manifestPath: string
  ): CliCommandPathRuleManifestMeta | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (!isRecord(value)) {
      throw createError('PLUGIN_INVALID', 'cli command path rule must be an object', {
        manifestPath,
        field
      });
    }
    const rule: CliCommandPathRuleManifestMeta = {};
    const kind = asOptionalString(value.kind);
    if (kind) {
      if (!hasCliCommandPathKind(kind)) {
        throw createError('PLUGIN_INVALID', 'cli command path.kind is invalid', {
          manifestPath,
          field: `${field}.kind`,
          kind
        });
      }
      rule.kind = kind;
    }
    const role = asOptionalString(value.role);
    if (role) {
      if (!hasCliCommandPathRole(role)) {
        throw createError('PLUGIN_INVALID', 'cli command path.role is invalid', {
          manifestPath,
          field: `${field}.role`,
          role
        });
      }
      rule.role = role;
    }
    for (const key of ['exists', 'create'] as const) {
      if (typeof value[key] === 'undefined') {
        continue;
      }
      if (typeof value[key] !== 'boolean') {
        throw createError('PLUGIN_INVALID', `cli command path.${key} must be a boolean`, {
          manifestPath,
          field: `${field}.${key}`
        });
      }
      rule[key] = value[key];
    }
    if (typeof value.extensions !== 'undefined') {
      rule.extensions = asStringArray(value.extensions, `${field}.extensions`, manifestPath, false);
    }
    const overwrite = asOptionalString(value.overwrite);
    if (overwrite) {
      if (!hasCliCommandOverwritePolicy(overwrite)) {
        throw createError('PLUGIN_INVALID', 'cli command path.overwrite is invalid', {
          manifestPath,
          field: `${field}.overwrite`,
          overwrite
        });
      }
      rule.overwrite = overwrite;
    }
    return Object.keys(rule).length > 0 ? rule : undefined;
  }

  private parseCliCommandBatchItemPathRule(
    value: unknown,
    field: string,
    manifestPath: string
  ): CliCommandBatchItemPathRuleManifestMeta | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (!isRecord(value)) {
      throw createError('PLUGIN_INVALID', 'cli command batch.itemPath must be an object', {
        manifestPath,
        field
      });
    }
    const rule: CliCommandBatchItemPathRuleManifestMeta = {};
    const kind = asOptionalString(value.kind);
    if (kind) {
      if (!hasCliCommandPathKind(kind)) {
        throw createError('PLUGIN_INVALID', 'cli command batch.itemPath.kind is invalid', {
          manifestPath,
          field: `${field}.kind`,
          kind
        });
      }
      rule.kind = kind;
    }
    for (const key of ['exists', 'create'] as const) {
      if (typeof value[key] === 'undefined') {
        continue;
      }
      if (typeof value[key] !== 'boolean') {
        throw createError('PLUGIN_INVALID', `cli command batch.itemPath.${key} must be a boolean`, {
          manifestPath,
          field: `${field}.${key}`
        });
      }
      rule[key] = value[key];
    }
    if (typeof value.extensions !== 'undefined') {
      rule.extensions = asStringArray(value.extensions, `${field}.extensions`, manifestPath, false);
    }
    return Object.keys(rule).length > 0 ? rule : undefined;
  }

  private parseCliCommandBatchRule(
    value: unknown,
    field: string,
    manifestPath: string
  ): CliCommandBatchManifestMeta | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (!isRecord(value)) {
      throw createError('PLUGIN_INVALID', 'cli command batch must be an object', {
        manifestPath,
        field
      });
    }
    const format = asOptionalString(value.format);
    if (!format || !hasCliCommandBatchFormat(format)) {
      throw createError('PLUGIN_INVALID', 'cli command batch.format is invalid', {
        manifestPath,
        field: `${field}.format`,
        format
      });
    }
    const batch: CliCommandBatchManifestMeta = {
      format
    };
    const itemType = asOptionalString(value.itemType);
    if (itemType) {
      if (!hasCliCommandBatchItemType(itemType)) {
        throw createError('PLUGIN_INVALID', 'cli command batch.itemType is invalid', {
          manifestPath,
          field: `${field}.itemType`,
          itemType
        });
      }
      batch.itemType = itemType;
    }
    batch.itemPath = this.parseCliCommandBatchItemPathRule(value.itemPath, `${field}.itemPath`, manifestPath);
    if (batch.itemPath && batch.itemType !== 'path') {
      throw createError('PLUGIN_INVALID', 'cli command batch.itemPath requires batch.itemType: path', {
        manifestPath,
        field: `${field}.itemPath`
      });
    }
    return batch;
  }

  private parseCliCommandParameterUi(
    value: unknown,
    field: string,
    manifestPath: string
  ): CliCommandUiManifestMeta | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (!isRecord(value)) {
      throw createError('PLUGIN_INVALID', 'cli command parameter ui must be an object', {
        manifestPath,
        field
      });
    }
    const ui: CliCommandUiManifestMeta = {};
    const control = asOptionalString(value.control);
    if (control) {
      if (!hasCliCommandUiControl(control)) {
        throw createError('PLUGIN_INVALID', 'cli command parameter ui.control is invalid', {
          manifestPath,
          field: `${field}.control`,
          control
        });
      }
      ui.control = control;
    }
    if (typeof value.choices !== 'undefined') {
      if (!Array.isArray(value.choices)) {
        throw createError('PLUGIN_INVALID', 'cli command parameter ui.choices must be an array', {
          manifestPath,
          field: `${field}.choices`
        });
      }
      ui.choices = value.choices.map((item) => deepClone(item));
    }
    for (const key of ['min', 'max', 'step'] as const) {
      if (typeof value[key] === 'undefined') {
        continue;
      }
      if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
        throw createError('PLUGIN_INVALID', `cli command parameter ui.${key} must be a finite number`, {
          manifestPath,
          field: `${field}.${key}`
        });
      }
      ui[key] = value[key];
    }
    const placeholderKey = asOptionalString(value.placeholderKey);
    if (placeholderKey) {
      ui.placeholderKey = placeholderKey;
    }
    return Object.keys(ui).length > 0 ? ui : undefined;
  }

  private parseCliCommandExamples(value: unknown, field: string, manifestPath: string): string[] {
    if (typeof value === 'undefined') {
      return [];
    }
    return asStringArray(value, field, manifestPath, true);
  }

  private parseCliCommandPermissions(value: unknown, field: string, manifestPath: string): string[] {
    if (typeof value === 'undefined') {
      return [];
    }
    return asStringArray(value, field, manifestPath, true);
  }

  private parseCliCommandOutput(
    value: unknown,
    field: string,
    manifestPath: string
  ): CliCommandOutputManifestMeta | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (!isRecord(value)) {
      throw createError('PLUGIN_INVALID', 'cli command output must be an object', {
        manifestPath,
        field
      });
    }
    const output: CliCommandOutputManifestMeta = {};
    const mode = asOptionalString(value.mode);
    if (mode) {
      if (!hasCliCommandOutputMode(mode)) {
        throw createError('PLUGIN_INVALID', 'cli command output.mode is invalid', {
          manifestPath,
          field: `${field}.mode`,
          mode
        });
      }
      output.mode = mode;
    }
    const json = asOptionalString(value.json);
    if (json) {
      if (!hasCliCommandJsonOutputPolicy(json)) {
        throw createError('PLUGIN_INVALID', 'cli command output.json is invalid', {
          manifestPath,
          field: `${field}.json`,
          json
        });
      }
      output.json = json;
    }
    if (typeof value.artifacts !== 'undefined') {
      output.artifacts = asStringArray(value.artifacts, `${field}.artifacts`, manifestPath, true);
    }
    return Object.keys(output).length > 0 ? output : undefined;
  }

  private parseCliCommandJob(value: unknown, field: string, manifestPath: string): CliCommandJobManifestMeta | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (!isRecord(value)) {
      throw createError('PLUGIN_INVALID', 'cli command job must be an object', {
        manifestPath,
        field
      });
    }
    const job: CliCommandJobManifestMeta = {};
    for (const key of ['wait', 'cancelOnInterrupt'] as const) {
      if (typeof value[key] === 'undefined') {
        continue;
      }
      if (typeof value[key] !== 'boolean') {
        throw createError('PLUGIN_INVALID', `cli command job.${key} must be a boolean`, {
          manifestPath,
          field: `${field}.${key}`
        });
      }
      job[key] = value[key];
    }
    return Object.keys(job).length > 0 ? job : undefined;
  }

  private parseCliCommandConflict(
    value: unknown,
    field: string,
    manifestPath: string
  ): CliCommandConflictManifestMeta | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (!isRecord(value)) {
      throw createError('PLUGIN_INVALID', 'cli command conflict must be an object', {
        manifestPath,
        field
      });
    }
    const conflict: CliCommandConflictManifestMeta = {};
    if (typeof value.priority !== 'undefined') {
      if (typeof value.priority !== 'number' || !Number.isFinite(value.priority)) {
        throw createError('PLUGIN_INVALID', 'cli command conflict.priority must be a finite number', {
          manifestPath,
          field: `${field}.priority`
        });
      }
      conflict.priority = value.priority;
    }
    const namespace = asOptionalString(value.namespace);
    if (namespace) {
      conflict.namespace = namespace;
    }
    return Object.keys(conflict).length > 0 ? conflict : undefined;
  }

  private parseRuntimeManifestMeta(record: Record<string, unknown>, manifestPath: string): PluginRuntimeManifestMeta | undefined {
    const runtime = isRecord(record.runtime) ? record.runtime : undefined;
    if (typeof record.runtime !== 'undefined' && !runtime) {
      throw createError('PLUGIN_INVALID', 'runtime must be an object', {
        manifestPath,
        field: 'runtime'
      });
    }
    if (!runtime) {
      return undefined;
    }

    const targets = isRecord(runtime.targets) ? runtime.targets : undefined;
    if (!targets) {
      throw createError('PLUGIN_INVALID', 'runtime.targets must be an object', {
        manifestPath,
        field: 'runtime.targets'
      });
    }

    const normalizedTargets = {} as Record<PluginRuntimeTargetId, PluginRuntimeTargetManifestMeta>;
    for (const targetId of runtimeTargetIds) {
      const value = targets[targetId];
      if (!isRecord(value) || typeof value.supported !== 'boolean') {
        throw createError('PLUGIN_INVALID', `runtime.targets.${targetId}.supported must be a boolean`, {
          manifestPath,
          field: `runtime.targets.${targetId}.supported`,
          value
        });
      }
      normalizedTargets[targetId] = {
        supported: value.supported
      };
    }

    for (const targetId of Object.keys(targets)) {
      if (!runtimeTargetIds.includes(targetId as PluginRuntimeTargetId)) {
        throw createError('PLUGIN_INVALID', `runtime.targets.${targetId} is invalid`, {
          manifestPath,
          field: `runtime.targets.${targetId}`,
          value: targetId
        });
      }
    }

    return {
      targets: normalizedTargets
    };
  }

  private parseCapabilityFallbacks(
    record: Record<string, unknown>,
    manifestPath: string
  ): Record<string, PluginCapabilityFallbackManifestMeta> | undefined {
    const fallbacks = record.capabilityFallbacks;
    if (typeof fallbacks === 'undefined') {
      return undefined;
    }
    if (!isRecord(fallbacks)) {
      throw createError('PLUGIN_INVALID', 'capabilityFallbacks must be an object', {
        manifestPath,
        field: 'capabilityFallbacks'
      });
    }

    const normalized: Record<string, PluginCapabilityFallbackManifestMeta> = {};
    for (const [capabilityName, capabilityFallback] of Object.entries(fallbacks)) {
      const normalizedCapabilityName = capabilityName.trim();
      if (normalizedCapabilityName.length === 0) {
        throw createError('PLUGIN_INVALID', 'capabilityFallbacks keys must be non-empty strings', {
          manifestPath,
          field: 'capabilityFallbacks'
        });
      }
      if (!isRecord(capabilityFallback)) {
        throw createError('PLUGIN_INVALID', `capabilityFallbacks.${capabilityName} must be an object`, {
          manifestPath,
          field: `capabilityFallbacks.${capabilityName}`
        });
      }
      const whenUnsupported = asOptionalString(capabilityFallback.whenUnsupported);
      if (!whenUnsupported || !hasCapabilityFallbackBehavior(whenUnsupported)) {
        throw createError(
          'PLUGIN_INVALID',
          `capabilityFallbacks.${capabilityName}.whenUnsupported must be one of ${capabilityFallbackBehaviors.join(', ')}`,
          {
            manifestPath,
            field: `capabilityFallbacks.${capabilityName}.whenUnsupported`,
            value: capabilityFallback.whenUnsupported
          }
        );
      }
      normalized[normalizedCapabilityName] = {
        whenUnsupported
      };
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  private parseThemeManifestMeta(record: Record<string, unknown>, manifestPath: string): ThemePluginManifestMeta {
    const themeId = asOptionalString(record.themeId) ?? asOptionalString(record.id);
    if (!themeId) {
      throw createError('PLUGIN_INVALID', 'Theme plugin must declare themeId', {
        manifestPath,
        field: 'themeId'
      });
    }

    const displayName = asOptionalString(record.displayName) ?? asOptionalString(record.name);
    if (!displayName) {
      throw createError('PLUGIN_INVALID', 'Theme plugin must declare displayName or name', {
        manifestPath,
        field: 'displayName'
      });
    }

    const entry = isRecord(record.entry) ? record.entry : undefined;
    const tokensPath = asOptionalString(entry?.tokens);
    const themeCssPath = asOptionalString(entry?.themeCss);
    if (!tokensPath || !themeCssPath) {
      throw createError('PLUGIN_INVALID', 'Theme plugin entry must provide tokens and themeCss', {
        manifestPath,
        field: 'entry'
      });
    }

    const ui = isRecord(record.ui) ? record.ui : undefined;
    const layout = ui && isRecord(ui.layout) ? ui.layout : undefined;

    return {
      themeId,
      displayName,
      publisher: asOptionalString(record.publisher),
      parentTheme: asOptionalString(record.parentTheme),
      isDefault: record.isDefault === true,
      tokensPath,
      themeCssPath,
      contractPath: asOptionalString(layout?.contract)
    };
  }

  private parseLayoutManifestMeta(record: Record<string, unknown>): LayoutPluginManifestMeta {
    const layout = isRecord(record.layout) ? record.layout : undefined;
    if (!layout) {
      throw createError('PLUGIN_INVALID', 'Layout plugin must declare layout object', {
        pluginId: record.id,
        field: 'layout'
      });
    }

    return {
      layoutType: asOptionalString(layout.layoutType),
      displayName: asOptionalString(layout.displayName) ?? String(record.name)
    };
  }

  private parseModuleManifestMeta(record: Record<string, unknown>, manifestPath: string): ModulePluginManifestMeta {
    const moduleConfig = record.module;
    if (!isRecord(moduleConfig)) {
      throw createError('PLUGIN_INVALID', 'Module plugin must declare module object', {
        manifestPath,
        field: 'module'
      });
    }

    const apiVersionValue = moduleConfig.apiVersion;
    if (typeof apiVersionValue !== 'number' || !Number.isInteger(apiVersionValue) || apiVersionValue <= 0) {
      throw createError('PLUGIN_INVALID', 'module.apiVersion must be a positive integer', {
        manifestPath,
        field: 'module.apiVersion'
      });
    }

    if (moduleConfig.runtime !== 'worker') {
      throw createError('PLUGIN_INVALID', 'module.runtime must be "worker"', {
        manifestPath,
        field: 'module.runtime',
        runtime: moduleConfig.runtime
      });
    }

    const activationRaw = moduleConfig.activation;
    const activation =
      typeof activationRaw === 'undefined' || activationRaw === 'onDemand'
        ? 'onDemand'
        : activationRaw === 'eager'
          ? 'eager'
          : null;
    if (!activation) {
      throw createError('PLUGIN_INVALID', 'module.activation must be "onDemand" or "eager"', {
        manifestPath,
        field: 'module.activation',
        activation: activationRaw
      });
    }

    if (!Array.isArray(moduleConfig.provides) || moduleConfig.provides.length === 0) {
      throw createError('PLUGIN_INVALID', 'module.provides must be a non-empty array', {
        manifestPath,
        field: 'module.provides'
      });
    }

    const provides: ModuleProviderManifestMeta[] = moduleConfig.provides.map((provider, providerIndex) => {
      if (!isRecord(provider)) {
        throw createError('PLUGIN_INVALID', 'module.provides entries must be objects', {
          manifestPath,
          field: `module.provides[${providerIndex}]`
        });
      }

      const capability = asOptionalString(provider.capability);
      const version = asOptionalString(provider.version);
      if (!capability) {
        throw createError('PLUGIN_INVALID', 'module.provides[].capability is required', {
          manifestPath,
          field: `module.provides[${providerIndex}].capability`
        });
      }
      if (!version || !SEMVER_PATTERN.test(version)) {
        throw createError('PLUGIN_INVALID', 'module.provides[].version must be a semantic version', {
          manifestPath,
          field: `module.provides[${providerIndex}].version`,
          version
        });
      }
      if (!Array.isArray(provider.methods) || provider.methods.length === 0) {
        throw createError('PLUGIN_INVALID', 'module.provides[].methods must be a non-empty array', {
          manifestPath,
          field: `module.provides[${providerIndex}].methods`
        });
      }

      return {
        capability,
        version,
        description: asOptionalString(provider.description),
        methods: provider.methods.map((method, methodIndex) => {
          if (!isRecord(method)) {
            throw createError('PLUGIN_INVALID', 'module method entries must be objects', {
              manifestPath,
              field: `module.provides[${providerIndex}].methods[${methodIndex}]`
            });
          }

          const name = asOptionalString(method.name);
          const mode = method.mode;
          const inputSchema = asOptionalString(method.inputSchema);
          const outputSchema = asOptionalString(method.outputSchema);
          if (!name) {
            throw createError('PLUGIN_INVALID', 'module method name is required', {
              manifestPath,
              field: `module.provides[${providerIndex}].methods[${methodIndex}].name`
            });
          }
          if (mode !== 'sync' && mode !== 'job') {
            throw createError('PLUGIN_INVALID', 'module method mode must be "sync" or "job"', {
              manifestPath,
              field: `module.provides[${providerIndex}].methods[${methodIndex}].mode`,
              mode
            });
          }
          if (!inputSchema || !outputSchema) {
            throw createError('PLUGIN_INVALID', 'module methods must declare inputSchema and outputSchema', {
              manifestPath,
              field: `module.provides[${providerIndex}].methods[${methodIndex}]`
            });
          }

          return {
            name,
            mode,
            inputSchema,
            outputSchema,
            description: asOptionalString(method.description)
          };
        })
      };
    });

    const consumesRaw = moduleConfig.consumes;
    if (typeof consumesRaw !== 'undefined' && !Array.isArray(consumesRaw)) {
      throw createError('PLUGIN_INVALID', 'module.consumes must be an array when provided', {
        manifestPath,
        field: 'module.consumes'
      });
    }

    const consumes: ModuleConsumeManifestMeta[] = Array.isArray(consumesRaw)
      ? consumesRaw.map((consume, consumeIndex) => {
          if (!isRecord(consume)) {
            throw createError('PLUGIN_INVALID', 'module.consumes entries must be objects', {
              manifestPath,
              field: `module.consumes[${consumeIndex}]`
            });
          }

          const capability = asOptionalString(consume.capability);
          if (!capability) {
            throw createError('PLUGIN_INVALID', 'module.consumes[].capability is required', {
              manifestPath,
              field: `module.consumes[${consumeIndex}].capability`
            });
          }

          return {
            capability,
            versionRange: asOptionalString(consume.versionRange)
          };
        })
      : [];

    return {
      apiVersion: apiVersionValue,
      runtime: 'worker',
      activation,
      provides,
      consumes
    };
  }

  private async ensureManifestAssetsExist(manifest: PluginManifest, manifestPath: string): Promise<void> {
    if (!manifest.assets || manifest.assets.length === 0) {
      return;
    }

    for (const assetPath of manifest.assets) {
      const resolvedPath = path.resolve(path.dirname(manifestPath), assetPath);
      const stats = await this.statSafe(resolvedPath);
      if (!stats) {
        throw createError('PLUGIN_ENTRY_NOT_FOUND', `Plugin entry not found: ${assetPath}`, {
          manifestPath,
          entry: assetPath
        });
      }
    }
  }

  private manifestRank(fileName: string): number {
    const normalized = fileName.toLowerCase();
    if (normalized === 'manifest.yaml') {
      return 0;
    }
    if (normalized === 'manifest.yml') {
      return 1;
    }
    if (normalized === 'manifest.json') {
      return 2;
    }
    if (normalized.endsWith('.plugin.json')) {
      return 3;
    }
    return 4;
  }

  private isManifestFileName(fileName: string): boolean {
    const normalized = fileName.toLowerCase();
    return (
      normalized === 'manifest.yaml' ||
      normalized === 'manifest.yml' ||
      normalized === 'manifest.json' ||
      normalized.endsWith('.plugin.json')
    );
  }

  private async statSafe(inputPath: string): Promise<{ isDirectory: () => boolean; isFile: () => boolean } | null> {
    try {
      return await fs.stat(inputPath);
    } catch {
      return null;
    }
  }

  private async persist(): Promise<void> {
    await fs.mkdir(this.workspacePath, { recursive: true });
    await fs.writeFile(this.recordsPath(), JSON.stringify(this.query(), null, 2), 'utf-8');
  }
}
