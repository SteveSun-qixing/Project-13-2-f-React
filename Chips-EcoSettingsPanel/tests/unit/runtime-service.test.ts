import { describe, expect, it, vi } from "vitest";
import type { Client } from "chips-sdk";
import { appConfig } from "../../config/app-config";
import { SettingsRuntimeService } from "../../src/shared/runtime/settings-runtime-service";

function createClientMock(): Client {
  return {
    invoke: vi.fn(),
    events: {
      on: vi.fn(() => () => undefined),
      once: vi.fn(),
      emit: vi.fn(),
    },
    theme: {
      list: vi.fn(),
      getCurrent: vi.fn(),
      apply: vi.fn(),
      getAllCss: vi.fn(),
      contract: { get: vi.fn() },
      resolve: vi.fn(),
    },
    i18n: {
      getCurrent: vi.fn(),
      setCurrent: vi.fn(),
      translate: vi.fn(),
      listLocales: vi.fn(),
    },
    plugin: {
      query: vi.fn(),
      install: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      uninstall: vi.fn(),
      launch: vi.fn(),
      getShortcut: vi.fn(),
      createShortcut: vi.fn(),
      removeShortcut: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      getSelf: vi.fn(),
      getCardPlugin: vi.fn(),
      getLayoutPlugin: vi.fn(),
    },
    platform: {
      getInfo: vi.fn(),
      getCapabilities: vi.fn(),
      openExternal: vi.fn(),
      getPathForFile: vi.fn(() => ""),
      openFile: vi.fn(),
      showConfirm: vi.fn(),
      showMessage: vi.fn(),
      shellShowItemInFolder: vi.fn(),
    },
    file: {} as Client["file"],
    card: {} as Client["card"],
    config: {} as Client["config"],
    module: {} as Client["module"],
    window: {} as Client["window"],
    box: {} as Client["box"],
    resource: {} as Client["resource"],
    clientConfig: {},
  } as unknown as Client;
}

