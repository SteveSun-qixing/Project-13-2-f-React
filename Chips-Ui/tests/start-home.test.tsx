// @vitest-environment jsdom
import { App, ConfigProvider } from "antd";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { StartHome } from "../src/components/StartHome";
import { appleTheme } from "../src/theme/apple-theme";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("StartHome", () => {
  it("使用共享 token 渲染起始页并为打开操作提供图标", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ConfigProvider theme={appleTheme}>
          <App>
            <StartHome
              title="薯片文字"
              description="创建或打开文档"
              formatsText="支持 DOCX"
              openLabel="打开文件"
              shortcutText="⌘O"
              dragActiveText="松开以打开"
              dragActive
              icon={<span data-testid="app-icon" />}
              onOpen={() => undefined}
            />
          </App>
        </ConfigProvider>,
      );
    });

    expect(container.querySelector("h1")?.textContent).toBe("薯片文字");
    expect(container.querySelector("button svg")).toBeTruthy();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("松开以打开");
    expect((container.querySelector(".start-home") as HTMLElement | null)?.style.getPropertyValue("--start-home-bg")).toBeTruthy();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("在提供新建回调时显示独立的新建入口", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let created = false;

    act(() => {
      root.render(
        <ConfigProvider theme={appleTheme}>
          <App>
            <StartHome
              title="薯片文字"
              description="创建或打开文档"
              formatsText="支持 DOCX"
              openLabel="打开文件"
              createLabel="新建文档"
              shortcutText="⌘O"
              dragActiveText="松开以打开"
              dragActive={false}
              icon={<span />}
              onOpen={() => undefined}
              onCreate={() => {
                created = true;
              }}
            />
          </App>
        </ConfigProvider>,
      );
    });

    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    act(() => {
      (buttons[1] as HTMLButtonElement).click();
    });
    expect(created).toBe(true);
    act(() => root.unmount());
    container.remove();
  });
});
