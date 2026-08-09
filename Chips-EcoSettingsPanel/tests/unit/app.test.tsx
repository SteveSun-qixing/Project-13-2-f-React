import React from "react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("App (标准应用插件根组件)", () => {
  it("应当导出一个可用的 React 组件", async () => {
    const { App } = await import("../../src/App");
    expect(App).toBeTypeOf("function");
  }, 15000);

  it("渲染应用外壳、左侧导航与移动端切换器结构", async () => {
    const { App } = await import("../../src/App");
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("chips-app-chrome");
    expect(markup).toContain("settings-app-shell");
    expect(markup).toContain("settings-sidebar__nav");
    expect(markup).toContain("settings-sidebar__item");
    expect(markup).toContain("settings-mobile-nav");
    expect(markup).toContain("settings-sidebar__search-input");
    expect(markup).toContain("应用插件");
    expect(markup).toContain("卡片插件");
    expect(markup).toContain("布局插件");
    expect(markup).toContain("模块插件");
    expect(markup).toContain("预览与质量");
    expect(markup).not.toContain("主题管理");
    expect(markup).not.toContain("多语言");
    expect(markup).toContain("组件展示");
    expect(markup).not.toContain("主题诊断");
  }, 15000);

  it("每个治理场景都注册了导航图标与 Host 图标名", async () => {
    const { App } = await import("../../src/App");
    const { SETTINGS_SCENE_ICONS } = await import("../../src/app/settings-scene-icons");
    const { sceneDefinitions } = await import("../../src/app/scene-registry");
    const markup = renderToStaticMarkup(<App />);

    for (const scene of sceneDefinitions) {
      const registration = SETTINGS_SCENE_ICONS[scene.id];
      expect(registration.name.length).toBeGreaterThan(0);
      expect(registration.icon).toBeTruthy();
    }
    expect(markup).toContain("anticon");
  }, 15000);

  it("设置面板私有样式已收敛为 antd 常量取值，无废弃体系残留", () => {
    const stylesPath = fileURLToPath(new URL("../../src/app/styles.css", import.meta.url));
    const styles = readFileSync(stylesPath, "utf-8");
    const chipsSysPrefix = ["chips", "sys"].join("-");
    const chipsBasePrefix = ["chips", "base"].join("-");
    const themeAttrPrefix = ["data", "chips", "theme"].join("-");

    expect(styles).not.toContain(chipsSysPrefix);
    expect(styles).not.toContain(chipsBasePrefix);
    expect(styles).not.toContain("data-scope");
    expect(styles).not.toContain(themeAttrPrefix);
    expect(styles).toContain("#0a84ff");
    expect(styles).toContain(".settings-app-shell");
    expect(styles).toContain("#f5f5f7");
  });
});
