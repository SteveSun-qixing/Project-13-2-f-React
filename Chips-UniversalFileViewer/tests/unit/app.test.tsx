import { describe, it, expect } from "vitest";
import { App } from "../../src/App";
import { AppRoot } from "../../src/app/AppRoot";
import { UNIVERSAL_VIEWER_SCENE_IDS, getSceneIdForFile } from "../../src/app/scene-registry";
import { formatMessage } from "../../src/lib/messages";
import { createAppMockClient, appMockLaunchContext } from "../../src/testing/mock-environment";
import { renderWithAntd } from "../../src/testing/render-with-antd";

describe("App（万能文件查看器根组件）", () => {
  it("应当导出一个可用的 React 组件", () => {
    expect(App).toBeTypeOf("function");
    expect(App).toBe(AppRoot);
  });

  it("应通过本地中文文案表解析文案与参数插值", () => {
    expect(formatMessage("universal-viewer.app.title")).toBe("万能文件查看器");
    expect(formatMessage("universal-viewer.commands.openFile.title")).toBe("打开文件…");
    expect(
      formatMessage("universal-viewer.errors.unsupportedFileForTarget", { fileName: "demo.exe" }),
    ).toBe("该文件类型不受支持：demo.exe");
    expect(formatMessage("universal-viewer.missing.key")).toBe("universal-viewer.missing.key");
  });

  it("应提供场景注册表与 Host mock 渲染外壳", () => {
    expect(getSceneIdForFile(false)).toBe(UNIVERSAL_VIEWER_SCENE_IDS.empty);
    expect(getSceneIdForFile(true)).toBe(UNIVERSAL_VIEWER_SCENE_IDS.viewer);

    const client = createAppMockClient();
    expect(client.state.launchContext.sceneId).toBe("universal-viewer.scene.main");
    expect(client.state.permissions).toContain("command.invoke");
    client.restoreBridge();

    const rendered = renderWithAntd(<App />);
    expect(rendered.element).toBeTruthy();
    rendered.client.restoreBridge();
  });

  it("mock 启动上下文应携带应用身份", () => {
    expect(appMockLaunchContext.pluginId).toBe("com.chips.universal-file-viewer");
  });
});