describe("SettingsRuntimeService", () => {
  it("sorts enabled app plugins ahead of disabled ones", async () => {
    const client = createClientMock();
    vi.mocked(client.plugin.query).mockResolvedValue([
      {
        id: appConfig.appId,
        type: "app",
        name: "Eco Settings Panel",
        version: "2.1.0",
        description: "Current app",
        enabled: true,
        installPath: "/plugins/settings",
        installedAt: 4,
        capabilities: ["settings"],
      },
      {
        id: "app.disabled",
        type: "app",
        name: "Beta Tools",
        version: "1.0.0",
        description: "Disabled",
        enabled: false,
        installPath: "/plugins/beta",
        installedAt: 1,
        capabilities: ["beta"],
      },
      {
        id: "app.enabled",
        type: "app",
        name: "Alpha Tools",
        version: "2.0.0",
        description: "Enabled",
        enabled: true,
        installPath: "/plugins/alpha",
        installedAt: 2,
        capabilities: ["alpha"],
      },
    ] as never);
    vi.mocked(client.plugin.getShortcut).mockImplementation(async (pluginId: string) => ({
      pluginId,
      name: String(pluginId),
      location: "desktop",
      launcherPath: `/shortcuts/${pluginId}.lnk`,
      executablePath: "/Applications/Chips Host",
      args: [`--chips-launch-plugin=${pluginId}`],
      exists: pluginId !== "app.disabled",
    }));

    const service = new SettingsRuntimeService(client);
    const plugins = await service.listAppPlugins();

    expect(plugins.map((plugin) => plugin.pluginId)).toEqual(["app.enabled", appConfig.appId, "app.disabled"]);
    expect(plugins[0]).toMatchObject({
      pluginId: "app.enabled",
      selfManaged: false,
      capabilities: ["alpha"],
    });
    expect(plugins[1]).toMatchObject({
      pluginId: appConfig.appId,
      selfManaged: true,
      capabilities: ["settings"],
    });
    expect(plugins[2]).toMatchObject({
      pluginId: "app.disabled",
      selfManaged: false,
      capabilities: ["beta"],
    });
  });

  it("lists governed card plugins through the formal runtime query", async () => {
    const client = createClientMock();
    vi.mocked(client.plugin.query).mockResolvedValue([
      {
        id: "chips.basecard.richtext",
        type: "card",
        name: "RichText",
        version: "1.0.0",
        description: "Rich text card",
        enabled: true,
        installPath: "/plugins/richtext",
        installedAt: 2,
        capabilities: ["base.richtext", "RichTextCard"],
      },
      {
        id: "chips.basecard.image",
        type: "card",
        name: "Image",
        version: "1.0.0",
        description: "Image card",
        enabled: false,
        installPath: "/plugins/image",
        installedAt: 1,
        capabilities: ["base.image", "ImageCard"],
      },
    ] as never);

    const service = new SettingsRuntimeService(client);
    const plugins = await service.listPlugins("card");

    expect(client.plugin.query).toHaveBeenCalledWith({ type: "card" });
    expect(plugins.map((plugin) => plugin.pluginId)).toEqual([
      "chips.basecard.richtext",
      "chips.basecard.image",
    ]);
    expect(plugins[0]).toMatchObject({
      pluginId: "chips.basecard.richtext",
      type: "card",
      enabled: true,
      cardTypes: ["base.richtext", "RichTextCard"],
    });
  });

  it("validates the installed plugin type before accepting the package", async () => {
    const client = createClientMock();
    vi.mocked(client.plugin.install).mockResolvedValue({
      pluginId: "chips.basecard.image",
      installPath: "/plugins/image",
    } as never);
    vi.mocked(client.plugin.get).mockResolvedValue({
      id: "chips.basecard.image",
      type: "card",
      name: "Image",
      version: "1.0.0",
      enabled: false,
      installPath: "/plugins/image",
      installedAt: 1,
      capabilities: ["base.image"],
    } as never);

    const service = new SettingsRuntimeService(client);
    await service.installPluginOfType("/packages/image-plugin.cpk", "card");

    expect(client.plugin.install).toHaveBeenCalledWith("/packages/image-plugin.cpk");
    expect(client.plugin.get).toHaveBeenCalledWith("chips.basecard.image");
  });

  it("opens the plugin file dialog through the SDK platform Domain API", async () => {
    const client = createClientMock();
    vi.mocked(client.platform.openFile).mockResolvedValue(["/packages/demo.cpk"]);

    const service = new SettingsRuntimeService(client);
    const paths = await service.openPluginFileDialog("theme", {
      title: "Install theme package",
      filterName: "Theme package",
    });

    expect(paths).toEqual(["/packages/demo.cpk"]);
    expect(client.platform.openFile).toHaveBeenCalledWith({
      title: "Install theme package",
      mode: "file-or-directory",
      allowMultiple: false,
      filters: [
        {
          name: "Theme package",
          extensions: ["cpk", "yaml", "yml", "json"],
        },
      ],
    });
  });

  it("uses SDK platform helpers for reveal and system dialogs", async () => {
    const client = createClientMock();
    vi.mocked(client.platform.showConfirm).mockResolvedValue(true);
    vi.mocked(client.platform.showMessage).mockResolvedValue(0);

    const service = new SettingsRuntimeService(client);
    await service.revealPath("/shortcuts/app.viewer");
    const confirmed = await service.showConfirm("Confirm", "Continue?", "Details");
    await service.showMessage("Done", "Finished", "Details");

    expect(client.platform.shellShowItemInFolder).toHaveBeenCalledWith("/shortcuts/app.viewer");
    expect(confirmed).toBe(true);
    expect(client.platform.showConfirm).toHaveBeenCalledWith({
      title: "Confirm",
      message: "Continue?",
      detail: "Details",
    });
    expect(client.platform.showMessage).toHaveBeenCalledWith({
      title: "Done",
      message: "Finished",
      detail: "Details",
    });
  });

  it("launches app plugins through the formal Host route", async () => {
    const client = createClientMock();
    vi.mocked(client.plugin.launch).mockResolvedValue({
      window: { id: "window-1" },
      session: {
        sessionId: "session-1",
        sessionNonce: "nonce-1",
        permissions: [],
      },
    } as never);

    const service = new SettingsRuntimeService(client);
    await service.launchPlugin("app.viewer");

    expect(client.plugin.launch).toHaveBeenCalledWith("app.viewer", {});
  });
});
