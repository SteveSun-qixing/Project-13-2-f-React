import { describe, expect, it } from "vitest";
import {
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  appCommandDefinitions,
  createAppCommands,
} from "../../src/commands/app-commands";
import { formatMessage } from "../../src/lib/messages";

function noopHandlers() {
  return {
    fileOpen: () => undefined,
    fileNew: () => undefined,
    fileSave: () => undefined,
    fileSaveAs: () => undefined,
    fileExportPng: () => undefined,
    editUndo: () => undefined,
    editRedo: () => undefined,
    viewZoomIn: () => undefined,
    viewZoomOut: () => undefined,
    viewZoomReset: () => undefined,
    slideAdd: () => undefined,
    slideDuplicate: () => undefined,
    slideDelete: () => undefined,
  };
}

describe("应用命令注册表契约", () => {
  it("宿主侧命令定义具备可序列化元数据与中文标题", () => {
    expect(appCommandDefinitions.length).toBeGreaterThanOrEqual(12);

    for (const definition of appCommandDefinitions) {
      expect(definition.commandId.startsWith(`${APP_PLUGIN_ID}.`)).toBe(true);
      expect(definition.titleKey.length).toBeGreaterThan(0);
      expect(definition.handlerId).toBeTypeOf("string");
      expect(definition.scope).toEqual({ kind: "app", appId: APP_PLUGIN_ID });
      expect(definition.state?.enabled).toBe(true);
      expect(definition.state?.visible).toBe(true);
    }
  });

  it("必须提供文件/视图/幻灯片命令集合", () => {
    expect(APP_COMMAND_IDS.fileOpen).toBe("com.chips.slide.file.open");
    expect(APP_COMMAND_IDS.fileSave).toBe("com.chips.slide.file.save");
    expect(APP_COMMAND_IDS.fileSaveAs).toBe("com.chips.slide.file.save-as");
    expect(APP_COMMAND_IDS.fileExportPng).toBe("com.chips.slide.file.export-png");
    expect(APP_COMMAND_IDS.viewZoomIn).toBe("com.chips.slide.view.zoom-in");
    expect(APP_COMMAND_IDS.viewZoomOut).toBe("com.chips.slide.view.zoom-out");
    expect(APP_COMMAND_IDS.viewZoomReset).toBe("com.chips.slide.view.zoom-reset");
  });

  it("本地 CommandItem 具备中文标题、分组与快捷键", () => {
    const commands = createAppCommands(noopHandlers());

    const byId = new Map(commands.map((command) => [command.id, command]));
    expect(byId.get(APP_COMMAND_IDS.fileOpen)?.title).toBe("打开文件");
    expect(byId.get(APP_COMMAND_IDS.fileOpen)?.shortcut).toBe("Mod+O");
    expect(byId.get(APP_COMMAND_IDS.fileOpen)?.group).toBe("文件");
    expect(byId.get(APP_COMMAND_IDS.fileSave)?.shortcut).toBe("Mod+S");
    expect(byId.get(APP_COMMAND_IDS.fileSaveAs)?.shortcut).toBe("Mod+Shift+S");
    expect(byId.get(APP_COMMAND_IDS.viewZoomIn)?.shortcut).toBe("Mod+=");
    expect(byId.get(APP_COMMAND_IDS.viewZoomOut)?.shortcut).toBe("Mod+-");
    expect(byId.get(APP_COMMAND_IDS.viewZoomReset)?.shortcut).toBe("Mod+0");

    for (const command of commands) {
      expect(command.group).toMatch(/^(文件|编辑|视图|幻灯片)$/);
      expect(typeof command.run).toBe("function");
    }
  });

  it("导出当前页 PNG 命令存在且可运行", () => {
    const commands = createAppCommands(noopHandlers());
    const command = commands.find((c) => c.id === APP_COMMAND_IDS.fileExportPng);
    expect(command).toBeDefined();
    expect(command?.group).toBe("文件");
  });

  it("文案表以简体中文直写并提供缺省回退", () => {
    expect(formatMessage("commands.file.open.title")).toBe("打开文件");
    expect(formatMessage("app.missing.key")).toBe("app.missing.key");
  });
});
