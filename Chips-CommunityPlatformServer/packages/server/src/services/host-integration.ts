import { HeadlessHostShell } from 'chips-host/headless-host-shell';
import * as crypto from 'crypto';
import { env } from '../config/env.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';
import {
  resolveWebResourceOpenPlanFromPlugins,
  type WebResourceOpenPlan,
  type WebResourceOpenRequest,
} from './web-resource-open-plan.js';

export type { WebResourceOpenPlan, WebResourceOpenRequest } from './web-resource-open-plan.js';

interface ModuleInvokeResult<TOutput> {
  mode: 'sync' | 'job';
  output?: TOutput;
  jobId?: string;
}

interface ModuleJobView<TOutput> {
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  output?: TOutput;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    retryable?: boolean;
  };
}

interface MinimalPluginManifest {
  entry?: string | Record<string, unknown>;
  preview?: string;
  ui?: {
    layout?: {
      contract?: string;
      minFunctionalSet?: string;
    };
    launcher?: {
      icon?: string;
    };
  };
  module?: {
    provides?: Array<{
      methods?: Array<{
        inputSchema?: string;
        outputSchema?: string;
      }>;
    }>;
  };
}

interface RuntimePluginRecord {
  manifest: {
    id: string;
    name: string;
    type: 'app' | 'card' | 'layout' | 'module' | 'theme';
    entry?: string | Record<string, unknown>;
    permissions: string[];
    runtime?: {
      targets?: Record<string, { supported?: boolean }>;
    };
    ui?: {
      launcher?: {
        displayName?: string;
      };
    };
    capabilities?: string[];
    theme?: {
      themeId?: string;
      displayName?: string;
      version?: string;
      parentTheme?: string;
      tokensPath?: string;
      themeCssPath?: string;
      contractPath?: string;
    };
  };
  installPath: string;
  enabled: boolean;
}

interface RuntimeSessionRecord {
  sessionId: string;
  pluginId: string;
  permissions: string[];
  launchParams: Record<string, unknown>;
  sessionNonce: string;
  status: 'handshaking' | 'running' | 'stopped';
}

export interface WebPluginSessionView {
  sessionId: string;
  pluginId: string;
  title: string;
  launchParams: Record<string, unknown>;
  permissions: string[];
}

export interface WebPluginEntryView extends WebPluginSessionView {
  entryPath: string;
  entryDir: string;
}

export interface WebThemeRuntimeView {
  themeId: string;
  displayName: string;
  version: string;
  parentTheme?: string;
  css: string;
  tokens: Record<string, unknown>;
  resolved: Array<{ id: string; displayName: string; version: string; order: number }>;
  diagnostics?: unknown[];
  summary?: unknown;
}

export interface FileConvertResult {
  outputPath: string;
  artifacts: Array<{
    type: string;
    path: string;
    entryFile?: string;
    mimeType?: string;
  }>;
  warnings?: Array<{
    code: string;
    message: string;
    details?: unknown;
  }>;
}

const MODULE_JOB_POLL_MS = 50;
const WEB_RUNTIME_TARGET = 'web';
const CSS_URL_PATTERN = /url\(\s*(?:'([^']+)'|"([^"]+)"|([^'")]+))\s*\)/gi;

interface WebThemeAssetRoot {
  themeId: string;
  installPath: string;
}

function splitCssUrlSuffix(input: string): { pathname: string; suffix: string } {
  const queryIndex = input.indexOf('?');
  const hashIndex = input.indexOf('#');
  const splitIndex = [queryIndex, hashIndex].filter((value) => value >= 0).sort((left, right) => left - right)[0] ?? -1;

  if (splitIndex < 0) {
    return { pathname: input, suffix: '' };
  }

  return {
    pathname: input.slice(0, splitIndex),
    suffix: input.slice(splitIndex),
  };
}

