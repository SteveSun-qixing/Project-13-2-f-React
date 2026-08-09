import fs from 'node:fs/promises';
import path from 'node:path';
import { parseYamlLite } from '../../shared/yaml-lite';
import type { RuntimeClient } from '../../renderer/runtime-client';

export interface ManifestSummary {
  id?: string;
  name?: string;
  type?: string;
}

export interface ModuleJobSnapshot {
  job: {
    status: string;
    output?: unknown;
    error?: unknown;
    progress?: Record<string, unknown>;
  };
}

interface ConfiguredPluginRecord {
  id?: string;
  manifestPath?: string;
  enabled?: boolean;
}

interface SyncConfiguredPluginsOptions {
  skipPluginIds?: string[];
}

const PROJECT_MANIFEST_FILE_NAMES = ['manifest.yaml', 'manifest.yml', 'manifest.json'];

const readConfiguredPlugins = async (workspacePath: string): Promise<ConfiguredPluginRecord[]> => {
  try {
    const raw = await fs.readFile(path.join(workspacePath, 'plugins.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const pathExists = async (candidate: string): Promise<boolean> => {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
};

const resolveProjectManifestFromPackagedArtifact = async (candidate: string): Promise<string | null> => {
  if (path.extname(candidate).toLowerCase() !== '.cpk') {
    return null;
  }

  const distDir = path.dirname(candidate);
  if (path.basename(distDir).toLowerCase() !== 'dist') {
    return null;
  }

  const projectRoot = path.dirname(distDir);
  for (const fileName of PROJECT_MANIFEST_FILE_NAMES) {
    const manifestCandidate = path.join(projectRoot, fileName);
    if (await pathExists(manifestCandidate)) {
      return manifestCandidate;
    }
  }

  return null;
};

const resolveConfiguredPluginSourcePath = async (workspacePath: string, manifestPath: string): Promise<string | null> => {
  const candidates = path.isAbsolute(manifestPath)
    ? [path.resolve(manifestPath)]
    : [
        path.resolve(path.dirname(workspacePath), manifestPath),
        path.resolve(process.cwd(), manifestPath),
        path.resolve(workspacePath, manifestPath),
      ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    const manifestFallback = await resolveProjectManifestFromPackagedArtifact(candidate);
    if (manifestFallback) {
      return manifestFallback;
    }
  }

  return null;
};

export const readManifestSummary = async (manifestPath: string): Promise<ManifestSummary> => {
  const raw = await fs.readFile(manifestPath, 'utf-8');
  const parsed = parseYamlLite(raw) as Record<string, unknown>;
  return {
    id: typeof parsed.id === 'string' ? parsed.id : undefined,
    name: typeof parsed.name === 'string' ? parsed.name : undefined,
    type: typeof parsed.type === 'string' ? parsed.type : undefined
  };
};

export const reinstallAndEnablePlugin = async (
  runtime: RuntimeClient,
  manifestPath: string,
  pluginId?: string
): Promise<{ pluginId: string }> => {
  return reinstallPlugin(runtime, manifestPath, {
    pluginId,
    enabled: true
  });
};

export const reinstallPlugin = async (
  runtime: RuntimeClient,
  manifestPath: string,
  options: { pluginId?: string; enabled?: boolean } = {}
): Promise<{ pluginId: string }> => {
  const { enabled = false } = options;
  const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', { manifestPath });
  if (enabled) {
    await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });
  } else {
    try {
      await runtime.invoke('plugin.disable', { pluginId: installed.pluginId });
    } catch {
      // ignore missing/disabled plugin
    }
  }
  return installed;
};

const readErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.length > 0 ? code : undefined;
};

const isRecoverableConfiguredPluginSyncError = (error: unknown): boolean => {
  const code = readErrorCode(error);
  return (
    code === 'PLUGIN_SOURCE_NOT_FOUND' ||
    code === 'PLUGIN_MANIFEST_NOT_FOUND' ||
    code === 'PLUGIN_ENTRY_NOT_FOUND'
  );
};

const warnSkippedConfiguredPlugin = (pluginId: string | undefined, sourcePath: string, error: unknown): void => {
  const label = pluginId ?? sourcePath;
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `[chipsdev-r] 跳过开发工作区插件同步：${label}（来源不可用或未完成构建：${sourcePath}）\n原因：${message}\n`
  );
};

export const syncConfiguredWorkspacePlugins = async (
  runtime: RuntimeClient,
  workspacePath: string,
  options: SyncConfiguredPluginsOptions = {}
): Promise<void> => {
  const skip = new Set(options.skipPluginIds ?? []);
  const configuredPlugins = await readConfiguredPlugins(workspacePath);

  for (const record of configuredPlugins) {
    if (typeof record?.manifestPath !== 'string' || record.manifestPath.trim().length === 0) {
      continue;
    }

    const pluginId = typeof record.id === 'string' && record.id.trim().length > 0
      ? record.id.trim()
      : undefined;
    if (pluginId && skip.has(pluginId)) {
      continue;
    }

    const resolvedManifestPath = await resolveConfiguredPluginSourcePath(workspacePath, record.manifestPath.trim());
    if (!resolvedManifestPath) {
      warnSkippedConfiguredPlugin(pluginId, record.manifestPath.trim(), '未找到可用的插件源路径。');
      continue;
    }

    try {
      await reinstallPlugin(runtime, resolvedManifestPath, {
        pluginId,
        enabled: record.enabled !== false
      });
    } catch (error) {
      if (!isRecoverableConfiguredPluginSyncError(error)) {
        throw error;
      }
      warnSkippedConfiguredPlugin(pluginId, resolvedManifestPath, error);
    }
  }
};

export const waitForModuleJob = async (
  runtime: RuntimeClient,
  jobId: string,
  timeoutMs: number
): Promise<ModuleJobSnapshot['job']> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const snapshot = await runtime.invoke<ModuleJobSnapshot>('module.job.get', { jobId });
    if (
      snapshot.job.status === 'completed' ||
      snapshot.job.status === 'failed' ||
      snapshot.job.status === 'cancelled'
    ) {
      return snapshot.job;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for module job: ${jobId}`);
};
