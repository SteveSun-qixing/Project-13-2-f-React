import type {
  Client,
  PlatformDialogFileOptions,
  PluginRecord,
  PluginShortcutRecord,
  PluginType,
  ThemeMeta,
} from "chips-sdk";
import { appConfig } from "../../../config/app-config";
import { getChipsClient } from "./client";
import { normalizeSettingsError, type SettingsPanelError } from "./errors";

export interface AppPluginGovernanceRecord {
  pluginId: string;
  name: string;
  description?: string;
  version: string;
  enabled: boolean;
  selfManaged: boolean;
  installPath: string;
  installedAt: number;
  capabilities: string[];
  shortcut: PluginShortcutRecord;
}

export type GovernedPluginType = Exclude<PluginType, "app" | "theme">;

export interface FileOpenHandlerOption {
  pluginId: string;
  name?: string;
  tier: "primary" | "fallback";
  isPreferred: boolean;
}

export interface FileOpenHandlerSlot {
  capability: string;
  kind: "resource-handler" | "file-handler";
  intent?: string;
  mimeType?: string;
  extension?: string;
  preferenceKey: string;
  preferencePluginId: string | null;
  defaultPluginId: string | null;
  plugins: FileOpenHandlerOption[];
}

/** Host `fileOpen.defaults` 配置键：文件类型 → 默认处理器插件 ID。 */
export const FILE_OPEN_DEFAULTS_CONFIG_KEY = "fileOpen.defaults";

export interface PluginGovernanceRecord {
  pluginId: string;
  type: GovernedPluginType;
  name: string;
  description?: string;
  version: string;
  enabled: boolean;
  installPath: string;
  installedAt: number;
  capabilities: string[];
  cardTypes: string[];
  layoutType?: string;
  displayName?: string;
}

interface OpenPluginFileDialogOptions {
  title: string;
  filterName: string;
}

function sortByName<T extends { displayName?: string; name?: string; installedAt?: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftName = left.displayName ?? left.name ?? "";
    const rightName = right.displayName ?? right.name ?? "";
    const nameDiff = leftName.localeCompare(rightName, "zh-Hans-CN");
    if (nameDiff !== 0) {
      return nameDiff;
    }
    return (right.installedAt ?? 0) - (left.installedAt ?? 0);
  });
}

function toLocaleDisplayName(locale: string, displayLocale: string): { displayName: string; nativeName: string } {
  const displayNames = typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames([displayLocale], { type: "language" })
    : null;
  const nativeNames = typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames([locale], { type: "language" })
    : null;

  const fallbackLabel = locale;
  return {
    displayName: displayNames?.of(locale) ?? fallbackLabel,
    nativeName: nativeNames?.of(locale) ?? fallbackLabel,
  };
}

function toSettingsError(error: unknown, fallbackMessage: string): SettingsPanelError {
  return normalizeSettingsError(error, fallbackMessage);
}

function toPluginGovernanceRecord(record: PluginRecord): PluginGovernanceRecord {
  return {
    pluginId: record.id,
    type: record.type as GovernedPluginType,
    name: record.name,
    description: record.description,
    version: record.version,
    enabled: record.enabled,
    installPath: record.installPath,
    installedAt: record.installedAt,
    capabilities: [...(record.capabilities ?? [])],
    cardTypes: record.type === "card" ? [...(record.capabilities ?? [])] : [],
    layoutType: record.layout?.layoutType,
    displayName: record.layout?.displayName,
  };
}

export class SettingsRuntimeService {
  public constructor(private readonly client: Client) {}

  public getClient(): Client {
    return this.client;
  }

  public async uninstallPlugin(pluginId: string): Promise<void> {
    try {
      await this.client.plugin.uninstall(pluginId);
    } catch (error) {
      throw toSettingsError(error, "Failed to uninstall plugin.");
    }
  }

