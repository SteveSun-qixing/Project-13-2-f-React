import { describe, expect, it } from "vitest";
import {
  createRichTextEditorCommands,
  RICH_TEXT_EDITOR_COMMAND_IDS,
} from "../../src/commands/rich-text-editor-commands";
import { appConfig } from "../../config/app-config";

const noopHandlers = {
  newDocument: () => undefined,
  openFile: () => undefined,
  save: () => undefined,
  saveAs: () => undefined,
  exportCard: () => undefined,
  preview: () => undefined,
  info: () => undefined,
  undo: () => undefined,
  redo: () => undefined,
  find: () => undefined,
  format: () => undefined,
};

describe("富文本编辑器命令", () => {
  it("使用稳定的应用级命令 ID 与中文标题", () => {
    const commands = createRichTextEditorCommands(noopHandlers, {
      isBusy: false,
      hasFilePath: false,
      canPreview: false,
    });

    expect(commands.length).toBeGreaterThanOrEqual(11);

    for (const command of commands) {
      expect(command.id.startsWith(`${appConfig.appId}.`)).toBe(true);
      expect(command.title.length).toBeGreaterThan(0);
      expect(typeof command.run).toBe("function");
    }
  });

  it("按运行时状态投影命令的可用性", () => {
    const idle = createRichTextEditorCommands(noopHandlers, {
      isBusy: false,
      hasFilePath: true,
      canPreview: false,
    });
    const busy = createRichTextEditorCommands(noopHandlers, {
      isBusy: true,
      hasFilePath: true,
      canPreview: false,
    });
    const previewable = createRichTextEditorCommands(noopHandlers, {
      isBusy: false,
      hasFilePath: true,
      canPreview: true,
    });

    const save = (commands: ReturnType<typeof createRichTextEditorCommands>) =>
      commands.find((command) => command.id === RICH_TEXT_EDITOR_COMMAND_IDS.save);
    const preview = (commands: ReturnType<typeof createRichTextEditorCommands>) =>
      commands.find((command) => command.id === RICH_TEXT_EDITOR_COMMAND_IDS.preview);

    expect(save(idle)?.enabled).toBe(true);
    expect(save(busy)?.enabled).toBe(false);
    expect(preview(idle)?.enabled).toBe(false);
    expect(preview(previewable)?.enabled).toBe(true);
  });

  it("编辑器自有的命令保持禁用并声明正确的菜单归属", () => {
    const commands = createRichTextEditorCommands(noopHandlers, {
      isBusy: false,
      hasFilePath: false,
      canPreview: false,
    });

    for (const id of [
      RICH_TEXT_EDITOR_COMMAND_IDS.undo,
      RICH_TEXT_EDITOR_COMMAND_IDS.redo,
      RICH_TEXT_EDITOR_COMMAND_IDS.find,
      RICH_TEXT_EDITOR_COMMAND_IDS.format,
    ]) {
      const command = commands.find((candidate) => candidate.id === id);
      expect(command?.enabled).toBe(false);
      expect(command?.menuId).toBeDefined();
    }
  });
});
