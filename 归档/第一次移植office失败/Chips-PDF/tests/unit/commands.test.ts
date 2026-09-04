import { describe, expect, it } from "vitest";
import type { CommandInvokedEvent } from "chips-sdk";
import { createMockChipsClient } from "chips-sdk/testing";
import { appConfig } from "../../config/app-config";
import {
  APP_PLUGIN_ID,
  PDF_COMMAND_HANDLER_IDS,
  PDF_COMMAND_IDS,
  createPdfCommands,
  getPdfCommandId,
  isPdfCommandInvokedEvent,
  pdfCommandDefinitions,
  type PdfCommandId,
} from "../../src/commands/app-commands";
import type { PdfViewerBridge } from "../../src/commands/viewer-bridge";

function createBridgeStub(): PdfViewerBridge {
  return {
    hasDocument: () => false,
    openDocument: () => undefined,
    saveDocument: () => undefined,
    saveDocumentAs: () => undefined,
    zoomIn: () => undefined,
    zoomOut: () => undefined,
    zoomReset: () => undefined,
    nextPage: () => undefined,
    prevPage: () => undefined,
    toggleFind: () => undefined,
    toggleSidebar: () => undefined,
    setTool: () => undefined,
  };
}

describe("PDF 命令注册契约", () => {
  it("提交宿主的命令定义保持可序列化且带应用作用域", () => {
    expect(pdfCommandDefinitions.length).toBeGreaterThanOrEqual(13);

    const requiredIds: PdfCommandId[] = [
      PDF_COMMAND_IDS.fileOpen,
      PDF_COMMAND_IDS.fileSave,
      PDF_COMMAND_IDS.fileSaveAs,
      PDF_COMMAND_IDS.viewZoomIn,
      PDF_COMMAND_IDS.viewZoomOut,
      PDF_COMMAND_IDS.viewZoomReset,
      PDF_COMMAND_IDS.viewNextPage,
      PDF_COMMAND_IDS.viewPrevPage,
      PDF_COMMAND_IDS.viewFind,
      PDF_COMMAND_IDS.toolSelect,
      PDF_COMMAND_IDS.toolDraw,
      PDF_COMMAND_IDS.toolNote,
    ];
    const declaredIds = new Set(pdfCommandDefinitions.map((definition) => definition.commandId));
    for (const id of requiredIds) {
      expect(declaredIds.has(id)).toBe(true);
    }

    for (const definition of pdfCommandDefinitions) {
      const record = definition as unknown as Record<string, unknown>;
      expect(definition.commandId.startsWith(`${APP_PLUGIN_ID}.`)).toBe(true);
      expect(definition.titleKey.length).toBeGreaterThan(0);
      expect((definition.descriptionKey ?? "").length).toBeGreaterThan(0);
      expect(definition.handlerId).toBe(PDF_COMMAND_HANDLER_IDS[definition.commandId as PdfCommandId]);
      expect(definition.scope).toEqual({ kind: "app", appId: appConfig.appId });
      expect(definition.menuPlacement?.length).toBeGreaterThan(0);
      expect(definition.paletteKeywords?.length).toBeGreaterThan(0);
      expect(record.title).toBeUndefined();
      expect(record.label).toBeUndefined();
    }
  });

  it("本地 CommandItem 覆盖必配命令并携带中文标题、分组与快捷键", () => {
    const commands = createPdfCommands(createBridgeStub());
    const byId = new Map(commands.map((command) => [command.id, command]));

    expect(byId.get(PDF_COMMAND_IDS.fileOpen)?.title).toBe("打开文档");
    expect(byId.get(PDF_COMMAND_IDS.fileSave)?.title).toBe("保存");
    expect(byId.get(PDF_COMMAND_IDS.fileSaveAs)?.title).toBe("另存为");
    expect(byId.get(PDF_COMMAND_IDS.viewZoomIn)?.title).toBe("放大");
    expect(byId.get(PDF_COMMAND_IDS.viewZoomOut)?.title).toBe("缩小");
    expect(byId.get(PDF_COMMAND_IDS.viewZoomReset)?.title).toBe("重置缩放");
    expect(byId.get(PDF_COMMAND_IDS.viewNextPage)?.title).toBe("下一页");
    expect(byId.get(PDF_COMMAND_IDS.viewPrevPage)?.title).toBe("上一页");
    expect(byId.get(PDF_COMMAND_IDS.viewFind)?.title).toBe("查找");
    expect(byId.get(PDF_COMMAND_IDS.toolSelect)?.title).toBe("选择工具");
    expect(byId.get(PDF_COMMAND_IDS.toolDraw)?.title).toBe("绘图工具");
    expect(byId.get(PDF_COMMAND_IDS.toolNote)?.title).toBe("便签工具");

    expect(byId.get(PDF_COMMAND_IDS.fileOpen)?.shortcut).toBe("Mod+O");
    expect(byId.get(PDF_COMMAND_IDS.fileSave)?.shortcut).toBe("Mod+S");
    expect(byId.get(PDF_COMMAND_IDS.fileSaveAs)?.shortcut).toBe("Mod+Shift+S");
    expect(byId.get(PDF_COMMAND_IDS.viewZoomIn)?.shortcut).toBe("Mod+=");
    expect(byId.get(PDF_COMMAND_IDS.viewZoomOut)?.shortcut).toBe("Mod+-");
    expect(byId.get(PDF_COMMAND_IDS.viewZoomReset)?.shortcut).toBe("Mod+0");
    expect(byId.get(PDF_COMMAND_IDS.viewFind)?.shortcut).toBe("Mod+F");

    const groups = new Set(commands.map((command) => command.group));
    expect([...groups].sort()).toEqual(["批注", "文件", "视图"].sort());

    for (const command of commands) {
      expect(command.id.startsWith(`${appConfig.appId}.`)).toBe(true);
      expect(command.title.length).toBeGreaterThan(0);
      expect(typeof command.run).toBe("function");
    }
  });

  it("命令 run 通过查看器桥触发对应动作", () => {
    const calls: string[] = [];
    const bridge: PdfViewerBridge = {
      hasDocument: () => true,
      openDocument: () => {
      calls.push("open");
    },
      saveDocument: () => {
      calls.push("save");
    },
      saveDocumentAs: () => {
      calls.push("save-as");
    },
      zoomIn: () => {
      calls.push("zoom-in");
    },
      zoomOut: () => {
      calls.push("zoom-out");
    },
      zoomReset: () => {
      calls.push("zoom-reset");
    },
      nextPage: () => {
      calls.push("next-page");
    },
      prevPage: () => {
      calls.push("prev-page");
    },
      toggleFind: () => {
      calls.push("find");
    },
      toggleSidebar: () => {
      calls.push("sidebar");
    },
      setTool: (tool) => {
      calls.push(`tool:${tool}`);
    },
    };

    const byId = new Map(createPdfCommands(bridge).map((command) => [command.id, command]));
    byId.get(PDF_COMMAND_IDS.fileOpen)?.run();
    byId.get(PDF_COMMAND_IDS.fileSave)?.run();
    byId.get(PDF_COMMAND_IDS.fileSaveAs)?.run();
    byId.get(PDF_COMMAND_IDS.viewZoomIn)?.run();
    byId.get(PDF_COMMAND_IDS.viewZoomOut)?.run();
    byId.get(PDF_COMMAND_IDS.viewZoomReset)?.run();
    byId.get(PDF_COMMAND_IDS.viewNextPage)?.run();
    byId.get(PDF_COMMAND_IDS.viewPrevPage)?.run();
    byId.get(PDF_COMMAND_IDS.viewFind)?.run();
    byId.get(PDF_COMMAND_IDS.viewSidebar)?.run();
    byId.get(PDF_COMMAND_IDS.toolSelect)?.run();
    byId.get(PDF_COMMAND_IDS.toolDraw)?.run();
    byId.get(PDF_COMMAND_IDS.toolNote)?.run();

    expect(calls).toEqual([
      "open",
      "save",
      "save-as",
      "zoom-in",
      "zoom-out",
      "zoom-reset",
      "next-page",
      "prev-page",
      "find",
      "sidebar",
      "tool:select",
      "tool:ink",
      "tool:note",
    ]);
  });

  it("使用 SDK 测试宿主完成命令注册与调用", async () => {
    const client = createMockChipsClient();
    const invoked: string[] = [];
    client.command.onInvoked((event) => {
      invoked.push(event.commandId);
    });

    for (const definition of pdfCommandDefinitions) {
      await client.command.register(definition);
    }
    const listed = await client.command.list({ includeDisabled: true });
    await client.command.invoke(PDF_COMMAND_IDS.fileOpen, {}, { source: "toolbar" });

    expect(client.calls.slice(0, pdfCommandDefinitions.length).every((call) => call.action === "command.register")).toBe(true);
    expect(listed.map((command) => command.commandId)).toEqual(pdfCommandDefinitions.map((definition) => definition.commandId));
    expect(client.calls.at(-1)?.payload).toMatchObject({
      commandId: PDF_COMMAND_IDS.fileOpen,
      source: "toolbar",
      payload: {},
    });
    expect(invoked).toEqual([PDF_COMMAND_IDS.fileOpen]);
    client.restoreBridge();
  });

  it("按命令 ID 识别宿主转发的事件并拒绝外部命令", () => {
    const definition = pdfCommandDefinitions[0] as (typeof pdfCommandDefinitions)[number];
    const event: CommandInvokedEvent = {
      commandId: PDF_COMMAND_IDS.fileOpen,
      handlerId: PDF_COMMAND_HANDLER_IDS[PDF_COMMAND_IDS.fileOpen],
      ownerPluginId: APP_PLUGIN_ID,
      invocationId: "invocation-test",
      source: "palette",
      command: {
        ...definition,
        diagnostic: { visible: true, enabled: true, checked: false },
      },
    };

    expect(isPdfCommandInvokedEvent(event)).toBe(true);
    expect(getPdfCommandId(event)).toBe(PDF_COMMAND_IDS.fileOpen);

    const foreignEvent: CommandInvokedEvent = {
      ...event,
      commandId: "com.chips.other.command",
      handlerId: "other:command",
      ownerPluginId: "com.chips.other",
    };
    expect(isPdfCommandInvokedEvent(foreignEvent)).toBe(false);
    expect(getPdfCommandId(foreignEvent)).toBeNull();
  });
});
