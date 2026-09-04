import { describe, expect, it } from "vitest";
import type { CommandInvokedEvent } from "chips-sdk";
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

function makeInvokedEvent(overrides: Partial<CommandInvokedEvent>): CommandInvokedEvent {
  return {
    commandId: APP_COMMAND_IDS.fileOpen,
    handlerId: APP_COMMAND_HANDLER_IDS.fileOpen,
    ownerPluginId: APP_PLUGIN_ID,
    source: "menu",
    invocationId: "inv-1",
    payload: {},
    ...overrides,
  } as CommandInvokedEvent;
}

describe("应用命令契约", () => {
  it("声明五条文件命令，ID 以应用插件为前缀", () => {
    expect(appCommandDefinitions.map((definition) => definition.commandId)).toEqual([
      APP_COMMAND_IDS.fileOpen,
      APP_COMMAND_IDS.fileSave,
      APP_COMMAND_IDS.fileSaveAs,
      APP_COMMAND_IDS.fileNew,
      APP_COMMAND_IDS.fileExportCsv,
    ]);
    for (const definition of appCommandDefinitions) {
      expect(definition.commandId.startsWith(`${APP_PLUGIN_ID}.`)).toBe(true);
      expect(definition.scope).toEqual({ kind: "app", appId: APP_PLUGIN_ID });
      expect(definition.handlerId).toBeTypeOf("string");
      expect(definition.titleKey.length).toBeGreaterThan(0);
      expect(definition.menuPlacement?.length).toBeGreaterThan(0);
      expect(definition.toolbarPlacement?.length).toBeGreaterThan(0);
    }
  });

  it("命令标题与描述使用简体中文直写", () => {
    for (const definition of appCommandDefinitions) {
      expect(definition.titleKey).toMatch(/[\u4e00-\u9fff]/);
      expect(definition.descriptionKey).toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it("本地 CommandItem 绑定快捷键与中文分组，并接到传入的处理器", () => {
    const calls: string[] = [];
    const commands = createAppCommands({
      fileOpen: () => calls.push("open"),
      fileSave: () => calls.push("save"),
      fileSaveAs: () => calls.push("save-as"),
      fileNew: () => calls.push("new"),
      fileExportCsv: () => calls.push("export-csv"),
    });

    expect(commands.map((command) => command.id)).toEqual([
      APP_COMMAND_IDS.fileOpen,
      APP_COMMAND_IDS.fileSave,
      APP_COMMAND_IDS.fileSaveAs,
      APP_COMMAND_IDS.fileNew,
      APP_COMMAND_IDS.fileExportCsv,
    ]);
    expect(commands.map((command) => command.shortcut)).toEqual([
      "Mod+O",
      "Mod+S",
      "Mod+Shift+S",
      "Mod+N",
      undefined,
    ]);
    for (const command of commands) {
      expect(command.group).toBe("文件");
      expect(command.menuId).toBe("file");
    }

    commands[0]?.run();
    commands[1]?.run();
    commands[2]?.run();
    commands[3]?.run();
    commands[4]?.run();
    expect(calls).toEqual(["open", "save", "save-as", "new", "export-csv"]);
  });

  it("只接受本应用命令的调用事件", () => {
    expect(isAppCommandInvokedEvent(makeInvokedEvent({}))).toBe(true);
    expect(
      isAppCommandInvokedEvent(
        makeInvokedEvent({ commandId: "com.other.plugin.file.open" }),
      ),
    ).toBe(false);
    expect(
      isAppCommandInvokedEvent(
        makeInvokedEvent({ ownerPluginId: "com.other.plugin" }),
      ),
    ).toBe(false);
  });

  it("从调用事件解析处理器 ID 并生成状态", () => {
    const event = makeInvokedEvent({ handlerId: APP_COMMAND_HANDLER_IDS.fileSaveAs });
    expect(getAppCommandHandlerId(event)).toBe(APP_COMMAND_HANDLER_IDS.fileSaveAs);
    expect(getAppCommandHandlerId(makeInvokedEvent({ handlerId: "unknown" }))).toBeNull();

    const status = createAppCommandStatus(event, APP_COMMAND_HANDLER_IDS.fileSaveAs);
    expect(status).toMatchObject({
      commandId: APP_COMMAND_IDS.fileOpen,
      handlerId: APP_COMMAND_HANDLER_IDS.fileSaveAs,
      source: "menu",
      invocationId: "inv-1",
    });
  });
});
