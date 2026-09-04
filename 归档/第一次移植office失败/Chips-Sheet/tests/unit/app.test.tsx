// @vitest-environment jsdom
import "../../src/testing/jsdom-polyfills";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { App } from "../../src/App";
import { AppRoot } from "../../src/app/AppRoot";
import { sceneDefinitions } from "../../src/app/scene-registry";
import { formatMessage } from "../../src/lib/messages";
import { renderWithAntd } from "../../src/testing/render-with-antd";

afterEach(() => {
  cleanup();
});

describe("应用根组件", () => {
  it("App 即 AppRoot，应用外壳以 AppChrome 承载", () => {
    expect(App).toBeTypeOf("function");
    expect(App).toBe(AppRoot);
  });

  it("本地中文文案表支持参数插值，未知键原样返回", () => {
    expect(formatMessage("app.identity.displayName")).toBe("表格编辑器");
    expect(formatMessage("message.saveSuccess", { path: "/tmp/a.xlsx" })).toBe(
      "已保存到 /tmp/a.xlsx",
    );
    expect(formatMessage("app.missing.key")).toBe("app.missing.key");
  });

  it("场景注册表包含起始页与表格编辑两个场景", () => {
    expect(sceneDefinitions.map((scene) => scene.id)).toEqual(["start", "workbook"]);
    expect(sceneDefinitions[0]?.title).toBe("起始页");
    expect(sceneDefinitions[1]?.title).toBe("表格编辑");
  });

  it("无启动目标时渲染起始页，展示打开入口与支持格式", async () => {
    const rendered = renderWithAntd(<App />);
    render(rendered.element);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "表格编辑器" })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "打开表格文件" })).toBeTruthy();
    expect(screen.getByText("支持格式：.xlsx / .xlsm / .csv")).toBeTruthy();
    expect(screen.getByText(/Mod\+O/)).toBeTruthy();
  });

  it("mock 宿主提供 launch context 与命令权限", () => {
    const client = renderWithAntd(<App />).client;
    expect(client.state.launchContext.surfaceContext?.sceneId).toBe("main");
    expect(client.state.permissions).toContain("command.invoke");
  });
});
