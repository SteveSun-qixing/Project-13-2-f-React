import { describe, expect, it } from "vitest";
import {
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  createAppCommands,
  type AppCommandHandlers,
} from "../../src/commands/app-commands";
import { appConfig } from "../../config/app-config";

const noopHandlers: AppCommandHandlers = {
  openWorkspace: () => undefined,
  openSettings: () => undefined,
};

describe("app command contract", () => {
  it("以应用作用域 ID 与中文标题声明命令", () => {
    const commands = createAppCommands(noopHandlers);
    expect(commands.length).toBeGreaterThanOrEqual(2);

    for (const command of commands) {
      expect(command.id.startsWith(`${appConfig.appId}.`)).toBe(true);
      expect(command.title.length).toBeGreaterThan(0);
      expect(typeof command.run).toBe("function");
      expect(command.menuId).toBe("app");
      expect(command.toolbarId).toBe("main");
    }
  });

  it("命令 ID 常量保持稳定", () => {
    expect(APP_PLUGIN_ID).toBe("com.chips.community-client");
    expect(APP_COMMAND_IDS.openWorkspace).toBe("com.chips.community-client.open-workspace");
    expect(APP_COMMAND_IDS.openSettings).toBe("com.chips.community-client.open-settings");
  });

  it("run 应分发到对应处理器", () => {
    const invoked: string[] = [];
    const commands = createAppCommands({
      openWorkspace: () => invoked.push("openWorkspace"),
      openSettings: () => invoked.push("openSettings"),
    });

    commands.find((command) => command.id === APP_COMMAND_IDS.openWorkspace)?.run();
    commands.find((command) => command.id === APP_COMMAND_IDS.openSettings)?.run();
    expect(invoked).toEqual(["openWorkspace", "openSettings"]);
  });
});
