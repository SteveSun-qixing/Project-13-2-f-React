// @vitest-environment jsdom
import "../support/antd-test-setup";
import React from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../src/app/providers/I18nProvider", () => ({
  useI18n() {
    return {
      t(key: string, params?: Record<string, string | number>) {
        if (!params) {
          return key;
        }
        return `${key}:${JSON.stringify(params)}`;
      },
    };
  },
}));

vi.mock("../../src/features/app-plugins/useAppPluginGovernance", () => ({
  useAppPluginGovernance() {
    return {
      plugins: [
        {
          pluginId: "com.chips.demo-app",
          name: "Demo App",
          description: "demo",
          version: "0.1.0",
          enabled: true,
          selfManaged: false,
          installPath: "/plugins/demo",
          installedAt: 1,
          capabilities: ["demo"],
          shortcut: {
            pluginId: "com.chips.demo-app",
            name: "Demo App",
            location: "launchpad",
            launcherPath: "/Applications/Chips Apps/Demo.app",
            executablePath: "/Applications/Chips Host",
            args: ["--chips-launch-plugin=com.chips.demo-app"],
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

async function flushReact(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("settings record detail navigation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("opens a record detail page with a back button instead of a dialog", async () => {
    const { AppPluginsPage } = await import("../../src/features/app-plugins/AppPluginsPage");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await React.act(async () => {
        root.render(<AppPluginsPage />);
        await flushReact();
      });

      const detailButton = container.querySelector('button[aria-label*="settingsPanel.common.details"]');
      expect(detailButton).toBeTruthy();

      await React.act(async () => {
        detailButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await flushReact();
      });

      expect(container.innerHTML).toContain("settings-detail-page");
      expect(container.innerHTML).toContain("settingsPanel.common.back");
      expect(container.innerHTML).toContain("settingsPanel.appPlugins.actions.uninstall");
      expect(container.innerHTML).not.toContain('data-scope="dialog"');

      const backButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("settingsPanel.common.back"),
      );

      await React.act(async () => {
        backButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await flushReact();
      });

      expect(container.innerHTML).toContain("settings-record-list");
      expect(container.innerHTML).not.toContain("settings-detail-page");
    } finally {
      React.act(() => {
        root.unmount();
      });
      container.remove();
    }
  }, 15000);
});
