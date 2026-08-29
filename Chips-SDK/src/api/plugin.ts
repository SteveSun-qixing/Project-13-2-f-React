import type { CoreClient } from "../types/client";
import { createError } from "../types/errors";

export type PluginType = "app" | "card" | "layout" | "theme" | "module";

export type WindowChromeTitleBarStyle = "default" | "hidden" | "hiddenInset" | "customButtonsOnHover";

export interface WindowChromeOverlayOptions {
  color?: string;
  symbolColor?: string;
  height?: number;
}

export interface WindowChromeOptions {
  frame?: boolean;
  transparent?: boolean;
  backgroundColor?: string;
  titleBarStyle?: WindowChromeTitleBarStyle;
  titleBarOverlay?: boolean | WindowChromeOverlayOptions;
}

export interface PluginUiConfig {
  window?: {
    chrome?: WindowChromeOptions;
  };
  launcher?: {
    displayName?: string;
    icon?: string;
  };
}

export interface ThemePluginInfo {
  themeId: string;
  displayName: string;
  publisher?: string;
  parentTheme?: string;
  isDefault: boolean;
}

export interface LayoutPluginInfo {
  layoutType?: string;
  displayName: string;
}

export interface PluginInfo {
  id: string;
  manifestPath: string;
  enabled: boolean;
  version: string;
  type: PluginType;
  name: string;
  description?: string;
  installPath: string;
  capabilities?: string[];
  theme?: ThemePluginInfo;
  layout?: LayoutPluginInfo;
}

export interface PluginRecord extends PluginInfo {
  entry?: string | Record<string, string>;
  ui?: PluginUiConfig;
  installedAt: number;
}

export interface PluginShortcutRecord {
  pluginId: string;
  name: string;
  location: "desktop" | "launchpad";
  launcherPath: string;
  executablePath: string;
  args: string[];
  iconPath?: string;
  exists: boolean;
}

export type FileHandlerKind = "resource-handler" | "file-handler";

export type FileHandlerTier = "primary" | "fallback";

export interface FileHandlerSlotPlugin {
  pluginId: string;
  name?: string;
  tier: FileHandlerTier;
  /** 该插件是否是此偏好键上的用户首选（默认查看器）。 */
  isPreferred: boolean;
}

export interface FileHandlerSlot {
  /** 归一化能力串（无层级后缀），如 `file-handler:.png`。 */
  capability: string;
  kind: FileHandlerKind;
  intent?: string;
  mimeType?: string;
  extension?: string;
  /** 该槽位写入 Host `fileOpen.defaults` 配置时使用的偏好键。 */
  preferenceKey: string;
  /** 偏好键上的原始用户偏好（可能指向已停用或已卸载的插件）。 */
  preferencePluginId: string | null;
  /** 当前生效默认处理器：有效偏好优先，否则按层级与安装顺序取第一个。 */
  defaultPluginId: string | null;
  /** 声明该能力的全部启用应用插件（首选在前，primary 层级先于 fallback 层级）。 */
  plugins: FileHandlerSlotPlugin[];
}

export interface PluginApi {
  getSelf(): Promise<PluginInfo>;
  list(options?: { type?: PluginType; capability?: string }): Promise<PluginInfo[]>;
  get(pluginId: string): Promise<PluginInfo | undefined>;
  getCardPlugin(cardType: string): Promise<PluginInfo | undefined>;
  getLayoutPlugin(layoutType: string): Promise<PluginInfo | undefined>;
  install(manifestPath: string): Promise<{ pluginId: string }>;
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
  uninstall(pluginId: string): Promise<void>;
  launch(pluginId: string, launchParams?: Record<string, unknown>): Promise<{
    window: { id: string };
    session: { sessionId: string; sessionNonce: string; permissions: string[] };
  }>;
  getShortcut(pluginId: string): Promise<PluginShortcutRecord>;
  createShortcut(pluginId: string, options?: { replace?: boolean }): Promise<PluginShortcutRecord>;
  removeShortcut(pluginId: string): Promise<{ removed: boolean; launcherPath: string; location: "desktop" | "launchpad" }>;
  /**
   * 查询当前主机已安装插件的运行时记录。
   * 该接口直接映射 Host `plugin.query` 动作。
   */
  query(options?: { type?: PluginType; capability?: string }): Promise<PluginRecord[]>;
  /**
   * 查询文件打开处理器槽位（默认查看器治理视图）。
   * 汇总全部启用应用插件声明的 `resource-handler` / `file-handler` 能力，
   * 并标注用户默认查看器偏好（Host `fileOpen.defaults` 配置）。
   */
  listHandlers(): Promise<FileHandlerSlot[]>;
}

