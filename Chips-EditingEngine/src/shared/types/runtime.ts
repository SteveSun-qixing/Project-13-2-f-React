import type {
  Client,
  PlatformCapabilities,
  PlatformInfo,
  PlatformLaunchContext,
  PluginInfo,
  ThemeMeta,
  ThemeState,
} from "chips-sdk";
import type { EditorLayoutMode } from "../../../config/app-config";

export interface EditorRuntimeSnapshot {
  runtimeMode: "host" | "preview";
  client: Client;
  plugin: PluginInfo;
  theme: ThemeState;
  availableThemes: ThemeMeta[];
  locale: string;
  locales: string[];
  platform: PlatformInfo;
  capabilities: PlatformCapabilities;
  launchContext: PlatformLaunchContext;
  preferredLayout: EditorLayoutMode;
}
