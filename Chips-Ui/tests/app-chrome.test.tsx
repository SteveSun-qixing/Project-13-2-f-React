// @vitest-environment jsdom
import { App, ConfigProvider } from "antd";
import { describe, expect, it, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { AppChrome } from "../src/components/AppChrome";
import { CommandProvider } from "../src/runtime/commands";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderChrome(ui: ReactNode): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ConfigProvider>
        <App>
          <CommandProvider>{ui}</CommandProvider>
        </App>
      </ConfigProvider>,
    );
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("AppChrome", () => {
  it("渲染内容区且不渲染顶部菜单栏与工具栏", () => {
    const { container, unmount } = renderChrome(
      <AppChrome>
        <div className="test-content">内容</div>
      </AppChrome>,
    );

    const content = container.querySelector<HTMLElement>(".chips-app-chrome__content");
    const menuBar = container.querySelector(".chips-menu-bar");
    const toolbar = container.querySelector(".chips-toolbar");

    expect(content?.textContent).toContain("内容");
    expect(menuBar).toBeNull();
    expect(toolbar).toBeNull();
    unmount();
  });

  it("命令面板默认关闭", () => {
    const { container, unmount } = renderChrome(<AppChrome>内容</AppChrome>);

    const dialog = container.querySelector(".ant-modal");
    expect(dialog).toBeNull();
    unmount();
  });
});
