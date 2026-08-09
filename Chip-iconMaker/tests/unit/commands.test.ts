import { describe, expect, it } from "vitest";
import type { CommandInvokedEvent } from "chips-sdk";
import { createMockChipsClient } from "chips-sdk/testing";
import { appConfig } from "../../config/app-config";
import {
  APP_COMMAND_HANDLER_IDS,
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  appCommandDefinitions,
  createAppCommandStatus,
  createAppCommands,
  getAppCommandHandlerId,
  isAppCommandInvokedEvent,
} from "../../src/commands/app-commands";

describe("app command registry contract", () => {
  it("declares serializable command metadata with Chinese titles", () => {
    expect(appCommandDefinitions.length).toBeGreaterThan(0);

    for (const definition of appCommandDefinitions) {
      const record = definition as unknown as Record<string, unknown>;
      expect(definition.commandId.startsWith(`${APP_PLUGIN_ID}.`)).toBe(true);
      expect(definition.titleKey.length).toBeGreaterThan(0);
      expect(definition.handlerId).toBeTypeOf("string");
      expect(definition.scope).toEqual({ kind: "app", appId: APP_PLUGIN_ID });
      expect(definition.menuPlacement?.length).toBeGreaterThan(0);
      expect(definition.toolbarPlacement?.length).toBeGreaterThan(0);
      expect(definition.paletteKeywords?.length).toBeGreaterThan(0);
      expect(record.title).toBeUndefined();
      expect(record.label).toBeUndefined();
    }
  });

  it("derives local CommandItem entries with Chinese titles", () => {
    const handlers = {
      focusImporter: () => undefined,
      generateIcons: () => undefined,
    };
    const commands = createAppCommands(handlers);

    expect(commands.length).toBe(2);
    for (const command of commands) {
      expect(command.id.startsWith(`${appConfig.appId}.`)).toBe(true);
      expect(command.title.length).toBeGreaterThan(0);
      expect(typeof command.run).toBe("function");
      expect(command.menuId).toBe("file");
      expect(command.toolbarId).toBe("main");
    }

    const focus = commands.find((command) => command.id === APP_COMMAND_IDS.focusImporter);
    const generate = commands.find((command) => command.id === APP_COMMAND_IDS.generateIcons);
    expect(focus?.title).toBe("选择源图");
    expect(generate?.title).toBe("生成图标");
  });

  it("uses SDK testing mock host for register and invoke", async () => {
    const client = createMockChipsClient();
    const invoked: string[] = [];
    client.command.onInvoked((event) => {
      invoked.push(event.commandId);
    });

    for (const definition of appCommandDefinitions) {
      await client.command.register(definition);
    }
    const menuCommands = await client.command.list({ source: "menu" });
    const paletteCommands = await client.command.list({ source: "palette" });
    await client.command.invoke(APP_COMMAND_IDS.focusImporter, {}, { source: "toolbar" });

    expect(client.calls.slice(0, 2).map((call) => call.action)).toEqual([
      "command.register",
      "command.register",
    ]);
    expect(menuCommands.map((command) => command.commandId)).toEqual(Object.values(APP_COMMAND_IDS));
    expect(paletteCommands.map((command) => command.commandId)).toEqual(Object.values(APP_COMMAND_IDS));
    expect(client.calls.at(-1)?.payload).toMatchObject({
      commandId: APP_COMMAND_IDS.focusImporter,
      source: "toolbar",
      payload: {},
    });
    expect(invoked).toEqual([APP_COMMAND_IDS.focusImporter]);
    client.restoreBridge();
  });

  it("handles command.invoked events by handlerId", () => {
    const event: CommandInvokedEvent = {
      commandId: APP_COMMAND_IDS.focusImporter,
      handlerId: APP_COMMAND_HANDLER_IDS.focusImporter,
      ownerPluginId: APP_PLUGIN_ID,
      invocationId: "invocation-test",
      source: "palette",
      payload: {
        inputPath: "/tmp/source.png",
      },
      context: {
        taskId: "cli-task-test",
      },
      command: {
        ...appCommandDefinitions[0],
        diagnostic: {
          visible: true,
          enabled: true,
          checked: false,
        },
      },
    };

    expect(isAppCommandInvokedEvent(event)).toBe(true);
    const handlerId = getAppCommandHandlerId(event);
    expect(handlerId).toBe(APP_COMMAND_HANDLER_IDS.focusImporter);
    expect(createAppCommandStatus(event, handlerId!)).toEqual({
      commandId: APP_COMMAND_IDS.focusImporter,
      handlerId: APP_COMMAND_HANDLER_IDS.focusImporter,
      invocationId: "invocation-test",
      payload: {
        inputPath: "/tmp/source.png",
      },
      context: {
        taskId: "cli-task-test",
      },
      source: "palette",
    });

    const foreignEvent: CommandInvokedEvent = {
      ...event,
      commandId: "com.chips.other.command",
      handlerId: "other:command",
      ownerPluginId: "com.chips.other",
    };
    expect(isAppCommandInvokedEvent(foreignEvent)).toBe(false);
    expect(getAppCommandHandlerId(foreignEvent)).toBeNull();
  });
});
