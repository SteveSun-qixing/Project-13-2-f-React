import { describe, it, expect } from "vitest";
import type { PlatformLaunchContext, SurfaceContext } from "chips-sdk";
import { App } from "../../src/App";
import { AppRoot } from "../../src/app/AppRoot";
import {
  createRuntimeDiagnostic,
  resolveRuntimeSceneId,
} from "../../src/app/AppRuntimeProvider";
import { sceneDefinitions } from "../../src/app/scene-registry";
import { createAppMockClient } from "../../src/testing/mock-environment";
import { renderWithAntd } from "../../src/testing/render-with-antd";

describe("App (图标工坊应用插件根组件)", () => {
  it("应当导出一个可用的 React 组件", () => {
    expect(App).toBeTypeOf("function");
    expect(App).toBe(AppRoot);
  });

  it("应提供场景注册表与 Host mock 渲染外壳", () => {
    expect(sceneDefinitions.map((scene) => scene.id)).toEqual(["main", "settings"]);

    const client = createAppMockClient();
    expect(client.state.launchContext.sceneId).toBe("main");
    expect(client.state.permissions).toContain("command.invoke");
    client.restoreBridge();

    const rendered = renderWithAntd(<App />);
    expect(rendered.element).toBeTruthy();
    expect(rendered.client.state.launchContext.surfaceContext?.sceneId).toBe("main");
    rendered.client.restoreBridge();
  });

  it("应从 launch context 解析运行时场景和诊断对象", () => {
    const client = createAppMockClient();
    expect(
      resolveRuntimeSceneId(
        client.state.launchContext as unknown as PlatformLaunchContext,
      ),
    ).toBe("main");

    const diagnostic = createRuntimeDiagnostic(
      "APP_RUNTIME_TEST",
      "运行时测试诊断。",
      "test",
      { sceneId: "main" },
    );
    expect(diagnostic).toMatchObject({
      code: "APP_RUNTIME_TEST",
      source: "test",
      details: { sceneId: "main" },
    });
    client.restoreBridge();
  });
});
