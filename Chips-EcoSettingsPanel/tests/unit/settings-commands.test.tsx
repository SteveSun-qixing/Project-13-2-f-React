// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createMockChipsClient, type CommandView, type MockChipsClient } from "chips-sdk";
import { CommandProvider } from "@chips/ui";
import { SETTINGS_PANEL_PERMISSIONS } from "../../src/app/settings-permissions";
import { SETTINGS_COMMAND_IDS, settingsCommandDefinitions } from "../../src/commands/settings-commands";
import { useSettingsCommands, type UseSettingsCommandsResult } from "../../src/commands/useSettingsCommands";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function flushReact(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createRenderer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    async render(element: React.ReactElement): Promise<void> {
      await React.act(async () => {
        root.render(element);
        await flushReact();
      });
    },
    unmount(): void {
      React.act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function createCommandClient(): MockChipsClient {
  return createMockChipsClient({
    installBridge: false,
    permissions: [...SETTINGS_PANEL_PERMISSIONS],
  });
}

function expectLatestCommandState(
  latest: UseSettingsCommandsResult | null,
): UseSettingsCommandsResult {
  expect(latest).not.toBeNull();
  return latest as UseSettingsCommandsResult;
}

describe("useSettingsCommands permission handling", () => {
  const clients: MockChipsClient[] = [];
  let renderer: ReturnType<typeof createRenderer> | null = null;

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
    for (const client of clients.splice(0)) {
      client.restoreBridge();
    }
  });

  function track(client: MockChipsClient): MockChipsClient {
    clients.push(client);
    return client;
  }

  it("enters an explicit error phase when command registration is denied", async () => {
    const client = track(createCommandClient());
    client.mockHost.setPermissionDenied("command.register", "command.write", ["command.read"], {
      pluginId: "com.chips.eco-settings-panel",
    });
    let latest: UseSettingsCommandsResult | null = null;

    function Harness() {
      latest = useSettingsCommands(client);
      return null;
    }

    renderer = createRenderer();
    await renderer.render(
      <CommandProvider>
        <Harness />
      </CommandProvider>,
    );

    const state = expectLatestCommandState(latest);
    expect(state.phase).toBe("error");
    expect(state.errorCode).toBe("PERMISSION_DENIED");
  });

  it("surfaces command invoke permission denials without losing registered commands", async () => {
    const client = track(createCommandClient());
    let latest: UseSettingsCommandsResult | null = null;

    function Harness() {
      latest = useSettingsCommands(client);
      return null;
    }

    renderer = createRenderer();
    await renderer.render(
      <CommandProvider>
        <Harness />
      </CommandProvider>,
    );

    let state = expectLatestCommandState(latest);
    expect(state.phase).toBe("ready");
    expect(client.state.commands).toHaveLength(settingsCommandDefinitions.length);

    client.mockHost.setPermissionDenied("command.invoke", "command.invoke", ["command.read", "command.write"], {
      pluginId: "com.chips.eco-settings-panel",
    });

    await React.act(async () => {
      await state.invokeCommand(SETTINGS_COMMAND_IDS["app-plugins"], "toolbar");
      await flushReact();
    });

    state = expectLatestCommandState(latest);
    expect(state.phase).toBe("error");
    expect(state.errorCode).toBe("PERMISSION_DENIED");
    expect(client.state.commands.map((command: CommandView) => command.commandId).sort()).toEqual(
      settingsCommandDefinitions.map((definition) => definition.commandId).sort(),
    );
  });
});
