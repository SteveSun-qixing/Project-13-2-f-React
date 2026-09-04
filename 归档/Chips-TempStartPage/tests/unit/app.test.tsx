// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { App } from "../../src/App";
import { AppRoot } from "../../src/app/AppRoot";
import { StartHome } from "../../src/components/StartHome";
import { formatMessage } from "../../src/lib/messages";
import { renderWithAntd } from "../../src/testing/render-with-antd";

describe("App（起始页参考实现）", () => {
  it("应当导出一个可用的 React 组件", () => {
    expect(App).toBeTypeOf("function");
    expect(App).toBe(AppRoot);
  });

  it("应通过本地中文文案表解析文案与参数插值", () => {
    expect(formatMessage("start-home.title")).toBe("薯片办公起始页");
    expect(formatMessage("start-home.actions.open")).toBe("打开文件");
    expect(formatMessage("start-home.missing.key")).toBe("start-home.missing.key");
  });

  it("应渲染起始页核心内容", () => {
    const mounted = render(
      renderWithAntd(
        <StartHome
          title={formatMessage("start-home.title")}
          description={formatMessage("start-home.description")}
          formatsText={formatMessage("start-home.formats")}
          openLabel={formatMessage("start-home.actions.open")}
          shortcutText={formatMessage("start-home.hints.shortcut")}
          dragActiveText={formatMessage("start-home.hints.dropToOpen")}
          dragActive={false}
          icon={<span data-testid="start-home-icon" />}
          onOpen={() => {}}
        />,
      ).element,
    );
    expect(mounted.container.textContent).toContain("薯片办公起始页");
    expect(mounted.container.textContent).toContain("打开文件");
    expect(mounted.container.textContent).toContain("支持 .docx 格式");
  });

  it("拖拽激活时应展示拖放覆盖层", () => {
    const mounted = render(
      renderWithAntd(
        <StartHome
          title="标题"
          description="描述"
          formatsText="格式"
          openLabel="打开"
          shortcutText="快捷键"
          dragActiveText="松开以打开"
          dragActive
          icon={null}
          onOpen={() => {}}
        />,
      ).element,
    );
    expect(mounted.container.querySelector(".start-home__drop-overlay")).toBeTruthy();
    expect(mounted.container.textContent).toContain("松开以打开");
  });

  it("未拖拽时不应渲染拖放覆盖层", () => {
    const mounted = render(
      renderWithAntd(
        <StartHome
          title="标题"
          description="描述"
          formatsText="格式"
          openLabel="打开"
          shortcutText="快捷键"
          dragActiveText="松开以打开"
          dragActive={false}
          icon={null}
          onOpen={() => {}}
        />,
      ).element,
    );
    expect(mounted.container.querySelector(".start-home__drop-overlay")).toBeNull();
  });
});
