import { describe, it, expect } from "vitest";
import { App } from "../../src/App";
import { AppRoot } from "../../src/app/AppRoot";
import { sceneDefinitions } from "../../src/app/scene-registry";
import { formatMessage } from "../../src/lib/messages";
import { createAppMockClient } from "../../src/testing/mock-environment";
import { renderWithChips } from "../../src/testing/render-with-chips";

describe("App (社区客户端根组件)", () => {
  it("应当导出一个可用的 React 组件", () => {
    expect(App).toBeTypeOf("function");
    expect(App).toBe(AppRoot);
  });

  it("中文文案表应能解析默认值与参数插值", () => {
    expect(formatMessage("brand.name")).toBe("薯片社区");
    expect(formatMessage("common.retry")).toBe("重试");
    expect(formatMessage("profile.manageSelectedCount", { count: 3 })).toBe("已选择 3 个作品");
    expect(formatMessage("client.settings.saveFailed", { message: "boom" })).toBe(
      "保存服务器设置失败：boom",
    );
    expect(formatMessage("app.missing.key")).toBe("app.missing.key");
  });

  it("应提供场景注册表与 Host mock 渲染外壳", () => {
    expect(sceneDefinitions.map((scene) => scene.id)).toEqual(["main", "settings"]);

    const client = createAppMockClient();
    expect(client.state.launchContext.sceneId).toBe("main");
    expect(client.state.permissions).toContain("command.invoke");
    client.restoreBridge();

    const rendered = renderWithChips(<App />);
    expect(rendered.element).toBeTruthy();
    expect(rendered.client.state.launchContext.surfaceContext?.sceneId).toBe("main");
    rendered.client.restoreBridge();
  });
});