  public async listFileOpenHandlers(): Promise<FileOpenHandlerSlot[]> {
    try {
      const handlers = await this.client.plugin.listHandlers();
      return [...handlers].sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === "file-handler" ? -1 : 1;
        }
        return left.capability.localeCompare(right.capability);
      });
    } catch (error) {
      throw toSettingsError(error, "Failed to list file open handlers.");
    }
  }

  public async getFileOpenDefaults(): Promise<Record<string, string>> {
    try {
      const value = await this.client.config.get<Record<string, string>>(FILE_OPEN_DEFAULTS_CONFIG_KEY);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
      }
      const defaults: Record<string, string> = {};
      for (const [key, pluginId] of Object.entries(value)) {
        if (typeof key === "string" && key.length > 0 && typeof pluginId === "string" && pluginId.length > 0) {
          defaults[key] = pluginId;
        }
      }
      return defaults;
    } catch (error) {
      throw toSettingsError(error, "Failed to load file open defaults.");
    }
  }

  public async setFileOpenDefaultPreference(preferenceKey: string, pluginId: string | null): Promise<void> {
    if (!preferenceKey) {
      throw toSettingsError(null, "Failed to update file open default: preference key is required.");
    }
    try {
      const current = await this.getFileOpenDefaults();
      if (pluginId) {
        current[preferenceKey] = pluginId;
      } else {
        delete current[preferenceKey];
      }
      await this.client.config.set(FILE_OPEN_DEFAULTS_CONFIG_KEY, current);
    } catch (error) {
      throw toSettingsError(error, "Failed to update file open default.");
    }
  }

  public async resetFileOpenDefaults(): Promise<void> {
    try {
      await this.client.config.reset(FILE_OPEN_DEFAULTS_CONFIG_KEY);
    } catch (error) {
      throw toSettingsError(error, "Failed to reset file open defaults.");
    }
  }

  public async listAppPlugins(): Promise<AppPluginGovernanceRecord[]> {
    try {
      const installed = await this.client.plugin.query({ type: "app" });
      const appRecords = installed.filter((record) => record.type === "app");
      const shortcuts = await Promise.all(
        appRecords.map(async (record) => {
          const shortcut = await this.client.plugin.getShortcut(record.id);
          return [record.id, shortcut] as const;
        }),
      );
      const shortcutMap = new Map(shortcuts);

      return sortByName(
        appRecords.map((record) => ({
          pluginId: record.id,
          name: record.name,
          description: record.description,
          version: record.version,
          enabled: record.enabled,
          selfManaged: record.id === appConfig.appId,
          installPath: record.installPath,
          installedAt: record.installedAt,
          capabilities: [...(record.capabilities ?? [])],
          shortcut: shortcutMap.get(record.id) ?? {
            pluginId: record.id,
            name: record.name,
            location: "desktop",
            launcherPath: "",
            executablePath: "",
            args: [],
            exists: false,
          },
        })),
      ).sort((left, right) => {
        if (left.enabled !== right.enabled) {
          return left.enabled ? -1 : 1;
        }
        return left.name.localeCompare(right.name, "zh-Hans-CN");
      });
    } catch (error) {
      throw toSettingsError(error, "Failed to load installed app plugins.");
    }
  }

  public async installAppPlugin(manifestPath: string): Promise<void> {
    try {
      await this.client.plugin.install(manifestPath);
    } catch (error) {
      throw toSettingsError(error, "Failed to install app plugin.");
    }
  }

  public async listPlugins(type: GovernedPluginType): Promise<PluginGovernanceRecord[]> {
    try {
      const installed = await this.client.plugin.query({ type });
      return sortByName(
        installed
          .filter((record) => record.type === type)
          .map((record) => toPluginGovernanceRecord(record)),
      ).sort((left, right) => {
        if (left.enabled !== right.enabled) {
          return left.enabled ? -1 : 1;
        }
        return left.name.localeCompare(right.name, "zh-Hans-CN");
      });
    } catch (error) {
      throw toSettingsError(error, `Failed to load installed ${type} plugins.`);
    }
  }

  public async installPluginOfType(manifestPath: string, expectedType: GovernedPluginType): Promise<void> {
    try {
      const installResult = await this.client.plugin.install(manifestPath);
      const plugin = await this.client.plugin.get(installResult.pluginId);
      if (!plugin || plugin.type !== expectedType) {
        throw toSettingsError(
          null,
          `Installed package type mismatch. Expected ${expectedType}.`,
        );
      }
    } catch (error) {
      throw toSettingsError(error, `Failed to install ${expectedType} plugin.`);
    }
  }

  public async enablePlugin(pluginId: string): Promise<void> {
    try {
      await this.client.plugin.enable(pluginId);
    } catch (error) {
      throw toSettingsError(error, "Failed to enable app plugin.");
    }
  }

  public async disablePlugin(pluginId: string): Promise<void> {
    try {
      await this.client.plugin.disable(pluginId);
    } catch (error) {
      throw toSettingsError(error, "Failed to disable app plugin.");
    }
  }

  public async launchPlugin(pluginId: string): Promise<void> {
    try {
      await this.client.plugin.launch(pluginId, {});
    } catch (error) {
      throw toSettingsError(error, "Failed to launch app plugin.");
    }
  }

  public async createPluginShortcut(pluginId: string, replace = false): Promise<PluginShortcutRecord> {
    try {
      return await this.client.plugin.createShortcut(pluginId, { replace });
    } catch (error) {
      throw toSettingsError(error, "Failed to create app shortcut.");
    }
  }

  public async removePluginShortcut(pluginId: string): Promise<{ removed: boolean; launcherPath: string; location: "desktop" | "launchpad" }> {
    try {
      return await this.client.plugin.removeShortcut(pluginId);
    } catch (error) {
      throw toSettingsError(error, "Failed to remove app shortcut.");
    }
  }

  public async revealPath(path: string): Promise<void> {
    try {
      await this.client.platform.shellShowItemInFolder(path);
    } catch (error) {
      throw toSettingsError(error, "Failed to reveal shortcut path.");
    }
  }

  public async openPluginFileDialog(kind: "theme" | "app" | GovernedPluginType, dialog: OpenPluginFileDialogOptions): Promise<string[]> {
    try {
      const options: PlatformDialogFileOptions = {
        title: dialog.title,
        mode: "file-or-directory",
        allowMultiple: false,
        filters: [
          {
            name: dialog.filterName,
            extensions: ["cpk", "yaml", "yml", "json"],
          },
        ],
      };
      const filePaths = await this.client.platform.openFile(options);
      return filePaths ?? [];
    } catch (error) {
      throw toSettingsError(error, "Failed to open file picker.");
    }
  }

  public getPathForFile(file: File): string {
    return this.client.platform.getPathForFile(file);
  }

  public async showConfirm(title: string, message: string, detail?: string): Promise<boolean> {
    try {
      return await this.client.platform.showConfirm({ title, message, detail });
    } catch (error) {
      throw toSettingsError(error, "Failed to open confirm dialog.");
    }
  }

  public async showMessage(title: string, message: string, detail?: string): Promise<void> {
    try {
      await this.client.platform.showMessage({ title, message, detail });
    } catch (error) {
      throw toSettingsError(error, "Failed to open message dialog.");
    }
  }
}

let cachedService: SettingsRuntimeService | null = null;

export function getSettingsRuntimeService(): SettingsRuntimeService {
  if (!cachedService) {
    cachedService = new SettingsRuntimeService(getChipsClient());
  }
  return cachedService;
}

export function filterPluginsByType(records: PluginRecord[], type: PluginType): PluginRecord[] {
  return records.filter((record) => record.type === type);
}


