import { afterEach, describe, expect, it } from "vitest";
import type { MockChipsClient } from "chips-sdk";
import { settingsCommandDefinitions } from "../../src/commands/settings-commands";
import { SettingsRuntimeService } from "../../src/shared/runtime/settings-runtime-service";
import { createSettingsMockClient } from "../support/settings-host";

describe("设置面板 Host mock smoke", () => {
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

  it("exercises the formal SDK/Bridge action sequence used by the migrated settings panel", async () => {
    const client = track(createSettingsMockClient());
    const service = new SettingsRuntimeService(client);

    for (const definition of settingsCommandDefinitions) {
      await client.command.register(definition);
    }

    await service.listAppPlugins();
    await service.listPlugins("card");
    await service.openPluginFileDialog("app", {
      title: "Install app plugin",
      filterName: "Plugin package",
    });
    await service.installPluginOfType("/packages/demo-plugin.cpk", "card");
    await service.enablePlugin("app.viewer");
    await service.disablePlugin("app.viewer");
    await service.createPluginShortcut("app.viewer", true);
    await service.removePluginShortcut("app.viewer");
    await service.revealPath("/shortcuts/app.viewer");
    await service.showConfirm("Confirm", "Continue?");
    await service.showMessage("Done", "Finished");
    await client.command.invoke(settingsCommandDefinitions[0].commandId, {}, { source: "palette" });

    expect(client.calls.map((call) => call.action)).toEqual([
      ...settingsCommandDefinitions.map(() => "command.register"),
      "plugin.query",
      "plugin.getShortcut",
      "plugin.query",
      "platform.dialogOpenFile",
      "plugin.install",
      "plugin.get",
      "plugin.enable",
      "plugin.disable",
      "plugin.createShortcut",
      "plugin.removeShortcut",
      "platform.shellShowItemInFolder",
      "platform.dialogShowConfirm",
      "platform.dialogShowMessage",
      "command.invoke",
    ]);
  });
});
