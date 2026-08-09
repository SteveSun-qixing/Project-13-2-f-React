import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "../..");

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("薯片社区客户端预览与质量脚本 smoke", () => {
  it("应生成完整 verify 脚本与预览 smoke 校验入口", () => {
    const pkg = JSON.parse(readProjectFile("package.json"));
    expect(pkg.scripts.typecheck).toBe("tsc -p tsconfig.json --noEmit");
    expect(pkg.scripts["preview:smoke"]).toContain("chipsdev-r preview --mode mock --target app");
    expect(pkg.scripts["preview:smoke"]).toContain("reports/preview/app-preview-smoke.json");
    expect(pkg.scripts["quality:gate"]).toContain("chipsdev-r quality gate");
    expect(pkg.scripts["quality:gate"]).toContain("reports/quality/quality-gate.json");
    expect(pkg.scripts.verify).toContain("npm run preview:smoke");
    expect(pkg.scripts.verify).toContain("npm run quality:gate");
  });

  it("应保持 manifest、预览脚本与源码身份干净", () => {
    const manifest = readProjectFile("manifest.yaml");
    const previewSmoke = readProjectFile("src/preview/preview-smoke.js");
    const sourceBundle = [
      readProjectFile("src/App.tsx"),
      readProjectFile("src/app/AppRoot.tsx"),
      readProjectFile("src/app/AppShell.tsx"),
      readProjectFile("src/app/scene-registry.ts"),
      readProjectFile("src/commands/app-commands.tsx"),
      readProjectFile("src/commands/useAppCommands.ts"),
      readProjectFile("src/runtime/community-runtime.ts"),
    ].join("\n");

    expect(manifest).toContain("type: app");
    expect(manifest).toContain("id: com.chips.community-client");
    expect(manifest).toContain("name: 薯片社区");
    expect(manifest).not.toMatch(/^commands\s*:/m);
    expect(manifest).not.toContain("theme.read");
    expect(manifest).not.toContain("i18n.read");
    expect(manifest).not.toContain("i18n.write");
    expect(previewSmoke).toContain("chipsdev.preview");
    expect(previewSmoke).toContain("reportOnly");
    expect(previewSmoke).toContain("manifest.runtimeTargets");
    expect(previewSmoke).toContain("manifest.surface");
    expect(sourceBundle).toContain("HashRouter");
    expect(sourceBundle).toContain("AuthProvider");
    expect(sourceBundle).toContain("CommunityPreferencesProvider");
    expect(sourceBundle).toContain("useAppCommands");
    expect(sourceBundle).toContain("createAppCommands");
    expect(sourceBundle).toContain("COMMUNITY_REFRESH_TOKEN_REF");
    const forbiddenIdentityPattern = new RegExp([
      "app-" + "standard",
      "chips-" + "scaffold-app",
      "Example" + "Panel",
      "com.example",
    ].join("|"));
    expect(sourceBundle).not.toMatch(forbiddenIdentityPattern);
    expect(sourceBundle).not.toContain("style={{");
  });

  it("社区业务源码应使用正式 SDK / Host 链路", () => {
    const communitySources = [
      "src/community/api/client.ts",
      "src/community/api/auth.ts",
      "src/community/api/content.ts",
      "src/community/lib/transfer.ts",
      "src/community/lib/server-config.ts",
      "src/community/contexts/AuthContext.tsx",
      "src/community/pages/WorkspacePage.tsx",
      "src/community/pages/ProfilePage.tsx",
    ].map(readProjectFile).join("\n");

    expect(communitySources).toContain("chipsClient");
    expect(communitySources).toContain("client.communityCardTransfer");
    expect(communitySources).toContain("client.platform.openFile");
    expect(communitySources).toContain("client.communityCardTransfer.download");
    expect(communitySources).toContain("client.credential");
    expect(communitySources).not.toContain("require(");
    expect(communitySources).not.toContain("window.require");
    expect(communitySources).not.toContain("electron");
  });

  it("客户端页面路由与服务器连接入口应齐全", () => {
    const shell = readProjectFile("src/app/AppShell.tsx");
    for (const route of [
      'path="/"',
      'path="/about"',
      'path="/login"',
      'path="/register"',
      'path="/:username"',
      'path="/workspace"',
      'path="/settings"',
    ]) {
      expect(shell).toContain(route);
    }
    expect(shell).not.toContain('path="/boxes/:boxId"');
    expect(shell).not.toContain("BoxDetailPage");

    const settings = readProjectFile("src/community/pages/SettingsPage.tsx");
    expect(settings).toContain("saveCommunityServerUrl");
    expect(settings).toContain("normalizeCommunityServerUrl");
  });

  it("卡片与箱子点击都应直接打开本地查看器而不是信息页", () => {
    const workTile = readProjectFile("src/community/components/WorkTile.tsx");
    expect(workTile).toContain("openInLocalViewer");
    expect(workTile).toContain("openBoxInLocalViewer");
    expect(workTile).toContain("resolveCommunityUrl");
    expect(workTile).not.toContain("/cards/");
    expect(workTile).not.toContain('to="/boxes/');
    const shell = readProjectFile("src/app/AppShell.tsx");
    expect(shell).not.toContain("cards/:cardId");
    expect(shell).not.toContain("CardDetailPage");
    expect(shell).not.toContain("BoxDetailPage");
  });
});
