import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MockChipsClient } from "chips-sdk";
import { SettingsRuntimeService } from "../../src/shared/runtime/settings-runtime-service";
import { createSettingsMockClient } from "../support/settings-host";

const clients: MockChipsClient[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.restoreBridge();
  }
});

function track(): MockChipsClient {
  const client = createSettingsMockClient();
  clients.push(client);
  return client;
}

describe("文件打开方式治理", () => {
  it("listHandlers 返回处理器槽位视图", async () => {
    const service = new SettingsRuntimeService(track());
    const slots = await service.listFileOpenHandlers();

    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      capability: "file-handler:.png",
      kind: "file-handler",
      preferenceKey: "ext:.png",
      defaultPluginId: "com.chips.photo-viewer",
    });
    expect(slots[0]?.plugins.map((plugin) => plugin.tier)).toEqual(["primary", "fallback"]);
  });

  it("设置默认查看器写入 fileOpen.defaults 配置", async () => {
    const client = track();
    const service = new SettingsRuntimeService(client);

    await service.setFileOpenDefaultPreference("ext:.png", "com.chips.universal-file-viewer");
    expect(await service.getFileOpenDefaults()).toEqual({
      "ext:.png": "com.chips.universal-file-viewer",
    });

    const setCall = client.calls.find((call) => call.action === "config.set");
    expect(setCall?.payload).toMatchObject({
      key: "fileOpen.defaults",
      value: { "ext:.png": "com.chips.universal-file-viewer" },
    });
  });

  it("清除偏好后恢复自动匹配", async () => {
    const service = new SettingsRuntimeService(track());

    await service.setFileOpenDefaultPreference("ext:.png", "com.chips.universal-file-viewer");
    await service.setFileOpenDefaultPreference("ext:.png", null);
    expect(await service.getFileOpenDefaults()).toEqual({});
  });

  it("恢复全部默认会删除配置键", async () => {
    const client = track();
    const service = new SettingsRuntimeService(client);

    await service.setFileOpenDefaultPreference("ext:.png", "com.chips.universal-file-viewer");
    await service.resetFileOpenDefaults();
    expect(await service.getFileOpenDefaults()).toEqual({});
    expect(client.calls.some((call) => call.action === "config.reset")).toBe(true);
  });

  it("页面渲染包含扩展名与 MIME 分组", async () => {
    vi.resetModules();
    vi.doMock("../../src/app/providers/I18nProvider", () => ({
      useI18n() {
        return { t(key: string) { return key; } };
      },
    }));
    vi.doMock("../../src/features/file-open/useFileOpenGovernance", () => ({
      useFileOpenGovernance() {
        return {
          slots: [
            {
              capability: "file-handler:.png",
              kind: "file-handler",
              extension: ".png",
              preferenceKey: "ext:.png",
              preferencePluginId: null,
              defaultPluginId: "com.chips.photo-viewer",
              plugins: [
                { pluginId: "com.chips.photo-viewer", name: "图片查看器", tier: "primary", isPreferred: false },
                { pluginId: "com.chips.universal-file-viewer", name: "万能文件查看器", tier: "fallback", isPreferred: false },
              ],
            },
            {
              capability: "resource-handler:view:image/*",
              kind: "resource-handler",
              mimeType: "image/*",
              preferenceKey: "mime:image/*",
              preferencePluginId: "com.chips.universal-file-viewer",
              defaultPluginId: "com.chips.universal-file-viewer",
              plugins: [
                { pluginId: "com.chips.universal-file-viewer", name: "万能文件查看器", tier: "fallback", isPreferred: true },
              ],
            },
          ],
          loading: false,
          error: null,
          activeKey: null,
          feedbackItems: [],
          removeFeedback: () => undefined,
          clearError: () => undefined,
          refresh: async () => undefined,
          setDefaultHandler: async () => undefined,
          resetAllDefaults: async () => undefined,
        };
      },
    }));

    const { FileOpenPage } = await import("../../src/features/file-open/FileOpenPage");
    const markup = renderToStaticMarkup(<FileOpenPage />);

    expect(markup).toContain("settingsPanel.fileOpen.title");
    expect(markup).toContain(".png");
    expect(markup).toContain("settingsPanel.fileOpen.extensionSection");
    expect(markup).toContain("settingsPanel.fileOpen.mimeSection");
    expect(markup).toContain("settingsPanel.fileOpen.preferredTag");
    expect(markup).toContain("settingsPanel.fileOpen.resetAll");
    vi.doUnmock("../../src/features/file-open/useFileOpenGovernance");
    vi.doUnmock("../../src/app/providers/I18nProvider");
  });
});
