// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { App } from "../../src/App";
import { sceneDefinitions } from "../../src/app/scene-registry";
import { formatMessage } from "../../src/lib/messages";
import { renderWithAntd } from "../../src/testing/render-with-antd";

afterEach(() => {
  cleanup();
});

describe("应用根组件", () => {
  it("应当导出可渲染的 React 组件并完成一次完整渲染", async () => {
    expect(App).toBeTypeOf("function");
    const mounted = render(renderWithAntd(<App />).element);
    const title = await waitForStartHome(mounted.container, "h1.start-home__title");
    expect(title.textContent).toBe(formatMessage("start-home.title"));
    mounted.unmount();
  });

  it("起始页展示中文文案与打开入口", async () => {
    const mounted = render(renderWithAntd(<App />).element);
    const { container } = mounted;
    await waitForStartHome(container, "p.start-home__description");
    expect(container.querySelector("p.start-home__description")?.textContent).toBe(
      formatMessage("start-home.description"),
    );
    expect(container.querySelector("p.start-home__formats")?.textContent).toBe(
      formatMessage("start-home.formats"),
    );
    expect(container.querySelector("p.start-home__shortcut")?.textContent).toBe(
      formatMessage("start-home.hints.shortcut"),
    );
    const openButton = container.querySelector("button.start-home__open-button");
    expect(openButton?.textContent).toBe(formatMessage("start-home.actions.open"));
    mounted.unmount();
  });

  it("场景注册表提供起始页与文档编辑两个场景", () => {
    expect(sceneDefinitions.map((scene) => scene.id)).toEqual(["start", "document"]);
    expect(sceneDefinitions[0]?.title).toBe("起始页");
    expect(sceneDefinitions[1]?.title).toBe("文档编辑");
  });

  it("文案表支持 {param} 插值且未知键原样返回", () => {
    expect(formatMessage("toolbar.heading.level", { level: 3 })).toBe("标题 3");
    expect(formatMessage("status.words", { count: 12 })).toBe("字数：12");
    expect(formatMessage("app.missing.key")).toBe("app.missing.key");
  });
});

function waitForStartHome(container: HTMLElement, selector: string): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const poll = (): void => {
      const element = container.querySelector<HTMLElement>(selector);
      if (element) {
        resolve(element);
        return;
      }
      if (Date.now() - startedAt > 5000) {
        reject(new Error(`等待起始页元素超时：${selector}`));
        return;
      }
      window.setTimeout(poll, 50);
    };
    poll();
  });
}
