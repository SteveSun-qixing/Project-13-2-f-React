import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/app/providers/I18nProvider", () => ({
  useI18n() {
    return {
      t(key: string) {
        return key;
      },
    };
  },
}));

vi.mock("../../src/features/app-plugins/useAppPluginGovernance", () => ({
  useAppPluginGovernance() {
    return {
      plugins: [
        {
          pluginId: "com.chips.eco-settings-panel",
          name: "Eco Settings Panel",
          description: "self",
          version: "0.1.0",
          enabled: true,
          selfManaged: true,
          installPath: "/plugins/settings",
          installedAt: 1,
          capabilities: ["settings"],
          shortcut: {
            pluginId: "com.chips.eco-settings-panel",
            name: "Eco Settings Panel",
            location: "desktop",
            launcherPath: "/shortcuts/settings.lnk",
            executablePath: "/Applications/Chips Host",
            args: ["--chips-launch-plugin=com.chips.eco-settings-panel"],
            exists: true,
          },
        },
      ],
      loading: false,
      error: null,
      activeActionId: null,
      installWithFilePicker: () => undefined,
      installFromDroppedFiles: async () => undefined,
      togglePluginEnabled: async () => undefined,
      uninstallPlugin: async () => undefined,
      launchPlugin: async () => undefined,
      createPluginShortcut: async () => undefined,
      removePluginShortcut: async () => undefined,
      revealPluginShortcut: async () => undefined,
      refresh: async () => undefined,
      feedback: [],
      dismissFeedback: () => undefined,
    };
  },
}));

describe("AppPluginsPage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders a compact list row with icon, title and frequent actions only", async () => {
    const { AppPluginsPage } = await import("../../src/features/app-plugins/AppPluginsPage");
    const markup = renderToStaticMarkup(<AppPluginsPage />);

    expect(markup).toContain("settings-record-list");
    expect(markup).toContain("Eco Settings Panel");
    expect(markup).toContain("settingsPanel.appPlugins.actions.launch");
    expect(markup).toContain("settingsPanel.appPlugins.actions.disable");
    expect(markup).toContain("disabled");
    expect(markup).toContain("settingsPanel.common.details");
    expect(markup).not.toContain("settingsPanel.appPlugins.badges.currentApp");
    expect(markup).not.toContain("settingsPanel.appPlugins.fields.version");
    expect(markup).not.toContain("settingsPanel.appPlugins.fields.installedAt");
    expect(markup).not.toContain("settingsPanel.appPlugins.badges.shortcutReady");
    expect(markup).not.toContain("settings-drop-zone");
    expect(markup).not.toContain("settingsPanel.appPlugins.actions.uninstall");
    expect(markup).not.toContain("settingsPanel.appPlugins.actions.removeShortcut");
    expect(markup).not.toContain("ant-modal");
  }, 15000);
});
