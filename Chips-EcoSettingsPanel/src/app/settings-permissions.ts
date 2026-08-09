export const SETTINGS_PANEL_PERMISSIONS = [
  "theme.write",
  "i18n.write",
  "plugin.read",
  "plugin.manage",
  "platform.read",
  "platform.external",
  "command.read",
  "command.write",
  "command.invoke",
] as const;

export type SettingsPanelPermission = (typeof SETTINGS_PANEL_PERMISSIONS)[number];