export function createPluginApi(client: CoreClient): PluginApi {
  return {
    async getSelf() {
      const result = await client.invoke<Record<string, never>, { plugin: PluginInfo }>("plugin.getSelf", {});
      return result.plugin;
    },
    async list(options) {
      const result = await client.invoke<
        { type?: PluginType; capability?: string },
        { plugins: PluginInfo[] }
      >("plugin.list", options ?? {});
      return result.plugins;
    },
    async get(pluginId) {
      const result = await client.invoke<{ pluginId: string }, { plugin?: PluginInfo }>("plugin.get", {
        pluginId,
      });
      return result.plugin;
    },
    async getCardPlugin(cardType) {
      const result = await client.invoke<{ cardType: string }, { plugin?: PluginInfo }>("plugin.getCardPlugin", {
        cardType,
      });
      return result.plugin;
    },
    async getLayoutPlugin(layoutType) {
      const result = await client.invoke<{ layoutType: string }, { plugin?: PluginInfo }>("plugin.getLayoutPlugin", {
        layoutType,
      });
      return result.plugin;
    },
    async install(manifestPath) {
      if (!manifestPath) {
        throw createError("INVALID_ARGUMENT", "plugin.install: manifestPath is required.");
      }
      return client.invoke<{ manifestPath: string }, { pluginId: string }>("plugin.install", {
        manifestPath,
      });
    },
    async enable(pluginId) {
      if (!pluginId) {
        throw createError("INVALID_ARGUMENT", "plugin.enable: pluginId is required.");
      }
      await client.invoke("plugin.enable", { pluginId });
    },
    async disable(pluginId) {
      if (!pluginId) {
        throw createError("INVALID_ARGUMENT", "plugin.disable: pluginId is required.");
      }
      await client.invoke("plugin.disable", { pluginId });
    },
    async uninstall(pluginId) {
      if (!pluginId) {
        throw createError("INVALID_ARGUMENT", "plugin.uninstall: pluginId is required.");
      }
      await client.invoke("plugin.uninstall", { pluginId });
    },
    async launch(pluginId, launchParams) {
      if (!pluginId) {
        throw createError("INVALID_ARGUMENT", "plugin.launch: pluginId is required.");
      }
      return client.invoke<
        { pluginId: string; launchParams?: Record<string, unknown> },
        {
          window: { id: string };
          session: { sessionId: string; sessionNonce: string; permissions: string[] };
        }
      >("plugin.launch", {
        pluginId,
        launchParams: launchParams ?? {},
      });
    },
    async getShortcut(pluginId) {
      if (!pluginId) {
        throw createError("INVALID_ARGUMENT", "plugin.getShortcut: pluginId is required.");
      }
      const result = await client.invoke<{ pluginId: string }, { shortcut: PluginShortcutRecord }>("plugin.getShortcut", {
        pluginId,
      });
      return result.shortcut;
    },
    async createShortcut(pluginId, options) {
      if (!pluginId) {
        throw createError("INVALID_ARGUMENT", "plugin.createShortcut: pluginId is required.");
      }
      const result = await client.invoke<
        { pluginId: string; replace?: boolean },
        { shortcut: PluginShortcutRecord }
      >("plugin.createShortcut", {
        pluginId,
        replace: options?.replace === true,
      });
      return result.shortcut;
    },
    async removeShortcut(pluginId) {
      if (!pluginId) {
        throw createError("INVALID_ARGUMENT", "plugin.removeShortcut: pluginId is required.");
      }
      return client.invoke<
        { pluginId: string },
        { removed: boolean; launcherPath: string; location: "desktop" | "launchpad" }
      >("plugin.removeShortcut", {
        pluginId,
      });
    },
    async query(options) {
      const result = await client.invoke<
        { type?: PluginType; capability?: string },
        { plugins: PluginRecord[] }
      >("plugin.query", options ?? {});
      return result.plugins;
    },
    async listHandlers() {
      const result = await client.invoke<Record<string, never>, { handlers: FileHandlerSlot[] }>(
        "plugin.listHandlers",
        {},
      );
      return result.handlers;
    },
  };
}