function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative.length === 0 || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function buildWebThemeAssetUrl(themeId: string, relativePath: string, suffix: string): string {
  const encodedPath = relativePath
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/api/v1/host/theme-assets/${encodeURIComponent(themeId)}/${encodedPath}${suffix}`;
}

export function rewriteWebThemeCssAssetUrls(cssText: string, assetRoots: WebThemeAssetRoot[]): string {
  if (!cssText.trim() || assetRoots.length === 0) {
    return cssText;
  }

  const normalizedRoots = assetRoots.map((root) => ({
    themeId: root.themeId,
    installPath: path.resolve(root.installPath),
  }));

  return cssText.replace(CSS_URL_PATTERN, (match, singleQuoted, doubleQuoted, bareValue) => {
    const rawValue = String(singleQuoted ?? doubleQuoted ?? bareValue ?? '').trim();
    if (!rawValue || !rawValue.startsWith('file:')) {
      return match;
    }

    const { pathname, suffix } = splitCssUrlSuffix(rawValue);
    let filePath = '';
    try {
      filePath = fileURLToPath(pathname);
    } catch {
      return match;
    }

    const matchingRoot = normalizedRoots.find((root) => isPathInsideRoot(root.installPath, filePath));
    if (!matchingRoot) {
      return match;
    }

    const relativePath = path.relative(matchingRoot.installPath, filePath).split(path.sep).join('/');
    return `url("${buildWebThemeAssetUrl(matchingRoot.themeId, relativePath, suffix)}")`;
  });
}

export class HostIntegrationService {
  private static instance: HostIntegrationService;
  private host!: HeadlessHostShell;
  private workspacePath: string;
  private initialized = false;
  private ecosystemRoot?: string;
  private readonly kernelCaller = {
    id: 'community-platform-server',
    type: 'app',
    permissions: ['plugin.manage', 'theme.read', 'theme.write', 'module.invoke', 'module.read', 'card.write']
  } as const;

  private constructor() {
    const role = path.basename(process.argv[1] ?? '').includes('worker') ? 'worker' : 'server';
    this.workspacePath = path.resolve(process.cwd(), `.chips-server-host-${role}`);
  }

  public static getInstance(): HostIntegrationService {
    if (!HostIntegrationService.instance) {
      HostIntegrationService.instance = new HostIntegrationService();
    }
    return HostIntegrationService.instance;
  }

  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await fs.rm(this.workspacePath, { recursive: true, force: true });
    await fs.mkdir(this.workspacePath, { recursive: true });

    this.host = new HeadlessHostShell({
      workspacePath: this.workspacePath,
      builtInPlugins: []
    });

    try {
      await this.host.start();
    } catch (error) {
      console.warn('[HostIntegration] Host start failed, wiping workspace and retrying...', error);
      await fs.rm(this.workspacePath, { recursive: true, force: true });
      await fs.mkdir(this.workspacePath, { recursive: true });
      this.host = new HeadlessHostShell({
        workspacePath: this.workspacePath,
        builtInPlugins: []
      });
      await this.host.start();
    }

    const pluginSources = this.resolvePluginSources();
    for (const source of pluginSources.appPlugins) {
      await this.installAndEnablePlugin(source);
    }
    for (const source of pluginSources.cardPlugins) {
      await this.installAndEnablePlugin(source);
    }
    for (const source of pluginSources.layoutPlugins) {
      await this.installAndEnablePlugin(source);
    }
    for (const source of pluginSources.modulePlugins) {
      await this.installAndEnablePlugin(source);
    }
    for (const source of pluginSources.themePlugins) {
      await this.installAndEnablePlugin(source);
    }

    this.initialized = true;
    console.log('[HostIntegration] Service initialized successfully');
  }

  public async packCard(cardDir: string, outputPath: string): Promise<string> {
    if (!this.initialized) {
      await this.init();
    }

    const result = await this.host.kernel.invoke<{ cardDir: string; outputPath: string }, { cardFile: string }>(
      'card.pack',
      { cardDir, outputPath },
      this.createKernelContext()
    );
    return result.cardFile;
  }

  public async convertCardToHtml(params: {
    cardFile: string;
    outputPath: string;
    overwrite?: boolean;
    locale?: string;
    themeId?: string;
  }): Promise<FileConvertResult> {
    const { cardFile, outputPath, overwrite = true, locale, themeId } = params;

    return this.invokeModule<FileConvertResult>({
      capability: 'converter.file.convert',
      method: 'convert',
      input: {
        source: {
          type: 'card',
          path: cardFile,
        },
        target: {
          type: 'html',
        },
        output: {
          path: outputPath,
          overwrite,
        },
        options: {
          html: {
            packageMode: 'directory',
            includeAssets: true,
            includeManifest: false,
          },
          ...(locale ? { locale } : {}),
          ...(themeId ? { themeId } : {}),
        },
      },
    });
  }

  public async stop(): Promise<void> {
    if (this.host) {
      await this.host.stop();
    }
  }

  public async openWebPluginSession(params: {
    pluginId: string;
    launchParams?: Record<string, unknown>;
  }): Promise<WebPluginSessionView> {
    if (!this.initialized) {
      await this.init();
    }

    const plugin = this.getRuntimePluginRecord(params.pluginId);
    this.ensurePluginSupportsWeb(plugin);
    const entryPath = this.resolvePluginEntryPath(plugin);
    if (!entryPath.toLowerCase().endsWith('.html')) {
      throw new Error(`Web plugin entry must be an HTML file: ${entryPath}`);
    }

    const session = this.host.runtime.pluginInit(params.pluginId, params.launchParams ?? {});
    this.host.runtime.completeHandshake(session.sessionId, session.sessionNonce);

    return {
      sessionId: session.sessionId,
      pluginId: session.pluginId,
      title: plugin.manifest.ui?.launcher?.displayName ?? plugin.manifest.name,
      launchParams: { ...session.launchParams },
      permissions: [...session.permissions],
    };
  }

  public getWebPluginSession(sessionId: string): WebPluginSessionView {
    const session = this.getRuntimeSession(sessionId);
    const plugin = this.getRuntimePluginRecord(session.pluginId);
    this.ensurePluginSupportsWeb(plugin);

    return {
      sessionId: session.sessionId,
      pluginId: session.pluginId,
      title: plugin.manifest.ui?.launcher?.displayName ?? plugin.manifest.name,
      launchParams: { ...session.launchParams },
      permissions: [...session.permissions],
    };
  }

  public getWebPluginEntry(sessionId: string): WebPluginEntryView {
    const session = this.getRuntimeSession(sessionId);
    const plugin = this.getRuntimePluginRecord(session.pluginId);
    this.ensurePluginSupportsWeb(plugin);
    const entryPath = this.resolvePluginEntryPath(plugin);

    return {
      sessionId: session.sessionId,
      pluginId: session.pluginId,
      title: plugin.manifest.ui?.launcher?.displayName ?? plugin.manifest.name,
      launchParams: { ...session.launchParams },
      permissions: [...session.permissions],
      entryPath,
      entryDir: path.dirname(entryPath),
    };
  }

  public resolveWebPluginAssetPath(sessionId: string, assetPath: string): string {
    const entry = this.getWebPluginEntry(sessionId);
    const normalizedAssetPath = assetPath.replace(/^\/+/, '');
    const candidateRoots = [path.join(entry.entryDir, 'assets'), entry.entryDir];

    for (const candidateRoot of candidateRoots) {
      const resolvedPath = path.resolve(candidateRoot, normalizedAssetPath);
      const relative = path.relative(candidateRoot, resolvedPath);

      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        continue;
      }

      if (fsSync.existsSync(resolvedPath) && fsSync.statSync(resolvedPath).isFile()) {
        return resolvedPath;
      }
    }

    throw new Error(`Resolved plugin asset not found: ${assetPath}`);
  }

  public async getWebThemeRuntime(): Promise<WebThemeRuntimeView> {
    if (!this.initialized) {
      await this.init();
    }

    const [current, cssResult, resolved] = await Promise.all([
      this.host.kernel.invoke<Record<string, never>, {
        themeId: string;
        displayName: string;
        version: string;
        parentTheme?: string;
      }>('theme.getCurrent', {}, this.createKernelContext()),
      this.host.kernel.invoke<Record<string, never>, { css: string; themeId: string }>(
        'theme.getAllCss',
        {},
        this.createKernelContext(),
      ),
      this.host.kernel.invoke<{ chain: string[] }, {
        resolved: Array<{ id: string; displayName: string; version: string; order: number }>;
        tokens: Record<string, unknown>;
        diagnostics?: unknown[];
        summary?: unknown;
      }>('theme.resolve', { chain: [] }, this.createKernelContext()),
    ]);

    return {
      themeId: current.themeId,
      displayName: current.displayName,
      version: current.version,
      ...(current.parentTheme ? { parentTheme: current.parentTheme } : {}),
      css: this.rewriteThemeCssAssetUrlsForWeb(cssResult.css),
      tokens: resolved.tokens ?? {},
      resolved: resolved.resolved ?? [],
      ...(resolved.diagnostics ? { diagnostics: resolved.diagnostics } : {}),
      ...(resolved.summary ? { summary: resolved.summary } : {}),
    };
  }

  public resolveWebThemeAssetPath(themeId: string, assetPath: string): string {
    const normalizedThemeId = themeId.trim();
    if (!normalizedThemeId) {
      throw new Error('themeId is required');
    }

    const plugin = this.findRuntimeThemePluginRecord(normalizedThemeId);
    const normalizedAssetPath = assetPath.replace(/^\/+/, '');
    const resolvedPath = path.resolve(plugin.installPath, normalizedAssetPath);
    const relative = path.relative(plugin.installPath, resolvedPath);

    if (!normalizedAssetPath || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Theme asset escaped install root: ${assetPath}`);
    }

    if (!fsSync.existsSync(resolvedPath) || !fsSync.statSync(resolvedPath).isFile()) {
      throw new Error(`Theme asset not found: ${assetPath}`);
    }

    return resolvedPath;
  }

  public closeWebPluginSession(sessionId: string): void {
    if (!this.initialized) {
      return;
    }

    this.host.runtime.stopSession(sessionId);
  }

  public async resolveWebResourceOpenPlan(request: WebResourceOpenRequest): Promise<WebResourceOpenPlan> {
    if (!this.initialized) {
      await this.init();
    }

    const plugins = this.host.runtime
      .query({ type: 'app' })
      .filter((record) => record.enabled)
      .filter((record) => (record.manifest.runtime?.targets?.[WEB_RUNTIME_TARGET]?.supported ?? false));

    return resolveWebResourceOpenPlanFromPlugins(request, plugins);
  }

  private async installAndEnablePlugin(sourcePath: string): Promise<string> {
    const stagedSource = await this.preparePluginInstallSource(sourcePath);
    try {
      const installResult = await this.host.kernel.invoke<{ manifestPath: string }, { pluginId: string }>(
        'plugin.install',
        { manifestPath: stagedSource.installPath },
        this.createKernelContext()
      );
      await this.host.kernel.invoke(
        'plugin.enable',
        { pluginId: installResult.pluginId },
        this.createKernelContext()
      );
      console.log(`[HostIntegration] Installed and enabled plugin: ${installResult.pluginId}`);
      return installResult.pluginId;
    } finally {
      await stagedSource.cleanup();
    }
  }

  private async invokeModule<TOutput>(params: {
    capability: string;
    method: string;
    input: Record<string, unknown>;
    pluginId?: string;
    timeoutMs?: number;
  }): Promise<TOutput> {
    if (!this.initialized) {
      await this.init();
    }

    const started = await this.host.kernel.invoke<
      {
        capability: string;
        method: string;
        input: Record<string, unknown>;
        pluginId?: string;
        timeoutMs?: number;
      },
      ModuleInvokeResult<TOutput>
    >(
      'module.invoke',
      params,
      this.createKernelContext()
    );

    if (started.mode === 'sync') {
      return started.output as TOutput;
    }

    if (!started.jobId) {
      throw new Error(`Module ${params.capability}.${params.method} returned no job id`);
    }

    for (;;) {
      await this.sleep(MODULE_JOB_POLL_MS);

      const snapshot = await this.host.kernel.invoke<{ jobId: string }, { job: ModuleJobView<TOutput> }>(
        'module.job.get',
        { jobId: started.jobId },
        this.createKernelContext()
      );

      if (snapshot.job.status === 'completed') {
        return snapshot.job.output as TOutput;
      }

      if (snapshot.job.status === 'failed' || snapshot.job.status === 'cancelled') {
        const error = new Error(
          snapshot.job.error?.message ?? `Module ${params.capability}.${params.method} ${snapshot.job.status}`
        ) as Error & { code?: string; details?: unknown; retryable?: boolean };
        error.code = snapshot.job.error?.code;
        error.details = snapshot.job.error?.details;
        error.retryable = snapshot.job.error?.retryable;
        throw error;
      }
    }
  }

  private resolvePluginSources(): {
    appPlugins: string[];
    cardPlugins: string[];
    layoutPlugins: string[];
    themePlugins: string[];
    modulePlugins: string[];
  } {
    const root = this.resolveEcosystemRoot();

    const defaultAppPlugins = [
      path.join(root, 'Chips-CardViewer'),
      path.join(root, 'Chips-PhotoViewer'),
      path.join(root, 'Chips-MusicPlayer'),
      path.join(root, 'Chips-VideoPlayer'),
      path.join(root, 'Chips-BookReader'),
    ];
    const defaultCardPlugins = [
      path.join(root, 'Chips-BaseCardPlugin/richtext-BCP'),
      path.join(root, 'Chips-BaseCardPlugin/image-BCP'),
      path.join(root, 'Chips-BaseCardPlugin/webpage-BCP'),
      path.join(root, 'Chips-BaseCardPlugin/music-BCP'),
      path.join(root, 'Chips-BaseCardPlugin/video-BCP'),
      path.join(root, 'Chips-BaseCardPlugin/score-BCP'),
      path.join(root, 'Chips-BaseCardPlugin/book-BCP'),
      path.join(root, 'Chips-BaseCardPlugin/hyperlink-BCP'),
    ];
    const defaultLayoutPlugins = [
      path.join(root, 'Chips-BoxLayoutPlugin/grid-BLP'),
    ];
    const defaultThemePlugins: string[] = [];
    const defaultModulePlugins = [
      this.resolvePackagedPluginSource(path.join(root, 'Chips-ModulePlugin/Chips-CardtoHTML-Plugin')),
      this.resolvePackagedPluginSource(path.join(root, 'Chips-ModulePlugin/Chips-FileConversion-Plugin')),
      this.resolvePackagedPluginSource(path.join(root, 'Chips-ModulePlugin/Chips-CommunityUploader-Plugin')),
    ];

    return {
      appPlugins: this.resolveConfiguredPluginList(env.HOST_APP_PLUGIN_PATHS, defaultAppPlugins),
      cardPlugins: this.resolveConfiguredPluginList(env.HOST_CARD_PLUGIN_PATHS, defaultCardPlugins),
      layoutPlugins: this.resolveConfiguredPluginList(env.HOST_LAYOUT_PLUGIN_PATHS, defaultLayoutPlugins),
      themePlugins: this.resolveConfiguredPluginList(env.HOST_THEME_PLUGIN_PATHS, defaultThemePlugins),
      modulePlugins: this.resolveConfiguredPluginList(env.HOST_MODULE_PLUGIN_PATHS, defaultModulePlugins),
    };
  }

  private resolveConfiguredPluginList(rawValue: string | undefined, defaults: string[]): string[] {
    const values = rawValue
      ? rawValue
          .split(/[\n,]+/)
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .map((item) => this.resolvePluginSourcePath(item))
      : defaults;

    return [...new Set(values)];
  }

  private resolvePluginSourcePath(value: string): string {
    if (path.isAbsolute(value)) {
      return value;
    }
    return path.resolve(this.resolveEcosystemRoot(), value);
  }

  private resolvePackagedPluginSource(pluginRoot: string): string {
    const distDir = path.join(pluginRoot, 'dist');
    if (fsSync.existsSync(distDir)) {
      const cpkFiles = fsSync
        .readdirSync(distDir)
        .filter((file) => file.endsWith('.cpk'))
        .sort();
      if (cpkFiles.length > 0) {
        return path.join(distDir, cpkFiles[0]);
      }
    }

    return pluginRoot;
  }

  private async preparePluginInstallSource(sourcePath: string): Promise<{
    installPath: string;
    cleanup: () => Promise<void>;
  }> {
    const absoluteSourcePath = path.resolve(sourcePath);
    const stats = await fs.stat(absoluteSourcePath);

    if (!stats.isDirectory()) {
      return {
        installPath: absoluteSourcePath,
        cleanup: async () => {},
      };
    }

    const manifestPath = path.join(absoluteSourcePath, 'manifest.yaml');
    const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
    const manifest = yaml.load(manifestRaw) as MinimalPluginManifest;
    const stagingRoot = await fs.mkdtemp(path.join(this.workspacePath, 'plugin-stage-'));
    const stagedManifestPath = path.join(stagingRoot, 'manifest.yaml');

    await fs.copyFile(manifestPath, stagedManifestPath);

    const rootsToCopy = this.collectManifestAssetRoots(manifest);
    for (const root of rootsToCopy) {
      const sourceRootPath = path.join(absoluteSourcePath, root);
      if (!fsSync.existsSync(sourceRootPath)) {
        continue;
      }

      const stagedRootPath = path.join(stagingRoot, root);
      await fs.mkdir(path.dirname(stagedRootPath), { recursive: true });
      await fs.cp(sourceRootPath, stagedRootPath, { recursive: true });
    }

    return {
      installPath: stagedManifestPath,
      cleanup: async () => {
        await fs.rm(stagingRoot, { recursive: true, force: true });
      },
    };
  }

  private collectManifestAssetRoots(manifest: MinimalPluginManifest): string[] {
    const roots = new Set<string>();
    const pushAsset = (assetPath: unknown) => {
      if (typeof assetPath !== 'string') {
        return;
      }

      const normalized = assetPath.trim().replace(/^[.][\\/]/, '');
      if (!normalized) {
        return;
      }

      const firstSegment = normalized.split(/[\\/]+/)[0];
      if (firstSegment) {
        roots.add(firstSegment);
      }
    };

    if (typeof manifest.entry === 'string') {
      pushAsset(manifest.entry);
    } else if (manifest.entry && typeof manifest.entry === 'object') {
      for (const value of Object.values(manifest.entry)) {
        pushAsset(value);
      }
    }

    pushAsset(manifest.preview);
    pushAsset(manifest.ui?.layout?.contract);
    pushAsset(manifest.ui?.layout?.minFunctionalSet);
    pushAsset(manifest.ui?.launcher?.icon);

    for (const provide of manifest.module?.provides ?? []) {
      for (const method of provide.methods ?? []) {
        pushAsset(method.inputSchema);
        pushAsset(method.outputSchema);
      }
    }

    return [...roots];
  }

  private createKernelContext() {
    return {
      caller: this.kernelCaller,
      requestId: crypto.randomUUID()
    } as any;
  }

  private getRuntimePluginRecord(pluginId: string): RuntimePluginRecord {
    const plugin = this.host.runtime.get(pluginId) as RuntimePluginRecord;
    return plugin;
  }

  private getRuntimeSession(sessionId: string): RuntimeSessionRecord {
    const session = this.host.runtime
      .snapshot()
      .sessions
      .find((record) => record.sessionId === sessionId) as RuntimeSessionRecord | undefined;

    if (!session || session.status !== 'running') {
      throw new Error(`Web plugin session not found or not running: ${sessionId}`);
    }

    return session;
  }

  private getRuntimeThemePluginRecords(): RuntimePluginRecord[] {
    return this.host.runtime
      .query({ type: 'theme' })
      .filter((record) => record.enabled) as RuntimePluginRecord[];
  }

  private findRuntimeThemePluginRecord(themeId: string): RuntimePluginRecord {
    const plugin = this.getRuntimeThemePluginRecords().find((record) => {
      const manifestThemeId = record.manifest.theme?.themeId ?? record.manifest.id;
      return manifestThemeId === themeId;
    });

    if (!plugin) {
      throw new Error(`Theme plugin not found: ${themeId}`);
    }

    return plugin;
  }

  private rewriteThemeCssAssetUrlsForWeb(cssText: string): string {
    const assetRoots = this.getRuntimeThemePluginRecords()
      .map((record) => ({
        themeId: record.manifest.theme?.themeId ?? record.manifest.id,
        installPath: record.installPath,
      }));

    return rewriteWebThemeCssAssetUrls(cssText, assetRoots);
  }

  private ensurePluginSupportsWeb(plugin: RuntimePluginRecord): void {
    if (plugin.manifest.type !== 'app') {
      throw new Error(`Only app plugins can open web sessions: ${plugin.manifest.id}`);
    }

    if (!plugin.enabled) {
      throw new Error(`Plugin is disabled: ${plugin.manifest.id}`);
    }

    const supported = plugin.manifest.runtime?.targets?.[WEB_RUNTIME_TARGET]?.supported;
    if (supported !== true) {
      throw new Error(`Plugin does not support web host sessions: ${plugin.manifest.id}`);
    }
  }

  private resolvePluginEntryPath(plugin: RuntimePluginRecord): string {
    const entry = plugin.manifest.entry;
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throw new Error(`Plugin is missing a string entry path: ${plugin.manifest.id}`);
    }

    const normalizedEntry = entry.replace(/^\/+/, '');
    const resolvedPath = path.resolve(plugin.installPath, normalizedEntry);
    const relative = path.relative(plugin.installPath, resolvedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Plugin entry escaped install root: ${plugin.manifest.id}`);
    }

    return resolvedPath;
  }

  private resolveEcosystemRoot(): string {
    if (this.ecosystemRoot) {
      return this.ecosystemRoot;
    }

    let current = process.cwd();
    for (let index = 0; index < 8; index += 1) {
      const marker = path.join(current, 'Chips-Ui', 'package.json');
      if (fsSync.existsSync(marker)) {
        this.ecosystemRoot = current;
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }

    throw new Error(`Failed to locate ecosystem workspace root from cwd: ${process.cwd()}`);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const hostIntegration = HostIntegrationService.getInstance();
