// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render, waitFor } from "@testing-library/react";
import { App } from "../../src/App";
import { createRuntimeDiagnostic } from "../../src/app/AppRuntimeProvider";
import { sceneDefinitions } from "../../src/app/scene-registry";
import { formatMessage } from "../../src/lib/messages";
import { renderWithAntd } from "../../src/testing/render-with-antd";

describe("App 渲染与起始页", () => {
  it("应当导出 AppRoot 作为应用根组件", () => {
    expect(App).toBeTypeOf("function");
  });

  it("应通过本地中文文案表解析文案与参数插值", () => {
    expect(formatMessage("app.identity.displayName")).toBe("演示文稿编辑器");
    expect(formatMessage("start.actions.open")).toBe("打开演示文稿");
    expect(formatMessage("deck.slide.counter", { current: 1, total: 3 })).toBe(
      "幻灯片 1 / 3",
    );
    expect(formatMessage("app.missing.key")).toBe("app.missing.key");
  });

  it("应提供 start/deck 两个场景", () => {
    expect(sceneDefinitions.map((scene) => scene.id)).toEqual(["start", "deck"]);
    expect(sceneDefinitions[0]?.title).toBe("起始页");
  });

  it("无启动目标时渲染起始页并显示打开入口", async () => {
    const rendered = renderWithAntd(<App />);
    render(rendered.element);

    await waitFor(() => {
      expect(screen.getByText("演示文稿编辑器")).toBeTruthy();
    });
    expect(screen.getByText("打开演示文稿")).toBeTruthy();
    expect(screen.getByText(/支持格式：PowerPoint 演示文稿/)).toBeTruthy();

    rendered.client.restoreBridge();
  });

  it("诊断对象构造包含来源与明细", () => {
    const diagnostic = createRuntimeDiagnostic("APP_TEST", "测试诊断。", "test", {
      sceneId: "start",
    });
    expect(diagnostic).toMatchObject({
      code: "APP_TEST",
      source: "test",
      details: { sceneId: "start" },
    });
  });
});
