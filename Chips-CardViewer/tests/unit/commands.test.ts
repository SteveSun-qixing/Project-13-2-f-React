import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it, vi } from "vitest";
import {
  CARD_VIEWER_COMMAND_HANDLER_IDS,
  CARD_VIEWER_COMMAND_IDS,
  cardViewerCommandDefinitions,
  createCardViewerCommands,
} from "../../src/commands/card-viewer-commands";

const FORBIDDEN_RAW_TEXT_FIELDS = ["title", "description", "label", "ariaLabel"] as const;

function readManifest(): { permissions?: string[] } {
  return parse(readFileSync(resolve(__dirname, "../../manifest.yaml"), "utf-8")) as {
    permissions?: string[];
  };
}

function createOpenHandlers() {
  return {
    invokeCommand: vi.fn(async () => undefined),
  };
}

describe("CardViewer commands", () => {
  it("defines the existing open-file action as a local command item", () => {
    const commands = createCardViewerCommands(createOpenHandlers(), { canOpenFile: true });

    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual(
      expect.objectContaining({
        id: CARD_VIEWER_COMMAND_IDS.openFile,
        title: "打开文件",
        menuId: "file",
        toolbarId: "main",
        group: "文件",
        enabled: true,
        visible: true,
      }),
    );
    expect(typeof commands[0]?.run).toBe("function");
  });

  it("keeps Host command definitions serializable and without raw display text", () => {
    expect(cardViewerCommandDefinitions).toHaveLength(1);
    expect(cardViewerCommandDefinitions[0]).toEqual(
      expect.objectContaining({
        commandId: CARD_VIEWER_COMMAND_IDS.openFile,
        titleKey: "card-viewer.commands.openFile.title",
        handlerId: CARD_VIEWER_COMMAND_HANDLER_IDS.openFile,
        scope: { kind: "app", appId: "com.chips.card-viewer" },
        permission: "platform.read",
      }),
    );
    for (const definition of cardViewerCommandDefinitions) {
      for (const field of FORBIDDEN_RAW_TEXT_FIELDS) {
        expect(definition).not.toHaveProperty(field);
      }
    }
  });

  it("routes command runs through the Host invocation chain", () => {
    const handlers = createOpenHandlers();
    const commands = createCardViewerCommands(handlers, { canOpenFile: true });

    commands[0]?.run();

    expect(handlers.invokeCommand).toHaveBeenCalledWith(CARD_VIEWER_COMMAND_IDS.openFile, "menu");
  });

  it("declares the Host command permissions required by registration and invocation", () => {
    const manifest = readManifest();

    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["command.read", "command.write", "command.invoke", "platform.read"]),
    );
  });
});
