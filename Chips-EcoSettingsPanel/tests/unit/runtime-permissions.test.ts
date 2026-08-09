import { afterEach, describe, expect, it } from "vitest";
import type { MockChipsClient } from "chips-sdk";
import { SETTINGS_PANEL_PERMISSIONS } from "../../src/app/settings-permissions";
import { SettingsRuntimeService } from "../../src/shared/runtime/settings-runtime-service";
import { createSettingsMockClient } from "../support/settings-host";

async function expectPermissionDenied(
  client: MockChipsClient,
  run: (service: SettingsRuntimeService) => Promise<unknown>,
  expected: {
    action: string;
    required: string;
    granted?: string[];
  },
): Promise<void> {
  client.mockHost.setPermissionDenied(
    expected.action,
    expected.required,
    expected.granted ?? [...SETTINGS_PANEL_PERMISSIONS].filter((permission) => permission !== expected.required),
    {
      pluginId: "com.chips.eco-settings-panel",
    },
  );

  const service = new SettingsRuntimeService(client);
  await expect(run(service)).rejects.toMatchObject({
    code: "PERMISSION_DENIED",
    permission: {
      action: expected.action,
      required: [expected.required],
      pluginId: "com.chips.eco-settings-panel",
    },
  });
}

describe("SettingsRuntimeService permission handling", () => {
  const clients: MockChipsClient[] = [];

  afterEach(() => {
    for (const client of clients.splice(0)) {
      client.restoreBridge();
    }
  });

  function track(client: MockChipsClient): MockChipsClient {
    clients.push(client);
    return client;
  }

  it("normalizes permission denials for plugin management actions", async () => {
    await expectPermissionDenied(track(createSettingsMockClient()), (service) => service.installAppPlugin("/packages/app.cpk"), {
      action: "plugin.install",
      required: "plugin.manage",
    });
    await expectPermissionDenied(track(createSettingsMockClient()), (service) => service.enablePlugin("app.viewer"), {
      action: "plugin.enable",
      required: "plugin.manage",
    });
    await expectPermissionDenied(track(createSettingsMockClient()), (service) => service.disablePlugin("app.viewer"), {
      action: "plugin.disable",
      required: "plugin.manage",
    });
    await expectPermissionDenied(track(createSettingsMockClient()), (service) => service.uninstallPlugin("app.viewer"), {
      action: "plugin.uninstall",
      required: "plugin.manage",
    });
    await expectPermissionDenied(track(createSettingsMockClient()), (service) => service.launchPlugin("app.viewer"), {
      action: "plugin.launch",
      required: "plugin.manage",
    });
    await expectPermissionDenied(track(createSettingsMockClient()), (service) => service.createPluginShortcut("app.viewer"), {
      action: "plugin.createShortcut",
      required: "plugin.manage",
    });
    await expectPermissionDenied(track(createSettingsMockClient()), (service) => service.removePluginShortcut("app.viewer"), {
      action: "plugin.removeShortcut",
      required: "plugin.manage",
    });
  });

  it("normalizes permission denials for platform dialogs and shell actions", async () => {
    await expectPermissionDenied(
      track(createSettingsMockClient()),
      (service) => service.openPluginFileDialog("app", { title: "Install", filterName: "Plugin" }),
      {
        action: "platform.dialogOpenFile",
        required: "platform.read",
      },
    );
    await expectPermissionDenied(track(createSettingsMockClient()), (service) => service.showConfirm("Confirm", "Continue?"), {
      action: "platform.dialogShowConfirm",
      required: "platform.read",
    });
    await expectPermissionDenied(track(createSettingsMockClient()), (service) => service.showMessage("Done", "Finished"), {
      action: "platform.dialogShowMessage",
      required: "platform.read",
    });
    await expectPermissionDenied(track(createSettingsMockClient()), (service) => service.revealPath("/shortcuts/app.viewer"), {
      action: "platform.shellShowItemInFolder",
      required: "platform.external",
    });
  });
});
