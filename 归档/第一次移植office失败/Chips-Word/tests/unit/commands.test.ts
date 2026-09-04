import { describe, expect, it } from "vitest";
import {
  APP_COMMAND_HANDLER_IDS,
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  appCommandDefinitions,
  createAppCommands,
} from "../../src/commands/app-commands";
import { formatMessage } from "../../src/lib/messages";

const noopHandlers = {
  fileNew: () => undefined,
  fileOpen: () => undefined,
  fileSave: () => undefined,
  fileSaveAs: () => undefined,
  filePrint: () => undefined,
  viewZoomIn: () => undefined,
  viewZoomOut: () => undefined,
  viewZoomReset: () => undefined,
};

describe("应用命令注册契约", () => {
  it("命令 ID 均以应用插件 ID 为前缀", () => {
    expect(APP_PLUGIN_ID).toBe("com.chips.word");
    expect(Object.values(APP_COMMAND_IDS)).toEqual([
      "com.chips.word.file.new",
      "com.chips.word.file.open",
      "com.chips.word.file.save",
      "com.chips.word.file.save-as",
      "com.chips.word.file.print",
      "com.chips.word.view.zoom-in",
      "com.chips.word.view.zoom-out",
      "com.chips.word.view.zoom-reset",
    ]);
    for (const definition of appCommandDefinitions) {
      expect(definition.commandId.startsWith(`${APP_PLUGIN_ID}.`)).toBe(true);
      expect(definition.titleKey.length).toBeGreaterThan(0);
      expect(definition.handlerId).toBeTypeOf("string");
      expect(definition.scope).toEqual({ kind: "app", appId: APP_PLUGIN_ID });
    }
  });

  it("覆盖打开/保存/另存为/打印与缩放命令", () => {
    const ids = appCommandDefinitions.map((definition) => definition.commandId);
    for (const commandId of Object.values(APP_COMMAND_IDS)) {
      expect(ids).toContain(commandId);
    }
  });

  it("本地 CommandItem 使用中文标题与中文分组", () => {
    const commands = createAppCommands(noopHandlers);
    expect(commands.map((command) => command.id)).toEqual(Object.values(APP_COMMAND_IDS));

    const byId = new Map(commands.map((command) => [command.id, command]));
    expect(byId.get(APP_COMMAND_IDS.fileOpen)?.title).toBe("打开文档");
    expect(byId.get(APP_COMMAND_IDS.fileNew)?.title).toBe("新建文档");
    expect(byId.get(APP_COMMAND_IDS.fileSave)?.title).toBe("保存");
    expect(byId.get(APP_COMMAND_IDS.fileSaveAs)?.title).toBe("另存为");
    expect(byId.get(APP_COMMAND_IDS.filePrint)?.title).toBe("打印");
    expect(byId.get(APP_COMMAND_IDS.viewZoomIn)?.title).toBe("放大");
    expect(byId.get(APP_COMMAND_IDS.viewZoomOut)?.title).toBe("缩小");
    expect(byId.get(APP_COMMAND_IDS.viewZoomReset)?.title).toBe("重置缩放");

    const groups = new Set(commands.map((command) => command.group));
    expect(groups).toEqual(new Set([formatMessage("command.group.file"), formatMessage("command.group.view")]));
    expect(groups).toContain("文件");
    expect(groups).toContain("视图");
  });

  it("快捷键与命令一一对应", () => {
    const commands = createAppCommands(noopHandlers);
    const byId = new Map(commands.map((command) => [command.id, command]));
    expect(byId.get(APP_COMMAND_IDS.fileOpen)?.shortcut).toBe("Mod+O");
    expect(byId.get(APP_COMMAND_IDS.fileSave)?.shortcut).toBe("Mod+S");
    expect(byId.get(APP_COMMAND_IDS.fileSaveAs)?.shortcut).toBe("Mod+Shift+S");
    expect(byId.get(APP_COMMAND_IDS.filePrint)?.shortcut).toBeUndefined();
    expect(byId.get(APP_COMMAND_IDS.viewZoomIn)?.shortcut).toBe("Mod+=");
    expect(byId.get(APP_COMMAND_IDS.viewZoomOut)?.shortcut).toBe("Mod+-");
    expect(byId.get(APP_COMMAND_IDS.viewZoomReset)?.shortcut).toBe("Mod+0");
  });

  it("handlerId 与命令 ID 语义对应", () => {
    expect(APP_COMMAND_HANDLER_IDS).toEqual({
      fileNew: "file.new",
      fileOpen: "file.open",
      fileSave: "file.save",
      fileSaveAs: "file.save-as",
      filePrint: "file.print",
      viewZoomIn: "view.zoom-in",
      viewZoomOut: "view.zoom-out",
      viewZoomReset: "view.zoom-reset",
    });
  });

  it("每个命令都携带可执行的 run 回调", () => {
    for (const command of createAppCommands(noopHandlers)) {
      expect(typeof command.run).toBe("function");
      expect(() => command.run()).not.toThrow();
    }
  });
});
