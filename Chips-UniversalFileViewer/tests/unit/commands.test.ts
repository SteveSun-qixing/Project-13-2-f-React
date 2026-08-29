import { describe, expect, it } from "vitest";
import type { PlatformLaunchContext } from "chips-sdk";
import {
  UNIVERSAL_VIEWER_COMMAND_IDS,
  createUniversalViewerCommands,
} from "../../src/commands/universal-viewer-commands";

function createContext(overrides: Partial<Parameters<typeof createUniversalViewerCommands>[0]> = {}) {
  return {
    hasFile: true,
    openFile: () => undefined,
    saveCopy: () => undefined,
    reload: () => undefined,
    runToolbarAction: () => undefined,
    previousFile: () => undefined,
    nextFile: () => undefined,
    ...overrides,
  };
}

describe("万能文件查看器命令定义", () => {
  it("以简体中文声明命令且带菜单分组", () => {
    const commands = createUniversalViewerCommands(createContext());
    expect(commands.length).toBeGreaterThanOrEqual(10);

    for (const command of commands) {
      expect(command.id.startsWith("universal-viewer.")).toBe(true);
      expect(command.title.length).toBeGreaterThan(0);
      expect(command.title).toMatch(/[\u4e00-\u9fff]/);
      expect(typeof command.run).toBe("function");
      expect(["文件", "查看", "导航"]).toContain(command.group);
      expect(command.menuId).toBeDefined();
    }
  });

  it("文件未打开时禁用查看类命令但保留打开文件", () => {
    const commands = createUniversalViewerCommands(createContext({ hasFile: false }));
    const openFile = commands.find((command) => command.id === UNIVERSAL_VIEWER_COMMAND_IDS.openFile);
    const zoomIn = commands.find((command) => command.id === UNIVERSAL_VIEWER_COMMAND_IDS.zoomIn);
    const saveCopy = commands.find((command) => command.id === UNIVERSAL_VIEWER_COMMAND_IDS.saveCopy);

    expect(openFile?.enabled).not.toBe(false);
    expect(zoomIn?.enabled).toBe(false);
    expect(saveCopy?.enabled).toBe(false);
  });

  it("打开文件命令绑定 Mod+O 快捷键", () => {
    const commands = createUniversalViewerCommands(createContext());
    const openFile = commands.find((command) => command.id === UNIVERSAL_VIEWER_COMMAND_IDS.openFile);
    expect(openFile?.shortcut).toBe("Mod+O");
  });
});
