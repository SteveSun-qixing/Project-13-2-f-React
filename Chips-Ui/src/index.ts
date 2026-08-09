import "./theme/global.css";

export { appleTheme } from "./theme/apple-theme";

export { ChipsProvider, useChips, type ChipsContextValue, type ChipsProviderProps } from "./runtime/ChipsProvider";
export {
  CommandProvider,
  groupCommands,
  matchesShortcut,
  useCommandRegistry,
  useCommandShortcuts,
  type CommandGroup,
  type CommandItem,
  type CommandRegistryValue,
} from "./runtime/commands";

export {
  AppChrome,
  type AppChromeImmersiveProps,
  type AppChromeProps,
  type AppChromeToolbarItem,
} from "./components/AppChrome";
export { CommandPalette, type CommandPaletteProps } from "./components/CommandPalette";
export {
  EmbeddedDocumentFrame,
  type EmbeddedDocumentFrameProps,
} from "./components/EmbeddedDocumentFrame";
export {
  MenuBar,
  Toolbar,
  type ChromeTone,
  type MenuBarGroup,
  type MenuBarProps,
  type ToolbarProps,
} from "./components/MenuBar";
export { PanelHeader, type PanelHeaderProps } from "./components/PanelHeader";
export { SettingsGroup, type SettingsGroupProps } from "./components/SettingsGroup";
export { SettingsLayout, type SettingsLayoutProps } from "./components/SettingsLayout";
export { SettingsRow, type SettingsRowProps } from "./components/SettingsRow";
export { StateBoundary, type StateBoundaryProps } from "./components/StateBoundary";
