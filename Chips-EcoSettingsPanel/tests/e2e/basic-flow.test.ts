import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import routeManifest from "../../../Chips-SDK/src/contracts/route-manifest.json";
import { SETTINGS_PANEL_PERMISSIONS } from "../../src/app/settings-permissions";

const testDir = fileURLToPath(new URL(".", import.meta.url));

const expectedPermissions = [
  "theme.write",
  "i18n.write",
  "plugin.read",
  "plugin.manage",
  "platform.read",
  "platform.external",
  "command.read",
  "command.write",
  "command.invoke",
] as const;

const settingsPanelActions = [
  "platform.getInfo",
  "plugin.query",
  "plugin.get",
  "plugin.install",
  "plugin.enable",
  "plugin.disable",
  "plugin.uninstall",
  "plugin.launch",
  "plugin.getShortcut",
  "plugin.createShortcut",
  "plugin.removeShortcut",
  "platform.dialogOpenFile",
  "platform.dialogShowConfirm",
  "platform.dialogShowMessage",
  "platform.shellShowItemInFolder",
  "command.list",
  "command.register",
  "command.unregister",
  "command.invoke",
] as const;

function readManifestPermissions(): string[] {
  const manifest = parse(readFileSync(resolve(testDir, "../../manifest.yaml"), "utf8")) as {
    permissions?: unknown;
  };
  return Array.isArray(manifest.permissions)
    ? manifest.permissions.filter((permission): permission is string => typeof permission === "string")
    : [];
}

describe("应用插件基础流程基线", () => {
  it("声明了设置面板运行所需的正式入口与权限", () => {
    const manifest = readFileSync(resolve(testDir, "../../manifest.yaml"), "utf8");

    expect(manifest).toContain("id: com.chips.eco-settings-panel");
    expect(manifest).toContain("entry: dist/index.html");

    for (const permission of expectedPermissions) {
      expect(manifest).toContain(`- ${permission}`);
    }

    expect(manifest).not.toContain("- theme.read");
    expect(manifest).not.toContain("- i18n.read");
  });

  it("保持 manifest 与运行时权限常量一致", () => {
    expect(readManifestPermissions().sort()).toEqual([...expectedPermissions].sort());
    expect([...SETTINGS_PANEL_PERMISSIONS].sort()).toEqual([...expectedPermissions].sort());
  });

  it("覆盖当前设置面板实际消费的 SDK 路由权限", () => {
    const granted = new Set(readManifestPermissions());
    const missing = new Set<string>();

    for (const action of settingsPanelActions) {
      const route = routeManifest.routes[action];
      expect(route, action).toBeDefined();
      for (const permission of route.permission ?? []) {
        if (!granted.has(permission)) {
          missing.add(permission);
        }
      }
    }

    expect([...missing]).toEqual([]);
  });
});
