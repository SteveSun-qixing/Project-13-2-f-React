import type { Client, ThemeMeta, ThemeState } from "chips-sdk";
import { appConfig, type EditorLayoutMode } from "../../../config/app-config";
import type { EditorRuntimeSnapshot } from "../types/runtime";
import type { AppLogger } from "../../../config/logging";

const DEFAULT_THEME: ThemeState = {
  themeId: "chips-official.default-theme",
  displayName: "Default Theme",
  version: "1.0.0",
};

export function hasBridgeRuntimeAccess(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const bridge = (window as Window & { chips?: { invoke?: unknown } }).chips;
  return typeof bridge?.invoke === "function";
}

function isLayoutMode(value: unknown): value is EditorLayoutMode {
  return value === "infinite-canvas" || value === "workbench";
}

function resolveLayoutMode(value: unknown): EditorLayoutMode {
  return isLayoutMode(value) ? value : appConfig.defaultLayoutMode;
}

async function readPreferredLayout(client: Client): Promise<EditorLayoutMode> {
  const stored = await client.config.get<string>(appConfig.configKeys.layoutMode);
  return resolveLayoutMode(stored);
}

export function createFallbackRuntimeSnapshot(client: Client): EditorRuntimeSnapshot {
  const locale =
    typeof navigator !== "undefined" && typeof navigator.language === "string"
      ? navigator.language
      : "zh-CN";

  const os =
    typeof navigator !== "undefined"
      ? /mac/i.test(navigator.platform)
        ? "darwin"
        : /win/i.test(navigator.platform)
          ? "win32"
          : "web"
      : "web";

  return {
    runtimeMode: "preview",
    client,
    plugin: {
      id: appConfig.appId,
      manifestPath: "manifest.yaml",
      enabled: true,
      version: "0.1.0",
      type: "app",
      name: "编辑引擎",
      description: "本地预览模式下的编辑引擎应用壳层。",
      installPath: ".",
      capabilities: [],
    },
    theme: DEFAULT_THEME,
    availableThemes: [
      {
        id: DEFAULT_THEME.themeId,
        displayName: DEFAULT_THEME.displayName,
        version: DEFAULT_THEME.version,
        isDefault: true,
      },
    ],
    locale,
    locales: [locale],
    platform: {
      os,
      arch: "web",
      version: typeof navigator !== "undefined" ? navigator.userAgent : "preview",
      locale,
    },
    capabilities: {},
    launchContext: {
      launchParams: {},
    },
    preferredLayout: appConfig.defaultLayoutMode,
  };
}

export async function loadEditorRuntimeSnapshot(
  client: Client,
  logger: AppLogger,
): Promise<EditorRuntimeSnapshot> {
  logger.debug("开始加载编辑引擎运行时快照");

  const [plugin, theme, availableThemes, locale, locales, platform, capabilities, preferredLayout] =
    await Promise.all([
      client.plugin.getSelf(),
      client.theme.getCurrent(),
      client.theme.list(),
      client.i18n.getCurrent(),
      client.i18n.listLocales(),
      client.platform.getInfo(),
      client.platform.getCapabilities(),
      readPreferredLayout(client),
    ]);

  const launchContext = client.platform.getLaunchContext();

  logger.info("编辑引擎运行时快照加载完成", {
    pluginId: plugin.id,
    themeId: theme.themeId,
    locale,
    preferredLayout,
    availableThemeCount: availableThemes.length,
    localeCount: locales.length,
  });

  return {
    runtimeMode: "host",
    client,
    plugin,
    theme,
    availableThemes,
    locale,
    locales,
    platform,
    capabilities,
    launchContext,
    preferredLayout,
  };
}

export async function applyEditorTheme(client: Client, themeId: string): Promise<ThemeState> {
  await client.theme.apply(themeId);
  return client.theme.getCurrent();
}

export async function applyEditorLocale(client: Client, locale: string): Promise<string> {
  await client.i18n.setCurrent(locale);
  return client.i18n.getCurrent();
}

export async function persistEditorLayoutMode(
  client: Client,
  layoutMode: EditorLayoutMode,
): Promise<EditorLayoutMode> {
  await client.config.set(appConfig.configKeys.layoutMode, layoutMode);
  return readPreferredLayout(client);
}

export function getLaunchTargetPath(snapshot: Pick<EditorRuntimeSnapshot, "launchContext">): string | null {
  const targetPath = snapshot.launchContext.launchParams.targetPath;
  return typeof targetPath === "string" && targetPath.trim().length > 0 ? targetPath : null;
}

export function hasTheme(snapshot: Pick<EditorRuntimeSnapshot, "theme" | "availableThemes">, themeId: string): boolean {
  return snapshot.availableThemes.some((theme) => theme.id === themeId) || snapshot.theme.themeId === themeId;
}

export function getVisibleThemes(themes: ThemeMeta[]): ThemeMeta[] {
  return [...themes].sort((left, right) => left.displayName.localeCompare(right.displayName, "zh-CN"));
}
