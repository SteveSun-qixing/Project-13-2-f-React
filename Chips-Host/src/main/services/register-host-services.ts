import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createError } from '../../shared/errors';
import { schemaRegistry } from '../../shared/schema';
import { createId, deepClone } from '../../shared/utils';
import type { LogEntry, RouteDescriptor, RouteInvocationContext, ServiceRegistration } from '../../shared/types';
import { mergeThemeLayers, resolveThemeFromLayers } from '../theme-runtime/resolve-algorithm';
import { buildThemeContractsView, type ThemeContract, validateThemeContractWithTokens } from '../theme-runtime/contract-guard';
import { toRenderThemeSnapshot } from '../theme-runtime/render-bridge';
import { StructuredLogger } from '../../shared/logger';
import type { PluginUiConfig } from '../../shared/window-chrome';
import { resolveManifestWindowChrome } from '../../shared/window-chrome';
import { PluginRuntime } from '../../runtime';
import type { Kernel } from '../../../packages/kernel/src';
import type { PALAdapter, WindowChromeOptions } from '../../../packages/pal/src';
import { CardService } from '../../../packages/card-service/src';
import { BoxService } from '../../../packages/box-service/src';
import { StoreZipService } from '../../../packages/zip-service/src';

interface HostServiceContext {
  kernel: Kernel;
  pal: PALAdapter;
  workspacePath: string;
  logger: StructuredLogger;
  getCardService: () => CardService;
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

interface ModuleRecord {
  slot: string;
  module: Record<string, unknown>;
  mountedAt: number;
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
  modules: Map<string, ModuleRecord>;
  credentials: Map<string, { iv: string; tag: string; value: string }>;
  clipboard: unknown;
  themes: ThemeRecord[];
  currentThemeId: string;
  locale: string;
  locales: Record<string, Record<string, string>>;
  routeMetrics: Map<string, RouteMetric>;
  activatedServices: Set<string>;
}

type ConfigScope = 'user' | 'workspace' | 'system';

const ensureWorkspace = async (workspacePath: string): Promise<void> => {
  await fs.mkdir(workspacePath, { recursive: true });
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
  modules: new Map<string, ModuleRecord>(),
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
  if (!isRecord(parsed) || !Array.isArray(parsed.components) || typeof parsed.version !== 'string') {
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
    css,
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

const getPreferredLauncherIconExtensions = (): string[] => {
  if (process.platform === 'darwin') {
    return ['.icns', '.png', '.ico', '.svg'];
  }
  if (process.platform === 'win32') {
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

const resolvePluginIconPath = async (record: ReturnType<PluginRuntime['get']>): Promise<string | undefined> => {
  const declaredIconPath = record.manifest.ui?.launcher?.icon;
  if (typeof declaredIconPath === 'string' && declaredIconPath.trim().length > 0) {
    const resolvedDeclaredPath = path.resolve(record.installPath, declaredIconPath);
    const preferredDeclaredVariants = [
      ...getPreferredLauncherIconExtensions().map((extension) => {
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
      return getPreferredLauncherIconExtensions().map((extension) => `assets/icons/${name}${extension}`);
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

const resolveLaunchExecutable = (): { executablePath: string; argsPrefix: string[] } => {
  const executablePath = process.execPath;
  const appEntryPath = resolveAppEntryPath();

  return {
    executablePath,
    argsPrefix: [appEntryPath]
  };
};

const buildPluginShortcutArgs = (workspacePath: string, pluginId: string): string[] => {
  const target = resolveLaunchExecutable();
  return [...target.argsPrefix, `--workspace=${workspacePath}`, `--chips-launch-plugin=${pluginId}`];
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
  const plugin = ctx.runtime.get(pluginId);
  if (plugin.manifest.type !== 'app') {
    throw createError('PLUGIN_TYPE_UNSUPPORTED', `Only app plugins can be launched: ${pluginId}`);
  }
  if (!plugin.enabled) {
    throw createError('PLUGIN_DISABLED', `Plugin disabled: ${pluginId}`);
  }

  const session = ctx.runtime.pluginInit(pluginId, launchParams);
  await ctx.kernel.events.emit('plugin.init', 'plugin-service', { pluginId, sessionId: session.sessionId });
  ctx.runtime.completeHandshake(session.sessionId, session.sessionNonce);
  await ctx.kernel.events.emit('plugin.ready', 'plugin-service', { pluginId, sessionId: session.sessionId });

  const chrome = resolveManifestWindowChrome(plugin.manifest.ui);
  const defaultWidth = Number(state.configUser.get('window.defaultWidth') ?? state.configWorkspace.get('window.defaultWidth') ?? 1280);
  const defaultHeight = Number(state.configUser.get('window.defaultHeight') ?? state.configWorkspace.get('window.defaultHeight') ?? 800);
  const url =
    plugin.installPath && typeof plugin.manifest.entry === 'string'
      ? path.resolve(plugin.installPath, plugin.manifest.entry)
      : undefined;
  const windowTitle = plugin.manifest.ui?.launcher?.displayName ?? plugin.manifest.name;

  const window = await ctx.pal.window.create({
    title: windowTitle,
    width: Number.isFinite(defaultWidth) ? defaultWidth : 1280,
    height: Number.isFinite(defaultHeight) ? defaultHeight : 800,
    pluginId,
    sessionId: session.sessionId,
    permissions: session.permissions,
    launchParams: session.launchParams,
    url,
    chrome
  });

  await ctx.kernel.events.emit('window.opened', 'plugin-service', window);
  await ctx.kernel.events.emit('plugin.launched', 'plugin-service', {
    pluginId,
    sessionId: session.sessionId,
    windowId: window.id
  });

  return {
    window: {
      id: window.id,
      chrome
    },
    session: {
      sessionId: session.sessionId,
      sessionNonce: session.sessionNonce,
      permissions: [...session.permissions]
    }
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
  const iconPath = await resolvePluginIconPath(plugin);
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
  const iconPath = await resolvePluginIconPath(plugin);
  const created = await ctx.pal.launcher.create({
    pluginId,
    name: shortcutName,
    launcherPath: existingPath,
    executablePath: launchTarget.executablePath,
    args: buildPluginShortcutArgs(ctx.workspacePath, pluginId),
    iconPath
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
    const context = resolveThemeContext(state, []);
    const backgroundColor =
      asString(context.resolvedTheme.variables['chips.sys.color.canvas']) ??
      asString(context.resolvedTheme.variables['chips.sys.color.surface']);

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

const syncInstalledThemes = async (ctx: HostServiceContext, state: RuntimeState): Promise<void> => {
  const previousThemeId = state.currentThemeId;
  state.themes = await loadInstalledThemes(ctx.runtime);
  syncCurrentThemeState(state);

  if (state.currentThemeId !== previousThemeId && state.themes.length > 0) {
    await ctx.kernel.events.emit('theme.changed', 'theme-service', {
      previousThemeId,
      themeId: state.currentThemeId,
      timestamp: Date.now()
    });
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
        descriptor: descriptor<{ path: string; content: string | Buffer }, { ack: true }>(
          'file.write',
          ['file.write'],
          5_000,
          false,
          0,
          withMetrics(state, 'file.write', async (input) => {
            await ctx.pal.fs.writeFile(input.path, input.content);
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
        descriptor: descriptor<{ dir: string; options?: { recursive?: boolean } }, { entries: string[] }>(
          'file.list',
          ['file.read'],
          5_000,
          true,
          0,
          withMetrics(state, 'file.list', async (input) => {
            const entries = await ctx.pal.fs.list(input.dir, input.options);
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
      exists: {
        descriptor: descriptor<{ path: string }, { exists: boolean }>(
          'file.exists',
          ['file.read'],
          5_000,
          true,
          0,
          withMetrics(state, 'file.exists', async (input) => {
            const exists = await ctx.pal.fs.exists(input.path);
            return { exists };
          })
        )
      },
      mkdir: {
        descriptor: descriptor<{ path: string; options?: { recursive?: boolean } }, { ack: true }>(
          'file.mkdir',
          ['file.manage'],
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
          ['file.manage'],
          5_000,
          false,
          0,
          withMetrics(state, 'file.delete', async (input) => {
            await ctx.pal.fs.delete(input.path, input.options);
            return { ack: true };
          })
        )
      },
      copy: {
        descriptor: descriptor<
          { source: string; destination: string; options?: { overwrite?: boolean } },
          { ack: true }
        >(
          'file.copy',
          ['file.manage'],
          5_000,
          false,
          0,
          withMetrics(state, 'file.copy', async (input) => {
            await ctx.pal.fs.copy(input.source, input.destination, input.options);
            return { ack: true };
          })
        )
      },
      move: {
        descriptor: descriptor<
          { source: string; destination: string; options?: { overwrite?: boolean } },
          { ack: true }
        >(
          'file.move',
          ['file.manage'],
          5_000,
          false,
          0,
          withMetrics(state, 'file.move', async (input) => {
            await ctx.pal.fs.move(input.source, input.destination, input.options);
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
            const uri = input.resourceId.startsWith('file://') ? input.resourceId : `file://${input.resourceId}`;
            return { uri };
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
            const normalized = input.resourceId.replace(/^file:\/\//, '');
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
            const normalized = input.resourceId.replace(/^file:\/\//, '');
            const data = await ctx.pal.fs.readFile(normalized);
            if (!Buffer.isBuffer(data)) {
              return { data: Buffer.from(data, 'utf-8') };
            }
            return { data };
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

            await ctx.kernel.events.emit('theme.changed', 'theme-service', {
              previousThemeId,
              themeId: context.activeTheme.id,
              timestamp: Date.now()
            });

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
          {
            resolved: Array<{
              id: string;
              displayName: string;
              order: number;
            }>;
            tokens: Record<string, unknown>;
          }
        >(
          'theme.resolve',
          ['theme.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'theme.resolve', async (input) => {
            const context = resolveThemeContext(state, input.chain);
            return {
              resolved: context.records.map((theme, index) => ({
                id: theme.id,
                displayName: theme.displayName,
                order: index
              })),
              tokens: context.resolvedTheme.variables
            };
          })
        )
      },
      contractGet: {
        descriptor: descriptor<
          { component?: string },
          {
            contracts: {
              [component: string]: {
                scope: string;
                parts: string[];
                states: string[];
                tokens: string[];
              };
            };
          }
        >(
          'theme.contract.get',
          ['theme.read'],
          2_000,
          true,
          0,
          withMetrics(state, 'theme.contract.get', async (input) => {
            const theme = findThemeRecord(state, state.currentThemeId);
            if (!theme) {
              throw createError('THEME_NOT_FOUND', 'Current theme not found');
            }
            return buildThemeContractsView(theme.contract, input.component);
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
            const window = await ctx.pal.window.create({
              ...input.config,
              chrome: resolveThemedWindowChrome(state, input.config.chrome)
            });
            await ctx.kernel.events.emit('window.opened', 'window-service', window);
            return { window };
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
            await ctx.pal.window.focus(input.windowId);
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
            await ctx.pal.window.resize(input.windowId, input.width, input.height);
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
            await ctx.pal.window.setState(input.windowId, input.state);
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
            const state = await ctx.pal.window.getState(input.windowId);
            return { state };
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
            await ctx.pal.window.close(input.windowId);
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
              await removePluginShortcut(ctx, input.pluginId).catch(() => undefined);
            }
            await ctx.runtime.uninstall(input.pluginId);
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

  const moduleService: ServiceRegistration = {
    name: 'module',
    actions: {
      mount: {
        descriptor: descriptor<{ slot: string; module: Record<string, unknown> }, { ack: true }>(
          'module.mount',
          ['module.manage'],
          3_000,
          false,
          0,
          withMetrics(state, 'module.mount', async (input) => {
            state.modules.set(input.slot, {
              slot: input.slot,
              module: input.module,
              mountedAt: Date.now()
            });
            return { ack: true };
          })
        )
      },
      unmount: {
        descriptor: descriptor<{ slot: string }, { ack: true }>(
          'module.unmount',
          ['module.manage'],
          3_000,
          false,
          0,
          withMetrics(state, 'module.unmount', async (input) => {
            state.modules.delete(input.slot);
            return { ack: true };
          })
        )
      },
      query: {
        descriptor: descriptor<{ slot: string }, { module: ModuleRecord | null }>(
          'module.query',
          ['module.manage'],
          3_000,
          true,
          0,
          withMetrics(state, 'module.query', async (input) => {
            const module = state.modules.get(input.slot) ?? null;
            return { module };
          })
        )
      },
      list: {
        descriptor: descriptor<Record<string, unknown>, { modules: ModuleRecord[] }>(
          'module.list',
          ['module.manage'],
          3_000,
          true,
          0,
          withMetrics(state, 'module.list', async () => {
            return { modules: [...state.modules.values()] };
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
            const info = await ctx.pal.platform.getInfo();
            return { info };
          })
        )
      },
      getCapabilities: {
        descriptor: descriptor<Record<string, unknown>, { capabilities: string[] }>(
          'platform.getCapabilities',
          ['platform.read'],
          3_000,
          true,
          0,
          withMetrics(state, 'platform.getCapabilities', async () => {
            const capabilities = await ctx.pal.platform.getCapabilities();
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
            const screen = await ctx.pal.screen.getPrimary();
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
            const screens = await ctx.pal.screen.getAll();
            return { screens };
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
            await ctx.pal.shell.openExternal(input.url);
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
            const filePaths = await ctx.pal.dialog.openFile(input.options);
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
            const filePath = await ctx.pal.dialog.saveFile(input.options);
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
            const response = await ctx.pal.dialog.showMessage({
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
            const confirmed = await ctx.pal.dialog.showConfirm({
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
            const data = await ctx.pal.clipboard.read(format);
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
            await ctx.pal.clipboard.write(input.data as never, format);
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
            await ctx.pal.shell.openPath(input.path);
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
            await ctx.pal.shell.openExternal(input.url);
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
            await ctx.pal.shell.showItemInFolder(input.path);
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
            await ctx.pal.notification.show(input.options);
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
            const tray = await ctx.pal.tray.set(input.options ?? {});
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
            await ctx.pal.tray.clear();
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
            const tray = await ctx.pal.tray.getState();
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
            const registered = await ctx.pal.shortcut.register(input.accelerator, () => {
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
            await ctx.pal.shortcut.unregister(input.accelerator);
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
            const registered = await ctx.pal.shortcut.isRegistered(input.accelerator);
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
            const accelerators = await ctx.pal.shortcut.list();
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
            await ctx.pal.shortcut.clear();
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
            const powerState = await ctx.pal.power.getState();
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
            const preventSleep = await ctx.pal.power.setPreventSleep(Boolean(input.prevent));
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
      getBaseCard: {
        descriptor: descriptor<
          { cardFile: string; nodeId: string },
          {
            baseCard: {
              nodeId: string;
              cardType: string;
              pluginId: string;
              title: string;
              contentPath: string;
              config: Record<string, unknown>;
            };
          }
        >(
          'card.getBaseCard',
          ['card.read'],
          10_000,
          true,
          0,
          withMetrics(state, 'card.getBaseCard', async (input) => {
            const baseCard = await ctx.getCardService().getBaseCard(input.cardFile, input.nodeId);
            return { baseCard };
          })
        )
      },
      render: {
        descriptor: descriptor<
          {
            cardFile: string;
            options?: {
              target?: 'app-root' | 'card-iframe' | 'module-slot' | 'offscreen-render';
              viewport?: { width?: number; height?: number; scrollTop?: number; scrollLeft?: number };
              verifyConsistency?: boolean;
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
            const themeContext = resolveThemeContext(state, []);
            const view = await ctx.getCardService().render(input.cardFile, {
              ...input.options,
              theme: themeContext.renderTheme,
              themeCssText: themeContext.css
            });
            return { view };
          })
        )
      },
      renderBaseCardEditor: {
        descriptor: descriptor<
          { cardFile: string; nodeId: string },
          {
            editor: {
              title: string;
              body: string;
              protocolVersion: string;
              baseCard: {
                nodeId: string;
                cardType: string;
                pluginId: string;
                title: string;
                contentPath: string;
                config: Record<string, unknown>;
              };
            };
          }
        >(
          'card.renderBaseCardEditor',
          ['card.read'],
          10_000,
          false,
          0,
          withMetrics(state, 'card.renderBaseCardEditor', async (input) => {
            const themeContext = resolveThemeContext(state, []);
            const editor = await ctx.getCardService().renderBaseCardEditor(
              input.cardFile,
              input.nodeId,
              themeContext.renderTheme,
              themeContext.css
            );
            return { editor };
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
      updateBaseCard: {
        descriptor: descriptor<
          { cardFile: string; nodeId: string; config: Record<string, unknown> },
          {
            baseCard: {
              nodeId: string;
              cardType: string;
              pluginId: string;
              title: string;
              contentPath: string;
              config: Record<string, unknown>;
            };
          }
        >(
          'card.updateBaseCard',
          ['card.write'],
          10_000,
          false,
          0,
          withMetrics(state, 'card.updateBaseCard', async (input) => {
            const baseCard = await ctx.getCardService().updateBaseCard(input.cardFile, input.nodeId, input.config);
            return { baseCard };
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
          ['box.pack'],
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
          ['box.pack'],
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
      }
    }
  };

  const zipService: ServiceRegistration = {
    name: 'zip',
    actions: {
      compress: {
        descriptor: descriptor<{ inputDir: string; outputZip: string }, { outputZip: string }>(
          'zip.compress',
          ['zip.manage'],
          12_000,
          false,
          0,
          withMetrics(state, 'zip.compress', async (input) => {
            await ctx.getZipService().compress(input.inputDir, input.outputZip);
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
    windowService,
    pluginService,
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

  const services = createServices(ctx, runtimeState);
  for (const service of services) {
    ctx.kernel.registerService(service);
  }
};
