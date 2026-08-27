import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { PluginRuntime } from '../../runtime';
import { createError } from '../../shared/errors';
import { parseYamlLite } from '../../shared/yaml-lite';

export interface BuiltInPluginDefinition {
  id: string;
  manifestRelativePath: string;
  autoEnable: boolean;
  required?: boolean;
  createShortcut?: boolean;
  launchOnFirstInstall?: boolean;
}

export interface BuiltInPluginBootstrapResult {
  installedPluginIds: string[];
  enabledPluginIds: string[];
  shortcutPluginIds: string[];
  launchPluginId?: string;
}

export interface EnsureBuiltInPluginsOptions {
  runtime: PluginRuntime;
  pluginRoots?: string[];
  plugins?: BuiltInPluginDefinition[];
}

interface RuntimeInvokerLike {
  invoke<T>(action: string, payload?: unknown): Promise<T>;
}

export const SETTINGS_PANEL_PLUGIN_ID = 'com.chips.eco-settings-panel';

const PLUGIN_MANIFEST_NAMES = ['manifest.yaml', 'manifest.yml', 'manifest.json'] as const;

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const unique = (items: string[]): string[] => {
  return [...new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))];
};

export const resolveDefaultBuiltInPluginRoots = (): string[] => {
  const envRoots = (process.env.CHIPS_BUILTIN_PLUGINS_DIR ?? '')
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const packagedRoot = typeof resourcesPath === 'string' && resourcesPath.length > 0
    ? path.join(resourcesPath, 'builtin-plugins')
    : '';

  return unique([...envRoots, packagedRoot]);
};

const resolvePluginManifestName = async (pluginDir: string): Promise<string | null> => {
  for (const manifestName of PLUGIN_MANIFEST_NAMES) {
    if (await pathExists(path.join(pluginDir, manifestName))) {
      return manifestName;
    }
  }
  return null;
};

export const discoverBuiltInPluginDefinitions = async (roots: string[]): Promise<BuiltInPluginDefinition[]> => {
  const discovered: BuiltInPluginDefinition[] = [];
  const seenPluginIds = new Set<string>();

  for (const root of roots) {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const pluginDir = path.join(root, entry.name);
      const manifestName = await resolvePluginManifestName(pluginDir);
      if (!manifestName) {
        continue;
      }

      let pluginId = entry.name;
      try {
        const raw = await fs.readFile(path.join(pluginDir, manifestName), 'utf-8');
        const parsed = parseYamlLite(raw);
        if (typeof parsed.id === 'string' && parsed.id.trim().length > 0) {
          pluginId = parsed.id.trim();
        }
      } catch {
        // Keep the directory name as the plugin id when the manifest is unreadable.
      }

      if (seenPluginIds.has(pluginId)) {
        continue;
      }
      seenPluginIds.add(pluginId);

      discovered.push({
        id: pluginId,
        manifestRelativePath: `${entry.name}/${manifestName}`,
        autoEnable: true,
        ...(pluginId === SETTINGS_PANEL_PLUGIN_ID
          ? { createShortcut: true, launchOnFirstInstall: true }
          : {})
      });
    }
  }

  return discovered.sort((left, right) => left.id.localeCompare(right.id));
};

const resolveBuiltInManifestPath = async (
  plugin: BuiltInPluginDefinition,
  roots: string[]
): Promise<string | null> => {
  for (const root of roots) {
    const candidate = path.join(root, plugin.manifestRelativePath);
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return null;
};

const filterExistingRoots = async (roots: string[]): Promise<string[]> => {
  const resolved = await Promise.all(
    roots.map(async (root) => {
      const normalized = path.resolve(root);
      return (await pathExists(normalized)) ? normalized : null;
    })
  );

  return resolved.filter((item): item is string => item !== null);
};

export const ensureBuiltInPlugins = async (
  options: EnsureBuiltInPluginsOptions
): Promise<BuiltInPluginBootstrapResult> => {
  const roots = await filterExistingRoots(options.pluginRoots ?? resolveDefaultBuiltInPluginRoots());
  const plugins = options.plugins ?? (roots.length > 0 ? await discoverBuiltInPluginDefinitions(roots) : []);

  if (roots.length === 0 || plugins.length === 0) {
    return {
      installedPluginIds: [],
      enabledPluginIds: [],
      shortcutPluginIds: []
    };
  }

  const installedPluginIds: string[] = [];
  const enabledPluginIds: string[] = [];
  const shortcutPluginIds: string[] = [];
  let launchPluginId: string | undefined;

  for (const plugin of plugins) {
    const manifestPath = await resolveBuiltInManifestPath(plugin, roots);
    if (!manifestPath) {
      if (plugin.required === false) {
        continue;
      }
      throw createError('HOST_BUILTIN_PLUGIN_NOT_FOUND', `Built-in plugin manifest is unavailable: ${plugin.id}`, {
        pluginId: plugin.id,
        roots
      });
    }

    let record = options.runtime.query().find((item) => item.manifest.id === plugin.id);

    if (record) {
      const manifestExists = await pathExists(record.manifestPath);
      const installPathExists = await pathExists(record.installPath);
      if (!manifestExists || !installPathExists) {
        await options.runtime.uninstall(plugin.id);
        record = undefined;
      }
    }

    if (!record) {
      record = await options.runtime.install(manifestPath);
      installedPluginIds.push(plugin.id);
      if (!launchPluginId && plugin.launchOnFirstInstall) {
        launchPluginId = plugin.id;
      }
    }

    if (plugin.autoEnable && !record.enabled) {
      await options.runtime.enable(plugin.id);
      enabledPluginIds.push(plugin.id);
    }

    if (plugin.createShortcut) {
      shortcutPluginIds.push(plugin.id);
    }
  }

  return {
    installedPluginIds,
    enabledPluginIds,
    shortcutPluginIds: unique(shortcutPluginIds),
    launchPluginId
  };
};

export const ensureBuiltInPluginShortcuts = async (
  runtime: RuntimeInvokerLike,
  pluginIds: string[]
): Promise<string[]> => {
  const created: string[] = [];

  for (const pluginId of unique(pluginIds)) {
    const shortcut = await runtime.invoke<{ shortcut: { exists: boolean } }>('plugin.getShortcut', { pluginId });
    if (shortcut.shortcut.exists) {
      continue;
    }

    await runtime.invoke('plugin.createShortcut', { pluginId, replace: false });
    created.push(pluginId);
  }

  return created;
};
